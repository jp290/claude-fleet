// WAS EINE SESSION DARF (Owner 19.10. 08:5x: „[Zitat entfernt]“; Urteil 09:5x: vier
// Stufen mit Symbol, die Befehle hinter „[Zitat entfernt]“). Eine Stufe setzt die Schalter je Befehl; jeder Schalter wird beim Start zu einer
// Regel für Claude Code (`permissions` im `--settings` der Startzeile, server.ts#agentCmd): an = erlaubt ohne Rückfrage, aus = gesperrt.
// Ein weicher Zaun: Claude Codes Regeln, keine Prüfstelle im Server. Laut Claude Codes Doku (code.claude.com/docs/en/permissions,
// /permission-modes, nachgelesen 19.10.) gilt deny vor allow in jedem Modus, und im Auto-Mode entscheidet eine passende Regel ohne den
// Klassifizierer; „Bash(x *)“ passt nur auf genau so geschriebene Befehle, ein Umweg wie „git -C . push“ kommt an einer Sperre vorbei.
// Eigenes Modul ohne Imports, damit das Fenster es mitnimmt.
export type RechteStufe = "lesen" | "bauen" | "landen" | "deployen";
export const RECHTE_STUFEN: readonly { readonly id: RechteStufe; readonly wort: string; readonly satz: string }[] = [
  { id: "lesen", wort: "Nur lesen", satz: "Liest und antwortet, ändert keine Datei." },
  { id: "bauen", wort: "Bauen", satz: "Ändert Dateien; seine Arbeit übernimmst du." },
  { id: "landen", wort: "Landen", satz: "Ändert Dateien und übernimmt seine Arbeit selbst." },
  { id: "deployen", wort: "Deployen", satz: "Übernimmt seine Arbeit und spielt Fleet neu auf." },
];
// je Befehl: ab welcher Stufe er an ist, die Regeln, die er beim Start setzt, und sein Stück im Satz („Er darf …“)
export const RECHTE_BEFEHLE: readonly { readonly id: string; readonly wort: string; readonly satz: string; readonly befehl: string; readonly ab: RechteStufe;
  readonly regeln: readonly string[] }[] = [
  { id: "dateien", wort: "Dateien ändern", satz: "Dateien ändern", befehl: "Edit, Write", ab: "bauen", regeln: ["Edit", "MultiEdit", "Write", "NotebookEdit"] },
  { id: "landen", wort: "Seine Arbeit übernehmen", satz: "seine Arbeit selbst übernehmen", befehl: "./ctl.sh land", ab: "landen", regeln: ["Bash(./ctl.sh land *)"] },
  { id: "deploy", wort: "Fleet neu aufspielen", satz: "Fleet neu aufspielen", befehl: "POST /api/deploy", ab: "deployen", regeln: ["Bash(curl *api/deploy*)"] },
  { id: "verwerfen", wort: "Eine Arbeitskopie wegwerfen", satz: "Arbeitskopien wegwerfen", befehl: "POST /api/worktrees/discard", ab: "deployen", regeln: ["Bash(curl *api/worktrees/discard*)"] },
];
export const RECHTE_STANDARD: RechteStufe = "bauen";
export const RECHTE_ZAUN = "Das sind Regeln für Claude Code beim Start, keine Sperre im Server: Wer den Owner-Schlüssel liest, kommt an ihnen vorbei.";

// DIE RECHTE AN FLEETS TÜREN (Richtung Schritt 2, Owner 2026-10-26): eine eigene, harness-unabhängige Ebene.
// Sie steht neben den vier Claude-Schaltern, nicht in ihnen: ein Sitz kann ein Server-Recht haben und den
// passenden Schalter aus, oder umgekehrt. Die Ids sind absichtlich ein eigener Namensraum (`fleet.deploy`
// ist nicht der `deploy`-Schalter). Was jedes Recht erlaubt, steht in server/tuer-rechte.ts#RECHT_WAS.
export type RechtId =
  | "seat.open" | "land.branch" | "land.program" | "fleet.deploy" | "edge.grant"
  | "text.handover" | "text.pack" | "text.concept.version"
  | "text.concept.annotation" | "text.program"
  | "setup.save" | "setup.export" | "setup.import"
  | "role.form"
  | "branch.passt"
  | "overview.fleet";
export const RECHT_IDS: readonly RechtId[] = ["seat.open", "land.branch", "land.program", "fleet.deploy", "edge.grant",
  "text.handover", "text.pack", "text.concept.version", "text.concept.annotation", "text.program",
  // DIE SETUP-RECHTE (Richtung Schritt 4): kein Rollenbundel trägt sie — der Owner vergibt sie je Sitz,
  // denn sie ändern das Setup als solches (server/setup-tueren.ts), nicht nur einen Start daraus.
  "setup.save", "setup.export", "setup.import",
  // DIE ROLLEN-BILDUNG (Richtung Schritt 5): eine gebildete Rolle ist ein Setup-Stück mit einer Adresse —
  // kein Rollenbundel trägt das Recht, denn sonst bildete jede Rolle Rollen (Owner 30.10., „[Zitat entfernt]“).
  "role.form",
  // DAS „PASST“ EINES SITZES (W3b, Owner 31.10.): die Öffnerin gibt es auf die Spitze ihres Kindes, die Land-Tür liest es — kein Rollenbundel trägt das
  // Recht, der Owner vergibt es je Sitz oder bestätigt es an einer Position einer Vorlage.
  "branch.passt",
  // DIE GANZE ÜBERSICHT (W3 Auftrag 11): jeden Sitz in GET /api/self/overview sehen wie die Orchestratorin — ihr Bundel trägt es, der Owner gibt es
  // einem Sitz dazu (sein eigener Agent), am laufenden Sitz über POST /api/slots/<n>/rechte { grant }
  "overview.fleet"];
