// Eine Konstellation reist ganz (docs/start/direction.md Schritt 3, Auftrag datei-traegt 22.10.): die Datei trägt je Sitz, was er liest, darf
// und in seinem Notizbuch hat, dazu Läufe und „abgeleitetVon“; Persönliches nie. Eine andere Fleet startet den Sitz mit dem, was ankam: seine
// Fassung (server/fassung.ts) ist dieselbe, außer im persönlichen Platz, bis der Importierende ihn mit demselben füllt.
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROFILE0, exportObjekt, pos, type Konst, type Profil } from "../src/k15-entwurf-modell";
import { importKonst } from "../src/k15-import";
import { baueFassung } from "./fassung";
import { fassungsHash } from "./konst-fassungen";
import type { Lauf } from "./laeufe";
import { dateiFuer, rechteAnDerTuer, saeNotizbuch, sitzDerTuer, sitzWissen, type DateiQuellen, type SitzStart } from "./sitz-reise";
import type { Oeffnerin } from "./kind-weite";
import { SPEICHER_DATEI } from "../src/k15-speicher";
import { rechteRegeln, type Rechte } from "../session-rechte";
import { seatFassungAbschnitte, type SeatKnowledge } from "./sitz-wissen";

const PERSOENLICH_TEXT = "# Working with the owner\n\nHe dictates. His messages are spoken, so some words come out by sound and need reading by sound.";
const BIBLIOTHEK: SeatKnowledge = { tree: "fleet", repoRoot: "/r", head: "c0ffee", packs: [
  { id: "who-it-is-for", useWhen: "Read this when you build work someone will use.", sources: [{ path: "docs/packs/who-it-is-for.md", anchor: "# Who it is for" }],
    text: "# Who it is for\n\nMost work that misses isn't wrong. It ends up where nobody meets it." },
  { id: "working-with-the-owner", useWhen: "Read this when you talk with the owner.", sources: [{ path: "docs/packs/working-with-the-owner.md", anchor: "# Working with the owner" }],
    text: PERSOENLICH_TEXT },
  { id: "how-fleet-remembers", useWhen: "Wenn du etwas gelernt hast.", sources: [{ path: "docs/packs/how-fleet-remembers.md", anchor: "# How Fleet remembers" }],
    text: "# How Fleet remembers\n\nA note goes where its reader will look." },
] };
const NOTIZ_PROJEKT = "---\nname: lauf-dauer\ndescription: ein Lauf dauert zwei Stunden\nmetadata:\n  type: project\n---\nEin Lauf dauert zwei Stunden.";
const NOTIZ_OWNER = "---\nname: owner-stil\ndescription: wie er schreibt\nmetadata:\n  type: user\n---\nEr diktiert und liest jeden Satz einzeln.";
const INDEX = "- [Lauf-Dauer](lauf-dauer.md) — zwei Stunden\n- [Owner-Stil](owner-stil.md) — wie er schreibt";

const BAUER: Profil = { ...PROFILE0.find((p) => p.id === "eigen")!, id: "bauer", name: "Bauer", autor: "du", agent: "claude",
  datei: { titel: "bauer.md", v: 1, pfad: "eigene Datei", abschnitte: [{ titel: "# Bauer", text: "Du baust." }] } };
const K: Konst = { id: "k1", name: "Bauer und Prüfer", v: 2, satz: "zwei Sitze", eigen: true,
  wurzeln: [pos("bauer", "Bauer", "bauer", { kids: [pos("pruefer", "Prüfer", "lane")] })] };
const form = (k: Konst, profile: readonly Profil[]): Record<string, unknown> =>
  ({ id: k.id, ...exportObjekt({ ebene: "konst", voll: true, konst: [k], k, profile: [...profile], q: null, p: profile[0]! }) });
const LAUF: Lauf = { id: "l0123456789ab", konst: "k1", hash: "a".repeat(64), name: "Bauer und Prüfer", version: 2, at: Date.UTC(2026, 9, 22, 10),
  aufgabe: null, protokoll: null, ende: { at: Date.UTC(2026, 9, 22, 12), wie: "zu" },
  positionen: [{ pos: "bauer", slot: 3, openedAt: 1, at: 1, cwd: "/irgendwo/hier", zu: 2 }] };
