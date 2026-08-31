# Lane A — client fail-closed + race hygiene (assessment §6 items 1+4)

Read first: `docs/deep-assessment-2026-07-22.md` **F1, F4, and the first two §4 loose
ends** — each carries the fix sketch and done-criterion; this brief only sequences them.
Client-only (`src/client.ts`); line refs in the doc cite `cad0396` — re-grep symbols.

1. **F1 — land-review fails open (the safety item, do first).** `showLandReview` /
   `openMergeDiff`: fetch failure currently renders "no committed changes to land" with
   ⏏ enabled → `{confirm:true}` lands agent-resolved conflicts with zero human eyes.
   Make fetch failure its own overlay state (⏏ disabled, "couldn't load the diff — retry");
   the in-file pattern is `fetchSlotRisk`'s `UNKNOWN_RISK`. Done when NO path renders the
   "just cleans up" line without a successful 200+JSON.
2. **F4 — pollChat cross-slot leak.** Capture `const slot = this.slot` before the fetch,
   bail after the await if changed; `resetChat` also resets `chatBusy`.
3. **doCommit busy-race:** move the `commitBusy` set before the `confirmMidRun` await
   (mirror `doLand`'s fix, comment there says why).
4. **Silent mutation handlers:** task-add keeps typed text on failure (pattern: `doSend`);
   add `res.ok` checks to the ~8 silent handlers F4's section lists. Non-destructive —
   don't over-engineer, a shared one-line failure toast is enough.

Verify: tsc (CLAUDE.md command) + `bun run build` + collision-immune e2e copy. The
pollChat and overlay fixes have NO e2e coverage — verify F1 manually (kill the fetch via
a stubbed `api` or devtools offline) and SAY "UI-verified manually, no e2e" in the report
instead of claiming tested. Commit everything; no untracked files.
