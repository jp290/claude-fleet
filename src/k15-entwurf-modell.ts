// K15 ENTWURF D · das Datenmodell (wegwerfbar): Profil → Konstellation, Owner 15.10. Was eine Session bekommt, steht
// nicht hier, sondern im Gründungsplan (GET /api/founding-plan, aus session-blocks.ts#SESSION_BLOCKS): ein Profil wählt
// die Rolle, deren Plan es liest, den Umfang je Gruppe (nur Pflicht, Standard, alles) und Abweichungen einzelner Bausteine.
// Die Gruppen (wofür) und die Orte (wo es landet) liest dieses Modell aus dem Plan, es erfindet keinen Katalog daneben.
// Konstellation = Positionen, die je auf ein Profil zeigen, und wer an wen meldet. Modell, Effort und Succession tragen ihre
// Herkunft (Rangfolge: `wirksam`). Profil und Konstellation tragen einen Autor: „Fleet“ für mitgelieferte.
import { icon } from "./icons";
import { K15_DATEN as D } from "./k15-entwurf-daten";
import type { Answer, Baustein } from "./founding";

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
export type Feld = keyof Werte;
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
  werteAbw?: Record<string, Wert>; schalter?: Schalter; wann?: string }
// DAS PROTOKOLL EINER KONSTELLATION (Harness 2.0 Schritt 3, harness-2-0-antwort.md Lücke 2): wann ein Lauf endet, wie viele Runden höchstens,
// nach welcher Regel geprüft wird. Jedes Teil ist frei; die Endbedingung ist meist die CI und lässt sich abschalten (Owner 19.10.). null = nicht gesagt
export interface Protokoll { ende: string | null; runden: number | null; regel: string | null }
export const ENDE_CI = "Die CI des Repos ist grün.";
export const protokollLeer = (p: Protokoll | undefined): boolean => !p || (p.ende === null && p.runden === null && p.regel === null);
// eigen = bearbeitbar; ohne eigen ist sie eine Fleet-Vorlage. autor: wer sie geschrieben hat (aus einem Import), sonst du
export interface Konst { id: string; name: string; v: number; satz: string; eigen?: true; autor?: string; quer?: string; protokoll?: Protokoll;
  // was an dieser Konstellation heute nicht geht, in einem Satz
  heuteNicht?: string; wurzeln: Position[] }

export const FLEET = "Fleet";
const AGENTS_MD: Quelle = { titel: "AGENTS.md des Branches", v: 3, pfad: "AGENTS.md · Abschrift vom 15.10.", abschnitte: D.agents.map((a) => ({ ...a })) };

export const REVIEW_MD: Quelle = { titel: "review-regeln.md", v: 1, pfad: "eigene Datei · Beispiel", abschnitte: [
  { titel: "# Review-Regeln", text: "Du liest jeden Diff, den eine Lane meldet, bevor die MAIN ihn annimmt." },
  { titel: "## Was du prüfst", text: "- Tut der Diff, was die Karte verlangt, und nicht mehr?\n- Läuft der genannte Check, und steht sein Ergebnis wörtlich im Report?\n- Steht etwas außerhalb der Fläche der Karte?" },
  { titel: "## Was du meldest", text: "Ein Satz Urteil, darunter die Stellen mit Datei und Zeile." },
] };

const profil = (o: Omit<Profil, "agent" | "modell" | "effort" | "schwelle" | "schalter" | "nativ" | "einV" | "rechteV" | "werte" | "autor" | "autonomie"> & Partial<Profil>): Profil =>
  ({ agent: null, modell: null, effort: null, schwelle: null, schalter: {}, nativ: null, einV: 1, rechteV: 1, werte: {}, autor: FLEET, autonomie: null, ...o });
export const PROFILE0: Profil[] = [
  profil({ id: "orchestratorin", name: "Orchestratorin", glyph: "ranke", v: 2, kurz: "beaufsichtigt die MAINs", satz: "beaufsichtigt die MAINs",
    rolle: "orchestratorin", schiene: "orchestrator", einV: 3, rechteV: 2 }),
  profil({ id: "main", name: "MAIN", glyph: "flag", v: 5, kurz: "führt ein Program", satz: "führt ein Program: schreibt Karten, prüft Reports, landet",
    rolle: "main", schiene: "program-main", einV: 2, rechteV: 2, werte: { "selbst-bis": 50, "lanes-max": 3 } }),
  profil({ id: "lane", name: "Lane", glyph: "branch", v: 3, kurz: "ein Auftrag je Worktree", satz: "arbeitet einen Auftrag im eigenen Worktree ab",
    rolle: "lane", schiene: "lane", einV: 2 }),
  profil({ id: "bau", name: "Branch-Session", glyph: "commit", v: 1, kurz: "eigener Branch mit Ziel", satz: "eigener Branch mit Ziel, arbeitet bis zum Land",
    rolle: "nur-ordner", schiene: "bau", nativ: AGENTS_MD }),
  profil({ id: "ordner", name: "Nur Ordner", glyph: "folder", v: 1, kurz: "ohne Rolle", satz: "ohne Rolle; lädt den Ordner und sein AGENTS.md",
    rolle: "nur-ordner", schiene: "session" }),
  profil({ id: "eigen", name: "Eigene Agent-MD", glyph: "file", v: 1, kurz: "deine .md", satz: "arbeitet nach deiner Agent-MD",
    rolle: "nur-ordner", schiene: "session" }),
];

export const pos = (id: string, name: string, profil: string, more: Partial<Position> = {}): Position => ({ id, name, profil, ...more });
const OHNE_KIND_OEFFNEN = "Heute öffnet keine Session ein Kind selbst, und die Kinder melden nicht an sie: Dafür fehlen die Self-Tür „Kind öffnen“ und ein Meldeweg vom Kind zur Session darüber (Server-Schritt).";
export const KONST0: Konst[] = [
  { id: "eine", name: "Eine Session", v: 1, satz: "eine Session für sich", wurzeln: [pos("s", "Branch-Session", "bau")] },
  { id: "main-lanes", name: "MAIN → Lanes", v: 2, satz: "eine MAIN führt Lanes",
    wurzeln: [pos("m", "MAIN", "main", { kids: [pos("l1", "Lane 1", "lane"), pos("l2", "Lane 2", "lane")] })] },
  { id: "orch", name: "Orchestratorin → MAIN → Lanes", v: 4, satz: "das ganze System",
    wurzeln: [pos("o", "Orchestratorin", "orchestratorin", { kids: [pos("m", "MAIN", "main", { kids: [pos("l1", "Lane 1", "lane", { wann: "wenn eine Karte mehr braucht, als die MAIN selbst baut" }),
      pos("l2", "Lane 2", "lane", { abw: { modell: "claude-sonnet-5-5", effort: "medium" }, datei: REVIEW_MD })] })] })] },
  { id: "eigene-md", name: "Eine Session mit deiner Agent-MD", v: 1, satz: "deine .md, Fleet nur minimal", wurzeln: [pos("e", "Deine Session", "eigen")] },
  { id: "main-eigen", name: "MAIN + Session mit minimaler Anbindung", v: 1, satz: "die MAIN führt, deine Session sieht nur sie", heuteNicht: OHNE_KIND_OEFFNEN,
    wurzeln: [pos("m", "MAIN", "main", { kids: [pos("e", "Deine Session", "eigen", { wann: "wenn eine Aufgabe zu deiner Agent-MD passt" })] })] },
  // zwei MAINs erreichen einander über die Adresse des anderen Programs (server.ts#sendMessageFor lehnt Program an Program nicht ab,
  // #resolveMessageAddress stellt an dessen MAIN zu; am 16.10. gelesen)
  { id: "mm", name: "MAIN ↔ MAIN", v: 1, satz: "schreiben einander", eigen: true, quer: "schreiben einander über ihr Program",
    wurzeln: [pos("ma", "MAIN A", "main"), pos("mb", "MAIN B", "main")] },
  // Owner 15.10. 11:5x: „[Zitat entfernt]“
  // ; die Anzahl ist eine Eigenschaft des Aufbaus (orchHinweis)
  { id: "zwei-orch", name: "Zwei Orchestratorinnen", v: 1, satz: "jede führt ihre MAINs",
    wurzeln: [pos("oa", "Orchestratorin A", "orchestratorin", { kids: [pos("ma", "MAIN A", "main")] }),
      pos("ob", "Orchestratorin B", "orchestratorin", { kids: [pos("mb", "MAIN B", "main")] })] },
];

