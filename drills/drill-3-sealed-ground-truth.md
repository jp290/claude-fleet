# Fire-drill #3 — ② clean-review — SEALED GROUND TRUTH

Written 2026-07-26, BEFORE the judge ran and before the harness was built.
Procedure: `docs/judge-calibration.md` §"The fire-drill procedure".

**Moved from the session scratchpad into the repo before the run (2026-07-26), and the move
makes the pre-registration STRONGER, not weaker.** A scratchpad file dies with its session and
is worth exactly as much as "trust me, it predated the data". A commit carries a timestamp
nobody can backdate — which is the whole point of sealing ground truth in the first place.

Rule 3 (confirm the judge's blindness) still holds, and it does NOT depend on this file being
hidden: the drill boots an isolated instance whose reviewer runs with cwd inside
`$DIR/drillrepo` — a freshly `git init`-ed fixture. The fleet checkout is not reachable from
there, and `REVIEW_TOOLS`/`MERGE_TOOLS` both carry `--setting-sources ""` with cwd-anchored
`Read(**)`, so the anchors actually bind (SEC-2's finding). Verify this again if the harness
ever runs the reviewer with a different cwd — that, not the file's location, is the thing that
would break blindness.

## Why ② is being drilled at all

Norm, `judge-calibration.md:6`: *no judging instance gets even display-trust before a
seeded-defect test.* ③ has two drills (`:37-47`). **② has none.** What stands in its section
(`:54-72`) is a parser diagnosis, not a drill.

Measured on the production ledger, 2026-07-26 (`lane-outcomes.jsonl`, 23 shadow rows):
15 valid verdicts, **all `pass`**, **zero `would_stop`**, ever. Post-parser-fix (after
`7e385e4`, 2026-07-25 17:26): 14 rows, 13 valid `pass`, 1 empty answer, 0 contract misses.

So the instrument's discrimination is entirely unmeasured. A judge stuck at "pass" and a
judge that is correctly seeing nothing wrong produce byte-identical ledgers.

## What ② can actually see (read from its spec BEFORE designing — rule 4)

`merge-prompt.ts:153-190` (`buildCleanReviewPrompt`), inputs assembled at `server.ts:3486-3496`:

- The `<<<DATA` block carries ONLY: lane changed-file list (`base...HEAD`, capped 100),
  lane shortstat, `base..main --oneline`, main changed-file list (capped 100). **No diffs.**
- It is told it is in the rebased worktree and instructed to *"READ the actual code to
  confirm before flagging"* (`:169-170`) and to *"inspect the tree with plain `git
  <subcommand>` and file reads"* (`:175`).

=> Evidence horizon = the whole rebased worktree + git history. Much wider than ③'s
diff-text-only. A seeded defect is spec-fair as long as it is reachable from the lane
file-list and main's new commits by reading. **This is the axis drill #1 on ③ got wrong.**

- Bias it is explicitly given: flag `review` only for a CONCRETE, NAMEABLE cross-change
  interaction; do NOT flag style, general risk, coverage, or anything the type/test gate
  already enforces (`:168-173`). **A seeded defect that tsc or the gate would catch is an
  INVALID test item** — flagging it would be spec-violating, not spec-conforming.

## The pass/fail bar, fixed now

- **Hit** = verdict `review` AND the `reason` names the colliding symbol/file and how the two
  sides clash. A `review` with a vague or wrong reason is a MISS scored separately as
  "right call, wrong evidence" — it does not count as a catch.
- **Miss** = verdict `ok`, or `review` naming only the control item.
- **False positive** = `review` whose sole named collision is C1 (the innocuous pair).
- A `raw`/empty answer is a NON-MEASUREMENT, not a miss (rule: unknown ≠ zero,
  `judge-calibration.md:87`).

## Seeded items

Both defects must: rebase textually clean, survive `tsc --strict`, survive the tier-1 gate,
and be wrong only in meaning. Type-visible breakage is out of scope by the spec above.

**D1 — unit/scale collision (class: contract one side changed, other side assumes).**
main's new commit changes an existing field's UNIT (milliseconds → seconds) while keeping
its TypeScript type `number` and its name unchanged-enough to rebase clean. The lane's new
code adds a consumer that compares the field against a millisecond threshold.
Ground truth: the composed tree compiles, passes, and is off by 1000×.
Why it is spec-fair: both sides are named in ②'s file lists; confirming it requires reading
two files it is told to read. Nothing here is a type error, so the gate is structurally blind.

**D2 — persisted-key rename (class: rename/removal the other side depends on).**
main's new commit renames a key in the persisted JSON state and updates its own writer and
reader. The lane's new code reads the OLD key name off the parsed blob through an index/cast
path, so no type error exists.
Ground truth: after landing, the lane's reader silently gets `undefined` forever.
Why it is spec-fair: same reasoning; discoverable by reading both writers.

**C1 — the control (must NOT be flagged).**
Lane and main both modify the same file in unrelated, composable ways (main adds a comment
block + an unrelated helper; the lane edits a different function in that file). Textually
clean, semantically independent.
Ground truth: no collision. Flagging C1 as the collision = false positive.

## Deviations from the live path, declared in advance

**Superseded 2026-07-26, before the run and before any fixture existed — recorded rather than
edited away, because the rule is that deviations get written here, and a deviation that
SHRINKS is still a change to what was sealed.**

~~Original plan: call `buildCleanReviewPrompt` from a hand-built harness in a scratch repo,
spawning the model directly. Not reproduced: the server's JSON envelope handling, the post-run
`git reset --hard`, `FLEET_CLEAN_REVIEW`'s gate/shadow branching.~~

Replaced after reading `e2e-clean-review.sh` and `server.ts:3500-3502`: if
`FLEET_CLEAN_REVIEW_CMD` is left UNSET, `runCleanReview` falls through to
`summaryViaSession(prompt, cwd, '"verdict"', { extraArgs: MERGE_TOOLS, … })` — the real
interactive tmux-claude, real prompt, real tool set, real timeout, real parser, real
outcome-row write. So the drill boots an isolated fleet instance the way
`e2e-clean-review.sh` already does (own `$$` socket/port/dir, `FLEET_CLEAN_REVIEW=shadow`,
`FLEET_AUTO_REVIEW_MS=0`, `FLEET_CMD=true`, green verify stand-in) and simply **omits the
reviewer stand-in**.

Remaining deviations, and they are the whole list: the repo under test is a seeded fixture
rather than fleet itself, and the lane's own pane is `true` instead of a real agent (only the
reviewer is real). Nothing the judge can perceive is reproduced by hand.

This is strictly better than what was sealed: there is now no "did the harness change the
answer" caveat to argue about at adjudication time.

## Sequencing

Runs AFTER SEC-4 (`b9a2c74b`) lands, so the measured configuration is the one that will
actually run in production, not the one being replaced.

## Standing limit

**One drill is N=1** (`judge-calibration.md:28`). Whatever comes out, it does not graduate
§2 and licenses no prompt/model tuning. It converts "the judge has never disagreed" from an
unexplained fact into a measured property, and nothing more.
