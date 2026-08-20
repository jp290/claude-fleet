// The scoped self-scheduling credential: FLEET_SELF_TOKEN / FLEET_SELF_SLOT in EVERY session's
// spawn env (lane or not, since 2026-08-07), and what the /api/self routes will and will not
// accept it for — including both opposite scope rules (lane-only questions vs main-only exit).
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { BASE, REPO, ROOT, TOKEN, check, get, paneEnv, plogRead, post } from "./harness";
import type { Ctx } from "./ctx";
import { LOCAL_PROOF_STEPS, localProofFor } from "../verify-proportion";
import {
  FRAGMENTS_FOR, FRAGMENT_TITLES, RULEBOOK_BACKREF_HEADING, RULEBOOK_DIR, RULEBOOK_FRAGMENTS,
  fragmentFileName, renderRulebook, rulebookBody, type RulebookFragment,
} from "../rulebook";

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
  // The other half — and the decision this file records. A PLAIN (non-lane) slot's pane carries
  // the credential TOO. This check asserted the opposite until 2026-08-07, when the export stopped
  // being keyed on `s.worktree`: that carve-out was never a security boundary, only a withheld
  // capability. `selfToken` was already minted and persisted for every slot, and the server already
  // authenticated a plain slot's token — it answered it 409 "not a lane" where an unknown one gets
  // 401 (both pinned below). Flipping the export handed the pane a credential the routes already
  // knew. Same probe rules as the lane pair above: null (pane never answered) is a harness failure
  // and fails, so a silent probe can never be mistaken for a present token.
  const plainTok = await paneEnv("s2", "FLEET_SELF_TOKEN");
  const plainSlotVar = await paneEnv("s2", "FLEET_SELF_SLOT");
  // ...and it must be slot 2's OWN credential, not merely a well-shaped one: read the persisted row
  // and compare. openSlot mints the token and queues saveState BEFORE it awaits the pane spawn, so
  // the file can lag the route by a hair — poll for the shape, then assert the equality (a timeout
  // still yields the last value read, so a genuine mismatch fails here instead of hiding in a retry).
  let plainSelf = "";
  for (let i = 0; i < 40 && !/^[0-9a-f]{32}$/.test(plainSelf); i++) {
    try { plainSelf = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
      { slots?: Record<string, { selfToken?: string }> }).slots?.["2"]?.selfToken ?? ""; } catch { /* mid-write */ }
    if (!/^[0-9a-f]{32}$/.test(plainSelf)) await Bun.sleep(100);
  }
  check("FLEET_SELF_TOKEN + FLEET_SELF_SLOT present in a PLAIN (non-lane) slot's spawn env too",
    /^[0-9a-f]{32}$/.test(plainTok ?? "") && Number(plainSlotVar) === 2, `tok=[${plainTok}] slot=[${plainSlotVar}]`);
  check("the plain slot's exported token is that slot's OWN persisted credential, not just 32 hex",
    plainTok === plainSelf && plainSelf !== selfTok,
    `pane=[${(plainTok ?? "").slice(0, 8)}…] state=[${plainSelf.slice(0, 8)}…] lane=[${selfTok.slice(0, 8)}…]`);

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

  // --- THE CAPABILITY THE WIDENED EXPORT EXISTS FOR, driven end-to-end from the plain session's
  // OWN pane-exported token (not a state read): a non-lane session schedules its own check-in.
  // /api/self/autos never had a lane check — createAutoForSlot asks only for `s.cwd` — so this
  // pins that the whole feature really is one export line, and that the slot binding survives the
  // widening: the spoofed `slot` in the body must still be ignored in favour of the token's own. ---
  const plainOk = await selfAuto({ token: plainTok ?? "", body: { text: "plain session self check-in", inSec: 3600, slot: lnTok.slot } });
  const plainOkJ = (await plainOk.json()) as { ok?: boolean; auto?: { id: string; slot: number; text: string } };
  check("POST /api/self/autos succeeds for a PLAIN session with its own exported token",
    plainOk.ok && !!plainOkJ.auto, `${plainOk.status} ${JSON.stringify(plainOkJ)}`);
  check("a plain session's auto lands on ITS OWN slot — a spoofed `slot` field is still ignored",
    plainOkJ.auto?.slot === 2, JSON.stringify(plainOkJ.auto));
  const plainPerp = await selfAuto({ token: plainTok ?? "", body: { text: "plain immortal", inSec: 5, everySec: 10, perpetual: true } });
  check("a plain session cannot mint a perpetual auto either (the widening moved no guard rail)",
    plainPerp.status === 403, String(plainPerp.status));

  // --- GET /api/self: the session's own row, the read half of the family and the one route here
  // that is not about a lane. Pinned for BOTH principals — a plain session (where `lane` is null)
  // and the lane (where it names the branch), because that field is what makes the four 409s below
  // predictable instead of surprising. ---
  const selfState = (token?: string) => fetch(BASE + "/api/self", {
    headers: token !== undefined ? { "x-fleet-self-token": token } : {},
  });
  type Self = { slot: number; label: string | null; cwd: string; mission: string | null;
    awaiting: "owner" | "main" | null; lane: { repo: string; branch: string } | null;
    idleMs: number; observed: boolean; autos: { id: string; slot: number; text: string }[] };
  const pRes = await selfState(plainTok ?? "");
  const pSelf = (await pRes.json()) as Self;
  check("GET /api/self: a plain session reads its own row — its slot, its cwd, lane:null",
    pRes.ok && pSelf.slot === 2 && pSelf.cwd === process.env.HOME && pSelf.lane === null
      && typeof pSelf.idleMs === "number" && pSelf.idleMs >= 0 && typeof pSelf.observed === "boolean",
    JSON.stringify({ slot: pSelf.slot, cwd: pSelf.cwd, lane: pSelf.lane, idleMs: pSelf.idleMs, observed: pSelf.observed }));
  check("GET /api/self serves the session its OWN autos and only those",
    pSelf.autos.some((a) => a.id === plainOkJ.auto?.id) && pSelf.autos.every((a) => a.slot === 2),
    JSON.stringify(pSelf.autos.map((a) => `${a.slot}:${a.id}`)));
  const lRes = await selfState(selfTok);
  const lSelf = (await lRes.json()) as Self;
  check("GET /api/self: a lane reads the same row shape, with `lane` naming its own branch",
    lRes.ok && lSelf.slot === lnTok.slot && lSelf.cwd === lnTok.cwd && lSelf.lane?.branch === lnTok.branch,
    JSON.stringify({ slot: lSelf.slot, lane: lSelf.lane }));
  check("GET /api/self: the owner token does not substitute for a selfToken", (await selfState(TOKEN)).status === 401);
  check("GET /api/self: a missing selfToken header is rejected", (await selfState(undefined)).status === 401);
  check("GET /api/self: an unknown selfToken is rejected", (await selfState("0".repeat(32))).status === 401);
  if (plainOkJ.auto) check("delete the plain session's auto (cleanup)", (await post(`/api/autos/${plainOkJ.auto.id}/delete`, {})).ok);

  // --- THE REFUSALS ARE THE FEATURE. Widening the export handed the credential to sessions that
  // can never land, so the lane-only routes have to keep saying so — and say it as 409
  // ("recognized credential, unanswerable question"), never as 401, which would read as "not a
  // credential at all" and send a session hunting for a token it already holds. Driven with the
  // plain pane's OWN token. drift and gate are additionally pinned inside their own sections
  // below, where their fixtures live; this covers the family in one place, including the two POSTs
  // that have no section of their own. ---
  const laneOnly: [string, RequestInit][] = [
    ["/api/self/drift", { method: "GET" }],
    ["/api/self/gate", { method: "GET" }],
    ["/api/self/criterion", { method: "POST", body: JSON.stringify({ text: "a plain session has no founding task" }) }],
    ["/api/self/verify-intent", { method: "POST", body: JSON.stringify({ phase: "start" }) }],
    ["/api/self/clarifications", { method: "POST", body: JSON.stringify({ question: "a plain session is not a worker lane" }) }],
    ["/api/self/fleet-report", { method: "POST", body: JSON.stringify({ status: "complete", text: "a plain session is not a worker lane" }) }],
  ];
  const refusals = await Promise.all(laneOnly.map(async ([path, init]) => {
    const r = await fetch(BASE + path, {
      ...init, headers: { "content-type": "application/json", "x-fleet-self-token": plainTok ?? "" },
    });
    return `${path}:${r.status}`;
  }));
  check("the lane-only self routes answer a PLAIN session 409 not-a-lane — never 401, never 200",
    refusals.every((r) => r.endsWith(":409")), refusals.join(" "));

  // --- THE OPPOSITE SCOPE: succeed/retire belong only to a plain main session. A lane already has
  // a lifecycle verb — land — and the steward is a standing role, so both refusals are 409 with
  // their own reason. 401 would falsely tell either caller to hunt for another credential. ---
  const successionPost = (path: "succeed" | "retire", token: string, body: unknown = {}) =>
    fetch(`${BASE}/api/self/${path}`, {
      method: "POST", headers: { "content-type": "application/json", "x-fleet-self-token": token },
      body: JSON.stringify(body),
    });
  const laneSuccession = await Promise.all([
    successionPost("succeed", selfTok), successionPost("retire", selfTok),
  ]);
  const laneSuccessionText = await Promise.all(laneSuccession.map((r) => r.text()));
  check("a LANE is refused 409 by both /api/self/succeed and /retire — it lands, it does not migrate",
    laneSuccession.every((r) => r.status === 409)
      && laneSuccessionText.every((t) => t.includes("a lane lands")),
    laneSuccession.map((r, i) => `${r.status}:${laneSuccessionText[i]}`).join(" | "));

  const oldPlainLabel = pSelf.label ?? "";
  check("succession scope setup: the plain slot can be labelled as the ⚙ steward",
    (await post("/api/slots/2/rename", { label: "⚙ steward" })).ok);
  const stewardSuccession = await Promise.all([
    successionPost("succeed", plainTok ?? ""), successionPost("retire", plainTok ?? ""),
  ]);
  const stewardSuccessionText = await Promise.all(stewardSuccession.map((r) => r.text()));
  check("the ⚙ steward is refused 409 by both /api/self/succeed and /retire — the standing role never migrates",
    stewardSuccession.every((r) => r.status === 409)
      && stewardSuccessionText.every((t) => t.includes("standing role")),
    stewardSuccession.map((r, i) => `${r.status}:${stewardSuccessionText[i]}`).join(" | "));
  check("succession scope cleanup: the plain slot's prior label is restored",
    (await post("/api/slots/2/rename", { label: oldPlainLabel })).ok);

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
  // route must say so (409, "not a lane"), never collapse it into 401's "not a credential at all".
  // `plainSelf` is slot 2's persisted credential, read and proved equal to its pane's export above.
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

  // A REBASED lane reports its OWN contribution — never the history main gained underneath it.
  // The surface used to be anchored on `worktree.baseSha`, the immutable FORK commit, which is
  // PROVENANCE and not an operative comparison base: once a lane is rebased onto a moved
  // integration branch, everything main gained since the fork sits inside the lane's own history
  // and got reported as that lane's in-flight work. Three-dot does not heal it — the old fork
  // stays an ancestor of the rebased tip, so `base...HEAD` degenerates to `base..HEAD` (measured
  // on the lane this was found on: both forms returned the same 37 files, against a true
  // contribution of one). Not a display wart: on 2026-08-06 two lanes read a phantom 37-file
  // surface off this very payload and routed their work around files nobody was holding.
  // Deliberately placed AFTER the audit-trail section: this fixture moves a ref, so the drift read
  // below books a fourth event and the "exactly three" count above is about the d0..d4 fixture.
  const intBr = spawnSync("git", ["-C", REPO, "rev-parse", "--abbrev-ref", "HEAD"]).stdout.toString().trim();
  writeFileSync(`${REPO}/drift-rebase-main.txt`, "main gained this after the other lane forked\n");
  spawnSync("git", ["-C", REPO, "add", "drift-rebase-main.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "drift: main moves under the other lane"]);
  const reb = spawnSync("git", ["-C", lnOther.cwd, "rebase", intBr]);
  check("drift fixture: the other lane rebases cleanly onto the moved integration branch",
    reb.status === 0, `${reb.status} ${reb.stderr.toString().slice(0, 200)}`);
  const d5 = (await (await selfDrift(selfTok)).json()) as Drift;
  const rebEntry = d5.otherLanes.find((l) => l.branch === lnOther.branch);
  check("drift: a REBASED lane reports only its own contribution, not what main gained under it",
    !!rebEntry && rebEntry.files.length === 1 && rebEntry.files[0] === "drift-other.txt",
    JSON.stringify(rebEntry ?? null));
  check("drift cleanup: the second lane is torn down", (await post(`/api/slots/${lnOther.slot}/kill`, {})).ok);

  // --- GET /api/self/gate: the live land-gate facts, served from the server's own process env.
  // The env pass-throughs (verify/cleanReview/…) are pinned by their own suites; what is tested
  // HARD here is this route's own logic — auth, the one-scope rule, and the rulebook compare. ---
  check("local proof: docs-only asks for exactly install,pins and no isolated preview",
    JSON.stringify(localProofFor(["docs/guide.md"]))
      === JSON.stringify({ steps: ["install", "pins"], isolatedPreview: false,
        classifiedAs: { "docs/guide.md": "docs-or-prose" } }));
  check("local proof: src-only asks for install,pins,tsc,build",
    JSON.stringify(localProofFor(["src/client.ts"]).steps) === JSON.stringify(["install", "pins", "tsc", "build"]));
  check("local proof: e2e work asks for the full chain and isolated preview",
    JSON.stringify(localProofFor(["e2e/self-token.ts"]).steps) === JSON.stringify(LOCAL_PROOF_STEPS)
      && localProofFor(["e2e/self-token.ts"]).isolatedPreview === true);
  check("local proof: server.ts asks for the full chain and merge/land self-assessment",
    JSON.stringify(localProofFor(["server.ts"]).steps) === JSON.stringify(LOCAL_PROOF_STEPS)
      && localProofFor(["server.ts"]).isolatedPreview === "self-assess");
  check("local proof: an empty diff fails closed to the full chain",
    JSON.stringify(localProofFor([])) === JSON.stringify({
      steps: LOCAL_PROOF_STEPS, isolatedPreview: "self-assess", classifiedAs: {},
    }));
  const conservativeProof = localProofFor(["docs/guide.md", "new-top-level.unknown"]);
  check("local proof: one unknown file flips an otherwise docs-only diff to the conservative full default",
    JSON.stringify(conservativeProof.steps) === JSON.stringify(LOCAL_PROOF_STEPS)
      && conservativeProof.isolatedPreview === "self-assess"
      && conservativeProof.classifiedAs["new-top-level.unknown"] === "conservative-default",
    JSON.stringify(conservativeProof));

  const selfGate = (token?: string) => fetch(BASE + "/api/self/gate", {
    headers: token !== undefined ? { "x-fleet-self-token": token } : {},
  });
  type Gate = { verify: { cmd: string; timeoutMs: number; waitMs: number; skipExit: number } | null; cleanReview: string;
    autoReview: { tickMs: number; idleMs: number } | null; postlandAudit: boolean;
    mergeRepairRounds: number; rulebookDrifted: boolean | null;
    suiteLock: { pid: number | null; alive: boolean | null; heldMs: number; state: string } | null;
    localProof: ReturnType<typeof localProofFor> | null };
  const g0Res = await selfGate(selfTok);
  const g0 = (await g0Res.json()) as Gate;
  const proofBase = spawnSync("git", ["-C", lnTok.cwd, "merge-base", intBr, "HEAD"]).stdout.toString().trim();
  const proofFiles = spawnSync("git", ["-C", lnTok.cwd, "diff", "--name-only", `${proofBase}...HEAD`])
    .stdout.toString().trim().split("\n").filter(Boolean).sort();
  check("GET /api/self/gate: a real lane receives localProof classifying every file in its committed footprint",
    g0Res.ok && g0.localProof !== null
      && JSON.stringify(Object.keys(g0.localProof.classifiedAs).sort()) === JSON.stringify(proofFiles)
      && proofFiles.every((file) => typeof g0.localProof?.classifiedAs[file] === "string"),
    JSON.stringify({ files: proofFiles, localProof: g0.localProof }));
  // --- suiteLock, the machine-busy fact (autonomy verbs, Verb 1): the one wait a lane's verify
  // actually hangs on, now named by the route that names the judge. Pinned against DISK truth
  // rather than an assumed harness shape: under a wrapper run the stage mutex is held by our own
  // wrapper for the whole run, a standalone `bun fleet-e2e.ts` sees it free — the assertion is
  // AGREEMENT with the lock dir, so it is deterministic in both forms instead of correct in one.
  const lockDir = process.env.FLEET_SUITE_LOCK ?? "/tmp/fleet-e2e.lock";
  let lockDirExists = false; let diskPid: number | null = null;
  try { lockDirExists = statSync(lockDir).isDirectory(); } catch { lockDirExists = false; }
  if (lockDirExists) {
    try {
      const raw = readFileSync(`${lockDir}/pid`, "utf8").trim();
      diskPid = /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
    } catch { diskPid = null; }
  }
  check("gate: suiteLock agrees with the lock dir on disk (held by our wrapper, parked, or free)",
    !lockDirExists ? g0.suiteLock === null
      : diskPid === null ? g0.suiteLock?.state === "parked"
      : g0.suiteLock?.pid === diskPid && g0.suiteLock.alive === true
        && (g0.suiteLock.state === "held" || g0.suiteLock.state === "overdue"),
    JSON.stringify({ disk: { exists: lockDirExists, pid: diskPid }, route: g0.suiteLock }));
  // BOTH budgets, because one of them is what a lane's verify actually hangs on: `timeoutMs` is
  // the work budget and `waitMs` the queueing one, and a route that named only the first would
  // still be telling a lane that a 300s gate is a 300s gate when 255s of it can be somebody else's
  // suite (VERIFY_WAIT_MS in server.ts, the 2026-08-06 incident).
  check("GET /api/self/gate: full shape, skipExit pinned to 42, no rulebook on either side reads null",
    g0Res.ok && (g0.verify === null || (typeof g0.verify.cmd === "string" && g0.verify.skipExit === 42
      && g0.verify.timeoutMs > 0 && g0.verify.waitMs > 0))
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

  // A pre-baseSha lane with an unresolvable recorded base is an honest null, not `steps: []`.
  // Build that old-state shape without patching fleet.json: an orphan worktree has no merge-base,
  // so attach records no baseSha; renaming the primary branch then breaks its recorded base ref.
  const brokenRepo = `${ROOT}/local-proof-broken-repo`;
  const brokenTree = `${ROOT}/local-proof-broken-tree`;
  rmSync(brokenRepo, { recursive: true, force: true });
  rmSync(brokenTree, { recursive: true, force: true });
  mkdirSync(brokenRepo, { recursive: true });
  spawnSync("git", ["-C", brokenRepo, "init", "-q", "-b", "main"]);
  spawnSync("git", ["-C", brokenRepo, "config", "user.email", "e2e@example.invalid"]);
  spawnSync("git", ["-C", brokenRepo, "config", "user.name", "Fleet E2E"]);
  writeFileSync(`${brokenRepo}/seed.txt`, "seed\n");
  spawnSync("git", ["-C", brokenRepo, "add", "seed.txt"]);
  spawnSync("git", ["-C", brokenRepo, "commit", "-qm", "seed"]);
  const orphan = spawnSync("git", ["-C", brokenRepo, "worktree", "add", "--orphan", "-b", "proof-orphan", brokenTree]);
  check("localProof null fixture: an orphan worktree with no merge-base is created",
    orphan.status === 0, orphan.stderr.toString().slice(0, 300));
  writeFileSync(`${brokenTree}/orphan.txt`, "orphan\n");
  spawnSync("git", ["-C", brokenTree, "add", "orphan.txt"]);
  spawnSync("git", ["-C", brokenTree, "commit", "-qm", "orphan"]);
  const brokenLane = (await (await post("/api/lanes", { repo: brokenRepo, attach: brokenTree })).json()) as
    { ok?: boolean; slot?: number; error?: string };
  check("localProof null fixture: the no-baseSha orphan lane attaches",
    brokenLane.ok === true && typeof brokenLane.slot === "number", JSON.stringify(brokenLane));
  const brokenToken = typeof brokenLane.slot === "number" ? await paneEnv(`s${brokenLane.slot}`, "FLEET_SELF_TOKEN") : null;
  const renamed = spawnSync("git", ["-C", brokenRepo, "branch", "-m", "main", "moved-main"]);
  check("localProof null fixture: its recorded base ref is made unresolvable",
    renamed.status === 0, renamed.stderr.toString().slice(0, 300));
  const brokenGateRes = await selfGate(brokenToken ?? "");
  const brokenGate = (await brokenGateRes.json()) as Gate;
  check("GET /api/self/gate: an unanswerable git diff returns 200 with localProof:null and the other gate fields",
    brokenGateRes.ok && brokenGate.localProof === null && "verify" in brokenGate
      && typeof brokenGate.postlandAudit === "boolean" && "suiteLock" in brokenGate,
    `${brokenGateRes.status} ${JSON.stringify(brokenGate)}`);
  if (typeof brokenLane.slot === "number")
    check("localProof null fixture: the lane slot is torn down", (await post(`/api/slots/${brokenLane.slot}/kill`, {})).ok);
  spawnSync("git", ["-C", brokenRepo, "worktree", "remove", "--force", brokenTree]);
  rmSync(brokenTree, { recursive: true, force: true });
  rmSync(brokenRepo, { recursive: true, force: true });

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

  // --- THE SPLIT ITSELF: a lane of a repo that HAS a `rulebook/` is WRITTEN the lane rendering (a
  // strict subset of the fragments) instead of being handed the monolith, and the gate still reads
  // false on it. Both halves in one fixture on purpose: the seam without the probe fix is the
  // self-cancelling state — a permanent `rulebookDrifted: true` ordering every lane to load the
  // very bytes the split saved. Own repo, so REPO's clean-tree assumptions stay untouched.
  {
    const rbRepo = `${ROOT}/rulebook-split-repo`;
    rmSync(rbRepo, { recursive: true, force: true });
    mkdirSync(`${rbRepo}/${RULEBOOK_DIR}`, { recursive: true });
    spawnSync("git", ["-C", rbRepo, "init", "-q", "-b", "main"]);
    spawnSync("git", ["-C", rbRepo, "config", "user.email", "e2e@example.invalid"]);
    spawnSync("git", ["-C", rbRepo, "config", "user.name", "Fleet E2E"]);
    // gitignored on BOTH counts, exactly as in the real checkout: an untracked copy would leave
    // every lane permanently dirty and block `land`, which is why the seam checks check-ignore.
    writeFileSync(`${rbRepo}/.gitignore`, `CLAUDE.md\n${RULEBOOK_DIR}/\n`);
    spawnSync("git", ["-C", rbRepo, "add", ".gitignore"]);
    spawnSync("git", ["-C", rbRepo, "commit", "-qm", "seed"]);
    const frag = new Map<RulebookFragment, string>(
      RULEBOOK_FRAGMENTS.map((f) => [f, `## ${f}\n\nrule text of ${f}\n`]),
    );
    for (const [f, body] of frag) writeFileSync(`${rbRepo}/${RULEBOOK_DIR}/${fragmentFileName(f)}`, body);
    writeFileSync(`${rbRepo}/CLAUDE.md`, renderRulebook("main", frag));

    const rbLane = (await (await post("/api/lanes", { repo: rbRepo })).json()) as
      { ok?: boolean; slot?: number; cwd?: string; error?: string };
    check("rulebook split: a lane of a repo with rulebook/ spawns",
      typeof rbLane.slot === "number" && typeof rbLane.cwd === "string", JSON.stringify(rbLane));
    const written = ((): string | null => {
      try { return readFileSync(`${rbLane.cwd}/CLAUDE.md`, "utf8"); } catch { return null; }
    })();
    const expectBody = renderRulebook("lane", frag);
    const omitted = RULEBOOK_FRAGMENTS.filter((f) => !FRAGMENTS_FOR.lane.includes(f));
    // the SUBSET claim is about the rules, so it is measured on the body: the back-reference block
    // is a fixed ~1 KB and outweighs a synthetic monolith, which says nothing about the real one.
    check("rulebook split: the lane is WRITTEN the lane rendering, not handed the monolith",
      written !== null && rulebookBody(written) === expectBody
        && Buffer.byteLength(expectBody) < Buffer.byteLength(renderRulebook("main", frag))
        && omitted.every((f) => !rulebookBody(written).includes(`rule text of ${f}`))
        && FRAGMENTS_FOR.lane.every((f) => rulebookBody(written).includes(`rule text of ${f}`)),
      `written=${written === null ? "absent" : Buffer.byteLength(written)} B (body ${written === null ? "-" : Buffer.byteLength(rulebookBody(written))} B), lane body=${Buffer.byteLength(expectBody)} B, main=${Buffer.byteLength(renderRulebook("main", frag))} B`);
    check("rulebook split: its back-reference block names every omitted fragment and an absolute path into the SOURCE checkout",
      written !== null && written.includes(RULEBOOK_BACKREF_HEADING)
        && omitted.every((f) => written.includes(FRAGMENT_TITLES[f]))
        && omitted.every((f) => written.includes(`${rbRepo}/${RULEBOOK_DIR}/${fragmentFileName(f)}`)),
      `omitted=${omitted.join(",")}`);
    // the lane must still be landable: a copy that git sees would block it
    const rbStatus = spawnSync("git", ["-C", rbLane.cwd ?? rbRepo, "status", "--porcelain"]).stdout.toString().trim();
    check("rulebook split: the written rulebook leaves the lane clean (gitignored, so `land` is not blocked)",
      rbStatus === "", `status=[${rbStatus.slice(0, 200)}]`);
    const rbTok = typeof rbLane.slot === "number" ? await paneEnv(`s${rbLane.slot}`, "FLEET_SELF_TOKEN") : null;
    const rbGate = (await (await selfGate(rbTok ?? "")).json()) as Gate;
    check("rulebook split: the gate reads rulebookDrifted:false on a subset it wrote itself",
      rbGate.rulebookDrifted === false, JSON.stringify({ rb: rbGate.rulebookDrifted }));
    // and it still SEES a source that moved — including a move in a fragment the lane does not hold
    writeFileSync(`${rbRepo}/${RULEBOOK_DIR}/${fragmentFileName("lane-discipline")}`, "## lane-discipline\n\nmoved\n");
    const rbGate2 = (await (await selfGate(rbTok ?? "")).json()) as Gate;
    check("rulebook split: a moved source fragment still reads rulebookDrifted:true",
      rbGate2.rulebookDrifted === true, JSON.stringify({ rb: rbGate2.rulebookDrifted }));
    // …and a rulebook/ that cannot be read is null — never true, and never a quiet false
    rmSync(`${rbRepo}/${RULEBOOK_DIR}/${fragmentFileName("deploy")}`);
    rmSync(`${rbRepo}/CLAUDE.md`);
    const rbGate3 = (await (await selfGate(rbTok ?? "")).json()) as Gate;
    check("rulebook split: an unreadable source rulebook is null (not comparable), never true",
      rbGate3.rulebookDrifted === null, JSON.stringify({ rb: rbGate3.rulebookDrifted }));
    if (typeof rbLane.slot === "number")
      check("rulebook split: the lane slot is torn down", (await post(`/api/slots/${rbLane.slot}/kill`, {})).ok);
    spawnSync("git", ["-C", rbRepo, "worktree", "remove", "--force", rbLane.cwd ?? ""]);
    rmSync(`${rbRepo}.worktrees`, { recursive: true, force: true });
    rmSync(rbRepo, { recursive: true, force: true });
  }

  // --- THE SUCCESS PATH: the handoff is committed after THIS slot opened, one successor receives
  // the server-built founding ritual, and the caller disappears even if it never remembers to call
  // /retire. A private repo keeps this commit from moving the shared REPO under the drift fixture. ---
  {
    const sr = `${ROOT}/succession-repo`;
    rmSync(sr, { recursive: true, force: true });
    mkdirSync(sr, { recursive: true });
    spawnSync("git", ["-C", sr, "init", "-q", "-b", "main"]);
    spawnSync("git", ["-C", sr, "config", "user.email", "t@t"]);
    spawnSync("git", ["-C", sr, "config", "user.name", "t"]);
    writeFileSync(`${sr}/HANDOFF.md`, "## old handoff\nnot for this session\n");
    spawnSync("git", ["-C", sr, "add", "HANDOFF.md"]);
    spawnSync("git", ["-C", sr, "commit", "-qm", "old handoff"]);

    const free = ((await (await get("/api/sessions")).json()) as
      { slots: { id: number; cwd: string | null }[] }).slots.find((x) => x.cwd === null)?.id ?? 0;
    const opened = free ? await post(`/api/slots/${free}/open`,
      { cwd: sr, label: "main-before", model: "claude-sonnet-5" }) : null;
    check("self-succeed setup: a private plain main session is open", !!opened?.ok, `${free}:${opened?.status}`);
    const oldTok = free ? await paneEnv(`s${free}`, "FLEET_SELF_TOKEN") ?? "" : "";
    check("self-succeed setup: the caller's pane carries its own token", /^[0-9a-f]{32}$/.test(oldTok), oldTok);

    const staleHandoff = await successionPost("succeed", oldTok);
    const staleHandoffText = await staleHandoff.text();
    check("POST /api/self/succeed refuses a handoff committed before this session opened",
      staleHandoff.status === 409 && staleHandoffText.includes("successor would have nothing to read"),
      `${staleHandoff.status} ${staleHandoffText}`);

    // git timestamps are whole seconds while openedAt is milliseconds. Cross a second boundary so
    // this fixture proves the intended ordering rather than depending on timestamp truncation.
    await Bun.sleep(1100);
    writeFileSync(`${sr}/HANDOFF.md`, "## current handoff\nthis is the successor's ground truth\n\n## older material\nignore first\n");
    spawnSync("git", ["-C", sr, "add", "HANDOFF.md"]);
    const hc = spawnSync("git", ["-C", sr, "commit", "-qm", "fresh session handoff"]);
    check("self-succeed setup: HANDOFF.md is freshly committed and clean",
      hc.status === 0 && spawnSync("git", ["-C", sr, "status", "--porcelain", "--", "HANDOFF.md"])
        .stdout.toString().trim() === "", hc.stderr.toString());

    const longLabel = `next-${"x".repeat(60)}`;
    const carry = "C".repeat(600);
    const succeeded = await successionPost("succeed", oldTok, { label: longLabel, carry });
    const sj = (await succeeded.json()) as { ok?: boolean; slot?: number; label?: string | null };
    check("POST /api/self/succeed opens exactly one labelled successor and caps the label at MAX_LABEL",
      succeeded.ok && sj.ok === true && !!sj.slot && sj.slot !== free
        && sj.label === longLabel.slice(0, 40), `${succeeded.status} ${JSON.stringify(sj)}`);
    const rows = ((await (await get("/api/sessions")).json()) as
      { slots: { id: number; cwd: string | null; label: string | null; model: string | null; harness?: string }[] }).slots;
    const successor = rows.find((x) => x.id === sj.slot);
    check("the successor inherits cwd, model and default harness from the caller",
      successor?.cwd === sr && successor.model === "claude-sonnet-5" && successor.harness === undefined,
      JSON.stringify(successor));

    let founding = "";
    for (let i = 0; i < 40 && !founding; i++) {
      founding = (await plogRead()).find((e) => e.slot === sj.slot && e.text.startsWith("[fleet succession]"))?.text ?? "";
      if (!founding) await Bun.sleep(100);
    }
    const ritual = ["./state.sh", "./register.sh", "obersten Abschnitt von HANDOFF.md", "Live-Queue"]
      .map((x) => founding.indexOf(x));
    check("the server-built founding brief orders state · register · HANDOFF top · Live-Queue and says the predecessor is retiring",
      ritual.every((x) => x >= 0) && ritual.every((x, i) => i === 0 || ritual[i - 1]! < x)
        && founding.includes("Die Vorgängerin zieht sich gerade zurück"), founding.slice(0, 500));
    check("the optional inter-session carry is capped at 500 characters",
      founding.includes("C".repeat(500)) && !founding.includes("C".repeat(501)), `brief=${founding.length} chars`);

    let oldGone = false;
    for (let i = 0; i < 50 && !oldGone; i++) {
      const ss = ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] }).slots;
      oldGone = ss.find((x) => x.id === free)?.cwd === null;
      if (!oldGone) await Bun.sleep(100);
    }
    check("the grace deadline retires the predecessor and clears its label even without /retire",
      oldGone, JSON.stringify(((await (await get("/api/sessions")).json()) as
        { slots: { id: number; cwd: string | null; label: string | null }[] }).slots.find((x) => x.id === free)));

    const successorTok = sj.slot ? await paneEnv(`s${sj.slot}`, "FLEET_SELF_TOKEN") ?? "" : "";
    const retired = await successionPost("retire", successorTok);
    const retiredRow = ((await (await get("/api/sessions")).json()) as
      { slots: { id: number; cwd: string | null; label: string | null }[] }).slots.find((x) => x.id === sj.slot);
    check("POST /api/self/retire immediately removes the reporting successor and clears its label",
      retired.ok && retiredRow?.cwd === null && retiredRow.label === null,
      `${retired.status} ${JSON.stringify(retiredRow)}`);
    rmSync(sr, { recursive: true, force: true });
  }

  // KEEP this lane alive across the server restart (below) to prove its selfToken persists —
  // the restart section (guards fix A) uses this token, then tears the lane down.
  ctx.restartSelfTok = selfTok;
  ctx.restartSelfSlot = lnTok.slot;
}
