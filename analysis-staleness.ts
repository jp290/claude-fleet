// WHEN A VERDICT EXPIRES — one rule, pure, so every case is decidable without a server.
//
// Until 2026-08-18 this was a bare equality on the integration tip: any land invalidated the
// reading of EVERY open row, whatever it had touched. A docs-only land expired a verdict about a
// pure src/client.ts row. That is not a small waste — it is the measured reason the sweep was
// switched off (ec91075): ~59 open rows meant a ~10-worker re-read wave per land, and six lands
// fell on 2026-08-06 alone.
//
// A tip is a proxy for the only question that matters: has the ground THIS row stands on moved.
// So the rule is bound to the FLÄCHE instead:
//   (a) the brief changed             — the verdict is about a string nobody will send. UNCHANGED.
//   (b) the tip moved AND the files it moved intersect the row's own surface.
//   (c) either surface is UNKNOWN     — absence of knowledge falls to stale, never to fresh.
// Nothing here weakens (a) or the "unknown tip → not stale" stance the old rule already had: a
// measurement that was never taken must not paint every row.
export type StaleReason = "brief" | "surface" | "unknown-surface" | "unknown-movement";
export interface StalenessFacts {
  // the brief revision the verdict judged, and the one that would be sent now (null = no brief)
  analysedBriefAt: number | null;
  currentBriefAt: number | null;
  // the integration tip the verdict judged, and today's. `tip: null` is UNKNOWN — the sweep has
  // not read this repo yet — and is deliberately NOT stale, exactly as before.
  head: string | null;
  tip: string | null;
  // the row's own file surface (confirmed OR derived both count as known) and the paths that moved
  // between `head` and `tip`. `null` on either side is UNKNOWN, and unknown is conservative.
  surface: readonly string[] | null;
  moved: ReadonlySet<string> | null;
}
export interface Staleness { stale: boolean; because: StaleReason | null }
export function analysisStaleness(f: StalenessFacts): Staleness {
  if (f.analysedBriefAt !== f.currentBriefAt) return { stale: true, because: "brief" };
  if (!f.head) return { stale: false, because: null };
  if (f.tip === null || f.tip === f.head) return { stale: false, because: null };
  // An empty surface is the same fact as a missing one: deriveTaskMetadata returns absence rather
  // than an invented `[]`, and a caller that flattened the two would read "touches nothing" —
  // the one reading that turns unknown into a licence.
  if (!f.surface || f.surface.length === 0) return { stale: true, because: "unknown-surface" };
  if (!f.moved) return { stale: true, because: "unknown-movement" };
  for (const p of f.surface) if (f.moved.has(p)) return { stale: true, because: "surface" };
  return { stale: false, because: null };
}