// WIE VIELE ORCHESTRATORINNEN (Z16, Bauleitung: „[Zitat entfernt]“). Entscheidung
// K15: Der Aufbau legt die Anzahl fest, denn erst er sagt, welche MAINs an welche Orchestratorin melden; jede führt ihren Teilbaum.
// Die Sperre im Startfenster (src/founding.ts#blocker) bleibt, bis der Server das kann: Heute ist „Orchestratorin“ eine einzige
// Adresse, und bei zwei Trägerinnen löst sie zu niemandem auf (server.ts#orchestratorLabelHolders, #orchestratorAddressConflict).
// Fragen und Berichte der MAINs kämen dann bei keiner an.
export const orchZahl = (k: Konst, profile: Profil[]): number =>
  alle(k.wurzeln).filter((x) => profile.find((p) => p.id === x.profil)?.rolle === "orchestratorin").length;
export const orchHinweis = (n: number): string | null => n < 2 ? null
  : `${n} Orchestratorinnen, jede führt die MAINs unter sich. Heute kennt Fleet nur eine; laufen zwei, erreichen Fragen und Berichte der MAINs keine von beiden. Das ändert ein Server-Schritt, bis dahin startet das Fenster keine zweite.`;

// DIE AUTONOMIE (Z16, Owner 15.10. 11:4x: „[Zitat entfernt]“
// ). Jede Rollenkarte trägt sie schon (docs/rollenkarten.md): DU
// ENTSCHEIDEST (was sie ohne Rückfrage tut), DER OWNER ENTSCHEIDET bzw. DEINE GRENZE (wo sie zuerst fragt) und BLOCKER (was keine
// Rolle tut, für alle gleich). Gelesen aus dem Rollen-Teil des Plans (sessionAgents.parts, id „[Zitat entfernt]“), nicht abgeschrieben. Eine
// eigene Fassung verschiebt Punkte, streicht oder ergänzt sie; `karteMit` setzt daraus die Zeilen der Karte neu.
export type AutoArt = "selbst" | "fragt" | "nie";
// `vorlage` = wo der Punkt in der Karte steht (null: selbst ergänzt); `art` "weg" = in dieser Fassung gestrichen
export interface Punkt { id: string; text: string; art: AutoArt | "weg"; vorlage: AutoArt | null }
interface AutoZeile { key: string; sep: string; nach: string; notiz: string }
export interface Autonomie { punkte: Punkt[]; zeilen: Partial<Record<AutoArt, AutoZeile>>; wen: string | null; karte: string; quelle: string }
const AUTO_KEYS: Record<string, AutoArt> = { "DU ENTSCHEIDEST": "selbst", "DER OWNER ENTSCHEIDET": "fragt", "DEINE GRENZE": "fragt", "BLOCKER (immer)": "nie" };
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
// wo nach der Liste ein Satz folgt („… die Verfassung selbst. Genau EINE Frage je Grenze“, „… alles unter BLOCKER: fragen statt tun“)
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
    if (m[1] === "DEIN EMPFAENGER") { wen = text.split(/[.:]/)[0].trim(); continue; }
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
// die Rollenkarte mit den Punkten einer Fassung: nur die drei Zeilen der Autonomie ändern sich, alles andere bleibt Wort für Wort
export function karteMit(a: Autonomie, punkte: Punkt[]): string {
  return a.karte.split("\n").map((z) => {
    const m = /^--- (.+?) --- /.exec(z);
    const art = m ? AUTO_KEYS[m[1]] : undefined;
    const zl = art ? a.zeilen[art] : undefined;
    if (!art || !zl) return z;
    const items = punkte.filter((p) => p.art === art).map((p) => p.text);
    return `--- ${zl.key} --- ${items.length ? items.join(zl.sep) : "nichts"}${zl.notiz ? `${zl.nach}${zl.notiz}` : ""}.`;
  }).join("\n");
}
export const punkteVon = (p: Profil, a: Autonomie): Punkt[] => p.autonomie ?? a.punkte;
// was eine Fassung gegenüber der Karte ändert, je Punkt ein Satz
export function autoAenderungen(punkte: Punkt[]): string[] {
  const wort: Record<AutoArt | "weg", string> = { selbst: "entscheidet selbst", fragt: "fragt zuerst", nie: "nie", weg: "gestrichen" };
  return punkte.filter((p) => p.art !== p.vorlage).map((p) => p.vorlage === null ? `neu: ${p.text} (${wort[p.art]})` : `${p.text}: ${wort[p.vorlage]} → ${wort[p.art]}`);
}
// die Rollenkarten schreiben ae/oe/ue und Fleet-Begriffe (server.ts#ORCHESTRATOR_ROLE_CARD und Geschwister). Die Lesefassung ersetzt nur
// Wendungen und Wörter dieser Listen, ganz und genau; die Karte selbst und `karteMit` bleiben wörtlich, Spalte 4 zeigt sie so. Was die
// Listen nicht kennen, bleibt, wie es ist.
const LESE_SATZ: readonly [string, string][] = [
  ["Scope-Wachstum", "Wachstum des Umfangs"], ["Scope", "Umfang"], ["per Default-Regel + Ledger", "nach Standardregel, festgehalten im Protokoll"],
  ["das DONE", "das Fertig-Kriterium der Karte"], ["innerhalb von FLAECHE und VERBOTEN", "innerhalb ihrer Fläche und Verbote"],
  ["alles unter BLOCKER", "alles unter „Nie“"], ["ohne gruenen Gate", "ohne grüne Land-Prüfung"],
];
const LESE_WORT: Record<string, string> = {
  Faelle: "Fälle", Begruendung: "Begründung", Vorbedingungspruefung: "Vorbedingungsprüfung", Veroeffentlichung: "Veröffentlichung", aussen: "außen",
  erklaerter: "erklärter", gruenen: "grünen", schliesst: "schließt", Aussenwirkung: "Außenwirkung", Gespraech: "Gespräch", Schaerfe: "Schärfe",
  Rueckgabe: "Rückgabe", ueber: "über", ausserhalb: "außerhalb", Rueckfragen: "Rückfragen", FLAECHE: "FLÄCHE", fuer: "für",
};
export const leseFassung = (t: string): string =>
  LESE_SATZ.reduce((x, [von, zu]) => x.split(von).join(zu), t).replace(/[A-Za-zÄÖÜäöüß]+/g, (w) => LESE_WORT[w] ?? w);

