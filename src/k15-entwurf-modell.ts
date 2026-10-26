// K15 draft D, the data model: profile -> constellation (owner 15 Oct). What a session gets is not decided here but in the founding
// plan (GET /api/founding-plan, from session-blocks.ts#SESSION_BLOCKS). A profile picks the role whose plan it reads and how its
// pieces deviate. A constellation is positions that each point at a profile, and who reports to whom. Profile and constellation
// carry an author: "Fleet" for the ones that ship with it. What the rest of the repo imports from here: the types, the shipped
// profiles and constellations, the export (exportObjekt, exportJson), the role card reader (autonomieAus) and `aspekt`.
import { icon } from "./icons";
import type { Aufgabe } from "./aufgabe";
import type { LaufBericht } from "./lauf-bericht";
import { sitzZumTeilen, type Sitz } from "./sitz";
import type { Rechte } from "../session-rechte";

export type Glyph = Parameters<typeof icon>[0];
export interface Abschnitt { titel: string; text: string; pfad?: string; bytes?: number }
export type Wert = string | number | string[];
// `id` trennt zwei Dateien gleichen Namens (eigene Fassungen hängen daran, k15-wortlaut-ui.ts#dateiBloecke)
export interface Quelle { id?: string; titel: string; v: number; pfad: string; abschnitte: Abschnitt[] }
// die Rolle, deren Gründungsplan gilt (GET /api/founding-plan?role=)
export type PlanRolle = "lane" | "main" | "orchestratorin" | "nur-ordner";
// die Schiene der Succession (server/succession.ts#SessionKind)
export type Schiene = "orchestrator" | "program-main" | "bau" | "lane" | "session";
export type Schalter = Record<string, "an" | "aus">;
// null = der Standard, den Fleet für die Rolle meldet; eine Zahl oder ein Wort = gesetzt. `agent` ist die Harness-ID des Servers
// (GET /api/harnesses), src/k15-agent.ts
export interface Werte { agent: string | null; modell: string | null; effort: string | null; schwelle: number | null }
export interface Profil extends Werte {
  id: string; name: string; glyph: Glyph; v: number; kurz: string; satz: string; autor: string;
  rolle: PlanRolle; schiene: Schiene;
  // Abweichung des Profils von seinem Umfang, je Baustein-ID des Plans
  schalter: Schalter;
  // was Claude Code im Ordner selbst lädt und der Entwurf als Abschrift zeigt (nur die Branch-Session)
  nativ: Quelle | null;
  einV: number; rechteV: number;
  werte: Record<string, Wert>;
  // die Autonomie einer eigenen Fassung (null = so, wie die Rollenkarte im Plan sie trägt) und wovon sie kopiert ist
  autonomie: Punkt[] | null; kopieVon?: { name: string; v: number };
  // die eigene Agent-MD, mit der das Profil arbeitet (src/k15-agentmd.ts); eine neue Session mit diesem Profil bekommt sie mit
  datei?: Quelle;
}
export interface Position { id: string; name: string; profil: string; kids?: Position[]; abw?: Partial<Werte>; datei?: Quelle;
  // Teile der Session-Datei, die nicht mitgehen sollen (Schritt 4, heute nicht schaltbar)
  ohne?: string[];
  werteAbw?: Record<string, Wert>; schalter?: Schalter; wann?: string;
  // was mit dem Sitz aus einer anderen Fleet reiste (src/sitz.ts): liest, persönliche Plätze, darf, Notizbuch; ohne ihn liest er Fleets Bibliothek
  sitz?: Sitz;
  // was die Session darf (session-rechte.ts), hier gesetzt; die Tür bekommt es beim Start, ein Export trägt es in sitz.darf
  rechte?: Rechte }
