# Discrepancy audit — operative context for the claim-vs-reality hunt

*Operative shelf: this file changes how a session behaves when it loads it. Its job is to make a
discrepancy hunt **provable and bounded** instead of a list of opinions. Seeded 2026-07-25 from a
session that found seven of these by hand — every class below has at least one confirmed instance
with the command that proved it.*

## What this hunts

Not bugs. **Discrepancies between what the project asserts and what is actually true** — in docs,
in schemas, in config sets, in numbers written down as facts. This class is expensive precisely
because it is invisible to every deterministic gate: `tsc` and the e2e suites prove *the code does
not break*. Nothing checks whether the corpus still describes the code, whether a recorded
measurement still means what it meant, or whether a doc's promise can be kept by the artefacts
that exist.

The project's own standing risk applies to this hunt too (`automation-frontiers.md`,
"the theory is ahead of the build"): **a hunt that produces forty observations is a net loss**,
because review capacity — not machine capacity — is the constraint (`operating-model.md`
Invariant 5). Five proven findings beat twenty plausible ones.

## The eight classes, each with a confirmed instance

| | Class | Confirmed instance (2026-07-25) | How it was proven |
|---|---|---|---|
| **D1** | **Stale status** — a doc states a deploy/build state that has since changed | `merge-review-autonomy.md` said the fast-tier land gate was "**NOT yet deployed**, needs `launchctl kickstart`" — it had been deployed since 2026-07-24 17:45 | `ps eww <srv pid>` → live `FLEET_VERIFY_CMD` matched `watchdog.sh:38` char-for-char; watchdog process start > file mtime |
| **D2** | **Citation rot** — a pointer names the wrong doc, section, or symbol | HANDOFF §7.2 *and* `docs/README.md` both cited "`merge-review-autonomy.md` component #6" for the outcome feed; that doc's §6 is "Hard rules". The feed is `lane-autonomy-future.md` item 6 | opened both cited locations and read what is actually there |
| **D3** | **Volatile number recorded as a durable fact** | `BACKLOG.md` Track A records "a working, un-nudged slot looks helped ~25 % of the time" as *the null any future nudge must beat*. It is a per-boot artefact: `baselineSamples` is an in-memory ring (`server.ts`, cap 50), absent from `fleet.json`. Live re-read: 6.7 % (1/15) vs 25 % (3/12), Fisher exact **p = 0.294** — statistically indistinguishable | found the number's writer, checked its lifetime (persisted? capped? reset on boot?), re-measured live, computed the test |
| **D4** | **Metric-name mismatch** — a field measures something narrower than its name and its uses imply | `ownerPrompts` counts only `source === "owner"` (UI-composed sends); prompts typed straight into a pane are logged `"terminal"` and excluded — live journal ≈ 90 owner vs ≈ 747 terminal. `steward-nudge.md` used it as "every human correction adds one" | read every `logPrompt` call site, then counted the real distribution in the journal |
| **D5** | **Promise the artefacts cannot keep** — a planned analysis needs data nothing records | `steward-nudge.md` §8 asked to "reconstruct the surface state at that moment (idle, dirty tree, …)". Dirty-tree-at-T exists nowhere: `gitInfo` is in-memory and `saveState` excludes it | for each input the plan names, searched for a durable writer; proved absence, not just failure to find |
| **D6** | **Incomplete set** — a copy/config/whitelist enumerates members and one is missing | `steward-arena.sh:153` copies `server.ts` but not `merge-prompt.ts` — **already broken at HEAD** before any new module. Related, since fixed: `SUMMARIZER_MARK` covered only one of the two prompts run via `summaryViaSession` | rebuilt the exact copy set in a scratch dir and ran `bun build server.ts --target=bun` → `Could not resolve: "./merge-prompt"` |
| **D7** | **Asserted invariant vs enforced invariant** | "a lane worktree session cannot affect the live server or the main checkout" — token scope *is* enforced; filesystem/process isolation is **convention only** (same user, bypass permissions, `fleet.json` readable) | searched for an enforcement point per invariant; reported "asserted only" where none exists |
| **D8** | **Broken join / silent cap** — a record cannot answer the question it exists for | `reverted`→`landed` joins **by branch**, but a branch survives a land and can be re-landed, and the row carries no `repo`. `filesTouched` is `.slice(0, 200)` with no truncation flag, and `--name-only` without `--no-renames` records only the destination path | constructed the failing case; for the rename claim, an empirical two-commit repo test |

## The proof discipline (this is the load-bearing part)

Two of the three errors the seeding session made were *not* reasoning errors. They were **running a
check and not reading its output.** Both worked examples are worth carrying:

- A `patch-id` experiment reported "VERSCHIEDEN" while `fatal: invalid upstream 'master'` sat
  visibly in the same output — the rebase under test never ran. The conclusion happened to be
  right; the evidence was worthless.
