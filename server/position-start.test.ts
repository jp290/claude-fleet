// WAS REIST, STARTET, WO ES LANDET (F1 Runde 2, ~/local-notes/fable-blick/f1-runde2-start.md): eine Position einer gespeicherten Konstellation startet mit dem Ziel,
// das die Datei ihr gibt, und in dem Ordner, den die Person für ihren leeren Platz wählt. Hier die reine Hälfte: welches Ziel gilt, welcher Satz fragt nach dem Ordner,
// welcher Ordner als Vorschlag gilt, welchen Text der Sitz zuerst liest und was Fassung und GET /api/self davon zeigen. Die Türen dazu stehen in position-start-tuer.test.ts.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fassungAufgabeAusSitz, ordnerFehlt, ordnerVorschlag, sitzAnsicht, zielAusPosition, zielNachricht } from "./position-start";
import { sitzStartGeladen, type SitzStart } from "./sitz-reise";

const ordner: string[] = [];
afterAll(() => { for (const o of ordner) rmSync(o, { recursive: true, force: true }); });
const frisch = (): string => { const o = mkdtempSync(join(tmpdir(), "position-start-")); ordner.push(o); return o; };

const SITZ: SitzStart = { konst: "i123", pos: "prufer", herkunft: null, liest: [], persoenlich: [], block: true, auftrag: null,
  konstName: "Bau und Prüfung", ziel: "Prüfe, was der Bauer baut.", ordner: { hint: "pruef" } };

describe("welches Ziel gilt", () => {
  test("ohne goal an der Tür gilt das der Datei; ein goal an der Tür gilt vor ihm und die Antwort sagt, dass das der Datei ersetzt wurde", () => {
    expect(zielAusPosition("", SITZ)).toEqual({ ziel: "Prüfe, was der Bauer baut.", aus: "datei", ersetzt: false });
    expect(zielAusPosition("Prüfe etwas anderes.", SITZ)).toEqual({ ziel: "Prüfe etwas anderes.", aus: "tuer", ersetzt: true });
    expect(zielAusPosition("Nur das Tür-Ziel.", { ...SITZ, ziel: undefined })).toEqual({ ziel: "Nur das Tür-Ziel.", aus: "tuer", ersetzt: false });
    expect(zielAusPosition("", { ...SITZ, ziel: undefined })).toEqual({ ziel: "", aus: "keins", ersetzt: false });
    expect(zielAusPosition("Ein Ziel.", null)).toEqual({ ziel: "Ein Ziel.", aus: "tuer", ersetzt: false });
  });
});

describe("der Ordner ist der leere Platz, den die Tür füllt", () => {
  test("ohne cwd nennt der Satz den Sitz und den Hinweis des Absenders; mit cwd, ohne Platz oder ohne Sitz fragt nichts", () => {
    expect(ordnerFehlt(SITZ, false, false)).toBe('folder for seat "prufer": a folder, the sender used "pruef"');
    expect(ordnerFehlt(SITZ, false, true)).toBe('folder for seat "prufer": a folder under your seat root, the sender used "pruef"');
    expect(ordnerFehlt({ ...SITZ, ordner: { hint: null } }, false, true)).toContain("the sender's folder lay outside their seat root, so there is no hint");
    expect(ordnerFehlt(SITZ, true, true)).toBeNull();
    expect(ordnerFehlt({ ...SITZ, ordner: undefined }, false, true)).toBeNull();
    expect(ordnerFehlt(null, false, true)).toBeNull();
  });

  test("der Vorschlag ist der Hinweis neben dem Ordner der Öffnerin, aber nur wenn es ihn gibt", () => {
    const wurzel = frisch(), lead = join(wurzel, "lead");
    mkdirSync(lead);
    expect(ordnerVorschlag("pruef", lead)).toBeNull();
    mkdirSync(join(wurzel, "pruef"));
    expect(ordnerVorschlag("pruef", lead)).toBe(join(wurzel, "pruef"));
    expect(ordnerVorschlag(null, lead)).toBeNull();
    expect(ordnerVorschlag("../aus", lead)).toBeNull();
    expect(ordnerVorschlag(".", lead)).toBeNull();
  });
});

describe("was der Sitz zuerst liest", () => {
  test("der Kopf sagt, dass es das Ziel dieser Position in der Konstellation ist und aus der Datei kommt; die Öffnerin steht davor", () => {
    const text = zielNachricht(SITZ, "[geöffnet von der Session in Slot 4]", []);
    expect(text).toContain("[geöffnet von der Session in Slot 4]");
    expect(text).toContain("the goal of this position in the constellation „Bau und Prüfung“");
    expect(text).toContain("from the file");
    expect(text.endsWith("Prüfe, was der Bauer baut.")).toBe(true);
  });

  test("die anderen Sitze der Konstellation stehen mit ihrem Hinweis, und die Öffnen-Tür für Ordner ist genannt", () => {
    const text = zielNachricht(SITZ, null, [{ id: "bauer", name: "Bauer", auftrag: null, ordner: "bau" }, { id: "lead", name: "Lead", auftrag: null, ordner: null }]);
    expect(text).toContain("POST /api/self/seats/open");
    expect(text).toContain('bauer (Bauer, folder hint "bau")');
    expect(text).toContain("lead (Lead)");
  });
});

describe("was Fassung und GET /api/self zeigen", () => {
  test("die Fassung nennt das Ziel als „zuerst gesagt, aus der Datei“; ersetzt es die Tür, steht das dort; ohne Ziel nichts", () => {
    expect(fassungAufgabeAusSitz(SITZ)).toEqual({ quelle: "Slot.sitz (i123/prufer, Ziel aus der Datei „Bau und Prüfung“) — told first (from the file)", text: "Prüfe, was der Bauer baut." });
    expect(fassungAufgabeAusSitz({ ...SITZ, zielErsetzt: true })?.quelle).toContain("replaced by the goal given at the door");
    expect(fassungAufgabeAusSitz({ ...SITZ, ziel: undefined })).toBeNull();
    expect(fassungAufgabeAusSitz(null)).toBeNull();
  });

  test("die Ansicht trägt das Ziel und den gefüllten Platz mit dem Hinweis; ein Sitz ohne beides trägt nur seine Kennung", () => {
    expect(sitzAnsicht(SITZ, "/x/pruef")).toEqual({ konst: "i123", pos: "prufer", name: "Bau und Prüfung",
      goal: { text: "Prüfe, was der Bauer baut.", from: "file", replaced: false }, folder: { filled: "/x/pruef", hint: "pruef" } });
    expect(sitzAnsicht({ ...SITZ, ziel: undefined, ordner: undefined }, "/x")).toEqual({ konst: "i123", pos: "prufer", name: "Bau und Prüfung" });
    expect(sitzAnsicht(null, "/x")).toBeNull();
  });

  test("der Sitz bleibt über einen Neustart, wie er war: Ziel, Platz und der Name der Konstellation", () => {
    const geladen = sitzStartGeladen(JSON.parse(JSON.stringify({ ...SITZ, zielErsetzt: true })), "claude");
    expect(geladen).toMatchObject({ konstName: "Bau und Prüfung", ziel: "Prüfe, was der Bauer baut.", ordner: { hint: "pruef" }, zielErsetzt: true });
    expect(sitzStartGeladen(JSON.parse(JSON.stringify({ ...SITZ, ordner: { hint: 5 } })), "claude")?.ordner).toBeUndefined();
  });
});
