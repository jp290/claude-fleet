# HANDOFF — 2026-07-26 (session 7: ten lands, and the first time Fleet briefed itself)

*A thin map, NOT the knowledge. Every line is a claim to verify. **State is given as a COMMAND, not
a number** — the session-6 handoff was wrong by 6 ledger rows within a day of being written, and
this one will rot the same way.*

**The single most important thing before you touch anything: the dispatcher is ON.** Fleet is
selecting, spawning and briefing its own lanes right now. It cannot land (§4). Your first act is §1.

## 1. Recompute state before believing anything

```sh
cd ~/claude-fleet && git log --oneline -5 && git worktree list
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
print('rows %d | K1 %d/20 | clean %d/10 | unknown %d | undos %d | K2 %d/25 | shadow-raw %d'%(len(rows),k1,cl,unk,un,k2,raw))"
TOK=$(python3 -c "import json;print(json.load(open('fleet.json'))['token'])")
curl -s -H "Authorization: Bearer $TOK" http://100.64.0.1:8790/api/sessions \
  | python3 -c "import json,sys; d=json.load(sys.stdin)
print('dispatch', d['dispatch'])
print('queued', len([t for t in d['tasks'] if t['status']=='queued']), '| sent', len([t for t in d['tasks'] if t['status']=='sent']))
[print(' lane', s['id'], s['worktree']['branch'], 'ahead', (s.get('git') or {}).get('ahead'), 'dirty', (s.get('git') or {}).get('dirty')) for s in d['slots'] if s.get('worktree')]"
curl -s -H "Authorization: Bearer $TOK" http://100.64.0.1:8790/api/post-land-audits \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('tier-2 audits', d['total'], 'configured', d['configured'])
[print(' ', a['result'], round(a['ms']/60000,1),'min', a['mainSha'][:8], [c['branch'][-9:] for c in a['covers']]) for a in d['audits'][:5]]"
```

The server binds **only** the Tailscale IP (`FLEET_HOST` in `watchdog.sh`) — `127.0.0.1:8790` never
answers and looks like a dead server. `deployGap` on `/api/steward/sessions` (steward token) is
NESTED; `codeBehind:false` with `behindCount>0` = docs-only drift, no deploy. After any client land:
`bun run build`, then confirm `bundleStale:false`.

## 2. The work IS the queue — do not rebuild the list

Everything still open from this session is filed as a Fleet **task**, dispatch-ready (scope, why,
verification, explicit out-of-scope). There is no second backlog to reconcile, and the dispatcher is
already working through them two at a time. Read the live list with §1.

Roughly, in dispatch order — **already stale, verify it**: e2e teardown hygiene · two steward-briefs
(standing-mission line, continuity fact) · MCP connectors still reachable by the merge-path agents ·
`done-looking`'s two permissive clauses · verify timeout must be a non-measurement · shelf
reconciliation after ten lands · **SEC-4** (read-only tools for the ② reviewer — the last open P0) ·
the measured gate proposal · the ② judge's contract failures · `undo-land` covers only one land ·
the `openSlot`-on-active-slot bug.

**Ordering caveat, code-verified:** `tickDispatch` takes `tasks.find(t => t.status === "queued")` —
strict creation order, no priority, no reorder API. SEC-4 was filed late and therefore sits *behind*
several P1s. Want it first? Spawn it as a hand-briefed lane instead of waiting.

**The queue is not a pure work list.** Steward *notifications* ("lane X is done-looking") land in it
too, and the dispatcher spawns each as a brief. Three stale ones — for lanes long since landed — had
to be closed before the trial could start. Look for that shape before enabling anything.

**To spawn a lane by hand:** `POST /api/lanes {"repo":"~/claude-fleet"}` → returns a
slot; wait ~14 s for claude to boot; `POST /send {"slot":N,"text":"<brief>"}`. To land: `POST
/api/slots/N/merge` then poll the same path (a clean+verified merge auto-lands and frees the slot);
`/land` alone is only the teardown and 409s while commits are unmerged.

## 3. Settled — do not re-derive

- **The auto-land classification is sound.** `pre.clean` comes from `tryScriptRebase`: a plain
  `git rebase` with `rerere.enabled=false`, so exit 0 cannot be faked by a recorded resolution. The
  agent runs only on the *conflict* branch, and that branch always stops for a human. A false
  "clean" is structurally unreachable.
- **Landing never touches the live service.** Nothing in `server.ts` restarts `srv`
  (`grep -n "kill-session" server.ts | grep srv` → empty). Deploy stays a hand action. This is what
  makes autonomy trials cheap.
