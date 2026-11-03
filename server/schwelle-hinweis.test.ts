// DER HINWEIS KOMMT AN DER BASIS, AUCH MIT STEHENDER ÜBERGABE (W3 Auftrag 16, Punkt 3; Owner 01.11.: „[Zitat entfernt]“). Bis dahin schwieg der Hinweis unter der Obergrenze, solange die stehende Übergabe „[Zitat entfernt]“ war, und frisch zählte nur
// getippten Text: ein Bauer, dessen Tokens mit Werkzeug-Ausgaben wachsen, blieb nach jeder Übergabe frisch, und sein einer Hinweis kam
// erst an der Obergrenze, mitten im Auftrag. Ein echter Testserver mit dem Übergabe-Takt (server/nachbar.drive.ts), ein Sitz bei 37 %
// (Basis 35, Obergrenze 40) mit warmem Cache und einer gerade geschriebenen stehenden Übergabe: der Hinweis kommt.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { connect, type Socket } from "node:net";
import { join } from "node:path";
import { contextWindowFor } from "../src/protocol";
import { branchTestkit, LIFE_DEADLINE_MS, persisted } from "./branches-testkit";

const { PROJECTS, BIN, fixture, serve, cleanup } = branchTestkit();
// Sitze auf Fleets eigener Basis stehen in Fleets Repo (außerhalb startet ein Sitz im eigenen Setup, server/eigenes-setup.ts): je ein
// Ordner in diesem Checkout, den der Test am Ende wieder entfernt
const SITZ_ORDNER: string[] = [];
afterAll(() => { for (const d of SITZ_ORDNER) rmSync(d, { recursive: true, force: true }); cleanup(); });
// Der Ersatz-claude des Kits wird `sleep` (exec), und den hält Fleets Lebensprobe nicht für einen Agenten (server.ts#paneAgentAt: der
// Prozessname beginnt mit „claude“): ein Hinweis ginge nie hinaus. Hier wartet sleep unter dem Namen claude-wartet, als Verweis (eine
// Kopie eines Systemprogramms beendet macOS mit SIGKILL), und ps nennt den Namen des Verweises.
symlinkSync("/bin/sleep", join(BIN, "claude-wartet"));
// EIN SITZ, IN DESSEN FELD JEMAND SCHREIBT (W16-5): ein Ordner „…-belegt“ startet eine Shell unter dem Namen claude-tui. Sie zeichnet,
// was Fleet an Claude Code liest (server/live-state.ts#readFrame, composer.ts: zwei Linien, das Feld hinter ❯): zuerst ein Feld mit dem
// nächsten Auftrag des Owners, ruhend; sobald die Datei „[Zitat entfernt]“ im Ordner liegt, einen Spinner (der Sitz arbeitet) und ein leeres Feld.
symlinkSync("/bin/sh", join(BIN, "claude-tui"));
writeFileSync(join(BIN, "belegt.sh"), [
  "R='────────────────────'",
  "printf 'bereit\\n%s\\n❯ Auftrag des Owners\\n%s\\n' \"$R\" \"$R\"",
  // gewartet wird mit claude-wartet, nicht mit sleep: die Lebensprobe liest den Vordergrundprozess der Pane
  `while [ ! -f "$PWD/frei" ]; do "${join(BIN, "claude-wartet")}" 0.2; done`,
  "printf '\\033[2J\\033[H✻ Working… (esc to interrupt)\\n%s\\n❯ \\n%s\\n' \"$R\" \"$R\"",
  `while :; do "${join(BIN, "claude-wartet")}" 1; done`, ""].join("\n"));
writeFileSync(join(BIN, "claude"), `#!/bin/sh\ncase "$PWD" in *-belegt) exec "${join(BIN, "claude-tui")}" "${join(BIN, "belegt.sh")}" ;; esac\n`
  + `echo bereit\nexec "${join(BIN, "claude-wartet")}" 600\n`, { mode: 0o755 });

const MODEL = "claude-opus-5-5";
type Row = { sessionId?: string; selfToken?: string; openedAt?: number };
async function warte<T>(lies: () => T | null, ms: number): Promise<T | null> {
  for (const bis = Date.now() + ms; Date.now() < bis; await Bun.sleep(100)) { const v = lies(); if (v !== null) return v; }
  return lies();
}

