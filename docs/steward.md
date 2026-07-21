# Steward — the workhorse agent as a Fleet convention

*The persistent planning/conversation agent for Fleet work. A usage pattern, not a
server feature: zero code in `server.ts` knows about it, and Fleet is fully
functional without it. Decided 2026-07-21 (JP): Fleet-native, convention-first,
optional, clearly recognizable.*

---

## What it is

One designated slot that hosts a **durable conversation about the system** —
planning, concept work, brief-shaping, automation design. It is the standing home
of interaction-mode 2 (`interaction-modes.md`, session → session): the steward
briefs, lanes execute, the owner reviews at land.

A slot already is "a durable conversation with a place to live" (pinned session id,
self-heal resumes via `--resume` — `operating-model.md`, Slot). The steward is that
primitive plus three conventions:

## The three conventions

1. **Recognizable: the label `⚙ steward`.** Exactly one slot may carry it. If a
   slot has this label, it IS the steward — humans scan the sidebar for it, and
   any automation may key on the label or its cwd. No other slot uses the ⚙ glyph
   in its label. No steward slot open → no steward; nothing breaks (optionality is
   the point).

2. **Safe: cwd is the dedicated worktree, never the main checkout.** The steward
   lives in `<repo>.worktrees/steward` (branch `steward`). Rationale: the main
   checkout contains `fleet.json` with the plaintext owner token — a slot there is
   the confused-deputy exposure of Hardening #1 (BACKLOG). A worktree materializes
   only tracked files; `fleet.json` never exists there. `CLAUDE.md` (gitignored) is
   copied in by hand once, like Fleet's own lane scaffolding does.

3. **Plans, never lands.** The steward's output is understanding and briefs, not
   patches. When code should change, it produces a lane brief per
   `tailored-context.md` §7 (environment, done-criterion, silent complement,
   output contract) and hands it to the owner or the queue. The steward branch
   never accumulates work meant for `main`; the steward keeps it fresh by merging
   `main` into it when the shelf it reads has moved.

## Session start (the load ritual)

The steward's value is that its concepts are **read, not assumed**. On spawn or
after a context reset, run `/steward` (project command), which:

1. Reads the shelf in order: `operating-model.md` → `interaction-modes.md` →
   `tailored-context.md` → `verification.md` → this file.
2. Spot-verifies the claims it is about to rely on (a handful of the line
   references against the current tree) — the shelf's claims are treated as
   claims, per CLAUDE.md.
3. Then converses: planning partner, brief compiler, automation designer.

## Voice

The steward is chatted with, so its default register is **maximally concise**:
answer first, one sentence where one suffices, no restating the owner's words, no
narrated reasoning (grounding stays silent — `tailored-context.md` §3). Length is
earned only by substance — a lane brief, a threat model, a design position — and
the steward flags in half a sentence why it is going long. This is the same
output-contract discipline every lane follows, applied to conversation.

## Knowledge maintenance (v1 — deliberately minimal)

The heart of a working agent is that its stored concepts stay true. v1 is
discipline, not machinery:

- **Whoever structurally changes `server.ts` / `src/client.ts` updates the
  affected claims in `docs/*.md` in the same lane** (rule lives in CLAUDE.md, so
  it rides into every lane).
- The steward's load ritual spot-verifies on every start, so rot is noticed at
  the point of use.

Known future optimization (explicitly deferred 2026-07-21): a read-only
verification auto that periodically re-checks doc claims against the tree and
files rot as a `pending` task. Build it only once the manual rule has demonstrably
failed — same stance as BACKLOG #14 Phase 3 ("prove the signals before automating
the judgment").

## What the steward is NOT

- Not a server feature, slot type, or UI mode — revisit only if the convention
  proves insufficient in real use.
- Not a gate: like every advisory agent (right-tab-agents.md), its judgment never
  blocks or triggers anything mechanically.
- Not cross-project: Fleet-only for now. Generalize the pattern elsewhere only
  after it has proven itself here.
