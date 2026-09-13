# AGENTS.md — the short rulebook that travels

Claude Fleet is a local control plane for running and supervising coding-agent sessions in tmux
panes. A "lane" is a throwaway working copy of this repo; you are probably one. Work only your
slice. The README explains the product to humans; this file is the portable operating contract for
agents.

**Loader boundary.** This file owns the required portable contract. Interactive Codex and Pi
sessions load it automatically; a Claude session reads the **Portable operating contract** section
once because its project loader supplies `CLAUDE.md` instead. `CLAUDE.md` is a git-ignored private overlay for
host- and audience-specific operating reality: MAIN receives its full render, while a Fleet lane
receives a smaller render plus explicit back-references. It is not a second portable core and
Codex/Pi must not read it wholesale. Read a named private section only when the task brief or an
observed host seam requires it.

For facts, current code and live sensors outrank prose. For durable agent rules, this portable
contract outranks generic global defaults; the private overlay may specialize it but never weaken
its hard invariants. A founding or task brief narrows the current role, authority and work, but
cannot silently supply a missing portable invariant. Stop and report any remaining contradiction
between active layers instead of selecting the more convenient rule.

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

### Role contract — four levels

This contract gives you the LEVEL only: the dynamic role bootstrap gives this instance its concrete
role, authority and capabilities, the project's own `AGENTS.md` and sources give domain reality, and
the act brief gives the assignment — four sources, not four names for one.

A bound session owns its declared scope and is judged on results, evidence and staying inside its
bounds, never on following a centrally scripted micro-workflow. Ownership: Project MAIN -> its
program · lane -> its task · Supervisor -> fleet health · global controller -> portfolio and owner
translation. Three of the four are typed bindings in code (lane, program-main, supervisor); Fleet
Controller is a scope a plain session carries, not a binding — do not read this table as one.

