// FERNPOST: ein Sitz einer Fleet schreibt einem Sitz einer anderen (Owner 29.10.: „[Zitat entfernt]“). Zwei Server leben
// GLEICHZEITIG auf eigenen Ports, jeder mit eigenem Zustand, eigener Pane und eigener Bindung (nachbarn.json + secrets/); die
// Nachrichten gehen über echtes HTTP zwischen ihnen. Der Ersatz-claude ist der aus server/orchestratorin-postfach.test.ts: er schreibt,
// was in seine Pane getippt wird, in `.getippt`.
//
//   1  der Sitz schreibt über seine Self-Tür, die andere Fleet legt die Nachricht ins Postfach (Absender: Fleet und Slot) und tippt sie in die Pane
//   2  die Antwort (replyTo) findet zurück ins Postfach des ersten Sitzes
//   3  die empfangende Fleet lehnt ab, was sie nicht freigab (409 mit Grund); ein unbekannter Ausweis ist 401, auch der Owner-Token und ein Self-Token
//   5  nicht erreichbar ist laut: aus, zu langsam, 401 oder 409 — der Absender hört es sofort mit Nachbar und Status, keine Zeile, keine Wiederholung
//   6  dieselben Grenzen wie lokal: Größe und Idempotenz; ein zweiter Versand mit gleichem Schlüssel ergibt drüben genau eine Zeile
//   4  der Ausweis steht nirgends: nicht im Postfach, nicht in der Pane, nicht im Log, nicht im Zustand; auf dem Draht reisen nur er, Slots und Text
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { branchTestkit, persisted, type Answer, type Fixture } from "./branches-testkit";
import { ladeNachbarn } from "./nachbarn";
import { MAX_MESSAGE_TEXT } from "./types";

const { TMP, BIN, fixture, serve, cleanup } = branchTestkit();
afterAll(cleanup);
const FRAMES = join(TMP, "frames");
mkdirSync(FRAMES);
symlinkSync(process.execPath, join(BIN, "claude-agent"));
writeFileSync(join(TMP, "ersatz.js"), `const fs = require("node:fs"), path = require("node:path");
const f = path.join(${JSON.stringify(FRAMES)}, process.cwd().split("/").slice(-3).join("_"));
let last = null;
setInterval(() => { let c = ""; try { c = fs.readFileSync(f, "utf8").trimEnd(); } catch {}
  if (c !== last) { last = c; process.stdout.write("\\x1b[H\\x1b[2J" + c + "\\n"); } }, 200);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.on("data", (d) => fs.appendFileSync(f + ".getippt", d));
`);
writeFileSync(join(BIN, "claude"), `#!/bin/sh\nexec "${join(BIN, "claude-agent")}" "${join(TMP, "ersatz.js")}"\n`, { mode: 0o755 });

// zwei Ausweise, je Richtung einer: nie der Owner-Token, nie ein Self-Token
const AUSWEIS_A_AN_B = "ausweis-a-an-b-0123456789abcdef0123456789";
const AUSWEIS_B_AN_A = "ausweis-b-an-a-fedcba9876543210fedcba9876";
const SITZ_A = 2, SITZ_B = 5, FREMD_A = 3, LEER_B = 6;
const FRIST_MS = 1500, FEHLVERSUCHE = 20;

type Fleet = Awaited<ReturnType<typeof serve>> & { f: Fixture };
const bindung = (f: Fixture, nachbarn: unknown, geheim: Record<string, string>) => {
  const dir = join(f.state, "bindung");
  mkdirSync(join(dir, "secrets"), { recursive: true });
  for (const [name, wert] of Object.entries(geheim)) { writeFileSync(join(dir, "secrets", name), `${wert}\n`); chmodSync(join(dir, "secrets", name), 0o600); }
  writeFileSync(join(dir, "nachbarn.json"), JSON.stringify({ nachbarn }));
};
const frame = (f: Fixture) => join(FRAMES, f.repo.split("/").slice(-3).join("_"));
const getippt = (f: Fixture) => `${frame(f)}.getippt`;
async function wartePane(f: Fixture, text: string): Promise<string> {
  const end = Date.now() + 15_000;
  while (Date.now() < end) {
    const t = existsSync(getippt(f)) ? readFileSync(getippt(f), "utf8") : "";
    if (t.includes(text)) return t;
    await Bun.sleep(100);
  }
  return existsSync(getippt(f)) ? readFileSync(getippt(f), "utf8") : "";
}
async function selfToken(f: Fixture, slot: number): Promise<string> {
  const end = Date.now() + 10_000;
  while (Date.now() < end) {
    const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
    if (t) return t;
    await Bun.sleep(100);
  }
  throw new Error(`Slot ${slot} hat keinen Self-Token`);
}
async function oeffne(fl: Fleet, slot: number, label: string): Promise<string> {
  const a = await fl.call(`/api/slots/${slot}/open`, { body: { cwd: fl.f.repo, label } });
  expect(a.status).toBe(200);
  return await selfToken(fl.f, slot);
}
const text = (t: string) => ({ kind: "text", text: t });
type Zeile = { id: string; from: { kind: string; fleet?: string; slot?: number }; to: { kind: string; slot?: number; fleet?: string }; replyTo: string | null;
  payload: { text: string } };
