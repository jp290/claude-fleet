// bau/ohne-owner-token: Orchestratorin und Program-MAIN erreichen ihre Alltagstüren mit dem eigenen Self-Token, nicht mit
// dem Owner-Token aus fleet.json (docs/ohne-owner-token/inventar.md). Je Tür: die Rolle kommt durch, jede andere Session
// (Lane, fremde MAIN, freie Session, Steward) nicht.
//
// Jedes `life` ist ein Leben des Servers in einem eigenen Prozess (server/branches.drive.ts, server/branches-testkit.ts).
// Die Besetzung baut `cast`: Slot 1 trägt das Orchestrator-Label, Slot 2 ist die gebundene MAIN eines aktiven Programs,
// Slot 3 eine freie Session, Slot 4 der Steward, Slot 5 die gebundene MAIN eines zweiten Programs in einem zweiten Repo
// (die fremde MAIN), dazu eine Lane. Die Bindung schreibt der Test in fleet.json zwischen zwei Leben — der Gründungsweg einer MAIN braucht einen
// Agenten, und gebunden ist eine MAIN genau dann, wenn ein aktives Program ihr Belegen nennt (server.ts#boundProgramsForMain).
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { branchTestkit, type Fixture, get, LIFE_DEADLINE_MS, persisted, post, sh } from "./branches-testkit";

const { fixture, life, cleanup, SOCKETS } = branchTestkit();
afterAll(cleanup);

export const ORCH = 1, MAIN = 2, FREE = 3, STEWARD = 4, OTHER_MAIN = 5;
type Seat = { openedAt: number; selfToken: string; label: string | null; worktree: unknown };
const seats = (f: Fixture): Record<string, Seat> => persisted(f).slots as Record<string, Seat>;
const seat = (f: Fixture, slot: number): Seat => {
  const s = seats(f)[String(slot)];
  if (!s?.openedAt || !s.selfToken) throw new Error(`Slot ${slot} ist in fleet.json nicht besetzt`);
  return s;
};
// wie viele Panes des Fixtures den Steward-Token in ihrem Startbefehl exportieren (gezählt, nie gedruckt)
const stewardPanes = (f: Fixture): number => Bun.spawnSync(["tmux", "-L", f.sock, "list-panes", "-a", "-F", "#{pane_start_command}"],
  { env: { ...process.env, TMUX_TMPDIR: SOCKETS } }).stdout.toString().split("\n").filter((l) => l.includes("FLEET_STEWARD_TOKEN")).length;
const as = (self: string, step: { method: string; path: string; body?: unknown }) => ({ ...step, token: null, self });
const PROGRAM = { title: "Probe", intent: "Probe", successCriterion: "Probe", nonGoals: [], decisions: [], evidence: [],
  openQuestions: [] };

interface Cast { f: Fixture; other: string; lane: number; otherLane: number; token: (slot: number) => string; programs: [string, string] }
async function cast(): Promise<Cast> {
  const f = fixture();
  const other = join(f.state, "..", "other");
  mkdirSync(other);
  sh(other, "init", "-q", "-b", "main");
  sh(other, "commit", "-q", "--allow-empty", "-m", "start");
  const answers = await life(f, [
    post(`/api/slots/${ORCH}/open`, { cwd: f.repo, label: "🎛 Orchestratorin" }),
    post(`/api/slots/${MAIN}/open`, { cwd: f.repo, label: "MAIN" }),
    post(`/api/slots/${FREE}/open`, { cwd: f.repo, label: "frei" }),
    post(`/api/slots/${STEWARD}/open`, { cwd: f.repo, label: "⚙ steward" }),
    post(`/api/slots/${OTHER_MAIN}/open`, { cwd: other, label: "fremde MAIN" }),
    post("/api/lanes", { repo: f.repo }),
    post("/api/programs", PROGRAM),
    post("/api/programs", { ...PROGRAM, title: "Fremd" }),
    post("/api/lanes", { repo: other }),
  ]);
  const bad = answers.find((a) => a.status !== 200 && a.status !== 201);
  if (bad) throw new Error(`Besetzung: ${bad.status} ${JSON.stringify(bad.body).slice(0, 300)}`);
  const lane = Number(answers[5]!.body.slot), otherLane = Number(answers[8]!.body.slot);
  const ids = [answers[6]!, answers[7]!].map((a) => String((a.body.program as { id: string }).id)) as [string, string];
  // die zwei Programs aktiv und je an ihre MAIN gebunden
  const state = persisted(f);
  const now = Date.now();
  const bind = (id: string, slot: number) => {
    const s = seat(f, slot);
    return { status: "active", confirmedAt: now, activatedAt: now, main: { slot, openedAt: s.openedAt, sessionId: null, boundAt: now } };
  };
  state.programs = (state.programs as { id: string }[]).map((p) =>
    p.id === ids[0] ? { ...p, ...bind(ids[0], MAIN) } : p.id === ids[1] ? { ...p, ...bind(ids[1], OTHER_MAIN) } : p);
  writeFileSync(join(f.state, "fleet.json"), JSON.stringify(state, null, 2));
  return { f, other, lane, otherLane, token: (slot) => seat(f, slot).selfToken, programs: ids };
}

