// WHAT IS HAPPENING IN A CLAUDE PANE RIGHT NOW (Neuaufbau K10 S1, docs/neuaufbau/befunde/08-chat-ansicht.md).
// A leaf like transcript-read.ts: never server.ts; server.ts hands in how to capture a pane and where
// the transcript lies. Two sources, each where it is the better witness (measured 2026-10-13 on Claude
// Code 2.1.296 in a tmux pane, every 100 ms against the transcript):
// - THE FRAME (`capture-pane -p -e`) says working, done, interrupted or a dialog the moment it is
//   painted. Its one blind spot: while answer text streams, the spinner line is gone and only the
//   growing text stands above the composer.
// - THE TRANSCRIPT says whether a request is still open (the prompt is there, its end_turn is not),
//   and it is Claude Code's own queue: `queue-operation` enqueue / dequeue / remove / popAll.
// It reads only what was appended since the last read — a 34 MB file costs one read, not one per poll.
import { open, stat } from "node:fs/promises";
import { composerBuffer } from "../composer";
import { isInterruptMark } from "../src/pendingsend";

export type Turn = "working" | "ready" | "asking" | "interrupted" | "unknown";
export type TurnDetail = "thinking" | "hooks" | null;
export interface QueuedPrompt { text: string; at: string | null }
export interface LiveState {
  turn: Turn;
  detail: TurnDetail;
  // Claude Code's own queue, oldest first: what the session holds back, whoever sent it
  queued: QueuedPrompt[];
  // what Claude Code's input field holds now ("" empty, null not on screen)
  composer: string | null;
  // transcript line numbers (1-based, non-empty lines — the numbering of GET /transcript) of prompts
  // Esc took back before any answer: Claude Code leaves the line, the next prompt becomes its sibling
  withdrawn: number[];
  at: number;
}

