// EIN FRISCHER BRANCH-WORKTREE BRINGT SEINE node_modules MIT (W3 Auftrag 13): ein Worktree, den die Branch-Türen anlegen (POST /api/branches und
// POST /api/self/branches, beide server.ts#createBoardBranch), hatte keine node_modules, und der erste `bunx tsc -p .` oder `bun test` des Bauers
// scheiterte an fehlenden Paketen. Hat der Baum ein bun.lock und noch keine node_modules, führt Fleet dort `bun install --frozen-lockfile` aus — im
// Hintergrund, die Tür antwortet sofort mit `install: "running"`. Das Ergebnis steht danach am Branch (GET /api/branches, GET /api/self/branch) und als
// Audit-Zeile `branch_install`; ein Fehlschlag nennt Exit-Code und die letzte Zeile von bun, nie still. Nur das Lockfile zählt: --frozen-lockfile
// holt, was es nennt, und ändert es nie; Skripte laufen keine, und das Environment ist gefiltert (unten).
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

export interface InstallStand { readonly state: "running" | "ok" | "failed"; readonly at: number; readonly error?: string }
export type InstallLauf = (cwd: string) => Promise<{ code: number; err: string }>;

/** Braucht dieser Baum ein Install? Ein bun.lock, und noch keine node_modules. */
export const brauchtInstall = (path: string): boolean => existsSync(`${path}/bun.lock`) && !existsSync(`${path}/node_modules`);

// WAS DAS INSTALL AUSFÜHRT (W3 Auftrag 15, Prüfung F1, F4): den Code eines Branches nie mit Fleets Environment. `--ignore-scripts` lässt die
// Lebenszyklus-Skripte des Wurzelpakets und der Abhängigkeiten aus (--frozen-lockfile friert nur das Lockfile) — Fleets package.json hat keine und keine
// trustedDependencies, es fehlt also nichts; die node_modules, die tsc und bun test brauchen, kommen trotzdem. Das Environment ist gefiltert: nur, was bun
// selbst zum Laden braucht (PATH, HOME, Temp, Cache, Registry, Proxy, Zertifikate) — kein FLEET_*-Token, kein Anbieter-Schlüssel. Die Frist beendet die
// ganze Prozessgruppe, nicht nur bun.
export const INSTALL_ARGS: readonly string[] = ["install", "--frozen-lockfile", "--ignore-scripts"];
const INSTALL_ENV: readonly string[] = ["PATH", "HOME", "TMPDIR", "USER", "LANG", "LC_ALL", "XDG_CACHE_HOME", "BUN_INSTALL", "BUN_INSTALL_CACHE_DIR",
  "BUN_CONFIG_REGISTRY", "NPM_CONFIG_REGISTRY", "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "no_proxy", "SSL_CERT_FILE", "NODE_EXTRA_CA_CERTS"];
/** Das Environment des Installs: nur die Namen aus INSTALL_ENV, die gesetzt sind. Rein. */
export const installEnv = (quelle: Record<string, string | undefined>): Record<string, string> =>
  Object.fromEntries(INSTALL_ENV.flatMap((k) => typeof quelle[k] === "string" && quelle[k] !== "" ? [[k, quelle[k] as string]] : []));

/** EIN BEFEHL MIT FRIST, in eigener Prozessgruppe: läuft die Frist ab, endet die ganze Gruppe (SIGKILL an -pid), auch ein Enkel, den ein Skript
 *  startete. err = die letzten Zeilen von stderr. */
export function laufeMitFrist(cmd: readonly string[], o: { cwd: string; env: Record<string, string>; fristMs: number }): Promise<{ code: number; err: string }> {
  return new Promise((fertig) => {
    let err = "";
    const child = spawn(cmd[0]!, cmd.slice(1), { cwd: o.cwd, env: o.env, detached: true, stdio: ["ignore", "ignore", "pipe"] });
    child.stderr?.on("data", (d: Buffer) => { err = (err + d.toString()).slice(-8000); });
    const gruppe = (): void => { try { if (child.pid) process.kill(-child.pid, "SIGKILL"); } catch { /* schon fort */ } };
    const timer = setTimeout(gruppe, o.fristMs);
    child.on("error", (e) => { clearTimeout(timer); fertig({ code: -1, err: e.message }); });
    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      fertig({ code: code ?? (signal ? 128 : -1), err: err.trim().split("\n").slice(-3).join(" | ").slice(0, 400) });
    });
  });
}

/** `bun install --frozen-lockfile --ignore-scripts` im Baum, mit gefiltertem Environment und Frist. Mit dem Bun, das Fleet selbst ausführt
 *  (process.execPath): der PATH eines Servers muss kein `bun` kennen (der Testserver kennt keins). */
export function bunInstall(fristMs: number): InstallLauf {
  return (cwd) => laufeMitFrist([process.execPath, ...INSTALL_ARGS], { cwd, env: installEnv(process.env), fristMs });
}

const staende = new Map<string, InstallStand>();
/** Was das Install dieses Baums zuletzt tat; null = Fleet hat dort keins gestartet. */
export const installStand = (path: string): InstallStand | null => staende.get(path) ?? null;

/** STARTET DAS INSTALL im Hintergrund, wenn der Baum eins braucht und keins läuft; `fertig` bekommt das Ergebnis (Audit, Log). Gibt den Stand
 *  zurück, den die Tür nennt, oder null, wenn nichts zu tun war. */
export function starteInstall(path: string, lauf: InstallLauf, fertig: (s: InstallStand) => void, now: () => number = Date.now): InstallStand | null {
  const da = staende.get(path);
  if (da?.state === "running") return da;
  if (!brauchtInstall(path)) return null;
  const los: InstallStand = { state: "running", at: now() };
  staende.set(path, los);
  void lauf(path).then(
    (r): InstallStand => r.code === 0 ? { state: "ok", at: now() }
      : { state: "failed", at: now(), error: `bun install --frozen-lockfile --ignore-scripts exit ${r.code}${r.err ? `: ${r.err}` : ""}` },
    (e: unknown): InstallStand => ({ state: "failed", at: now(), error: `bun install --frozen-lockfile --ignore-scripts did not run: ${e instanceof Error ? e.message : String(e)}` }),
  ).then((s) => { staende.set(path, s); fertig(s); });
  return los;
}