describe("Schnitt 0 · ein Orchestrator-Label geht per Self-Nachfolge nur von der Orchestratorin weiter", () => {
  test("die Besetzung: Rollen wie gedacht", async () => {
    const c = await cast();
    const rows = await life(c.f, [ORCH, MAIN, FREE, OTHER_MAIN, c.lane].map((slot) => as(c.token(slot), get("/api/self"))));
    expect(rows.map((r) => (r.body.position as { role?: string } | undefined)?.role))
      .toEqual(["orchestrator", "program-main", "generic", "program-main", "lane"]);
  }, LIFE_DEADLINE_MS * 3);

  test("freie Session, MAIN, fremde MAIN und Lane: Nachfolge mit Orchestrator-Label → 409; die Orchestratorin nicht", async () => {
    const c = await cast();
    const claim = (slot: number) => as(c.token(slot), post("/api/self/succeed", { label: "🎛 Orchestratorin" }));
    const [free, main, other, orch] = await life(c.f, [claim(FREE), claim(MAIN), claim(OTHER_MAIN), claim(ORCH)],
      { FLEET_FOUNDING_BOOT_GRACE_MS: "250", FLEET_READY_WAIT_MS: "500" });
    for (const r of [free, main, other]) {
      expect(r?.status).toBe(409);
      expect(String(r?.body.error)).toContain("Orchestrator label passes only from the Orchestratorin");
    }
    expect(String(orch?.body.error ?? "")).not.toContain("Orchestrator label");
    // nur Slot 1 trägt nach diesem Leben ein Orchestrator-Label
    const labels = Object.entries(seats(c.f)).filter(([, s]) => s.openedAt && !s.worktree && /🎛|orchestrator/i.test(s.label ?? ""))
      .map(([slot]) => Number(slot));
    expect(labels).toEqual([ORCH]);
  }, LIFE_DEADLINE_MS * 3);

  // Gegenspieler-Fund A1/A3 (19.10.): das Steward-Label ist allein die Rolle — ensureSlot exportiert FLEET_STEWARD_TOKEN darauf
  test("das Steward-Label gibt keine Self-Nachfolge weiter: freie Session, MAIN, Orchestratorin und Lane → 409", async () => {
    const c = await cast();
    const [primed] = await life(c.f, [get("/api/sessions")]);
    expect(primed?.status).toBe(200);
    const exportsBefore = stewardPanes(c.f);
    expect(exportsBefore).toBe(1); // die Steward-Pane selbst, sonst zählte die Prüfung unten nichts
    const claim = (slot: number) => as(c.token(slot), post("/api/self/succeed", { label: "⚙ steward" }));
    const answers = await life(c.f, [claim(FREE), claim(MAIN), claim(ORCH), claim(c.lane)],
      { FLEET_FOUNDING_BOOT_GRACE_MS: "250", FLEET_READY_WAIT_MS: "500" });
    expect(answers.map((a) => a.status)).toEqual([409, 409, 409, 409]);
    expect(stewardPanes(c.f)).toBe(exportsBefore);
    for (const a of answers) expect(String(a.body.error)).toContain("steward label is a role");
    const stewards = Object.entries(seats(c.f)).filter(([, s]) => s.openedAt && s.label === "⚙ steward").map(([slot]) => Number(slot));
    expect(stewards).toEqual([STEWARD]);
  }, LIFE_DEADLINE_MS * 3);

  // Gegenspieler-Fund L0b: eine Branch-Session hat kein worktree-Feld und zählt für die Rolle wie eine freie Session
  test("eine Branch-Session gibt kein Orchestrator-Label weiter", async () => {
    const c = await cast();
    const [made, opened] = await life(c.f, [post("/api/branches", { repo: c.f.repo, name: "Probe" }),
      post("/api/branches/open", { repo: c.f.repo, branch: "branch/probe" })]);
    expect([made?.status, opened?.status]).toEqual([201, 200]);
    const branch = Number(opened?.body.slot);
    const [claim] = await life(c.f, [as(c.token(branch), post("/api/self/succeed", { label: "🎛 Orchestratorin" }))],
      { FLEET_FOUNDING_BOOT_GRACE_MS: "250", FLEET_READY_WAIT_MS: "500" });
    expect(claim?.status).toBe(409);
    expect(seats(c.f)[String(branch)]?.label).toBe("Probe");
  }, LIFE_DEADLINE_MS * 3);

  test("ein Label ohne Rollenanspruch geht weiter wie bisher", async () => {
    const c = await cast();
    const [free] = await life(c.f, [as(c.token(FREE), post("/api/self/succeed", { label: "frei, zweite" }))],
      { FLEET_FOUNDING_BOOT_GRACE_MS: "250", FLEET_READY_WAIT_MS: "500" });
    expect(String(free?.body.error ?? "")).not.toContain("Orchestrator label");
    expect(seats(c.f)[String(FREE)]?.label).toBe("frei, zweite");
  }, LIFE_DEADLINE_MS * 3);
});

