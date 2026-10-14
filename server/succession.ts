// Neuaufbau K9 · Session-Nachfolge (docs/neuaufbau/befunde/07-nachfolge.md, S1). Owner 13.10.: „[Zitat entfernt]“
// , „[Zitat entfernt]“. Bauleitung 13.10.:
// Die Einstellung einer Session gilt für die ganze Linie im Slot (Frage 2, Standard Ja).
//
// Reine Logik: kein tmux, kein Spawn, kein Server-Zustand. server.ts hält die Slots und ruft diese
// Funktionen dort, wo eine Besetzung geht und die nächste im selben Slot kommt (respawnInPlace für die
// generische und die Program-Schiene beider Türen, restartLaneSession für die Lane), und dort, wo die
// Owner-Tür ihre Vorschau liest (ownerSucceedPreview).
import { keepCacheTextOk, type HandoverSetting } from "./types";

export interface Occupation { slot: number; openedAt: number }

// DIE EINSTELLUNG GEHÖRT DER LINIE IM SLOT: Schwelle, Hinweis und Warmhalten, die der Owner für eine
// Session gesetzt hat, gehen auf jede Nachfolgerin im selben Slot über, gleich über welche Tür sie kam.
// Nur ein frisches Öffnen (openSlot ohne Nachfolge) beginnt auf den Fleet-Werten. Eine Einstellung,
// die eine andere Besetzung nennt, ist nicht die der gehenden Session und geht nicht mit.
export function ownSetting(setting: HandoverSetting | null, at: Occupation): HandoverSetting | null {
  return setting && setting.occupant.slot === at.slot && setting.occupant.openedAt === at.openedAt ? setting : null;
}
export function settingForSuccessor(setting: HandoverSetting | null, to: Occupation, now: number): HandoverSetting | null {
  return setting ? { ...setting, setAt: now, occupant: { slot: to.slot, openedAt: to.openedAt } } : null;
}

// WAS DIE NACHFOLGERIN BEKOMMT, in einem Satz für den Knopf „Neue Session jetzt“ (GET
// /api/slots/:id/succeed → `says`). Die Fakten sind die der Vorschau: ob die Tür jetzt geht, die
// stehende Übergabe mit ihrem Alter und der Transkript-Rest seit ihr (ohne Übergabe: seit Beginn).
export interface SucceedPreviewFacts {
  refusal: { reason: string } | null;
  rail: "program" | "generic";
  standingHandover: { ageMs: number } | null;
  tail: { state: "read" | "none"; entries: number; omitted: number } | null;
}
const REFUSAL_WORDS: Record<string, string> = {
  "not-active": "hier läuft keine Session",
  asleep: "die Session schläft, erst aufwecken",
  "slot-changing": "der Slot startet oder endet gerade",
  steward: "die Planungs-Session gibt nicht weiter",
  lane: "eine Lane gibt aus ihrer eigenen Session weiter, mit Übergabebericht",
  "game-maker": "eine game-maker-MAIN gibt nur über ihren Spielstand weiter, aus ihrer eigenen Session",
  "in-flight": "eine Nachfolge läuft schon",
  busy: "sie arbeitet gerade; sobald sie ruht, geht es",
  "pointer-uncommitted": "der Zeiger ihrer stehenden Übergabe nennt keine committete Datei mehr",
  "setting-changed": "die Einstellung hat sich gerade geändert",
  "occupant-changed": "inzwischen läuft dort eine andere Session",
};
export function agoText(ms: number): string {
  const min = Math.floor(Math.max(0, ms) / 60_000);
  if (min < 1) return "eben";
  if (min < 90) return `vor ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `vor ${h} h`;
  const d = Math.round(h / 24);
  return `vor ${d} ${d === 1 ? "Tag" : "Tagen"}`;
}
const entriesText = (n: number): string => `${n} ${n === 1 ? "Eintrag" : "Einträge"}`;
export function successorSentence(p: SucceedPreviewFacts): string {
  if (p.refusal) return `Geht gerade nicht: ${REFUSAL_WORDS[p.refusal.reason] ?? p.refusal.reason}.`;
  const parts: string[] = [];
  if (p.rail === "program") parts.push("den Program-Eintrag");
  if (p.standingHandover) parts.push(`die stehende Übergabe von ${agoText(p.standingHandover.ageMs)}`);
  const read = p.tail?.state === "read";
  if (read && p.tail && p.tail.entries > 0)
    parts.push(`${entriesText(p.tail.entries)} Transkript-Rest${p.tail.omitted > 0 ? ` (${p.tail.omitted} ältere ausgelassen)` : ""}`);
  const got = parts.length === 0 ? "nur ihren Start-Brief"
    : parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(", ")} und ${parts.at(-1)!}`;
  const notes: string[] = [];
  if (!p.standingHandover) notes.push("eine Übergabe hat die Session nicht geschrieben");
  if (!read) notes.push("das Transkript kann Fleet nicht lesen");
  return `Die Nachfolgerin bekommt ${got}${notes.length ? `; ${notes.join(", ")}` : ""}.`;
}

