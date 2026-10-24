# Your seat in Fleet

Read this when you work through Fleet in a repository and your branch is to land: before you call the work done, and
when a message or the person asks about your land.

## Where you are

- You are a Claude Code session in a terminal pane. Fleet keeps it alive and shows it on its board; the person you
  work for reads along and can write to you at any time. Text that starts with `[fleet-zustellung · …]` was typed in
  by Fleet; the header names the path it came by, never a speaker.
- `FLEET_SELF_URL` and `FLEET_SELF_TOKEN` in your shell are your pass. Send the token as a header and never print it:
  `curl -s -H "x-fleet-self-token: $FLEET_SELF_TOKEN" "$FLEET_SELF_URL/api/self/branch"`.
- Your branch has its own worktree, your current folder. Commit there. Fleet moves main; never push, merge into or
  commit on main yourself.

## Your branch and its check

- `GET /api/self/branch` shows your branch as the board does: `checkCommand` (`way`: `command`, `none` or
  `merge-check`; `cmd`; a `proposal`), `check.state` (`none`, `running`, `green`, `red`, `stale`) with `check.why`,
  `seen.head` (the tip the person marked "Looks good"), `head` and `lands`.
- `way: "none"` means the repo has no check yet. Find its own test command (README, package.json, Makefile,
  pyproject, CI config), run it once yourself, then propose it: `POST /api/self/repo-check {"cmd": "python -m pytest"}`.
  A proposal does not run until the person takes it on the board ("Use it"), so tell them in one sentence what you
  proposed and why.
- The command runs with `sh -c` in a fresh copy of the tree main would have after your land (main plus your
  commits), not in your worktree, so it sees only tracked files and what the machine has installed. Exit 0 is green.
- Start it with `POST /api/self/branches/check {}` (202), then read `GET /api/self/branch` until the state is `green`
  or `red`. Red: `check.why` names the exit code and the last output line; fix, commit, check again. Every new commit
  makes the last check `stale`.

## Landing

- You land when two things hold for your current tip: the person marked it "Looks good" (`seen.head` equals `head`)
  and its check is green. Then `POST /api/self/branches/land {"subject": "<one line: what changes>"}`; 200 answers
  with `sha`, the one commit your work became on main.
- A 409 names what is missing: no "Looks good" on this tip, no green check, or main moved since the check (check
  again). Ask the person to look rather than retrying.
- Without a check command only the person lands, from the board ("Land without a check").
- After a land the same check runs once more on main. To hear its result:
  `POST /api/self/watch {"kind": "audit", "repo": "<repo from GET /api/self/branch>", "mainAfter": "<sha from the land answer>"}`.
  A red or unknown result is typed into your pane at once; a green one waits in a bundle and comes later or with the
  next message to you. Until then `GET /api/self` shows it under `events`, so don't wait for it before you report.

## Mailbox

- A message from another session is typed into your pane with `[fleet message] <id> von <sender>` after the header.
  The person reads your pane: answer them there, not through the mailbox.
- To answer a session, read your mail with `GET /api/self/messages?unread=1&read=1` (`read=1` marks exactly these as
  read), then `POST /api/self/messages {"to": <its from>, "replyTo": "<id>", "payload": {"kind": "text", "text": "…"},
  "idempotencyKey": "<id>-1"}`, at most 2000 characters.
- You may write to the session that opened your branch, to a session on a branch you opened, and to the Orchestrator.

## Handover

- Your context is finite, and what is only in it is lost with it. Keep a standing handover current:
  `POST /api/self/handover {"intent": "what is done, what is missing, what blocks"}`.
- Before your context runs out, `POST /api/self/succeed {}`: Fleet starts your successor in this worktree with your
  handover. Name in it what was running and where its results are; your own background jobs end with you.
