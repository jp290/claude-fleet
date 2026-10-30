// Die Fixture- und Scratch-Server der e2e-Suite (tools/perf-probe.ts, e2e/state-snapshot.ts, e2e/trace.ts …) kopieren server/ und andere Ordner, aber nicht e2e/.
// Das Siegel-Modul muss dort laden, auch ohne e2e/ctx.ts: ein Check lief rot (30.10., Run 1030020630-eece66ec), weil es "../e2e/ctx" importierte.
import { afterAll, expect, test } from "bun:test";
import { cpSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
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

test("der Leser der Tabelle liest dieselben Units wie e2e/ctx.ts (sonst wäre jedes Siegel stumm zu)", async () => {
  const { readFileSync } = await import("node:fs");
  const echt = einheitenAusQuelltext(readFileSync(join(import.meta.dir, "..", "e2e", "ctx.ts"), "utf8"));
  expect(echt).toEqual(SHARD_UNITS.map((u) => u.unit + (u.plattformGebunden === true ? "!" : "")).sort());
});
