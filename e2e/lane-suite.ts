// e2e for LANE SUITES IN THE REMOTE HELPER PORTAL (server.ts, grep `LaneSuiteJob`) — the second
// job kind: a lane hands its own `./e2e-isolated.sh` PREVIEW to another machine instead of holding
// this box's single suite mutex for it.
//
// WHY IT LIVES IN THE MAIN RUNNER and not beside e2e/helper-portal.ts in the postland harness.
// That module needs `FLEET_POSTLAND_AUDIT_CMD`, because an audit job IS the tier-2 queue and the
// queue is unreachable without it. A lane-suite job needs no such env at all — the LANE offers it —
// so the constraint that forced its sibling into a hand-started harness does not apply here, and
// the placement rule that does apply says put it where something actually runs it: the post-land
// audit fires `./e2e-isolated.sh` ~9 min after every land, while `./e2e-postland-audit.sh` runs
// only when a human starts it ("kein Gate faehrt sie, also rottet sie unbemerkt", once for months).
//
// THE ONE INVARIANT UNDER TEST is the owner's, unchanged from the audit half — work is taken over,
// never doubled, never lost — plus the one this cut adds and that no other check in this repo can
// see: THE TREE THAT LEAVES IS THE LANE'S WORKING TREE. A bundle of HEAD is the plausible wrong
// implementation, and it fails SILENTLY: the suite runs, it passes, and it answers a question about
// code the lane has not got. (LS.3) is that assertion.
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { BASE, REPO, ROOT, check, get, post } from "./harness";
import { openLane, type Lane } from "./lane-helpers";

interface HelperJob {
  id: string; kind?: string; repo: string; main: string; branches: string[]; covers: number;
  oldestAt: number; claim: { name: string; claimedAt: number; expiresAt: number } | null;
  localRunning: boolean; untracked?: number;
}
interface HelperJobs { claimTimeoutMs: number; configured: boolean; jobs: HelperJob[] }
interface ClaimedJob {
  id: string; kind?: string; repo: string; main: string; mainSha: string; treeSha?: string;
  branch?: string; untracked?: number; claimedAt: number; expiresAt: number; name: string;
}
interface OfferView {
  id: string; state: string; branch: string; offeredAt: number;
  commitSha: string | null; treeSha: string | null; untracked: number | null;
  claim: { name: string; claimedAt: number; expiresAt: number } | null;
  // `remote` and `treeSha` are OPTIONAL here on purpose, and it is the same rule
  // e2e/helper-portal.ts states about its own row type: what is under test is that the server
  // WRITES the provenance, and a type that made the field mandatory would let a server that never
  // wrote it take the module down with a TypeError instead of failing the named check. Measured:
  // stripping the remote block from laneSuiteView did exactly that until this line was written.
  result: {
    exitCode: number | null; result: string; reason?: string; tail?: string; trail?: string;
    checks?: { ran: number; failed: number } | null;
    remote?: { name: string; claimedAt: number; reportedAt: number };
    treeSha?: string; ms?: number;
  } | null;
}
interface OfferPayload {
  offer: OfferView | null; existing?: boolean; mayRunLocally?: boolean; error?: string;
  waitPolicy?: { freeMs: number; heldMs: number };
  suiteLock?: unknown;
}

const DEVICE = "lanesuitedev01";     // matches the server's /^[a-z0-9]{8,32}$/
const DEVICE_NAME = "lane-suite box";

// A body reader that CANNOT take the run down. Every route below is expected to answer JSON, but a
// mutation under test can make one throw and answer a 500 with a non-JSON body — and a bare
// `.json()` then dies inside the module, which reads as "the suite crashed" rather than as the
// named check that was actually violated. A probe that could not run must fail as ITSELF.
const bodyOf = async <T>(res: Response): Promise<T & { error?: string }> => {
  const text = await res.text();
  try { return JSON.parse(text) as T & { error?: string }; }
  catch { return { error: `non-JSON answer (HTTP ${res.status}): ${text.slice(0, 160)}` } as T & { error?: string }; }
};

const git = (cwd: string, ...args: string[]): string =>
  spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).stdout?.toString().trim() ?? "";

