// WHAT A CLAUDE SESSION FLEET STARTS GETS ON ITS LINE BEYOND MODEL AND CUT (K16 E6 + E10a,
// docs/neuaufbau/befunde/18-einstellungen.md §3.2 and §5.1). Owner 15.10.: „[Zitat entfernt]“
//  and „[Zitat entfernt]“
// . One pure function, so the
// spawn line (server.ts#agentCmd) and its tests read the same answer.
//
// Measured on claude 2.1.300 (befunde/18 §3.2): with the built-in classifier environment, auto blocks
// exactly POST /api/deploy and a tmux delivery into a sibling pane; with the Fleet environment below both
// pass and a push to GitHub stays blocked. `--settings` is a per-launch source for `autoMode` and for
// `autoCompactEnabled` (§5.1: no autocompact check at all, 265 869 tokens without compaction, /compact by
// hand still works) — nothing is written to ~/.claude/settings.json or ~/.claude.json.
import { AUTOMODE_ENVIRONMENT } from "./automode-environment";

export type ClaudeStartRole = "lane" | "main" | "orchestrator" | "generic";
export type ClaudePermissionMode = "auto";

// Every role Fleet spawns runs in auto (Bauleitung 15.10.: Lane, Bau, MAIN, Orchestratorin). The worker
// tier keeps `--permission-mode dontAsk` with its allowlist on its own line (server.ts CLAUDE_HARNESS.worker).
export const PERMISSION_MODE: Readonly<Record<ClaudeStartRole, ClaudePermissionMode>> = {
  lane: "auto", main: "auto", orchestrator: "auto", generic: "auto",
};

// the brief sentence every auto session reads at its start (befunde/18 §3.2)
export const AUTO_MODE_BRIEF = "AUTO-MODE: Du läufst im Auto-Mode. Eine Sperre des Klassifizierers ist eine Antwort: "
  + "nicht umgehen, nicht wörtlich wiederholen. Hängt deine Aufgabe daran, melde sie deiner Leitung mit dem Sperrgrund.";

export interface StartFacts {
  role: ClaudeStartRole;
  // the session's handover is on at this spawn (server.ts#thresholdFor basePct > 0): Fleet hands over
  // before the window ends, so Claude Code's own compaction is switched off. With the handover off it
  // stays on as the last hold at the window's end (owner 10:4x „[Zitat entfernt]“).
  handoverOn: boolean;
  fleetUrl: string;
  tmuxSocket: string;
  // the internal hub remote, null when this server has none; never written into a tracked file
  hub: { remote: string; url: string; host: string } | null;
}

export interface StartAspects {
  mode: ClaudePermissionMode;
  settings: { autoMode: { environment: string[] }; autoCompactEnabled?: false };
  briefLine: string;
}

const PLACEHOLDER = /\{(fleetUrl|tmuxSocket|hubRemote|hubUrl|hubHost)\}/g;
const HUB_PLACEHOLDER = /\{hub(?:Remote|Url|Host)\}/;

// The template carries no address (a tracked file must not name this machine's hosts); the facts fill
// it per spawn. An entry about the hub is dropped whole when this server has no hub remote.
export function fillEnvironment(template: readonly string[], f: StartFacts): string[] {
  const values: Record<string, string> = { fleetUrl: f.fleetUrl, tmuxSocket: f.tmuxSocket,
    hubRemote: f.hub?.remote ?? "", hubUrl: f.hub?.url ?? "", hubHost: f.hub?.host ?? "" };
  return template.filter((e) => f.hub || !HUB_PLACEHOLDER.test(e))
    .map((e) => e.replace(PLACEHOLDER, (_, k: string) => values[k] ?? ""));
}

export function startAspects(f: StartFacts, template: readonly string[] = AUTOMODE_ENVIRONMENT): StartAspects {
  return {
    mode: PERMISSION_MODE[f.role],
    settings: { autoMode: { environment: fillEnvironment(template, f) },
      ...(f.handoverOn ? { autoCompactEnabled: false as const } : {}) },
    briefLine: AUTO_MODE_BRIEF,
  };
}

// FLEET_CMD carried the bypass flag (`claude --dangerously-skip-permissions`, the old opt-in). Fleet now
// sets the mode per role itself, so the flag is taken off the line of every session that gets one;
// a line Fleet sets no mode on (container adapter, foreign harness) keeps FLEET_CMD as it is.
export function withoutSkipPermissions(cmd: string): string {
  return cmd.split(/\s+/).filter((t) => t && t !== "--dangerously-skip-permissions").join(" ");
}

// `ssh://user@host/path` or scp-like `user@host:path` → `user@host`; anything else (a local path, https) → null
export function hubHostOf(url: string): string | null {
  const ssh = /^ssh:\/\/([^/:]+)(?::\d+)?\//.exec(url);
  if (ssh) return ssh[1] ?? null;
  const scp = /^([^/@:\s]+@[^/:\s]+):/.exec(url);
  return scp?.[1] ?? null;
}
