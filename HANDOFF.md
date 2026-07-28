# HANDOFF — 2026-07-28 (session 10: the adversarial pass, and a plan whose core is a refusal)

*A thin map, NOT the knowledge. Every line is a claim to verify. **State is a COMMAND, not a
number.** This convention keeps earning its keep: two of this session's own errors were stale
numbers, and one was reading silence as evidence.*

## Status

**Recompute before believing anything below:**
```sh
./state.sh
```

**What happened is in git.** `git log 143da45..HEAD` with bodies. The two analysis documents this
session produced are `docs/analysis-2026-07-28-findings.md` (measurements) and
`docs/analysis-2026-07-28-register.md` (86 claims with their evidence class). Read the findings
doc before proposing any extraction or any deletion — it exists to stop both from being re-derived.

**Accomplished.** Built a nine-mechanism overview of the program; ran five agents against it —
three **blind** to it, two attacking named claims and the selection criterion; turned the result
into a simplification plan; briefed and landed **two lanes**. Both landed clean+green through the
ordinary gate; the second went through `⏫` merge, i.e. the unattended auto-land path.

## The one decision that shapes everything after it

**Do not extract from `server.ts`.** Measured, not argued: 7109 lines but **4777 of code**; it grew
**+908 lines in two days**; the only seam with zero shared mutable state is 238 lines (**3.3 %**).
Eight invariants survive only by co-location — three synchronous reservations before a first
`await`, `auditDraining`'s same-turn microtask window, 54 `saveState` call sites over 21 persisted
fields. Every candidate boundary **creates** must-agree pairs and removes none, because the existing
pairs are not caused by co-location.

`docs/structural-plan.md`'s M2 is therefore superseded in its central proposal — not wrong about the
defect class, wrong about the remedy. Its remaining value is M1/M3/M4 and its sequencing argument.

**The path that does work here, empirically:** six modules were extracted successfully, all with
zero module state, zero I/O, zero back-import. **Derivations out, never state.**

## The ranking criterion — the owner sharpened it, and it reorders the plan

Not "simpler" and separately "more robust". The changes worth doing are the ones where
**subtraction and hardening are the same move.** Under that lens:

1. **`src/protocol.ts` + `e2e/pins.ts`** — deletes duplicated declarations **and** turns 27 silent
   must-agree pairs into compile errors or loud check failures. Highest score in the plan; it was
   *not* where I had started.
2. **Derive the five `cp` lists → fold the four harnesses onto `e2e/harness.ts`** — −260 lines and
   the pre-land gate gets a trail for the first time (today only `e2e-isolated` is observed; the
   158 checks that actually gate leave nothing).
3. **Delete the intervention-outcome subsystem** (~590 lines) — and a false signal goes with it:
   `promotionEligible` currently reads a tally whose only producer has never fired.
4. **`saveState` ↔ boot-restore as one field table** — −100 lines and the largest must-agree surface
   becomes unbreakable. **Riskiest change in the plan: last, alone, behind a round-trip property.**

Pure hardening that *costs* lines — the notification path, the reaper, the git-race fix — is still
needed but is a trade, and should be labelled as one rather than smuggled in as simplification.

## How the next lane should be driven — `docs/lane-driving.md`

Written after this session's two lanes, at the owner's prompting, and it corrects **me**, not the
structure. The briefs were ~40 lines and enumerated what the lane could have found by reading;
`lane-brief-template.md`'s own norms already say a brief carries **only the residue** — the decision,
its reason, the hazard, the territory. Both lanes contributed things no brief contained (a sixth
port consumer, the 8800-band collision with live services, a refusal to re-assess an open security
finding), which is the evidence that enumeration was not what made them work.

**The decomposition, by contrast, is not a preference.** Same-file lanes collide at land, and undo is
one land deep — one lane doing both concerns yields one land over eleven files that cannot be half
reversed. The split *is* the reversibility. Corollary applied here: **land the lane you are most
likely to want back last.**

**What actually went wrong was fire-and-forget:** one brief, then an hour of silence, while five
agent reports sat unused in the main session. `POST /send {slot,text}` reaches any lane at any time
and the `⚙ steward` convention exists for it; neither was used. The next lane should get a *short*
brief plus mid-flight correction — stated in `lane-driving.md` §3 with what would refute it, because
**n = 2** and nothing here is a validated method yet.

## Broken / open

