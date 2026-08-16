# Context delivery truth — an architecture/evidence audit (2026-08-16)

*Bounded lane report for owner-confirmed Program `441c00585f29d07aa1542f1b`. Documentation only:
this lane owns exactly this file and changed nothing else. Every claim below is anchored to source
read at HEAD `7f3fe5e` (`docs(studio): put communication before game production`). Docs are treated
as claims; `server.ts`, the pure modules and `e2e/` are treated as current fact.*

**Problem and why it matters.** Fleet's founding briefs still hard-code "read only the top HANDOFF
section" and select six compile-time Fleet-owned packs. Both were correct for one consumer (a Fleet
MAIN in the Fleet checkout) and are now delivered, unchanged in spirit, to consumers they do not fit:
a target-repo Program-MAIN, a foreign task lane, and a fresh MAIN that receives nothing at all.
Context enrichment is a core product property, so the failure is not cosmetic — it decides what an
agent believes about the tree it is about to change.

**What this report delivers.** A layer separation, a per-consumer delivery map with evidence, a
verdict on the HANDOFF instruction, five ranked gaps, exactly one proposed smallest landable slice,
the ownership map for the game packs (without authoring them), an adapter/surface decision table, a
sent/receipted/loaded/used ladder, and — per the owner addendum — a nine-role × seven-field context
contract plus a re-evaluation against the named lessons in the owner-supplied transcript.

**Method and coverage.** Read in full: `AGENTS.md`, `context-packs.ts`, `context-plan.ts`,
`e2e/context-plan.ts`, the owner-supplied transcript. Read in the ranges cited: `server.ts`
(delivery seams, Program region, slot-open routes, worktree creation, receipt route),
`e2e/programs.ts`, `e2e/tasks.ts`, `e2e/pins.ts`, `state.sh`, `register.sh`, `HANDOFF.md` (top
section), `docs/product-studio-working-circle.md`, `docs/lane-brief-template.md`, `OWNER.md` head.
**Not read and therefore not characterized:** `src/client.ts` (whether any pack/receipt surface is
rendered in the board), the full 2920-line `HANDOFF.md` history, `docs/core-program-2026-08-12.md`
beyond its index, and the container/Docker path. Nothing below depends on those.

---

## 1. The layers

### 1.1 The five layers named in the request

| # | Layer | Where it physically lives today | Who authors | Who selects it for a session |
|---|---|---|---|---|
| L1 | **Portable rules** | tracked `AGENTS.md` (`## Portable operating contract`) | owner | the harness auto-load, plus pack `portable-core` as a pointer |
| L2 | **Private rules** | git-ignored `CLAUDE.md` (+ `OWNER.md`), copied per lane at `server.ts:3513` | owner | file copy at worktree creation; pack `private-deploy-overlay` as an opaque pointer |
| L3 | **Live derived state** | `./state.sh`, `./register.sh`, `GET /api/sessions`, `/api/self*` | nobody — derived at read time | the agent itself, by running the command |
| L4 | **Owner-confirmed intent** | `Program` (`server.ts:1722`), `Task.brief`, confirmed criteria | owner promotes; sessions propose | the founding brief embeds Program JSON verbatim |
| L5 | **Role/repo/act enrichment** | *nothing owns this* | — | — |

L5 is the empty cell, and it is the subject of this report. `ContextPlan` is the only mechanism
built for it, and its entire vocabulary is Fleet-control: six scopes, six triggers, eight
capabilities, all about verify/land/queue/harness/deploy (`context-packs.ts:4-30`). There is no
scope for a repository contract, a role overlay, or a product-quality bar.

### 1.2 The nine-layer decomposition (owner addendum)

The five above collapse three distinctions that matter once a target repo and specialist roles
exist. The finer ladder, in strict precedence order — earlier layers constrain later ones, later
layers may narrow but never widen authority:

| # | Layer | Question it answers | Owning artifact (today / proposed) |
|---|---|---|---|
| C1 | Organization / Fleet contract | How does *any* agent behave in this operation? | `AGENTS.md` portable core / unchanged |
| C2 | Repository contract | How is *this repository* changed and proved? | target repo's own root `AGENTS.md` (already required, `server.ts:11609`) / unchanged |
| C3 | Program / product intent | What are we building and what is success? | `Program` record, delivered verbatim / unchanged |
| C4 | Task brief | What is this one bounded act and its done criterion? | `Task.brief.text` / unchanged |
| C5 | Role overlay | What discipline does *this* specialist owe? | nothing / repo-local role notes, pointed at by packs |
| C6 | Act-specific proof and tools | Which commands prove this act, which tools exist? | `AGENTS.md ## Verify` + `GET /api/self/gate` `localProof` / extend to target repos |
| C7 | Live evidence | What is true right now? | `state.sh`, `register.sh`, `/api/self`, `/api/self/gate` / unchanged |
| C8 | Handoff / receipt | What crossed which seam, and what did the predecessor mean? | `HANDOFF.md`, `context-receipts.jsonl`, `lane-outcomes.jsonl` / unchanged |
| C9 | Learning proposal | What should change about C1–C6 next time? | nothing mechanical; commit bodies and this shelf / propose-only, never self-promoting |

