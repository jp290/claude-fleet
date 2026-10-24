# Fleet's advanced features

Read this when the person asks what Fleet can do beyond one board on one machine, or wants another computer, a
helper, a test instance, or to share a setup.

Fleet starts as one board on one machine. Three features take it further: more computers, each running its own
Fleet and steered from either one; a test instance to try a change to Fleet itself; and a setup that travels as a
file. Explain each one with the person, including what it isn't, set it up together, and show it working on their
own board.

You aren't limited to what is written here. Fleet is a base to build on, and you can do real work in it. Where it
lacks a path, build one: a script that sets up the second computer, a service file for a system that has none, a
door in Fleet itself on a branch, landed like any other work. Only what needs the person's own password or login,
or makes a session public, is theirs; give them the exact line.

Paths below are in Fleet's repository, the checkout the person installed Fleet from. It holds `ctl.sh`,
`testinstanz.sh` and `fleet.json`; ask the person where it is if you don't know. Line numbers drift, so quote file
and symbol names, and read the code before you quote a default.

Words used below: a **door** is one of Fleet's HTTP routes; **owner** routes and `ctl.sh` verbs need the owner
token. A **lane** is a session that works on its own branch and lands through the merge check; a **branch session**
lands through the branch land door.

## First: reaching Fleet from another machine

More computers and the helper need it.

- **Fleet listens only on `127.0.0.1:8790`** until `FLEET_HOST` names an address (`server/http.ts`). Choose an
  address on a private network the person trusts end to end, such as Tailscale, because the traffic is plain http
  and ws without TLS.
- **A hostname needs `FLEET_ALLOWED_HOSTS`.** Fleet accepts a request only under the `host:port` it expects
  (`server/auth.ts#guard`). If you see `host '…' not allowed — set FLEET_ALLOWED_HOSTS`, that is the reason.
