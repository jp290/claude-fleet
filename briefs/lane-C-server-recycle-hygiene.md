# Lane C — server recycle + growth hygiene (assessment §6 item 5)

Read first: `docs/deep-assessment-2026-07-22.md` **F5** and the §4 loose end on `.raw`
growth. Server-only (`server.ts` + one e2e check); symbols over lines — re-grep.

1. **F5 — merge-job state bleeds across recycle:** `openSlot`/`killSlot` clear
   `mergeLast` but not `mergeInflight`/`mergeStart` → a recycled slot reports the OLD
   job as `running:true` and 409s the new lane's commit route. Drop the slot's entries
   on open/kill — the job's `finally` already self-checks identity
   (`mergeInflight.get(s.id) === job`), so this is safe. Add the e2e check: recycle a
   slot mid-merge → new lane's merge GET shows `running:false`.
2. **`.raw` stream growth:** per-slot `.raw` files grow unbounded while a slot lives
   (5.7MB observed); only `killSlot` deletes. Truncate-and-reseed past a threshold —
   the reseed path already exists in `ensureSlot`; reuse it, don't invent a second.
   Pick a boring threshold (e.g. 2MB), make it an env-overridable const. Careful: the
   `.raw` file is byte-truth for the client stream — reseed must not corrupt an attached
   viewer's offset (read how the client consumes offsets before choosing the mechanism;
   if that turns out gnarly, do F5 alone and report the stream issue as scoped-out).

Verify: tsc + collision-immune e2e copy, tail "ALL PASS"; for the truncation, a direct
check that the file shrinks past threshold and the pane stream still renders. Heads-up:
a parallel lane (B) also touches `fleet-e2e.ts` — whoever lands second rebases.
