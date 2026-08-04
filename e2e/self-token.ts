// The scoped self-scheduling credential: FLEET_SELF_TOKEN / FLEET_SELF_SLOT in a lane pane's
// spawn env, and what /api/self/autos and /api/self/drift will and will not accept it for.
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { BASE, REPO, ROOT, TOKEN, check, paneEnv, post } from "./harness";
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

  // KEEP this lane alive across the server restart (below) to prove its selfToken persists —
  // the restart section (guards fix A) uses this token, then tears the lane down.
  ctx.restartSelfTok = selfTok;
  ctx.restartSelfSlot = lnTok.slot;
}
