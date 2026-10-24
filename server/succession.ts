// Neuaufbau K9 · Session-Nachfolge (docs/neuaufbau/befunde/07-nachfolge.md, S1). Owner 13.10.: „[Zitat entfernt]“
// , „[Zitat entfernt]“. Bauleitung 13.10.:
// Die Einstellung einer Session gilt für die ganze Linie im Slot (Frage 2, Standard Ja).
//
// Reine Logik: kein tmux, kein Spawn, kein Server-Zustand. server.ts hält die Slots und ruft diese
// Funktionen dort, wo eine Besetzung geht und die nächste im selben Slot kommt (respawnInPlace für die
// generische und die Program-Schiene beider Türen, restartLaneSession für die Lane), und dort, wo die
// Owner-Tür ihre Vorschau liest (ownerSucceedPreview).
import { basename } from "node:path";
import { keepCacheTextOk, type HandoverSetting, type LineageAutoTarget, type LineageObligationRef, type LineageWatchTarget } from "./types";

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
  // ohne stehende Übergabe bei kaltem Cache: Fleets summary-Worker fasst das Gespräch zusammen (server.ts#successionSummary)
  summary?: boolean;
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
  if (p.summary) parts.push("eine Zusammenfassung des Gesprächs (die Session wird dafür nicht geweckt)");
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

// DIE WACHEN UND WIEDERHOLUNGEN LAUFEN WEITER (Mangel 100; Owner 17.10.: „[Zitat entfernt]“
// 
// ). Aus dem Ziel, das der Linien-Record je Pflicht trägt, wird der Body der Tür, durch
// die die Vorgängerin sie selbst angelegt hat (server.ts#createWatchForSlot, #createAutoForSlot): dieselben Prüfungen,
// und ein schon erledigtes Ziel feuert dort sofort. Ein Ereignis und ein Bericht bleiben Lese-Pflichten (null).
// `laneNow`: wer jetzt in einem Slot sitzt — eine Lane-Wache gilt nur derselben Lane, nicht der nächsten im Slot.
export type RearmStep =
  | { door: "watch"; body: Record<string, unknown> }
  | { door: "auto"; body: Record<string, unknown>; perpetual: boolean }
  | { skip: string };
export type LaneNow = (slot: number) => { cwd: string; branch: string } | null;
const isWatchTarget = (t: LineageWatchTarget | LineageAutoTarget): t is LineageWatchTarget => "kind" in t;
export const REARM_SPENT = "schon abgelaufen";
export function rearmStepOf(o: LineageObligationRef, now: number, laneNow: LaneNow): RearmStep | null {
  if ((o.kind !== "watch" && o.kind !== "auto") || o.rearmed !== undefined || o.notRearmed !== undefined) return null;
  const t = o.target;
  if (!t) return { skip: "ihr Ziel ist nicht überliefert" };
  if (isWatchTarget(t)) {
    const arm = { ...(t.idleSec !== undefined ? { idleSec: t.idleSec } : {}), ...(t.delivery ? { delivery: t.delivery } : {}) };
    if (t.kind === "audit") return { door: "watch", body: { kind: "audit", repo: t.repo, mainAfter: t.mainAfter, ...arm } };
    if (t.kind === "deploy") return { door: "watch", body: { kind: "deploy", deployId: t.deployId, ...arm } };
    if (t.kind === "job") return { door: "watch", body: { kind: "job", target: t.jobId, ...arm } };
    const lane = laneNow(t.target);
    if (!lane || lane.cwd !== t.targetCwd || lane.branch !== t.targetBranch)
      return { skip: "die Lane läuft dort nicht mehr" };
    return { door: "watch", body: { kind: t.kind, target: t.target, ...arm } };
  }
  if (t.runsLeft <= 0) return { skip: REARM_SPENT };
  if (t.enabled === false) return { skip: "sie war angehalten" };
  const inSec = t.nextAt === undefined ? null : Math.max(1, Math.ceil((t.nextAt - now) / 1000));
  if (t.everySec === null) {
    if (inSec === null) return { skip: "ihr Zeitpunkt ist nicht überliefert" };
    return { door: "auto", body: { text: t.text, everySec: null, idleSec: t.idleSec, inSec }, perpetual: false };
  }
  const perpetual = t.perpetual === true;
  return { door: "auto", perpetual, body: { text: t.text, everySec: t.everySec, idleSec: t.idleSec,
    ...(perpetual ? { perpetual: true } : { runs: t.runsLeft }), ...(inSec !== null ? { inSec } : {}) } };
}

