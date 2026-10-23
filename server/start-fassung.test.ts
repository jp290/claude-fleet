// Tests für die festgehaltene Fassung (Harness 2.0 Schritt 1): `anlass=laufend` zeigt, womit die Belegung gestartet wurde; eine Datei, die
// nicht mehr zu ihrem Hash passt, gilt nicht; was Fleet selbst in den Start legt, zählt im Hash; die Tür lehnt einen gezeigten Hash ab,
// der nicht mehr stimmt.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { baueFassung, textAbschnitt, type FassungEingang } from "./fassung";
import { SPEICHER_DATEI } from "../src/k15-speicher";
import { FASSUNG_ORDNER, halteFassung, holeFassung } from "./start-fassung";
import { REAL_SEAT_DENY } from "./session-start";

const ROOT = join(import.meta.dir, "..");

const eingang = (over: Partial<FassungEingang> = {}): FassungEingang => ({
  slot: 7,
  anlass: "laufend",
  wer: [textAbschnitt("harness", "Slot.harness", "claude")],
  aufgabe: [textAbschnitt("aufgabe", "Queue-Zeile t1", "ZIEL: zeigen")],
  liest: [textAbschnitt("rolle", "rollenkarte", "--- ROLLE --- Lane")],
  darf: [textAbschnitt("darf", "Slot.rechte", "FLEET-RECHTE ...")],
  arbeitet: [textAbschnitt("arbeitet", "laneExitFooter", "Empfänger: program-main Slot 1")],
  ...over,
});

