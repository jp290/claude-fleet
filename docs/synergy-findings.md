# Synergy findings — deterministic facts computed but not shared (2026-07-22)

*A producer/consumer audit of Fleet: where one part computes a deterministic fact that
another part re-infers, is never handed, or duplicates — and where two mechanisms are
"secretly one lever." Extends `automation-synergies.md` (the why) with a ranked, evidence-
cited **backlog to prune**, not a plan to execute. Method: four parallel agents mapped
`server.ts`/`src/client.ts` by cluster (git/state, model-helpers, scheduling/lifecycle,
event-substrate) against six shapes — re-derivation, withheld-signal, cross-boundary
duplication, unused-output, secretly-one-lever, unreused-choke-point. Propose-not-assert;
**verify each line ref before building** (CLAUDE.md — one claim here was already wrong on
first pass and caught only by re-reading the code). Load-bearing safety/enabler claims were
re-verified by hand and are tagged **[verified]**; others are agent-cited **[agent]**.*

---

## The one structural root

**RESOLVED (2026-07-22) — `canDeliver()` extracted; the fix below landed.** The pre-send
delivery gate was hand-reimplemented four times, each a different subset (`server.ts`): full in
`tickAutos`, **claudeAlive+idle only** in `handleStewardSend`, **absent** in `tickDispatch`,
idle-only in the merge path. That drift **was** the cause of the Tier-0 safety seams #1/#2 below.
A single guarded `canDeliver(s, opts)` choke-point now encodes, in order, kill-switch
(`autosOn`) → fresh `claudeAlive` → quiet-hours → idle, and returns the first failing gate so
each caller keeps its bespoke reaction. All four actors route through it: `tickAutos`
(`killSwitch:false` because the tick-level `if (!autosOn) return` early return already handles it),
`handleStewardSend`, `tickDispatch` (pre-gate before a lane is spawned + fresh
`claudeAlive` re-gate after the boot sleep), and the merge/land idle guard (`landGate`,
idle-only). Each passes `opts` for its legitimate differences (one-shots waive quiet-hours; the
owner land waives all but idle; a fresh dispatch lane waives idle). Mirrors the pre-existing
`createAutoForSlot` choke-point pattern. Seams #1, #2 and #3 are all closed and
e2e-proven.

## Tier 0 — safety seams (the "master stop" isn't master). Low risk, high trust value.

1. **CLOSED (2026-07-22) — the kill-switch and quiet-hours now stop a direct steward nudge AND
   the dispatcher.** `canDeliver` is checked in `handleStewardSend` (returns 409
   `paused` / `quiet hours`) and in the dispatcher's pre-gate — the master stop +
   quiet-hours refuse *before* a lane is spawned, so the queued task stays queued. `dispatchOn`
   was deliberately decided to fall under master `autosOn`. Proven in `fleet-e2e.ts` (steward
   `autosOn=false`/quiet 409 tests; dispatch `autosOn=false`/quiet stay-queued tests, with a
   both-gates-open positive control so "stays queued" is non-tautological). Was: `autosOn` read
   only inside `tickAutos`, `inQuietHours` only there; `handleStewardSend`/`tickDispatch` checked
   neither.
2. **CLOSED (2026-07-22) — the dispatcher now runs a FRESH `claudeAlive` gate before pasting task
   text.** After the 4s boot sleep + cwd re-verify (grep `still OUR lane`), `canDeliver(free, {idleMs:0})`
   re-checks master-stop + quiet-hours + a fresh alive read and requeues the task on any
   failure, so a claude that failed to boot (the launchd PATH footgun in CLAUDE.md) never has
   external `/intake` text executed as shell commands at the bare `slotCmd` shell (`claude;
   exec $SHELL`). The gated `sendText(free, next.text)` follows immediately. Note the gate calls
   `claudeAlive` **fresh**, never the read-route cache (Tier 1) — a stale cache defeats the exact
   race it closes. The freshness contract is e2e-PROVEN since the Tier-1 lane:
   `fleet-e2e-claude-gate.ts` branch 4 builds a cache-alive-but-actually-dead pane and asserts
   the send gate refuses while the cached reading still says alive.
