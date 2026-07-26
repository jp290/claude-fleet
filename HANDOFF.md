# HANDOFF — 2026-07-26 (session 8: der Richter, der nie widersprochen hat)

*A thin map, NOT the knowledge. Every line is a claim to verify. **State is given as a COMMAND,
not a number** — session 7's handoff was wrong by six ledger rows within a day, and this one will
rot the same way. Numbers below appear only where a command cannot express them.*

**The single most important thing: fire-drill #3 RAN, twice, and measured NOTHING (§2c).** Both
runs returned an empty answer, which the pre-sealed bar calls a non-measurement rather than a miss —
so ②'s discrimination is still entirely unmeasured, and `cc913fe1` (the reviewer does not answer)
is now the top of the ladder, not a P1. Ground truth and harness are in `drills/`, committed before
the run; read the sealed file before any re-run and again before adjudicating, and do not read the
fixture first and reason backwards.

**Second: §9 reorders the autonomy ladder** — reversibility, not the judge, is the weakest link, and
one of the graduation gate's three conditions has no code at all. Third: the dispatcher is OFF and
that off is on disk (§5). Fourth: the new pre-land gate is committed and **not live** (§2 item 1).

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

1. **`launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog`, then an srv restart.** The
   new pre-land gate (§2a) is committed and **not live**: `VERIFY_CMD` is baked into the srv spawn
   line, and the running `sh` does not re-read `watchdog.sh` mid-loop. `pgrep` first (§1) — a
   restart inside a running audit discards it silently, no row, no log line (`babbf719`).
   **Do not read `codeBehind:true` as "the server is stale".** Right now it is true because
   `watchdog.sh` and two harnesses moved; `git diff --name-only <bootHead>..HEAD` shows no
   `server.ts`. Check the file list before spending a restart.
2. **`cc913fe1`** — ② produces no answer at all. This is now the **top** of the ladder, not a P1:
   fire-drill #3 ran twice and measured nothing (§2c), so no statement about semantic safety is
   currently measurable. Everything downstream waits on a sensor that responds.
3. **`252c01c2`** (undo depth) and mechanising S1 — the two safety items §9 argues must precede any
   unattended land, not follow it.
4. **`7319e7ad`** — a filed task cannot be corrected. This is the queue's metabolism (§7).
5. **`639e35ff`** (`landInitiatedBy`) — the ledger axis a gate needs before it exists.

Re-running the drill: `./drills/drill-3.sh` on a QUIET machine, `DRILL_SMOKE=1` first **whenever the
harness or `server.ts`'s imports changed** — that rule is not ceremony, see §2c.

Nothing here is a burn-down item. The queue is not a list to empty (§7).

Machine hygiene, both learned the hard way: count contention with
`ps -eo command | grep -c '^/bin/sh ./e2e-isolated.sh'` — a bare `grep e2e-isolated.sh` counts zsh
wrappers and reports contention that is not there. Serialise suites with
`until mkdir /tmp/fleet-e2e.lock 2>/dev/null; do sleep 20; done` … `rmdir`.

## 2a. The pre-land gate changed today (`07be94d`) — committed, NOT live

`verify-tiering.md` §8 steps 1+2 are applied. `tsc` now covers seven files instead of four (the
three single-file harnesses were imported by nothing the checker saw), and `./e2e-clean-review.sh`
joins the gate ahead of `./e2e-claude-gate.sh` — **the first land-path coverage the gate has ever
had**. `FLEET_VERIFY_TIMEOUT_MS=300000` rides along; verified the server actually reads it
(`server.ts`, grep `VERIFY_TIMEOUT_MS`).

**Step 2b is in too** (`58203f2`), after the burn-in §8 asks for and that had never actually
happened: 10/10 `ALL PASS`, 47 checks each, **34–35 s, variance under a second** — markedly more
deterministic than `./e2e-isolated.sh` managed in three runs. The earlier "10 runs" were void
because the suite was broken (§2b).