// --- the frame ---------------------------------------------------------------------------------
const SGR_RE = /\x1b\[[0-9;?]*[A-Za-z]/g;
const RULE_RE = /^─{3}/; // "────…" and the "─── History 2/2 ───" variant
const GLYPHS = "·✢✳✶✻✽*";
// "✢ Architecting… (1s · thinking)", "· Seasoning… (running Stop hooks… 3/4 · 4s · ↓ 536 tokens)",
// and the first frames of a turn without parentheses: "✻ Doing…"
const SPINNER_RE = new RegExp(`^[${GLYPHS}] [^…]+…(?: \\((.*)\\))?\\s*$`);
// "✻ Crunched for 29s · done 1:44 PM" — the line a finished turn leaves
const DONE_RE = new RegExp(`^[${GLYPHS}] \\S+ for \\d[^…]* · done\\b`);
const INTERRUPTED_RE = /Interrupted · What should Claude do instead\?/;
// the footer of every select / confirm dialog Claude Code paints in place of its input field:
// AskUserQuestion "Enter to select · ↑/↓ to navigate · Esc to cancel", the trust dialog
// "Enter to confirm · Esc to cancel", the rewind list "Enter to continue · Esc to cancel"
const DIALOG_RE = /^\s*Enter to (?:select|confirm|continue)\b.*Esc to cancel\s*$/;
const CLAUDE_COMPOSER = { kind: "glyph" as const, re: /^❯/ };

export interface FrameRead {
  // "text" = no spinner and no end mark above the input field: answer text streams, or the frame
  // shows something idle the frame alone cannot name — the transcript decides
  shape: "spinner" | "done" | "interrupted" | "dialog" | "text" | "unknown";
  detail: TurnDetail;
  composer: string | null;
}
export function readFrame(frame: string): FrameRead {
  const plain = frame.split("\n").map((l) => l.replace(SGR_RE, ""));
  const lines = plain.filter((l) => l.trim() !== "");
  if (lines.slice(-6).some((l) => DIALOG_RE.test(l))) return { shape: "dialog", detail: null, composer: null };
  const rules = lines.flatMap((l, i) => (RULE_RE.test(l) ? [i] : []));
  if (rules.length < 2) return { shape: "unknown", detail: null, composer: null };
  const top = rules[rules.length - 2]!;
  const composer = composerBuffer(CLAUDE_COMPOSER, frame);
  // the spinner sits right above the input field, under the queued prompts and over a "⎿ Tip:" line
  for (const l of lines.slice(Math.max(0, top - 6), top).reverse()) {
    const m = SPINNER_RE.exec(l);
    if (!m) continue;
    const parts = (m[1] ?? "").split(" · ");
    const detail: TurnDetail = parts.some((p) => /^running \S+ hooks/.test(p)) ? "hooks"
      : parts.some((p) => p === "thinking" || p === "still thinking") ? "thinking" : null;
    return { shape: "spinner", detail, composer };
  }
  const last = lines[top - 1]?.trim() ?? "";
  if (DONE_RE.test(last)) return { shape: "done", detail: null, composer };
  if (INTERRUPTED_RE.test(last)) return { shape: "interrupted", detail: null, composer };
  return { shape: "text", detail: null, composer };
}

// --- the transcript ----------------------------------------------------------------------------
export interface TailState {
  open: QueuedPrompt[];
  // a prompt (or a tool result) is in, its answer's end is not
  request: boolean;
  // parentUuid → line number of the newest real prompt under it (the sibling test for `withdrawn`)
  prompts: Map<string, number>;
  withdrawn: number[];
  lines: number;
}
export const emptyTail = (): TailState => ({ open: [], request: false, prompts: new Map(), withdrawn: [], lines: 0 });

const sharedTail = (a: string, b: string): number => {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
};
// Claude Code's own plumbing that arrives as a user line: slash-command echo and output, `!` shell
// input and output, reminders (the same names as server.ts#FRESH_TAIL_PLUMBING)
const OPENS = /^<(command-name|bash-input)>/;
const CLOSES = /^<(local-command-(stdout|stderr)|bash-(stdout|stderr))>/;
const PLUMBING = /^<(command-(name|message|args)|local-command-(stdout|stderr|caveat)|bash-(input|stdout|stderr)|system-reminder|task-notification)/;
const ENDS = new Set(["end_turn", "stop_sequence", "max_tokens", "refusal"]);

type Line = { type?: unknown; operation?: unknown; content?: unknown; timestamp?: unknown; isMeta?: unknown;
  isSidechain?: unknown; isCompactSummary?: unknown; isApiErrorMessage?: unknown; uuid?: unknown; parentUuid?: unknown;
  message?: { content?: unknown; stop_reason?: unknown } };
// a user line's text blocks (reminders dropped, as server.ts#viewEntry drops them) and whether it
// carries a tool result
function userParts(d: Line): { texts: string[]; results: boolean; plain: boolean } {
  const c = d.message?.content;
  if (typeof c === "string") return { texts: c.startsWith("<system-reminder") ? [] : [c], results: false, plain: true };
  if (!Array.isArray(c)) return { texts: [], results: false, plain: false };
  const blocks = c as { type?: unknown; text?: unknown }[];
  return {
    texts: blocks.flatMap((b) => (b?.type === "text" && typeof b.text === "string" && !b.text.startsWith("<system-reminder") ? [b.text] : [])),
    results: blocks.some((b) => b?.type === "tool_result"), plain: false,
  };
}

// One line at a time, in file order; `n` is its 1-based number among the non-empty lines.
export function foldLine(t: TailState, raw: string, n: number): TailState {
  const queueLine = raw.includes('"queue-operation"');
  const userLine = raw.includes('"user"');
  if (!queueLine && !userLine && !raw.includes('"assistant"')) return { ...t, lines: n };
  let d: Line;
  try { d = JSON.parse(raw) as Line; } catch { return { ...t, lines: n }; }
  if (d.isSidechain === true) return { ...t, lines: n };
  if (d.type === "queue-operation") {
    const text = typeof d.content === "string" ? d.content : "";
    const at = typeof d.timestamp === "string" ? d.timestamp : null;
    if (d.operation === "enqueue") return { ...t, open: [...t.open, { text, at }], lines: n };
    if (d.operation === "dequeue") return { ...t, open: t.open.slice(1), lines: n };
    // ↑ in the input field takes EVERY waiting prompt back for editing (measured: one popAll line)
    if (d.operation === "popAll") return { ...t, open: [], lines: n };
    if (d.operation === "remove") {
      // a remove whose content changed (a cross-session message loses its hop-chain attribute) takes
      // the entry that ends the same way for longest, the oldest when none shares an ending
      const exact = t.open.findIndex((q) => q.text === text);
      const tails = t.open.map((q) => sharedTail(q.text, text));
      const hit = exact >= 0 ? exact : Math.max(0, tails.indexOf(Math.max(0, ...tails)));
      return { ...t, open: t.open.filter((_, i) => i !== hit), lines: n };
    }
    return { ...t, lines: n };
  }
  if (d.type === "assistant") {
    const stop = d.message?.stop_reason;
    const ends = d.isApiErrorMessage === true || (typeof stop === "string" && ENDS.has(stop));
    return { ...t, request: ends ? false : t.request, lines: n };
  }
  if (d.type !== "user" || d.isMeta === true) return { ...t, lines: n };
  const { texts, results, plain } = userParts(d);
  if (!texts.length) return results ? { ...t, request: true, lines: n } : { ...t, lines: n };
  const first = texts[0]!;
  const interrupt = !results && texts.every(isInterruptMark);
  // THE QUEUE IS DRAINED by every line server.ts#viewEntry shows as the owner's turn: before that turn
  // started Claude Code took everything it held (the rule sessionQueue always had, e2e/slots.ts pins it)
  const shown = !interrupt && d.isCompactSummary !== true && !(plain && first.startsWith("<task-notification"));
  const open = shown ? [] : t.open;
  const request = interrupt || CLOSES.test(first) ? false
    : results || OPENS.test(first) || (shown && !PLUMBING.test(first)) ? true : t.request;
  if (!shown || results || PLUMBING.test(first)) return { ...t, open, request, lines: n };
  // a real prompt under the same parent as an earlier one: Esc took that earlier one back before any
  // answer (measured: its line stays, the next prompt becomes its sibling — the branch is dead)
  const parent = typeof d.parentUuid === "string" ? d.parentUuid : null;
  const sibling = parent !== null ? t.prompts.get(parent) : undefined;
  const prompts = parent !== null ? new Map(t.prompts).set(parent, n) : t.prompts;
  return { open, request, prompts, lines: n,
    withdrawn: sibling !== undefined && sibling !== n ? [...t.withdrawn, sibling] : t.withdrawn };
}

const QUEUE_TEXT_MAX = 20_000;
export function queueOf(t: TailState): QueuedPrompt[] {
  return t.open.filter((q) => q.text.trim() !== "" && !q.text.startsWith("<system-reminder") && !q.text.startsWith("<task-notification"))
    .map((q) => ({ text: q.text.length > QUEUE_TEXT_MAX ? `${q.text.slice(0, QUEUE_TEXT_MAX)} … [+${q.text.length - QUEUE_TEXT_MAX} chars]` : q.text, at: q.at }));
}
// the whole file at once (the transcript route's `queued`, until S2 reads it from here). Every poll
// pays for it, so it parses only what the queue needs: its own lines, and user lines while something waits
export function sessionQueue(lines: readonly string[]): QueuedPrompt[] {
  let t = emptyTail();
  lines.forEach((l, i) => {
    if (l.includes('"queue-operation"') || (t.open.length && l.includes('"user"'))) t = foldLine(t, l, i + 1);
  });
  return queueOf(t);
}

export function combine(frame: FrameRead, tail: TailState, at: number): LiveState {
  const turn: Turn = frame.shape === "spinner" ? "working"
    : frame.shape === "dialog" ? "asking"
    : frame.shape === "interrupted" ? "interrupted"
    : frame.shape === "done" ? "ready"
    : frame.shape === "text" ? (tail.request ? "working" : "ready")
    : "unknown";
  return { turn, detail: turn === "working" ? frame.detail : null, queued: queueOf(tail), composer: frame.composer,
    withdrawn: tail.withdrawn, at };
}

// --- the reader --------------------------------------------------------------------------------
export interface LiveDeps {
  // `capture-pane -p -e` of the slot's pane; null = no pane
  capture(slot: number): Promise<string | null>;
  // the slot's live transcript file; null = none
  transcript(slot: number): string | null;
  // changes whenever the pane painted (the stream offset): an unchanged mark needs no new capture
  paintMark(slot: number): number;
  // the occupant; a new one starts the slot's cache over
  identity(slot: number): string | null;
}
interface Seat { identity: string | null; file: string | null; offset: number; carry: string; tail: TailState;
  frame: FrameRead | null; frameMark: number; frameAt: number }
// a capture costs ~3.8 ms CPU (tmux client 3.25, server 0.18, Bun 0.33 — measured 2026-10-13, 400
// calls); MIN_GAP_MS bounds it to ~5/s per watched pane however many tabs ask, and an unpainted
// pane is not captured again before IDLE_RECHECK_MS (a dialog that paints once, then waits)
const MIN_GAP_MS = 200;
const IDLE_RECHECK_MS = 5_000;
const NL = "\n";

export function createLiveReader(deps: LiveDeps, now: () => number = Date.now) {
  const seats = new Map<number, Seat>();
  const fresh = (identity: string | null): Seat => ({ identity, file: null, offset: 0, carry: "", tail: emptyTail(),
    frame: null, frameMark: -1, frameAt: 0 });

  async function readTail(seat: Seat, file: string | null): Promise<void> {
    if (file !== seat.file) Object.assign(seat, { file, offset: 0, carry: "", tail: emptyTail() });
    if (!file) return;
    let size: number;
    try { size = (await stat(file)).size; } catch { return; }
    if (size < seat.offset) Object.assign(seat, { offset: 0, carry: "", tail: emptyTail() });
    if (size === seat.offset) return;
    const fh = await open(file, "r");
    try {
      const buf = Buffer.alloc(size - seat.offset);
      const { bytesRead } = await fh.read(buf, 0, buf.length, seat.offset);
      seat.offset += bytesRead;
      const parts = (seat.carry + buf.subarray(0, bytesRead).toString("utf8")).split(NL);
      seat.carry = parts.pop() ?? ""; // a line Claude Code has not finished writing
      let t = seat.tail;
      for (const raw of parts) if (raw.trim() !== "") t = foldLine(t, raw, t.lines + 1);
      seat.tail = t;
    } finally { await fh.close(); }
  }

  return {
    async read(slot: number): Promise<LiveState> {
      const identity = deps.identity(slot);
      let seat = seats.get(slot);
      if (!seat || seat.identity !== identity) { seat = fresh(identity); seats.set(slot, seat); }
      await readTail(seat, deps.transcript(slot));
      const t = now(), mark = deps.paintMark(slot);
      const stale = seat.frame === null || (mark !== seat.frameMark && t - seat.frameAt >= MIN_GAP_MS)
        || t - seat.frameAt >= IDLE_RECHECK_MS;
      if (stale) {
        const frame = await deps.capture(slot);
        seat.frame = frame === null ? { shape: "unknown", detail: null, composer: null } : readFrame(frame);
        seat.frameMark = mark;
        seat.frameAt = t;
      }
      return combine(seat.frame!, seat.tail, t);
    },
    forget(slot: number): void { seats.delete(slot); },
  };
}
