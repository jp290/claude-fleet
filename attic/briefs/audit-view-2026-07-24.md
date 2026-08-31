# Brief — the audit view: make Fleet's own actions visible (Backlog #9)

*A dossier for a fresh session, NOT a spec. Treat every claim here as a claim to verify (CLAUDE.md):
run the re-ground block in §1 before trusting a single number or path — they were true at
2026-07-24 but the tree moves. The idea is deliberately handed to you as **evidence + constraints,
approach left open** — §6 is yours to derive, not a design to implement blindly. The canonical
knowledge is the code and `BACKLOG.md`; this file is a map into them.*

## 0. The one-sentence goal

Fleet's server already records everything it does to a durable, owner-only audit trail and already
serves it over an API — but there is **no view**, so the owner cannot see it. Build the view.
"Done" is: the owner can open a screen and answer *"what happened to slot N?"* — the exact question
that has gone unanswered across multiple handoffs.

## 1. Re-ground first (run these; do not trust §3 until they pass)

```sh
# the route exists, owner-token-gated, last-N newest-first, no filter
grep -n "'/api/audit'" server.ts                     # expect a GET around line 3586
sed -n '3586,3599p' server.ts                        # the whole contract: {events:[{ts,event,slot?,detail?}], total}

# the data is rich and already captured — 20+ typed event kinds
grep -oE 'audit\("[a-z_]+"' server.ts | sort -u      # slot_kill / slot_shelve / self_heal_recreate / owner_auth_fail / auto_* / steward_* / share_* …

# there is NO client view — this is the entire gap
grep -c "audit" src/client.ts                        # expect 0

# the route works LIVE and returns real events (owner token field is `token` in fleet.json)
OT=$(python3 -c "import json;print(json.load(open('fleet.json'))['token'])")
curl -s -H "Authorization: Bearer $OT" "http://100.64.0.1:8790/api/audit?limit=8" | python3 -m json.tool | head -40
# at writing: total 249, visible among them `slot_kill slot 3`, `owner_auth_fail`, `auto_fire`, `steward_journal`

# the "sessions vanished" mystery and item #9's home
sed -n '315,340p' BACKLOG.md                          # the incident had "no data trail"; self_heal_recreate is named "the actual hook for the mystery"
grep -n "audit log\|vanished\|self_heal" BACKLOG.md
```

## 2. Why this, why now (so you re-derive the idea, not just execute it)

The thread this idea closes runs through the whole recent program: **Fleet's real internal state is
invisible.** The measurement tick swallows its own exceptions (a dead measurement layer looks
identical to a healthy one — `BACKLOG.md` register fact 2); whether the live server predates `main`
is unknowable (the deploy-gap, P-4); the A2 baseline silently resets on every restart; and — the
sharp one — **sessions have "vanished" with no way to see what happened to them.** `BACKLOG.md`
records that the incident "has no data trail" and names `self_heal_recreate` as *the actual hook for
the mystery*.

Here is the leverage: that hook, and ~20 other lifecycle events, are **already being logged** via
`audit()` and **already served** at `GET /api/audit`. The trail the mystery needed now exists — it
is just not rendered anywhere. So this is not "build a logging system"; it is a **view over data the
server already produces and already exposes.** That is why it is overdue: the expensive half was
built long ago and left headless.

It is also the *right* kind of work per the codebase's own doctrine. `steward-intelligence.md §7`:
the reliability machinery is subordinate; the value is **reclaimed attention** — a scheduled digest,
a health-check, an answer that used to cost an investigation now costs a glance. An audit view is
attention-reclamation in its purest form: it converts a recurring "what on earth happened?"
investigation into a look.

## 3. Verified evidence (each line has its re-verify in §1)

- **`GET /api/audit?limit=N`** — owner-token-gated (same access model as `/api/prompts`;
  structurally 404s on SHARE_HOSTS before the handler). `limit` default 300, max 1000. Returns
  `{ events: [{ ts, event, slot?, detail? }], total }`, **newest-first, no filtering, no
  pagination, no `since`.** (`server.ts:3586`)
- **`audit()` captures 20+ typed events** including the lifecycle set that answers session
  questions: `slot_open`, `slot_kill`, `slot_shelve`, `self_heal_recreate`; the automation set:
  `auto_fire`, `auto_skip`, `autos_quiet`, `autos_switch`; the steward set: `steward_send`,
  `steward_task`, `steward_journal`, `steward_propose_outcome`, `steward_send_capped`; the security
  set: `owner_auth_fail`, `share_auth_ok`, `share_create`, `share_revoke`, `share_mode_change`,
  `guest_ws_connect/disconnect`; and `land_note_fail`, `repo_undo_land`. (grep in §1)
- **No client code touches audit** — `grep -c audit src/client.ts` = 0. The gap is entirely
  front-end.
- **`/api/prompts` is your template** — it is the same owner-only read model, and it is already
  rendered into the session-brief overlay (the `boardBtn` / `outline` machinery around
  `src/client.ts:601, 1080–1106, 1578`). Match its access + render idiom; do not invent a new one.
- **The append trail is bounded** — `appendEvent` rotates `AUDIT_FILE` at 5 MB (single `.1`
  generation, `server.ts:352`), and the route reads only the current file. So a very old event may
  have rotated out; the view shows recent history, which is what the use-case needs.

