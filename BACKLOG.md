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
modes, live through the Cloudflare tunnel, revoke kicks guests instantly.

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

---

## Execution order

| # | Item | Size | Why here |
|---|------|------|----------|
| 1 | Esc on desktop (item 1) | XS | Daily iPad pain, 30-minute fix |
| 2 | Prompt history (item 2) | S | Covers two requests at once, no deps |
| 3 | More slots + sidebar "+ new" (item 3) | S | Unblocks the UI pass |
| 4 | UI density pass (item 4) | M | Needs your feedback per iteration |
| 5 | PDF export (item 5) | M | Self-contained; even better after item 6, but useful now |
| 6 | Transcript view Phase 1 investigation (item 6) | M | Go/no-go before the big build |
| 7 | Transcript view Phase 2 build (item 6) | L | The structural payoff |
| 8 | Input automation (item 7) | ? | Blocked on definition |

Items 1–3 are one working session combined. Item 5 could ride along anytime.

## Open questions (answer when convenient)

1. More slots: how many do you actually want — 16, 20, fully dynamic?
2. Prompt history: composed sends only, or also live-typed input? Server-persisted OK?
3. PDF: light print theme? Also plain .txt export?
4. Automation: snippets, scheduler, or auto-responder?
