// Prüf-Gedächtnis auf zwei Scratch-Instanzen und einem Bare-Hub im Temp-Ordner (kein echter Hub, keine Suite: der Audit-Befehl ist eine
// Attrappe, die ihre Läufe zählt). Die Regel: derselbe Baum wird über WH-Land und Hub-Push genau einmal voll auditiert, die
// zweite Fleet zeigt „geprüft am <Rechner>, <Tiefe>“, ein geänderter Baum läuft neu, ein rotes Siegel erfüllt nichts, dom bleibt die Lücke.
import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { branchTestkit, commitIn, get, LIFE_DEADLINE_MS, post, sh, type Fixture } from "./branches-testkit";
import { baumVon, deckung, geforderteUnits, leseSiegel, plattformHier, pushSiegel, schreibeSiegel } from "./pruef-siegel";

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

describe("die Tür des Helfers rechnet bei voller Deckung ab", () => {
  // Eine Helfer-Bereitstellung wie die echte: das Land reiht ein, der lokale Drain wartet auf einen Helfer (FLEET_AUDIT_HELPER_GRACE_MS).
  // Der Helfer meldet sich an der Tür und will den Audit abholen; deckt ein Siegel den Baum für alles, was der Audit schuldet, gibt es nichts zu holen.
  test("volle Deckung: der Claim endet mit 409 „settled from the seals“, die Zeile steht grün mit ihrer Quelle, kein Lauf", async () => {
    const f = fixture();
    sh(f.repo, "remote", "add", "hub", neuerHub());
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "helfer" })], {});
    commitIn(String(made?.body.path), "helfer.txt", "helfer");
    const tree = (await baumVon(String(made?.body.path), "HEAD"))!;
    // ein Check hat alles außer dom gefahren; der Audit nach einem Deploy/audit-tip schuldet nur dies (auditScopeOf)
    await schreibeSiegel(f.repo, { v: 1, tree, units: geforderteUnits(["dom"]), tiefe: "check", ergebnis: "green", maschine: "mac",
      plattform: plattformHier(), lauf: "1029-check", at: Date.now() - 60_000 }, "mac");
    const a = attrappe(f.state);
    // die Uhr gibt sofort frei (quiet: ohne dom), der lokale Drain wartet auf einen Helfer
    const e = { ...umgebung(f, "wh", a.cmd), FLEET_AUDIT_HELPER_GRACE_MS: "60000", FLEET_AUDIT_QUIET_MS: "0", FLEET_AUDIT_QUIET_DAY: "" };
    const [landed, device, jobs, claim, , audits, after, deploys] = await life(f, [
      post("/api/branches/land", { repo: f.repo, branch: "branch/helfer", subject: "helfer", unchecked: true }),
      post("/api/helper/device", { deviceId: "testgeraet01", name: "testgeraet", features: ["audit-skip-units"] }),
      get("/api/helper/jobs?deviceId=testgeraet01"),
      post("/api/helper/claim", { jobId: "$2.jobs.0.id", deviceId: "testgeraet01" }),
      { until: reihe(f), ms: 5_000 },
      get("/api/post-land-audits"), get("/api/helper/jobs?deviceId=testgeraet01"), get("/api/deploys")], e);
    expect([landed?.status, device?.status]).toEqual([200, 200]);
    expect((jobs?.body.jobs as unknown[]).length).toBe(1);
    expect(claim?.status).toBe(409);
    expect(String(claim?.body.error)).toContain("settled from the seals");
    // die Zeile steht grün, ohne Lauf, mit ihrer Quelle; der Eintrag ist verbraucht, der Helfer findet nichts mehr
    const row = (audits?.body.audits as { result: string; quellen?: { maschine: string; lauf: string }[]; skipUnits?: string[] }[])[0];
    expect(row?.result).toBe("green");
    expect(row?.quellen).toMatchObject([{ maschine: "mac", lauf: "1029-check" }]);
    expect(a.laeufe()).toHaveLength(0);
    expect((after?.body.jobs as unknown[]).length).toBe(0);
    // F1: nach der Abrechnung läuft nichts mehr, und das Deploy-Tor sagt es auch (kein "a post-land audit is running")
    expect(deploys?.body.blocked).toBeNull();
  }, 3 * LIFE_DEADLINE_MS);
});