- A claim about *yesterday's* slot occupancy was "corrected" with *today's* measurement. Worse: the
  underlying fact is unknowable, because historical slot state is never persisted (D5, applied to
  one's own correction).

So, binding:

1. **Every finding pastes the command and its actual output.** Never the word "verified" standing
   alone. A finding whose command errored is not a finding — re-run it correctly or drop it.
2. **A correction must address the same object as the claim.** Same time, same file, same scope.
   If the claim is about a past state that nothing records, the honest finding is *"unverifiable,
   and here is why nothing could verify it"* — not a refutation.
3. **Read the surrounding comment before calling something wrong.** This codebase documents its
   deliberate trades in place (`baselineSamples`: *"advisory number — not worth the persist/restore
   surface"*). When the code already owns the trade, the finding is **not** "this is a defect" but
   "a doc elsewhere uses it as if the trade did not exist." That reframing is the whole finding, and
   getting it wrong burns owner attention on a settled decision.
4. **Line numbers drift; symbols do not.** Cite `file:symbol` and grep for it. A stale line number
   is not a discrepancy.
5. **Argue against each finding once before writing it down.** If the counter-argument wins, the
   finding is dropped — and dropping it is a result, not a failure.

## Fix directly vs document

**Fix directly** (the change is local and the correct value is provable): citation rot, stale
status lines, a wrong number, a missing member of a set, a doc sentence contradicted by the code it
describes. Commit these with the proof in the message.

**Document** (needs a schema change, new recording, or a design decision): everything else. Each
entry needs three things or it is not actionable — **the failing case**, **the cost** (what breaks,
degrades, or becomes unmaintainable), and **the verification that would prove a fix**. No entry
without a cost; an uncosted observation is labelled as such.

## Where to look (five sweep axes, agent-parallelizable)

Fan out for *breadth*; adjudicate centrally, because agents do not inherit this file's discipline
and reliably over-report. Give each agent the proof rules above verbatim, and require a
`not examined` list.

1. **Doc ↔ code**: every doc claim about how the code behaves, against the symbol it names.
2. **Doc ↔ deployed reality**: status/deploy claims against the running process, its env, and
   commit dates. (Read-only. Never restart, never `launchctl`, never touch the live socket.)
3. **Schema ↔ consumer**: for each persisted record, can a consumer actually compute the question
   the record exists for? (D8)
4. **Enumerated sets**: copy sets, env whitelists, marker lists, validated-field lists, `cp -R`
   lines, dispositions, route allowlists. (D6)
5. **Numbers**: every figure written in a doc — is it reproducible today, and is its lifetime what
   the doc assumes? (D3, D4)

## Hard limits

- **Read-only on everything outside the repo**: the live server, `launchctl`, `~/.claude`,
  `~/.cloudflared`, other repos. Worktree isolation covers files in this repo only — outside it,
  report instead of touching (CLAUDE.md).
- **Do not edit `server.ts`, `src/`, or `fleet-e2e.ts`** unless a finding is a one-line provable
  correction *and* no other lane holds that file. Footprint collisions on those files are this
  project's known land-blocker.
- **One findings file** — append to this doc's log below. No new analysis docs: the corpus already
  holds more analysis than shipped mechanism.
- **Never "fix" a documented deliberate decision.** See rule 3.

## Findings log

*Newest first. Each entry: class, the claim, the reality, the command + output that proved it, the
cost, and either the fix commit or what a fix would require.*

### 2026-07-25 — F9: the deployed land gate cannot run its own first step in a lane

**Class:** D1 + D3 (a number measured on the wrong object). **Fixed (doc):** `8452185`.

**Claim:** `merge-review-autonomy.md` §7 — *"fast tier SHIPPED to the repo (`b30c746`) … **NOT
yet deployed** … Validated to run in `runVerify`'s context **WITHOUT `node_modules`** (the
lane-worktree condition …): ALL PASS from a `node_modules`-less tree in **~46 s** (< the 120 s
timeout)."*

**Reality, two errors in one bullet.** It *is* deployed — the live `srv` (started
2026-07-25 00:16:54) carries a `FLEET_VERIFY_CMD` identical to `watchdog.sh:38`. And the
no-`node_modules` validation covered only the second half of the `&&`: `--types bun` needs
`@types/bun`, a devDependency in gitignored `node_modules`; a lane is made by `git worktree add`
with no install step; `runVerify` spawns `sh -c VERIFY_CMD` with `cwd` = that lane worktree.

```
$ git archive HEAD | tar -x -C $S && cd $S && ls node_modules
ls: …/verifyprobe/node_modules: No such file or directory
$ sh -c 'bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler \
      --types bun src/client.ts src/share.ts server.ts fleet-e2e.ts'
Resolving dependencies
Resolved, downloaded and extracted [2]
Saved lockfile
error TS2688: Cannot find type definition file for 'bun'.
exit=1 elapsed=2s
```

**Cost:** the gate short-circuits in ~2 s and never reaches `e2e-claude-gate.sh`, so "~46 s < the
120 s timeout" describes a run that does not happen. It fails **closed** — no bad land — but a
good rebase is downgraded to stop-for-human, and `verified:false` is written into the outcome
ledger that `lane-autonomy-future.md` says the graded-auto-land decision will be calibrated on.
Whether a lane passes therefore depends on whether its agent happened to run `bun install`.

**Counter-argument considered:** *ledger row 3 (`perception-write`) has `verified:true`, so it
works.* It loses under rule 2: that lane's worktree is torn down at land, so *why* it passed is
now unverifiable — and it makes the outcome luck-dependent, not correct. Nothing in the land path
creates `node_modules`, and 3 of the 5 worktrees on this box have none.

**A fix would require** either dropping `--types bun` from the gate's tsc invocation, or an
install step before verify. Verification: the reproduction above must exit 0.

### 2026-07-25 — F10: two crash-time copies of `fleet.json` are untracked, and undo-land refuses on untracked

**Class:** D6 (incomplete set). **Fixed:** `8452185`.

**Claim:** implicit but load-bearing — `.gitignore` enumerates the runtime-state artefacts,
including both rotation generations of every log, and `lane-autonomy-future.md` treats undo-land
as the rollback that makes the land boundary reversible.

**Reality:** the set omitted the two files `server.ts` itself writes next to `fleet.json`.

```
before:  fleet.json IGNORED   fleet.json.bak NOT IGNORED   fleet.json.tmp NOT IGNORED
after:   fleet.json IGNORED   fleet.json.bak IGNORED       fleet.json.tmp IGNORED
```

The delivery mechanism is an asymmetry between two cleanliness checks that were written to
different rules: the land path filters untracked entries out —
`server.ts:4788 .filter((l) => l && !l.startsWith("??") && !l.startsWith("!!"))` — while
`resetIntegration` (undo-land) refuses on *any* `status --porcelain` output.

**Cost:** a single `?? fleet.json.bak` in the checkout holding `main` makes undo-land refuse
permanently, with a message about uncommitted changes that points at nothing the owner wrote —
and that file is created exactly when boot finds `fleet.json` unreadable (`server.ts:3469`), i.e.
at the moment reversibility matters most. Second, independent cost: `fleet.json` holds `token`,
`stewardToken` and every slot's `selfToken`, so an un-ignored copy is one `git add -A` in the main
checkout away from committed credentials.

**Counter-argument considered:** *crash-only file, the owner would notice.* It loses on the first
cost: the failure is silent and presents as "undo says main is dirty" with no pointer to a file
nobody knows exists. No comment anywhere claims the omission was deliberate, and every sibling
artefact — including rotated `.1` generations — is listed.

### 2026-07-25 — F11: `INTAKE.md`'s security section states two bounds that do not bind

**Class:** D3 + D4. **Fixed:** `8452185`.

**Claim:** `INTAKE.md` §"Security model (read before enabling)" — *"**Caps:** text is truncated to
20 000 chars; max 30 submissions per rolling hour (429 after that); **the queue keeps the newest
200 tasks**."*

**Reality:** the text cap and the 429 hold. The other two do not.

```
$ sed -n '<capTasks>' server.ts
function capTasks(list: Task[]): Task[] {
  if (list.length <= MAX_TASKS) return list;
  const live = new Set(list.filter((t) => t.status !== "done"));
  …
$ grep -n 'status: "pending"' server.ts        → 3310  (inside handleIntake)
$ grep -n 'intakeStrikes' server.ts
218:const intakeStrikes: number[] = []; // timestamps, for a simple hourly rate limit
3300/3301/3306                                  (never in saveState's body)
```

`capTasks` evicts only `status === "done"`, and intake always writes `pending` — so the 200-cap
never applies to the tasks intake creates. `intakeStrikes` is process memory, so the hourly window
resets to zero on every restart.

**Cost:** this bullet is what a reader consults before exposing an endpoint to the public internet,
and it is the only stated bound on retained external state. The real bound is however many pending
tasks the owner has not dispositioned — each persisted in `fleet.json` and rewritten in full on
every `saveState`, the one file whose corruption eats every share, task, lane tag and session pin.

**Counter-argument considered:** *rule 3 — `capTasks` owns its trade in a comment ("a still-pending
task must never be evicted"), and it is right to.* It wins about the code, which is why this is
filed as a doc finding: `queue-automation.md` states the same function correctly ("keeps all live +
newest done"), and `INTAKE.md` is the one place that dropped the qualifier — while attaching the
number to the single source of tasks the qualifier excludes.

### 2026-07-25 — F12: two enumerated sets in `server.ts` that their own comments say must be complete, are not

**Class:** D6. **Fix:** documentation — both fixes are `server.ts` edits beyond a one-line
correction, deliberately not made in this lane.

**(a) `MERGE_TOOLS` omits the one command the repair prompt mandates.**

```
$ sed -n '2529,2531p' server.ts
const MERGE_TOOLS = "--permission-mode dontAsk --allowedTools "
  + '"Bash(git status:*)" "Bash(git diff:*)" "Bash(git log:*)" "Bash(git add:*)" "Bash(git rm:*)" '
  + '"Bash(git checkout:*)" "Bash(git rebase:*)" "Edit(**)" "Write(**)" Read Grep Glob';
$ grep -n 'Stage and commit' merge-prompt.ts
104:    "3. Stage and commit: git add -A && git commit -m 'repair: fix verification failure'. Do NOT rebase.",
```

`git add` is allowed; `git commit` is not. The surrounding comment states the model —
*"--permission-mode dontAsk so anything off-script is auto-DENIED instead of hanging"* — and the
server already has a branch for the resulting state: *"the repair left uncommitted edits (contract
says commit): drop that unreviewed, unverified scratch … this makes the round a no-op"*, followed
by `git reset --hard HEAD`. So every repair round can stage and never commit, and is then discarded.
**Cost:** `FLEET_MERGE_REPAIR_ROUNDS` defaults to 2 and is on in production, so each conflicted
land with a red verify spends up to two real `SUMMARY_MODEL` sessions (480 s each) on a step that
cannot complete, and a land-hardening feature the corpus counts as working is a structural no-op.
Not a safety cost — the conflict path stops for review regardless. **Why this is documented and not
fixed:** the load-bearing premise is the CLI's `dontAsk` semantics, which I could not execute here;
`claude --help` confirms the mode exists and nothing more. What *is* provable without it is the
contradiction between three in-repo assertions, and that is the finding. The e2e cannot catch it:
the repair test drives `FLEET_MERGE_CMD` (`fakemerge`), a plain subprocess with no permission layer,
which runs `git commit` unrestricted — the suite proves a path production cannot take.

**(b) `BACKGROUND_MARKS` covers 2 of the 8 prompts run through `summaryViaSession`.**

```
$ sed -n '1593,1596p' server.ts
// … A mark missing here means that transcript can be served as the
// adopted slot's own conversation — keep this list in step with every prompt run via summaryViaSession.
const SUMMARIZER_MARK = "read-only reviewer summarizing the state of a coding session";
const REVIEW_MARK = "read-only code reviewer. The diffs below are the WHOLE subject";
$ grep -n "summaryViaSession(" server.ts
2000 summarize · 2213 review · 2322 commit-msg · 2448 enhance · 2947 resolver
2977 repair · 3017 clean-review ② · 3906 steward digest
```

Six have no mark. The precondition is real: the transcript `rm` lives in `summaryViaSession`'s
`finally` and `summarizerSids` is process memory, so a deploy mid-run loses both; boot reaps the
orphaned tmux session but not the orphaned `.jsonl`, leaving the sniff as the only defense — which
is the exact argument the comment makes for having added `REVIEW_MARK`. **Cost:** after a restart
that interrupts one of the six, the stray transcript is the newest `.jsonl` in that slot's project
dir and is served as the slot's own conversation; ✨ summarize then summarizes the wrong transcript.
Highest exposure on resolver/repair/clean-review — 480 s windows that run *during land*, which is
when deploys happen. **Counter-argument considered:** *the comment scopes it to prompts running in a
slot's project dir.* Checked and lost: all six are called with a slot's `cwd` (lane worktree for
merge/repair/clean-review/commit-msg, slot cwd for enhance, `home.cwd` for the digest).

### 2026-07-25 — F13: the empirical base that sizes the intervention playbook is not a partition, and cannot be re-derived

**Class:** D3. **Fix:** none possible — see below. Recorded as a bound on how the numbers may be used.

**Claim:** `steward-autonomy.md` §"Empirical base (mined 2026-07-21)" — *"Primary-label
distribution: iterative feedback / next slice ~35%, new information the agent lacked ~18%,
verification demands ~15%, scope/direction corrections ~13%, understanding questions ~9%,
git/lifecycle one-liners ~8%, pure continue-nudges ~7%, stop/abort ~2%."*

**Reality:**

```
$ bun -e 'console.log([35,18,15,13,9,8,7,2].reduce((a,b)=>a+b,0))'
107
$ grep -rln "iterative feedback" . --exclude-dir=.git
docs/steward-autonomy.md
```

Eight buckets rounded to whole percent can drift at most ±4, so these cannot be exclusive primary
labels — roughly 20 of the ~280 messages are double-counted, or one figure is wrong. The doc is the
only place the labels exist: no mining artefact in `briefs/`, no labelled corpus on disk.

**Cost:** these shares are the *sizing argument for the build order*. §5 picks nudge kinds by share
("state-relay (from the ~18% bucket; largest lever)", "lifecycle-op (~8%)", "continue-nudge (~7%)")
— and the 8-vs-7 ordering sits inside the arithmetic error the 107 % exposes. Separately,
`automation-frontiers.md` §1 spends the same ~35 % on the praise-gate, a class no bucket names and
that the same section twice calls "sparse".

**Why nothing is corrected:** proof rule 2. The underlying labelling was never stored, so which
figure is wrong is unknowable, and "correcting" it against today's journal would be the wrong
object — that corpus has the three-regime problem F1 records. The honest result is: *the ranking is
not repairable, only re-mineable*, and until then no build order may rest on the difference between
two adjacent buckets.

### 2026-07-25 — F2: "zero code in `server.ts` knows about the steward" — the label is a credential decision

**Class:** D7 (asserted invariant vs enforced reality) + D1. **Fixed:** `09138e2`.

**Claim:** `steward.md` header — *"A usage pattern, not a server feature: **zero code in
`server.ts` knows about it**, and Fleet is fully functional without it."* `steward-overview.md`
repeats it verbatim as an AS-BUILT claim.

**Reality:** `server.ts` hard-codes the label and branches on it in four places, one of which
decides who gets a credential.

```
$ grep -n "STEWARD_LABEL" server.ts
234:const STEWARD_LABEL = "⚙ steward";
295:  return slots.find((x) => x.cwd && x.label === STEWARD_LABEL) ?? null;
1083:    const stewardExport = s.label === STEWARD_LABEL && stewardToken
2263:      if (s.label === STEWARD_LABEL) continue;      // the planning pane is not lane work
3747:      doneLooking: !!s.cwd && !!s.worktree && s.label !== STEWARD_LABEL

$ sed -n '1083,1084p' server.ts
    const stewardExport = s.label === STEWARD_LABEL && stewardToken
      ? `export FLEET_STEWARD_TOKEN='${stewardToken}'; ` : "";
```

**Cost:** the highest of this sweep, because it is a *safety* claim in the two entry docs of the
subsystem. A reader who believes it treats renaming a slot to `⚙ steward` as cosmetic; it actually
hands that pane `FLEET_STEWARD_TOKEN` on its next (re)spawn and with it self-serve reach on
`/api/steward/*`. `steward.md` contradicts itself four lines later ("any automation may key on the
label or its cwd"), which is why the claim survived: it reads like framing, not like a fact.

**Counter-argument considered:** *the doc is dated 2026-07-21 and states a decision as of then.*
It loses — the sentence is present tense with no as-of qualifier, `steward-overview.md` reprints
it under a heading whose job is as-built claims, and `steward.md`'s own Knowledge-maintenance rule
makes updating exactly this kind of claim part of the lane that changes the code.

### 2026-07-25 — F3: `briefHash` does not hash the brief on 30 of 49 live lanes

**Class:** D4 (metric-name mismatch) + D8 (broken join). **Fix:** documentation — a real fix is a
write-side change.

**Claim:** `server.ts:LaneOutcome` header — *"model + briefHash are recorded as an ENTANGLED pair
(a strong brief lets a weak model succeed): never attribute an outcome to the model alone"*;
`HANDOFF` §7.4 — *"`briefHash` correlates a brief to its outcome"*; the field's own comment,
*"stable short hash of the lane's FIRST owner prompt (the brief)"*.

**Reality:** `briefHashOf(laneOwnerPrompts(cwd).firstText)`, and `laneOwnerPrompts` keeps only
`p.source === "owner"` — the UI-composed sends. A brief typed into the pane is logged `terminal`;
a brief delivered by the dispatcher is logged `auto` (`server.ts:1503`). Both are skipped, so the
key is either absent or hashes whatever owner-UI message came *later* — a correction, not the brief.

```
$ bun -e '…group live streams/prompts.jsonl by lane worktree cwd, find the first "owner" record…'
lane worktree cwds in journal: 49
  briefHash NULL (no owner-sourced prompt): 25
  briefHash hashes a LATER prompt (first was not owner): 5
  briefHash hashes the actual first prompt: 19
```

**Cost:** the ledger's primary learning key is absent on 51 % of real lanes and *wrong-matched* on
another 10 %. Wrong matches are the expensive half: two lanes given the same dispatched brief but
different corrections get different hashes, and two lanes given different briefs but the same
correction ("run the e2e suite") get the same one — while `model` is recorded as entangled with it.
Worse, the population it fails hardest on is dispatched lanes, i.e. exactly the autonomous ones the
ledger exists to evaluate.

**Counter-argument considered:** *this is the `ownerPrompts` source confound (F1/D4) again, already
documented.* It loses on kind: D4 is a **count** being narrower than its name, and the corpus now
records that. `briefHash` is a **join key** asserting it identifies one specific object, and no doc
anywhere says it can identify a different one or none.

**A fix would require:** logging the brief with a provenance that survives its source — either
recording `firstText` from the first prompt of *any* source, or stamping the lane's founding brief
at `createWorktree`/dispatch time. Verification: re-run the grouping above and require
`briefHash NULL` to be non-zero only for lanes that genuinely received no prompt.

### 2026-07-25 — F4: the study-arena was dead at startup — its copy set lost two modules

**Class:** D6 (incomplete set). **Fixed:** `fe248c8`.

**Claim:** `docs/README.md` — *"`steward-arena.md` — operating autonomy in two shapes: A the
hermetic clone study-arena (**BUILT**: `steward-arena.sh`)"*.

**Reality:** `steward-arena.sh` copied `server.ts`, `public/` and `package.json`. `server.ts` has
two local imports — `merge-prompt` (since the merge lanes) and `lane-signals` (since `600d401`).
The arena never reached its port bind.

```
$ cp -R server.ts public package.json $S/ && cd $S && bun server.ts
error: Cannot find module './merge-prompt' from '…/arena-set/server.ts'
Bun v1.3.9 (macOS arm64)
exit=1

$ cp -R server.ts merge-prompt.ts lane-signals.ts public package.json $S/ \
    && cd $S && bun build server.ts --target=bun --outfile=/dev/null
Bundled 3 modules in 7ms
BUILD OK
```

**Cost:** the one shape of operating autonomy the corpus calls BUILT could not start. The failure
is invisible to every gate: no suite covers `steward-arena.sh`, and the seeding session's D6 entry
had already found the `merge-prompt` half by rebuilding the copy set — it was recorded and not
fixed, and then `600d401` added a second missing member on top of it.

**Counter-argument considered:** *the seeding session already logged this, so it is not a new
finding.* It loses in the only way that matters here: the entry documented a break and left it
broken, and the set had since decayed further. A doc entry is not a fix.

### 2026-07-25 — F5: a review that did not parse is persisted as a clean review

**Class:** D8 (a record cannot answer the question it exists for). **Fix:** documentation — flagged
in `perception-layer.md` §6 (`b0b0e6a`); a real fix is a write-side schema change.

**Claim:** `perception-layer.md` §6, written as lane (a)'s brief — *"**Empty findings ≠ clean.** …
A review with zero findings must render as 'the diff-bounded reviewer found nothing', **with its
`scope`/`notes`**, never as a green checkmark."*

**Reality:** `runReview` fails soft — an off-contract answer keeps `raw: true` and the model's prose
in `notes`. `outcomeReview` persists neither field.

```
$ sed -n '2043p' server.ts
  findings: ReviewFinding[]; scope: string; notes: string;
$ sed -n '2650,2651p' server.ts
  | { state: "covered" | "superseded"; at: number; model: string; head: string | null;
      dirty: number; patchId: string | null; landedPatchId: string | null; findings: ReviewFinding[] };
$ sed -n '2219,2220p' server.ts
  // fail-soft exactly like runSummary: an off-contract answer degrades to notes, never a 500
  let findings: ReviewFinding[] = [], notes = body.slice(0, 2000), raw = true;
```

So a reviewer that returned prose, an error, or a refusal is written to the ledger as
`{state: "covered", findings: []}` — byte-identical to a real clean review. `scope` is dropped too,
and it is what distinguishes a real lane diff from the fallback *"uncommitted changes plus recent
commits (no lane base to diff against)"*, i.e. a review of a different subject.

**Cost:** lane (a) — the next lane in this layer's own fixed order — cannot honor the honesty
constraint its brief states, from the data lane (c/b) writes. Until then every reviewer failure is
recorded as coverage, and `600d401` turned ③ from click-only into routine and unattended.

**Counter-argument considered:** *the `OutcomeReview` union documents its trades in place, so rule 3
applies.* It loses on scope: the comment owns the **coverage relation** exhaustively and says
nothing about `scope`/`notes`/`raw`. Per rule 3 the finding is therefore not "the union is wrong"
but "§6 uses fields the writer does not persist" — which is how it is filed.

**A fix would require:** carrying `scope`, `notes` and `raw` onto the persisted variant.
Verification: force `runReview`'s catch path in the e2e and assert the row is not
`{covered, findings: []}`.

### 2026-07-25 — F6: the outcome ledger rotates, and its only reader reads one generation

**Class:** D6 + D8. **Fix:** documentation — a real fix is a one-line reader change plus a decision
about the already-rotated case.

**Claim:** `server.ts:LANE_OUTCOME_FILE` — *"per-lane attributed-outcome trail … Rotated by
appendEvent at AUDIT_ROTATE_BYTES, same as AUDIT_FILE"*, for a purpose (*which model + brief +
task-class produces landable work*) that is strictly longitudinal. `steward-intelligence.md` §4
states the rule for this exact mechanism: *"the file rotates (single `.1` generation) and the
reader spans that boundary … or the second rotation silently resets the record autonomy depends on."*

**Reality:** two of the three `appendEvent` consumers span both generations. The ledger's only
reader does not.

```
$ grep -n '\.1`' server.ts
276:  for (const f of [`${AUDIT_FILE}.1`, AUDIT_FILE]) {                     # stewardRecentSends: spans
380:        renameSync(file, `${file}.1`);                                   # appendEvent: rotates
3698:  for (const f of [`${STEWARD_JOURNAL_FILE}.1`, STEWARD_JOURNAL_FILE]) { # readStewardJournal: spans

$ grep -n 'LANE_OUTCOME_FILE' server.ts
31:const LANE_OUTCOME_FILE = `${import.meta.dir}/lane-outcomes.jsonl`;
2846:  if (o) appendEvent(LANE_OUTCOME_FILE, o as unknown as Record<string, unknown>);
4442:      const text = existsSync(LANE_OUTCOME_FILE) ? await Bun.file(LANE_OUTCOME_FILE).text() : "";
```

**Cost:** at the first rotation the accumulated outcome history becomes invisible to
`GET /api/lane-outcomes` (and `total` under-reports without saying so); at the second it is gone.
Unlike the steward journal, no durable state tally mirrors it. The loss is silent and hits the one
record the autonomy program is gated on.

**Counter-argument considered:** *the live file is three rows / ~1.3 KB against a 5 MB threshold —
hypothetical.* It loses on the project's own precedent: the same argument was rejected for the audit
log and the steward journal, and the two-generation read was built twice. Rows also grow with the
review payload `600d401` added.

**A fix would require:** the same `[file.1, file]` loop the two sibling readers use. Verification:
the rotation-simulation pattern `fleet-e2e.ts` already uses for the send caps.

### 2026-07-25 — F7: four docs described `600d401`'s code as unbuilt

**Class:** D1 (stale status). **Fixed:** `c43f60f`, `0725e2a`, `b0b0e6a`.

**Claim:** `perception-layer.md` title *"design note (2026-07-25, **unbuilt**)"*, §1 *"③ is
click-only … Nothing persists them"*, §3 *"**Today the term exists only as an LLM label**"*;
`docs/README.md` *"design (2026-07-25, unbuilt)"*; `HANDOFF` §7.2 *"Today the ledger is write-only
and reviews evaporate on the next deploy"*; `steward-overview.md` gap 1 *"The server has **no** such
classifier (grep-verified)"*; `perception-layer.md` §5 *"Rows 1–2 of the ledger stay untouched"*.

**Reality:** pieces (c) and (b) shipped in `600d401`, the commit this lane forked from.

```
$ grep -n "doneLooking\|laneDoneLooking\|tickAutoReview\|outcomeReview" server.ts
7:import { laneDoneLooking, DONE_LOOKING_PROSE } from "./lane-signals";
2243:async function tickAutoReview(): Promise<void> {
2265:      if (!laneDoneLooking(laneSignalView(s, now), AUTO_REVIEW_IDLE_MS)) continue;
2731:async function outcomeReview(s: Slot, cwd: string, base: string | null): Promise<OutcomeReview> {
3747:      doneLooking: !!s.cwd && !!s.worktree && s.label !== STEWARD_LABEL
3748:        && laneDoneLooking(sig, AUTO_REVIEW_IDLE_MS),

$ wc -l ~/claude-fleet/lane-outcomes.jsonl   →  3   (§5 says rows 1–2)
```

**Cost:** the corpus map and the design note are what a fresh session loads to decide what to build.
Marked "unbuilt", this layer reads as available work — the failure mode is a lane spawned to build
what exists, and a `steward-overview` reader re-deriving `done-looking` in-LLM next to a served
deterministic answer. Note the pattern, not just the instances: CLAUDE.md's Wissenspflege rule
("structural changes to server.ts pull the affected doc claims into the same lane") was not applied
by `600d401`, and nothing checks that it was.

**Counter-argument considered:** *a design note is a historical artefact; it may legitimately
describe the world at writing time.* It loses only because these are present-tense status claims in
a *title* and a corpus index — the two places a reader takes as current. The rationale prose was
kept and marked, not rewritten.

### 2026-07-25 — F8: five citations that point at nothing, or at the wrong principal

**Class:** D2 (citation rot) + D1. **Fixed:** `c43f60f`, `09138e2`, `aa6af3e`.

Grouped because each is one line and the class is the finding.

1. **`docs/right-tab-agents.md` never existed.** Listed in `docs/README.md`'s "Design notes" and
   cited by `steward.md` as the source of the advisory-never-gates norm.
   `$ git log --oneline --all -- 'docs/right-tab-agents.md'` → *(no output)*. The norm is stated in
   `perception-layer.md` §7; no inventory of the board's agentic surfaces exists anywhere.
2. **`steward-autonomy.md` joint 1 sends the steward to owner routes.** It names `/api/sessions`,
   `/api/slots/:id/brief`, `/api/slots/:id/transcript`. A steward token is intercepted *before* the
   owner gate: `return r ?? json({ error: "steward token: route not in scope" }, 403);`
   (`server.ts:handleStewardRoute` call site). All three 403; the real paths are `/api/steward/*`.
   Same joint defers "an aggregated deterministic lane-state endpoint" that is
   `/api/steward/sessions` today. **Direct operational cost:** a steward following the doc burns a
   pulse debugging its own credential.
3. **`steward-arena.md` §5.1 listed a closed prerequisite as open** — "Still open: Tier-0 #3" (and,
   in the same sentence, "it now holds"). `stewardRecentSends` spans `[audit.jsonl.1, audit.jsonl]`
   with the seam named in its comment; `synergy-findings.md`:54 marks it CLOSED with the e2e that
   simulates a mid-window rotation. Two docs disagreed about one seam.
4. **`BACKLOG.md` said the learning engine has never run** — *"`docs/proposals/` and
   `docs/arena-episodes.md` do not exist"*. `docs/proposals/` holds five files / 1180 lines, and
   `feab50e` (15:52) predates the bullet's own commit `8e146d7` (16:08) by 16 minutes. The arena
   half is still true.
5. **The corpus map never pointed at `docs/proposals/`** — the shelf claims one line per doc; 1180
   lines of decision record were invisible to anyone loading it.

**Cost:** these are cheap individually and expensive together — a corpus whose pointers do not
resolve trains its readers to stop following pointers, which is the whole value of an index. (2) is
the exception: it costs a pulse the first time a steward obeys it.

### 2026-07-25 — F1: the prompt journal changes regime mid-corpus, and reconstructed records are indistinguishable from native ones

**Class:** D4 + D5 (compound). **Found while** verifying a figure this very doc asserted — the
`ownerPrompts` counts had been taken from an agent report and never counted first-hand.

**Claim in the corpus:** `steward-nudge.md` §8 treats the prompt journal as the durable source for a
retrospective over owner interventions; `ownerPrompts` is read as "every human correction adds one".

**Reality:** the journal has **three regimes** and one undocumented writer.

```
$ bun -e '…count by source over streams/prompts.jsonl…'
Zeilen: 2441 | unparsebar: 0
backfill: 1573      2026-07-05T15:38 .. 2026-07-19T15:28
terminal:  755      2026-07-19T16:28 .. 2026-07-25T07:19
owner:      91      2026-07-18T21:42 .. 2026-07-24T23:44
auto:       22

$ git log -S'PROMPT_LOG' -- server.ts | tail -2      → 3f70922  2026-07-19  (journal introduced)
$ git log -S'logPrompt(s, t, "terminal"' -- server.ts → ec1ad26  2026-07-19  (harvester introduced)
$ grep -n backfill server.ts                         → only a comment at :4195, no writer
```

Three facts follow, each load-bearing:

1. **`backfill` is not in `logPrompt`'s type union** (`server.ts:335` lists
   `owner|share|auto|terminal|steward`) and no writer for it exists in the repo — 1573 of 2441
   records, the largest source, were written by a one-off script that is not checked in. Their
   provenance is unreproducible.
2. **The journal only has native records from 2026-07-19.** Both the journal and the terminal
   harvester were introduced that day, so every record with an earlier `ts` is reconstructed.
3. **Therefore reconstructed `owner` records exist and cannot be told apart from native ones** — the
   earliest `owner` ts (2026-07-18T21:42Z) predates the journal's own introduction. `laneOwnerPrompts`
   counts both identically.

**Cost:** any analysis over the journal that does not segment by regime compares incomparable
periods — and §8's retrospective is exactly such an analysis. This is a *third* confound on
`ownerPrompts`, on top of the surface confound (owner-UI vs pane-typed) already recorded in §8: a
lane whose cwd predates 2026-07-19 has a structurally different count from one after, and no field
on the record says which.

**Fix:** documentation only — the data cannot be repaired retroactively, and backfilling provenance
would be reconstruction posing as recording (the ledger's own rule, HANDOFF §3). Recorded in
`steward-nudge.md` §8 as a hard boundary on the retrospective: **use only records from
2026-07-19 onward, and treat `ownerPrompts` on pre-2026-07-19 lanes as unusable.** A forward fix
(adding a provenance field) would only help records not yet written.