§8 measured the parts. Measured here for the first time, twice, exactly as the server will run it:
**three-part gate exit 0 in 69 s** (§8 predicted 65.6 s median / 73.8 s worst) and **four-part gate
exit 0 in 101 s** (§8 predicted 100.0 s with 2b folded in). The 300 s timeout is 2.97× the latter.
Ordered cheapest-first so it fails fast: tsc 1.6 → clean-review 19 → security 35 → claude-gate 45.

Deliberately still out: `./e2e-isolated.sh` (§5 — non-deterministic under load; it stays tier 2,
*after* the land).

## 2b. A suite that runs in no gate rots silently — twice in one evening

The same mechanism twice, by two different lanes, and neither was noticed until a human ran the
suite by hand. This is the strongest argument for §8 that this day produced — stronger than §8's
own numbers.

- **A foreign lane broke it.** `13c5728` (continuity) added `server.ts`'s fourth relative import and
  pulled `continuity.ts` into three e2e wrappers — not `e2e-security.sh`. From that land on the
  suite aborted in ~3 s at `Cannot find module './continuity'`, ran **zero** checks, exited 1.
  Fixed: `d146e74`.
- **Its own lane broke it.** The data-saver land replaced the 2 s poll's task list with digests, so
  `fleet-e2e-security.ts` §5 — which matched its task by `text` against `/api/sessions` — got
  `undefined` and four checks fell as dominos behind one broken join. Fixed: `e5e5e80`, using the
  id-join pattern `e2e/intake.ts` already had to adopt. That lane never saw this harness because it
  is a single file **outside** the `e2e/` structure.

Two things worth carrying, neither obvious from the fixes:

- The digest sheds **more than text** — null-valued fields are omitted entirely. So the spoof
  assertions now read the STORED record via `GET /api/tasks`, where a rejected `slot` is an
  explicit `null`; against the digest they would have had to assert an *absent key*, a weaker claim
  about a different object. Porting the id-join alone would have quietly downgraded a security check.
- The join now has its **own named check**, so the next payload change fails at the join instead of
  reporting four unrelated security checks as broken.

**Resolved on the way:** the suite's runtime had grown 34 s → 90 s and the handover flagged it
uninvestigated. It was the broken §5 poll burning its full 60 × 1 s budget. After the fix, ten runs
at 34–35 s — back on §8's numbers. No second defect underneath.

**The lesson that outlives both fixes:** a burn-in certifies only what it actually exercised, and
"how many checks ran" is not visible in the exit code or the tail. The import failure was loud
(exit 1 after 3 s), but the §5 breakage was not — the suite still ran, still ended, and reported
42/4 with four *named security checks* dark. So count the checks per run
(`grep -c '^PASS'` — it is why the burn-in log above carries `checks=47` on every line, not just a
tail). A run whose check count silently drops is the shape that gets mistaken for a burn-in.

## 2c. Fire-drill #3 ran — and measured nothing, twice

Both runs: `verdict: null, raw: true, rawAnswer: ""`. The bar sealed **before** the run
(`drills/drill-3-sealed-ground-truth.md`) classes an empty answer as a **non-measurement, not a
miss** — so nothing may be concluded about ②'s discrimination in either direction. It is still
undrilled in the only sense that counts, and §2's "≥1 demonstrated catch" is unsatisfied.

Nothing was adjusted afterwards. Bar, fixture and the 180 s timeout stand as sealed. Raising the
timeout is the obvious move and is refused on purpose: it would measure a configuration production
does not run, and a deviation introduced in response to a disappointing result is exactly what
pre-registration exists to prevent. Run 2 was unchanged and legitimate for a stated reason — a
non-measurement reveals nothing about the judge's judgment, so it is not the contaminated case.

