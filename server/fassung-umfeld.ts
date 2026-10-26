// WAS EINEN CLAUDE-SITZ AUSSER FLEETS ZEILE NOCH FORMT (Harness 2.0, „was du siehst, startet, ganz“): die Hooks, die auf seinen
// Werkzeugaufrufen laufen, die Plugins, die er lädt, und die Claude-Code-Einstellungen, die er aus den Dateien des Owners und des Repos
// liest. Fleets Zeile setzt kein `--setting-sources` (server.ts#agentCmd), also liest Claude Code wie immer: die verwaltete Datei,
// ~/.claude/settings.json, <cwd>/.claude/settings.json und <cwd>/.claude/settings.local.json; Hooks aller Quellen laufen, bei
// `enabledPlugins` gilt die spätere Quelle. Dazu die Hooks der eingeschalteten Plugins (hooks/hooks.json im Installationsordner).
//
// Dieses Modul liest nur Dateien. Es führt keinen Hook aus und ruft kein Claude Code; ein Hook-Skript wird gelesen, um seine Bytes und
// seinen Inhalt in den Hash zu tragen. Was dem Owner gehört (seine eigenen Dateien, die lokale Datei des Checkouts, seine Plugins), trägt
// `eigentum: "owner"`: es ist Teil des Hashes, aber nicht Teil des teilbaren Setups und reist nicht mit (src/sitz.ts).
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { textAbschnitt, unknownAbschnitt, type FassungAbschnittEingang } from "./fassung";

export type QuellArt = "verwaltet" | "owner" | "repo" | "lokal";
/** Die verwaltete Datei dieser Plattform (Claude Code liest sie vor allen anderen); null = es gibt keine. */
export const VERWALTETE_EINSTELLUNGEN: string | null = process.platform === "darwin"
  ? "/Library/Application Support/ClaudeCode/managed-settings.json"
  : process.platform === "linux" ? "/etc/claude-code/managed-settings.json" : null;
/** Die Orte, an denen Claude Code für diesen Sitz liest; `managed` null = diese Plattform hat keine verwaltete Datei. */
export interface UmfeldOrte { readonly configDir: string; readonly home: string; readonly cwd: string; readonly managed: string | null }

interface Gelesen { readonly pfad: string; readonly roh: string | null; readonly json: Record<string, unknown> | null; readonly fehler: string | null }
export interface HookEintrag {
  readonly ereignis: string; readonly matcher: string; readonly art: string; readonly befehl: string;
  /** woher der Hook kommt: eine Einstellungsdatei oder ein Plugin */
  readonly herkunft: QuellArt | `plugin:${string}`; readonly quelle: string;
  /** das Skript, das der Befehl aufruft, wenn es eine lesbare Datei ist */
  readonly datei: { readonly pfad: string; readonly bytes: number; readonly sha: string } | null;
}
export interface PluginEintrag {
  readonly name: string; readonly an: boolean; readonly von: QuellArt; readonly version: string | null; readonly ordner: string | null;
  readonly bringt: { readonly skills: number; readonly agenten: number; readonly befehle: number; readonly hooks: number; readonly mcp: boolean } | null;
}
export interface Umfeld {
  readonly quellen: readonly (Gelesen & { readonly art: QuellArt })[];
  readonly hooks: readonly HookEintrag[];
  readonly plugins: readonly PluginEintrag[];
  /** `disableAllHooks` einer Quelle: dann läuft keiner der Hooks */
  readonly hooksAus: QuellArt | null;
  /** was der Owner sonst in seinem Claude-Code-Ordner hat und jeder Sitz bekommt (leseEigenes) */
  readonly eigenes: Eigenes;
}
export interface EigeneDatei { readonly name: string; readonly pfad: string; readonly bytes: number; readonly sha: string; readonly art?: string }
export interface Eigenes {
  readonly agenten: readonly EigeneDatei[]; readonly skills: readonly EigeneDatei[]; readonly befehle: readonly EigeneDatei[];
  readonly stile: readonly EigeneDatei[]; readonly regeln: readonly EigeneDatei[];
  /** MCP-Server aus ~/.claude.json: die des Owners und die, die er nur für diesen Ordner eingetragen hat */
  readonly mcp: readonly { readonly name: string; readonly wo: "owner" | "ordner"; readonly was: string }[];
  /** MCP-Server aus .mcp.json des Ordners: gehören dem Repo, nicht dem Owner */
  readonly mcpRepo: readonly { readonly name: string; readonly was: string }[];
}

