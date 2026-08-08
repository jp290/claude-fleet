# Running Fleet in a container

What the `Dockerfile` is for, what `./docker-verify.sh` actually attests, and the three
traps that each look like a different bug than they are.

## Why the whole app, never the slots

Fleet welds four things together through the filesystem: the pane byte stream (`streams/<n>`,
written by tmux's `pipe-pane`, read by the server), the agent transcript
(`~/.claude/projects/<cwd-slug>/<uuid>.jsonl`, written by `claude`, read by the server —
`projDir`, `server.ts:361`), and the git worktrees the server and the agent both operate on.
Server, tmux, claude and git therefore need one filesystem **and one path vocabulary**.

A boundary can go around that bundle. A boundary *through* it blinds every transcript-derived
feature at once — the conversation view, `transcriptFact`, `laneDoneLooking`, the digest,
auto-③ — and still leaves Fleet's own workers (merge resolver, reviewers) outside the box,
which is the half that acts unattended. It is not mechanically impossible: give the container
the same `$HOME` and mount the worktree at the *identical* path and `projDir` resolves. It is
self-defeating, which is different — you would be handing back exactly what the container is for.

## The `container` harness — a different cut, not that one

The section above rejects a boundary *through* the bundle. The `container` adapter
(`CONTAINER_HARNESS`, `server.ts`) draws one somewhere else, and the distinction is the whole
reason it exists rather than being the idea already refused here.

What stays on the host: **tmux** (the pane is a host pane; the agent is a child of it through
`docker exec`, so `send-keys`/`capture-pane`/`pipe-pane` are untouched) and **git** (`git -C
<worktree>` still reads the real tree, so ahead/dirty, `doneLooking`, the land path and
`/api/self/drift` all keep working). Fleet's own unattended workers — merge resolver, reviewers,
summarizer — also stay on the host, which is the half the section above objects to leaving
outside: here they are *supposed* to be outside, because the thing being sandboxed is the
interactive agent, not Fleet.

What falls: **the transcript**, and only that. The agent inside writes
`~/.claude/projects/<slug>/<uuid>.jsonl` against the *container's* `$HOME`, while `projDir` reads
the host's — so `supports.transcript` is `false` and the conversation view, `transcriptFact`, the
summary and auto-③ degrade visibly instead of reading emptiness as fact. The trap is sharper
than for the Pi adapter: the mount is at the **identical path**, so the projDir slug is identical
too, and `transcriptFile`'s newest-by-mtime fallback would hand the slot an earlier *host-side*
conversation from the same worktree and label it this session's.

The adapter's other answers, each an owner-visible fact rather than a default:

- **`automatable: false`.** No unattended path (autos, dispatch, steward sends, done-looking,
  auto-③) may drive a container slot — and unlike Pi, that holds even with
  `FLEET_HARNESS_AUTOMATION=1`. The owner decision has not been made, so it fails closed.
- **`comms: ["docker"]`.** The liveness probe walks the *host* pane's process tree, and the agent
  is in another pid namespace (inside colima's VM, on this machine). The `docker exec` client is
  what the host can see, and it exits when the agent inside exits.
- **The docker context is pinned, never ambient** (`FLEET_CONTAINER_CONTEXT`, now the *default* —
  see "Per slot, not per fleet" below).
  This is the same rule `guest-ctl.sh` states for the guest containers, and it is not theoretical:
  measured 2026-08-08, this machine has three contexts (`default`, `colima`, `colima-fleetguest`)
  and the **active one is `colima-fleetguest`** — the VM running two live guest containers. An
  unpinned `docker exec` would land there, and would move the next time the operator switches
  context. The default is deliberately the neutral `default` rather than the guests' VM: see the
  decision below.
- **`supports.selfSchedule: false`**, by construction: `docker exec` does not inherit the client's
  environment, so `FLEET_SELF_TOKEN` — exported into the host pane — never reaches the agent.
- **The model charset is not widened** (`modelRe: null`, i.e. the same rule a default slot gets).
  The command inside the box *is* `agentCmd`'s, so a wider charset would admit names that same
  binary rejects on the host.

### What Fleet does not do, and the two things you must do

Stage 1 by owner decision: **Fleet never creates, starts, mounts or probes the container.** A
missing one is a docker error printed in the pane, followed by `; exec $SHELL` — the pane survives
and shows what is wrong. The adapter's `note` says this at pick time.

So the operator owes it two things, and the second is the one that bites:

1. A running container, named by the slot's `container` (fleet default `FLEET_CONTAINER`, itself
   defaulting to `fleet`), **on the daemon named by the slot's `containerContext`** (fleet default
   `FLEET_CONTAINER_CONTEXT` → `default`). Those two travel together: an image lives in one daemon, so
   `claude-fleet:guest` (912 MB, built in the `fleetguest` VM) exists on `colima-fleetguest` and
   nowhere else. Pinning a context whose daemon lacks the image is the same failure as naming a
   container that does not exist.