// ein Tier-2-Befehl und eine lange Ruhefrist: der Audit wird eingereiht und bleibt stehen, solange das Leben dauert
// (server/succession-rearm.test.ts); FLEET_REPO_DIR legt den Server-Repo auf das Fixture, sonst wäre es dieser Checkout
const tipEnv = (f: Fixture) => ({ FLEET_REPO_DIR: f.repo, FLEET_POSTLAND_AUDIT_CMD: "true", FLEET_AUDIT_HELPER_GRACE_MS: "60000" });
type AuditLine = { event: string; slot?: number; detail?: string; actor?: { kind?: string; slot?: number; openedAt?: number } };
const auditLines = (f: Fixture, event: string): AuditLine[] =>
  readFileSync(join(f.state, "audit.jsonl"), "utf8").split("\n").filter(Boolean)
    .map((l) => JSON.parse(l) as AuditLine).filter((l) => l.event === event);

describe("Schnitt 1 · POST /api/self/repos/audit-tip", () => {
  // Gegenspieler-Fund S1-1: der Tip ist der des Server-Repos, die MAIN eines anderen Projekts hat dort nichts einzureihen
  test("die gebundene MAIN eines anderen Repos bekommt 409", async () => {
    const c = await cast();
    const [other] = await life(c.f, [as(c.token(OTHER_MAIN), post("/api/self/repos/audit-tip", {}))], tipEnv(c.f));
    expect(other?.status).toBe(409);
    expect(String(other?.body.error)).toContain("a Program-MAIN asks from a checkout of that repo");
    expect(auditLines(c.f, "audit_tip")).toEqual([]);
  }, LIFE_DEADLINE_MS * 3);

  test("Orchestratorin und gebundene MAIN kommen durch, das Audit-Log nennt Rolle und Slot", async () => {
    const c = await cast();
    const tip = (slot: number) => as(c.token(slot), post("/api/self/repos/audit-tip", {}));
    const [orch, main] = await life(c.f, [tip(ORCH), tip(MAIN)], tipEnv(c.f));
    expect([orch?.status, orch?.body.queued, orch?.body.target]).toEqual([200, true, sh(c.f.repo, "rev-parse", "main")]);
    expect(main?.status).toBe(200);
    const rows = auditLines(c.f, "audit_tip");
    expect(rows.map((r) => [r.actor?.kind, r.actor?.slot, String(r.detail).split(" target=")[0]])).toEqual([
      ["session", ORCH, `orchestrator slot=${ORCH} openedAt=${seat(c.f, ORCH).openedAt}`],
      ["session", MAIN, `program-main slot=${MAIN} openedAt=${seat(c.f, MAIN).openedAt}`]]);
  }, LIFE_DEADLINE_MS * 3);

  test("Lane, freie Session und Steward bekommen 409, ohne Token 401 — und nichts wird eingereiht", async () => {
    const c = await cast();
    const tip = (slot: number) => as(c.token(slot), post("/api/self/repos/audit-tip", {}));
    const answers = await life(c.f, [tip(c.lane), tip(FREE), tip(STEWARD), { ...post("/api/self/repos/audit-tip", {}), token: null }],
      tipEnv(c.f));
    expect(answers.map((a) => a.status)).toEqual([409, 409, 409, 401]);
    for (const a of answers.slice(0, 3)) expect(String(a.body.error)).toContain("answers the Orchestratorin and a bound Program-MAIN only");
    expect(auditLines(c.f, "audit_tip")).toEqual([]);
  }, LIFE_DEADLINE_MS * 3);

  test("die sha-Sperre gilt an der Self-Tür wie an der Owner-Tür", async () => {
    const c = await cast();
    const [orch] = await life(c.f, [as(c.token(ORCH), post("/api/self/repos/audit-tip", { sha: "0".repeat(40) }))], tipEnv(c.f));
    expect([orch?.status, orch?.body.queued]).toEqual([409, false]);
  }, LIFE_DEADLINE_MS * 3);
});