const sha12 = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex").slice(0, 12);
const obj = (v: unknown): Record<string, unknown> | null => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;

function lies(pfad: string): Gelesen {
  let roh: string;
  try { roh = readFileSync(pfad, "utf8"); }
  catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    return { pfad, roh: null, json: null, fehler: code === "ENOENT" || code === "ENOTDIR" ? null : `not readable (${code ?? "?"})` };
  }
  try {
    const j = obj(JSON.parse(roh));
    return { pfad, roh, json: j, fehler: j ? null : "not a JSON object" };
  } catch {
    return { pfad, roh, json: null, fehler: "not valid JSON" };
  }
}

/** Ein Pfad zum Zeigen: im Ordner des Sitzes relativ, sonst das Home als ~. So steht weder der Ort des Checkouts noch ein Benutzername im
 *  Text und damit im Hash: derselbe Inhalt an einem anderen Ort ist dieselbe Fassung (server/fassung.ts#hashInhalt). */
export const zeigePfad = (pfad: string, home: string, cwd: string | null = null): string =>
  cwd && pfad.startsWith(`${cwd}/`) ? pfad.slice(cwd.length + 1)
    : pfad === home ? "~" : pfad.startsWith(`${home}/`) ? `~${pfad.slice(home.length)}` : pfad;

