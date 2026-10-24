// Tests für das, was einen Claude-Sitz außer Fleets Zeile formt (server/fassung-umfeld.ts): Hooks, Plugins, die eigenen Einstellungen des
// Owners, die Übergabe-Schwelle und das Cache-Warmhalten. Jeder dieser Teile ändert den Hash, wenn er sich ändert; was dem Owner gehört,
// trägt seine Marke; derselbe Inhalt an einem anderen Ort ist dieselbe Fassung; ein Geheimnis steht nicht im Text.
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { baueFassung, fuehreNach, textAbschnitt, type FassungEingang } from "./fassung";
import { leseUmfeld, schwelleAbschnitt, umfeldAbschnitte, warmhaltenAbschnitt, type SchwelleFakten, type WarmFakten } from "./fassung-umfeld";
import { setupDateien, umfeldZeilen } from "../src/fassung-umfeld-zeilen";

const ordner: string[] = [];
afterEach(() => { for (const d of ordner.splice(0)) rmSync(d, { recursive: true, force: true }); });

interface Welt { home: string; config: string; cwd: string }
// ein Home mit ~/.claude (Einstellungen, ein Hook-Skript, ein installiertes Plugin mit eigenem Hook) und ein Repo mit .claude/settings.json
function welt(o: { repoName?: string; ownerSettings?: Record<string, unknown>; skript?: string; pluginAn?: boolean; agent?: string } = {}): Welt {
  const home = mkdtempSync(join(tmpdir(), "umfeld-"));
  ordner.push(home);
  const config = join(home, ".claude"), cwd = join(home, o.repoName ?? "repo");
  mkdirSync(join(config, "hooks"), { recursive: true });
  writeFileSync(join(config, "hooks", "guard.sh"), o.skript ?? "#!/bin/sh\nexit 0\n");
  const plugin = join(config, "plugins", "cache", "m", "p1", "1.0.0");
  mkdirSync(join(plugin, "hooks"), { recursive: true });
  mkdirSync(join(plugin, "skills", "s1"), { recursive: true });
  writeFileSync(join(plugin, "hooks", "hooks.json"), JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/stop.sh\"" }] }] } }));
  writeFileSync(join(plugin, "hooks", "stop.sh"), "echo stop\n");
  writeFileSync(join(config, "plugins", "installed_plugins.json"), JSON.stringify({ version: 2, plugins: { "p1@m": [{ scope: "user", installPath: plugin, version: "1.0.0" }] } }));
  writeFileSync(join(config, "settings.json"), JSON.stringify(o.ownerSettings ?? {
    model: "opus", env: { GEHEIM_TOKEN: "sk-wert-123456" },
    hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "~/.claude/hooks/guard.sh" }] }] },
    enabledPlugins: { "p1@m": o.pluginAn ?? true },
  }));
  mkdirSync(join(config, "agents"), { recursive: true });
  writeFileSync(join(config, "agents", "pruefer.md"), o.agent ?? "---\nname: pruefer\n---\nPrüft.\n");
  mkdirSync(join(config, "skills", "eins"), { recursive: true });
  writeFileSync(join(config, "skills", "eins", "SKILL.md"), "---\nname: eins\n---\n");
  mkdirSync(join(config, "skills", "synced", "k1", "zwei"), { recursive: true });
  writeFileSync(join(config, "skills", "synced", "k1", "zwei", "SKILL.md"), "---\nname: zwei\n---\n");
  mkdirSync(join(config, "commands"), { recursive: true });
  writeFileSync(join(config, "commands", "los.md"), "Los.\n");
  mkdirSync(join(config, "rules"), { recursive: true });
  writeFileSync(join(config, "rules", "ts.md"), "---\npaths:\n  - \"**/*.ts\"\n---\nRegel.\n");
  writeFileSync(join(home, ".claude.json"), JSON.stringify({ oauthAccount: { emailAddress: "geheim@example.org" },
    mcpServers: { suche: { command: "npx", args: ["suche-mcp"], env: { SUCHE_TOKEN: "sk-mcp-0123456789abcdef0123456789abcdef" } } } }));
  mkdirSync(join(cwd, ".claude", "hooks"), { recursive: true });
  writeFileSync(join(cwd, ".mcp.json"), JSON.stringify({ mcpServers: { repo: { type: "http", url: "http://localhost:1/mcp" } } }));
  writeFileSync(join(cwd, ".claude", "hooks", "perm.ts"), "console.log(1)\n");
  writeFileSync(join(cwd, ".claude", "settings.json"), JSON.stringify({
    hooks: { PermissionRequest: [{ matcher: "", hooks: [{ type: "command", command: "bun \"$CLAUDE_PROJECT_DIR/.claude/hooks/perm.ts\" decide" }] }] } }));
  return { home, config, cwd };
}
const abschnitte = (w: Welt) => umfeldAbschnitte(leseUmfeld({ configDir: w.config, home: w.home, cwd: w.cwd, managed: null }), w.home, w.cwd);
const SCHWELLE: SchwelleFakten = { art: "bau", basePct: 35, capPct: 45, von: "session", envName: "FLEET_MIGRATE_PCT", aus: null, wahl: "hint", hinweis: true };
const WARM: WarmFakten = { an: false, von: "fleet", ausGrund: null, ruheMin: 50, text: "[fleet] Cache warmhalten.", hoechstens: 24, jeStunde: 2, lebensdauerMin: 60 };
const fassung = (w: Welt, o: { schwelle?: SchwelleFakten; warm?: WarmFakten } = {}) => {
  const u = abschnitte(w);
  const e: FassungEingang = { slot: 4, anlass: "laufend", wer: [textAbschnitt("harness", "Slot.harness", "claude")], aufgabe: [],
    liest: [textAbschnitt("rolle", "x", "Rolle")], darf: [textAbschnitt("darf", "Slot.rechte", "keine"), ...u.darf],
    arbeitet: [textAbschnitt("arbeitet", "x", "Empfänger: unbekannt"), schwelleAbschnitt(o.schwelle ?? SCHWELLE), warmhaltenAbschnitt(o.warm ?? WARM), ...u.arbeitet] };
  return baueFassung(e);
};
const abschnitt = (f: ReturnType<typeof baueFassung>, id: string) => f.teile.flatMap((t) => t.abschnitte).find((a) => a.id === id)!;

