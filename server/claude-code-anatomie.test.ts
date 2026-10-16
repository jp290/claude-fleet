// K15 · was Claude Code selbst in den Start legt, aufgeschlüsselt (Owner 16.10. 11:3x: „[Zitat entfernt]“):
// der Auszug aus einem Transkript (Anhänge vor der ersten Antwort) und aus der init-Zeile von `claude -p --output-format stream-json`.
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { anatomieAusInit, anatomieAusTranskript, anatomieFuerRolle, kandidatenAus, kopfVon, transkriptKopf, waehleQuelle,
  type Anatomie, type FleetTeil, type Kandidat, type Kopf, type Orte } from "./claude-code-anatomie";

const z = (o: unknown): string => JSON.stringify(o);
const anhang = (attachment: unknown): string => z({ type: "attachment", attachment });
const ANTWORT = z({ type: "assistant", message: { usage: { input_tokens: 2, cache_creation_input_tokens: 26_000, cache_read_input_tokens: 4_000, output_tokens: 9 } } });
const START = [
  z({ type: "user", message: { content: "ok" } }),
  anhang({ type: "deferred_tools_delta", addedNames: ["CronCreate", "Monitor", "mcp__claude_ai_Gmail__authenticate"] }),
  anhang({ type: "agent_listing_delta", addedTypes: ["analyst", "Explore"], addedLines: ["- analyst: Liest Code.", "- Explore: Sucht breit."], builtInTypes: ["Explore"] }),
  anhang({ type: "mcp_instructions_delta", addedNames: ["claude.ai Claude Docs"], addedBlocks: ["## claude.ai Claude Docs\nLebende Dokumente."] }),
  anhang({ type: "skill_listing", names: ["graphify", "unslop"], skillCount: 2, content: "- graphify: Baut einen Graphen.\n  über mehrere Zeilen\n- unslop: Schneidet Füllmuster." }),
  anhang({ type: "instructions", files: [{ path: "/home/x/.claude/CLAUDE.md", content: "Regeln für alles" }] }),
  anhang({ type: "prompt_snapshot", systemPrompt: ["\nDu bist ein Agent.", "__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__", "# Umgebung\n- Bun", "FLEET-LISTENSCHNITT (lane): weg"] }),
];

describe("anatomieAusTranskript", () => {
  test("liest die Anhänge vor der ersten Antwort: Systemprompt in Abschnitten, Listen, Dateien, Tokens", () => {
    const a = anatomieAusTranskript([...START, ANTWORT].join("\n"));
    if (typeof a === "string") throw new Error(a);
    expect(a.systemprompt).toEqual([
      { text: "\nDu bist ein Agent.", bytes: 19 },
      { text: "# Umgebung\n- Bun", bytes: 16 },
      { text: "FLEET-LISTENSCHNITT (lane): weg", bytes: 31 },
    ]);
    expect(a.skills).toEqual([
      { name: "graphify", text: "- graphify: Baut einen Graphen.\n  über mehrere Zeilen", bytes: 54 },
      { name: "unslop", text: "- unslop: Schneidet Füllmuster.", bytes: 32 },
    ]);
    expect(a.agenten).toEqual([
      { name: "analyst", text: "- analyst: Liest Code.", eingebaut: false },
      { name: "Explore", text: "- Explore: Sucht breit.", eingebaut: true },
    ]);
    expect(a.aufgeschoben).toEqual(["CronCreate", "Monitor"]);
    expect(a.mcpWerkzeuge).toEqual(["mcp__claude_ai_Gmail__authenticate"]);
    expect(a.mcp).toEqual([{ name: "claude.ai Claude Docs", text: "## claude.ai Claude Docs\nLebende Dokumente." }]);
    expect(a.dateien).toEqual([{ pfad: "/home/x/.claude/CLAUDE.md", bytes: 17 }]);
    expect(a.tokens).toBe(30_002);
  });
  test("was nach der ersten Antwort kommt, gehört nicht zum Start", () => {
    const spaeter = anhang({ type: "skill_listing", names: ["neu"], content: "- neu: später" });
    const a = anatomieAusTranskript([...START, ANTWORT, spaeter].join("\n"));
    if (typeof a === "string") throw new Error(a);
    expect(a.skills.map((s) => s.name)).toEqual(["graphify", "unslop"]);
  });
  test("ein Skill ohne eigene Zeile in der Liste steht mit leerem Text da, statt zu verschwinden", () => {
    const a = anatomieAusTranskript([anhang({ type: "skill_listing", names: ["ohne"], content: "" }), START.at(-1), ANTWORT].join("\n"));
    if (typeof a === "string") throw new Error(a);
    expect(a.skills).toEqual([{ name: "ohne", text: "", bytes: 0 }]);
  });
  test("kaputte Zeilen überspringt der Auszug; ohne Antwort sind die Tokens unbekannt", () => {
    const a = anatomieAusTranskript(["{ kaputt", ...START].join("\n"));
    if (typeof a === "string") throw new Error(a);
    expect(a.systemprompt.length).toBe(3);
    expect(a.tokens).toBeNull();
  });
  test("ohne Systemprompt-Abbild vor der ersten Antwort: abgelehnt mit Grund", () => {
    expect(anatomieAusTranskript([START[0], ANTWORT, START.at(-1)].join("\n"))).toBe("kein prompt_snapshot vor der ersten Antwort");
    expect(anatomieAusTranskript("")).toBe("kein prompt_snapshot vor der ersten Antwort");
  });
});

