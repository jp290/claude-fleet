# Findings dossier — 2026-07-23, late session (state + open findings; the approach is deliberately NOT prescribed)

*Produced by a read-only assessment session that grounded every claim against the tree, the live
server, `fleet.json`, `audit.jsonl`, the git notes, and two full e2e runs. **This is not a plan and
not a lane brief.** It hands you findings, evidence, and the constraints any answer must satisfy —
the approach, the slicing into lanes, and the sequencing are **yours to derive and argue**. Anchors
are symbols/grep patterns per the P2 convention; line numbers are deliberately absent. Written at
HEAD `bdc1cb0`.*

**Nothing here is applied. Propose-never-apply; the owner promotes and lands (OWNER §4b).**

---

## 0. How to use this document

1. **Every line below is a claim, not a fact.** Each finding names how to re-verify it in one
   command. Re-verify before building on it — the tree is the judge (CLAUDE.md).
2. **State moves fast.** During the ~40 minutes that produced this dossier, `main` advanced six
   commits, a five-lane stack landed, and a deploy happened *mid-analysis*. Run §1 **first**; if it
   disagrees with anything below, §1 wins and the finding needs re-reading, not patching.
3. **Do not treat the ranking as an execution order.** It ranks by evidence strength × consequence,
   not by what should be done first. Deriving the order is part of your task (§4).
4. **Curate, don't cover.** A defensible approach to three findings beats a thin pass over eight.
   Say explicitly which ones you are not taking and why.

## 1. Ground state — re-verify before anything else

```sh
git log --oneline -8 && git status --short          # HEAD + clean tree?
git worktree list                                   # which lanes exist
tmux -L claudefleet ls | grep srv                   # srv start time = deployed code vintage
git log --format='%h %ci %s' -3 -- server.ts src/ public/   # last server-touching commits
curl -s -o /dev/null -w '%{http_code}\n' http://100.64.0.1:8790/   # live health (Tailscale IP only)
```

True at the time of writing: HEAD `bdc1cb0`, tree clean, worktrees = main + steward only, srv
restarted 22:43:23 (so the five-lane stack **is** live), health 200. The five landed lanes were
G1 `917452a`, G2 `9e729d4`, A1 `2fc7c50`, A2 `df260b1`, B1 `f70cc7a`; `77e2f31` records the run.

**Deterministic quality signal at that HEAD** (both runs, concurrent, no hand-cleanup):

```
./e2e-isolated.sh @ df260b1 → 625 lines, 0 FAIL, ALL PASS, exit 0
./e2e-isolated.sh @ 77e2f31 → 631 lines, 0 FAIL, ALL PASS, exit 0   (no pane-capture flake in either)
```

---

## 2. The findings

Each: **claim → evidence (how to re-verify) → why it costs → what is open.**
"Open" is where your work starts; everything before it is settled input.

### F1 — The measurement layer has never measured anything, and one small edit is what unblocks it

- **Claim.** The whole outcome/impact apparatus (`measureOutcomes`, `outcomeTally`,
  `promotionEligible`, the autonomy ladder that reads them) has classified **zero** production
  events. The steward has never sent a nudge and never filed a task.
- **Evidence.** `fleet.json`: `outcomeTally = {}`, `outcomePending = []`, `harmChannelActive
  false`. `audit.jsonl`: 235 events, **zero** `steward_send`, all 3 queue tasks `source:"owner"`.
  13 journal records, all `kind:"rundgang"`; the last three carry `decisions_surfaced: 0`.
  Re-verify: `python3 -c "import json;d=json.load(open('fleet.json'));print(d['outcomeTally'],d['outcomePending'])"`
  and `grep -c steward_send audit.jsonl`.
