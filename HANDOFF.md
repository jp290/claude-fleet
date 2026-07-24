# HANDOFF — 2026-07-24 (session 3: model tiers · ③ review agent · the ledger's first rows · a throughput reckoning)

*A thin map, NOT the knowledge — durable findings live in docs/BACKLOG/memory, and this session moved
several of them there deliberately. Treat every line here as a claim to verify: look up commits,
states and counts before building on them.*

---

## 1. State — shipped, deployed, verified

Main HEAD at write time: **`1783d84`** (plus the in-flight lane below). Live `srv` restarted 21:56,
`curl http://100.64.0.1:8790/` → 200. Re-check with:
`git log --oneline -5 && tmux -L claudefleet ls | grep srv && curl -s -o /dev/null -w '%{http_code}' http://100.64.0.1:8790/`

| what | commit | state |
|---|---|---|
| Both model tiers → the 1M variants | `3406b2d`, `1566727` | deployed |
| ③ `🔍 review` advisory agent | `ab59a71` + `7e5c777` | deployed, live |
| Docs/ledger status + `.gitignore` | `1783d84` | committed |
| Recorder fix (`baseSha` + `verified` threading) | `7f37c46` **in a lane, NOT landed** | see §5 |

**Model tiers.** `DEFAULT_MODEL` = `claude-opus-5[1m]` (every session + lane without its own pin),
`SUMMARY_MODEL` = `claude-sonnet-5[1m]` (the throwaway workers: summarize, commit-message, enhance,
merge resolver, ② clean review, digest). Both ids were probed against the installed CLI before being
set. Running sessions keep whatever they spawned with — the model is baked at spawn time.

**③ `🔍 review`.** Owner-only, click-only, advisory `POST/GET /api/slots/:id/review`, mirroring the
✨ summarize plumbing over a slot's OWN diff. Findings without a cited `file:line` are dropped
server-side; `basis` never self-upgrades from `inferred` to `verified`; no `git reset` (unlike ②,
this runs on a LIVE lane that may hold uncommitted work). Absent from the guest share surface.

---

## 2. The load-bearing gotcha of this session

The 1M model ids are spelled `claude-opus-5[1m]`, and `[ ]` are **glob metacharacters**. The model
string is baked into the tmux pane command; `tmux -L claudefleet` runs `default-shell /bin/zsh`, which
**aborts** on an unmatched glob (`no matches found`). Unquoted, this change would have killed **every
new session at spawn** — invisible to `tsc`, fatal in production, and it was found by testing the
hazard (`zsh -c 'echo a[1m]'` → exit 1), not by luck.

Therefore: `MODEL_RE` widened by exactly one end-anchored, alnum, bounded bracket group, and **every**
shell interpolation of a model string single-quoted (`slotCmd`, `summaryViaSession`).
`e2e-claude-gate.sh` asserts the quoted form for both the per-slot and the default model. Rule lives in
`CLAUDE.md` → Deploy. Also closed on the way past: `FLEET_SUMMARY_MODEL` was the one model-bearing env
var reaching a shell line unvalidated; it now goes through `MODEL_RE` like `FLEET_MODEL` always did.

---

## 3. The ledger: unblocked, then immediately proven defective

`lane-outcomes.jsonl` exists. First row (`fleet/review-agent`, `landed`, `model claude-opus-5[1m]`,
`briefHash 419bf857`, `ownerPrompts 2`, `sessionMs` ≈98 min) — **but its calibration payload zeroed**
(`commitCount 0`, `filesTouched []`, `e2eTouched false`, `verified null` for a 2-commit / 5-file /
+318−7 land). Two independent causes, **both only on the clean auto-land path** (`killed`/`shelved`
rows were and are correct):

- `worktree.base` is a branch NAME (`server.ts:1012`), re-resolved at record time — landing has
  already advanced main past the lane, so `base..HEAD` computes to nothing.
- `verified` reads `mergeLast` (`server.ts:2587`), which the merge route deletes before the job starts
  (`4635`) and only rewrites after `landLane` has run (`2942`) — structurally always null.

Diagnosis with line refs: `docs/lane-autonomy-future.md` (2026-07-24-later note). **The first row stays
wrong on purpose** — it could be backfilled from its (correct) `headSha`, but that would be
reconstruction posing as recording. **Do not calibrate any gate on `landed` rows until §5 lands.**

---

## 4. Evidence on ③ — two data points, and what they actually mean

