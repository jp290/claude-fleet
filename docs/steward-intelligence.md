# Making the steward truly autonomous — and truly intelligent

*Capstone design note 2026-07-21. The endgame is a steward that runs autonomously
(JP). Everything built so far guards a human gate as inviolable. This doc resolves
that apparent contradiction, defines what "intelligent" (not merely "automated")
requires, and sets how we think and act from here. It sits above
`steward-autonomy.md` (the loop's joints) and `queue-automation.md` (the ledger);
those are the mechanism, this is the theory of the thing. External-agent lessons
(Hermes, OpenClaw) fold into §6 once studied.*

---

## 1. Autonomy and the gate are not opposites — two axes were being conflated

The whole "autonomous vs. human-gated" tension dissolves once you separate two
independent axes of every action:

- **Reversibility.** A nudge, a commit (git-resettable), filing a *pending* task,
  running a read-only verify, a summary — all reversible or zero-blast-radius.
  Landing to `main`, sending outbound mail, killing work, spending money, any
  external side effect — irreversible or high-blast-radius.
- **Proven track record.** How reliably the steward has handled *this class* of
  action in the past, measured from outcomes.

The gate belongs on the **irreversible** axis — permanently. That is not a ceiling
on autonomy; it *is* safe autonomy. Truly autonomous therefore means:

> On the vast **reversible** majority of session management, the steward acts
> without asking. On the **irreversible** minority, it does not act and does not
> freeze — it **prepares the decision so completely that the owner's approval is a
> glance, not an investigation.**

The goal is not to remove the human. It is to shrink the human's role to exactly
the decisions that are genuinely theirs — the irreversible ones and the
taste/scope ones — and make even those cheap. The owner stops being the *operator*
of the machine and becomes its *board*: it approves the irreversible and sets
direction; the steward runs everything else. That is "so autonom wie möglich" done
correctly, and it is strictly more autonomous than a system that must ask about
everything because it can't tell the categories apart.

## 2. The backlog is the release valve that makes autonomy possible

JP: for big decisions, a backlog. Exactly — and its role is structural, not
cosmetic. An autonomous loop that hits a big decision has only three options:
freeze (autonomy dies), overreach (safety dies), or **park it with full framing
and keep going**. The backlog is the third option. It is what stops every large
question from stalling the loop.

Two tiers, already half-present:

- **Task queue** (`queue-automation.md`) — near-term, reversible, per-lane
  actions. Short-lived. The steward *files pending*, the owner promotes.
- **Backlog** — long-lived big decisions, design questions, open threads,
  features. Already exists as `BACKLOG.md` (human-curated). The steward's job here
  is to **append well-framed decision items** — options, tradeoffs, a
  recommendation and its reason — and **never decide**. This is the "prepare so
  approval is a glance" move applied to strategy.

When the Rundgang meets something big/irreversible/taste-shaped, it routes to the
backlog, not to action. The backlog is thus the steward's channel for exactly the
decisions it must not make — which is what lets it act freely on everything else.

## 3. What makes it *intelligent*, not merely automated: three models + a learning loop

Automation is fixed rules firing on triggers (playbook v1: `idle + dirty → nudge`,
forever identical). Intelligence is an agent that **builds and refines its own
model of the world and adapts from outcomes.** The difference is memory and a
learning loop, and it requires three durable models — the steward's actual mind:

1. **Model of the system** — how Fleet works. *Home: the docs shelf* (exists,
   self-maintaining via the load ritual + rot-sweep).
2. **Model of the owner** — JP's preferences, standards, what "good" means to him,
   which nudges he welcomes vs. resents. *Bootstrapped from the mined historical
   prompts; grown from every correction.* **New — needs a home.**
3. **Model of itself** — its own track record per action-class: what it did, what
   happened, did it help. *Home: the journal.* This is the model that *earns
   autonomy expansion* (§4).

The **learning loop** (autonomy joint 6, hereby promoted from "last, advisory
forever" to *the actual point*): journal outcomes → periodic distillation →
*proposed* updates to the playbook and the owner-model → **owner promotes** →
models improve. It stays advisory (proposes, never self-applies — the same
quarantine invariant as code and the pending gate), but it is the engine by which
the steward gets measurably smarter in a way the owner can audit line by line. A
supervisor without this loop is a cron job; with it, it is a colleague who learns
your preferences.

### Physical homes (resolved — this was the open thread)

The steward's durable state **cannot live in its worktree** (dirties it, and
worktree churn would wipe it). It lives server-side, beside `fleet.json`, on the
`appendEvent(file, obj)` machinery the token lane just built:

- **`steward-journal.jsonl`** — append-only, mode 600, via `appendEvent`. Every
  intervention + outcome. First consumer of `appendEvent` after `audit.jsonl`
  (exactly the reuse `automation-synergies.md` Finding 5 called for).
- **Owner-model** — a curated document the steward *proposes* edits to and the
  owner promotes (like the shelf, but about JP). Server-side or a gitignored doc;
  decide at build time.
- **Backlog** stays `BACKLOG.md` in-repo, owner-curated. The steward never writes
  the repo directly; its backlog *proposals* accumulate in the journal / Rundgang
  digest, and the owner graduates what earns a place. Keeps the steward off `main`.

## 4. Autonomy expansion must be a governed process, not a slider

"As autonomous as possible" is reached **per action-class**, each climbing a fixed
ladder, and a class advances **only when its journal track record proves it** —
an auditable criterion, never a vibe:

`observe` (log what it would do) → `propose` (surface for one-click approval) →
`act-then-notify` (do it, tell the owner, easily undone) → `act-silently` (trusted
class, digest-only).

The owner promotes an *action-class* up this ladder the same way he promotes a
task — the **meta-gate**. Promotion evidence = N interventions of that class in the
journal with a clean helped/no-harm record. Irreversible classes are **capped at
`propose`, permanently** — they never reach act-silently, by construction (§1).
This makes "how autonomous" a dial the owner turns per class, backed by data the
steward itself collected, rather than a single scary on/off switch.

## 5. How we think and act from here

1. **Frame every new capability by its axes first.** Before building any steward
   action, state: reversible or not? which autonomy rung does it start on? what
   promotes it? An irreversible action that can't stay at `propose` forever
   doesn't get built.
2. **Build the three models' homes early, cheaply.** The journal is one
   `appendEvent` consumer — nearly free now that the machinery exists. Stand it up
   with the Rundgang so the steward accumulates a track record from day one; a
   ladder with no journal can never promote anything.
3. **Keep the learning loop advisory but real.** Distillation proposes; the owner
   promotes; nothing self-applies. This is what lets autonomy grow *without* ever
   crossing the gate — the steward gets smarter by convincing the owner, not by
   seizing capability.
4. **Two ledgers, one discipline.** Task queue for reversible near-term actions
   (file pending); backlog for irreversible/strategic decisions (append framing).
   Both are producer-writes / owner-promotes. Same gate, two horizons.
5. **Steal proven structure.** Fold Hermes/OpenClaw's loop, state, scheduling, and
   safety patterns into §6 rather than reinventing — see next section.

## 6. Lessons from Hermes & OpenClaw

*(Pending the two architecture studies — folded in on completion. Looking
specifically for: their top-level loop shape, durable-state format, how they
schedule unattended work and bound it, and where — if anywhere — they keep a human
in the loop. Adopt what's proven; reject anything that dissolves the gate.)*

## The one-sentence thesis

A truly autonomous, truly intelligent steward is not one that asks for nothing —
it is one that **acts freely on everything reversible, prepares every irreversible
decision to a glance, parks every big question in the backlog with framing, and
gets provably smarter from its own logged outcomes** — with the human gate intact
on exactly the actions that can't be taken back, forever.
