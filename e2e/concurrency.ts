// Race-hardening regression guards: bounded completed one-shots, the git-op-in-progress guard on
// commit and merge, and concurrent merge POSTs cross-guarded against commit.
import { spawnSync } from "node:child_process";
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
