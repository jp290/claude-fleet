// Prüf-Gedächtnis auf zwei Scratch-Instanzen und einem Bare-Hub im Temp-Ordner (kein echter Hub, keine Suite: der Audit-Befehl ist eine
// Attrappe, die ihre Läufe zählt). Die Regel: derselbe Baum wird über WH-Land und Hub-Push genau einmal voll auditiert, die
// zweite Fleet zeigt „geprüft am <Rechner>, <Tiefe>“, ein geänderter Baum läuft neu, ein rotes Siegel erfüllt nichts, dom bleibt die Lücke.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { branchTestkit, commitIn, get, LIFE_DEADLINE_MS, post, sh, type Fixture } from "./branches-testkit";
import { baumVon, geforderteUnits, plattformHier, schreibeSiegel } from "./pruef-siegel";

const { TMP, fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

let hubs = 0;
function neuerHub(): string {
  const hub = join(TMP, `hub${++hubs}.git`);
  mkdirSync(hub);
  sh(hub, "init", "-q", "--bare", "-b", "main");
  return hub;
}

// Die Attrappe der Suite: jeder Lauf hängt eine Zeile an LAUF (so zählt der Test die vollen Läufe) und legt ab, welche Units ihm erlassen
// wurden; `rot` lässt ihn mit FAIL enden. Das Ergebnis liest der Server wie das einer echten Suite (PASS-Zeilen, ALL PASS, Exit).
function attrappe(dir: string, rot = false): { cmd: string; laeufe: () => string[] } {
  const lauf = join(dir, "lauf.log");
  const cmd = rot ? `echo rot >> ${lauf}; echo "FAIL  eine Prüfung"; echo "1 FAILURE"; exit 1`
    : `echo "skip=$FLEET_E2E_SKIP_UNITS" >> ${lauf}; echo "PASS  eine Prüfung"; echo "ALL PASS"`;
  return { cmd, laeufe: () => (existsSync(lauf) ? readFileSync(lauf, "utf8").trim().split("\n").filter(Boolean) : []) };
}

function zweiFleets() {
  const hub = neuerHub();
  const wh = fixture(), mac = fixture();
  sh(wh.repo, "remote", "add", "hub", hub);
  sh(wh.repo, "push", "-q", "hub", "main");
  rmSync(mac.repo, { recursive: true, force: true });
  sh(TMP, "clone", "-q", "-o", "hub", hub, mac.repo);
  return { wh, mac, hub };
}
const umgebung = (f: Fixture, name: string, cmd: string): Record<string, string> => ({ FLEET_HUB_REMOTE: "hub", FLEET_REPO_DIR: f.repo,
  FLEET_MACHINE: name, FLEET_POSTLAND_AUDIT_CMD: cmd });
const reihe = (f: Fixture): string => join(f.state, "post-land-audits.jsonl");
// ein Land auf dieser Fleet; Antwort-Index 0 ist das Land, 1 die Frage nach dem Tip-Audit, 2 das Warten auf die Ledger-Zeile
async function landeUndAuditiere(f: Fixture, name: string, e: Record<string, string>, branch: string) {
  const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: branch })], e);
  commitIn(String(made?.body.path), `${branch}.txt`, branch);
  return life(f, [post("/api/branches/land", { repo: f.repo, branch: `branch/${branch}`, subject: branch, unchecked: true }),
    post("/api/repos/audit-tip", {}), { until: reihe(f), ms: 20_000 }, get("/api/post-land-audits")], e);
}

