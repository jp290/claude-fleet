# State-vs-reality divergence: facts Fleet writes down and later believes without looking

**Date:** 2026-07-25 · **Scope:** ONE error class — the server records a fact about a slot/lane
that is not true of the world, and a *later automatic decision* reads that record instead of the
world. For an unattended session this is the expensive class, because autonomy means trusting the
protocol without re-checking it.

**Ranking rule (the owner's, adopted):** direction beats frequency. A divergence that reads as
*unknown / not finished* is SAFE — the automation declines to act. A divergence that reads as
*clean / ready / quiet / done* is DANGEROUS — the automation acts on a world that isn't there.

## Method — what is verified, what is inferred

**VERIFIED by reading** (whole functions, not names): `lane-signals.ts` (all 68 lines);
`server.ts` — `poll` (1545-1569), `saveState` (411-430), state restore (3593-3705), boot
sequence (3706-3785), `tickGit`/`measureOutcomes` (700-815), `ensureSlot` (1067-1128),
`openSlot`/`killSlot`/`detachSlotTasks` (1137-1226), `canDeliver`/`tickAutos`/`tickDispatch`
(1372-1536), `claudeAlive*` (1259-1285), `tickHarvest` (1752-1821), `tickAutoReview` (2272-2300),
`mergeJob` + the clean/conflict verdict sites (3217-3377), `landLane`/`advanceIntegration`
(961-1006), `buildLaneOutcome`/`buildRevertedOutcome` (2819-2913), `laneSignalView` /
`stewardSlotsView` (3956-4013), `renderStewardMessage`/`handleStewardSend` (3798-3911), the
principal gates (4490-4527), the slot routes (5510-5574) and the ⏫ merge route (5154-5306).

**VERIFIED by execution:** four probes against a throwaway instance (own tmux socket + port,
`FLEET_CMD=true`, the live socket never touched). Raw output is quoted inline below.

**NOT checked** (stated so partial coverage never reads as full):
- the client (`src/client.ts`) — no divergence claim here rests on it;
- `src/share.ts` and the guest surface;
- the intake/email path and `enhance`/`summary` prompt bodies;
- `tickHarvest`'s transcript parsing against real claude JSONL (I read the code, ran nothing —
  probes ran with `FLEET_CMD=true`, so no transcript exists);
- anything about the **live** fleet's current state: no probe touched socket `claudefleet`,
  port 8790, or the live `fleet.json`. Every number below comes from an isolated instance;
- `FLEET_CLEAN_REVIEW=shadow` behaviour in the field (the shadow verdict is written from the
  same clean-path site I read, but I did not run the reviewer).

---

## 1. The enumeration

Every fact the server records about a slot/lane, its writer, the *automatic* consumer that later
reads it, and whether it can diverge from the world. "Automatic" = a decision no human triggers:
`tickAutos`, `tickDispatch`, `tickAutoReview`, `tickGit`/`measureOutcomes`, the clean auto-land
block, `laneDoneLooking`/`laneQuietSince`, and the steward-principal routes an unattended steward
pane can drive itself.

