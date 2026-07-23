# The task queue as an automation substrate

*Design note 2026-07-21. What the queue **is** at each level, what it makes
principally possible, and where to start so the result is safe and compounding.
Grounded in the code (symbols are the anchor — `interface Task` in server.ts,
`tickDispatch`, `capTasks`, the boot-requeue loop — server.ts, grep `requeued after restart`). Governing
constraints unchanged: automation only through gates, external input never
auto-runs, review capacity is the bottleneck, advisors inform / gates decide.*

---

## The queue on five levels

1. **Data.** `Task {id, text, source: owner|intake, from, status, created, slot,
   note}` — a flat array, persisted in fleet.json, capped at 200 (`capTasks`
   keeps all live + newest done). `text` is raw prompt text, max 20k.
2. **State machine.** `pending → queued → sent → done`, plus `delete`.
   Transitions and who may make them: create → owner API (pending, or queued if
   `queue:true`) / intake (always pending); **queue/unqueue → owner only**;
   sent → dispatcher only (sets slot+note); done → owner, or `landLane` before
   kill; boot-requeue → sent reverts to queued if its slot no longer hosts the
   lane (server.ts, grep `requeued after restart`); dispatch-fail/slot-changed → sent reverts to queued
   with a note.
3. **Policy (the dispatcher).** `tickDispatch` is the *only* consumer of
   `queued`. Serial (a busy-lock), gated (`dispatchOn` + `FLEET_DISPATCH_REPO`,
   off by default), budgeted (`DISPATCH_MAX_LANES`), one task per tick, FIFO by
   array order. It creates a worktree, opens a slot, **injects `text` verbatim**,
   re-verifying the slot is still its lane before sending.
4. **Invariant.** The queue is a **review buffer, not a work buffer**. Its whole
   purpose is the human gate between "something wants doing" (pending) and "a
   lane may run it unattended" (queued). Intake proves the stance: external text
   lands `pending`, never `queued`. Serial+budgeted exists so an intake burst
   can't outrun review capacity.
5. **What it really is, fused.** Three separable things in one array: an
   **inbox** (pending — things to maybe do), a **ready-queue** (queued —
   approved work), and a **dispatch policy** (when/how it runs). Each is its own
   automation surface. Seeing them apart is the key to using the queue well.

## The central realization

The queue is the universal **"work wants doing" ledger**. Today only two sources
write to it (owner, intake) and its text is raw. But *everything that observes
the system* produces work: intake mail, the steward's Rundgang, a failed
verification, the owner's own ideas. Route them all into the **same pending
gate**, and the queue becomes the one place where every proposed action —
human-, external-, or agent-originated — waits for one human decision. That is
not a new mechanism; it is the intake stance generalized. The gate is what keeps
it safe as the number of *producers* grows.

Two amendments make the ledger powerful, both already implied by earlier docs:
- **Producers multiply, the gate stays one.** The steward filing a pending task
  from a Rundgang observation is the natural, safe output of its judgment: it
  makes its observations *actionable* without giving it action capability. Same
  as intake — it may write pending, never promote.
- **Compile at promotion.** `automation-synergies.md` Finding 4: a task's raw
  text should become a §7 brief before it becomes a lane. The compile step lives
  exactly at the `pending → queued` transition — the dispatcher then injects a
  brief, not a rough note. Promotion becomes *review a compiled brief*, which is
  the owner's praise-gate applied one level upstream.

## What becomes possible (ranked by leverage × safety)

