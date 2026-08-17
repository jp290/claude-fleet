# Brief: harness choice for transcript-audit workers (to relay to Grok)

**How to use:** copy everything below the rule into a fresh Grok conversation, unedited.
Self-contained, own measured numbers only, nothing secret. Provenance:
`docs/private-repo-e-worktrail-audit-2026-08-17.md` and the fleet rulebook's foreign-lane checklist.

---

I orchestrate long-lived coding agents on one machine and need a second opinion on **harness/model
choice for one recurring task shape: work-trail audits** — an agent reads other agents' transcript
files (JSONL, 8–19 MB each), runs python scripts over them (tool histograms, tool-output bytes,
context-growth curves, grind-loop detection), then mines them for BEHAVIORAL error patterns
(repeated dead ends, tool misuse, briefs that had to be re-explained) and proposes one-line rules.
The owner believes harness choice really matters for this task shape; tell us if that's right and
where.

Facts, measured:

- Options: (a) Claude-native in-session subagent (Opus-class, 1M window, spawned free inside the
  supervising session, results return into its context); (b) an isolated worktree lane on a
  foreign harness — GPT-class via codex or a pi bridge, **258k effective window** (272k × 95%);
  (c) same lane form with Claude. Foreign lanes need denser briefs (verify command spelled out,
  done-criterion as a checkable sentence) and report token fill themselves (the board can't
  measure a foreign slot).
- First run of this audit (Claude subagent): 86k tokens, 76 s, 5 tool calls — the raw JSONL never
  entered context because the analysis stayed in scripts; only findings crossed.
- The measured GPT profile on our machine: ~96% of spend is input (history + tool outputs resent
  per turn), output/reasoning is small. Fixed costs are incurred in bytes, so briefs must name
  files+line ranges and route big outputs to log files.
- Trust boundary: what an agent reads goes to its provider. The transcripts under audit are our
  own agents' full working history (code, reasoning, file paths of one machine).
- The behavioral half of the audit is judgement work: distinguishing "necessary aesthetic
  iteration" from "grind loop", and drafting rules a human will promote.

Answer these four, engineer's answer, not a tips list:

1. For the SCRIPT half (deterministic stats over JSONL): does harness/model choice matter at all,
   or is this a task where the cheapest reliable tool-runner wins and the window is irrelevant
   because data stays in scripts? Name the failure mode of over-provisioning here.
2. For the BEHAVIORAL half (pattern mining + rule drafting): what actually drives quality —
   model strength, context window (does it need to READ long transcript stretches rather than
   script over them?), or the brief's rubric? Would you split the two halves onto different
   harnesses?
3. Auditor independence: the first audit had a Claude-class agent auditing Claude-class workers'
   transcripts. Is same-family auditing a real bias risk for behavioral findings (blind spots
   shared between auditor and audited), and is a foreign-model auditor worth the denser-brief
   overhead purely for independence?
4. Given the trust boundary (full transcripts to a provider) and the 258k window, what is your
   concrete recommendation per audit batch: which harness for which half, what turn/token budget,
   and what in the brief prevents the auditor from inlining megabytes of JSONL into its context?
