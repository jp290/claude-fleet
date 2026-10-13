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
