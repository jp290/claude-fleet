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

> **Built since (2026-08-04, `f172053`):** the dispatcher compiles exactly this brief —
> `runEnhance` over the task text, additive-only by contract, `briefHash` on the outcome row.
> The paragraphs below are the design rationale that led there; "inherits generic context"
> still describes a HAND-opened lane, no longer the dispatch path.
>
> **Amended 2026-08-05:** the compile moved OFF the spawn path into the analysis sweep, and the
> git-fact half of it was retired as an illusion. A dispatched lane is a fresh `worktree add`
> off the integration tip, so its `briefPayload` was 0 ahead, 0 behind, nothing uncommitted, no
> commits — an empty DATA block dressed as grounding. The enhancer's real product on this path
> was form plus the `/sharpen3` suffix, and it says so now (`freshLaneFacts`). The grounding the
> section below actually asks for arrives instead from the analyst, which reads the repo and
> names what the brief does not hold up against.

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

### 6a. The source package (`context-snippets.ts`, 2026-09-12)

> **Status:** the pure building block exists and is checked (`e2e/context-plan.ts`, thirteen
> `snippets:` checks). It is NOT yet wired into `briefAndSend` — the delivery seam is held by other
> lanes; the integration is one named hunk waiting on the owning MAIN.

The checklist below asks a brief to "establish the relevant environment". Until now the brief could
only POINT: the anchor block names a file and a heading and copies no source, and the notes block
hands over what someone *wrote* about a surface. Neither gets the lane to the code. The measured
price of that last step is `docs/messungen/opus-lane-kontextkosten-2026-09-12.md` §17-32 — a median
of 52 Bash calls before an Opus lane's first file change, with 153 of 187 observed lanes reaching
their first *commit* before any of them.

`context-snippets.ts` closes that one gap and nothing more. It reads the symbols the brief itself
names — `path#symbol`, a backticked token, or a camelCase token — and returns the exact lines of
those symbols at ONE named commit, ±20 lines of context, under a hard 8192-byte cap. It persists
nothing, registers nothing, and adds no read capability: a lane that could not see a file before
cannot see it now.

Four properties are the whole design, and each was paid for by a wrong first version:

- **Two phases.** `planSnippets` is pure over the brief text plus the tree LISTING and answers which
  few files may be opened; only then are those files read and `buildSnippetPackage` cuts. A
  one-phase module would have had to hold the tree to find one symbol — `server.ts` alone is ~1.5 MB.
- **Coverage before context.** Every symbol is placed at its body alone first; leftover budget buys
  context afterwards. Taking ±20 greedily displaced two explicitly QUALIFIED references on this
  module's own brief. No single hit may exceed half the block; an oversized body is CUT and says so.
- **A label may never out-claim its excerpt.** Overlaps merge only after every range is final: an
  earlier version fused four symbols 210 lines apart, then clipped the result and shipped a label
  naming three symbols the delivered lines did not contain.
- **Every refusal has its own name.** Absolute path, `..` escape, symlink, gitlink, untracked,
  private overlay, unsupported kind, binary, unreadable, symbol-not-found, symbol-ambiguous,
  budget-exhausted. A qualified reference that was refused also BLOCKS the bare fallback for that
  symbol — answering `link.ts#alphaOne` with `alpha.ts#alphaOne` is picking some hit and labelling
  it as the one asked for.

What it does not do: it never widens a lane's surface, never confirms a `files` list, never judges a
note, and a CLARIFY lane receives no package at all — for the exit footer's reason, that such a lane
was told to settle what done means and stop.

### 6b. The integration seam — one hunk, not yet applied

`server.ts` was held by another lane when the block was built, so the wiring is written down here
rather than applied. Three places, and two of them are one-liners.

**(a) the import**, beside the `./context-plan` line:
`import { buildSnippetPackage, planSnippets, renderSnippetBlock, type SnippetFile } from "./context-snippets";`