// Agent, Modell und Effort wählt man aus dem Katalog des Servers (src/k15-agent.ts), nicht aus einer Liste hier
export const EFFORT_WORT: Record<string, string> = { low: "niedrig", medium: "mittel", high: "hoch", xhigh: "xhigh", max: "max" };

// ÜBERGABE: die Basis je Schiene, abgeschrieben aus server/succession.ts#FLEET_BASE_PCT (keine Leseroute liefert die
// Tabelle); die Env der Instanz verschiebt sie (GET /api/machine-settings), die Orchestratorin behält ihre Zeile.
// Obergrenze = Basis + CAP_GAP_PCT, solange der Cache warm ist.
const FLEET_BASE_PCT: Record<Schiene, number> = { orchestrator: 45, "program-main": 40, bau: 40, lane: 37, session: 40 };
export const CAP_GAP_PCT = 5;
export interface Env { migratePct: number; laneMigratePct: number }
// `herkunft` in Menschenworten, `quelle` (Variable, Datei, Funktion) nur für den Title
export function schwelleVon(schiene: Schiene, env: Env | null): { pct: number | null; herkunft: string; quelle: string } {
  if (!env) return { pct: null, herkunft: "nicht lesbar: Fleet nennt die Einstellungen dieser Instanz nicht", quelle: "GET /api/machine-settings" };
  if (env.migratePct <= 0) return { pct: 0, herkunft: "auf dieser Instanz läuft keine Succession; ein eigener Wert wirkt erst, wenn sie dort an ist", quelle: "FLEET_MIGRATE_PCT = 0" };
  if (schiene === "orchestrator") return { pct: FLEET_BASE_PCT.orchestrator, herkunft: "Fleets fester Wert für die Orchestratorin", quelle: "server/succession.ts#FLEET_BASE_PCT; die Env gilt für sie nicht" };
  if (schiene === "lane") return { pct: env.laneMigratePct, herkunft: "Fleets Wert für Lanes auf dieser Instanz", quelle: "FLEET_LANE_MIGRATE_PCT, sonst server/succession.ts#FLEET_BASE_PCT" };
  return { pct: env.migratePct, herkunft: "Fleets Wert für diese Instanz", quelle: "FLEET_MIGRATE_PCT in der .env des Servers" };
}
export const pct = (n: number | null): string => n === null ? "unbekannt" : n <= 0 ? "aus" : `${n} % (bis ${n + CAP_GAP_PCT} %)`;

// ASPEKT-KATALOG (Bauleitung 15.10., Vergleich in docs/neuaufbau/befunde/k15-agentenkonfiguration-vergleich.md): alles
// Einstellbare an einem Profil ist ein Eintrag. `wirkung` sagt, wo er greift; `bindung`, ob Fleet ihn erzwingt oder die
// Session nur darum gebeten wird; `heute`, wie Fleet es heute macht und wo es steht.
export type AspektArt = "zahl" | "prozent" | "wahl" | "liste" | "text";
export type Wirkung = { wo: "brief"; abschnitt: string; satz: string } | { wo: "start"; flag: string } | { wo: "fleet"; regel: string }
  | { wo: "plan"; was: string };
export interface Aspekt {
  id: string; name: string; bedeutung: string; art: AspektArt; standard: Wert; einheit?: string; optionen?: string[];
  wirkung: Wirkung; bindung: "erzwungen" | "erbeten"; gruppe: "bausteine" | "einstellungen" | "rechte" | "arbeitsweise" | "posteingang"; heute?: string;
}
export const ASPEKTE: Aspekt[] = [
  { id: "umfang", name: "Umfang", bedeutung: "wie viel aus einer Gruppe die Session bekommt, bevor einzelne Bausteine abweichen; ein Wert je Gruppe mit Regler (umfang.<gruppe>)",
    art: "wahl", standard: "standard",
    optionen: ["pflicht", "standard", "alles"], wirkung: { wo: "plan", was: "nur Pflicht = jeder freie Baustein der Gruppe aus; Standard = was der Plan der Rolle anschaltet; alles = jeder Baustein der Gruppe an, den der Server annimmt" },
    bindung: "erzwungen", gruppe: "bausteine", heute: "Der Plan prüft jeden Schalter (session-blocks.ts#resolveSessionPlan); eine Pflicht lässt sich nicht abschalten." },
  { id: "modell", name: "Modell", bedeutung: "welches Modell die Session fährt", art: "wahl", standard: "Standard der Rolle",
    wirkung: { wo: "start", flag: "--model" }, bindung: "erzwungen", gruppe: "einstellungen", heute: "model-register.ts#MODEL_DEFAULTS je Rolle" },
  { id: "effort", name: "Effort", bedeutung: "wie gründlich sie denkt", art: "wahl", standard: "Standard der Rolle",
    wirkung: { wo: "start", flag: "--effort" }, bindung: "erzwungen", gruppe: "einstellungen", heute: "model-register.ts#MODEL_DEFAULTS je Rolle" },
  { id: "schwelle", name: "Succession ab", bedeutung: "ab welchem Kontext-Füllstand ihre Succession beginnt", art: "prozent", standard: "Fleet-Wert der Schiene",
    wirkung: { wo: "fleet", regel: "server/succession.ts#thresholdOf: Basis; Obergrenze Basis + 5, solange der Cache warm ist" }, bindung: "erzwungen", gruppe: "einstellungen",
    heute: "je Session änderbar über PATCH /api/slots/:id/handover" },
  { id: "permission-mode", name: "Permission-Mode", bedeutung: "ob und wie sie vor Aktionen fragt", art: "wahl", standard: "auto",
    optionen: ["default", "acceptEdits", "plan", "auto", "dontAsk", "bypassPermissions"], wirkung: { wo: "start", flag: "--permission-mode" }, bindung: "erzwungen", gruppe: "rechte",
    heute: "Fleet setzt auf der Startzeile jeder Claude-Session --permission-mode auto, gleich für Lane, MAIN, Orchestratorin und Sessions ohne Rolle (server/session-start.ts#PERMISSION_MODE, server.ts#agentCmd), und nimmt --dangerously-skip-permissions aus FLEET_CMD ab (withoutSkipPermissions); seit main 6fcb4387" },
  { id: "zustellung", name: "Zustellung", bedeutung: "wie Nachrichten sie erreichen", art: "wahl", standard: "in die Pane", optionen: ["in die Pane", "nur ins Postfach"],
    wirkung: { wo: "fleet", regel: "Postfach: in die Pane tippen oder nur ablegen" }, bindung: "erzwungen", gruppe: "posteingang", heute: "Fleet tippt jede Zustellung in die Pane; ein Schalter fehlt (Schritt 9)" },
  { id: "selbst-bis", name: "selbst bauen bis", bedeutung: "bis zu welcher Größe sie selbst baut, statt eine Lane zu öffnen", art: "zahl", standard: 50, einheit: "Zeilen Diff",
    wirkung: { wo: "brief", abschnitt: "DU ENTSCHEIDEST", satz: "Kleines baust du selbst: bis {{selbst-bis}} Zeilen Diff, darüber öffnest du eine Lane." }, bindung: "erbeten", gruppe: "arbeitsweise" },
  { id: "lanes-max", name: "Lanes gleichzeitig", bedeutung: "wie viele Kinder gleichzeitig offen sein dürfen", art: "zahl", standard: 3,
    wirkung: { wo: "fleet", regel: "die Tür „Kind öffnen“ lehnt das N+1-te ab" }, bindung: "erzwungen", gruppe: "arbeitsweise" },
  { id: "subagenten", name: "Subagenten", bedeutung: "ob sie Subagenten startet", art: "wahl", standard: "ja", optionen: ["ja", "nur lesende", "nein"],
    wirkung: { wo: "brief", abschnitt: "DU ENTSCHEIDEST", satz: "Subagenten: {{subagenten}}." }, bindung: "erbeten", gruppe: "arbeitsweise" },
];
// ein Aspekt kann je Gruppe einen eigenen Wert tragen: `umfang.wissen` ist der Aspekt `umfang` für die Gruppe Wissen
export const aspekt = (id: string): Aspekt | undefined => ASPEKTE.find((a) => a.id === id.split(".")[0]);
export const aspektName = (id: string): string => {
  const [a, g] = id.split(".");
  const gw = GRUPPEN.find((x) => x.id === g)?.wort;
  return `${aspekt(a)?.name ?? a}${gw ? ` ${gw}` : ""}`;
};
export const aspektWert = (id: string, p: Profil, q: Position | null): Wert | undefined => q?.werteAbw?.[id] ?? p.werte[id] ?? aspekt(id)?.standard;

