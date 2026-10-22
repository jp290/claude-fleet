# Running Fleet

Read this before you land, deploy, judge a red audit, touch the helper, or act on a live session or test
instance. It covers how these acts work here and the traps that have cost real time.

Fleet runs on the machine you are working on. A land, a deploy or a kill reaches every session on it, so each of
these acts has one door, and the door tells you when it refuses. Use the door, read its answer, and act once.

## Landing

- **The merge check runs against the entry's base.** The land door compares your check with the board entry's
  `chargeBase` (the tip of the last land, else the entry's base, else main). A check against a resolved `main` SHA
  counts as stale and the land answers 409. Read the field with `./ctl.sh get /api/branches` and pass exactly that
  value as `--base`, or let the board door `POST /api/branches/check` do it. A branch session has no self door
  there; the orchestrator starts that check.
- **A weight in the shard table reshuffles the whole plan.** `e2e/ctx.ts#SHARD_UNITS` is split greedily by
  `seconds`, so one changed weight can move a dozen units to another shard and run modules in a new order in the
  same instance. Before you commit a weight, diff `shardPlan` old against new and name the modules that now run
  before one that counts the instance's absolute state.
- **Gate fixtures cut `server.ts` as text.** `fleet-e2e-harness.ts` slices `openSlot`, `respawnInPlace`,
  `respawnLost`, `rebindLaneAnchors` and the succession closure `=> openSlot(...)` out of the source and runs them
  in a scope of its own. A new slot map or a new `carried*` variable they use belongs in that scope too, and the
  closure must not contain `"),\n"` before its end, because the cut stops there. `./e2e-claude-gate.sh` runs these
  fixtures, and the merge check runs it as its job `gate`; on a red there, read that job's log for the fixture.
- **Land under a quiet host.** Lands die at the verify budget once the load average climbs past about 30 and pass
  below 20; the owner set the line at a 5-minute load under 25. Before you land into a busy host, find orphaned
  suite leftovers first (a parent wrapper that is gone, a tmux server nobody uses) and end them by PID or socket,
  never by name pattern, and never touch a test instance. Between 20 and 25, name the load driver in your report:
  a finite job such as a measurement is fine, leftovers are not. `./ctl.sh merges` must show nothing in flight.
- **Braces in every refspec.** The shell here is zsh, which reads `$SHA:refs/...` as a history modifier and eats
  the `:r`. Write `"${SHA}:refs/heads/x"` and `"${SHA}:path"`, and after a push to the hub confirm with
  `git ls-remote <hub> refs/heads/main`.

## Deploying

- **Trigger a deploy once.** `POST /api/deploy` answers 202 with `stage: "restarting"` on success; the verdict
  comes with the next boot at `GET /api/deploys` (`ok`, `hitTarget`). A loop that waits for a 200 deploys again
  and again. Stop on every answer and read it. A 409 is a refusal at `stage: "preflight"`, and its `reason` names
  the blocker: a deploy already building or in flight, a land, audit, succession or founding in flight, an
  unreadable HEAD, or a tip not audited yet (then `next` says what to do). A failed build is a 500 at
  `stage: "build"`, and the running server is untouched. Act on the reason; a loop over any 409 can wait forever.
- **An unaudited tip doesn't wait for the night.** With helper audits, the full audit after a land waits for a
  quiet window or the nightly run (`server.ts#AUDIT_QUIET_MS`, `#AUDIT_NIGHTLY_AT`). The deploy door doesn't wait:
  it goes out on the youngest green-audited ancestor's word when every land since then passed the full gate
  (`unaudited: gate-only`, `server.ts#deployGateOnlyOf`), and otherwise answers 409; either way it queues the tip's
  full audit at once (`server.ts#deployAuditOf`). A direct commit or a land that ran only the docs or source gate
  breaks that chain, and the deploy then waits for the tip's own audit. A red tip without a verdict queues
  nothing: judge it first.
- **Check the helper's claims yourself.** The server refuses a deploy while a local audit, a land or a succession
  is in flight, but it does not see a helper that has just claimed the shards of a waiting audit. In the same
  command as the deploy, read `./ctl.sh audits --last 1` (the `live:` line must say idle) and the tail of
  `audit.jsonl` for a `helper_claim` without a later `helper_result`. On a hit, don't fire.

## Judging red audits

A red audit without a verdict stays with the owner, and he wants out of that loop. The orchestrator judges it
through her own door, `POST /api/self/post-land-audits/adjudicate {at, verdict, note}` (`at` is the audit row's
`at`; the note has room for the evidence: the check's name, the rerun's line, the fix SHA). The row names her slot
as `by`. Every other session gets a 409 there; a MAIN raises attention instead. The owner door,
`POST /api/post-land-audits/adjudicate`, stamps `by: "owner"`: a verdict typed there with the owner credential
reads as his.

- A reading subagent builds the history per failing check from `post-land-audits.jsonl` and
  `audit-adjudications.jsonl`: green again later, a fix commit, name still in the tree, a known flake family. You
  read the deviations from the owner's precedent and post each line.
- **Only the owner's `flake` carries.** For 14 days a flake verdict from the owner door applies itself to every
  later red with the same single signature (`server.ts#carryFlakeReading`), so a flake there without a proven
  cause hides a return. A verdict through the orchestrator's door never carries; each red needs its own. Either
  way, intermittent red without fix and cause is `unknowable`; `stale-test` where the owner already judged that
  signature so; mixed rows are `real`.
- A repair candidate goes to a lane as material, not as a verdict.

## The helper

- **A daemon update drains the helper.** `POST /api/helper/devices/<id>/update` lets nothing else start until
  `running` is 0, then restarts the daemon. Queue it when `./ctl.sh merges` is empty, best right after a green
  audit, and bundle setting changes into one update, because they take effect only on restart. Watch
  `helperDevices[].daemonSha` on `/api/sessions` until it shows the target.
- **Read the audit state, don't wait for it.** On a helper-only audit deployment a waiting audit never runs on the
  Mac, and an audit that only the new daemon may claim can't go idle before the update. "First idle, then update"
  deadlocks there.
- Facts about this machine's helper, its address, waking and power, are local knowledge:
  `~/local-notes/this-machine.md`.

## Acting on live sessions and instances

- **Read the session's own brief first.** Before `POST /api/slots/<n>/model` or any other act on a session that
  isn't yours, read its pane for younger owner words. The owner credential carries no speaker, so your act looks
  like his, and a brief he gave that session beats your record of his policy. If they disagree, the question goes
  to him.
- **A lane that waits hours on its MAIN may wait on an unsent line.** Read the MAIN's input line, the `❯` between
  the two rules at the bottom. A pasted delivery that was never sent goes out with one Enter. An occupied composer
  blocks every delivery, your own included: `grep -c 'composer occupied' server.log`, and check your own line.
- **Write to a seat through the mailbox, as its counterpart.** To a branch session you opened, write freely; the
  opener is matched by slot and folder, so your successor on the same slot keeps the pair. To any other session the
  orchestrator writes only a reply, with `replyTo` on a message from its current occupant; anything else is a 409.
- **Stop a test instance through its door.** `./testinstanz.sh down` refuses while a connection is open, because
  an open connection is somebody looking, most likely the owner's tab. Never kill one by tmux socket or PID. Age and
  „[Zitat entfernt]“ don't prove nobody looks.

## Reading state without leaking

- **Print named fields only.** A pane's command line exports its self credential, so `ps` with arguments and any
  `grep` over them prints tokens, cut or not. Search processes with `pgrep -x <name>` or `ps -eo pid,etime,comm`,
  and take their origin from `lsof -a -p <pid> -d cwd -Fn`. Read JSON by the field you chose beforehand and skip
  every key with `token` or `secret` in its name.
- **Prove a leak with a request.** The served directory of a file server is in its `--directory` argument, not its
  cwd. Before you report one as exposing the checkout, request a sensitive path and look for a 404.
- **A write door commits.** A decision route (accept, reject, land, release) is write-once, so a diagnostic call
  with a dummy body is the act. On a 400, print the response body and fix the input; a decision reason stays under
  500 characters. Before you probe a door for a refusal, prove the refusal's precondition with a GET, and point
  `repo` at a fixture, never at the real checkout.
