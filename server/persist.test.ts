// Die Archiv-Stufe der Rotation (server/persist.ts#appendEvent), umgezogen aus e2e/briefstats.ts (Löschliste
// K4a, Posten 33). Rotation hängt die ausgehende .1 an x.jsonl.archive, BEVOR sie umbenennt, damit keine
// Generation überschrieben wird (S1, 2026-09-15: audit.jsonl.1 hielt 2026-07-21..09-07, die nächste
// Rotation war ~1,4 Tage davon entfernt, sie zu zerstören). Jede Ereigniszeile trägt ein Polster in Höhe
// der Schwelle, also findet jedes Anhängen die Datei schon über der Schwelle, egal welche Umgebung gilt.
//   t | Ereignis                            | Inhaber der Bytes danach
//   0 | Saat SA (≥ Schwelle) gepflanzt      | x=SA
//   1 | E1 angehängt → Größe ≥ Schwelle     | .1=SA            x=E1  (1. Rotation: keine .1, nichts archiviert)
//   2 | E2 angehängt → Rotation             | archive=SA   .1=E1   x=E2
//   3 | E3 angehängt → Rotation             | archive=SA,E1  .1=E2   x=E3
// Reihenfolge zählt: Ein nicht beschreibbares Archiv schaltet die Rotation im Modul dauerhaft ab
// (archiveRotateFailed), deshalb läuft der Fehlerfall zuletzt.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendEvent, AUDIT_ROTATE_BYTES } from "./persist";

const dir = mkdtempSync(join(tmpdir(), "fleet-persist-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const big = (tag: string) => `${tag}${"x".repeat(AUDIT_ROTATE_BYTES)}\n`;
// ein Bauplan für die Ereignisform: dasselbe ev(n) geht in appendEvent und in die erwarteten Bytes
const ev = (n: number) => ({ n, p: "x".repeat(AUDIT_ROTATE_BYTES) });
const lineOf = (n: number) => `${JSON.stringify(ev(n))}\n`;

describe("appendEvent: Archiv-Stufe der Rotation", () => {
  const archFile = join(dir, "rot-archived.jsonl");
  const archivePath = `${archFile}.archive`;

  test("nach drei Rotationen halten archive + .1 + Live-Datei jede geschriebene Zeile genau einmal, in Reihenfolge", async () => {
    const seedA = big("seedA-");
    writeFileSync(archFile, seedA);
    await appendEvent(archFile, ev(1));
    await appendEvent(archFile, ev(2));
    await appendEvent(archFile, ev(3));
    const gens = (existsSync(archivePath) ? readFileSync(archivePath, "utf8") : "<archive absent>")
      + readFileSync(`${archFile}.1`, "utf8") + readFileSync(archFile, "utf8");
    expect(gens).toBe(seedA + lineOf(1) + lineOf(2) + lineOf(3));
  });

  test("das Archiv ist 0600 wie die Ledger, die es verlängert", () => {
    expect(existsSync(archivePath)).toBe(true);
    expect(statSync(archivePath).mode & 0o777).toBe(0o600);
  });

  // Ein Archivpfad, der kein Anhängen annimmt (hier ein Verzeichnis, EISDIR), bricht die ROTATION ab und
  // verliert nie das Ereignis: Die .1 ist die letzte Kopie ihrer Generation, bis das Archiv sie hat.
  const failFile = join(dir, "arch-unwritable.jsonl");
  const seedB = big("seedB-");

  test("ein nicht beschreibbares Archiv bricht die Rotation ab, die .1 bleibt unberührt", async () => {
    writeFileSync(failFile, seedB);
    writeFileSync(`${failFile}.1`, "old-generation\n");
    mkdirSync(`${failFile}.archive`);
    await appendEvent(failFile, { n: 9 });
    expect(readFileSync(`${failFile}.1`, "utf8")).toBe("old-generation\n");
  });

  test("bei abgebrochener Rotation landet das Ereignis trotzdem in der Live-Datei", () => {
    expect(readFileSync(failFile, "utf8")).toBe(seedB + `${JSON.stringify({ n: 9 })}\n`);
  });
});