// DAS SKRIPT EINES BEFEHLS: das erste Wort, das nach dem Einsetzen von ~, $CLAUDE_PROJECT_DIR und ${CLAUDE_PLUGIN_ROOT} eine lesbare Datei
// ist. Ein Befehl ohne Datei (ein eingebauter, ein Programm im PATH) bleibt ohne; dann zählt nur sein Wortlaut.
function skriptVon(befehl: string, o: UmfeldOrte, pluginRoot: string | null): HookEintrag["datei"] {
  const ersetzt = befehl.replace(/\$\{?CLAUDE_PROJECT_DIR\}?/g, o.cwd).replace(/\$\{?CLAUDE_PLUGIN_ROOT\}?/g, pluginRoot ?? "\0");
  for (const roh of ersetzt.match(/"[^"]*"|'[^']*'|\S+/g) ?? []) {
    const wort = roh.replace(/^["']|["']$/g, "");
    if (!wort.includes("/") || wort.includes("\0")) continue;
    const pfad = wort.startsWith("~/") ? join(o.home, wort.slice(2)) : wort;
    try {
      const b = readFileSync(pfad);
      return { pfad, bytes: b.length, sha: sha12(b) };
    } catch { /* kein Skript an dieser Stelle: das nächste Wort */ }
  }
  return null;
}

function hooksAus(hooks: unknown, herkunft: HookEintrag["herkunft"], quelle: string, o: UmfeldOrte, pluginRoot: string | null): HookEintrag[] {
  const h = obj(hooks);
  if (!h) return [];
  return Object.entries(h).flatMap(([ereignis, gruppen]) => (Array.isArray(gruppen) ? gruppen : []).flatMap((g) => {
    const gruppe = obj(g);
    const matcher = typeof gruppe?.matcher === "string" ? gruppe.matcher : "";
    return (Array.isArray(gruppe?.hooks) ? gruppe.hooks : []).flatMap((x) => {
      const hook = obj(x);
      if (!hook) return [];
      const art = typeof hook.type === "string" ? hook.type : "?";
      const befehl = typeof hook.command === "string" ? hook.command : typeof hook.prompt === "string" ? hook.prompt
        : typeof hook.url === "string" ? hook.url : JSON.stringify(hook);
      return [{ ereignis, matcher, art, befehl, herkunft, quelle,
        datei: typeof hook.command === "string" ? skriptVon(hook.command, o, pluginRoot) : null }];
    });
  }));
}

const zaehle = (pfad: string, wie: (name: string) => boolean): number => {
  try { return readdirSync(pfad).filter(wie).length; } catch { return 0; }
};
const gibt = (pfad: string): boolean => lies(pfad).roh !== null;

// DER INSTALLATIONSORDNER EINES PLUGINS (installed_plugins.json): ein Eintrag dieses Projekts vor dem des Owners
function pluginOrdner(installiert: Record<string, unknown> | null, name: string, cwd: string): { ordner: string; version: string | null } | null {
  const eintraege = Array.isArray(obj(installiert?.plugins)?.[name]) ? obj(installiert?.plugins)![name] as unknown[] : [];
  const kandidaten = eintraege.map(obj).filter((e): e is Record<string, unknown> => !!e && typeof e.installPath === "string");
  const e = kandidaten.find((k) => k.scope !== "user" && k.projectPath === cwd) ?? kandidaten.find((k) => k.scope === "user") ?? kandidaten[0];
  return e ? { ordner: e.installPath as string, version: typeof e.version === "string" ? e.version : null } : null;
}

// DAS ÜBRIGE EIGENE DES OWNERS, das Claude Code jedem Sitz gibt: seine Agenten (agents/*.md, in der Agentenliste), Skills
// (skills/**/SKILL.md, auch die vom Konto synchronisierten unter skills/synced), Befehle (commands/**/*.md), Ausgabestile
// (output-styles/*.md), Regeln (rules/**/*.md; mit `paths:` lädt eine erst bei passenden Dateien) und MCP-Server aus ~/.claude.json.
// Je Datei Name, Bytes und Kurz-Hash: eine geänderte Datei ändert die Fassung. Die Konnektoren des claude.ai-Kontos stehen in keiner
// Datei; das steht im Text, statt sie zu verschweigen.
function dateienUnter(wurzel: string, passt: (rel: string) => boolean, tiefe = 5): string[] {
  const out: string[] = [];
  const geh = (rel: string, t: number): void => {
    let namen: string[];
    try { namen = readdirSync(join(wurzel, rel)).sort(); } catch { return; }
    for (const n of namen) {
      if (n.startsWith(".")) continue;
      const r = rel ? `${rel}/${n}` : n;
      let dir = false;
      try { dir = statSync(join(wurzel, r)).isDirectory(); } catch { continue; }
      if (dir) { if (t > 0) geh(r, t - 1); } else if (passt(r)) out.push(r);
    }
  };
  geh("", tiefe);
  return out;
}
function eigeneDatei(pfad: string, name: string, home: string, art?: string): EigeneDatei | null {
  try {
    const b = readFileSync(pfad);
    return { name, pfad: zeigePfad(pfad, home), bytes: b.length, sha: sha12(b), ...(art ? { art } : {}) };
  } catch { return null; }
}
const mcpWas = (v: unknown): string => {
  const o = obj(v);
  if (!o) return "?";
  const art = typeof o.type === "string" ? o.type : typeof o.url === "string" ? "http" : "stdio";
  const ziel = typeof o.url === "string" ? o.url : [o.command, ...(Array.isArray(o.args) ? o.args : [])].filter((x) => typeof x === "string").join(" ");
  return `${art} ${ohneLangeWerte(ziel)}${obj(o.env) ? ` · env ${Object.keys(obj(o.env)!).sort().join(", ")}` : ""}`;
};
export function leseEigenes(o: UmfeldOrte): Eigenes {
  const c = o.configDir;
  const liste = (unter: string, passt: (rel: string) => boolean, name: (rel: string) => string, art?: (inhalt: string, rel: string) => string | undefined) =>
    dateienUnter(join(c, unter), passt).flatMap((rel) => {
      const pfad = join(c, unter, rel);
      const d = eigeneDatei(pfad, name(rel), o.home, art?.(lies(pfad).roh ?? "", rel));
      return d ? [d] : [];
    });
  const claudeJson = lies(join(o.home, ".claude.json")).json;
  const ordner = obj(obj(claudeJson?.projects)?.[o.cwd]);
  const mcpRepo = obj(lies(join(o.cwd, ".mcp.json")).json?.mcpServers) ?? {};
  return {
    agenten: liste("agents", (r) => r.endsWith(".md"), (r) => r.replace(/\.md$/, "")),
    skills: liste("skills", (r) => r.endsWith("/SKILL.md"), (r) => r.split("/").at(-2)!, (_i, r) => r.startsWith("synced/") ? "from your account" : undefined),
    befehle: liste("commands", (r) => r.endsWith(".md"), (r) => r.replace(/\.md$/, "").replaceAll("/", ":")),
    stile: liste("output-styles", (r) => r.endsWith(".md"), (r) => r.replace(/\.md$/, "")),
    regeln: liste("rules", (r) => r.endsWith(".md"), (r) => r, (inhalt) => /^---\n[\s\S]*?^paths:/m.test(inhalt) ? "for matching paths" : "always"),
    mcp: [
      ...Object.entries(obj(claudeJson?.mcpServers) ?? {}).map(([name, v]) => ({ name, wo: "owner" as const, was: mcpWas(v) })),
      ...Object.entries(obj(ordner?.mcpServers) ?? {}).map(([name, v]) => ({ name, wo: "ordner" as const, was: mcpWas(v) })),
    ].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    mcpRepo: Object.entries(mcpRepo).map(([name, v]) => ({ name, was: mcpWas(v) })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  };
}

/** Liest, was Claude Code für einen Sitz in `o.cwd` außer Fleets Zeile lädt. Liest nur; führt nichts aus. */
export function leseUmfeld(o: UmfeldOrte): Umfeld {
  const quellen = ([
    ...(o.managed ? [["verwaltet", o.managed] as const] : []),
    ["owner", join(o.configDir, "settings.json")],
    ["repo", join(o.cwd, ".claude", "settings.json")],
    ["lokal", join(o.cwd, ".claude", "settings.local.json")],
  ] as const).map(([art, pfad]) => ({ art, ...lies(pfad) }));
  const hooks = quellen.flatMap((q) => hooksAus(q.json?.hooks, q.art, zeigePfad(q.pfad, o.home, o.cwd), o, null));
  const hooksAusBei = quellen.find((q) => q.json?.disableAllHooks === true)?.art ?? null;
  // enabledPlugins: die spätere Quelle gewinnt je Plugin (Claude Code: lokal vor Repo vor Owner), die verwaltete vor allen
  const wahl = new Map<string, { an: boolean; von: QuellArt }>();
  for (const q of [...quellen.filter((x) => x.art !== "verwaltet"), ...quellen.filter((x) => x.art === "verwaltet")])
    for (const [name, an] of Object.entries(obj(q.json?.enabledPlugins) ?? {}))
      if (typeof an === "boolean") wahl.set(name, { an, von: q.art });
  const installiert = lies(join(o.configDir, "plugins", "installed_plugins.json")).json;
  const plugins: PluginEintrag[] = [...wahl.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, w]) => {
    const ort = w.an ? pluginOrdner(installiert, name, o.cwd) : null;
    if (!ort) return { name, an: w.an, von: w.von, version: null, ordner: null, bringt: null };
    const eigene = hooksAus(obj(lies(join(ort.ordner, "hooks", "hooks.json")).json)?.hooks, `plugin:${name}`,
      zeigePfad(join(ort.ordner, "hooks", "hooks.json"), o.home), o, ort.ordner);
    hooks.push(...eigene);
    return { name, an: true, von: w.von, version: ort.version, ordner: zeigePfad(ort.ordner, o.home), bringt: {
      skills: zaehle(join(ort.ordner, "skills"), (n) => !n.startsWith(".")),
      agenten: zaehle(join(ort.ordner, "agents"), (n) => n.endsWith(".md")),
      befehle: zaehle(join(ort.ordner, "commands"), (n) => n.endsWith(".md")),
      hooks: eigene.length, mcp: gibt(join(ort.ordner, ".mcp.json")) } };
  });
  return { quellen, hooks, plugins, hooksAus: hooksAusBei, eigenes: leseEigenes(o) };
}

// GEHEIMES BLEIBT DRAUSSEN: der Wert unter `env` und jeder Schlüssel, der nach Zugang klingt, steht nur als Kurz-Hash da. So ändert ein
// neuer Wert den Hash, ohne dass der Wert in der Ansicht oder im festgehaltenen Start steht.
const GEHEIM = /token|secret|password|passwort|apikey|api_key|credential|auth/i;
function ohneGeheimes(v: unknown, schluessel = ""): unknown {
  if (schluessel === "env" && obj(v)) return Object.fromEntries(Object.entries(obj(v)!).map(([k, x]) => [k, `sha256:${sha12(String(x))}`]));
  if (GEHEIM.test(schluessel) && (typeof v === "string" || typeof v === "number")) return `sha256:${sha12(String(v))}`;
  if (Array.isArray(v)) return v.map((x) => ohneGeheimes(x));
  const o = obj(v);
  return o ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, ohneGeheimes(o[k], k)])) : v;
}
// ein Befehl mit einem eingebetteten Schlüssel zeigt ihn nicht: eine lange Folge aus Buchstaben und Ziffern ohne Trenner (kein Pfad, kein
// Wort mit Bindestrichen allein) wird zum Kurz-Hash
const ohneLangeWerte = (s: string): string => s.replace(/[A-Za-z0-9_\-+=]{32,}/g, (m) => /\d/.test(m) && /[A-Za-z]/.test(m) ? `sha256:${sha12(m)}` : m);

