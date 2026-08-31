# Brief: improvement ideas for a multi-agent working circle (to relay to Grok)

**How to use:** copy everything below the rule into a fresh Grok conversation, unedited.
Self-contained; carries only our own measured facts, no hosts, tokens, or names. Provenance:
`docs/working-circle-analysis-2026-08-17.md` (seam-level analysis, all claims code-anchored) and
`docs/arbeitskreis-aufstellung-2026-08-17.md`.

---

I run a self-built orchestration system ("fleet") for long-lived Claude Code sessions on one
machine, organized as a working circle. I want your best structural improvement ideas — mechanism
design, not tips. Current shape, measured:

**Roles:** an Owner (human, bearer token; only principal who confirms/promotes anything) · a
persistent Supervisor session (reads a typed portfolio view over 5 ledgers; may only PROPOSE
programs, and NUDGE a program's MAIN with exactly one bounded question to a derived receiver — it
cannot dispatch, land, deploy, or write code) · one Program-MAIN per active program (synthesis,
briefing workers, review, commits; typed attention channel to the owner: decision/blocked/
review-ready) · workers in two forms: isolated git-worktree lanes with a server-side land gate, or
in-session background subagents (no isolation, no ledger) · sensors (server-side watches on
lane/merge/audit/deploy predicates, delivered once to a pane or an owner inbox; a deterministic
code-cleanliness sweeper with no scheduled consumer yet).

**The one invariant:** propose/promote everywhere — no producer ever writes the anchor it is
measured against; everything becomes binding only through the owner.

**Measured gaps, ranked by what they cost (take as given, all hit live):**

1. A Program-MAIN loses its typed owner channel exactly when the program closes — the final
   report, the artifact a program exists to produce, falls back to terminal prose. Same 409 also
   hits the Supervisor (fix proposed).
2. Founding-brief delivery is proven for exactly one harness (an accept-marker readiness probe);
   every other harness gets a paste after a sleep — the brief can be swallowed with no error
   anywhere while the delivery ledger reads healthy. Hit twice in one day. General rule we
   learned: "delivered" means the terminal accepted keystrokes, never that a session read it; a
   stale-ack sensor now measures the difference (observed: delivered +3 s, acknowledged +368 s).
3. A target repo can declare a hard quality contract (context packs with hardness levels,
   receipted at an exact commit); it reaches only the MAIN's founding brief — neither the lane
   that writes code nor the reviewer that judges the diff receives it.
4. Five ledgers (lane outcomes, context receipts, deploys, post-land audits, adjudications) are
   joined into the Supervisor's view — and nothing ever reads a prior outcome into a new plan. No
   learning loop. The Supervisor also has no lineage: succession overwrites a single binding, so
   cross-time memory is handoff prose.
5. Completion signaling from workers is a git/idle heuristic ("done-looking"); there is no typed
   worker→MAIN "review-ready". Concurrency control counts lanes, not files — file-level collision
   between two lanes is doctrine, not mechanism.
6. A non-owner orchestrator (measured: a foreign-model MAIN running research workers) cannot
   dispatch at all; a human relays brief-files and result-files by hand. The file relay has no
   delivery evidence: nothing distinguishes "worker found nothing" from "worker never ran".

Answer these four, engineer's answer:

1. Which of the six gaps would you close first, and with what minimal mechanism that preserves
   propose/promote? Name the failure mode of closing it wrong (e.g., a learning loop that
   auto-applies past outcomes is exactly the anchor-writing we forbid).
2. The delivery problem (gap 2) generalizes: keystrokes-into-a-terminal is our only inter-session
   transport. What is the cheapest delivery-receipt design that proves a session CONSUMED a
   message, not that a terminal accepted it — without giving sessions a general message bus we
   deliberately don't want?
3. Learning loop (gap 4): design the smallest consumer of the five ledgers that improves the next
   brief without becoming an auto-anchor. Who reads it, at which seam, and what does the owner
   promote?
4. What are we structurally missing that none of the six gaps name — a role, a channel, or an
   invariant you would expect in a system of this shape and don't see?
