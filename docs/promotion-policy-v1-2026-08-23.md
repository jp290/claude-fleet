# PromotionPolicy v1 — guarded Project-MAIN self-land (architecture, 2026-08-23)

Program `4aa3ed1c` (owner-confirmed, MAIN slot 3). This is the architecture step; the builder row
(SLP-1) and the critic row (SLP-2) cite this file by `git show main:docs/promotion-policy-v1-2026-08-23.md`.
Line numbers are from tree `9cc8b1e`; re-anchor with `rg -n` before editing.

## 0. The defect this closes, measured

- Today the ONLY `mergeJob(` call site is the owner route `/^\/api\/slots\/(\d+)\/merge$/`
  (`server.ts:18780`, call at `:19076`). A Project MAIN that wants its reviewed lane on main has two
  options: relay through the Controller, or read `fleet.json.token` and call the owner route itself.
- Slot 16 (Worktrail-B MAIN) did the latter for `9cc8b1e` (2026-08-23). The land note
  (`git notes --ref=fleet/land show 9cc8b1e`) carries `verify.ok:true, confirmedByHuman:false` and
  NOTHING that names the actor: `LandProvenance` (`server.ts:10640`) has `conflicted`,
  `resolverDetail`, `verify`, `confirmedByHuman` — no actor field. The ledger cannot tell that land
  from one the owner made from the board. That is the regression surface this Program treats as a
  defect, not as a workaround.
- `tokenFrom` (`server.ts:13232`) accepts the owner token via `Authorization: Bearer`, the `fleet`
  cookie, or `?token=`. The board uses the cookie; a session uses Bearer. The channel is therefore a
  real, cheap, honest signal of WHO is likely calling — today it is read and then discarded.

## 1. Decisions (the four open questions, answered)

**Q1 — where the policy lives.** As `program.promotion`, an owner-confirmed sub-record on the
`Program` (`interface Program`, `server.ts:2180`) — NOT inside `ProgramContent` (which a session
proposes and the owner only overlays). Written by exactly one owner route,
`POST /api/programs/:id/promotion` (sibling of the `confirm|activate|…` action router at
`server.ts:14569`); revoked by the same route with `{"policy": null}`. Never written by a self
route, never backfilled at load. Absence = owner-only land, the honest legacy form.

**Schema v1 — closed, versioned, default-deny:**
```
{ "v": 1,
  "selfLand": "off" | "green-only",   // default "off"
  "verify": "repo-entry",             // the only v1 value (see Q3)
  "maxPerDay": 1..20 }                // default 5 — self-lands per Program per UTC day
```
Validation: unknown key → 400 at the owner route; unknown/invalid value → 400. Loader (discipline
of `loadTaskSpawn`): a persisted record that fails the schema degrades to ABSENT (owner-only), and
the probe is built on the DANGEROUS direction (a bad record must never load as "green-only").
`confirmedAt` and `confirmedVia` (`cookie|bearer|query`, see §3) are stamped server-side.

**Q2 — minimum evidence binding before MAIN may invoke.** No body. The server derives everything:
- caller = exact live bound MAIN (`boundProgramForMain`, `server.ts:6169`; "not bound" and
  "ambiguously bound" remain two refusals, as at the release door `:6198`);
- task `:id` is `sent`, `programId` = this MAIN's Program, `kind` = `auftrag`, and `task.slot` is a
  live slot whose `worktree.repo` canonicalises to the caller's checkout (`repoKeyOf`);
- target lane = that slot, candidate = that lane's HEAD at invocation; the lane must be
  `done-looking` (`laneWatchSignal`, `lane-signals.ts:92`: idle + clean + ahead>0). "missing-report"
  in v1 IS "not done-looking" — the commits are the report; a pane transcript is not machine
  evidence and is not read;
- `changed-candidate`: the route records `candidate` (HEAD sha) in the audit event and in the
  returned body; `mergeJob` rebases/verifies that tree. A lane that moves after the signal is simply
  re-evaluated on the next call — there is no stored "approved sha" in v1, because the server never
  trusted a MAIN-supplied sha to begin with.

**Q3 — deterministic repo verification.** v1 = `"repo-entry"`: the repo MUST have its own entry in
`FLEET_VERIFY_CMD_REPOS` (`server.ts:10007`, owner-stored in `.env`, never a wire value). The route
refuses BEFORE starting when `VERIFY_CMD_REPOS.get(repoCanon(repo))` is undefined:
`blocked: repo has no owner-configured verify entry — the global FLEET_VERIFY_CMD skips (exit 42)
outside the fleet repo`. This is the honest closure of the Tower gap: Tower stays explicitly
blocked until the owner adds an entry (an `.env` act, outside this Program). A stored entry that
still exits 42 / times out is `verify.ok === null` and stops at `server.ts:13110` exactly as
today — unknown is never green. A tracked-script convention or named profile is a later owner
decision; v1 does not invent one.