describe("die Tür des Helfers gibt bei teilweiser Deckung nur die Lücke zu fahren", () => {
  test("der Claim trägt skipUnits: dom (Auslöser) plus alles, was ein Siegel dieses Baums deckt; die Lücke bleibt draußen", async () => {
    const f = fixture();
    sh(f.repo, "remote", "add", "hub", neuerHub());
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "teilweise" })], {});
    commitIn(String(made?.body.path), "teilweise.txt", "teilweise");
    const tree = (await baumVon(String(made?.body.path), "HEAD"))!;
    await schreibeSiegel(f.repo, { v: 1, tree, units: geforderteUnits(["dom"]).filter((u) => u !== "lanes"), tiefe: "check", ergebnis: "green",
      maschine: "mac", plattform: plattformHier(), lauf: "1029-check", at: Date.now() - 60_000 }, "mac");
    const e = { ...umgebung(f, "wh", attrappe(f.state).cmd), FLEET_AUDIT_HELPER_GRACE_MS: "60000", FLEET_AUDIT_QUIET_MS: "0", FLEET_AUDIT_QUIET_DAY: "" };
    const [, , jobs, claim] = await life(f, [
      post("/api/branches/land", { repo: f.repo, branch: "branch/teilweise", subject: "teilweise", unchecked: true }),
      post("/api/helper/device", { deviceId: "testgeraet02", name: "testgeraet", features: ["audit-skip-units"] }),
      get("/api/helper/jobs?deviceId=testgeraet02"),
      post("/api/helper/claim", { jobId: "$2.jobs.0.id", deviceId: "testgeraet02" })], e);
    expect((jobs?.body.jobs as unknown[]).length).toBe(1);
    expect(claim?.status).toBe(200);
    const skip = (claim?.body.job as { skipUnits: string[] }).skipUnits;
    expect(skip).toContain("dom");
    expect(skip).toContain("core");
    expect(skip).not.toContain("lanes");
    expect([...skip].sort()).toEqual([...geforderteUnits(["lanes"])].sort());
  }, 3 * LIFE_DEADLINE_MS);
});

// Ein Helfer-Fixture: ein Check-Siegel des Macs deckt alles außer dom und `lanes`; das Land reiht einen Audit ein, den die Uhr sofort freigibt (quiet),
// der lokale Drain wartet auf einen Helfer. Gibt Repo, Baum und die Umgebung zurück.
async function helferFixture(name: string, extra: Record<string, string> = {}, deckt = geforderteUnits(["dom"]).filter((u) => u !== "lanes")) {
  const f = fixture();
  sh(f.repo, "remote", "add", "hub", neuerHub());
  const [made] = await life(f, [post("/api/branches", { repo: f.repo, name })], {});
  commitIn(String(made?.body.path), `${name}.txt`, name);
  const tree = (await baumVon(String(made?.body.path), "HEAD"))!;
  await schreibeSiegel(f.repo, { v: 1, tree, units: deckt, tiefe: "check", ergebnis: "green", maschine: "mac", plattform: plattformHier(),
    lauf: "1029-check", at: Date.now() - 60_000 }, "mac");
  const e = { ...umgebung(f, "wh", attrappe(f.state).cmd), FLEET_AUDIT_HELPER_GRACE_MS: "60000", FLEET_AUDIT_QUIET_MS: "0", FLEET_AUDIT_QUIET_DAY: "", ...extra };
  const land = post("/api/branches/land", { repo: f.repo, branch: `branch/${name}`, subject: name, unchecked: true });
  return { f, tree, e, land };
}
const GRUEN = "PASS  eine Prüfung\nALL PASS";