**Composition without duplication.** The rule that keeps a nine-layer ladder from becoming nine
copies of the same sentence is already stated in `context-packs.ts:1`: *"Context packs are metadata
pointers into existing sources, never a second knowledge store."* Operationally that means four
constraints, and today the system honors the first three:

1. **One normative home per rule.** A rule is written once, in the layer that owns it. Lower layers
   cite it by path + anchor; they never restate it. (`ContextPackSource` is `{path, anchor}` and the
   manifest validator rejects embedded content outright — `PACK_CONTENT_FORBIDDEN`,
   `SOURCE_CONTENT_FORBIDDEN`, `context-pack-validator.ts:15-45`.)
2. **The pointer is resolvable at a named tree.** A receipt carries `repo` + `head`, and
   `e2e/programs.ts:424` proves each anchor by `git show <head>:<path>` and a substring match. A
   pointer that cannot resolve is a defect the suite can see.
3. **Absence is a named reason, never silence.** `ContextPlanOmissionReason` is a closed six-value
   vocabulary evaluated in a fixed ladder (`context-plan.ts:9-17`, `55-71`), and the ladder order
   itself is pinned (`e2e/context-plan.ts:57`, `67`).
4. **The omission must reach the reader, not only the ledger.** This is the one that is missing —
   see §4, gap G2.

---

## 2. What each consumer actually receives

Six consumers exist today. "Receives" below means *bytes the server put into the pane*, separate
from what the harness loads on its own.

### 2.1 The map

| Consumer | Founding bytes from Fleet | Packs selected | Who chose | HEAD / session / provenance evidence | What is missing |
|---|---|---|---|---|---|
| **Fresh Fleet MAIN** (`POST /api/slots/:id/open`, `server.ts:16931`) | **none** | none — `planContext` is never called | nobody | none: no receipt row exists for this path | everything; the session's entire context is whatever the harness auto-loads plus what the owner types |
| **Fleet Program-MAIN** (`bootstrapProgramMain`, `server.ts:11780`) | ordered 4-step brief + verbatim Program JSON + anchor block (`server.ts:11641-11650`) | `portable-core`, `verify-e2e` (from `always`+`verification`, `server.ts:11567`) | server constants; owner chose only cwd/harness/model/effort | receipt row: `head`, `branch`, `repo` from `preflightProgramMain`; `programId`; `harness/model/effort`; v1 `hash` (`server.ts:11855-11867`) | repository-contract and role layers; no pointer to the Program's own prior receipts |
| **Program succession** (`succeedProgramMain`, `server.ts:11683`) | succession brief + `carry` (≤ `MAX_SUCCESSION_CARRY`) + Program JSON + anchor block | same two | same | same receipt shape, plus `program.main = {slot, openedAt, sessionId, boundAt}` | the predecessor's *reasoning* travels only through `HANDOFF.md` + ≤500 chars of carry |
| **Ordinary MAIN succession** (`buildSuccessionBrief`, `server.ts:4695`) | 4-step brief + `carry` | **none — `planContext` is not called on this path** | nobody | **no receipt row**; only `logPrompt`/`history` | the same anchor block its Program-MAIN sibling gets; the asymmetry is undocumented |
| **Fleet task lane** (`briefAndSend`, `server.ts:5397`) | `Task.brief.text` (or raw text, or the clarify frame) + anchor block | `portable-core`, `verify-e2e` | server constants `server.ts:5385-5395` | receipt row with `taskId`, `originId`, `programId`, `branch`, `repo`, `head` from `integrationHead(wt.repo)` — and delivery is **refused** if HEAD cannot be read (`server.ts:5489`) | role overlay; the brief's own `files` list is not receipted as a pointer |
| **Foreign task lane** (same function, foreign `FLEET_DISPATCH_REPO`) | same as above | **Fleet packs, wrongly** — `sourceTree` is the literal `"fleet"` (`server.ts:5479`) | server constant | receipt records the foreign `repo`/`head` **and** Fleet-owned anchors that cannot resolve there | correctness: the two halves of the receipt contradict each other |

