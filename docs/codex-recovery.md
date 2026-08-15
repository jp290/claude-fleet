# Codex conversation recovery

Fleet cannot give a fresh Codex TUI a session id: Codex creates its rollout only after the first
prompt. Recovery therefore has two separate seams—lazy identity discovery while the pane lives,
then exact-id resume only after that pane dies. No path replays a prompt, uses `--last`, or chooses
the newest conversation.

## State machine

| State | Meaning | Transition |
|---|---|---|
| `pending` | This Codex pane has no mechanically bound rollout yet. | Each git tick scans only date directories covering `paneSpawnedAt - 5s .. now`; the owner may instead bind one fully revalidated attended candidate. |
| `bound` | Exactly one eligible rollout supplied a strict UUID. | A dead pane may run `codex resume '<id>'`; a live pane is never duplicated. |
| `ambiguous` | Two or more eligible rollouts exist. | Preserved across automatic pane heals. Fleet does not guess; an attended exact bind resolves it, while deliberate recycling starts a new pane life. |
| `lost` | A bound id no longer has an exact `rollout-*-<id>.jsonl` suffix. | An attended exact bind may replace the lost id after full validation; deliberate recycling starts clean. Fleet never guesses. |

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

## Attended bind (v1.1)

The owner can open the `cx` chip and explicitly load eligible identities from
`GET /api/slots/:id/codex-candidates`. This attended inventory uses the same first-line-only,
strict-UUID, filename-suffix, `thread_source: "user"`, and exact-cwd evidence as lazy discovery,
but deliberately has no pane-lifetime window: its purpose is to recover an older or manually
resumed conversation that v1 cannot identify. Results are stably newest-first, capped with honest
`total`/`truncated` fields, and contain only UUID plus timestamp. A missing or unreadable sessions
root is `sessionsRoot: false` with an unknown total, not an empty candidate set. Identities pinned
to another active slot are reported separately as `boundElsewhere` and cannot be selected.

`POST /api/slots/:id/codex-bind` accepts one exact UUID and revalidates every invariant at the
write seam: active Codex slot, strict UUID, exact rollout suffix still present, matching user-thread
first record and cwd, and no binding on another active slot. A same-id bind is idempotent. A slot
already `bound` to a different id refuses the change; the owner must deliberately recycle before
switching conversations. Successful binds reuse only the persisted `sessionId` and
`codexRecoveryState: "bound"` fields and leave an audit fact, so they survive server restart
without a new register.

Binding a live slot only persists the choice: it never spawns, sends, kills, replays, or types into
the pane. Binding while its pane is dead still does not spawn from the route; the existing heal
loop reaches `ensureSlot`, rechecks the exact rollout, and resumes through the sole adapter-spawn
seam. Closing or genuinely recycling a slot clears the bind, pane anchor, recovery state, and
disconnect advisory exactly as before.

## Owner surface and limits

The owner poll carries `codexRecovery: { state, sessionId, disconnectSeenAt }` on every active Codex
row, and the client renders the state and opens the attended identity chooser from that chip. A
rendered `stream disconnected before completion` stamps the advisory timestamp only. The live TUI
owns its retry; connection text never triggers resume. Recovery applies to Codex only and
intentionally adds no transcript reader, prompt replay, cleanup policy, automatic candidate
refresh, recency fallback, or general harness-recovery framework.