describe("das Siegel aus der Ergebniszeile eines Helfers", () => {
  test("der Helfer meldet grün: das Siegel trägt die Units, die sein Job fuhr (die Lücke), unter dem Namen des Geräts, und schließt die Deckung", async () => {
    const { f, tree, e, land } = await helferFixture("ergebnis");
    const dev = { deviceId: "testgeraet03", name: "testgeraet", features: ["audit-skip-units"] };
    const [, , jobs, claim, result, , audits] = await life(f, [land, post("/api/helper/device", dev), get("/api/helper/jobs?deviceId=testgeraet03"),
      post("/api/helper/claim", { jobId: "$2.jobs.0.id", deviceId: dev.deviceId }),
      post("/api/helper/result", { jobId: "$2.jobs.0.id", exitCode: 0, tail: GRUEN }),
      { until: reihe(f), ms: 5_000 }, get("/api/post-land-audits")], e);
    expect([claim?.status, result?.status]).toEqual([200, 200]);
    const skip = (claim?.body.job as { skipUnits: string[] }).skipUnits;
    expect(skip).not.toContain("lanes");
    const row = (audits?.body.audits as { result: string; skipUnits?: string[]; quellen?: { maschine: string }[] }[])[0];
    expect(row).toMatchObject({ result: "green", quellen: [{ maschine: "mac" }] });
    // das Siegel dieses Laufs: genau die Lücke (lanes), vom Gerät, als Audit; zusammen mit dem Check ist alles außer dom gedeckt
    const siegel = (await leseSiegel(f.repo, tree)).filter((x) => x.tiefe === "audit");
    expect(siegel).toHaveLength(1);
    expect(siegel[0]).toMatchObject({ ergebnis: "green", maschine: "testgeraet", units: ["lanes"] });
    expect(siegel[0]!.lauf).toMatch(/^helper-/);
    expect(deckung(await leseSiegel(f.repo, tree), geforderteUnits(["dom"])).luecke).toEqual([]);
    expect(jobs?.status).toBe(200);
  }, 3 * LIFE_DEADLINE_MS);

  test("der Helfer meldet rot: das rote Siegel steht da und deckt nichts, die Lücke bleibt offen", async () => {
    const { f, tree, e, land } = await helferFixture("rotergebnis");
    const dev = { deviceId: "testgeraet04", name: "testgeraet", features: ["audit-skip-units"] };
    await life(f, [land, post("/api/helper/device", dev), get("/api/helper/jobs?deviceId=testgeraet04"),
      post("/api/helper/claim", { jobId: "$2.jobs.0.id", deviceId: dev.deviceId }),
      post("/api/helper/result", { jobId: "$2.jobs.0.id", exitCode: 1, tail: "FAIL  eine Prüfung\n1 FAILURE", fails: ["eine Prüfung"] }),
      { until: reihe(f), ms: 5_000 }], e);
    const alle = await leseSiegel(f.repo, tree);
    expect(alle.filter((x) => x.tiefe === "audit").map((x) => x.ergebnis)).toEqual(["red"]);
    expect(deckung(alle, geforderteUnits(["dom"])).luecke).toEqual(["lanes"]);
  }, 3 * LIFE_DEADLINE_MS);
});

