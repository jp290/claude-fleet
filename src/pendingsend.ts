// The chat view shows a sent prompt the moment Enter is pressed, as a local "pending" bubble, and
// retires it when the transcript poll brings the turn itself (docs/messungen/2026-09-22-chat-absenden-zeitleiste.md).
// Imported by src/client.ts and by the e2e suite, which runs it for real (no DOM harness there).
// Whitespace is the one thing allowed to differ: the transcript keeps the text, the renderer and
// the TUI may re-wrap it. Nothing else — a pending bubble that retires on a DIFFERENT turn would
// hide a send that never arrived.
import { deliveryParts } from "./delivery-format";

const norm = (t: string): string => t.replace(/\s+/g, " ").trim();
const DELIVERY_HEADER_PREFIX = "[fleet-zustellung · ";
// Claude Code (2.1.278) stores a pasted prompt — every composer send is one — wrapped as
// <pasted_content id="x">…</pasted_content id="x">. The bubble shows what you wrote, so only a
// wrapper whose closing id matches its opening one is taken off; the text inside stays verbatim.
const PASTED_RE = /<pasted_content id="([^"]+)">\n?([\s\S]*?)\n?<\/pasted_content id="\1">/g;
export const unwrapPasted = (text: string): string => text.replace(PASTED_RE, "$2");
// Head and body of a typed Fleet delivery. `header` is what stands between the prefix and the closing
// bracket: the short owner form „[Zitat entfernt]“, or the long form of every other path
// („[Zitat entfernt]“). Text with no head, or a head that never closes,
// has header null and is its own body.
// Claude Code 2.1.288 stores a head followed by a paste as `<head>] \n\n<pasted_content …>`: the blank
// line between the two is its own, not the sender's, and it goes with the head. Without that cut a
// bundle body began "\n\n[fleet-buendel 1/…", deliveryParts never saw its marks, and every bundled owner
// send stood as "wartet" for good (measured 2026-10-04: 102 of 102 bundles in the day's transcripts).
export function splitDeliveryHeader(entry: string): { header: string | null; body: string } {
  if (!entry.startsWith(DELIVERY_HEADER_PREFIX)) return { header: null, body: entry };
  const end = entry.indexOf("] ", DELIVERY_HEADER_PREFIX.length);
  if (end < 0) return { header: null, body: entry };
  return { header: entry.slice(DELIVERY_HEADER_PREFIX.length, end), body: entry.slice(end + 2).replace(/^\s*\n/, "") };
}
// A slash command never reaches the transcript as typed: Claude Code records it as
// `<command-name>/effort</command-name> <command-message>…</command-message> <command-args>xhigh</command-args>`
// (2.1.288, every command line of 2026-10-01..04 in this shape). This is the text that was typed, or null.
const COMMAND_RECORD = /^<command-name>(\/[^<\s]+)<\/command-name>\s*<command-message>[^<]*<\/command-message>\s*<command-args>([^<]*)<\/command-args>$/;
function typedCommand(entry: string): string | null {
  const m = COMMAND_RECORD.exec(entry.trim());
  return m ? `${m[1]} ${m[2]}` : null;
}
// A bundle (src/delivery-format.ts) retires the bubble through its OWNER parts only: a Fleet part that
// happens to repeat the sent text is not the send arriving.
export function pendingSettledBy(pending: string, entry: string): boolean {
  const p = norm(pending);
  if (p === "") return false;
  const body = splitDeliveryHeader(entry).body;
  const command = typedCommand(entry);
  return p === norm(body) || (command !== null && p === norm(command))
    || (deliveryParts(body) ?? []).some((part) => part.owner && norm(part.text) === p);
}

// Esc mid-turn: Claude Code writes one of these as a user text block of its own (measured,
// docs/messungen/2026-10-03-terminal-vs-chat-warten.md §6). The server folds such a turn
// (server.ts#viewEntry, meta) and the chat view shows it as a quiet line, never as the owner's bubble.
const INTERRUPT_MARKS: ReadonlySet<string> = new Set(["[Request interrupted by user]", "[Request interrupted by user for tool use]"]);
export function isInterruptMark(text: string): boolean {
  return INTERRUPT_MARKS.has(text);
}

export function sendFailureMessage(status: number, body: unknown): string {
  const record = (value: unknown): Record<string, unknown> | null =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown> : null;
  const response = record(body);
  const receipt = record(response?.receipt);
  const error = typeof response?.error === "string" ? response.error : "";
  if (receipt?.delivery === "uncertain") {
    return receipt.acceptance === "not-observed"
      ? "prompt acceptance not observed — check the pane; do not paste again"
      : "send outcome uncertain — check the pane; do not paste again";
  }
  if (status === 409 && record(response?.occupant)
    && /^slot \d+ is held by a different occupant /.test(error))
    return "send refused — slot occupant changed; nothing was typed";
  if (receipt?.delivery === "refused") {
    if (/^composer occupied \(\d+ chars\) — nothing typed(?:;|$)/.test(error))
      return "send refused — the composer already holds a draft; nothing was typed";
    if (/^no agent alive in the pane \(agent=(?:no-agent|no-pane)\) — nothing typed$/.test(error))
      return "send refused — no live agent in the pane; nothing was typed";
    if (/^slot (?:occupant changed|changed|pane unavailable or changed)/.test(error))
      return "send refused — slot occupant changed or unavailable; nothing was typed";
    const gate = /^gate=(kill-switch|harness|not-alive|no-agent|no-pane|blocked-screen|quiet-hours|busy)(?=:| — nothing typed$)/.exec(error)?.[1];
    if (gate) return `send refused — delivery gate=${gate}; nothing was typed`;
    return "send refused — nothing was typed; reason unavailable";
  }
  return `send rejected (HTTP ${status}) — delivery not confirmed; text kept`;
}
