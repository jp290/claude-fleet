// K16 git-Struktur (auftraege/k16-git-struktur.md, „Fertig heißt“): where a session's circle stands is read off its
// checkout and branch — in front of its lane, behind a branch it works on directly, under its own repo, and none at a
// branch without a session. Owner 17.10. 12:0x: „[Zitat entfernt]“.
import { describe, expect, test } from "bun:test";
import { GS_LEGEND, GS_WORD, cardLines, distanceLine, gitLayout, gitModel, headWords, signOf, signsOf, tiWidth, type GsCard, type GsHead, type GsShape, type GsSign, type GsSlot, type GsWord } from "./gitstruktur";
import type { BranchesRepoView, BranchView, WorkplaceRepo, WorkplaceRow } from "./protocol";

const R1 = "/w/testrepo", R2 = "/w/testrepo2";
const row = (path: string, branch: string, o: Partial<WorkplaceRow> = {}): WorkplaceRow => ({
  path, primary: false, branch, head: "b".repeat(40), base: { branch: "main", head: "a".repeat(40) }, distance: { ahead: 1, behind: 0 },
  dirty: 0, session: null, target: { branch: "main", head: "a".repeat(40), behind: 0, landed: "no", landedAs: null, basis: "land-note" },
  checks: { local: null, preview: null, gate: null, audit: null }, template: null, testinstanz: null, reasons: [], ...o });
const on = (branch: string, slot: number, landed: "yes" | "no" = "no") =>
  ({ target: { branch, head: "a".repeat(40), behind: 0, landed, landedAs: null, basis: "land-note" as const }, session: { slot, openedAt: slot, taskId: null } });
const repo = (path: string, worktrees: WorkplaceRow[]): WorkplaceRepo => ({ repo: path,
  branches: [{ branch: "main", head: "a".repeat(40), distance: { ahead: 0, behind: 0 }, reasons: [] }], worktrees, landNotes: { truncated: false }, reasons: [] });
const bv = (branch: string, o: Partial<BranchView> = {}): BranchView => ({ branch, name: branch, base: "main", head: "c".repeat(40), text: "", rev: 1,
  seen: null, path: null, session: null, distance: { ahead: 2, behind: 0 }, lands: [], landForm: "squash", chargeBase: "main", chargeCommits: 2, check: null, ...o });
const board = (path: string, branches: BranchView[]): BranchesRepoView => ({ repo: path, integration: "main", branches, others: [], othersTotal: 0, reasons: [] });
const slot = (id: number, cwd: string, o: Partial<GsSlot> = {}): GsSlot => ({ id, cwd, label: null, openedAt: id, ...o });
const card = (s: GsSlot): GsCard => ({ name: s.label ?? `Slot ${s.id}`, role: null, agent: "Claude Code", model: null });

// testrepo: main checkout (Orchestrator on main), bau/a in its own worktree with a session directly on it, a lane on
// bau/a, a lane on main, bau/b on the board without any session; testrepo2: one session in its main checkout
const rows1 = [
  row(R1, "main", { primary: true }),
  row("/w/wt/bau-a", "bau/a", { session: { slot: 2, openedAt: 2, taskId: null } }),
  row("/w/wt/lane-a1", "fleet/lane-a1", on("bau/a", 3)),
  row("/w/wt/lane-m1", "fleet/lane-m1", on("main", 4)),
];
const slots: GsSlot[] = [
  slot(1, R1, { label: "Orchestrator", repo: R1, git: { branch: "main" } }),
  slot(2, "/w/wt/bau-a", { label: "Lane-like label", repo: "/w/wt/bau-a", git: { branch: "bau/a" } }),
  slot(3, "/w/wt/lane-a1", { label: "Orchestrator", worktree: { repo: R1, branch: "fleet/lane-a1" } }),
  slot(4, "/w/wt/lane-m1", { worktree: { repo: R1, branch: "fleet/lane-m1" } }),
  slot(5, R2, { repo: R2, git: { branch: "main" } }),
];
const active = (s: number) => s === 1 || s === 3;
const m1 = gitModel(repo(R1, rows1), board(R1, [bv("bau/a", { path: "/w/wt/bau-a", session: { slot: 2, openedAt: 2 } }), bv("bau/b")]), slots, active, card);
const L1 = gitLayout(m1);
const circleOf = (shapes: GsShape[], s: number) => shapes.find((p): p is Extract<GsShape, { t: "circle" }> => p.t === "circle" && p.ses.slot === s);
const rectOf = (shapes: GsShape[], key: string) => shapes.find((p): p is Extract<GsShape, { t: "rect" }> => p.t === "rect" && p.key === key);