// ein Bauer, wie Fleet ihn öffnet: ein Board-Branch und eine Session auf seinem Worktree (Art „bau“), Schwelle 35 vom Owner; sein Gespräch,
// wie Claude Code es schreibt: ein Modellaufruf vor `vorMs`, `anteil` des Fensters, Cache-Stufe eine Stunde
async function bauerMitGespraech(srv: Awaited<ReturnType<typeof serve>>, f: ReturnType<typeof fixture>, anteil: number, vorMs: number) {
  expect((await srv.call("/api/branches", { body: { repo: f.repo, name: "Bau" } })).status).toBe(201);
  const auf = await srv.call("/api/branches/open", { body: { repo: f.repo, branch: "branch/bau", model: MODEL } });
  expect(auf.status).toBe(200);
  const cwd = String(auf.body.cwd);
  const row = await warte(() => {
    const e = Object.entries((persisted(f).slots ?? {}) as Record<string, Row & { cwd?: string }>).find(([, r]) => r.cwd === cwd && r.sessionId && r.selfToken);
    return e ? { slot: Number(e[0]), sessionId: e[1].sessionId!, token: e[1].selfToken!, openedAt: e[1].openedAt! } : null;
  }, 10_000);
  if (!row) throw new Error("der Bauer hat kein Gespräch und keinen Self-Token");
  // ein Sitz in einem fremden Repo startet im eigenen Setup, dort ist die Übergabe aus, bis der Owner eine Schwelle wählt (thresholdOf)
  const wahl = await srv.call(`/api/slots/${row.slot}/handover`, { method: "PATCH", body: { expectedOpenedAt: row.openedAt, thresholdPct: 35 } });
  expect(wahl.status).toBe(200);
  const window = contextWindowFor(MODEL);
  if (window === null) throw new Error(`${MODEL}: kein Fenster`);
  const dir = join(PROJECTS, cwd.replace(/[^a-zA-Z0-9]/g, "-"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${row.sessionId}.jsonl`), `${JSON.stringify({ type: "assistant", timestamp: new Date(Date.now() - vorMs).toISOString(),
    message: { model: MODEL, content: [{ type: "text", text: "Schritt fertig." }], usage: { input_tokens: Math.round(window * anteil),
      cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: { ephemeral_1h_input_tokens: 1 } } } })}\n`);
  return row;
}
// das Gespräch eines Sitzes, wie Claude Code es schreibt: ein Modellaufruf vor `vorMs`, `anteil` des Fensters, Cache-Stufe eine Stunde
function gespraech(cwd: string, sessionId: string, anteil: number, vorMs: number): void {
  const window = contextWindowFor(MODEL);
  if (window === null) throw new Error(`${MODEL}: kein Fenster`);
  const dir = join(PROJECTS, cwd.replace(/[^a-zA-Z0-9]/g, "-"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${sessionId}.jsonl`), `${JSON.stringify({ type: "assistant", timestamp: new Date(Date.now() - vorMs).toISOString(),
    message: { model: MODEL, content: [{ type: "text", text: "Schritt fertig." }], usage: { input_tokens: Math.round(window * anteil),
      cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: { ephemeral_1h_input_tokens: 1 } } } })}\n`);
}
// ein freier Sitz auf Fleets eigener Basis (Art „session“, Basis aus FLEET_MIGRATE_PCT, keine eigene Schwelle), durch die Owner-Tür
async function sitzAufFleetsBasis(srv: Awaited<ReturnType<typeof serve>>, f: ReturnType<typeof fixture>, slot: number, name: string) {
  const cwd = join(import.meta.dir, "..", `.w16-sitz-${process.pid}-${SITZ_ORDNER.length}-${name}`);
  mkdirSync(cwd, { recursive: true });
  SITZ_ORDNER.push(cwd);
  const auf = await srv.call(`/api/slots/${slot}/open`, { body: { cwd, label: name } });
  expect(auf.status).toBe(200);
  const row = await warte(() => {
    const r = ((persisted(f).slots ?? {}) as Record<string, Row & { cwd?: string }>)[String(slot)];
    return r?.cwd === cwd && r.sessionId && r.selfToken ? { slot, cwd, sessionId: r.sessionId, token: r.selfToken, openedAt: r.openedAt! } : null;
  }, 10_000);
  if (!row) throw new Error(`Sitz ${name} hat kein Gespräch und keinen Self-Token`);
  return row;
}
// was Fleet in die Pane tippte (server.ts#saveHistory)
const getippt = (f: ReturnType<typeof fixture>, slot: number): string[] => {
  const verlauf = join(f.state, "streams", `s${slot}.history.json`);
  return existsSync(verlauf) ? (JSON.parse(readFileSync(verlauf, "utf8")) as { text: string; source?: string }[])
    .filter((h) => h.source === "fleet").map((h) => h.text) : [];
};
const auditZeile = (f: ReturnType<typeof fixture>, slot: number, event: string): string | null => {
  const audit = join(f.state, "audit.jsonl");
  if (!existsSync(audit)) return null;
  const r = readFileSync(audit, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as { event: string; slot?: number; detail?: string })
    .find((x) => x.event === event && x.slot === slot);
  return r ? String(r.detail) : null;
};

