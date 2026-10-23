// EIN SITZ IM EIGENEN SETUP (Owner 23.10. ~22:00: „[Zitat entfernt]“
// ). Ein Claude-Sitz ohne stehende Rolle, dessen Ordner nicht zu Fleets Repo gehört (server.ts#fleetBaumVon),
// startet wie ein `claude`, das sein Nutzer im selben Ordner von Hand startet. Fleet legt nur dazu, was es selbst braucht: die Pane,
// den PATH, `--session-id`/`--resume` und `FLEET_SELF_*`. Modell, Effort, Rechte, Bibliothek, Profil und Fernsteuerung kommen nur
// auf die Zeile, wenn sie am Sitz gewählt sind. Kein Listenschnitt, kein erzwungener permission-mode, keine Rollenzuschnitte
// (--tools, Notizbuch-Umleitung, Excludes). Sitze in Fleets eigenem Repo, Lanes und die Orchestratorin bleiben, wie sie sind.
//
// DER LISTENSCHNITT IST DIE LISTE DES OWNERS (Karte 3eddb803): Namen von seiner Maschine, darum nicht mehr in server.ts, sondern in der
// lokalen Bindung, gelesen wie Fleets andere lokale Dateien (`~/.config/claude-fleet/…`, Pfad über FLEET_LIST_CUT_FILE). Wer die Datei
// nicht hat, bekommt keinen Schnitt.
import { existsSync, readFileSync } from "node:fs";
import { lstat } from "node:fs/promises";
import type { ClaudeStartRole } from "./session-start";

export type SessionListRole = "lane" | "main" | "orchestrator";
export type SessionListFrom = "user-command" | "fleet-command" | "synced-skill" | "bundled" | "user-agent";
export interface ListCutEntry { readonly name: string; readonly from: SessionListFrom; readonly keep?: readonly SessionListRole[] }

const FROM: readonly SessionListFrom[] = ["user-command", "fleet-command", "synced-skill", "bundled", "user-agent"];
const ROLES: readonly SessionListRole[] = ["lane", "main", "orchestrator"];
// der Name landet in --settings (JSON), in `--disallowedTools 'Agent(<name>)'` und in einer Zeile am Systemprompt: nur dieser Zeichensatz
export const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,79}$/;

/** Die Einträge einer Bindungsdatei, oder der Grund, warum sie keine sind. Rein. */
export function listCutFrom(raw: unknown): { ok: true; entries: ListCutEntry[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "the list cut is no JSON array" };
  const entries: ListCutEntry[] = [];
  for (const [i, e] of raw.entries()) {
    const r = typeof e === "object" && e !== null ? e as Record<string, unknown> : null;
    if (!r || typeof r.name !== "string" || !NAME_RE.test(r.name)) return { ok: false, error: `entry ${i}: name missing or outside the charset` };
    if (typeof r.from !== "string" || !FROM.includes(r.from as SessionListFrom)) return { ok: false, error: `entry ${i}: from must be one of ${FROM.join(", ")}` };
    if (r.keep !== undefined && !(Array.isArray(r.keep) && r.keep.every((k) => typeof k === "string" && ROLES.includes(k as SessionListRole))))
      return { ok: false, error: `entry ${i}: keep must list roles of ${ROLES.join(", ")}` };
    entries.push({ name: r.name, from: r.from as SessionListFrom, ...(r.keep ? { keep: r.keep as SessionListRole[] } : {}) });
  }
  return { ok: true, entries };
}

/** Die Bindungsdatei, bei jedem Aufruf neu gelesen (ein Eintrag kommt ohne Neustart zurück). Keine Datei = kein Schnitt;
 *  eine kaputte Datei = kein Schnitt und ihr Grund in `error`. */
