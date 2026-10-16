// K15 · „SYSTEMPROMPT UND WERKZEUGE“ AUFGESCHLÜSSELT (Owner 16.10. 11:3x: „[Zitat entfernt]“
// ; Schnitt 889ad0ab, Entscheid der Bauleitung 80917044: Quelle B). Die Form, in der der Gründungsplan es liefert
// (server.ts#claudeCodeStart → claudeCode.anatomie, gebaut in server/claude-code-anatomie.ts#anatomieFuerRolle) und das Fenster es
// liest (anatomieVon). Kein DOM und keine Werte-Importe: Server und k15.js nehmen dieselbe Datei.

export type AnatomieGruppeId = "systemprompt" | "fleet" | "werkzeuge" | "skills" | "agenten" | "plugins" | "mcp";
// an: kommt mit Text in den Start · abruf: nur der Name, den Rest lädt die Session bei Bedarf · name: Fleet lässt nur den Namen in der
// Liste · aus: kommt bei dieser Rolle nicht in den Start
export type AnatomieStand = "an" | "abruf" | "name" | "aus";
export interface AnatomieTeil {
  readonly name: string;
  /** Bytes des Textes, den die Session davon sieht; null = nicht gemessen (der Satz sagt, warum) */
  readonly bytes: number | null;
  readonly stand: AnatomieStand;
  /** wie es hineinkommt oder herausfällt: ein Schalter der Startzeile (`--tools` …; dann legt Fleet es fest) oder ein Ort
   *  (mitgeliefert, Konfig-Ordner, Repo, Plugin x, claude.ai-Anbindung; dann legt Claude Code es fest) */
  readonly weg: string;
  readonly satz: string;
  readonly text?: string;
}
export interface AnatomieGruppe { readonly id: AnatomieGruppeId; readonly wort: string; readonly satz: string; readonly teile: readonly AnatomieTeil[] }
// die Session, an deren Start Claude Codes Teil gemessen ist: Slot (null = beendet), Rolle beim Start, Ordner, Version, Modell, Startzeit (ms), die
// Eingabe-Tokens ihrer ersten Antwort und das daraus gemessene Verhältnis Bytes je Token ihrer ersten Anfrage
export interface AnatomieQuelle {
  readonly slot: number | null; readonly rolle: string; readonly ort: string; readonly claude: string; readonly modell: string | null;
  readonly seit: number; readonly tokens: number | null; readonly bytesJeToken: number | null;
}
export interface CcAnatomie { readonly quelle: AnatomieQuelle | null; readonly grund: string | null; readonly gruppen: readonly AnatomieGruppe[] }

const GRUPPEN_IDS: readonly AnatomieGruppeId[] = ["systemprompt", "fleet", "werkzeuge", "skills", "agenten", "plugins", "mcp"];
const STAENDE: readonly AnatomieStand[] = ["an", "abruf", "name", "aus"];
const rec = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
const str = (v: unknown): v is string => typeof v === "string";
const zahlOderNull = (v: unknown): v is number | null => v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0);
const istStand = (v: unknown): v is AnatomieStand => STAENDE.some((x) => x === v);
const istGruppe = (v: unknown): v is AnatomieGruppeId => GRUPPEN_IDS.some((x) => x === v);

function teilVon(v: unknown): AnatomieTeil | null {
  const r = rec(v);
  if (!r || !str(r.name) || !zahlOderNull(r.bytes) || !istStand(r.stand) || !str(r.weg) || !str(r.satz)
    || (r.text !== undefined && !str(r.text))) return null;
  return { name: r.name, bytes: r.bytes, stand: r.stand, weg: r.weg, satz: r.satz, ...(str(r.text) ? { text: r.text } : {}) };
}
function quelleVon(v: unknown): AnatomieQuelle | null | undefined {
  if (v === null) return null;
  const r = rec(v);
  if (!r || !(r.slot === null || typeof r.slot === "number") || !str(r.rolle) || !str(r.ort) || !str(r.claude) || !(r.modell === null || str(r.modell))
    || typeof r.seit !== "number" || !zahlOderNull(r.tokens) || !zahlOderNull(r.bytesJeToken)) return undefined;
  return { slot: r.slot, rolle: r.rolle, ort: r.ort, claude: r.claude, modell: r.modell, seit: r.seit, tokens: r.tokens, bytesJeToken: r.bytesJeToken };
}
// die Aufschlüsselung aus claudeCode.anatomie; null, wenn ein älterer Server sie nicht schickt oder ihre Form nicht stimmt
export function anatomieVon(claudeCode: unknown): CcAnatomie | null {
  const r = rec(rec(claudeCode)?.anatomie);
  if (!r || !Array.isArray(r.gruppen) || !(r.grund === null || str(r.grund))) return null;
  const quelle = quelleVon(r.quelle);
  if (quelle === undefined) return null;
  const gruppen: AnatomieGruppe[] = [];
  for (const g of r.gruppen) {
    const x = rec(g);
    if (!x || !istGruppe(x.id) || !str(x.wort) || !str(x.satz) || !Array.isArray(x.teile)) return null;
    const teile: AnatomieTeil[] = [];
    for (const t of x.teile) { const y = teilVon(t); if (!y) return null; teile.push(y); }
    gruppen.push({ id: x.id, wort: x.wort, satz: x.satz, teile });
  }
  return { quelle, grund: r.grund, gruppen };
}

// was eine Gruppe beim Start kostet: die Bytes der Teile, die mit Text ankommen (an, abruf und name tragen je ihren Text), und wie viele
// davon nicht gemessen sind
export function gruppenBytes(g: AnatomieGruppe): { bytes: number; offen: number } {
  const da = g.teile.filter((t) => t.stand !== "aus");
  return { bytes: da.reduce((n, t) => n + (t.bytes ?? 0), 0), offen: da.filter((t) => t.bytes === null).length };
}
// die Plugins sind eine Zuordnung der Teile anderer Gruppen und zählen nicht noch einmal
export const zaehltMit = (g: AnatomieGruppe): boolean => g.id !== "plugins";
// Bytes je Token, wie an der Quelle gemessen (ihre erste Anfrage durch die Tokens ihrer ersten Antwort); ohne Quelle Fleets eigenes
// (session-blocks.ts#FLEET_BYTES_JE_TOKEN)
export const jeToken = (an: CcAnatomie): number => an.quelle?.bytesJeToken ?? 2.1;
