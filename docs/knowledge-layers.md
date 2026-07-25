# The knowledge layers — where a lane looks things up

*Assessment 2026-07-25. The question that produced it: **does Fleet need a proper place —
maybe a service — where lanes and agents can look the project up?** The answer is no, and
this doc is the reason why: three layers already carry that load, each with a stated idea,
and each falling short of its own idea in a specific, nameable way. Line refs drift — every
claim below names a **symbol**; grep it.*

---

## 1. Why not a service

The service question is already decided, and the decision still holds. `BACKLOG.md` item 17
is a decision record (2026-07-23, stress-tested against a survey of open-source RAG stacks):
**ingestion is solved, retrieval is missing**, and *"server.ts already IS that common
service"*. A peer process was rejected on the one-server doctrine; Phase 2 (semantic) is
parked because the embedding source is unsolved on an allowlisted network.

A second store would also make the *actual* failure mode worse rather than better. The
recurring defect in this repo is not "an agent could not find the knowledge" — it is **the
knowledge said something that was no longer true** (`discrepancy-audit.md` exists for exactly
this). In-repo docs version atomically with the code they describe; an external copy adds a
second content identity that drifts on its own schedule. Nothing in the evidence below is a
lookup failure. Everything in it is a currency, coverage, or feedback failure.

So the real subject is not *where* the knowledge lives. It is whether each layer does what it
says it does.

## 2. The three layers, and the one sentence each is judged against

| | Layer | Carried by | Its own bar |
|---|---|---|---|
| **L1** | **Static project knowledge** | the `docs/` shelf + `docs/README.md` as index; `CLAUDE.md` | *"a session which loads it makes fewer first-pass mistakes"* (`README.md` §"The bar") |
| **L2** | **Task knowledge** | `tailored-context.md`, `lane-brief-template.md`, `briefs/` | first-pass output reliable enough that **review is a glance, not an audit** |
| **L3** | **Outcome memory** | `lane-outcomes.jsonl`, the ③ reviewer, `perception-layer.md` | Fleet can see **what its work turned out to be worth** — the precondition for capability (c) |

These map onto the four capabilities in `docs/README.md`: L2 *is* capability (b), L3 is what
gates (c), and L1 is the substrate both read.

---

## 3. L1 — the static shelf

