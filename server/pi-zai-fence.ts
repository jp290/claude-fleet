// pi-zai's READ fence: the SBPL profile a pi-zai pane runs pi behind (server.ts#PI_ZAI_HARNESS).
// The spawn supplies resolved base paths; the owner's private deny roots come from local config
// (parsePiZaiDenyRoots) and are resolved here before the profile is built. e2e/pins.ts runs the
// builder over fixture paths, not a prose copy.
//
// THE SHAPE IS AN ALLOWLIST OVER THE OWNER'S HOME (owner 2026-10-06: what Z.ai must never see, a GLM
// lane cannot read at all). Until then it was `allow default` plus a deny list, and the read census
// docs/messungen/2026-10-06-pi-zai-lesebedarf.md found 212 successful reads on 157 paths outside the
// lane's worktree, every one past that list. Now: home and the shared temp roots are CLOSED for
// content, listings, xattrs and writes; opened again are only what that census derives as standard
// need (the worktree, its git metadata, pi's runtime and own state, the PATH tools, an own temp
// home, the suite mutex). The rules of docs/messungen/2026-09-21-pi-zai-lesezaun.md (T1–T3: owner
// secrets, other sessions, process environments, the live tmux socket, the keychain) stay, placed
// AFTER the openings so that none of them can be re-opened by one. SBPL: the later rule wins.
// What stays open is named in docs/harness-adapter.md (pi-zai section), not hidden here.

// The live fleet's tmux socket name (server/tmux.ts#SOCK's default). Denied on EVERY build, not
// only when this server drives it: a test or scratch server's pi-zai pane must not reach the live
// panes either.
import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve } from "node:path";

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

// The files server.ts#createWorktree writes or copies into a lane for the OTHER harnesses: the
// rulebook render (host address and domain inside), the owner model, the host's private config and
// Claude's local settings. A pi-zai worktree gets none of them (server.ts#laneScaffoldFor), and the
// fence below refuses their CONTENT inside any pi-zai cwd as well, so a lane switched over from
// claude, or a pi-zai main opened in a checkout that carries them, reads nothing of them either.
export const PRIVATE_SCAFFOLD = [".env", "CLAUDE.md", "OWNER.md", ".claude/settings.local.json"] as const;

// FLEET_PI_ZAI_DENY_ROOTS: the owner's private roots, colon-separated absolute paths. They live
// only in the host's gitignored .env — their NAMES are private too, so no tracked file may carry
// them. Every entry must pass the fence charset (which holds no `:`), be neither `/` nor carry a
// `..` segment, and appear once; an empty entry (`a::b`, a trailing `:`) fails the charset. Any
// violation, an empty value or an absent one is null: the fence is then unbuildable and pi-zai
// starts no pi — a fence that silently dropped the private roots would read as protection.
// Kept beside the home allowlist on purpose: a root OUTSIDE home (a mounted volume, /Users/Shared)
// is closed only by this list, and one inside an opened area (a private folder in a tool root)
// stays closed because these denies come after every opening.
export function parsePiZaiDenyRoots(raw: string | undefined): string[] | null {
  if (raw === undefined) return null;
  const roots = raw.split(":");
  if (!roots.every((p) => FENCE_PATH_RE.test(p) && p !== "/" && !p.split("/").includes(".."))) return null;
  return new Set(roots).size === roots.length ? roots : null;
}

// A lane worktree's git lives OUTSIDE its cwd: `<cwd>/.git` is a file naming
// `<common>/worktrees/<name>`, whose `commondir` names the shared `<common>`. Read with fs only
// (spawn lines are built synchronously), never by running git. null = .git is a directory inside
// cwd (a clone lane, a main session) or no repository at all: the cwd opening already covers it.
export interface PiZaiGit {
  common: string;  // the shared git dir, read-only but for objects/ and the own branch
  admin: string;   // this worktree's own admin dir, writable but for the files that point git elsewhere
  ref: string | null; // HEAD's symbolic ref ("refs/heads/…"); null = detached, no branch write
}
export function piZaiGitOf(realCwd: string): PiZaiGit | null {
  try {
    if (statSync(`${realCwd}/.git`).isDirectory()) return null;
    const m = /^gitdir:\s*(.+?)\s*$/m.exec(readFileSync(`${realCwd}/.git`, "utf8"));
    if (!m) return null;
    const admin = realpathSync(isAbsolute(m[1]) ? m[1] : resolve(realCwd, m[1]));
    const commonRaw = readFileSync(`${admin}/commondir`, "utf8").trim();
    const common = realpathSync(isAbsolute(commonRaw) ? commonRaw : resolve(admin, commonRaw));
    const head = /^ref:\s*(refs\/heads\/\S+)\s*$/.exec(readFileSync(`${admin}/HEAD`, "utf8"));
    return { common, admin, ref: head ? head[1] : null };
  } catch { return null; }
}

