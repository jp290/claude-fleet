# HANDOFF — the learning engine's first two turns + acting on the result (2026-07-23, eve)

*A state snapshot + pointers, NOT the knowledge itself. Treat every line as a claim to verify
(look up commits/states before building on them; deterministic evidence beats this document).
The canonical knowledge lives in the committed docs — this is a MAP into them, not a
replacement: read the primary sources, don't accept this handoff in their place. Deliberately
thin — the repo IS the handoff (`three-axes.md`).*

## What this session did (one paragraph)

Ran the learning engine's first two turns and acted on the result. **Stage 1** (executed
`briefs/learning-engine-v1.md`): a 9-agent workflow axiom-diagnosed the six structural prompts
from first principles → proposal doc. The **retrieval coupling** surfaced mid-run (the parallel
s9 session + BACKLOG §17). **Stage 2** (trace-grounded corpus pass) then **overturned stage-1's
premise**: at strong-executor scale (0 Haiku lanes) the overhead prompts are NOT the
bottleneck — they're already mitigated; the leverage is in **infra/behavior patterns** (P1–P3).
Navigation synthesis: **verification-coverage is the program's throttle**; sequence
P3 → infra-recurrence → retrieval-wire. Executed **P3** (async digest, demand-triggered
bounded-wait) — landed + deployed + live-verified. Executed **keystone step-1 / P1** (e2e socket
collision) — landed 2a-only after review dropped a non-functional 2b.

## Verified state (confirm with `git log --oneline -14`)

main clean; only worktrees = main + steward (P3/keystone lanes landed + cleaned).
- `f87c641` **P1 LANDED** — e2e per-invocation `$$` SOCK/PORT/DIR; concurrency-safe, deterministic.
- `e6c1897` **P3 LANDED + DEPLOYED + LIVE** — async digest; srv respawned 18:05 (was 13:34),
  real panes survived, main-checkout = e6c1897 → new code live *by respawn* (NOT a behavioral
  digest test — that would spend worker tokens; the next real `/rundgang` pulse is the proof).
- `52d8980` map: P1 done + the 2b dead-end lesson · `2125ad9` keystone brief · `37a268c` keystone
  step-2 sharpen · `7ea5a55` the navigation map · `6860fc7` stage-2 proposal · `ac334ca` stage-2
  brief · `feab50e`/`fad6fb9` stage-1 proposal · `8e146d7` s9's BACKLOG §17 (foreign session).

## Read in this order (the map)

1. `docs/proposals/learning-engine-next-steps-2026-07.md` — **THE master map**: the redirect,
   the throttle, the ranked sequence, P1-done, the 2b dead-end lesson, parked-with-triggers.
2. `docs/proposals/dream-mode-corpus-2026-07.md` — stage-2 verdicts, the P-patterns, the
   "confirmed-but-already-mitigated" class.
3. `docs/proposals/learning-engine-v1-2026-07.md` — stage-1 axiom diagnoses + honest limits.
4. `OWNER.md` (the bar), `docs/three-axes.md` §7 (program frame), `docs/steward-intelligence.md`
   §8 (learning-engine doctrine). Briefs: `p3-async-digest.md` (done),
   `keystone-infra-recurrence.md` (P1 done; P2/share-flake/2c open).

## Next steps (ordered, small — one at a time)

1. **Now-due, safe:** remove the P1 workaround prose from `~/claude-fleet/CLAUDE.md`
   (main checkout — **gitignored**, edit directly). Unblocked: P1 landed AND no old-script lanes
   running (only steward worktree). Obsoletes the "copy to scratch with unique SOCK/PORT" note.
2. **P2** — doc `server.ts:NNN` refs → symbol/grep anchors (small lane; maintenance debt, not a bug).
3. **share-flake** — `fleet-e2e.ts:1814` `toUpperCase()` no-op on lowercase-free random ids;
   one-line fixture guard.
4. **The redirected recurrence-sensor** — runtime markers for the *non-deterministic flake class*
   — ONLY when tackling those flakes. Not before (infra without demand = the trap we avoid).

## Load-bearing decisions + WHY (incl. deliberately NOT done — do not re-litigate)

- **The redirect — infra > prompts** at strong-executor scale. WHY: stage-2 proved the prompt
  rewrites fix failures no current executor produces. Don't spend on prompt edits.
- **Verification-coverage is the throttle** (governor #2 operative): the binding constraint is the
  Ground/fact-layer, not idea generation. Sequence the program by it.
- **P3 fused design = demand-triggered bounded-wait**: the worker costs tokens, so demand-triggering
  IS the gate (no clock loop → no §4b unattended spend). `?wait` caller-chosen, default ~30s,
  clamp 60s; invariant `curl -m ≥ ?wait`.
- **Keystone = fix-first, NOT a sensor framework** (anti-abstraction; three lines > premature abstraction).
- **DEAD ENDS (don't retry):** (a) **2b transcript-grep recurrence** — count *rose* 34→41 during
  one review with **0** collisions (self-reference); measures documentation, not recurrence, and
  can't reach zero. A counter for a deterministically-fixed issue (P1) is pointless. (b) The **11
  prompt "insurance" edits** — deferred, trigger = first cheap-model lane (net-negative now). (c)
  `/sharpen` (#2/#11) not trace-mined (sharpen-corpus guard) — needs a hold-out pass. (d) **No
  eval-set exists → no prompt edit is proven to improve outcomes**; build it before promoting any.
- **Invariants:** propose-never-apply; **land + deploy owner-only, forever** (OWNER §4b).

## Non-obvious state / gotchas

- **`CLAUDE.md` is gitignored** (fleet copies it into every worktree) — edits don't land via a
  branch; edit the main-checkout copy directly. (The session-start context calling it "checked in"
  is misleading.)
- **Deploy ritual** (verified this session): `tmux -L claudefleet kill-session -t srv` → watchdog
  respawns with new code, real panes survive → health-check `curl http://100.64.0.1:8790/`
  (Tailscale IP only; 127.0.0.1 never answers). Confirm watchdog is loaded before killing srv.
- **s9** was the retrieval session (BACKLOG §17, committed its own decision `8e146d7`); the
  sharpen-corpus lives at `~/.claude/knowledge/sharpen-corpus/` (owner-promoted home).
- **Model split:** this session ran on Opus (dream passes, P3 design, reviews); the P1 lane ran on
  **Fable** (owner: strongest reasoner — brief calibrated for it: lean hand-holding, heavy
  anti-abstraction guardrail). Small lanes (P2/share-flake) can go cheaper.

## Meta (why this handoff looks like this)

Written in the pattern this session's own trace-grounded pass validated (`dream-mode-corpus`
A.3): pointer-quality over self-sufficiency, grounded against `git log` not memory,
decisions-incl-dead-ends, session-calibrated headings — NOT the weak fixed-skeleton `/handoff`
template (which the same pass flagged as A1/A4/A7-deficient). Self-reference operational.
