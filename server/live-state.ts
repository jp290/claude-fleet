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
// The chat's transcript route reads from the same seat (K10 S2): the bytes of the lines it asks for,
// and what the whole file says about them, folded as the file grows.
import { open, stat } from "node:fs/promises";
import { composerBuffer } from "../composer";
import { isInterruptMark } from "../src/pendingsend";
import { ASK_TOOL } from "./conversation-read";
import { readCommandLine, type PendingCommand } from "./model-switch";

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
  // the newest real prompt as Claude Code stored it (a plain-text line only): what Esc puts back
  last: { n: number; text: string } | null;
  lines: number;
}
export const emptyTail = (): TailState => ({ open: [], request: false, prompts: new Map(), withdrawn: [], last: null, lines: 0 });

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
  return { open, request, prompts, lines: n, last: plain ? { n, text: first } : null,
    withdrawn: sibling !== undefined && sibling !== n && !t.withdrawn.includes(sibling) ? [...t.withdrawn, sibling] : t.withdrawn };
}

const QUEUE_TEXT_MAX = 20_000;
export function queueOf(t: TailState): QueuedPrompt[] {
  return t.open.filter((q) => q.text.trim() !== "" && !q.text.startsWith("<system-reminder") && !q.text.startsWith("<task-notification"))
    .map((q) => ({ text: q.text.length > QUEUE_TEXT_MAX ? `${q.text.slice(0, QUEUE_TEXT_MAX)} … [+${q.text.length - QUEUE_TEXT_MAX} chars]` : q.text, at: q.at }));
}

// --- what the transcript route needs from the WHOLE file (K10 S2) ------------------------------
// server.ts#transcriptPayload hands out the lines from `after` on, but three facts about them can sit
// anywhere in the file: a queued prompt's attachment may stand before `after` and the same prompt's own
// user line after it (it shows once, at the attachment), an AskUserQuestion call before `after` and its
// answer after it, and the model is the newest assistant line's. They grow with the file, line by line.
export interface ViewFacts {
  // source_uuid of every queued_command prompt attachment
  queued: ReadonlySet<string>;
  // AskUserQuestion calls by tool_use id → their input (a sidechain's are not this conversation's), and
  // the ids a result answers
  askCalls: ReadonlyMap<string, unknown>;
  askAnswered: ReadonlySet<string>;
  // the newest assistant line's model and the effort it names. Claude writes message.model on every
  // assistant line; "<synthetic>" marks a locally made error turn, not a model. The composer shows it where
  // the slot record names no model — a hand-started or adopted session the fleet default would mislabel
  // (seventeenth cut: slot 5 ran Haiku 4.5, the switch said Opus 5). `effort` rides on every assistant line
  // (Claude Code 2.1.x). A /model or /effort with an argument shows at once: Claude Code writes the command and its
  // output (server/model-switch.ts#readCommandLine, two shapes) — „Set model to …“/„Set effort level to …“ when it
  // switched; „Kept model as …“ and a pick from the menu (no args) wait for the next request (Mangel 53)
  model: string | null;
  effort: string | null;
  // a command line whose output has not been read yet (shape b carries the args only there)
  command: PendingCommand | null;
}
export function viewFolder(from?: ViewFacts) {
  const queued = new Set(from?.queued), askCalls = new Map(from?.askCalls), askAnswered = new Set(from?.askAnswered);
  let model = from?.model ?? null, effort = from?.effort ?? null, command = from?.command ?? null;
  return {
    // only lines that name what a fact needs are parsed; a torn line is skipped (the render loop reports it)
    add(raw: string): void {
      if (raw.includes("queued_command")) {
        try {
          const d = JSON.parse(raw) as { type?: unknown; attachment?: { type?: unknown; commandMode?: unknown; source_uuid?: unknown } };
          if (d.type === "attachment" && d.attachment?.type === "queued_command" && d.attachment.commandMode === "prompt"
            && typeof d.attachment.source_uuid === "string") queued.add(d.attachment.source_uuid);
        } catch { /* torn line */ }
      }
      const callLine = raw.includes(`"${ASK_TOOL}"`);
      const resultLine = askCalls.size > 0 && raw.includes('"tool_result"') && [...askCalls.keys()].some((id) => raw.includes(id));
      if (callLine || resultLine) {
        try {
          const d = JSON.parse(raw) as { type?: unknown; isSidechain?: unknown; message?: { content?: unknown } };
          if (d.isSidechain !== true && Array.isArray(d.message?.content)) {
            for (const b of d.message.content as { type?: unknown; name?: unknown; id?: unknown; input?: unknown; tool_use_id?: unknown }[]) {
              if (d.type === "assistant" && b?.type === "tool_use" && b.name === ASK_TOOL && typeof b.id === "string" && b.id) askCalls.set(b.id, b.input);
              else if (d.type === "user" && b?.type === "tool_result" && typeof b.tool_use_id === "string" && askCalls.has(b.tool_use_id))
                askAnswered.add(b.tool_use_id);
            }
          }
        } catch { /* torn line */ }
      }
      if (raw.includes('"assistant"') && raw.includes('"model"')) {
        try {
          const d = JSON.parse(raw) as { type?: unknown; effort?: unknown; message?: { model?: unknown } };
          const m = d.message?.model;
          if (d.type === "assistant" && typeof m === "string" && m && m !== "<synthetic>") {
            model = m;
            effort = typeof d.effort === "string" && d.effort ? d.effort : null;
          }
        } catch { /* torn line */ }
      }
      const ran = readCommandLine(raw, command);
      command = ran.pending;
      if (ran.run?.args) {
        if (ran.run.command === "model" && ran.run.out.startsWith("Set model to ")) model = ran.run.args;
        else if (ran.run.command === "effort" && ran.run.out.startsWith("Set effort level to ")) effort = ran.run.args;
      }
    },
    facts(): ViewFacts { return { queued, askCalls, askAnswered, model, effort, command }; },
  };
}
// what a whole-file split would hand the route from line `after` on: the complete lines, and last a line
// Claude Code is still writing (it fails to parse and caps `total` there, or it parses and counts)
export interface TranscriptLines { lines: string[]; total: number; facts: ViewFacts }

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
// `offset` = bytes read; `carry` = the bytes after the last newline (a line Claude Code is still writing);
// `starts[k]` = where non-empty line k+1 begins, so a read from line `after` reads only its own bytes.
// Reads of one seat run one after another (`chain`): the live poll, the transcript route and the push
// tick share it, and two reads at once would fold the same bytes twice.
interface Seat { identity: string | null; file: string | null; offset: number; carry: Buffer; tail: TailState;
  starts: number[]; view: ReturnType<typeof viewFolder>; chain: Promise<unknown>;
  frame: FrameRead | null; frameMark: number; frameAt: number }