// The pane's own temp home: TMPDIR, HOME and the tool caches of everything pi starts point below it
// (server.ts#PI_ZAI_HARNESS), because the shared temp roots are closed and a tool that writes its
// cache under the real home would otherwise die on EPERM. One per cwd, stable across restarts, so a
// resumed lane keeps its bun cache; the hash keeps the owner's path names out of /tmp listings.
export function piZaiTmpFor(realTmp: string, realCwd: string): string {
  return `${realTmp}/fleet-pi-zai/${createHash("sha256").update(realCwd).digest("hex").slice(0, 16)}`;
}

export interface PiZaiFenceInput {
  home: string;       // the owner's home, written out: SBPL expands no `~`
  fleetDir: string;   // the server's own checkout, where fleet.json and .env live
  agentDir: string;   // server.ts#PI_ZAI_AGENT_DIR
  keyFile: string;    // server.ts#PI_ZAI_KEY_FILE
  cwd: string;        // the slot's cwd
  tmuxDir: string;    // the tmux socket directory, `<TMUX_TMPDIR|/tmp>/tmux-<uid>`
  sockets: readonly string[]; // further socket names to deny beside LIVE_TMUX_SOCK
  denyRoots: readonly string[] | null; // parsePiZaiDenyRoots' result; null or empty builds NO profile
  tmpRoots: readonly string[]; // shared temp roots closed like home (/private/tmp, the Darwin per-user dir)
  ownTmp: string;     // piZaiTmpFor's result: the pane's temp home, read-write
  suiteLock: string;  // e2e-stage.sh#FLEET_SUITE_LOCK's default; it and its `.q` stay read-write
  toolRoots: readonly string[]; // read-only openings inside home: the PATH dirs there, pi's package root
  git: PiZaiGit | null; // piZaiGitOf(cwd)
  // darwin's per-user temp dir (`getconf DARWIN_USER_TEMP_DIR`, realpath), inside the closed tmpRoots;
  // names where SwiftPM's atomic writes go (PIZAI_NSIRD_TOOLS). Absent or null: no such opening.
  userTemp?: string | null;
}