| Level | Purpose | Autonomy | Back-channel, verified in this tree | Decides itself |
|---|---|---|---|---|
| Fleet Controller | hold the portfolio across programs and translate owner intent into programs | proposes; confirm and activate are owner acts | `POST /api/self/programs` proposes and reads (non-lane). **No owner route of its own** — it reports in its own pane. | which program to propose, how to phrase it, what to ground first |
| Project MAIN | run one confirmed program end to end | intelligence-first bounded: (A) reversible inside the confirmed scope -> act · (B) bounded execution, resources, routing -> act inside stated limits · (C) scope growth, irreversible direction, external effect or cost, deploy/submit, declared taste gate -> owner | `POST /api/self/attention` reaches the owner (program derived from the binding) · `GET /api/self/inbox` reads the durable return path of its bound program · `POST /api/self/clarifications/:id/reply` answers a worker · `POST /api/self/tasks` creates a capped pending row inside its occupant-bound own program and repository · `POST /api/self/tasks/:id/release` separately moves its own pending row to queued and does not dispatch (the reply is a queue fact, never a lane) · `GET /api/self/program-execution` is its lifecycle projection (`phase`, `phaseBasis`, `candidate`, `nextAction`, `unknown[]`) · `POST /api/self/tasks/:id/land` lands its own reviewable row where the projection grants it and an owner promotion exists · `POST /api/self/watch` `{kind:"merge"}` then `{kind:"audit"}` returns the land and post-land verdicts. | ordering, decomposition and task filing inside scope, worker and model choice, nudge/retry/replace, ordinary conflict resolution and integration, ordinary critic repairs |
| Act Lead / Worker | Worker: execute one bounded act in a lane and prove it. **Act Lead is not built**: `SYSTEM.md` lets a complex worker open child acts, and the role is to date neither adopted nor refused. | Worker: acts inside the write set and stop line of its brief; verify and land gates are machines it may interpret but never replace. Act Lead: none, because no mechanism exists. | `POST /api/self/clarifications` asks its MAIN · `POST /api/self/fleet-report` returns a result · `GET /api/self/drift` and `GET /api/self/gate` are its lane senses. A lane may not release, subscribe or raise attention (409 by design). **Act Lead has no route**: `delegate_act` in `SYSTEM.md` is target vocabulary with no implementation. | how to solve inside its write set, whether a red check is its own, when to stop and report |
| Supervisor | watch sessions, acts, questions, deadlines and evidence chains; name stalls, non-delivery and contradictory state | observes and nudges; never a second owner voice, never a command level | `GET /api/self/supervisor-view` reads, `POST /api/self/nudge` reaches a bound Program MAIN. **No route to the owner** — attention requires a MAIN binding, so its escalation is owner-read, not owner-sent. | what to watch, what counts as a stall, whom to nudge and when silence is correct |

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
- Where a Project MAIN's own act ends and a worker lane begins is a JUDGEMENT, never a posture, a
  size threshold or a table. Small, reversible, low-risk changes inside the confirmed scope — concise
  control or documentation edits, tiny integration glue, ordinary conflict resolution, a narrowly
  observed verification repair — may be made in the MAIN checkout when delegating would cost more
  than the change. Substantial product implementation, broad or parallel work, specialist work, work
  that wants fresh criticism, and work whose independent evidence or isolation materially matters go
  to an isolated worker lane. Routing every small edit through a worker is the scheduler failure;
  building the whole product in the MAIN checkout is the other. One narrow exception, and only by
  owner promotion: a **Game-Maker Program-MAIN** may do substantial serial work itself where
  implementation, launch, actual control, perception, repair and replay form one
  causally coupled product act — the perception is the product, and a fresh session per repair
  round cannot carry it.
  Separable, parallel, specialist and independent-proof work stays isolated there too. Every new
  Game Program completes one Preflight before implementation, using only the normal task rail:
  **Architect -> 0-2 named fact/risk probes -> fresh independent cross-model Review -> MAIN
  `ACCEPT|RETHINK|OWNER`**. The Architect commits one DRAFT Game Card with 1–4 executable
  first-slice briefs. The isolated Reviewer may optimize that Card within the confirmed Program and
  returns `ACCEPT <final-card-sha>` for its final commit. No implementation task is filed or released
  before `ACCEPT`. **THIS PREFLIGHT IS A BINDING ROLE OBLIGATION, NOT A SERVER GATE; EXISTING DOORS
  DO NOT AUTHORIZE A BYPASS.** Filing, release, land and direct checkout access remain technically
  reachable but do not certify acceptance or grant role authority to skip the order. On `ACCEPT`,
  MAIN checks the Reviewer's live HEAD against its report and lands exactly that commit; if self-land
  is unavailable, the owner lands that exact Reviewer commit from the Board. Before any implementation
  row is copied or released, MAIN writes and compares an auditable receipt in the ordinary Program
  report or tracked decision: **Architect task/model/SHA, Reviewer task/model/reported SHA, and actual
  landed SHA**. Fleet does not assemble or prove this receipt; missing comparison remains `unknown`.
  MAIN then copies the accepted briefs verbatim and releases only dependency-free roots.
  `RETHINK`/`OWNER` land no final Card and create no implementation
  task; `RETHINK` requires named new evidence rather than a review loop, while `OWNER` escalates.
  A Direct Slice is permitted only for a small feature inside an accepted game scope with an accepted
  Card; it need not be one of the Card's named first slices, provided it is bounded, reversible,
  low-risk and changes no core contract. An owner-confirmed core pivot or new game inside an existing
  Program starts a new Preflight.
  **SENSORY CRITIC IS POST-PLAY ONLY** and operator-orchestrated from a sealed build/launch/real-input/
  capture pack. It receives no Game Card, `HANDOFF.md`, hypotheses or rationale. The committed game
  checkpoint remains predecessor-to-successor state and owner proof, never sensory-Critic context.
  Hashes identify the sealed bytes only; they do not prove blindness or delivery. Critic blindness
  and delivery are operator-attested or unknown.
- A worker's report is a CLAIM. Proof is the diff plus the exact verification output. `PLAYABLE`
  means an artefact exists and was seen to run; it never means the owner has played it.
- Observations precede labels. Missing or failed evidence is `unknown`, never zero, false, or pass.
  Workers may **propose** findings, briefs, rules, skills, or retirement; only the owner may
  **promote** a binding version. Current code, ledgers, and live sensors outrank stale plan prose.
- Load the smallest relevant context after the required core. Use focused ranges and searches; put
  long output in files outside the repo and report tails. Before parallel mutation, assign exclusive
  file ownership; workers must not share a writable surface.
- Monitoring is event- or terminal-driven. A Controller delegates observation to the bound
  Supervisor when a typed notification route exists; the Supervisor returns only the requested
  state transition, an exception requiring action, or a predeclared deadline. Otherwise use one
  long-lived quiet wait outside the transcript. Never replace a missing route with tmux injection,
  and never stream repeated pane, process, trail, or API snapshots into model context.
