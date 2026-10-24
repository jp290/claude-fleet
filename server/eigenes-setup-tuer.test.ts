// DER BERECHTIGUNGSMODUS ALS WAHL AN DER TÜR UND DER BESTAND (server/eigenes-setup.ts#permissionModeDerTuer, server.ts#halteBestandFest):
// im eigenen Setup setzt Fleet keinen Modus, außer er ist gewählt; ein Sitz, der vor dem eigenen Setup lief, behält nach dem ersten Laden
// als Wahl, was sein Start trug (Mode auto, Fleets Bibliothek), auch über einen Neustart. Gemessen an der Zeile, mit der tmux die Pane
// startete, und an der Fassung derselben Session. Die Fixture ist ein fremdes Repo, also eigenes Setup.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Answer, branchTestkit, type Fixture, get, LIFE_DEADLINE_MS, persisted, post } from "./branches-testkit";

const { SOCKETS, fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

function startzeile(f: Fixture, cwd: string): string {
  const r = Bun.spawnSync(["tmux", "-L", f.sock, "list-panes", "-a", "-F", "#{pane_current_path}\t#{pane_start_command}"],
    { env: { ...process.env, TMUX_TMPDIR: SOCKETS } });
  const zeile = r.stdout.toString().split("\n").find((z) => z.startsWith(`${cwd}\t`));
  if (!zeile) throw new Error(`keine Pane in ${cwd}: ${r.stdout.toString()}${r.stderr.toString()}`);
  return zeile.slice(cwd.length + 1).replace(/^"|"$/g, "").replace(/\\(.)/g, "$1").replaceAll("'\\''", "'");
}
const offen = (a: Answer | undefined): void => {
  if (a?.status !== 200 && a?.status !== 201) throw new Error(`Öffnen schlug fehl: ${JSON.stringify(a)}`);
};
const darf = (a: Answer | undefined, id: string): string | null =>
  ((a?.body.teile as { id: string; abschnitte: { id: string; text: string | null }[] }[] | undefined) ?? [])
    .find((t) => t.id === "darf")?.abschnitte.find((x) => x.id === id)?.text ?? null;
// ein zweiter Ordner im selben fremden Repo: jede Pane hat ihren eigenen, damit ihre Startzeile eindeutig ist
const zwei = (f: Fixture): string => { const d = join(f.repo, "zwei"); mkdirSync(d, { recursive: true }); return d; };
type SlotRecord = { permissionMode?: string; bibliothek?: boolean; autoModeEnvironment?: boolean; selfToken?: string };
const recordOf = (f: Fixture, slot: number): SlotRecord => (persisted(f).slots as Record<string, SlotRecord>)[String(slot)] ?? {};

describe("der Berechtigungsmodus ist eine Wahl an der Tür", () => {
  test("ohne Wahl kein Modus auf der Zeile; gewählt steht er auf der Zeile und unter „mitgegeben“; ein fremder Wert wird abgelehnt", async () => {
    const f = fixture();
    const [ohne, mit, falsch, fassung, vorschau] = await life(f, [post("/api/slots/1/open", { cwd: f.repo }),
      post("/api/slots/2/open", { cwd: zwei(f), permissionMode: "acceptEdits" }),
      post("/api/slots/3/open", { cwd: f.repo, permissionMode: "default" }), get("/api/slots/2/fassung?anlass=laufend"),
      get(`/api/founding-plan?repo=${encodeURIComponent(f.repo)}&role=nur-ordner&anlass=neu&permissionMode=plan`)]);
    offen(ohne);
    offen(mit);
    const zeilen = Bun.spawnSync(["tmux", "-L", f.sock, "list-panes", "-a", "-F", "#{pane_start_command}"],
      { env: { ...process.env, TMUX_TMPDIR: SOCKETS } }).stdout.toString().split("\n").filter(Boolean);
    expect(zeilen.filter((z) => z.includes("--permission-mode")).length).toBe(1);
    expect(zeilen.find((z) => z.includes("--permission-mode"))).toContain("--permission-mode 'acceptEdits'");
    expect(darf(fassung, "mitgegeben")).toBe("permissionMode: acceptEdits");
    expect(darf(fassung, "modus")).toBe("eigenes Setup — Berechtigungsmodus acceptEdits, beim Öffnen gewählt");
    expect(darf({ status: 200, body: vorschau?.body.fassung as Record<string, unknown> }, "mitgegeben")).toBe("permissionMode: plan");
    expect(falsch?.status).toBe(400);
    expect(String(falsch?.body.error)).toContain("permissionMode must be one of");
  }, LIFE_DEADLINE_MS * 3);
});

describe("ein Sitz von vor dem eigenen Setup startet weiter wie heute", () => {
  test("beim ersten Laden ohne Marke: permissionMode auto und Bibliothek als Wahl, auf der Zeile nach dem Neustart; eine Abwahl bleibt", async () => {
    const f = fixture();
    const [a, b] = await life(f, [post("/api/slots/1/open", { cwd: f.repo }), post("/api/slots/2/open", { cwd: zwei(f), bibliothek: false })]);
    offen(a);
    offen(b);
    expect(startzeile(f, f.repo)).not.toContain("--permission-mode");
    expect(persisted(f).eigenesSetupBestand).toBe(true);
    // der Stand, den ein Server vor dem eigenen Setup schrieb: ohne Marke und ohne Wahl
    const alt = persisted(f);
    delete alt.eigenesSetupBestand;
    writeFileSync(join(f.state, "fleet.json"), JSON.stringify(alt));
    // die laufende Fassung ist die, die beim Öffnen der Belegung festgehalten wurde; die Wahl zeigt die Fassung der Nachfolgerin, die sie erbt
    const [neustart, fassung] = await life(f, [post("/api/slots/1/restart", {}), get("/api/slots/1/fassung?anlass=nachfolge")]);
    expect(darf(fassung, "mitgegeben")).toBe("permissionMode: auto\nbibliothek: an\nautoModeEnvironment: an");
    expect(recordOf(f, 1)).toMatchObject({ permissionMode: "auto", bibliothek: true, autoModeEnvironment: true });
    expect(recordOf(f, 2)).toMatchObject({ permissionMode: "auto", bibliothek: false, autoModeEnvironment: true });
    expect(neustart?.status).toBeLessThan(300);
    expect(startzeile(f, f.repo)).toContain("--permission-mode 'auto'");
    expect(startzeile(f, f.repo)).toContain('"autoMode":{"environment":[');
    // mit Marke geschieht nichts mehr: eine Wahl, die danach fehlt, wird nicht wieder gesetzt
    const neu = persisted(f);
    delete (neu.slots as Record<string, Record<string, unknown>>)["1"]!.permissionMode;
    writeFileSync(join(f.state, "fleet.json"), JSON.stringify(neu));
    await life(f, [get("/api/slots/1/fassung?anlass=laufend")]);
    expect(recordOf(f, 1).permissionMode).toBeUndefined();
  }, LIFE_DEADLINE_MS * 4);
});

describe("an der Selbst-Tür gibt eine Session keinen weiteren Modus als ihren eigenen", () => {
  test("bypassPermissions über den Self-Token wird abgelehnt", async () => {
    const f = fixture();
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo })]);
    offen(opened);
    const self = (persisted(f).slots as Record<string, { selfToken?: string }>)["1"]?.selfToken;
    if (!self) throw new Error("kein Self-Token");
    const [, weiter] = await life(f, [post("/api/branches", { repo: f.repo, name: "Mode X" }),
      { ...post("/api/self/branches/open", { branch: "branch/mode-x", permissionMode: "bypassPermissions" }), token: null, self }]);
    expect(weiter?.status).toBe(409);
    expect(String(weiter?.body.error)).toContain("wider than the opener");
  }, LIFE_DEADLINE_MS * 3);
});