describe("die vier Teile stehen in der Fassung, jeder an seinem Ort", () => {
  test("Hooks und Einstellungen unter „Darf“, Plugins, Schwelle und Warmhalten unter „Arbeitet mit“", () => {
    const f = fassung(welt());
    const ids = (teil: string) => f.teile.find((t) => t.id === teil)!.abschnitte.map((a) => a.id);
    expect(ids("darf")).toEqual(["darf", "hooks", "hooks-eigene", "cc-einstellungen", "cc-einstellungen-eigene"]);
    expect(ids("arbeitet")).toEqual(["arbeitet", "schwelle", "warmhalten", "claude-eigenes", "mcp-repo", "plugins"]);
  });

  test("jeder Hook nennt Ereignis, Matcher, Befehl, Skript mit Bytes und seine Quelle", () => {
    const f = fassung(welt());
    expect(abschnitt(f, "hooks").text).toBe("PermissionRequest · bun \"$CLAUDE_PROJECT_DIR/.claude/hooks/perm.ts\" decide\n"
      + "  Skript .claude/hooks/perm.ts · 15 B · sha256 " + abschnitt(f, "hooks").text!.match(/sha256 ([0-9a-f]{12})/)![1] + "\n  aus .claude/settings.json");
    expect(abschnitt(f, "hooks").dateien).toEqual([{ pfad: ".claude/hooks/perm.ts", bytes: 15 }]);
    const eigene = abschnitt(f, "hooks-eigene").text!;
    expect(eigene).toContain("PreToolUse · Bash · ~/.claude/hooks/guard.sh\n  Skript ~/.claude/hooks/guard.sh · 17 B");
    expect(eigene).toContain("aus ~/.claude/settings.json");
    // der Hook des Plugins läuft mit und steht bei den eigenen, mit dem Plugin als Quelle
    expect(eigene).toContain("Stop · bash \"${CLAUDE_PLUGIN_ROOT}/hooks/stop.sh\"\n  Skript ~/.claude/plugins/cache/m/p1/1.0.0/hooks/stop.sh · 10 B");
    expect(eigene).toContain("aus ~/.claude/plugins/cache/m/p1/1.0.0/hooks/hooks.json");
  });

  test("Schwelle und Warmhalten nennen Wert und Quelle", () => {
    const f = fassung(welt());
    expect(abschnitt(f, "schwelle")).toMatchObject({ quelle: "Slot.handover (für diese Session gesetzt)",
      text: "Übergabe ab 35 % · fällig ab 45 % · an der Schwelle: Hinweis · Hinweis an" });
    expect(abschnitt(fassung(welt(), { schwelle: { ...SCHWELLE, von: "env" } }), "schwelle").quelle).toBe("FLEET_MIGRATE_PCT (.env)");
    expect(abschnitt(f, "warmhalten")).toMatchObject({ text: "Cache warmhalten aus", bytes: 0 });
    const an = abschnitt(fassung(welt(), { warm: { ...WARM, an: true } }), "warmhalten");
    expect(an.text).toBe("Cache warmhalten an: nach 50 min Ruhe (Cache lebt 60 min) tippt Fleet höchstens 24 Züge, 2 je Stunde:\n[fleet] Cache warmhalten.");
    expect(an.bytes).toBe(Buffer.byteLength("[fleet] Cache warmhalten."));
  });
});

