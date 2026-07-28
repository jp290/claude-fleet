# HANDOFF — 2026-07-27/28 (session 9: the audit, eight lands, and a deployed fleet)

*A thin map, NOT the knowledge. Every line is a claim to verify. **State is given as a COMMAND,
not a number** — this convention is inherited and it earns its keep: session 8's handoff was wrong
by six ledger rows within a day, and two of this session's own errors were stale numbers.*

**The single most important thing: the ② reviewer's main-side feed was `main..main` — structurally
empty for every lane ever reviewed.** All 25 shadow verdicts on record were correct readings of a
dead sensor, so the K2 series measured availability and never judgment. Fixed and **deployed**. The
first land after 2026-07-28 08:49 is the first time in this feature's life that ② sees a real main
side. Treat those verdicts as a NEW series; do not continue the old count.

## Status

**Recompute before believing anything below:**
```sh
cd ~/claude-fleet && git log --oneline -12 && git worktree list
python3 -c "
import json;from collections import Counter
r=[json.loads(l) for l in open('lane-outcomes.jsonl')]
s=[x for x in r if x.get('cleanReviewShadow')]
print('outcomes',len(r),'| shadow',len(s),
      '| would_stop EVER',sum(1 for x in s if (x['cleanReviewShadow'] or {}).get('verdict')=='would_stop'))
a=[json.loads(l) for l in open('post-land-audits.jsonl')];print('audits',Counter(x.get('result') for x in a))"
for p in $(pgrep -f 'bun server.ts'); do ps -o lstart=,pid= -p $p; lsof -a -p $p -d cwd -Fn|grep ^n; done
ls /private/tmp/tmux-501/ | grep -c fleet    # leaked e2e sockets — see Hygiene
```

**Accomplished.** Mined the five ledgers; ran a six-agent read-only audit of the data layer;
root-caused the merge/resolver flake; wrote the structural plan; briefed and landed **eight lanes**;
deployed. All of it is live as of 2026-07-28 08:49 (`launchctl kickstart` then `kill-session -t srv`,
in that order — the kickstart is required because `1028` changed the srv **spawn line** itself).

**Live now (verify with the commands above, not this list):**
- ② anchors its main side on the fork **commit**; an unresolvable fork renders UNKNOWN, never a
  settled zero. It also receives the lane's brief and the concurrent-lane picture.
- The tier-2 audit queue survives a srv restart (it previously died with it — that is why four
  lands on 07-26 have no audit rows and never will).
- The land path writes a durable intent marker before it moves `main`; boot recovers **from git
  alone** (`land_recovered` / `land_recover_fail`, never a fabricated undo pair).
- A red run names its failing checks (the cap kept 33 PASS lines and no FAIL names before).
- **A per-check trail** — `e2e/trail-emit.ts` writes one row per `check()`. Contract:
  `docs/e2e-trail.md`.
- Ledger reads span both rotation generations; state file has a unique temp name, mode-at-create,
  single-instance guard; `umask 077` now actually reaches the server.
- The board renders post-land audit results; `confirmedByHuman` no longer renders as
  "auto-landed clean+green".

**Broken / open:**
- **The merge/resolver flake is root-caused but NOT fixed.** `tryScriptRebase` discards
  `git rebase --abort`'s exit code (grep it in `server.ts`), so a lost `index.lock` race leaves a
  lane mid-rebase with conflict markers. The colliding actor is Fleet's own `tickGit`, which runs
  `git status` in every slot cwd with no merge-inflight guard. `gitRetry` exists and is wired to
  only two call sites, neither on the rebase path. **This is the autonomy blocker** — see Next Steps.
- The land path takes ~1 minute, and it is **not** `tsc` (1.7s) or `bun install` (0.03s): the
  verify gate ends with three suite wrappers chained by `&&`, each booting its own server.
- Wave 2 of the audit is unstarted (`docs/audit-implementation-plan.md`).

## Next Steps

The owner's stated goal: **streamline these processes and start testing autonomy.** That reorders
the structural plan — the following order is by *what unblocks the trial*, not by finding severity.

1. **Fix the git race.** Check `rebase --abort`'s exit code; route the merge path's rebase/abort
   through `gitRetry`; add `--no-optional-locks` to the read-only pollers; skip `tickGit` for a slot
   with a merge in flight. *Why first:* an unattended land's only safety net is the post-land audit,
   and this flake makes its reds ambiguous. A sensor that cries wolf is worse than none.
2. **Streamline the land path.** Parallelize the three verify suites — they are isolation-safe by
   construction (distinct socket prefixes, port bands 10800/13000/15200, separate processes).
   `watchdog.sh`, so it needs a `launchctl kickstart`; batch it with the next deploy.