// a capture costs ~3.8 ms CPU (tmux client 3.25, server 0.18, Bun 0.33 — measured 2026-10-13, 400
// calls); MIN_GAP_MS bounds it to ~5/s per watched pane however many tabs ask, and an unpainted
// pane is not captured again before IDLE_RECHECK_MS (a dialog that paints once, then waits)
const MIN_GAP_MS = 200;
const IDLE_RECHECK_MS = 5_000;
const NL = "\n", NL_BYTE = 0x0a;

const freshSeat = (identity: string | null): Seat => ({ identity, file: null, offset: 0, carry: Buffer.alloc(0), tail: emptyTail(),
  starts: [], view: viewFolder(), chain: Promise.resolve(), frame: null, frameMark: -1, frameAt: 0 });
const restart = (seat: Seat, file: string | null): void => {
  Object.assign(seat, { file, offset: 0, carry: Buffer.alloc(0), tail: emptyTail(), starts: [], view: viewFolder() });
};

// `strict`: a file that cannot be read throws (the transcript route answers it, as its whole-file read
// did); otherwise the seat just stays where it was (the live poll and the push tick try again)
async function readTail(seat: Seat, file: string | null, strict: boolean): Promise<void> {
  if (file !== seat.file) restart(seat, file);
  if (!file) return;
  let size: number;
  try { size = (await stat(file)).size; } catch (e) { if (strict) throw e; return; }
  if (size < seat.offset) restart(seat, file);
  if (size === seat.offset) return;
  const fh = await open(file, "r");
  try {
    const buf = Buffer.alloc(size - seat.offset);
    const { bytesRead } = await fh.read(buf, 0, buf.length, seat.offset);
    // split on the newline BYTE: it never occurs inside a UTF-8 sequence, so a read that ends inside a
    // character leaves it whole in the carry
    const base = seat.offset - seat.carry.length;
    const bytes = Buffer.concat([seat.carry, buf.subarray(0, bytesRead)]);
    seat.offset += bytesRead;
    let t = seat.tail, from = 0;
    for (let nl = bytes.indexOf(NL_BYTE); nl !== -1; from = nl + 1, nl = bytes.indexOf(NL_BYTE, from)) {
      const raw = bytes.toString("utf8", from, nl);
      if (raw.trim() === "") continue;
      seat.starts.push(base + from);
      t = foldLine(t, raw, t.lines + 1);
      seat.view.add(raw);
    }
    seat.tail = t;
    seat.carry = Buffer.from(bytes.subarray(from));
  } finally { await fh.close(); }
}
const inTurn = <T>(seat: Seat, job: () => Promise<T>): Promise<T> => {
  const run = seat.chain.then(job, job);
  seat.chain = run.catch(() => {});
  return run;
};
// the lines from `after` on, out of the bytes the seat has read: the complete ones from the file, the
// line still being written from the carry. The facts are a copy, the line being written folded into it
async function linesFrom(seat: Seat, file: string, after: number): Promise<TranscriptLines> {
  const n = seat.starts.length, from = Math.max(0, after | 0);
  const lines: string[] = [];
  if (from < n) {
    const end = seat.offset - seat.carry.length;
    const fh = await open(file, "r");
    try {
      const buf = Buffer.alloc(end - seat.starts[from]!);
      const { bytesRead } = await fh.read(buf, 0, buf.length, seat.starts[from]!);
      for (const raw of buf.subarray(0, bytesRead).toString("utf8").split(NL)) if (raw.trim() !== "") lines.push(raw);
    } finally { await fh.close(); }
  }
  const writing = seat.carry.toString("utf8");
  const facts = viewFolder(seat.view.facts());
  if (writing.trim() === "") return { lines, total: n, facts: facts.facts() };
  if (from <= n) lines.push(writing);
  facts.add(writing);
  return { lines, total: n + 1, facts: facts.facts() };
}
// a file no seat holds (a past session's, server.ts#pastTranscript): read once, whole, the same way
export async function readTranscript(file: string, after: number): Promise<TranscriptLines> {
  const seat = freshSeat(null);
  await readTail(seat, file, true);
  return linesFrom(seat, file, after);
}

