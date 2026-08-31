# Grok Research Brief: Empirical GameStudio Pi-Harness Gap Analysis

You are a fresh Grok research session. Your job is a **gap analysis grounded in observed production
history**, not a design from first principles.

## What this is NOT

- Not a tutorial on Pi, game engines, or agent harnesses.
- Not a request for a new game scaffold, a demo scene, a rotating cube, or any "hello world" MVP.
- Not a generic plugin/MCP shopping exercise. A list of tools with no marginal-benefit argument
  against a project-local script is a failed answer.
- Not an invitation to design a large universal GameDev harness. Attack that premise explicitly in
  your final deliverable.

## Portfolio context you must respect

Claude Fleet is a local control plane that runs and supervises coding-agent sessions (Claude, Codex,
Pi-compatible harnesses) in tmux-backed slots, with isolated worktree lanes, Programs, delegation,
evidence-gated verification, server-side landing, and post-land audits. **Fleet today owns tasks,
workers, harness/model/effort selection, worktrees, verification, landing, and audits.** Pi is the
execution harness inside a Fleet session, not a competing orchestration layer.

Two implementation-status facts you must not blur:

1. **Act Lead is not built.** `SYSTEM.md` allows a complex worker to open child acts, but the role
   is neither adopted nor refused, and `delegate_act` is target vocabulary with **no implemented
   route**. Never describe it as existing functionality.
2. The GameStudio vocabulary in `SYSTEM.md` (criteria, build, criticism, repair, verify, tasting as
   related act kinds) is **owner-facing target prose**. Current code and live sensors outrank it for
   what exists today. Your analysis must keep target vocabulary and shipped capability separate in
   every table and sentence.

## Evidence pack (supplied to you separately)

You will receive a pack of historical artifacts. Its provenance: local, untracked snapshots dated
**2026-08-19**. Treat it as **historical evidence, not current live state**. Known contents:

- Nine individually verified playable artifacts: Private-repo-g, Private-spiel-a, Private-spiel-b, Pinball
  Overdrive, Private-spiel-c, Private-spiel-d, Private-spiel-e, Private-repo-d, Private-repo-c I.
- Three studios had bound Program MAIN sessions: Private-repo-d, Private-repo-g, Arcade.
- Private-spiel-a ran a frame-based critic loop: the critic judged the arena, pulse communication,
  staged hit feedback, physicalized tool, and living camera; it then named four concrete weaknesses
  — (a) explanatory control text, (b) a combo shown as a number without an in-world carrier,
  (c) a missing rival tell in every captured frame, and (d) an end state not observed in 545 seconds
  across three runs, although a hook showed runs ending and restarting. The repair plan required
  frames proving each correction, a probe that actually reaches the end state or reports it
  unreachable, controlled variants along exactly one taste axis, and identical critic criteria
  across variants.
- **Engine assignments are not established by the snapshot.** No engine may be attributed to any
  game on this list. That field stays `unknown` unless a later artifact states it.

## Working rules

### 1. Reconstruct before recommending

Reconstruct the **proven current workflow** from the evidence pack before proposing anything: how a
studio went from criteria to a verified playable artifact, which loop steps actually ran, which were
manual, and which evidence each step left behind. Every recommendation must cite the observed
workflow step it improves. Recommendations that do not attach to an observed step belong under
"hypothesis," not "gap."

### 2. Classify every finding into exactly one of

- **Proven capability** — already demonstrated by the evidence, with the artifact that proves it.
- **Repeated friction** — appeared in two or more independent cases.
- **One-off project issue** — plausibly specific to one game/studio; label which.
- **Unknown** — evidence absent, contradictory, or stale. Never resolve `unknown` by inference.
- **Genuinely missing harness primitive** — nothing in Fleet, Pi, the project, or the owner's manual
  practice covers it today. This is the narrowest category; resist inflating it.

### 3. Boundary map

For every capability, assign exactly one primary owner among: Fleet control plane / Pi harness /
engine adapter / project-local skill or script / MCP server / plugin / human owner taste gate.
Where two layers must cooperate, say which owns the decision and which executes. Fleet remains the
only orchestration plane; model, harness, and effort selection — and any future capability-profile
selection — are **Fleet-owned routing decisions**, never hard-coded provider model names inside
project configs.