### 2.2 The evidence behind the two sharpest rows

**Foreign dispatch is a known, commented, unclosed boundary.** `server.ts:5477-5479` states it in
the code itself: *"Dispatch still assumes Fleet-owned pack sources even when its configured repo is
foreign. That known cross-repo dispatch boundary is deliberately not closed by the Program-MAIN
slice."* The Program path proved the correct behavior exists: `preflightProgramMain` classifies by
git toplevel alone (`server.ts:11605`), a foreign tree yields `sourceTree: "foreign"`, and
`planContext` then omits all six packs with `source-unavailable` before any other rule
(`context-plan.ts:57`), which empties the anchor block by construction
(`renderContextAnchorBlock` returns `""` on zero selections, `server.ts:5522`). `e2e/programs.ts:445`
asserts exactly that: six omissions, all `source-unavailable`, and the delivered prompt contains no
`ContextPlan v1 anchors` line at all. Dispatch simply does not use it.

**A dispatch capability claim is asserted, not observed.** `DISPATCH_CONTEXT_CAPABILITIES`
(`server.ts:5392`) includes `private-overlay-read`, justified by the comment "the copied private
overlay". That copy is conditional: `createWorktree` copies `CLAUDE.md` only if it exists in the
source repo **and** is git-ignored there (`server.ts:3513-3516`). For a foreign repo with no
`CLAUDE.md`, the capability is claimed and false — and `private-deploy-overlay` would be selected on
a `deployment` trigger on the strength of it. The trigger set makes this latent today, not live.

**A fresh MAIN is the largest hole and the least visible one.** `/api/slots/:id/open` validates
harness, model, effort, box and label and then calls `openSlot`; it never touches `planContext`,
never sends text, and never writes a receipt (`server.ts:16931-16956`). `/api/lanes` and
`open-worktree` are the same (`server.ts:15581`, `server.ts:16958`). Every improvement to founding
context therefore bypasses the most common way a session starts.

---

## 3. Verdict on "read only the top HANDOFF section"

**Verdict: refine, not retain and not replace.** The bound is right; the referent is unbound.

The instruction appears verbatim in three builders — `server.ts:4705` (ordinary succession),
`server.ts:11645` (Fleet-frame bootstrap), `server.ts:11674` (Fleet-frame succession) — and the
ordered step list is asserted by `e2e/programs.ts:388-397`.

**What it gets right.** It is a *budget* instruction on a 2920-line file whose newest section is at
the top, and it is paired with two derivation commands that run first. `state.sh` exists precisely
because prose state rots: its header records that Session 8's handoff was wrong by six ledger rows
within a day (`state.sh:4-6`). The ordering — `state.sh`, `register.sh`, *then* HANDOFF — already
encodes "derive first, read residue second".

**Failure mode 1 — staleness the reader cannot detect.** `handoffCommittedAfterOpen`
(`server.ts:4711`) gates succession on the *file* being clean and committed after the predecessor's
`openedAt`. It does not compare the top section against the integration HEAD. A main-direct commit
after that handoff commit (this repo does them — `446d74b` is one) moves HEAD without touching
`HANDOFF.md`. The successor then reads a section that is honestly written and quietly behind. The
compensator exists: `state.sh:31` derives `SINCE` from the last `docs(handoff)`-prefixed commit and
prints everything landed after it. But the compensator depends on an *unpinned commit-message
convention*: a handoff committed with a different subject silently widens `SINCE` to the whole
history or collapses it to HEAD, and nothing reports that it did.

**Failure mode 2 — semantic boundary.** "Top section" is a rendering convention (`# HANDOFF —
Session N` headings, newest first), not a structure the server or any probe knows. A predecessor
who writes two `#` blocks in one session, or whose newest block references a correction two blocks
down, has produced a boundary the instruction cuts through. `HANDOFF.md` at HEAD does exactly this:
Session 66's block carries a second cut ("Zweiter Schnitt derselben Session") under its own `##`
heading, and Session 67's open-items list points backward at S66/S65 items. The bound is a byte
heuristic applied to a semantic object.

**The refinement, stated as the smallest change to the sentence.** Keep the budget; bind the
referent to a fact the server already reads. The step becomes, in substance: *read the newest
`HANDOFF.md` section, and treat it as current only back to the commit `state.sh` names; anything
`state.sh` lists as landed since is newer than the handoff and outranks it.* This costs one clause
in three string builders, contradicts nothing, and converts an unbounded trust into a bounded one.
It is deliberately **not** the code slice proposed in §5 — it is a wording change to a prompt, and
by §8's own rule a prompt string proves nothing. It should ride along with the slice, not be sold
as it.

