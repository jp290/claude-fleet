// Die Historie gestarteter Sessions (Harness 2.0 Schritt 2, modell.md §4 Teil 1): jeder Start eine Zeile mit dem, was die Session bekam,
// neueste zuerst; ein Öffner, den die Tür nachträgt, steht am selben Eintrag.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { branchTestkit, get, LIFE_DEADLINE_MS, post } from "./branches-testkit";
import { SPEICHER_DATEI } from "../src/k15-speicher";
import { liesHistorie, merkeNachtrag, merkeStart, startHistorie } from "./start-historie";

const belegung = (id: number, openedAt: number, mehr: object = {}) => ({ id, openedAt, cwd: `/w/${id}`, label: null, harness: "claude", model: "claude-opus-5-5",
  effort: "high", rechte: null, agentMd: null, worktree: null, ...mehr });

describe("liesHistorie", () => {
  test("neueste zuerst, Öffner am richtigen Eintrag, eine freie Belegung schreibt nichts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "historie-"));
    await merkeStart(belegung(3, 100), dir, 1000);
    await merkeStart(belegung(4, 200, { agentMd: { profil: "planer", titel: "planer.md", text: "x", sha256: "ab" }, rechte: { stufe: "lesen", an: [], aus: [] } }), dir, 2000);
    await merkeStart({ ...belegung(5, 300), cwd: null }, dir, 3000);
    await merkeNachtrag(4, 200, { openedBy: { slot: 3, openedAt: 100, cwd: "/w/3" } }, dir);
    const h = await liesHistorie(dir);
    expect(h.map((e) => e.slot)).toEqual([4, 3]);
    expect(h[0]).toMatchObject({ at: 2000, profil: { id: "planer", titel: "planer.md", sha256: "ab" }, rechte: { stufe: "lesen" }, openedBy: { slot: 3 } });
    expect(h[1]).toMatchObject({ profil: null, openedBy: null, model: "claude-opus-5-5" });
  });
  test("ein Öffner für eine frühere Belegung desselben Slots hängt nicht an der neuen", async () => {
    const dir = mkdtempSync(join(tmpdir(), "historie-"));
    await merkeStart(belegung(4, 500), dir);
    await merkeNachtrag(4, 200, { openedBy: { slot: 3, openedAt: 100, cwd: "/w/3" } }, dir);
    expect((await liesHistorie(dir))[0]!.openedBy).toBeNull();
  });
  test("eine Branch-Session ohne Ziel trägt goal null", async () => {
    const dir = mkdtempSync(join(tmpdir(), "historie-"));
    await merkeStart(belegung(6, 600), dir);
    await merkeNachtrag(6, 600, { branch: "branch/x", repo: "/r" }, dir);
    expect((await liesHistorie(dir))[0]).toMatchObject({ branch: "branch/x", repo: "/r", goal: null });
  });
  test("die Route lehnt einen schiefen max ab und nimmt nur GET", async () => {
    const dir = mkdtempSync(join(tmpdir(), "historie-"));
    const frag = (q: string, method = "GET") => startHistorie(new Request(`http://x/api/k15/historie${q}`, { method }), new URL(`http://x/api/k15/historie${q}`), dir);
    expect((await frag("?max=0")).status).toBe(400);
    expect((await frag("?max=abc")).status).toBe(400);
    expect((await frag("", "POST")).status).toBe(405);
    expect(await (await frag("")).json()).toEqual({ starts: [] });
  });
});

const { fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

describe("jeder Start steht in der Historie", () => {
  test("zwei Starts über /open, einer mit Profil: beide in GET /api/k15/historie, neueste zuerst", async () => {
    const f = fixture();
    writeFileSync(join(f.state, SPEICHER_DATEI), JSON.stringify({ fassungen: [], packs: [], profile: [
      { id: "planer", rolle: "nur-ordner", schiene: "session", datei: { titel: "planer.md", v: 1, pfad: "x", abschnitte: [{ titel: "# Planer", text: "Ziel selten." }] } }] }));
    const [a, b, h] = await life(f, [post("/api/slots/1/open", { cwd: f.repo }), post("/api/slots/2/open", { cwd: f.repo, profil: "planer", rechte: { stufe: "lesen" } }),
      get("/api/k15/historie")]);
    expect([a?.status, b?.status]).toEqual([200, 200]);
    const starts = h?.body.starts as { slot: number; cwd: string; profil: { id: string } | null; rechte: { stufe: string } | null }[];
    expect(starts.map((x) => x.slot)).toEqual([2, 1]);
    expect(starts[0]).toMatchObject({ cwd: f.repo, profil: { id: "planer" }, rechte: { stufe: "lesen" } });
    expect(starts[1]).toMatchObject({ profil: null, rechte: null });
  }, LIFE_DEADLINE_MS);

  test("eine Branch-Session steht mit Branch und Ziel in der Historie, und „Erneut starten“ kommt durch die Branch-Tür", async () => {
    const f = fixture();
    const [made, opened, h, wieder] = await life(f, [post("/api/branches", { repo: f.repo, name: "Planer B" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/planer-b", goal: "Lies den Plan." }), get("/api/k15/historie"),
      post("/api/branches", { repo: f.repo, name: "Planer B", points: [], branch: "branch/planer-b" })]);
    expect([made?.status, opened?.status]).toEqual([201, 200]);
    const starts = h?.body.starts as { slot: number; branch: string | null; repo: string | null; goal: string | null }[];
    expect(starts[0]).toMatchObject({ slot: Number(opened?.body.slot), branch: "branch/planer-b", repo: f.repo, goal: "Lies den Plan." });
    expect(wieder?.status).toBeLessThan(300);
    expect(wieder?.body.branch).toBe("branch/planer-b");
  }, LIFE_DEADLINE_MS);
});
