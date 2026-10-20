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
  test("Liest steht in Ladereihenfolge; Übergabe nur bei nachfolge", () => {
    expect(baueFassung(eingang()).teile.find((t) => t.id === "liest")!.abschnitte.map((a) => a.id))
      .toEqual(LIEST_REIHENFOLGE.filter((id) => id !== "uebergabe"));
    expect(baueFassung(eingang({ anlass: "nachfolge" })).teile.find((t) => t.id === "liest")!.abschnitte.map((a) => a.id))
      .toEqual([...LIEST_REIHENFOLGE]);
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
describe("der Spawn bleibt unverändert", () => {
  test("Startbrief und slotCmd für Orchestratorin-Nachfolge, Lane und freie Session sind byte-gleich", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fassung-spawn-"));
    const out = join(dir, "after.json");
    const script = `
      const out = process.env.FASSUNG_OUT;
      const S = await import(${JSON.stringify(join(ROOT, "server.ts"))});
      const rechte = { stufe: "standard", an: ["lesen", "bearbeiten"], aus: ["loeschen"] };
      const agentMd = { profil: "p1", titel: "agent.md", text: "Eigene Regel A\\nEigene Regel B", sha256: "0".repeat(64) };
      const lineage = { obligations: [{ kind: "watch", id: "w1", target: { kind: "audit", repo: "/fixture/repo", mainAfter: "a".repeat(40) } }],
        intent: "Naechster Schritt: Karte schaerfen", pointer: null, carry: true, now: 1_760_000_000_000, laneNow: () => null };
      const orchestratorBrief = S.buildOrchestratorSuccessionBrief("claude",
        ["1. Führe ./state.sh --brief aus.", "2. Lies README.md, falls vorhanden."],
        "Das Erste, was ich täte: den nächsten Akt wählen.", "f1c70000000000000000cafe", lineage, "\\n\\nANKER (fixture)\\n");
      const orchestratorCmd = S.slotCmd("11111111-1111-4111-8111-111111111111", false, "claude-opus-5[1m]", "high",
        true, "orchestrator", [], "orchestrator", true, null, rechte, agentMd);
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
      const roleCards = { main: S.MAIN_ROLE_CARD, lane: S.LANE_ROLE_CARD, orchestrator: S.ORCHESTRATOR_ROLE_CARD,
        orchestratorRoleCardClaude: S.orchestratorRoleCard("claude"), orchestratorRoleCardCodex: S.orchestratorRoleCard("codex") };
      const spawnBrief = S.buildOrchestratorSpawnBrief("claude", "\\n\\nANKER (fixture)\\n");
      await Bun.write(out, JSON.stringify({ orchestratorBrief, orchestratorCmd, laneBrief, laneCmd, freeBrief, freeCmd, roleCards, spawnBrief }, null, 2) + "\\n");
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
      const before = JSON.parse(readFileSync(join(import.meta.dir, "fassung-spawn-bytes.json"), "utf8"));
      const after = JSON.parse(readFileSync(out, "utf8"));
      expect(after).toEqual(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 75_000);
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
      expect(got.orch!.dateien).toEqual(transkript([...mitInhalt(geladen.orch),
        { path: renderPfad, content: orchRender }, datei(memRoot)]));
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