describe("anatomieAusInit", () => {
  const INIT = { type: "system", subtype: "init", claude_code_version: "2.1.301", tools: ["Bash", "Read"], mcp_servers: [{ name: "playwright", status: "connected" }],
    agents: ["analyst"], skills: ["graphify", "figma:figma-use"], slash_commands: ["graphify", "audit"],
    plugins: [{ name: "figma", source: "figma@claude-plugins-official", path: "/p/figma" }] };
  test("liest Werkzeuge, MCP-Server, Agenten, Skills, Befehle und Plugins mit Quelle", () => {
    expect(anatomieAusInit([z({ type: "system", subtype: "hook" }), z(INIT), z({ type: "result" })].join("\n"))).toEqual({
      claude: "2.1.301", werkzeuge: ["Bash", "Read"], mcpServer: [{ name: "playwright", status: "connected" }], agenten: ["analyst"],
      skills: ["graphify", "figma:figma-use"], befehle: ["graphify", "audit"], plugins: [{ name: "figma", quelle: "figma@claude-plugins-official", pfad: "/p/figma" }] });
  });
  test("ohne init-Zeile oder mit schiefer Form: abgelehnt mit Grund", () => {
    expect(anatomieAusInit(z({ type: "result" }))).toBe("keine init-Zeile");
    expect(anatomieAusInit(z({ ...INIT, tools: "Bash" }))).toBe("init-Zeile schief: tools");
  });
});

// --- die erste Anfrage (api-request-shape), der Kopf, die Quelle und die Aufschlüsselung je Rolle (Entscheid der Bauleitung 80917044) ---
const WERKZEUG_BASH = { name: "Bash", description: "Führt Befehle aus.", input_schema: { type: "object", properties: { command: {}, timeout: {} } } };
const FORM = z({ type: "api-request-shape", version: "2.1.301", shape: {
  system: [{ type: "text", text: "Du bist Claude Code." }, { type: "text", text: "\nDu bist ein Agent." }, { type: "text", text: "# Umgebung\n- Bun\n\nFLEET-LISTENSCHNITT (lane): weg" }],
  tools: [WERKZEUG_BASH, { name: "Read", description: "Liest.", input_schema: { type: "object", properties: { path: {} } } },
    { name: "Workflow", description: "Viele Agenten.", input_schema: { type: "object", properties: {} } },
    { type: "advisor_20260301", name: "advisor", model: "x", defer_loading: true }] } });
const BLOB = z({ type: "api-request-blob", message: { role: "user", content: [{ type: "text", text: "1234567890" }] } });
const MIT_ZEIT = (o: Record<string, unknown>) => z({ ...o, version: "2.1.301", timestamp: "2026-10-16T09:00:00.000Z", cwd: "/r/fleet", entrypoint: "cli" });
const KOPF = [MIT_ZEIT({ type: "user", message: { content: "ok" } }), ...START.slice(1), FORM, BLOB,
  z({ type: "assistant", message: { model: "claude-opus-5-5", usage: { input_tokens: 0, cache_creation_input_tokens: 100, cache_read_input_tokens: 0 } } })];