type MergeRow = { slot: number; name: string | null; running: boolean; last: unknown; lastIs: unknown; lane: { repo: string; branch: string } | null };
describe("Schnitt 2 · GET /api/self/merges", () => {
  test("die Orchestratorin liest jede Lane, eine MAIN nur die Lanes ihres Repos", async () => {
    const c = await cast();
    const read = (slot: number) => as(c.token(slot), get("/api/self/merges"));
    const [orch, main, other, owner] = await life(c.f, [read(ORCH), read(MAIN), read(OTHER_MAIN), get(`/api/slots/${c.lane}/merge`)]);
    const slotsOf = (a: typeof orch) => (a?.body.rows as MergeRow[]).map((r) => r.slot).sort((x, y) => x - y);
    expect([orch?.status, orch?.body.scope, slotsOf(orch)]).toEqual([200, "fleet", [c.lane, c.otherLane].sort((x, y) => x - y)]);
    expect([main?.status, main?.body.scope, slotsOf(main)]).toEqual([200, "repo", [c.lane]]);
    expect([other?.status, slotsOf(other)]).toEqual([200, [c.otherLane]]);
    expect(orch?.body.busy).toEqual([]);
    // dieselbe Lesung wie die Owner-Route, je Zeile
    const row = (main?.body.rows as MergeRow[])[0]!;
    const { slot: _slot, name: _name, ...view } = row;
    expect(owner?.status).toBe(200);
    expect(view as Record<string, unknown>).toEqual(owner?.body ?? {});
    expect([row.running, row.last, row.lane?.repo]).toEqual([false, null, c.f.repo]);
  }, LIFE_DEADLINE_MS * 3);

  test("Lane, freie Session und Steward bekommen 409, ohne Token 401", async () => {
    const c = await cast();
    const read = (slot: number) => as(c.token(slot), get("/api/self/merges"));
    const answers = await life(c.f, [read(c.lane), read(FREE), read(STEWARD), { ...get("/api/self/merges"), token: null }]);
    expect(answers.map((a) => a.status)).toEqual([409, 409, 409, 401]);
    for (const a of answers.slice(0, 3)) expect(a.body.rows).toBeUndefined();
  }, LIFE_DEADLINE_MS * 3);
});

