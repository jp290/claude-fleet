# Claude Fleet — Feature Backlog

Collected 2026-07-17 from a few days of real usage. Each item analyzed against the
actual code. Execution order at the bottom.

**Status 2026-07-18:** items 1, 2, 3, 5 shipped and live (commits 80049b9, 7f4ff61,
7b26ed4, 3a38f8f; plus isolated e2e infra 8135c00 — `./e2e-isolated.sh`, 54 checks).
Defaults chosen: 16 slots, history = composed sends only (server-persisted, cap 100,
dies with the session), export = plain-text light-theme print page + `?format=txt`.
Remaining: item 4 (UI density pass — needs user feedback per iteration), item 6
(transcript view — Phase 1 investigation next), item 7 (blocked on definition).

**2026-07-18, later:** session sharing shipped (see SHARING.md) — per-slot
password-gated guest access via https://cowork.example.com, view/interact
modes, live through the Cloudflare tunnel, revoke kicks guests instantly. Landing
page on the share-domain root (subagent-built, reviewed).

**2026-07-18, item 6 shipped (MVP):** conversation view (`aa7be82`) — Phase 1
findings: JSONL has user/text/tool_use/tool_result (thinking usually empty/redacted;
permission prompts are UI-only → hybrid stays). Slots pin `claude --session-id` at
pane creation for a deterministic transcript path; adopted sessions fall back to
newest-by-mtime (can mispick when two claudes share a cwd — pinning fixes new panes).
💬 toggle per pane, 1s incremental polling, reflows at any width.
MVP gaps / follow-ups: no markdown beyond ``` fences, transcript endpoint rereads
the whole file per poll (fine <10MB), guests don't get the conversation view yet,
view choice not persisted per pane.

**2026-07-18, share management + stale-bundle self-heal shipped** (`d05620a`):
share dialog gets live guest count, shared-since, in-place mode switch
(`share-mode` route, guests kicked to reload on flip), link/password rotation,
confirms on revoke/rotate/interactive. `/api/sessions` reports a bundle version
(`app.js` mtime); a tab open across a deploy self-reloads once backgrounded —
closes the "missing buttons = regression" false alarm from a stale tab.

**2026-07-18, hardening pass shipped** (acted on unprompted, per the review
sweep below): fixed the share-survives-reopen bug (#2), added `HttpOnly` to
the owner cookie — and, found while doing that, moved the token-paste gate
off `document.cookie` entirely since client-side JS can never set `HttpOnly`
and would have silently undone the fix for anyone using that flow (`src/client.ts`,
now routes through the server's own `/?token=` login endpoint), fixed the
`Pane.dispose()` orphaned-poll-loop leak, added a throttled (not lockout —
locking the sole owner credential would let a remote guesser DoS the real
owner) `tokenGate()` wrapper on both token-check call sites, and fixed the
watchdog's unescaped PATH interpolation. Added regression coverage for all of
it plus three more gaps the review flagged: adversarial export-escaping (the
old check never contained a real metacharacter), share-host allowlist against
path tricks, and the 4002 mode-flip verified over an actually-connected guest
WebSocket, not just HTTP — main suite now 112 checks. Built a fully separate
isolated harness (`e2e-claude-gate.sh` + `fleet-e2e-claude-gate.ts`) that
compiles a real stand-in binary literally named `claude` to exercise the
claude-alive gate's actual process-tree detection — previously 100% untested,
because the main suite's `FLEET_CMD=true` short-circuits that logic entirely
(a shebang script won't do: `ps -o comm=` reports the interpreter, not the
script name — verified empirically before building it). All of it deployed
to the live instance and spot-verified there (HttpOnly cookie on `/?token=`,
share list empty after the slot-11 revoke). Remaining hardening items (#6, #8
info-disclosure and structural e2e weaknesses) intentionally left for later —
see the Hardening section below, now annotated with what's fixed vs. still open.

**2026-07-18, still later — 8-agent design + review sweep.** Five feature
proposals (archive, audit log, worktree spawn, misfire guard, file drop) each
sent to a fresh read-only analyst against the real code; in parallel, three
adversarial passes: security review of `server.ts` (incl. everything new since
the HANDOFF), a correctness review of the client (races, the new stale-bundle
reload, the share-dialog live-update), and a coverage audit of `fleet-e2e.ts`
against the actual route/gate surface. Full results: items 8-12 below and the
**Hardening** section. One live finding was acted on immediately, not queued:
slot 11 (cwd = the fleet repo itself, containing `fleet.json` with the
plaintext owner token) was actively shared in interactive mode — any guest
could `cat fleet.json` and escalate to full owner control. Revoked and
verified during the same session (`POST /api/slots/11/unshare` → `shares: []`).
Slots 6 and 11 both still point at the fleet repo itself as their cwd — avoid
pointing any slot there going forward (see Hardening #1).

**2026-07-18, later still:** user feedback reframed the conversation view: its
purpose is *reliably seeing your own messages*. Restyled accordingly (`516ea28`):
user messages as timestamped accent anchors, all agent activity between two
messages collapsed into one "⚙ n steps" line (tool_use/result now paired inside),
↑/↓ prompt-to-prompt jump buttons. WebGL renderer shipped (`9a634f2`); in-terminal
sent-prompt markers built, tested against a real claude TUI, found to drift
(full repaints + resize jiggle), dropped. Density pass shipped (`0be9e1e`):
sidebar 250→228, compose bar 59→51, mobile paddings trimmed, touch targets kept.
Item 4 (UI density) now DONE as a first iteration — further tightening wants the
user's eyes on real devices.

**2026-07-21 — conversation-view + commit/land UI polish (this lane, unmerged):**
task-notifications no longer render as fake "you" bubbles in the conversation view
— the server tags those harness-injected user turns `meta`, the owner view folds
consecutive ones into a collapsed "🔔 n task notification(s)" accordion (same idiom
as the "⚙ n steps" toolgroup), guests skip them (`035a1b9`). Commit/land controls
simplified (`0ac70b0`): one primary `commit` + a subordinate `✎ message` (was two
co-equal amber buttons that read as two ways to commit), the redundant main-session
`± diff` button dropped (the uncommitted file rows are already click-to-diff), and
the review-state double-`⏏ land` untangled (the top button becomes `↻ re-run merge`,
its actual distinct job; its generic diff hidden there so the review state has one
diff + one land). Two server-side gaps found while auditing that UI, deferred — see
Hardening #10 and #11.

---

## 1. Esc key on desktop  `quick win`

**Pain:** Working from iPad + hardware keyboard (no physical Esc on Magic Keyboard).
The iPad renders the *desktop* layout, but the key row with esc/tab/arrows is
mobile-only: hidden by default (`index.html:29`), shown only inside the mobile media
query (`index.html:192`).

**Current behavior:** No way to send Esc on desktop except clicking into the terminal
and pressing a key that doesn't exist on the iPad keyboard.

**Proposal:** Show the existing `#keys` row on desktop too (it already sends raw bytes
via `sendRaw`, `client.ts:391-397` — zero new logic), styled compactly so it doesn't
eat vertical space; possibly collapsible. Alternative minimal version: single `esc`
button next to the send button.

**Effort:** ~30 min. **Dependencies:** none.

---

## 2. Prompt history: copy previous prompts + mark self-sent messages  `quick win`

Merges two requests — "copy from the input field / previous prompts" and "mark my own
messages consistently" — because they have the same root cause and one fix.

**Pain:** The compose box clears on send (`client.ts:683`); a sent prompt is gone.
In the terminal stream, your own messages are whatever Claude Code's TUI paints —
the dashboard can't restyle them.

**Why in-stream marking is a dead end:** the pane is a raw pty byte stream
(`server.ts:195-226`) rendered by xterm's canvas renderer. There is no message
structure to attach styling to, and injecting markers would corrupt the stream.
Verified, not inferred: the whole pipeline is `pipe-pane → sN.raw → WS → term.write`.

**Proposal:** Per-slot sent-prompt history, recorded at the one choke point where
composed sends already pass: `sendText()` (`server.ts:175`) or client-side in
`doSend()` (`client.ts:675`). Server-side is better (survives devices/reloads;
persist in `fleet.json` or a small per-slot file, capped at ~100 entries).
UI: a history button on the compose bar → popover listing prompts newest-first with
timestamp, tap to copy or to re-insert into the box; plus ArrowUp in an *empty*
compose box cycles back (messaging convention). This IS the durable "what did I
send" record — better than fragile in-stream highlighting.

**Effort:** half a day. **Dependencies:** none.
**Open question:** should raw live-typing input count as history, or only composed sends? (Proposed: only composed sends.)

---

## 3. More slots  `small`

**Current limit:** `MAX_SLOTS = 10` (`server.ts:13`). Slot hotkeys are ⌃1–⌃0
(`client.ts:335-337`), which hard-caps *hotkey-reachable* slots at 10. The sidebar
always renders all 10 rows including empty "+ new session" placeholders
(`client.ts:592-630`).

**Proposal:** Two-part change:
1. Raise `MAX_SLOTS` (16? 20?) — server cost is negligible (self-heal loop is two
   cheap tmux queries per healthy slot, `server.ts:363-365`; poll loop skips
   inactive slots, `server.ts:205`).
2. Sidebar stops rendering N empty placeholder rows: show active slots + one
   "+ new session" row that grabs the lowest free slot. This is also a UI-density
   win and a prerequisite for item 4.

