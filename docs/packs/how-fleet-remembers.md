# How Fleet remembers

Every agent learns while it works: a correction from the owner, a trap in the code, a fact about this machine.
Fleet keeps what it learns, so the next agent starts where this one stopped instead of paying for the same lesson
again.

## Your notebook

You have a notebook: Claude Code's memory. Write in it while you work, at the moment you learn something, not at
the end, because your context may run out first.

- One fact per note, and a name that says what it is about.
- Write the rule and why it holds. Leave out the story. If the incident matters, it goes into a measurement note
  in `docs/messungen/`, and the note points there.
- Before you add a note, check whether one already covers it. If so, update that one.

## From notebook to knowledge

A note that should hold for others doesn't stay in your notebook. It becomes knowledge, in one of three places:

- **An owner decision that holds beyond your task** goes to the owner's corrections, `k-owner-korrekturen`. Each
  entry there names the roles it applies to.
- **How to do a kind of work** goes to a context pack.
- **What something is and why it matters** goes to a concept.

Propose it where it belongs. For a concept, that is an annotation: `POST /api/self/konzepte/<id>/anmerkungen`. For
a pack, it is a change to the pack's source file. The owner decides what becomes binding. Once it is in, delete
your note.

## Why it works this way

Knowledge is visible: every setup lists what it reads, with source and size. It is scoped, so a pack reaches the
roles that need it and not everyone who happens to start in the same folder. It travels, too: a shared setup takes
its knowledge along. A notebook does none of that, which is why it stays small and personal.
