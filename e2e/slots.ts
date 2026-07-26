// Slots: open/reject/rename, WS streaming + input, the width-aware reseed, and HTML/txt export
// (including the real-metacharacter escaping regression).
import { IP, PORT, TOKEN, check, get, paneEnv, post, tmuxOut, wsUrl, wsWithHeaders } from "./harness";
import { exists } from "./lane-helpers";

export async function run(): Promise<void> {
  // --- slots ---
  const o1 = await post("/api/slots/1/open", { cwd: "~/claude-fleet" });
  const o2 = await post("/api/slots/2/open", { cwd: "~" });
  check("open slot 1", o1.ok, JSON.stringify(await o1.json()));
  check("open slot 2", o2.ok, JSON.stringify(await o2.json()));
  const bad = await post("/api/slots/3/open", { cwd: "/nonexistent-dir-xyz" });
  check("reject bad cwd", bad.status === 400);
  const rec = (await (await get("/api/dirs?path=~")).json()) as { recents: string[] };
  check("recents updated (newest first)", rec.recents[0] === `${process.env.HOME}` && rec.recents[1] === `${process.env.HOME}/claude-fleet`, JSON.stringify(rec.recents));
  const s1 = await tmuxOut("has-session", "-t", "s1");
  const s2 = await tmuxOut("has-session", "-t", "s2");
  check("tmux s1 exists", s1.code === 0);
  check("tmux s2 exists", s2.code === 0);

  // --- regression: re-opening an ACTIVE slot must move the PANE, not just the state row.
  // ensureSlot builds a pane only when none exists, so openSlot has to tear the running one
  // down first. Without that the API answered with the new cwd while the session kept running
  // in the OLD directory and kept the OLD (by then rotated) FLEET_SELF_TOKEN in its env —
  // observed live 2026-07-25 on the steward slot. Slot 3 is free here (its open was rejected
  // above) and is killed again at the end of this block. ---
  const HOME = process.env.HOME ?? "";
  const panePath = async (target: string, want: string): Promise<string> => {
    let seen = "";
    for (let i = 0; i < 60; i++) { // the shell's cwd, polled — never a fixed sleep
      seen = (await tmuxOut("display-message", "-p", "-t", target, "#{pane_current_path}")).out.trim();
      if (seen === want) return seen;
      await Bun.sleep(100);
    }
    return seen;
  };
  const rcA = await post("/api/slots/3/open", { cwd: "~" });
  check("recycle fixture: slot 3 opens at ~", rcA.ok, JSON.stringify(await rcA.json()));
  check("recycle fixture: the fresh pane runs in the opened cwd", (await panePath("s3", HOME)) === HOME);
  await tmuxOut("send-keys", "-t", "s3", "export FLEET_E2E_RECYCLE_MARK=stale", "Enter");
  check("recycle fixture: the pane carries a marker before the recycle",
    (await paneEnv("s3", "FLEET_E2E_RECYCLE_MARK")) === "stale");
  const rcB = await post("/api/slots/3/open", { cwd: "~/claude-fleet" });
  const rcBJ = (await rcB.json()) as { cwd?: string };
  check("re-open of an ACTIVE slot answers with the new cwd", rcB.ok && rcBJ.cwd === `${HOME}/claude-fleet`,
    JSON.stringify(rcBJ));
  const rcPath = await panePath("s3", `${HOME}/claude-fleet`);
  check("re-opening an active slot moves the tmux pane to the new cwd, not just the state row",
    rcPath === `${HOME}/claude-fleet`, rcPath);
  const rcMark = await paneEnv("s3", "FLEET_E2E_RECYCLE_MARK");
  check("...and the pane is a NEW process: the recycled session inherits no env from the old one",
    rcMark === "", `[${rcMark}]`);

  // --- a label may be set AT SPAWN: the pane's env is fixed the moment tmux creates it, so a
  // label-keyed export (FLEET_STEWARD_TOKEN) can only be baked in by naming the slot on open.
  // Open-then-rename is always too late, which is what made the ⚙ steward slot impossible to
  // reproduce from the board (steward-core.ts has to kill the pane to observe the same bake). ---
  const stewTok = ((await (await get("/api/steward/token")).json()) as { token?: string }).token ?? "";
  const rcC = await post("/api/slots/3/open", { cwd: "~", label: "⚙ steward" });
  const rcCJ = (await rcC.json()) as { label?: string | null };
  check("open takes a label at spawn and answers with it", rcC.ok && rcCJ.label === "⚙ steward", JSON.stringify(rcCJ));
  const rcBaked = await paneEnv("s3", "FLEET_STEWARD_TOKEN");
  check("a slot opened WITH the steward label has FLEET_STEWARD_TOKEN baked into its pane env",
    rcBaked === stewTok && stewTok.length === 32, `[${rcBaked}]`);
  const rcLong = await post("/api/slots/3/open", { cwd: "~", label: "x".repeat(41) });
  check("open rejects a 41-char label", rcLong.status === 400);
  check("a rejected open leaves the running session untouched (validation precedes the teardown)",
    (await (await get("/api/sessions")).json() as { slots: { id: number; label: string | null; cwd: string | null }[] })
      .slots.find((x) => x.id === 3)?.label === "⚙ steward");
  await post("/api/slots/3/kill", {});

  // --- rename ---
  const rn = await post("/api/slots/2/rename", { label: "research-agent" });
  check("rename slot 2", rn.ok, JSON.stringify(await rn.json()));
  const withLabel = (await (await get("/api/sessions")).json()) as { slots: { label: string | null }[] };
  check("label visible in /api/sessions", withLabel.slots[1].label === "research-agent");
  const rnLong = await post("/api/slots/2/rename", { label: "x".repeat(41) });
  check("reject 41-char label", rnLong.status === 400);
  const rnInactive = await post("/api/slots/4/rename", { label: "nope" });
  check("reject rename of inactive slot", rnInactive.status === 400);
  const rnClear = await post("/api/slots/1/rename", { label: "  " });
  check("blank label clears to null", rnClear.ok && ((await rnClear.json()) as { label: string | null }).label === null);

  // --- streaming + input ---
  await Bun.sleep(6000);
  const wsUrl = (slot: number) => `ws://${IP}:${PORT}/ws/${slot}?token=${TOKEN}`;
  // Bun's WebSocket client accepts { headers } as a second arg — the DOM lib types don't
  const wsWithHeaders = (url: string, headers: Record<string, string>): WebSocket =>
    new (WebSocket as unknown as new (u: string, opts: { headers: Record<string, string> }) => WebSocket)(url, { headers });
  const replayBytes = await new Promise<number>((resolve) => {
    let n = 0;
    const ws = new WebSocket(wsUrl(1));
    ws.binaryType = "arraybuffer";
    ws.onmessage = (e) => { n += (e.data as ArrayBuffer).byteLength; };
    ws.onopen = () => setTimeout(() => { ws.close(); resolve(n); }, 2000);
    ws.onerror = () => resolve(-1);
  });
  check("WS replay for slot 1 non-empty", replayBytes > 100, `${replayBytes} bytes`);

  // --- width-aware reseed: a client's cols/rows on connect should resize the tmux window
  // (tmux reflows history on resize, which is what fixes cross-width scrollback wrapping) ---
  const reseedCols = 55, reseedRows = 38;
  const seedText = await new Promise<string>((resolve) => {
    let first = "";
    const ws = new WebSocket(`${wsUrl(2)}&cols=${reseedCols}&rows=${reseedRows}`);
    ws.binaryType = "arraybuffer";
    ws.onmessage = (e) => { if (!first) first = new TextDecoder().decode(e.data as ArrayBuffer); };
    ws.onopen = () => setTimeout(() => { ws.close(); resolve(first); }, 800);
    ws.onerror = () => resolve(first);
  });
  // capture-pane's plain output separates rows with bare LF; xterm.js doesn't treat LF alone
  // as a carriage return, so an unterminated LF staggers every line after it off column 0 —
  // every LF in the reseed must have a matching CR (see server.ts's crlf() normalizer)
  const lfCount = (seedText.match(/\n/g) ?? []).length;
  const crlfCount = (seedText.match(/\r\n/g) ?? []).length;
  check("reseed content has no bare LF (every line CRLF-terminated)", lfCount > 0 && lfCount === crlfCount, `${crlfCount}/${lfCount}`);
  await Bun.sleep(300);
  const winSize = await tmuxOut("display-message", "-p", "-t", "s2", "#{window_width} #{window_height}");
  check("WS connect with cols/rows reseeds tmux window", winSize.out.trim() === `${reseedCols} ${reseedRows}`, winSize.out.trim());
  const rszSame = await post("/resize", { slot: 2, cols: reseedCols, rows: reseedRows });
  check("/resize accepts matching size (no-op)", rszSame.ok);

  const wsNoTok = await new Promise<boolean>((resolve) => {
    let opened = false;
    const ws = new WebSocket(`ws://${IP}:${PORT}/ws/1`);
    ws.onopen = () => { opened = true; ws.close(); };
    ws.onerror = () => resolve(!opened);
    ws.onclose = () => resolve(!opened);
  });
  check("WS rejected without token", wsNoTok);

  await new Promise<void>((resolve) => {
    const ws = new WebSocket(wsUrl(1));
    ws.onopen = () => {
      ws.send("hello-fleet-typing");
      setTimeout(() => { ws.close(); resolve(); }, 800);
    };
    ws.onerror = () => resolve();
  });
  await Bun.sleep(500);
  const cap1 = await tmuxOut("capture-pane", "-t", "s1", "-p");
  check("typed bytes visible in s1 pane", cap1.out.includes("hello-fleet-typing"));

  const snd = await post("/send", { slot: 2, text: "compose-box-to-slot-two", submit: false });
  check("/send accepted", snd.ok);
  await Bun.sleep(700);
  const cap2 = await tmuxOut("capture-pane", "-t", "s2", "-p");
  check("composed text visible in s2 pane", cap2.out.includes("compose-box-to-slot-two"));
  check("no cross-talk (s1 text absent from s2)", !cap2.out.includes("hello-fleet-typing"));
  const cap1b = await tmuxOut("capture-pane", "-t", "s1", "-p");
  check("no cross-talk (s2 text absent from s1)", !cap1b.out.includes("compose-box-to-slot-two"));
  // --- export (before C-u wipes the input line the sent text sits on) ---
  const expHtml = await get("/api/slots/2/export");
  const expBody = await expHtml.text();
  check("export returns HTML", expHtml.ok && (expHtml.headers.get("content-type") ?? "").includes("text/html"));
  check("export contains session content", expBody.includes("compose-box-to-slot-two"));
  check("export escapes HTML metachars", !/<script/i.test(expBody) && expBody.includes("<pre>"));

  // --- regression: the check above never puts a real metacharacter into the source, so
  // it can't fail on an escaping regression — exercise the actual esc() path with real
  // input, in both the pane-content and the label (title/h1) interpolation sites ---
  const o3exp = await post("/api/slots/3/open", { cwd: "~" });
  check("open slot 3 for export-escaping fixture", o3exp.ok);
  await post("/api/slots/3/rename", { label: `<b>"pwn'd</b>` });
  await post("/send", { slot: 3, text: `<script>window.__pwn=1</script>`, submit: false });
  await Bun.sleep(400);
  const exp3 = await get("/api/slots/3/export");
  const exp3Body = await exp3.text();
  check("export escapes a real metachar in pane content", exp3Body.includes("&lt;script&gt;window.__pwn=1&lt;/script&gt;")
    && !exp3Body.includes("<script>window"));
  check("export escapes a real metachar in the label (title/h1)", exp3Body.includes(`&lt;b&gt;"pwn'd&lt;/b&gt;`)
    && !exp3Body.includes(`<b>"pwn`));
  await post("/api/slots/3/kill", {});
  const expTxt = await get("/api/slots/2/export?format=txt");
  check("export?format=txt is a plain-text download", expTxt.ok
    && (expTxt.headers.get("content-type") ?? "").includes("text/plain")
    && (expTxt.headers.get("content-disposition") ?? "").includes("attachment"), expTxt.headers.get("content-disposition") ?? "");
  check("txt export contains session content", (await expTxt.text()).includes("compose-box-to-slot-two"));
  const expInactive = await get("/api/slots/4/export");
  check("export rejects inactive slot", expInactive.status === 400);

  for (const t of ["s1", "s2"]) await tmuxOut("send-keys", "-t", t, "C-u");
}