---

## 4. The five material gaps, ranked by downstream damage

**G1 — Foreign task lanes receive Fleet pointers as if they were repo-local.**
*Cost:* an agent in a target repo is handed `AGENTS.md | ## Verify` and `docs/verify-tiering.md`
anchors that do not resolve there, and the receipt asserts they were delivered against that repo's
`head`. Two damages, not one: the agent may follow a proof chain the repo does not have, and the
audit trail records a resolvable-looking pointer that a later `git show` will fail on. This is the
one gap where the ledger itself becomes untrue.
*Evidence:* `server.ts:5477-5479` (the literal `"fleet" as const` plus its own admission),
against `server.ts:11616-11623` where the identical decision is made from git.

**G2 — Omission is receipted but never delivered.**
*Cost:* `renderContextAnchorBlock` (`server.ts:5521`) renders `plan.selected` only. The reader sees
what it got and nothing about what was withheld or why. A lane cannot distinguish "there is no
land-mechanics rule" from "you are a Codex lane, so `land-mechanics` was omitted as
`harness-unsupported`" (`context-packs.ts:127` restricts it to `claude`/`pi-unfenced`). The system
computes the honest answer, writes it to a ledger only the owner can read
(`/api/context-receipts`, owner-only, `server.ts:15350`), and hides it from the one principal whose
behavior it should change. This is the closest thing in Fleet to a silent skip.

**G3 — The most common session start delivers no context at all and leaves no receipt.**
*Cost:* every conclusion in this report about improving founding context applies to zero fresh
MAINs and zero manually opened lanes. It also breaks the evidence ladder: `context-receipts.jsonl`
reads as the record of "what crossed the founding seam", when it is really "what crossed it on the
three paths that have one". A reader counting receipts against sessions will under-count and cannot
tell that from a delivery failure.
*Evidence:* `server.ts:16931-16956`, `server.ts:15581`, `server.ts:16958` — none calls `planContext`
or `appendEvent(CONTEXT_RECEIPT_FILE, …)`.

**G4 — The pack vocabulary has no room for repository, role or product layers.**
*Cost:* C2, C5 and the whole product-quality set (§6) have nowhere to be declared. `CONTEXT_PACKS`
is a compile-time `as const` array with exactly one reader outside the planner
(`server.ts:5536`, to look up `sourceHash`); there is no route to add, retire or supersede a pack,
even though the manifest type carries `status` and `supersedes` for exactly that
(`context-packs.ts:56-57`). Every new context class is therefore a code change to `server.ts`'s
neighbourhood, which is the pressure that produces either a generic registry (explicitly parked,
`docs/product-studio-working-circle.md:446`) or copied prose in briefs.

**G5 — Ordinary MAIN succession is the odd one out, silently.**
*Cost:* the Program-aware succession path builds an anchor block and writes a receipt; the ordinary
one (`server.ts:4695`, reached at `server.ts:4765`) does neither. Two sessions founded minutes apart
by the same verb differ in whether their founding context is auditable, and nothing states this.
Lowest damage of the five because the brief is nearly contentless by design — but it is the gap most
likely to be mistaken for a measurement when someone compares receipt counts across sessions.

*Not ranked as material, recorded so the omission is a decision:* the `private-overlay-read`
capability assertion (§2.2) is latent — no live trigger set selects the pack it gates. It becomes
material the moment a `deployment` trigger is added, and G1's fix removes it for foreign repos as a
side effect.

---

## 5. The one proposed slice (after Communication Cut 1)

**Name: derive `sourceTree` at the dispatch seam from git, exactly as the Program seam does.**

This closes G1 — the only gap in which the audit trail itself records something untrue — by
deleting a hard-coded literal and calling a classifier that already exists, is already proven, and
already has a full omission ladder behind it. It is the smallest change that improves a real
delivery seam and it makes room for later layers instead of pre-empting them.

**Owned files and symbols.**
- `server.ts` — `briefAndSend`'s `planFacts` construction (around `server.ts:5477-5489`) and,
  if extraction is cleaner than an inline call, one small helper beside `programMainContextFacts`.
  No new module.
- `e2e/tasks.ts` — the dispatch receipt family (around `e2e/tasks.ts:764-784`).
- `e2e/pins.ts` — one rule, stated below.
- No change to `context-plan.ts`, `context-packs.ts`, `AGENTS.md`, `CLAUDE.md`, `HANDOFF.md`.

