# Writing for agents

How we write roles, briefs, concepts and context packs in Claude Fleet, and why.

## Principles

1. **Purpose first.** Open with why the work matters and what the agent is part of. An agent that understands the
   goal makes better calls than one that only follows rules.
2. **Show good work.** Describe what a good result looks like, concretely, before naming any limit.
3. **Few limits, each with its reason.** Keep a limit only if the agent can't infer it and the system doesn't
   enforce it. Give the reason in half a sentence.
4. **Knowledge by reference.** Point to a concept or pack and say when to read it ("before you land, read …").
   Don't paste it in.
5. **No history in instructions.** Incidents and measurements explain why a rule exists. They belong in a measurement note
   or a commit message, not in the text an agent reads at every start.
6. **Plain words, one name per thing.** Use the vocabulary of the system concept. No metaphors, no capital letters
   for emphasis, no walls of MUST.
7. **Built for scanning.** Short sections with headings, one idea per sentence, lists only for real lists.
8. **The two-minute bar.** A stranger should understand the text in two minutes. That is the bar for anything we
   share.
9. **English for anything that may be shared.** Agents talk with the owner in the owner's language.
10. **Judge a text by what an agent does with it.** Before a start text goes live, give it to one fresh agent to
    read cold, and ask: your goal in one sentence, your first three acts, the sentences you stumble over, and what
    is missing. What it stumbles over is the result; agreement tells you nothing. Whether a text makes an agent
    reason better shows only across real runs that end in a check.
11. **The goal sentence names the outcome.** Write it in words the owner would use. Mechanics, versions and checks
    belong in the steps below it. Say what to do, not what to leave out.
12. **Claim only what the system does.** Check every statement about the system in the code or on a route before
    it goes into a text.

## The connecting piece

Anything one agent hands to another (a task, a card, a message, a brief) follows the connecting piece in the pack
`setting-up-agents`: why, goal, what you need to know, a limit if there is a real one, and where the result goes.
It never says how to do the work.

## A good opening

> **You are the owner's own agent. You set up the agents that do the work.**
>
> Claude Fleet exists to show what agents can do when they are set up well, and to make every setup something
> anyone can see and share. You are where that becomes real.

It says what the agent is, what it is part of and why it matters, in three sentences, before any rule.