Hotkeys stay ⌃1–⌃0 for the first ten; slots 11+ are click/tap-only (acceptable —
they're overflow).

**Effort:** half a day. **Dependencies:** none, but do together with item 4's sidebar pass.
**Open question:** how many concurrent sessions do you realistically want? (Determines whether 16 fixed is fine or slots should be fully dynamic.)

---

## 4. Cleaner, space-efficient UI (desktop + mobile)  `medium, design-driven`

**Pain:** General density/space usage on both form factors.

**What exists:** 250px sidebar with 50px collapsed rail (`index.html:33,63`),
bottom bar with chips + compose (`index.html:101-115`), 1/2/4 pane grid
(`index.html:77-79`). Mobile: drawer + key row + compose (`index.html:157-216`).

**Proposal:** A dedicated design pass, iterated visually with Playwright screenshots
at desktop, iPad, and phone widths — not blind CSS edits. Candidate moves (to be
validated against screenshots, not committed to yet): single "+ new session" row
(item 3), tighter bar padding, auto-hiding chips, a 3-pane layout (1 large + 2
stacked), merging the mobile header actions. "Cleaner" is subjective — this item
needs your eyes in the loop per iteration.

**Effort:** 1–2 sessions. **Dependencies:** after item 3 (sidebar model changes).

---

## 5. Print / PDF export of a session  `medium`

**Pain:** No way to get a session out as a document.

**What exists:** Full history is available two ways: the raw ANSI stream
(`streams/sN.raw`) and `tmux capture-pane -e -p -S -` (already used for seeding,
`server.ts:135`). The scrollback in xterm is capped at 50k lines (`client.ts:109`)
and canvas-rendered — browser print of the live page is useless.

**Proposal:** Server endpoint `GET /api/slots/:id/export` → self-contained HTML page:
capture full history with `-e`, convert ANSI→HTML (small converter, ~100 lines or a
vetted package — check npm first per research-first rule), monospace layout with
`@media print` CSS. User opens it in a tab → browser's native Print/Save-as-PDF does
the rest (works on iPad too). Token-protected like every other endpoint.

**Effort:** half a day to a day. **Dependencies:** none.
**Open question:** colors in the PDF (dark bg is ink-hostile — propose a light print theme) and whether plain-text export (.txt) should ship alongside.

---

## 6. Per-device streams + structural formatting improvement  `structural, investigate first`

Two requests, one root: "a dedicated stream per device so formatting is right on
each device" and "improve formatting in a significant, potentially structural way."

**Why per-device ptys are impossible as asked:** one tmux pane = one pty = one
width. Claude Code's TUI renders *for that width* on SIGWINCH. The code already
documents this honestly at `server.ts:502-504`: concurrent multi-width live
rendering can't come from the shared pty; the current design is last-connect-wins
resize + width-reseed (`server.ts:497-530`), which is why phone↔desktop handoffs
need the reload button.

**The actual structural answer:** stop treating the terminal as the *reading*
surface. Claude Code writes structured JSONL transcripts to
`~/.claude/projects/<cwd-slug>/*.jsonl` (messages, tool calls, results). A
transcript-based conversation view — server tails the JSONL, client renders
messages as responsive HTML (markdown, code blocks, collapsible tool calls) —
reflows natively per device width. No pty width fight exists in that world, self-
sent messages are *inherently* marked (role: user), and export-to-PDF becomes
trivial. The terminal pane remains for interaction (prompts, menus, permission
dialogs) — this is a hybrid view, not a terminal replacement.

**Phase 1 (investigate, 1 session):** verify transcript coverage — does the JSONL
carry everything the TUI shows (thinking, subagents, permission prompts)? How to map
slot→active transcript file reliably? Latency of tailing? Deliverable: a written
go/no-go with a prototype screenshot.
**Phase 2 (build, multiple sessions):** transcript view as a per-pane toggle
(terminal ⇄ conversation), mobile defaults to conversation.

**Effort:** large — the flagship item. **Dependencies:** none technically, but do
quick wins first. If Phase 1 says no-go, fallback improvements: smarter reseed
(auto-reseed on width change without the manual reload), and per-width-class
`window-size` strategies — smaller payoff.

---

## 7. Input automation  `needs definition`

**Request:** "the option to maybe automate inputs."

**What exists already:** `POST /send` with token auth (`server.ts:455-463`) — any
script/cron on the tailnet can already automate prompts today:
`curl -X POST http://<host>:8790/send -H "authorization: Bearer $TOKEN" -H "content-type: application/json" -d '{"slot":1,"text":"..."}'`.

**Possible directions (pick one before building):**
- **a) Saved snippets/macros** — user-editable chips (currently server-env-fixed via
  `FLEET_CHIPS`, `server.ts:31`), editable from the UI, tap to insert.
- **b) Scheduled prompts** — "send X to slot N at/every T" with a small scheduler UI.
- **c) Auto-responder** — react to session output patterns (e.g. auto-continue).
  Powerful but risky (auto-approving things unattended); needs careful scoping.

**Effort:** a) small, b) medium, c) large. **Blocked on:** which of these you meant.

**2026-07-18 SHIPPED as (b) scheduled prompts (`a871941`):** compose text + once-in-N-min
or every-N-min-x-K-runs. Guard rails (all server-side, all e2e-covered): mandatory runs
cap 1-100, min interval, idle gate (60s quiet, 10min grace, then visible skip),
claude-alive gate (process-tree check — never types into a bare shell where text would
EXECUTE), schedules die with slot, restart-persistent, missed runs skipped, auto-sends
recorded in prompt history. Not built: (c) auto-responder — output-pattern matching on a
TUI stream is inherently fragile; revisit only with a concrete use case.

---

## 8. Session archive + revive  `medium`

**Pain:** `killSlot` (`server.ts:238-258`) permanently deletes the stream and
prompt history; the label/cwd/sessionId association is lost even though the
underlying claude transcript survives in `~/.claude/projects/`. `ensureSlot`
already proves `claude --resume <id>` works (`server.ts:189-191`) — nothing
today lets you reach for that on purpose.

**Proposal:** Kill archives instead of deleting: snapshot `{id, label, cwd,
sessionId, history, createdAt (new field — doesn't exist today), killedAt}`
into its own `archive.json` (own write chain, mode 600, same pattern as
`saveHistory` `server.ts:131-138`) — **not** `fleet.json`, which rewrites on
every label/share/auto change (`saveState`, 12+ call sites) and shouldn't grow
with archive size. Raw stream bytes are **not** worth archiving: current
streams run 22MB across 11 slots, there's no consumer after a kill (tmux
history dies with `kill-session`, revive reseeds fresh via `capture-pane`
anyway), and the durable record is the claude transcript + the export endpoint
(use it before killing). A "past sessions" list in the sidebar/picker gets a
revive button → lowest free slot, `--resume`.

**Revive edge cases, each needs explicit handling:**
- Transcript file gone by revive time → `ensureSlot` silently starts a *fresh*
  session with a new UUID if the check at `server.ts:189` fails (no error
  surfaced) — revive must pre-check and 4xx instead of letting that happen quietly.
- cwd deleted since archiving → `openSlot`'s existence check (`server.ts:226`)
  isn't replicated in `ensureSlot`; what `tmux new-session -c <gone-dir>` does
  wasn't verified — validate explicitly before touching slot state.
- Non-claude `FLEET_CMD` → `slotCmd` (`server.ts:36-38`) only resumes when
  `BASE_CMD` starts with `claude`; silently ignores the archived sessionId otherwise.
- `sessionId: null` archives (adopted sessions — 3 of 11 slots today have this)
  can't `--resume` at all; decide list-only vs. fresh-start-in-same-cwd fallback.
- Self-heal race: the 2s loop (`server.ts:663-665`) can win against a slow
  revive and spawn a fresh UUID before the archived fields land — set
  cwd/label/sessionId atomically, no `await` between them.
- Same sessionId revived into two slots simultaneously isn't prevented anywhere today.

**Effort:** M, ~1-2 sessions. **Open questions:** retention cap (count or
age)? default revive target (lowest free slot, like "+ new session")?
`sessionId: null` archives — list-only or fresh-start fallback button?

---

## 9. Audit log  `small–medium`  `logging+endpoint SHIPPED · UI view built 2026-07-24 (pending owner deploy)`

**Status (2026-07-24):** the logging core and read endpoint are live — `audit()`
appends 22 typed event kinds to a mode-600 `AUDIT_FILE` (own write chain, not
`console.log`), and `GET /api/audit?limit=N` serves them owner-only, newest-first
(`server.ts` — the `audit()` def and the `/api/audit` route). The remaining half,
the **UI view**, is now built: a global owner-only audit overlay (🛡 in the sidebar
tools) that fetches the trail once and narrows it client-side by slot + a
lifecycle-only toggle, with humanized timestamps, a slot badge, and category-coloured
kind badges — answers "what happened to slot N — killed / shelved / self-healed, and
when?". Pure client change (`src/client.ts` + `public/index.html`); no server change,
so no new e2e. Deferred / not built: WS guest-identity plumbing (`CF-Connecting-IP` /
`Host`), guard()/404-rejection aggregation, retention beyond the single 5 MB rotation.

**Pain:** No record of who did what, when — not slot open/kill, not guest
auth attempts (success or failure), not share create/revoke/mode-change, not
scheduled-prompt fires. HANDOFF.md's still-open item (unexplained tmux
sessions vanishing, a foreign `dexter` session appearing) has no data trail to
investigate with; the self-heal recreate log (`server.ts:197`, one
untimestamped `console.log` into `server.log`) is the closest thing today.

