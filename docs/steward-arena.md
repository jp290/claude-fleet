# The steward arena — operating autonomy in two shapes (A: hermetic study, B: live partition)

*Design note 2026-07-22 (JP + session). Captures the full reasoning behind letting the
steward **operate** Fleet sessions autonomously — not just dispatch isolated workers — and
the decision to build **both** a hermetic study arena (A) and a live capability partition (B).
Sits under `steward-intelligence.md` (the autonomy×safety theory) and `steward-autonomy.md`
(the loop). Producer-proposes / owner-promotes: this is a proposal to reason from, not built
code. Claims carry `file:line`; **[verified]** = read this session, **[inferred]** = reasoned
from code/git semantics, not executed.*

---

## 1. The question, and the distinction that sharpened it

The steward today can **observe + typed-send + self-schedule** (`server.ts` `handleStewardRoute`,
~`2633-2761`); it cannot open/kill slots, spawn lanes, dispatch, land, or promote — refused
structurally by a 403 fallback (`server.ts:2761`).
*(Every `server.ts:NNN` in this doc has been re-anchored repeatedly as lanes A/B/C and the
canDeliver lane each re-drifted the line numbers — treat them as grep-verify-before-relying. The
canonical current numbers live in `synergy-findings.md`/`steward-overview.md`, re-anchored in the
lane that shifted them.)* The goal: let it **operate** sessions
autonomously.

JP's sharpening: **"two spawned Opus agents ≠ the steward operating the fleet."** These are
different:
- **Dispatch** — file a task → an isolated lane executes quarantined → owner lands. The agent
  is a *worker*; bounded, land-gated. (`steward.md:15-16`, the intended trajectory.)
- **Operate** — the steward *drives* the board: creates, sends, leads, manages, reacts — like
  the owner. Categorically larger; it approaches owner-level control.

This doc is about **operate**, and it has two legitimate shapes.

## 2. Why the naive "just spin up an arena instance" fails (Option C — rejected)

The seductive shortcut: a second Fleet instance, steward holds its **owner** token, operates it
freely. Two real holes:

- **It contradicts the capstone.** `steward-intelligence.md §8`: *"Extend the server; do not
  spawn a peer process — a second process is new shared-reality (ports, sockets, lifecycle: the
  'sessions-vanished' class of risk)."* A second server IS that peer process (the anchor
  incident, `OWNER.md §4c`).
- **Owner-token-on-a-real-repo arena = land-to-real-main.** State files are `import.meta.dir`-
  derived, **not** env-overridable [verified, `server.ts:23-26`], so a second instance is a
  *copy of `server.ts` run from another dir* (the `e2e-isolated.sh` pattern). But the worktrees
  it creates are **real branches in the real repo** [verified, `createWorktree`
  `server.ts:656`; shared `.worktrees/`]. So if the arena points at real repos and the
  steward holds its owner token, the steward can call the arena's `/api/slots/:id/land` →
  `advanceIntegration` ff-merges into the **real** `main` — breaking *land-stays-owner-only-
  forever* (`steward-roadmap.md:85`).

Conclusion: owner-token-on-a-real-repo arena is either a land hole (real repos) or a pure toy
(clone repos). **Rejected as the "operate" mechanism.**

## 3. The two shapes we build — and why both earn their place

### A — Hermetic study arena (throwaway instance, CLONE repos)
A deliberately-disposable second instance (the `e2e-isolated.sh` recipe, productionised),
pointed at **clones** of real repos, steward = the arena's owner, **truly unbounded** inside it
— it may create, send, kill, even land (into the clone's `main`, folgenlos). Purpose: **watch
the steward operate fully unleashed**, cheaply and safely, and **generate the judgment-quality
track record** that `steward-intelligence.md §1/§4` says is what *licenses* real latitude.
Minimal new server code — it's a launch/teardown affordance, not a feature.

### B — Live capability partition (scoped operate on the live instance)
No second process. The steward gains **scoped** operate-routes on the live instance —
create-lane + send/brief, gated so it can only ever touch **slots it created or a designated
arena-repo, never the owner's live slots** (the idle/live-work reversibility modifier,
`steward-intelligence.md §6.1`). **Land/kill-live/money/outbound stay owner-only** — the scoped
token gets 403 on those routes, so a fully-injected steward's blast stays "boring"
(`steward-mail.md:28-36`). Purpose: **real autonomous work, review-ready**; the owner lands.
This is `steward-intelligence.md`'s own endgame path, unlocked earlier.

### Why both: A de-risks B
A is the sandbox where the steward *earns* trust; B is where that trust is *spent* on real work.
Sequencing A→B is the doctrine's **prove-before-trust** (`steward-roadmap.md:32`) made literal:
A's logged behaviour calibrates how wide B's latitude opens. They are not two features — they
are one program with a proving ground in front of it.

## 4. "Isolated" is not binary — the three layers, and the skip-permissions blast

`FLEET_CMD = claude --dangerously-skip-permissions` (owner-accepted 2026-07-22). Isolation then
holds on **two of three** layers:

