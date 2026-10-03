// Session sharing: guest auth, mode enforcement, guest comments, the in-place mode flip and the
// regression that a share must not outlive its session. Hands its shares on via Ctx.
import { mkdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname } from "node:path";
import { BASE, IP, PORT, ROOT, check, get, plogRead, post, tmuxOut, wsWithHeaders } from "./harness";
import type { Ctx } from "./ctx";

export async function run(ctx: Ctx): Promise<void> {
  // Plant output before connecting: a bare s2 prompt is smaller than the replay byte floor.
  await tmuxOut("send-keys", "-t", "s2", "C-u");
  const seed = await tmuxOut("send-keys", "-t", "s2", "printf 'share-replay-fixture-line-%s\\n' 1 2 3 4 5", "Enter");
  let seedReady = false;
  for (let i = 0; i < 60; i++) {
    const pane = await tmuxOut("capture-pane", "-t", "s2", "-p", "-J");
    seedReady = pane.code === 0 && pane.out.includes("share-replay-fixture-line-5");
    if (seedReady) break;
    await Bun.sleep(100);
  }
  check("share replay fixture produces output on slot 2 before the guest connects",
    seed.code === 0 && seedReady, `send=${seed.code}, output=${seedReady}`);
  // --- session sharing: guest access is slot-scoped, password-gated, mode-enforced ---
  const shCreate = await post("/api/slots/2/share", { mode: "view", password: "viewpass123" });
  const shView = (await shCreate.json()) as { id: string; path: string; password: string };
  check("create view share", shCreate.ok && !!shView.id, JSON.stringify(shView));
  const shWrong = await post(`/s/${shView.id}/auth`, { password: "totally-wrong" });
  check("share auth rejects wrong password", shWrong.status === 401);
  const shAuth = await post(`/s/${shView.id}/auth`, { password: "viewpass123" });
  const shCookie = (shAuth.headers.get("set-cookie") ?? "").split(";")[0];
  check("share auth sets share cookie", shAuth.ok && shCookie.startsWith(`share_${shView.id}=`), shCookie.slice(0, 20));
  const shInfo = await fetch(BASE + `/s/${shView.id}/info`, { headers: { cookie: shCookie } });
  const shInfoJ = (await shInfo.json()) as { mode: string; cols: number };
  check("share info with cookie", shInfo.ok && typeof shInfoJ.cols === "number", JSON.stringify(shInfoJ));
  check("share info carries no access mode — there is only one", !("mode" in shInfoJ), JSON.stringify(shInfoJ));
  check("share info without cookie 401", (await fetch(BASE + `/s/${shView.id}/info`)).status === 401);
  // guest reader: transcript is share-gated like every other share resource
  check("share transcript without cookie 401", (await fetch(BASE + `/s/${shView.id}/transcript`)).status === 401);
  {
    const tr = await fetch(BASE + `/s/${shView.id}/transcript?after=0`, { headers: { cookie: shCookie } });
    const trJ = (await tr.json()) as { entries?: unknown[]; total?: number };
    check("share transcript answers with entries+total for an authed guest",
      tr.ok && Array.isArray(trJ.entries) && typeof trJ.total === "number", JSON.stringify(trJ).slice(0, 80));
  }
  check("share cookie is not an owner credential", (await fetch(BASE + "/api/sessions", { headers: { cookie: shCookie } })).status === 401);
  // the send route was REMOVED with the interactive mode, not gated: an authed guest asking for
  // it gets the share API's generic refusal, because no branch matches "send" any more
  check("a share has no send route at all", (await fetch(BASE + `/s/${shView.id}/send`, {
    method: "POST", headers: { cookie: shCookie, "content-type": "application/json" },
    body: JSON.stringify({ text: "nope" }),
  })).status === 400);
  const viewReplay = await new Promise<{ bytes: number; text: string }>((resolve) => {
    let n = 0, text = "";
    const w = wsWithHeaders(`ws://${IP}:${PORT}/ws-share/${shView.id}`, { cookie: shCookie });
    w.binaryType = "arraybuffer";
    w.onmessage = (e) => {
      n += (e.data as ArrayBuffer).byteLength;
      text += new TextDecoder().decode(e.data as ArrayBuffer);
    };
    w.onopen = () => {
      w.send("view-must-not-type");
      setTimeout(() => { w.close(); resolve({ bytes: n, text }); }, 1200);
    };
    w.onerror = () => resolve({ bytes: -1, text });
  });
  const viewWsBytes = viewReplay.bytes;
  check("view share WS streams replay", viewWsBytes > 100, `${viewWsBytes} bytes`);
  check("view share WS replay carries the pane's pre-connect output",
    viewReplay.text.includes("share-replay-fixture-line-3"), `${viewWsBytes} bytes`);
  await Bun.sleep(400);
  const capV = await tmuxOut("capture-pane", "-t", "s2", "-p");
  check("view share WS input dropped server-side", !capV.out.includes("view-must-not-type"));
  check("share WS without cookie rejected", await new Promise<boolean>((resolve) => {
    let opened = false;
    const w = new WebSocket(`ws://${IP}:${PORT}/ws-share/${shView.id}`);
    w.onopen = () => { opened = true; w.close(); };
    w.onerror = () => resolve(!opened);
    w.onclose = () => resolve(!opened);
  }));
  // ASKING for interactive is the negative control: the field is not rejected, it is meaningless
  // — a share minted from it is the same view-only window as any other
  const shICreate = await post("/api/slots/1/share", { mode: "interact", password: "interpass123" });
  const shInt = (await shICreate.json()) as { id: string; mode?: string };
  check("create share (a mode in the body is ignored)", shICreate.ok && !!shInt.id);
  check("…and the created share reports no mode back", shInt.mode === undefined, JSON.stringify(shInt));
  const shIAuth = await post(`/s/${shInt.id}/auth`, { password: "interpass123" });
  const shICookie = (shIAuth.headers.get("set-cookie") ?? "").split(";")[0];
  const sndI = await fetch(BASE + `/s/${shInt.id}/send`, {
    method: "POST", headers: { cookie: shICookie, "content-type": "application/json" },
    body: JSON.stringify({ text: "share-interact-hello", submit: false }),
  });
  check("a share asked for as interactive still cannot send", sndI.status === 400, String(sndI.status));
  await Bun.sleep(700);
  const capI = await tmuxOut("capture-pane", "-t", "s1", "-p");
  check("…and nothing it sent reached the pane", !capI.out.includes("share-interact-hello"));
  // guest "± changes" view: read-only working diff behind the share cookie (slot 1 is a git repo)
  const shDiff = await fetch(BASE + `/s/${shInt.id}/diff`, { headers: { cookie: shICookie } });
  const shDiffJ = (await shDiff.json()) as { branch?: string | null; status?: string[]; diff?: string; commits?: unknown };
  check("share diff readable with share cookie", shDiff.ok && typeof shDiffJ.branch === "string"
    && Array.isArray(shDiffJ.status) && typeof shDiffJ.diff === "string", JSON.stringify(shDiffJ).slice(0, 120));
  check("share diff carries session commits", Array.isArray(shDiffJ.commits), JSON.stringify(shDiffJ.commits).slice(0, 80));
  check("share diff without cookie 401", (await fetch(BASE + `/s/${shInt.id}/diff`)).status === 401);
  // guest info tab: session overview behind the share cookie, minus local filesystem details
  const shBrief = await fetch(BASE + `/s/${shInt.id}/brief`, { headers: { cookie: shICookie } });
  const shBriefJ = (await shBrief.json()) as { branch?: unknown; commits?: unknown; files?: unknown };
  check("share brief readable with share cookie", shBrief.ok && typeof shBriefJ.branch === "string"
    && Array.isArray(shBriefJ.commits) && Array.isArray(shBriefJ.files), JSON.stringify(shBriefJ).slice(0, 100));
  check("share brief hides local paths (no worktree field)", !("worktree" in shBriefJ));
  // §F4 gave the owner's board a SECOND commit list: the base branch's recent history. A guest is
  // shared into one session, so that list is not theirs — and it must be dropped from the payload,
  // not merely left unrendered, because a guest can call this route directly.
  check("share brief withholds the base branch's history (repoCommits is owner-only)",
    !("repoCommits" in shBriefJ), JSON.stringify(shBriefJ).slice(0, 120));
  check("share brief without cookie 401", (await fetch(BASE + `/s/${shInt.id}/brief`)).status === 401);
  check("share cookie scoped to its own share only", (await fetch(BASE + `/s/${shView.id}/info`, { headers: { cookie: shICookie } })).status === 401);

  // --- guest comments: allowed in BOTH modes (they type nothing), owner-moderated ---
  const cmtPost = await fetch(BASE + `/s/${shView.id}/comments`, {
    method: "POST", headers: { cookie: shCookie, "content-type": "application/json" },
    body: JSON.stringify({ name: "kiebitz", text: "guest-comment-hello" }),
  });
  const cmtPostJ = (await cmtPost.json()) as { comment?: { id: string } };
  check("view-mode guest can post a comment", cmtPost.ok && !!cmtPostJ.comment?.id, JSON.stringify(cmtPostJ));
  const cmtListJ = (await (await fetch(BASE + `/s/${shView.id}/comments`, { headers: { cookie: shCookie } })).json()) as
    { comments: { id: string; name: string; text: string }[] };
  check("guest sees the posted comment", cmtListJ.comments.some((c) => c.name === "kiebitz" && c.text === "guest-comment-hello"));
  check("comments without cookie 401", (await fetch(BASE + `/s/${shView.id}/comments`)).status === 401);
  check("comments on unknown share 404", (await fetch(BASE + "/s/nosuchshare0/comments")).status === 404);
  check("empty comment rejected", (await fetch(BASE + `/s/${shView.id}/comments`, {
    method: "POST", headers: { cookie: shCookie, "content-type": "application/json" },
    body: JSON.stringify({ text: "   " }),
  })).status === 400);
  check("oversized comment rejected", (await fetch(BASE + `/s/${shView.id}/comments`, {
    method: "POST", headers: { cookie: shCookie, "content-type": "application/json" },
    body: JSON.stringify({ text: "x".repeat(2001) }),
  })).status === 400);
  const shInfoC = (await (await fetch(BASE + `/s/${shView.id}/info`, { headers: { cookie: shCookie } })).json()) as
    { viewers?: number; comments?: number };
  check("share info reports viewers + comment count", typeof shInfoC.viewers === "number" && shInfoC.comments === 1, JSON.stringify(shInfoC));
  check("owner comments route needs token", (await fetch(BASE + "/api/slots/2/comments")).status === 401);
  const ownCmts = (await (await get("/api/slots/2/comments")).json()) as { comments: { id: string }[] };
  check("owner reads the share thread", ownCmts.comments.length === 1, JSON.stringify(ownCmts));
  const sessCmt = (await (await get("/api/sessions")).json()) as { slots: { id: number; share: { comments: number } | null }[] };
  check("sessions payload carries comment count", sessCmt.slots.find((x) => x.id === 2)?.share?.comments === 1);
  check("owner deletes a comment", (await post(`/api/slots/2/comments/${cmtPostJ.comment?.id ?? "x"}/delete`, {})).ok);
  const ownCmts2 = (await (await get("/api/slots/2/comments")).json()) as { comments: unknown[] };
  check("deleted comment gone", ownCmts2.comments.length === 0);
  // owner reply: lands in the same thread, marked, readable by guests
  const orep = await post("/api/slots/2/comments", { text: "owner-reply-check" });
  const orepJ = (await orep.json()) as { comment?: { id: string; from?: string } };
  check("owner reply posts into the thread marked from=owner", orep.ok && orepJ.comment?.from === "owner", JSON.stringify(orepJ));
  const cmtAfterReply = (await (await fetch(BASE + `/s/${shView.id}/comments`, { headers: { cookie: shCookie } })).json()) as
    { comments: { text: string; from?: string }[] };
  check("guest sees the owner reply", cmtAfterReply.comments.some((c) => c.text === "owner-reply-check" && c.from === "owner"));
  check("owner empty reply rejected", (await post("/api/slots/2/comments", { text: "   " })).status === 400);
  // guest ✨ summary: same single-flight/cache contract as the owner endpoint
  check("share summary without cookie 401", (await fetch(BASE + `/s/${shInt.id}/summary`)).status === 401);
  const gsum = await fetch(BASE + `/s/${shInt.id}/summary`, { method: "POST", headers: { cookie: shICookie } });
  const gsumJ = (await gsum.json()) as { summary?: string };
  check("guest summary POST runs the shared agent path", gsum.ok && gsumJ.summary === "fake summary of the session",
    JSON.stringify(gsumJ).slice(0, 80));
  const gsumGet = (await (await fetch(BASE + `/s/${shInt.id}/summary`, { headers: { cookie: shICookie } })).json()) as
    { summary?: string; cached?: boolean };
  check("guest summary GET serves the cache", gsumGet.summary === "fake summary of the session" && gsumGet.cached === true);
  // --- the interactive mode is GONE, and these are the two ways that has to be true ---
  // (1) the owner-side switch does not exist. Not „[Zitat entfernt]“ — the route itself is
  // not in the slot-action regex any more, so there is nothing left to hand a mode to.
  check("the share-mode route no longer exists", (await post("/api/slots/1/share-mode", { mode: "interact" })).status === 404);
  // (2) the guest-side one, and it is the load-bearing half: an ACTUALLY-CONNECTED socket may
  // not type. This used to be conditional on a live mode lookup; it is now unconditional, so
  // the check is that bytes sent on an open, authenticated guest socket never reach the pty.
  const intWsTyped = await new Promise<boolean>((resolve) => {
    const w = wsWithHeaders(`ws://${IP}:${PORT}/ws-share/${shInt.id}`, { cookie: shICookie });
    w.onopen = () => {
      w.send("connected-guest-must-not-type");
      setTimeout(() => { w.close(); resolve(true); }, 1200);
    };
    w.onerror = () => resolve(false);
  });
  check("an authenticated guest socket opens and accepts bytes from the client", intWsTyped);
  await Bun.sleep(400);
  const capT = await tmuxOut("capture-pane", "-t", "s1", "-p");
  check("…and none of those bytes reached the pane", !capT.out.includes("connected-guest-must-not-type"));
  const sessAfterFlip = (await (await get("/api/sessions")).json()) as
    { slots: { id: number; share: { mode?: string; guests: number; created: number } | null }[] };
  const flipSlot = sessAfterFlip.slots.find((x) => x.id === 1);
  check("sessions reports share guests + created, and no mode", flipSlot?.share?.mode === undefined
    && typeof flipSlot?.share?.guests === "number" && typeof flipSlot.share.created === "number",
    JSON.stringify(flipSlot?.share));
  await tmuxOut("send-keys", "-t", "s1", "C-u");

  // --- regression: a share must not outlive its session — reopening a slot onto a
  // different cwd must kill the old share, not leave it pointed at the new session ---
  const o3 = await post("/api/slots/3/open", { cwd: "~" });
  check("open slot 3 for reopen-regression fixture", o3.ok);
  const sh3Create = await post("/api/slots/3/share", { mode: "view", password: "reopenpass1" });
  const sh3 = (await sh3Create.json()) as { id: string };
  const sh3Auth = await post(`/s/${sh3.id}/auth`, { password: "reopenpass1" });
  const sh3Cookie = (sh3Auth.headers.get("set-cookie") ?? "").split(";")[0];
  const sh3WsClosed = await new Promise<number>((resolve) => {
    let done = false;
    const finish = (v: number) => { if (!done) { done = true; resolve(v); } };
    const w = wsWithHeaders(`ws://${IP}:${PORT}/ws-share/${sh3.id}`, { cookie: sh3Cookie });
    w.onopen = () => void post("/api/slots/3/open", { cwd: "~/claude-fleet" });
    w.onclose = (e) => finish(e.code);
    w.onerror = () => finish(-1);
    setTimeout(() => finish(-2), 3000); // bound the wait — a hang here must not hang the suite
  });
  check("reopen closes the old share's connected guest socket", sh3WsClosed === 4000, String(sh3WsClosed));
  check("reopen invalidates the old share's cookie", (await fetch(BASE + `/s/${sh3.id}/info`, { headers: { cookie: sh3Cookie } })).status === 404);
  const sess3Api = (await (await get("/api/sessions")).json()) as { slots: { id: number; share: unknown }[] };
  check("reopened slot reports no share", sess3Api.slots.find((x) => x.id === 3)?.share === null);
  await post("/api/slots/3/kill", {}); // restore slot 3 to inactive for the rest of the suite

  // --- the guest wire for a session in a folder WITHOUT git (server.ts#cwdGitBody, guest form) ---
  // A plain folder is an ordinary session: the guest brief says git:"none" and keeps only the start
  // time; a folder that vanished is git:"gone", never "no git here". Neither body may carry the
  // folder's path (the guest wire has no private paths) or a git fact. Own folder, own slot 3.
  {
    const plain = `${tmpdir()}/fleet-e2e-share-nogit-${process.pid}`;
    rmSync(plain, { recursive: true, force: true });
    mkdirSync(plain, { recursive: true });
    try {
      const opened = await post("/api/slots/3/open", { cwd: plain });
      const shN = (await (await post("/api/slots/3/share", { mode: "view", password: "nogitpass1" })).json()) as { id?: string };
      const authN = await post(`/s/${shN.id ?? "x"}/auth`, { password: "nogitpass1" });
      const ckN = (authN.headers.get("set-cookie") ?? "").split(";")[0];
      const guest = async (what: string) => {
        const r = await fetch(BASE + `/s/${shN.id ?? "x"}/${what}`, { headers: { cookie: ckN } });
        const text = await r.text();
        return { status: r.status, text, body: (() => { try { return JSON.parse(text) as Record<string, unknown>; } catch { return {}; } })() };
      };
      const gitFacts = ["branch", "head", "uncommitted", "commits", "files", "shortstat", "diff", "status"];
      check("guest no-git fixture: slot 3 opens on a plain folder and shares", opened.ok && authN.ok && !!ckN,
        `open=${opened.status} auth=${authN.status}`);
      const b = await guest("brief"), d = await guest("diff");
      check("guest: a plain folder's brief and diff say git:none, keep the start time, invent no git fact, name no path",
        b.status === 400 && b.body.git === "none" && "sessionStart" in b.body && !("setup" in b.body)
          && d.status === 400 && d.body.git === "none"
          && gitFacts.every((k) => !(k in b.body) && !(k in d.body))
          && !b.text.includes(plain) && !d.text.includes(plain),
        JSON.stringify({ brief: b.text, diff: d.text }));
      rmSync(plain, { recursive: true, force: true });
      const bg = await guest("brief"), dg = await guest("diff");
      check("guest: a folder removed under the shared session is git:gone, never git:none, and names no path",
        bg.status === 400 && bg.body.git === "gone" && dg.status === 400 && dg.body.git === "gone"
          && !("sessionStart" in bg.body) && !bg.text.includes(plain) && !dg.text.includes(plain),
        JSON.stringify({ brief: bg.text, diff: dg.text }));
      await post("/api/slots/3/kill", {});
      // the unreachable session: its share dies with it, so the guest gets no git kind at all
      const after = await guest("brief");
      check("guest: a killed session's brief is the share's 404, not a git state",
        after.status === 404 && !("git" in after.body), after.text.slice(0, 200));
    } finally {
      rmSync(plain, { recursive: true, force: true });
    }
    // the staged instance carries no src/ — the real checkout is behind its node_modules symlink
    // (the e2e/slots.ts sourceRoot pattern); an unreadable source fails as ITSELF, not as a mismatch
    let shareSrc = "";
    try {
      shareSrc = readFileSync(`${dirname(realpathSync(`${ROOT}/node_modules`))}/src/share.ts`, "utf8");
    } catch (e) { check("precondition: node_modules exposes src/share.ts for the guest client check", false, String(e)); }
    if (shareSrc) check("guest client: only git:none reads as `no git in this folder`; any other failed read shows the server's sentence",
      /if \(e\?\.git !== "none"\) \{/.test(shareSrc) && /empty\(body, e\?\.error \?\? "session overview unavailable"\);/.test(shareSrc)
        && !/this session is not inside a git repository/.test(shareSrc) && /if \(data\.git === "none"\) \{/.test(shareSrc),
      "loadBrief/loadChanges in src/share.ts");
  }

  ctx.shViewId = shView.id;
  ctx.shCookie = shCookie;
  ctx.shIntId = shInt.id;
  ctx.shICookie = shICookie;
}
