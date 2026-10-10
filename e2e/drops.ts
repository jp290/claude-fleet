// Drops: POST /api/slots/:id/upload — the route that puts a file the OWNER handed over (drag&drop,
// paste, 📎) into a session's own working directory.
//
// Three properties, and the third is the one this feature could most easily have shipped without.
// Auth and the size cap are the obvious perimeter. The third is LANDABILITY, and it is the whole
// reason the route has a gate at all: the bytes land INSIDE the lane's worktree (owner decision
// 2026-08-06, „[Zitat entfernt]“), and an untracked file in a worktree blocks the
// land. That failure is silent and late — the upload succeeds, the agent works, and the land
// refuses an hour later over a screenshot. So the route asks git whether the file would be ignored
// and refuses when it would not, and BOTH sides of that gate are asserted here against a real
// lane: refused while the repo ignores nothing, accepted once it does, and `git status --porcelain`
// still empty afterwards. The teardown check closes the loop the refusal buys — `git worktree
// remove` takes the drops with it, WITHOUT --force, which is exactly what the negative control
// proves is impossible when the ignore rule is missing.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";
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

// the READ side (GET /api/slots/:id/drop): what the chat bubble asks for, with whose credential
const readDrop = (slot: number, path: string, headers: Record<string, string> = { authorization: `Bearer ${TOKEN}` }): Promise<Response> =>
  fetch(`${BASE}/api/slots/${slot}/drop?path=${encodeURIComponent(path)}`, { headers });

