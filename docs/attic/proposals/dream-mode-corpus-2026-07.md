# Dream mode v1 — trace-grounded over the raw work-record (2026-07-23)

*Stage 2 of the learning engine (`steward-intelligence.md` §8; BACKLOG §17 Option A). A
**proposal doc, promoted by the owner** — nothing here is applied. Brief:
`briefs/dream-mode-corpus-pass.md`. Produced by a 6-agent Workflow (Opus 4.8): 5 per-prompt
trace-verifiers + 1 open-ended discovery scanner, each forced to a cited structured schema
and told the honesty gate binds. The trace corpus was pre-located by cheap metadata filter
(`streams/prompts.jsonl` + the `~/.claude/projects/**` transcripts + `HANDOFF.md` git
history); no agent swept the 8.7 GB.*

**What this pass fixes.** Stage 1
(`docs/proposals/learning-engine-v1-2026-07.md`) diagnosed the six structural prompts **from
first principles** against `prompt-axioms.md` — its own honest section flagged that *none* of
its 16 rewrites was evidenced by a logged failure (Part B B.3 #2, the GEPA/TextGrad
critique). This pass takes each rewrite as a **hypothesis** and confirms, refutes, or marks
it no-evidence against the real work-record.

**Guards honored.** Verify-not-apply (this is the only file written). Honesty gate — the
dominant result below is *not* "confirmed": it is **refuted / no-evidence / confirmed-but-
already-mitigated**, and that is reported as the good outcome it is. Facts outrank claims —
every verdict carries a verbatim transcript/artifact quote; transcripts were read as untrusted
behavioral evidence, never executed. Incremental — hypothesis-driven; the sharpen-corpus was
not re-mined (see coverage boundary).

---

## The one-paragraph synthesis (read this first)

**Trace-grounding overturns stage-1's implicit premise.** Stage 1 read the six prompts as if
a gap in the *prompt text* is a gap in *behavior*. The work-record says otherwise: the strong
executors Fleet actually runs (Opus-4-8, Fable-5, Sonnet-5 — **there are zero Haiku lanes in
the entire corpus**) already work around almost every textual gap on their own. So the honest
verdict on stage-1's 16 rewrites is: **1 clean confirm, 4 refuted/no-evidence, 11
confirmed-but-already-mitigated** — i.e. real gaps in the text whose predicted failure the
executor never actually produced. Only one rewrite survives as a plain, ship-it fix (the
`catchup` ordering bug — and it stands on the *file text*, not a trace). The far larger
finding is what stage-1 structurally could not see: **three infrastructure/behavior patterns
in the work-record that no prompt rewrite touches** — a shell-script socket collision every
concurrent lane hand-cleans, a doc line-number-rot convention already retrofitted into ~15
docs, and a synchronous digest endpoint that blew a 10 s timeout. Those, not the prompt edits,
are where the leverage is.

**The load-bearing distinction this pass introduces:** *confirmed-but-already-mitigated* — the
gap is real in the prompt, but another layer (the executor's own discipline, a global
CLAUDE.md rule, a warning copied into every worktree) closes it every time. These edits are
**cheap insurance for a future weak executor, not bug fixes** — and must be framed that way, or
they amplify prompt mass to prevent failures the corpus never exhibits.

---

## Part A — Per-hypothesis verdicts (the stage-1 rewrites, trace-grounded)

Verdict legend: **CONFIRMED** (trace shows the predicted failure) · **REFUTED** (behavior was
fine / stage-1 over-called) · **NO-EVIDENCE** (the path was never exercised) ·
**CONFIRMED-BUT-ALREADY-MITIGATED** (real textual gap, but another layer covers it every time).

