# Steward autonomy — the management loop, joint by joint

*Design note 2026-07-21. The steward (`docs/steward.md`) should manage sessions as
far as is defensible. This doc decomposes the loop the owner runs manually today
into its joints and fixes the optimal mechanism per joint, measured against the
standing invariants: automation only through gates, review capacity is the
bottleneck, capability asymmetry against injection (`steward-mail.md`), landing
stays human, and BACKLOG #14's lesson — a wrong auto-intervention is worse than
none, because it looks smart. Rule of construction: every automation stage must
have a manually-proven predecessor; deterministic signals before LLM judgment.*

The empirical base (§Playbook) comes from mining the owner's actual historical
prompts — Fleet's per-slot history plus the Claude transcripts — so v1 automates
only interventions that demonstrably occur.

---

## The seven joints

### 1. Sensing — what state exists?
Today: the owner scans badges and opens panes. Optimal: the steward senses only
through the owner-read API surface — `/api/sessions` (idle via `lastOutput`, git
facts, task/merge state), `/api/slots/:id/brief`, `/api/slots/:id/transcript` —
never `capture-pane` from his own pane (raw bytes, and a habit that bypasses the
server's gates). Deterministic triple per lane: idle duration × git delta since
last look × task state. Known blind spot, inherited from the tool: a pane waiting
on a permission prompt is invisible in the transcript (BACKLOG #6 Phase-1
finding) — "idle" never implies "done" (`interaction-modes.md`). Missing piece
worth building later, not first: an aggregated deterministic lane-state endpoint;
v1 composes from what exists.

### 2. Interpreting — what does this lane need?
A small, named condition vocabulary, so every judgment is auditable and the same
word always means the same test:
- **healthy-running** — recent output, no anomaly. No action, ever.
- **done-looking** — idle + clean tree + commits ahead. Candidate for "run your
  verification and report" — never for "done".
- **stalled-dirty** — idle + uncommitted changes. Candidate for a resume/commit nudge.
- **stuck-looping** — the same fix-run-fail cycle repeating (the ~5× structural
  rule from CLAUDE.md, observed from outside). Candidate for a structural-stop nudge.
- **awaiting-human** — a question to the owner, a permission prompt, a decision
  outside the delegated scope. Escalate; the steward never answers in the owner's stead.
- **unknown** — anything else. Escalate, never improvise.
Deterministic tests assign the first four; transcript reading (as untrusted data)
only breaks ties, and its verdict is always advisory.

### 3. Deciding — act or hold?
The playbook (below) is the whole decision surface: per condition exactly one
allowed intervention type, a per-lane cap, and "escalate" as the default for
everything unmatched. No freehand interventions — a steward that improvises
messages into sessions is the BACKLOG-#14 failure with extra steps. Caps are
mandatory (same stance as autos' run cap); a condition that persists through its
capped interventions escalates instead of repeating.

### 4. Delivering — how does a message reach a session?
Only via the server's gated send path with the scoped steward token (idle gate,
claude-alive gate, slot re-verification) — never raw tmux, which is the literal
confused-deputy from `interaction-modes.md`. Every steward message is prefixed
`[steward]` so transcripts stay attributable, and lands in prompt history like
any composed send. Phrasing is not improvised per message: the playbook carries
message templates distilled from the owner's own proven phrasings (that is what
the historical prompts teach), compiled through the same `/sharpen` machinery
when substance warrants it.

### 5. Checking effect — did it help?
After an intervention: measurable response = new output activity, git delta, or
an explicit reply, within a bounded window. Outcome (helped / no effect /
worsened) goes into the steward's **journal** — a data file, not docs. No effect
→ escalate; never re-send the same nudge past its cap. This makes every playbook
entry falsifiable, which is exactly what BACKLOG #14 Phase 3 demanded before
trusting automated judgment.

### 6. Learning — how does the playbook improve?
The journal is data at rest. Periodically the steward distills it into
*proposed* playbook/doc changes — emitted as a brief or diff for owner review,
never self-applied. Learning proposes, the human promotes: the same quarantine
invariant that governs code. The historical-prompt mining that seeded v1 is this
loop's bootstrap iteration, run by hand.