**The finding the drill did produce: 2 of 2 empty answers in the harness against ~1 in 14 in
production.** Narrowed, not root-caused: no transcript was written anywhere under
`~/.claude/projects` for either run, and `summaryViaSession` creates one as soon as the first
prompt lands — so the reviewer never reached the answering stage, a different failure from
answering off-contract. A minimal repro rules out a trust prompt in the drill's cwd, and
`claudeAliveAt` (`server.ts:1341-1346`) accepts both the pane process and a child, so readiness
detection is not the gap. That lead belongs to `cc913fe1`.

**Four of my own errors, found by a second pass rather than a test — two had already been quoted to
the owner as evidence:**

- `drills/drill-3.sh` used port band 15000–16999, overlapping `e2e-security.sh`'s 15200–17199.
  Harmless while that suite ran nowhere — **live the moment I put it in the gate myself**.
- `docs/verify-tiering.md` described §8 as unapplied in four places after I had applied it.
  Wissenspflege means the doc moves with the change; I updated HANDOFF and forgot §8's own home.
- **The harness carried the same `continuity.ts` rot it was built to study.** continuity landed
  15:51:37, the harness was committed 15:54:48 — three minutes. The smoke run had passed *before*
  continuity landed and I committed on its strength. **A smoke test validates the tree it ran on,
  not the tree you commit.** Fixed structurally: the copy list is now derived from `server.ts`'s
  actual relative imports every run, proven to fire and not to false-alarm.
- **The `tsc` premise check could not fail.** `tsc … | head && echo clean` takes the pipeline's
  status from `head`, so it printed "clean (exit 0)" directly under five `TS6053` errors — and I
  had cited that line as proof the premise held. A check that cannot fail is worse than none,
  because it gets quoted.

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
Two of these were briefed by the dispatcher, not by a human.

**The data-saver program landed AND is deployed** (`bc4e975` payload · `da0857e` transport ·
`7722de4` reconnect · `f323fb4` mode) — separate lanes, not this session's work; read its own
commits and `docs/data-saver.md`. Measured on the running server: `/api/sessions` 112 410 B →
7 479 B raw, **1 907 B on the wire** (gzip); 3.37 MB/min → 57 KB/min. Verified here that the server
did boot on it (`bootHead f323fb4`).

Then, from the slot-8 handover: `d146e74` + `e5e5e80` (§2b) and **`07be94d`** the pre-land gate
(§2a). `docs/scope-inflation.md` is new and `docs/verify-tiering.md` §11 is extended — a fourth
flake family (merge/resolver) and a corrected proof method: **repeating the SAME tree beats a fresh
HEAD worktree**, because a green HEAD run cannot separate "our regress" from "the flake did not
fire this time". §11.6 was retracted by its own author and §11.6c rejects file-based check
selection with numbers — do not re-open either.

`CLAUDE.md` was updated in the main checkout (gitignored, so it never shows in a catchup diff — a
lane cannot do this, it must report the text and someone applies it by hand):

- "concurrency-safe" now says explicitly that it covers socket/port/dir and **not machine load**.
- **The flake-proof order is inverted, and this replaces the old rule.** Re-run the SAME tree
  first; green on a re-run proves non-determinism directly and you are done. The fresh HEAD
  worktree is the *fallback* for a tree that keeps failing identically — because a *green* HEAD run
  proves nothing (it cannot separate "our regress" from "the flake did not fire this time") while
  reading like a conviction.
- Four known flake families, not two: §5b's three plus **merge/resolver**.
- The quiet-machine check and the `/tmp/fleet-e2e.lock` serialisation idiom.
- Before a finding becomes a programme: quote the owner's instruction verbatim and cut the ranking
  where it is satisfied (`docs/scope-inflation.md` §7).

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
- **A handover is a claim set too** (added when slot 8 handed over). Two of its statements needed
  correcting before use, and both would have cost a wrong action:
  - *"HANDOFF §2 point 1 (Deploy) is done — please strike it."* Half true. The data-saver deploy
    did happen, but main was already 7 commits ahead again and the gate change specifically needs a
    kickstart. Striking "deploy" outright would have hidden a required step.
  - *"fix it, 46 checks"* — the proposed fix (port the id-join) would have left a security
    assertion silently weakened, because the digest omits null fields as well as text. The suite is
    47 checks now, not 46; the extra one is the join itself.
