// Slots: open/reject/rename, WS streaming + input, the width-aware reseed, the data-saver
// seed budget + poll plan, and HTML/txt export (including the real-metacharacter escaping
// regression).
import { appendFileSync, chmodSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { BASE, IP, PORT, REPO, ROOT, check, get, paneEnv, plantScreen, plogRead, post, restartSrv, stopSrv, tmuxOut, wsUrl, wsWithHeaders, type PromptLogEntry } from "./harness";
import { MERGE_IDLE_MS, exists } from "./lane-helpers";
import { RECONNECT_MAX_MS, reconnectDelay } from "../src/backoff";
import { pollPlan } from "../src/pollplan";
import { slotStats } from "../slotstats";
import { normalizeLaneAnchor, type LaneAnchor } from "../src/protocol";

export async function run(): Promise<void> {
  // --- slots ---
  const fixed = (await (await get("/api/sessions")).json()) as { slots: { id: number }[] };
  check("the sidebar API exposes all 16 fixed slots in order",
    fixed.slots.length === 16 && fixed.slots.every((s, i) => s.id === i + 1),
    JSON.stringify(fixed.slots.map((s) => s.id)));

  // --- regression (2026-09-01): tmux resolves a bare `-t s1` by PREFIX once no exact `s1` exists,
  // so with `s10` alive and slot 1 free, ensureSlot's has-session answered 0 for a session that was
  // not there, existingTmuxTarget returned s10's pane, no s1 was ever created, and the founding
  // brief for slot 1 was pasted into the controller in slot 10 (a kill of slot 1 would have killed
  // it). Every name-based `-t` now goes through server.ts#sessTarget / #paneTarget (`=name`,
  // `=name:`). The decoy lives on the suite socket only; the precondition is measured first so a
  // probe that could not run fails as ITSELF. Mutation caught: dropping the `=` from sessTarget
  // (has-session hits s10 again, no s1 appears). ---
  {
    const decoy = await tmuxOut("new-session", "-d", "-s", "s10", "sleep 300");
    const exactDecoy = await tmuxOut("has-session", "-t", "=s10");
    const exactVictim = await tmuxOut("has-session", "-t", "=s1");
    const bareVictim = await tmuxOut("has-session", "-t", "s1");
    check("exact-target fixture: decoy s10 exists, no s1 exists, and a bare `-t s1` prefix-matches the decoy",
      decoy.code === 0 && exactDecoy.code === 0 && exactVictim.code !== 0 && bareVictim.code === 0,
      `new-session=${decoy.code} =s10=${exactDecoy.code} =s1=${exactVictim.code} bare-s1=${bareVictim.code}`);
    const decoyPaneBefore = (await tmuxOut("display-message", "-p", "-t", "=s10:", "#{pane_id}")).out.trim();
    const opened = await post("/api/slots/1/open", { cwd: "~" });
    const names = (await tmuxOut("list-sessions", "-F", "#{session_name}")).out.split("\n").filter(Boolean);
    const decoyState = (await tmuxOut("display-message", "-p", "-t", "=s10:",
      "#{pane_id}\t#{pane_current_command}\t#{pane_pipe}")).out.trim().split("\t");
    const victimPane = (await tmuxOut("display-message", "-p", "-t", "=s1:", "#{pane_id}")).out.trim();
    check("opening free slot 1 next to a live s10 creates an exact `s1` and never adopts the decoy's pane",
      opened.ok && names.includes("s1") && names.includes("s10")
        && /^%\d+$/.test(victimPane) && victimPane !== decoyPaneBefore
        && decoyState[0] === decoyPaneBefore && decoyState[1] === "sleep" && decoyState[2] === "0",
      `open=${opened.status} sessions=[${names}] s1=${victimPane || "?"} s10=${decoyState.join("|")}`);
    await post("/api/slots/1/kill", {});
    await tmuxOut("kill-session", "-t", "=s10");
    const cleaned = await tmuxOut("has-session", "-t", "=s10");
    check("exact-target fixture: decoy s10 removed again", cleaned.code !== 0, `has-session=${cleaned.code}`);
  }

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
  type PersistedSlot3 = { label?: string | null; cwd?: string | null; openedAt?: number; selfToken?: string } | null | undefined;
  const persistedSlot3 = async (): Promise<PersistedSlot3> => {
    try {
      return ((await Bun.file(`${ROOT}/fleet.json`).json()) as
        { slots?: Record<string, { label?: string | null; cwd?: string | null }> }).slots?.["3"] ?? null;
    } catch { return undefined; }
  };
  const waitForPersistedSlot3 = async (accept: (row: PersistedSlot3) => boolean,
    timeoutMs = 3000): Promise<PersistedSlot3> => {
    const until = Date.now() + timeoutMs;
    let row: PersistedSlot3 = undefined;
    while (Date.now() < until) {
      row = await persistedSlot3();
      if (accept(row)) return row;
      await Bun.sleep(25);
    }
    return row;
  };
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
  const initialKillPersisted = await waitForPersistedSlot3((row) => row === null);
  check("slot-stream fixture: slot 3 kill is durable before restarting with the latch",
    initialKillPersisted === null, JSON.stringify(initialKillPersisted) ?? "unreadable");

  // --- a stale ensureSlot continuation may finish after the slot was killed and recycled. The
  // spawn barrier intentionally ends before capture/pipe/repaint, so those later effects need their
  // own immutable occupant path and tmux ids. This latch stops A after capture but before its first
  // file write; B must be able to replace it while stopped. Mutations caught here: returning to the
  // shared streams/s3.raw path, dropping the post-write occupant check, or targeting pipe/repaint at
  // the reusable name s3 instead of the captured pane/window ids. ---
  {
    const streamDir = `${ROOT}/streams`;
    const latch = `${ROOT}/slot-post-capture-latch`;
    const reachedPath = `${latch}.reached`;
    const releasePath = `${latch}.release`;
    const waitForFile = async (path: string, timeoutMs = 5000): Promise<boolean> => {
      const until = Date.now() + timeoutMs;
      while (Date.now() < until) {
        if (await exists(path)) return true;
        await Bun.sleep(25);
      }
      return false;
    };
    for (const path of [latch, reachedPath, releasePath]) rmSync(path, { force: true });
    await restartSrv({ FLEET_TEST_SLOT_POST_CAPTURE_LATCH: latch });
    const staleOpen = post("/api/slots/3/open", { cwd: "~", label: "stream-race-A" });
    const reached = await waitForFile(reachedPath);
    check("slot-stream fixture: A reaches the post-capture latch before any stream write", reached,
      reached ? readFileSync(reachedPath, "utf8").trim() : "latch not reached");
    let aFinal = "", aStage = "";
    if (reached) {
      try {
        const row = JSON.parse(readFileSync(reachedPath, "utf8")) as { final?: unknown; stage?: unknown };
        if (typeof row.final === "string") aFinal = row.final;
        if (typeof row.stage === "string") aStage = row.stage;
      } catch { /* fixture check below owns malformed latch evidence */ }
    }
    check("slot-stream fixture: latch names A's occupant-specific final and stage paths",
      aFinal.startsWith(`${streamDir}/s3-`) && aFinal.endsWith(".raw") && aStage === `${aFinal}.stage`,
      JSON.stringify({ aFinal, aStage }));
    const killedA = await post("/api/slots/3/kill", {});
    check("slot-stream fixture: kill A completes while its post-capture continuation is paused",
      killedA.ok, `${killedA.status} ${await killedA.text()}`);
    const openedB = await post("/api/slots/3/open", { cwd: "~/claude-fleet", label: "stream-race-B" });
    check("slot-stream fixture: B opens in the same reusable slot while A remains paused",
      openedB.ok, `${openedB.status} ${await openedB.text()}`);
    const bRaw = readdirSync(streamDir)
      .filter((name) => name.startsWith("s3-") && name.endsWith(".raw") && `${streamDir}/${name}` !== aFinal)
      .map((name) => `${streamDir}/${name}`);
    check("slot-stream fixture: B owns exactly one different occupant-specific stream",
      bRaw.length === 1, JSON.stringify(bRaw));
    const bFinal = bRaw[0] ?? "";
    const beforeMarker = "STREAM-RACE-B-BEFORE";
    const afterMarker = "STREAM-RACE-B-AFTER";
    if (bFinal) appendFileSync(bFinal, `${beforeMarker}\n`);
    writeFileSync(releasePath, "release\n", { mode: 0o600 });
    const staleResult = await staleOpen;
    check("slot-stream fixture: releasing A lets its stale open return without hanging B",
      staleResult.ok, `${staleResult.status} ${await staleResult.text()}`);
    await tmuxOut("send-keys", "-t", "s3", `printf '${afterMarker}\\n'`, "Enter");
    let bBody = "";
    for (let i = 0; i < 60; i++) {
      try { bBody = readFileSync(bFinal, "utf8"); } catch { bBody = ""; }
      if (bBody.includes(afterMarker)) break;
      await Bun.sleep(50);
    }
    const raceState = await waitForPersistedSlot3((row) =>
      row?.label === "stream-race-B" && row.cwd === `${HOME}/claude-fleet`);
    const leftovers = readdirSync(streamDir).filter((name) => name.startsWith("s3-") && name.endsWith(".stage"));
    check("a stale A continuation cannot overwrite B's stream, retarget B's pipe, or relabel B",
      raceState?.label === "stream-race-B" && raceState.cwd === `${HOME}/claude-fleet`
        && bBody.includes(beforeMarker) && bBody.includes(afterMarker)
        && !bBody.includes("stream-race-A") && !readdirSync(streamDir).includes("s3.raw")
        && !readdirSync(streamDir).includes(aFinal.split("/").pop() ?? "") && leftovers.length === 0,
      JSON.stringify({ raceState, bBody: bBody.slice(-200), leftovers }));
    await post("/api/slots/3/kill", {});
    const raceKillPersisted = await waitForPersistedSlot3((row) => row === null);
    check("slot-stream fixture: B kill is durable before the latch restart", raceKillPersisted === null,
      JSON.stringify(raceKillPersisted) ?? "unreadable");
    await restartSrv();
    for (const path of [latch, reachedPath, releasePath]) rmSync(path, { force: true });
  }

  // --- tmux new-session is the only tmux command that owns a process timeout. A PATH-local fake
  // blocks its first new-session and delegates everything else (and every later new-session) to the
  // real binary. The first open must return typed UNKNOWN within timeout+TERM/KILL grace; kill and a
  // successful second open prove the per-slot spawn promise was removed in finally. Mutations caught:
  // using generic tmux() for a new-session, TERM without KILL escalation, or leaking slotSpawnInflight. ---
  {
    const fakeBin = `${ROOT}/tmux-new-session-timeout-bin`;
    const marker = `${ROOT}/tmux-new-session-timeout.once`;
    const realTmux = Bun.which("tmux") ?? "";
    rmSync(fakeBin, { recursive: true, force: true });
    rmSync(marker, { force: true });
    mkdirSync(fakeBin, { recursive: true });
    const fakeTmux = `${fakeBin}/tmux`;
    writeFileSync(fakeTmux, `#!/bin/sh\ncase " $* " in\n  *" new-session "*)\n    if [ ! -e '${marker}' ]; then\n      : > '${marker}'\n      exec sleep 60\n    fi\n    ;;\nesac\nexec '${realTmux}' "$@"\n`, { mode: 0o700 });
    chmodSync(fakeTmux, 0o700);
    check("tmux-timeout fixture: the real tmux binary and executable blocking shim exist",
      realTmux.startsWith("/") && await exists(fakeTmux), JSON.stringify({ realTmux, fakeTmux }));
    await restartSrv({
      PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
      FLEET_TMUX_NEW_SESSION_TIMEOUT_MS: "150",
    });
    const started = Date.now();
    const unavailable = await post("/api/slots/3/open", { cwd: "~", label: "tmux-timeout-A" });
    const unavailableText = await unavailable.text();
    let unavailableBody: { error?: unknown; availability?: unknown } = {};
    try { unavailableBody = JSON.parse(unavailableText) as typeof unavailableBody; } catch { /* asserted below */ }
    const unavailableMs = Date.now() - started;
    check("a blocked tmux new-session returns 503 named unavailable/unknown within timeout plus kill grace",
      unavailable.status === 503 && unavailableBody.availability === "unknown"
        && String(unavailableBody.error ?? "").includes("tmux new-session unavailable")
        && unavailableMs >= 100 && unavailableMs < 2500,
      `${unavailable.status} ${unavailableMs}ms ${unavailableText.slice(0, 180)}`);
    const timeoutKill = await post("/api/slots/3/kill", {});
    check("the timed-out occupant remains killable after the spawn barrier finally clears",
      timeoutKill.ok, `${timeoutKill.status} ${await timeoutKill.text()}`);
    const recovered = await post("/api/slots/3/open", { cwd: "~", label: "tmux-timeout-B" });
    check("a second open succeeds after the first timed-out spawn (no leaked in-flight promise)",
      recovered.ok && (await tmuxOut("has-session", "-t", "s3")).code === 0,
      `${recovered.status} ${await recovered.text()}`);
    await post("/api/slots/3/kill", {});
    const timeoutKillPersisted = await waitForPersistedSlot3((row) => row === null);
    check("tmux-timeout fixture: recovered occupant kill is durable before restoring PATH",
      timeoutKillPersisted === null, JSON.stringify(timeoutKillPersisted) ?? "unreadable");
    await restartSrv();
    rmSync(fakeBin, { recursive: true, force: true });
    rmSync(marker, { force: true });
  }

  // --- Owner input is bound to the occupant and pane observed when the socket opens. Pausing one
  // queued message lets A die and B reuse s3 before the old closure resumes. Mutation caught:
  // resolving `s3` inside the queued callback, or retaining only the reusable slot number. ---
  {
    const latch = `${ROOT}/owner-ws-input-latch`;
    for (const path of [latch, `${latch}.reached`, `${latch}.release`]) rmSync(path, { force: true });
    writeFileSync(latch, "3\n", { mode: 0o600 });
    await restartSrv({ FLEET_TEST_WS_INPUT_LATCH: latch });
    const openedA = await post("/api/slots/3/open", { cwd: "~", label: "ws-input-race-A" });
    const stateA = await waitForPersistedSlot3((row) => row?.label === "ws-input-race-A");
    const marker = "OLD-OWNER-WS-MUST-NOT-REACH-B";
    let socket: WebSocket | null = null;
    const connected = await new Promise<boolean>((resolveConnected) => {
      const ws = new WebSocket(wsUrl(3));
      socket = ws;
      const timeout = setTimeout(() => resolveConnected(false), 3000);
      ws.onmessage = () => { clearTimeout(timeout); resolveConnected(true); };
      ws.onerror = () => resolveConnected(false);
    });
    if (connected && socket) (socket as WebSocket).send(marker);
    let reached = false;
    for (let i = 0; i < 200 && !(reached = await exists(`${latch}.reached`)); i++) await Bun.sleep(25);
    check("owner-WS fixture: A's queued bytes reach the generation-bound latch", openedA.ok && connected && reached,
      JSON.stringify({ open: openedA.status, connected, reached, stateA }));
    const killedA = reached ? await post("/api/slots/3/kill", {}) : null;
    const openedB = killedA?.ok
      ? await post("/api/slots/3/open", { cwd: "~/claude-fleet", label: "ws-input-race-B" }) : null;
    const stateB = await waitForPersistedSlot3((row) => row?.label === "ws-input-race-B");
    writeFileSync(`${latch}.release`, "release\n", { mode: 0o600 });
    await Bun.sleep(250);
    const bCapture = await tmuxOut("capture-pane", "-p", "-t", "s3");
    const bHistory = await (await get("/api/slots/3/history")).json() as { history?: { text?: string }[] };
    check("old owner WS input cannot reach the recycled occupant",
      killedA?.ok === true && openedB?.ok === true && !!stateA?.openedAt && !!stateB?.openedAt
        && stateB.openedAt !== stateA.openedAt && stateB.selfToken !== stateA.selfToken
        && !bCapture.out.includes(marker) && !(bHistory.history ?? []).some((row) => row.text?.includes(marker)),
      JSON.stringify({ kill: killedA?.status, open: openedB?.status, stateA, stateB,
        capture: bCapture.out.slice(-160), history: bHistory.history }));
    if (socket) (socket as WebSocket).close();
    await post("/api/slots/3/kill", {});
    await restartSrv();
    for (const path of [latch, `${latch}.reached`, `${latch}.release`]) rmSync(path, { force: true });
  }

  // --- Teardown publishes no partial row. While A is paused, a duplicate kill must join, open B
  // must wait, and the heal tick must not recreate an externally stopped A pane. Mutation caught:
  // late latch registration, a reusable `kill-session -t s3`, or ensureSlot ignoring teardown. ---
  {
    const latch = `${ROOT}/slot-teardown-latch`;
    for (const path of [latch, `${latch}.reached`, `${latch}.release`]) rmSync(path, { force: true });
    writeFileSync(latch, "3\n", { mode: 0o600 });
    await restartSrv({ FLEET_TEST_SLOT_TEARDOWN_LATCH: latch });
    const openedA = await post("/api/slots/3/open", { cwd: "~", label: "teardown-race-A" });
    const stateA = await waitForPersistedSlot3((row) => row?.label === "teardown-race-A");
    const paneA = (await tmuxOut("display-message", "-p", "-t", "s3", "#{pane_id}")).out.trim();
    const killOne = post("/api/slots/3/kill", {});
    let reached = false;
    for (let i = 0; i < 200 && !(reached = await exists(`${latch}.reached`)); i++) await Bun.sleep(25);
    const killTwo = post("/api/slots/3/kill", {});
    const openB = post("/api/slots/3/open", { cwd: "~/claude-fleet", label: "teardown-race-B" });
    const publishedDuring = await persistedSlot3();
    if (/^%\d+$/.test(paneA)) await tmuxOut("kill-pane", "-t", paneA);
    await Bun.sleep(2300);
    const noHealDuring = (await tmuxOut("has-session", "-t", "s3")).code !== 0;
    const stillPublished = await persistedSlot3();
    writeFileSync(`${latch}.release`, "release\n", { mode: 0o600 });
    const [killOneResult, killTwoResult, openBResult] = await Promise.all([killOne, killTwo, openB]);
    const stateB = await waitForPersistedSlot3((row) => row?.label === "teardown-race-B");
    const paneB = await tmuxOut("has-session", "-t", "s3");
    check("teardown keeps A published, joins duplicate kill, suppresses heal and preserves B",
      openedA.ok && reached && /^%\d+$/.test(paneA) && !!stateA?.openedAt
        && publishedDuring?.openedAt === stateA.openedAt && publishedDuring.selfToken === stateA.selfToken
        && stillPublished?.openedAt === stateA.openedAt && stillPublished.selfToken === stateA.selfToken
        && noHealDuring && killOneResult.ok && killTwoResult.ok && openBResult.ok
        && !!stateB?.openedAt && stateB.openedAt !== stateA.openedAt && stateB.selfToken !== stateA.selfToken
        && stateB.label === "teardown-race-B" && paneB.code === 0,
      JSON.stringify({ openA: openedA.status, reached, paneA, stateA, publishedDuring, stillPublished,
        noHealDuring, kills: [killOneResult.status, killTwoResult.status], openB: openBResult.status, stateB, paneB: paneB.code }));
    await post("/api/slots/3/kill", {});
    await restartSrv();
    for (const path of [latch, `${latch}.reached`, `${latch}.release`]) rmSync(path, { force: true });
  }

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

  // --- POST /api/slots/:id/model: the owner rewrites a LIVE slot's model/effort in the RECORD.
  // No respawn (the pane keeps running), and that is the point: heal, ↻ restart and succession
  // read the record, and before this route they all fell back to the spawn-time value. The pane
  // half (a restart spawns with the new pair) is proven in ./e2e-claude-gate.sh, the only suite
  // whose FLEET_CMD makes the flags appear; here: the record, both views, the audit trail, and
  // the three ways in that must NOT reach it. ---
  type ModelRow = { id: number; label?: string | null; model: string | null; effort?: string; harness?: string;
    agent?: string | null; paneModel?: string; modelPushedAt?: number };
  const modelRowOf = async (id: number): Promise<ModelRow | undefined> =>
    ((await (await get("/api/sessions")).json()) as { slots: ModelRow[] }).slots.find((x) => x.id === id);
  const stewModelRowOf = async (id: number): Promise<ModelRow | undefined> =>
    ((await (await fetch(`${BASE}/api/steward/sessions`, { headers: { authorization: `Bearer ${stewTok}` } })).json()) as
      { slots: ModelRow[] }).slots.find((x) => x.id === id);
  const modelBefore = await modelRowOf(2);
  const mdSet = await post("/api/slots/2/model", { model: "claude-sonnet-5[1m]", effort: "high" });
  const mdSetJ = (await mdSet.json()) as { ok?: boolean; model?: string | null; effort?: string | null; error?: string };
  check("owner rewrites a live slot's model+effort (200, the pair echoed back)",
    mdSet.ok && mdSetJ.model === "claude-sonnet-5[1m]" && mdSetJ.effort === "high", `${mdSet.status} ${JSON.stringify(mdSetJ)}`);
  const mdRow = await modelRowOf(2);
  check("GET /api/sessions serves the rewritten pair on the slot's row",
    mdRow?.model === "claude-sonnet-5[1m]" && mdRow.effort === "high", JSON.stringify(mdRow));
  const mdStew = await stewModelRowOf(2);
  check("GET /api/steward/sessions serves model AND effort (the steward view carried no effort before 2026-09-02)",
    mdStew?.model === "claude-sonnet-5[1m]" && mdStew.effort === "high", JSON.stringify(mdStew));
  let mdPersisted: { model?: string | null; effort?: string | null } | undefined;
  for (let i = 0; i < 40; i++) { // saveState writes on a chain — poll, never a fixed sleep
    mdPersisted = ((await Bun.file(`${ROOT}/fleet.json`).json()) as
      { slots?: Record<string, { model?: string | null; effort?: string | null }> }).slots?.["2"];
    if (mdPersisted?.model === "claude-sonnet-5[1m]" && mdPersisted.effort === "high") break;
    await Bun.sleep(50);
  }
  check("the rewritten pair is persisted to fleet.json — what the next boot's heal spawns from",
    mdPersisted?.model === "claude-sonnet-5[1m]" && mdPersisted.effort === "high", JSON.stringify(mdPersisted));
  let mdAudit: { event?: string; slot?: number; detail?: string } | null | undefined;
  for (let i = 0; i < 40 && !mdAudit; i++) { // appendEvent is fire-and-forget — poll the trail
    mdAudit = (await Bun.file(`${ROOT}/audit.jsonl`).text()).split("\n").filter(Boolean)
      .map((l) => { try { return JSON.parse(l) as { event?: string; slot?: number; detail?: string }; } catch { return null; } })
      .filter((r) => r?.event === "slot_model" && r.slot === 2).at(-1);
    if (!mdAudit) await Bun.sleep(50);
  }
  check("the rewrite is trailed as slot_model with the resulting pair",
    mdAudit?.detail === "model=claude-sonnet-5[1m] effort=high", JSON.stringify(mdAudit ?? null));
  // the four rejections, each leaving the record exactly as it was
  const mdBadModel = await post("/api/slots/2/model", { model: "bad model'; echo" });
  check("an invalid model is 400 and names the charset", mdBadModel.status === 400
    && /bad model/.test(((await mdBadModel.json()) as { error?: string }).error ?? ""), String(mdBadModel.status));
  const mdBadEffort = await post("/api/slots/2/model", { effort: "turbo" });
  check("an unknown effort is 400 and names the adapter's levels", mdBadEffort.status === 400
    && ((await mdBadEffort.json()) as { error?: string }).error === "bad effort (one of: low, medium, high, xhigh, max)",
    String(mdBadEffort.status));
  const mdEmpty = await post("/api/slots/2/model", {});
  check("a body naming neither field is 400 — nothing to change is not a change", mdEmpty.status === 400);
  const mdInactive = await post("/api/slots/4/model", { model: "claude-opus-5" });
  check("an inactive slot is 400", mdInactive.status === 400);
  const mdStewWrite = await fetch(`${BASE}/api/slots/2/model`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${stewTok}` },
    body: JSON.stringify({ model: "claude-opus-5" }),
  });
  check("the steward token cannot reach the model route (403, out of scope)", mdStewWrite.status === 403, String(mdStewWrite.status));
  const selfTok2 = ((await Bun.file(`${ROOT}/fleet.json`).json()) as
    { slots?: Record<string, { selfToken?: string }> }).slots?.["2"]?.selfToken ?? "";
  const mdSelfWrite = await fetch(`${BASE}/api/slots/2/model`, {
    method: "POST", headers: { "content-type": "application/json", "x-fleet-self-token": selfTok2 },
    body: JSON.stringify({ model: "claude-opus-5" }),
  });
  check("a slot's own self-token cannot reach the model route (401 — it is not an owner credential)",
    /^[0-9a-f]{32}$/.test(selfTok2) && mdSelfWrite.status === 401, `tok=${selfTok2.length} ${mdSelfWrite.status}`);
  const mdAfter = await modelRowOf(2);
  check("...and none of the six rejections touched the stored pair",
    mdAfter?.model === "claude-sonnet-5[1m]" && mdAfter.effort === "high", JSON.stringify(mdAfter));
  // a present null clears — model back to the fleet default, effort back to "no flag" — and the
  // owner poll then OMITS effort (the data-saver rule for null per-slot fields)
  const mdClear = await post("/api/slots/2/model", { model: null, effort: "" });
  const mdCleared = await modelRowOf(2);
  check("explicit null/\"\" clears model and effort back to the fleet defaults",
    mdClear.ok && mdCleared?.model === null && mdCleared.effort === undefined, `${mdClear.status} ${JSON.stringify(mdCleared)}`);
  if (modelBefore?.model || modelBefore?.effort)
    await post("/api/slots/2/model", { model: modelBefore.model, effort: modelBefore.effort ?? null });

  const footerModel = "Opus 5 (1M context)";
  const plainReady = await plantScreen(1, "model sensor fixture without a footer", "paneModel no-match");
  const footerReady = await plantScreen(2,
    `model sensor fixture\n  main  |  ctx [##--------] 25%  |  ${footerModel}   /rc`, "paneModel sensor");
  await restartSrv();
  let footerRow: ModelRow | undefined;
  let plainRow: ModelRow | undefined;
  for (let i = 0; i < 160; i++) {
    footerRow = await modelRowOf(2);
    plainRow = await modelRowOf(1);
    if (footerRow?.paneModel === footerModel) break;
    await Bun.sleep(50);
  }
  // BREAKS IF: the footer capture group changes, or a no-match is serialized as paneModel:null.
  check("paneModel sensor: a planted Claude footer yields its model and a screen without the pattern omits the field",
    footerReady && plainReady && footerRow?.paneModel === footerModel && !!plainRow && !("paneModel" in plainRow),
    JSON.stringify({ footer: footerRow?.paneModel ?? null, plainHasKey: plainRow ? "paneModel" in plainRow : null }));

  const paneBeforeDefault = (await tmuxOut("capture-pane", "-p", "-t", "s1")).out;
  const noPush = await post("/api/slots/1/model", { model: "claude-sonnet-5" });
  const paneAfterDefault = (await tmuxOut("capture-pane", "-p", "-t", "s1")).out;
  // BREAKS IF: the absent push field enters the sendText branch.
  check("model push default: a model rewrite without push leaves the pane byte-for-byte untouched",
    noPush.ok && paneAfterDefault === paneBeforeDefault,
    JSON.stringify({ status: noPush.status, before: paneBeforeDefault.length, after: paneAfterDefault.length }));

  const pushed = await post("/api/slots/1/model", { model: "claude-opus-5", push: true });
  const pushedBody = await pushed.json() as { ok?: boolean; modelPushedAt?: number; error?: string };
  let pushedPane = "";
  let pushedRow: ModelRow | undefined;
  let pushedAudit: { event?: string; slot?: number; detail?: string } | null | undefined;
  for (let i = 0; i < 80; i++) {
    pushedPane = (await tmuxOut("capture-pane", "-p", "-t", "s1")).out;
    pushedRow = await modelRowOf(1);
    pushedAudit = (await Bun.file(`${ROOT}/audit.jsonl`).text()).split("\n").filter(Boolean)
      .map((l) => { try { return JSON.parse(l) as { event?: string; slot?: number; detail?: string }; } catch { return null; } })
      .filter((r) => r?.event === "slot_model_push" && r.slot === 1).at(-1);
    if (pushedPane.split("\n").filter((l) => l.trim() === "/model claude-opus-5").length === 1
      && pushedRow?.modelPushedAt === pushedBody.modelPushedAt && pushedAudit) break;
    await Bun.sleep(50);
  }
  // BREAKS IF: push:true types zero/two model lines, stamps before/after a different instant, or omits its audit.
  check("model push: push:true types exactly one /model line and stamps modelPushedAt with slot_model_push",
    pushed.ok && typeof pushedBody.modelPushedAt === "number"
      && pushedPane.split("\n").filter((l) => l.trim() === "/model claude-opus-5").length === 1
      && pushedRow?.modelPushedAt === pushedBody.modelPushedAt
      && pushedAudit?.detail === "model=claude-opus-5",
    JSON.stringify({ status: pushed.status, body: pushedBody, row: pushedRow, audit: pushedAudit ?? null }));

  const composerMode = process.env.FLEET_E2E_COMPOSER_MODE ?? "";
  if (composerMode) writeFileSync(composerMode, "normal\n");
  const heldOpen = await post("/api/slots/3/open", { cwd: "~", harness: "pi", model: "claude-bridge/claude-haiku-4-5" });
  let heldAgent: string | null | undefined;
  for (let i = 0; i < 80 && heldAgent !== "alive"; i++) {
    heldAgent = (await modelRowOf(3))?.agent;
    if (heldAgent !== "alive") await Bun.sleep(50);
  }
  const draft = "owner-draft-model-push";
  const draftTyped = await tmuxOut("send-keys", "-l", "-t", "s3", draft);
  let draftPane = "";
  for (let i = 0; i < 80 && !draftPane.includes(draft); i++) {
    draftPane = (await tmuxOut("capture-pane", "-p", "-t", "s3")).out;
    if (!draftPane.includes(draft)) await Bun.sleep(50);
  }
  const pushAuditsBefore = (await Bun.file(`${ROOT}/audit.jsonl`).text()).split("\n")
    .filter((l) => l.includes('"event":"slot_model_push"') && l.includes('"slot":3')).length;
  const heldPush = await post("/api/slots/3/model", { model: "claude-bridge/claude-haiku-4-5", push: true });
  const heldBody = await heldPush.json() as { error?: string };
  const heldRow = await modelRowOf(3);
  const heldPane = (await tmuxOut("capture-pane", "-p", "-t", "s3")).out;
  const pushAuditsAfter = (await Bun.file(`${ROOT}/audit.jsonl`).text()).split("\n")
    .filter((l) => l.includes('"event":"slot_model_push"') && l.includes('"slot":3')).length;
  // BREAKS IF: an occupied composer is bypassed, modelPushedAt is stamped before delivery, or a held push is audited as sent.
  check("model push held: an occupied composer is 409 by name and stamps or types nothing",
    composerMode !== "" && heldOpen.ok && heldAgent === "alive" && draftTyped.code === 0 && draftPane.includes(draft)
      && heldPush.status === 409 && heldBody.error?.includes("model push held (composer occupied") === true
      && heldRow?.modelPushedAt === undefined && !heldPane.includes("/model ") && pushAuditsAfter === pushAuditsBefore,
    JSON.stringify({ mode: composerMode !== "", open: heldOpen.status, agent: heldAgent, draft: draftPane.includes(draft),
      status: heldPush.status, error: heldBody.error, stamp: heldRow?.modelPushedAt, audits: [pushAuditsBefore, pushAuditsAfter] }));

  // --- THE PARKED SEND (server.ts): the same draft-holding pane, asked to WAIT instead of refuse.
  // The stand-in pi appends every SUBMITTED turn to `<state>.turns`, so "delivered exactly once" and
  // "never delivered" are read off what the agent received, not off the server's own receipt.
  {
    type Rcpt = { sendId?: string; delivery?: string; reason?: string;
      parked?: { draftChars?: number }; receiver?: { slot?: number; openedAt?: number } };
    type Parked = { count: number; draftChars: number; since: number };
    const statePath = process.env.FLEET_E2E_COMPOSER_STATE ?? "";
    const turnsOf = (): string => { try { return readFileSync(`${statePath}.turns`, "utf8"); } catch { return ""; } };
    const countIn = (hay: string, needle: string): number => hay.split(needle).length - 1;
    const parkedOf = async (slot: number): Promise<Parked | undefined> =>
      ((await (await get("/api/sessions")).json()) as { slots: { id: number; parkedSend?: Parked }[] })
        .slots.find((x) => x.id === slot)?.parkedSend;
    const receiptOf = async (id: string): Promise<Rcpt | undefined> =>
      ((await (await get(`/send/${id}`)).json()) as { receipt?: Rcpt }).receipt;
    const typeDraft = async (text: string): Promise<boolean> => {
      await tmuxOut("send-keys", "-l", "-t", "s3", text);
      for (let i = 0; i < 80; i++) {
        if ((await tmuxOut("capture-pane", "-p", "-t", "s3")).out.includes(text)) return true;
        await Bun.sleep(50);
      }
      return false;
    };
    const clearDraft = async (text: string): Promise<void> => {
      for (let i = 0; i < [...text].length; i++) await tmuxOut("send-keys", "-t", "s3", "BSpace");
    };
    // its own check: a fixture that could not be built must fail as ITSELF, never as the route
    check("parked-send fixture: slot 3 runs the stand-in pi with the owner draft in its composer and a turns ledger path",
      statePath !== "" && heldAgent === "alive" && draftPane.includes(draft),
      JSON.stringify({ statePath: statePath !== "", agent: heldAgent, draft: draftPane.includes(draft) }));

    // (2) WITHOUT the field: the 409 sentence is the pre-feature one, byte for byte, and nothing parks.
    // Mutation caught: parking by default, or rewording the refusal.
    const plain = await post("/send", { slot: 3, text: "parked-probe-plain", submit: true });
    const plainBody = await plain.json() as { error?: string; receipt?: Rcpt };
    check("parked send: without whenFree an occupied composer is still 409 `composer occupied (N chars) — nothing typed` and parks nothing",
      plain.status === 409 && plainBody.error === `composer occupied (${draft.length} chars) — nothing typed`
        && plainBody.receipt?.delivery === "refused" && (await parkedOf(3)) === undefined,
      JSON.stringify({ status: plain.status, body: plainBody }));
    const badFlag = await post("/send", { slot: 3, text: "parked-probe-bad", whenFree: "yes" });
    const badTtl = await post("/send", { slot: 3, text: "parked-probe-bad", whenFree: true, whenFreeTtlSec: 99_999 });
    check("parked send: a non-boolean whenFree and an out-of-range whenFreeTtlSec are 400 and park nothing",
      badFlag.status === 400 && badTtl.status === 400 && (await parkedOf(3)) === undefined,
      `${badFlag.status} ${badTtl.status}`);

    // (1) PARK three, then the cap refuses the fourth
    const texts = ["parked-probe-one", "parked-probe-two", "parked-probe-three"];
    const parked: { status: number; receipt?: Rcpt }[] = [];
    for (const text of texts) {
      const r = await post("/send", { slot: 3, text, submit: true, whenFree: true });
      parked.push({ status: r.status, receipt: ((await r.json()) as { receipt?: Rcpt }).receipt });
    }
    const board = await parkedOf(3);
    check("parked send: whenFree on an occupied composer answers 202 delivery:parked with the blocking draft's size, and the board carries it",
      parked.every((p) => p.status === 202 && p.receipt?.delivery === "parked"
        && p.receipt.parked?.draftChars === draft.length && p.receipt.receiver?.slot === 3 && !!p.receipt.sendId)
        && board?.count === 3 && board.draftChars === draft.length,
      JSON.stringify({ parked, board }));
    const over = await post("/send", { slot: 3, text: "parked-probe-over", submit: true, whenFree: true });
    const overBody = await over.json() as { error?: string; receipt?: Rcpt };
    check("parked send: the per-slot cap (3) refuses a fourth with 409 delivery:refused and says why",
      over.status === 409 && overBody.receipt?.delivery === "refused"
        && overBody.error?.includes("not parked") === true && overBody.error.includes("cap 3")
        && (await parkedOf(3))?.count === 3,
      JSON.stringify({ status: over.status, body: overBody }));

    // (4) several probes later: nothing typed, and the draft is exactly where the owner left it.
    // Mutation caught: clearing/stashing the draft, or pasting past it.
    await Bun.sleep(2000);
    const heldTurns = turnsOf();
    let heldState = "";
    try { heldState = readFileSync(statePath, "utf8"); } catch { heldState = ""; }
    const heldPaneNow = (await tmuxOut("capture-pane", "-p", "-t", "s3")).out;
    check("parked send: while the draft stands nothing is typed and the draft is neither cleared nor extended",
      texts.every((t) => !heldTurns.includes(t) && !heldPaneNow.includes(t)) && heldState.endsWith(draft)
        && heldPaneNow.includes(draft),
      JSON.stringify({ state: heldState.slice(-80), turnsTail: heldTurns.slice(-120) }));

    // the owner clears the field: every parked text arrives exactly once, in order
    await clearDraft(draft);
    const ids = parked.map((p) => p.receipt?.sendId ?? "");
    let settled: (Rcpt | undefined)[] = [];
    for (let i = 0; i < 200; i++) {
      settled = await Promise.all(ids.map(receiptOf));
      if (settled.every((r) => r?.delivery && r.delivery !== "parked")) break;
      await Bun.sleep(100);
    }
    await Bun.sleep(1000); // one more backoff window: a second paste would land inside it
    const turns = turnsOf();
    const at = texts.map((t) => turns.indexOf(t));
    check("parked send: the cleared composer gets each parked text exactly once, in park order, and the draft is never submitted",
      settled.every((r) => r?.delivery === "delivered") && texts.every((t) => countIn(turns, t) === 1)
        && at[0] < at[1] && at[1] < at[2] && countIn(turns, draft) === 0
        && !turns.includes("parked-probe-over") && !turns.includes("parked-probe-plain")
        && (await parkedOf(3)) === undefined,
      JSON.stringify({ settled, counts: texts.map((t) => countIn(turns, t)), at }));

    // OCCUPANT PIN: a send parked for one occupant is dropped, never typed, when the slot is re-opened
    const draft2 = "owner-draft-recycle";
    const typed2 = await typeDraft(draft2);
    const pinRes = await post("/send", { slot: 3, text: "parked-probe-recycled", submit: true, whenFree: true });
    const pinBody = await pinRes.json() as { receipt?: Rcpt };
    const reopen = await post("/api/slots/3/open", { cwd: "~", harness: "pi", model: "claude-bridge/claude-haiku-4-5" });
    let pinReceipt: Rcpt | undefined;
    for (let i = 0; i < 80; i++) {
      pinReceipt = await receiptOf(pinBody.receipt?.sendId ?? "");
      if (pinReceipt?.delivery === "dropped") break;
      await Bun.sleep(100);
    }
    await Bun.sleep(1500); // the new occupant's composer is empty: a leaked delivery would land now
    check("parked send: a re-opened slot never receives the previous occupant's parked text, and the receipt says why",
      typed2 && pinRes.status === 202 && reopen.ok && pinReceipt?.delivery === "dropped"
        && pinReceipt.reason?.includes("occupant") === true && !turnsOf().includes("parked-probe-recycled")
        && (await parkedOf(3)) === undefined,
      JSON.stringify({ typed2, status: pinRes.status, reopen: reopen.status, pinReceipt }));

    // TIME CAP: a parked send outlives its whenFreeTtlSec only as a dropped receipt
    let agent3: string | null | undefined;
    for (let i = 0; i < 80 && agent3 !== "alive"; i++) {
      agent3 = (await modelRowOf(3))?.agent;
      if (agent3 !== "alive") await Bun.sleep(50);
    }
    const draft3 = "owner-draft-expiry";
    const typed3 = await typeDraft(draft3);
    const ttlRes = await post("/send", { slot: 3, text: "parked-probe-expired", submit: true, whenFree: true, whenFreeTtlSec: 1 });
    const ttlBody = await ttlRes.json() as { receipt?: Rcpt };
    let ttlReceipt: Rcpt | undefined;
    for (let i = 0; i < 60; i++) {
      ttlReceipt = await receiptOf(ttlBody.receipt?.sendId ?? "");
      if (ttlReceipt?.delivery === "dropped") break;
      await Bun.sleep(100);
    }
    await clearDraft(draft3);
    await Bun.sleep(1500);
    check("parked send: the time cap drops a send whose composer stayed occupied, and it is never typed afterwards",
      agent3 === "alive" && typed3 && ttlRes.status === 202 && ttlReceipt?.delivery === "dropped"
        && ttlReceipt.reason?.startsWith("expired") === true && !turnsOf().includes("parked-probe-expired"),
      JSON.stringify({ agent3, typed3, status: ttlRes.status, ttlReceipt }));
  }
  await post("/api/slots/3/kill", {});
  await post("/api/slots/1/open", { cwd: "~/claude-fleet" });
  await post("/api/slots/2/open", { cwd: "~" });
  if (modelBefore) await post("/api/slots/2/rename", { label: modelBefore.label ?? "" });

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
  // Colored fixture, planted BEFORE the reseed connect: the seed is a capture of the pane, so
  // the pane has to hold color for the seed to be able to carry any. Red is written as an
  // explicit SGR pair so the assertion below is about tmux's re-encoding, not about our printf.
  await tmuxOut("send-keys", "-t", "s2", "printf '\\033[31mCOLORMARK-RED\\033[0m\\n'", "Enter");
  for (let i = 0; i < 60; i++) {
    if ((await tmuxOut("capture-pane", "-t", "s2", "-p")).out.includes("COLORMARK-RED")) break;
    await Bun.sleep(100);
  }
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
  // Color survives the reseed. This was deliberately given up once: the seed took a plain capture
  // because an escape-preserving one was believed to bake styled runs in as absolute-column cursor
  // jumps at the ORIGINAL width, which would garble a narrower client. Measured false on tmux 3.6a
  // (2026-08-05): `-e` output with SGR removed is byte-identical to the plain capture. These two
  // checks are the trade that replaces the sacrifice — the FIRST says history is colored, the
  // SECOND says the feared escape class is absent. A tmux that ever emits one goes red HERE,
  // loudly, instead of silently staggering every line of somebody's scrollback.
  const sgr = /\x1b\[[0-9;]*m/.test(seedText);
  // every CSI final byte that MOVES the cursor: @ABCDEFGHST, `abde, plus H/f absolute positioning.
  // SGR ('m') is excluded by construction — that is the one we want. ONE regex for the live
  // probe and the synthetic fixtures below, so the class can never drift from what was proven.
  const MOTION_RE = /\x1b\[[0-9;]*[@A-HJKLMPSTXZ`abdef]/g;
  // the detector itself is proven against synthetic escapes it has never seen from tmux: CSI f
  // (HVP) is CUP's exact twin and was MISSING from the class while the comment claimed it
  // (2026-08-05) — a detector never shown to catch its class only documents hope. The SGR
  // fixture is the negative control (the one final byte the class must NOT match).
  check("motion detector: catches CUP (H) and its twin HVP (f), ignores SGR (m)",
    ("x\x1b[5;10Hy".match(MOTION_RE) ?? []).length === 1
    && ("x\x1b[5;10fy".match(MOTION_RE) ?? []).length === 1
    && ("x\x1b[31my".match(MOTION_RE) ?? []).length === 0, "");
  const motion = seedText.match(MOTION_RE) ?? [];
  check("reseed keeps the pane's color (the seed is an escape-preserving capture)",
    sgr && seedText.includes("COLORMARK-RED"), `sgr=${sgr} mark=${seedText.includes("COLORMARK-RED")}`);
  check("reseed carries NO cursor-motion escape — the class that would garble a narrower client",
    motion.length === 0, JSON.stringify(motion.slice(0, 5)));
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
    const rawName = readdirSync(`${ROOT}/streams`).find((name) => name.startsWith("s2-") && name.endsWith(".raw"));
    const rawPath = rawName ? `${ROOT}/streams/${rawName}` : "";
    check("the active slot stream is occupant-specific rather than the reusable s2.raw name",
      !!rawName && !readdirSync(`${ROOT}/streams`).includes("s2.raw"), rawName ?? "missing");
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
  // checks in e2e/outcomes.ts: this suite has no DOM harness, so the DECISION is imported from
  // src/pollplan.ts and run for real, while the WIRING around it is asserted by shape. What
  // stays unproved here is that the browser honours the plan — that was verified by hand
  // against a throwaway server (see the commit); what these checks defend is the contract.
  // The scratch copy carries server.ts + public/ but not src/ — the link back to the checkout
  // is the node_modules symlink, so the real source is its realpath's parent (as in outcomes).
  let cliSrc: string | null = null;
  let indexSrc: string | null = null;
  let cliSrcError = "", indexSrcError = "";
  const sourceRoot = dirname(realpathSync(`${ROOT}/node_modules`));
  try {
    cliSrc = readFileSync(`${sourceRoot}/src/client.ts`, "utf8");
  } catch (e) { cliSrcError = e instanceof Error ? e.message : String(e); }
  try {
    indexSrc = readFileSync(`${sourceRoot}/public/index.html`, "utf8");
  } catch (e) { indexSrcError = e instanceof Error ? e.message : String(e); }
  check("precondition: node_modules exposes src/client.ts for slot client checks",
    cliSrc !== null, cliSrcError);
  check("precondition: node_modules exposes public/index.html for slot presentation checks",
    indexSrc !== null, indexSrcError);
  if (cliSrc === null || indexSrc === null) return;
  // what is asserted about client.ts is that it SHIPS the module under test — a plan re-inlined
  // there would leave the checks below measuring code the bundle never runs
  check("client: the poll pump takes pollPlan from src/pollplan.ts, the module under test",
    /import \{ pollPlan \} from "\.\/pollplan"/.test(cliSrc) && /const plan = \(\) => pollPlan\(document\.hidden, dataSaver\)/.test(cliSrc),
    "the pollplan import + plan() in src/client.ts");
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

  // --- the board's SECTION ORDER (§F4, briefs/ui-next-level-2026-08-06.md). The owner named
  // this order explicitly; nothing else in the suite would notice a re-sort undoing it. Asserted
  // as a RELATIVE order over renderBoard's own pushes, so a later section inserted between two
  // of them (F5's file explorer) does not trip it — only a reordering does. This suite has no
  // DOM, so the source is the evidence; the rendered result was checked by hand (see the commit).
  const boardSrc = cliSrc.slice(cliSrc.indexOf("async function renderBoard()"), cliSrc.indexOf("$(\"boardclose\")"));
  const pushOrder = [...boardSrc.matchAll(/nodes\.push\((\w+)\)/g)].map((m) => m[1]);
  const at = (name: string) => pushOrder.indexOf(name);
  // `gsec` (the guest-console panel) left this chain with the console itself, 2026-08-08 —
  // the order it belonged to is otherwise unchanged, and its absence is asserted rather than
  // merely dropped, so a re-added machine-level section has to state where it goes.
  check("client: the board renders in the owner's order — identity → to-land → commits → files → lanes → agents → outline",
    at("idsec") >= 0 && at("idsec") < at("work") && at("work") < at("csec") && at("csec") < at("fsec")
    && at("fsec") < at("sec") && at("sec") < at("asec") && at("asec") < at("psec")
    && at("gsec") === -1,
    JSON.stringify(pushOrder));
  check("client: the advisory agents group is folded on every load, and the fold is not persisted",
    /^let agentsOpen = false;$/m.test(cliSrc) && /agentsOpen = !agentsOpen/.test(cliSrc)
    && !/fleet\.agents/.test(cliSrc), "agentsOpen in src/client.ts");
  // folding must not silently retire the ③ reviewer — the button and its POST stay reachable
  check("client: folding agents away keeps both agent actions — nothing was deleted",
    /"🔍 review"/.test(boardSrc) && /"📋 summarize"/.test(boardSrc)
    && /post\(`\/api\/slots\/\$\{slot\}\/review`/.test(boardSrc), "the agents group in renderBoard");

  // --- stable lane anchor creation. Slots 3/4 are deliberately real same-repo mains: the first
  // request names slot 3 exactly; the generic route chooses the last-active eligible main once.
  // Slot 4 runs from a subdirectory, proving the join is through git's canonical toplevel and not
  // a cwd string. Every temporary lane is landed before this family returns. ---
  check("lane-anchor fixture has the throwaway git repository", !!REPO, REPO || "FLEET_E2E_REPO absent");
  if (REPO) {
    type AnchorWireSlot = {
      id: number; cwd: string | null; openedAt?: number; repo?: string | null; lastOutput: number;
      worktree?: { repo: string; branch: string; anchor?: LaneAnchor } | null;
    };
    const ownerSlots = async (): Promise<AnchorWireSlot[]> =>
      ((await (await get("/api/sessions")).json()) as { slots: AnchorWireSlot[] }).slots;
    const sub = `${REPO}/anchor-subdir`;
    mkdirSync(sub, { recursive: true });
    const a3 = await post("/api/slots/3/open", { cwd: REPO });
    const a4 = await post("/api/slots/4/open", { cwd: sub });
    check("lane-anchor fixture opens two same-repo main sessions", a3.ok && a4.ok,
      `${a3.status}/${a4.status}`);
    let mains = await ownerSlots();
    const m3 = mains.find((s) => s.id === 3);
    const p3 = normalizeLaneAnchor({ slot: 3, openedAt: m3?.openedAt });
    const canonicalRepo = realpathSync(REPO);
    for (let i = 0; i < 160 && mains.find((s) => s.id === 4)?.repo !== canonicalRepo; i++) {
      await Bun.sleep(100);
      mains = await ownerSlots();
    }
    check("owner poll carries each main's openedAt and canonical repo identity (subdirectory included)",
      !!p3 && mains.find((s) => s.id === 3)?.repo === canonicalRepo
        && mains.find((s) => s.id === 4)?.repo === canonicalRepo,
      JSON.stringify(mains.filter((s) => s.id === 3 || s.id === 4)
        .map((s) => ({ id: s.id, openedAt: s.openedAt, repo: s.repo }))));

    const malformedParent = await post("/api/lanes", { repo: REPO, parent: { slot: 3 } });
    check("an explicit malformed parent fails as itself instead of taking the fallback",
      malformedParent.status === 400 && (await malformedParent.text()).includes("parent must be"));
    const recycledParent = await post("/api/lanes", {
      repo: REPO, parent: { slot: 3, openedAt: (p3?.openedAt ?? 1) - 1 },
    });
    check("an explicit recycled parent fails clearly instead of choosing the other main",
      recycledParent.status === 400 && (await recycledParent.text()).includes("recycled"));
    const m1 = mains.find((s) => s.id === 1);
    const crossParent = await post("/api/lanes", {
      repo: REPO, parent: { slot: 1, openedAt: m1?.openedAt ?? 1 },
    });
    check("an explicit cross-repo/non-repo parent fails clearly instead of choosing a same-repo main",
      crossParent.status === 400 && /repository|active main/.test(await crossParent.text()));

    const explicitRes = await post("/api/lanes", {
      repo: REPO, parent: p3 ?? { slot: 3, openedAt: 0 },
    });
    const explicit = (await explicitRes.json()) as { slot?: number; cwd?: string; branch?: string; error?: string };
    check("explicit same-main quick-lane identity creates a lane", explicitRes.ok && !!explicit.slot,
      JSON.stringify(explicit));
    const explicitPoll = (await ownerSlots()).find((s) => s.id === explicit.slot);
    check("explicit lane anchor is returned by the owner poll with the exact slot+openedAt pair",
      explicitPoll?.worktree?.anchor?.slot === 3
        && explicitPoll.worktree.anchor.openedAt === p3?.openedAt,
      JSON.stringify(explicitPoll?.worktree));
    let explicitPersisted: LaneAnchor | null = null;
    for (let i = 0; i < 40; i++) {
      try {
        const state = (await Bun.file(`${ROOT}/fleet.json`).json()) as
          { slots?: Record<string, { worktree?: { anchor?: unknown } }> };
        explicitPersisted = normalizeLaneAnchor(state.slots?.[String(explicit.slot)]?.worktree?.anchor);
      } catch { explicitPersisted = null; } // saveState rename may be between generations
      if (explicitPersisted) break;
      await Bun.sleep(50);
    }
    check("explicit lane anchor is persisted in fleet.json, not reconstructed at render time",
      explicitPersisted?.slot === 3 && explicitPersisted.openedAt === p3?.openedAt,
      JSON.stringify(explicitPersisted));
    const cleanLane = async (lane: { slot?: number; cwd?: string }): Promise<boolean> => {
      if (!lane.slot) return false;
      const landed = await post(`/api/slots/${lane.slot}/land`, {});
      if (landed.ok) return true;
      await post(`/api/slots/${lane.slot}/kill`, {});
      if (lane.cwd) await post("/api/worktrees/remove", { repo: REPO, path: lane.cwd });
      return false;
    };
    check("explicit lane fixture cleans up through the normal land path", await cleanLane(explicit));

    // Make slot 4 observably newest only AFTER both mains have settled; the fallback snapshot must
    // choose it even though slot 3 is lower. Poll the server's own activity fact — no fixed sleep.
    let newest4 = false;
    for (let i = 0; i < 30 && !newest4; i++) {
      await tmuxOut("send-keys", "-t", "s4", `printf 'ANCHOR-ACT-${i}\\n'`, "Enter");
      await Bun.sleep(120);
      const rows = await ownerSlots();
      newest4 = (rows.find((s) => s.id === 4)?.lastOutput ?? 0)
        > (rows.find((s) => s.id === 3)?.lastOutput ?? 0);
    }
    check("implicit anchor fixture makes the subdirectory main the most recently active one", newest4);
    const implicitRes = await post("/api/slots/5/open-worktree", {
      repo: REPO, branch: "e2e-anchor-implicit",
    });
    const implicit = (await implicitRes.json()) as { cwd?: string; branch?: string; error?: string };
    check("generic fresh-lane creation succeeds without an explicit parent", implicitRes.ok,
      JSON.stringify(implicit));
    const implicitPoll = (await ownerSlots()).find((s) => s.id === 5);
    check("implicit two-main choice is persisted once and associates a subdirectory main canonically",
      implicitPoll?.worktree?.anchor?.slot === 4
        && implicitPoll.worktree.anchor.openedAt === mains.find((s) => s.id === 4)?.openedAt,
      JSON.stringify(implicitPoll?.worktree));
    let implicitPersisted: LaneAnchor | null = null;
    for (let i = 0; i < 40; i++) {
      try {
        const state = (await Bun.file(`${ROOT}/fleet.json`).json()) as
          { slots?: Record<string, { worktree?: { anchor?: unknown } }> };
        implicitPersisted = normalizeLaneAnchor(state.slots?.["5"]?.worktree?.anchor);
      } catch { implicitPersisted = null; }
      if (implicitPersisted) break;
      await Bun.sleep(50);
    }
    check("implicit anchor is a durable identity, not a live activity lookup",
      implicitPersisted?.slot === 4
        && implicitPersisted.openedAt === mains.find((s) => s.id === 4)?.openedAt,
      JSON.stringify(implicitPersisted));
    check("implicit lane fixture cleans up through the normal land path",
      await cleanLane({ slot: 5, cwd: implicit.cwd }));
    await post("/api/slots/3/kill", {});
    await post("/api/slots/4/kill", {});
    rmSync(sub, { recursive: true, force: true });
  }

  // --- (§F3) Lane membership is a pure identity join. lastOutput still chooses the server's
  // fallback ONCE, but stacksOf never reads it to assign ownership. The cut-out runs the actual
  // client function without a DOM; an unliftable helper fails as its own probe. ---
  {
    const cut = (from: string, to: string): string => {
      const a = cliSrc.indexOf(from), b = cliSrc.indexOf(to);
      return a >= 0 && b > a ? cliSrc.slice(a, b) : "";
    };
    const refSrc = cut("function laneBranchRefs(", "// --- project colour");
    type RefInput = { id: number; branch: string };
    let laneBranchRefs: ((lanes: readonly RefInput[]) => Map<number, string>) | null = null;
    try {
      laneBranchRefs = new Function(new Bun.Transpiler({ loader: "ts" }).transformSync(refSrc)
        + "\nreturn laneBranchRefs;")() as (lanes: readonly RefInput[]) => Map<number, string>;
    } catch { laneBranchRefs = null; }
    check("probe: lane branch references are a liftable DOM-free pure helper",
      !!laneBranchRefs && !/document|HTMLElement|localStorage|Math\.random/.test(refSrc),
      refSrc.slice(0, 90) || "no laneBranchRefs block");

    const four = laneBranchRefs?.([
      { id: 1, branch: "fleet/task-aa01" }, { id: 2, branch: "fleet/task-bb02" },
    ]);
    check("lane refs use exactly four trailing branch characters when those are already unique",
      four?.get(1) === "aa01" && four.get(2) === "bb02", JSON.stringify([...four?.entries() ?? []]));

    const pairFx: RefInput[] = [
      { id: 11, branch: "fleet/alphaX1234" }, { id: 12, branch: "fleet/betaY1234" },
    ];
    const pair = laneBranchRefs?.(pairFx);
    check("a shared last four lengthens only to the shortest unique suffix",
      pair?.get(11) === "X1234" && pair.get(12) === "Y1234", JSON.stringify([...pair?.entries() ?? []]));

    const three = laneBranchRefs?.([
      { id: 21, branch: "fleet/oneQ7777" }, { id: 22, branch: "fleet/twoR7777" },
      { id: 23, branch: "fleet/threeS7777" },
    ]);
    check("three or more colliding lane refs separate together without over-lengthening",
      three?.get(21) === "Q7777" && three.get(22) === "R7777" && three.get(23) === "S7777",
      JSON.stringify([...three?.entries() ?? []]));

    const short = laneBranchRefs?.([
      { id: 31, branch: "abc" }, { id: 32, branch: "wxyz" },
      { id: 33, branch: "branch" }, { id: 34, branch: "xbranch" },
    ]);
    check("short branches stay honest full strings and distinct nested full branches still separate",
      short?.get(31) === "abc" && short.get(32) === "wxyz"
        && short.get(33) === "branch" && short.get(34) === "xbranch",
      JSON.stringify([...short?.entries() ?? []]));

    const pairReverse = laneBranchRefs?.([...pairFx].reverse());
    check("lane refs are stable when active-lane input order reverses",
      pairFx.every((lane) => pair?.get(lane.id) === pairReverse?.get(lane.id)),
      JSON.stringify({ forward: [...pair?.entries() ?? []], reverse: [...pairReverse?.entries() ?? []] }));

    const acrossRepos = [
      { repo: "/repo/one", stack: 1, id: 41, branch: "fleet/repo-one-A9000" },
      { repo: "/repo/two", stack: 2, id: 42, branch: "fleet/repo-two-B9000" },
      { repo: "/repo/one", stack: 3, id: 43, branch: "fleet/repo-one-C8000" },
    ];
    const globalRefs = laneBranchRefs?.(acrossRepos.map(({ id, branch }) => ({ id, branch })));
    check("lane refs are globally unique across repositories and stacks, not computed per group",
      !!globalRefs && new Set(globalRefs.values()).size === acrossRepos.length
        && globalRefs.get(41) === "A9000" && globalRefs.get(42) === "B9000",
      JSON.stringify([...globalRefs?.entries() ?? []]));

    const deps = cut("const isActive = ", "// A lane's spoken identity")
      + cut("function projectOf(", "// Eight hues");
    const stackSrc = cut("function stacksOf()", "function startRename(");
    type FxSlot = {
      id: number; cwd: string | null; lastOutput: number; openedAt?: number; repo?: string | null;
      worktree?: { repo: string; branch: string; anchor?: LaneAnchor } | null;
    };
    type FxStack = {
      key: string; foldKey: string; anchor: FxSlot | null; lanes: FxSlot[]; at: number;
    };
    let stacksOf: ((f: FxSlot[]) => FxStack[]) | null = null;
    try {
      const lifted = new Function("fleet", "normalizeLaneAnchor",
        new Bun.Transpiler({ loader: "ts" }).transformSync(deps + stackSrc) + "\nreturn stacksOf();") as
        (f: FxSlot[], n: typeof normalizeLaneAnchor) => FxStack[];
      stacksOf = (f) => lifted(f, normalizeLaneAnchor);
    } catch { stacksOf = null; }

    const FX_REPO = "/repo/one", OTHER = "/repo/two";
    const original: FxSlot[] = [
      { id: 1, cwd: FX_REPO, repo: FX_REPO, openedAt: 100, lastOutput: 10 },
      { id: 2, cwd: `${FX_REPO}/wt/a`, repo: FX_REPO, openedAt: 200, lastOutput: 500,
        worktree: { repo: FX_REPO, branch: "fleet/a", anchor: { slot: 1, openedAt: 100 } } },
      { id: 3, cwd: FX_REPO, repo: FX_REPO, openedAt: 300, lastOutput: 9000 },
    ];
    let first: FxStack | undefined, reversed: FxStack | undefined;
    try {
      first = stacksOf?.(original).find((g) => g.anchor?.id === 1);
      reversed = stacksOf?.([...original].reverse().map((s) => s.id === 3
        ? { ...s, lastOutput: 999_999 } : s)).find((g) => g.anchor?.id === 1);
    } catch { first = reversed = undefined; }
    check("probe: stacksOf is liftable and the persisted-anchor fixture builds",
      !!stacksOf && first?.lanes[0]?.id === 2, stackSrc.slice(0, 70) || "no stacksOf block");
    check("lane stays with its original main when another main emits newer output and input order reverses",
      first?.anchor?.id === 1 && first.at === 1
        && reversed?.anchor?.id === 1 && reversed.lanes[0]?.id === 2,
      JSON.stringify({ first: first?.anchor?.id, reversed: reversed?.anchor?.id }));
    const split = stacksOf?.([...original, {
      id: 7, cwd: `${FX_REPO}/wt/b`, openedAt: 700, lastOutput: 1,
      worktree: { repo: FX_REPO, branch: "fleet/b", anchor: { slot: 3, openedAt: 300 } },
    }]);
    check("two mains in one repo get separate identity-grounded stacks, never one activity bucket",
      split?.filter((g) => g.anchor).length === 2
        && split.some((g) => g.anchor?.id === 1 && g.lanes.some((s) => s.id === 2))
        && split.some((g) => g.anchor?.id === 3 && g.lanes.some((s) => s.id === 7)),
      JSON.stringify(split?.map((g) => ({ anchor: g.anchor?.id, lanes: g.lanes.map((s) => s.id) }))));

    const orphanFx: FxSlot[] = [
      { id: 1, cwd: FX_REPO, repo: FX_REPO, openedAt: 101, lastOutput: 0 }, // slot recycled
      { id: 8, cwd: OTHER, repo: OTHER, openedAt: 800, lastOutput: 0 },
      { id: 2, cwd: `${FX_REPO}/wt/recycled`, lastOutput: 9,
        worktree: { repo: FX_REPO, branch: "fleet/recycled", anchor: { slot: 1, openedAt: 100 } } },
      { id: 4, cwd: `${FX_REPO}/wt/dead`, lastOutput: 8,
        worktree: { repo: FX_REPO, branch: "fleet/dead", anchor: { slot: 9, openedAt: 900 } } },
      { id: 5, cwd: `${FX_REPO}/wt/legacy`, lastOutput: 7,
        worktree: { repo: FX_REPO, branch: "fleet/legacy" } },
      { id: 6, cwd: `${FX_REPO}/wt/wrong`, lastOutput: 6,
        worktree: { repo: FX_REPO, branch: "fleet/wrong", anchor: { slot: 8, openedAt: 800 } } },
    ];
    const orphan = stacksOf?.([...orphanFx].reverse()).find((g) => g.key === FX_REPO && g.anchor === null);
    check("same slot with different openedAt is recycled and cannot match",
      orphan?.lanes.some((s) => s.id === 2) === true, JSON.stringify(orphan?.lanes.map((s) => s.id)));
    check("dead, parentless and wrong-repo anchors share the truthful repo-header/orphan stack",
      [2, 4, 5, 6].every((id) => orphan?.lanes.some((s) => s.id === id))
        && orphan?.at === 2,
      JSON.stringify({ at: orphan?.at, lanes: orphan?.lanes.map((s) => s.id) }));

    const subFx: FxSlot[] = [
      { id: 10, cwd: `${FX_REPO}/sub/dir`, repo: FX_REPO, openedAt: 1000, lastOutput: 0 },
      { id: 11, cwd: `${FX_REPO}/wt/sub`, repo: FX_REPO, openedAt: 1100, lastOutput: 0,
        worktree: { repo: FX_REPO, branch: "fleet/sub", anchor: { slot: 10, openedAt: 1000 } } },
    ];
    const subStack = stacksOf?.(subFx)[0];
    check("subdirectory main associates through the poll's canonical repo identity",
      subStack?.anchor?.id === 10 && subStack.lanes[0]?.id === 11, JSON.stringify(subStack));

    type AnchorSelector = (c: { slot: number; openedAt: number; lastOutput: number }[]) => LaneAnchor | null;
    let serverSrc = "", selector: AnchorSelector | null = null;
    try {
      serverSrc = readFileSync(`${dirname(realpathSync(`${ROOT}/node_modules`))}/server.ts`, "utf8");
      const a = serverSrc.indexOf("function mostRecentMainAnchor("), b = serverSrc.indexOf("// Decide a lane's parent ONCE", a);
      const selectSrc = a >= 0 && b > a ? serverSrc.slice(a, b) : "";
      selector = new Function(new Bun.Transpiler({ loader: "ts" }).transformSync(selectSrc)
        + "\nreturn mostRecentMainAnchor;")() as AnchorSelector;
    } catch { selector = null; }
    const tied = selector?.([
      { slot: 5, openedAt: 50, lastOutput: 0 }, { slot: 4, openedAt: 40, lastOutput: 0 },
    ]);
    const tiedReverse = selector?.([
      { slot: 4, openedAt: 40, lastOutput: 0 }, { slot: 5, openedAt: 50, lastOutput: 0 },
    ]);
    check("implicit main selector is liftable and equal activity ties to the lower slot regardless of input order",
      tied?.slot === 4 && tiedReverse?.slot === 4, JSON.stringify({ tied, tiedReverse }));
    check("malformed legacy anchor normalizes to absent and state load uses that normalizer",
      normalizeLaneAnchor({ slot: "1", openedAt: 100 }) === null
        && normalizeLaneAnchor({ slot: 1, openedAt: Number.NaN }) === null
        && serverSrc.includes("const anchor = normalizeLaneAnchor((wt as { anchor?: unknown }).anchor);"),
      "normalizeLaneAnchor + fleet.json load wiring");
    check("client quick-lane wiring sends slot+openedAt only from a main row; generic calls may omit it",
      cliSrc.includes("newLane(repo, parent)")
        && cliSrc.includes("quickLaneChip(s.repo ?? s.cwd, parent ?? undefined)"),
      "quickLaneChip → newLane parent");
    const renderSrc = cut("function renderSlots()", "function emptyRow(");
    const emptySrc = cut("function emptyRow(", "// The whole stack");
    const stackUiSrc = cut("function setStackOpen(", "function renderChips(");
    const rowSrc = cut("function slotRow(", "function renderChips(");
    const showSlotSrc = cut("function showSlot(", "window.addEventListener");
    check("fixed empty rows and active non-lane rows retain their displayed slot numbers",
      renderSrc.includes("slotsEl.appendChild(emptyRow(s))")
        && emptySrc.includes('el("span", "n", String(s.id))')
        && /else \{\s*row\.append\(el\("span", "n", String\(s\.id\)\), lbl\)/.test(rowSrc),
      "renderSlots + emptyRow + slotRow main-number branch");
    check("active lane rows replace the visible number with ref · mutable label",
      /if \(s\.worktree\) \{[\s\S]*?"laneref"[\s\S]*?"lanesep", "·"[\s\S]*?\} else \{\s*row\.append\(el\("span", "n"/.test(rowSrc)
        && (rowSrc.match(/"n", String\(s\.id\)/g) ?? []).length === 1
        && rowSrc.includes("s.label ?? baseName(s.cwd)")
        && indexSrc.includes(".slot .laneref { flex: none; white-space: nowrap;")
        && indexSrc.includes(".slot .laneidentity .lbl { min-width: 0; }"),
      "lane identity branch + compact CSS");
    check("lane row internals keep slot ids, routes, tooltips and rename persistence",
      rowSrc.includes("row.dataset.slot = String(s.id)")
        && rowSrc.includes("slot ${s.id} · ${displayLabel}")
        && rowSrc.includes("showSlot(s.id)")
        && rowSrc.includes("`/api/slots/${s.id}/kill`")
        && cliSrc.includes("`/api/slots/${s.id}/rename`")
        && rowSrc.includes("startRename(row, s)"),
      "slotRow data-slot/actions/title + startRename route");
    check("sidebar stack fold, unfold, rendering and showSlot contain no worktree-list request or ghost plumbing",
      !stackUiSrc.includes("/worktrees") && !showSlotSrc.includes("/worktrees")
        && !/ghostCache|loadGhosts|ghostRow|ghostHost/.test(stackUiSrc)
        && /function renderStack[\s\S]*for \(const l of g\.lanes\)/.test(stackUiSrc),
      "sidebar stack source");
    check("sidebar ghost presentation CSS is removed",
      !indexSrc.includes(".slot.ghost") && !indexSrc.includes(".ghosttag"),
      "public/index.html ghost selectors");
    check("board lane recovery and destructive safeguards retain their worktree routes",
      boardSrc.includes('api(`/api/slots/${slot}/worktrees`)')
        && boardSrc.includes('post("/api/lanes", { repo: wts.repo, attach: w.path })')
        && boardSrc.includes('post("/api/worktrees/remove", { repo: wts.repo, path: w.path })')
        && boardSrc.includes('post("/api/worktrees/discard", { repo: wts.repo, path: w.path, branch: w.branch })')
        && boardSrc.includes("DISCARD_READ_MS")
        && serverSrc.includes('/^\\/api\\/slots\\/(\\d+)\\/worktrees$/')
        && serverSrc.includes('url.pathname === "/api/worktrees/remove"')
        && serverSrc.includes('url.pathname === "/api/worktrees/discard"'),
      "renderBoard recovery controls + unchanged server routes");

    const cssBody = (selector: string): string => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(indexSrc)?.[1] ?? "";
    };
    const slotsCss = cssBody("#slots"), slotCss = cssBody(".slot"), slotactCss = cssBody(".slotact");
    const mobileAt = indexSrc.indexOf("/* --- mobile: phones in any orientation");
    const mobileCss = mobileAt < 0 ? "" : indexSrc.slice(mobileAt, indexSrc.indexOf("</style>", mobileAt));
    check("sidebar slot rows cannot shrink and the flex column retains vertical scrolling",
      /(?:^|;)\s*flex:\s*none(?:;|$)/.test(slotCss)
        && /(?:^|;)\s*display:\s*flex(?:;|$)/.test(slotsCss)
        && /(?:^|;)\s*flex-direction:\s*column(?:;|$)/.test(slotsCss)
        && /(?:^|;)\s*overflow-y:\s*auto(?:;|$)/.test(slotsCss),
      JSON.stringify({ slotCss: slotCss.trim(), slotsCss: slotsCss.trim() }));
    check("empty rows stay numbered navigation but use only the quiet compact empty label",
      emptySrc.includes('el("span", "n", String(s.id))')
        && emptySrc.includes('el("span", "lbl dim", "empty")')
        && emptySrc.includes("row.onclick = () => openPicker(s.id)")
        && !emptySrc.includes("start here") && !emptySrc.includes("empty —"),
      emptySrc.slice(0, 300));
    check("lane suffix replaces the slot number without a redundant permanent lane glyph",
      !rowSrc.includes('"lanechip"') && !indexSrc.includes(".slot .lanechip"),
      "slotRow + sidebar CSS");
    check("hover and focus actions use a solid row-coloured surface over passive facts",
      /background:\s*var\(--rb\)/.test(slotactCss)
        && !/transparent|gradient|opacity/i.test(slotactCss)
        && indexSrc.includes(".slot:hover .slotact, .slot:focus-within .slotact { display: flex; }"),
      slotactCss.trim());
    check("unknown context remains the literal ctx ? reading",
      rowSrc.includes('c ? `ctx ${Math.round(c.pct)}%` : "ctx ?"'),
      "slotRow context source");
    const mobileRowacts = /(?:^|\n)\s*\.rowacts\s*\{([^}]*)\}/.exec(mobileCss)?.[1] ?? "";
    const mobileRowact = /(?:^|\n)\s*\.rowacts \.rowact\s*\{([^}]*)\}/.exec(mobileCss)?.[1] ?? "";
    check("mobile rows and existing actions wrap within the drawer without clipping",
      /\.slot\s*\{[^}]*flex-wrap:\s*wrap/.test(mobileCss)
        && /flex-wrap:\s*wrap/.test(mobileRowacts)
        && /max-width:\s*100%/.test(mobileRowacts)
        && /min-width:\s*40px/.test(mobileRowact)
        && /min-height:\s*40px/.test(mobileRowact),
      JSON.stringify({ mobileRowacts: mobileRowacts.trim(), mobileRowact: mobileRowact.trim() }));
  }

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

  // --- the owner /send RECEIPT and its journal attribution (Communication Cut 3) ---
  // The defect this family closes: a slot number identifies a ROW, and rows are recycled, so a
  // journal line saying "slot 3" could never say WHICH occupant received the text. And a partial
  // paste escaped as an untyped 500 that journaled nothing at all. Fixture slot is 3, free again
  // since the export block killed it; it is killed again at the end of this block.
  {
    type SlotRow = { openedAt?: number; sessionId?: string | null };
    const readSlot = (id: number): SlotRow =>
      ((JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
        { slots?: Record<string, SlotRow> }).slots?.[String(id)] ?? {});
    // NEVER from /api/sessions: that payload is read through a cast and simply does not emit these
    // fields, so an assertion against it would compare undefined to undefined forever (the
    // documented `awaiting` trap). The state file is what the server actually persisted.
    const occupant = async (id: number, notOpenedAt: number | null): Promise<SlotRow> => {
      for (let i = 0; i < 60; i++) {
        const row = readSlot(id);
        if (row.openedAt && row.openedAt !== notOpenedAt) return row;
        await Bun.sleep(100);
      }
      return readSlot(id);
    };
    type Receipt = { sendId?: unknown; at?: unknown; submitRequested?: unknown; acceptance?: unknown;
      submitted?: unknown; delivery?: unknown;
      receiver?: { slot?: unknown; openedAt?: unknown; sessionId?: unknown } };
    const journalFor = async (sendId: string): Promise<PromptLogEntry | undefined> => {
      // the journal write is async through promptLogChain, so poll for the line — asserting
      // immediately would race the append and read as "the route never journaled"
      for (let i = 0; i < 80; i++) {
        const line = (await plogRead()).find((e) => e.sendId === sendId);
        if (line) return line;
        await Bun.sleep(100);
      }
      return undefined;
    };
    const scratch = `${tmpdir()}/fleet-e2e-send-receipt-${process.pid}`;
    let fixtureOk = false;
    try { mkdirSync(scratch, { recursive: true }); fixtureOk = exists(scratch); } catch { fixtureOk = false; }
    // its own check: a fixture that could not be built must fail as ITSELF, never as the route
    check("send-receipt fixture: a scratch cwd exists for the doomed occupant", fixtureOk, scratch);

    const openA = fixtureOk ? await post("/api/slots/3/open", { cwd: scratch }) : null;
    check("send-receipt fixture: slot 3 opens on the scratch cwd", !!openA?.ok,
      openA ? `${openA.status}` : "fixture missing");
    if (openA?.ok) {
      const occA = await occupant(3, null);
      check("send-receipt fixture: the first occupant is persisted with an openedAt",
        !!occA.openedAt, JSON.stringify(occA));

      // 1) SUCCESS RECEIPT. Mutation that breaks it: returning bare {ok:true} again, or building
      // `receiver` from anything but the slot's own openedAt/sessionId.
      const okRes = await post("/send", { slot: 3, text: "receipt-probe-one", submit: false });
      const okBody = (await okRes.json()) as { ok?: unknown; receipt?: Receipt };
      const r1 = okBody.receipt;
      // ACP-25: `submitted` is gone — it only ever echoed the request flag. The receipt now names
      // the flag (submitRequested) and what the pane SHOWED (acceptance); a stand-in harness that
      // declares no composer answers not-applicable, never observed.
      check("/send answers with a typed receipt carrying a 24-hex sendId, the submit REQUEST and the observed acceptance",
        okRes.ok && okBody.ok === true && typeof r1?.sendId === "string"
        && /^[0-9a-f]{24}$/.test(String(r1.sendId)) && r1.submitRequested === false
        && r1.acceptance === "not-applicable" && !("submitted" in (r1 ?? {}))
        && typeof r1.at === "number" && (r1.at as number) > 0,
        JSON.stringify(okBody).slice(0, 200));
      check("the receipt names the CURRENT occupant, not just the slot row",
        r1?.receiver?.slot === 3 && r1?.receiver?.openedAt === occA.openedAt
        && (r1?.receiver?.sessionId ?? null) === (occA.sessionId ?? null),
        JSON.stringify({ receiver: r1?.receiver, state: occA }));

      // 2) JOURNAL ATTRIBUTION. Mutation that breaks it: dropping openedAt/sessionId from
      // logPrompt (the whole point), or renaming/reordering one of the six original fields.
      const j1 = typeof r1?.sendId === "string" ? await journalFor(String(r1.sendId)) : undefined;
      check("the prompt journal carries the send's occupant attribution and its delivery verdict",
        !!j1 && j1.slot === 3 && j1.openedAt === occA.openedAt
        && (j1.sessionId ?? null) === (occA.sessionId ?? null) && j1.delivery === "sent",
        JSON.stringify(j1));
      check("the six pre-existing journal fields are unchanged by the additive attribution",
        !!j1 && typeof j1.ts === "number" && j1.slot === 3 && j1.cwd === scratch
        && j1.source === "owner" && j1.text === "receipt-probe-one" && "label" in j1,
        JSON.stringify(j1));

      // 2b) THE SEND LEDGER (B3). The measured hole: POST /send — the most expensive channel on
      // this fleet — wrote no ledger row at all, so the only surface that knew what Fleet had typed
      // into a session was the provider's own /usage page
      // (docs/messungen/denksession-zusammenarbeit-2026-09-02.md §2.4 point 2). The row is written
      // by sendText itself, so this probe holds it for EVERY channel at once; what it proves here
      // is the owner one end to end: exactly one row, the payload's UTF-8 BYTE length (the probe
      // text is deliberately multi-byte, so a mutation to `text.length` fails it), the channel name
      // and the observed acceptance — and the per-slot day counter the board reads.
      type SendRow = { event?: unknown; slot?: unknown; bytes?: unknown; path?: unknown; acceptance?: unknown };
      const auditLines = (): string[] =>
        readFileSync(`${ROOT}/audit.jsonl`, "utf8").split("\n").filter(Boolean);
      const sendRowsSince = (from: number): SendRow[] => auditLines().slice(from)
        .map((l) => { try { return JSON.parse(l) as SendRow; } catch { return {}; } })
        .filter((r) => r.event === "send" && r.slot === 3);
      type Inbound = { sends: number; bytes: number } | null;
      const inboundOfThree = async (): Promise<Inbound> => {
        const body = (await (await get("/api/sessions")).json()) as
          { slots: { id: number; inbound?: { sends: number; bytes: number } }[] };
        return body.slots.find((x) => x.id === 3)?.inbound ?? null;
      };
      const ledgerPayload = "send-ledger-probe-üüü";
      const ledgerBytes = Buffer.byteLength(ledgerPayload, "utf8");
      const auditBefore = auditLines().length;
      const inbBefore = await inboundOfThree();
      const ledgerRes = await post("/send", { slot: 3, text: ledgerPayload, submit: false });
      // the audit write is fire-and-forget through appendEvent's chain, so poll for the line —
      // asserting immediately would race the append and read as "the send wrote nothing"
      // …and only the OWNER channel's rows are counted: a tick nudge that happened to reach this
      // slot in the same window is a different path, and would otherwise turn "exactly one row per
      // POST /send" into a race against the fleet's own traffic.
      let sendRows: SendRow[] = [];
      for (let i = 0; i < 80 && sendRows.length === 0; i++) {
        sendRows = sendRowsSince(auditBefore).filter((r) => r.path === "owner");
        if (sendRows.length === 0) await Bun.sleep(100);
      }
      check("a POST /send writes EXACTLY ONE send row, carrying the payload's UTF-8 byte length, its channel and the observed acceptance",
        ledgerRes.ok && sendRows.length === 1 && ledgerBytes !== ledgerPayload.length
        && sendRows[0]?.bytes === ledgerBytes && sendRows[0]?.path === "owner"
        && sendRows[0]?.acceptance === "not-applicable",
        JSON.stringify({ status: ledgerRes.status, bytes: ledgerBytes, chars: ledgerPayload.length, rows: sendRows }).slice(0, 300));
      // the counter is bumped synchronously inside the send, so it is already true when /send answers
      const inbAfter = await inboundOfThree();
      check("/api/sessions carries inbound{sends,bytes} for the slot, advanced by exactly this one send's bytes",
        !!inbAfter && inbAfter.sends === (inbBefore?.sends ?? 0) + 1
        && inbAfter.bytes === (inbBefore?.bytes ?? 0) + ledgerBytes,
        JSON.stringify({ before: inbBefore, after: inbAfter, payloadBytes: ledgerBytes }));


      // 3) UNCERTAIN. The transport must fail while the OCCUPANT stays the same row — and the
      // 2s self-heal loop must be structurally unable to interfere, not merely outrun.
      //
      // The form this replaces removed the cwd and killed the session, asserting that
      // `tmux new-session -c <gone>` would then fail. It does not: measured on tmux 3.6a, a `-c`
      // whose directory is gone silently falls back to $HOME and the session comes back. So the
      // premise was false and the check only ever won a race — the heal rebuilt the pane inside
      // the ~50 ms before /send, and the probe read `200 delivery:"sent"` (flake family 9,
      // verify-tiering.md §11.2g, ~2 fails per 146 runs, all three group members together).
      //
      // What controls the heal instead: the heal loop rebuilds only when `has-session` FAILS
      // (server.ts#ensureSlot). With `remain-on-exit` on, killing the pane's process leaves the
      // SESSION alive with a dead pane — `has-session` answers 0, so the loop's every tick is a
      // no-op, while `paste-buffer -t s3` answers non-zero ("target pane has exited") and sendText
      // throws. Nothing in the server respawns a dead pane. Both halves are facts this fixture
      // creates and then asserts under their own name; neither is a wager on timing.
      // Mutation that breaks the CHECK: an un-caught sendText (untyped 500, no journal line), or
      // journaling the attempt into history as if it had arrived.
      const histBefore = ((await (await get("/api/slots/3/history")).json()) as
        { history: unknown[] }).history.length;
      const keepAlive = await tmuxOut("set", "-w", "-t", "s3", "remain-on-exit", "on");
      const panePid = (await tmuxOut("display-message", "-p", "-t", "s3", "#{pane_pid}")).out.trim();
      if (keepAlive.code === 0 && /^\d+$/.test(panePid)) {
        try { process.kill(Number(panePid), "SIGKILL"); } catch { /* asserted below, not here */ }
      }
      let dead = "";
      let alive = { code: 1 };
      for (let i = 0; i < 60; i++) {
        dead = (await tmuxOut("display-message", "-p", "-t", "s3", "#{pane_dead}")).out.trim();
        alive = await tmuxOut("has-session", "-t", "s3");
        if (dead === "1") break;
        await Bun.sleep(50);
      }
      // its own check, under its own name: a precondition that could not be established must fail
      // as ITSELF, never as the route it was built to measure (§11.2f/§11.2g repair form)
      check("send-receipt fixture: the pane is DEAD while its session survives — the self-heal cannot fire",
        keepAlive.code === 0 && /^\d+$/.test(panePid) && dead === "1" && alive.code === 0,
        `remain-on-exit=${keepAlive.code} pane_pid=${panePid || "?"} pane_dead=${dead || "?"} has-session=${alive.code}`);
      const badRes = await post("/send", { slot: 3, text: "receipt-probe-uncertain", submit: false });
      const badBody = (await badRes.json()) as { error?: unknown; receipt?: Receipt };
      const r2 = badBody.receipt;
      check("a send whose transport threw answers 409 with an uncertain receipt, never an untyped 500",
        badRes.status === 409 && typeof badBody.error === "string"
        && String(badBody.error).startsWith("send outcome uncertain:")
        && r2?.delivery === "uncertain" && /^[0-9a-f]{24}$/.test(String(r2?.sendId))
        && r2?.receiver?.openedAt === occA.openedAt,
        `${badRes.status} ${JSON.stringify(badBody).slice(0, 200)}`);
      const j2 = typeof r2?.sendId === "string" ? await journalFor(String(r2.sendId)) : undefined;
      check("the uncertain ATTEMPT is journaled — an unjournaled uncertain send is the silent loss",
        !!j2 && j2.delivery === "uncertain" && j2.text === "receipt-probe-uncertain"
        && j2.openedAt === occA.openedAt, JSON.stringify(j2));
      const histAfter = ((await (await get("/api/slots/3/history")).json()) as
        { history: unknown[] }).history.length;
      check("an uncertain send does NOT enter slot history — recall must not replay a guess as fact",
        histAfter === histBefore, `${histBefore} -> ${histAfter}`);

      // 3b) …and the ledger's other half: a send that THREW is not a missing row. It books its
      // channel and the throw's own word, with the bytes that actually reached the pane — zero
      // here, because the paste itself is what failed — and it must NOT move the cost counter,
      // which prices delivery and not attempts. Mutation that breaks it: writing the row only on
      // the success path (no row at all), or booking the payload length regardless of the paste.
      const failing = (): SendRow[] => sendRowsSince(auditBefore)
        .filter((r) => r.path === "owner" && r.acceptance !== "not-applicable");
      let failRows: SendRow[] = [];
      for (let i = 0; i < 80 && failRows.length === 0; i++) {
        failRows = failing();
        if (failRows.length === 0) await Bun.sleep(100);
      }
      const inbAfterFail = await inboundOfThree();
      check("a send whose transport threw books ONE row with 0 delivered bytes and the throw's own word",
        failRows.length === 1 && failRows[0]?.bytes === 0 && failRows[0]?.path === "owner"
        && failRows[0]?.acceptance === "send-failed",
        JSON.stringify(failRows).slice(0, 300));
      check("a refused send leaves the inbound cost counter where it was — it prices delivery, not attempts",
        !!inbAfterFail && !!inbAfter && inbAfterFail.sends === inbAfter.sends
        && inbAfterFail.bytes === inbAfter.bytes,
        JSON.stringify({ afterDelivered: inbAfter, afterFailed: inbAfterFail }));

      // 4) RECYCLING COUNTER-PROBE — the reason attribution exists at all. Same slot NUMBER, new
      // occupant: a receipt that still carried the old openedAt would make the journal ambiguous
      // in exactly the way this cut removes. Mutation that breaks it: capturing the receiver
      // triple once per slot instead of per send.
      await post("/api/slots/3/kill", {});
      const reopen = await post("/api/slots/3/open", { cwd: "~" });
      check("send-receipt fixture: slot 3 is recycled to a NEW occupant", reopen.ok, String(reopen.status));
      const occB = await occupant(3, occA.openedAt ?? null);
      check("send-receipt fixture: the recycled occupant has a different openedAt",
        !!occB.openedAt && occB.openedAt !== occA.openedAt, JSON.stringify({ occA, occB }));
      const okRes2 = await post("/send", { slot: 3, text: "receipt-probe-two", submit: false });
      const r3 = ((await okRes2.json()) as { receipt?: Receipt }).receipt;
      check("a send to the recycled row is attributed to the NEW occupant, not the row's history",
        okRes2.ok && r3?.receiver?.slot === 3 && r3?.receiver?.openedAt === occB.openedAt
        && r3?.receiver?.openedAt !== r1?.receiver?.openedAt && r3?.sendId !== r1?.sendId,
        JSON.stringify({ first: r1?.receiver, second: r3?.receiver }));

      // 5) THE OCCUPANT PIN. A caller that read occupant A and sends to the recycled row with A's
      // openedAt must be refused BEFORE anything is typed, and told who holds the row now — the
      // 2026-09-14 12:08 recycled-slot kill. The pinned send to B right after is the positive control
      // that makes the stale marker's absence from the capture a measurement.
      // Mutation that breaks it: dropping the openedAt comparison, or comparing after sendText.
      const staleRes = await post("/send", { slot: 3, text: "pin-probe-stale-occupant", submit: false, openedAt: occA.openedAt });
      const staleBody = (await staleRes.json()) as { error?: unknown; occupant?: { slot?: unknown; openedAt?: unknown } };
      check("a /send pinned to a former occupant's openedAt answers 409 naming the CURRENT occupant",
        staleRes.status === 409 && typeof staleBody.error === "string"
        && String(staleBody.error).includes("nothing typed")
        && staleBody.occupant?.slot === 3 && staleBody.occupant?.openedAt === occB.openedAt,
        `${staleRes.status} ${JSON.stringify(staleBody).slice(0, 240)}`);
      const pinnedRes = await post("/send", { slot: 3, text: "pin-probe-current-occupant", submit: false, openedAt: occB.openedAt });
      check("a /send pinned to the current occupant's openedAt is delivered as before",
        pinnedRes.ok, `${pinnedRes.status} ${(await pinnedRes.text()).slice(0, 200)}`);
      const badPin = await post("/send", { slot: 3, text: "pin-probe-bad", submit: false, openedAt: "yesterday" });
      check("a malformed openedAt pin is a 400, never a silent unpinned send", badPin.status === 400, String(badPin.status));
      let pinCap = "";
      for (let i = 0; i < 30 && !pinCap.includes("pin-probe-current-occupant"); i++) {
        pinCap = (await tmuxOut("capture-pane", "-t", "s3", "-p")).out;
        if (!pinCap.includes("pin-probe-current-occupant")) await Bun.sleep(100);
      }
      check("the pane holds the pinned-current text and neither the stale-pin nor the malformed-pin text",
        pinCap.includes("pin-probe-current-occupant") && !pinCap.includes("pin-probe-stale-occupant")
        && !pinCap.includes("pin-probe-bad"), pinCap.slice(-200));

      // 6) A TEXT OVER THE PASTE CEILING IS NEVER PASTED (1e170a25: a long owner paste arrived as its
      // tail only). 200 KB with a distinct head and tail, so a truncation at either end is visible:
      // the pane gets ONE pointer line, the ledger counts that line's bytes, and the stored file hashes
      // to the original. Mutation caught: sendText pasting `given` again — the send row then carries
      // ~200 KB and no `pane_inbox_stored` row exists.
      {
        const head = "LONGTEXT-HEAD-7f3a ";
        const tail = " LONGTEXT-TAIL-9c1e";
        const body = "ü".repeat(10) + "0123456789abcdef\n".repeat(Math.ceil(200_000 / 17));
        const longText = `${head}${body}${tail}`;
        const longBytes = Buffer.byteLength(longText, "utf8");
        const longSha = createHash("sha256").update(longText, "utf8").digest("hex");
        type StoredRow = SendRow & { sha256?: unknown; file?: unknown; sendPath?: unknown };
        const rowsFrom = (from: number): StoredRow[] => auditLines().slice(from)
          .map((l) => { try { return JSON.parse(l) as StoredRow; } catch { return {}; } })
          .filter((r) => r.slot === 3);
        const longFrom = auditLines().length;
        const longRes = await post("/send", { slot: 3, text: longText, submit: false });
        let stored: StoredRow[] = [];
        let longSends: StoredRow[] = [];
        for (let i = 0; i < 80 && (stored.length === 0 || longSends.length === 0); i++) {
          stored = rowsFrom(longFrom).filter((r) => r.event === "pane_inbox_stored");
          longSends = rowsFrom(longFrom).filter((r) => r.event === "send" && r.path === "owner");
          if (stored.length === 0 || longSends.length === 0) await Bun.sleep(100);
        }
        const file = typeof stored[0]?.file === "string" ? stored[0].file : "";
        const onDisk = file && exists(file) ? readFileSync(file) : null;
        const diskSha = onDisk ? createHash("sha256").update(onDisk).digest("hex") : "";
        check("a 200-KB /send is stored whole instead of pasted: the stored file's sha256 and byte length equal the original's",
          longRes.ok && longBytes > 200_000 && stored.length === 1 && stored[0]?.sha256 === longSha
            && stored[0]?.bytes === longBytes && stored[0]?.sendPath === "owner"
            && onDisk !== null && onDisk.length === longBytes && diskSha === longSha,
          JSON.stringify({ status: longRes.status, longBytes, stored: stored.map((r) => ({ ...r, file: undefined })),
            file, diskBytes: onDisk?.length ?? null, hashMatch: diskSha === longSha }).slice(0, 400));
        const cap = (await tmuxOut("capture-pane", "-p", "-J", "-t", "s3")).out;
        check("…and the pane got exactly ONE short pointer line naming the file — never the head or the tail of the text",
          longSends.length === 1 && typeof longSends[0]?.bytes === "number" && longSends[0].bytes < 1024
            && cap.includes(`[fleet] message ${longSha.slice(0, 16)}`) && cap.includes(file)
            && !cap.includes(head.trim()) && !cap.includes(tail.trim()),
          JSON.stringify({ sends: longSends, paneTail: cap.slice(-300) }));
        await tmuxOut("send-keys", "-t", "s3", "C-u");
      }
      await post("/api/slots/3/kill", {});
    }
    rmSync(scratch, { recursive: true, force: true });
  }

  // --- THE STREAM TICK CARRIES TWO FACTS, and a quiet window may only suppress one of them.
  // `quietUntil` exists so output FLEET ITSELF caused does not read as the session working: the
  // repaint after the pipe-pane attach (server.ts#ensureSlot), the repaint after a resize, and the
  // echo of a payload we pasted. That is a statement about RECENCY. It is not a statement about
  // whether this pane has ever been seen at all — and `lastOutput === 0` carries exactly that
  // second fact: lane-signals.ts reads it as `observed` in STALLED_RULES/SPENT_RULES, and
  // program-phase.ts's R10 refuses to judge a row whose lane was never observed.
  //
  // THE DEFECT THIS PINS: poll() advances `s.offset` unconditionally but stamped `lastOutput` only
  // OUTSIDE the window, so a burst consumed INSIDE it was spent without ever being counted, and a
  // pane whose only output falls there stayed "never observed" for the rest of its life. That is
  // every `FLEET_CMD=true` pane in this suite. Load points the WRONG WAY on it: a tick delayed past
  // the window consumes the same burst through the ordinary path and the bug hides, which is why
  // this is a LOOP whose every attempt establishes its own precondition before it may judge.
  //
  // THE PRECONDITION, and the two ways an attempt fails to establish it. The stream file is written
  // in a shape the sampler below can read off (measured 2026-09-05, 1 ms sampler, both code
  // versions): the seed capture appears at ~tOpen-220 ms as 2 B, the pipe-pane attach lets the
  // pane's own paint in at ~tOpen-190 ms (281 B), and the rest of the repaint settles by ~tOpen+190
  // ms (326 B). `quietUntil` is assigned between those first two, so THE FIRST BYTE PAST THE SEED
  // is the window opening. An attempt therefore counts only when (1) every byte settled deep inside
  // the window, and (2) the stamp is either absent (the defect swallowing the burst) or at/after
  // that first past-seed byte. A stamp EARLIER than it is a tick that consumed the 2-byte seed
  // BEFORE the window existed — an ordinary stamp that would read as a repair without being one
  // (seen 1 in 3 on the unfixed server before this clause; 0 in 5 after). Both misses retry, and
  // running out of attempts is reported AS THAT, never as the invariant being violated. ---
  {
    const streamPath = (): string | null => {
      const f = readdirSync(`${ROOT}/streams`).find((x) => x.startsWith("s3-") && x.endsWith(".raw"));
      return f ? `${ROOT}/streams/${f}` : null;
    };
    const lastOutputOf3 = async (): Promise<number> =>
      ((await (await get("/api/sessions")).json()) as { slots: { id: number; lastOutput: number }[] })
        .slots.find((s) => s.id === 3)?.lastOutput ?? 0;
    const WINDOW_INSIDE_MS = 1200; // quietUntil runs to at least tOpen+1200; this stays under it
    type Attempt = { openMs: number; bytes: number; seed: number; pastSeedAt: number;
      settledAt: number; stamp: number; established: boolean };
    const attempts: Attempt[] = [];
    let verdict: { lastOutput: number; bytes: number; bytesAfter: number } | null = null;
    for (let round = 0; round < 4 && !verdict; round++) {
      await post("/api/slots/3/kill", {});
      const marks: { t: number; size: number }[] = [];
      let sampling = true;
      // started BEFORE the open: the attach, and therefore the whole window, happens inside it
      const sampler = (async () => {
        let path: string | null = null;
        while (sampling) {
          if (!path) path = streamPath();
          if (path) { try { marks.push({ t: Date.now(), size: Bun.file(path).size }); } catch { path = null; } }
          await Bun.sleep(1);
        }
      })();
      const tCall = Date.now();
      const opened = await post("/api/slots/3/open", { cwd: "~" });
      const tOpen = Date.now();
      let stamp = 0;
      while (Date.now() - tOpen < WINDOW_INSIDE_MS) {
        await Bun.sleep(50);
        if (stamp === 0) stamp = await lastOutputOf3();
      }
      sampling = false;
      await sampler;
      const path = streamPath();
      const bytes = path ? Bun.file(path).size : -1;
      const seed = marks.length ? marks[0]!.size : -1;
      const pastSeedAt = marks.find((m) => m.size > seed)?.t ?? 0;
      const settledAt = marks.find((m) => m.size === bytes)?.t ?? 0;
      const established = opened.ok && bytes > 0 && seed > 0 && pastSeedAt > 0 && settledAt > 0
        && settledAt - tOpen <= 600 && (stamp === 0 || stamp >= pastSeedAt);
      attempts.push({ openMs: tOpen - tCall, bytes, seed, pastSeedAt: pastSeedAt - tOpen,
        settledAt: settledAt - tOpen, stamp: stamp === 0 ? 0 : stamp - tOpen, established });
      if (!established) continue;
      // past the window's far edge, with the byte count re-read: an unchanged stream proves no
      // later burst arrived to set `lastOutput` through the ordinary path behind our back.
      await Bun.sleep(Math.max(0, tOpen + 2600 - Date.now()));
      verdict = { lastOutput: await lastOutputOf3(), bytes, bytesAfter: path ? Bun.file(path).size : -1 };
    }
    // the invariant is emitted only over a round that established the precondition: with no verdict
    // (audit of 56669352, 4/4 rounds established:false) it measured nothing, and a red there would
    // read as the pane staying unobserved when the probe simply never got a window to look into
    const measured = verdict !== null && verdict.bytesAfter === verdict.bytes;
    check("probe: slot 3's only burst arrived early and the tick that consumed it ran inside the quiet window",
      measured, JSON.stringify({ attempts, verdict }));
    if (measured && verdict)
      check("a stream burst consumed inside a quiet window still ends the pane's never-observed state",
        verdict.lastOutput > 0, JSON.stringify(verdict));
    await post("/api/slots/3/kill", {});
  }

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
    const handed = slotStats([
      ev(T - 2 * h, "slot_open", 3, "/main"), ev(T - h, "slot_kill", 3, "handoff"),
    ], { now: T });
    check("slotstats: a main-session succession is counted as handoff, never collapsed into owner",
      handed.overall.endings["handoff"] === 1 && handed.overall.endings["owner"] === undefined,
      JSON.stringify(handed.overall.endings));
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

  // --- 💤 SLEEP (server.ts#sleepSlot): the four named refusals, the no-transcript refusal, and the
  // heal loop leaving a sleeping pane absent. This suite runs FLEET_CMD=true, which pins no session id,
  // so the pin is PLANTED the way restart.ts plants one — through the state file across a restart —
  // together with the Program-MAIN binding. The resumed conversation itself needs a pinning `claude`
  // and is proven in ./e2e-claude-gate.sh; here a wake can only honestly answer resumed:false.
  // Mutation caught: dropping ensureSlot's `if (s.sleeping) return;` rebuilds the pane inside one tick. ---
  {
    type SleepRow = { id: number; cwd: string | null; lastOutput: number; openedAt: number; sleeping?: { at: number; sessionId: string } };
    const rows = async (): Promise<SleepRow[]> => ((await (await get("/api/sessions")).json()) as { slots: SleepRow[] }).slots;
    const sleepAt = async (slot: number): Promise<{ status: number; body: { ok?: boolean; reason?: string; error?: string; composer?: string; sleeping?: { sessionId?: string; transcript?: string } } }> => {
      const r = await post(`/api/slots/${slot}/sleep`, {});
      return { status: r.status, body: (await r.json()) as never };
    };
    const hasPane = async (slot: number): Promise<boolean> => (await tmuxOut("has-session", "-t", `=s${slot}`)).code === 0;
    const settleIdle = async (slot: number): Promise<void> => {
      for (let i = 0; i < 60; i++) {
        const row = (await rows()).find((r) => r.id === slot);
        if (row && Date.now() - row.lastOutput > MERGE_IDLE_MS + 200) return;
        await Bun.sleep(100);
      }
    };
    const free = (await rows()).filter((r) => !r.cwd).map((r) => r.id).reverse();
    const [N, P] = [free[0], free[1]];
    const nOpen = await post(`/api/slots/${N}/open`, { cwd: ROOT });
    const pOpen = await post(`/api/slots/${P}/open`, { cwd: ROOT });
    const lRes = await post("/api/lanes", { repo: REPO });
    const L = ((await lRes.json()) as { slot?: number }).slot;
    check("sleep fixture: two plain slots and one lane are open", nOpen.ok && pOpen.ok && lRes.ok && typeof L === "number",
      `N=${N}:${nOpen.status} P=${P}:${pOpen.status} lane=${lRes.status}`);

    await settleIdle(N);
    const noSession = await sleepAt(N);
    check("sleep refuses a slot with no session id, by name — it could not be resumed, so it stays awake",
      noSession.status === 409 && noSession.body.reason === "no-session" && await hasPane(N), JSON.stringify(noSession));

    await tmuxOut("send-keys", "-t", `=s${N}:`, "while :; do echo sleep-busy-probe; sleep 0.1; done", "Enter");
    let busy = noSession;
    for (let i = 0; i < 30; i++) {
      await Bun.sleep(100);
      busy = await sleepAt(N);
      if (busy.body.reason === "busy") break;
    }
    check("sleep refuses a pane mid-turn (output inside the owner-act idle gate), by name",
      busy.status === 409 && busy.body.reason === "busy" && await hasPane(N), JSON.stringify(busy));
    await tmuxOut("send-keys", "-t", `=s${N}:`, "C-c");

    const lane = typeof L === "number" ? await sleepAt(L) : null;
    check("sleep refuses a lane, by name — its worktree and land path hang on the session",
      lane?.status === 409 && lane.body.reason === "lane" && typeof L === "number" && await hasPane(L), JSON.stringify(lane));

    // plant: a Program bound to P's exact occupant, and a pin on N whose transcript does not exist yet
    const statePath = `${ROOT}/fleet.json`;
    const SID = crypto.randomUUID();
    const PROGRAM = "5".repeat(24);
    const transcriptDir = `${process.env.HOME}/.claude/projects/${ROOT.replace(/[^a-zA-Z0-9]/g, "-")}`;
    const transcript = `${transcriptDir}/${SID}.jsonl`;
    await stopSrv();
    const st = JSON.parse(readFileSync(statePath, "utf8")) as { slots: Record<string, Record<string, unknown>>; programs?: Record<string, unknown>[] };
    const pRow = st.slots[String(P)];
    st.slots[String(N)]!.sessionId = SID;
    st.programs = [...(st.programs ?? []), {
      id: PROGRAM, title: "sleep fixture", intent: "Bind a MAIN the sleep door must refuse",
      successCriterion: "sleep answers program-main", nonGoals: [], decisions: [], evidence: [], openQuestions: [],
      status: "active", createdAt: Date.now() - 1000, proposedBy: { kind: "owner" },
      confirmedAt: Date.now() - 900, activatedAt: Date.now() - 800,
      main: { slot: P, openedAt: pRow?.openedAt, sessionId: pRow?.sessionId ?? null, boundAt: Date.now() - 700 },
    }];
    writeFileSync(statePath, JSON.stringify(st, null, 2), { mode: 0o600 });
    await restartSrv();

    await settleIdle(P);
    const main = await sleepAt(P);
    check("sleep refuses a bound Program-MAIN, by name — its Program would have no reachable addressee",
      main.status === 409 && main.body.reason === "program-main" && await hasPane(P), JSON.stringify(main));

    await settleIdle(N);
    const noTranscript = await sleepAt(N);
    check("sleep refuses a pinned slot whose transcript is not on disk — a fresh TUI must never wake under the old id",
      noTranscript.status === 409 && noTranscript.body.reason === "no-transcript" && await hasPane(N),
      JSON.stringify(noTranscript));

    mkdirSync(transcriptDir, { recursive: true });
    writeFileSync(transcript, `${JSON.stringify({ type: "user", timestamp: "2026-09-19T12:00:00Z" })}\n`);
    await settleIdle(N);
    const slept = await sleepAt(N);
    check("sleep puts an idle, pinned, resumable plain session down and names the evidence and the composer loss",
      slept.status === 200 && slept.body.sleeping?.sessionId === SID && slept.body.sleeping?.transcript === transcript
        && (slept.body.composer ?? "").includes("composer"), JSON.stringify(slept));
    const goneAt = Date.now();
    let reappeared = false;
    while (Date.now() - goneAt < 3 * 2000 + 700) { // three self-heal ticks (2 s each) and a margin
      if (await hasPane(N)) { reappeared = true; break; }
      await Bun.sleep(150);
    }
    check("a sleeping slot's tmux session is gone and the self-heal does NOT bring it back over three ticks",
      !reappeared, `reappeared=${reappeared} after ${Date.now() - goneAt}ms`);
    const nRow = (await rows()).find((r) => r.id === N);
    const persisted = (JSON.parse(readFileSync(statePath, "utf8")) as { slots: Record<string, { sleeping?: { sessionId?: string }; sessionId?: string; cwd?: string }> }).slots[String(N)];
    check("the sleeping occupant keeps its identity: cwd and session id stand, the board and the state file say asleep",
      nRow?.cwd === ROOT && nRow.sleeping?.sessionId === SID && persisted?.sleeping?.sessionId === SID && persisted.sessionId === SID,
      JSON.stringify({ row: nRow?.sleeping ?? null, persisted }));
    const again = await sleepAt(N);
    const rs = await post(`/api/slots/${N}/restart`, {});
    check("a sleeping slot answers a second sleep and ↻ restart with a named 409, never a silent rebuild",
      again.status === 409 && again.body.reason === "already-asleep" && rs.status === 409 && !(await hasPane(N)),
      `${JSON.stringify(again)} restart=${rs.status}`);

    const woke = await post(`/api/slots/${N}/wake`, {});
    const wokeJ = (await woke.json()) as { ok?: boolean; resumed?: boolean | null };
    const wokeRow = (await rows()).find((r) => r.id === N);
    check("wake rebuilds the pane and clears the mark; under the unpinned FLEET_CMD=true it answers resumed:false, never a claimed resume",
      woke.ok && wokeJ.resumed === false && await hasPane(N) && !wokeRow?.sleeping, `${woke.status} ${JSON.stringify(wokeJ)}`);
    const awake = await post(`/api/slots/${N}/wake`, {});
    check("wake of an awake slot is a named 409", awake.status === 409, String(awake.status));

    // cleanup: the three slots, the transcript we wrote, and the planted Program (a second plant)
    await post(`/api/slots/${N}/kill`, {});
    await post(`/api/slots/${P}/kill`, {});
    if (typeof L === "number") await post(`/api/slots/${L}/kill`, {});
    rmSync(transcript, { force: true });
    try { rmdirSync(transcriptDir); } catch { /* not ours to empty — rmdir refuses a non-empty dir */ }
    await stopSrv();
    const st2 = JSON.parse(readFileSync(statePath, "utf8")) as { programs?: { id?: string }[] };
    st2.programs = (st2.programs ?? []).filter((p) => p.id !== PROGRAM);
    writeFileSync(statePath, JSON.stringify(st2, null, 2), { mode: 0o600 });
    await restartSrv();
  }
}
