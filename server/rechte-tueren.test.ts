// RECHTE AN DEN TÜREN (Richtung Schritt 2, Owner 2026-10-26): an jeder Tür der fünf Akte prüft der Server ein
// Recht des aufrufenden Sitzes; eine Abweisung nennt es als 409 mit `missingRight`. Ein Recht ist ein Schlüssel,
// kein Ersatz für die harte Tür: eigener Branch, Binding und Gate bleiben darunter bestehen. Die Matrix unten hält
// die Rollenbundel fest, die Tests darunter gehen mit derselben Sitzung ohne und mit der Zusage des Owners durch
// die Türen. Bestehende Rollen-Suiten (ohne-owner-token, kanten, branch-land, selbst-einrichten, sitz-tuer, …)
// bleiben daneben unverändert grün.
import { afterAll, describe, expect, test } from "bun:test";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RECHT_IDS, type RechtId } from "../session-rechte";
import { branchTestkit, commitIn, get, LIFE_DEADLINE_MS, persisted, post, sh, type Answer, type Fixture } from "./branches-testkit";
import { ROLLEN_BUENDEL, buendelFuer, RECHT_WAS, rechteZeilen, wirksameRechte, type RechtRolle } from "./tuer-rechte";
import { kindNieWeiter, type Oeffnerin } from "./kind-weite";

const { fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

const tokenOf = (f: Fixture, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
  if (!t) throw new Error(`no self token for slot ${slot}`);
  return t;
};
const as = (self: string, step: { method: string; path: string; body?: unknown }) => ({ ...step, token: null, self });
const missing = (a: Answer | undefined, id: RechtId): void => {
  expect({ status: a?.status, missing: a?.body.missingRight, role: typeof a?.body.role, door: typeof a?.body.door })
    .toEqual({ status: 409, missing: id, role: "string", door: "string" });
  expect(String(a?.body.error)).toContain(`missing right \`${id}\``);
};
const PROGRAM = { title: "Rechte-Probe", intent: "Rechte an den Türen prüfen", successCriterion: "jede Tür nennt ihr Recht",
  nonGoals: [], decisions: [], evidence: [], openQuestions: [] };

// Ein Fixture mit einem Merge-Check, wie ihn der echte Wächter schreibt (server/branch-land.test.ts#checkedFixture)
function checkedFixture(): Fixture {
  const f = fixture();
  mkdirSync(join(f.repo, "ci"));
  writeFileSync(join(f.repo, "ci/merge-check.ts"), "// Attrappe: das Urteil schreibt der Test\n");
  sh(f.repo, "add", "ci/merge-check.ts");
  sh(f.repo, "commit", "-q", "-m", "merge-check");
  return f;
}
function plantGreen(f: Fixture, branch: string): { tip: string; tree: string } {
  const tip = sh(f.repo, "rev-parse", branch), main = sh(f.repo, "rev-parse", "main");
  const commits = sh(f.repo, "rev-list", "--reverse", "--no-merges", tip, "^main").split("\n").filter(Boolean);
  let cur = main;
  for (const c of commits)
    cur = sh(f.repo, "commit-tree", sh(f.repo, "merge-tree", "--write-tree", "--merge-base", `${c}^`, cur, c).split("\n")[0]!, "-p", cur, "-m", "kandidat");
  const tree = sh(f.repo, "rev-parse", `${cur}^{tree}`);
  appendFileSync(join(sh(f.repo, "rev-parse", "--path-format=absolute", "--git-common-dir"), "merge-checks.jsonl"),
    `${JSON.stringify({ at: Date.now(), branch, base: "main", tip, main, candidate: cur, tree, commits, verdict: "green", mergeable: true, why: "main grün" })}\n`);
  return { tip, tree };
}

describe("die Rollen als benannte Bundel", () => {
  test("jede Zelle der Entwurfstabelle, keine Rolle verliert ein Recht, Zusagen addieren nur", () => {
    const erwartet: Record<RechtRolle, RechtId[]> = {
      orchestrator: ["seat.open", "land.branch", "text.handover", "text.pack", "text.concept.annotation", "edge.grant", "overview.fleet"],
      "program-main": ["seat.open", "land.branch", "land.program", "text.handover", "text.pack", "text.concept.version",
        "text.concept.annotation", "text.program"],
      lane: ["land.branch", "text.handover", "text.pack", "text.concept.version", "text.concept.annotation"],
      steward: ["land.branch", "fleet.deploy", "text.pack", "text.concept.annotation"],
      generic: ["seat.open", "land.branch", "text.handover", "text.pack", "text.concept.annotation"],
    };
    for (const [rolle, ids] of Object.entries(erwartet) as [RechtRolle, RechtId[]][]) {
      expect(ROLLEN_BUENDEL[rolle]).toEqual(ids);
      expect([...wirksameRechte(null, [rolle])].sort()).toEqual([...ids].sort());
    }
    // eine Lane, die zugleich Steward ist, trägt die Vereinigung; eine Zusage auf einem buendel none addiert nur
    expect([...wirksameRechte(null, ["lane", "steward"])].sort())
      .toEqual([...new Set([...erwartet.lane, ...erwartet.steward])].sort());
    expect(wirksameRechte({ stufe: "bauen", an: [], aus: [], buendel: "none" }, ["orchestrator"]).size).toBe(0);
    expect([...wirksameRechte({ stufe: "bauen", an: [], aus: [], buendel: "none", recht: ["edge.grant"] }, ["lane"])])
      .toEqual(["edge.grant"]);
    expect(RECHT_IDS.length).toBe(17);
    // DIE DREI SETUP-RECHTE (Richtung Schritt 4) UND role.form (Schritt 5) TRÄGT KEIN ROLLENBUNDEL: sie ändern das Setup als solches,
    // nicht nur einen Start daraus — der Owner vergibt sie je Sitz (server/setup-tueren.ts). Jede Rolle behält genau, was sie hatte.
    for (const [rolle, bundel] of Object.entries(ROLLEN_BUENDEL) as [RechtRolle, RechtId[]][])
      for (const id of ["setup.save", "setup.export", "setup.import", "role.form", "branch.passt"] as RechtId[]) {
        expect(bundel, `${rolle} trägt nicht ${id}`).not.toContain(id);
        expect(typeof RECHT_WAS[id] === "string" && RECHT_WAS[id].length > 0, `${id} hat einen Satz`).toBe(true);
      }
    // der Startbrief nennt jedes wirksame Recht mit seiner Bedeutung und dann den Zaun (oder dessen Fehlen)
    const brief = rechteZeilen(null, ["generic"], "claude");
    expect(brief[0]).toStartWith("FLEET SERVER RIGHTS (checked at Fleet's doors):");
    for (const id of ROLLEN_BUENDEL.generic) expect(brief[0]).toContain(`${id} — ${RECHT_WAS[id]}`);
    expect(brief[1]).toContain("FLEET'S FENCE: the four start switches are Claude Code permission rules");
    expect(rechteZeilen(null, ["generic"], "codex")[1]).toStartWith("FLEET SETS NO HARNESS FENCE for this seat: codex");
  });
  test("auch eine Öffnerin ohne Schranke gibt kein Server-Recht weiter, das sie selbst nicht hat", () => {
    const orch: Oeffnerin = { harness: "claude", modus: "bypassPermissions", permissions: null,
      rechte: { stufe: "lesen", an: [], aus: [] }, rollen: ["orchestrator"] };
    const nein = kindNieWeiter(orch, { branch: "b", rechte: { recht: ["fleet.deploy"] } });
    expect(nein.ok ? "offen" : nein.error).toContain("rechte give fleet.deploy more than yours");
    // was sie trägt, gibt sie weiter; das Kind bleibt generic und bekommt nur diese Zusage
    expect(kindNieWeiter(orch, { branch: "b", rechte: { recht: ["edge.grant"] } }).ok).toBe(true);
  });
});

describe("eine Probensitzung ohne Recht bekommt an jeder Tür der drei Text-/Branch-Akte 409 mit dem Recht; mit der Zusage geht dieselbe Sitzung durch", () => {
  test("branch open/land, handover, succeed, einrichten, pack, edge: erst 409, dann Zusage, dann Erfolg", async () => {
    const f = checkedFixture();
    const [probeBranch, childBranch] = await life(f, [post("/api/branches", { repo: f.repo, name: "Probe" }),
      post("/api/branches", { repo: f.repo, name: "Kind" })]);
    const probeName = String(probeBranch?.body.branch), childName = String(childBranch?.body.branch);
    const [opened, plainA, plainB] = await life(f, [
      post(`/api/branches/open`, { repo: f.repo, branch: probeName, rechte: { buendel: "none" } }),
      post("/api/slots/2/open", { cwd: f.repo, label: "A" }),
      post("/api/slots/3/open", { cwd: f.repo, label: "B" })]);
    const probe = Number(opened?.body.slot);
    expect([opened?.status, plainA?.status, plainB?.status]).toEqual([200, 200, 200]);
    const self = tokenOf(f, probe), path = String(opened?.body.cwd);

    const without = await life(f, [
      as(self, post("/api/self/branches/open", { branch: childName, rechte: { buendel: "none" } })),
      as(self, post("/api/self/branches/land", { subject: "Probe" })),
      as(self, post("/api/self/handover", { intent: "Probe" })),
      as(self, post("/api/self/succeed", {})),
      as(self, post("/api/self/einrichten", { purpose: "Probe" })),
      as(self, post("/api/self/packs", { id: "probe-pack", useWhen: "Probe", text: "# Probe" })),
      as(self, post("/api/self/kanten", { between: [2, 3], why: "Probe" })),
    ]);
    missing(without[0], "seat.open");
    missing(without[1], "land.branch");
    missing(without[2], "text.handover");
    missing(without[3], "text.handover");
    missing(without[4], "text.handover");
    missing(without[5], "text.pack");
    missing(without[6], "edge.grant");

    const [grant] = await life(f, [post(`/api/slots/${probe}/rechte`, { grant: ["seat.open", "land.branch", "text.handover", "text.pack", "edge.grant"] })]);
    expect(grant?.status).toBe(200);
    expect(grant?.body.effective).toEqual(expect.arrayContaining(["seat.open", "land.branch", "text.handover", "text.pack", "edge.grant"]));

    // Startbrief und GET /api/self nennen dieselben wirksamen Rechte, mit Bedeutung, und wo der Zaun steht
    const [view, fassung] = await life(f, [as(self, get("/api/self")), get(`/api/slots/${probe}/fassung?anlass=nachfolge`)]);
    expect((view?.body.rechte as { effective?: string[] }).effective)
      .toEqual(expect.arrayContaining(["seat.open", "land.branch", "text.handover", "text.pack", "edge.grant"]));
    const darf = ((fassung?.body.teile as { id: string; abschnitte: { id: string; text: string }[] }[] | undefined) ?? [])
      .find((t) => t.id === "darf")?.abschnitte.find((a) => a.id === "darf")?.text ?? "";
    expect(darf).toContain("FLEET SERVER RIGHTS (checked at Fleet's doors):");
    expect(darf).toContain("seat.open — open a seat");
    expect(darf).toContain("land.branch — land its own branch");
    expect(darf).toContain("FLEET'S FENCE: the four start switches are Claude Code permission rules");

    // der Branch muss Arbeit tragen, damit die Land-Tür ihren eigenen Weg geht; „passt“ und grüner Check wie an der echten Tür
    commitIn(path, "probe.txt", "Probe-Arbeit");
    const green = plantGreen(f, probeName);
    const withRight = await life(f, [
      as(self, post("/api/self/branches/open", { branch: childName, rechte: { buendel: "none" } })),
      as(self, post("/api/self/handover", { intent: "die Probe schreibt ihren Stand" })),
      as(self, post("/api/self/einrichten", { purpose: "Die Probe richtet ihren Nachfolger ein." })),
      as(self, post("/api/self/packs", { id: "probe-pack", useWhen: "Probe", text: "# Probe" })),
      as(self, post("/api/self/kanten", { between: [2, 3], why: "Probe" })),
      post("/api/branches/seen", { repo: f.repo, branch: probeName, head: green.tip }),
      as(self, post("/api/self/branches/land", { subject: "Probe: Land" })),
    ]);
    expect(withRight[0]?.status).toBe(200);
    expect(withRight[1]?.status).toBe(200);
    expect(withRight[2]?.status).toBe(200);
    expect(withRight[3]?.status).toBe(200);
    expect([withRight[4]?.status, (withRight[4]?.body.kante as { between?: number[] } | undefined)?.between]).toEqual([201, [2, 3]]);
    expect(withRight[5]?.status).toBe(200);
    expect(withRight[6]).toMatchObject({ status: 200, body: { ok: true, main: "main", passt: true, checked: true } });
    // der Nachfolger mit dem Handover-Recht: dieselbe Sitzung, die Tür geht durch
    const [succeed] = await life(f, [as(self, post("/api/self/succeed", {}))],
      { FLEET_FOUNDING_BOOT_GRACE_MS: "250", FLEET_READY_WAIT_MS: "500" });
    // die Nachfolge ist angenommen; die Zustellung des Briefs kann als Schuld zurückkommen (wie in jeder Testpane)
    expect(succeed?.status).toBeLessThan(600);
    expect(succeed?.body.missingRight).toBeUndefined();
  }, LIFE_DEADLINE_MS * 6);
});

describe("Konzepttexte: Version und Anmerkung nennen ihr Recht; die Zusage weitet die bestehende Lane/MAIN-Grenze nicht", () => {
  test("ohne Recht 409, mit Recht Version und Anmerkung 200; ein generic-Sitz darf eine Anmerkung mit Recht weiterhin nicht verwerfen", async () => {
    const f = fixture();
    const root = join(f.state, "konzepte");
    mkdirSync(join(root, "k-rechte"), { recursive: true });
    const text = "# Rechte v1\n";
    writeFileSync(join(root, "k-rechte", "v1.md"), text);
    const sha = new Bun.CryptoHasher("sha256").update(text).digest("hex");
    const [opened, program, plain] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, rechte: { buendel: "none" } }),
      post("/api/programs", PROGRAM), post("/api/slots/2/open", { cwd: f.repo, rechte: { buendel: "none" } })]);
    expect([opened?.status, program?.status, plain?.status]).toEqual([200, 200, 200]);
    const id = String((program?.body.program as { id: string }).id);
    const occupant = (persisted(f).slots as Record<string, { openedAt: number }>)["1"]!;
    const state = persisted(f);
    state.programs = (state.programs as { id: string }[]).map((p) => p.id === id
      ? { ...p, status: "active", confirmedAt: Date.now() - 300, activatedAt: Date.now() - 200,
        main: { slot: 1, openedAt: occupant.openedAt, sessionId: null, boundAt: Date.now() - 100 } } : p);
    writeFileSync(join(f.state, "fleet.json"), JSON.stringify(state, null, 2));
    const self = tokenOf(f, 1), generic = tokenOf(f, 2);
    const env = { FLEET_KONZEPT_ROOT: root };
    const without = await life(f, [
      as(self, post("/api/self/konzepte/k-rechte/versionen", { sha256: sha, anlass: "Probe", geltung: "Probe" })),
      as(self, post("/api/self/konzepte/k-rechte/anmerkungen", { version: 1, text: "Probe" })),
      as(self, post("/api/self/konzepte/k-rechte/anmerkungen/0123456789abcdef/verwerfen", { grund: "Probe" })),
    ], env);
    missing(without[0], "text.concept.version");
    missing(without[1], "text.concept.annotation");
    missing(without[2], "text.concept.annotation");
    const grants = await life(f, [post("/api/slots/1/rechte", { grant: ["text.concept.version", "text.concept.annotation"] }),
      post("/api/slots/2/rechte", { grant: ["text.concept.annotation"] })], env);
    expect(grants.map((g) => g?.status)).toEqual([200, 200]);
    const [version, annotation] = await life(f, [
      as(self, post("/api/self/konzepte/k-rechte/versionen", { sha256: sha, anlass: "Probe", geltung: "Probe" })),
      as(self, post("/api/self/konzepte/k-rechte/anmerkungen", { version: 1, text: "Probe-Anmerkung" })),
    ], env);
    expect([version?.status, (version?.body.version as { version?: number } | undefined)?.version]).toEqual([200, 1]);
    expect([annotation?.status, (annotation?.body.anmerkung as { id?: string } | undefined)?.id]).toEqual([200, expect.stringMatching(/^[0-9a-f]{16}$/)]);
    const lines = readFileSync(join(root, "k-rechte", "anmerkungen.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as { id: string });
    const [withdraw, genericWithdraw] = await life(f, [
      as(self, post(`/api/self/konzepte/k-rechte/anmerkungen/${lines[0]!.id}/verwerfen`, { grund: "Probe" })),
      as(generic, post(`/api/self/konzepte/k-rechte/anmerkungen/${lines[0]!.id}/verwerfen`, { grund: "Probe" })),
    ], env);
    expect(withdraw?.status).toBe(200);
    expect(genericWithdraw?.status).toBe(409);
    expect(genericWithdraw?.body.missingRight).toBeUndefined();
    expect(String(genericWithdraw?.body.error)).toContain("lane or by the bound MAIN");
  }, LIFE_DEADLINE_MS * 5);
});