- **`confirmedByHuman` is procedural, not approval.** It answers "was there a SECOND human step",
  and every land so far is an owner-initiated merge. §1 of the criteria would license unattended
  landing on a population containing zero unattended lands. That is B3's finding, not this
  session's; it is repeated here because it is the reason `639e35ff` exists.

## 9. What is actually missing for autonomy — scored against the code, not the backlog

The word is **possibility**: not what we want to build, but what must be true before a *first
unattended land* is even permissible. `lane-autonomy-future.md` already names six components; this
is each one measured against `server.ts` rather than against its own description.

| # | component | state |
|---|---|---|
| 2 | durable land ledger | **done** — `lane-outcomes.jsonl` + the git note from `writeLandNote` |
| 4 | verified-green precondition | **done, and stronger since today** — `verify.ok` is three-valued, a skipped verify cannot auto-land, and the gate now covers the land path (§2a) |
| 1 | structured resolution record | partial — `resolvedConflict`/`repairRounds` land on the row; the per-conflict relational assessment does not |
| 6 | post-hoc review feed | partial — outcome rows render, **a red tier-2 audit renders nowhere** (`grep -a postLandAudit src/client.ts` → empty) |
| 3 | first-class undo | **weak, and this is the surprise** |
| 5 | graded autonomy gate | **blocked, and one of its three conditions has no code at all** |

**Component 3 is the weakest link, not the judge.** Verified: `undoLast` is a
`Map<repo, LandRecord>` — **one** record per repo, overwritten by `recordLand` on every land that
moves main (`server.ts:2755`, `:2801`). And `onRemote` (`:5949-5952`) makes undo **refuse outright**
once the land reached a remote: *"revert it by hand instead."* So the reset tier exists and the
revert tier is delegated to a human. Component 5 says the gate must be **reversibility-primary, not
confidence-primary** — and reversibility is one land deep and void on push. This whole session, me
included, treated the judge as the blocker. Fleet's own design says otherwise.

**Component 5 cannot be satisfied as written.** It requires "not in a high-stakes zone
(migrations/auth/config)", and `graduation-criteria.md` §1 conditions graduation on
*non-high-stakes-zone* auto-land. `grep -n "high-stakes\|highStakes\|zone" server.ts` → **nothing**.
There are no zones. Meeting §1 on its numbers alone would mean skipping a condition, not satisfying
it. Two of its three conditions ARE computable today (clean-vs-resolved from `tryScriptRebase`;
reversibility from `undoLast`) — the third is unbuilt.

**The instrument that would catch what the deterministic gate structurally cannot does not answer.**
Component 5 names the sharp edge itself: *green tests ≠ semantically correct*. ② is the only thing
aimed at that edge, it has never returned `would_stop` in any production row, and the drill got 2/2
non-measurements (§2c). Until `cc913fe1` lands, **no statement about semantic safety is measurable
at all** — which is why it moved to the top of §2.

**The brake has no mechanism.** Nothing in the codebase ever sets `dispatchOn = false`
automatically (`grep -n dispatchOn server.ts` → init, boot-reload, POST route). No tick reads the
audit trail. Trial-1's stop condition S1 is a sentence in a document, enforced by a human noticing
a JSON route that has no UI.

### The part no criterion can fix

`graduation-criteria.md` B3: every land in the ledger is an **owner-initiated** merge;
`confirmedByHuman:false` means "no *second* human step", not "unattended". B4: 10 of 10 counted
lands touched the measurement machinery itself. And `FLEET_DISPATCH_REPO` is a single string
(`server.ts:252`) — that repo is Fleet. So the evidence base is **Fleet modifying Fleet, attended,
every time**.