| # | Fact | Writer | Automatic consumer | Can diverge? | Direction | Cost |
|---|------|--------|--------------------|--------------|-----------|------|
| 1 | `s.lastOutput` | `poll` 1561 only; `killSlot` → 0 (1219); **not persisted** (411-420) | `laneSignalView.idleMs` 3964 → both lane-signals clauses; `canDeliver` busy gate 1382 (autos, steward send, land gate 5180); outcome `outputBaseline` 3906 | **YES — every srv restart** | **DANGEROUS** (reads "quiet forever") | D1 |
| 2 | `s.cwd` | `openSlot` 1141 | `tickGit` 704-735 (all git facts), `ensureSlot`, `reviewState`, `transcriptFile` | YES — `openSlot` on an ACTIVE slot never respawns the pane (1071) | **DANGEROUS** (git facts of a dir nobody works in) | D2 |
| 3 | `s.selfToken` | `openSlot` 1147 (rotate) | `/api/self/autos` 4500 | YES, same path as #2 — pane env is spawn-time (1084) | SAFE (fail-closed 401) | D2 note |
| 4 | `s.sessionId` | `ensureSlot` 1097 only `if (created.code === 0)` | `tickHarvest` 1757, `transcriptFact` 3981, `sessionStart` 490 | YES, same path as #2 (stays `null` forever) | SAFE (facts go absent) | D2 note |
| 5 | `s.label` | `openLaneInSlot` 1040, rename route 5521 | `tickAutoReview` skip 2280, `stewardSlotsView.doneLooking` 4001, steward-token bake 1090 | YES — relabel is instant, the pane's env is not | **DANGEROUS** (authority outlives the role) | D5 |
| 6 | `s.worktree.base` | `openLaneInSlot` 1035 (set); `tickDispatch` 1489 (**deliberately absent**) | `laneBaseRef` 555 → `tickGit` ahead/behind 724-731, `buildLaneOutcome` 2827 — but **NOT** the land target (5182) | YES — two answers for "this lane's base" | **DANGEROUS** (lands onto a branch it never forked from) | D3 |
| 7 | `s.worktree.baseSha` | `laneForkSha` 571 at create/attach | `buildLaneOutcome` 2827 | No divergence found (immutable, absent→honest fallback) | SAFE | — |
| 8 | `gitInfo{dirty,ahead}` | `tickGit` 735 (≤10s) | lane-signals clauses 5+6; steward `commit` ref 3806; outcome `gitBaseline` 3888 | Staleness only (≤10s); `openSlot` deletes the entry (1166) | SAFE (stale-dirty over-refuses; unknown → `null` → clauses false) | — |
| 9 | `aliveInfo` | `tickGit` 708 | lane-signals `alive` clause | Staleness only; every *delivery* gate re-reads fresh (1380) | SAFE | — |
| 10 | `gitOpInfo` | `tickGit` 709 | lane-signals `gitOp` clause | Unknown (`null`) reads as "no git op" — **not** a negation test | masked (see §3) | §3 |
| 11 | `mergeLast` | `mergeJob` 3374 (guarded `!s.cwd \|\| s.cwd === cwd`); restore 3630 (branch-matched) | lane-signals `merge` clause; `mergePending` 3997; **steward `lifecycle_op:verify` 3812** | YES — the `verify` ref checks *presence*, not status | **DANGEROUS** (asserts "Lane gelandet" to a lane that did not land) | D4 |
| 12 | harvest offsets | `openSlot` sentinel 1151, `tickHarvest` 1766-1772 | `tickHarvest` history/prompt-log writes | Gated on `s.sessionId` — goes absent, never wrong | SAFE | — |
| 13 | `shares` / `autos` | `openSlot` 1168-1174, `killSlot` 1211-1212, boot 3743-3744 | `tickAutos` 1394 | Not found | SAFE | — |
| 14 | task↔slot binding | `tickDispatch` 1493, `detachSlotTasks` 1186, `landLane` 973, boot requeue 3748 | `tickDispatch` 1476, `stewardTaskView` 3952 | Not found (every teardown path detaches) | SAFE | — |
| 15 | outcome row fields | `buildLaneOutcome` 2850 | **none in-server** — only `GET` 4835 | — | (no automatic consumer) | D6 |
| 16 | `reviewCache` / `reviewAutoTried` | `startReview` / 2291 | `tickAutoReview` 2289-2290 | **Memory-only** (absent from `saveState` 417) | re-arms after every restart | D1 rider |

---

## 2. Ranked findings

### D1 — `lastOutput` is not persisted, so **every srv restart makes every quiet lane read "idle for 56 years"** ⚠️ DANGEROUS

`poll` (server.ts:1561) is the only writer of `s.lastOutput`. It is not in the persisted record
(`saveState`, server.ts:412-414). Boot then sets `s.offset` to the stream file's *current size*
(server.ts:3759), so everything the pane printed while srv was down is skipped — `lastOutput`
stays at its initial `0` until the pane emits something **new**. A finished, quiet lane emits
nothing. `laneSignalView` (3964) turns that `0` into `idleMs = Date.now()`, and
`laneQuietSince` (lane-signals.ts:64-68) returns `now - idleMs = 0` → **1970-01-01**.

Probe (isolated instance; the pane is never touched, only srv is restarted the way a deploy
restarts it — `tmux kill-session -t srv`):

```
BEFORE restart (pane emitted 1.5s ago): {"lastOutput":1785014211482,"idleMs":1453,"doneLooking":false,
  "doneLookingSince":1785014211482,"quietSinceISO":"2026-07-25T21:16:51.482Z",
  "git":{"branch":"fleet/260725211641-2be3","dirty":0,"ahead":1,"behind":0,...},"serverNow":1785014212935}
AFTER restart  (same pane, untouched): {"lastOutput":0,"idleMs":1785014215710,"doneLooking":true,
  "doneLookingSince":0,"quietSinceISO":"1970-01-01T00:00:00.000Z",
  "git":{"branch":"fleet/260725211641-2be3","dirty":0,"ahead":1,"behind":0,...},"serverNow":1785014215710}
pane still alive: yes pane_pid: 42671
```

