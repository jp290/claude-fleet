# Authority slice — guarded Project-MAIN self-land (brief, 2026-08-23, after Structure A+B)

Program `4aa3ed1c` (slot 3). Base tree `d93ab4a` (Structure A `6a12838` + B landed; receiver is
program-binding-first, derived phase projection live, lifecycle footer live — this slice builds on
those facts). Supersedes the land-door parts of `docs/promotion-policy-v1-2026-08-23.md` and
`docs/program-transitions-brief-2026-08-23.md` §3 where they conflict with the owner policy below.
The orphan branch `fleet/260823124447-a0e9` (7 commits, measured 2960/5) is REFERENCE evidence —
read its probe-fix commit bodies (`937abfa`, `ec3bb33`); do not merge it.

## 1. Owner policy (verbatim in effect, 2026-08-23 — this section outranks every earlier draft)

- **Ordinary clean/green in-program land decisions belong to the owning Project MAIN, not the
  Owner.** The MAIN inspects evidence and lands its own Program's work. Once this mechanism exists,
  a `review-ready` attention for a routine clean/green in-program land is a MAIN defect.
- **Conflict is MAIN work:** a git/content conflict inside the confirmed Program scope and declared
  write sets → the MAIN inspects both sides, chooses or commissions a resolution, records
  `conflicted` files / `resolvedBy` / `repairRounds` / `candidateSha`, re-runs the authoritative
  verification fresh on the resolved candidate, reviews the diff, lands if fresh and green.
  `conflicted:true` alone never blocks promotion.
- **Initial red/unknown or critic rejection → bounded MAIN repair/recovery**, a progress budget,
  not a fixed round count: continue while each round closes a named defect without regression
  inside declared time/cost/scope.
- **Escalate ONLY (the five classes + exhaustion):** material scope/intent change · irreversible
  external effect / new spend / new secret scope · final declared taste/release boundary ·
  irrecoverable/contradictory provenance · repeated no-progress, cycling, or boundary pressure.
- Unknown/skipped verification is never green (unchanged); pre-authorized tools/cost within their
  envelope are MAIN's to use.

## 2. The mechanism (small; reuse everything Structure landed)

1. **Policy record** `program.promotion` on `interface Program` — closed schema
   `{v:1, selfLand:"off"|"green-only"|"guarded"}`; owner route `POST /api/programs/:id/promotion`
   (`{"policy":null}` revokes, unknown key/value 400, `confirmedAt` stamped); loader degrades a
   malformed record to ABSENT (probe the dangerous direction). `"green-only"`: clean+green only.
   `"guarded"`: additionally the resolved-conflict path in (3). Absence = owner-only, byte-for-byte.
2. **Route** `POST /api/self/tasks/:id/land` — self-token; lane 409; steward 409; no body. Refusal
   order (each its own sentence): exact live bound MAIN (slot+openedAt+sessionId; ambiguous = second
   refusal) → task known → task of this Program → kind `auftrag`, status `sent`, live lane slot →
   lane repo = caller checkout (`repoKeyOf`) → policy present and not `off` → repo has its own
   `FLEET_VERIFY_CMD_REPOS` entry → per-task attempt cap (`FLEET_SELF_LAND_MAX_ATTEMPTS` default 3,
   409 with the number) → lane done-looking (`laneWatchSignal`) → not inflight (shared reservation
   with the owner route). Candidate = lane HEAD at invocation; same `(task, candidate)` already
   landed → 409 `already landed`. Calls the EXISTING `mergeJob` through a helper shared with the
   owner route; `mergeJob` logic unchanged.
3. **Resolved-candidate confirmation (policy `"guarded"` only):** today a resolution ends
   `status:"resolved", landed:false` and only the board's owner confirm may land it. The route, on a
   task whose lane holds exactly that verdict, lets the BOUND MAIN confirm it: the server re-runs
   `runVerify` FRESH on the resolved candidate sha, lands only on `ok:true`, and the note records
   `conflicted`, `resolvedBy`, `repairRounds` (count of prior non-land verdicts for this task),
   `candidateSha`. No new merge implementation — this widens WHO may take the existing confirm step,
   under the policy, with fresh verification. Red/unknown after the fresh run → non-land, MAIN
   repair; the five classes go to attention.
4. **Actor provenance** (from the reference branch, unchanged in intent): `LandProvenance.actor`
   required on every new note — `{kind:"owner", via}` | `{kind:"main", slot, program, task,
   sessionIdMatch}`; `LaneOutcome.landedBy`; audit `land_actor`; owner-route bearer/query merge on a
   Program-task lane with a live bound MAIN → `actor.suspect:"owner-token-outside-board"` + audit
   `owner_token_ambient_use`. Prevention stays UNSUPPORTED (same uid) and documented.
5. **T0** (`ef597073`, absorb, do not re-file): `tickDispatch` repo-cap `return` → `continue`, only
   the capped row waits; two-repo regression (realpath both sides); pin "the cap holds only its own
   row". Serial one-start-per-tick, master-stop/quiet-hours/per-program cap unchanged (probe).
6. **Projection tie-in** (facts only): a `sent` row whose lane holds a non-land verdict already shows
   REVIEWABLE/OWNER_GATE from Structure A; `nextAction` for a bound MAIN with policy becomes
   "inspect → POST /api/self/tasks/:id/land". `evidence.ownerPlaytest` / unhandled-event nextAction /
   `main.ctxPct≥25 → succession` (A5–A7, still unbuilt) ride along here as fact-only fields.

## 3. Non-goals (unchanged)

No worker self-land · no tick auto-land (the pin "no `mergeJob(` call site in a tick" must survive;
after this slice: exactly two call sites, both routes) · no Supervisor landing · no deploy from the
route · no policy engine beyond the closed record · no new ledger · no ambient owner token · legacy
Programs without a policy byte-for-byte.

## 4. Verify & sequence

Builder: Opus 5 high, exclusive write set (`server.ts` seams: Program type + loader + owner
promotion route + self route + provenance + the one `tickDispatch` line · `e2e/programs.ts` ·
`e2e/merge.ts` · `e2e/tasks.ts` · `e2e/pins.ts` · `docs/self-api.md` §land/§promotion). Full chain +
`./e2e-isolated.sh` serial (one run-id) + `./e2e-clean-review.sh` (merge path touched). Critic:
pi-ox `x-preview-f-free`, read-only, authority checklist (the 14 items of the SLP-4 text plus the
resolved-confirmation path), before land. Canary after deploy (owner boundary): this Program
confirms a policy on itself and lands its critic's docs lane through the route; measurement =
attention log (zero routine land attentions) + `owner_token_ambient_use` stays 0.
