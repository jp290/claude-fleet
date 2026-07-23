# Learning engine v1 — dream pass + landscape survey (2026-07-23)

*The first run of the learning engine (`steward-intelligence.md` §8; `steward-roadmap.md`
Phase 2; `three-axes.md` §7 — axis-3's first turn). A **proposal doc, promoted by the
owner** — nothing here is applied. Produced by a 9-agent Workflow (Opus 4.8): 6 axiom
evaluators (Part A, inward) + 3 landscape surveys (Part B, outward), each forced to a
cited structured schema. Brief: `briefs/learning-engine-v1.md`.*

**Guards honored.** Propose-never-apply (this is the only file the pass wrote; no binding
prompt/model/axiom touched). Honesty gate (two prompts — `sharpen`, `rundgang` — came back
axiom-sound with only bounded edge-gaps; not manufactured into more). Facts outrank claims
(every inward finding cites the target prompt by file:line with a verbatim quote; every
outward finding cites a source and its type). Incremental/relevance (targeted the six
multipliers the brief named; ranked, not exhaustive).

---

## The one-paragraph synthesis (read this first)

Inward and outward **converge on the same two seams.** (1) **The aim axis** — three of the
six prompts (`sharpen`, `rundgang`, `handoff`) emit or record without a *checkable* done +
its verification, and the strongest outward pattern (explicit done-condition pinned at
propose-time, hold-out eval before promotion) is the same gap seen from the outside. (2)
**Read-time retrieval** — the outward survey *independently* ranked *memory-conditioned
briefing / read-time recall* as its #1 adopt across two of three themes, which is exactly
`three-axes.md` §7 (learning engine = the memory axis's first turn), BACKLOG §17 (retrieval
is the missing half), and what the parallel slot-9 retrieval analysis concluded. The write
half of Fleet's learning loop exists (journal + per-class tally); **the un-built half is
pulling the class-matched past lesson back into the next brief.** That is the empirically
surfaced next requirement — the recursive igniter firing on its first turn.

**Weakest prompts:** the session-boundary twins `handoff` + `catchup` — the only two global
(`~/.claude`) prompts here, and both violate JP's *own* review bar ("treat prior-session
artifacts as claims to verify, not facts", OWNER.md §2): `handoff` writes from memory not
git ground-truth; `catchup` trusts `HANDOFF.md` as fact without reconciling it against the
diff. **Strongest:** `sharpen`, `rundgang`, `lane-brief` — the prompts under active doctrine
development — pass cleanly on grounding, extraction, and dose.

---

## Part A — Dream mode (inward): per-prompt axiom diagnosis

Global promote-priority (most output-quality leverage first), across all 16 proposed
rewrites:

| # | Prompt | Axiom | The gap in one line |
|---|--------|-------|---------------------|
| 1 | handoff | A4/A5 | "headings filled" masquerades as "successor can resume" — no done-criterion, no self-check |
| 2 | sharpen (pair) | A4/A5 | done-criterion+verification propagated into the emitted prompt only for compound splits |
| 3 | handoff | A2 | never captures dead-ends / load-bearing reasoning — the highest-value slice for a memoryless reader (OWNER §3) |
| 4 | catchup | A5 | trusts `HANDOFF.md` as fact; no reconcile against the real diff (OWNER §2) |
| 5 | steward-load | A4 | no boot-readiness gate — an under-read (skimmed capstone/gate) is undetectable before acting |
| 6 | catchup | A3 | blanket "read each changed file" pulls in lockfiles / `public/*.js` / `dist/` bulk |
| 7 | lane-brief | A5 | DONE example gates on the one fleet check with a documented flake/collision, no slot to name it |
| 8 | rundgang | A4 | the durability-critical journal POST has no success-verification — a dropped write blinds the next pulse |
| 9 | steward-load | A6 | no emit contract for the load itself — the "here's everything I read" essay dump is unguarded |
| 10 | handoff | A1 | templates from memory, not `git status`/`diff` ground-truth |
| 11 | sharpen (pair) | A9 | unconditional 300-word cap under-grounds a genuine fresh-executor brief |
| 12 | lane-brief | A9 | defers project rules to a large CLAUDE.md by reference, against its own embed-for-Haiku aim |
| 13 | steward-load | A1 | cwd/branch legibility checks trail the read-steps they should gate |
| 14 | handoff | A7 | uniform buckets for every session — no "what does THIS successor need" calibration |
| 15 | catchup | A2 | ordering bug: `HANDOFF.md` said "read first" but listed as step 4 |
| 16 | rundgang | A7 | undirected `$ARGUMENTS` for a schedulable command |

### A.1 — `~/.claude/commands/sharpen.md` (+ `sharpen3.md` variant)

*Role: the intent compiler — the premise multiplier, run on ~32% of substantive owner
prompts. The corpus model (`sharpen-corpus/model.md`) is literally a study of this prompt.*

**Verdict: axiom-strong. Passes A1, A2, A3, A6, A7, A8 cleanly on cited evidence.** Two
genuine gaps, both on the aim axis and both about what the compiler *emits* (not how it
thinks). The `sharpen.md`/`sharpen3.md` diff (`disable-model-invocation` + deep-research
phrasing) is a triage-boundary detail, not an axiom gap.

**Rewrite 1 (A4/A5) — propagate done+verification into every structured deliverable, not
only compound splits.** `sharpen.md:25` / `sharpen3.md:24` currently:
> Shape — structured deliverables get an output shape; thinking gets prose. Split compound tasks into steps with their own done-criteria.

Proposed verbatim:
> 5. **Shape** — structured deliverables get an output shape AND a done-criterion with what proves it (compiler/test > run > judgment, per what the task admits); thinking gets prose and questions, no contract. Split compound tasks into steps, each with its own checkable done.

*Why it matters:* the highest-frequency multiplier serves a verification-first owner; today
a single-deliverable refined prompt can go out with no done-signal. (Outward corroboration:
Part B session-stewardship #1 — "explicit done-condition pinned at propose-time".)

**Rewrite 2 (A9) — make the output cap destination-conditional.** `sharpen.md:31` /
`sharpen3.md:30` applies "under 300 words" unconditionally, colliding with `:19`'s
fresh-executor "embed everything — files, project state, tools, constraints":
> The refined prompt first — no preamble, no explanation. An in-session sharpen stays under 300 words; a fresh-executor brief runs as long as honestly embedding its files, state, tools, and constraints requires — never pad, never clip the grounding to hit a count.

### A.2 — `.claude/commands/rundgang.md`

*Role: the steward's recurring unprompted-attention pulse — a schedulable multiplier that
must stay harmless-when-nothing-changed.*

**Verdict: axiom-sound and unusually well-built.** A1–A3, A5–A6, A8–A9 pass cleanly; its two
load-bearing designs — A2 implicit-complement capture (`:5`,`:7`) and the honesty gate
(`:24-25`, anchored to the prior-journal delta at `:10`) — genuinely hold. Two bounded gaps.

**Rewrite 1 (A4) — verify the journal POST landed.** `rundgang.md:31` writes the next
pulse's delta anchor but never confirms the write succeeded:
> The server stamps the time and appends it; do not emit a free-text JOURNAL line. Confirm the POST returns 2xx — a dropped or rejected journal write silently blinds the next pulse (no baseline to diff, the honesty gate degraded to guesswork); if it fails, retry the body once and, if it still fails, say so in section 1.

**Rewrite 2 (A7) — direct the `$ARGUMENTS` injection** at `rundgang.md:35`:
> If arguments follow, treat them as a narrowing lens on this pulse (e.g. a slot to weight first, a concern to check) — they steer WHERE you look, never WHAT you emit; the three-section contract and the honesty gate hold regardless.
>
> $ARGUMENTS

### A.3 — `.claude/commands/steward.md`

*Role: the boot ritual that loads the steward's whole mind; an under-ground here is
inherited by every downstream steward action.*

**Verdict: grounding, dose, executor-match are sound (all ten shelf docs + OWNER.md +
tailored-context §7 verified present).** Three gaps on the seams a boot ritual is uniquely
exposed to.

**Rewrite 1 (A4) — add a boot-readiness gate after step 4 (`L6`):**
> You are booted only when you can, in one sentence each, state your gate (OWNER.md §4) and the two autonomy axes from the capstone, and name your cwd + branch state. If you cannot, you under-read — re-read steward-intelligence.md before operating.

**Rewrite 2 (A6) — state the boot's own emit contract (extends Voice, `L8`):**
> On load, emit at most one line confirming readiness (gate + cwd + any rotted ref you fixed) — never a summary of what you read. If $ARGUMENTS carries a task, skip even that line and go straight to the work.

**Rewrite 3 (A1) — promote the cwd/branch checks from Constraints (`L10`) to a step 0
before any reading:**
> 0. Before reading: confirm cwd is the steward worktree (not the main checkout — fleet.json/token live there) and the branch is current, merging main in if behind. A wrong-checkout or behind-main boot loads a stale or live-config tree — everything below inherits it. If cwd is wrong, say so and stop.

### A.4 — `docs/lane-brief-template.md`

*Role: the brief every dispatched lane rides on — it sets how cheap a model can succeed.*

**Verdict: axiom-strong — A1–A8 pass cleanly.** Two gaps, both bearing on the stated goal of
a Haiku-cheap brief.

**Rewrite 1 (A5) — give the DONE slot an affordance for a known flake/collision.** The
template's own example (`line 31`, `./e2e-isolated.sh ... ALL PASS`) is precisely the check
CLAUDE.md documents as non-concurrency-safe with a ~600ms pane-capture flake; a Haiku-class
lane handed a bare "tail reads ALL PASS" will 5×-loop on it or report a collision as a real
failure:
> DONE means
> {the verification that proves it — exact commands and what their output must say,
> e.g. "./e2e-isolated.sh tail reads ALL PASS and tsc is clean"; if a check has a
> known flake or collision, name it here so an environmental failure isn't chased as
> a real one}. Run it before claiming done. If the same fix-run-fail loop repeats ~5
> times, stop and report the structural problem instead of iterating further.

**Rewrite 2 (A9) — quote the few relevant CLAUDE.md rules rather than deferring by
reference** (`line 28`):
> - Project rules live in CLAUDE.md (in this worktree) and apply in full; quote the
>   few that bear on THIS task under Constraints above rather than trusting the lane
>   to mine them out of the whole file.

### A.5 — `~/.claude/commands/handoff.md`  *(weakest — highest-leverage fixes)*

*Role: session-boundary context SAVE — what it captures becomes the future session's
environment.*

**Verdict: sound as an output contract (A6) but weak on the aim and grounding axes that
matter most for a SAVE.** Four real gaps; it is a fill-in template with no done-criterion,
templates from memory not git state, and omits the single highest-value slice for a
memoryless reader — the dead-ends and reasoning (OWNER §3: "persist the REASONING not just
the artifact").

**Rewrite 1 (A4/A5) — replace "fill the headings" with a reconstruction criterion + a
successor-reread self-check** (before the section list; and before the announce at `:20`):
> Done = a fresh session that reads ONLY this file (via /catchup, with no memory of this one) could resume the work without re-deriving anything you already know. That is the bar — not 'all headings filled'. Before announcing, reread the file as that memoryless successor and ask: what would it still get wrong, have to re-derive, or retry? Fill those gaps, then save.

**Rewrite 2 (A2) — add a Dead Ends section** (after Key Decisions, `:14`):
> ## Dead Ends
> - Approaches tried this session and abandoned, and WHY they failed — so the next session doesn't burn a cycle re-attempting them
> - Load-bearing reasoning behind the current state, not just what the state IS

**Rewrite 3 (A1) — ground-truth reconstruction step** (before `:3`):
> Before writing, reconstruct the session from ground truth, not memory: run `git status` and `git diff` to see what ACTUALLY changed, and re-read the original request. Treat your own recollection as claims to verify — a handoff written from a drifted memory hands the drift forward.

**Rewrite 4 (A7) — one-line calibration step** (before `:3`):
> First, in one line, name what THIS session's successor would most need to not get lost — let that steer which sections carry weight (a trivial session leans on Next Steps; a deep-architecture or debugging session leans on Dead Ends and reasoning).

### A.6 — `~/.claude/commands/catchup.md`  *(weak — the twin failure)*

*Role: session-boundary context RESTORE — twin of handoff.*

**Verdict: sound skeleton (A1/A4/A6/A7 pass) with two real gaps + an ordering bug.** It
over-reads and it trusts the handoff as fact — the mirror of handoff's own drift, against
OWNER §2's verify-real-state bar.

**Rewrite 1 (A3) — curate the read, skip generated bulk** (`catchup.md:5`):
> 4. Read the changed files that carry intent — source, tests, docs. SKIP generated/vendored bulk (lockfiles, `public/*.js` and other build artifacts, `dist/`). For a large file, read its diff (`git diff main -- <file>`), not the whole file.

**Rewrite 2 (A5) — reconcile HANDOFF against the real diff** (`catchup.md:6`):
> 5. Reconcile HANDOFF's claims against what `git diff main` actually shows — it may be stale or wrong. Where the notes and the real diff disagree, trust the diff and flag the drift.

**Rewrite 3 (A2) — fix the ordering so HANDOFF is genuinely read first** (`catchup.md:6`):
> 1. If `HANDOFF.md` exists in the current directory, read it FIRST — it is last session's orientation. Use it to decide which changed files actually matter before you open them.

---

## Part B — Landscape survey (outward): ranked, mapped to the roadmap

Findings ranked by adopt-value within theme; every finding maps to a phase or is discarded
with a reason. **Facts-vs-claims note:** all findings below are `sourceType: web` (the survey
agents reached live sources); treat the cited claims as external-source claims, not verified
Fleet facts.

### The headline: read-time retrieval is the empirically surfaced next requirement

Three findings across two themes converge on the *same* missing half, and it is the same
thing slot-9's retrieval analysis and `three-axes.md` §7 point at:

- **Memory-conditioned briefing** (orchestration #1) — *Reflexion/ERL retrieve the relevant
  past lesson at the start of each attempt and inject it into the brief; the write-then-read
  loop is what produces the measured gain (ERL +7.8% Gaia2).* Source: arxiv 2603.24639;
  stackviv.ai. → **Phase 2/3.** Fleet has the WRITE half (journal + per-class tally); the
  un-built half is retrieval-at-brief-time.
- **Read-time episodic recall** (prompt-libraries #7) — *store reflections keyed to the
  failure, retrieve them on a similar future situation.* Source: arxiv 2607.01480. →
  **Phase 3/4.** Converts the journal from audit-log into active guidance.
- **Explicit done-condition pinned to an external file at propose-time** (session-stewardship
  #1) — *the outcome sensor later checks exactly that; agents can't redefine success
  mid-run.* Source: addyosmani.com/blog/long-running-agents. → **Phase 3.** Directly fills
  the "outcome half BUILT" gap AND corroborates the inward A4/A5 sharpen finding.

**Recommendation:** this is the single most-cited adopt and it is the decision behind the
slot-9 retrieval work (BACKLOG §17). It should anchor the *next* dream pass (over the raw
corpus, where retrieval is actually stressed — see limitations).

### B.1 — Multi-agent orchestration

| Rank | Finding | Map | Note |
|---|---|---|---|
| 1 | Memory-conditioned briefing (retrieve past lessons into the brief) | Phase 2/3 | headline above |
| 2 | Contract-first fan-out: hand parallel lanes non-overlapping ownership boundaries up front | Phase 4 | Fleet's cross-lane handling is *detective* (doc-collision reconciled after the fact, CLAUDE.md); this is the *preventive* half. Targets the documented lane-vs-main doc-rot pain. |
| 3 | Aggregate completion verification: a collector checks the SET of results covered the original ask | Phase 4/Continuous | Fleet verifies+lands per-lane; nothing checks the landed set covered the owner's ask. foreman could add it. |
| 4 | MAST failure taxonomy (spec-ambiguity / coordination-breakdown / verification-gap) as the tally schema | Phase 3 | a validated small orthogonal vocabulary for the write-time per-class tally instead of ad-hoc classes |
| 5 | Dedicated adversarial critic before results propagate | Phase 5/Continuous | a pre-land critic lane (advisory, never gating — land stays owner-only) fits the endgame ladder |
| 6 | Skill/workflow distillation (distil trajectories into named reusable skills) | Phase 3 | flagged as possibly-speculative for a single-owner tool; only after retrieval (rank 1) proves value |
| — | Redundant same-input fan-out + voting | **discard** | voting is for redundant queries to cut variance; Fleet lanes do distinct work — nothing to vote across |
| — | Native per-invocation worktree isolation (CC v2.1.49) | **discard** | Fleet already IS a worktree-lane substrate |

### B.2 — Long-running / supervisor agents

| Rank | Finding | Map | Note |
|---|---|---|---|
| 1 | Explicit done-condition pinned to external file at propose-time | Phase 3 | headline above; corroborates sharpen A4/A5 |
| 2 | Cross-check self-reports via a SEPARATE judge role, never the worker's own reflection (self-consistency defeats self-grading) | Phase 4 | validates + sharpens "cross-checked vs facts": the checker must be a distinct invocation from the reporting session |
| 3 | Confidence-band ladder (certainty as an escalation axis independent of blast-radius) | Phase 5 | gives promotion a 2nd dimension: low-blast+low-confidence still routes to owner |
| 4 | Source-of-truth rule + periodic reconciliation sweep for missed events | Phase 3 | a journal-vs-live divergence flag + catch-up sweep hardens the effect-sensor against between-pulse drift |
| 5 | Evidence/test ratchet: agent may not edit its own evidence to show completion | Phase 3 | make the effect-sensor's evidence append-only + worker-immutable |
| 6 | Three-way partition with a distinct auto-DENY denylist (not just escalate) + per-decision audit | Phase 5 | a cheap safety floor for ladder promotion |
| 7 | Scoped credentials with TTL/auto-revoke on completion | Phase 5 | FLEET_SELF_TOKEN already slot-scoped; TTL is marginal on a single-owner local box — low adopt-value |
| — | Heartbeat context-refresh phase; Brain/Hands/Session split | **discard** | already adopted (reason-from-facts + harness-mediated delivery + ephemeral worker + journal) |
| — | EU AI Act oversight mandates / gateway policy layer | **discard** | assumes multi-tenant regulated cloud; Fleet is single-owner local, land owner-only forever |

### B.3 — Prompt-as-artifact / self-improving prompt optimization

| Rank | Finding | Map | Note |
|---|---|---|---|
| 1 | Hold-out regression eval set: promote on generalization to a frozen labeled set, NOT the incident that spawned it (GEPA-in-production) | Phase 2 + Continuous | turns Fleet's "proved on N=1 trigger case" into "proved to generalize" — the guard prove-before-schedule lacks |
| 2 | Reflect over real execution TRACES to diagnose, THEN propose the edit (GEPA/TextGrad/Reflexion derive mutations from rollouts, not first principles) | Phase 2/3 | **meta-critique of THIS pass** — see limitations. The missing input is the concrete failed transcript. |
| 3 | Keep a Pareto frontier of complementary prompt candidates (each best on ≥1 instance) vs collapsing to one global-best | Phase 5 | matches Fleet's already class-keyed tally; promote multiple narrow proposals that each win a slice |
| 4 | Memory consolidation: extract → dedup / merge / link / forget (Mem0, A-Mem) vs append-only | Phase 3 | the maintenance step that keeps the three-model journal a signal, not a landfill |
| 5 | Keep effect-sensor objectives SEPARATE as a Pareto vector (quality / cost / latency), don't flatten to one number | Phase 3 | lets a proposal be rejected for a cost regression a blended score would hide |
| 6 | Prompt semver + A/B shadow (run candidate alongside incumbent on a real lane before promotion) | Phase 5 + Phase 3 | git-tracking mostly covers version+changelog; the shadow is the delivery mechanism propose-never-apply lacks (read-only-safe since land is owner-only) |
| 7 | Read-time episodic recall keyed to failure-class | Phase 3/4 | headline above |
| 8 | Eval-efficient candidate selection (bandit/Bayesian pick which proposal to prove first, ~35× fewer rollouts) | Continuous + Phase 5 | makes prove-before-schedule affordable when dream mode emits several proposals — each proof is an expensive real session |
| 9 | Adversarial hardening: self-improvement loops are a persistent-injection surface (Zombie Agents) | Phase 4 | mostly validates Fleet's design (propose-never-apply + injection-scan + owner land gate defuse it); add a self-reinforcing-injection case to the scanner's test corpus |
| — | APE blind N-variant meta-prompting | **discard** | the less sample-efficient ancestor of trace-reflective mutation (#2); adopting both wastes proof-lane budget |

---

## The honest section — what this pass did NOT find, and where it is thin

- **No new lesson was manufactured.** `sharpen` and `rundgang` came back axiom-sound; their
  edits are bounded edge-cases (a cap, an arg hook, a POST check), not the "sharper version"
  the honesty gate would have let me invent. Reported as passes, per the guard.
- **This pass reflected from first principles, not from failed traces.** Part B #2
  (GEPA/TextGrad) is the sharpest critique of the pass itself: the evaluators diagnosed
  prompts against the *axioms*, not against concrete transcripts where these prompts
  *actually* underperformed. Every inward finding is a **plausible** gap cited to the prompt
  text — not one is evidenced by a logged failure of that prompt. **A stronger v2 reflects
  over the real session record.** (This is also why the corpus GUARD binds: axis+direction
  need the live read, not a table.)
- **Retrieval was named but not stressed.** This pass ran dream-mode over six *hand-listed
  structural prompts* — tiny files that fit trivially in a fan-out. It therefore did **not**
  exercise the 2.8 MB prompts.jsonl / 8.7 GB transcript retrieval question. It confirms
  slot-9's finding #7 only in the narrow sense that *prompt-level* dream mode needs no index;
  the retrieval requirement is real for the **next** pass (over the raw corpus), which is the
  one BACKLOG §17 should be decided against. (Coupling per `three-axes.md` §7: this session
  supplies the retrieval layer's requirements empirically — and the finding is: *retrieval
  is not yet the bottleneck at prompt scale; it becomes one at corpus scale.*)
- **Corpus caveat rides along:** the sharpen-corpus model that framed the evaluators is a
  Sonnet-pass-1 claims layer (`model.md` Numbers caveat); it was used as a naming lens, not a
  lookup.

## What I did NOT evaluate (explicit coverage boundary)

- **Prompts out of scope of the brief's six multipliers:** `/foreman`, `/rundgang`'s
  server-side digest worker prompt (`runStewardDigest`), `/dispatch`, `/weave`, the
  `sharpen1`/`sharpen2` variants, and every non-structural slash-command.
- **The raw session corpus** (`streams/prompts.jsonl`, `~/.claude/projects/**` transcripts,
  `steward-journal.jsonl` aggregate) — the actual dream-mode substrate §8 envisions. This
  pass evaluated the *prompts*, not the *record of the work*.
- **Whether the proposed rewrites actually improve outcomes** — none were tested against a
  real invocation (propose-never-apply; and there is no eval set yet — Part B #1 is exactly
  the missing guard). Each rewrite is a cited proposal, not a proven improvement.
- **Non-prompt multipliers** — models, the ladder wiring, the effect-sensor code — out of a
  prompt-axiom pass's scope by construction.
- **Live behavior of the current prompts** — I read the prompt *text*, not sessions that ran
  them. No claim here rests on observing a prompt fail in production.

---

*Next, if promoted: (1) pick the rewrites to apply from the Part-A priority table (owner
promotes — these edit binding prompts); (2) build the Part-B #1 headline — read-time
retrieval — as the next structural item, decided together with slot-9's BACKLOG §17
analysis; (3) run dream-mode v2 over the raw corpus with an eval set (Part B B.3 #1) so the
next pass reflects over real traces, not first principles.*
