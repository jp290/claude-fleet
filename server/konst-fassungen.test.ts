// Feste Fassungen einer Konstellation (Harness 2.0 Schritt 1): jedes Speichern über PUT /api/k15/eigenes legt eine unveränderliche Fassung mit
// Hash an; gleicher Inhalt keine neue; „aktiv“ bleibt, bis jemand es umsetzt; zwei Fassungen lassen sich vergleichen.
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { k15Speicher } from "./k15-speicher";
import { FASSUNGEN_DATEI, fassungsHash, konstFassungen } from "./konst-fassungen";

const B = "http://x/api/k15";
const pos = (id: string, name: string, meldetAn?: string, agent = "claude") =>
  ({ id, name, profil: { id: "lane", version: 1, name: "Lane", agent, modell: null }, ...(meldetAn ? { meldetAn } : {}) });
const konst = (version: number, positionen: object[], name = "Zweier") =>
  ({ id: "c1", format: 1, fleet: "konstellation", name, version, satz: "Bauer und Gegenspieler", autor: "du", positionen });
const V1 = konst(1, [pos("a", "Bauer"), pos("b", "Gegenspieler", "a")]);
const V2 = konst(2, [pos("a", "Bauer"), pos("b", "Gegenspieler"), pos("c", "Auswertung", "a", "codex")]);

const speichere = (dir: string, konstellationen?: object[]) => k15Speicher(new Request(`${B}/eigenes`, { method: "PUT",
  headers: { "content-type": "application/json" }, body: JSON.stringify({ fassungen: [], packs: [], profile: [], ...(konstellationen ? { konstellationen } : {}) }) }), dir);
const frag = async (dir: string, pfad: string, init?: RequestInit) => {
  const r = await konstFassungen(new Request(`${B}/konst/${pfad}`, init), new URL(`${B}/konst/${pfad}`), dir);
  return { status: r.status, body: await r.json() as Record<string, unknown> };
};
const liste = async (dir: string) => (await frag(dir, "c1/fassungen")).body as { aktiv: string; fassungen: { hash: string; version: number; aktiv: boolean }[] };
const neu = () => mkdtempSync(join(tmpdir(), "konst-fassungen-"));