describe("was sich ändert, ändert den Hash", () => {
  const basis = () => fassung(welt()).hash;
  test("ein anderes Byte in einem Hook-Skript", () => expect(fassung(welt({ skript: "#!/bin/sh\nexit 1\n" })).hash).not.toBe(basis()));
  test("ein Hook mehr in den eigenen Einstellungen", () => {
    const mehr = welt({ ownerSettings: { model: "opus", env: { GEHEIM_TOKEN: "sk-wert-123456" }, enabledPlugins: { "p1@m": true }, hooks: {
      PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "~/.claude/hooks/guard.sh" }] }],
      Stop: [{ hooks: [{ type: "command", command: "~/.claude/hooks/guard.sh" }] }] } } });
    expect(fassung(mehr).hash).not.toBe(basis());
  });
  test("eine andere eigene Einstellung", () => expect(fassung(welt({ ownerSettings: { model: "sonnet", env: { GEHEIM_TOKEN: "sk-wert-123456" },
    hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "~/.claude/hooks/guard.sh" }] }] },
    enabledPlugins: { "p1@m": true } } })).hash).not.toBe(basis()));
  test("ein Plugin aus statt an", () => expect(fassung(welt({ pluginAn: false })).hash).not.toBe(basis()));
  test("eine andere Schwelle, eine andere Wahl, ein ausgeschalteter Hinweis; die Herkunft desselben Werts ist Anzeige", () => {
    const w = welt(), a = fassung(w).hash;
    expect(fassung(w, { schwelle: { ...SCHWELLE, basePct: 40, capPct: 50 } }).hash).not.toBe(a);
    expect(fassung(w, { schwelle: { ...SCHWELLE, wahl: "compact" } }).hash).not.toBe(a);
    expect(fassung(w, { schwelle: { ...SCHWELLE, hinweis: false } }).hash).not.toBe(a);
    expect(fassung(w, { schwelle: { ...SCHWELLE, aus: "FLEET_MIGRATE_PCT ist 0, Fleet hat keinen Übergabe-Takt" } }).hash).not.toBe(a);
    expect(fassung(w, { schwelle: { ...SCHWELLE, von: "env" } }).hash).toBe(a);
  });
  test("Warmhalten an, eine andere Ruhezeit, ein anderer Text", () => {
    const w = welt(), a = fassung(w).hash, an = fassung(w, { warm: { ...WARM, an: true } }).hash;
    expect(an).not.toBe(a);
    expect(fassung(w, { warm: { ...WARM, an: true, ruheMin: 40 } }).hash).not.toBe(an);
    expect(fassung(w, { warm: { ...WARM, an: true, text: "anders" } }).hash).not.toBe(an);
  });
  test("ein neuer Wert unter env ändert den Hash, steht aber nicht im Text", () => {
    const w2 = welt({ ownerSettings: { model: "opus", env: { GEHEIM_TOKEN: "sk-anderer-987654" },
      hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "~/.claude/hooks/guard.sh" }] }] }, enabledPlugins: { "p1@m": true } } });
    expect(fassung(w2).hash).not.toBe(basis());
    const text = abschnitt(fassung(welt()), "cc-einstellungen-eigene").text!;
    expect(text).not.toContain("sk-wert-123456");
    expect(text).toMatch(/"GEHEIM_TOKEN": "sha256:[0-9a-f]{12}"/);
  });
});

