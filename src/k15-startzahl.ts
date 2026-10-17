// K15 · DIE ZAHL EINES STARTS (Bauleitung f6edd1e7, Punkt 1: „Zahl oben aus der Aufschlüsselung + Datei-Ort, CLAUDE_CODE_MESSUNG nur als
// Rückfall ohne Quelle … zwei Zahlen, die sich widersprechen, sieht der Owner sofort“). Eine Rechnung für den Satz oben in „[Zitat entfernt]“,
// die Summe unten und „[Zitat entfernt]“ der Agent-MD: Claude Codes Teil wie der Ort „[Zitat entfernt]“ (aufgeschlüsselt, mit dem, was
// Fleet dort anhängt) plus seine Dateien (die globalen Regeln im Ort „Dateien“); ohne gemessene Quelle die feste Messung des Servers.
// Fleets Teil ohne die Dateien des Repos (wie k15-anbindung.ts#fleetTeil); die Dateien des Repos für sich, wo der Server sie misst, ohne die
// globalen Regeln: die misst er dort mit (server.ts#nativeLoaderBytes besucht die Config-CLAUDE.md zuerst), gezählt sind sie bei Claude Code.
// EINE Regel an EINER Stelle (Bauleitung 2a2ec0d0): server.ts#startSumme rechnet `tokens` mit startZahlVon, das Fenster mit startZahl
// über dieselbe Funktion. Darum hängt diese Datei nur an reinen Modulen, die der Server laden kann, auch ohne `import type` aus
// ./founding: server/deploy-classify.ts liest jeden Import als Kante, und founding zöge das Fenster in den Server.
import { anatomieVon, gruppenBytes, jeToken, zaehltMit } from "./k15-anatomie";

export const NATIV_ID = "native-agents";
export interface StartZahl {
  tokens: number;
  claudeCode: { tokens: number; wie: "aufgeschlüsselt" | "gemessen" } | null;
  fleet: number;
  // null: die Tür liefert die Dateien des Repos, gemessen sind sie nicht (mit Rolle); 0: es liefert sie keiner
  repo: number | null;
}
// was der Server beim Rechnen in der Hand hat: die Bausteine des Plans, was die Tür liefert, Claude Codes Zeilen, Fleets Bytes
export interface StartZahlEingang {
  bausteine: readonly { id: string; bytes: number | "unknown"; details?: unknown }[];
  geliefert: readonly { id: string }[];
  claudeCode: { zeilen: readonly { weg: string; bytes: number | "unknown"; details?: unknown }[]; messung: { tokens: number; gilt: boolean } } | null;
  fleetBytes: number;
  bytesJeToken: number;
}
const dateienVon = (details: unknown): { pfad: string; bytes: number }[] => {
  const d = (details as { dateien?: unknown } | null | undefined)?.dateien;
  return Array.isArray(d) ? d.filter((x): x is { pfad: string; bytes: number } => typeof x?.pfad === "string" && typeof x?.bytes === "number") : [];
};
export function startZahlVon(e: StartZahlEingang): StartZahl {
  const w = e.bytesJeToken;
  const cca = anatomieVon(e.claudeCode);
  const eigene = (e.claudeCode?.zeilen ?? []).filter((z) => z.weg === "native Datei");
  const dateien = eigene.reduce((n, z) => n + (typeof z.bytes === "number" ? z.bytes : 0), 0);
  const mess = e.claudeCode?.messung;
  const claudeCode = cca?.quelle
    ? { tokens: Math.round(cca.gruppen.filter(zaehltMit).reduce((n, g) => n + gruppenBytes(g).bytes, 0) / jeToken(cca) + dateien / w), wie: "aufgeschlüsselt" as const }
    : mess?.gilt ? { tokens: mess.tokens, wie: "gemessen" as const } : null;
  const nativ = e.bausteine.find((b) => b.id === NATIV_ID);
  const geliefert = e.geliefert.some((x) => x.id === NATIV_ID);
  const nativB = nativ && geliefert && typeof nativ.bytes === "number" ? nativ.bytes : 0;
  const fleet = Math.round((e.fleetBytes - nativB) / w);
  const schonGezaehlt = new Set(eigene.flatMap((z) => dateienVon(z.details).map((d) => d.pfad)));
  const doppelt = nativ ? dateienVon(nativ.details).filter((d) => schonGezaehlt.has(d.pfad)).reduce((n, d) => n + d.bytes, 0) : 0;
  const repo = !nativ || !geliefert ? 0 : typeof nativ.bytes === "number" ? Math.round((nativ.bytes - doppelt) / w) : null;
  return { tokens: (claudeCode?.tokens ?? 0) + fleet + (repo ?? 0), claudeCode, fleet, repo };
}
// die Antwort des Gründungsplans (founding.ts#Answer), so weit die Zahl sie braucht
export interface StartZahlAntwort {
  plan: { bausteine: StartZahlEingang["bausteine"] };
  lieferung?: { geliefert: readonly { id: string }[] };
  claudeCode?: StartZahlEingang["claudeCode"];
  startSumme?: { fleetBytes: number; bytesJeToken: { wert: number } };
}
export function startZahl(a: StartZahlAntwort): StartZahl | null {
  const s = a.startSumme;
  return s ? startZahlVon({ bausteine: a.plan.bausteine, geliefert: a.lieferung?.geliefert ?? [], claudeCode: a.claudeCode ?? null,
    fleetBytes: s.fleetBytes, bytesJeToken: s.bytesJeToken.wert }) : null;
}
// eine Summe ganzer Tokens auf Teile nach ihren Bytes verteilt, sodass die Teile die Summe ergeben (Runde 4, Punkt 0: die Gruppen unter
// der Summe des Gründungsfensters): jeder Teil abgerundet, der Rest einzeln an die größten Nachkomma-Anteile, bei Gleichstand an den früheren
export function verteile(gesamt: number, anteile: readonly number[]): number[] {
  const summe = anteile.reduce((n, x) => n + x, 0);
  if (summe === 0) return anteile.map(() => 0);
  const genau = anteile.map((x) => (x / summe) * gesamt);
  const teile = genau.map(Math.floor);
  const rest = gesamt - teile.reduce((n, x) => n + x, 0);
  genau.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((p, q) => q.r - p.r || p.i - q.i).slice(0, rest).forEach(({ i }) => { teile[i]! += 1; });
  return teile;
}
