# The steward nudge — a content-free re-alignment trigger, fired on a surface signal

*Design doc, 2026-07-25. Owner's idea, worked out against the evidence that already exists.
Nothing here is built yet.*

**This is not a new mechanism.** It is two existing things joined:

- **`continue-nudge`** — intervention type #3 in `steward-autonomy.md`'s playbook v1, which already
  has a manually-proven predecessor in the mined corpus (the doctrine forbids automating any
  intervention type that lacks one). Today its trigger is `idle + task sent`. This doc widens the
  trigger to a *momentum* signal and sharpens what the message may contain.
- **Consumer #2 of the sharpen-corpus** — `~/.claude/knowledge/sharpen-corpus/model.md` states it
  verbatim: *"Authoring Fleet's overhead prompts as control primitives. Because the axes are
  nameable, an overhead prompt can be authored to reliably evoke a chosen correction — understand it
  to author it, not to tabulate it. Guarded by the boundary condition: a scheduled sharpen-prompt only
  earns its place where a real gap forms."*

Read those two first. This doc adds the design constraints, the limit, and the measurement.

---

## 1. The idea in one paragraph

The steward watches what it can already see about a running lane — commit rhythm, idle duration, a
dirty tree that keeps growing, test files untouched, the founding task versus what has actually been
committed — and when that surface suggests a lane may have drifted, it sends a **short, simple,
content-free, purely positive** prompt: the owner's own activating vocabulary ("gib dir Mühe", "denk
gut nach", "own your work"). It never says what is wrong, because it does not know.

## 2. Why this works where a smarter design cannot

The sharpen-corpus models a correction as a function of **two** coordinates:

> `f(situation, running intention) → corrective vector`

`situation` is observable. `running intention` **is not a surface feature** — THE GUARD in `model.md`
proves it with #92 vs #191/#192: the same visible surface ("agent asks for direction") resolves to
*opposite* corrections (decide-yourself vs delegate-completely), because the determining coordinate
lives in the owner's head. A table keyed on the surface therefore **fails**, and flattening the axes
into `situation-type → mechanism` is named as "the specific error this corpus exists to prevent".

The nudge routes around this by **splitting the function at the right seam**:

| | supplies | from |
|---|---|---|
| **steward** | *when* — the timing only | surface signals it already senses |
| **session** | *what* — both coordinates, and the resolution | its own brief (the externalized running intention) and its own state |

Nothing is looked up. The steward never generates a resolution; it presses a button whose content
comes into existence only inside the receiver. **THE GUARD is therefore not violated** — and the
distinction is load-bearing, not a technicality:

