# Claude Fleet

**Fleet is the harness where one agent becomes very capable, constellations of such agents solve hard tasks in the
highest quality, and many people build on each other's setups.** You steer it through your own agent. Fleet shows
every setup whole before it starts, and the setup travels as one file.

*Set up an agent well. See exactly what it gets. Share it.*

This is the system concept, the text every agent reads when it needs to understand what Fleet is. It describes how
Fleet is meant to work. Where today's Fleet is not there yet, the last section says so, and the direction names the
gap step by step. Check the code before you rely on a sentence here for what exists today.

## Why this exists

Agents can do far more than most setups let them. Give one a task worth its ability, the knowledge that helps it
and real room to work, and it does what used to take a team of people.

But the setup behind that agent is usually invisible. It is scattered across instruction files, flags, memories and
habits. Nobody can see it whole, so nobody can say what made it work, and nobody else can pick it up and try it.

Fleet makes the setup something you can hold. You set it up, you see what each agent really gets, and you hand it to
someone else, who starts the same setup on their machine and works at the level of the person who built it. That is
how the highest level of agentic work reaches almost anyone: few people need to build a great setup, and everyone can
take one, use it and improve it.

## The three stages

1. **One agent becomes very capable.** Fleet gives it what it can't have alone: knowledge it reads when it needs it,
   rights to act in Fleet, a successor that starts better than it did, and the ability to set up other agents.
2. **Constellations of such agents.** A task gets the seats it needs and the edges between them: one builds, one checks
   independently, one takes the cheaper part. The quality of the result lives in these edges.
3. **Many people build together.** Setups and knowledge travel. Whoever takes one can change it and share it again,
   and every version says what it was derived from.

Each stage stands on the one before. Most work still needs one well set-up agent; a second seat is worth it only when
it brings what one agent can't have: an independent check, another model, other rights, or more breadth.

## The base system

**Setup.** The one thing Fleet holds: one or more seats and the edges between them. A single agent is a setup with one
seat; a constellation is a setup with several. Every seat has five parts:

- **Who:** harness, model, effort.
- **Start:** its purpose (who it is and what it is for) and what it is told first: a goal with "done when", a
  question, or nothing.
- **Reads:** its instructions and knowledge, in load order, each with its source, its size and its author.
- **May:** its rights in Fleet and its permission mode.
- **Works with:** its edges: who gives it work, whom it checks or reports to, whom it may write to, and when it ends.

None of the five parts is a form. You set what you care about; the rest comes from defaults.

**Two hashes.** The setup hash covers everything that travels, each pack by its own hash. The start hash covers what
actually starts on this machine, your own files included, and names the setup hash it came from. So "this is the same
setup" and "what you see is what starts" can both be true.

**Rights.** Every power an agent has in Fleet is a right, granted to its seat directly or through its role: where and with which harness it may open seats
and how many, whether it may save setups, grant edges between seats, share, import, land, deploy, and spend. The person
grants rights, Fleet checks them at its own doors, and the start brief shows them. A seat never opens a seat wider than
itself, and no agent grants itself anything. The owner's key is the person's alone.

A role is a named bundle of rights with a start text and an address others can write to. Rights granted to a seat add
to its role; they take nothing from it. Because its power is written down as rights, a role can travel like any other
setup, and whoever imports it confirms its rights.

Some limits only the harness can hold, such as which shell commands run. They are as strong as the harness's fence,
and the start brief says where Fleet sets no fence.

**Knowledge.** What an agent reads beyond its start:

- **Concepts:** what something is and why it matters.
- **Context packs:** how to do a kind of work. A pack puts concepts to use.
- **The project's own rules.**
- **Its notebook:** what it learned, for its successor.

Knowledge is the unit that flows between people. Every pack and concept has an id, a hash and an author. Packs, roles
and concepts are shared building blocks: any setup can use them, your own or someone else's, one seat or a
constellation. A setup points
to the knowledge it reads and carries its text when it travels, so a second Fleet needs nothing but the file, and the
same pack is recognisable by its hash in every setup that uses it. Whether knowledge is personal is a property it
carries wherever it goes, not an entry in a list: personal knowledge has a place in a shared setup, never a text, and
whoever takes the setup fills the place with their own. A text a seat reads may be written only by someone with the
right to write it.

**Agents write agents.** An agent may write setups, purposes and context packs, give its successor new stones and open
the seats its rights allow. Everything it adds shows in the start brief as a + line with its author. Costs, anything
irreversible and rights stay with the person. This holds on every harness that reads text, not only Claude Code.

**Steering.** You steer Fleet through your own agent. It becomes the steering agent by reading the pack that names the
doors its rights open, and by the rights you give it. A role gives it the rights such work needs in one step, and a
right it lacks shows as one sentence naming it, never as a stall. An orchestrator is such an agent with a direction to work toward;
Fleet's own orchestrator is one with Fleet's direction.

**Task and run.** A setup brings everything needed to use it. You give it its task. It may also bring a task with its
check and a run: which setup worked on it, what it cost, what the harness refused it, and how it ended. Fleet judges
no setup and stamps none; people judge by taking it.

**Sharing.** A setup travels as one file.

- **Every setup says where it came from.** A changed setup carries "derived from" with the setup hash of the one it
  started from, and that one's own line back, so a chain of improvements stays readable across many hands.
- **An import starts carefully.** Whoever imports sees beforehand what will run, which rights it asks for and which
  personal places they fill. An imported setup never starts in bypass and gets no right its new owner didn't confirm.

That is the base. It stays small on purpose, so anyone can understand it in a few minutes and build on it.

## How we set up agents

1. **Ambitious tasks, real room.** Give an agent work worth its ability and the frame it needs, then let it work.
2. **Purpose before rules.** Start with why, then show what good work looks like, then name the few real limits.
3. **Ideas become knowledge.** How an agent should work is something it reads and understands: a concept, and a pack
   that puts it to use. Not a field, not a parameter.
4. **What you see is what starts.** No hidden layers.
5. **Gates in the server, reasons in prose.** Nothing lands without a green check, nothing deploys over a red audit
   nobody judged, and no Fleet door acts beyond the caller's rights. Where only the harness's fence holds a limit, the
   start brief says so.
6. **Small and simple.** A stranger understands a setup in two minutes.
7. **The person has the last word** on money beyond the budget, anything public, anything that can't be undone, and
   taste.

## How it runs today

Fleet is a local dashboard that runs agent sessions side by side, each in its own terminal. A reachable Fleet is code
execution as your user, because every session is a shell. A seat without a role in a folder outside Fleet's repo
starts your agent as you would start it by hand, plus what you switch on. Models from other providers run on a
separate machine; whether a harness runs inside a fence differs by harness. In a git repo, a session can work on its
own branch. A test instance runs a copy of Fleet on its own port, state and terminals, so a change can be tried before
it lands.

Not there yet: rights are four switches that Claude Code applies, not checks at Fleet's doors, and saving, sharing and
importing setups take the owner's key. Fleet's orchestrator role is offered only in Fleet's repo, and an import never
starts in a role. An agent, a profile and a constellation are still three objects in two file
formats, and a start has one hash. Edges exist as writing permissions the orchestrator grants for a while. The
direction names each gap and how to tell it is closed.

## Where it goes

Where Fleet is going right now is the direction, which the person sets and the orchestrator starts with. It changes
when it is reached.
