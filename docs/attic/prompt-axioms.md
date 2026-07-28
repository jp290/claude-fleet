# The axioms of a good prompt — and how to keep improving them

*What makes a prompt good, derived from what a prompt **is**, with the axioms put
in relation. Primary principle — the theory under `tailored-context.md` and the
`/sharpen` family. It deliberately records the **derivation method** (so the
reasoning is reproducible, not just the conclusion) and **how to work from this by
results** (so it stays a living tool). This doc is written to obey its own axioms.*

---

## The derivation method — how these were found (reuse this move)

Don't collect techniques; that's surface, and it doesn't compose. Derive from the
mechanism. Ask: **what is a prompt, and what is it for?** A prompt is context that
shapes the internal representation a model builds while generating — and the
output is a function of that representation. So the whole game is: *induce the
right internal model, then extract the right slice.* Every axiom below is then
either a way to **serve** that model or a way to **allocate** how much you spend
building it. One root, axes around it, a cost-clamp holding them together. When you
need a prompt axiom you don't yet have, re-run this move: what does a good prompt
do to the internal model, and what does it cost?

## A0 — the root

**Output quality is set by the completeness of the internal model the prompt
*induces*, not by the explicitness of its instructions.** The model answers from
the representation it builds; a prompt's job is to make that representation
complete and correct. Everything else is means to this end. (`tailored-context.md`
§3.)

## Grounding axis — build the right model (A1 → A2 → A3, a built-in tension)

- **A1 — Environment before instruction.** Put the model where the task's world is
  legible (the files, constraints, definition of done) before and around the ask.
  A thin task in a bare environment floats: ungrounded and brittle to anything the
  prompt didn't spell out.
- **A2 — Implicit-complement capture.** The most reliable grounding *induces* the
  model to construct the surrounding, **complementary** parameters — edge cases,
  "what would make this wrong," adjacent state — **silently**. Not the core ask,
  but the world around it: the *implicitly relevant* questions. A2 is A1 sharpened:
  not "hand over the environment" but "make the model build the complement itself."
- **A3 — Relevance over completeness.** Relevant surroundings ground; irrelevant
  bulk buries the signal. Curate, don't accumulate. A3 is the counterweight that
  keeps A1/A2 from bloating — so the grounding axis is itself a tension: more model
  ↔ less noise.

## Aim axis — point the model (A4 → A5)

- **A4 — Done-criterion with its verification.** State what "finished and correct"
  means *and* what proves it. Grounding without a target produces a well-reasoned
  answer to the wrong question.
- **A5 — Verification-first.** Make the done-signal as deterministic as possible
  (compiler / test > execution > LLM-judgment), so "done" is a fact, not a hope.
  A5 sharpens A4.

## Extraction axis — get the slice out (A6)

- **A6 — Output contract: emit only the relevant.** Keep the complementary
  reasoning internal; emit only the requested slice. A6 is the **twin of A2**:
  build wide internally, emit narrow externally — two halves of one motion.
  Over-emission re-creates the review bottleneck the whole discipline exists to
  avoid.

## Meta axis — allocate the others (A7 → A8 → A9, sits above)

- **A7 — Calibrate to the instance before executing.** "Think about how you must
  think about this." Frame *how* to approach this particular task before running
  any procedure. This is what keeps a prompt from decaying into a checklist.
- **A8 — Dose discipline to the expected failure, not maximally.** Add exactly the
  checks this task and this executor need, chosen by failure mode. More is not
  better; discipline has a cost.
- **A9 — Match the prompt to executor and destination.** A strong executor on
  familiar ground needs a check or two (it fails by stopping early, not by
  reasoning badly); a weak/unknown or fresh executor needs everything embedded.

## The relations — a hierarchy with a cost-clamp

- **A0 is the root** — the reason the others exist.
- **Grounding (A1–3), Aim (A4–5), Extraction (A6)** are the three *build* axes that
  serve A0 directly. A2 + A6 are two halves of one motion; A3 is the
  self-contradiction that keeps grounding honest.
- **Meta (A7–9)** sits *above* the build axes: it decides how much of each to
  apply. It is the compiler that doses the others.
- **The clamp:** every axiom trades a cost for reliability — grounding costs tokens
  and can bury signal, discipline costs rigidity, extraction costs trust. The meta
  axis is the **allocator** that spends the budget where the expected failure sits.
  A good prompt is not maximally grounded and disciplined — it is **optimally
  allocated.**

**Master sentence.** A prompt is good exactly to the degree it induces the
completeness of internal model the task requires (A0), by *curated* grounding
(A1–3) aimed at a *checkable* done (A4–5), extracted as a *thin slice* (A6) — with
the whole dose *calibrated* to this instance and executor (A7–9), never maximized.
Completeness of the implicit model sets the ceiling; calibration sets how much you
spend to reach it.

## Self-reference

The axioms apply to themselves. `/sharpen` *is* a prompt that compiles prompts by
these axioms; a lane brief and the Rundgang are prompts built by them. "`/sharpen3`
never missing" is A7 made habit — never fire a raw prompt without the calibration
pass.

## Working from this by results — how to keep improving the axioms

These are a **working theory, not scripture** — refined from outcomes, the same
prove-by-results discipline as the rest of the project (`automation-frontiers.md`,
the journal).

- **A prompt is validated by its results:** a correct first pass and cheap review.
  That is the only real signal it induced the right model (the README bar: *does a
  session that loads this behave more reliably?*).
- **When a prompt underperforms, diagnose by axiom.** Wrong answer to the right
  question → grounding gap (A1–2) or over-stuffing (A3). Right-shaped answer to the
  wrong question → aim gap (A4–5). A wall to wade through → extraction gap (A6).
  Rigid or ill-fitting → mis-calibration (A7–9).
- **The library earns its place by results.** A prompt/workflow template graduates
  — and eventually gets scheduled — only after its results prove out
  (prove-before-schedule). When one recurs and reliably produces good output, it is
  a library item; when the axioms behind it generalize, they update *this* doc — by
  evidence, not by argument.
