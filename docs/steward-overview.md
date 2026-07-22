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
  (`server.ts:2788`) → per-slot `id, cwd, label, lastOutput, git{branch,dirty,ahead,behind},
  worktree, mergePending` **plus, since 2026-07-22 (Tier-1 signal-sharing): `alive` (cached
  `claudeAlive`, ~10s `tickGit` tick — READS only, gates stay fresh), `gitOp` (wedged
  merge/rebase, cached the same way), `idleMs` (server-computed `now−lastOutput`), `merge`
  (the FULL `mergeLast` verdict: status/detail/conflicted/at), and `task` (the lane's founding
  Task: id/status/source/text)**; on-demand `/brief` (full lane git footprint + the same
  `merge`/`task`), `/transcript` (thinking blocks stripped, tool_result trimmed to 400 chars —
  `2822`), `/journal`.
- **Pulse — the Rundgang** (`/rundgang`, now on a live 2h perpetual beat): *calibrate →
  sense → interpret (assign each lane a condition) → honesty gate → emit 3 sections
  (needs-decision / changed / state) + a typed journal record.* **Zero delivery: it is
  attention, never action** — anything it wants to nudge/commit/land is a decision it
  surfaces, not an act it takes (`rundgang.md`).
- **Nudge** (the only way it moves work): `POST /api/steward/send` (`2564`) — *fixed
  server-rendered* templates (`state_relay | lifecycle_op | continue_nudge`; **free text
  rejected**, `2566`); `renderStewardMessage` refuses any `ref` that doesn't match a
  currently-true deterministic fact (`2526`); now gated through the shared `canDeliver` (`2578` — master stop + quiet hours + fresh alive + idle 60s), then hourly cap (10), 1 per
  kind×slot per 10-min episode. Caps are re-derived from the durable `audit.jsonl`, not
  memory (`2585`).
- **Self-schedule**: `POST /api/steward/autos` — an auto on its **own** slot, non-perpetual.
- **Journal**: durable pulse ledger, append-only via the same `appendEvent` chain as audit,
  single `.1` rotation, reader spans the boundary so the delta anchor survives a `/clear`.

**What the steward CANNOT do (owner-only, 403 "route not in scope"):** perpetual autos,
the kill-switch, quiet hours, and **all** spawn/dispatch — open a slot, spawn a lane, file
or promote a task, toggle the dispatcher (`handleStewardRoute` exposes none of these,
`2787–2881`). By construction, not by policy.

## How the heartbeat runs (the automation engine, AS-BUILT)

`tickAutos` fires every 5s (`server.ts:2630`): **global kill-switch first** (`autosOn`,
`1234` — mutes the entire *scheduled* surface, all autos incl. the live `/rundgang` beat, by
not ticking) → skip if `now < nextAt` → then the shared `canDeliver(s, opts)` choke-point
(`1218`, called at `1253`): **fresh claude-alive** → **quiet hours** (recurring autos only,
tick-in-place reschedule; one-shots always fire — `inQuietHours` `1197`) → **idle gate**
(`idleSec` vs `lastOutput`, `1228`) → fire (`sendText`) →
`advanceAuto` (perpetual **re-arms without decrementing**; non-perpetual burns `runsLeft` →
dies at 0, `1185`). **The former seam is CLOSED (2026-07-22):** the master stop + quiet-hours +
a fresh alive-check now reach a direct `/api/steward/send` (`2704`) AND the dispatcher (pre-gate
`1328`, requeue-on-fail re-gate `1355`) through the *same* `canDeliver`, not just `tickAutos` —
see `synergy-findings.md` Tier-0 #1/#2. Caps in `createAutoForSlot`: 5 active per slot, min 10s
interval, mandatory run cap 1–100, **perpetual owner-only** (`allowPerpetual`, passed only by
`POST /api/slots/:id/autos`, `3767`). *The live beat:* `/rundgang` every 7200s, idle-gated 60s,
quiet 23–8, kill-switch = `POST /api/autos/switch {"on":false}`.

## The signal-quality lever — "are we using the deterministic abstractions?" (near-term, high-leverage, LOW-risk)