// DER CACHE EINER SESSION (S2, Owner 13.10.: „[Zitat entfernt]“
// ). Gelesen aus dem Transkript (server.ts#deliveryCacheReading): der letzte echte Modellaufruf,
// die Stufe des Caches (1 h oder 5 min) und eine Kompaktierung danach. Warm bis zum Ende der Stufe,
// dann kalt: Ein Turn schreibt den ganzen Kontext neu. Hat Claude nach dem letzten Aufruf kompaktiert,
// ist der alte Cache verbraucht und der Kontext klein; dann heißt es „kompaktiert“, nicht „kalt“.
export type CacheState = "warm" | "kalt" | "kompaktiert" | "unbekannt";
export interface CacheView { state: CacheState; lastCallAt: number | null; ttlSec: number; coldAt: number | null }
export function cacheView(lastCallAt: number | null, ttlSec: number, compactedAt: number | null, now: number): CacheView {
  if (lastCallAt === null) return { state: "unbekannt", lastCallAt, ttlSec, coldAt: null };
  const coldAt = lastCallAt + ttlSec * 1000;
  if (compactedAt !== null && compactedAt >= lastCallAt) return { state: "kompaktiert", lastCallAt, ttlSec, coldAt };
  return { state: now < coldAt ? "warm" : "kalt", lastCallAt, ttlSec, coldAt };
}

// WARMHALTEN: EIN SCHALTER, EINE ENTSCHEIDUNG. Bis S1 gab es zwei Wege (der Owner-Schalter über der
// Schwelle mit Nachfolge, der Default gebundener MAINs ohne). Jetzt hält eine Session, deren Schalter
// an ist, ihren Cache warm: `idleMin` Minuten nach dem letzten Modellaufruf ein kurzer Turn, solange
// der Cache noch lebt. Gedeckelt ohne eigenen Turn (`warmMax`) und je Stunde (`hourCap`). Die Übergabe
// an der Schwelle ist S3. `on` ist der Schalter, der gilt: der eigene der Session, sonst der Fleet-Wert
// für ihre Art (server.ts#keepCacheFleetOn).
export interface WarmFacts {
  on: boolean; asleep: boolean; pinned: boolean;
  lastCallAt: number | null; tier: "1h" | "5m" | "codex" | "unknown"; compactedAt: number | null;
  idleMin: number; lifetimeMin: number;
  warmTurns: number; warmMax: number; warmLastHour: number; hourCap: number;
}
export type WarmReason = "off" | "asleep" | "unpinned" | "no-usage" | "cache-5m" | "compacted" | "before-duration"
  | "expired" | "warm-cap" | "hour-cap" | "due";
