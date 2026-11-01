// OPENING A FOLDER IN FLEET MEANS TRUSTING IT (plan W2, owner 2026-10-31): Claude Code asks whether you trust a folder once per
// repository and keeps the answer in `~/.claude.json` under projects[<git root, else the folder>].hasTrustDialogAccepted. A seat Fleet opens in a fresh
// repo stood still at that question (and one owner hit the preselected „[Zitat entfernt]“). Codex gets its trust on the command line; Claude
// Code has no flag for an interactive session (`--trust-workspace` belongs to `claude ultrareview`), so Fleet writes the entry
// itself before the pane starts. The start brief names it (server/fassung.ts, darf › vertrauen), and only while the entry is in the file.
//
// THE FILE IS SHARED. Every running Claude session rewrites `~/.claude.json`. Read from claude 2.1.316 (its binary; the measurements are in
// docs/messungen/2026-10-31-claude-json-vertrauen.md): a session's ordinary write is read-modify-write UNDER A LOCK — the directory `<path as Claude names
// it>.lock`, i.e. `$CLAUDE_CONFIG_DIR/.claude.json.lock` or `~/.claude.json.lock` WITHOUT resolving a symlink (npm proper-lockfile with an explicit
// lockfilePath, stale after 10 s) — re-reads the file inside the lock, applies its own change and replaces the file through a temp file
// (mode 0600, JSON.stringify with 2 spaces). Fleet takes that same lock, changes only its own project entry and replaces the file the same way,
// so the two locked writers never lose each other's change.
// BUT a session that EXITS writes its stats and plugin usage synchronously and WITHOUT the lock (process.on("exit"): read, change, write). When that
// falls on Fleet's write, Fleet's entry is gone again (measured: 2 of 1000). The loss happens DURING Fleet's own write, which vertraueOrdner can't
// see (it reads before it writes). So Fleet looks again right before the pane starts — the only look before Claude reads its config — and once
// shortly after, and sets the entry again when it is missing (vertrauenUmDenStart).
import { execFile } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";

/** REPLACE A FILE the way Claude Code and pi do: a temp file beside it with the given mode, then a rename; a temp file that was left is removed. */
function ersetzeDatei(echt: string, inhalt: string, modus: number): void {
  const tmp = `${echt}.tmp.${process.pid}.${randomBytes(6).toString("hex")}`;
  try { writeFileSync(tmp, inhalt, { mode: modus }); renameSync(tmp, echt); }
  catch (e) { try { unlinkSync(tmp); } catch { /* never written */ } throw e; }
}
const modusVon = (p: string): number => { try { return lstatSync(p).mode & 0o777; } catch { return 0o600; } };

export type VertrauenArt =
  | "gesetzt"      // Fleet wrote the entry just now
  | "schon"        // the folder was already trusted (by the person, or by an earlier Fleet start)
  | "ohne-datei"   // no ~/.claude.json: a Claude Code that never ran here would ask for its onboarding first; Fleet creates nothing
  | "nicht-lesbar" // the file is not JSON (or not an object): Fleet leaves it alone
  | "gesperrt"     // the lock was held for the whole wait: Fleet leaves it alone and the dialog (with its hint line) stays the way
  | "abgelehnt"    // pi's home says "do not trust" for this folder: a decision, left alone
  | "ausgenommen"  // the home folder: Claude Code holds that trust for the session only and never writes it, so Fleet does not either
  | "fehler";      // any other failure; the reason says which
export interface Vertrauen { art: VertrauenArt; schluessel: string; datei: string; grund?: string }

const LOCK_STALE_MS = 10_000;   // proper-lockfile's default, which Claude Code uses
const WARTE_MAX_MS = 5_000;     // longer than any write of a session (a few milliseconds)

/** Where Claude Code keeps its global config: `$CLAUDE_CONFIG_DIR/.claude.json`, else `~/.claude.json`. `home` is the HOME claude runs under
 *  (a test instance with real seats: the owner's, FLEET_CLAUDE_HOME). */
export const claudeJsonPfad = (home: string, env: Record<string, string | undefined> = process.env): string =>
  env.CLAUDE_CONFIG_DIR ? join(env.CLAUDE_CONFIG_DIR, ".claude.json") : join(home, ".claude.json");

