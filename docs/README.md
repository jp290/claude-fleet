# Claude Fleet — the knowledge, not just the tool

Fleet looks like a dashboard for running many Claude Code sessions. That is the
surface. What this project actually is: **a body of operating knowledge about how to
drive Claude Code sessions well — for the agent, the orchestrator, and the human — made
concrete as buttons, gates, and context.**

Every feature is a principle wearing a UI:

| Principle | Made concrete as |
|---|---|
| Quarantine work by default; promotion is the human's call | **lanes** (worktree isolation, land-only-if-safe) |
| First-pass reliability comes from context, not vigilance | **tailored briefs** (`tailored-context.md`) |
| Review capacity is the bottleneck, not agent throughput | queue + dispatch sized to what a human can review |
| A done-signal must be deterministic to be trusted | **verify gate** (planned) |

## Why this doc set exists

The knowledge here is **reflexive**: one Claude session operating another (the
dispatcher briefing a lane) is the *same skill* as a human operating a session, is the
same skill as a session sharpening its own prompt. Three relationships, one discipline:
set up an agent so its output is reliable and its review is cheap.

So documentation here comes in **two shelves**, and the second matters more:

1. **Knowledge (human-facing)** — the *why*. Prose you read to build the mental model.
2. **Operative context (agent-facing)** — the *discipline made loadable*. Context that
   changes how a session behaves when it is loaded (CLAUDE.md, skills, brief
   templates). The test of "usefully documented" is not "well written" — it is
   **does a session that loads this behave more reliably?**

## Four capabilities — which doc owns which (orientation, added 2026-07-24)

"Autonomy" here is not one dial. It is four separable capabilities with very
different blast radii, and most of the corpus below is about one of them. Read
this first so the docs do not look like competing frameworks:

| | Capability | Owned by | Blast radius if wrong |
|---|---|---|---|
| **a** | **Selection** — what should be worked on at all | `orchestrator-autonomy.md` (the foreman pulse), the task queue + dispatcher | a wasted lane |
| **b** | **Briefing** — turning a task into a lane a session can execute | `tailored-context.md`, `lane-brief-template.md`, `prompt-axioms.md` | a wasted lane |
| **c** | **In-flight steering** — sensing a running lane and intervening | `steward-autonomy.md` (its *seven joints* decompose exactly this), `steward-intelligence.md` | plausible-but-wrong work that passes every gate |
| **d** | **Acceptance** — is it done, may it land | `merge-review-autonomy.md`, `lane-autonomy-future.md`, the verify gate | real damage — hence machine-checked, owner-gated |

Two consequences worth stating once:

- **The safe expansion order is b → a → c.** A fault in (b) or (a) costs a lane
  and is recoverable. A fault in (c) produces work that *looks* right and clears
  every deterministic gate, because gates test correctness, not intent. (d) is
  already the most hardened and should stay the slowest to move.
- **(c) is unbuildable responsibly without perception.** The outcome ledger still
  writes and **nothing reads it**; the post-hoc review feed (`lane-autonomy-future.md`
  item 6 — *not* `merge-review-autonomy.md` §6, which is "Hard rules"; that
  mis-citation stood until 2026-07-25) is that reader, and it is the one piece of
  `perception-layer.md` still unbuilt — its write side landed in `600d401`.
  Steering a fleet you cannot observe is the failure mode where everything looks
  busy and the work is wrong for days.

## The corpus (the shelf)

One line per doc — its *purpose*, not its contents, so this index points without
rotting. Two shelves, plus the steward subsystem.

**Knowledge (the *why* — read to build the model):**
- **`tailored-context.md`** — the brief principle: shape the environment, induce
  silent capture of the complementary parameters, emit only the result. The lever
  on review cost.
- **`operating-model.md`** — what each primitive *is* (slot, lane, land, queue,
  dispatch, intake, auto, share) and the invariants that hold them together.
- **`interaction-modes.md`** — the three relationships (human→session,
  session→session, session→self) as one discipline: shape context up front, gate
  on verified state, verify before believing.
- **`verification.md`** — done-signals: deterministic > semi-deterministic >
  statistical; verify before claiming done; cap retry loops (structural after ~5).
- **`prompt-axioms.md`** — what makes a prompt good, derived from what a prompt
  *is*: one root axiom, four axes, and the cost-clamp that allocates them. The
  theory under `tailored-context.md` and `/sharpen`.
- **`scope-inflation.md`** — the step from a finding to a *program*, and how it
  inflates: a ranked list without a cut line is a portfolio, not a plan. Worked
  case (`data-saver.md`): one measured field justified one lane, four were spawned.
  Names why cheap parallelism hides this — the cost lands at review, not at spawn.