| | lane | what review found | what it missed |
|---|---|---|---|
| DP1 | `fleet/review-agent` (its own diff) | 3 findings, all real, all cited, 0 hallucinations | the one defect this diff *introduced* — the constant it collided with lived outside the diff |
| DP2 | `fleet/outcome-recorder-fix` | a **new, high-impact** defect in the change itself (`??` cannot tell explicit `null` from `undefined`), surfaced before a human read the diff | — (its `notes` correctly declared it could not verify bodies outside the diff) |

**Both lanes were fully GREEN on every suite while carrying a real defect.** That is the durable
lesson, not a fact about this tool: `tsc` + `e2e-claude-gate` prove *does not break*; they are
structurally blind to *compiles, passes, and is wrong*. That blind spot is not closed by adding suites.

Honest limits: DP1's findings were all inherited from the plumbing ③ was told to mirror; review is
**diff-bounded** by construction. Its correct use is therefore narrow and stated in §6.

**Reviews are ephemeral.** `reviewCache` is an in-memory `Map` — findings die on the next deploy, slot
recycle, or tree change. Nothing persists them. Retrieve one at any time without spending a model call:
`GET /api/slots/<n>/review` (pure cache lookup; POST is what spawns).

---

## 5. In flight right now — do not forget this

**Slot 2, lane `fleet/outcome-recorder-fix`, branch commit `7f37c46`, NOT landed.**
It fixes both §3 causes (records the fork **SHA** at lane creation; threads the verify result through
`LandFacts` instead of re-reading `mergeLast`). Review then caught the `??` defect described in §4/DP2;
the correction was sent and, at write time, the lane was proving its new check goes **red against the
pre-fix code** — a requirement of its brief, because a check that is green before and after proves
nothing. Suites were already green (`EXIT=0 GATE=0 CLEAN=0`).

**Next actions on it, in order:** (1) verify independently — the land gate runs only
`tsc && ./e2e-claude-gate.sh`, which is *narrower* than the three suites the lane ran; (2) read the diff
and the fresh review; (3) owner lands it. Landing it produces ledger row #2 — **the first trustworthy
one**.

---

## 6. Throughput — real, but explicitly subordinate

Owner's ranking, stated 2026-07-24 and load-bearing for everything below: **sensible and effective
comes first; "as fast as possible" is a distant second.** Read this section as *where time is lost*,
not as a mandate to go faster — several of the levers here are deliberately parked behind §7.

The uncomfortable observation stands on its own:

> **9 slots were free all day and we ran exactly one lane at a time.**

Fleet is built for parallelism — 16 slots, worktree isolation, and three e2e suites that derive
socket/port/dir from `$$` specifically so they can run concurrently. We drove it as a serial pipeline.
Ranked by cost, the real waits were:

1. **Serialization (largest by clock, NOT the first thing to fix).** Not caused by slots or by safety —
   by **change locality**: both lanes touched `server.ts` and would have collided on land. The
   constraint is the *file footprint*, not the lane count. The unlock would be **footprint-disjoint
   dispatch**, whose input is `filesTouched` in the outcome row — precisely what §5 is fixing.
   **But it must not be taken yet**, and the reason is the whole point of this project's operating
   model: machine capacity was never the constraint — **review is** (`operating-model.md` Invariant 5).
   Three concurrent lanes produce three diffs that must each be read carefully, and this session's
   evidence is that the careful read is exactly what catches what the gates cannot (§4). Parallelism
   ahead of perception does not buy throughput; it buys a backlog of unreviewed green work, which is
   the expensive failure mode, not the cheap one. Park it behind §7.2.
2. **Re-verification serialized after the lane already verified.** Both times my independent run agreed
   with the lane's claim. n=2 is far too small to stop verifying — the value of a check is in the case
   where the lane errs, not the expected case — but it should run **concurrently** with reading the
   diff and the review, and should not duplicate what the land gate will run anyway.
3. **Correction round-trips.** Each costs a full re-verify cycle. Both of this session's corrections
   trace to a *namable* brief gap, now written into `lane-brief-template.md` → "Lessons earned".
4. **Waiting for the owner to land.** This is the designed gate. It stays.

**Speed comes from removing human *waits*, not human *checks*.** The two are constantly confused, and
under the owner's ranking only the first is ever on the table.

One lever that is about *effectiveness*, not speed, and is therefore worth taking early: **auto-run ③
when a lane goes done-looking**
(`automation-frontiers.md` §3, "verify-before-surface"). It spends only a subscription call, it cannot
gate anything, and the existing git-state cache key makes "fire once per state" nearly free to
implement correctly. By the time the owner looks, the findings are already there — a wait removed
without a check removed.

---

## 7. What I would do next, in order

