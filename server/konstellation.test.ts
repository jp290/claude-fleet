// K16 E2b · the constellation tree (src/konstellation-model.ts). Owner 15.10.: „[Zitat entfernt]“
// . The model's promise: every active
// session stands exactly once, and an edge exists only where the wire names it.
import { describe, expect, test } from "bun:test";
import { constellation, flatten, type KTree } from "../src/konstellation-model";
import type { SlotInfo } from "../src/client";
import type { BranchesView } from "../src/protocol";
import type { ProgramInfo } from "../src/queue";

const slot = (id: number, more: Partial<SlotInfo> = {}): SlotInfo =>
  ({ id, cwd: `/w/${id}`, label: null, lastOutput: 0, openedAt: id * 1000, ...more });
const free = (id: number): SlotInfo => ({ id, cwd: null, label: null, lastOutput: 0 });
const lane = (id: number, programId?: string): SlotInfo =>
  slot(id, { worktree: { repo: "/r", branch: `lane/${id}` }, ...(programId ? { programId } : {}) });
const program = (id: string, main: { slot: number; openedAt: number } | null, status = "active"): ProgramInfo =>
  ({ id, status, title: `P ${id}`, createdAt: 0, main });
const branches = (...pairs: [string, number, number][]): BranchesView => ({ repos: [{ repo: "/r", integration: "main",
  others: [], othersTotal: 0, reasons: [], branches: pairs.map(([branch, s, openedAt]) => ({ branch, name: `Name ${branch}`,
    base: null, head: "h", text: "", rev: 1, seen: null, path: null, session: { slot: s, openedAt }, distance: null,
    lands: [], chargeBase: null, chargeCommits: null, check: null })) }] });
const ids = (t: KTree) => flatten(t).map((n) => n.slot.id);
const where = (t: KTree) => Object.fromEntries(t.groups.map((g) => [g.key, g.nodes.map((n) => n.slot.id)]));

describe("constellation", () => {
  test("every active session exactly once, free slots none", () => {
    const slots = [slot(1, { role: "orchestrator" }), slot(2, { role: "program-main" }), lane(3, "p1"), lane(4),
      slot(5), slot(6), free(7), free(8)];
    const t = constellation(slots, branches(["bau/x", 5, 5000]), [program("p1", { slot: 2, openedAt: 2000 })]);
    expect(ids(t).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(t.count).toBe(6);
  });

  test("Orchestratorin → MAIN → its lane; an unbound lane stands apart", () => {
    const t = constellation([slot(1, { role: "orchestrator" }), slot(2, { role: "program-main" }), lane(3, "p1"), lane(4, "p9")],
      null, [program("p1", { slot: 2, openedAt: 2000 })]);
    const orch = t.groups.find((g) => g.key === "orchester")!.nodes;
    expect(orch.map((n) => n.slot.id)).toEqual([1]);
    expect(orch[0]!.children.map((n) => n.slot.id)).toEqual([2]);
    expect(orch[0]!.children[0]!.children.map((n) => [n.slot.id, n.program?.title])).toEqual([[3, "P p1"]]);
    expect(where(t).lanes).toEqual([4]);
  });

  test("a Program bound to an EARLIER occupant of the slot leads no lane of this one", () => {
    const t = constellation([slot(2, { role: "program-main" }), lane(3, "p1")], null, [program("p1", { slot: 2, openedAt: 1 })]);
    expect(where(t)).toEqual({ orchester: [2], lanes: [3] });
    expect(t.groups[0]!.nodes[0]!.program).toBeNull();
  });

  test("a closed Program leads nothing", () => {
    const t = constellation([slot(2, { role: "program-main" }), lane(3, "p1")], null, [program("p1", { slot: 2, openedAt: 2000 }, "done")]);
    expect(where(t).lanes).toEqual([3]);
  });

  test("two Orchestratorinnen: no MAIN is guessed under either", () => {
    const t = constellation([slot(1, { role: "orchestrator" }), slot(5, { role: "orchestrator" }), slot(2, { role: "program-main" })], null, []);
    const orch = t.groups[0]!.nodes;
    expect(orch.map((n) => [n.slot.id, n.children.length])).toEqual([[1, 0], [5, 0], [2, 0]]);
  });

  test("a branch session is the slot+openedAt the branch names; a new occupant of that slot is not", () => {
    const t = constellation([slot(5), slot(6, { openedAt: 99 })], branches(["bau/a", 5, 5000], ["bau/b", 6, 6000]), []);
    expect(where(t)).toEqual({ branches: [5], sessions: [6] });
    expect(t.groups[0]!.nodes[0]!.branch).toEqual({ branch: "bau/a", name: "Name bau/a" });
  });

  test("a lane is a lane even when a branch names its slot", () => {
    const t = constellation([lane(3)], branches(["lane/3", 3, 3000]), []);
    expect(where(t)).toEqual({ lanes: [3] });
  });

  test("a lane hangs under the session it was opened from (its anchor), as the left bar stacks it", () => {
    const anchored = (id: number, anchor: { slot: number; openedAt: number }, repo = "/r") =>
      slot(id, { worktree: { repo, branch: `lane/${id}`, anchor } });
    const t = constellation([slot(1, { role: "orchestrator", repo: "/r" }), slot(2, { repo: "/r" }),
      anchored(3, { slot: 2, openedAt: 2000 }), anchored(4, { slot: 2, openedAt: 1 }), anchored(5, { slot: 2, openedAt: 2000 }, "/other"),
      anchored(6, { slot: 1, openedAt: 1000 })], null, []);
    expect(where(t)).toEqual({ orchester: [1], lanes: [4, 5], sessions: [2] });
    expect(t.groups.find((g) => g.key === "sessions")!.nodes[0]!.children.map((n) => n.slot.id)).toEqual([3]);
    expect(t.groups[0]!.nodes[0]!.children.map((n) => n.slot.id)).toEqual([6]);
  });

  test("a lane of a MAIN's Program hangs under that MAIN, whatever its anchor says", () => {
    const t = constellation([slot(1, { repo: "/r" }), slot(2, { role: "program-main" }),
      slot(3, { worktree: { repo: "/r", branch: "lane/3", anchor: { slot: 1, openedAt: 1000 } }, programId: "p1" })],
      null, [program("p1", { slot: 2, openedAt: 2000 })]);
    expect(t.groups[0]!.nodes[0]!.children.map((n) => n.slot.id)).toEqual([3]);
    expect(where(t)).toEqual({ orchester: [2], sessions: [1] });
  });

  test("nothing running: no group, count 0", () => {
    const t = constellation([free(1), free(2)], null, []);
    expect(t).toEqual({ groups: [], count: 0 });
  });

  test("unreadable branches and programs: every session still stands once, as a plain session", () => {
    const t = constellation([slot(1), slot(2, { role: "program-main" }), lane(3, "p1")], null, []);
    expect(ids(t).sort()).toEqual([1, 2, 3]);
    expect(where(t)).toEqual({ orchester: [2], lanes: [3], sessions: [1] });
  });
});
