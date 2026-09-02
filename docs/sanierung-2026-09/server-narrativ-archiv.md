# server.ts — Narrativ-Archiv (Generalsanierung 2026-09, P3)

Ausgehobene Kommentare aus `server.ts`, **im Original-Wortlaut** (nur das `//`-Praefix ist
entfernt; Zeilenumbrueche und Einrueckung sind die des Baums, aus dem sie kamen). Dies ist ein
Archiv, keine Nacherzaehlung: hier steht die Historie, die Herleitung und die Messgeschichte, die
am Code nur noch als Ein-Satz-Invariante plus Verweis hierher stehen.

Verweise heissen `server.ts#symbol`, nie `server.ts:zeile` (Owner-Promotion 2026-08-25). Die
Boot-Sektion hat keine Funktionssymbole; ihre Ueberschriften heissen `boot: …` und der Verweis
im Code nennt den Anker der Ueberschrift.

Die Datei waechst ueber die P3-Slices weiter — jeder Slice haengt seine Symbole an.

## Slices

- **Slice 1** (`slotCmd`, `ensureSlot` → `openSlot` → `teardownSlotOccupant` bis `sendText`,
  Boot-Sektion) — Basis HEAD `67b2265`, Lane `fleet/260902012020-3ff5`.
- **Slice 2** (Watch-Typblock, `commsFor` → `createWatchForSlot` → `armProgramMainLandWatch`,
  `tickAutos` → `dispatchTask` → `briefAndSend`, `tickWatches`) — Basis HEAD `bd0aaae`, Lane
  `fleet/260902023103-a878`.

## slotCmd

### Kopfkommentar von slotCmd

```text
when the slot actually runs claude, pin its session id so the transcript path
(~/.claude/projects/<cwd-slug>/<uuid>.jsonl) is known instead of guessed by mtime
model names are validated at SET time (MODEL_RE, the open/lane routes) — this string is
baked into a shell line, so nothing unvalidated may ever reach it

This is ALSO the claude adapter's spawnCmd (see HARNESSES below, which calls this very
function rather than restating it): a slot that chose no harness is spawned by exactly the
code that spawned every slot before harnesses existed, so "byte-identical" is a property of
the call graph here, not a claim someone has to re-check by reading two implementations.
```

## agentCmd

### Kopfkommentar von agentCmd

```text
the AGENT invocation alone — no PATH export, no `; exec $SHELL` fallback. Split out of slotCmd
for exactly one caller: the container adapter wraps THIS line in a `docker exec` rather than
restating the flag rules, so "the sandboxed slot runs the same agent the fleet runs" is a
property of the call graph instead of two implementations someone has to diff.
```

### Modell-Quoting (`--model`)

```text
pin the fleet's base model whenever the slot has none of its own — otherwise claude
inherits the owner's ambient /model default (how a lane once span up on the wrong model).
single-quoted: the 1M context variants are spelled `claude-opus-5[1m]`, and tmux runs this
string through default-shell — /bin/zsh here, which ABORTS on an unmatched glob ("no matches
found"), so an unquoted [1m] would kill every new pane at spawn. MODEL_RE forbids `'`, so a
plain single-quote wrap is closed, not merely escaped.
```

### Effort-Flag (`--effort`)

```text
`claude --help`: `--effort <level>  Effort level for the current session (low, medium, high,
xhigh, max)`. Only when the slot pins one — with no flag claude keeps its own session default,
and that absence is what every claude pane spawned before this looked like, byte for byte.

Single-quoted for the SAME DISCIPLINE as the model above, NOT for the same necessity, and the
difference is worth stating because copying the reason would hide where the guarantee really
sits. The model needs its quotes: `claude-opus-5[1m]` is an unmatched glob and zsh aborts the
pane on it. The five effort levels are bare lowercase words with no metacharacter in them, so
an unquoted one would survive. What makes that safe is UPSTREAM and is the actual boundary:
effortOf() admits only a member of THIS adapter's effortLevels — a closed literal list, not a
charset — and the state-file rehydration re-judges a stored value against the same list, so
nothing else can reach this line. The quotes are what keeps that argument from depending on
the list never gaining a word with a metacharacter in it (e2e/pins.ts pins both halves).
```

### Fremd-Harness-Modellflag

```text
A declared foreign harness gets its model the same way, and under the same quoting rule — the
charset it was validated against (HARNESS_MODEL_RE) admits `*`, so the single quotes carry more
weight here than they do above, not less. No DEFAULT_MODEL fallback on this branch on purpose:
that constant is a claude model id, and pinning it onto a foreign harness would name a model
that harness has never heard of. A foreign slot with no model of its own passes no flag at all.
```

## MODEL_RE

### Kopfkommentar von MODEL_RE

```text
per-slot model (synergy-findings Tier-2): strict charset because the value lands in a
tmux shell command — never widen without revisiting slotCmd
the optional bracket suffix is the context-window variant (`claude-opus-5[1m]`) and is the ONLY
reason a shell metacharacter may appear here — it is anchored to the end, bounded, and alnum-only,
and every shell interpolation of a model string is single-quoted (slotCmd, summaryViaSession).
```

## ensureSlot

### Resume-Evidenz je Harness

```text
pane died but we know its harness-specific conversation evidence still exists →
self-heal RESUMES the conversation instead of starting a blank one.
Otherwise: fresh harness, fresh candidate uuid — only if WE win the has-session/
new-session race below (the 2s self-heal loop and a fresh openSlot() can race)

