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
  // NOT-APPLICABLE is no alarm (owner 2026-10-08): the repo has no audit command, so nothing was
  // meant to be measured — calling it „[Zitat entfernt]“ put a false alarm at the top of Info. A
  // newer server never ships such a row (server.ts#postLandAuditSummary); an older one still may.
  if (a.result === "not-applicable") return null;
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
    ? { tone, where,
        // The headline names WHAT failed, and since 2026-09-04 that is not always the full suite:
        // a docs-only tip is audited by the short proportional chain, and calling that "the full
        // suite" would send the reader to the wrong log and the wrong repair.
        headline: a.proportional
          ? "POST-LAND AUDIT FAILED — the docs-only proportional chain (install+pins) is failing on the integration tip"
          : "POST-LAND AUDIT FAILED — the full suite is failing on the integration tip",
        note: "This audit gates nothing and nothing was rolled back." }
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

// WHO HAS THE ALARM (owner 2026-10-08: „[Zitat entfernt]“
// ). Read from the two rails the row carries (src/protocol.ts
// #PostLandAuditInfo `ping` and `adjudication`) and nothing else — "works on it" is not recorded
// anywhere, so it is not a state here. The order is the rails' own: a judgement settles it whatever
// the delivery did; then the delivery rail. `gone`: it was typed into a slot whose session has since
// changed — nobody holds it now. A status this client does not know is `none`, never a guess.
export type PlaHolder =
  | { kind: "judged"; verdict: string | null; by: string | null; at: number | null }
  | { kind: "session"; slot: number; since: number | null }
  | { kind: "gone"; slot: number | null }
  | { kind: "program" }
  | { kind: "waiting" }
  | { kind: "none" };
export function plaHolder(a: PostLandAuditInfo): PlaHolder {
  if (a.adjudication) return { kind: "judged", verdict: a.adjudication.verdict, by: a.adjudication.by, at: a.adjudication.at };
  const p = a.ping;
  if (!p) return { kind: "none" };
  if (p.status === "adjudicated") return { kind: "judged", verdict: null, by: null, at: null };
  if (p.status === "program-inbox") return { kind: "program" };
  if (p.status === "delivered") return p.sameSession === true && typeof p.slot === "number"
    ? { kind: "session", slot: p.slot, since: p.deliveredAt ?? null }
    : { kind: "gone", slot: p.slot ?? null };
  if (p.status === "pending") return { kind: "waiting" };
  return { kind: "none" };
}
// the owner is needed exactly when nobody else holds it: a session, the Program's inbox and a
// judgement each take it off the owner's desk; waiting, gone and nothing recorded leave it there
export const plaNeedsOwner = (h: PlaHolder): boolean => h.kind === "waiting" || h.kind === "gone" || h.kind === "none";