const postfach = async (fl: Fleet, tok: string): Promise<Zeile[]> => (await fl.call("/api/self/messages", { self: tok })).body.entries as Zeile[];

let a: Fleet, b: Fleet;
let tokA: string, tokB: string, tokFremdA: string;

beforeAll(async () => {
  const fa = fixture(), fb = fixture();
  // eine kurze Frist für den Aufruf beim Nachbarn, damit „zu langsam“ in Sekunden prüfbar ist (die echte ist 10 s)
  a = { ...(await serve(fa, { FLEET_NACHBAR_FRIST_MS: String(FRIST_MS) })), f: fa };
  // eine kleine Grenze für falsche Ausweise je Quelle, damit die Flut in Sekunden prüfbar ist (die echte ist 50 je Stunde)
  b = { ...(await serve(fb, { FLEET_NACHBAR_FEHLVERSUCHE: String(FEHLVERSUCHE) })), f: fb };
  // die Bindung jeder Fleet: sie nennt den Nachbarn bei einem Namen, zeigt ihm ihren Ausweis und gibt ihm die Paare frei, die SIE zulässt
  bindung(fa, [{ name: "b", url: b.url, ausweisAus: "an-b.token", ausweisEin: "von-b.token", erlaubt: [{ von: SITZ_B, an: SITZ_A }] }],
    { "an-b.token": AUSWEIS_A_AN_B, "von-b.token": AUSWEIS_B_AN_A });
  bindung(fb, [{ name: "a", url: a.url, ausweisAus: "an-a.token", ausweisEin: "von-a.token", erlaubt: [{ von: SITZ_A, an: SITZ_B }] }],
    { "an-a.token": AUSWEIS_B_AN_A, "von-a.token": AUSWEIS_A_AN_B });
  tokA = await oeffne(a, SITZ_A, "Sitz A");
  tokFremdA = await oeffne(a, FREMD_A, "Sitz A zwei");
  tokB = await oeffne(b, SITZ_B, "Sitz B");
  for (const fl of [a, b]) writeFileSync(frame(fl.f), "⏺ Der Sitz wartet.\n");
}, 90_000);

