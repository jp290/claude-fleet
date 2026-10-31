# Clean and effective code

Read this when you check a change someone else built and are about to say it fits; a builder can read it too.

A change can be correct and still cost too much: a second path beside one that works, a name that sends the next
reader the wrong way, a layer nobody needs. You may ask for the simpler change, not only for the correct one. These
are preferences with their reasons, not a rulebook; where the case points elsewhere, your judgment wins.

## First the repository's own standard

- Read the repository's rules before the diff (in Fleet's repo: `AGENTS.md`, "How a change lands"). Their standard
  is the bar, not yours: a breach of it is a finding, a departure from your taste is not.
- In TypeScript, the owner's own rules are part of that bar, and they reach you only through this pack: no `any`
  where `unknown` and a narrowing would do; no `as` or `!` that silences the compiler instead of a guard; every
  promise awaited or caught, `Promise.all` for independent work, never `forEach(async …)`; no empty `catch`, a
  `JSON.parse` that can fail is caught; `const` by default and no mutated parameters; strict `===`; named constants
  instead of magic numbers and strings; `camelCase` for values and functions, `PascalCase` for types. A breach
  that hides an error is a defect; the others are a demand where they mislead a reader, else a note. Look for
  them where an error could hide; a cast whose reason stands beside it, or that a guard already proves, is fine.
- Before you call something new or a duplicate, search the repository once for the concept by name
  (`rg -n '<noun>'`). Seen only in the diff, every helper looks fresh.

## Three kinds of finding

- **Defect: it does something wrong, or will.** Give the input that shows it, the path (`file:symbol`), what
  follows, and whether you reproduced it or only read it. Kinds such checks have found: a record the new code
  writes that the old code can't load, so a rollback loses data; a text or view that claims what the code doesn't
  do; a test that writes to the person's real files; a fix that moves an exception out of one path while another
  path still reaches the old place; a cast, an empty `catch` or an unawaited promise that hides an error. An open
  defect holds the verdict.
- **Simplicity demand: it works, but costs more than it must.** A parallel way beside a working mechanism instead
  of an extension of it; a hand-rolled utility the repository or the package registry already has; a layer, flag,
  branch or test for a case that can't happen; a name that says something other than what it holds; an error
  message that says what failed but not what to do next; a comment that repeats the code, or none where the reason
  doesn't follow from it; a comment that cites a file outside the repository, which no later reader can open; a
  check that pins source text instead of behaviour. Name the simpler way concretely and
  what it saves. It may hold the verdict when you can name that way and it stays inside the change; otherwise it
  is a note.
- **Style wish: you would have written it differently.** Order, the wording of a comment, a name that is clear but
  not the one you'd pick, a docstring for the obvious, a type the compiler infers, a split by line count. It never
  holds the verdict; leave it out, or give it one line at the end.

Ask of each finding who is hurt, and when. A user, or a later reader who is led wrong: defect or demand. Nobody:
style.

## How strict

- Clear names and a sensible approach weigh more than any single rule: a reader should get what a function does
  from its name and its first lines.
- Ask for the simpler change once, with its reason. The builder may answer with a reason of their own, and the
  better reason wins.
- Don't widen the change. Old code it didn't touch goes as a note to whoever gave you the check, not as a
  condition.
- A rule without exception belongs in a test, a hook or a linter; prose is for preferences. If you would hold a
  change on such a rule and nothing checks it, propose the check as a note: a new hard rule needs the owner's word,
  one rule at a time.
- After your first check with this pack, say in one line which preference helped, which was missing and which got
  in the way, so the pack can improve.

## Traps

- **The general list pulls.** You catch yourself writing "consider extracting" or "could be more readable" across
  the diff. Counter-probe: name the reader who would be misled, or the cost in lines, calls or paths. If you can't,
  it is style.
- **The builder's report first.** Your judgment anchors on their account. Form your verdict from the code and your
  own probe, then read the report.
- **Checking a fix only where it touches.** A fix round moves logic. Check every path that reached the old place,
  not only the new one.

## The verdict

One line per point of the order: holds, holds with a defect, fails, or not checked and why. Then the defects, the
simplicity demands each with its simpler way, and at most one line of style. End with what you covered and what
you did not. "It fits" means: no open defect, and no open demand you held it on.
