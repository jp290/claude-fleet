// Der Lauf einer Konstellation (Harness 2.0 Schritt 4a, server/laeufe.ts): ein gestarteter Slot wird an einen Lauf auf der aktiven Fassung
// gebunden, eine weitere Position kommt in denselben Lauf, und der Slot trägt die Bindung im gespeicherten Zustand.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { branchTestkit, commitIn, get, LIFE_DEADLINE_MS, persisted, post } from "./branches-testkit";
import { FASSUNGEN_DATEI, fassungsHash } from "./konst-fassungen";
import { SPEICHER_DATEI } from "../src/k15-speicher";
import { BERICHTE_DATEI, laufErgebnis, laufGeladen, laufNachfolge, laufZu, liesLaeufe, liesLaufNachrichten, k15Laeufe, merkeLaufNachricht, nachrichtenDatei,
  type Binde, type LaufServer } from "./laeufe";
import { appendEvent, readEventLog } from "./persist";
import { liesHistorie, merkeNachtrag, merkeStart } from "./start-historie";

const PROTOKOLL = { ende: "Die CI des Repos ist grün.", runden: 3, regel: null };
const V1 = { id: "c1", name: "Bauer und Gegenspieler", version: 1, positionen: [{ id: "bauer" }] };
const V2 = { id: "c1", name: "Bauer und Gegenspieler", version: 2, protokoll: PROTOKOLL, positionen: [{ id: "bauer", name: "Bauer" }, { id: "gegen", name: "Gegenspieler", meldetAn: "bauer" }] };
const H1 = fassungsHash(V1), H2 = fassungsHash(V2);
const buch = (aktiv: string) => ({ c1: { aktiv, fassungen: [
  { hash: H1, at: 1, version: 1, name: V1.name, form: V1 }, { hash: H2, at: 2, version: 2, name: V2.name, form: V2 }] } });

describe("laufGeladen", () => {
  test("nur eine ganze Bindung", () => {
    expect(laufGeladen({ id: "l0123456789ab", pos: "bauer" })).toEqual({ id: "l0123456789ab", pos: "bauer" });
    expect(laufGeladen({ id: "x", pos: "bauer" })).toBeNull();
    expect(laufGeladen({ id: "l0123456789ab", pos: "" })).toBeNull();
    expect(laufGeladen(null)).toBeNull();
  });
});