const ANAT = (() => { const a = anatomieAusTranskript(KOPF.join("\n")); if (typeof a === "string") throw new Error(a); return a; })();

describe("anatomieAusTranskript · die erste Anfrage", () => {
  test("Werkzeuge mit den Bytes ihrer Definition, der Identitätsblock, Version, Modell, Start und die Bytes der Anfrage", () => {
    expect(ANAT.werkzeuge.map((w) => [w.name, w.abruf, w.server])).toEqual([["Bash", false, false], ["Read", false, false], ["Workflow", false, false], ["advisor", true, true]]);
    expect(ANAT.werkzeuge[0]).toEqual({ name: "Bash", bytes: Buffer.byteLength(JSON.stringify(WERKZEUG_BASH)), text: "Führt Befehle aus.\n\nParameter: command, timeout", abruf: false, server: false });
    expect(ANAT.identitaet).toEqual({ text: "Du bist Claude Code.", bytes: 20 });
    expect([ANAT.version, ANAT.modell, ANAT.seit]).toEqual(["2.1.301", "claude-opus-5-5", Date.parse("2026-10-16T09:00:00.000Z")]);
    const system = 20 + Buffer.byteLength("\nDu bist ein Agent.") + Buffer.byteLength("# Umgebung\n- Bun\n\nFLEET-LISTENSCHNITT (lane): weg");
    expect(ANAT.anfrageBytes).toBe(system + ANAT.werkzeuge.reduce((n, w) => n + w.bytes, 0) + 10);
  });
  test("ohne api-request-shape: keine Werkzeuge, kein Identitätsblock, keine Anfrage-Bytes", () => {
    const a = anatomieAusTranskript([...START, ANTWORT].join("\n"));
    if (typeof a === "string") throw new Error(a);
    expect([a.werkzeuge, a.identitaet, a.anfrageBytes]).toEqual([[], null, null]);
  });
});

const tmp = () => mkdtempSync(join(tmpdir(), "anatomie-"));
describe("transkriptKopf", () => {
  test("liest bis einschließlich der ersten Antwort; eine Zeile, die eine Antwort nur in sich trägt (Fortschritt eines Subagenten), ist keine", () => {
    const d = tmp(), f = join(d, "a.jsonl");
    const zitat = z({ type: "progress", data: { message: { type: "assistant", message: { content: [] } } } });
    writeFileSync(f, [zitat, ANTWORT, z({ type: "user", message: { content: "danach" } })].join("\n") + "\n");
    expect(transkriptKopf(f)).toEqual({ text: [zitat, ANTWORT].join("\n"), ganz: true });
  });
  test("ohne Antwort im Budget: nicht ganz, und eine abgeschnittene letzte Zeile fällt weg", () => {
    const d = tmp(), f = join(d, "b.jsonl");
    writeFileSync(f, [START[0], ANTWORT].join("\n") + "\n");
    expect(transkriptKopf(f, START[0]!.length + 5)).toEqual({ text: `${START[0]}\n`, ganz: false });
  });
  test("eine fehlende Datei: null", () => expect(transkriptKopf("/gibt/es/nicht.jsonl")).toBeNull());
});

describe("kopfVon", () => {
  test("ein ganzer Kopf bleibt im Speicher; einer ohne Antwort wird neu gelesen", () => {
    const d = tmp(), ganz = join(d, "g.jsonl"), halb = join(d, "h.jsonl");
    writeFileSync(ganz, KOPF.join("\n") + "\n");
    writeFileSync(halb, KOPF.slice(0, -1).join("\n") + "\n");
    const a = kopfVon(ganz), b = kopfVon(halb);
    expect([a?.version, a?.cwd, a?.interaktiv, a?.fleetRolle, a?.anatomie?.tokens]).toEqual(["2.1.301", "/r/fleet", true, "lane", 100]);
    expect([b?.version, b?.anatomie]).toEqual(["2.1.301", null]);
    writeFileSync(ganz, "");
    writeFileSync(halb, KOPF.join("\n") + "\n");
    expect(kopfVon(ganz)?.anatomie?.tokens).toBe(100);
    expect(kopfVon(halb)?.anatomie?.tokens).toBe(100);
  });
});

