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
- **(c) is unbuildable responsibly without perception.** The outcome ledger writes
  and nothing reads it yet; the post-hoc review feed (`lane-autonomy-future.md`
  item 6 — *not* `merge-review-autonomy.md` §6, which is "Hard rules"; that
  mis-citation stood until 2026-07-25) is that reader. `perception-layer.md` is
  the design that closes it. Steering a fleet you cannot observe is the failure
  mode where everything looks busy and the work is wrong for days.

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
- **`perception-layer.md`** — design (2026-07-25, unbuilt): the three pieces that make
  Fleet observable to itself — a deterministic `done-looking` predicate, auto-③ on it,
  the review persisted onto the outcome row, the ledger rendered as a feed. Why the
  order is c → b → a, and the staleness rule that keeps a persisted review honest.
  The precondition capability (c) is gated on.
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

**Design notes:**
- **`right-tab-agents.md`** — the board's agentic surfaces: inventory and the open
  advisory-vs-acts axis.

## The bar

Write each piece so that a session which loads it makes fewer first-pass mistakes and
needs less review. If a doc doesn't change behavior, it belongs on the knowledge shelf
as background — not dressed up as operative context. Keep the two honest and separate.