3. **CLOSED (2026-07-22) — the send caps now count across the audit rotation boundary.**
   `stewardRecentSends` spans `[audit.jsonl.1, audit.jsonl]` — the same two-generation
   read as `readStewardJournal` — so the hourly/episode counters no longer reset
   toward zero right after `appendEvent` rotates at 5 MB. Was: the cap reader scanned
   the live `AUDIT_FILE` alone. The durable send-cap is the invariant `automation-synergies.md`
   §2 calls the injection endgame, so this was a hole under a safety guarantee. Proven in
   `fleet-e2e.ts`: a rotation is simulated mid-window (the exact `renameSync → .1` appendEvent
   does) and the episode cap still refuses (429) on the pre-rotation send; with a cap's worth
   of pre-rotation sends in `.1`, the hourly cap still refuses a different-kind send.

## Tier 1 — signal quality (the steward reasons from facts, not guesses). Low risk.

*This is `steward-overview.md`'s signal lever, now with the producers located. Each is a
read-only widening — no new write path, near-zero risk. "Verify against real state"
(`OWNER.md` §2) applied to the steward's own senses.*

***BUILT 2026-07-22 (this lane), except the deferred classifier and the advisory summarizer
fields:*** *`/api/steward/sessions` now ships, per slot, the cached `alive` + `gitOp`,
server-computed `idleMs`, the FULL `merge` verdict (`stewardMergeView`:
status/detail/conflicted/at), and the lane's founding `task` (`stewardTaskView`:
id/status/source/text); the per-slot `/brief` carries `merge` + `task` too. Freshness contract
held and e2e-proven: `aliveInfo`/`gitOpInfo` are ~10s `tickGit` caches serving READS only —
every delivery gate still calls `claudeAlive` fresh inside `canDeliver`, proven by
`fleet-e2e-claude-gate.ts` branch 4 (cache-alive-but-dead pane → send refused).*

- **Server-side lane `condition` classifier — deferred, and narrower than it first looked.**
  **[re-examined 2026-07-22, verified]** No classifier exists server-side (still true), but two
  corrections to the original framing drop this out of the early set. (a) The git-derived 3-way
  (`dirty?editing:ahead?ready:clean`) is **not a withheld signal**: `/api/steward/sessions`
  already ships the full `git{branch,dirty,ahead,behind}` object per slot (`stewardSlotsView` in server.ts),
  so the steward derives the 3-way in one line from inputs it *already holds* — not statistical
  guessing. (b) That 3-way is **not the taxonomy the pulse runs on**: `rundgang.md:14` classifies
  `healthy-running / done-looking / stalled-dirty / stuck-looping / awaiting-human / unknown`, and
  *none* of those fall out of git alone — `done-looking`/`awaiting-human` need `claudeAlive`
  (below), and `stuck-looping` needs an output-rate signal **nobody has built**. So "ship the git
  subset first" would deliver a value the steward doesn't need in a vocabulary the pulse doesn't
  speak. *Revised plan: no early classifier. Surface `claudeAlive` + the genuinely-withheld
  verdicts first (`mergeLast`/`Task`/`gitOp`); let the pulse keep deriving `condition` in-LLM from
  now-complete inputs; build a real classifier only later, against the actual 6-way, and only once
  a `stuck-looping` detector exists.*
