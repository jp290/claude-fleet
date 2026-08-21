# Suite-Serialisierung — Untersuchungsbrief (GLM, 2026-08-21)

*In English, deliberately breaking this shelf's German convention: this brief is executed by a
non-Claude worker (GLM-5.3 via the `pi-zai` stack, `docs/glm-studio-aufstellung-2026-08-18.md`),
and instruction-following precision outranks doc-language consistency. The findings may come back
in either language.*

Owner-Anlass, wörtlich: *"then now please write up a doc for GLM to look into suite serialization
and to find potential improvements"*.

**Scope cut, and it is narrow on purpose:** serialization of the e2e suites — the mutex, the queue
in front of it, and the wall-clock inside a holder's run. Everything measured below was measured or
read on 2026-08-21, not remembered.

---

## 0. Your standing orders

These do not come with your harness; they are the house rules for analysis in this repo.

- **Read before claiming.** Never characterize a file from its name, imports, or directory. If a
  finding depends on a file, open it.
- **Every structural claim cites `file:line`.** "The locking is inconsistent" is not a finding.
  "`e2e-stage.sh:105` sleeps 15 s while `server.ts` polls at 15 s" is a finding.
- **Separate measured from inferred, explicitly.** Partial coverage must never read as complete.
- **Every finding carries a cost** — what breaks, what degrades, what gets slower, in seconds or
  in lands. If you cannot state the cost, file it as an uncosted observation.
- **Five ranked findings beat twenty unranked ones.** Rank by impact and cut the list where the
  owner's ask is satisfied.
- **`rg` respects `.gitignore`, and the operational files here are all gitignored** (`fleet.json`,
  `lane-outcomes.jsonl`, `post-land-audits.jsonl`, `audit.jsonl`, `CLAUDE.md`). Use `rg -uu` or
  `grep` for anything operational — a plain `rg` returns EMPTY, which reads like "does not exist".
- **This is an investigation, not an implementation.** In this repo a rule becomes normative only
  by owner promotion. Deliver ranked proposals; implementation is a separate, owner-approved lane.

---

## 1. What the mutex is

`e2e-stage.sh:73-108`. A machine-wide `mkdir` lock at `/tmp/fleet-e2e.lock`, taken at **source
time** — sourcing the file *is* starting a suite. Seven scripts source it:
`e2e-isolated.sh:56` · `e2e-claude-gate.sh:29` · `e2e-clean-review.sh:23` · `e2e-security.sh:27` ·
`e2e-postland-audit.sh:21` · `drills/drill-3.sh:31` · `steward-arena.sh:164`.

Mechanics worth having exactly right before you touch anything:

- **The dir existing ≠ the lock being held.** The `pid` file inside decides. A dead pid is reaped
  by the next contender (`:96-103`), which re-checks the pid VALUE before `rmdir` to shrink the
  reap race.
- **A pid-LESS dir is a deliberate manual park** (`:83-84`) and is never reaped. That is how a
  human parks the machine.
- **Nothing ever releases the lock explicitly.** I checked every wrapper's EXIT trap
  (`e2e-clean-review.sh:85`, `e2e-security.sh:53`, `e2e-claude-gate.sh:176`,
  `e2e-isolated.sh:537`): they kill their tmux server and nothing else. The dir therefore survives
  every run and is always cleaned by the *next* contender. The reap path `continue`s without
  sleeping, so it costs no poll cycle — but verify that yourself, it is load-bearing for §3.
- **The wait line format is parsed by the server.** `server.ts`'s `runVerify` matches
  `SUITE_LOCK_RE` against this stdout to split a gate run into *work* and *wait*, and moves the
  clock between two budgets on it (`FLEET_VERIFY_TIMEOUT_MS` vs `FLEET_VERIFY_WAIT_MS`).
  `e2e/pins.ts` pins the two sides together. **A format change here puts a land's clock on the
  wrong budget** — this is the single most dangerous edit in the file.

---