const hookZeile = (h: HookEintrag, zeige: (pfad: string) => string): string =>
  `${h.ereignis}${h.matcher ? ` · ${h.matcher}` : ""} · ${h.art === "command" ? "" : `${h.art}: `}${ohneLangeWerte(h.befehl)}`
  + (h.datei ? `\n  script ${zeige(h.datei.pfad)} · ${h.datei.bytes} B · sha256 ${h.datei.sha}` : "")
  + `\n  from ${h.quelle}`;

const istEigenes = (herkunft: HookEintrag["herkunft"]): boolean => herkunft !== "repo";
const QUELL_ORT: Record<QuellArt, string> = { verwaltet: "set in the managed file", owner: "set in your file", repo: "set in the repo's file",
  lokal: "set in the checkout's local file" };

/** Die Abschnitte für „Darf“ (Hooks und Einstellungen) und „Arbeitet mit“ (Plugins). Nur für Claude; ein anderer Harness liest sie nicht.
 *  `regelnAus`: der Grund, aus dem die Zeile dem Sitz die eigenen Regeln nimmt (server.ts#eigeneRegelnExcludes), sonst null. */
export function umfeldAbschnitte(u: Umfeld, home: string, cwd: string, regelnAus: string | null = null): { darf: FassungAbschnittEingang[]; arbeitet: FassungAbschnittEingang[] } {
  const zeige = (pfad: string): string => zeigePfad(pfad, home, cwd);
  const kaputt = u.quellen.filter((q) => q.fehler);
  const grund = kaputt.length ? kaputt.map((q) => `${zeige(q.pfad)}: ${q.fehler}`).join(" · ") : undefined;
  const aus = u.hooksAus ? `\n(none runs: disableAllHooks ${QUELL_ORT[u.hooksAus]})` : "";
  // je Skript eine Datei, auch wenn mehrere Hooks es aufrufen
  const skripte = (liste: readonly HookEintrag[]) => [...new Map(liste.flatMap((h) => h.datei ? [[h.datei.pfad, h.datei.bytes] as const] : [])).entries()]
    .map(([pfad, bytes]) => ({ pfad: zeige(pfad), bytes }));
  const hookAbschnitt = (id: string, quelle: string, liste: readonly HookEintrag[], eigen: boolean): FassungAbschnittEingang => ({
    ...textAbschnitt(id, quelle, liste.length ? liste.map((h) => hookZeile(h, zeige)).join("\n") + aus : "(no hooks)", true,
      undefined, skripte(liste), grund),
    ...(eigen ? { eigentum: "owner" as const } : {}) });
  const einstellung = (arten: readonly QuellArt[], id: string, eigen: boolean): FassungAbschnittEingang => {
    const da = u.quellen.filter((q) => arten.includes(q.art) && q.json);
    const text = da.map((q) => {
      const { hooks: _h, enabledPlugins: _p, ...rest } = q.json!;
      return `${zeige(q.pfad)} (${Buffer.byteLength(q.roh ?? "")} B, hooks and plugins are listed separately):\n${JSON.stringify(ohneGeheimes(rest), null, 1)}`;
    }).join("\n");
    return { ...textAbschnitt(id, u.quellen.filter((q) => arten.includes(q.art) && q.roh !== null).map((q) => zeige(q.pfad)).join("\n") || null,
      text || "(no file)", true, undefined, da.map((q) => ({ pfad: zeige(q.pfad), bytes: Buffer.byteLength(q.roh ?? "") })), grund),
      ...(eigen ? { eigentum: "owner" as const } : {}) };
  };
  const an = u.plugins.filter((p) => p.an), ab = u.plugins.filter((p) => !p.an);
  const pluginText = [
    ...an.map((p) => `${p.name}${p.version ? ` ${p.version}` : ""} · on (${QUELL_ORT[p.von]})`
      + (p.bringt ? ` · skills ${p.bringt.skills} · agents ${p.bringt.agenten} · commands ${p.bringt.befehle} · hooks ${p.bringt.hooks}${p.bringt.mcp ? " · MCP" : ""}`
        : " · install not found")),
    ...[...new Set(ab.map((p) => p.von))].map((von) => `off (${QUELL_ORT[von]}): ${ab.filter((p) => p.von === von).map((p) => p.name).join(", ")}`),
  ].join("\n");
  return {
    darf: [
      hookAbschnitt("hooks", ".claude/settings.json of the repo", u.hooks.filter((h) => !istEigenes(h.herkunft)), false),
      hookAbschnitt("hooks-eigene", "your Claude Code files and plugins", u.hooks.filter((h) => istEigenes(h.herkunft)), true),
      einstellung(["repo"], "cc-einstellungen", false),
      einstellung(["verwaltet", "owner", "lokal"], "cc-einstellungen-eigene", true),
    ],
    arbeitet: [eigenesAbschnitt(u.eigenes, regelnAus), ...(u.eigenes.mcpRepo.length ? [textAbschnitt("mcp-repo", ".mcp.json of the repo",
      u.eigenes.mcpRepo.map((m) => `${m.name} · ${m.was}`).join("\n"), true)] : []),
      { ...textAbschnitt("plugins", "enabledPlugins of the settings · plugins/installed_plugins.json", pluginText || "(no plugins)", true),
      eigentum: "owner" }],
  };
}

