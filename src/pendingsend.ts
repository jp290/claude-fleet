// The chat view shows a sent prompt the moment Enter is pressed, as a local "pending" bubble, and
// retires it when the transcript poll brings the turn itself (docs/messungen/2026-09-22-chat-absenden-zeitleiste.md).
// Imported by src/client.ts and by the e2e suite, which runs it for real (no DOM harness there).
// Whitespace is the one thing allowed to differ: the transcript keeps the text, the renderer and
// the TUI may re-wrap it. Nothing else — a pending bubble that retires on a DIFFERENT turn would
// hide a send that never arrived.
const norm = (t: string): string => t.replace(/\s+/g, " ").trim();
const DELIVERY_HEADER_PREFIX = "[fleet-zustellung · ";
const withoutDeliveryHeader = (entry: string): string => {
  if (!entry.startsWith(DELIVERY_HEADER_PREFIX)) return entry;
  const end = entry.indexOf("] ", DELIVERY_HEADER_PREFIX.length);
  return end < 0 ? entry : entry.slice(end + 2);
};
export function pendingSettledBy(pending: string, entry: string): boolean {
  const p = norm(pending);
  return p !== "" && p === norm(withoutDeliveryHeader(entry));
}
