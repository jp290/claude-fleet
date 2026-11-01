// EIN FRISCHER BRANCH-WORKTREE BRINGT SEINE node_modules MIT (W3 Auftrag 13, server/branch-install.ts): die Branch-Tür legt den Worktree an, antwortet
// sofort mit `install: "running"`, und Fleet führt `bun install --frozen-lockfile` dort aus. Ein Install, das am Lockfile scheitert, steht mit Grund am
// Branch und im Audit. Das Fixture-Repo hängt nur an einer Datei-Abhängigkeit (file:./lokal), so läuft bun ohne Netz.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { INSTALL_ARGS, installEnv, laufeMitFrist } from "./branch-install";
import { branchTestkit, type Fixture, LIFE_DEADLINE_MS, sh } from "./branches-testkit";

const { fixture, serve, cleanup } = branchTestkit();
afterAll(cleanup);

// ein Repo mit bun.lock: package.json mit einer lokalen Abhängigkeit, node_modules ignoriert; dazu ein Branch, dessen package.json nicht zum Lockfile passt.
// Das Wurzelpaket hat ein postinstall, das Fleets Token in lauf.txt schriebe (W3 Auftrag 15, F1): läuft das Install des Branches seine Skripte, liegt
// die Datei danach im Worktree.
function mitLockfile(f: Fixture): void {
  mkdirSync(join(f.repo, "lokal"), { recursive: true });
  writeFileSync(join(f.repo, "lokal", "package.json"), JSON.stringify({ name: "lokal", version: "1.0.0" }));
  writeFileSync(join(f.repo, "package.json"), JSON.stringify({ name: "fixture", private: true, scripts: { postinstall: POSTINSTALL }, dependencies: { lokal: "file:./lokal" } }, null, 2));
  writeFileSync(join(f.repo, ".gitignore"), "node_modules/\nlauf.txt\n");
  const inst = Bun.spawnSync(["bun", "install", "--ignore-scripts"], { cwd: f.repo, stdout: "ignore", stderr: "pipe" });
  if (inst.exitCode !== 0) throw new Error(`bun install im Fixture: ${inst.stderr.toString()}`);
  sh(f.repo, "add", "package.json", "bun.lock", "lokal/package.json", ".gitignore");
  sh(f.repo, "commit", "-q", "-m", "bun.lock");
  const tmp = join(f.state, "kaputt-wt");
  sh(f.repo, "worktree", "add", "-q", "-b", "kaputt-basis", tmp);
  mkdirSync(join(tmp, "fehlt"), { recursive: true });
  writeFileSync(join(tmp, "fehlt", "package.json"), JSON.stringify({ name: "fehlt", version: "1.0.0" }));
  writeFileSync(join(tmp, "package.json"), JSON.stringify({ name: "fixture", private: true, dependencies: { lokal: "file:./lokal", fehlt: "file:./fehlt" } }, null, 2));
  sh(tmp, "add", "package.json", "fehlt/package.json");
  sh(tmp, "commit", "-q", "-m", "package.json ohne Lockfile");
  sh(f.repo, "worktree", "remove", "--force", tmp);
}
const POSTINSTALL = 'echo "${FLEET_TOKEN:-ohne}" > lauf.txt';
type Install = { state: string; error?: string } | undefined;
const installVon = (body: Record<string, unknown>, branch: string): Install =>
  ((body.repos as { branches: { branch: string; install?: Install }[] }[] | undefined) ?? []).flatMap((r) => r.branches).find((b) => b.branch === branch)?.install;

describe("der frische Branch-Worktree bekommt seine node_modules", () => {
  test("die Branch-Tür antwortet sofort, Fleet installiert nach dem Lockfile; ein Lockfile, das nicht passt, steht mit Grund am Branch und im Audit", async () => {
    const f = fixture();
    mitLockfile(f);
    const srv = await serve(f);
    try {
      const gut = await srv.call("/api/branches", { body: { repo: f.repo, name: "Bau" } });
      const kaputt = await srv.call("/api/branches", { body: { repo: f.repo, name: "Kaputt", base: "kaputt-basis" } });
      expect([gut.status, kaputt.status]).toEqual([201, 201]);
      expect([gut.body.install, kaputt.body.install]).toEqual(["running", "running"]);
      const pfad = String(gut.body.path), bGut = String(gut.body.branch), bKaputt = String(kaputt.body.branch);
      let a: Install, b: Install;
      for (let i = 0; i < 150; i++) {
        const v = await srv.call("/api/branches");
        a = installVon(v.body, bGut); b = installVon(v.body, bKaputt);
        if (a?.state !== "running" && b?.state !== "running") break;
        await Bun.sleep(200);
      }
      expect({ state: a?.state, error: a?.error }).toEqual({ state: "ok", error: undefined });
      expect(existsSync(join(pfad, "node_modules", "lokal", "package.json"))).toBe(true);
      expect(b?.state).toBe("failed");
      expect(String(b?.error)).toContain("bun install --frozen-lockfile --ignore-scripts exit");
      expect(existsSync(join(pfad, "lauf.txt"))).toBe(false);
      const audit = readFileSync(join(f.state, "audit.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as { event: string; detail?: string })
        .filter((r) => r.event === "branch_install").map((r) => String(r.detail));
      expect(audit.some((d) => d.includes(bGut) && d.includes(": ok"))).toBe(true);
      expect(audit.some((d) => d.includes(bKaputt) && d.includes(": failed — bun install --frozen-lockfile --ignore-scripts exit"))).toBe(true);
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 6);
});

describe("das Install führt keinen Code des Branches mit Fleets Environment aus, und seine Frist endet für alle", () => {
  test("F1: Skripte aus, und im Environment des Installs steht kein FLEET_* und kein Anbieter-Schlüssel", () => {
    expect(INSTALL_ARGS).toContain("--ignore-scripts");
    expect(installEnv({ FLEET_TOKEN: "t", FLEET_SELF_TOKEN: "s", FLEET_SELF_URL: "u", ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o", PATH: "/bin", HOME: "/h" }))
      .toEqual({ PATH: "/bin", HOME: "/h" });
  });
  test("F4: läuft die Frist ab, endet auch der Enkel, den ein Skript im Hintergrund startete", async () => {
    const dir = join(tmpdir(), `frist-${process.pid}-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const r = await laufeMitFrist(["sh", "-c", "sleep 30 & echo $! > enkel.pid; sleep 30"], { cwd: dir, env: installEnv(process.env), fristMs: 500 });
    expect(r.code).not.toBe(0);
    const pid = Number(readFileSync(join(dir, "enkel.pid"), "utf8").trim());
    expect(pid).toBeGreaterThan(0);
    const lebt = (): boolean => { try { process.kill(pid, 0); return true; } catch { return false; } };
    for (let i = 0; i < 20 && lebt(); i++) await Bun.sleep(50);
    const nochDa = lebt();
    if (nochDa) process.kill(pid, "SIGKILL");
    expect(nochDa).toBe(false);
  }, 10_000);
});
