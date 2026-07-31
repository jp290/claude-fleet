# demo/fixtures — the recorded sessions, and the four traps in re-using them

`demo/fixtures/` holds five raw `pipe-pane` streams from real Claude Code sessions, recorded for
the public replay demo: `s1.raw`, `s3.raw` and `s4.raw` from 2026-07-30 (`bd3256a` — the earlier
`f010709`/`57c5ce4` were rewritten before anything was pushed and are orphaned, so do not chase
them), plus `lane.raw` and `project.raw` from a single 2026-07-31 sitting with two panes
(`cd8ae5b`). A sixth, `s2.raw`, was deleted with the 2×2 grid it existed for (`8426ce5`). This doc
exists because four things about those bytes are **not derivable from them**, and getting any of
the four wrong is either a privacy incident or a garbled replay.

Everything else is already written where it belongs: what each session did is in the commit
body, the per-slot metadata is in `slots.json`.

## 1. The terminal geometry is a contract: 76×28

The panes ran at exactly the 2×2 grid size, because the browser sized them before the
prompts were sent. tmux bakes wrapping into the stream at the width in force, so a replay at
any other width replays *stale* wrapping — the same class of garbling the top-level README
documents under "Scrollback fidelity across widths". `slots.json.terminal` carries the
numbers; a player that lets the viewport pick the width will look broken and the cause will
not be obvious.

## 2. Each stream starts mid-screen — clear the terminal first

The streams begin at the byte offset of their first prompt, so the first bytes are relative
cursor moves against a screen the replay never drew. Feed `\033[2J\033[H` before the first
byte and the head renders as prompt-then-work. Verified: `s1.raw` fed into a fresh 76×28
pane reproduces the live session's final screen.

## 3. Why the head was cut — do not "restore" it

Claude Code's boot banner prints the account's org line, which is an **email address**. It
is redrawn on every start: `/clear` leaves it on screen, and the `--resume` path Fleet's
self-heal uses prints it again. There is no flag for it. So the recording starts after it, and
`slots.json.head` says so — a future session that finds the streams "truncated" and re-copies
them from an instance would put the email straight into a public repo. (That note used to be a
per-slot `droppedHeadBytes` count and is not one any more: the 2026-07-31 pair needed no head cut
at all, because both recordings were started AT their prompt by emptying Fleet's own stream file
immediately before the send, so the banner never entered either file.)

A first recording of slot 4 was discarded whole for the neighbouring reason: that session
shelled out to `gh` and printed the account handle. The lesson generalizes — **a demo task
must not be one an agent can answer by looking up the owner's identity.** The task was
re-scoped to a local README-vs-command-file audit and re-run.

The sweep that gates this is `~/claude-fleet-private/demo-2026-07-30/sweep.ts` (emails,
tokens, `?token=` URLs, the tailnet IP, the domain, campaign names). It reports byte offsets,
which is how the banner hits were shown to fall before every cut point. Note what it did
*not* catch on its own — see §4.

## 4. The machine account name must not be visible (owner decision, 2026-07-30)

The first recording carried it 80 times — `/Users/<account>/fleet-demo/...` in tool output, and
`unix:///Users/<account>/.colima/default/docker.sock` legible in the screenshot's top-right
pane. It is not an email, host, domain or token, so the content rules did not catch it; the
owner ruled it out explicitly. **It stays out.** Two consequences worth carrying:

- **The fixtures are redacted, and say so.** `slots.json.redaction` records it: the account
  name became `demouser`, **length-preserving** — 8 bytes for 8 — so every cursor address and
  byte offset downstream is untouched and the streams render exactly as recorded. Any future
  redaction in a terminal stream must hold that property. These are not text files; a shifted
  byte is a shifted screen.
- **Grepping the bytes is not sufficient, and this is the trap worth remembering.** A terminal
  composes a line from several writes. One occurrence reached the stream as the name's first
  seven characters followed by a cursor jump, with the eighth already on screen from an earlier
  redraw. The bytes did not contain the name; **the rendered frame did.** It was found by
  scanning for every fragment of the name of length >= 3 and inspecting each hit, then confirmed
  by rendering that exact frame into a 76×28 pane before and after the patch. Any check of a
  terminal recording has to ask what *paints*, not what greps — and note that this rule applies
  to the prose too: naming the fragment in a doc would publish seven eighths of the thing the
  redaction removed.
- **The board image renders the fixtures, not a live fleet.** There was no way to re-shoot
  four finished live sessions after the fact, so `docs/screenshot.png` was retaken from a
  throwaway instance whose four panes `cat` the redacted streams at 76×28. Every pixel of
  content is real recorded work; only the account name differs from what the sessions printed.
  `docs/screenshot-mobile.png` is still a live session — its visible window was checked to
  carry no home path at all (replay at 67×60, zero hits for `/Users/`).

A history note, because it matters more than the file state: the first two commits of this
work were **rewritten before anything was pushed**, so no blob in this repo ever carried the
account name. A follow-up commit would have left it in the history permanently — which is the
leak, not the working tree.

## Re-recording, if it is ever needed

The recipe, the capture script and the copy script are in
`~/claude-fleet-private/demo-2026-07-30/` (out of repo: it also holds the four sessions' real
diffs, which are worth porting upstream — the `claude-deck` one is a genuine 500→400 boundary
fix for that public repo, and the scratch clones are gone).

Two hard points:

- **Never point a demo instance at the live socket.** The recording ran on `FLEET_PORT=8877`,
  `FLEET_SOCK=fleetdemo`, and a scratch copy of the tree staged by `e2e-stage.sh`, because
  `STATE_FILE`/`STREAM_DIR` follow the *directory*. Also `FLEET_AUTO_REVIEW_MS=0`.
- **Screenshots must be captured at `deviceScaleFactor: 1`.** At DPR 2 xterm doubles the
  glyph advance while the pane still reports 76 columns, so half of every line clips —
  reproduced with the WebGL renderer, with the canvas fallback, and in real Chrome as well as
  bundled Chromium. That is why `docs/screenshot.png` is 1360×860 and not 2720×1720 like the
  file it replaced. A larger viewport would raise resolution but resize the panes off the
  recorded geometry, so it is a real trade, not an oversight.
