// Neuaufbau K4b: server.ts lässt sich laden, ohne dass ein Server startet. Start (Boot, Zeitschleifen,
// Bun.serve) läuft nur, wenn die Datei Einstieg ist (`bun server.ts`); ein Import bekommt die Logik.
// Damit lässt sich Server-Logik in Sekunden prüfen statt nach einem Vollboot.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendEvent } from "./persist";

const ROOT = join(import.meta.dir, "..");
const SERVER = join(ROOT, "server.ts");
// Spuren, die der Boot im Verzeichnis von server.ts hinterlässt (server.ts: STATE_FILE, PID_FILE, STREAM_DIR)
const BOOT_TRACES = ["fleet.json", "fleet.pid", "streams"];
const LOAD_DEADLINE_MS = 30_000;

function freePort(): number {
  const probe = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
  const port = probe.port;
  probe.stop(true);
  if (port === undefined) throw new Error("kein freier Port");
  return port;
}

// eigener Port, eigener tmux-Socket, nur Loopback, Zustand und Ledger in einem eigenen Verzeichnis
// (FLEET_STATE_DIR): ginge doch ein Start los, träfe er nie die Live-Fleet
const STATE_DIR = mkdtempSync(join(tmpdir(), "fleet-load-state-"));
const isolation = { FLEET_HOST: "127.0.0.1", FLEET_PORT: String(freePort()), FLEET_SOCK: `fleetload${process.pid}`,
  FLEET_STATE_DIR: STATE_DIR };
afterAll(() => rmSync(STATE_DIR, { recursive: true, force: true }));
let loadProvenSafe = false;

describe("server.ts laden", () => {
  test("ein Import endet von selbst, ohne Server, Zeitschleife, tmux-Server, Boot-Spuren oder Deploy-Abrechnung", async () => {
    const absentBefore = BOOT_TRACES.filter((name) => !existsSync(join(ROOT, name)));
    // ein offener Deploy-Marker: nur der Start (resolveDeployMarker) räumt ihn ab und schreibt deploys.jsonl
    const marker = join(STATE_DIR, "deploy-inflight.json");
    const markerBody = JSON.stringify({ id: "ladetest", target: "0".repeat(40), at: 1_790_000_000_000 });
    writeFileSync(marker, markerBody, { mode: 0o600 });
    // keine FLEET_-Variable von außen, auch nicht aus einer .env im Checkout (bun lädt sie sonst im Kind neu)
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env))
      if (value !== undefined && !key.startsWith("FLEET_")) env[key] = value;
    const started = Date.now();
    const proc = Bun.spawn([process.execPath, "--no-env-file", "-e", `await import(${JSON.stringify(SERVER)}); console.log("geladen");`],
      { cwd: ROOT, env: { ...env, ...isolation }, stdout: "pipe", stderr: "pipe" });
    const deadline = setTimeout(() => proc.kill("SIGKILL"), LOAD_DEADLINE_MS);
    const exitCode = await proc.exited;
    clearTimeout(deadline);
    const ms = Date.now() - started;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const tmuxServer = Bun.spawnSync(["tmux", "-L", isolation.FLEET_SOCK, "list-sessions"]);
    if (tmuxServer.exitCode === 0) Bun.spawnSync(["tmux", "-L", isolation.FLEET_SOCK, "kill-server"]);

    expect({ exitCode, stderr: exitCode === 0 ? "" : stderr.slice(-2000) }).toEqual({ exitCode: 0, stderr: "" });
    expect(stdout).toContain("geladen");
    expect(stdout).not.toContain("claude-fleet: http://");
    expect(ms).toBeLessThan(LOAD_DEADLINE_MS);
    expect(tmuxServer.exitCode).not.toBe(0);
    expect(absentBefore.filter((name) => existsSync(join(ROOT, name)))).toEqual([]);
    expect(readdirSync(STATE_DIR)).toEqual(["deploy-inflight.json"]);
    expect(readFileSync(marker, "utf8")).toBe(markerBody);
    rmSync(marker);
    loadProvenSafe = true;
  }, LOAD_DEADLINE_MS + 5_000);
});