**(b) `server.ts#repoManifestContextPlan`** — its `ls-tree` loop already reads every line; only the
MODE is thrown away. Add `blobModes: ReadonlyMap<string, string>` to the return type, change
`const [, type, sha]` to `const [mode, type, sha]`, add `if (mode) blobModes.set(path, mode);` beside
the `blobShas` line, and carry `blobModes` out of both `return`s. `programMainContextPlan`
destructures only `repoPlan`/`blobShas` and needs no change. The mode is required because it is the
only thing separating a regular blob from a SYMLINK, and a symlink is the escape no path check sees.

**(c) `server.ts#briefAndSend`** — destructure `blobModes`, hoist `const repoRoot = await
repoRootOf(wt.repo);`, and after `notesBlock`, before `studioLaneBlock`:

```ts
const snipRows = waveRows.map((row) => ({ id: row.id, files: taskView(row).files ?? [] }));
const snippetPlan = clarify ? null : planSnippets({ briefText: brief, tracked: blobModes, rows: snipRows });
const snippetFiles: SnippetFile[] = [];
for (const path of snippetPlan?.reads ?? []) {
  const read = await gitReadRaw(repoRoot, "show", `${head}:${path}`);
  snippetFiles.push({ path, text: read.code === 0 ? read.out : null, blob: blobShas.get(path) ?? null });
}
const snippetBlock = snippetPlan
  ? renderSnippetBlock(buildSnippetPackage(snippetPlan, snippetFiles, { commit: head, rows: snipRows }))
  : "";
```

then `${brief}${notesBlock}${snippetBlock}${studioLaneBlock}${anchorBlock}${clarify ? "" : LANE_EXIT_FOOTER}`.

Two details are not negotiable. **`gitReadRaw`, never `gitRead`:** `gitRead` trims, and losing a
leading blank line shifts every line number after it by one — precisely the number the label claims.
**The position before `anchorBlock`:** the context receipt hashes the anchor block ALONE, so anything
appended after it would be hashed as an anchor. `deliveredBytes` then follows by itself, because it
is computed from `deliveredBrief`; no receipt field is needed, since the version and the selection
are in the delivered block (path, symbol, lines, blob, commit) and checkable there.

**(d) the integration check belongs in `e2e/tasks.ts` (d3)** — the Fleet-tree dispatch, the only
place that delivers inside a REAL git repository (`ROOT`; `fleet-e2e.ts` otherwise runs from a
staging copy that is no worktree at all). Extend `fBrief` with one qualified reference; the existing
`fPrompt.startsWith(fBrief + "\n\nContextPlan v2 anchors")` must then find the anchor block by
`indexOf`, because the source package sits between them. Then two assertions: the delivered excerpt
is byte-identical to `git show <fHead>:<path>` cut at the lines the label itself names, and
`fReceipt.deliveredBytes === byteLength(fPrompt)` with the block present. The mutation that removes
`${snippetBlock}` from `deliveredBrief` reds the first one — no "Quellpaket" in `fPrompt`. That check
is SPECIFIED here, not run: without the surface it cannot be, and it is not claimed as if it were.

### 6c. The head order of a dispatched brief — the KARTE first (queue row a672b626, 2026-09-13)

A row that carries a **valid** card (`Task.card`, `card-extract.ts`) is delivered with the card as a
head in FRONT of its prose. The order of a single-row dispatch, as `server.ts#briefAndSend` assembles it:

1. **KARTE head** — `wave-brief.ts#renderCardHead`: first line starts `KARTE`, then `ZIEL` ·
   `FLAECHE` · `DONE` · `VERIFY` · `VERBOTEN`, closed by `--- AUFTRAG ---`; at most 1.5 KB
   (`CARD_HEAD_MAX_BYTES`, per-field byte budgets, a final clip as guard).
2. **the prose** — `brief ?? text`, unchanged; the card is a reading of it, never a replacement.
3. notes block · studio lane block · anchor block · exit footer — order and bytes unchanged.