const ohneServer = (binde: Binde = () => ({ openedAt: 50 }), mehr: Partial<LaufServer> = {}): LaufServer => ({ binde, loese: () => {}, commits: async () => [], ...mehr });
describe("die Route ohne Server", () => {
  const frag = (dir: string, body: unknown, binde: Binde = () => ({ openedAt: 50 })) =>
    k15Laeufe(new Request("http://x/api/k15/laeufe", { method: "POST", body: JSON.stringify(body) }), new URL("http://x/api/k15/laeufe"), ohneServer(binde), dir, () => 1000);
  test("ohne gespeicherte Fassung, mit fremder Position, mit leerem Slot, mit unbekanntem Lauf: abgelehnt, und nichts geschrieben", async () => {
    const dir = mkdtempSync(join(tmpdir(), "laeufe-"));
    expect((await frag(dir, { konst: "c1", pos: "bauer", slot: 1 })).status).toBe(404);
    writeFileSync(join(dir, FASSUNGEN_DATEI), JSON.stringify(buch(H2)));
    expect((await frag(dir, { konst: "c1", pos: "wer", slot: 1 })).status).toBe(400);
    expect((await frag(dir, { konst: "c1", pos: "bauer", slot: 1 }, () => null)).status).toBe(409);
    expect((await frag(dir, { konst: "c1", pos: "bauer", slot: 1, lauf: "l000000000000" })).status).toBe(404);
    expect((await frag(dir, { konst: "c1", pos: "bauer", slot: "1" })).status).toBe(400);
    expect(await liesLaeufe(dir)).toEqual([]);
  });
  test("ein neuer Lauf steht auf der Fassung, die gespeichert ist und gestartet wird, nicht auf dem Zeiger „aktiv“", async () => {
    const dir = mkdtempSync(join(tmpdir(), "laeufe-"));
    writeFileSync(join(dir, FASSUNGEN_DATEI), JSON.stringify(buch(H1)));
    writeFileSync(join(dir, SPEICHER_DATEI), JSON.stringify({ fassungen: [], packs: [], profile: [], konstellationen: [V2] }));
    const r = await frag(dir, { konst: "c1", pos: "gegen", slot: 1 });
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ lauf: { hash: H2, version: 2 } });
  });
  test("eine zweite Position kommt in denselben Lauf, auf dessen Fassung, auch wenn inzwischen eine andere aktiv ist", async () => {
    const dir = mkdtempSync(join(tmpdir(), "laeufe-"));
    writeFileSync(join(dir, FASSUNGEN_DATEI), JSON.stringify(buch(H2)));
    const r1 = await frag(dir, { konst: "c1", pos: "bauer", slot: 1, aufgabe: { ziel: "Schnitt 0" } });
    const id = ((await r1.json()) as { lauf: { id: string } }).lauf.id;
    writeFileSync(join(dir, FASSUNGEN_DATEI), JSON.stringify(buch(H1)));
    const r2 = await frag(dir, { konst: "c1", pos: "gegen", slot: 2, lauf: id });
    expect([r1.status, r2.status]).toEqual([201, 200]);
    expect(await liesLaeufe(dir)).toEqual([{ id, konst: "c1", hash: H2, name: "Bauer und Gegenspieler", version: 2, at: 1000,
      aufgabe: { ziel: "Schnitt 0" }, protokoll: PROTOKOLL, positionen: [{ pos: "bauer", slot: 1, openedAt: 50, at: 1000 }, { pos: "gegen", slot: 2, openedAt: 50, at: 1000 }], ende: null }]);
    expect((await frag(dir, { konst: "c1", pos: "gegen", slot: 2, lauf: id })).status).toBe(409);
    expect((await frag(dir, { konst: "c2", pos: "gegen", slot: 3, lauf: id })).status).toBe(409);
    expect((await frag(dir, { konst: "c1", pos: "gegen", slot: 3, lauf: id, aufgabe: { ziel: "x" } })).status).toBe(400);
  });
});

describe("eine Nachfolge im Lauf", () => {
  test("die Nachfolgerin kommt als Position mit ihrer Belegung dazu, und ihr Start steht mit dem Lauf in der Historie", async () => {
    const dir = mkdtempSync(join(tmpdir(), "laeufe-"));
    writeFileSync(join(dir, FASSUNGEN_DATEI), JSON.stringify(buch(H2)));
    const r = await k15Laeufe(new Request("http://x/api/k15/laeufe", { method: "POST", body: JSON.stringify({ konst: "c1", pos: "gegen", slot: 4 }) }),
      new URL("http://x/api/k15/laeufe"), ohneServer(() => ({ openedAt: 50, cwd: "/w/4", branch: "bau/x", repo: "/r" })), dir, () => 1000);
    const id = ((await r.json()) as { lauf: { id: string } }).lauf.id;
    await merkeStart({ id: 4, openedAt: 80, cwd: "/w/4", label: null, harness: "claude", model: null, effort: null, rechte: null, agentMd: null, worktree: null }, dir, 2000);
    await laufNachfolge({ id, pos: "gegen" }, 4, 80, 50, dir, 2000);
    const [l] = await liesLaeufe(dir);
    const ort = { cwd: "/w/4", branch: "bau/x", repo: "/r" };
    expect(l?.positionen).toEqual([{ pos: "gegen", slot: 4, openedAt: 50, at: 1000, ...ort }, { pos: "gegen", slot: 4, openedAt: 80, at: 2000, folgtAuf: 50, ...ort }]);
    expect((await liesHistorie(dir))[0]).toMatchObject({ openedAt: 80, lauf: { id, pos: "gegen", posName: "Gegenspieler", version: 2, hash: H2 } });
  });
});