// DER BRIEF SAGT ES IN WORTEN (Mangel 95): was wieder scharf wird, mit Ziel; was nicht, mit Grund; was offen blieb;
// und was die Vorgängerin vorhatte: ihre Absicht steht selbst im Brief (Bauleitung 17.10.: „[Zitat entfernt]“
// ; höchstens LINEAGE_INTENT_MAX Zeichen, der Loader lässt keine längere zu), je Zeile eingerückt, damit
// keine ihrer Zeilen wie ein Schritt „1. …“ aussieht. Gebaut, solange die Vorgängerin noch steht
// (server.ts#succeedGeneric), aus denselben Schritten, die das Binden danach ausführt. Eine abgelaufene Erinnerung
// ist keine Pflicht mehr und steht nicht im Brief, nur im Record.
export interface HandoverFacts {
  obligations: readonly LineageObligationRef[];
  intent: string | null;
  pointer: string | null;
  carry: boolean;
  now: number;
  laneNow: LaneNow;
}
const BRIEF_LIST_MAX = 10;
const durationText = (sec: number): string => {
  if (sec < 60) return `${sec} s`;
  const min = Math.round(sec / 60);
  return min < 120 ? `${min} min` : `${Math.round(min / 60)} h`;
};
const autoPreview = (text: string): string => {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > 80 ? `${one.slice(0, 80)}…` : one;
};
function obligationLabel(o: LineageObligationRef, now: number): string {
  const t = o.target;
  if (!t) return o.kind === "watch" ? `Wache ${o.id}` : `Wiederholung ${o.id}`;
  if (isWatchTarget(t)) {
    if (t.kind === "audit") return `Wache: Audit von main ${t.mainAfter.slice(0, 8)} in ${basename(t.repo)}`;
    if (t.kind === "deploy") return `Wache: Deploy ${t.deployId}`;
    if (t.kind === "job") return `Wache: Helfer-Auftrag ${t.jobId}`;
    return t.kind === "merge" ? `Wache: Merge der Lane ${t.targetBranch} in Slot ${t.target}`
      : `Wache: Lane ${t.targetBranch} in Slot ${t.target} ist fertig`;
  }
  const text = `„${autoPreview(t.text)}“`;
  if (t.everySec === null) {
    const left = t.nextAt === undefined ? null : Math.ceil((t.nextAt - now) / 1000);
    return `Erinnerung${left === null ? "" : left > 0 ? ` in ${durationText(left)}` : ", jetzt fällig"}: ${text}`;
  }
  return `Wiederholung alle ${durationText(t.everySec)}, ${t.perpetual ? "ohne Ende" : `noch ${t.runsLeft} Mal`}: ${text}`;
}
const listed = (rows: string[]): string[] => rows.length <= BRIEF_LIST_MAX ? rows
  : [...rows.slice(0, BRIEF_LIST_MAX), `- … und ${rows.length - BRIEF_LIST_MAX} weitere (GET /api/self, lineage.record)`];
const countText = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
export function handoverLines(f: HandoverFacts): string[] {
  const armed: string[] = [];
  const lost: string[] = [];
  for (const o of f.obligations) {
    const step = rearmStepOf(o, f.now, f.laneNow);
    if (!step) continue;
    if (!("skip" in step)) armed.push(`- ${obligationLabel(o, f.now)}`);
    else if (step.skip !== REARM_SPENT) lost.push(`- ${obligationLabel(o, f.now)} — ${step.skip}`);
  }
  const events = f.obligations.filter((o) => o.kind === "inbox").length;
  const reports = f.obligations.filter((o) => o.kind === "report").length;
  const open = [events ? countText(events, "Ereignis", "Ereignisse") : "", reports ? countText(reports, "Bericht", "Berichte") : ""]
    .filter(Boolean).join(" und ");
  return [
    ...(armed.length ? ["Fleet stellt für dich wieder scharf:", ...listed(armed)]
      : lost.length ? [] : ["Laufende Wachen oder Wiederholungen hatte sie keine."]),
    ...(lost.length ? ["Nicht wieder scharf:", ...listed(lost)] : []),
    ...(open ? [events + reports === 1 ? `Ungelesen geblieben ist ${open} an sie; die Kennung steht in GET /api/self, lineage.record.`
      : `Ungelesen geblieben sind ${open} an sie; die Kennungen stehen in GET /api/self, lineage.record.`] : []),
    ...(f.intent ? ["Was sie vorhatte und was als Nächstes kommt, hat sie dir aufgeschrieben:", ...f.intent.split("\n").map((l) => `  ${l}`)]
      : [f.pointer ? `Was sie vorhatte und was als Nächstes kommt, steht in ${f.pointer}.`
      : f.carry ? "Was sie als Erstes täte, steht am Ende dieses Briefs."
      : "Deine Vorgängerin hat nicht aufgeschrieben, was sie vorhatte und was als Nächstes zu tun ist."]),
  ];
}
export function successionBriefText(steps: readonly string[], carry: string | null, f: HandoverFacts): string {
  return [
    "[fleet succession] Die Vorgängerin ist auf diesem Slot beendet; du übernimmst ihre Arbeit.",
    ...handoverLines(f),
    "Beginne exakt in dieser Reihenfolge:",
    ...steps,
    ...(carry ? ["", "Das Erste, was deine Vorgängerin als Nächstes täte:", carry] : []),
  ].join("\n");
}