describe("Program-Texte und Release: die gebundene MAIN-Probe bekommt ohne Recht 409, mit der Zusage schreibt und released sie", () => {
  test("land/program, context, decisions, comment, release; danach ist die Zeile queued", async () => {
    const f = fixture();
    const [opened, program] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, rechte: { buendel: "none" } }), post("/api/programs", PROGRAM)]);
    expect([opened?.status, program?.status]).toEqual([200, 200]);
    const id = String((program?.body.program as { id: string }).id);
    const occupant = (persisted(f).slots as Record<string, { openedAt: number }>)["1"]!;
    const now = Date.now();
    const state = persisted(f);
    state.programs = (state.programs as { id: string }[]).map((p) => p.id === id
      ? { ...p, status: "active", confirmedAt: now - 300, activatedAt: now - 200,
        main: { slot: 1, openedAt: occupant.openedAt, sessionId: null, boundAt: now - 100 } } : p);
    state.tasks = [{ id: "probe1", originId: "probe1", text: "ZIEL: die Probe\nDONE: sie steht", source: "owner", kind: "auftrag",
      repo: f.repo, status: "pending", created: now - 1000, slot: null, note: null, programId: id,
      card: { ziel: "die Probe", rolle: { harness: null, model: null, effort: null }, surface: { files: ["README"], symbols: [], ranges: null },
        done: "die Probe steht", verify: "true", verboten: [], model: "probe", at: now - 900, ms: 0, valid: true, gaps: [] } }];
    writeFileSync(join(f.state, "fleet.json"), JSON.stringify(state, null, 2));
    const self = tokenOf(f, 1);
    const without = await life(f, [
      as(self, post("/api/self/tasks/probe1/land", {})),
      as(self, post("/api/self/program-context-packs", { packs: [] })),
      as(self, post("/api/self/program-decisions", { text: "Probe" })),
      as(self, post("/api/self/tasks/probe1/comment", { text: "Probe" })),
      as(self, post("/api/self/tasks/probe1/release", {})),
    ]);
    missing(without[0], "land.program");
    missing(without[1], "text.program");
    missing(without[2], "text.program");
    missing(without[3], "text.program");
    missing(without[4], "seat.open");
    const [grant] = await life(f, [post("/api/slots/1/rechte", { grant: ["seat.open", "text.program", "land.program"] })]);
    expect(grant?.status).toBe(200);
    const withRight = await life(f, [
      // die Land-Tür ist erreicht; die Zeile ist noch nicht gelaufen, also antwortet die Tür selbst — nicht das Recht
      as(self, post("/api/self/tasks/probe1/land", {})),
      as(self, post("/api/self/program-context-packs", { packs: [] })),
      as(self, post("/api/self/program-decisions", { text: "Die Probe steht." })),
      as(self, post("/api/self/tasks/probe1/comment", { text: "Die Probe steht." })),
      as(self, post("/api/self/tasks/probe1/release", {})),
    ]);
    expect(withRight[0]?.status).toBe(409);
    expect(withRight[0]?.body.missingRight).toBeUndefined();
    expect(String(withRight[0]?.body.error)).toContain("only a running row has a lane to land");
    expect(withRight[1]?.status).toBe(200);
    expect(withRight[2]?.status).toBe(200);
    expect(withRight[3]?.status).toBe(200);
    expect(withRight[4]?.status).toBe(200);
    const row = (persisted(f).tasks as { id: string; status: string }[]).find((t) => t.id === "probe1");
    expect(row?.status).toBe("queued");
  }, LIFE_DEADLINE_MS * 6);
});