## 2. The measured baseline (2026-08-21)

Live gate config, from `GET /api/self/gate`:

| | |
|---|---|
| `verify.timeoutMs` | 300 000 ms — what the gate may spend **working** |
| `verify.waitMs` | 2 700 000 ms — what it may spend **queueing**, i.e. 45 min |
| gate chain | `install → pins → tsc → build → clean-review → security → claude-gate` |
| `postlandAudit` | `true` |

Wall-clock, measured:

- **Post-land audit: 998 782 – 1 118 226 ms** (last 5 rows of `post-land-audits.jsonl`, ~17 min).
  The audit *is* an `./e2e-isolated.sh` run, and it holds the mutex for that entire time.
- **The gate's own deterministic stages are trivial:** `pins.ts` 0.26 s, `tsc --noEmit --strict`
  2.8 s, `bun run build` 0.06 s, `bun install --frozen-lockfile` 0.04 s (warm cache, cold tree).
- **Fixed shell sleeps per wrapper:** `e2e-isolated.sh` 9 calls / **127.05 s**;
  `e2e-postland-audit.sh` 6 / **74 s**; `e2e-claude-gate.sh` 9 / 14 s; `e2e-clean-review.sh` 2 / 1 s;
  `e2e-security.sh` 2 / 1 s.
- **In-module waits:** 408 `sleep(`/`Bun.sleep`/`setTimeout` call sites across `e2e/*.ts` and the
  top-level harnesses (26 360 lines in `e2e/`). Densest: `e2e/tasks.ts` (46), `e2e/watch.ts` (32),
  `e2e/restart.ts` (26), `e2e/slots.ts` (24).

**Not the filesystem.** I benchmarked the whole FS layer first, because a plausible guide blamed
it: `git worktree add` 0.11 s (four in parallel: 0.17 s total), warm `bun install` 0.04 s,
`git clean -fdx` 0.02 s, `rg --files` over the tree 0.03 s, 5000 APFS file creates 0.36 s, process
spawn 1.4 ms. Per-lane FS setup is ~0.15 s against a 45-minute queue budget. **Do not spend a
minute on filesystem, disk, or APFS-vs-Linux hypotheses** — that ground is measured and dead.
(One unrelated observation, uncosted: `/System/Volumes/Data` is at 92 %, 18 Gi free. Not implicated
in anything here; I did not investigate what consumes it.)

---

## 3. Your leads, ranked

### L1 — The mutex may be guarding a bug that was already fixed. Nobody re-measured.

This is the highest-leverage question in the brief and it is answerable by experiment.

Read `docs/suite-contention.md` in full — via `git show main:docs/suite-contention.md`, your
worktree copy is a spawn-time snapshot. Its argument (§1): the serialization doctrine "is treating
a **bug** as a **property**." The dominant flake family was one unhandled error path — the merge
path's `git rebase --abort` whose exit code was discarded, racing Fleet's own `tickGit` poller for
`.git/index.lock`.

**All four of those root-cause fixes were built on 2026-07-28** (banner at the top of §2:
`gitRetry` on rebase *and* abort with wedge detection, `tickGit` skipping slots with a merge in
flight, `GIT_OPTIONAL_LOCKS=0` on the read paths). The machine-wide mutex landed in the *same*
window (`ddc5128`).

So the open question: **is machine-wide serialization still load-bearing, or is it a surviving
workaround?** `CLAUDE.md` still asserts that two concurrent `./e2e-isolated.sh` runs "reliably
produce errors on BOTH trees with differing signatures." Your first job is to **date that claim
against the fixes** — is the evidence behind it pre- or post-2026-07-28? `docs/verify-tiering.md`
§11 and the trail (§4 below) are where to look.

If and only if the claim is pre-fix, propose a *measurement*, not a flip: e.g. N paired concurrent
runs on an unchanged tree, scored against the same-tree serial baseline. Note the honest ceiling
from `suite-contention.md` §5 — across 12 audits there were 2 reds, so "load ⇒ red" was always a
minority outcome, and **a green run under load proves nothing on its own**. Design for that.

