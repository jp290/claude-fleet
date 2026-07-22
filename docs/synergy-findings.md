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
A single guarded `canDeliver(s, opts)` choke-point (`1216`) now encodes, in order, kill-switch
(`autosOn`) → fresh `claudeAlive` → quiet-hours → idle, and returns the first failing gate so
each caller keeps its bespoke reaction. All four actors route through it: `tickAutos` (`1251`,
`killSwitch:false` because the tick-level early return at `1232` already handles it),
`handleStewardSend` (`2702`), `tickDispatch` (pre-gate `1326` before a lane is spawned + fresh
`claudeAlive` re-gate `1353` after the boot sleep), and the merge/land idle guard (`3521`,
idle-only). Each passes `opts` for its legitimate differences (one-shots waive quiet-hours; the
owner land waives all but idle; a fresh dispatch lane waives idle). Mirrors the pre-existing
`createAutoForSlot` (`1136`) choke-point pattern. Seams #1, #2 and #3 are all closed and
e2e-proven.

## Tier 0 — safety seams (the "master stop" isn't master). Low risk, high trust value.

1. **CLOSED (2026-07-22) — the kill-switch and quiet-hours now stop a direct steward nudge AND
   the dispatcher.** `canDeliver` (`1216`) is checked in `handleStewardSend` (`2702`, returns 409
   `paused` / `quiet hours`) and in the dispatcher's pre-gate (`1326`) — the master stop +
   quiet-hours refuse *before* a lane is spawned, so the queued task stays queued. `dispatchOn`
   was deliberately decided to fall under master `autosOn`. Proven in `fleet-e2e.ts` (steward
   `autosOn=false`/quiet 409 tests; dispatch `autosOn=false`/quiet stay-queued tests, with a
   both-gates-open positive control so "stays queued" is non-tautological). Was: `autosOn` read
   only inside `tickAutos`, `inQuietHours` only there; `handleStewardSend`/`tickDispatch` checked
   neither.
2. **CLOSED (2026-07-22) — the dispatcher now runs a FRESH `claudeAlive` gate before pasting task
   text.** After the 4s boot sleep + cwd re-verify (`1343`), `canDeliver(free, {idleMs:0})`
   (`1353`) re-checks master-stop + quiet-hours + a fresh alive read and requeues the task on any
   failure, so a claude that failed to boot (the launchd PATH footgun in CLAUDE.md) never has
   external `/intake` text executed as shell commands at the bare `slotCmd` shell (`40`, `claude;
   exec $SHELL`). The gated `sendText(free, next.text)` is now at `1360`. Note the gate calls
   `claudeAlive` **fresh**, never the read-route cache (Tier 1) — a stale cache defeats the exact
   race it closes.
3. **CLOSED (2026-07-22) — the send caps now count across the audit rotation boundary.**
   `stewardRecentSends` (`227`) spans `[audit.jsonl.1, audit.jsonl]` — the same two-generation
   read as `readStewardJournal` (`2758`) — so the hourly/episode counters no longer reset
   toward zero right after `appendEvent` rotates at 5 MB (`332`). Was: the cap reader scanned
   the live `AUDIT_FILE` alone. The durable send-cap is the invariant `automation-synergies.md`
   §2 calls the injection endgame, so this was a hole under a safety guarantee. Proven in
   `fleet-e2e.ts`: a rotation is simulated mid-window (the exact `renameSync → .1` appendEvent
   does) and the episode cap still refuses (429) on the pre-rotation send; with a cap's worth
   of pre-rotation sends in `.1`, the hourly cap still refuses a different-kind send.

## Tier 1 — signal quality (the steward reasons from facts, not guesses). Low risk.

*This is `steward-overview.md`'s signal lever, now with the producers located. Each is a
read-only widening — no new write path, near-zero risk. "Verify against real state"
(`OWNER.md` §2) applied to the steward's own senses.*

