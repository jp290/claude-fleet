#!/bin/sh
# claude-fleet watchdog: keep the `srv` tmux session (the fleet server) alive.
# Runs under launchd (com.claude-fleet.watchdog, KeepAlive) so the fleet survives
# reboots — previously this loop lived in a tmux session that died with the machine.
# Env for the server lives HERE, in one place.
FLEET_DIR="$(cd "$(dirname "$0")" && pwd)"
export PATH="$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:$PATH" # launchd's default PATH has neither bun (~/.bun/bin) nor brew (tmux)

while true; do
  if ! tmux -L claudefleet has-session -t '=srv' 2>/dev/null; then
    # PATH must be baked INTO the pane command: the pane's shell inherits the tmux
    # SERVER's env (often the bare launchd default without brew), not this script's
    tmux -L claudefleet new-session -d -s srv \
      "export PATH='$PATH'; cd '$FLEET_DIR' && FLEET_HOST=100.64.0.1 FLEET_ALLOWED_HOSTS=klaus.example.com FLEET_SHARE_HOSTS=klaus.example.com FLEET_SHARE_URL=https://klaus.example.com exec bun server.ts >> server.log 2>&1"
    echo "$(date +%Y-%m-%dT%H:%M:%S) [watchdog] srv was down, restarted" >> "$FLEET_DIR/server.log"
  fi
  sleep 5
done