**Operative (the discipline *made loadable* — changes how a session behaves):**
- **`lane-brief-template.md`** — the per-task foolproof framing passed at launch
  (never a tracked file — it would dirty the tree and block `land`).
- **CLAUDE.md** — the terse operating rules a session embodies; gitignored, so
  every lane inherits them automatically.
- **OWNER.md** — the steward's model of JP (standards, register, and the
  safety-critical risk-surface that calibrates its gate); gitignored, owner-curated,
  read by the `/steward` load ritual. See `steward-intelligence.md` §3.
- **`/steward`** (`.claude/commands/steward.md`) — the steward's load ritual: read
  the shelf, spot-verify its claims, then operate.
- **`discrepancy-audit.md`** — the claim-vs-reality hunt made provable: eight
  discrepancy classes, each with a confirmed instance and the command that proved
  it, plus the proof discipline (paste the output, not the word "verified"; a
  correction must address the same object as the claim; never re-litigate a trade
  the code already owns). Load it before auditing the corpus against the code.
  Carries its own findings log.

**Steward (the workhorse agent — an optional Fleet subsystem):**
- **`steward-overview.md`** — the entry map: what the steward *is*, what it can *do
  today* (as-built, `server.ts`-cited), the deterministic-signal lever that most
  improves it, and the trajectory it's designed toward. Start here.
