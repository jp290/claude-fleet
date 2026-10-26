// WAS DEN SITZ AUSSER FLEETS ZEILE FORMT, im Setup-Block des Boards: je Abschnitt der Fassung (server/fassung-umfeld.ts) eine Zeile mit
// kurzem Wert, nach Herkunft gruppiert (Fleet · das Repo · der Owner selbst), und je Zeile das Ziel, an dem sie gesetzt wird: der
// Nachfolge-Block oder eine Datei im Setup-Fenster (setupDateien). Owner 2026-10-23: „[Zitat entfernt]“ war unverständlich; jede
// Zeile führt dahin, wo sie eingestellt wird. Kein DOM; src/board.ts zeichnet die Zeilen, src/client.ts#openSetupFiles das Fenster.
// Was diese Ansicht wahr zeigen muss (was eine Session wirklich liest, woher jede Zeile kommt, Fallen): docs/session-ui/setup-ansicht.md.
export interface UmfeldAbschnitt {
  readonly id: string; readonly quelle: string | null; readonly text: string | null; readonly bytes: number | "unknown";
  readonly grund?: string; readonly eigentum?: "owner";
  readonly dateien?: readonly { readonly pfad: string; readonly bytes: number; readonly eigentum?: "owner" }[];
}
export interface UmfeldTeil { readonly id: string; readonly abschnitte: readonly UmfeldAbschnitt[] }

export type UmfeldGruppe = "fleet" | "repo" | "eigen";
/** wohin ein Klick führt: der Nachfolge-Block oben in Info, ein Eintrag im Setup-Fenster, oder nirgends (es gibt die Datei nicht) */
export type UmfeldZiel = { readonly art: "nachfolge" } | { readonly art: "datei"; readonly key: string; readonly finde?: string } | null;
export interface UmfeldZeile {
  readonly label: string; readonly wert: string; readonly titel: string; readonly gruppe: UmfeldGruppe; readonly ziel: UmfeldZiel;
}
export const GRUPPE: Record<UmfeldGruppe, { readonly kopf: string; readonly satz: string }> = {
  fleet: { kopf: "Set by Fleet", satz: "for this session only — change it under Succession" },
  repo: { kopf: "From the repo", satz: "Claude Code files in this repo; whoever works here gets them too" },
  eigen: { kopf: "Your Claude Code", satz: "from your ~/.claude on this machine; every session here gets them, a shared setup does not" },
};

/** ein Eintrag im Setup-Fenster: eine Datei (pfad, beim Öffnen an `finde`) oder ein Text ohne eigene Datei (Plugins, MCP-Server) */
export interface SetupDatei {
  readonly key: string; readonly gruppe: "repo" | "eigen"; readonly art: string; readonly name: string;
  readonly pfad: string | null; readonly bytes?: number; readonly finde?: string; readonly text?: string;
  /** wo und wie man es ändert, in einem Satz */
  readonly aendern: string;
  /** dieselbe Datei an einer anderen Stelle (Plugins → enabledPlugins in settings.json) */
  readonly auch?: { readonly label: string; readonly pfad: string; readonly finde: string };
}