**Proposal:** Append-only `audit.jsonl`, own write chain + mode 600 (same
`chmodSync` discipline as streams/history/state), **not** routed through
`console.log` (watchdog redirects stdout to `server.log` at the shell's
default umask — `watchdog.sh:17` — so anything security-sensitive needs its
own explicit chmod). One line per event: open/kill, share create/revoke/mode-
change, guest auth success+failure+lockout, guest WS connect/disconnect, auto
create/delete/toggle/fire (+ skip reason), owner-API auth failures (currently
*zero* rate limiting on the owner token — HANDOFF.md's known weakness — this
is the only detector available short of adding a limiter), self-heal
recreates (the actual hook for the "sessions vanished" mystery), guard()
403/host-mismatch rejections (optionally aggregated — could be noisy from
internet scanning on the public hostname).

**Never logged:** guest passwords (including failed attempts — often contain
typos of real ones), share secrets, the owner token, prompt text (already
lives in `sN.history.json` at 600 — log a length/reference, not the content).

**Client identity:** `server.requestIP()` exists (Bun) but resolves to
cloudflared's local address for tunnel traffic, not the guest — mostly
useless for the public path. `CF-Connecting-IP` is standard Cloudflare
behavior but **not verified against a live request** and is spoofable on the
direct Tailscale path (bypasses the tunnel entirely) — log it as an
unverified field, alongside `Host` to distinguish which path a request came in on.

**Effort:** S for logging core + a read endpoint; M with a UI view + WS
identity plumbing + guard-event aggregation. **Open questions:** treat
self-heal recreates as a security event (recommended) or is a tmux-level hook
needed to attribute external `kill-session` calls? Log guard()/404 rejections
or is that just internet-scanner noise? Retention — one rotation generation
enough for now, or daily files with a defined retention window?

---

## 10. Worktree spawn  `✅ SHIPPED 2026-07-19`