export interface WarmDecision { act: "warm" | null; reason: WarmReason; lastUsageAt: number | null; dueAt: number | null }
export function warmDecision(f: WarmFacts, now: number): WarmDecision {
  const no = (reason: WarmReason, lastUsageAt: number | null = null, dueAt: number | null = null): WarmDecision =>
    ({ act: null, reason, lastUsageAt, dueAt });
  if (!f.on) return no("off");
  if (f.asleep) return no("asleep");
  if (!f.pinned) return no("unpinned");
  const last = f.lastCallAt;
  if (last === null) return no("no-usage");
  // eine 5-min-Stufe ist vor jedem Warm-Turn verfallen, eine Kompaktierung hat den Cache verbraucht
  if (f.tier === "5m") return no("cache-5m", last);
  if (f.compactedAt !== null && f.compactedAt >= last) return no("compacted", last);
  const dueAt = last + f.idleMin * 60_000;
  if (now < dueAt) return no("before-duration", last, dueAt);
  if (now >= last + f.lifetimeMin * 60_000) return no("expired", last, dueAt);
  if (f.warmTurns >= f.warmMax) return no("warm-cap", last, dueAt);
  if (f.warmLastHour >= f.hourCap) return no("hour-cap", last, dueAt);
  return { act: "warm", reason: "due", lastUsageAt: last, dueAt };
}

// DER TEXT DES WARM-TURNS (S2b, Owner 13.10.: „[Zitat entfernt]“
// ). Was PATCH …/handover `keepCacheText` speichert: null, leer oder der Fleet-Text selbst
// heißt Fleet-Standard und speichert nichts. Sonst nur Text (types.ts#keepCacheTextOk) und keine
// Zugangsdaten dieser Fleet: Der Text steht in fleet.json und wird in die Pane getippt. `credentials`
// sind die Werte, die der Server kennt (server.ts#knownCredentials); kürzere als
// CREDENTIAL_MIN_CHARS zählen nicht, ein Env-Wert wie „1“ stünde sonst in jedem Text.
const CREDENTIAL_MIN_CHARS = 12;
export type WarmTextInput = { ok: true; text: string | null } | { ok: false; refusal: "bad-keep-cache-text" | "keep-cache-secret" };
export function warmTextInput(v: unknown, fleetText: string, credentials: readonly string[]): WarmTextInput {
  if (v === null) return { ok: true, text: null };
  if (typeof v !== "string") return { ok: false, refusal: "bad-keep-cache-text" };
  const text = v.trim();
  if (!text || text === fleetText) return { ok: true, text: null };
  if (!keepCacheTextOk(text)) return { ok: false, refusal: "bad-keep-cache-text" };
  if (credentials.some((c) => c.length >= CREDENTIAL_MIN_CHARS && text.includes(c))) return { ok: false, refusal: "keep-cache-secret" };
  return { ok: true, text };
}

