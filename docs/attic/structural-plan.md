# From thirty findings to four mechanisms — the structural plan

Written 2026-07-27 after wave 1, at the owner's ask: fix these properly, and preferably at a
structural rather than a point-fix level. This document groups every actionable finding from
`data-audit-2026-07-27.md`, `mining-2026-07-26.md` and `suite-contention.md`, tests each proposed
mechanism against **all** of them (not only the ones that fit), and names what stays bespoke.

## Where we actually are

Nine lanes of work exist or are in flight. `c2aa` landed (Rundgang reads the ledgers). `b499` (the
`main..main` ② feed) and `b5e6` (durable audit queue) are verified and awaiting the owner's click —
both rebase cleanly in that order, and the combined tree typechecks. Wave 1: `1028` (rotation-safe
reads, durable state file, single-instance lock) and `e288` (board renders the audit; labels stop
overstating) are committed with new checks; `a341` (restart windows) and `83d3` (output caps,
ledger totals) are still in their batteries.

The reproduce-before-fix discipline held. `1028` built an explicit proof tree — its new checks
against the *pre-fix* `server.ts` — to show the checks fail before the change. `e288` added 14
checks. Nothing was patched on faith.

One live datum worth more than an argument: while writing this, `e288` is spending a full
seven-minute exclusive suite run to prove that a FIX1 failure is the known flake. We now know that
flake's mechanism exactly. That seven minutes is the interest payment on not fixing it.

## The four mechanisms

Roughly thirty actionable findings. Four mechanisms cover about twenty-four of them. The recurring
shape underneath almost all of them is the same: **two places that must agree, with nothing forcing
them to.**

### M1 — Write the intent before the act

*The doing and the recording are separate operations, and the gap is unprotected.*

Covers: restart-mid-merge leaving no verdict (A2) · restart-mid-land moving `main` with no undo
record, note, audit or row (A3) · `reviewCache` loss writing a false "never reviewed" (A7) · the
audit queue dying with srv (M1, already solved bespoke by `b5e6`) · a teardown failure writing zero
outcome rows (A21).

Shape: before a step that mutates durable reality, write a durable intent; clear it on success; at
boot, turn a surviving intent into an honest *interrupted* state — never into silence, never into
an assumed-clean. Fail toward "stop and ask".

The house already contains this pattern **twice, unshared**: `b5e6`'s queue mirror, and whatever
`a341` is currently building. That is the argument for generalising it now rather than a third
time.

Does **not** cover: anything outside the durable-mutation paths.

### M2 — One module per ledger, and unknown must be representable

*The largest class by far.*

Covers: `postLandAudit` produced and never consumed (A5) · `total: lines.length` counting dropped
rows (A16) · four readers spanning one rotation generation while the writer keeps two (A8) ·
`rawAnswer` absence meaning two different things (A18) · `disposition` carrying two disjoint
vocabularies and `ts`/`at` splitting across sibling trails (A19) · 14 `briefHash` nulls comparing
equal (A20) · `confirmedByHuman` written with one meaning and read with another (A4, A17) ·
`resolvedConflict`/`repairRounds` defaulting to the safe-looking value with no unknown state (A24)
· `baseSha` absent on two of four land paths (A22) · `verified` bound to `mainSha` only (A23).

Shape: one module per trail owning the row type, the append, the two-generation read, the malformed
count, and the single projection that both the API route and the client consume. Then "a field with
no consumer", "a reader that misses a generation", and "a count that hides its own losses" stop
being individual bugs and become structurally impossible. Paired with the type discipline the
codebase already proved once on `verified`: where a fact can be unknown, unknown is a required
state, not a default.

Does **not** cover: the restart windows, the cost class, the git race.

### M3 — No swallowed failure on a mutating operation

Covers: `rebase --abort`'s discarded exit code wedging a lane (S1) · `gitRetry` existing but wired
to only two of the mutating git call sites (S2) · the audit-write latch that silences reporting
*and* disables the steward send cap, failing open (A29) · a non-conflict git failure misclassified
as a conflict with an empty file list.

Shape: mutating git goes through the retry helper, and its result is consumed; a safety counter
never depends on a fire-and-forget write.

### M4 — A poll path may not do unbounded work

Covers: `transcriptPayload` reading whole 3–7 MB files per 1 s poll (A10) · the worktrees route's
~63 git spawns per request at 3 s (A11) · `tickGit`'s ~45–70 children per 10 s with no client
attached (A12) · no ETag/304 anywhere (A13) · `poll()` reading pane bytes for slots with no
listener (A14) · the digest caching worker failures for a full TTL (A15) · and the load half of the
git race (S3).

Shape: polls read from caches that ticks maintain; nothing on a poll path spawns a subprocess or
reads a whole file; one change-counter for the payload. The data-saver lanes already did half of
this for `/api/sessions` — this is finishing a job that has a proven shape.

## What stays bespoke — and that is correct

Point fixes where structure would be over-engineering: the `main..main` ref bug (done); the output
cap keeping the wrong 4% (a retention *selection* question, one function); reaping TMPDIR scratch
(a `find -mtime` line); deleting a lane branch after a proven-merged land; not caching digest
failures (one line); `prompts.jsonl` joining `appendEvent` (one line). Do these directly.

## The uncomfortable structural fact

Every mechanism above is a variant of "two places that should agree, don't" — and all of them live
in **one 6500-line file** where nothing forces agreement. `CLAUDE.md`'s own rule is 200–400 lines
typical, 800 maximum; `server.ts` is eight times the ceiling. The file size is not untidiness here;
it is the mechanism failure that produces this specific bug class.

That is an argument for extracting **one seam — the ledger layer (M2)** — not for a rewrite. M2 has
a natural boundary, covers the largest class, and shrinks the file. A big-bang decomposition of
`server.ts` would be a much larger bet with a much worse verification story, and it is not proposed
here.

## Sequencing, and why this order

**0. The owner lands the six.** `b499` first, then `b5e6`, then wave 1 as it reports. Post-land
audits between lands, srv restart last.

**1. The git race (M3's first half: S1/S2/S3).** Small, surgical, and it is *the enabler* — it is
what makes every later verification trustworthy and cheap. Until it is fixed, every structural lane
pays the seven-minute flake tax that `e288` is paying right now. It sits in the merge path, so it
must follow `a341`.

**2. The lock and the tiering (S4/S5).** Move the lock inside the suite scripts so the audit and
every lane serialize without anyone remembering; stop demanding the 867-check suite per lane, since
the house rule already says it belongs post-land against the integrated tree. Cuts the queue about
4×. This is process plus a few lines, and it compounds with step 1.

**3. M1, the intent journal.** Generalise what `b5e6` and `a341` each built bespoke, and pick up the
teardown-zero-rows case with it.

**4. M2, the ledger modules.** The big one. Deliberately after steps 1–2, because it is the change
whose verification cost is most sensitive to a noisy suite.

**5. M4, the poll budget.** Independent of all of the above — a good parallel lane at any point.

**6. Retention and GC.** Lowest urgency; the horizons are 9–12 weeks.

## What I would cut

Nothing in M1–M4. From the below-the-line list I would drop the ledger key-collision item (A19) as
a code change — sibling trails using `ts` vs `at` is a documentation fix for the next analyst, not a
migration worth running. And I would not pursue the `rawAnswer` schema-generation ambiguity (A18)
beyond correcting its comment: three legacy rows do not justify a migration.