- **Server-side lane `condition` classifier — deferred, and narrower than it first looked.**
  **[re-examined 2026-07-22, verified]** No classifier exists server-side (still true), but two
  corrections to the original framing drop this out of the early set. (a) The git-derived 3-way
  (`dirty?editing:ahead?ready:clean`) is **not a withheld signal**: `/api/steward/sessions`
  already ships the full `git{branch,dirty,ahead,behind}` object per slot (`server.ts:2774–2778`),
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
- **Surface `claudeAlive` on the read routes — one signal, two consumers, two freshness
  contracts.** **[verified]** Computed at `1103`, consumed only by write-gates; absent from every
  overview. It disambiguates the steward's `awaiting-human`/`done`/`dead` blob **and** gives
  Tier-0 #2 its safety gate. *Fold into `tickGit`'s per-slot loop and cache **for the read route**
  — do NOT call the 2–3 `ps`/`pgrep` spawns inline per 100 ms poll. But the cache serves the
  **senses**, not the **gates**: the delivery/dispatch gates await `claudeAlive` **fresh** today
  (inside `canDeliver`, `1224`) and `tickGit` runs only every 10 s (`2629`), so a gate reading the cache could
  fire a nudge — or a bare-shell dispatch (Tier-0 #2) — into a pane that died 9 s ago. Cache the
  read; keep the gates fresh.*
- **Full `mergeLast` verdict to the steward's senses.** **[verified, triple-confirmed]** A
  failed (`error`)/refused (`blocked`) land is a top "needs decision" item, but the steward sees
  only `mergePending = status==="resolved"` (`2778`) — while `renderStewardMessage` (`2650`)
  *already reads the full verdict* server-side to relay it. The server will relay a verdict on
  the steward's command yet won't let the steward *see* it to decide. One-line read; already
  deemed steward-safe.
- **Surface the summarizer's `verification` + `openThreads` (advisory).** **[verified fields]**
  `runSummary` already extracts "which checks/tests/builds ran + results" and "started-but-
  unfinished" — the steward's exact `done-looking`/did-it-verify signals — but they die in a
  client-only in-memory cache (`summaryCache`, lost on deploy). LLM-derived, so hand to the
  steward as **advisory context, never a gate input** ("advisors inform, gates decide").
- **Publish `idleMs`; add `gitOp` and `Task` status to the overview.** **[agent]** The
  `now−lastOutput` subtraction is duplicated 3× client-side and gated at 3 server thresholds
  (`3000`/`60000`/`idleSec`) — publish the raw `idleMs`, keep thresholds local (they are
  *intentionally* different policies, not a bug). `gitOp` (wedged rebase, a hard
  `awaiting-human`) and `laneTask` status (the baseline "done-*looking* vs done") are computed
  but withheld.

## Tier 2 — capability enablers (the roadmap). Medium.

- **`summaryViaSession` is a ready-made steward digest engine — and it fixes context-drain.**
  **[verified stateless]** The Rundgang's mechanical half could be
  `summaryViaSession(compose(journalTail, sessions), stewardCwd)`, moving the pulse out of the
  steward's *degrading conversation context* (the handoff's deferred concern) with **zero new
  machinery**. The "delta since last" needs no engine state — just the two payloads the caller
  already holds. Also the impact-library's first real item.
- **Per-session model selection (Opus/Fable lanes).** **[verified]** The `--model` thread and an
  `extraArgs`/`opts` extension already live at `summaryViaSession:1723` (the merge agent uses
  `extraArgs` for tool scope). A `model` opt there + a `Slot.model` field threaded into
  `slotCmd` (`40`, today bakes the process-wide `BASE_CMD`) unblocks `steward-overview.md`'s
  "unbuilt #1." Subscription-safe (interactive `claude`, never `-p`). *Moderate: touches session
  spawn.*
- **A steward brief and a queued `Task` are the same object.** **[verified path absent]** The
  steward *produces* briefs but `handleStewardRoute` exposes no task-file route, and the
  dispatcher injects `Task.text` raw. Wire the steward to file a **`pending`** Task (owner still
  promotes at `3706`, dispatcher stays deterministic) + add a structured `brief`/`verifyCmd`
  field on `Task`. This is the outsourcing trajectory **without** tripping the anti-synergy —
  promotion stays owner-gated, briefs proven before scheduling.

## Tier 3 — learning-loop fuel (foundational for the ladder, §4). Medium effort.

- **Intervention OUTCOMES — the ladder's fuel. BUILT 2026-07-22 (fuel + criterion; ladder wiring future).**
  **[agent]** *Was:* `audit.jsonl` logged every `steward_send` but no outcome; §4 needs "N interventions
  of a class with a clean helped/no-harm record" and that data was written nowhere. *Now:* every steward
  send parks a persisted pending-outcome baseline (`handleStewardSend`, `server.ts:2688`); a window-close
  pass folded into `tickGit` (`measureOutcomes`, `server.ts:677`) classifies it DETERMINISTICALLY — helped
  = git delta OR sustained output; else no-effect (ambiguous → no-effect, conservative) — and increments a
  durable per-class tally `{helped,noEffect,harmed}` in persisted state (`outcomeTally`, read by the ladder,
  NEVER a journal scan — §3). `harmed` is OWNER-supplied only via `POST /api/steward/outcomes/harm`
  (`server.ts:3224`); a deterministic `claudeAlive` true→false-in-window is a crash CANDIDATE escalated to
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
2. **Tier-1 `claudeAlive` + full `mergeLast` + `Task`/`gitOp` on the steward routes** — the
   biggest jump in the steward's judgment quality, near-zero risk, and `claudeAlive` doubles as
   Tier-0 #2's gate. The `condition` classifier is **not** in this set (see Tier 1): its git
   subset is already derivable and its real conditions need `claudeAlive` first.
3. **Tier-2 `summaryViaSession` as the digest engine** — proves the impact-library loop on one
   real item *and* fixes context-drain, with machinery that already exists.

*Everything above is reversible/low-blast to build (worktree-isolated, owner reviews at land) —
so per the 2026-07-22 doctrine it's act-freely territory to prototype; only the permanent gates
(`OWNER.md` §4) stay fixed. Rank shifts with evidence.*
