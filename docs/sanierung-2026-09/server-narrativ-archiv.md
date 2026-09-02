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

