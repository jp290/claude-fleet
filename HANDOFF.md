# HANDOFF — 2026-07-24 (session 3, model tiers → ③ review agent → the ledger's first row)

*A thin map, NOT the knowledge — durable findings live in docs/BACKLOG/memory. Treat every line as a
claim to verify (look up commits/states/counts before building on them).*

## State: shipped + DEPLOYED this session (live `srv` restarted 21:56, HTTP 200)

Main HEAD `7e5c777`. In order landed to main + deployed:
- **Model tiers → the 1M variants** (`3406b2d`, `1566727`). `DEFAULT_MODEL` = `claude-opus-5[1m]`
  (sessions + lanes), `SUMMARY_MODEL` = `claude-sonnet-5[1m]` (the throwaway workers). Both ids were
  probed against the installed CLI before being set.
- **③ the `🔍 review` agent** (`ab59a71` + fix `7e5c777`) — owner-only, click-only, advisory
  `POST/GET /api/slots/:id/review`, mirroring ✨ summarize over the slot's OWN diff. Gates nothing,
  absent from the guest share surface. Built + landed *through a Fleet lane*, which is what produced
  the ledger's first row.

Verify state: `git log --oneline -5 && tmux -L claudefleet ls | grep srv && curl -s -o /dev/null -w '%{http_code}' http://100.64.0.1:8790/`.

## The load-bearing gotcha of this session (read before touching model strings)

The 1M model ids are spelled `claude-opus-5[1m]`, and `[ ]` are **glob metacharacters**. The model
string is baked into the tmux pane command, and `tmux -L claudefleet` runs `default-shell /bin/zsh`,
which **aborts** on an unmatched glob (`no matches found`). Unquoted, this change would have killed
**every new session at spawn** — invisible to `tsc`, fatal in production. Hence: `MODEL_RE` widened
only by one end-anchored alnum bracket group, and every shell interpolation single-quoted (`slotCmd`,
`summaryViaSession`). `e2e-claude-gate.sh` asserts the quoted form for both the per-slot and the
default model. Rule is in CLAUDE.md → Deploy.

## The ledger: unblocked, and immediately proven defective

`lane-outcomes.jsonl` now exists (first row: `fleet/review-agent`, `landed`, `model
claude-opus-5[1m]`, `briefHash 419bf857`, `ownerPrompts 2`). **But its calibration payload is zeroed**
(`commitCount 0`, `filesTouched []`, `e2eTouched false`, `verified null` for a 2-commit / 5-file /
+318−7 land). Two causes, both on the **clean auto-land** path, both diagnosed and cited in
`docs/lane-autonomy-future.md` (2026-07-24-later note): `worktree.base` is a branch NAME re-resolved
after main already moved, and `verified` reads a `mergeLast` entry the merge route has deleted by then.
→ **Do not set any gate from ledger data until the recorder fix lands.** The first row stays wrong on
purpose — backfilling it would be reconstruction posing as recording.

## Recommended next

1. **The recorder fix** (in flight as a lane at the time of writing): record the fork **SHA** at lane
   creation and use it in `buildLaneOutcome`; pass the verify result through `LandFacts` instead of
   re-reading `mergeLast`; `.gitignore` the ledger file. Falls back to today's behaviour for lanes
   created before the field existed — never guesses.
2. **Use ③ on a real lane before building more.** The open question is whether it saves the owner
   reading time; a dogfood run on its own diff produced 3 real, correctly-cited findings and 0
   hallucinations, but all 3 were *inherited* from the summarize plumbing and it MISSED the one defect
   this diff introduced, because that defect lived outside the diff. Precise, but diff-bounded.
3. **①b the review feed UI** — now that rows exist, but only once they are trustworthy (see above).

## Two shared-plumbing defects found, deliberately NOT fixed here

Both affect ✨ summarize AND 🔍 review identically; fixing only the review half would hide a shared
defect and leave the two asymmetric. They belong in one change that touches both:
- `summaryResponse`/`reviewResponse` cache the awaited single-flight result under the **second**
  caller's key — a racing POST can store a result computed for a different git state.
- the cache key omits the lane base ref.

## Still open from earlier sessions (unchanged)

- Leaked test servers from PRIOR sessions still running: pids `23906/23907` (Jul 23), `57507` (Jul 21),
  `51871` (Jul 18), plus ~193 stale tmux socket files in `/private/tmp/tmux-501/`. Outside the repo =
  shared reality; reported, not touched. This session's own suite runs cleaned up after themselves.
- `e2e-isolated.sh` ran clean (no known flake) on every run this session — a datapoint, not a proof,
  toward letting it graduate into the land gate.
- Auto-dispatch is OFF (`dispatch: false`, `FLEET_DISPATCH_REPO` unset). Lanes are spawned explicitly.

## Where the durable knowledge lives

`docs/lane-autonomy-future.md` (autonomy doctrine + the recorder-defect diagnosis) ·
`docs/merge-review-autonomy.md` §7 (land-hardening program state, ③ shipped) · `BACKLOG.md` ·
`CLAUDE.md` → Deploy (model tiers + the quoting rule) · memory: `project-fleet-land-hardening`,
`project-fleet-landing-autonomy`.