// Der eine benannte leere Bundel dieses Schnitts: der Owner öffnet damit eine Probe, deren Rolle nichts
// hinzufügt. Er ist kein Produktions-Rollenbundel und nimmt einer Rolle nichts weg.
export type RechteBuendel = "none";
export const istRechtId = (v: unknown): v is RechtId => typeof v === "string" && (RECHT_IDS as readonly string[]).includes(v);

export interface Rechte {
  readonly stufe: RechteStufe;
  readonly an: readonly string[];
  readonly aus: readonly string[];
  // Zusagen des Owners an genau diesen Sitz, additiv zu seinem Rollenbundel (server/tuer-rechte.ts)
  readonly recht?: readonly RechtId[];
  // beim Öffnen gewählt; ersetzt die Rollenbundel, Zusagen kommen weiter dazu
  readonly buendel?: RechteBuendel;
}
export const istStufe = (v: unknown): v is RechteStufe => RECHTE_STUFEN.some((s) => s.id === v);
const rang = (s: RechteStufe): number => RECHTE_STUFEN.findIndex((x) => x.id === s);

// ob ein Befehl an ist: die Stufe, außer ein Schalter sagt es anders
export function befehlAn(r: Rechte, id: string): boolean {
  if (r.an.includes(id)) return true;
  if (r.aus.includes(id)) return false;
  const b = RECHTE_BEFEHLE.find((x) => x.id === id);
  return !!b && rang(r.stufe) >= rang(b.ab);
}
// was eine Stufe für einen Befehl allein sagt, ohne Schalter
export const stufeGibt = (stufe: RechteStufe, id: string): boolean => befehlAn({ stufe, an: [], aus: [] }, id);
// ein Befehl weicht von seiner Stufe ab, wenn ein Schalter ihn anders stellt (Owner 10:1x: „[Zitat entfernt]“ war verwirrend; jetzt ein Satz und nur die Abweichungen)
export const abweichung = (r: Rechte, id: string): boolean => r.an.includes(id) || r.aus.includes(id);
const liste = (xs: readonly string[]): string => xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} und ${xs.at(-1)}`;
// was er darf, als ein Satz
export function rechteAlsSatz(r: Rechte): string {
  const darf = RECHTE_BEFEHLE.filter((b) => befehlAn(r, b.id)).map((b) => b.satz);
  const nicht = RECHTE_BEFEHLE.filter((b) => !befehlAn(r, b.id)).map((b) => b.satz);
  const erst = darf.length ? `Er darf ${liste(darf)}.` : "Er liest nur und ändert nichts.";
  return darf.length && nicht.length ? `${erst} ${liste(nicht).replace(/^./, (c) => c.toUpperCase())} machst du.` : erst;
}
// die Regeln für Claude Code; „Dateien ändern“ an setzt keine (das ist Claude Codes eigener Standard)
export function rechteRegeln(r: Rechte): { allow: string[]; deny: string[] } {
  const allow: string[] = [], deny: string[] = [];
  for (const b of RECHTE_BEFEHLE) {
    if (!befehlAn(r, b.id)) deny.push(...b.regeln);
    else if (b.id !== "dateien") allow.push(...b.regeln);
  }
  return { allow, deny };
}
// was ein Start von außen schickt, geprüft; null = nicht lesbar. Ein reiner Rechte-Body (nur `recht` und/oder
// `buendel`) bekommt die Standardstufe mit leeren Schaltern: die Server-Rechte gelten auf jedem Harness, die
// vier Schalter bleiben Claude Codes. Ein unbekanntes Recht wird nie still fallen gelassen, sondern macht den
// Body unlesbar (die Tür antwortet 400 und nennt das Feld).
export function rechteAus(v: unknown): Rechte | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  const ids = (x: unknown): string[] | null => x === undefined ? [] : Array.isArray(x) && x.every((y) => typeof y === "string" && RECHTE_BEFEHLE.some((b) => b.id === y)) ? x as string[] : null;
  const an = ids(r.an), aus = ids(r.aus);
  const recht: RechtId[] | null | undefined = r.recht === undefined ? undefined
    : Array.isArray(r.recht) && r.recht.every(istRechtId) ? [...new Set(r.recht as RechtId[])] : null;
  if (r.recht !== undefined && recht === null) return null;
  const buendel: RechteBuendel | null | undefined = r.buendel === undefined ? undefined : r.buendel === "none" ? "none" : null;
  if (r.buendel !== undefined && buendel === null) return null;
  // nur Rechte genannt: die Schalter sind nicht Teil dieses Bodys
  const stufe = r.stufe === undefined && (recht !== undefined || buendel !== undefined) ? RECHTE_STANDARD : r.stufe;
  if (!istStufe(stufe) || !an || !aus || an.some((x) => aus.includes(x))) return null;
  return { stufe, an, aus, ...(recht ? { recht } : {}), ...(buendel ? { buendel } : {}) };
}

// EIN HARNESS OHNE CLAUDE-SCHALTER TRÄGT NUR DIE SERVER-RECHTE: die vier Schalter werden auf die Standardstufe
// mit leeren Listen gesetzt, nicht angewendet. So bleibt ein Recht bei einer Nachfolge über einen Harnesswechsel
// erhalten, ohne dass eine fremde Regel an Claude Code vorbeigeht.
export function rechteFuerHarness(r: Rechte | null, harness: string): Rechte | null {
  if (!r || harness === "claude") return r;
  return { stufe: RECHTE_STANDARD, an: [], aus: [],
    ...(r.recht?.length ? { recht: r.recht } : {}), ...(r.buendel ? { buendel: r.buendel } : {}) };
}