describe("das übrige Eigene in ~/.claude", () => {
  test("Agenten, Skills (auch vom Konto), Befehle, Regeln und MCP-Server stehen mit Bytes; ein Schlüssel und das Konto nicht", () => {
    const f = fassung(welt());
    const t = abschnitt(f, "claude-eigenes").text!;
    expect(t).toMatch(/^Agenten 1: pruefer \d+ B [0-9a-f]{12}$/m);
    expect(t).toMatch(/^Skills 2: eins \d+ B [0-9a-f]{12}, zwei \(vom Konto\) \d+ B [0-9a-f]{12}$/m);
    expect(t).toMatch(/^Befehle 1: los 5 B /m);
    expect(t).toMatch(/^Regeln 1: ts\.md \(bei passenden Pfaden\) /m);
    expect(t).toContain("MCP-Server aus ~/.claude.json 1: suche · stdio npx suche-mcp · env SUCHE_TOKEN");
    expect(t).toContain("Konnektoren des claude.ai-Kontos: stehen in keiner Datei");
    expect(t).not.toContain("sk-mcp-");
    expect(t).not.toContain("geheim@example.org");
    expect(abschnitt(f, "claude-eigenes").eigentum).toBe("owner");
    // ein MCP-Server des Repos gehört dem Repo
    expect(abschnitt(f, "mcp-repo")).toMatchObject({ text: "repo · http http://localhost:1/mcp" });
    expect(abschnitt(f, "mcp-repo").eigentum).toBeUndefined();
  });
  test("ein geänderter eigener Agent ändert den Hash", () => {
    expect(fassung(welt({ agent: "---\nname: pruefer\n---\nPrüft streng.\n" })).hash).not.toBe(fassung(welt()).hash);
  });
  test("das Board nennt es je Art mit Zahl und Namen", () => {
    const zeilen = umfeldZeilen(fassung(welt()).teile).filter((z) => z.gruppe === "eigen");
    expect(["Agents", "Skills", "Commands", "Rules", "MCP"].map((l) => zeilen.find((z) => z.label === l)?.wert))
      .toEqual(["1 · pruefer", "2 · eins, zwei", "1 · los", "1 · ts", "1 · suche"]);
  });
});

describe("derselbe Inhalt an einem anderen Ort", () => {
  test("ein anderes Home und ein anderer Repo-Ordner ergeben denselben Hash", () => {
    expect(fassung(welt({ repoName: "anderswo" })).hash).toBe(fassung(welt()).hash);
  });
});

