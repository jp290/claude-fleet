# HANDOFF — 2026-07-24/25 (session 3: model tiers · ③ review agent · the ledger's first rows · the sharpen-corpus correction)

*A thin map, NOT the knowledge — durable findings live in docs/BACKLOG/memory, and this session moved
several of them there deliberately. Treat every line here as a claim to verify: look up commits,
states and counts before building on them.*

---

## 1. State — shipped, deployed, verified

Main HEAD at write time: **`79f024c`**, tree clean. Live `srv` restarted **00:16:54**,
`curl http://100.64.0.1:8790/` → 200. The running build includes every code commit below
(`3442a26` was committed 23:49, srv started after it). Re-check with:
`git log --oneline -5 && tmux -L claudefleet ls | grep srv && curl -s -o /dev/null -w '%{http_code}' http://100.64.0.1:8790/`

| what | commit | state |
|---|---|---|
| Both model tiers → the 1M variants | `3406b2d`, `1566727` | deployed |
| ③ `🔍 review` advisory agent | `ab59a71` + `7e5c777` | deployed, live |
| Docs/ledger status + `.gitignore` | `1783d84` | committed |
| Recorder fix — fork `baseSha` + `verified` via `LandFacts` | `fdfae3a` + `3442a26` | **landed + deployed** (§3) |
| Lane-lesson framing correction · steward-nudge design | `eedb1fb`, `79f024c` | committed (§9) |

