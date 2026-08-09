// Drops: POST /api/slots/:id/upload — the route that puts a file the OWNER handed over (drag&drop,
// paste, 📎) into a session's own working directory.
//
// Three properties, and the third is the one this feature could most easily have shipped without.
// Auth and the size cap are the obvious perimeter. The third is LANDABILITY, and it is the whole
// reason the route has a gate at all: the bytes land INSIDE the lane's worktree (owner decision
// 2026-08-06, "lane-lokal koennte sogar reichen"), and an untracked file in a worktree blocks the
// land. That failure is silent and late — the upload succeeds, the agent works, and the land
// refuses an hour later over a screenshot. So the route asks git whether the file would be ignored
// and refuses when it would not, and BOTH sides of that gate are asserted here against a real
// lane: refused while the repo ignores nothing, accepted once it does, and `git status --porcelain`
// still empty afterwards. The teardown check closes the loop the refusal buys — `git worktree
// remove` takes the drops with it, WITHOUT --force, which is exactly what the negative control
// proves is impossible when the ignore rule is missing.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { BASE, REPO, TOKEN, check, post } from "./harness";

const SLOT = 10; // free: the rest of the suite drives 1,2,3,5,6,7,9
const BRANCH = "e2e-drop";
const CAP = 20 * 1024 * 1024; // server.ts, UPLOAD_CAP

interface UploadRes { ok?: boolean; path?: string; name?: string; size?: number; mention?: string; error?: string }

// deliberately NOT harness.post: that one sends application/json, and a multipart body must let
// the runtime write its own boundary. Auth is the same owner bearer.
function upload(slot: number, name: string, bytes: BlobPart,
  headers: Record<string, string> = { authorization: `Bearer ${TOKEN}` }): Promise<Response> {
  const fd = new FormData();
  fd.append("file", new File([bytes], name));
  return fetch(`${BASE}/api/slots/${slot}/upload`, { method: "POST", headers, body: fd });
}
// never null, never a throw: a probe that could not read the answer must fail as ITSELF (an empty
// object fails the check that reads it), not blow up the module and take every later check with it
const asJson = async (r: Response): Promise<UploadRes> =>
  ((await r.json().catch(() => null)) as UploadRes | null) ?? {};
const statusOf = (dir: string): string =>
  spawnSync("git", ["-C", dir, "status", "--porcelain"], { encoding: "utf8" }).stdout;

