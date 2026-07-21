# The map — steward & Fleet automation, one page

*The territory grew to nine design docs; this is the map that makes it navigable.
Not new theory — an index of mechanisms, methods, invariants, and build-state, so
any agent (or future-you, or the steward's load ritual) can orient without
re-deriving. Ground truth verified against the tree 2026-07-21; symbols are the
anchors.*

---

## The five layers (bottom carries top)

```
┌─ OWNER ─────────────────────────────────────────────────────────────┐
│  review (praise-gate delta), promotion (pending→queued, ladder),     │
│  landing — the only actor that ships. Attention is the bottleneck.   │
├─ IMPACT ────────────────────────────── where value lives ───────────┤
│  library of proven prompts/workflows · the Rundgang digest ·         │
│  scheduled self-contextualizing items.   [MOSTLY UNBUILT]            │
├─ RELIABILITY / SAFETY ──────────────── amplifies value, ±  ──────────┤
│  gates (idle, claude-alive, slot re-verify) · scoped tokens ·        │
│  typed+capped sends · audit/journal · the autonomy ladder.           │
│  [audit+steward-principal BUILT; ladder/journal DESIGNED]            │
├─ PRIMITIVES ────────────────────────── the durable machine ─────────┤
│  slot · lane · land · task-queue · dispatcher · intake · auto ·      │
│  share · ephemeral agent (summaryViaSession).   [ALL BUILT, LIVE]    │
├─ SUBSTRATE ─────────────────────────────────────────────────────────┤
│  tmux panes · git worktrees · transcript JSONL · fleet.json          │
└─────────────────────────────────────────────────────────────────────┘
```

## Mechanisms (what), by build-state — verified

**BUILT & LIVE** (on main, server deployed): `openSlot` · `createWorktree` ·
`landLane` (+`removeWorktreeSafe`) · `detachSlotTasks` · `tickDispatch` ·
`tickAutos` · `handleIntake` · `commitLane` · `summaryViaSession` (ephemeral
subscription-covered agent) · `slotCmd` · `audit`+`appendEvent` (the generic
append-only write chain) · `/api/steward/*` (scoped principal: reads, typed+capped
sends, own autos; 403 on owner routes).

**DESIGNED, not built**: the Rundgang (steward stage-1, on `summaryViaSession`) ·
the journal (first `appendEvent` consumer after audit) · the brief compiler at
`pending→queued` · the server-run verify gate · the three durable models
(system=shelf built; owner-model + self/journal designed) · the learning loop.

**SPECULATIVE (frontiers, dependency-ordered, prune with evidence)**:
verify-before-surface → backpressure → self-repair(=a playbook rule) → decay
(promote-slow/demote-fast) → corrections→owner-model → adaptive cadence (v2).

## Methods (how) — the reusable moves

- **Tailored context / the brief** (`tailored-context.md`): reliability comes from
  context handed up front; §7 checklist = environment, done-criterion, silent
  complement, output contract. The lever on review cost.
- **Verification hierarchy** (`verification.md`, CLAUDE.md): deterministic >
  semi-deterministic > statistical. Applies to our design work too — evidence
  outranks argument.
- **The autonomy ladder**: observe → propose → act-then-notify → act-silently, per
  action-class, owner-promoted, journal-earned. Irreversible classes capped at
  propose forever.
- **Prove-before-schedule**: a template is scheduled only after being watched
  working N times — scheduling is the last step of its life, not the first.
- **Capability asymmetry**: assume injection succeeds; make the blast radius
  boring. Server renders templates, no free-text channel, inbound-only mail.

## Invariants (the load-bearing rules that hold everywhere)

1. Quarantine by default; the human gate on the irreversible is permanent.
2. Never eat work (git's checks + remove-first ordering + refuse-with-evidence).
3. Every link resolved on teardown (task↔lane, share↔slot, auto↔slot).
4. Automation acts only through gates.
5. Review capacity is the bottleneck — optimize for reclaimed attention.
6. Advisors inform; gates decide. (The steward proposes; it never promotes/lands.)
7. Reversibility is action-type **× context** (idle gate = reversibility modifier).
8. Producers multiply; the gate stays one (queue: file pending, owner promotes).

## The one path through (dependency spine)

`steward token + appendEvent (LIVE)` → **Rundgang + journal** → verify gate →
(decay, self-repair) → backpressure → owner-model. The library grows in parallel,
each item proved then scheduled. **The next node is unambiguous and unblocked: the
Rundgang, writing the journal from its first run.**

## Doc index (where each thing lives)

| Doc | What it is |
|---|---|
| `operating-model.md` | the primitives + invariants (foundation) |
| `interaction-modes.md` | human→session, session→session, session→self |
| `tailored-context.md` | the brief principle (why reliability is upfront) |
| `verification.md` · `lane-brief-template.md` | the verify hierarchy · brief form |
| `steward.md` | the steward convention (optional, `⚙ steward`, plans-never-lands) |
| `steward-autonomy.md` | the 7 joints + empirical playbook v1 |
| `queue-automation.md` | the queue as substrate; producers-multiply/gate-one |
| `automation-synergies.md` | 6 cross-layer synergies + the anti-synergy |
| `steward-intelligence.md` | **capstone**: 2 axes, 3 models, learning loop, impact layer |
| `steward-mail.md` | the email assistant channel (inbound-only v1, threat model) |
| `automation-frontiers.md` | 6 speculative levers, pressure-tested, dependency-spined |
| `steward-map.md` | **you are here** — the map |

## What this map means for the approach

The map's shape is the lesson: a **large, coherent design**, a **substantial built
primitive core**, and a **thin bridge** between them (only audit + the steward
principal crossed it this session). The failure mode all session was expanding the
design territory; the map converts that into a disciplined move — **advance one
unbuilt node whose dependencies are green, never extend the map by argument.** The
next node is named and unblocked. From here: build, measure against the journal,
prune the frontiers that don't survive contact. The map is also an act of care for
the successors — the steward, the next session, future-you — who should navigate
without re-deriving. That is owning the work: leaving the territory mapped, not
just larger.