describe("Schnitt 3 · POST /api/self/post-land-audits/adjudicate", () => {
  // ein rotes Audit auf dem Rail, wie es der Audit-Lauf schreibt (nur die Felder, die Urteil und Lesung brauchen)
  const redAudit = (f: Fixture): number => {
    const at = Date.now() - 60_000;
    writeFileSync(join(f.state, "post-land-audits.jsonl"), `${JSON.stringify({ at, result: "red", repo: f.repo,
      main: "main", mainSha: sh(f.repo, "rev-parse", "main"), covers: [], fails: ["probe"], checks: { ran: 1, failed: 1 } })}\n`);
    return at;
  };
  test("die Orchestratorin urteilt mit eigenem Token, und das Ledger nennt sie — auch beim Zurücklesen", async () => {
    const c = await cast();
    const at = redAudit(c.f);
    const judge = (slot: number) => as(c.token(slot), post("/api/self/post-land-audits/adjudicate", { at, verdict: "flake", note: "Probe" }));
    const [orch, back] = await life(c.f, [judge(ORCH), get("/api/post-land-audits?limit=5")]);
    const by = { role: "orchestrator", slot: ORCH, openedAt: seat(c.f, ORCH).openedAt };
    expect([orch?.status, (orch?.body.adjudication as { by?: unknown } | undefined)?.by, orch?.body.result]).toEqual([200, by, "red"]);
    const row = (back?.body.audits as { at: number; adjudication?: { by?: unknown; verdict?: string } }[]).find((r) => r.at === at);
    expect([row?.adjudication?.verdict, row?.adjudication?.by]).toEqual(["flake", by]);
    const line = readFileSync(join(c.f.state, "audit-adjudications.jsonl"), "utf8").trim().split("\n");
    expect(line.length).toBe(1);
    expect(auditLines(c.f, "postland_audit").map((l) => l.actor?.slot)).toEqual([ORCH]);
  }, LIFE_DEADLINE_MS * 3);

  test("MAIN, Lane, freie Session und Steward bekommen 409 und schreiben nichts", async () => {
    const c = await cast();
    const at = redAudit(c.f);
    const judge = (slot: number) => as(c.token(slot), post("/api/self/post-land-audits/adjudicate", { at, verdict: "real" }));
    const answers = await life(c.f, [judge(MAIN), judge(c.lane), judge(FREE), judge(STEWARD)]);
    expect(answers.map((a) => a.status)).toEqual([409, 409, 409, 409]);
    expect(String(answers[0]?.body.error)).toContain("a Program-MAIN raises attention");
    expect(existsSync(join(c.f.state, "audit-adjudications.jsonl"))).toBe(false);
  }, LIFE_DEADLINE_MS * 3);
});

type SelfMessage = { ok?: boolean; error?: string; message?: { id: string } };
// Dass Fleet den Hinweis an die MAIN sofort tippt, prüft e2e/role-address.ts#messageDeliveryChecks („program message“):
// im Testkit läuft kein Tick. Eine fremde MAIN darf einem Program schreiben, ihr Hinweis wartet aber im Bündel.
describe("Schnitt 4 · Post der Orchestratorin an ein Program (ctl.sh send --main in der Pane)", () => {
  const send = (self: string, program: string, key: string) => as(self, post("/api/self/messages",
    { to: { kind: "program", id: program }, payload: { kind: "text", text: "Probe Schnitt 4" }, idempotencyKey: key }));
  test("die Orchestratorin schreibt einem Program, die gebundene MAIN liest es mit Absender Orchestratorin", async () => {
    const c = await cast();
    const [sent, read] = await life(c.f, [send(c.token(ORCH), c.programs[0], "probe-4"),
      as(c.token(MAIN), get("/api/self/messages?unread=1"))]);
    expect([sent?.status, sent?.body.holder, sent?.body.escalatedTo]).toEqual([200, { slot: MAIN, openedAt: seat(c.f, MAIN).openedAt }, null]);
    const entries = read?.body.entries as { id: string; from: unknown }[];
    expect(entries.map((e) => [e.id, e.from])).toEqual([[(sent?.body as SelfMessage).message?.id, { kind: "role", role: "orchestrator" }]]);
  }, LIFE_DEADLINE_MS * 3);

  test("freie Session, Lane und Steward bekommen 409 und schreiben nichts", async () => {
    const c = await cast();
    const answers = await life(c.f, [send(c.token(FREE), c.programs[0], "a"), send(c.token(c.lane), c.programs[0], "b"),
      send(c.token(STEWARD), c.programs[0], "c"), as(c.token(MAIN), get("/api/self/messages?unread=1"))]);
    expect(answers.slice(0, 3).map((a) => a.status)).toEqual([409, 409, 409]);
    expect(answers[3]?.body.entries).toEqual([]);
  }, LIFE_DEADLINE_MS * 3);
});