// AN DER SCHWELLE (S3, docs/neuaufbau/befunde/07-nachfolge.md §4). Owner 13.10.: „[Zitat entfernt]“
// 
// . Jede Art Session
// hat eine Basis und eine Obergrenze. An der Basis bekommt sie den Hinweis, auch mitten in der Arbeit, und
// wählt den Punkt selbst; an der Obergrenze oder bei kaltem Cache über der Basis ist die Handlung fällig.
// Bauleitung 14.10.: Die Env verschiebt die Basis ihrer Schiene, die Orchestratorin behält ihre Zeile (das
// Owner-Wort ist jünger als der Env-Wert 40); der eigene Wert einer Session ist ihre Basis; die Obergrenze
// liegt immer CAP_GAP_PCT darüber.
export type SessionKind = "orchestrator" | "program-main" | "bau" | "lane" | "session";
const FLEET_BASE_PCT: Record<SessionKind, number> = { orchestrator: 45, "program-main": 40, bau: 40, lane: 37, session: 40 };
export const CAP_GAP_PCT = 5;
export interface Threshold { kind: SessionKind; basePct: number; capPct: number; from: "session" | "env" | "fleet" }
// `envPct`: der Env-Wert der Schiene, null = nicht gesetzt; 0 schaltet die Schiene ab (basePct 0).
// `ownPct`: der eigene Wert der Session (HandoverSetting.thresholdPct), null = keiner.
export function thresholdOf(kind: SessionKind, envPct: number | null, ownPct: number | null): Threshold {
  const env = kind === "orchestrator" ? null : envPct;
  const basePct = ownPct ?? env ?? FLEET_BASE_PCT[kind];
  return { kind, basePct, capPct: basePct > 0 ? basePct + CAP_GAP_PCT : 0,
    from: ownPct !== null ? "session" : env !== null ? "env" : "fleet" };
}
// "below": nichts; "hint": zwischen Basis und Obergrenze bei warmem Cache, die Session wählt den Punkt;
// "due": an der Obergrenze oder kalt über der Basis, die Handlung ist fällig. `cooling`: Der Cache ist noch
// warm, wird es aber bald nicht mehr sein (cacheCooling) — das zählt wie kalt, denn danach käme jede Handlung
// zu spät: Compact läse den ganzen Kontext neu, und Claude Code kompaktiert vorher selbst.
export type ThresholdStep = "below" | "hint" | "due";
export function thresholdStep(fillPct: number, t: Threshold, cache: CacheState, cooling = false): ThresholdStep {
  if (t.basePct <= 0 || fillPct < t.basePct) return "below";
  return fillPct >= t.capPct || cache === "kalt" || cooling ? "due" : "hint";
}
// KURZ VOR KALT (S3b): Claude Code kompaktierte hier 12 von 12 ruhenden Sessions 53–54 min nach dem letzten
// Aufruf selbst („Compacted while idle, before the prompt cache expired“, ab 204k Tokens), bei einer Stufe
// von 60 min. Fleet handelt darum COOLING_LEAD_MS vor dem Ende der Stufe, bei 60 min nach 50 min Ruhe; eine
// kurze Stufe bekommt ein Fünftel ihrer Länge als Vorlauf.
export const COOLING_LEAD_MS = 10 * 60_000;
export function cacheCooling(v: CacheView, now: number): boolean {
  return v.state === "warm" && v.coldAt !== null && now >= v.coldAt - Math.min(COOLING_LEAD_MS, (v.ttlSec * 1000) / 5);
}

// DIE WAHL AN DER SCHWELLE (S3b, Owner 13.10.: „[Zitat entfernt]“):
// Was Fleet tut, wenn die Handlung fällig ist. „[Zitat entfernt]“ ist der Fleet-Wert für jede Art (Bauleitung 14.10.)
// und wird nicht gespeichert; eine Lane wählt nur Hinweis oder Compact, denn sie gibt mit ihrem eigenen
// handoff-Report weiter, und die Owner-Tür verweigert sie.
export type ThresholdChoice = "hint" | "compact" | "succeed";
export function choicesFor(kind: SessionKind): readonly ThresholdChoice[] {
  return kind === "lane" ? ["hint", "compact"] : ["hint", "compact", "succeed"];
}
export type ChoiceInput = { ok: true; choice: ThresholdChoice | null } | { ok: false; refusal: "bad-at-threshold" | "lane-succeed" };
export function choiceInput(v: unknown, kind: SessionKind): ChoiceInput {
  if (v === null || v === "hint") return { ok: true, choice: null };
  if (v !== "compact" && v !== "succeed") return { ok: false, refusal: "bad-at-threshold" };
  if (!choicesFor(kind).includes(v)) return { ok: false, refusal: "lane-succeed" };
  return { ok: true, choice: v };
}

// DIE HANDLUNG (S3b, §4): Fleet handelt nur an einer RUHENDEN Session, nie mitten im Turn, und erst nachdem
// der Hinweis angekommen ist, der die Handlung nennt und um die stehende Übergabe bittet — es sei denn, der
// Owner hat den Hinweis für diese Session abgeschaltet. Je Gespräch höchstens eine Handlung je `retryMs`.
export interface ActFacts { choice: ThresholdChoice; step: ThresholdStep; resting: boolean; hinted: boolean; hintOn: boolean;
  actedAt: number | null; retryMs: number; now: number }
