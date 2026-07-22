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

The pre-send **delivery gate is hand-reimplemented four times, each a different subset**
(`server.ts`): full in `tickAutos` (`autosOn → nextAt → claudeAlive → quietHours → idle`,
`1108–1149`), **claudeAlive+idle only** in `handleStewardSend` (`2559–2560`), **absent** in
`tickDispatch` (`1180–1228`), idle-only in the merge path (`3268`). There is no shared
`canDeliver(slot)` choke-point. This drift **is** the cause of the Tier-0 safety seams below:
gates added to `tickAutos` never reached the paths written later. The codebase already proves
the fix pattern — `createAutoForSlot` (`1040`) is the one choke-point all three auto callers
funnel through, so a scoped caller *structurally* can't target another slot. **Extracting one
guarded `canDeliver()` and routing all four actors through it makes Tier 0 automatic and
drift-proof.** Cost: it's a refactor on the hot delivery path — do it behind the isolated e2e
suite, not casually.

## Tier 0 — safety seams (the "master stop" isn't master). Low risk, high trust value.

1. **The kill-switch and quiet-hours do not stop a direct steward nudge or the dispatcher.**
   **[verified]** `autosOn` is read only at `tickAutos:1108`, `inQuietHours` only at `1136`.
   `handleStewardSend` (`2548–2584`) checks neither; `tickDispatch` checks only `dispatchOn`.
   So "stop all automation" / "no 3am nudges" gate the *scheduled* surface but not the
   steward's own `/api/steward/send` or lane dispatch. **Severity today: low** — the live beat
   is `/rundgang` (an Auto, so it *is* stopped) and the steward isn't promoted to send yet; but
   the guarantee is false and becomes a real hole the moment the steward is allowed to nudge.
   *Fix: route all three through the Tier-0 `canDeliver()` (or add two `if` checks); decide
   deliberately whether `dispatchOn` also falls under master `autosOn`.*
2. **The dispatcher pastes task text without a `claudeAlive` check → shell-exec risk on the
   externally-fed path.** **[verified]** `tickDispatch:1211` `sendText(free, next.text)` runs
   after a 4s sleep + cwd re-verify (`1205`) but no alive check; `slotCmd` is `claude; exec
   $SHELL` (`44`), so a claude that fails to boot (the launchd PATH footgun in CLAUDE.md) leaves
   a bare shell that executes the task text — and this is the one path fed by external
   `/intake`. **Inert today** (dispatcher off unless owner sets `DISPATCH_REPO`+`dispatchOn`),
   but fix before enabling. *Fix: add `claudeAlive(free.id)` to the `1205` re-verify; requeue on
   false (the sibling guard already requeues).*
3. **`stewardRecentSends` reads only the live `audit.jsonl`, not the `.1` rotation → the send
   caps silently under-count across a rotation.** **[agent, cross-confirmed]** `206–208` reads
   `AUDIT_FILE` alone; `appendEvent` rotates at 5 MB (`307`). `readStewardJournal` (`2599`)
   deliberately spans `[.1, current]` for exactly this reason — the send-cap reader doesn't.
   The durable send-cap is the invariant `automation-synergies.md` §2 calls the injection
   endgame, so this is a hole under a safety guarantee. *Fix: mirror the journal reader's
   two-file span (verify a rotation is plausible within the trailing hour first).*

## Tier 1 — signal quality (the steward reasons from facts, not guesses). Low risk.

*This is `steward-overview.md`'s signal lever, now with the producers located. Each is a
read-only widening — no new write path, near-zero risk. "Verify against real state"
(`OWNER.md` §2) applied to the steward's own senses.*

- **Server-side lane `condition` classifier.** **[verified absent server-side]** The 6-way
  the whole pulse turns on is LLM-derived every pulse; the git-derived 3-way
  (`dirty?editing:ahead?ready:clean`) is duplicated **client-side twice** (`src/client.ts:1334,
  2119`), nowhere on the server. Compute `laneCondition(s)` once, add to `/api/steward/sessions`
  + `/api/sessions`; ship the git-derived subset first (`stuck-looping`/`awaiting-human` need #2).
- **Surface `claudeAlive` on the read routes — one signal, two consumers.** **[verified]**
  Computed at `1007`, consumed only by write-gates; absent from every overview. It disambiguates
  the steward's `awaiting-human`/`done`/`dead` blob **and** gives Tier-0 #2 its safety gate.
  *Fold into `tickGit`'s per-slot loop and cache — do NOT call the 2–3 `ps`/`pgrep` spawns
  inline per 100 ms poll.*
- **Full `mergeLast` verdict to the steward's senses.** **[verified, triple-confirmed]** A
  failed (`error`)/refused (`blocked`) land is a top "needs decision" item, but the steward sees
  only `mergePending = status==="resolved"` (`2616`) — while `renderStewardMessage` (`2531`)
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
  `extraArgs`/`opts` extension already live at `summaryViaSession:1582` (the merge agent uses
  `extraArgs` for tool scope). A `model` opt there + a `Slot.model` field threaded into
  `slotCmd` (`41`, today bakes the process-wide `BASE_CMD`) unblocks `steward-overview.md`'s
  "unbuilt #1." Subscription-safe (interactive `claude`, never `-p`). *Moderate: touches session
  spawn.*
- **A steward brief and a queued `Task` are the same object.** **[verified path absent]** The
  steward *produces* briefs but `handleStewardRoute` exposes no task-file route, and the
  dispatcher injects `Task.text` raw. Wire the steward to file a **`pending`** Task (owner still
  promotes at `3457`, dispatcher stays deterministic) + add a structured `brief`/`verifyCmd`
  field on `Task`. This is the outsourcing trajectory **without** tripping the anti-synergy —
  promotion stays owner-gated, briefs proven before scheduling.

## Tier 3 — learning-loop fuel (foundational for the ladder, §4). Medium effort.

- **Intervention OUTCOMES are recorded by no one — so the ladder can never promote.**
  **[agent]** `audit.jsonl` logs every `steward_send` (`kind×ref×slot×ts`) but no outcome; the
  journal logs pulse-level counts, and outcomes are *explicitly deferred* (`2658`). §4 needs "N
  interventions of a class with a clean helped/no-harm record" — that data is written nowhere.
  *Needs a write-time durable per-class tally (NOT a scan of the rotatable journal — §3's own
  warning) + an effect-sensor comparing post-send `lastOutput`/`gitInfo` delta. Caution: the
  effect-window must not fire on stale state (the handoff's staleness warning).* Until this
  exists, the whole ladder/autonomy-expansion vision has no fuel — arguably the highest
  *strategic* value here, at the highest effort.
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
2. **Tier-1 `claudeAlive` + `condition` + full `mergeLast` on the steward routes** — the biggest
   jump in the steward's judgment quality, near-zero risk, and #2 doubles as Tier-0 #2's gate.
3. **Tier-2 `summaryViaSession` as the digest engine** — proves the impact-library loop on one
   real item *and* fixes context-drain, with machinery that already exists.

*Everything above is reversible/low-blast to build (worktree-isolated, owner reviews at land) —
so per the 2026-07-22 doctrine it's act-freely territory to prototype; only the permanent gates
(`OWNER.md` §4) stay fixed. Rank shifts with evidence.*
