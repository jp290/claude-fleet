# HANDOFF — 2026-07-25 (session 6: the adversarial day — four lands, seven sweeps, one reframe)

*A thin map, NOT the knowledge. Every line is a claim to verify. **This file quotes no counter
it cannot justify**: the previous handoff was wrong by 6 ledger rows within a day of being
written (`adversarial-2026-07-25.md` §C finding 10), so state below is a COMMAND, not a number.*

## 1. Recompute state before believing anything

```sh
cd ~/claude-fleet && git log --oneline -3
python3 -c "
import json
rows=[json.loads(l) for l in open('lane-outcomes.jsonl')]; rows.sort(key=lambda r: r.get('ts') or 0)
a=[i for i,r in enumerate(rows) if r.get('branch')=='f9-verify-deps']; s=a[0]+1 if a else 0
k1=cl=un=k2=0
for r in rows[s:]:
    d=r.get('disposition')
    if d=='reverted': un+=1; k1=cl=0
    elif d=='landed':
        k1+=1
        if not r.get('confirmedByHuman'): cl+=1
    sh=r.get('cleanReviewShadow') or {}
    if sh.get('verdict') in ('pass','would_stop'): k2+=1
print('rows %d | K1 %d/20 | clean %d/10 | undos %d | K2 %d/25'%(len(rows),k1,cl,un,k2))"
curl -s -H "Authorization: Bearer $(python3 -c "import json;print(json.load(open('fleet.json'))['stewardToken'])")" \
  http://100.64.0.1:8790/api/steward/sessions | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['deployGap'], d.get('bundleStale'))"
```

At 16:20 this read `rows 20 | K1 13/20 | clean 12/10 | undos 0 | K2 1/25` — recompute, do not quote. **`deployGap` is
NESTED**; `codeBehind:false` with `behindCount>0` = docs-only drift, no deploy needed.

## 2. The reframe — read this before choosing what to build

**The stated bottleneck ("data velocity", last handoff §3.4) is wrong.** Data velocity is fine.
The binding constraint is **owner adjudication, measured at zero**: `dispositions.jsonl` holds
exactly ONE record in its lifetime and it was written *automatically* by the compose box
(`src/client.ts:3616`), so deliberate owner judgements ever = **0**. Three of the four
graduation criteria terminate in such a label (§1 wrong-class, §2 owner-confirmed catch, §4
`promotionEligible`) — at the observed rate they are not slow, they are **unreachable**.
Meanwhile the queue grows: 3 steward proposals pending, two of them 18–28 h old and pointing at
lanes that no longer exist, with nothing that ages or reaps them.
Evidence + argument: `adversarial-2026-07-25.md` §E1.

Corollary worth acting on: **the land-class disposition write path has never executed in
production.** The first ✓/✗ on a feed row is both the unblocking action and the rail's first
real test.

## 3. What landed today (all deployed; srv restarted twice, health-checked both times)

| commit | what |
|---|---|
| `b12052a` | ② shadow persists `rawAnswer` on `raw:true` rows — the K2 blindness fix; first steward-adjudicated land |
| `96fe66c` | baselineRate flake killed via monotone `seen`/`seenHelped` lifetime counters |
| `0531817` | `fleet-e2e.ts` split into 23 `e2e/*` modules + `e2e/harness.ts`/`e2e/ctx.ts` (702 names preserved — verified by name-diff — plus 3 new); pane-capture flake fixed via `paneEnv()` |
| `e7559db` | **real server bug** that lane found: `openSlot` now drops a recycled slot's stale `gitInfo`, so a fresh empty lane can no longer read `done-looking` off the previous lane's facts and draw a phantom auto-③ review |
| `8502c72` | `docs/architecture-review.md` — 12 ranked architecture findings |

**All three known structural flakes are CLOSED** (detail in `adversarial-2026-07-25.md` and the
lane reports). Consequence: a failing check is now YOURS until proven fails-identically-at-HEAD.

Docs landed: `adversarial-2026-07-25.md` (**the index — start there**), `gate-coverage.md`,
`ungoverned-artifacts.md`, `trust-perimeter.md`, `compiler-program.md`, the criteria amendment,
the `rundgang.md` scheduling amendment. All are now listed in `docs/README.md`.

## 4. In flight — nothing. Session closed clean.