Every other clause is byte-identical across the restart; the only thing that moved is the clock
fact, and `doneLooking` flipped **false → true** because of it.

**Who reads it, and what it costs:**
- `tickAutoReview` (2282) — the 60s quiet requirement is satisfied vacuously at boot+15s. Worse,
  `reviewCache` and `reviewAutoTried` are memory-only (2070/2084, absent from `saveState`), so the
  "one spawn per git state" ceiling is re-armed too: **every deploy can spawn up to
  `AUTO_REVIEW_MAX_CONCURRENT` = 2 real `SUMMARY_MODEL` sessions immediately**, on lanes that were
  already reviewed before the deploy.
- `canDeliver`'s busy gate (1382) — an auto configured `idleSec: 600` ("only when it has been
  quiet ten minutes") fires on the first `tickAutos` after boot regardless of what the session was
  doing 3 seconds earlier. Same for `handleStewardSend`'s `STEWARD_MIN_IDLE_MS` (3850) and the
  land gate's `MERGE_IDLE_MS` (5180).
- `doneLookingSince` is served as an epoch-ms fact (4008). A poller doing `now - doneLookingSince`
  gets **56 years**. This one does not decay: it persists until a human types into the pane.

**Cheapest correct fix (proposal, not implemented):** treat "no output observed yet" as
*unknown*, not as *quiet since epoch* — `lastOutput: 0` → `idleMs: null` in `laneSignalView`,
which the predicate already handles conservatively. Persisting `lastOutput` is the alternative,
but the honest value after downtime is unknown, not the pre-restart timestamp.

---

### D2 — `POST /api/slots/:id/open` on an **active** slot rewrites the record and never touches the pane ⚠️ DANGEROUS *(owner-reported instance 1 — reproduced)*

`ensureSlot` only builds a pane `if (has.code !== 0)` (server.ts:1071). `openSlot` (1137-1180)
unconditionally rewrites `s.cwd`, `s.label`, `s.worktree`, `s.model`, rotates `s.selfToken`,
nulls `s.sessionId`, and clears history/autos/shares/mergeLast/gitInfo — then calls `ensureSlot`,
which no-ops. The route has no active-slot guard (5525-5537); its sibling `open-worktree` does
(`if (s.cwd || laneSpawn.has(s.id)) return … "slot already active"`, 5541).

Probe:

```
open slot 2 on dirA: {"ok":true,"cwd":".../dirA"}
tmux BEFORE: pane_pid=35820 pane_current_path=.../dirA
re-open slot 2 on dirB (slot is ACTIVE): {"ok":true,"cwd":".../dirB"}
tmux AFTER : pane_pid=35820 pane_current_path=.../dirA
API  AFTER : cwd=.../dirB
pane recreated? NO (same pane_pid) | API cwd === pane cwd? false
```

**Cost.** `tickGit` (704-735) now computes branch/dirty/ahead/head **for a directory nobody is
working in**, and every consumer of those facts — the steward views, the `commit` relay's
`gi.dirty === 0` check (3806), the outcome `gitBaseline` (3888) — describes dirB while the
session lives in dirA. Three riders, all fail-safe individually but each a silent capability loss:
the running pane's baked `FLEET_SELF_TOKEN` is now stale, so its self-scheduling 401s
(1084 vs 1147 vs 4500); `s.sessionId` stays `null` forever, so `tickHarvest` (1757) and
`transcriptFact` (3981) go dark for that slot; `s.model` claims a model the pane never launched.

Note the direction is only *dangerous* for a plain session — `openSlot` sets `worktree = null`,
and `doneLooking` requires `!!s.worktree` (4001), so no lane automation fires on it.

**Proposal:** either refuse (mirror 5541) or make it a real recycle (`killSlot` then open).

---

### D3 — the lane's **recorded base is authoritative for measuring and irrelevant for landing** ⚠️ DANGEROUS

`laneBaseRef` (555-564) prefers `s.worktree.base` with the explicit rationale *"the base recorded
when the lane was forked is authoritative — it survives the primary later moving off the
integration branch, which live re-derivation would not"*, and `tickGit` measures `ahead/behind`
through it (724-731). The ⏫ route does not use it: `const main = await integrationBranch(repo)`
(5182), re-derived live, is what `mergeJob` rebases onto and what `advanceIntegration` advances.