// der Lader der Projektregeln nennt absolute Pfade; gezeigt wird das Home als ~, wie in den übrigen Zeilen
const kurz = (pfad: string): string => pfad.replace(/^\/(?:Users|home)\/[^/]+\//, "~/").replace(/^\/.*?\/\.claude\//, "~/.claude/");
const kB = (b: number): string => b < 1000 ? `${b} B` : `${(b / 1000).toFixed(1)} kB`;
const name = (pfad: string): string => pfad.split("/").pop() ?? pfad;
const ohneEndung = (pfad: string): string => name(pfad).replace(/\.(?:sh|md|ts|js|py|json)$/, "");
// ein Pfad im Ordner des Sitzes steht relativ (server/fassung-umfeld.ts#zeigePfad); zum Öffnen braucht er den Ordner davor
const voll = (pfad: string, cwd: string | null): string => pfad.startsWith("/") || pfad.startsWith("~") || !cwd ? pfad : `${cwd}/${pfad}`;
const titel = (a: UmfeldAbschnitt): string => [a.text ?? a.grund ?? "", a.quelle ? `Source: ${a.quelle}` : ""].filter(Boolean).join("\n\n");
// eine Hook-Zeile beginnt am Rand; ihre Skript- und Quellzeilen sind eingerückt
const hookZahl = (a: UmfeldAbschnitt | undefined): number =>
  a?.text ? a.text.split("\n").filter((z) => z && !z.startsWith(" ") && !z.startsWith("(")).length : 0;
const liste = (namen: readonly string[], n = namen.length): string => n === 0 ? "none" : `${n} · ${namen.join(", ")}`;

const ARTEN = [
  ["agents", "Agents", "Agent", "Claude Code offers them as subagents. Change the file, or use /agents in Claude Code."],
  ["skills", "Skills", "Skill", "Claude Code lists them and loads one when its description fits. Change the SKILL.md file."],
  ["commands", "Commands", "Command", "Slash commands. Change the file; its name is the command."],
  ["output-styles", "Output styles", "Output style", "How Claude Code answers. Pick one with /output-style."],
  ["rules", "Rules", "Rule", "Loaded at the start, or only for matching files when the rule names paths."],
] as const;
const artVon = (pfad: string): (typeof ARTEN)[number] | undefined => ARTEN.find(([ordner]) => pfad.includes(`/.claude/${ordner}/`));
const kurzName = (pfad: string): string => pfad.endsWith("/SKILL.md") ? pfad.split("/").at(-2) ?? pfad : ohneEndung(pfad);

const HOOKS_KEY = "\"hooks\"";
const MCP_ZEILE = /^MCP(?: servers from|-Server aus) ~\/\.claude\.json (\d+)(?:: (.*))?$/;
const mcpNamen = (eigenes: UmfeldAbschnitt | undefined): string[] => {
  const z = (eigenes?.text ?? "").split("\n").map((x) => MCP_ZEILE.exec(x)).find(Boolean);
  return z?.[2] ? z[2].split(/, (?=[^\s,]+(?: \((?:this folder only|nur dieser Ordner)\))? · )/).map((e) => e.split(" · ")[0]!.replace(/ \((?:this folder only|nur dieser Ordner)\)$/, "")) : [];
};
const pluginNamen = (plugins: UmfeldAbschnitt | undefined): string[] =>
  (plugins?.text ?? "").split("\n").filter((z) => / · (?:on|an)\b/.test(z)).map((z) => z.split(" ")[0]!.split("@")[0]!);

/** Die Einträge des Setup-Fensters, in der Reihenfolge, in der es sie zeigt. */
export function setupDateien(teile: readonly UmfeldTeil[], cwd: string | null): SetupDatei[] {
  const alle = new Map(teile.flatMap((t) => t.abschnitte.map((a) => [a.id, a] as const)));
  const out: SetupDatei[] = [];
  const einst = (id: string, gruppe: "repo" | "eigen") => (alle.get(id)?.dateien ?? []).forEach((d, i) => out.push({
    key: `${gruppe}:settings:${i}`, gruppe, art: "Settings", name: name(d.pfad), pfad: voll(d.pfad, cwd),
    aendern: gruppe === "repo" ? "Claude Code reads it in every session in this repo. Edit it here, or with /config in Claude Code."
      : "Claude Code reads it in every session on this machine. Change it in the file, or with /config in Claude Code." }));
  einst("cc-einstellungen", "repo");
  for (const d of alle.get("hooks")?.dateien ?? [])
    out.push({ key: `repo:hook:${d.pfad}`, gruppe: "repo", art: "Hook script", name: name(d.pfad), pfad: voll(d.pfad, cwd),
      aendern: "Runs on the tool calls its hook names in .claude/settings.json." });
  const mcpRepo = alle.get("mcp-repo");
  if (mcpRepo?.text) out.push({ key: "repo:mcp", gruppe: "repo", art: "MCP servers", name: ".mcp.json", pfad: voll(".mcp.json", cwd),
    aendern: "MCP servers of this repo. Edit .mcp.json." });
  einst("cc-einstellungen-eigene", "eigen");
  for (const a of alle.values()) for (const d of a.dateien ?? [])
    if (d.eigentum === "owner" && !a.id.startsWith("cc-") && a.id !== "claude-eigenes")
      out.push({ key: `eigen:md:${d.pfad}`, gruppe: "eigen", art: "Instructions", name: name(d.pfad), pfad: d.pfad, bytes: d.bytes,
        aendern: "Claude Code reads it at the start of every session, before the repo's own rules. Edit the file." });
  for (const d of alle.get("hooks-eigene")?.dateien ?? [])
    out.push({ key: `eigen:hook:${d.pfad}`, gruppe: "eigen", art: "Hook script", name: name(d.pfad), pfad: voll(d.pfad, cwd),
      aendern: "Runs on the tool calls its hook names in your settings.json. Turn hooks on and off with /hooks in Claude Code." });
  const plugins = alle.get("plugins"), eigeneEinst = alle.get("cc-einstellungen-eigene")?.dateien?.[0];
  if (plugins?.text && !plugins.text.startsWith("(")) out.push({ key: "eigen:plugins", gruppe: "eigen", art: "Plugins", name: "Plugins",
    pfad: null, text: plugins.text, aendern: "Turn plugins on and off with /plugin in Claude Code, or under enabledPlugins in your settings.json.",
    ...(eigeneEinst ? { auch: { label: "enabledPlugins in settings.json", pfad: voll(eigeneEinst.pfad, cwd), finde: "\"enabledPlugins\"" } } : {}) });
  for (const d of alle.get("claude-eigenes")?.dateien ?? []) {
    const art = artVon(d.pfad);
    if (art) out.push({ key: `eigen:${art[0]}:${d.pfad}`, gruppe: "eigen", art: art[2], name: kurzName(d.pfad), pfad: d.pfad, aendern: art[3] });
  }
  const mcp = mcpNamen(alle.get("claude-eigenes"));
  if (mcp.length) out.push({ key: "eigen:mcp", gruppe: "eigen", art: "MCP servers", name: "MCP servers", pfad: null,
    text: (alle.get("claude-eigenes")?.text ?? "").split("\n").find((z) => MCP_ZEILE.test(z)) ?? "",
    aendern: "From ~/.claude.json. Add and remove them with /mcp or `claude mcp` — the file also holds your login, so it is not shown here." });
  return out;
}

// DIE NACHFOLGE IN WORTEN DES BOARDS: der Abschnitt trägt Fleets deutschen Text (er zählt im Hash), die Zeile sagt ihn so wie der
// Nachfolge-Block darüber
function nachfolgeWert(schwelle: UmfeldAbschnitt | undefined, warm: UmfeldAbschnitt | undefined): string {
  const s = schwelle?.text ?? "";
  const m = /(?:at|ab) (\d+) % · (?:due at|fällig ab) (\d+) %/.exec(s);
  const teil1 = m ? `hand over at ${m[1]} %, due at ${m[2]} %` : /threshold off|Schwelle aus/.test(s) ? "no handover" : schwelle ? "unknown" : null;
  const w = warm?.text ?? "";
  const r = /(?:after|nach) (\d+) min (?:quiet|Ruhe)/.exec(w);
  const teil2 = r ? `cache kept warm after ${r[1]} min quiet` : /^(?:Keep cache warm: off|Cache warmhalten aus)/.test(w) ? "cache not kept warm" : null;
  return [teil1, teil2].filter(Boolean).join(" · ");
}

export function umfeldZeilen(teile: readonly UmfeldTeil[], cwd: string | null = null): UmfeldZeile[] {
  const alle = new Map(teile.flatMap((t) => t.abschnitte.map((a) => [a.id, a] as const)));
  const dateien = setupDateien(teile, cwd);
  const ziel = (key: string | undefined, finde?: string): UmfeldZiel => key ? { art: "datei", key, ...(finde ? { finde } : {}) } : null;
  const ersteVon = (wie: (d: SetupDatei) => boolean): string | undefined => dateien.find(wie)?.key;
  const zeilen: UmfeldZeile[] = [];
  // DAS EIGENE SETUP (server/eigenes-setup.ts) zuerst: der Modus in Worten, darunter je Zeile, was Fleet dazulegt, und im Tooltip warum
  const eigenesSetup = alle.get("eigenes-setup");
  if (eigenesSetup?.text) {
    const [satz = "", ...dazu] = eigenesSetup.text.split("\n");
    zeilen.push({ label: "Mode", wert: "your own setup — Claude Code as you start it yourself", titel: satz, gruppe: "fleet", ziel: null });
    dazu.filter((z) => z.startsWith("- ")).forEach((z, i) => {
      const [was = "", ...warum] = z.slice(2).split(": ");
      zeilen.push({ label: i === 0 ? "Fleet adds" : "", wert: was, titel: warum.join(": "), gruppe: "fleet", ziel: null });
    });
    // was beim Öffnen gewählt ist, je Zugabe eine Zeile „<feld>: <wert>“; ohne Wahl genau „nichts“
    const mitgegeben = alle.get("mitgegeben");
    if (mitgegeben?.text) mitgegeben.text.split("\n").forEach((z, i) => zeilen.push({ label: i === 0 ? "Passed along" : "", wert: z,
      titel: "Chosen when this session was opened. With no choice, Fleet passes nothing along.", gruppe: "fleet", ziel: null }));
    // was die Schemas der eingebauten Werkzeuge am Start kosten, je Werkzeug; Messung und Zeile im Tooltip
    const werkzeuge = alle.get("werkzeuge");
    if (werkzeuge?.grund) {
      const [kosten = "", ...herkunft] = werkzeuge.grund.split(" · ");
      zeilen.push({ label: "Tools", wert: kosten, titel: [herkunft.join("\n"), titel(werkzeuge)].filter(Boolean).join("\n\n"), gruppe: "fleet", ziel: null });
    }
  }
  // was aus ~/.claude für diesen Sitz wegbleibt, je Teil eine Zeile; ohne Wahl genau „nichts“ (nur im eigenen Setup)
  const weggelassen = alle.get("weggelassen");
  if (weggelassen?.text) weggelassen.text.split("\n").forEach((z, i) => zeilen.push({ label: i === 0 ? "Left out" : "", wert: z,
    titel: "Left out of your ~/.claude for this session, on its command line only. Your files stay as they are.", gruppe: "fleet", ziel: null }));

  const schwelle = alle.get("schwelle"), warm = alle.get("warmhalten");
  if (schwelle || warm) zeilen.push({ label: "Succession", wert: nachfolgeWert(schwelle, warm), gruppe: "fleet", ziel: { art: "nachfolge" },
    titel: [schwelle, warm].flatMap((a) => a ? [titel(a)] : []).join("\n\n———\n\n") });

  const repoHooks = alle.get("hooks"), repoEinst = alle.get("cc-einstellungen");
  const repoSettings = ersteVon((d) => d.gruppe === "repo" && d.art === "Settings");
  if (repoHooks) zeilen.push({ label: "Hooks", gruppe: "repo", titel: titel(repoHooks),
    wert: hookZahl(repoHooks) ? liste((repoHooks.dateien ?? []).map((d) => ohneEndung(d.pfad)), hookZahl(repoHooks)) : "none",
    ziel: hookZahl(repoHooks) ? ziel(repoSettings, HOOKS_KEY) : null });
  if (repoEinst?.dateien?.length) zeilen.push({ label: "Settings", gruppe: "repo", titel: titel(repoEinst),
    wert: repoEinst.dateien.map((d) => `${d.pfad} · ${kB(d.bytes)}`).join(", "), ziel: ziel(repoSettings) });
  const mcpRepo = alle.get("mcp-repo");
  if (mcpRepo?.text) zeilen.push({ label: "MCP", gruppe: "repo", titel: titel(mcpRepo),
    wert: liste(mcpRepo.text.split("\n").map((z) => z.split(" · ")[0]!)), ziel: ziel("repo:mcp") });

  const eigenEinst = ersteVon((d) => d.gruppe === "eigen" && d.art === "Settings");
  const md = dateien.filter((d) => d.art === "Instructions");
  if (md.length) zeilen.push({ label: "CLAUDE.md", gruppe: "eigen", titel: "Your Claude Code files this session reads at its start",
    wert: md.map((d) => `${kurz(d.pfad ?? d.name)} · ${kB(d.bytes ?? 0)}`).join(", "),
    ziel: ziel(md[0]!.key) });
  const eigeneHooks = alle.get("hooks-eigene");
  if (eigeneHooks) zeilen.push({ label: "Hooks", gruppe: "eigen", titel: titel(eigeneHooks),
    wert: hookZahl(eigeneHooks) ? liste((eigeneHooks.dateien ?? []).map((d) => ohneEndung(d.pfad)), hookZahl(eigeneHooks)) : "none",
    ziel: hookZahl(eigeneHooks) ? eigenEinst ? ziel(eigenEinst, HOOKS_KEY) : ziel(ersteVon((d) => d.art === "Hook script" && d.gruppe === "eigen")) : null });
  const plugins = alle.get("plugins");
  if (plugins) {
    const an = pluginNamen(plugins);
    zeilen.push({ label: "Plugins", gruppe: "eigen", titel: titel(plugins), wert: plugins.text === null ? plugins.grund ?? "unknown" : liste(an),
      ziel: an.length ? ziel("eigen:plugins") : null });
  }
  const einst = alle.get("cc-einstellungen-eigene");
  if (einst) zeilen.push({ label: "Settings", gruppe: "eigen", titel: titel(einst),
    wert: einst.dateien?.length ? einst.dateien.map((d) => `${d.pfad} · ${kB(d.bytes)}`).join(", ") : "none", ziel: ziel(eigenEinst) });
  const eigenes = alle.get("claude-eigenes");
  for (const [, wort, einzeln] of ARTEN) {
    const da = dateien.filter((d) => d.art === einzeln);
    if (da.length) zeilen.push({ label: wort, gruppe: "eigen", titel: eigenes ? titel(eigenes) : "", wert: liste(da.map((d) => d.name)), ziel: ziel(da[0]!.key) });
  }
  const mcp = mcpNamen(eigenes);
  if (mcp.length) zeilen.push({ label: "MCP", gruppe: "eigen", titel: eigenes ? titel(eigenes) : "", wert: liste(mcp), ziel: ziel("eigen:mcp") });
  return zeilen;
}
