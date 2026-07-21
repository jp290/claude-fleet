# HANDOFF — the steward subsystem (2026-07-21)

*Treat every claim here as a claim: verify against the tree / running system
before building on it (CLAUDE.md). Pointers, not assertions.*

## What this session did

Designed and partially built **the steward** — an optional "workhorse agent"
subsystem for Fleet: a designated planning/conversation agent that observes,
digests, and proposes, but never acts unprompted. Wrote its full knowledge shelf,
landed two server features, and codified the theory of prompt-writing underneath
the whole library. Most output is **design** (docs); the built core is small and
one deploy is unresolved.

## Built & landed on main (verify each)

- **Audit log** — `appendEvent()` generic write chain + `audit()` (commit
  `9477b80`, landed ~20:14). `audit.jsonl` is gitignored (runtime artifact).
- **Scoped steward principal** — `/api/steward/{sessions,send,autos,token}`,
  typed+capped sends (server renders templates, no free-text), 403 on owner
  routes (commit `31a962d`, landed ~21:11).

## RESOLVED — the steward routes ARE served; the 404 was a scope mismatch, not a stale deploy (2026-07-21)

The previous session tested `/api/steward/sessions` with the **owner** token and
got 404, concluding the deploy was stale. Deterministically disproven:
`handleStewardRoute` (server.ts:2542) is only entered for requests carrying the
**steward** token (the gate at server.ts:2636); the owner token falls through to
owner routing, which has no such handler → the final `not found` 404. That 404 is
**by design** — capability scoping, per the code comment at server.ts:2631–2634.
Verified against the running server (PID 65674, started 22:18 from the main
checkout, includes `31a962d`):
- `/api/steward/token` + owner token → **200** (owner reads the steward token here).
- `/api/steward/sessions` + **steward** token → **200**, returns all 16 slots.

So nothing steward-runtime is blocked by a deploy. The real remaining gap is the
one under "Live state": the steward pane has no `FLEET_STEWARD_TOKEN`, so the
Rundgang can't self-serve `/api/steward/*` (was ranked #4 — now the actual #1).

## The knowledge shelf (docs/, all on main; README.md is the index)

Steward subsystem: `steward.md` (the convention: optional, `⚙ steward`,
plans-never-lands), `steward-autonomy.md` (7 joints + empirical playbook),
`queue-automation.md` (queue as substrate: producers multiply, gate stays one),
`automation-synergies.md` (6 synergies + the anti-synergy), **`steward-intelligence.md`**
(capstone: autonomy×safety via reversibility×track-record, the 3 models, the
learning loop, the impact layer), `steward-mail.md` (email channel, inbound-only,
threat model), `automation-frontiers.md` (6 speculative levers, pressure-tested,
dependency-spined). Foundation shelf unchanged + new **`prompt-axioms.md`** (the
theory under tailored-context + /sharpen).

## Library artifacts (committed)

`.claude/commands/steward.md` (`/steward` — load ritual) and
`.claude/commands/rundgang.md` (`/rundgang` — the observe-and-digest pulse, built
with the implicit-question technique + a metacognitive calibration opener). Both
merged into the steward worktree.

## Live state

Slot 1 = `⚙ steward`, cwd `claude-fleet.worktrees/steward` (branch `steward`,
mirrors main + carries gitignored CLAUDE.md). A manual `/rundgang` proof-run
surfaced two wiring gaps: `/rundgang` isn't loaded in a running session (needs a
fresh session or reload), and the steward has **no token in its pane** so it can't
self-serve state via `/api/steward/sessions`.

## Parked / next (ranked)

0. ~~Investigate the deploy 404~~ — **DONE** (RESOLVED section above): not a deploy
   bug, a scope mismatch. Nothing steward-runtime is blocked.
1. **Wire the steward token into its pane** (`FLEET_STEWARD_TOKEN`) — **BUILT, lane
   `steward-token` @ `1bf55c0`, pending owner land.** Mechanism decided by grounding:
   env is only injectable at spawn (can't patch a running `claude` process), and a
   slot becomes steward by *relabel* (server.ts:2337), so bake at spawn keyed on
   `s.label === STEWARD_LABEL` — same mechanism + exposure as `FLEET_SELF_TOKEN`
   (server.ts:843). Consequence (accepted, mirrors FLEET_SELF_TOKEN): a live relabel
   takes effect only on the pane's next (re)spawn, since a srv-only deploy doesn't
   recycle living panes. e2e proves the token reaches a steward pane and is absent
   for a non-steward slot (collision-safe run: 349 PASS / ALL PASS).
   *Open follow-up to weigh:* whether `/rename`→steward should trigger a
   resume-respawn so designation delivers the token immediately (a behavioral change
   to `/rename`, deliberately NOT smuggled into this lane); and whether an
   ex-steward pane should drop the token on relabel-away.
2. **Owner-model** — none exists yet (`steward-intelligence.md` §3 designed it).
   Plan: synthesize the already-curated corpus (feedback+user memories under
   `~/.claude/projects/*/memory`, the ~33 project `CLAUDE.md`s, the global
   `~/.claude/CLAUDE.md`) via a fan-out workflow into a **proposed** draft the
   owner curates; home = a gitignored local `OWNER.md` (like CLAUDE.md), NOT a
   committed doc. Disciplines: durable+evidence-weighted, work-function-scoped,
   propose-not-assert. Re-derive the file list in the new session (don't trust
   `/tmp`).
3. **Prove `/rundgang` then schedule as the heartbeat** — prove-before-schedule
   (§6.5/6.6): watch it work N times, then a Fleet auto on the steward slot firing
   `/rundgang` (autos already carry the idle + claude-alive gates); bound by
   active-hours + kill-switch. Heartbeat verb-discipline: **attend unprompted, act
   only through the ladder** — never "act/work unprompted" raw.
4. **Wire the steward token into its pane** (the token-lane's unresolved point) so
   the Rundgang can self-serve.
5. Optional: add `prompt-axioms.md` + `/rundgang` to the `/steward` load ritual.

## Load-bearing decisions (pointers into the shelf)

Autonomy and safety are one design (reversibility × track-record; irreversible
classes capped at *propose* forever; promote-slow/demote-fast). The impact lives
in the **library of proven prompts**, not the autonomy machinery; scheduling
*multiplies* value (bad prompts too) → prove-before-schedule. Reversibility is
action-type × context (the idle gate is a reversibility modifier). Advisors
inform; the gate decides; landing stays human.

## Not mine (pre-existing dirty at session start)

`public/share.html`, `watchdog.sh` were already modified before this session —
left untouched.
