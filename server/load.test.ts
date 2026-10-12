// Neuaufbau K4b: server.ts lässt sich laden, ohne dass ein Server startet. Start (Boot, Zeitschleifen,
// Bun.serve) läuft nur, wenn die Datei Einstieg ist (`bun server.ts`); ein Import bekommt die Logik.
// Damit lässt sich Server-Logik in Sekunden prüfen statt nach einem Vollboot.
import { describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

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

// eigener Port, eigener tmux-Socket, nur Loopback: ginge doch ein Start los, träfe er nie die Live-Fleet
const isolation = { FLEET_HOST: "127.0.0.1", FLEET_PORT: String(freePort()), FLEET_SOCK: `fleetload${process.pid}` };
let loadProvenSafe = false;

describe("server.ts laden", () => {
  test("ein Import endet von selbst, ohne Server, Zeitschleife, tmux-Server oder Boot-Spuren", async () => {
    const absentBefore = BOOT_TRACES.filter((name) => !existsSync(join(ROOT, name)));
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env))
      if (value !== undefined && !key.startsWith("FLEET_")) env[key] = value;
    const started = Date.now();
    const proc = Bun.spawn([process.execPath, "-e", `await import(${JSON.stringify(SERVER)}); console.log("geladen");`],
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
    loadProvenSafe = true;
  }, LOAD_DEADLINE_MS + 5_000);
});

// erst nachdem der Subprozess gezeigt hat, dass Laden nichts startet: sonst bootete hier ein Server
// im Testprozess
async function load() {
  if (!loadProvenSafe) throw new Error("Laden ist nicht als startfrei bewiesen — Import im Testprozess unterbleibt");
  Object.assign(process.env, isolation);
  const signals = ["SIGTERM", "SIGINT", "SIGHUP"] as const;
  const before = signals.map((sig) => process.listenerCount(sig));
  const server = await import("../server");
  expect(signals.map((sig) => process.listenerCount(sig))).toEqual(before);
  return server;
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
  // tokenGate schreibt jeden Fehlversuch als owner_auth_fail ins audit.jsonl neben server.ts
  // (server/audit-log.ts): nur in einem Baum ohne eigenes Audit-Log und danach wieder weg — im
  // Verzeichnis eines laufenden Servers fälschte der Test dessen Ledger
  async function withScratchAuditLog(run: () => Promise<void>): Promise<void> {
    const file = join(ROOT, "audit.jsonl");
    if (existsSync(file)) throw new Error(`${file} gibt es schon — der Test schriebe in ein echtes Audit-Log; im frischen Baum fahren`);
    try {
      await run();
    } finally {
      for (let i = 0; i < 100 && !existsSync(file); i++) await Bun.sleep(10); // audit() schreibt ohne await
      rmSync(file, { force: true });
    }
  }
  test("ohne Token keine Sitzungsliste", () => withScratchAuditLog(async () => {
    expect(await request("/api/sessions", { host: allowedHost })).toEqual({ status: 401, body: { error: "unauthorized" } });
  }));
  test("ein falscher Token öffnet nichts", () => withScratchAuditLog(async () => {
    expect(await request("/api/sessions", { host: allowedHost, authorization: "Bearer falsch" }))
      .toEqual({ status: 401, body: { error: "unauthorized" } });
  }));
});
