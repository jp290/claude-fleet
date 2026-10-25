// ESC AND ↑ FROM THE CHAT VIEW, AS IN THE TERMINAL (Neuaufbau K10 S3, docs/neuaufbau/befunde/08-chat-ansicht.md).
// A leaf like live-state.ts: server.ts hands in the pane. Measured 2026-10-13 on Claude Code 2.1.296 (Haiku,
// tmux, Fleet's own delivery: the head typed, the body pasted):
// - Esc before any answer puts the prompt back into Claude's input field; its transcript line stays.
// - Esc while Claude answers interrupts; the field stays empty, and a waiting prompt starts at once.
// Owner, 13.10.: „[Zitat entfernt]“
//  — so after an interrupt the prompt comes back from the transcript, not from the field.
// - ↑ in the empty field takes EVERY waiting prompt back (one popAll line each), joined by "\n".
// - The field shows a long paste as one "[Pasted text #N +M lines]" token that ONE BSpace erases; the
//   transcript holds that paste as "\n\n<pasted_content id=…>…</pasted_content id=…>". A short paste
//   stands as plain text in both.
// - ctrl+x ctrl+s sends the waiting prompts now and interrupts the turn.
// So what the field holds after the key is known from the transcript, and it is cleared with exactly that
// many BSpaces — never ctrl+u or a broad clear. A field holding anything else is left as it is.
import { composerHoldsExactly } from "../composer";
import { OWNER_HEADER } from "../src/delivery-format";
import { splitDeliveryHeader } from "../src/pendingsend";
import type { Turn } from "./live-state";

export type RecallKind = "esc" | "queued" | "send-now";
export const RECALL_KINDS: readonly RecallKind[] = ["esc", "queued", "send-now"];
export type RecallResult =
  // the prompts are back with the owner; `lines` are transcript lines Esc took back before any answer.
  // `interrupted`: Esc stopped an answer — its prompt stays in the conversation and comes back as text
  | { result: "recalled"; texts: string[]; lines: number[]; interrupted: boolean }
  // Esc stopped a turn the owner did not start (a Fleet delivery): nothing comes back
  | { result: "interrupted" }
  | { result: "sent-now" }
  // nothing was pressed
  | { result: "refused"; why: string }
  // the key was pressed, but the field holds something other than what it took back: left untouched.
  // `texts`: prompts already taken out of the queue before that — they are the owner's now
  | { result: "kept"; why: string; field: string | null; texts?: string[] };

