// Tests für die Fassung (docs/agent-objekt.md, Schnitt 1): der Hash hängt am Inhalt aller fünf
// Teile, fehlende Quellen stehen als `unknown` mit Grund, und die Startbytes von drei Fixture-Slots
// sind nach dem Herausziehen der Rollenkarten byte-gleich zu den vorher festgehaltenen Bytes.
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { anatomieAusTranskript } from "./claude-code-anatomie";
import { baueFassung, LIEST_REIHENFOLGE, textAbschnitt, unknownAbschnitt, type FassungEingang } from "./fassung";
import { fragmentFileName, renderRoleRulebook, renderRulebook, RULEBOOK_FRAGMENTS } from "../rulebook";

const ROOT = join(import.meta.dir, "..");

const eingang = (over: Partial<FassungEingang> = {}): FassungEingang => ({
  slot: 7,
  anlass: "laufend",
  wer: [textAbschnitt("harness", "Slot.harness", "claude"), textAbschnitt("modell", "Slot.model", "m1"),
    textAbschnitt("effort", "Slot.effort", "high")],
  aufgabe: [textAbschnitt("aufgabe", "Queue-Zeile t1", "ZIEL: die Fassung zeigen\nDONE: Route und Test")],
  liest: [
    textAbschnitt("rolle", "rollenkarte", "--- ROLLE --- Lane"),
    textAbschnitt("projektregeln", "CLAUDE.md", "Regel A"),
    textAbschnitt("wissen", "Anker", "pack:portable-core"),
    textAbschnitt("uebergabe", "handoff", "offen: nichts"),
    textAbschnitt("eigenes", "Agent-MD", "Eigene Regel"),
  ],
  darf: [textAbschnitt("darf", "Slot.rechte", "FLEET-RECHTE ...")],
  arbeitet: [textAbschnitt("arbeitet", "laneExitFooter", "Empfänger: program-main Slot 1")],
  ...over,
});

const liestTexte = (f: ReturnType<typeof baueFassung>) =>
  f.teile.find((teil) => teil.id === "liest")!.abschnitte.map((a) => [a.id, a.text, a.grund ?? null]);

