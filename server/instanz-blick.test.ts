// Wer schaut, hält sie — auch ein Handy-Tab im Hintergrund und ein Desktop-Tab zwischen zwei Verbindungsversuchen
// (Abnahme 22.10., Pflicht 1): beendet wird erst nach zehn Minuten ohne jeden Blick. Hier die Regel und ihre Quelle,
// das Verzeichnis einer Instanz; server/branches-ende.test.ts fährt sie mit echtem Server.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { instanceDirOf, lastLook, LOOK_GRACE_MS, lookHolds, SEEN_FILE } from "./instanz-blick";

const TMP = realpathSync(mkdtempSync(join(tmpdir(), "fleet-blick-")));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));
const NOW = 1_800_000_000_000, MIN = 60_000;
let n = 0;
function instance(o: { started?: number; seen?: number; src?: string } = {}): string {
  const dir = join(TMP, `fleet-testinstanz-${++n}`);
  mkdirSync(dir);
  writeFileSync(join(dir, "testinstanz.state"), `src=${o.src ?? "/w/x"}\nport=8999\npid=1234\n${o.started === undefined ? "" : `started=${Math.floor(o.started / 1000)}\n`}`);
  if (o.seen !== undefined) writeFileSync(join(dir, SEEN_FILE), String(o.seen));
  return dir;
}

describe("lookHolds: die Schonfrist", () => {
  test("vor 2 min gesehen, jetzt keine Verbindung: sie bleibt, und der Grund sagt wann", () => {
    expect(lookHolds(NOW - 2 * MIN, NOW)).toBe("vor 2 min schaute jemand in die Testinstanz (Schonfrist 10 min)");
  });
  test("knapp unter zehn Minuten bleibt sie, ab zehn Minuten ohne Blick darf sie enden", () => {
    expect(lookHolds(NOW - LOOK_GRACE_MS + 1, NOW)).not.toBeNull();
    expect(lookHolds(NOW - LOOK_GRACE_MS, NOW)).toBeNull();
    expect(lookHolds(NOW - 11 * MIN, NOW)).toBeNull();
  });
  test("unbekannt, wann zuletzt jemand schaute: sie bleibt", () => {
    expect(lookHolds(null, NOW)).toBe("unbekannt, wann zuletzt jemand in die Testinstanz schaute");
  });
});

describe("lastLook: die Notiz der Instanz, sonst ihr Start", () => {
  test("ein Blick nach dem Start zählt; ohne Blick zählt der Start, eine frische Instanz steht also zehn Minuten", () => {
    expect(lastLook(instance({ started: NOW - 30 * MIN, seen: NOW - 2 * MIN }))).toBe(NOW - 2 * MIN);
    const fresh = instance({ started: NOW - 2 * MIN });
    expect(lastLook(fresh)).toBe(Math.floor((NOW - 2 * MIN) / 1000) * 1000);
    expect(lookHolds(lastLook(fresh), NOW)).not.toBeNull();
  });
  test("ein Blick aus einem früheren Leben (vor einem neuen up) zählt nicht vor den Start zurück", () => {
    expect(lastLook(instance({ started: NOW - 2 * MIN, seen: NOW - 60 * MIN }))).toBe(Math.floor((NOW - 2 * MIN) / 1000) * 1000);
  });
  test("weder Notiz noch Start, eine unlesbare Notiz: unbekannt", () => {
    expect(lastLook(instance())).toBeNull();
    const dir = instance();
    writeFileSync(join(dir, SEEN_FILE), "kaputt");
    expect(lastLook(dir)).toBeNull();
    expect(lastLook(join(TMP, "gibt-es-nicht"))).toBeNull();
  });
});

describe("instanceDirOf: das Verzeichnis zur Instanz eines Worktrees", () => {
  test("über src= der State-Datei; ein anderer Worktree mit gleichem Anfang ist es nicht", () => {
    const root = join(TMP, "root");
    mkdirSync(root);
    const dir = join(root, "fleet-testinstanz-7");
    mkdirSync(dir);
    writeFileSync(join(dir, "testinstanz.state"), `src=${TMP}\n`);
    expect(instanceDirOf(root, TMP)).toBe(dir);
    expect(instanceDirOf(root, `${TMP}-zwei`)).toBeNull();
    expect(instanceDirOf(join(TMP, "kein-root"), TMP)).toBeNull();
  });
});