describe("Ende und Ergebnis eines Laufs", () => {
  const route = (dir: string, pfad: string, server: LaufServer, method = "GET", body?: unknown) =>
    k15Laeufe(new Request(`http://x${pfad}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), new URL(`http://x${pfad}`), server, dir, () => 5000);
  async function zwei(dir: string, server: LaufServer): Promise<string> {
    writeFileSync(join(dir, FASSUNGEN_DATEI), JSON.stringify(buch(H2)));
    const r = await route(dir, "/api/k15/laeufe", server, "POST", { konst: "c1", pos: "bauer", slot: 1 });
    const id = ((await r.json()) as { lauf: { id: string } }).lauf.id;
    expect((await route(dir, "/api/k15/laeufe", server, "POST", { konst: "c1", pos: "gegen", slot: 2, lauf: id })).status).toBe(200);
    return id;
  }
  test("ein Lauf endet erst, wenn alle seine Sessions zu sind, mit der letzten; eine Nachfolge hält ihn offen", async () => {
    const dir = mkdtempSync(join(tmpdir(), "laeufe-"));
    const id = await zwei(dir, ohneServer());
    await laufZu({ id, pos: "bauer" }, 1, 50, dir, 6000);
    expect((await liesLaeufe(dir))[0]?.ende).toBeNull();
    await laufZu({ id, pos: "gegen" }, 2, 50, dir, 7000);
    await laufNachfolge({ id, pos: "gegen" }, 2, 90, 50, dir, 7100);
    expect((await liesLaeufe(dir))[0]?.ende).toBeNull();
    await laufZu({ id, pos: "gegen" }, 2, 90, dir, 8000);
    expect((await liesLaeufe(dir))[0]?.ende).toEqual({ at: 8000, wie: "zu" });
  });
  test("von Hand: der Lauf endet, seine Sessions werden frei, ein zweites Ende und eine neue Position werden abgelehnt", async () => {
    const dir = mkdtempSync(join(tmpdir(), "laeufe-"));
    const geloest: string[] = [];
    const server = ohneServer(undefined, { loese: (x) => { geloest.push(x); } });
    const id = await zwei(dir, server);
    const r = await route(dir, `/api/k15/laeufe/${id}/ende`, server, "POST");
    expect(r.status).toBe(200);
    expect(((await r.json()) as { lauf: { ende: unknown } }).lauf.ende).toEqual({ at: 5000, wie: "hand" });
    expect(geloest).toEqual([id]);
    expect((await route(dir, `/api/k15/laeufe/${id}/ende`, server, "POST")).status).toBe(409);
    expect((await route(dir, "/api/k15/laeufe", server, "POST", { konst: "c1", pos: "gegen", slot: 3, lauf: id })).status).toBe(409);
    expect((await route(dir, "/api/k15/laeufe/l000000000000/ende", server, "POST")).status).toBe(404);
    expect(geloest).toEqual([id]);
  });
  test("das Ergebnis: je Branch die Commits aus der Zeit des Laufs, die Reports seiner Sessions, die Endbedingung, die Zahl der Nachrichten", async () => {
    const dir = mkdtempSync(join(tmpdir(), "laeufe-"));
    const orte: Record<number, { cwd: string; branch: string | null; repo: string | null }> = { 1: { cwd: "/w/a", branch: "bau/a", repo: "/r" }, 2: { cwd: "/w/b", branch: null, repo: null } };
    const gefragt: string[] = [];
    const server = ohneServer((slot) => ({ openedAt: 50, ...orte[slot] }), { commits: async (repo, branch) => {
      gefragt.push(`${repo} ${branch}`);
      return [{ sha: "c3", at: 9000, subject: "nach dem Ende" }, { sha: "c2", at: 5500, subject: "im Lauf" }, { sha: "c1", at: 500, subject: "davor" }];
    } });
    // die Branch-Session (ohne Lane-Worktree) bekommt ihren Branch aus der Historie
    await merkeNachtrag(2, 50, { branch: "bau/b", repo: "/r", goal: "Gegenprobe zu S1" }, dir);
    await merkeStart({ id: 2, openedAt: 50, cwd: "/w/b", label: null, harness: "claude", model: null, effort: null, rechte: null, agentMd: null, worktree: null }, dir, 900);
    const id = await zwei(dir, server);
    await appendEvent(join(dir, BERICHTE_DATEI), { kind: "open", id: "r1", slot: 1, status: "done", text: "S1 gebaut", at: 5200 });
    await appendEvent(join(dir, BERICHTE_DATEI), { kind: "open", id: "r0", slot: 1, status: "done", text: "vor der Bindung", at: 3000 });
    await appendEvent(join(dir, BERICHTE_DATEI), { kind: "open", id: "r9", slot: 7, status: "done", text: "fremder Slot", at: 3000 });
    await merkeLaufNachricht([id], { id: "m1", at: 3100, from: null, to: null, text: "hallo", replyTo: null }, dir);
    await laufZu({ id, pos: "bauer" }, 1, 50, dir, 6000);
    await laufZu({ id, pos: "gegen" }, 2, 50, dir, 7000);
    const r = await route(dir, `/api/k15/laeufe/${id}/ergebnis`, server);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { ergebnis: unknown }).ergebnis).toEqual({ endbedingung: PROTOKOLL.ende, ende: { at: 7000, wie: "zu" }, nachrichten: 1, ohneBranch: [], ziele: [{ pos: "gegen", slot: 2, ziel: "Gegenprobe zu S1" }],
      branches: [{ branch: "bau/a", repo: "/r", positionen: ["bauer"], commits: [{ sha: "c2", at: 5500, subject: "im Lauf" }] },
        { branch: "bau/b", repo: "/r", positionen: ["gegen"], commits: [{ sha: "c2", at: 5500, subject: "im Lauf" }] }],
      reports: [{ id: "r1", at: 5200, slot: 1, pos: "bauer", status: "done", text: "S1 gebaut" }] });
    expect(gefragt.sort()).toEqual(["/r bau/a", "/r bau/b"]);
    expect(((await (await route(dir, `/api/k15/laeufe/${id}/ergebnis`, server)).json()) as { namen: unknown }).namen).toEqual({ bauer: "Bauer", gegen: "Gegenspieler" });
    const [l] = await liesLaeufe(dir);
    expect((await laufErgebnis({ ...l!, positionen: l!.positionen.map(({ branch: _b, ...p }) => p) }, server.commits, dir)).ohneBranch).toEqual([{ pos: "bauer", slot: 1 }, { pos: "gegen", slot: 2 }]);
  });
});

const { fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

describe("ein Lauf über den Server", () => {
  test("ein gestarteter Slot kommt in einen Lauf: der Slot trägt ihn gespeichert, die Slot-Liste zeigt ihn, die Historie auch", async () => {
    const f = fixture();
    writeFileSync(join(f.state, FASSUNGEN_DATEI), JSON.stringify(buch(H2)));
    const aufgabe = { ziel: "Schnitt 0 bauen", fertig: "der Gegenspieler bricht ihn nicht mehr" };
    const [a, b, neu, leer, liste, h, sessions] = await life(f, [post("/api/slots/1/open", { cwd: f.repo }), post("/api/slots/2/open", { cwd: f.repo }),
      post("/api/k15/laeufe", { konst: "c1", pos: "bauer", slot: 1, aufgabe }), post("/api/k15/laeufe", { konst: "c1", pos: "gegen", slot: 9 }),
      get("/api/k15/laeufe"), get("/api/k15/historie"), get("/api/sessions")]);
    expect([a?.status, b?.status, neu?.status, leer?.status]).toEqual([200, 200, 201, 409]);
    const lauf = neu?.body.lauf as { id: string };
    expect(lauf).toMatchObject({ konst: "c1", hash: H2, version: 2, aufgabe, protokoll: PROTOKOLL, positionen: [{ pos: "bauer", slot: 1 }] });
    expect((liste?.body.laeufe as { id: string }[]).map((x) => x.id)).toEqual([lauf.id]);
    const starts = h?.body.starts as { slot: number; lauf: object | null }[];
    expect(starts.find((x) => x.slot === 1)?.lauf).toEqual({ id: lauf.id, pos: "bauer", posName: "Bauer", konst: "c1", name: "Bauer und Gegenspieler", version: 2, hash: H2 });
    expect(starts.find((x) => x.slot === 2)?.lauf).toBeNull();
    const zeilen = sessions?.body.slots as { id: number; lauf?: unknown }[];
    expect(zeilen.find((x) => x.id === 1)?.lauf).toEqual({ id: lauf.id, pos: "bauer" });
    expect(zeilen.find((x) => x.id === 2)?.lauf).toBeUndefined();
    const slots = persisted(f).slots as Record<string, { lauf?: unknown }>;
    expect(slots["1"]?.lauf).toEqual({ id: lauf.id, pos: "bauer" });
    expect(slots["2"]?.lauf).toBeUndefined();
  }, LIFE_DEADLINE_MS);
});

describe("Ende und Ergebnis über den Server", () => {
  test("eine Branch-Session im Lauf: ihr Commit steht im Ergebnis, mit dem Schließen endet der Lauf, und ihr Slot trägt ihn nicht mehr", async () => {
    const f = fixture();
    writeFileSync(join(f.state, FASSUNGEN_DATEI), JSON.stringify(buch(H2)));
    // die Branch-Tür trägt den Branch nach dem Öffnen in die Historie nach; ein Schritt mehr, damit das Leben nicht vorher endet
    const [made, opened] = await life(f, [post("/api/branches", { repo: f.repo, name: "Bauer" }), post("/api/branches/open", { repo: f.repo, branch: "branch/bauer" }),
      get("/api/k15/historie")]);
    const S = Number(opened?.body.slot);
    const [bind] = await life(f, [post("/api/k15/laeufe", { konst: "c1", pos: "bauer", slot: S })]);
    const id = (bind?.body.lauf as { id: string }).id;
    const sha = commitIn(String(made?.body.path), "s1.txt", "S1 gebaut");
    // das Ende steht im Lauf, wenn die Tür des Schließens antwortet, auch wenn das Schreiben erst nach 400 ms durchkommt (branches.drive.ts, `rohr`)
    const [vorher, , zu, nachher, lauf] = await life(f, [get(`/api/k15/laeufe/${id}/ergebnis`), { rohr: "audit.jsonl", ms: 400 },
      post(`/api/slots/${S}/kill`, {}), get(`/api/k15/laeufe/${id}/ergebnis`), get(`/api/k15/laeufe/${id}`)]);
    expect([bind?.status, zu?.status]).toEqual([201, 200]);
    const e = vorher?.body.ergebnis as { ende: unknown; branches: unknown[] };
    expect(e.ende).toBeNull();
    expect(e.branches).toEqual([{ branch: "branch/bauer", repo: f.repo, positionen: ["bauer"], commits: [expect.objectContaining({ sha, subject: "S1 gebaut" })] }]);
    expect((nachher?.body.ergebnis as { ende: { wie: string } }).ende.wie).toBe("zu");
    expect((lauf?.body.lauf as { positionen: { zu?: number }[] }).positionen[0]?.zu).toEqual(expect.any(Number));
  }, LIFE_DEADLINE_MS * 3);
  test("hängt die Schreibkette, ohne je freizukommen: die Tür des Schließens antwortet nach der Grenze trotzdem, und der Slot ist danach leer", async () => {
    const f = fixture();
    writeFileSync(join(f.state, FASSUNGEN_DATEI), JSON.stringify(buch(H2)));
    const [, bind] = await life(f, [post("/api/slots/1/open", { cwd: f.repo }), post("/api/k15/laeufe", { konst: "c1", pos: "bauer", slot: 1 })]);
    expect(bind?.status).toBe(201);
    // die Röhre wird in diesem Leben nie gelesen (branches.drive.ts, `rohr`): ohne Grenze endete das Leben erst an seiner Frist
    const [, zu, sessions] = await life(f, [{ rohr: "audit.jsonl", ms: 10 * LIFE_DEADLINE_MS }, post("/api/slots/1/kill", {}), get("/api/sessions")]);
    expect(zu?.status).toBe(200);
    expect((sessions?.body.slots as { id: number; cwd?: string | null }[]).find((x) => x.id === 1)?.cwd ?? null).toBeNull();
  }, LIFE_DEADLINE_MS * 2);
  test("von Hand beendet: die Session läuft weiter, trägt den Lauf aber nicht mehr", async () => {
    const f = fixture();
    writeFileSync(join(f.state, FASSUNGEN_DATEI), JSON.stringify(buch(H2)));
    const [, bind] = await life(f, [post("/api/slots/1/open", { cwd: f.repo }), post("/api/k15/laeufe", { konst: "c1", pos: "bauer", slot: 1 })]);
    const id = (bind?.body.lauf as { id: string }).id;
    const [ende, sessions] = await life(f, [post(`/api/k15/laeufe/${id}/ende`, {}), get("/api/sessions")]);
    expect(ende?.status).toBe(200);
    const zeile = (sessions?.body.slots as { id: number; cwd?: string | null; lauf?: unknown }[]).find((x) => x.id === 1);
    expect(zeile?.cwd).toBe(f.repo);
    expect(zeile?.lauf).toBeUndefined();
    expect((persisted(f).slots as Record<string, { lauf?: unknown }>)["1"]?.lauf).toBeUndefined();
  }, LIFE_DEADLINE_MS * 2);
});

describe("eine Nachfolge im Lauf über den Server", () => {
  test("die succeed-Tür antwortet, wenn die Nachfolgerin im Lauf steht: der Lauf ist nicht zu Ende und hat ihre Position", async () => {
    const f = fixture();
    writeFileSync(join(f.state, FASSUNGEN_DATEI), JSON.stringify(buch(H2)));
    const [, bind] = await life(f, [post("/api/slots/1/open", { cwd: f.repo }), post("/api/k15/laeufe", { konst: "c1", pos: "bauer", slot: 1 })]);
    const id = (bind?.body.lauf as { id: string }).id;
    const slot = (persisted(f).slots as Record<string, { openedAt?: number; selfToken?: string }>)["1"];
    if (!slot?.openedAt || !slot.selfToken) throw new Error("Slot 1 ist in fleet.json nicht besetzt");
    // der Ersatz ist kein Agent: succeed endet als Schuld (500), nachdem die Nachfolgerin schon im Lauf steht (server/succession-rearm.test.ts)
    const QUICK = { FLEET_FOUNDING_BOOT_GRACE_MS: "250", FLEET_READY_WAIT_MS: "500" };
    // die Röhre hält erst das Schreiben nach dem Start der Nachfolgerin an, 1,5 s lang, kürzer als die Grenze; die Tür davor (Schließen der
    // Vorgängerin, Start) ist da schon durch, also bleibt nur das Schreiben der Nachfolge in der Kette hängen (branches.drive.ts, `rohr`)
    const [rohr, , lauf] = await life(f, [{ rohr: "audit.jsonl", ms: 1500, nach: '"event":"self_heal_recreate"' },
      { method: "POST", path: "/api/self/succeed", body: { intent: "weiter" }, token: null, self: slot.selfToken }, get(`/api/k15/laeufe/${id}`)], QUICK);
    expect(rohr?.body.gehalten).toBe(true);
    const l = lauf?.body.lauf as { ende: unknown; positionen: { pos: string; slot: number; openedAt: number; folgtAuf?: number }[] };
    expect(l.ende).toBeNull();
    expect(l.positionen.map((p) => [p.pos, p.slot, p.folgtAuf])).toEqual([["bauer", 1, undefined], ["bauer", 1, slot.openedAt]]);
  }, LIFE_DEADLINE_MS * 2);
});

describe("die Nachrichten eines Laufs", () => {
  const n = (i: number) => ({ id: `m${i}`, at: i, from: { kind: "session", slot: 1 }, to: { kind: "session", slot: 2 }, text: `Nachricht ${i}`, replyTo: null });
  test("gehen in die Datei je Lauf, einmal je Lauf, und nach der Obergrenze steht genau eine Zeile „gekappt“", async () => {
    const dir = mkdtempSync(join(tmpdir(), "laeufe-"));
    await Promise.all([1, 2, 3].map((i) => merkeLaufNachricht(["la", "la", "lb"], n(i), dir, 2)));
    await merkeLaufNachricht(["la"], n(4), dir, 2);
    const a = await liesLaufNachrichten(dir, "la"), b = await liesLaufNachrichten(dir, "lb");
    expect(a.nachrichten).toHaveLength(2);
    expect(a.gekappt).toBe(true);
    expect(b.nachrichten).toHaveLength(2);
    expect(b.gekappt).toBe(true);
    expect((await readEventLog(nachrichtenDatei(dir, "la"))).total).toBe(3);
  });
});

describe("eine Nachricht zwischen Sessions eines Laufs über den Server", () => {
  const tokenOf = (f: ReturnType<typeof fixture>, slot: number): string => {
    const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
    if (!t) throw new Error(`kein Self-Token für Slot ${slot}`);
    return t;
  };
  test("Öffner und Branch-Session im Lauf: die Nachricht steht im Ring und im Protokoll des Laufs", async () => {
    const f = fixture();
    writeFileSync(join(f.state, FASSUNGEN_DATEI), JSON.stringify(buch(H2)));
    const [, lead] = await life(f, [post("/api/branches", { repo: f.repo, name: "Leitung" }), post("/api/branches/open", { repo: f.repo, branch: "branch/leitung" })]);
    const L = Number(lead?.body.slot), leadTok = tokenOf(f, L);
    const [, strand, bind] = await life(f, [post("/api/branches", { repo: f.repo, name: "Strang" }),
      { ...post("/api/branches/open", { repo: f.repo, branch: "branch/strang" }), self: leadTok },
      post("/api/k15/laeufe", { konst: "c1", pos: "bauer", slot: L })]);
    const S = Number(strand?.body.slot), id = (bind?.body.lauf as { id: string }).id;
    // das Protokoll des Lauf steht, wenn die Tür antwortet, auch wenn das Schreiben erst nach 400 ms durchkommt (branches.drive.ts, `rohr`)
    const [, sent, prot] = await life(f, [{ rohr: "audit.jsonl", ms: 400 },
      { ...post("/api/self/messages", { to: { kind: "session", slot: S }, payload: { kind: "text", text: "Bitte S1 bauen." }, idempotencyKey: "a1" }), token: null, self: leadTok },
      get(`/api/k15/laeufe/${id}/nachrichten`)]);
    expect(sent?.status).toBe(200);
    const ring = (persisted(f).messages as { entries: { id: string }[] }).entries.map((m) => m.id);
    expect(ring).toContain((sent?.body.message as { id: string }).id);
    expect(prot?.body).toEqual({ gekappt: false, nachrichten: [expect.objectContaining({ id: (sent?.body.message as { id: string }).id, text: "Bitte S1 bauen.", from: { kind: "session", slot: L, openedAt: Number(lead?.body.openedAt) } })] });
  }, LIFE_DEADLINE_MS * 3);
});
