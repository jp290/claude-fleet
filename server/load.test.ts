// Neuaufbau K4b: server.ts lässt sich laden, ohne dass ein Server startet. Start (Boot, Zeitschleifen,
// Bun.serve) läuft nur, wenn die Datei Einstieg ist (`bun server.ts`); ein Import bekommt die Logik.
// Damit lässt sich Server-Logik in Sekunden prüfen statt nach einem Vollboot.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TEntry } from "./conversation-read";
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
// (FLEET_STATE_DIR): ginge doch ein Start los, träfe er nie die Live-Fleet.
// FLEET_PI_ZAI_DENY_ROOTS ist ein SYNTHETISCHER Zaun-Wurzelpfad (die echten sind privat und stehen nur
// in der .env des Wirts): ohne ihn baut kein Pi-Sitz hinter dem Zaun eine Startzeile, und der
// pi-deepseek-Test unten könnte den Zaun nicht prüfen.
const STATE_DIR = mkdtempSync(join(tmpdir(), "fleet-load-state-"));
const isolation = { FLEET_HOST: "127.0.0.1", FLEET_PORT: String(freePort()), FLEET_SOCK: `fleetload${process.pid}`,
  FLEET_STATE_DIR: STATE_DIR, FLEET_PI_ZAI_DENY_ROOTS: `${STATE_DIR}/deny-test` };
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

