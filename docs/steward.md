# Steward — the workhorse agent as a Fleet convention

*The persistent planning/conversation agent for Fleet work. A usage pattern first, not a
slot type or UI mode, and Fleet is fully functional without it. Decided 2026-07-21 (JP):
Fleet-native, convention-first, optional, clearly recognizable.*

**Correction 2026-07-25 — "zero code in `server.ts` knows about it" was true when written
and is not true now.** `server.ts:STEWARD_LABEL` hard-codes `⚙ steward` and four sites branch
on it: `stewardSlot()`, the auto-③ exclusion, the `doneLooking` field, and — load-bearing —
the credential export at spawn (`const stewardExport = s.label === STEWARD_LABEL && stewardToken`).
**Labelling a slot `⚙ steward` is therefore not cosmetic: on that pane's next (re)spawn it is
handed `FLEET_STEWARD_TOKEN` and can self-serve `/api/steward/*`.** The convention is still a
convention — nothing forces a steward to exist — but the label is now a security-relevant name.

**How to actually create one (2026-07-26).** Because the export is baked at spawn, open-then-rename
never produced a steward pane — the label arrives after tmux has fixed the pane's env, and
`openSlot` used to clear the label to `null` right before spawning anyway. `POST /api/slots/:id/open`
therefore takes an optional `label`, applied *before* the spawn:

```
curl -X POST http://<host>:<port>/api/slots/<id>/open -H 'authorization: Bearer <owner token>' \
  -H 'content-type: application/json' \
  -d '{"cwd":"<repo>.worktrees/steward","label":"⚙ steward"}'
```

That is a single reproducible call, and it is destructive by design: an active slot's pane is torn
down and respawned (see `docs/attic/state-reality-divergence.md` D2). The **board's** picker still sends only
`{cwd}` and is reachable only for empty slots, so the label path is API-only for now. Renaming a
live slot to `⚙ steward` still does NOT hand it the token until its pane respawns — that gap (and
the reverse one, authority outliving the label) is D5, unchanged.

---

## What it is

One designated slot that hosts a **durable conversation about the system** —
planning, concept work, brief-shaping, automation design. It is the standing home
of interaction-mode 2 (`docs/attic/interaction-modes.md`, session → session): the steward
briefs, lanes execute, the owner reviews at land.

A slot already is "a durable conversation with a place to live" (pinned session id,
self-heal resumes via `--resume` — `docs/attic/operating-model.md`, Slot;
that promise is now measured rather than assumed: `slotstats.ts`, served at
`GET /api/slot-stats`). The steward is that
primitive plus three conventions:

## The three conventions

1. **Recognizable: the label `⚙ steward`.** Exactly one slot may carry it. If a
   slot has this label, it IS the steward — humans scan the sidebar for it, and
   any automation may key on the label or its cwd. No other slot uses the ⚙ glyph
   in its label. No steward slot open → no steward; nothing breaks (optionality is
   the point).

2. **Safe: cwd is the dedicated worktree, never the main checkout.** The steward
   lives in `<repo>.worktrees/steward` (branch `steward`). Rationale: the main
   checkout contains `fleet.json` with the plaintext owner token — a slot there is
   the confused-deputy exposure of Hardening #1 (BACKLOG). A worktree materializes
   only tracked files; `fleet.json` never exists there. `CLAUDE.md` (gitignored) is
   copied in by hand once, like Fleet's own lane scaffolding does.

3. **Plans, never lands.** The steward's output is understanding and briefs, not
   patches. When code should change, it produces a lane brief per
   `tailored-context.md` §7 (environment, done-criterion, silent complement,
   output contract) and hands it to the owner or the queue. The steward branch
   never accumulates work meant for `main`; the steward keeps it fresh by merging
   `main` into it when the shelf it reads has moved.

## Session start (the load ritual)

The steward's value is that its concepts are **read, not assumed**. On spawn or
after a context reset, run `/steward` (project command), which:

1. **Freshens first** — merges `main` into the steward branch and syncs the two
   gitignored files no merge carries (`CLAUDE.md`, `OWNER.md`) from the main
   checkout. Ordering is load-bearing: reading precedes nothing; a shelf read
   before the merge is a stale world-model dressed as a fresh one (this is how
   the branch once drifted 22 commits behind).
2. Reads the shelf in order: `README.md` (what is operative at all) →
   `tailored-context.md` → `verify-tiering.md` → this file. **Corrected 2026-07-29:**
   three of the originally named docs (operating-model, interaction-modes,
   verification — named without extensions here for the same reason the index does it)
   moved to `docs/attic/` in `66d302b`, and the ritual pointed at
   their old paths for two days — a load step that silently reads nothing is worse than
   one that fails loudly, which is why the index now carries a pointer check.