describe("Schnitt 6 · POST /api/self/branches und /api/self/branches/open", () => {
  test("eine freie Session öffnet einen Branch für eine zweite Session, wird Öffnerin, und die beiden schreiben sich", async () => {
    const c = await cast();
    const [made, opened] = await life(c.f, [
      as(c.token(FREE), post("/api/self/branches", { name: "Partner" })),
      as(c.token(FREE), post("/api/self/branches/open", { branch: "branch/partner", goal: "Prüfe Schnitt 6" }))]);
    expect([made?.status, made?.body.branch, opened?.status]).toEqual([201, "branch/partner", 200]);
    const partner = Number(opened?.body.slot);
    expect(seats(c.f)[String(partner)]?.label).toBe("Partner");
    const note = (from: number, to: number, text: string) => as(c.token(from), post("/api/self/messages",
      { to: { kind: "session", slot: to }, payload: { kind: "text", text }, idempotencyKey: `probe-${from}-${to}` }));
    const [there, back] = await life(c.f, [note(FREE, partner, "Hallo Partner"), note(partner, FREE, "Hallo Öffnerin")]);
    expect([there?.status, (there?.body as SelfMessage).ok, back?.status, (back?.body as SelfMessage).ok]).toEqual([200, true, 200, true]);
  }, LIFE_DEADLINE_MS * 3);

  // Gegenspieler-Fund an Schnitt 6: die ERSTE Nachricht der Orchestratorin an eine Session, die sie geöffnet hat, gab 409
  // (sie sendet als role:orchestrator, die Paar-Regel kannte nur Session-Absender) und ging deshalb über /send mit Owner-Token
  test("die Orchestratorin schreibt die Session, die sie geöffnet hat, ohne replyTo an; eine fremde Session nicht", async () => {
    const c = await cast();
    const [made, opened] = await life(c.f, [
      as(c.token(ORCH), post("/api/self/branches", { name: "Strang" })),
      as(c.token(ORCH), post("/api/self/branches/open", { branch: "branch/strang", goal: "Prüfe die erste Nachricht" }))]);
    expect([made?.status, opened?.status]).toEqual([201, 200]);
    const partner = Number(opened?.body.slot);
    const note = (to: number, key: string) => as(c.token(ORCH), post("/api/self/messages",
      { to: { kind: "session", slot: to }, payload: { kind: "text", text: "Erste Nachricht" }, idempotencyKey: key }));
    const [first, foreign, read] = await life(c.f, [note(partner, "erste"), note(FREE, "fremd"),
      as(c.token(partner), get("/api/self/messages?unread=1"))]);
    expect([first?.status, foreign?.status]).toEqual([200, 409]);
    const entries = read?.body.entries as { id: string; from: unknown }[];
    expect(entries.map((e) => [e.id, e.from])).toEqual([[(first?.body as SelfMessage).message?.id, { kind: "role", role: "orchestrator" }]]);
  }, LIFE_DEADLINE_MS * 3);

  test("Lane und Steward bekommen 409, ein fremdes Repo und ein Rollen-Name auch", async () => {
    const c = await cast();
    const make = (slot: number, body: Record<string, unknown>) => as(c.token(slot), post("/api/self/branches", body));
    const answers = await life(c.f, [make(c.lane, { name: "x" }), make(STEWARD, { name: "x" }),
      make(OTHER_MAIN, { repo: c.f.repo, name: "x" }), make(FREE, { name: "🎛 Orchestratorin" }), make(FREE, { name: "⚙ steward" })]);
    expect(answers.map((a) => a.status)).toEqual([409, 409, 409, 409, 409]);
    expect(String(answers[2]?.body.error)).toContain("its own repo only");
  }, LIFE_DEADLINE_MS * 3);
});
