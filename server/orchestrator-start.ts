// DER START DER ORCHESTRATORIN — Richtung, Rolle, Systemkonzept und fünf Packs, mehr nicht.
//
// Der Owner will, dass sie mit einem kleinen, lesbaren Setup startet statt mit Rollenkarte, Box und
// Rollen-Render (TASK.md, Runde 1; vierte Fassung, Runde 4). Die acht Texte liegen im Repo und
// gehören ihrem Autor: dieses Modul liest sie, es schreibt keinen Wortlaut um. Spawn, Nachfolge und
// Fassung rufen dieselbe Lesefunktion, damit „was du siehst“ und „was startet“ dieselben Bytes sind.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { liesEigenePacks, PRIVATER_OWNER_PACK_ID } from "./eigene-packs";

/** Der erste Startteil: die Richtung, in der die Orchestratorin arbeitet. */
export const ORCHESTRATOR_DIRECTION_PATH = "docs/start/direction.md";
export const ORCHESTRATOR_ROLE_PATH = "docs/start/orchestrator.md";
export const ORCHESTRATOR_START_PATH = "docs/start/system-concept.md";
/** die fünf allgemeinen Packs aus dem Repo; `writing-for-agents` bleibt ein Verweis der Rolle. Der private Teil des Owners
 *  (working-with-this-owner) liegt NICHT hier: die Orchestratorin schreibt ihn selbst durch POST /api/self/packs in Fleet's
 *  Zustandsordner, und ihr Start liest ihn dort, wenn er existiert (owner 26.10.). */
export const ORCHESTRATOR_PACK_PATHS = [
  "docs/packs/setting-up-agents.md",
  "docs/packs/working-with-the-owner.md",
  "docs/packs/how-fleet-remembers.md",
  "docs/packs/who-it-is-for.md",
  "docs/packs/sharpening-an-order.md",
] as const;

export interface OrchestratorStartDatei {
  readonly id: string;
  readonly pfad: string;
  readonly text: string;
  readonly bytes: number;
}

export interface OrchestratorStart {
  readonly direction: OrchestratorStartDatei;
  readonly rolle: OrchestratorStartDatei;
  readonly start: OrchestratorStartDatei;
  readonly packs: readonly OrchestratorStartDatei[];
  /** die Summe aller Startdateien — die Zahl, die der Owner mit `wc -c` gemessen hat */
  readonly bytes: number;
}

export interface OrchestratorStartTeile {
  readonly direction: OrchestratorStartDatei | null;
  readonly rolle: OrchestratorStartDatei | null;
  readonly start: OrchestratorStartDatei | null;
  /** the five general packs, then the owner's private pack when it exists (never null for the private one) */
  readonly packs: readonly (OrchestratorStartDatei | null)[];
  /** warum eine Datei fehlt; leer = direction, role, system concept and the five general packs are read. A missing private pack is
   *  not a gap: without it the start is complete and says nothing is missing (owner 26.10.). */
  readonly fehlt: readonly string[];
}

function lese(repoRoot: string, id: string, pfad: string): OrchestratorStartDatei | null {
  try {
    const text = readFileSync(join(repoRoot, pfad), "utf8");
    return { id, pfad, text, bytes: Buffer.byteLength(text) };
  } catch {
    return null;
  }
}

/** Die Texte in ihrer Ordnung, die fehlenden ausgelassen (für Fassung und Beleg). */
export function orchestratorStartDateien(teile: OrchestratorStartTeile): readonly OrchestratorStartDatei[] {
  return [teile.direction, teile.rolle, teile.start, ...teile.packs]
    .filter((datei): datei is OrchestratorStartDatei => datei !== null);
}

/** DER PRIVATE PACK DES OWNERS, wenn er in Fleet's Zustand liegt (owner 26.10.: der persönliche Teil wird nicht veröffentlicht,
 *  die Orchestratorin bekommt ihn aber weiter). Ein fehlender oder unlesbarer Pack ist keine Lücke und wird nicht als `fehlt` gemeldet. */
function privaterOwnerPack(stateDir: string | null | undefined): OrchestratorStartDatei | null {
  if (!stateDir) return null;
  const pack = liesEigenePacks(stateDir).find((eigen) => eigen.id === PRIVATER_OWNER_PACK_ID);
  return pack ? { id: "pack-owner", pfad: pack.pfad, text: pack.text, bytes: pack.bytes } : null;
}

