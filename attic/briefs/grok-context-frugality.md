# Brief: context frugality for long-running Claude Code sessions (to relay to Grok)

**How to use:** copy everything between the rules below into a fresh Grok conversation, unedited.
It is self-contained and carries our measured numbers, so the answer lands on our reality instead
of on generic advice. Kept to ~400 words on purpose: the constraints are what make the answer
connectable, the rest would be decoration. Nothing in it is secret — no host, no token, no path
outside this repo. Provenance of every number: `docs/supervisor-succession.md` §2 and `CLAUDE.md`
§"Kontext-Schwelle für eine MAIN-Session" / §"WENN DU EINE GPT-LANE BRIEFST".

---

I run a fleet of long-lived Claude Code sessions on one machine and want your best mechanism design
for operating them context-frugally. Engineer's answer, not a tips list.

Measured constraints — take these as given:

- Main sessions have 1M-token windows; foreign-harness lanes ~258k. Percentages below are against
  1M and **do not transfer**: fixed costs are incurred in bytes, so a 7.6%-of-1M cost is ~29% of a
  258k window.
- The only documented loss event is auto-compaction at ~83% fill. Below that, nothing is lost but
  nothing is free. Handover currently begins at 44%.
- Fixed costs, measured: grounding a fresh session to "I know where I am" ~7.6%; writing a handoff
  plus spawning a successor 2–4%.
- ~96% of spend is *input*, resent every turn — history and **tool output** (one turn's input hit
  78k tokens). Output was ~17k against ~429k input. The lever is tool-output discipline, not model
  choice.
- State is derived, not narrated: two scripts recompute it on demand (~1.2k and ~9.3k tokens per
  call). The handoff file carries only the residual — intent, work in flight, corrections, ordering.
- Succession over duration: instead of compacting, a session commits its handoff and the server
  opens a successor with a ~355-token founding brief of pointers (path + heading anchor, never
  copied source) plus a ≤500-character carry. Transfer ~0.04%; the successor's grounding ~7.6%.

Answer these four:

1. Succession costs full re-grounding; compaction is lossy but free. Where is the crossover, and
   which properties of the *work in flight* — not the fill level — should decide it? Name each
   choice's failure mode when made at the wrong moment.
2. What actually caps tool output — per-call truncation, write-to-file-then-tail, summarizing
   proxies, a harness-enforced per-turn byte budget? Rank by effect per implementation cost and say
   what each breaks.
3. When is a sub-agent returning only its conclusion strictly cheaper than inline work, once you
   count its own grounding and the fidelity lost in its summary? Give a decision rule usable without
   measuring each time.
4. What is the largest cost or risk in the above that I have not accounted for?

Requirements: mechanism depth only — I reject "use /clear", "be concise", "summarize periodically"
unless you give the specific trigger, the cost of that trigger firing wrongly, and how it is
enforced rather than remembered. Every recommendation names the measurement that shows it works and
the observation that falsifies it. Flag extrapolation beyond my numbers in the sentence that makes
it. Attack my framing where it is wrong — especially "succession over duration" and "handoff as
residual" — and say which constraint you would drop first and what that buys. ~800–1200 words, no
preamble.
