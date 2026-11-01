// DIE ÜBERSICHT FÜR AGENTEN, AN DER TÜR (C1, ~/local-notes/lagebild/auftrag.md): GET /api/self/overview mit dem Self-Token eines Sitzes, nie mit
// dem Schlüssel des Owners. Die Leiterin sieht ihre Kinder mit allem, was Fleet von ihnen weiß, ein Kind seine Öffnerin und sein Geschwister, ein
// Sitz ohne Linie niemanden, die Orchestratorin jeden — die eigenen Sitze des Owners nur mit Platz und Zustand. Eine persönliche Nachricht zählt
// als Post und geht nie mit. Jede Probe geht durch einen Server in eigenem Prozess (server/branches-testkit.ts).
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { branchTestkit, get, LIFE_DEADLINE_MS, persisted, post, sh, type Answer, type Fixture } from "./branches-testkit";

const { BIN, fixture, life, serve, cleanup } = branchTestkit();
afterAll(cleanup);

const tokenOf = (f: Fixture, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
  if (!t) throw new Error(`no self token for slot ${slot}`);
  return t;
};
// nur der Self-Token: `token: null` lässt den Owner-Bearer weg
const as = (self: string, step: { method: string; path: string; body?: unknown }) => ({ ...step, token: null, self });
const wurzel = (f: Fixture): string => dirname(f.repo);
const ordner = (f: Fixture, name: string): string => { const d = join(wurzel(f), name); mkdirSync(d, { recursive: true }); return d; };
const BILD = "/api/self/overview", OPEN = "/api/self/seats/open";
type Zeile = Record<string, any> & { slot: number | null; relation: string };
const zeilen = (a: Answer | undefined): Zeile[] => (a?.body.seats as Zeile[] | undefined) ?? [];
const zeile = (a: Answer | undefined, slot: number): Zeile | undefined => zeilen(a).find((x) => x.slot === slot);
const GEHEIM = "Die Steuernummer des Owners lautet 12/345/67890.";

/** Die Leiterin (Slot 1, vom Board) öffnet Bauer und Prüfer; Slot 4 ist ein weiterer Sitz des Owners, Slot 5 die Orchestratorin. */
async function aufbau(f: Fixture, env: Record<string, string>) {
  await life(f, [post("/api/slots/1/open", { cwd: f.repo, label: "Leiterin", rechte: { buendel: "none" } }),
    post("/api/slots/4/open", { cwd: ordner(f, "eigen"), label: "Mein eigener Agent" }),
    post("/api/slots/5/open", { cwd: ordner(f, "orch"), label: "🎛 Orchestratorin" })], env);
  const lead = tokenOf(f, 1);
  await life(f, [post("/api/slots/1/rechte", { grant: ["seat.open"] })], env);
  const [baut, prueft] = await life(f, [
    as(lead, post(OPEN, { cwd: ordner(f, "bau"), goal: "Baue die Funktion.", label: "Bauer", model: "claude-haiku-5-5" })),
    as(lead, post(OPEN, { cwd: ordner(f, "pruef"), goal: "Prüfe, was der Bauer baut.", label: "Prüfer" }))], env);
  expect([baut?.status, prueft?.status]).toEqual([200, 200]);
  return { lead, bauer: Number(baut?.body.slot), pruefer: Number(prueft?.body.slot) };
}

