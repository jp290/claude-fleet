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
import { lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync, statSync } from "node:fs";
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
// The writable branch is NOT read from the worktree: `<admin>/HEAD` sits in the admin dir the fence
// opens for writing, so a lane could re-aim it at refs/heads/main and the NEXT spawn would grant that
// ref. It comes from Fleet's own lane record (server.ts: the slot's worktree.branch) instead; no
// record (a pi-zai session in a worktree Fleet did not make) = no branch write at all. The pointers
// this function DOES follow (`.git`, `commondir`) are in the fence's never-write set.
export interface PiZaiGit {
  common: string;  // the shared git dir, read-only but for objects/ and the own branch
  admin: string;   // this worktree's own admin dir, writable but for the files that point git elsewhere
  ref: string | null; // "refs/heads/<Fleet's lane branch>"; null = no lane record, no branch write
}
export function piZaiGitOf(realCwd: string, laneBranch: string | null): PiZaiGit | null {
  try {
    if (statSync(`${realCwd}/.git`).isDirectory()) return null;
    const m = /^gitdir:\s*(.+?)\s*$/m.exec(readFileSync(`${realCwd}/.git`, "utf8"));
    if (!m) return null;
    const admin = realpathSync(isAbsolute(m[1]) ? m[1] : resolve(realCwd, m[1]));
    const commonRaw = readFileSync(`${admin}/commondir`, "utf8").trim();
    const common = realpathSync(isAbsolute(commonRaw) ? commonRaw : resolve(admin, commonRaw));
    return { common, admin, ref: laneBranch ? `refs/heads/${laneBranch}` : null };
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
  // true on darwin: the per-user dir then MUST be named — userTemp resolved and its parent among
  // tmpRoots — or NO profile is built. getconf answering nothing would otherwise leave $TMPDIR, the
  // user cache and every Fleet copy in them readable while the profile still looked complete.
  darwin?: boolean;
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
  if (i.darwin && !(userTemp && i.tmpRoots.includes(dirname(userTemp)))) return null;
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
  const auth = `${i.agentDir}/auth.json`;
  let emptyAuth = false;
  try {
    if (lstatSync(auth).isFile()) {
      const text = readFileSync(auth, "utf8").trim();
      const store: unknown = text === "" ? {} : JSON.parse(text);
      emptyAuth = store !== null && typeof store === "object" && !Array.isArray(store) && Object.keys(store).length === 0;
    }
  } catch { /* An unreadable or invalid store must never acquire a read grant. */ }
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
    // Pi 1.0.2 reads its credential store at startup. Only an empty regular store may be read;
    // Band C still denies its metadata, xattrs and every write. A populated or uninspectable
    // store fails the existing sandbox self-test with this reason before pi can start.
    + (emptyAuth ? `(allow file-read-data ${lit(auth)})` : "")
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
    + `(deny mach-lookup (global-name "com.apple.SecurityServer") (global-name "com.apple.security.agent"))`
    + (emptyAuth ? "" : '(error "pi-zai: credential store is not an empty regular JSON object or is unreadable; auth.json remains blocked")');
}

// ---------------------------------------------------------------------------------------------------
// The LINUX fence: the same meaning as the profile above, as a bubblewrap argument list (Workhorse;
// owner 2026-10-16: „[Zitat entfernt]“). The two differ in SHAPE, not in what they allow:
// SBPL starts from `allow default` and closes, bwrap starts from an EMPTY root and opens — so the
// allowlist of (A)/(B) is how the mount table is built, and (C) are the masks laid over an opening
// that happens to contain a secret. Measured on Debian 13 / bwrap 0.12.0 / kernel 6.12, user
// namespaces unprivileged (docs/messungen/2026-10-16-pi-zai-linux-zaun.md).
//
//   (A) closed        everything not mounted: home, /tmp, other worktrees, the main checkout, ~/.ssh,
//                     the key file, fleet.json/.env, other sessions' transcripts, the live tmux socket
//                     (/tmp is a fresh tmpfs, so /tmp/tmux-<uid> does not exist inside)
//   (B) opened        the cwd and the pane's own temp home (rw), the pi agent dir (rw, but its sessions/
//                     replaced by an empty tmpfs with only the OWN session dir bound back), the PATH
//                     tools under home and the targets their symlinks name (ro), /usr and a short /etc
//                     list (ro), the worktree's git dirs (ro; objects/, the admin dir and the one
//                     branch's directory rw)
//   (C) masked        a path of the (C) list of piZaiFenceProfile that lies INSIDE an opening
//                     (a pi-zai main in a checkout with fleet.json; a lane with a leftover .env):
//                     /dev/null over a file, an empty read-only tmpfs over a directory
//   (E) process env   a fresh PID namespace and its own /proc: no foreign process exists, so no
//                     foreign environment — the Linux counterpart of the process-info/sysctl PAIR
//
// What the Linux fence does NOT carry over, each decided as `unsupported` and named in
// docs/harness-adapter.md: the suite mutex (/tmp/fleet-e2e.lock proves its holder by PID and start time
// and a PID namespace makes every PID in it meaningless outside — a shared mutex would let a foreign
// waiter steal it, a private one only excludes nobody), the shared tmux dir (the pane's tmux runs on its
// own /tmp), and the per-ref file rules inside refs/heads/<dir>/ (a bind mount cannot hold lock+rename
// of one file; see gitWrite below).
// ---------------------------------------------------------------------------------------------------

export interface PiZaiBwrap {
  args: string[];    // bwrap's arguments up to (not including) the command
  mkdirs: string[];  // directories the OUTER shell must make before bwrap runs (a bind needs its source)
}

// TIOCSTI lets a process push keystrokes into its controlling terminal; the pane's outer shell
// (`; exec $SHELL`) reads that terminal after pi ends and runs with the owner's full reach. bwrap's
// --new-session cuts the controlling terminal and shuts it, at the price of SIGWINCH (pi would not
// redraw on a pane resize). With the kernel switch dev.tty.legacy_tiocsti=0 the ioctl is refused for
// everyone without CAP_SYS_ADMIN in the initial namespace, so the session can stay.
export function piZaiTiocstiClosed(read: () => string = () => readFileSync("/proc/sys/dev/tty/legacy_tiocsti", "utf8")): boolean {
  try { return read().trim() === "0"; } catch { return false; }
}

// The system trees mounted read-only. /usr is the whole userland of a merged-/usr Debian; /bin, /lib,
// /lib64 and /sbin are its symlinks (recreated, not bound). The /etc entries are what a dynamic
// binary, DNS, TLS, user lookup and terminal programs read; /etc as a whole stays closed.
const BWRAP_SYSTEM_DIRS = ["/bin", "/lib", "/lib32", "/lib64", "/sbin"] as const;
const BWRAP_SYSTEM_RO = ["/usr", "/opt", "/etc/alternatives", "/etc/ssl", "/etc/ca-certificates", "/etc/ld.so.cache",
  "/etc/ld.so.conf", "/etc/ld.so.conf.d", "/etc/resolv.conf", "/etc/hosts", "/etc/host.conf", "/etc/nsswitch.conf",
  "/etc/gai.conf", "/etc/passwd", "/etc/group", "/etc/localtime", "/etc/timezone", "/etc/terminfo", "/etc/os-release",
  "/etc/shells", "/etc/mime.types", "/etc/protocols", "/etc/services"] as const;

export function piZaiBwrapArgs(i: PiZaiFenceInput, o: { newSession?: boolean } = {}): PiZaiBwrap | null {
  const exists = (p: string): boolean => { try { lstatSync(p); return true; } catch { return false; } };
  if (!i.denyRoots || i.denyRoots.length === 0) return null;
  const g = i.git;
  const paths = [i.home, i.fleetDir, i.agentDir, i.keyFile, i.cwd, i.ownTmp, ...i.denyRoots, ...i.toolRoots, ...(g ? [g.common, g.admin] : [])];
  if (!paths.every((p) => FENCE_PATH_RE.test(p) && !p.split("/").includes(".."))) return null;
  if (g?.ref && !/^refs\/heads\/[A-Za-z0-9_.@+\-/]+$/.test(g.ref)) return null;
  if (i.toolRoots.some((p) => p === "/" || i.home === p || i.home.startsWith(`${p}/`))) return null;
  // a populated or uninspectable credential store never enters the fence (Darwin: the profile's
  // (error …) clause); an absent one is made empty by the outer shell and bound read-only below
  const auth = `${i.agentDir}/auth.json`;
  try {
    if (exists(auth)) {
      if (!lstatSync(auth).isFile()) return null;
      const text = readFileSync(auth, "utf8").trim();
      const store: unknown = text === "" ? {} : JSON.parse(text);
      if (store === null || typeof store !== "object" || Array.isArray(store) || Object.keys(store).length !== 0) return null;
    }
  } catch { return null; }

  const a: string[] = ["--unshare-all", "--share-net", "--die-with-parent"];
  if (o.newSession ?? !piZaiTiocstiClosed()) a.push("--new-session");
  const mkdirs: string[] = [];
  const opened: string[] = [];
  const under = (p: string, root: string): boolean => p === root || p.startsWith(`${root}/`);
  const open = (p: string): void => { opened.push(p); };

  for (const d of BWRAP_SYSTEM_DIRS) {
    try {
      const st = lstatSync(d);
      if (st.isSymbolicLink()) a.push("--symlink", readlinkSync(d), d);
      else if (st.isDirectory()) { a.push("--ro-bind", d, d); open(d); }
    } catch { /* absent on this system */ }
  }
  for (const p of BWRAP_SYSTEM_RO) if (exists(p)) { a.push("--ro-bind", p, p); open(p); }
  a.push("--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp");

  // (B) read-only tools: the PATH dirs under home and pi's package root come from the caller; the
  // targets their symlinks name are opened too (~/.local/bin/node → ~/.local/node-vX/bin/node needs
  // the whole node tree, npm being a script next to it), unless a root already covers them.
  const toolDests: string[] = [];
  const addTool = (p: string): void => { if (!toolDests.some((r) => under(p, r))) toolDests.push(p); };
  for (const r of i.toolRoots) addTool(r);
  for (const r of i.toolRoots) {
    let names: string[] = [];
    try { names = readdirSync(r); } catch { continue; }
    for (const n of names) {
      let t: string;
      try { t = realpathSync(`${r}/${n}`); } catch { continue; }
      if (!under(t, i.home) || t === i.home) continue; // outside home: the system trees or nothing
      if (!FENCE_PATH_RE.test(t) || toolDests.some((d) => under(t, d)) || under(t, i.cwd)) continue;
      addTool(basename(dirname(t)) === "bin" && dirname(dirname(t)) !== i.home ? dirname(dirname(t)) : t);
    }
  }
  for (const p of toolDests.filter((p) => !toolDests.some((r) => r !== p && under(p, r)))) if (exists(p)) { a.push("--ro-bind", p, p); open(p); }

  // (B) read-write: the lane, the pane's temp home, the pi agent dir
  a.push("--bind", i.cwd, i.cwd); open(i.cwd);
  a.push("--bind", i.ownTmp, i.ownTmp); open(i.ownTmp);
  a.push("--bind", i.agentDir, i.agentDir); open(i.agentDir);
  a.push("--tmpfs", `${i.agentDir}/sessions`);
  const ownSession = `${i.agentDir}/sessions/${piSessionSlug(i.cwd)}`;
  a.push("--bind", ownSession, ownSession);
  a.push("--ro-bind-try", auth, auth);

  // (B) git. The common dir is read-only; objects/, this worktree's admin dir and the one branch's
  // directory are the writes git needs for a commit. Every file that makes the NEXT, unfenced git run
  // somewhere execute code stays read-only inside them (hooks, config, commondir, gitdir, the `.git`
  // pointer): the server runs git in this tree outside the fence.
  const gitDirs = g ? [g.common, g.admin] : [`${i.cwd}/.git`];
  if (g) {
    a.push("--ro-bind", g.common, g.common); open(g.common);
    a.push("--bind", `${g.common}/objects`, `${g.common}/objects`);
    a.push("--bind", g.admin, g.admin); open(g.admin);
    // The branch. SBPL names the ref file, its .lock and its reflog; a bind mount cannot: git writes
    // `<ref>.lock` and renames it over `<ref>`, which needs the DIRECTORY, not the file. So the
    // directory `refs/heads/<ns>/` and `logs/refs/heads/<ns>/` are opened — for a namespaced lane
    // branch (`fleet/…`, `bau/…`) that exposes the other branches of the same namespace, never `main`.
    // A branch directly under refs/heads has no such directory to give: it gets NO branch write, the
    // same answer the profile gives a pane without a lane record.
    if (g.ref) {
      const rel = g.ref;                                  // refs/heads/<ns>/<name>
      const refDir = dirname(`${g.common}/${rel}`);
      const logDir = dirname(`${g.common}/logs/${rel}`);
      if (dirname(rel) !== "refs/heads") {
        mkdirs.push(refDir, logDir);
        a.push("--bind", refDir, refDir, "--bind", logDir, logDir);
        // ...and the siblings that EXIST are bound read-only over themselves: a bind mount point can
        // neither be written nor renamed over (EBUSY), so another lane's loose ref stays put. A
        // sibling that is only packed, or created later, is not covered (named in the docs).
        for (const dir of [refDir, logDir]) {
          let names: string[] = [];
          try { names = readdirSync(dir); } catch { /* the outer shell makes it */ }
          for (const n of names) {
            const f = `${dir}/${n}`;
            if (f !== `${g.common}/${rel}` && f !== `${g.common}/logs/${rel}` && FENCE_PATH_RE.test(f) && !n.endsWith(".lock")) a.push("--ro-bind", f, f);
          }
        }
      }
    }
  }
  for (const d of gitDirs) {
    for (const f of ["hooks", "config", "config.worktree", "commondir", "gitdir"]) if (exists(`${d}/${f}`)) a.push("--ro-bind", `${d}/${f}`, `${d}/${f}`);
  }
  if (g && exists(`${i.cwd}/.git`)) a.push("--ro-bind", `${i.cwd}/.git`, `${i.cwd}/.git`);

  // (C) masks inside the openings, AFTER every opening. Only paths that exist and lie in a mount: a
  // path outside them is already closed, and a mount over a missing path would create it on the host.
  const masked = new Set<string>();
  const mask = (p: string): void => {
    let real: string;
    try { real = realpathSync(p); } catch { return; }
    if (masked.has(real) || !FENCE_PATH_RE.test(real) || !opened.some((r) => under(real, r))) return;
    masked.add(real);
    if (lstatSync(real).isDirectory()) a.push("--tmpfs", real, "--remount-ro", real);
    else a.push("--ro-bind", "/dev/null", real);
  };
  try { for (const n of readdirSync(i.fleetDir)) if (/^(fleet\.json|\.env)/.test(n)) mask(`${i.fleetDir}/${n}`); } catch { /* no such dir */ }
  const h = i.home;
  for (const p of [`${h}/.ssh`, `${h}/.config/claude-fleet/secrets`, i.keyFile, `${h}/.codex/auth.json`, `${h}/.claude/.credentials.json`,
    `${h}/.claude.json`, `${h}/.config/gh`, `${h}/.cloudflared`, `${h}/.pi/agent/auth.json`, `${h}/.claude/projects`, `${h}/.codex/sessions`,
    `${h}/.pi/agent/sessions`, ...i.denyRoots]) mask(p);
  for (const f of PRIVATE_SCAFFOLD) mask(`${i.cwd}/${f}`);

  // The root is a tmpfs bwrap builds: without this a stray write to a path under home (a parent of some
  // opening, so it exists) would succeed into memory and read like an opening that is not one. Mounts
  // above keep their own flags, so the rw ones stay rw.
  a.push("--remount-ro", "/");
  return { args: a, mkdirs };
}
