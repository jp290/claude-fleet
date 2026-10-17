// Neuaufbau K5: was die Routen-Tests der Branches teilen (server/branches-routes.test.ts,
// server/branches-charge.test.ts). Jedes `life` ist ein Leben des Servers in einem eigenen Prozess
// (server/branches.drive.ts): Zustand laden, Boot-Umschlüsselung, Anfragen; zwei Leben nacheinander
// sind ein Neustart. Ein Kit je Testdatei, mit eigenem Temp-Ordner, den `cleanup` wieder nimmt.
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface Answer { status: number; body: Record<string, unknown> }
export interface Fixture { repo: string; state: string; token: string; sock: string }
export type BranchRow = { branch: string; name: string; text: string; rev: number; path: string | null; head: string;
  session: { slot: number; openedAt: number } | null;
  seen: { head: string; via: string } | null; distance: { ahead: number; behind: number } | null;
  lands: { sha: string; subject: string; points: string[]; passt: boolean; checked: boolean; form?: string }[]; landForm: string;
  chargeBase: string | null; chargeCommits: number | null; check: { state: string; at: number | null; why: string | null } | null };
export const LIFE_DEADLINE_MS = 30_000;
const DRIVE = join(import.meta.dir, "branches.drive.ts");

export function sh(cwd: string, ...args: string[]): string {
  const r = Bun.spawnSync(["git", "-C", cwd, ...args], { env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t",
    GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
  if (r.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr.toString()}`);
  return r.stdout.toString().trim();
}
export function commitIn(path: string, file: string, subject: string): string {
  writeFileSync(join(path, file), `${subject}\n`);
  sh(path, "add", file);
  sh(path, "commit", "-q", "-m", subject);
  return sh(path, "rev-parse", "HEAD");
}
function freePort(): number {
  const probe = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
  const port = probe.port;
  probe.stop(true);
  if (port === undefined) throw new Error("kein freier Port");
  return port;
}
export const post = (path: string, body: unknown, token?: string | null) => ({ method: "POST", path, body, ...(token === undefined ? {} : { token }) });
export const get = (path: string) => ({ method: "GET", path });
export function rowsOf(a: Answer, repo: string): { branches: BranchRow[]; others: { branch: string; path: string | null }[] } {
  const repos = (a.body as { repos?: { repo: string; branches: BranchRow[]; others: { branch: string; path: string | null }[] }[] }).repos ?? [];
  const r = repos.find((x) => x.repo === repo);
  if (!r) throw new Error(`Repo ${repo} fehlt in GET /api/branches: ${JSON.stringify(a.body).slice(0, 300)}`);
  return r;
}
export const persisted = (f: Fixture): Record<string, unknown> =>
  JSON.parse(readFileSync(join(f.state, "fleet.json"), "utf8")) as Record<string, unknown>;

export function branchTestkit() {
  const TMP = realpathSync(mkdtempSync(join(tmpdir(), "fleet-branches-")));
  // Eine Pane startet hier nie einen Agenten: `claude` ist ein Ersatz in TMP/bin, der nur wartet, und
  // PATH enthält das echte nicht. Der Befehlsname muss `claude` sein, denn nur dann hält der Server die
  // Session-Id fest (server.ts#IS_CLAUDE, pinsSession), die „Fortsetzen“ braucht. Transkripte liegen
  // im Temp-Ordner, tmux-Sockets in einem kurzen eigenen (ein Unix-Socket-Pfad hat höchstens 104 Zeichen).
  const PROJECTS = join(TMP, "claude-projects");
  const BIN = join(TMP, "bin");
  mkdirSync(BIN);
  writeFileSync(join(BIN, "claude"), "#!/bin/sh\nexec sleep 600\n", { mode: 0o755 });
  const TOOLS = ["git", "tmux"].map((tool) => Bun.which(tool)).map((found) => (found ? dirname(found) : null));
  const PANE_PATH = [BIN, ...new Set(TOOLS.filter((d): d is string => d !== null)), "/usr/bin", "/bin"].join(":");
  if (Bun.which("claude", { PATH: PANE_PATH }) !== join(BIN, "claude")) throw new Error(`PATH der Panes fände ein echtes claude: ${PANE_PATH}`);
  const SOCKETS = mkdtempSync("/tmp/fbr-");
  const sockets: string[] = [];
  let fixtures = 0;
  // ein Repo mit einem Commit auf main, ein leeres Zustandsverzeichnis, ein Owner-Token
  function fixture(): Fixture {
    const dir = join(TMP, `f${++fixtures}`);
    const repo = join(dir, "repo"), state = join(dir, "state");
    mkdirSync(repo, { recursive: true });
    mkdirSync(state);
    sh(repo, "init", "-q", "-b", "main");
    writeFileSync(join(repo, "README"), "fixture\n");
    sh(repo, "add", "README");
    sh(repo, "commit", "-q", "-m", "start");
    const sock = `fb${process.pid % 1000}x${fixtures}`;
    sockets.push(sock);
    return { repo, state, token: `owner-${process.pid}-${fixtures}`, sock };
  }
  // `extra`: Umgebung nur für dieses Leben, etwa ein Tier-2-Audit-Befehl (FLEET_POSTLAND_AUDIT_CMD)
  async function life(f: Fixture, steps: unknown[], extra: Record<string, string> = {}): Promise<Answer[]> {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env))
      if (value !== undefined && !key.startsWith("FLEET_")) env[key] = value;
    const proc = Bun.spawn([process.execPath, DRIVE, JSON.stringify(steps)], { cwd: f.state, stdout: "pipe", stderr: "pipe",
      env: { ...env, FLEET_HOST: "127.0.0.1", FLEET_PORT: String(freePort()), FLEET_SOCK: f.sock, TMUX_TMPDIR: SOCKETS, FLEET_CMD: "claude",
        PATH: PANE_PATH, FLEET_CLAUDE_PROJECTS_DIR: PROJECTS, FLEET_STATE_DIR: f.state, FLEET_TOKEN: f.token, FLEET_DISPATCH_REPO: f.repo,
        GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t", ...extra } });
    const deadline = setTimeout(() => proc.kill("SIGKILL"), LIFE_DEADLINE_MS);
    const code = await proc.exited;
    clearTimeout(deadline);
    const stdout = await new Response(proc.stdout).text();
    if (code !== 0) throw new Error(`Leben endete mit ${code}: ${(await new Response(proc.stderr).text()).slice(-2000)}`);
    return JSON.parse(stdout.trim().split("\n").at(-1) ?? "[]") as Answer[];
  }
  function cleanup(): void {
    for (const sock of sockets) Bun.spawnSync(["tmux", "-L", sock, "kill-server"], { env: { ...process.env, TMUX_TMPDIR: SOCKETS } });
    rmSync(TMP, { recursive: true, force: true });
    rmSync(SOCKETS, { recursive: true, force: true });
  }
  return { TMP, PROJECTS, BIN, fixture, life, cleanup };
}
