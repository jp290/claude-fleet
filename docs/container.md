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

1. A running container, named by `FLEET_CONTAINER` (default `fleet`).
2. The worktree bind-mounted at the **identical path**. `spawnCmd` passes `-w "$PWD"`, i.e. the
   pane's own host cwd. Mounting it anywhere else makes every `docker exec` fail with a bad
   working directory, and it would also break the only thing that keeps host git and the
   in-container agent talking about one tree.

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
② author-path checks use to satisfy the server's strict `claudeAliveAt` probe for exactly one pane.
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
