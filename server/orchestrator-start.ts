// DER START DER ORCHESTRATORIN — Richtung, Rolle, Systemkonzept und fünf Packs, mehr nicht.
//
// Der Owner will, dass sie mit einem kleinen, lesbaren Setup startet statt mit Rollenkarte, Box und
// Rollen-Render (TASK.md, Runde 1; vierte Fassung, Runde 4). Die acht Texte liegen im Repo und
// gehören ihrem Autor: dieses Modul liest sie, es schreibt keinen Wortlaut um. Spawn, Nachfolge und
// Fassung rufen dieselbe Lesefunktion, damit „was du siehst“ und „was startet“ dieselben Bytes sind.
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Der erste Startteil: die Richtung, in der die Orchestratorin arbeitet. */
export const ORCHESTRATOR_DIRECTION_PATH = "docs/start/direction.md";
export const ORCHESTRATOR_ROLE_PATH = "docs/start/orchestrator.md";
export const ORCHESTRATOR_START_PATH = "docs/start/system-concept.md";
/** die fünf Packs, die mit dem Start kommen; `writing-for-agents` bleibt ein Verweis der Rolle */
export const ORCHESTRATOR_PACK_PATHS = [
  "docs/packs/setting-up-agents.md",
  "docs/packs/working-with-the-owner.md",
  "docs/packs/how-fleet-remembers.md",
  "docs/packs/working-toward-a-goal.md",
  "docs/packs/who-it-is-for.md",
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
  /** die Summe der acht Dateien — die Zahl, die der Owner mit `wc -c` gemessen hat */
  readonly bytes: number;
}

export interface OrchestratorStartTeile {
  readonly direction: OrchestratorStartDatei | null;
  readonly rolle: OrchestratorStartDatei | null;
  readonly start: OrchestratorStartDatei | null;
  readonly packs: readonly (OrchestratorStartDatei | null)[];
  /** warum eine Datei fehlt; leer = alle acht sind gelesen */
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

/** Die acht Texte in ihrer Ordnung, die fehlenden ausgelassen (für Fassung und Beleg). */
export function orchestratorStartDateien(teile: OrchestratorStartTeile): readonly OrchestratorStartDatei[] {
  return [teile.direction, teile.rolle, teile.start, ...teile.packs]
    .filter((datei): datei is OrchestratorStartDatei => datei !== null);
}

/** Die acht Texte einzeln, mit den fehlenden als `null` und ihrem Grund — nie eine leere Zeile. */
export function readOrchestratorStartParts(repoRoot: string): OrchestratorStartTeile {
  const direction = lese(repoRoot, "direction", ORCHESTRATOR_DIRECTION_PATH);
  const rolle = lese(repoRoot, "rolle", ORCHESTRATOR_ROLE_PATH);
  const start = lese(repoRoot, "start", ORCHESTRATOR_START_PATH);
  const packs = ORCHESTRATOR_PACK_PATHS.map((pfad, index) => lese(repoRoot, `pack-${index + 1}`, pfad));
  const fehlt: string[] = [];
  if (!direction) fehlt.push(ORCHESTRATOR_DIRECTION_PATH);
  if (!rolle) fehlt.push(ORCHESTRATOR_ROLE_PATH);
  if (!start) fehlt.push(ORCHESTRATOR_START_PATH);
  for (const [index, pack] of packs.entries()) if (!pack) fehlt.push(ORCHESTRATOR_PACK_PATHS[index]!);
  return { direction, rolle, start, packs, fehlt };
}

/** Die acht Texte ganz, oder der Grund, warum dieser Start nicht aus ihnen gebaut werden kann. */
export function readOrchestratorStart(repoRoot: string):
  { readonly ok: true; readonly value: OrchestratorStart } | { readonly ok: false; readonly error: string } {
  const teile = readOrchestratorStartParts(repoRoot);
  if (!teile.direction || !teile.rolle || !teile.start || teile.packs.some((pack) => pack === null))
    return { ok: false, error: `der Start der Orchestratorin ist nicht vollständig: ${teile.fehlt.join(", ")}` };
  const packs = teile.packs as readonly OrchestratorStartDatei[];
  return { ok: true, value: { direction: teile.direction, rolle: teile.rolle, start: teile.start, packs,
    bytes: [teile.direction, teile.rolle, teile.start, ...packs].reduce((sum, datei) => sum + datei.bytes, 0) } };
}

/** Der Text, den die Session bekommt: die acht Dateien in ihrer Ordnung, durch eine Leerzeile getrennt. */
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
  const fehlt = teile.fehlt.length ? `--- FEHLT --- ${teile.fehlt.join(", ")} (nicht lesbar in diesem Baum)` : "";
  return [...orchestratorStartDateien(teile).map((datei) => datei.text), ...(fehlt ? [fehlt] : [])].join("\n\n");
}
