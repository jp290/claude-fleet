# Made with love

Read this while you build something the owner will see ("he" below), and once more before you show it to him: a
window, a view, a part of the board; for a card, a FLAECHE (the files it may touch) that names `src/` or `public/`.
It is the one pack for visible work, in the order of the work. `who-it-is-for` comes before it, `testinstanz-abnahme`
after it (the instance and his look): start your instance, `./testinstanz.sh up`, once the first screen exists.

**The bar is the owner's: AAA indie software, made with love.** You understand at a glance what is going on, and
using it is fun. Calm: it shows what counts now, the engine room only on request. Honest: it claims nothing, raises
no false alarm, and says once and calmly what it doesn't know. One voice: one language, human words, no internal
jargon. Care in the small: a name may be shortened when one click shows it whole, nothing else is cut off, everything
aligned, empty states thought through, nothing waits without feedback. With character: small own details, never at
the cost of clarity. Equally good on desktop and phone. Visible work rarely misses through a bug; it misses because it was patched rather than thought
through: every part is correct, and the whole has no idea behind it.

## Who meets it, and which surface

- **One sentence: "<person> can now <act>".** A test or a check as subject doesn't count. When it comes out thin,
  `who-it-is-for` says what to do.
- **He names surfaces by what he does, not by component names,** and two panes of one window are one view to him.
  Find the detail in his words that fits only one surface (a noun, a spatial word like "rechts"), say it back, then
  build. When his words fit two, build the one his symptom explains: "[Zitat entfernt]" speaks against the
  surface where it would be unmissable. A vague report gets a question with symptom options. When he says "[Zitat entfernt]", list every door that starts X and fix the one he used.
- **For spoken feedback on placement, answer with a two-line mock of the exact rows and wait for his yes.**

## Start from the idea, not the parts

- **Say in one sentence what the view is for and what matters most in it.** Position and size follow: the most
  important thing is the biggest and comes first. Without the sentence you sort by data model.
- **When the whole feels cluttered, rebuild the layout from the sentence.** The trap: your next fix is one more line
  of explanation, one more fold or one more badge.
- **A view that explains a whole system (what an agent gets, keeps, may) starts with its principles:** one page, each
  one sentence with one real example, gone through with him; then a clickable mock he tries with a real task; then
  the build. Collect his remarks into one brief.
- **What can't apply here gets no row,** and neither does an empty section. A thing it gets once someone turns it on
  keeps its row, switched off.
- **Where a view sits on a terminal, look at what the terminal itself can do better first,** and name its limits.

## One place for each kind of thing

- **Every kind of element keeps one fixed place:** sizes in one column, choices in one, switches in one, the main
  action where it always is. He reads by position, so it stays there across rows and when he switches agent, repo or
  state. Check it: `getBoundingClientRect()` of each column's elements at the edge they align to, across all rows and
  after a switch; one value per column, within a pixel.
- **Few things, large, each relevant;** rarer controls and details one click away, where he would look.
- **What can be changed looks changeable:** a real button, switch or picker, not grey text; a symbol only where he
  reads it without guessing.

## Few words

A language model explains by default, and you are one. On a screen every sentence competes with the control it
explains, so a word stays only if someone would act wrongly without it.

- **A button says the act** ("Start"), a row says the thing ("Super FleetBot"). A control that needs a sentence beside
  it gets renamed or moved.
- **A second line under a name stays only if it tells two similar choices apart.**
- **What happens after a click shows by the click:** no line that announces it or reassures. A consequence he must
  know before acting: two or three words where he decides ("starts a session").
- **Details sit one step away** (a hover, the Info view). An empty state is one short line naming the next act, or
  nothing.
- **His words, not the code's:** the board is in English; the name he used last, never a field name. A limit he meets
  only after acting is said where it happens, unless acting can't be undone.
- **The trap:** your answer to "this is unclear" is one more line. Cover the line and ask what he would now do wrong;
  no wrong act, the line goes; a wrong act, fix the control first.

## Calm, and the same everywhere

- **Motion answers an action and settles into place.** Nothing jumps, scrolls or flickers on its own. Check it: two
  screenshots two seconds apart, untouched, are identical.
- **The layout keeps its meaning at every size he uses**: his desktop at his zoom (the measure is in
  `~/local-notes/this-machine.md`), an iPad in landscape, a phone. A column without room moves under its row.
- **One false row costs every row** (it shows something the session never read, or hides something it did). Check it:
  name the field or route each row reads; a row with none goes.

## Look at the whole, then let someone else look

- **Meet it as a stranger.** Look at the screenshot for five seconds, then say what this is and what you can do with
  it. If you need what you know from building, the screen doesn't say it yet.
- **For a second look, hand over the work, not your findings:** link and purpose, to a subagent without context.
- **Where two good ways differ only in feel, show both with a picture** and let him choose.

## Where the look comes from

The Design canvas (`https://example.com/design-artifact`, concepts 1 to 3; reasoning in
`~/local-notes/shots-0d51-2026-10-07/`). Its look: Instrument Sans and IBM Plex Mono, ground `#0B0B0C`, moss
`#8DBE86`, amber `#E3A857`, red `#E5705F`, radii 8·14·26.

## The check that ends visible work

Your report carries these lines, each from an observed result:

1. **Who and what:** "<person> can now <act>", with what he now sees and where.
2. **The surface** in his noun, and the **column check**: the pixel value per column.
3. **The string table:** every visible string read off the DOM (tags, avatar letters, toasts; a hover text
   apart), as first opened and in each state one click opens, with its word count and the wrong act it
   prevents. Delete every string with none. Report the word count before and after, and list the rest: he decides
   the words.
4. **The stranger test:** what the screenshot says it is, from the picture alone.
5. **The pictures** (file paths) of the whole window at 390 px, at his desktop measure, and on the iPad in landscape
   where the layout changes there; the link without a token (`testinstanz-abnahme`).