Probe — fork a lane, then move the primary onto another branch, then run the land path:

```
primary HEAD branch at fork time: main
RECORDED lane base (fleet.json worktree.base): {"repo":".../testrepo","branch":"fleet/260725211931-7543",
  "base":"main","baseSha":"1757ecadbd249cfd682a04f99e50fc5ed60cbaac"}
lane HEAD: ea6a605 lane: work
primary HEAD branch now: desk
POST /api/slots/1/merge -> {"running":true}
slot torn down -> the lane LANDED
--- where did the work go? ---
main: 1757eca init
desk: ea6a605 lane: work
```

The lane recorded `base: "main"` and landed on `desk`; `main` never moved. No verify command was
configured, so this is exactly the **unattended** clean path (3315-3361) — the branch choice does
not depend on who clicked.

**Cost.** An unattended land onto a branch the lane never forked from, with a per-lane
`ahead` count that was measured against a different ref than the one that received the commits.
`repoBases` exists to pin the integration branch and is the operational mitigation, but it is
opt-in: a repo with no `repoBases` entry silently follows whatever branch the primary checkout is
sitting on at land time. Dispatcher lanes are the worst case — `tickDispatch` (1489-1490)
deliberately records **no** `base` at all, so both readers re-derive.

**Proposal:** the land path should resolve its target through `laneBaseRef(s)` and refuse (not
silently retarget) when the live integration branch disagrees with the recorded one.

---

### D4 — `lifecycle_op:verify` tells a lane **"Lane gelandet"** and the only reachable case is a lane that did not land ⚠️ DANGEROUS