// WAS AUS ~/.claude WEGBLEIBT (Runde 3): an der Tür gewählt oder vom Sitz selbst für seinen nächsten Start gesetzt; die Zeile trägt es, die Fassung nennt es
describe("Teile aus ~/.claude weglassen", () => {
  test("an der Tür: auf der Zeile und unter „weggelassen“; ohne Wahl „nichts“; die Umgebung des Klassifizierers als eigene Wahl", async () => {
    const f = fixture();
    mkdirSync(join(f.repo, "drei"), { recursive: true });
    const [ohne, mit, umgebung, falsch, fOhne, fMit] = await life(f, [post("/api/slots/1/open", { cwd: f.repo }),
      post("/api/slots/2/open", { cwd: zwei(f), weglassen: { claudeMd: true, rules: true, agents: ["e2e-runner"], skills: ["audit"], mcp: ["playwright"], hooks: true } }),
      post("/api/slots/3/open", { cwd: join(f.repo, "drei"), autoModeEnvironment: true }), post("/api/slots/4/open", { cwd: f.repo, weglassen: { agenten: ["x"] } }),
      get("/api/slots/1/fassung?anlass=laufend"), get("/api/slots/2/fassung?anlass=laufend")]);
    offen(ohne);
    offen(mit);
    offen(umgebung);
    expect(falsch?.status).toBe(400);
    expect(darf(fOhne, "weggelassen")).toBe("nichts");
    expect(darf(fMit, "weggelassen")).toBe(["claudeMd: ~/.claude/CLAUDE.md", "rules: ~/.claude/rules/**", "agents: e2e-runner", "skills: audit",
      "mcp: playwright (ihre Werkzeuge; der Server startet weiter)", "hooks: alle (auch Statuszeile und @-Vorschlag)"].join("\n"));
    const zeile = startzeile(f, zwei(f));
    // Claudes Ordner liegt im Kit unter seinem Temp-Ordner (FLEET_CLAUDE_PROJECTS_DIR), darum nur das Pfadende
    for (const da of ["/CLAUDE.md\",", "/rules/**\"]", "--disallowedTools 'Agent(e2e-runner)'", '"skillOverrides":{"audit":"off"}',
      '"deny":["mcp__playwright"]', '"disableAllHooks":true']) expect(zeile).toContain(da);
    expect(startzeile(f, f.repo)).not.toContain("--settings");
    expect(startzeile(f, join(f.repo, "drei"))).toContain('"autoMode":{"environment":[');
  }, LIFE_DEADLINE_MS * 3);

  test("der Sitz selbst: POST /api/self/weglassen gilt ab seinem nächsten Start und geht an die Nachfolgerin", async () => {
    const f = fixture();
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo })]);
    offen(opened);
    const self = recordOf(f, 1).selfToken;
    if (!self) throw new Error("kein Self-Token");
    const [gesetzt, falsch, neustart, nachfolge] = await life(f, [
      { ...post("/api/self/weglassen", { weglassen: { claudeMd: true } }), token: null, self },
      { ...post("/api/self/weglassen", { weglassen: { claudeMd: "ja" } }), token: null, self },
      post("/api/slots/1/restart", {}), get("/api/slots/1/fassung?anlass=nachfolge")]);
    expect(gesetzt?.status).toBe(200);
    expect(gesetzt?.body.zeilen).toEqual(["claudeMd: ~/.claude/CLAUDE.md"]);
    expect(falsch?.status).toBe(400);
    expect(neustart?.status).toBeLessThan(300);
    expect(startzeile(f, f.repo)).toContain('"claudeMdExcludes":[');
    expect(startzeile(f, f.repo)).toContain('/CLAUDE.md"]');
    expect(darf(nachfolge, "weggelassen")).toBe("claudeMd: ~/.claude/CLAUDE.md");
  }, LIFE_DEADLINE_MS * 3);
  test("eine Lane lässt über die Selbst-Tür nichts weg: ihre Hooks sind Fleets Schutz", async () => {
    const f = fixture();
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo })]);
    offen(opened);
    const self = recordOf(f, 1).selfToken;
    if (!self) throw new Error("kein Self-Token");
    const stand = persisted(f);
    (stand.slots as Record<string, Record<string, unknown>>)["1"]!.worktree = { repo: f.repo, branch: "fleet/lane-probe" };
    writeFileSync(join(f.state, "fleet.json"), JSON.stringify(stand));
    const [lane] = await life(f, [{ ...post("/api/self/weglassen", { weglassen: { hooks: true } }), token: null, self }]);
    expect(lane?.status).toBe(409);
    expect(String(lane?.body.error)).toContain("a lane keeps its hooks");
  }, LIFE_DEADLINE_MS * 2);
});

