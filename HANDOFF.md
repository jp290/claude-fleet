# HANDOFF — 2026-07-25 (session 6: the adversarial day — nine lands, seven sweeps, one reframe)

*A thin map, NOT the knowledge. Every line is a claim to verify. **This file quotes no counter
it cannot justify**: the previous handoff was wrong by 6 ledger rows within a day of being
written (`adversarial-2026-07-25.md` §C finding 10), so state below is a COMMAND, not a number.*

**Next session: read `briefs/session-7-pain-hunt.md` first — it is the entry brief and it names
what is already settled, so you do not re-derive a day of work.**

## 1. Recompute state before believing anything

```sh
cd ~/claude-fleet && git log --oneline -3
python3 -c "
import json
rows=[json.loads(l) for l in open('lane-outcomes.jsonl')]; rows.sort(key=lambda r: r.get('ts') or 0)
a=[i for i,r in enumerate(rows) if r.get('branch')=='f9-verify-deps']; s=a[0]+1 if a else 0
k1=cl=unk=un=k2=0
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
print('rows %d | K1 %d/20 | clean %d/10 | unknown %d | undos %d | K2 %d/25'%(len(rows),k1,cl,unk,un,k2))"
curl -s -H "Authorization: Bearer $(python3 -c "import json;print(json.load(open('fleet.json'))['stewardToken'])")" \
  http://100.64.0.1:8790/api/steward/sessions | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['deployGap'], d.get('bundleStale'))"
```

At 17:5x this read `rows 23 | K1 16/20 | clean 15/10 | unknown 0 | undos 0 | K2 3/25`, srv on
`cf6db66`. **Recompute; do not quote.** `deployGap` is NESTED; `codeBehind:false` with
`behindCount>0` = docs-only drift, no deploy needed. After any client land: `bun run build`, then
confirm `bundleStale:false`.

## 2. The reframe — read this before choosing what to build

**The stated bottleneck ("data velocity") was wrong.** Data velocity is fine. The binding
constraint is **owner adjudication, measured at zero**: `dispositions.jsonl` holds exactly ONE
record and it was written *automatically* by the compose box (`src/client.ts`, grep
`pendingEnhance`), so deliberate owner judgements ever = **0**. Three of four graduation criteria
terminate in such a label — at that rate they are not slow, they are **unreachable**.
Full argument: `adversarial-2026-07-25.md` §E1. What each label MEANS is now pre-registered in
`docs/label-taxonomy.md`, written before the first one exists — the rule is **label the decision,
not the diff**: *should this change have reached main unattended?*

**What is still missing for autonomy** is answered in `docs/autonomy-plan.md` Part 6, in one
sentence: *Fleet can already do the work unattended; what it cannot do is find out whether the
work was good.* The critical path is steps 1–5 there. Metering/budget is **deferred by owner
ruling** — off the path, do not re-derive it.

## 3. What landed today (all deployed; srv restarted and health-checked each time)

| commit | what |
|---|---|
| `b12052a` | ② shadow persists `rawAnswer` on `raw:true` rows — first steward-adjudicated land |
| `96fe66c` | baselineRate flake killed (monotone `seen`/`seenHelped` counters) |
| `0531817` | `fleet-e2e.ts` split into 23 `e2e/*` modules (702 names preserved, verified by name-diff) + pane-capture flake fixed via `paneEnv()` |
| `e7559db` | **real server bug**: `openSlot` drops a recycled slot's stale `gitInfo` — no more phantom `done-looking` / phantom auto-③ review |
| `8502c72` | `architecture-review.md` — 12 ranked findings |
| `c48c344` `e0e69ef` | **tri-state verify**: a gate that skipped itself can no longer read as a pass (`exit 42` + legacy marker; `unconfigured ≠ skipped`) |
| `0288760` | `lane-cost-study.md` — the study that **refuted** `lane-context.md` §4.1 with numbers |
| `7e385e4` `dddeb3a` | **② parser fix**: a prose-wrapped verdict is rescued instead of discarded. K2 was structurally dead; it has moved twice since |
| `aa20216` `cf6db66` | `kProgress` honesty: unknown `confirmedByHuman` is its own count, K2 no longer anchor-gated |

Docs: `adversarial-2026-07-25.md` (**the index — start there**), `autonomy-plan.md`,
`gate-coverage.md`, `ungoverned-artifacts.md`, `trust-perimeter.md`, `compiler-program.md`,
`lane-context.md` (+ its refutation), `label-taxonomy.md`, `lane-cost-study.md`. All indexed in
`docs/README.md`.

## 4. In flight