2. The worktree bind-mounted at the **identical path**. `spawnCmd` passes `-w "$PWD"`, i.e. the
   pane's own host cwd. Mounting it anywhere else makes every `docker exec` fail with a bad
   working directory, and it would also break the only thing that keeps host git and the
   in-container agent talking about one tree.

### Bind-mount, not named volumes — the one thing not to copy from the guest prototype

Fleet already runs containers on this machine, and it is tempting to reuse their shape. Do not
reuse this part of it. A guest container (`guest-ctl.sh provision`) hangs off **three named
volumes** — `<ctr>-state` → `/home/fleet/claude-fleet`, `<ctr>-work` → `/home/fleet/work`,
`<ctr>-claude` → the `CLAUDE_CONFIG_DIR`. They are named volumes *because* they survive
`docker rm`: that persistence is the guest's identity, and the whole point is that their work is
not the owner's tree.

A slot container needs the exact opposite. The worktree must **be** the host worktree, because
every number Fleet reports about that slot comes from `git -C <worktree>` on the host — `ahead`,
`dirty`, `doneLooking`, the diff, the land path. On a named volume all of those would still be
computed and still be displayed, and would describe a tree nobody can land. That failure is
silent, and it looks like the agent doing nothing.

### ...but a worktree is not a thing you can hand over, and that is what the clone form is for

The section above says *which tree* to mount. It does not answer whether a worktree can be mounted
at all, and measured at the tree on 2026-08-08 it cannot — not alone:

- A lane's `.git` is a **file**, one line: `gitdir: /…/claude-fleet/.git/worktrees/<name>`.
  `git rev-parse --git-common-dir` from inside the lane points at the primary's `.git` (98 MB).
  Mount only the lane and the agent gets a directory git refuses to work in — no status, no index,
  no commit.
- Mount the common dir alongside it and the agent gets **`.git/hooks`**, which for a worktree
  lives in the common dir. A `post-commit` written there runs **on the host, under the owner's
  uid, at his next commit**. `.git/config` (aliases, `core.pager`, `fsmonitor`) is the same vector.
  Covering each read-only is whack-a-mole against a set git deliberately keeps open, and a sandbox
  whose first act is to open an escape route is not one.

So a lane gets a second FORM: `POST /api/lanes {repo, form:"clone"}` makes the working copy a full
`git clone --no-hardlinks` — own object database, own hooks, own config, **one self-contained
directory**, which is the shape a bind-mount needs. `--no-hardlinks` is the point, not a tuning
knob: the default local-clone optimisation hardlinks the object files and would re-share the very
bytes the form removes (~98 MB of objects per clone on this repo, against 36 GB free).

**Clones sit ALONGSIDE worktrees.** An absent `form` still resolves to `worktree` — down to the
absent `form` field in `fleet.json`, asserted as its own check — for every harness that has no
opinion, which is claude, pi and the container adapter. Nothing that existed before this becomes a
clone.

**Who chooses, since 2026-08-08: the ADAPTER, on absence only.** `Harness.laneForm` (`null` = no
opinion, `"clone"` for Codex) is consulted by exactly one function, `laneFormOf`, and an explicit
`form` in the request wins over it — so a Codex lane in worktree form stays legal, it simply cannot
commit itself. That is why this is a *preference* and not modelled like `container`/`containerContext`,
which a harness that cannot serve them rejects with 400. All three lane-creating paths ask the one
function: `POST /api/lanes`, `POST /api/slots/:id/open-worktree` and `dispatchTask` (which has no
request body at all, so it is the pure absence case). Two pins hold it: every `createWorktree` call
site passes a form, and every form it passes came from `laneFormOf` rather than from a second
`if harness === …` derivation somewhere down a road nobody re-reads.

