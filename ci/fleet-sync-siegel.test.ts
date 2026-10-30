// fleet-sync.sh holt die Siegel der anderen Maschine mit, in einen eigenen Namensraum (refs/notes/fleet/seal-hub/), und lässt die eigenen unberührt.
// Ein echtes git mit Bare-Hub im Temp-Ordner; Install und Build sind Attrappen, der Stand ist schon aktuell (kein Deploy).
import { afterAll, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { baumVon, deckung, geforderteUnits, leseSiegel, plattformHier, pushSiegel, schreibeSiegel } from "../server/pruef-siegel";

const base = realpathSync(mkdtempSync(join(tmpdir(), "fleet-sync-siegel-")));
afterAll(() => rmSync(base, { recursive: true, force: true }));
const sh = (dir: string, ...a: string[]): string => {
  const r = Bun.spawnSync(["git", "-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", ...a], { stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr.toString()}`);
  return r.stdout.toString().trim();
};

test("die Siegel der anderen Maschine kommen mit dem Sync, die eigenen bleiben wie sie sind", async () => {
  const hub = join(base, "hub.git");
  mkdirSync(hub);
  sh(hub, "init", "-q", "--bare", "-b", "main");
  const wh = join(base, "wh"), mac = join(base, "mac");
  sh(base, "clone", "-q", "-o", "hub", hub, wh);
  writeFileSync(join(wh, "a.txt"), "1\n");
  sh(wh, "add", "a.txt");
  sh(wh, "commit", "-qm", "eins");
  sh(wh, "push", "-q", "hub", "main");
  sh(base, "clone", "-q", "-o", "hub", hub, mac);
  // das Skript liegt ungetrackt im Klon; ein schmutziger Baum würde der Sync ablehnen (Exit 4)
  copyFileSync(join(import.meta.dir, "..", "fleet-sync.sh"), join(mac, "fleet-sync.sh"));
  writeFileSync(join(mac, ".git", "info", "exclude"), "fleet-sync.sh\n");
  // der WH hat den Baum geprüft und sein Siegel zum Hub geschoben
  const tree = (await baumVon(wh, "HEAD"))!;
  await schreibeSiegel(wh, { v: 1, tree, units: geforderteUnits(["dom"]), tiefe: "audit", ergebnis: "green", maschine: "wh",
    plattform: plattformHier(), lauf: "1029-aaaa", at: 5 }, "wh");
  expect(await pushSiegel(wh, "hub", "wh")).toBe(true);
  // der Mac hat ein eigenes Siegel, das der Sync nicht anfassen darf
  await schreibeSiegel(mac, { v: 1, tree, units: ["dom"], tiefe: "check", ergebnis: "green", maschine: "mac", plattform: plattformHier(),
    lauf: "1029-bbbb", at: 6 }, "mac");
  const eigen = sh(mac, "rev-parse", "refs/notes/fleet/seal/mac");
  expect(await leseSiegel(mac, tree)).toHaveLength(1);

  const p = Bun.spawnSync(["sh", join(mac, "fleet-sync.sh"), "hub"], { cwd: mac, stdout: "pipe", stderr: "pipe",
    env: { ...process.env, FLEET_SYNC_INSTALL_CMD: "true", FLEET_SYNC_BUILD_CMD: "true" } });
  expect(`${p.exitCode} ${p.stdout.toString()}`.startsWith("0 ")).toBe(true);
  expect(sh(mac, "rev-parse", "refs/notes/fleet/seal/mac")).toBe(eigen);
  const d = deckung(await leseSiegel(mac, tree), geforderteUnits());
  expect(d.luecke).toEqual([]);
  expect(d.quellen.map((q) => q.maschine).sort()).toEqual(["mac", "wh"]);
});
