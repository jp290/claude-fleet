// W3b-Zusatz · DIE TESTINSTANZ ALS WERKZEUG DER ABNAHME (server/abnahme-instanz.ts): eine Instanz, die ein Sitz zur Abnahme hochfuhr, endet mit dem „passt“ auf
// ihren Branch oder dem Ende ihres Sitzes, im Takt geprüft (server.ts#abnahmeTick). Rein: welche fällig sind; am Server: der Takt räumt das Register und
// schreibt die Audit-Zeile, die Selbst-Tür nimmt nur den eigenen Baum. Eine echte Instanz fährt hier keine hoch (testinstanz.sh baut eine Kopie von Fleet).
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ABNAHME_DATEI, type AbnahmeInstanz, faellig, liesAbnahme, mitAbnahme, vonLebt, vonSitz } from "./abnahme-instanz";
import { branchTestkit, type Fixture, LIFE_DEADLINE_MS, persisted, post, sh } from "./branches-testkit";

const I = (path: string, branch: string | null, slot: number, at: number, start: string | null = "s1"): AbnahmeInstanz =>
  ({ path, repo: "/r", branch, von: { slot, openedAt: 100 }, at, start });

describe("welche Abnahme-Instanz fällig ist", () => {
  test("Sitz lebt und kein „passt“: bleibt; „passt“ nach dem Hochfahren: endet; „passt“ davor: bleibt; Sitz fort: endet", () => {
    const liste = [I("/a", "b1", 2, 1000), I("/b", "b2", 2, 1000), I("/c", "b3", 2, 1000), I("/d", "b1", 7, 1000), I("/e", null, 2, 1000)];
    const passt: Record<string, number> = { b2: 1500, b3: 900 };
    const due = faellig(liste, { lebt: (von) => von.slot === 2, passtSeit: (_r, b) => passt[b] ?? null, laeuft: () => "s1" });
    expect(due.map((d) => [d.instanz.path, d.grund])).toEqual([["/b", "passt"], ["/d", "sitz-ende"]]);
  });
  test("W3-3 · läuft dort keine Instanz mehr oder eine andere (anderer Start), fällt der Eintrag als „weg“, vor jedem anderen Grund — beendet wird dann nichts", () => {
    const liste = [I("/a", "b2", 2, 1000, "s1"), I("/b", "b2", 7, 1000, "s1"), I("/c", "b2", 2, 1000, null)];
    const laeuft: Record<string, string> = { "/b": "s9", "/c": "s1" };
    const due = faellig(liste, { lebt: (von) => von.slot === 2, passtSeit: () => 1500, laeuft: (p) => laeuft[p] ?? null });
    expect(due.map((d) => [d.instanz.path, d.grund])).toEqual([["/a", "weg"], ["/b", "weg"], ["/c", "weg"]]);
  });
  test("W3-4 · die Tür trägt die Linie des Sitzes ein, nicht die lineageId; mit Linie lebt der Sitz, solange die Linie lebt, ohne Linie nach Belegung", () => {
    const L = "a".repeat(24);
    // eine frische Öffnung: Linie ja, lineageId noch keine
    expect(vonSitz({ id: 2, openedAt: 100, linie: L, lineageId: null } as { id: number; openedAt: number; linie: string })).toEqual({ slot: 2, openedAt: 100, linie: L });
    expect(vonSitz({ id: 2, openedAt: 100, linie: null })).toEqual({ slot: 2, openedAt: 100 });
    const belegt = (n: number) => (n === 2 ? 200 : null);
    expect(vonLebt({ slot: 2, openedAt: 100, linie: L }, new Set([L]), belegt)).toBe(true);    // die Nachfolgerin trägt sie (andere Belegung)
    expect(vonLebt({ slot: 2, openedAt: 100, linie: L }, new Set(), belegt)).toBe(false);      // die Linie endete
    expect(vonLebt({ slot: 2, openedAt: 100 }, new Set(), belegt)).toBe(false);                // alter Eintrag: andere Belegung
    expect(vonLebt({ slot: 2, openedAt: 200 }, new Set(), belegt)).toBe(true);
  });
  test("eine neue Instanz desselben Worktrees ersetzt die alte", () => {
    expect(mitAbnahme([I("/a", "b1", 2, 1)], I("/a", "b1", 3, 2)).map((x) => x.von.slot)).toEqual([3]);
  });
});

const { fixture, life, serve, cleanup } = branchTestkit();
afterAll(cleanup);
const tokenOf = (f: Fixture, slot: number): string => String((persisted(f).slots as Record<string, { selfToken?: string }>)[String(slot)]?.selfToken);
const until = async (cond: () => boolean, ms: number): Promise<boolean> => {
  for (const ende = Date.now() + ms; Date.now() < ende; await Bun.sleep(100)) if (cond()) return true;
  return cond();
};