#### The one seam: the branch is mirrored, in both directions

Everything Fleet knows about a lane is read either **root-side by branch name** (drift,
`worktreeRisk`, `branch --merged`, the ancestry check, `advanceIntegration`) or **tree-side against
the base branch** (the git tick's ahead/behind, `tryScriptRebase`). A worktree satisfies both at
once by sharing refs; a clone satisfies neither. `syncLaneRefs` is the whole answer, and it is why
this is one seam rather than a rewrite: the root gets `refs/heads/<branch>` at the clone's tip, the
clone gets its local base branch at the root's tip, and **every existing caller is unchanged**.

Forced in both directions, each for its own reason: a rebase rewrites the lane branch (so the
push-back is not a fast-forward) and `undo-land` rewinds main (so the pull-down is not one either).
Neither ref is ever committed to on the side it is written. Objects travel clone → root only, the
trusted direction — the clone never gains a path to the root's hooks, config or object database,
and the fetch runs from the host, so that stays true even when the clone is mounted into a sandbox
that cannot see the root.

It runs at spawn, on the git tick (skipped while the lane's git is mid-operation, the same guard
the merge cache uses), at every land site, and inside `removeWorktreeSafe` — that last one
**fatally on failure**: "is this work preserved" is answered root-side, and a clone has no `git
worktree remove` behind it to refuse a dirty tree, so the two safety checks are the whole guard and
they must not run on a stale ref.

Measured, not predicted: the first clone land failed at `merge-base --is-ancestor main branch` —
root-side, run before the mirror caught up — and reported a perfectly rebased lane as *"reported
rebased, but the lane is not rebased onto main"*, blaming the agent for a ref that had not moved.
That call site is now the earliest of the land-path syncs, and a pin holds every
`advanceIntegration` call site to having one before it.

#### What it costs, said out loud

Root-side numbers about a clone lane are read off a mirror and can be a moment old. `GET
/api/self/drift` therefore carries **`stale`** — `false` for every worktree lane (there is no copy
to be stale), `true` when the mirror no longer matches the clone, `null` for undetermined, which is
never "fresh". Reported, not repaired: `laneDrift` is deliberately read-only against a live lane;
the tick does the repairing. The `self_drift` audit row carries it too, so the ledger cannot come
to hold confident numbers about a lane version that no longer exists.

The other abandoned assumption: **`git worktree list` cannot see a clone lane.** The lane map (`GET
/api/slots/:id/worktrees`) adds live clone lanes back and anchors on the recorded repo — from a
clone, `--show-toplevel` is the clone itself. `state.sh` does the same for its "lanes on disk"
section and for its own anchor (from a clone lane the common dir leads to the clone, so it falls
back to `origin`). Unlike a worktree there is no on-disk registry, so a killed clone lane leaves a
directory nothing will rediscover as an orphan.

#### The second customer

This is not container-only, which is why it comes first. **Guest mode** has the same problem from
the other side: a guest works in a named volume (`fleet-guest-work`), i.e. nowhere — it cannot work
on *this* repo at all. The clone is the mechanism that gives a guest a real working copy without
handing over the object database and the hooks. One mechanism, two customers.

#### The third customer, and the one that arrived first: Codex

Measured on the first real Codex lane (2026-08-08, slot 9): `git commit` died on
`fatal: Unable to create '<main>/.git/worktrees/<lane>/index.lock': Operation not permitted`.
Codex's `--sandbox workspace-write` fences **writes** to `[workdir, /tmp, $TMPDIR]`, and a linked
worktree's metadata lives in the primary repo — outside all three. A lane that cannot commit cannot
land, and it fails in the quietest way this system has: the tree is right, the work is there, the
board says `idle`.

Note what this customer is *not*. There is no container and no mount here — the sandbox is a write
filter around a process on the host. The clone form answers it anyway, and for the same one reason
it answers the other two: the working copy is self-contained, so its `.git` is inside the workdir
and an ordinary write. That is the argument for `Harness.laneForm` sitting on the adapter — the
next harness with a write fence gets the right form without anyone remembering to ask for it.

Still open and deliberately untouched here: a Codex lane's sandbox also blocks tmux and the network,
so it cannot run the suites or `curl /api/self/drift`. Not blocking — the land gate runs
**server-side**, the in-lane suites are preview — but it means such a lane produces and cannot
self-verify. Widening the sandbox hands back reach and is an owner decision.

### The undecided part: which VM

Measured 2026-08-08 (`colima list`): `default` Stopped (2 CPU / 8 GiB), `fleetbuild` Stopped
(2 / 2 GiB), `fleetguest` **Running** (2 CPU / 2 GiB / 20 GiB, aarch64) with both guest containers
in it. So "put slot containers in the running VM" means sharing 2 GiB and 2 CPUs with two other
people's live sessions, in the same daemon as containers that hold their credentials and run with
`NET_ADMIN`. The alternative is a dedicated profile — `guest-ctl.sh`'s own note prices a second VM
at roughly 200 MB of host RAM at idle, a second container at ~25 MB.

That is a resource-and-blast-radius decision, so the adapter does not take it: it defaults to the
neutral `default` context, which fails visibly rather than quietly borrowing the guests' VM. Set
`FLEET_CONTAINER_CONTEXT` for the fleet, or the slot's own `containerContext` for one session.

## Per slot, not per fleet (2026-08-08)

`container` and `containerContext` are **spawn options on the slot**, exactly like `model`:
`POST /api/slots/:id/open`, `POST /api/slots/:id/open-worktree` and `POST /api/lanes` take them in
the body, the picker offers them, and `GET /api/sessions` reports the **resolved** pair on every
slot whose harness has a container concept. Before this they were two module constants read once
from the process env — so "which VM did I get" was a question about `watchdog.sh`, not about the
session, and changing it meant a `launchctl kickstart`.

Four properties this keeps, each of which a per-slot field could have quietly lost:

- **Absence still means the neutral default**, never docker's ambient context. Each half falls back
  on its own, so naming only a context means "the usual box, over in that VM".
- **A bad value is a 400, not a fold to the default.** The env path folds on purpose — one typo in
  `watchdog.sh` must not kill every container slot at boot — but a spawn request is one owner's one
  click, and folding it would open a box other than the one they named.
- **Naming a box for a harness that has none is refused**, not dropped: dropping it would leave the
  owner believing a session is contained when it is not.
- **The pair is persisted** (`fleet.json`) and re-read against both the harness and the charset, so
  a pane respawn re-enters the same container and a hand-edited state file cannot put a value into
  a tmux line that a request could not.

The catalogue's `note` therefore names the two values **as defaults** rather than as this fleet's
answer — a note phrased fleet-wide would be false for any slot that chose its own. Runtime proof:
`e2e/security.ts` §6d2, whose load-bearing row is *two slots on different boxes at the same time*;
source proof that the spawn line cannot go back to the constant: `e2e/pins.ts`.

What did **not** change: Fleet still never creates, starts, mounts or probes a container, and
`automatable` is still `false`. And the image↔daemon coupling above is still the operator's to get
right — Fleet cannot tell you a context lacks your image, because it never asks docker anything;
you find out from docker's own error in the pane.

The hand-run that establishes this — container up, bind-mount, and a canary write to a file in
`$HOME` *outside* the repo that must fail mechanically — is the owner's, not a lane's: docker,
`$HOME` and running containers are shared reality outside this repo. Nothing in the suite touches
docker; the checks assert the spawn *string* (`e2e/security.ts` §6d, `e2e/lanes-basic.ts`), which
is recorded whether or not a container runtime exists, for the same reason `./docker-verify.sh` is
not a gate: no lane has one.

## What `./docker-verify.sh` attests, and what it does not

It builds the image and runs the full `./e2e-isolated.sh` inside it, with **no mounts at all**:
the suite builds its own throwaway git repo, so a green run demonstrates the isolation as well
as the portability. It is not a gate and belongs in no `VERIFY_CMD` — no lane has a container
runtime.

**Its honest scope: it proves the harness, not the agent.** The suite runs `FLEET_CMD=true`
plus six shell stand-ins (`fakesum`, `fakemerge`, `fakeverify`, `fakecommit`, `fakereview`,
`fakedigest`). Every agent path in the proof is a shell script. Separately verified by hand
(2026-08-03): the CLI installs and runs on linux-arm64 and reaches its auth check. **Not yet
verified by anything: a real Claude session inside a real Fleet pane in a container.**

One fixture in the suite is deliberately platform-aware and is the first thing to suspect if this
run goes red on Debian while macOS is green: `fakeClaudeInPane` (`e2e/lane-helpers.ts`), which the
② author-path checks use to satisfy the server's strict author probe (`paneAgentAt` over
`AUTHOR_COMMS`) for exactly one pane.
It makes a `claude` that is really `/bin/cat` — by SYMLINK on macOS (a copied platform binary is
SIGKILLed there) and by COPY on Linux (`/proc/<pid>/comm` is the executed file's basename, so a
symlink would report `cat`). The macOS half is measured; the Linux half is reasoned from comm
semantics and has **not** been executed — this run is where it would first be proven.