describe("was dem Owner gehört", () => {
  test("seine Hooks, Einstellungen und Plugins tragen die Marke, die des Repos nicht", () => {
    const f = fassung(welt());
    expect(["hooks-eigene", "cc-einstellungen-eigene", "plugins"].map((id) => abschnitt(f, id).eigentum)).toEqual(["owner", "owner", "owner"]);
    expect(["hooks", "cc-einstellungen", "schwelle", "warmhalten"].map((id) => abschnitt(f, id).eigentum)).toEqual([undefined, undefined, undefined, undefined]);
  });
  test("das Board sagt je Zeile, woher sie kommt", () => {
    const zeilen = umfeldZeilen(fassung(welt()).teile);
    expect(zeilen.map((z) => [z.gruppe, z.label])).toEqual([
      ["fleet", "Succession"], ["repo", "Hooks"], ["repo", "Settings"], ["repo", "MCP"],
      ["eigen", "Hooks"], ["eigen", "Plugins"], ["eigen", "Settings"], ["eigen", "Agents"], ["eigen", "Skills"], ["eigen", "Commands"],
      ["eigen", "Rules"], ["eigen", "MCP"],
    ]);
    expect(zeilen[0]!.wert).toBe("hand over at 35 %, due at 45 % · cache not kept warm");
  });
  test("jede Zeile führt dahin, wo sie gesetzt wird", () => {
    const w = welt(), teile = fassung(w).teile;
    const zeilen = umfeldZeilen(teile, w.cwd), dateien = setupDateien(teile, w.cwd);
    const ziel = (gruppe: string, label: string) => {
      const z = zeilen.find((x) => x.gruppe === gruppe && x.label === label)?.ziel;
      if (z?.art !== "datei") return z?.art ?? null;
      const d = dateien.find((x) => x.key === z.key);
      return d ? d.pfad ?? `Text: ${d.name}` : "kein Eintrag";
    };
    expect(ziel("fleet", "Succession")).toBe("nachfolge");
    expect(ziel("repo", "Hooks")).toBe(join(w.cwd, ".claude", "settings.json"));
    expect(ziel("eigen", "Hooks")).toBe("~/.claude/settings.json");
    expect(ziel("eigen", "Agents")).toBe("~/.claude/agents/pruefer.md");
    expect(ziel("eigen", "Plugins")).toBe("Text: Plugins");
    expect(dateien.find((d) => d.key === "eigen:plugins")?.auch?.pfad).toBe("~/.claude/settings.json");
  });
  test("ohne Hooks führt die Zeile nirgends hin", () => {
    const w = welt({ ownerSettings: { model: "opus" } });
    expect(umfeldZeilen(fassung(w).teile, w.cwd).find((z) => z.gruppe === "eigen" && z.label === "Hooks")).toMatchObject({ wert: "none", ziel: null });
  });
});

describe("Schwelle und Warmhalten nach dem Start", () => {
  test("ein geänderter Wert ersetzt den Abschnitt, rechnet den Hash neu und nennt ihn", () => {
    const f = fassung(welt());
    const nach = fuehreNach(f, "arbeitet", [schwelleAbschnitt({ ...SCHWELLE, basePct: 50, capPct: 60 }), warmhaltenAbschnitt(WARM)]);
    expect(nach.geaendert).toEqual(["schwelle"]);
    expect(nach.fassung.hash).not.toBe(f.hash);
    expect(abschnitt(nach.fassung, "schwelle").text).toStartWith("Übergabe ab 50 %");
  });
  test("unverändert bleibt der Hash des Starts", () => {
    const f = fassung(welt());
    const nach = fuehreNach(f, "arbeitet", [schwelleAbschnitt(SCHWELLE), warmhaltenAbschnitt(WARM)]);
    expect(nach.geaendert).toEqual([]);
    expect(nach.fassung.hash).toBe(f.hash);
  });
  test("ein Start von vor diesen Abschnitten bekommt sie nicht angehängt", () => {
    const alt = baueFassung({ slot: 1, anlass: "laufend", wer: [], aufgabe: [], liest: [], darf: [], arbeitet: [textAbschnitt("arbeitet", "x", "y")] });
    const nach = fuehreNach(alt, "arbeitet", [schwelleAbschnitt(SCHWELLE)]);
    expect(nach.fassung).toBe(alt);
  });
});