**Reused seams, no new ones.** `preflightProgramMain`'s classifier rule (git toplevel vs
`FLEET_REPO_ROOT`, `server.ts:11605`), `planContext`'s `source-unavailable` first rung, the existing
`ContextReceipt` row shape (unchanged — `selected` simply empties and `omitted` fills), and the
existing requeue path for any failure to name the tree.

**Closed done criterion (one sentence).** *A dispatch into a repository whose git toplevel is not
`FLEET_REPO_ROOT` delivers a brief with no `ContextPlan v1 anchors` block and writes exactly one
receipt whose `selected` is empty and whose `omitted` names all six packs as `source-unavailable`,
while a dispatch inside the Fleet checkout is byte-identical to today.*

**Proportional probes.**
1. `bun e2e/context-plan.ts` — unchanged, must stay green (the pure ladder is not being touched).
2. `e2e/tasks.ts`: a foreign-repo dispatch asserts empty `selected`, six `source-unavailable`
   omissions, an absent anchor block, and a recomputable v1 `hash` — the same three assertions
   `e2e/programs.ts:445` and `:587` already make for the Program path, so the shape is proven.
3. `e2e/tasks.ts`: the **counter-proof**, without which probe 2 is compatible with a broken planner —
   a Fleet-repo dispatch still selects `portable-core,verify-e2e` and still renders the block.
4. `e2e/pins.ts`: one rule, not a snapshot — *no delivery seam constructs `sourceTree` from a
   literal; every `planContext` caller derives it from a repository root comparison.* This is the
   pin that stops the literal from growing back at the next seam.
5. Full `./e2e-isolated.sh` is required for this slice regardless of `localProof`, because
   `e2e/tasks.ts` and `e2e/programs.ts` run only there.

**Live counter-proof (the thing that makes it real, not green).** Point `FLEET_DISPATCH_REPO` at a
throwaway repo outside the Fleet root, dispatch one trivial queued `auftrag`, then read
`GET /api/context-receipts` and confirm on the live row: `repo` = the throwaway path, `head` = its
real integration tip, `selected: []`, six `source-unavailable` omissions — and confirm from the
pane's own history that the delivered prompt carries no anchor line. Then repeat one dispatch inside
Fleet and confirm the two-pack block is unchanged. Both halves, or the measurement proves nothing.

**Rollback.** Restore the literal `sourceTree: "fleet" as const` in `briefAndSend`. One line; no
schema, no ledger format, no persisted state is touched, so old receipts stay readable either way.

**Explicit non-goals of this slice.** It does not add a pack scope, a role overlay, a repository
contract layer, a pack CRUD route, or a target-repo capability probe. It does not touch the fresh-MAIN
path (G3) or the succession asymmetry (G5). It does not deliver omissions to the reader (G2) — that
is the natural *second* slice and is deliberately separate, because it changes what an agent reads
and therefore deserves its own counter-proof. It authors no game pack content.

---

## 6. Where the game context should live, and who receives it

Contents are **not** authored here. This is the ownership and routing decision only, and every row
follows the same rule the studio doc already states: *"pointers into tracked target-repo sources,
not copied prose in Fleet"* (`docs/product-studio-working-circle.md:326`).

| Set | Normative home | Layer | Receives it by default | Explicitly does **not** receive it |
|---|---|---|---|---|
| **Product Promise** | target repo, tracked, owner-promoted | C3 (product intent) | Program-MAIN/Director, Critic, owner | Builder on a mechanical fix, verifier |
| **Quality Bar** | target repo, tracked | C3 | Director, Builder, Critic, owner | researcher, cartographer |
| **Creative Direction** | target repo, tracked | C3 + C5 | Director, art/gameplay Builder, visual Critic | verifier, aggregator |
| **Game Feel** | target repo, tracked | C3 + C5 | gameplay Builder, playtest Critic, Director | reviewer of non-gameplay diffs |
| **UI / readability** | target repo, tracked | C3 + C5 | UI Builder, visual Critic | backend Builder, verifier |
| **Capture / Critic protocol** | target repo, tracked | C5 + C6 (it is a *method*, so it names commands, seeds, viewport facts) | Critic, capture worker, Director | Builder (it must not shape what is built) |

Three consequences worth stating, because they are decisions and not descriptions:

- **They are C3/C5, never C1.** None of them belongs in `AGENTS.md` or `CLAUDE.md`. A game quality
  bar in the portable core would apply to Fleet's own control-plane lanes, which is nonsense, and
  would violate the one-normative-home rule the moment a second product exists.
- **Fleet's role is selection and receipt, not storage.** A pack for these sets is a
  `{path, anchor}` pointer plus an audience — precisely what `PublicContextPack` already is. Storage
  in Fleet would recreate the "second knowledge store" `context-packs.ts:1` forbids.
