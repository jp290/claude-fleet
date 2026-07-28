# One capability, three investments — the program frame

*Concept note 2026-07-23 (JP + session; steward corpus-mining evidence same day). The
umbrella frame the individual designs (steward, merge-review, orchestrator) grew toward
without naming it. Captured so lanes, pulses, and future sessions inherit it — analysis
left uncommitted is invisible (the CLAUDE.md doc-collision lesson, applied to ideas).
Sits above `steward-intelligence.md`; changes no gate. Status: frame + evidence;
the re-weighted priorities are in `steward-roadmap.md`.*

## 1. The premise (what makes the program rational)

A demonstrated capability: an LLM, given a simple human prompt IN CONTEXT (conversation,
project, drawn data), can understand intent at an **origin-preserving and complementary**
level — it keeps what the human actually meant AND supplies what the task needs that the
prompt didn't say. `/sharpen` is the working proof, run turn-by-turn for weeks. Everything
below is a bet on this capability being real, improving, and worth capitalizing.

## 2. The three investments (JP's framing, corrected mapping)

1. **Agency** — give AND teach the steward the tools and environment to use Fleet
   **in parallel with us**: a second user of the same workbench, not a downstream
   effector. "Give" = tokens, routes, rituals (built). "Teach" = OWNER.md, the doctrine,
   the learning loop (half-built: the bootstrap exists, the continuous loop has never run).
2. **Ground** — capture deterministic data layers of the relevant work steps, embedded
   in **simple systems**. The context that intent-understanding rides; facts outrank
   claims. (Verdicts+verify, land notes, digest, git — the strongest axis.)
3. **Memory** — track all working sessions in detail and evaluate them on multiple
   levels. The material from which understanding of THIS owner's intent gets specific,
   and from which the structural prompts (sharpen included) sharpen themselves.
   (Weakest built axis: capture rich, evaluation nearly absent.)

sharpen is NOT one of the three — it is the premise under all three. The steward is not
an output of the machine — it is investment #1.

## 3. Why it compounds (not adds)

Every artifact is **triple-purposed**: a deliverable, a training signal for the learning
loop, and a legible input for the next stage. A merge verdict with verify is a land-fact
AND a data point on resolution quality AND what the foreman reads "ready" from. Better
facts → cleaner learning data → sharper prompts → a more capable steward → more
work-product → more facts. The recursive igniter: the learning loop evaluates sharpen
itself against the axioms — the intent compiler sharpens from the record of what the
owner previously meant. (Gated: §5.)

## 4. The three-readers norm (simplicity is load-bearing, not style)

Every artifact and route must be cheaply legible to **three readers: the human, the
model, and a deterministic check.** This is why the substrate is git, jsonl, tmux, plain
files, small routes — `git log --notes` is readable by all three; a distributed event
system by none cheaply. Simplicity is the interface norm BETWEEN the three investments
(and, incidentally, the smallest injection/failure surface). Future lanes inherit this
as a design bar: prefer the artifact all three readers can read.

## 5. The governors (the constitution of a collaboration, not a leash)

1. **Origin quality inverts in importance** — higher leverage amplifies wrong intent as
   faithfully as right intent. The better the compiler, the more the input matters.
2. **Verification coverage bounds compounding** — the flywheel is trustworthy exactly as
   far as the fact layer reaches; where facts end, claims re-enter and the owner's eye
   is required. ("Build V2 maximally well" is the currency of autonomy, not diligence
   aesthetics.)
3. **The human clutch on self-modification** — sharpen-sharpens-sharpen is exactly the
   §8 gate: propose-never-apply, owner promotes. A self-rewriting intent compiler sits
   on the never-cross line by design.
Under the peer picture (investment #1) these are not a tool's leash but the rules under
which two users of one workbench can trust each other. Land + deploy stay owner-only
forever regardless (OWNER.md §4b).

## 6. Evidence: the sharpen-corpus mining (steward, 2026-07-23)

The steward mined the fleet-tracked conversations for what `/sharpen` actually does,
then had the model adversarially hardened (two checker agents: overclaim + completeness).
Result (advisory — see limits):

- **/sharpen = re-alignment onto JP's setpoint along a drift axis.** The content-empty
  word triggers reconstruction; the pair (situation × running intention) fixes axis,
  direction, magnitude. The axes are **bidirectional** (same dimension corrected both
  ways: check-first 18.7% AND ask→act 4.4%; breadth→depth AND local→systemic).
- **Cross-validation, the strongest find:** the top-3 drift corrections converge exactly
  with OWNER.md §2's review bar — two independently built artifacts, same core. The
  owner-model has its first external confirmation.
- **Honest limits (self-marked):** ~7-8% of the corpus is explicit-instruction +
  decoration-word; records are Sonnet pass-1 readings (claims, one inference layer —
  understanding-grade, not hard statistics); correction types are often stock (3 vectors
  cover much mass) with JP-specific instantiation.
- **The guard that must survive into any use:** the axes model is a *naming lens, not a
  lookup* — axis+direction+magnitude+instantiation still require the live read of the
  pair. "Understand in order to author, not to tabulate." A situation→mechanism table
  would discard the second coordinate (intention), which only exists live.

Open owner decisions (asked by the steward in its pane, unanswered as of writing):
durable home for the corpus (`~/.claude/knowledge/sharpen-corpus/` — shared reality,
owner call) and the altitude question (is the axes lens right, or still too structural).

## 7. What this changes now (the re-weighting; details in steward-roadmap.md)

- **Learning engine v1 rises to the next major focus** — it is axis 3's first real turn,
  axis 1's teaching half, and the first measurement of the premise. Brief exists
  (`briefs/learning-engine-v1.md`); the steward's corpus model is its founding input.
- **Foreman §6.2 (event triggers, server-side guards) demotes to on-demand** — compounding
  comes from axis 3, not from more coordination throughput (§7 review-capacity coupling).
- **BACKLOG §17 (retrieval layer) elevates to the decision behind the learning session**,
  which will supply its requirements empirically.
- **Unchanged:** V3 (thinnest ground + cheaper review), arena before B-partition,
  land+deploy owner-forever.

Teaching-step care (the user's explicit flag): the corpus model enters prompts only via
propose-never-apply; evaluator prompts must themselves be axiom-built (§8
self-referential quality); and the model's own claims-layer caveat rides along wherever
it is cited.