export function createLiveReader(deps: LiveDeps, now: () => number = Date.now) {
  const seats = new Map<number, Seat>();
  const seatOf = (slot: number): Seat => {
    const identity = deps.identity(slot);
    let seat = seats.get(slot);
    if (!seat || seat.identity !== identity) { seat = freshSeat(identity); seats.set(slot, seat); }
    return seat;
  };

  return {
    async read(slot: number): Promise<LiveState> {
      const seat = seatOf(slot);
      await inTurn(seat, () => readTail(seat, deps.transcript(slot), false));
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
    // the transcript route (server.ts#transcriptPayload): the slot's file from line `after` on, reading only
    // what was appended since the seat's last read and the bytes of the lines asked for
    lines(slot: number, file: string, after: number): Promise<TranscriptLines> {
      const seat = seatOf(slot);
      return inTurn(seat, async () => { await readTail(seat, file, true); return linesFrom(seat, file, after); });
    },
    // complete lines in the slot's transcript now; null = no transcript (server/transcript-push.ts). A line
    // still being written is not counted: when it completes, the count moves and the chat is told
    count(slot: number): Promise<number | null> {
      const seat = seatOf(slot);
      return inTurn(seat, async () => { await readTail(seat, deps.transcript(slot), false); return seat.file ? seat.starts.length : null; });
    },
    // the tail as of the last read (server/recall.ts reads the whole queue and the newest prompt from it)
    tailOf(slot: number): TailState | null { return seats.get(slot)?.tail ?? null; },
    // a prompt the chat took back with Esc (server/recall.ts): withdrawn now, not only once a sibling follows
    withdraw(slot: number, n: number): void {
      const seat = seats.get(slot);
      if (seat && !seat.tail.withdrawn.includes(n)) seat.tail = { ...seat.tail, withdrawn: [...seat.tail.withdrawn, n] };
    },
    forget(slot: number): void { seats.delete(slot); },
  };
}