Cost if the mutex is unnecessary: every land queues behind up to 17 min of a *preview* tier that
the house rule says must not gate. Cost if you relax it wrongly: red audits and misattributed lane
failures. Both are large, which is why the answer must be measured.

### L2 — Priority inversion: a non-gating preview blocks the actual gate.

The post-land audit is tier 2 — explicitly *not* a gate (`CLAUDE.md`) — yet it holds the mutex for
~17 min, and a land's verify chain must take that same lock. That is why `waitMs` is 45 min.
Documented instance, `suite-contention.md` §8 (2026-08-06): of a 300 s budget, **~107 s was work
and ~255 s was queueing**; the land was killed and the verdict read `verify.ok:false` over an
output containing zero FAIL lines.

Question: should a waiting land gate be able to preempt, or the audit to yield? Note before
proposing: `suite-contention.md` §7 already rejected **scheduling, priorities, and a merge train**
on the grounds that ~6 lands/day does not pay for the machinery. If you propose anything in that
family you must argue against that specific rejection with new evidence — don't re-open it blind.

### L3 — Poll granularity, and three acquisitions per gate run.

`e2e-stage.sh:105` sleeps **15 s** between attempts. The gate chain runs three separate scripts,
each sourcing the mutex independently — so a single gate run acquires and releases **three times**,
paying up to 15 s of pure poll latency each, and can lose the lock to another contender *between*
its own stages. Measured instance in §8: the chain staged 8 s after the holder let go.

Two candidate shapes, both cheap: hold the lock once across the chain, and/or replace the flat 15 s
with a short-then-backoff poll. **Check the interaction with `SUITE_LOCK_RE` and `e2e/pins.ts`
before proposing either** (§1).

There is a neat coupling here worth verifying: the two slowest checks in the entire suite are
`§2b blocking on a LIVE holder speaks immediately…` (15.17 s) and `§2b a hand-parked (pid-less)
dir is called parked…` (15.14 s) — they wait out exactly one poll interval. Shortening the poll
would cut both queue latency *and* suite wall-clock.

### L4 — 201 s of fixed shell sleeps in the two long wrappers.

`e2e-isolated.sh` 127.05 s + `e2e-postland-audit.sh` 74 s. Against a ~1000 s run that is ~13 % of
the dominant holder, recoverable without touching a single check's semantics *if* the waits can
become conditions instead of constants. Read `e2e/harness.ts` first: the repo already treats
hand-rolled `send-keys + sleep + capture-pane` as "the shape of a removed flake" and routes pane
probes through `paneEnv()`. Any replacement must poll a *condition*, never shorten a constant and
hope.

### L5 — Profile the checks from history, without running anything.

See §4. Lower ceiling than L1–L4, but it is free and it is the only lead that costs zero machine
time.

---

## 4. The dataset you do not have to generate

`e2e-trail/` in the **main checkout** (`/Users/owner/claude-fleet`) — **3172 run files,
210 MB**, one JSONL row per `check()` call, written since 2026-07-28. Concept:
`docs/e2e-trail.md`; emitter: `e2e/trail-emit.ts`. It is gitignored — reach it with `grep`/`rg -uu`,
not plain `rg`.

Row shape (real, from the newest file):

```json
{"v":1,"run":"claude-gate-20260821T044201Z-81316","suite":"claude-gate",
 "tree":"0ce32dc…","dirty":false,"check":"unprobed fixture: …","ok":true,
 "msSincePrev":262,"ts":1787287321877}
```

`msSincePrev` is a per-check duration. I ran one aggregate as proof the data is usable — newest
`isolated` run, `e2e-trail/isolated-20260820T230718Z-18601.jsonl`: **2771 checks, 1037.0 s summed**
(which cross-validates the ~1000 s audit wall-clock), and the **top 20 checks account for 20.9 %**
of it, each in the 9–15 s band.

