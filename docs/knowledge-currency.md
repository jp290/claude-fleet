# The knowledge layer, revisited — an amendment, not a rebuild

*2026-07-27. The owner: "some shared knowledge data would fix much of this — then the lane
would've known that you already knew. But we'd probably need some overall project structure, a
python program or so."*

The instinct names a real gap. The conclusion — a new program — is the one thing the evidence does
not support, and this project has already reasoned its way to that answer twice. What follows is
the reasoning in order: what actually failed, what was already decided, what is genuinely new, and
the smallest thing that fixes it.

## 1. What actually failed

At 09:5x, `docs/suite-contention.md` landed on main, root-causing the merge/resolver flake. Around
10:1x lane `e288` hit exactly that flake and spent **seven minutes of exclusive machine time**
re-proving it was a flake. Three candidate causes, and only one binds:

- **Was the knowledge unreachable?** No. Verified live: from `e288`'s worktree,
  `git show main:docs/suite-contention.md` returns the full document, while the file is absent from
  its own working tree. A worktree shares the object database, so **every lane can already read
  main's newest knowledge at any time.** Nobody knew to.
- **Was it undiscoverable?** Partly. Nothing pointed at it at the moment of the red check.
- **Would knowing have changed the behaviour?** **No — and this is the binding constraint.** The
  rulebook says a red check is yours until proven a flake, and `verify-tiering.md` §11.7 prescribes
  a same-tree re-run as the proof. Under that rule, *knowing the mechanism does not discharge the
  proof obligation*. `e288` would have re-run anyway, correctly.

So a shared knowledge store would not have saved those seven minutes. The cost was not ignorance.
**It was that flakiness is adjudicated by doctrine instead of measured from data.**

## 2. What the project already decided

Twice, and both still hold.

`BACKLOG.md` item 17 (2026-07-23, stress-tested against a survey of RAG stacks) is a decision
record: *ingestion is solved, retrieval is missing*; `server.ts` already **is** the common service;
a peer process was rejected on the one-server doctrine; Phase 2 (semantic) is **parked** because the
embedding source is unsolved on an allowlisted network.

`docs/knowledge-layers.md` (2026-07-25) answers this exact question — *does Fleet need a proper
place, maybe a service, where lanes look the project up?* — with **no**, on a sharp argument worth
quoting because it survives tonight:

> The recurring defect in this repo is not "an agent could not find the knowledge" — it is **the
> knowledge said something that was no longer true**. … A second store would add a second content
> identity that drifts on its own schedule.

That is the case against a program, and tonight strengthens rather than weakens it: of the four
knowledge failures this session, **two were mine, and both were currency failures of prose I had
written myself** (the rotation claim from an artifact seen in the wrong directory; the "degenerate
traffic" reading of the ② symptom). A second store would have faithfully served both errors.

**On Python specifically:** a third runtime on this box collides with a documented environment trap
— launchd's context carries neither `~/.bun/bin` nor `~/.local/bin` nor brew, which has already
broken pane spawns here. Fleet is Bun. If a single entry point is wanted, it is ~100 lines of Bun
over the existing surfaces, not a new system.

## 3. What is genuinely new — the gap the prior decision did not name

`knowledge-layers.md` §3 states that **the worktree is the delivery mechanism** and treats that as
adequate: "every lane therefore starts with the full shelf … at zero runtime cost." Its three L1
gaps are all about the index being *wrong*.

Tonight adds a fourth, of a different kind: **the worktree delivers the shelf as of spawn time, and
a working lane's shelf ages.** `e288` was spawned at 07:17 and was still working at 10:1x — three
hours during which main gained the very document it needed. That is not a content-rot failure. It
is a **currency-of-delivery** failure, and it is new evidence, because until this session lanes
rarely outlived the knowledge being written about them.

The fix costs nothing: knowledge is read from `main:`, not from the working tree. One rule.

One file cannot use it. **`CLAUDE.md` is gitignored** (verified) and copied into each lane at spawn.
That single fact causes both the drift the rulebook already documents *and* the write-back loss —
`b5e6` earned a real rulebook lesson tonight ("`e2e-postland-audit.sh` never copied `continuity.ts`;
the standalone harnesses' copy lists are hand-maintained") and it survives only because I happened
to read the pane. The rulebook is the one piece of knowledge that cannot ride with a diff.

## 4. The reframe that generalises it

The owner's sense that "there'd be more of such things needed" is right, and here is the shape:

> **Fleet records conclusions and discards observations. Conclusions rot; observations do not.**

"This check is flaky" is a conclusion — it needs adjudicating, it ages, and it lands in prose that
`discrepancy-audit.md` later has to police. "Check X failed on tree Y at time Z" is an observation:
permanently true, and any reader can re-derive the current conclusion from it.

The suite is the clean example. `check()` (`e2e/harness.ts:22`) builds **867 structured results per
run** — name, pass/fail, detail — pushes them into an array, prints them, and **throws them away**.
Every run of every suite, in every lane, all night. The data that would answer "is this check
flaky?" in milliseconds is produced ~20 times a day and discarded ~20 times a day, and in its place
we run a seven-minute re-proof and write prose about flake families.

The same shape recurs: a red audit row keeps a 4096-char tail (33 PASS lines) instead of the failing
check names — which lane `83d3` is fixing right now at the retention layer, correctly, but the
deeper answer is that the observations should never have been reduced to a text blob in the first
place.

## 5. What to build — three pieces, no new runtime

**(a) A per-check result trail.** `check()` is a single choke point; give the suite a run id and
append `{run, suite, tree, check, ok, ms}` to a trail. Then "has this check failed on trees that do
not contain my change?" is a query, and §11.7's seven-minute proof obligation is discharged by data.
It also answers "which checks failed" for a red audit permanently, ranks flakes by frequency, and
exposes the slow checks. This is the highest-leverage item in the whole knowledge question and it is
the smallest.

It is also not a dead end for item 17: structured rows with source-aware metadata are precisely the
durable asset that item names (the chunker and metadata schema, not the store).

**(b) A lane read surface.** A lane today has exactly **one** route: `POST /api/self/autos`. It can
schedule work on itself and cannot ask the server a single question. Add a read companion —
`GET /api/self/context` — returning what is derivable and currently hand-carried: your fork point
versus main *now*, which other open lanes touch which paths (computed from worktrees, exactly what I
pasted by hand into four briefs tonight), the recent flake ranking from (a), and the current
rulebook revision. Reuses the existing token, channel and state; no new process.

**(c) The `main:` rule.** One line in the rulebook: knowledge is read from `main:`, not the working
tree. Free, and it closes §3's new gap for everything tracked.

**Deferred, deliberately:** tracking the rulebook (it is the owner's file and the split into a
tracked `RULES.md` plus a private pointer is their call, though it would fix drift and write-back at
once); and the observations-over-conclusions principle as written doctrine, which can ride along
with any lane.

**Not to be built on tonight's evidence: item 17's index.** Nothing that failed this session was a
search failure over the accumulated corpus. Building a retrieval layer because a lane could not see
a document written 20 minutes earlier would be solving a currency problem with a search engine.

## 6. The honest cost

(a) is small and self-verifying. (b) is a route plus derivations that already exist scattered. (c)
is a sentence. None of them is the "overall project structure" the question imagined — and that is
the finding, not a dodge: the structure Fleet needs here is a **protocol** (where each kind of
knowledge lives, how it reaches the agent, how it is invalidated), and it already has the substrate
for all three. What it lacked was a lane that could ask, and a habit of keeping what it observes.