// DAS EIGENE SETUP IM BOARD (server/eigenes-setup.ts): der Modus in Worten zuerst, darunter je Zeile, was Fleet dazulegt, mit dem Grund im Tooltip
describe("ein Sitz im eigenen Setup", () => {
  test("das Board nennt den Modus und genau das, was Fleet dazulegt", () => {
    const teile = [{ id: "darf", abschnitte: [{ id: "eigenes-setup", quelle: null, bytes: 0 as const,
      text: "Eigenes Setup: so wie von Hand.\n- --session-id bzw. --resume: damit Fleet das Gespräch findet\n- FLEET_SELF_TOKEN: der Ausweis" },
      { id: "mitgegeben", quelle: null, bytes: 0 as const, text: "model: claude-haiku-5-5\nnotizbuch: aus" }] }];
    const gewaehlt = "Beim Öffnen dieser Sitzung gewählt. Ohne Wahl gibt Fleet nichts mit.";
    expect(umfeldZeilen(teile).map((z) => [z.label, z.wert, z.titel])).toEqual([
      ["Modus", "eigenes Setup — dein Claude Code, wie du es selbst startest", "Eigenes Setup: so wie von Hand."],
      ["Fleet legt dazu", "--session-id bzw. --resume", "damit Fleet das Gespräch findet"],
      ["", "FLEET_SELF_TOKEN", "der Ausweis"],
      ["Mitgegeben", "model: claude-haiku-5-5", gewaehlt],
      ["", "notizbuch: aus", gewaehlt],
    ]);
    const ohne = [{ id: "darf", abschnitte: [teile[0]!.abschnitte[0]!, { id: "mitgegeben", quelle: null, bytes: 0 as const, text: "nichts" }] }];
    expect(umfeldZeilen(ohne).filter((z) => z.label === "Mitgegeben").map((z) => z.wert)).toEqual(["nichts"]);
    // was aus ~/.claude wegbleibt, je Teil eine Zeile unter „Weggelassen“
    const weg = [{ id: "darf", abschnitte: [...ohne[0]!.abschnitte, { id: "weggelassen", quelle: null, bytes: 0 as const,
      text: "claudeMd: ~/.claude/CLAUDE.md\nhooks: alle (auch Statuszeile und @-Vorschlag)" }] }];
    expect(umfeldZeilen(weg).filter((z) => z.label === "Weggelassen" || z.wert.startsWith("hooks:")).map((z) => [z.label, z.wert]))
      .toEqual([["Weggelassen", "claudeMd: ~/.claude/CLAUDE.md"], ["", "hooks: alle (auch Statuszeile und @-Vorschlag)"]]);
    expect(umfeldZeilen([]).find((z) => z.label === "Modus")).toBeUndefined();
  });
  test("das Board zeigt, was die Schemas der Werkzeuge am Start kosten, je Werkzeug", () => {
    const teile = [{ id: "darf", abschnitte: [{ id: "eigenes-setup", quelle: null, bytes: 0 as const, text: "Eigenes Setup: so wie von Hand." },
      { id: "mitgegeben", quelle: null, bytes: 0 as const, text: "tools: Bash,Read" },
      { id: "werkzeuge", quelle: "server/eigenes-setup.ts#eigenesSetup", bytes: 0 as const, text: "--tools Bash,Read\n--disallowedTools keine",
        grund: "Schemas am Start: 9 000 B von 74 818 B (Bash 7 000, Read 2 000) · gemessen 2026-10-23 an claude 2.1.309 (.fleet/werkzeug-schemas.json)" }] }];
    const zeile = umfeldZeilen(teile).find((z) => z.label === "Werkzeuge");
    expect(zeile?.wert).toBe("Schemas am Start: 9 000 B von 74 818 B (Bash 7 000, Read 2 000)");
    expect(zeile?.titel).toContain("gemessen 2026-10-23 an claude 2.1.309 (.fleet/werkzeug-schemas.json)");
    expect(zeile?.titel).toContain("--tools Bash,Read");
  });
});
