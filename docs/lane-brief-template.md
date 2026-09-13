# Lane brief template  (operative — fill in and deliver at LAUNCH)

*The Phase-2 artifact. A brief is delivered in the lane's initial prompt /
`--append-system-prompt` — **never** as a file written into the worktree: an
untracked file makes the lane permanently dirty and blocks `land`
(`tailored-context.md` §6). This template is the source a HUMAN launcher fills in
per task. The dispatcher briefs differently since 2026-08-04, and since 2026-08-05 it
does so EARLIER: the enhancer runs in its own sweep (`tickBriefSweep`, cadence
`FLEET_BRIEF_MS`, off by default — it shared the retired analyst's sweep and switch until
2026-08-18 and stands alone since the analyst went on 2026-09-10), the compiled brief is
stored on the task (`Task.brief`), and `briefAndSend` sends exactly those bytes with no
model call of its own. Two consequences worth knowing: the brief is
readable and editable in the queue before the lane starts, and an owner edit pins it
(`edited`) so nothing recompiles over it. Keep every filled brief under ~40 lines; curation is the point
(`tailored-context.md` §5).*

Placeholders in `{braces}`. Drop any section that is genuinely empty rather than
padding it.

## The filing head — a queue row that is its own card

A queue row whose text OPENS with these lines needs no card extractor: `card-extract.ts#parseFormattedCard`
reads them, `card-extract.ts#validateCard` checks them against the tree like any other card, and
`cards.jsonl` books the card as `source:"format"` (spec: `docs/messungen/2026-09-13-task-aggregation-a-e-fable.md` §A).
Every filing door takes it as plain row text — owner `POST /api/tasks`, the MAIN's self-filing, the
steward, intake — so there is one grammar, not four.

```text
[{optional title line}]
ROLLE: {harness-id}/{model-id}/{effort}        e.g. claude/claude-opus-5[1m]/high
GROESSE: klein|mittel|gross
FLAECHE: {tracked paths and datei#symbol, comma-separated; datei#a/#b for several symbols; — for none}
NEU: {files the row will ADD — untracked, in a tracked directory or under docs/messungen/}   (optional)
NACH: {queue ids this row waits on}                                                          (optional)
VERIFY: {at least one chain step name: install, pins, tsc, build, … or a bun / ./e2e- command}
DONE: {one checkable sentence}
{prose — its first line is the card's goal}
```

The five lines without "(optional)" must all be there, each once; otherwise the row is prose and the
extractor reads it. Symbols are top-level declarations only — no routes, no local variables. A path
that already exists goes under FLAECHE, never under NEU (a tracked NEU path is a card gap). A NACH id
that is not a queue row is a card gap; a valid one keeps the row out of every land wave before its
target's (`task-land-waves.ts#wavesFor`).

---

```text
You are working in an isolated worktree lane on branch {branch}. Your output will
be reviewed as a single diff and landed only if the tree is clean and the branch is
pushed or merged — commit your work; leave no untracked files.

TASK
{one paragraph: the change, in terms of observable behavior — not implementation
steps}

ENVIRONMENT (curated — start here, not from a repo-wide scan)
- Files this touches: {paths, with one clause each on their role}
- Constraints that apply: {interfaces to keep stable, patterns to match, things
  explicitly out of scope}
- Project rules are in CLAUDE.md (already in this worktree) — they apply.

DONE means
{the verification that proves it — exact commands and what their output must say,
e.g. "./e2e-isolated.sh tail reads ALL PASS and tsc is clean"}. Run it before
claiming done. If the same fix-run-fail loop repeats ~5 times, stop and report the
structural problem instead of iterating further.

BEFORE EDITING, silently establish (reason internally; do not narrate):
{the task's complement — every call/usage site, which tests exercise this, adjacent
state or config that could make the change wrong, edge inputs}. Make the change
consistent with all of it.

OUTPUT
Commit(s) with concise present-tense messages. Then report ONLY: a one-paragraph
summary of what changed, the verification result (quoted, not paraphrased), and a
one-line note of anything you could not resolve. No walkthrough of your reasoning.
```

---

## Filling it in

- **TASK** comes from the queue task text; sharpen it to behavior ("users can X")
  rather than mechanism ("add a function that").
- **ENVIRONMENT** is where the launcher's knowledge goes — the files and
  constraints the lane can't cheaply discover. Three well-chosen paths beat a
  directory listing.
- **DONE** must be a command with an expected reading, or the brief has a hope
  where its gate should be.
- **Silent complement** is task-specific: for a rename it's call sites and export
  surface; for an endpoint it's auth, input validation, and the share-host path;
  for UI it's mobile layout and the refit pattern. Name the complement, don't
  enumerate the world.
- **Model choice** (Phase 1): the better this brief, the cheaper the model that
  will succeed with it. If you can't hand this brief to Haiku with a straight
  face, the brief — not the model — is usually what needs upgrading.

## Norms earned by writing eight briefs in one day (2026-07-25)