describe("where a session's circle stands", () => {
  test("a session in a lane stands in front of the lane, on its row", () => {
    const c = circleOf(L1.shapes, 3)!, r = rectOf(L1.shapes, "lane:fleet/lane-a1")!;
    expect(c.at).toBe("lane:fleet/lane-a1");
    expect(c.y).toBe(r.y);
    expect(c.x).toBeLessThan(r.x);
    const cm = circleOf(L1.shapes, 4)!, rm = rectOf(L1.shapes, "lane:fleet/lane-m1")!;
    expect([cm.y === rm.y, cm.x < rm.x]).toEqual([true, true]);
  });
  test("a session directly on a branch stands behind the branch, on its row", () => {
    const c = circleOf(L1.shapes, 2)!, r = rectOf(L1.shapes, "branch:bau/a")!;
    expect(c.at).toBe("branch:bau/a");
    expect(c.y).toBe(r.y);
    expect(c.x).toBeGreaterThan(r.x + r.w);
  });
  test("a session in the main checkout on main stands behind main", () => {
    const c = circleOf(L1.shapes, 1)!, r = rectOf(L1.shapes, "main:main")!;
    expect([c.at, c.y === r.y, c.x > r.x + r.w]).toEqual(["main:main", true, true]);
  });
  test("a session in another repo stands under its own repo, never in this one", () => {
    expect(circleOf(L1.shapes, 5)).toBeUndefined();
    const m2 = gitModel(repo(R2, [row(R2, "main", { primary: true })]), undefined, slots, active, card);
    expect(m2.sessions.map((s) => s.slot)).toEqual([5]);
    expect(m2.items).toEqual([]);
  });
  test("a branch without a session has no circle", () => {
    expect(rectOf(L1.shapes, "branch:bau/b")).toBeDefined();
    expect(L1.shapes.filter((p) => p.t === "circle" && p.at === "branch:bau/b")).toEqual([]);
  });
  test("role and label never place a circle: two Orchestrators, one on main, one in a lane", () => {
    expect([circleOf(L1.shapes, 1)!.at, circleOf(L1.shapes, 3)!.at]).toEqual(["main:main", "lane:fleet/lane-a1"]);
  });
  test("a session in the main checkout on a board branch stands behind that branch", () => {
    const m = gitModel(repo(R1, [row(R1, "bau/b", { primary: true })]), board(R1, [bv("bau/b")]),
      [slot(7, R1, { repo: R1, git: { branch: "bau/b" } })], () => false, card);
    const L = gitLayout(m);
    expect(circleOf(L.shapes, 7)!.at).toBe("branch:bau/b");
  });
});

describe("heads, checks and colour", () => {
  test("a lane hangs under the branch it lands on, a lane on main stands beside the branches", () => {
    expect(m1.items.map((i) => [i.kind, i.branch, i.lanes.map((l) => l.branch)])).toEqual([
      ["branch", "bau/a", ["fleet/lane-a1"]], ["branch", "bau/b", []], ["lane", "fleet/lane-m1", []]]);
  });
  test("green is an active session; a quiet one is not", () => {
    expect([circleOf(L1.shapes, 1)!.ses.active, circleOf(L1.shapes, 2)!.ses.active, circleOf(L1.shapes, 3)!.ses.active]).toEqual([true, false, true]);
  });
  test("the branch diamond is its merge-check, the lane diamond its land check; dashed until merged, quiet once landed", () => {
    const m = gitModel(repo(R1, [row(R1, "main", { primary: true }), row("/w/wt/l", "fleet/l", { ...on("bau/a", 9, "yes"),
      checks: { local: null, preview: null, gate: { state: "green", head: null, at: null, fails: [], stale: null }, audit: null } })]),
      board(R1, [bv("bau/a", { check: { state: "red", at: 1, why: null } })]), [], () => false, card);
    const d = gitLayout(m).shapes.filter((p): p is Extract<GsShape, { t: "diamond" }> => p.t === "diamond").map((p) => [p.of, p.d, p.merged]);
    // next stands with its hollow diamond while nothing is green (rechts-7 B)
    expect(d).toEqual([["next", "none", false], ["branch:bau/a", "red", false], ["lane:fleet/l", "landed", true]]);
  });
  test("a branch is merged only after a land with no commit since; a fresh one stays dashed", () => {
    const land = { sha: "d".repeat(40), at: 1, subject: "x", points: [], passt: true, checked: true, form: "squash" as const };
    const m = gitModel(repo(R1, []), board(R1, [bv("fresh", { chargeCommits: 0 }), bv("landed", { distance: { ahead: 1, behind: 1 }, chargeCommits: 0, lands: [land] }),
      bv("again", { chargeCommits: 3, lands: [land] })]), [], () => false, card);
    expect(m.items.map((i) => [i.branch, i.merged])).toEqual([["fresh", false], ["landed", true], ["again", false]]);
  });
  // NEXT ALWAYS STANDS (owner 18.10. 23:4x „[Zitat entfernt]“, Ja 19.10. 03:38; rechts-7 B)
  test("next always stands, without a head of its own: quiet while no branch's merge-check is green, ready with the green ones", () => {
    const green = { state: "green" as const, at: 1, why: null };
    const nextOf = (shapes: GsShape[]) => shapes.find((p): p is Extract<GsShape, { t: "rect" }> => p.t === "rect" && p.key === "next");
    const diaOf = (shapes: GsShape[]) => shapes.find((p): p is Extract<GsShape, { t: "diamond" }> => p.t === "diamond" && p.of === "next");
    expect(m1.next).toBeNull();
    const quiet = gitLayout(m1).shapes;
    expect(nextOf(quiet)?.quiet).toBe(true);
    expect(nextOf(quiet)?.title).toBe("next — nothing ready to land yet — a branch shows here once its merge check is green on the current main");
    expect(diaOf(quiet)?.d).toBe("none");
    const m = gitModel(repo(R1, []), board(R1, [bv("bau/a", { check: green }), bv("bau/b", { check: { state: "red", at: 1, why: null } }), bv("bau/c", { check: green })]), [], () => false, card);
    expect(m.next).toEqual(["bau/a", "bau/c"]);
    const ready = gitLayout(m).shapes;
    expect(nextOf(ready)?.quiet).toBe(false);
    expect(nextOf(ready)?.title).toBe("next — becomes main when the batches of bau/a, bau/c land");
    expect(nextOf(ready)?.title).not.toMatch(/[0-9a-f]{7}/);
    expect(diaOf(ready)?.d).toBe("green");
  });
  test("main carries a commit point left of it, never a session there", () => {
    const p = L1.shapes.find((x) => x.t === "point")!, r = rectOf(L1.shapes, "main:main")!;
    expect(p.x).toBeLessThan(r.x);
    expect(L1.shapes.some((x) => x.t === "circle" && x.x < r.x && x.y === r.y)).toBe(false);
  });
});