// Owner 2026-10-26: die offene GLM-Sitz ist pi-zai ohne Lesezaun, aber mit derselben
// Schlüssel- und Katalogvorbereitung. Der Test hält die zwei Zusagen der Startzeile fest:
// der Schlüssel kommt über die Umgebung (nie über argv), und kein sandbox-exec/bwrap steht davor.
describe("pi-zai-unfenced: die Startzeile", () => {
  const base = {
    sessionId: "sess-1", resume: false, model: null, effort: null, container: "", containerContext: "",
    cwd: "/tmp/fleet-pi-zai-unfenced", browserMcp: false, context: null, permissions: null,
    fleetCheckout: false, remoteName: null,
  };

  test("provider zai, das Standardmodell, der Schlüssel aus der Datei in die Umgebung, kein Zaun", async () => {
    const { PI_ZAI_UNFENCED_HARNESS } = await load();
    const line = PI_ZAI_UNFENCED_HARNESS.spawnCmd(base);
    expect(line).toContain("pi --provider zai --model 'glm-5.3' --no-approve");
    expect(line).toMatch(/ZAI_API_KEY="\$\(cat '[^']+'\)"/);
    expect(line).toContain("zai-coding-plan.key");
    expect(line).not.toContain("--api-key");
    expect(line).not.toMatch(/ZAI_API_KEY="(?!\$\(cat ')/);
    expect(line).toContain("PI_CODING_AGENT_DIR=");
    expect(line).toContain("models.json");
    expect(line).toContain('"glm-5.3-flash"');
    expect(line).not.toContain("sandbox-exec");
    expect(line).not.toContain("bwrap");
    expect(line).not.toContain("FLEET_PZ_SB");
  });

  test("ein gewähltes Modell, die Session und der Effort landen auf der Zeile", async () => {
    const { PI_ZAI_UNFENCED_HARNESS } = await load();
    const line = PI_ZAI_UNFENCED_HARNESS.spawnCmd({ ...base, sessionId: "sess-2", model: "glm-5.3-flash", effort: "high" });
    expect(line).toContain("--model 'glm-5.3-flash'");
    expect(line).toContain("--session-id sess-2");
    expect(line).toContain("--thinking high");
    expect(line).not.toContain("sandbox-exec");
    expect(line).not.toContain("bwrap");
  });
});

// Owner 2026-10-26, Stufe 2: der DeepSeek-Sitz faehrt Pi auf einem anderen Anbieter, aber hinter
// DEMSELBEN bwrap-Zaun wie pi-zai. Der Test haelt die vier Zusagen der Startzeile fest: Anbieter und
// Modell sind gesetzt, der Schluessel kommt ueber die Umgebung (nie ueber argv), der Zaun ist da, und
// die Schluesseldatei selbst wird NICHT in den Zaun gebunden.
describe("pi-deepseek: die Startzeile", () => {
  // Der bwrap-Pfad wird GENANNT, nicht vom Host gelesen (server.ts#Harness.spawnCmd#fenceBwrap):
  // derselbe Test muss auf dem Linux-Workhorse UND auf dem Mac dieselbe Zeile pruefen. Der Name ist
  // nur ein Wort in der Zeile — gebaut, nicht ausgefuehrt.
  const BWRAP = "/usr/bin/bwrap";
  const base = {
    sessionId: "sess-d1", resume: false, model: null, effort: null, container: "", containerContext: "",
    cwd: "/tmp/fleet-pi-deepseek", browserMcp: false, context: null, permissions: null,
    fleetCheckout: false, remoteName: null, fenceBwrap: BWRAP as string | null,
  };
  // ein eigener cwd je Lauf, damit der Zaun fuer DIESEN Pfad gebaut wird; danach wieder weg
  const cwd = mkdtempSync(join(tmpdir(), "fleet-pi-deepseek-"));
  afterAll(() => rmSync(cwd, { recursive: true, force: true }));
  // der Erwartungswert ist der dokumentierte Standardpfad am Workhorse, abgeleitet aus HOME wie server.ts
  const keyFile = `${process.env.HOME}/.config/fleet-deepseek/key`;
  const agentDir = `${process.env.HOME}/.config/claude-fleet/pi-deepseek-agent`;

  test("provider deepseek, deepseek-flash als Standard, der Schluessel aus der Datei in die Umgebung", async () => {
    const { PI_DEEPSEEK_HARNESS } = await load();
    const line = PI_DEEPSEEK_HARNESS.spawnCmd({ ...base, cwd });
    expect(line).toContain("pi --provider deepseek --model 'deepseek-flash' --no-approve");
    expect(line).toContain(`DEEPSEEK_API_KEY="$(cat '${keyFile}')"`);
    // nie auf argv, nie ausgedruckt: der Schluessel ist nur diese eine Kommando-Substitution
    expect(line).not.toContain("--api-key");
    expect(line.match(/DEEPSEEK_API_KEY=/g)?.length).toBe(1);
    expect(line).not.toMatch(/DEEPSEEK_API_KEY="(?!\$\(cat ')/);
    // kein models.json: pi bringt den deepseek-Anbieter und beide Modelle selbst mit
    expect(line).not.toContain("models.json");
  });

  test("der Zaun ist da (bwrap) und die Schluesseldatei ist NICHT hineingebunden", async () => {
    const { PI_DEEPSEEK_HARNESS } = await load();
    const line = PI_DEEPSEEK_HARNESS.spawnCmd({ ...base, cwd });
    const fn = /fleet_pz\(\) \{ ([\s\S]*?) "\$@"; \};/.exec(line)?.[1] ?? "";
    // der Zaun selbst: eigener Namespace, Netz geteilt, stirbt mit der Sitzung
    expect(fn).toContain("--unshare-all");
    expect(fn).toContain("--die-with-parent");
    // ...fuer DIESEN Sitz gebaut: sein eigenes Agent-Verzeichnis ist drin, seine Schluesseldatei nicht
    expect(fn).toContain(agentDir);
    expect(fn).not.toContain(keyFile);
    // ...und der Pfad steht nur in der AUSSEREN Shell: Existenzpruefung, deren Fehlersatz und das `cat`
    // (ein Literal des Schluessels selbst kommt nirgends vor, weil ihn nur die Substitution liefert)
    expect(line.split(keyFile).length - 1).toBe(3);
  });

  test("ein gewaehltes Modell, die Session und der Effort landen auf der Zeile", async () => {
    const { PI_DEEPSEEK_HARNESS } = await load();
    const line = PI_DEEPSEEK_HARNESS.spawnCmd({ ...base, cwd,
      sessionId: "sess-d2", model: "deepseek-v4-pro", effort: "high" });
    expect(line).toContain("--model 'deepseek-v4-pro'");
    expect(line).toContain("--session-id sess-d2");
    expect(line).toContain("--thinking high");
  });

  test("es ist DERSELBE Zaun wie pi-zai: die Argumente unterscheiden sich nur im Sitz", async () => {
    const { PI_DEEPSEEK_HARNESS, PI_ZAI_HARNESS } = await load();
    const zaiAgentDir = `${process.env.HOME}/.config/claude-fleet/pi-zai-agent`;
    const fn = (line: string): string => /fleet_pz\(\) \{ ([\s\S]*?) "\$@"; \};/.exec(line)?.[1] ?? "";
    const zai = fn(PI_ZAI_HARNESS.spawnCmd({ ...base, cwd }));
    const deepseek = fn(PI_DEEPSEEK_HARNESS.spawnCmd({ ...base, cwd }));
    // Sitz-eigen ist nur das Agent-Verzeichnis (und damit auth.json + die eigene Session-Bindung)
    expect(deepseek.split(agentDir).join("<seat>")).toBe(zai.split(zaiAgentDir).join("<seat>"));
    // ...und pi-zai selbst bleibt unveraendert: eigener Key, eigenes Verzeichnis
    expect(zai).toContain("--unshare-all");
    expect(PI_ZAI_HARNESS.spawnCmd({ ...base, cwd })).toContain(`ZAI_API_KEY="$(cat `);
    expect(PI_ZAI_HARNESS.spawnCmd({ ...base, cwd })).toContain(zaiAgentDir);
  });

  test("er ist ein Bauer wie pi-zai: automatisierbar, Lanes und Branch-Sitzungen, kein Singleton", async () => {
    const { PI_DEEPSEEK_HARNESS } = await load();
    expect(PI_DEEPSEEK_HARNESS.automatable).toBe(true);
    expect(PI_DEEPSEEK_HARNESS.allowsLanes).toBe(true);
    expect(PI_DEEPSEEK_HARNESS.singleton).toBe(false);
    expect(PI_DEEPSEEK_HARNESS.models).toEqual(["deepseek-flash", "deepseek-v4-pro"]);
    expect(PI_DEEPSEEK_HARNESS.note).toContain("fence");
  });

  // Die andere Seite derselben Entscheidung, ebenfalls GENANNT statt gelesen: ohne Zaun startet die
  // Zeile KEIN pi, sondern sagt es und laesst eine gewoehnliche Shell stehen. So muss es auf jedem
  // Rechner ohne bwrap (dem Mac) aussehen, und so ist es hier auf jedem Host pruefbar.
  test("ohne bwrap sagt die Zeile, dass kein pi startet, und startet keins", async () => {
    const { PI_DEEPSEEK_HARNESS } = await load();
    const line = PI_DEEPSEEK_HARNESS.spawnCmd({ ...base, cwd, fenceBwrap: null });
    expect(line).toContain("pi-deepseek: pi was NOT started");
    expect(line).toContain("fence (bwrap) is missing");
    // kein pi auf der Zeile, kein Zaun, kein Schluessel: nur die Meldung und danach die Shell
    expect(line).not.toContain("pi --provider deepseek");
    expect(line).not.toContain("--unshare-all");
    expect(line).not.toContain("fleet_pz");
    expect(line).not.toContain("DEEPSEEK_API_KEY");
    expect(line.endsWith(`exec ${process.env.SHELL ?? "/bin/sh"}`)).toBe(true);
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

  // Owner 2026-10-26, Stufe 2: der Katalog ist die eine Quelle, aus der das Brett die Harness waehlt.
  // pi-deepseek muss dort mit seinen ZWEI Modellen, seiner Notiz und als hier verfuegbar stehen.
  test("GET /api/harnesses nennt pi-deepseek mit beiden Modellen, Notiz und hier=true", async () => {
    const { serveOptions, adoptTokens } = await load();
    const owner = `test-harnesses-${process.pid}-${Date.now()}`;
    process.env.FLEET_TOKEN = owner;
    adoptTokens();
    const fetch = serveOptions.fetch;
    if (!fetch) throw new Error("serveOptions hat keinen fetch-Handler");
    const server = { requestIP: () => null } as unknown as Parameters<typeof fetch>[1];
    const res = await fetch.call(server, new Request(`http://127.0.0.1:${isolation.FLEET_PORT}/api/harnesses`,
      { headers: { host: `127.0.0.1:${isolation.FLEET_PORT}`, authorization: `Bearer ${owner}` } }), server);
    if (!res) throw new Error("/api/harnesses: der Handler gab keine Antwort");
    expect(res.status).toBe(200);
    const body = await res.json() as { harnesses?: Record<string, unknown>[] };
    const ds = body.harnesses?.find((h) => h.id === "pi-deepseek");
    expect(ds).toBeDefined();
    expect(ds?.models).toEqual(["deepseek-flash", "deepseek-v4-pro"]);
    expect(String(ds?.note)).toContain("~/.config/fleet-deepseek/key");
    expect(ds?.hier).toBe(process.platform === "linux");
    expect(ds?.automatable).toBe(true);
    expect(ds?.allowsLanes).toBe(true);
    expect(ds?.singleton).toBe(false);
  });
});

// K15 (Owner 16.10. 09:1x: „[Zitat entfernt]“): eigene Profile, Fassungen und Packs des
// Fensters „Neue Session“ über die echte Route (server/k15-speicher.ts hinter dem Owner-Tor), die Datei im Zustandsverzeichnis
describe("K15-Speicher über die Route", () => {
  const owner = `k15-${process.pid}-${Date.now()}`;
  const datei = join(STATE_DIR, "k15-eigenes.json");
  const gut = { fassungen: [{ abschnitt: "lane|regeln", text: "Meine Regeln", version: 2 }],
    packs: [{ id: "pk1", name: "Wissen", text: "Was die Lane wissen soll", orte: { lane: "text" } }],
    profile: [{ id: "p1", rolle: "lane", schiene: "lane", name: "Mein Agent", datei: { titel: "agent.md", abschnitte: [] } }] };
  async function call(method: string, o: { body?: string; token?: string | null; type?: string } = {}): Promise<{ status: number; body: unknown }> {
    const { serveOptions, adoptTokens } = await load();
    process.env.FLEET_TOKEN = owner;
    adoptTokens();
    const fetch = serveOptions.fetch;
    if (!fetch) throw new Error("serveOptions hat keinen fetch-Handler");
    const server = { requestIP: () => null } as unknown as Parameters<typeof fetch>[1];
    const token = o.token === undefined ? owner : o.token;
    const headers: Record<string, string> = { host: `127.0.0.1:${isolation.FLEET_PORT}`, "content-type": o.type ?? "application/json",
      ...(token === null ? {} : { authorization: `Bearer ${token}` }) };
    const res = await fetch.call(server, new Request(`http://127.0.0.1:${isolation.FLEET_PORT}/api/k15/eigenes`, { method, headers, body: o.body }), server);
    if (!res) throw new Error("/api/k15/eigenes: der Handler gab keine Antwort");
    return { status: res.status, body: await res.json() };
  }

  test("speichern, neu laden, gleiche Daten; die Datei liegt im Zustandsverzeichnis, nur für den Owner lesbar, und wird ganz ersetzt", async () => {
    rmSync(datei, { force: true });
    expect(await call("GET")).toEqual({ status: 200, body: { eigenes: null } });
    // eine offene umask: 0600 muss beim Anlegen gesetzt sein, nicht von der umask dieses Rechners kommen
    const umask = process.umask(0o022);
    try {
      expect(await call("PUT", { body: JSON.stringify(gut) })).toEqual({ status: 200, body: { ok: true } });
    } finally { process.umask(umask); }
    expect(statSync(datei).mode & 0o777).toBe(0o600);
    expect(await call("GET")).toEqual({ status: 200, body: { eigenes: gut } });
    // ersetzt, nicht überschrieben: eine neue Datei an derselben Stelle (rename), sonst läse ein Absturz mitten im Schreiben eine halbe
    const ino = statSync(datei).ino;
    const zweit = { ...gut, packs: [] };
    expect(await call("PUT", { body: JSON.stringify(zweit) })).toEqual({ status: 200, body: { ok: true } });
    expect(statSync(datei).ino).not.toBe(ino);
    expect(await call("GET")).toEqual({ status: 200, body: { eigenes: zweit } });
    expect(JSON.parse(readFileSync(datei, "utf8"))).toEqual(zweit);
    expect(readdirSync(STATE_DIR).filter((f) => f.startsWith("k15-eigenes"))).toEqual(["k15-eigenes.json"]);
    expect(existsSync(join(ROOT, "k15-eigenes.json"))).toBe(false);
  });
  test("ein schiefer Body wird mit seinem Grund abgelehnt, und die Datei bleibt, wie sie war", async () => {
    await call("PUT", { body: JSON.stringify(gut) });
    const vorher = readFileSync(datei, "utf8");
    const schief: [string, number, string][] = [
      ["{ kaputt", 400, "kein gültiges JSON"],
      [JSON.stringify([gut]), 400, "expected an object with fassungen, packs and profile"],
      [JSON.stringify({ ...gut, token: "x" }), 400, "unknown field “token”"],
      [JSON.stringify({ ...gut, packs: "pk1" }), 400, "“packs” is missing or not a list"],
      [JSON.stringify({ ...gut, profile: [{ id: 1, rolle: "lane", schiene: "lane" }] }), 400, "entry 1 in “profile” needs id, rolle, schiene as text"],
      [JSON.stringify({ ...gut, fassungen: [{ abschnitt: "lane|x", text: "x".repeat(10_000_001) }] }), 413, "größer als 10 MB"],
    ];
    for (const [body, status, error] of schief) {
      expect(await call("PUT", { body })).toEqual({ status, body: { error } });
      expect(readFileSync(datei, "utf8")).toBe(vorher);
    }
    expect(await call("PUT", { body: JSON.stringify(gut), type: "text/plain" })).toEqual({ status: 415, body: { error: "erwartet ist JSON" } });
    expect(await call("DELETE")).toEqual({ status: 405, body: { error: "nur GET und PUT" } });
    expect(readFileSync(datei, "utf8")).toBe(vorher);
    expect(readdirSync(STATE_DIR).filter((f) => f.startsWith("k15-eigenes"))).toEqual(["k15-eigenes.json"]);
  });
  test("Konstellationen bleiben, wenn ein Fenster von vorher nur drei Listen schickt; eine leere Liste leert sie", async () => {
    const konst = { id: "n1", name: "Orchestratorin → freie Session", fleet: "konstellation", positionen: [{ id: "o", profil: "orchestratorin@2" }] };
    // jede gespeicherte Konstellation bekommt eine feste Fassung (server/konst-fassungen.ts), die Antwort nennt sie
    const erst = await call("PUT", { body: JSON.stringify({ ...gut, konstellationen: [konst] }) });
    expect(erst.status).toBe(200);
    expect(erst.body).toMatchObject({ ok: true, fassungen: { n1: { neu: true } } });
    expect(await call("PUT", { body: JSON.stringify({ ...gut, packs: [] }) })).toEqual({ status: 200, body: { ok: true } });
    expect(await call("GET")).toEqual({ status: 200, body: { eigenes: { ...gut, packs: [], konstellationen: [konst] } } });
    expect(await call("PUT", { body: JSON.stringify({ ...gut, konstellationen: [] }) })).toEqual({ status: 200, body: { ok: true, fassungen: {} } });
    expect(await call("GET")).toEqual({ status: 200, body: { eigenes: { ...gut, konstellationen: [] } } });
  });
  test("ohne Credential oder mit falschem gibt es 401, und nichts wird gelesen oder geschrieben", async () => {
    await call("PUT", { body: JSON.stringify(gut) });
    const vorher = readFileSync(datei, "utf8");
    const fremd = JSON.stringify({ fassungen: [], packs: [], profile: [] });
    expect(await call("GET", { token: null })).toEqual({ status: 401, body: { error: "unauthorized" } });
    expect(await call("PUT", { body: fremd, token: null })).toEqual({ status: 401, body: { error: "unauthorized" } });
    expect(await call("PUT", { body: fremd, token: "falsch" })).toEqual({ status: 401, body: { error: "unauthorized" } });
    expect(readFileSync(datei, "utf8")).toBe(vorher);
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

// Mangel 53 S-c (befunde/12 §7): Claude Code schreibt einen ausgeführten Befehl in zwei Formen, und der Chat bekommt
// beide als denselben user-Text-Eintrag (src/slashcommand.ts macht daraus eine Zeile). Die Zeilen sind die der
// Owner-Pane: Form (b) aus fa9e6a3c (14.10., Zeilen 51–53), Form (a) wie im Beweis „[Zitat entfernt]“ vom 13.10.
describe("viewEntry: ein Befehl aus Claude Code kommt in beiden Formen als derselbe Chat-Eintrag", () => {
  const ts = "2026-10-14T05:07:07.916Z";
  const record = "<command-name>/model</command-name>\n            <command-message>model</command-message>\n            <command-args>claude-fable-5-1[1m]</command-args>";
  const output = "<local-command-stdout>Set model to `Fable 5.1` and saved as your default for new sessions</local-command-stdout>";
  const entry = (n: number, text: string): TEntry => ({ n, role: "user", ts, blocks: [{ t: "text", text }] });

  test("Form (a), system/local_command: Befehl und Ausgabe werden user-Text-Einträge", async () => {
    const { viewEntry } = await load();
    expect(viewEntry({ type: "system", subtype: "local_command", content: record, level: "info", isMeta: false, timestamp: ts }, 52))
      .toEqual(entry(52, record));
    expect(viewEntry({ type: "system", subtype: "local_command", content: output, level: "info", isMeta: false, timestamp: ts,
      commandRun: { command: "model", args: "claude-fable-5-1[1m]" } }, 53)).toEqual(entry(53, output));
  });
  test("Form (b), user-Zeilen: dieselben Einträge, der Caveat bleibt draußen", async () => {
    const { viewEntry } = await load();
    const user = (content: string, isMeta?: boolean) => ({ type: "user", isMeta, timestamp: ts, message: { role: "user", content } });
    expect(viewEntry(user("<local-command-caveat>The command below was run directly in Claude Code …</local-command-caveat>", true), 51)).toBeNull();
    expect(viewEntry(user(record), 52)).toEqual(entry(52, record));
    expect(viewEntry(user(output), 53)).toEqual(entry(53, output));
  });
  test("jede andere system-Zeile bleibt draußen, auch ein local_command ohne Text oder aus einem Subagenten", async () => {
    const { viewEntry } = await load();
    for (const line of [{ type: "system", subtype: "turn_duration", isMeta: false, timestamp: ts },
      { type: "system", subtype: "stop_hook_summary", timestamp: ts },
      { type: "system", subtype: "compact_boundary", content: "Conversation compacted", timestamp: ts },
      { type: "system", subtype: "local_command", content: "", timestamp: ts },
      { type: "system", subtype: "local_command", content: record, isSidechain: true, timestamp: ts }])
      expect(viewEntry(line, 9)).toBeNull();
  });
});

// Mangel 78 (Owner 15.10.: „[Zitat entfernt]“
// ): Eine Nachricht einer anderen Claude-Session erreicht eine ruhende Session als meta-Zeile (gemessen 15.10.: 348
// von 540). viewEntry lässt sie draußen, denn tickHarvest liest jeden user-Eintrag von dort als getippten Prompt; die
// Gesprächsleser bekommen sie über crossSessionEntry als meta.
describe("crossSessionEntry: die Nachricht einer anderen Session in Ruhe", () => {
  const ts = "2026-10-15T09:42:30.648Z";
  const said = "Another Claude session sent a message:\n<cross-session-message from=\"uds:/tmp/cc-socks/1.sock\" from-name=\"bau-neuaufbau-77\" from-mode=\"bypass\">\nBauleitung an K10: nächste Phase.\n</cross-session-message>";
  const line = (content: unknown, extra: Record<string, unknown> = {}) => ({ type: "user", isMeta: true, timestamp: ts, message: { role: "user", content }, ...extra });

  test("kommt als meta-Eintrag mit ihrem Text, und viewEntry lässt sie weiter draußen", async () => {
    const { viewEntry, crossSessionEntry } = await load();
    expect(crossSessionEntry(line(said), 7, false)).toEqual({ n: 7, role: "user", ts, blocks: [{ t: "text", text: said }], meta: true });
    expect(viewEntry(line(said), 7)).toBeNull();
  });
  test("jede andere meta-Zeile, eine Subagenten-Zeile und eine nicht-meta Zeile bleiben draußen", async () => {
    const { crossSessionEntry } = await load();
    expect(crossSessionEntry(line("<local-command-caveat>The command below was run directly in Claude Code …</local-command-caveat>"), 7, false)).toBeNull();
    expect(crossSessionEntry(line("You are a prompt compiler."), 7, false)).toBeNull();
    expect(crossSessionEntry(line(said, { isSidechain: true }), 7, false)).toBeNull();
    expect(crossSessionEntry(line(said, { isMeta: false }), 7, false)).toBeNull();
    expect(crossSessionEntry(line([{ type: "text", text: said }]), 7, false)).toBeNull();
    expect(crossSessionEntry({ type: "assistant", isMeta: true, message: { content: said } }, 7, false)).toBeNull();
  });
});

// K16 E6: Nach dem Deploy startet jede Claude-Session im Auto-Mode, eine Session von vorher läuft bypass weiter, bis sie neu
// startet. Welcher Modus gilt, sagt die Startzeile nicht; Claude Code schreibt ihn je Zug als eigene Zeile ins Transkript
// ({"type":"permission-mode","permissionMode":…}). readClaudeTail liest die jüngste.
describe("readClaudeTail: der Permission-Mode, in dem die Session läuft", () => {
  const dir = mkdtempSync(join(tmpdir(), "fleet-permission-mode-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const ts = "2026-10-16T01:00:00.000Z";
  const mode = (m: string) => JSON.stringify({ type: "permission-mode", permissionMode: m, sessionId: "s" });
  const said = (text: string) => JSON.stringify({ type: "user", timestamp: ts, message: { role: "user", content: text } });
  const reply = (tokens: number, text = "ok") => JSON.stringify({ type: "assistant", timestamp: ts,
    message: { model: "claude-opus-5-5", content: [{ type: "text", text }], usage: { input_tokens: tokens, cache_read_input_tokens: 0, cache_creation_input_tokens: 0,
      cache_creation: { ephemeral_5m_input_tokens: 1 } } } });
  const tailOf = async (name: string, lines: string[]) => {
    const { CLAUDE_HARNESS } = await load();
    const file = join(dir, `${name}.jsonl`);
    writeFileSync(file, `${lines.join("\n")}\n`);
    return CLAUDE_HARNESS.context!.tail!(file, statSync(file).size);
  };

  test("die jüngste Zeile gilt: erst bypass, nach shift+tab auto", async () => {
    const tail = await tailOf("wechsel", [mode("bypassPermissions"), said("los"), reply(1000), mode("auto"), said("weiter"), reply(2000)]);
    expect(tail.permissionMode).toBe("auto");
    expect(tail.read).toBe(2000);
    // zweimal umgeschaltet, ohne Zug dazwischen: die Lesung geht an beiden Zeilen vorbei, bevor sie die usage findet
    expect((await tailOf("zweimal", [reply(500), mode("bypassPermissions"), mode("auto")])).permissionMode).toBe("auto");
  });
  test("ohne permission-mode-Zeile im Ende: null, und der Kontext wird trotzdem gelesen", async () => {
    const tail = await tailOf("ohne", [said("los"), reply(1500)]);
    expect(tail.permissionMode).toBeNull();
    expect(tail.read).toBe(1500);
  });
  test("ein Text, der von permission-mode spricht, ist keine Modus-Zeile, und seine usage zählt", async () => {
    const tail = await tailOf("text", [mode("bypassPermissions"), said('{"type":"permission-mode","permissionMode":"auto"}'),
      reply(3000, 'schreibt {"type":"permission-mode","permissionMode":"plan"}')]);
    expect(tail.permissionMode).toBe("bypassPermissions");
    expect(tail.read).toBe(3000);
  });
  test("ein Wert, der kein Modusname ist, wird nicht ausgegeben, und eine ältere Zeile springt nicht ein", async () => {
    const tail = await tailOf("schief", [mode("bypassPermissions"), reply(10), mode("auto; rm -rf ~"), reply(20)]);
    expect(tail.permissionMode).toBeNull();
  });
});

// K16 Teil 2 (Schnitt 2 der Bauleitung): ob Claude Code selbst kompaktiert, steht in keinem Transkript; der Start setzt es
// (server/session-start.ts#startAspects: autoCompactEnabled:false, wo Fleet übergibt). Der Server hält fest, was die
// Startzeile der Besetzung sagte, und die Übergabe-Fakten (/api/slots/:id/brief → succession.autoCompact) geben es aus —
// nur für die Besetzung, die so gestartet wurde.
describe("succession.autoCompact: was die Startzeile der Besetzung Claude Codes Kompaktierung sagte", () => {
  const at = 1_791_000_000_000;
  const owner = `kompakt-${process.pid}-${Date.now()}`;
  async function brief(slot: number): Promise<{ status: number; autoCompact: unknown }> {
    const { serveOptions } = await load();
    const fetch = serveOptions.fetch;
    if (!fetch) throw new Error("serveOptions hat keinen fetch-Handler");
    const server = { requestIP: () => null } as unknown as Parameters<typeof fetch>[1];
    const res = await fetch.call(server, new Request(`http://127.0.0.1:${isolation.FLEET_PORT}/api/slots/${slot}/brief`,
      { headers: { host: `127.0.0.1:${isolation.FLEET_PORT}`, authorization: `Bearer ${owner}` } }), server);
    if (!res) throw new Error(`brief ${slot}: keine Antwort`);
    const body = (await res.json()) as { succession?: { autoCompact?: unknown } | null };
    return { status: res.status, autoCompact: body.succession === undefined || body.succession === null ? "keine Fakten" : body.succession.autoCompact };
  }

  test("aus mit Übergabe, an ohne; eine fremde Besetzung, ein schiefer Wert und ein Slot ohne Eintrag sagen null", async () => {
    const { loadPersistedState, adoptTokens } = await load();
    const dir = mkdtempSync(join(tmpdir(), "fleet-kompakt-"));
    try {
      const slot = (openedAt: number, startCompact?: unknown) => ({ cwd: dir, label: "Kompakt", openedAt, ...(startCompact === undefined ? {} : { startCompact }) });
      await Bun.write(join(dir, "fleet.json"), JSON.stringify({ token: owner, slots: {
        "4": slot(at + 4, { openedAt: at + 4, autoCompact: false }),
        "5": slot(at + 5, { openedAt: at + 5, autoCompact: true }),
        // die Vorgängerin auf demselben Slot wurde so gestartet, nicht diese Besetzung
        "6": slot(at + 6, { openedAt: at, autoCompact: false }),
        "7": slot(at + 7, { openedAt: at + 7, autoCompact: "false" }),
        "8": slot(at + 8),
      } }));
      delete process.env.FLEET_TOKEN;
      await loadPersistedState(join(dir, "fleet.json"));
      adoptTokens();
      const got: Record<number, unknown> = {};
      for (const id of [4, 5, 6, 7, 8]) got[id] = (await brief(id)).autoCompact;
      expect(got).toEqual({ 4: false, 5: true, 6: null, 7: null, 8: null });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
