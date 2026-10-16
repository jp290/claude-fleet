// K15 · DER WORTLAUT EINER SESSION, Abschnitt für Abschnitt (Owner 16.10. 00:5x: „[Zitat entfernt]“
// ). Ein
// Abschnitt ist die Adresse, die es schon gibt: ein Teil des Plans (FoundingPlanPart) mit Pfad und Anker, so wie
// context-sections.ts#sectionAt ihn schneidet, dazu was Fleet beim Zusammensetzen selbst schreibt. Ein Abschnitt lässt sich als
// eigene Fassung ändern; Fleets Text bleibt, wie er ist. Dieses Modul hat kein DOM; die Oberfläche liegt in src/k15-wortlaut-ui.ts.
import type { Answer, Baustein } from "./founding";
import type { FoundingPlanPart } from "./protocol";
import type { PlanRolle } from "./k15-entwurf-modell";

// eine eigene Fassung eines Abschnitts. `abschnitt` ist ihr Schlüssel (`schluessel`): wem sie gehört und welcher Abschnitt; `basis` ist
// die Kennung von Fleets Text, auf dem sie aufsetzt (der sha256 des Plan-Teils, sonst `textBasis`)
export interface TextFassung { abschnitt: string; teil: string | null; v: number; text: string; basis: string | null; am: number; autor: string }
// DER SCHLÜSSEL EINER FASSUNG (Prüfung Punkt 5: „einen Schlüssel, der nicht auf fremde Dateien überspringt“): Fleets Text gehört dem
// Profil, eine eigene Datei ihrer Kennung. Vor dem 16.10. hieß er nur „Datei#Abschnitt“ und galt für jede Rolle und jede Datei gleichen
// Namens; solche Schlüssel haben kein „|“.
export const schluessel = (wem: string, abschnitt: string): string => `${wem}|${abschnitt}`;
// eine Kennung für Fleets Text, wo der Plan keinen sha256 nennt (FNV-1a, 32 Bit): genug, um zu sehen, dass er sich geändert hat
export function textBasis(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `t:${h.toString(16).padStart(8, "0")}`;
}

// EIN BLOCK des Wortlauts: ein Zwischentitel oder ein Text mit seiner Adresse. `fleet` ist Fleets Text, `text` das, was angezeigt
// wird (die eigene Fassung, wenn es eine gibt); `spannen` sagt, welcher Baustein welchen Teil von `fleet` trägt.
export interface Spanne { baustein: string; von: number; bis: number }
export type Block = { art: "zwischen"; titel: string }
  | { art: "text"; key: string; titel: string; fleet: string; text: string; abschnitt: string; fassung: string | null; teil: string | null;
    spannen: Spanne[]; eigen: TextFassung | null; bytes: number | null; fkey: string; basis: string };
export type TextBlock = Extract<Block, { art: "text" }>;
// hat sich Fleets Text geändert, seit die eigene Fassung entstand? (Prüfung Punkt 5: „basis wird gespeichert, aber nie verglichen“)
export const veraltet = (b: TextBlock): boolean => !!b.eigen && b.eigen.basis !== null && b.eigen.basis !== b.basis;

const ueberschrift = (zeile: string): string | null => /^ {0,3}#{1,6}\s+(.*)$/.exec(zeile)?.[1]?.trim() ?? null;
const utf8 = new TextEncoder();
export const bytesVon = (t: string): number => utf8.encode(t).length;
// der Zeichen-Versatz, der `n` UTF-8-Bytes von `text` entspricht
function zeichenBei(text: string, n: number): number {
  let b = 0;
  for (let i = 0; i < text.length; i++) {
    if (b >= n) return i;
    const c = text.codePointAt(i) ?? 0;
    b += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
    if (c >= 0x10000) i++;
  }
  return text.length;
}

// DER FUSS DER SESSION-DATEI trägt mehrere Bausteine in fester Reihenfolge, verbunden mit "\n\n" (server.ts#plannedFileRows: „Lane
// order is the dispatch file's: owner-heft pointer, lane footer, memory pointer“). Der Plan misst jeden als „[Zitat entfernt]“
//  (server.ts#measurePlannedFile), also Länge plus Trenner; daraus folgen die Grenzen. Stimmen die Bytes nicht genau auf, trägt
// der ganze Teil den Baustein seines Ankers.
const FUSS: Record<PlanRolle, string[]> = { lane: ["owner-heft", "lane-footer", "memory-pointer"], main: ["main-rail"], orchestratorin: [], "nur-ordner": [] };
const TRENNER = 2;
function fussSpannen(text: string, rolle: PlanRolle, bs: readonly Baustein[]): Spanne[] | null {
  const rows = FUSS[rolle].map((id) => bs.find((b) => b.id === id)).filter((b): b is Baustein => b?.zustand === "an");
  if (!rows.length) return null;
  if (rows.length === 1) return [{ baustein: rows[0].id, von: 0, bis: text.length }];
  const ls: number[] = [];
  for (const row of rows) { if (typeof row.bytes !== "number") return null; ls.push(row.bytes - TRENNER); }
  if (ls.reduce((n, x) => n + x, 0) + TRENNER * (rows.length - 1) !== bytesVon(text)) return null;
  const out: Spanne[] = [];
  let b = 0;
  rows.forEach((row, i) => {
    out.push({ baustein: row.id, von: zeichenBei(text, b), bis: zeichenBei(text, b + ls[i]) });
    b += ls[i] + TRENNER;
  });
  return out;
}
// welcher Baustein einen Teil trägt: die Rollenkarte, ein Pack (der Vertrag ist der box-Teil seines Packs, server.ts: „the contract
// is its pack's box part“, dort `bytes["portable-contract"] = contract.bytes`) oder der Fuß
function teilBaustein(p: FoundingPlanPart, rolle: PlanRolle, bs: readonly Baustein[]): string {
  if (p.id === "role") return rolle === "orchestratorin" ? "orchestrator-card" : "role-card";
  if (p.id === "portable-core.contract" && bs.some((b) => b.id === "portable-contract" && b.enthaltenIn === "pack:portable-core")) return "portable-contract";
  if (p.packId) return `pack:${p.packId}`;
  return FUSS[rolle][rolle === "lane" ? 1 : 0] ?? "context-anchors";
}
export const abschnittVon = (p: Pick<FoundingPlanPart, "path" | "anchor" | "id">): string => `${p.path ?? "Plan"}#${p.anchor ?? p.id}`;

