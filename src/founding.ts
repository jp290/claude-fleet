// DER GRÜNDUNGSPLAN, WIE ER ÜBER DIE LEITUNG KOMMT (GET /api/founding-plan, server.ts#foundingPlanAnswer): seine Form, ihre Prüfung
// und die Wörter, mit denen ihn das Fenster „Neue Session“ (src/k15-entwurf.ts) zeigt. Bis Runde 5 (17.10.) stand hier auch das alte
// Startfenster; das neue hat es abgelöst (Owner 17.10.: „[Zitat entfernt]“), seine Starts gehen über src/start-tuer.ts. Was blieb, liest
// das neue Fenster über src/k15-lader.ts.
import type { FoundingPlanOmission, FoundingPlanPack, FoundingPlanPart, FoundingSessionAgents, PackAnchors } from "./protocol";
import { istFrage, type SessionFrage } from "../session-fragen";

// the four roles of the register (session-blocks.ts#SessionRole); the server's own word for each
// comes with the plan (`rollen[].wort`), the sentence is the window's (Konzept 3, Blatt 20)
type Role = "lane" | "main" | "orchestratorin" | "nur-ordner";
const ROLE_IDS: readonly Role[] = ["lane", "main", "orchestratorin", "nur-ordner"];
// the five questions of the register (session-fragen.ts), the order the window reads them in
type Frage = SessionFrage;
// one Baustein of the plan (session-blocks.ts#SessionPlanBaustein), read as the server sent it
type Zustand = string; // "an" | "aus" | "ersetzt:<id>"
export interface Baustein {
  id: string; wort: string; satz: string; breaksWithout?: string; funktion: string[];
  frage?: Frage; abschnitte?: { teil: string; frage: Frage }[];
  grenze: { art: "noetig"; grund: string; gesperrt?: true } | { art: "frei" };
  schicht: string; zustand: Zustand; quelle: "default" | "schalter";
  rollenDefault: "an" | "aus" | { zustand: "bedingt"; grund: string };
  bedingung?: { grund: string; erfuellt: boolean | "unknown" };
  harness: { gueltig: boolean; grund: string | null };
  schaltbar: { ja: true } | { ja: false; grund: string };
  bytes: number | "unknown"; enthaltenIn?: string; ersatzKandidaten: string[]; vorlage?: string; details?: unknown;
}
interface SessionPlan {
  planHash: string; planSatz: string; rolle: Role; harness: string; modell: string | null; effort: string | null;
  ort: { art: string; pfad: string; branch: string | null; head: string };
  bytesVorAuftrag: { bytes: number; unknown: string[]; auftrag: string[] };
  bausteine: Baustein[];
}
interface RolleRow { id: Role; wort: string; standard: { harness: string; modell: string; effort: string | null } | null; verfuegbarkeit: string }
// the plan route's answer (shapes: src/protocol.ts#FoundingPlanPack); head and plannedAt are the
// PREVIEW's source state, which the start receipt is later held against
interface Plan {
  head?: string; branch?: string | null; harness?: string; plannedAt?: number; selected: FoundingPlanPack[]; omitted: FoundingPlanOmission[];
  sessionAgents?: FoundingSessionAgents | null; // null: the role writes no session file (Nur Ordner)
}
export interface Answer extends Plan {
  plan: SessionPlan; rollen: RolleRow[]; start: { tuer: "lane" | "open"; startbar: boolean; refusals: string[] };
  // what reaches the start row by row (the role's own door), what Claude Code brings itself, and the
  // sum in tokens — optional: an older server omits them and the window then shows no start block
  lieferung?: Lieferung; claudeCode?: ClaudeCode | null; startSumme?: StartSumme;
  // der Hash der Fassung, die ein Start jetzt trüge (nur mit anlass=neu); der Start schickt ihn als `fassung` zurück
  fassungsHash?: string;
}
interface Lieferung { tuer: string; geliefert: { id: string; weg: string }[]; ausgelassen: { id: string; grund: string }[] }
interface CcZeile { id: string; wort: string; satz: string; quelle: string; weg: string; bytes: number | "unknown"; wert: string; frage?: Frage; details?: unknown }
interface CcMessung { rolle: string; tokens: number; am: string; claude: string; modell: string; quelle: string; gilt: boolean; grund?: string }
interface ClaudeCode { rolle: string; zeilen: CcZeile[]; messung: CcMessung; danach?: CcMessung }
interface StartSumme { fleetBytes: number; fleetUnbekannt: string[]; fleetTokens: number; bytesJeToken: { wert: number; quelle: string };
  claudeCodeTokens: number | null; tokens: number | "unknown" }