- **DONE (2026-07-22) — `claudeAlive` on the read routes; one signal, two consumers, two
  freshness contracts.** **[verified]** Computed by `claudeAlive`; cached per slot in `tickGit`'s loop
  (`aliveInfo`, refreshed each ~10s tick — never the 2–3 `ps`/`pgrep` spawns inline per
  100 ms poll) and surfaced as `alive` on `/api/steward/sessions`. It disambiguates the steward's
  `awaiting-human`/`done`/`dead` blob **and** gives Tier-0 #2 its safety gate. The cache serves
  the **senses**, not the **gates**: every delivery/dispatch gate still awaits `claudeAlive`
  **fresh** (inside `canDeliver`) because `tickGit` runs only every 10 s — a
  gate reading the cache could fire a nudge, or a bare-shell dispatch (Tier-0 #2), into a pane
  that died 9 s ago. Cache-for-reads/fresh-for-gates is e2e-proven (`fleet-e2e-claude-gate.ts`
  branch 4).
- **DONE (2026-07-22) — full `mergeLast` verdict to the steward's senses.** **[verified,
  triple-confirmed]** A failed (`error`)/refused (`blocked`) land is a top "needs decision"
  item; the steward previously saw only `mergePending = status==="resolved"` — while
  `renderStewardMessage` *already reads the full verdict* server-side to relay it. Now
  `stewardMergeView` puts {status, detail, conflicted, at} on the steward sessions +
  brief routes.
- **Surface the summarizer's `verification` + `openThreads` (advisory).** **[verified fields]**
  `runSummary` already extracts "which checks/tests/builds ran + results" and "started-but-
  unfinished" — the steward's exact `done-looking`/did-it-verify signals — but they die in a
  client-only in-memory cache (`summaryCache`, lost on deploy). LLM-derived, so hand to the
  steward as **advisory context, never a gate input** ("advisors inform, gates decide").
- **DONE (2026-07-22) — `idleMs`, `gitOp`, and `Task` status on the overview.** **[agent]**
  `/api/steward/sessions` now publishes raw `idleMs` (server-computed `now−lastOutput`);
  thresholds stay local (`3000`/`60000`/`idleSec` are *intentionally* different policies, not a
  bug). `gitOp` (wedged rebase, a hard `awaiting-human`) is cached in `tickGit`
  (`gitOpInfo`) fleet-wide; the lane's founding `Task` (the baseline "done-*looking* vs done") rides
  along via `stewardTaskView`.

## Tier 2 — capability enablers (the roadmap). Medium.

- **`summaryViaSession` is a ready-made steward digest engine — and it fixes context-drain.
  BUILT 2026-07-22.** `GET /api/steward/digest` (steward-scoped): the server composes
  prior-journal + the Tier-1 slots view (`stewardSlotsView`), an ephemeral worker
  (`runStewardDigest`, `FLEET_DIGEST_CMD` stand-in in e2e) does sense+interpret outside the
  pane's context, the verdict comes back clamped (`clampDigest`: 6-way condition whitelist,
  list/length caps) and ADVISORY — the route always carries the deterministic payload
  alongside, and `digest:null` on any worker failure keeps the pulse independent of the
  worker. Concurrent pulses share one inflight run. The worker holds no token: it cannot
  send, schedule, or journal by construction (Finding-3 guard).
- **Per-session model selection (Opus/Fable lanes). BUILT 2026-07-22** (the `Slot.model` half):
  `Slot.model` (charset-validated `MODEL_RE` — the value lands in a tmux shell line) threads
  through `openSlot`/`openLaneInSlot` → `slotCmd` appends `--model <m>` when `FLEET_CMD` is
  claude; settable on `POST /api/lanes`, `open`, `open-worktree`; persisted with the slot,
  cleared on kill/recycle; echoed on the owner + steward session reads. Spawn-string proven in
  the claude-gate suite. Subscription-safe (interactive `claude`, never `-p`). The
  `summaryViaSession` `model` opt (per-worker model) remains unbuilt.
- **A steward brief and a queued `Task` are the same object.** **[verified path absent]** The
  steward *produces* briefs but `handleStewardRoute` exposes no task-file route, and the
  dispatcher injects `Task.text` raw. Wire the steward to file a **`pending`** Task (owner still
  promotes via `POST /api/tasks/:id/queue` (`taskAct`), dispatcher stays deterministic) + add a structured `brief`/`verifyCmd`
  field on `Task`. This is the outsourcing trajectory **without** tripping the anti-synergy —
  promotion stays owner-gated, briefs proven before scheduling.

## Tier 3 — learning-loop fuel (foundational for the ladder, §4). Medium effort.