describe("F5: kein Siegel auf dem falschen Baum, und eine Abrechnung führt nie eine Suite aus", () => {
  test("ein Helfer, der einen anderen Commit fuhr (clonedSha), siegelt nicht; der Lauf mit passendem clonedSha siegelt", async () => {
    const dev = { deviceId: "testgeraet07", name: "testgeraet", features: ["audit-skip-units"] };
    const lauf = async (name: string, clonedSha: string) => {
      const { f, tree, e, land } = await helferFixture(name);
      const r = await life(f, [land, post("/api/helper/device", dev), get("/api/helper/jobs?deviceId=testgeraet07"),
        post("/api/helper/claim", { jobId: "$2.jobs.0.id", deviceId: dev.deviceId }),
        post("/api/helper/result", { jobId: "$2.jobs.0.id", exitCode: 0, tail: GRUEN, clonedSha }),
        { until: reihe(f), ms: 5_000 }], e);
      expect(r.slice(0, 5).map((x) => x.status)).toEqual([200, 200, 200, 200, 200]); // Land, Gerät, Jobs, Claim, Ergebnis
      return (await leseSiegel(f.repo, tree)).filter((x) => x.tiefe === "audit");
    };
    expect(await lauf("fremdsha", "a".repeat(40))).toHaveLength(0);
    expect(await lauf("gleichsha", "$0.sha")).toHaveLength(1);
  }, 5 * LIFE_DEADLINE_MS);

  test("bewegt ein Land main zwischen Prüfung und Lauf auf einen anderen Baum, rechnet die Abrechnung nicht ab und fährt keine Suite", async () => {
    const { f, e, land } = await helferFixture("beweglich", {}, geforderteUnits(["dom"]));
    const a = attrappe(f.state);
    const [, abgerechnet, audits] = await life(f, [land,
      { abrechnen: { repo: f.repo, trigger: "quiet", bewege: { datei: "land-dazwischen.txt", text: "ein anderer Baum\n" } } },
      get("/api/post-land-audits")], e);
    expect(abgerechnet?.body.abgerechnet).toBe(false);
    expect(a.laeufe()).toHaveLength(0);
    expect(audits?.body.audits).toEqual([]);
    expect((audits?.body.pending as { covers: number }[])[0]?.covers).toBe(1);
  }, 3 * LIFE_DEADLINE_MS);
});

describe("F7: eine zusammengesetzte Zeile ohne Lauf bewegt die Ruhe-Uhr nicht", () => {
  test("nach einer Abrechnung aus Siegeln wartet das nächste Land seine eigene Ruhezeit ab, nicht eine ab der Abrechnung", async () => {
    const QUIET = 3_600_000;
    const { f, e, land } = await helferFixture("uhr", { FLEET_AUDIT_QUIET_MS: String(QUIET) }, geforderteUnits(["dom"]));
    const [made2] = await life(f, [post("/api/branches", { repo: f.repo, name: "uhr-zwei" })], {});
    commitIn(String(made2?.body.path), "uhr-zwei.txt", "uhr-zwei");
    const [, , abgerechnet, landed2, audits] = await life(f, [land, { until: join(f.state, "post-land-audit-queue.json"), ms: 3_000 },
      { abrechnen: { repo: f.repo, trigger: "quiet" } },
      post("/api/branches/land", { repo: f.repo, branch: "branch/uhr-zwei", subject: "uhr-zwei", unchecked: true }),
      get("/api/post-land-audits")], e);
    expect(abgerechnet?.body.abgerechnet).toBe(true);
    expect(landed2?.status).toBe(200);
    expect((audits?.body.audits as { quellen?: unknown[] }[]).length).toBe(1);
    const pending = (audits?.body.pending as { oldestAt: number; releaseAt: number }[])[0]!;
    // ohne die Zeile als „letzte volle Prüfung“ zählt die Ruhezeit ab dem ältesten wartenden Land, genau eine Ruhezeit
    expect(pending.releaseAt - pending.oldestAt).toBe(QUIET);
  }, 3 * LIFE_DEADLINE_MS);
});

