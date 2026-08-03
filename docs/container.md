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

## The finding that outlived the container work

Eight of the suite's `git init` calls inherited the platform's default branch while
`fakemerge` rebases onto `main` **by name**. On this machine those agree only because
`/Library/Developer/CommandLineTools/usr/share/git-core/gitconfig` — an Apple file nobody here
wrote — sets `init.defaultBranch=main`. On Debian they disagree, and 35 checks failed on a
clean tree. Every site now says `-b main` explicitly; on macOS that changed nothing, which is
the point. Any new throwaway repo in a harness names its branch.