- **They are unreachable until G1 and G4 are closed, in that order.** G1 because a target-repo
  consumer currently gets either nothing (Program path, correctly) or Fleet pointers (dispatch path,
  incorrectly); G4 because `ContextPackScope` has no value that could name them. Materializing them
  before those two would mean copying prose into briefs — the exact failure this whole design avoids.
  This matches the roadmap ordering already promoted at `docs/product-studio-working-circle.md:404`
  and `:413`.

---

## 7. Adapter and surface decisions

Silence is not a decision, so every relevant surface is ruled for the §5 slice.

| Surface | Decision | Reason |
|---|---|---|
| `claude` adapter | **apply** | default resolution in `planContext` (`context-plan.ts:47`); behavior inside Fleet unchanged, foreign repos now honest |
| `codex` adapter | **apply** | already reaches both seams; `e2e/programs.ts` proves the target frame on codex specifically |
| `pi`, `pi-zai` | **apply** | same delivery seam, no adapter-specific branch exists |
| `pi-unfenced` | **apply** | singleton MAIN adapter; it can be a Program-MAIN and its dispatch path is the same code |
| `container` | **apply, unmeasured** | no adapter-specific branch exists in `briefAndSend`, so the change reaches it by construction; no live container dispatch was measured for this report |
| Protocol / wire (`ContextReceipt` row shape) | **not-applicable** | no field added or removed; `selected` empties and `omitted` fills, both already valid |
| `GET /api/context-receipts` | **not-applicable** | returns rows as written (`server.ts:15350`); no reader change needed |
| Owner client (`src/client.ts`) | **unsupported today** | not read for this report; no receipt or pack surface is known to be rendered, so there is nothing to keep in sync. Flagged, not claimed. |
| Reverse state / undo | **not-applicable** | the slice adds no state to reverse; rollback is the one-line revert in §5 |
| `state.sh` / `register.sh` | **not-applicable** | neither reads receipts or packs |
| Docs (`AGENTS.md`, `CLAUDE.md`) | **not-applicable** | no rule changes; the HANDOFF-clause refinement in §3 is a separate, prompt-level change |
| `e2e/pins.ts` | **apply** | one new rule (§5, probe 4) |
| Post-land audit | **apply** | `e2e/tasks.ts` and `e2e/programs.ts` run only under `./e2e-isolated.sh`, so the audit is where a regression here would surface |

---

## 8. Sent, receipted, loaded, used — the four are not one

No claim in this report rests on a prompt string alone. The ladder Fleet can actually stand on:

| Rung | What it means | Strongest current evidence | Where it stops |
|---|---|---|---|
| **Sent** | bytes handed to `sendText` and accepted by the pane | `logPrompt` + `Slot.history` (`server.ts:5508`, `:11868`) | a paste can be swallowed by a blocking screen; that is precisely why `waitForFoundingReadiness` exists and why the Codex trust-screen race was closed by refusing to paste, not by pasting harder |
| **Receipted** | a server-stamped fact that the delivery seam was crossed at a named tree | `context-receipts.jsonl` row written **after** a successful `sendText`, carrying `repo`/`head`/`branch`/`harness`/`model`/`effort` and a hash recomputable from the row alone (`server.ts:5489-5510`) | it proves *delivery*, never *reading*. The row is written by the sender. |
| **Loaded** | the model's context window actually contains it | **no sensor exists.** `ctx` on the owner poll is a token count, not an attribution, and it is `null` for GPT slots | nothing distinguishes "in context" from "scrolled past" |
| **Used** | the agent's act was shaped by it | **no sensor exists.** The nearest honest proxies are behavioral and after the fact: a lane that ran the `localProof.steps` it was pointed at, a report that quotes the tail it was told to quote | any claim here is inference and must be labelled as such |

Consequences applied throughout this report: §2 says "receives" only where a receipt or a
`sendText` exists; the fresh-MAIN row says "none" rather than "unknown" because the code path
demonstrably contains no delivery; and the §5 counter-proof reads the *ledger and the pane history*,
never the brief text alone. The general rule, and it is the one Fleet already lives by elsewhere:
**a prompt is an instruction, not a measurement.**

---

## 9. Role and layer contract

Nine roles. Each row is a contract, not a job description: (a) smallest must-load, (b) withheld by
default, (c) authority, (d) tools/evidence, (e) output and recipient, (f) lifetime/refresh trigger,
(g) which tracked note or pack owns the instruction. Rows marked *proposed* have no owning artifact
today — that absence is the finding, not a gap in this table.