**The steward's decision quality is capped by its input quality.** Every fact the server
computes but does not hand over, the steward **re-infers in the LLM** — statistical guessing
where a deterministic fact exists. This is `OWNER.md` §2 ("verify against real state, never
guess") applied to the steward's own *senses*, and it is "context beats restraint" in its
purest form: better deterministic input → better judgment → more earned autonomy, at **zero
added risk**. Ranked gaps (each: *server already knows X → steward must infer it*).
***Gaps 2/3/5/6 CLOSED 2026-07-22 (the Tier-1 lane)** — see the Sense bullet above for the
shipped fields; 1 (deferred by design), 4, and 7 remain:*

1. **Lane CONDITION is LLM-derived every pulse — but this ranked too high (corrected 2026-07-22).**
   `rundgang.md:14` orders the steward to *classify* each lane (`healthy-running / stalled-dirty /
   stuck-looping / awaiting-human / done-looking / unknown`). The server has **no** such classifier
   (grep-verified). But two things sink an early fix: the git-derived 3-way it might compute
   (`editing/ready/clean`) is **already derivable by the steward** — `/api/steward/sessions` ships
   the full `git` object (`server.ts:2794`) — and it is **not** the 6-way taxonomy above, none of
   which fall out of git alone. *Standing plan: no early classifier; the withheld inputs
   (`claudeAlive`/`mergeLast`/`Task`/`gitOp`) are now surfaced, so the pulse keeps deriving
   `condition` in-LLM from complete inputs until a real 6-way classifier — which still needs an
   unbuilt `stuck-looping` detector — is worth building. See `synergy-findings.md` Tier 1.*
2. **CLOSED — `claudeAlive` (computed `server.ts:1105`) is on the steward read routes** as the
   cached `alive` field (per-slot `aliveInfo`, refreshed each ~10s `tickGit` tick; delivery
   gates keep their FRESH check — cache-for-reads/fresh-for-gates, e2e-proven). The steward can
   now tell a *dead* pane from an *idle* one; previously `now − lastOutput` read identically for
   "human thinking," "agent finished," and "process crashed." Was the highest-value single
   withheld field — it disambiguates `awaiting-human` / `done-looking` / `dead`.
3. **CLOSED — the FULL `mergeLast` verdict** ({status, detail, conflicted, at} via
   `stewardMergeView`, `server.ts:2776`) is on the steward sessions + brief routes — a lane whose
   land **failed** (`error`) or was **refused** (`blocked`) is now visible as the section-1
   "needs your decision" item it is. Previously only the `resolved` boolean leaked.
4. **The "what changed" delta is not computed server-side** — `rundgang.md:11` hands the
   steward two payloads (prior journal + current sessions) to diff by hand; the server could
   difference them deterministically.
5. **CLOSED — Task / `laneTask` status** rides on the steward surface (`stewardTaskView`,
   `server.ts:2782`: id/status/source/text) — the founding-intent baseline against which
   "done-looking" is judged, no longer inferred from untrusted transcript text.
6. **CLOSED — `gitOp` (wedged merge/rebase)** is on the fleet-wide overview (cached `gitOpInfo`,
   same tick + reads-only contract as `alive`) — a wedged lane is a hard `awaiting-human` the
   fast pulse previously missed.
7. **Land-blocked reasons are computed only at land time** — never surfaced ahead as a
   per-lane "why this can't land yet."

**Principle: build these before adding autonomy.** A steward that reasons from facts is both
safer *and* more useful than one inferring them — this was the cheapest, lowest-risk step on
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
  are interactive `claude`, never metered `-p` (designed so, `server.ts:1651`). **The
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
   ceiling on everything else. Start with `claudeAlive` (the linchpin — cache for reads, keep
   the gates fresh), the full `mergeLast` verdict, and `Task`/`gitOp` status; **defer the
   `condition` classifier** (its git subset is already derivable, its real conditions need
   `claudeAlive` first).
2. **Watch the live beat prove out** — the real "test the steward" under the long-autonomous
   lens (honest, quiet-when-nothing-changed, non-drifting, *uses* the owner-model's risk map).
3. **Seed the impact library** — the Grok research → schedulable digests, proved before scheduled.
4. **(Larger, gated) dispatch capability + per-session model** — steward files/briefs, lanes
   run Opus/Fable quarantined, land stays owner-only. Only with review-prep, or it buries you.