describe("GET /api/self/overview", () => {
  test("ohne den Schlüssel des Owners: die Leiterin sieht ihre Kinder mit jedem Feld, unbekannt mit Grund; das Kind seine Linie; ein Sitz ohne Linie niemanden; die Orchestratorin jeden, die Sitze des Owners streng; eine persönliche Nachricht zählt und geht nie mit", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    const { lead, bauer, pruefer } = await aufbau(f, env);
    const [brief, ausLead, ausBauer, ausEigen, ausOrch, ohne] = await life(f, [
      as(lead, post("/api/self/messages", { to: { kind: "session", slot: bauer }, payload: { kind: "text", text: GEHEIM }, idempotencyKey: "g1", personal: true })),
      as(lead, get(BILD)), as(tokenOf(f, bauer), get(BILD)), as(tokenOf(f, 4), get(BILD)), as(tokenOf(f, 5), get(BILD)),
      { ...get(BILD), token: null }], env);
    expect(brief?.status).toBe(200);
    expect([ausLead, ausBauer, ausEigen, ausOrch].map((a) => a?.status)).toEqual([200, 200, 200, 200]);
    expect(ohne?.status).toBe(401);

    // die Leiterin: ihre zwei Kinder, nichts sonst
    expect(ausLead?.body.me).toMatchObject({ slot: 1, scope: "line" });
    expect(zeilen(ausLead).map((z) => [z.slot, z.relation])).toEqual([[bauer, "child"], [pruefer, "child"]]);
    const b = zeile(ausLead, bauer)!;
    expect(b).toMatchObject({ name: "Bauer", model: "claude-haiku-5-5", state: "live", openedBy: { slot: 1, live: true } });
    expect(typeof b.since).toBe("number");
    for (const feld of ["harness", "effort", "waits", "ctxPct", "cacheWarm", "idleMs", "branch", "unknown"]) expect(b).toHaveProperty(feld);
    // die Post: gezählt, mit ihrem Moment, nie mit Text
    expect(b.waits).toContainEqual({ kind: "mail", count: 1, oldestAt: expect.any(Number) });
    // der Ersatz-Agent schreibt kein Transkript, und in einem Leben läuft der Git-Tick nicht: Kontext, Cache und Branch sind unbekannt mit Grund
    expect([b.ctxPct, b.cacheWarm, b.branch]).toEqual([null, null, null]);
    expect(Object.keys(b.unknown)).toEqual(expect.arrayContaining(["ctxPct", "cacheWarm", "branch"]));
    expect(b.unknown.branch).toMatch(/^the git tick has not read this occupant yet/);
    for (const feld of Object.keys(b.unknown)) expect(b.unknown[feld]).toEqual(expect.any(String));
    expect(Object.keys(ausLead?.body.sources as object)).toEqual(expect.arrayContaining(["state", "since", "openedBy", "waits.mail", "ctxPct", "cacheWarm", "idleMs", "branch"]));

    // das Kind: die Öffnerin und das Geschwister, ohne den Öffner-Teil
    expect(zeilen(ausBauer).map((z) => [z.slot, z.relation, "idleMs" in z])).toEqual([[1, "opener", false], [pruefer, "sibling", false]]);
    // ein Sitz des Owners ohne Linie: niemand
    expect(zeilen(ausEigen)).toEqual([]);

    // die Orchestratorin: jeden Sitz; die des Owners (Leiterin und Slot 4) nur Platz, Zustand, „[Zitat entfernt]“
    expect(ausOrch?.body.me).toMatchObject({ slot: 5, scope: "fleet" });
    expect(zeilen(ausOrch).map((z) => [z.slot, z.relation])).toEqual([[1, "owner-seat"], [bauer, "fleet"], [pruefer, "fleet"], [4, "owner-seat"]]);
    expect(zeile(ausOrch, 4)).toEqual({ slot: 4, relation: "owner-seat", state: "live" });
    // ihr Öffner-Teil an einem Sitz, der keiner des Owners ist: der Ersatz-Agent gab nie Ausgabe, also unbekannt mit Grund
    expect(zeile(ausOrch, bauer)).toMatchObject({ name: "Bauer", openedBy: { slot: 1, live: true }, idleMs: null, unknown: { idleMs: "the pane's output was never observed" } });
    expect(JSON.stringify(ausOrch?.body)).not.toContain("Mein eigener Agent");

    // die Datengrenze: der Text der persönlichen Nachricht steht in keiner Antwort
    for (const a of [ausLead, ausBauer, ausEigen, ausOrch]) expect(JSON.stringify(a?.body)).not.toContain("12/345/67890");
  }, LIFE_DEADLINE_MS * 4);

  test("ein Kind auf einem Branch, bevor der Git-Tick es las: Branch null mit Grund — die Tür ruft kein git, sie rät nicht", async () => {
    const f = fixture();
    const [br] = await life(f, [post("/api/branches", { repo: f.repo, name: "Lagebild Probe" }), "save"]);
    expect(br?.status).toBe(201);
    await life(f, [post("/api/slots/1/open", { cwd: f.repo, label: "Leiterin" }), "save"]);
    const lead = tokenOf(f, 1);
    const [kind] = await life(f, [as(lead, post("/api/self/branches/open", { branch: String(br?.body.branch) })), "save"]);
    expect([kind?.status, kind?.body.error]).toEqual([200, undefined]);
    const slot = Number(kind?.body.slot);
    const [bild] = await life(f, [as(lead, get(BILD))]);
    const z = zeile(bild, slot)!;
    expect(z.relation).toBe("child");
    expect(z.branch).toBeNull();
    expect(z.unknown.branch).toMatch(/^the git tick has not read this occupant yet/);
    // die eigene Zeile der Leiterin steht unter me.seat
    expect((bild?.body.me as { seat: Zeile }).seat).toMatchObject({ slot: 1, relation: "self", name: "Leiterin" });
  }, LIFE_DEADLINE_MS * 4);
});

