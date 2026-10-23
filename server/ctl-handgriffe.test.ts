// ctl.sh reply und ctl.sh status: die Antwort im Postfach in EINEM Aufruf, und wo alles steht in EINEM Aufruf
// (~/local-notes/ctl-handgriffe/start.md). ctl.sh läuft als echter Prozess gegen einen nachgebauten Server: der hält
// nur die Türen, die die zwei Verben lesen und schreiben, und schreibt jede Anfrage mit, damit der Test prüft, was
// wirklich gesendet wurde — Adresse, Antwortkante, Reihenfolge, und dass bei einer Ablehnung nichts hinausging.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CTL = join(import.meta.dir, "..", "ctl.sh");
const SELF = "selftoken-probe-0123456789abcdef", OWNER = "ownertoken-probe-fedcba9876543210";
const SESSION = { kind: "session", slot: 2, openedAt: 1792000000111 };
const ORCH = { kind: "role", role: "orchestrator" };
const IN_ID = "aaaa1111bbbb2222cccc3333", OUT_ID = "aaaa1111ffff0000ffff0000", NEW_ID = "dddd4444eeee5555ffff6666";

type Seen = { method: string; path: string; body: unknown };
let seen: Seen[] = [];
let refuseSend = false, replay = false, oddMerges = false;
// eine wartende Prüfung und was sie hält: null = keine wartet; der Wert ist das `pending` von GET /api/post-land-audits
let waitingHold: Record<string, unknown>[] | null = null;
const now = Date.now();
const RELEASE = now + 3 * 3600_000;
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname + url.search;
    const body = req.method === "POST" ? await req.json().catch(() => null) : null;
    seen.push({ method: req.method, path, body });
    if (url.pathname.startsWith("/api/self")) {
      if (req.headers.get("x-fleet-self-token") !== SELF) return json({ error: "unauthorized" }, 401);
      if (path === "/api/self/messages" && req.method === "GET") return json({ addresses: [ORCH], unread: 1, entries: [
        { id: IN_ID, from: SESSION, to: ORCH, at: now - 60_000, payload: { kind: "text", text: "Frage von Slot 2" }, replyTo: null, readBy: null },
        { id: OUT_ID, from: ORCH, to: SESSION, at: now - 120_000, payload: { kind: "text", text: "eigene Zeile" }, replyTo: null, readBy: null },
      ] });
      if (path === "/api/self/messages?unread=1") return json({ addresses: [ORCH], unread: 1, entries: [
        { id: IN_ID, from: SESSION, to: ORCH, at: now - 60_000, payload: { kind: "text", text: "Frage von Slot 2\nzweite Zeile" } },
      ] });
      if (path === "/api/self/messages" && req.method === "POST")
        return refuseSend ? json({ error: "replyTo names no message addressed to this sender" }, 409)
          : json({ ok: true, existing: replay, message: { id: NEW_ID }, holder: { slot: 2, openedAt: SESSION.openedAt } });
      if (/^\/api\/self\/messages\/[0-9a-f]{24}\/read$/.test(path)) return json({ ok: true });
      if (path === "/api/self/merges" && oddMerges) return json({});
      if (path === "/api/self/merges") return json({ scope: "fleet", busy: [7], rows: [
        { slot: 7, running: true, last: null, lane: { branch: "fleet/probe-lane" } }] });
      return json({ error: "not in this fake" }, 404);
    }
    if (req.headers.get("authorization") !== `Bearer ${OWNER}`) return json({ error: "unauthorized" }, 401);
    if (path === "/api/sessions") return json({
      slots: [
        { id: 2, cwd: "/w/a", name: null, label: "Bau Probe", openedAt: SESSION.openedAt, ctx: { pct: 41.6 }, lastOutput: now - 5 * 60_000,
          git: { branch: "branch/probe" }, worktree: null, agent: "alive" },
        { id: 3, cwd: null, label: null },
        { id: 6, cwd: "/w/main", name: null, label: "Orchestratorin", openedAt: 5, ctx: null, lastOutput: now - 1000,
          git: { branch: "main" }, worktree: null, agent: "dead" },
      ],
      programs: [],
      postLandAuditLive: waitingHold ? { running: null, stats: null, waiting: [
        { repo: "claude-fleet", main: "main", branch: "branch/wartet", mainAfter: "9999999988888888", at: now - 45 * 60_000 }] }
      : { running: { phase: "running", main: "main", mainSha: "abcdef1234567890", startedAt: now - 3 * 60_000,
        covers: ["branch/eins"] }, waiting: [], stats: null },
      postLandAudit: { at: now - 2 * 3600_000, result: "red", mainSha: "1234567890abcdef", covers: ["branch/null"],
        adjudication: { verdict: "flake" } },
      helperOnlineMs: 90_000,
      helperDevices: [{ name: "workhorse", lastSeen: now - 1000, mode: "active", running: 2, maxParallelSuites: 5,
        claims: [{ kind: "audit", repo: "claude-fleet", ref: "main", claimedAt: now - 4 * 60_000, expiresAt: now + 3600_000 }] }],
    });
    if (path === "/api/helper/jobs") return json({ jobs: [
      { id: "j1", kind: "audit", repo: "claude-fleet", branches: ["main"], claim: { name: "workhorse", claimedAt: now - 4 * 60_000 }, oldestAt: now - 5 * 60_000 },
      { id: "j2", kind: "lane-suite", repo: "claude-fleet", branches: ["fleet/vorschau"], claim: null, oldestAt: now - 2 * 60_000 }] });
    if (path === "/api/post-land-audits?limit=1") return waitingHold?.length === 0 ? json({ error: "kaputt" }, 500)
      : json({ audits: [], pending: waitingHold ?? [] });
    if (path === "/api/branches") return json({ repos: [{ branches: [{ branch: "branch/server-lauf", check: { state: "running" } }] }] });
    return json({ error: "not in this fake" }, 404);
  },
});

