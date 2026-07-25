# Adversarial pass, 2026-07-25 — ranked findings and what needs an owner decision

Owner asked for the criticism the program had been disregarding. Seven independent sweeps ran
(four parallel subagent audits: crash/concurrency, ledger epistemics, perception blind spots,
doc-vs-code rot; plus three threads of my own). This file is the **index and the ranking** —
the detail lives in the docs it points to. It is deliberately not a restatement, because
"another doc" is itself one of the findings (§C).

Every item is marked VERIFIED (I read the code/data myself) or REPORTED (a sweep's claim I did
not independently re-derive — treat as a lead, not a fact). Subagent claims that survived my
own re-derivation are marked VERIFIED and say so.

---

## A. Live, needs an owner decision (nothing was changed)

**A1 — `/rundgang` is scheduled perpetually against its own file's explicit prohibition.**
VERIFIED: `fleet.json` holds `{slot: 1, text: "/rundgang", everySec: 7200, perpetual: true,
enabled: true}` with `autosOn: true`; it fires every 2 h (next firing was ~5 min after this was
written). `.claude/commands/rundgang.md:35` says this pulse is run *"**manually and watched**,
NEVER scheduled, until server-side `ref`-dedup lands"*. VERIFIED that the precondition has not
landed: `POST /api/steward/tasks` has only `STEWARD_MAX_PENDING` — no `ref`, no dedup. So a
persistent condition re-files every 2 h until the cap.
**I did not touch it** — the owner enabled it and may have overridden the norm knowingly.
Decide one of: lift the norm in `rundgang.md` (if the pending cap is judged sufficient), or
disable the schedule until dedup exists. Today the two artifacts contradict each other and a
steward reading either one is misinformed.

**A2 — `CLAUDE.md` tells an agent to enable ② in a way that would destroy the K2 dataset.**
VERIFIED: `CLAUDE.md:52` and `merge-review-autonomy.md:212` both say `FLEET_CLEAN_REVIEW` is
"OFF by default, enable = `FLEET_CLEAN_REVIEW=1`". Reality: `watchdog.sh:57` ships
`FLEET_CLEAN_REVIEW=shadow`, and `server.ts:2475` is three-valued. Neither doc mentions
`shadow` exists. An agent asked to "enable ②" follows the doc, writes `=1`, and silently
converts the running shadow collection into a live gate — ending the N≥25 shadow run the
criteria require. One-line doc fix; high harm until made.

**A3 — the `e2e-split` lane's rulebook update is scheduled for silent deletion.** VERIFIED and
already rescued to the session scratchpad; apply after that lane lands. Full account:
`ungoverned-artifacts.md` §2.

**A4 — the gate can silently become empty, and still record `verified: true`.** Found by the
`arch-review` lane (its F1), VERIFIED by me on both halves: `watchdog.sh:49` opens with
`[ -f fleet-e2e.ts ] || { echo "verify skipped: not the fleet repo"; exit 0; }`, and
`runVerify` (`server.ts:2492`) records `ok: !timedOut && code === 0`. So **a lane that renames
or moves `fleet-e2e.ts` makes its own land report a green gate that never ran tsc or any
suite** — the exact inverse of what the F9 anchor fix was for, on the one boundary the program
calls hard. Not hypothetical this week: the in-flight `e2e-split` lane is restructuring that
very file (VERIFIED it kept a root `fleet-e2e.ts` runner, so *this* lane is safe — by luck of
its design choice, not by any check). Fix is a tri-state verify (`skipped` ≠ `ok`) so a skip can
never be recorded as a pass. The owner is already acting on this one.

---

## B. Structural findings, ranked by cost

**B1 — The land gate verifies types + 26 claudeAlive checks; the 703-check suite is not in it,
and the post-land audit tier that was supposed to cover the difference was never built.**
VERIFIED first-hand. → `gate-coverage.md`. Consequence: `verified: true` — the field every K1
row carries and the criteria call "honest" — attests tier 1 only. Independently reached by the
ledger sweep (its finding 3) and the doc sweep (its finding 8).

**B2 — Three of criterion 1's four clauses cannot produce a failing value.** VERIFIED by the
ledger sweep, spot-re-derived by me: "0 undos" — `undoLast` is one slot per repo, overwritten
by the next land (observed cadence 50–110 s), so a land becomes un-undoable almost immediately
and `disposition:"reverted"` has never once been written; "0 wrong-class dispositions" —
`dispositions.jsonl` holds exactly one record, and `kProgress` does not read dispositions at
all; "≥80 % review coverage" — coverage is patch-id identity, so a reviewer answer that did not
parse still counts as covered (row 11 is exactly that). Only K1 carries information, and it
counts events, not outcomes.

**B3 — `confirmedByHuman: false` does not mean unattended.** VERIFIED: the merge route is
owner-token-gated (a lane's self-token is 403'd), so every one of the 17 rows is an
owner-initiated merge; the flag means "no *second* human step". Criterion 1 would license
unattended landing on a population containing zero unattended lands.

**B4 — The measured population is the measurement machinery.** VERIFIED by me directly against
the ledger: **10 of 10 counted lands touched `server.ts`/`src/client.ts`/`fleet-e2e*`/
`watchdog.sh`/`e2e-*.sh`** — including the lane that wrote `kProgress` itself and the lane that
rewrote the verify command. One repo, one author, ~2 h of wall-clock for the whole streak.
`graduation-criteria.md` already flags homogeneity; the self-reference is sharper than that
note and belongs in the amendment log.