// Runde 2 (auftraege/k16-git-struktur-runde-2.md, owner Z81): the slot in the circle, the session's name on the lane, the
// line after a diamond dashed until the land, and no line through a circle
describe("round 2: slots, names, lines", () => {
  type Line = Extract<GsShape, { t: "line" }>;
  const lanesRepo = repo(R1, [row(R1, "main", { primary: true }),
    row("/w/wt/l21", "fleet/261017-364d", on("bau/a", 21)), row("/w/wt/l22", "fleet/261017-7d9f", on("bau/a", 22, "yes"))]);
  const lanesSlots = [slot(21, "/w/wt/l21", { label: "Kopfzeile", worktree: { repo: R1, branch: "fleet/261017-364d" } }),
    slot(22, "/w/wt/l22", { label: "⎇ testrepo 7d9f", worktree: { repo: R1, branch: "fleet/261017-7d9f" } })];
  const L2 = gitLayout(gitModel(lanesRepo, board(R1, [bv("bau/a")]), lanesSlots, () => false, card));
  test("a circle is its session's slot: the card names it", () => {
    expect(cardLines(circleOf(L1.shapes, 3)!.ses)[1]).toBe("Slot 3");
    expect(cardLines(circleOf(L2.shapes, 21)!.ses)[1]).toBe("Slot 21");
  });
  test("a lane shows its session's name, not its id; an automatic name falls back to the branch, the whole branch in the title", () => {
    expect(rectOf(L2.shapes, "lane:fleet/261017-364d")!.text).toBe("Kopfzeile");
    expect(rectOf(L2.shapes, "lane:fleet/261017-364d")!.title).toBe("Kopfzeile — fleet/261017-364d · 1\u00a0commit not landed yet");
    expect([rectOf(L2.shapes, "lane:fleet/261017-7d9f")!.text, rectOf(L2.shapes, "lane:fleet/261017-7d9f")!.title]).toEqual(["7d9f", "fleet/261017-7d9f"]);
  });
  test("the line after a diamond is dashed until the land and drawn through after it", () => {
    const after = (key: string) => {
      const d = L2.shapes.find((p): p is Extract<GsShape, { t: "diamond" }> => p.t === "diamond" && p.of === key)!;
      return L2.shapes.filter((p): p is Line => p.t === "line" && p.y1 === d.y && p.y2 === d.y && p.x1 > d.x).map((l) => l.open);
    };
    expect(after("lane:fleet/261017-364d")).toEqual([true]);
    expect(after("lane:fleet/261017-7d9f")).toEqual([false]);
    // the collector: the stretch the landed lane alone uses is drawn through, the one the open lane also crosses stays dashed
    const y21 = rectOf(L2.shapes, "lane:fleet/261017-364d")!.y, y22 = rectOf(L2.shapes, "lane:fleet/261017-7d9f")!.y;
    // the lane collector: the vertical stretches between the lanes' diamonds and the branch's
    const dx = (of: string) => L2.shapes.find((p): p is Extract<GsShape, { t: "diamond" }> => p.t === "diamond" && p.of === of)!.x;
    const up = L2.shapes.filter((p): p is Line => p.t === "line" && p.x1 === p.x2 && p.x1 > dx("lane:fleet/261017-364d") && p.x1 < dx("branch:bau/a"));
    expect(up.map((l) => [l.y1, l.open])).toEqual([[y21, true], [y22, false]]);
  });
  test("no line runs through a circle", () => {
    for (const L of [L1, L2]) for (const c of L.shapes.filter((p): p is Extract<GsShape, { t: "circle" }> => p.t === "circle")) {
      const through = L.shapes.filter((p): p is Line => p.t === "line" && p.y1 === c.y && p.y2 === c.y
        && Math.max(p.x1, p.x2) > c.x - c.r + 0.5 && Math.min(p.x1, p.x2) < c.x + c.r - 0.5);
      expect(through).toEqual([]);
    }
  });
});

