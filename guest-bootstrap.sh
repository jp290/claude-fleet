#!/bin/sh
# Stand up a GUEST Fleet instance on a fresh Linux box (Ubuntu/Debian, arm64 or x86).
# Copy this file to the machine and run it there as a normal, non-root user.
#
# A guest instance is a whole, separate Fleet: its own token, its own Claude credentials, its
# own workspace, nothing of the host's. That shape is not a preference — Fleet has no
# multi-tenancy and cannot honestly grow one (an owner token browses the filesystem via
# /api/dirs and opens a slot on any path; server.ts:23 calls a reachable fleet "remote code
# execution as your user"). So the boundary is the OS, and this script draws it.
#
# Read docs/container.md first. This encodes its three traps as code, but not the reasoning.
set -eu

fail() { echo "guest-bootstrap: $1" >&2; exit 1; }

# --- the two settings that must agree, and the reason this script refuses without them -------
# BIND is the address the container is published on. It is REQUIRED and there is deliberately no
# default: the obvious default (0.0.0.0) on a rented box publishes a Fleet to the whole internet,
# and a Fleet reachable by a stranger is a shell. Give it a Tailscale address — the same property
# the owner's own deployment relies on — or a private interface.
#
# It is ALSO passed as FLEET_ALLOWED_HOSTS, because binding is only half the move: the
# DNS-rebinding guard (server.ts, ALLOWED_HOSTS) admits only $FLEET_HOST:$PORT, localhost:$PORT
# and 127.0.0.1:$PORT, and the container's FLEET_HOST is 0.0.0.0 — which no browser ever sends.
# Publish without this and every route answers 403, dashboard included, which reads like a dead
# server rather than a misconfiguration. Measured, see docs/container.md trap 1.
BIND="${BIND:-}"
[ -n "$BIND" ] || fail "set BIND=<ip>:<port> — e.g. BIND=100.64.0.1:8790 (a Tailscale address).
  There is no default on purpose: 0.0.0.0 on a rented box publishes a shell to the internet."

case "$BIND" in *:*) : ;; *) fail "BIND must be <ip>:<port>, got '$BIND'" ;; esac
BIND_IP=${BIND%:*}
BIND_PORT=${BIND##*:}

# The guest's OWN credential. Never the owner's: ~/.claude/.credentials.json holds an OAuth
# refreshToken valid for weeks that mints access tokens against ITS owner's subscription and
# rate-limit tier. The guest runs `claude setup-token` on their own machine and hands over the
# result. Empty is allowed — they can log in interactively later — but then say so out loud.
GUEST_TOKEN="${CLAUDE_CODE_OAUTH_TOKEN:-}"

REPO_URL="${REPO_URL:-https://github.com/jp290/claude-fleet.git}"
SRC="${SRC:-$HOME/claude-fleet}"
IMAGE="${IMAGE:-claude-fleet}"
NAME="${NAME:-fleet-guest}"

# --- docker ----------------------------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  echo "==> installing docker"
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$(id -un)"
  echo "guest-bootstrap: you were added to the 'docker' group — log out and back in, then re-run."
  exit 0
fi
docker info >/dev/null 2>&1 || fail "docker is installed but not reachable (new group needs a fresh login?)"

# --- the app ----------------------------------------------------------------------------------
# Built HERE rather than shipped: the image is architecture-specific, and building on the target
# makes arm64-vs-x86 a non-question instead of a multi-arch build.
if [ -d "$SRC/.git" ]; then
  echo "==> updating $SRC"
  git -C "$SRC" pull --ff-only
else
  echo "==> cloning into $SRC"
  git clone "$REPO_URL" "$SRC"
fi
echo "==> building $IMAGE (a few minutes on a small box)"
docker build -t "$IMAGE" "$SRC"

# --- state ------------------------------------------------------------------------------------
# A named volume OVER the app directory, which looks odd and is deliberate: every durable file
# Fleet has — fleet.json (owner token, share secrets, slot assignments), streams/ and all five
# ledgers — hangs off import.meta.dir with no environment override (25 sites in server.ts).
# Without this, `docker rm` deletes the instance's whole identity, share links included. Docker
# pre-populates a named volume from the image on first creation, so code and state end up
# together and survive removal (verified: a labelled slot came back in a fresh container).
#
# THE COST, so it is not discovered later: a rebuilt image no longer reaches this instance.
# Updating means recreating the volume, i.e. re-minting the token and losing the slots. Fine for
# a trial; the durable fix is a state-dir override in server.ts, before anyone depends on it.
docker volume create fleet-state >/dev/null
docker volume create fleet-work  >/dev/null

# --- run ----------------------------------------------------------------------------------------
FLEET_TOKEN="${FLEET_TOKEN:-$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')}"

docker rm -f "$NAME" >/dev/null 2>&1 || true
# FLEET_CMD is left at the image default (`claude`, WITH its permission prompts). Unattended mode
# is an opt-in the operator makes knowingly: add -e FLEET_CMD='claude --dangerously-skip-permissions'.
# Anthropic's own devcontainer warning applies then — a container does not stop a hostile project
# from exfiltrating what is inside it, including the credentials in CLAUDE_CONFIG_DIR.
set -- -d --name "$NAME" --restart unless-stopped \
  -e FLEET_TOKEN="$FLEET_TOKEN" \
  -e FLEET_ALLOWED_HOSTS="$BIND" \
  -v fleet-state:/home/fleet/claude-fleet \
  -v fleet-work:/home/fleet/work \
  -p "$BIND_IP:$BIND_PORT:8790"
[ -n "$GUEST_TOKEN" ] && set -- "$@" -e CLAUDE_CODE_OAUTH_TOKEN="$GUEST_TOKEN"
docker run "$@" "$IMAGE" >/dev/null

echo
echo "==> up:    http://$BIND"
echo "    token: $FLEET_TOKEN"
echo "    work:  volume fleet-work, mounted at /home/fleet/work (the picker's only reachable tree)"
[ -n "$GUEST_TOKEN" ] || echo "    NOTE: no CLAUDE_CODE_OAUTH_TOKEN was given — the guest must log in inside a pane."
echo
echo "    Reachable ONLY at $BIND_IP. If that is a public address, stop and rebind it now."
