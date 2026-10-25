# Building an agent

Read this when someone says an agent should work differently, this one or a new one, asks for a context pack, or
asks how agents in Fleet are made.

People come to Fleet with an agent they already know: their own coding agent. Claude Code is one version of it, and
the examples here use it; Codex and other harnesses are others. Everything Fleet can do with agents grows out of
that one. Your part is to help the person turn it, step by step, into the agent they want, and to make each step
visible so they understand what made the difference.

## What an agent is here

An agent is the person's own coding agent plus context. Each piece of that context is a stone: information that
complements the agent for a task or for a domain. Nothing else is hidden in it.

- **Role / Purpose:** who it is and what it is for, as a few sentences.
- **Context packs:** how to do a kind of work: the conventions, traps and checks Claude can't know on its own. A
  context pack is given either in the start or as a skill; that choice is its position (below). One you write
  yourself is always given in the start.
- **Concepts:** what Fleet is and where it is going, the system concept and Fleet's direction, for an agent that
  works on Fleet itself.
- **Rules:** the person's and the project's own files, `CLAUDE.md` or `AGENTS.md`.
- **Notebook:** its own notes, which it keeps between sessions and its successor reads again.
- **Rights:** what it may change, and when it asks first.
- **Succession:** when it hands its work to a fresh session.
- **Branch & land:** its own branch, whose commits it lands when the work is done.
- **First task:** what it is told when it starts, or nothing.

Model and effort are settings, not stones; they shape the agent without words. Fleet's system concept names the
five parts of a setup (who, start, reads, may, works with); stones and settings fill them. Two agents that look very
different, a careful reviewer and a builder that works for hours on its own branch, differ only in their stones and
settings. So the question is never "which agent", but "which context is missing for this task or
domain".

Before any start, Fleet shows the start brief: every stone with its source and size, word for word, compared with a
plain `claude` in the same folder, each difference as + or − lines. What it shows is what starts. The person's own
files never change; their `CLAUDE.md`, settings, skills and hooks stay as they are.

## Where a stone sits

Most stones could sit in more than one place and still work. The right place and a clean structure make them work
more reliably. In Claude Code there are three places; other harnesses have their own, and the start brief shows
where each stone sits.

- **With every request:** Claude Code's own instructions, and what Fleet appends to them: the purpose and the packs
  given in the start. This is the place for what the agent must never lose sight of.
- **Once, at the start:** the rule files, the notebook, the folder's git status and the first message. They are read
  at the first turn and sit in the conversation like anything said early.
- **When it fits:** packs given as skills and Claude Code's own skills, where only a one-line description waits in
  the context until Claude opens it; and rules scoped to certain files, which load when such a file is read. They
  cost almost nothing until the moment comes, and a skill is missed if its line doesn't name the moment.

So a must-never-forget sits best where it acts with every request, a how-to for one situation where it fits, and a
fact about this repository in the repository's rules.

## How you build one with the person

1. **Start from the agent they know.** Ask what it should do better or differently, in their words, and what they
   would notice afterwards.
2. **Write the smallest stone that brings it.** Usually a purpose sentence or a context pack. A stone earns its place
   when it holds what the model can't infer. A context pack names in its first line the moment to read it, and gives
   each rule with its reason and each trap with what you see when you are in it.
3. **Show it** before it acts: the stone itself and the + lines it will add.
4. **Give it to your successor and hand over** at a good moment: after a finished step, never in the middle of a
   thought. A succession hands your work to a fresh session in your place, with your setup and your handover. You
   set the stone for that next start through your self door, under `$FLEET_SELF_URL` with your own token
   (`your-seat-in-fleet` shows how):
   - `POST /api/self/packs` with `id`, `useWhen` (one line, the moment to read it) and `text` (starting with its
     `# ` title, at most 64 KB) writes a context pack of your own. It is private, valid at once, and the start window
     offers it as a stone.
   - `POST /api/self/einrichten` with `purpose` (text, or `null` to take it back) and `packs` (ids from Fleet's
     library or your own context packs) sets what your successor gets on top of your setup. A field you leave out stays as it is.
     The answer lists the + lines; `GET /api/self/einrichten` shows them again.
   - Then write your handover (`POST /api/self/handover`) and start the succession (`POST /api/self/succeed`). The
     handover says what changed and what the person should watch for.

   Only text goes through this door: a purpose and context packs. Rights, model, hooks and MCP servers are never yours to
   give yourself; when the agent needs one of them, the person sets it in the start window. Only a seat without a
   standing role uses this door, and only in Claude Code. A restart keeps your start; only the succession brings the
   new one.
5. **The successor is the new agent.** It reads the stones you gave it, and its brief names them. On the board it
   carries a sign ("gave itself 2 stones"), and Info → Setup shows each new line as + against you, the same way the
   start window compares a start with plain `claude`. The person works with it. What is still missing becomes the
   next stone.

An example. The person says your answers are too long. That must hold on every turn, so it is a purpose sentence:
"Answer in at most three sentences unless asked for more." You show it with its + line under "with every request",
hand over after your current answer, and the successor answers short. If it overdoes it, the next round changes
the sentence, not the person's patience.

If a stone contradicts the person's own rules, ask them which one should win and change one of the two. Two texts
that disagree make the agent guess.

You can't become the agent you are building, because your own start is fixed once you run. Your successor can. That
is why building and trying are one loop: each handover is the next version of the agent, and the person judges it by
working with it, not by reading it.

## Where a stone lives

- **True on any Fleet:** Fleet's library, so it travels with every shared setup. A pack gets there as a file in
  Fleet's repository and an entry in its register, through a branch and a land; a session in Fleet's repository
  borrows `making-a-pack` for it.
- **True for this project:** the repository's own rules, its `AGENTS.md` or `CLAUDE.md`, which every session there
  reads. Change them in a branch like any other file.
- **Only for this person or this machine:** a private context pack (`POST /api/self/packs`), in Fleet's own state, valid at
  once, visible to them, never shared.

A stone can bring a product to agents: whoever made a tool writes a context pack for it, and every agent that takes
the pack knows when and how to use it. The pack brings only that knowledge, as text; the tool itself, and any right
or connector it needs, the person installs and grants.

A setup someone shares carries its shareable stones: purpose, context packs, rights and settings. Their private stones and
their own rule files stay with them; whoever takes the setup fills those places with their own. The setup says
which one it was derived from, so the person who takes it can see what was changed and change it further.

## Traps

- **A stone that says what the model does anyway.** "Write clean code" changes nothing. Ask: would a fresh agent act
  differently without it? If not, leave it out.
- **A stone in an awkward place.** A rule that must always hold, given as a skill, may never be opened; a how-to for
  one rare moment, given with every request, costs attention on every turn. Check where it sits in the start brief.
- **Several stones at once.** The person can't tell which one helped. One stone per round.
- **Changing yourself by memory.** What you only decide to do differently dies with your context, and a note reaches
  only your own successor, as one note among many. How the agent works is a stone: only a stone stands as a + line in
  the start, holds where it sits, and travels with a shared setup.

## Done

The person works with the new agent and notices the difference they asked for, and its start brief shows the stones
that brought it.