// RANGFOLGE eines wirksamen Werts (K16, befunde/18-einstellungen.md auf bau/einstellungen): die erste Stufe, die einen Wert
// hat, gilt, und der Wert sagt, woher er kommt. K15 kennt beim Start nur Position, Profil und Standard; laufende Session,
// Usage- und Routing-Regel setzt K16 im Lauf.
export type Rang = "laufend" | "position" | "usage" | "routing" | "profil" | "standard";
export const RANGFOLGE: readonly Rang[] = ["laufend", "position", "usage", "routing", "profil", "standard"];
export interface Wirksam<T> { wert: T; rang: Rang; herkunft: string }
export function wirksam<T>(stufen: Partial<Record<Rang, { wert: T; herkunft: string }>>): Wirksam<T> | null {
  for (const rang of RANGFOLGE) {
    const x = stufen[rang];
    if (x) return { ...x, rang };
  }
  return null;
}

// DIE GRUPPEN (Owner 12:3x: „[Zitat entfernt]“, „[Zitat entfernt]“): wofür ein
// Baustein da ist, aus der ersten `funktion` seines Registereintrags (session-blocks.ts#SessionFunction), in Owner-Worten (Lesart
// der Bauleitung). Agent · Modell · Effort (spawn-profile) steht in keiner Gruppe; es sind die Einstellungen, so wie das
// Startfenster es zeigt (src/founding.ts#getsWords).
// WAS EINE GRUPPE IM LAUF TUT (Runde 4, Owner Z63: „[Zitat entfernt]“
// ): `lauf` ein Satz je Rolle, abgeleitet aus der Tür-Tabelle server.ts#planDoorRow (wer was bei
// welchem Start wirklich bekommt) und dem Register session-blocks.ts, am 17.10. gelesen; `fund` die Fundstellen (nur im Title); `wo`, wo
// man sie einstellt. `satz` sagt, wofür sie da ist.
export type GruppeId = "regeln" | "auftrag" | "rueckweg" | "beweis" | "wissen" | "gedaechtnis";
export interface Gruppe { id: GruppeId; funktion: string; wort: string; satz: string; lauf: Readonly<Record<PlanRolle, string>>; fund: string; wo: string }
export const GRUPPEN: readonly Gruppe[] = [
  { id: "regeln", funktion: "vertrag", wort: "Regeln", satz: "was für sie gilt und was sie nicht darf",
    lauf: { lane: "Der Agent lädt die Regeln des Ordners selbst; Fleet schreibt Rollenkarte und deine Korrekturen in ihre Session-Datei.",
      main: "Der Agent lädt die Regeln des Ordners selbst; Fleet gibt Rollenkarte und deine Korrekturen in der ersten Nachricht dazu.",
      orchestratorin: "Der Agent lädt die Regeln des Ordners selbst; Fleet schickt ihre Rollenkarte und deine Korrekturen als erste Nachricht.",
      "nur-ordner": "Der Agent lädt die Regeln des Ordners selbst; Fleet gibt nichts dazu." },
    fund: "server.ts#planDoorRow (native-agents, portable-contract, role-card, owner-heft, orchestrator-card, private-rulebook)",
    wo: "die Regeln des Ordners in seinen Dateien, das private Regelbuch hier; Vertrag und Korrekturen sind gesperrt (Owner-Entscheid), die Rollenkarte unter „Autonomie“" },
  { id: "auftrag", funktion: "auftrag", wort: "Auftrag", satz: "was sie tun soll",
    lauf: { lane: "Die Karte kommt nur, wenn der Dispatcher die Lane für eine Karte gründet; ein Start aus diesem Fenster hat keine.",
      main: "Die MAIN bekommt Auftrag und Reihenfolge ihres Programs in der ersten Nachricht.",
      orchestratorin: "Ihren Auftrag trägt ihre Rollenkarte (Regeln).",
      "nur-ordner": "Ohne Rolle gibt Fleet ihr keinen Auftrag mit; du schreibst ihn ihr selbst." },
    fund: "server.ts#planDoorRow (task-brief: PLAN_NUR_DISPATCH; main-rail → Prompt) · server.ts#buildProgramMainBrief",
    wo: "in der Karte und im Program, nicht in diesem Fenster" },
  { id: "rueckweg", funktion: "rueckweg", wort: "Rückweg", satz: "wie sie Fleet erreicht, und bei einer Lane, wie sie meldet und endet",
    lauf: { lane: "Ihr Ausweis kommt mit dem Start; die Session-Datei sagt ihr, an wen sie meldet, wie sie berichtet und wie sie aufhört.",
      main: "Ihr Ausweis kommt mit dem Start und öffnet ihr ihre Türen bei Fleet; an wen sie meldet, sagt ihre Rollenkarte.",
      orchestratorin: "Ihr Ausweis kommt mit dem Start und öffnet ihr ihre Türen bei Fleet; an wen sie meldet, sagt ihre Rollenkarte.",
      "nur-ordner": "Ihr Ausweis kommt mit dem Start; einen Rückweg darüber hinaus gibt Fleet ihr nicht mit." },
    fund: "server.ts#planDoorRow (self-credential → Startzeile, lane-footer → Session-Datei) · server.ts#ensureSlot (selfExport, FLEET_SELF_TOKEN)",
    wo: "nicht schaltbar, beides ist Pflicht; die Wege im Lauf stehen unter „Verbindungen im Lauf“" },
  { id: "beweis", funktion: "beweis", wort: "Beweis", satz: "woher eine Nachricht kommt, und bei einer Lane die Bitte, ihr Ergebnis zu committen",
    lauf: { lane: "Vor jede Nachricht in ihre Pane setzt Fleet einen Kopf, woher sie kommt (nur Claude); ihr Abschluss verlangt für ein Ergebnis Commit und sauberen Stand.",
      main: "Vor jede Nachricht in ihre Pane setzt Fleet einen Kopf, woher sie kommt; nur Claude trägt ihn.",
      orchestratorin: "Vor jede Nachricht in ihre Pane setzt Fleet einen Kopf, woher sie kommt; nur Claude trägt ihn.",
      "nur-ordner": "Vor jede Nachricht in ihre Pane setzt Fleet einen Kopf, woher sie kommt; nur Claude trägt ihn." },
    fund: "server.ts#planDoorRow (delivery-header → Zustellung, nur Claude; commit-expectation → Session-Datei mit dem lane-footer)",
    wo: "den Zustell-Kopf hier, wo der Plan ihn schalten lässt; die Commit-Erwartung kommt mit dem Abschluss der Lane" },
  { id: "wissen", funktion: "orientierung", wort: "Wissen", satz: "was sie zum Lesen und Nachschlagen bekommt",
    lauf: { lane: "Lesehinweise und gewählte Packs stehen in ihrer Session-Datei; Notizen und Code-Stellen zur Karte kommen nur, wenn der Dispatcher sie gründet.",
      main: "Lesehinweise und gewählte Packs kommen in der ersten Nachricht, wenn ein Pack an ist.",
      orchestratorin: "Lesehinweise und gewählte Packs kommen mit ihrer Rollenkarte in der ersten Nachricht.",
      "nur-ordner": "Lesehinweise und gewählte Packs kommen in der ersten Nachricht, wenn ein Pack an ist." },
    fund: "server.ts#planDoorRow (context-anchors, pack:*; lane-notes, source-pointers, source-code: PLAN_NUR_DISPATCH)",
    wo: "der Regler „Wie viel Wissen“ und die Pack-Schalter hier; ein fehlendes Thema als Kontextpack" },
  { id: "gedaechtnis", funktion: "gedaechtnis-zeiger", wort: "Gedächtnis", satz: "was sie von früherer Arbeit wiederfindet",
    lauf: { lane: "Ein Hinweis in ihrer Session-Datei führt zu ihrem Arbeitsstand bei Fleet; Claudes eigene Notizen (Auto-Memory) sind bei einer Lane aus.",
      main: "Ein Hinweis in der ersten Nachricht führt zu ihrem Arbeitsstand bei Fleet; Claude Code lädt dazu seine eigenen Notizen (Auto-Memory).",
      orchestratorin: "Claude Code lädt seine eigenen Notizen (Auto-Memory); einen Hinweis auf einen Arbeitsstand bei Fleet bekommt sie nicht.",
      "nur-ordner": "Claude Code lädt seine eigenen Notizen (Auto-Memory); einen Hinweis auf einen Arbeitsstand bei Fleet bekommt sie nicht." },
    fund: "server.ts#memoryPointer (GET /api/self/memory) · server.ts#planDoorRow (memory-pointer; auto-memory: nur Claude, nicht in einer Lane)",
    wo: "den Hinweis hier; das Auto-Memory pflegt Claude Code in deinem Konfig-Ordner, Fleet schaltet es nur für Lanes ab" },
];
export const EINSTELLUNGEN_ID = "spawn-profile";
// Zwei erste Funktionen des Registers lesen sich falsch (Prüfung 16.10., an die Bauleitung gemeldet): Die Rollenkarte der Orchestratorin
// beginnt mit `auftrag`, die von Lane und MAIN mit `vertrag`, so stünden die Karten in zwei Gruppen. `auto-memory` trägt `orientierung`,
// ist aber ihr Gedächtnis. Bis das Register sie ändert, ordnet K15 sie so ein; das Register selbst bleibt unberührt.
const GRUPPE_STATT: Record<string, GruppeId> = { "orchestrator-card": "regeln", "auto-memory": "gedaechtnis" };
export const gruppeVon = (b: Baustein): GruppeId | null => GRUPPE_STATT[b.id] ?? GRUPPEN.find((g) => g.funktion === b.funktion[0])?.id ?? null;
// WAS EINE PFLICHT TRÄGT: ein freier Baustein, in dem (über `enthaltenIn`) ein angeschalteter Pflicht-Baustein steckt. Bei der Lane
// steckt der gesperrte Vertrag im Pack Portable Core und das in den Lesehinweisen; ist eines davon aus, kommt der Vertrag nicht an
// (server.ts#planDoorRow: „das Pack portable-core ist aus …“). Je Träger die Pflicht, die er trägt.
export function traegerVon(bs: readonly Baustein[]): Map<string, Baustein> {
  const out = new Map<string, Baustein>();
  for (const b of bs) {
    if (b.zustand !== "an" || b.grenze.art !== "noetig") continue;
    for (let id = b.enthaltenIn, n = 0; id && n < 8; id = bs.find((x) => x.id === id)?.enthaltenIn, n++) if (!out.has(id)) out.set(id, b);
  }
  return out;
}