// Runde 3 (auftraege/k16-git-struktur-runde-3.md, owner Z83): numbers only under the pointer, a lane named by its label,
// else its goal, else its board name — the id only when nothing is there; a landed charge shows the check it landed with
describe("round 3: lane names, the landed diamond, the card", () => {
  test("a lane block shows a name instead of its id where there is one: label, then goal, then board name", () => {
    const rows = [row(R1, "main", { primary: true }),
      row("/w/wt/l31", "fleet/261017-aa04", on("main", 31)), row("/w/wt/l32", "fleet/261017-c650", on("main", 32)),
      row("/w/wt/l33", "fleet/261017-466c", on("main", 33)), row("/w/wt/l34", "fleet/261017-a88e"), row("/w/wt/l35", "fleet/261017-e75c")];
    const s3 = [slot(31, "/w/wt/l31", { label: "⎇ testrepo aa04", taskTitle: "Kopfzeile ruhiger setzen", worktree: { repo: R1, branch: "fleet/261017-aa04" } }),
      slot(32, "/w/wt/l32", { label: "Farbpalette", taskTitle: "Etwas anderes", worktree: { repo: R1, branch: "fleet/261017-c650" } }),
      slot(33, "/w/wt/l33", { label: "⎇ testrepo 466c", worktree: { repo: R1, branch: "fleet/261017-466c" } })];
    const m = gitModel(repo(R1, rows), board(R1, [bv("fleet/261017-a88e", { name: "Prüfplan" })]), s3, () => false, card);
    const lanes = m.items.filter((i) => i.kind === "lane").map((i) => [i.branch, i.name, i.named]);
    expect(lanes).toEqual([
      ["fleet/261017-aa04", "Kopfzeile ruhiger setzen", true],
      ["fleet/261017-c650", "Farbpalette", true],
      ["fleet/261017-466c", "466c", false],
      ["fleet/261017-e75c", "e75c", false],
    ]);
    // a board branch in a worktree without a session of a lane is a branch, named by the board
    expect(m.items.find((i) => i.branch === "fleet/261017-a88e")!.name).toBe("Prüfplan");
  });
  test("the dispatcher's label „⎇ task …“ is no name: the lane's goal names it, as the bar does", () => {
    const m = gitModel(repo(R1, [row(R1, "main", { primary: true }), row("/w/wt/l42", "fleet/261005-rechter-tab-dichter-42f1", on("main", 42))]), undefined,
      [slot(42, "/w/wt/l42", { label: "⎇ task 42f1", taskTitle: "Rechter Tab dichter", worktree: { repo: R1, branch: "fleet/261005-rechter-tab-dichter-42f1" } })],
      () => false, card);
    expect(m.items.filter((i) => i.kind === "lane").map((i) => [i.name, i.named])).toEqual([["Rechter Tab dichter", true]]);
  });
  test("a lane whose session has only the automatic label carries the board name of its branch", () => {
    const m = gitModel(repo(R1, [row(R1, "main", { primary: true }), row("/w/wt/l41", "fleet/l41", on("bau/a", 41))]),
      board(R1, [bv("bau/a"), bv("fleet/l41", { name: "Kachelraster" })]),
      [slot(41, "/w/wt/l41", { label: "⎇ testrepo 4f41", worktree: { repo: R1, branch: "fleet/l41" } })], () => false, card);
    expect(m.items.find((i) => i.branch === "bau/a")!.lanes.map((l) => [l.name, l.named])).toEqual([["Kachelraster", true]]);
  });
  // Runde 6 (owner Z118: „[Zitat entfernt]“): a landed charge is quiet,
  // checked or not — the check it landed with stands in its batch
  // with commits since, its check of an older tip counts as no check for the tip now (owner 18.10. 23:4x; rechts-7 C)
  test("a landed charge has the quiet landed diamond, checked or not — never stale; with commits since, its older check counts as none", () => {
    const land = (checked: boolean) => ({ sha: "d".repeat(40), at: 1, subject: "x", points: [], passt: true, checked, form: "squash" as const });
    const stale = { state: "stale" as const, at: 1, why: "geprüft war b5de40e4 gegen main" };
    const m = gitModel(repo(R1, []), board(R1, [bv("checked", { chargeCommits: 0, lands: [land(true)], check: stale }),
      bv("unchecked", { chargeCommits: 0, lands: [land(false)], check: stale }),
      bv("moved", { chargeCommits: 2, lands: [land(true)], check: stale })]), [], () => false, card);
    expect(m.items.map((i) => [i.branch, i.check, i.merged, i.older])).toEqual([["checked", "landed", true, null], ["unchecked", "landed", true, null], ["moved", "none", false, "b5de40e"]]);
  });
  test("the card on a circle speaks English (owner Z87: „[Zitat entfernt]“)", () => {
    const lane = circleOf(L1.shapes, 3)!.ses, branch = circleOf(L1.shapes, 2)!.ses, main = circleOf(L1.shapes, 1)!.ses;
    expect(cardLines(lane)).toEqual(["Orchestrator", "Slot 3", "Claude Code", "working now · in lane fleet/lane-a1"]);
    expect(cardLines(branch).at(-1)).toBe("resting · directly on bau/a");
    expect(cardLines(main).at(-1)).toBe("working now · on main in the main checkout");
  });
});

// Runde 3 Punkt 5 and Runde 4 (owner Z86): „[Zitat entfernt]“ is gone, the structure carries what it could do — simply. The list is
// the Bestandsaufnahme (3db17b9a, Ja 3e75a836) minus the points, which left the menu; step 1 begins with the test instance
describe("round 4: what Projekte could do is reachable, simply, the test instance first", () => {
  const h = (o: Partial<GsHead> & Pick<GsHead, "at">): GsHead => ({ board: false, slot: null, hung: false, worktree: true,
    landed: false, mirror: false, live: false, ...o });
  test("step 1 of every branch and lane with a checkout begins with its test instance — main has none (owner Z137)", () => {
    for (const at of ["branch", "lane"] as const) for (const o of [{}, { board: true }, { slot: 3 }, { slot: 3, live: true, board: true }])
      expect(headWords(h({ at, ...o }))[0]).toBe("testinstanz");
    for (const o of [{}, { board: true }, { slot: 3 }]) expect(headWords(h({ at: "main", ...o }))).not.toContain("testinstanz");
    expect(headWords(h({ at: "branch", worktree: false, board: true }))[0]).toBe("landform");
  });
  // round 7 (owner Ja 18.10. 22:4x): the project's Beim Land moved from main's menu to the gear in the head; rechts-7 round 2
  // (owner Z137, 19.10.: „[Zitat entfernt]“): main's test instance went too
  test("main: Live session alone — no test instance, the project's land form is the gear's", () => {
    expect(headWords(h({ at: "main" }))).toEqual(["live"]);
  });
  // owner Z87: „[Zitat entfernt]“ — the routes stay
  test("a board branch: no Diff, Passt or Landen; its land form; Start session without a session, Restart when it hangs", () => {
    expect(headWords(h({ at: "branch", board: true }))).toEqual(["testinstanz", "landform", "session"]);
    expect(headWords(h({ at: "branch", board: true, slot: 13, hung: true }))).toEqual(["testinstanz", "landform", "neustart"]);
    expect(headWords(h({ at: "branch", board: true, slot: 13 }))).toEqual(["testinstanz", "landform"]);
    expect(headWords(h({ at: "branch", board: true, slot: 13, landed: true }))).toEqual(["testinstanz"]);
  });
  test("a board branch's diamond: its batch and Check (8), no Landen; a lane's diamond its checks (9)", () => {
    expect(headWords(h({ at: "branch-check", board: true }))).toEqual(["charge", "pruefen"]);
    expect(headWords(h({ at: "lane-check" }))).toEqual(["pruefungen"]);
  });
  test("a lane: its land form (4), Mergen for a live lane; without a session its worktree (11)", () => {
    expect(headWords(h({ at: "lane", slot: 14 }))).toEqual(["testinstanz", "landform"]);
    expect(headWords(h({ at: "lane", slot: 14, live: true }))).toEqual(["testinstanz", "landform", "mergen"]);
    expect(headWords(h({ at: "lane" }))).toEqual(["testinstanz", "landform", "worktree"]);
    expect(headWords(h({ at: "lane", slot: 14, landed: true }))).toEqual(["testinstanz"]);
  });
  test("a mirrored worktree offers nothing that writes", () => {
    expect(headWords(h({ at: "lane", mirror: true }))).toEqual([]);
    expect(headWords(h({ at: "branch", mirror: true }))).toEqual([]);
  });
  test("every word of the menu is offered by some head", () => {
    const all = (["main", "branch", "lane", "branch-check", "lane-check"] as const).flatMap((at) =>
      [h({ at }), h({ at, board: true }), h({ at, slot: 3, hung: true, board: true }), h({ at, slot: 3, live: true })].flatMap(headWords));
    expect([...new Set(all)].sort()).toEqual((Object.keys(GS_WORD) as GsWord[]).sort());
  });
});

