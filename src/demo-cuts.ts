// src/demo-cuts.ts — the excerpts of the four sessions that are NOT the story, and the
// measurements each one rests on.
//
// WHY THEY ARE NOT CHAPTER DATA. A chapter owns the session it narrates: the lane's ranges sit in
// src/demo-chapters.ts beside its briefAfter and the picture numbers its labels count, because all
// three are landmarks of the same recording and a reader who checks one should not have to go to
// another file for the next. These four belong to the PAGE instead. Any of them can be on screen at
// any moment — the visitor picks a row in the sidebar, not a chapter — so they are armed for every
// slot before the client boots rather than for the one session a chapter is about.
//
// WHY THEY ARE CUT AT ALL. Played whole they run 54–90 s each (demo-transport.ts's TARGET_MS), and
// most of that is a spinner turning: of s3's 1421 frames, 82 carry more than 400 B. A visitor who
// clicks a second session after the story has one question — "does this thing do anything?" — and
// sitting through 90 s to find out is the wrong answer to it. Each excerpt now runs 25–30 s and
// keeps its two ends: the order going out, and the result coming back.
//
// HOW EVERY NUMBER BELOW WAS ESTABLISHED, because the last two sessions got exactly this wrong by
// reasoning about bytes. The frames of a recording carry no clock: Claude Code's spinner writes its
// digits one at a time into fixed columns (\x1b[29G, \x1b[30G), so a single frame's bytes hold at
// most one digit of the number on screen. Both the range ends and the gap cards were therefore read
// off a RENDERED terminal — the fixture fed frame by frame into a 76x28 xterm at the recorded
// geometry, the screen dumped line by line at the frame in question. Where a range does not start
// at 0 the screen was cleared first, so what was read is what the visitor sees rather than what the
// stream would have accumulated.
//
// THE THREE RULES EVERY RANGE HERE OBEYS:
//   1. It ends on a picture that can be READ — never on a spinner tick alone, and never on Claude
//      Code's grey suggestion line, which each of these four paints into the empty prompt a frame
//      or two after the session finishes (s1 677 "commit this", project.raw 342 "run the full e2e
//      suite", s3 1420 "start colima and re-run the docker tests", s4 925 "fix the design amplifier
//      gap"). Grey text in an input box reads as something the session is about to be told, and it
//      is the last thing a held picture should suggest.
//   2. The evidence is IN that last picture, because it is the one that stays on screen.
//   3. The jump between two ranges is named, and what the card says is measured (see each entry).
import type { DemoCut } from "./demo-transport";