// DER REGLER JE GRUPPE (Owner 11:1x „[Zitat entfernt]“; 12:3x „[Zitat entfernt]“, aber „[Zitat entfernt]“
// ). Entscheidung K15: Ein Regler über alle Bausteine mischte die Funktionen. „[Zitat entfernt]“
//  nahm zugleich das Regelbuch (Regeln), die Lesehinweise (Wissen) und den Zustell-Kopf (Beweis) weg; „mehr“ hatte keine
// gemeinsame Bedeutung. Innerhalb einer Gruppe heißt mehr: mehr derselben Art. Einen Regler hat deshalb nur eine Gruppe mit
// mindestens zwei freien Bausteinen; mit einem wäre er nur ein Schalter. In den Plänen von claude-fleet (lane, main,
// orchestratorin, 15.10.) trifft das nur auf „Wissen“ zu. Unten liegen die Pflicht-Bausteine, die nie ausgehen; darüber die
// freien, erst die des Standards, dann die, die sich dazuschalten lassen.
export type Stufe = "pflicht" | "standard" | "alles";
export const STUFEN: readonly { id: Stufe; wort: string; satz: string }[] = [
  { id: "pflicht", wort: "Nur Pflicht", satz: "nur was die Rolle braucht; jeder freie Baustein der Gruppe ist aus" },
  { id: "standard", wort: "Standard", satz: "was der Plan der Rolle von sich aus anschaltet" },
  { id: "alles", wort: "Alles", satz: "jeder Baustein der Gruppe, den der Server für diese Rolle annimmt" },
];
export const stufeWort = (x: Stufe | null): string => STUFEN.find((y) => y.id === x)?.wort ?? "eigene Auswahl";
export const umfangId = (g: GruppeId): string => `umfang.${g}`;
export const umfangVon = (p: Profil, q: Position | null, g: GruppeId): Stufe => {
  const w = aspektWert(umfangId(g), p, q);
  return w === "pflicht" || w === "alles" ? w : "standard";
};