/** Für einen anderen Harness: Claude Codes Dateien gelten nicht, und das steht da. */
export const umfeldOhneClaude = (): { darf: FassungAbschnittEingang[]; arbeitet: FassungAbschnittEingang[] } => ({ darf: [], arbeitet: [
  unknownAbschnitt("plugins", "this harness reads no Claude Code plugins, hooks or settings")] });

// FLEETS EINSTELLUNGEN, DIE DEN LAUF FORMEN, nicht den Start: die Übergabe-Schwelle (server.ts#thresholdFor) und das Cache-Warmhalten
// (server.ts#keepCacheOn). Beide gehören dem Slot und können sich nach dem Start ändern; die Route führt sie darum an der festgehaltenen
// Fassung nach (server.ts, GET /api/slots/:id/fassung). Hier steht nur die Form; die Werte rechnet server.ts mit denselben Funktionen
// wie der Takt, der sie anwendet.
export interface SchwelleFakten {
  readonly art: string; readonly basePct: number; readonly capPct: number; readonly von: "session" | "env" | "fleet" | "setup";
  /** die Env-Zeile der Schiene (FLEET_MIGRATE_PCT oder FLEET_LANE_MIGRATE_PCT) */
  readonly envName: string;
  /** warum keine Schwelle wirkt (Steward, Harness, Fleet-Schalter, 0 %), null = sie wirkt */
  readonly aus: string | null; readonly wahl: "hint" | "compact" | "succeed"; readonly hinweis: boolean;
}
const WAHL_WORT = { hint: "note", compact: "compact", succeed: "new session" } as const;
export function schwelleAbschnitt(f: SchwelleFakten): FassungAbschnittEingang {
  const quelle = f.von === "session" ? "Slot.handover (set for this session)" : f.von === "env" ? `${f.envName} (.env)`
    : f.von === "setup" ? "server/succession.ts#thresholdOf (own setup)" : `server/succession.ts#FLEET_BASE_PCT (${f.art})`;
  return textAbschnitt("schwelle", quelle, f.aus ? `Handover threshold off: ${f.aus}`
    : `Handover at ${f.basePct} % · due at ${f.capPct} % · at the threshold: ${WAHL_WORT[f.wahl]} · note ${f.hinweis ? "on" : "off"}`, true);
}
export interface WarmFakten {
  readonly an: boolean; readonly von: "session" | "fleet"; readonly ausGrund: string | null; readonly ruheMin: number; readonly text: string;
  readonly hoechstens: number; readonly jeStunde: number; readonly lebensdauerMin: number;
}
export function warmhaltenAbschnitt(f: WarmFakten): FassungAbschnittEingang {
  const quelle = f.von === "session" ? "Slot.handover.keepCache (set for this session)" : "server.ts#keepCacheFleetOn (Fleet's value for this kind of session)";
  if (f.ausGrund) return textAbschnitt("warmhalten", quelle, `Keep cache warm: off — ${f.ausGrund}`, false);
  return textAbschnitt("warmhalten", quelle, f.an
    ? `Keep cache warm: on, after ${f.ruheMin} min quiet (the cache lives ${f.lebensdauerMin} min) Fleet types at most ${f.hoechstens} turns, ${f.jeStunde} per hour:\n${f.text}`
    : "Keep cache warm: off", true, f.an ? Buffer.byteLength(f.text) : 0);
}

