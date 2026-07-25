// e2e for the OPT-IN clean-path advisory reviewer (server.ts runCleanReview + the mergeJob clean+green
// hook). The MAIN suite runs with FLEET_CLEAN_REVIEW unset (default OFF) and thus proves the untouched
// auto-land; THIS harness boots with the flag ON + a stand-in reviewer and proves the ON behaviour:
// a "review" verdict downgrades a clean+green auto-land to a stop-and-review, "ok" lets it land, and a
// BROKEN reviewer fails CLOSED (stops, never lands). Run via ./e2e-clean-review.sh — never a live fleet.
// The same file runs a second time under FLEET_CR_PHASE=shadow against a server booted with
// FLEET_CLEAN_REVIEW=shadow: there the reviewer is POWERLESS — every verdict lands and is only
// RECORDED on the lane's outcome row (`cleanReviewShadow`).
import { spawnSync } from "node:child_process";
const IP = "127.0.0.1";
const PORT = Number(process.env.FLEET_PORT ?? 8790);
const SOCK = process.env.FLEET_SOCK ?? "fleetcrtest";
if (SOCK === "claudefleet") throw new Error("refusing to run against the live socket");
const BASE = `http://${IP}:${PORT}`;
const results: string[] = [];
let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
}

const stateFile = (await Bun.file(`${import.meta.dir}/fleet.json`).json()) as { token?: string };
const TOKEN = stateFile.token ?? "";
const H = { "content-type": "application/json", authorization: `Bearer ${TOKEN}` };
const post = (path: string, body: unknown): Promise<Response> =>
  fetch(BASE + path, { method: "POST", headers: H, body: JSON.stringify(body) });
const get = (path: string): Promise<Response> => fetch(BASE + path, { headers: H });

type MergeVerdict = { status: string; detail: string; landed: boolean; cleanReview?: { verdict: string; reason: string } };
const WAIT_MS = 60_000;
const STEP = 100;
const waitMerge = async (slot: number): Promise<{ gone: boolean; last: MergeVerdict | null }> => {
  for (let i = 0; i < Math.ceil(WAIT_MS / STEP); i++) {
    const r = await get(`/api/slots/${slot}/merge`);
    if (r.status === 400) return { gone: true, last: null }; // slot torn down = the lane LANDED
    const j = (await r.json()) as { running: boolean; last: MergeVerdict | null };
    // settle ONLY on a real verdict: !running with a null last means the job hasn't produced one yet
    // (started/recorded lag), not "done" — keep polling rather than returning a spurious null.
    if (!j.running && j.last !== null) return { gone: false, last: j.last };
    await Bun.sleep(STEP);
  }
  throw new Error(`waitMerge timed out for slot ${slot} — merge job never settled`);
};
const settleForMerge = async (slot: number): Promise<void> => {
  for (let i = 0; i < 80; i++) {
    const sx = (await (await get("/api/sessions")).json()) as { now: number; slots: { id: number; lastOutput: number }[] };
    const sl = sx.slots.find((x) => x.id === slot);
    if (sl && sx.now - sl.lastOutput >= 3000) return;
    await Bun.sleep(150);
  }
};
const setReviewMode = (m: string): Promise<number> => Bun.write(`${import.meta.dir}/cleanreviewmode`, m);
const mainLog = (): string => spawnSync("git", ["-C", REPO, "log", "--oneline", "-6"]).stdout.toString();

// throwaway repo the lanes fork from
const REPO = `${import.meta.dir}/testrepo`;
spawnSync("git", ["init", "-q", "-b", "main", REPO]);
spawnSync("git", ["-C", REPO, "config", "user.email", "t@t"]);
spawnSync("git", ["-C", REPO, "config", "user.name", "t"]);
spawnSync("git", ["-C", REPO, "config", "commit.gpgsign", "false"]);
await Bun.write(`${REPO}/seed.txt`, "seed\n");
spawnSync("git", ["-C", REPO, "add", "seed.txt"]);
spawnSync("git", ["-C", REPO, "commit", "-qm", "seed"]);

// create a lane that rebases CLEANLY (its own file → no conflict, the merge agent is never consulted),
// commit its work, drive its merge, return the settled verdict. This is exactly the clean+green
// auto-land path the reviewer guards.
const cleanLaneMerge = async (name: string): Promise<{ gone: boolean; last: MergeVerdict | null; branch: string }> => {
  const ln = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  await Bun.write(`${ln.cwd}/${name}.txt`, `${name} work\n`);
  spawnSync("git", ["-C", ln.cwd, "add", `${name}.txt`]);
  // a freshly-created lane worktree can briefly hold a git index lock (fleet's tickGit polls it right
  // after `git worktree add`), so the FIRST commit can silently fail. Retry until it is actually in the
  // log — otherwise the lane has no commit and the merge handler treats it as already-at-main.
  for (let i = 0; i < 12; i++) {
    spawnSync("git", ["-C", ln.cwd, "commit", "-qm", `${name} lane work`]);
    if (spawnSync("git", ["-C", ln.cwd, "log", "--oneline", "-1"]).stdout.toString().includes(`${name} lane work`)) break;
    await Bun.sleep(300);
  }
  // the idle gate can refuse the FIRST merge attempt on a freshly-spawned pane — retry until the job
  // actually starts (running) or the slot is gone (landed) or a verdict appears, so waitMerge never
  // reads a never-started merge as a null verdict.
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
  return { ...(await waitMerge(ln.slot)), branch: ln.branch };
};

