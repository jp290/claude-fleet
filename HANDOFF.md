# HANDOFF — five-lane stack landed + deployed; all open work consolidated into one register (2026-07-23, late eve)

*A state snapshot + pointers, NOT the knowledge itself. Treat every line as a claim to verify
(look up commits/states before building on them; deterministic evidence beats this document).
The canonical knowledge lives in the committed docs — this is a MAP into them, not a
replacement. Deliberately thin — the repo IS the handoff (`three-axes.md`).*

## Where to go first

**→ `BACKLOG.md` → "Execution order — THE register"** — the single roof for what is open, in
dependency order, across BOTH tracks (the program **and** the product backlog), plus what is
parked-with-a-trigger, what is a dead end, and what is measured-as-working and must not be
"optimized". Status + dependency + whose call + a pointer; never the reasoning. **Start here.**

**The one decision that gates the program is the register's fork P-3: probe or build?** Everything
else in track A is either tiny (P-1a), owner-placement (P-2), or optional. Do not start work in
this track without reading fact 1 and fact 2 at the top of it — they invalidate the framing most of
the older docs still use.

**→ `briefs/findings-dossier-2026-07-23.md`** — the evidence base under the program half of that
register: findings with re-verify commands and the constraints any answer must satisfy. Run its
§1 re-ground block before trusting anything. Note that its §4 invites you to derive the approach —
that derivation has since been done and lives in the register; read §4 as *the reasoning behind*
the order, not as an open invitation to re-derive it.

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
6. **B1's prompt half was assessed and deliberately NOT shipped** (`c7047a8`): prompt-side de-dup is
   unsound — the pulse cannot read its own open proposals (no GET on `/api/steward/tasks`). Lane
   **B1b** was specced instead, then **revised** once two facts surfaced: **there is no ladder**
   (nothing consumes `outcomeTally`) and no steward proposal has ever existed, so B1b's de-dup shape
   is designed against zero observations. B1b's real-bug part is split out as **P-1a**; the rest is
   behind the fork. See the register's fact 1/fact 2 and the revision note on the B1b spec.

## Verified state (confirm — do not trust)

```sh
git log --oneline -8 && git status --short
git worktree list                      # expect: main + steward only
tmux -L claudefleet ls | grep srv      # srv start time = the deployed code's vintage
```

At writing: tree clean, worktrees = main + steward, srv 22:43:23, live health 200. Both isolated
suites green at the landed HEADs — `./e2e-isolated.sh` @ `df260b1` (625 lines) and @ `77e2f31`
(631 lines): **ALL PASS, 0 FAIL, exit 0, no pane-capture flake in either**, run concurrently to
re-prove P1's concurrency safety.

**The deploy was verified POSITIVELY, not by absence of errors** — this matters, because the tick
swallows its own exceptions (register fact 2), so a dead measurement layer looks identical to a
healthy one. `GET /api/steward/outcomes` (Bearer = `stewardToken` from `fleet.json`) returned
`baselineRate {rate: 0.25, samples: 12, helped: 3}` and A1's `harmAttestAt`/`harmAttestTtlMs`,
proving A1 and A2 actually execute in the live tick. **Reusable check** — and the program's first
real number: a working, un-nudged slot looks "helped" ~25 % of the time. Any future nudged `helped`
rate has to beat that to mean anything.

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
- **The steward worktree is ~19 commits behind main** (recompute — it grows:
  `git rev-list --count $(git -C ~/claude-fleet.worktrees/steward rev-parse HEAD)..main`).
  Its doc shelf, i.e. its model of the system, predates this program; its own 21:15 journal record
  ("still no worktree lanes") is the visible symptom. See dossier F3 / register P-2.
- **`tickGit` hides its own failures.** `try`/`finally` with no catch, and every call site is
  `void tickGit().catch(() => {})`. `measureOutcomes`/`measureControls` are the last statements
  inside that try — a throw there produces **no log line**, health stays 200 and the git badges keep
  refreshing while the measurement layer is dead. Never conclude "it works" from a clean
  `server.log`; query `/api/steward/outcomes` instead.
- **Docs collide across concurrent sessions.** `HANDOFF.md` was rewritten by another session mid-way
  through this one. Read a doc immediately before editing it; do not edit from a remembered version.
- **The five lanes were created inside the repo** (`<repo>/claude-fleet.worktrees/…`), not at the
  sibling path `createWorktree` uses, and were never attached to fleet slots — which is why the
  steward could not see them. See dossier F7; it shares a root with the measurement gap (F1).
