// Helpers shared by every worktree-lane check module: the fake merge agent's mode file, the
// two deterministic waits (async merge job settled / pane idle past the land gate), and the
// verdict shape they return.
import { statSync } from "node:fs";
import { get, REPO } from "./harness";

export const exists = (p: string): boolean => { try { statSync(p); return true; } catch { return false; } };
export const setMergeMode = (m: string) => Bun.write(`${REPO.replace(/\/[^/]+$/, "")}/mergemode`, m);
// merge is an async job — poll GET until the run settles; a 400 means the slot was
// torn down (the job landed the lane), which IS the success signal for `do`
export type VerifyField = { cmd: string; ok: boolean; out: string; at: number; mainSha: string; stale?: boolean };
export type MergeVerdict = { status: string; detail: string; landed: boolean; verify?: VerifyField; landError?: string; repairRounds?: number };
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
export const waitMerge = async (slot: number): Promise<{ gone: boolean; last: MergeVerdict | null }> => {
  const iters = Math.ceil(WAIT_MERGE_MS / WAIT_MERGE_STEP_MS);
  for (let i = 0; i < iters; i++) {
    const r = await get(`/api/slots/${slot}/merge`);
    if (r.status === 400) return { gone: true, last: null };
    const j = (await r.json()) as { running: boolean; last: MergeVerdict | null };
    if (!j.running) return { gone: false, last: j.last };
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