// DAS PROTOKOLL EINER KONSTELLATION (Harness 2.0 Schritt 3, harness-2-0-antwort.md Lücke 2): wann ein Lauf endet, wie viele Runden höchstens,
// nach welcher Regel geprüft wird. Jedes Teil ist frei; die Endbedingung ist meist die CI und lässt sich abschalten (Owner 19.10.). null = nicht gesagt
export interface Protokoll { ende: string | null; runden: number | null; regel: string | null }
export const protokollLeer = (p: Protokoll | undefined): boolean => !p || (p.ende === null && p.runden === null && p.regel === null);
// eigen = bearbeitbar; ohne eigen ist sie eine Fleet-Vorlage. autor: wer sie geschrieben hat (aus einem Import), sonst du
// aufgabe: die Aufgabe, mit der sie reist (docs/konstellation/restplan.md T3); sie zählt in die Fassung
// abgeleitetVon: der Hash der Fassung, aus der sie exportiert wurde; laeufe: mitgereiste Läufe als Bericht. Beide zählen nicht in die Fassung
export interface Konst { id: string; name: string; v: number; satz: string; eigen?: true; autor?: string; quer?: string; protokoll?: Protokoll; aufgabe?: Aufgabe;
  abgeleitetVon?: string; laeufe?: LaufBericht[];
  // was an dieser Konstellation heute nicht geht, in einem Satz
  heuteNicht?: string; wurzeln: Position[] }

export const FLEET = "Fleet";

const profil = (o: Omit<Profil, "agent" | "modell" | "effort" | "schwelle" | "schalter" | "nativ" | "einV" | "rechteV" | "werte" | "autor" | "autonomie"> & Partial<Profil>): Profil =>
  ({ agent: null, modell: null, effort: null, schwelle: null, schalter: {}, nativ: null, einV: 1, rechteV: 1, werte: {}, autor: FLEET, autonomie: null, ...o });
export const PROFILE0: Profil[] = [
  profil({ id: "orchestratorin", name: "Orchestrator", glyph: "ranke", v: 2, kurz: "oversees the MAINs", satz: "oversees the MAINs",
    rolle: "orchestratorin", schiene: "orchestrator", einV: 3, rechteV: 2 }),
  profil({ id: "main", name: "MAIN", glyph: "flag", v: 5, kurz: "leads a program", satz: "leads a program: writes cards, checks reports, lands",
    rolle: "main", schiene: "program-main", einV: 2, rechteV: 2, werte: { "selbst-bis": 50, "lanes-max": 3 } }),
  profil({ id: "lane", name: "Lane", glyph: "branch", v: 3, kurz: "one task per worktree", satz: "works one task in its own worktree",
    rolle: "lane", schiene: "lane", einV: 2 }),
  profil({ id: "bau", name: "Branch session", glyph: "commit", v: 1, kurz: "own branch with a goal", satz: "own branch with a goal, works until it lands",
    rolle: "nur-ordner", schiene: "bau" }),
  profil({ id: "ordner", name: "Folder only", glyph: "folder", v: 1, kurz: "no role", satz: "no role; loads the folder and its AGENTS.md",
    rolle: "nur-ordner", schiene: "session" }),
  profil({ id: "eigen", name: "Own agent MD", glyph: "file", v: 1, kurz: "your .md", satz: "works from your agent MD",
    rolle: "nur-ordner", schiene: "session" }),
];

export const pos = (id: string, name: string, profil: string, more: Partial<Position> = {}): Position => ({ id, name, profil, ...more });