**Shipped:** lane spawn (⎇ new lane), branch/dirty/ahead badges, diff view (±),
land (⏏, refuses dirty/unpushed), task queue + idle dispatcher, public /intake.
See `HANDOFF.md` for the full state. **Next (agreed direction, the "tailored work
environment" — reduces the human-review bottleneck):** Phase 1 per-lane model
(`--model` in slotCmd, cost lever); **Phase 1.5 lane runtime env** — bake
`FLEET_LANE_SLOT` + per-slot `PORT` (e.g. 8800+slot) and, for fleet-on-fleet
lanes, safe `FLEET_SOCK`/`FLEET_PORT` overrides into the pane env at spawn
(uzi's $PORT pattern — kills the second-dev-server port/socket collision class;
env ONLY, never auto-start a service). Nontrivial: `openSlot`→`ensureSlot` runs
before `s.worktree` is tagged, and self-heal recreation must re-bake the same
env — tag before ensure, or derive env from the persisted lane field. Interim
protection shipped: CLAUDE.md lane rules (never default-env `bun server.ts`;
`./e2e-isolated.sh` for verify; out-of-repo = stop and report). Phase 2 lane
brief at launch (not a file — a tracked file would block land); Phase 3
verify-gate before a lane surfaces as "ready". Conceptual basis:
`docs/tailored-context.md`. Original proposal below.

**Pain:** Multiple slots on the same repo cwd means multiple claudes editing
the same files. `git worktree add` per slot fixes that — and the transcript
mis-pick problem (item 6's Phase-1 finding, `BACKLOG.md` above) mostly
disappears for free, since `projDir`'s slug (`server.ts:126`) is keyed off the
cwd path and a worktree cwd is automatically distinct.

**Proposal:** A picker footer action "⎇ in fresh worktree", shown when the
browsed path is a repo (`.git` existence check for display; an authoritative
`git rev-parse` server-side at spawn time — the server never trusts the
client for validation, matching `openSlot`'s existing cwd check at
`server.ts:226`). Branch name: generated default (`fleet/s<slot>-<timestamp>`)
in an editable field — avoids a required-freetext dead end on mobile where the
picker already fights the keyboard for space (`client.ts:731-732`).

**Where worktrees live:** sibling directory `<repo>.worktrees/<name>/`, not
`~/.fleet-worktrees/` — it stays browsable in the picker (`listDirs` only
filters dot-dirs, `server.ts:397`), needs no `.gitignore` entry, and the
repo→worktree relationship is legible from the path alone. `git worktree add`
only materializes *tracked* files — `.claude/settings.local.json` (typically
gitignored) and any untracked `.env` will be **missing** in the worktree,
meaning local permission allows don't carry over and Claude re-prompts;
whether `.claude/` is tracked is repo-dependent and wasn't checked against a
real worktree.

**Lifecycle:** kill removes the worktree (`git worktree remove`, no
`--force` — git's own dirty-check is the safety net, no custom parsing
needed) only if the slot is worktree-tagged; a failed/dirty remove must not
block the kill itself, and the worktree should surface again as
re-openable rather than silently vanish. **Real gap found along the way,
worth fixing regardless of this feature:** if a slot's cwd disappears out
from under it (worktree removed by hand, or any directory really),
`ensureSlot`'s `tmux new-session -c <gone-dir>` failure path is silent —
`server.ts:663-665`'s 2s retry loop swallows everything via
`.catch(() => {})` and spins forever with no log, no state change; the slot
stays listed as active in the sidebar. Worktrees turn this from a
once-in-a-blue-moon case into routine.

**Effort:** M, ~1 session. **Open questions:** delete the branch on cleanup
if fully merged, or always leave it? List pre-existing worktrees of a repo in
the picker (not just Fleet-created ones)? Default branch base — current HEAD,
or a configurable target like `main`?

**Addendum (2026-07-18, research pass):** Claude Code has native worktree
support that changes the build/buy calculus — `claude --worktree <name>`
creates `.claude/worktrees/<name>/` on branch `worktree-<name>`, a
`.worktreeinclude` file (gitignore syntax) declares which gitignored files
(.env etc.) get COPIED into every new worktree, and its cleanup inspects for
dirty/unpushed work before removing (docs: code.claude.com/docs/en/worktrees).
Fleet already bakes the slot command via `slotCmd` (`server.ts:35-40`) — the
cheapest correct implementation is to pass `--worktree` there and let claude
own creation, env-copying, and lock-aware cleanup, instead of hand-rolling
`git worktree add/remove`. Hands-on verified: a worktree contains only
tracked files (untracked CLAUDE.md/.env absent — `.worktreeinclude` is the
fix), and `git -C <wt> status --porcelain`/ahead-behind is cheap enough to
poll for UI badges. Cross-tool research (uzi, Conductor, claude-squad,
Crystal†, vibe-kanban†; † = discontinued): the load-bearing patterns are
copy-not-symlink env propagation, per-worktree port injection from a range,
and refuse-to-delete-work cleanup; the consistently-abandoned idea is
"fan out the SAME task to N agents and auto-compare/merge" — real users
report the bottleneck is human review capacity, not agent throughput.
Broadcast-a-prompt to slots doing INDEPENDENT tasks is the thin, useful
subset (a loop over `sendText`, `server.ts:279`).

---

## 11. Misfire guard + per-slot compose drafts  `medium`

**Pain:** At 16 slots, sending to the wrong one is the costliest everyday
mistake, and today the compose box is global — switching panes loses
whatever you were mid-typing.

**Proposal, two parts:**
1. **Per-slot draft buffer** (`Map<slotId, string>`, mirrored to
   `localStorage` — a pure in-memory buffer would lose everything on the new
   stale-bundle self-heal reload, item above). Swap point: inside
   `focusPane()` (`client.ts:477`), keyed on the **slot under the box**, not
   the pane index — `assign()` can change a pane's slot while `focused`
   (the index) stays put, which the existing `changed` check (`client.ts:478`)
   would miss.
2. **Visible target label** in `#inputrow`, next to the textarea, always on —
   today's only hint is the placeholder text (`client.ts:483`), which
   disappears the instant there's any text, and with drafts restored on every
   switch the box will usually be full. A slot-keyed accent color threaded
   through sidebar number + drawer + this label would be the actual misfire
   fix on mobile, where the mistake happens through the drawer with only one
   pane ever visible.

**Three real collision points found reading the compose code, not
hypothetical:**
- `doSend()` clears `ta.value` **after** its `await post(...)` (`client.ts:1249-1251`)
  — if the user switches panes (draft restored) while the request is still in
  flight, the clear lands on the wrong slot's just-restored draft. Must
  target the captured slot, not "clear the box."
- The scheduled-prompts dialog reads `ta.value` **live at click time**
  (`client.ts:1129`), not snapshotted at open — a draft-swap while that dialog
  is open schedules the wrong slot's text into the wrong session.
- History-cycling (`cyc`, `client.ts:1220-1235`) isn't reset on pane switch
  today — a naive swap would save a mid-cycle history entry as the "draft"
  instead of the actual pre-cycle text sitting in `cyc.draft`.

**Confirm heuristic** (only when it'd actually catch something, not
`window.confirm` on every send): target slot ≠ last-sent slot this tab, AND
target slot is "busy" (`serverNow - lastOutput < RECENT_MS`, `client.ts:13-14`
— note this is a different window than the 60s idle-gate scheduled prompts
use, `server.ts:336` — pick one deliberately), AND prompt is long/multiline.
Two-stage send button beats a blocking dialog.

**Effort:** M overall (S–M for drafts, S for the label, S for confirm — the
edge cases above are the actual work). **Open questions:** drafts
per-device only, or server-synced for simultaneous phone+desktop use? Should
a draft survive slot kill/reopen, given the server already wipes history on
reopen (`server.ts:230-232`)?

---

## 12. File / screenshot drop  `medium`

**Pain:** No way to get an image (e.g. a screenshot from a phone) into a
session — Claude Code reads images by file path, but nothing gets a file onto
disk from the dashboard.

**Proposal:** Drop-target per pane (not global — ambiguous in a 2-up/2x2
layout), plus a paste listener (`⌘V` with image data — the custom key handler
already returns non-`metaKey` combos to the browser, `client.ts:219`,
confirming paste isn't already claimed) and a hidden `<input type=file>`
button for mobile where drag-and-drop doesn't exist. Server: a new raw-body
route below the existing owner-token gate (`server.ts:774` — automatically
unreachable from share guests, who are 404'd by the `SHARE_HOSTS` allowlist
before reaching it) writes into `<slot-cwd>/.fleet-drop/`, dir chmod 700, file
chmod 600 — same discipline as streams/history/state. Server-generated
filename (`drop-<date>-<randomBytes(3)>`+ext) avoids both collisions and any
path-traversal surface; if the original name matters for readability,
sanitize through the same slug pattern `projDir` uses (`server.ts:126`) plus
a `resolve()`-prefix check. Response path gets appended into the compose box,
same insertion pattern as history-recall (`client.ts:1207-1210`) — no auto-send.

**Honest security framing:** owner-token holders can already write arbitrary
files anywhere they can write, via `/send` + shell commands in the pane
(`server.ts:7-9` says as much: a reachable fleet is RCE as your user) — this
endpoint doesn't grant new capability, just a more convenient path to
something already possible. What's genuinely new: binary files land without
appearing in any stream/history record, and `.fleet-drop/` sits inside
whatever git working tree the slot's cwd is — a screenshot with secrets could
get committed by accident. No code fix for that; document it.

**Cleanup:** delete `.fleet-drop/` on kill (mirroring the stream/history
delete already there, `server.ts:247-248` — note `s.cwd` is read into a local
var first, since `killSlot` nulls it immediately at line 239) plus age-based
rotation on write (self-cleaning, no new interval needed) — `openSlot`
*recycling* a slot onto a different cwd doesn't route through `killSlot` at
all, so a slot reused for a new cwd wouldn't clean up the old one's drops
without a separate check.

**Effort:** M. **Open questions:** filenames server-generated only, or
sanitized-original with a collision suffix? Delete drops on kill, or age-
rotation only? Images only (`accept="image/*"`) or any file type?

---

## 13. Right sideboard: project file tree  `medium, desktop-only`

**Idea (2026-07-18):** collapsible RIGHT sidebar showing the focused slot's
project tree; possible worktree awareness (branch/dirty badges) on top.

**Layout:** sibling of `#main` inside `#app` (`index.html:22`), `flex:none`,
mirroring `#side`; the toggle must copy `setCollapsed`'s refit pattern
(`client.ts:46-52`) or terminals render at stale width. Hook rendering into
`focusPane` (`client.ts:490`). Mobile: `display:none` — there is one drawer +
one `#shade` (`client.ts:26-30`) and a second drawer isn't worth the
contortion.

**Server:** `/api/dirs` (`server.ts:412`) is dirs-only; a tree needs files +
(optionally) `git status --porcelain` per level. Lazy per-level fetch already
matches the picker's browse() pattern. A file-LISTING endpoint adds no real
authority (owner token already = keystroke injection = RCE); a file-CONTENT
endpoint is genuinely new — cap bytes if ever added. Share-host isolation
holds automatically: unmatched paths 404 on the public tunnel before the
token gate (`server.ts:707-716`).

**Value math (be honest):** the terminal already shows files — claude itself
lists/reads them. The tree's real value is (a) tap-a-file → insert its path
into the compose box (saves typing paths into prompts, big on phone — though
mobile is excluded, so weigh this), (b) seeing what the agent changed via
git-status coloring. Against: stored feedback "native over parallel views" —
improve the terminal before adding side surfaces. Verdict: nice-to-have,
build after item 10's worktree badges exist to share the git-status plumbing;
not before the 07-22 interview.

---

## 14. Lane visibility → advisory review → structure overview  `phased, see below`

**Idea (2026-07-19):** four asks from one conversation — better lane iconography, a
non-disruptive way to judge "what kind of message fits right now" (JP's manual
motivational-quote + `/sharpen` combo gets strong results; question was whether to
systematize it), an automatic critical review before landing, and a structure
overview of a session/conversation. They converge into one 3-phase arc, not four
separate features — do NOT build them as four independent things.

**Hard constraint that reframes idea 2:** Fleet's only delivery path into a session
is `sendText` → tmux `paste-buffer`+`send-keys` (`server.ts:407-417`) — literally
typing, indistinguishable from the user. There is no side-channel. "Non-disruptive"
can only ever mean *well-timed*, never *invisible*. The existing `idleSec` gate in
`tickAutos` (`server.ts:483`: `now - s.lastOutput >= a.idleSec * 1000`) already
solves timing for scheduled autos; the new ask is *message-type* selection, which
needs either heuristics or a cheap classifier call — see Phase 3.

### Phase 1 — visibility only (low risk, no new behavior)

- **Lane iconography:** a real branch *diagram* doesn't fit a 228px row
  (`index.html:43`, collapses to 50px at `:76`) and grouping lanes by repo would
  break the slot-number ↔ `⌃1–⌃0` hotkey position invariant (sidebar footer promise).
  Ship a **per-repo hash color** on the lane accent border instead of the fixed blue
  (`.slot.lane` border-left, currently `#3a4a7a` — see the lane restructure commit) —
  lanes from the same repo read as "same tree" at a glance without moving rows.
  Optionally swap the ⎇ glyph if JP wants a more literal fork icon — pure taste call,
  confirm before shipping.
- **Signal surfacing (for idea 2, manual judgment first):** idle duration is already
  in the sessions payload (`lastOutput`); add a short last-transcript-entry preview
  and a cheap "repeated tool error" flag so JP can scan many lanes for "is this a
  good moment" without opening each one. This is the SAME data a smart-auto
  classifier (Phase 3) would need — build it as UI first, reuse it as the classifier
  input later.
- **Mechanical structure outline (idea 4, cheap half):** `.msg.user` DOM markers
  already exist and are already used by `jumpPrompt` (`client.ts:342-343`) to
  navigate between prompts. Render that same list as a visible outline/rail instead
  of only using it for ↑/↓ nav — zero new server calls, reuses data already flowing
  through `/api/slots/:id/transcript`. This is the one sub-item that's genuinely
  trivial+low-risk; the other Phase 1 items are small but are UI/taste decisions
  worth a quick confirm.

### Phase 2 — advisory review agent (idea 3 + idea 4's expensive half, merged)

- One new sidebar action next to `±`/`⏏` (`🔍 review`) that spawns an INDEPENDENT
  reviewer agent against the lane's diff (`/api/slots/:id/diff`, `server.ts:1157`) —
  not a self-review by the same session (this session's own two real defect finds
  both came from a fresh reviewer agent, not from re-reading my own work — don't
  repeat that mistake here).
- Deliberately **advisory, not blocking**: `land` stays gated on deterministic git
  facts only (dirty/unpushed — see the land handler around `server.ts:1297+`). Mixing
  in a soft LLM verdict as a hard gate would regress the "deterministic > statistical"
  principle (`CLAUDE.md`) — false positives block real work, false negatives approve
  bad work, and either way it *feels* like a hard fact when it isn't.
- The review agent already reads the whole diff/transcript to critique it — have it
  ALSO emit a short structural summary (what changed, in what order, any open
  threads) as a second field in its output. This is idea 4's expensive half, folded
  into Phase 2 as a side effect rather than a fifth thing to build separately.

### Phase 3 — smart auto (only after Phase 1 signals prove out)

- An opt-in Auto variant: before firing (same `idleSec` gate as today), classify the
  recent transcript with a cheap model (Haiku) to decide message TYPE — motivational
  nudge / re-focus (`/sharpen`-style) / hold. Same guard rails as today's Autos
  (explicit per-slot opt-in, capped runs, `lastResult` shows why it fired).
- **Do not build this first.** JP's manual technique works because HE reads the
  moment. A wrong auto-classification injects an unsolicited message into a real
  session under the appearance of being smart, which is worse than a badly-timed
  cron message — it's more trusted precisely because it looks adaptive. Prove the
  Phase 1 signals are the right ones (by using them manually for a while) before
  automating the judgment they inform.

**Effort:** Phase 1 ~half a session (mostly confirm-then-ship UI). Phase 2 ~1
session (one new endpoint spawning an agent, one overlay). Phase 3: not before
Phase 1 has been used for real and the signals are validated.

**Open questions:** repo-color hashing scheme (deterministic hash → palette, or
manual per-repo color)? Does the outline rail replace or sit alongside the existing
↑/↓ prompt-jump buttons? Review agent model choice (cost vs. thoroughness) and
whether findings persist anywhere or are ephemeral-per-click.

**Update 2026-07-19 — Phase 1 core SHIPPED (branch `fleet/lane-brief`, unmerged):**
right desktop-only sideboard "session brief" (ℹ toggle in #sidehead): fresh git
facts from new `/api/slots/:id/brief` (state line, changed files, recent commits)
+ prompt outline off the transcript feed, rows jump the conversation view to that
prompt. Design decisions settled with JP, binding for Phases 2–3:
- Ephemeral agents run as throwaway INTERACTIVE claude sessions in their own tmux
  session (cwd in the worktree — same repo context incl. CLAUDE.md), NOT as slots
  and NOT as `claude -p`: print mode bills the metered Anthropic API per token
  (JP-verified: its envelope reports total_cost_usd), while interactive sessions
  stay inside the Claude Max subscription. The answer is read from the pinned
  transcript JSONL (never scraped from the TUI). Click-only keeps the gates
  principle intact despite the session being invisible.
- No repo cloning: worktrees already are clone-light; the one future case (foreign
  repos as reference context) is better served by `--add-dir` at invocation.
- Anti-drift rule (per stored feedback "native over parallel views"): the board
  holds NO derived state — deterministic layers recomputed fresh per render, agent
  results cached keyed on git state and visibly aged ("3 commits old"), never
  silently stale.
- Land stays evidence-based: the board answers "is it saved / finished / verified",
  never emits a verdict. Agent buttons start with exactly two: ✨ summarize
  (Phase 2, folded structural summary) and 🔍 review — read-only, click-only.

**Update 2026-07-19 (later) — Phase 2 ✨ summarize SHIPPED (branch
`fleet/lane-summary`, unmerged):** `POST /api/slots/:id/summary` spawns a throwaway
interactive claude in its own tmux session (`sum-<id>`, pinned session-id, cwd =
the slot's checkout, default model `claude-sonnet-5` via `FLEET_SUMMARY_MODEL`;
`FLEET_SUMMARY_CMD` is a subprocess stand-in hook for e2e only) and reads the
answer from the transcript JSONL — subscription-covered, no metered API. Prompt
contract: strict JSON `{summary, openThreads, verification}`, evidence only.
Single-flight + git-state-keyed cache, GET never spawns, cache cleared on kill,
board shows an "older state" badge when stale. Needs `Bun.serve idleTimeout: 240`
(default 10s kills the long POST). Live-verified end-to-end: ~13s. Remaining
in Phase 2: the 🔍 review agent (same plumbing, diff-focused critic prompt) —
and note the known limitation: transcript/diff content is untrusted input to the
summarizer (prompt injection can skew the advisory text; it is display-only and
read-only by design, but don't ever wire it into a gate).

---

## 15. Lane vocabulary layer  `small, UI-only`

**Idea (2026-07-19):** JP: the raw git vocabulary confuses more than it informs.
Fleet-generated branch names (`fleet/<stamp>-<rand>`) carry zero information for
the owner — hide them from the badge (self-chosen names stay visible); keep the
lifecycle color + ⎇ as the primary signal, details in the tooltip. Rewrite the
land/kill confirm dialogs in intent language ("work is saved — retire the lane?")
instead of worktree/unpushed prose (`client.ts` land/kill handlers). Mechanics
unchanged — this is purely what the surface assumes the user knows.

---

## 16. Orphan-reap on lane kill  `small`

**Idea (2026-07-19, from a real incident):** killing a lane leaves the worktree on
disk by design ("never eat work") — but when the lane is PROVABLY empty (clean tree
AND zero commits since its spawn point, both deterministic git checks), the kill
dialog should offer to remove worktree + branch in one step. Exactly the manual
cleanup performed for the stray `docs/knowledge-corpus` lane this session. No
timer-based auto-reaping — a clock is not evidence. Optional visibility net: a lane
with no commits and no activity for hours gets an "unused" hint in its badge.

---

## 17. Knowledge / retrieval layer — index Fleet's own work-product  `structural, phased, decision item`

**Idea (2026-07-23, from a "how do we get everything out of Fleet at team/enterprise
scale" prompt + a Grok survey of open-source RAG stacks).** Framed as a decision item:
options + a recommendation, owner promotes — no build implied by writing this down.

**The reframe first.** The Grok survey (Onyx / RAGFlow / GraphRAG / Qdrant + connectors
for Slack/Confluence/Jira) answers the wrong question for Fleet. That stack indexes a
company's *documents in SaaS silos*. Fleet is a **producer of agentic work-product**; the
corpus that matters is its own accumulated experience. `steward-intelligence.md` §8 already
states the principle — *"server.ts already IS that common service"* — and it's correct:
**ingestion is solved, retrieval is missing.**

**What exists (mapped 2026-07-23, code-cited):**
- **No index / embedding / semantic retrieval anywhere** (tree-wide grep for
  `embed|vector|retriev|rag|faiss|cosine|semantic|buildIndex` → only the English word
  "semantics" in comments). The one existing query surface is `/api/prompts?q=`
  (`server.ts:3336`): a naive O(n) full-file substring scan over prompts.jsonl for the
  owner prompt directory — a display feature, not analysis, but **the natural route for
  Phase 1 to slot in behind**. Every other lookup is `.filter()` or a fixed-size tail.
- `streams/prompts.jsonl` — `{ts,slot,cwd,label,source,text}`, **uncapped, never rotated,
  survives slot close, labeled "raw material for prompt analysis"** (`server.ts:294`).
  ~2.170 prompts / 2.8 MB; read only by the substring scan above — the "analysis" the
  label promises has never been built.
- Claude's own transcripts `~/.claude/projects/**/*.jsonl` — **8.7 GB / 1835 files**; Fleet
  reads them only as byte-slices for display / a 40 KB tail for the summarizer.
- `steward-journal.jsonl` (7 records) — rich free-text `note` fields, read only as a tail
  (last 1–50); the digest worker reads exactly 1 as a delta anchor. Never aggregated.
- The learning engine / "dream mode" (`steward-intelligence.md` §8) and the arena are fully
  *designed and brief'd* but **never run** — `docs/proposals/` and `docs/arena-episodes.md`
  do not exist. (First-draft claim "dream mode is blocked on a retrieval substrate" was
  wrong — see the stress-test below: v1 over the prompts corpus runs indexless.)

**The load-bearing constraint (owner, 2026-07-23): no dead-end build.** Tier 1 must be a
stepping stone toward the enterprise stack, not a throwaway. The synergy move that guarantees
this: **separate the chunk+metadata pipeline from the storage/query backend behind one
interface.** The durable asset is the *chunker + metadata schema*, not the store — the store
is swappable underneath a stable `GET /api/knowledge/search → {hits:[{source,ref,score,text}]}`.
Concretely, three things carried from day 1 make Tier 2/3 extensions rather than rewrites:
1. **Rich, source-aware chunk metadata** (`source, id, ts, repo/cwd, principal/slot, kind, text`)
   — Grok's one genuinely portable Cerebras lesson; cheap now, essential at Tier 3.
2. **A permission dimension tagged on every chunk even though single-owner ignores it** —
   Tier 3 permission-aware retrieval then adds a *filter*, not a re-tag of the whole corpus.
   Maps onto Fleet's existing token / slot / worktree isolation, not a second auth system.
3. **Reuse, don't add plumbing** (the within-Fleet synergies): the `appendEvent` chain + the
   ticker family (`tickGit`/`tickHarvest`) for incremental indexing; the credential-less
   **ephemeral-worker** pattern the digest already uses (`runStewardDigest`) for any future
   embed/rerank step; the existing injection-scan / "retrieved = claim not fact, never gating"
   doctrine (§8, §6.7). No peer process — the index lives *in* server.ts beside `fleet.json`.

**The phased ladder (infra coupled to scale — building Tier 3 while Tier 1 is needed is the
failure mode Fleet's doctrine explicitly guards against):**
- **Phase 1a — FTS5 over the small corpus** (prompts.jsonl + journal notes), one query route
  behind the swappable interface, plus a **gold-query set as the done-criterion** (~20 queries
  with expected hits — without it, "keyword demonstrably misses" is undecidable). Deterministic,
  auditable, no new process. **FTS5 verified working in this Bun** (`bun -e` probe, 2026-07-23:
  virtual table + MATCH + rank OK). Effort: **1 lane, 1–2 sessions** (~300–500 lines + e2e) —
  cheap because the corpus is ~2.8 MB and `/api/prompts` already exists to slot in behind.
- **Phase 1b — transcript ingestion** (the part that actually needs an index). Effort: **3–5
  lanes / 4–8 sessions**; drivers: a JSONL chunker with stable refs over nested
  user/tool_use/tool_result records (the real work, not FTS5), incremental re-index of growing
  files, the indexing boundary + secret policy (owner decisions, see below), e2e, doc upkeep.
- **Phase 2 — semantic, only when the gold set proves keyword misses.** `sqlite-vec`, still
  *inside* bun:sqlite. Two real costs, probed/derived 2026-07-23: (a) this build refuses
  `loadExtension` (macOS system SQLite) — needs `Database.setCustomSQLite()` + a brew sqlite
  dylib; (b) **unsolved: the embedding source.** Vectors have to come from somewhere — a local
  embedding server is exactly the peer-process this item rejects Qdrant for, and an external
  API collides with this machine's allowlisted-network doctrine. Until (b) has an answer that
  survives the one-server rule, Phase 2 is parked, not scheduled. Strictly **advisory**, never
  gating, when it does come.
- **Phase 3 — team/enterprise only, and honestly: a product pivot.** Multi-user Fleet (auth,
  TLS, tenants, permission-aware retrieval) dominates the cost; the RAG half is the smaller
  half. Onyx is a multi-container *platform*, not a library — at this tier you deploy a
  neighbor system, which is acceptable only because the one-server doctrine has already been
  traded away by going multi-user. Not estimable now. The Phase-1 interface + metadata schema
  is what lets this swap the backend instead of restarting.

**Stress-test 2026-07-23 (against the Grok survey, own weaknesses owned) — what flipped:**
- **The cheap part may be unnecessary: prompts.jsonl (~2.8 MB ≈ ~700K tokens) nearly fits a
  1M context window and certainly fits a Workflow fan-out.** Dream mode v1 over the prompts
  needs NO index. The index only becomes indispensable for the 8.7 GB transcripts — exactly
  where chunking cost, secrets, and retention sit. So: the cheap part is skippable, the
  necessary part isn't cheap — which flips the recommendation below.
- **The index is a secrets concentrator.** Streams/transcripts are chmod 600/700 *because*
  terminal output contains secrets; a full-text index over 1835 transcripts (including
  non-Fleet projects) concentrates the most sensitive material into one queryable file.
  Minimum: index DB mode 600, query route owner-only at first, boundary + secret policy
  decided *before* 1b starts.
- **Grok cross-check verdicts** (survey of open-source RAG stacks, 2026-07-23): adopted —
  continuous ingestion, source-aware metadata, citations, BM25→dense→rerank ladder; rightly
  dropped — Cerebras inference (external API vs. allowlisted network; we run Claude sessions),
  GraphRAG (no consumer), agent frameworks (Fleet *is* the orchestration); wrongly glossed
  by this item's first draft — chunking effort (understated; it's the real Phase-1b work),
  embedding source (was silent; now Phase 2's parking reason), eval (was absent; now the
  gold-set done-criterion), "Onyx as a component" (was glib; now honest as a product pivot).

**Options for the owner (recommendation flipped by the stress-test):**
- **A (recommended): run dream mode v1 first, indexless** — over prompts.jsonl via fan-out
  (steward-roadmap "Next" #4 is already the learning-engine slot). This proves whether
  retrieval is even the bottleneck *before* the 4–8-session 1b investment falls — Fleet's own
  infrastructure-after-demand doctrine applied to itself.
- **B: Phase 1a as by-catch** — only if a lane is in that area anyway; it's 1–2 sessions but
  its standalone value is questionable given A.
- **C: promote Phase 1 (a+b) as lanes now** — the first draft's recommendation; only if
  cross-lane recall is wanted urgently enough to pre-empt the dream-mode proof, and only with
  open question 1 answered first.
- Phase 2 parked (embedding source unsolved), Phase 3 deferred (product pivot, not a feature).

**Open questions (owner):**
1. **Indexing boundary + secret policy for the 8.7 GB transcripts** — those are Claude's files,
   not Fleet's, and they span non-Fleet projects. Cap to Fleet-owned cwd-slugs + an age limit,
   and decide secret filtering, before 1b — or you index half the home dir.
2. **Roadmap slot** — dream mode v1 (option A) vs. "prove the steward live" ordering.
3. **prompts.jsonl retention** — once it's indexed (not just tail-displayed), does it stay uncapped?

---

## 18. Per-lane attributed-outcome recorder  `RECORDER SHIPPED 2026-07-24 · analyzer + viewer are future items`

The fleet measures per-INTERVENTION outcomes (steward nudge → helped/noEffect, item 17-adjacent)
but never per-LANE — yet the lane is the atomic unit of real work, and where model + brief +
difficulty actually express themselves. This closes that gap: a deterministic fact substrate so the
fleet can eventually learn which model / brief / task-class produces landable work, from REAL lanes
instead of a synthetic eval set.

**Shipped (the RECORDER, `server.ts` `buildLaneOutcome`/`LANE_OUTCOME_FILE`):** appends ONE
server-stamped fact at each of a lane's terminal events — land success (`landLane`), kill (dirty vs
empty by commit count), shelve, and `repo_undo_land` (a revert = the strongest negative outcome).
Each record: `{ ts, branch, base, headSha, disposition, model, briefHash, shortstat, commitCount,
filesTouched, e2eTouched, verified, sessionMs, ownerPrompts }` — assembled entirely from git + slot
state (a pane/client can never write into the trail, same choke-point stance as the audit log). The
fingerprint (shortstat/commitCount/filesTouched/e2eTouched) reuses `briefPayload`'s `base...HEAD`
footprint and doubles as the DIFFICULTY proxy that later makes cross-lane comparison valid. Read via
owner-only `GET /api/lane-outcomes?limit=N` (exact access model as `/api/audit` — token-gated,
structurally 404 on SHARE_HOSTS). Bounded/rotating through the shared `appendEvent` chain.

**Deliberately a RECORDER, not an analyzer:** it never ranks, gates, promotes, or renders a verdict,
and is uncoupled from `outcomeTally` / the steward ladder. Analysis needs VOLUME — it is a later
consumer, not built here (anti-abstraction bar; the register parked model-eval INFRA as
not-worth-building — this is passive attribution, not that).

**Attribution prerequisite — the model-fix:** `model` is `s.model ?? null`. Until a `DEFAULT_MODEL`
is pinned, a lane opened without an explicit `--model` records `model: null` HONESTLY (the effective
model is unknowable server-side — never guessed). model + briefHash are recorded as an ENTANGLED
pair (a strong brief lets a weak model succeed) so they can be disentangled later — never attribute
to model alone. Pinning the default model is the prerequisite for model-level attribution.

**Future items (separate lanes):** (a) an ANALYZER that reads the trail once volume exists; (b) a
client VIEW over `/api/lane-outcomes` (mirrors the item-9 audit-view pattern).

---

## Hardening — findings from the review sweep, not new features

Found while designing/reviewing the above, ranked by what actually costs
something if left alone. Everything here is either a live issue (already
acted on) or a gap in existing, shipped code — not part of any single feature above.

1. **[Acted on this session] Confused-deputy via slot cwd = the fleet repo
   itself.** `fleet.json` (mode 600, but same-user-readable) holds the
   plaintext owner token and every share secret (`server.ts:150-157`,
   `795-814`). Slots 6 *and* 11 currently have `cwd:
   ~/claude-fleet` — any claude session running there (or any
   guest sharing it) can `cat fleet.json` and escalate to full owner control
   from anywhere Tailscale-reachable. Slot 11 was **actively shared in
   interactive mode** when found — revoked and verified
   (`POST /api/slots/11/unshare` → `shares: []`) during this session. Slot 6
   still points there; move it, or accept the exposure knowingly. No cheap
   code fix for the confused-deputy pattern itself — the mitigation is never
   pointing a slot's cwd at the fleet install directory.

2. **[Fixed this session, `server.ts` — `openSlot` now filters + closes shares
   like `killSlot` does, regression-tested] `openSlot` didn't filter shares on reopen —
   contradicts the invariant `killSlot` enforces.** `killSlot`'s comment says
   "a share must not outlive its session" (`server.ts:243`) and filters both
   `shares` and `autos`; `openSlot` (`server.ts:224-236`) filters `autos`
   (line 231) but **not** `shares`. Recycling an active slot onto a different
   cwd via `/api/slots/:id/open` leaves the old share pointing at the new,
   unrelated session — a guest with the old link/password gets a live view
   into whatever the slot became next. One-line fix (`shares =
   shares.filter(x => x.slot !== s.id)` alongside the existing autos filter),
   confirmed missing by both the security review and the e2e-gap review
   independently — top-ranked item on both lists.

3. **[Fixed this session] Owner cookie missing `HttpOnly`** (`server.ts:695`)
   — the share cookie two routes down sets it (`server.ts:728`); the owner
   cookie didn't. Not exploitable at the time (no XSS found — all dynamic
   client rendering goes through `textContent`, verified), but free
   defense-in-depth. **Found while fixing this:** the token-paste gate
   (`src/client.ts`, the `gateIn` handler) set the cookie itself via
   `document.cookie` — JS can never set `HttpOnly`, so that flow would have
   silently overwritten the server's `HttpOnly` cookie with a non-`HttpOnly`
   one every time someone used it instead of the `/?token=` URL. Fixed by
   routing the paste flow through the same server login endpoint instead of
   setting the cookie client-side at all — now there's exactly one place a
   session cookie gets minted, and JS never touches it.

4. **[Fixed this session, throttled not locked-out] Owner API token had zero
   rate limiting** (pre-existing, HANDOFF.md already flagged it) — share auth
   gets `failStrike` (`server.ts:511-521`); the owner-token check
   (`server.ts:774`) didn't. Confirmed the exposure is narrower than "public
   internet" — `SHARE_HOSTS` intercepts the public hostname before the token
   path is ever reached (`server.ts:677-686`, traced line by line) — so this
   was Tailnet-only exposure. Deliberately did NOT copy the share's
   count-based lockout: the owner token is the only credential this app has,
   so a hard lockout would let a remote guesser lock the real owner out of
   their own dashboard — worse than the problem it solves. Added a flat
   400ms-per-failed-attempt throttle instead (`tokenGate()`), same cost model
   as share auth's per-guess delay, without the escalating block.

5. **[Fixed this session, verified with a round-trip test] Watchdog PATH
   interpolation wasn't escaped, unlike the equivalent code in `server.ts`.**
   `watchdog.sh:16-17` single-quoted `$PATH` without escaping embedded `'`
   characters; `server.ts:31` does this correctly 20 lines away. Copied the
   same escaping pattern (`sed` equivalent of `replaceAll("'", "'\\''")`) —
   confirmed round-trips correctly with a `'` embedded in a test PATH before
   deploying.

6. **[Not fixed — deferred, low severity] Transcript slug collisions can show
   the wrong conversation** for slots without a pinned `sessionId` (adopted
   sessions, 3 of 11 today) — the mtime-fallback in `transcriptFile()`
   (`server.ts:411-428`) trusts the cwd slug alone; two distinct cwds can
   slug-collide. Same-user info-disclosure, low severity, fixable by
   cross-checking the transcript's own `cwd` field against `s.cwd` before
   trusting the mtime pick. Left for whichever session next touches the
   transcript view rather than a dedicated pass.

7. **[Fixed this session] `Pane.dispose()` didn't clear `this.slot`/`this.view`**,
   unlike `resetChat()`/`assign()` — an in-flight `pollChat()` fetch resolving
   after `setLayout()` disposes the pane (layout switch, or any mobile/desktop
   breakpoint crossing) would re-arm its own `setTimeout` on a dead instance
   (`client.ts:336-373` vs `463-470`), because its `finally` block checks
   `this.view`/`this.slot`, both still truthy. Orphaned 1s poll loop against
   the token-authed transcript endpoint, unbounded until a full page reload.
   Fixed by nulling both fields in `dispose()`.

8. **[Not fixed — deferred, real but tied to a feature not yet built] Stale-bundle self-heal can silently discard a compose-box draft.**
   `armReload()` (new this session) reloads the instant the tab is
   backgrounded after a deploy — with no draft persistence anywhere today
   (`saveView()` only stores layout/panes/focused, not `ta.value`). Directly
   relevant to item 11 above: the per-slot draft buffer proposed there, once
   it exists, should be checked *before* `armReload` fires, not after.

9. **e2e coverage gaps**, ranked by risk × cost (full list of ~10 in the
   review; top five closed this session, marked below):
   - **[Fixed]** (a) share surviving a slot reopen — regression test for #2 above.
   - **[Fixed, dedicated harness]** (b) the claude-alive gate had **zero**
     coverage because `FLEET_CMD=true` in the main test harness disables it
     entirely — the single scariest path in scheduled prompts (typing into a
     bare shell) was completely unverified. New: `e2e-claude-gate.sh` +
     `fleet-e2e-claude-gate.ts`, a fully separate isolated instance running a
     real compiled stand-in binary literally named `claude`, exercising the
     actual `pgrep`+`ps` detection logic in both directions (alive → auto
     fires; dead → auto skips, marker never reaches the pane).
   - **[Fixed]** (c) adversarial export-escaping — the old check
     (`fleet-e2e.ts:162`) was tautological, the pane content it checked never
     contained an HTML metacharacter to begin with. New checks send a real
     `<script>` into the pane and a real `<b>"..'</b>` into the label, verify
     both interpolation sites (pane content, title/h1) escape correctly.
   - **[Fixed]** (d) share-host allowlist against path tricks (`../`, encoded
     slashes, case) — HANDOFF.md asked for this explicitly, was never
     written. New checks cover all three; the dot-segment one is honestly
     annotated as converging with an existing check via client-side URL
     normalization (verified empirically, not assumed) rather than claimed
     as fully independent coverage.
   - **[Fixed]** (e) the 4002 mode-flip close code was tested over HTTP but
     not over an actually-connected guest WebSocket — new check connects a
     real guest socket, triggers the flip, asserts the close code.
   - **[Not fixed — deferred]** structural: the main suite is now 112 checks
     in one linear script with shared state and no per-check isolation — a
     failure early still cascades into unrelated-looking failures, and fixed
     sleeps with no polling deadline remain a flakiness risk (worst
     offenders unchanged: 9s/4.5s windows racing a 2s self-heal tick or a 5s
     auto-tick). A real fix means restructuring the harness, not something
     to bolt on alongside targeted regression tests — left for a dedicated pass.

10. **[Not fixed — deferred, low severity] The commit mid-run guard is
    client-only.** `confirmMidRun` (`client.ts:778`) warns before committing a
    session that produced output within `RECENT_MS`, so the owner doesn't
    snapshot a half-finished tree. But the server route
    `POST /api/slots/:id/commit` (`server.ts:2900-2915`) enforces only
    `commitInflight`/`mergeInflight` — there is **no** `lastOutput` check,
    unlike `/merge`, which hard-blocks on active output (`MERGE_IDLE_MS`,
    `server.ts:2787`). A commit reaching the route any other way — the
    self-token autos route, the raw owner API, a second browser tab — bypasses
    the warning entirely. The commit is reversible (`git reset`), so severity is
    low, but the guard is theatre if only one client path enforces it. Fix:
    mirror the `lastOutput` confirm/block server-side, or accept it as a
    UI-only hint knowingly and stop implying it's a real gate.

11. **[Not fixed — deferred, low severity] `✎ message` (agent-written commit)
    falls back to `wip:` silently.** If the agent message fails or comes back
    unparseable, `commitLane` (`server.ts:1720-1725`) commits with the wip
    message and returns `{committed:true, subject:"wip: …"}` — the button
    promised an agent message; you get a wip commit with no signal that the
    agent half failed. Low severity (the commit still succeeds, which is the
    point of the fallback — a save must never fail on the model), but the label
    occasionally lies. Fix: have `commitLane` return a flag when the fallback
    fired and surface "agent message unavailable — saved as wip" in `doCommit`'s
    result alert (`client.ts:753-755`).

---

## Execution order — THE register (both tracks)

*This is the roof: **status, dependency, whose call, and a pointer** — never the reasoning, which
stays in the proposal docs. If the register and the tree disagree, the tree wins (CLAUDE.md).
Two tracks run in parallel: **A = the program** (steward / measurement / land-spine), **B = the
product backlog** (the numbered items above). Items 14 and 17 are track A living in this file.*

### Track A — the program

**Shipped 2026-07-23** — all landed ff-only and deployed (srv 22:43:23, health 200); both suites
ALL PASS on integrated main, each lane also verified in its rebased landing state:
`f87c641` P1 e2e concurrency-safe · `a9e7cab` P2 doc symbol-anchors · `69f496a` share-flake guard ·
`917452a` G1 land provenance + stale-verify · `9e729d4` G2 verify badge · `2fc7c50` A1 honest
`helped` + attest staleness · `df260b1` A2 advisory `baselineRate` · `f70cc7a` B1 **server half**.

**Two facts that constrain everything in this track** (verified 2026-07-23 — re-verify before building):

1. **There is no ladder.** `promotionEligible` is read in exactly two places — the outcomes gauge
   and the harm route's response — and **both are read-only status endpoints; nothing acts on the
   verdict.** The code states it: *"the ladder wiring itself is future — only the fuel + predicate
   ship."* So filling `outcomeTally` has **no consumer today**. Any B1 work justified as "fuel for
   the ladder" rests on a consumer that does not exist. B1's real near-term value is different and
   still genuine: steward-surfaced decisions stop evaporating in a pane and become persistent,
   actionable queue items. Re-verify: `grep -n promotionEligible server.ts`.
2. **The tick swallows its own errors.** `tickGit` is `try`/`finally` with **no catch**, and every
   call site is `void tickGit().catch(() => {})`. `measureOutcomes()` (and A2's `measureControls`)
   run as the *last* statement inside that try — so a throw there is invisible: no log line, health
   stays 200, git badges keep updating, and only the measurement silently dies. **"No errors in
   server.log" is not evidence that the measurement layer works** — verify it positively. Same
   family as dossier F6: apparent health ≠ actual function.

**Positive live verification (2026-07-23, post-deploy):** `GET /api/steward/outcomes` returned
`baselineRate {rate: 0.25, samples: 12, helped: 3}` plus A1's `harmAttestAt`/`harmAttestTtlMs` — so
A1 and A2 genuinely execute in the live tick. **First real measurement this program has produced:
a working, un-nudged slot looks "helped" ~25 % of the time.** That is the null A2 exists to supply;
any future nudged `helped` rate must beat it to mean anything.

**Shipped 2026-07-24 — P-1a, the digest delta-anchor filter** (committed on `main`, **not yet
deployed**: the running srv still has the bug until the owner restarts it). `readStewardJournal`
takes an optional `kind`; both digest call sites now ask for the last `kind:"rundgang"` record.
One correction to the old framing below: the anchor was **not** only poisonable by B1's
`propose_outcome`. `measureOutcomes` writes `kind:"outcome"` (and `harm_candidate`) into the same
journal on **every matured steward send** — a path that is live and running now. So the trigger is
not "a steward task must exist" but "a steward send must mature". Still latent in production only
because no steward send has ever been measured (the live journal holds 13 records, all `rundgang`;
A2's baseline samples are in-memory controls that never journal). Regression test:
`digest delta anchor is the last RUNDGANG record…` in `fleet-e2e.ts`, asserted while the journal's
newest record is provably an `outcome` — pre-fix that record *was* what `prior` returned.

**Open — in dependency order:**

| # | Item | Blocked by | Whose call | Pointer |
|---|------|-----------|-----------|---------|
| ~~P-1a~~ | **SHIPPED (committed, NOT yet deployed)** — digest `prior` filter. See the shipped block above | — | owner: deploy | — |
| ~~P-2~~ | **DECIDED + SHIPPED (2026-07-24)** — freshness anchored as step 0 of the `/steward` load ritual (owner's call): merge main + sync the gitignored CLAUDE.md/OWNER.md copies (found stale — merges never carry them) BEFORE reading the shelf; ordering was the bug. Session declared disposable-by-design. **Remaining owner action: refresh the live steward session** (`/clear` + `/steward` in slot 1) so the running instance actually picks this up | — | owner: refresh slot 1 | docs/steward.md "Session start" |
| P-3 | **THE FORK — probe or build?** (below) | live steward refreshed | **owner** | this register |
| P-4 | **Deploy-gap fact** — nothing shows whether the live server predates `main` | check prior art first | owner: slots view / foreman / nowhere | dossier F6; `5c69417` |
| P-5 | **Worktree placement** — pin the lane path to the sibling dir or gitignore it (cheap half only) | — | fold-in, no own lane | dossier F7; stack-land §8 |
| P-6 | **Program board** PB-1/2/3 — lane DAG, orchestrated dependent-rebase, stack cleanup | — | owner: build or not | stack-land-program-board |
| P-7 | **F-D minors** — digest cache invalidation, `runVerify` SIGTERM→SIGKILL, per-repo `FLEET_VERIFY_CMD` | — | fold into whichever lane touches that code | deep-dive → F-D |

**P-3 RESOLVED (2026-07-24): arm (a), the probe — with a guardrail the register did not originally
carry.** The `/rundgang` filing edit shipped (`.claude/commands/rundgang.md`: file section-1 items
as `pending` steward tasks, ≤2/pulse, self-contained text, honesty-gated so "all clear" files
nothing). The owner's standing "the agent must not müll sich zu" principle reshaped arm (a): the
"duplicates knowingly accepted" clause is sound **only while the pulse is run manually and
watched** — prompt-side de-dup is impossible (no GET on open tasks) so an unwatched scheduled pulse
would re-file every persistent condition and flood the review buffer. Therefore the edit itself
binds the guardrail: **this pulse is never scheduled until server-side `ref`-dedup lands.** That
minimal de-dup (deep-dive B1b item 2 alone — a `ref` field + idempotent-on-open-ref POST, ~15 lines
+ e2e + one deploy; it does NOT need the GET, the server checks its own open tasks) is now the
**gate before scheduling**, not a speculative up-front build. The commit-cursor fact layer
(rundgang records now carry a server-stamped per-lane `{head, base, landed}` map) gives the dedup
`ref` its natural substrate: `branch@headSha` is derivable server-side, so the scheduling gate's
missing piece is only the idempotent-on-open-ref POST itself — a follow-up lane, not built here. Open sub-decision left to the owner:
after watching a few real filed proposals, judge their quality (the actual P-3 unknown) and let the
observed duplicates shape whether the fuller B1b (GET + `mute(ref)`) is worth it.

*Original framing, kept for the reasoning:* Nobody has ever seen a steward proposal; the route has never
been used in production. So the open question is **not** "how do we de-dup" but **"are the
proposals any good at all?"**

- **(a) Probe first — recommended.** Ship P-1a only, then the `/rundgang` edit with a deliberately
  conservative rule (section-1 items only, 1–2 per pulse), the existing cap of 10 as the sole
  backstop, duplicates knowingly accepted. Cost ≈ one prompt edit. It buys the only unknown that
  matters. The tally gets dirty — acceptable, because it **has no consumer** (fact 1) and is a
  plain field in `fleet.json`, resettable while srv is down (there is no reset route). Then build
  de-dup shaped by the duplicates actually observed.
- **(b) Build B1b first.** Fully specced (GET + `ref` + `mute(ref)` + the prior filter),
  deterministic, e2e-gated. But it is four features designed before a single real proposal exists,
  and its strongest justification — protecting the tally — protects a number nobody reads yet.
- **Cost of being wrong:** (a) wrong → a dirty tally you reset. (b) wrong → four features built for
  proposals that turn out to be noise.

**Superseded (do not re-derive):** an earlier version of this register made B1b a single P-1 that
*had* to precede the prompt edit, arguing that duplication and staleness both corrupt the tally
irreparably ("empty tally = free fix, filled tally = data amnesty"). That argument was conditional
on the tally mattering **now**; fact 1 shows it does not yet, and a deliberate, time-boxed probe is
not the silent multi-week accumulation the amnesty rule was written against. **P-2 survives the
reframing and gets stronger** — a probe run against a 19-commits-stale steward measures the wrong
steward.

**Parked with a trigger — do not re-propose without the trigger:**
- The 11 prompt "insurance" edits → the day the first cheap-model (Haiku-class) lane runs
- `/sharpen` A4/A5 rewrite → needs a hold-out / eval set first
- `catchup` #15 (ordering) → zero-risk owner one-liner, whenever
- Recurrence sensor (runtime `INFRA-FLAKE` markers) → only when actually tackling the
  non-deterministic flake class
- Lane-runaway detection (one 25× outlier on disk) → a **second** runaway
- §17 retrieval layer → decision item, deliberately parked
- Coordination-cost concentration (2.6× orchestration vs execution) → **judged a description,
  not a problem**: the "cost" is rate-limit/context pressure not money, much of the mass is the
  owner's own interactive work (which is the product), and no deterministic gate would show
  whether a "fix" improved anything

**Dead ends — never retry:**
- Transcript-grep recurrence counting (2b): the count *rose* 34→41 during one review with **zero**
  real collisions — it measures how much a problem is documented, not whether it recurs
- Promoting any prompt edit as an improvement while **no eval set exists**

**Measured as working — an optimization pass must NOT "fix" these** (dossier F8):
- Worker prompts (digest ≈2k tokens; summary hard-capped + cached) — together <1 % of mass
- The merge resolver — impact × frequency ≈ 0 (2 land notes exist in total)
- Session stability — 67 pane `created` vs **1** `resumed` across the whole audit history
- The land spine — ff-only, ancestry re-verification, one-step undo, real provenance notes

### Track B — product / feature backlog

**Still open:**

| # | Item | Size | Why here |
|---|------|------|----------|
| 11 | Misfire guard + drafts | M | Daily-use pain, and item 8's revive UI plus any future multi-slot feature gets safer to use once this exists |
| 12 | File / screenshot drop | M | Fills the one input channel phone users are missing entirely |
| 9 | Audit log | S–M | Directly answers the still-open "sessions vanished" mystery from the last HANDOFF |
| 8 | Session archive + revive | M | Real data-loss fix; the resume mechanics already exist and are proven |
| 10 | Worktree spawn | M | Biggest change to how the tool is *used* — do once the above have proven the workflow is stable |
| 6 (old) | Transcript view Phase 2 | L | Still open from the prior backlog, unrelated to this sweep |
| — | Hardening #1 follow-through | — | Slot 11's live exposure is closed; slot 6 still points at the fleet repo cwd — move it, or accept the exposure knowingly, your call |
| — | Hardening #6, #8, #9 (structural) | — | Ride along with whichever feature touches that code next (transcript view, misfire-guard drafts, e2e harness rework) rather than a dedicated pass |

## Open questions (answer when convenient)

**Carried over, still open:**
1. More slots: how many do you actually want — 16, 20, fully dynamic?
2. Prompt history: composed sends only, or also live-typed input? Server-persisted OK?
3. PDF: light print theme? Also plain .txt export?
4. Automation: snippets, scheduler, or auto-responder?

**New from this sweep — see each item's own "Open questions" above for full context:**
5. Archive retention: count cap or age cap? Default revive target?
6. Audit log: log guard()/404 rejections (probing visibility) or is that just noise?
7. Worktree: delete merged branches on cleanup, or always leave them?
8. Drafts: per-device only, or server-synced for phone+desktop parallel use?
9. File drop: server-generated filenames only, or sanitized originals?
10. Hardening #1: move slot 6 off the fleet-repo cwd, or is that intentional?

**Track A — decisions that gate program work (2026-07-23):**
11. **P-3: probe or build?** The one decision that actually gates the program. (a) ship P-1a + a
    conservative `/rundgang` edit and *look at what the steward proposes*, accepting duplicates and
    a dirty tally you reset afterwards; or (b) build B1b's full substrate first. Recommendation:
    (a) — the unknown is proposal *quality*, not de-dup, and no consumer reads the tally yet.
12. **`mute(ref)` semantics** (owner-raised): confirm the split — *dismiss* = "no, not this
    instance" (counts `propose.dismissed`), *mute* = "stop proposing this" (suppression, **no
    tally event**, listable + reversible). The no-tally rule is the load-bearing half: if muting
    counted as a dismissal, silencing the system would depress its own quality number.
13. **Steward freshness (P-2): where does it belong** — a step in the `/steward` load ritual, a
    step in `/rundgang`, or your own habit? Boundary to respect: pulling `main` *into* the
    steward worktree is not landing, but the steward must never land or merge.
14. **Deploy-gap (P-4): a fact or a prompt?** On the slots view, in the foreman pulse, or nowhere —
    and does the owner need to be told, or just be able to see it? Deploy stays owner-only either way.
15. **Program board (P-6): build it at all?** It is propose-only today; one hand-run stack is the
    entire evidence base.
