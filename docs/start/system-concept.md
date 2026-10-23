# Claude Fleet

**Fleet is the harness where hard agentic tasks get solved, shared and improved together.** That works because Fleet
turns the setup behind an agent from something scattered and invisible into something you shape on purpose, see
whole and share. What we build is the base for that. Solved hard tasks are its result.

Done well, the setup carries the work. One agent set up well already does a great deal. Where the process needs
more, it gets more: every further agent is built for its place in the process, one to check the work independently,
one to support the agent doing it, one to take the simpler part on a cheaper model. Each is free in every part of
its setup, from the harness and model it runs on to what it is told, what it reads and whom it works with, and what
it does follows from that. So the work comes out better, cheaper or both, and Fleet fits the task exactly. And
because all of it is written down in concepts and packs, the setup outlasts the task: it can carry the next process
too, and someone else can take the constellation, adapt it to their own work and build on it.

*Set up an agent well. See exactly what it gets. Share it.*

This is the system concept, the text every agent reads when it needs to understand what Fleet is. It replaces
`k-claude-fleet` v1.

## Why this exists

Agents can do far more than most setups let them. Give one a task worth its ability, the knowledge that helps it
and real room to work, and it does what used to take a team of people.

But the setup behind that agent is usually invisible. It is scattered across instruction files, flags, memories
and habits. Nobody can see it whole, so nobody can say what made it work, and nobody else can pick it up and
try it.

Fleet makes the setup something you can hold. You set it up, you see what the agent really gets, and you hand it
to someone else, who starts the same agent on their machine. That is the whole idea, and it is ambitious enough.

It can be this simple because everything an agent gets is text: its start, its role, the concepts and packs it
reads, the brief another agent hands it. Agents are told what matters and why, simply and ambitiously, and they
find the way themselves. Text can be read, changed and passed on, so a setup or a whole constellation of agents
can be built freely, shared with other people and improved by them. That is why the base has to be clean and easy
to understand: only what others understand can they build on.

## The base system

**Agent setup.** Everything an agent gets when it starts, in five parts:

- **Who:** harness, model, effort.
- **Start:** what the agent is told first. That can be a goal with "done when", a question, or nothing at
  all; plenty of good work starts as a conversation.
- **Reads:** its instructions and knowledge, in load order, each with its source and size.
- **May:** its permissions and its permission mode.
- **Works with:** who gives it work, whom it reports to, and when it ends.

None of the five parts is a form. You set what you care about, and the rest comes from defaults. Fleet shows the
whole setup before the agent starts and then starts exactly that. Every setup has a hash, so two setups can always
be compared.

**Constellation.** Several setups and the links between them: who gives work to whom and who reports to whom. A
constellation can take any shape: a builder with a checker, a finder with an independent prover, or one nobody has
tried yet. Most work still needs one well set-up agent. A second seat is worth it only when it brings something one agent can't have: an
independent check, another model, different rights, or more breadth than one agent can hold.

**Knowledge.** What an agent reads beyond its start:

- **Concepts:** what something is and why it matters. An idea becomes a concept once it is written well enough for
  an agent to understand it and work with it.
- **Context packs:** how to do a kind of work. A pack puts concepts to use and names the ones it needs.
- **The project's own rules.**

A setup points to knowledge instead of pasting it in. Fleet hands it over in one of two ways. Either it comes with
the start, or the setup holds a pointer that says when to read it. Most knowledge waits on a pointer until it is
needed. While it works, an agent also keeps a notebook. What should hold for others moves from the notebook into a
concept or a pack, where everyone can see it.

**Task and run.** A hard problem is worth sharing together with how it was solved. The task says what should be
different and how anyone can check it. The run records which setup worked on it, what the agents said to each
other, what it cost and how it ended. With both, anyone can see what the setup is about and what it does. Anyone can
take the setup from there, improve it and share it again.

**Sharing.** A setup or a constellation travels as one file with the knowledge it points to. Whoever imports it gives it
their own task; the task with its check and a run can come along as an option.

- **Knowledge is shareable or personal.** How-to packs and concepts travel. Personal knowledge stays home: the
  owner's corrections, and how to work with this owner in particular. Whoever imports a setup fills that place with
  their own. The owner decides which of his own things are worth sharing.
- **Every setup says where it came from.** A changed setup carries "derived from" and the hash of the one it
  started from, so improvements can be traced back.
- **An import starts carefully.** Whoever imports a setup sees beforehand what will run on their machine and what
  won't. The imported setup starts with the classifier on, never in bypass, until its owner has looked at it.

**The orchestrator.** The owner's own agent. Its start holds the direction the owner sets: where Fleet is going
now and how anyone can tell it got there. It takes Fleet there. For each piece of work, and for any idea the owner
brings, it sets up the agent or the constellation that fits, starts it and brings back the result. It is a setup itself, so it can be seen
and shared like any other.

That is the base. It stays small on purpose, so anyone can understand it in a few minutes and build on it.

## How we set up agents

1. **Ambitious tasks, real room.** Give an agent work worth its ability and the frame it needs, then let it work.
   We don't write ever-longer prompts.
2. **Purpose before rules.** An agent that knows why the work matters makes better calls than one that follows a
   list. Start with the why, then show what good work looks like, then name the few real limits.
3. **Ideas can become concepts, and concepts are knowledge.** How an agent should work, whether toward a goal, in a
   constellation or with the owner, is something it reads and understands, not a field someone fills in with one sentence.
   The idea is written down as a concept, and a pack is the how-to that puts it to use.
4. **What you see is what starts.** The setup Fleet shows is the setup that runs. There are no hidden layers.
5. **Gates in code, reasons in prose.** Nothing lands without a green check, and nothing deploys over a red
   audit that nobody has judged; the server enforces both. Texts don't repeat what the server guarantees.
6. **Small and simple.** A stranger understands a setup in two minutes. If it takes longer, it is too big. A hard
   task and its check may take longer to understand, as long as everything they need is in the shared file.
7. **The owner has the last word** on money beyond the budget, on anything public, on anything that can't be
   undone and on taste.

## How it runs today

Fleet is a local dashboard that runs agent sessions side by side in slots, each in its own terminal. Models from
other providers run inside a fence on a separate machine. Every agent works in its own copy of the code, so trying
a new setup is never risky. A code change passes through a merge check, a land and an audit before it is deployed.
A test instance runs the whole system in a sandbox. A shared file carries constellations, profiles and drafts of
context packs today. Tasks, runs and concepts don't travel with it yet.

## Where it goes

Where Fleet is going right now is the direction, which the owner sets and the orchestrator starts with. It changes
when it is reached.
