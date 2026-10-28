// ZUSAGE (Owner 28.10., wörtlich: „[Zitat entfernt]“; „[Zitat entfernt]“):
// EIN stehendes Wort je Repo leistet an der Self-Tür, was ein „[Zitat entfernt]“ auf der Spitze leistet — der Sitz landet nach
// grünem Merge-Check, ohne dass der Owner jeden Stand einzeln ansieht. Diese Prüfung hält die drei Seiten fest:
// (a) Zusage aus und keine Spitzen-Markierung: 409, und der Satz nennt BEIDE Wege; (b) Zusage an und grüner Check:
// das Land geht durch und seine Land-Zeile sagt „Zusage“ statt „passt“; (c) Zusage an und KEIN grüner Check: 409.
// Dazu: nur die Owner-Tür setzt sie, sie überlebt einen Neustart, und GET /api/self/branch zeigt, worauf sie steht.
import { afterAll, describe, expect, test } from "bun:test";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Answer, branchTestkit, commitIn, type Fixture, get, LIFE_DEADLINE_MS, persisted, post, rowsOf, sh } from "./branches-testkit";
import { readZusagen, setZusage, zusageOn, zusageView } from "./land-zusage";

const { fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

const tokenOf = (f: Fixture, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
  if (!t) throw new Error(`kein Self-Token für Slot ${slot} in fleet.json`);
  return t;
};
const slotOf = (a: Answer | undefined): number => {
  const n = Number(a?.body.slot);
  if (a?.status !== 200 || !Number.isInteger(n)) throw new Error(`Öffnen schlug fehl: ${JSON.stringify(a)}`);
  return n;
};
const ownLand = (self: string, body: Record<string, unknown>) => ({ ...post("/api/self/branches/land", body), token: null, self });
const ownView = (self: string) => ({ ...get("/api/self/branch"), token: null, self });
const zusage = (repo: string, on: boolean) => post("/api/branches/zusage", { repo, zusage: on });

// ci/merge-check.ts as a stand-in: the test writes the verdict line as the real one would
function checkedFixture(): Fixture {
  const f = fixture();
  mkdirSync(join(f.repo, "ci"));
  writeFileSync(join(f.repo, "ci/merge-check.ts"), "// Attrappe: das Urteil schreibt der Test\n");
  sh(f.repo, "add", "ci/merge-check.ts");
  sh(f.repo, "commit", "-q", "-m", "merge-check");
  return f;
}
// a green merge check of the branch's tip against main, its candidate built commit by commit as ci/merge-check.ts does
function plantGreen(f: Fixture, branch: string, extra: Record<string, unknown> = {}): { tip: string; tree: string } {
  const tip = sh(f.repo, "rev-parse", branch), main = sh(f.repo, "rev-parse", "main");
  const commits = sh(f.repo, "rev-list", "--reverse", "--no-merges", tip, "^main").split("\n").filter(Boolean);
  let cur = main;
  for (const c of commits)
    cur = sh(f.repo, "commit-tree", sh(f.repo, "merge-tree", "--write-tree", "--merge-base", `${c}^`, cur, c).split("\n")[0]!, "-p", cur, "-m", "kandidat");
  const tree = sh(f.repo, "rev-parse", `${cur}^{tree}`);
  appendFileSync(join(sh(f.repo, "rev-parse", "--path-format=absolute", "--git-common-dir"), "merge-checks.jsonl"),
    `${JSON.stringify({ at: Date.now(), branch, base: "main", tip, main, candidate: cur, tree, commits, verdict: "green", mergeable: true, why: "main grün", ...extra })}\n`);
  return { tip, tree };
}

describe("Der Stand der Zusage: standardmäßig AUS, „aus“ nimmt den Eintrag ganz weg, ein kaputter fällt beim Laden heraus", () => {
  const REPO = "/w/ein/repo";
  test("leer ist aus; an setzt den Zeitpunkt; aus nimmt den Eintrag aus der Datei statt ihn mit altem Datum stehen zu lassen", () => {
    expect(zusageView({}, REPO)).toEqual({ on: false, at: null });
    expect(zusageOn({}, REPO)).toBe(false);
    const an = setZusage({}, REPO, true, 1000);
    expect(zusageView(an, REPO)).toEqual({ on: true, at: 1000 });
    expect(zusageOn(an, REPO)).toBe(true);
    expect(setZusage(an, REPO, false, 2000)).toEqual({});
  });
  test("fleet.json: nur ein Pfad mit lesbarem Zeitpunkt bleibt; alles andere wird genannt und fallen gelassen", () => {
    const ok = readZusagen({ [REPO]: { at: 5 } });
    expect(ok).toEqual({ zusagen: { [REPO]: { at: 5 } }, dropped: [] });
    expect(readZusagen({ rel: { at: 5 }, [REPO]: { at: "gestern" }, [REPO + "2"]: 3, [REPO + "3"]: { at: -1 } }))
      .toEqual({ zusagen: {}, dropped: ["rel", REPO, REPO + "2", REPO + "3"] });
    expect(readZusagen(null)).toEqual({ zusagen: {}, dropped: [] });
    expect(readZusagen([])).toEqual({ zusagen: {}, dropped: [] });
  });
});

describe("Die stehende Zusage eines Repos tritt an der Self-Tür an die Stelle des „passt“ je Spitze — und nur dort", () => {
  test("(c) ohne grünen Check bleibt die Tür zu, (b) mit ihr landet der Sitz und die Land-Zeile sagt „Zusage“, (a) ohne Zusage und ohne Markierung nennt der 409 beide Wege", async () => {
    const f = checkedFixture();
    const [made, opened] = await life(f, [post("/api/branches", { repo: f.repo, name: "Zusage" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/zusage" })]);
    const self = tokenOf(f, slotOf(opened));
    const path = String(made?.body.path);
    commitIn(path, "a.txt", "erste Arbeit");
    const main0 = sh(f.repo, "rev-parse", "main");

    // ein Sitz setzt die Zusage NICHT: sie ist das Wort des Owners, an seiner Tür
    const [noOwner] = await life(f, [{ ...zusage(f.repo, true), token: null, self }]);
    expect([401, 403]).toContain(noOwner?.status ?? 0);
    expect(persisted(f).landZusagen).toBeUndefined();

    // (c) ZUSAGE AN, ABER KEIN GRÜNER CHECK: die Zusage tritt an die Stelle des „passt“, nie an die des Checks
    const [set, ohneCheck, view] = await life(f, [zusage(f.repo, true), ownLand(self, { subject: "Zusage: ohne Check" }), ownView(self)]);
    expect(set).toMatchObject({ status: 200, body: { ok: true, repo: f.repo, zusage: { on: true } } });
    expect(typeof (set?.body.zusage as { at?: unknown })?.at).toBe("number");
    expect(ohneCheck?.status).toBe(409);
    expect(String(ohneCheck?.body.error)).toContain("kein Merge-Check");
    // die Zusage liegt in fleet.json — EIN Eintrag, unter dem Repo, und das nächste Leben liest sie wieder
    const stored = persisted(f).landZusagen as Record<string, { at?: unknown }> | undefined;
    expect(Object.keys(stored ?? {})).toHaveLength(1);
    expect(Object.keys(stored ?? {})[0]?.endsWith("/repo")).toBe(true);
    expect(typeof Object.values(stored ?? {})[0]?.at).toBe("number");
    // der Sitz sieht, worauf es steht — und der Stand überlebte den Neustart zwischen den beiden Leben
    expect(view?.body.zusage).toMatchObject({ on: true });
    expect(sh(f.repo, "rev-parse", "main")).toBe(main0);

    // (b) ZUSAGE AN UND GRÜNER CHECK: das Land geht durch, ohne ein „passt“ auf dieser Spitze
    const first = plantGreen(f, "branch/zusage");
    const view2 = ownView(self);
    const [landed, board, branch] = await life(f, [ownLand(self, { subject: "Zusage: erste Charge" }), get("/api/branches"), view2]);
    expect(landed).toMatchObject({ status: 200, body: { ok: true, main: "main", commits: 1, passt: false, zusage: true, checked: true } });
    expect(sh(f.repo, "rev-parse", "main^{tree}")).toBe(first.tree);
    expect(sh(f.repo, "log", "-1", "--format=%s", "main")).toBe("Zusage: erste Charge");
    // die Land-Zeile des Branches sagt, worauf das Land stand: auf der Zusage, nicht auf einem „passt“ dieser Spitze
    expect(rowsOf(board!, f.repo).branches.find((b) => b.branch === "branch/zusage")?.lands).toMatchObject([
      { subject: "Zusage: erste Charge", passt: false, zusage: true, checked: true }]);
    // …und der Commit auf main sagt es auch (dieses Fixture-Repo schreibt englisch, server/branch-land.ts#english)
    expect(sh(f.repo, "log", "-1", "--format=%b", "main")).toContain("standing word");
    expect(branch?.body.zusage).toMatchObject({ on: true });

    // (a) ZUSAGE AUS UND KEINE MARKIERUNG: 409, und der Satz nennt beide Wege — Spitze markieren oder Zusage setzen
    commitIn(path, "b.txt", "zweite Arbeit");
    plantGreen(f, "branch/zusage");
    const mainAfter = sh(f.repo, "rev-parse", "main");
    const [off, refused] = await life(f, [zusage(f.repo, false), ownLand(self, { subject: "Zusage: aus" })]);
    expect(off).toMatchObject({ status: 200, body: { ok: true, zusage: { on: false } } });
    expect(refused?.status).toBe(409);
    const said = String(refused?.body.error);
    expect(said).toContain("noch kein „passt“");
    expect(said).toContain("/api/branches/seen");
    expect(said).toContain("/api/branches/zusage");
    expect(sh(f.repo, "rev-parse", "main")).toBe(mainAfter);
  }, LIFE_DEADLINE_MS * 8);

  test("eine alte Spitzen-Markierung bleibt ein alter Stand: der 409 nennt beide Wege auch dann", async () => {
    const f = checkedFixture();
    const [made, opened] = await life(f, [post("/api/branches", { repo: f.repo, name: "Alt" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/alt" })]);
    const self = tokenOf(f, slotOf(opened));
    const path = String(made?.body.path);
    const first = commitIn(path, "a.txt", "erste Arbeit");
    const second = commitIn(path, "b.txt", "zweite Arbeit");
    const [, old] = await life(f, [post("/api/branches/seen", { repo: f.repo, branch: "branch/alt", head: first }),
      ownLand(self, { subject: "Alt: Charge" })]);
    expect(old?.status).toBe(409);
    const said = String(old?.body.error);
    expect(said).toContain(`„passt“ gilt ${first.slice(0, 8)}`);
    expect(said).toContain("/api/branches/seen");
    expect(said).toContain("/api/branches/zusage");
    expect(sh(f.repo, "rev-parse", "branch/alt")).toBe(second);
  }, LIFE_DEADLINE_MS * 3);
});