describe("round 3: test instance and the opened menu", () => {
  const up = (port: number | null) => ({ testinstanz: { state: "up", instance: port === null ? {} : { port } } });
  const tiRows = [row(R1, "main", { primary: true, ...up(8970) }), row("/w/wt/bau-a", "bau/a", { session: { slot: 2, openedAt: 2, taskId: null }, ...up(8971) }),
    row("/w/wt/lane-a1", "fleet/lane-a1", { ...on("bau/a", 3), ...up(null) }), row("/w/wt/lane-m1", "fleet/lane-m1", on("main", 4))];
  const mt = gitModel(repo(R1, tiRows), board(R1, [bv("bau/a", { path: "/w/wt/bau-a", session: { slot: 2, openedAt: 2 } })]), slots, active, card);
  const Lt = gitLayout(mt);
  type Ti = Extract<GsShape, { t: "ti" }>;
  const tiOfKey = (key: string) => Lt.shapes.find((p): p is Ti => p.t === "ti" && p.of === key);
  test("a running test instance stands at its branch or lane with its port, after the row's circles; none at main (owner Z137), none where it does not run", () => {
    expect([tiOfKey("main:main"), tiOfKey("branch:bau/a")?.port, tiOfKey("lane:fleet/lane-a1")?.port, tiOfKey("lane:fleet/lane-m1")])
      .toEqual([undefined, 8971, null, undefined]);
    const c2 = circleOf(Lt.shapes, 2)!, t2 = tiOfKey("branch:bau/a")!;
    expect(t2.x).toBeGreaterThan(c2.x + c2.r);
    expect(t2.y).toBe(c2.y);
    const lr = rectOf(Lt.shapes, "lane:fleet/lane-a1")!, ld = Lt.shapes.find((p): p is Extract<GsShape, { t: "diamond" }> => p.t === "diamond" && p.of === "lane:fleet/lane-a1")!;
    const ta = tiOfKey("lane:fleet/lane-a1")!;
    expect([ta.x > lr.x + lr.w, ta.x + ta.w < ld.x - 4]).toEqual([true, true]);
    expect(tiWidth({ port: 8970 })).toBeGreaterThan(tiWidth({ port: null }));
  });
  test("no line runs through a test instance's square and port", () => {
    for (const t of Lt.shapes.filter((p): p is Ti => p.t === "ti")) {
      const through = Lt.shapes.filter((p) => p.t === "line" && p.y1 === t.y && p.y2 === t.y
        && Math.max(p.x1, p.x2) > t.x + 0.5 && Math.min(p.x1, p.x2) < t.x + t.w - 0.5);
      expect(through).toEqual([]);
    }
  });
  test("a selected row opens its menu under it: the rows below move down by the menu's height, the rows above stay", () => {
    const L = gitLayout(m1, { gap: { after: "branch:bau/a", h: 120 } });
    const y = (key: string, l = L1) => rectOf(l.shapes, key)!.y;
    expect([y("main:main", L) - y("main:main"), y("branch:bau/a", L) - y("branch:bau/a"), y("lane:fleet/lane-a1", L) - y("lane:fleet/lane-a1"),
      y("branch:bau/b", L) - y("branch:bau/b")]).toEqual([0, 0, 120, 120]);
    expect(L.height - L1.height).toBe(120);
  });
});

// Bauleitung 17.10. (e105c447): the structure is not scaled — it is as wide as its column, so its text keeps the Info
// tab's 12 px; what does not fit is cut, the right columns hang from the right edge
describe("round 3b: as wide as the column, never scaled", () => {
  const right = (p: GsShape): number => p.t === "line" ? Math.max(p.x1, p.x2) : p.t === "rect" ? p.x + p.w : p.t === "ti" ? p.x + p.w
    : p.t === "point" ? p.x + 2.5 : p.x + p.r;
  for (const W of [240, 300, 366]) test(`at ${W} px the drawing is ${W} wide and nothing stands past it`, () => {
    for (const m of [m1, gitModel(repo(R1, []), board(R1, [bv("bau/a", { check: { state: "green", at: 1, why: null } })]), [], () => false, card)]) {
      const L = gitLayout(m, { width: W });
      expect(L.width).toBe(W);
      expect(L.shapes.filter((p) => right(p) > W)).toEqual([]);
    }
  });
  test("a wider column gives the rectangles more room; the diamonds keep their place at the right edge", () => {
    const at = (W: number) => { const L = gitLayout(m1, { width: W }); return [rectOf(L.shapes, "lane:fleet/lane-a1")!.w,
      W - L.shapes.find((p): p is Extract<GsShape, { t: "diamond" }> => p.t === "diamond" && p.of === "branch:bau/a")!.x]; };
    const [narrow, wide] = [at(260), at(366)];
    expect(wide[0]).toBeGreaterThan(narrow[0]);
    expect(wide[1]).toBe(narrow[1]);
  });
});