**B5 — Degraded input biases green.** VERIFIED: `src/client.ts:2935` is
`if (!o.confirmedByHuman) clean++` against an **optional** field (`:2833`) — a row missing the
field counts as a *clean auto-land*. This is the project's own "unknown ≠ zero" rule violated
in the function that computes the autonomy counters.

**B6 — Goodhart, mechanically.** REPORTED (derivation checked, not executed): the full K1 streak
is purchasable with ~10 doc-only lanes in ~20 minutes — docs break neither `tsc` nor
`e2e-claude-gate.sh`, so each lands clean+green; and a bad land plus its repair lane reads as
**+2 successes**. The line to defend is `shadowOf` (`server.ts:3120`): loosening the ② parser to
accept prose would convert today's 4 failed measurements into 4 passes and drive the
would-stop rate to 0 — satisfying both K2 clauses by weakening the instrument.

**B7 — A crash mid-land mis-attributes the ledger row it was measuring.** REPORTED, with its
key constant VERIFIED by me (`OWNER_LAND_FACTS`, `server.ts:2706`, is
`{confirmedByHuman: true, verified: null}`): if srv dies inside `landLane` after `main`已
advanced, the re-land takes the "already merged" branch and records an unattended, green-verify
land as **human-confirmed with no verify** — inverting exactly the two fields the program
measures. Git state stays sound (ancestry-gated, no double-move); the corruption is evidentiary.

**B8 — The perception layer fails silently about itself.** VERIFIED spot-check of its sharpest
case: `openDiff` (`src/client.ts:2523`) has no `res.ok` check and `.catch(() => ({}))`, so a
500/401 renders **"clean working tree — everything is committed"** — a fail-open in the
pre-destructive review affordance. REPORTED in the same sweep: `refresh()` swallows all errors
with no staleness indicator (a dead server renders as a healthy fleet with frozen counts); a
claude that died inside a live pane produces no browser signal at all; `deployGap`/`bundleStale`
are served only to the steward routes, never to the owner's eye; the outcome feed renders a
failed load as a measured, empty ledger.

**B9 — The rulebook, the owner model and all four ledgers are untracked, uncopied-back, and
unbacked-up; the repo is public and unpushed since 2026-07-13.** VERIFIED. →
`ungoverned-artifacts.md`. Includes the measured `CLAUDE.md` drift (the steward has been running
9 lines behind for a day) and why the anti-drift brief norm institutionalizes drift.

**B10 — Role separation is not statistical independence.** VERIFIED: one `SUMMARY_MODEL`
(`server.ts:1828`) runs ②, ③, the resolver, the enhancer and the digest; the lanes, the steward
and this session's operator are all Claude. The criteria guard labeler-vs-lander independence
only. The fire-drills inherit the correlation — they are designed by a Claude against a Claude.
→ `gate-coverage.md` §6.

**B11 — The apparatus measures soundness, never cost or value.** VERIFIED that `sessionMs` is
recorded and nothing reads it; no token/cost field exists at all. One lane spent 64 minutes of
Opus 5 fixing one e2e flake — whether that beats the owner doing it is unmeasurable by
construction. → `trust-perimeter.md` runner-up 2.

**B12 — The token model is an HTTP boundary; every lane can read the owner token off disk.**
VERIFIED. → `trust-perimeter.md`. Relevant here because B2–B5 assume ledger rows and labels are
unforgeable.

---

## C. The corpus is now part of the problem — including this pass

VERIFIED measurement from the doc sweep: ~9 700 lines / ~90 k words of markdown across 55
files; `docs/` went 0 → 33 files in seven days, **nine of them created on 2026-07-25 alone** —
and two of those nine were already missing from an index that asserts completeness. Four of its
ten findings are two status claims disagreeing. Its conclusion, which I endorse and which
indicts this pass too: *discipline expressed as prose has now measurably failed three times;
the next artifact must be executable, not another doc.*

Recommended, cost-ordered (from that sweep, unmodified):
1. **A doc-claims check wired into the deployed gate** — a doc may name an env var, default,
   route or constant only by symbol; ~80 lines appended to `e2e-claude-gate.sh` so it rides
   `watchdog.sh:49` and gates every land. Catches A2 and the drift class mechanically.
2. **Collapse status into one derived `STATUS.md`**; design docs carry no present-tense status.
3. **Move the 11 dated snapshot docs to `docs/records/`** after (1), so the pointer check catches
   the breakage it causes.

And the self-indictment: this session added five docs today, of which this is the fifth. The
correct next move is (1) — executable — not a sixth.

---

## D. What each sweep said it did NOT examine

Recorded so partial coverage never reads as complete: the share/guest surface and WS internals;
`tickHarvest`/transcript cursor; `runMerge`/`summaryViaSession` subprocess plumbing; the client's
audit/queue/history overlays and `src/share.ts` entirely; `BACKLOG.md`, `docs/proposals/`,
`briefs/`, `OWNER.md`; the ②/③ prompts in full. No suite was run and no server started by any
sweep (the `e2e-split` lane owns the harnesses today) — so every claim about what a suite
asserts is source-level, and all filesystem-durability claims are inferred from POSIX/APFS
semantics, not measured.
