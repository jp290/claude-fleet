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
- **`steward.md`** — the convention: optional, recognizable as `⚙ steward`, plans
  but never lands.
- **`steward-autonomy.md`** — the seven joints of the management loop and the
  empirically-grounded intervention playbook.
- **`queue-automation.md`** — the task queue as an automation substrate: producers
  multiply, the gate stays one.
- **`automation-synergies.md`** — where the mechanisms are secretly one lever, and
  the one place they must stay apart.
- **`steward-intelligence.md`** — the capstone: autonomy and safety as one design
  (reversibility × track-record), the three models, the learning loop, the impact
  layer.
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