const quellen = (o: Partial<DateiQuellen> = {}): DateiQuellen => ({ bibliothek: async () => BIBLIOTHEK, laeufe: [LAUF], modus: "auto",
  notizbuch: async (profil) => profil === "bauer" ? { index: INDEX, dateien: [{ datei: "lauf-dauer.md", text: NOTIZ_PROJEKT }, { datei: "owner-stil.md", text: NOTIZ_OWNER }] } : null, ...o });
const PROFILE = [...PROFILE0, BAUER];

async function datei(k = K): Promise<{ text: string; obj: Record<string, unknown>; hinweise: string[] }> {
  const d = await dateiFuer(form(k, PROFILE), quellen());
  if (typeof d === "string") throw new Error(d);
  return { text: JSON.stringify(d.datei, null, 2), obj: d.datei, hinweise: d.hinweise };
}
// so liest ein Sitz auf der empfangenden Seite: wie die Tür (sitzDerTuer) aus dem importierten Speicher
function ankunft(text: string, pos: string): SitzStart {
  const imp = importKonst(text, PROFILE0, 1792000000000);
  if (typeof imp === "string") throw new Error(imp);
  const q = [...imp.k.wurzeln, ...imp.k.wurzeln.flatMap((x) => x.kids ?? [])].find((x) => x.id === pos);
  if (!q?.sitz) throw new Error(`${pos} hat keinen Sitz`);
  return { konst: imp.k.id, pos, herkunft: imp.k.abgeleitetVon ?? null, liest: q.sitz.liest, persoenlich: q.sitz.persoenlich, block: true, auftrag: null };
}
// die Fassung, soweit sie am Wissen hängt: alle anderen Teile gleich, also misst der Hash genau das
const fassungMit = (k: SeatKnowledge): string => baueFassung({ slot: 1, anlass: "neu", wer: [], aufgabe: [], darf: [], arbeitet: [],
  liest: seatFassungAbschnitte(k, true, null) }).hash;

describe("die Datei trägt den Sitz ganz", () => {
  test("je Sitz ohne Rolle: was er liest, als Text, der persönliche Platz leer, Rechte und Mode, das Notizbuch ohne die Notiz über den Owner", async () => {
    const { obj } = await datei();
    const ps = obj.positionen as Record<string, unknown>[];
    const sitz = ps.find((p) => p.id === "bauer")?.sitz as Record<string, unknown>;
    expect((sitz.liest as { id: string; weg: string; text: string }[]).map((p) => [p.id, p.weg, p.text.length > 20])).toEqual([["who-it-is-for", "start", true], ["how-fleet-remembers", "skill", true]]);
    expect(sitz.persoenlich).toEqual([{ id: "working-with-the-owner", weg: "start", quellen: [{ pfad: "docs/packs/working-with-the-owner.md", anker: "# Working with the owner" }],
      wofuer: "Read this when you talk with the owner.", text: null }]);
    expect(sitz.darf).toEqual({ rechte: null, modus: "auto" });
    expect(sitz.notizbuch).toEqual({ index: "- [Lauf-Dauer](lauf-dauer.md) — zwei Stunden", notizen: [{ datei: "lauf-dauer.md", text: NOTIZ_PROJEKT }], daheim: 1 });
    expect(ps.find((p) => p.id === "pruefer")?.sitz).toBeUndefined();
  });
  test("abgeleitetVon ist der Hash der Fassung, aus der exportiert wurde, und ein beendeter Lauf reist als Bericht ohne Ordner", async () => {
    const { obj, text } = await datei();
    expect(obj.abgeleitetVon).toBe(fassungsHash(form(K, PROFILE)));
    expect((obj.laeufe as { fassung: string; sitze: { pos: string }[] }[]).map((l) => [l.fassung, l.sitze.map((s) => s.pos)])).toEqual([["a".repeat(64), ["bauer"]]]);
    expect(text.includes("/irgendwo/hier")).toBe(false);
  });
  test("kein persönlicher Text: weder der Pack noch die Notiz über den Owner noch das, was ein Importierender in seinen Platz schrieb", async () => {
    const { text } = await datei();
    expect([text.includes("He dictates"), text.includes("Er diktiert")]).toEqual([false, false]);
    const imp = importKonst(text, PROFILE0, 7);
    if (typeof imp === "string") throw new Error(imp);
    const bauer = imp.k.wurzeln[0]!;
    bauer.sitz!.persoenlich[0]!.text = "Das ist ein erfundener Satz ohne echten Inhalt und dient nur als Platzha.";
    const weiter = await dateiFuer(form(imp.k, [...PROFILE0, ...imp.neueProfile]), quellen({ bibliothek: async () => { throw new Error("kein git"); } }));
    if (typeof weiter === "string") throw new Error(weiter);
    expect(JSON.stringify(weiter.datei).includes("Mein eigener Owner")).toBe(false);
    expect((weiter.datei.abgeleitetVon as string)).toBe(fassungsHash(form(imp.k, [...PROFILE0, ...imp.neueProfile])));
  });
  test("steckt persönlicher Text in einem teilbaren Pack, gibt es keine Datei", async () => {
    const schief: SeatKnowledge = { ...BIBLIOTHEK, packs: BIBLIOTHEK.packs.map((p) => p.id === "who-it-is-for" ? { ...p, text: `${p.text}\n\n${PERSOENLICH_TEXT}` } : p) };
    const d = await dateiFuer(form(K, PROFILE), quellen({ bibliothek: async () => schief }));
    expect(typeof d === "string" && d.startsWith("die Datei enthielte persönlichen Text")).toBe(true);
  });
});