describe("der Takt beendet Abnahme-Instanzen, die Selbst-Tür nimmt nur den eigenen Baum", () => {
  test("eine Instanz eines Sitzes, der fort ist, geht sofort; die für das Kind der Leitung erst mit dem „passt“; ein Fremder fährt keine hoch", async () => {
    const f = fixture();
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Kind" }), post("/api/slots/2/open", { cwd: f.repo }),
      post("/api/slots/3/open", { cwd: f.repo }), post("/api/slots/2/rechte", { grant: ["branch.passt"] })]);
    const branch = String(made?.body.branch), path = String(made?.body.path);
    const [kindAuf] = await life(f, [{ ...post("/api/self/branches/open", { branch, goal: "Build." }), token: null, self: tokenOf(f, 2) }]);
    const kind = Number(kindAuf?.body.slot);
    const rec = (persisted(f).branches as { repo: string; branch: string }[]).find((b) => b.branch === branch)!;
    const lead = (persisted(f).slots as Record<string, { openedAt: number; lineageId?: string }>)["2"]!;
    // laufende Instanzen, wie testinstanz.sh sie in ihrem Zustand ablegt (pid lebt: die des Tests); C läuft mit einem anderen Start, D läuft nicht
    const ti = mkdtempSync(join(tmpdir(), "fleet-ti-"));
    const fort = join(f.state, "fort"), c = join(f.state, "c-wt"), dd = join(f.state, "d-wt");
    for (const [i, src, started] of [[1, path, "111"], [2, fort, "222"], [3, c, "333"]] as const) {
      mkdirSync(src, { recursive: true });
      mkdirSync(join(ti, `fleet-testinstanz-${i}`));
      writeFileSync(join(ti, `fleet-testinstanz-${i}`, "testinstanz.state"), `src=${src}\npid=${process.pid}\nstarted=${started}\n`);
    }
    mkdirSync(dd, { recursive: true });
    const von = { slot: 2, openedAt: lead.openedAt, ...(lead.lineageId ? { linie: lead.lineageId } : {}) };
    writeFileSync(join(f.state, ABNAHME_DATEI), JSON.stringify([
      { path, repo: rec.repo, branch, von, at: Date.now(), start: "111" },
      { path: fort, repo: rec.repo, branch: null, von: { slot: 9, openedAt: 1 }, at: Date.now(), start: "222" },
      { path: c, repo: rec.repo, branch, von, at: Date.now(), start: "999" },
      { path: dd, repo: rec.repo, branch, von, at: Date.now(), start: "444" }]));
    const srv = await serve(f, { FLEET_ABNAHME_TICK_MS: "200", FLEET_TI_ROOT: ti });
    try {
      expect(await until(() => liesAbnahme(f.state).length === 1, 5000)).toBe(true);
      expect(liesAbnahme(f.state)[0]?.path).toBe(path);
      const fremd = await srv.call("/api/self/testinstanz", { body: { action: "up", slot: kind }, self: tokenOf(f, 3) });
      const falsch = await srv.call("/api/self/testinstanz", { body: { action: "go" }, self: tokenOf(f, 2) });
      expect(fremd.status).toBe(409);
      expect(falsch.status).toBe(400);
      const passt = await srv.call(`/api/self/seats/${kind}/passt`, { body: { head: sh(f.repo, "rev-parse", branch) }, self: tokenOf(f, 2) });
      expect(passt.status).toBe(200);
      expect(await until(() => liesAbnahme(f.state).length === 0, 5000)).toBe(true);
      const ende = readFileSync(join(f.state, "audit.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>)
        .filter((r) => r.event === "abnahme_instanz_ended").map((r) => r.grund);
      expect(ende).toEqual(["sitz-ende", "passt"]);
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 8);

  // W3-4 (W3 Auftrag 7): die Instanz eines Prüfers hängt an seiner Linie (Slot.linie), nicht an seiner Belegung — sie lebt, solange er lebt, überlebt seine
  // Nachfolge und endet, wenn seine Linie endet
  test("die Instanz eines Prüfers lebt mit ihm, über seine Nachfolge weiter, und endet, wenn seine Linie endet", async () => {
    const f = fixture();
    await life(f, [post("/api/slots/2/open", { cwd: f.repo })]);
    await life(f, [post("/api/slots/2/rechte", { grant: ["text.handover"] })]);
    const sitz = () => (persisted(f).slots as Record<string, { openedAt: number; linie?: string }>)["2"]!;
    const vorher = sitz();
    expect(vorher.linie).toMatch(/^[0-9a-f]{24}$/);
    // die Instanz, wie die Tür sie beim Hochfahren einträgt (server/abnahme-instanz.ts#vonSitz), läuft
    const ti = mkdtempSync(join(tmpdir(), "fleet-ti-")), wt = join(f.state, "pruef-wt");
    mkdirSync(wt, { recursive: true });
    mkdirSync(join(ti, "fleet-testinstanz-1"));
    writeFileSync(join(ti, "fleet-testinstanz-1", "testinstanz.state"), `src=${wt}\npid=${process.pid}\nstarted=777\n`);
    writeFileSync(join(f.state, ABNAHME_DATEI), JSON.stringify([
      { path: wt, repo: f.repo, branch: null, von: { slot: 2, openedAt: vorher.openedAt, linie: vorher.linie }, at: Date.now(), start: "777" }]));
    const srv = await serve(f, { FLEET_ABNAHME_TICK_MS: "200", FLEET_TI_ROOT: ti, FLEET_FOUNDING_BOOT_GRACE_MS: "250", FLEET_READY_WAIT_MS: "500" });
    try {
      await Bun.sleep(1200);
      expect(liesAbnahme(f.state).map((x) => x.path)).toEqual([wt]);
      // seine Nachfolge: neue Belegung, dieselbe Linie — die Instanz bleibt
      expect((await srv.call("/api/self/succeed", { body: {}, self: tokenOf(f, 2) })).status).toBeLessThan(600);
      expect(await until(() => sitz().openedAt !== vorher.openedAt && sitz().linie === vorher.linie, 20_000)).toBe(true);
      await Bun.sleep(1200);
      expect(liesAbnahme(f.state).map((x) => x.path)).toEqual([wt]);
      // der Owner beendet den Platz: die Linie endet, die Instanz mit ihr
      expect((await srv.call("/api/slots/2/kill", { body: {} })).status).toBe(200);
      expect(await until(() => liesAbnahme(f.state).length === 0, 5000)).toBe(true);
      const ende = readFileSync(join(f.state, "audit.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>)
        .filter((r) => r.event === "abnahme_instanz_ended").map((r) => r.grund);
      expect(ende).toEqual(["sitz-ende"]);
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 8);
});
