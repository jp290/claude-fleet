# Brief — Learning engine v1 (manual pass)

*Own session, main checkout (`~/claude-fleet`). NOT a lane — inputs (session
corpus, `~/.claude`) live outside the repo; output is a proposal doc the owner promotes.
Model: Opus 4.8 suffices (execution of existing doctrine, big-context survey work; the
doctrine itself is already written). Use a workflow for the dream pass — multi-agent
fan-out → synthesis is the designed shape (steward-intelligence.md §8) and this brief is
the explicit opt-in.*

## Read first, in this order

1. `docs/steward-intelligence.md` §8 (the design + its guards — binding for this pass)
2. `docs/prompt-axioms.md` (the bar every evaluator prompt must itself meet)
3. `OWNER.md` (the owner-model; §4 gate calibration colors what to propose)
4. `docs/steward-roadmap.md` Phase-2 "learning engine v1" entry (scope: manual v1, prove-before-schedule)
5. `docs/three-axes.md` (the program frame this pass serves) — §6 carries the steward's
   2026-07-23 sharpen-corpus axes model, this pass's FOUNDING INPUT: bidirectional drift
   axes, OWNER.md cross-validation, and its limits (Sonnet pass-1 claims layer; ~7-8%
   decoration-word cases; "naming lens, not a lookup"). Locate the corpus itself before
   relying on it (its durable home was an open owner decision — ask if unresolved);
   treat every record as a claim, per the doc's own caveat.

## The two halves

**A. Dream-mode v1 (inward).** Evaluate the structural prompts — the multipliers
(`value × reliability × frequency`) — against the axioms, each diagnosed BY axiom:
`~/.claude/commands/sharpen.md` + `sharpen3.md`, `.claude/commands/rundgang.md`,
`.claude/commands/steward.md`, `docs/lane-brief-template.md`, `~/.claude/commands/handoff.md`,
`~/.claude/commands/catchup.md`. Fan out one evaluator per prompt; each evaluator prompt
must itself be axiom-built (§8 "self-referential quality"). Where a prompt fails an axiom,
propose the sharper version verbatim.

**B. Grok/web survey (outward).** What do the best agent-fleet/steward setups do that we
don't — search the current landscape (multi-agent orchestration, session stewardship,
prompt libraries), and map each cited finding to our phase map (roadmap) or discard it as
not-applicable with one line why.

## Guards (from §8, verbatim intent)

- **Propose, never apply** — the ONLY file this session writes is the proposal doc below.
  No editing of binding prompts, models, or axioms.
- **Honesty gate** — "no new lesson this pass" is a valid, good output; never manufacture
  a lesson to justify the dream.
- **Incremental / relevance** — target the multipliers and what's new; not the whole corpus.
- Facts outrank claims: cite the transcript/file for every inward finding.

## Deliverable + done

`docs/proposals/learning-engine-v1-2026-07.md`, committed: per-prompt axiom diagnosis with
proposed rewrites (A) + ranked, cited outward findings mapped to phases (B) + an explicit
"nothing found" section where that's the truth. Done = that file committed and NOTHING else
modified; end by listing what you did not evaluate.