1. **Control-plane** — isolated ✓ (own socket/port/`fleet.json`; can't drive live panes).
2. **Git target** — isolated in A ✓ (clones; land is folgenlos). In B, real repos but land is
   owner-gated.
3. **OS** — **NOT isolated** ✗. Lanes are real `claude` processes with real bash on the real
   machine. skip-permissions removes the last per-action gate, so a lane can touch shared
   reality (`~/.claude`, other repos, launchd) *outside* its worktree.

So A's residual blast = whatever an ungated `claude` can do to the shared filesystem — **not
zero**. Accepted knowingly for v1 (owner-stated: the models handle it fine). The real hardening
is running the arena under a **constrained OS user / sandbox** — deferred to v2, recorded here so
the accepted risk is explicit, never implicit. General lesson: **always ask *at which layer* a
thing is isolated.**

## 5. Universal prerequisites (both shapes)

1. **`canDeliver()` choke-point + real kill-switch** — **DONE (landed `5e653dc`, 2026-07-22).**
   Extracted one guarded `canDeliver(s, opts)` (`server.ts:1160`) and routed all four delivery
   paths through it — `tickAutos` (:1195), `handleStewardSend` (:2578), `tickDispatch` (:1256),
   merge/land (:3335) — so the kill-switch (`autosOn`, :1176) + quiet-hours now reach the steward
   send AND the dispatcher, and the dispatcher gets a fresh `claudeAlive`. Closed Tier-0 #1/#2.
   **Still open: Tier-0 #3** (send-cap `.1`-rotation under-count). This was the prerequisite before
   B opens any live reach — it now holds. (A's kill-switch stays cruder but total: `tmux -L
   fleetarena kill-server`.)
2. **Journal-outcome fuel** — **DONE (landed `f47fca1`, 2026-07-22).** Per-send baseline in
   `handleStewardSend` → deterministic window-close classification in `tickGit` (`measureOutcomes`)
   → durable harm-AWARE per-class tally `{helped,noEffect,harmed}`; `harmed` owner-supplied only
   (`POST /api/steward/outcomes/harm`), a crash is an escalated candidate not an auto-harm;
   `promotionEligible` = `helped ≥ N ∧ harmed == 0 ∧ harm-channel-operated`. The ladder that
   drinks this fuel is Phase 5 (not built).
3. **Per-lane model** (`Slot.model` threaded through `slotCmd`, reusing `summaryViaSession`'s
   `--model` hook, `synergy-findings.md` Tier-2) — the *only* place a separate instance had real
   pull (`FLEET_CMD` is process-wide). Solve by **extending**, not forking.

## 6. The gates that never move (both shapes preserve them)

Land-to-real-`main`, cutting into live/actively-worked panes, real money / metered `-p`,
third-party outbound — **owner-only, forever** (`OWNER.md §4b`). A contains them by clone-repos
+ the instance boundary; B by the scoped token (403 on owner routes) + the live-work modifier.
Neither shape relaxes the permanent gate — "schrankenlos" means *maximal latitude on the
reversible majority*, never *no gate*.

## 7. Build sequence (one at a time — OWNER.md §3)

1. **A — the study arena:** an easy launch/teardown affordance (script or a Fleet control) that
   clones the target repo(s), boots an isolated instance (own port/socket/dir, skip-perms
   `FLEET_CMD`), opens a `⚙ steward` slot in it, and is watched via *the arena's own dashboard*.
   One command up, one down. Minimal server code; mostly the `e2e-isolated` pattern + clone
   bootstrap. → produces the behavioural track record.
2. **Foundation:** `canDeliver()` choke-point + kill-switch coverage + journal-outcome logging
   (+ `Slot.model` when per-lane models are wanted). Independently valuable (closes a real seam).
3. **B — the live partition:** scoped steward operate-routes (create-lane + scoped send on
   steward-created/designated slots), land owner-gated, everything **tagged + visible +
   stoppable** in the live UI, work arriving **review-ready** at the land button. Latitude
   calibrated by A's record.

## 8. "Easy to operate" is a safety property, not just UX

Review capacity is the binding constraint (`steward-intelligence.md §7`), so ergonomics *is*
safety here:
- **A:** one-command up/down; observability = Fleet watching itself on a dedicated port.
- **B:** steward lanes visually tagged; a kill-switch the owner *trusts* (the `canDeliver` fix is
  what makes it real); work that arrives prepared-to-a-glance so autonomy reclaims attention
  instead of burying it.

## 9. Open unknowns / inferred-not-verified

- Cross-instance worktree visibility (§2) is **[inferred]** from git-worktree semantics, not run.
- **Sandbox-aware behaviour**: a steward that can tell it's in a clone arena may act differently
  than on real work — A's data is directional, not identical to B's reality.
- The OS-layer blast of skip-permissions lanes (§4) is real and **un-mitigated in v1**.
- Thresholds (how wide to open B given A's record) are unmeasured — start conservative-within-
  latitude, widen as the journal proves out (`OWNER.md §6`).
