# Tailored context & silent grounding

*How to make an agent reliably carry out an arbitrary, semantically-describable
process — and why that is the real lever on the one hard bottleneck in a fleet of
agents: human review.*

This document captures a working principle (articulated by JP) and its application
to Claude Fleet's worktree **lanes**. It is a design note, not a spec.

---

## 1. The problem this solves

In a fleet of parallel agents, the scarce resource is **not** agent throughput — it
is *your* capacity to review what they produced. Ten agents can write ten patches
in the time it takes you to carefully read one. So the bottleneck is review, and the
only way to move it is to make each agent's **first-pass output reliable enough that
review is cheap** — a glance, not an audit.

Reliability of a first pass does not come from watching the agent harder. It comes
from the **context you hand it before it starts**. A well-framed task in a well-shaped
environment produces output you can trust at a glance; a thin task in a bare
environment produces output you must re-derive line by line. The leverage is entirely
up front.

## 2. The principle

> Don't give the agent only the narrow task. Shape the **environment** so that, in
> the course of doing the core task, the agent is led to also construct the
> **implicit, complementary parameters** — the surrounding conditions that bound the
> task — **internally and silently**. Then ask it to output **only the relevant
> result**.

Three moves, in order:

1. **Environment.** Put the agent where the task's world is legible: the files it
   needs, the constraints that apply, the definition of done, the shape of a good
   answer. Not a wall of everything — the *relevant* surroundings.
2. **Silent complementary capture.** Frame the task so the agent must reason through
   the parameters that *complement* the core ask — the adjacent facts, the edge
   conditions, the "what would make this wrong" — as **internal** reasoning, not as
   emitted text.
3. **Output only the relevant.** Have it emit just the slice you asked for. The
   grounding stays internal; the deliverable stays clean.

## 3. Why it works (the mechanism, plainly)

An LLM's output is a function of the internal representation it builds while
generating. Ask for a narrow answer with no surrounding context and it builds a
**thin** representation — the answer floats, ungrounded, and is brittle to anything
the prompt didn't spell out. Induce it to construct the **full complementary
context** first and the same narrow answer is now **anchored** in a complete model of
the situation. The output didn't get longer; its *foundation* got deeper.

Keeping the complementary capture **silent** matters for two reasons:

- The internal representation is richer and less lossy than anything the model would
  compress into visible text. Forcing it all to output both dilutes the deliverable
  and makes the model commit early to verbalized intermediate claims that can then
  drift.
- The deliverable stays exactly the slice you need — no over-generation to wade
  through, which is itself review cost.

This is adjacent to "let the model think first," but sharper: the thinking is
specifically about the *complement* of the task — the surrounding parameters — and it
is deliberately **not** surfaced. Think of it as: **the completeness of the implicit
model sets the ceiling on output reliability; you engineer the context to force that
completeness, then extract only what you need.**

## 4. A concrete shape

Bad (thin): *"Rename `getUser` to `fetchUser`."*
The agent renames the definition, misses three call sites in another module, breaks a
test it never looked at. You review by re-checking the whole change.

Tailored (grounded): *"Rename `getUser` to `fetchUser`. Before editing, silently
establish: every call site across the repo, whether any are dynamic/string-based,
which tests exercise it, and whether the name is part of a public export. Make the
change consistent with all of that. Output only the final diff and a one-line note of
anything you could not resolve."*
Same task. But the agent is forced to internally model the *complement* — call sites,
dynamism, tests, export surface — before touching anything. The diff you get back is
already consistent with the things that would otherwise have made it wrong, and the
one-line note tells you exactly where (if anywhere) to look. Review collapses to a
glance.

The difference is not that the second prompt is longer. It is that it **specifies the
world the change lives in** and asks the agent to hold that world in mind silently.

## 5. Failure modes

- **Over-stuffing the environment.** Relevant surroundings ground; irrelevant bulk
  buries the signal and costs tokens. Curate.
- **Making the complementary capture loud.** If you ask it to *output* all the
  complementary reasoning, you get a wall of text to review — you've re-created the
  bottleneck. Keep it internal; extract the slice.
- **No definition of done.** Grounding without a done-criterion produces a
  well-reasoned answer to the wrong question. The environment must include what
  "finished and correct" means.
- **Under-specifying, then blaming the agent.** If the task's world was ambiguous, a
  wrong first pass is a context bug, not a model failure. Fix the environment.

## 6. Application to Fleet: the lane brief

Today a lane (a `git worktree` + a Claude session) inherits whatever generic context
the repo carries. That is the thin case: the agent gets the repo but not the *task's
world*.

The direction this principle points to: each lane is opened with a **tailored brief**
— a bespoke, foolproof framing of *this* lane's task that (a) establishes the relevant
environment, (b) induces silent capture of the complementary parameters, and (c) asks
for only the relevant result. A lane that starts from a queue task generates its brief
from the task text plus a template; a hand-opened lane can take a brief or a sensible
default. The brief is the vehicle that turns "an agent loose in a worktree" into "an
agent that produces a reviewable-at-a-glance patch."

**One hard design constraint** (learned the hard way): a brief written as a file
*inside* the worktree that git does not ignore shows up as an untracked change, which
makes the lane permanently "dirty" and **blocks `land`** (Fleet refuses to remove a
worktree with uncommitted work). So the brief must not dirty the tree. The clean
option is to deliver it at **launch time** — via the session's initial prompt /
appended system prompt, which Fleet already controls when it spawns the pane — so the
brief lives in the launch, never on disk, and the worktree stays landable. (A copied
file only stays invisible if it is gitignored — the same `.worktreeinclude` rule Fleet
already applies to `.env`.)

## 7. Checklist for a good brief

- [ ] **Environment:** the files/constraints/interfaces this task actually touches — curated, not exhaustive.
- [ ] **Done-criterion:** what "finished and correct" means, and what verification proves it.
- [ ] **Silent complement:** the surrounding parameters the agent must hold in mind (call sites, edge cases, adjacent state, "what would make this wrong") — reasoned internally.
- [ ] **Output contract:** emit only the relevant slice, plus a one-line flag of anything unresolved.
- [ ] **No worktree dirt:** deliver via launch/prompt, or a gitignored path — never an untracked file that blocks `land`.