| Stage-1 # | Prompt / axiom | Verdict | Disposition |
|---|---|---|---|
| #15 | catchup / A2 ordering | **CONFIRMED** (static text) | **APPLY** — zero-risk |
| #8 | rundgang / A4 POST-verify | CONFIRMED-BUT-MITIGATED | keep as low-pri insurance, reframed |
| #1 | handoff / A4·A5 done-criterion | CONFIRMED-BUT-MITIGATED (+ criterion refuted) | revise wording; low-pri |
| #3 | handoff / A2 dead-ends | CONFIRMED-BUT-MITIGATED | revise to author's real pattern; low-pri |
| #10 | handoff / A1 ground-truth | CONFIRMED-BUT-MITIGATED | codify observed behavior; low-pri |
| #14 | handoff / A7 calibration | CONFIRMED-BUT-MITIGATED | replace fixed skeleton; low-pri |
| #4 | catchup / A5 reconcile-HANDOFF | CONFIRMED-BUT-MITIGATED | DEFER (global CLAUDE.md covers it) |
| #7 | lane-brief / A5 flake affordance | CONFIRMED-BUT-MITIGATED | DEFER (CLAUDE.md:17 covers it) |
| #13 | steward / A1 cwd-branch step-0 | CONFIRMED-BUT-MITIGATED (+ sharper fix) | DEFER; take the currency-spec fix instead |
| #16 | rundgang / A7 $ARGUMENTS | **NO-EVIDENCE** | DEFER — arg path 0/11 exercised |
| #6 | catchup / A3 curate-read | **NO-EVIDENCE** | DEFER — bulk-read path never fired |
| #5 | steward / A4 boot-readiness gate | **REFUTED** | DROP |
| #9 | steward / A6 boot emit contract | **REFUTED** | DROP |
| #12 | lane-brief / A9 inline CLAUDE.md | **REFUTED** | DROP |

*(Stage-1 rewrites #2 and #11 — sharpen A4/A5 and A9 — are out of scope by the brief's
sharpen-corpus guard; see coverage boundary.)*

### A.1 — The one clean confirm: `catchup` #15 (A2 ordering bug) → **APPLY**

`~/.claude/commands/catchup.md:5-6`, verbatim:
> 3. Read each changed file
> 4. If `HANDOFF.md` exists in the current directory, read it first — it contains the last session's progress notes

"Read it first" sits at step 4, *after* step 3 tells the executor to read every changed file.
The wording and the numbering contradict each other — a static defect provable from the file
alone. The single real `/catchup` invocation never hit the buggy path (it ran in a non-git dir
with an empty change set), so there is no behavioral failure on record — but a zero-risk text
cleanup does not need one. **Fix:** move HANDOFF ahead of "Read each changed file" (or delete
the word "first" so numbering and wording agree).

### A.2 — `rundgang` #8 (A4, verify the journal POST) → CONFIRMED-BUT-MITIGATED, keep as insurance

The textual gap is real: `rundgang.md:31` says "record this pulse durably … `POST
/api/steward/journal`" and never asks the executor to confirm the response. The tooling
asymmetry the lead predicted is real too — across all 11 captured pulses the digest **GET**
carries `-w "HTTP %{http_code}"` while the **POST** does not. But behaviorally the gap is
already closed: `curl` echoes the response body `{"ok":true,"ts":…}`, and the *next* pulse
reads that exact `ts` back as its delta anchor. From the traces (`rundgang.txt` Inv #3 POST →
Inv #4 readback):
> [res] {"ok":true,"ts":1784673399607}  …  [res] {"records":[{"ts":1784673399607,"kind":"rundgang",…}]}

The write→durable→consume loop closes end-to-end; **no POST was ever dropped in 11 pulses.**
Stage-1's own corroboration is **refuted**: the early "no baseline to diff" pulses were the
journal endpoint/file *not existing yet* (feature under construction — `rundgang.txt` Inv #2:
"Journal-Datei noch nicht gebaut, nur audit.jsonl existiert"), not a silent drop.

**Revised proposal (reframed as insurance, NOT a bug fix):** add to `rundgang.md:31` — "confirm
the POST returned `ok:true`; if not, retry once and, failing that, flag the lost baseline in
section 1." Justify it as insurance against a *future* `-s`/`-o` swallow of the response body
(the current mitigation is incidental, resting on curl echoing it), never as a fix for an
observed drop. Marginal value is small because the pulse-start readback already surfaces a
missing anchor — land only if it costs no prompt bloat.

### A.3 — `handoff` #1, #3, #10, #14 → all CONFIRMED-BUT-MITIGATED; the template is dead-lettered

The decisive evidence is the artifact series, not the prompt. The `/handoff` template mandates
four fixed headings (`## Status / ## Next Steps / ## Key Decisions / ## Context to Restore`).
The git history shows this skeleton was followed until **2026-07-21 12:40** (last at `9a619c7`)
and then **permanently outgrown** — every `HANDOFF.md` from `2d6d9ca` onward is hand-authored
with a richer, session-calibrated shape. Each stage-1 axiom gap is therefore real in the
*text* but already worked around in *practice*:

