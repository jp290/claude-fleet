# Graduation criteria — fixed BEFORE the data

Written 2026-07-25, owner-approved in session. **Purpose: pre-registration.** Each autonomy
step below graduates only when its criterion — written here before the relevant data existed —
is met. Changing a criterion is allowed, but only with a written rationale committed *before*
looking at data accrued since the last change. This is the mechanical guard against the
`baselineRate` failure mode (an anecdote from one boot window sold as a null) and against
post-hoc rationalization ("the data we got is the data we needed").

Labels come from the owner disposition rail — BUILT (`dispositions.jsonl`, owner-only write;
server.ts, grep `DISPOSITION rail`), alongside `↩ undo` usage and explicit owner statements
in-session. Per-boot in-memory numbers are never admissible evidence.

## 1. Component 5 — graded auto-land of conflict resolutions

(`lane-autonomy-future.md` components; doctrine: accumulate first, then graduate.)

Enable opt-in, reconcilable-only, non-high-stakes-zone auto-land iff ALL of:

- **N ≥ 20** consecutive Fleet-routed lands recorded after the F9 fix is deployed (so
  `verified` is honest), of which **≥ 10** were clean auto-lands.
- **0** owner undos and **0** `wrong`-class dispositions across those 20.
- Review coverage across those 20: **≥ 80 %** of rows carry a `review` object
  (measured by the outcome feed, not asserted).
- The arbitrated/mutually-exclusive class stays human-gated regardless — no criterion
  unlocks it; that requires its own future entry here.

## 2. ② clean-review — from shadow to gate

Prerequisite: shadow mode exists (runs on clean auto-lands, records verdict, gates nothing).

Enable `FLEET_CLEAN_REVIEW=1` (downgrade-only) iff ALL of:

- **N ≥ 25** shadow verdicts recorded.
- Its would-have-stopped rate is **≤ 20 %** (a brake that fires constantly is a new
  human gate, not a safety net).
- **≥ 1** would-have-stopped verdict that the owner, on reading it, labels a real catch.
- **0** cases where a shadow stop-verdict was demonstrably wrong AND would have blocked
  a time-critical land (measured, not imagined).

## 3. Deploy pilot — srv self-restart on codeBehind

Prerequisite: P-4 deploy-gap fact landed and deployed.

Enable self-restart (only when `codeBehind && no gitOp && no merge in flight && no
worker running`) iff ALL of:

- The codeBehind fact has been live **≥ 7 days** and matched reality on **≥ 3** real
  deploys with **0** false positives (said "behind" when srv was current, or vice versa).
- An owner-visible log line exists for every self-restart before the first one happens
  (perception before autonomy, same order as everywhere else).

## 4. Steward nudge promotion (existing machinery)

No new criterion — `promotionEligible()` (server.ts, grep `promotionEligible`) already
encodes it: `helped ≥ FLEET_PROMOTION_MIN_N` (default 5), zero harm, harm-attest fresh.
This entry exists to record: **that machinery is currently unfed** (`outcomeTally` empty,
`harmAttestAt` 0 as of 2026-07-25) — its criterion counts only once the disposition rail
feeds it. Do not lower `PROMOTION_MIN_N` to compensate for starvation.

## Amendment log

- 2026-07-25: initial version (criteria 1–4).