const mitDir = <T>(fn: (dir: string) => T): T => {
  const dir = mkdtempSync(join(tmpdir(), "start-fassung-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe("halteFassung / holeFassung", () => {
  test("die gehaltene Fassung kommt mit Hash, Anlass und Zeitpunkt zurück", () => mitDir((dir) => {
    const f = baueFassung(eingang());
    halteFassung(dir, 7, 1000, f, "laufend", 1234);
    const got = holeFassung(dir, 7, 1000);
    expect(got?.fassung.hash).toBe(f.hash);
    expect(got?.wie).toBe("laufend");
    expect(got?.am).toBe(1234);
  }));

  test("ohne Datei ist das Ergebnis null", () => mitDir((dir) => {
    expect(holeFassung(dir, 7, 1000)).toBeNull();
  }));

  test("eine andere Belegung (anderer openedAt) desselben Slots sieht die Fassung nicht", () => mitDir((dir) => {
    halteFassung(dir, 7, 1000, baueFassung(eingang()), "laufend");
    expect(holeFassung(dir, 7, 1001)).toBeNull();
  }));

  test("ein anderer Slot sieht die Fassung nicht", () => mitDir((dir) => {
    halteFassung(dir, 7, 1000, baueFassung(eingang()), "laufend");
    expect(holeFassung(dir, 8, 1000)).toBeNull();
  }));

  test("ein verändertes Byte in einem Teil macht die Datei ungültig (Hash passt nicht mehr zu den Teilen)", () => mitDir((dir) => {
    halteFassung(dir, 7, 1000, baueFassung(eingang()), "laufend");
    const pfad = join(dir, FASSUNG_ORDNER, "7-1000.json");
    const roh = readFileSync(pfad, "utf8");
    expect(roh).toContain("ZIEL: zeigen");
    writeFileSync(pfad, roh.replace("ZIEL: zeigen", "ZIEL: zeigeN"));
    expect(holeFassung(dir, 7, 1000)).toBeNull();
  }));

  test("kaputtes JSON, falsche Form und unbekannter Anlass ergeben null", () => mitDir((dir) => {
    mkdirSync(join(dir, FASSUNG_ORDNER), { recursive: true });
    const pfad = join(dir, FASSUNG_ORDNER, "7-1000.json");
    writeFileSync(pfad, "{nicht json");
    expect(holeFassung(dir, 7, 1000)).toBeNull();
    writeFileSync(pfad, JSON.stringify({ fassung: { teile: "x", hash: 1 }, wie: "laufend", am: 1 }));
    expect(holeFassung(dir, 7, 1000)).toBeNull();
    const f = baueFassung(eingang());
    writeFileSync(pfad, JSON.stringify({ fassung: f, wie: "irgendwann", am: 1 }));
    expect(holeFassung(dir, 7, 1000)).toBeNull();
    writeFileSync(pfad, JSON.stringify({ fassung: f, wie: "laufend", am: "heute" }));
    expect(holeFassung(dir, 7, 1000)).toBeNull();
    writeFileSync(pfad, "null");
    expect(holeFassung(dir, 7, 1000)).toBeNull();
  }));

  test("eine neue Belegung desselben Slots löscht die alte, fremde Slots bleiben", () => mitDir((dir) => {
    const f = baueFassung(eingang());
    halteFassung(dir, 7, 1000, f, "laufend");
    halteFassung(dir, 8, 1000, f, "laufend");
    halteFassung(dir, 7, 2000, f, "nachfolge");
    expect(readdirSync(join(dir, FASSUNG_ORDNER)).sort()).toEqual(["7-2000.json", "8-1000.json"]);
    expect(holeFassung(dir, 7, 1000)).toBeNull();
    expect(holeFassung(dir, 7, 2000)?.wie).toBe("nachfolge");
    expect(holeFassung(dir, 8, 1000)?.wie).toBe("laufend");
  }));

  test("Slot 1 räumt nicht Slot 14 ab (Präfix 1- gegen 14-)", () => mitDir((dir) => {
    const f = baueFassung(eingang());
    halteFassung(dir, 14, 1000, f, "laufend");
    halteFassung(dir, 1, 2000, f, "laufend");
    expect(holeFassung(dir, 14, 1000)?.wie).toBe("laufend");
  }));

  test("erneutes Halten derselben Belegung überschreibt und lässt keine Reste (.tmp) liegen", () => mitDir((dir) => {
    halteFassung(dir, 7, 1000, baueFassung(eingang()), "laufend");
    const f2 = baueFassung(eingang({ aufgabe: [textAbschnitt("aufgabe", "Queue-Zeile t1", "ZIEL: etwas anderes")] }));
    halteFassung(dir, 7, 1000, f2, "nachfolge");
    expect(holeFassung(dir, 7, 1000)?.fassung.hash).toBe(f2.hash);
    expect(readdirSync(join(dir, FASSUNG_ORDNER))).toEqual(["7-1000.json"]);
  }));
});

describe("was Fleet selbst in den Start legt, zählt im Hash", () => {
  test("modus, werkzeuge, einstellungen und systemzusatz ändern den Hash, wenn sie sich ändern", () => {
    const a = baueFassung(eingang());
    const mit = (darf: FassungEingang["darf"], liest = eingang().liest) => baueFassung(eingang({ darf, liest })).hash;
    const basis = [...eingang().darf];
    const modus = textAbschnitt("modus", "PERMISSION_MODE", "auto", false);
    const werkzeuge = textAbschnitt("werkzeuge", "SESSION_TOOLS", "--tools Read\n--disallowedTools keine", false);
    const einstellungen = textAbschnitt("einstellungen", "--settings", "{}", false);
    const voll = mit([...basis, modus, werkzeuge, einstellungen]);
    expect(voll).not.toBe(a.hash);
    expect(mit([...basis, textAbschnitt("modus", "PERMISSION_MODE", "default", false), werkzeuge, einstellungen])).not.toBe(voll);
    expect(mit([...basis, modus, textAbschnitt("werkzeuge", "SESSION_TOOLS", "--tools Read,Edit\n--disallowedTools keine", false), einstellungen]))
      .not.toBe(voll);
    expect(mit([...basis, modus, werkzeuge, textAbschnitt("einstellungen", "--settings", '{"a":1}', false)])).not.toBe(voll);
    expect(mit([...basis, modus, werkzeuge])).not.toBe(voll);
    const zusatz = (text: string) => [...eingang().liest, textAbschnitt("systemzusatz", "sessionListCut", text, false)];
    expect(mit(basis, zusatz("Zeile A"))).not.toBe(mit(basis, zusatz("Zeile B")));
    expect(mit(basis, zusatz("Zeile A"))).not.toBe(a.hash);
  });
});

// ---- ab hier läuft server.ts in einem Kindprozess mit eigenem Zustand (wie server/fassung.test.ts) ----

// tmux liegt je nach Maschine nicht im Standard-PATH: sein Ordner geht mit, sonst gäbe es keine Pane
const TMUX_DIR = dirname(Bun.which("tmux") ?? "/usr/bin/tmux");
const runServer = async (script: string, dir: string, env: Record<string, string> = {}): Promise<{ code: number; stdout: string; stderr: string }> => {
  const proc = Bun.spawn([process.execPath, "--no-env-file", "-e", script], { cwd: ROOT, stdout: "pipe", stderr: "pipe",
    env: { PATH: `${TMUX_DIR}:/usr/local/bin:/usr/bin:/bin`, HOME: join(dir, "home"), SHELL: "/bin/sh", FLEET_HOST: "127.0.0.1", FLEET_PORT: "8793",
      FLEET_SOCK: `startfassung${process.pid}`, FLEET_STATE_DIR: join(dir, "state"), FLEET_CMD: "claude",
      FLEET_CLAUDE_PROJECTS_DIR: join(dir, "home", ".claude", "projects"), FIX_REPO: join(dir, "repo"), ...env } });
  const code = await Promise.race([proc.exited, Bun.sleep(150_000).then(() => { proc.kill("SIGKILL"); return -1; })]);
  return { code, stdout: await new Response(proc.stdout).text(), stderr: await new Response(proc.stderr).text() };
};

const gitRepo = (dir: string): void => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "AGENTS.md"), "AGENTS fixture\n");
  writeFileSync(join(dir, "CLAUDE.md"), "Projektregel fixture\n");
  Bun.spawnSync(["git", "init", "-q"], { cwd: dir });
  Bun.spawnSync(["git", "add", "."], { cwd: dir });
  Bun.spawnSync(["git", "-c", "user.email=f@f.f", "-c", "user.name=f", "commit", "-qm", "init"], { cwd: dir });
};

interface Abschnitt { id: string; text: string | null }
interface Teil { id: string; abschnitte: Abschnitt[] }
interface Antwort { hash: string; teile: Teil[] }
const abschnitt = (f: Antwort, teil: string, id: string): Abschnitt | undefined =>
  f.teile.find((t) => t.id === teil)?.abschnitte.find((a) => a.id === id);