/** THE KEY CLAUDE CODE TRUSTS BY (code.claude.com/docs/en/permissions, "Project allow rules and workspace trust"): in a git repository the
 *  repository root — in a LINKED worktree the root of the MAIN checkout —, outside one the folder itself. Claude's own test for a linked worktree is
 *  that git's dir and its common dir differ; a repository whose git dir merely lives elsewhere (`git init --separate-git-dir=/X/store/.git /X/work`)
 *  is no worktree, and its key is its own top level. Whatever git cannot answer falls back to the folder. */
export async function vertrauensSchluessel(cwd: string): Promise<string> { return (await schluesselMitArt(cwd)).schluessel; }

/** What the key names, for the line: a whole repository (its worktrees included), one worktree of a BARE repository (Claude keys it on the worktree
 *  itself and trusts what lies below it, not the other worktrees), or a folder outside git. */
type Schluessel = { schluessel: string; art: "repo" | "worktree" | "ordner" };
async function schluesselMitArt(cwd: string): Promise<Schluessel> {
  const ordner = realpathSync(cwd);
  const git = (args: string[]): Promise<string | null> => new Promise((ok) => {
    execFile("git", ["-C", ordner, ...args], { timeout: 5_000, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } }, (e, out) => ok(e ? null : String(out).trim() || null));
  });
  const [gitDir, common] = (await git(["rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir"]))?.split("\n") ?? [];
  const verknuepft = !!gitDir && !!common && realpathLoose(gitDir) !== realpathLoose(common);
  if (verknuepft && common.endsWith("/.git")) {
    try { return { schluessel: realpathSync(dirname(common)), art: "repo" }; } catch { /* fall through */ }
  }
  const top = await git(["rev-parse", "--show-toplevel"]);
  if (top) { try { return { schluessel: realpathSync(top), art: verknuepft ? "worktree" : "repo" }; } catch { /* fall through */ } }
  return { schluessel: ordner, art: "ordner" };
}

const realpathLoose = (p: string): string => { try { return realpathSync(p); } catch { return p; } };
export const istSymlink = (p: string): boolean => { try { return lstatSync(p.replace(/\/+$/, "") || "/").isSymbolicLink(); } catch { return false; } };
const realpathAufwaerts = (p: string): string => {
  for (let rest = "", q = p; ; rest = `/${q.slice(q.lastIndexOf("/") + 1)}${rest}`, q = dirname(q)) {
    try { return realpathSync(q) + rest; } catch { if (dirname(q) === q) return p; }
  }
};

/** THE FOLDERS FLEET SET THE TRUST FOR (`<config file>\0<key>` for claude, `<agent home>\0<key>` for pi: the same folder in another file is not Fleet's): the start brief keeps naming the trust while the entry
 *  is there because Fleet wrote it. Kept in Fleet's own state (vertrauenMerkenIn), so a preview and the start that holds it agree across a server
 *  restart: in memory only, the restarted server took its own entry for one that was there before Fleet and dropped the line, and the shown hash
 *  no longer matched. Without a file (unit tests, tools), this process only. */
let MERKDATEI: string | null = null;
let GESETZT: Set<string> | null = null;
export function vertrauenMerkenIn(datei: string | null): void { MERKDATEI = datei; GESETZT = null; }
const gesetzt = (): Set<string> => {
  if (GESETZT) return GESETZT;
  let liste: unknown = [];
  try { if (MERKDATEI && existsSync(MERKDATEI)) liste = (JSON.parse(readFileSync(MERKDATEI, "utf8")) as { gesetzt?: unknown }).gesetzt; } catch { /* unreadable: start empty */ }
  return GESETZT = new Set(Array.isArray(liste) ? liste.filter((x): x is string => typeof x === "string") : []);
};
const merkeGesetzt = (id: string): void => {
  const g = gesetzt();
  if (g.has(id)) return;
  g.add(id);
  try { if (MERKDATEI) ersetzeDatei(MERKDATEI, JSON.stringify({ v: 1, gesetzt: [...g] }, null, 2), 0o600); } catch { /* this process still knows it */ }
};
/** ...and the ones whose last write failed (lock held, error): the start brief does not promise them. */
const GESCHEITERT = new Set<string>();

