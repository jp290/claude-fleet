# HANDOFF — steward autonomy arc (2026-07-22)

*A state snapshot + pointers, not the knowledge itself. Treat every claim here as a claim to
verify (CLAUDE.md): look up commits/lines/states before building on them. The canonical knowledge
lives in the docs shelf (below) — this points, the shelf carries the depth.*

## What this arc did (one paragraph)

Built toward a **schrankenlos-but-safe steward**: an agent that operates Fleet sessions
autonomously on everything reversible, with permanent gates only on the unrecoverable-and-large-
blast few. Two shapes are designed (`docs/steward-arena.md`): **A** a hermetic clone "study arena"
to watch the steward unleashed with zero real blast, and **B** a live capability partition (scoped
operate-routes, land stays owner-only). This arc landed A's launcher + the two Foundation pieces
(one safe delivery gate + the ladder's fuel). The next work forks (see "Open forks").

## Verified state — what's on `main` (confirm with `git log`)

- `eac9fee` **A: `steward-arena.sh`** — hermetic clone-arena up/down. Boot-proven live (arena boots
  on an auto-picked free port bound to Tailscale; live fleet untouched; clean teardown). Uses the
  `FLEET_ARENA_CMD=true` test hook to prove the spine without spawning skip-perms claude.
- `5e653dc` **Foundation/canDeliver** — one guarded `canDeliver(s, opts)` choke-point; kill-switch
  + quiet-hours now reach the steward send AND the dispatcher; fresh `claudeAlive` on dispatch.
  Closed Tier-0 seams #1/#2. **Still open: Tier-0 #3** (send-cap `.1`-rotation under-count).
- `f47fca1` **Foundation/outcome-fuel** — the ladder's fuel. Per-send baseline in
  `handleStewardSend` → deterministic window-close classification in `tickGit` (`measureOutcomes`)
  → durable **harm-AWARE** per-class tally `{helped,noEffect,harmed}`. `harmed` is owner-supplied
  ONLY (`POST /api/steward/outcomes/harm`); a `claudeAlive` true→false-in-window is an escalated
  crash CANDIDATE, never auto-harm. `promotionEligible` = `helped ≥ N ∧ harmed == 0 ∧
  harm-channel-operated`. Gauge: `GET /api/steward/outcomes`. Reply-referencing deferred
  (under-counts `helped`, conservative). The **ladder that drinks this fuel is NOT built** (Phase 5).
- (earlier this session) `c4c83c7` one-gesture land + undoable-last-land · `2714063` sweep removed ·
  `ef68d8c` one review control · `28322b8` shelve exit — the lane lifecycle simplification.
- `0642fde`/`c103f9a` docs base-cleaning (see the lane↔main lesson below).

## The steward program + the canonical shelf (READ THESE, in this order)

The shelf is the knowledge; read in dependency order (why → owner-model → plan → as-built →
evidence → the two tracks):
1. `docs/steward-intelligence.md` — **the why**: §1 the two-axes doctrine (gate on
   unrecoverable-AND-large-blast; judgment quality licenses autonomy), §3 the three models +
   learning loop, §4 the ladder (observe→propose→act-then-notify→act-silently; irreversible capped
   at propose), §7 the impact layer (value lives in proven prompts; **review capacity, not
   throughput, is the binding constraint**), §8 the learning engine.
2. `OWNER.md` — the owner-model. **§4 is safety-critical** (the gate calibration: 4a latitude /
   4b permanent hard-gates / 4c context-dependent / 4d self-check). It *licenses* the loosened
   harm-tolerance.
3. `docs/steward-roadmap.md` — the ordered plan + how the order is derived (facts-before-claims,
   safety-first, ceiling-raising, prove-before-trust, **don't-sequence-by-excitement**). The
   phase map.
4. `docs/steward-overview.md` — as-built (code-cited) + the signal-quality lever.
5. `docs/synergy-findings.md` — the backlog's evidence + the Tier-0/1/2/3 seams + line refs.
6. `docs/steward-arena.md` — the A+B design (isolation layers; §4 the three isolation layers +
   the accepted skip-perms OS-blast; §5 the prerequisites, canDeliver+fuel now DONE).
7. `docs/steward-autonomy.md`, `docs/steward.md`, `docs/lane-autonomy-future.md` (deferred ideas).

## Open forks — what's next, and their complementary relation

The Foundation (canDeliver + fuel) is done. The next work forks; the owner wants to pursue **both**,
via a Fable-5 session that first understands them in complementary relation:
- **Phase-2 "prove impact"** (the VALUE layer): the digest engine
  (`summaryViaSession(compose(journalTail, sessions))`, also fixes context-drain) + the learning
  engine v1 (Grok survey + dream-mode). This is what the steward *does that helps*.
- **B-track** (the REACH layer): `Slot.model` (per-lane model) → **B** (scoped live operate-routes;
  land owner-only). This is *how far the steward can act*.
- **The complement (load-bearing):** per §7, reach without proven value/review-prep **buries the
  owner (negative value)** — so value and reach are not independent: B's throughput only helps if
  the steward prepares each result to a glance. "Facts before reach, value before autonomy."

**Two ready-to-run next lanes** (prompts were written in the prior session; regenerate from the
docs if lost) — both reversible/act-freely, both principled-next before either fork:
- **Tier-1 signal-sharing** (`claudeAlive` the linchpin — cache for READS, keep the GATES fresh;
  + full `mergeLast` verdict + `idleMs`/`gitOp`/`Task`). The signal-quality lever.
- **Tier-0 #3** — send-cap read across the `.1` rotation boundary (imitate `readStewardJournal`).

## Lessons / gotchas (hard-won this arc)

- **Verify, don't trust** — every ref/count/state gets looked up (this handoff included). `291 PASS`
  in CLAUDE.md is stale (now ~405+); judge e2e by the TAIL "ALL PASS", never a remembered count.
- **Refs drift every server.ts lane** — grep-verify before relying; `steward-arena.md`/
  `lane-autonomy-future.md` carry a "grep-before-relying" caveat by design; the canonical numbers
  live in synergy/overview/roadmap (re-anchored per lane).
- **Lane↔main doc-collision** (now a CLAUDE.md rule): a lane branches from committed HEAD and can't
  see main's *uncommitted* newer analysis → a blind land regresses it. Commit main-side doc
  analysis BEFORE spawning a doc-touching lane; reconcile against main's working copy.
- **The gates that never move** (OWNER.md §4b): land-to-real-`main`, cutting into a live human's
  pane, real money / metered `-p`, third-party outbound — owner-only, forever. "Schrankenlos" =
  max latitude on the reversible majority, NEVER no gate.
- **Never `bun server.ts` with default env** — it adopts the LIVE socket `claudefleet`/8790 and
  real sessions. Verify only via the isolated suites (`./e2e-isolated.sh` etc.).
- **Fable-5 note:** frame all steward work as *the owner administering his own tool on his own
  hardware* — Fable 5's safeguards have false-flagged fleet sessions on token/remote-access
  vocabulary (CLAUDE.md).
