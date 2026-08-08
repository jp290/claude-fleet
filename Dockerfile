# claude-fleet in a container.
#
# WHY THE WHOLE APP AND NOT THE SLOTS. Fleet welds four things together through the
# filesystem: the pane byte stream (streams/<n>, written by tmux's pipe-pane and read by the
# server), the agent transcript (~/.claude/projects/<cwd-slug>/<uuid>.jsonl, written by claude
# and read by the server — projDir, server.ts:361), and the git worktrees that the server and
# the agent both operate on. Server, tmux, claude and git therefore need one filesystem AND
# one path vocabulary. A boundary can go AROUND that bundle; a boundary THROUGH it silently
# blinds every transcript-derived feature (the conversation view, done-looking detection,
# the digest, auto-③) and would still leave Fleet's own workers — merge resolver, reviewers —
# running outside the box. So: the whole app, or nothing.
#
# WHAT DOES NOT COME ALONG. The app has no macOS coupling; everything macOS-shaped lives in
# the operations layer (the launchd plist, the Tailscale-IP bind, the cloudflared tunnel), and
# none of that is in this image. The container binds 0.0.0.0 and the HOST decides which
# address to publish it on — that is how "reachable only on the tailnet" survives the move.

FROM debian:bookworm-slim

# tmux is the session substrate, git is the work substrate, ripgrep is what the agent searches
# with. procps/less are what an interactive session in a pane expects to exist.
# iptables is only used by container-firewall.sh, which only runs when the container is started as
# root with FLEET_FIREWALL=1 — it is inert in every other mode, including all the e2e runs.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git tmux ripgrep unzip procps less iptables \
 && rm -rf /var/lib/apt/lists/*

# Non-root is not hygiene theatre here: the CLI REFUSES --dangerously-skip-permissions when
# launched as root, and that flag is Fleet's whole unattended mode (FLEET_CMD). A root image
# would quietly make every lane interactive.
ARG UID=1000
RUN useradd -m -u ${UID} -s /bin/bash fleet
USER fleet
ENV HOME=/home/fleet
WORKDIR /home/fleet

# bun: the runtime server.ts and every harness runs under.
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH=$HOME/.bun/bin:$HOME/.local/bin:$PATH

# The one setting that makes a guest instance a guest instance. Credentials, settings and
# transcripts all land under this path, so a VOLUME mounted here is that person's entire Claude
# identity — their own OAuth refresh token, billed to their own subscription, and nothing of
# anyone else's ever reaches it. Never bind-mount a host ~/.claude over this.
#
# It is set BEFORE the install on purpose. `.claude.json` (the account/trust file) normally
# lives OUTSIDE the config dir at ~/.claude.json, and setting CLAUDE_CONFIG_DIR moves it inside.
# With the ENV after the install, the installer wrote one path and every later run looked at the
# other — measured: every `claude` invocation opened with "Claude configuration file not found at
# /home/fleet/.claude/.claude.json", i.e. noise in every single pane of every session.
ENV CLAUDE_CONFIG_DIR=$HOME/.claude

# The agent itself. NOT required to prove this image — the e2e suites spawn `true; exec $SHELL`
# stand-ins (FLEET_CMD), so the whole suite passes with no CLI and no credentials present at
# all. It is installed anyway because an image whose only difference from the real thing is
# the agent proves less than it appears to. Build with --build-arg INSTALL_CLAUDE=0 to skip.
ARG INSTALL_CLAUDE=1
RUN if [ "$INSTALL_CLAUDE" = "1" ]; then curl -fsSL https://claude.ai/install.sh | bash; fi

# ~/claude-fleet, not an arbitrary path: e2e/slots.ts:13 opens slot 1 on the literal `~/claude-fleet`
# and a dozen later checks read git state through that slot. Anywhere else and the suite cannot run
# here at all. A symlink does NOT substitute — tmux reports pane_current_path resolved, so the
# "re-opening a slot moves the pane" check compares the real path against the link and fails.
COPY --chown=fleet:fleet . /home/fleet/claude-fleet
WORKDIR /home/fleet/claude-fleet
# --frozen-lockfile for the same reason the land gate uses it: the verdict must not depend on
# what the resolver felt like doing today.
RUN bun install --frozen-lockfile
# public/app.js and public/share.js are gitignored build artifacts, so the copy above cannot
# contain them — the server serves both from disk and a missing bundle is a blank dashboard.
RUN bun run build

# Defaults chosen so a container started with NO env is inert rather than dangerous:
# 0.0.0.0 because the container's interface is the boundary (see the header), and plain
# `claude` WITH its permission prompts — never the skip-permissions form, which is an opt-in
# the operator makes deliberately per instance.
#
# YOU ALMOST CERTAINLY ALSO NEED FLEET_ALLOWED_HOSTS. Binding 0.0.0.0 is only half the move:
# the DNS-rebinding guard (server.ts, ALLOWED_HOSTS) admits exactly `$FLEET_HOST:$FLEET_PORT`,
# `localhost:$FLEET_PORT` and `127.0.0.1:$FLEET_PORT`, and the browser sends the address YOU
# published on. Measured: `-p 18790:8790` and every request — dashboard included — answers 403
# `host '127.0.0.1:18790' not allowed`. So a tailnet publish is two settings, not one:
#     -p 100.64.0.1:8790:8790  -e FLEET_ALLOWED_HOSTS=100.64.0.1:8790
#
# AND KNOW WHERE THE STATE IS. Every durable file — fleet.json (owner token, share secrets, slot
# assignments), streams/, and all five ledgers — hangs off import.meta.dir, i.e. THIS directory,
# with no env override (25 sites in server.ts). A container that gets removed takes the whole
# instance identity with it. For anything but a throwaway, keep the container long-lived, or give
# server.ts a state-dir override first.
ENV FLEET_HOST=0.0.0.0 \
    FLEET_PORT=8790 \
    FLEET_CMD=claude
EXPOSE 8790

# The entrypoint is a passthrough unless the container is started as root: then it applies the
# egress firewall (with FLEET_FIREWALL=1) and drops to `fleet` before exec'ing the command. The
# image's own USER is still fleet, so nothing changes for a normal run or for the e2e suites.
COPY --chown=root:root docker-entrypoint.sh container-firewall.sh /usr/local/bin/
USER root
RUN chmod 0755 /usr/local/bin/docker-entrypoint.sh /usr/local/bin/container-firewall.sh
USER fleet
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["bun", "server.ts"]