const PASTE_IN_TRANSCRIPT = /\n\n<pasted_content id="([^"]+)">\n?[\s\S]*?\n?<\/pasted_content id="\1">/g;
const PASTE_IN_FIELD = /\[Pasted text #\d+(?: \+\d+ lines)?\]/g;
// one code point for one token: the field erases a folded paste with one BSpace
const TOKEN = "\uE000";
const TRAILING_AFTER_TOKEN = new RegExp(`${TOKEN}\n$`);

// what Claude's field shows for these prompts, a folded paste as TOKEN. A prompt that ENDS in a paste is stored with one
// more \n after the closing tag, which the field does not show (measured 14.10. on 2.1.296, :8982 — Esc came back
// "kept" for exactly that byte, Mangel 62)
export function fieldOf(prompts: readonly string[]): string {
  return prompts.map((p) => p.replace(PASTE_IN_TRANSCRIPT, TOKEN).replace(TRAILING_AFTER_TOKEN, TOKEN)).join("\n");
}
export function fieldHolds(rows: readonly string[], prompts: readonly string[]): boolean {
  return prompts.length > 0 && composerHoldsExactly(rows.map((r) => r.replace(PASTE_IN_FIELD, TOKEN)), fieldOf(prompts));
}
// A DELIVERED PROMPT BACK IN CLAUDE'S FIELD (Mangel 62): Esc before any answer put it there and its transcript line
// stays — the session got it once. A send that finds it must not submit it as a rest of its own (server.ts#sendText)
export function deliveredInField(rows: readonly string[] | null, last: { text: string } | null): boolean {
  return rows !== null && last !== null && fieldHolds(rows, [last.text]);
}
export function eraseCount(prompts: readonly string[]): number {
  return [...fieldOf(prompts)].length;
}
// the owner's own text: typed in the terminal, or sent through the owner door — never a Fleet bundle or
// event, a cross-session message or Claude Code's plumbing, which the owner did not write and must not
// lose by taking it back
export function ownerPrompt(text: string): boolean {
  if (text.trim() === "" || text.startsWith("<")) return false;
  const { header } = splitDeliveryHeader(text);
  return header === null ? !text.startsWith("[fleet-") : OWNER_HEADER.test(header);
}

export interface RecallPane {
  // the live turn, Claude Code's queue (whole texts, oldest first) and the newest real prompt
  state(): Promise<{ turn: Turn; queued: string[]; last: { n: number; text: string } | null }>;
  // the input field's rows, exact; null = not readable
  rows(): Promise<string[] | null>;
  press(...keys: string[]): Promise<boolean>;
  erase(count: number): Promise<boolean>;
  sleep(ms: number): Promise<void>;
}
export interface RecallTiming { settleMs: number; eraseMs: number; stepMs: number }
// Esc restored the field within 0.8 s in every measured run. The TUI works off a burst of BSpaces key by
// key: a read right after the burst still showed the whole text (measured 13.10., 80 BSpaces), so the
// erase waits for the empty field like rollbackOwnComposerPayload (its acceptance window, 3 s live)
export const RECALL_TIMING: RecallTiming = { settleMs: 1500, eraseMs: 3000, stepMs: 100 };

const text = (rows: readonly string[] | null): string | null => (rows === null ? null : rows.join("\n"));
const empty = (rows: readonly string[] | null): boolean => rows !== null && rows.join("") === "";

async function until(pane: RecallPane, t: RecallTiming, done: (rows: string[] | null) => boolean, ms = t.settleMs): Promise<string[] | null> {
  let rows = await pane.rows();
  for (let waited = 0; !done(rows) && waited < ms; waited += t.stepMs) {
    await pane.sleep(t.stepMs);
    rows = await pane.rows();
  }
  return rows;
}

async function takeBack(pane: RecallPane, t: RecallTiming, prompts: readonly string[]): Promise<boolean> {
  if (!(await pane.erase(eraseCount(prompts)))) return false;
  return empty(await until(pane, t, empty, t.eraseMs));
}

// ↑ and exactly the field it filled. null = done; otherwise why the field was left as it is
async function pullQueue(pane: RecallPane, t: RecallTiming, queued: readonly string[]): Promise<RecallResult | null> {
  if (!(await pane.press("Up"))) return { result: "refused", why: "the key did not reach the pane" };
  const rows = await until(pane, t, (r) => r !== null && fieldHolds(r, queued));
  if (rows !== null && fieldHolds(rows, queued))
    return (await takeBack(pane, t, queued)) ? null : { result: "kept", why: "the field did not empty", field: text(await pane.rows()) };
  // the turn ended first and Claude took the queue: ↑ then fetched the newest history entry. ↓ walks
  // back to the empty draft, as in the terminal
  if (rows !== null && !empty(rows)) {
    await pane.press("Down");
    return { result: "kept", why: "the queue was taken before ↑ reached it", field: text(await until(pane, t, empty)) };
  }
  return { result: "kept", why: "the queue was taken before ↑ reached it", field: text(rows) };
}

export async function recall(kind: RecallKind, pane: RecallPane, t: RecallTiming = RECALL_TIMING): Promise<RecallResult> {
  const before = await pane.rows();
  if (before === null) return { result: "refused", why: "Claude's input field is not readable" };
  if (!empty(before)) return { result: "refused", why: "Claude's input field holds text" };
  const st = await pane.state();

  if (kind === "send-now") {
    if (!st.queued.length) return { result: "refused", why: "nothing waits in the queue" };
    return (await pane.press("C-x", "C-s")) ? { result: "sent-now" } : { result: "refused", why: "the key did not reach the pane" };
  }

  if (kind === "queued") {
    if (!st.queued.length) return { result: "refused", why: "nothing waits in the queue" };
    if (!st.queued.every(ownerPrompt)) return { result: "refused", why: "a Fleet delivery waits in the queue" };
    return (await pullQueue(pane, t, st.queued)) ?? { result: "recalled", texts: st.queued, lines: [], interrupted: false };
  }

  // Esc. Claude Code starts a waiting prompt the moment Esc interrupts (measured); the owner's Esc stops
  // everything (Bauleitung 13.10., way B), so the queue comes back first, then the turn stops
  if (st.turn !== "working") return { result: "refused", why: "the session is not working" };
  if (!st.queued.every(ownerPrompt)) return { result: "refused", why: "a Fleet delivery waits in the queue — Esc would start it" };
  if (st.queued.length) {
    const left = await pullQueue(pane, t, st.queued);
    if (left) return left;
  }
  const last = st.last;
  if (!(await pane.press("Escape"))) return { result: "refused", why: "the key did not reach the pane" };
  const rows = await until(pane, t, (r) => r !== null && !empty(r) && (last === null || fieldHolds(r, [last.text])));
  const back = last !== null && ownerPrompt(last.text) ? [last.text] : [];
  if (empty(rows)) return back.length || st.queued.length
    ? { result: "recalled", texts: [...back, ...st.queued], lines: [], interrupted: true } : { result: "interrupted" };
  const pulled = st.queued.length ? { texts: st.queued } : {};
  if (last === null || rows === null || !fieldHolds(rows, [last.text]))
    return { result: "kept", why: "the field holds text Esc did not take back", field: text(rows), ...pulled };
  if (!back.length) return { result: "kept", why: "the prompt Esc took back is a Fleet delivery", field: text(rows), ...pulled };
  return (await takeBack(pane, t, back)) ? { result: "recalled", texts: [...back, ...st.queued], lines: [last.n], interrupted: false }
    : { result: "kept", why: "the field did not empty", field: text(await pane.rows()), ...pulled };
}