// Owner 03.11. (Auftrag früh übergeben, Punkt 1): wer schreibt, erfährt mit der Antwort den Füllstand des Empfängers und misst vor einem
// Auftrag, ob der Sitz ihn noch nehmen soll (operating-a-constellation, Schritt 4)
describe("die Antwort von POST /api/self/messages nennt den Füllstand des Empfängers", () => {
  test("ein Sitz schreibt der Orchestratorin und liest ihren Füllstand; ohne Halter ist er null, nie 0", async () => {
    const f = fixture();
    const srv = await serve(f, { FLEET_MIGRATE_PCT: "35" });
    try {
      const absender = await sitzAufFleetsBasis(srv, f, 1, "absender");
      const orch = await sitzAufFleetsBasis(srv, f, 2, "🎛 Orchestratorin");
      gespraech(orch.cwd, orch.sessionId, 0.31, 60_000);
      const schick = (key: string, to: unknown) => srv.call("/api/self/messages", { self: absender.token,
        body: { to, payload: { kind: "text", text: "ein Auftrag" }, idempotencyKey: key } });
      const an = await schick("fuell-1", { kind: "role", role: "orchestrator" });
      expect({ status: an.status, holder: (an.body.holder as { slot: number } | null)?.slot, fill: an.body.receiverFill })
        .toEqual({ status: 200, holder: 2, fill: { pct: 31, usedTokens: Math.round(contextWindowFor(MODEL)! * 0.31), windowTokens: contextWindowFor(MODEL) } });
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 2);
  test("ohne Halter der Adresse (keine lebende Orchestratorin) ist der Füllstand null", async () => {
    const f = fixture();
    const srv = await serve(f, { FLEET_MIGRATE_PCT: "35" });
    try {
      const absender = await sitzAufFleetsBasis(srv, f, 1, "allein");
      const an = await srv.call("/api/self/messages", { self: absender.token,
        body: { to: { kind: "role", role: "orchestrator" }, payload: { kind: "text", text: "wer liest das" }, idempotencyKey: "fuell-2" } });
      expect({ status: an.status, holder: an.body.holder, fill: an.body.receiverFill }).toEqual({ status: 200, holder: null, fill: null });
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 2);
});

describe("der Hinweis an der Basis", () => {
  test("ein Sitz über der Basis und unter der Obergrenze bekommt ihn, auch wenn er gerade eine stehende Übergabe schrieb", async () => {
    const f = fixture();
    const srv = await serve(f, { FLEET_MIGRATE_PCT: "35", FLEET_TEST_MIGRATE_TICK_MS: "300" });
    try {
      // ein Bauer, wie Fleet ihn öffnet: ein Board-Branch und eine Session auf seinem Worktree (Art „bau“, Basis aus FLEET_MIGRATE_PCT)
      expect((await srv.call("/api/branches", { body: { repo: f.repo, name: "Bau" } })).status).toBe(201);
      const auf = await srv.call("/api/branches/open", { body: { repo: f.repo, branch: "branch/bau", model: MODEL } });
      expect(auf.status).toBe(200);
      const cwd = String(auf.body.cwd);
      const row = await warte(() => {
        const e = Object.entries((persisted(f).slots ?? {}) as Record<string, Row & { cwd?: string }>).find(([, r]) => r.cwd === cwd && r.sessionId && r.selfToken);
        return e ? { slot: Number(e[0]), sessionId: e[1].sessionId!, token: e[1].selfToken!, openedAt: e[1].openedAt! } : null;
      }, 10_000);
      if (!row) throw new Error("der Bauer hat kein Gespräch und keinen Self-Token");
      // ein Sitz in einem fremden Repo startet im eigenen Setup, dort ist die Übergabe aus, bis der Owner eine Schwelle wählt (thresholdOf):
      // er wählt 35, die Basis eines Bauers
      const wahl = await srv.call(`/api/slots/${row.slot}/handover`, { method: "PATCH", body: { expectedOpenedAt: row.openedAt, thresholdPct: 35 } });
      expect(wahl.status).toBe(200);
      const window = contextWindowFor(MODEL);
      if (window === null) throw new Error(`${MODEL}: kein Fenster`);
      // das Gespräch, wie Claude Code es schreibt: ein Modellaufruf jetzt, 37 % des Fensters, Cache-Stufe eine Stunde (warm)
      const dir = join(PROJECTS, cwd.replace(/[^a-zA-Z0-9]/g, "-"));
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${row.sessionId}.jsonl`), `${JSON.stringify({ type: "assistant", timestamp: new Date().toISOString(),
        message: { model: MODEL, content: [{ type: "text", text: "Schritt fertig." }], usage: { input_tokens: Math.round(window * 0.37),
          cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: { ephemeral_1h_input_tokens: 1 } } } })}\n`);
      const uebergabe = await srv.call("/api/self/handover", { self: row.token, body: { intent: "alles steht, nichts fehlt" } });
      expect(uebergabe.status).toBe(200);
      const self = await srv.call("/api/self", { self: row.token });
      const ctx = self.body.context as { fill: { pct: number } | null; basePct: number | null; capPct: number | null; cache: string; off: string | null };
      expect({ pct: ctx.fill?.pct, basePct: ctx.basePct, capPct: ctx.capPct, cache: ctx.cache, off: ctx.off }).toEqual({ pct: 37, basePct: 35, capPct: 40, cache: "warm", off: null });
      // ein Hinweis je Gespräch (MAX_NUDGES 1): ist er angekommen, schreibt das Audit „gave up … after 1 delivered nudges“
      const audit = join(f.state, "audit.jsonl");
      const hinweis = await warte(() => {
        if (!existsSync(audit)) return null;
        const r = readFileSync(audit, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as { event: string; slot?: number; detail?: string })
          .find((x) => x.event === "migrate_gave_up" && x.slot === row.slot);
        return r ? String(r.detail) : null;
      }, 8_000);
      expect(hinweis).toBe(`gave up session=${row.sessionId} after 1 delivered nudges`);
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 4);

  // W3 Auftrag 16, Punkt 5: Slot 1 wurde am 01.11. um 06:57 bei 349k im Ruhezustand kompaktiert, unter seiner Basis. Ein ruhender Sitz
  // auf Fleets Basis (35) bei 30 %, dessen letzter Modellaufruf 55 min zurückliegt (Stufe eine Stunde: der Cache kühlt), bekommt die Zeile.
  test("ein ruhender Sitz ab 25 % unter Fleets Basis, dessen Cache kühlt, bekommt die Übergabe-Zeile und keine Handlung", async () => {
    const f = fixture();
    const srv = await serve(f, { FLEET_MIGRATE_PCT: "35", FLEET_TEST_MIGRATE_TICK_MS: "300" });
    try {
      const row = await sitzAufFleetsBasis(srv, f, 1, "ruhend");
      gespraech(row.cwd, row.sessionId, 0.30, 55 * 60_000);
      const self = await srv.call("/api/self", { self: row.token });
      const ctx = self.body.context as { fill: { pct: number } | null; basePct: number | null; from: string; cache: string; off: string | null };
      expect({ pct: ctx.fill?.pct, basePct: ctx.basePct, from: ctx.from, cache: ctx.cache, off: ctx.off })
        .toEqual({ pct: 30, basePct: 35, from: "env", cache: "warm", off: null });
      expect(await warte(() => auditZeile(f, row.slot, "migrate_gave_up"), 12_000)).toBe(`gave up session=${row.sessionId} after 1 delivered nudges`);
      const zeile = await warte(() => getippt(f, row.slot)[0] ?? null, 3_000) ?? "";
      expect(zeile).toContain("[fleet] Your context is at 30 %, at or above the between-orders mark of 25 %");
      expect(zeile).toContain("POST /api/self/succeed");
      // unter der Basis handelt Fleet nicht selbst: kein Compact, keine neue Session
      expect(auditZeile(f, row.slot, "threshold_act")).toBeNull();
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 4);

  // W3 Auftrag 17, W16-5: schreibt jemand gerade den nächsten Auftrag in das Feld des ruhenden Sitzes, wartete die Zeile bisher geparkt und
  // kam, sobald das Feld frei war, direkt hinter diesem Auftrag in einen Sitz, der nun arbeitet. Sie wird nicht mehr geparkt und vor dem
  // Paste fragt Fleet die Ruhe noch einmal.
  test("die ruhende Zeile landet nie in einem Sitz, der arbeitet, auch nicht aus einem besetzten Feld heraus", async () => {
    const f = fixture();
    const srv = await serve(f, { FLEET_MIGRATE_PCT: "35", FLEET_TEST_MIGRATE_TICK_MS: "300", FLEET_TEST_PARKED_TICK_MS: "300",
      FLEET_TEST_STREAM_POLL_MS: "100" });
    try {
      const row = await sitzAufFleetsBasis(srv, f, 1, "belegt");
      gespraech(row.cwd, row.sessionId, 0.30, 55 * 60_000);
      // er ruht mit dem Auftrag des Owners im Feld, bis die Zeile auf das Feld trifft (bisher: geparkt), höchstens acht Sekunden lang
      // (das Ruhefenster nach dem Anhängen der Pane muss erst ablaufen), dann arbeitet er
      await warte(() => auditZeile(f, row.slot, "send_parked"), 8_000);
      writeFileSync(join(row.cwd, "frei"), "");
      // bisher tippte der Takt der geparkten Sendungen sie, sobald das Feld frei war, in den nun arbeitenden Sitz
      await warte(() => getippt(f, row.slot).find((t) => t.includes("between-orders mark")) ?? null, 15_000);
      expect({ getippt: getippt(f, row.slot).filter((t) => t.includes("between-orders mark")), geparkt: auditZeile(f, row.slot, "send_parked") })
        .toEqual({ getippt: [], geparkt: null });
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 4);

  // W3 Auftrag 17, W16-3a: zwischen POST /api/self/succeed und dem Wechsel der Besetzung kam der Basis-Hinweis noch in die Pane, die
  // gerade geht. Die Nachfolge ist unterwegs, solange ihre Tür läuft (server.ts#successionInflight); hier hält eine Anfrage, deren Körper
  // erst halb angekommen ist, die Tür offen. Zwei Sitze über der Basis: nur der, dessen Nachfolge nicht unterwegs ist, bekommt den Hinweis.
  test("kein Basis-Hinweis in eine Pane, deren Nachfolge unterwegs ist", async () => {
    const f = fixture();
    const srv = await serve(f, { FLEET_MIGRATE_PCT: "35", FLEET_TEST_MIGRATE_TICK_MS: "300" });
    let tuer: Socket | null = null;
    try {
      const gehend = await sitzAufFleetsBasis(srv, f, 1, "gehend");
      const bleibend = await sitzAufFleetsBasis(srv, f, 2, "bleibend");
      const koerper = JSON.stringify({ carry: "die Nachfolgerin übernimmt" });
      tuer = connect(srv.port, "127.0.0.1");
      await new Promise<void>((ok, nein) => { tuer!.once("connect", () => ok()); tuer!.once("error", nein); });
      tuer.write(`POST /api/self/succeed HTTP/1.1\r\nHost: 127.0.0.1:${srv.port}\r\nx-fleet-self-token: ${gehend.token}\r\n`
        + `content-type: application/json\r\ncontent-length: ${Buffer.byteLength(koerper)}\r\n\r\n${koerper.slice(0, 5)}`);
      let antwort = "";
      tuer.on("data", (d) => { antwort += d.toString(); });
      await Bun.sleep(500);
      expect(antwort).toBe(""); // die Tür wartet auf den Rest des Körpers: die Nachfolge ist unterwegs
      // erst jetzt der Füllstand beider Sitze: 37 %, warm, über der Basis 35 und unter der Obergrenze 40
      gespraech(gehend.cwd, gehend.sessionId, 0.37, 0);
      gespraech(bleibend.cwd, bleibend.sessionId, 0.37, 0);
      expect(await warte(() => auditZeile(f, 2, "migrate_gave_up"), 12_000)).toBe(`gave up session=${bleibend.sessionId} after 1 delivered nudges`);
      await Bun.sleep(1_500);
      expect({ gehend: auditZeile(f, 1, "migrate_gave_up"), getippt: getippt(f, 1) }).toEqual({ gehend: null, getippt: [] });
    } finally { tuer?.destroy(); await srv.stop(); }
  }, LIFE_DEADLINE_MS * 4);
});

// Auftrag 2 (früh übergeben, zweite Runde): die Zeile kommt höchstens einmal je Besatzer, die Antwort eines Replays nennt den Füllstand, und
// ein Nachfolger erfährt, was zwischen Übergabe und Ende ankam. Alles durch einen echten Server in eigenem Prozess; die Pane ist ein Ersatz,
// was Fleet in sie tippte, steht im Verlauf (getippt).
const SCHNELL = { FLEET_MIGRATE_PCT: "35", FLEET_INBOX_NUDGE_MS: "1000", FLEET_POSTFACH_FENSTER_SEC: "0", FLEET_POSTFACH_MS: "250" };
// die Zeile, die Fleet in die Pane tippte, steht nicht im Verlauf (er hält den Text ohne Kopf), aber im Audit (server.ts#zwischenZeileBuchen)
const mitZeile = (f: ReturnType<typeof fixture>, slot: number): string[] => {
  const audit = join(f.state, "audit.jsonl");
  return !existsSync(audit) ? [] : readFileSync(audit, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as { event: string; slot?: number; detail?: string })
    .filter((x) => x.event === "between_orders_line" && x.slot === slot).map((x) => String(x.detail));
};
const nachricht = (srv: Awaited<ReturnType<typeof serve>>, self: string, to: unknown, key: string, text = "ein Auftrag") =>
  srv.call("/api/self/messages", { self, body: { to, payload: { kind: "text", text }, idempotencyKey: key } });

describe("Auftrag 2: die Zeile zwischen zwei Aufträgen, einmal je Besatzer", () => {
  test("zwei Aufträge nacheinander an einen Sitz bei 31 %: nur der erste trägt die Zeile", async () => {
    const f = fixture();
    const srv = await serve(f, SCHNELL);
    try {
      const absender = await sitzAufFleetsBasis(srv, f, 1, "absender");
      const orch = await sitzAufFleetsBasis(srv, f, 2, "🎛 Orchestratorin");
      gespraech(orch.cwd, orch.sessionId, 0.31, 60_000);
      await nachricht(srv, absender.token, { kind: "role", role: "orchestrator" }, "einmal-1", "erster Auftrag");
      expect((await warte(() => getippt(f, 2).find((t) => t.includes("erster Auftrag")) ?? null, 10_000)) !== null).toBe(true);
      await nachricht(srv, absender.token, { kind: "role", role: "orchestrator" }, "einmal-2", "zweiter Auftrag");
      expect((await warte(() => getippt(f, 2).find((t) => t.includes("zweiter Auftrag")) ?? null, 10_000)) !== null).toBe(true);
      expect(mitZeile(f, 2).map((z) => z.replace(/session=\S+ /, ""))).toEqual(["path=postfach fill=31"]);
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 3);
});

// Der Ersatz-claude zeigt keine Bereitschaftsmarke: die Nachfolge steht dann auf dem Slot, ihr Brief liegt als Schuld da (Antwort 500), und dort
// ist er im Klartext zu lesen. Das ist der Brief, den eine echte Nachfolgerin als Erstes bekäme.
async function briefDerNachfolge(srv: Awaited<ReturnType<typeof serve>>, self: string, body: unknown = {}): Promise<{ status: number; brief: string }> {
  const nf = await srv.call("/api/self/succeed", { self, body });
  const debts = await srv.call("/api/succession-debts");
  const rows = (debts.body.debts ?? []) as { id: string; brief: string }[];
  return { status: nf.status, brief: rows.find((d) => d.id === nf.body.debt)?.brief ?? "" };
}

describe("Auftrag 2: ein Nachfolger erfährt, was zwischen Übergabe und Ende ankam", () => {
  // Der Stand-in der Orchestratorin: Post getippt, sofort Übergabe und Nachfolge. Die Vorgängerin quittiert die Post (wie jede getippte
  // Zustellung: GET ...?unread=1&read=1 schreibt dieselbe Quittung), die Nachfolgerin sieht sie in keiner Liste Ungelesener.
  test("Post nach der Übergabe, von der Vorgängerin quittiert: der Brief nennt sie, mit Absender, Anfang des Textes und der Tür", async () => {
    const f = fixture();
    const srv = await serve(f, SCHNELL);
    try {
      const a = await sitzAufFleetsBasis(srv, f, 1, "vorgaenger");
      const orch = await sitzAufFleetsBasis(srv, f, 2, "🎛 Orchestratorin");
      expect((await srv.call("/api/self/handover", { self: a.token, body: { intent: "Stand: alles fertig, nichts offen" } })).status).toBe(200);
      const m = await nachricht(srv, orch.token, { kind: "session", slot: 1 }, "spaet-1", "bitte stoppe den Lauf und melde dich");
      expect(m.status).toBe(200);
      const id = (m.body.message as { id: string }).id;
      // vor der Quittung steht sie in der Liste Ungelesener, nach ihr in keiner
      expect(((await srv.call("/api/self/messages?unread=1", { self: a.token })).body.entries as unknown[]).length).toBe(1);
      expect((await srv.call("/api/self/messages?unread=1&read=1", { self: a.token })).status).toBe(200);
      expect(((await srv.call("/api/self/messages?unread=1", { self: a.token })).body.entries as unknown[]).length).toBe(0);
      // ein als persönlich markierter Text kommt nie in den Brief (die Nachfolgerin kann auf einer anderen Harness laufen): Kennung, Absender, Zeit
      const privat = await srv.call("/api/self/messages", { self: orch.token, body: { to: { kind: "session", slot: 1 }, personal: true,
        payload: { kind: "text", text: "nur für Anthropic-Sitze" }, idempotencyKey: "spaet-privat" } });
      expect(privat.status).toBe(200);
      expect((await srv.call("/api/self/messages?unread=1&read=1", { self: a.token })).status).toBe(200);
      const { brief } = await briefDerNachfolge(srv, a.token);
      expect(brief).toContain(`- ${(privat.body.message as { id: string }).id} von Orchestrator um `);
      expect(brief).not.toContain("nur für Anthropic-Sitze");
      // Auftrag 3, Punkt 2: der Brief sagt, was er weiß (gelesen oder getippt nach der stehenden Übergabe, Ausgang offen), nicht „kam nach der Übergabe an“
      expect(brief).toContain("hat sie diese Post gelesen oder in ihre Pane getippt bekommen. Ob sie erledigt ist, ist nicht bekannt");
      expect(brief).toContain(`- ${id} von Orchestrator um `);
      expect(brief).toContain("„bitte stoppe den Lauf und melde dich“");
      expect(brief).toContain("GET $FLEET_SELF_URL/api/self/messages mit dem Header x-fleet-self-token: $FLEET_SELF_TOKEN");
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 3);
  test("Post, die vor der Übergabe quittiert wurde, steht nicht als nachgekommen im Brief; die Kennung in der Übergabe bringt Zeile und Tür", async () => {
    const f = fixture();
    const srv = await serve(f, SCHNELL);
    try {
      const a = await sitzAufFleetsBasis(srv, f, 1, "vorgaenger");
      const orch = await sitzAufFleetsBasis(srv, f, 2, "🎛 Orchestratorin");
      const alt = await nachricht(srv, orch.token, { kind: "session", slot: 1 }, "alt-1", "ein älterer Auftrag");
      expect((await srv.call("/api/self/messages?unread=1&read=1", { self: a.token })).status).toBe(200);
      await Bun.sleep(30);
      const genannt = await nachricht(srv, orch.token, { kind: "session", slot: 1 }, "genannt-1", "der Auftrag, den die Übergabe nur nennt");
      const idGenannt = (genannt.body.message as { id: string }).id;
      expect((await srv.call("/api/self/messages?unread=1&read=1", { self: a.token })).status).toBe(200);
      // nur die Kennung, kein Wort dazu: so übergab eine Vorgängerin, die die Tür nicht kannte (zweiter Prüfer, 03.11.)
      expect((await srv.call("/api/self/handover", { self: a.token, body: { intent: `nimm die Nachricht ${idGenannt}` } })).status).toBe(200);
      const { brief } = await briefDerNachfolge(srv, a.token);
      expect(brief).not.toContain("hat sie diese Post gelesen");
      expect(brief).not.toContain((alt.body.message as { id: string }).id);
      expect(brief).toContain("Ihre Übergabe nennt diese Post:");
      expect(brief).toContain(`- ${idGenannt} von Orchestrator um `);
      expect(brief).toContain("„der Auftrag, den die Übergabe nur nennt“");
      expect(brief).toContain("GET $FLEET_SELF_URL/api/self/messages");
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 3);
  test("ohne Post kein Zusatz im Brief", async () => {
    const f = fixture();
    const srv = await serve(f, SCHNELL);
    try {
      const a = await sitzAufFleetsBasis(srv, f, 1, "leer");
      expect((await srv.call("/api/self/handover", { self: a.token, body: { intent: "Stand: nichts offen" } })).status).toBe(200);
      const { brief } = await briefDerNachfolge(srv, a.token);
      expect(brief).toContain("Stand: nichts offen");
      // keine Post-Zeile; die Tür (Auftrag 3, Punkt 3) steht in jedem Brief, auch in diesem
      expect(brief).not.toContain("Ihre Übergabe nennt");
      expect(brief).not.toContain("hat sie diese Post gelesen");
      expect(brief).not.toContain("/api/self/messages");
      expect(brief).toContain("Deine Tür zu Fleet: $FLEET_SELF_URL");
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 3);
});

// Auftrag 2, Punkt 7: auch der Replay (existing: true) nennt den Füllstand, den der Halter JETZT hat; der Fernpfad hat keinen und sagt null
describe("Auftrag 2: der Replay einer Nachricht nennt den Füllstand des Empfängers", () => {
  test("dieselbe Sendung noch einmal: existing true und receiverFill wie beim ersten Mal; nach einem Wachsen der neue Stand", async () => {
    const f = fixture();
    const srv = await serve(f, { FLEET_MIGRATE_PCT: "35" });
    try {
      const absender = await sitzAufFleetsBasis(srv, f, 1, "absender");
      const orch = await sitzAufFleetsBasis(srv, f, 2, "🎛 Orchestratorin");
      gespraech(orch.cwd, orch.sessionId, 0.31, 60_000);
      const an = { kind: "role", role: "orchestrator" };
      const erste = await nachricht(srv, absender.token, an, "replay-1");
      const noch = await nachricht(srv, absender.token, an, "replay-1");
      const fenster = contextWindowFor(MODEL)!;
      const stand = (pct: number) => ({ pct, usedTokens: Math.round(fenster * pct / 100), windowTokens: fenster });
      expect({ erste: [erste.body.existing, erste.body.receiverFill], noch: [noch.body.existing, noch.body.receiverFill] })
        .toEqual({ erste: [false, stand(31)], noch: [true, stand(31)] });
      gespraech(orch.cwd, orch.sessionId, 0.33, 30_000);
      const spaeter = await nachricht(srv, absender.token, an, "replay-1");
      expect([spaeter.body.existing, spaeter.body.receiverFill]).toEqual([true, stand(33)]);
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 2);
});
