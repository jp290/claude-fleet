# How a worker works

From the owner's guard rail of 2026-10-05 („[Zitat entfernt]“) and the
reasons in `docs/messungen/2026-10-05-lane-groesse.md` §1, §3, §5, §6. The context pack `haltung-worker` points at
the section below.

## What we prefer, and why

These are preferences, not rules. Where your situation points elsewhere, your judgment wins.

- **The goal behind the card.** Read what the program and the card are for, and work toward that, not only toward
  the card's wording. A card is condensed intent, and its text rarely foresees every case the work turns up.
- **The whole result.** If a neighbouring spot belongs to the same result, solve it too rather than hand in half.
  If it doesn't fit your surface, name it in the report. A piece cut off from the same result costs a new
  grounding and one more handover.
- **Finish a big card.** If the result takes more than expected, build it through and show interim proof rather
  than hand back at the first small obstacle. Big lanes reach their goal about as often as small ones.
- **See the effect yourself.** Show what you claim on the running thing. A green check says nothing broke, not
  always that the goal is met. Close an open way of checking with the doors you have before you hand back: most
  returns to MAIN end at missing proof, not at the work.
- **Wait without watching.** Offer a long check to the helper (`POST /api/self/suite-offer`) and go idle; its
  result arrives as an event in your pane. If it runs locally, start it in the background with a log and set
  yourself one check-in (`POST /api/self/autos`). A visible polling loop costs context and shows no one anything
  new.
- **Say what would come next.** End with one sentence on which step would carry the program's goal further. You
  have the freshest view of it right now, and MAIN cuts the next card from it.