const kopf = (o: Partial<Kopf> & { modell?: string | null }): Kopf => ({ version: "2.1.301", seit: 1, cwd: "/r/fleet", interaktiv: true, fleetRolle: null,
  anatomie: o.anatomie === undefined ? { ...ANAT, modell: o.modell === undefined ? "claude-opus-5-5" : o.modell } : o.anatomie, ...o });
const kand = (ort: string, k: Kopf): Kandidat => ({ slot: null, rolle: "Lane", ort, kopf: k });
describe("waehleQuelle", () => {
  test("die Version der zuletzt gestarteten Session gilt; dasselbe Modell geht vor die jüngere Session", () => {
    const w = waehleQuelle([kand("alt", kopf({ version: "2.1.296", seit: 9 })), kand("sonnet", kopf({ seit: 8, modell: "claude-sonnet-5-5" })),
      kand("opus", kopf({ seit: 5 })), kand("jung", kopf({ seit: 10, version: "2.1.301", modell: "claude-sonnet-5-5" }))], "claude-opus-5-5[1m]");
    expect("quelle" in w ? w.quelle.ort : w.grund).toBe("opus");
  });
  test("hat die jüngste Version noch keine Antwort, sagt die Quelle das statt eine ältere zu nehmen", () => {
    const w = waehleQuelle([kand("neu", kopf({ version: "2.1.302", seit: 9, anatomie: null })), kand("alt", kopf({ seit: 5 }))], "claude-opus-5-5");
    expect(w).toEqual({ grund: "noch nicht gemessen — erscheint, sobald eine Session mit Claude Code 2.1.302 geantwortet hat" });
  });
  test("ohne Kandidaten: noch nicht gemessen", () =>
    expect(waehleQuelle([], "x")).toEqual({ grund: "noch nicht gemessen — erscheint, sobald eine Claude-Session in Fleets Repo gelaufen ist" }));
});

describe("kandidatenAus", () => {
  test("nur interaktive Sessions im Repo und seinen Worktrees, geprüft am cwd im Transkript; eine laufende trägt Slot und Rolle", () => {
    const projekte = tmp(), root = "/r/claude-fleet";
    const lege = (ordner: string, name: string, cwd: string, entrypoint = "cli") => {
      mkdirSync(join(projekte, ordner), { recursive: true });
      const f = join(projekte, ordner, name);
      writeFileSync(f, KOPF.map((l) => l.replace('"cwd":"/r/fleet"', `"cwd":${JSON.stringify(cwd)}`).replace('"entrypoint":"cli"', `"entrypoint":"${entrypoint}"`)).join("\n") + "\n");
      return f;
    };
    const haupt = lege("-r-claude-fleet", "1.jsonl", root);
    lege("-r-claude-fleet-worktrees-bau-x", "2.jsonl", `${root}.worktrees/bau-x`);
    lege("-r-claude-fleet-other", "3.jsonl", "/r/claude-fleet-other");
    lege("-r-claude-fleet", "4.jsonl", root, "sdk-cli");
    lege("-r-fremd", "5.jsonl", "/r/fremd");
    // eine laufende Session außerhalb des Repos bleibt draußen, auch wenn ihr Transkript ein cwd im Repo nennt: es wird gar nicht erst gelesen
    const fremdLive = lege("-r-fremd", "6.jsonl", root);
    const k = kandidatenAus(projekte, root, new Map([[haupt, { slot: 3, rolle: "MAIN", cwd: root }], [fremdLive, { slot: 4, rolle: "Lane", cwd: "/r/fremd" }]]));
    expect(k.map((x) => [x.ort, x.slot, x.rolle]).sort()).toEqual([["bau-x", null, "Lane"], ["claude-fleet", 3, "MAIN"]]);
  });
  test("ohne Projektordner: keine Kandidaten", () => expect(kandidatenAus("/gibt/es/nicht", "/r/x", new Map())).toEqual([]));
});

const LEER: Orte = { konfig: { befehle: [], skills: [], agenten: [] }, repo: { befehle: [], skills: [], agenten: [] }, quelleRepo: null, repoMcp: [], quelleMcp: [] };
const FLEET = (o: Partial<FleetTeil> = {}): FleetTeil => ({
  anhang: [{ name: "Listenschnitt", weg: "--append-system-prompt", text: "FLEET-LISTENSCHNITT (main): eine Zeile", satz: "s" },
    { name: "Gepflogenheiten", weg: "--append-system-prompt-file", text: null, satz: "aus" }],
  werkzeuge: null, schnitt: [], ohneMemory: false, ohneMcp: false, ...o });