// DIE AUTONOMIE (Z16, Owner 15.10. 11:4x: „[Zitat entfernt]“
// ). Jede Rollenkarte trägt sie schon (docs/rollenkarten.md): YOU
// DECIDE (was sie ohne Rückfrage tut), THE OWNER DECIDES bzw. YOUR LIMIT (wo sie zuerst fragt) und BLOCKERS (was keine
// Rolle tut, für alle gleich). Gelesen aus dem Rollen-Teil des Plans (sessionAgents.parts, id „[Zitat entfernt]“), nicht abgeschrieben. Eine
// eigene Fassung verschiebt Punkte, streicht oder ergänzt sie.
export type AutoArt = "selbst" | "fragt" | "nie";
// `vorlage` = wo der Punkt in der Karte steht (null: selbst ergänzt); `art` "weg" = in dieser Fassung gestrichen
export interface Punkt { id: string; text: string; art: AutoArt | "weg"; vorlage: AutoArt | null }
interface AutoZeile { key: string; sep: string; nach: string; notiz: string }
export interface Autonomie { punkte: Punkt[]; zeilen: Partial<Record<AutoArt, AutoZeile>>; wen: string | null; karte: string; quelle: string }
const AUTO_KEYS: Record<string, AutoArt> = { "YOU DECIDE": "selbst", "THE OWNER DECIDES": "fragt", "YOUR LIMIT": "fragt", "BLOCKERS (always)": "nie" };
// an `sep` teilen, nur außerhalb von Klammern („kleine reversible Akte selbst (Archiv, Ersatzzeile, …)“ bleibt ein Punkt)
function teile(text: string, sep: string): string[] {
  const out: string[] = [];
  let tief = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") tief++;
    else if (text[i] === ")") tief = Math.max(0, tief - 1);
    else if (tief === 0 && text.startsWith(sep, i)) { out.push(text.slice(start, i)); start = i + sep.length; i = start - 1; }
  }
  out.push(text.slice(start));
  return out.map((x) => x.trim()).filter(Boolean);
}
// wo nach der Liste ein Satz folgt („… the constitution itself. Exactly ONE question per limit“, „… everything under BLOCKERS: ask instead of act“)
function schnitt(text: string): number {
  let tief = 0;
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] === "(") tief++;
    else if (text[i] === ")") tief = Math.max(0, tief - 1);
    else if (tief === 0 && (text[i] === "." || text[i] === ":") && text[i + 1] === " ") return i;
  }
  return -1;
}
export function autonomieAus(karte: string, quelle: string): Autonomie | null {
  const punkte: Punkt[] = [];
  const zeilen: Partial<Record<AutoArt, AutoZeile>> = {};
  let wen: string | null = null;
  for (const z of karte.split("\n")) {
    const m = /^--- (.+?) --- (.*)$/.exec(z);
    if (!m) continue;
    const text = m[2].trim().replace(/\.$/, "");
    if (m[1] === "YOUR RECIPIENT") { wen = text.split(/[.:]/)[0].trim(); continue; }
    const art = AUTO_KEYS[m[1]];
    if (!art) continue;
    const i = art === "nie" ? -1 : schnitt(text);
    const liste = i < 0 ? text : text.slice(0, i);
    const sep = art === "nie" ? " · " : liste.includes(";") ? ";" : ",";
    // ein Komma trennt nur eine Aufzählung (ab drei Teilen); „wie du das DONE erreichst, innerhalb von FLAECHE …“ ist ein Punkt
    const ps = teile(liste, sep);
    const items = sep === "," && ps.length < 3 ? [liste.trim()] : ps;
    zeilen[art] = { key: m[1], sep: sep === " · " ? " · " : `${sep} `, nach: i < 0 ? "" : text.slice(i, i + 2), notiz: i < 0 ? "" : text.slice(i + 2).trim() };
    items.forEach((t, n) => punkte.push({ id: `${art}-${n}`, text: t, art, vorlage: art }));
  }
  return punkte.length ? { punkte, zeilen, wen, karte, quelle } : null;
}

// WAS DIE DATEI ERBITTET: die Einstellungen einer Position, die im Brief der Session als Satz stehen (server/sitz-reise.ts#erbeteneZeilen).
// Der Satz ist Text für den Agenten, auf englisch; `abschnitt` ist der Abschnitt der Karte, zu dem er gehört.
// Ein Wert je Gruppe trägt den Schlüssel `<aspekt>.<gruppe>`; `aspekt` liest nur den Teil vor dem Punkt.
export interface Aspekt { id: string; wirkung: { wo: "brief"; abschnitt: string; satz: string } }
export const ASPEKTE: Aspekt[] = [
  { id: "selbst-bis", wirkung: { wo: "brief", abschnitt: "YOU DECIDE", satz: "Small work you do yourself: up to {{selbst-bis}} diff lines, above that you open a Lane." } },
  { id: "subagenten", wirkung: { wo: "brief", abschnitt: "YOU DECIDE", satz: "Subagents: {{subagenten}}." } },
];
export const aspekt = (id: string): Aspekt | undefined => ASPEKTE.find((a) => a.id === id.split(".")[0]);

export const alle = (ps: Position[]): Position[] => ps.flatMap((p) => [p, ...alle(p.kids ?? [])]);
export const eltern = (k: Konst, id: string): Position | null => alle(k.wurzeln).find((p) => p.kids?.some((c) => c.id === id)) ?? null;

// der Autor einer eigenen Konstellation, wenn kein Name mitkam
export const DU = "du";