export function readListCut(path: string): { entries: ListCutEntry[]; error: string | null } {
  if (!existsSync(path)) return { entries: [], error: null };
  try {
    const got = listCutFrom(JSON.parse(readFileSync(path, "utf8")));
    return got.ok ? { entries: got.entries, error: null } : { entries: [], error: `${path}: ${got.error}` };
  } catch (e) {
    return { entries: [], error: `${path}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Startet dieser Spawn im eigenen Setup? Nur Claude, nur ein Sitz ohne stehende Rolle, nur außerhalb von Fleets Repo. Rein. */
export function eigenesSetup(f: { claude: boolean; role: ClaudeStartRole | null; fleetRepo: boolean }): boolean {
  return f.claude && f.role === "generic" && !f.fleetRepo;
}

// WAS FLEET IM EIGENEN SETUP NOCH SETZT, je Flag mit Grund: die Setup-Ansicht zeigt genau diese Zeilen (server.ts#fassungFleetStart)
export const EIGENES_SETUP_MINIMUM: readonly { readonly was: string; readonly warum: string }[] = [
  { was: "eine Terminal-Pane in deinem Ordner (tmux), mit dem PATH des Fleet-Servers", warum: "damit Fleet die Sitzung zeigen, am Leben halten und `claude` finden kann" },
  { was: "--session-id bzw. --resume", warum: "über diese ID findet Fleet das Gespräch wieder, misst den Füllstand und setzt es nach einem Neustart fort" },
  { was: "FLEET_SELF_TOKEN, FLEET_SELF_SLOT, FLEET_SELF_URL in der Umgebung", warum: "der Ausweis der Sitzung bei Fleet: Postfach, Übergabe und Rückmeldungen" },
];
export const EIGENES_SETUP_SATZ = "Eigenes Setup: Diese Sitzung startet wie `claude`, das du in diesem Ordner selbst startest — mit deinen "
  + "Einstellungen, Skills, Agenten, Regeln und MCP-Servern. Fleet nimmt nichts weg und legt nur das Folgende dazu.";

/** DIE GITIGNORIERTEN DATEIEN EINES WORKTREES nach Claude Codes `.worktreeinclude` (code.claude.com/docs/en/worktrees, „Copy gitignored
 *  files into worktrees“): `.gitignore`-Syntax, kopiert wird nur, was ein Muster trifft UND gitignoriert ist. null = das Repo hat keine
 *  `.worktreeinclude`; Pfade relativ zum Repo. */
export async function worktreeIncludeFiles(root: string): Promise<string[] | null> {
  if (!existsSync(`${root}/.worktreeinclude`)) return null;
  const run = async (args: string[], stdin?: string): Promise<{ code: number; out: string }> => {
    const p = Bun.spawn(["git", "-C", root, ...args], { stdin: stdin === undefined ? "ignore" : new TextEncoder().encode(stdin), stdout: "pipe", stderr: "ignore" });
    const [out, code] = await Promise.all([new Response(p.stdout).text(), p.exited]);
    return { code, out };
  };
  const matched = await run(["ls-files", "--others", "--ignored", "-z", `--exclude-from=${root}/.worktreeinclude`]);
  const candidates = matched.code === 0 ? matched.out.split("\0").filter(Boolean) : [];
  if (!candidates.length) return [];
  // check-ignore: exit 0 = at least one is ignored, 1 = none
  const ignored = await run(["check-ignore", "--stdin", "-z"], `${candidates.join("\0")}\0`);
  return ignored.code === 0 ? ignored.out.split("\0").filter(Boolean) : [];
}

/** KOPIERT DIE DATEIEN VON `.worktreeinclude` in einen Worktree wie `cp -a`: Modus, Zeiten und Symlinks bleiben (ein Link wird nicht
 *  aufgelöst, auch nicht einer aus dem Repo hinaus), was im Worktree schon liegt, bleibt. Ein eigener Prozess (tar | tar), damit ein
 *  node_modules mit 10⁴ Dateien den Server nicht anhält; der Start wartet auf das Ergebnis. COPYFILE_DISABLE: macOS' tar legt sonst
 *  ._-Dateien für erweiterte Attribute dazu. Gibt zurück, wie viele Pfade kopiert wurden. */
export async function kopiereWorktreeInclude(root: string, ziel: string, dateien: readonly string[]): Promise<number> {
  const fehlt = (await Promise.all(dateien.map((f) => lstat(`${ziel}/${f}`).then(() => null, () => f)))).filter((f): f is string => f !== null);
  if (!fehlt.length) return 0;
  const env = { ...process.env, COPYFILE_DISABLE: "1" };
  const pack = Bun.spawn(["tar", "-c", "-f", "-", "--null", "-T", "-"], { cwd: root, env,
    stdin: new TextEncoder().encode(`${fehlt.join("\0")}\0`), stdout: "pipe", stderr: "pipe" });
  const aus = Bun.spawn(["tar", "-x", "-p", "-f", "-"], { cwd: ziel, env, stdin: pack.stdout, stdout: "ignore", stderr: "pipe" });
  const [a, b, fa, fb] = await Promise.all([pack.exited, aus.exited, new Response(pack.stderr).text(), new Response(aus.stderr).text()]);
  if (a !== 0 || b !== 0) throw new Error(`.worktreeinclude: tar ${a}/${b} ${(fa + fb).trim().slice(0, 200)}`);
  return fehlt.length;
}

// WAS FLEET IM EIGENEN SETUP MITGIBT (Owner 23.10. ~22:30: „[Zitat entfernt]“
// ): standardmäßig nichts. Jede Zugabe ist eine Wahl an der Tür und steht als eigene Zeile „[Zitat entfernt]“, mit dem Namen
// des Türfelds; ohne Wahl ist der Text genau MITGEGEBEN_NICHTS. Ein Pack landet hier nur als seine MCP-Server auf der Zeile, darum heißt
// seine Zeile `mcp`. Die Übergabe-Schwelle steht nicht hier: sie kann sich nach dem Start ändern und hat ihren Abschnitt „schwelle“.
export const MITGEGEBEN_NICHTS = "nichts";

// DER BERECHTIGUNGSMODUS ALS WAHL AN DER TÜR (Feld `permissionMode`, Claude Codes eigener Name): die Werte, die `claude --help` (2.1.309)
// für `--permission-mode` nennt. Ohne Wahl setzt Fleet im eigenen Setup keinen, und es gilt der Default des Nutzers.
export const PERMISSION_MODES = ["acceptEdits", "auto", "bypassPermissions", "manual", "dontAsk", "plan"] as const;
export type PermissionModeWahl = typeof PERMISSION_MODES[number];
export function permissionModeDerTuer(v: unknown): { ok: true; wahl: PermissionModeWahl | null } | { ok: false; error: string } {
  if (v === undefined || v === null) return { ok: true, wahl: null };
  return typeof v === "string" && (PERMISSION_MODES as readonly string[]).includes(v) ? { ok: true, wahl: v as PermissionModeWahl }
    : { ok: false, error: `permissionMode must be one of ${PERMISSION_MODES.join(", ")}` };
}
export interface EigenesSetupWahl {
  readonly model: string | null; readonly effort: string | null; readonly permissionMode: PermissionModeWahl | null; readonly rechte: string | null; readonly profil: string | null;
  readonly bibliothek: boolean; readonly notizbuch: "aus" | "branch" | null; readonly remote: boolean; readonly packMcp: readonly string[];
  readonly autoModeEnvironment: boolean; readonly tools: readonly string[] | null;
}

/** Je Zugabe eine Zeile, in der Reihenfolge der Türfelder; leer = nichts gewählt. Rein. */
export function eigenesSetupGewaehlt(o: EigenesSetupWahl): string[] {
  return [
    o.model ? `model: ${o.model}` : null,
    o.effort ? `effort: ${o.effort}` : null,
    o.permissionMode ? `permissionMode: ${o.permissionMode}` : null,
    o.tools ? `tools: ${o.tools.join(", ") || "keine eingebauten"}` : null,
    o.rechte ? `rechte: ${o.rechte}` : null,
    o.bibliothek ? "bibliothek: an" : null,
    o.profil ? `profil: ${o.profil}` : null,
    o.notizbuch ? `notizbuch: ${o.notizbuch}` : null,
    o.remote ? "remote: an" : null,
    o.packMcp.length ? `mcp: ${o.packMcp.join(", ")}` : null,
    o.autoModeEnvironment ? "autoModeEnvironment: an" : null,
  ].filter((z): z is string => z !== null);
}

/** Was Fleet auf einer Testinstanz mit echten Sitzen zusätzlich setzt: keine Wahl, darum unter Fleets Minimum (Owner-Regel 22.10.). */
export const EIGENES_SETUP_TESTINSTANZ = { was: "--permission-mode auto und Sperrregeln (kein weiteres claude aus dem Sitz)",
  warum: "nur auf einer Testinstanz mit echten Sitzen" } as const;

/** DIE WAHL `autoModeEnvironment` AN DER TÜR: Fleets Beschreibung seiner Umgebung für den Klassifizierer des Auto-Modus (session-start.ts
 *  #startAspects, autoMode.environment). true | false; ohne Feld keine Wahl (in Fleets Repo an, im eigenen Setup aus). */
export function umgebungDerTuer(v: unknown): { ok: true; wahl: boolean | null } | { ok: false; error: string } {
  if (v === undefined || v === null) return { ok: true, wahl: null };
  return typeof v === "boolean" ? { ok: true, wahl: v } : { ok: false, error: "autoModeEnvironment must be true or false" };
}

// DIE EINGEBAUTEN WERKZEUGE ALS WAHL AN DER TÜR (Feld `tools`, Owner 23.10. ~23:40: „[Zitat entfernt]“
// ): eine Liste geht als `--tools` auf die Zeile und nimmt das Schema jedes anderen eingebauten Werkzeugs aus dem Kontext
// (eine Deny-Regel ließe es stehen, server.ts#SESSION_TOOLS). Ohne Wahl gilt im eigenen Setup jedes Werkzeug, wie bei claude von Hand.
// [] heißt: kein eingebautes Werkzeug. MCP-Werkzeuge gehören nicht hierher, sondern zu `weglassen.mcp`.
const TOOL_RE = /^[A-Z][A-Za-z0-9]{1,40}$/;
export function toolsDerTuer(v: unknown): { ok: true; wahl: readonly string[] | null } | { ok: false; error: string } {
  if (v === undefined || v === null) return { ok: true, wahl: null };
  if (!Array.isArray(v) || !v.every((n) => typeof n === "string")) return { ok: false, error: "tools must be a list of Claude Code's built-in tool names" };
  const mcp = v.filter((n) => n.startsWith("mcp__"));
  if (mcp.length) return { ok: false, error: `tools names built-in tools only — leave out MCP tools with weglassen.mcp (${mcp.join(", ")})` };
  const falsch = v.filter((n) => !TOOL_RE.test(n));
  if (falsch.length) return { ok: false, error: `tools: not a built-in tool name: ${falsch.join(", ")}` };
  return { ok: true, wahl: [...new Set(v as string[])] };
}

// WAS DIE WERKZEUGE AM START KOSTEN (Owner 23.10.: „[Zitat entfernt]“): je eingebautem Werkzeug die Bytes seines Schemas aus einer abgelegten Messung
// (.fleet/werkzeug-schemas.json, Quelle und Version stehen darin). Nur Anzeige: die Zeile steht im Grund des Abschnitts „[Zitat entfernt]“, nicht im Hash.
export interface WerkzeugSchemas { readonly gemessen: string; readonly claude: string; readonly bytes: Readonly<Record<string, number>> }
const tsd = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
/** Ein Satz über die Schemas, die eine Liste (null = alle eingebauten) am Start lädt. Rein. */
export function werkzeugSchemaSatz(liste: readonly string[] | null, t: WerkzeugSchemas | null): string | null {
  if (!t) return null;
  const alle = Object.entries(t.bytes);
  const da = liste ? alle.filter(([name]) => liste.includes(name)) : alle;
  const ohne = liste ? liste.filter((name) => !(name in t.bytes)) : [];
  const summe = da.reduce((a, [, b]) => a + b, 0), voll = alle.reduce((a, [, b]) => a + b, 0);
  return [`Schemas am Start: ${tsd(summe)} B von ${tsd(voll)} B (${da.map(([name, b]) => `${name} ${tsd(b)}`).join(", ") || "keins"})`,
    ohne.length ? `aufgeschoben, nur der Name am Start: ${ohne.join(", ")}` : null,
    `gemessen ${t.gemessen} an claude ${t.claude} (.fleet/werkzeug-schemas.json)`].filter(Boolean).join(" · ");
}
