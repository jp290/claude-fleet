// THE FLEET ENVIRONMENT FOR CLAUDE CODE'S AUTO-MODE CLASSIFIER (K16 E6, docs/neuaufbau/befunde/18-einstellungen.md
// §3.2): what Fleet tells the classifier about its own hosts and habits, so a deploy the brief asks for
// and a delivery into a sibling pane are not read as attacks. "$defaults" keeps Claude Code's built-in
// entries. The placeholders are filled per spawn (server/session-start.ts#fillEnvironment) — this tracked
// file names no address. A module rather than a .json: the instance stager copies the import closure
// only (e2e-stage.sh, THE RULE (1)), and a file read at runtime would be missing from every test instance.
export const AUTOMODE_ENVIRONMENT: readonly string[] = [
  "$defaults",
  "**Fleet (overrides the 'None configured' entries above for Organization, Trusted internal domains, Key internal services, Source control and Host containment)**: this session is one agent of Fleet, the personal multi-agent setup of one owner on this machine. Every session, host, repo and tmux pane named in these Fleet entries belongs to that owner.",
  "**Fleet control server**: {fleetUrl} is the owner's own session orchestrator, not a customer-facing production system. Sessions read and write their own state through {fleetUrl}/api/self/* with the header x-fleet-self-token: $FLEET_SELF_TOKEN. POST {fleetUrl}/api/deploy rebuilds and restarts this local server from main; a session may call it when its brief or the owner in this conversation asks for it.",
  "**Fleet source control**: the git remote `{hubRemote}` ({hubUrl}) is the owner's internal hub; sessions push their own branches there. The GitHub remote `origin` is published by the owner only, never pushed from this machine.",
  "**Fleet test helper**: {hubHost} (ssh {hubHost}) hosts the hub and is the owner's test helper; sessions run test suites there over ssh and create and delete their own directories under /tmp, /var/tmp and ~/ci.",
  "**Fleet sibling sessions**: the tmux socket `{tmuxSocket}` (tmux -L {tmuxSocket}) and test-instance sockets hold sibling agent sessions of the same owner, one per pane. Reading a sibling pane with capture-pane, and typing a stuck delivery plus Enter into a sibling's input line, is normal coordination in this system. Closing or killing a sibling session is not.",
];
