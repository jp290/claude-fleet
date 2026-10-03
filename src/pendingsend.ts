// The chat view shows a sent prompt the moment Enter is pressed, as a local "pending" bubble, and
// retires it when the transcript poll brings the turn itself (docs/messungen/2026-09-22-chat-absenden-zeitleiste.md).
// Imported by src/client.ts and by the e2e suite, which runs it for real (no DOM harness there).
// Whitespace is the one thing allowed to differ: the transcript keeps the text, the renderer and
// the TUI may re-wrap it. Nothing else — a pending bubble that retires on a DIFFERENT turn would
// hide a send that never arrived.
import { deliveryParts } from "./delivery-format";

const norm = (t: string): string => t.replace(/\s+/g, " ").trim();
const DELIVERY_HEADER_PREFIX = "[fleet-zustellung · ";
// Head and body of a typed Fleet delivery. `header` is what stands between the prefix and the closing
// bracket: the short owner form „[Zitat entfernt]“, or the long form of every other path
// („[Zitat entfernt]“). Text with no head, or a head that never closes,
// has header null and is its own body.
export function splitDeliveryHeader(entry: string): { header: string | null; body: string } {
  if (!entry.startsWith(DELIVERY_HEADER_PREFIX)) return { header: null, body: entry };
  const end = entry.indexOf("] ", DELIVERY_HEADER_PREFIX.length);
  if (end < 0) return { header: null, body: entry };
  return { header: entry.slice(DELIVERY_HEADER_PREFIX.length, end), body: entry.slice(end + 2) };
}
// A bundle (src/delivery-format.ts) retires the bubble through its OWNER parts only: a Fleet part that
// happens to repeat the sent text is not the send arriving.
export function pendingSettledBy(pending: string, entry: string): boolean {
  const p = norm(pending);
  if (p === "") return false;
  const body = splitDeliveryHeader(entry).body;
  return p === norm(body) || (deliveryParts(body) ?? []).some((part) => part.owner && norm(part.text) === p);
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
