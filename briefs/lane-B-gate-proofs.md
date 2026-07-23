# Lane B — make the three unproven gates provable (assessment §6 item 2 / F2)

Read first: `docs/deep-assessment-2026-07-22.md` **F2** (all three sub-findings) and §5
(what's already covered — the steward-send not-alive branch is DONE, don't redo).
Test files only (`fleet-e2e.ts`, `fleet-e2e-claude-gate.ts`, maybe `e2e-claude-gate.sh`)
— no production-code changes; if a test only passes by changing server.ts, stop and report.

1. **Dispatcher post-spawn re-check:** gate suite already builds real dead/alive fake
   `claude` binaries — add a `FLEET_DISPATCH_REPO` scenario asserting the requeue message
   (`"dispatch held (…) — requeued"`) AND that nothing reached the pane (the
   bare-shell-execution risk is the point).
2. **landGate busy block:** one test with fresh pane output → merge POST → expect
   `status:"blocked"` "actively working". (Every existing merge test settles first —
   that's why deleting the gate currently passes everything.)
3. **Transcript redaction value-assertions:** no `t:"thinking"` block present; a long
   tool_result comes back ≤ ~420 chars. Currently `.ok`-only.

**The done-criterion is mutation-grade:** each new test must FAIL when its guard is
commented out in server.ts (try it locally, revert, state the result in the report) —
a test that can't fail is the bug this lane exists to fix. Verify with the
collision-immune scratch copies of BOTH suites (CLAUDE.md: unique SOCK/PORT/DIR); judge
by the tail "ALL PASS". Heads-up: a parallel lane (C) also touches `fleet-e2e.ts` —
whoever lands second rebases.