// EXPORT: dieselbe Form auf jeder Ebene; mit Verweisen (lane@3) oder vollständig (Werte eingebettet)
export type Ebene = "system" | "konst" | "session" | "baustein";
// `zusatz` hängt an, was im vollständigen Export mitreist (eigene Fassungen und Kontextpacks als Entwurf). `teilen`: es geht hinaus, also
// bleibt jeder persönliche Platz leer (src/sitz.ts#sitzZumTeilen); ohne es ist es die Form des eigenen Speichers, die das Eigene behält
type ExportEingang = { ebene: Ebene; voll: boolean; konst: Konst[]; k: Konst; profile: Profil[]; q: Position | null; p: Profil; zusatz?: object; teilen?: boolean };
export const exportJson = (o: ExportEingang): string => JSON.stringify(exportObjekt(o), null, 2);
// dasselbe als Objekt: so legt der Server-Speicher eine Konstellation ab (k15-zustand.ts#konstForm)
export function exportObjekt(o: ExportEingang): Record<string, unknown> {
  const von = (id: string) => o.profile.find((x) => x.id === id) ?? o.p;
  const ref = (x: Profil) => `${x.id}@${x.v}`;
  const voll = (x: Profil) => ({ id: x.id, version: x.v, name: x.name, glyph: x.glyph, kurz: x.kurz, satz: x.satz, autor: x.autor, rolle: x.rolle, schiene: x.schiene,
    agent: x.agent, modell: x.modell, effort: x.effort, uebergabeAb: x.schwelle, einV: x.einV, rechteV: x.rechteV, ...(x.datei ? { datei: x.datei } : {}),
    ...(Object.keys(x.schalter).length ? { schalter: x.schalter } : {}), werte: x.werte,
    ...(x.kopieVon ? { kopieVon: `${x.kopieVon.name}@${x.kopieVon.v}` } : {}),
    ...(x.autonomie ? { autonomie: Object.fromEntries((["selbst", "fragt", "nie", "weg"] as const).map((art) => [art, x.autonomie?.filter((p) => p.art === art).map((p) => p.text) ?? []])) } : {}) });
  const position = (k: Konst, x: Position) => {
    const vater = eltern(k, x.id);
    return { id: x.id, name: x.name, profil: o.voll ? voll(von(x.profil)) : ref(von(x.profil)),
      ...(vater ? { meldetAn: vater.id } : {}), ...(x.abw ? { abweichend: x.abw } : {}),
      ...(x.datei ? { eigeneDatei: o.voll ? x.datei : x.datei.titel } : {}), ...(x.ohne ? { ohneTeile: x.ohne } : {}), ...(x.werteAbw ? { werteAbw: x.werteAbw } : {}),
      ...(x.schalter ? { schalter: x.schalter } : {}), ...(x.wann ? { wann: x.wann } : {}),
      // Rechte an der Position nur im eigenen Speicher: hinaus gehen sie allein über den Server-Export in sitz.darf (server/sitz-reise.ts#dateiFuer)
      ...(x.rechte && !o.teilen ? { rechte: x.rechte } : {}), ...(x.sitz ? { sitz: o.teilen ? sitzZumTeilen(x.sitz) : x.sitz } : {}) };
  };
  const konst = (k: Konst) => ({ name: k.name, version: k.v, satz: k.satz, autor: k.eigen ? k.autor ?? DU : FLEET, ...(k.quer ? { quer: k.quer } : {}),
    ...(k.abgeleitetVon ? { abgeleitetVon: k.abgeleitetVon } : {}),
    ...(k.protokoll && !protokollLeer(k.protokoll) ? { protokoll: k.protokoll } : {}),
    ...(k.aufgabe ? { aufgabe: k.aufgabe } : {}),
    positionen: alle(k.wurzeln).map((x) => position(k, x)),
    ...(k.laeufe?.length ? { laeufe: k.laeufe } : {}) });
  const p = o.p;
  const obj = o.ebene === "system" ? { fleet: "system", konstellationen: o.konst.map(konst), profile: o.profile.map((x) => o.voll ? voll(x) : ref(x)) }
    : o.ebene === "konst" ? { fleet: "konstellation", ...konst(o.k) }
    : o.ebene === "session" ? { fleet: "session", ...(o.q ? position(o.k, o.q) : { profil: o.voll ? voll(p) : ref(p) }) }
    : { fleet: "baustein", art: "einstellungen", version: p.einV, agent: p.agent, modell: p.modell, effort: p.effort, uebergabeAb: p.schwelle };
  return { format: 1, ...obj, ...o.zusatz };
}
