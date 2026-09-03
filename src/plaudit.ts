// the post-land audit alarm classifier, kept out of client.ts so it can be unit-tested
// without a DOM (e2e/outcomes.ts calls postLandAlarm directly).

import type { PostLandAuditInfo } from "./protocol";

// Three rules, which is why this is a pure classifier rather than a branch inside refresh():
//  · GREEN says nothing. The expected case earns no chrome.
//  · RED and UNKNOWN are both alarms and stay DISTINCT. Red is a measured failure; unknown is a
//    measurement that never happened (timed out / could not start / declined to run). Folding
//    unknown into green would fabricate a pass; folding it into red would fabricate a defect.
//  · The alarm NAMES the land(s) it followed — "something is red" without "after which land" is not
//    actionable — and survives until the owner acknowledges THAT audit (the ack is keyed to its
//    `at`) or the server's newest audit comes back green, which is what supersedes it here: this
//    payload carries the newest row only.
export const PLA_ACK_KEY = "fleet.plaudit.ack";
// the compact projection postLandAuditSummary() ships. Tolerant on the wire by design: an older
// server, or a row written before a field existed, must degrade to "not recorded" — never to a claim.
export interface PlaAlarm { tone: "red" | "unknown"; headline: string; where: string; note: string }
export function postLandAlarm(a: PostLandAuditInfo | null, ackedAt: number): PlaAlarm | null {
  if (!a || a.result === "green") return null;
  if (a.at === ackedAt) return null;
  // anything that is neither of the two known non-green states is still an alarm, and it is NOT
  // called red: from here an unrecognised result is a measurement this client cannot read.
  const tone: PlaAlarm["tone"] = a.result === "red" ? "red" : "unknown";
  const covered = a.covers ?? [];
  const where = [
    `${a.repo ?? "(repo not recorded)"} ${a.main ?? "?"}@${(a.mainSha ?? "").slice(0, 8) || "????????"}`,
    covered.length ? `after landing ${covered.join(", ")}` : "which land it followed is NOT recorded on this audit",
    ...(a.reason ? [a.reason] : []),
  ].join(" · ");
  return tone === "red"
    ? { tone, where, headline: "POST-LAND AUDIT FAILED — the full suite is failing on the integration tip",
        note: "This audit gates nothing and nothing was rolled back. ↩ undo-land reverses the newest lands, one press per land, at most 3 deep — and which of them broke it is still yours to find." }
    : { tone, where, headline: unknownHeadline(a),
        note: "A measurement that did not happen is not a pass. Nothing about the integration tip has been checked." };
}
// "unknown" is true and unactionable — it is the same word for a run that was KILLED at its budget
// and for one whose binary was missing, and the next step differs completely. The remote daemon is
// the only party that knows which, so when it says so the headline says it too. The generic line
// stays the fallback and is never a claim: a row without the field simply did not record one.
function unknownHeadline(a: PostLandAuditInfo): string {
  if (a.remoteReason === "timeout") {
    const s = a.remoteTimeoutMs ? ` after ${Math.round(a.remoteTimeoutMs / 1000)}s` : "";
    return `POST-LAND AUDIT TIMED OUT${s} — it was killed on the helper, so no verdict exists for this land`;
  }
  if (a.remoteReason === "could-not-start")
    return "POST-LAND AUDIT COULD NOT START — the suite never ran on the helper, so no verdict exists for this land";
  return "POST-LAND AUDIT DID NOT MEASURE — no verdict exists for this land";
}