The EVIDENCE that a conversation is still there is harness-specific, and asking claude's
question of another harness gets the wrong answer in the direction that loses work. For a
transcript harness it is the .jsonl on disk (unchanged, and still the whole test for every
slot that names no harness). Pi's `--session-id` is itself create-or-attach evidence
(measured). Codex is stricter: its discovered id is necessary but not sufficient, so the
exact rollout filename carrying that id must still exist before every resume.
```

### healDetail — Klassifikation VOR dem Spawn

```text
WHY a heal could not resume, not just THAT it could not — the two causes are different
bugs: no-session = nothing was ever pinned (a non-claude BASE_CMD, or the openSlot race
this function's spawn-block comment predicts); no-transcript = a pin exists but its .jsonl
is gone, the one that would mean the durability promise is broken (slotstats.ts).
Classified HERE, before the spawn: the spawn block below REASSIGNS s.sessionId to the
always-truthy candidate, and reading it there collapsed the formula to "which BASE_CMD" —
no-session became unreachable and every race heal read as a broken promise (b7d449a0,
found by the inspection pulse on the first day of the measurement it poisoned).
```

### selfExport — die Self-Credential fuer JEDE Session

```text
self-scheduling credential: EVERY session with a cwd gets it, lane or not. It can check in
on itself later and read its own row, scoped to exactly this slot, without ever touching the
owner token. This used to be keyed on `s.worktree`, and that carve-out was never a security
boundary — `selfToken` is minted for every slot (openSlot) and persisted for every slot
(saveState), and the routes below already AUTHENTICATE a plain session's token: measured
2026-08-07 against the live server, a plain slot's credential answers /api/self/gate 409
"not a lane", where an unknown one answers 401. The server recognized the principal all
along and simply never handed it to the pane, so what the widening adds is one export line,
not a new credential class. What it grants is the self-PLANNING family — /api/self/autos
(which has no lane check at all) and /api/self (its own row). The two lane-only questions
keep their 409s and MUST: a plain session has no integration branch to be measured against
(drift) and no land for a gate to judge, so answering them would be answering nonsense.

The real widening, named honestly: a plain session in a FOREIGN repo now holds a Fleet
credential it did not hold before. Its entire reach is scheduling prompts into its OWN pane
(AUTO_MAX_PER_SLOT, AUTO_MIN_EVERY_SEC, the mandatory run cap, and the perpetual-403 all
still apply) — and it is smaller than the status quo it replaces, in which a session whose
cwd is the install directory simply reads the owner token out of fleet.json. This closes no
hole (same uid, same file); it removes the reason to walk through it.

The ⚙ steward is included deliberately (it lands here because its cwd is set and its
`s.worktree` is null — a physical git worktree Fleet did not create). Its pane already
carries FLEET_STEWARD_TOKEN, which is strictly broader: it reads every session and sends
into other slots. Withholding the NARROWER credential from that one pane protects nothing
and would only deny the longest-lived session on the board the ability to schedule its own
next look — which is precisely what a watching role needs most.
```

### stewardExport

```text
the steward principal's scoped token, baked with the same exposure as FLEET_SELF_TOKEN
above but keyed on the steward LABEL (not the worktree flag): the pane that is currently
the ⚙ steward can then self-serve /api/steward/* (the Rundgang) without the owner token.
Env is only injectable at spawn, so a live relabel takes effect on the pane's next
(re)spawn — identical semantics to FLEET_SELF_TOKEN, never patched into a running pane.
```

### Session-Pin nach dem Spawn

```text
record the pin only if the adapter actually PASSED it. For the default adapter this is
still exactly `is FLEET_CMD claude` (CLAUDE_HARNESS.pinsSession), so a stand-in command
keeps recording none; a harness that takes a session id records one and can resume.
A Codex resume id was discovered after fresh spawn rather than passed at fresh spawn.
Preserve it across this heal even though pinsSession correctly remains false. Only a
deliberate openSlot recycle clears it before reaching here.
```

### backfillProgramMainSessionId im Heal

```text
the same learn-site backfill as tickCodexRecovery's: a heal that carries a discovered
Codex id across a respawn is the third way a recorded `null` becomes knowable, and the
helper is a no-op for every other shape (still null, or already recorded).
```

### Groessen-Cache folgt tmux

```text
the size cache follows TMUX TRUTH, not the other way round: the in-memory cols/rows
die with every server restart (deploys!) while the pane keeps whatever the last
owner client set — a guest reading the stale 200×50 default then renders a terminal
that has nothing to do with the actual pane. Re-sync on every ensure.
```

### Legacy-Stream sN.raw

```text
A live pre-migration pipe wrote sN.raw. Once its exact pane pipe is closed, the capture below
contains that pane's whole history, so deleting the ambiguous compatibility file loses no
rendered terminal state and prevents a later occupant from ever inheriting it.
```

## openSlot

### Kopfkommentar — der Dispatcher-Riegel

```text
`harness`/`effort` default to null — i.e. the claude adapter — and that default is the
DISPATCHER'S BOLT, not a convenience. Pi has no permission layer (see PI_HARNESS.note), and
whether an autonomous lane may run without one is an owner decision that has not been made — so
this fails closed by construction rather than by a check that a later caller could forget.
WHERE THE BOLT NOW SITS, corrected: dispatchTask does hand a harness through, because the
attended ▸ start button may name one (a task started the /api/lanes way keeps no queue link,
which is the whole reason that plumbing exists). What is unattended is not the FUNCTION but the
CALL: tickDispatch passes no `spawn`, so the tick still reaches only this default — and
dispatchTask now carries the same two-condition refusal every other unattended path uses, so
the guarantee no longer rests on an absence alone. An attended dispatch may carry effort too;
the tick's DEFAULT_SPAWN keeps that choice null, alongside harness and model.
```

### Parameter `box`

```text
one trailing parameter rather than two, because the pair is never chosen apart: a container and
the daemon it lives on are one decision, and a positional list where the caller can pass the
second and forget the first is the argument-order bug this shape cannot have. Defaulted, so the
three callers that spawn no container (attach, the dispatcher, a plain open) say nothing at all.
```

### Shares vor dem Teardown schliessen

```text
a share must not outlive its session (same invariant killSlot enforces) — recycling
an active slot onto a different cwd must not leave an old guest link/password
pointed at whatever the slot becomes next. Also BEFORE the teardown below, and for the
same reason as the detach: killSlot closes guest sockets with its default 4001, which the
guest UI renders as "this share was revoked" (src/share.ts). A recycle is a session END —
close them here with 4000 so the guest is told the truth.
```

### Recycling eines AKTIVEN Slots

```text
Recycling an ACTIVE slot: ensureSlot below only builds a pane when none exists, so without
this teardown every write in this function (cwd, model, the rotated selfToken, the cleared
history) would be state-only fiction laid over a pane that keeps running in the OLD directory
with the OLD env baked in. Observed live 2026-07-25: the board reported the new cwd while
`pane_current_path` was still the old one, and the session's self-scheduling route 401'd
against its stale FLEET_SELF_TOKEN. The pane is the ground truth, so PROBE THE PANE rather
than s.cwd — state and tmux can disagree (an adopted pane, a kill that failed). Deliberately
placed after the cwd validation: a bad path must never destroy a running session.
```

### awaiting zuruecksetzen

```text
a stale wait must not outlive the session it was about. killSlot clears it, but the branch
above only runs when a pane still EXISTS — a slot whose pane already died would otherwise
hand its "waiting on the owner" to the next occupant, silently muting the steward there.
Same lifetime and same reason as the mission below.
```

### Label beim Spawn

```text
a fresh session gets a fresh identity — but the caller may name it AT SPAWN, which is the
only moment a label-keyed env export (FLEET_STEWARD_TOKEN, see ensureSlot) can be baked in;
open-then-rename always arrives after the pane's env is fixed
```

### worktree vor ensureSlot

```text
worktree is set BEFORE ensureSlot spawns the pane below. The coupling that once made this
ordering load-bearing is GONE — the pane's FLEET_SELF_TOKEN export used to key on this very
flag and no longer does (see selfExport in ensureSlot), so a later patch-up would no longer
cost the lane its credential. Kept in this order anyway: the slot's row must be whole before
the session that lives in it starts, and nothing below should have to ask which half is set.
```

### parkMergeVerdict

```text
a recycled slot must never show a previous lane's merge verdict — but a reviewable verdict
follows its BRANCH into the park (see parkMergeVerdict), and comes back the moment this
open IS that branch's reattach. Park before restore, so reattaching the same lane into the
same slot round-trips instead of deleting.
```

### gitInfo.delete — done-looking und auto-③

```text
...nor its GIT facts. killSlot leaves gitInfo behind for tickGit's `if (!s.cwd)` branch to
reap (≤10s later), so a slot recycled inside that window would otherwise serve the PREVIOUS
lane's {dirty:0, ahead:N} for the new one. That is not cosmetic: `done-looking` is computed
from exactly these facts (laneSignalView), killSlot resets lastOutput to 0 so the idle clause
reads "quiet forever", and aliveInfo/gitOpInfo are refreshed BEFORE gitInfo inside a single
tickGit pass — so a brand-new, empty lane could read done-looking and auto-③ would file a
review of a diff that does not exist yet ("no code changes in scope") against it. Dropping
the entry makes the fact UNKNOWN until the tick computes it for this cwd, and an unknown is
never permission to act (lane-signals.ts: null git → not done-looking).
```

## detachSlotTasks

### Kopfkommentar

```text
a task's `sent` state is only meaningful while ITS lane lives in that slot. On any
teardown/recycle the link must be resolved, or the task re-runs after a restart
(duplicate work) or silently attaches to whatever lane occupies the slot next.
Landing marks the task done BEFORE killSlot runs, so this only catches real aborts.
```

## teardownSlotOccupant

### Kopfkommentar — `why`

```text
`why` is mandatory: a session's lifetime is uninterpretable without it — a median of minutes
means slot recycling if the kills are `reopen`, and abandoned work if they are `owner`. Every
call site knows its own reason; none of them may pass it as an afterthought (slotstats.ts).
```

## sendText

### SEND_BOOT_FRESH_MS / SEND_BOOT_WAIT_MS

```text
These answer different questions. Fifteen seconds says how long after openSlot a pane may still
plausibly be booting on a loaded machine; three seconds says how long an interactive send may
WAIT once that fresh pane fails its first probe. The price is explicit and bounded: during the
freshness window a send to a dead agent may still wait up to SEND_BOOT_WAIT_MS and write one
send_boot_timeout row. That exposure ends after each slot opening instead of taxing every later
owner send forever. Timeout deliberately falls through to delivery: the owner may be typing into
a pane whose agent died, and that capability must not be turned into an alive gate.
```

### DEFAULT_BOOT_SETTLE_MS

```text
Unknown adapters get one short terminal/redraw beat, not Claude's estimate by accident. 250 ms
is deliberately low because no readiness measurement exists for them; Claude declares the only
measured anchor (2500 ms) on its adapter above.
```

### READY_WAIT_MS

```text
The dispatch tail's budget for a readiness-declaring harness to show its accept marker (codex
renders its header box in ~0.3–0.7 s, measured 2026-08-12 — 20 s is machine-load headroom, not
an estimate of the boot). Env-tunable for the suites only, same reason the scheduler ticks are:
a timeout counterprobe cannot poll for a non-event without owning the window's width.
```

### ACP-25-Banner — Acceptance

```text
--- ACP-25: acceptance is OBSERVED, never echoed -------------------------------------------------
ACP-21 (docs/messungen/acp21-prompt-annahme-2026-08-22.md) reproduced on the real claude TUI that
the one Enter after a collapsed multi-line paste is intermittently lost (2/7): the text stays whole
in the composer and the receipt still said submitted:true. On 2026-08-22 the same family hit an
established Codex pane (event 461e14d65a57722aaa496564, the whole message left in the input).
Process-alive, header readiness and lastOutput-idle prove nothing about prompt acceptance; the
only rendered fact is whether the composer DRAINED. So sendText reads the pane, before and after:
  "observed"        the composer was on screen and empty after Enter — the TUI took the turn.
  "not-observed"    the composer is still holding text after the window: THROWN, so every caller
                    lands in the uncertain branch it already has. No replay and no second Enter —
                    both could mix owner text, start an empty turn, or fire twice.
  "unobservable"    no composer line could be located in the window (a dialog, a stand-in binary
                    that renders none): typed, not contradicted, and never claimed as observed.
  "not-applicable"  the adapter declares no composer, or submit was not requested.
Pre-paste the same read refuses an OCCUPIED composer — an owner draft that a paste would append
to and Enter would send as one turn. Thrown before anything is typed, so it is plainly retryable.
```

### OWN_PASTE_QUIET_MS

```text
FLEET'S OWN EVENT PASTE IS NOT RECEIVER ACTIVITY. An event-transport send (rollbackOwnPayload)
pastes, waits for arrival, presses Enter, waits for acceptance and may erase its own text again —
every byte the pane paints meanwhile is a repaint Fleet caused, exactly like the resize jiggle
`quietUntil` already covers. Counted as output it refreshed the receiver's lastOutput once per
recovery paste and kept every other pending event for that pane behind the idle gate (the
starvation half of the 8ca8c38e incident). The window opens at the paste for the longest a send
can take and is cut back to a short tail the moment the send resolves, so a receiver that
genuinely starts working after an accepted paste is seen again within that tail.
```

### inputChain

```text
route through inputChain like raw keystrokes do — otherwise a compose-box send racing
concurrent WS keystrokes (mobile key row, live typing, direct terminal typing) can
interleave paste-buffer/send-keys with a concurrent send-keys, reordering pty input
```

### Vor-Paste-Lesung des Composers

```text
one frame, before anything is typed: an occupied composer is an owner draft (the dim
placeholder is stripped, so only typed content counts). Refusing here is the only honest
answer — pasting would append to the draft and Enter would send both as one turn. Read
BEFORE the boot block: a draft is a draft whatever the pane's age.
```

### Readiness ist ein Prozess-Fakt

```text
Readiness is a process fact, not an output fact: tmux may repaint before the agent emits a
byte, and an agent's startup banner may arrive before its TUI accepts input. `openedAt`
answers the separate question "could this pane still be booting?" without misclassifying an
established dead agent as a boot. Empty comms remains the intentional fast-path waiver.
```

### Die ERSTE Sonde ist der Boot-Diskriminator

```text
The FIRST probe is the boot discriminator: already alive means established and takes the
old send path with no settle. Settle belongs only to the transition this race is about —
not alive at first, then alive within the bounded wait.
```

### send_boot_timeout-Zeile

```text
No prompt text in the trail. This row says exactly what could have happened: delivery
proceeds (owner capability preserved), but the pane never became observably ready.
```

### ENTER ist die destruktive Haelfte

```text
ENTER IS THE DESTRUCTIVE HALF OF A PASTE and it may not be pressed on a payload that is
provably still arriving: the pre-2026-08-30 wait asked only for a NON-EMPTY composer, which
a paste one byte in satisfies exactly as well as a finished one — and one measured event
was submitted cut off at "… x-fleet-self-token from," mid-sentence. Only "partial" blocks
here. "differs" (a collapsed-paste placeholder, a foreign rendering) leaves completeness
UNPROVABLE, never disproven, so the send proceeds into the acceptance read it always had:
no invented delivery, and never a second blind Enter.
```

### Identitaet zuerst

```text
identity first, as every other probe here does: a slot that changed under the window
must report THAT, not a verdict about a payload nobody can attribute any more.
```

## rollbackOwnComposerPayload

### Kopfkommentar

```text
Rollback belongs only to a caller that marks the text as Fleet-owned. It is deliberately not the
default for /send or any owner draft. The fresh read is the authorization for exactly N BSpaces,
where N is Fleet's payload code-point count — never Ctrl-C, Ctrl-U, a broad clear, or another
Enter. Identity is checked before and after that read, and liveness must be observable. Any
appended/prepended/edited byte, collapsed-paste placeholder, missing composer or read failure
therefore leaves the pane untouched and returns an explicit uncertainty.
```

## awaitArrival

### Kopfkommentar

```text
Poll the composer until the whole payload is on screen, within the same window an acceptance
read gets. Returns the LAST answer, so "partial" means the paste was still a proper prefix of
Fleet's own text when the budget ran out — the one state that may block a submit.
```

## claimInstanceLock

### Instanz-Lock — Design und Restrisiko

```text
A second server over the same import.meta.dir is the corruption case data-audit-2026-07-27 item 9
names. STATE_FILE and every ledger derive from the DIRECTORY, not from FLEET_PORT/FLEET_SOCK, so
"I gave it its own port" isolates nothing: both processes write fleet.json, and CLAUDE.md records
a 2026-07-19 incident where an instance started in the main checkout adopted the live state and
respawned real sessions as duplicates.

The failure mode to design AGAINST is the opposite one: a pidfile left behind by a killed server
must never wedge a legitimate start. Every deploy restarts srv with `tmux kill-session`, and the
watchdog respawns blind — a fleet that will not come back up is worse than the problem being
fixed. So the lock is deliberately weak in the safe direction and only ever refuses when it can
SEE a live server:
  pid dead                        → stale, taken over, logged
  pid alive but not a `server.ts` → the pid was recycled; taken over, logged. `ps -o command=`
                                    is what makes that decidable — without it a recycled pid
                                    locks the fleet out permanently
  pid alive AND a `server.ts`     → wait REFUSE_GRACE_MS (kill-session immediately followed by a
                                    respawn means the predecessor is often still exiting), then
                                    refuse and exit non-zero
Residual, stated rather than hidden: two servers cold-starting on the SAME stale file can both
take it over. The read-back below makes the loser stand down in the common interleaving, but
O_EXCL cannot exclude against a file that is being removed. Nothing in Fleet starts two servers
in one directory (the watchdog is a single loop; each e2e wrapper uses its own $$ scratch dir).
```

### Gestrandete Temp-Dateien

```text
A SIGKILL can strand the unique temp between open and rename. Once this process owns the
directory lock, no live peer can still be writing one, so stale credential-bearing temps are
neither recovery input nor safe to leave indefinitely.
```

## boot: state restore

### helperClaims

```text
A CLAIM MUST SURVIVE A RESTART, and this is the load-bearing half of the whole rail. The
deploy ritual here is land-then-`kill-session -t srv`, ~10× a day: a claim that lived only in
memory would be erased by the most routine thing this machine does, the local drain would
pick the tree up at boot, and a helper that is still running the suite would report into a
fleet that had already audited it — a duplicate run, which is the one thing the owner named.
An EXPIRED row restored here is harmless: helperClaimOf reads it as absent and the sweep books
it at the next tick.
```

### laneSuiteJobs

```text
An offer restored here may be stale in three ways, and all three are handled by the ordinary
sweep rather than by a filter: an EXPIRED claim reads as absent (laneSuiteClaimOf), a lane
whose slot did not come back is reaped, and a settled row is evicted past LANE_SUITE_KEEP.
```

### helperDevices

```text
A row written before stage A has none of the four new fields and is restored unchanged —
they are all optional. The three foreign ones are re-validated rather than trusted: this file
is on disk, and a mode that is not in the closed set must not enter the map through the back
door just because it once got past a different version of the route.
```

### watches

```text
an armed watch MUST survive a restart — the deploy ritual is `kill-session -t srv` ~10×/day
(see STALLED_IDLE_MS's note), and a subscription that died with the process would be a
promise broken by the most routine thing this machine does.
```

### events (Legacy)

```text
Legacy state has no `events` member and therefore loads as an empty event trail. In
particular, an old spent Watch whose lastResult says "sent" is not upgraded into a
delivery claim: Fleet did not observe the typed event, delivery or acknowledgement.
```

### tasks — kind-Migration

```text
The 2026-08-10 kind migration is deliberately a load normalisation: legacy lane/note
rows become auftrag/notiz, already-migrated rows remain byte-stable on every reload,
and malformed/pre-field rows retain the old source-based safe default. The spread keeps
every unrelated field intact.
```

### tasks — spawn

```text
the persisted agent choice comes back through the slot loader's discipline
(loadTaskSpawn): registered harness only, model/effort re-judged against it,
malformed degrades field-wise to null and all-null to ABSENT — never to a pass.
```

### tasks — releasedBy

```text
rows released before this field existed stay ABSENT, and a malformed value degrades to
absent too — never to "owner". The whole point of the field is that a released row can
be told apart from one nobody recorded; a default would erase exactly that distinction
on the 89 rows already on disk, and a hand-edit must not be able to mint either verdict.
```

### tasks — files / filesOrigin

```text
the declared file surface degrades to ABSENT, never to an empty list: this feeds a
collision check, and "[]" there would read as "touches nothing" — a claim a malformed
state file must not be able to make on a row's behalf. Pre-origin rows keep the field's
old refine-confirm meaning. A persisted `derived` value is dropped and recomputed from
prose instead of being promoted to the stronger source on reload.
```

### tasks — brief

```text
a hand-edited state file must not smuggle a "ready" verdict the sweep never wrote —
anything malformed degrades to "not yet analysed", never to a pass. The predecessor
field (`eval`, verdicts "auto"/"review") is deliberately NOT migrated: its criteria
were judged against the raw draft under a different contract, and re-deriving costs
one sweep. Dropping it is how the rewrite avoids inheriting a claim it cannot honour.
```

### tasks — analysis.retry

```text
the failure record degrades to absent, like every other malformed field here. It
only ever ADDS a warning to a row, so a dropped one costs a label, never a pass.
```

### tasks — refine

```text
a malformed proposal degrades to "none proposed": confirming one mints new task rows,
so the same rule as the criterion applies — the state file must not be able to smuggle
in a shape the worker never produced
```

### tasks — comments

```text
comments carry no authority — they are read by people, never executed — so a malformed
entry is simply dropped rather than degraded to something. Capped on the way back IN
for the same reason `mission` is: the state file is on disk and a hand-edit must not
widen a field past what the route would have accepted.
```

### programs

```text
Programs are a durable owner bracket, but old state has no such member. Absence therefore
stays the initialized [], with no provenance inferred from slots or tasks. Valid rows are
reconstructed from their declared fields so extra hand-written keys are never persisted.
```

### supervisor

```text
The Supervisor binding gets the same tolerance every other state member gets: absent OR
malformed loads as null, never as a half-binding. A partial row would name a slot without a
session identity, and every consumer joins on slot+openedAt — so half of it is not a weaker
fact, it is a different one.
```

### slots — harness vor model

```text
the harness comes back BEFORE the model, because it is what the model is judged by:
restoring them the other way round would validate a Pi slot's `provider/id` against
claude's charset and silently drop it, leaving the pane to respawn with no model.
Only a REGISTERED id survives a reload — a hand-edited state file must not be able to
name a harness the server has no adapter for (harnessOf would fall back to claude and
the slot would quietly respawn as a different agent than the row claims).
```

### slots — Codex-Id

```text
A discovered id is the only Codex value that may ever reach a shell line. Old or
hand-edited state is data, not authority: malformed UUIDs are discarded here and
again refused by the resume formula.
```

### slots — container/containerContext

```text
...and the box, judged by the harness AND the charset on the way back in, for the reason
the model above is: the state file is on disk, and a hand-edit must not be able to put a
value into a tmux line that a request could never have put there. A rejected value stays
absent, which is the default box — never a half-restored one.
```

### slots — releasedBy

```text
the release survives a restart with the lane it started — a deploy in the middle of a
lane's life must not turn its outcome row into "cannot say". Only the two recognised
values come back, same stance as `awaiting` above: a hand-edited state file must not be
able to book a lane as machine-released after the fact.
```

### backfillProgramMainSessionId — die vierte Lernstelle

```text
THE FOURTH LEARN SITE, and the only one that heals a binding that is ALREADY stuck. The
three live ones fire the moment a pane discovers its id; a fleet whose pane learned before
this code existed has that moment behind it forever, and its `null` was persisted. Here both
halves are in memory for the first time — programs load above, slots load in the loop just
closed (including the codex normalization that can put `sessionId` BACK to null, which is why
this runs after the loop and not inside it). Same helper, same three refusals, so a boot can
no more overwrite a recorded identity than a live learn can. No save: the value is now what
every ordinary saveState will write, and a boot that dies before one simply does this again.
```

### dispatch-Toggle

```text
dispatcher toggle survives deploys — queued tasks persist, so the thing that
drains them must too (the silent off-after-restart was the cols/rows bug's twin)
```

### repoWorkers

```text
Per-repo worker overrides, RE-VALIDATED on the way in rather than trusted. The route
already checks, but this file is hand-editable and the value gets SPAWNED, so the same
stance as `awaiting`/`harness` above applies with more at stake: a state file must not be
able to name a worker nothing reads, nor a path that has since been deleted or lost its
+x. A rejected entry is LOUD and then inert — the repo falls back to the env default,
which is the previous behavior, but the owner configured this expecting a different model
and a silent revert is exactly the surprise the log line exists to prevent.
```

### mergeParked

```text
...and the branch-keyed park (see parkMergeVerdict): verdicts whose slot let go before a
reattach. Only the reviewable shapes are ever parked, and the key must equal the row's own
branch — anything else is a torn write and is dropped.
```

### undoLands — Migration

```text
undoable lands survive deploys — the reversibility pointer must outlast a restart, or a
deploy right after a land would silently strip the owner's one chance to undo it
MIGRATION, and it is load-bearing rather than cosmetic: the pre-stack shape was ONE record
per repo (`undoLands: { "<repo>": {…} }`), and the deploy ritual restarts this server ~10×
a day. A boot that only understood the array would read every land recorded before the
upgrade as "no land", silently deleting the owner's undo at exactly the moment the upgrade
was meant to widen it. A bare object is therefore read as a one-element stack.
```

### landPending — prov.actor

```text
the marker's provenance rides back as it was written, EXCEPT the actor, which is
JUDGED: a marker from a binary that predates the field would otherwise finish its
land at boot with an `undefined` where the note promises an attribution.
```

### catch — beschaedigte fleet.json

```text
Keep the evidence — but under its OWN name. `.bak` is now written by saveState from the
last file that PARSED, so it is the recovery source; copying the damaged file over it here
(as this did) destroyed the only good copy at exactly the moment it was needed. Empty state
means the token below is minted fresh: every bookmarked URL, share link and lane selfToken
dies at once, so the log line has to name the file that gets them back.
MOVE, not copy: the next saveState copies whatever is at STATE_FILE into .bak, so leaving the
damaged file in place for even one save would overwrite the good .bak with it — the very
regression being fixed. Gone from STATE_FILE, that copy fails harmlessly and .bak survives.
```

## boot: tmux adoption and reconciliation

### finishLandsInFlight

```text
a deploy that killed srv between "main moved" and "the land is recorded" owes a note, an undo
record and a tier-2 audit for a commit already on the integration branch. Settle that before
anything else can move main again.
```

### sum-*-Sessions reapen

```text
background-claude sessions (summarizer/enhancer/merge agent) are throwaways whose
cleanup lives in a process-memory finally — a deploy mid-run skips it and leaves a
write-capable agent running invisibly (it matches no slot regex, shows nowhere).
Boot is the safe reaping point: any survivor here is by definition orphaned.
```

### watches-Filter

```text
same rule for a watch, on BOTH of its slots: a receiver that didn't come back has nobody to tell,
and a target that didn't come back has no news to give. The identity re-check (cwd + branch) is
the one that matters across a restart — a slot id that came back holding a DIFFERENT lane must
not inherit the subscription.
```

### merge-Watches

```text
Preserve the legacy lane-watch boot rule exactly. Merge subscriptions stay visible when the
target vanished: the land site should already have minted their durable event, and if it did
not, the first watch tick disarms the row loudly instead of deleting the evidence.
```

### fleetEvents — Owner-Zeilen (B4)

```text
An event does not disappear merely because its transport endpoint did. Bind it to the exact
restored occupant; an absent/recycled receiver is a durable terminal fact visible to the owner.

AN OWNER ROW HAS NO ENDPOINT TO LOSE, and that is why it is skipped rather than tested here.
`fleetEventReceiver` answers null for it BY CONSTRUCTION — there is no session, no generation,
nothing that could have been replaced — so running the test would read "the receiver is gone"
off a row that never had one and quietly bury the owner's unread report at the next restart.
Measured: B4 survival went `inbox` -> `receiver-gone` across exactly this loop, which then
zeroed ownerInboxDebts() and let the ceiling accept a 26th row.
```

## boot: slot rehydration

### lastOutput = Boot-Zeit

```text
...and the same restart must not leave the pane looking IDLE SINCE THE EPOCH. `offset` is
stamped so that everything written before now is not replayed as new output — but `lastOutput`
stayed 0, so `now - s.lastOutput` read as ~1.79e12 ms for every restored lane until its next
byte. Two consumers ACT on that number, and both were therefore disarmed by every deploy:
canDeliver's busy gate (the one guard that keeps an auto, the merge author wake and a steward
nudge from pasting into a WORKING pane) and the idle clause behind auto-③ (lane-signals.ts).
A pane blocked on a long tool call is exactly the case that stays quiet AND must not be typed
into. Boot time is the honest reading — this process has observed nothing yet, so idle is
counted from when it started looking, the same "unknown is never permission" rule the pulse
text already follows for lastOutput 0 (see pulseLastOutput's idle line).
```

## boot: audit rehydration

### lastPostLandAudit

```text
rehydrate the newest post-land audit row (tier 2). A red audit is typically followed within
minutes by the deploy that restarts srv — an alarm a restart erases is not an alarm. The TRAIL
is the durable record either way; this only restores what the board polls.
NOTE (2026-07-27): this is the one remaining single-generation ledger read. It belongs on
readEventLog like every other — a boot landing just after a rotation finds the live file empty
and shows the board no alarm at all — but the lines it would rewrite sit inside the boot hunk
lane b5e6 owns and has not landed yet, so it is left alone deliberately rather than merged
blind. Bounded blast: the TRAIL is unaffected, only what the board rehydrates.
```

### recordAuditDuration-Seeding

```text
...and seed the RUNTIME DISTRIBUTION from the same trail. Rotation-safe (readLedger reads both
generations), unlike the single-generation read above — this one has no half-landed hunk in its
way. Without it the first audit after every restart would show an elapsed clock with nothing to
read it against, which is the state this whole surface exists to end: srv is restarted by the
deploy ritual precisely when lands are frequent, so "just after a restart" is the common case,
not the rare one.
```

### backfillUnknowableAudits

```text
the one-shot migration that retires the reds nobody can ever answer (see backfillUnknowableAudits).
Fire-and-forget: it reads two ledgers and appends at most a handful of rows, and nothing at boot
waits on the result — an un-backfilled red is simply an un-adjudicated one.
```

### Audit-Queue wieder aufnehmen

```text
...and resume the PENDING side of it. Everything still on the queue file is a land whose audit
never produced a row: queued behind a running suite, or in flight when the process died. Both
re-enter the drain here, against the CURRENT integration tip — which is not a compromise but the
coalescing rule already stated above: the suite measures a TREE, not a diff, so auditing the
newest tip subsumes every land folded into it, and `covers` still names them all. A restart is
just a longer fold-up.
```

### UNCONFIGURED ≠ SKIPPED

```text
UNCONFIGURED ≠ SKIPPED, the verify gate's three-valued stance: a server booted without a
tier-2 command has not decided these lands are fine, it simply cannot measure them. So the
file is left byte-for-byte alone (nothing above loaded it into `auditQueue`, and nothing
can mutate it while the command is unset) — configure the command, restart, and it drains.
```

## boot: scheduler ticks

### THE SCHEDULER TICKS

```text
THE SCHEDULER TICKS, and the reason every one of them now names itself to logError: a tick that
throws has skipped its whole round — no auto fired, no task dispatched, no draft analysed — and
until now the `.catch(() => {})` here made that indistinguishable from a round with nothing to
do. These are the empty catches where silence hid a decision (see THE ERROR CHANNEL); the
`p.kill()` and pty-chain ones are left exactly as they are, on purpose.
```

### tickBriefSweep

```text
…and the brief compiler on its OWN cadence, off by default. Same stand-in warning as above and
it bites harder here, because this tick exists to run the enhancer: a harness without a
FLEET_ENHANCE_CMD stand-in MUST leave FLEET_BRIEF_MS at 0, or the suite spawns a real agent.
```

### helper-claim lapse sweep

```text
the helper-claim lapse sweep. Not on the 100 ms poll: a claim's granularity is 45 minutes, and
the DECISION whether a claim is live is already made by the clock (helperClaimOf) — this tick only
books the lapse, frees the bundle and restarts the drain, so being a few seconds late costs
nothing that matters.
```

## Watch

### Banner — warum es einen Watch gibt

```text
--- a WATCH: the event-triggered sibling of an Auto. Same delivery (one prompt typed into one
pane, through canDeliver), different trigger — a fact about ANOTHER slot instead of a clock.

WHY IT EXISTS. Fleet computes completion facts on the 2s poll; auto-③ consumes only the original
`doneLooking`, and every other consumer was someone who was already looking. So a session that
dispatched a lane and turned away had no way back except remembering to check. Measured twice on
2026-08-07: a driving session missed a finished 807-line lane for ~20 minutes, then replaced the
habit with a background `until`-loop — which fires once by construction and left the same hole on
the next lane. A watcher the RECEIVER has to re-arm fails exactly when the receiver is busy,
which is every time it matters. This one is armed on the server and survives a restart.

WHAT IT IS NOT: it delivers TEXT and nothing else — no commit, land, review or kill. The original
predicate remains idle+clean+ahead and carries its old warning; the host-commit sibling is weaker
and says that uncommitted+zero-ahead is intended and requires a host commit. Both remove a WAIT,
never a CHECK.

The trigger is LEVEL, not edge (tickWatches): either predicate is a standing property of the
target's facts, so a watch on an already-matching lane fires at once. Firing spends the watch
(`armed:false`); a target that
goes back to work and finishes again is a NEW question and needs a new watch. That is the narrow
reading on purpose: an armed-forever watch is a repeating nudge, and nothing here should be able
to type into a pane on a cadence nobody chose.
```

### WatchBase.delivery

```text
WHERE THE COMPLETION GOES, decided by the SUBSCRIBER at subscribe time and by nobody else.
Absent is the legacy pane default and is kept absent on load, byte-for-byte: pane delivery is
what every existing row asked for. "inbox" says the receiver is an owner-attended conversation
— typing a completion fact into that TUI lands it in the owner's composer, so such a watch
mints its event straight into the owner operations inbox and no transport ever touches it.
```

### LaneWatch.kind

```text
Absent on legacy persisted rows. Keeping it absent after load is intentional: those rows pass
through byte-for-byte and `watchKind` supplies their discriminator only while evaluating them.
```

### LaneWatch.targetCwd/targetBranch — Identitaet

```text
the target's IDENTITY at subscribe time, because `target` alone is not one: slot ids are
recycled, so an id-only watch would survive its subject and then fire about whatever lane
moved in next. Teardown drops watches already (dropWatchesFor); these two are the second
lock, and the tick refuses to fire on a target whose cwd or branch changed underneath it.
```

### TransitionWatch (STN-1)

```text
STN-1: the Supervisor→Controller transition rail. The ONLY Watch kind whose trigger is a
principal's act (the bound Supervisor completing it) rather than a level the tick computes, and
the only one with a deadline: a Controller that registers "wake me when X" must be able to read
"X never came" from its own row rather than wait forever. Same slot/occupant/idleSec/armed
anatomy as every other kind, so the transport, the cap and the teardown need no second ledger.
```

## commsFor

### Banner + Kopfkommentar

```text
--- scheduled prompts ---
a dead agent leaves its pane at a plain shell (`<cmd>; exec $SHELL`) — an unattended
prompt typed THERE would execute as shell commands. Only send when the harness's own
process still hangs under the pane process. (pane_current_command is useless here: it
reports the wrapper zsh even while the agent runs.) The gate applies to every DECLARED
harness, claude or not; an undeclared custom command is still intentionally whatever the
operator chose, and answers "unprobed" rather than a liveness claim nobody can support.
Which comms prove THIS slot's agent. The fleet-wide HARNESS_COMMS is now only the DEFAULT
adapter's answer (comms: null defers to it), so a slot running a named harness is probed for the
binary it actually runs. This is the whole per-slot repair, and it lives in one function so both
consumers — the git/alive tick and claudeAlive — cannot drift apart; e2e/pins.ts pins that neither
reads HARNESS_COMMS directly any more.
a `function` declaration, not a const arrow, and that is deliberate: tickGit() reads it from a
line ABOVE this one, and openSlot/killSlot reach tickGit at boot. A const would sit in its
temporal dead zone on that path and throw a ReferenceError only at startup — the same ordering
hazard projDir already documents one region up.
```

## harnessAutomatable

### Kopfkommentar

```text
May an UNATTENDED path drive this slot? Separate from "is it alive" on purpose — see the
HARNESS_AUTOMATION note above. A slot on the default adapter is unaffected forever (that is every
slot on this fleet today); a slot running a named harness is refused until the owner opts in,
whatever the probe says. Checked BEFORE the liveness probe by every gate, so the reported reason
is the specific one ("this harness is not automatable") rather than the generic not-alive it would
otherwise collapse into — being skipped SILENTLY was the expensive half of the original defect.
```

### harnessAutomatableFor

```text
The SAME question one level down — about a Harness rather than about a slot's harness. Extracted
when a second caller appeared that asks it about an adapter belonging to no slot yet:
releaseTaskForMain asks it about the harness the TICK would spawn for the row it is releasing.
Two conditions and the default-adapter exemption live here once, so the two gates cannot drift.
```

## claudeAlive

### Der unprobed-Waiver

```text
"unprobed" is the undeclared-command waiver this function has always granted — an operator who
never said what their FLEET_CMD leaves behind keeps exactly today's behaviour. A DECLARED
harness no longer gets it: that is the whole repair, and it is why "no-agent" now exists as a
distinct answer instead of collapsing into the same `true` a live claude returns. Note that a
named harness declares its comms through the ADAPTER, so it loses the waiver too — a pi slot on
a `FLEET_CMD=true` fleet is genuinely probed, where before it inherited the empty set.
```

## paneAgentAt

### AgentState — vier Antworten

```text
Why the pane has, or has not, got a running agent — four answers, because the two that used to be
one are the interesting pair: "no-pane" (nothing to type into) and "no-agent" (a pane that is
alive and accepting keystrokes, with NO agent behind it) are different failures and only the
second is silent. That is the state an unresolvable model produces: the harness prints its error,
exits, and slotCmd's `; exec $SHELL` catches the pane — pane_dead=0, prompts accepted, executed
as shell commands. Nothing could name it before this, for ANY harness including claude.

The pane process ITSELF can be the agent (a single trailing command makes sh exec it — unlike
slotCmd's `; exec $SHELL`, which keeps it a child), so both the pane pid and its children count.
```

### Die vierte Probe-Menge (Worker) — historische Parenthese

```text
(The fourth probe set — the worker session's — used to be a `claudeAliveAt` wrapper here, pinning
the literal ["claude"] a thousand lines from the spawn line it described. It now rides on the
adapter that BUILDS that line (Harness.worker), so the two cannot drift: an adapter whose worker
runs something else carries its own comms, and one that runs nothing carries none. Still four
sets, still literal for the default adapter — only no longer restated out of reach of its cause.)
```

## paneReadiness

### Kopfkommentar

```text
SCREEN readiness, the layer paneAgentAt cannot see: Codex block screens keep the
node wrapper alive, so the process probe answers `alive` while a paste would be silently eaten
(measurement and incident inference are separated in the adapter's `readiness` comment). null = this
harness declares no readiness and keeps today's behaviour: every adapter but codex, including
the default one, takes that branch and no gate below it may fire. "pending" is neither marker on
screen — a booting TUI, a redraw, a working agent whose header scrolled off — and is deliberately
NOT a refusal at the delivery gates (fail-open there; only the bounded boot wait in briefAndSend
treats it as not-yet-ready, per the owner's cut). A failed capture is "pending" too: the pane
gates next to this one own the no-pane answer.
```

## waitForFoundingReadiness

### Kopfkommentar

```text
Fresh founding prompts have a stricter readiness contract than established-pane deliveries:
when an adapter declares a ready marker, "pending" means keep waiting within the shared bound.
Both dispatch and Program-MAIN bootstrap use this one loop so a newly supported blocking screen
cannot be fixed for one founding rail while the other silently pastes through it.
```

## createAutoForSlot

### Kopfkommentar

```text
shared by the owner route (POST /api/slots/:id/autos) and the self-scheduling route
(POST /api/self/autos) — every guard rail (AUTO_MAX_PER_SLOT, min interval, mandatory
runs cap, idle gate downstream in tickAutos) lives here exactly once. The caller is
responsible for how `s` was derived; this function trusts it and never reads a `slot`
field from the body, so it structurally cannot create an Auto anywhere but on `s`.
```

## slotDeliveryBudget

### THE DELIVERY BUDGET

```text
THE DELIVERY BUDGET, IN ONE PLACE — the arithmetic three doors spend and two sights read.

Every receiver has a hard ceiling on how much undelivered future it may owe: open (non-terminal)
FleetEvents plus armed Watches, capped at FLEET_EVENT_MAX_OPEN_PER_SLOT. An armed Watch reserves
one future event, a delivered-but-unacknowledged one still holds its own, and when the two fill
the cap the minting doors refuse — the watch route with `max N active watches per slot`, the two
report doors with `… receiver has no FleetEvent delivery budget`.

`free === 0` is EXACTLY that refusal condition (debts + reservations >= cap), which is the whole
reason this is a function rather than three copies of one sum: a sight built on it can never
claim room a send would not find. Clamped at 0 because the sum is READ, never trusted — a cap
lowered under live rows would otherwise project a negative as "less than none".
```

### ownerInboxDebts

```text
The owner inbox half of the same arithmetic, and deliberately smaller: he holds no watches, so
there is nothing to reserve — only rows he has not yet acknowledged. `>= cap` is EXACTLY the
refusal condition of the fleet-report door, for the same reason `free === 0` is over there.
```

## createWatchForSlot

### Kopfkommentar — zwei Prinzipale, eine Frage

```text
mint a watch: slot `s` asks to be told, once, when slot `target` looks done. TWO principals now
reach this function, and the history of why is worth one paragraph: it was owner-only, on a
MEASUREMENT — FLEET_SELF_TOKEN used to be baked into a LANE's pane and never a plain session's,
so the session this feature exists for (a driving main checkout) had no credential to subscribe
with, and a /api/self/ twin would have been reachable by exactly the principal that did not need
it. That premise expired when every session with a cwd started carrying the credential (the
selfExport line in ensureSlot), and the twin was built: POST /api/self/watch, which derives `s`
from the token instead of the URL and then calls straight into here.

WHAT THAT DID NOT CHANGE — read this before adding a condition below. The self route carries its
own SUBSCRIBER rule (a lane may not subscribe; see the route) because that is a question about
the caller, and this function never sees a caller. Everything here is about the TARGET and is
identical for both principals. Same split as createAutoForSlot: the caller owns how `s` was
derived, this function trusts it and never reads a `slot` field from the body, so neither route
can put a watch anywhere but on `s`.

EVERY REJECTION HERE ANSWERS THE SAME QUESTION: can this watch ever fire? A watch that cannot is
worse than no watch, because it is a silent forever-wait — the precise failure this whole surface
removes. So a target the predicate does not classify is refused at CREATE time, loudly, instead
of being accepted and then never firing.
```

### STN-1-Registrierung — geschlossener Body

```text
STN-1 registration: a CLOSED body. The receiver is `s` (the token's own occupant) and the
completing principal is the bound Supervisor — neither is a body fact, so `target`, `slot`,
`programId` and the rest are refused BY NAME rather than ignored: a field that is silently
dropped reads to its author as if it had been honoured. `delivery` is in the refused set too:
the inbox is the owner's operations inbox, and a Controller's wake-up has no business there.
```

### Nicht-automatisierbare Harness — lane ONLY (Messung 2026-08-29)

```text
Measured live 2026-08-29: a finished GLM lane on pi-zai held an armed {kind:"lane"} watch
FOREVER. aliveInfo folds harnessAutomatable into `alive`, and BOTH looking predicates
require alive === true — so a lane whose harness the automation policy declines can never
be classified, whatever its pane does, and the tick's `stay armed, ask again` is a silent
forever-wait. The door refuses instead, in this family's one question. lane ONLY: a merge
watch reads the merge terminal factor below, not laneSignalView, and demonstrably fires on
exactly such a lane (2026-08-29) — rejecting it there would forbid a working watch.
```

### Budget-Reservierung

```text
An armed Watch reserves one future event slot. Delivered-but-unacknowledged and uncertain
events reserve theirs until the receiver closes them; otherwise repeated subscribe/fire
cycles could grow fleet.json without bound while the facts we may not prune accumulate.
The sum is slotDeliveryBudget's, shared with both report doors and with the sights that show
this budget — the refusal and the projection cannot drift apart while they are one function.
```

## mintTransport

### Kopfkommentar

```text
THE ENTIRE TRANSPORT SPLIT, in one expression every mint site spreads. The Watch's delivery
decides the event's own delivery fact AND its initial status: "inbox" is not a pending state, and
FACT 2 selects `pending` alone — so an inbox event can never reach sendText, the history append
or the prompt journal. That is a property of the state machine, not of an added guard, which is
why no site below needs to know about panes at all.
```

## armProgramMainLandWatch

### Kopfkommentar — das Event, das eine MAIN nie abonniert hat

```text
THE EVENT A BOUND PROGRAM-MAIN NEVER SUBSCRIBED FOR — and the reason it has to be minted on its
behalf. A MAIN learns a merge terminal through a Watch IT armed, and the self-land route hands it
the subscription only AFTER its own job started. So every land the MAIN did not itself start —
the owner's ⏏ or ⏫, an already-merged land, a confirm — reached a MAIN that had armed nothing,
and the row went `done` with no event addressed to anyone. The Program-MAIN then stood on stale
execution truth until a poll or a human nudge, with its next dependent task blocked behind it
(measured 2026-08-29 on program f99e9354, task 8e91fdc9 — the land itself was correct).

This arms exactly the subscription the MAIN would have made, in the receiver's name, at the one
moment the fact becomes terminal; the ordinary mintMergeEvents beside it spends it. NO second
lifecycle record and no second transport: what arrives is the same merge-terminal FleetEvent,
occupant-bound (slot + openedAt + sessionId) like every other one, acknowledged and pruned by the
same doors.

EXACTLY ONE, and each way that could break is answered here rather than downstream:
 · an already-armed merge watch of the SAME receiver occupant on THIS lane means the
   subscription exists — arm nothing, and that watch fires instead (one event, not two);
 · the receiver is the live occupant of the ACTIVE program the LANE belongs to, taken from
   clarificationReceiverFor's `program-main` basis and nothing weaker. Its lane-watch fallback is
   deliberately NOT honoured: a watcher who subscribed already owns a row here, and a foreign
   program or a recycled/succeeded MAIN slot matches no binding at all, so it gets nothing;
 · a MAIN whose return path is full is refused exactly as the two report doors refuse it, loudly
   in the trail rather than by growing a debt it cannot pay;
 · this runs once per terminal landLane, and a retry finds no lane left to land.
```

## tickAutos

### Policy-Refusal (harness)

```text
a POLICY refusal, unlike every other gate here, does not resolve by waiting: it holds
until the owner flips FLEET_HARNESS_AUTOMATION. So it is recorded and the run is spent
rather than retried in silence every interval — the silent skip is the defect this names.
```

### quiet-hours

```text
held inside the owner's quiet window and retried next interval (tick-in-place). No
staleness fast-forward is needed — advanceAuto reschedules now-relative, so an overdue
auto fires at most once, never a replayed backlog.
```

## dispatchTask

### dispatchingTasks

```text
tasks currently mid-spawn (tick or the manual start route): a task must never be dispatched
twice. Check-and-add happens synchronously before the first await, so two callers cannot both
win; the entry is removed once the row is `sent` (or the spawn failed) — from then on the
status itself carries the state.
```

### Kopfkommentar — clarify und spawn

```text
the shared dispatch core: spawn a fresh DISPATCH_REPO lane for `next` in `free`, flip the row
to `sent`, and hand back the async `tail` that compiles + gates + injects the brief. The tick
awaits the tail (serial by design, exactly as before); the manual route fires it and answers
the button in seconds — the row's status/note tracks the rest.
`clarify` opens the lane to SETTLE the done-criterion with the owner instead of executing
(owner ask 2026-08-05, the third answer to an eval:review verdict — see clarify-prompt.ts).
Owner-only by construction: no tick passes it, only the attended button does.

`spawn` is the same choice /api/lanes takes — WHICH AGENT runs the lane — and it exists here for
one reason: a foreign-harness lane started the other way (POST /api/lanes + a hand-sent brief)
leaves the queue row unlinked, so nothing requeues it on a failed spawn, no outcome row carries
it, and the row must be closed by hand. The default is the tick's shape and stays the default
adapter, byte-for-byte what every caller before this sent.
```

### taskSpawnOf

```text
THE ONE BRIDGE from a queue row to a spawn choice: the row's own persisted, SET-time-validated
field, DEFAULT_SPAWN on absence. Every unattended reader (the tick's dispatch call, the release
door's entry gate) goes through this accessor, so "which agent would this row run" has exactly
one answer — never a request value, never an env default (pinned in e2e/pins.ts).
```

### THE BOLT

```text
THE BOLT, restated where the choice now arrives. It used to be openSlot's parameter default
alone: the tick called the short form, so it COULD not name a harness. The tick now passes the
ROW's own persisted, SET-time-validated choice (taskSpawnOf, pinned in e2e/pins.ts) — and
exactly therefore this second lock carries weight: a stored foreign choice that reaches an
unattended call answers to the same two conditions every other unattended path answers to,
and in the same order, so the reason a start was refused is the specific one rather than a
generic failure. The tick's own row gate refuses the same rows BEFORE a slot is reserved and
writes why on the row; this lock stays for any caller that skips that gate.
```

### wasStatus

```text
captured BEFORE any mutation, restored on every failure path: an eval-auto row enters as
"pending", and flipping it to "queued" on a failed spawn used to promote its RETRY to the
owner path — uncounted by the day valve, ungated by the eval disjunct (found 2026-08-05).
Restoring the entry status keeps a task on exactly the path that admitted it.
```

### laneFormOf

```text
WHICH FORM the working copy takes, resolved through the same one function the two lane
routes ask. There is no request body here — the button sends no `form` and neither does the
tick — so this is exactly the "absence" branch: the harness answers, and for every adapter
but Codex the answer is the worktree this path has always made. Deriving it from `spawnH`
rather than recomputing the harness is the point: the dispatch route already resolved which
agent runs, and two derivations of one choice are how they come apart.
```

### dispatchRepo/anchor

```text
the task's own target repo wins; the env default covers every unbound row. Resolve and
choose the parent before materialising the tree, exactly like openLaneInSlot: dispatch is a
fresh-lane creator too, and must persist the same one-time same-repo decision.
```

### LaneRef ohne base

```text
no `base` here (the dispatcher lane keeps today's live re-derivation), but the fork
commit is still captured — the outcome record needs it after the land moves main
model/harness/effort ride in from the attended request or the row's own persisted choice
(DEFAULT_SPAWN is the absence shape and is the claude adapter); `label` stays null here
because the line below names the slot.
```

### syncLaneRefs

```text
A fresh clone's branch exists only in the clone — mirror it up NOW, for openLaneInSlot's
reason: until the root has the ref, every root-side reader (drift, risk, the land path)
reports an absence as a fact about the lane. A no-op for a worktree lane.
```

### releasedBy

```text
An attended click IS a release, and the only one that never passes through `queued` — this
route starts a `pending` row directly, so releaseTask never sees it. Stamped OVER whatever
the row carried: if an unattended promote released it and the owner then pressed ▸ start,
the lane that actually ran was attended, and a criterion counting unattended lanes must not
have it. The tick's own path (ownerAct false) writes nothing here — it only ever picks rows
that were already released, and inventing a value for a legacy row would be the guess the
field exists to refuse.
```

### finally — laneSpawn.delete

```text
release the spawn reservation ALWAYS — without this every dispatched slot stayed
in laneSpawn forever, unusable by the dispatcher, attach and manual open alike
until a restart (the sibling routes release in finally; this path didn't).
Safe to release here: openSlot has set free.cwd, so the slot is no longer "free" to
any picker, and the task's own state is carried by its status from this point on.
```

## briefAndSend

### Kopfkommentar — kein Modellaufruf mehr

```text
the dispatch tail: deliver the brief once claude is up.

NO MODEL CALL LIVES HERE ANY MORE, and that is the point. This function used to compile the
brief itself — runEnhance on the raw text, in parallel with claude's boot — while the eval gate
had already approved the RAW TEXT. So the string that was judged and the string that ran were
different, produced by a cheaper model, and nothing compared them. The brief is now compiled and
judged together in the analysis sweep and stored on the task; here it is sent with a freshly
derived ContextPlan anchor block. The stored brief itself is never rewritten with that projection.
Fallback stays the raw text: a lane with an unpolished brief beats a task that never runs.
`ownerAct` relaxes the AUTOMATION stops (master stop, quiet hours) on the delivery gates: an
explicit owner click is attended, not automation — the same "owner acts" carve-out canDeliver
documents. The claude-alive gate ALWAYS holds: a claude that failed to boot leaves a bare
shell that would EXECUTE the brief as commands. Never rejects — every failure requeues.
```

### DISPATCH_CONTEXT_CAPABILITIES

```text
Every normal worktree lane has the tracked checkout, Bun, git, the e2e harnesses, server.ts,
and the copied private overlay, so these six capabilities are real for every adapter. The two
deliberately absent capabilities are `task-queue-read` (a lane's scoped token cannot read the
owner queue) and `deploy-observe` (deploy facts are owner/steward-only); full host access is not
used to route around those API boundaries, and no capability probe is invented.
```

### clarify-Modus

```text
clarify mode ignores the compiled brief entirely: the enhancer turns a draft into a work brief
WITH a done-criterion, and a task that reached this button is precisely one where that cannot
be done yet. Deterministic frame + the raw request, no model call, no failure mode.
```

### Boot-Sleep

```text
let claude finish booting in the fresh pane before the first prompt lands; a brand-new
lane is idle by definition, but claude's own startup needs a moment
```

### requeue — transient, und die Lane geht mit

```text
A post-spawn hold is TRANSIENT (dead claude, slot changed mid-boot) — retry-shaped, so the row
goes back to `queued` and the dispatcher picks it up again. Under the advisory-gate design that
is the same destination for both paths: the tick only ever runs tasks the owner released, and
an attended start IS a release. (Deliberately unlike dispatchTask's catch, where the failure is
persistent — a bad repo — and the row goes back to the status it came from instead of looping.)
...and it takes the LANE WITH IT. The row going back to `queued` used to be the whole of this
function: the worktree it had just created and the slot holding it stayed standing, owned by
nobody — the task no longer pointed at them and no land would ever come. Every retry then
spawned another pair, so the one path in fleet that retries by design was also the one that
leaked. Teardown runs in landLane's order and for landLane's reason: the worktree FIRST, while
the slot is still intact, so a refused removal leaves a lane that is still fully recoverable
rather than a torn-down slot pointing at an orphaned tree.

THE EDGE, decided here rather than left implicit: a pane that has already produced something
is not disposable. removeWorktreeSafe is the existing answer and it fits unchanged — it refuses
an uncommitted tree and unpushed commits, with git's own `worktree remove` refusal behind it —
so a dirty lane is KEPT, slot and all, and the reason is written onto the row. A worktree
silently kept would be the same defect in new clothes, which is why the note carries it.

Two paths reach here with the slot no longer ours (identity lost during the boot sleep) or with
the tree adopted by another session; killing/removing then would end a lane this dispatch never
owned. Both are read from the live slot list rather than assumed, and `next.slot` is cleared
either way: a `queued` row must not keep pointing at a slot it has let go of.
```

### gateOpts — harness:false auf dem Owner-Pfad

```text
`harness: false` on the OWNER path, and only there — the same waiver land/⏫ author/💾 commit
already take, for the same reason canDeliver's own comment gives: the policy answers "may
something UNATTENDED drive this slot", and a click that named the harness is not that. Without
it an attended foreign-harness start is a lane that spawns and then never receives its brief:
the gate would hold, the row requeue, and the worktree be torn down — the automation flag
silently deciding an attended question. The ALIVE gate is not waived and is the one that
matters here: a pane whose agent failed to boot is a bare shell, and the brief would run there.
```

### claude-alive-Gate

```text
fresh claude-alive gate (was synergy-findings.md Tier-0 #2). Requeue on any failure — the
lane exists, the prompt waits. With the compile gone there is only ONE gate/send window left
to keep tight; the second round-trip the compile used to need went with it.
```

### SCREEN readiness beim Founding (Messung 2026-08-12)

```text
SCREEN readiness, bounded — only for a harness that declares it (codex today; every other
adapter takes `null` and this loop never runs). The boot sleep above is a grace period, not a
readiness proof: the proof is the accept marker on the rendered pane. Here — unlike at the
delivery gates — "pending" is NOT deliverable: this pane is seconds old by construction, so
"neither marker yet" means "still booting", never "header scrolled off". Measured 2026-08-12:
a paste+Enter into the trust prompt ANSWERS it and boots an empty composer, the brief gone
with no error — the 2026-08-10 dispatch race, now refused by name instead of raced by sleep.
```

### sourceTree

```text
The pack sources are Fleet-owned, so the tree being dispatched into decides whether they
exist at all — derived from git, never assumed. This used to be the literal "fleet", which
handed a foreign lane anchors that cannot resolve there AND receipted them against that
repo's own head: the one place where the ledger itself was untrue.
```

### integrationHead VOR dem Plan

```text
Read the integration tip on the server at the delivery seam. If it cannot be named, do not
deliver a brief whose receipt would have to invent HEAD; the existing requeue path owns it.
THIS NOW COMES BEFORE THE PLAN, and the order is the contract rather than a tidy-up: the
manifest below is read AT this commit and the receipt asserts it, so a plan derived before
the tip was named could only receipt anchors against a commit nobody read.
```

### Fleet-Seeds + Repo-Manifest

```text
The Fleet seeds plus whatever THIS repository declares about itself at that commit — the
same merge Program-MAIN founding does, and deliberately with no frame branch here: the
dispatch seam is the 72-of-82 majority of deliveries, and a Fleet-only or foreign-only rule
would be a second, quieter policy. `repoRootOf` throws on an unnameable root and the catch
below requeues, exactly as the integrationHead refusal above already does.
```

### Receipt-Hash

```text
Hash exactly this canonical JSON: the delivered anchor block plus the receipt-visible plan
facts {harness, mode, triggers, selected, omitted}. A later reader can reconstruct every byte
from the row and the renderer the row NAMES — `renderer` says which one wrote this block, and
a row without that field is a v1 row by date. Neither the mutable task nor a later tree is
needed.
```

### briefHash — der Join-Key

```text
The join key, and deliberately the SAME function LaneOutcome.briefHash uses over the lane's
first logged prompt: both hash the bytes that actually crossed the seam, so a receipt and
the outcome of the lane it founded meet exactly. The `hash` above stays what it was — it
keys {anchorBlock, planFacts}, answers a different question, and nobody re-reads it here.
```

## dispatchSourceTree

### Kopfkommentar

```text
Which tree is this dispatch about to change? Git toplevel identity is the whole classifier —
the same rule preflightProgramMain applies to a Program-MAIN cwd, and for the same reason:
filenames never upgrade a foreign tree, and a linked worktree of Fleet has its own toplevel.
A foreign tree cannot resolve Fleet-owned pack anchors, so planContext omits all six as
`source-unavailable` and the anchor block empties by construction. Throwing when the root
cannot be read is deliberate: naming no tree beats inventing one, and the caller's requeue path
owns that failure exactly as it owns the integrationHead refusal at the same seam.
```

## briefSourceOf

### BriefSource — die Wertetabelle

```text
WHERE THE DELIVERED TEXT CAME FROM — a closed set, written onto every context receipt beside
briefHash. Without it the ledger can say WHAT crossed the seam but never by which route it was
authored, and an empty-lane rate per brief origin (the one number the compiler is judged by) is
not forward-computable from the rows: a compiled brief and a raw draft leave byte-identical
receipts. Derived mechanically from the task at the delivery seam, never from a later re-read of
a mutable row — the row's brief can be edited after the lane already ran.
  compiled — the analysis sweep's brief (TaskBrief, edited:false)
  owner    — a brief the owner wrote/edited by hand (TaskBrief, edited:true / model "owner")
  raw      — no brief on the row: the draft text itself was delivered
  clarify  — buildClarifyBrief's deterministic frame; deliberately NOT folded into "raw", because
             a clarify lane is briefed to settle a criterion and produce no commits, so counting
             it among raw dispatches would read as a raw-brief abort every time it works
  founding — a server-built Program-MAIN/Supervisor founding template; no task text is involved
```

### FOUNDING_BRIEF_SOURCE

```text
...and the value the OTHER four writers use. The founding rails (Program-MAIN and Supervisor,
bootstrap and succession) deliver a server-built template — buildProgramMainBrief, its succession
form, and the two Supervisor forms — with no Task anywhere in the call. Neither "raw" (claims a
draft text that does not exist) nor "compiled" (claims a model that never ran) is true there, so
the set carries the repo's own word for that delivery instead of the nearest wrong one. Their
briefHash is the same hash of the same kind of fact, the bytes that crossed the seam: one rule
for the ledger, not two. It joins no lane outcome only because a Program-MAIN is not a lane.
```

## LANE_EXIT_FOOTER

### Kopfkommentar — die gemessene Wurzel

```text
THE LANE'S OWN ENDING, WRITTEN INTO EVERY MUTATING BRIEF. Measured root cause:
docs/messungen/2026-08-23-rootcause-lane-ohne-commit-und-report.md — a finished lane wrote its
result to an UNTRACKED file, sat idle-dirty ~20 min (so the lane-ready watch, idle+clean+ahead>0,
could not fire) and filed nothing. The delivered brief was task text plus anchor block: it said
what to DO and never what to LEAVE BEHIND. Harness and model behaviour were refuted there by
transcript, which is why the fix is at this seam and not in any one brief.
Three acts, deterministic bytes, appended once at the single assembly seam below so a brief
cannot be delivered without them. A clarify lane is exempt by construction: it must STOP and let
the owner answer, and telling it to report would be telling it to finish.
The status list is read from the route's own constant — a footer that named a status the route
rejects would teach the lane a 400.
```

## renderContextAnchorBlock

### Kopfkommentar — v2

```text
v2 renders PURPOSE beside the pointer: v1 handed a lane `- <id> | <path> | <anchor>` and left it
to guess when following the pointer was worth a read. The pack line carries useWhen exactly once
and the pointers sit indented beneath it, so one pack is one paragraph however many sources it
names. A selection WITHOUT useWhen (a repo-declared pack from before the field) loses that line
and keeps every pointer — the block never goes silent because a purpose was never stated.
```

## tickWatches

### Banner — der OUTBOUND-Kanal

```text
--- the OUTBOUND channel for both completion facts (Watch, above). Deliberately its own tick and
not a branch inside tickAutoReview: auto-③ remains on doneLooking alone, and also breaks out at
AUTO_REVIEW_MAX_CONCURRENT / skips lanes with a review inflight. Folding delivery there would
both widen review onto uncommitted work and make notification depend on unrelated capacity.

Runs on the AUTOS cadence, not the review cadence, because what it does is DELIVER: same tick
speed, same choke-point (canDeliver), same master stop. FLEET_AUTO_REVIEW_MS=0 does not disable
it — it spawns no agent and costs nothing while no Watch is armed and no event is pending.
```

### STN-1 expiry

```text
STN-1 expiry. The tick never MINTS for this kind — only the bound Supervisor's act does
(completeTransitionWatch). What the tick owns is the deadline: past it the Watch is
disarmed with a legible reason and NO pane text. One Watch carries at most one
notification, and that one is the transition; an expiry line typed into the pane would
be a second stream, which the promotion explicitly refused.
```

### SUBJECT gone

```text
…and the SUBJECT, before any gate that could merely delay this row. A held event is a
promise about a live lane; once that lane is gone the promise cannot come true, and every
further tick would only be waiting to type stale news into a pane. Teardown already sweeps
this (dropWatchesFor); here is where a recycle that never passed through teardown, and
every row restored from disk, is caught.
```

### Zwei gewaivte Policy-Gates

```text
Two policy gates are waived for this one-shot: quiet hours, as for a one-shot Auto, and the
foreign-harness WORK-PROMPT policy. A Watch exists only after an explicit Owner/Self
subscription and its text is fixed server-generated completion facts, never caller-chosen
work. This waiver belongs HERE, to that act — not to pi-unfenced or any adapter. The
kill-switch, fresh agent-liveness and busy/observed gates remain: a paused fleet types
nothing, and text into a dead pane's bare shell would execute as shell commands.
```

### SendRefused — der Zaehler geht zurueck (attempts=2006)

```text
nothing was typed (an occupied composer, i.e. an owner draft): the event is still
pending and will be offered again once the composer is clear — never appended to it.
AND THE COUNT GOES BACK WITH IT. A refusal happens BEFORE the paste, so it is not an
attempt at all: the same measured row reached attempts=2006 against 2005 holds and one
real send, which made the number read as 2005 failed deliveries into a live pane. The
held audit line below is where a hold is counted, and it counts only holds.
```

### send-uncertain bleibt stehen

```text
tmux may have accepted some or all of the operation before reporting failure, or the
composer is observably still holding the text (ACP-25). Preserve the pre-send marker
exactly; neither "failed" nor "delivered" is an observed fact, and send-uncertain is
replayed only by the bounded fleet-report recovery when rollback proved Fleet's payload
is absent from the exact receiver pane.
```

### source "auto"

```text
source "auto", not a sixth vocabulary word: the prompt log's "auto" already means "the
machine typed this, unattended" and three distinct machine paths share it (scheduled autos,
the dispatcher's founding brief, the merge idle guard). The audit trail below is where a
watch is told apart from those.
```

### FACT 3

```text
FACT 3: the ONE bounded retry of a terminal merge verdict whose first delivery was refused at
the gate — the lane was still producing output, the fleet was paused, an owner draft sat in
the composer. A second refusal is FINAL: the marker stays on the merge status, where the
owner can read it, and nothing asks again. Recomputed here rather than reusing the list from
the top of the tick, because the loops above spend seconds in tmux and a lane can land, be
recycled or start a fresh merge run inside that window.
```