// DIE BLÖCKE DER SESSION-DATEI: jeder Teil des Plans mit Text ist ein Block mit seiner Adresse; was zwischen den Teilen steht, setzt
// Fleet selbst zusammen (Überschriften, die Liste „Packs auf Abruf“, server.ts#renderContextAnchorBlock).
export function bloeckeVon(a: Answer, rolle: PlanRolle, name: (id: string) => string, fassungen: ReadonlyMap<string, TextFassung>, wem: string): Block[] {
  const sa = a.sessionAgents;
  if (!sa) return [];
  const bs = a.plan.bausteine;
  const out: Block[] = [];
  const zwischen = (t: string, von: number) => {
    let titel: string | null = null, rumpf: string[] = [], start = von, pos = von;
    const fertig = () => {
      const text = rumpf.join("\n").trim();
      if (titel !== null && !text) out.push({ art: "zwischen", titel });
      else if (text) {
        const abschnitt = `Session-Datei#${titel ?? "Anfang"}`;
        const fkey = schluessel(wem, abschnitt);
        const eigen = fassungen.get(fkey) ?? null;
        out.push({ art: "text", key: `fleet:${titel ?? start}`, titel: titel ?? "Fleet", fleet: text, text: eigen?.text ?? text, abschnitt, fassung: null, teil: null,
          spannen: [{ baustein: "context-anchors", von: 0, bis: text.length }], eigen, bytes: bytesVon(text), fkey, basis: textBasis(text) });
      }
    };
    for (const z of t.split("\n")) {
      const h = ueberschrift(z);
      if (h !== null) { fertig(); titel = h; rumpf = []; start = pos; } else rumpf.push(z);
      pos += z.length + 1;
    }
    fertig();
  };
  let cursor = 0;
  for (const p of sa.parts) {
    if (!p.content) continue;
    const i = sa.text.indexOf(p.content, cursor);
    if (i < 0) continue;
    zwischen(sa.text.slice(cursor, i), cursor);
    const abschnitt = abschnittVon(p);
    const fkey = schluessel(wem, abschnitt);
    const eigen = fassungen.get(fkey) ?? null;
    const kopf = ueberschrift(p.content.split("\n")[0] ?? "");
    const spannen = (p.id === "footer" ? fussSpannen(p.content, rolle, bs) : null) ?? [{ baustein: teilBaustein(p, rolle, bs), von: 0, bis: p.content.length }];
    out.push({ art: "text", key: `teil:${p.id}`, titel: kopf ?? [...new Set(spannen.map((x) => name(x.baustein)))].join(" · "), fleet: p.content,
      text: eigen?.text ?? p.content, abschnitt, fassung: p.sha256, teil: p.id, spannen, eigen, bytes: p.bytes, fkey, basis: p.sha256 ?? textBasis(p.content) });
    cursor = i + p.content.length;
  }
  zwischen(sa.text.slice(cursor), cursor);
  return out;
}

// EXPORT UND IMPORT der eigenen Fassungen: nur „vollständig“ trägt sie, mit ihrem Text
export const fassungenExport = (fassungen: readonly TextFassung[]): object[] =>
  fassungen.map((f) => ({ abschnitt: f.abschnitt, teil: f.teil, version: f.v, basis: f.basis, autor: f.autor, text: f.text }));
const str = (v: unknown, max: number): string | null => typeof v === "string" ? v.slice(0, max) : null;
// liest, was ein Export trägt; was nicht passt, fällt einzeln heraus, statt den ganzen Import zu kippen
export function fassungenImport(liste: unknown, jetzt: number): { fassungen: TextFassung[]; verworfen: number } {
  const fassungen: TextFassung[] = [];
  let verworfen = 0;
  for (const x of Array.isArray(liste) ? liste : []) {
    const r: Record<string, unknown> = x && typeof x === "object" ? { ...x } : {};
    const abschnitt = str(r.abschnitt, 400), text = str(r.text, 400_000);
    if (!abschnitt || text === null) { verworfen++; continue; }
    fassungen.push({ abschnitt, teil: str(r.teil, 120), v: typeof r.version === "number" && r.version >= 1 ? Math.floor(r.version) : 1, text,
      basis: str(r.basis, 80), am: jetzt, autor: str(r.autor, 40) ?? "?" });
  }
  return { fassungen, verworfen };
}