export const SIDE_CUTS: ReadonlyMap<number, DemoCut> = new Map<number, DemoCut>([
  // --- slot 1 · s1.raw · 678 frames · "three routes 500 on a malformed body — fix it at the
  // boundary". The clearest of the four: a bug named, a guard written, and a verification that
  // states its own limit.
  //
  //   0    the order, still in the session's own input line
  //   197  "even valid JSON that isn't an object (null, "abc", 5) crashes the destructuring.
  //        I'll fix both at the boundary with one shared parser" — the second bug, which the
  //        order did not ask for and the session found on its way past
  //   207  the last picture of that block, and the range's first end: order at the top, finding
  //        under it, the session's own clock reading 22s
  //   604  the probe's output — 400 malformed json -> null · 400 truncated -> null · 400 empty
  //        -> null. A full repaint, which is why the second range starts here and not two frames
  //        later: 605 is a partial one and renders torn onto a cleared screen for ~0.4 s
  //   668  "the wiring into the three handlers is verified by the typecheck and by reading, not
  //        by an actual curl", with the clock resolved to "Cogitated for 1m 30s" and the prompt
  //        empty. The honest half-sentence is the exhibit, so it is the picture that holds.
  //
  // THE CARD: 22s on the last picture before it, 1m 16s on the first one after it — both read off
  // the rendered screen, 54 seconds apart.
  [1, {
    spans: [{ from: 0, to: 208, secs: 14 }, { from: 604, to: 669, secs: 12 }],
    gaps: ["knapp eine Minute später"],
  }],

  // --- slot 2 · project.raw · 343 frames · the second pane of the lane's own sitting: the session
  // that was open on the project the whole time, asked twice.
  //
  //   0    "in one short paragraph: what is this project and what is it for? read only, change
  //        nothing." — and the answer is the one thing on this page that says what Fleet IS in the
  //        tool's own words rather than in ours
  //   151  that answer complete, clock resolved to "Cogitated for 16s", prompt empty
  //   152  the second question is already typed into the input line but not yet sent — the range
  //        stops one frame short of it on purpose, so the card does not sit between a question and
  //        its own echo
  //   153  the second question goes out: "something just landed on main. what came in, and what
  //        did it change?"
  //   182  git log prints both commits — c350f3e and 06342a3 — which is the moment this session
  //        sees the lane's work from the other side
  //   341  "I ran bun test md.test.ts — 16 pass, 0 fail, 32 expect() calls. Working tree is
  //        clean.", clock resolved to "Cogitated for 26s". The answer is about 40 rows on a 28-row
  //        screen, so the two hashes have scrolled into the scrollback by here — they were on
  //        screen for the middle of the range, and the visitor can scroll back to them.
  //
  // THE CARD IS THE ONE EXCEPTION TO "read it off the screen", and it says so here rather than
  // pretending otherwise: the gap falls BETWEEN two prompts, and Claude Code's clock restarts with
  // every turn, so no screen in this recording carries it. What does carry it is the transcript
  // that ships beside the stream — fixtures/transcript-project.json, the payload the real route
  // returned: the first answer is stamped 06:57:41.919Z and the second question 07:03:09.845Z,
  // 5 m 28 s apart. The two agree where they overlap (question one at 06:57:27.759Z plus the 16 s
  // the screen shows lands on 06:57:43), which is why this substitution is a measurement and not a
  // guess. What happened in that gap is the lane's whole run and its land — which is exactly why
  // the second question can ask what arrived.
  [2, {
    spans: [{ from: 0, to: 152, secs: 11 }, { from: 153, to: 342, secs: 14 }],
    gaps: ["gut fünf Minuten später"],
  }],

  // --- slot 3 · s3.raw · 1421 frames · "run the full test suite and tell me whether anything in
  // that output is a real failure or just expected negative-path noise." THREE ranges, because this
  // session's arc has three beats and skipping the middle one would leave the verdict standing on
  // nothing: a hook stops it, it works around, it counts, it answers.
  //
  //   82    a hook refuses the command outright ("BLOCKED: long-lived command … piped through a
  //         buffering tail")
  //   130   "Hook blocked the pipe. Writing to a log file instead."
  //   162   the workaround running, with the refusal still on screen above it — clock 16s
  //   1116  PASS: 179 · FAIL: 2 · --- failures --- : the number the question was actually about
  //   1139  the same picture, held while the spinner turns — the next block of output is 46 frames
  //         further on, so the range can stand on this one rather than cutting it after 16 frames
  //   1361  the verdict block begins
  //   1419  "Verified vs inferred: I verified the daemon is down, the two failure messages … I
  //         have not verified that these tests pass with Docker up — I only established that the
  //         code isn't what's failing", clock resolved to "Worked for 3m 7s". A session that
  //         changed no code and says exactly what it did and did not check — which is the reason
  //         this recording is worth a row at all.
  //
  // THE TWO CARDS: 16s → 2m 14s (1 m 58 s) and 2m 16s → 2m 49s (33 s), each pair read off the
  // rendered screen at the last picture before the card and the first one after it — and then read
  // a second time out of the running player, which is where the second pair was corrected: holding
  // the middle range to 1139 carries its clock one tick past the 2m 15s frame 1131 shows.
  [3, {
    spans: [
      { from: 0, to: 163, secs: 10 },
      { from: 1116, to: 1140, secs: 6 },
      { from: 1361, to: 1420, secs: 10 },
    ],
    gaps: ["knapp zwei Minuten später", "gut eine halbe Minute später"],
  }],

  // --- slot 4 · s4.raw · 926 frames · "check the README's two sections against the command files
  // and fix whatever has drifted." The scope-discipline one.
  //
  //   0    the order
  //   90   "I'll read the README and both command files, then compare." — clock 10s
  //   853  the second edit lands in the README, and the diff is on screen with both the removed
  //        and the added line
  //   924  the two findings it did NOT act on ("Two things on the command side I did not change,
  //        since you asked about the README sections"), and "Both manifests in .claude-plugin/ are
  //        consistent with the commands — no changes needed there", clock "Baked for 2m 3s".
  //        A session reporting what it left alone is the exhibit here, so it is the held picture.
  //
  // THE CARD: 10s → 1m 48s, i.e. 1 m 38 s, both read off the rendered screen.
  [4, {
    spans: [{ from: 0, to: 91, secs: 9 }, { from: 853, to: 925, secs: 14 }],
    gaps: ["gut anderthalb Minuten später"],
  }],
]);
