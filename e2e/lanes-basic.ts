// Worktree lanes, the base layer: create/diff/land, the one-click /api/lanes route, the worktrees
// map, the land gate against a busy pane, and the integration-branch config.
import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { REPO, check, get, post, tmuxOut } from "./harness";
import type { LaneCtx } from "./ctx";
import { MERGE_IDLE_MS, settleForMerge } from "./lane-helpers";

export async function run(lc: LaneCtx): Promise<void> {
  const wtOpen = await post("/api/slots/5/open-worktree", { repo: REPO, branch: "e2e-lane" });
  const wtJson = (await wtOpen.json()) as { ok?: boolean; branch?: string; error?: string };
  check("open-worktree creates a lane", wtOpen.ok && wtJson.branch === "e2e-lane", JSON.stringify(wtJson));
  const wtDir = `${REPO}.worktrees/e2e-lane`;
  check("worktree dir materialized on disk", statSync(wtDir).isDirectory());
  check("untracked .env copied into the worktree", statSync(`${wtDir}/.env`).isFile());
  // SEC-12: the copy is the one path that deliberately carries .env into every lane, so it must
  // land 0600 regardless of the source's mode (the live source was 0644 when this was written)
  check("copied .env is owner-only (0600)", (statSync(`${wtDir}/.env`).mode & 0o777) === 0o600, (statSync(`${wtDir}/.env`).mode & 0o777).toString(8));
  const wtRefused = await post("/api/slots/5/open-worktree", { repo: REPO, branch: "e2e-lane" });
  check("open-worktree on an active slot is refused", wtRefused.status === 400);
  const sessWt = (await (await get("/api/sessions")).json()) as { slots: { id: number; worktree: { branch: string } | null }[] };
  check("slot 5 tagged as a worktree lane", sessWt.slots[4].worktree?.branch === "e2e-lane", JSON.stringify(sessWt.slots[4].worktree));
  // the copied .env is gitignored in the test repo, so it must NOT show as dirty — a fresh
  // lane has to be clean, or `land` would be permanently blocked by scaffolding files
  const freshDiff = (await (await get("/api/slots/5/diff")).json()) as { status: string[] };
  check("fresh lane is clean (gitignored .env copy not counted dirty)", freshDiff.status.length === 0, JSON.stringify(freshDiff.status));

  // diff endpoint: make a tracked change in the lane, expect it in the diff
  await Bun.write(`${wtDir}/code.txt`, "root\nlane-edit\n");
  const diff = (await (await get("/api/slots/5/diff")).json()) as { branch: string; status: string[]; diff: string };
  check("diff endpoint reports branch + changed file", diff.branch === "e2e-lane" && diff.status.some((l) => l.includes("code.txt")), JSON.stringify(diff.status));
  check("diff endpoint returns the tracked change", diff.diff.includes("lane-edit"));
  check("diff rejects non-git slot", (await get("/api/slots/2/diff")).status === 400);

  // land refuses a dirty lane
  const landDirty = await post("/api/slots/5/land", {});
  check("land refuses a dirty worktree", landDirty.status === 409, `status ${landDirty.status}`);

  // commit the change → still no upstream, but the branch is at a commit ahead of HEAD,
  // so land must still refuse (unpushed + not merged)
  spawnSync("git", ["-C", wtDir, "commit", "-aqm", "lane work"]);
  const landUnpushed = await post("/api/slots/5/land", {});
  check("land refuses unpushed commits", landUnpushed.status === 409, `status ${landUnpushed.status}`);

  // pushing the lane to a remote (WITHOUT -u/upstream) must make land succeed — the work is
  // preserved on the remote even though @{push} is unresolvable. Regression for the
  // over-strict no-upstream fallback.
  const bare = `${REPO}.remote.git`;
  spawnSync("git", ["init", "--bare", "-q", bare]);
  spawnSync("git", ["-C", wtDir, "remote", "add", "origin", bare]);
  spawnSync("git", ["-C", wtDir, "push", "-q", "origin", "e2e-lane"]); // no -u: creates refs/remotes/origin/*
  const landPushed = await post("/api/slots/5/land", {});
  check("land accepts a lane pushed to a remote (no upstream set)", landPushed.ok, await landPushed.text());
  check("pushed lane removed from disk", !((): boolean => { try { return statSync(wtDir).isDirectory(); } catch { return false; } })());

  // a lane clean AND merged into HEAD (fresh lane at HEAD) lands cleanly. Open a second one.
  const wt2 = await post("/api/slots/6/open-worktree", { repo: REPO, branch: "e2e-clean" });
  check("second clean lane opens", wt2.ok);
  const landClean = await post("/api/slots/6/land", {});
  check("land removes a clean, merged lane", landClean.ok, await landClean.text());
  check("landed slot is now inactive", (await (await get("/api/sessions")).json() as { slots: { cwd: string | null }[] }).slots[5].cwd === null);
  check("landed worktree removed from disk", !((): boolean => { try { return statSync(`${REPO}.worktrees/e2e-clean`).isDirectory(); } catch { return false; } })());
  check("land rejects a non-worktree slot", (await post("/api/slots/2/land", {})).status === 400);

  // --- lane lifecycle v2: worktrees map, one-click lanes, orphan flows, ⏫ merge agent ---

  // one-click lane: the server picks the free slot and auto-names the branch
  const ln1res = await post("/api/lanes", { repo: REPO });
  const ln1 = (await ln1res.json()) as { ok?: boolean; slot?: number; branch?: string; cwd?: string; error?: string };
  check("POST /api/lanes creates a lane in a server-picked free slot",
    ln1res.ok && typeof ln1.slot === "number" && (ln1.branch ?? "").startsWith("fleet/"), JSON.stringify(ln1));
  const lnSlot = ln1.slot ?? 0;
  const lnPath = ln1.cwd ?? "";
  lc.lnSlot = lnSlot;
  lc.lnPath = lnPath;
  check("lanes slot is tagged as a worktree lane",
    ((await (await get("/api/sessions")).json()) as { slots: { id: number; worktree: { branch: string } | null }[] })
      .slots.find((x) => x.id === lnSlot)?.worktree?.branch === ln1.branch);

  // the lane map: repo-wide worktree list with slot attribution, queryable FROM the lane
  const wm = (await (await get(`/api/slots/${lnSlot}/worktrees`)).json()) as
    { repo: string; main: string; worktrees: { path: string; branch: string; slot: number | null; dirty: number; ahead: number }[] };
  check("worktrees map: primary repo + main branch resolved from a lane slot",
    wm.repo.endsWith("/testrepo") && (wm.main === "main" || wm.main === "master"), JSON.stringify({ repo: wm.repo, main: wm.main }));
  check("worktrees map lists the lane with its holding slot",
    wm.worktrees.some((w) => w.slot === lnSlot && w.branch === ln1.branch), JSON.stringify(wm.worktrees));

  // --- landGate busy block (server.ts merge route, canDeliver idleMs: MERGE_IDLE_MS): a
  // non-confirm land is refused while the pane is ACTIVELY producing output, so an owner never
  // lands mid-work on top of the agent's own trailing changes. Every OTHER merge test calls
  // settleForMerge first, so deleting this gate passes them all — this is the one test that
  // fires the merge WHILE busy. lnSlot is a fresh, clean one-click lane (nothing committed yet →
  // no uncommitted-changes / git-op refusal fires first; the idle gate is what we reach). ---
  {
    // Fire the land WHILE the pane is producing output. Robust against a freshly-spawned lane
    // whose shell isn't yet ready to accept send-keys (the probe would be dropped and the pane
    // read idle): retry send-keys until the server's own clock reports the pane busy well inside
    // MERGE_IDLE_MS, then POST immediately — the eval is one round-trip later, still < the gate.
    const isBusy = async (): Promise<boolean> => {
      const sx = (await (await get("/api/sessions")).json()) as { now: number; slots: { id: number; lastOutput: number }[] };
      const sl = sx.slots.find((x) => x.id === lnSlot);
      return !!sl && sx.now - sl.lastOutput < MERGE_IDLE_MS - 1000; // ≥1s margin before the gate
    };
    let busyConfirmed = false;
    let busyMerge: { status?: string; detail?: string; running?: boolean; landed?: boolean } = {};
    for (let attempt = 0; attempt < 15 && !busyConfirmed; attempt++) {
      await tmuxOut("send-keys", "-t", `s${lnSlot}`, `echo landgate-busy-probe-${attempt}`, "Enter");
      for (let i = 0; i < 12; i++) { // ≤600ms for this probe's output to register (poll runs every 100ms)
        if (await isBusy()) { busyConfirmed = true; break; }
        await Bun.sleep(50);
      }
      if (busyConfirmed)
        busyMerge = (await (await post(`/api/slots/${lnSlot}/merge`, {})).json()) as typeof busyMerge;
    }
    check("landgate setup: the lane pane reads BUSY before the land (non-tautology guard)", busyConfirmed);
    check("land is BLOCKED while the pane is actively working (idle gate), never starting a job",
      busyMerge.status === "blocked" && (busyMerge.detail ?? "").includes("actively working"), JSON.stringify(busyMerge));
    // it must have been the gate, not a spawned job — confirm no merge job is running afterward
    const busyAfter = (await (await get(`/api/slots/${lnSlot}/merge`)).json()) as { running?: boolean; error?: string };
    check("the busy-blocked land started no merge job", busyAfter.running === false, JSON.stringify(busyAfter));
  }

  // --- integration-branch config (/api/repo-base): overrides the branch derived from the
  // primary's HEAD, so the primary can be parked off the integration branch. Set to a decoy
  // real branch, confirm the worktrees map reports it, then clear back to derived. ---
  {
    spawnSync("git", ["-C", REPO, "branch", "-f", "integ-decoy", "HEAD"]);
    const setBad = await post("/api/repo-base", { repo: REPO, branch: "no-such-branch" });
    check("repo-base rejects a nonexistent branch", setBad.status === 400, String(setBad.status));
    const setOk = (await (await post("/api/repo-base", { repo: REPO, branch: "integ-decoy" })).json()) as { ok?: boolean; base?: string };
    check("repo-base sets the integration branch", setOk.ok === true && setOk.base === "integ-decoy", JSON.stringify(setOk));
    const wmCfg = (await (await get(`/api/slots/${lnSlot}/worktrees`)).json()) as { main: string };
    check("worktrees map reflects the configured integration branch", wmCfg.main === "integ-decoy", wmCfg.main);
    const clr = (await (await post("/api/repo-base", { repo: REPO, branch: "" })).json()) as { base: string | null };
    check("repo-base clears back to derived (null)", clr.base === null, JSON.stringify(clr));
    const wmClr = (await (await get(`/api/slots/${lnSlot}/worktrees`)).json()) as { main: string };
    check("worktrees map derives main again after clear", wmClr.main === "main" || wmClr.main === "master", wmClr.main);
  }
}