- **Intervention OUTCOMES — the ladder's fuel. BUILT 2026-07-22 (fuel + criterion; ladder wiring future).**
  **[agent]** *Was:* `audit.jsonl` logged every `steward_send` but no outcome; §4 needs "N interventions
  of a class with a clean helped/no-harm record" and that data was written nowhere. *Now:* every steward
  send parks a persisted pending-outcome baseline (`handleStewardSend` in server.ts); a window-close
  pass folded into `tickGit` (`measureOutcomes` in server.ts) classifies it DETERMINISTICALLY — helped
  = git delta OR sustained output; else no-effect (ambiguous → no-effect, conservative) — and increments a
  durable per-class tally `{helped,noEffect,harmed}` in persisted state (`outcomeTally`, read by the ladder,
  NEVER a journal scan — §3). `harmed` is OWNER-supplied only via `POST /api/steward/outcomes/harm`
  (server.ts, grep `/api/steward/outcomes/harm`); a deterministic `claudeAlive` true→false-in-window is a crash CANDIDATE escalated to
  the owner, never an auto harm label (§6). The promotion predicate `promotionEligible` (`server.ts`, gauge
  at `GET /api/steward/outcomes`) requires `helped ≥ N AND harmed == 0 AND` the harm channel has operated —
  never eligible on a harm-blind record. **Deferred (documented, not hidden):** reply-referencing detection —
  its absence under-counts `helped` (a pure reply/Q&A intervention records as no-effect), which is CONSERVATIVE
  (delays a promotion, never enables a wrong one). The autonomy *ladder wiring itself* is still future — only
  the fuel + criterion shipped.
- **`auto_skip` streaks and capped-demand are surfaced nowhere but the raw `/api/audit` dump.**
  "This auto skipped 6× running" / "the steward hit the episode cap 4× wanting slot 3" are
  derivable and are exactly the self-model's demand signal.

## Anti-synergies — keep these apart (do NOT "fix")

- **`laneCondition`/`canLand` inform, never gate.** They feed the steward + UI; land stays the
  deterministic `removeWorktreeSafe`/`advanceIntegration` path. Same line `automation-synergies.md`
  draws around the dispatcher. A soft LLM/derived gate on land is the regression `land` avoided.
- **Dispatcher promotion stays owner-gated.** The steward files `pending`; the owner promotes.
- **The autos `text` path stays free-text.** `renderStewardMessage`'s anti-spoof typing is for
  *live* nudges; self-scheduling's purpose is arbitrary future prompts — don't type-lock it.
- **Don't over-model `gitInfo` into the idle/nudge gates.** The `lastOutput` idle gate is a
  deliberate coarse proxy; richer gating here is the over-fitting `automation-synergies.md`
  finding 2 warns against. Flag, don't build.
- **Low-value cleanups, not capability:** the JSON-unwrap dance duplicated 5× (a shared
  `extractJsonObject` exists, only `enhance` uses it) and `laneTask` recomputed 3×. Fold into
  adjacent work if touched; don't schedule alone.

## If you do three things

1. **Tier-0 `canDeliver()` choke-point** — closes seams #1/#2 structurally and drift-proofs
   every future delivery path. Highest safety-per-effort.
2. **DONE (2026-07-22) — Tier-1 `claudeAlive` + full `mergeLast` + `Task`/`gitOp` on the steward
   routes** — the biggest jump in the steward's judgment quality, near-zero risk, and
   `claudeAlive` doubles as Tier-0 #2's gate. The `condition` classifier is **not** in this set
   (see Tier 1): its git subset is already derivable and its real conditions need a
   `stuck-looping` detector nobody has built.
3. **Tier-2 `summaryViaSession` as the digest engine** — **DONE 2026-07-22** (`GET
   /api/steward/digest`, see Tier 2): the impact-library loop proven on one real item, and
   context-drain fixed.

*Everything above is reversible/low-blast to build (worktree-isolated, owner reviews at land) —
so per the 2026-07-22 doctrine it's act-freely territory to prototype; only the permanent gates
(`OWNER.md` §4) stay fixed. Rank shifts with evidence.*
