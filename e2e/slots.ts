// Slots: open/reject/rename, WS streaming + input, the width-aware reseed, and HTML/txt export
// (including the real-metacharacter escaping regression).
import { BASE, IP, PORT, ROOT, TOKEN, check, get, paneEnv, post, tmuxOut, wsUrl, wsWithHeaders } from "./harness";
import { exists } from "./lane-helpers";
import { RECONNECT_MAX_MS, reconnectDelay } from "../src/backoff";

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

  // --- mission: the OWNER's standing intention for a session, externalized. A lane already has
  // one (its founding task, on stewardTaskView); a plain checkout slot's running intent lives only
  // in pane scrollback and dies at /clear. Three properties are load-bearing and each is checked
  // against a real write: it is served VERBATIM (a reader judges it against the git/idle facts
  // beside it), the steward CANNOT write it (a producer must not author the anchor its own drift
  // is measured against), and it is per SESSION — a re-opened slot inherits nothing. ---
  const MISSION = `hold the "<b>x</b>" refactor — no new deps`;
  // a route that does not exist answers with a non-JSON body — parse defensively so a missing
  // route FAILS these checks (which is what proves they bite) instead of throwing and taking the
  // rest of the suite down with it
  const msJson = async (r: Response): Promise<{ mission?: unknown; error?: unknown }> => {
    const t = await r.text();
    try { return JSON.parse(t) as { mission?: unknown; error?: unknown }; } catch { return { error: t }; }
  };
  const stewMission = async (id: number): Promise<string | null | undefined> => {
    const res = await fetch(`${BASE}/api/steward/sessions`, { headers: { authorization: `Bearer ${stewTok}` } });
    const j = (await res.json()) as { slots: { id: number; mission?: string | null }[] };
    return j.slots.find((x) => x.id === id)?.mission;
  };
  const msSet = await post("/api/slots/2/mission", { mission: MISSION });
  const msSetJ = await msJson(msSet);
  check("owner sets a mission on an active slot", msSet.ok && msSetJ.mission === MISSION, JSON.stringify(msSetJ));
  const msView = await stewMission(2);
  check("stewardSlotsView serves the mission VERBATIM (no trim, no escaping, no summary)",
    msView === MISSION, JSON.stringify(msView));
  // persisted like the label: the session survives a restart, so its standing intention must too
  let msPersisted: string | null | undefined;
  for (let i = 0; i < 40; i++) { // saveState writes on a chain — poll, never a fixed sleep
    msPersisted = ((await Bun.file(`${ROOT}/fleet.json`).json()) as
      { slots?: Record<string, { mission?: string | null }> }).slots?.["2"]?.mission;
    if (msPersisted === MISSION) break;
    await Bun.sleep(50);
  }
  check("the mission is persisted to fleet.json", msPersisted === MISSION, JSON.stringify(msPersisted));
  const msLong = await post("/api/slots/2/mission", { mission: "x".repeat(301) });
  check("reject a 301-char mission", msLong.status === 400);
  const msType = await post("/api/slots/2/mission", { mission: 7 });
  check("reject a non-string, non-null mission", msType.status === 400);
  const msInactive = await post("/api/slots/4/mission", { mission: "nope" });
  check("reject a mission on an inactive slot", msInactive.status === 400);
  check("...and none of the three rejections touched the stored mission", (await stewMission(2)) === MISSION);
  const msSteward = await fetch(`${BASE}/api/slots/2/mission`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${stewTok}` },
    body: JSON.stringify({ mission: "steward-authored anchor" }),
  });
  const msStewardJ = await msJson(msSteward);
  check("the steward token is denied the mission write (403, out of scope — it reads the anchor, never writes it)",
    msSteward.status === 403 && String(msStewardJ.error ?? "").includes("not in scope"),
    `${msSteward.status} ${JSON.stringify(msStewardJ)}`);
  check("...and the denied steward write left the owner's mission intact", (await stewMission(2)) === MISSION);
  const msClear = await post("/api/slots/2/mission", { mission: null });
  check("explicit null clears the mission", msClear.ok
    && (await msJson(msClear)).mission === null && (await stewMission(2)) === null);
  // per-session, not per-slot: slot 3 is free here (killed above, re-opened later by the export
  // fixture), so this recycle is blast-radius-free
  const msOpen = await post("/api/slots/3/open", { cwd: "~" });
  check("mission fixture: slot 3 opens", msOpen.ok, JSON.stringify(await msJson(msOpen)));
  await post("/api/slots/3/mission", { mission: "the previous occupant's intention" });
  check("mission fixture: slot 3 carries a mission before the recycle",
    (await stewMission(3)) === "the previous occupant's intention");
  const msReopen = await post("/api/slots/3/open", { cwd: "~" });
  check("mission fixture: slot 3 re-opens", msReopen.ok);
  check("re-opening a slot clears the mission — a new session inherits no standing intention",
    (await stewMission(3)) === null, JSON.stringify(await stewMission(3)));
  await post("/api/slots/3/kill", {});

  // --- streaming + input ---
  await Bun.sleep(6000);
  const wsUrl = (slot: number) => `ws://${IP}:${PORT}/ws/${slot}?token=${TOKEN}`;
  // Bun's WebSocket client accepts { headers } as a second arg — the DOM lib types don't
  const wsWithHeaders = (url: string, headers: Record<string, string>): WebSocket =>
    new (WebSocket as unknown as new (u: string, opts: { headers: Record<string, string> }) => WebSocket)(url, { headers });
  // give the pane a line of its own to replay. The seed is a plain (un-escaped) capture of the
  // pane, so a bare shell prompt is a few dozen visible bytes — the byte count alone stopped
  // being the interesting assertion once the seed stopped being a slice of the raw stream and
  // its escape-sequence noise. Assert the content instead, and keep the byte floor beside it.
  await tmuxOut("send-keys", "-t", "s1", "printf 'ws-replay-fixture-line-%s\\n' 1 2 3 4 5", "Enter");
  for (let i = 0; i < 60; i++) {
    // -5 only ever exists as real output; the command echo above carries the %s, not a digit
    if ((await tmuxOut("capture-pane", "-t", "s1", "-p")).out.includes("ws-replay-fixture-line-5")) break;
    await Bun.sleep(100);
  }
  const replay = await new Promise<{ n: number; text: string }>((resolve) => {
    let n = 0, text = "";
    const ws = new WebSocket(wsUrl(1));
    ws.binaryType = "arraybuffer";
    ws.onmessage = (e) => {
      n += (e.data as ArrayBuffer).byteLength;
      text += new TextDecoder().decode(e.data as ArrayBuffer);
    };
    ws.onopen = () => setTimeout(() => { ws.close(); resolve({ n, text }); }, 2000);
    ws.onerror = () => resolve({ n: -1, text });
  });
  check("WS replay for slot 1 non-empty", replay.n > 100, `${replay.n} bytes`);
  check("WS replay carries the pane's actual content", replay.text.includes("ws-replay-fixture-line-3"), `${replay.n} bytes`);

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

  // --- the owner reseed at a MATCHING width (no cols/rows on the URL → server.ts's third
  // websocket.open branch). It used to answer with a tail of the raw stream capped at 2 MB,
  // which bound at its full value on every live pane whose stream had outgrown it. It now
  // answers with the same capture-pane seed the guest path takes. Two things have to hold:
  // the seed is small relative to the stream it replaced, and the client's byte stream across
  // the reconnect is still exactly the pane's output — no line twice, none missing. ---
  {
    const marks = (t: string) => [...t.matchAll(/SEEDMARK-(\d+)\b/g)].map((m) => Number(m[1]));
    // collect from an owner reconnect until mark `target` has arrived, or the deadline passes.
    // Deliberately NOT a fixed window: this box runs four lanes at once, and a window sized for
    // an idle machine reports "no live output" when the pane's loop is merely being slow.
    const seedFrame = (slot: number, target: number, timeoutMs: number): Promise<{ bytes: number; seed: string; all: string }> =>
      new Promise((resolve) => {
        let bytes = 0, seed = "", all = "";
        const ws = new WebSocket(wsUrl(slot)); // deliberately no cols/rows: the owner-reseed path
        ws.binaryType = "arraybuffer";
        const fin = () => { clearTimeout(timer); ws.close(); resolve({ bytes, seed, all }); };
        const timer = setTimeout(fin, timeoutMs);
        ws.onmessage = (e) => {
          const b = new Uint8Array(e.data as ArrayBuffer);
          const t = new TextDecoder().decode(b);
          if (!bytes) { bytes = b.byteLength; seed = t; }
          all += t;
          const m = marks(all);
          if (target > 0 && m.length > 0 && m[m.length - 1] >= target) fin();
        };
        ws.onerror = () => fin();
      });

    // 1) size. Flood the pane so the raw stream is far bigger than one screenful of history,
    // then wait for it to stop growing (never a fixed sleep) before measuring.
    await tmuxOut("send-keys", "-t", "s2", "seq 1 30000", "Enter");
    const rawPath = `${ROOT}/streams/s2.raw`;
    let raw = 0;
    for (let i = 0; i < 100; i++) {
      const n = Bun.file(rawPath).size;
      if (n > 100_000 && n === raw) break;
      raw = n;
      await Bun.sleep(150);
    }
    const flood = await seedFrame(2, 0, 400);
    check("owner reseed at matching width is a capture, not a tail of the raw stream",
      flood.bytes > 100 && flood.bytes * 4 < raw, `seed ${flood.bytes} B vs stream ${raw} B`);

    // 2) continuity. Drip uniquely numbered lines slowly (one line per pipe read, so the raw
    // file's write boundaries stay line-aligned) and reconnect WHILE they flow — that is the
    // state the seed has to get right: poll() lags its 100 ms tick, so bytes sit in the file
    // (hence in the capture) that this client has not been sent yet and are still on their way.
    await tmuxOut("send-keys", "-t", "s2", "for i in $(seq 1 60); do echo SEEDMARK-$i; sleep 0.05; done", "Enter");
    for (let i = 0; i < 300; i++) { // connect once there is real scrollback to seed FROM
      const m = marks((await tmuxOut("capture-pane", "-t", "s2", "-p")).out);
      if (m.length > 0 && m[m.length - 1] >= 15) break;
      await Bun.sleep(50);
    }
    const live = await seedFrame(2, 40, 20_000);
    const nums = marks(live.all), seeded = marks(live.seed);
    // the seed carries the scrollback, so the run starts at 1 and every step is exactly +1:
    // a resent overlap shows up as a step back, a dropped range as a step bigger than 1
    const contiguous = nums.length > 0 && nums[0] === 1 && nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
    check("reseed + live bytes are the pane's output exactly once — no duplicated, no missing line",
      nums.length >= 40 && contiguous, `${nums.length} marks, ${nums[0]}..${nums[nums.length - 1]}`);
    // and the split is real: the history arrived in the seed frame, the rest live after it —
    // without that this would also pass on a client that got the whole run from live bytes
    check("the reseed frame carries the scrollback, the live stream carries the rest",
      seeded.length >= 10 && seeded[0] === 1 && nums[nums.length - 1] > seeded[seeded.length - 1],
      `seed ${seeded[0]}..${seeded[seeded.length - 1]} of ${live.bytes} B, live to ${nums[nums.length - 1]}`);
    for (let i = 0; i < 100; i++) { // let the loop finish before the next section types into s2
      if ((await tmuxOut("capture-pane", "-t", "s2", "-p")).out.includes("SEEDMARK-60")) break;
      await Bun.sleep(100);
    }
  }

  // --- the client half (src/backoff.ts): a reconnect costs a seed, so a phone on a dead radio
  // must not keep buying one every 1.5 s. Pure function, asserted directly — the browser loop
  // that calls it is not reachable from here. ---
  check("reconnect backoff: the first retry is still fast", reconnectDelay(0) === 1500, `${reconnectDelay(0)}`);
  check("reconnect backoff escalates", reconnectDelay(1) === 3000 && reconnectDelay(2) === 6000 && reconnectDelay(3) === 12_000,
    [1, 2, 3].map(reconnectDelay).join(","));
  check("reconnect backoff caps and stays capped", reconnectDelay(4) === RECONNECT_MAX_MS && reconnectDelay(50) === RECONNECT_MAX_MS,
    `${reconnectDelay(4)},${reconnectDelay(50)}`);
  check("reconnect backoff never returns 0 or a negative wait", reconnectDelay(-3) === 1500 && RECONNECT_MAX_MS > 1500);

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