// Runde 4 (owner Z86): „[Zitat entfernt]“ — one diamond size, and every sign
// the drawing uses has its line in the legend behind the i
describe("round 4: one diamond size, every sign in the legend", () => {
  const layouts = () => {
    const green = { state: "green" as const, at: 1, why: null };
    const land = { sha: "d".repeat(40), at: 1, subject: "x", points: [], passt: true, checked: false, form: "squash" as const };
    const rows = [row(R1, "main", { primary: true, testinstanz: { state: "up", instance: { port: 8970 } } }),
      row("/w/wt/l1", "fleet/l1", { ...on("bau/a", 51), checks: { local: null, preview: null, gate: { state: "running", head: null, at: null, fails: [], stale: null }, audit: null } }),
      row("/w/wt/l2", "fleet/l2", { ...on("main", 52), checks: { local: null, preview: null, gate: { state: "red", head: null, at: null, fails: [], stale: null }, audit: null } }),
      row("/w/wt/l3", "fleet/l3", { ...on("main", 54), checks: { local: null, preview: null, gate: { state: "skipped", head: null, at: null, fails: [], stale: null }, audit: null },
        testinstanz: { state: "up", instance: { port: 8972 } } }),
      row("/w/wt/live", "live-2610171200-x", on("main", 53))];
    const m = gitModel(repo(R1, rows), board(R1, [bv("bau/a", { check: green }), bv("bau/s", { check: { state: "stale", at: 1, why: null } }),
      bv("bau/u", { chargeCommits: 0, lands: [land] })]), [...slots, slot(51, "/w/wt/l1", { worktree: { repo: R1, branch: "fleet/l1" } }),
      slot(53, "/w/wt/live", { label: "Live", worktree: { repo: R1, branch: "live-2610171200-x" } })], (n) => n === 51, card, { live: (b) => b.startsWith("live-") });
    return [L1, gitLayout(m), gitLayout(m, { width: 240 })];
  };
  test("all diamonds are one size", () => {
    const sizes = layouts().flatMap((L) => L.shapes.filter((p): p is Extract<GsShape, { t: "diamond" }> => p.t === "diamond").map((p) => p.r));
    expect(sizes.length).toBeGreaterThan(8);
    expect([...new Set(sizes)]).toEqual([sizes[0]]);
  });
  test("every sign the drawing uses has its line in the legend, one sign per line", () => {
    const used = layouts().flatMap((L) => L.shapes.map(signOf));
    for (const sign of new Set(used)) expect(typeof GS_LEGEND[sign]).toBe("string");
    // the fixture shows each kind the legend knows, so a sign the drawing gained without a line would show here
    expect([...new Set(used)].sort()).toEqual((Object.keys(GS_LEGEND) as GsSign[]).sort());
    expect(signsOf(L1.shapes).length).toBe(new Set(L1.shapes.map(signOf)).size);
  });
});

// Runde 5 (Bauleitung 345f671f, owner Z87): smaller circles, the line up to a diamond dashed too until the land, English
describe("round 5: small circles, dashed until the land, English", () => {
  type Line = Extract<GsShape, { t: "line" }>;
  test("a circle is about half the size it was (radius 9 → 5); the card, not the circle, says the slot", () => {
    const circles = L1.shapes.filter((p): p is Extract<GsShape, { t: "circle" }> => p.t === "circle");
    expect(circles.length).toBe(4);
    for (const c of circles) expect(c.r).toBeLessThanOrEqual(9 * 0.6);
    expect(circles.every((c) => !("text" in c))).toBe(true);
  });
  // owner Z87: „[Zitat entfernt]“ — the stretch from a head to its diamond was solid
  test("every line on a head's row right of its rectangle is dashed until the head landed, solid once it has", () => {
    const land = { sha: "d".repeat(40), at: 1, subject: "x", points: [], passt: true, checked: true, form: "squash" as const };
    const rows = [row(R1, "main", { primary: true }), row("/w/wt/open", "bau/open", { session: { slot: 7, openedAt: 7, taskId: null },
      testinstanz: { state: "up", instance: { port: 8971 } } }), row("/w/wt/l", "fleet/l", on("main", 8, "yes")), row("/w/wt/o", "fleet/o", on("main", 9))];
    const m = gitModel(repo(R1, rows), board(R1, [bv("bau/open", { path: "/w/wt/open", session: { slot: 7, openedAt: 7 } }),
      bv("bau/done", { chargeCommits: 0, lands: [land] })]), [slot(7, "/w/wt/open", { repo: "/w/wt/open", git: { branch: "bau/open" } }),
      slot(8, "/w/wt/l", { worktree: { repo: R1, branch: "fleet/l" } }), slot(9, "/w/wt/o", { worktree: { repo: R1, branch: "fleet/o" } })], () => false, card);
    const L = gitLayout(m);
    const rightOf = (key: string) => {
      const r = rectOf(L.shapes, key)!;
      return L.shapes.filter((p): p is Line => p.t === "line" && p.y1 === r.y && p.y2 === r.y && Math.min(p.x1, p.x2) >= r.x + r.w - 0.5).map((l) => l.open);
    };
    expect(rightOf("branch:bau/open").length).toBeGreaterThan(2); // past its circle and its test instance
    expect(new Set(rightOf("branch:bau/open"))).toEqual(new Set([true]));
    expect(new Set(rightOf("branch:bau/done"))).toEqual(new Set([false]));
    expect(new Set(rightOf("lane:fleet/o"))).toEqual(new Set([true]));
    expect(new Set(rightOf("lane:fleet/l"))).toEqual(new Set([false]));
  });
  test("the legend, the menu's words and the card are English: no German word or umlaut left", () => {
    const texts = [...Object.values(GS_LEGEND), ...Object.values(GS_WORD).map((w) => w.label), ...cardLines(circleOf(L1.shapes, 1)!.ses)];
    for (const t of texts) expect(t).not.toMatch(/[äöüßÄÖÜ]|\b(und|oder|noch|nicht|mit|auf|ohne|ein|eine|der|die|das|zur|von|neu|starten|Beim|Charge|Prüfung|Prüfen|läuft|gelandet|Testinstanz|ruht|arbeitet|gerade)\b/);
  });
  // a lane on bau/oberflaeche that branched before the branch's own commit: 1 ahead of where it branched, and 1 behind
  // the branch as it stands today — the menu said "0 behind" (the fork point) while Changes offered "Rebase — 1 behind"
  test("ahead/behind in the menu: behind counts the target's tip, not the point the lane branched from", () => {
    const w = row("/w/wt/lane-o", "fleet/lane-o", { distance: { ahead: 1, behind: 0 },
      target: { branch: "bau/oberflaeche", head: "c".repeat(40), behind: 1, landed: "no", landedAs: null, basis: "land-note" } });
    // a number never ends a line apart from its word (no-break spaces, rechts-7 P4); a sentence since rechts-7 round 2 (owner Z135)
    expect(distanceLine(w)).toBe("1\u00a0commit not landed yet, 1\u00a0behind bau/oberflaeche");
    expect(distanceLine({ ...w, target: { ...w.target, behind: null } })).toBe("1\u00a0commit not landed yet, 0\u00a0behind bau/oberflaeche");
    expect(distanceLine({ ...w, distance: null })).toBeNull();
  });
});

