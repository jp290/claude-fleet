// Die Fixture- und Scratch-Server der e2e-Suite (tools/perf-probe.ts, e2e/state-snapshot.ts, e2e/trace.ts …) kopieren server/ und andere Ordner, aber nicht e2e/.
// Das Siegel-Modul muss dort laden, auch ohne e2e/ctx.ts: ein Check lief rot (30.10., Run 1030020630-eece66ec), weil es "../e2e/ctx" importierte.
import { afterAll, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SHARD_UNITS } from "../e2e/ctx";
import { einheitenAusQuelltext } from "./pruef-siegel";

const base = realpathSync(mkdtempSync(join(tmpdir(), "fleet-siegel-fixture-")));
afterAll(() => rmSync(base, { recursive: true, force: true }));

test("das Siegel-Modul lädt in einer Fixture-Kopie von server/ ohne e2e/ und schließt dort zu (keine Units, keine Deckung)", () => {
  cpSync(join(import.meta.dir), join(base, "server"), { recursive: true });
  const p = Bun.spawnSync([process.execPath, "-e",
    'const m = await import("./server/pruef-siegel.ts"); console.log(JSON.stringify({ units: m.geforderteUnits(), stimmt: await m.tabelleStimmt(".", "a".repeat(40)) }));'],
    { cwd: base, stdout: "pipe", stderr: "pipe" });
  expect(p.stderr.toString()).not.toContain("Cannot find module");
  expect(p.exitCode).toBe(0);
  expect(JSON.parse(p.stdout.toString().trim().split("\n").at(-1)!)).toEqual({ units: [], stimmt: false });
});

test("ein Server aus einer Kopie des Checkouts OHNE e2e/ startet und antwortet (so bootet ein Fixture-Server der Suite)", async () => {
  const kopie = join(base, "kopie");
  mkdirSync(kopie);
  const root = join(import.meta.dir, "..");
  const dateien = Bun.spawnSync(["git", "-C", root, "ls-files", "-z", "--", ":!e2e", ":!docs", ":!node_modules"], { stdout: "pipe" }).stdout.toString().split("\0").filter(Boolean);
  for (const f of dateien) {
    mkdirSync(join(kopie, f, ".."), { recursive: true });
    try { cpSync(join(root, f), join(kopie, f)); } catch { /* eine gelöschte, noch nicht committete Datei */ }
  }
  symlinkSync(join(root, "node_modules"), join(kopie, "node_modules"));
  const state = join(kopie, "state");
  mkdirSync(state);
  const probe = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
  const port = probe.port!;
  probe.stop(true);
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith("FLEET_") && k !== "CLAUDE_CONFIG_DIR") env[k] = v;
  // a HOME of its own: a server under the caller's HOME writes the trust of the folders it opens into the caller's ~/.claude.json (ci/claude-json-unberuehrt.ts)
  env.HOME = join(base, "home");
  mkdirSync(env.HOME, { recursive: true });
  writeFileSync(join(state, "fleet.json"), JSON.stringify({ sock: `siegelfix${process.pid % 1000}`, token: "fixture-token", slots: {}, tasks: [], events: [] }));
  const server = Bun.spawn([process.execPath, "server.ts"], { cwd: kopie, stdout: "pipe", stderr: "pipe",
    env: { ...env, FLEET_HOST: "127.0.0.1", FLEET_PORT: String(port), FLEET_STATE_DIR: state, FLEET_TOKEN: "fixture-token", FLEET_CMD: "true",
      FLEET_SOCK: `siegelfix${process.pid % 1000}`, FLEET_REPO_DIR: kopie } });
  try {
    let status = 0;
    const until = Date.now() + 25_000;
    while (Date.now() < until && server.exitCode === null && status === 0) {
      try { status = (await fetch(`http://127.0.0.1:${port}/api/post-land-audits`, { headers: { authorization: "Bearer fixture-token" } })).status; }
      catch { await Bun.sleep(150); }
    }
    const err = server.exitCode !== null ? await new Response(server.stderr).text() : "";
    expect(err).not.toContain("Cannot find module");
    expect(server.exitCode).toBeNull(); // läuft noch
    expect(status).toBe(200);
  } finally {
    server.kill();
    Bun.spawnSync(["tmux", "-L", `siegelfix${process.pid % 1000}`, "kill-server"]);
  }
}, 60_000);

test("der Leser der Tabelle liest dieselben Units wie e2e/ctx.ts (sonst wäre jedes Siegel stumm zu)", async () => {
  const { readFileSync } = await import("node:fs");
  const echt = einheitenAusQuelltext(readFileSync(join(import.meta.dir, "..", "e2e", "ctx.ts"), "utf8"));
  expect(echt).toEqual(SHARD_UNITS.map((u) => u.unit + (u.plattformGebunden === true ? "!" : "")).sort());
});