/** TAKE BACK what Fleet set for the folders under `wurzel`: a test instance with real seats opens its fixtures in the owner's real HOME, so its
 *  folders leave entries in the owner's file. `down` and `reap` remove them (tools/vertrauen-vergessen.ts), under the same lock, touching only
 *  keys that are `wurzel` or lie below it. Returns how many were removed. Never throws. A `wurzel` that is ITSELF a symlink is refused (0): it
 *  would resolve to the folder it points at and take the owner's entries there (the tool can be run by hand); a symlinked parent still resolves. */
export async function vergissOrdnerUnter(wurzel: string, datei: string): Promise<number> {
  if (istSymlink(wurzel)) return 0;
  // the folder may be gone already (a trap that runs after `rm -rf`): its keys carry the REAL path (/private/var/… for /var/…), so the nearest
  // folder that still stands is resolved and the rest appended
  const w = realpathAufwaerts(wurzel);
  try {
    if (!existsSync(datei)) return 0;
    const echt = realpathSync(datei);
    // the lock under the path as Claude Code names it, the write into the real file (a symlinked config stays a symlink)
    const r = await mitSperre(`${datei}.lock`, (): number => {
      const o: unknown = JSON.parse(readFileSync(echt, "utf8"));
      if (!istObjekt(o) || !istObjekt(o.projects)) return 0;
      const weg = Object.keys(o.projects).filter((k) => k === w || k.startsWith(`${w}/`) || k === wurzel || k.startsWith(`${wurzel}/`));
      if (!weg.length) return 0;
      for (const k of weg) delete o.projects[k];
      ersetzeDatei(echt, JSON.stringify(o, null, 2), modusVon(echt));
      return weg.length;
    });
    return r === "gesperrt" ? 0 : r;
  } catch { return 0; }
}

/** THE LINE ITSELF: what is trusted, and that it stays. It names no opener: the start is hashed, and a value of the occupancy (a slot, who opened
 *  it) is no part of it — the window can't know who will open, and the door stamps the opener only after the start (orchestrator, 31.10.); who
 *  opened the seat stands under Info. Present tense — the start window shows it before the start (what Fleet
 *  sets when the seat starts), a running seat's start brief while the entry is in the file. */
const WAS: Record<Schluessel["art"], (k: string) => string> = {
  repo: (k) => `the whole repository ${k} for Claude Code, every folder and worktree of it,`,
  worktree: (k) => `the worktree ${k} for Claude Code, and every folder below it,`,
  ordner: (k) => `the folder ${k} for Claude Code, and every folder below it,`,
};
const vertrauenSatz = (k: Schluessel, datei: string): string =>
  `Fleet trusts ${WAS[k.art](k.schluessel)} ` +
  `because this seat was opened in it; the entry stays in ${kurzPfad(datei)} after this seat and holds for Claude Code outside Fleet too\n` +
  `projects["${k.schluessel}"].hasTrustDialogAccepted = true in ${kurzPfad(datei)}; without it Claude Code stops at "Accessing workspace … Yes, I trust this folder" and waits for a person`;

/** THE START BRIEF'S LINE (darf › vertrauen) for a start that is computed now — the start window, and the start a seat holds as it opens, both
 *  before ensureSlot writes. It stands when Fleet sets the entry for this start: the entry is missing (also when an entry Fleet wrote earlier
 *  vanished — ensureSlot writes it again) and Fleet's last try for it did not fail (lock held, error); or the entry is there because Fleet wrote it. Not when the folder was trusted before
 *  Fleet came, not for the home folder, not without a config file Fleet can read. Read only. */
export async function vertrauenText(cwd: string, datei: string, home?: string): Promise<string | null> {
  let k: Schluessel;
  try { k = await schluesselMitArt(cwd); } catch { return null; }
  if (home && k.schluessel === realpathLoose(home)) return null;
  const stand = await vertrauenStand(cwd, datei, k.schluessel);
  if (!stand) return null;
  if (stand.vertraut ? !gesetzt().has(`${datei}\0${k.schluessel}`) : GESCHEITERT.has(k.schluessel)) return null;
  return vertrauenSatz(k, datei);
}

/** THE LINE OF A RUNNING SEAT whose start carried it (the start brief of `anlass=laufend`, server.ts): it stands ONLY while the entry is in the
 *  file — gone after a write that failed or an exit write Fleet could not repair —, word for word as the start had it. Read only. */
