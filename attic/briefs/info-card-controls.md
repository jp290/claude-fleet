# Brief: organise the control section of the info card

Owner's ask, verbatim (2026-08-03): *"properly organise the control section on the right in the
info-tab"*.

This file is the starting point, not the design. The design is the job — but the measurements, the
constraints and the three traps below are already done, and re-deriving them costs an hour.

## The surface, named precisely

The **info card** is `#board`, the right-hand panel toggled by the `.boardtoggle` button in each
pane. Its body is `#boardbody`, and everything in it is built by **`renderBoard()` in
`src/client.ts`** (currently around line 1525). It is the panel that describes the focused
session — not the picker, not the review window, not the sidebar.

**Pin this with the owner before building.** The last two UI rounds in this repo were built against
the wrong surface twice, and the correction was always in the owner's own first sentence
(`docs/…`/memory: *pin the surface before building*). "Control section" plausibly means the whole
card, or only the parts with buttons, or only the guest block that just tripled in size. Ask, quote
the answer, and cut the work there.

## What is actually there now — measured 2026-08-03, not estimated

`src/client.ts` is **5886 lines**. `renderBoard()` builds **7 sections**, in this order:

| section | what it is | rough size |
|---|---|---|
| `guests` | machine-level: guest instances, selector chips, 8 controls | grew ~4× this session |
| `identity` | which lane, working/idle, share · export · rename | 3 controls |
| `work` | uncommitted files, commit/save actions, this lane's commits | several |
| `land` | the land path, verify state, disposition | several |
| `agents` | summary / review workers | several |
| `lanes` | worktrees for this repo, discard confirm panel, new lane | many |
| `your prompts (N)` | the outline — dozens of rows, lowest priority | unbounded |

**84 `el("button"…)` call sites exist in `src/client.ts`.** Not all are in the board, but the board
is where they cluster. The guest section alone contributes 8, plus a chip per slot.

Two ordering facts worth knowing before moving anything:
- `guests` is deliberately **not** part of the lane story. It is machine-level and was placed
  between `lanes` and the outline so an emergency control (`✂ cut`) never sits below a
  dozens-of-rows prompt list. Any reorder has to keep that property or consciously drop it.
- The outline is last **because** it is unbounded. That is load-bearing, not habit.

## The three traps

**1 — `src/client.ts` is read as SOURCE TEXT by the test machinery.** `e2e/outcomes.ts` (§9d–9i)
`readFileSync`s this file, slices it between landmark statements, transpiles and *executes* the
slice; `fleet-e2e-security.ts` §7 asserts client invariants against its text; `e2e/pins.ts` names
it. So moving a renderer to another file breaks the tests rather than the feature — which is
exactly why the renderers were *not* extracted when this file was 4938 lines (Session 15's recorded
decision). If this refactor wants to extract, that decision has to be re-opened deliberately, with
those checks updated in the same lane.

**2 — the board is desktop-only, and silently.** `renderBoard()` returns immediately when
`isMobile()` (`src/client.ts:1530`), and `applyBoard()` only sets the `board` body class when not
mobile. Every control in this panel — including every guest control — is **invisible on a phone**.
The phone is a real surface here (`docs/screenshot-mobile.png`, and Session 15/16/17 all carry
open mobile items). Decide explicitly whether "organise" includes making these reachable on mobile;
do not discover it afterwards.

**3 — the CSS is in `public/index.html`, which the demo also builds against.** ~23 board-related
class rules live there. `~/claude-fleet-demo` derives its page from `public/index.html` and imports
`src/client.ts` through the `@app/*` alias, and **no gate in this repo will tell you if you break
it** — it has its own `bun run typecheck` / `bun run build`, seconds to run. Prefer reusing existing
classes (`bsec`, `bstate`, `bidmeta`, `bbtn`, `bbtnrow`, `bgitop`, `riskempty`, `ready`, `editing`)
over adding new ones; that is what this session did for the whole guest panel.

## What "properly organised" plausibly has to solve

Offered as the problem list, not the solution — the shape is the next session's to design:

- **Density.** Seven sections of stacked rows in a narrow column; the reading order is the lane
  lifecycle, but the *acting* order is not the same thing.
- **Destructive vs routine controls sit side by side.** `⏻ stop` (two-click arm), `☠ discard
  forever` (timed read-window), `✂ cut` (30 s tunnel outage for every hostname) share a visual
  vocabulary with `⧉ copy worktree path`. The confirm idioms are already inconsistent: a timed
  read-window in `lanes`, an 8-second arm in `guests`, none elsewhere.
- **Machine-level vs lane-level are interleaved.** `guests` is about the machine; everything else
  is about the focused session. Nothing in the UI says so.
- **Freshness is per-section and unstated.** Most of the card re-renders on a 3 s tick; the guest
  block is deliberately *not* polled and says `checked HH:MM:SS — not polled`. Others imply
  liveness they may not have.
- **Discoverability.** 84 buttons across the client, no grouping by "how often do I press this" or
  "what does it cost me if I press it by accident".

## Verification, and what would prove it

This is a client-only change in all likelihood, which does **not** make the gate optional (trap 1):
`bun install --frozen-lockfile` · full `tsc` · `bun run build` · `./e2e-clean-review.sh` ·
`./e2e-security.sh` · `./e2e-claude-gate.sh`, then `./e2e-isolated.sh` as tier 2.

**Those suites cannot see layout.** The four windows have had zero e2e coverage since Session 15
and the decision about that has now been deferred four times (15 §3, 16 §1, 17, 18) — 100 working
Playwright checks already live in `~/[privater Owner-Ordner]/ui-checks-2026-08-02/`. If this refactor
moves controls, driving them in a real browser is the only thing that proves it, and this session
showed why: two "it's fixed" claims about one button were wrong, and the third was only right
because a headless browser clicked it and sampled the label. The harness lied first, too — a 2.5 s
wait against a panel that paints on a 3 s tick. Poll for the element; never sleep at it.

Known non-issue, so it is not re-adjudicated a fifth time: `./e2e-isolated.sh` may end with
2 red steward-send checks. Proven a race at clean HEAD — see the Session 19 handoff entry.

## Open decision, owner's to make

**Is this a reorganisation of what exists, or a reduction?** The controls could be grouped and
relabelled with everything kept, or the card could lose things — collapsing the outline by default,
hiding the guest panel behind its own toggle, moving machine-level controls out of a
session-scoped card entirely. Those lead to very different work, and the second one deletes
surface the owner may be using daily.

Ask before building. Quote the answer in the lane report.