// The tools whose atomic writes behind the fence are let through. Foundation's atomic write stages
// in an item-replacement dir `<DARWIN_USER_TEMP_DIR>/TemporaryItems/NSIRD_<process>_<random>` —
// chosen by confstr, not $TMPDIR — and with that create refused, `swift build` never wrote its
// output-file-map.json and died at "encountered an I/O error (code: 1) while reading …" (measured
// 2026-10-06, sandbox log: swift-build/swift-package and swift-driver denied file-write-create
// there). Only these names, and only create and unlink: enough for the staged file to be made and
// renamed out, while another process's staged content stays unreadable and unwritable.
export const PIZAI_NSIRD_TOOLS = ["swift-build", "swift-package", "swift-driver"] as const;

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
    // a missing chain that reaches `/` must not write `//<name>`: that is not the path the kernel
    // resolves, so its subpath would match nothing (measured on Linux, where /Users is absent)
    if (resolvedParent === null) return null;
    return resolvedParent === "/" ? `/${basename(p)}` : `${resolvedParent}/${basename(p)}`;
  };
  const socks = [...new Set([LIVE_TMUX_SOCK, ...i.sockets])].map((s) => `${i.tmuxDir}/${s}`);
  const own = `${i.agentDir}/sessions/${piSessionSlug(i.cwd)}`;
  if (!i.denyRoots || i.denyRoots.length === 0) return null;
  const roots = i.denyRoots.map(realpathLoose);
  if (roots.some((p) => p === null)) return null;
  const denyRoots = roots.filter((p): p is string => p !== null);
  // the CLOSED areas must exist as named: an empty one would close nothing and read as a fence
  if (i.tmpRoots.length === 0) return null;
  const g = i.git;
  const userTemp = i.userTemp ?? null;
  const paths = [...(userTemp ? [userTemp] : []), i.home, i.fleetDir, i.agentDir, i.keyFile, i.cwd, own, ...socks, ...denyRoots,
    ...i.tmpRoots, i.ownTmp, i.suiteLock, i.tmuxDir, ...i.toolRoots, ...(g ? [g.common, g.admin] : [])];
  if (!paths.every((p) => FENCE_PATH_RE.test(p) && !p.split("/").includes(".."))) return null;
  if (g?.ref && !/^refs\/heads\/[A-Za-z0-9_.@+\-/]+$/.test(g.ref)) return null;
  // the tool roots open READING inside home; one of them equal to or above home would re-open all of it
  if (i.toolRoots.some((p) => p === "/" || i.home === p || i.home.startsWith(`${p}/`))) return null;
  const rx = (p: string): string => p.replace(/[.+]/g, (c) => `[${c}]`);
  const sub = (p: string): string => `(subpath "${p}")`;
  const lit = (p: string): string => `(literal "${p}")`;
  const h = i.home;
  // EXPLICIT OPERATIONS IN EVERY FILE RULE, never the `file-read*` wildcard. SBPL does not simply let
  // the later rule win across granularities: a rule naming `file-read-data` beats one naming
  // `file-read*` WHATEVER their order. Measured 2026-10-06 on macOS 26.3: a wildcard allow after a
  // specific deny re-opened nothing, and — the dangerous half — a wildcard deny after a specific allow
  // denied nothing. With (A) closing data by name, every opening and every never-rule below must name
  // the same operations, or the secret denies in (C) would silently lose to the openings in (B).
  const content = "file-read-data file-read-xattr";
  const allRead = "file-read-data file-read-metadata file-read-xattr";
  // git's own write set in a lane worktree: new objects, this worktree's admin dir, and the ONE
  // branch the lane works on (ref, its lock, its reflog). Every other ref, packed-refs and the
  // shared config stay read-only — a lane that moved main or another lane's branch would be landing
  // without a gate. packed-refs.lock is the one exception, and only the LOCK: git 2.50 opens a
  // second ref transaction after every commit/reset that takes it and, with nothing to repack, drops
  // it again — denied, each of those printed "error: Unable to create …packed-refs.lock" (exit 0).
  // Renaming or linking the lock over packed-refs stays refused (measured 2026-10-06); the price is
  // that a lane could leave a stale lock behind, which blocks ref deletions until it is removed.
  const gitWrite = g ? [sub(`${g.common}/objects`), sub(g.admin), lit(`${g.common}/packed-refs.lock`),
    ...(g.ref ? [lit(`${g.common}/${g.ref}`), lit(`${g.common}/${g.ref}.lock`), lit(`${g.common}/logs/${g.ref}`)] : [])] : [];
  // ...and what may NEVER be written, inside an opening or not: every file that makes the NEXT git
  // run somewhere else execute code. The server runs git in this worktree outside the fence (status
  // ticks, the land), so a hook, a core.fsmonitor/hooksPath in a config, or a `.git`/`commondir`
  // pointer re-aimed at a lane-made config would run the lane's command with the owner's full reach.
  const readOnly = [...i.toolRoots.map(sub), ...(g ? [sub(g.common)] : [])];
  const gitDirs = g ? [g.common, g.admin] : [`${i.cwd}/.git`];
  const gitNeverWrite = [lit(`${i.cwd}/.git`), ...gitDirs.flatMap((d) => [sub(`${d}/hooks`), lit(`${d}/config`),
    lit(`${d}/config.worktree`), lit(`${d}/commondir`), lit(`${d}/gitdir`)])];
  return "(version 1)(allow default)"
    // (A) CLOSED: home and the shared temp roots — content, directory listings, xattrs and writes.
    // Metadata stays open on purpose: realpath, getcwd and every upward config search (git, bun,
    // node) stat ancestors, and an EPERM there kills them where an ENOENT is the normal answer. A
    // stat answers only for a name already known; enumerating one is a listing, and that is closed.
    + `(deny ${content} file-write* ${sub(h)} ${i.tmpRoots.map(sub).join(" ")})`
    // (B) OPENED again inside them — the census' standard need, nothing conditional.
    + `(allow ${content} file-write* ${sub(i.cwd)} ${sub(i.ownTmp)} ${sub(i.agentDir)}`
    + ` ${sub(i.suiteLock)} ${sub(`${i.suiteLock}.q`)} ${sub(i.tmuxDir)})`
    // never emitted empty: an allow without a filter would re-open the whole disk
    + (readOnly.length ? `(allow ${content} ${readOnly.join(" ")})` : "")
    + (gitWrite.length ? `(allow file-write* ${gitWrite.join(" ")})` : "")
    // SwiftPM's atomic-write staging dirs in the closed per-user temp dir (PIZAI_NSIRD_TOOLS)
    + (userTemp ? `(allow file-write-create file-write-unlink (regex #"^${rx(userTemp)}/TemporaryItems/NSIRD_`
      + `(${PIZAI_NSIRD_TOOLS.join("|")})_[^/]+(/|$)"))` : "")
    // (C) NEVER, even inside an opening. (1) the owner token's two FILE families. A regex, not two
    // literals: fleet.json.bak and .env.bak-* sit beside the originals and a literal missed them (T1).
    + `(deny ${allRead} file-write* (regex #"^${rx(i.fleetDir)}/(fleet[.]json|[.]env)")`
    + ` ${sub(`${h}/.ssh`)} ${sub(`${h}/.config/claude-fleet/secrets`)} ${lit(i.keyFile)}`
    + ` ${lit(`${h}/.codex/auth.json`)} ${lit(`${h}/.claude/.credentials.json`)} ${lit(`${h}/.claude.json`)}`
    + ` ${sub(`${h}/.config/gh`)} ${sub(`${h}/.cloudflared`)} ${lit(`${h}/.pi/agent/auth.json`)}`
    + ` ${sub(`${h}/.claude/projects`)} ${sub(`${h}/.codex/sessions`)} ${sub(`${h}/.pi/agent/sessions`)}`
    + ` ${sub(`${i.agentDir}/sessions`)} ${lit(`${i.agentDir}/auth.json`)} ${denyRoots.map(sub).join(" ")})`
    // ...and this pane's OWN session back open; SBPL lets the later rule win. Without it pi dies at
    // the mkdir of its session directory before any prompt (attic, "Der pi-Zaun").
    + `(allow ${allRead} file-write* ${sub(own)})`
    + `(allow file-read-metadata ${lit(`${i.agentDir}/sessions`)})`
    // (C2) the private scaffold inside the cwd: content and writes refused, metadata left so that
    // git status can still stat an ignored name
    + `(deny ${content} file-write* ${PRIVATE_SCAFFOLD.map((f) => lit(`${i.cwd}/${f}`)).join(" ")})`
    + `(deny file-write* ${gitNeverWrite.join(" ")})`
    // (D) the live tmux socket: without it a lane reads and drives every pane of the fleet (T2)
    + `(deny network-outbound ${socks.map((s) => `(remote unix-socket (path-literal "${s}"))`).join(" ")})`
    // (E) the process-environment channel, and it takes BOTH rules: either alone left 508–531 PIDs
    // readable through sysctl(KERN_PROCARGS2), the pair left 2 — this pane's own tree (T3). The sysctl
    // half names kern.procargs* only, not every kern.proc*: KERN_PROC_PID (kinfo_proc — pid, start
    // time, a 16-byte command name, no argv, no env) must stay readable, because the suite mutex
    // proves a foreign holder's identity by its start time (e2e-stage.sh#_st_birth_of). Measured
    // 2026-10-06: this pair leaves 3 PIDs' procargs readable and 618 foreign births; the old
    // `^kern[.]proc` pair left the same 3 procargs and 1 foreign birth. What stays readable is the
    // probe's own PROCESS GROUP — parent, siblings and cousins inside it open, a child moved to its
    // own group or session closed (measured the same day). A group never spans sessions, and tmux
    // starts every pane as its own session: what stays readable stays inside this pane.
    + "(deny process-info* (target others))"
    + `(deny sysctl-read (sysctl-name-regex #"^kern[.]procargs"))`
    + `(deny mach-lookup (global-name "com.apple.SecurityServer") (global-name "com.apple.security.agent"))`;
}
