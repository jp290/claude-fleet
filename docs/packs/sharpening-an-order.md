# Sharpening an order

Read this before you give an order to a session that already has work behind it: a change of direction, a
correction, or a next step that builds on its last one.

The session you write to knows what you don't: what it built, what it found, what its last order said, and what
is still open. Your order lands in that context, and a plain reading takes it as a new task on its own. The skill
`sharpen3` makes the session read your order against its own conversation first. It works out how the new order
relates to the old one, what stays, and what changes, and only then acts. Fleet ships it (`docs/skills/sharpen3.md`):
a Claude Code seat without a standing role gets it as a skill with Fleet's library, and any other session borrows the
text with `GET /api/self/context/sharpen3`. Together with a tight order of yours,
that is how a session understands what you mean rather than what you happened to write.

## What `sharpen3` does in the session

- **It mines its context:** what its conversation has already established that a naive reading would ignore, the
  project's state, and what you will do with the result.
- **It triages:** an order that is already sharp stays as it is.
- **It doses the checks:** only the few that this task and this session need, chosen by how the work could fail.
- **It writes the refined order first,** in under 300 words, and then does it, because the order is meant for
  itself. It shows that order only when your last line asks for it.

That refined order is your check. It shows, before any work, how the session understood you and how it placed the
new order next to the old one.

## When to use it

- **Use it** when the relation to what came before matters: the order replaces part of the last one, extends it,
  reverses a decision, or comes from the person's latest word that the session hasn't heard. This holds for a short
  order too, if it reverses the last one.
- **A fresh session** has no history to mine, so don't ask it to sharpen. Sharpen your brief yourself before you
  send it: run `sharpen3` on your draft in your own session, and it compiles the brief for a fresh executor, with
  the files and context it needs. If your session has no `/sharpen3` (the orchestrator's start doesn't bring it),
  borrow the text and follow it with your draft as its input.
- **Leave it out** for an operational order that changes nothing before it ("land now", "answer ok") and for a
  question you want answered as asked.

## How to write the order

`sharpen3` can only sharpen what is there. Give it a tight order with these parts:

1. **The goal in the person's words,** quoted when they said it.
2. **Its relation to the last order:** it replaces, extends, or comes after it. Say which; this is what the
   session can't guess.
3. **What must not be lost:** a decision, a limit, a finding.
4. **Who meets the result and the check that ends the work.**
5. **The last line:** "Run /sharpen3 on this whole message, word for word, show your refined order, then do it."
   Without "show your refined order" a session sharpens in silence and goes straight to work, and you have
   nothing to check.

Send it through the mailbox as you send any message to that session. An example, for a session that is fixing a
red test:

> The person, word for word: "The test shouldn't be fixed but deleted, the feature it tests was removed
> yesterday." This replaces your last order, to fix the red test. Keep every other test as it is, and before you
> delete, check in the code that the feature is really gone; if it isn't, delete nothing and tell me. Done when only
> that test is gone and the suite is green.
> Run /sharpen3 on this whole message, word for word, show your refined order, then do it.

## Traps

- **The slash is not a command on arrival.** Fleet delivers your message after a header line, so a `/sharpen3` in
  it is text, and the session has to call the skill itself. That is why the last line asks for it.
- **A paraphrase instead of your words.** A session that calls the skill tends to pass its own summary of your
  message, and the summary loses what made the order tight. "Word for word" prevents it; the refined order shows
  whether it worked.
- **It stops after the refined order.** Normally the session goes on and works. If it took the order as meant for
  someone else, its transcript ends with the refined prompt and no act after it. Answer "do it" through the
  mailbox.
- **A session without the skill.** A session in another harness (Codex, Pi) or a seat whose library is switched off
  has no `/sharpen3` from Fleet, and it answers that the skill is unknown. Tell it to borrow the text with
  `GET /api/self/context/sharpen3` and follow it with your message as its input.

## What it doesn't change

Sharpening changes how the session reads your order, not what it may do. Its rights, the gates in code and the
person's decisions stay as they are.

## Done

The session's refined order says in its own words what you meant and how it relates to its earlier work, and it
is working on it. If the refined order misread you, correct it in one sentence before it goes further.
