# Lane brief template  (operative — fill in and deliver at LAUNCH)

*The Phase-2 artifact. A brief is delivered in the lane's initial prompt /
`--append-system-prompt` — **never** as a file written into the worktree: an
untracked file makes the lane permanently dirty and blocks `land`
(`tailored-context.md` §6). This template is the source the launcher — human or
dispatcher — fills in per task. Keep every filled brief under ~40 lines; curation is
the point (`tailored-context.md` §5).*

Placeholders in `{braces}`. Drop any section that is genuinely empty rather than
padding it.

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

## Lessons earned from real lanes (append one line per confirmed correction)

Each entry below is a *defect correction*: a real fault the lane shipped, that
every suite passed green, and that traces to a property of its brief rather than
to the executor. That class is dense and objectively adjudicable — see
`automation-frontiers.md` §1a for why it is tracked separately from taste.

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