// rechts-7 round 2 (owner Z135, 19.10.: „[Zitat entfernt]“
//  — „[Zitat entfernt]“ made no sense to him): each head knows its commits not landed yet; its box
// carries its name alone, its hover and its menu say the count
describe("rechts-7 round 2: commits not landed yet, in the hover and the menu, never in the box", () => {
  const land = { sha: "d".repeat(40), at: 1, subject: "x", points: [], passt: true, checked: true, form: "squash" as const };
  const rows = [row(R1, "main", { primary: true }),
    row("/w/wt/bau-a", "bau/a", { distance: { ahead: 9, behind: 0 } }),
    row("/w/wt/lane-a1", "fleet/lane-a1", { ...on("bau/a", 3), distance: { ahead: 3, behind: 0 } }),
    row("/w/wt/lane-a2", "fleet/lane-a2", { ...on("bau/a", 6, "yes"), distance: { ahead: 4, behind: 0 } }),
    row("/w/wt/side", "side/x", { distance: { ahead: 7, behind: 0 } })];
  const m = gitModel(repo(R1, rows), board(R1, [bv("bau/a", { path: "/w/wt/bau-a", chargeCommits: 5 }), bv("bau/u", { chargeCommits: 0, lands: [land] }),
    bv("bau/n", { chargeCommits: null })]), [...slots, slot(6, "/w/wt/lane-a2", { worktree: { repo: R1, branch: "fleet/lane-a2" } })], active, card);
  const L = gitLayout(m);
  const itemOf = (b: string) => m.items.find((i) => i.branch === b)!;
  test("a board branch counts its commits since its last batch, never its distance from main", () => {
    expect(itemOf("bau/a").ahead).toBe(5);
    expect(itemOf("bau/n").ahead).toBeNull();
  });
  test("a landed head has nothing left to land: a landed batch and a landed lane count none", () => {
    expect(itemOf("bau/u").ahead).toBeNull();
    expect(itemOf("bau/a").lanes.find((l) => l.branch === "fleet/lane-a2")!.ahead).toBeNull();
  });
  test("a lane and a branch off the board count their commits since where they branched", () => {
    expect(itemOf("bau/a").lanes.find((l) => l.branch === "fleet/lane-a1")!.ahead).toBe(3);
    expect(itemOf("side/x").ahead).toBe(7);
  });
  test("the box says its name alone; the hover adds the count, a landed head's none", () => {
    expect([rectOf(L.shapes, "branch:bau/a")!.text, rectOf(L.shapes, "branch:bau/a")!.title]).toEqual(["bau/a", "bau/a — bau/a · 5\u00a0commits not landed yet"]);
    expect(rectOf(L.shapes, "lane:fleet/lane-a1")!.text).toBe("Orchestrator");
    expect(rectOf(L.shapes, "lane:fleet/lane-a1")!.title).toMatch(/ · 3\u00a0commits not landed yet$/);
    expect(rectOf(L.shapes, "branch:bau/u")!.title).not.toMatch(/not landed/);
    expect(rectOf(L.shapes, "lane:fleet/lane-a2")!.title).not.toMatch(/not landed/);
  });
  test("the menu says the board's count where it has one, and nothing where nothing is measured", () => {
    const w = rows[1]!;
    expect(distanceLine(w, 5)).toBe("5\u00a0commits not landed yet, 0\u00a0behind main");
    expect(distanceLine(w)).toBe("9\u00a0commits not landed yet, 0\u00a0behind main");
    expect(distanceLine(w, null)).toBeNull();
  });
});

