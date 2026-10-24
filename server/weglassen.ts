// WAS AUS ~/.claude WEGBLEIBT, als eigenes Modul: es baut nur Teile der Startzeile und importiert nichts aus node:fs. Darum darf es
// `enabledPlugins` nennen (e2e/pins.ts, „Fleet writes no global plugin settings“): der Schlüssel geht hier nur in das `--settings` eines
// Starts, nie in eine Datei. Der Pin hält fest, dass dieses Modul ohne fs-Import und ohne Schreib- oder Spawn-Aufruf bleibt.
import { NAME_RE } from "./eigenes-setup";

// WAS AUS ~/.claude WEGBLEIBT (Owner 23.10., Runde 3 über die Orchestratorin): im eigenen Setup lässt eine Wahl an der Tür (Feld `weglassen`)
// Teile des Claude Codes seines Nutzers einzeln weg, nur für diesen Start und nur über die Zeile, nie in seinen Dateien. Was einzeln geht,
// ist an claude 2.1.309 geprobt (Slot 5, Antwort 53fb9e13): CLAUDE.md und rules über `claudeMdExcludes`, Plugins über `enabledPlugins`,
// Agenten über `--disallowedTools Agent(<name>)`, Skills und Befehle über `skillOverrides`, die Werkzeuge eines MCP-Servers über eine
// Deny-Regel (der Server startet trotzdem), Hooks nur alle über `disableAllHooks` (das schaltet auch Statuszeile und @-Vorschlag ab).
// EINZELNE REGELDATEIEN (Owner über 16, Runde 9 über die Orchestratorin: „[Zitat entfernt]“): `dateien` nennt Regeldateien dieses
// Starts mit ihrem absoluten Pfad; sie gehen als exakter Pfad in `claudeMdExcludes`. Ob ein Pfad zu den Regeln dieses Starts gehört, prüft
// der Server an der Tür (server.ts#weglassenDateienDesStarts): das hängt am Ordner, und dieses Modul liest keine Dateien.
export interface Weglassen {
  readonly claudeMd?: true; readonly rules?: true; readonly plugins?: readonly string[]; readonly agents?: readonly string[];
  readonly skills?: readonly string[]; readonly mcp?: readonly string[]; readonly hooks?: true; readonly dateien?: readonly string[];
}
const WEGLASSEN_LISTEN = ["plugins", "agents", "skills", "mcp", "dateien"] as const;
const WEGLASSEN_SCHALTER = ["claudeMd", "rules", "hooks"] as const;
const PLUGIN_RE = /^[A-Za-z0-9._-]{1,80}@[A-Za-z0-9._-]{1,80}$/;
// ein absoluter Pfad (oder einer unter ~/), ohne die Zeichen, die `claudeMdExcludes` als Muster liest: ein Pfad meint genau eine Datei
const DATEI_RE = /^(\/|~\/)[^\0*?[\]{}!]{1,4000}$/;

/** Die Wahl an der Tür: ein Objekt mit nur diesen Schlüsseln; die Schalter sind `true`, die Listen Namen im Zeichensatz. Leer = keine Wahl. */
export function weglassenDerTuer(v: unknown): { ok: true; wahl: Weglassen | null } | { ok: false; error: string } {
  if (v === undefined || v === null) return { ok: true, wahl: null };
  if (typeof v !== "object" || Array.isArray(v)) return { ok: false, error: "weglassen must be an object" };
  const r = v as Record<string, unknown>;
  const fremd = Object.keys(r).filter((k) => !(WEGLASSEN_LISTEN as readonly string[]).includes(k) && !(WEGLASSEN_SCHALTER as readonly string[]).includes(k));
  if (fremd.length) return { ok: false, error: `weglassen knows ${[...WEGLASSEN_SCHALTER, ...WEGLASSEN_LISTEN].join(", ")} — not ${fremd.join(", ")}` };
  const wahl: { -readonly [K in keyof Weglassen]: Weglassen[K] } = {};
  for (const k of WEGLASSEN_SCHALTER) {
    if (r[k] === undefined || r[k] === false) continue;
    if (r[k] !== true) return { ok: false, error: `weglassen.${k} must be true` };
    wahl[k] = true;
  }
  for (const k of WEGLASSEN_LISTEN) {
    const liste = r[k];
    if (liste === undefined) continue;
    const re = k === "plugins" ? PLUGIN_RE : k === "dateien" ? DATEI_RE : NAME_RE;
    if (!Array.isArray(liste) || !liste.every((n) => typeof n === "string" && re.test(n)))
      return { ok: false, error: k === "dateien" ? "weglassen.dateien must be a list of absolute file paths (or ~/…), without * ? [ ] { } !"
        : `weglassen.${k} must be a list of names${k === "plugins" ? " <plugin>@<marketplace>" : ""}` };
    if (liste.length) wahl[k] = [...new Set(liste as string[])];
  }
  return { ok: true, wahl: Object.keys(wahl).length ? wahl : null };
}

/** Was die Wahl auf die Zeile legt: Pfade für `claudeMdExcludes`, Einträge für `--disallowedTools`, Teile für `--settings`. Rein. */
export function weglassenStart(w: Weglassen | null, claudeDir: string): { excludes: string[]; disallowed: string[]; skillOverrides: Record<string, "off">;
  deny: string[]; settings: { enabledPlugins?: Record<string, false>; disableAllHooks?: true } } {
  return {
    excludes: [...(w?.claudeMd ? [`${claudeDir}/CLAUDE.md`] : []), ...(w?.rules ? [`${claudeDir}/rules/**`] : []), ...(w?.dateien ?? [])],
    disallowed: (w?.agents ?? []).map((name) => `Agent(${name})`),
    skillOverrides: Object.fromEntries((w?.skills ?? []).map((name) => [name, "off" as const])),
    deny: (w?.mcp ?? []).map((name) => `mcp__${name}`),
    settings: { ...(w?.plugins?.length ? { enabledPlugins: Object.fromEntries(w.plugins.map((p) => [p, false as const])) } : {}),
      ...(w?.hooks ? { disableAllHooks: true as const } : {}) },
  };
}

export const WEGGELASSEN_NICHTS = "nichts";
/** Je Wegnahme eine Zeile „<teil>: <was>“ mit dem Namen aus dem Türfeld; leer = nichts weggelassen. `kurz` zeigt einen Pfad (etwa mit ~). Rein. */
export function weglassenZeilen(w: Weglassen | null, kurz: (pfad: string) => string = (pfad) => pfad): string[] {
  if (!w) return [];
  return [
    w.claudeMd ? "claudeMd: ~/.claude/CLAUDE.md" : null,
    w.rules ? "rules: ~/.claude/rules/**" : null,
    w.plugins?.length ? `plugins: ${w.plugins.join(", ")}` : null,
    w.agents?.length ? `agents: ${w.agents.join(", ")}` : null,
    w.skills?.length ? `skills: ${w.skills.join(", ")}` : null,
    w.mcp?.length ? `mcp: ${w.mcp.join(", ")} (ihre Werkzeuge; der Server startet weiter)` : null,
    w.hooks ? "hooks: alle (auch Statuszeile und @-Vorschlag)" : null,
    w.dateien?.length ? `dateien: ${w.dateien.map(kurz).join(", ")}` : null,
  ].filter((z): z is string => z !== null);
}