describe("Fernpost: ein Sitz schreibt einem Sitz der anderen Fleet", () => {
  let erste: Zeile;
  test("die Nachricht liegt im Postfach der anderen Fleet mit Fleet und Slot des Absenders und wird in die Pane getippt", async () => {
    const sent = await a.call("/api/self/messages", { self: tokA, body: { to: { kind: "remote", fleet: "b", slot: SITZ_B }, payload: text("Hallo drüben, hier Sitz A."), idempotencyKey: "k1" } });
    expect(sent.status).toBe(200);
    expect(sent.body).toMatchObject({ ok: true, existing: false, holder: { fleet: "b", slot: SITZ_B }, message: { to: { kind: "remote", fleet: "b", slot: SITZ_B } } });
    const box = await postfach(b, tokB);
    expect(box.filter((m) => m.payload.text === "Hallo drüben, hier Sitz A.").map((m) => m.from)).toEqual([{ kind: "remote", fleet: "a", slot: SITZ_A }]);
    erste = box.find((m) => m.payload.text === "Hallo drüben, hier Sitz A.")!;
    const pane = await wartePane(b.f, "Hallo drüben, hier Sitz A.");
    expect(pane).toContain(`[fleet message] ${erste.id} from Fleet a Slot ${SITZ_A}`);
  }, 60_000);

  test("dieselbe Nachricht mit demselben Schlüssel legt nichts doppelt ab", async () => {
    const again = await a.call("/api/self/messages", { self: tokA, body: { to: { kind: "remote", fleet: "b", slot: SITZ_B }, payload: text("Hallo drüben, hier Sitz A."), idempotencyKey: "k1" } });
    expect(again.body).toMatchObject({ ok: true, existing: true });
    expect((await postfach(b, tokB)).filter((m) => m.payload.text === "Hallo drüben, hier Sitz A.")).toHaveLength(1);
  }, 30_000);

  test("die Antwort mit replyTo findet zurück ins Postfach des ersten Sitzes und in seine Pane", async () => {
    const ersteBeiA = (await postfach(a, tokA)).find((m) => m.payload.text === "Hallo drüben, hier Sitz A.")!;
    expect(ersteBeiA.to).toEqual({ kind: "remote", fleet: "b", slot: SITZ_B });
    const reply = await b.call("/api/self/messages", { self: tokB, body: { to: erste.from, replyTo: erste.id, payload: text("Gruß zurück von Sitz B."), idempotencyKey: "r1" } });
    expect(reply.status).toBe(200);
    const box = await postfach(a, tokA);
    const antwort = box.find((m) => m.payload.text === "Gruß zurück von Sitz B.")!;
    expect(antwort.from).toEqual({ kind: "remote", fleet: "b", slot: SITZ_B });
    expect(antwort.replyTo).toBe(ersteBeiA.id);
    expect(await wartePane(a.f, "Gruß zurück von Sitz B.")).toContain(`from Fleet b Slot ${SITZ_B}`);
  }, 60_000);

  test("eine Antwort auf eine Nachricht, die nicht von diesem Sitz kam, wird abgewiesen", async () => {
    const lokal = await b.call("/api/self/messages", { self: tokB, body: { to: { kind: "remote", fleet: "a", slot: SITZ_A }, replyTo: "0".repeat(24), payload: text("x"), idempotencyKey: "r2" } });
    expect(lokal).toMatchObject({ status: 409, body: { error: expect.stringContaining("replyTo names no message") } });
  });
});

describe("Fernpost: eine Tür prüft, wer wem schreiben darf — die empfangende", () => {
  test("ein Paar, das die empfangende Fleet nicht freigab, wird mit Grund abgelehnt, und nichts liegt im Postfach", async () => {
    const vorher = (await postfach(b, tokB)).length;
    const r = await a.call("/api/self/messages", { self: tokFremdA, body: { to: { kind: "remote", fleet: "b", slot: SITZ_B }, payload: text("ungefragt"), idempotencyKey: "f1" } });
    expect(r.status).toBe(409);
    expect(r.body.neighbour).toEqual({ fleet: "b", status: 409 });
    expect(String(r.body.error)).toContain('neighbour "b" answered 409');
    expect(String(r.body.error)).toContain(`slot ${FREMD_A} of "a" may not write to slot ${SITZ_B}`);
    expect((await postfach(b, tokB)).length).toBe(vorher);
    expect((await postfach(a, tokFremdA)).some((m) => m.payload.text === "ungefragt")).toBe(false);
  }, 30_000);

  test("ein Slot, der nicht freigegeben ist, antwortet gleich — egal ob dort jemand sitzt", async () => {
    const r = await a.call("/api/self/messages", { self: tokA, body: { to: { kind: "remote", fleet: "b", slot: LEER_B }, payload: text("wer ist da"), idempotencyKey: "f2" } });
    expect(r.status).toBe(409);
    expect(String(r.body.error)).toContain(`may not write to slot ${LEER_B}`);
  }, 30_000);

  test("ein Nachbar, den die Bindung nicht kennt, ist ein Fehler des Absenders und erreicht niemanden", async () => {
    const r = await a.call("/api/self/messages", { self: tokA, body: { to: { kind: "remote", fleet: "fremd", slot: 1 }, payload: text("x"), idempotencyKey: "f3" } });
    expect(r).toMatchObject({ status: 409, body: { error: expect.stringContaining('unknown neighbour fleet "fremd"') } });
  });

  test("an der Tür des Nachbarn kommt nur herein, wer dessen Ausweis zeigt: kein Ausweis, ein falscher, der Owner-Token und ein Self-Token sind 401", async () => {
    const door = "/api/fleet-nachbar/messages";
    const body = { from: { slot: SITZ_A }, to: { slot: SITZ_B }, payload: text("Einbruch"), idempotencyKey: "x1" };
    const mit = (bearer: string | null) => b.call(door, { owner: false, body, headers: bearer ? { authorization: `Bearer ${bearer}` } : {} });
    for (const bearer of [null, "falsch", b.f.token, tokB, tokA, AUSWEIS_B_AN_A]) expect((await mit(bearer)).status).toBe(401);
    expect((await postfach(b, tokB)).some((m) => m.payload.text === "Einbruch")).toBe(false);
    // der richtige Ausweis, aber ein Body, der mehr will als Slots, Text und Schlüssel
    const extra = await b.call(door, { owner: false, body: { ...body, token: "x" }, headers: { authorization: `Bearer ${AUSWEIS_A_AN_B}` } });
    expect(extra.status).toBe(400);
  }, 30_000);

  test("ein erreichbar-loser Nachbar lässt nichts zurück, und derselbe Schlüssel darf noch einmal", async () => {
    bindung(a.f, [{ name: "b", url: "http://127.0.0.1:9", ausweisAus: "an-b.token", ausweisEin: "von-b.token", erlaubt: [{ von: SITZ_B, an: SITZ_A }] }], {});
    const r = await a.call("/api/self/messages", { self: tokA, body: { to: { kind: "remote", fleet: "b", slot: SITZ_B }, payload: text("ins Leere"), idempotencyKey: "u1" } });
    expect(r.status).toBe(502);
    expect(r.body.neighbour).toEqual({ fleet: "b", status: null });
    expect(String(r.body.error)).toContain('neighbour "b" is not reachable');
    expect((await postfach(a, tokA)).some((m) => m.payload.text === "ins Leere")).toBe(false);
    bindung(a.f, [{ name: "b", url: b.url, ausweisAus: "an-b.token", ausweisEin: "von-b.token", erlaubt: [{ von: SITZ_B, an: SITZ_A }] }], {});
    const again = await a.call("/api/self/messages", { self: tokA, body: { to: { kind: "remote", fleet: "b", slot: SITZ_B }, payload: text("ins Leere"), idempotencyKey: "u1" } });
    expect(again.status).toBe(200);
  }, 30_000);
});