**No number of attended lands can license an unattended one.** Attended lands measure the pipeline —
does the rebase classify correctly, does verify hold, does the gate catch things. They cannot
measure the absence of the human, because the human was there. §1's N is met (recompute it in §1)
and has been for a while; what blocks graduation is not a number and never was.

So the next step is **not another criterion — it is the smallest bounded experiment**, and the
bound has to be mechanical, because "we'll be careful" is exactly the prose-vs-capability failure
this project keeps re-discovering. In order, and each blocking the next:

1. **`cc913fe1`** — a sensor that answers. Flying with a dead one is worse than flying blind,
   because a null reads like a pass to anything that averages.
2. **Zones (component 5's missing third)** — make "bounded blast radius" a git-computable predicate
   over changed paths, not a promise. This is the item nobody has filed.
3. **`252c01c2`** — undo that survives a burst, plus the revert tier for the on-remote case.
   Reversibility is the gate's primary criterion by design; today it is its weakest.
4. **Mechanise S1** — a red tier-2 audit sets `dispatchOn = false`, writes an audit line, and
   surfaces. Pure downside protection with no upside, which is precisely why it keeps sliding.
5. **`639e35ff`** — so the first unattended land is legible in the ledger instead of looking like
   a clean auto-land.

Then, and only then: **one** unattended land, in the narrowest zone, with quiet hours restored so
it happens while someone is awake, and with the undo verified beforehand rather than assumed.

Name the trade every time, as `lane-autonomy-future.md` demands: autonomy exchanges *"nothing wrong
ever reaches main"* for *"wrong-but-reversible-and-documented may reach main briefly."* Both of the
words carrying that bargain — **reversible** and **briefly** — are today the two least-built parts
of the system.

## 10. The owner's counter-question, and who should answer it

Raised 2026-07-26, after §9: **could supervision be simulated by giving the agent the situational
and background knowledge it needs?** Not "trust the agent more" — *give it what the human has, and
find out how much of the human's contribution was knowledge all along.*

It is the project's own thesis pointed at its own boundary (perception before autonomy), and it is
not naive. It also has to survive three things, and the third is a measurement rather than an
argument:

1. Context raises judgment quality but does not change category — statistical stays statistical,
   and a gate is a check that can FAIL legibly, not a better opinion.
2. Exposure does not transfer. Knowledge is copyable; consequence is not.
3. **② is not context-starved and still says nothing.** It holds tools and is told to read the
   code; it has returned `would_stop` zero times ever, and the drill got 2/2 non-measurements. No
   enrichment would have moved one of those rows. Related and unflattering: three of this session's
   four self-corrections were reading errors *with full access* — the bottleneck was looking, not
   having.

The reframe that may be the real answer: enrichment probably does not **replace** supervision, it
**shrinks the domain** where supervision is required — which, stated mechanically, is exactly the
zone predicate §9 found missing from the code.

And it is an empirical claim, so it is testable rather than arguable: **same drill fixture, two
prompts** — one context-poor as today, one carrying the lane's brief and the concurrent-lane
picture. Blocked behind `cc913fe1` like everything else: a richer prompt measures nothing while the
reviewer answers nothing.

**Handed to a fresh mind on purpose.** The full brief is `docs/supervision-decomposition.md` — self
contained, embeds what ② is and is not given, states what must not be re-derived, and ends with six
questions rather than a plan. The most valuable one is the adversarial one: *what would make this
whole line of thinking wrong?*

The owner intends to run it as a **Fable 5** session. Two operational notes for that, from
`CLAUDE.md`: Fable 5's safeguards have false-flagged fleet sessions on token/remote-access
vocabulary (3× on 2026-07-11), so the brief is deliberately a **design question with no operational
vocabulary** — no tmux, no tokens, no remote-control content. If a turn dies to a safeguard flag
anyway, rephrase or `/model opus`. And it is a *thinking* session, not a lane: it should return
reasoning, not a diff.
