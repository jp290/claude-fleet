# Verification — done-signals you can trust

*"Done" is a claim until a signal you didn't generate agrees. This doc ranks the
signals, maps them to Fleet's concrete checks, and sets the rules for claiming
completion. Knowledge shelf; the terse operative form lives in CLAUDE.md.*

---

## The hierarchy

1. **Deterministic** — compiler, type checker, test suite, linter, git's own
   refusals. Same input, same verdict, no judgment involved. Always preferred;
   if one exists and wasn't run, the work is not done.
2. **Semi-deterministic** — actually executing the thing: loading the page,
   driving the browser, curling the endpoint, reading the primary docs. Reproducible
   in practice but needs a human-shaped reading of the result.
3. **Statistical** — an LLM judging output quality. Last resort only, for properties
   nothing else can measure (tone, relevance). Never the sole gate on "done".

The rule of thumb: push every property you care about as far *up* this list as it
will go. "The diff looks right" (statistical, self-judged) becomes "tsc is clean and
the e2e tail says ALL PASS" (deterministic) the moment you write the check.

## Fleet's concrete signals

Run before claiming any change done, and after every logical unit — not just at the
end:

```sh
bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun src/client.ts src/share.ts server.ts fleet-e2e.ts
bun run build
./e2e-isolated.sh     # judge by reading the tail: must end "ALL PASS"
./e2e-claude-gate.sh  # claudeAlive() against a compiled stand-in `claude`
```

- **Judge the tail, not a remembered count.** The suite grows; "155 checks" is a
  claim from a handoff, "ALL PASS" at the end of *this* run is a signal.
- `e2e-isolated.sh` refuses the live socket, so it is safe anywhere — including
  inside a lane. Raw `bun fleet-e2e.ts` is blocked without `FLEET_E2E_ALLOW_LIVE=1`.
- **Where a check goes:** `fleet-e2e.ts` is a runner; the checks live in `e2e/<family>.ts`
  (slots, autos, share, merge, outcomes, steward-…). Shared plumbing is `e2e/harness.ts`;
  cross-section fixtures travel through `e2e/ctx.ts`. Naming `fleet-e2e.ts` on the `tsc` line
  still typechecks all of it — tsc follows the imports. Reading a pane's env goes through
  `paneEnv()`, never a hand-rolled send-keys/sleep/capture (that shape was the last flake).
- Client bundles are gitignored build artifacts — a client change without
  `bun run build` deploys stale code that *looks* verified.
- For UI changes, the semi-deterministic tier is the browser itself (the e2e suite
  doesn't render pixels): load the dashboard, click the thing.

## Verification built into the system

Fleet's guards are the hierarchy applied to operations:

- **Land** trusts git's own dirty/unmerged refusals plus its own unpushed check
  (`removeWorktreeSafe()` in server.ts) — deterministic gates on a destructive action, with the
  evidence in the error message when they refuse.
- **Automation gates** (claude-alive, idle, slot re-verification) are deterministic
  preconditions replacing the statistical guess "it's probably fine to type here".
- **The lane badge is NOT a done-signal.** Green means the session went idle — a
  heuristic. The planned verify gate (Phase 3: a repo-defined verify command runs on
  idle; only green flips the badge to "ready") is precisely the upgrade of this one
  signal from statistical to deterministic. Until it exists, a "ready" lane has
  earned a *look*, not a merge.

## Rules

- **Never claim done without running the available verification.** If none exists
  for the property that matters, say so explicitly — an honest "unverified" beats a
  confident guess.
- **Verify before believing, including yourself.** Prior-session artifacts
  (HANDOFF.md, notes, memory) and sub-session reports are claims; numbers, paths,
  and states get looked up, not quoted.
- **Cap retry loops at ~5.** If the same fix-run-fail cycle repeats five times, the
  problem is structural (wrong approach, wrong layer, wrong diagnosis) — stop and
  rethink; more iterations are noise.
- **A failed check is a result, not an obstacle.** Report it with its output;
  never claim around it, never `--no-verify` past it.
- **Write the missing check when it's cheap.** The two review passes after the lane
  feature found five real defects the then-152 e2e checks missed — each fix landed
  with its check. That is how the suite earns the trust the previous rule spends.
