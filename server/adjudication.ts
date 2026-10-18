// THE VERDICTS ON A RED AUDIT, one list for every reader: the server's adjudication rail and report acceptance
// (server.ts#writeAuditAdjudication, #acceptByLandReading) and the merge check's "is main known red"
// (ci/merge-check.ts#mainVerdict). `flake`, `stale-test` and `unknowable` say somebody LOOKED and the red is no
// regression, so they clear it; `real` and an unjudged red keep it.
export const ADJUDICATION_VERDICTS = ["real", "flake", "stale-test", "unknowable"] as const;
export type AdjudicationVerdict = typeof ADJUDICATION_VERDICTS[number];
export const ADJUDICATION_CLEARS_RED: readonly AdjudicationVerdict[] = ["flake", "stale-test", "unknowable"];
