// Session sharing: guest auth, mode enforcement, guest comments, the in-place mode flip and the
// regression that a share must not outlive its session. Hands its shares on via Ctx.
import { BASE, IP, PORT, check, get, plogRead, post, tmuxOut, wsWithHeaders } from "./harness";
import type { Ctx } from "./ctx";

export async function run(ctx: Ctx): Promise<void> {
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
  check("share info with cookie", shInfo.ok && shInfoJ.mode === "view", JSON.stringify(shInfoJ));
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
  check("share send blocked in view mode", (await fetch(BASE + `/s/${shView.id}/send`, {
    method: "POST", headers: { cookie: shCookie, "content-type": "application/json" },
    body: JSON.stringify({ text: "nope" }),
  })).status === 403);
  const viewWsBytes = await new Promise<number>((resolve) => {
    let n = 0;
    const w = wsWithHeaders(`ws://${IP}:${PORT}/ws-share/${shView.id}`, { cookie: shCookie });
    w.binaryType = "arraybuffer";
    w.onmessage = (e) => { n += (e.data as ArrayBuffer).byteLength; };
    w.onopen = () => {
      w.send("view-must-not-type");
      setTimeout(() => { w.close(); resolve(n); }, 1200);
    };
    w.onerror = () => resolve(-1);
  });
  check("view share WS streams replay", viewWsBytes > 100, `${viewWsBytes} bytes`);
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
  const shICreate = await post("/api/slots/1/share", { mode: "interact", password: "interpass123" });
  const shInt = (await shICreate.json()) as { id: string };
  check("create interact share", shICreate.ok && !!shInt.id);
  const shIAuth = await post(`/s/${shInt.id}/auth`, { password: "interpass123" });
  const shICookie = (shIAuth.headers.get("set-cookie") ?? "").split(";")[0];
  const sndI = await fetch(BASE + `/s/${shInt.id}/send`, {
    method: "POST", headers: { cookie: shICookie, "content-type": "application/json" },
    body: JSON.stringify({ text: "share-interact-hello", submit: false }),
  });
  check("interact share can send", sndI.ok);
  await Bun.sleep(700);
  const capI = await tmuxOut("capture-pane", "-t", "s1", "-p");
  check("interact share text reaches its pane", capI.out.includes("share-interact-hello"));
  check("share send in prompt log with source 'share'",
    (await plogRead()).some((e) => e.slot === 1 && e.source === "share" && e.text === "share-interact-hello"));
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
  // --- share-mode: flip view/interact in place, same link + password ---
  // regression: this must reach an ACTUALLY-CONNECTED guest socket, not just the HTTP
  // send route checked below — the WS message handler looks up the share's mode live on
  // every message specifically so an already-open interact socket goes silent on a flip
  const guestCloseCode = await new Promise<number>((resolve) => {
    let done = false;
    const finish = (v: number) => { if (!done) { done = true; resolve(v); } };
    const w = wsWithHeaders(`ws://${IP}:${PORT}/ws-share/${shInt.id}`, { cookie: shICookie });
    w.onopen = () => void post("/api/slots/1/share-mode", { mode: "view" });
    w.onclose = (e) => finish(e.code);
    w.onerror = () => finish(-1);
    setTimeout(() => finish(-2), 3000);
  });
  check("share-mode flip closes an already-connected guest socket with 4002", guestCloseCode === 4002, String(guestCloseCode));
  const infoFlipped = (await (await fetch(BASE + `/s/${shInt.id}/info`, { headers: { cookie: shICookie } })).json()) as { mode: string };
  check("flipped share keeps cookie, reports view", infoFlipped.mode === "view");
  check("flipped share blocks send", (await fetch(BASE + `/s/${shInt.id}/send`, {
    method: "POST", headers: { cookie: shICookie, "content-type": "application/json" },
    body: JSON.stringify({ text: "flipped-must-not-send" }),
  })).status === 403);
  check("share-mode rejects bad mode", (await post("/api/slots/1/share-mode", { mode: "admin" })).status === 400);
  check("share-mode 404 on unshared slot", (await post("/api/slots/3/share-mode", { mode: "view" })).status === 404);
  check("share-mode needs owner token", (await post("/api/slots/1/share-mode", { mode: "view" },
    { "content-type": "application/json", cookie: shICookie })).status === 401);
  const modeBack = await post("/api/slots/1/share-mode", { mode: "interact" });
  check("share-mode flips back to interact", modeBack.ok);
  const sessAfterFlip = (await (await get("/api/sessions")).json()) as
    { slots: { id: number; share: { mode: string; guests: number; created: number } | null }[] };
  const flipSlot = sessAfterFlip.slots.find((x) => x.id === 1);
  check("sessions reports share guests + created", flipSlot?.share?.mode === "interact"
    && typeof flipSlot.share.guests === "number" && typeof flipSlot.share.created === "number",
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

  ctx.shViewId = shView.id;
  ctx.shCookie = shCookie;
  ctx.shIntId = shInt.id;
  ctx.shICookie = shICookie;
}
