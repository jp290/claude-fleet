// W3b · DAS „PASST“ ALS EIN OBJEKT (Owner 31.10.: „[Zitat entfernt]“): ein Sitz mit dem Recht branch.passt
// gibt es auf die Spitze des Branches eines Sitzes, den er geöffnet hat (POST /api/self/seats/<n>/passt); die Land-Tür der Session liest es, die Land-Zeile und
// die Audit-Zeile nennen, wessen es war, und ein späterer Commit macht es alt. Das „passt“ des Owners und die Zusage prüfen branch-land.test.ts und
// land-zusage.test.ts unverändert. main bewegt sich nur in Fixture-Repos.
import { afterAll, describe, expect, test } from "bun:test";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Answer, branchTestkit, commitIn, type Fixture, LIFE_DEADLINE_MS, persisted, post, sh } from "./branches-testkit";
import { LEAD_WITH_BUILDERS } from "./vorlagen";

const { fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

const tokenOf = (f: Fixture, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
  if (!t) throw new Error(`kein Self-Token für Slot ${slot}`);
  return t;
};
const slotOf = (a: Answer | undefined): number => {
  const n = Number(a?.body.slot);
  if (a?.status !== 200 || !Number.isInteger(n)) throw new Error(`Öffnen schlug fehl: ${JSON.stringify(a)}`);
  return n;
};
const als = (self: string, step: { method: string; path: string; body?: unknown }) => ({ ...step, token: null, self });
function checkedFixture(): Fixture {
  const f = fixture();
  mkdirSync(join(f.repo, "ci"));
  writeFileSync(join(f.repo, "ci/merge-check.ts"), "// Attrappe: das Urteil schreibt der Test\n");
  sh(f.repo, "add", "ci/merge-check.ts");
  sh(f.repo, "commit", "-q", "-m", "merge-check");
  return f;
}
// `base`: wogegen die Charge zählt — main vor dem ersten Land, danach die Spitze des letzten Lands (server/branches.ts#chargeBase)
function plantGreen(f: Fixture, branch: string, base = "main"): void {
  const tip = sh(f.repo, "rev-parse", branch), main = sh(f.repo, "rev-parse", "main");
  const commits = sh(f.repo, "rev-list", "--reverse", "--no-merges", tip, `^${base}`).split("\n").filter(Boolean);
  let cur = main;
  for (const c of commits)
    cur = sh(f.repo, "commit-tree", sh(f.repo, "merge-tree", "--write-tree", "--merge-base", `${c}^`, cur, c).split("\n")[0]!, "-p", cur, "-m", "kandidat");
  const tree = sh(f.repo, "rev-parse", `${cur}^{tree}`);
  appendFileSync(join(sh(f.repo, "rev-parse", "--path-format=absolute", "--git-common-dir"), "merge-checks.jsonl"),
    `${JSON.stringify({ at: Date.now(), branch, base: base === "main" ? "main" : sh(f.repo, "rev-parse", base), tip, main, candidate: cur, tree, commits, verdict: "green", mergeable: true, why: "main grün" })}\n`);
}
const auditZeilen = (f: Fixture, event: string): Record<string, unknown>[] =>
  readFileSync(join(f.state, "audit.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>).filter((r) => r.event === event);

describe("W3b · das „passt“ der Öffnerin auf die Spitze ihres Kindes", () => {
  test("ohne Recht 409 mit dem Rechtsnamen; ein Fremder 409; mit Recht passt → das Kind landet, Land-Zeile und Audit nennen die Öffnerin; ein neuer Commit macht es alt", async () => {
    const f = checkedFixture();
    const [made, , fremd] = await life(f, [post("/api/branches", { repo: f.repo, name: "Kind" }), post("/api/slots/2/open", { cwd: f.repo }),
      post("/api/slots/3/open", { cwd: f.repo })]);
    expect([made?.status, fremd?.status]).toEqual([201, 200]);
    const branch = String(made?.body.branch), path = String(made?.body.path);
    const leitung = tokenOf(f, 2), dritte = tokenOf(f, 3);
    const [kindAuf] = await life(f, [als(leitung, post("/api/self/branches/open", { branch, goal: "Build." }))]);
    const kind = slotOf(kindAuf), kindTok = tokenOf(f, kind);
    commitIn(path, "a.txt", "erste Arbeit");
    plantGreen(f, branch);
    // ohne „passt“: die Land-Tür nennt alle Wege, auch das Recht der Öffnerin
    const [ohne, ohneRecht] = await life(f, [als(kindTok, post("/api/self/branches/land", { subject: "ohne passt" })),
      als(leitung, post(`/api/self/seats/${kind}/passt`, {}))]);
    expect(ohne?.status).toBe(409);
    expect(String(ohne?.body.error)).toContain("branch.passt");
    expect(ohneRecht?.status).toBe(409);
    expect(ohneRecht?.body.missingRight).toBe("branch.passt");
    // der Owner vergibt das Recht der Leitung und einer dritten Sitzung, die das Kind nicht geöffnet hat
    await life(f, [post("/api/slots/2/rechte", { grant: ["branch.passt"] }), post("/api/slots/3/rechte", { grant: ["branch.passt"] })]);
    const tip = sh(f.repo, "rev-parse", branch);
    const [ohneHead, vonFremd, falscheSpitze, gegeben] = await life(f, [als(leitung, post(`/api/self/seats/${kind}/passt`, {})),
      als(dritte, post(`/api/self/seats/${kind}/passt`, { head: tip })),
      als(leitung, post(`/api/self/seats/${kind}/passt`, { head: "0".repeat(40) })), als(leitung, post(`/api/self/seats/${kind}/passt`, { head: tip }))]);
    // W3-2: ohne die Spitze, die sie ansah, gibt die Öffnerin kein „passt“
    expect(ohneHead?.status).toBe(400);
    expect(String(ohneHead?.body.error)).toContain("head");
    expect(vonFremd?.status).toBe(409);
    expect(String(vonFremd?.body.error)).toContain("did not open");
    expect(falscheSpitze?.status).toBe(409);
    expect(gegeben?.status).toBe(200);
    expect(gegeben?.body.head).toBe(tip);
    // ein Commit danach: das „passt“ ist alt
    commitIn(path, "b.txt", "noch etwas");
    plantGreen(f, branch);
    const [alt] = await life(f, [als(kindTok, post("/api/self/branches/land", { subject: "auf altem passt" }))]);
    expect(alt?.status).toBe(409);
    expect(String(alt?.body.error)).toContain("Slot 2");
    // passt auf die neue Spitze → das Kind landet
    const [neu] = await life(f, [als(leitung, post(`/api/self/seats/${kind}/passt`, { head: sh(f.repo, "rev-parse", branch) }))]);
    expect(neu?.status).toBe(200);
    const vorher = sh(f.repo, "rev-parse", "main");
    const [land] = await life(f, [als(kindTok, post("/api/self/branches/land", { subject: "auf dem passt der Leitung" }))]);
    expect(land?.status).toBe(200);
    expect(sh(f.repo, "rev-parse", "main")).not.toBe(vorher);
    expect((land?.body.passtVon as { slot: number }).slot).toBe(2);
    const rec = (persisted(f).branches as { branch: string; lands: { passt: boolean; passtVon?: { slot: number } }[] }[]).find((b) => b.branch === branch)!;
    expect(rec.lands.at(-1)?.passt).toBe(false);
    expect(rec.lands.at(-1)?.passtVon?.slot).toBe(2);
    const zeile = auditZeilen(f, "charge_land").at(-1);
    expect(zeile?.passt).toBe("seat 2");
    expect(zeile?.passtSlot).toBe(2);
    expect(auditZeilen(f, "branch_passt").length).toBe(2);
    // W3-1: gelten die Zusage des Repos und das „passt“ der Leitung beide, bleibt der Weg der Zusage (Zeile, Text, Audit), und die Zeile nennt das „passt“ dazu
    const zuletzt = sh(f.repo, "rev-parse", branch);
    commitIn(path, "c.txt", "dritte Arbeit");
    plantGreen(f, branch, zuletzt);
    const [zu, beide] = await life(f, [post("/api/branches/zusage", { repo: f.repo, zusage: true }),
      als(leitung, post(`/api/self/seats/${kind}/passt`, { head: sh(f.repo, "rev-parse", branch) }))]);
    expect([zu?.status, beide?.status]).toEqual([200, 200]);
    const [land2] = await life(f, [als(kindTok, post("/api/self/branches/land", { subject: "auf Zusage und passt" }))]);
    expect(land2?.status).toBe(200);
    expect(land2?.body.zusage).toBe(true);
    const rec2 = (persisted(f).branches as { branch: string; lands: { zusage?: boolean; passtVon?: { slot: number } }[] }[]).find((b) => b.branch === branch)!;
    expect(rec2.lands.at(-1)?.zusage).toBe(true);
    expect(rec2.lands.at(-1)?.passtVon?.slot).toBe(2);
    expect(sh(f.repo, "log", "-1", "--format=%B", "main")).toContain("standing word");
    expect(auditZeilen(f, "charge_land").at(-1)?.passt).toBe("zusage");
  }, LIFE_DEADLINE_MS * 12);

  test("die Vorlage „lead with builders“ erbittet branch.passt für die Leitung in derselben einen Freigabe wie ihre vier Rechte; nach ihr trägt die Leitung es, ein Bauer nicht", async () => {
    const f = fixture();
    const [vorschau, imp] = await life(f, [post("/api/setups/import", { vorlage: LEAD_WITH_BUILDERS }), post("/api/setups/import", { vorlage: LEAD_WITH_BUILDERS, schreiben: true })]);
    const erbeten = (vorschau?.body.vorschau as { requestedRights: { recht?: string[] }[] }).requestedRights;
    expect(erbeten.filter((r) => r.recht?.includes("branch.passt")).length).toBe(1);
    expect(erbeten.find((r) => r.recht?.includes("branch.passt"))?.recht).toEqual(["role.form", "setup.save", "setup.export", "setup.import", "branch.passt"]);
    const konst = (imp?.body.konstellation as { id: string }).id;
    const [frei, lead] = await life(f, [post("/api/k15/freigabe", { konst, pos: "lead" }), post("/api/slots/1/open", { sitz: `${konst}/lead`, cwd: f.repo })]);
    expect([frei?.status, lead?.status]).toEqual([200, 200]);
    const [ich] = await life(f, [als(tokenOf(f, 1), { method: "GET", path: "/api/self" })]);
    expect((ich?.body.rechte as { effective: string[] }).effective).toContain("branch.passt");
  }, LIFE_DEADLINE_MS * 6);
});
