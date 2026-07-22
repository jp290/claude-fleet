# HANDOFF — safety spine + risk-doctrine revision + owner-model built; next is deploy + prove the live heartbeat (2026-07-22)

*This file is a prompt for you, the next session. Treat every claim, number, path,
and commit hash here as a **claim to verify** against the tree and the running
system before building on it (CLAUDE.md) — deterministic evidence beats this
document. Its job is to induce the right model, not to be trusted.*

*Two work phases landed 2026-07-22, in order: **Phase 1** (earlier) built the
heartbeat's safety-spine CODE — journal/perpetual/kill-switch/quiet (next section).
**Phase 2** (later) revised the risk doctrine and built the owner-model — see "THE
open decision — RESOLVED" and "Ranked next steps" below; that is the current front.
Where the two sections say "this session," Phase-1 text means the earlier phase.*

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

## THE open decision — RESOLVED 2026-07-22 (the fork is dissolved)

*Superseded. The old fork (read-only worker vs. read-only token) existed only to
**prevent the steward acting (sending) during a pulse**. The 2026-07-22 doctrine
revision (steward-intelligence §1) removes its premise: the steward acting during a
pulse is **acceptable bounded action**, not a hole to close. `/api/steward/send` is
owner-facing + reversible + idle-gated against an active human (OWNER.md §4c), so it
sits in the reversible-latitude zone, not the unrecoverable-and-large-blast gate.
Third-party outbound (the real never-cross line, OWNER.md §4b) is a **different**
capability and stays gated regardless. So: **no read-only worker/token is needed for
a safe beat.** Context-drain remains a real but *non-safety* concern — iterate the
ephemeral worker later for context economy, not as a safety prerequisite. Verify the
send-target claim against the `/api/steward/send` route before deploy — don't take
this note's word for it.*

## Ranked next steps

1. **DONE this session:** doctrine revised (§1 + intro + thesis + this handoff);
   **owner-model built** → gitignored `OWNER.md` (home resolved, §3), the safety-critical
   §4 risk-surface corpus-confirmed (48/48 transcripts, two extraction agents). This is
   the old step-5 "Item B" owner-model half. Wired into `/steward` load ritual + README.
   **Also DONE:** committed to `main` (`e959227`), steward worktree ff-merged, `srv`
   restarted (sessions survived), and a **bounded live heartbeat armed** — auto `3499a018`,
   `/rundgang` every 7200s, perpetual, idle-gated 60s, quiet 23–8. Kill-switch =
   `POST /api/autos/switch {"on":false}`. A code-grounded as-built map now lives in
   **`docs/steward-overview.md`** (three-agent read of `server.ts`).
2. **THE high-leverage, low-risk lever — hand the steward deterministic facts it currently
   re-infers** (`docs/steward-overview.md` §signal-quality lever). The pulse's whole
   `condition` classification is LLM-derived every time, though the server holds the raw
   signals; `claudeAlive` (`server.ts:1007`), the full `mergeLast` verdict (only the
   `resolved` bool is surfaced), `Task` status, and `gitOp` in the overview are all withheld
   from every steward route. Compute the condition server-side + surface these. This is
   "verify against real state" applied to the steward's senses — it raises the ceiling on
   everything below and adds **zero** risk. Do this **before** widening autonomy.
3. **(Owner's emphasis) Test the steward AGENT under the long-autonomous lens** — now
   with OWNER.md loaded: does it self-gate correctly (OWNER.md §4d), stay honest,
   quiet-when-nothing-changed, non-drifting over many pulses, and *use* the owner-model's
   risk map? Try genuinely different approaches. Richest once a bounded beat runs.
4. **Item A — commit-functions QA gate** (owner-requested, "at the end"): exercise the
   *real* commit machinery end-to-end, not the `fakecommit` e2e stub.
5. **Impact library (old Item B, second half)**: the owner-model is built; remaining is
   seeding the **library of proven prompts** (§7) — the Rundgang digest as prototype
   item — and standing up the journal→owner-model growth loop (steward *proposes* edits,
   JP promotes). Propose-not-assert, evidence-weighted.
   - **Concrete first seed step (owner-requested):** run a **Grok/web-research prompt**
     (existing forming library item, §7) to survey what people already do most impactfully
     with agents — e.g. a scheduled morning news/state digest — and distill the
     *schedulable subset* (self-contextualizing, periodic, harmless-when-nothing-changed)
     into candidate library items. Prove-before-schedule each before it graduates.

Deeper backlog (from the analysis, not yet built): send-cap re-key + escalation
(step 6); `isReversible()` table + ladder rung-state + owner promotion route
(step 7, gated on the journal accruing a clean per-class record); safe queue
increment for steward task-filing (step 8); the delivery/notification surface (a
digest in an unwatched pane is wasted — no push path wired); `steward-mail` (largest
attack surface — none of its defenses exist; keep gated). Fast-follow: a one-click UI
toggle for the kill-switch (mechanism tested, button not built).

## Load-bearing decisions + WHY (do not re-litigate or undermine)

- **Autonomy and safety are one design** (steward-intelligence §1, *revised 2026-07-22*):
  act freely on everything recoverable — accepting *bounded probabilistic harm* to the
  degree the steward's judgment is proven — gate only the **unrecoverable-and-large-blast**
  few *forever*, park big decisions in the backlog. Tolerance scales with judgment quality;
  the owner-model (§3) is what *licenses* the loosened tolerance, so building it and
  loosening the gate are **one move**, not two. For a capable model, context beats restraint.
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