export const alle = (ps: Position[]): Position[] => ps.flatMap((p) => [p, ...alle(p.kids ?? [])]);
export const eltern = (k: Konst, id: string): Position | null => alle(k.wurzeln).find((p) => p.kids?.some((c) => c.id === id)) ?? null;
export function ahnen(k: Konst, id: string): Set<string> {
  const out = new Set<string>();
  for (let p = eltern(k, id); p; p = eltern(k, p.id)) out.add(p.id);
  return out;
}
export const setzeEin = (text: string, p: Profil, q: Position | null): string =>
  text.replace(/\{\{([a-z0-9-]+)\}\}/g, (m, id: string) => { const w = aspektWert(id, p, q); return w === undefined ? m : Array.isArray(w) ? w.join(", ") : String(w); });
export const abwZahl = (q: Position): number => Object.keys(q.abw ?? {}).length + Object.keys(q.werteAbw ?? {}).length + Object.keys(q.schalter ?? {}).length
  + (q.ohne?.length ? 1 : 0) + (q.datei ? 1 : 0);
export const fmt = (n: number): string => `≈ ${n.toLocaleString("de-DE")} Tok`;
// Bytes als Tokens zum gemessenen Verhältnis (session-blocks.ts#FLEET_BYTES_JE_TOKEN), auf zehn gerundet; was darunter liegt,
// heißt „< 10 Tok“ statt einer erfundenen Zehn; null Bytes zeigen nichts
export const tokVon = (bytes: number): string => {
  const t = bytes / 2.1;
  return bytes <= 0 ? "" : t < 10 ? "< 10 Tok" : fmt(Math.round(t / 10) * 10);
};
export const istName = (q: Position, p: Profil): boolean => q.name === p.name || q.name.startsWith(`${p.name} `);
export const undListe = (xs: string[]): string => xs.length > 1 ? `${xs.slice(0, -1).join(", ")} und ${xs[xs.length - 1]}` : xs.join("");

// die Bausteine eines Reglers aus dem vollen Plan der Rolle, nur die der Gruppe: `pflicht` an und nötig; `std` frei und an; `dazu`
// frei, aus und vom Server annehmbar (keine unerfüllte Bedingung, kein Pack ohne Quelle: beides lehnt der Plan mit 400 ab, am
// 15.10. geprüft)
export interface Regler { pflicht: Baustein[]; std: Baustein[]; dazu: Baustein[] }
// Was eine Pflicht trägt (traegerVon), zählt hier wie eine Pflicht: „Nur Pflicht“ nähme sonst den Vertrag mit.
export function reglerVon(voll: Answer, g: GruppeId): Regler {
  const ohneQuelle = new Set(voll.omitted.map((o) => `pack:${o.id}`));
  const traeger = traegerVon(voll.plan.bausteine);
  const frei = (b: Baustein) => b.grenze.art === "frei" && b.schaltbar.ja && b.harness.gueltig && !traeger.has(b.id);
  const bs = voll.plan.bausteine.filter((b) => b.id !== EINSTELLUNGEN_ID && gruppeVon(b) === g);
  return {
    pflicht: bs.filter((b) => b.zustand === "an" && !frei(b)),
    std: bs.filter((b) => b.zustand === "an" && frei(b)),
    dazu: bs.filter((b) => b.zustand === "aus" && frei(b) && b.bedingung?.erfuellt !== false && !ohneQuelle.has(b.id)),
  };
}
export const hatRegler = (r: Regler): boolean => r.std.length + r.dazu.length >= 2;
export function stufenSchalter(stufe: Stufe, r: Regler): Schalter {
  if (stufe === "pflicht") return Object.fromEntries(r.std.map((b) => [b.id, "aus"]));
  if (stufe === "alles") return Object.fromEntries(r.dazu.map((b) => [b.id, "an"]));
  return {};
}
// welche Stufe die Bausteine gerade bilden; null = eine eigene Auswahl zwischen den Stufen
export function stufeAus(an: ReadonlySet<string>, r: Regler): Stufe | null {
  const stdAn = r.std.filter((b) => an.has(b.id)).length, dazuAn = r.dazu.filter((b) => an.has(b.id)).length;
  if (stdAn === 0 && dazuAn === 0) return "pflicht";
  if (stdAn === r.std.length && dazuAn === 0) return "standard";
  if (stdAn === r.std.length && dazuAn === r.dazu.length) return "alles";
  return null;
}
// die Schalter, mit denen der Plan einer Position gelesen wird: Umfang, dann Profil, dann Position
export const schalterVon = (umfang: Schalter, p: Profil, q: Position | null): Schalter => ({ ...umfang, ...p.schalter, ...q?.schalter });

// WOHER ES KOMMT (Owner 11:1x: „[Zitat entfernt]“): ein Kennzeichen statt eines Satzes
export const DU = "du";
export type Herkunft = { art: "fleet" } | { art: "eigen" } | { art: "autor"; name: string };
export const herkunftVon = (k: Konst): Herkunft => !k.eigen ? { art: "fleet" } : k.autor && k.autor !== DU ? { art: "autor", name: k.autor } : { art: "eigen" };
// schaltet einen Baustein für die Position (oder das Profil); ein Wert gleich dem darunter fällt als Abweichung weg
export function schalte(unten: Schalter, eigen: Schalter | undefined, id: string, an: boolean, standard: "an" | "aus"): Schalter {
  const neu: Schalter = { ...eigen };
  const darunter = unten[id] ?? standard;
  if ((an ? "an" : "aus") === darunter) delete neu[id]; else neu[id] = an ? "an" : "aus";
  return neu;
}