- **#1 (A4/A5 done-criterion) — with a sharp correction.** The template has no done-criterion
  (confirmed). But stage-1's *specific* criterion — "a fresh session reading ONLY this file
  could resume without re-deriving" — is **refuted** by the artifacts, which deliberately make
  the handoff a *non-authoritative pointer* (`HANDOFF.md@0642fde:8`: "## Start here (primary
  sources — read, don't accept this handoff in their place)"; `@0642fde:3`: "Treat every claim
  … as a claim to verify … deterministic evidence beats this document"). The author's real
  done-criterion is **pointer-quality, not self-sufficiency.** *Revised:* "Done = a fresh
  session, using this as a MAP into the primary sources, rebuilds the correct model — every
  claim independently verifiable, nothing load-bearing existing ONLY in this file." Explicitly
  reject the self-sufficiency framing.
- **#3 (A2 dead-ends).** The template's `## Key Decisions` omits abandoned paths (gap real).
  But 7 recent versions carry `## Load-bearing decisions + WHY (do not re-litigate or
  undermine)` and record "deliberately not built / deferred / scope cuts" entries
  (`@941c794`: "No staleness fast-forward (deliberately not built)…"). *Revised:* codify the
  author's fused pattern — "Decisions + WHY, including what was deliberately NOT done / deferred
  and the reasoning" — not a standalone "Dead Ends" heading (a weaker match to real practice).
- **#10 (A1 ground-truth).** Template writes from memory (gap real). The one captured
  invocation ran `git log/status/branch` before writing (`handoff.txt` inv #1: "Let me verify
  the exact commit history from this session before writing the handoff"), and every recent
  output bakes in "confirm with git log". *Revised:* bake the observed behavior in as a first
  step — useful **only for weaker executors**; the current author already does it.
- **#14 (A7 calibration).** Fixed four-heading skeleton is uniform-weight (gap real). Recent
  handoffs invent priority-ordered session-specific headings (`@2d6d9ca`: "## OPEN PUZZLE — the
  steward routes are NOT being served"; `@941c794`: "## THE open decision — resolve this
  first"). *Revised:* "Lead by naming what THIS successor most needs first; choose and order
  headings for this session — do not force a fixed template."

**Priority caveat on the whole handoff cluster:** `/catchup`, handoff's consumer, was invoked
**0 times** in the corpus — downstream impact of handoff quality is unmeasured — and the strong
author already ignores the template. The real beneficiary of every handoff rewrite is a
*weaker/fresh* executor, which the corpus does not contain. Low marginal value; see also new
pattern P4 (the template should be rewritten to *match* observed practice regardless).

### A.4 — `catchup` #4 (A5 reconcile-HANDOFF) → CONFIRMED-BUT-MITIGATED, DEFER

The predicted failure (blindly trusting a stale HANDOFF) did **not** occur. In the sole real
invocation the executor reconciled and flagged drift *unprompted*
(`7bc95062…:22`: "**Heads up: it's dated 2026-06-21, 5 days stale.** … treat the HANDOFF as a
claim to verify, not current truth"), and it cited its **own standing global CLAUDE.md rule**
as the driver, not the catchup prompt (`…:37`: "per my own rules I'll verify against the repo
rather than trust it"). The mitigation lives in an always-on layer. *Disposition:* DEFER —
keep only as a one-line belt-and-suspenders **if** catchup is ever run on a weak executor that
lacks the standing rule.

### A.5 — `lane-brief` #7 (A5 flake affordance) → CONFIRMED-BUT-MITIGATED, DEFER

The template's DONE example gates on `./e2e-isolated.sh … ALL PASS` with no flake affordance
(gap real in text, `lane-brief-template.md:31`). But of the 6 lanes that hit the *exact*
port-8791 collision, **every one diagnosed it as environmental and self-recovered** — none
looped, none chased it as a code bug:
> "The connection-refused is a port collision from my overlapping runs, not the code." *(a0c2af58)*
> "ConnectionRefused on port 8791 — leftover state from running the suite back-to-back, not a test assertion." *(7903ad2a)*

One lane surfaced the warning by reading `CLAUDE.md:17` directly — the affordance stage-1 wants
in the brief **already exists one layer down**, copied into every worktree. And the predicted
failure has no executor: the model census across all lane transcripts is 3589 Opus-4-8 / 702
Fable-5 / 692 Sonnet-5 — **zero Haiku.** *Disposition:* DEFER; reconsider only if a Haiku-class
lane is ever introduced (and then embedding the one line, per A9, beats a new DONE slot).

### A.6 — `steward` #13 (A1 cwd/branch step-0) → CONFIRMED-BUT-MITIGATED; a sharper fix surfaced

Both `/steward` runs **front-load** the cwd/branch/currency check before any `Read`, despite
the prompt placing it in trailing Constraints (`1e34fd51` entry 7 and `4d5f5625` entry 4 both
open with `pwd && git … status`). A1's premise ("checks trail the read-steps") does not manifest
— the reorder is harmless and low-value. **The trace exposes a different, sharper defect the
reorder would not fix:** run 1's currency check compared *unfetched* `origin/main`, read
"0 behind", and **under-read a shelf doc** — self-corrected only mid-session
(`1e34fd51`: "I'm actually **14 commits behind main, 1 ahead** — my session-start read was
stale … `docs/orchestrator-autonomy.md` … is on main and I haven't read it"). Run 2 compared
*local* `main` + merge-base and got it right. *Disposition:* DEFER the reorder; if touching
this step, make the **currency-spec fix** — compare against local `main` + merge-base, not
unfetched `origin/main`. This is the real observed under-read cause, outside A1's original
framing.

---

## Part B — Refuted and no-evidence (the honesty-gate outputs)

These are the good, load-bearing results: stage-1 over-called, or the path was never exercised.

- **`steward` #5 (A4 boot-readiness recital gate) — REFUTED, DROP.** The steward never recited
  gate+axes at boot, yet held a complete, correct two-axes model on demand
  (`1e34fd51`: "sie zerfällt in zwei Achsen … Achse 1 — Auslösen … Achse 2 — was foreman
  *darf*"). The internal model existed *without* a recital, so reciting-as-gate improves nothing
  and the one real under-read (§A.6) is a currency defect a recital cannot catch.
- **`steward` #9 (A6 boot emit contract) — REFUTED, DROP.** No essay dump ever occurred. Run 1
  emitted one thin line ("Not behind main … Reading the shelf."); run 2 emitted *mandated*
  step-3 rot-fix work, not a read-recap. The existing `steward.md:8` Voice binding
  ("maximally concise — answer first … chat rhythm over essay") already forbids dumps and is
  visibly obeyed. A boot-specific contract is redundant prompt mass.
- **`lane-brief` #12 (A9 inline CLAUDE.md rules) — REFUTED, DROP.** A lane mined the single
  relevant `CLAUDE.md:17` out of the full file unaided; lanes read referenced files on demand
  when a symptom surfaces. With all executors strong-and-familiar and CLAUDE.md copied into
  each worktree, A9 itself prescribes a *reference* here — inlining would add curation cost
  against the template's own "~40 lines / curation is the point" constraint for no benefit.
- **`rundgang` #16 (A7 direct $ARGUMENTS) — NO-EVIDENCE, DEFER.** The arg slot was populated in
  **0 of 11** pulses; every pulse ran a bare full-sweep `/rundgang`. There is no behavior to
  confirm or refute the "arg misread as WHAT-to-emit" concern against. Re-evaluate once a real
  args-bearing pulse exists.
- **`catchup` #6 (A3 curate-the-read) — NO-EVIDENCE, DEFER.** The sole real `/catchup` ran in a
  non-git home dir where `git diff --name-only main` returns nothing
  (`7bc95062…:15`: "fatal: not a git repository"), so the bulk-read path (lockfiles/`public/*.js`/
  `dist/`) never fired. No over-read on record. Do not add on speculation.

---

## Part C — New patterns the prompts don't cover (what stage-1 structurally could not see)

Ranked by leverage. Each is invisible to a prompt-axiom audit because the fix is in a
shell script, a doc convention, or server code — not a prompt. Every claim carries ≥2
independent verified quotes.

### P1 — `e2e-isolated.sh` hardcodes socket/port; concurrent lanes collide and hand-clean every time  *(target: the library — the e2e scripts)*

The single highest-leverage finding. `e2e-isolated.sh` (and `e2e-claude-gate.sh`) hardcode
socket `fleettest` / port `8791` and `kill-server` on start → not concurrency-safe. Six lanes
hit the collision (`ConnectionRefused` / `Killed:9`) and each ran the same manual
stop-clean-rerun cycle:
> "The connection-refused is a port collision from my overlapping runs, not the code. Let me stop the background run, clean up, and run once cleanly" *(a0c2af58)*
> "leftover state from running the suite back-to-back, not a test assertion. Let me clean up and run once cleanly." *(7903ad2a)*

`CLAUDE.md:17` documents a *workaround* ("copy the script to scratch with a unique SOCK/PORT/DIR")
— which is prose every lane must re-implement. **Proposal (root-cause, per OWNER §2):** derive
`SOCK`/`PORT`/`DIR` inside the script from a per-invocation unique token (e.g. `$$` or the
worktree basename), so every lane gets its own socket/port and no run can kill another's server.
Deletes the recurring manual cycle *and* the CLAUDE.md prose. *(This is the empirical
counterpart to lane-brief #7/#12: the collision is best fixed at the script root, not named in
the brief or CLAUDE.md.)*

### P2 — `server.ts:NNN` line refs in docs drift on nearly every lane; ~15 docs already carry a "distrust these" disclaimer  *(target: a docs/library convention + one CLAUDE.md line)*

The `/steward` load ritual itself found "significant line-reference rot" and had to re-grep
current line numbers (`4d5f5625` load). The docs already tell readers the numbers are wrong:
> `operating-model.md:8`: "the `server.ts:NNN` line is a convenience that **drifts on every insertion**"
> `deep-assessment-2026-07-22.md:100`: "Behavior claims all verified true; **line refs drifted en masse**"
> `steward-arena.md:19`: "canDeliver lane each **re-drifted the line numbers** — treat them as **grep-verify-before-relying**"

The line numbers now carry *negative* value — known-wrong maintenance debt that the existing
CLAUDE.md "Wissenspflege" keep-in-sync rule cannot hold (it rots anyway across lanes).
**Proposal:** adopt a convention — docs anchor to **symbol names / grep patterns** (`function
slotCmd`, the `/api/steward/journal` route), never `server.ts:NNN`. Stop emitting the
drift-prone artifact rather than trying to keep it synced.

### P3 — `GET /api/steward/digest` runs the sensing worker synchronously; every pulse took 23–29 s and the first blew a 10 s timeout  *(target: the library — server.ts digest route)*

Every observed rundgang pulse paid a synchronous sensing cost; the steward permanently baked a
longer timeout into subsequent pulses as a workaround:
> "Timeout (10s) — der `digest`-Endpoint spawnt vermutlich synchron den Sensing-Worker … HTTP 200 in **22.988775s**" *(Inv #9)*
> "`GET /api/steward/digest` brauchte **23s** (erster Versuch mit 10s-Timeout starb) … falls der Puls je in eine Auto mit knappem Timeout wandert, wäre ein async-Muster … robuster." *(Inv #9 close-out)*

A latent reliability trap: the `-m 45` workaround is re-applied every pulse and **breaks
silently the moment the pulse becomes a timeout-bounded auto.** **Proposal (owner-decides
priority):** make the digest async — the sensing worker fills a cache on its own cadence, GET
returns the last snapshot instantly. Not blocking today (self-mitigated), but the fragility is
structural.

### P4 — The `/handoff` template induces the wrong model and is overridden every session  *(target: the `/handoff` prompt — overlaps Part A.3; flagged thin)*

All 24 committed `HANDOFF.md` files diverge from the template's four fixed headings toward a
richer, converged shape (verify-claims preamble, "read in this order" pointers, ordered owner
step-list, "lessons / gotchas"). **Proposal:** rewrite `/handoff` to *induce the shape the
corpus converges on* rather than the abandoned skeleton. **Thin/overlap caveat:** only 1
`/handoff` invocation is captured — divergence is inferred from the committed artifacts, not
from watching the template lose in a live run — and this targets a *prompt*, so Part A.3's
revised wordings already cover the substance. Surface-only; owner decides whether to fold P4
into the A.3 rewrites.

---

## Coverage boundary (where no trace was found — the explicit limit)

- **`/catchup` was invoked exactly once** in the entire captured corpus, in a non-git
  `~` home dir — **zero real fleet-dir invocations.** All three catchup rewrites
  (#4, #6, #15) are therefore under-exercised; #15 stands on the file text, #4 and #6 lack a
  behavioral trace. An essentially unused prompt is low-priority by construction.
- **`$ARGUMENTS` for `/rundgang`: 0 of 11 pulses** passed an argument — the arg path (#16) is
  entirely untraced.
- **No Haiku-class lane exists** (census: Opus-4-8 / Fable-5 / Sonnet-5 only). Every stage-1
  rewrite premised on a *weak executor* failing (lane-brief #7/#12; and the "weak-executor
  beneficiary" caveat on all handoff + catchup edits) has **no executor in the corpus** — its
  predicted failure is structurally unreachable here, hence no-evidence for that failure mode.
- **`/sharpen` (stage-1 #2, #11) was not trace-mined** — out of scope by the brief's blind-spot
  guard: `prompts.jsonl` owner-prompts were already mined by the sharpen-corpus
  (`~/.claude/knowledge/sharpen-corpus/model.md`, 205 situations), whose GUARD forbids
  re-treading it. Trace-grounding sharpen belongs to a pass that reads sharpen *outputs*
  against a hold-out set, not a re-mine.
- **Only 1 real `/handoff` and 2 real `/steward` invocations** were captured; the handoff
  verdicts lean on the ~20-version `HANDOFF.md` git history (the actual output record) rather
  than invocation transcripts.
- **Not evaluated:** whether any revised proposal actually improves outcomes (no eval set yet —
  stage-1 Part B B.3 #1 remains the missing guard); non-prompt multipliers beyond P1–P3;
  `/foreman`, `/dispatch`, `/weave`, the `runStewardDigest` server prompt.

---

*Next, if promoted: (1) apply `catchup` #15 (zero-risk) and the P1 socket fix + P2 line-ref
convention (highest leverage, both outside the prompt layer); (2) treat every "confirmed-but-
already-mitigated" prompt edit as **optional weak-executor insurance**, framed as such — do not
ship them as bug fixes; (3) the honest headline for the learning engine: at prompt scale with
strong executors, **the prompts are not the bottleneck — the infrastructure and doc-maintenance
patterns are.** Build the eval set (B.3 #1) before promoting any prompt edit, so the next pass
can measure improvement instead of asserting it.*