export type ActReason = "choice-hint" | "not-due" | "hint-first" | "acted" | "working" | "due";
export interface ActDecision { act: "compact" | "succeed" | null; reason: ActReason }
export function actDecision(f: ActFacts): ActDecision {
  const no = (reason: ActReason): ActDecision => ({ act: null, reason });
  if (f.choice === "hint") return no("choice-hint");
  if (f.step !== "due") return no("not-due");
  if (f.hintOn && !f.hinted) return no("hint-first");
  if (f.actedAt !== null && f.now - f.actedAt < f.retryMs) return no("acted");
  if (!f.resting) return no("working");
  return { act: f.choice, reason: "due" };
}

// DAS BUDGET DER HINWEISE je Gespräch: höchstens `max`, `cooldownMs` auseinander. Zwischen Basis und
// Obergrenze kommt nur der erste; weitere nur, wenn die Handlung fällig ist. Ein neues Gespräch im Slot
// (/clear, eine Nachfolge) beginnt bei null. Prozess-lokal wie zuvor migrateTried: ein Neustart vergisst
// die Zählung, statt Automatik-Absicht in einen neuen Prozess zu tragen.
// `claim` prüft und reserviert in einem Schritt, ohne await: Der Tick fragt es NACH seinen awaits, und
// ein Hinweis, der inzwischen angekommen oder noch unterwegs ist, wird nicht ein zweites Mal getippt
// (08.10.: zwei Hinweise 307 ms auseinander bei 900 s Abstand).
export interface HintAttempt { sessionId: string; nudges: number; lastAt: number; gaveUp: boolean }
export interface HintClaim { slot: number; attempt: HintAttempt }
export class HintLedger {
  private readonly tried = new Map<number, HintAttempt>();
  private readonly pending = new Set<string>();
  constructor(readonly max: number, readonly cooldownMs: number) {}
  // der Stand DIESES Gesprächs; null = es hat noch keinen Hinweis bekommen
  of(slot: number, sessionId: string): HintAttempt | null {
    const a = this.tried.get(slot);
    return a && a.sessionId === sessionId ? a : null;
  }
  due(slot: number, sessionId: string, step: ThresholdStep, now: number): boolean {
    if (step === "below" || this.pending.has(`${slot}:${sessionId}`)) return false;
    const a = this.of(slot, sessionId);
    if (!a) return true;
    if (a.gaveUp || a.nudges >= this.max) return false;
    if (a.lastAt && now - a.lastAt < this.cooldownMs) return false;
    return step === "due" || a.nudges === 0;
  }
  claim(slot: number, sessionId: string, step: ThresholdStep, now: number): HintClaim | null {
    if (!this.due(slot, sessionId, step, now)) return null;
    this.pending.add(`${slot}:${sessionId}`);
    const a = this.of(slot, sessionId);
    return { slot, attempt: a ? { ...a } : { sessionId, nudges: 0, lastAt: 0, gaveUp: false } };
  }
  // angekommen: gezählt; `gaveUp` sagt, ob damit das Budget dieses Gesprächs erschöpft ist
  delivered(c: HintClaim, at: number): { nudges: number; gaveUp: boolean } {
    const a = { ...(this.of(c.slot, c.attempt.sessionId) ?? c.attempt) };
    a.nudges++;
    a.lastAt = at;
    const gaveUp = !a.gaveUp && a.nudges >= this.max;
    if (gaveUp) a.gaveUp = true;
    this.tried.set(c.slot, a);
    return { nudges: a.nudges, gaveUp };
  }
  // fehlgeschlagen: nicht gezählt, aber der nächste Versuch wartet den Abstand ab
  failed(c: HintClaim, at: number): void {
    this.tried.set(c.slot, { ...(this.of(c.slot, c.attempt.sessionId) ?? c.attempt), lastAt: at });
  }
  release(c: HintClaim): void { this.pending.delete(`${c.slot}:${c.attempt.sessionId}`); }
  // der Slot wird frei: sein Stand geht mit
  forget(slot: number): void { this.tried.delete(slot); }
  // dasselbe Gespräch unter einer neuen Kennung (Claude Codes Rollover) zählt weiter
  moveSession(slot: number, from: string, to: string): void {
    const a = this.of(slot, from);
    if (a) this.tried.set(slot, { ...a, sessionId: to });
  }
}

