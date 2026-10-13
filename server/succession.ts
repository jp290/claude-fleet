// Neuaufbau K9 · Session-Nachfolge (docs/neuaufbau/befunde/07-nachfolge.md, S1). Owner 13.10.: „[Zitat entfernt]“
// , „[Zitat entfernt]“. Bauleitung 13.10.:
// Die Einstellung einer Session gilt für die ganze Linie im Slot (Frage 2, Standard Ja).
//
// Reine Logik: kein tmux, kein Spawn, kein Server-Zustand. server.ts hält die Slots und ruft diese
// Funktionen dort, wo eine Besetzung geht und die nächste im selben Slot kommt (respawnInPlace für die
// generische und die Program-Schiene beider Türen, restartLaneSession für die Lane), und dort, wo die
// Owner-Tür ihre Vorschau liest (ownerSucceedPreview).
import type { HandoverSetting } from "./types";

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
