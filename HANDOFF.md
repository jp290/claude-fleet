# HANDOFF — 2026-07-25 (session 5: seven lands in one day — the calibration phase begins)

> **LATE-DAY ADDENDUM (written ~15:00, supersedes stale parts below).** After §1–§8 were
> written, the day continued:
> - **Two more lands** (`fc32fc9` criteria-progress header, `0f7fa06` transcriptFact +
>   bundleStale), both deployed + built. **K1: 8/20**, streak intact.
> - **② shadow's first two production verdicts: both `raw: true`** — the real model misses
>   the JSON contract; gate mode would have (fail-closed) stopped both clean auto-lands.
>   Shadow proved its purpose on day one. Raw answer NOT persisted → diagnosis blocked
>   (fix candidate #1). K2: 0/25 valid.
> - **Fire-drill #1 on auto-③** (+ re-adjudication after reading ③'s spec): in-diff
>   semantic defect MISSED (inverted guard read as cosmetic, stamped "verified"); second
>   item was an invalid test (needed forbidden context). Operational reading:
>   `review: covered` = "a review ran", NOT "code is sound". Canonical home:
>   **`docs/judge-calibration.md`** (procedure, per-judge state, instrument-check rules);
>   dated entries in `graduation-criteria.md`'s amendment log; portable kernel in
>   `~/.claude/knowledge/judge-calibration.md`.
> - **Criteria doc amendments** (`33d919a`): Ns = anti-impatience gates, not statistics;
>   K1 homogeneity caveat; confirm-lands are the OWNER's (row 10 was the one self-granted
>   exception, now a written rule). Owner-attention budget axiom in `steward-pulse-v2.md`.
>   CLAUDE.md: fails-identically-at-HEAD proof required for any flake claim.
> - **Two autonomy trials IN FLIGHT at handoff time:** mission lane `flake-mission`
>   (slot 2 — picks one of the two §6 flakes itself, fixes it) and **steward-pulse phase A
>   trial #1** (slot 1 briefed to compose ONE facts+question nudge for slot 2 at a
>   self-chosen moment). Check their outcomes FIRST: pane reports, whether the steward
>   sent (its send is capped + journaled), the lane's `[pulse-reply]` line, and the
>   mission lane's land. Stop-and-review cases go to the owner.
> - Fresh instrument lessons (full text `judge-calibration.md`): deployGap is NESTED in
>   the sessions payload (a top-level read produced a phantom "regression" that a
>   same-instrument scratch test "confirmed"); `killed-dirty` = killed with unlanded
>   commits (server.ts:2784).

*A thin map, NOT the knowledge. Durable findings live in `docs/` (§4 names owners). **Treat every
line as a claim to verify.** This session's own instrument-error (§5.1) is the freshest reason.*

---

## 1. State — verified at write time, not remembered

```
git log --oneline -5 && tmux -L claudefleet list-sessions | grep srv \
  && curl -s -H "Authorization: Bearer <stewardToken>" http://100.64.0.1:8790/api/steward/sessions \
     | python3 -c "import json,sys; print(json.load(sys.stdin)['deployGap'])" \
  && wc -l lane-outcomes.jsonl
```

- `main` = `9032845`, srv up 13:00:52 **carrying exactly that commit** — proven by the served
  `deployGap: {behindCount: 0, codeBehind: false}` (the fact now proves its own deployment).
- **deployGap is NESTED** under its own key in the sessions payload. Reading top-level keys
  returns nulls that look like "boot git call failed" — this session lost 20 minutes to that (§5.1).
- Ledger: **11 rows.** Rows 5–11 all carry `review: covered`; rows 6–11 landed through the
  F9-fixed gate. `cleanReviewShadow` is `None` everywhere yet — the shadow flag went live only
  with the 13:00 srv; **the first clean auto-land after 13:00 is the first shadow verdict.**
