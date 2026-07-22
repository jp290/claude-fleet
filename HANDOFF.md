# HANDOFF — the steward's safety spine is built; next is the safe live heartbeat (2026-07-22)

*This file is a prompt for you, the next session. Treat every claim, number, path,
and commit hash here as a **claim to verify** against the tree and the running
system before building on it (CLAUDE.md) — deterministic evidence beats this
document. Its job is to induce the right model, not to be trusted.*

## Start here (primary sources, not summaries)

Read these as primary sources — do not accept this handoff in their place:
`docs/README.md` (the corpus index), `docs/steward-intelligence.md` (the capstone:
autonomy×safety), `docs/prompt-axioms.md` (why a prompt is good), and the CLAUDE.md
lane discipline. The working plan below is the distilled output of a 47-agent deep
analysis run this session (31/38 findings adversarially CONFIRMED); its essence is
embedded here because the raw output lived in ephemeral `/tmp`.

## What this session built — the heartbeat's safety spine (verify each on `main`)

A steward that runs autonomously needs a heartbeat with bounds. All landed on `main`:

- `6a4a584` **journal** — durable pulse ledger (the self-model's home,
  steward-intelligence §3). Typed `POST`/`GET /api/steward/journal` (steward-scoped);
  file may rotate, reader spans the `.1` boundary so the delta anchor survives.
  **LIVE + proven in production** (a real pulse wrote a record). `rundgang.md` now
  POSTs a typed record instead of a free-text `JOURNAL:` line.
- `a5d28b4` gitignore `steward-journal.jsonl(.1)` (runtime artifact, like `audit.jsonl`).
- `10e45d3` **perpetual autos** — a recurring beat that re-arms instead of dying at
  `AUTO_MAX_RUNS`(100). **Owner-only** (`createAutoForSlot` opts.allowPerpetual; only
  `POST /api/slots/:id/autos` passes it). Fixed the one-shot `runsLeft` quirk.
- `b5b4da9` **kill-switch** — `autosOn` (default **true**) gates `tickAutos`;
  `POST /api/autos/switch {on}` owner-only, persists immediately, audited.
- `a4a7cfc` **quiet hours** — mute the *periodic* surface in an owner-set local-hour
  window; `POST /api/autos/quiet {start,end}|{start:null}` owner-only. Recurring-only
  (one-shots always fire); tick-in-place.

Each: assumptions questioned against the code, tests that interrogate (a contrast
where the wrong branch visibly fails), tsc + build + full `./e2e-isolated.sh` green.

## CRITICAL verified-vs-deployed distinction (verify first)

`main` (`a4a7cfc`) is **~4 commits ahead of the live server**. The live `srv`'s last
restart was the **journal** deploy, so **only the journal is live**; perpetual,
kill-switch, and quiet-hours are landed but **NOT deployed** — and all are *inert*
until an owner configures them, so nothing live changed. **Verify** (owner token
required — no token hits the 401 auth gate before routing): `POST
/api/autos/switch` with the owner Bearer token and an empty body → **404** means the
spine is undeployed (route absent); **400** ("body.on must be a boolean") means it is
deployed. Deploy is deliberately deferred (see below). Deploy ritual: `tmux -L claudefleet kill-session -t srv` (watchdog
respawns from `main`), health-check `curl http://100.64.0.1:8790/` (binds the
Tailscale IP only). `rundgang.md` changes also need the **steward worktree**
fast-forwarded (`git -C claude-fleet.worktrees/steward merge --ff-only main`) — the
live steward reads `/rundgang` from its own worktree, not `main`.

## THE open decision — resolve this first (blocks a *safe* live heartbeat)

The bounds exist, but a live perpetual Rundgang is **not yet safe to turn on**: the
Rundgang's `FLEET_STEWARD_TOKEN` can hit `/api/steward/send` (act-during-pulse seam),
and the pulse runs in the steward's durable conversation (context-drain). Fork:

- **(1) Full ephemeral read-only worker** (steward-intelligence §6.6) — fixes the
  seam + context-drain + server-side journaling at once. But `summaryViaSession`
  (server.ts ~1541) is *stateless*, so the pulse's "what changed since last time"
  delta must be **server-injected** — real design work. Design-first.
- **(2) Interim read-only Rundgang token** — a scoped credential that GETs
  `/api/steward/*` but is 403'd by `/api/steward/send`. Closes the seam now; leaves
  context-drain for later. Faster to a *safe* (if not context-optimal) live beat.