const anB = (url: string, ausweisAus = "an-b.token") =>
  bindung(a.f, [{ name: "b", url, ausweisAus, ausweisEin: "von-b.token", erlaubt: [{ von: SITZ_B, an: SITZ_A }] }], {});
// ein Stück Draht vor B: zählt jede Anfrage, hält die ersten `zoegern` Anfragen `ms` lang auf und reicht sie dann an B weiter
function vorB(zoegern: number, ms: number) {
  const gesehen: string[] = [];
  const stub = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(req) {
    const body = await req.text();
    gesehen.push(body);
    if (gesehen.length <= zoegern) await Bun.sleep(ms);
    const res = await fetch(`${b.url}${new URL(req.url).pathname}`, { method: "POST", body,
      headers: { authorization: req.headers.get("authorization") ?? "", "content-type": "application/json" } });
    return new Response(await res.text(), { status: res.status, headers: { "content-type": "application/json" } });
  } });
  return { url: `http://127.0.0.1:${stub.port}`, gesehen, stop: () => stub.stop(true) };
}

describe("Fernpost: nicht erreichbar ist laut", () => {
  test("antwortet der Nachbar nicht in der Frist, hört der Absender es sofort, und es gibt keine Zeile und keine Wiederholung", async () => {
    const draht = vorB(1, FRIST_MS * 3);
    try {
      anB(draht.url);
      const t0 = Date.now();
      const r = await a.call("/api/self/messages", { self: tokA, body: { to: { kind: "remote", fleet: "b", slot: SITZ_B }, payload: text("zu langsam"), idempotencyKey: "s1" } });
      const dauer = Date.now() - t0;
      expect(r.status).toBe(504);
      expect(r.body.neighbour).toEqual({ fleet: "b", status: null });
      expect(String(r.body.error)).toContain(`neighbour "b" did not answer within ${FRIST_MS / 1000} s — the message may have arrived there; nothing is filed here`);
      expect(dauer).toBeLessThan(FRIST_MS * 3);
      expect((await postfach(a, tokA)).some((m) => m.payload.text === "zu langsam")).toBe(false);
      // der langsame Nachbar nimmt die Nachricht doch noch; die Fleet versucht es nicht von selbst noch einmal
      await Bun.sleep(FRIST_MS * 3);
      expect(draht.gesehen).toHaveLength(1);
      expect((await postfach(b, tokB)).filter((m) => m.payload.text === "zu langsam")).toHaveLength(1);
      // DER SITZ sendet noch einmal mit demselben Schlüssel: drüben bleibt es genau eine Zeile, hier entsteht jetzt die eine ausgehende
      const again = await a.call("/api/self/messages", { self: tokA, body: { to: { kind: "remote", fleet: "b", slot: SITZ_B }, payload: text("zu langsam"), idempotencyKey: "s1" } });
      expect(again.status).toBe(200);
      expect(draht.gesehen).toHaveLength(2);
      expect((await postfach(b, tokB)).filter((m) => m.payload.text === "zu langsam")).toHaveLength(1);
      expect((await postfach(a, tokA)).filter((m) => m.payload.text === "zu langsam")).toHaveLength(1);
    } finally { draht.stop(); anB(b.url); }
  }, 30_000);

  test("lehnt der Nachbar den Ausweis ab (401), nennt der Fehler Nachbar und Status, und keine Seite hat eine Zeile", async () => {
    bindung(a.f, [], { "falsch.token": "falscher-ausweis-0123456789abcdef0123" });
    anB(b.url, "falsch.token");
    try {
      const r = await a.call("/api/self/messages", { self: tokA, body: { to: { kind: "remote", fleet: "b", slot: SITZ_B }, payload: text("falscher Ausweis"), idempotencyKey: "w1" } });
      expect(r.status).toBe(409);
      expect(r.body.neighbour).toEqual({ fleet: "b", status: 401 });
      expect(String(r.body.error)).toContain('neighbour "b" answered 401');
      expect((await postfach(a, tokA)).some((m) => m.payload.text === "falscher Ausweis")).toBe(false);
      expect((await postfach(b, tokB)).some((m) => m.payload.text === "falscher Ausweis")).toBe(false);
    } finally { anB(b.url); }
  }, 30_000);
});

