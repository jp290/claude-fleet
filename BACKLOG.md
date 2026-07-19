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
password-gated guest access via https://klaus.example.com, view/interact
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

## 9. Audit log  `small–medium`

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
- Ephemeral agents run as `claude -p` subprocesses with cwd in the worktree (same
  repo context incl. CLAUDE.md), NOT as slots — slots are scarce and TUI output
  would need scraping. A "→ open in session" button promotes a result to a real
  slot when follow-up is wanted. No hidden service sessions (invisible automation
  contradicts the gates principle).
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
`fleet/lane-summary`, unmerged):** `POST /api/slots/:id/summary` runs `claude -p`
(default `claude-sonnet-5` — best cost/quality point for summarization; override
via `FLEET_SUMMARY_MODEL`, binary via `FLEET_SUMMARY_CMD`) with cwd in the slot's
checkout. Prompt contract: strict JSON `{summary, openThreads, verification}`,
evidence only. Single-flight + git-state-keyed cache, GET never spawns, cache
cleared on kill, board shows an "older state" badge when stale. Real-CLI smoke
test: ~$0.11/call (mostly 1h-cache write; cheaper within the window). Remaining
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

---

## Execution order

**Done this session** (all deployed to the live instance, all verified —
tsc/build/e2e-isolated.sh at 112 checks, plus the new dedicated
`e2e-claude-gate.sh`): Hardening #2 (share survives reopen), #3 (`HttpOnly`
+ the paste-gate rewrite it required), #4 (throttled owner-token check), #5
(watchdog PATH escaping), #7 (`Pane.dispose` leak), and e2e items 9a/c/d/e
plus the dedicated claude-alive-gate harness (9b). The one live exposure
found along the way (Hardening #1, slot 11's share) was revoked and verified
in the same session, not queued.

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