describe("F4: der Siegel-Push hält die Antwort an den Helfer nicht auf", () => {
  test("ein Hub, der den Push 20 s festhält: die Ergebniszeile steht, die Antwort kommt nach höchstens 3 s Push-Wartezeit, das Siegel liegt lokal", async () => {
    const { f, tree, e, land } = await helferFixture("langsamerhub");
    const hub = sh(f.repo, "remote", "get-url", "hub");
    writeFileSync(join(hub, "hooks", "pre-receive"), "#!/bin/sh\nsleep 20\n");
    chmodSync(join(hub, "hooks", "pre-receive"), 0o755);
    const dev = { deviceId: "testgeraet06", name: "testgeraet", features: ["audit-skip-units"] };
    const t0 = Date.now();
    const [, , , , result, , audits] = await life(f, [land, post("/api/helper/device", dev), get("/api/helper/jobs?deviceId=testgeraet06"),
      post("/api/helper/claim", { jobId: "$2.jobs.0.id", deviceId: dev.deviceId }),
      post("/api/helper/result", { jobId: "$2.jobs.0.id", exitCode: 0, tail: GRUEN }),
      { until: reihe(f), ms: 5_000 }, get("/api/post-land-audits")], e);
    expect(Date.now() - t0).toBeLessThan(8_000);
    expect(result?.status).toBe(200);
    expect((audits?.body.audits as { result: string }[])[0]?.result).toBe("green");
    expect((await leseSiegel(f.repo, tree)).filter((x) => x.tiefe === "audit")).toHaveLength(1);
  }, 3 * LIFE_DEADLINE_MS);
});

describe("der Shard-Weg des Helfers", () => {
  const dev = { deviceId: "testgeraet05", name: "testgeraet", features: ["audit-skip-units", "audit-shard"] };
  test("teilweise Deckung: beide Shards bekommen denselben Scope, und das Siegel der zusammengeführten Zeile trägt die Lücke", async () => {
    const { f, tree, e, land } = await helferFixture("shards", { FLEET_AUDIT_SHARDS: "2" });
    const [, , jobs, c1, c2, r1, r2, , audits] = await life(f, [land, post("/api/helper/device", dev), get("/api/helper/jobs?deviceId=testgeraet05"),
      post("/api/helper/claim", { jobId: "$2.jobs.0.id", deviceId: dev.deviceId }),
      post("/api/helper/claim", { jobId: "$2.jobs.1.id", deviceId: dev.deviceId }),
      post("/api/helper/result", { jobId: "$2.jobs.0.id", exitCode: 0, tail: GRUEN }),
      post("/api/helper/result", { jobId: "$2.jobs.1.id", exitCode: 0, tail: GRUEN }),
      { until: reihe(f), ms: 5_000 }, get("/api/post-land-audits")], e);
    expect((jobs?.body.jobs as unknown[]).length).toBe(2);
    expect([c1?.status, c2?.status, r1?.status, r2?.status]).toEqual([200, 200, 200, 200]);
    const s1 = (c1?.body.job as { skipUnits: string[] }).skipUnits, s2 = (c2?.body.job as { skipUnits: string[] }).skipUnits;
    expect(s1).toEqual(s2);
    expect(s1).toContain("core");
    expect(s1).not.toContain("lanes");
    const row = (audits?.body.audits as { result: string; shards?: unknown[]; quellen?: { maschine: string }[] }[])[0];
    expect(row).toMatchObject({ result: "green", quellen: [{ maschine: "mac" }] });
    expect(row?.shards).toHaveLength(2);
    const siegel = (await leseSiegel(f.repo, tree)).filter((x) => x.tiefe === "audit");
    expect(siegel).toHaveLength(1);
    expect(siegel[0]).toMatchObject({ ergebnis: "green", units: ["lanes"] });
    expect(siegel[0]!.lauf).toMatch(/^shards-/);
  }, 3 * LIFE_DEADLINE_MS);

  test("volle Deckung: der Shard-Claim endet mit 409 „settled from the seals“, die Zeile steht grün, es läuft nichts", async () => {
    const { f, e, land } = await helferFixture("shardvoll", { FLEET_AUDIT_SHARDS: "2" }, geforderteUnits(["dom"]));
    const [, , jobs, claim, , audits, after] = await life(f, [land, post("/api/helper/device", dev), get("/api/helper/jobs?deviceId=testgeraet05"),
      post("/api/helper/claim", { jobId: "$2.jobs.0.id", deviceId: dev.deviceId }),
      { until: reihe(f), ms: 5_000 }, get("/api/post-land-audits"), get("/api/helper/jobs?deviceId=testgeraet05")], e);
    expect((jobs?.body.jobs as unknown[]).length).toBe(2);
    expect(claim?.status).toBe(409);
    expect(String(claim?.body.error)).toContain("settled from the seals");
    expect((audits?.body.audits as { result: string; quellen?: unknown[] }[])[0]).toMatchObject({ result: "green" });
    expect((after?.body.jobs as unknown[]).length).toBe(0);
  }, 3 * LIFE_DEADLINE_MS);
});