// the lane's own scoped credential, read out of the persisted state. `openSlot` mints it and queues
// saveState BEFORE it awaits the pane spawn, so the route can answer a hair before the file carries
// it — poll for the shape, and a timeout still returns the last value read so a genuine absence
// fails its own check instead of hiding in a retry.
async function selfTokenOf(slot: number): Promise<string> {
  let seen = "";
  for (let i = 0; i < 60; i++) {
    try {
      seen = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
        { slots?: Record<string, { selfToken?: string }> }).slots?.[String(slot)]?.selfToken ?? "";
    } catch { /* mid-write */ }
    if (/^[0-9a-f]{32}$/.test(seen)) return seen;
    await Bun.sleep(50);
  }
  return seen;
}

export async function run(): Promise<void> {
  if (!REPO) return; // the runner only calls this inside its REPO block, but say so rather than throw

  // the portal's own credential, read once through the OWNER route — the only place it is handed out
  const helperToken = (await bodyOf<{ token?: string }>(await get("/api/helper/token"))).token ?? "";
  const HH = { "x-fleet-helper-token": helperToken };
  const hget = (path: string): Promise<Response> => fetch(BASE + path, { headers: HH });
  const hpost = (path: string, body: unknown): Promise<Response> =>
    post(path, body, { ...HH, "content-type": "application/json" });
  const jobs = async (): Promise<HelperJob[]> =>
    (await bodyOf<HelperJobs>(await hget(`/api/helper/jobs?deviceId=${DEVICE}`))).jobs ?? [];

  const selfPost = (path: string, token: string | undefined, body: unknown = {}): Promise<Response> =>
    fetch(BASE + path, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token !== undefined ? { "x-fleet-self-token": token } : {}) },
      body: JSON.stringify(body),
    });
  const selfGet = (path: string, token: string): Promise<Response> =>
    fetch(BASE + path, { headers: { "x-fleet-self-token": token } });
  const offerOf = async (token: string): Promise<OfferPayload> =>
    await bodyOf<OfferPayload>(await selfGet("/api/self/suite-offer", token));

  // the audit ledger, counted in LINES. The main runner boots with no FLEET_POSTLAND_AUDIT_CMD, so
  // the file is typically absent — absent is 0 rows, which is exactly the quantity (LS.5) compares.
  const auditLines = (): number => {
    try { return readFileSync(`${ROOT}/post-land-audits.jsonl`, "utf8").split("\n").filter(Boolean).length; }
    catch { return 0; }
  };

  const ln: Lane = await openLane(REPO, "suiteoffer");
  const laneTok = await selfTokenOf(ln.slot);
  check("(LS) setup: the offering lane carries its own scoped credential",
    /^[0-9a-f]{32}$/.test(laneTok), `slot=${ln.slot} tok=${laneTok.slice(0, 8)}…`);
  // THE FIXTURE THE WHOLE MODULE TURNS ON: work the lane has NOT committed, plus an untracked file.
  // Nothing else in this suite hands a dirty tree to anything.
  const DIRTY = "the uncommitted line the helper must see";
  await Bun.write(`${ln.cwd}/suiteoffer.txt`, `suiteoffer work\n${DIRTY}\n`);
  await Bun.write(`${ln.cwd}/scratch-untracked.txt`, "never travels\n");
  check("(LS) setup: the lane's tree is dirty and carries one untracked file",
    git(ln.cwd, "status", "--porcelain").split("\n").filter(Boolean).length === 2,
    JSON.stringify(git(ln.cwd, "status", "--porcelain")));

  // ===== (LS.1) THE OFFER DOOR — the fifth lane-only route ======================================
  // The two scope rules of the /api/self family run in OPPOSITE directions, so which one a new
  // route joins is a decision, not a default. This one is lane-only: its answer is about a lane's
  // own working tree. A recognized non-lane credential must therefore get 409 and never 401 —
  // 401 would send a session hunting for a token it already holds.
  const sess = await bodyOf<{ slots: { id: number; cwd: string | null }[] }>(await get("/api/sessions"));
  const freeSlot = sess.slots.find((s) => !s.cwd)?.id ?? 0;
  check("(LS) setup: a free slot is available to stand in as a PLAIN (non-lane) session",
    freeSlot > 0, JSON.stringify(sess.slots.map((s) => s.id + (s.cwd ? "*" : ""))));
  await post(`/api/slots/${freeSlot}/open`, { cwd: "~" });
  const plainTok = await selfTokenOf(freeSlot);
  const plainOffer = await selfPost("/api/self/suite-offer", plainTok);
  const plainBody = await bodyOf<OfferPayload>(plainOffer);
  check("(LS) a PLAIN session's credential is refused 409 'not a lane' — never 401",
    plainOffer.status === 409 && (plainBody.error ?? "").includes("not a lane"),
    `${plainOffer.status} ${JSON.stringify(plainBody)}`);
  check("(LS) an unknown self token is refused 401, and a missing one too",
    (await selfPost("/api/self/suite-offer", "0".repeat(32))).status === 401
      && (await selfPost("/api/self/suite-offer", undefined)).status === 401);
  await post(`/api/slots/${freeSlot}/kill`, {});

  const offer1Res = await selfPost("/api/self/suite-offer", laneTok);
  const offer1 = await bodyOf<OfferPayload>(offer1Res);
  check("(LS) the lane offers its preview suite and gets an open job back",
    offer1Res.ok && /^[0-9a-f]{12}$/.test(offer1.offer?.id ?? "") && offer1.offer?.state === "open"
      && offer1.offer.branch === ln.branch && offer1.existing === false,
    `${offer1Res.status} ${JSON.stringify(offer1.offer)}`);
  const jobId = offer1.offer?.id ?? "";
  const offer2 = await bodyOf<OfferPayload>(await selfPost("/api/self/suite-offer", laneTok));
  check("(LS) a second offer returns the SAME job rather than minting a rival",
    offer2.existing === true && offer2.offer?.id === jobId, JSON.stringify(offer2).slice(0, 200));
  const read1 = await offerOf(laneTok);
  check("(LS) the lane reads its own offer back, with the waiting policy and the suite lock",
    read1.offer?.id === jobId && read1.waitPolicy?.freeMs === 180000 && read1.waitPolicy.heldMs === 800000
      && "suiteLock" in read1,
    JSON.stringify({ id: read1.offer?.id, wait: read1.waitPolicy }));

  // ===== (LS.2) ONE JOB LIST, TWO SOURCES =======================================================
  // The portal listed the audit queue and nothing else — `helperJobsView` had a single loop over
  // `auditQueue`, which is precisely why the owner's lane-suite run "tauchte nicht auf". The job
  // below reaches the same list through the second source, and `kind` is the whole difference the
  // other machine sees. (The audit side's `kind:"audit"` is asserted in e2e/helper-portal.ts, where
  // an audit job can exist at all.)
  const listed = (await jobs()).find((j) => j.id === jobId);
  check("(LS) THE OFFER IS IN THE PORTAL'S JOB LIST, marked kind:'lane-suite'",
    listed?.kind === "lane-suite" && listed.main === ln.branch && listed.claim === null,
    JSON.stringify(listed));
  check("(LS) …and it covers no land and claims no local run — a preview is neither",
    listed?.covers === 0 && listed.localRunning === false && listed.branches.join(",") === ln.branch,
    JSON.stringify({ covers: listed?.covers, localRunning: listed?.localRunning, branches: listed?.branches }));

  await hpost("/api/helper/device", { deviceId: DEVICE, name: DEVICE_NAME });

  // ===== (LS.3) THE TREE THAT LEAVES IS THE WORKING TREE ========================================
  // Measured before it was built (design doc §3.1): `git stash create` writes a commit object and
  // LEAVES THE STASH STACK ALONE, which is the only reason it may be used here at all — CLAUDE.md
  // forbids bare `git stash`/`pop` because the stack is shared between the main checkout and every
  // worktree. All three halves are asserted: the uncommitted work travels, the stack is untouched,
  // and the transient ref the bundle needed is gone again.
  const stashBefore = git(ln.cwd, "stash", "list").split("\n").filter(Boolean).length;
  const claimRes = await hpost("/api/helper/claim", { jobId, deviceId: DEVICE });
  const claim = await bodyOf<{ job?: ClaimedJob }>(claimRes);
  check("(LS) the claim names the commit it took, its TREE, the clone branch and the untracked count",
    claimRes.ok && claim.job?.kind === "lane-suite" && /^[0-9a-f]{40}$/.test(claim.job.mainSha)
      && /^[0-9a-f]{40}$/.test(claim.job.treeSha ?? "") && claim.job.branch === `fleet-suite/${jobId}`
      && claim.job.untracked === 1 && claim.job.name === DEVICE_NAME,
    `${claimRes.status} ${JSON.stringify(claim).slice(0, 300)}`);
  check("(LS) claiming an already-claimed preview is a 409 — even for the device that holds it",
    (await hpost("/api/helper/claim", { jobId, deviceId: DEVICE })).status === 409);
  const stashAfter = git(ln.cwd, "stash", "list").split("\n").filter(Boolean).length;
  check("(LS) THE STASH STACK IS UNTOUCHED — it is shared with the main checkout and every worktree",
    stashAfter === stashBefore, `before=${stashBefore} after=${stashAfter}`);
  check("(LS) the transient bundle ref is deleted again — no stray branch in the shared git dir",
    !git(ln.cwd, "show-ref").includes("fleet-suite"),
    git(ln.cwd, "show-ref").split("\n").filter((l) => l.includes("fleet-suite")).join(" | ") || "none");

  const bundleRes = await hget(`/api/helper/bundle/${jobId}`);
  const bytes = new Uint8Array(await bundleRes.arrayBuffer());
  const bundlePath = `${REPO}-lanesuite.bundle`;
  const clonePath = `${REPO}-lanesuite-clone`;
  await Bun.write(bundlePath, bytes);
  spawnSync("rm", ["-rf", clonePath]);
  // `-b` is not cosmetic: a bundle whose only ref is not HEAD clones WITHOUT A WORKING TREE and
  // says nothing about why (design doc M6). The branch name comes from the claim, never rebuilt here.
  const cloned = spawnSync("git", ["clone", "-q", "-b", claim.job?.branch ?? "", bundlePath, clonePath]);
  const clonedFile = ((): string => {
    try { return readFileSync(`${clonePath}/suiteoffer.txt`, "utf8"); } catch { return ""; }
  })();
  check("(LS) the bundle downloads and `git clone -b` produces a real working tree",
    bundleRes.ok && bytes.length > 0 && cloned.status === 0 && clonedFile !== "",
    `status=${bundleRes.status} bytes=${bytes.length} clone=${cloned.status} err=${cloned.stderr?.toString().trim().slice(0, 160)}`);
  check("(LS) THE UNCOMMITTED WORK TRAVELLED — the helper's tree carries what the lane never committed",
    clonedFile.includes(DIRTY),
    `file=${JSON.stringify(clonedFile.slice(0, 120))} head=${spawnSync("git", ["-C", clonePath, "log", "--oneline", "-1"]).stdout?.toString().trim()}`);
  check("(LS) …and the clone's tree is EXACTLY the tree the claim named (content-addressed, so it cannot drift)",
    git(clonePath, "rev-parse", "HEAD^{tree}") === claim.job?.treeSha,
    `clone=${git(clonePath, "rev-parse", "HEAD^{tree}")} claim=${claim.job?.treeSha}`);
  const untrackedInClone = existsSync(`${clonePath}/scratch-untracked.txt`);
  check("(LS) untracked files did NOT travel, and the job says how many stayed behind",
    !untrackedInClone && (await jobs()).find((j) => j.id === jobId)?.untracked === 1,
    `present=${untrackedInClone} untracked=${(await jobs()).find((j) => j.id === jobId)?.untracked}`);

  // ===== (LS.4) THE VERDICT NEVER TOUCHES THE AUDIT LEDGER ======================================
  // `post-land-audits.jsonl` answers joins over `mainSha`/`covers[].mainAfter`. A preview row has
  // neither — it would not FAIL those joins, it would answer them wrong. The positive control (an
  // audit report DOES add exactly one row) is in e2e/helper-portal.ts, where audit jobs exist.
  const ledgerBefore = auditLines();
  const TRAIL = "isolated-20260826T1200Z-9191";
  const resultRes = await hpost("/api/helper/result", {
    jobId, exitCode: 0, trail: TRAIL,
    tail: "PASS  a remote check\nPASS  another remote check\nALL PASS",
  });
  const resultBody = await bodyOf<{ kind?: string; result?: string }>(resultRes);
  check("(LS) the preview verdict is accepted and answers as its own kind",
    resultRes.ok && resultBody.kind === "lane-suite" && resultBody.result === "green",
    `${resultRes.status} ${JSON.stringify(resultBody)}`);
  check("(LS) THE AUDIT LEDGER DID NOT MOVE — a preview is not a post-land audit row",
    auditLines() === ledgerBefore, `before=${ledgerBefore} after=${auditLines()}`);
  check("(LS) reporting released the job from the portal's list",
    !(await jobs()).some((j) => j.id === jobId), JSON.stringify((await jobs()).map((j) => `${j.kind}:${j.id}`)));

  // ===== (LS.5) THE RETURN PATH, WITH ITS PROVENANCE ============================================
  // The exit code and the tail were TYPED IN by a human on another machine (src/helper.ts#doReport
  // validates only /^-?\d+$/). A verdict served without the device name and the timestamps is the
  // one sentence a lane report may never write — "./e2e-isolated.sh green", full stop.
  const reported = await offerOf(laneTok);
  const verdict = reported.offer?.result;
  check("(LS) the lane reads its verdict back: state, exit code, checks and the trail id",
    reported.offer?.state === "reported" && verdict?.result === "green" && verdict.exitCode === 0
      && verdict.checks?.ran === 2 && verdict.checks.failed === 0 && verdict.trail === TRAIL,
    JSON.stringify({ state: reported.offer?.state, r: verdict?.result, e: verdict?.exitCode, c: verdict?.checks, t: verdict?.trail }));
  check("(LS) …MARKED REMOTE: the device name and both timestamps travel with the number",
    verdict?.remote?.name === DEVICE_NAME && verdict.remote.claimedAt === claim.job?.claimedAt
      && verdict.remote.reportedAt >= verdict.remote.claimedAt,
    JSON.stringify(verdict?.remote));
  // …and the question the tree sha exists to answer: has MY tree moved since I gave it away? The
  // commit sha wanders with the clock even on identical content (design doc M8); the tree sha does
  // not, so the lane recomputes it the same way the server took it.
  const freshCommit = git(ln.cwd, "stash", "create");
  const freshTree = git(ln.cwd, "rev-parse", `${freshCommit}^{tree}`);
  check("(LS) the verdict names the TREE it is about, and the lane can re-derive it from its own tree",
    verdict?.treeSha === claim.job?.treeSha && freshTree === verdict?.treeSha && /^[0-9a-f]{40}$/.test(freshTree),
    `verdict=${verdict?.treeSha?.slice(0, 8)} claim=${claim.job?.treeSha?.slice(0, 8)} fresh=${freshTree.slice(0, 8)} `
    + `(commit re-derived ${freshCommit.slice(0, 8)} vs claimed ${claim.job?.mainSha.slice(0, 8)} — the commit sha `
    + `carries a whole-second timestamp and may or may not differ; only the tree sha is asserted)`);

  // ===== (LS.6) THE MUTEX: withdrawing is what gives the suite back ==============================
  // "I run it locally" must be a transition the server witnessed, not an intention in a pane —
  // otherwise nothing stops the tree being measured twice, which is the invariant the whole portal
  // exists for. So: withdraw returns 200 and that 200 is the permission; afterwards the job is
  // simply not there to claim.
  const offer3 = await bodyOf<OfferPayload>(await selfPost("/api/self/suite-offer", laneTok));
  const job3 = offer3.offer?.id ?? "";
  check("(LS) a settled offer does not block a new one — the lane may offer the next tree",
    offer3.existing === false && job3 !== jobId, JSON.stringify(offer3.offer).slice(0, 160));
  const wd = await selfPost("/api/self/suite-offer/withdraw", laneTok);
  const wdBody = await bodyOf<OfferPayload>(wd);
  check("(LS) withdrawing an OPEN offer succeeds, and that 200 is the permission to run locally",
    wd.ok && wdBody.mayRunLocally === true && wdBody.offer?.state === "withdrawn",
    `${wd.status} ${JSON.stringify(wdBody.offer)}`);
  const claimWithdrawn = await hpost("/api/helper/claim", { jobId: job3, deviceId: DEVICE });
  check("(LS) A WITHDRAWN OFFER CANNOT BE CLAIMED — 404, and it is off the list",
    claimWithdrawn.status === 404 && !(await jobs()).some((j) => j.id === job3),
    `${claimWithdrawn.status} ${JSON.stringify(await bodyOf(claimWithdrawn))}`);
  check("(LS) withdrawing when there is no open offer is a 404, not a silent ok",
    (await selfPost("/api/self/suite-offer/withdraw", laneTok)).status === 404);

  // …and the other direction: while a machine really is running it, withdrawing is REFUSED, because
  // a 200 there would authorize the second run. Abandoning is the deliberate override (design doc
  // §5.3): a lane must be able to stop waiting on a helper that took the job and went quiet.
  const offer4 = await bodyOf<OfferPayload>(await selfPost("/api/self/suite-offer", laneTok));
  const job4 = offer4.offer?.id ?? "";
  const claim4 = await hpost("/api/helper/claim", { jobId: job4, deviceId: DEVICE });
  check("(LS) setup: the fourth offer is claimed", claim4.ok, `${claim4.status}`);
  const wdHeld = await selfPost("/api/self/suite-offer/withdraw", laneTok);
  const wdHeldBody = await bodyOf<OfferPayload>(wdHeld);
  check("(LS) withdrawing a CLAIMED offer is refused — a 200 here would authorize a second run",
    wdHeld.status === 409 && (wdHeldBody.error ?? "").includes(DEVICE_NAME),
    `${wdHeld.status} ${JSON.stringify(wdHeldBody).slice(0, 200)}`);
  const wdAbandon = await selfPost("/api/self/suite-offer/withdraw", laneTok, { abandon: true });
  const wdAbandonBody = await bodyOf<OfferPayload>(wdAbandon);
  check("(LS) …and abandoning it deliberately succeeds, so a silent helper cannot deadlock the lane",
    wdAbandon.ok && wdAbandonBody.offer?.state === "abandoned" && wdAbandonBody.mayRunLocally === true,
    `${wdAbandon.status} ${JSON.stringify(wdAbandonBody.offer)}`);
  const lateResult = await hpost("/api/helper/result", { jobId: job4, exitCode: 0, tail: "ALL PASS" });
  check("(LS) a verdict arriving after the lane abandoned the job is refused — the lane owns the tree again",
    lateResult.status === 409, `${lateResult.status} ${JSON.stringify(await bodyOf(lateResult))}`);

  // ===== (LS.7) THE LANE DISAPPEARS =============================================================
  // There is no drain behind a preview: its only interested party is one lane, and that lane can
  // land or be killed while the offer sits open. Identity is slot + openedAt, never the bare slot id.
  const gone: Lane = await openLane(REPO, "suitegone");
  const goneTok = await selfTokenOf(gone.slot);
  const goneOffer = await bodyOf<OfferPayload>(await selfPost("/api/self/suite-offer", goneTok));
  const goneId = goneOffer.offer?.id ?? "";
  check("(LS) setup: a second lane offers its preview too",
    /^[0-9a-f]{12}$/.test(goneId), JSON.stringify(goneOffer.offer).slice(0, 160));
  await post(`/api/slots/${gone.slot}/kill`, {});
  for (let i = 0; i < 60; i++) {
    const sx = await bodyOf<{ slots: { id: number; cwd: string | null }[] }>(await get("/api/sessions"));
    if (!sx.slots.find((x) => x.id === gone.slot)?.cwd) break;
    await Bun.sleep(100);
  }
  const claimGone = await hpost("/api/helper/claim", { jobId: goneId, deviceId: DEVICE });
  const goneErr = (await bodyOf(claimGone)).error ?? "";
  // TWO refusals are correct here and which one is observed is a race with the 15 s lapse sweep:
  // 404 if the sweep already reaped the offer, 409 if the claim got there first and the liveness
  // check refused it. What is NOT negotiable is the SENTENCE — an offer whose lane was killed must
  // not be described as one the lane withdrew, which is what a shared terminal state made it say
  // on this module's first run.
  check("(LS) an offer whose LANE IS GONE is refused and reaped — nobody spends 13 min on it",
    (claimGone.status === 404 || claimGone.status === 409) && goneErr.includes("is gone")
      && !(await jobs()).some((j) => j.id === goneId),
    `${claimGone.status} ${JSON.stringify(goneErr)}`);

  // cleanup: the offering lane's slot, and the scratch clone
  await post(`/api/slots/${ln.slot}/kill`, {});
  spawnSync("rm", ["-rf", clonePath]);
  spawnSync("rm", ["-f", bundlePath]);
}