export async function run(): Promise<void> {
  // the chat view's pictures in a real browser (runDropChatDom below) run in e2e/dom.ts

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

  // --- the READ side: the chat bubble's picture. Exactly this slot's own drop, as the bytes they
  // are; every other spelling refused before a byte is read (card 7d9c5394) -------------------
  const own = await readDrop(SLOT, ok.path ?? "");
  const ownBytes = new Uint8Array(await own.arrayBuffer());
  check("the slot's own PNG drop reads back as image/png, byte-identical, with nosniff",
    own.status === 200 && own.headers.get("content-type") === "image/png" && own.headers.get("x-content-type-options") === "nosniff"
    && Buffer.compare(Buffer.from(ownBytes), Buffer.from(png)) === 0, `${own.status} ${own.headers.get("content-type")}`);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const jpg = await asJson(await upload(SLOT, "foto.jpg", jpeg));
  const jpgRead = await readDrop(SLOT, jpg.path ?? "");
  check("a JPEG drop reads back as image/jpeg", jpgRead.status === 200 && jpgRead.headers.get("content-type") === "image/jpeg",
    `${jpgRead.status} ${jpgRead.headers.get("content-type")}`);
  // the bytes decide, never the name: HTML renamed to .png (and an SVG) is not served as anything
  const fake = await asJson(await upload(SLOT, "fake.png", "<html><script>alert(1)</script></html>"));
  const svg = await asJson(await upload(SLOT, "bild.svg", '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'));
  const fakeRead = await readDrop(SLOT, fake.path ?? ""), svgRead = await readDrop(SLOT, svg.path ?? "");
  check("a drop whose bytes are not a raster is refused 415 — a renamed HTML and an SVG alike, never their bytes",
    fakeRead.status === 415 && svgRead.status === 415 && !(fakeRead.headers.get("content-type") ?? "").startsWith("image/")
    && !(svgRead.headers.get("content-type") ?? "").startsWith("image/"), `${fakeRead.status} ${svgRead.status}`);
  const name = (ok.path ?? "").slice((ok.path ?? "").lastIndexOf("/") + 1);
  const refusals: [string, string, number][] = [
    ["a missing drop", `${wtReal}/drops/1790787700000-weg.png`, 404],
    ["a traversal that ends in the drop's own name", `${wtReal}/drops/../drops/${name}`, 404],
    ["a traversal to /etc/passwd", `${wtReal}/drops/../../../../etc/passwd`, 400],
    ["the same name under another directory", `/tmp/drops/${name}`, 404],
    ["a relative path", `drops/${name}`, 400],
    ["a name the upload route never builds", `${wtReal}/drops/passwd`, 400],
  ];
  for (const [what, path, want] of refusals) {
    const r = await readDrop(SLOT, path);
    check(`the drop route refuses ${what} (${want})`, r.status === want, `${r.status} ${path}`);
  }
  // a symlink planted in drops/ resolves elsewhere: not followed, even though its name is drop-shaped
  const link = `${wtReal}/drops/1790787700001-link.png`;
  let planted = false;
  try { symlinkSync(ok.path ?? "/etc/hosts", link); planted = true; } catch { planted = false; }
  check("the drop route refuses a symlink planted in drops/ (404)", planted && (await readDrop(SLOT, link)).status === 404, link);
  if (planted) rmSync(link, { force: true });
  check("the drop route refuses without a token (401)", (await readDrop(SLOT, ok.path ?? "", {})).status === 401);
  check("the drop route refuses an inactive slot (400)", (await readDrop(16, ok.path ?? "")).status === 400);
  // a SHARE GUEST of this very slot: the share cookie is no owner credential, and the drop route has
  // no share twin — the owner reads the bytes, the guest gets a refusal and never an image
  const share = await post(`/api/slots/${SLOT}/share`, { mode: "view", password: "droppass123" });
  const shareJ = (await share.json().catch(() => ({}))) as { id?: string };
  const auth = await post(`/s/${shareJ.id ?? "none"}/auth`, { password: "droppass123" });
  const cookie = (auth.headers.get("set-cookie") ?? "").split(";")[0];
  check("drops: share fixture — a guest of the drop's own slot is authenticated", share.ok && auth.ok && cookie.startsWith("share_"), cookie.slice(0, 12));
  const guest = await readDrop(SLOT, ok.path ?? "", { cookie });
  const guestTwin = await fetch(`${BASE}/s/${shareJ.id ?? "none"}/drop?path=${encodeURIComponent(ok.path ?? "")}`, { headers: { cookie } });
  check("a share guest gets NO private image bytes: 401 on the drop route, no image on a /s/ twin",
    guest.status === 401 && !(guest.headers.get("content-type") ?? "").startsWith("image/")
    && guestTwin.status !== 200 && !(guestTwin.headers.get("content-type") ?? "").startsWith("image/"),
    `${guest.status} ${guestTwin.status}`);

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

// A SENT DROP IN THE CHAT VIEW, measured in a real browser on the real client bundle (card 7d9c5394,
// owner 2026-09-30: „[Zitat entfernt]“). Same rig as the bundle
// chat probe in e2e/slots.ts: the fixture origin serves the tree's index.html and client bundle,
// the transcript, the upload answer and the drop bytes — a real PNG and a real JPEG, never a live
// drop. Every mention line is built from server.ts#dropMention's own template, so the client's
// reading of it cannot drift from what the server writes. Exported so a lane can drive it with an
// artefact folder (screenshots) and against an older tree (the "before" picture).
export interface DropChatDomResult { width: number; height: number; claims: Record<string, boolean>; facts: Record<string, unknown> }
const FIXTURE_JPEG = "/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAYKADAAQAAAABAAAAQAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAQABgAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMACQkJCQkJEAkJEBYQEBAWHhYWFhYeJh4eHh4eJi4mJiYmJiYuLi4uLi4uLjc3Nzc3N0BAQEBASEhISEhISEhISP/bAEMBCwwMEhESHxERH0szKjNLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS//dAAQABv/aAAwDAQACEQMRAD8A58CngUoFPAr6ibPKgxAKkApQKeBXLNnbBiAVIBQBUgFcs2dkGIBUgFAFSAVzTZ2wYgFPApQKkArlmzsgxAKeBSgU8CuWbO2DP//QxwKeBSgU8CvpJs8WDACngUoFPArlmztgwAp4FKBTwK5ps7IMQCpAKUCngVyzZ2wYgFSAUAVIBXLNnbBiAVIBQBUgFcs2dkGf/9HPAqQCgCpAK+gmzwIMQCngUoFSAVyzZ2wYgFPApQKeBXNNnZBgBTwKUCngVyzZ2wYAU8ClAp4Fcs2dsGAFPApQKeBXNNnZBn//0q4FSAUoFPAr3Js+cgxAKkApQKeBXNNnZBiAVIBQBUgFcs2dsGIBTwKUCpAK5Zs7IMQCngUoFSAVyzZ2wYgFPApQKeBXNNnZBn//2Q==";
// a 96 × 64 RGB gradient as a real PNG: stored zlib rows, CRC per chunk
function fixturePng(): Uint8Array {
  const W = 96, H = 64, row = W * 3 + 1;
  const raw = Buffer.alloc(row * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = y * row + 1 + x * 3;
    raw[o] = 40 + x * 2; raw[o + 1] = 90 + y; raw[o + 2] = 200 - x;
  }
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(Bun.hash.crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}
export async function runDropChatDom(sourceRoot: string, artifacts?: string): Promise<DropChatDomResult[]> {
  const serverSrc = readFileSync(resolve(sourceRoot, "server.ts"), "utf8");
  const template = /const dropMention = \(path: string\): string => `([^`]*)`;/.exec(serverSrc)?.[1];
  if (!template?.includes("${path}")) throw new Error("drop chat DOM probe: server.ts#dropMention has no template to build the fixture lines from");
  const mention = (path: string): string => template.replace("${path}", path);
  const scratch = resolve(tmpdir(), `fleet-drop-dom-${process.pid}-${crypto.randomUUID()}`);
  mkdirSync(scratch, { recursive: true });
  const built = await Bun.build({ entrypoints: [resolve(sourceRoot, "src/client.ts")], target: "browser" });
  if (!built.success) { rmSync(scratch, { recursive: true, force: true }); throw new Error(built.logs.join("\n")); }
  const appJs = await built.outputs[0].text();
  const indexHtml = readFileSync(resolve(sourceRoot, "public/index.html"), "utf8");
  const CWD = "/fixture/orch", DROPS = `${CWD}/drops`;
  const png = fixturePng(), jpeg = new Uint8Array(Buffer.from(FIXTURE_JPEG, "base64"));
  const P = {
    png: `${DROPS}/1790787709834-Screenshot_2026-09-30_at_19.01.47.png`,
    jpg: `${DROPS}/1790787710001-foto.jpg`,
    fresh: `${DROPS}/1790787720000-neu.png`,
    missing: `${DROPS}/1790787700000-weg.png`, // gone with its worktree: the route answers 404
    fake: `${DROPS}/1790787700001-kein-bild.png`, // named .png, bytes are not a raster: 415
    foreign: "/etc/drops/1790787700002-fremd.png", // the right shape, another place: the route refuses it
    heic: `${DROPS}/1790787700003-iphone.heic`, // no browser on the board draws it: never requested
    traversal: `${DROPS}/../../../etc/1790787700004-passwd.png`, // not "<dir>/drops/<name>": never requested
  };
  const served = new Map<string, { status: number; type: string; bytes: Uint8Array }>([
    [P.png, { status: 200, type: "image/png", bytes: png }], [P.jpg, { status: 200, type: "image/jpeg", bytes: jpeg }],
    [P.fresh, { status: 200, type: "image/png", bytes: png }],
    [P.fake, { status: 415, type: "application/json", bytes: new TextEncoder().encode('{"error":"not an image this board shows"}') }],
  ]);
  const first = ["Hier zwei Bilder:", mention(P.png), mention(P.jpg), mention(P.missing), mention(P.fake),
    mention(P.foreign), mention(P.heic), mention(P.traversal), "attached: drops/1790787700005-relativ.png — read it"].join("\n");
  const at = (min: number) => new Date(Date.UTC(2026, 9, 3, 7, min)).toISOString();
  const text = (role: "user" | "assistant", t: string, min: number) => ({ role, ts: at(min), blocks: [{ t: "text", text: t }] });
  const fx = { entries: [] as Record<string, unknown>[], two: [text("user", "Slot zwei, ohne Bild.", 40)] as Record<string, unknown>[],
    source: "/fixture/orch.jsonl", sends: [] as string[], drops: [] as string[], other: [] as string[] };
  const executable = process.env.FLEET_E2E_BROWSER ?? Bun.which("chromium") ?? Bun.which("chromium-browser") ?? Bun.which("google-chrome") ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (!Bun.file(executable).size) { rmSync(scratch, { recursive: true, force: true }); throw new Error("drop chat DOM probe needs Chromium (FLEET_E2E_BROWSER): " + executable); }
  const browser = Bun.spawn([executable, "--headless", "--no-sandbox", "--disable-gpu", "--no-first-run", "--disable-background-networking", "--remote-debugging-port=0", `--user-data-dir=${scratch}/profile`, "about:blank"], { stdout: "ignore", stderr: "pipe" });
  let socket: WebSocket | undefined;
  try {
    let startupTimer: ReturnType<typeof setTimeout> | undefined;
    let startupLog = "";
    const endpoint = await Promise.race([
      (async () => { for await (const chunk of browser.stderr) { startupLog += new TextDecoder().decode(chunk); const m = /DevTools listening on (ws:\/\/[^\s]+)/.exec(startupLog); if (m) return m[1]; } throw new Error("browser exited before CDP endpoint: " + startupLog); })(),
      new Promise<never>((_, reject) => { startupTimer = setTimeout(() => reject(new Error("browser CDP startup timeout: " + startupLog)), 45000); }),
    ]).finally(() => clearTimeout(startupTimer));
    socket = new WebSocket(endpoint);
    await new Promise<void>((ok, bad) => { socket!.onopen = () => ok(); socket!.onerror = () => bad(new Error("CDP connection failed")); });
    let serial = 0, sessionId: string | undefined;
    let loaded: (() => void) | null = null;
    const pending = new Map<number, { ok: (v: Record<string, unknown>) => void; bad: (e: Error) => void }>();
    const send = (method: string, params: Record<string, unknown> = {}) => new Promise<Record<string, unknown>>((ok, bad) => {
      const id = ++serial;
      const timeout = setTimeout(() => { pending.delete(id); bad(new Error("CDP timeout: " + method)); }, 30000);
      pending.set(id, { ok: (v) => { clearTimeout(timeout); ok(v); }, bad: (e) => { clearTimeout(timeout); bad(e); } });
      socket!.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    const reply = (requestId: string, status: number, body: string | Uint8Array, type = "application/json") =>
      send("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: [{ name: "content-type", value: type }],
        body: Buffer.from(body).toString("base64") }).catch(() => undefined);
    const json = (requestId: string, value: unknown, status = 200) => reply(requestId, status, JSON.stringify(value));
    const transcript = (requestId: string, url: URL, entries: Record<string, unknown>[], source: string) => {
      const after = Number(url.searchParams.get("after") ?? 0);
      return json(requestId, { entries: entries.slice(after).map((e, i) => ({ n: after + i, ...e })), total: entries.length, source, ttlSec: 300 });
    };
    socket.onmessage = (event) => {
      const msg = JSON.parse(String(event.data)) as { id?: number; error?: unknown; result?: Record<string, unknown>; method?: string; params?: Record<string, unknown> };
      if (msg.id !== undefined) {
        const waiting = pending.get(msg.id); if (!waiting) return;
        pending.delete(msg.id);
        if (msg.error) waiting.bad(new Error(JSON.stringify(msg.error))); else waiting.ok(msg.result ?? {});
        return;
      }
      if (msg.method === "Page.loadEventFired") { const fire = loaded; loaded = null; fire?.(); return; }
      if (msg.method === "Page.javascriptDialogOpening") { void send("Page.handleJavaScriptDialog", { accept: false }).catch(() => undefined); return; }
      if (msg.method !== "Fetch.requestPaused" || !msg.params) return;
      const { requestId, request } = msg.params as { requestId: string; request: { url: string; method: string; postData?: string } };
      const url = new URL(request.url), p = url.pathname;
      if (request.method === "POST") {
        if (p === "/send") {
          let body: { text?: string } | null = null;
          try { body = request.postData ? JSON.parse(request.postData) : null; } catch { body = null; }
          fx.sends.push(String(body?.text ?? ""));
          return void json(requestId, { ok: true, receipt: { delivery: "typed" } });
        }
        // the upload answers the way server.ts's route does: the path, and the line dropMention words
        if (p === "/api/slots/1/upload") return void json(requestId, { ok: true, path: P.fresh, name: "1790787720000-neu.png", size: png.length, mention: mention(P.fresh) });
        return void json(requestId, { ok: true });
      }
      if (p === "/" || p === "/blank") return void reply(requestId, 200, p === "/" ? indexHtml : "<!doctype html><title>blank</title>", "text/html");
      if (p === "/app.js") return void reply(requestId, 200, appJs, "text/javascript");
      if (p === "/fixture/neu.png") return void reply(requestId, 200, png, "image/png");
      if (p === "/api/sessions") return void json(requestId, { now: Date.now(), chips: [], tasks: [],
        slots: [{ id: 1, cwd: CWD, label: "Orchestratorin", openedAt: 1000, harness: "claude" },
          { id: 2, cwd: "/fixture/zwei", label: "Zwei", openedAt: 1001, harness: "claude" }, ...Array.from({ length: 14 }, (_, i) => ({ id: i + 3, cwd: null }))] });
      if (p === "/api/slots/1/transcript") return void transcript(requestId, url, fx.entries, fx.source);
      if (p === "/api/slots/2/transcript") return void transcript(requestId, url, fx.two, "/fixture/zwei.jsonl");
      if (/^\/api\/slots\/\d+\/drop$/.test(p)) {
        const path = url.searchParams.get("path") ?? "";
        fx.drops.push(`${p}?${path}`);
        const hit = p === "/api/slots/1/drop" ? served.get(path) : undefined;
        return void (hit ? reply(requestId, hit.status, hit.bytes, hit.type) : json(requestId, { error: "no such drop" }, 404));
      }
      if (/\.(png|jpe?g|gif|webp|heic)$/i.test(p) || p.includes("/drops/")) fx.other.push(p);
      return void json(requestId, { error: "fixture: not served" }, 404);
    };
    const evaluate = async <T>(expression: string): Promise<T> => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error("drop chat DOM probe: evaluate failed: " + expression.replace(/\s+/g, " ").slice(0, 120));
      return (r.result as { value: T }).value;
    };
    const settle = (ms = 60) => evaluate(`new Promise(r => setTimeout(r, ${ms}))`);
    const navigate = async (to: string) => {
      const done = new Promise<void>((ok) => { loaded = ok; });
      await send("Page.navigate", { url: to });
      await Promise.race([done, Bun.sleep(15000)]);
    };
    const wait = async (condition: string, ms = 8000) => evaluate<boolean>(`new Promise((ok) => { const until = Date.now() + ${ms};
      const tick = () => { let v = false; try { v = !!(${condition}); } catch {} if (v) return ok(true); if (Date.now() > until) return ok(false); setTimeout(tick, 20); }; tick(); })`);
    const shot = async (name: string) => {
      if (!artifacts) return;
      const shotPng = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(resolve(artifacts, `${name}.png`), Buffer.from(String(shotPng.data), "base64"));
    };
    const key = async (k: "Enter" | "Escape") => {
      const code = k === "Enter" ? 13 : 27;
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: k, windowsVirtualKeyCode: code, ...(k === "Enter" ? { text: "\r" } : {}) });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: k, windowsVirtualKeyCode: code });
    };
    // what the pane's chat shows, read the way the owner reads it: per bubble its pictures (loaded or
    // not), its fallback lines and its text; plus the page's own scroll and the chat column's edges
    const READ = `(() => { const chat = document.querySelector('.pane .panechat'); const cr = chat.getBoundingClientRect();
      const own = [...chat.querySelectorAll('.msg.user')].map((m) => ({ pending: m.classList.contains('pending'),
        text: m.querySelector('.mbody')?.innerText.trim() ?? '',
        pics: [...m.querySelectorAll('.mimgs .mimg')].map((b) => { const i = b.querySelector('img'), r = b.getBoundingClientRect();
          return { alt: i?.alt ?? '', ok: !!i && i.complete && i.naturalWidth > 0, h: Math.round(r.height), w: Math.round(r.width),
            left: r.left, right: r.right, top: Math.round(r.top), tag: b.tagName, src: i?.getAttribute('src') ?? '' }; }),
        lines: [...m.querySelectorAll('.mimgs .mimgline')].map((l) => l.textContent) }));
      return { own, chatLeft: cr.left, chatRight: cr.right, pageScroll: document.documentElement.scrollWidth - innerWidth,
        broken: [...chat.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth === 0).length }; })()`;
    type Pic = { alt: string; ok: boolean; h: number; w: number; left: number; right: number; top: number; tag: string; src: string };
    type Read = { own: { pending: boolean; text: string; pics: Pic[]; lines: string[] }[]; chatLeft: number; chatRight: number; pageScroll: number; broken: number };
    const results: DropChatDomResult[] = [];
    let targetId = "";
    for (const [width, height] of [[1200, 900], [390, 844]] as const) {
      const claims: Record<string, boolean> = {};
      const facts: Record<string, unknown> = {};
      fx.entries = [text("user", first, 50), text("assistant", "Gesehen — zwei Bilder.", 51)];
      fx.source = "/fixture/orch.jsonl"; fx.sends = []; fx.drops = []; fx.other = [];
      if (targetId) { const old = targetId; sessionId = undefined; await send("Target.closeTarget", { targetId: old }).catch(() => undefined); }
      targetId = String((await send("Target.createTarget", { url: "about:blank" })).targetId);
      sessionId = String((await send("Target.attachToTarget", { targetId, flatten: true })).sessionId);
      await send("Fetch.enable", { patterns: [{ urlPattern: "http://fleet.fixture/*" }] });
      await send("Page.enable"); await send("Runtime.enable");
      await send("Page.addScriptToEvaluateOnNewDocument", { source: `window.WebSocket = class { constructor() { this.readyState = 0; } send() {} close() {} };` });
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
      await navigate("http://fleet.fixture/blank");
      await evaluate(`(() => { localStorage.clear(); localStorage.setItem('fleet.view', JSON.stringify({ layout: 1, panes: [1], focused: 0, chats: [true] })); localStorage.setItem('fleet.board', '0'); })()`);
      await navigate("http://fleet.fixture/");
      const booted = await wait(`document.querySelector('.pane .panechat .msg.assistant')`, 15000);
      if (!booted) throw new Error("drop chat DOM probe: the chat view did not show the fixture transcript: " + await evaluate<string>("document.body.innerText.slice(0, 300)"));
      await wait(`[...document.querySelectorAll('.pane .panechat .mimg img')].filter((i) => i.complete && i.naturalWidth > 0).length >= 2`, 4000);
      await settle(300);

      // --- 1. the transcript's prompt: two pictures, three readable fallbacks, three lines left as text
      const r1 = await evaluate<Read>(READ);
      facts.first = r1; facts.drops = [...fx.drops]; facts.other = [...fx.other];
      const m1 = r1.own[0];
      const cap = width === 1200 ? 120 : 96;
      claims["a sent PNG and a sent JPEG stand as two drawn pictures, named by their file"] = !!m1 && m1.pics.length === 2
        && m1.pics.every((p) => p.ok && p.tag === "BUTTON") && m1.pics[0]!.alt === "Screenshot_2026-09-30_at_19.01.47.png" && m1.pics[1]!.alt === "foto.jpg";
      claims["the prompt's own words stay in the bubble, the two picture lines leave it"] = !!m1 && m1.text.startsWith("Hier zwei Bilder:")
        && !m1.text.includes(P.png) && !m1.text.includes(P.jpg);
      claims["a missing drop, a non-raster and a foreign path turn back into their own readable line — no broken image"] = !!m1
        && JSON.stringify(m1.lines) === JSON.stringify([mention(P.missing), mention(P.fake), mention(P.foreign)]) && r1.broken === 0;
      claims["a HEIC, a traversal and a relative path are never requested and stay text in the bubble"] = !!m1
        && m1.text.includes(mention(P.heic)) && m1.text.includes(mention(P.traversal)) && m1.text.includes("relativ.png")
        && !fx.drops.some((d) => d.includes("heic") || d.includes("..") || d.includes("relativ"));
      claims["every byte request goes to the slot's own drop route, one per drawn-or-tried picture, nothing else"] =
        fx.other.length === 0 && fx.drops.every((d) => d.startsWith("/api/slots/1/drop?"))
        && [P.png, P.jpg, P.missing, P.fake, P.foreign].every((x) => fx.drops.includes(`/api/slots/1/drop?${x}`));
      claims[`compact: each picture is ${cap} px high, at most 240 px wide, the two side by side inside the chat column, no sideways page scroll`] = !!m1
        && m1.pics.length === 2 && m1.pics[0]!.top === m1.pics[1]!.top && m1.pics.every((p) => Math.abs(p.h - cap) <= 1 && p.w <= 242 && p.left >= r1.chatLeft - 1 && p.right <= r1.chatRight + 1) && r1.pageScroll <= 0;
      await shot(`${width}-1-transcript`);

      // --- 2. the keyboard: Enter on a picture opens it large, Escape closes and gives focus back
      await evaluate(`document.querySelector('.pane .panechat .mimg')?.focus()`);
      await key("Enter");
      const opened = await wait(`document.querySelector('.lightbox.open img')?.complete && document.querySelector('.lightbox.open img').naturalWidth > 0`, 3000);
      const lb = await evaluate<{ src: string; name: string; label: string; focus: boolean }>(`(() => { const l = document.querySelector('.lightbox.open');
        return { src: l?.querySelector('img')?.getAttribute('src') ?? '', name: l?.querySelector('.lbname')?.textContent ?? '', label: l?.getAttribute('aria-label') ?? '',
          focus: document.activeElement === l }; })()`);
      facts.lightbox = lb;
      claims["Enter on a focused picture opens it large in the dialog, the same bytes, named, focus in the dialog"] = opened
        && lb.src === m1?.pics[0]?.src && lb.name === "Screenshot_2026-09-30_at_19.01.47.png" && lb.focus;
      await shot(`${width}-2-gross`);
      await key("Escape");
      await settle(100);
      claims["Escape closes it and the focus is back on the picture that opened it"] = await evaluate<boolean>(
        `!document.querySelector('.lightbox.open') && document.activeElement === document.querySelector('.pane .panechat .mimg')`);
      // a click opens the second, a click beside the image closes
      await evaluate(`document.querySelectorAll('.pane .panechat .mimg')[1]?.click()`);
      const clickOpen = await wait(`document.querySelector('.lightbox.open .lbname')?.textContent === 'foto.jpg'`, 3000);
      await evaluate(`document.querySelector('.lightbox.open')?.click()`);
      await settle(100);
      claims["a click opens the JPEG large, a click beside it closes"] = clickOpen && await evaluate<boolean>(`!document.querySelector('.lightbox.open')`);

      // --- 3. a fresh send: 📎 → upload → the pending bubble shows ONE picture, and the transcript
      // entry that retires it shows exactly one too
      await evaluate(`(async () => { const b = await (await fetch('/fixture/neu.png')).arrayBuffer(); const dt = new DataTransfer();
        dt.items.add(new File([b], 'neu.png', { type: 'image/png' })); const inp = document.querySelector('#dropfile'); inp.files = dt.files;
        inp.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      await wait(`document.querySelectorAll('#compfiles .att').length === 1`, 4000);
      await evaluate(`(() => { const ta = document.querySelector('#input'); ta.focus(); ta.value = 'Und noch eins'; ta.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await evaluate(`document.querySelector('#send').click()`);
      const pend = await wait(`(() => { const m = document.querySelector('.pane .panechat .msg.user.pending'); return m && m.querySelectorAll('.mimg').length === 1
        && m.querySelector('.mimg img').complete && m.querySelector('.mimg img').naturalWidth > 0; })()`, 4000);
      facts.sent = [...fx.sends];
      claims["the composer sends the prompt and the server's drop line, unchanged"] = fx.sends.at(-1) === `Und noch eins\n${mention(P.fresh)}`;
      claims["the waiting bubble already shows the sent picture, once"] = pend;
      await shot(`${width}-3-wartet`);
      fx.entries.push(text("user", fx.sends.at(-1) ?? "", 55));
      await wait(`!document.querySelector('.pane .panechat .msg.user.pending') && document.querySelectorAll('.pane .panechat .msg.user').length === 2`, 6000);
      await settle(300);
      const r3 = await evaluate<Read>(READ);
      facts.settled = r3;
      const m3 = r3.own[1];
      claims["after the transcript has it: one bubble, \"Und noch eins\", exactly one drawn picture — no duplicate"] = r3.own.length === 2
        && !!m3 && !m3.pending && m3.text === "Und noch eins" && m3.pics.length === 1 && m3.pics[0]!.ok && m3.pics[0]!.alt === "neu.png"
        && r3.own.reduce((n, m) => n + m.pics.length, 0) === 3;
      await shot(`${width}-4-durch`);

      // --- 4. a reload reads the transcript again: the same pictures, the same fallbacks
      await navigate("http://fleet.fixture/");
      await wait(`[...document.querySelectorAll('.pane .panechat .mimg img')].filter((i) => i.complete && i.naturalWidth > 0).length >= 3`, 8000);
      await settle(200);
      const r4 = await evaluate<Read>(READ);
      claims["after a reload: three drawn pictures in two bubbles, the three fallback lines, nothing broken"] = r4.own.length === 2
        && r4.own[0]!.pics.filter((p) => p.ok).length === 2 && r4.own[1]!.pics.filter((p) => p.ok).length === 1
        && r4.own[0]!.lines.length === 3 && r4.broken === 0;

      // --- 5. the pane changes slot: slot 2 shows none of slot 1's pictures; back on slot 1 they
      // stand once each (the chat shelf, not a second copy)
      const switched = await evaluate<boolean>(`(() => { const row = document.querySelector('.slot[data-slot="2"]'); row?.click(); return !!row; })()`);
      const onTwo = switched && await wait(`[...document.querySelectorAll('.pane .panechat .msg.user .mbody')].some((b) => b.innerText.includes('Slot zwei'))`, 6000);
      const picsOnTwo = await evaluate<number>(`document.querySelectorAll('.pane .panechat .mimg').length`);
      await evaluate(`document.querySelector('.slot[data-slot="1"]')?.click()`);
      await wait(`document.querySelectorAll('.pane .panechat .msg.user').length === 2`, 6000);
      await settle(200);
      const r5 = await evaluate<Read>(READ);
      facts.switch = { switched, onTwo, picsOnTwo, back: r5.own.map((m) => m.pics.length) };
      claims["slot switch: slot 2's chat carries no picture of slot 1, and back on slot 1 each stands once"] = onTwo && picsOnTwo === 0
        && r5.own.length === 2 && r5.own[0]!.pics.length === 2 && r5.own[1]!.pics.length === 1;

      // --- 6. the slot is recycled (a new transcript source): the old occupant's pictures go with it
      fx.source = "/fixture/orch-neu.jsonl";
      fx.entries = [text("user", "Neue Session, kein Anhang.", 60)];
      const recycled = await wait(`[...document.querySelectorAll('.pane .panechat .msg.user .mbody')].some((b) => b.innerText.includes('Neue Session'))`, 8000);
      claims["a recycled slot shows the new occupant's chat and none of the old pictures"] = recycled
        && await evaluate<number>(`document.querySelectorAll('.pane .panechat .mimg, .pane .panechat .mimgline').length`) === 0;
      results.push({ width, height, claims, facts });
    }
    return results;
  } finally {
    socket?.close(); browser.kill(); await browser.exited; rmSync(scratch, { recursive: true, force: true });
  }
}