describe("ein Deploy-Tor ohne eigenen Audit-Befehl (der WH seit dem Audit-Schalter)", () => {
  // der WH hat keinen FLEET_POSTLAND_AUDIT_CMD, aber einen Hub; der Mac auditiert und siegelt
  const ohneBefehl = (f: Fixture, name: string): Record<string, string> => ({ FLEET_HUB_REMOTE: "hub", FLEET_REPO_DIR: f.repo, FLEET_MACHINE: name });
  async function macAuditiert(rot: boolean) {
    const { wh, mac, hub } = zweiFleets();
    const [, , , audits] = await landeUndAuditiere(mac, "mac", umgebung(mac, "mac", attrappe(mac.state, rot).cmd), "vom-mac");
    expect((audits?.body.audits as { result: string }[]).map((r) => r.result)).toEqual([rot ? "red" : "green"]);
    sh(mac.repo, "push", "-q", "hub", "main");
    sh(wh.repo, "fetch", "-q", "hub");
    sh(wh.repo, "merge", "-q", "--ff-only", "hub/main");
    expect(sh(hub, "for-each-ref", "--format=%(refname)", "refs/notes/fleet/seal/")).toBe("refs/notes/fleet/seal/mac");
    return wh;
  }
  const deploy = (extra: Record<string, unknown> = {}) => post("/api/deploy", extra);

  test("kein Siegel: das Tor bleibt zu (409, mit Grund), der Befehl fehlt nicht als Freibrief", async () => {
    const { wh } = zweiFleets();
    const [tip, refused] = await life(wh, [post("/api/repos/audit-tip", {}), deploy()], ohneBefehl(wh, "wh"));
    expect(tip?.body).toMatchObject({ queued: false, state: "unseen" });
    expect(refused?.status).toBe(409);
    expect(String(refused?.body.reason)).toContain("tip not audited");
    expect(String(refused?.body.reason)).toContain("no audit command of its own");
    expect(String(refused?.body.reason)).toContain("no other fleet has sealed this tree green");
  }, 3 * LIFE_DEADLINE_MS);

  test("ein grünes Siegel des Macs auf demselben Baum: das Tor geht auf und nennt die Quelle", async () => {
    const wh = await macAuditiert(false);
    const [tip] = await life(wh, [post("/api/repos/audit-tip", {})], ohneBefehl(wh, "wh"));
    expect(tip?.body).toMatchObject({ queued: false, state: "seen", audit: { result: "green", quellen: [{ maschine: "mac", tiefe: "audit" }] } });
    expect(String(tip?.body.why)).toContain("geprüft am mac, voller Audit");
  }, 4 * LIFE_DEADLINE_MS);

  test("F2: auch der Gate-only-Umweg lässt ohne Siegel nichts durch (grüne Ledger-Zeile des Vorfahrens + Land-Note der Klasse full)", async () => {
    const { wh } = zweiFleets();
    const base = sh(wh.repo, "rev-parse", "HEAD");
    const head = commitIn(wh.repo, "gate-only.txt", "ein Land");
    // genau das, was deployGateOnlyOf liest: eine Land-Note mit verify.class full auf dem Tip und eine grüne volle Audit-Zeile am Vorfahren
    sh(wh.repo, "notes", "--ref=fleet/land", "add", "-m", JSON.stringify({ mainBefore: base, mainAfter: head,
      verify: { ok: true, class: "full", mainSha: base } }), head);
    writeFileSync(join(wh.state, "post-land-audits.jsonl"), `${JSON.stringify({ at: Date.now() - 1000, startedAt: Date.now() - 2000, ms: 1000,
      repo: wh.repo, main: "main", mainSha: base, result: "green", cmd: "x", exitCode: 0, out: "", checks: { ran: 5, failed: 0 }, covers: [] })}\n`);
    const [refused] = await life(wh, [deploy()], ohneBefehl(wh, "wh"));
    expect(refused?.status).toBe(409);
    expect(String(refused?.body.reason)).toContain("tip not audited");
    expect(String(refused?.body.reason)).toContain("no audit command of its own");
  }, 3 * LIFE_DEADLINE_MS);

  test("F3: erreicht das Tor den Hub nicht, bleibt es zu, auch wenn ein früher geholtes Siegel den Baum deckt", async () => {
    const wh = await macAuditiert(false);
    const [tip] = await life(wh, [post("/api/repos/audit-tip", {})], ohneBefehl(wh, "wh"));
    expect(tip?.body).toMatchObject({ state: "seen" }); // das Siegel des Macs liegt jetzt im Hub-Namensraum des WH
    rmSync(sh(wh.repo, "remote", "get-url", "hub"), { recursive: true, force: true }); // der Hub ist weg
    const [refused] = await life(wh, [deploy()], ohneBefehl(wh, "wh"));
    expect(refused?.status).toBe(409);
    expect(String(refused?.body.reason)).toContain("tip not audited");
    expect(String(refused?.body.reason)).toContain("could not be fetched");
  }, 5 * LIFE_DEADLINE_MS);

  test("F6: trägt der Baum eine andere Unit-Tabelle als der laufende Server, öffnet auch ein grünes Mac-Siegel das Tor nicht", async () => {
    const { wh, mac } = zweiFleets();
    const eMac = umgebung(mac, "mac", attrappe(mac.state).cmd);
    const [made] = await life(mac, [post("/api/branches", { repo: mac.repo, name: "neue-unit" })], eMac);
    const path = String(made?.body.path);
    mkdirSync(join(path, "e2e"));
    commitIn(path, "e2e/ctx.ts", "export const SHARD_UNITS = [{ unit: 'neue-unit' }];");
    await life(mac, [post("/api/branches/land", { repo: mac.repo, branch: "branch/neue-unit", subject: "neue-unit", unchecked: true }),
      post("/api/repos/audit-tip", {}), { until: reihe(mac), ms: 20_000 }], eMac);
    sh(mac.repo, "push", "-q", "hub", "main");
    sh(wh.repo, "fetch", "-q", "hub");
    sh(wh.repo, "merge", "-q", "--ff-only", "hub/main");
    const [tip] = await life(wh, [post("/api/repos/audit-tip", {})], ohneBefehl(wh, "wh"));
    expect(tip?.body).toMatchObject({ queued: false, state: "unseen" });
    expect(String(tip?.body.why)).toContain("unit table (e2e/ctx.ts) differs");
  }, 5 * LIFE_DEADLINE_MS);

  test("Bedingung der Orchestratorin: gedeckt wird je Unit; deployt wird erst, wenn JEDE geschuldete Unit gedeckt ist (dom nicht), mit allen Quellen", async () => {
    const { wh, mac } = zweiFleets();
    const head = commitIn(mac.repo, "gemeinsamer-baum.txt", "ein Stand");
    sh(mac.repo, "push", "-q", "hub", "main");
    sh(wh.repo, "fetch", "-q", "hub");
    sh(wh.repo, "merge", "-q", "--ff-only", "hub/main");
    const tree = (await baumVon(mac.repo, head))!;
    const siegel = (units: string[], tiefe: "check" | "audit", maschine: string, lauf: string, at: number) => schreibeSiegel(mac.repo,
      { v: 1, tree, units, tiefe, ergebnis: "green", maschine, plattform: plattformHier(), lauf, at }, "mac");
    // ein Check auf diesem Baum: alles außer dom und lanes
    await siegel(geforderteUnits(["dom"]).filter((u) => u !== "lanes"), "check", "mac", "1030-check", Date.now() - 60_000);
    expect(await pushSiegel(mac.repo, "hub", "mac")).toBe(true);
    const [offen, tipOffen] = await life(wh, [deploy(), post("/api/repos/audit-tip", {})], ohneBefehl(wh, "wh"));
    expect(offen?.status).toBe(409);
    const geschuldet = geforderteUnits(["dom"]).length; // dom schuldet ein Deploy-Audit nicht (auditScopeOf), es bleibt nightly
    expect(String(offen?.body.reason)).toContain(`cover ${geschuldet - 1} of ${geschuldet} units`); // alle bis auf lanes
    expect(String(offen?.body.reason)).toContain("missing: lanes");
    expect(String(offen?.body.reason)).not.toContain("dom");
    expect(tipOffen?.body).toMatchObject({ state: "unseen" });
    // ein grünes Siegel für lanes auf demselben Baum kommt dazu: jetzt ist jede geschuldete Unit gedeckt, und das Tor nennt beide Quellen
    await siegel(["lanes"], "audit", "workhorse", "helper-abc", Date.now());
    expect(await pushSiegel(mac.repo, "hub", "mac")).toBe(true);
    const [zu] = await life(wh, [post("/api/repos/audit-tip", {})], ohneBefehl(wh, "wh"));
    expect(zu?.body).toMatchObject({ state: "seen", audit: { result: "green" } });
    const quellen = (zu?.body.audit as { quellen: { maschine: string; tiefe: string; units: string[] }[] }).quellen;
    expect(quellen.map((q) => `${q.maschine}:${q.tiefe}`).sort()).toEqual(["mac:check", "workhorse:audit"]);
    expect(quellen.find((q) => q.maschine === "workhorse")!.units).toEqual(["lanes"]);
    expect(String(zu?.body.why)).toContain("geprüft am");
  }, 5 * LIFE_DEADLINE_MS);

  test("ein rotes Siegel des Macs: das Tor bleibt zu und nennt das Rot", async () => {
    const wh = await macAuditiert(true);
    const [refused] = await life(wh, [deploy()], ohneBefehl(wh, "wh"));
    expect(refused?.status).toBe(409);
    expect(String(refused?.body.reason)).toContain("tip not audited");
    expect(String(refused?.body.reason)).toContain("is RED");
  }, 4 * LIFE_DEADLINE_MS);

  test("das eigene Siegel zählt nicht als das einer anderen Maschine", async () => {
    // der WH selbst hat (etwa über einen lokalen Check) auf dem Baum gesiegelt: ohne ein fremdes Siegel bleibt das Tor zu
    const { wh } = zweiFleets();
    const tree = (await baumVon(wh.repo, "HEAD"))!;
    await schreibeSiegel(wh.repo, { v: 1, tree, units: geforderteUnits(["dom"]), tiefe: "audit", ergebnis: "green", maschine: "mac", plattform: plattformHier(),
      lauf: "selbst", at: Date.now() }, "wh");
    const [tip] = await life(wh, [post("/api/repos/audit-tip", {})], ohneBefehl(wh, "wh"));
    expect(tip?.body).toMatchObject({ queued: false, state: "unseen" });
  }, 3 * LIFE_DEADLINE_MS);
});