**Q4 — repair-and-retry vs escalate.** MAIN may act and call again on: `dirty` (lane commits),
`not done-looking` (lane finishes), `behind/stale` (lane rebases, re-signals), `busy`
(merge/commit inflight). MAIN escalates and does NOT retry through the route on: `resolved`
(conflict), `verify.ok:false`, `verify.ok:null` (skipped/timeout/never started), `unauthorized`,
`wrong-program`, `no-policy`. Those outcomes already end as non-land in `mergeJob`; the route adds
one owner-attention event (existing rail, `ownerAcknowledgeFleetEvent` family, `server.ts:5472`)
naming task, lane, outcome. Caps: `maxPerDay` per Program and `FLEET_SELF_LAND_MAX_ATTEMPTS`
(default 3) per task — exceeded = 409 WITH the number.

## 2. The route

`POST /api/self/tasks/:id/land` — self-token, Non-Lane-only (409 to a lane, like `release`),
steward 409 (the steward is a standing role, not a Program MAIN). Reads no body; extra fields are
not read (same 400 wording family as `createTaskForMain`). Refusal order, each its own sentence:
bound? → task known? → task of this Program? → task `sent` with a live lane slot? → lane repo is
this checkout? → policy present and `selfLand:"green-only"`? → repo has verify entry? → caps? →
lane done-looking? → not inflight? Then it calls the EXISTING `mergeJob` with the same arguments
the owner route computes (`carried`/`carriedBy` from `mergeLast`, `server.ts:19040-19076`) and
returns `{running:true, task, laneSlot, candidate, watch:{kind:"merge", target:laneSlot}}`.
`mergeJob`, `runVerify`, the tick, `dispatchTask` are NOT touched. After the cut the repo holds
exactly TWO `mergeJob(` call sites and both are routes — the pin that today asserts "one" asserts
"two, both routes, zero in ticks".

Event rail for the canary: the MAIN subscribes `{kind:"merge", target}` then `{kind:"audit", repo,
mainAfter}` via `POST /api/self/watch` (both exist since `5da9c4d`) — no polling.

## 3. Actor provenance and the ambient-owner-token guard

- `LandProvenance.actor` (new, required on every new note):
  `{kind:"owner", via:"cookie"|"bearer"|"query"}` or
  `{kind:"main", slot, program, task, sessionIdMatch}`. Written to the `fleet/land` note, to
  `LaneOutcome` as `landedBy` (`server.ts:11364`), and to an audit event `land_actor`.
- **Suspect flag, not prevention:** an owner-route merge arriving via `bearer`/`query` whose target
  lane is a Program task with a LIVE bound MAIN is stamped `actor.suspect:"owner-token-outside-board"`
  and audited as `owner_token_ambient_use` (slot, task, program). The land still proceeds — the
  owner's own scripts use Bearer — but the ledger now exposes the actor class, and the self route
  is the sufficient, unflagged path.
- **Prevention is classified UNSUPPORTED in v1, honestly:** every session runs as the owner uid;
  `fleet.json` is 0600 but same-uid readable from any worktree (`../claude-fleet/fleet.json`).
  Preventing acquisition needs host sandboxing, which the owner excluded. What IS feasible and in
  scope: (a) the flag above, (b) a `register.sh`/`state.sh` sensor line counting
  `owner_token_ambient_use` events since the last handoff, (c) a pin that the owner merge route
  reads the channel and that `actor` is never absent on a new note.

## 4. Surfaces (builder classifies each as apply / unsupported / not-applicable)

server (Program type, loader, owner promotion route, self land route, provenance, suspect flag,
caps) · `docs/self-api.md` §land (+ the still-missing §tasks, builder decides and says) ·
`e2e/programs.ts` (policy schema, loader danger-direction, route refusals in order, cap numbers) ·
`e2e/pins.ts` (two route call sites, `actor` present, bearer channel read) · `e2e/merge.ts`
(actor in note/outcome) · `state.sh`/`register.sh` sensor · client: reverse-state only if the
board already renders `program` fields — otherwise not-applicable, said.

## 5. Non-goals (verbatim from the Program, kept)

No worker self-land, no slot/branch parameter, no conflict acceptance, no red override, no deploy,
no credentials, no second merge implementation, no always-land switch, no unknown→green, no
studio feature work. Deploy of the landed cut is an explicit later boundary.