describe("die empfangende Fleet nimmt, was ankam", () => {
  test("Import ohne Änderung: dieselbe Fassung der Konstellation, abgeleitetVon nennt sie, Sitz und Läufe sind da", async () => {
    const { text, obj } = await datei();
    const imp = importKonst(text, PROFILE0, 1792000000000);
    if (typeof imp === "string") throw new Error(imp);
    expect(fassungsHash(form(imp.k, [...PROFILE0, ...imp.neueProfile]))).toBe(obj.abgeleitetVon as string);
    expect([imp.k.abgeleitetVon, imp.k.laeufe?.length, imp.k.wurzeln[0]?.sitz?.liest.length]).toEqual([String(obj.abgeleitetVon), 1, 2]);
  });
  test("die Fassung des Sitzes: gleich bis auf den persönlichen Platz; füllt der Importierende ihn mit demselben, ganz gleich", async () => {
    const a = fassungMit(BIBLIOTHEK);
    const s = ankunft((await datei()).text, "bauer");
    const leer = sitzWissen(s, null);
    expect(leer.packs.map((p) => p.id)).toEqual(["who-it-is-for", "how-fleet-remembers"]);
    expect(fassungMit(leer)).not.toBe(a);
    const ohnePersoenliches = { ...BIBLIOTHEK, packs: BIBLIOTHEK.packs.filter((p) => p.id !== "working-with-the-owner") };
    expect(fassungMit(leer)).toBe(fassungMit(ohnePersoenliches));
    const gefuellt = { ...s, persoenlich: s.persoenlich.map((p) => ({ ...p, text: PERSOENLICH_TEXT })) };
    expect(fassungMit(sitzWissen(gefuellt, null))).toBe(a);
  });
  test("ein leerer Platz nimmt den Pack gleichen Namens aus der eigenen Bibliothek, nie einen anderen", async () => {
    const s = ankunft((await datei()).text, "bauer");
    const eigene: SeatKnowledge = { ...BIBLIOTHEK, packs: [{ ...BIBLIOTHEK.packs[1]!, text: "# Working with the owner\n\nMeiner." },
      { id: "fremd", useWhen: "x", sources: [], text: "nicht mitgereist" }] };
    expect(sitzWissen(s, eigene).packs.map((p) => [p.id, p.text?.slice(-7)])).toEqual([["who-it-is-for", "nobody meets it.".slice(-7)],
      ["how-fleet-remembers", "l look.".slice(-7)], ["working-with-the-owner", "Meiner."]]);
  });
  test("ein persönlicher Pack unter liest wird abgelehnt", async () => {
    const o = JSON.parse((await datei()).text);
    o.positionen[0].sitz.liest.push({ id: "working-with-the-owner", weg: "start", quellen: [], wofuer: null, text: "x" });
    expect(importKonst(JSON.stringify(o), PROFILE0, 7)).toBe("Session Bauer: working-with-the-owner ist persönlich und gehört unter persoenlich, ohne Text");
  });
  test("das Notizbuch wird nur in einen leeren Ordner gesät", () => {
    const dir = mkdtempSync(join(tmpdir(), "sitz-nb-"));
    const nb = { index: "- [Lauf-Dauer](lauf-dauer.md) — zwei Stunden", notizen: [{ datei: "lauf-dauer.md", text: NOTIZ_PROJEKT }], daheim: 1 };
    expect(saeNotizbuch(join(dir, "a"), nb)).toBe(true);
    expect(readFileSync(join(dir, "a", "lauf-dauer.md"), "utf8")).toBe(NOTIZ_PROJEKT);
    writeFileSync(join(dir, "a", "MEMORY.md"), "eigenes");
    expect(saeNotizbuch(join(dir, "a"), nb)).toBe(false);
    expect(readFileSync(join(dir, "a", "MEMORY.md"), "utf8")).toBe("eigenes");
    expect(existsSync(join(dir, "b"))).toBe(false);
  });
});

