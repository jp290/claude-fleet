# Deep assessment — structural issues, loose ends, improvements (2026-07-22)

*Full-tree assessment run 2026-07-22/23. Base: `0642fde`; every still-open finding
**re-verified at `cad0396`** (11 commits landed mid-assessment — see §5, "resolved in
parallel"). Line refs cite `cad0396` unless marked `@0642fde`. Symbols are the anchor;
lines drift — re-grep the symbol before editing. Claims carry **[verified]** (read at the
stated lines this assessment) or **[inferred]** (reasoned, not re-read at HEAD).*

**For the executing session:** each finding has a fix sketch and a done-criterion.
Work the ranked list in §6 top-down. §5 lists what parallel lanes already fixed —
do NOT redo those. §7 lists new surface this assessment never read — don't assume
it's covered.

## 1. Method / provenance

- Read in full at `0642fde`: `server.ts` (3809 lines, main session), `src/client.ts` +
  `src/share.ts` + `src/md.ts` (agent sweep), all 14 shelf docs verified claim-by-claim
  against code (agent sweep), `fleet-e2e.ts` + `e2e-isolated.sh` + `e2e-claude-gate.sh` +
  `fleet-e2e-claude-gate.ts` + `steward-arena.sh` (agent sweep).
- Nothing executed except `bunx tsc --noEmit --strict …` → clean, exit 0. No e2e run
  (shared-socket hazard, live fleet up). All findings are static reads.
- Not examined: `watchdog.sh`, `public/index.html` beyond greps, `OWNER.md`,
  runtime behavior of any path, and everything in §7 (landed after the read).

## 2. Architecture read (what the assessment concluded before judging)

Three levels, and per level the question "what enforces the invariant":

- **Substrate** — 16 fixed slots ↔ tmux sessions on one socket; pipe-pane `.raw`
  files as byte-truth; `fleet.json` via tmp+rename (crash can't tear state); watchdog
  respawn. Every invariant here is **code-enforced**. Solid.
- **Mechanism** — every *unattended* prompt funnels through `canDeliver()`
  (kill-switch → fresh claude-alive → quiet hours → idle; 5 call sites: tickAutos,
  dispatcher pre+post, steward send, land idle-guard). Land spine is git-truth:
  agent claims re-verified via `merge-base --is-ancestor` + clean tree; main only
  moves by ff; undo is ancestry- and remote-gated. Steward writes = three
  server-rendered templates with fact-checked refs, free text rejected.
- **Convention** — the honest layer: nothing structurally forces the *next* send
  path through `canDeliver()` (the comment above it overclaims "can never again";
  the real mechanism is discipline + tests). And "resolved conflicts get a human
  eye" is server-guarded only against *accidental* re-run landing; `confirm:true`
  is a body flag — the human-ness of review lives entirely in the client UI.

**Thesis** (the one-sentence substrate read): the server has internalized
fail-closed / believe-git / choke-point-everything — **the client and the
verification layer haven't caught up to the server's own doctrine.** The next unit
of safety per hour is not another server gate; it is making existing gates provable
and their client-side faces fail closed.

## 3. Still-open findings (re-verified at `cad0396`, ranked)

### F1 — pre-land review fails open **[verified]** — `src/client.ts:905-906` (`showLandReview`), `src/client.ts:2347-2352` (`openMergeDiff`)
`api(…merge-diff).then(r => r.json()).catch(() => ({}))` — a dropped fetch or
non-JSON body yields `{}`, no `error` field, and the overlay renders **"no committed
changes to land — landing just cleans up the worktree"** with ⏏ enabled, which sends
`{confirm:true}` (`doMergeLand`, client.ts:744) — the flag the server treats as "a
human reviewed this". Fleet is used from a phone over Tailscale; failed fetches are
the normal case. The fail-closed pattern already exists in-file: `fetchSlotRisk`
returns `UNKNOWN_RISK` on the same failure (client.ts:676-684 @0642fde).
**Cost:** agent-chosen conflict resolutions land on real main with zero human eyes —
the one event the risk doctrine (docs/steward-intelligence.md) permanently
human-gates. **Fix:** treat fetch failure as its own overlay state — ⏏ disabled,
"couldn't load the diff — retry". **Done when:** a killed fetch (devtools offline or
a test stub) shows the disabled state; no path renders the "just cleans up" line
without a successful 200+JSON.

### F2 — the highest-blast gate branches are still unverified **[verified]**
1. **Dispatcher post-spawn re-check** (`server.ts`, `tickDispatch`, the `canDeliver`
   call after the 4s boot sleep + the "slot changed during spawn" guard): the guard
   that stops externally-sourced intake text being typed into a bare shell (= executed
   as commands). Structurally untestable today: `e2e-isolated.sh` runs `FLEET_CMD=true`
   (claudeAlive short-circuits), `e2e-claude-gate.sh` sets no `FLEET_DISPATCH_REPO`.
   The gate suite already builds real dead/alive fake `claude` binaries — extend it
   with a `FLEET_DISPATCH_REPO` scenario asserting the requeue
   (`"dispatch held (…) — requeued"`) and that nothing reached the pane.
2. **landGate busy block** (merge route, `canDeliver(..., idleMs: MERGE_IDLE_MS)`):
   no assertion anywhere — every merge test calls `settleForMerge` first; deleting
   the gate passes all 291 checks. Add one test: fresh pane output → merge POST →
   expect `status:"blocked"` "actively working".
3. **Steward transcript redaction** (`handleStewardRoute` transcript branch:
   thinking stripped, tool_results trimmed to 400): still asserted `.ok`-only
   (fleet-e2e.ts:1781 area). Assert values: no `t:"thinking"` block present, a
   long tool_result comes back ≤ ~420 chars.
   (The steward-send not-alive branch is now covered — see §5.)
**Cost:** silent regressions in exactly the code whose failure is command execution
or containment breach. **Done when:** each of the three has a test that fails when
its guard is deleted.

### F3 — residual doc rot **[verified at cad0396]**
Most of the assessment's doc-rot findings were fixed by parallel lanes (§5). Still stale:
- `docs/steward-arena.md:7-8` — header still says "a proposal to reason from, not
  built code"; shape A exists as `steward-arena.sh` (260 lines, `eac9fee`).
- `CLAUDE.md` (lane-discipline block) — the known e2e flake is cited at
  "fleet-e2e.ts:1098"; the check now lives near fleet-e2e.ts:1376+ (line 1098 is a
  `Bun.write`). Anyone triaging by that ref lands in the wrong code. Cite the check
  NAME (`FLEET_SELF_TOKEN absent for a non-lane slot`), not a line.
- `docs/operating-model.md` — untouched by the parallel lanes; its gate description
  (**@0642fde:108-109**, "the Auto's two gates live in tickAutos") predates
  `canDeliver` by a generation — it never mentions the kill-switch, quiet hours, or
  the choke-point. Behavior claims all verified true; line refs drifted en masse
  (doc self-flags this). Rewrite the gate paragraph around `canDeliver`.
- `docs/README.md` index omits `steward-arena.md` and `lane-autonomy-future.md`
  despite claiming one line per doc.
**Cost:** the shelf is the steward's loaded system model — stale entries make a
confidently wrong planner. **Done when:** the four items above match the tree.

### F4 — cross-slot chat leak in `pollChat` **[verified]** — `src/client.ts:404-435`, `resetChat` at 286
`pollChat` guards transcript-source *changes* (`if (this.chatSource !== null &&
data.source !== this.chatSource)`) but not pane **reassignment**: `assign()` →
`resetChat()` clears `chatSource` to null and does NOT cancel the in-flight fetch or
clear `chatBusy`; when the old slot's response resolves, the null source skips the
guard, the old slot's entries append into the chat view now showing the NEW slot, and
`chatTotal` is corrupted with the old slot's cursor. `renderBoard` guards exactly this
class (`if (panes[focused]?.slot !== slot) …` client.ts:1493 @0642fde); `pollChat` has
no equivalent. **Cost:** wrong session's transcript under another session's header —
the trust-eroding marker-drift class. **Fix:** capture `const slot = this.slot` before
the fetch, and after the await bail if `this.slot !== slot`. **Done when:** that guard
exists and `resetChat` also resets `chatBusy`.

### F5 — merge-job state bleeds across slot recycle **[verified]** — `server.ts:2101` (`mergeInflight`), `:2105` (`mergeStart`)
`openSlot`/`killSlot` clear `mergeLast` but never `mergeInflight`/`mergeStart` — a
slot recycled mid-merge-job reports `running:true` for the NEW lane until the old
job's `finally` fires, and 409s its commit route meanwhile. `mergeJob` itself already
guards verdict-writes against recycle; this is the one recycle-hygiene item the
otherwise-thorough teardown missed. Low cost, small window. **Fix:** on
`openSlot`/`killSlot`, drop the slot's entries (the job's `finally` already
self-checks identity via `mergeInflight.get(s.id) === job`). **Done when:** recycling
a slot mid-merge leaves the new lane's merge GET `running:false`.

## 4. Loose ends (smaller, mostly @0642fde — client.ts changed only +8/-3 since, so [inferred] still present unless noted)

- `doCommit` sets `commitBusy` AFTER the `confirmMidRun` await (**[verified at
  cad0396]**, `src/client.ts` `doCommit`) — two near-simultaneous triggers both pass
  the `has()` check; `doLand` fixed this exact bug with a comment. Move the `set`
  before the await (or reserve synchronously like `doLand`).
- Task-add discards typed text on failure unconditionally (`renderQueue` addBtn
  @0642fde:2393-2401), contradicting the in-file "text stays in the box on failure"
  pattern (doSend). ~8 more mutation handlers never check `res.ok` (dispatch toggle,
  task queue/unqueue/done/delete, auto toggle/delete, share mode/rotate/revoke,
  comment delete) — non-destructive (views re-derive from refresh) but silent.
- Untested verbs: `POST /api/tasks/:id/done` zero coverage; auto `toggle` only
  indirect; `/resize` only its no-op case.
- Stream `.raw` files grow unbounded per live slot (5.7MB observed on s11); only
  `killSlot` deletes. Truncate-and-reseed past a threshold (reseed path exists in
  `ensureSlot`).
- `shelved` notes leak if a worktree is removed out-of-band (only
  `removeWorktreeSafe`/discard delete the note).
- Duplicated client code: `TBlock`/`TEntry`, `fmtClock`, WS chunk loop copy-pasted
  between `client.ts` and `share.ts` — protocol changes hand-sync two files.
- tickAutos quiet-hours skip isn't audited (other skips are) — observability only.
- `steward-arena.sh` accepted-risk residue (its header owns these): `node_modules`
  symlinks into the operating repo (arena agents can write through it); socket guard
  covers only `claudefleet`, not `fleettest`/`fleetgatetest`; arena brief types the
  arena owner token into a `--dangerously-skip-permissions` pane.
- Sweep-verdict removal is **clean** — no dead code; `.sweepv` CSS reuse for shelve
  notes is intentional (commit message says so). Don't "clean it up".

## 5. Resolved in parallel while this assessment ran (0642fde..cad0396) — do NOT redo

- **Tier-0 #3** — `stewardRecentSends` now reads `audit.jsonl.1` across rotation
  (`e963307`), with e2e coverage. Was this assessment's improvement #4.
- **Steward-send not-alive branch tested** — gate suite now asserts the 409 AND that
  nothing reached the bare shell (`fleet-e2e-claude-gate.ts:166-179`), plus the
  cache-for-reads/fresh-for-gates invariant (`:116-130`).
- **Tier-1 signal surface** landed with its docs (`9fa3c92`): `alive`/`gitOp`/`idleMs`/
  full merge verdict/Task on steward reads — the "claudeAlive is withheld" doc-rot
  cluster is moot.
- **HANDOFF.md rewritten and accurate** (`c455296`, `f95efe4`, `8496ab9`) — the
  open-seam misclaim is gone.

## 6. Ranked improvements (top-down for the executing session)

1. **Fail the land-review closed** (F1). ~15 lines in `showLandReview`/`openMergeDiff`,
   pattern exists (`UNKNOWN_RISK`). Verify: e2e or manual offline-fetch → ⏏ disabled.
2. **Make the three unproven gates provable** (F2): dispatcher-post-gate scenario in
   the gate suite, landGate busy assertion, redaction value-assertions. Verify: each
   test fails when its guard is commented out; both suites tail "ALL PASS".
3. **Doc-reconcile the four residuals** (F3): arena header, CLAUDE.md flake ref
   (name not line), operating-model.md gate paragraph, README index lines. Verify:
   grep each old claim → gone.
4. **Client recycle/race hygiene** (F4 + doCommit + task-add): pollChat slot guard +
   chatBusy reset, commitBusy before await, `res.ok` checks on the silent handlers.
   Verify: tsc clean + e2e; the pollChat fix is UI-only (no e2e coverage exists —
   say so in the lane report rather than claiming tested).
5. **Server recycle + growth hygiene** (F5 + streams): clear mergeInflight/mergeStart
   on recycle; `.raw` truncate-and-reseed past threshold. Verify: e2e (add a recycle-
   mid-merge check), stream file shrinks after threshold crossing.

Lane notes: items 1+4 are client-only (bundle rebuild needed before deploy); item 2
touches only test files + maybe `e2e-claude-gate.sh`; item 3 is docs-only — per the
lane/main doc-collision rule, reconcile against the main checkout's working copy
before landing.

## 7. Surface this assessment did NOT read (landed 0642fde..cad0396 — unassessed)

`f47fca1` intervention-outcome tally (+183 server lines), `15867ef` digest engine
(+114), `3b32f86`/`9a18798` steward pending-task filing + per-slot model (+82),
plus their e2e. ~400 new server.ts lines with zero assessment coverage. The next
deep pass should start here — same method: read first, verify enforcement, check
what the harnesses can actually exercise.
