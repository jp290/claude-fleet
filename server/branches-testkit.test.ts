import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { raeumeToteLaeufe } from "./branches-testkit";

test("ein neues Kit räumt die Socket-Ordner toter Läufe und lässt lebende und fremde stehen", () => {
  const root = mkdtempSync(join(tmpdir(), "fbr-root-"));
  try {
    const tot = Bun.spawnSync(["true"]).pid;
    const toterOrdner = join(root, `fbr-${tot}-abc`);
    const lebenderOrdner = join(root, `fbr-${process.pid}-def`);
    const alterOrdner = join(root, "fbr-QspdFg");
    for (const d of [toterOrdner, lebenderOrdner, alterOrdner]) mkdirSync(d);
    expect(raeumeToteLaeufe(root)).toEqual([toterOrdner]);
    expect(existsSync(toterOrdner)).toBe(false);
    expect(existsSync(lebenderOrdner)).toBe(true);
    expect(existsSync(alterOrdner)).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