**1. Owner / supervisor.** (a) nothing — the owner is the source of C3 and the only promoter.
(b) n/a. (c) sole authority to promote, confirm, land, deploy, and to convert a `notiz` into an
`auftrag`. (d) the board, `/api/context-receipts`, `/api/post-land-audits`, `state.sh`. (e) decisions,
to whichever session asked. (f) continuous. (g) `OWNER.md` (private, owner-curated) — unchanged.

**2. Fleet MAIN.** (a) C1 + C2(Fleet) + C7; i.e. `AGENTS.md`, `CLAUDE.md`, then `state.sh` and
`register.sh` before believing anything. (b) product/game layers (C3 of a target repo), role
overlays. (c) mutating inside Fleet, may commit; land is server-side; may found and brief lanes.
(d) `state.sh`, `register.sh`, live queue, `/api/self/*`. (e) one land or one measured report, to the
owner; `HANDOFF.md` at the threshold. (f) session-lifetime; refresh on every land and before any
claim about state. (g) `AGENTS.md` + `CLAUDE.md`. **Today receives zero founding bytes — gap G3.**

**3. Program-MAIN / Director.** (a) C1 + C2 (the *repository's own* root `AGENTS.md`, already
enforced for target repos at `server.ts:11609`) + C3 (Program JSON verbatim) + C7. (b) private Fleet
deploy overlay when working in a target repo; other Programs' content. (c) chooses the next bounded
act; proposes tasks; does not widen the Program. (d) git in its own repo, Fleet's Program/task/receipt
routes, clarification channel. (e) a bounded act plus its evidence, to the owner. (f) until Program
completion or succession; refresh on every HEAD move. (g) the Program record + the repository's
`AGENTS.md`; for the Director *discipline* — *proposed*, a repo-local role note.

**4. Implementation Builder.** (a) C4 (task brief with done criterion and `files`) + C6 (its proof
chain) + the narrowest C2 slice. (b) product strategy, other roles' surfaces, the full rulebook by
default (a `CLAUDE.md`-sized load is ~8% of a 258k window before any work). (c) mutating, its owned
files only; commits; never lands. (d) `rg`/`ast-grep`, `GET /api/self/gate` for `localProof.steps`,
`GET /api/self/drift`. (e) summary + quoted verification tail + one unresolved line, to whoever
briefed it. (f) one lane, one slice; dies at land. (g) `AGENTS.md ## Verify` + the task brief.

**5. Visual / gameplay Critic.** (a) C3 quality bar + creative direction + capture protocol + the
build under test. (b) **the Builder's reasoning and diff** — a Critic that reads the justification is
no longer blind; and the task brief's implementation plan. (c) read-only; proposes findings, promotes
nothing. (d) the running build, captures, named seeds/viewport facts. (e) ranked findings with named
evidence, uncertainty, and the smallest next experiment — to the Director and the owner.
(f) one artifact version; refreshes when the build changes. (g) *proposed*, repo-local Capture/Critic
note (§6).

**6. Researcher / scout.** (a) the bounded question plus its acceptance test. (b) write authority of
any kind; the repo's mutating context. (c) read-only, external reads allowed under the verb table.
(e) evidence and explicit unknowns, to the requester. (f) one question. (g) `AGENTS.md` request-verb
table (`ask/explain/review/diagnose` → read-only) — already normative, already sufficient.

**7. Code cartographer.** (a) the subsystem boundary to map and the symbol vocabulary. (b) product
intent and quality bars — a map is not a design. (c) read-only. (d) `ast-grep` for structural
questions, `rg -uu` for the git-ignored operational files (a plain `rg` returns *empty*, not an
error, on `CLAUDE.md`/`fleet.json`/the ledgers). (e) a map with file:line anchors, to the Director.
(f) one HEAD; stale the moment the tree moves. (g) *proposed*; today only `CLAUDE.md`'s tooling
paragraph, which no target repo has.

**8. Verifier / reviewer.** (a) C6 in full — the exact chain and how to judge it — plus the diff.
(b) the Builder's narrative of why it is correct. (c) read-only; may downgrade a verdict, never
upgrade one. (d) `GET /api/self/gate` (authoritative over any doc line), the suite tails.
(e) a verdict with the quoted tail, to the land path and the owner. (f) one tree; a `!head` marker
means the tree moved and the verdict is unverified — not wrong. (g) `AGENTS.md ## Verify` +
`docs/verify-tiering.md`, i.e. exactly the existing `verify-e2e` pack.