**As built.** There is no index process and no lookup API: **the worktree is the delivery
mechanism.** `git worktree add` carries all of `docs/` into a lane, and `createWorktree`
(grep it in `server.ts`) additionally copies the *gitignored* scaffolding — `.env`,
`CLAUDE.md`, `.claude/settings.local.json` — behind a `git check-ignore` filter, so a copy can
never show as untracked and make the lane permanently dirty. (Verified: `CLAUDE.md` **is**
gitignored here, so the index's claim about it is accurate.) Every lane therefore starts with
the full shelf and the operating rules already in place, at zero runtime cost.

**Gaps.**

1. **The index asserted the wrong world state about the most consequential open question —
   within one day.** `docs/README.md`, `perception-layer.md` line 1, and `HANDOFF.md` all
   described the perception layer as *unbuilt* after commit `600d401` had landed its write
   side. **Cost:** a lane that loads the index for orientation — its designed use — concludes
   that (c)/(b) are still to build, and may re-propose or re-implement them. This is the
   expensive kind of rot: not vague, but actionable and wrong. *(Corrected in the same commit
   as this doc.)*
2. **A dangling pointer.** The index listed `docs/right-tab-agents.md`; the file does not
   exist. Every other doc was correctly indexed — the index was *complete*, just not *true*.
   *(Corrected.)*
3. **Two whole artifact classes were invisible to the index:** `briefs/` (12 tracked filled
   briefs) and `docs/proposals/` (5 proposals). These are precisely what a lane would look
   for — *"what did a good brief for this kind of task look like"*, *"what has already been
   proposed here"*. `BACKLOG.md` item 17 additionally still claimed `docs/proposals/` does not
   exist. *(Corrected.)*

**The structural point behind all three: rot has no detector.** `discrepancy-audit.md` is the
manual substitute, and it did not catch the "unbuilt" claim, because a human pass runs when
someone remembers to run it. Two mechanical checks would have caught findings 1–3 outright:
*every* `` `docs/x.md` `` pointer in the index resolves to a file, and no doc says "unbuilt"
about a symbol that exists in `server.ts`.

## 4. L2 — the briefs

**As built.** `tailored-context.md` §6 sets the hard constraint: a brief must never be an
untracked file in the worktree, because that makes the lane dirty and blocks `land`. The lived
practice satisfies it neatly — `briefs/*.md` are **tracked**, so they are invisible to
`git status`. `lane-brief-template.md` is the pattern, and its "Lessons earned" section carries
a genuinely self-critical correction (2026-07-25): the entries are *instances, not a growing
checklist*, because both recorded faults were discoverable inside the repo and were therefore
**attention-allocation failures, not information failures**. A brief's job is the residue —
what exists only in the conversation.

**The gap, and it is the sharpest one in this document.**

**The dispatcher does not brief.** `tickDispatch` ends on `sendText(free, next.text, true)` —
the queue task's **raw text**. No template, no ENVIRONMENT section, no done-criterion, no
silent-complement clause. The machinery that could produce one exists: the prompt enhancer
(`ENHANCE_PROMPT`, route `/api/enhance`) is the same throwaway-worker pattern — but it is a
manual ✨ button on the compose bar and sits nowhere near the dispatch path.

**Cost, in two directions.**

- *Quality.* `docs/README.md` names briefing (b) the capability that is **safest to expand
  first**, and the whole apparatus — principle doc, template, earned lessons — exists to serve
  it. The one **automated** producer of lanes is the one that uses none of it. That is exactly
  the "thin case" `tailored-context.md` §4 holds up as the negative example, and it lands on
  the lanes nobody watched being born.
- *Blindness — the worse half.* `laneOwnerPrompts` counts only journal lines with
  `source === "owner"`. The dispatcher logs its delivery via `logPrompt(..., "auto", ...)`.
  So a dispatched lane's outcome row gets `ownerPrompts: 0` and `briefHash: null` — or, worse,
  the hash of the owner's first **follow-up**, while the field is documented in `server.ts` as
  *"stable short hash of the lane's FIRST owner prompt (the brief)"*. `briefHash` and `model`
  are recorded as a deliberately **entangled pair** so that brief quality can eventually be
  learned. The lane class whose briefing most needs measuring is the one that reports either
  nothing or something mislabelled.

## 5. L3 — outcome memory

**As built, and built carefully.** Commit `600d401` landed pieces (c) and (b) of
`perception-layer.md`:

- `reviewState` is the single derivation of *"which tree is this review about"* for all three
  readers — the owner's ③ click, the auto path, and the staleness relation.
- `startReview` freezes `{key, cwd, branch}` at start and re-checks them before the cache
  write, which makes two real bugs unreachable rather than unlikely: filing a result under a
  caller's newer key, and filing lane A's findings under lane B after a slot recycle.
- `patchIdOf` implements the §5 content-identity rule with `git patch-id --stable`, so a
  rebase-land does not chronically mark reviews superseded — and deliberately does **not**
  normalize context lines, because an edit by main within ±3 lines of a lane hunk is precisely
  the interaction the review never saw.
- `tickAutoReview` carries every §4 guard rail: lanes only, never `⚙ steward`, at most one
  attempt per git state (`reviewAutoTried`, written **before** the spawn so a *failure* is
  remembered too), max 2 concurrent throwaway sessions, and fresh `gitOpInProgress` reads
  rather than the ~10s cache. `killSlot` clears both maps.

**Gaps, ranked.**

1. **(b) is built and has produced zero data.** All three rows of `lane-outcomes.jsonl` carry
   **no** `review` field — including row 3 (`perception-write`), the lane that built the
   mechanism and landed before the server restarted into it. The write path has never run in
   production. **Cost:** a field nobody reads is a field whose defects nobody notices.
2. **(a) is still missing, so the ledger is write-only *in effect*.** `GET /api/lane-outcomes`
   returns rows sorted newest-first with a clamped limit, and **no client consumes it**
   (`grep lane-outcomes src/client.ts` → nothing). **Cost:** capability (c) stays gated, and
   with it parallel dispatch — which was never blocked on capacity.
3. **A prompt land structurally beats auto-③.** `outcomeReview` deliberately never awaits an
   inflight review — correctly, since an advisory agent has no business in the land path's
   critical section. But the chain in front of it is long: a 60s idle threshold, plus up to a
   15s tick, plus up to a 180s agent run. An owner who lands a finished lane promptly gets
   `state: "inflight"` or `"none"`, permanently. This violates no rule in the design; it is an
   **unmeasured assumption inside it** — and the modal row may well be the review-less one.
   Nothing would reveal that today, because (a) is missing. This is the case for building (a)
   before anything else.
4. **Rows 1–2 are rows of zeros.** `commitCount: 0`, `filesTouched: []`, `shortstat: ""` on a
   `landed` disposition. Row 3 is healthy (`6 files changed…`, `verified: true`), so the
   recorder works now. The design already forbids calibrating on them; a renderer must show
   them as *not measured*, not as *measured zero*. Belongs in lane (a)'s brief.

---

## 6. How the layers sabotage each other

The three failures are not independent — they form a loop with no closing edge:

- **L1 → L2.** A briefer who takes the index as the truth about project state writes the
  ENVIRONMENT section against a world that no longer exists — and the brief is exactly the
  artifact a lane stops re-checking, because it arrives pre-curated.
- **L2 → L3.** With no brief on the dispatch path, `briefHash` is null or misnamed for
  dispatched lanes. The learning-fuel column sees one regime and takes it for all of them.
- **L3 → L1.** With no feed, nothing ever corrects the docs *from reality*. The only feedback
  is a manual discrepancy audit — which is why L1 is the layer that rots.

**Perception is the missing closing edge**, not merely a feature of L3. That is the
non-obvious reason to build the reader first.

## 7. What to do first

1. **Lane (a) — the outcome feed.** Not for the UI: because it is the **first reader**.
   Without it, (b) stays unverified and gap 5.3 stays unmeasurable. The design and its two
   honesty constraints are already written (`perception-layer.md` §6: *empty findings ≠ clean*;
   `↩ undo` is one-step only) and rows 1–2 need the not-measured rendering from §5 gap 4.
2. **The dispatcher brief.** The building blocks exist (template + the enhancer's
   throwaway-worker pattern). Ship it together with an honest provenance for the injected
   text, so `briefHash` describes the brief instead of silently rounding to `null` — otherwise
   the improvement is real and unprovable, which is the trap this repo has already documented
   ("promoting any prompt edit as an improvement while no eval set exists" is a listed dead
   end).
3. **A rot detector for L1.** Two mechanical checks, cheap enough to ride along with any lane
   that touches `docs/`: every index pointer resolves, and no doc calls "unbuilt" what
   `server.ts` defines.

The ordering is deliberate: **(1) before (2)** because (2) without measurement repeats the
listed dead end, and **(3) alongside either**, because it is the only one of the three that
prevents its own class of failure from recurring.

---

## Verification record

**Read (2026-07-25, main at `600d401`):** `server.ts` — the review/auto-③ machinery
(`reviewState`, `startReview`, `reviewResponse`, `patchIdOf`, `tickAutoReview`), the outcome
assembly (`outcomeReview`, `laneOwnerPrompts`, `briefHashOf`, `buildLaneOutcome`),
`tickDispatch`, `createWorktree`, the `/api/lane-outcomes` route; `docs/perception-layer.md`,
`docs/tailored-context.md`, `docs/lane-brief-template.md`, `docs/README.md` in full;
`BACKLOG.md` item 17 and the execution register; all three rows of `lane-outcomes.jsonl`,
parsed.

**Not read** — no claim here rests on them: the `steward-*` docs, `operating-model.md`,
`three-axes.md`, the merge/land path, the e2e suites, `src/client.ts` beyond greps.

**Not run:** no suite. This assessment changed no code; §7 is where the code changes are
proposed, and each of them owns its own verification.