1. **Steward files pending tasks (highest — small, safe, compounding). BUILT 2026-07-22:**
   `POST /api/steward/tasks` (steward-scoped) — status HARD-FORCED to `pending` in code, any
   `queue` field discarded (exactly the constraint below), `source:"steward"`, capped open
   proposals (`FLEET_STEWARD_MAX_PENDING`, default 10 → 409), audited (`steward_task`), badge +
   review-hot in the queue panel. The owner promotes at the same gate as intake. *Original
   rationale:* give the steward token scope to file as **pending only**. Its
   Rundgang observations (stalled lane needs rebase, doc claim rotted, a
   Hardening item's code was just touched) become reviewable tasks. Zero
   task-model change; the pending gate already guarantees safety. This is what
   turns the steward from "reports things" into "queues things for your
   decision" — the join between the autonomy ladder and the queue.
2. **Compile-at-promotion (high).** The brief compiler (Finding 4) runs on
   `pending → queued`: raw note in, §7 brief out, owner reviews the brief. One
   mechanism serves owner tasks, intake mail, and steward-filed tasks alike.
3. **Verify-aware done (high, needs Finding 1).** A task carries its
   `verifyCmd`; "done" means the server ran it green in the lane, not just a
   human clicking. A failed verify routes the task to a `needs-attention` state
   instead of silently to done. Closes the loop the dispatcher is currently
   blind to (it never learns whether a dispatched lane succeeded).
4. **Typed tasks (medium).** Today task = "spawn a lane, inject text". A
   `kind` field (lane | review | verify) routes execution: a lane spawn
   for real work, an ephemeral `summaryViaSession` agent for review/summary
   (the Finding-3 plumbing). Lets the queue drive cheap read-only agents, not
   only expensive lanes.
5. **Task dependencies (medium, defer).** `dependsOn` + the dispatcher skipping
   tasks whose deps aren't done turns the flat FIFO into a plan/DAG ("build the
   verify-gate after the token lane lands"). Real power, real complexity —
   build only when a concrete multi-step plan needs it, not speculatively.
6. **Recurring task generators (low-medium).** The autos×queue intersection: a
   schedule that *files a pending task* ("every morning, file 'review open
   lanes'") rather than typing into a pane. Safer than a pane-typing auto
   because its output lands behind the gate.

## The line that must not be crossed

The queue's safety is entirely the gate between pending and queued. Therefore,
never, at any stage:
- The steward (or any agent/producer) promoting its own task `pending → queued`.
  Producers write pending; only the owner promotes. A steward that files **and**
  promotes **and** the dispatcher runs = a fully autonomous loop with no human —
  precisely the anti-synergy `automation-synergies.md` names.
- The dispatcher treating agent-filed tasks differently from intake — same
  `pending` origin, same human promotion.
- "Done" being auto-set on work that changes `main` — landing stays human
  (Invariant 1); verify-aware done gates *readiness for review*, not merge.

Advisors (including the steward) inform the queue; the gate decides; the
dispatcher, deterministic and dumb, runs what the gate approved.

## Where to start (matched to the running build order)

This is a design note; nothing here jumps the queue ahead of what's building.
The order that makes each step earn the next:

1. Land the **token lane** (running) — it already gives the steward a scoped,
   audited principal. Add **`POST /api/tasks` (pending only)** to that scope, or
   the immediately following lane — this is item 1 above and unlocks everything.
2. Build the **Rundgang** (ladder stage 1) so the steward *has* observations to
   file. Filing pending tasks becomes its primary actionable output.
3. Fold the **brief compiler** in at `pending → queued` (Finding 4) — one
   mechanism, three producers benefit.
4. Then, gated on proven need: verify-aware done, typed tasks, dependencies —
   each built when a concrete plan demands it, never speculatively.

First concrete build, smallest safe increment: **steward-token scope for filing
pending tasks.** It changes no task-model invariant and converts the steward's
judgment into reviewable proposals — the exact join between the automation
ladder and the queue.

**Hard build constraint (steward review 2026-07-21, confirmed against the
code).** It is *not* merely "allow the route for the steward token." The single
create endpoint `POST /api/tasks` (its handler in server.ts — grep `"/api/tasks"`)
sets `status` from `body.queue === true` in the *same call* —
create and promote are fused there. If the steward principal is simply mapped
onto that route, a single `queue:true` in the body self-promotes to `queued` and
the whole pending gate is bypassed by one forgotten field. The scope check must
**hard-force `status:"pending"` and discard `body.queue`** for any non-owner
principal — "pending only" enforced in code, not convention. This is the one
place the pending→queued boundary is most easily undermined in practice; the
token lane (or its successor) must encode it, not assume it.
