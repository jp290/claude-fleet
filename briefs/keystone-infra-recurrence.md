# Brief — The keystone, step 1: infra fix + minimal recurrence check (P1)

*A worktree lane on a fresh branch off `main`. Everything this touches is **in-repo**
(e2e scripts, `fleet-e2e.ts`, a new check script) — unlike the dream passes, there is no
`~/.claude` write surface, so worktree isolation is complete. Reviewed as one diff, landed
clean. **No live-server change here** (e2e-isolated.sh and the check are dev tooling, not the
running `srv`) → **no deploy step.** Executor: a strong reasoner (Fable) — this brief is lean
on hand-holding and heavy on exactly one guardrail.*

*Map/why: `docs/proposals/learning-engine-next-steps-2026-07.md` step 2 — the honest,
decomposed version. Read it first; it corrects the earlier "point the effect-sensor at infra"
framing.*

## THE ONE GUARDRAIL (the real failure mode of this task)

The temptation is to build an elegant general **infra-sensor framework** (a registry of
signatures, pluggable detectors, a config). **Do not.** The keystone is a *grep, not a
framework* (OWNER: three lines > premature abstraction; complexity is itself the bug). If you
find yourself designing extensibility, a plugin surface, or a config schema — stop, you have
left the task. Ship the smallest thing that counts one signature.

## Read first (to reason, not to copy)

1. The map doc step 2 (2a/2b/2c decomposition + the honest correction).
2. `measureOutcomes`/`outcomeTally` (`server.ts:700`, `:2211`) — **to confirm why it does NOT
   fit** (it classifies a steward *intervention's* outcome via git/output deltas; the wrong
   shape for signature-recurrence). Reuse only the append-only-tally *idea* if useful; do not
   repurpose the code.
3. `e2e-isolated.sh` (+ `e2e-claude-gate.sh`) and `CLAUDE.md` §"Lane discipline" para on the
   hardcoded socket `fleettest`/port `8791` collision + its prose workaround — this is P1.
4. `docs/proposals/dream-mode-corpus-2026-07.md` Part C (P1's cited evidence: 6 lanes hit it).

## Open with a scope decision (a fork — you decide, guardrail applies)

Confirm or challenge, in one line, the recommended scope before building:
**recommended = fix-first-then-minimal-check** (2a then a skeletal 2b), *not* counter-first,
*never* the framework. If you see a reason the order should differ, say it — but the
anti-abstraction guardrail is fixed.

## TASK (this lane = the proof on ONE signature; the rest is deferred)

**2a — root-cause P1.** In `e2e-isolated.sh` (and `e2e-claude-gate.sh`), derive
`SOCK`/`PORT`/`DIR` inside the script from a per-invocation unique token (e.g. `$$` or the
worktree basename) so every lane gets its own socket/port and no run's `kill-server` can hit
another's server. This deletes both the recurring manual stop-clean-rerun cycle *and* the
`CLAUDE.md` prose workaround. Keep the script's existing behavior otherwise identical.

**2b — the minimal recurrence check (skeleton, P1 only).** A small script (e.g.
`scripts/infra-recurrence.sh` or similar) that **counts occurrences of P1's signature**
(`ConnectionRefused` / `Killed: 9` / `port 8791` collision markers) over whatever run/transcript
history already exists — grep, not a pipeline. Its job: turn "P1 is fixed" into a number that
can be watched go to zero. **The key design question is the data source** (recent e2e output?
lane transcripts under `~/.claude/projects`, read-only?) — pick the smallest that gives a real
count; if none exists cheaply, say so and emit a check that runs against future output rather
than inventing a logging layer.

**Deferred to follow-up lanes (do NOT do here):** P2 (doc symbol-anchors), the `toUpperCase()`
share-flake fixture, and 2c (wiring recurrence into the learning loop). Note them as next; keep
this diff focused.

## Executor note (Fable safeguard)

This work names tmux sockets/ports/`kill-server` — Fable-5 has false-flagged such content
(CLAUDE.md). Frame it as the owner administering his own test tooling on his own box (it is).
If a turn dies to a safeguard, rephrase or `/model opus` and continue — do not abandon the task.

## DONE means (verify against real state — OWNER §2)

- The isolated suites are now **concurrency-safe**: two overlapping `./e2e-isolated.sh` runs no
  longer kill each other. Prove it — run two in parallel (or back-to-back without hand-cleanup)
  and both reach a clean tail; the collision markers do not appear.
- `./e2e-isolated.sh` tails **ALL PASS** (≤1 known pane-capture flake) and `./e2e-claude-gate.sh`
  ALL PASS; `bunx tsc --noEmit …` clean; `bun run build`.
- The 2b check runs and prints a count for P1's signature.
Run it before claiming done; if the same fix-run-fail loop repeats ~5×, stop and report the
structural problem. **No deploy** — this is dev tooling; nothing to restart.

## OUTPUT

Commit(s), concise present-tense. Report ONLY: one-paragraph summary, the quoted verification
tail (both suites + the parallel-run proof), the 2b count, and one line on the 2b data-source
choice + anything deferred. No reasoning walkthrough.