// the two native rows share the register word "Laedt nativ", which says their way, not what they are
// (and three more share a word with a neighbour they are listed beside)
// (and the register writes umlauts as ae/oe/ue, which a name on screen does not)
const START_WORT: Record<string, string> = { "native-agents": "Regeln des Ordners", "auto-memory": "Notizbuch",
  "commit-expectation": "Commit-Pflicht", "self-credential": "Self-Zugang", "spawn-profile": "Agent · Modell · Effort",
  "lane-footer": "Rückweg und Ende", "memory-pointer": "Gedächtnis-Hinweis",
  // three rows share the register word "Auftrag", which is their function, not what each one is
  "task-brief": "Karte", "main-rail": "Program-Auftrag", "orchestrator-card": "Rolle, Systemkonzept und Packs" };
const packWord = (id: string): string => PACK_WORDS[id]?.name ?? id;
export const bausteinName = (b: Baustein): string => b.id.startsWith("pack:") ? `Pack · ${packWord(b.id.slice(5))}` : START_WORT[b.id] ?? b.wort;

// the newer fields are OPTIONAL: an older server omits them, and the window then says "nicht gemeldet";
// a field that is present in a wrong shape makes the whole plan unreadable, never half-believed
const strs = (v: unknown): boolean => Array.isArray(v) && v.every((x) => typeof x === "string");
const optional = (o: object, k: string, ok: (v: unknown) => boolean): boolean =>
  !(k in o) || (o as Record<string, unknown>)[k] === undefined || ok((o as Record<string, unknown>)[k]);
function validAnchors(v: unknown): v is PackAnchors {
  if (Array.isArray(v)) return v.every((a: unknown) => !!a && typeof a === "object"
    && typeof (a as Record<string, unknown>).path === "string" && typeof (a as Record<string, unknown>).anchor === "string");
  return !!v && typeof v === "object" && typeof (v as Record<string, unknown>).privateSourceId === "string";
}
const nullable = (ok: (v: unknown) => boolean) => (v: unknown): boolean => v === null || ok(v);
const isStr = (v: unknown): boolean => typeof v === "string";
const isNum = (v: unknown): boolean => typeof v === "number" && Number.isFinite(v) && v >= 0;
function validPart(p: unknown): p is FoundingPlanPart {
  if (!p || typeof p !== "object") return false;
  const r = p as Record<string, unknown>;
  return isStr(r.id) && nullable(isStr)(r.packId) && nullable(isStr)(r.path) && nullable(isStr)(r.anchor)
    && (r.sorte === "anleitung" || r.sorte === "wissen") && (r.ort === "box" || r.ort === "ausleihe")
    && nullable(isStr)(r.sha256) && nullable(isNum)(r.bytes) && nullable(isStr)(r.content)
    && (r.refusal === null || r.refusal === "source-unavailable" || r.refusal === "source-anchor-missing"
      || r.refusal === "source-anchor-ambiguous");
}
function validFile(v: unknown): v is FoundingSessionAgents {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return isStr(r.text) && isNum(r.bytes) && Array.isArray(r.parts) && r.parts.every(validPart);
}
function validPlan(j: unknown): j is Plan {
  if (!j || typeof j !== "object" || !("selected" in j) || !("omitted" in j)) return false;
  return Array.isArray(j.selected) && Array.isArray(j.omitted)
    && optional(j, "head", (v) => typeof v === "string") && optional(j, "plannedAt", (v) => typeof v === "number" && Number.isFinite(v))
    && optional(j, "sessionAgents", (v) => v === null || validFile(v))
    && j.selected.every((p: unknown) => !!p && typeof p === "object"
      && "id" in p && typeof p.id === "string" && "bytes" in p && typeof p.bytes === "number"
      && Number.isFinite(p.bytes) && p.bytes >= 0 && "source" in p
      && (p.source === "fleet-seed" || p.source === "repo-manifest")
      && (!("useWhen" in p) || p.useWhen === undefined || typeof p.useWhen === "string")
      && optional(p, "harnesses", strs) && optional(p, "triggers", strs) && optional(p, "anchors", validAnchors)
      && optional(p, "sourceHash", (v) => typeof v === "string") && optional(p, "group", isStr)
      && optional(p, "parts", (v) => Array.isArray(v) && v.every(validPart)))
    && j.omitted.every((p: unknown) => !!p && typeof p === "object"
      && "id" in p && typeof p.id === "string" && "reason" in p && typeof p.reason === "string"
      && optional(p, "harnesses", strs));
}