// erst nachdem der Subprozess gezeigt hat, dass Laden nichts startet: sonst bootete hier ein Server
// im Testprozess
async function load() {
  if (!loadProvenSafe) throw new Error("Laden ist nicht als startfrei bewiesen — Import im Testprozess unterbleibt");
  // wie im Subprozess: nur die Isolation. bun test hat die .env des Checkouts schon geladen, und
  // server/types.ts liest beim Laden z. B. FLEET_SEPARATE_LANE_SLOTS und FLEET_MAX_SESSIONS (MAX_SLOTS)
  for (const key of Object.keys(process.env)) if (key.startsWith("FLEET_")) delete process.env[key];
  Object.assign(process.env, isolation);
  const signals = ["SIGTERM", "SIGINT", "SIGHUP"] as const;
  const before = signals.map((sig) => process.listenerCount(sig));
  const server = await import("../server");
  expect(signals.map((sig) => process.listenerCount(sig))).toEqual(before);
  return server;
}

// audit() schreibt ohne await; alle Ledger-Zeilen teilen eine Schreibkette (persist.ts), also ist eine
// Audit-Zeile samt chmod fertig, sobald eine danach eingereihte Zeile geschrieben ist
async function auditSettled(): Promise<void> {
  await appendEvent(join(STATE_DIR, "barrier.jsonl"), {});
}

describe("paneApiError, im Prozess importiert", () => {
  const at = 1_760_000_000_000;

  test("Codex: der Kapazitätsfehler direkt über dem Composer ist ein Stillstand", async () => {
    const { paneApiError, CODEX_HARNESS } = await load();
    const screen = "› mach weiter\n\n■ Selected model is at capacity. Please try a different model.\n\n› ";
    expect(paneApiError(CODEX_HARNESS, screen, at)).toEqual({
      at, text: "■ Selected model is at capacity. Please try a different model.", kind: "capacity", resetAt: null });
  });
  test("Codex: ein älterer Fehler mit einer Antwort danach ist keiner", async () => {
    const { paneApiError, CODEX_HARNESS } = await load();
    const screen = "Selected model is at capacity.\n• weiter gearbeitet\n› ";
    expect(paneApiError(CODEX_HARNESS, screen, at)).toBeNull();
  });
  test("Codex: ein zitierter Fehler im Codeblock ist keiner", async () => {
    const { paneApiError, CODEX_HARNESS } = await load();
    const screen = "```\nSelected model is at capacity.\n```\n› ";
    expect(paneApiError(CODEX_HARNESS, screen, at)).toBeNull();
  });
  test("Z.AI: das Limit setzt bei der Uhrzeit des Z.AI-Servers zurück, also UTC+8; der jüngste Fehler zählt", async () => {
    const { paneApiError, PI_ZAI_HARNESS } = await load();
    const line = (time: string) =>
      `429 {"code":"1308","message":"Usage limit reached for 5 hour. Your limit will reset at 2026-09-22 ${time}"}`;
    const hit = paneApiError(PI_ZAI_HARNESS, `${line("16:00:00")}\n${line("18:19:39")}\n`, at);
    expect(hit?.kind).toBe("rate_limit");
    expect(hit?.resetAt).toBe(Date.parse("2026-09-22T10:19:39Z"));
  });
  test("Claude: der Bildschirm ist kein Sensor, auch nicht mit Fehlertext", async () => {
    const { paneApiError, CLAUDE_HARNESS } = await load();
    expect(paneApiError(CLAUDE_HARNESS, "Selected model is at capacity.\n› ", at)).toBeNull();
  });
});