describe("Fernpost: dieselben Grenzen wie eine lokale Nachricht", () => {
  const door = "/api/fleet-nachbar/messages";
  const mitAusweis = (body: unknown) => b.call(door, { owner: false, body, headers: { authorization: `Bearer ${AUSWEIS_A_AN_B}` } });

  test("mehr als der Deckel (MAX_MESSAGE_TEXT) nimmt weder die Self-Tür noch die Tür des Nachbarn; genau der Deckel geht", async () => {
    const zuViel = "x".repeat(MAX_MESSAGE_TEXT + 1);
    const r = await a.call("/api/self/messages", { self: tokA, body: { to: { kind: "remote", fleet: "b", slot: SITZ_B }, payload: text(zuViel), idempotencyKey: "g1" } });
    expect(r.status).toBe(400);
    expect((await mitAusweis({ from: { slot: SITZ_A }, to: { slot: SITZ_B }, payload: text(zuViel), idempotencyKey: "g2" })).status).toBe(400);
    expect((await mitAusweis({ from: { slot: SITZ_A }, to: { slot: SITZ_B }, payload: text("y".repeat(MAX_MESSAGE_TEXT)), idempotencyKey: "g3" })).status).toBe(200);
    expect((await postfach(b, tokB)).filter((m) => m.payload.text.length > MAX_MESSAGE_TEXT)).toEqual([]);
  }, 30_000);

  test("derselbe Schlüssel zweimal an der Tür ergibt drüben genau eine Zeile; derselbe Schlüssel für einen anderen Text ist 409", async () => {
    const body = { from: { slot: SITZ_A }, to: { slot: SITZ_B }, payload: text("genau einmal"), idempotencyKey: "i1" };
    const [eins, zwei] = [await mitAusweis(body), await mitAusweis(body)];
    expect([eins.status, eins.body.existing, zwei.status, zwei.body.existing]).toEqual([200, false, 200, true]);
    expect((await postfach(b, tokB)).filter((m) => m.payload.text === "genau einmal")).toHaveLength(1);
    const anders = await mitAusweis({ ...body, payload: text("etwas anderes") });
    expect(anders.status).toBe(409);
    expect((await postfach(b, tokB)).some((m) => m.payload.text === "etwas anderes")).toBe(false);
  }, 30_000);
});

