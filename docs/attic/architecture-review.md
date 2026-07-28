# Architecture review — 2026-07-25

*A critical, well-intentioned assessment of Fleet as it actually is: what will hurt as it grows,
what is sound and must be protected, what is missing. Judged first against Fleet's own axioms
(`docs/README.md`, `operating-model.md`, `perception-layer.md`, `graduation-criteria.md`,
`judge-calibration.md`), then against general soundness.*

Line numbers are as of this commit and will drift — grep the cited symbol if one no longer
resolves. Every finding is marked **VERIFIED** (I read the code that makes the claim true) or
**INFERRED** (I read the parts and composed the consequence without observing it happen).

---

## 0. Coverage — what I read, and what I did not

**Read closely (server.ts):** the constants/state model and `slotCmd`/`MODEL_RE` (1–230), the
event-log and state-write chains (316–431), the git helpers, session/lane scoping and
`briefPayload`/`diffPayload` (432–683), `tickGit`/`measureOutcomes`/`measureControls` (685–839),
the worktree + land spine `createWorktree`→`landLane`→`advanceIntegration`/`resetIntegration`
(841–1021), `openSlot`/`killSlot`/`ensureSlot`/`sendText` (1031–1241), `canDeliver`/`tickAutos`/
`tickDispatch` (1243–1526), the transcript layer + harvester + `summaryViaSession` (1589–1972),
③ + auto-③ (2028–2290), the merge/verify/②/repair machinery and `mergeJob` (2442–3294), the
outcome recorder + `OutcomeReview`/`LandFacts` + disposition rail (2602–3003), auth/guard/routes
(3296–3441), boot/restore (3443–3677), the steward principal + fact layer (3679–4086), the steward
routes and the whole `Bun.serve` route table (4185–5588). `lane-signals.ts` in full. `watchdog.sh`
in full. **src/client.ts:** the outcome feed + disposition rail (2790–3120), the poll/render loop
(2400–2520), module head (1–60); the rest by targeted grep only.

**Not examined:** `src/share.ts` (797 lines, guest bundle), `merge-prompt.ts`,
`enhance-prompt.ts`, `public/index.html`, the e2e harnesses (`fleet-e2e*.ts`, `e2e-*.sh`) — a
sibling lane is rewriting them, so per this lane's brief I read none of them and ran no suite.
Consequences: I make **no claim about test coverage** of anything below, and the client findings
are narrower than the server ones. `docs/` read: README, operating-model, perception-layer,
graduation-criteria, judge-calibration, steward. Not read: the other ~24 docs.

---

## 1. Should these abstractions exist at all — subsystem verdicts

Before implementation quality, per the standing rule. "Size" = is this the right amount of thing.