**Lane `post-land-audit` (slot 3)** — tier 2 of the gate: after a land, run the full suite off
the land path, coalesce bursts, record joinably, surface red. Proven not to block (land returned
before its own 6 s audit finished) and not to gate (it never undoes). **4 commits, clean, NOT
landed.** Two open items:
1. One `e2e-isolated` check failed under load (`outcome: … records review.state "inflight"`) and
   the lane **correctly declined** to claim fails-identically-at-HEAD. The owner's instruction to
   reproduce it under load against HEAD was submitted at 17:5x and is running. Land only once
   that proof exists — or attribute the fail to the lane.
2. It ships **default-OFF with the enabling line commented out in `watchdog.sh`**, so tier 2
   exists and runs nowhere until the owner uncomments `FLEET_POSTLAND_AUDIT_CMD` and runs
   `launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog`. Nothing reads the trail yet.

It also has a **`CLAUDE.md` line to pull in by hand** (gitignored ⇒ dies with the worktree): the
Verify line gains a fourth suite `./e2e-postland-audit.sh`, the only one that boots the server
with `FLEET_POSTLAND_AUDIT_CMD` and proves the record/coalesce/unknown contract (port band 15000+).

`⚙ steward` idle; its `CLAUDE.md` is a spawn-time snapshot from 07-24 and is stale.

## 5. Owner decision queue (nothing was done unilaterally)

1. **Label some rows** — §2, `label-taxonomy.md`. Highest leverage available; also the first
   production test of the land-class write path, which has never executed.
2. **Enable tier 2** once `post-land-audit` lands (uncomment + kickstart), or decide not to.
3. **Publishing.** The remote is **PUBLIC** and unpushed since 2026-07-13: **298 commits / 109
   files**. Tokens are clean (verified against live values and history), but pushing would newly
   publish the Tailscale IP (7 files) and `example.com` (6, incl. `watchdog.sh`'s real
   share hosts and `public/landing.html`). **Nothing is public yet, so a forward scrub is fully
   effective; after a push it needs a history rewrite.** The untracked layer (rulebook, owner
   model, 4 trails) has no backup at all — a private mirror is the recommended shape.
4. **Extra usage**: `hasExtraUsageEnabled` is true; disabling it at claude.ai → Settings →
   Billing makes an autonomous fleet hit a wall instead of metered billing. Fleet itself makes
   **no API calls** — every model call spawns the CLI on the Max subscription.
5. Older: 3 leaked `bun server.ts` (Jul 18/21/23), ~235 stale `/private/tmp/tmux-501` sockets,
   orphaned `fleet-flake-waitmerge` worktree.

## 6. Build queue, in the order the evidence supports

1. **Defect-escape attribution** — attribute a red post-land audit back to the land that caused
   it. *The* step that changes the system's category. Needs `post-land-audit` landed + enabled.
2. **Dispatcher briefing, P-9** — `tickDispatch` sends raw queue text while the template and
   enhancer sit off-path. Autonomous work needs autonomous briefing.
3. **Attention routing** — unlabeled rows, oldest pending proposal, proposals pointing at dead
   lanes; nothing ages or reaps today (2 of 3 steward proposals are stale and name dead lanes).
4. **Doc-claims check in `e2e-claude-gate.sh`** — docs may name env/route/constants only by
   symbol. The executable answer to a rot class prose has failed to stop four times.
5. Then: `runWorker` extraction (`architecture-review.md`), ③ fire-drill with defects **not**
   authored by a Claude (axiom A10), steward pulse phase A.

## 7. Traps this session paid for

1. **Keep the main checkout clean and quiet while any lane is in flight.** Both halves bit:
   committing to main *during* a land fails its fast-forward ("Diverging branches"), and leaving
   work *uncommitted* blocks it ("local changes would be overwritten"). Both failed CLOSED —
   lane kept, main untouched — and both cost a full verify cycle.
2. **A lane cannot update `CLAUDE.md`** (gitignored + copied at spawn ⇒ invisible to `git status`,
   dies with the worktree). Lanes must report rulebook changes as TEXT; pull them in by hand.
3. **Verify a subagent's claim before repeating it.** Two of four sweeps needed correction, and
   two of the author's own headline claims were wrong: "the rollback is untested" (it has 10
   checks) and `/api/self/context` (refuted by measurement).
4. **`grep` on `src/client.ts` needs `LC_ALL=C grep -a`** — plain grep silently returns nothing.
5. `/api/slots/:id/land` is teardown only; the **gate** is `POST /api/slots/:id/merge`.
6. **Counting failures teaches nothing until one failing artifact is kept** — persisting ②'s raw
   answer is what overturned the diagnosis drawn from counting its failures.

## 8. A fresh session's first five minutes

1. `briefs/session-7-pain-hunt.md`, then §1 here. Deploy first if `codeBehind: true`.
2. `adversarial-2026-07-25.md` §E, then `autonomy-plan.md` Part 6. That is the current map.
3. `git worktree list` + `git status` before touching `docs/` (two-producers rule).
4. Check whether any **deliberate** disposition exists yet — that single number says whether the
   programme is advancing or only accumulating.
