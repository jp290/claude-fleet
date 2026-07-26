# HANDOFF — 2026-07-26 (session 8: der Richter, der nie widersprochen hat)

*A thin map, NOT the knowledge. Every line is a claim to verify. **State is given as a COMMAND,
not a number** — session 7's handoff was wrong by six ledger rows within a day, and this one will
rot the same way. Numbers below appear only where a command cannot express them.*

**The single most important thing: fire-drill #3 is pre-registered, committed, and NOT YET RUN
(`83a25b2`). Its ground truth is sealed in `drills/drill-3-sealed-ground-truth.md`. Read that file
before the drill, and again before adjudicating — do not read the fixture first and reason
backwards.** Second: the dispatcher is OFF and that off is on disk (§5).

## 1. Recompute state before believing anything

```sh
cd ~/claude-fleet && git log --oneline -8 && git worktree list
python3 -c "
import json
rows=[json.loads(l) for l in open('lane-outcomes.jsonl')]; rows.sort(key=lambda r: r.get('ts') or 0)
a=[i for i,r in enumerate(rows) if r.get('branch')=='f9-verify-deps']; s=a[0]+1 if a else 0
k1=cl=unk=un=k2=raw=0
for r in rows[s:]:
    d=r.get('disposition')
    if d=='reverted': un+=1; k1=cl=unk=0
    elif d=='landed':
        k1+=1
        c=r.get('confirmedByHuman')
        if c is False: cl+=1
        elif c is None: unk+=1
    sh=r.get('cleanReviewShadow') or {}
    if sh.get('verdict') in ('pass','would_stop'): k2+=1
    elif sh: raw+=1
ws=sum(1 for r in rows if (r.get('cleanReviewShadow') or {}).get('verdict')=='would_stop')
print('rows %d | K1 %d/20 | clean %d/10 | unknown %d | undos %d | K2 %d/25 | raw %d | would_stop EVER %d'
      %(len(rows),k1,cl,unk,un,k2,raw,ws))"
TOK=$(python3 -c "import json;print(json.load(open('fleet.json'))['token'])")
curl -s -H "Authorization: Bearer $TOK" http://100.64.0.1:8790/api/sessions \
  | python3 -c "import json,sys; d=json.load(sys.stdin)
print('dispatch', d['dispatch'])
print('queued', len([t for t in d['tasks'] if t['status']=='queued']),
      '| pending', len([t for t in d['tasks'] if t['status']=='pending']),
      '| sent', len([t for t in d['tasks'] if t['status']=='sent']))
[print(' lane', s['id'], s['worktree']['branch'], 'ahead', (s.get('git') or {}).get('ahead'),
       'dirty', (s.get('git') or {}).get('dirty')) for s in d['slots'] if s.get('worktree')]"
python3 -c "import json;print('dispatch ON DISK =',json.load(open('fleet.json'))['dispatch'])"
pgrep -f 'audit skipped: not the fleet repo' >/dev/null && echo 'AUDIT RUNNING — no srv restart' || echo 'no audit'
```

**`would_stop EVER` is the number this session is about.** It has been `0` across every shadow row
ever recorded. K2 counts availability; nothing in the ledger measures whether ② can disagree.

The server binds **only** the Tailscale IP — `127.0.0.1:8790` never answers and looks dead.
`deployGap` on `/api/steward/sessions` (steward token) is NESTED. After any client land:
`bun run build`, then confirm `bundleStale:false`.

## 2. Do this next, in this order — the order is the content

1. **Deploy.** main has moved a lot (§6) and none of it is live. `pgrep` first (above): an srv
   restart inside a running audit discards it silently, no row, no log line (`babbf719`).
2. **Fire-drill #3** — `./drills/drill-3.sh`, on a QUIET machine. Not beside an audit, a suite, or
   a fresh lane: measured 2026-07-26, concurrent `e2e-isolated.sh` runs manufacture failures on
   *both* trees with *different* signatures, so such a pair proves nothing. `DRILL_SMOKE=1` first
   if you changed the harness — it exercises the mechanics with a stand-in and tells you nothing
   about the judge, which is the point.