- **Settings live in `.env`** in the checkout: it is gitignored, use `chmod 600`. The watchdog (`watchdog.sh`, the
  service that keeps Fleet's server running) reads it every time it starts the server. So a change acts after a
  restart through the deploy door, which rebuilds and restarts the server:
  `curl -s -X POST -H "authorization: Bearer <owner-token>" http://<fleet-host>:8790/api/deploy`. The verdict
  is at `GET /api/deploys` after the next boot. Never restart by killing the server's tmux session.
- **Every Fleet has its own owner token**, the key `token` in `fleet.json`, or `FLEET_TOKEN`. A browser logs in
  once per address with `http://<fleet-host>:8790/?token=<owner-token>`.

## More computers

**What it is:** a second computer runs a complete Fleet of its own: its own sessions, board and token. An old PC
is enough, because the models run in the cloud; it needs macOS or Linux, Bun, tmux and an agent CLI. The person
gets more agents at once, and work goes on while the other machine sleeps. A chip in the
title row switches between the boards in one click. **What it isn't:** one Fleet spread over two machines. Sessions,
mailbox, token and ledgers stay on each machine. What joins them is git and whoever steers.

### Steering one from the other

- **From the board:** the chip opens the other board, where its own login applies.
- **From a session:** every owner verb of `ctl.sh` works against the other machine when you give it that Fleet's
  address and token:
  `FLEET_CTL_URL=http://<second-machine>:8790 FLEET_CTL_TOKEN=<second-owner-token> ./ctl.sh status`. The same
  works for `get <route>`, `send --orchestrator <file>` and `dispatch`, and `curl` reaches any owner route, such as
  opening a session. So an orchestrator on one machine can run work on the other. Keep the other token in a file
  only the person can read, and never print it.

### How git moves between them

- Each machine has its own checkout and its own `main`. They never pull from each other. Both land into one bare
  repository, the hub, and both pull from it.
- **Landing:** a lane merge pushes the landed commit to the hub before it moves the local `main`. The hub takes
  only a fast-forward, so if the other machine landed first, the push is refused. This machine then pulls the
  hub's `main`, puts the lane on top again, reruns the check and tries again (`hub-lost`). If the hub can't be
  reached, nothing lands and the lane waits (`hub-unreachable`).
- **Following:** `fleet-sync.sh hub` runs on each machine every 15 minutes (`ops/fleet-sync.timer`). It
  fast-forwards `main` from the hub, installs, builds and restarts through the deploy door. It never pushes and
  never resets. Exit 3 means this machine holds commits the hub lacks; exit 4 means it isn't on `main` or the
  tree is dirty.
- **The person's own repositories** reach the hub the same way when they have a git remote of the hub's name;
  otherwise they land only on the machine where they are worked on. `fleet-sync.sh` keeps only Fleet's own
  checkout current.
- **Without a hub,** one machine lands and the other only follows: `FLEET_LANDS=0` makes it refuse lane merges,
  and its sync pulls from the first. Branch lands are the exception (next paragraph).

**Trap:** the branch land door (`POST /api/branches/land`, `server/branch-land.ts#landCharge`) reads neither
setting. It lands even on a machine set to `FLEET_LANDS=0`, and it doesn't push to the hub. After a branch land,
that machine's `main` is ahead of the hub and its sync answers exit 3; a branch land on each machine leaves two
`main`s that have diverged. Probe: compare `git rev-parse main` with `git ls-remote hub main`. Repair, with the
person's yes: `git push hub main` from the machine that is ahead, which the hub takes only as a fast-forward. If
it refuses, the two `main`s have diverged; show the person both sides before anything is merged.

### Setting it up

1. On the second machine: Bun, tmux, git, and an agent CLI that is logged in there, a second login of the person's
   account (for Claude Code: start `claude` once and log in). Clone Fleet, then run `bun install` and
   `bun run build`.
2. In its `.env`: `FLEET_HOST` with its private address, a name in `FLEET_INSTANCE`, and `FLEET_INSTANCES`, a JSON
   list with one `{name, url}` per machine, where `url` is only scheme, host and port:
   `FLEET_INSTANCES='[{"name":"desk","url":"http://<first-address>:8790"},{"name":"cellar","url":"http://<second-address>:8790"}]'`.
   The same line goes on both machines; each board finds itself in it by its address. A bad entry is dropped with
   the startup line `FLEET_INSTANCES: dropped — …`.
3. Start it under the watchdog so it survives crashes and reboots: `ops/fleet-watchdog.service` on Linux (a
   systemd user unit, with `loginctl enable-linger`), `ops/launchd-example.plist` on macOS. The install lines are
   in each file's head.
4. Put the same `FLEET_INSTANCES` line on the first machine and restart it through the deploy door.
5. The hub: on one machine `git init --bare ~/fleet-hub.git` and `git push ~/fleet-hub.git main`. In both
   checkouts add it under one name: `git remote add hub ~/fleet-hub.git` on that machine, and
   `git remote add hub <user>@<that-machine>:fleet-hub.git` (over ssh) on the other. Then set `FLEET_HUB_REMOTE=hub`
   in both `.env` and install the sync units from `ops/fleet-sync.service`, whose head names the settings for both
   machines.

**Works when:** the chip shows `1/2`, its menu marks "you are here", and a click opens the other board.
`./ctl.sh status` answers from both machines. After a land on either, both `main`s match the hub within one sync.

### The helper: a machine that only runs checks

**What it is:** a lighter role for a computer, including one where no agent CLI should log in. It takes the first
machine's checks off it: the audit after each land (the full suite run again on the landed state), the suite run
before a lane merges, and a few build and test commands. A second Fleet doesn't relieve the first one: it checks
only its own work. So one second computer can carry both, a Fleet and a helper, and a machine that should only run
tests carries the helper alone. **What it isn't:** a
general remote runner. The audits it runs are Fleet's own suite. For a session in any repository it runs a command
job from a fixed list (`server/types.ts#HELPER_CMD_ALLOW`: `bun run build`, `bun test`, `bun run verify` and Fleet's
suite scripts), always after `bun install --frozen-lockfile`. The helper fetches its work; Fleet never connects to
it.

1. Read the helper token, which is neither the owner token nor a session token, and no button shows it:
   `curl -s -H "authorization: Bearer <owner-token>" http://<fleet-host>:8790/api/helper/token`.
2. On the helper (Linux with systemd; there is no macOS template yet): Bun, git, tmux and zsh. Write
   `/etc/fleet-helper/config.json` from `helper-daemon/config.example.json` with mode `0600`. The daemon refuses
   any other mode and a `fleetUrl` that carries `?token=`. Install `helper-daemon/fleet-helper.service` by the
   lines in its head.
3. Nothing to register: the helper appears behind the 💻 button with its first heartbeat.
4. To send the audits there, set `FLEET_AUDIT_HELPER_GRACE_MS` to any number above 0 in the first machine's `.env`
   and restart.

**Trap:** despite its name, that setting is an on switch, not a timeout. Once it is on, the first machine never
runs those audits itself, and an audit waits for a helper however long that takes. When no helper is online
(daemon stopped, machine asleep) or its mode is off in the 💻 dialog, audits stand still and show `waiting for
helper` in `GET /api/post-land-audits`. The person brings the helper back (`sudo systemctl restart fleet-helper`
there, or mode active in the dialog), or sets the switch back to 0 and restarts.

A session hands it a job with `POST /api/self/jobs {cmd, timeoutMs}` and reads `GET /api/self/jobs/<id>`
(`docs/self-api.md`).

**Works when:** `journalctl -u fleet-helper -n 3` shows `helper-daemon up: …`, the 💻 dialog shows it online with
its mode and suite slots, and `./ctl.sh status` prints a `helper` line.

## A test instance

**What it is:** a throwaway copy of a Fleet checkout or worktree that runs as its own Fleet, on its own port, with
demo data. It is for clicking through a change to Fleet before it lands, and the live Fleet stays untouched.
**What it isn't:** a sandbox for the person's own repository. It copies the checkout that holds the script. For a
risky change in their own repository, a branch session is the place: it works in its own worktree, and its work
reaches `main` only through the land door (`your-seat-in-fleet`).

- `./testinstanz.sh up --ttl <min>` prints `TESTINSTANZ UP http://…/?token=…`; then use `refresh` to bring in
  new changes, `list` to see all instances, and `down` to stop one. `down` refuses while a browser is still
  connected; `down --force` stops it anyway.
- No agent starts in it unless you pass `--real-seats`.
- **Trap:** `status` prints the link with its token. Never paste that output into a report or a shared text.

**Works when:** the instance's board shows a band naming the branch and state it shows, and the live board's chip
gains a `⇄` switch to it.

## Sharing a setup

**What it is:** an agent the person made travels as one file, `<name>.fleet-agent.json`: its model and effort, its
rights, its packs, its own instructions (the Agent-MD), and what it leaves out of the person's own setup. Another
Fleet imports it and starts it with the same hash, the fingerprint of everything its start reads. In the start
window, **Share…** on the person's own agent downloads the file and **Import…** takes it in; a built-in agent is
copied first. A whole team of seats travels the same way from the build view, whose button reads
**Exportieren**. What travels is the setup; the task stays with whoever takes it.

- **The sender reads the warnings first.** Share warns about machine paths, addresses, tokens and the machine's
  name inside the file, and doesn't block them. To remove one, edit the agent's text in the start window and
  share again.
- **Trap for the receiver:** an imported agent never starts with permission prompts bypassed
  (`bypassPermissions`), and its rights arrive capped at the level "Builds" until the receiver edits it
  (`server/agenten.ts`). If it can't do something after import, that cap is the reason, and it is not a bug.
- **A live share link is something else** (`SHARING.md`): a password-gated, view-only window onto one running
  session for a guest, whose input never reaches the session. It needs a public hostname routed to Fleet. Making a
  session public is the person's decision.

**Works when:** the imported agent lists as imported and its start window shows "derived from <hash>".

## Smaller ones

- **Phone:** the same board becomes a phone layout below 700 px, over the address from `FLEET_HOST`.
- **Remote Control:** a seat opened with `remote` shows up in the person's Claude app.
- Handover, notebook and the agent's own stones are in `building-an-agent`. Landing and the mailbox are in
  `your-seat-in-fleet`.

## Done

The person sees the feature work on their own board: the other computer in the chip and answering `ctl.sh`, the
helper online behind 💻, the test instance's band, or the imported agent starting with its hash. No real host,
address or token went into any file or report on the way.