// DAS ÜBRIGE EIGENE als ein Abschnitt unter „Arbeitet mit“: je Art die Dateien mit Bytes und Kurz-Hash, die MCP-Server mit ihrem Ziel
const EIGENES_ARTEN = [["agenten", "Agents"], ["skills", "Skills"], ["befehle", "Commands"], ["stile", "Output styles"], ["regeln", "Rules"]] as const;
function eigenesAbschnitt(e: Eigenes, regelnAus: string | null): FassungAbschnittEingang {
  // ausgeschlossene Regeln erreichen den Sitz nicht: sie zählen 0 und stehen mit dem Grund da, ohne Datei im Hash
  const arten = EIGENES_ARTEN.filter(([k]) => !(regelnAus && k === "regeln"));
  const zeilen = [
    ...EIGENES_ARTEN.map(([k, wort]) => regelnAus && k === "regeln"
      ? `${wort} 0${e[k].length ? ` — excluded: ${e[k].map((d) => d.name).join(", ")}` : ""} (${regelnAus})`
      : `${wort} ${e[k].length}${e[k].length ? `: ${e[k].map((d) => `${d.name}${d.art ? ` (${d.art})` : ""} ${d.bytes} B ${d.sha}`).join(", ")}` : ""}`),
    `MCP servers from ~/.claude.json ${e.mcp.length}${e.mcp.length ? `: ${e.mcp.map((m) => `${m.name}${m.wo === "ordner" ? " (this folder only)" : ""} · ${m.was}`).join(", ")}` : ""}`,
    "Connectors of your claude.ai account: in no file, Claude Code fetches them at start",
  ];
  const dateien = arten.flatMap(([k]) => e[k].map((d) => ({ pfad: d.pfad, bytes: d.bytes })));
  return { ...textAbschnitt("claude-eigenes", "~/.claude (agents, skills, commands, output-styles, rules) · ~/.claude.json (mcpServers)",
    zeilen.join("\n"), true, undefined, dateien), eigentum: "owner" };
}

/** DER MODUS, MIT DEM CLAUDE CODE IM EIGENEN SETUP STARTET, wo die Tür keinen wählt: `permissions.defaultMode` aus den Einstellungen
 *  in Claude Codes Reihenfolge (local vor project vor user, code.claude.com/docs/en/settings), sonst „default“. Für den Export eines
 *  Sitzes (server/sitz-reise.ts), der so lief: er trägt diesen Modus, nicht Fleets `auto`. Rein bis auf das Lesen der drei Dateien. */
export function eigenerModus(repo: string, claudeDir: string): string {
  for (const pfad of [`${repo}/.claude/settings.local.json`, `${repo}/.claude/settings.json`, `${claudeDir}/settings.json`]) {
    try {
      const m = (JSON.parse(readFileSync(pfad, "utf8")) as { permissions?: { defaultMode?: unknown } }).permissions?.defaultMode;
      if (typeof m === "string" && m) return m;
    } catch { /* keine oder keine lesbare Datei: die nächste */ }
  }
  return "default";
}