- **`--allowedTools` is ADDITIVE to `~/.claude/settings.json`.** Anchored patterns alone are inert;
  only `--setting-sources ""` makes them bind — proven with a canary, not argued. `--tools ""` is
  stronger for agents needing nothing (a capability cut settings cannot widen). And **a model
  refusing is not enforcement**: only a verbatim harness denial counts as evidence.
- **`./e2e-isolated.sh` is not deterministic under load** — one run failed 3/759 on a tree with zero
  code changes. Measured. That is why the full suite must never be a hard pre-land gate — and it is
  *not* a free pass: a fail is yours until proven fails-identically-at-HEAD.
- **`src/client.ts` holds a raw NUL byte** (offset 141046): `grep` silently returns nothing for every
  pattern, exit 1. Use `grep -a`. Fix queued; until it lands, every grep of that file lies.

## 4. Where autonomy actually stops

```sh
grep -n "setInterval(" server.ts   # poll, tickAutos, tickGit, tickDispatch, tickHarvest, tickAutoReview
grep -n "mergeJob(" server.ts      # defined, called from ONE route — no tick
```

Fleet reaches *select → brief → run → auto-③ review* on its own, then stops for a human ⏫. The
auto-land is real but lives **inside** a human-started merge. Two consequences:

- The run **self-throttles**: `tickDispatch` counts finished-but-not-torn-down lanes against
  `MAX_LANES` (2), so it stalls at two unreviewed lanes and cannot run away unwatched.
- **The measurement gating the next step is starved by the human step that step would remove.** ②
  shadow verdicts are written only on clean auto-lands, which happen only after a click. Producing
  lands is therefore not throughput — it *is* the experiment. Do not skip the measurement to pass it.

An auto-merge tick is the one remaining boundary. It needs the ② tally as input, and that tally is
currently broken (queued). Do not wire it on a hunch.

## 5. Owner decisions, not a session's

1. **Quiet hours are `null`** — cleared to start the trial. Restore with
   `POST /api/autos/quiet {"start":23,"end":8}`.
2. **A 2-day-old orphan test server** outside the repo: `tmux -L fleettest23870 kill-server`. No lane
   and no session should touch `/private/tmp` unasked; the cause is queued as a fix.
3. **Stop the trial any time**: `POST /api/dispatch {"on":false}` — one reversible call, no deploy.
4. `docs/autonomy-trial-1.md` is the **pre-registered** protocol. Q1 (does dispatch deliver) and Q3
   (does an unattended land survive the full suite) are answered *yes*, with data. Q2 and Q4 need
   rows. Amend only with a rationale written **before** looking at new data.

## 6. Shipped this session

Ten lands: consolidated security register · **verification tier 2** (full suite after every land,
off the land path, gates nothing, default-off flag now on — first row green, 5.6 min) ·
outcome-ledger audit · **SEC-2** (agent read scope anchored; five throwaway agents given a tool
floor) · the trial switch + protocol · verify-tiering measurements · state-vs-reality divergence
register · shelf index · **SEC-3** (DATA-delimited summary/review prompts) · the steward pulse
primitive. **The last two were briefed by the dispatcher, not by a human** — that is the headline,
not the count. Owner and steward tokens were rotated at the start; the old ones are dead.

`CLAUDE.md` was updated in the main checkout (a lane cannot — it is gitignored, see
`ungoverned-artifacts.md`): the false "no known flakes" line, current shadow numbers, the additive
`--allowedTools` fact, the NUL byte, and the new tier-2 / dispatcher state.

## 7. Corrections carried forward — including of this session's own claims

The lanes refuted the orchestrator three times, and each correction is load-bearing:

- The security review's own P0 prescription (bare `Read` → `Read(**)`) **would have fixed nothing**.
- `merge-prompt.ts` is *not* missing from the gate's tsc — covered transitively via `server.ts:6`,
  proven by mutation. An earlier claim this session said otherwise.
- `lane-signals.ts` is **not** uniformly negation-tested: `gitOp` and `merge` read *permissive* on
  unknown, and `lastOutput: 0` launders an unknown into an extreme known value before the null tests
  fire. The file's own header comment claims the opposite — the comment was believed over the code.
  Treat that header as wrong until the queued fix lands.
- The e5dd "resolved / not the JSON contract" verdict fails **safe**: it stops, and git verified the
  rebase independently. Only the detail *string* misled. Do not cite it as a wrong decision.

Prior handoffs' ② shadow numbers are stale in both directions — recompute with §1.
