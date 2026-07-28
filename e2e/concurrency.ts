// Race-hardening regression guards: bounded completed one-shots, the git-op-in-progress guard on
// commit and merge, and concurrent merge POSTs cross-guarded against commit.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { REPO, check, get, post } from "./harness";
import { exists, setMergeMode, settleForMerge, waitMerge } from "./lane-helpers";

export async function run(): Promise<void> {
  // --- Part B3: concurrency / race-hardening regression guards ---
  // helper: read this slot's autos split by enabled from /api/sessions
  const autosFor = async (slot: number): Promise<{ enabled: number; disabled: number; total: number }> => {
    const sx = (await (await get("/api/sessions")).json()) as { autos: { slot: number; enabled: boolean }[] };
    const mine = sx.autos.filter((a) => a.slot === slot);
    return { enabled: mine.filter((a) => a.enabled).length, disabled: mine.filter((a) => !a.enabled).length, total: mine.length };
  };

  // FIX 3 — completed one-shots must be pruned to AUTO_KEEP_DONE (=5) per slot, not grow
  // unbounded. Create AUTO_KEEP_DONE+4 one-shots; toggle all but the last to disabled
  // (deterministic stand-in for a one-shot completing). Each create prunes the slot's
  // disabled set, so after the final create the disabled count is capped at exactly 5.
  {
    const KEEP = 5;
    const lnAuto = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number };
    const mk = async (): Promise<string> => {
      const j = (await (await post(`/api/slots/${lnAuto.slot}/autos`, { text: "prune-test", inSec: 3600 })).json()) as { auto?: { id: string } };
      return j.auto?.id ?? "";
    };
    for (let i = 0; i < KEEP + 3; i++) {
      const id = await mk();
      await post(`/api/autos/${id}/toggle`, {}); // one-shot enabled→disabled, no run needed
    }
    // after KEEP+3 creates the slot retains at most KEEP+1 (each create prunes disabled back
    // to KEEP, then the just-created one is toggled done → KEEP+1) — bounded, not KEEP+3.
    const beforeLast = await autosFor(lnAuto.slot);
    check("FIX3: disabled one-shots stay bounded (KEEP+1) despite KEEP+3 creates — no unbounded growth",
      beforeLast.disabled === KEEP + 1 && beforeLast.total === KEEP + 1, JSON.stringify(beforeLast));
    await mk(); // one more create → prunes again, leaving KEEP disabled + 1 enabled
    const after = await autosFor(lnAuto.slot);
    check("FIX3: a fresh create prunes disabled to exactly AUTO_KEEP_DONE (+ the new enabled one)",
      after.disabled === KEEP && after.enabled === 1 && after.total === KEEP + 1, JSON.stringify(after));
    await post(`/api/slots/${lnAuto.slot}/kill`, {});
  }

  // FIX 4 — a lane with a half-finished git op (MERGE_HEAD present) must not be committed
  // (a plain add+commit would finalize conflict markers) nor merged by Fleet.
  {
    const ln = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
    const gd = spawnSync("git", ["-C", ln.cwd, "rev-parse", "--absolute-git-dir"]).stdout.toString().trim();
    const head = spawnSync("git", ["-C", ln.cwd, "rev-parse", "HEAD"]).stdout.toString().trim();
    // commit path: needs a DIRTY tree (clean tree short-circuits before the guard) + MERGE_HEAD
    await Bun.write(`${ln.cwd}/code.txt`, "root\nhalf-merge\n");
    await Bun.write(`${gd}/MERGE_HEAD`, `${head}\n`);
    const ciJ = (await (await post(`/api/slots/${ln.slot}/commit`, { mode: "quick" })).json()) as { committed?: boolean; reason?: string };
    check("FIX4: commit refuses a lane with a git op in progress",
      ciJ.committed === false && (ciJ.reason ?? "").includes("in progress"), JSON.stringify(ciJ));
    // merge path: needs a CLEAN tree (uncommitted check precedes the guard) + MERGE_HEAD
    spawnSync("git", ["-C", ln.cwd, "checkout", "-q", "--", "code.txt"]);
    const mgJ = (await (await post(`/api/slots/${ln.slot}/merge`, {})).json()) as { status?: string; detail?: string };
    check("FIX4: merge blocks a lane with a git op in progress",
      mgJ.status === "blocked" && (mgJ.detail ?? "").includes("in progress"), JSON.stringify(mgJ));
    spawnSync("rm", ["-f", `${gd}/MERGE_HEAD`]);
    await post(`/api/slots/${ln.slot}/kill`, {});
  }

  // FIX 1's ROOT CAUSE — the .git/index.lock race. `git status`/`git diff` take that lock for one
  // reason, to write back the index they just refreshed, and it collides with the merge pre-pass.
  // Measured on this machine: two status pollers against a worktree rebasing in a loop failed 16 of
  // 60 `rebase --abort`s and left the tree WEDGED mid-rebase 15 times. The pre-pass discarded the
  // abort's exit code, so the job walked on, spawned the agent into a wedged lane, and blamed it —
  // "agent reported rebased, but the lane is not clean", exactly the signature that failed one FIX1
  // instance in 8 of 18 recorded suite runs across six trees.
  // Staged DETERMINISTICALLY, by holding index.lock across the whole job: git never removes a lock
  // it did not create, so every one of gitRetry's attempts is guaranteed to find it. (Planting the
  // lock mid-rebase instead — to make the ABORT the failing call — was tried and measured: it does
  // not reliably wedge the tree, so it would have traded one flake for another. The abort-failed-
  // and-the-lane-is-still-mid-rebase branch of tryScriptRebase is therefore covered by its git-
  // verified predicate, not by a check here; that is a stated coverage gap, not an assumed pass.)
  // Contract: the verdict names the git plumbing rather than the agent, nothing lands, and the lane
  // is left re-runnable rather than damaged.
  {
    const lnLk = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
    await Bun.write(`${lnLk.cwd}/code.txt`, "root\nlock-lane\n");
    spawnSync("git", ["-C", lnLk.cwd, "commit", "-aqm", "lock lane work"]);
    await Bun.write(`${REPO}/code.txt`, "root\nlock-main\n"); // same line → the pre-pass conflicts
    spawnSync("git", ["-C", REPO, "commit", "-aqm", "lock main work"]);
    const gd = spawnSync("git", ["-C", lnLk.cwd, "rev-parse", "--absolute-git-dir"]).stdout.toString().trim();
    const lock = `${gd}/index.lock`;
    const midRebase = (): boolean => exists(`${gd}/rebase-merge`) || exists(`${gd}/rebase-apply`);
    // "do" — if the job wrongly proceeded past the wedge, this agent WOULD rebase and resolve, and
    // its detail string ("fake rebased") would appear in the verdict. Its absence is the proof.
    await setMergeMode("do");
    await settleForMerge(lnLk.slot);

    // (A) the DETERMINISTIC half: hold the lock from before the POST, so the pre-pass rebase cannot
    // even start. There is then no conflict to hand anyone — but the old code called that "the
    // conflict path with zero files", spawned the agent, watched its rebase fail on the same lock,
    // and recorded "agent reported rebased, but the lane is not rebased onto main". The lock is the
    // author of that failure and the verdict has to say so.
    let holding = true;
    const holder = (async (): Promise<void> => {
      // re-create continuously: gitRetry backs off and retries for ~1.5s per call, and every one of
      // those attempts has to find the lock still there
      while (holding) {
        try { writeFileSync(lock, ""); } catch { /* already present — that is the point */ }
        await Bun.sleep(2);
      }
    })();
    await post(`/api/slots/${lnLk.slot}/merge`, {});
    const vLk = await waitMerge(lnLk.slot);
    holding = false;
    await holder;
    spawnSync("rm", ["-f", lock]);
    const lkDetail = vLk.last?.detail ?? "";
    check("FIX1-race: a pre-pass rebase that index.lock kept from starting yields an error verdict, not a land",
      vLk.last?.status === "error" && vLk.last.landed === false && exists(lnLk.cwd), JSON.stringify(vLk.last));
    check("FIX1-race: the verdict names the git plumbing that actually failed, and never blames the agent",
      lkDetail.includes("index.lock") && lkDetail.includes("did not start")
        && !lkDetail.includes("reported rebased"), JSON.stringify(lkDetail));
    check("FIX1-race: no agent was consulted — there was no conflict for one to resolve",
      !lkDetail.includes("fake rebased"), JSON.stringify(lkDetail));
    check("FIX1-race: the lane is left re-runnable, not wedged mid-rebase",
      !midRebase() && spawnSync("git", ["-C", lnLk.cwd, "status", "--porcelain"]).stdout.toString().trim() === "",
      spawnSync("git", ["-C", lnLk.cwd, "status", "--porcelain"]).stdout.toString());
    check("FIX1-race: nothing from the blocked lane reached main",
      !spawnSync("git", ["-C", REPO, "log", "--oneline", "-3"]).stdout.toString().includes("lock lane work"),
      spawnSync("git", ["-C", REPO, "log", "--oneline", "-3"]).stdout.toString().trim());
    // and the lane really is re-runnable: with the lock gone the same POST resolves normally
    await settleForMerge(lnLk.slot);
    await post(`/api/slots/${lnLk.slot}/merge`, {});
    const vLk2 = await waitMerge(lnLk.slot);
    check("FIX1-race: once the lock is gone the very same lane merges normally (the halt was a pause, not damage)",
      vLk2.last?.status === "resolved" && exists(lnLk.cwd), JSON.stringify(vLk2.last));
    await post(`/api/slots/${lnLk.slot}/kill`, {});
  }

  // FIX 1 + FIX 5 — merge concurrency + cross-guard with commit. Build a genuine conflict so
  // the merge starts a real (async, non-trivial) job.
  {
    const ln = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
    await Bun.write(`${ln.cwd}/code.txt`, "root\nCONC-lane\n");
    spawnSync("git", ["-C", ln.cwd, "commit", "-aqm", "conc lane work"]);
    await Bun.write(`${REPO}/code.txt`, "root\nCONC-main\n"); // same line → conflict
    spawnSync("git", ["-C", REPO, "commit", "-aqm", "conc main work"]);
    await setMergeMode("do");
    await settleForMerge(ln.slot); // clear FIX 9's idle gate before starting the job

    // FIX 1: two truly-concurrent merge POSTs. Post-fix, the mergeStart reservation is taken
    // BEFORE the readJson await, so only one job is ever started; both requests report
    // running:true and the lane resolves to a single clean verdict (no double-rebase error).
    const [r1, r2] = await Promise.all([post(`/api/slots/${ln.slot}/merge`, {}), post(`/api/slots/${ln.slot}/merge`, {})]);
    const j1 = (await r1.json()) as { running?: boolean; status?: string };
    const j2 = (await r2.json()) as { running?: boolean; status?: string };
    check("FIX1: two concurrent merge POSTs both report running (neither errors)",
      j1.running === true && j2.running === true && !j1.status && !j2.status, JSON.stringify({ j1, j2 }));

    // FIX 5 (commit side): while the merge job is inflight, a commit is refused with the
    // cross-guard 409 — deterministic, mergeInflight is held for the job's whole lifetime.
    const ciDuring = await post(`/api/slots/${ln.slot}/commit`, { mode: "quick" });
    const ciDuringJ = (await ciDuring.json()) as { error?: string };
    check("FIX5: commit is refused (409) while a merge/land is in progress",
      ciDuring.status === 409 && (ciDuringJ.error ?? "").includes("merge/land is in progress"), `${ciDuring.status} ${JSON.stringify(ciDuringJ)}`);

    const vConc = await waitMerge(ln.slot);
    check("FIX1: concurrent merges settle to a single clean resolution (lane intact, no corruption)",
      !vConc.gone && vConc.last?.status === "resolved" && exists(ln.cwd), JSON.stringify(vConc.last));
    await post(`/api/slots/${ln.slot}/kill`, {});
  }
}
