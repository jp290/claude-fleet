// land-candidate.ts — pure, read-only projection of merge facts for future PromotionPolicy work.
//
// Nothing here decides eligibility and nothing in a land path imports this module. The optional
// `current` identity is supplied by a future read surface; without that observation freshness is
// honestly unknown. Old persisted verdicts therefore render, but can never appear fresh.
import type {
  LandCandidate,
  LandCandidateVerifyRun,
  PromotionPolicyFacts,
  PromotionRiskClass,
} from "./src/protocol";

export interface MergeCandidateRecord {
  readonly mainSha?: string;
  readonly candidateSha?: string;
  readonly diffHash?: string;
  readonly verify?: LandCandidateVerifyRun;
  readonly conflicted?: readonly string[];
  readonly repairRounds?: number;
  readonly cleanReview?: { readonly verdict: string; readonly reason: string };
}

export interface CurrentLandCandidateIdentity {
  readonly mainSha: string;
  readonly candidateSha: string;
  readonly diffHash: string;
}

const isHash = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{40,64}$/.test(value);

const sameCandidate = (candidate: LandCandidate, current: CurrentLandCandidateIdentity): boolean =>
  candidate.candidateSha === current.candidateSha
    && candidate.diffHash === current.diffHash;

export function projectPromotionPolicyFacts(
  record: MergeCandidateRecord,
  current: CurrentLandCandidateIdentity | null = null,
): PromotionPolicyFacts {
  const candidate = isHash(record.mainSha) && isHash(record.candidateSha) && isHash(record.diffHash)
    ? { mainSha: record.mainSha, candidateSha: record.candidateSha, diffHash: record.diffHash,
        verify: record.verify ?? null } satisfies LandCandidate
    : null;
  const currentValid = current !== null
    && isHash(current.mainSha) && isHash(current.candidateSha) && isHash(current.diffHash);
  const candidateFreshness = !candidate || !currentValid
    ? "unknown" as const
    : sameCandidate(candidate, current) ? "fresh" as const : "stale" as const;

  const verifyFreshness = !candidate || candidateFreshness === "unknown"
    ? "unknown" as const
    : candidateFreshness === "stale" || current!.mainSha !== candidate.mainSha || record.verify?.stale === true
      || (record.verify !== undefined && record.verify.mainSha !== candidate.mainSha)
    ? "stale" as const
    : record.verify === undefined ? "not-run" as const : "fresh" as const;

  const conflicts = [...(record.conflicted ?? [])];
  const repairRounds = Number.isInteger(record.repairRounds) && (record.repairRounds ?? 0) > 0
    ? record.repairRounds! : 0;
  const riskClasses: PromotionRiskClass[] = [];
  if (conflicts.length) riskClasses.push("conflict-resolution");
  if (repairRounds) riskClasses.push("repair-rounds");
  if (record.verify === undefined) riskClasses.push("verify-not-run");
  else if (record.verify.ok === false) riskClasses.push("verify-failed");
  else if (record.verify.ok === null) riskClasses.push("verify-unmeasured");
  if (record.cleanReview?.verdict === "review") riskClasses.push("clean-review-flagged");

  return { candidate, candidateFreshness, verifyFreshness, riskClasses, conflicts, repairRounds };
}