// die Zeilen des Audits eines Servers (persist.ts schreibt im Hintergrund: kurz warten, bis `bis` da ist)
async function auditZeilen(f: Fixture, bis: (z: { event: string; actor?: unknown; detail?: string }) => boolean) {
  const pfad = join(f.state, "audit.jsonl");
  const lies = () => (existsSync(pfad) ? readFileSync(pfad, "utf8") : "").split("\n").filter(Boolean)
    .map((l) => JSON.parse(l) as { event: string; actor?: unknown; detail?: string });
  const end = Date.now() + 5000;
  while (Date.now() < end && !lies().some(bis)) await Bun.sleep(100);
  return lies();
}

describe("Fernpost: was die Prüfung nachbessern ließ", () => {
  const door = "/api/fleet-nachbar/messages";

  test("der Nachbar steht im Audit als er selbst: actor {kind:nachbar, fleet}", async () => {
    const r = await a.call("/api/self/messages", { self: tokA, body: { to: { kind: "remote", fleet: "b", slot: SITZ_B }, payload: text("fürs Audit"), idempotencyKey: "au1" } });
    expect(r.status).toBe(200);
    const zeilen = await auditZeilen(b.f, (z) => z.event === "nachbar_nachricht");
    const nachricht = zeilen.filter((z) => z.event === "nachbar_nachricht");
    expect(nachricht.length).toBeGreaterThan(0);
    for (const z of nachricht) expect(z.actor).toEqual({ kind: "nachbar", fleet: "a" });
    // auch die Postfach-Zeile, die die Tür anlegt, und eine Abweisung des Paars schreibt der Nachbar
    expect(zeilen.filter((z) => z.event === "message_append" && z.detail?.startsWith("remote:a:")).map((z) => z.actor))
      .toContainEqual({ kind: "nachbar", fleet: "a" });
    for (const z of zeilen.filter((x) => x.event === "nachbar_paar_abgewiesen")) expect(z.actor).toEqual({ kind: "nachbar", fleet: "a" });
    expect(zeilen.some((z) => z.event === "nachbar_paar_abgewiesen")).toBe(true);
  }, 30_000);

  test("die Tür prüft den Ausweis, bevor sie den Body liest: ein Fremder mit einem Body, der nie endet, hat sofort seine Absage", async () => {
    let antwort = "";
    const sock = await Bun.connect({ hostname: "127.0.0.1", port: b.port, socket: { data(_s, d) { antwort += new TextDecoder().decode(d); } } });
    // 100 000 Bytes angekündigt, eines geschickt: wer den Body läse, wartete hier, bis der Aufruf abreißt
    sock.write(`POST ${door} HTTP/1.1\r\nHost: 127.0.0.1:${b.port}\r\nAuthorization: Bearer falsch\r\nContent-Type: application/json\r\nContent-Length: 100000\r\n\r\n{`);
    const end = Date.now() + 5000;
    while (Date.now() < end && !antwort.includes("\r\n\r\n")) await Bun.sleep(50);
    sock.end();
    expect(antwort.split("\r\n")[0]).toMatch(/^HTTP\/1\.1 401/);
  }, 30_000);

  test("eine Flut falscher Ausweise sperrt nur die Flut: danach kommt der echte Ausweis herein, und der Owner meldet sich an", async () => {
    const falsch = { from: { slot: SITZ_A }, to: { slot: SITZ_B }, payload: text("Flut"), idempotencyKey: "fl" };
    const antworten = await Promise.all(Array.from({ length: FEHLVERSUCHE + 10 }, (_, i) =>
      b.call(door, { owner: false, body: falsch, headers: { authorization: `Bearer falsch-${i}` } })));
    expect(antworten.some((x) => x.status === 429)).toBe(true);
    expect(antworten.every((x) => x.status === 401 || x.status === 429)).toBe(true);
    // derselbe Ursprung (127.0.0.1), der echte Ausweis: herein, und die Nachricht liegt im Postfach
    const echt = await b.call(door, { owner: false, body: { ...falsch, payload: text("nach der Flut"), idempotencyKey: "fl-echt" }, headers: { authorization: `Bearer ${AUSWEIS_A_AN_B}` } });
    expect(echt.status).toBe(200);
    expect((await postfach(b, tokB)).some((m) => m.payload.text === "nach der Flut")).toBe(true);
    // und der Owner-Login dieser Fleet ist davon unberührt
    expect((await b.call("/api/sessions")).status).toBe(200);
  }, 30_000);

  test("was an der Bindung nicht stimmt, steht beim Start im Log, ohne den Ausweis", async () => {
    const fc = fixture();
    bindung(fc, [{ name: "a", url: a.url, ausweisAus: "offen.token", erlaubt: [] }], { "offen.token": AUSWEIS_B_AN_A });
    chmodSync(join(fc.state, "bindung", "secrets", "offen.token"), 0o644);
    const c = await serve(fc);
    try {
      const end = Date.now() + 5000;
      while (Date.now() < end && !c.log().includes("fernpost: binding problem")) await Bun.sleep(100);
      expect(c.log()).toContain("fernpost: binding problem — a.ausweisAus: secrets/offen.token is readable by group or others — chmod 600");
      expect(c.log().includes(AUSWEIS_B_AN_A)).toBe(false);
    } finally { await c.stop(); }
  }, 30_000);

  test("ein Versand an einen Nachbarn, den die Bindung ausließ, nennt den Grund", async () => {
    bindung(a.f, [], { "offen.token": AUSWEIS_A_AN_B });
    chmodSync(join(a.f.state, "bindung", "secrets", "offen.token"), 0o644);
    anB(b.url, "offen.token");
    try {
      const r = await a.call("/api/self/messages", { self: tokA, body: { to: { kind: "remote", fleet: "b", slot: SITZ_B }, payload: text("x"), idempotencyKey: "gr1" } });
      expect(r.status).toBe(409);
      expect(String(r.body.error)).toContain("b.ausweisAus: secrets/offen.token is readable by group or others — chmod 600");
      // ein Nachbar, der wegen eines doppelten Ausweises ganz herausfiel, ist kein „unbekannt“ ohne Grund
      bindung(a.f, [{ name: "b", url: b.url, ausweisAus: "an-b.token", ausweisEin: "an-b.token", erlaubt: [] }], {});
      const weg = await a.call("/api/self/messages", { self: tokA, body: { to: { kind: "remote", fleet: "b", slot: SITZ_B }, payload: text("x"), idempotencyKey: "gr2" } });
      expect(String(weg.body.error)).toContain('unknown neighbour fleet "b"');
      expect(String(weg.body.error)).toContain("b: ausweisAus and ausweisEin are the same badge");
    } finally { anB(b.url); }
  }, 30_000);

  test("eine Weiterleitung wird nicht verfolgt: der Ausweis geht nur an die url der Bindung", async () => {
    let gesehen = 0;
    const stub = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch() {
      gesehen++;
      return new Response(null, { status: 307, headers: { location: `${b.url}${door}` } });
    } });
    try {
      anB(`http://127.0.0.1:${stub.port}`);
      const r = await a.call("/api/self/messages", { self: tokA, body: { to: { kind: "remote", fleet: "b", slot: SITZ_B }, payload: text("umgeleitet"), idempotencyKey: "rd1" } });
      expect(r.status).toBe(502);
      expect(String(r.body.error)).toContain('neighbour "b" answered with a redirect — Fernpost follows none');
      expect(gesehen).toBe(1);
      expect((await postfach(b, tokB)).some((m) => m.payload.text === "umgeleitet")).toBe(false);
    } finally { stub.stop(true); anB(b.url); }
  }, 30_000);
});