## 4. Constraints any good answer must satisfy

- **Owner-only, read-only, forever.** This trail includes `owner_auth_fail` and share-token events —
  it is security-sensitive. It must never reach a share/guest host (the route already guards this;
  do not add a code path that bypasses it) and must never be writable from the client.
- **Prefer client-side filtering over a server change.** The route returns up to 1000 recent events;
  filtering by slot / event-kind / time to answer "what happened to slot N?" can be done in the
  client with **zero server change and zero deploy risk.** Only extend the route (e.g. a `slot=` or
  `since=` param) if you can show client-side filtering genuinely fails the use-case — and if you
  do, it is a server change: e2e-gate it and it needs an owner deploy (see §7). Anti-abstraction is
  a standing bar (CLAUDE.md): a framework where a filter-in-the-client suffices is itself the bug.
- **Attention reclamation, not a JSON dump.** The bar is that the vanished-session question is
  *answerable at a glance*: events readable (human time, not epoch ms; slot badge; the `detail`
  decoded where it is an id or a code), correlatable to a slot, scannable. A raw reverse-chron list
  of 300 lines is not done — that is the thing the owner already can't use. Decide what makes it
  *findable* (per-slot filter? group by slot? highlight the lifecycle events?) — that is the design
  work in §6.
- **Match the existing UI.** Reuse the `el()` helper, the `panel`/overlay pattern, the existing CSS
  vocabulary and the token/auth plumbing `/api/prompts` uses. A view that looks bolted-on fails the
  "besonders vernünftig" bar.
- **Touch nothing in the measurement layer.** `tickGit`, `measureOutcomes`, the outcome tally, the
  steward routes — all out of scope. This is a read-only lens; if you find yourself editing server
  state logic, stop.
- **Client bundle is a build artifact.** `public/*.js` is gitignored and generated; run
  `bun run build` before any deploy. Deploy of client/server is **owner-only** (`OWNER.md §4b`) —
  you build and verify, the owner restarts srv.

## 5. Done-criterion + verification (state it before you start; run it before you claim done)

**Done =** from the dashboard, the owner opens an audit view, sees the recent trail rendered legibly
newest-first, can narrow it to a single slot, and can thereby answer *"what happened to slot N — was
it killed, shelved, self-healed, and when?"* Killing a slot and reopening the view shows the fresh
`slot_kill`. If the route was extended, its new behavior is covered by a check in `fleet-e2e.ts`.

**Verify (safe inside a lane — the isolated suites refuse the live socket):**

```sh
bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun \
  src/client.ts src/share.ts server.ts fleet-e2e.ts
bun run build
./e2e-isolated.sh          # judge by the tail: "ALL PASS", ≤1 known pane-capture flake
./e2e-claude-gate.sh
```

A **pure client view needs no e2e** (there is no server behavior change to gate) — say so explicitly
rather than inventing a tautological test. The moment you touch the server, an e2e check becomes
mandatory. Manual proof of the view itself: load it, kill a slot, confirm the event appears and the
per-slot narrowing works.

## 6. Approach — LEFT OPEN (this is yours to derive)

Do not treat the following as a plan; treat it as the decision surface. Derive the answers, then act:

1. **Where the view lives** — its own screen/tab, a panel in the existing brief overlay, or a
   per-slot section? The `boardBtn` session-brief already aggregates per-slot facts; an audit filter
   might belong *there* (per-slot lifecycle) rather than as a separate global log — or both. Decide
   from the use-case (answering "what happened to slot N"), not from what is easiest to bolt on.
2. **Filtering strategy** — client-side over the existing route is the default (§4). What are the
   filter axes that actually serve the question: slot, event-kind, a lifecycle-only toggle?
3. **Rendering the `detail` field** — it is a bare string today (an id, a code like `d:0 c:false`, or
   null). What makes each event kind legible? A small per-kind formatter, or a generic decode?
4. **Only if client-side filtering demonstrably fails:** a minimal `?slot=` on the route. Justify it
   against anti-abstraction before writing it, and e2e-gate it.

State your chosen shape in one sentence with its reason before you build (CLAUDE.md: state what
"done" looks like first).

## 7. Convergence, scope boundaries, and where the reasoning lives

- **This work feeds the steward probe.** The steward is currently input-starved — it files no
  proposals because there is no live Fleet lane to observe (verified 2026-07-24: recent pulses all
  `surfaced:0`). If you run this build **as a Fleet lane**, that lane becomes the first real
  done-looking work the steward sees — so the audit view and the P-3 probe advance on one track.
  (Running it as a plain main-checkout session works too; the brief is agnostic.)
- **Lane discipline rides along** (it is in the CLAUDE.md copied into every worktree): keep the lane
  landable, no untracked files, report only your slice + the quoted verification tail, reconcile
  doc/line-ref drift in the same lane.
- **The reasoning behind the idea** lives in this file's §2 and in `BACKLOG.md` (#9, and the
  register's invisibility thread — facts 1/2, P-4). If you improve on the idea, update `BACKLOG.md`
  #9 in the same lane so the knowledge shelf does not rot.
