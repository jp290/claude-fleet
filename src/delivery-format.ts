// THE BUNDLE MARKS, ONE SOURCE FOR WRITER AND READER. server.ts#bundleText and
// server.ts#fleetEventBundleMessage type these marks into a pane; the chat view reads them back
// out of the transcript (src/pendingsend.ts#pendingSettledBy, Pane#appendEntry in src/client.ts).
// Both sides import this module, so the reader accepts exactly what the writer produces — before
// 2026-10-03 the reader knew one delivery head only, and an owner text that rode a bundle never
// retired its "wartet" bubble (owner screenshot 2026-10-03 08:55).

// one entry of a delivery bundle: its path, the sentence its mark carries (null = no sentence,
// the receiver is not a headed harness or the path has none) and its text, untouched
export interface BundleEntry { path: string; meaning: string | null; text: string }
export interface BundleEvent { id: string; text: string }
export const BUNDLE_END = "\n[fleet] Ende des Buendels.";

// One entry is no bundle: it is typed as itself. Two or more each get a mark of their own.
export function deliveryBundleText(entries: readonly BundleEntry[]): string {
  if (entries.length === 1) return entries[0]!.text;
  return entries.map((entry, i) => {
    const meaning = entry.meaning === null ? "" : ` · ${entry.meaning}`;
    return `[fleet-buendel ${i + 1}/${entries.length} · path=${entry.path}${meaning}]\n${entry.text}`;
  }).join("\n\n");
}
export function fleetEventBundleText(events: readonly BundleEvent[]): string {
  if (events.length === 1) return events[0]!.text;
  return events.map((event, i) => `[fleet-ereignis ${i + 1}/${events.length} · ${event.id}]\n${event.text}`)
    .join("\n\n") + BUNDLE_END;
}

// THE READER. A part of a bundle as the chat view shows it: an owner part is YOUR message (a
// bubble), every other part is Fleet speaking (a quiet line). `mark` is what stood inside the
// part's brackets — provenance for the meta row and the tooltip, never bubble text.
export interface DeliveryPart { owner: boolean; mark: string | null; text: string }

// The marks in order, 1/n … n/n, each `[<word> i/n · …]\n` and each after the first preceded by the
// "\n\n" the writer joins with. Anything else — a count below 2, a mark out of order, a missing
// one — is no bundle, and the text stays whole. A part's text may itself hold blank lines: the
// next mark, not a blank line, ends it.
function splitMarked(text: string, word: "fleet-buendel" | "fleet-ereignis"): { mark: string; text: string }[] | null {
  const n = Number(/^\[fleet-(?:buendel|ereignis) 1\/(\d{1,4}) · /.exec(text)?.[1] ?? 0);
  if (n < 2 || !text.startsWith(`[${word} 1/`)) return null;
  const parts: { mark: string; text: string }[] = [];
  let at = 0;
  for (let i = 1; i <= n; i++) {
    const open = `[${word} ${i}/${n} · `;
    if (!text.startsWith(open, at)) return null;
    const close = text.indexOf("]\n", at + open.length);
    if (close < 0) return null;
    const mark = text.slice(at + 1, close);
    if (mark.includes("\n")) return null;
    const from = close + 2;
    const end = i < n ? text.indexOf(`\n\n[${word} ${i + 1}/${n} · `, from) : text.length;
    if (end < 0) return null;
    parts.push({ mark, text: text.slice(from, end) });
    at = end + 2;
  }
  return parts;
}
function eventParts(text: string, outer: string | null): DeliveryPart[] | null {
  if (!text.endsWith(BUNDLE_END)) return null;
  const events = splitMarked(text.slice(0, -BUNDLE_END.length), "fleet-ereignis");
  if (!events) return null;
  return [...events.map((e) => ({ owner: false, mark: outer ? `${outer} · ${e.mark}` : e.mark, text: e.text })),
    { owner: false, mark: outer, text: BUNDLE_END.slice(1) }];
}
const OWNER_MARK = /^fleet-buendel \d+\/\d+ · path=owner(?: · |$)/;
// The body of one transcript turn (after its delivery head, src/pendingsend.ts#splitDeliveryHeader)
// split into its parts, or null when the turn is no bundle. An event bundle may ride inside a
// delivery bundle as its path=fleet-event part; its events then become parts of their own.
export function deliveryParts(body: string): DeliveryPart[] | null {
  const events = eventParts(body, null);
  if (events) return events;
  const bundle = splitMarked(body, "fleet-buendel");
  if (!bundle) return null;
  return bundle.flatMap(({ mark, text }): DeliveryPart[] => OWNER_MARK.test(mark)
    ? [{ owner: true, mark, text }]
    : eventParts(text, mark) ?? [{ owner: false, mark, text }]);
}