export async function vertrauenJetzt(cwd: string, datei: string, home?: string): Promise<string | null> {
  let k: Schluessel;
  try { k = await schluesselMitArt(cwd); } catch { return null; }
  if (home && k.schluessel === realpathLoose(home)) return null;
  return (await vertrauenStand(cwd, datei, k.schluessel))?.vertraut ? vertrauenSatz(k, datei) : null;
}

const schlaf = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const istObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** READ ONLY: is this folder already trusted in the file? null = no readable file. Never writes, never takes the lock. `bekannt`: the key, when the
 *  caller has it already (it costs two git processes). */
export async function vertrauenStand(cwd: string, datei: string, bekannt?: string): Promise<{ schluessel: string; vertraut: boolean } | null> {
  let schluessel: string;
  try { schluessel = bekannt ?? await vertrauensSchluessel(cwd); } catch { return null; }
  try {
    const o: unknown = JSON.parse(readFileSync(datei, "utf8"));
    if (!istObjekt(o) || (o.projects !== undefined && !istObjekt(o.projects))) return null;
    const p = istObjekt(o.projects) ? o.projects[schluessel] : undefined;
    return { schluessel, vertraut: istObjekt(p) && p.hasTrustDialogAccepted === true };
  } catch { return null; }
}

async function mitSperre<T>(sperre: string, tu: () => T): Promise<T | "gesperrt"> {
  const bis = Date.now() + WARTE_MAX_MS;
  for (let versuch = 0; ; versuch++) {
    try { mkdirSync(sperre, { mode: 0o755 }); break; }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      // a lock whose holder died: proper-lockfile takes it over after the stale time, so does Fleet
      try { if (Date.now() - statSync(sperre).mtimeMs > LOCK_STALE_MS) { rmdirSync(sperre); continue; } } catch { continue; }
      if (Date.now() >= bis) return "gesperrt";
      await schlaf(15 + Math.random() * 45);
    }
  }
  try { return tu(); }
  finally { try { rmdirSync(sperre); } catch { /* already gone: the file stays valid either way */ } }
}

/**
 * Trust `cwd` for Claude Code: set projects[vertrauensSchluessel(cwd)].hasTrustDialogAccepted = true in the config file, under Claude Code's own
 * lock, touching nothing else. Idempotent. Never throws: the answer says what happened, and a seat that could not be trusted still
 * starts (its dialog and hint line are the fallback).
 */
export async function vertraueOrdner(cwd: string, datei: string, home?: string): Promise<Vertrauen> {
  let schluessel = cwd;
  try { schluessel = await vertrauensSchluessel(cwd); } catch (e) { return { art: "fehler", schluessel, datei, grund: `folder not found: ${(e as Error).message}` }; }
  if (home && schluessel === realpathLoose(home)) return { art: "ausgenommen", schluessel, datei };
  if (!existsSync(datei)) return { art: "ohne-datei", schluessel, datei };
  try {
    // THE LOCK UNDER THE PATH AS CLAUDE CODE NAMES IT (`${configFile}.lock`, no realpath: with a symlinked config a lock next to the real file
    // would never meet a session's); the write goes into the real file, so a symlinked config stays a symlink
    const echt = realpathSync(datei);
    const r = await mitSperre(`${datei}.lock`, (): Vertrauen => {
      const roh = readFileSync(echt, "utf8");
      let o: unknown;
      try { o = JSON.parse(roh); } catch { return { art: "nicht-lesbar", schluessel, datei, grund: "~/.claude.json is not valid JSON" }; }
      if (!istObjekt(o)) return { art: "nicht-lesbar", schluessel, datei, grund: "~/.claude.json is not a JSON object" };
      // a `projects` that is there but no object is a shape Fleet does not know: leave the whole file as it is
      if (o.projects !== undefined && !istObjekt(o.projects)) return { art: "nicht-lesbar", schluessel, datei, grund: "projects in ~/.claude.json is not a JSON object" };
      const projekte = istObjekt(o.projects) ? o.projects : {};
      const alt = projekte[schluessel];
      if (istObjekt(alt) && alt.hasTrustDialogAccepted === true) return { art: "schon", schluessel, datei };
      // only this project's entry changes; a missing one gets what Claude Code itself writes for a folder it was never asked about
      const neu = { ...(istObjekt(alt) ? alt : { allowedTools: [], mcpContextUris: [], mcpServers: {}, enabledMcpjsonServers: [], disabledMcpjsonServers: [] }),
        hasTrustDialogAccepted: true };
      o.projects = { ...projekte, [schluessel]: neu };
      ersetzeDatei(echt, JSON.stringify(o, null, 2), modusVon(echt));
      merkeGesetzt(`${datei}\0${schluessel}`);
      return { art: "gesetzt", schluessel, datei };
    });
    if (r === "gesperrt") { GESCHEITERT.add(schluessel); return { art: "gesperrt", schluessel, datei, grund: `the config lock was held for ${WARTE_MAX_MS / 1000} s` }; }
    if (r.art === "gesetzt" || r.art === "schon") GESCHEITERT.delete(schluessel);
    return r;
  } catch (e) {
    GESCHEITERT.add(schluessel);
    return { art: "fehler", schluessel, datei, grund: (e as Error).message };
  }
}

