# Interaction modes — three relationships, one discipline

*Fleet's knowledge is reflexive: a human operating a session, a session operating
another session (the dispatcher briefing a lane), and a session operating itself are
the **same skill** — set up an agent so its output is reliable and its review is
cheap. This doc gives each relationship its concrete do's, don'ts, and failure
modes. The underlying context principle is `tailored-context.md`; the primitives are
`operating-model.md`.*

---

## 1. Human → session

You are the review bottleneck; everything here spends your attention well.

**Do**

- **Chunk work into landable lanes.** One task, one lane, one diff. The unit of
  review is the lane's diff overlay, not its scrollback — if a lane's diff can't be
  read in one sitting, the task was too big.
- **Shape the prompt as a brief** (checklist in `tailored-context.md` §7):
  environment, done-criterion, silent complement, output contract. The ten minutes
  spent framing buy back the hour of line-by-line review.
- **State the done-criterion with its verification.** "Done = e2e tail says ALL
  PASS and tsc is clean" is a brief; "fix the bug" is a hope.
- **Decide watch-vs-leave up front.** Watch when the task is exploratory or the
  agent will hit decisions you haven't delegated; leave when the brief is foolproof
  and verification is deterministic. Watching a well-briefed lane is waste;
  leaving a thinly-briefed one is deferred review debt.
- **Review at the moment of land, not continuously.** The land gates already
  guarantee the mechanical safety (clean, pushed/merged); your review is for
  *intent* — is this the change I wanted?

**Don't**

- Don't run two sessions on the same cwd — that's what lanes are for.
- Don't approve intake tasks (`pending → queued`) without reading them; queued
  means "the dispatcher may spend a lane on this unattended."
- Don't treat a lane's green/idle badge as "done" — today it is an idle heuristic,
  not a verify gate (that's Phase 3). Idle means "stopped", not "correct".

**Failure modes:** review debt (many lanes open, none reviewed — stop dispatching,
review down to zero); scope creep inside a lane (kill it, split the task); blaming
the agent for an ambiguous brief (a wrong first pass is a context bug — fix the
environment and respawn, don't argue the session into shape).

## 2. Session → session (orchestration)

The dispatcher briefing a lane is this relationship, mechanized. Its rules apply to
any session that spawns or drives another.

**Do**

- **Brief like a human would want to be briefed.** The sub-session doesn't inherit
  your conversation. Everything it needs — files, constraints, done-criterion,
  output contract — goes into the launch text. (This is Phase 2: the lane brief
  delivered at launch, never as a file in the worktree — an untracked file blocks
  `land`.)
- **Gate before acting.** Fleet's own automation only fires through gates:
  claude-alive, idle, lane budget, and re-verifying the slot is still yours before
  injecting text (`server.ts:537`). A driver that types into a pane without
  checking who lives there is a confused deputy.
- **Route models by brief quality, not task prestige.** A foolproof brief lets a
  cheap model succeed; a thin brief wastes an expensive one. Tailoring is a cost
  lever *and* a review lever. (Phase 1: per-lane `--model` in `slotCmd`.)
- **Treat the sub-session's output as claims.** Its "done" is your "sent for
  review". Verify with the deterministic signals (`verification.md`), not by
  believing the transcript.
- **Keep dispatch serial and budgeted.** One task per tick exists so that intake
  bursts can't outrun review capacity. Parallelism you can't review is noise.

**Don't**

- Don't fan the *same* task out to N agents and auto-compare — the consistently
  abandoned pattern across every tool surveyed (BACKLOG #10 addendum). Independent
  tasks in parallel, yes; redundant swarms, no.
- Don't let external input reach a session un-reviewed — intake always lands as
  `pending` for exactly this reason.
- Don't leave a spawned session's lifecycle dangling: whoever spawns a lane owns
  resolving its task link (land → done, abort → pending) — the pattern
  `detachSlotTasks` enforces.

**Failure modes:** prompting the wrong session (gate on identity before send);
duplicate work after restart (resolve links on every teardown path); silent spawn
failure (surface the error on the task — `server.ts:548` — never swallow it).

## 3. Session → self

A session is also its own operator: it shapes its future context.

**Do**

- **Set the done-criterion before starting**, in one sentence, with the
  verification that proves it — then actually run that verification before
  claiming done.
- **Sharpen your own prompt** when the ask is rough (the `/sharpen` family): the
  same brief-shaping move as mode 1, applied inward.
- **Use CLAUDE.md as self-instruction.** It is the operative shelf: terse rules
  that load into every session — and, because it is gitignored, into every lane
  automatically. When a lesson is hard-won (env quirk, repeated failure), write it
  there so the *next* session embodies it without being told.
- **Treat prior-session artifacts as claims.** HANDOFF.md, notes, remembered
  numbers: verify against the code and the running system before building on them.
  (This doc set was written that way.)
- **Hand off before context degrades.** A deliberate handoff at ~60% beats lossy
  auto-compaction at 83%; the handoff is a brief for your successor — same
  checklist as any brief.

**Don't**

- Don't narrate the complementary reasoning into the deliverable — ground
  silently, emit the slice (`tailored-context.md` §3).
- Don't retry past ~5 iterations — after that the failure is structural; stop and
  rethink the approach instead of re-rolling it.
- Don't dirty the lane: no untracked scratch files in the worktree (they block
  `land`); scratch goes to the session scratchpad.

**Failure modes:** claiming done from memory of an earlier green run (re-run);
drifting from the original ask over a long session (re-read the request before
each substantive step); writing handoffs that assert instead of pointing (a good
handoff says *where to verify*, not just *what is true*).

---

The symmetry is the point: every "do" above is one of three moves — **shape the
context up front, gate every action on verified state, verify before believing** —
applied to whichever side of the relationship you're on.
