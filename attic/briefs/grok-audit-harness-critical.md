# Brief: adversarial follow-up on the harness answer (to relay to Grok)

**How to use:** copy everything below the rule into a fresh Grok conversation (or the same one as
`briefs/grok-audit-harness.md`, as a follow-up). Optional: where marked [OWNER RESEARCH], paste the
key claims/sources from the owner's own research before sending — the answer gets sharper if Grok
must engage the specific evidence rather than a strawman.

---

You (or a peer model) previously advised us that harness/model choice is "almost irrelevant" for
the script half of transcript audits and secondary for the behavioral half — strong model + tight
rubric dominate, same-family bias is real but secondary, cross-family auditors are a special case.

We are not satisfied. Independent research on our side concluded the OPPOSITE: that harness choice
is critically important for exactly this task shape. [OWNER RESEARCH: paste the key claims,
benchmarks, or sources here — what the research said, for which harness, measured how.]

Your previous answer may be the comfortable consensus; the research may be a hype train. Settle it
adversarially, not diplomatically:

1. **Steelman the opposite of your previous answer, at full strength.** Make the strongest
   evidence-based case that harness choice IS decisive for transcript-audit work — not model
   strength in general, but the harness layer specifically: tool-execution reliability, how the
   harness truncates/represents tool output in context, agentic-loop scaffolding, context
   management (compaction, caching), structured-output enforcement. Which of these mechanisms
   plausibly moves audit-finding QUALITY (not cost) by a large factor, and what published or
   reproducible evidence supports each?
2. **Name what would make your previous answer wrong.** Under what measurable conditions does
   "cheapest reliable tool-runner wins" fail — e.g., a harness whose tool-result truncation
   silently corrupts the evidence packs, or whose script execution flakes at a rate that
   invalidates statistics? Be concrete: what failure rates or output-handling behaviors flip the
   conclusion?
3. **Separate hype from mechanism.** Current discourse heavily promotes specific harnesses for
   "agentic" work. Which commonly cited advantages are marketing or benchmark leakage, and which
   are load-bearing mechanisms that survive on first principles? Say plainly which claims you
   would bet against.
4. **Design the decisive experiment we can run locally in one evening.** We have real audit
   batches (8–19 MB JSONL transcripts) and can run the SAME audit brief on 2–3 different
   harnesses (Claude-native subagent, a GPT-class lane, a pi-bridged lane). Specify: what to hold
   constant, what to measure (finding overlap, precision of grind-loop calls against a
   human-adjudicated sample, evidence-pack fidelity, token cost), what result size would count as
   "harness matters critically" vs "harness is secondary", and the main confound that would make
   the result meaningless if we get it wrong.

Do not average. If the research is right, say your previous answer was wrong and why. If the
research is hype, name the specific claim that breaks and what evidence would change your mind.