/** HOW LONG AFTER THE PANE STARTS Fleet looks again: Claude Code has read its config by then, and a session that exited during the start has written. */
export const NACHSCHAU_MS = 2_000;

/** LOOK AGAIN AND SET IT AGAIN WHEN IT IS GONE: a session that exits writes `~/.claude.json` without the lock (see the head of this file) and can drop
 *  the entry Fleet just set. Reads without the lock while the entry is there; only a missing entry takes the lock (vertraueOrdner). Never throws. */
export async function vertrauenNachsehen(cwd: string, datei: string, home?: string, schluessel?: string): Promise<Vertrauen> {
  const stand = await vertrauenStand(cwd, datei, schluessel);
  if (stand?.vertraut) return { art: "schon", schluessel: stand.schluessel, datei };
  return vertraueOrdner(cwd, datei, home);
}

/** AROUND THE PANE'S START (ensureSlot, after vertraueOrdner set or found the entry under `schluessel`): look right before `starte`, start, and look
 *  once more `nachMs` later. The look before is a file read (the key is given, no git): it is the only one that comes before Claude Code reads its
 *  config, and it catches the entry an exit write dropped during Fleet's own write. `nachschau` is the second look; ensureSlot doesn't wait for
 *  it, `melde` hears both looks, and it never rejects. */
export async function vertrauenUmDenStart<T>(cwd: string, datei: string, home: string | undefined, schluessel: string, starte: () => Promise<T>,
  o: { nachMs?: number; melde?: (wann: "vor" | "nach", v: Vertrauen) => void } = {}): Promise<{ ergebnis: T; nachschau: Promise<Vertrauen | null> }> {
  const vor = await vertrauenNachsehen(cwd, datei, home, schluessel);
  o.melde?.("vor", vor);
  const ergebnis = await starte();
  const nachschau = schlaf(o.nachMs ?? NACHSCHAU_MS).then(() => vertrauenNachsehen(cwd, datei, home, schluessel))
    .then((v) => { o.melde?.("nach", v); return v; }).catch(() => null);
  return { ergebnis, nachschau };
}

// ── pi ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// pi (pi-coding-agent 1.0.2, dist/core/trust-manager.js) keeps its project trust in <agent home>/trust.json: an object path → true/false,
// the NEAREST entry on the way up from the folder counts, keys are canonical (real) paths. It reads and writes the file under the lock
// directory trust.json.lock (proper-lockfile again, 10 s stale). It asks only for a folder with project resources (.pi/ entries or
// .agents/skills in the folder or above), and a fenced pi-zai/pi-deepseek seat starts with --no-approve and is never asked. Which agent home
// is Fleet's to write into is the caller's decision: Fleet's own (FLEET_PI_AGENT_DIR) yes, the owner's ~/.pi/agent no (owner's word needed).
export const piTrustDatei = (agentDir: string): string => join(agentDir, "trust.json");

function piLiesTrust(datei: string): Record<string, boolean | null> | "nicht-lesbar" {
  if (!existsSync(datei)) return {};
  try {
    const o: unknown = JSON.parse(readFileSync(datei, "utf8").replace(/^\uFEFF/, ""));
    if (!istObjekt(o) || !Object.values(o).every((v) => v === true || v === false || v === null)) return "nicht-lesbar";
    return o as Record<string, boolean | null>;
  } catch { return "nicht-lesbar"; }
}
/** pi's rule: the entry of the folder or of its nearest ancestor that has one. */
function piNaechster(daten: Record<string, boolean | null>, ordner: string): { pfad: string; entscheidung: boolean } | null {
  for (let p = ordner; ; p = dirname(p)) {
    const v = daten[p];
    if (v === true || v === false) return { pfad: p, entscheidung: v };
    if (dirname(p) === p) return null;
  }
}