export async function run(): Promise<void> {
  // --- the perimeter, before any fixture exists: neither of these needs a slot ---------------
  check("upload is refused without a token", (await upload(SLOT, "x.txt", "x", {})).status === 401);
  check("upload is refused with a wrong token",
    (await upload(SLOT, "x.txt", "x", { authorization: "Bearer wrong" })).status === 401);
  // slot 16 is never opened by this suite — the route must not reach a filesystem for a dead slot
  check("upload refuses an inactive slot", (await upload(16, "x.txt", "x")).status === 400);

  const wt = `${REPO}.worktrees/${BRANCH}`;
  const opened = await post(`/api/slots/${SLOT}/open-worktree`, { repo: REPO, branch: BRANCH });
  check("drops: lane opened for the upload checks", opened.ok && existsSync(wt), String(opened.status));
  if (!existsSync(wt)) return; // every check below asserts something about this tree
  // the route resolves the slot's cwd through realpath before it builds a target (that IS the
  // containment), so on this machine every path it returns carries the /private prefix that REPO
  // does not. Comparing against the unresolved path measures the symlink, not the route.
  const wtReal = realpathSync(wt);

  // --- the landability gate, refusing half. The throwaway repo ignores .env and nothing else, so
  // this is the state every repo is in before someone adds the rule. ---------------------------
  const refused = await upload(SLOT, "shot.png", "PNG");
  const refusedJson = await asJson(refused);
  check("upload is REFUSED in a repo that does not ignore drops/ (409, not a silently unlandable lane)",
    refused.status === 409 && (refusedJson.error ?? "").includes("drops/"),
    `${refused.status} ${refusedJson.error ?? ""}`);
  check("…and the refusal wrote nothing at all — no directory, no file",
    !existsSync(`${wt}/drops`), `${wt}/drops`);

  // the rule the refusal asked for, committed IN THE LANE so the tree it protects stays clean
  const ignore = `${wt}/.gitignore`;
  let ignoreBefore: string | null = "";
  let ignoreError = "";
  try { if (existsSync(ignore)) ignoreBefore = readFileSync(ignore, "utf8"); }
  catch (e) { ignoreBefore = null; ignoreError = e instanceof Error ? e.message : String(e); }
  check("drops fixture precondition: an existing .gitignore is readable before mutation",
    ignoreBefore !== null, ignoreError);
  if (ignoreBefore === null) {
    await post(`/api/slots/${SLOT}/kill`, {});
    spawnSync("git", ["worktree", "remove", "--force", wt], { cwd: REPO });
    spawnSync("git", ["-C", REPO, "branch", "-D", BRANCH]);
    return;
  }
  await Bun.write(ignore, `${ignoreBefore}drops/\n`);
  spawnSync("git", ["-C", wt, "commit", "-aqm", "ignore drops/"]);
  check("drops: fixture — the lane is clean again after committing the ignore rule",
    statusOf(wt) === "", JSON.stringify(statusOf(wt)));

  // --- the accepting half, and the property the whole design turns on -------------------------
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const okRes = await upload(SLOT, "screen shot.png", png);
  const ok = await asJson(okRes);
  check("upload accepted once the repo ignores drops/", okRes.status === 200 && !!ok.path, `${okRes.status} ${ok.error ?? ""}`);
  check("the bytes on disk are exactly the bytes sent",
    !!ok.path && existsSync(ok.path) && Buffer.compare(readFileSync(ok.path), Buffer.from(png)) === 0,
    ok.path ?? "(no path)");
  check("THE POINT: an upload leaves the lane landable — git status --porcelain is still empty",
    statusOf(wt) === "", JSON.stringify(statusOf(wt)));
  check("the drop lands under the lane's own drops/, with a timestamped, rebuilt name",
    /^drops\/\d{13}-screen_shot\.png$/.test((ok.path ?? "").slice(wtReal.length + 1)), ok.path ?? "");
  check("the answer carries the mention the composer inserts, naming the absolute path",
    ok.mention === `attached: ${ok.path} — read it`, ok.mention ?? "(none)");

  // --- the filename is REBUILT, not validated: a traversal in it cannot leave drops/ ----------
  const evil = await asJson(await upload(SLOT, "../../../../etc/passwd", "x"));
  check("a path-traversal filename is rebuilt into a plain name inside drops/",
    /^drops\/\d{13}-passwd$/.test((evil.path ?? "").slice(wtReal.length + 1)), evil.path ?? "(refused)");

  // --- the cap, both checks. Same 413, deliberately told apart by their MESSAGES: one rejects on
  // the declared content-length before buffering, the other on the decoded part's real size. A
  // status-only assertion could not tell whether the second one exists at all. -----------------
  const over = await asJson(await upload(SLOT, "huge.bin", new Uint8Array(CAP + 1024 * 1024)));
  check("a body far over the cap is refused on its declared length, before it is buffered",
    (over.error ?? "").startsWith("too large"), over.error ?? "(accepted)");
  const edge = await upload(SLOT, "edge.bin", new Uint8Array(CAP + 32 * 1024));
  const edgeJson = await asJson(edge);
  check("a file that slips past the length pre-check is still refused on its actual size",
    edge.status === 413 && (edgeJson.error ?? "").includes("over the 20 MB upload cap"),
    `${edge.status} ${edgeJson.error ?? ""}`);
  check("nothing over the cap reached the disk (the lane is still clean and drops/ holds only the two accepted files)",
    statusOf(wt) === "" && !existsSync(`${wt}/drops/huge.bin`) && !existsSync(`${wt}/drops/edge.bin`));
  check("an empty file is refused", (await upload(SLOT, "empty.txt", "")).status === 400);
  // REGRESSION PIN, and it caught a real defect the first time this module ran. The size pre-check
  // answers 413 while the client is still sending, and an unconsumed request body leaves the next
  // request on that connection hanging FOREVER — not failing, hanging. The route drains the body
  // for exactly this reason (server.ts, drainBody); without it this check times out rather than
  // failing, which is itself the signature. It must come after an over-cap upload to mean anything.
  const afterOver = await upload(SLOT, "after-refusal.txt", "still serving");
  check("a valid upload still works right after an over-cap one (the refusal drains the body it rejected)",
    afterOver.status === 200, String(afterOver.status));

  // --- retention, which is the whole reason the bytes live in the worktree: they die with it,
  // and the removal needs no --force. That is the same command the negative control above made
  // impossible, so this pair IS the argument for the gate. ------------------------------------
  const drop = ok.path ?? "";
  await post(`/api/slots/${SLOT}/kill`, {});
  const rm = spawnSync("git", ["worktree", "remove", wt], { cwd: REPO, encoding: "utf8" });
  check("the lane's worktree removes cleanly with drops in it — no --force needed",
    rm.status === 0, (rm.stderr || "").trim().slice(0, 120));
  check("…and the drops died with the worktree (no sweep, no delete-by-slot-number, no store to leak)",
    !existsSync(drop) && !existsSync(`${wt}/drops`), drop);
  spawnSync("git", ["-C", REPO, "branch", "-D", BRANCH]);
}
