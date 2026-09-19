// ONE COMPOSER DRAFT PER SLOT (seventeenth cut). The board has one input box and it addresses the
// FOCUSED pane; text typed for one slot, then a click into another pane, then Enter, went to the
// other slot — the placeholder that names the target is hidden while the box holds text. The book
// below keeps each slot's draft (text + attachments) apart: a focus change parks the box under the
// slot it was written for and hands back the new slot's own. A draft belongs to one OCCUPATION
// (`openedAt`), so a recycled slot number never inherits an earlier session's draft. Pure, so the
// sequence that misdelivered is replayed in e2e/pins.ts without a browser.

export interface Draft<A> { text: string; attached: A[] }
interface Parked<A> extends Draft<A> { openedAt: number | undefined }

export class DraftBook<A> {
  private readonly book = new Map<number, Parked<A>>();

  // Park `current` (written for `from`) and return what the box shows for `to`. `dropped` are the
  // attachments of a stale draft (an earlier occupant of `to`) — the caller releases them.
  swap(from: number, fromOpenedAt: number | undefined, current: Draft<A>,
    to: number, toOpenedAt: number | undefined): Draft<A> & { dropped: A[] } {
    if (current.text || current.attached.length)
      this.book.set(from, { openedAt: fromOpenedAt, text: current.text, attached: [...current.attached] });
    else this.book.delete(from);
    const d = this.book.get(to);
    this.book.delete(to);
    if (!d) return { text: "", attached: [], dropped: [] };
    if (d.openedAt !== toOpenedAt) return { text: "", attached: [], dropped: d.attached };
    return { text: d.text, attached: d.attached, dropped: [] };
  }

  // an upload that finished after the focus moved on: the file sits in `slot`'s drops directory,
  // so it joins that slot's parked draft, never the one now in the box
  attach(slot: number, openedAt: number | undefined, entry: A): void {
    const d = this.book.get(slot) ?? { openedAt, text: "", attached: [] };
    d.attached.push(entry);
    this.book.set(slot, d);
  }
}
