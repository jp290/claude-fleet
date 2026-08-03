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

Deployment identity — hostnames, tunnel ids, addresses — lives in the gitignored `.env` and never
in a tracked file; this repository is public.

## The finding that outlived the container work

Eight of the suite's `git init` calls inherited the platform's default branch while
`fakemerge` rebases onto `main` **by name**. On this machine those agree only because
`/Library/Developer/CommandLineTools/usr/share/git-core/gitconfig` — an Apple file nobody here
wrote — sets `init.defaultBranch=main`. On Debian they disagree, and 35 checks failed on a
clean tree. Every site now says `-b main` explicitly; on macOS that changed nothing, which is
the point. Any new throwaway repo in a harness names its branch.
