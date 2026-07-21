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

## OPEN PUZZLE — the steward routes are NOT being served

`curl http://100.64.0.1:8790/api/steward/sessions -H "authorization: Bearer
<owner-token>"` → **404**, even though `srv` was restarted at **22:18** (after the
21:11 landing) and the route exists in main's `server.ts` (`/api/steward/sessions`
handler, ~server.ts:2543). So a plain `kill-session -t srv` restart did NOT pick
up the code. Investigate first: is the running server started from the current
main checkout? Check the watchdog/launchd path, whether the process is stale,
whether FLEET_HOST/cwd differ. (I earlier wrongly claimed "deployed" from a 401 —
a weak signal; the 404 against a valid owner token is the real evidence.)

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

1. **Investigate the deploy 404** (above) — blocks everything steward-runtime.
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
