# Working inside Fleet's fence

Read this when a step fails in a way that smells like the environment: a fixture asking for `~/claude-fleet`, a missing
`/var`, a chmod or a mount, nowhere to put a USB device, or a `fleet.json` that looks like an empty character device.

## What the fence is

A pi seat (`pi-zai`, `pi-deepseek`) runs behind bwrap — owner decision 2026-10-26: „[Zitat entfernt]“. Inside it: `/` is a read-only tmpfs, `/dev` is fresh (so no `/dev/bus/usb`), `$HOME` is a per-session
temp dir, and the only writable bind is the repository — or the one worktree, if you sit on a board branch. Owner
secrets, other sessions, their process environments and the live tmux socket are denied; the network is open.

## What that costs, and what it does not

- **Fine inside the fence:** `bun test`, typecheck, build, git in your own worktree, your branch's ref, `tmux`,
  `chromium`, playwright — a fenced seat can run the repo's own suite.
- **NOT faithful inside the fence: Fleet's own merge check.** `ci/merge-check.ts` spawns `e2e-isolated.sh`, whose base
  fixture opens `POST /api/slots/1/open { cwd: "~/claude-fleet" }`. Your `~` is the sandbox: the door answers 400, the
  shard dies in five seconds, and the verdict reads as a red gate. Measured 2026-10-28: three of four audit shards
  failed this way while `local`, `gate` and `review` were green — the check was fine, the runner's HOME was not.
  The faithful runner is the server's own door (`POST /api/self/branches/check`): it runs with the host's HOME.
- **Out of reach:** the owner's home (`~/ci`, `~/.claude`, `~/seat-home`), other sessions' panes, the live tmux socket,
  USB and the owner's `fleet.json`/`.env` (they show up as a character device `1,3` — that is „[Zitat entfernt]“, not
  „broken"). A step that needs one of those is not yours: say so in one sentence and name the exact step for the owner.

## The trap

A red run from inside the fence looks like a broken gate, and it costs an hour if you believe it. Before you trust any
e2e verdict, check `echo $HOME` and whether `~/claude-fleet` exists. If it does not, the verdict is about your sandbox,
not about the branch — and the honest sentence to the owner is: „[Zitat entfernt]“.
