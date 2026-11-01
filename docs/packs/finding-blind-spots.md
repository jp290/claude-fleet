# Finding blind spots

Read this when you look for the places where agents in Fleet act without information the system already holds, and for
the regressions that come from it. You judge and report; you change no code.

A blind spot is a fact that exists somewhere in the system, that an agent needs for a decision it makes, and that never
reaches it. The agent then guesses, and even a good guess undoes or repeats work someone else did. Over weeks it shows
as regressions: a problem fixed and back again, an owner decision given twice, two seats building the same thing.

## What counts

- **The fact exists.** It stands in a door's answer, a ledger, a notebook, a file in the agents' folders, another seat's
  transcript. If nobody has it, it is a missing feature, not a blind spot.
- **Someone needs it at a decision.** Name the seat, the moment and the act: "a lead choosing which seat takes a request",
  "a builder deciding what done means".
- **It does not reach them.** Their door doesn't return it, their start doesn't carry it, or it reaches them only as a
  pointer they never open.
- **A deliberate limit is not a blind spot.** The owner's key, a personal text kept from another provider, a private
  seat: each has its reason in the code or in the owner's corrections. Read the reason before you count one. A finding
  that would open a deliberate limit goes to the owner as a question, never as a gap.

## Where to look

- **Regressions first.** Fix commits that say "again", "wieder", "back", "regression", or that undo an earlier commit
  (`git log --grep`, `git log -S`), and the defects list `docs/neuaufbau/maengel.md`, lines that returned. For each, ask
  which fact the author of the broken change lacked.
- **Owner view against seat view.** Compare what the owner's routes return about a session (read their handlers in
  `server.ts`; never call them with the owner's key) with what a seat's own doors return (`GET /api/self`,
  `/api/self/constellation`, `/api/self/messages`). Every field the owner sees and a lead needs is a candidate.
- **Information that falls off.** Rings with a cap, truncations, "stored but not delivered", "not re-addressed",
  handovers cut to a length. A count of what fell off is a lead, not a finding: find one agent that acted without it.
- **Knowledge in one place only.** A seat's notebook, a handover file, a strand folder no other seat reads. The test:
  would the next seat that needs it find it from its start?
- **Owner corrections given twice.** The same word from the owner on two dates means the first did not reach the seat
  that needed it.

## How you work

- **Read code to understand, count only to size.** A statistic says how often; only the code path says why.
- **Give breadth to helpers.** Fact-finding over many files or transcripts goes to subagents on a cheaper model, with
  `file:line` evidence; you judge on top and check each claim you rank on.
- **Check what is already known.** The current plan under `docs/neuaufbau/` names several blind spots; ask the
  planning seat or the orchestrator which plan holds. Say "known", and add only what is new or what the plan misjudged.
- **Name the smallest carrier.** For each blind spot: the existing door that could show it, or the pack line or
  correction scope that would bring it. Build on what exists; never propose removing a mechanism the owner keeps.

## The report

Per blind spot, ranked by what it cost: the fact and where it lives (`file:line` or route); who needs it, at which
decision; one regression it caused, with evidence (commit, defects line, transcript excerpt); whether the plan has it
already; the smallest carrier. End with what you did not verify and what was missing from your start.

## Traps

- **Every limit looks like a gap from inside.** You are in it when your carrier would hand a seat the owner's key or
  someone's private text. Read the correction or the code comment first.
- **A cause guessed from a commit subject.** The subject says what changed, not what its author lacked. Read the diff,
  and where there is one, the session that made it.
- **An echo.** A finding the plan already names, written as new. Check before you rank.