// the lane's outcome row (lane-outcomes.jsonl via the owner-only read endpoint), looked up by the
// lane's branch — the shadow verdict's only home.
type ShadowRow = { verdict: string | null; at: number; model: string; notes: string; raw: boolean };
type OutcomeRow = { branch: string | null; disposition: string; cleanReviewShadow?: ShadowRow };
const outcomeFor = async (branch: string): Promise<OutcomeRow | null> => {
  const j = (await (await get("/api/lane-outcomes?limit=300")).json()) as { outcomes: OutcomeRow[] };
  return j.outcomes.find((o) => o.branch === branch) ?? null;
};

const PHASE = process.env.FLEET_CR_PHASE ?? "gate";
if (PHASE === "shadow") {
  // ---- SHADOW PHASE (server booted with FLEET_CLEAN_REVIEW=shadow) ----
  // (D) the assertion that matters most: a "would_stop" verdict must NOT gate. The land happens
  // exactly as if ② were off, and the verdict is recorded on the outcome row instead.
  await setReviewMode("review");
  const D = await cleanLaneMerge("delta");
  const dRow = await outcomeFor(D.branch);
  check("shadow: a would_stop verdict does NOT gate — the clean lane still auto-lands", D.gone, JSON.stringify(D));
  check("shadow: the would_stop lane's commit DID reach main", mainLog().includes("delta lane work"), mainLog());
  check("shadow: the would_stop verdict is recorded on the outcome row",
    dRow?.disposition === "landed" && dRow.cleanReviewShadow?.verdict === "would_stop"
      && dRow.cleanReviewShadow.raw === false && dRow.cleanReviewShadow.notes.length > 0
      && dRow.cleanReviewShadow.at > 0 && typeof dRow.cleanReviewShadow.model === "string",
    JSON.stringify(dRow?.cleanReviewShadow));

  // (E) an "ok" verdict lands (as it would anyway) and is recorded as a pass.
  await setReviewMode("ok");
  const E = await cleanLaneMerge("echo");
  const eRow = await outcomeFor(E.branch);
  check("shadow: an ok verdict lands", E.gone && mainLog().includes("echo lane work"), JSON.stringify(E));
  check("shadow: the ok verdict is recorded as verdict:'pass', raw:false",
    eRow?.cleanReviewShadow?.verdict === "pass" && eRow.cleanReviewShadow.raw === false,
    JSON.stringify(eRow?.cleanReviewShadow));

  // (F) fail direction INVERTED vs gate mode: nothing is gated, so a broken reviewer is a FAILED
  // MEASUREMENT (verdict null, raw true) — never a fabricated pass, and never a stop either.
  await setReviewMode("garbage");
  const F = await cleanLaneMerge("foxtrot");
  const fRow = await outcomeFor(F.branch);
  check("shadow: a broken reviewer still lands (shadow gates nothing)",
    F.gone && mainLog().includes("foxtrot lane work"), JSON.stringify(F));
  check("shadow: a broken reviewer records verdict:null + raw:true, NOT a pass",
    fRow?.cleanReviewShadow !== undefined && fRow.cleanReviewShadow.verdict === null
      && fRow.cleanReviewShadow.raw === true,
    JSON.stringify(fRow?.cleanReviewShadow));

  console.log(results.join("\n"));
  console.log(failed ? `\n${failed} FAILURES` : "\nALL PASS");
  process.exit(failed ? 1 : 0);
}

// ---- GATE PHASE (server booted with FLEET_CLEAN_REVIEW=1) ----
// (A) reviewer "review" → the clean+green auto-land is DOWNGRADED to a stop-and-review, NOT landed.
await setReviewMode("review");
const A = await cleanLaneMerge("alpha");
check("reviewer 'review' downgrades a clean+green auto-land to a stop (resolved, not landed)",
  !A.gone && A.last?.status === "resolved" && A.last?.landed === false && A.last?.cleanReview?.verdict === "review",
  JSON.stringify(A.last));
check("the downgraded lane's commit did NOT reach main", !mainLog().includes("alpha lane work"), mainLog());

// (B) reviewer "ok" → the clean+green lane AUTO-LANDS (slot torn down, commit on main).
await setReviewMode("ok");
const B = await cleanLaneMerge("bravo");
check("reviewer 'ok' lets a clean+green lane auto-land (slot torn down)", B.gone, JSON.stringify(B));
check("the ok'd lane's commit reached main", mainLog().includes("bravo lane work"), mainLog());
// gate mode records no shadow verdict — the two modes' records must not blur into each other
const bRow = await outcomeFor(B.branch);
check("gate mode writes NO cleanReviewShadow on the landed row",
  bRow?.disposition === "landed" && bRow.cleanReviewShadow === undefined, JSON.stringify(bRow));

// (C) a BROKEN reviewer (non-JSON) → FAIL CLOSED: the auto-land is stopped, never landed. This is the
// safety property under reviewer failure — a bug can only ever cost a click, never land something unseen.
await setReviewMode("garbage");
const C = await cleanLaneMerge("charlie");
check("a broken reviewer FAILS CLOSED — clean+green land is stopped, not landed",
  !C.gone && C.last?.status === "resolved" && C.last?.landed === false && C.last?.cleanReview?.verdict === "review",
  JSON.stringify(C.last));
check("the fail-closed lane's commit did NOT reach main", !mainLog().includes("charlie lane work"), mainLog());

console.log(results.join("\n"));
console.log(failed ? `\n${failed} FAILURES` : "\nALL PASS");
process.exit(failed ? 1 : 0);