## Trap 1 — binding 0.0.0.0 is half the move

`ALLOWED_HOSTS` (`server.ts:4474`) admits exactly `$FLEET_HOST:$FLEET_PORT`,
`localhost:$FLEET_PORT` and `127.0.0.1:$FLEET_PORT`. With `FLEET_HOST=0.0.0.0` that set holds
nothing a browser will ever send, so the published address is refused by the DNS-rebinding
guard. Measured: `-p 18790:8790` answers **403 on every route, dashboard included** — which
reads like a dead server, not like a config error. Publishing is two settings:

    -p 100.64.0.1:8790:8790  -e FLEET_ALLOWED_HOSTS=100.64.0.1:8790

That pair is also how "reachable only on the tailnet" survives the move: the host decides the
interface, the guard decides the name.

### Trap 1b — behind a proxy, the Host header carries the PROXY's port

The same guard, one level meaner. `colima` publishes ports *inside its Linux VM*, so
`-p <host-tailscale-ip>:PORT:8790` fails outright with `cannot assign requested address` — that
address does not exist in the VM. The way through is to publish on `127.0.0.1` and put a proxy in
front (`tailscale serve --bg --https=8443 http://127.0.0.1:8791`).

What bites then: the browser addresses the *proxy*, so the Host header is
`<node>.<tailnet>.ts.net:8443` — the **serve** port, not the container's. An allowlist carrying
the bare hostname and `:443` still answers 403 on every route. Whatever port the proxy listens on
belongs in `FLEET_ALLOWED_HOSTS`, verbatim, including the port unless it is 80/443.