// validPlan ends here (e2e/context-borrow.ts reads strs … validPlan from the source up to this line)

// the session plan of dd3d548a: a present plan in a wrong shape is unreadable, never half-believed
const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLE_IDS as readonly string[]).includes(v);
const isFrage = istFrage;
const validAbschnitte = (v: unknown): boolean => Array.isArray(v) && v.every((x) => isStr(rec(x)?.teil) && isFrage(rec(x)?.frage));
function validBaustein(v: unknown): v is Baustein {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  const g = r.grenze as Record<string, unknown> | null;
  const h = r.harness as Record<string, unknown> | null;
  const sb = r.schaltbar as Record<string, unknown> | null;
  const rd = r.rollenDefault;
  return isStr(r.id) && isStr(r.wort) && isStr(r.satz) && strs(r.funktion) && isStr(r.schicht) && isStr(r.zustand)
    && (r.quelle === "default" || r.quelle === "schalter")
    && !!g && typeof g === "object" && (g.art === "frei" || (g.art === "noetig" && isStr(g.grund)))
    && (rd === "an" || rd === "aus" || (!!rd && typeof rd === "object" && (rd as Record<string, unknown>).zustand === "bedingt"))
    && !!h && typeof h === "object" && typeof h.gueltig === "boolean"
    && !!sb && typeof sb === "object" && (sb.ja === true || (sb.ja === false && isStr(sb.grund)))
    && (isNum(r.bytes) || r.bytes === "unknown") && strs(r.ersatzKandidaten) && optional(r, "enthaltenIn", isStr)
    && optional(r, "frage", isFrage) && optional(r, "abschnitte", validAbschnitte);
}
export function validAnswer(j: unknown): j is Answer {
  if (!validPlan(j)) return false;
  const r = j as unknown as Record<string, unknown>;
  const p = r.plan as Record<string, unknown> | null;
  const v = p?.bytesVorAuftrag as Record<string, unknown> | null;
  const st = r.start as Record<string, unknown> | null;
  return !!p && typeof p === "object" && isStr(p.planHash) && isStr(p.planSatz) && isRole(p.rolle)
    && !!v && typeof v === "object" && isNum(v.bytes) && strs(v.unknown) && strs(v.auftrag)
    && Array.isArray(p.bausteine) && p.bausteine.every(validBaustein)
    && Array.isArray(r.rollen) && r.rollen.every((x: unknown) => !!x && typeof x === "object" && isRole((x as RolleRow).id) && isStr((x as RolleRow).wort))
    && !!st && typeof st === "object" && (st.tuer === "lane" || st.tuer === "open") && typeof st.startbar === "boolean" && strs(st.refusals)
    && optional(r, "lieferung", validLieferung) && optional(r, "claudeCode", nullable(validClaudeCode)) && optional(r, "startSumme", validStartSumme);
}
const rec = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
const sizeOk = (v: unknown): boolean => isNum(v) || v === "unknown";
function validLieferung(v: unknown): boolean {
  const r = rec(v);
  return !!r && isStr(r.tuer) && Array.isArray(r.geliefert) && r.geliefert.every((x) => isStr(rec(x)?.id) && isStr(rec(x)?.weg))
    && Array.isArray(r.ausgelassen) && r.ausgelassen.every((x) => isStr(rec(x)?.id) && isStr(rec(x)?.grund));
}
function validMessung(v: unknown): boolean {
  const r = rec(v);
  return !!r && isNum(r.tokens) && isStr(r.am) && isStr(r.claude) && isStr(r.modell) && isStr(r.quelle) && typeof r.gilt === "boolean" && optional(r, "grund", isStr);
}
function validClaudeCode(v: unknown): boolean {
  const r = rec(v);
  return !!r && isStr(r.rolle) && validMessung(r.messung) && optional(r, "danach", validMessung) && Array.isArray(r.zeilen)
    && r.zeilen.every((x) => { const z = rec(x); return !!z && isStr(z.id) && isStr(z.wort) && isStr(z.satz) && isStr(z.quelle) && isStr(z.weg) && isStr(z.wert) && sizeOk(z.bytes) && optional(z, "frage", isFrage); });
}
function validStartSumme(v: unknown): boolean {
  const r = rec(v), q = rec(r?.bytesJeToken);
  return !!r && !!q && isNum(r.fleetBytes) && strs(r.fleetUnbekannt) && isNum(r.fleetTokens) && isNum(q.wert) && (q.wert as number) > 0 && isStr(q.quelle)
    && nullable(isNum)(r.claudeCodeTokens) && sizeOk(r.tokens);
}

