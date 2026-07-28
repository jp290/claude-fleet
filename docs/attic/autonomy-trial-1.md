# Autonomy trial 1 — dispatcher on, bounded

*Pre-registered 2026-07-25, BEFORE the first dispatcher lane ran. Written to be falsifiable:
every question below has a measurement, and every stop condition is checkable without judgment.
Amendments only with a rationale committed before looking at new data (`graduation-criteria.md`'s
own rule, applied to itself).*

## What autonomy is granted, exactly

| Step | Who does it during this trial |
|---|---|
| **select** — which queued task becomes work | the dispatcher (`tickDispatch`, 8s) |
| **brief** — task text into a fresh lane | the dispatcher |
| **run** — the session works | the session |
| **review** — ③ on a done-looking lane | auto-③ (already on by default) |
| **merge trigger** — ⏫ | **human** (no tick calls `mergeJob`; verified server.ts:5299) |
| **land** — clean rebase + green verify | already unattended, inside a human-started merge |
| **deploy** — live server picks up main | **human** (no path in server.ts restarts `srv`; verified) |

So this trial expands autonomy over **selection and briefing** — the two capabilities whose blast
radius `docs/README.md` rates as "a wasted lane". It grants **no new land authority whatsoever.**

## Pre-registered questions

- **Q1 — does dispatch actually deliver?** Count: tasks moved `queued→sent`, lanes spawned, briefs
  actually delivered into a live pane. The 4 s boot wait plus the fresh claude-alive gate can requeue
  a task; a requeue is a *finding*, not a failure.
- **Q2 — is an autonomously-briefed lane as good as a hand-briefed one?** Compare the disposition of
  dispatcher-spawned lanes against the hand-briefed lanes of the same session (same day, same repo,
  same model). This is the only controlled comparison available today, and n will be small — say the
  number, do not dress it up.
- **Q3 — do unattended lands survive the full suite?** One post-land audit row per land
  (green/red/unknown). This is the first time the slow tier has ever run at all.
- **Q4 — where does a human still have to touch it?** Log every intervention and its reason. The
  count is the honest measure of how far autonomy actually reaches — and Q4's answer is the input to
  the next trial, not this one.

## Stop conditions (any one ends the trial)

- **S1** — a post-land audit comes back `red` → stop dispatch, investigate before another land.
- **S2** — two consecutive dispatcher lanes produce non-landable work → the fault is in the briefing
  layer, not the gate; stop and fix briefs.
- **S3** — any lane writes outside its own worktree → hard stop (the isolation invariant is the
  premise of everything else here).
- **S4** — main receives a commit that would have to be reverted → stop, use ↩ undo-land, review.

## Explicit non-goals

- **Not** flipping `FLEET_CLEAN_REVIEW=1`. It would end the running K2 shadow series (`CLAUDE.md`),
  and the series is the evidence the *next* step needs.
- **Not** adding an auto-merge tick. That is the real remaining boundary and it deserves its own
  decision, with the ② shadow tally (N≥25, currently 0 valid) as its input — not this trial's.
- **Not** auto-deploy. Landing moves `main`; the live service stays on the owner's hand.

## The finding this trial exists to break

The measurement that gates the next autonomy step is starved by the very human step that step would
remove: ② shadow verdicts are only written on clean auto-lands, and clean auto-lands only happen when
a human presses ⏫. `graduation-criteria.md` §2 wants N≥25; there are 0 valid. The way out is not to
skip the measurement — it is to produce lands. That is what this trial does.
