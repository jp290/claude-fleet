// pi-zai's READ fence: the SBPL profile a pi-zai pane runs pi behind (server.ts#PI_ZAI_HARNESS).
// The spawn supplies resolved base paths; the additional private roots are resolved here before
// the profile is built. e2e/pins.ts runs the builder over fixture paths, not a prose copy.
//
// The shape and every rule are the measured draft of docs/messungen/2026-09-21-pi-zai-lesezaun.md
// §2, probed there as T1–T5: `allow default` plus targeted denies, so pi keeps writing, building,
// committing and reaching the network, while the owner's secrets, every other session's transcript,
// other processes' environments and the live tmux socket are out of reach for pi AND its children.
// What stays open is named in docs/harness-adapter.md (pi-zai section), not hidden here.

// The live fleet's tmux socket name (server/tmux.ts#SOCK's default). Denied on EVERY build, not
// only when this server drives it: a test or scratch server's pi-zai pane must not reach the live
// panes either.
import { realpathSync } from "node:fs";
import { basename, dirname } from "node:path";

export const LIVE_TMUX_SOCK = "claudefleet";

// The same charset server.ts#SPAWN_PATH_RE admits, repeated here because this module must stay
// importable without server.ts. Every path below lands inside SBPL double quotes AND inside one
// single-quoted shell word, so `"`, `'` and `\` are each an escape out of one of the two; a path
// carrying one builds NO profile, and the caller then starts no pi.
const FENCE_PATH_RE = /^\/[A-Za-z0-9_.@+\-/ ]*$/;

// Pi's session directory name for a cwd: the realpath without its leading slash, `/` → `-`, framed
// in `--`. The one formula server.ts#isolatedPiContextFile reads sessions back with.
export function piSessionSlug(realCwd: string): string {
  return `--${realCwd.replace(/^\/+/, "").replaceAll("/", "-")}--`;
}

export interface PiZaiFenceInput {
  home: string;       // the owner's home, written out: SBPL expands no `~`
  fleetDir: string;   // the server's own checkout, where fleet.json and .env live
  agentDir: string;   // server.ts#PI_ZAI_AGENT_DIR
  keyFile: string;    // server.ts#PI_ZAI_KEY_FILE
  cwd: string;        // the slot's cwd
  tmuxDir: string;    // the tmux socket directory, `<TMUX_TMPDIR|/tmp>/tmux-<uid>`
  sockets: readonly string[]; // further socket names to deny beside LIVE_TMUX_SOCK
}

// Every path in the generated profile must be a realpath: SBPL compares against the path the kernel resolved, and
// on macOS /tmp and $TMPDIR are symlinks (/private/...), so a literal would silently match nothing.
// The regex below holds no backslash on purpose: `.` and `+` are escaped as `[.]`/`[+]`, so the
// profile survives a tmux display copy that strips backslashes byte-for-byte.
export function piZaiFenceProfile(i: PiZaiFenceInput): string | null {
  const realpathLoose = (p: string): string | null => {
    try { return realpathSync(p); }
    catch (err) { if ((err as NodeJS.ErrnoException).code !== "ENOENT") return null; }
    const parent = dirname(p);
    if (parent === p) return null;
    const resolvedParent = realpathLoose(parent);
    return resolvedParent === null ? null : `${resolvedParent}/${basename(p)}`;
  };
  const socks = [...new Set([LIVE_TMUX_SOCK, ...i.sockets])].map((s) => `${i.tmuxDir}/${s}`);
  const own = `${i.agentDir}/sessions/${piSessionSlug(i.cwd)}`;
  const roots = [
    `${i.home}/claudeJobApplication`,
    `${i.home}/private-repo-a`,
    `${i.home}/private-repo-a.worktrees`,
    `${i.home}/Desktop/Bewerbungen_April2026`,
  ].map(realpathLoose);
  if (roots.some((p) => p === null)) return null;
  const applicationRoots = roots.filter((p): p is string => p !== null);
  const paths = [i.home, i.fleetDir, i.agentDir, i.keyFile, i.cwd, own, ...socks, ...applicationRoots];
  if (!paths.every((p) => FENCE_PATH_RE.test(p) && !p.split("/").includes(".."))) return null;
  const rx = (p: string): string => p.replace(/[.+]/g, (c) => `[${c}]`);
  const sub = (p: string): string => `(subpath "${p}")`;
  const lit = (p: string): string => `(literal "${p}")`;
  const h = i.home;
  return "(version 1)(allow default)"
    // (1) the owner token's two FILE families. A regex, not two literals: fleet.json.bak and
    // .env.bak-* sit beside the originals and a literal missed them (T1 Nachsatz).
    + `(deny file-read* file-write* (regex #"^${rx(i.fleetDir)}/(fleet[.]json|[.]env)")`
    + ` ${sub(`${h}/.ssh`)} ${sub(`${h}/.config/claude-fleet/secrets`)} ${lit(i.keyFile)}`
    + ` ${lit(`${h}/.codex/auth.json`)} ${lit(`${h}/.claude/.credentials.json`)} ${lit(`${h}/.claude.json`)}`
    + ` ${sub(`${h}/.config/gh`)} ${sub(`${h}/.cloudflared`)} ${lit(`${h}/.pi/agent/auth.json`)}`
    + ` ${sub(`${h}/.claude/projects`)} ${sub(`${h}/.codex/sessions`)} ${sub(`${h}/.pi/agent/sessions`)}`
    + ` ${sub(`${i.agentDir}/sessions`)} ${applicationRoots.map(sub).join(" ")})`
    // ...and this pane's OWN session back open; SBPL lets the later rule win. Without it pi dies at
    // the mkdir of its session directory before any prompt (attic, "Der pi-Zaun").
    + `(allow file-read* file-write* ${sub(own)})`
    + `(allow file-read-metadata ${lit(`${i.agentDir}/sessions`)})`
    // (3) the live tmux socket: without it a lane reads and drives every pane of the fleet (T2)
    + `(deny network-outbound ${socks.map((s) => `(remote unix-socket (path-literal "${s}"))`).join(" ")})`
    // (2) the process-environment channel, and it takes BOTH rules: either alone left 508–531 PIDs
    // readable through sysctl(KERN_PROCARGS2), the pair left 2 — this pane's own tree (T3).
    + "(deny process-info* (target others))"
    + `(deny sysctl-read (sysctl-name-regex #"^kern[.]proc"))`
    + `(deny mach-lookup (global-name "com.apple.SecurityServer") (global-name "com.apple.security.agent"))`;
}