// WO ES LANDET (Owner 12:3x: man soll verstehen, „[Zitat entfernt]“
// ): die Orte, an
// denen ein Start ankommt. Ein Baustein landet an dem Weg, den die Tür der Rolle meldet (lieferung.geliefert[].weg); was in einem
// anderen steckt (enthaltenIn), hängt unter ihm. Was Claude Code selbst mitbringt, kommt aus claudeCode.zeilen; deren Weg
// „native Datei“ ist eine Datei, jeder andere ein Flag am Systemprompt oder an den Werkzeugen.
export type OrtId = "system" | "datei" | "session" | "prompt" | "start" | "lauf";
export interface OrtArt { id: OrtId; weg: string | null; wort: string; satz: string }
export const ORTE: readonly OrtArt[] = [
  { id: "system", weg: null, wort: "Systemprompt und Werkzeuge", satz: "Claude Codes Systemprompt, Werkzeuge, Skills, Agenten und MCP-Server; was Fleet anhängt oder abschaltet, steht je Teil dabei" },
  { id: "datei", weg: "native Datei", wort: "Dateien, die Claude Code lädt", satz: "liest Claude Code beim Start selbst, aus dem Ordner und aus deinem Konfig-Ordner" },
  { id: "session", weg: "Session-Datei", wort: "Session-Datei", satz: "schreibt Fleet nur einer Lane, als AGENTS.override.md in ihren Worktree; Claude Code lädt sie über CLAUDE.local.md wie eine Agent-MD" },
  { id: "prompt", weg: "Prompt", wort: "Erste Nachricht", satz: "tippt Fleet nach dem Start in die Pane" },
  { id: "start", weg: "plan", wort: "Startzeile und Umgebung", satz: "Flags und Variablen des Starts; Fleets Teil davon steht nicht im Kontext" },
  { id: "lauf", weg: "Zustellung", wort: "Im Lauf", satz: "steht vor jeder Nachricht, die Fleet in die Pane tippt" },
];
export type CcZeile = NonNullable<Answer["claudeCode"]>["zeilen"][number];
export interface Knoten { b: Baustein; kinder: Knoten[] }
export interface Ort extends OrtArt { knoten: Knoten[]; cc: CcZeile[] }
export interface Landung { orte: Ort[]; nichtDurchTuer: { b: Baustein; grund: string }[] }
export function landungVon(a: Answer): Landung {
  const weg = new Map((a.lieferung?.geliefert ?? []).map((x) => [x.id, x.weg]));
  const knoten = new Map<string, Knoten>();
  for (const b of a.plan.bausteine) if (b.zustand === "an" && weg.has(b.id)) knoten.set(b.id, { b, kinder: [] });
  const wurzeln: Knoten[] = [];
  for (const k of knoten.values()) {
    const vater = k.b.enthaltenIn ? knoten.get(k.b.enthaltenIn) : undefined;
    if (vater) vater.kinder.push(k); else wurzeln.push(k);
  }
  const cc = a.claudeCode?.zeilen ?? [];
  const orte = ORTE.map((o) => ({ ...o, knoten: wurzeln.filter((k) => o.weg !== null && weg.get(k.b.id) === o.weg),
    cc: cc.filter((z) => o.id === "system" ? z.weg !== "native Datei" : o.weg === "native Datei" && z.weg === "native Datei") }));
  const an = new Set(a.plan.bausteine.filter((b) => b.zustand === "an").map((b) => b.id));
  return { orte: orte.filter((o) => o.knoten.length || o.cc.length),
    nichtDurchTuer: (a.lieferung?.ausgelassen ?? []).filter((x) => an.has(x.id)).flatMap((x) => {
      const b = a.plan.bausteine.find((y) => y.id === x.id);
      return b ? [{ b, grund: x.grund }] : [];
    }) };
}
// ein Knoten mit allem, was in ihm steckt, flach
export const unter = (k: Knoten): Knoten[] => [k, ...k.kinder.flatMap(unter)];

// VERBINDUNGEN IM LAUF: was eine Session nach dem Start mit Fleet verbindet und das Register (session-blocks.ts) nicht
// abdeckt. Jede Zeile am Code von bau/neue-session (Basis e8be8a5c) nachgelesen, 15.10.; `fehlt` ist ein Server-Schritt.
export interface Verbindung { name: string; kurz: string; heute: string; quelle: string; fehlt?: string }
// Fleets Begriff bleibt (Owner 16.10. 22:5x: „[Zitat entfernt]“, wie K16);
// „[Zitat entfernt]“ heißt nur die geschriebene Notiz, der Bericht mit Status handoff
const NACHFOLGE_FLEET: Verbindung = { name: "Succession", kurz: "Fleet startet sie an der Schwelle",
  heute: "An der Schwelle startet Fleet die Succession selbst über die Owner-Tür, auch ohne Zutun der Session; nur für Claude. Je Session abschaltbar mit Succession „aus“.",
  quelle: "server.ts#succeedAtThreshold → server.ts#handleOwnerSucceed · server/succession.ts#thresholdOf (0 = aus)" };
const HINWEISE: Verbindung = { name: "Hinweise in die Pane", kurz: "immer",
  heute: "Fleet tippt Ereignisse und den Postfach-Hinweis in jede Pane. Abstellen lässt sich das nur für die ganze Instanz, nicht je Session.",
  quelle: "server.ts#canDeliver (killSwitch → autosOn, global)", fehlt: "Je Session oder Rolle abstellen ist Schritt 9." };
const AUSWEIS: Verbindung = { name: "Ausweis", kurz: "in jeder Pane",
  heute: "Jede Pane bekommt einen eigenen Ausweis in ihrer Shell; einen Start ohne gibt es nicht. Isoliert ist eine Session damit nicht: Das Owner-Token liegt in einer Datei, die jede Pane desselben Benutzers lesen kann.",
  quelle: "FLEET_SELF_TOKEN · server.ts#ensureSlot (selfExport) · ctl.sh#owner_token liest fleet.json",
  fehlt: "Eine Session ohne Zugang zu Fleet braucht einen eigenen Unix-User oder eine Sandbox: eine Rechte-Frage (Stopp)." };
const POSTFACH_OHNE_ROLLE: Verbindung = { name: "Postfach", kurz: "nur an die Orchestratorin",
  heute: "Eine Session ohne Rolle schreibt nur an die Orchestratorin. Ein Gegenüber hat sie nur, wenn sie selbst einen Branch geöffnet hat; eine MAIN schreibt ihr nicht.",
  quelle: "server.ts#messageSenderFor · server.ts#sendMessageFor (SESSION_COUNTERPART)" };