describe("was ein Sitz darf, reist und wird an der Tür gedeckelt", () => {
  // der eigene Speicher einer Fleet mit einer importierten Konstellation, wie das Fenster ihn schreibt (k15-zustand.ts#konstForm)
  async function speicher(text: string, aendere: (k: Konst) => void = () => {}): Promise<{ dir: string; kid: string }> {
    const imp = importKonst(text, PROFILE0, 1792000000000);
    if (typeof imp === "string") throw new Error(imp);
    aendere(imp.k);
    const dir = mkdtempSync(join(tmpdir(), "sitz-tuer-"));
    writeFileSync(join(dir, SPEICHER_DATEI), JSON.stringify({ fassungen: [], packs: [], profile: [], konstellationen: [form(imp.k, [...PROFILE0, ...imp.neueProfile])] }));
    return { dir, kid: imp.k.id };
  }
  const mitRechten = async (rechte: Rechte, bestaetigt = false): Promise<string> => {
    const o = JSON.parse((await datei()).text);
    o.positionen[0].sitz.darf = { rechte, modus: "auto", ...(bestaetigt ? { bestaetigt: true } : {}) };
    return JSON.stringify(o);
  };
  const ORCH = (l: string) => l === "Orchestrator";
  const LAND_DEPLOY = ["Bash(./ctl.sh land *)", "Bash(curl *api/deploy*)", "Bash(curl *api/worktrees/discard*)"];

  test("ein auf A gesetztes Recht reist beim ersten Export im Sitz-Block, nicht als Feld der Position", async () => {
    const k: Konst = { ...K, wurzeln: [pos("bauer", "Bauer", "bauer", { rechte: { stufe: "lesen", an: [], aus: [] }, kids: [pos("pruefer", "Prüfer", "lane")] })] };
    const { obj } = await datei(k);
    const bauer = (obj.positionen as Record<string, unknown>[])[0]!;
    expect([(bauer.sitz as { darf: unknown }).darf, "rechte" in bauer]).toEqual([{ rechte: { stufe: "lesen", an: [], aus: [] }, modus: "auto" }, false]);
    expect(fassungsHash(form(k, PROFILE))).not.toBe(fassungsHash(form(K, PROFILE)));
    // auf B steht es im Sitz-Block statt an der Position: dieselbe Fassung, und abgeleitetVon nennt sie
    const imp = importKonst(JSON.stringify(obj), PROFILE0, 7);
    if (typeof imp === "string") throw new Error(imp);
    expect([imp.k.wurzeln[0]?.rechte, fassungsHash(form(imp.k, [...PROFILE0, ...imp.neueProfile]))]).toEqual([undefined, obj.abgeleitetVon as string]);
  });
  test("„deployen“ aus einer Datei: die Tür gibt höchstens „bauen“ — keine Allow-Regel für Land, Deploy, Verwerfen", async () => {
    const { dir, kid } = await speicher(await mitRechten({ stufe: "deployen", an: [], aus: [] }));
    const t = await sitzDerTuer({ sitz: `${kid}/bauer` }, "claude", dir, null, ORCH);
    if (!t.ok) throw new Error(t.error);
    expect(t.rechte?.stufe).toBe("bauen");
    const r = rechteRegeln(t.rechte!);
    expect([LAND_DEPLOY.filter((x) => r.allow.includes(x)), LAND_DEPLOY.every((x) => r.deny.includes(x))]).toEqual([[], true]);
  });
  test("ein einzelner Schalter über dem Deckel wird gesperrt, einer darunter bleibt", async () => {
    const { dir, kid } = await speicher(await mitRechten({ stufe: "lesen", an: ["deploy", "dateien"], aus: [] }));
    const t = await sitzDerTuer({ sitz: `${kid}/bauer` }, "claude", dir, null, ORCH);
    expect(t.ok && t.rechte).toEqual({ stufe: "lesen", an: ["dateien"], aus: [] });
  });
  test("eine Freigabe in der Datei zählt nicht; nur die des Owners im eigenen Speicher hebt den Deckel", async () => {
    const aus = await speicher(await mitRechten({ stufe: "deployen", an: [], aus: [] }, true));
    const t = await sitzDerTuer({ sitz: `${aus.kid}/bauer` }, "claude", aus.dir, null, ORCH);
    expect(t.ok && t.rechte?.stufe).toBe("bauen");
    const frei = await speicher(await mitRechten({ stufe: "deployen", an: [], aus: [] }), (k) => { k.wurzeln[0]!.sitz!.darf.bestaetigt = true; });
    const f = await sitzDerTuer({ sitz: `${frei.kid}/bauer` }, "claude", frei.dir, null, ORCH);
    expect(f.ok && f.rechte?.stufe).toBe("deployen");
  });
  test("ein mitgereister Sitz startet nie als Orchestratorin", async () => {
    const { dir, kid } = await speicher((await datei()).text);
    expect(await sitzDerTuer({ sitz: `${kid}/bauer` }, "claude", dir, "Orchestrator", ORCH))
      .toEqual({ ok: false, error: "an imported seat never starts as the orchestrator — she runs in bypassPermissions" });
    expect((await sitzDerTuer({ sitz: `${kid}/bauer` }, "claude", dir, "Bauer", ORCH)).ok).toBe(true);
  });
  test("der Export lässt die Freigabe des Owners daheim", async () => {
    const imp = importKonst(await mitRechten({ stufe: "deployen", an: [], aus: [] }), PROFILE0, 7);
    if (typeof imp === "string") throw new Error(imp);
    imp.k.wurzeln[0]!.sitz!.darf.bestaetigt = true;
    const d = await dateiFuer(form(imp.k, [...PROFILE0, ...imp.neueProfile]), quellen());
    if (typeof d === "string") throw new Error(d);
    expect(JSON.stringify(d.datei).includes("bestaetigt")).toBe(false);
  });
});