- **Never paste the gate command into a brief.** It changed twice that day (the F9
  `bun install` prelude, then `merge-prompt.ts` joining the tsc file list), and every
  copy in a live brief is a silent drift source. Write *"run the Verify line in the
  lane's CLAUDE.md"* — the lane has that file, and it is the single source.
- **No blanket flake amnesty.** "Two known flakes may fire, neither is yours" became a
  standing free pass under which a *new* fail of the same signature could hide. The
  brief says instead: any failing check is yours unless you prove
  fails-identically-at-HEAD in a fresh worktree, with the run quoted. (Also in CLAUDE.md,
  so it rides into every lane.)
- **Footprint must name the *other* producer, not just your own files.** With three
  lanes live, "fleet-e2e.ts, insert next to related checks, never at EOF" plus *which
  region a sibling holds* is what actually prevented collisions. Naming only your own
  allowance does not. (Since 2026-07-25 the suite is split: the checks live in
  `e2e/<family>.ts` and `fleet-e2e.ts` is a runner. The rule is unchanged in substance —
  "insert next to related checks in the right family module" — but the collision surface
  is now per-family, so name the *module*, not the file.)
- **Gate coverage steers what a lane may own.** The land gate is tsc (seven files) +
  `./e2e-clean-review.sh && ./e2e-security.sh && ./e2e-claude-gate.sh` (`watchdog.sh`,
  `VERIFY_CMD` — the file is the source, not this line): server-side behavior is
  covered, **client code is asserted only at source-string level (no DOM harness)**. So a lane whose value lives in rendering carries risk the gate
  cannot see — say so in the brief, and prefer server-side scope for anything
  autonomy-adjacent until a DOM harness exists.
- **A calibration lane is told it is one.** Deceive the judge under test, never the
  worker planting the material (`judge-calibration.md`), and give it an explicit
  "then STOP" — a lane that helpfully fixes the seeded defect destroys the experiment.

## Lessons earned from real lanes (append one line per confirmed correction)

Each entry below is a *defect correction*: a real fault the lane shipped, that
every suite passed green, and that traces to a property of its brief rather than
to the executor. That class is dense and objectively adjudicable — see
`automation-frontiers.md` §1a for why it is tracked separately from taste.

**Read these as instances, NOT as a growing checklist.** (Correction 2026-07-25,
owner-prompted.) Both faults below were *discoverable inside the repo*: the
colliding constant was one grep away, the `??` sat in the lane's own diff. So
they were **attention-allocation failures, not information failures** — and a
rule of the form "enumerate more neighbours in the brief" does not scale, because
it requires the briefer to foresee everything. What scales is the habit the
sharpen discipline already installs: *derive what most needs checking from this
task, and name what your conclusion would silently rest on.* A brief's job is
only the residue — **what the lane cannot discover by reading, because it exists
only in the conversation**: a decision and its reason, a hazard and why the
obvious precedent does not apply here, the owner's ranking between two goods.
Everything discoverable should be *found*, not listed. The entries below are kept
because they are evidence of where attention failed, not because a longer list
would have prevented them.

- **Name the out-of-diff neighbours the change collides with.** (2026-07-24,
  `fleet/review-agent`) The lane introduced a timeout constant set to exactly the
  value of a server-wide `idleTimeout` it had never seen, because that constant
  lives outside its diff — so a long request would drop its connection instead of
  answering. `tsc` and all three suites were green. A brief that scopes a lane to
  a diff **must** name the adjacent constants, limits and config the change
  interacts with; a lane cannot discover what it was never pointed at, and
  "review your own diff" structurally cannot find it.
- **Enumerate the CASES the tests must cover — "add a failing test" is not
  enough.** (2026-07-24, `fleet/outcome-recorder-fix`) The brief demanded a check
  that goes red against the old code and got exactly one — for the happy path.
  The defect sat in the path nobody named: `??` cannot tell an explicit `null`
  from `undefined`, so the "verify genuinely did not run" case silently fell back
  to the very read the change existed to remove. Name the case list (happy,
  absent, explicit-null, stale-neighbour-state), not just the red-test rule.
- **Say which slots/fixtures a new e2e check may touch.** (2026-07-24, same lane's
  predecessor session) A check that opens or kills a slot mid-suite reordered
  state under the steward-send/outcome checks further down and produced 7
  unrelated failures. Prefer assertions that mutate no slot state.

## Game-Maker briefs (2026-09-03) — where the standing blocks live

The blueprint `docs/attic/werkzeug-integration-blaupause-2026-08-30.md` §5 measured seven
standing blocks (ENV, picture-duty field, Critic KIT, ToolSearch line, orchestration rule,
write-surface pre-check, measured-facts block) that every Game-Maker worker brief needs. They are
NOT anchored in Fleet: a lane reads its own repo, never this shelf. The canonical, in-use copy is
the game repo's `docs/brief-profil.md` (first instance: `~/private-repo-j.worktrees/game-maker-private-repo-j`,
seed `fa5a283`). A new Game Program copies that file into its seed and edits block G (measured facts
of ITS run); the MAIN pastes the blocks per brief type under the write surface. Rationale and the
eight ranked findings behind them: `docs/messungen/2026-09-03-private-repo-j-game-maker-gruendung.md` §1.
