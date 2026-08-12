# AGENTS.md — the short rulebook that travels

Claude Fleet is a local control plane for running and supervising coding-agent sessions in tmux
panes. A "lane" is a throwaway working copy of this repo; you are probably one. Work only your
slice. The README explains the product to humans; this file is the portable operating contract for
agents.

**Private overlay — hard loader requirement.** The full private operating rulebook is `CLAUDE.md`,
in this same directory. It is git-ignored, cannot be tracked or quoted here, and is copied into each
lane. Read it completely. Until P1-D proves a narrower loader path live, that full read remains
required. `AGENTS.md` owns the portable contract; `CLAUDE.md` owns private operating reality. Stop
and report any contradiction instead of selecting the more convenient rule.

## Portable operating contract

### Project identity and non-negotiable properties

Fleet coordinates agent work; it does not replace human judgment. It never trades away owner
promotion, isolated production, observations before claims, explicit `unknown`, deterministic done,
honest surfaces, or review effort proportional to the decision.

### Shared vocabulary

The **owner** is the human who decides scope and promotion; a **maintainer** coordinates and
synthesizes; a **user** makes a request; an **agent** performs bounded work. A **session** runs in a
reusable **slot**; a **lane** is its isolated working copy. A **harness** is how an agent runs and
what it can actually do; **provider** and **model** identify its executor. A **worker** is a bounded
agent run. A **task** is the existing queue item and its **brief** is the exact work order. **Verify**
proves a tree; **commit** records it; **land** promotes it server-side; **deploy** updates a running
instance; **audit** measures a landed tree. These are distinct acts.

### Hard invariants

- Request verbs select the mode and no broader authority:

  | Request verbs (examples) | Mode | Granted authority |
  |---|---|---|
  | ask, explain, review, diagnose | read-only | inspect and report |
  | change, fix, build | mutating | edit only the named scope |
  | monitor, watch, follow | monitoring | observe until the named terminal condition |

- Mutation does not imply commit. Commit does not imply land. Land does not imply deploy. Host,
  network, credential, machine, or other external writes each require explicit authority and a
  named stop point; monitoring grants none of them.
- Observations precede labels. Missing or failed evidence is `unknown`, never zero, false, or pass.
  Workers may **propose** findings, briefs, rules, skills, or retirement; only the owner may
  **promote** a binding version. Current code, ledgers, and live sensors outrank stale plan prose.
- Load the smallest relevant context after the required core. Use focused ranges and searches; put
  long output in files outside the repo and report tails. Before parallel mutation, assign exclusive
  file ownership; workers must not share a writable surface.
- Provider-, lifecycle-, or client-shaped work must decide every relevant adapter and surface as
  `apply`, `unsupported`, or `not-applicable`. Relevant surfaces can include protocol/wire,
  server, client, reverse-state, docs, and probes; silence is not a decision.
- Communicate in this order: **problem and importance -> solution and effect -> evidence -> open
  boundary**. Never lead with an implementation inventory.

### Overridable defaults

Unless the request says otherwise: take one narrow landable slice, reuse an existing mechanism,
avoid new files and parallel mutation, stop after the requested act, and keep context and output
small. An explicit override must name its scope and reason; it cannot override a hard invariant.

### Collaboration preferences

Prefer simple mechanisms, ambitious but grounded proposals, ceremony proportional to risk, and
problem-oriented language. Complexity is a cost, not evidence of seriousness.

### Examples

A review request may suggest a patch but does not apply it. A build request may edit its owned files
but does not authorize commit or deploy. A monitor request ends at its stated terminal state and
reports `unknown` when that state cannot be observed.

### History

History explains why a rule exists but grants no present authority. Keep examples and retired
inventories out of the normative core; when history conflicts with current code, ledger, or sensor
facts, correct or archive the history.

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

## If you are a Codex or Pi lane

Since 2026-08-12 normal agent harnesses run with full local access: you edit, use git and commit,
reach the Fleet API, tmux and the network yourself. Run the full Verify list above like any other
lane and commit your own work. The land gate still runs server-side either way;
`POST /api/slots/:id/commit` remains a recovery path, not your normal lifecycle.

If a command is mechanically refused anyway, that is a real signal, not a waiver: name the step and
quote the error verbatim in your report. Never report a step you skipped as if it passed, and never
soften a claim you did not verify.

## Reporting

Summary, the quoted verification tails, and one line for anything left unresolved. Report only your
slice. If you changed `CLAUDE.md`, say so as TEXT in the report — it is git-ignored and your copy
dies with this working copy, so someone else has to carry the change over by hand.