**The selection principle, from this project's own critique.** `automation-frontiers.md` carries a
section titled *"Discipline check — the theory is ahead of the build"*, and that remains the standing
risk: this corpus holds far more analysis than shipped mechanism. So the ordering rule is —
**prefer the small thing that closes a loop over the large thing that extends the map.** ③ is the
model: built in one lane, and it produced a real, load-bearing finding on its second use (§4/DP2).

1. **Land §5.** Unblocks trustworthy `filesTouched`/`verified` — everything below depends on it.
2. **Perception before any new capability.** ①b the outcome feed (`merge-review-autonomy.md`
   component #6) **plus** persisting review findings onto the outcome row, **plus** auto-running ③ when
   a lane goes done-looking (§6). Today the ledger is write-only and reviews evaporate on the next
   deploy: Fleet cannot see itself. Per `docs/README.md` §"Four capabilities", in-flight steering (c)
   is not responsibly buildable without this — and neither is parallelism (§6.1). This is the
   ambitious-but-correct piece, and it is also the *small* one: the rows exist, the schema exists, the
   findings exist in RAM. It is wiring, not invention.
3. **The prompt-logic / evidence session** the owner wants. Scope it as *the evidence schema + the
   briefing procedure*, NOT a prompt framework: the 2026-07-23 dream-mode pass found 1 confirm / 4
   refuted / 11 confirmed-but-already-mitigated across 16 prompt rewrites — strong executors close
   textual gaps themselves, and the leverage was infrastructure. Note the corpus is thin exactly where
   it matters: `streams/prompts.jsonl` is 2406 rows but only **87 owner**, 21 auto, **0 steward**. The
   cheap, real substrate is already there: `ownerPrompts` in the outcome row is an intervention proxy
   (a lane that landed unaided records 1; each correction adds one — both of this session's lanes
   recorded 2), and `briefHash` correlates a brief to its outcome.
4. **Footprint-disjoint parallel dispatch** — explicitly **gated behind (2)**. Capacity is not the
   constraint; review is. Revisit only once the feed makes unreviewed work visible.
5. **Opportunistic:** the two shared-plumbing defects in §8; `e2e-isolated.sh` graduating into the land
   gate (it ran clean every time this session — a datapoint, not a proof).

**Guardrails that must not move while doing any of it:** the land gate stays machine-checked and the
owner holds the token; autonomy expands only where the blast radius is "wasted lane"; an advisory
agent may only ever *downgrade* an auto-land, never widen it.

---

## 8. Known-real, deliberately unfixed

- **Shared-plumbing pair (affects ✨ summarize AND 🔍 review identically).** (i) Both cache the awaited
  single-flight result under the **second** caller's key — a racing POST can store a result computed
  for a different git state. (ii) The cache key omits the lane base ref. Fixing only the review half
  would leave the two asymmetric and hide a shared defect; they belong in one change touching both.
- **The first ledger row stays zeroed** (§3), on purpose.
- **Leaked test servers from PRIOR sessions:** pids `23906/23907` (Jul 23), `57507` (Jul 21), `51871`
  (Jul 18), plus ~193 stale tmux socket files in `/private/tmp/tmux-501/`. Outside the repo = shared
  reality; reported, not touched. This session's own suite runs cleaned up after themselves.
- **Auto-dispatch is OFF** (`dispatch: false`, `FLEET_DISPATCH_REPO` unset). Lanes are spawned
  explicitly; turning it on is an autonomy expansion and an owner decision.

---

## 9. Where the durable knowledge went this session

- `docs/README.md` — **new**: the four-capability map (a/b/c/d), which doc owns which, and why the safe
  expansion order is b → a → c. Read it before treating the autonomy docs as competing frameworks.
- `docs/automation-frontiers.md` §1a — **new**: corrections split into *taste* (sparse, high-variance,
  teaches the owner-model) vs *defect* (dense, objectively adjudicable, teaches the **brief** and
  measures the gate's blind spot), with this session's two instances as the first real data.
- `docs/lane-brief-template.md` — **new** "Lessons earned from real lanes": name the out-of-diff
  neighbours; enumerate the test *cases*, not just "a red test"; say which slots a new e2e check may
  touch.
- `docs/lane-autonomy-future.md` — the recorder-defect diagnosis with line refs.
- `docs/merge-review-autonomy.md` §7 — ③ shipped; ledger unblocked; landed rows not yet trustworthy.
- `CLAUDE.md` → Deploy — the model tiers and the zsh-glob quoting rule (on disk, gitignored; Fleet
  copies it into every lane worktree).
- memory `project-fleet-landing-autonomy` — "a row of zeros looks like data and is worse than no row."