3. **`7319e7ad`** — a filed task cannot be corrected. This is the queue's metabolism (§7).
4. **`639e35ff`** (`landInitiatedBy`) — the ledger axis a gate needs before it exists.

Nothing here is a burn-down item. The queue is not a list to empty (§7).

## 3. Settled — do not re-derive

- **② is reliable and entirely undiscriminated.** The parser fix `7e385e4` held: 0 contract misses
  in every row after it. The one open failure mode is the empty answer (~1 in 14) — the reviewer
  runs and says nothing. Filed as `cc913fe1`, with an explicit instruction to diagnose before
  touching the timeout.
- **The drill harness has no deviation left to argue about.** Omitting `FLEET_CLEAN_REVIEW_CMD`
  makes `runCleanReview` fall through to the real model, real prompt, real parser, real
  outcome-row write (`server.ts`, grep `CLEAN_REVIEW_CMD ?`). The fixture repo is isolated; the
  smoke run left NO trace in the production ledger.
- **A seeded defect must not be one tsc or the gate would catch** — ②'s prompt explicitly forbids
  flagging what the type/test gate enforces (`merge-prompt.ts`, grep `Do NOT flag style`). The
  smoke run proved the composed fixture tree is tsc-clean, so the premise holds.
- **②'s evidence horizon is the whole rebased worktree**, unlike ③'s diff-text-only. It is told to
  use tools and to "READ the actual code to confirm" (`merge-prompt.ts`). Drill design that
  ignores this tests the spec, not the judge — that is how drill #1 on ③ went wrong.
- **`--allowedTools` is ADDITIVE** to `~/.claude/settings.json`; anchors bind only with
  `--setting-sources ""`. A model refusing proves nothing — only a verbatim harness denial counts.
  SEC-4's lane re-proved this by writing a file and executing a `git rebase -x` payload OUTSIDE
  the worktree under the old tool set.
- **`src/client.ts` holds a raw NUL byte** — `grep` silently returns nothing for every pattern.
  Use `grep -a`. Still true; `688d22e` fixed a different instance of the problem, not this file.

## 4. Where autonomy stops — and the two leashes that are only prose

```sh
grep -n "dispatchOn" server.ts        # init, boot-reload, POST route. NOTHING sets it false automatically.
grep -n "lastPostLandAudit" server.ts # written + one route serializer. NO tick consumes it.
grep -an "postLandAudit" src/client.ts # EMPTY — a red tier-2 audit is rendered nowhere.
```

Fleet reaches *select → brief → run → auto-③ review* on its own and stops at the merge trigger.
Two things that read as safety are not:

- **Trial-1's stop condition S1 ("post-land audit red → stop dispatch") has no mechanism and no
  perception.** It depends on a human polling a JSON route that has no UI. Verified above.
- **Lane creation records no requester.** `slot_open` + `self_heal_recreate` look identical whether
  a human clicked or the dispatcher spawned. The only way to tell them apart today is whether a
  task flipped to `sent`. Same missing axis as `landInitiatedBy`, one step earlier.

Nothing mechanically stops a session agent holding the owner token from landing. The boundary is
restraint, and this project has already proved once today what restraint-as-prose is worth (SEC-4).
The written reason not to is the independence clause (`graduation-criteria.md`, grep
`Independence caveat` — the phrase wraps a line, so a longer grep finds nothing) — briefer,
lander and labeler must not be one instance. Note it is
narrower than it sounds: `POST /merge` on a clean lane writes `confirmedByHuman:false`, an honest
row. Only the confirm-land route stamps `true`, and only that one can lie.

## 5. Owner decisions, not a session's

1. **The dispatcher is OFF and the off is on disk** — verify with the last line of §1. Careful:
   `884ba29` fixed the route to persist by itself, but it is **not deployed**, so the running
   server still has the old route. The off survived only because unrelated task mutations forced a
   `saveState`. Until the deploy, use the HANDOFF-§5 workaround (switch, touch other state, verify
   the file) — after it, the route does this itself and writes an audit line.
