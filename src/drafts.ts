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

// THE DRAFT IN THE BOX (card "Ein Entwurf geht nie still an eine Session, fuer die er nicht
// geschrieben wurde"). The book binds a PARKED draft to its occupation; the draft the box holds was
// bound to nothing — when the FOCUSED slot was recycled, the target repainted to the new session
// (src/composer.ts#renderTarget) while the text stayed, and Enter sent it there. The box's draft is
// bound here: to the occupation it was written for (a session's openedAt; 0 = the slot was empty),
// taken when the box holds something on a known occupation and kept while it holds. A different
// live occupation makes it the ended session's draft (`orphan`), and only adopt() or an empty box
// frees it — a returning value never does. `undefined` = the slot row is not read: nothing is learned.
export class BoxDraft {
  private bound: number | undefined = undefined;
  private orphaned = false;

  // the box now shows `occupation`'s own draft (a focus swap): the binding restarts there
  reset(occupation: number | undefined): void { this.bound = occupation; this.orphaned = false; }

  // on every poll, input, focus and send: what the slot holds now, and whether the box holds anything.
  // Returns whether the box's draft belongs to an occupation that is over.
  observe(live: number | undefined, holds: boolean): boolean {
    if (live === undefined) return this.orphaned;
    if (!holds) { this.reset(live); return false; }
    if (this.bound === undefined) this.bound = live;
    else if (!this.orphaned && this.bound !== live) this.orphaned = true;
    return this.orphaned;
  }

  // the owner's explicit „[Zitat entfernt]“: the draft is now written for what runs there
  adopt(live: number | undefined): void { if (live !== undefined) this.reset(live); }

  get orphan(): boolean { return this.orphaned; }
  // the occupation the draft was written for — where a focus swap parks an orphan, so the book's own
  // rule (a recycled slot never inherits an earlier session's draft) applies to it unchanged
  get boundTo(): number | undefined { return this.bound; }
}

export interface HistoryEntry { text: string; ts: number; source?: string }

export function historySource(entry: Pick<HistoryEntry, "text" | "source">): "owner" | "fleet" | "unknown" {
  if (entry.source === "owner" || entry.source === "fleet") return entry.source;
  return entry.text.startsWith("[fleet") ? "fleet" : "unknown";
}