describe("derselbe Baum über WH-Land und Hub-Push, genau einmal voll auditiert", () => {
  test("die zweite Fleet reiht keinen Audit ein, sondern zeigt, wo geprüft wurde; ein geänderter Baum läuft neu", async () => {
    const { wh, mac, hub } = zweiFleets();
    const a = attrappe(wh.state);
    const eWh = umgebung(wh, "wh", a.cmd);
    const [landed, tipWh, , audits] = await landeUndAuditiere(wh, "wh", eWh, "gleicher-baum");
    expect(landed?.status).toBe(200);
    expect(tipWh?.body).toMatchObject({ queued: true });
    expect((audits?.body.audits as { result: string }[]).map((r) => r.result)).toEqual(["green"]);
    expect(a.laeufe()).toHaveLength(1);

    // der Hub-Push: die Branch-Land-Tür schiebt main nicht selbst (docs/packs/advanced-features.md), das tut der Owner; das Siegel schob
    // seinen Ref beim Schreiben. Auf dem Mac liegt nichts davon, bis er sync-t.
    sh(wh.repo, "push", "-q", "hub", "main");
    const tip = sh(wh.repo, "rev-parse", "main");
    expect(sh(hub, "rev-parse", "main")).toBe(tip);
    expect(sh(hub, "for-each-ref", "--format=%(refname)", "refs/notes/fleet/seal/")).toBe("refs/notes/fleet/seal/wh");
    sh(mac.repo, "fetch", "-q", "hub");
    sh(mac.repo, "merge", "-q", "--ff-only", "hub/main");
    const b = attrappe(mac.state);
    const eMac = umgebung(mac, "mac", b.cmd);
    const [tipMac] = await life(mac, [post("/api/repos/audit-tip", {})], eMac);
    expect(tipMac?.body).toMatchObject({ queued: false, state: "seen" });
    expect(String(tipMac?.body.why)).toContain("geprüft am wh, voller Audit");
    expect(tipMac?.body.audit).toMatchObject({ result: "green", quellen: [{ maschine: "wh", tiefe: "audit" }] });
    expect(b.laeufe()).toHaveLength(0);
    expect(a.laeufe()).toHaveLength(1);

    // ein geänderter Baum (ein Commit auf dem Mac) ist nicht geprüft und wird eingereiht
    commitIn(mac.repo, "neu.txt", "anderer baum");
    const [neu] = await life(mac, [post("/api/repos/audit-tip", {})], eMac);
    expect(neu?.body).toMatchObject({ queued: true, state: "unseen" });
  }, 4 * LIFE_DEADLINE_MS);

  test("ein rotes Siegel erfüllt nichts: die zweite Fleet reiht ihren eigenen Audit ein", async () => {
    const { wh, mac, hub } = zweiFleets();
    const a = attrappe(wh.state, true);
    const [, , , audits] = await landeUndAuditiere(wh, "wh", umgebung(wh, "wh", a.cmd), "rot");
    expect((audits?.body.audits as { result: string }[]).map((r) => r.result)).toEqual(["red"]);
    sh(mac.repo, "fetch", "-q", "hub");
    sh(mac.repo, "merge", "-q", "--ff-only", "hub/main");
    const [tipMac] = await life(mac, [post("/api/repos/audit-tip", {})], umgebung(mac, "mac", attrappe(mac.state).cmd));
    expect(tipMac?.body).toMatchObject({ queued: true, state: "unseen" });
  }, 3 * LIFE_DEADLINE_MS);
});

describe("der Audit fährt nur die Lücke", () => {
  // ein Merge-Check hat auf genau diesem Baum alle Units außer dom grün gefahren (sein Siegel liegt im Repo, wie ci/merge-check.ts es schreibt)
  async function mitCheckSiegel(units: string[]) {
    const f = fixture();
    sh(f.repo, "remote", "add", "hub", neuerHub());
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "luecke" })], {});
    commitIn(String(made?.body.path), "luecke.txt", "luecke");
    // der Baum, den main nach dem Land hat: der des Branch-Tips (ein Land ohne weitere Änderung auf main)
    const tree = (await baumVon(String(made?.body.path), "HEAD"))!;
    await schreibeSiegel(f.repo, { v: 1, tree, units, tiefe: "check", ergebnis: "green", maschine: "mac", plattform: plattformHier(),
      lauf: "1029-check", at: Date.now() - 60_000 }, "mac");
    return { f, tree };
  }
  test("alle Units außer dom gedeckt: der Audit läuft mit FLEET_E2E_SKIP_UNITS und fährt nur dom", async () => {
    const { f } = await mitCheckSiegel(geforderteUnits(["dom"]));
    const a = attrappe(f.state);
    const [, , , audits] = await life(f, [post("/api/branches/land", { repo: f.repo, branch: "branch/luecke", subject: "luecke", unchecked: true }),
      post("/api/repos/audit-tip", {}), { until: reihe(f), ms: 20_000 }, get("/api/post-land-audits")], umgebung(f, "wh", a.cmd));
    expect(a.laeufe()).toHaveLength(1);
    const skip = a.laeufe()[0]!.replace("skip=", "").split(",");
    expect(skip.sort()).toEqual(geforderteUnits(["dom"]).sort());
    expect(skip).not.toContain("dom");
    expect((audits?.body.audits as { quellen?: { maschine: string }[] }[])[0]?.quellen?.map((q) => q.maschine)).toEqual(["mac"]);
  }, 3 * LIFE_DEADLINE_MS);
  test("alle Units gedeckt: kein Lauf, die Zeile ist grün und nennt ihre Quelle", async () => {
    const { f } = await mitCheckSiegel(geforderteUnits());
    const a = attrappe(f.state);
    const [, , , audits] = await life(f, [post("/api/branches/land", { repo: f.repo, branch: "branch/luecke", subject: "luecke", unchecked: true }),
      post("/api/repos/audit-tip", {}), { until: reihe(f), ms: 20_000 }, get("/api/post-land-audits")], umgebung(f, "wh", a.cmd));
    expect(a.laeufe()).toHaveLength(0);
    const row = (audits?.body.audits as { result: string; quellen?: { maschine: string; lauf: string }[] }[])[0];
    expect(row?.result).toBe("green");
    expect(row?.quellen).toMatchObject([{ maschine: "mac", lauf: "1029-check" }]);
  }, 3 * LIFE_DEADLINE_MS);
});