describe("feste Fassungen", () => {
  test("zweimal speichern mit anderem Inhalt: zwei Fassungen, neueste zuerst, die erste bleibt aktiv", async () => {
    const dir = neu();
    const r1 = await (await speichere(dir, [V1])).json() as { fassungen: Record<string, { hash: string; neu: boolean }> };
    expect(r1.fassungen.c1).toEqual({ hash: fassungsHash(V1), neu: true });
    await speichere(dir, [V2]);
    const l = await liste(dir);
    expect(l.fassungen.map((f) => f.version)).toEqual([2, 1]);
    expect(l.aktiv).toBe(fassungsHash(V1));
    expect(l.fassungen.map((f) => f.aktiv)).toEqual([false, true]);
  });

  test("gleicher Inhalt mit höherem Zähler ist keine neue Fassung", async () => {
    const dir = neu();
    await speichere(dir, [V1]);
    const r = await (await speichere(dir, [{ ...V1, version: 7 }])).json() as { fassungen: Record<string, { neu: boolean }> };
    expect(r.fassungen.c1!.neu).toBe(false);
    expect((await liste(dir)).fassungen).toHaveLength(1);
  });

  test("eine Fassung ändert sich nicht, wenn später anders gespeichert wird", async () => {
    const dir = neu();
    await speichere(dir, [V1]);
    await speichere(dir, [V2]);
    const alt = await frag(dir, `c1/fassungen/${fassungsHash(V1).slice(0, 10)}`);
    expect(alt.status).toBe(200);
    expect(alt.body.form).toEqual(V1);
    expect(fassungsHash(alt.body.form as Record<string, unknown>)).toBe(fassungsHash(V1));
  });

  test("ein Speichern ohne Konstellationen (Fenster von vorher) lässt die Fassungen stehen", async () => {
    const dir = neu();
    await speichere(dir, [V1]);
    expect((await (await speichere(dir)).json() as Record<string, unknown>).ok).toBe(true);
    expect((await liste(dir)).fassungen).toHaveLength(1);
  });

  test("Diff: Position neu, Profil-Feld geändert, Kante umgehängt", async () => {
    const dir = neu();
    await speichere(dir, [V1]);
    await speichere(dir, [V2]);
    const r = await frag(dir, `c1/diff?von=${fassungsHash(V1)}&zu=${fassungsHash(V2)}`);
    expect(r.status).toBe(200);
    const d = r.body.diff as { konst: unknown[]; positionen: { id: string; name: string; art: string; felder: unknown[] }[]; kanten: { id: string; name: string; von: string | null; zu: string | null }[] };
    expect(d.konst).toEqual([]);
    expect(d.positionen).toEqual([{ id: "c", name: "Auswertung", art: "neu", felder: [] }]);
    expect(d.kanten).toEqual([{ id: "b", name: "Gegenspieler", von: "Bauer", zu: null }, { id: "c", name: "Auswertung", von: null, zu: "Bauer" }]);
  });

  test("Diff ohne zu vergleicht mit der aktiven; ein geändertes Profil-Feld steht als profil.<feld>", async () => {
    const dir = neu();
    const V3 = konst(3, [pos("a", "Bauer", undefined, "pi"), pos("b", "Gegenspieler", "a")], "Zweier neu");
    await speichere(dir, [V1]);
    await speichere(dir, [V3]);
    const d = (await frag(dir, `c1/diff?von=${fassungsHash(V3)}`)).body.diff as { konst: object[]; positionen: { felder: object[] }[] };
    expect(d.konst).toEqual([{ feld: "name", von: "Zweier neu", zu: "Zweier" }]);
    expect(d.positionen[0]!.felder).toEqual([{ feld: "profil.agent", von: "pi", zu: "claude" }]);
  });

  test("aktiv setzen: die Liste und die Datei zeigen danach die neue", async () => {
    const dir = neu();
    await speichere(dir, [V1]);
    await speichere(dir, [V2]);
    const r = await frag(dir, "c1/aktiv", { method: "PUT", body: JSON.stringify({ hash: fassungsHash(V2).slice(0, 8) }) });
    expect(r.body).toEqual({ ok: true, aktiv: fassungsHash(V2) });
    expect((await liste(dir)).aktiv).toBe(fassungsHash(V2));
    expect(JSON.parse(readFileSync(join(dir, FASSUNGEN_DATEI), "utf8")).c1.aktiv).toBe(fassungsHash(V2));
    // eine weitere Fassung danach setzt aktiv nicht zurück
    await speichere(dir, [konst(3, [pos("a", "Bauer")])]);
    expect((await liste(dir)).aktiv).toBe(fassungsHash(V2));
  });

  test("lehnt ab: unbekannte Konstellation, unbekannter oder kaputter Hash, falsche Methode", async () => {
    const dir = neu();
    await speichere(dir, [V1]);
    expect((await frag(dir, "c9/fassungen")).status).toBe(404);
    expect((await frag(dir, "c1/fassungen/deadbeefdeadbeef")).status).toBe(404);
    expect((await frag(dir, "c1/aktiv", { method: "PUT", body: JSON.stringify({ hash: "xyz" }) })).status).toBe(400);
    expect((await frag(dir, "c1/aktiv", { method: "PUT", body: "kein json" })).status).toBe(400);
    expect((await frag(dir, "c1/diff?von=1234")).status).toBe(400);
    expect((await frag(dir, "c1/fassungen", { method: "DELETE" })).status).toBe(405);
    expect((await liste(dir)).aktiv).toBe(fassungsHash(V1));
  });

  test("zwei gleichzeitige Speichern verlieren keine Fassung", async () => {
    const dir = neu();
    await Promise.all([speichere(dir, [V1]), speichere(dir, [V2])]);
    expect((await liste(dir)).fassungen).toHaveLength(2);
  });
});
