// DIE LINIE EINES SITZES (Plan Dynamiken §6, Objekt 1, server/opener.ts): wer wen öffnete, hält Fleet als Linie, nicht als Platznummer.
// Die Nachfolgerin eines Kindes nennt in ihrer Zeile der Historie dieselbe Öffnerin und dasselbe Ziel; die Nachfolgerin einer Öffnerin behält
// ihre Kinder (Liste, Deckel, Ende); eine fremde Session, die danach im selben Platz und Ordner öffnet, ist nicht ihre Öffnerin.
// Jede Probe geht mit der Self-Token einer Session durch einen Server in eigenem Prozess (server/branches-testkit.ts); jedes `life` ist ein
// Neustart, die Linie kommt also auch über fleet.json zurück.
import { afterAll, describe, expect, test } from "bun:test";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { branchTestkit, get, LIFE_DEADLINE_MS, persisted, post, type Answer, type Fixture } from "./branches-testkit";

const { PROJECTS, fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

const tokenOf = (f: Fixture, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
  if (!t) throw new Error(`no self token for slot ${slot}`);
  return t;
};
const as = (self: string, step: { method: string; path: string; body?: unknown }) => ({ ...step, token: null, self });
const slotRow = (f: Fixture, slot: number): Record<string, any> => (persisted(f).slots as Record<string, Record<string, any>>)[String(slot)]!;
const wurzel = (f: Fixture): string => dirname(f.repo);
const ordner = (f: Fixture, name: string): string => { const d = join(wurzel(f), name); mkdirSync(d, { recursive: true }); return d; };
const OPEN = "/api/self/seats/open", SICHT = "/api/self/constellation", ROLES = "/api/self/roles";
const QUICK = { FLEET_FOUNDING_BOOT_GRACE_MS: "250", FLEET_READY_WAIT_MS: "500" };
type Zeile = { slot: number; openedAt: number; goal: string | null; openedBy: { slot: number; openedAt: number; cwd: string } | null };
const zeilen = (a: Answer | undefined): Zeile[] => (a?.body.starts as Zeile[] | undefined) ?? [];
const kinderIn = (a: Answer | undefined): number[] =>
  ((a?.body.seats as { slot: number | null; relations: string[]; state: string }[] | undefined) ?? [])
    .filter((x) => x.relations.includes("child") && x.state === "live").map((x) => Number(x.slot)).sort((a, b) => a - b);

describe("die Linie eines Sitzes", () => {
  test("nach der Nachfolge eines Kindes nennt die Zeile seiner Nachfolgerin dieselbe Öffnerin und dasselbe Ziel", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    await life(f, [post("/api/slots/1/open", { cwd: f.repo })], env);
    await life(f, [post("/api/slots/1/rechte", { grant: ["seat.open"] })], env);
    const [kind] = await life(f, [as(tokenOf(f, 1), post(OPEN, { cwd: ordner(f, "bau"), goal: "Baue die Linie.", label: "Bauer" }))], env);
    expect(kind?.status).toBe(200);
    const child = Number(kind?.body.slot), vorher = Number(kind?.body.openedAt);
    await life(f, [post(`/api/slots/${child}/rechte`, { grant: ["text.handover"] })], env);
    const [nachfolge] = await life(f, [as(tokenOf(f, child), post("/api/self/succeed", {}))], { ...env, ...QUICK });
    expect(nachfolge?.status).toBeLessThan(600);
    const nachher = slotRow(f, child).openedAt as number;
    expect(nachher).not.toBe(vorher);

    const [hist] = await life(f, [get("/api/k15/historie?max=60")], env);
    const zeileVon = (openedAt: number) => zeilen(hist).find((z) => z.slot === child && z.openedAt === openedAt);
    expect(zeileVon(vorher)).toMatchObject({ goal: "Baue die Linie.", openedBy: { slot: 1, cwd: f.repo } });
    expect(zeileVon(nachher)).toMatchObject({ goal: "Baue die Linie.", openedBy: { slot: 1, cwd: f.repo } });
    expect(zeileVon(nachher)?.openedBy).toEqual(zeileVon(vorher)?.openedBy);
  }, LIFE_DEADLINE_MS * 8);

  test("die Nachfolgerin der Öffnerin behält Liste, Deckel und Ende; eine fremde Session im selben Platz und Ordner beendet keines ihrer Kinder", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f), FLEET_SELF_SEAT_CAP: "2" };
    await life(f, [post("/api/slots/1/open", { cwd: f.repo })], env);
    await life(f, [post("/api/slots/1/rechte", { grant: ["seat.open", "text.handover"] })], env);
    const lead = tokenOf(f, 1);
    const [a, b] = await life(f, [as(lead, post(OPEN, { cwd: ordner(f, "a"), goal: "Eins." })), as(lead, post(OPEN, { cwd: ordner(f, "b"), goal: "Zwei." }))], env);
    expect([a?.status, b?.status]).toEqual([200, 200]);
    const A = Number(a?.body.slot), B = Number(b?.body.slot);

    // die Nachfolge der Öffnerin: dieselbe Linie, ein neuer Besetzer
    const vorher = slotRow(f, 1).openedAt;
    const [nachfolge] = await life(f, [as(lead, post("/api/self/succeed", {}))], { ...env, ...QUICK });
    expect(nachfolge?.status).toBeLessThan(600);
    expect(slotRow(f, 1).openedAt).not.toBe(vorher);
    const erbin = tokenOf(f, 1);
    expect(erbin).not.toBe(lead);
    const [liste, deckel, ende] = await life(f, [as(erbin, get(SICHT)), as(erbin, post(OPEN, { cwd: ordner(f, "c"), goal: "Drei." })),
      as(erbin, post(`/api/self/seats/${A}/end`, {}))], env);
    expect(kinderIn(liste)).toEqual([A, B].sort((x, y) => x - y));
    expect(deckel?.status).toBe(409);
    expect(String(deckel?.body.error)).toContain("FLEET_SELF_SEAT_CAP (2)");
    expect(ende?.status).toBe(200);

    // eine fremde Session: der Owner beendet die Linie im Platz 1 und öffnet dort neu, im selben Ordner — sie hat B nie geöffnet
    await life(f, [post("/api/slots/1/kill", {})], env);
    await life(f, [post("/api/slots/1/open", { cwd: f.repo })], env);
    await life(f, [post("/api/slots/1/rechte", { grant: ["seat.open"] })], env);
    const fremd = tokenOf(f, 1);
    expect(slotRow(f, 1).cwd).toBe(f.repo);
    const [nichtEnde] = await life(f, [as(fremd, post(`/api/self/seats/${B}/end`, {}))], env);
    expect(nichtEnde?.status).toBe(409);
    expect(String(nichtEnde?.body.error)).toContain(`you did not open slot ${B}`);
    expect(slotRow(f, B).cwd).toBeTruthy();
  }, LIFE_DEADLINE_MS * 14);
  test("ein Datensatz von vor der Linie lädt nach einem Neustart, findet seine Öffnerin und bekommt ihre Linie", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    await life(f, [post("/api/slots/1/open", { cwd: f.repo })], env);
    await life(f, [post("/api/slots/1/rechte", { grant: ["seat.open"] })], env);
    const [kind] = await life(f, [as(tokenOf(f, 1), post(OPEN, { cwd: ordner(f, "alt"), goal: "Alt." }))], env);
    const child = Number(kind?.body.slot);
    // der Zustand, wie ihn ein Fleet vor der Linie schrieb: kein Feld `linie`, weder am Platz noch im Datensatz der Öffnerin
    const datei = join(f.state, "fleet.json");
    const zustand = JSON.parse(readFileSync(datei, "utf8")) as { slots: Record<string, { linie?: string; openedBy?: { linie?: string } }> };
    for (const row of Object.values(zustand.slots)) { delete row.linie; delete row.openedBy?.linie; }
    writeFileSync(datei, JSON.stringify(zustand));
    const [ende] = await life(f, [as(tokenOf(f, 1), post(`/api/self/seats/${child}/end`, {}))], env);
    expect(ende?.status).toBe(200);
  }, LIFE_DEADLINE_MS * 6);
  // EINE WAHRHEIT ÜBER DIE LINIE (Orchestratorin 01.11., Weg a): auch das Postfach-Paar (sitzGegenseite, branchPeers), die Sicht (echtVon) und die
  // Bildnerin einer Rolle fragen die Linie. Die Fremde ist ein pi-Sitz: zwei Claude-Sitze schreiben sich seit dem 30.10. auch ohne Paar.
  test("die Nachfolgerin behält Paar, Sicht als child und ihre Rolle; eine fremde Session im selben Platz und Ordner verliert alle drei", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    await life(f, [post("/api/slots/1/open", { cwd: f.repo })], env);
    await life(f, [post("/api/slots/1/rechte", { grant: ["seat.open", "role.form", "text.handover"] })], env);
    const lead = tokenOf(f, 1);
    const [kind, , zweig, rolle] = await life(f, [as(lead, post(OPEN, { cwd: ordner(f, "kind"), goal: "Kind." })),
      post("/api/branches", { repo: f.repo, name: "Zweig" }), { ...post("/api/branches/open", { repo: f.repo, branch: "branch/zweig" }), self: lead },
      as(lead, post(ROLES, { name: "Prüfer", text: "Du prüfst." }))], env);
    expect([kind?.status, zweig?.status, rolle?.status]).toEqual([200, 200, 201]);
    const B = Number(kind?.body.slot);
    const C = Number(Object.entries(persisted(f).slots as Record<string, { label?: string }>).find(([, x]) => x.label === "Zweig")?.[0]);
    expect(Number.isInteger(C) && C !== B && C !== 1).toBe(true);
    const sende = (tok: string, slot: number, key: string) =>
      as(tok, post("/api/self/messages", { to: { kind: "session", slot }, payload: { kind: "text", text: "Hallo" }, idempotencyKey: key }));

    // die Nachfolgerin: dieselbe Linie
    const [nachfolge] = await life(f, [as(lead, post("/api/self/succeed", {}))], { ...env, ...QUICK });
    expect(nachfolge?.status).toBeLessThan(600);
    await life(f, [post("/api/slots/1/rechte", { grant: ["seat.open", "role.form"] })], env);
    const erbin = tokenOf(f, 1);
    const [sichtErbin, neuErbin] = await life(f, [as(erbin, get(SICHT)), as(erbin, post(ROLES, { name: "Prüfer", text: "Du prüfst genauer." }))], env);
    expect({ kinder: kinderIn(sichtErbin), rolle: neuErbin?.status }).toEqual({ kinder: [B, C].sort((x, y) => x - y), rolle: 201 });

    // die Fremde: der Owner beendet die Linie in Platz 1 und öffnet dort neu, im selben Ordner, als pi-Sitz
    await life(f, [post("/api/slots/1/kill", {})], env);
    const [neu] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, harness: "pi" })], env);
    expect(neu?.status).toBe(200);
    await life(f, [post("/api/slots/1/rechte", { grant: ["role.form"] })], env);
    const fremd = tokenOf(f, 1);
    expect(slotRow(f, 1).cwd).toBe(f.repo);
    const [sichtFremd, anB, anC, neuFremd] = await life(f, [as(fremd, get(SICHT)), sende(fremd, B, "f1"), sende(fremd, C, "f2"),
      as(fremd, post(ROLES, { name: "Prüfer", text: "Übernommen." }))], env);
    expect({ kinder: kinderIn(sichtFremd), anKind: anB?.status, anZweig: anC?.status, rolle: neuFremd?.status })
      .toEqual({ kinder: [], anKind: 409, anZweig: 409, rolle: 409 });
  }, LIFE_DEADLINE_MS * 14);

  // PRÜFUNG L1: eine Nachfolge, deren Öffnen nach dem Ende der Vorgängerin scheitert, wird zur Schuld; öffnet der Owner Platz und Ordner neu, übernimmt
  // die neue Belegung sie — und hängt jetzt auch wieder unter ihrer Öffnerin, mit Öffnerin und Ziel in ihrer Zeile der Historie.
  test("eine übernommene Nachfolge-Schuld bleibt das Kind ihrer Öffnerin und nennt Öffnerin und Ziel", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    const latch = join(wurzel(f), "respawn-faellt");
    writeFileSync(latch, "x");
    await life(f, [post("/api/slots/1/open", { cwd: f.repo })], env);
    await life(f, [post("/api/slots/1/rechte", { grant: ["seat.open"] })], env);
    const [kind] = await life(f, [as(tokenOf(f, 1), post(OPEN, { cwd: ordner(f, "bau"), goal: "Baue weiter.", label: "Bauer" }))], env);
    const child = Number(kind?.body.slot), dort = String(kind?.body.cwd);
    await life(f, [post(`/api/slots/${child}/rechte`, { grant: ["text.handover"] })], env);
    const [nachfolge] = await life(f, [as(tokenOf(f, child), post("/api/self/succeed", {}))],
      { ...env, ...QUICK, FLEET_TEST_SUCCESSION_RESPAWN_FAIL_LATCH: latch });
    expect(nachfolge?.status).toBeGreaterThanOrEqual(400);
    expect(slotRow(f, child)?.cwd ?? null).toBeNull();
    const [neu] = await life(f, [post(`/api/slots/${child}/open`, { cwd: dort, label: "Bauer" })], env);
    expect(neu?.status).toBe(200);
    const jetzt = slotRow(f, child).openedAt as number;
    const [hist, ende] = await life(f, [get("/api/k15/historie?max=60"), as(tokenOf(f, 1), post(`/api/self/seats/${child}/end`, {}))], env);
    expect(zeilen(hist).find((z) => z.slot === child && z.openedAt === jetzt)).toMatchObject({ goal: "Baue weiter.", openedBy: { slot: 1, cwd: f.repo } });
    expect(ende?.status).toBe(200);
  }, LIFE_DEADLINE_MS * 8);

  // PRÜFUNG L3 (i): eine Orchestratorin, die der Owner neu öffnet — hier in einem anderen Platz —, setzt die Linie der letzten fort und behält ihre
  // Kinder; eine frische andere Session im alten Platz und Ordner bekommt sie nicht.
  test("die Orchestratorin, die der Owner neu öffnet, behält ihre Kinder; eine frische Session im alten Platz nicht", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    await life(f, [post("/api/slots/9/open", { cwd: f.repo, label: "🎛 Orchestratorin" })], env);
    await life(f, [post("/api/slots/9/rechte", { grant: ["seat.open"] })], env);
    const [kind] = await life(f, [as(tokenOf(f, 9), post(OPEN, { cwd: ordner(f, "k"), goal: "Prüfe." }))], env);
    expect(kind?.status).toBe(200);
    const K = Number(kind?.body.slot);
    await life(f, [post("/api/slots/9/kill", {})], env);
    await life(f, [post("/api/slots/9/open", { cwd: f.repo })], env);
    await life(f, [post("/api/slots/9/rechte", { grant: ["seat.open"] })], env);
    const [frisch] = await life(f, [as(tokenOf(f, 9), post(`/api/self/seats/${K}/end`, {}))], env);
    const [orch] = await life(f, [post("/api/slots/8/open", { cwd: f.repo, label: "🎛 Orchestratorin" })], env);
    expect(orch?.status).toBe(200);
    await life(f, [post("/api/slots/8/rechte", { grant: ["seat.open"] })], env);
    const [ende] = await life(f, [as(tokenOf(f, 8), post(`/api/self/seats/${K}/end`, {}))], env);
    expect({ frisch: frisch?.status, orchestratorin: ende?.status }).toEqual({ frisch: 409, orchestratorin: 200 });
  }, LIFE_DEADLINE_MS * 10);

  // PRÜFUNG L3 (ii): ein Owner-Öffnen, das das Gespräch einer beendeten Belegung fortsetzt (resume), setzt ihre Linie fort und behält ihre Kinder
  test("ein Owner-Öffnen, das das Gespräch fortsetzt, behält die Kinder der beendeten Belegung", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    const [, lead] = await life(f, [post("/api/branches", { repo: f.repo, name: "Leitung" }), post("/api/branches/open", { repo: f.repo, branch: "branch/leitung" })], env);
    expect(lead?.status).toBe(200);
    const L = Number(Object.entries(persisted(f).slots as Record<string, { label?: string }>).find(([, x]) => x.label === "Leitung")?.[0]);
    const pfad = String(lead?.body.cwd), gespraech = String(slotRow(f, L).sessionId);
    await life(f, [post(`/api/slots/${L}/rechte`, { grant: ["seat.open"] })], env);
    const [kind] = await life(f, [as(tokenOf(f, L), post(OPEN, { cwd: ordner(f, "k"), goal: "Prüfe." }))], env);
    const K = Number(kind?.body.slot);
    await life(f, [post(`/api/slots/${L}/kill`, {})], env);
    // das Gespräch der Leitung liegt als Transkript im Worktree (der Ersatz-claude schreibt keines)
    const dir = join(PROJECTS, pfad.replace(/[^a-zA-Z0-9]/g, "-"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${gespraech}.jsonl`), "{}\n");
    const [wieder] = await life(f, [post("/api/branches/open", { repo: f.repo, branch: "branch/leitung" })], env);
    expect(wieder?.body.resumed).toBe(gespraech);
    const W = Number(Object.entries(persisted(f).slots as Record<string, { label?: string; cwd?: string }>).find(([, x]) => x.label === "Leitung" && x.cwd)?.[0]);
    await life(f, [post(`/api/slots/${W}/rechte`, { grant: ["seat.open"] })], env);
    const [ende] = await life(f, [as(tokenOf(f, W), post(`/api/self/seats/${K}/end`, {}))], env);
    expect(ende?.status).toBe(200);
  }, LIFE_DEADLINE_MS * 10);
  // PRÜFUNG RUNDE 2, N1 (a): die Nachfolge der Orchestratorin in Platz 1 scheitert; der Owner öffnet eine Orchestratorin in Platz 3, sie setzt die
  // Linie fort. Öffnet er danach Platz 1 neu, übernimmt die Belegung dort den Brief, aber nicht die Linie: sie lebt schon, zweimal gibt es sie nie.
  test("eine übernommene Schuld nimmt keine Linie, die schon ein lebender Sitz trägt", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    const latch = join(wurzel(f), "respawn-faellt");
    writeFileSync(latch, "x");
    const ORCH = "🎛 Orchestratorin";
    await life(f, [post("/api/slots/1/open", { cwd: f.repo, label: ORCH })], env);
    await life(f, [post("/api/slots/1/rechte", { grant: ["seat.open", "text.handover"] })], env);
    const [kind] = await life(f, [as(tokenOf(f, 1), post(OPEN, { cwd: ordner(f, "k"), goal: "Prüfe." }))], env);
    expect(kind?.status).toBe(200);
    const K = Number(kind?.body.slot);
    const [nachfolge] = await life(f, [as(tokenOf(f, 1), post("/api/self/succeed", {}))],
      { ...env, ...QUICK, FLEET_TEST_SUCCESSION_RESPAWN_FAIL_LATCH: latch });
    expect(nachfolge?.status).toBeGreaterThanOrEqual(400);
    const [drei] = await life(f, [post("/api/slots/3/open", { cwd: f.repo, label: ORCH })], env);
    expect(drei?.status).toBe(200);
    const [eins] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, label: ORCH })], env);
    expect(eins?.status).toBe(200);
    await life(f, [post("/api/slots/1/rechte", { grant: ["seat.open"] }), post("/api/slots/3/rechte", { grant: ["seat.open"] })], env);
    const [ausEins] = await life(f, [as(tokenOf(f, 1), post(`/api/self/seats/${K}/end`, {}))], env);
    const [ausDrei] = await life(f, [as(tokenOf(f, 3), post(`/api/self/seats/${K}/end`, {}))], env);
    expect({ platz1: ausEins?.status, platz3: ausDrei?.status }).toEqual({ platz1: 409, platz3: 200 });
  }, LIFE_DEADLINE_MS * 10);

  // PRÜFUNG RUNDE 2, N1 (b): im Fenster einer Nachfolge (die Vorgängerin ist weg, die Nachfolgerin noch nicht offen) öffnet der Owner eine
  // Orchestratorin in einem anderen Platz. Die Linie wird gerade weitergegeben: sie gehört der Nachfolgerin, die neue bekommt eine eigene.
  test("im Fenster einer Nachfolge nimmt keine Owner-Öffnung die Linie, die gerade weitergegeben wird", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    const gap = join(wurzel(f), "fenster");
    const ORCH = "🎛 Orchestratorin";
    await life(f, [post("/api/slots/9/open", { cwd: f.repo, label: ORCH })], env);
    await life(f, [post("/api/slots/9/rechte", { grant: ["seat.open", "text.handover"] })], env);
    const [kind] = await life(f, [as(tokenOf(f, 9), post(OPEN, { cwd: ordner(f, "k"), goal: "Prüfe." }))], env);
    expect(kind?.status).toBe(200);
    const K = Number(kind?.body.slot);
    const [nachfolge, erreicht, acht] = await life(f, [
      { background: as(tokenOf(f, 9), post("/api/self/succeed", {})) },
      { until: `${gap}.reached`, ms: 15_000 },
      post("/api/slots/8/open", { cwd: f.repo, label: ORCH }),
      { touch: `${gap}.release` }, "abwarten"], { ...env, ...QUICK, FLEET_TEST_SUCCESSION_GAP_LATCH: gap });
    // die Nachfolgerin steht in Platz 9 (ihr Brief bleibt als Schuld liegen, weil das Ersatz-claude des Testkits nicht als lebend gilt)
    expect({ erreicht: erreicht?.status, acht: acht?.status, nachfolgerin: nachfolge?.body.slot }).toEqual({ erreicht: 200, acht: 200, nachfolgerin: 9 });
    await life(f, [post("/api/slots/8/rechte", { grant: ["seat.open"] }), post("/api/slots/9/rechte", { grant: ["seat.open"] })], env);
    const [ausAcht] = await life(f, [as(tokenOf(f, 8), post(`/api/self/seats/${K}/end`, {}))], env);
    const [ausNeun] = await life(f, [as(tokenOf(f, 9), post(`/api/self/seats/${K}/end`, {}))], env);
    expect({ platz8: ausAcht?.status, nachfolgerin: ausNeun?.status }).toEqual({ platz8: 409, nachfolgerin: 200 });
  }, LIFE_DEADLINE_MS * 10);
  // PRÜFUNG RUNDE 3, R3-1: ein Neustart des Servers im Fenster einer Nachfolge. Simuliert so: im Fenster speichert der Server, der Test kopiert
  // fleet.json, die Nachfolge läuft zu Ende, danach liegt die Kopie wieder da — der Server war in diesem Augenblick beendet (die Pane lebt in tmux
  // weiter). Wer danach kommt, ist weiter die Öffnerin jedes Kindes.
  const imFenster = async (f: Fixture, latch: string, schritt: unknown, env: Record<string, string>): Promise<void> => {
    const marke = `${latch}.gespeichert`, kopie = join(wurzel(f), "fleet-im-fenster.json");
    const leben = life(f, [{ background: schritt }, { until: `${latch}.reached`, ms: 15_000 }, "save", { datei: marke, text: "x", ms: 0 }, "abwarten"], env);
    for (let t = 0; !existsSync(marke) && t < 600; t++) await Bun.sleep(25);
    expect(existsSync(marke)).toBe(true);
    copyFileSync(join(f.state, "fleet.json"), kopie);
    writeFileSync(`${latch}.release`, "");
    await leben;
    copyFileSync(kopie, join(f.state, "fleet.json"));
  };
  const ORCH = "🎛 Orchestratorin";

  test("R3-1 (a): ein Neustart, nachdem die Nachfolgerin der Orchestratorin offen ist, aber bevor ihr Öffnen zurückkam: sie ist die Öffnerin ihrer Kinder", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    await life(f, [post("/api/slots/9/open", { cwd: f.repo, label: ORCH })], env);
    await life(f, [post("/api/slots/9/rechte", { grant: ["seat.open", "text.handover"] })], env);
    const [kind] = await life(f, [as(tokenOf(f, 9), post(OPEN, { cwd: ordner(f, "k"), goal: "Prüfe." }))], env);
    expect(kind?.status).toBe(200);
    const K = Number(kind?.body.slot), vorher = slotRow(f, 9).openedAt as number;
    const latch = join(wurzel(f), "nach-dem-oeffnen");
    await imFenster(f, latch, as(tokenOf(f, 9), post("/api/self/succeed", {})), { ...env, ...QUICK, FLEET_TEST_SLOT_POST_CAPTURE_LATCH: latch });
    // das Fenster war das Öffnen der Nachfolgerin in Platz 9: ihre Pane stand, ihre Belegung lag schon in fleet.json
    expect(JSON.parse(readFileSync(`${latch}.reached`, "utf8")).slot).toBe(9);
    expect(slotRow(f, 9).openedAt).not.toBe(vorher);
    await life(f, [post("/api/slots/9/rechte", { grant: ["seat.open"] })], env);
    const [ende] = await life(f, [as(tokenOf(f, 9), post(`/api/self/seats/${K}/end`, {}))], env);
    expect(ende?.status).toBe(200);
  }, LIFE_DEADLINE_MS * 10);

  test("R3-1 (a): ein Neustart im selben Fenster der Nachfolge eines Kindes: die Nachfolgerin bleibt das Kind ihrer Öffnerin", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    await life(f, [post("/api/slots/9/open", { cwd: f.repo, label: ORCH })], env);
    await life(f, [post("/api/slots/9/rechte", { grant: ["seat.open"] })], env);
    const [kind] = await life(f, [as(tokenOf(f, 9), post(OPEN, { cwd: ordner(f, "k"), goal: "Prüfe." }))], env);
    expect(kind?.status).toBe(200);
    const K = Number(kind?.body.slot), vorher = Number(kind?.body.openedAt);
    await life(f, [post(`/api/slots/${K}/rechte`, { grant: ["text.handover"] })], env);
    const latch = join(wurzel(f), "kind-nach-dem-oeffnen");
    await imFenster(f, latch, as(tokenOf(f, K), post("/api/self/succeed", {})), { ...env, ...QUICK, FLEET_TEST_SLOT_POST_CAPTURE_LATCH: latch });
    expect(JSON.parse(readFileSync(`${latch}.reached`, "utf8")).slot).toBe(K);
    expect(slotRow(f, K).openedAt).not.toBe(vorher);
    const [ende] = await life(f, [as(tokenOf(f, 9), post(`/api/self/seats/${K}/end`, {}))], env);
    expect(ende?.status).toBe(200);
  }, LIFE_DEADLINE_MS * 10);

  test("R3-1 (b): ein Neustart nach dem Ende der Orchestratorin und vor dem Öffnen ihrer Nachfolgerin: die Orchestratorin, die der Owner öffnet, behält die Kinder", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    await life(f, [post("/api/slots/9/open", { cwd: f.repo, label: ORCH })], env);
    await life(f, [post("/api/slots/9/rechte", { grant: ["seat.open", "text.handover"] })], env);
    const [kind] = await life(f, [as(tokenOf(f, 9), post(OPEN, { cwd: ordner(f, "k"), goal: "Prüfe." }))], env);
    expect(kind?.status).toBe(200);
    const K = Number(kind?.body.slot);
    const latch = join(wurzel(f), "im-spalt");
    await imFenster(f, latch, as(tokenOf(f, 9), post("/api/self/succeed", {})), { ...env, ...QUICK, FLEET_TEST_SUCCESSION_GAP_LATCH: latch });
    expect(slotRow(f, 9)?.cwd ?? null).toBeNull();
    const [orch] = await life(f, [post("/api/slots/8/open", { cwd: f.repo, label: ORCH })], env);
    expect(orch?.status).toBe(200);
    await life(f, [post("/api/slots/8/rechte", { grant: ["seat.open"] })], env);
    const [ende] = await life(f, [as(tokenOf(f, 8), post(`/api/self/seats/${K}/end`, {}))], env);
    expect(ende?.status).toBe(200);
  }, LIFE_DEADLINE_MS * 10);
});