- `dispositions.jsonl` does not exist yet — created by the first owner label. Not a bug.
- Client bundles rebuilt 13:03 (they were **stale since 00:50** — see §5.3).
- Worktrees: only `steward` + the orphaned `fleet-flake-waitmerge` (owner decision pending).

## 2. What landed today (all deployed, srv 13:00:52)

| commit | what | proof status |
|---|---|---|
| `cffa4a5` | F9: land verify deterministic (`bun install --frozen-lockfile` prelude in `watchdog.sh` VERIFY_CMD) | proven both directions in fresh worktree; then in production: rows 7–8 verified green with no node_modules |
| `9c1ffbe` | outcome feed (🧾 renderOutcomes) + F5 write-side (`scope`/`notes`/`raw` on OutcomeReview) | row shapes both-handled; F5 fields in the union type at HEAD |
| `7983c3a` | P-4 deploy-gap fact (`bootHead` vs HEAD, nested `deployGap` on sessions+digest) | self-confirmed live; correctly ignored docs-only commits (`codeBehind: false` at behind=2) |
| `def5cbf` | ✨ enhance: `briefPayload` DATA block, directive table deleted, `enhance-prompt.ts` with real prompt tests | e2e asserts the real module |
| `1789389` | ② shadow mode (`FLEET_CLEAN_REVIEW=shadow`): runs on clean auto-lands, records `cleanReviewShadow`, **never gates**; errored run = `verdict null, raw true`, never a fabricated pass | e2e-clean-review has a shadow phase; no live verdict yet |
| `3e9f7b2` | `doneLookingSince` — additive second tier, trigger unchanged, one-edit clause-list property kept | landed via **first resolver-conflict confirm-land** (§5.4) |
| `16468a2` | disposition rail: `dispositions.jsonl` (owner-only write, self-token 403 proven, labels advance `harmAttestAt`), ✓/✗ on feed rows, ③ nützlich/falsch, ✨ auto-disposition (accepted/edited/ignored) | negatives e2e-proven; ref shapes: land=`branch@ts`, review3=patchId, enhance=draftId |
| `9032845` | `FLEET_CLEAN_REVIEW=shadow` into the watchdog srv-spawn env | spawn line committed; live env inferred from restart order, not read from the process |

Docs landed: `graduation-criteria.md` (pre-registered numbers, amendment rule),
`steward-pulse-v2.md` (nudge trials protocol), F5/F9 resolutions at their claim sites (`424affa`).

## 3. The frame that ordered everything (owner-endorsed)

1. **Unfed mechanisms are Fleet's recurring defect** — enhance was starved, `outcomeTally`/
   `harmAttestAt` never fed, `baselineSamples` per-boot, the ledger reader missing. Rule: no new
   judging/measuring layer without its feeder in the same move.
2. **The authority ladder: record → display → advise → gate → act.** Every judging instance
   climbs by measured hits, never by being built. ② is at "record" (shadow). The criteria doc
   holds the rungs' numbers.
3. **Risk concentrates at the land gate; upstream may loosen.** Since today the gate is
   deterministic (F9), observed (feed), reversible (undo-land), measured (ledger). That is what
   makes steward-pulse trials cheap: a wrong upstream decision at worst produces a lane the gate
   stops. (`steward-pulse-v2.md` — phases A/B/C, THE GUARD honored via facts+one-question.)
4. **The bottleneck is data velocity now, not build velocity.** Criterion 1 progress at this
   writing: **6/20 lands** (rows 6–11), 0 undos, 5 clean autos. K2: 0/25 shadow verdicts.
   Everything lands through Fleet from now on — a hand-land is a lost ledger row.

## 4. Doc owners for what's new

`graduation-criteria.md` (the numbers + amendment log) · `steward-pulse-v2.md` (nudge trials)
· `perception-layer.md` (feed built-status updated by lane) · `discrepancy-audit.md` F5/F9
resolutions · `merge-review-autonomy.md` §7 FIXED note · `lane-signals.ts` header (doneLookingSince).

## 5. Method lessons — this session's own errors, freshest first

