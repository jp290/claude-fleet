// THE RUNNING CONSTELLATION AS A TREE (Neuaufbau K16 E2b, docs/neuaufbau/befunde/18-einstellungen.md §5).
// Owner 15.10.: „[Zitat entfernt]“
// . This file is the pure half: which session hangs where.
// No DOM and no fetch, so server/konstellation.test.ts reads it without a browser; src/konstellation.ts paints it.
//
// WHAT AN EDGE IS. Only what a reader of the wire can see, nothing guessed from a label:
//   · Orchestratorin → Program-MAIN: the role model (SYSTEM.md). With exactly one Orchestratorin the MAINs
//     hang under her; with none or several, nothing says which one leads which MAIN, so they stand beside.
//   · Program-MAIN → Lane: the lane's `programId` is the Program whose `main` names this MAIN's occupation
//     (GET /api/programs; the 2 s poll carries no binding).
//   · Session → Lane: otherwise the lane's `worktree.anchor`, the occupation it was opened from, in the same repo —
//     the rule the left bar stacks lanes by (src/client.ts#stacksOf), so bar and tree tell the same story.
//   · Branch-Session: the slot a branch record names as its `session` (GET /api/branches). Who OPENED the
//     branch is not on that wire (BranchView has no `opener`), so a branch session has no parent here.
// Every active session (a slot with a cwd) stands exactly once.
import type { SlotInfo } from "./client";
import { normalizeLaneAnchor, type BranchesView } from "./protocol";
import type { ProgramInfo } from "./queue";

export type KKind = "orchestrator" | "program-main" | "lane" | "bau" | "session";
export interface KNode {
  slot: SlotInfo; kind: KKind;
  // a MAIN's own Program; a lane's Program when one of the running MAINs leads it
  program: { id: string; title: string } | null;
  branch: { branch: string; name: string } | null;
  children: KNode[];
}
export type KGroupKey = "orchester" | "lanes" | "branches" | "sessions";
export interface KGroup { key: KGroupKey; nodes: KNode[] }
export interface KTree { groups: KGroup[]; count: number }

const byId = (a: KNode, b: KNode) => a.slot.id - b.slot.id;

export function constellation(slots: readonly SlotInfo[], branches: BranchesView | null,
  programs: readonly ProgramInfo[]): KTree {
  const active = slots.filter((s) => !!s.cwd);
  const branchOf = (s: SlotInfo) => {
    for (const r of branches?.repos ?? []) {
      const b = r.branches.find((x) => x.session?.slot === s.id && x.session.openedAt === s.openedAt);
      if (b) return { branch: b.branch, name: b.name };
    }
    return null;
  };
  const ledBy = (s: SlotInfo) => programs.find((p) => p.status === "active" && p.main
    && p.main.slot === s.id && p.main.openedAt === s.openedAt) ?? null;
  const nodes = active.map((s): KNode => {
    const kind: KKind = s.role === "orchestrator" ? "orchestrator" : s.role === "program-main" ? "program-main"
      : s.worktree ? "lane" : branchOf(s) ? "bau" : "session";
    const led = kind === "program-main" ? ledBy(s) : null;
    return { slot: s, kind, program: led ? { id: led.id, title: led.title } : null,
      branch: kind === "bau" ? branchOf(s) : null, children: [] };
  });
  const of = (k: KKind) => nodes.filter((n) => n.kind === k).sort(byId);
  const orchs = of("orchestrator"), mains = of("program-main");
  const repoOf = (s: SlotInfo) => s.repo ?? s.worktree?.repo ?? s.cwd;
  const loose: KNode[] = [];
  for (const lane of of("lane")) {
    const main = lane.slot.programId ? mains.find((m) => m.program?.id === lane.slot.programId) : undefined;
    const anchor = normalizeLaneAnchor(lane.slot.worktree?.anchor);
    const opener = main ?? (anchor ? nodes.find((n) => n.kind !== "lane" && n.slot.id === anchor.slot
      && n.slot.openedAt === anchor.openedAt && repoOf(n.slot) === lane.slot.worktree?.repo) : undefined);
    if (main) lane.program = main.program;
    if (opener) opener.children.push(lane); else loose.push(lane);
  }
  const orchester = orchs.length === 1 ? [{ ...orchs[0]!, children: [...mains, ...orchs[0]!.children] }] : [...orchs, ...mains];
  const groups: KGroup[] = [
    { key: "orchester" as const, nodes: orchester },
    { key: "lanes" as const, nodes: loose },
    { key: "branches" as const, nodes: of("bau") },
    { key: "sessions" as const, nodes: of("session") },
  ].filter((g) => g.nodes.length > 0);
  return { groups, count: active.length };
}

// every node of the tree in reading order — the check that each session stands exactly once
export function flatten(t: KTree): KNode[] {
  const walk = (n: KNode): KNode[] => [n, ...n.children.flatMap(walk)];
  return t.groups.flatMap((g) => g.nodes.flatMap(walk));
}
