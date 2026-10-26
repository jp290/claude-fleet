// DAS EIGENE SETUP (server/eigenes-setup.ts): die Bindung des Listenschnitts und die gitignorierten Dateien eines Worktrees nach `.worktreeinclude`
import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eigenesSetup, eigenesSetupGewaehlt, listCutFrom, toolsDerTuer, werkzeugSchemaSatz, PERMISSION_MODES, permissionModeDerTuer, readListCut, kopiereWorktreeInclude, worktreeIncludeFiles } from "./eigenes-setup";
import { weglassenDerTuer, weglassenStart, weglassenZeilen } from "./weglassen";

const ordner: string[] = [];
afterEach(() => { for (const d of ordner.splice(0)) rmSync(d, { recursive: true, force: true }); });
const neu = (): string => { const d = mkdtempSync(join(tmpdir(), "eigenes-setup-")); ordner.push(d); return d; };

describe("wer im eigenen Setup startet", () => {
  test("nur ein Claude-Sitz ohne Rolle außerhalb von Fleets Repo", () => {
    expect(eigenesSetup({ claude: true, role: "generic", fleetRepo: false })).toBe(true);
    expect(eigenesSetup({ claude: true, role: "generic", fleetRepo: true })).toBe(false);
    for (const role of ["lane", "main", "orchestrator", null] as const) expect(eigenesSetup({ claude: true, role, fleetRepo: false })).toBe(false);
    expect(eigenesSetup({ claude: false, role: "generic", fleetRepo: false })).toBe(false);
  });
});

// WAS FLEET MITGIBT (Owner 23.10. ~22:30): ohne Wahl nichts, jede Wahl eine Zeile mit dem Namen ihres Türfelds
describe("was im eigenen Setup mitgegeben ist", () => {
  const nichts = { model: null, effort: null, permissionMode: null, rechte: null, profil: null, bibliothek: false, notizbuch: null, remote: false, packMcp: [], autoModeEnvironment: false, tools: null } as const;
  test("ohne Wahl keine Zeile", () => {
    expect(eigenesSetupGewaehlt(nichts)).toEqual([]);
  });
  test("jede Wahl eine Zeile „<feld>: <wert>“", () => {
    expect(eigenesSetupGewaehlt({ model: "claude-haiku-5-5", effort: "low", permissionMode: "auto", rechte: "lesen", profil: "planer", bibliothek: true,
      notizbuch: "aus", remote: true, packMcp: ["playwright", "figma"], autoModeEnvironment: true, tools: ["Bash", "Read"] })).toEqual(["model: claude-haiku-5-5", "effort: low",
      "permissionMode: auto", "tools: Bash, Read", "rechte: lesen", "bibliothek: on", "profil: planer", "notizbuch: aus", "remote: on", "mcp: playwright, figma", "autoModeEnvironment: on"]);
    expect(eigenesSetupGewaehlt({ ...nichts, notizbuch: "branch" })).toEqual(["notizbuch: branch"]);
    expect(eigenesSetupGewaehlt({ ...nichts, tools: [] })).toEqual(["tools: no built-in tools"]);
  });
  test("permissionMode nimmt genau Claude Codes Werte; ohne Feld keine Wahl", () => {
    expect(permissionModeDerTuer(undefined)).toEqual({ ok: true, wahl: null });
    for (const m of PERMISSION_MODES) expect(permissionModeDerTuer(m)).toEqual({ ok: true, wahl: m });
    expect([...PERMISSION_MODES].sort()).toEqual(["acceptEdits", "auto", "bypassPermissions", "dontAsk", "manual", "plan"]);
    for (const falsch of ["default", "", 1, true]) expect(permissionModeDerTuer(falsch).ok).toBe(false);
  });
});

// WAS AUS ~/.claude WEGBLEIBT (Runde 3): je Teil der Weg, den die Probe an claude 2.1.309 belegt hat, und je Teil eine Zeile in der Fassung
describe("die eingebauten Werkzeuge als Wahl", () => {
  test("eine Liste eingebauter Namen; [] ist keins; MCP-Werkzeuge gehören zu weglassen.mcp", () => {
    expect(toolsDerTuer(undefined)).toEqual({ ok: true, wahl: null });
    expect(toolsDerTuer([])).toEqual({ ok: true, wahl: [] });
    expect(toolsDerTuer(["Bash", "Read", "Bash"])).toEqual({ ok: true, wahl: ["Bash", "Read"] });
    expect(toolsDerTuer(["mcp__playwright__browser_click"])).toMatchObject({ ok: false, error: expect.stringContaining("weglassen.mcp") });
    for (const falsch of ["Bash", ["bash"], ["Bash(git:*)"], [1]]) expect(toolsDerTuer(falsch).ok).toBe(false);
  });
  test("die Fassung nennt die Schema-Bytes der Liste aus der Tabelle, Aufgeschobenes nur beim Namen", () => {
    const t = { gemessen: "2026-10-23", claude: "2.1.309", bytes: { Artifact: 36119, Bash: 3368, Read: 1923 } };
    expect(werkzeugSchemaSatz(["Bash", "Read", "TaskStop"], t)).toBe("Schemas at start: 5 291 B of 41 410 B (Bash 3 368, Read 1 923) · "
      + "deferred, only the name at start: TaskStop · measured 2026-10-23 on claude 2.1.309 (.fleet/werkzeug-schemas.json)");
    expect(werkzeugSchemaSatz(null, t)).toStartWith("Schemas at start: 41 410 B of 41 410 B (Artifact 36 119,");
    expect(werkzeugSchemaSatz(["Bash"], null)).toBeNull();
  });
});