// DIE EINGEBAUTEN WERKZEUGE ALS WAHL (Nachtrag Runde 3) und ein Slot, der die Wahlen von Slot 16 trägt: auto, Opus 5.5 [1m], xhigh,
// 13 Werkzeuge, ohne ~/.claude/CLAUDE.md und rules/** — auf der Zeile und in der Fassung, die seine Nachfolgerin bekäme
describe("die eingebauten Werkzeuge sind eine Wahl", () => {
  const DREIZEHN = ["Bash", "Read", "Edit", "Write", "ToolSearch", "Agent", "Skill", "TaskStop", "WebFetch", "WebSearch", "Monitor", "ScheduleWakeup", "SendMessage"];
  test("ein Slot trägt alle Wahlen von Slot 16, die Nachfolgerin erbt sie; ohne Wahl kein --tools", async () => {
    const f = fixture();
    const [ohne, mit, falsch, nachfolge] = await life(f, [post("/api/slots/1/open", { cwd: f.repo }),
      post("/api/slots/2/open", { cwd: zwei(f), model: "claude-opus-5-5[1m]", effort: "xhigh", permissionMode: "auto", tools: DREIZEHN,
        weglassen: { claudeMd: true, rules: true } }),
      post("/api/slots/3/open", { cwd: f.repo, tools: ["mcp__playwright__browser_click"] }), get("/api/slots/2/fassung?anlass=nachfolge")]);
    offen(ohne);
    offen(mit);
    expect(falsch?.status).toBe(400);
    expect(startzeile(f, f.repo)).not.toContain("--tools");
    const zeile = startzeile(f, zwei(f));
    for (const da of ["--model 'claude-opus-5-5[1m]'", "--effort 'xhigh'", "--permission-mode 'auto'", `--tools '${DREIZEHN.join(",")}'`, "/CLAUDE.md\",", "/rules/**\"]"])
      expect(zeile).toContain(da);
    expect(darf(nachfolge, "mitgegeben")).toBe(["model: claude-opus-5-5[1m]", "effort: xhigh", "permissionMode: auto", `tools: ${DREIZEHN.join(", ")}`].join("\n"));
    expect(darf(nachfolge, "weggelassen")).toBe("claudeMd: ~/.claude/CLAUDE.md\nrules: ~/.claude/rules/**");
    const werkzeuge = ((nachfolge?.body.teile as { id: string; abschnitte: { id: string; grund?: string }[] }[]).find((t) => t.id === "darf")
      ?.abschnitte.find((a) => a.id === "werkzeuge"))?.grund ?? "";
    expect(werkzeuge).toContain("Schemas am Start:");
    expect(werkzeuge).toContain("aufgeschoben, nur der Name am Start: TaskStop");
  }, LIFE_DEADLINE_MS * 3);
});

