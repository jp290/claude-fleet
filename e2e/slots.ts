// Slots: open/reject/rename, WS streaming + input, the width-aware reseed, the data-saver
// seed budget + poll plan, and HTML/txt export (including the real-metacharacter escaping
// regression).
import { readFileSync, realpathSync } from "node:fs";
import { dirname } from "node:path";
import { BASE, IP, PORT, ROOT, TOKEN, check, get, paneEnv, post, tmuxOut, wsUrl, wsWithHeaders } from "./harness";
import { exists } from "./lane-helpers";
import { RECONNECT_MAX_MS, reconnectDelay } from "../src/backoff";
import { slotStats } from "../slotstats";

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
  // --- data-saver seed budget: ?seed=N caps the scrollback the server hands a reconnecting
  // client. Measured on the live fleet, the full 3000-line seed is 6.8–173 KB PER reconnect
  // and mobile reconnects a lot, so this is the switch's largest single item. Contract: a
  // client can only ever ask for LESS than SEED_LINES, never more.
  // send-keys rather than /send on purpose — /send writes prompt history + the prompt log,
  // which later families read; this fixture must only touch the pane. Same cols/rows as the
  // pane already has (force=1 does the reseeding), so s2's size is left exactly as found.
  await tmuxOut("send-keys", "-t", "s2", "seq 1 900", "Enter");
  await Bun.sleep(1500);
  // first frame only: the seed is always the first frame on open, and everything after it is
  // live output, which would make the comparison a race instead of a measurement
  const seedFrame = (q: string): Promise<number> => new Promise((resolve) => {
    let first = -1;
    const ws = new WebSocket(`${wsUrl(2)}&cols=${reseedCols}&rows=${reseedRows}&force=1${q}`);
    ws.binaryType = "arraybuffer";
    ws.onmessage = (e) => { if (first < 0) first = (e.data as ArrayBuffer).byteLength; };
    ws.onopen = () => setTimeout(() => { ws.close(); resolve(first); }, 1500);
    ws.onerror = () => resolve(first);
  });
  const seedFull = await seedFrame("");
  const seedSmall = await seedFrame("&seed=200");
  check("WS ?seed=N shrinks the reconnect seed (the data-saver scrollback budget)",
    seedFull > 900 && seedSmall > 0 && seedSmall < seedFull / 2, `${seedFull} -> ${seedSmall} bytes`);
  const seedOverAsk = await seedFrame("&seed=99999");
  check("WS ?seed is clamped to SEED_LINES — a client can ask for LESS scrollback, never more",
    seedOverAsk >= seedFull * 0.9 && seedOverAsk <= seedFull * 1.1, `${seedFull} vs ${seedOverAsk} bytes`);
  const seedFloor = await seedFrame("&seed=1");
  check("WS ?seed has a floor — seed=1 still seeds a usable screen, not one line",
    seedFloor > 100 && seedFloor < seedSmall, `${seedFloor} bytes`);

  // --- the client half of the data-saver switch. Same method and same limits as the client
  // checks in e2e/outcomes.ts: this suite has no DOM harness, so the DECISION is cut out of
  // src/client.ts and run for real, while the WIRING around it is asserted by shape. What
  // stays unproved here is that the browser honours the plan — that was verified by hand
  // against a throwaway server (see the commit); what these checks defend is the contract.
  // The scratch copy carries server.ts + public/ but not src/ — the link back to the checkout
  // is the node_modules symlink, so the real source is its realpath's parent (as in outcomes).
  const cliSrc = readFileSync(`${dirname(realpathSync(`${ROOT}/node_modules`))}/src/client.ts`, "utf8");
  const planSrc = cliSrc.slice(cliSrc.indexOf("const SAVER = {"), cliSrc.indexOf("let dataSaver"));
  check("client: the data-saver plan is extractable as a pure function (no DOM in pollPlan)",
    planSrc.includes("function pollPlan") && !/document|localStorage|el\(/.test(planSrc.replace(/^\s*\/\/.*$/gm, "")),
    planSrc.slice(0, 60));
  const pollPlan = new Function(
    new Bun.Transpiler({ loader: "ts" }).transformSync(planSrc) + "\nreturn pollPlan;")() as
      (hidden: boolean, saver: boolean) => { pollMs: number; chatMs: number; boardMs: number; seed: number };
  const visible = pollPlan(false, false), saver = pollPlan(false, true);
  check("data saver off = today's behaviour, unchanged (2s poll, 1s chat, 3s brief, server-default seed)",
    visible.pollMs === 2000 && visible.chatMs === 1000 && visible.boardMs === 3000 && visible.seed === 0,
    JSON.stringify(visible));
  check("data saver on stretches every poll and caps the scrollback seed",
    saver.pollMs > visible.pollMs && saver.chatMs > visible.chatMs && saver.boardMs > visible.boardMs
    && saver.seed > 0, JSON.stringify(saver));
  // the whole point of the hidden branch: a tab nobody is looking at polls NOTHING. 0 means
  // "no timer at all", not "a slower timer" — armPolls() arms nothing for a 0.
  for (const on of [false, true]) {
    const hidden = pollPlan(true, on);
    check(`hidden tab polls nothing at all (data saver ${on ? "on" : "off"})`,
      hidden.pollMs === 0 && hidden.chatMs === 0 && hidden.boardMs === 0, JSON.stringify(hidden));
  }
  check("the seed budget survives hidden — it is read at connect time, not on a timer",
    pollPlan(true, true).seed === saver.seed, JSON.stringify(pollPlan(true, true)));
  // wiring: exactly ONE place arms the recurring polls, and it goes through the plan. A bare
  // interval sneaking back in is the regression that would silently un-pause a hidden tab.
  check("client: every recurring poll is armed by the pump, none by a bare literal interval",
    /function armPolls\(\)[\s\S]{0,400}?p\.pollMs[\s\S]{0,200}?p\.boardMs/.test(cliSrc)
    && !/setInterval\(\(\) => void (refresh|renderBoard)\(\),\s*\d/.test(cliSrc),
    "armPolls in src/client.ts");
  check("client: a visibility flip re-arms the pump and the chat chain, and fires one catch-up round",
    /visibilitychange[\s\S]{0,400}?armPolls\(\)[\s\S]{0,200}?chatPump\(\)[\s\S]{0,200}?document\.hidden\) return;[\s\S]{0,200}?void refresh\(\)/.test(cliSrc),
    "the visibilitychange handler in src/client.ts");
  check("client: the chat chain is CLEARED on the way out, not merely left to stop re-arming",
    /chatPump\(\) \{\s*clearTimeout\(this\.chatTimer\);\s*if \(this\.view === "chat" && plan\(\)\.chatMs\)/.test(cliSrc),
    "Pane.chatPump in src/client.ts");
  check("client: the switch is persisted per device and read back at boot",
    /localStorage\.setItem\("fleet\.datasaver"/.test(cliSrc)
    && /localStorage\.getItem\("fleet\.datasaver"\) === "1"/.test(cliSrc), "setSaver / dataSaver in src/client.ts");

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

  // --- slot HEALTH (slotstats.ts): the derived view over the audit trail. Pure-module assertions
  // first — a synthetic trail yields an exactly predictable summary — then the route that serves
  // it. Every assertion here is about the DIRECTION DISCIPLINE: what the module refuses to claim
  // when it does not know. A version that folded unknowns into zero would pass a naive happy-path
  // test and silently report a fleet that never falls over. ---
  {
    const T = 1_700_000_000_000; // fixed clock: nothing in the module may read the wall clock
    const h = 3_600_000;
    const ev = (ts: number, event: string, slot: number, detail?: unknown) => ({ ts, event, slot, detail });

    // slot 1: one completed session (2h, owner-killed) that healed twice — once keeping identity,
    // once losing it. slot 2: opened and still running at the window's end.
    const trail = [
      ev(T - 10 * h, "slot_open", 1, "/repo"),
      ev(T - 9 * h, "self_heal_recreate", 1, "resumed"),
      ev(T - 8.5 * h, "self_heal_recreate", 1, "created:no-transcript"),
      ev(T - 8 * h, "slot_kill", 1, "owner"),
      ev(T - 5 * h, "slot_open", 2, "/other"),
      ev(T - 4 * h, "owner_auth_fail", 2), // not lifecycle: scope, not damage
      { ts: T - 3 * h, event: "owner_auth_fail" }, // …and the real shape: no `slot` field AT ALL
    ];
    const s = slotStats(trail, { now: T });
    const s1 = s.slots.find((r) => r.slot === 1)!;
    check("slotstats: a completed session's lifetime is its open→kill span",
      s1.lifetimes.n === 1 && s1.lifetimes.medianMs === 2 * h, JSON.stringify(s1.lifetimes));
    check("slotstats: a heal does NOT end the session it interrupts",
      s1.opens === 1 && s1.heals === 2, `opens=${s1.opens} heals=${s1.heals}`);
    check("slotstats: the resume rate is resumed/heals, and it is the promise being measured",
      s.overall.resumed === 1 && s.overall.heals === 2 && s.overall.resumeRate === 0.5,
      JSON.stringify(s.overall));
    check("slotstats: a heal that could not resume names WHY",
      s1.healReasons["no-transcript"] === 1 && s1.healReasons["resumed"] === undefined,
      JSON.stringify(s1.healReasons));
    check("slotstats: a kill carries how the session ended",
      s1.endings["owner"] === 1, JSON.stringify(s1.endings));
    check("slotstats: a still-running session is EXCLUDED, never counted as a short life",
      s.excluded.openAtEnd === 1 && s.overall.lifetimes.n === 1, JSON.stringify(s.excluded));
    // the ordering bug this catches: validating ts/slot BEFORE checking the event books every
    // foreign row as damage. owner_auth_fail carries no `slot` at all, and on the real trail that
    // read as 468 "malformed" rows in a file with zero torn lines. Scope is not damage.
    check("slotstats: a foreign event is out of scope — with or without a slot field, never malformed",
      s.outOfScope.otherEvent === 2 && s.outOfScope.malformed === 0, JSON.stringify(s.outOfScope));

    // unknown ≠ zero, the four ways it can go wrong
    const noHeals = slotStats([ev(T - 2 * h, "slot_open", 1, "/r"), ev(T - h, "slot_kill", 1, "owner")], { now: T });
    check("slotstats: resumeRate is NULL when nothing healed — a rate with no denominator is unknown",
      noHeals.overall.resumeRate === null && noHeals.overall.heals === 0,
      JSON.stringify(noHeals.overall));
    const orphanKill = slotStats([ev(T - h, "slot_kill", 1, "owner")], { now: T });
    check("slotstats: a kill whose open rotated away is unmeasurable, NOT a zero-length life",
      orphanKill.excluded.killWithoutOpen === 1 && orphanKill.overall.lifetimes.n === 0,
      JSON.stringify(orphanKill));
    // the trap this file exists to avoid: openSlot only kills when TMUX still has the session, so
    // a slot whose pane died is re-opened with NO slot_kill (6 such pairs on the real trail). The
    // naive reading overwrites `start` and the first session vanishes — neither measured nor
    // excluded, which reads as "it never happened" rather than "we cannot know".
    const reopened = slotStats([
      ev(T - 5 * h, "slot_open", 1, "/r"),
      ev(T - 3 * h, "slot_open", 1, "/r"), // no kill in between: the first session ended in silence
      ev(T - h, "slot_kill", 1, "owner"),
    ], { now: T });
    check("slotstats: a session that ended without a kill is excluded, never silently dropped",
      reopened.excluded.openWithoutKill === 1 && reopened.overall.lifetimes.n === 1
        && reopened.overall.lifetimes.medianMs === 2 * h,
      JSON.stringify({ excluded: reopened.excluded, lifetimes: reopened.overall.lifetimes }));
    const legacy = slotStats([
      ev(T - 3 * h, "slot_open", 1, "/r"),
      ev(T - 2 * h, "self_heal_recreate", 1, "created"), // pre-reason row
      ev(T - h, "slot_kill", 1),                          // pre-reason row: detail absent
    ], { now: T });
    check("slotstats: rows written before the reasons existed read as unknown, not as a category",
      legacy.slots[0]!.healReasons["unknown"] === 1 && legacy.slots[0]!.endings["unknown"] === 1
        && legacy.slots[0]!.endings["owner"] === undefined,
      JSON.stringify(legacy.slots[0]));
    // one of OURS that is unreadable (lifecycle event, torn ts) vs one that was never ours (no
    // event field). Both are dropped, but only the first is damage — and the counters must say which.
    const junk = slotStats([{ ts: "nope", event: "slot_open", slot: 1 }, { ts: T, slot: 1 }], { now: T, malformed: 3 });
    check("slotstats: an unreadable row of OURS is damage; a row that was never ours is only scope",
      junk.outOfScope.malformed === 4 && junk.outOfScope.otherEvent === 1 && junk.slots.length === 0,
      JSON.stringify(junk.outOfScope));
    const stale = slotStats([ev(T - 40 * 24 * h, "slot_open", 1, "/r"), ev(T - 39 * 24 * h, "slot_kill", 1, "owner")], { now: T });
    check("slotstats: an event outside the window is out of scope and yields no slot row",
      stale.slots.length === 0 && stale.outOfScope.beforeWindow === 2, JSON.stringify(stale.outOfScope));

    // and the route that serves it — same access model as /api/audit
    const sres = await get("/api/slot-stats");
    const sbody = await sres.json() as { overall?: { heals?: unknown; resumeRate?: unknown }; slots?: unknown[]; excluded?: unknown };
    check("/api/slot-stats serves the derived summary", sres.ok
      && typeof sbody.overall?.heals === "number" && Array.isArray(sbody.slots) && !!sbody.excluded,
      JSON.stringify(sbody).slice(0, 200));
    const sauth = await fetch(`${BASE}/api/slot-stats`);
    check("/api/slot-stats rejects an unauthenticated read", sauth.status === 401, String(sauth.status));
  }
}
