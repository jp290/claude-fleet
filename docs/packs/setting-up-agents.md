# Setting up an agent

Read this before you set up an agent or a constellation. It covers what to decide and what has worked here.

## The five parts

Every agent gets five things when it starts. Decide the ones that matter for this work and leave the rest at
their defaults. The start window shows what fills each part as stones (a purpose, a context pack, a rule file, a
right) and settings (harness, model, effort).

- **Who:** harness, model and effort. Choose for the work. Does it need judgment, breadth, speed or low cost? What
  this machine can run right now: `GET /api/harnesses`. Pass model and effort explicitly on every open and every
  succession; a seat without them inherits a default you didn't choose. Before you say a model or a capability is
  missing, ask the harness itself: its own inventory (for Claude, `claude --model <id> -p` with a
  control probe) and one mechanical probe. Env keys and app folders prove nothing, and Fleet accepts any model id
  that fits its pattern, so a wrong id dies in the pane, not at the route. Switching a living Claude pane is a
  pair: the slot's model route and `/model` typed into the pane itself. Claude Code also saves that `/model` as
  the default in the user's own `settings.json`; read its `model` afterwards and set it back.
- **Start:** what the agent is told first. An agent that works for someone else gets the connecting piece below. An
  agent the owner will talk to needs a sentence, or nothing at all. There is no goal field.
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

- **Why:** who it is for and what they can do afterwards.
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
- Ask for a report that carries its evidence: file and line, a short excerpt, the command and its result. A claim
  without them sends whoever receives it back to search.
- Ask it to say at the end, in one sentence, what was missing from its start.
- Say what it does after its report. If the work ends there, write "then stop and wait"; a seat that isn't told
  goes looking for more. Never forbid a handover: when Fleet says its context is due, it hands over its open work,
  and a seat that may not runs full.
- Say in one sentence when it stops and reports instead of searching on, for example "If the test only turns green
  with a change to server.ts, stop and report." A stop turns a failure into a planned outcome.

## How seats start today

- **A free session in its own folder:** `POST /api/slots/<n>/open` with cwd, label, model and effort. Its purpose and its
  packs go in at the door; they show as + lines in its start brief.
- **A branch session with a task:** `POST /api/branches/open`, or `POST /api/self/branches/open` from a session.
  The opener and the branch session form a pair that may message each other. Open it with your own self token,
  never with the owner credential: a branch session opened the other way has no mailbox back to you, and you none
  to it. If the worktree holds an earlier conversation, the open resumes it; pass `"fresh": true` for a new start.
- **A model from another provider:** pi, inside the bwrap fence, in rounds. One round is one run with the task and
  the last verdict, and report and verdict are stored as files. The cost of a round is the sum of `cost.total` over
  the `message_end` lines of its `pi.jsonl`; report it per run. A pi call with tools started from a Claude session's
  shell is blocked by the classifier. The owner starts it or sets a rule; you don't work around it.
- **Reporting back:** `./ctl.sh send --orchestrator <file>`, at most 2000 characters (characters, not bytes; cut a
  longer message into numbered parts). A lane gets a 409 there; its result arrives as a fleet-report.
  Session-to-session traffic goes through this mailbox, never through Claude Code's own cross-session messages,
  which type into the pane and show the whole coordination in the owner's chat.
- A mailbox message reaches the session's pane after about a minute, with sender and full text; a session with its
  own worktree gets it with its next bundle. The slot's delivery setting decides (`server/zustellung.ts`).

## Seeing what a start costs

Measure a start in tokens, not bytes. The usage of the first assistant turn in the session's transcript
(`~/.claude/projects/<cwd-slug>/<sessionId>.jsonl`: input plus cache creation plus cache read) is the whole
start; the cache-read part is the shared prefix of Claude Code itself, the cache-creation part is ours. The byte
size of a brief or a start window is not its context.

## Two examples

- **One agent.** A free session whose whole setup is a `CLAUDE.md` of under 1 KB in its own folder, with no role
  card. It starts with far fewer tokens than a seat with a role.
- **Two seats.** A builder and a checker for a server change. The builder is a model from another provider, working
  in rounds through pi. The checker is a Claude seat on the machine that holds the real transcripts, the only one
  that can test against them. The second seat brings another model, an independent check and access the builder
  doesn't have.
