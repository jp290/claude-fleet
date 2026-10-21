# Setting up an agent

Read this before you set up an agent or a constellation. It covers what to decide and what has worked here.

## The five parts

Every agent gets five things when it starts. Decide the ones that matter for this work and leave the rest at
their defaults.

- **Who:** harness, model and effort. Choose for the work. Does it need judgment, breadth, speed or low cost? What
  this machine can run right now: `GET /api/harnesses`.
- **Start:** what the agent is told first. An agent that works for someone else gets the connecting piece below. An
  agent the owner will talk to needs a sentence, or nothing at all. There is no goal field. If the work should
  pull hard toward a goal, point the agent to the pack `working-toward-a-goal`.
- **Reads:** its role if it has one, the project's rules, and pointers to knowledge. Point instead of pasting. Leave
  out what it doesn't need, because everything in its start takes attention away from the task.
- **May:** its rights and its permission mode. Keep them pragmatic: block only what has real consequences. An act
  that only the owner's token can do stays with you. A setup someone else shared starts with the classifier on,
  never in bypass, until the owner has looked at it.
- **Works with:** who gives it work, whom it reports to and when it ends. Each event has one reporter, and only
  results and stops come to you.

## One agent or two

One well set-up agent is the default. A second seat earns its place only if it brings one of these:

- an independent check
- another model
- other rights
- more breadth than one agent can hold

If you can't name which of the four it brings, set up one agent.

## The connecting piece

Whatever you hand an agent (a task, a card, a message) has at most five parts:

- **Why:** what it serves, in one or two sentences.
- **Goal:** the result, and how anyone can tell it is done.
- **What you need to know:** facts and pointers it can't find on its own, plus known traps.
- **Limit:** only if there is a real one.
- **Back to:** where the result goes.

It never says how to do the work.

## Before you hand it over

- Run every command, path and wake-up in the brief yourself.
- Say what the agent may decide on its own. Without that sentence, a good agent asks instead of building.
- Write for the model that gets it. A weaker or less familiar model needs more about the situation and more
  material, not more prohibitions.
- Ask it to say at the end, in one sentence, what was missing from its start.

## How seats start today

- **A free session in its own folder:** `POST /api/slots/<n>/open` with cwd, label, model and effort. The
  `CLAUDE.md` in that folder is its agent file.
- **A branch session with a task:** `POST /api/branches/open`, or `POST /api/self/branches/open` from a session.
  The opener and the branch session form a pair that may message each other.
- **A model from another provider:** pi on the workhorse, inside the bwrap fence, in rounds. One round is one run
  with the task and the last verdict, and report and verdict are stored as files. Example:
  `~/local-notes/agent-objekt-bau/runde.sh`.
- **Reporting back:** `./ctl.sh send --orchestrator <file>`, at most 2000 characters. A lane gets a 409 there; its
  result arrives as a fleet-report.
- A mailbox message doesn't wake a session yet. If the message matters, nudge the session with a `/send`.

## Two examples

- **One agent.** The free agent on slot 16. Its whole setup is a 0.7 KB `CLAUDE.md` in its own folder, with no role
  card. It starts with about a third fewer tokens than the orchestrator.
- **Two seats.** A builder and a checker for a server change. The builder is DeepSeek Flash, working in rounds on
  the workhorse. The checker is Sonnet on the Mac, the only seat that can test against real transcripts. The
  second seat brings another model, an independent check and access the builder doesn't have.
