# AGENTS.md — the short rulebook that travels

Claude Fleet is a local dashboard that runs and supervises coding-agent sessions in tmux panes.
A "lane" is a throwaway working copy of this repo; you are probably one. Work only your slice.

**This file is deliberately thin.** The full rulebook is `CLAUDE.md`, in this same directory.
It is git-ignored, so it cannot be tracked and cannot be quoted here — but it IS copied into every
lane, so read it. This file carries only what you must not get wrong before you get there.

**Why two files.** `AGENTS.md` is the Codex convention: Codex reads it, and does not read
`CLAUDE.md`. Claude reads `CLAUDE.md` and ignores this one; the container harness runs Claude
inside a box, so it is on that side too. **pi reads THIS file, not `CLAUDE.md`** — measured at a
live pane on 2026-08-08, hours after this file first landed: pi's startup `[Context]` listed
`AGENTS.md` alone, with both files present in the worktree. Before this file existed pi loaded
`CLAUDE.md`, so its arrival silently moved pi from the full rulebook to this pointer. That is why
the sentence above — read it — is load-bearing for pi and not merely polite. Nothing here restates `CLAUDE.md`; when the two
disagree, `CLAUDE.md` is the rulebook and this file is the bug.

## Before you start

State, in one sentence, what "done" means and which command proves it. Run that command before you
claim done. If you cannot name the command, you do not yet have a task — say so and stop.

## Verify

Copyable, in order. Every step must pass; stop at the first failure.

```sh
bun install --frozen-lockfile
bun e2e/pins.ts
bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun \
  e2e/pins.ts src/client.ts src/share.ts server.ts fleet-e2e.ts fleet-e2e-claude-gate.ts \
  fleet-e2e-clean-review.ts fleet-e2e-security.ts fleet-e2e-postland-audit.ts \
  fleet-e2e-harness.ts
bun run build
./e2e-clean-review.sh
./e2e-security.sh
./e2e-claude-gate.sh
```

**Judge a suite by its TAIL, never by a remembered check count.** A clean run ends in `ALL PASS`.
Anything else is a failure, including a run that ended early. Quote the tail in your report; do not
paraphrase it.

`./e2e-isolated.sh` is the slow tier and is NOT part of the above. Run it only if you touched the
`e2e/` lifecycle, a suite wrapper, or the merge/land path. Suites take a shared mutex, so a run may
wait a long time before it starts — that is normal, not a hang.

Never kill a suite run by name pattern. The server runs the same script for its post-land audit, and
a pattern kill takes that down too, which records a red audit that measured nothing. Kill your own
run by the PID you noted, or not at all.

## Landing

Your work reaches `main` through a server-side land, not through anything you run.

- Commit your work. An uncommitted change is invisible to the land.
- Leave NO untracked files in the tree — they block the land. Scratch files belong outside the repo.
- Do not touch anything outside this working copy. Other repos, shared config, ports and sockets are
  shared reality: stop and report instead.

## A red check is yours

Assume the failure is your change until you have proof otherwise. "Looks like a known flake" is not
proof. The proof is: run the SAME tree again. Green on the rerun proves non-determinism directly.
Put the transcript in your report either way.

**On freshly written work, suspect your PROBE before your code.** A check that measures nothing
reports the same value as a check that measures a failure, and it reads like the code is broken.
Read the SIGNATURE of the failure against what you expected: a value the code cannot structurally
produce dates your measurement, it does not convict your code. A probe that could not run must fail
as ITSELF, under its own name — never as the thing it was supposed to measure.

Same fix-run-fail loop about five times? The problem is structural. Stop and report; do not re-roll.

## Where a test goes

`fleet-e2e.ts` is a RUNNER only. It boots the check modules in `e2e/` in order and prints the tail.
Add a check next to its family in the right `e2e/<family>.ts` — never at the end of a file just
because that is where the cursor is, and never back into the runner. Shared plumbing lives in
`e2e/harness.ts`; fixtures that outlive a section travel through `e2e/ctx.ts`.

`e2e/pins.ts` is different: it holds the must-agree pairs whose other half is NOT TypeScript — a
shell script, a doc, this file. It reads files and compares them, with no server and no network.
Write a RULE there, never a snapshot.

## If you are a Codex lane

Measured, not assumed: inside a lane you currently cannot run the suites (they need tmux sockets
outside your write root) and you have no network (so no `bunx`). `bun install`, `bun e2e/pins.ts`
and `bun run build` do work.

That is a real limit, not a waiver. The land gate runs server-side and will run the full check set
against your work whether or not you could. So: run every step you CAN, and in your report name
each step you could not run and quote the mechanical error that stopped it. Never report a step you
skipped as if it passed, and never soften a claim you did not verify.

## Reporting

Summary, the quoted verification tails, and one line for anything left unresolved. Report only your
slice. If you changed `CLAUDE.md`, say so as TEXT in the report — it is git-ignored and your copy
dies with this working copy, so someone else has to carry the change over by hand.