let dir = "", home = "", log = "";
let probe: Bun.Subprocess | null = null;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "ctl-handgriffe-"));
  home = join(dir, "home");
  mkdirSync(home);
  Bun.spawnSync(["git", "init", "-q", home]);
  writeFileSync(join(home, ".git", "merge-checks.jsonl"), [
    { at: now - 3 * 3600_000, branch: "branch/alt", tip: "0000000011111111", verdict: "green", mergeable: true },
    { at: now - 2 * 3600_000, branch: "branch/rot", tip: "2222222233333333", verdict: "red", mergeable: false },
    { at: now - 600_000, branch: "branch/gruen", tip: "4444444455555555", verdict: "green", mergeable: true },
    { at: now - 300_000, branch: "branch/neu", tip: "6666666677777777", verdict: "conflict", mergeable: false },
  ].map((r) => JSON.stringify(r)).join("\n") + "\n");
  log = join(dir, "plan.md");
});
afterAll(() => {
  probe?.kill();
  server.stop(true);
  rmSync(dir, { recursive: true, force: true });
});

// eine leere Umgebung: die Pane, in der dieser Test läuft, trägt ihren eigenen Self-Token, und der darf nicht mitreisen
async function ctl(args: string[], opts: { owner?: boolean; self?: boolean; stdin?: string; url?: string } = {}) {
  const env: Record<string, string> = { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", TMPDIR: dir,
    TZ: "UTC", // bun test rechnet in UTC; das Kind sonst in der Ortszeit des Rechners
    FLEET_CTL_URL: opts.url ?? server.url.origin, FLEET_CTL_HOME: home, FLEET_SELF_SLOT: "6" };
  if (opts.self !== false) env.FLEET_SELF_TOKEN = SELF;
  if (opts.owner) env.FLEET_CTL_TOKEN = OWNER;
  const p = Bun.spawn(["sh", CTL, ...args], { env, stdin: opts.stdin === undefined ? "ignore" : new Blob([opts.stdin]),
    stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  return { out, err, code };
}
const posts = () => seen.filter((s) => s.method === "POST");

describe("ctl.sh reply", () => {
  test("antwortet dem Absender mit seinem Pin und der Antwortkante, quittiert danach und schreibt eine Zeile ins Protokoll", async () => {
    seen = [];
    writeFileSync(log, "# Plan\n- 10:00 vorher");
    const r = await ctl(["reply", "aaaa1111bb", "-", "--log", log], { stdin: "Ja, mach weiter.\nZweite Zeile.\n" });
    expect(r.code).toBe(0);
    expect(posts().map((s) => s.path)).toEqual(["/api/self/messages", `/api/self/messages/${IN_ID}/read`]);
    const sent = posts()[0]!.body as { to: unknown; replyTo: string; payload: { text: string }; idempotencyKey: string };
    expect([sent.to, sent.replyTo, sent.payload]).toEqual([SESSION, IN_ID, { kind: "text", text: "Ja, mach weiter.\nZweite Zeile." }]);
    const lines = readFileSync(log, "utf8").split("\n");
    expect(lines.slice(0, 2)).toEqual(["# Plan", "- 10:00 vorher"]);
    expect(lines[2]).toMatch(/^- \d\d:\d\d → slot 2 \(zu aaaa1111\): Ja, mach weiter\.$/);
    expect(lines.length).toBe(4);
    expect(r.out.trim()).toBe(`reply to slot 2 (re aaaa1111): sent dddd4444 · marked read · logged to ${log}`);
  });

  test("dieselbe Antwort trägt denselben Schlüssel, ein anderer Text einen anderen; --line ersetzt die Protokollzeile", async () => {
    seen = [];
    writeFileSync(log, "");
    const text = join(dir, "antwort.txt");
    writeFileSync(text, "Gleich.");
    await ctl(["reply", IN_ID, text]);
    await ctl(["reply", IN_ID, text, "--log", log, "--line", "- eigene Zeile"]);
    writeFileSync(text, "Anders.");
    await ctl(["reply", IN_ID, text]);
    const keys = posts().filter((s) => s.path === "/api/self/messages").map((s) => (s.body as { idempotencyKey: string }).idempotencyKey);
    expect(keys.length).toBe(3);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
    expect(readFileSync(log, "utf8")).toBe("- eigene Zeile\n");
  });

  test("über 2000 Zeichen, ein fremdes oder eigenes Id, ein fehlendes Protokoll: nichts geht hinaus", async () => {
    seen = [];
    writeFileSync(log, "unverändert\n");
    const long = await ctl(["reply", IN_ID, "-", "--log", log], { stdin: "x".repeat(2001) });
    expect([long.code, long.err]).toEqual([2, "reply: the text is 2001 characters, the mailbox takes at most 2000 — nothing sent\n"]);
    const foreign = await ctl(["reply", "999999", "-", "--log", log], { stdin: "Hallo" });
    expect(foreign.code).toBe(1);
    expect(foreign.err).toContain("no message 999999 addressed to you");
    // OUT_ID ist die eigene Ausgangszeile: ihr Absender ist die Orchestratorin selbst
    const own = await ctl(["reply", "aaaa1111ffff", "-", "--log", log], { stdin: "Hallo" });
    expect([own.code, own.err]).toEqual([1, "reply: no message aaaa1111ffff addressed to you in GET /api/self/messages — nothing sent\n"]);
    const noLog = await ctl(["reply", IN_ID, "-", "--log", join(dir, "gibt-es-nicht.md")], { stdin: "Hallo" });
    expect([noLog.code, noLog.err]).toEqual([2, `reply: --log ${join(dir, "gibt-es-nicht.md")} does not exist — nothing sent\n`]);
    expect(posts()).toEqual([]);
    expect(readFileSync(log, "utf8")).toBe("unverändert\n");
  });

  test("lehnt der Server ab, wird nichts quittiert und nichts protokolliert; ohne Self-Token wird nichts gelesen", async () => {
    seen = [];
    writeFileSync(log, "");
    refuseSend = true;
    const r = await ctl(["reply", IN_ID, "-", "--log", log], { stdin: "Hallo" }).finally(() => { refuseSend = false; });
    expect(r.code).toBe(1);
    expect(r.err).toContain("409: replyTo names no message addressed to this sender — nothing sent");
    expect(posts().map((s) => s.path)).toEqual(["/api/self/messages"]);
    expect(readFileSync(log, "utf8")).toBe("");
    seen = [];
    const noSelf = await ctl(["reply", IN_ID, "-"], { self: false, stdin: "Hallo" });
    expect(noSelf.code).toBe(2);
    expect(seen).toEqual([]);
  });
});

describe("ctl.sh reply, Wiederholung und toter Server", () => {
  test("ein zweiter Lauf derselben Antwort (existing) schreibt keine zweite Protokollzeile", async () => {
    writeFileSync(log, "");
    replay = true;
    const r = await ctl(["reply", IN_ID, "-", "--log", log], { stdin: "Nochmal." }).finally(() => { replay = false; });
    expect(r.code).toBe(0);
    expect(r.out.trim()).toBe("reply to slot 2 (re aaaa1111): already sent as dddd4444 · marked read · not logged again (the run that sent it did)");
    expect(readFileSync(log, "utf8")).toBe("");
  });

  test("antwortet der Server nicht, sagt reply es in einem Satz und sendet nichts", async () => {
    const dead = Bun.serve({ port: 0, fetch: () => new Response("") });
    const url = dead.url.origin;
    dead.stop(true);
    const r = await ctl(["reply", IN_ID, "-"], { stdin: "Hallo", url });
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/^reply: GET \/api\/self\/messages 0: no answer from .* — nothing sent\n$/);
  });
});

describe("ctl.sh status", () => {
  test("eine Zeile je Fakt: Sitze, laufende und letzte Merge-Checks, Lands, Audit, Helfer, ungelesene Post", async () => {
    // ein laufender Merge-Check, so wie die Prozesstabelle ihn zeigt; daneben ein Token in seiner Kommandozeile
    const fake = join(dir, "ci");
    mkdirSync(fake, { recursive: true });
    writeFileSync(join(fake, "merge-check.ts"), "await Bun.sleep(60_000);\n");
    probe = Bun.spawn([process.execPath, join(fake, "merge-check.ts"), "--base", "main", "branch/laeuft", `--x=${SELF}`], { stdout: "ignore", stderr: "ignore" });
    await Bun.sleep(300);
    const r = await ctl(["status"], { owner: true });
    probe.kill();
    expect(r.code).toBe(0);
    const lines = r.out.trimEnd().split("\n");
    expect(lines).toContain("seats (2):");
    expect(lines.find((l) => /^\s+2 /.test(l))).toMatch(/^ {3}2  Bau Probe\s+42%  quiet 5m\s+branch\/probe$/);
    expect(lines.find((l) => /^\s+6\*/.test(l))).toMatch(/Orchestratorin\s+ctx \?\s+active\s+main  agent=dead$/);
    const checks = lines.find((l) => l.startsWith("checks running:"));
    // die Prozesstabelle ist die echte: ein Merge-Check, der gerade auf diesem Rechner läuft, steht mit in der Zeile
    expect(checks).toStartWith("checks running: ");
    const own = checks!.slice("checks running: ".length).split(", ").filter((e) => /^branch\/(laeuft|server-lauf)\b/.test(e));
    expect(own).toEqual([expect.stringMatching(/^branch\/laeuft \(\d+s\)$/), "branch/server-lauf"]);
    expect(lines.slice(lines.indexOf("checks last:") + 1, lines.indexOf("checks last:") + 4)).toEqual([
      "  branch/neu 66666666 conflict 5m ago", "  branch/gruen 44444444 green mergeable 10m ago", "  branch/rot 22222222 red 2h00 ago"]);
    expect(lines).toContain("lands: WAIT — slot 7 fleet/probe-lane running");
    expect(lines).toContain("audit now: RUNNING main@abcdef12 for 3m covers branch/eins");
    expect(lines).toContain("audit last: red 12345678 2h00 ago covers branch/null · adj flake");
    expect(lines).toContain("helper workhorse: online active · 2/5 running");
    expect(lines).toContain("helper jobs running: audit claude-fleet main on workhorse 4m");
    expect(lines).toContain("helper jobs queued (deviceless view): lane-suite claude-fleet fleet/vorschau 2m");
    expect(lines).toContain("unread: 1");
    expect(lines.find((l) => l.startsWith("  aaaa1111"))).toMatch(/^ {2}aaaa1111 \d\d:\d\d slot 2 Bau Probe: Frage von Slot 2 zweite Zeile$/);
    expect(r.out).not.toContain(SELF);
    expect(r.out).not.toContain(OWNER);
  });

  test("ohne Owner-Credential bleiben Sitze, Audit und Helfer UNKNOWN mit Grund, Post und Lands kommen über die Self-Türen", async () => {
    const r = await ctl(["status", "--full"]);
    expect(r.code).toBe(1);
    const lines = r.out.trimEnd().split("\n");
    expect(lines).toContain("seats: UNKNOWN — needs the owner credential, this shell has none");
    expect(lines).toContain("audit: UNKNOWN — needs the owner credential, this shell has none");
    expect(lines).toContain("helper jobs queued: UNKNOWN — needs the owner credential, this shell has none");
    expect(lines).toContain("lands: WAIT — slot 7 fleet/probe-lane running");
    expect(lines.slice(lines.indexOf("unread: 1") + 2)).toEqual(["    Frage von Slot 2", "    zweite Zeile"]);
  });

  test("ein toter Server und eine Antwort unerwarteter Form sind UNKNOWN, nie „none“", async () => {
    const dead = Bun.serve({ port: 0, fetch: () => new Response("") });
    const url = dead.url.origin;
    dead.stop(true);
    const r = await ctl(["status"], { owner: true, url });
    expect(r.code).toBe(1);
    const lines = r.out.trimEnd().split("\n");
    for (const l of ["seats", "lands", "audit", "helper jobs queued", "unread"])
      expect(lines.find((x) => x.startsWith(`${l}: `))).toMatch(new RegExp(`^${l}: UNKNOWN — GET \\S+ 0 no answer`));
    oddMerges = true;
    const odd = await ctl(["status"], { owner: true }).finally(() => { oddMerges = false; });
    expect(odd.code).toBe(1);
    expect(odd.out).toContain("lands: UNKNOWN — GET /api/self/merges 200 unexpected shape");
  });

  test("eine wartende Prüfung sagt, was sie hält und bis wann — aus pending von GET /api/post-land-audits", async () => {
    const audit = async (pending: Record<string, unknown>[]) => {
      waitingHold = pending;
      const r = await ctl(["status"], { owner: true }).finally(() => { waitingHold = null; });
      return { code: r.code, line: r.out.split("\n").find((l) => l.startsWith("audit now:")) };
    };
    const clock = new Date(RELEASE).toISOString().slice(11, 16);
    expect(await audit([{ repo: "claude-fleet", main: "main", hold: "quiet", releaseAt: RELEASE }])).toEqual({ code: 0,
      line: `audit now: WAITING 1: branch/wartet@99999999 since 45m — held: quiet until ${clock} (a deploy or audit-tip starts it now)` });
    expect((await audit([{ repo: "claude-fleet", main: "main", hold: "waiting for helper" }])).line)
      .toEndWith("— held: waiting for helper");
    expect((await audit([{ repo: "claude-fleet", main: "main", hold: "disk-space-held" }])).line).toEndWith("— held: disk-space-held");
    expect((await audit([{ repo: "claude-fleet", main: "main", hold: null }])).line).toEndWith("— held: nothing holds it");
    // die Route antwortet nicht: der Grund ist UNKNOWN, nie „nichts hält es“
    expect(await audit([])).toEqual({ code: 1, line: "audit now: WAITING 1: branch/wartet@99999999 since 45m — held: UNKNOWN (GET /api/post-land-audits 500)" });
  });

  test("ohne jedes Credential: Exit 2, keine Anfrage", async () => {
    seen = [];
    const r = await ctl(["status"], { self: false });
    expect(r.code).toBe(2);
    expect(seen).toEqual([]);
  });
});

// eine Zeile im Ledger, die kein JSON ist, kippt die Sicht nicht
test("ctl.sh status überliest eine kaputte Ledger-Zeile", async () => {
  appendFileSync(join(home, ".git", "merge-checks.jsonl"), "{kaputt\n");
  const r = await ctl(["status"], { owner: true });
  expect(r.out).toContain("  branch/neu 66666666 conflict 5m ago");
});
