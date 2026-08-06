// The scoped self-scheduling credential: FLEET_SELF_TOKEN / FLEET_SELF_SLOT in a lane pane's
// spawn env, and what /api/self/autos and /api/self/drift will and will not accept it for.
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { BASE, REPO, ROOT, TOKEN, check, get, paneEnv, post } from "./harness";
import type { Ctx } from "./ctx";

export async function run(ctx: Ctx): Promise<void> {
  // --- Part C: scoped self-scheduling token (FLEET_SELF_TOKEN / FLEET_SELF_SLOT) ---
  const lnTok = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  // Both probes read the pane through paneEnv (harness.ts): a unique marker per probe, matched
  // line-anchored, with the send-keys retried until the marked OUTPUT line renders. That is what
  // makes them deterministic — a fixed sleep raced the shell's readiness AND the render, and a
  // bare poll could still settle on an earlier probe's line. A null answer means the pane never
  // replied at all (a harness failure), which is not the same as an empty variable.
  const laneTok = await paneEnv(`s${lnTok.slot}`, "FLEET_SELF_TOKEN");
  const laneSlot = await paneEnv(`s${lnTok.slot}`, "FLEET_SELF_SLOT");
  check("FLEET_SELF_TOKEN + FLEET_SELF_SLOT present in a lane slot's spawn env",
    /^[0-9a-f]{32}$/.test(laneTok ?? "") && Number(laneSlot) === lnTok.slot, `tok=[${laneTok}] slot=[${laneSlot}]`);
  const selfTok = laneTok ?? "";
  // the NEGATIVE half: a plain (non-lane) slot's shell must report the variable as unset. An
  // empty string is the assertion; null (pane never answered) fails, so a silent probe can never
  // be mistaken for "no token".
  const plainTok = await paneEnv("s2", "FLEET_SELF_TOKEN");
  check("FLEET_SELF_TOKEN absent for a non-lane slot", plainTok === "", `[${plainTok}]`);

  const selfAuto = (opts: { token?: string; body?: unknown }) => fetch(BASE + "/api/self/autos", {
    method: "POST",
    headers: { "content-type": "application/json", ...(opts.token !== undefined ? { "x-fleet-self-token": opts.token } : {}) },
    body: JSON.stringify(opts.body ?? { text: "x", inSec: 60 }),
  });
  const okRes = await selfAuto({ token: selfTok, body: { text: "self-scheduled check-in", inSec: 3600, slot: 2 } });
  const okJ = (await okRes.json()) as { ok?: boolean; auto?: { id: string; slot: number } };
  check("POST /api/self/autos succeeds with a valid selfToken", okRes.ok && !!okJ.auto, JSON.stringify(okJ));
  check("a spoofed `slot` field in the body is ignored — the auto lands on the token's OWN slot",
    okJ.auto?.slot === lnTok.slot, JSON.stringify(okJ.auto));
  const ownerOnSelf = await selfAuto({ token: TOKEN });
  check("the owner token does not substitute for a selfToken on this route", ownerOnSelf.status === 401);
  const wrongSelf = await selfAuto({ token: "0".repeat(32) });
  check("an unknown selfToken is rejected", wrongSelf.status === 401);
  const noSelf = await selfAuto({});
  check("a missing selfToken header is rejected", noSelf.status === 401);
  if (okJ.auto) check("delete self-scheduled auto (cleanup)", (await post(`/api/autos/${okJ.auto.id}/delete`, {})).ok);
  const selfPerp = await selfAuto({ token: selfTok, body: { text: "self immortal", inSec: 5, everySec: 10, perpetual: true } });
  check("a self-token lane cannot mint a perpetual auto (owner-only, 403)", selfPerp.status === 403, String(selfPerp.status));

  // --- GET /api/self/drift: the lane-facing read of "how far has the integration branch moved
  // past me". Committed state only — the probe (`git merge-tree`) simulates a merge, and `dirty`
  // is the flag that says uncommitted work was not assessed. ---
  const selfDrift = (token?: string) => fetch(BASE + "/api/self/drift", {
    headers: token !== undefined ? { "x-fleet-self-token": token } : {},
  });
  type Drift = { branch: string; main: string; behind: number; dirty: boolean; wouldConflict: boolean | null;
    conflictFiles: string[]; overlap: string[]; otherLanes: { branch: string; files: string[] }[] };
  const d0Res = await selfDrift(selfTok);
  const d0 = (await d0Res.json()) as Drift;
  check("GET /api/self/drift: a fresh lane is current — behind 0, no conflict, clean tree",
    d0Res.ok && d0.branch === lnTok.branch && d0.behind === 0 && d0.wouldConflict === false
      && d0.dirty === false && d0.conflictFiles.length === 0 && d0.overlap.length === 0,
    JSON.stringify(d0));
  check("drift: the owner token does not substitute for a selfToken", (await selfDrift(TOKEN)).status === 401);
  check("drift: a missing selfToken header is rejected", (await selfDrift(undefined)).status === 401);
  // a plain session's selfToken is a RECOGNIZED credential asking an unanswerable question — the
  // route must say so (409, "not a lane"), never collapse it into 401's "not a credential at all"
  let plainSelf = "";
  for (let i = 0; i < 40 && !/^[0-9a-f]{32}$/.test(plainSelf); i++) {
    try { plainSelf = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
      { slots?: Record<string, { selfToken?: string }> }).slots?.["2"]?.selfToken ?? ""; } catch { /* mid-write */ }
    if (!/^[0-9a-f]{32}$/.test(plainSelf)) await Bun.sleep(100);
  }
  check("drift fixture: plain slot 2's selfToken is readable from persisted state",
    /^[0-9a-f]{32}$/.test(plainSelf), `[${plainSelf.slice(0, 8)}…]`);
  const plainRes = await selfDrift(plainSelf);
  check("drift: a plain (non-lane) slot's selfToken answers 409 not-a-lane, never a generic 401",
    plainRes.status === 409, String(plainRes.status));
  // main moves harmlessly: behind counts it, nothing conflicts, nothing overlaps
  writeFileSync(`${REPO}/drift-main.txt`, "main moved\n");
  spawnSync("git", ["-C", REPO, "add", "drift-main.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "drift: main gains a harmless file"]);
  const d1 = (await (await selfDrift(selfTok)).json()) as Drift;
  check("drift: a harmless commit on main reads behind:1, wouldConflict:false, no overlap",
    d1.behind === 1 && d1.wouldConflict === false && d1.overlap.length === 0,
    JSON.stringify({ behind: d1.behind, wc: d1.wouldConflict, overlap: d1.overlap }));
  // both sides now add the SAME file with different content (add/add conflict): the probe must
  // flip to wouldConflict:true and NAME the file, and the overlap list must carry it too
  writeFileSync(`${lnTok.cwd}/drift-clash.txt`, "lane version\n");
  spawnSync("git", ["-C", lnTok.cwd, "add", "drift-clash.txt"]);
  spawnSync("git", ["-C", lnTok.cwd, "commit", "-qm", "drift: lane side of the clash"]);
  writeFileSync(`${REPO}/drift-clash.txt`, "main version\n");
  spawnSync("git", ["-C", REPO, "add", "drift-clash.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "drift: main side of the clash"]);
  const d2 = (await (await selfDrift(selfTok)).json()) as Drift;
  check("drift: both sides touching the same file reads wouldConflict:true and names it",
    d2.behind === 2 && d2.wouldConflict === true && d2.conflictFiles.includes("drift-clash.txt")
      && d2.overlap.includes("drift-clash.txt"),
    JSON.stringify({ behind: d2.behind, wc: d2.wouldConflict, cf: d2.conflictFiles, overlap: d2.overlap }));
  // uncommitted work is outside the probe's reach — `dirty` is the flag that says so
  writeFileSync(`${lnTok.cwd}/drift-dirty.txt`, "uncommitted\n");
  const d3 = (await (await selfDrift(selfTok)).json()) as Drift;
  check("drift: uncommitted lane work reads dirty:true (the probe assesses committed work only)",
    d3.dirty === true, JSON.stringify({ dirty: d3.dirty }));
  rmSync(`${lnTok.cwd}/drift-dirty.txt`);
  // the cross-lane half: another open lane's committed in-flight files are visible — the one part
  // of the payload the session could not read more conveniently than the server
  const lnOther = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  writeFileSync(`${lnOther.cwd}/drift-other.txt`, "other lane work\n");
  spawnSync("git", ["-C", lnOther.cwd, "add", "drift-other.txt"]);
  spawnSync("git", ["-C", lnOther.cwd, "commit", "-qm", "drift: other lane in-flight work"]);
  const d4 = (await (await selfDrift(selfTok)).json()) as Drift;
  const otherEntry = d4.otherLanes.find((l) => l.branch === lnOther.branch);
  check("drift: another open lane's committed in-flight files are listed under otherLanes",
    !!otherEntry && otherEntry.files.includes("drift-other.txt"), JSON.stringify(d4.otherLanes));
  check("drift cleanup: the second lane is torn down", (await post(`/api/slots/${lnOther.slot}/kill`, {})).ok);

  // --- the drift AUDIT TRAIL (autonomy map §11.3 step A). The route used to write nothing, so
  // "does a lane ever check its drift, and how early in its life?" had no answer anywhere. What is
  // pinned here is what makes that question computable: one event per FRESH answer, the branch in
  // the detail as the join key to lane-outcomes (slot ids are recycled, branches are not), and the
  // dedupe — a re-ask with no ref moved must stay silent, or a polling lane would rotate this log's
  // own history off the end. The six reads above are the fixture: d0/d1/d2 each moved a ref (three
  // events), d3 only dirtied the tree and d4 only moved ANOTHER lane's branch (no event), and the
  // 409/401 attempts have no lane answer to book at all.
  type Ev = { ts: number; event: string; slot?: number; detail?: string };
  // /api/audit serves NEWEST FIRST (it ts-sorts descending, server.ts) — these assertions and the
  // §11.2 metric both read forwards in time, so sort back to chronological here rather than let a
  // positional check quietly encode the route's display order.
  const driftEvents = async (): Promise<Ev[]> =>
    ((await (await get("/api/audit?limit=1000")).json()) as { events: Ev[] }).events
      .filter((e) => e.event === "self_drift" && (e.detail ?? "").startsWith(`${lnTok.branch} `))
      .sort((a, b) => a.ts - b.ts);
  // audit() is fire-and-forget on a shared chain: poll up to the expected count, THEN settle and
  // re-read, so "exactly three" cannot pass on a fourth event that is merely still in flight.
  let evs = await driftEvents();
  for (let i = 0; i < 40 && evs.length < 3; i++) { await Bun.sleep(100); evs = await driftEvents(); }
  await Bun.sleep(300);
  evs = await driftEvents();
  check("drift audit: exactly one event per FRESH answer — the three ref-moving reads, no more",
    evs.length === 3, JSON.stringify(evs.map((e) => e.detail)));
  check("drift audit: a re-ask with no ref moved books nothing (dirty-only and other-lane reads)",
    evs.filter((e) => (e.detail ?? "").includes("dirty:true")).length === 0, JSON.stringify(evs.map((e) => e.detail)));
  check("drift audit: the detail carries branch + the verdict fields the §11.2 metric joins on",
    evs[0]?.detail === `${lnTok.branch} behind:0 conflict:false dirty:false`
      && evs[1]?.detail === `${lnTok.branch} behind:1 conflict:false dirty:false`
      && evs[2]?.detail === `${lnTok.branch} behind:2 conflict:true dirty:false`,
    JSON.stringify(evs.map((e) => e.detail)));
  check("drift audit: the event is attributed to the asking lane's own slot",
    evs.every((e) => e.slot === lnTok.slot), JSON.stringify(evs.map((e) => e.slot)));

  // --- GET /api/self/gate: the live land-gate facts, served from the server's own process env.
  // The env pass-throughs (verify/cleanReview/…) are pinned by their own suites; what is tested
  // HARD here is this route's own logic — auth, the one-scope rule, and the rulebook compare. ---
  const selfGate = (token?: string) => fetch(BASE + "/api/self/gate", {
    headers: token !== undefined ? { "x-fleet-self-token": token } : {},
  });
  type Gate = { verify: { cmd: string; timeoutMs: number; skipExit: number } | null; cleanReview: string;
    autoReview: { tickMs: number; idleMs: number } | null; postlandAudit: boolean;
    mergeRepairRounds: number; rulebookDrifted: boolean | null };
  const g0Res = await selfGate(selfTok);
  const g0 = (await g0Res.json()) as Gate;
  check("GET /api/self/gate: full shape, skipExit pinned to 42, no rulebook on either side reads null",
    g0Res.ok && (g0.verify === null || (typeof g0.verify.cmd === "string" && g0.verify.skipExit === 42))
      && ["off", "gate", "shadow"].includes(g0.cleanReview)
      && (g0.autoReview === null || g0.autoReview.tickMs > 0)
      && typeof g0.postlandAudit === "boolean"
      && g0.mergeRepairRounds >= 0 && g0.mergeRepairRounds <= 3
      && g0.rulebookDrifted === null,
    JSON.stringify(g0));
  check("gate: the owner token does not substitute for a selfToken", (await selfGate(TOKEN)).status === 401);
  check("gate: a missing selfToken header is rejected", (await selfGate(undefined)).status === 401);
  check("gate: a plain (non-lane) slot's selfToken answers 409 not-a-lane, never a generic 401",
    (await selfGate(plainSelf)).status === 409, "reuses the drift fixture's plain-slot token");
  // rulebook compare: identical copy reads false, a moved source reads true. Fixtures are
  // UNTRACKED files in REPO and the lane — removed right after, an untracked file in either
  // tree would poison later modules' clean-tree assumptions (and a lane's landability).
  writeFileSync(`${REPO}/CLAUDE.md`, "rules v1\n");
  writeFileSync(`${lnTok.cwd}/CLAUDE.md`, "rules v1\n");
  const g1 = (await (await selfGate(selfTok)).json()) as Gate;
  check("gate: an identical rulebook copy reads rulebookDrifted:false", g1.rulebookDrifted === false,
    JSON.stringify({ rb: g1.rulebookDrifted }));
  writeFileSync(`${REPO}/CLAUDE.md`, "rules v1\nrules v2\n");
  const g2 = (await (await selfGate(selfTok)).json()) as Gate;
  check("gate: a source rulebook that moved past the copy reads rulebookDrifted:true", g2.rulebookDrifted === true,
    JSON.stringify({ rb: g2.rulebookDrifted }));
  rmSync(`${REPO}/CLAUDE.md`);
  rmSync(`${lnTok.cwd}/CLAUDE.md`);

  // KEEP this lane alive across the server restart (below) to prove its selfToken persists —
  // the restart section (guards fix A) uses this token, then tears the lane down.
  ctx.restartSelfTok = selfTok;
  ctx.restartSelfSlot = lnTok.slot;
}
