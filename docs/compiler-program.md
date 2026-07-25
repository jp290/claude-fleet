# The compiler program — steward autonomy × ✨ enhance, and what they share

Written 2026-07-25 after the first steward-adjudicated land and fire-drill #2. Owner asked:
how do we grow (1) steward autonomy capability + quality and (2) the ✨ button — and what are
the complementary elements. Claims below cite their evidence; PROPOSED items await owner
approval before becoming criteria.

## The shared frame (the complementary element, named)

Fleet now runs **three prompt-compilers at three altitudes**, and they share one measurement
substrate:

| compiler | sees | compiles | measured by |
|---|---|---|---|
| ✨ enhance (`enhance-prompt.ts`) | git facts only (blind to session) | owner draft → grounded prompt | rail auto-labels accepted/edited/ignored (`src/client.ts` ~3551–3619, draftId join) |
| /sharpen3 (in-session) | full session | rough ask → dosed task | outcome of the turn (informal today) |
| steward (sighted, upstream) | facts + own reads | briefs, nudges, adjudications | rail labels + gate results + `promotionEligible` |

Shared design law: **facts, never diagnoses** (THE GUARD) — already encoded in
`enhance-prompt.ts` (diagnoses banned, DATA block untrusted) and in the pulse format
(`steward-pulse-v2.md`). Shared machinery candidate: the pulse `DATA` block and the enhancer's
`factLines` both render the same deterministic fact layer (`briefPayload`) — a typed
`kind:"pulse"` should reuse it, not re-derive it.

Shared defect class to guard against: **built-but-unfed**. Verified today: `dispositions.jsonl`
does not exist — the enhance measurement loop has recorded ZERO datapoints since the rail
landed, and `outcomeTally` is `{}`. Both tracks' next steps are feeders first, features second.

## Track 1 — steward: capability is behind its judgment; close that gap

Evidence from today (verified in-session):
- **Judgment strong:** trial #1 — correct never-mid-burst hold, instrument correction
  (transcriptFact.mtime), protocol-perfect composed nudge, refused the raw-tmux bypass,
  honest blocked-trial report. Land-adjudication #1 — verified/trusted split, caught the
  report's 5-vs-4 check undercount, own tsc spot-check, residue-checked.
- **Capability blocked:** `handleStewardSend` hard-refuses free text; the 3 typed kinds cannot
  carry a pulse → phase A impossible without the typed `kind:"pulse"` (steward's own analysis;
  its lane brief for this already exists in its pane). `steward-pulse-v2.md`'s "no new code for
  phase A" is falsified.

Rungs, in order (ladder: record → display → advise → gate → act):

1. **Pulse-kind lane** (after e2e-split lands; steward's brief + the moment-detection
   conjunction caveat in `steward-pulse-v2.md`): server renders DATA + prelude + `[pulse-reply]`
   from references, ONE bounded composed question field. Feeder included by design:
   `[pulse-reply]` harvested from transcript JSONL → rail → `outcomeTally` →
   `promotionEligible` (machinery exists, starving).
2. **Make land-adjudication routine** (docs + habit, no code): every lane land gets a steward
   `[land-adjudication]` before the operator lands; the row records verdict, gate result, owner
   label. This is the steward's "advise" rung on the land path — complementary to ② (which
   watches lane×main collision; the steward watches report-vs-diff truthfulness — different
   failure classes, deliberately overlapping the gate from two sides).
3. **Steward fire-drill** (judge-calibration norm applies to it now): a seeded lane whose
   REPORT overstates its verification (claims a suite ran that didn't; claims a check exists
   that doesn't) — does the adjudicator catch report-vs-diff mismatch? Ground truth sealed
   first, per `judge-calibration.md`.
4. **Evidence surface**: today it improvised (direct worktree git reads — legitimate, unlogged).
   When adjudication is routine, give it a steward-scoped read of the lane diff (mirror of
   owner `/api/slots/:id/diff`), so its evidence channel is structured and auditable.
5. **Phase B recycle**: its one missing fact (context-size proxy) landed with `transcriptFact`
   (`0f7fa06`). Next = watched recycle trial; own criteria entry BEFORE any autonomous kill.

PROPOSED criteria entry (owner approval needed before it enters `graduation-criteria.md`):
steward land-adjudication advances from advise to a blocking gate iff **N ≥ 15** adjudications
with recorded gate results, **0** cases where a steward "land" verdict preceded an owner undo or
`wrong` label, **≥ 1** owner-confirmed true catch (a "stop" that was right), and its
stop-rate ≤ 20 % (same brake-logic as ②'s).

## Track 2 — ✨ enhance: healthy pipeline, zero data; feed before tuning

Current state (all verified today): button → `/api/enhance` (facts via `briefPayload`) →
invariant-guarded rewrite (no translation, no diagnoses, verbatim embeds, `/sharpen3` suffix
on work orders) → replaces box, never auto-sends → deterministic labels via draftId; ambiguous
cases drop the label rather than guess. e2e asserts the prompt invariants.

1. **Feed it** — use ✨ routinely; the labels write themselves. No prompt tuning before a
   label corpus exists (drill-#1 lesson: tuning on N≈0 overfits).
2. **P-9, the dispatcher does not brief** (BACKLOG:1155): `tickDispatch` sends raw queue text
   while template + enhancer sit off-path. Highest-leverage enhance work, and the convergence
   point of both tracks: dispatch briefs should pass through the same fact-grounded compile
   (and fix briefHash provenance in the same move). Lane-sized, after e2e-split.
3. **Perception**: once labels exist, a one-line tally (accepted/edited/ignored) in the feed
   header — display rung, only when there is something to display.

## Sequencing

Now (docs/habit only, e2e-split still running alone): this doc; adjudication-routine practice;
owner decision on the PROPOSED criteria numbers. After e2e-split lands, lanes in order:
pulse-kind → P-9 dispatcher-brief → steward diff surface. Steward fire-drill after ~2 more
routine adjudications. Everything lands through the gate; every advisory output gets its rail
label.