- **`steward-roadmap.md`** — the ordered plan (Phase 1→5 + continuous) across the whole
  backlog, with the ordering *derived from principles* (facts-before-claims, safety-first,
  leverage, prove-before-trust; don't-sequence-by-excitement). The living plan.
- **`steward.md`** — the convention: optional, recognizable as `⚙ steward`, plans
  but never lands.
- **`steward-autonomy.md`** — the seven joints of the management loop and the
  empirically-grounded intervention playbook.
- **`steward-nudge.md`** — design (2026-07-25, unbuilt): the steward fires a
  *content-free* positive trigger on a surface signal and lets the session supply
  the correction itself. Splits the sharpen function so the steward owns only the
  *timing* — which is what keeps THE GUARD intact. Widens playbook #3
  `continue-nudge`; it is not a new intervention type.
- **`queue-automation.md`** — the task queue as an automation substrate: producers
  multiply, the gate stays one.
- **`automation-synergies.md`** — where the mechanisms are secretly one lever, and
  the one place they must stay apart.
- **`synergy-findings.md`** — a producer/consumer audit (2026-07-22): deterministic
  facts computed but not shared, the "master stop" safety seams, and the enablers —
  a ranked, evidence-cited backlog to prune. Extends `automation-synergies.md`.
- **`deep-assessment-2026-07-22.md`** — full-tree structural assessment (server +
  client + docs + e2e): still-open findings ranked with fix sketches and
  done-criteria, what parallel lanes already resolved, and the unassessed surface.
- **`steward-intelligence.md`** — the capstone: autonomy and safety as one design
  (reversibility × track-record), the three models, the learning loop, the impact
  layer.
- **`steward-arena.md`** — operating autonomy in two shapes: A the hermetic clone
  study-arena (BUILT: `steward-arena.sh`), B the live capability partition (proposal);
  the three isolation layers and the accepted skip-perms OS-blast.
- **`lane-autonomy-future.md`** — deferred ideas for lanes that run further on their
  own; a parking lot, not a plan.
- **`steward-pulse-v2.md`** — nudge test runs as the first upstream-autonomy trials:
  facts+one-question nudges whose mandated one-line reply is its own label, the
  handoff-recycle ritual, mission sessions; why the hardened land gate makes upstream
  trials cheap. Feeds the starving §4 tally.
- **`judge-calibration.md`** — how judging instances earn trust: the fire-drill procedure
  (sealed ground truth, evidence-horizon rule), per-judge calibration state (③ misses
  in-diff semantics; ②'s production `raw: true` run was a PARSER giving up on prose-wrapped
  JSON, not a model missing its contract — corrected 2026-07-25), instrument-check method.
- **`adversarial-2026-07-25.md`** — the ranked index of the 2026-07-25 adversarial pass (seven
  sweeps): what needed an owner decision and how each was disposed, the structural findings
  B1–B12, and §E's empirical pass — including the measurement that the binding constraint is
  owner adjudication (one auto-written label in the rail's lifetime), plus two corrections of
  its own earlier claims. **Read this before acting on any of the four docs below.**
- **`gate-coverage.md`** — what the land gate actually verifies (tsc + 26 claudeAlive checks;
  the 703-check suite is not in it), the post-land audit tier that was designed and never
  built, and why role separation between ②/③/resolver is not statistical independence when
  one model runs all of them.
- **`verify-tiering.md`** — measured (2026-07-25): what a green gate actually *attests*, with every
  candidate suite priced by wall-clock on a contended box — including the observed run where the
  759-check suite flipped red on an unchanged tree, which is what disqualifies it as a hard pre-land
  gate at any timeout. Ends in one concrete gate proposal (typecheck the three unimported harnesses,
  add `./e2e-clean-review.sh`) with its measured cost. Read before proposing to gate on a suite.
- **`e2e-trail.md`** — the suite's per-check trail (2026-07-27): `check()` built ~870 structured
  results per run and printed them away, so "is this check flaky?" cost a seven-minute re-run
  instead of a query. The row shape, why the trail lives in the main checkout's `e2e-trail/` and
  not in the instance dir the wrapper deletes on green, why one file per run, and why the timing
  field is called `msSincePrev` and not a duration. Read before querying or extending it.
- **`mining-2026-07-26.md`** — the five ledgers read rather than assumed. Where the tier-2 audit
  silently lost four lands to a srv restart, why both red audits went unread, and finding 3's
  correction: ②'s identical verdicts were a **broken feed** (`main..main`), not degenerate traffic.
- **`data-audit-2026-07-27.md`** — six parallel read-only agents over the data plumbing, ranked with
  a cut line: the restart windows in the land path, the alarm no client read, the output cap that
  kept 33 PASS lines and no FAIL names, the rotation cliff, the state-file durability holes. Each
  finding carries its `file:line` and its cost. The source list for wave 2.
- **`suite-contention.md`** — the merge/resolver flake root-caused: `tryScriptRebase` discards
  `git rebase --abort`'s exit code, so a lost `index.lock` race (against Fleet's own `tickGit`)
  leaves a lane wedged mid-rebase. Read before treating suite non-determinism as a property of the
  suite, and before serializing anything else around it.
- **`analysis-2026-07-28-findings.md`** — five agents, three of them blind to the prior analysis.
  The measured refusal of the ledger extraction (`server.ts` grew +908 lines in two days; the only
  clean seam is 3.3%; `appendEvent`/`readLedger` already own the discipline and the remainder is
  four bypass call sites), ~1,800 deletable lines **with a longer do-NOT-delete list**, the 37
  must-agree pairs and why they are one mechanism, the six-place config surface, and the substrate's
  coverage holes. Read before proposing an extraction or a deletion.
- **`analysis-2026-07-28-register.md`** — its companion: 86 claims from the mechanism overview, each
  with its **evidence class** (read-code / code-comment / derived / unverified) and its verdict after
  adversarial checking. The format matters more than the rows: a claim sourced from a comment is
  marked as such, so partial coverage cannot read as complete.
- **`structural-plan.md`** — thirty findings collapsed into four mechanisms (intent-before-act;
  one module per ledger with unknown representable; no swallowed failure on a mutating op; a poll
  path may not do unbounded work), with what each does *not* cover and what stays bespoke.
- **`knowledge-currency.md`** — the answer to "should lanes have a shared knowledge store": no, for
  the third time, but naming the gap the prior two missed — the worktree delivers the shelf as of
  *spawn time*. A lane can read main's newest knowledge with `git show main:docs/x.md`. Amends
  `knowledge-layers.md`; read both before proposing an index.
- **`audit-implementation-plan.md`** — how the audit was partitioned into lanes by `server.ts`
  region (not by finding number), the reproduce-before-fix rule, and the explicit wave-2 deferral
  list so nothing fell off between waves.
- **`ungoverned-artifacts.md`** — `CLAUDE.md`/`OWNER.md`/the four `.jsonl` trails are untracked,
  copied per-lane at spawn, and unbacked-up: why a lane cannot fulfil Wissenspflege for the
  rulebook, the measured per-worktree drift, and the fix ladder under a public remote.
- **`compiler-program.md`** — the three prompt-compilers (✨ enhance, /sharpen3, steward) as one
  substrate, the steward's autonomy rungs, and why ✨ needs feeding before tuning.
- **`architecture-review.md`** — the `arch-review` lane's 12 ranked architecture findings with
  costs, three things to protect unchanged, and one structural recommendation (`runWorker`).
- **`graduation-criteria.md`** — pre-registered numbers each autonomy step must meet
  before it may be enabled (component-5 auto-land, ② shadow→gate, deploy pilot, nudge
  promotion). Written before the data on purpose; amendments only with a rationale
  committed before looking at new data.
- **`autonomy-trial-1.md`** — the pre-registered protocol for the first dispatcher-driven run
  (2026-07-25): exactly which steps the machine takes and which stay on the owner's hand — selection
  and briefing only, *no new land authority* — four questions each with the measurement that answers
  it, and four stop conditions checkable without judgment. Written before the trial ran, so its
  result cannot be re-narrated afterwards. `graduation-criteria.md`'s rule applied to a single run.
- **`perception-layer.md`** — design (2026-07-25; **write side built in `600d401`**, the feed
  is not): the three pieces that make Fleet observable to itself — a deterministic
  `done-looking` predicate, auto-③ on it, the review persisted onto the outcome row, the
  ledger rendered as a feed. Why the order is c → b → a, and the staleness rule that keeps
  a persisted review honest. The precondition capability (c) is gated on. See
  `knowledge-layers.md` §5 for what the half-built state means in practice.
- **`state-reality-divergence.md`** — the register for one error class: a fact the server records
  about a slot or lane stops being true of the world, and a *later automatic decision* reads the
  record instead of the world. All 16 recorded facts enumerated with writer and automatic consumer,
  findings D1–D6 ranked by the *direction* of the divergence (reads-as-quiet/ready/done is dangerous
  because the automation acts; reads-as-unknown is safe because it declines). Read it before wiring a
  new tick to a stored signal.
- **`outcome-ledger-audit.md`** — what the outcome ledger actually says, read row by row at 27 rows:
  which fields carry information, which are structurally broken and by what code path, and the
  finding that `graduation-criteria.md` §1 reads MET only because a reviewer answer that never parsed
  is counted as review coverage. Read before believing any number derived from the ledger, and before
  building the first consumer of it (§7 names the smallest honest one).
- **`knowledge-layers.md`** — assessment (2026-07-25): the three places a lane looks
  things up — the shelf, the brief, outcome memory — measured against each layer's own
  stated bar, with the gaps ranked and code-cited. Why no fourth mechanism (and no
  service) is the answer, and why the layers' failures form a loop that perception
  closes. Read it before proposing a new knowledge store.
- **`merge-review-autonomy.md`** — verification-first land pipeline: the no-build-no-test
  gap, deterministic verify in the verdict, git-note provenance at land, the resolver
  report as briefing; human lander stays. Spec for lanes V1-V3.
- **`orchestrator-autonomy.md`** — the foreman as a stateless derive-verify-propose
  pulse under the steward principal (`/foreman`): standing deterministic guards,
  committed-main-only rule, verb-graded ladder climb; land+deploy never.
- **`three-axes.md`** — the umbrella program frame: one capability (intent-level
  understanding, sharpen as premise) capitalized on three axes (agency, ground, memory);
  the three-readers simplicity norm, the governors, the sharpen-corpus evidence, and
  the 2026-07-23 roadmap re-weighting.
- **`steward-mail.md`** — an email address as an assistant channel: inbound-only
  v1, layered against prompt injection.
- **`automation-frontiers.md`** — speculative next levers, pressure-tested and
  dependency-ordered: a backlog to prune with evidence, not a plan to extend.

**Not docs, but part of the shelf — a lane looking for precedent should find these:**
- **`briefs/`** — the *filled* lane briefs, tracked (so they never dirty a worktree,
  `tailored-context.md` §6). The worked examples behind `lane-brief-template.md`: read
  the closest one before writing a new brief.
- **`docs/proposals/`** — dated proposal / decision records that fed the backlog, owner-promoted
  into the roadmap rather than read as standing knowledge: the two learning-engine dream passes
  (`learning-engine-v1-2026-07.md`, `dream-mode-corpus-2026-07.md`,
  `learning-engine-next-steps-2026-07.md`), `mechanism-deep-dive-2026-07.md`, and
  `stack-land-program-board-2026-07.md` (propose-only). Check here before proposing; the
  reasoning lives in these, the register only points. Listed here from 2026-07-25 — the shelf
  above had never pointed at them. Added 2026-07-28: `queue-deletion-2026-07-28.md` — the day
  the whole task queue was deleted from the board, what made the loss silent, and the register
  of all 14 open tasks re-checked against HEAD (12 still open), with its verbatim restore
  payload `queue-deletion-2026-07-28-tasks.md`. Both die once those tasks are re-filed or
  dropped; that is why they are here and not on the shelf.

*(A "right-tab-agents" design-note entry — "the board's agentic surfaces: inventory and the open
advisory-vs-acts axis" — stood here until 2026-07-25 and was cited by `steward.md` too. It was
never written; `git log --all` over its path is empty. The advisory-never-gates norm it was
supposed to carry lives in `perception-layer.md` §7, and no inventory of the board's agentic
surfaces exists anywhere. Every pointer in this index must resolve to a file — the cheapest check
that keeps the shelf honest — so this tombstone deliberately writes no filename with an
extension: a check that trips over its own gravestone is one people learn to ignore.)*

## The bar

Write each piece so that a session which loads it makes fewer first-pass mistakes and
needs less review. If a doc doesn't change behavior, it belongs on the knowledge shelf
as background — not dressed up as operative context. Keep the two honest and separate.