// DER HINWEIS, ein Text je Wahl (S3; Bauleitung 14.10.: „[Zitat entfernt]“ ab Werk für jede Art). Er nennt
// Füllstand, Schwelle und Obergrenze und was dann geschieht, und bittet um die stehende Übergabe — statt drei
// Texten je Schiene. Bei „nur Hinweis“ unterscheidet sich nur der Ausgang, weil die Türen verschieden sind:
// Eine Lane gibt mit ihrem handoff-Report weiter (server.ts#succeedLane), jede andere Session mit der
// stehenden Übergabe, die auch die Owner-Tür ohne Turn liest (server.ts#handleOwnerSucceed).
export interface HintFacts { fillPct: number; usedTokens: number; windowTokens: number; threshold: Threshold; step: ThresholdStep;
  cache: CacheState; choice: ThresholdChoice }
export function hintText(f: HintFacts): string {
  const lane = f.threshold.kind === "lane";
  const why = f.step !== "due" ? "" : f.fillPct >= f.threshold.capPct ? " Die Obergrenze ist erreicht."
    : f.cache === "kalt" ? " Dein Cache ist kalt: Jeder weitere Turn liest den ganzen Kontext neu."
    : " Dein Cache wird bald kalt.";
  const head = `[fleet] Dein Kontext ist bei ${f.fillPct}% (${f.usedTokens} von ${f.windowTokens} Tokens im Fenster). `
    + `Die Schwelle ${lane ? "dieser Lane" : "dieser Session"} ist ${f.threshold.basePct} %, die Obergrenze ${f.threshold.capPct} %.${why} `;
  const token = "x-fleet-self-token aus der Umgebungsvariablen FLEET_SELF_TOKEN";
  const handover = `eine stehende Übergabe (POST /api/self/handover, \`intent\` ODER \`pointer\`, ${token})`;
  const when = `Ab ${f.threshold.capPct} % oder kurz bevor dein Cache kalt wird`;
  if (f.choice === "compact")
    return `${head}${when} tippt Fleet \`/compact\`, sobald du ruhst: Claude fasst das Gespräch zusammen, und du arbeitest `
      + `weiter. ${lane ? "Committe vorher deinen Stand." : `Was die Zusammenfassung nicht verlieren darf, schreib vorher in ${handover}.`}`;
  if (f.choice === "succeed")
    return `${head}${when} öffnet Fleet in diesem Slot eine neue Session, sobald du ruhst; in deine Pane wird dafür nichts `
      + `getippt. Sie bekommt deine stehende Übergabe und den Transkript-Rest danach. Schreib jetzt ${handover} und halte sie aktuell.`;
  const opening = `${head}Fleet übergibt nicht selbst, du wählst den Punkt`;
  if (lane)
    return `${opening}: Bring den laufenden Schnitt zu Ende und committe, file einen fleet-report mit status \`handoff\` `
      + `und gib dann mit POST /api/self/succeed (${token}) an eine frische Session auf diesem Worktree weiter.`;
  return `${opening}. Schreib eine stehende Übergabe (POST /api/self/handover, \`intent\` ODER \`pointer\`) und halte sie `
    + "aktuell: Mit ihr öffnet der Owner jederzeit eine neue Session, ohne dir einen Turn zu schicken. "
    + `Am Ende eines Schritts gibst du selbst weiter: POST /api/self/succeed. Beide Türen nehmen den ${token}.`;
}