**Independently verified on landed main** (2026-07-25, not taken from the lane's own claim):
`tsc` 0 errors · `bun run build` ok · `e2e-isolated.sh` **ALL PASS**, 595 checks, 0 FAIL ·
`e2e-claude-gate.sh` **ALL PASS** 0 FAIL · `e2e-clean-review.sh` **ALL PASS** 0 FAIL. This mattered:
both recorder commits reached main while the owner landed and were, until this pass, covered only by
the lane's own assertion. The known `e2e-isolated` pane-capture flake did not fire — as it has not on
any run this session, which is now ~6 clean runs (a datapoint toward letting it into the land gate,
still not a proof).

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

Diagnosis with line refs: `docs/lane-autonomy-future.md` (2026-07-24-later note).

**FIXED and deployed** (`fdfae3a` + `3442a26`, live since 00:16). Read the shape, because the lane
chose a stronger fix than the one it was briefed with:

- `laneForkSha()` (`server.ts:566`) captures `merge-base <base> HEAD` **at lane creation/attach**, and
  all three creation paths store it (`1026` manual, `1471` dispatcher, `4420` attach). The recorder
  resolves `facts.baseSha ?? s.worktree.baseSha ?? laneBaseRef(s)` (`2587`) — the land site's own
  `mainBefore` first (the exact commit the lane was rebased onto), then the stored fork commit, then
  today's behaviour for lanes forked before the field existed. It never guesses.
- `verified` was made **non-optional** in `LandFacts` (`2536`), so every construction site must supply
  it and both constants set `verified: null` explicitly — the `mergeLast` fallback is unreachable from
  a land **by construction**, not by a guard. That is the stronger of the two options offered in the
  correction, and it is why `kind === "landed" ? facts.verified : …` (`2625`) is safe.

**Both existing rows stay zeroed, for two different and honest reasons.** Row 1 (`fleet/review-agent`)
was written by code that had the bug. Row 2 (`fleet/outcome-recorder-fix`) was written by a server
still running the **pre-fix build** — it landed 23:50 while `srv` had been up since 21:56; the fix was
in `main` and had never been loaded. **Row 3 is the first real test.** Neither is backfilled: it could
be reconstructed from the (correct) `headSha`, but that would be reconstruction posing as recording.
**Do not calibrate any gate on rows 1–2.**

*Deploy lesson, worth generalising: landing is not deploying. A landed fix that changes recording
behaviour is inert — and silently so — until `srv` is restarted.*

---

## 4. Evidence on ③ — two data points, and what they actually mean

| | lane | what review found | what it missed |
|---|---|---|---|
| DP1 | `fleet/review-agent` (its own diff) | 3 findings, all real, all cited, 0 hallucinations | the one defect this diff *introduced* — the constant it collided with lived outside the diff |
| DP2 | `fleet/outcome-recorder-fix` | a **new, high-impact** defect in the change itself (`??` cannot tell explicit `null` from `undefined`), surfaced before a human read the diff | — (its `notes` correctly declared it could not verify bodies outside the diff) |

**Both lanes were fully GREEN on every suite while carrying a real defect.** That is the durable
lesson, not a fact about this tool: `tsc` + `e2e-claude-gate` prove *does not break*; they are
structurally blind to *compiles, passes, and is wrong*. That blind spot is not closed by adding suites.

Honest limits: DP1's findings were all inherited from the plumbing ③ was told to mirror, and review is
**diff-bounded** by construction. So its correct use is narrow:

| situation | move |
|---|---|
| small/mechanical lane, gate green | just merge — undo-land exists |
| lane touches something **load-bearing or persistent** — a state shape, the land path, auth, shell interpolation, anything written to disk or to main | **read it before merging.** There "green but wrong" is not a revert, it is silent data corruption — which is exactly what DP2 caught |
| the merge itself **failed** | read the failure output, **not** a review. A conflict is about main's side, which the reviewer never sees; a red verify already gives the exact error. When something deterministic has spoken, it wins |

Review is for when the deterministic layer stayed *silent*. It costs no metered tokens (throwaway
claude on the subscription), so the price is latency and attention — the question is only whether it
changes the decision.

**Reviews are ephemeral.** `reviewCache` is an in-memory `Map` — findings die on the next deploy, slot
recycle, or tree change. Nothing persists them. Retrieve one at any time without spending a model call:
`GET /api/slots/<n>/review` (pure cache lookup; POST is what spawns).

---

## 5. Nothing is in flight — both lanes landed

Both lanes of this session are landed and their worktrees removed; the only remaining worktrees are
`steward` and `flake-waitmerge` (pre-existing). No slot holds a lane. Auto-dispatch is off, so nothing
starts on its own.

The recorder lane's own working method is worth keeping as the template: it ran all three suites, then
**proved its new check goes red against the pre-fix code** before claiming done — the requirement its
brief carried, because a check that is green before and after proves nothing.

**One process lesson from how this landed.** The owner landed both lanes while the assistant was
writing docs, so the code reached `main` covered only by the lane's own claim; the independent
verification happened afterwards (§1) and passed. That order worked, but it worked by luck: the land
gate runs only `tsc && ./e2e-claude-gate.sh`, which is *narrower* than the three suites a lane runs
itself. If independent verification is wanted before a land, it has to start when the lane reports —
not after.

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

1. ~~Land the recorder fix.~~ **Done** — landed and deployed (§3). Row 3 will be the first real test
   of it; nothing else has to happen for that.
2. **Perception before any new capability.** ①b the outcome feed (`merge-review-autonomy.md`
   component #6) **plus** persisting review findings onto the outcome row, **plus** auto-running ③ when
   a lane goes done-looking (§6). Today the ledger is write-only and reviews evaporate on the next
   deploy: Fleet cannot see itself. Per `docs/README.md` §"Four capabilities", in-flight steering (c)
   is not responsibly buildable without this — and neither is parallelism (§6.1). This is the
   ambitious-but-correct piece, and it is also the *small* one: the rows exist, the schema exists, the
   findings exist in RAM. It is wiring, not invention.
3. **The steward-nudge measurement** — `docs/steward-nudge.md` §8, and read §9 below first. It is pure
   analysis over artefacts that already exist, touches nothing live, and it *decides* whether the
   mechanism is worth building. This replaces the vaguer "prompt-logic session": the prompt corpus and
   its derived model already exist and are done (§9), so the open question is no longer *what* the
   owner corrects but **whether a machine could have known when**.
   The cheap instrumentation is already in place: `ownerPrompts` in the outcome row is an intervention
   proxy (a lane that landed unaided records 1; each correction adds one — both of this session's lanes
   recorded 2), `briefHash` correlates a brief to its outcome, and steward sends are their own
   prompt-journal source, currently **0**, so every future nudge is unambiguously attributable.
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
- **Both existing ledger rows stay zeroed** (§3) — row 1 by the bug, row 2 by the un-deployed fix.
  Neither is backfilled, on purpose.
- **Leaked test servers from PRIOR sessions:** pids `23906/23907` (Jul 23), `57507` (Jul 21), `51871`
  (Jul 18), plus ~193 stale tmux socket files in `/private/tmp/tmux-501/`. Outside the repo = shared
  reality; reported, not touched. This session's own suite runs cleaned up after themselves.
- **Auto-dispatch is OFF** (`dispatch: false`, `FLEET_DISPATCH_REPO` unset). Lanes are spawned
  explicitly; turning it on is an autonomy expansion and an owner decision.

---

## 9. The sharpen-corpus findings — read this before designing any prompt mechanism

Late in the session the owner pointed at `~/.claude/knowledge/sharpen-corpus/` (205 mined `/sharpen`
situations, 182 resolved, a derived model, an adversarial and a completeness evidence pass, and
`rebuild.py` to regenerate from the durable transcripts). **It changes what a prompt mechanism here
may be, and two claims made earlier in this very session were wrong because of it:**

- **`/sharpen` is a drift-correction operator, not intent-clarification.** The activating word ("gib
  dir Mühe", "denk gut nach", "own your work") is **content-free** — it precedes *opposite* operations
  at #0/#38/#51. The content comes from the gap between the situation and the owner's running
  intention, reconstructed by the receiver.
- **THE GUARD (binding).** A correction is `f(situation, running intention)`, and the second coordinate
  **is not a surface feature** — #92 vs #191/#192 resolve to opposite corrections from an identical
  visible surface. A table keyed on the surface therefore *fails*, and flattening the axes into
  `situation-type → mechanism` is named as "the specific error this corpus exists to prevent".
  `situations.jsonl` is ground truth; the axis model is an index into it.
- **Corrected in this handoff:** the earlier line "the prompt corpus is thin — only 87 owner rows" used
  the wrong file and the wrong measure. `streams/prompts.jsonl` is a raw send log; the actual corpus is
  the 205 situated records, already analysed, and **cross-validated against OWNER.md** — its three
  dominant drift-corrections are exactly OWNER.md §2's top three, from two independently built
  artefacts. It is not thin and it is not raw. It is done.
- **Also corrected:** the "lessons earned" entries in `lane-brief-template.md` were first written as a
  growing checklist. Both defects were discoverable *inside the repo*, so they were
  attention-allocation failures, not information failures — and "enumerate more neighbours" does not
  scale. The framing was fixed in `eedb1fb`; a brief's job is only the residue that exists **solely in
  the conversation**.

**What follows from it — `docs/steward-nudge.md` (designed, NOT built).** The owner's proposal: the
steward fires a short, **content-free**, purely positive trigger at a lane on a surface signal, and the
*session* supplies the correction from its own brief and state. This splits the function at the only
seam that survives THE GUARD — **steward owns the timing, never the content** — so no lookup ever
forms. It widens playbook #3 `continue-nudge` (which already carries the manually-proven predecessor
the doctrine requires); it is not a new intervention type. Two things not to lose:

- **"Purely positive" is a safety property, not a tone.** The corpus's boundary condition (*no gap →
  sharpen idles, harmless when nothing changed*) holds only for a content-free trigger. A message
  carrying a diagnosis gets conformed to **even when the diagnosis is wrong** — told it was shallow, a
  capable model digs deeper and invents a problem. Free false positives are what make the mechanism
  deployable unattended; give that up and it needs a human again.
- **It can only ever mean "more".** The axes are bidirectional; `ASK→ACT`, `scope-creep→discipline` and
  the stop cases must stay with `stuck-looping` / `awaiting-human` (*escalate, never improvise*). A lane
  five rounds into a structural problem, told "gib dir Mühe", digs further in.

**Do not build a prompt writer.** The corpus's own finding is that the corrective *type* is largely
stock; this design deliberately does not instantiate. A small fixed vocabulary is the ceiling THE GUARD
imposes, and it is enough — put the intelligence budget into the *timing* decision.

---

## 10. Where the durable knowledge went this session

- `docs/README.md` — **new**: the four-capability map (a/b/c/d), which doc owns which, and why the safe
  expansion order is b → a → c. Read it before treating the autonomy docs as competing frameworks.
- `docs/automation-frontiers.md` §1a — **new**: corrections split into *taste* (sparse, high-variance,
  teaches the owner-model) vs *defect* (dense, objectively adjudicable, teaches the **brief** and
  measures the gate's blind spot), with this session's two instances as the first real data.
- `docs/lane-brief-template.md` — **new** "Lessons earned from real lanes", framed as *instances, not a
  checklist* (see §9): the scaling rule is the habit sharpen installs, and a brief carries only the
  residue that exists solely in the conversation.
- `docs/steward-nudge.md` — **new**: the content-free nudge design, why it survives THE GUARD, its
  direction-bias limit, and the measurement that gates it. Anchored from `docs/README.md`, from
  playbook #3 in `docs/steward-autonomy.md`, and from `BACKLOG.md`.
- `docs/lane-autonomy-future.md` — the recorder-defect diagnosis with line refs.
- `docs/merge-review-autonomy.md` §7 — ③ shipped; ledger unblocked; landed rows not yet trustworthy.
- `CLAUDE.md` → Deploy — the model tiers and the zsh-glob quoting rule (on disk, gitignored; Fleet
  copies it into every lane worktree).
- memory `project-fleet-landing-autonomy` — "a row of zeros looks like data and is worse than no row."