- last output → *"is a gap likely here?"* → fire a content-free trigger. **Legitimate.**
- last output → *"here is what is wrong, do X"* → forbidden, and provably wrong (#92/#191).

This also answers the natural implementation question ("could we just give the writer the session's
last output?"). The corpus's own rows are exactly `{situation = the ≤1400-char tail of the agent
output, prompt = the resolution}` — so the last output is *demonstrably* the right input for
detecting a gap. It is *demonstrably insufficient* for choosing the content.

## 3. "Purely positive" is a safety property, not a tone

This is the subtlest part of the design and the reason it can be deployed at all.

`model.md`'s boundary condition: **no gap → sharpen idles** — "self-contextualizing, harmless when
nothing changed". That harmlessness holds *only* for a content-free, non-evaluative trigger.

A message that carries a diagnosis ("this is too shallow", "you missed X") is no longer empty: it
asserts something. If the assertion is wrong, a capable model **will conform to it** — told it was
shallow, it digs deeper whether or not that was needed, and invents a problem to justify the
correction. The false positive is no longer free.

"Gib dir Mühe" cannot do that. There is no claim to conform to; the receiver can only re-read its own
situation against its own intention and find nothing. **So the steward is allowed to be wrong** — and
a mechanism whose false positives cost nothing is a mechanism that can run unattended. Everything
else in this design follows from that property; give it up and the whole thing needs a human again.

## 4. The limit: a positive trigger has a direction bias

A content-free positive trigger always means *more* — more care, more depth, more ownership. But the
corpus's axes are **bidirectional**: alongside `check-first` (~18.7%) and `surface→root-cause` (~11%)
sit `ASK→ACT` (~4.4%), `scope-creep→discipline`, `parallel→sequential`, and `negative-verdict→
keep-searching`. Roughly: the nudge covers the "more" half and **cannot express "less / narrower /
stop"**.

The failure case is concrete: a lane already five rounds deep in a structural problem, told "gib dir
Mühe", digs *further in*. That is the one situation where the harmless trigger is not harmless.

**Consequence — do not widen the nudge to cover it.** The other half already has mechanisms, and they
must keep it:

- `stuck-looping` → the structural-stop nudge (playbook #2 family), not this one.
- `awaiting-human` / `unknown` → **escalate, never improvise** — the standing rule for exactly the
  case where the running intention must be *re-set* rather than re-applied. Renewing the intention as
  a situation changes shape is the owner's act and is not automatable; it is the escalation boundary.

So the gating logic must be able to say "this looks like a *stop*, not a *more*" and hand off. When in
doubt between the two, escalate — under-nudging costs a delay, mis-nudging costs a deeper hole.

## 5. What the steward can actually see today

More than the idea assumed. Both of these already exist on the owner-read surface the steward is
restricted to (`steward-autonomy.md` joint 1 — never `capture-pane`):

- **the lane's founding task** — the steward sessions view carries it (id/status/source/text; the e2e
  suite asserts this by name), i.e. the *externalized running intention*;
- **the commit history and git delta since last look** — the momentum signal.

Founding task versus what has actually been committed is a real, surface-level drift indicator. Not
the intention in the owner's head — but the written one, and divergence from it is visible without
anyone guessing.

## 6. Guard rails (inherited, non-negotiable)

- **Cap 1 per lane per condition episode, then escalate.** Empirical, not cautious: "a second
  identical nudge never helped in the corpus either."
- **One allowed intervention type per condition**; `escalate` is the default for anything unmatched.
- Delivery only through the server's gated send path with the scoped steward token (idle gate,
  claude-alive gate, slot re-verification), `[steward]`-prefixed so transcripts stay attributable.
- **The line that is never crossed** stands unchanged: no queue promotion, no land/merge/kill, never
  answering in the owner's voice, never acceptance ("sehr schön" is the owner's review and stays his).
- The nudge is advisory to the *session*, never to a gate. It cannot widen what auto-lands.

## 7. How we will know if it works (measure, do not argue)

The data already flows, and the instrumentation is free:

- Steward sends land in the prompt journal under their own source. It currently reads **`steward: 0`**
  — so every nudge is unambiguously attributable from day one.
- The lane outcome row carries **`ownerPrompts`**: a lane that took its brief and landed unaided
  records 1; every human correction adds one. Both lanes of 2026-07-24 recorded 2.
- Since the recorder fix (deployed 2026-07-25 00:16) the rows also carry `commitCount`,
  `filesTouched`, `e2eTouched` and a real `verified` — so lane *shape* is comparable, not just count.

**The question:** do nudged lanes need fewer owner corrections, at comparable shape? Secondary: does a
nudge ever precede a *worse* outcome (the §4 failure mode)?

**Honest prior, stated before the data exists:** both lanes so far needed exactly one correction, and
both were for defects no surface signal would ever have seen — a timeout set to the value of a
server-wide constant, and `??` failing to distinguish explicit `null` from `undefined`. A nudge might
have prompted the session to re-interrogate its own assumptions; whether it would have found *those*
is unknown. That is the open question, and it is measurable rather than debatable.

## 8. The corpus re-analysis this design needs

The existing corpus (205 situations, 182 resolved) was mined 2026-07-23 and answers *what* the owner
corrects. It cannot answer the question this design turns on:

> **Could a machine have known *when*?**

That is the feasibility question, and it is answerable from artefacts that already exist —
`rebuild.py` regenerates the situations from `~/.claude/projects` transcripts, which are the durable
source of truth. For each corpus record, reconstruct the *surface state* at that moment (idle
duration, dirty tree, commits since last look, task vs commits) and ask whether a machine gate would
have fired. Three outputs, all decision-relevant:

**Corrected 2026-07-25 — this paragraph overpromised; verified against the artefacts before
building on it:**
- **Dirty-tree state at a past moment exists nowhere.** `gitInfo`/`aliveInfo` are in-memory maps;
  `saveState` persists none of it; no journal writes slot state over time. Of the four gate inputs
  above, at most two (idle-as-transcript-gap, commits-from-git-history) are reconstructible.
- **Idle is reconstructible only as a transcript-timestamp proxy**, while a deployed gate would
  read `lastOutput` (pane-stream, with `quietUntil` suppression) — the retro feasibility number is
  measured on a *different signal* than the built gate would use, and does not transfer 1:1.
- **Precision (output 2) has no data source at all**, retro or current: it needs surface state at
  non-intervention moments, which nothing samples. The build order below is therefore partly
  circular — part of the deciding measurement needs instrumentation first. The minimal unlock is a
  **forward recorder**: (a) at every owner/terminal prompt, append the target slot's deterministic
  surface (idleMs, dirty, ahead, alive) to a durable file; (b) a downsampled per-lane surface
  sample per tick. (a) alone buys recall after N days; (b) is what makes precision computable.
- **`ownerPrompts` is surface-confounded**: it counts only `source === "owner"` (UI-composed
  sends); pane-typed prompts are harvested as `"terminal"` and excluded — the live journal holds
  ~90 owner vs ~747 terminal records, and dispatcher-delivered briefs log as `"auto"`. Any §7
  metric built on it measures which surface the owner typed in, not how often he corrected.
- **Corpus records carry no timestamp/session ref** (`situations.jsonl`: proj, summary, quote —
  verified across all 205); re-anchoring each record into its transcript is new mining via quote
  matching, not a lookup, and the 7 stitched quotes will not re-anchor exactly.
- **The journal changes regime mid-corpus** (added 2026-07-25, counted first-hand — see
  `discrepancy-audit.md` F1 for the commands). Both the journal and the terminal harvester were
  introduced 2026-07-19 (`3f70922`, `ec1ad26`), so 1573 of 2441 records are retroactively
  reconstructed by a script that is not in the repo, tagged with a `backfill` source that
  `logPrompt`'s own type union does not contain. Reconstructed `owner` records exist (earliest
  `owner` ts predates the journal itself) and are indistinguishable from native ones. **Hard
  boundary for the retrospective: use only records from 2026-07-19 onward, and treat
  `ownerPrompts` on any lane whose cwd predates that date as unusable.**

What §8 can honestly deliver from existing artefacts: **recall and the direction split, on the
idle-proxy signal, minus dirty-tree conditions.** Precision needs the forward recorder plus N days
of normal operation — which argues for shipping the recorder *early and small*, since its data
only accrues from the day it lands.

1. **Recall** — of N real sharpen moments, how many had a surface signal at all? Low recall means the
   nudge fires rarely; that is acceptable (it is additive), but it must be known, not assumed.
2. **Precision** — how often would that gate have fired when the owner said nothing? Each such firing
   is a free false positive *by §3* — but only if §3 holds, so this number is also the test of §3.
3. **The direction split** — what fraction of real corrections were "more" (nudgeable) versus
   "less/stop" (§4, must escalate)? This sizes the mechanism's actual reach honestly.

Two things are genuinely new since the corpus was built and should be folded in rather than re-running
the same pass:

- **Outcomes now exist.** The old corpus is `(situation → resolution)` with no outcome column; the
  lane ledger supplies one for the first time. Correlating a correction to what the lane *then did*
  was previously impossible.
- **New, unusually well-documented situations** — the 2026-07-24/25 session alone contributes ~10
  sharpen invocations whose restatements were printed, whose work is committed, and whose outcomes are
  in the ledger.

**Carry the corpus's own caveats forward:** the tags are LLM (Sonnet) readings — *claims*, one
inference layer, "solid for understanding, not hard statistics"; 7 of 182 quotes are stitched rather
than verbatim; ~5% fit no single vector. Do not let a second pass launder those into hard numbers. And
`situations.jsonl` remains ground truth — the axis model is an index into it and must never be run as
a rule table.

## 9. Build order

1. The re-analysis (§8) — it is pure measurement over existing artefacts and it decides whether the
   gate is worth building. It touches nothing live.
2. The gate: which surface conditions fire a nudge, and which route to escalate instead (§4).
3. The send itself — it is `continue-nudge` with a widened trigger and a stricter content rule; the
   delivery path, caps and audit trail already exist.
4. Read the measurement (§7) before widening anything.

**Do not build a prompt writer.** The corpus's own finding is that the corrective *type* is largely
stock ("three dominant vectors cover much of the mass — the *instantiation* is what re-anchors
JP-specifics"), and this design deliberately does not instantiate. A small fixed vocabulary of
content-free triggers is not a compromise; it is the ceiling THE GUARD imposes, and it is enough. Put
the intelligence budget into the *timing* decision, where it is allowed to live.
