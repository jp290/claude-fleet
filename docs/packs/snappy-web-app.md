# Making a web app feel snappy

Read this before you change how a web app that polls and redraws itself loads, caches or paints, or when someone
says it feels slow. The rules hold for any app that polls JSON and builds its own DOM; in a framework app, carry
them over. Fleet's board is the worked example: a pointer to a Fleet file or tool shows where it lives there; in
another app, find its counterpart first.

Snappy means every press shows its answer in the next frame or two, and every update lands without the page
jumping. What the person feels is the time from their press to the visible answer, on their own device. Google's
INP calls up to 200 ms good and over 500 ms poor, judged at the 75th percentile of real visits.

## Measure the press, not the parts

- **Time a press the way it is felt:** the input event, the first DOM change after it, then the next paint. Two
  `requestAnimationFrame` calls stand in for "painted"; that is a heuristic, not a spec. It puts the floor of the
  measure at about 32 ms at 60 Hz, so a press measured there answered in the next frame: that is the goal, not a
  delay left to cut. Requests and bytes are evidence, not the goal: a change that cuts requests while the
  press still waits has not helped.
- **The field before the lab.** Fleet's board records its own presses and first paint on the owner's devices
  (`src/fieldperf.ts`, read back with `GET /api/perf/field`). Read those rows before you guess where the time goes.
- **The lab, repeatable.** Without a probe: in a page script, a `PerformanceObserver` on `event` entries
  (`durationThreshold: 16`) gives each press's input-to-paint time, the measure INP uses; or a short Playwright or
  CDP script clicks the control and times click, first DOM change (a `MutationObserver`) and two
  `requestAnimationFrame`s, with CPU and network throttled for a phone. DevTools' Performance panel shows one
  press by hand. Fleet's example, `tools/board-probe.ts`, does all of it against a test instance (`--cpu 4`,
  `--net 4g|slow4g`, `--warm`; a new press is one `press(label, selector)` line).
- **Medians with the load beside them.** On a loaded machine one time moves by ±100 ms. Run before and after on
  the same data, back to back: commit the change, `git checkout HEAD~1 -- <its files>`, start the app, measure,
  `git checkout HEAD -- <its files>`, restart it, measure (in Fleet, `./testinstanz.sh up`, then `refresh`).
- **A gain below the noise is not a gain.** Report the bytes, and find the condition where the time shows (a slow
  link shows what a fast one hides).

## Traps in measuring

- **The probe lies first.** A control hidden with `visibility: hidden` still has an `offsetParent`, so a script
  presses it, the click lands on its neighbour, and the next poll repaint counts as the answer. Check that
  `document.elementFromPoint` at the press point lies inside the control, and that the state really changed.
- **Lab data is small.** Fleet's mixed fixture polls about 3 KB gzip, the live board about 22 KB. Measure what data
  costs on a copy of real data without its secrets (in Fleet, `./testinstanz.sh up snapshot`).
- **Background tabs inflate first-paint percentiles.** `requestAnimationFrame` doesn't run in a hidden tab, so a
  field p90 of 50 s is a tab nobody looked at.
- **A plausible cause is a hypothesis.** Measure it alone before you build against it. A CPU profile
  (`Profiler.start` over the protocol) whose main thread is idle says the time is somewhere else.

## Getting data to the screen

- **Reading and painting are two acts.** A press that only changes what is shown (a fold, a menu, an explanation,
  a busy state) paints at once from the data in hand. Reads come from the timer, a focus change and after a write.
  In Fleet, `src/board.ts#renderBoard` reads and `repaintBoard` paints from the last read. You are in the trap when
  a route is requested more often than its timer asks: count requests per route and minute in the probe's idle
  window. A side loader whose completion calls the full render re-reads everything.
- **Skip a rebuild that would paint the same.** Key it on exactly the fields it paints (the sidebar's key in
  `src/client.ts#refresh`): a painted field left out of the key freezes on screen, and a raw counter in it rebuilds
  on every poll.
- **One pump for all polls.** A hidden tab polls nothing, and coming back fires one catch-up round
  (`src/client.ts#armPolls`).
- **Keep the hot poll small.** It carries digests, and full texts sit behind their own route. `e2e/tasks.ts` holds
  the sessions poll to a byte budget; read its comments before you add a field.
- **Let HTTP cache.** A bundle with its version in the URL is immutable. The page that hands out the version goes
  `no-cache` with an ETag, so every open asks and an unchanged page is a 304 (`server/transport.ts#staticResponse`).
  `fetch()` revalidates on its own under `default` and `no-cache`; `cache: "no-store"` switches that off.
- **Showing cached data first is a visible choice.** Mark it as unconfirmed until the server has answered, and show
  it to the owner before you ship it: a deleted row that stays on screen costs trust in everything shown.

## Painting

- **The visible part of a press comes first.** Only the first change needs to happen before the next frame; defer
  the rest. A handler that awaits the network before its first DOM change makes the person wait for the network.
- **A whole-column rebuild loses scroll, focus and hover.** Carry them across (`paintBoard` reads `scrollTop` and a
  focus key before it builds), or morph in place (`src/dom-morph.ts`), where a handler reads its element from the
  event, never from the variable it was drawn into.
- **Tasks over 50 ms block the next press.** Split them, or yield between the parts.
- **Read layout before you write it.** A read after a style write forces a layout; in a loop it forces one per
  element.

## The check that ends the work

The same measurement on the same data, before and after, five runs each, medians with the load. The press you changed
answers at the measure's floor, the presses you didn't touch stay where they were, and screenshots before and after
show the same screen. In the days after, the field rows from the owner's own device confirm it or don't.

## Sources

web.dev: Interaction to Next Paint, Optimize INP, Optimize long tasks, Avoid large, complex layouts and layout
thrashing. MDN: HTTP caching, HTTP conditional requests, 304 Not Modified, `Request.cache`. RFC 5861
(stale-while-revalidate). Chrome DevTools Protocol: `Performance.getMetrics`, `Network.emulateNetworkConditions`,
`Emulation.setCPUThrottlingRate`. Fleet's own numbers: `docs/messungen/2026-11-01-board-schnell.md`.
