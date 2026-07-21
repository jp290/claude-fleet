# Operating model — the primitives and when to reach for them

*What each Fleet primitive **is**, the invariants that hold it together, and the
mental model for choosing one. Knowledge shelf: read this to build the model; the
operative rules a session should embody live in CLAUDE.md, not here.*

Every claim below is grounded in code. The **symbol name** is the durable anchor;
the `server.ts:NNN` line is a convenience that drifts on every insertion — when it
disagrees with the tree, trust the symbol and correct the number (per CLAUDE.md's
"suche die Symbole, vertraue keinen gemerkten Zeilennummern").

---

## The primitives

### Slot
One of 16 fixed positions. Concretely: a tmux session (`fleet-s<N>` on the
`claudefleet` socket) running `claude` in some cwd, streamed to the browser. A slot
has an **identity**: its Claude session id is pinned at spawn (`slotCmd`,
`server.ts:39`) so the transcript path is known, not guessed — and if the pane dies,
the self-heal loop *resumes* that conversation (`--resume`) instead of starting a
blank one (`ensureSlot`, `server.ts:773`). A slot is therefore not "a terminal" but
"a durable conversation with a place to live."

### Lane
A slot whose cwd is a Fleet-created **git worktree** (`createWorktree`,
`server.ts:578`). This is the unit of *landable* work: isolated branch
(`fleet/<stamp>-<rand>` under `<repo>.worktrees/`), own checkout, no file-level
interference with any other slot on the same repo.

Two load-bearing details:

- **Scaffolding is copied only if gitignored** (`server.ts:602-608`): `.env`,
  `CLAUDE.md`, `.claude/settings.local.json` are copied into the fresh worktree
  *only when git ignores them in the source repo*. An unignored copy would show as
  untracked, leave the lane permanently "dirty", and block `land`. This is the same
  rule as Claude Code's `.worktreeinclude`. Consequence: CLAUDE.md being gitignored
  is what makes every lane inherit the project discipline automatically.
- **Lane lifecycle is closed against the task queue** — see Task, below.

Lifecycle: spawn (picker "⎇ new lane" or dispatcher) → work → review via the diff
overlay (`±`, `/api/slots/:id/diff`, backed by `diffPayload`, `server.ts:442`) →
**land** (`⏏`) or kill.

### Land
Deterministic lane teardown that can never eat work (`landLane`, `server.ts:694`,
guarded by `removeWorktreeSafe`, `server.ts:679`). It
refuses when the tree is dirty (409 with the `git status` output) and when commits
exist that are neither pushed to any remote nor merged into the repo's HEAD. The
worktree is removed **first**, while the slot is still intact — a failed remove
(locked, racing dirty state) leaves the lane fully recoverable instead of a
torn-down slot pointing at an orphaned tree. Only after a successful remove is the
lane's `sent` task marked `done` and the slot killed. Known residue: the merged
branch stays on disk (BACKLOG #10 open question).

Kill, by contrast, never touches the worktree (`killSlot`, `server.ts:880`) — the
tree stays on disk, re-openable. Kill is "abandon the slot", land is "this work is
safe elsewhere, retire the lane."

### Task
A queue item with four states: `pending` (owner review) → `queued` (approved for
dispatch) → `sent` (attached to a live lane) → `done`. The invariant: **a `sent`
task is only meaningful while its lane lives in that slot**. Every teardown path
resolves the link (`detachSlotTasks`, `server.ts:870`):

- **land** marks the task `done` *before* the kill, so detach sees nothing.
- **kill / recycle** detaches back to `pending` — deliberately *not* `queued`,
  because the abort was a human decision and re-dispatch without review would
  repeat it.
- **boot** requeues only tasks whose recorded slot no longer hosts their lane
  (crash orphans) — a restart never double-dispatches a healthy lane's task.

### Dispatcher
The one place Fleet acts without a human in the loop (`tickDispatch`,
`server.ts:1086`). It is OFF unless `FLEET_DISPATCH_REPO` is set, and deliberately
**serial**: one queued task per tick, into one fresh lane, only when a slot is free
and the lane budget (`DISPATCH_MAX_LANES`) has room — a burst of intake email can
never fan out into a machine full of unattended sessions. Before injecting the task
text it re-verifies the slot is still *its* lane (`server.ts:1109`) — the owner may
have recycled the slot during the spawn sleep, and prompting an unrelated session
would be a confused-deputy bug.

### Intake
The public, secret-gated dropbox (`FLEET_INTAKE_SECRET`) on the share host. It only
ever creates a `pending` task — external input always lands behind the owner-review
gate, never directly in the dispatch path.

### Share
Exposes exactly one slot to a guest behind its own password (`interface Share`,
`server.ts:58`); the owner token never leaves the machine. A share never outlives
its session — kill and recycle both close and remove it (`server.ts:891`, and on
recycle `server.ts:858`).

### Auto
A scheduled prompt with a **mandatory runs cap** and two gates before it fires: the
slot must be idle and claude must actually be alive (gates in `tickAutos`,
`server.ts:1023-1040`). Same design
stance as the dispatcher: automation only acts through gates.

## The invariants (the actual knowledge)

1. **Quarantine by default; promotion is the human's call.** Work happens in an
   isolated worktree; nothing reaches `main` or the live server except through a
   human-triggered land/merge. The dispatcher can *start* work, never *ship* it.
2. **Never eat work.** Every destructive path is guarded by git's own checks plus
   Fleet's (land's dirty/unpushed refusals, remove-first ordering, kill leaving the
   tree on disk). When in doubt, refuse with the evidence in the error.
3. **Every link is resolved on teardown.** Task↔lane, share↔slot, auto↔slot: no
   reference survives the thing it points to. Dangling links are how a restart
   duplicates work or a guest watches the wrong session.
4. **Automation acts only through gates.** Idle gate, claude-alive gate, lane
   budget, slot re-verification, owner-review for external input. The gates are the
   feature; the automation is just plumbing between them.
5. **Review capacity is the bottleneck, not agent throughput.** Dispatch is serial
   and budgeted because sixteen unreviewed patches are worth less than three
   reviewable ones. The lever on this is the lane's starting context
   (`tailored-context.md`), not more parallelism.

## Choosing a primitive

- Exploring, debugging, a conversation — **plain slot** in the repo cwd.
- Any change meant to be merged — **lane**, always. The diff overlay and land gates
  only exist there, and two sessions on one cwd fight over files.
- Work arriving while you're away (email, ideas, a backlog) — **intake → queue**,
  review to `queued`, let the dispatcher pace it.
- Something recurring in a live session — **auto**, with the cap doing the worrying.
- Showing a session to someone — **share**, one slot, its own password, view-only
  unless interaction is the point.