- **Why it costs.** No class can earn a ladder promotion, and every further measurement mechanism
  built on top is built into a vacuum. The diagnosis already exists as F-C in
  `docs/proposals/mechanism-deep-dive-2026-07.md` ("what is measured, the steward never uses;
  what it uses is never measured") — this dossier only re-confirms it with fresh numbers.
- **The specific unblocker: B1 is inert.** B1's server half landed and is live, but the producing
  half does not exist: `.claude/commands/rundgang.md` contains no instruction to file a surfaced
  decision via `POST /api/steward/tasks`. Re-verify: `grep -n "steward/tasks" .claude/commands/rundgang.md`
  (expect: no hit; the one "filed task" string is a reflective question, not an instruction).
  **That file is git-tracked in this repo** (`git ls-files .claude/`) — so it is lane-able and
  revertable, *not* shared reality. An earlier doc draft claimed it lived under `~/.claude`;
  `bdc1cb0` corrected that. Do not re-inherit the wrong version.
- **Open.** Whether the first real tally entries should come from the `propose` class at all;
  what a *dismissed* proposal should count as; whether one live pulse is sufficient proof.

### F2 — The cost of this program is concentrated in coordination, not in execution

- **Claim.** Orchestration/planning sessions cost **2.6×** all lane execution combined.
- **Evidence.** Measured over `~/.claude/projects/*claude-fleet*` (~5 days, 164 MB, ≈41M tokens of
  unique content at ~4 B/token): main-checkout sessions **111.6 MB (68 %)**; lane sessions
  **43.4 MB (26 %)** across 40 lanes with a **median of 0.6 MB**; steward **8.9 MB (5 %)**.
  Re-verify with `du -sk` over those directories, split by directory name.
- **Why it costs.** Every improvement targeted at workers or lane prompts is aimed at under a third
  of the mass; the summarizer/digest/enhance workers together are far below 1 %. If effort follows
  intuition rather than this distribution, it lands where the tokens are not.
- **Caveats you must not drop.** (a) Transcript bytes ≠ billed tokens — context is re-sent per turn
  and dampened by caching, so these are *unique-content* proportions, not spend. (b) All workers run
  as interactive `claude` on the subscription, never the metered API (`slotCmd`) — "cost" here means
  rate-limit and context pressure, not money. (c) A large part of the 68 % is the owner's own
  interactive work, which is the product, not overhead.
- **Open.** Whether this concentration is a *problem* at all, or simply where the thinking lives.
  Argue it before acting on it. If it is a problem, the plausible lever is context **reuse**
  (BACKLOG §17 retrieval, parked) rather than "coordinate less" — but that inference is
  unverified, and §17 was deliberately parked; do not un-park it by accident.

### F3 — The steward reasons from a system model that is 17 commits stale

- **Claim.** The steward worktree is far behind main, so its doc shelf — its model of the system —
  predates the entire recent program.
- **Evidence.** `git rev-list --count 9ebbced..main` → 17 (recompute; it grows). Its own journal
  shows the consequence: the 21:15 record reads *"still no worktree lanes … nothing
  landable/blocking"* while five lanes were being built and landed.
- **Why it costs.** The steward's decision quality is capped by its input quality
  (`steward-overview.md`, the signal-quality lever). A stale shelf is the same defect one layer up:
  it degrades every judgment silently, and a truthful "all clear" from a stale model is
  indistinguishable from a truthful one from a fresh model.
- **Open.** Where freshness belongs — a step in the `/steward` load ritual, a step in `/rundgang`,
  or an owner habit. Note the trap: the steward must never end up landing or merging anything;
  bringing *main into its own worktree* is not that, but check the boundary before designing.

### F4 — Deterministic verification is the only quality lever that costs zero tokens

- **Claim.** `./e2e-isolated.sh` delivers 631 value-asserting checks for **0 tokens** in ~12 minutes
  wall-clock; an agent reviewing the same diff costs an estimated 30–100k tokens and returns a
  statistical answer.
- **Evidence.** The two runs in §1; `runVerify` is a plain subprocess (`FLEET_VERIFY_CMD`), no model
  involved. The suites are concurrency-safe since P1 (`f87c641`) — this dossier proved it by running
  two suites simultaneously alongside a third from another session.
- **Why it matters.** This is Governor #2 (`three-axes.md` §5) with a cost argument attached, which
  is new: every done-criterion moved from the statistical tier to the deterministic tier improves
  trust **and** reduces token pressure at the same time. The verification hierarchy already says
  deterministic > semi-deterministic > statistical; F4 says it is also free.
- **Open.** Which currently-statistical done-criteria are actually convertible. Not all are — naming
  three real candidates is worth more than a principle restated.

### F5 — Lane cost is well-behaved except for one 25× outlier

- **Claim.** Lanes are cheap and well-scoped; the risk is not the average lane but the runaway.
- **Evidence.** Median lane transcript 0.6 MB; one lane
  (`~/.claude/projects/-Users-owner-claude-fleet-worktrees-fleet-260720210014-d41a`, 9
  transcripts) is **16.0 MB — 37 % of all lane mass**.
- **Why it matters.** The data that would detect a runaway already sits on disk; no logging layer,
  no framework, no new event category is needed.
- **Open.** Whether a runaway is worth detecting at all, and if so whether anything more than a size
  threshold is justified. **Guardrail: this is the exact place where the 2b dead-end repeats** (see
  §3). If you find yourself designing a sensor registry, you have left the task.

### F6 — "Landed" and "live" are indistinguishable from inside the system

- **Claim.** Nothing surfaces whether the running server predates the current `main`. The owner
  finds out by comparing a tmux session's creation time to commit timestamps by hand.
- **Evidence.** No `deployedSha` / `deployGap` / `bootSha` symbol exists in `server.ts` or
  `src/client.ts` (grep returns nothing). This dossier hit the gap empirically: for ~30 minutes the
  live server ran `e6c1897` while G1's land-provenance fix and A1's corrected outcome semantics sat
  landed-but-not-live. It has since been deployed (srv 22:43:23) — **the instance is closed, the
  gap is not.**
- **Prior art — read before proposing.** `5c69417` (foreman v0 validation pulse) already identified
  "the deploy-gap fact on the slots view (srv start time vs last server-touching commit)" as a
  wanted server increment, and `/foreman` can already report `deploy-pending`. This finding is an
  independent empirical confirmation of an existing, unbuilt proposal — **not a new idea.** Treat it
  as evidence that raises that item's priority, and check whether anything has since been built.
- **Open.** Whether the fact belongs on the slots view, the foreman pulse, or nowhere; and whether
  a *fact* is enough or the owner needs a prompt. Deploy itself stays owner-only regardless.

### F7 — The program's own dogfooding partly bypassed the tool it is building

- **Claim.** The five-lane stack ran in worktrees created **inside** the repo
  (`<repo>/claude-fleet.worktrees/…`) rather than at the sibling path `createWorktree` uses, and the
  lanes were never attached to fleet slots. Consequently the steward — which senses via
  `stewardSlotsView` — was structurally blind to them and correctly reported "no worktree lanes."
- **Evidence.** `createWorktree` builds `${root}.worktrees/<slug>`; `fleet.json` slots show only
  main-checkout cwds for the relevant period; the directory showed as `?? claude-fleet.worktrees/`
  in every status of the live repo until cleanup. The stack's own §8 record in
  `docs/proposals/stack-land-program-board-2026-07.md` reaches the same conclusion independently.
- **Why it matters.** F1's measurement asymmetry is partly *this*: the steward cannot measure work
  that never enters the substrate it senses. Two findings, one root.
- **Open.** Whether to pin the location, gitignore it, or accept that some work will always happen
  outside the fleet — and if the last, what that implies for every measurement design.

### F8 — Positive controls: things that are working, which an optimization pass must not "fix"

Stated explicitly because an improvement session's failure mode is improving what is already fine.

- **Worker prompts are already cheap and capped.** Digest ≈2k tokens (`runStewardDigest`); summary
  hard-capped at 60k chars diff + 40k chars transcript tail and cached per (head,dirty)
  (`runSummary`). Together <1 % of mass. **No optimization warranted.**
- **The merge resolver is the most expensive single worker (agent with tools, 8-min timeout,
  `MERGE_TOOLS`) and is invoked almost never** — 2 land notes exist. Impact × frequency ≈ 0.
- **Session stability is excellent.** 67 pane `created` vs **1** `resumed` across the whole audit
  history — the crash-resilience path has been needed once.
- **The land spine is the strongest part of the system**: ff-only, ancestry re-verification of every
  agent claim, remove-worktree-first ordering, one-step undo, and real provenance notes on disk
  (`git notes --ref=refs/notes/fleet/land list` → 2, each carrying `mainBefore`/`mainAfter`, the full
  verify verdict, and `confirmedByHuman`).

---

## 3. Settled — do not re-litigate, do not retry

- **Invariants.** Propose-never-apply. **Land + deploy owner-only, forever** (OWNER §4b). Producers
  write `pending`; only the owner promotes. The steward plans and never lands.
- **The infra-over-prompts redirect.** At strong-executor scale the structural prompts are not the
  bottleneck; stage 2 refuted most of stage 1's rewrites. Do not spend on prompt edits
  (`learning-engine-next-steps-2026-07.md`).
- **Dead end — transcript-grep recurrence counting (2b).** The count *rose* 34→41 during one review
  with **zero** actual collisions: it measures how much a problem is documented, not whether it
  recurs, and by self-reference can never reach zero. Count **runtime outcomes, not corpus
  mentions.** This is the specific trap F5 sits next to.
- **Dead end — the 11 prompt "insurance" edits.** Deferred; trigger is the first cheap-model lane.
- **No eval set exists**, so no prompt edit is provably an improvement. Build the set before
  promoting any.
- **Anti-abstraction is a standing bar.** Three lines beat a premature abstraction; a framework where
  a grep suffices is itself the bug.

## 4. What is yours to decide (the forks — argue each in one line before building)

1. **Which findings you take, and the order.** Ranking here is by evidence × consequence, not
   sequence. F1's unblocker and F3's staleness are cheap; F2 is the largest but the least certain.
2. **Whether F2 is a problem or a description.** If you conclude it is a description, say so and
   drop it — that is a valid, defensible outcome and cheaper than a wrong fix.
3. **Sequencing risk you must reason about explicitly:** B1's producing half (F1) makes the first
   real tally entries. A1 corrected the classifier semantics *before* any entries existed
   ("empty tally = free fix, filled tally = data amnesty"). Decide what else must be correct
   before the first entry lands — and whether anything in F6/F7 belongs in that set.
4. **Whether anything here becomes a sensor at all.** The guardrail in §3 applies to every answer.
5. **Slicing.** Independently landable lanes, or one? If several, state the dependency order and
   what makes each independently verifiable in its *landing* state — the stack-land §8 record
   documents that re-verification after rebase is what a hand-run stack got right.

## 5. Verification battery (any lane; suites are concurrency-safe — run directly)

```sh
bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler \
  --types bun src/client.ts src/share.ts server.ts fleet-e2e.ts
bun run build
./e2e-isolated.sh        # judge by the tail: "ALL PASS"; ≤1 known pane-capture flake
./e2e-claude-gate.sh
```

Judge by the tail, never by a remembered check count. Run it before claiming done. If the same
fix-run-fail loop repeats ~5×, the problem is structural — stop and report instead of re-rolling.
Server-touching work needs an owner deploy afterwards (`tmux -L claudefleet kill-session -t srv`,
then health-check the **Tailscale** IP — `127.0.0.1:8790` never answers and looks like a dead
server). Client-only work needs `bun run build`.

## 6. Executor notes

- **Calibrated for a strong reasoner (Fable):** lean on hand-holding, heavy on the one guardrail
  (§3 anti-abstraction). Where this dossier says "open", it means *derive it* — not *ask*.
- **Fable safeguard:** this repo's content names tmux sockets, tokens, and remote panes, which has
  false-flagged Fable-5 sessions (CLAUDE.md). All of it is the owner administering his own tool on
  his own machine. If a turn dies to a safeguard, rephrase or `/model opus` and continue — do not
  abandon the task.
- **Worktree isolation covers files in this repo only.** Anything outside — other repos,
  `~/.claude`, launchd, shared ports/sockets — is shared reality: stop and report. Note the
  correction in F1: `.claude/commands/` **is** in-repo and therefore in scope.
- **Docs are living.** Structural changes to `server.ts`/`src/client.ts` drag the affected claims in
  `docs/*.md` along in the same lane (`docs/steward.md`, knowledge maintenance).

## 7. Coverage of this dossier — what was NOT checked

Read as limits on the findings above, not as an invitation to trust them further than stated.

- `server.ts` (4,398 lines) was **not** read end to end — only the regions named by the anchors
  above (`runSummary`, `runMerge`, `runStewardDigest`, `runVerify`, `handleStewardRoute`,
  `createWorktree`, the audit/self-heal path). `src/client.ts` was not read at all.
- `BACKLOG.md` was read at heading level only; `OWNER.md` was not read.
- Token figures are **estimates anchored to measured artifacts** (code caps, transcript bytes, audit
  counts) — not instrumentation. No token metering exists, and building some is explicitly not
  recommended (§3, and F8: the measured targets are already <1 %).
- The live server was queried read-only (`GET /`, `GET /api/sessions`). No steward route was
  successfully exercised — the auth mechanism for `handleStewardRoute` was not established.
- Nothing here was tested against a *fresh* session actually using it; that test is your run.