| Subsystem | Should it exist? | At this size? |
|---|---|---|
| **tmux as process substrate** (slots, adoption, self-heal, `--resume`) | **Yes — load-bearing and right.** A durable conversation needs a durable place; tmux gives crash survival, out-of-band inspection, and adoption for free. No cheaper primitive does this. | Yes. |
| **tmux as *worker* substrate** (`summaryViaSession`: throwaway pane + paste-buffer + transcript polling) | **Yes, but for a billing reason, not a design one** (1813–1821: interactive session = subscription, `claude -p` = metered API). That is a legitimate constraint — but it means six features rest on a scraped TUI and a private JSONL format. | **No — under-abstracted.** It is a bare function with six callers and no health signal. See F4/F10 and §5. |
| **The land/merge gate** (`landLane`, `advanceIntegration`, `mergeJob`, verify, ②) | **Yes, emphatically.** The one place risk is allowed to concentrate, and the design (git is the authority, agent narrative is never it, remove-before-kill, record-before-teardown) is the best thing in the codebase. | Yes. |
| **Three-token model** (owner / steward-scoped / lane self-token) | **Yes.** Principal → binding → capability, with out-of-scope credentials 403'd before the owner gate (4390–4419). Genuinely good. | Yes, minus one rotation gap (F7). |
| **fleet.json (mutable) + append-only jsonl trails** | **Yes — the split is correct.** Snapshot state and evidence have different truth conditions and belong in different stores. | **No.** One file now carries credentials, 200 tasks × 20 KB, share threads, and high-churn measurement state, rewritten whole and synchronously (F6); the trails' rotation destroys evidence (F3). |
| **Judges ②/③ as advisory, downgrade-only, fail-closed** | **Yes.** "Advisory never gates; a brake may only ever remove autonomy" is the right invariant and it is honoured in code (`CLEAN_REVIEW_MODE` at 2477, `runCleanReview` fail-closed at 3098–3135, auto-③ wired to nothing). | Yes. |
| **The perception/fact layer** (`deployGap`, `bundleStale`, `laneFacts`, `sinceLastLookView`, `lane-signals.ts`) | **Yes.** These are the cheapest correct answers to "can the system see itself", and `unknown → null` is applied with real discipline. | Yes — but half of it has no reader on the surface that needs it (F2). |
| **The steward principal + routes** | **Yes**, as the second instance of the token→principal→binding shape rather than a new mechanism. | Borderline: 13 routes, a journal, a digest worker, an outcome ladder and a nudge template engine now hang off a *label match* (`STEWARD_LABEL`, 4 branch sites). |
| **Promotion ladder fuel** (`outcomePending`/`outcomeTally`/`harmCandidates`/`promotionEligible`) | **Not yet.** Built, persisted, boot-migrated, exposed — and consumed by nothing (F11). This is the clearest "judging layer without its feeder" inversion: here the feeder exists and the *judge* does not. | No. |
| **server.ts as one file (5598)** | The *process* boundary is right. The *file* boundary is now wrong (§5). | No. |
| **src/client.ts as one file (3687), vanilla, no framework** | **Yes to vanilla** — a terminal dashboard is the wrong shape for a component framework, and the no-`innerHTML`-with-data discipline (2514, 3169) is worth more than ergonomics. | No — it breaks first (F12). |

---

## 2. Findings, ranked by cost

### F1 — The land gate's deterministic authority is a file the lane under review may edit, and its repo-guard turns a *moved file* into a green skip
**VERIFIED (mechanism)** / **INFERRED (occurrence — not observed)**.
`runVerify` runs `sh -c FLEET_VERIFY_CMD` with `cwd` = **the lane worktree** (server.ts:2492–2506)
and reports `ok: !timedOut && code === 0`. Production's command (watchdog.sh:49) is
`[ -f fleet-e2e.ts ] || { echo "verify skipped: not the fleet repo"; exit 0; }; … && ./e2e-claude-gate.sh`.
Both `fleet-e2e.ts` and `e2e-claude-gate.sh` are tracked files *in the lane's own tree*. So:

- A lane that renames, moves, or deletes `fleet-e2e.ts` makes its own gate exit 0 having verified
  nothing. `verify.ok` becomes `true`, `mergeJob`'s clean path (3234–3251) auto-lands, and
  `LandFacts.verified: true` is written to the outcome ledger (2816). The skip *reason* exists only
  in `verify.out` (the merge verdict text and the git note) — the ledger records a boolean, so the
  row cannot distinguish "gate passed" from "gate declined to run". This is discrepancy-audit F9
  inverted: F9 was `verified:false` when the gate could not run; this is `verified:true` when it
  chose not to.
- A lane that weakens `e2e-claude-gate.sh` is verified green *by its own weakened gate*.

**Cost:** the only unattended land path's only machine authority is derived from the artifact it
authorizes; a green `verified` can mean "unmeasured". Every downstream number built on it —
graduation criterion 1 ("recorded after the F9 fix is deployed, so `verified` is honest"), the
outcome feed's `verify green` chip (client.ts:3044) — inherits the defect silently. This is live
today: a sibling lane is restructuring `fleet-e2e.ts` right now.
**Direction:** run the gate from the *integration branch's* copy against the rebased tree (or
hash-pin the harness), and make the verify verdict a tri-state — `pass` / `fail` / `did-not-run` —
so "skipped" is unrepresentable as green.

### F2 — Deploy is the working tree, not a commit; the deploy-gap fact cannot see that
**VERIFIED.** The watchdog respawns `srv` with `cd '$FLEET_DIR' && … bun server.ts` every 5 s
whenever the session is absent (watchdog.sh:55–57), from the **main checkout's working tree**. So
the deployed unit is "whatever is on disk at restart", including uncommitted edits.
`deployGap()` compares `BOOT_HEAD` to `rev-parse HEAD` only (server.ts:3927–3945) and never reads
`status --porcelain`; with an uncommitted server.ts edit live, it reports `behindCount: 0,
codeBehind: false` — i.e. **"deployed and current" while running code that exists in no commit.**
That is an `unknown reads as healthy` violation inside the very mechanism built because "landing is
not deploying" bit the project four times in two days.

