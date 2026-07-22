# The steward — as built, and what it's primed to become

*The accessible map of the steward subsystem: what it **is**, what it can **do today**
(as-built, code-cited), the near-term **lever** that most improves it, and the
**trajectory** it is designed toward. The other docs deepen this — `steward.md` (the
convention), `steward-autonomy.md` (the loop's joints + intervention playbook),
`steward-intelligence.md` (the capstone theory: autonomy×safety, the three models, the
impact layer), `OWNER.md` (its model of JP). Written 2026-07-22 from a three-agent read
of `server.ts`; **AS-BUILT** claims carry `server.ts:line` refs, **INTENDED** claims are
marked. Treat the refs as claims to verify (CLAUDE.md) — the tree is the judge.*

---

## What it is

One durable session in a labelled slot (`⚙ steward`), living in its own worktree so it
can never touch `fleet.json`/the owner token. On `/steward` it loads its **three-model
mind**: the *system* (docs shelf), *you* (`OWNER.md`), and *itself* (the journal). It
**plans, never lands** — its output is understanding and briefs, not patches
(`steward.md`). It is a convention, not a server feature: zero code in `server.ts` knows
it exists; Fleet is fully functional without it.

## What it can do today (AS-BUILT)

- **Sense** (read-reduced, capability-asymmetric by design): `GET /api/steward/sessions`
  (`server.ts:2610`) → per-slot `id, cwd, label, lastOutput, git{branch,dirty,ahead,behind},
  worktree, mergePending`; on-demand `/brief` (full lane git footprint), `/transcript`
  (thinking blocks stripped, tool_result trimmed to 400 chars — `2628`), `/journal`.
- **Pulse — the Rundgang** (`/rundgang`, now on a live 2h perpetual beat): *calibrate →
  sense → interpret (assign each lane a condition) → honesty gate → emit 3 sections
  (needs-decision / changed / state) + a typed journal record.* **Zero delivery: it is
  attention, never action** — anything it wants to nudge/commit/land is a decision it
  surfaces, not an act it takes (`rundgang.md`).
- **Nudge** (the only way it moves work): `POST /api/steward/send` (`2548`) — *fixed
  server-rendered* templates (`state_relay | lifecycle_op | continue_nudge`; **free text
  rejected**, `2550`); `renderStewardMessage` refuses any `ref` that doesn't match a
  currently-true deterministic fact (`2510`); idle-gated 60s, hourly cap (10), 1 per
  kind×slot per 10-min episode. Caps are re-derived from the durable `audit.jsonl`, not
  memory (`2561`).
- **Self-schedule**: `POST /api/steward/autos` — an auto on its **own** slot, non-perpetual.
- **Journal**: durable pulse ledger, append-only via the same `appendEvent` chain as audit,
  single `.1` rotation, reader spans the boundary so the delta anchor survives a `/clear`.

**What the steward CANNOT do (owner-only, 403 "route not in scope"):** perpetual autos,
the kill-switch, quiet hours, and **all** spawn/dispatch — open a slot, spawn a lane, file
or promote a task, toggle the dispatcher (`handleStewardRoute` exposes none of these,
`2609–2681`). By construction, not by policy.

## How the heartbeat runs (the automation engine, AS-BUILT)

`tickAutos` fires every 5s (`server.ts:2488`): **global kill-switch first** (`autosOn`,
`1108` — mutes the *entire* surface by not ticking) → skip if `now < nextAt` → claude-alive
gate → **quiet hours** (recurring autos only, tick-in-place reschedule; one-shots always
fire — `1136`) → **idle gate** (`idleSec` vs `lastOutput`, with a 10-min grace window,
`1141`) → fire (`sendText`) → `advanceAuto` (perpetual **re-arms without decrementing**;
non-perpetual burns `runsLeft` → dies at 0, `1087`). Caps in `createAutoForSlot`: 5 active
per slot, min 10s interval, mandatory run cap 1–100, **perpetual owner-only** (`allowPerpetual`,
passed only by `POST /api/slots/:id/autos`, `3496`). *The live beat:* `/rundgang` every
7200s, idle-gated 60s, quiet 23–8, kill-switch = `POST /api/autos/switch {"on":false}`.

## The signal-quality lever — "are we using the deterministic abstractions?" (near-term, high-leverage, LOW-risk)

**The steward's decision quality is capped by its input quality.** Every fact the server
computes but does not hand over, the steward **re-infers in the LLM** — statistical guessing
where a deterministic fact exists. This is `OWNER.md` §2 ("verify against real state, never
guess") applied to the steward's own *senses*, and it is "context beats restraint" in its
purest form: better deterministic input → better judgment → more earned autonomy, at **zero
added risk**. Ranked gaps (each: *server already knows X → steward must infer it*):

1. **Lane CONDITION is LLM-derived every pulse.** `rundgang.md:14` orders the steward to
   *classify* each lane (`healthy-running / stalled-dirty / stuck-looping / awaiting-human /
   done-looking / unknown`). The server has **no** such classifier (grep-verified); it
   computes only a 3-way `editing/ready/clean` (`dirty?"editing":ahead?"ready":"clean"`),
   and even that lives **client-side** (`src/client.ts:1334,2119`) from `gitInfo` the server
   already holds. The one classification
   the whole pulse turns on is re-derived from raw signals each time. *Fix: a deterministic
   condition classifier server-side, handed to the steward.*
2. **`claudeAlive` (`server.ts:1007`) is computed but on no steward route** — the steward
   cannot tell a *dead* pane from an *idle* one; `now − lastOutput` reads identically for
   "human thinking," "agent finished," and "process crashed." Highest-value single withheld
   field — it disambiguates `awaiting-human` / `done-looking` / `dead`.
3. **`mergeLast` verdict is invisible except the `resolved` boolean** (`2616`) — a lane whose
   land **failed** (`error`) or was **refused** (`blocked`), with `detail` + `conflicted[]`,
   is a section-1 "needs your decision" item the steward *cannot see*. Directly defeats the
   pulse's primary output.
4. **The "what changed" delta is not computed server-side** — `rundgang.md:11` hands the
   steward two payloads (prior journal + current sessions) to diff by hand; the server could
   difference them deterministically.
5. **Task / `laneTask` status is withheld entirely** — the founding-intent baseline against
   which "done-looking" is judged; without it the steward infers intent from transcript text
   (which `rundgang.md:14` itself flags as untrusted).
6. **`gitOp` (wedged merge/rebase) is absent from the overview** (per-slot `/brief` only) — a
   wedged lane is a hard `awaiting-human` a fast pulse misses.
7. **Land-blocked reasons are computed only at land time** — never surfaced ahead as a
   per-lane "why this can't land yet."

**Principle: build these before adding autonomy.** A steward that reasons from facts is both
safer *and* more useful than one inferring them — this is the cheapest, lowest-risk step on
the whole roadmap, and it raises the ceiling on everything above it.

## What it's primed to become (INTENDED — steward-intelligence.md)

- **The autonomy ladder** — each action-class climbs `observe → propose → act-then-notify →
  act-silently`, promoted only when its journal track-record earns it; the
  unrecoverable-and-large-blast few are capped at `propose` **forever** (§1, revised 2026-07-22).
- **The learning loop** — journal outcomes → distillation → *proposed* edits to the playbook
  and to `OWNER.md` → **you promote**. It gets provably smarter by convincing you, never by
  seizing capability.
- **The impact library** — the value lives in the library of *proven* schedulable prompts
  (`impact = value(prompt) × reliability × frequency`); the Rundgang digest is the prototype
  first item; seed the rest via the Grok/web-research survey of what agents do most
  impactfully (a morning digest is canonical).
- **Orchestration / outsourcing to fresh Opus/Fable sessions.** Fleet *already is* a
  spawn-fresh-isolated-sessions substrate — `createWorktree` lanes + a `pending→queued→sent→done`
  task queue + an idle `tickDispatch`. The **intended** shape: the steward files/briefs work
  (reversible → act-freely), a lane executes **quarantined** in a worktree, and **land stays
  owner-only forever** (the gate). What is **unbuilt** for steward-driven Opus/Fable dispatch:
  (1) **per-session model selection** — today every slot runs the process-wide `FLEET_CMD`
  (`server.ts:37`); no per-slot `--model`, no model field on `Slot` (only throwaway helper
  agents take `--model`); (2) a **steward-scoped dispatch/file capability** — today the steward
  has zero spawn reach; (3) **closing the loop** — today the owner promotes `pending→queued`
  and arms the dispatcher, *and promotion should stay gated*. **Subscription-safe:** all spawns
  are interactive `claude`, never metered `-p` (designed so, `server.ts:1507`). **The
  constraint that dominates:** *review capacity, not throughput* (README) — dispatching N
  Opus lanes only helps if the steward **prepares each landing to a glance**; throughput
  without review-prep buries the owner (negative value), and scheduling multiplies a bad
  brief's cost → prove briefs before automating dispatch.

## The gates that never move

Land/merge, third-party outbound comms, real money, credential exposure, destroying
unrecoverable work, driving a pane a human is actively working — permanently human-gated
(`OWNER.md` §4b, `steward-autonomy.md` "the line that is never crossed"). Everything
reversible: the steward acts, accepting bounded harm scaled to judgment
(`steward-intelligence.md` §1).

## Next (ranked)

1. **Signal-quality upgrade** (the lever above) — highest leverage, lowest risk; raises the
   ceiling on everything else. Start with server-side condition + surfacing `claudeAlive`,
   the full `mergeLast` verdict, and `Task` status.
2. **Watch the live beat prove out** — the real "test the steward" under the long-autonomous
   lens (honest, quiet-when-nothing-changed, non-drifting, *uses* the owner-model's risk map).
3. **Seed the impact library** — the Grok research → schedulable digests, proved before scheduled.
4. **(Larger, gated) dispatch capability + per-session model** — steward files/briefs, lanes
   run Opus/Fable quarantined, land stays owner-only. Only with review-prep, or it buries you.