describe("Teile aus ~/.claude weglassen", () => {
  test("die Tür nimmt nur die bekannten Teile in ihrer Form; leer ist keine Wahl", () => {
    expect(weglassenDerTuer(undefined)).toEqual({ ok: true, wahl: null });
    expect(weglassenDerTuer({})).toEqual({ ok: true, wahl: null });
    expect(weglassenDerTuer({ claudeMd: true, rules: false, agents: ["a", "a"], plugins: [] })).toEqual({ ok: true, wahl: { claudeMd: true, agents: ["a"] } });
    for (const falsch of [[], "claudeMd", { claudeMd: "ja" }, { agenten: ["a"] }, { agents: ["a b"] }, { plugins: ["figma"] }, { hooks: ["x"] }])
      expect(weglassenDerTuer(falsch).ok).toBe(false);
  });
  test("einzelne Regeldateien: absolute Pfade oder ~/…, ohne Musterzeichen; auf der Zeile als exakter Pfad", () => {
    expect(weglassenDerTuer({ dateien: ["/r/CLAUDE.md", "/r/CLAUDE.md", "~/x/AGENTS.md"] })).toEqual({ ok: true, wahl: { dateien: ["/r/CLAUDE.md", "~/x/AGENTS.md"] } });
    for (const falsch of [{ dateien: ["CLAUDE.md"] }, { dateien: ["/r/*.md"] }, { dateien: ["/r/[a].md"] }, { dateien: "/r/CLAUDE.md" }, { dateien: [""] }])
      expect(weglassenDerTuer(falsch).ok).toBe(false);
    expect(weglassenStart({ claudeMd: true, dateien: ["/r/CLAUDE.md"] }, "/h/.claude").excludes).toEqual(["/h/.claude/CLAUDE.md", "/r/CLAUDE.md"]);
    expect(weglassenZeilen({ dateien: ["/h/r/CLAUDE.md", "/x/AGENTS.md"] }, (p) => p.replace("/h", "~"))).toEqual(["dateien: ~/r/CLAUDE.md, /x/AGENTS.md"]);
  });
  test("je Teil sein Weg auf der Zeile", () => {
    const w = { claudeMd: true, rules: true, plugins: ["figma@claude-plugins-official"], agents: ["e2e-runner"], skills: ["audit"], mcp: ["playwright"], hooks: true } as const;
    expect(weglassenStart(w, "/h/.claude")).toEqual({ excludes: ["/h/.claude/CLAUDE.md", "/h/.claude/rules/**"], disallowed: ["Agent(e2e-runner)"],
      skillOverrides: { audit: "off" }, deny: ["mcp__playwright"], settings: { enabledPlugins: { "figma@claude-plugins-official": false }, disableAllHooks: true } });
    expect(weglassenStart(null, "/h/.claude")).toEqual({ excludes: [], disallowed: [], skillOverrides: {}, deny: [], settings: {} });
    expect(weglassenZeilen(w)).toEqual(["claudeMd: ~/.claude/CLAUDE.md", "rules: ~/.claude/rules/**", "plugins: figma@claude-plugins-official",
      "agents: e2e-runner", "skills: audit", "mcp: playwright (their tools; the server keeps running)", "hooks: all (also the status line and the @ suggestion)"]);
    expect(weglassenZeilen(null)).toEqual([]);
  });
});