/** Die Texte einzeln, mit den fehlenden als `null` und ihrem Grund — nie eine leere Zeile. `stateDir` adds the owner's private
 *  pack when it exists there; without it the start is exactly the repo texts (owner 26.10.). */
export function readOrchestratorStartParts(repoRoot: string, stateDir: string | null = null): OrchestratorStartTeile {
  const direction = lese(repoRoot, "direction", ORCHESTRATOR_DIRECTION_PATH);
  const rolle = lese(repoRoot, "rolle", ORCHESTRATOR_ROLE_PATH);
  const start = lese(repoRoot, "start", ORCHESTRATOR_START_PATH);
  const allgemein = ORCHESTRATOR_PACK_PATHS.map((pfad, index) => lese(repoRoot, `pack-${index + 1}`, pfad));
  const privat = privaterOwnerPack(stateDir), packs = [...allgemein, ...(privat ? [privat] : [])];
  const fehlt: string[] = [];
  if (!direction) fehlt.push(ORCHESTRATOR_DIRECTION_PATH);
  if (!rolle) fehlt.push(ORCHESTRATOR_ROLE_PATH);
  if (!start) fehlt.push(ORCHESTRATOR_START_PATH);
  for (const [index, pack] of allgemein.entries()) if (!pack) fehlt.push(ORCHESTRATOR_PACK_PATHS[index]!);
  return { direction, rolle, start, packs, fehlt };
}

/** Die Texte ganz, oder der Grund, warum dieser Start nicht aus ihnen gebaut werden kann. */
export function readOrchestratorStart(repoRoot: string, stateDir: string | null = null):
  { readonly ok: true; readonly value: OrchestratorStart } | { readonly ok: false; readonly error: string } {
  const teile = readOrchestratorStartParts(repoRoot, stateDir);
  if (!teile.direction || !teile.rolle || !teile.start || teile.packs.some((pack) => pack === null))
    return { ok: false, error: `der Start der Orchestratorin ist nicht vollständig: ${teile.fehlt.join(", ")}` };
  const packs = teile.packs as readonly OrchestratorStartDatei[];
  return { ok: true, value: { direction: teile.direction, rolle: teile.rolle, start: teile.start, packs,
    bytes: [teile.direction, teile.rolle, teile.start, ...packs].reduce((sum, datei) => sum + datei.bytes, 0) } };
}

/** Der Text, den die Session bekommt: alle Startdateien in ihrer Ordnung, durch eine Leerzeile getrennt. */
export function renderOrchestratorStart(start: OrchestratorStart): string {
  return [start.direction.text, start.rolle.text, start.start.text, ...start.packs.map((pack) => pack.text)].join("\n\n");
}

/** Der erste fette Satz der Rolle — der Satz, der in der Fassung unter „Aufgabe“ steht. */
export function orchestratorRoleSentence(roleText: string): string {
  const line = roleText.split("\n").find((entry) => /^\*\*.+\*\*$/.test(entry.trim()));
  return (line ?? roleText.split("\n").find((entry) => entry.trim() && !entry.startsWith("#")) ?? "").trim().replace(/^\*\*|\*\*$/g, "");
}

/** Eine Markdown-Überschrift der Rolle, von ihrer Zeile bis zur nächsten Überschrift gleicher oder höherer Ebene. */
export function orchestratorRoleSection(roleText: string, heading: string): string {
  const lines = roleText.split("\n");
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) return "";
  const level = (heading.match(/^#+/) ?? [""])[0]!.length;
  let end = start + 1;
  while (end < lines.length) {
    const hit = /^(#{1,6})\s/.exec(lines[end]!);
    if (hit && hit[1]!.length <= level) break;
    end++;
  }
  return lines.slice(start, end).join("\n").trim();
}

/** Was unter „Arbeitet mit, endet“ steht: der Abschnitt der Rolle, der die Übergabe beschreibt. */
export function orchestratorWorkEnds(roleText: string): string {
  return orchestratorRoleSection(roleText, "## Handing over");
}

/** Der Start auch dann, wenn eine Quelle fehlt: die gelesenen Texte und EINE Zeile, die die Lücke nennt. */
export function renderOrchestratorStartParts(teile: OrchestratorStartTeile): string {
  const fehlt = teile.fehlt.length ? `--- MISSING --- ${teile.fehlt.join(", ")} (not readable in this tree)` : "";
  return [...orchestratorStartDateien(teile).map((datei) => datei.text), ...(fehlt ? [fehlt] : [])].join("\n\n");
}