1. **An instrument error double-confirmed is still an instrument error.** `deployGap` was read at
   top level (it is nested) → nulls; the scratch "reproduction" used the same wrong read and
   "confirmed" a nonexistent regression. One unnecessary srv restart before the actual fix: read
   the payload. Rule: before debugging a "regression", diff your measurement against the last
   measurement that "worked" — the difference was in my python, not in the server.
2. **F9 fires on your own lands.** The land order (F9 lane first → deploy → rest) existed because
   the un-fixed gate would have downgraded the sibling lanes. Sequencing against your own
   in-flight fixes is part of the plan, not an afterthought.
3. **Client bundles are a deploy step.** `public/*.js` is gitignored; landing client code changes
   NOTHING until `bun run build` runs in the main checkout. The feed shipped at 12:19 and was
   invisible until 13:03. (Candidate mechanical fix: build-on-boot or a bundle-mtime vs
   src-mtime fact next to deployGap.)
4. **First resolver-conflict land is on record (row 10):** 2 import-line conflicts resolved by
   the agent, verify green through the new gate, diff reviewed first-hand, confirm-landed. This
   is exactly the class component 5 would auto-land once K1 is met.
5. **done-looking is recall-sound but latency-loses vs a human** (~minutes: 60s threshold +
   repaint resets + poll interval). Fixed additively (`doneLookingSince`), trigger untouched.
   Epoch-0 caveat: a never-spoke slot reads as quiet-since-epoch — pollers must special-case it.

## 6. Known structural flakes (both verified at HEAD by two independent lanes)

- `FLEET_SELF_TOKEN absent for a non-lane slot` — pane-capture race (~600ms), pre-existing.
- baselineRate ring-saturation (`fleet-e2e.ts` ~3603): `samples > start.samples` unsatisfiable
  once the 50-ring saturates. Structural; belongs to the cleanup lane.

## 7. Open items, in intended order

1. **Criteria-progress view** (small lane, client now free): feed header shows "K1 n/20 · K2
   n/25 · undos 0". Closes the last loop — progress toward autonomy becomes perceptible.
2. **Cleanup lane:** split `fleet-e2e.ts` (3.9k lines, the one collision point of every lane
   pair) into `e2e/*.ts` + fix both §6 flakes + possibly collapse the 7 `FLEET_*_CMD` stand-in
   pairs. Do NOT start while any other lane is in flight.
3. **Steward-pulse phase A first watched trial** — when normal work sessions exist again.
   Protocol in `steward-pulse-v2.md`; caps already machine-enforced.
4. **Parked owner idea (2026-07-25):** a faster one-sentence communication layer inside the
   nudge process — deliberately NOT designed yet; revisit after phase A data exists.
5. **Owner decisions pending:** clean 3 leaked `bun server.ts` (Jul 18/21/23) + ~235 stale
   `/private/tmp/tmux-501` sockets; fate of orphaned `fleet-flake-waitmerge` worktree.
6. **Provenance lane** (F3: briefHash null on 25/49; plus the ✨ `source:"owner"` rider moved
   here) — after the above.
7. Rotation policy for `dispositions.jsonl` (rail report §1: evidence should not silently
   rotate at 5MB like an audit log does).

## 8. A fresh session's first five minutes

1. Run §1's state command. If `deployGap.behindCount > 0` with `codeBehind: true` — deploy first,
   nothing measured before it means anything. Remember: the field is NESTED.
2. `python3 -c ...` the last ledger rows: any `cleanReviewShadow` yet? First one = K2 has begun;
   judge its `verdict` against the actual land before trusting the counter.
3. Check `dispositions.jsonl` existence — first labels = the rail is being used; if the owner has
   labeled, `harmAttestAt` in fleet.json should be non-zero (promotion machinery now feedable).
4. Two producers rule (unchanged): `git worktree list` + `git status` before touching `docs/`.
5. `docs/README.md` → `graduation-criteria.md` → `steward-pulse-v2.md` is the shortest path to
   the current program.
