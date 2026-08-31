# Brief — P3: make the steward digest non-blocking (demand-triggered bounded-wait)

*A worktree lane on a fresh branch off `main`. Reviewed as one diff, landed only if the tree
is clean and pushed/merged — commit your work, no untracked files. This is a **live-server**
change (`server.ts` = the running `srv` that drives the real panes): you BUILD and VERIFY in
isolation only. **Deploy is a separate owner step, never yours** — end at "isolated-verified,
landed."*

*Map/why: `docs/proposals/learning-engine-next-steps-2026-07.md` (P3 is step 1) — the digest
is the prototype first *scheduled* library item (`steward-intelligence.md` §7); the sync block
is the one thing between it and that destiny.*

## TASK (observable behavior)

`GET /api/steward/digest` currently runs the sensing worker inline and blocks 23–29 s (a Claude
subprocess call — inherently multi-second, not a one-off); the first pulse with a 10 s curl
timeout died. Make it **demand-triggered bounded-wait**: the worker never runs on a clock; a
GET triggers a refresh only when the cached digest is stale, blocks at most a caller-chosen
`?wait=<s>`, and returns fresh if ready else the last snapshot (or `null`) plus its age.
Blocking becomes caller-bounded, so no caller can be killed by an unbounded block again.

## The design (resolved — do not re-derive; see the map doc for the trilemma)

- **Split fresh from cached.** `prior` and `slots` are cheap → compute them **fresh every
  call** (facts outrank claims, §8). Only the `digest` field comes from a module-level cache
  `{ digest, computedAt }`.
- **Bounded wait.** On GET: if the cache is fresh enough, return instantly. Else start (or
  join) `runStewardDigest` via the existing `digestInflight` and **race it against a
  `setTimeout(wait)`**; return the fresh result if it wins, else the stale snapshot (or `null`
  on cold cache — already the tolerated contract, server.ts:2928) **plus `digestAt`/`digestAge`**.
  The inflight promise keeps running and **writes the cache on completion** (the current
  `.finally` only nulls inflight — add the cache write).
- **`?wait` default fresh-preferring ≈ 30 s, clamped ≤ 60 s.** So today's pulse (`curl -m 45`)
  needs **no prompt change** and still gets fresh; a future tight-timeout auto passes
  `?wait=8` explicitly. Document the invariant: **`curl -m` must be ≥ `?wait`** (the original
  bug was `-m 10` < a 23 s block).
- **Invalidate the cache when the steward slot changes** (cwd differs) — a cached digest is
  bound to one slot.
- **Demand-triggering is the gate:** no `setInterval` fires the worker, so no unattended token
  spend (OWNER §4b); the only unattended caller (a future scheduled pulse) is already gated by
  `autosOn`/`quietHours` at the auto layer. Do not add spend-gates to the digest.

## SCOPE FENCE (Vernunft — complexity is the bug)

Module-level cache + a bounded-wait wrapper reusing `digestInflight`. **NO** new process,
route, queue, websocket, or ticker. ~20–40 lines in `server.ts`. Keep the response shape
additive (`digest`, `digestAt`, `digestAge` added; `now`/`prior`/`slots`/`digest` unchanged).

## BEFORE EDITING, silently establish

The digest handler (`server.ts:2947` `runStewardDigest`, `:2998` `digestInflight`, `:3005`
route), its only callers (`fleet-e2e.ts:2277–2296` + the rundgang curl — no client caller),
the `FLEET_DIGEST_CMD` stand-in path (`:2930`, `summaryViaSubprocess`), and how `clampDigest`
shapes the field. Make the change consistent with all of it.

## DONE means (verify against real state, not code-reading — OWNER §2)

Extend the existing digest e2e block (`fleet-e2e.ts:2277`) with a **slow** `FLEET_DIGEST_CMD`
stand-in (e.g. `sleep`-then-emit) and assert: (a) `?wait=0` returns instantly with `prior`/
`slots` fresh and `digest` from cache or `null`+age on cold; (b) `?wait ≥ worker time` returns
the fresh digest; (c) `?wait < worker time` returns stale/`null`+age within `wait`, and a later
call sees the now-cached fresh digest; (d) `wait` is clamped. Then:
`bunx tsc --noEmit ...` clean · `bun run build` · `./e2e-isolated.sh` tails **ALL PASS** (≤1
known pre-existing flake) · `./e2e-claude-gate.sh`. Run them before claiming done; if the same
fix-run-fail loop repeats ~5×, stop and report the structural problem.

## OUTPUT

Commit(s), concise present-tense. Report ONLY: one-paragraph summary, the quoted verification
tail, and one line on anything unresolved. No reasoning walkthrough. **Do not deploy** — say
"ready for owner deploy" and stop.
