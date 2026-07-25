// worktreeRisk as real file names + the lane's own unpushed commits, and 💾 lane commit
// (quick + agent mode) as the SAVE that land/merge cannot do.
import { spawnSync } from "node:child_process";
import { REPO, check, get, post } from "./harness";

export async function run(): Promise<void> {
  // --- Part A: worktreeRisk — real dirty files + unpushed commits, not just counts ---
  interface WtRiskRow { path: string; branch: string; dirtyFiles: string[];
    unpushedCommits: { hash: string; subject: string }[]; shortstat: string | null; empty: boolean }
  const lnDirty = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  await Bun.write(`${lnDirty.cwd}/sweepdirty.txt`, "wip\n");
  spawnSync("git", ["-C", lnDirty.cwd, "add", "sweepdirty.txt"]);
  spawnSync("git", ["-C", lnDirty.cwd, "commit", "-qm", "sweep test unpushed commit"]);
  await Bun.write(`${lnDirty.cwd}/code.txt`, "root\nsweep-uncommitted\n");
  const lnClean2 = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  const wmRisk = (await (await get(`/api/slots/${lnDirty.slot}/worktrees`)).json()) as { worktrees: WtRiskRow[] };
  const rowDirty = wmRisk.worktrees.find((w) => w.branch === lnDirty.branch);
  check("worktrees map reports real dirty FILE NAMES, not just a count",
    !!rowDirty && rowDirty.dirtyFiles.some((f) => f.includes("code.txt")) && rowDirty.empty === false,
    JSON.stringify(rowDirty));
  // guards fix B: the no-upstream fallback must list the lane's OWN commit ONLY, never
  // the base history — so exactly one entry, and it is the commit this test created
  check("worktrees map reports ONLY the lane's own unpushed commit (not base history)",
    !!rowDirty && rowDirty.unpushedCommits.length === 1
      && rowDirty.unpushedCommits[0].subject === "sweep test unpushed commit",
    JSON.stringify(rowDirty?.unpushedCommits));
  const rowClean = wmRisk.worktrees.find((w) => w.branch === lnClean2.branch);
  check("worktrees map reports empty:true for a clean, fresh lane (provably safe to drop)",
    !!rowClean && rowClean.empty === true && rowClean.dirtyFiles.length === 0 && rowClean.unpushedCommits.length === 0,
    JSON.stringify(rowClean));
  // focused single-path risk endpoint (used by the client before ⏏ land / kill-with-lane)
  const riskDirty = (await (await get(`/api/slots/${lnDirty.slot}/risk`)).json()) as WtRiskRow;
  check("single-slot risk endpoint matches the worktrees-map row for the same lane",
    riskDirty.empty === false && riskDirty.dirtyFiles.some((f) => f.includes("code.txt")), JSON.stringify(riskDirty));
  check("risk endpoint rejects a non-lane slot", (await get("/api/slots/2/risk")).status === 400);

  // --- Part B2: 💾 lane commit — the SAVE that land/merge (dirty-tree refusers) can't do.
  // Commit-only (never push/land); reversible by the owner. lnDirty is dirty here (its
  // uncommitted code.txt edit) — quick mode must commit it and leave the tree clean.
  interface CommitRes { committed?: boolean; hash?: string; subject?: string; reason?: string; error?: string }
  const ciQuick = await post(`/api/slots/${lnDirty.slot}/commit`, { mode: "quick" });
  const ciQuickJ = (await ciQuick.json()) as CommitRes;
  check("commit quick mode commits a dirty lane and returns a short hash",
    ciQuick.ok && ciQuickJ.committed === true && /^[0-9a-f]{7,}$/.test(ciQuickJ.hash ?? ""), JSON.stringify(ciQuickJ));
  check("commit quick mode uses the deterministic wip message",
    (ciQuickJ.subject ?? "").startsWith("wip: saved from Fleet dashboard"), JSON.stringify(ciQuickJ.subject));
  const riskAfterCommit = (await (await get(`/api/slots/${lnDirty.slot}/risk`)).json()) as WtRiskRow;
  check("lane tree is clean after commit (no dirty files remain)",
    riskAfterCommit.dirtyFiles.length === 0, JSON.stringify(riskAfterCommit.dirtyFiles));
  const ciClean = await post(`/api/slots/${lnDirty.slot}/commit`, { mode: "quick" });
  const ciCleanJ = (await ciClean.json()) as CommitRes;
  check("commit on a clean lane is an idempotent no-op (committed:false + reason)",
    ciClean.ok && ciCleanJ.committed === false && (ciCleanJ.reason ?? "").includes("clean"), JSON.stringify(ciCleanJ));
  // agent mode on a fresh dirty lane: the FLEET_COMMIT_CMD stand-in supplies the message
  const lnAgent = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  await Bun.write(`${lnAgent.cwd}/code.txt`, "root\nagent-commit\n");
  const ciAgent = await post(`/api/slots/${lnAgent.slot}/commit`, { mode: "agent" });
  const ciAgentJ = (await ciAgent.json()) as CommitRes;
  check("commit agent mode lands the agent-supplied conventional-commit message",
    ciAgent.ok && ciAgentJ.committed === true && ciAgentJ.subject === "feat: stand-in commit message", JSON.stringify(ciAgentJ));
  await post(`/api/slots/${lnAgent.slot}/kill`, {});
  check("commit refuses a non-lane (plain repo) slot", (await post("/api/slots/2/commit", { mode: "quick" })).status === 400);

  await post(`/api/slots/${lnDirty.slot}/kill`, {});
  await post(`/api/slots/${lnClean2.slot}/kill`, {});
}