const QUELLE = (a: Anatomie) => ({ kandidat: kand("bau-x", kopf({})), a });
const VOLL: Anatomie = { ...ANAT,
  systemprompt: [{ text: "\nDu bist ein Agent.", bytes: 19 }, { text: "# Memory\n\nDein Gedächtnis.", bytes: 26 }, { text: "FLEET-LISTENSCHNITT (main): alt", bytes: 31 }],
  skills: [{ name: "graphify", text: "- graphify: Graph", bytes: 17 }, { name: "foreman", text: "- foreman: Puls", bytes: 15 }, { name: "dataviz", text: "- dataviz", bytes: 9 },
    { name: "figma:figma-use", text: "- figma:figma-use: Figma", bytes: 24 }, { name: "handoff", text: "- handoff: Übergabe", bytes: 20 }],
  agenten: [{ name: "Explore", text: "- Explore: Sucht", eingebaut: true }, { name: "e2e-runner", text: "- e2e-runner: Läufe", eingebaut: false }],
  aufgeschoben: ["Monitor"], mcpWerkzeuge: ["mcp__claude_ai_Gmail__authenticate", "mcp__plugin_playwright_playwright__browser_click"],
  mcp: [{ name: "claude.ai Gmail", text: "## Gmail\nPost." }] };
const gruppe = (a: ReturnType<typeof anatomieFuerRolle>, id: string) => a.gruppen.find((g) => g.id === id)?.teile ?? [];
const kurz = (a: ReturnType<typeof anatomieFuerRolle>, id: string) => gruppe(a, id).map((t) => `${t.name}:${t.stand}:${t.weg}`);