describe("Fernpost: kein Schlüssel im Text", () => {
  // Pfade unter dem Zustand, ohne die Bindung: dort liegt der Ausweis absichtlich
  const dateien = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? (e.name === "bindung" ? [] : dateien(p)) : statSync(p).size < 20_000_000 ? [p] : [];
  });

  test("beide Ausweise stehen weder im Zustand noch im Postfach, noch in der Pane, noch im Log, noch in einer Antwort", async () => {
    const gesehen: string[] = [JSON.stringify((await a.call("/api/self/messages", { self: tokA })).body), JSON.stringify((await b.call("/api/self/messages", { self: tokB })).body),
      JSON.stringify((await a.call("/api/self/messages", { self: tokFremdA, body: { to: { kind: "remote", fleet: "b", slot: SITZ_B }, payload: text("noch einmal ungefragt"), idempotencyKey: "f9" } })).body),
      JSON.stringify((await b.call("/api/fleet-nachbar/messages", { owner: false, body: {}, headers: { authorization: `Bearer ${AUSWEIS_A_AN_B}x` } })).body)];
    for (const fl of [a, b]) {
      gesehen.push(fl.log());
      for (const p of dateien(fl.f.state)) gesehen.push(readFileSync(p, "latin1"));
    }
    for (const p of [getippt(a.f), getippt(b.f)]) if (existsSync(p)) gesehen.push(readFileSync(p, "latin1"));
    expect(gesehen.length).toBeGreaterThan(8);
    for (const stelle of gesehen) for (const ausweis of [AUSWEIS_A_AN_B, AUSWEIS_B_AN_A]) expect(stelle.includes(ausweis)).toBe(false);
  }, 30_000);

  test("auf dem Draht reisen der Ausweis im Authorization-Kopf und im Body nur Slots, Text und Schlüssel — nie ein Owner- oder Self-Token", async () => {
    const gefangen: { headers: Record<string, string>; body: string }[] = [];
    const stub = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(req) {
      gefangen.push({ headers: Object.fromEntries(req.headers), body: await req.text() });
      return Response.json({ ok: true, existing: false, holder: 9 });
    } });
    try {
      bindung(a.f, [{ name: "stub", url: `http://127.0.0.1:${stub.port}`, ausweisAus: "an-b.token", erlaubt: [] }], {});
      const r = await a.call("/api/self/messages", { self: tokA, body: { to: { kind: "remote", fleet: "stub", slot: 9 }, payload: text("Draht"), idempotencyKey: "d1" } });
      expect(r.status).toBe(200);
      expect(gefangen).toHaveLength(1);
      const [anfrage] = gefangen;
      expect(anfrage!.headers.authorization).toBe(`Bearer ${AUSWEIS_A_AN_B}`);
      expect(JSON.parse(anfrage!.body)).toEqual({ from: { slot: SITZ_A }, to: { slot: 9 }, payload: text("Draht"), idempotencyKey: "d1" });
      const alles = JSON.stringify(anfrage);
      for (const geheim of [a.f.token, tokA, tokFremdA]) expect(alles.includes(geheim)).toBe(false);
      expect(Object.values(anfrage!.headers).filter((v) => v.includes(AUSWEIS_A_AN_B))).toHaveLength(1);
    } finally { stub.stop(true); }
  }, 30_000);
});