// Abnahme datei-traegt (Delta, nach kind-nie-weiter): an der Self-Tür setzt kindNieWeiter die Rechte eines Kindes ohne eigene auf die der
// Öffnerin, auch auf null; dann füllte das Darf aus der Datei die Lücke. Es geht darum durch dieselbe Regel (server/kind-weite.ts)
describe("das Darf aus der Datei ist an der Self-Tür nie weiter als die Öffnerin", () => {
  const r = (stufe: Rechte["stufe"]): Rechte => ({ stufe, an: [], aus: [] });
  const auto = (rechte: Rechte | null): Oeffnerin => ({ harness: "claude", modus: "auto", permissions: null, rechte });
  test("eine Öffnerin ohne Rechte öffnet keinen Sitz, dem die Datei (freigegeben) Landen und Deploy erlaubt", () => {
    const a = rechteAnDerTuer(null, r("deployen"), "claude", auto(null));
    expect(a.ok ? null : a.error.startsWith("sitz: rechte give landen, deploy, verwerfen more than yours")).toBe(true);
  });
  test("eine Öffnerin, die nur liest, öffnet keinen Sitz, der laut Datei baut", () => {
    expect(rechteAnDerTuer(null, r("bauen"), "claude", auto(r("lesen"))).ok).toBe(false);
  });
  test("was nicht weiter ist, geht durch; die Rechte des Bodys gehen vor; die Owner-Tür und die Orchestratorin prüfen nichts", () => {
    expect(rechteAnDerTuer(null, r("bauen"), "claude", auto(null))).toEqual({ ok: true, rechte: r("bauen") });
    expect(rechteAnDerTuer(r("lesen"), r("deployen"), "claude", auto(r("lesen")))).toEqual({ ok: true, rechte: r("lesen") });
    expect(rechteAnDerTuer(null, r("deployen"), "claude", null)).toEqual({ ok: true, rechte: r("deployen") });
    expect(rechteAnDerTuer(null, r("deployen"), "claude", { ...auto(null), modus: "bypassPermissions" })).toEqual({ ok: true, rechte: r("deployen") });
  });
});
