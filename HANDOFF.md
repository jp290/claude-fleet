# HANDOFF — the five-lane stack landed + deployed; a findings dossier is waiting for a fresh session (2026-07-23, late eve)

*A state snapshot + pointers, NOT the knowledge itself. Treat every line as a claim to verify
(look up commits/states before building on them; deterministic evidence beats this document).
The canonical knowledge lives in the committed docs — this is a MAP into them, not a
replacement. Deliberately thin — the repo IS the handoff (`three-axes.md`).*

## Where to go first

**→ `briefs/findings-dossier-2026-07-23.md`** — the open work, as findings + evidence + constraints,
with the approach deliberately left open for the session that picks it up. Start there, run its §1
re-ground block before trusting anything, and derive your own slicing. It supersedes the "next
steps" list this handoff used to carry.

## What happened since the previous handoff (which this file replaces)

1. **The mechanism deep-dive** (`e978c78`) produced a verified five-lane program; the **stack-land /
   program-board proposal** (`da8658d`, propose-only) captured the lane DAG the fleet cannot model.
2. **All five lanes landed by hand**, owner-initiated, ff-only, in dependency order:
   `917452a` G1 (land provenance survives teardown failure + stale-verify guard) · `9e729d4` G2
   (verify badge reaches the owner's eye) · `2fc7c50` A1 (honest `helped` semantics + staleness-gated
   harm attest) · `df260b1` A2 (advisory `baselineRate`) · `f70cc7a` B1 (propose-class outcome from
   promote/dismiss). `77e2f31` records the run's empirical findings as §8 of the stack-land doc —
   read it before building any stack tooling; it is the worked example.
3. **Deployed** — srv restarted 22:43:23, so the stack is live. Health 200 on the Tailscale IP.
4. **`bdc1cb0` corrects a location claim**: `.claude/commands/rundgang.md` is **git-tracked in this
   repo**, not a `~/.claude` file — B1's remaining half is therefore lane-able and revertable. Do not
   re-inherit the earlier wrong version from any doc draft.
5. **A read-only assessment session** verified the program's state end-to-end and produced the
   dossier above (measurement asymmetry re-confirmed with fresh numbers, cost distribution measured,
   steward staleness, the deploy-gap fact, the dogfooding-bypass root shared with F1).

## Verified state (confirm — do not trust)

```sh
git log --oneline -8 && git status --short
git worktree list                      # expect: main + steward only
tmux -L claudefleet ls | grep srv      # srv start time = the deployed code's vintage
```

At writing: HEAD `bdc1cb0`, tree clean, worktrees = main + steward, srv 22:43:23, live health 200.
Both isolated suites green at the landed HEADs — `./e2e-isolated.sh` @ `df260b1` (625 lines) and
@ `77e2f31` (631 lines): **ALL PASS, 0 FAIL, exit 0, no pane-capture flake in either**, run
concurrently to re-prove P1's concurrency safety.

## Load-bearing decisions + WHY (incl. deliberately NOT done — do not re-litigate)

- **Invariants:** propose-never-apply; **land + deploy owner-only, forever** (OWNER §4b); producers
  write `pending`, only the owner promotes.
- **Infra > prompts at strong-executor scale** — stage 2 refuted most of stage 1's rewrites. Do not
  spend on prompt edits.
- **Verification coverage is the program's throttle** (governor #2): the binding constraint is the
  Ground/fact layer, not idea generation.
- **DEAD ENDS (don't retry):** transcript-grep recurrence counting (2b — the count *rose* with zero
  actual collisions; count runtime outcomes, not corpus mentions); the 11 prompt "insurance" edits
  (trigger = first cheap-model lane); **no eval set exists**, so no prompt edit is proven to improve
  outcomes.
- **Anti-abstraction is a standing bar** — a framework where a grep suffices is itself the bug.

## Non-obvious state / gotchas

- **`CLAUDE.md` and `OWNER.md` are gitignored** (fleet copies CLAUDE.md into every worktree) — edits
  don't land via a branch; edit the main-checkout copy directly.
- **`.claude/commands/` IS tracked** — `/rundgang`, `/steward`, `/foreman` are in-repo and in scope
  for a lane (see item 4 above).
- **Deploy ritual:** `tmux -L claudefleet kill-session -t srv` → the watchdog respawns with new code,
  real panes survive → health-check `http://100.64.0.1:8790/` (**Tailscale IP only**;
  `127.0.0.1:8790` never answers and looks like a dead server). Confirm the watchdog is loaded first.
- **The steward worktree is ~17 commits behind main** — its doc shelf, i.e. its model of the system,
  predates this program. Its own 21:15 journal record ("still no worktree lanes") is the visible
  symptom. See dossier F3.
- **The five lanes were created inside the repo** (`<repo>/claude-fleet.worktrees/…`), not at the
  sibling path `createWorktree` uses, and were never attached to fleet slots — which is why the
  steward could not see them. See dossier F7; it shares a root with the measurement gap (F1).