describe("anatomieFuerRolle", () => {
  const orte: Orte = { konfig: { befehle: ["handoff", "audit"], skills: ["graphify"], agenten: ["e2e-runner"] }, repo: { befehle: [], skills: ["unslop"], agenten: [] },
    quelleRepo: { befehle: ["foreman"], skills: ["graphify"], agenten: [] }, repoMcp: [], quelleMcp: [] };
  const schnitt: FleetTeil["schnitt"] = [{ name: "handoff", von: "user-command", aus: true, zurueck: "Datei lesen" }, { name: "audit", von: "user-command", aus: true, zurueck: "Datei lesen" },
    { name: "dataviz", von: "bundled", aus: true, zurueck: "Skill-Werkzeug" }, { name: "e2e-runner", von: "user-agent", aus: true, zurueck: "Agent lesen" }];
  const lane = anatomieFuerRolle(QUELLE(VOLL), null, FLEET({ werkzeuge: ["Bash", "Read", "Monitor", "Edit"], schnitt, ohneMemory: true, ohneMcp: true }), orte);
  const generic = anatomieFuerRolle(QUELLE(VOLL), null, FLEET(), orte);

  test("Systemprompt: der Identitätsblock zuerst, Fleets Abschnitt der Quelle fällt weg; bei der Lane schaltet Fleet Memory ab", () => {
    expect(kurz(lane, "systemprompt")).toEqual(["Du bist Claude Code.:an:mitgeliefert", "Du bist ein Agent.:an:mitgeliefert", "Memory:aus:--settings autoMemoryEnabled"]);
    expect(kurz(generic, "systemprompt")).toEqual(["Du bist Claude Code.:an:mitgeliefert", "Du bist ein Agent.:an:mitgeliefert", "Memory:an:mitgeliefert"]);
  });
  test("Fleets Anhang wörtlich aus dem Code, was aus ist, ohne Text", () => {
    expect(gruppe(lane, "fleet")).toEqual([
      { name: "Listenschnitt", bytes: 38, stand: "an", weg: "--append-system-prompt", satz: "s", text: "FLEET-LISTENSCHNITT (main): eine Zeile" },
      { name: "Gepflogenheiten", bytes: null, stand: "aus", weg: "--append-system-prompt-file", satz: "aus" }]);
  });
  test("Werkzeuge: mit Liste legt Fleet an und aus fest, ein Server-Werkzeug bleibt Claude Codes, was die Quelle nicht hatte, ist nicht gemessen", () => {
    expect(kurz(lane, "werkzeuge")).toEqual(["Bash:an:--tools", "Read:an:--tools", "Workflow:aus:--tools", "advisor:abruf:mitgeliefert", "Monitor:abruf:--tools", "Edit:an:--tools"]);
    expect(gruppe(lane, "werkzeuge").find((t) => t.name === "Edit")?.bytes).toBeNull();
    expect(kurz(generic, "werkzeuge")).toEqual(["Bash:an:mitgeliefert", "Read:an:mitgeliefert", "Workflow:an:mitgeliefert", "advisor:abruf:mitgeliefert", "Monitor:abruf:mitgeliefert"]);
  });
  test("Skills: was nur das Repo der Quelle hatte, fehlt; Fleets Schnitt; was das gewählte Repo bringt, steht ungemessen da", () => {
    expect(kurz(lane, "skills")).toEqual(["graphify:an:Konfig-Ordner", "dataviz:name:--settings skillOverrides", "figma:figma-use:an:Plugin figma",
      "handoff:aus:--settings skillOverrides", "audit:aus:--settings skillOverrides", "unslop:an:Repo"]);
    expect(gruppe(lane, "skills").find((t) => t.name === "dataviz")?.bytes).toBe(Buffer.byteLength("- dataviz"));
    expect(gruppe(lane, "skills").find((t) => t.name === "unslop")?.bytes).toBeNull();
  });
  test("Agenten: eingebaut ist mitgeliefert; einen gesperrten nimmt Fleet per --disallowedTools heraus", () => {
    expect(kurz(lane, "agenten")).toEqual(["Explore:an:mitgeliefert", "e2e-runner:aus:--disallowedTools"]);
  });
  test("MCP: Herkunft aus dem Namen; eine Text-Lane startet ohne Server", () => {
    expect(kurz(generic, "mcp")).toEqual(["claude.ai Gmail:an:claude.ai-Anbindung", "playwright:abruf:Plugin playwright"]);
    expect(kurz(lane, "mcp")).toEqual(["claude.ai Gmail:aus:--strict-mcp-config", "playwright:aus:--strict-mcp-config"]);
  });
  test("Plugins sind eine Zuordnung aus den Präfixen, ohne eigene Größe", () => {
    expect(gruppe(generic, "plugins")).toEqual([
      { name: "figma", bytes: null, stand: "an", weg: "Plugin figma", satz: "bringt Skill figma:figma-use" },
      { name: "playwright", bytes: null, stand: "an", weg: "Plugin playwright", satz: "bringt MCP-Server playwright" }]);
  });
  test("kein sichtbarer Satz nennt einen Schalter der Startzeile, der steht im Weg (Prüfung Punkt 12)", () => {
    const saetze = [lane, generic].flatMap((a) => a.gruppen.flatMap((g) => g.teile.map((t) => `${t.name}: ${t.satz}`)));
    expect(saetze.filter((x) => /(^|\s)--[a-z]/.test(x))).toEqual([]);
  });
  test("die Quelle trägt das gemessene Verhältnis Bytes je Token ihrer ersten Anfrage", () => {
    expect(lane.quelle).toEqual({ slot: null, rolle: "Lane", ort: "bau-x", claude: "2.1.301", modell: "claude-opus-5-5", seit: Date.parse("2026-10-16T09:00:00.000Z"),
      tokens: 100, bytesJeToken: Math.round(((ANAT.anfrageBytes ?? 0) / 100) * 100) / 100 });
  });
  test("ohne Quelle: der Grund, Claude Codes Teil leer, Fleets Teil und die Werkzeugliste aus dem Code", () => {
    const a = anatomieFuerRolle(null, "noch nicht gemessen", FLEET({ werkzeuge: ["Bash"] }), LEER);
    expect([a.quelle, a.grund, gruppe(a, "systemprompt").length, gruppe(a, "fleet").length]).toEqual([null, "noch nicht gemessen", 0, 2]);
    expect(gruppe(a, "werkzeuge")).toEqual([{ name: "Bash", bytes: null, stand: "an", weg: "--tools", satz: "auf Fleets Werkzeugliste dieser Rolle; Größe noch nicht gemessen" }]);
  });
});
