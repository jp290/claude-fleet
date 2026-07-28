// Helpers shared by every worktree-lane check module: the fake merge agent's mode file, the
// two deterministic waits (async merge job settled / pane idle past the land gate), and the
// verdict shape they return.
import { statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { check, get, post, REPO } from "./harness";

export const exists = (p: string): boolean => { try { statSync(p); return true; } catch { return false; } };
export const setMergeMode = (m: string) => Bun.write(`${REPO.replace(/\/[^/]+$/, "")}/mergemode`, m);
// merge is an async job — poll GET until the run settles; a 400 means the slot was
// torn down (the job landed the lane), which IS the success signal for `do`
// `ok: null` is the SKIPPED state — the command declined to verify this tree (server.ts,
// VERIFY_SKIP_EXIT). Distinct from ok:false (ran, failed) and from an absent field (no command
// configured), and the type has to carry it or the checks below cannot tell a skip from a pass.
export type VerifyField = { cmd: string; ok: boolean | null; out: string; at: number; mainSha: string; stale?: boolean };
// `cleanReview` is the ② advisory reviewer's verdict, present only when FLEET_CLEAN_REVIEW gates
// (fleet-e2e-clean-review.ts's gate phase). Optional, so the modules that never see it are unaffected.
// `conflicted` is the files whose resolution no human has seen yet — set on the conflict path, and
// carried forward onto a re-run's verdict when main moved and the resolution replayed cleanly.
export type MergeVerdict = { status: string; detail: string; landed: boolean; verify?: VerifyField; landError?: string; repairRounds?: number; conflicted?: string[]; cleanReview?: { verdict: string; reason: string } };
// Poll the async merge job until it settles. The old bound (100×100ms = 10s) was too tight:
// a real-git land (rebase + verify + ff + teardown) under concurrent load can overrun 10s, and
// the loop then returned {gone:false,last:null} — INDISTINGUISHABLE from a legit "not landed"
// verdict, so a slow success read as a spurious failure (the ref-advance flake). Two-part fix:
//  1. Right-sized bound: WAIT_MERGE_MS is a generous test-harness ceiling. The server caps the
//     only genuinely-slow merge step (agent verify) at MERGE_TIMEOUT_MS (server.ts, ≥60s,
//     default 480s), so a legit job never runs longer than that; 60s comfortably covers the
//     git-under-load worst case the isolated suite actually exercises (empirically ≤~1.5s),
//     while staying far below the server cap so a real deadlock still surfaces quickly.
//  2. LOUD timeout: on exhausting the bound we THROW, not silently return null. A slow-but-
//     successful land just waits longer; a genuinely hung merge fails visibly and can never be
//     mistaken for a real verdict. That distinction is the whole point.
const WAIT_MERGE_MS = 60_000;
const WAIT_MERGE_STEP_MS = 100;
// `requireVerdict` is the ONE behavioural difference between this and the copies the single-file
// harnesses used to carry, and it is a real disagreement, not drift — so it is a parameter with
// both readings written down rather than a silent unification:
//   false (default, the main suite): settle as soon as the job stops running. Its callers use
//     `last: null` with `gone: false` as a meaningful outcome — a merge that was refused and never
//     started a job — and requiring a verdict would turn that into a 60s hang and a throw.
//   true (the clean-review / post-land-audit harnesses): `!running` with a null `last` is the
//     started-but-not-yet-recorded lag, not "done". Those harnesses always fire a job that MUST
//     produce a verdict, so returning the lag as a null verdict reads as a spurious failure.
export const waitMerge = async (slot: number, opts: { requireVerdict?: boolean } = {}): Promise<{ gone: boolean; last: MergeVerdict | null }> => {
  const iters = Math.ceil(WAIT_MERGE_MS / WAIT_MERGE_STEP_MS);
  for (let i = 0; i < iters; i++) {
    const r = await get(`/api/slots/${slot}/merge`);
    if (r.status === 400) return { gone: true, last: null };
    const j = (await r.json()) as { running: boolean; last: MergeVerdict | null };
    if (!j.running && (!opts.requireVerdict || j.last !== null)) return { gone: false, last: j.last };
    await Bun.sleep(WAIT_MERGE_STEP_MS);
  }
  throw new Error(`waitMerge timed out after ${WAIT_MERGE_MS / 1000}s for slot ${slot} — merge job never settled (genuine hang, not a verdict)`);
};

// FIX 9 adds an idle gate: a merge is refused while the pane produced output within
// MERGE_IDLE_MS (3s). A freshly-spawned lane pane emits its shell prompt, so wait until
// the slot's lastOutput is stale enough before firing a merge that must start a job.
// Deterministic: polls the server's own clock/lastOutput, returns the instant it clears.
export const MERGE_IDLE_MS = 3000;
export const settleForMerge = async (slot: number): Promise<void> => {
  for (let i = 0; i < 80; i++) {
    const sx = (await (await get("/api/sessions")).json()) as { now: number; slots: { id: number; lastOutput: number }[] };
    const sl = sx.slots.find((x) => x.id === slot);
    if (sl && sx.now - sl.lastOutput >= MERGE_IDLE_MS) return;
    await Bun.sleep(150);
  }
};

// --- seeding and driving a lane, for the harnesses that bring their OWN repo -------------------
// The main suite gets its throwaway repo from the wrapper (FLEET_E2E_REPO) and opens lanes inside
// its check modules. fleet-e2e-clean-review.ts and fleet-e2e-postland-audit.ts each build their own
// repo and drive lanes through the SAME clean+green auto-land path, and each carried a near-verbatim
// copy of the three functions below.

export interface Lane { slot: number; cwd: string; branch: string }

// `-b main` because the lane/land path names main explicitly; gpgsign off because a signing prompt
// in a test repo would hang the run.
export const seedRepo = async (dir: string): Promise<void> => {
  spawnSync("git", ["init", "-q", "-b", "main", dir]);
  spawnSync("git", ["-C", dir, "config", "user.email", "t@t"]);
  spawnSync("git", ["-C", dir, "config", "user.name", "t"]);
  spawnSync("git", ["-C", dir, "config", "commit.gpgsign", "false"]);
  await Bun.write(`${dir}/seed.txt`, "seed\n");
  spawnSync("git", ["-C", dir, "add", "seed.txt"]);
  spawnSync("git", ["-C", dir, "commit", "-qm", "seed"]);
};

// Open a lane on `repo`, optionally give it an owner BRIEF (logged to the prompt journal — what ②
// is told the lane was asked to do; reported as its own check rather than thrown, so a send failure
// names itself instead of taking the run down with an unhandled rejection), and commit one file so
// the lane has real in-flight work whose rebase is CLEAN — its own file, so the merge agent is
// never consulted.
export const openLane = async (repo: string, name: string, brief?: string): Promise<Lane> => {
  const ln = (await (await post("/api/lanes", { repo })).json()) as Lane;
  if (brief) {
    const sent = await post("/send", { slot: ln.slot, text: brief });
    check(`the owner brief for lane ${name} is accepted (and journalled)`, sent.ok, `${sent.status} ${await sent.text()}`);
  }
  await Bun.write(`${ln.cwd}/${name}.txt`, `${name} work\n`);
  spawnSync("git", ["-C", ln.cwd, "add", `${name}.txt`]);
  // a freshly-created lane worktree can briefly hold a git index lock (fleet's tickGit polls it
  // right after `git worktree add`), so the FIRST commit can silently fail. Retry until it is
  // actually in the log — otherwise the lane has no commit and the merge handler treats it as
  // already-at-main.
  for (let i = 0; i < 12; i++) {
    spawnSync("git", ["-C", ln.cwd, "commit", "-qm", `${name} lane work`]);
    if (spawnSync("git", ["-C", ln.cwd, "log", "--oneline", "-1"]).stdout.toString().includes(`${name} lane work`)) break;
    await Bun.sleep(300);
  }
  return ln;
};

// Fire the lane's merge and return the settled verdict. The idle gate can refuse the FIRST attempt
// on a freshly-spawned pane, so retry until the job actually starts (running), the slot is gone
// (landed), or a verdict appears — that way waitMerge never reads a never-started merge as a null
// verdict. Callers here always expect a real verdict, hence requireVerdict.
export const driveMerge = async (ln: Lane, name: string): Promise<{ gone: boolean; last: MergeVerdict | null; branch: string }> => {
  for (let attempt = 0; attempt < 8; attempt++) {
    await settleForMerge(ln.slot);
    const m = await post(`/api/slots/${ln.slot}/merge`, {});
    if (!m.ok) console.error(`[${name}] merge POST attempt ${attempt}: ${m.status} ${(await m.clone().text()).slice(0, 200)}`);
    const r = await get(`/api/slots/${ln.slot}/merge`);
    if (r.status === 400) break; // already landed
    const j = (await r.json()) as { running: boolean; last: MergeVerdict | null };
    if (j.running || j.last !== null) break; // job started (or already settled)
    await Bun.sleep(800);
  }
  return { ...(await waitMerge(ln.slot, { requireVerdict: true })), branch: ln.branch };
};
