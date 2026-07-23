# Orchestrator autonomy — the foreman as a stateless, ladder-gated pulse

*Design note 2026-07-23 (JP + session). How the orchestrator role (this-conversation's
"main session" work) becomes largely automatic WITHOUT a new autonomous agent: complete
the deterministic fact layer, externalize the plan, and run a stateless derive-verify-
propose pulse under the steward principal. Sits under `steward-intelligence.md` (ladder,
§7 review-capacity coupling) and beside `merge-review-autonomy.md` (the fact layer it
rides). Line refs cite `5d6ad8f`; grep symbols before relying. Status: the `/foreman`
ritual (`.claude/commands/foreman.md`) is the only built piece; activation is an owner
act (create the auto). Server increments are listed, not built.*

## 1. Two roles, one conversation

The interactive "main session" braids two roles that must be separated before automating:
- **Architect** — the deep design judgment (should self-land exist; the merge-review
  design). Low-frequency, irreducibly interactive. Never automated — it IS the
  conversation with the owner.
- **Foreman** — coordination: verify claims against code, slice into lanes, brief,
  dispatch, monitor, sequence, stage for land. Looks mechanical, is deceptively
  judgment-laden — but the judgment spikes are mostly disguised deterministic checks.

This doc automates the foreman. The architect stays human+session.

## 2. The thesis: make the foreman stateless, not smart

The enemy is context degradation, not missing capability. A long-lived orchestrator
session degrades; a pulse that RE-DERIVES its context from durable state each time
cannot. Two preconditions, both already substantially true:

- **The fact layer is server-authored** — slot state, merge verdicts (now with
  deterministic `verify`, V1), land provenance (git notes `fleet/land`, V2), outcomes,
  digest. Nothing session-claimed. (This is why V2 chose server-written notes over
  agent-written commit messages — the pulse's trust boundary demands it.)
- **The plan is committed** — roadmap, design notes (§7 orderings), `briefs/`. The
  repo IS the program; `/catchup` already proves human-side re-derivation works.

**Empirical evidence (replay, 2026-07-23 session):** of 7 real foreman acts that day,
5 were deterministic checks a pulse covers (handoff-claim verification, stale-worktree
catch, stale-lane-base catch = the V2 bug, doc-committed sequencing, deploy need),
2 were genuine judgment (assessment slicing, brief writing) that correctly escalate.
0 required held context that durable state didn't carry.

## 3. The ladder applied — verbs graded, vehicle chosen structurally

Pulse safety is graded by VERB, on the §4 ladder (observe → propose → act-then-notify →
act-silently). v0 enters at **propose**. But "propose" is only structurally propose
under the **steward principal**: the steward task route hard-forces `pending`
(`server.ts:3042-3054`) and the dispatcher consumes only `queued` (`:1350`) — promotion
to queued is the owner's click. Under the owner token the same filing COULD be `queued`
(= act-at-a-distance when dispatch is on), leaving only a textual leash. Structural
beats textual, and the structural option is free → **v0 runs under the steward
principal**, in the steward slot, as its own recurring auto (`/foreman`), separate from
`/rundgang` (rundgang = board-health watch; foreman = plan-drive; same slot, two autos).

Ceilings: an owner-token pulse is capped at propose forever (its leash is text). The
steward pulse climbs verb-by-verb on outcome evidence — first act candidate:
**auto-rebase-if-clean** (deterministic, reversible, own outcome class). **Land and
deploy are never foreman verbs, under any vehicle** (OWNER.md §4b; deploy is shared
reality outside worktree isolation).

## 4. The standing deterministic guards (what the pulse checks every beat)

1. **Base ancestry** — every active worktree (lanes AND the steward's own):
   `merge-base --is-ancestor <base> main`; behind → "needs rebase". (Caught the live
   V2-stale-base bug; the steward-worktree variant caught the stale rundgang skill.)
2. **Scope overlap** — pairwise `git diff --name-only` intersection of open lanes'
   commits (fact, post-commit) + brief-declared scope (advisory, dispatch-time).
3. **Land-ready** — clean + committed + verify verdict green (or verify absent-and-
   labeled); output is the ready2land list.
4. **Stalled** — no commit and idle beyond threshold → propose nudge/kill, never do it.
5. **Deploy gap** — srv start time older than the last land touching server.ts/src →
   "deploy pending" (proposal only).
6. **Queue convergence** — foreman-filed pending tasks vs. brief/land reality: file
   missing (keyed by brief filename in the task text), flag orphaned as done-candidates.
   Never re-file a matching open task — converge, don't accumulate.

## 5. Hard rules (the amendments the critical check forced)

- **Committed-main only**: the pulse derives from landed state, never working-copy text.
  (The land gate thereby doubles as the plan-approval gate — plans only bind once the
  owner landed them.)
- **Plan-completeness is an architect obligation**: statelessness held in replay only
  because every sequencing decision was committed before it was needed. Corollary
  honesty gate: *the committed plan does not determine the next action → escalate the
  question; never guess.* "Nothing to do" is a valid pulse result.
- **Stateless by construction**: a pulse may not require anything from a previous pulse;
  the steward pane is freely /clear-able.
- **Delta-only report**, pane-transcript as the channel, "nothing new" is one line.
  Always state what was NOT checked.
- **No transcript reads** in v0 (untrusted display material); state + git + committed
  docs only.
- Never: send to panes, open/kill/assign slots, land, deploy, touch anything outside
  the steward worktree. Owner stop instructions always win.

## 6. Climb path (each step gated on the previous living)

1. **v0 — the ritual** (zero server code): `/foreman` + a recurring auto on the steward
   slot (run-capped = the budget guard; quiet hours honored). Owner reads the report,
   promotes tasks, lands, deploys.
2. **Server increments**, each a small lane: `key` field on the steward task route
   (replaces text-matching convergence); next-action synthesis in the digest (per-slot
   deterministic next step, computed server-side); the deploy-gap fact on the slots view.
3. **First act verb**: auto-rebase-if-clean at dispatch/pulse, with its own outcome
   class; conflict → surface, never resolve.
4. **B-partition** (scoped operate routes) → foreman-to-staged under the steward, once
   arena + track record license it. Coupling holds throughout (§7): throughput gains
   are bounded by review capacity — V1-V3 (cheap review) stay the pacing constraint.

## 7. Promotion evidence

The foreman's climb is licensed by its acceptance rate, measurable without new
infrastructure: proposals filed vs. owner-promoted vs. ignored/corrected (task states +
git history). Manual assessment at v0; wire into the outcome tally only when an act
verb exists to gate.