/** Trust `cwd` for pi in the agent home `agentDir`: trust.json[realpath(cwd)] = true, under pi's own lock, other entries untouched. A folder the
 *  home explicitly distrusts (false) stays so — that is a decision, not an unanswered question. Never throws. */
export async function vertraueOrdnerPi(cwd: string, agentDir: string): Promise<Vertrauen> {
  const datei = piTrustDatei(agentDir);
  let schluessel = cwd;
  try { schluessel = realpathSync(cwd); } catch (e) { return { art: "fehler", schluessel, datei, grund: `folder not found: ${(e as Error).message}` }; }
  try {
    mkdirSync(agentDir, { recursive: true });
    const r = await mitSperre(`${datei}.lock`, (): Vertrauen => {
      const daten = piLiesTrust(datei);
      if (daten === "nicht-lesbar") return { art: "nicht-lesbar", schluessel, datei, grund: "trust.json is not a valid trust store" };
      const n = piNaechster(daten, schluessel);
      if (n?.entscheidung === true) return { art: "schon", schluessel, datei };
      if (n?.entscheidung === false) return { art: "abgelehnt", schluessel, datei, grund: `${n.pfad} is distrusted in ${datei}` };
      daten[schluessel] = true;
      const sortiert = Object.fromEntries(Object.keys(daten).sort().map((k) => [k, daten[k]]));
      ersetzeDatei(datei, `${JSON.stringify(sortiert, null, 2)}\n`, 0o600);
      merkeGesetzt(`${agentDir}\0${schluessel}`);
      return { art: "gesetzt", schluessel, datei };
    });
    const id = `${agentDir}\0${schluessel}`;
    if (r === "gesperrt") { GESCHEITERT_PI.add(id); return { art: "gesperrt", schluessel, datei, grund: `the trust lock was held for ${WARTE_MAX_MS / 1000} s` }; }
    if (r.art === "gesetzt" || r.art === "schon") GESCHEITERT_PI.delete(id);
    return r;
  } catch (e) {
    GESCHEITERT_PI.add(`${agentDir}\0${schluessel}`);
    return { art: "fehler", schluessel, datei, grund: (e as Error).message };
  }
}
const GESCHEITERT_PI = new Set<string>();

const vertrauenSatzPi = (schluessel: string, agentDir: string): string => {
  const datei = kurzPfad(piTrustDatei(agentDir));
  return `Fleet trusts the folder ${schluessel} for pi, and every folder below it, because this seat was opened in it; the entry stays in ${datei} after this seat and holds for every pi that runs with that agent home\n` +
    `${datei}["${schluessel}"] = true; without it pi can stop at its project-trust question and wait for a person`;
};

/** The start brief's line for a pi seat (darf › vertrauen), computed now — as vertrauenText: when Fleet sets the entry for this start. Not when the
 *  folder was trusted or distrusted before, not after a write that failed, not without a readable store. Read only. */
export async function vertrauenTextPi(cwd: string, agentDir: string): Promise<string | null> {
  let schluessel: string;
  try { schluessel = realpathSync(cwd); } catch { return null; }
  const daten = piLiesTrust(piTrustDatei(agentDir));
  if (daten === "nicht-lesbar") return null;
  const id = `${agentDir}\0${schluessel}`;
  const n = piNaechster(daten, schluessel);
  if (n?.entscheidung === false) return null;
  if (n?.entscheidung === true ? !gesetzt().has(id) : GESCHEITERT_PI.has(id)) return null;
  return vertrauenSatzPi(schluessel, agentDir);
}

/** The line of a running pi seat whose start carried it: only while trust.json holds the folder's entry. Read only. */
export async function vertrauenJetztPi(cwd: string, agentDir: string): Promise<string | null> {
  let schluessel: string;
  try { schluessel = realpathSync(cwd); } catch { return null; }
  const daten = piLiesTrust(piTrustDatei(agentDir));
  return daten !== "nicht-lesbar" && daten[schluessel] === true ? vertrauenSatzPi(schluessel, agentDir) : null;
}
const kurzPfad = (p: string): string => p.replace(/^\/(?:Users|home)\/[^/]+(?=\/)/, "~");