3. Spot-verifies the claims it is about to rely on (a handful of the line
   references against the current tree) — the shelf's claims are treated as
   claims, per CLAUDE.md.
4. Then converses: planning partner, brief compiler, automation designer.

The session itself is **disposable by design**: the journal holds its durable
memory, the shelf its durable knowledge. A long-lived pane accumulating context
is the failure mode; the cheap rebuild via this ritual is the feature. When
context has grown long, the steward says so and asks for a `/clear` + reload
rather than degrading quietly.

## The two pulses (2026-07-29)

Unprompted **attention**, never unprompted action. Both run as owner-created autos on the
steward slot, both are read-only, and both end in the same place: at most one or two
`pending` proposals the owner promotes or drops. Neither gates anything.

| | `/rundgang` | `/inspektion` |
|---|---|---|
| Watches | the **operation** — which lane needs the owner now | the **substance** — what is broken or avoidably worse |
| Sensing | one call: `GET /api/steward/digest` (per-slot state, `sinceLastLook`, ledgers) | one revier per run out of five, rotating |
| Memory | the steward journal (`POST /api/steward/journal`) | `inspektion-register.jsonl`, untracked in the steward worktree |
| Honest empty result | "all clear", files nothing | "nothing", files nothing |

Three properties earn the Inspektion its keep, each written against a measured failure:

- **A finding you cannot cite is not a finding.** Agents do not inherit CLAUDE.md's
  analysis discipline, so the burden is written into the command: read the file, carry
  `file:line`, name the cost. *Fehler* (broken now) and *Verbesserung* (avoidably worse)
  carry different burdens; an unresolved smell is a *Kandidat*, never dressed as a defect.
- **One revier means one.** Depth is bought by what you decline to chase. A smell outside
  the chosen revier gets one register line and waits for its rotation.
- **The register remembers refutations too.** Code defects, unlike lane states, persist
  until fixed — without a memory the pulse re-files a dismissed finding every run, and
  re-derives the same dead ends. `ts` comes from `date -u` at write time; a register whose
  timestamps are invented cannot be audited against the audit trail, and being auditable
  is its whole job.

Both pulses send into the steward's own pane, which is where the owner briefs it. The known
hazard is unchanged: `sendText` is paste-buffer + Enter with no clearing of the input line,
so text the owner typed but did not submit is prepended to the pulse and both are submitted
as one prompt. Nothing guards this today.

**Track record so far, so this section stays honest:** two Inspektion pulses have run. The
first filed a verified latent auth gap and, in the same run, an orphaned measurement
subsystem — both confirmed independently, both acted on by the owner. The second found a
real defect in code that had landed two hours earlier and survived a critical re-read
(`b7d449a0`: a classification reading state the spawn had already overwritten). Whether
this holds is an open question with a fixed answer date — the autos carry finite run caps
on purpose, so continuing is a decision rather than a default.

## Voice

The steward is chatted with, so its default register is **maximally concise**:
answer first, one sentence where one suffices, no restating the owner's words, no
narrated reasoning (grounding stays silent — `tailored-context.md` §3). Length is
earned only by substance — a lane brief, a threat model, a design position — and
the steward flags in half a sentence why it is going long. This is the same
output-contract discipline every lane follows, applied to conversation.

## Knowledge maintenance (v1 — deliberately minimal)

The heart of a working agent is that its stored concepts stay true. v1 is
discipline, not machinery:

- **Whoever structurally changes `server.ts` / `src/client.ts` updates the
  affected claims in `docs/*.md` in the same lane** (rule lives in CLAUDE.md, so
  it rides into every lane).
- The steward's load ritual spot-verifies on every start, so rot is noticed at
  the point of use.

Known future optimization (explicitly deferred 2026-07-21): a read-only
verification auto that periodically re-checks doc claims against the tree and
files rot as a `pending` task. Build it only once the manual rule has demonstrably
failed — same stance as BACKLOG #14 Phase 3 ("prove the signals before automating
the judgment").

## What the steward is NOT

- Not a server feature, slot type, or UI mode — revisit only if the convention
  proves insufficient in real use.
- Not a gate: like every advisory agent (`docs/attic/perception-layer.md` §7), its judgment never
  blocks or triggers anything mechanically.
- Not cross-project: Fleet-only for now. Generalize the pattern elsewhere only
  after it has proven itself here.
