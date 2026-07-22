# The steward roadmap — the ordered plan (2026-07-22)

*The ordered plan across the accumulated backlog. The order is **derived from principles,
not preference** (below) — so it's auditable and it survives new items being added. A
living doc: rank shifts with evidence. Read alongside `steward-intelligence.md` (the why —
§1 doctrine, §3 three models, §4 ladder, §7 impact layer, §8 the learning engine),
`synergy-findings.md` (the backlog's evidence + line refs), `steward-overview.md` (as-built),
`OWNER.md` (the owner-model). Treat every claim as a claim to verify (CLAUDE.md).*

---

## Where we're going (the destination, one paragraph)

A steward that is a genuinely-helpful colleague, not a cron job: it **reasons from facts**
(not LLM guesses), **acts freely on everything reversible** while the permanent gates on the
unrecoverable-and-large-blast few stay fixed forever, **prepares every irreversible decision
to a glance**, **gets provably smarter** from a gated learning engine (dream mode + Grok) that
keeps its three models current from lived experience, **runs a library of proven prompts**
whose value the owner already verified, and eventually **orchestrates Opus/Fable lanes** it
briefs and prepares to a glance — shrinking the owner's role to the board's: approve the
irreversible, set direction. (`steward-intelligence.md` thesis.)

## How the order is derived (four forces + the dominant discipline)

1. **Dependency** — *facts before claims* (you can't cross-check a self-report against a
   deterministic signal the steward can't see); the outcome-tank before the ladder that
   drinks from it.
2. **Safety + reversibility first** — close the cheap safety seams before building on them;
   do the reversible / worktree-isolated things freely, gate the doctrine-touching ones last.
3. **Ceiling-raising leverage** — do the thing that makes everything after it better, first
   (the signal-quality lever raises the ceiling on all judgment downstream).
4. **Prove-before-trust** — the beat is live; watch it prove, and don't build autonomy
   machinery before the data that fuels it exists.

**The dominant discipline: don't sequence by excitement.** The ladder, the outsourcing, the
learning loop are the thrilling endgame — and they sit on unbuilt foundations (trustworthy
signals, recorded outcomes, one safe delivery gate). Building the top first is the "checklist
vs. good work" failure: autonomy machinery with no fuel, over unclosed seams.

## The phases

**Phase 1 — Foundation** *(next; all reversible / low-risk → act-freely to prototype)*
Make the steward reason from facts, behind one safe delivery gate. One phase because these
touch the same code and share `claudeAlive`.
- **Tier 1 signal-sharing** (`synergy-findings.md`): **surface `claudeAlive` first** — the
  linchpin (fold into `tickGit`'s loop + cache **for reads**, *not* inline per poll; but keep the
  delivery/dispatch **gates** on a **fresh** check — a 10 s-stale cache can gate a send into a
  just-dead pane); the **full `mergeLast` verdict** (only the `resolved` bool is exposed today),
  the summarizer's **`verification`/`openThreads`** (advisory), plus `idleMs`, `gitOp`, `Task`
  status. **The `condition` classifier is deferred within the phase** (corrected 2026-07-22): its
  git-derived subset is already derivable by the steward (`/api/steward/sessions` ships `git`,
  `server.ts:2639`) and is not the 6-way `rundgang.md:14` taxonomy — a real classifier needs
  `claudeAlive` and an unbuilt `stuck-looping` detector, so the pulse keeps deriving `condition`
  in-LLM meanwhile.
- **Tier 0 `canDeliver()` consolidation** — **DONE (landed `5e653dc`)**: one choke-point
  (imitating `createAutoForSlot`) now makes the kill-switch/quiet **and** a fresh `claudeAlive`
  reach every delivery path. Closed: the kill-switch/quiet not gating a direct
  `/api/steward/send` or the dispatcher; the dispatcher's no-`claudeAlive` bare-shell-exec risk.
  **Still open: the send-cap `.1`-rotation miss** (Tier-0 #3).

**Phase 2 — Prove impact** *(high value / effort; where the value shows)*
- **`summaryViaSession` as the digest engine** — the Rundgang's mechanical half becomes
  `summaryViaSession(compose(journalTail, sessions))`, which **fixes context-drain** (the
  pulse leaves the steward's degrading conversation) with zero new machinery.
- **The learning engine, v1** (`steward-intelligence.md` §8): the **Grok/web survey** (outward —
  what agents do most impactfully) **+ dream-mode v1** (inward — evaluate our structural
  prompts against the axioms, propose sharper versions). A manual v1 runs now: the two things
  it needs — the owner-model and the axioms — already exist. Prove-before-schedule.

**Phase 3 — Self-model home + outcomes** *(the learning loop's fuel)*
Grow the journal into the durable **three-model home**; record intervention **outcomes** +
a **write-time per-class tally** (never a scan of the rotatable journal — §4) + the
**effect-sensor** (post-intervention `lastOutput`/`gitInfo` delta, guarded against firing on
stale state). Data starts accruing at the **propose rung** — the steward proposes, the owner
approves, the outcome is logged — with no autonomous action yet.

**Phase 4 — The self-report channel** *(the common-service increment; §8)*
A **typed, advisory** session→server report path (intent / blocker / done+how-verified),
injection-scanned, **cross-checked against Phase-1 facts, never gating**. Then the **sleeper**:
cross-lane conflict detection (a real pain in the mined history).

**Phase 5 — The gated endgame** *(only once the foundations hold)*
Ladder **promotion** (now it has fuel); the steward **files a `pending` Task** (owner still
promotes — the anti-synergy holds); **per-session model** via `summaryViaSession`'s existing
`--model` hook → Opus/Fable lane dispatch. **Land stays owner-only forever**; promote only
what the journal earned.

**Continuous** — **test the steward under the long-autonomous lens** (starts with today's
beat: honest, quiet-when-nothing-changed, non-drifting, *uses* the owner-model's risk map);
**Item A** (the real commit-functions QA gate, owner-requested "at the end") slots into
Phase 2/3 wherever it doesn't block; **prove-before-promote** at every rung.

## Concepts introduced this session (index → theory)

- **The layer-gap lens** — deterministic-sharing (facts, pull) vs. self-report (claims, push).
  → `steward-intelligence.md` §8.
- **The common-service resolution** — it's the server; extend, don't spawn a peer process. → §8.
- **The self-report channel** — typed, advisory, injection-scanned, facts-outrank-claims. → §8.
- **Dream mode + the learning engine** — the learning loop as offline reflection over the raw
  corpus; structural prompts as the multiplier target; propose-never-apply; Grok (outward) +
  dream (inward). → §8.
- **The standing bar** — every structural prompt is built by the axioms; dream mode enforces
  it. → `prompt-axioms.md` (self-reference).

## Two open owner calls (the rest, proceed on)

1. **Does the digest engine (Phase 2) jump the queue?** Most *visible* payoff, independently
   useful — kept at Phase 2, but a case exists for prototyping it early to feel the value.
2. **Cross-lane conflict detection** — pull forward into its own early track, or leave the
   Phase-4 sleeper? Leaning *leave it* (relevance over completeness), but the owner has felt
   that pain.

## Discipline (living)

Everything through Phase 4 is reversible / worktree-isolated to build — act-freely territory
to prototype under the 2026-07-22 doctrine; only the permanent gates (`OWNER.md` §4) stay
fixed. Rank shifts with evidence, never argument.