const VERBINDUNGEN: Record<string, Verbindung[]> = {
  lane: [
    { name: "Postfach", kurz: "sendet nicht", heute: "Eine Lane schreibt niemandem ins Postfach; ihre MAIN spricht für das Program.",
      quelle: "server.ts#messageSenderFor („a lane does not address principals“)" },
    { name: "Rückweg", kurz: "Rückfrage und Bericht an die MAIN", heute: "Rückfragen gehen über Fleet an ihre MAIN, das Ergebnis als Bericht.",
      quelle: "POST /api/self/clarifications · POST /api/self/fleet-report · server.ts#openClarification · server.ts#openFleetReport" },
    { name: "Succession", kurz: "startet sie selbst", heute: "Eine Lane startet ihre Succession selbst: erst ein Bericht „Übergabe“, dann die Succession. Fleets eigener Akt an der Schwelle lehnt Lanes ab.",
      quelle: "Bericht mit Status handoff, dann POST /api/self/succeed · server.ts#ownerSucceedRailRefusal („a lane hands over by its own handoff fleet-report“)" },
    HINWEISE, AUSWEIS,
  ],
  main: [
    { name: "Postfach", kurz: "an Orchestratorin, Programs, eigene Lanes", heute: "Die MAIN schreibt als ihr Program: an die Orchestratorin, an ein anderes Program (dessen MAIN liest es) und an Lanes ihres eigenen Programs. An eine Session ohne Rolle schreibt sie nicht.",
      quelle: "server.ts#messageSenderFor (Absender program) · server.ts#sendMessageFor · server.ts#resolveMessageAddress" },
    NACHFOLGE_FLEET, HINWEISE, AUSWEIS,
  ],
  orchestratorin: [
    { name: "Postfach", kurz: "an Programs; Sessions nur als Antwort", heute: "Die Orchestratorin schreibt an Programs. Einer Session ohne Rolle antwortet sie nur auf deren Nachricht; an Lanes schreibt sie nicht.",
      quelle: "server.ts#sendMessageFor (replyTo, „only a bound Program-MAIN may address its own lane“)" },
    NACHFOLGE_FLEET, HINWEISE, AUSWEIS,
  ],
  bau: [
    { name: "Postfach", kurz: "an Orchestratorin und Öffner", heute: "Eine Branch-Session schreibt an die Orchestratorin und an die Session, die ihren Branch geöffnet hat; alle anderen lehnt Fleet ab.",
      quelle: "server.ts#branchPeers · server.ts#sendMessageFor (SESSION_COUNTERPART, 409)" },
    { name: "Ziel", kurz: "einmal als erste Nachricht", heute: "Das Ziel des Branches kommt einmal als erste Zustellung nach dem Start. Geht es nicht durch, wiederholt Fleet es nicht.",
      quelle: "server.ts#deliverBranchGoal („Not delivered is an answer, never a retry“)" },
    NACHFOLGE_FLEET, HINWEISE, AUSWEIS,
  ],
  ordner: [POSTFACH_OHNE_ROLLE, NACHFOLGE_FLEET, HINWEISE, AUSWEIS],
  eigen: [POSTFACH_OHNE_ROLLE, NACHFOLGE_FLEET, HINWEISE, AUSWEIS],
};
export const verbindungen = (profilId: string): Verbindung[] => VERBINDUNGEN[profilId] ?? [POSTFACH_OHNE_ROLLE, NACHFOLGE_FLEET, HINWEISE, AUSWEIS];

// WAS GEÄNDERT WURDE gegenüber dem Profil in seiner Fassung (Owner 11:0x: „[Zitat entfernt]“
// ), je Zeile „[Zitat entfernt]“
const FELDER = [["agent", "Agent"], ["modell", "Modell"], ["effort", "Effort"], ["schwelle", "Succession ab"]] as const;
const wertText = (w: Wert | null | undefined): string => w === undefined || w === null ? "Standard" : Array.isArray(w) ? w.join(", ") : String(w);
export function abweichungen(p: Profil, q: Position, name: (id: string) => string): string[] {
  return [
    ...FELDER.filter(([f]) => q.abw?.[f] !== undefined).map(([f, n]) => `${n}: ${wertText(p[f])} → ${wertText(q.abw?.[f])}`),
    ...Object.entries(q.werteAbw ?? {}).map(([id, v]) => `${aspektName(id)}: ${wertText(p.werte[id] ?? aspekt(id)?.standard)} → ${wertText(v)}`),
    ...Object.entries(q.schalter ?? {}).map(([id, v]) => `${name(id)}: → ${v}`),
    ...(q.ohne?.length ? [`Session-Datei: ${q.ohne.length} Teile aus`] : []),
    ...(q.datei ? [`eigene Datei: keine → ${q.datei.titel}`] : []),
  ];
}

// EXPORT: dieselbe Form auf jeder Ebene; mit Verweisen (lane@3) oder vollständig (Werte eingebettet)
export type Ebene = "system" | "konst" | "session" | "baustein";
// `zusatz` hängt an, was im vollständigen Export mitreist (eigene Fassungen und Kontextpacks als Entwurf)
type ExportEingang = { ebene: Ebene; voll: boolean; konst: Konst[]; k: Konst; profile: Profil[]; q: Position | null; p: Profil; zusatz?: object };
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
      ...(x.schalter ? { schalter: x.schalter } : {}), ...(x.wann ? { wann: x.wann } : {}) };
  };
  const konst = (k: Konst) => ({ name: k.name, version: k.v, satz: k.satz, autor: k.eigen ? k.autor ?? DU : FLEET, ...(k.quer ? { quer: k.quer } : {}),
    ...(k.protokoll && !protokollLeer(k.protokoll) ? { protokoll: k.protokoll } : {}),
    positionen: alle(k.wurzeln).map((x) => position(k, x)) });
  const p = o.p;
  const obj = o.ebene === "system" ? { fleet: "system", konstellationen: o.konst.map(konst), profile: o.profile.map((x) => o.voll ? voll(x) : ref(x)) }
    : o.ebene === "konst" ? { fleet: "konstellation", ...konst(o.k) }
    : o.ebene === "session" ? { fleet: "session", ...(o.q ? position(o.k, o.q) : { profil: o.voll ? voll(p) : ref(p) }) }
    : { fleet: "baustein", art: "einstellungen", version: p.einV, agent: p.agent, modell: p.modell, effort: p.effort, uebergabeAb: p.schwelle };
  return { format: 1, ...obj, ...o.zusatz };
}

// PROFIL ALS AGENT-MD (Vergleich befunde/k15-agentenkonfiguration-vergleich.md): Frontmatter mit den Feldnamen von Claude
// Codes Subagents, Fleet-eigene Felder unter `fleet:`. Die Werte stehen als JSON-Flow, das ist gültiges YAML. Gestartet
// wird nie per `claude --agent` (der Body ersetzte den System-Prompt), sondern aus dem Profil.
export function profilAlsMd(p: Profil): string {
  const j = (v: unknown) => JSON.stringify(v);
  const kopf = [
    `name: ${j(p.id)}`, `description: ${j(p.satz)}`, ...(p.modell ? [`model: ${j(p.modell)}`] : []), ...(p.effort ? [`effort: ${j(p.effort)}`] : []),
    `permissionMode: ${j(aspektWert("permission-mode", p, null))}`,
    "fleet:", `  format: 1`, `  fassung: ${p.v}`, `  autor: ${j(p.autor)}`, `  rolle: ${j(p.rolle)}`, ...(p.agent ? [`  agent: ${j(p.agent)}`] : []), ...(p.schwelle !== null ? [`  uebergabeAb: ${p.schwelle}`] : []),
    `  schalter: ${j(p.schalter)}`, `  aspekte: ${j(p.werte)}`,
  ];
  return `---\n${kopf.join("\n")}\n---\n`;
}
