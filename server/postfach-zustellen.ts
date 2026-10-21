// THE POSTFACH ARRIVES, NOT ITS ANNOUNCEMENT (Auftrag „Postfach-Nachrichten kommen mit ihrem Wortlaut
// in der Session an“, branch/postfach-zustellen).
//
// A message addressed to a session or to its role is typed into the pane with sender, id and its whole
// text. Messages that arrive inside one short window go together in one delivery. This leaf decides the
// three things a tick must not decide by accident, and nothing else:
//   · WHICH entries are direct traffic at all (an address of kind session, lane or role — never a
//     Program, whose messages keep the old bundled announcement);
//   · WHEN the window is over (oldest entry + window; a backlog after a restart is due at once);
//   · WHAT the paste says and HOW MUCH of it fits (oldest first, one message is always delivered,
//     the rest waits for the next tick).
// The receipt is a separate, equally pure answer: only an OBSERVED acceptance receipts, and only the
// entries that were actually in that paste.
//
// No imports on purpose: the pure module is also compiled into the e2e fixture of the message tick
// (e2e/role-address.ts), and a leaf that only reads its arguments can be run there unchanged.

export type PostfachTarget =
  | { kind: "session" | "lane"; slot: number; openedAt: number }
  | { kind: "role"; role: string }
  | { kind: "program"; id: string };

export interface PostfachEntry {
  id: string;
  at: number;
  // the sender as the receiver should read it, derived by the caller from the stored address
  from: string;
  target: PostfachTarget;
  text: string;
}

export interface PostfachPlanOptions {
  windowMs: number;
  maxChars: number;
  // entries a previous attempt already typed into this occupant; never offered twice
  skip?: ReadonlySet<string>;
}

export interface PostfachPlan {
  entries: PostfachEntry[];
  text: string;
  // oldest entry + window; what a test and the audit row can compare against
  dueAt: number;
}

export const POSTFACH_BODY_PREFIX = "[fleet message]";

// A role is a session-side principal (the Orchestratorin) just as a session and a lane are. A Program
// address is NOT: it belongs to the Program's record, and its announcement keeps riding the bundle.
export const isDirectPostfachTarget = (target: PostfachTarget): boolean =>
  target.kind === "session" || target.kind === "lane" || target.kind === "role";

// One entry is one readable block: sender and id first, then the full, unchanged text. The blank line
// between entries is the only separator, so a text that ends in a newline keeps it.
export const postfachEntryText = (entry: PostfachEntry): string =>
  `${POSTFACH_BODY_PREFIX} ${entry.id} von ${entry.from}\n\n${entry.text}`;

// Oldest first; ties are broken by id so a plan is stable across map/read order. A single entry is
// always delivered even if it alone exceeds maxChars — a message is at most 2000 chars, so that can
// only happen through a caller's misconfiguration, never through the Postfach's own bound.
export function planPostfachDelivery(entries: readonly PostfachEntry[], now: number,
  options: PostfachPlanOptions): PostfachPlan | null {
  const eligible = entries
    .filter((entry) => isDirectPostfachTarget(entry.target) && !options.skip?.has(entry.id))
    .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (!eligible.length) return null;
  const dueAt = eligible[0]!.at + Math.max(0, options.windowMs);
  if (now < dueAt) return null;
  const chosen: PostfachEntry[] = [];
  let text = "";
  for (const entry of eligible) {
    const one = postfachEntryText(entry);
    const next = chosen.length ? `${text}\n\n${one}` : one;
    if (chosen.length && next.length > options.maxChars) break;
    chosen.push(entry);
    text = next;
  }
  return { entries: chosen, text, dueAt };
}

// THE RECEIPT IS THE OBSERVED ACCEPTANCE, nothing else. A typed but unobserved payload leaves every
// message unread (the caller may remember the attempt so it does not type the same text twice), and a
// cancelled or refused send receipts nothing at all.
export function postfachReceiptIds(entries: readonly PostfachEntry[],
  acceptance: "observed" | "not-observed" | "unobservable" | "not-applicable"): string[] {
  return acceptance === "observed" ? entries.map((entry) => entry.id) : [];
}