- Waiting is event-driven. After you start a run that proceeds without you (a worker, a process,
  a build), one check is allowed: that the intended run accepted the work. If a reliable watch,
  notification, or wait mechanism exists for the awaited state, arm exactly one such return path
  and do not sample that state again until it fires; when it fires, read the evidence it names,
  not the whole surface. Sample the state yourself only when no return path exists or its defect
  is under investigation; then name the cadence and the stop line, and report `unknown` for every
  unobserved interval.
- Provider-, lifecycle-, or client-shaped work must decide every relevant adapter and surface as
  `apply`, `unsupported`, or `not-applicable`. Relevant surfaces can include protocol/wire,
  server, client, reverse-state, docs, and probes; silence is not a decision.
- After an external await, a continuation that can spawn or write a reusable Slot must re-prove its
  exact occupant identity; teardown and recycle must join any spawn already in flight.
- Communicate in this order: **problem and importance -> solution and effect -> evidence -> open
  boundary**. Never lead with an implementation inventory.

### Overridable defaults

Unless the request says otherwise: take one narrow landable slice, reuse an existing mechanism,
avoid new files and parallel mutation, stop after the requested act, and keep context and output
small. An explicit override must name its scope and reason; it cannot override a hard invariant.

### Filing a queue row — the card template

Whoever files a work row knows its files and symbols at that moment; write them down instead of
leaving a later reader to re-derive them from prose. Text shape, one or two lines each, reasoning
after the six fields:

```text
ZIEL: one sentence — what changes
FLAECHE: repo-relative files · datei#symbol references (the change targets, not the proof)
DONE: one checkable sentence
VERIFY: the command or chain step that proves it
VERBOTEN: what the work must not touch or do
ROLLE: harness / model / effort
```

Both create doors (`POST /api/tasks`, `POST /api/self/tasks`) also take the same fields as an
optional `card{ziel, surface{files, symbols}, done, verify, verboten, size}` (`ROLLE` travels as the
top-level spawn triple; `size` is `klein`/`mittel`/`gross`, the row's weight against the land-wave
budget — absent weighs `mittel`). It is validated by `card-extract.ts#validateCard` against the row's repo;
any gap — an untracked path, an unresolvable symbol, a verify naming no chain step — is a 400 naming
it, and nothing is filed. A valid card's surface is read before the prose reading; without a card
nothing changes.

### Context self-management

Managing your own context is your job, not your caller's. Measured on this fleet (owner,
2026-08-30): response quality degrades noticeably from ~25 % of the window — far below the ~83 %
compaction cliff, which is a loss boundary, not a quality boundary. So know your fill: measure it
when you have a sensor, and report it honestly when you don't ("about half full" in your report
beats silence). The decision is dynamic, per assignment, never a timer: a short, bounded,
already-running act may finish past the band; new deep or open-ended work past ~25–30 % belongs in
a fresh agent, a handover, or back to your caller with what you have. Name the call in your
visible output ("at ~28 %, finishing this slice, then reporting") so the decision is inspectable.

**A LANE HAS ITS OWN EXIT FOR THIS, and it is not landing.** From ~40 % fill (`FLEET_LANE_MIGRATE_PCT`,
the threshold the server nudges a lane at; `FLEET_MIGRATE_PCT` is the master switch that arms the tick
at all) a lane hands the baton on instead of getting worse: finish the cut in hand, commit until
`git status --porcelain` is empty, file one `fleet-report` with status `handoff` (done / open / next
step / open numbers), then `POST /api/self/succeed`. The successor is a FRESH SESSION ON THE SAME
WORKTREE — same branch, same slot, same queue rows — and its first prompt carries the brief, the lane's
own `git log`, the clean-tree proof and that handoff text. An n-cut task is therefore a relay of several
sessions on one branch, not one session that degrades. Two consequences: an uncommitted tree is refused
(409 — the successor inherits the BRANCH, so anything uncommitted is lost), and nothing lands at the
handover; landing stays exactly where it was.

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

Ask `GET /api/self/gate` first with the lane's self token. Run the commands corresponding to
`localProof.steps`, in the returned order; the step names map one-to-one to the full-chain lines
below (`install`, `pins`, `tsc`, `build`, `clean-review`, `security`, `claude-gate`). The response's
`classifiedAs` explains which rule each changed file selected. If `localProof` is `null` or the
route is unreachable, run the full chain below. Every selected step must pass; stop at the first
failure.