describe("Deploy: der bestehende Steward-Weg prüft fleet.deploy; der Owner-Schlüssel bleibt daneben", () => {
  test("ohne Recht 409 missingRight; mit Zusage erreicht der Steward die bestehende Preflight (ein laufender Deploy blockt)", async () => {
    const f = fixture();
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, label: "⚙ steward", rechte: { buendel: "none" } })]);
    expect(opened?.status).toBe(200);
    const stewardToken = (persisted(f) as { stewardToken?: string }).stewardToken;
    expect(typeof stewardToken).toBe("string");
    const deployHeader = (t: string) => ({ method: "POST", path: "/api/deploy", body: {}, token: t });
    const [without] = await life(f, [deployHeader(stewardToken!)]);
    missing(without, "fleet.deploy");
    const [grant] = await life(f, [post("/api/slots/1/rechte", { grant: ["fleet.deploy"] })]);
    expect(grant?.status).toBe(200);
    const marker = { id: "deadbeef", at: Date.now(), by: "steward", target: "0".repeat(40), bootHeadBefore: null,
      buildMs: 0, buildCmd: "true", restartCmd: "true" };
    const [, withRight] = await life(f, [{ datei: join(f.state, "deploy-inflight.json"), text: JSON.stringify(marker), ms: 0 }, deployHeader(stewardToken!)]);
    expect(withRight?.status).toBe(409);
    expect(withRight?.body.missingRight).toBeUndefined();
    expect(String(withRight?.body.reason)).toContain("a deploy is already in flight");
  }, LIFE_DEADLINE_MS * 4);
});