That is one run. You have 3172. The questions that dataset can answer without booting a server:
which checks are slow *consistently* rather than once; whether slow checks cluster by family
(`suite` + check-name prefix); how holder duration has moved over time; and — for L1 — whether
failures correlate with concurrent runs, since `ts` ranges across files reveal overlap directly.

---

## 5. Already settled — do NOT re-propose

Re-proposing a retired idea costs the owner a round of re-litigation. From
`docs/suite-contention.md` §7 and the repo's history:

- **Server-side reaping of the lock.** Rejected: reaping belongs to the wrappers, which re-check
  the pid value; a second reaper races the window the design shrank to microseconds.
- **Queue ownership by the server** (server starts/stops suites). Rejected: needs the data the
  current projection produces before it can even be argued.
- **Scheduling, priorities, merge train.** Rejected on cost — ~6 lands/day. See L2 for the only
  way back in.
- **Running the full suite pre-land.** Already removed; §4(c) is implemented — the gate chain runs
  the fast suites only, and `e2e-isolated` runs post-land against the integrated tip.
- **Filesystem / APFS / Linux migration.** Measured dead, §2.
- **`rerere`, and hard-blocking the merge path.** Retired earlier in the land-hardening program.

---

## 6. Hard safety rules for this machine

Violating any of these damages live state; they are not stylistic.

- **NEVER run `bun server.ts` with default env.** Defaults are the LIVE tmux socket `claudefleet`
  and port 8790; a second server there adopts and drives the owner's real panes.
- **NEVER `pkill -f "bun server.ts"` or `pkill -f 'e2e-isolated.sh'`.** The first pattern hits the
  live server; the second hits the server's own post-land audit, which runs under that exact name.
  Both have been paid for. Kill only by a PID you noted yourself.
- **Killing a suite wrapper is not enough.** The `bun fleet-e2e.ts` runner survives with ppid 1 and
  keeps writing. Full abort: kill the runner PID *and* `tmux -L fleettest<pid> kill-server`, then
  check the lock dir and socket.
- **Any suite you run takes the machine-wide mutex and blocks real lands** for its duration. Do
  §4/§5 (analysis-only) first, and schedule any experimental runs deliberately.
- **Two concurrent `./e2e-isolated.sh` runs currently poison each other** per house doctrine — that
  claim is precisely what L1 asks you to date, so do not casually disprove it by accident. Any
  concurrency experiment is a designed measurement with the results dated, or it is noise.
- `docs/` in your worktree is a spawn-time snapshot. Read knowledge with `git show main:docs/…`.

---

## 7. Done means

A single tracked doc under `docs/` containing:

1. **L1 answered with a date**: is the concurrency claim pre- or post-2026-07-28-fix, and what is
   the evidence? If it is pre-fix, a designed measurement protocol — not a verdict.
2. **Ranked findings**, each with `file:line`, a stated cost in seconds or lands, and each marked
   **measured** or **inferred**.
3. **A cut line**: where the ranking stops satisfying the owner's ask.
4. **An explicit "what I did not check"** section.
5. No code changes. Proposals only.

If the same investigate-run-fail loop repeats ~5 times, the problem is structural — stop and report
that instead of iterating.

---

## 8. What I did not check when writing this

- I did not run any suite. Every wall-clock figure here is from `post-land-audits.jsonl`, the trail,
  or the wrappers' own `sleep` arithmetic — never from a run I performed.
- I did not read `server.ts`'s `runVerify` / `SUITE_LOCK_RE` implementation; I took its behavior
  from `e2e-stage.sh`'s comments and `suite-contention.md` §8. **Verify it before touching the wait
  line format.**
- I did not read `docs/verify-tiering.md` §11 (the flake families) or `docs/e2e-trail.md`. Both are
  directly on your path.
- I aggregated exactly **one** trail file out of 3172.
- I did not check whether `drills/drill-3.sh` or `steward-arena.sh` run often enough for their
  mutex use to matter.