// AGENT, MODELL UND EFFORT DER NEUEN SESSION (K16 Runde C, Owner 16.10. 21:1x: „[Zitat entfernt]“
// ), aus dem Body der
// Owner-Tür. Vorgabe sind die bisherigen; wer den Agenten wechselt und Modell oder Effort nicht nennt, bekommt die Vorgabe
// des neuen Agenten (null), nicht das Modell des alten. `current.harness` ist die aufgelöste Kennung (harnessOf(…).id).
// Ob Agent, Modell und Effort zusammenpassen, prüft server.ts mit den Prüfungen des Öffnens (harnessIdOf, modelOf, effortOf).
export interface SpawnPick { harness: string; model: string | null; effort: string | null }
export type SpawnPickInput = { ok: true; pick: SpawnPick; changed: boolean } | { ok: false; error: string };
export function successorSpawnOf(body: Record<string, unknown> | null, current: SpawnPick): SpawnPickInput {
  const field = (k: "harness" | "model" | "effort"): { given: boolean; value: string | null } | null => {
    const v = body?.[k];
    if (v === undefined) return { given: false, value: null };
    if (v === null || typeof v === "string") return { given: true, value: v === null || v.trim() === "" ? null : v.trim() };
    return null;
  };
  const h = field("harness"), m = field("model"), e = field("effort");
  if (!h || !m || !e) return { ok: false, error: "harness, model and effort are strings (or null for the default)" };
  const harness = h.given && h.value !== null ? h.value : current.harness;
  const switched = harness !== current.harness;
  const pick: SpawnPick = { harness, model: m.given ? m.value : switched ? null : current.model,
    effort: e.given ? e.value : switched ? null : current.effort };
  return { ok: true, pick, changed: switched || pick.model !== current.model || pick.effort !== current.effort };
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
export interface Threshold { kind: SessionKind; basePct: number; capPct: number; from: "session" | "env" | "fleet" | "setup" }
// `envPct`: der Env-Wert der Schiene, null = nicht gesetzt; 0 schaltet die Schiene ab (basePct 0).
// `ownPct`: der eigene Wert der Session (HandoverSetting.thresholdPct), null = keiner; 0 = „Aus“ für diese Session
// (K9 S3c, Owner 14.10.: „[Zitat entfernt]“): Basis 0, also weder Hinweis noch Handlung.
// `eigenesSetup`: die Session startete im eigenen Setup (server/eigenes-setup.ts#eigenesSetup). Dort ist die Übergabe aus, bis
// die Tür eine Schwelle wählt (Slot 16 für den Owner, 24.10.: „[Zitat entfernt]“) — kein Hinweis in die Pane.
export function thresholdOf(kind: SessionKind, envPct: number | null, ownPct: number | null, eigenesSetup = false): Threshold {
  const env = kind === "orchestrator" ? null : envPct;
  const basePct = ownPct ?? (eigenesSetup ? 0 : env ?? FLEET_BASE_PCT[kind]);
  return { kind, basePct, capPct: basePct > 0 ? basePct + CAP_GAP_PCT : 0,
    from: ownPct !== null ? "session" : eigenesSetup ? "setup" : env !== null ? "env" : "fleet" };
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
// Was Fleet tut, wenn die Handlung fällig ist. Eine Lane wählt nur Hinweis oder Compact, denn sie gibt mit
// ihrem eigenen handoff-Report weiter, und die Owner-Tür verweigert sie.
export type ThresholdChoice = "hint" | "compact" | "succeed";
export function choicesFor(kind: SessionKind): readonly ThresholdChoice[] {
  return kind === "lane" ? ["hint", "compact"] : ["hint", "compact", "succeed"];
}
// DER FLEET-WERT: NUR DER HINWEIS, für jede Art (Owner 07.08.: „[Zitat entfernt]“
// ; 18.10., Z132: „[Zitat entfernt]“ auf „[Zitat entfernt]“
// ). Fleet stößt an, die Session gibt selbst weiter. Bis zum Rückfall-Umbau (befunde/23, Vorschlag „[Zitat entfernt]“
// ) ersetzt Fleet eine Session nur, wenn sie oder der Owner „[Zitat entfernt]“ ausdrücklich wählt; Compact ebenso.
export function fleetChoiceOf(_kind: SessionKind): ThresholdChoice {
  return "hint";
}
// CLAUDE CODES EIGENE KOMPAKTIERUNG IST DER RÜCKFALL, wo Fleet an der Obergrenze nicht selbst handelt (Bauleitung 18.10.,
// Option b): aus nur bei einer Schwelle über 0 UND einer Wahl, mit der Fleet dort handelt (succeed, compact). Bei „hint“
// bleibt sie an, sonst liefe eine Session, die den einen Hinweis überhört, bis ans Fensterende. Gelesen beim Start der
// Session (server.ts#ensureSlot, session-start.ts#startAspects): eine laufende Session behält ihre Startzeile.
export function autoCompactOff(basePct: number, choice: ThresholdChoice): boolean {
  return basePct > 0 && choice !== "hint";
}
// null = der Fleet-Wert, er wird nicht gespeichert; jede andere Wahl, auch „hint“, gilt nur für diese Session
export type ChoiceInput = { ok: true; choice: ThresholdChoice | null } | { ok: false; refusal: "bad-at-threshold" | "lane-succeed" };
export function choiceInput(v: unknown, kind: SessionKind): ChoiceInput {
  if (v === null) return { ok: true, choice: null };
  if (v !== "hint" && v !== "compact" && v !== "succeed") return { ok: false, refusal: "bad-at-threshold" };
  if (!choicesFor(kind).includes(v)) return { ok: false, refusal: "lane-succeed" };
  return { ok: true, choice: v };
}

// DIE HANDLUNG (S3b, §4): Fleet handelt nur an einer RUHENDEN Session, nie mitten im Turn, und erst nachdem
// der Hinweis angekommen ist, der die Handlung nennt und um die stehende Übergabe bittet — es sei denn, der
// Owner hat den Hinweis für diese Session abgeschaltet. Je Gespräch höchstens eine Handlung je `retryMs`.
// KALT (K16 Runde C, Owner 16.10. 21:1x: „[Zitat entfernt]“): Unter der
// Obergrenze handelt Fleet an einer kalten Session nicht selbst, die Ansicht bietet „[Zitat entfernt]“ an
// (`cold-offer`). An der Obergrenze bleibt die Notbremse; ist der Cache dort kalt, entfällt nur ihr Vorab-Hinweis.
export interface ActFacts { choice: ThresholdChoice; step: ThresholdStep; resting: boolean; hinted: boolean; hintOn: boolean;
  cold: boolean; atCap: boolean; actedAt: number | null; retryMs: number; now: number }
export type ActReason = "choice-hint" | "not-due" | "cold-offer" | "hint-first" | "acted" | "working" | "due";
export interface ActDecision { act: "compact" | "succeed" | null; reason: ActReason }
export function actDecision(f: ActFacts): ActDecision {
  const no = (reason: ActReason): ActDecision => ({ act: null, reason });
  if (f.choice === "hint") return no("choice-hint");
  if (f.step !== "due") return no("not-due");
  if (f.cold && !f.atCap) return no("cold-offer");
  if (f.hintOn && !f.hinted && !f.cold) return no("hint-first");
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
// `pct`: der Füllstand, bei dem der letzte angekommene Hinweis geschrieben wurde (die Übergabe-Ansicht nennt ihn)
// EINMAL (K16 Runde C, Owner 16.10. 19:3x: „[Zitat entfernt]“; 21:1x: „[Zitat entfernt]“
// ): ein Hinweis je Gespräch, und keiner in eine kalte
// Session (`due` mit cache „kalt“), denn der läse den ganzen Kontext neu.
export const MAX_NUDGES = 1;
export interface HintAttempt { sessionId: string; nudges: number; lastAt: number; gaveUp: boolean; pct?: number }
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
  due(slot: number, sessionId: string, step: ThresholdStep, now: number, cache: CacheState): boolean {
    if (step === "below" || cache === "kalt" || this.pending.has(`${slot}:${sessionId}`)) return false;
    const a = this.of(slot, sessionId);
    if (!a) return true;
    if (a.gaveUp || a.nudges >= this.max) return false;
    if (a.lastAt && now - a.lastAt < this.cooldownMs) return false;
    return step === "due" || a.nudges === 0;
  }
  claim(slot: number, sessionId: string, step: ThresholdStep, now: number, cache: CacheState): HintClaim | null {
    if (!this.due(slot, sessionId, step, now, cache)) return null;
    this.pending.add(`${slot}:${sessionId}`);
    const a = this.of(slot, sessionId);
    return { slot, attempt: a ? { ...a } : { sessionId, nudges: 0, lastAt: 0, gaveUp: false } };
  }
  // angekommen: gezählt; `gaveUp` sagt, ob damit das Budget dieses Gesprächs erschöpft ist
  delivered(c: HintClaim, at: number, pct?: number): { nudges: number; gaveUp: boolean } {
    const a = { ...(this.of(c.slot, c.attempt.sessionId) ?? c.attempt) };
    a.nudges++;
    a.lastAt = at;
    if (pct !== undefined) a.pct = pct;
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

// DER HINWEIS, ein Text je Wahl (S3; Fleet-Wert seit S3b-2: neue Session, die Lane nur Hinweis). Er nennt
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
  // DIE SESSION GIBT SELBST WEITER (Owner 07.08.: „[Zitat entfernt]“; 18.10.: die
  // Session ruft die Übergabe auf, nicht das System): Fleets neue Session ist nur der Rückfall
  if (f.choice === "succeed")
    return `${head}Gib selbst weiter: Schreib jetzt ${handover} und halte sie aktuell; am Ende deines laufenden Schritts, `
      + `wenn nichts mehr läuft, rufst du POST /api/self/succeed (ohne Body nimmt sie deine stehende Übergabe). `
      + `Nur wenn du das nicht tust, öffnet Fleet ${f.threshold.capPct > f.fillPct ? `ab ${f.threshold.capPct} %` : "jetzt"} `
      + `oder kurz bevor dein Cache kalt wird selbst eine neue Session, sobald du ruhst.`;
  const opening = `${head}Fleet übergibt nicht selbst, du wählst den Punkt`;
  if (lane)
    return `${opening}: Bring den laufenden Schnitt zu Ende und committe, file einen fleet-report mit status \`handoff\` `
      + `und gib dann mit POST /api/self/succeed (${token}) an eine frische Session auf diesem Worktree weiter.`;
  return `${opening}. Schreib eine stehende Übergabe (POST /api/self/handover, \`intent\` ODER \`pointer\`) und halte sie `
    + "aktuell: Mit ihr öffnet der Owner jederzeit eine neue Session, ohne dir einen Turn zu schicken. "
    + `Am Ende eines Schritts gibst du selbst weiter: POST /api/self/succeed. Beide Türen nehmen den ${token}.`;
}

// DIE KONTEXT-ZEILE DER ORCHESTRATORIN (S3c; Bauleitung 14.10.: „[Zitat entfernt]“ auf 45/50
// umschreiben). Ihre Rollenkarte nennt die Zeile der Tabelle, aus der sie kommt, statt einer zweiten Zahl:
// Hinweis an der Basis, Übergabe an der Obergrenze, solange der Cache warm ist. ASCII wie die übrige Karte.
export function orchestratorContextLine(t: Threshold): string {
  return `--- KONTEXT --- Ab ${t.basePct} % schreibt Fleet dir einen Hinweis; bis ${t.capPct} % arbeitest du weiter, solange dein Cache `
    + `warm ist, und waehlst den Punkt der Uebergabe selbst. Deine Werte stehen in GET /api/self -> context.`;
}