**9. Bounded aggregator.** (a) the N inputs and the merge rule. (b) authority to decide anything the
inputs left open — an aggregator that resolves disagreement is a Director wearing a cheaper hat.
(c) read-only; must preserve dissent rather than average it. (d) the inputs, nothing else.
(e) one synthesis naming every unresolved disagreement, to the requester. (f) one batch.
(g) *proposed*; `docs/scope-inflation.md`'s "cut the ranked list where the request is satisfied" is
the closest existing rule.

**The pattern across all nine.** Every role's *must-load* is one C-layer deeper than the role above
it, and every role's *must-not* is the layer that would let it exceed its authority. That is why the
withheld column matters as much as the loaded one: G2 (omission never reaches the reader) is what
makes a withheld layer indistinguishable from a nonexistent one.

---

## 10. The transcript, re-evaluated against this system

Read in full as an owner-authorized read-only source. Treated as a set of hypotheses to test against
current code, not as binding truth, and none of its prose belongs in any rulebook. Its own strongest
claim is precisely that: *the value is the derivation, not the file — do not copy it.*

**Where Fleet already holds the lesson, with a receipt.**

- *"Provider-shaped features need a decision per adapter, even if the decision is not-supported."*
  This is `AGENTS.md`'s adapter/surface invariant almost word for word, and §7 above is that
  invariant being executed. Fleet is ahead here: it also enforces the *reverse-state* and *wire
  contract* halves of the same checklist.
- *"Questions are read-only."* The request-verb table (`AGENTS.md`, hard invariants) is the same rule
  with a wider vocabulary and an explicit authority ladder (mutation ≠ commit ≠ land ≠ deploy).
- *"State file ownership upfront when several agents work in parallel."* Already a hard invariant.
- *"Match ceremony to the task; delegation is for breadth or adversarial review."* Present as an
  overridable default, and as the Director→Builder→Critic ordering in the studio doc.
- *"Lead with the problem, then the solution — never an implementation inventory."* Already the
  normative communication order.
- *"Give the agent a stop point."* Every mode in the verb table terminates at a named stop.

**Where the transcript names something Fleet has *material for* but does not do.**

- **Audit your own history for per-model/per-harness failure modes, then encode them.** This is the
  transcript's highest-leverage move and Fleet is unusually well-positioned: `lane-outcomes.jsonl`,
  `post-land-audits.jsonl` with an adjudication rail, `context-receipts.jsonl` carrying
  `harness`/`model`/`effort` per delivery, prompt logs, and per-lane branch joins. Nothing computes
  "which harness produces which failure class" from them. Note the ordering discipline this report
  is bound by, though: that is a *learning* layer (C9), it must stay propose-only, and it is not the
  slice — §5 stays §5.
- **A skill description is a trigger, not a summary.** Fleet's analogue is `ContextPackTrigger`, and
  it is structurally different: triggers are matched *server-side* against caller-declared facts
  (`context-plan.ts:61`), and the agent never sees a trigger vocabulary at all. That is arguably
  safer — selection cannot be talked into loading something — but it means the agent cannot request
  a pack it knows it needs, and cannot see the ones it did not get (G2).
- **Artifacts for the human (upload, HTML write-up).** The transcript's clearest statement is that
  the point of all this tuning is *communication with the owner*, not model competence. Fleet's
  owner-tasting loop needs exactly this capability and does not have it; the studio doc's
  Capture/Critic set (§6) is where it would be specified.
- **Model/harness attribution on the human-facing artifact.** Fleet stamps `harness`/`model`/`effort`
  on receipts and outcomes — machine side, owner-only. It does not appear on the thing the owner
  reads. Cheap, and it makes the per-model audit above possible from the artifact alone.

**Where Fleet is deliberately different, and should stay different.**

- *"Think of these instructions as good defaults; developer preferences override anything here."*
  Fleet's `AGENTS.md` splits this: overridable defaults may be overridden with a named scope and
  reason; hard invariants may not. A single global "you can override anything" would dissolve the
  land gate and the propose/promote boundary. Keep the split.
- *"Don't over-index on security for dev-mode features."* Correct for that repo's threat model, wrong
  as a transferable rule here: Fleet's fences and gates are the product property.
- The transcript's per-machine skill scoping maps onto `requiredCapabilities` + the omission ladder —
  and Fleet's version is stronger, because an unmet requirement produces a *named reason on a ledger*
  rather than an absent file. Closing G2 is what would let a reader benefit from that strength.

---

## 11. Unresolved

One line, as required: **whether the owner client renders any pack, omission or receipt surface is
unverified** — `src/client.ts` was not read for this report, so the §7 row for the owner client is a
flagged unknown and not a "not-applicable"; if such a surface exists, closing G2 would need to keep
it in sync.