`renderStewardMessage` carries the design claim (3795-3797): *"A `ref` that doesn't match a real,
currently-true deterministic fact is rejected outright (no 'trust me, that's the state' path) —
this is what makes mislabeling structurally impossible rather than merely audited after the
fact."* Two of the four fact-bearing refs do not honour it:

- `verify` (3811-3814) checks `if (!mergeLast.get(s.id))` — **presence, not status** — then sends
  *"Lane gelandet — führe deine Verifikation aus und melde das Ergebnis."* `blocked`, `error` and
  `resolved` all pass that check, and all three mean *did not land*. Worse, the inverse case is
  nearly unreachable: `handleStewardSend` requires `s.cwd` (3844), and a real land runs
  `landLane` → `killSlot` (961-981), which clears `s.cwd`. The only genuinely-landed state that
  survives is the `landError` teardown failure (3355).
- `handoff` (3809-3810) has **no** check at all and asserts *"Kontext nähert sich der Grenze"* —
  a fact the server does have a proxy for (`transcriptFact`, 3980-3988) and does not consult.

Probe (steward principal token, lane with a `blocked` verdict, lane still active):

```
mergeLast on record: {"status":"blocked","detail":"fake conflict","landed":false,
  "branch":"fleet/260725211514-0d7c","at":1785014129908}
lane still active? cwd=.../testrepo.worktrees/fleet-260725211514-0d7c branch=fleet/260725211514-0d7c
POST /api/steward/send {kind:lifecycle_op, ref:verify} -> 200 {"ok":true,
  "text":"[steward] Lane gelandet — führe deine Verifikation aus und melde das Ergebnis. Verifiziere dein Ergebnis, bevor du fertig meldest."}
control state_relay:merge_resolved (verdict is 'blocked') -> 400 {"error":"no resolved merge verdict on record"}
```

The control line is the point: the `state_relay` refs *are* status-checked, so the guard exists
and works — `lifecycle_op` refs simply skip it.

**Cost.** An unattended steward hands a working session a false premise it cannot check cheaply.
The session verifies a tree that is still sitting on an unlanded, conflict-blocked branch and
reports success; the owner reads a green report about a merge that never happened. The delivery is
gated (rate caps, idle, alive) but the *content* is not, and the steward principal can drive this
route itself (4524 → 4397). No e2e check covers `lifecycle_op:verify` (`e2e/steward-core.ts`
exercises `handoff` at :240 and a bad ref at :271).

**Proposal:** `verify` should require `m.status === "merged" && m.landed`; `handoff` should be
gated on a `transcriptFact` threshold or reworded to drop the factual claim.

---

### D5 — the steward token outlives the steward **label** ⚠️ DANGEROUS (bounded)

`stewardToken` is a single global secret, minted once (3720) and never rotated. `ensureSlot`
bakes it into a pane's env **at spawn**, keyed on `s.label === STEWARD_LABEL` (1090). The auth
gate (4524) compares the offered token against that global — it never asks which slot sent it.
The rename route (5516-5523) changes `s.label` with no respawn and no rotation.

So: a pane spawned while labeled `⚙ steward` keeps full steward-principal authority forever —
after being relabeled, after another slot becomes steward, after the lane's purpose changes. In
the same moment the *automatic* consumers of the label flip: `tickAutoReview` stops skipping it
(2280) and `stewardSlotsView.doneLooking` starts computing for it (4001), so auto-③ will spawn
review agents against the planning worktree.

**VERIFIED by reading only** — I did not run a relabel probe. Cost: an ex-steward pane can still
send server-rendered prompts into any slot and create autos/tasks; and the planning pane starts
attracting unattended reviewers.

**Proposal:** rotate `stewardToken` whenever the steward label moves, and re-derive authority from
the *current* steward slot rather than from a global secret.

---

### D6 — the outcome ledger's `verified` / `confirmedByHuman` on a no-op land — SAFE-ish, listed for completeness

The ⏫ route's "already merged (by hand, or an empty lane)" shortcut (5280-5285) lands with
`OWNER_LAND_FACTS` (`confirmedByHuman: true`, `verified: null`). A lane with **zero** commits is
trivially "merged", so the ledger gets a `landed` row with `commitCount: 0` and a human-confirmed
flag for a land that moved nothing.

Direction is not dangerous *inside the server*: I traced every reader of `LANE_OUTCOME_FILE` and
there is exactly one — the `GET` at 4835. Nothing in-process decides on these rows. The cost is
downstream: the graduation/promotion analysis these rows exist to feed (docs/graduation-criteria.md)
counts a no-op as a confirmed land. Ranked last **because the consumer is a human/agent read, not
an automatic decision** — which is the ranking rule, not a claim that the row is harmless.

---

## 3. The premise, checked: is `lane-signals.ts` really "every clause a negation test"?

The owner's claim, offered as a claim: *"eine Abweichung, die als 'unbekannt/nicht fertig' liest,
ist SICHER — lane-signals.ts ist ausdrücklich so gebaut (jede Klausel ein Negationstest)."*

**Mostly true, with one hole that D1 drives straight through.** Clause by clause
(lane-signals.ts:38-45), for an *unknown* input:

| clause | unknown input | result | conservative? |
|---|---|---|---|
| `alive === true` | `null` | false | ✅ |
| `idleMs !== null && idleMs >= t` | `null` | false | ✅ |
| `gitOp !== true` | `null` | **true** | ❌ permissive |
| `!MERGE_BLOCKING.includes(merge?.status ?? "")` | `null` | **true** | ❌ permissive |
| `git !== null && dirty === 0` | `null` | false | ✅ |
| `git !== null && ahead > 0` | `null` | false | ✅ |

The file's own header names exactly the three it handles (*"null alive, null git, un-ticked
idleMs"*). The two permissive clauses are **masked in practice**, and I checked the masking rather
than assuming it: `gitOpInfo` and `gitInfo` are written by the same `tickGit` pass (709 vs 735)
and deleted together by `openSlot` (1156/1166) and `killSlot` via the `!s.cwd` branch (705), so
`gitOp === null` always co-occurs with `git === null`, which fails clauses 5+6. `merge === null`
is the normal, correct case for a lane that never ran ⏫. So the predicate itself holds up.

**The refutation is one level up, in the input assembly.** `laneSignalView` (3964) computes
`idleMs: s.cwd ? Math.max(0, now - s.lastOutput) : null`. When `lastOutput` is `0` — which is not
"quiet since epoch" but "no output has ever been observed by *this server process*" — the unknown
is laundered into an extreme *known* value before the predicate sees it. The null-safety of
clause 2 never gets a chance to fire. That is D1, and it is the one place where an unknown reads
as maximally-done rather than as not-done.

`laneQuietSince` inherits the same hole verbatim (`return now - v.idleMs`, line 67) and turns it
into a timestamp of `0`.

---

## 4. The two given instances, re-checked

**Instance 1 (`openSlot` on an active slot): confirmed, and it is the dangerous direction.** See
D2 — reproduced in an isolated instance, same `pane_pid`, API `cwd` ≠ `pane_current_path`.

**Instance 2 (lane e5dd: `status:"resolved"`, `detail:"agent answer was not the JSON contract"`
while the rebase was clean): confirmed as a divergence, but it fails SAFE — and the record is
narrower than it reads.** Tracing the two strings to their only writers:

- `status: "resolved"` is written at exactly one site, `mergeJob` 3293-3295, reachable **only**
  under `if (!pre.clean)` (3280) — i.e. the server's own script pre-pass (`tryScriptRebase`) hit
  conflicts and the agent was spawned. So the recorded "there were conflicts" is true; what was
  clean is the *outcome*, not the *attempt*.
- `agent answer was not the JSON contract:` comes from `runMerge` 3110 and rides in as `r.detail`.
- Reaching 3293 at all means the git verification at 3234-3236 **passed** (clean tree AND `main`
  an ancestor of the branch) — the off-contract path that does *not* verify writes
  `status: "error"` instead (3238-3239).

So the row is internally consistent: *conflicts existed, the agent's prose answer was unusable,
git independently confirmed the rebase, stop for a human.* The defect is that the `detail` field
leads with the agent's contract failure, so a reader — human or model — reads "the merge agent
failed" where the server actually means "verified, but unreviewed". Direction: **SAFE** — it
downgrades to stop-and-review, costing a lane's wait, never a bad land. The one automatic
consumer worth naming: `"resolved"` is deliberately *not* in `MERGE_BLOCKING`
(lane-signals.ts:26), so such a lane still reads `doneLooking: true` and auto-③ will review it.
That is intended (③ is advisory) but it is the only automation that acts on this state.

**This partially refutes the framing that instance 2 is the same class as instance 1.** Both are
protocol-vs-reality gaps; only instance 1 points the dangerous way.

---

## 5. Probes — run, and not run

**Run** (isolated instance: own tmux socket `fleetprobe$$`, port `8600+$$%150`, `FLEET_CMD=true`,
`FLEET_AUTO_REVIEW_MS=0` so no real agent could spawn; the live socket/port never touched):

| probe | proves | result |
|---|---|---|
| P1/P1b | D1 — restart flips a lane to done-looking / quiet-since-1970 with every other clause identical | quoted in D1 |
| P2 | D2 — `open` on an active slot leaves `pane_pid` and `pane_current_path` untouched | quoted in D2 |
| P3 | D4 — `lifecycle_op:verify` returns 200 + "Lane gelandet" over a `blocked` verdict; the `state_relay` control returns 400 | quoted in D4 |
| P4 | D3 — a lane recording `base:"main"` lands onto `desk` | quoted in D3 |

**Not run** (each with the probe that would settle it):
- **D5** — relabel a `⚙ steward` slot, then call `/api/steward/send` with the token still baked
  in that pane's env; expect 200. Also assert `tickAutoReview` now considers the slot. Not run
  because it needs a second pane and a label round-trip; the code path is short and fully read.
- **D1's `canDeliver` half** — I proved the *fact* (`idleMs`) diverges, not that an
  `idleSec: 600` auto actually fires post-restart. Probe: create such an auto, emit pane output,
  restart srv, watch `lastResult` flip to `sent` within one `tickAutos`.
- **D1's auto-③ half** — that a deploy re-spawns reviewers on already-reviewed lanes. Probe:
  `FLEET_REVIEW_CMD` stand-in counting runs per cwd (the pattern `e2e-isolated.sh` already uses),
  restart, assert the count for an unchanged git state increments.
- **D6** — land an empty lane through ⏫ and read the emitted row. Cheap; skipped because the
  finding has no in-server automatic consumer and I would rather not spend the run.

---

## 6. What would make this class structurally harder (no code changed in this lane)

1. **An unknown must stay unknown at the boundary, not at the predicate.** D1 exists because a
   sentinel (`0`) crossed into a numeric fact. The rule that would have caught it: any field a
   deterministic gate reads must have a distinct "not observed" value, and `laneSignalView` is the
   one place to enforce it.
2. **Facts that gate an action must be re-derived at the action, not read from a record** — or the
   record must be the only reader. D3 is the same fact (`the lane's base`) answered two ways by
   two sites; D2 is a record that outlived its subject.
3. **A guard that claims totality should be enumerated in a test.** D4's comment asserts every
   `ref` is fact-checked; two are not, and no e2e check names `verify`. A table-driven check over
   every `(kind, ref)` pair — each with a state where it must be refused — turns that comment into
   a gate.