describe("Route-Handler ohne Port: wer nicht hereindarf, kommt nicht herein", () => {
  async function request(path: string, headers: Record<string, string>): Promise<{ status: number; body: unknown }> {
    const { serveOptions } = await load();
    const fetch = serveOptions.fetch;
    if (!fetch) throw new Error("serveOptions hat keinen fetch-Handler");
    // der Handler liest vom Server nur die Peer-Adresse (finishHttp)
    const server = { requestIP: () => null } as unknown as Parameters<typeof fetch>[1];
    const res = await fetch.call(server, new Request(`http://127.0.0.1:${isolation.FLEET_PORT}${path}`, { headers }), server);
    if (!res) throw new Error(`${path}: der Handler gab keine Antwort`);
    return { status: res.status, body: await res.json() };
  }
  const allowedHost = `127.0.0.1:${isolation.FLEET_PORT}`;

  test("ein fremder Host-Header wird abgewiesen (DNS-Rebinding)", async () => {
    const res = await request("/api/sessions", { host: "evil.example" });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "host 'evil.example' not allowed — set FLEET_ALLOWED_HOSTS" });
  });
  test("eine fremde Origin wird abgewiesen, auch mit erlaubtem Host", async () => {
    const res = await request("/api/sessions", { host: allowedHost, origin: "http://evil.example" });
    expect(res).toEqual({ status: 403, body: { error: "cross-origin request blocked" } });
  });
  test("ohne Token keine Sitzungsliste", async () => {
    expect(await request("/api/sessions", { host: allowedHost })).toEqual({ status: 401, body: { error: "unauthorized" } });
  });
  test("ein falscher Token öffnet nichts", async () => {
    expect(await request("/api/sessions", { host: allowedHost, authorization: "Bearer falsch" }))
      .toEqual({ status: 401, body: { error: "unauthorized" } });
  });
  test("der Fehlversuch steht im audit.jsonl unter FLEET_STATE_DIR, nicht neben server.ts", async () => {
    const besideServer = join(ROOT, "audit.jsonl");
    const sizeBeside = () => existsSync(besideServer) ? statSync(besideServer).size : -1;
    const before = sizeBeside();
    await request("/api/sessions", { host: allowedHost, authorization: "Bearer falsch-fuer-das-ledger" });
    await auditSettled();
    const rows = readFileSync(join(STATE_DIR, "audit.jsonl"), "utf8").trim().split("\n")
      .map((line) => JSON.parse(line) as { event?: string });
    expect(rows.at(-1)?.event).toBe("owner_auth_fail");
    expect(sizeBeside()).toBe(before);
  });
});

