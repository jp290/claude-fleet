# Session 7 — hunt the pain that is still there, and ship the fixes

*Entry brief. Paste-and-go: start a fresh session in the main checkout and read this file first.
Written 2026-07-25 at the end of session 6 by the session that did the work below — so treat
every claim in it, and in everything it points at, as a claim to verify.*

## Mission

Find what still hurts about running Fleet, and **fix it through lanes**. The deliverable is
landed changes, not a findings document. Session 6 produced ten documents and six lands; the
owner's verdict on that ratio was "you're overthinking this — we just gotta get this started and
improve the system." Take that as a standing instruction.

Rank what you find by one question: **does this block the system running unattended?** Pain that
blocks autonomy outranks pain that is merely annoying.

## Orient (30 minutes, not more)

1. `HANDOFF.md` §1 — run its recompute block. Never quote a counter you did not just compute.
2. `docs/autonomy-plan.md` — the axioms, the staged plan, and **Part 6: what is still missing**.
   That part is the current map; its critical path is steps 1–5.
3. `docs/adversarial-2026-07-25.md` — the index of everything session 6 found, with dispositions.
   Its §E is the reframe that matters: *the machine is ahead of the measurement, and the
   measurement is ahead of the adjudication.*
4. `git log --oneline -25` and `docs/README.md`. Do not read the whole corpus — it is ~9 700
   lines and reading it is itself one of the diagnosed problems.

## Settled — do not re-derive, do not re-propose

- **Metering, budgets, token cost.** Explicit owner ruling: optimisation comes after autonomy.
  Off the critical path entirely. (`autonomy-plan.md` Gap 4.)
- **`GET /api/self/context`** — proposed in `lane-context.md`, then **refuted with numbers** by
  `lane-cost-study.md`: endpoint-addressable orientation is 3.1 % of lane cost at the most
  generous reading, 0.41 % honestly, and 13 of 18 lanes spent zero. Do not resurrect it. What
  survives that refutation is narrow and real: a lane still **cannot learn what will actually
  gate it** (`gate-coverage.md` §2.2), and the cheap fix is static facts in the spawn-time brief.
- **The seven adversarial sweeps** of session 6 (crash/concurrency, ledger epistemics, perception
  blind spots, doc rot, gate coverage, governance, tokens). Re-running that shape finds the same
  things. The leads below are deliberately the ones those sweeps did **not** touch.
- The two `killed-dirty` ledger rows are sanctioned calibration drills, not abandoned work.
  Dead lead; do not investigate them.

## Where the unmined evidence is

Session 6's productive method was **empirical, not textual**: measure the record, probe live, try
to refute yourself. Its single best finding came from watching a real failure, not from reading
code. Four leads in that spirit, none of them touched yet:

1. **The operator's own transcript from 2026-07-25** — the newest/largest `*.jsonl` under
   `~/.claude/projects/-Users-owner-claude-fleet/`. It is a full day of one agent driving this
   system: every wrong route taken, every crash, every surprise. Known friction in there already:
   `/api/slots/:id/land` is teardown-only and the real gate is `POST …/merge`; a merge verdict
   once broke `JSON.parse` and was never reproduced; a commit to main during a land killed it
   with "Diverging branches"; `bundleStale` caught a client deploy that would have shipped
   invisibly. **Mine it for the friction nobody wrote down.**
2. **`steward-journal.jsonl` — 32 records** of `{counts, decisions_surfaced, changed, lanes}`
   written by the agent whose entire job is noticing, over several days. Nobody has ever read it
   as a series. What has the steward been seeing that no one acted on?
3. **`audit.jsonl` (~31 KB)** — the operational event stream (`auto_fire`, `steward_send`,
   `slot_kill`, `steward_task`, …). Never analysed. Sequences and gaps in it are behaviour.
4. **The one unanalysed correction case: `perception-write`, `ownerPrompts: 3`, 6 files.** The
   only lane that needed three owner interventions. The other two multi-prompt lanes
   (`fleet/review-agent`, `fleet/outcome-recorder-fix`) are already written up in
   `lane-brief-template.md`; this one is not. Read its transcript: what did its brief fail to
   convey, and is that failure structural?

Reading `~/.claude/projects` is **authorised for this work, READ-ONLY**. Never write, move or
delete anything there. This overrides CLAUDE.md's "outside the repo — stop and report" for that
path only. Everything else outside the repo stays untouchable.

## In flight when this was written — check before you touch these

`post-land-audit` (server.ts; the full suite after a land, recorded and surfaced, no gating) and
`kprogress-honesty` (src/client.ts; the fail-green counter fix). If either is still open, stay
out of its files; if both landed, the next path steps are **defect-escape attribution** (Gap 1b)
and **dispatcher briefing, P-9** (Gap 3).

## How to work

- **Everything lands through the gate.** A hand-land is a lost calibration row. `POST
  /api/slots/:id/merge` is the gate; `…/land` is teardown only.
- **Never commit to main while a land is in flight** — it fails the land at the fast-forward.
- One lane per concern; brief it with the residue only (`lane-brief-template.md`), name the
  sibling producer, and point at the Verify line rather than pasting a gate command.
- Every structural claim cites `file:line`; separate what you **verified** from what you
  **inferred**; state what you did not examine. Verify a subagent's claim before repeating it —
  two of four sweeps needed correction in session 6, and one of the author's own headline claims
  was wrong.
- A doc is justified only when it changes how a session behaves. Otherwise ship the change.

## Done

At least one landed improvement that removes real friction, with its verification quoted; the
ledger row it produced; and a short note of what you found and chose **not** to do, with why.
If a finding is big enough to need a lane of its own, brief it and say so rather than starting it
at the end of the session.