Compounding: `deployGap` and `bundleStale` are returned **only** on `/api/steward/sessions` and
`/api/steward/digest` (4188, 4223–4226). `grep -n "deployGap\|bundleStale" src/client.ts` → no
matches. The owner's dashboard — the surface actually open during a deploy — renders neither.
**Cost:** the incident class these facts were built for recurs whenever no steward pulse is
running, and a dirty-tree deploy is invisible to both surfaces.
**Direction:** add `dirty` to `DeployGap` (one `status --porcelain`; unknown → `null`), and put both
facts on the owner board's header, not only the steward's.

### F3 — Rotation destroys the evidence the graduation criteria are computed from, and only two of five readers survive a rotation
**VERIFIED.** `appendEvent` rotates any file it writes at `AUDIT_ROTATE_BYTES` (5 MB default) by
`renameSync(file, file + ".1")` (server.ts:379–393) — single generation, older `.1` overwritten.
It writes `audit.jsonl`, `lane-outcomes.jsonl`, `dispositions.jsonl`, `steward-journal.jsonl`
(28–35). Two readers deliberately span both generations: `stewardRecentSends` (278–297, because the
send caps are a safety invariant) and `readStewardJournal` (3821–3831). Three do **not**:
`/api/lane-outcomes` (4720–4734), `/api/audit` (4702–4716), `readDispositions` (2964–2977) — each
reads the current file only.

