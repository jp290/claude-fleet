# Made with love

Read this while you build something the owner will see (a window, a view, a part of the board), and once more
before you show it to him.

The owner wants Fleet to be indie software made with love: you understand at a glance what is going on, and using
it is fun. Visible work here rarely misses through a bug. It misses because it was patched rather than thought
through: every part is correct, and the whole has no idea behind it. These are hints for your own critical look
while you build. His bar for visible work and the click-through at his screen sizes are in `testinstanz-abnahme`;
the ways work misses its person are in `who-it-is-for`.

## Start from the idea, not the parts

- **Say in one sentence what the view is for and what matters most in it.** Position and size follow from that
  sentence: the most important thing is the biggest and comes first. Without the sentence you sort by data model.
- **When the parts are right and the whole feels cluttered, rebuild the layout from the sentence.** You are in this
  trap when your next fix is one more line of explanation, one more fold or one more badge.
- **What can't apply here gets no row.** A thing the screen can't have in this place isn't shown, and neither is an
  empty section. A thing it gets once someone turns it on keeps its row, switched off.
- **Where a view sits on a terminal, look at the terminal first.** Check what the terminal surface itself can do
  better before you build around it, and name its limits.

## One place for each kind of thing

- **Every kind of element keeps one fixed place:** sizes in one column, choices in one, switches in one, the main
  action where it always is. The owner reads by position, so the same thing sits in the same spot in every row, and
  it stays there when he switches to another agent, repo or state.
  Check it: read `getBoundingClientRect()` of each column's elements at the edge they align to (right for
  right-aligned), across all rows and after a switch. Within a pixel, one value per column means it holds.
- **Simple first, the rest in layers he can find.** Few things, large, each of them relevant; the rarer controls and
  the details one click away, where he would look for them. A list stays compact as it grows.

## Few words, real controls

- **Words are the most common excess.** Cut each label to what the person needs to act. A label that repeats what
  the screen already shows goes.
- **What can be changed looks changeable:** a real button, switch or picker, not grey text. A symbol only where he
  reads it without guessing.
- **Air between groups, no waste inside them.** Give a little space where the meaning changes, and leave no empty
  columns or half-empty panels.
- **One language and his names.** The board is in English. Call a thing by the word he used for it last, never by
  the field name from the code.

## Calm, and the same everywhere

- **Motion answers an action and settles into place.** Nothing jumps, scrolls or flickers on its own.
- **The layout keeps its meaning at every size he uses**: his desktop at his zoom (the measure is in the local
  binding, `~/local-notes/this-machine.md`), an iPad in landscape, a phone. When a column has no room, its content
  moves under its row; it doesn't disappear.

## Look at the whole, then let someone else look

- **One false row costs every row.** One row that shows something the session never read, or hides something it
  did, and he stops trusting the other rows. A view that shows a state shows it as it is, and nothing else.
- **Before you call it done, meet it as a stranger.** Look at the screenshot for five seconds, then say what this
  is and what you can do with it. If you need what you know from building it to answer, the screen doesn't say it
  yet, and that is your next round.
- **For a second look, hand over the work, not your findings.** Give a subagent without your context, or the UI
  acceptance through the orchestrator, the link and the purpose. One that gets your list only confirms it.
- **Decide the self-evident; offer taste as a choice.** What follows from a rule he has already given, like the
  ones here, you decide and report. Where two good ways differ only in feel, show both with a picture and let him
  choose.

## The check that ends the work

You have seen it at each of his sizes, the column check holds, and for each change you can say in one sentence
what he now sees and where.