- **The git race is still the autonomy blocker.** `tryScriptRebase` (grep it) discards
  `git rebase --abort`'s exit code; the colliding actor is Fleet's own `tickGit`, which runs
  `git status` in every slot cwd with no merge-inflight guard. `gitRetry` exists and is wired only
  to the commit route. **Consequence measured this session: nothing can land through it** (`pre.clean`
  is false, every route is `landed:false`) — it wedges a lane and makes tier-2 reds ambiguous.
- **② cannot stop anything today.** `FLEET_CLEAN_REVIEW=shadow`. The old 38 shadow verdicts measured
  a dead feed (`main..main`, fixed 07-28 08:49) — **the series restarts at zero; do not quote 30.**
- **Two orphan worktrees**, `a0fa` and `6883`, still unlanded. Decide: land or discard.
- **The queue-deletion register** (`docs/proposals/queue-deletion-2026-07-28.md`) is **parked** by
  the owner's call and mine. Two carve-outs that should not be parked: `27b97958`
  (`--strict-mcp-config` missing on `MERGE_TOOLS`/`REVIEW_TOOLS`) and the collision below.
- **`outcomeTally` has two owners.** The queue register wants its two false `dismissed` rows
  corrected so `promotionEligible` reads right; the deletion inventory wants the whole subsystem
  gone because its producer never ran. **Decide once, not twice.** My reading: the deletion evidence
  is stronger — repairing an instrument nobody reads is not a repair.

## Must be fixed by hand in the main checkout — `CLAUDE.md` is gitignored

1. **Delete the NUL-byte rule.** `src/client.ts` has no NUL (fixed in `688d22e`, an ancestor of
   HEAD); plain `grep -c 'MAX_CHUNK' src/client.ts` returns 2, exit 0. This false rule rode into
   every agent prompt this session.
2. **"ALLE vier Wrapper prüfen" → six scripts carry `cp` lists** (the five plus `steward-arena.sh`,
   which has been dead at module resolution since 07-26 for exactly this reason).
3. **"Der Dispatcher ist verfügbar UND an" → it is `off`** (`fleet.json` `"dispatch": false`).
4. **The lane Verify line is not the live gate.** `watchdog.sh:71` runs `./e2e-clean-review.sh &&
   ./e2e-security.sh && ./e2e-claude-gate.sh`; `./e2e-security.sh` is missing from the lane's Verify
   line, so a lane can fail the land gate on a suite it never ran. Its tsc list also omits three
   harnesses the gate checks. *(Reported by the lane that fixed the wrappers — it could not fix this
   itself, and neither can any lane.)*

`docs/lane-brief-template.md:84-85` describes the gate wrongly too — that file **is** landable, and
it is delivered into every lane's launch prompt.

## Non-obvious state

- **The 8800 band contains live local services** (8815, 8850, 8862, 8899, 8901, 8924 measured). Port
  bands are now disjoint, but `e2e-isolated.sh`'s band still collides with real listeners — a run
  whose `$$` lands there fails to bind. Left deliberately un-respaced as out of scope; noted in the
  band-table comment.
- **The per-check trail proved itself.** It adjudicated a red post-land audit in one query instead
  of a seven-minute re-run: tree `c0439f15` (a day older than the change under suspicion) fired the
  same `FIX1` check on 4 runs as 0/1/0/1. Use it before re-running anything.
- `FLEET_CMD=claude --dangerously-skip-permissions` is set in **no file you would think to check** —
  it lives in the tmux server's global environment *and* in `.env`, and `watchdog.sh` sets it zero
  times. **31 of 42 config values have no sensor at all**; `state.sh` derives none of them.
- The live server binds **only** the Tailscale IP: `curl http://100.64.0.1:8790/`.

## Corrections this session made — including two of my own

1. **I reported `.env` as empty. It is not** — it carries `FLEET_CMD`. My check was
   `cat -A .env 2>/dev/null`; stderr was suppressed and I read the silence as emptiness. An agent
   had cited it correctly and I "corrected" it wrongly. Same failure class as the session's subject.
2. **I called the client "a surface, not a mechanism".** Right conclusion, wrong reason: a red,
   skipped or stale verify badge **never disables land** (`src/client.ts:1007`), so the render *is*
   the gate at the manual-land boundary. It holds because it was built carefully, not because it is
   a surface — and calling it a surface removes it from the class of things that get audited.
3. **Ruling sharing out was wrong.** `view` is genuinely a surface; `interact` is a different object
   with the same name — an unattended write path into a pane, missing the one guard the codebase
   itself identified as necessary (`claudeAlive`), with the WS half writing no log line at all.
4. "The conflict path always stops" holds **within** a run. Across runs there is a fall-through:
   once `main` moves, the re-run guard lapses and a lane still carrying agent resolutions can take
   the clean auto-land branch.
