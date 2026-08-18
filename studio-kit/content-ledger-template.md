# Content ledger (kit v2) — delivery before polish, mechanically visible

Why: both audited studios gated content QUALITY but never content DELIVERY. The promised slice
existed in the contract and nowhere else (Private-repo-c 4 of 12 slice items, Private-repo-f 1 tower / 1 enemy
/ 1 wave against a promise of 3 / 3–4 / 10), and the owner tasted the graphics of a non-game.
Origin: `docs/studio-underwhelm-audit-2026-08-18.md` §2–§3.

Form: `docs/content-ledger.md` in the program repo, created at founding by transcribing the
contract's slice list VERBATIM — one row per promised item:

| item (contract's words) | core? | status | evidence |

- `core?` — yes/no, marked once at founding: the items without which the product's fantasy does
  not exist. Which items are core is product judgment (contract half); that the marking exists
  is kit mechanics. Changing a core mark is an owner act.
- `status` — `missing` / `stub` / `delivered`. Nothing else.
- `evidence` — file:line, replay, or test name; `delivered` without evidence is invalid. A no-op
  implementation is `stub`, never `delivered` (Private-repo-f's "upgrade" was a documented no-op
  behind a delivered-looking verb).

**The ordering invariant (process-shaped, therefore kit):** no gate whose verdict is rendered
on stills, frames, or appearance may OPEN while any `core` row is `missing`. Direction may be
probed early — ONE bounded treatment-comparison round, decision only, no polish iteration —
because picking a wrong-feeling direction is cheap to detect and the sim/renderer seam bounds
the rework; polishing a look and judging appeal wait for the ledger. Percentage thresholds are
deliberately NOT used: content items are not fungible (a track is not 8 % of a game) — the
check is "all core rows left `missing`", never a ratio.

**Mechanical checks:** ledger rows match the contract slice list (grep, run in setup-health) ·
every gate's exit report quotes the ledger rows it changed · an appearance gate scheduled while
a core row is `missing` fails setup-health.