A wave brief does the same per row (`renderWaveBrief`: each `--- ZEILE n VON m ---` opens with that
row's head when it has a valid card). The receipt books `briefSource: "card"` whenever the head was
delivered (the wave: the head row's card). **No card, or `valid: false`: no head, and the bytes and
`briefSource` (`raw`/`compiled`/`owner`/`main`) are exactly what they were** — a head built from a
reading the tree refused would put an unestablished claim first. A clarify lane gets no head: it
ignores the brief by design.

Where refine fits: `refine-confirm` no longer folds `done`/`verify`/`files` into the child's text when
the child's card validates (`server.ts#refineChildCard`, `model: "refine"`); the head delivers them.
A child whose card does not validate keeps the folded text, so it never receives less than before.

## 7. Checklist for a good brief

- [ ] **Environment:** the files/constraints/interfaces this task actually touches — curated, not exhaustive.
- [ ] **Done-criterion:** what "finished and correct" means, and what verification proves it.
- [ ] **Silent complement:** the surrounding parameters the agent must hold in mind (call sites, edge cases, adjacent state, "what would make this wrong") — reasoned internally.
- [ ] **Output contract:** emit only the relevant slice, plus a one-line flag of anything unresolved.
- [ ] **No worktree dirt:** deliver via launch/prompt, or a gitignored path — never an untracked file that blocks `land`.

## 8. When the reader is a cheaper model

Everything above assumes a reader that can *reconstruct* the complement it was only
pointed at. §2's whole economy rests on that: you shape the environment, the agent
silently derives the surrounding parameters, and you pay for the slice alone. A cheaper
or foreign model breaks that assumption in one specific place — **it derives less** — and
the repair is the same in every case: what was *induced* must become *stated*.

That inversion costs tokens in the brief. It is affordable for exactly the reason the
cheap model was reached for: those tokens are the cheap ones. A brief that would be
over-stuffed for Opus (§5, first failure mode) is merely adequate for a small model.

**Two seams where a foreign model can enter Fleet, and they need different briefs**
(both measured on the tree 2026-08-08; neither has yet been *run* with a foreign model):

- **The worker tier** — `runWorker`'s subprocess path (`summaryViaSubprocess`): a shell
  wrapper behind one of the nine `FLEET_*_CMD` knobs. The "brief" here is a **prompt
  template in the repo**, not a launch message, and it is reused thousands of times, so
  the cost of stating the complement is paid once. State the output contract literally —
  the shape, an example, and what to emit when the answer is "I cannot": a small model
  that improvises an envelope produces a parse failure, not a wrong answer, and the two
  look nothing alike in the ledger.
- **A lane's harness** — a worktree whose agent is a foreign model (today: the `pi`
  adapter with a foreign provider). Here the brief IS the launch message, and the lane
  discipline in `CLAUDE.md` rides along only if that harness loads context files at all
  (`pi` does — verified live, it prints `[Context] CLAUDE.md` at boot; do not assume it
  of the next adapter, check the pane). What must move from induced to stated: the
  verification command **in full**, the done-criterion as a testable sentence rather than
  a goal, and the named prohibitions — a weaker model follows a listed rule far more
  reliably than it infers an unlisted one.

**The rule that does not relax with model tier:** the done-criterion and its verification
command (§7). A cheap model may be given a smaller task; it may not be given a vaguer one.
Scope down before you brief down.

**Credentials, and this is a mechanism not a preference.** A foreign provider needs a key,
and there are two wrong places for it. Not on a command line — it is then visible in `ps`
to every process on the machine (a credential therefore travels on stdin, never in argv). And not in the **server's** environment when it is
the *wrapper* that needs it: `summaryViaSubprocess` spawns with the server's env inherited,
so a key placed there is handed to every worker rather than the one that asked for it.
The narrow placement is a file the wrapper reads, owned by the wrapper, `0600`.

**What this section is not:** a measurement. No foreign model has run either seam on this
fleet. It is the discipline to brief under, and the first real run is what will correct it —
append what it teaches rather than rewriting this from imagination.