// DIE ÜBERGABE IST IM EIGENEN SETUP AUS, BIS DIE TÜR EINE SCHWELLE WÄHLT (Slot 16 für den Owner, 24.10.: „[Zitat entfernt]“
// ): der Takt fragt dieselbe Schwelle (server.ts#thresholdFor), die die Selbst-Tür nennt — Basis 0, also kein Hinweis in die Pane.
const arbeitet = (a: Answer | undefined, id: string): string | null =>
  ((a?.body.teile as { id: string; abschnitte: { id: string; text: string | null }[] }[] | undefined) ?? [])
    .find((t) => t.id === "arbeitet")?.abschnitte.find((x) => x.id === id)?.text ?? null;
describe("im eigenen Setup tippt Fleet ohne gewählte Schwelle keinen Übergabe-Hinweis", () => {
  test("ohne schwelle aus (Selbst-Tür und Fassung), mit schwelle 40 an; beides hält über einen Neustart", async () => {
    const f = fixture();
    // der Übergabe-Takt ist an, wie auf dem Live-Server (FLEET_MIGRATE_PCT); ohne ihn wäre jede Schwelle aus
    const takt = { FLEET_MIGRATE_PCT: "35" };
    const [ohne, mit] = await life(f, [post("/api/slots/1/open", { cwd: f.repo }), post("/api/slots/2/open", { cwd: zwei(f), schwelle: 40 })], takt);
    offen(ohne);
    offen(mit);
    const s1 = recordOf(f, 1).selfToken, s2 = recordOf(f, 2).selfToken;
    if (!s1 || !s2) throw new Error("kein Self-Token");
    const lesen = () => life(f, [{ ...get("/api/self"), token: null, self: s1 }, { ...get("/api/self"), token: null, self: s2 },
      get("/api/slots/1/fassung?anlass=laufend"), get("/api/slots/2/fassung?anlass=laufend")], takt);
    const pruefe = (a: Answer[]): void => {
      expect(a[0]?.body.context).toMatchObject({ basePct: null, from: "setup", off: "setup" });
      expect(a[1]?.body.context).toMatchObject({ basePct: 40, capPct: 45, from: "session", off: null });
      expect(arbeitet(a[2], "schwelle")).toStartWith("Übergabe-Schwelle aus: eigenes Setup");
      expect(arbeitet(a[3], "schwelle")).toStartWith("Übergabe ab 40 % · fällig ab 45 %");
    };
    pruefe(await lesen());
    // der Spawn-Datensatz trägt es über den Neustart (server/session-start.ts#slotSpawnFrom)
    expect((persisted(f).slots as Record<string, { spawn?: { eigen?: boolean } }>)["1"]?.spawn?.eigen).toBe(true);
    const [neustart] = await life(f, [post("/api/slots/1/restart", {})], takt);
    expect(neustart?.status).toBeLessThan(300);
    pruefe(await lesen());
  }, LIFE_DEADLINE_MS * 5);
});