describe("Fleets eigene Zeilen in der Fassung", () => {
  test("Claude-Rollen tragen modus, werkzeuge, einstellungen, mcp und systemzusatz; ein anderer Harness trägt keinen Systemzusatz", async () => {
    const dir = mkdtempSync(join(tmpdir(), "start-fassung-srv-"));
    try {
      gitRepo(join(dir, "repo"));
      mkdirSync(join(dir, "state"), { recursive: true });
      mkdirSync(join(dir, "home"), { recursive: true });
      const out = join(dir, "out.json");
      const script = `
        const S = await import(${JSON.stringify(join(ROOT, "server.ts"))});
        const repoRoot = process.env.FIX_REPO;
        const neu = (rolle, harness) => S.fassungFuerNeuenPlan({ rolle, harness, modell: null, effort: null, repoRoot });
        const fassungen = { lane: await neu("lane", "claude"), orch: await neu("orchestrator", "claude"), frei: await neu("nur-ordner", "claude"),
          codex: await neu("lane", "codex") };
        await Bun.write(${JSON.stringify(out)}, JSON.stringify({ fassungen }));
        process.exit(0);
      `;
      const r = await runServer(script, dir);
      expect({ code: r.code, stderr: r.code === 0 ? "" : r.stderr.slice(-1500) }).toEqual({ code: 0, stderr: "" });
      const got = JSON.parse(readFileSync(out, "utf8")) as { fassungen: Record<"lane" | "orch" | "frei" | "codex", Antwort> };
      const { lane, orch, frei, codex } = got.fassungen;
      for (const f of [lane, orch, frei]) {
        expect(abschnitt(f, "darf", "modus")?.text ?? "").not.toBe("");
        expect(abschnitt(f, "darf", "werkzeuge")?.text).toContain("--disallowedTools");
        expect(abschnitt(f, "darf", "einstellungen")?.text).toContain("skillOverrides");
        expect(abschnitt(f, "darf", "mcp")?.text).toContain("--mcp-config keine");
        expect(abschnitt(f, "liest", "systemzusatz")?.text ?? "").not.toBe("");
      }
      expect(abschnitt(lane, "darf", "mcp")?.text).toContain("--strict-mcp-config ja");
      expect(abschnitt(frei, "darf", "mcp")?.text).toContain("--strict-mcp-config nein");
      expect(abschnitt(lane, "darf", "werkzeuge")?.text).not.toBe(abschnitt(orch, "darf", "werkzeuge")?.text);
      expect(new Set([lane.hash, orch.hash, frei.hash]).size).toBe(3);
      expect(abschnitt(codex, "darf", "modus")).toBeUndefined();
      expect(abschnitt(codex, "liest", "systemzusatz")?.text).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});

// DIE ZEILE UND DIE FASSUNG BLEIBEN GLEICH: was fassungFleetStart als Fleets eigene Zeilen in die fünf Teile schreibt, steht auf der Zeile, die
// slotCmd/agentCmd baut. Ändert jemand die Zeile (neues Flag, anderer Modus) und die Fassung nicht mit, wird dieser Test rot.
// Gebaut wird mit denselben Eingaben (Rolle, Rechte, Pack-MCP, Browser-MCP); ob ensureSlot dieselben Eingaben wählt, zeigt beweise/schritt-1.sh.
const zerlege = (zeile: string): string[] => {
  const tokens: string[] = [];
  let tok = "", offen = false, i = 0;
  while (i < zeile.length) {
    const c = zeile[i]!;
    if (c === "'") { offen = true; const e = zeile.indexOf("'", i + 1); tok += zeile.slice(i + 1, e); i = e + 1; }
    else if (c === "\\") { offen = true; tok += zeile[i + 1] ?? ""; i += 2; }
    else if (/\s/.test(c) || c === ";") { if (offen) tokens.push(tok); tok = ""; offen = false; i++; if (c === ";") tokens.push(";"); }
    else { offen = true; tok += c; i++; }
  }
  if (offen) tokens.push(tok);
  return tokens;
};

// eine Vorlagenzeile mit `{adresse}`-Platzhaltern als Muster für die Zeile, in der sie ausgefüllt steht
const alsMuster = (vorlage: string): RegExp =>
  new RegExp(`^${vorlage.split(/\{[A-Za-z]+\}/).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".+?")}$`, "s");

// zweimal: auf dem Live-Server und auf einer Instanz mit echten Sitzen (FLEET_NO_BYPASS: alle Rollen in auto, dazu die Deny-Regeln REAL_SEAT_DENY neben den
// Rechten des Sitzes). Ohne dass die Fassung das mitrechnet, zeigte der gezeigte Hash eines echten Sitzes bypassPermissions und keine Regeln, die Zeile aber auto.
describe("die Fassung und die Zeile des Spawns", () => {
  for (const [wo0, env] of [["", {}], [" auf einer Instanz mit echten Sitzen (FLEET_NO_BYPASS)", { FLEET_NO_BYPASS: "1" }]] as const)
  test(`modus, werkzeuge, einstellungen, mcp und systemzusatz der Fassung stehen so auf der Zeile von slotCmd${wo0}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "start-fassung-zeile-"));
    try {
      mkdirSync(join(dir, "state"), { recursive: true });
      mkdirSync(join(dir, "home"), { recursive: true });
      const out = join(dir, "out.json");
      const script = `
        const S = await import(${JSON.stringify(join(ROOT, "server.ts"))});
        const rechteWahl = [null, { stufe: "bauen", an: [], aus: [] }, { stufe: "lesen", an: [], aus: [] }];
        const mcpWahl = [[], [{ name: "n1", command: "bun", args: ["x.ts", "it's"] }]];
        const faelle = [];
        for (const [listRole, bau] of [["lane", false], ["main", false], ["orchestrator", false], ["generic", false], ["generic", true]])
          for (const rechte of rechteWahl) for (const packMcp of mcpWahl) for (const browserMcp of [true, false]) {
            const fleet = S.fassungFleetStart(listRole, rechte, { browserMcp, packMcp }, bau);
            // ensureSlot gibt der Orchestratorin ihren Start als Datei (server.ts#orchestratorStartDatei), keiner anderen Rolle
            const startDatei = listRole === "orchestrator" ? "/fixture/orchestrator-start.md" : null;
            const zeile = S.slotCmd("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", false, "claude-opus-5-5", null, browserMcp, null, packMcp, listRole, false, null, rechte, null, null, null, bau, startDatei);
            faelle.push({ listRole, bau, rechte, packMcp: packMcp.length, browserMcp, fleet, zeile, home: process.env.HOME });
          }
        await Bun.write(${JSON.stringify(out)}, JSON.stringify(faelle));
        process.exit(0);
      `;
      const r = await runServer(script, dir, env);
      expect({ code: r.code, stderr: r.code === 0 ? "" : r.stderr.slice(-1500) }).toEqual({ code: 0, stderr: "" });
      type Fall = { listRole: string; bau: boolean; rechte: unknown; packMcp: number; browserMcp: boolean; zeile: string; home: string;
        fleet: { zusatz: { text: string | null }; start: { text: string | null } | null; darf: { id: string; text: string | null }[] } };
      const faelle = JSON.parse(readFileSync(out, "utf8")) as Fall[];
      expect(faelle).toHaveLength(60);
      for (const f of faelle) {
        const wo = `${f.listRole}${f.bau ? " (baut)" : ""} rechte=${JSON.stringify(f.rechte)} mcp=${f.packMcp} browser=${f.browserMcp}`;
        const gleich = (fassung: unknown, zeile: unknown): void => { expect({ wo, wert: fassung }).toEqual({ wo, wert: zeile }); };
        const tokens = zerlege(f.zeile);
        const flag = (name: string): string | null => { const i = tokens.indexOf(name); return i < 0 ? null : tokens[i + 1] ?? ""; };
        const darf = (id: string): string => f.fleet.darf.find((a) => a.id === id)?.text ?? `(Abschnitt ${id} fehlt)`;
        gleich(darf("modus"), flag("--permission-mode"));
        if ("FLEET_NO_BYPASS" in env) gleich(darf("modus"), "auto");
        else if (f.listRole === "orchestrator") gleich(darf("modus"), "bypassPermissions");
        gleich(darf("werkzeuge"), `--tools ${flag("--tools") ?? "alle eingebauten"}\n--disallowedTools ${flag("--disallowedTools") ?? "keine"}`);
        // --settings: skillOverrides und Rechte wörtlich; die Auto-Mode-Umgebung als Vorlage ohne Adressen (`{fleetUrl}` …), also jede Zeile der Zeile
        // passt der Reihe nach auf eine Vorlagenzeile, und was die Zeile weglässt, sind nur die Hub-Zeilen (ohne Hub gibt es sie dort nicht)
        const zeileSet = JSON.parse(flag("--settings") ?? "{}") as { claudeMdExcludes?: string[]; skillOverrides?: unknown; permissions?: unknown; autoMode?: { environment?: string[] } };
        const fassungSet = JSON.parse(darf("einstellungen")) as { claudeMdExcludes?: string[]; skillOverrides: unknown; permissions?: unknown; autoMode: { environment: string[] } };
        gleich(fassungSet.skillOverrides, zeileSet.skillOverrides ?? {});
        // die Orchestratorin zeigt ihre Excludes unter „Liest“ (fassungProjektregelnAus), eine Session ohne Rolle hier
        if (f.listRole === "generic")
          gleich(fassungSet.claudeMdExcludes ?? null, zeileSet.claudeMdExcludes?.map((pfad) => pfad.replace(f.home, "~")) ?? null);
        gleich(fassungSet.permissions ?? null, zeileSet.permissions ?? null);
        const deny = (zeileSet.permissions as { deny?: string[] } | undefined)?.deny ?? [];
        gleich("FLEET_NO_BYPASS" in env ? deny.slice(-REAL_SEAT_DENY.length) : null, "FLEET_NO_BYPASS" in env ? [...REAL_SEAT_DENY] : null);
        const vorlage = fassungSet.autoMode.environment.map(alsMuster);
        let at = 0;
        for (const eintrag of zeileSet.autoMode?.environment ?? []) {
          while (at < vorlage.length && !vorlage[at]!.test(eintrag)) at++;
          gleich(at < vorlage.length, true);
          at++;
        }
        const mcp = darf("mcp");
        gleich(mcp.startsWith("--strict-mcp-config ja"), tokens.includes("--strict-mcp-config"));
        const config = f.packMcp ? mcp.split("\n").slice(1).join("\n") : null;
        gleich(config === null ? tokens.includes("--mcp-config") : f.zeile.includes(config), config !== null);
        gleich((flag("--append-system-prompt") ?? "").startsWith(f.fleet.zusatz.text ?? "(kein Systemzusatz)"), true);
        gleich(f.fleet.start !== null, flag("--append-system-prompt-file") !== null);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});

// EIN SITZ, DER BAUT, STARTET SCHLANK (Kostenprüfung 23.10., Paket 1): ohne die Werkzeuge, die in 62 Bau-Sessions niemand rief, ohne die
// Codex-Fassung der globalen Regeln; seine MCP-Server bleiben (Playwright nutzen 14 von 56 Bau-Sitzen). Eine freie Session behält alles.
describe("ein Sitz, der baut, gegen eine freie Session", () => {
  test("die Zeile des Bau-Sitzes nimmt sechs Werkzeuge und ~/AGENTS.md heraus, die freie Session behält beides", async () => {
    const dir = mkdtempSync(join(tmpdir(), "start-fassung-bau-"));
    try {
      mkdirSync(join(dir, "state"), { recursive: true });
      mkdirSync(join(dir, "home"), { recursive: true });
      const out = join(dir, "out.json");
      const script = `
        const S = await import(${JSON.stringify(join(ROOT, "server.ts"))});
        const zeile = (browserMcp, bau) => S.slotCmd("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", false, null, null, browserMcp, null, [], "generic", false, null, null, null, null, null, bau);
        await Bun.write(${JSON.stringify(out)}, JSON.stringify({ bau: zeile(true, true), frei: zeile(true, false), home: process.env.HOME }));
        process.exit(0);
      `;
      const r = await runServer(script, dir);
      expect({ code: r.code, stderr: r.code === 0 ? "" : r.stderr.slice(-1500) }).toEqual({ code: 0, stderr: "" });
      const z = JSON.parse(readFileSync(out, "utf8")) as { bau: string; frei: string; home: string };
      const flag = (zeile: string, name: string): string | null => { const t = zerlege(zeile); const i = t.indexOf(name); return i < 0 ? null : t[i + 1] ?? ""; };
      const tools = flag(z.bau, "--tools")!.split(",");
      // die Liste steht in einer Datei, damit ein Eintrag ohne Codeänderung zurückkommt
      expect(tools).toEqual((JSON.parse(readFileSync(join(ROOT, ".fleet/sitz-werkzeuge.json"), "utf8")) as { bau: string[] }).bau);
      for (const weg of ["Artifact", "Workflow", "AskUserQuestion", "SendFeedback", "ReportFindings", "ListAgents"]) expect(tools).not.toContain(weg);
      for (const bleibt of ["Bash", "Read", "Edit", "Write", "Agent", "Skill", "ToolSearch", "Monitor"]) expect(tools).toContain(bleibt);
      expect((JSON.parse(flag(z.bau, "--settings")!) as { claudeMdExcludes: string[] }).claudeMdExcludes).toEqual([`${z.home}/AGENTS.md`]);
      expect(zerlege(z.bau)).not.toContain("--strict-mcp-config");
      expect(flag(z.frei, "--tools")).toBeNull();
      expect(z.frei).not.toContain("claudeMdExcludes");
      expect(zerlege(z.frei)).not.toContain("--strict-mcp-config");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});

// DER ECHTE START: die Tür /api/slots/:id/open mit den Feldern, die das Fenster schickt (rechte, profil, bibliothek, Unterordner), gegen die
// Vorschau, die es dafür zeigte. Abnahme 22.10.: ohne diese Felder war „gezeigt = laufend“ nur für den nackten Start wahr. Der Kindprozess ruft
// den Handler von server.ts (serveOptions.fetch) wie die Route-Handler-Tests in server/load.test.ts; die Panes laufen auf einem eigenen
// tmux-Socket mit `true` als Agent.
interface Lauf { ohneSitz?: string; liest?: string; gedaechtnis?: string | null; paneNachHeal?: boolean; fremdWeg?: boolean; fremdZurueck?: boolean; mcp: string | null; paneVorHalten?: boolean; slotNachher?: number; tmuxNachher?: boolean; dateiNachher?: boolean; schritt: string; vorschau: string | null; vorschauStartbar: boolean | null; open: number; offenBody: Record<string, unknown> | null; laufend: string | null; festgehalten: boolean }
describe("gezeigt = laufend für jeden Start, den das Fenster macht", () => {
  const dir = mkdtempSync(join(tmpdir(), "start-fassung-tuer-"));
  let laeufe: Record<string, Lauf> = {};
  let abbruch = "";
  afterAll(() => {
    Bun.spawnSync(["tmux", "-L", `startfassung${process.pid}`, "kill-server"]);
    rmSync(dir, { recursive: true, force: true });
  });
  beforeAll(async () => {
    gitRepo(join(dir, "repo"));
    mkdirSync(join(dir, "repo", "unter", "ordner"), { recursive: true });
    writeFileSync(join(dir, "repo", "unter", "CLAUDE.md"), "Regel im Unterordner\n");
    mkdirSync(join(dir, "state"), { recursive: true });
    mkdirSync(join(dir, "home"), { recursive: true });
    writeFileSync(join(dir, "state", SPEICHER_DATEI), JSON.stringify({ fassungen: [], packs: [], profile: [
      { id: "planer", rolle: "nur-ordner", schiene: "session", name: "Planer", datei: { titel: "planer.md", v: 2, pfad: "eigene Datei",
        abschnitte: [{ titel: "# Planer", text: "Du setzt selten ein Ziel." }] } }],
      // eine importierte Konstellation mit einem Sitz, der mitbringt, was er liest, darf und im Notizbuch hat (server/sitz-reise.ts#sitzDerTuer)
      konstellationen: [{ id: "reise", name: "Reise", abgeleitetVon: "a".repeat(64), positionen: [{ id: "bauer", name: "Bauer", sitz: {
        liest: [{ id: "reise-pack", weg: "start", quellen: [{ pfad: "docs/x.md", anker: "A" }], wofuer: "zeigen", text: "Das Pack, das mit der Datei reiste." }],
        persoenlich: [], darf: { rechte: { stufe: "lesen", an: [], aus: [] }, modus: "auto" },
        notizbuch: { index: "# Notizen\n- das Notizbuch reiste mit\n", notizen: [], daheim: 0 } } }] }] }));
    const out = join(dir, "out.json");
    const script = `
      const S = await import(${JSON.stringify(join(ROOT, "server.ts"))});
      const owner = "tuertest-" + process.pid;
      process.env.FLEET_TOKEN = owner;
      S.adoptTokens();
      const server = { requestIP: () => null };
      const call = async (method, path, body) => {
        const req = new Request("http://127.0.0.1:" + process.env.FLEET_PORT + path, { method,
          headers: { host: "127.0.0.1:" + process.env.FLEET_PORT, authorization: "Bearer " + owner, "content-type": "application/json" },
          ...(body ? { body: JSON.stringify(body) } : {}) });
        const res = await S.serveOptions.fetch.call(server, req, server);
        return { status: res.status, body: await res.json().catch(() => null) };
      };
      const repo = process.env.FIX_REPO;
      const laeufe = {};
      // eine Variante so, wie das Fenster sie fährt: Vorschau mit den Wahlen, dann open mit denselben Feldern und dem gezeigten Hash
      const fahre = async (schritt, slot, { cwd = repo, role = "nur-ordner", rechte, profil, bibliothek, fassung, sitz } = {}) => {
        const q = new URLSearchParams({ repo: cwd, role, anlass: "neu" });
        if (rechte) q.set("rechte", JSON.stringify(rechte));
        if (profil) q.set("profil", profil);
        if (sitz) q.set("sitz", sitz);
        if (bibliothek !== undefined) { q.set("bibliothek", String(bibliothek)); q.set("bausteine", "bibliothek=" + (bibliothek ? "an" : "aus")); }
        const v = await call("GET", "/api/founding-plan?" + q);
        if (v.status !== 200) throw new Error(schritt + ": Vorschau " + v.status + " " + JSON.stringify(v.body));
        const startbar = v.body.start.startbar;
        const body = { cwd, fassung: fassung ?? v.body.fassungsHash, ...(role === "orchestratorin" ? { label: "Orchestrator" } : {}),
          ...(rechte ? { rechte } : {}), ...(profil ? { profil } : {}), ...(sitz ? { sitz } : {}),
          ...(startbar ? { plan: { hash: v.body.plan.planHash, role, ...(bibliothek !== undefined ? { bausteine: "bibliothek=" + (bibliothek ? "an" : "aus") } : {}) } }
            : bibliothek !== undefined ? { bibliothek } : {}) };
        const o = await call("POST", "/api/slots/" + slot + "/open", body);
        let laufend = null, festgehalten = false, mcp = null;
        if (o.status === 200) {
          const l = await call("GET", "/api/slots/" + slot + "/fassung?anlass=laufend");
          laufend = l.body.hash; festgehalten = !!l.body.festgehalten;
          mcp = l.body.teile.find((t) => t.id === "darf")?.abschnitte.find((a) => a.id === "mcp")?.text ?? null;
        }
        laeufe[schritt] = { mcp, schritt, vorschau: v.body.fassungsHash, vorschauStartbar: startbar, open: o.status, offenBody: o.status === 200 ? null : o.body, laufend, festgehalten };
      };
      await fahre("nackt", 3);
      await fahre("rechte", 4, { rechte: { stufe: "bauen", an: [], aus: [] } });
      await fahre("rechte-lesen", 5, { rechte: { stufe: "lesen", an: [], aus: [] } });
      await fahre("profil", 6, { profil: "planer" });
      await fahre("bibliothek-aus", 7, { bibliothek: false });
      await fahre("unterordner", 8, { cwd: repo + "/unter" });
      await fahre("alles", 9, { rechte: { stufe: "bauen", an: [], aus: [] }, profil: "planer", bibliothek: false, cwd: repo + "/unter/ordner" });
      // ein Sitz aus einer Datei: Lesestoff und gedeckeltes Darf aus dem Sitz-Block; mit Profil auch das gesäte Notizbuch (nur in ein eigenes, noch leeres)
      await fahre("sitz", 1, { sitz: "reise/bauer" });
      await fahre("sitz-profil", 2, { sitz: "reise/bauer", profil: "planer" });
      const ohneSitz = await call("GET", "/api/founding-plan?" + new URLSearchParams({ repo, role: "nur-ordner", anlass: "neu" }));
      laeufe.sitz.ohneSitz = ohneSitz.body?.fassungsHash;
      const lesen = await call("GET", "/api/slots/1/fassung?anlass=laufend");
      laeufe.sitz.liest = JSON.stringify(lesen.body?.teile?.find((x) => x.id === "liest")?.abschnitte.map((a) => a.text));
      const lesen2 = await call("GET", "/api/slots/2/fassung?anlass=laufend");
      laeufe["sitz-profil"].gedaechtnis = lesen2.body?.teile?.find((x) => x.id === "liest")?.abschnitte.find((a) => a.id === "gedaechtnis")?.text ?? null;
      await fahre("orchestratorin-rechte", 10, { role: "orchestratorin", rechte: { stufe: "lesen", an: [], aus: [] } });
      // veraltet: die Vorschau ohne Rechte, der Start mit Rechten -> 409 mit dem Hash, den der Start trüge; nichts ist gestartet
      const nackt = await call("GET", "/api/founding-plan?" + new URLSearchParams({ repo, role: "nur-ordner", anlass: "neu" }));
      await fahre("veraltet", 11, { rechte: { stufe: "bauen", an: [], aus: [] }, fassung: nackt.body.fassungsHash });
      const belegt = await call("GET", "/api/slots/11/fassung?anlass=laufend");
      laeufe.veraltet.slotNachher = belegt.status;
      // das Netz allein: die Tür prüft grün, dann ändert sich eine Projektdatei, und die Fassung, die openSlot hält, ist eine andere. Ein Heal-Takt
      // (S.healAlleSlots, im Kindprozess läuft kein Timer) fällt mehrmals zwischen Stempel und Halten; die Pane darf bis zur Prüfung nicht existieren, und danach ist der Slot frei und ohne Datei.
      const tmuxHat = (slot) => Bun.spawnSync(["tmux", "-L", process.env.FLEET_SOCK, "has-session", "-t", "s" + slot]).exitCode === 0;
      let paneVorHalten = null;
      S.fassungTestHaken.nachPruefung = async () => { await Bun.write(repo + "/CLAUDE.md", "Projektregel, zwischen Prüfung und Halten geändert\\n"); };
      S.fassungTestHaken.vorHalten = async () => { paneVorHalten = false; for (let i = 0; i < 6; i++) { S.healAlleSlots(); await Bun.sleep(400); if (tmuxHat(12)) paneVorHalten = true; } };
      await fahre("netz", 12);
      S.fassungTestHaken.nachPruefung = undefined; S.fassungTestHaken.vorHalten = undefined;
      const slotNetz = await call("GET", "/api/slots/12/fassung?anlass=laufend");
      const dateien = Bun.spawnSync(["sh", "-c", "ls " + process.env.FLEET_STATE_DIR + "/start-fassungen 2>/dev/null | grep -c '^12-'"]).stdout.toString().trim();
      Object.assign(laeufe.netz, { paneVorHalten, slotNachher: slotNetz.status, tmuxNachher: tmuxHat(12), dateiNachher: dateien !== "0" });
      // die Sperre wird frei: eine Öffnung, die nach dem Stempel abbricht (vorHalten wirft), lässt den Slot nicht für immer ungeheilt
      const warte = async (f, ms = 6000) => { const bis = Date.now() + ms; while (Date.now() < bis) { if (f()) return true; await Bun.sleep(150); } return f(); };
      S.fassungTestHaken.vorHalten = async () => { throw new Error("test: die Öffnung bricht nach dem Stempel ab"); };
      await fahre("abbruch", 15);
      S.fassungTestHaken.vorHalten = undefined;
      S.healAlleSlots();
      laeufe.abbruch.paneNachHeal = await warte(() => tmuxHat(15));
      // die Sperre gilt nur dem eigenen Slot: während eine Öffnung von Slot 13 hält, wird die Pane eines anderen belegten Slots (14, höhere Nummer) geheilt
      await fahre("heilbar", 14);
      S.fassungTestHaken.vorHalten = async () => {
        Bun.spawnSync(["tmux", "-L", process.env.FLEET_SOCK, "kill-session", "-t", "s14"]);
        fremdWeg = !tmuxHat(14);
        S.healAlleSlots();
        fremdZurueck = await warte(() => tmuxHat(14));
      };
      let fremdWeg = null, fremdZurueck = null;
      await fahre("fremd", 13);
      S.fassungTestHaken.vorHalten = undefined;
      Object.assign(laeufe.fremd, { fremdWeg, fremdZurueck });
      await Bun.write(${JSON.stringify(out)}, JSON.stringify(laeufe));
      Bun.spawnSync(["tmux", "-L", process.env.FLEET_SOCK, "kill-server"]);
      process.exit(0);
    `;
    const r = await runServer(script, dir, { FLEET_CMD: "true" });
    if (r.code !== 0) { abbruch = r.stderr.slice(-2000) || r.stdout.slice(-500) || `exit ${r.code}`; return; }
    laeufe = JSON.parse(readFileSync(out, "utf8")) as Record<string, Lauf>;
  }, 200_000);

  test("der Kindprozess lief durch", () => {
    expect(abbruch).toBe("");
  });

  for (const schritt of ["nackt", "rechte", "rechte-lesen", "profil", "bibliothek-aus", "unterordner", "alles", "orchestratorin-rechte", "sitz", "sitz-profil"]) {
    test(`${schritt}: open mit dem gezeigten Hash gibt 200, und laufend ist der gezeigte, festgehaltene`, () => {
      const l = laeufe[schritt];
      expect(l?.open).toBe(200);
      expect(l?.laufend).toBe(l?.vorschau ?? "nichts gezeigt");
      expect(l?.festgehalten).toBe(true);
    });
  }

  test("ein Sitz aus einer Datei: der gezeigte Hash trägt sein Pack und unterscheidet sich vom Start ohne Sitz; das gesäte Notizbuch steht im laufenden Sitz", () => {
    expect(laeufe.sitz?.liest).toContain("Das Pack, das mit der Datei reiste.");
    expect(laeufe.sitz?.vorschau).not.toBe(laeufe.sitz?.ohneSitz);
    expect(laeufe["sitz-profil"]?.gedaechtnis).toBe("# Notizen\n- das Notizbuch reiste mit\n");
  });

  test("das Netz allein: eine Fassung, die sich nach der Prüfung der Tür bewegt, gibt 409; keine Pane davor, kein Slot, keine Datei danach", () => {
    const l = laeufe.netz;
    expect(l?.open).toBe(409);
    expect(l?.offenBody?.staleHash).toBe(l?.vorschau ?? "nichts gezeigt");
    expect(typeof l?.offenBody?.fassungsHash).toBe("string");
    expect(l?.offenBody?.fassungsHash).not.toBe(l?.vorschau);
    expect(l?.paneVorHalten).toBe(false);
    expect(l?.slotNachher).toBe(400);
    expect(l?.tmuxNachher).toBe(false);
    expect(l?.dateiNachher).toBe(false);
  });

  test("die Sperre wird frei: eine Öffnung, die nach dem Stempel abbricht, lässt den Slot nicht ungeheilt (nach dem Heal-Takt ist die Pane da)", () => {
    expect(laeufe.abbruch?.open).toBe(400);
    expect(laeufe.abbruch?.paneNachHeal).toBe(true);
  });

  test("die Sperre gilt nur dem eigenen Slot: während Slot 13 öffnet, heilt der Takt die gekillte Pane des Slots 14", () => {
    expect(laeufe.fremd?.open).toBe(200);
    expect(laeufe.fremd?.fremdWeg).toBe(true);
    expect(laeufe.fremd?.fremdZurueck).toBe(true);
  });

  test("Rechte, Profil, Bibliothek und Unterordner ändern den gezeigten Hash (die Vorschau rechnet sie mit)", () => {
    const namen = ["nackt", "rechte", "rechte-lesen", "profil", "bibliothek-aus", "unterordner", "alles"];
    const hashes = namen.map((k) => laeufe[k]?.vorschau);
    expect(hashes.every((h) => typeof h === "string")).toBe(true);
    expect(namen.filter((k, i) => hashes.indexOf(laeufe[k]?.vorschau) !== i)).toEqual([]);
  });

  test("veraltet: ein gezeigter Hash ohne die Rechte, die der Start mitbringt, gibt 409 mit dem Hash des Starts, und nichts läuft", () => {
    const l = laeufe.veraltet;
    expect(l?.open).toBe(409);
    expect(l?.offenBody?.staleHash).toBe(l?.vorschau && laeufe.nackt?.vorschau);
    expect(l?.offenBody?.fassungsHash).toBe(laeufe.rechte?.vorschau);
    expect((l as Lauf & { slotNachher?: number }).slotNachher).toBe(400);
  });
});

// DER WÄCHTER FÜR DIE BASIS (R11, Mangel M12): ein CLAUDE.md im Ordner oder darüber schaltet Claudes AGENTS.md-Rückfall ab. Ein Sitz
// ohne Rolle in Fleets Repo verlöre so die Basis, und die Fassung sagt es dann, mit der Datei, die sie abschaltet.
describe("ein Sitz ohne Rolle in Fleets Repo, dem ein CLAUDE.md die AGENTS.md nimmt", () => {
  test("die Fassung zeigt „Basis fehlt“ mit dem Pfad; ohne CLAUDE.md oder außerhalb von Fleets Baum schweigt sie", async () => {
    const dir = mkdtempSync(join(tmpdir(), "start-fassung-basis-"));
    try {
      mkdirSync(join(dir, "state"), { recursive: true });
      mkdirSync(join(dir, "home", ".claude"), { recursive: true });
      const oben = join(dir, "oben"), baum = join(oben, "baum"), sitz = join(baum, "sub");
      mkdirSync(sitz, { recursive: true });
      writeFileSync(join(baum, "AGENTS.md"), "Basis fixture\n");
      const out = join(dir, "out.json");
      const script = `
        const S = await import(${JSON.stringify(join(ROOT, "server.ts"))});
        const { writeFileSync, rmSync } = await import("node:fs");
        const regeln = (baum) => S.fassungProjektregelnAus(${JSON.stringify(sitz)}, "claude", false, false, false, baum)[0];
        const ohne = regeln(${JSON.stringify(baum)});
        writeFileSync(${JSON.stringify(join(oben, "CLAUDE.md"))}, "eine Regel von oben\\n");
        const mit = regeln(${JSON.stringify(baum)});
        const fremd = regeln(null);
        rmSync(${JSON.stringify(join(oben, "CLAUDE.md"))});
        await Bun.write(${JSON.stringify(out)}, JSON.stringify({ ohne, mit, fremd,
          fleet: await S.fleetBaumVon(${JSON.stringify(ROOT)}), draussen: await S.fleetBaumVon(${JSON.stringify(sitz)}) }));
        process.exit(0);
      `;
      const r = await runServer(script, dir);
      expect({ code: r.code, stderr: r.code === 0 ? "" : r.stderr.slice(-1500) }).toEqual({ code: 0, stderr: "" });
      type Regeln = { quelle: string | null; grund?: string };
      const z = JSON.parse(readFileSync(out, "utf8")) as { ohne: Regeln; mit: Regeln; fremd: Regeln; fleet: string | null; draussen: string | null };
      const real = (pfad: string): string => Bun.spawnSync(["realpath", pfad]).stdout.toString().trim();
      // ohne CLAUDE.md lädt Claude die AGENTS.md, und kein Hinweis steht da
      expect(z.ohne.quelle).toContain("AGENTS.md");
      expect(z.ohne.grund ?? "").not.toContain("Basis fehlt");
      // mit CLAUDE.md darüber fehlt sie, und die Fassung nennt die Datei und ihren Ordner
      expect(z.mit.quelle).not.toContain("AGENTS.md");
      expect(z.mit.grund).toBe(`Basis fehlt: CLAUDE.md in ${oben} schaltet ${baum}/AGENTS.md ab`);
      // außerhalb von Fleets Baum gibt es keine Basis, die fehlen könnte
      expect(z.fremd.grund ?? "").not.toContain("Basis fehlt");
      expect(z.fleet).toBe(real(ROOT));
      expect(z.draussen).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