### 4. Cross-engine discipline

Compare cases across actual engines **only when evidence is supplied**. Never infer an engine from a
game name or genre. For every relevant surface (protocol/wire, build, run, observe, probe, evidence
capture, docs) and every engine that appears in evidence, classify `apply`, `unsupported`, or
`not-applicable` — silence is not a decision. If the pack contains no engine facts, that column is
`unknown`, and that is itself a finding for the evidence-request list.

### 5. Promotion threshold

Promote no shared primitive unless **at least two independent studio cases demonstrate the same
need**. Anything below that threshold must be explicitly labeled a hypothesis requiring one more
case, naming the case that would decide it.

### 6. Loop dimensions to analyze

For each, state what the evidence shows today and what is missing: inspect / build / run / observe /
critic / repair / verify / taste; deterministic gameplay probes; end-state reachability; frame and
video evidence; runtime state inspection beyond pixels; logs; performance measurement; asset
provenance; controlled variants; result handoff back to the Program MAIN and owner.

### 7. Mechanism evaluation

For each candidate mechanism — Pi extension, Pi skill, MCP server, native engine/browser CLI,
project-local script — evaluate: marginal benefit over the smallest existing alternative; context
cost (input tokens, oversized tool results); authority fit (does it respect the boundary map);
evidence preservation (are exact logs, frames, metrics, and verification tails recoverable later);
security (privileges, spawned processes, network, credentials, external cost); rollback; maintenance
burden. Rank by marginal benefit, not by feature count.

### 8. Replay test

Replay every proposed mechanism against the supplied **Private-spiel-a failure signatures** — the four
named weaknesses, the unobserved end state, the repair-plan requirements — and against **at least
two further evidence-pack cases**. For each replay, state concretely whether the mechanism would
have caught, fixed, or failed to change the observed outcome. **A green build is never visual or
gameplay proof**; treat any mechanism whose evidence ends at "compiles/tests pass" as failing this
test.

### 9. Missing evidence

Identify exactly which additional artifacts you need from the existing studios (frame captures,
candidacy rubrics, critic transcripts, probe scripts, run logs, engine manifests, taste-gate
records) before any unsupported conclusion, and **request or mark them missing instead of filling
the gaps yourself.**

### 10. Fire trial

Recommend the **smallest next real Studio fire trial** following the current ACP prerequisite chain
(Act 9 gameStudio fire trial and its prerequisites) — a real studio loop with fixed task and rubric
before start, not a toy MVP. Design it with: entry condition, one bounded scope, the loop steps it
exercises, the measurements and falsifiers that would prove or kill each proposed mechanism, and an
explicit migration and rollback path. **The research itself authorizes no code and no
installation.**

### 11. External claims discipline

For every claim about the external ecosystem (Pi plugins, MCP servers, engine tooling, browser
automation), use **current primary sources**, cite them, and do not invent packages, adoption
figures, capabilities, engine facts, or measurements. If you cannot verify a claim against a
primary source, mark it `unknown` and proceed without it.

## Required deliverables

1. **Current workflow reconstruction** — the proven studio loop as evidenced, with per-step evidence
   citations and explicit manual/automated marking.
2. **Cross-case evidence matrix** — cases × loop dimensions × classification, with `unknown` cells
   visible, not smoothed over.
3. **Gap ledger** — ranked by observed frequency and consequence, each gap carrying its
   classification, the cases that evidence it, and its boundary-map owner.
4. **Boundary map** — capability → owning layer, including cooperation seams.
5. **Candidate mechanisms** — each with per-surface `apply`/`unsupported`/`not-applicable` decisions
   and the evaluation axes from rule 7.
6. **One bounded real-studio fire-trial design** — per rule 10.
7. **Measurements and falsifiers** — what each trial measurement proves, and what observation would
   falsify the underlying hypothesis.
8. **Migration and rollback** — for every proposed mechanism.
9. **Open unknowns and owner-only decisions** — including taste gates, engine commitments, and any
   promotion requiring owner authority.
10. **An explicit attack on premature universalization** — argue against your own generalizations;
    name which findings are single-case and must not become shared primitives.

Final discipline: if the evidence pack does not support a section, say so and request the missing
artifact. An honest `unknown` with a named evidence request is a deliverable; a confident guess is
a defect.
