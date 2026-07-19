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