describe("Fernpost: die Bindung weist ab, was kein Ausweis sein darf", () => {
  const frisch = (nachbarn: unknown, geheim: Record<string, [string, number]>) => {
    const dir = join(TMP, `bindung-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(dir, "secrets"), { recursive: true });
    for (const [name, [wert, mode]] of Object.entries(geheim)) { writeFileSync(join(dir, "secrets", name), wert); chmodSync(join(dir, "secrets", name), mode); }
    writeFileSync(join(dir, "nachbarn.json"), JSON.stringify({ nachbarn }));
    return dir;
  };
  const eintrag = { name: "b", url: "http://127.0.0.1:1", ausweisEin: "ein", ausweisAus: "aus", erlaubt: [] };

  test("eine Datei, die Gruppe oder Andere lesen dürfen, gilt nicht (chmod 600)", () => {
    const dir = frisch([eintrag], { ein: [AUSWEIS_B_AN_A, 0o644], aus: [AUSWEIS_A_AN_B, 0o600] });
    const r = ladeNachbarn([], dir);
    expect(r.nachbarn[0]).toMatchObject({ name: "b", ausweisEin: null, ausweisAus: AUSWEIS_A_AN_B });
    expect(r.probleme.join(" ")).toContain("chmod 600");
    expect(r.probleme.join(" ")).not.toContain(AUSWEIS_B_AN_A);
  });

  test("der Owner-Token und ein Self-Token sind kein Ausweis", () => {
    const dir = frisch([eintrag], { ein: ["owner-token-0123456789abcdef0123456789", 0o600], aus: ["self-token-0123456789abcdef0123456789ab", 0o600] });
    const r = ladeNachbarn(["owner-token-0123456789abcdef0123456789", "self-token-0123456789abcdef0123456789ab"], dir);
    expect(r.nachbarn[0]).toMatchObject({ ausweisEin: null, ausweisAus: null });
    expect(r.probleme).toHaveLength(2);
    expect(r.probleme.join(" ")).not.toContain("owner-token-0123");
  });

  test("ohne Datei hat die Fleet keine Nachbarn — und damit lässt sie niemanden herein", () => {
    expect(ladeNachbarn([], join(TMP, "gibt-es-nicht"))).toEqual({ nachbarn: [], probleme: [] });
  });
});