describe("fassungsHash", () => {
  test("gleicher Inhalt ergibt denselben Hash, auch bei anderer Feldreihenfolge", () => {
    const a = baueFassung(eingang());
    const b = baueFassung({ ...eingang(), darf: [...eingang().darf] });
    expect(a.hash).toBe(b.hash);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("ein geändertes Byte in einer geladenen Datei ändert den Hash", () => {
    const a = baueFassung(eingang());
    const b = baueFassung(eingang({ liest: eingang().liest.map((x) =>
      x.id === "projektregeln" ? textAbschnitt("projektregeln", "CLAUDE.md", "Regel B") : x) }));
    expect(b.hash).not.toBe(a.hash);
  });

  test("eine andere Aufgabe ändert den Hash", () => {
    const a = baueFassung(eingang());
    const b = baueFassung(eingang({ aufgabe: [textAbschnitt("aufgabe", "Queue-Zeile t1", "ZIEL: etwas anderes")] }));
    expect(b.hash).not.toBe(a.hash);
  });

  test("andere Rechte ändern den Hash", () => {
    const a = baueFassung(eingang());
    const b = baueFassung(eingang({ darf: [textAbschnitt("darf", "Slot.rechte", "FLEET-RECHTE ... gesperrt: landen")] }));
    expect(b.hash).not.toBe(a.hash);
  });

  test("was Claude Code mitbringt, gehört nicht in den Hash", () => {
    const a = baueFassung(eingang({ claudeCode: { tokens: 10 } }));
    const b = baueFassung(eingang({ claudeCode: { tokens: 99, zeilen: ["x"] } }));
    expect(a.hash).toBe(b.hash);
    expect(a.hashUmfasst).toBe("fuenf-teile");
  });
});

describe("die fünf Teile", () => {
  test("Liest steht in Ladereihenfolge; Übergabe nur bei nachfolge, Richtung nur wenn getragen", () => {
    expect(baueFassung(eingang()).teile.find((t) => t.id === "liest")!.abschnitte.map((a) => a.id))
      .toEqual(LIEST_REIHENFOLGE.filter((id) => id !== "uebergabe" && id !== "richtung"));
    expect(baueFassung(eingang({ anlass: "nachfolge" })).teile.find((t) => t.id === "liest")!.abschnitte.map((a) => a.id))
      .toEqual(LIEST_REIHENFOLGE.filter((id) => id !== "richtung"));
    // Die Orchestratorin trägt die Richtung als ersten Abschnitt; keine andere Rolle erbt davon.
    expect(baueFassung(eingang({ liest: [textAbschnitt("richtung", "docs/start/direction.md", "Richtung"), ...eingang().liest] }))
      .teile.find((t) => t.id === "liest")!.abschnitte.map((a) => a.id))
      .toEqual(LIEST_REIHENFOLGE.filter((id) => id !== "uebergabe"));
  });

  test("eine fehlende Quelle steht als unknown mit Grund da, nie leer, und bleibt im Hash", () => {
    const a = baueFassung(eingang({ liest: eingang().liest.filter((x) => x.id !== "wissen")
      .concat([unknownAbschnitt("wissen", "keine Quelle")]) }));
    const wissen = liestTexte(a).find(([id]) => id === "wissen")!;
    expect(wissen[1]).toBeNull();
    expect(wissen[2]).toContain("keine Quelle");
    const b = baueFassung(eingang({ liest: eingang().liest.filter((x) => x.id !== "wissen")
      .concat([unknownAbschnitt("wissen", "keine Quelle")]) }));
    expect(b.hash).toBe(a.hash);
    expect(a.hash).not.toBe(baueFassung(eingang()).hash);
  });

  test("bei laufend fällt eine mitgegebene Übergabe weg, ohne den Rest zu verändern", () => {
    const mit = baueFassung(eingang());
    const ohne = baueFassung(eingang({ liest: eingang().liest.filter((x) => x.id !== "uebergabe") }));
    expect(ohne.hash).toBe(mit.hash);
  });

  test("Bytes sind die Bytes des Textes, ein unbekannter Abschnitt meldet unknown", () => {
    const f = baueFassung(eingang({ liest: [unknownAbschnitt("rolle", "keine Rolle")] }));
    const rolle = f.teile.find((t) => t.id === "liest")!.abschnitte.find((a) => a.id === "rolle")!;
    expect(rolle.bytes).toBe("unknown");
    const aufgabe = f.teile.find((t) => t.id === "aufgabe")!.abschnitte[0]!;
    expect(aufgabe.bytes).toBe(Buffer.byteLength(aufgabe.text!));
  });
});

// DIE STARTBYTES BLEIBEN (Fertig-kriterium 5): die Fixture wurde VOR dem Herausziehen der
// Rollenkarten aus dem damaligen server.ts aufgenommen. Der Test lädt server.ts in einem eigenen
// Prozess (wie server/load.test.ts) und vergleicht Startbrief und Startzeile der drei Slots.
describe("die Startbytes der übrigen Rollen bleiben", () => {
  test("MAIN, Lane, freie Session und Steward: Startbrief und Startzeile sind byte-gleich", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fassung-spawn-"));
    const out = join(dir, "after.json");
    const script = `
      const out = process.env.FASSUNG_OUT;
      const S = await import(${JSON.stringify(join(ROOT, "server.ts"))});
      const rechte = { stufe: "standard", an: ["lesen", "bearbeiten"], aus: ["loeschen"] };
      const agentMd = { profil: "p1", titel: "agent.md", text: "Eigene Regel A\\nEigene Regel B", sha256: "0".repeat(64) };
      const laneRows = [
        { id: "t1", text: "ZIEL: die Fassung zeigen\\nDONE: Route und Test", brief: { text: "ZIEL: die Fassung zeigen (geschaerft)\\nDONE: Route und Test" }, card: null, comments: [] },
      ];
      const laneBrief = S.buildLaneSuccessionBrief({ branch: "lane/fixture", base: "main", session: 2,
        rows: laneRows, log: "abc1234 feat: die Fassung zeigen", handoff: { id: "r1", text: "fertig: Route steht; offen: nichts" },
        reason: "context 80 %", decision: "fleet-report r1: accepted", footer: "\\n\\n--- HOW THIS LANE ENDS (fixture) ---\\n", contextBlock: "\\n\\nANKER (fixture)\\n",
        ownerInputs: [], korrekturen: "OWNER-KORREKTUREN (fixture)" });
      const laneCmd = S.slotCmd("22222222-2222-4222-8222-222222222222", false, "claude-opus-5[1m]", "high",
        false, null, [], "lane", true, null, rechte, agentMd);
      const freeBrief = await S.buildSuccessionBrief("/nonexistent/fixture-free", null, { obligations: [], intent: null, pointer: null, carry: false, now: 1_760_000_000_000, laneNow: () => null });
      const freeCmd = S.slotCmd("33333333-3333-4333-8333-333333333333", false, null, null, true, null, [], "generic", false, null, null, null);
      const program = { id: "p1", title: "Fassung", intent: "die Fassung zeigen", successCriterion: "Route und Test", nonGoals: ["nichts anderes"],
        decisions: [], evidence: [], openQuestions: [], status: "active", createdAt: 1, proposedBy: { kind: "owner" } };
      const mainBrief = S.buildProgramMainBrief(program, "fleet-control", "\\n\\nANKER (fixture)\\n", "OWNER-KORREKTUREN (fixture)");
      const mainCmd = S.slotCmd("44444444-4444-4444-8444-444444444444", false, "claude-opus-5[1m]", "high",
        true, "main", [], "main", true, null, rechte, agentMd);
      const stewardCmd = S.slotCmd("55555555-5555-4555-8555-555555555555", false, "claude-opus-5[1m]", "high",
        true, "main", [], "main", true, null, null, null);
      const roleCards = { main: S.MAIN_ROLE_CARD, lane: S.LANE_ROLE_CARD };
      await Bun.write(out, JSON.stringify({ laneBrief, laneCmd, freeBrief, freeCmd, mainBrief, mainCmd, stewardCmd, roleCards }, null, 2) + "\\n");
    `;
    const home = join(dir, "home");
    const state = join(dir, "state");
    const proc = Bun.spawn([process.execPath, "--no-env-file", "-e", script], { cwd: ROOT, stdout: "pipe", stderr: "pipe",
      env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: home, SHELL: "/bin/sh", FLEET_HOST: "127.0.0.1",
        FLEET_PORT: "8790", FLEET_SOCK: "fleetfixture", FLEET_STATE_DIR: state, FLEET_CMD: "claude", FASSUNG_OUT: out } });
    const exitCode = await Promise.race([proc.exited, Bun.sleep(60_000).then(() => { proc.kill("SIGKILL"); return -1; })]);
    const stderr = await new Response(proc.stderr).text();
    try {
      expect({ exitCode, stderr: exitCode === 0 ? "" : stderr.slice(-1200) }).toEqual({ exitCode: 0, stderr: "" });
      const before = JSON.parse(readFileSync(join(import.meta.dir, "fassung-spawn-bytes-uebrige.json"), "utf8"));
      const after = JSON.parse(readFileSync(out, "utf8"));
      expect(after).toEqual(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 75_000);

  test("die Orchestratorin bekommt Richtung, Rolle, Systemkonzept und fünf Packs — nicht mehr die Rollenkarte", async () => {
    const dir = mkdtempSync(join(tmpdir(), "orchestrator-start-"));
    const out = join(dir, "out.json");
    const pfade = ["docs/start/direction.md", "docs/start/orchestrator.md", "docs/start/system-concept.md",
      "docs/packs/setting-up-agents.md", "docs/packs/working-with-the-owner.md", "docs/packs/how-fleet-remembers.md",
      "docs/packs/working-toward-a-goal.md", "docs/packs/who-it-is-for.md"];
    // DER PLAN BRAUCHT EINEN EIGENEN BAUM MIT EINEM ZWEIG: der Merge-Check prüft einen Checkout,
    // dem der Integrationszweig fehlen darf. Die acht Texte (und das Manifest, das die fünf Packs
    // registriert) werden aus dem Checkout in ein kleines Repo kopiert und dort committet; so fragt
    // der Test den Gründungsplan, ohne sich auf den Zweig des umgebenden Baums zu verlassen.
    const repo = join(dir, "repo");
    gitRepo(repo);
    mkdirSync(join(dir, "state"), { recursive: true }); // appendEvent schreibt die Belege hierhin
    for (const pfad of [...pfade, ".fleet/context-packs.json"]) {
      mkdirSync(dirname(join(repo, pfad)), { recursive: true });
      cpSync(join(ROOT, pfad), join(repo, pfad));
    }
    Bun.spawnSync(["git", "add", "."], { cwd: repo });
    Bun.spawnSync(["git", "-c", "user.email=f@f.f", "-c", "user.name=f", "commit", "-qm", "start"], { cwd: repo });
    const script = `
      const S = await import(${JSON.stringify(join(ROOT, "server.ts"))});
      const lineage = { obligations: [{ kind: "watch", id: "w1", target: { kind: "audit", repo: "/fixture/repo", mainAfter: "a".repeat(40) } }],
        intent: "Naechster Schritt: Karte schaerfen", pointer: null, carry: true, now: 1_760_000_000_000, laneNow: () => null };
      const parts = S.readOrchestratorStartParts(process.env.FIX_ROOT);
      const brief = S.buildOrchestratorSpawnBrief(parts);
      const succession = S.buildOrchestratorSuccessionBrief(parts, "f1c70000000000000000cafe", lineage, "Das Erste, was ich täte: den nächsten Akt wählen.");
      const orchCmd = S.slotCmd("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", false, "claude-opus-5[1m]", "high",
        true, "orchestrator", [], "orchestrator", true, null, null, null);
      const slot = { id: 1, cwd: process.env.FIX_ROOT, openedAt: 1, label: "Orchestrator (Opus)", worktree: null,
        harness: "claude", model: null, effort: null, rechte: null, agentMd: null, history: [],
        sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", programId: null, taskId: null, lineageId: null,
        selfToken: "x", packMcp: [], context: null, permissions: null, sleeping: null, standingHandover: null,
        compaction: null, startCompact: null, spawn: null, laneStandNudged: null, plan: null, handover: null,
        container: null, containerContext: null, originId: null, releasedBy: null, laneSuccessions: 0, laneSeats: [],
        browser: false, remote: false, webSearch: false, openedBy: null, lauf: null, clients: [], awaiting: null,
        mission: null, successionRetirement: null, codexRecoveryState: null, codexPaneSpawnedAt: null,
        codexDisconnectSeenAt: null, codexFirstTurn: null, sessionIdLearned: null };
      const fassung = await S.fassungFuerSlot(slot, "nachfolge");
      const laufend = await S.fassungFuerSlot(slot, "laufend");
      const plan = await S.foundingPlanAnswer({ repo: process.env.FIX_ROOT, role: "orchestratorin", ort: null, mode: null,
        harness: "claude", model: null, effort: null, bausteine: null, packs: null, parts: null, anlass: null });
      if (!plan.ok) throw new Error("plan refused: " + JSON.stringify(plan));
      // DER START-BELEG TRÄGT DEN HASH DER GEZEIGTEN FASSUNG: einmal für das Öffnen (laufend),
      // einmal für die Nachfolge. appendEvent schreibt in derselben Zustellkette; danach ist die
      // Ledger-Datei lesbar und wird hier wörtlich geprüft.
      await S.appendOrchestratorStartReceipt(slot, parts, "laufend", brief, 1_760_000_000_001);
      await S.appendOrchestratorStartReceipt(slot, parts, "nachfolge", succession, 1_760_000_000_002);
      const ledger = await Bun.file(\`\${process.env.FLEET_STATE_DIR}/context-receipts.jsonl\`).text();
      const receipts = ledger.trim().split("\\n").map((line) => JSON.parse(line));
      await Bun.write(${JSON.stringify(out)}, JSON.stringify({ brief, succession, orchCmd, fassung, laufend, plan: plan.body, receipts }, null, 2));
    `;
    try {
      const r = await runServer(script, { FIX_ROOT: repo }, dir);
      expect({ code: r.code, stderr: r.code === 0 ? "" : r.stderr.slice(-1500) }).toEqual({ code: 0, stderr: "" });
      const got = JSON.parse(readFileSync(out, "utf8")) as {
        brief: string; succession: string; orchCmd: string;
        fassung: { hash: string; teile: { id: string; abschnitte: { id: string; quelle: string | null; bytes: number | "unknown"; text: string | null }[] }[] };
        laufend: { hash: string };
        plan: { fassungsHash: string; sessionAgents: { text: string; bytes: number; parts: { path: string | null }[] } };
        receipts: { hash: string }[];
      };
      const texte = pfade.map((pfad) => readFileSync(join(ROOT, pfad), "utf8"));
      // Die acht Startteile zuerst, dann der an die Position gebundene Leser-Zeiger der Owner-Korrekturen.
      expect(got.brief.startsWith(`${texte.join("\n\n")}\n\nOWNER-KORREKTUREN:`)).toBe(true);
      expect(got.brief).toContain("vor deinem ersten Akt");
      expect(got.brief).toContain("/api/self/konzepte/k-owner-korrekturen/leseansicht");
      expect(got.brief).not.toContain("--- ROLLE ---");
      expect(got.succession).toContain("f1c70000000000000000cafe");
      expect(got.succession).toContain(got.brief);
      // Kein Rollen-Render: die Startzeile schließt den Projekt-Monolithen aus, lädt aber kein --add-dir.
      expect(got.orchCmd).not.toContain("--add-dir");
      expect(got.orchCmd).toContain("claudeMdExcludes");
      // DER GRÜNDUNGSPLAN ZEIGT DENSELBEN START: keine alte Rollenkarte, dieselben acht Dateien,
      // derselbe Fassungs-Hash wie die laufende Slot-Fassung.
      expect(got.plan.sessionAgents.text).toBe(texte.join("\n\n"));
      expect(got.plan.sessionAgents.parts.map((part) => part.path)).toEqual(pfade);
      expect(got.plan.fassungsHash).toBe(got.laufend.hash);
      expect(got.plan.sessionAgents.text).not.toContain("--- ROLLE ---");
      const liest = got.fassung.teile.find((teil) => teil.id === "liest")!.abschnitte;
      // GENAU DIESE SIEBEN TEILE, IN DIESER REIHENFOLGE, mit Quelle und Bytes: die Richtung steht
      // als eigener Abschnitt vor der Rolle, danach Systemkonzept und die fünf Packs unter „Wissen“.
      expect(liest[0]!.id).toBe("richtung");
      expect(liest[1]!.id).toBe("rolle");
      const startQuellen = liest.map((abschnitt) => abschnitt.quelle).filter((quelle): quelle is string => !!quelle && pfade.includes(quelle));
      expect(startQuellen).toEqual(pfade);
      for (const [index, pfad] of pfade.entries()) {
        const abschnitt = liest.find((entry) => entry.quelle === pfad)!;
        expect(abschnitt.bytes).toBe(Buffer.byteLength(texte[index]!));
      }
      // DER HASH IM START-BELEG IST DER HASH DER GEZEIGTEN FASSUNG — für Öffnen und Nachfolge.
      expect(got.receipts.map((receipt) => receipt.hash)).toEqual([got.laufend.hash, got.fassung.hash]);
      expect(got.receipts[0]!.hash).toBe(got.plan.fassungsHash);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 100_000);
});

// EINE FORM, EIN HASH (Fertig-kriterium 4b): der Gründungsplan zeigt für eine neue Session
// dieselbe Fünf-Teile-Fassung wie die Slot-Route direkt nach ihrem Start. Der Test ruft die
// Funktionen, die beide Routen tragen, in einem eigenen Prozess — mit einem echten kleinen
// Git-Repo, damit der Gründungsplan wirklich rechnet.
const runServer = async (script: string, env: Record<string, string>, dir: string): Promise<{ code: number; stdout: string; stderr: string }> => {
  const proc = Bun.spawn([process.execPath, "--no-env-file", "-e", script], { cwd: ROOT,
    stdout: "pipe", stderr: "pipe",
    env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: join(dir, "home"), SHELL: "/bin/sh",
      FLEET_HOST: "127.0.0.1", FLEET_PORT: "8792", FLEET_SOCK: `fassungtest${process.pid}`,
      FLEET_STATE_DIR: join(dir, "state"), FLEET_CMD: "claude", FLEET_CLAUDE_PROJECTS_DIR: join(dir, "home", ".claude", "projects"), ...env } });
  const code = await Promise.race([proc.exited, Bun.sleep(90_000).then(() => { proc.kill("SIGKILL"); return -1; })]);
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

describe("eine Form, ein Hash", () => {
  test("die Fassung von /api/founding-plan (anlass=neu) hat denselben Hash wie die laufende Slot-Fassung", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fassung-4b-"));
    const repo = join(dir, "repo");
    gitRepo(repo);
    const out = join(dir, "out.json");
    const script = `
      const S = await import(${JSON.stringify(join(ROOT, "server.ts"))});
      const plan = await S.foundingPlanAnswer({ repo: process.env.FIX_REPO, role: "orchestratorin", ort: null, mode: null,
        harness: "claude", model: null, effort: null, bausteine: null, packs: null, parts: null, anlass: "neu" });
      if (!plan.ok) throw new Error("plan refused: " + JSON.stringify(plan));
      const slot = { id: 1, cwd: process.env.FIX_REPO, openedAt: 1, label: "Orchestrator (Opus)", worktree: null,
        harness: "claude", model: null, effort: null, rechte: null, agentMd: null, history: [],
        sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", programId: null, taskId: null, lineageId: null,
        selfToken: "x", packMcp: [], context: null, permissions: null, sleeping: null, standingHandover: null,
        compaction: null, startCompact: null, spawn: null, laneStandNudged: null, plan: null, handover: null,
        container: null, containerContext: null, originId: null, releasedBy: null, laneSuccessions: 0, laneSeats: [],
        browser: false, remote: false, webSearch: false, openedBy: null, lauf: null, clients: [], awaiting: null,
        mission: null, successionRetirement: null, codexRecoveryState: null, codexPaneSpawnedAt: null,
        codexDisconnectSeenAt: null, codexFirstTurn: null, sessionIdLearned: null };
      const laufend = await S.fassungFuerSlot(slot, "laufend");
      await Bun.write(${JSON.stringify(out)}, JSON.stringify({ planHash: plan.body.fassungsHash,
        planFassung: plan.body.fassung, slotHash: laufend.hash, slotFassung: laufend }, null, 2));
    `;
    try {
      const r = await runServer(script, { FIX_REPO: repo }, dir);
      expect({ code: r.code, stderr: r.code === 0 ? "" : r.stderr.slice(-1500) }).toEqual({ code: 0, stderr: "" });
      const got = JSON.parse(readFileSync(out, "utf8"));
      expect(got.planHash).toMatch(/^[0-9a-f]{64}$/);
      expect(got.planHash).toBe(got.slotHash);
      expect(got.planFassung.teile.map((t: { id: string }) => t.id)).toEqual(["wer", "aufgabe", "liest", "darf", "arbeitet"]);
      expect(got.planFassung.anlass).toBe("neu");
      expect(got.slotFassung.anlass).toBe("laufend");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 100_000);
  test("derselbe Inhalt an einem anderen Ort ergibt denselben Hash — der Ort ist Anzeige", () => {
    const a = baueFassung(eingang());
    const b = baueFassung({ ...eingang(), liest: eingang().liest.map((x) => textAbschnitt(x.id,
      `/private/tmp/anderer-checkout/${x.id}.md`, x.text!,
      x.aenderbar, undefined, x.dateien?.map((datei) => ({ pfad: `/private/tmp/${datei.pfad}`, bytes: datei.bytes }))) ) });
    expect(b.hash).toBe(a.hash);
  });

  test("ein Symlink im Pfad ändert weder die Fassung noch den Hash (eine Pfadform)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fassung-symlink-"));
    const repo = join(dir, "repo");
    gitRepo(repo);
    const link = join(dir, "link");
    symlinkSync(repo, link, "dir");
    const out = join(dir, "out.json");
    const script = `
      const S = await import(${JSON.stringify(join(ROOT, "server.ts"))});
      const slot = { id: 1, cwd: process.env.FIX_LINK, openedAt: 1, label: "Orchestrator (Opus)", worktree: null,
        harness: "claude", model: null, effort: null, rechte: null, agentMd: null, history: [],
        sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", programId: null, taskId: null, lineageId: null,
        selfToken: "x", packMcp: [], context: null, permissions: null, sleeping: null, standingHandover: null,
        compaction: null, startCompact: null, spawn: null, laneStandNudged: null, plan: null, handover: null,
        container: null, containerContext: null, originId: null, releasedBy: null, laneSuccessions: 0, laneSeats: [],
        browser: false, remote: false, webSearch: false, openedBy: null, lauf: null, clients: [], awaiting: null,
        mission: null, successionRetirement: null, codexRecoveryState: null, codexPaneSpawnedAt: null,
        codexDisconnectSeenAt: null, codexFirstTurn: null, sessionIdLearned: null };
      const plan = async (repo) => {
        const p = await S.foundingPlanAnswer({ repo, role: "orchestratorin", ort: null, mode: null,
          harness: "claude", model: null, effort: null, bausteine: null, packs: null, parts: null, anlass: "neu" });
        if (!p.ok) throw new Error("plan refused: " + JSON.stringify(p));
        return p.body.fassungsHash;
      };
      const quelle = (f) => f.teile.find((t) => t.id === "liest").abschnitte
        .find((a) => a.id === "projektregeln").quelle;
      const laufend = await S.fassungFuerSlot(slot, "laufend");
      await Bun.write(${JSON.stringify(out)}, JSON.stringify({ planLink: await plan(process.env.FIX_LINK),
        planReal: await plan(process.env.FIX_REAL), slotLink: laufend.hash, slotQuelle: quelle(laufend) }));
    `;
    try {
      const r = await runServer(script, { FIX_LINK: link, FIX_REAL: repo }, dir);
      expect({ code: r.code, stderr: r.code === 0 ? "" : r.stderr.slice(-1500) }).toEqual({ code: 0, stderr: "" });
      const got = JSON.parse(readFileSync(out, "utf8")) as { planLink: string; planReal: string; slotLink: string; slotQuelle: string };
      expect(got.planLink).toBe(got.slotLink);
      expect(got.planReal).toBe(got.slotLink);
      expect(got.slotQuelle).toContain(realpathSync(repo));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 100_000);
});

// WAS DIE ROUTE ALS GELADEN ZEIGT, MUSS DER TRANSCRIPT-KOPF AUCH ZEIGEN (docs/agent-objekt.md,
// Schnitt 1 „Fertig, wenn“). Drei Fixture-Slots: Orchestratorin mit rollen-rendendem rulebook/,
// eine Lane (Lane-Render im Worktree, kein Auto-Memory) und eine freie Session. Die Erwartung ist
// aus den Spawn-Regeln gebaut (claudeMdExcludes, --add-dir, autoMemoryEnabled), nicht aus der Fassung.
describe("Liest stimmt mit dem Transkript überein", () => {
  test("Orchestratorin (rulebook/), Lane und freie Session: Pfade und Bytes wie anatomieAusTranskript().dateien", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fassung-transcript-"));
    const home = join(dir, "home");
    const projects = join(home, ".claude", "projects");
    mkdirSync(projects, { recursive: true });
    writeFileSync(join(home, ".claude", "CLAUDE.md"), "GLOBALE REGEL\n");
    const slug = (p: string) => p.replace(/[^a-zA-Z0-9]/g, "-");
    const memory = (repo: string, text: string): string => {
      const d = join(projects, slug(repo), "memory");
      mkdirSync(d, { recursive: true });
      writeFileSync(join(d, "MEMORY.md"), text);
      return join(d, "MEMORY.md");
    };
    const freeRepo = join(dir, "free");
    gitRepo(freeRepo);
    const laneDir = join(dir, "lane", ".worktrees", "b1");
    mkdirSync(laneDir, { recursive: true });
    writeFileSync(join(laneDir, "CLAUDE.md"), "LANE RENDER\n");
    // der Ort des Auto-Memorys so, wie server.ts#autoMemoryBytes ihn liest: ein Worktree unter dem Haupt-Repo,
    // und der Pfad aufgelöst (macOS: /var ist ein Link auf /private/var)
    const namespace = (repo: string): string => {
      const common = Bun.spawnSync(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repo }).stdout.toString().trim();
      return common.endsWith("/.git") ? dirname(common) : repo;
    };
    const memRoot = memory(namespace(ROOT), "MEM ROOT\n");
    const memFree = memory(namespace(freeRepo), "MEM FREE\n");
    // das rulebook/ ist ein Fixture IM Server-Checkout, weil der Spawn genau dort den Rollen-Render
    // nimmt (rulebookRoleForSpawn: resolve(cwd) === import.meta.dir). Vorher sichern, danach zurück.
    const rulebookDir = join(ROOT, "rulebook");
    const claudeMd = join(ROOT, "CLAUDE.md");
    const hadRulebook = existsSync(rulebookDir), hadClaude = existsSync(claudeMd);
    const backup = join(dir, "backup");
    if (hadRulebook) cpSync(rulebookDir, join(backup, "rulebook"), { recursive: true });
    if (hadClaude) { mkdirSync(backup, { recursive: true }); cpSync(claudeMd, join(backup, "CLAUDE.md")); }
    const frags = new Map(RULEBOOK_FRAGMENTS.map((f) => [f, `## ${f}\n\n- ${f} Regel.\n`]));
    const voll = renderRulebook("voll", frags);
    const sourceHash = createHash("sha256").update(voll).digest("hex").slice(0, 16);
    const orchRender = renderRoleRulebook("orchestrator", frags,
      { repoRoot: ROOT, anchorDir: `${rulebookDir}/render/${sourceHash}/abschnitte`, sourceHash }).text;
    try {
      mkdirSync(rulebookDir, { recursive: true });
      for (const f of RULEBOOK_FRAGMENTS) writeFileSync(join(rulebookDir, fragmentFileName(f)), frags.get(f)!);
      writeFileSync(claudeMd, voll);
      const renderPfad = join(rulebookDir, "render", sourceHash, "orchestrator", "CLAUDE.md");
      const out = join(dir, "out.json");
      const script = `
        const S = await import(${JSON.stringify(join(ROOT, "server.ts"))});
        const { resolve: pResolve } = await import("node:path");
        const base = { openedAt: 1, worktree: null, model: null, effort: null, rechte: null, agentMd: null, history: [],
          sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", programId: null, taskId: null, lineageId: null,
          selfToken: "x", packMcp: [], context: null, permissions: null, sleeping: null, standingHandover: null,
          compaction: null, startCompact: null, spawn: null, laneStandNudged: null, plan: null, handover: null,
          container: null, containerContext: null, originId: null, releasedBy: null, laneSuccessions: 0, laneSeats: [],
          browser: false, remote: false, webSearch: false, openedBy: null, lauf: null, clients: [], awaiting: null,
          mission: null, successionRetirement: null, codexRecoveryState: null, codexPaneSpawnedAt: null,
          codexDisconnectSeenAt: null, codexFirstTurn: null, sessionIdLearned: null };
        const slots = {
          orch: { ...base, id: 1, cwd: ${JSON.stringify(realpathSync(ROOT))}, label: "Orchestrator (Opus)", harness: "claude" },
          lane: { ...base, id: 2, cwd: ${JSON.stringify(realpathSync(laneDir))}, label: "Lane", harness: "claude",
            worktree: { repo: ${JSON.stringify(join(dir, "lane"))}, branch: "b1", base: "main" } },
          free: { ...base, id: 3, cwd: ${JSON.stringify(realpathSync(freeRepo))}, label: "frei", harness: "claude" },
        };
        // DIE ERWARTUNG AUS DERSELBEN VORFAHRENREGEL: nativeLoaderBytes ist der Loader, den der
        // Spawn und die Fassung teilen. Der Test darf nicht davon abhängen, ob der Checkout unter
        // einem Home mit eigenem ~/.claude/CLAUDE.md liegt (auf macOS sichtbar, auf Linux nicht).
        const ohne = (cwd) => new Set([\`\${cwd}/CLAUDE.md\`, \`\${cwd}/.claude/CLAUDE.md\`,
          \`\${process.env.HOME}/AGENTS.md\`, \`\${cwd}/AGENTS.md\`].map((p) => pResolve(p)));
        const loader = (cwd) => {
          const n = S.nativeLoaderBytes(cwd, "claude");
          if ("grund" in n) throw new Error(n.grund);
          return n.dateien;
        };
        const orchAll = loader(${JSON.stringify(realpathSync(ROOT))});
        const geladen = {
          orch: orchAll.filter((d) => !ohne(${JSON.stringify(realpathSync(ROOT))}).has(pResolve(d.pfad))),
          lane: loader(${JSON.stringify(realpathSync(laneDir))}),
          free: loader(${JSON.stringify(realpathSync(freeRepo))}),
        };
        const dateien = (f) => f.teile.find((t) => t.id === "liest").abschnitte.flatMap((a) => a.dateien ?? []);
        const out = {};
        for (const [name, slot] of Object.entries(slots)) {
          const f = await S.fassungFuerSlot(slot, "laufend");
          out[name] = { hash: f.hash, dateien: dateien(f) };
        }
        await Bun.write(${JSON.stringify(out)}, JSON.stringify({ slots: out, geladen }, null, 2));
      `;
      const r = await runServer(script, {}, dir);
      expect({ code: r.code, stderr: r.code === 0 ? "" : r.stderr.slice(-2000) }).toEqual({ code: 0, stderr: "" });
      const roh = JSON.parse(readFileSync(out, "utf8")) as { slots: Record<string, { hash: string; dateien: { pfad: string; bytes: number }[] }>;
        geladen: Record<"orch" | "lane" | "free", { pfad: string; bytes: number }[]> };
      const got = roh.slots;
      const geladen = roh.geladen;
      const transkript = (files: { path: string; content: string }[]) => {
        const a = anatomieAusTranskript([
          JSON.stringify({ type: "user", message: { content: "ok" } }),
          JSON.stringify({ type: "attachment", attachment: { type: "instructions", files } }),
          JSON.stringify({ type: "attachment", attachment: { type: "prompt_snapshot", systemPrompt: ["x"] } }),
          JSON.stringify({ type: "assistant", message: { usage: { input_tokens: 1 } } }),
        ].join("\n"));
        if (typeof a === "string") throw new Error(a);
        return [...a.dateien];
      };
      const datei = (path: string) => ({ path, content: readFileSync(path, "utf8") });
      const mitInhalt = (list: { pfad: string }[]) => list.map((eintrag) => datei(eintrag.pfad));
      // DIE ORCHESTRATORIN LÄDT IHREN NEUEN START: Richtung, Rolle, Systemkonzept und fünf Packs,
      // dazu die globalen Regeln und ihr Gedächtnis. Kein Rollen-Render und kein Projekt-Monolith.
      const startRolle = ["docs/start/direction.md", "docs/start/orchestrator.md"].map((pfad) => ({ pfad: join(ROOT, pfad) }));
      const startWissen = ["docs/start/system-concept.md", "docs/packs/setting-up-agents.md",
        "docs/packs/working-with-the-owner.md", "docs/packs/how-fleet-remembers.md",
        "docs/packs/working-toward-a-goal.md", "docs/packs/who-it-is-for.md"].map((pfad) => ({ pfad: join(ROOT, pfad) }));
      expect(got.orch!.dateien).toEqual(transkript([...mitInhalt(startRolle), ...mitInhalt(geladen.orch),
        ...mitInhalt(startWissen), datei(memRoot)]));
      expect(got.lane!.dateien).toEqual(transkript(mitInhalt(geladen.lane)));
      expect(got.free!.dateien).toEqual(transkript([...mitInhalt(geladen.free), datei(memFree)]));
      // Auto-Memory ist bei der Lane kein Abschnitt mit Datei: sie startet ohne (autoMemoryEnabled:false)
      const laneF = roh.slots;
      expect(laneF.lane.hash).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      rmSync(rulebookDir, { recursive: true, force: true });
      if (hadRulebook) cpSync(join(backup, "rulebook"), rulebookDir, { recursive: true });
      if (hadClaude) cpSync(join(backup, "CLAUDE.md"), claudeMd);
      else rmSync(claudeMd, { force: true });
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