// EIN PURPOSE ALS TEXT AN DER TÜR (Slot 16 für den Owner, 24.10.): die Zeile trägt ihn im Systemprompt, die Fassung zeigt ihn und nennt ihn
// unter „[Zitat entfernt]“, er übersteht einen Neustart — und er tauscht das Gedächtnis nicht (Prüfung Runde 7, C2): kein eigenes Notizbuch
const liest = (a: Answer | undefined, id: string): string | null =>
  ((a?.body.teile as { id: string; abschnitte: { id: string; text: string | null }[] }[] | undefined) ?? [])
    .find((t) => t.id === "liest")?.abschnitte.find((x) => x.id === id)?.text ?? null;
describe("ein Purpose als Text an der Tür", () => {
  test("purpose: Zeile, Fassung, mitgegeben, Neustart; kein Notizbuch; mit profil, leer oder ohne Claude abgelehnt", async () => {
    const f = fixture();
    const zweck = "Review only the texts of this repo and report findings with file and line.";
    const [mit, beide, leer, fassung, vorschau] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, purpose: `  ${zweck}\n` }),
      post("/api/slots/2/open", { cwd: zwei(f), purpose: zweck, profil: "planer" }), post("/api/slots/3/open", { cwd: zwei(f), purpose: " " }),
      get("/api/slots/1/fassung?anlass=laufend"),
      get(`/api/founding-plan?repo=${encodeURIComponent(f.repo)}&role=nur-ordner&anlass=neu&purpose=${encodeURIComponent(zweck)}`)]);
    offen(mit);
    expect(beide?.status).toBe(400);
    expect(String(beide?.body.error)).toContain("purpose and profil");
    expect(leer?.status).toBe(400);
    const zeile = startzeile(f, f.repo);
    expect(zeile).toContain("PURPOSE (beim Start vom Owner geschrieben):");
    expect(zeile).toContain(zweck);
    expect(zeile).not.toContain("autoMemoryDirectory");
    expect(liest(fassung, "eigenes")).toBe(`PURPOSE (beim Start vom Owner geschrieben):\n${zweck}`);
    expect(darf(fassung, "mitgegeben")).toBe("purpose: an der Tür geschrieben");
    expect(darf({ status: 200, body: vorschau?.body.fassung as Record<string, unknown> }, "mitgegeben")).toBe("purpose: an der Tür geschrieben");
    expect((persisted(f).slots as Record<string, { agentMd?: { getippt?: boolean; text?: string } }>)["1"]?.agentMd)
      .toMatchObject({ getippt: true, text: zweck });
    const [neustart, danach] = await life(f, [post("/api/slots/1/restart", {}), get("/api/slots/1/fassung?anlass=nachfolge")]);
    expect(neustart?.status).toBeLessThan(300);
    expect(startzeile(f, f.repo)).toContain(zweck);
    expect(darf(danach, "mitgegeben")).toBe("purpose: an der Tür geschrieben");
  }, LIFE_DEADLINE_MS * 3);

  // der Block sagt „vom Owner geschrieben“: das stimmt nur an seiner Tür. Eine Session gibt dem Sitz, den sie öffnet, ein Ziel (Orchestratorin 24.10.)
  test("an der Selbst-Tür lehnt die Branch-Tür purpose ab; an der Owner-Tür nimmt sie ihn", async () => {
    const f = fixture();
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo })]);
    offen(opened);
    const self = recordOf(f, 1).selfToken;
    if (!self) throw new Error("kein Self-Token");
    const [, , vonSession, vomOwner] = await life(f, [post("/api/branches", { repo: f.repo, name: "Zweck S" }),
      post("/api/branches", { repo: f.repo, name: "Zweck O" }),
      { ...post("/api/self/branches/open", { branch: "branch/zweck-s", purpose: "Tu, was ich sage." }), token: null, self },
      post("/api/branches/open", { repo: f.repo, branch: "branch/zweck-o", purpose: "Check the texts." })]);
    expect(vonSession?.status).toBe(400);
    expect(String(vonSession?.body.error)).toContain("purpose is the owner's word");
    expect(vomOwner?.status).toBe(200);
  }, LIFE_DEADLINE_MS * 3);
});