The two files that read one generation are exactly the two the criteria depend on:
`graduation-criteria.md` §1 measures review coverage "by the outcome feed, not asserted", and its
labels "come from the owner disposition rail". Worse, the client's K1 counter is anchored on a
*specific row* (`K1_ANCHOR_BRANCH = "f9-verify-deps"`, client.ts, grep `K1_ANCHOR_BRANCH`); when
that row falls off, `kProgress` returns `anchored:false` and the panel counts nothing for §1 (K2
survives the rotation — since 2026-07-25 it is counted independently of the anchor).
**Cost:** at rotation, owner-recorded evidence silently becomes never-happened — a disposition
whose row rotated away renders as `unlabeled`, which the renderer *correctly* treats as missing
evidence, so the reading is wrong in the safe-looking direction. Rows are large (findings are
inlined: up to 5 × ~2 KB), so 5 MB ≈ low thousands of rows — reachable in months at 10× volume,
not years.
**Direction:** evidence trails must not rotate destructively (rotate to `.N`, or don't rotate);
readers that feed criteria must read every generation, like `stewardRecentSends` already does.

### F4 — The worker substrate has no health signal, so a broken judge is indistinguishable from an untested one
**VERIFIED (code + in-repo record)** / **INFERRED (consequence).**
Every judge and worker — ③, ②, the merge resolver, the repair loop, the commit-message writer, the
enhancer, the digest — runs through `summaryViaSession` (1885–1944): spawn a tmux pane, wait for a
`claude` child, `Bun.sleep(2500)`, paste, `Bun.sleep(400)`, Enter, then poll the transcript JSONL
every 2 s until the newest assistant text `includes(doneMark)`. The contract is therefore: a TUI
that accepts pasted text after a fixed sleep, a private transcript schema (`viewEntry`, 1664–1703),
and a substring done-mark. Every consumer fails *soft* on a miss — `raw: true`, findings empty,
`verdict: null` (2227–2236, 3142–3151).

That soft-failure is right, and it is also the blindness: `judge-calibration.md` records
"**Production state: 2/2 verdicts `raw: true`** — the real model misses the JSON contract", and
server.ts:3139–3141 confirms it in code ("both production shadow verdicts so far were `raw: true`
and undiagnosable from the journal without it"). Graduation criterion 2 needs N ≥ 25 verdicts with
`verdict !== null`; a substrate that never parses produces a counter that stays at 0 forever.
(2026-07-25 correction, and the argument's best evidence: the cause was the PARSER, not the
model — `runCleanReview` gave up on a valid verdict object wrapped in a prose preamble. Six of
the first seven shadow rows were `raw: true`, and the diagnosis only became visible once one
failing answer was persisted. `judge-calibration.md` carries the corrected reading.)
**Cost:** "the judge has not run enough times yet" and "the judge's harness is broken" are the same
observation from the criteria's point of view, and nothing raises the second. The same silence
covers a future Claude Code change to paste behaviour or transcript layout: all six workers degrade
to raw/timeout at once, and the only symptom is numbers that stop moving.
**Direction:** one counter per worker kind — runs, raws, timeouts — exposed next to the tallies. A
raw *rate* is the health signal; the per-row `raw` flag is not.

### F5 — `prompts.jsonl` is unbounded and read whole on every lane terminal event
**VERIFIED.** The prompt log is "never capped, never rotated" by design (326–329). `laneOwnerPrompts`
reads the entire file and `JSON.parse`s every line to count one lane's owner prompts (2715–2735),
and it is called from `buildLaneOutcome` (2798) — i.e. on **every** land, kill and shelve.
`/api/prompts` does the same per request (4684–4697).
**Cost:** land latency grows monotonically with the lifetime prompt history, in a path that holds
the worktree open before teardown. At 100 MB the land path allocates and parses 100 MB; there is no
back-pressure and no eviction, and the growth is fastest exactly when the fleet is busiest.
**Direction:** the count is derivable incrementally (a per-cwd counter maintained in `logPrompt`) or
from a bounded tail; either removes an O(history) read from the land path.

### F6 — fleet.json has no single-writer enforcement, and a whole-state synchronous rewrite on a 100 ms event loop
**VERIFIED.** `STATE_FILE` (27) is guarded by tmp+rename against torn writes (411–430) — good — but
there is no lock, pid file, or socket/port identity check anywhere (`grep -n "\.lock\|process.pid"`
→ only git's `index.lock` retry). "Two servers on one dir" is prevented by prose in CLAUDE.md and
by nothing in the code, and that is the class of the project's worst historical incident
("sessions vanished").

Two further consequences of one file holding everything:
- `saveState` does a synchronous `JSON.stringify(…, null, 2)` of the whole state — credentials,
  `tasks` (up to 200 × `MAX_TASK_TEXT` 20 000 = ~4 MB, 202/212), `shareComments` (300 × 2 000 per
  share, 103–105), `merges`, `outcomePending` (≤200) — on the same event loop that runs `poll()`
  every 100 ms (3665). It is called from nearly every mutation, including per-tick auto fires.
  **Cost:** with a full queue, stringify time lands directly in pane-stream latency; the pretty-print
  doubles it for no reader's benefit.
- **INFERRED:** an unreadable fleet.json is preserved to `.bak` and the server starts "with empty
  state" (3591–3596). That empty state is *healthy-looking*: `persistedToken` is re-minted (a new
  owner token), and the adoption loop re-adopts stray `s<N>` panes with `cwd` set but
  `worktree: null` (3625–3631) — every live lane becomes an untagged plain session. `land` then
  refuses ("not a fleet-created worktree lane"), kills record no outcome, and
  `tickDispatch`'s lane budget (`slots.filter(s => s.worktree).length`, 1462) reads **0** while 16
  real lanes run. Unknown reading as zero, with dispatch as the amplifier.
**Direction:** an O_EXCL lock keyed on `SOCK`+`PORT` at boot; split the credential/config half from
the high-churn measurement half; drop the `null, 2`.

### F7 — The steward credential outlives its binding; the self-token does not
**VERIFIED.** `selfToken` is explicitly rotated on every (re)activation — "a recycled slot must not
honor whatever session used to hold it" (1147–1148). `stewardToken` is minted once
(`if (!stewardToken)`, 3612), persisted (417), exported into any pane whose label matches at spawn
time (1090–1091), and **never rotated or invalidated** — no other site touches it. Env is only
injectable at spawn, so relabelling does not revoke the old pane's copy.
**Cost:** a pane that *was* the steward keeps a live steward credential forever, across restarts,
and `stewardSlot()` resolves live — so the stale holder's `/api/steward/send`, `/tasks`, `/autos`
now act on whichever pane is steward *now*. It also consumes that principal's hourly send budget
and pending-task cap. This is `operating-model.md` invariant 3 ("no reference survives the thing it
points to") holding for two of three principals.
**Direction:** rotate `stewardToken` whenever the label moves (same one-liner as `openSlot`'s
`selfToken` rotation), and re-export on the next spawn.

### F8 — Agent-authored text is relayed verbatim into another session's prompt line
**VERIFIED.** `renderStewardMessage`'s design claim is that the caller supplies only `kind` + `ref`
and the server renders the text, which makes mislabeling "structurally impossible" (3684–3689). For
two of its refs that holds. For `state_relay`, the message is
`` `[steward] Status: ${m.detail}` `` (3714, 3718) — and `m.detail` for `status:"blocked"` is the
**merge agent's own JSON `detail` field** (`mergeJob` 3164 ← `runMerge` 3055, `slice(0, 600)`), and
for `"error"` it is a server sentence with the agent's text embedded (3175). `handleStewardSend`
takes `body.slot` and targets **any active slot** (3735), gated by `canDeliver` but with no
sanitisation of the relayed text.
**Cost:** untrusted worker output crosses a session boundary into another session's input, prefixed
by an authoritative-looking `[steward] Status:`. A misled resolver's 600 characters become an
instruction-adjacent message in a pane of the sender's choosing. The claim "the caller never
supplies text" is true; "the text is server-authored" is not.
**Direction:** relay a *fact reference* (status + conflicted file names + verdict), never the
agent's prose; or delimit it as untrusted data the way `runMerge`'s own prompt already delimits
main's log.

### F9 — An in-code invariant about background transcripts is stated and violated
**VERIFIED.** `BACKGROUND_MARKS` exists so a stray worker transcript is never served as a slot's
own conversation, and the comment states the rule: "*A mark missing here means that transcript can
be served as the adopted slot's own conversation — keep this list in step with every prompt run via
`summaryViaSession`*" (1596–1603). The list has **two** entries (summarizer, ③). Prompts that also
run through `summaryViaSession` in a slot's cwd, unmarked: `agentCommitMessage` (2317), `runEnhance`
(2418), `runMerge` (3029) and `runRepair` (3067), `runCleanReview` (3104), `runStewardDigest` (4129)
— five kinds. The `finally` that deletes the transcript (1936–1943) is process memory, so a
deploy/crash mid-run strands the file, and `transcriptFile`'s newest-by-mtime fallback (1627–1643)
applies to exactly the slots a deploy creates: adopted panes with `sessionId: null`.
**Cost:** after an interrupted merge/②/digest run, the chat view, the steward's transcript route and
the ✨ summarizer's own input (`transcriptTail`, 1842) can present a *worker's* conversation as the
lane's work — false input to the humans and agents doing the steering. (The harvester is pinned-only,
so `prompts.jsonl` is not polluted.) Note the shape: three separate guards
(`summarizerSids`, `sniffSummarizer`, the `rm`) all exist because workers share the slot's project
dir. One root cause, three mitigations, one of them incomplete.
**Direction:** give workers their own cwd/project dir — then all three guards can go.

### F10 — No fleet-wide budget on worker spawns
**VERIFIED.** auto-③ caps itself at `AUTO_REVIEW_MAX_CONCURRENT = 2` and says why:
"`summaryViaSession` has no limit of its own" (2255–2259). Everything else has only *per-slot*
single-flight — `summaryInflight`, `reviewInflight`, `mergeInflight`, `commitInflight`,
`digestInflight` are all keyed per slot (or one global for the digest). Sixteen slots × summary +
review + commit-msg + merge, plus enhancer and digest, are all admissible at once, and each is a
full interactive `claude` process.
**Cost:** memory/CPU exhaustion is reachable from ordinary owner clicking, and the first casualty is
the 100 ms `poll()` loop that every pane's liveness depends on — i.e. the failure looks like "the
dashboard died", not "too many workers".
**Direction:** one semaphore inside the worker boundary (see §4), counted and exposed.

### F11 — A fully built, fully persisted promotion ladder with no consumer
**VERIFIED.** `outcomePending`/`outcomeTally`/`harmCandidates`/`harmAttestAt` are measured
(`measureOutcomes`, 773–810), persisted (420), boot-validated and migrated across two schema
generations (3549–3590, ~40 lines), served with an eligibility verdict (4295–4314) — and
`promotionEligible` (2927) is read by nothing that acts. The code says so: "The ladder wiring itself
is future — only the fuel + predicate ship" (266–268); `graduation-criteria.md` §4 records the
machinery as "currently unfed".
**Cost:** carrying cost, paid every time the state schema changes, for a number nobody consumes —
plus the subtler cost that the first real consumer will inherit counters accumulated under
definitions that have since moved (`OUTCOME_SUSTAIN_MS`, the `helped` under-count, the `dismissed`
migration) with no version stamp on the tally.
**Direction:** either wire the smallest real consumer, or stop persisting the tally and re-derive it
when one exists. A third state — persisted but versioned — is the honest middle.

### F12 — Of the two monoliths, the client breaks first, on contributor count
**VERIFIED (structure)** / **INFERRED (ordering).**
`src/client.ts` binds ~40 module-level singletons to fixed DOM ids through
`const $ = (id) => document.getElementById(id)!` (client.ts:8) at *module load* — e.g.
`const outcomes = $("outcomes"), outcomepanel = $("outcomepanel")` (2823). A missing or renamed id
in `public/index.html` returns `null`, and the first property access throws during module
evaluation: the **whole dashboard is blank**, with no partial degradation and no per-overlay
isolation. The coupling is three-way (index.html ids ↔ client.ts bindings ↔ CSS classes) and
invisible to `tsc`. Fifteen-plus overlays share one flat module scope and one `refresh()` whose
re-render key is a hand-maintained `JSON.stringify` of the fields that matter (2467–2470) — a new
field that should trigger a re-render is a silent omission, not an error.
server.ts is longer but ages better: it is choke-pointed (`canDeliver`, `createAutoForSlot`,
`startReview`, `appendEvent`), so most new features attach at a named seam.
**Cost:** the client is where a second contributor first breaks something globally with a local
edit, and where the failure mode is total rather than graceful.
**Direction:** a tiny `bind(id)` that throws with the id name at load, plus splitting the overlays
into modules with their own `init()` — the panel-per-file boundary the file already implies.

---

## 3. Uncosted observations (no cost articulated — do not act on these alone)

- `undoLast` keeps one record per repo (`Map` at 2549); a second land silently makes the first
  un-undoable. Documented as one-step, but nothing tells the owner the window closed.
- `measureControls` parks `aheadBaseline: gitInfo.get(s.id)?.ahead ?? 0` (838). It runs at the end
  of `tickGit`, after every active slot's `gitInfo` is written, so the `?? 0` looks unreachable —
  but it is a zero-for-unknown in a calibration path, one refactor away from mattering.
- Two slots may carry `⚙ steward`; `stewardSlot()` takes the first (298–300). Both panes get the
  credential at spawn.
- `STATIC` assets are served before the owner `tokenGate` (4570–4577). Correct today (the bundles
  hold no secrets) and worth keeping deliberate rather than incidental.
- The digest's `wait` race (4209–4213) can serve a cache-cold `null` snapshot; the caller sees
  `digest: null` with `digestAge: null`, which is honest but indistinguishable from "worker dead".

## 4. The axioms, answered

1. **"Risk concentrates at the land gate; upstream may loosen."** Mostly true and impressively so —
   `advanceIntegration`/`resetIntegration` are the only writers of `main`, the resolver's tools
   exclude `git branch`/`merge`/`push`, and `canDeliver` is a real choke-point. Two exceptions:
   the gate's own authority is lane-supplied (**F1**), and **deploy is not gated at all** — the
   watchdog promotes the working tree to production on any restart (**F2**). A third, smaller one:
   `state_relay` moves agent text across a session boundary without passing anything (**F8**).
2. **"No judging layer without its feeder."** Held for ③ (auto-③ feeds it) and for the outcome feed
   (built, and it reads). Violated in the opposite direction by the promotion ladder — feeder
   without judge (**F11**) — and hollow for ②, whose feeder produces only failed measurements that
   nothing counts (**F4**).
3. **"Unknown ≠ zero."** The best-executed axiom in the codebase (`lane-signals.ts` in full,
   `DeployGap`, `BundleStale`, `OutcomeReview` as a union, `LandFacts.verified` as a required
   field). Three breaches, all outside the fact layer: a skipped gate reads as green (**F1**), an
   uncommitted deploy reads as current (**F2**), and a rotated-away row reads as never-happened
   (**F3**) — with an empty fleet.json reading as an idle fleet (**F6**).
4. **Boundaries.** Input validation at the HTTP edge is genuinely good (typed choke-points,
   never-spread bodies, `MODEL_RE` before any shell interpolation, timing-safe comparisons, the
   403-before-401 scope distinction). The unguarded boundaries are *internal*: fleet.json's
   single-writer assumption (**F6**), the worker substrate's dependence on an external TUI/JSONL
   contract (**F4**), agent prose crossing into prompts (**F8**), and the client's implicit trust
   that its DOM exists (**F12**). The client's trust in *payload shapes* is, by contrast, exemplary
   — `OutcomeRow` makes every field optional precisely because rows on disk were written by older
   builds (client.ts:2829–2838).
5. **Growth.** Client first (**F12**, contributor count), server second (feature count — 5598 lines
   with the fact layer, judges, git engine and routes in one scope). The state model is the third:
   at 10× ledger volume, rotation eats evidence (**F3**), the land path's prompt-log scan grows
   without bound (**F5**), and fleet.json's whole-state rewrite lands in the poll loop (**F6**).
   Test time I cannot assess — I read no harness this lane.

## 5. The three things I would protect unchanged

1. **`canDeliver` as the single unattended-send choke-point** (1348–1374), together with
   `createAutoForSlot`'s "the caller passes `s`, the body's `slot` is never read". The comment
   explains the drift it exists to prevent; that drift is the expensive kind, and the shape
   (a caller structurally cannot misfire a gate) is worth copying, not touching.
2. **The land spine's ordering and its "believe git, not the agent" rule** — `tryScriptRebase`
   before any model, re-verify `status` + `merge-base --is-ancestor` against the agent's claim
   (3170–3176), `recordLand` *before* teardown, `removeWorktreeSafe` before `killSlot`,
   `--ff-only`/ancestry-gated ref moves. Every clause is a scar. Do not reorder any of it.
3. **Unknown-as-an-answer, unreachable-by-construction** — `OutcomeReview` as a union rather than
   an optional field, `LandFacts.verified` as a *required* `boolean | null`, and `lane-signals.ts`
   composing the digest's prose and the predicate's test from one clause list. This is the
   discipline that makes the rest of the perception layer trustworthy, and it is the thing most
   easily lost to a "small cleanup".

## 6. The single highest-leverage structural change

**Extract the worker substrate behind one boundary: `runWorker({kind, prompt, cwd, doneMark,
tools, timeoutMs})` — its own module, its own project dir, one fleet-wide semaphore, and one
health counter per kind (runs / raws / timeouts).**

Why this one, over splitting server.ts or fixing the ledgers (which are cheaper and should also
happen): it is the seam under six features and it is the only place where a *silent* failure is
currently invisible. The same extraction fixes or subsumes **F4** (health signal, so a broken judge
stops looking like an untested one — and criterion 2 stops being unfalsifiable), **F9** (a dedicated
project dir removes the shared-dir root cause and lets all three of its guards go), and **F10** (one
semaphore instead of six per-slot single-flights), and it is where a future move off the
scraped-TUI transport would land — today that migration would touch seven call sites and their
comment blocks.

**Migration cost:** one new module (~150–200 lines, mostly moved code), seven call sites rewritten
(`runSummary`, `runReview`, `agentCommitMessage`, `runEnhance`, `runMerge`, `runRepair`,
`runCleanReview`, `runStewardDigest`), and the six `FLEET_*_CMD` test stand-in hooks moved behind
the boundary — which is the real work, because each suite's stand-in path must keep behaving
byte-identically. No state-schema change; no route change; the health counters are additive.

**What it would regress:** (a) *comment locality* — the substrate's rationale currently sits inline
next to each caller, and the reason "why interactive, not `claude -p`" (1813–1821) must survive the
move or it will be re-litigated; (b) the e2e stand-in surface, which is the one part of this that
cannot be verified by `tsc` and must be re-proven suite by suite; (c) short-term diff noise across
the merge/land region — the exact region where review attention is scarcest and where F1/F2 also
need work, so these two should not land in the same lane.