### 7. Escalating — the owner interface
The owner's attention is the scarcest resource in the system, so escalation is
attention economics: one periodic digest (the Rundgang report) carries everything
reviewable; only blocking conditions (awaiting-human, stuck past caps) surface as
individual items. Raw material (transcripts, diffs) is linked, never inlined.
The mail channel (`steward-mail.md`) is a future *carrier* for digests (v2
outbound, owner-only recipients) — never a decision path.

## Empirical base (mined 2026-07-21)

~280 unique mid-session owner messages (07-05 → 07-21; all 196 terminal + all 55
owner-UI sends read verbatim, lane transcripts + 1-in-12 backfill sample;
assistant turns and older projects not covered). Primary-label distribution:
iterative feedback / next slice ~35%, new information the agent lacked ~18%,
verification demands ~15%, scope/direction corrections ~13%, understanding
questions ~9%, git/lifecycle one-liners ~8%, pure continue-nudges ~7%,
stop/abort ~2%. Cross-cutting signature: a motivational-discipline suffix
("Denk gut nach … Scheue keine Mühe … Own your work") + a `/sharpen` variant on
32% of all prompts and most substantive ones.

The decisive finding: the biggest automatable slice is **not** the nudges — it
is the "new information" bucket, because what the owner relays there is
overwhelmingly *deterministically observable machine state* he merely sees
first: `Land blocked` errors (≥6 verbatim pastes), "slot X still working",
"worktree just landed", server down. A supervisor watching git/task/idle state
can inject exactly this itself. Second finding: the verification demand
("verifiziere, bevor du fertig meldest") is a constant suffix — it belongs
statically in every template, not as a separate intervention. Third: one hard
trust violation in the corpus (an agent sent an outbound application without
consent) — the case study for why consent-shaped and irreversible actions sit
behind the never-crossed line.

## Intervention playbook v1

Only categories that demonstrably occur; each entry: trigger → template family →
cap. Templates reuse the owner's proven phrasing signature (concise imperative +
the verification suffix; `[steward]`-prefixed).

1. **state-relay** (from the ~18% bucket; largest lever). Trigger: a
   deterministic event relevant to a lane that its session cannot see —
   land/merge blocked with the git error, sibling lane landed (rebase hint),
   integration branch moved, server/tooling state. Template: "[steward] Status:
   <fact verbatim from the deterministic source>." No interpretation added.
   Cap: 1 per event per lane.
2. **lifecycle-op** (~8% bucket, rote one-liners today). Triggers: stalled-dirty
   past threshold → "committe deine Arbeit"; context ≥~60% → "schreib ein
   /handoff"; lane landed → verification sweep prompt. Cap: 1 per condition
   episode, then escalate.
3. **continue-nudge** (~7% bucket). Trigger: idle + task sent + not
   done-looking + not awaiting-human. Template: the owner's own proven nudge
   form (short imperative + discipline suffix). Cap: 1 per lane per task, then
   escalate — a second identical nudge never helped in the corpus either.
4. **verification-suffix** — not an intervention: a static line in every
   template and every compiled brief ("Verifiziere dein Ergebnis, bevor du
   fertig meldest").

Explicitly human, empirically confirmed: the praise-gate ("Sehr schön, aber …")
IS the owner's review — the steward prepares it (digest, diff links) but never
utters acceptance; scope/taste corrections (~13%); genuinely external facts
(deadlines, research, interview outcomes); stop/abort; choosing *which*
verification matters. The delegation directives the owner types by hand
("Beauftrage zwei Opus-Agenten …") are ladder-stage-2 Briefer work, not
mid-session automation.

## The line that is never crossed

Never automated, at any ladder stage: queue promotion (`pending → queued`),
land/merge/kill, permission grants, answering in the owner's voice, touching
credentials/config/`fleet.json`, modifying the steward's own binding
instructions, or any intervention type without a manually-proven predecessor.

## Impact on the build order

Unchanged front: **audit log → scoped steward token → Rundgang.** The Rundgang
(ladder stage 1) implements joints 1, 2, and 7 — sense, interpret, digest — with
zero delivery capability; the journal starts there. Delivery (joint 4, the
playbook's nudges) is ladder stage 3, unlocked per-category once its condition
signals have been watched manually for a while. Joint 6's distillation loop comes
last and stays advisory forever.