// RUNDE 2 (~/local-notes/lagebild/pruefung.md C1-2, C1-3): ein langlebiger Server, dessen Ticks laufen. Ein git-Ersatz vor dem echten zählt
// jeden git-Aufruf des Servers (die Panes und der Server finden ihn zuerst im PATH, branches-testkit#PANE_PATH).
describe("GET /api/self/overview am laufenden Server", () => {
  test("C1-2 und C1-3: ein Kind im eigenen Worktree außerhalb des Branch-Buchs zeigt Branch und Kopf aus dem Git-Tick; zehn Aufrufe der Orchestratorin machen weniger als einen git-Aufruf je Aufruf", async () => {
    const f = fixture();
    const LOG = join(dirname(f.repo), "git-aufrufe.log");
    const echt = Bun.which("git", { PATH: (process.env.PATH ?? "").split(":").filter((d) => d !== BIN).join(":") });
    if (!echt) throw new Error("kein echtes git");
    writeFileSync(join(BIN, "git"), `#!/bin/sh\necho "$1" >> "${LOG}"\nexec "${echt}" "$@"\n`, { mode: 0o755 });
    const wt = join(wurzel(f), "wt-a");
    sh(f.repo, "worktree", "add", "-q", "-b", "feat-a", wt);
    const head = sh(wt, "rev-parse", "HEAD").trim();
    const srv = await serve(f, { FLEET_SELF_SEAT_ROOT: wurzel(f), FLEET_GIT_TICK_MS: "1000" });
    // der Server endet mit dem Test: cleanup() wartet nicht auf ihn (docs/neuaufbau/maengel.md Nr. 183)
    try {
      const token = async (slot: number): Promise<string> => {
        for (let i = 0; i < 100; i++) { try { return tokenOf(f, slot); } catch { await Bun.sleep(100); } }
        return tokenOf(f, slot);
      };
      expect((await srv.call("/api/slots/9/open", { body: { cwd: ordner(f, "orch"), label: "🎛 Orchestratorin" } })).status).toBe(200);
      const orch = await token(9);
      const a = await srv.call(OPEN, { self: orch, body: { cwd: wt, goal: "Baue A.", label: "Kind A" } });
      const b = await srv.call(OPEN, { self: orch, body: { cwd: ordner(f, "b"), goal: "Baue B.", label: "Kind B" } });
      expect([a.status, b.status]).toEqual([200, 200]);
      const kindA = Number(a.body.slot);
      // bis der Git-Tick Kind A gelesen hat
      let bild = await srv.call(BILD, { self: orch });
      for (let i = 0; i < 100 && !(zeile(bild as Answer, kindA)?.branch); i++) { await Bun.sleep(150); bild = await srv.call(BILD, { self: orch }); }
      const z = zeile(bild as Answer, kindA)!;
      expect(z.branch).toMatchObject({ name: "feat-a", head });
      expect(z.unknown["branch.check"]).toMatch(/no merge check/);
      expect(String((bild.body.sources as Record<string, string>).branch)).toMatch(/git tick .*last run \d{4}-.* s before this answer/);

      // gleich nach einem Takt des Git-Ticks (sein Zeitpunkt steht im Quellsatz): zehn Aufrufe, dann die git-Aufrufe dazwischen zählen
      const takt = (x: { body: Record<string, unknown> }) => /last run (\S+),/.exec(String((x.body.sources as Record<string, string> | undefined)?.branch ?? ""))?.[1] ?? null;
      const vorher = takt(await srv.call(BILD, { self: orch }));
      for (let i = 0; i < 80; i++) { const jetzt = takt(await srv.call(BILD, { self: orch })); if (jetzt && jetzt !== vorher) break; await Bun.sleep(50); }
      const zeilen0 = existsSync(LOG) ? readFileSync(LOG, "utf8").split("\n").filter(Boolean).length : 0;
      const antworten = [];
      for (let i = 0; i < 10; i++) antworten.push(await srv.call(BILD, { self: orch }));
      const zeilen1 = readFileSync(LOG, "utf8").split("\n").filter(Boolean).length;
      expect(antworten.every((x) => x.status === 200)).toBe(true);
      console.log(`git calls during ten overview calls of the Orchestratorin: ${zeilen1 - zeilen0}`);
      expect(zeilen1 - zeilen0).toBeLessThan(10);
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 4);
});

// RUNDE 3 (C1-8, C1-9, C1-10): ein Branch im Buch mit einem Merge-Check, ein Sitz ohne git, und ein Git-Tick, der hängt. Der git-Ersatz hält jeden
// `git status` des Servers an, solange die Datei HALT liegt — so bleibt der Git-Tick aus, wie die Prüfung ihn ausbleiben sah.
describe("GET /api/self/overview, Runde 3", () => {
  test("C1-8 stale gegen eine andere Basis wie das Board, grün gegen die eigene; C1-9 ein Sitz ohne git sagt es; C1-10 ein hängender Tick zeigt keinen alten Kopf als gültig", async () => {
    const f = fixture();
    const HALT = join(dirname(f.repo), "HALT");
    const echt = Bun.which("git", { PATH: (process.env.PATH ?? "").split(":").filter((d) => d !== BIN).join(":") });
    if (!echt) throw new Error("kein echtes git");
    // nur `git status` hält an: das ist der Aufruf des Git-Ticks (tickGit: `git -C <dir> status …`, das Wort steht also nicht an erster Stelle), jeder
    // andere git-Aufruf läuft weiter. Bis W3 Auftrag 13 hielt der Ersatz nur bei `$1 = status` an, also nie — der Test bestand, weil der Testserver gar
    // nicht tickte; seit nachbar.drive.ts den Tick fährt, hält er ihn wirklich an
    writeFileSync(join(BIN, "git"), `#!/bin/sh\nfor a in "$@"; do if [ "$a" = status ]; then while [ -e "${HALT}" ]; do sleep 0.1; done; fi; done\nexec "${echt}" "$@"\n`, { mode: 0o755 });
    mkdirSync(join(f.repo, "ci"));
    writeFileSync(join(f.repo, "ci", "merge-check.ts"), "// probe\n");
    sh(f.repo, "add", "ci/merge-check.ts");
    sh(f.repo, "commit", "-q", "-m", "merge check");
    const srv = await serve(f, { FLEET_SELF_SEAT_ROOT: wurzel(f), FLEET_GIT_TICK_MS: "1000" });
    // der Server endet mit dem Test: cleanup() wartet nicht auf ihn (docs/neuaufbau/maengel.md Nr. 183)
    try {
      const token = async (slot: number): Promise<string> => {
        for (let i = 0; i < 100; i++) { try { return tokenOf(f, slot); } catch { await Bun.sleep(100); } }
        return tokenOf(f, slot);
      };
      // im Repo: die Branch-Tür öffnet einen Branch des eigenen Repos
      expect((await srv.call("/api/slots/9/open", { body: { cwd: f.repo, label: "🎛 Orchestratorin" } })).status).toBe(200);
      const orch = await token(9);
      const br = await srv.call("/api/branches", { body: { repo: f.repo, name: "Probe Drei", base: "main" } });
      expect(br.status).toBe(201);
      const branch = String(br.body.branch);
      const k = await srv.call("/api/self/branches/open", { self: orch, body: { branch } });
      const b = await srv.call(OPEN, { self: orch, body: { cwd: ordner(f, "ohne-git"), goal: "Baue B.", label: "Kind B" } });
      expect([k.status, b.status]).toEqual([200, 200]);
      const kind = Number(k.body.slot), ohne = Number(b.body.slot);
      const bis = async (pred: (z: Zeile | undefined, o: Zeile | undefined) => boolean, ms = 15_000) => {
        let a = await srv.call(BILD, { self: orch });
        for (const end = Date.now() + ms; !pred(zeile(a as Answer, kind), zeile(a as Answer, ohne)) && Date.now() < end; ) { await Bun.sleep(150); a = await srv.call(BILD, { self: orch }); }
        return { k: zeile(a as Answer, kind)!, o: zeile(a as Answer, ohne)! };
      };
      const head = sh(f.repo, "rev-parse", `refs/heads/${branch}`).trim();
      // der Merge-Check prüfte diesen Tip, aber gegen eine andere Basis: das Board sagt stale, die Übersicht auch
      const ledger = join(f.repo, ".git", "merge-checks.jsonl");
      writeFileSync(ledger, JSON.stringify({ at: Date.now(), branch, tip: head, base: "elsewhere", mergeable: true, verdict: "green" }) + "\n");
      const stale = await bis((z) => z?.branch?.check?.state === "stale");
      expect(stale.k.branch).toEqual({ name: branch, head, check: { state: "stale", at: expect.any(Number) } });
      writeFileSync(ledger, JSON.stringify({ at: Date.now(), branch, tip: head, base: "main", mergeable: true, verdict: "green" }) + "\n");
      expect((await bis((z) => z?.branch?.check?.state === "green")).k.branch?.check?.state).toBe("green");
      // C1-9: der Sitz ohne git
      const o = (await bis((_z, x) => /no git checkout/.test(String(x?.unknown?.branch)))).o;
      expect(o.unknown.branch).toMatch(/^the seat works in no git checkout/);

      // C1-10: der Tick hängt, ein neuer Commit kommt — nach mehr als zwei Takten ist der alte Kopf kein gültiger Kopf mehr
      writeFileSync(HALT, "");
      try {
        const wt = String(k.body.path ?? "") || sh(f.repo, "worktree", "list", "--porcelain").split("\n").find((l) => l.startsWith("worktree ") && l.includes(branch.split("/").pop()!))!.slice(9);
        writeFileSync(join(wt, "neu.txt"), "neu\n");
        sh(wt, "add", "neu.txt");
        sh(wt, "commit", "-q", "-m", "neu");
        await Bun.sleep(3500);
        const alt = (await srv.call(BILD, { self: orch })) as Answer;
        const z = zeile(alt, kind)!;
        expect(z.branch).toMatchObject({ name: branch, head: null, check: null });
        expect(z.unknown["branch.head"]).toMatch(/^the git tick last ran \d+ s ago \(more than two ticks of 1 s\)/);
      } finally { rmSync(HALT, { force: true }); }
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 4);
});

// RUNDE 4 (C1-12): ein frischer Branch, den die Self-Tür anlegt — ohne eigene Basis, ohne Land, ohne repoBases. Die Branch-Sicht des Boards nimmt
// dann den Integrationszweig (chargeBase ← integrationBranch: der Branch des primären Checkouts), und die Übersicht nennt dieselbe Basis.
describe("GET /api/self/overview, Runde 4", () => {
  test("C1-12: ein frischer Branch der Self-Tür ohne Basis, ohne Land, ohne repoBases: der Check gegen main ist green, gegen eine andere Basis stale — wie das Board", async () => {
    const f = fixture();
    mkdirSync(join(f.repo, "ci"));
    writeFileSync(join(f.repo, "ci", "merge-check.ts"), "// probe\n");
    sh(f.repo, "add", "ci/merge-check.ts");
    sh(f.repo, "commit", "-q", "-m", "merge check");
    const srv = await serve(f, { FLEET_SELF_SEAT_ROOT: wurzel(f), FLEET_GIT_TICK_MS: "1000" });
    // der Server endet mit dem Test: cleanup() wartet nicht auf ihn (docs/neuaufbau/maengel.md Nr. 183)
    try {
      expect((await srv.call("/api/slots/9/open", { body: { cwd: f.repo, label: "🎛 Orchestratorin" } })).status).toBe(200);
      let orch = "";
      for (let i = 0; i < 100 && !orch; i++) { try { orch = tokenOf(f, 9); } catch { await Bun.sleep(100); } }
      const neu = await srv.call("/api/self/branches", { self: orch, body: { name: "Frisch Vier" } });
      expect(neu.status).toBe(201);
      const branch = String(neu.body.branch);
      const k = await srv.call("/api/self/branches/open", { self: orch, body: { branch } });
      expect(k.status).toBe(200);
      const kind = Number(k.body.slot);
      // die Voraussetzung, wie die Prüfung sie nennt: keine eigene Basis, kein Land, kein repoBases-Eintrag
      const board = await srv.call("/api/branches");
      const row = ((board.body.repos as { branches: Record<string, any>[] }[]).flatMap((r) => r.branches)).find((b) => b.branch === branch)!;
      // das Board leitet die Basis ab (die eigene ist leer); der Datensatz im Buch trägt keine
      expect([row.base, row.lands.length, row.chargeBase]).toEqual(["main", 0, "main"]);
      const rec = ((persisted(f) as { branches?: { branch: string; base: string | null }[] }).branches ?? []).find((r) => r.branch === branch);
      expect(rec ? rec.base : "kein Datensatz").toBeNull();
      expect((persisted(f) as { repoBases?: Record<string, string> }).repoBases?.[f.repo]).toBeUndefined();
      const head = sh(f.repo, "rev-parse", `refs/heads/${branch}`).trim();
      const ledger = join(f.repo, ".git", "merge-checks.jsonl");
      const pruefe = async (base: string, soll: string) => {
        writeFileSync(ledger, JSON.stringify({ at: Date.now(), branch, tip: head, base, mergeable: true, verdict: "green" }) + "\n");
        let z: Zeile | undefined;
        for (const end = Date.now() + 15_000; Date.now() < end; await Bun.sleep(150)) {
          z = zeile((await srv.call(BILD, { self: orch })) as Answer, kind);
          if (z?.branch?.check?.state === soll) break;
        }
        return z!;
      };
      const gruen = await pruefe("main", "green");
      expect(gruen.branch).toEqual({ name: branch, head, check: { state: "green", at: expect.any(Number) } });
      expect(gruen.unknown["branch.check"]).toBeUndefined();
      expect((await pruefe("elsewhere", "stale")).branch?.check?.state).toBe("stale");
      // und das Board sagt dasselbe
      const b2 = await srv.call("/api/branches");
      expect(((b2.body.repos as { branches: Record<string, any>[] }[]).flatMap((r) => r.branches)).find((b) => b.branch === branch)!.check.state).toBe("stale");
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 4);
});

// DAS RECHT overview.fleet (W3 Auftrag 11): der eigene Agent des Owners ist ein freier Sitz, den niemand öffnete und der niemanden öffnete — ohne das
// Recht sieht er seine Linie, also niemanden. Der Owner gibt ihm das Recht am laufenden Sitz (POST /api/slots/<n>/rechte {grant}), ohne ihn neu zu
// öffnen; danach sieht er jeden Sitz wie die Orchestratorin, mit still seit, Branch, Kopf und Check — die eigenen Sitze des Owners streng. Die
// Orchestratorin behält, was sie hat.
describe("GET /api/self/overview mit dem Recht overview.fleet", () => {
  test("ein freier Sitz ohne das Recht sieht seine Linie (niemanden); mit dem Recht am laufenden Sitz jeden Sitz mit still seit und Branch, die des Owners streng", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    const { bauer, pruefer } = await aufbau(f, env);
    const eigen = tokenOf(f, 4);
    const [ohne] = await life(f, [as(eigen, get(BILD))], env);
    expect(ohne?.status).toBe(200);
    expect((ohne?.body.me as { scope: string }).scope).toBe("line");
    expect(zeilen(ohne)).toEqual([]);
    // der Owner gibt das Recht dem laufenden Sitz: dieselbe Belegung, kein neues Öffnen
    const vorher = (persisted(f).slots as Record<string, { openedAt: number }>)["4"]!.openedAt;
    const [frei] = await life(f, [post("/api/slots/4/rechte", { grant: ["overview.fleet"] })], env);
    expect(frei?.status).toBe(200);
    expect((persisted(f).slots as Record<string, { openedAt: number }>)["4"]!.openedAt).toBe(vorher);
    const [mit, orch] = await life(f, [as(eigen, get(BILD)), as(tokenOf(f, 5), get(BILD))], env);
    expect((mit?.body.me as { scope: string }).scope).toBe("fleet");
    expect(String((mit?.body.me as { scopeRule: string }).scopeRule)).toContain("overview.fleet");
    // die Leiterin ist ein Sitz des Owners: nur Platz, Beziehung und Zustand
    expect(zeile(mit, 1)).toEqual({ slot: 1, relation: "owner-seat", state: "live" });
    // die Kinder der Leiterin und die Orchestratorin: ganze Zeilen mit dem, was liegen bleibt — still seit, Branch, Kopf und Check —, wie die
    // Orchestratorin sie bekommt (Entscheid der Orchestratorin zu Auftrag 11)
    for (const n of [bauer, pruefer, 5]) {
      expect(zeile(mit, n)?.relation).toBe("fleet");
      expect(zeile(mit, n)?.name).toBeTruthy();
      expect({ n, idle: "idleMs" in zeile(mit, n)!, branch: "branch" in zeile(mit, n)! }).toEqual({ n, idle: true, branch: true });
    }
    // die Orchestratorin wie bisher: jeden Sitz, mit den Details der Öffnerin außer bei denen des Owners
    expect((orch?.body.me as { scope: string }).scope).toBe("fleet");
    expect("idleMs" in zeile(orch, bauer)!).toBe(true);
    expect(zeile(orch, 4)).toEqual({ slot: 4, relation: "owner-seat", state: "live" });
  }, LIFE_DEADLINE_MS * 8);
  // W3 Auftrag 14: overview.fleet gibt nur der Owner, einem Sitz, über seine Tür — kein Kind bekommt es (nicht im Body, nicht geerbt), keine gebildete Rolle
  // trägt es; die Orchestratorin behält es für sich
  test("nur der Owner gibt overview.fleet: das Kind der Orchestratorin mit dem Recht 409, ohne bleibt es bei der Linie; ein Kind eines berechtigten Sitzes erbt es nicht; role.form weist es ab", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    await aufbau(f, env);
    const orch = tokenOf(f, 5);
    const [mitRecht, ohneRecht] = await life(f, [as(orch, post(OPEN, { cwd: ordner(f, "h1"), goal: "Sieh zu.", label: "Kind H1", rechte: { recht: ["overview.fleet"] } })),
      as(orch, post(OPEN, { cwd: ordner(f, "h2"), goal: "Sieh zu.", label: "Kind H2" }))], env);
    expect(mitRecht?.status).toBe(409);
    expect(String(mitRecht?.body.error)).toContain("overview.fleet");
    expect(ohneRecht?.status).toBe(200);
    // der eigene Agent des Owners hat das Recht; sein Kind ohne eigene rechte erbt es nicht
    await life(f, [post("/api/slots/4/rechte", { grant: ["overview.fleet"] })], env);
    const [enkel] = await life(f, [as(tokenOf(f, 4), post(OPEN, { cwd: ordner(f, "e1"), goal: "Hilf.", label: "Kind E1" }))], env);
    expect(enkel?.status).toBe(200);
    const [h2, e1, vier] = await life(f, [as(tokenOf(f, Number(ohneRecht?.body.slot)), get(BILD)), as(tokenOf(f, Number(enkel?.body.slot)), get(BILD)), as(tokenOf(f, 4), get(BILD))], env);
    expect((h2?.body.me as { scope: string }).scope).toBe("line");
    expect((e1?.body.me as { scope: string }).scope).toBe("line");
    expect((vier?.body.me as { scope: string }).scope).toBe("fleet");
    // eine gebildete Rolle trägt es nie, auch wenn die Bildnerin es hat
    await life(f, [post("/api/slots/5/rechte", { grant: ["role.form"] })], env);
    const [rolle] = await life(f, [as(orch, post("/api/self/roles", { name: "Beobachter", text: "Sieh jeden Sitz.", rights: ["overview.fleet"] }))], env);
    expect(rolle?.status).toBe(409);
    expect(rolle?.body.missingRight).toBe("overview.fleet");
  }, LIFE_DEADLINE_MS * 10);

  test("der Owner nimmt overview.fleet zurück: dieselbe Belegung sieht wieder ihre Linie, das Audit sagt rechte_revoke", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    await aufbau(f, env);
    const eigen = tokenOf(f, 4);
    await life(f, [post("/api/slots/4/rechte", { grant: ["overview.fleet"] })], env);
    const vorher = (persisted(f).slots as Record<string, { openedAt: number }>)["4"]!.openedAt;
    const [mit] = await life(f, [as(eigen, get(BILD))], env);
    expect((mit?.body.me as { scope: string }).scope).toBe("fleet");
    const [zurueck] = await life(f, [post("/api/slots/4/rechte", { revoke: ["overview.fleet"] })], env);
    expect(zurueck?.status).toBe(200);
    expect(zurueck?.body.revoked).toEqual(["overview.fleet"]);
    expect((persisted(f).slots as Record<string, { openedAt: number }>)["4"]!.openedAt).toBe(vorher);
    const [ohne] = await life(f, [as(eigen, get(BILD))], env);
    expect((ohne?.body.me as { scope: string }).scope).toBe("line");
    expect(zeilen(ohne)).toEqual([]);
    const audit = readFileSync(join(f.state, "audit.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as { event: string; detail?: string });
    expect(audit.filter((r) => r.event === "rechte_revoke").map((r) => String(r.detail).split(" ")[0])).toEqual(["revoke=overview.fleet"]);
  }, LIFE_DEADLINE_MS * 8);
});
