// The chat view shows a sent prompt the moment Enter is pressed, as a local "pending" bubble, and
// retires it when the transcript poll brings the turn itself (docs/messungen/2026-09-22-chat-absenden-zeitleiste.md).
// Imported by src/client.ts and by the e2e suite, which runs it for real (no DOM harness there).
// Whitespace is the one thing allowed to differ: the transcript keeps the text, the renderer and
// the TUI may re-wrap it. Nothing else — a pending bubble that retires on a DIFFERENT turn would
// hide a send that never arrived.
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
export function pendingSettledBy(pending: string, entry: string): boolean {
  const p = norm(pending);
  return p !== "" && p === norm(splitDeliveryHeader(entry).body);
}