2. **Quiet hours are still `null`.** Restore with `POST /api/autos/quiet {"start":23,"end":8}`.
3. **The 3-day-old orphan `tmux -L fleettest23870 kill-server`** is still alive. Untouched on
   purpose: outside the repo is shared reality, so a session reports rather than kills. ~190 other
   `fleettest*` entries are dead socket FILES, not servers — check with `has-session` before
   killing anything, and never kill one belonging to a running audit or drill.
4. `docs/autonomy-trial-1.md` remains pre-registered. §2 of `graduation-criteria.md` was amended
   (`732d8fd`) with its rationale written before the data it enables — read the amendment before
   adjudicating the drill.

## 6. Shipped this session

`8601bab` SEC-3 · `c7f701e` SEC-12 · `688d22e` NUL-fix · `732d8fd` the ② calibration finding +
the §2 amendment · `f009a31` openSlot moves the pane · `da5186d` e2e teardown ·
**`da8b09f` SEC-4** (the ② reviewer is read-only by capability, not by prompt) ·
**`884ba29`** the dispatcher stop survives a restart and leaves a trail · `3e30cfe` per-slot
mission · `13c5728` continuity fact · `83a25b2` the drill harness + sealed ground truth.
Two of these were briefed by the dispatcher, not by a human. A **data-saver program** is running on
separate lanes (`22390c4`, `8a2951d`) — not this session's work; read its own commits.

`CLAUDE.md` was updated in the main checkout (gitignored, so it never shows in a catchup diff):
the "concurrency-safe" claim now says explicitly that it covers socket/port/dir and **not machine
load**, and that a fails-identically-at-HEAD proof must run serially or it is worthless.

## 7. The queue is not a list to empty

It holds three different kinds of object and only one is work: **work**, **notifications** (the
steward telling someone something is true), and **bookkeeping about tasks**. A lane spawned on the
third kind is absurd, and the dispatcher would do it anyway — check the queue's *shape* before
arming it, not just its length.

**The metabolic cause is `7319e7ad`: a filed task cannot be corrected.** So every correction
becomes a NEW task. This session retired `10ab6127` (regime-mixed premise) and filed `cc913fe1` to
replace it — the queue grew by one row while nothing new became true. That is not an anecdote, it
is the mechanism, and it will keep running until `7319e7ad` lands.

Retire with `done`, **never `delete`**: on a pending steward-origin task `delete` writes
`bumpTally("propose","dismissed")`. `done` and `unqueue` write nothing — verified in the route
(`server.ts`, grep `proposeOutcome`). The known-bad tally row from session 7 stands uncorrected on
purpose; silently adjusting a measurement is worse than a known error in it.

## 8. Corrections this session made — including four of its own

The value of this section is that it is the part that does not survive a compaction.

- **"35 % of shadow runs miss the contract" was regime-mixed** (mine). It counted the first 14
  rows, almost all from before the parser fix. Post-fix the contract-miss rate is 0. A measurement
  window that straddles a fix measures the fix, not the system.
- **There is no `verify` field on an outcome row** (mine). It is `verified`. Reading an absent key
  and calling it "skipped" produced a two-minute false alarm about the live gate. The row's real
  keys are worth listing before querying them.
- **SEC-4 was not a hard precondition of the drill** (mine). In an isolated fixture repo the write
  tools are harmless. It is still the right ORDER — drilling the configuration about to be replaced
  measures nothing durable — but the stated reason was wrong.
- **"A blocker nobody has named" was half-named** (mine). `adversarial-2026-07-25.md` B3 and
  `graduation-criteria.md` already record that `confirmedByHuman: false` ≠ unattended. The
  correction produced a *better* design: the field is not broken and must not be touched, so
  `landInitiatedBy` is purely additive. Also found on the way: `confirmedByHuman` lives in TWO
  places — the ledger row and the git note written by `writeLandNote`. Change one, they diverge.
- **`confirmedByHuman` is procedural, not approval.** It answers "was there a SECOND human step",
  and every land so far is an owner-initiated merge. §1 of the criteria would license unattended
  landing on a population containing zero unattended lands. That is B3's finding, not this
  session's; it is repeated here because it is the reason `639e35ff` exists.