## Trap 2 — the instance's identity lives in the app directory

`fleet.json` (owner token, share secrets, slot assignments), `streams/`, and all five ledgers
hang off `import.meta.dir` — 25 sites in `server.ts`, **no environment override**. A container
that is removed takes the whole instance with it, share links included.

Without a code change the workaround is a **named volume over the app directory**
(`-v fleetstate:/home/fleet/claude-fleet`): Docker pre-populates a named volume from the image
on first creation, so code and state then live together and survive `docker rm`. Its cost is
the mirror image: a rebuilt image no longer reaches that instance — updating means recreating
the volume. Fine for a trial, wrong as a permanent arrangement. The real fix is a state-dir
override in `server.ts`, and it should come before anyone depends on an instance.

## Trap 3 — the guest's credentials, and whose they are

`CLAUDE_CONFIG_DIR` is what makes a guest instance a guest instance: credentials, settings and
transcripts all land under it, so a volume mounted there is that person's entire Claude
identity, billed to their own subscription. It is set *before* the CLI install in the
Dockerfile on purpose — with it set after, the installer writes one path and every later run
reads another, and every `claude` invocation opens with "configuration file not found", in
every pane of every session.

**Never mount a host `~/.claude` into a guest container.** That file holds an OAuth
`refreshToken` — a ~19-day credential that mints access tokens against the owner's
subscription and rate-limit tier. Anthropic states the matching warning for dev containers:
with `--dangerously-skip-permissions` (Fleet's unattended mode) a container does not prevent a
hostile project from exfiltrating what is inside it. A remote guest also cannot complete the
browser OAuth callback; have them run `claude setup-token` on their own machine and pass
`CLAUDE_CODE_OAUTH_TOKEN` into the container.

## Standing a guest instance up: `./guest-bootstrap.sh`

Copy it to the target box, run it as a normal user, and read the traps above first — the script
encodes them but not the reasoning. It refuses to start without `BIND=<ip>:<port>` and has no
default for it on purpose: the obvious default publishes a Fleet to the whole internet, and a
Fleet a stranger can reach is a shell. Give it a Tailscale address.

**If the box is an Oracle Cloud "Always Free" instance, convert the account to Pay-As-You-Go
first.** Oracle reclaims idle Always Free compute — 7-day window, CPU 95th percentile under 20%
*and* network under 20% *and* memory under 20%. A guest Fleet used a few times a week meets all
three without effort: idling, it is a few hundred MB of the 12 GB and almost no CPU. So the
instance disappears precisely after the quiet stretch that makes a shared instance worth having.
Pay-As-You-Go is the documented exemption and keeps the Always Free allotment free while you
stay inside it; the exposure it adds is that overruns now bill, which Oracle's own docs answer
with compartment quotas. (Checked 2026-08-03, together with the June 2026 halving of that tier
from 4 OCPU/24 GB to 2/12 — a vendor policy, so re-check it rather than trusting this line.)

## The egress firewall, and the trade it makes

A guest container is isolated in its filesystem and its credentials. It is **not** isolated in its
network: measured from inside one, `curl http://<owner-tailscale-ip>:8790/` answered 200 on the
live fleet's login page. The API answered 401, so the token gate held — but "protected by a token"
is weaker than "cannot get there", and the concern is not the guest as a person. It is the agent
running as them, which with `--dangerously-skip-permissions` and a hostile repository can be
steered at every address it can route to.

`guest-firewall.sh` closes that. It runs as root inside the container before the server starts
(`docker-entrypoint.sh`, which then drops to `fleet` via `setpriv`) and needs two capabilities:

    --user root --cap-add NET_ADMIN --cap-add NET_RAW -e FLEET_FIREWALL=1

**It is a denylist of the owner's private space, not an allowlist of the internet**, and that is
the trade to understand rather than the rules. Anthropic's reference `init-firewall.sh` does the
stronger thing — DROP by default, permit the Anthropic API, GitHub, npm — and it is strictly
better against exfiltration. It also breaks the guest's whole purpose: "they take their git
project with them" means pushing to a remote nobody listed in advance, and each such break
presents as a mysterious hang. An allowlist that gets switched off the first weekend protects
nothing. The measured risk was reachability into the owner's network; RFC1918 + CGNAT
(100.64.0.0/10, where Tailscale addresses live) + link-local removes exactly that, permanently and
without maintenance. **So: it does not stop a compromised agent from reaching the internet.** If
that is in scope, switch to the allowlist — the shape is in Anthropic's script, and the cost is
the maintenance it implies.

## Exposing a guest instance on a public hostname

A tailnet address and a public hostname are different security problems, and Fleet's own design
says so. `tokenGate` (`server.ts`) delays a wrong token by 400 ms and audits it — and that is all.
There is no lockout. The share-auth path a few lines below it *is* throttled and locked at 50
attempts an hour, and its comment says why: `(public-facing)`. The owner gate was never meant to
face the internet, which is the same sentence `server.ts:23` writes as "a reachable fleet is
remote code execution as your user".

Note what this means for the existing public tunnel: the owner's `cowork.*` hostname reaches the
live fleet, but that host is listed in `FLEET_SHARE_HOSTS`, so the dashboard and the whole owner
API **404 there, even with a valid token**. That share-only gate is the thing making public
exposure safe today — and a guest who needs their own dashboard cannot use it.

So a public guest instance needs an authenticating proxy in front, not a tunnel alone:

1. **Identity at the edge** (Cloudflare Access or equivalent) so an unauthenticated request never
   reaches Fleet at all. The guest signs in with their own identity; Fleet's token is then a
   second factor rather than the only one.
2. **Tunnel, never an open port** — the existing `cloudflared` ingress pattern, pointed at the
   container's loopback publish.
3. **The hostname in `FLEET_ALLOWED_HOSTS`**, or every route answers 403 (trap 1).
4. **The firewall above**, because a publicly reachable container is exactly the one that must not
   be able to knock on the owner's tailnet.

Order matters: put the edge policy in place *before* the DNS record resolves. Doing it the other
way leaves a window in which an unprotected owner dashboard is on the internet, and that window is
indexed by scanners in minutes.

**The owner's standing decision (2026-08-03) is no edge identity check, and a bounded window
instead** — `guest-expose.sh up [DAYS] | cut | resume | down | status`, default 7 days, enforced by
an hourly launchd job rather than by anyone's memory. The reasoning, so it can be revisited honestly: the
measured pre-auth surface is small (only `/` and the share password page answer without a
credential; `/api/*`, `/ws` and `/intake` all 401), and the token is 192 bits, so guessing is not
the risk. Leaking is — Fleet accepts the token in the query string, which puts it in browser
history and proxy logs. With the egress firewall in place a leak costs the guest their container
and their own subscription, not the owner's machine; what it still costs the owner is that abuse
traffic would leave from their address. A window measured in days, that closes itself, is what
that trade bought.

Two things learned building it, both the expensive way:

- **The ingress rule is the switch, not DNS.** `cloudflared tunnel route dns` creates a record and
  cannot delete one; removing a hostname through DNS needs an API token this machine has no reason
  to hold. Delete the ingress rule instead and the hostname falls through to the tunnel's
  `http_status:404`, so the DNS record can stay forever pointing at nothing.
- **Changing that config costs a brief outage of every hostname on the tunnel.** SIGHUP does not
  hot-reload this cloudflared build — it terminates, launchd restarts it, and for ~30 s the owner's
  website and every other hostname answer 502 before recovering unattended. Toggling exposure is
  therefore not free. Validate the config *before* signalling: on a restart-not-reload, a bad
  config does not fail to apply, it keeps everything down.

### Driving it from the dashboard: `FLEET_GUEST_CMD`

Point that variable at `./guest-ctl.sh` and the info card grows a `guest` section: whether the door
is open, until when, how many wrong tokens the guest instance has logged in the last hour and day,
and four buttons — `start`, `cut`, `renew 7 days`, `stop`. Unset the variable and none of it
exists: the routes 404 and the client draws nothing. `server.ts` never learns what a guest is; it
learns that a command with those verbs exists (the design record is `briefs/guest-ops-panel.md`).

Two properties worth knowing before relying on it:

- **`cut` keeps the deadline, `renew` moves it.** Cutting is the panic button — the door shuts, the
  container keeps running with the guest's work intact, and the window keeps counting down, so
  pressing `start` afterwards returns to the *original* deadline. Extending is a separate press by
  design. Only the script's `down` verb forgets a window; no button does.
- **`status` is not polled.** It spawns docker/colima/cloudflared probes, so the client reads it
  when the card opens and after each action, never on the 2 s session poll (`docs/data-saver.md`).

The auth-failure counts come from the guest instance's *own* `audit.jsonl` — the `owner_auth_fail`
lines `tokenGate` has been writing since the day it started, which nothing has ever read. The line
this deliberately does not cross: **security events yes, content no.** The owner sees that somebody
knocked, never what was done inside; that separation is the whole reason the container exists.

Deployment identity — hostnames, tunnel ids, addresses — lives in the gitignored `.env` and never
in a tracked file; this repository is public.

## The finding that outlived the container work

Eight of the suite's `git init` calls inherited the platform's default branch while
`fakemerge` rebases onto `main` **by name**. On this machine those agree only because
`/Library/Developer/CommandLineTools/usr/share/git-core/gitconfig` — an Apple file nobody here
wrote — sets `init.defaultBranch=main`. On Debian they disagree, and 35 checks failed on a
clean tree. Every site now says `-b main` explicitly; on macOS that changed nothing, which is
the point. Any new throwaway repo in a harness names its branch.