This session recommended **(2) first, then iterate to (1)**. The owner had not
chosen when the session ended — **confirm before building.**

## Ranked next steps

1. **Resolve the fork (2 vs 1) and build it** — the last mile to a *safe* live beat.
2. **Deploy the spine + configure a bounded heartbeat**: one `srv` restart, then
   `POST /api/slots/1/autos {text:"/rundgang", everySec:<e.g. 3600>, perpetual:true,
   idleSec:60}`, plus set quiet hours. **Prove-before-schedule** (§7): watch it work
   N times first — the single manual proof-run this session is not N.
3. **(Owner's emphasis) Test the steward AGENT, and try genuinely different
   approaches** — under the *long-autonomous* lens. Not just plumbing: does it stay
   honest (the honesty gate), quiet-when-nothing-changed, non-drifting over many
   autonomous pulses? This is far richer once a bounded beat is actually running.
4. **Item A — commit-functions QA gate** (owner-requested, "at the end"): exercise
   the *real* commit machinery end-to-end, not the `fakecommit` e2e stub. Autonomous
   lane work leans on it. Scope it against the real code first.
5. **Item B — prompt-history deep analysis (NEW session)**: multi-level analysis of
   the owner's prompt history → the **owner-model** (steward-intelligence §3, home
   still undecided: server-side vs gitignored `OWNER.md`) and the **impact library**
   (§7). Discipline: propose-not-assert, durable, evidence-weighted. Its own context.

Deeper backlog (from the analysis, not yet built): send-cap re-key + escalation
(step 6); `isReversible()` table + ladder rung-state + owner promotion route
(step 7, gated on the journal accruing a clean per-class record); safe queue
increment for steward task-filing (step 8); the delivery/notification surface (a
digest in an unwatched pane is wasted — no push path wired); `steward-mail` (largest
attack surface — none of its defenses exist; keep gated). Fast-follow: a one-click UI
toggle for the kill-switch (mechanism tested, button not built).

## Load-bearing decisions + WHY (do not re-litigate or undermine)

- **Autonomy and safety are one design** (steward-intelligence §1): act freely on the
  reversible, gate the irreversible *forever*, park big decisions in the backlog.
- **The journal is the keystone**: the ladder, prove-before-schedule, and the pulse's
  delta anchor all read from it. Promotion **counts** must live in a durable state
  tally (built with the ladder), **never** by scanning the rotatable journal file, or
  the second rotation silently resets the record autonomy depends on (the critic's
  catch — documented at the write site).
- **Perpetual + kill-switch + quiet are owner-only** by construction: a steward/self
  principal minting an immortal schedule or muting the surface would be un-gated
  autonomy escalation. The run-forever cadence is the owner's call.
- **No staleness fast-forward** (deliberately not built): `advanceAuto` reschedules
  `now + everySec`, so there is no backlog to replay; the pulse is self-contextualizing.
- **The impact lives in the library of proven prompts**, not the autonomy machinery;
  scheduling *multiplies* value (and a bad prompt's harm) → prove-before-schedule.

## How this session worked (keep this rhythm — the owner values it)

Question every assumption against the **actual code** before building (this changed
the design repeatedly). Write tests that **interrogate**, not rubber-stamp — prove
each feature by a contrast where the wrong branch visibly fails (a control that dies
while the perpetual lives; a probe held silent while paused that fires on resume).
**One feature per lane**, verify-first (tsc + `bun run build` + a collision-safe copy
of `./e2e-isolated.sh` with unique SOCK/PORT/DIR), owner lands. **Docs and code move
together** in the same lane. Deterministic evidence beats any document — including
this one.

## Operational facts (verify)

Steward = **slot 1**, cwd `claude-fleet.worktrees/steward`, `FLEET_STEWARD_TOKEN`
baked at spawn (live). Journal live at `/api/steward/journal`. New owner APIs (landed,
undeployed): `/api/autos/switch`, `/api/autos/quiet`, `perpetual:true` on auto create.
A clean `./e2e-isolated.sh` is now longer (perpetual/kill/quiet fire-waits + restart)
— it can exceed a 120s foreground limit; run it in the background and judge the tail
(`ALL PASS`).

## Not mine (pre-existing dirty at session start)

`public/share.html`, `watchdog.sh` were modified before this session — left untouched.