3. **Define the trial.** Half-autonomy = drop **one** slice of the human's role under bounds, with a
   **friction log** as the product, not a pass rate. Recommended first slice: *land-then-show* —
   keep inspection (post-hoc) and standard-setting, drop presence-at-the-moment. Bounds that cost
   nothing: one outstanding unattended land at a time; no push until its audit returns.
   Pre-commit an end date and a review, or the trial silently becomes the default.
4. **Hygiene — it is degrading the box the trial will run on.** ~664 leaked e2e tmux sockets;
   ~690 MB of TMPDIR scratch; leaked test *servers* (two killed this session, one had run 23h).
   Nothing reaps any of it.
5. Wave 2 of the audit, and knowledge piece (b) — the lane read surface (`GET /api/self/context`).
   **Both are off the autonomy path**; do not let them displace 1–3.

**Blockers / open questions:**
- `would_stop EVER` is still 0 and now finally *measurable*. Nothing yet proves ② can disagree.
- Reversibility is still one land deep (`undoLast`, one record per repo). A burst of lands is
  un-rollbackable except for the last — and waiting between lands does **not** change that.
- Two lanes are open worktrees with no slot: `fleet-260726125942-a0fa`, `fleet-260726165836-6883`.
  Decide: land, or discard.

## Key Decisions

- **No new knowledge store / no Python program.** The gap was *currency of delivery*, not lookup.
  A lane can already read main's newest knowledge (`git show main:docs/x.md`) — verified live, and
  now a rule in `CLAUDE.md`. Reasoning and the prior two decisions it upholds:
  `docs/knowledge-currency.md`.
- **Record observations, not conclusions.** Conclusions rot; observations do not. This produced the
  per-check trail, which immediately proved the flake nondeterministic from four same-tree runs
  (7/1/7/1 failures on one tree) — work that previously cost a 7-minute re-run each time.
- **Extract one seam, not a rewrite.** `server.ts` is ~8× the house line ceiling and that *is* the
  mechanism failure behind the "two places that must agree, don't" bug class — but only the ledger
  layer is proposed for extraction (`docs/structural-plan.md`).
- **Burst-landing beats spacing.** Audits coalesce; waiting buys attribution only, never
  reversibility.
- **Lanes report, the owner lands.** Held all session. Every lane was briefed "do NOT land".

## Context to Restore

**Written this session** (read in this order for the full arc):
- `docs/mining-2026-07-26.md` — what the ledgers said; finding 3 carries the ② correction.
- `docs/data-audit-2026-07-27.md` — the six-agent data audit, ranked, with a cut line.
- `docs/suite-contention.md` — the flake's mechanism and why serializing is treating a bug as a property.
- `docs/structural-plan.md` — thirty findings → four mechanisms, with sequencing.
- `docs/knowledge-currency.md` — the knowledge-layer answer; amends `docs/knowledge-layers.md`.
- `docs/audit-implementation-plan.md` — the wave plan; wave 2 is the deferred list.
- `docs/e2e-trail.md` — the trail's contract (written by the lane that built it).

**Inherited and still load-bearing:** `CLAUDE.md` (gitignored — read it in the MAIN checkout, a
lane's copy is a spawn-time snapshot), `docs/verify-tiering.md` §11, `docs/graduation-criteria.md`,
`BACKLOG.md` item 17 (the knowledge-layer decision record — do not re-propose an index).

**Non-obvious state:**
- The live server binds **only** the Tailscale IP: `curl http://100.64.0.1:8790/`.
  `127.0.0.1:8790` never answers and looks like a dead server.
- Client changes go live on `bun run build` alone (static files); **server** changes need the srv
  restart. They deploy independently — this session's board rendering was live hours before the
  server code was.
- The trail writes to `<main checkout>/e2e-trail/` normally, but to a `$TMPDIR` fallback under the
  post-land audit (the snapshot is a tree, not a repo, so nothing points home). **Lane history and
  audit history therefore live in two places** — piece (b) must reconcile them.
- `src/client.ts` contains a raw NUL byte: plain `grep` reports nothing and exits 1. Use `grep -a`.

## Corrections this session made — including four of its own

Recorded because calibration is the point, not self-flagellation.
1. Claimed ledger rotation was already running, from an `audit.jsonl.1` seen inside a TMPDIR **test
   instance**, not the repo. Rotation has never fired.
2. Read shadow rows with the key `answer`; the field is `rawAnswer`. Nearly concluded the reviewer
   never answers — it demonstrably reads code and runs git.
3. Attributed ②'s identical verdicts to degenerate *traffic*. It was a broken *feed*. A lane found it.
4. Told a lane that `e2e/harness.ts` and `fleet-e2e.ts` were "touched by nobody" — true when
   written, false when read, because another lane committed in between. My own currency failure,
   an hour after documenting the class.
5. Advised landing one-at-a-time with waits. Wrong: audits coalesce, and `undoLast` is overwritten
   by every land regardless of timing.