describe("der Listenschnitt aus der lokalen Bindung", () => {
  test("ohne Datei kein Schnitt und kein Fehler; eine kaputte Datei gibt keinen Schnitt und ihren Grund", () => {
    const d = neu();
    expect(readListCut(join(d, "fehlt.json"))).toEqual({ entries: [], error: null });
    writeFileSync(join(d, "kaputt.json"), "{");
    const kaputt = readListCut(join(d, "kaputt.json"));
    expect(kaputt.entries).toEqual([]);
    expect(kaputt.error).toContain("kaputt.json");
  });
  test("ein Eintrag hat einen Namen im Zeichensatz, eine bekannte Herkunft und nur bekannte Rollen", () => {
    expect(listCutFrom([{ name: "docx", from: "synced-skill" }, { name: "handoff", from: "user-command", keep: ["main"] }]))
      .toEqual({ ok: true, entries: [{ name: "docx", from: "synced-skill" }, { name: "handoff", from: "user-command", keep: ["main"] }] });
    expect(listCutFrom({}).ok).toBe(false);
    expect(listCutFrom([{ name: "a'b", from: "bundled" }]).ok).toBe(false);
    expect(listCutFrom([{ name: "a", from: "anderswo" }]).ok).toBe(false);
    expect(listCutFrom([{ name: "a", from: "bundled", keep: ["generic"] }]).ok).toBe(false);
  });
});

describe("die gitignorierten Dateien des Nutzers nach .worktreeinclude", () => {
  const git = (cwd: string, ...args: string[]): void => { Bun.spawnSync(["git", ...args], { cwd }); };
  test("ohne .worktreeinclude null; mit ihr genau, was ein Muster trifft und gitignoriert ist", async () => {
    const d = neu();
    git(d, "init", "-q");
    expect(await worktreeIncludeFiles(d)).toBeNull();
    writeFileSync(join(d, ".gitignore"), ".env\nCLAUDE.md\n.claude/skills/\ngeheim/\n");
    writeFileSync(join(d, ".worktreeinclude"), ".env\nCLAUDE.md\n.claude/skills/**\nfrei.txt\n");
    mkdirSync(join(d, ".claude", "skills", "x"), { recursive: true });
    mkdirSync(join(d, "geheim"));
    for (const [pfad, text] of [[".env", "A=1"], ["CLAUDE.md", "regel"], [".claude/skills/x/SKILL.md", "s"], ["geheim/k", "k"], ["frei.txt", "f"]])
      writeFileSync(join(d, pfad), text);
    expect((await worktreeIncludeFiles(d))?.sort()).toEqual([".claude/skills/x/SKILL.md", ".env", "CLAUDE.md"]);
  });
  // wie `cp -a` (Orchestratorin 24.10., Befund fremdes-repo-weg 3d): ein .venv blieb nach der Kopie ohne Ausführrechte und mit aufgelösten Links
  test("die Kopie behält Modus und Symlinks, überschreibt nichts und lässt den Server weiterlaufen", async () => {
    const quelle = neu(), ziel = neu(), aussen = neu();
    mkdirSync(join(quelle, ".venv", "bin"), { recursive: true });
    writeFileSync(join(quelle, ".venv", "bin", "python3.12"), "#!/bin/sh\necho py\n");
    chmodSync(join(quelle, ".venv", "bin", "python3.12"), 0o755);
    symlinkSync("python3.12", join(quelle, ".venv", "bin", "python"));
    writeFileSync(join(aussen, "lib.txt"), "draußen");
    symlinkSync(join(aussen, "lib.txt"), join(quelle, ".venv", "aussen"));
    writeFileSync(join(quelle, ".env"), "A=1");
    chmodSync(join(quelle, ".env"), 0o600);
    writeFileSync(join(quelle, "schon.txt"), "neu");
    writeFileSync(join(ziel, "schon.txt"), "alt");
    const viele = Array.from({ length: 400 }, (_, i) => `.venv/lib/f${i}.py`);
    mkdirSync(join(quelle, ".venv", "lib"));
    for (const f of viele) writeFileSync(join(quelle, f), "x");
    let ticks = 0;
    const uhr = setInterval(() => { ticks++; }, 0);
    const n = await kopiereWorktreeInclude(quelle, ziel, [".venv/bin/python3.12", ".venv/bin/python", ".venv/aussen", ".env", "schon.txt", ...viele]);
    clearInterval(uhr);
    expect(ticks).toBeGreaterThan(0);
    expect(n).toBe(404);
    expect(statSync(join(ziel, ".venv", "bin", "python3.12")).mode & 0o777).toBe(0o755);
    expect(Bun.spawnSync([join(ziel, ".venv", "bin", "python")]).stdout.toString()).toBe("py\n");
    expect(lstatSync(join(ziel, ".venv", "bin", "python")).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(ziel, ".venv", "bin", "python"))).toBe("python3.12");
    expect(lstatSync(join(ziel, ".venv", "aussen")).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(ziel, ".venv", "aussen"))).toBe(join(aussen, "lib.txt"));
    expect(statSync(join(ziel, ".env")).mode & 0o777).toBe(0o600);
    expect(readFileSync(join(ziel, "schon.txt"), "utf8")).toBe("alt");
    expect(readFileSync(join(ziel, viele[399]!), "utf8")).toBe("x");
    expect(await kopiereWorktreeInclude(quelle, ziel, [".env"])).toBe(0);
  });
});