// Runde 6 (owner Z118, 18.10.): „[Zitat entfernt]“ green with nothing to land; „[Zitat entfernt]“
//  — the Bauleitung's own branch, on no board and in no Fleet lane, stood as a lane
describe("round 6: next only for what waits to land, a lane only where Fleet runs one", () => {
  const green = { state: "green" as const, at: 1, why: null };
  const land = { sha: "d".repeat(40), at: 1, subject: "x", points: [], passt: true, checked: true, form: "squash" as const };
  test("a landed branch is no part of next, even when it landed with a green check", () => {
    const m = gitModel(repo(R1, []), board(R1, [bv("landed", { chargeCommits: 0, lands: [land], check: green }), bv("waits", { check: green })]), [], () => false, card);
    expect(m.next).toEqual(["waits"]);
    const only = gitModel(repo(R1, []), board(R1, [bv("a", { chargeCommits: 0, lands: [land] }), bv("b", { chargeCommits: 0, lands: [land] })]), [], () => false, card);
    expect(only.next).toBeNull();
    expect(gitLayout(only).shapes.filter((p) => p.t === "diamond" && p.d === "green")).toEqual([]);
  });
  test("a worktree on no board and in no Fleet lane is a branch, its session behind it", () => {
    const m = gitModel(repo(R1, [row(R1, "main", { primary: true }), row("/w/wt/plan", "bau/plan", { session: { slot: 8, openedAt: 8, taskId: null } })]),
      board(R1, []), [slot(8, "/w/wt/plan", { label: "Bauleitung", repo: "/w/wt/plan", git: { branch: "bau/plan" } })], () => true, card);
    expect(m.items.map((i) => [i.kind, i.branch])).toEqual([["branch", "bau/plan"]]);
    const L = gitLayout(m), c = circleOf(L.shapes, 8)!, r = rectOf(L.shapes, "branch:bau/plan")!;
    expect([c.at, c.y === r.y, c.x > r.x + r.w]).toEqual(["branch:bau/plan", true, true]);
  });
  test("still a lane: a lane session's worktree, a task's row, a Fleet-named lane without a session", () => {
    const m = gitModel(repo(R1, [row(R1, "main", { primary: true }),
      row("/w/wt/own", "bau/own", { session: { slot: 9, openedAt: 9, taskId: null } }),
      row("/w/wt/task", "bau/task", { session: { slot: 10, openedAt: 10, taskId: "t1" } }),
      row("/w/wt/idle", "fleet/2610180900-ab12")]), board(R1, []),
      [slot(9, "/w/wt/own", { worktree: { repo: R1, branch: "bau/own" } }), slot(10, "/w/wt/task")], () => false, card);
    expect(m.items.map((i) => [i.kind, i.branch])).toEqual([["lane", "bau/own"], ["lane", "bau/task"], ["lane", "fleet/2610180900-ab12"]]);
  });
  test("a plain worktree without a session is a branch row too, not checked and not landed", () => {
    const m = gitModel(repo(R1, [row(R1, "main", { primary: true }), row("/w/wt/old", "bau/old")]), board(R1, []), [], () => false, card);
    expect(m.items.map((i) => [i.kind, i.branch, i.check, i.merged, i.sessions.length])).toEqual([["branch", "bau/old", "none", false, 0]]);
  });
});

// round 7 (owner Z124 „[Zitat entfernt]“, Z131; Ja 18.10. 22:4x): the gear hides what nobody works at
describe("round 7: the gear leaves out landed heads and heads without a session", () => {
  const green = { state: "green" as const, at: 1, why: null };
  const land = { sha: "d".repeat(40), at: 1, subject: "x", points: [], passt: true, checked: true, form: "squash" as const };
  const rows = [row(R1, "main", { primary: true }),
    row("/w/wt/done", "bau/done", { session: { slot: 6, openedAt: 6, taskId: null } }),
    row("/w/wt/lane-l", "fleet/lane-l", on("bau/old", 7, "yes")),
    row("/w/wt/lane-r", "fleet/lane-r", { ...on("main", 8), checks: { local: null, preview: null, gate: { state: "running", head: null, at: 1, fails: [], stale: null }, audit: null } }),
    row("/w/wt/lane-q", "fleet/lane-q", on("main", 9)),
    row("/w/wt/lane-i", "fleet/lane-i", { ...on("bau/idle", 10), checks: { local: null, preview: null, gate: { state: "waiting", head: null, at: 1, fails: [], stale: null }, audit: null } })];
  const brd = board(R1, [bv("bau/done", { chargeCommits: 0, lands: [land], path: "/w/wt/done", session: { slot: 6, openedAt: 6 } }),
    bv("bau/old", { chargeCommits: 0, lands: [land] }), bv("bau/green", { check: green }), bv("bau/idle")]);
  // slot 6 works directly on bau/done; the lane sessions 7–10 have left (no slot holds them any more)
  const sl = [slot(6, "/w/wt/done", { repo: "/w/wt/done", git: { branch: "bau/done" } })];
  const keys = (hide?: { landed: boolean; idle: boolean }) => {
    const m = gitModel(repo(R1, rows), brd, sl, () => false, card, hide ? { hide } : {});
    return { items: m.items.flatMap((i) => [`${i.kind}:${i.branch}`, ...i.lanes.map((l) => `lane:${l.branch}`)]), next: m.next };
  };
  test("shown by default: every head", () => {
    expect(keys().items).toEqual(["branch:bau/done", "branch:bau/old", "lane:fleet/lane-l", "branch:bau/green", "branch:bau/idle", "lane:fleet/lane-i",
      "lane:fleet/lane-r", "lane:fleet/lane-q"]);
  });
  test("landed hidden: what landed with nothing since goes, unless a session works there", () => {
    expect(keys({ landed: true, idle: false }).items).toEqual(["branch:bau/done", "branch:bau/green", "branch:bau/idle", "lane:fleet/lane-i", "lane:fleet/lane-r",
      "lane:fleet/lane-q"]);
  });
  test("without a session hidden: only heads a session works at or whose check runs or waits, and a branch over such a lane; next still names the green branch", () => {
    const k = keys({ landed: false, idle: true });
    expect(k.items).toEqual(["branch:bau/done", "branch:bau/idle", "lane:fleet/lane-i", "lane:fleet/lane-r"]);
    expect(k.next).toEqual(["bau/green"]);
  });
});