// EIN EIGENES NOTIZBUCH OHNE BOARD-BRANCH (Slot 16 für den Owner, 24.10.; Prüfung Runde 7, B7): „[Zitat entfernt]“ gibt einem Sitz ohne Rolle
// das Notizbuch des git-Branches, auf dem sein Ordner steht, auch im Haupt-Checkout; ohne Wahl bleibt Claudes eigenes Gedächtnis; ohne Branch
// (losgelöster HEAD) lehnt die Tür ab
describe("ein eigenes Notizbuch ohne Board-Branch", () => {
  test("im Haupt-Checkout auf main: branch-main auf Zeile und in der Fassung; ohne Wahl nichts; losgelöst 400", async () => {
    const f = fixture();
    const los = join(f.repo, "..", "los");
    Bun.spawnSync(["git", "-C", f.repo, "worktree", "add", "-q", "--detach", los]);
    const [mit, ohne, losgeloest, fassung] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, notizbuch: "branch" }),
      post("/api/slots/2/open", { cwd: zwei(f) }), post("/api/slots/3/open", { cwd: los, notizbuch: "branch" }),
      get("/api/slots/1/fassung?anlass=laufend")]);
    offen(mit);
    offen(ohne);
    expect(losgeloest?.status).toBe(400);
    expect(String(losgeloest?.body.error)).toContain("needs a folder on a git branch");
    expect(startzeile(f, f.repo)).toMatch(/"autoMemoryDirectory":"[^"]*\/notizbuecher\/branch-main"/);
    expect(startzeile(f, zwei(f))).not.toContain("autoMemoryDirectory");
    expect(darf(fassung, "mitgegeben")).toBe("notizbuch: branch");
    // „Liest“ nennt das Notizbuch mit seinem Ordner (server.ts#fassungGedaechtnisAus)
    const gedaechtnis = ((fassung?.body.teile as { id: string; abschnitte: { id: string; quelle?: string | null; notizbuch?: { pfad?: string } }[] }[])
      .find((x) => x.id === "liest")?.abschnitte.find((a) => a.id === "gedaechtnis"));
    expect(JSON.stringify(gedaechtnis)).toContain("/notizbuecher/branch-main");
  }, LIFE_DEADLINE_MS * 2);
});