The server-side land gate remains authoritative: it runs its full configured chain except that,
since 2026-08-25, a docs-only land in THIS repo runs the short `install` + `pins` proof; since
2026-09-04 a docs-only land gets that same short chain in the post-land audit as well, and there
the question is asked of the whole coalesced entry — EVERY land it covers must have passed the
docs-only gate, otherwise the audit runs the full suite. A proportional entry is never offered to a
remote helper and never waits for one. Local proof and the land gate use the same classification
source.
The short proof is this repo's own chain — `bun e2e/pins.ts` is a file only this tree has — so
since 2026-08-26 it is only ever chosen here: a land in another repo runs that repo's configured
chain unchanged, docs-only or not, and its note stamps that full chain rather than the two steps.
The guard inside the short proof stays as a second line: a tree it does not recognise makes it
decline out loud — verdict SKIPPED, never a red gate over a tree nothing looked at.

The full chain, copyable and in order:

```sh
bun install --frozen-lockfile
bun e2e/pins.ts
bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun \
  e2e/pins.ts src/client.ts src/share.ts src/helper.ts server.ts fleet-e2e.ts fleet-e2e-claude-gate.ts \
  fleet-e2e-clean-review.ts fleet-e2e-security.ts fleet-e2e-postland-audit.ts \
  fleet-e2e-harness.ts merge-prompt.ts
bun run build
./e2e-clean-review.sh
./e2e-security.sh
./e2e-claude-gate.sh
```

**Judge a suite by its TAIL, never by a remembered check count.** A clean run ends in `ALL PASS`.
Anything else is a failure, including a run that ended early. Quote the tail in your report; do not
paraphrase it.

For the recommendation flag, `isolatedPreview: true` means run the preview; `"self-assess"` means
apply the existing merge-/land-path self-assessment in the rule below.

`./e2e-isolated.sh` is the slow tier and is NOT part of the above. It is owed only if you touched
the `e2e/` lifecycle, a suite wrapper, the merge/land path, or a statement some check asserts
(`supports.*`, `effortLevels`, a contract default) — a brief line demanding it does not widen this
rule, and a docs-only lane never owes it. When it is owed and a helper is online (`GET
/api/self/gate` carries `helper`), OFFER it first (`POST /api/self/suite-offer`) and go idle: the
verdict is delivered into your pane. Run it locally only after the offer's wait budget expires (or
when the run proves a repair to the suites themselves), in the foreground with a timeout — never in
a `sleep` loop over a log. Suites take a shared mutex, so a run may wait a long time before it
starts — that is normal, not a hang.

Never kill a suite run by name pattern. The server runs the same script for its post-land audit, and
a pattern kill takes that down too, which records a red audit that measured nothing. Kill your own
run by the PID you noted, or not at all.

## Landing

Your work reaches `main` through a server-side land, not through anything you run.

- Commit your work. An uncommitted change is invisible to the land.
- Leave NO untracked files in the tree — they block the land. Scratch files belong outside the repo.
- Do not touch anything outside this working copy. Other repos, shared config, ports and sockets are
  shared reality: stop and report instead.
- If a report you filed was REJECTED, the land door refuses that work by name — the refusal quotes
  the report id and the receiver's reason. A rejection is never re-decided, so the way on is: repair,
  file a NEW report, and let the receiver accept that one. A lane that filed nothing, or whose report
  is still unjudged, lands exactly as before.

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

Graphify in a lane: `graphify-out/` is git-ignored and exists only in the main checkout, so a
worktree never has its own graph — a missing graph under that ignored directory is the normal
state, never a stop. A brief line like "graphify query before raw search" means: query the main
checkout's graph read-only via this command (the derivation works from any worktree):

```sh
graphify query "<question>" --graph "$(dirname "$(git rev-parse --git-common-dir)")/graphify-out/graph.json"
```

If that fails for any reason, fall back to
`rg`/`ast-grep` and keep working — never file a needs-main report over a missing graph. Read-only:
never run `graphify update`/`save-result` from a lane against the main graph.

## Reporting

Summary, the quoted verification tails, and one line for anything left unresolved. Report only your
slice. The report body is `{status, text}` and nothing else; `text` is at most 4000 characters
(`MAX_FLEET_REPORT_TEXT` in `server/types.ts`) — write it to a scratch file first, check `wc -c`,
then POST once. Numbers and long tails belong in the tracked note or commit body, not in the report;
the report points at them. If you changed `CLAUDE.md`, say so as TEXT in the report — it is git-ignored and your copy
dies with this working copy, so someone else has to carry the change over by hand.