// the plan's omission reasons are a closed vocabulary (context-plan.ts CONTEXT_PLAN_OMISSION_REASONS);
// the window says each in owner words — an unknown future reason is shown raw rather than hidden
export const OMIT_SAY: Record<string, string> = {
  "manifest-invalid": "Pack-Verzeichnis nicht lesbar",
  "source-unavailable": "Quelle nicht im Repo",
  "status-not-active": "abgeschaltet",
  "harness-unsupported": "nicht für diesen Agenten",
  "mode-unsupported": "nicht für diese Rolle",
  "trigger-not-matched": "passt nicht zu diesem Start",
  "capability-missing": "Fähigkeit fehlt hier",
  "program-complete": "Program abgeschlossen",
};

// the words of the view for the packs (design v3 §0, "Wörter der Ansicht"); a pack without words here
// is named by its own id, never by a guess
// WARUM DER TEXT EINES TEILS NICHT IN DER DATEI STEHT, in Owner-Worten; null = er steht darin. Das Fenster sagt es unter dem Teil
// (src/k15-packs-ui.ts); e2e/context-borrow.ts liest die Funktion aus der Quelle bis zur Zeile danach
export const partFixed = (x: FoundingPlanPart): string | null =>
  x.privateSourceId ? "Privat: der Text dieser Quelle kommt nie in die Datei, nur ihr Hinweis."
  : x.refusal === "source-unavailable" ? "Die Quelle liegt an diesem Stand nicht im Repo."
  : x.refusal === "source-anchor-missing" ? "Die Überschrift der Quelle fehlt an diesem Stand."
  : x.refusal === "source-anchor-ambiguous" ? "Anker nicht eindeutig." : null;
// partFixed ends here

export const PACK_WORDS: Record<string, { name: string; say: string }> = {
  "portable-core": { name: "Grundregeln", say: "Begriffe und feste Regeln, die jede Session bindet." },
  "konzept-claude-fleet": { name: "Was Claude Fleet ist", say: "Das Konzept und seine Prinzipien." },
  "verify-e2e": { name: "Prüfen", say: "Wann eine Änderung als bewiesen gilt." },
  "land-mechanics": { name: "Landen", say: "Was beim Landen einer Lane wirklich passiert." },
  "harness-adapter": { name: "Agent-Anbindung", say: "Wie ein Agent-Programm angebunden wird." },
  "orchestrator-eigenarten": { name: "Eigenarten der Orchestrierung", say: "Watches und Nachfolge, zwei bezahlte Lektionen." },
  "messnotiz-index": { name: "Frühere Messungen", say: "Erst nachsehen, ob es schon gemessen wurde." },
  "jev-use": { name: "Jev", say: "Wie Jev verwendet wird." },
  "owner-instanzweg": { name: "Weg zum Owner", say: "Wie eine Session den Owner erreicht." },
  "gestaltungsgrammatik": { name: "Gestaltungsgrammatik", say: "docs/design, auf Abruf." },
  "haltung-worker": { name: "Arbeitshaltung", say: "Ziel hinter der Karte, ganzes Ergebnis, Wirkung selbst sehen." },
  "haltung-auftraggeber": { name: "Karten schreiben", say: "Wie eine Karte die beste Besetzung hervorholt." },
  "projekt-aufnahme": { name: "Projekt aufnehmen", say: "Wie ein fremdes Repo ein Fleet-Projekt wird." },
  "nachfolge-klug": { name: "Nachfolge", say: "Warm sichern und den Zeitpunkt der Nachfolge entscheiden." },
  "testinstanz-abnahme": { name: "Testinstanz-Abnahme", say: "Sichtbares ist erst mit durchgeklickter Testinstanz, Link und Bild fertig." },
  "setting-up-agents": { name: "Agenten aufsetzen", say: "Die fünf Teile, ein oder zwei Sitze und das Verbindungsstück." },
  "working-with-the-owner": { name: "Mit dem Owner arbeiten", say: "Verstehen, antworten und ohne ihn entscheiden." },
  "running-fleet": { name: "Fleet betreiben", say: "Landen, deployen, ein rotes Audit, den Helfer und lebende Sessions." },
  "who-it-is-for": { name: "Für wen", say: "Wer die Arbeit trifft und wie sie ihre Leute verfehlt." },
  "how-fleet-remembers": { name: "Wie Fleet erinnert", say: "Vom Notizbuch in Wissen, das bleibt." },
  "system-concept": { name: "Das Systemkonzept", say: "Was Fleet ist, wofür es gebaut wird und wohin es geht." },
};