**`verify-tristate` LANDED** (`c48c344` + `e0e69ef`, ledger row 20) and is deployed
(srv `e0e69ef`, health 200, bundles rebuilt). The highest-severity finding is closed: verify is
now **four-valued** — `verify` absent = no command configured (still auto-lands, *unconfigured ≠
skipped*), `ok:null` = the command declined to verify (**never** auto-lands), `false`/`true` =
actually ran. Recognised via a reserved `exit 42` **and** the legacy `verify skipped:` marker,
so the hole closed at the srv restart rather than waiting on `launchctl kickstart`.
Evidence: 720 PASS on all three suites plus a red-at-HEAD proof with 9 relevant failures.

**Owner step still open (optional):** `launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog`
activates the `exit 42` guard in `watchdog.sh`. Not required — the marker path already covers it.

`⚙ steward` idle; its `CLAUDE.md` is a spawn-time snapshot from 07-24, **9 lines stale**.

## 5. Owner decision queue (nothing was done unilaterally)

1. **Label some rows** — §2. Highest leverage available, and it exercises an untested path.
2. **Backup.** The remote is **PUBLIC** and unpushed since 2026-07-13, so pushing now would
   newly publish every doc in `docs/`. The untracked layer (rulebook, owner model, 4 trails) has
   no version control or off-machine copy at all. Recommended: a **private** mirror. Not done —
   outward-facing and irreversible. `ungoverned-artifacts.md` §4–5.
3. **`/rundgang` schedule** — decided on measured evidence (kept, plus two tripwires); reverse it
   if you disagree: `.claude/commands/rundgang.md`.
4. Still open from session 5: 3 leaked `bun server.ts` (Jul 18/21/23) + ~235 stale
   `/private/tmp/tmux-501` sockets; fate of the orphaned `fleet-flake-waitmerge` worktree.

## 6. Build queue, in the order the evidence supports

1. **② JSON extraction** (cheap, unblocks K2). 5 of 6 shadow answers wrapped valid JSON in a
   prose preamble; the 6th — a short answer — parsed and became K2's first valid verdict. So the
   fix is *extract the first JSON object from the body*, not reprompting.
2. **`kProgress` fail-green** — `src/client.ts:2935` is `if (!o.confirmedByHuman) clean++`
   against an **optional** field, so a row missing it counts as a clean auto-land. "Unknown ≠
   zero" violated inside the autonomy counter itself.
3. **Owner-perception fact layer** (§E4): unlabeled rows, oldest pending proposal, proposals
   pointing at dead lanes, deliberate labels in 7 days — rendered where the owner already looks.
   Turns §2 from an argument into a number the system reports about itself.
4. **Doc-claims check wired into `e2e-claude-gate.sh`** (§C): a doc may name an env var / route /
   constant only by symbol, else the gate fails. The executable answer to doc rot, which prose
   discipline has now failed to prevent four times.
5. Then: `runWorker` extraction (`architecture-review.md`), the post-land audit tier
   (`gate-coverage.md` §5), steward-pulse phase A, provenance lane (F3 `briefHash`).

## 7. Traps this session paid for

1. **Never commit to main while a land is in flight.** Cost a full verify cycle: the lane rebases
   onto main-at-T0, verify runs ~a minute, ff then fails with "Diverging branches". The gate
   failed *closed* and kept the lane — correct behaviour, self-inflicted trigger.
2. **A lane cannot update `CLAUDE.md`.** Gitignored + copied at spawn ⇒ the edit is invisible to
   `git status` and dies with the worktree. `e2e-split`'s rulebook update was rescued by hand.
   Lanes must report rulebook changes as TEXT. (`ungoverned-artifacts.md`)
3. **Verify a subagent's claim before repeating it.** Two of four sweeps needed correction, and
   my own "the rollback is untested" was wrong — `e2e/land-provenance.ts` has 10 undo checks;
   the honest claim is that its *human* half has never run.
4. **`grep` on `src/client.ts` needs `LC_ALL=C grep -a`** — a plain grep silently returns
   nothing, which produced a wrong "the sparkle button doesn't exist" conclusion.
5. `/api/slots/:id/land` is teardown only and refuses unmerged branches; the **gate** is
   `POST /api/slots/:id/merge`.

## 8. A fresh session's first five minutes

1. Run §1. If `codeBehind: true` — deploy first; nothing measured before that means anything.
2. Read `adversarial-2026-07-25.md` §E first, then §A dispositions. It is the current map.
3. `git worktree list` + `git status` before touching `docs/` (two-producers rule).
4. Check whether any deliberate disposition exists yet (§2) — that single number decides whether
   the programme is advancing or only accumulating.
