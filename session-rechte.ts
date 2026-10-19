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

export interface Rechte { readonly stufe: RechteStufe; readonly an: readonly string[]; readonly aus: readonly string[] }
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
// was ein Start von außen schickt, geprüft; null = nicht lesbar
export function rechteAus(v: unknown): Rechte | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  const ids = (x: unknown): string[] | null => x === undefined ? [] : Array.isArray(x) && x.every((y) => typeof y === "string" && RECHTE_BEFEHLE.some((b) => b.id === y)) ? x as string[] : null;
  const an = ids(r.an), aus = ids(r.aus);
  if (!istStufe(r.stufe) || !an || !aus || an.some((x) => aus.includes(x))) return null;
  return { stufe: r.stufe, an, aus };
}
