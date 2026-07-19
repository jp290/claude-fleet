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

## The corpus (charter — fill in the next session, in a lane)

Knowledge shelf (`docs/`):
- [x] **`tailored-context.md`** — environment → silent capture of the implicit
      complementary parameters → output only the relevant. The context principle.
- [ ] **`operating-model.md`** — the primitives and mental model: session, lane,
      queue/dispatch, quarantine-by-default, review-as-bottleneck. What each *is* and
      when to reach for it.
- [ ] **`interaction-modes.md`** — the three relationships, each with concrete do's,
      don'ts, and failure modes:
      - **human → session**: prompt shape, when to review vs. let it run, chunking
        work into landable lanes, keeping review cheap.
      - **session → session** (orchestration): briefing, gating, verify, model routing
        (cheap model + good brief ≥ expensive model + thin brief).
      - **session → self**: self-sharpening (the `/sharpen` family), CLAUDE.md as
        self-instruction, done-criteria you set before starting.
- [ ] **`verification.md`** — done-signals; deterministic > semi-deterministic >
      statistical; verify before claiming done; cap retry loops (structural after ~5).

Operative shelf (loaded, not just read):
- [ ] **lane brief templates** — the Phase-2 artifact: a per-task foolproof framing
      passed at launch (NOT a tracked file — it would dirty the tree and block `land`).
- [ ] **CLAUDE.md discipline** — the operating rules a fleet session should embody,
      kept terse so they load cheaply. (CLAUDE.md is gitignored → copied into every
      lane, so a lane inherits the discipline automatically.)
- [ ] **skills** — recurring session-operating moves worth a `/command`.

## The bar

Write each piece so that a session which loads it makes fewer first-pass mistakes and
needs less review. If a doc doesn't change behavior, it belongs on the knowledge shelf
as background — not dressed up as operative context. Keep the two honest and separate.
