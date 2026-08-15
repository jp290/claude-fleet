# Codex conversation recovery

Fleet cannot give a fresh Codex TUI a session id: Codex creates its rollout only after the first
prompt. Recovery therefore has two separate seams—lazy identity discovery while the pane lives,
then exact-id resume only after that pane dies. No path replays a prompt, uses `--last`, or chooses
the newest conversation.

## State machine

| State | Meaning | Transition |
|---|---|---|
| `pending` | This Codex pane has no mechanically bound rollout yet. | Each git tick scans only date directories covering `paneSpawnedAt - 5s .. now`. |
| `bound` | Exactly one eligible rollout supplied a strict UUID. | A dead pane may run `codex resume '<id>'`; a live pane is never duplicated. |
| `ambiguous` | Two or more eligible rollouts exist. | Terminal and preserved across automatic pane heals. Fleet does not guess; deliberate recycling starts a new pane life. |
| `lost` | A bound id no longer has an exact `rollout-*-<id>.jsonl` suffix. | Terminal until owner recycling. Fleet may show a fresh TUI, but the owner poll says the previous conversation was not automatically recoverable. |

An eligible first record is `session_meta` with `payload.thread_source === "user"`, an exact string
match on `payload.cwd`, a timestamp inside the pane window, a strict UUID id matching the filename
suffix, and an id not pinned to another active slot. `subagent` threads never qualify. Fleet reads
and caches only line one; rollout bodies are never scanned.

The sessions root defaults to `$HOME/.codex/sessions`. Controlled suites set
`FLEET_CODEX_SESSIONS_DIR` to a scratch tree containing synthetic first records, so tests never
touch a real Codex conversation.

## Resume and single-writer boundary

`ensureSlot` is the only adapter-spawn caller. It reaches the resume form only after tmux
`has-session` failed; the explicit restart route kills the pane before entering the same seam.
Thus a resume cannot create a second writer beside a live conversation. Before a UUID reaches the
shell, Fleet both validates its format and finds the filename carrying that exact suffix across
Codex's date tree. Model, reasoning-effort, trust prelude, full-access flag, and shell fallback are
the same as fresh spawn.

Measured with codex-cli 0.147.0: `codex resume <missing-uuid>` prints `No saved session found with
ID …` and exits; it is not a picker or another blocking TUI screen. Fleet therefore decides loss
before spawn rather than extending readiness markers.

## Owner surface and limits

The owner poll carries `codexRecovery: { state, sessionId, disconnectSeenAt }` on every active Codex
row, and the client renders the state on that row. A rendered `stream disconnected before
completion` stamps the advisory timestamp only. The live TUI owns its retry; connection text never
triggers resume. Recovery applies to Codex only and intentionally adds no transcript reader,
prompt replay, cleanup policy, recovery button, or general harness-recovery framework.