describe("Route-Handler ohne Port, mit Owner-Token", () => {
  test("der Token aus FLEET_TOKEN öffnet die Sitzungsliste mit allen Slots", async () => {
    const { serveOptions, adoptTokens } = await load();
    const owner = `test-${process.pid}-${Date.now()}`;
    process.env.FLEET_TOKEN = owner;
    adoptTokens();
    const fetch = serveOptions.fetch;
    if (!fetch) throw new Error("serveOptions hat keinen fetch-Handler");
    const server = { requestIP: () => null } as unknown as Parameters<typeof fetch>[1];
    const req = new Request(`http://127.0.0.1:${isolation.FLEET_PORT}/api/sessions`,
      { headers: { host: `127.0.0.1:${isolation.FLEET_PORT}`, authorization: `Bearer ${owner}` } });
    const res = await fetch.call(server, req, server);
    if (!res) throw new Error("/api/sessions: der Handler gab keine Antwort");
    expect(res.status).toBe(200);
    const body = await res.json() as { slots?: { id: number }[] };
    expect(body.slots?.map((s) => s.id)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });
});

describe("loadPersistedState: eine gepflanzte fleet.json kommt nach dem Laden über die Routen zurück", () => {
  const plantedAt = 1_790_000_000_000;
  const programId = "4b5c".padEnd(24, "0");
  const taskId = `gepflanzt-${process.pid}`;
  const ownerToken = `planted-${process.pid}-${Date.now()}`;
  const gitStatus = () => Bun.spawnSync(["git", "status", "--porcelain", "--ignored", "--untracked-files=all"], { cwd: ROOT }).stdout.toString();

  async function get(path: string, token: string): Promise<{ status: number; body: unknown }> {
    const { serveOptions } = await load();
    const fetch = serveOptions.fetch;
    if (!fetch) throw new Error("serveOptions hat keinen fetch-Handler");
    const server = { requestIP: () => null } as unknown as Parameters<typeof fetch>[1];
    const req = new Request(`http://127.0.0.1:${isolation.FLEET_PORT}${path}`,
      { headers: { host: `127.0.0.1:${isolation.FLEET_PORT}`, authorization: `Bearer ${token}` } });
    const res = await fetch.call(server, req, server);
    if (!res) throw new Error(`${path}: der Handler gab keine Antwort`);
    return { status: res.status, body: await res.json() };
  }

  test("Token, Slot, Program und Auftrag aus der Datei stehen in /api/sessions, /api/programs und /api/tasks", async () => {
    const { loadPersistedState, adoptTokens } = await load();
    const dir = mkdtempSync(join(tmpdir(), "fleet-state-"));
    const before = gitStatus();
    try {
      const file = join(dir, "fleet.json");
      await Bun.write(file, JSON.stringify({
        token: ownerToken,
        slots: { "3": { cwd: dir, label: "Gepflanzter Slot", openedAt: plantedAt } },
        programs: [{ id: programId, title: "Gepflanztes Program", intent: "Zeigen, dass der Zustand zurückkommt",
          successCriterion: "Die Routen zeigen das Program", nonGoals: [], decisions: [], evidence: [], openQuestions: [],
          status: "active", createdAt: plantedAt - 1000, proposedBy: { kind: "owner" },
          confirmedAt: plantedAt - 900, activatedAt: plantedAt - 800 }],
        tasks: [{ id: taskId, text: "Gepflanzter Auftrag", source: "owner", kind: "auftrag", status: "pending",
          programId, created: plantedAt - 500, slot: null, note: null }],
      }));
      delete process.env.FLEET_TOKEN;
      await loadPersistedState(file);
      adoptTokens();

      const sessions = await get("/api/sessions", ownerToken);
      expect(sessions.status).toBe(200);
      const slot = (sessions.body as { slots: { id: number; cwd: string | null; label: string | null }[] }).slots
        .find((s) => s.id === 3);
      expect({ cwd: slot?.cwd, label: slot?.label }).toEqual({ cwd: dir, label: "Gepflanzter Slot" });

      const programs = await get("/api/programs", ownerToken);
      expect(programs.status).toBe(200);
      expect((programs.body as { programs: { id: string; title: string; status: string }[] }).programs
        .map((p) => ({ id: p.id, title: p.title, status: p.status })))
        .toEqual([{ id: programId, title: "Gepflanztes Program", status: "active" }]);

      const tasks = await get("/api/tasks", ownerToken);
      expect(tasks.status).toBe(200);
      expect((tasks.body as { tasks: { id: string; text: string; status: string; programId?: string }[] }).tasks
        .map((t) => ({ id: t.id, text: t.text, status: t.status, programId: t.programId })))
        .toEqual([{ id: taskId, text: "Gepflanzter Auftrag", status: "pending", programId }]);

      expect(readdirSync(dir)).toEqual(["fleet.json"]);
      expect(gitStatus()).toBe(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("eine kaputte Datei wird neben sich selbst zu .corrupt, neben server.ts entsteht nichts", async () => {
    const { loadPersistedState } = await load();
    const dir = mkdtempSync(join(tmpdir(), "fleet-state-"));
    const before = gitStatus();
    try {
      await Bun.write(join(dir, "fleet.json"), "{ kaputt");
      await loadPersistedState(join(dir, "fleet.json"));
      expect(readdirSync(dir)).toEqual(["fleet.json.corrupt"]);
      expect(gitStatus()).toBe(before);
      // der Token aus der vorigen Ladung bleibt: eine kaputte Datei setzt nichts zurück
      expect((await get("/api/sessions", ownerToken)).status).toBe(200);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
