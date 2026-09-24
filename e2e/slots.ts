// Slots: open/reject/rename, WS streaming + input, the width-aware reseed, the data-saver
// seed budget + poll plan, and HTML/txt export (including the real-metacharacter escaping
// regression).
import { appendFileSync, chmodSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { BASE, IP, PORT, REPO, ROOT, SOCK, TOKEN, check, get, paneEnv, plantScreen, plogRead, post, restartSrv, stopSrv, tmuxOut, wsUrl, wsWithHeaders, type PromptLogEntry } from "./harness";
import { MERGE_IDLE_MS, exists } from "./lane-helpers";
import { RECONNECT_MAX_MS, reconnectDelay } from "../src/backoff";
import { pollPlan } from "../src/pollplan";
import { pendingSettledBy } from "../src/pendingsend";
import { slotStats } from "../slotstats";
import { normalizeLaneAnchor, type LaneAnchor } from "../src/protocol";
import { composerResidue } from "../composer";

export async function run(): Promise<void> {
  // --- slots ---
  const fixed = (await (await get("/api/sessions")).json()) as { slots: { id: number }[] };
  check("the sidebar API exposes all 16 fixed slots in order",
    fixed.slots.length === 16 && fixed.slots.every((s, i) => s.id === i + 1),
    JSON.stringify(fixed.slots.map((s) => s.id)));

  const separateLanes: { slot: number; cwd: string }[] = [];
  const tmuxEnvKeys = ["FLEET_VERIFY_CMD", "FLEET_SEPARATE_LANE_SLOTS", "FLEET_MAX_SESSIONS"];
  const tmuxEnvBefore = await Promise.all(tmuxEnvKeys.map(async (key) => {
    const shown = await tmuxOut("show-environment", "-g", key);
    return shown.code === 0 ? shown.out.slice(key.length + 1).trimEnd() : null;
  }));
  const restartSeparate = (enabled: boolean, max: number): Promise<void> => restartSrv({
    FLEET_SEPARATE_LANE_SLOTS: enabled ? "1" : "0", FLEET_MAX_SESSIONS: String(max),
    FLEET_E2E_COMPOSER_MODE: process.env.FLEET_E2E_COMPOSER_MODE ?? "",
    FLEET_E2E_COMPOSER_STATE: process.env.FLEET_E2E_COMPOSER_STATE ?? "",
  });
  try {
    await restartSeparate(true, 16);
    const openedMains: Response[] = [];
    for (let id = 1; id <= 16; id++) openedMains.push(await post(`/api/slots/${id}/open`, { cwd: REPO }));
    check("separate places allow 16 MAINs under the default 16-session ceiling",
      openedMains.every((r) => r.ok), JSON.stringify(openedMains.map((r) => r.status)));
    const fullMains = await post("/api/lanes", { repo: REPO });
    const fullMainsBody = (await fullMains.json()) as { error?: string };
    check("16 MAINs leave no lane capacity, with a named total-ceiling refusal",
      fullMains.status === 409 && !!fullMainsBody.error?.includes("FLEET_MAX_SESSIONS"),
      JSON.stringify(fullMainsBody));
    for (let id = 2; id <= 16; id++) await post(`/api/slots/${id}/kill`, {});
    for (let i = 0; i < 15; i++) {
      const response = await post("/api/lanes", { repo: REPO });
      const body = (await response.json()) as { slot?: number; cwd?: string; error?: string };
      if (response.ok && body.slot && body.cwd) separateLanes.push({ slot: body.slot, cwd: body.cwd });
    }
    check("one MAIN and 15 lanes fill the 16-session ceiling without taking a band number",
      separateLanes.length === 15 && separateLanes.every((lane) => lane.slot > 16),
      JSON.stringify(separateLanes.map((lane) => lane.slot)));
    const fullMixed = await post("/api/lanes", { repo: REPO });
    const fullMixedBody = (await fullMixed.json()) as { error?: string };
    check("one MAIN plus 15 lanes refuses the next lane at FLEET_MAX_SESSIONS",
      fullMixed.status === 409 && !!fullMixedBody.error?.includes("FLEET_MAX_SESSIONS"),
      JSON.stringify(fullMixedBody));
    await restartSeparate(true, 16);
    const adopted = (await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] };
    check("a server restart adopts all numbered internal lane places",
      separateLanes.every((lane) => adopted.slots.find((s) => s.id === lane.slot)?.cwd === lane.cwd),
      JSON.stringify(separateLanes.map((lane) => [lane.slot, adopted.slots.find((s) => s.id === lane.slot)?.cwd])));
    for (const lane of separateLanes.splice(0)) {
      await post(`/api/slots/${lane.slot}/kill`, {});
      spawnSync("git", ["worktree", "remove", "--force", lane.cwd], { cwd: REPO });
    }
    for (let id = 2; id <= 16; id++) {
      const response = await post(`/api/slots/${id}/open`, { cwd: REPO });
      if (!response.ok) break;
    }
    await restartSeparate(true, 25);
    const seventeenth = await post("/api/lanes", { repo: REPO });
    const seventeenthBody = (await seventeenth.json()) as { slot?: number; cwd?: string; error?: string };
    check("a 25-session ceiling opens session 17 as a lane outside bands 1..16",
      seventeenth.ok && !!seventeenthBody.slot && seventeenthBody.slot > 16,
      JSON.stringify(seventeenthBody));
    if (seventeenthBody.slot && seventeenthBody.cwd)
      separateLanes.push({ slot: seventeenthBody.slot, cwd: seventeenthBody.cwd });
    await restartSeparate(true, 25);
    const adopted25 = (await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] };
    check("a restart adopts the seventeenth session on its lane place",
      !!seventeenthBody.slot && adopted25.slots.find((s) => s.id === seventeenthBody.slot)?.cwd === seventeenthBody.cwd,
      JSON.stringify(adopted25.slots.filter((s) => s.cwd).map((s) => s.id)));
  } finally {
    for (const lane of separateLanes) {
      await post(`/api/slots/${lane.slot}/kill`, {});
      spawnSync("git", ["worktree", "remove", "--force", lane.cwd], { cwd: REPO });
    }
    for (let id = 1; id <= 16; id++) await post(`/api/slots/${id}/kill`, {});
    await restartSeparate(false, 16);
    for (const [i, key] of tmuxEnvKeys.entries()) {
      const value = tmuxEnvBefore[i];
      if (value === null) await tmuxOut("set-environment", "-gu", key);
      else await tmuxOut("set-environment", "-g", key, value);
    }
    const legacy = (await (await get("/api/sessions")).json()) as { slots: { id: number }[] };
    check("switch off restores the exact 16-row slot board",
      legacy.slots.length === 16 && legacy.slots.every((s, i) => s.id === i + 1),
      JSON.stringify(legacy.slots.map((s) => s.id)));
  }

  // --- the harness catalogue's commands field (the ⌘-overlay's fact layer, 2026-09-19). The card's
  // evidence rule made mechanical: the SETS below are the documented bare commands (claude: the
  // vendor's command reference on code.claude.com; pi family: the installed pi-coding-agent's
  // usage.md), so a catalogue change must pass by consciously editing THIS check with its new
  // citation — never by drifting. Checks live in this module because there is no harness module:
  // slots is the family that drives the slot surface the overlay serves (e2e/harness.ts is
  // plumbing, no checks). ---
  {
    interface CatCmd { name: string; purpose: string; confirm?: boolean }
    interface CatHarness { id: string; commands: CatCmd[] }
    const cat = ((await (await get("/api/harnesses")).json()) as { harnesses: CatHarness[] }).harnesses;
    const byId = new Map(cat.map((h) => [h.id, h]));
    check("harness catalogue: every adapter carries a commands list",
      cat.length >= 7 && cat.every((h) => Array.isArray(h.commands)),
      JSON.stringify(cat.map((h) => `${h.id}:${h.commands?.length}`)));
    const shape = cat.flatMap((h) => h.commands.map((c) => ({ h: h.id, ...c })));
    check("harness catalogue: every command entry is bare and names one evidence line",
      shape.every((c) => /^\/[A-Za-z][A-Za-z0-9-]*$/.test(c.name) && typeof c.purpose === "string"
        && c.purpose.length >= 8 && !c.purpose.includes("\n")),
      JSON.stringify(shape.filter((c) => !(/^\/[A-Za-z][A-Za-z0-9-]*$/.test(c.name) && typeof c.purpose === "string"
        && c.purpose.length >= 8 && !c.purpose.includes("\n")))));
    const names = (h: string): string[] => (byId.get(h)?.commands ?? []).map((c) => c.name);
    check("harness catalogue: claude lists exactly the documented bare commands",
      JSON.stringify(names("claude")) === JSON.stringify(["/clear", "/compact", "/context", "/usage"]),
      JSON.stringify(names("claude")));
    check("harness catalogue: the pi TUI lists exactly its documented bare commands — on pi, pi-zai and the pi-unfenced spread",
      names("pi").join(",") === "/new,/compact,/session" && names("pi-zai").join(",") === "/new,/compact,/session"
        && names("pi-unfenced").join(",") === "/new,/compact,/session",
      JSON.stringify({ pi: names("pi"), zai: names("pi-zai"), unf: names("pi-unfenced") }));
    // the confirm flag is the safety property: the context-discarding commands must carry it, the
    // read-only ones must not — judged per NAME across every adapter that lists the command.
    const discarding = ["/clear", "/compact", "/new"];
    const readonly = ["/context", "/usage", "/session"];
    const badConfirm = shape.filter((c) => discarding.includes(c.name) !== (c.confirm === true)
      && (discarding.includes(c.name) || readonly.includes(c.name)));
    check("harness catalogue: context-discarding commands carry confirm, read-only ones do not",
      badConfirm.length === 0, JSON.stringify(badConfirm));
    const rows = ((await (await get("/api/sessions")).json()) as { slots: Record<string, unknown>[] }).slots;
    check("the 2s slot poll carries no commands list — the field rides /api/harnesses alone",
      rows.length > 0 && rows.every((s) => !("commands" in s)),
      JSON.stringify(rows.filter((s) => "commands" in s).length));
  }

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

    // --- THE FALSE RECEIPT. An empty composer after Enter is ALSO what a pane that never received
    // the paste looks like, and until 2026-09-21 sendText read the second as the first: the
    // Orchestrator succession of 2026-09-20 23:45 is on the ledger as `send slot=6 succession
    // 3238B observed` while the successor's session transcript holds no such turn and the pane
    // scrollback never echoed one byte of it — the predecessor was retired onto a session that had
    // never been told what it was for. `blackout` is that frame sequence, mechanically: no composer
    // on the frame while the paste arrives (so the arrival read answers `differs`, never `partial`),
    // the payload swallowed, and an ordinary EMPTY composer painted by the Enter itself. The turns
    // ledger is the independent witness that no turn was taken.
    // BREAKS IF: `observed` is returned for an empty post-Enter composer without the arrival read
    // proving the payload was ever on screen.
    const blackoutBefore = turnsOf().length;
    writeFileSync(composerMode, "blackout\n");
    const blind = await post("/send", { slot: 3, text: "blackout-acceptance-probe", submit: true });
    const blindBody = await blind.json() as { receipt?: { acceptance?: string } };
    const blindTurns = turnsOf().slice(blackoutBefore);
    // THE DISCRIMINATOR, without which this check is satisfiable the old way too: `unobservable` is
    // ALSO what the pre-2026-09-21 code returned when no composer was on the frame after the Enter
    // (`after === null`). So the post-Enter frame must be asked directly — composer PRESENT and
    // EMPTY is exactly the read that used to be booked as `observed`, and it is the only state in
    // which this check can only be passed by the arrival-gated verdict.
    const blindFrame = (await tmuxOut("capture-pane", "-p", "-e", "-t", "s3")).out;
    const blindResidue = composerResidue({ kind: "rules" }, blindFrame);
    writeFileSync(composerMode, "normal\n");
    check("acceptance: a pane that painted no composer while the paste arrived is `unobservable` after Enter, never `observed` — the empty composer is not the witness",
      blind.status === 200 && blindBody.receipt?.acceptance === "unobservable"
        && blindResidue === "" && !blindTurns.includes("blackout-acceptance-probe"),
      JSON.stringify({ status: blind.status, acceptance: blindBody.receipt?.acceptance,
        composerAfterEnter: blindResidue === null ? "absent" : `present, ${blindResidue.length} chars`,
        submittedTurn: blindTurns.includes("blackout-acceptance-probe") }));
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

  // Keep one viewer attached while a second forces the resize/reseed branch. The first viewer
  // must receive every live line even when the second captures the pane; the second must see
  // each line once across its capture and the subsequent stream.
  {
    const marks = (text: string) => [...text.matchAll(/T2MARK-(\d+)\b/g)].map((m) => Number(m[1]));
    const complete = (values: number[]) => values.length === 50
      && values.every((n, i) => n === i + 1);
    const first = new WebSocket(wsUrl(2));
    first.binaryType = "arraybuffer";
    let firstText = "", secondText = "", secondSeed = "";
    let firstReady = false, firstError = false, secondError = false;
    first.onmessage = (e) => {
      firstReady = true;
      firstText += new TextDecoder().decode(e.data as ArrayBuffer);
    };
    first.onerror = () => { firstError = true; };
    const waitFor = async (ready: () => boolean, timeoutMs: number): Promise<boolean> => {
      const until = Date.now() + timeoutMs;
      while (Date.now() < until) {
        if (ready()) return true;
        await Bun.sleep(25);
      }
      return ready();
    };
    const attached = await waitFor(() => firstReady || firstError, 5000);
    check("resize reseed fixture: first socket receives its seed", attached && firstReady && !firstError);
    await tmuxOut("send-keys", "-t", "s2", "for i in $(seq 1 50); do echo T2MARK-$i; sleep 0.05; done", "Enter");
    const flowing = await waitFor(() => marks(firstText).length >= 12 || firstError, 10000);
    check("resize reseed fixture: live markers flow before second socket opens",
      flowing && marks(firstText).length >= 12 && !firstError, `${marks(firstText).length} marks`);
    const second = new WebSocket(`${wsUrl(2)}&cols=${reseedCols}&rows=${reseedRows}&force=1`);
    second.binaryType = "arraybuffer";
    second.onmessage = (e) => {
      const frame = new TextDecoder().decode(e.data as ArrayBuffer);
      if (!secondSeed) secondSeed = frame;
      secondText += frame;
    };
    second.onerror = () => { secondError = true; };
    await waitFor(() => (marks(firstText).includes(50) && marks(secondText).includes(50))
      || firstError || secondError, 15000);
    first.close();
    second.close();
    const firstMarks = marks(firstText), secondMarks = marks(secondText), seedMarks = marks(secondSeed);
    check("resize reseed keeps the first socket's live markers exactly once",
      complete(firstMarks), `${firstMarks.length} marks, ${firstMarks[0]}..${firstMarks[firstMarks.length - 1]}`);
    check("forced second socket receives capture and live markers exactly once",
      complete(secondMarks) && seedMarks.length >= 12 && seedMarks.length < 50,
      `${secondMarks.length} marks, ${secondMarks[0]}..${secondMarks[secondMarks.length - 1]}; seed ${seedMarks.length}`);
  }

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
  // the dialog helper (K3) — the drawer-close anchor of the reachability check below lives here
  // since the six risk dialogs lost their own copies
  let dlgSrc: string | null = null;
  try {
    dlgSrc = readFileSync(`${sourceRoot}/src/dialog.ts`, "utf8");
  } catch { dlgSrc = null; }
  // the popover helper (K5) — the ONE outside-click/Escape module the four surfaces must share
  let popSrc: string | null = null;
  try {
    popSrc = readFileSync(`${sourceRoot}/src/popover.ts`, "utf8");
  } catch { popSrc = null; }
  let chatSrc: string | null = null;
  try {
    chatSrc = readFileSync(`${sourceRoot}/src/chatsize.ts`, "utf8");
  } catch { chatSrc = null; }
  check("precondition: node_modules exposes src/client.ts for slot client checks",
    cliSrc !== null, cliSrcError);
  check("precondition: node_modules exposes public/index.html for slot presentation checks",
    indexSrc !== null, indexSrcError);
  if (cliSrc === null || indexSrc === null) return;
  const seedSource = /function seedFramePlan[\s\S]*?\n\}/.exec(cliSrc)?.[0] ?? "";
  check("precondition: the client exposes a pure seed-frame plan for the reconnect probe", seedSource.length > 0);
  if (seedSource) {
    const seedFramePlan = new Function(new Bun.Transpiler({ loader: "ts" }).transformSync(seedSource.replace(/^export /, ""))
      + "\nreturn seedFramePlan;")() as
      (socket: number, current: number, first: boolean) => { reset: boolean; pin: boolean } | null;
    let buffer: string[] = [];
    let pinned = 0;
    for (let generation = 1; generation <= 5; generation++) {
      const stale = seedFramePlan(generation - 1, generation, true);
      if (stale?.reset) buffer = [];
      const seed = seedFramePlan(generation, generation, true);
      if (seed?.reset) buffer = [];
      if (seed?.pin) pinned++;
      buffer.push("seed-1", "seed-2", "seed-3");
      const live = seedFramePlan(generation, generation, false);
      if (live?.reset) buffer = [];
      buffer.push("live-4");
    }
    check("terminal reconnect: five seeds leave each captured line exactly once",
      buffer.join(",") === "seed-1,seed-2,seed-3,live-4" && pinned === 5,
      `${buffer.join(",")} · pinned ${pinned}`);
    check("terminal reconnect: a detached socket cannot reset or write into the new pane",
      seedFramePlan(4, 5, true) === null && seedFramePlan(5, 5, false)?.reset === false);
    check("terminal reconnect: only the first frame requests reset and pin",
      seedFramePlan(5, 5, true)?.reset === true && seedFramePlan(5, 5, true)?.pin === true
        && seedFramePlan(5, 5, false)?.pin === false);
  }
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
  check("client: the switch is persisted per device and read back at boot — through the prefs registry (G5.1)",
    /prefSetBool\("fleet\.datasaver", on\)/.test(cliSrc)
    && /let dataSaver = prefBool\("fleet\.datasaver"\)/.test(cliSrc), "setSaver / dataSaver in src/client.ts");
  // K2 (Grammatik G5.1): the registry in src/prefs.ts is the ONE localStorage home. No consumer
  // carries a naked call anymore, and every key named through prefs is a row of the PREFS table —
  // a key that reads or writes without being registered would be invisible in the settings window.
  let prefsSrc: string | null = null, shareSrc: string | null = null, helperSrc: string | null = null;
  try { prefsSrc = readFileSync(`${sourceRoot}/src/prefs.ts`, "utf8"); } catch { prefsSrc = null; }
  try { shareSrc = readFileSync(`${sourceRoot}/src/share.ts`, "utf8"); } catch { shareSrc = null; }
  try { helperSrc = readFileSync(`${sourceRoot}/src/helper.ts`, "utf8"); } catch { helperSrc = null; }
  const lsCall = /localStorage\.(getItem|setItem|removeItem)/;
  const prefCall = /pref(?:SetBool|Set|Bool|Number|Text|JSON|Def|Raw)\("([^"]+)"/g;
  const sources = [cliSrc, chatSrc, shareSrc, helperSrc];
  const namedKeys = sources.flatMap((s) => s ? [...s.matchAll(prefCall)].map((m) => m[1]!) : []);
  check("client: the prefs registry is the ONE localStorage home — no naked call outside src/prefs.ts",
    prefsSrc !== null && lsCall.test(prefsSrc)
    && sources.every((s) => s === null || !lsCall.test(s)),
    JSON.stringify({ prefs: prefsSrc !== null, naked: sources.map((s) => s === null ? "missing" : lsCall.test(s)) }));
  check("client: every key the code reads or writes through prefs stands in the PREFS table",
    namedKeys.length >= 20 && namedKeys.every((k) => prefsSrc!.includes(`key: "${k}"`)),
    JSON.stringify([...new Set(namedKeys.filter((k) => !prefsSrc!.includes(`key: "${k}"`)))]));

  // --- the chat view's SENT bubble (docs/messungen/2026-09-22-chat-absenden-zeitleiste.md): a
  // send showed nothing until POST /send answered AND the next chat poll brought the transcript
  // entry — 0.4–1.7 s idle, 6.4 s mid-turn, measured in a browser against a scratch instance. The
  // decision is run for real; the wiring is asserted by shape (no DOM here, same limits as above).
  check("pending bubble: the transcript's own text retires it, re-wrapped whitespace included",
    pendingSettledBy("fix it\nnow", "fix it\nnow") && pendingSettledBy("fix it\nnow ", " fix  it now"));
  check("pending bubble: a DIFFERENT turn does not retire it — neither another text nor a prefix of it",
    !pendingSettledBy("fix it now", "fix it later") && !pendingSettledBy("fix it now", "fix it"));
  check("pending bubble: an empty or whitespace-only text never settles anything",
    !pendingSettledBy("", "") && !pendingSettledBy("  \n", " "));
  check("client: doSend shows the pending bubble BEFORE it awaits POST /send, and drops it when delivery fails",
    /const pending = pane\.addPending\(outgoing\);\s*try \{\s*if \(!await deliver\(slot, outgoing\)\) \{ if \(pending\) pane\.dropPending\(pending\); return; \}/.test(cliSrc),
    "doSend in src/client.ts");
  check("client: a user entry from the transcript retires its pending bubble through src/pendingsend.ts",
    /import \{ pendingSettledBy \} from "\.\/pendingsend"/.test(cliSrc)
    && /if \(e\.role === "user"\) this\.settlePending\(text\);/.test(cliSrc)
    && /this\.pending\.find\(\(p\) => pendingSettledBy\(p\.text, text\)\)/.test(cliSrc),
    "Pane.appendEntry / settlePending in src/client.ts");
  check("client: a composer reshape does not refit a terminal the chat view hides; the way back refits it",
    /for \(const p of panes\) if \(!p\.isChat\) p\.refit\(\);/.test(cliSrc)
    && /else \{ this\.refit\(\); this\.term\.focus\(\); \}/.test(cliSrc),
    "reshapeSurface settle / Pane.setView in src/client.ts");

  // --- G0.5 OWNER VOCABULARY (owner 2026-09-22, card K9): the four surfaces this lane re-worded
  // — the Info-Tab's succession block, the suite meter's stretch, the deploy-due lines, the
  // .slotact strip — plus tray and founding window. Per surface ONE check whose anchors are the
  // visible words themselves: the owner word PRESENT, the old jargon ABSENT, and the German
  // one-sentence tooltip that explains it. "Rail"→"Kind", "Suites"→"Checks", "suite offer"→
  // "offered check run", "queued suite"→"queued check run", "suite gate · held by pid N"→
  // "check run busy · pid N" are MAIN-derived (Slot 13, aus audit→check) — owner sighting open.
  check("G0.5 succession block: the rows read Kind/Handoff in owner words and their tooltips explain in German",
    cliSrc.includes('srow("Kind", sc.rail') && !cliSrc.includes('srow("Rail"')
    && cliSrc.includes("this kind's own threshold is 0") && !cliSrc.includes("this rail's own threshold is 0")
    && cliSrc.includes("gegen diese Zahl misst der Server, wann die Session weitergeben soll (intern: succession fill · threshold)")
    && !cliSrc.includes("the measurement the succession threshold is compared against")
    && cliSrc.includes("Die Nachfolge ist eine frische Session auf DIESEM Worktree")
    && !cliSrc.includes("watches, autos and reports carry by id"),
    "srow labels + tooltips in src/client.ts");
  check("G0.5 suite stretch: the meter reads Checks, its status lines and ball names carry no suite/audit/gate",
    cliSrc.includes('el("span", "smtitle", "Checks")') && !cliSrc.includes('"smtitle", "Suites"')
    && !cliSrc.includes("suite gate ·") && cliSrc.includes("check run busy · ")
    && cliSrc.includes("⏳ post-land check · ") && !cliSrc.includes("⏳ post-land audit · ")
    && cliSrc.includes("waiting for its check · ") && !cliSrc.includes("waiting for an audit · ")
    && cliSrc.includes("Angefragt, nicht gestartet") && !cliSrc.includes("asked for, not started")
    && cliSrc.includes("nothing reported running") && !cliSrc.includes("nothing on the gate")
    && cliSrc.includes("· Klick öffnet die Lane") && !cliSrc.includes("click to open the lane"),
    "meter head, gate lock head, audit rows in src/client.ts");
  check("G0.5 deploy due: consequence + action in owner words, the command and srv/bundle live in the tooltip",
    cliSrc.includes("the running server is ") && !cliSrc.includes("srv is running") && !cliSrc.includes("restart srv")
    && cliSrc.includes("the code in the browser is older than src/") && !cliSrc.includes("client bundle"),
    "deploySection in src/client.ts");
  check("G0.5 slotact strip: the hover actions explain in German, not in internal verbs",
    cliSrc.includes("Diese Session beenden — was sie gerade tut, geht verloren (intern: kill).")
    && !cliSrc.includes('title = "kill session"')
    && cliSrc.includes("Konflikte, die der Agent aufgelöst hat")
    && !cliSrc.includes('rb.title = "agent conflict resolutions')
    && cliSrc.includes("Diese Session hat geplante Prompts")
    && cliSrc.includes("Gäste-Chat — "),
    "slotact titles in src/client.ts");
  check("G0.5 tray and founding window: German tooltips, Fleet-English labels untouched",
    cliSrc.includes("Dateien an diese Session anhängen.") && !cliSrc.includes("attach files to this session")
    && cliSrc.includes("Klick blendet die Worktree-Lanes aus") && !cliSrc.includes("worktree lanes hidden")
    && indexSrc.includes("Live-Mitschreiben") && indexSrc.includes("Prompt-Verlauf")
    && indexSrc.includes("Geplante Prompts für diese Session"),
    "tray titles in client.ts + public/index.html");

  // --- the board's SECTION ORDER. The owner set it twice: §F4 (briefs/ui-next-level-2026-08-06.md)
  // and the redesign of 2026-09-18/19 — machine alarms → head → changes → checks → history → the
  // sections and one fold. Nothing else in the suite would notice a re-sort
  // undoing it. Asserted as a RELATIVE order over renderBoard's own pushes (and, for the tools, its
  // fold calls), so a section inserted between two of them does not trip it — only a reordering
  // does. This suite has no DOM, so the source is the evidence; the rendered result was checked by
  // screenshot (see the commit).
  const boardSrc = cliSrc.slice(cliSrc.indexOf("async function renderBoard()"), cliSrc.indexOf("$(\"boardclose\")"));
  const pushOrder = [...boardSrc.matchAll(/nodes\.push\((\w+)\)/g)].map((m) => m[1]);
  const at = (name: string) => pushOrder.indexOf(name);
  const foldOrder = [...boardSrc.matchAll(/boardFold\("(\w+)"/g)].map((m) => m[1]);
  // `gsec` (the guest-console panel) left with the console itself, 2026-08-08, and `dsec1` (the
  // helper register) left for the meter's device count, 2026-09-19 — both absences are asserted,
  // so a re-added machine-level section has to state where it goes.
  check("client: the board renders in the owner's order — alarms → head → setup → changes → checks → history → lanes → tools",
    at("dsec0") >= 0 && at("dsec0") < at("esec0") && at("esec0") < at("idsec")
    && at("idsec") < at("su") && at("su") < at("work")
    && at("work") < at("ck") && at("ck") < at("csec") && at("csec") < at("lsec") && at("lsec") < at("tsec")
    && at("gsec") === -1 && at("dsec1") === -1,
    JSON.stringify(pushOrder));
  // SETUP is what the session is MADE of — owner, 2026-09-19: "das gewählte profil einer session
  // anzeigen + ctxPacks … den aufbau der aktuellen session ersichtlich machen". The two fields he
  // named are asserted by name, and so is the ONE number that deliberately did NOT go in here:
  // the context fill moves every minute, so it belongs to the head's state line, not to a block
  // of founding choices. Source is the evidence — this suite has no DOM.
  const setupSrc = boardSrc.slice(boardSrc.indexOf('el("div", "bsec bsetup")'), boardSrc.indexOf("if (brief) {"));
  check("client: the setup block names the profile and the context packs",
    /row\("Profile", setup\?\.profile \?\? "standard"/.test(setupSrc)
    && /const packs = setup\?\.packs \?\? \[\];/.test(setupSrc)
    // a chip is a BUTTON since the packs became openable — the span form was the read-only one
    && /el\("button", "bspack", p\.id\)/.test(setupSrc), "the setup section in renderBoard");
  // A pack is a POINTER LIST. The board may open what it points at, and must never present a
  // span as "the pack's content": an anchor has no end (context-pack-validator.ts), so any span
  // would be this seam's invention. The window therefore shows pointers and hands over the FILE,
  // read at the commit the receipt names — and a PRIVATE pack, whose source is outside the repo,
  // must not be made to look openable.
  const packsSrc = cliSrc.slice(cliSrc.indexOf("function openPacks("), cliSrc.indexOf("async function renderBoard()"));
  check("client: a pack chip opens that pack",
    /chip\.onclick = \(\) => openPacks\(setup, p\.id\)/.test(setupSrc), "the pack chips in renderBoard");
  check("client: the pack window shows POINTERS and opens the source file at the receipt's commit",
    /el\("div", "cpkpath", src\.path\)/.test(packsSrc) && /el\("div", "cpkanchor", src\.anchor\)/.test(packsSrc)
    && /showFileView\(shell, \{/.test(packsSrc)
    && /setup\.repo && setup\.head \? \{ path: src\.path, repo: setup\.repo, rev: setup\.head \}/.test(packsSrc)
    && /an anchor is where to start reading, not a span/.test(packsSrc), "openPacks in src/client.ts");
  check("client: a private pack is shown as unreadable, with no source row to click",
    /if \(p\.privateSourceId\) \{/.test(packsSrc)
    && /the server cannot read it/.test(packsSrc), "openPacks in src/client.ts");
  check("client: the omitted packs are listed with their reason, not silently dropped",
    /setup\.omitted\.length/.test(packsSrc) && /el\("span", "cpkn", o\.why\)/.test(packsSrc), "openPacks in src/client.ts");
  // THE WINDOW IS ACTUALLY STYLED. Its rules hung on `#packs` while openShell gives the overlay
  // `id="shell-packs"` (src/shell.ts), so every rule missed and the buttons rendered as UA chrome
  // inside a black window; the class names also collided with the file picker's global .pk*
  // family, which then styled them wrongly. Both are asserted here, because neither is visible
  // in any DOM-less check other than this one.
  check("client: the packs window's CSS targets the shell id it actually gets, with its own class family",
    indexSrc.includes("#shell-packs .cpkrow") && !/#packs \./.test(indexSrc)
    && !/"pkrow"|"pkid"|"pksub"|"pksrc"/.test(cliSrc),
    "public/index.html + openPacks");
  check("client: a pack list says whether it was DELIVERED or merely declared — intent never passes for delivery",
    /packsFrom === "receipt"/.test(setupSrc) && /delivered with the founding brief/.test(setupSrc)
    && /declared by this session's program/.test(setupSrc), "the packs note in renderBoard");
  // THE SUCCESSION NUMBERS in the head (owner, 2026-09-20: they belong in the identity block he
  // signed off). Four label/value rows, every value read off the brief's server-computed block —
  // the two traps being a board that prints a threshold nobody armed, and one that draws an
  // unmeasurable context as 0 %. Source is the evidence; this suite has no DOM, and the served
  // numbers themselves are measured live in e2e/watch.ts against tickMigrate's own fixture.
  const succSrc = boardSrc.slice(boardSrc.indexOf("if (brief?.succession) {"),
    boardSrc.indexOf("// identifiers: machine strings in mono"));
  check("client: the head names all four succession facts — fill, handover threshold, kind, handoff (G0.5: rail→Kind, MAIN-abgeleitet)",
    /srow\("Fill",/.test(succSrc) && /srow\("Handover",/.test(succSrc)
    && /srow\("Kind", sc\.rail/.test(succSrc) && !/srow\("Rail"/.test(succSrc) && /srow\("Handoff",/.test(succSrc),
    "the succession rows in renderBoard");
  check("client: an unmeasurable fill reads \"not measurable\" — the percentage exists only inside the sc.fill branch",
    /: "not measurable"/.test(succSrc)
    && /sc\.fill\n?\s*\? `\$\{tok\(sc\.fill\.usedTokens\)\} \/ \$\{tok\(sc\.fill\.windowTokens\)\} · \$\{Math\.round\(sc\.fill\.pct\)\} %`/.test(succSrc),
    "the Fill row in renderBoard");
  check("client: a threshold is printed only when the server sent one, otherwise the named reason",
    /sc\.thresholdPct !== null \? `at \$\{sc\.thresholdPct\} % — \$\{nudge\}`/.test(succSrc)
    && /`off — \$\{offWhy\[sc\.thresholdOff \?\? "rail"\]\}`/.test(succSrc),
    "the Handover row in renderBoard");
  check("client: the cap is drawn only where one exists — without one the row says `no cap`, never 0 of 5",
    /sc\.cap !== null \? `Session \$\{sc\.session\} · \$\{sc\.taken \?\? 0\} of \$\{sc\.cap\}`/.test(succSrc)
    && /`Session \$\{sc\.session\} · no cap`/.test(succSrc), "the Handoff row in renderBoard");
  // THE SPACE CUT (owner, 2026-09-20: "vllt muss dann noch etwas für platz usw. optimiert
  // werden"). Three lines left the column, and each of them was a REPETITION or a non-event, never
  // a fact: the setup block's `Type` row said what the head's own state line says word for word,
  // the `Packs: none` row spent a line on the ordinary case, and the Checks section drew a headed
  // "No suite reported" on every session that was not running one. Asserted as ABSENCES, with the
  // fact each one was standing in for asserted beside it, so a re-added copy trips this.
  check("client: the session's KIND is said once — the head's state line, not a second Setup row",
    !/row\("Type",/.test(setupSrc)
    && /brief\?\.worktree \? "lane" : "repo session"\} in slot \$\{slot\}/.test(boardSrc),
    "the Type row vs the head's state line");
  check("client: a session with no packs draws no `none` row — absence is the ordinary case",
    !/row\("Packs", "none"/.test(setupSrc) && /if \(packs\.length\) \{/.test(setupSrc),
    "the packs branch in renderBoard");
  check("client: an empty Checks section is not drawn at all, and a session WITH runs still gets one",
    /if \(mine\.length\) nodes\.push\(ck\);/.test(boardSrc)
    && !/No suite reported in the last few minutes/.test(cliSrc),
    "the Checks section in renderBoard");
  // WHOSE FACT: every section head carries one word from the closed set, and the two machine
  // alarms — which have no head of their own — carry it as their first line. A section that
  // re-appears without one is the confusion this cut exists to end (a fleet number read as a
  // session number), so the check is over the CALL SITES, not over a sample.
  check("client: every board section head names its reach — session · repo · machine · fleet",
    !/appendChild\(el\("h3", "",/.test(boardSrc) && !/el\("h3", "", "Setup"\)/.test(cliSrc)
    && /boardHead\("Changes", "session"\)/.test(boardSrc) && /boardHead\("Checks", "session"\)/.test(boardSrc)
    && /boardHead\("History", "repo"\)/.test(boardSrc) && /boardHead\(`Lanes in \$\{baseName\(wts\.repo\)\}`, "repo"\)/.test(boardSrc)
    && /boardHead\("helper devices", "fleet"\)/.test(cliSrc)
    && /sec\.appendChild\(scopeTag\("machine"\)\);/.test(cliSrc),
    "the section heads in renderBoard");
  check("client: the scope vocabulary is CLOSED — four words, each with a sentence saying what it covers",
    /type BoardScope = "session" \| "repo" \| "machine" \| "fleet";/.test(cliSrc)
    && /const SCOPE_TITLE: Record<BoardScope, string>/.test(cliSrc),
    "BoardScope in src/client.ts");
  // …and the meter is the FLEET one, which is the whole reason the vocabulary exists. Its head
  // says so, and where another instance is configured it names the end of its own reach rather
  // than letting an empty station read as a quiet fleet — FLEET_INSTANCES is a link list, not a
  // federation, so nothing here can see that fleet's runs.
  check("client: the suite meter's head carries the fleet scope and names what it CANNOT see",
    /const scopeTag = el\("span", "bscope", "fleet"\);/.test(cliSrc)
    && /instanceLinks\.filter\(\(l\) => l\.name !== instanceName\)/.test(cliSrc)
    && /el\("span", "smscope", `\$\{instanceName \?\? "this machine"\}`\)/.test(cliSrc) && /kein Verbund/.test(cliSrc),
    "renderSuiteMeter's head");
  // …and the place is the column that may NEVER give way. The row is ~267 px wide at the board's
  // real width, so something has to: the lane name shrinks, the suite name shrinks, the machine
  // does not — it is the half a truncated row used to lose. The STATE is not a column at all any
  // more; it rides the dot and the row's station class, because the tube above already draws it
  // twice (the ball's position, and the count under its station).
  check("client: a meter row draws the PLACE in its own span, and that span never shrinks",
    /el\("span", "smplace", b\.where\)/.test(cliSrc)
    && /\.smplace \{ flex: none; margin-left: auto;/.test(indexSrc)
    && /\.smname \{ flex: 0 1 auto;/.test(indexSrc) && /\.smwhat \{ flex: 1 1 auto;/.test(indexSrc),
    "the meter row + its CSS");
  check("client: the state is NOT a fourth column — it is the row's station class and its dot",
    /`smrow tone-\$\{b\.tone\} st-\$\{b\.station\}/.test(cliSrc)
    && /\.smrow\.st-wait \.smdot \{ background: none;/.test(indexSrc)
    && !/el\("span", "smwhere", meterState\(b\)\)/.test(cliSrc),
    "renderSuiteMeter's rows");

  // model, effort and the sidebar's ctx CHIP are the row's job — the owner called them redundant in
  // the board on 2026-09-19, and a second copy is exactly what a "misslungener Aufbau" is made of.
  // The 2026-09-20 succession group does not reopen that door: its fill arrives on the BRIEF, paired
  // with the threshold it is compared against, and `s.ctx` stays out of this column entirely.
  // NOTHING IN THIS COLUMN TWITCHES. It is rebuilt whole every 3s, so the three things a reader
  // holds across a tick — the scroll offset, the keyboard focus, and an open menu — have to be
  // carried by hand. The menu is bound to the slot it was opened on, or it would hang one
  // session's actions under another session's name.
  check("client: a repaint keeps the reading position, the keyboard focus and nothing else",
    /const focusKey = \(\(\): string \| null =>/.test(boardSrc)
    && /boardBody\.scrollTop = y;/.test(boardSrc)
    && /if \(boardMenuOpen && boardMenuSlot !== slot\) boardMenuOpen = false;/.test(boardSrc),
    "renderBoard's paint step");
  check("client: the no-session branch rescues the scroll too, and the dead bnone selector is gone",
    /const y0 = boardBody\.scrollTop;/.test(boardSrc) && !/bnone/.test(cliSrc) && !/bnone/.test(indexSrc),
    "renderBoard's empty branch");
  // ONE PALETTE. The landed chat/queue tokens are the single source (Stilvorgabe 2026-09-19), and
  // the column ran 47 hand-written hex values beside them until 2026-09-20.
  {
    const boardCss = indexSrc.split("\n").filter((l) => /^  #(board|boardhead|boardbody|boardsuites|shell-packs)\b/.test(l));
    const withHex = boardCss.filter((l) => /#[0-9a-fA-F]{3,6}\b/.test(l.slice(l.indexOf("{"))));
    check("client: the board's CSS carries no palette of its own — every colour is a --chat-* token",
      withHex.length === 0 && boardCss.some((l) => l.includes("--b-ink: var(--chat-ink)")),
      withHex.slice(0, 3).join(" | ") || `${boardCss.length} rules, none with a literal colour`);
  }
  check("client: the board repeats neither the model, the effort nor the context fill",
    !/s\.model/.test(boardSrc) && !/s\.effort/.test(boardSrc) && !/s\.ctx/.test(boardSrc),
    "renderBoard vs the sidebar row");
  // the lanes list LEFT the folded tools on 2026-09-19 ("die commits und auch die worktree's vllt
  // doch lieber direkt voll einsehen") — it is a section now, and its absence from the fold list is
  // asserted so it cannot quietly fold itself away again.
  // Files and Lanes became SECTIONS (owner, 2026-09-19/20: the lane map read as often as the
  // commits, and the explorer "ohne ausklappen"), and the advisory agents left the column
  // entirely. What remains behind a disclosure is the prompt outline, and only that.
  // what is left behind a disclosure is exactly two things a reader reaches for rarely: the base
  // branch's own history, and the prompt outline. files/lanes/agents are NOT among them.
  check("client: only 'already in main' and the prompt outline are folded — files, lanes and agents are not",
    foldOrder.join(",") === "repoCommits,prompts",
    JSON.stringify(foldOrder));
  check("client: the file tree is a section of its own, with the scroll box that keeps it in place",
    /nodes\.push\(fx\)/.test(boardSrc) && /fileTreeSection\(slot, s\.cwd\)/.test(boardSrc)
    && /#board \.fxtree \{[^}]*max-height/.test(indexSrc) && /\.fxtree \{[^}]*overflow-y: auto/.test(indexSrc),
    "the files section in renderBoard + #board .fxtree");
  // …and both long lists are shown WHOLE. A silent client-side cut is the one thing they must not
  // do; where the SERVER caps (200 status lines, the newest 50 commits), the board names the cap
  // instead of letting a cut list read as "all of it".
  check("client: the file and commit lists are not truncated in the client, and a server cap is named",
    !/brief\.uncommittedFiles\.slice\(/.test(boardSrc) && !/brief\.files\.slice\(/.test(boardSrc)
    && /brief\.uncommitted > brief\.uncommittedFiles\.length/.test(boardSrc)
    && /the server reads at most 200 status lines/.test(boardSrc)
    && /ahead > brief\.commits\.length/.test(boardSrc) && /the brief carries the newest \$\{brief\.commitsCap\}/.test(boardSrc),
    "the changes + history sections in renderBoard");
  // EVERY number the column prints is compared against a total the SERVER measured — never
  // against a length the client derived from the very list it is describing. The "and N more"
  // line under the changed files did exactly that until 2026-09-20 and contradicted the loop
  // above it, and the time-scoped 15-commit cut said nothing at all.
  check("client: a capped list is reported against the server's own total, not against itself",
    /brief\.filesTotal > brief\.files\.length/.test(boardSrc)
    && !/brief\.files\.length - 30/.test(boardSrc)
    && /!brief\.laneScoped && brief\.commits\.length >= brief\.commitsCap/.test(boardSrc),
    "the history section in renderBoard");
  // ↻ THE REBASE BUTTON carries the count, so the column never shows a number without the action
  // that fixes it — and never the action without its reason. What it does NOT do is half of what
  // it says: no verify, no land (owner-set contract, 2026-09-20).
  check("client: the rebase button carries the behind-count and only a lane gets one",
    /Rebase — \$\{behind\} behind \$\{baseName_\}/.test(boardSrc)
    && /if \(behind && brief\.laneScoped\) \{/.test(boardSrc)
    && /post\(`\/api\/slots\/\$\{slot\}\/rebase`/.test(cliSrc), "the changes section in renderBoard");
  check("client: after a rebase the column says the verify chain must be run again",
    /Nothing was verified and nothing was landed: run the verify chain again before landing/.test(cliSrc),
    "doRebase in src/client.ts");
  check("client: a refused or conflicting rebase shows the server's own sentence and its files",
    /rebaseNote\.set\(slot, \{ ok: false/.test(cliSrc) && /note\.files\?\.length/.test(boardSrc)
    && /the worktree could not be confirmed unchanged/.test(cliSrc), "doRebase + the changes section");
  // A FAILED READ IS NOT AN EMPTY SESSION — each of the four reads behind this column says so in
  // its own words, where its content would have been.
  check("client: a failed brief, lane map, transcript or error read is NAMED, not rendered as empty",
    /The session brief could not be read/.test(boardSrc)
    && /The lane map could not be read/.test(boardSrc)
    && /The transcript could not be read/.test(boardSrc)
    && /The error list could not be read/.test(cliSrc)
    && /This is a failed read, not an empty session/.test(boardSrc),
    "the failure sections in renderBoard");
  check("client: the errors fetch can no longer end in an unhandled rejection",
    /void api\("\/api\/errors"\)[\s\S]{0,700}?\}\)\.catch\(\(\) => \{/.test(cliSrc),
    "errorsSection in src/client.ts");
  // the suite ages in this column are the SERVER's stamps; this pane's clock may sit minutes away
  check("client: a check's age is measured against the corrected server clock",
    /gateAge\(serverClock\(\) - b\.at\)/.test(boardSrc), "the checks section in renderBoard");
  // THE ADVISORY AGENTS ARE GONE from this column (owner, 2026-09-20: "die agenten auch vorerst
  // rauschmeißen (veraltetes Setup hinter den buttons)"). Removed, not hidden: no buttons, no
  // caches, no session-only fold machinery. The SERVER routes stay, because the ③ auto-review
  // writes the outcome ledger through them — asserted here so a cleanup cannot take them too.
  check("client: the advisory agent buttons and their caches are gone from the board",
    !/"Review changes"/.test(cliSrc) && !/"Summarize"/.test(cliSrc)
    && !/sumCache|revCache|sumBusy|revBusy|FOLD_SESSION_ONLY/.test(cliSrc)
    && !/boardFold\("agents"/.test(cliSrc), "src/client.ts");
  // …and the routes themselves are proven ALIVE, not by reading source: the ③ auto-review and the
  // share view still reach them, so a GET must answer for a live slot.
  const sumProbe = await get("/api/slots/1/summary");
  check("server: the summary route survives the board's cleanup (cache GET still answers)",
    sumProbe.status === 200, `status=${sumProbe.status}`);

  // --- stable lane anchor creation. Slots 3/4 are deliberately real same-repo mains: the first
  // request names slot 3 exactly; the generic route chooses the last-active eligible main once.
  // Slot 4 runs from a subdirectory, proving the join is through git's canonical toplevel and not
  // a cwd string. Every temporary lane is landed before this family returns. ---
  check("lane-anchor fixture has the throwaway git repository", !!REPO, REPO || "FLEET_E2E_REPO absent");
  if (REPO) {
    type AnchorWireSlot = {
      id: number; cwd: string | null; openedAt?: number; repo?: string | null; lastOutput: number;
      label?: string | null; name?: string;
      worktree?: { repo: string; branch: string; anchor?: LaneAnchor; letter?: string } | null;
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

    // --- S3a: DER LANE-BUCHSTABE WIRD FEST VERGEBEN. Two lanes opened into band 4 take A and B as
    // PERSISTED fields on their refs; landing A frees the letter and never renames B; the next
    // opener takes A again; the letters ride a srv restart out of fleet.json; and a state row
    // carrying a field this loader has never heard of loads without error — the tolerance an
    // older reader gives the letter field itself. Every lane is landed before the family returns. ---
    {
      const m4 = (await ownerSlots()).find((s) => s.id === 4);
      const letterLane = async (branch: string): Promise<{ slot?: number; letter?: string }> => {
        const res = await post("/api/lanes", {
          repo: REPO, branch, parent: { slot: 4, openedAt: m4?.openedAt },
        });
        if (!res.ok) return {};
        const j = (await res.json()) as { slot?: number };
        let row = (await ownerSlots()).find((s) => s.id === j.slot);
        for (let i = 0; i < 40 && !row?.worktree?.letter; i++) {
          await Bun.sleep(50);
          row = (await ownerSlots()).find((s) => s.id === j.slot);
        }
        return { slot: j.slot, letter: row?.worktree?.letter };
      };
      const a = await letterLane("e2e-letter-a");
      const b = await letterLane("e2e-letter-b");
      check("two lanes opened into one band take the smallest free letters, A then B, as persisted fields",
        !!a.slot && !!b.slot && a.letter === "A" && b.letter === "B", JSON.stringify({ a, b }));

      // --- S3c: 4A IS AN ADDRESS OF THE OWNER ROUTES. The name resolves through the persisted
      // letter, never through the band number: a rename sent to /api/slots/4A must move lane A's
      // label and leave MAIN 4's alone. A never-given name is 404 naming it. ---
      const named = await ownerSlots();
      const rowA = named.find((s) => s.id === a.slot);
      const main4Label = named.find((s) => s.id === 4)?.label;
      check("GET /api/sessions carries each lane's name, and none on the MAIN of its band",
        rowA?.name === "4A" && named.find((s) => s.id === b.slot)?.name === "4B"
        && named.find((s) => s.id === 4)?.name === undefined,
        JSON.stringify(named.filter((s) => s.id === 4 || s.id === a.slot || s.id === b.slot)
          .map((s) => ({ id: s.id, name: s.name }))));
      const byName = await post("/api/slots/4A/rename", { label: "via-4A" });
      const afterByName = await ownerSlots();
      check("/api/slots/4A/… reaches lane 4A and never band 4",
        byName.ok && afterByName.find((s) => s.id === a.slot)?.label === "via-4A"
        && afterByName.find((s) => s.id === 4)?.label === main4Label,
        `${byName.status} ${JSON.stringify(afterByName.filter((s) => s.id === 4 || s.id === a.slot)
          .map((s) => ({ id: s.id, label: s.label })))}`);
      const neverGiven = await post("/api/slots/9A/rename", { label: "x" });
      const neverText = await neverGiven.text();
      check("a never-given lane name answers 404 with the name in the text",
        neverGiven.status === 404 && neverText.includes("9A"), `${neverGiven.status} ${neverText.slice(0, 160)}`);

      // THE SONDE: land A. The survivor's name must not move.
      const landedA = a.slot ? await post(`/api/slots/${a.slot}/land`, {}) : null;
      check("letter fixture: lane A lands through the normal path", landedA?.ok === true,
        JSON.stringify(landedA ? await landedA.json() : "no slot").slice(0, 160));
      let bRow = (await ownerSlots()).find((s) => s.id === b.slot);
      for (let i = 0; i < 40 && bRow?.worktree?.letter !== "B"; i++) {
        await Bun.sleep(50);
        bRow = (await ownerSlots()).find((s) => s.id === b.slot);
      }
      check("landing a neighbour frees the letter but never renames the survivor — B is still B",
        bRow?.worktree?.letter === "B", JSON.stringify(bRow?.worktree));
      const freed = await post("/api/slots/4A/rename", { label: "x" });
      const freedText = await freed.text();
      check("a freed lane name answers 404 with the name in the text",
        freed.status === 404 && freedText.includes("4A"), `${freed.status} ${freedText.slice(0, 160)}`);
      const c = await letterLane("e2e-letter-c");
      check("the next opener in the band takes the freed smallest letter A again",
        !!c.slot && c.letter === "A", JSON.stringify(c));

      // S3c: the letter A is handed out again, so a caller that read lane A's occupant before the
      // land still holds A's openedAt. Its pin must refuse (409, nothing done); the current pin runs.
      const cOpenedAt = (await ownerSlots()).find((s) => s.id === c.slot)?.openedAt;
      const stalePin = await post(`/api/slots/4A/rename?openedAt=${rowA?.openedAt}`, { label: "stale" });
      const staleText = await stalePin.text();
      const afterStale = (await ownerSlots()).find((s) => s.id === c.slot);
      check("a re-given letter under the old occupant's openedAt pin answers 409 and changes nothing",
        stalePin.status === 409 && staleText.includes("4A") && !!rowA?.openedAt
        && rowA.openedAt !== cOpenedAt && afterStale?.label !== "stale",
        `${stalePin.status} ${staleText.slice(0, 160)}`);
      const freshPin = await post(`/api/slots/4A/rename?openedAt=${cOpenedAt}`, { label: "via-pin" });
      check("...and the current occupant's pin reaches the lane that holds 4A now",
        freshPin.ok && (await ownerSlots()).find((s) => s.id === c.slot)?.label === "via-pin",
        String(freshPin.status));

      // ONE RESTART CARRIES BOTH HALVES: the stored letters ride the boot out of fleet.json, and a
      // row holding a field this loader has never heard of (planted while the server is down, the
      // way a different-generation writer would) loads without error — letter kept, junk dropped by
      // the field-by-field restore. The loader does not branch on junk presence, so the clean-file
      // case is the same code path through the same boot; the suite keeps its boot budget for the
      // windows the later modules actually measure.
      await stopSrv();
      const statePath = `${ROOT}/fleet.json`;
      const state = await Bun.file(statePath).json() as
        { slots?: Record<string, { worktree?: Record<string, unknown> }> };
      const bWt = state.slots?.[String(b.slot)]?.worktree;
      if (bWt) bWt.stern = 7;
      await Bun.write(statePath, JSON.stringify(state));
      await restartSrv();
      const afterBoot = (await ownerSlots()).filter((s) => s.id === b.slot || s.id === c.slot);
      check("the stored letters ride a srv restart out of fleet.json",
        afterBoot.find((s) => s.id === b.slot)?.worktree?.letter === "B"
        && afterBoot.find((s) => s.id === c.slot)?.worktree?.letter === "A",
        JSON.stringify(afterBoot.map((s) => ({ id: s.id, letter: s.worktree?.letter }))));
      const junkRow = (await ownerSlots()).find((s) => s.id === b.slot);
      check("a state row with an unknown field loads: the letter is kept, the junk key is dropped",
        junkRow?.worktree?.letter === "B"
        && (junkRow?.worktree as Record<string, unknown> | null | undefined)?.stern === undefined,
        JSON.stringify(junkRow?.worktree));

      const cleanB = await post(`/api/slots/${b.slot}/land`, {});
      const cleanC = await post(`/api/slots/${c.slot}/land`, {});
      check("letter fixture cleans up through the normal land path", cleanB.ok && cleanC.ok,
        `${cleanB.status}/${cleanC.status}`);
    }

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
    // --- A LANE'S ONE ADDRESS. The suffix rule that stood here (shortest unique tail of the branch)
    // is gone: a lane is called after the band of the main it hangs under (3A, 16B), the owner's
    // confirmed model, and that name is the only one the bar shows. What the suffix rule had to
    // ITERATE for — uniqueness — this one has by construction, so what is worth checking moved: that
    // the band is the anchor's slot number, that the letters count within one band and not across
    // the bar, that a bandless lane lands on band 0 rather than colliding with band 1, and that
    // neither ordering of the input changes an answer.
    const refSrc = cut("const bandLetter =", "// THE FOUR STATES A ROW");
    type BandStack = { anchor: { id: number } | null; lanes: { id: number; worktree?: { letter?: string } | null }[] };
    let laneBandNames: ((stacks: readonly BandStack[]) => Map<number, string>) | null = null;
    try {
      laneBandNames = new Function(new Bun.Transpiler({ loader: "ts" }).transformSync(refSrc)
        + "\nreturn laneBandNames;")() as (stacks: readonly BandStack[]) => Map<number, string>;
    } catch { laneBandNames = null; }
    check("probe: lane band names are a liftable DOM-free pure helper",
      !!laneBandNames && !/document|HTMLElement|localStorage|Math\.random/.test(refSrc),
      refSrc.slice(0, 90) || "no laneBandNames block");

    const oneBand = laneBandNames?.([{ anchor: { id: 3 }, lanes: [{ id: 7 }, { id: 5 }, { id: 12 }] }]);
    check("a lane is named after its band, and the letters run in slot order within that band",
      oneBand?.get(5) === "3A" && oneBand.get(7) === "3B" && oneBand.get(12) === "3C",
      JSON.stringify([...oneBand?.entries() ?? []]));

    const twoBands = laneBandNames?.([
      { anchor: { id: 16 }, lanes: [{ id: 2 }, { id: 9 }] },
      { anchor: { id: 3 }, lanes: [{ id: 4 }] },
    ]);
    check("the letter counts within ONE band — a second band starts at A again, and both bands keep their number",
      twoBands?.get(4) === "3A" && twoBands.get(2) === "16A" && twoBands.get(9) === "16B",
      JSON.stringify([...twoBands?.entries() ?? []]));

    // a lane whose anchor is gone (recycled, wrong repo, born parentless) still has to be
    // addressable, and must not be given band 1's name — band 0 is the collecting band
    const bandless = laneBandNames?.([
      { anchor: null, lanes: [{ id: 8 }, { id: 6 }] },
      { anchor: { id: 1 }, lanes: [{ id: 2 }] },
    ]);
    check("a lane with no live band collects on band 0, never on band 1",
      bandless?.get(6) === "0A" && bandless.get(8) === "0B" && bandless.get(2) === "1A",
      JSON.stringify([...bandless?.entries() ?? []]));

    check("two bandless STACKS share one band-0 letter run, so two orphans can never collide",
      (() => {
        const split = laneBandNames?.([
          { anchor: null, lanes: [{ id: 5 }] }, { anchor: null, lanes: [{ id: 6 }] },
        ]);
        return split?.get(5) === "0A" && split.get(6) === "0B";
      })(), "two orphan stacks");

    const forward = laneBandNames?.([
      { anchor: { id: 4 }, lanes: [{ id: 11 }, { id: 3 }] }, { anchor: { id: 2 }, lanes: [{ id: 9 }] }]);
    const reverse = laneBandNames?.([
      { anchor: { id: 2 }, lanes: [{ id: 9 }] }, { anchor: { id: 4 }, lanes: [{ id: 3 }, { id: 11 }] }]);
    check("band names are stable when the stack and lane input orders reverse",
      !!forward && [...forward.keys()].every((id) => forward.get(id) === reverse?.get(id))
        && forward.get(3) === "4A" && forward.get(9) === "2A",
      JSON.stringify({ forward: [...forward?.entries() ?? []], reverse: [...reverse?.entries() ?? []] }));

    check("band names are globally unique across bands and repositories",
      (() => {
        const all = laneBandNames?.([
          { anchor: { id: 1 }, lanes: [{ id: 21 }, { id: 22 }] },
          { anchor: { id: 2 }, lanes: [{ id: 23 }] }, { anchor: null, lanes: [{ id: 24 }] }]);
        return !!all && new Set(all.values()).size === 4;
      })(), "four lanes over three bands");

    // S3a: the letter is a PERSISTED field on the lane ref, not a position. The server assigns the
    // smallest free letter at open; a lane that carries one keeps it whatever happens around it,
    // and only lanes WITHOUT the field (every lane older than the field, or a loader that dropped
    // it) fall back to the positional run — which counts every lane in the band, stored or not, so
    // a mixed band (one pre-field lane among new ones) can double a name until the old lane ends.
    // The fixtures keep the two halves deliberately apart — stored letters the positional run does
    // not reach — so the check never blesses that doubling as intended.
    const stored = laneBandNames?.([{ anchor: { id: 4 }, lanes: [
      { id: 5, worktree: { letter: "C" } }, { id: 6 }, { id: 7, worktree: { letter: "A" } },
    ] }]);
    check("a stored letter IS the name — it wins over the positional run, which still derives for lanes without the field",
      stored?.get(5) === "4C" && stored.get(6) === "4B" && stored.get(7) === "4A",
      JSON.stringify([...stored?.entries() ?? []]));
    const storedBandless = laneBandNames?.([
      { anchor: null, lanes: [{ id: 8 }, { id: 9, worktree: { letter: "C" } }, { id: 10, worktree: { letter: "B" } }] },
      { anchor: { id: 1 }, lanes: [{ id: 2 }] },
    ]);
    check("a stored letter carries onto band 0 too, where the derivation would move it",
      storedBandless?.get(8) === "0A" && storedBandless.get(9) === "0C" && storedBandless.get(10) === "0B"
        && storedBandless.get(2) === "1A",
      JSON.stringify([...storedBandless?.entries() ?? []]));
    check("the server's letter alphabet is the client's, letter for letter — two derivations of one name are how they come apart",
      (() => {
        let clientLetter: ((i: number) => string) | null = null;
        try {
          clientLetter = new Function(new Bun.Transpiler({ loader: "ts" }).transformSync(refSrc)
            + "\nreturn bandLetter;")() as (i: number) => string;
        } catch { return false; }
        if (!clientLetter) return false;
        let serverLetter: ((i: number) => string) | null = null;
        try {
          const src = readFileSync(`${dirname(realpathSync(`${ROOT}/node_modules`))}/server.ts`, "utf8");
          const a = src.indexOf("const bandLetterOf ="), b = src.indexOf("// A lane holds its letter", a);
          serverLetter = new Function(new Bun.Transpiler({ loader: "ts" }).transformSync(src.slice(a, b))
            + "\nreturn bandLetterOf;")() as (i: number) => string;
        } catch { return false; }
        return !!serverLetter && [0, 1, 25, 26, 27, 51, 52].every((i) => serverLetter!(i) === clientLetter!(i));
      })(), "bandLetterOf vs bandLetter");

    // --- THE FOUR STATES, lifted the same way. What the bar could say before was "hot" or "not",
    // and the not held three different facts. Order is part of the rule: a broken session that
    // happens to be on screen is broken, not working.
    const stSrc = cut("const SLEEP_MS =", "// \"how long since this session");
    type StateFn = (s: object, now: number, awake: boolean) => string;
    let slotState: StateFn | null = null;
    try {
      slotState = new Function(new Bun.Transpiler({ loader: "ts" }).transformSync(
        "const RECENT_MS = 5000;\n" + stSrc) + "\nreturn slotState;")() as StateFn;
    } catch { slotState = null; }
    check("probe: the row's state rule is a liftable DOM-free pure helper",
      !!slotState, stSrc.slice(0, 80) || "no slotState block");
    const NOW = 1_000_000_000;
    check("working = on screen, or output within the recent window",
      slotState?.({ lastOutput: NOW - 60_000 }, NOW, true) === "work"
        && slotState?.({ lastOutput: NOW - 1_000 }, NOW, false) === "work",
      "slotState work");
    check("resting and asleep are two states, split at half an hour of silence",
      slotState?.({ lastOutput: NOW - 29 * 60_000 }, NOW, false) === "rest"
        && slotState?.({ lastOutput: NOW - 31 * 60_000 }, NOW, false) === "sleep"
        && slotState?.({ lastOutput: NOW - 30 * 60_000 }, NOW, false) === "sleep",
      "slotState rest/sleep boundary");
    check("broken wins over every other reading, including a session that is on screen right now",
      slotState?.({ lastOutput: NOW, stalled: true }, NOW, true) === "bad"
        && slotState?.({ lastOutput: NOW - 1_000, agent: "no-agent" }, NOW, false) === "bad"
        && slotState?.({ lastOutput: NOW - 9 * 60 * 60_000, agent: "no-pane" }, NOW, false) === "bad"
        // …and an agent Fleet simply has not probed yet is NOT an error
        && slotState?.({ lastOutput: NOW - 60_000, agent: "unprobed" }, NOW, false) === "rest",
      "slotState bad");

    const deps = cut("const isActive = ", "// A LANE'S ONE ADDRESS")
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
        && /else \{\s*r1\.append\(el\("span", "n", String\(s\.id\)\), lbl\)/.test(rowSrc),
      "renderSlots + emptyRow + slotRow main-number branch");
    // THE BAND NAME IS THE LANE'S ONLY ADDRESS in the bar. The branch suffix is not beside it, not
    // under it and not in a second chip — it is in the tooltip, with the rest of the git facts. A
    // second visible address is exactly what the model was confirmed to remove.
    check("an active lane row shows its band name and NOTHING else as its address",
      /if \(s\.worktree\) \{[\s\S]*?el\("span", "laneref", refs\.get\(s\.id\)[\s\S]*?\} else \{\s*r1\.append\(el\("span", "n"/.test(rowSrc)
        && (rowSrc.match(/"n", String\(s\.id\)/g) ?? []).length === 1
        && !rowSrc.includes('"lanesep"') && !rowSrc.includes('"laneidentity"')
        && !indexSrc.includes(".lanesep") && !indexSrc.includes(".laneidentity")
        && rowSrc.includes("s.label ?? baseName(s.cwd)")
        // the branch did not vanish, it moved: the label's tooltip still names it (2026-09-21 the
        // tooltip became the list of everything the resting row stopped saying)
        && /facts\.push\(`\$\{refs\.get\(s\.id\)[^\n]*s\.worktree\.branch\)/.test(rowSrc)
        && rowSrc.includes('lbl.title = facts.join("\\n")'),
      "lane identity branch + sidebar CSS");
    // THE ADDRESS IS ONE OBJECT, drawn once — the session's number and the lane's band name share
    // the chip rule, which is how they can be the same kind of thing to look at.
    check("the session number and the lane band name are the same chip, in mono, tinted by project",
      /\.slot \.n, \.slot \.laneref \{[^}]*font-family: var\(--chat-mono\)/.test(indexSrc)
        && /\.slot \.n, \.slot \.laneref \{[^}]*color: hsl\(var\(--proj-h/.test(indexSrc),
      "the address chip rule in public/index.html");
    check("lane row internals keep slot ids, routes, tooltips and rename persistence",
      rowSrc.includes("row.dataset.slot = String(s.id)")
        // the tooltip still answers "which slot is this lane in", which is what the routes below
        // are addressed by — it sits beside the cwd now that the band name carries the identity
        && rowSrc.includes("slot ${s.id} · ${s.cwd}")
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
    // THE STROKE AFTER EVERY FOURTH PLACE (row bc98af80). Position: by the place's NUMBER
    // (Math.ceil(id / 4)), decided at the three places a numbered row enters the axis and NOT inside
    // renderStack — a lane under its MAIN rides in the MAIN's group, so folding moves no stroke.
    {
      const stackSrc = cut("function renderStack(", "// Edge 1:");
      const sepCalls = renderSrc.match(/sepBefore\(s\.id\)/g) ?? [];
      check("sidebar: a stroke separates the places by number after 4, 8, 12 — lanes under their MAIN never count",
        /const g = Math\.ceil\(id \/ 4\);\s*if \(group && g !== group\) slotsEl\.appendChild\(el\("div", "slotsep"\)\);/.test(renderSrc)
          && sepCalls.length === 3
          && /sepBefore\(s\.id\); slotsEl\.appendChild\(emptyRow\(s\)\)/.test(renderSrc)
          && /sepBefore\(s\.id\); renderStack\(g, refs\)/.test(renderSrc)
          && /continue; \/\/ folded[^\n]*\n\s*sepBefore\(s\.id\);\s*slotsEl\.appendChild\(slotRow\(s, undefined, refs\)\)/.test(renderSrc)
          && !/sepBefore|slotsep/.test(stackSrc),
        `${sepCalls.length} sepBefore calls; renderStack ${/slotsep/.test(stackSrc) ? "draws" : "draws no"} stroke`);
      const sepRules = [...indexSrc.matchAll(/(?:^|\n)\s*([^{}\n]*\.slotsep[^{}\n]*)\{([^}]*)\}/g)];
      const painted = sepRules.filter((m) => /background|mask/.test(m[2]));
      // ONE Fassung: the owner picked gestrichelt (2026-09-24) — a second painted rule is a switch
      // creeping back, and the dash itself is the repeating gradient, not a dot or a wave mask
      check("sidebar: the stroke is ONE dashed rule from --chat-edge, takes no pointer and hides in the collapsed rail",
        painted.length === 1 && painted[0][1].trim() === ".slotsep"
          && /repeating-linear-gradient\(90deg, var\(--chat-edge\) 0 5px, transparent 5px 9px\)/.test(painted[0][2])
          && !/mask|#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(painted[0][2])
          && !/dataset\.sep\b|#slots\[data-/.test(indexSrc + renderSrc)
          && /pointer-events:\s*none/.test(cssBody(".slotsep"))
          && /height:\s*8px/.test(cssBody(".slotsep")) && /margin:\s*-2px 8px -2px 6px/.test(cssBody(".slotsep"))
          && /#side\.collapsed \.slotsep \{ display: none; \}/.test(indexSrc),
        painted.map((m) => m[1].trim()).join(" | ") || "no painted .slotsep rule");
    }
    // A FREE PLACE IS A PLACE: numbered, visible in the axis, and clickable across the whole row.
    // "Visible" is the part a hairline treatment would quietly lose, so the label says what a click
    // does instead of leaving the row to be read as a gap.
    check("empty rows stay numbered, say what a click does, and are clickable as a whole row",
      emptySrc.includes('el("span", "n", String(s.id))')
        && emptySrc.includes('el("span", "lbl dim", "free · start a session")')
        && emptySrc.includes("row.onclick = () => openPicker(s.id)")
        && /\.slot\.empty \.n \{/.test(indexSrc),
      emptySrc.slice(0, 300));
    check("the band name replaces the slot number without a redundant permanent lane glyph",
      !rowSrc.includes('"lanechip"') && !indexSrc.includes(".slot .lanechip"),
      "slotRow + sidebar CSS");
    // --- THE BAR SPEAKS ONE LANGUAGE, and it is not its own. Every colour it paints is a token
    // from the chat view's :root block (or the queue's extension of it); the bar declares no
    // palette. This is the same cut the board took on 2026-09-20, applied to the last surface that
    // was still on the old sheet — and a literal hex creeping back is exactly how that ends.
    {
      // comments stripped FIRST: the palette block's prose names `.slot.lane`, and a selector
      // match that reads comments makes :root itself look like a rule of this bar
      const css = indexSrc.slice(indexSrc.indexOf("<style>"), indexSrc.indexOf("</style>"))
        .replace(/\/\*[\s\S]*?\*\//g, "");
      const rules = [...css.matchAll(/(^|\n)([^{}\n][^{}]*?)\{([^{}]*)\}/g)];
      const isBar = (sel: string) => /(^|[\s,])(#side|#slots|#sidehead|#sidetitle|#sidetools|#sidefoot|#instwrap|#instbtn|#instmenu|#morebtn|#morepanel|#collapse|\.instrow|\.slot|\.slotact|\.slotsep|\.renamein|\.rowmore|\.rowmenu\w*|\.cmtb|\.revb)\b/.test(sel);
      const withHex = rules.filter((m) => isBar(m[2]) && /#[0-9a-fA-F]{3,8}\b/.test(m[3]));
      check("client: the sidebar's CSS carries no palette of its own — every colour is a token",
        withHex.length === 0 && rules.some((m) => /^#side\b/.test(m[2].trim())
          && m[3].includes("var(--chat-void)") && m[3].includes("var(--chat-sans)")),
        withHex.slice(0, 3).map((m) => m[2].trim().replace(/\s+/g, " ")).join(" | ")
          || `${rules.filter((m) => isBar(m[2])).length} bar rules, none with a literal colour`);
    }
    // MONO IS FOR ADDRESSES AND NUMBERS, sans for words. The old bar was one monospace for
    // everything, which is what made a label and an id look like the same kind of fact.
    // The AGE was the third mono reading; it left the resting row on 2026-09-21 (owner's list:
    // slot number, ctx, lanes, name, work indicator) and is the state glyph's tooltip now.
    check("client: the bar sets sans for words and keeps mono for the address and the fill",
      /#side \{[^}]*font-family: var\(--chat-sans\)/.test(indexSrc)
        && /\.slot \.ctxfill \{[^}]*font-family: var\(--chat-mono\)/.test(indexSrc),
      "the font assignments in the sidebar block");
    // FOUR STATES, FOUR SHAPES. The rule the card set is that the reading survives without colour,
    // so each state must change the GEOMETRY of the glyph — and resting and asleep must not be the
    // same means twice (two brightnesses of one dot is the failure this forbids).
    {
      const glyph = (sel: string) => new RegExp(`\\.slot \\.act${sel}\\s*\\{([^}]*)\\}`).exec(indexSrc)?.[1] ?? "";
      const base = glyph(""), rest = glyph("\\.rest"), sleep = glyph("\\.sleep"), bad = glyph("\\.bad");
      check("client: the four states differ in SHAPE, and resting and asleep differ from each other",
        /border-radius: 50%/.test(base) && /background: var\(/.test(base)
          && /background: none/.test(rest) && /box-shadow: inset/.test(rest)
          && /8px 2px/.test(sleep) && !/box-shadow/.test(sleep)
          && /clip-path: polygon/.test(bad),
        JSON.stringify({ base: base.trim(), rest: rest.trim(), sleep: sleep.trim(), bad: bad.trim() }));
      // ONE BOX FOR ALL FOUR (owner 2026-09-21: "sauber angezeigt", on the 4/8 grid). The shape is
      // what changes; a state whose rule set its own width or height would move the row the moment a
      // session falls asleep — the old 9×2 bar was exactly that.
      check("client: the four state glyphs share one 8px box — no state sets its own width or height",
        /width: 8px; height: 8px/.test(base)
          && [rest, sleep, bad].every((g) => !/(^|[;\s])(width|height):/.test(g)),
        JSON.stringify({ base: base.trim(), sleep: sleep.trim() }));
      check("client: the row paints one of those four and names it in words",
        /el\("span", `act \$\{state\}`\)/.test(rowSrc) && /live\.title = STATE_WORD\[state\]/.test(rowSrc)
          // the two-state dot is gone: the glyph is no longer built by concatenating a "hot"
          // onto a bare "act" (the guest-chat chip has its own ` hot`, and it stays)
          && !/"act" \+ \(/.test(rowSrc) && !/"act hot"/.test(rowSrc),
        "the state glyph in slotRow");
    }
    // THE ROW REPAINTS ONLY WHEN WHAT IS PAINTED CHANGES, and the key is what enforces it. Both new
    // paintings go through the SAME functions the row uses — a state left out here freezes on
    // screen until some other field happens to move (the `behind` bug that list documents).
    check("client: the render key carries the state glyph and the age at the row's own resolution",
      /slotState\(s, serverNow, panes\.some\(\(p\) => p\.slot === s\.id\)\)/.test(cliSrc)
        && /sinceShort\(serverNow - s\.lastOutput\)/.test(cliSrc)
        && !/serverNow - s\.lastOutput < RECENT_MS,\n/.test(cliSrc.slice(cliSrc.indexOf("const key = JSON.stringify"))),
      "the sidebar render key");
    // THE PLACE FOR THE MARK IS PREPARED AND EMPTY. Build 2 of this card draws it; build 1 owes the
    // geometry, so that landing the mark moves nothing. "Empty" is asserted too — a placeholder
    // that paints something is a mark nobody chose.
    check("client: every row reserves the session mark's place, at one declared size, with nothing in it",
      /r1\.appendChild\(el\("span", "mark"\)\)/.test(rowSrc)
        && /el\("span", "mark"\)/.test(emptySrc)
        && /\.slot \.mark \{[^}]*width: var\(--mark-size, 26px\)[^}]*height: var\(--mark-size, 26px\)/.test(indexSrc)
        && /\.slot\.lane \{ --mark-size: 21px; \}/.test(indexSrc)
        // nothing is drawn into it: no content, no background, no border anywhere in the bar
        && !/el\("span", "mark", /.test(cliSrc)
        && !/\.slot \.mark[^{]*\{[^}]*(background|border|content)/.test(indexSrc),
      "the mark placeholder in slotRow/emptyRow + its CSS");
    // THE RESTING ROW IS THE OWNER'S FIVE, ON ONE LINE (2026-09-21, verbatim: "slotNr, Ctx-fill,
    // indication of nr of lanes, name, workIndicator und kein 'cx bound'"). The second line is gone.
    // What the line said moved to the label's tooltip, never into nothing. Round 8 brought ONE
    // reading back ("die beiden aktivitätsleuchten"): a lane's lifecycle as a dot (`lc`), beside
    // the ctx — its three words stay in the tooltip.
    {
      check("client: the resting row is one line — number, name, lane count, ⎇+, lifecycle, ctx, state",
        !/el\("div", "r2"\)/.test(rowSrc)
          && /r1\.appendChild\(cx\)/.test(rowSrc) && /r1\.appendChild\(live\)/.test(rowSrc)
          && /r1\.appendChild\(laneCountChip\(stack, open\)\)/.test(rowSrc)
          && /r1\.appendChild\(quickLaneChip\(/.test(rowSrc)
          // the fold arrow has no sentence of his: gone from the row; the lifecycle is the round-8 dot
          && !cliSrc.includes("function foldArrow(") && !/"lcdot/.test(cliSrc) && !indexSrc.includes(".lcdot")
          && /el\("span", `lc \$\{life\}`\)/.test(rowSrc) && /\.slot \.lc\.editing \{ background: var\(--amber\)/.test(indexSrc)
          && !cliSrc.includes("function stackChips(")
          // and what they said is still said: the lifecycle in the label's tooltip, the fold on the
          // count, the age beside the state's word
          && /const lc = s\.git\.dirty > 0 \? "editing"/.test(rowSrc)
          && /n\.onclick = \(e\) => \{ e\.stopPropagation\(\); setStackOpen\(g, !open\); \}/.test(cliSrc)
          && /live\.title = STATE_WORD\[state\][\s\S]*?sinceShort\(serverNow - s\.lastOutput\)/.test(rowSrc)
          && !indexSrc.includes(".slot.proj {") && !/\.slot\.proj[^}]*border-left/.test(indexSrc)
          && cliSrc.includes("tintProject(row, projectOf(s))"),
        "slotRow + laneCountChip + the retired stripe");
      // "der diff button raus" — and the diff is not orphaned: the board's rows open the SAME review
      // window, on the exact file or commit. If the board ever lost those, the ± removal would have
      // taken the function with it, which the owner's instruction forbids.
      check("client: no ± on the row or its hover strip, and the board still opens every diff",
        !rowSrc.includes('"±"') && !/"lanediff"|"diff", "±"/.test(cliSrc)
          && !indexSrc.includes(".lanediff") && !/\.slot \.diff\b/.test(indexSrc)
          && /row\.onclick = \(\) => void openReview\(slot, "working", \{ k: "file", path \}\)/.test(cliSrc)
          && /openReview\(slot, "working", \{ k: "commit", hash: cm\.hash \}\)/.test(cliSrc)
          && /rev\.onclick = \(\) => void openMergeDiff\(slot\)/.test(cliSrc),
        "slotRow + renderBoard review entry points");
      // "kein 'cx bound'": a healthy Codex binding says nothing; only the two states Fleet will not
      // guess its way out of appear, in words, and they open the dialog that settles them.
      check("client: the Codex line appears only when the owner must act, and in words, not 'cx'",
        /s\.codexRecovery\.state === "ambiguous" \|\| s\.codexRecovery\.state === "lost"/.test(rowSrc)
          // WHAT HAPPENED, then WHAT TO DO — the first wording named only the action and the owner
          // asked what the message even was (2026-09-21)
          && rowSrc.includes('"Codex lost track of its conversation — click to pick it"')
          && rowSrc.includes(`"Codex's conversation is gone — click to bind another"`)
          // a line of its own, never a chip in line 1 — there it pushed the name to zero
          && /el\("div", "needline"/.test(rowSrc) && /row\.appendChild\(need\)/.test(rowSrc)
          && !/`cx \$\{/.test(cliSrc) && /need\.onclick = \(e\) => \{ e\.stopPropagation\(\); openCodexDlg\(s\.id\); \}/.test(rowSrc),
        "the codex branch of slotRow");
      // everything else that left the resting row is on the hover row — no function lost
      check("client: ⏸, the scheduled mark and the guest-chat count sit on the hover row",
        /act\.appendChild\(rb\)/.test(rowSrc) && /el\("span", "revb", "⏸"\)/.test(rowSrc)
          && /act\.appendChild\(b\)/.test(rowSrc) && /el\("span", "autobadge", "⏱"\)/.test(rowSrc)
          && /n > 0 \? `💬\$\{n\}` : "💬"/.test(rowSrc)
          && !indexSrc.includes(".slot:hover .revb"),
        "the slotact block of slotRow");
    }
    // THE CODEX SENTENCE IS NEVER CUT — at rest it wraps (no nowrap, no clip on its own box), and on
    // hover the action strip covers LINE 1 ONLY: down to bottom:0 its solid surface lay over the
    // right end of the sentence ("choose which convers…", owner screenshot 2026-09-21). Measured in a
    // browser by docs/design/sidebar/leiste-mess/leiste-shot.js (the `cut` field, rest and hover).
    {
      const needCss = cssBody(".slot .needline");
      const laneActCss = cssBody(".slot.lane .slotact");
      check("client: the Codex sentence and ⎇+ are not cut at rest or on hover — the strip covers line 1 only and hides the readings it replaces",
        needCss !== "" && !/nowrap|overflow|text-overflow|max-height|-webkit-line-clamp/.test(needCss)
          && !/bottom:\s*0/.test(slotactCss) && /height:\s*calc\(6px \+ 26px\)/.test(slotactCss)
          && /height:\s*calc\(6px \+ 22px\)/.test(laneActCss)
          && /\.slotact, \.slot\.lane \.slotact \{[^}]*position: static; height: auto/.test(indexSrc)
          // …and the readings under it are HIDDEN in place, never overpainted by a guessed width (⎇+ was cut)
          && indexSrc.includes(".slot:hover .r1 .ctxfill, .slot:hover .r1 .act,") && !/min-width/.test(slotactCss)
          // …except on touch, where the strip is in flow beside them
          && /@media \(hover: none\) \{[^@]*\.slot:focus-within \.r1 \.act \{ visibility: visible; \}/.test(indexSrc),
        JSON.stringify({ needCss: needCss.trim(), slotactCss: slotactCss.trim(), laneActCss: laneActCss.trim() }));
    }
    // EVERY LIVE ROW CAN BE CLOSED (owner 2026-09-21: "ich sessions mit der neuen leiste nicht
    // schließen kann"). The ✕ hangs on the ROW, never inside line 1 — bandify moves line 1 into the
    // band's track, and a ✕ there would ride off with a pulled-back cell. And a lane's ✕ confirms
    // through showRiskPreview, whose .overlay (z 20) lay UNDER the phone drawer (#side z 30): the
    // tap fetched the risk and opened a panel nobody could reach. Either the preview closes the
    // drawer, or the overlay stacks above it.
    {
      const riskSrc = cut("function showRiskPreview(", "function confirmMidRun(");
      const zOf = (css: string): number => Number(/z-index:\s*(\d+)/.exec(css)?.[1] ?? NaN);
      const overlayZ = zOf(cssBody(".overlay")), drawerZ = zOf(/#side \{[^}]*\}/.exec(mobileCss)?.[0] ?? "");
      // since K3 the drawer-close lives in ONE place: askRisk (src/dialog.ts) closes it before
      // painting and client.ts registers setDrawer(false) once — the old anchor (setDrawer inside
      // showRiskPreview) is gone on purpose with the six copies. Same reachability guarantee.
      const drawerClosedByHelper = dlgSrc !== null
        && dlgSrc.includes("closeDrawer?.()")
        && /onDialogWillOpen\(\(\) => setDrawer\(false\)\)/.test(cliSrc)
        && /askRisk\(/.test(riskSrc);
      // Since row 69bdf591 the phone reaches it one tap further: the strip's ✕ hides under
      // MOBILE_MQ and the row's ⋯ menu carries "Kill session" — the same killSlot, last in the list.
      check("client: every live row keeps a reachable ✕ — on the row (phone: behind its ⋯), above the phone drawer, hidden only on a past band cell",
        /const kill = el\("span", "kill", "✕"\)/.test(rowSrc) && /kill\.onclick = \(e\) => \{ e\.stopPropagation\(\); void killSlot\(s\); \};\s*act\.appendChild\(kill\);/.test(rowSrc)
          && /act\.appendChild\(more\);\s*row\.appendChild\(act\);/.test(rowSrc)
          && /item\("Kill session", [^\n]*void killSlot\(s\); \}, true\);\s*rowMenuSlot = s\.id;/.test(rowSrc)
          && rowSrc.includes("post(`/api/slots/${s.id}/kill`, {})")
          && /\.slot\.back \.slotact/.test(indexSrc)
          && (drawerClosedByHelper || overlayZ > drawerZ),
        JSON.stringify({ overlayZ, drawerZ, viaHelper: drawerClosedByHelper, dlgPresent: dlgSrc !== null }));
      // …and every live row can be RENAMED where it is seen (owner, same day: "ich übrigens auch
      // nicht richtig die sessions umbenennen"). bandify puts the past cells — each with its own
      // .lbl — BEFORE line 1 in the track; a bare `.lbl` lookup opened the input in the first past
      // cell, outside the view. The rename must address the running line, not a pastcell.
      const renameSrc = cut("function startRename(", "function updateTitle(");
      const lblPick = /const lbl = row\.querySelector\("([^"]*)"\)/.exec(renameSrc)?.[1] ?? "";
      check("client: a rename opens in the running session's line 1, never in a band's past cell",
        /\bpastcell\b/.test(cliSrc) && lblPick.includes(":not(.pastcell)")
          && /c = el\("div", "r1 pastcell"\)/.test(cliSrc) && /lbl\.replaceWith\(input\)/.test(renameSrc),
        JSON.stringify({ lblPick }));
    }
    // THE BAND (owner rounds 3–10, 2026-09-21): a row whose line has handed over is a track you pull
    // back through its past; the session it rests on opens read-only in the pane. Every value below
    // is one the owner chose, driven over CDP first (docs/design/sidebar/leiste-mess/band-zieh.js).
    // The scaffolding that preceded it — four Fassungen behind #band=a–d — is gone, switch included.
    {
      const bandSrc = cut("function bandify(", "// Which stacks exist right now.");
      const code = cliSrc.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
      check("client: no band Fassung and no hash switch survive — the band is the one built form",
        !cliSrc.includes("BAND_VARIANT") && !cliSrc.includes("function readVariant(")
          && !cliSrc.includes("successionChainEl") && !/"succ(hip|band|chain)?"/.test(cliSrc)
          && !/\.slot \.(succ|succband|succhip|succchain|sm)\b/.test(indexSrc),
        "client + sidebar CSS");
      check("client: a row becomes a band exactly when its line has handed over",
        /if \(s\.succession && s\.succession\.session > 1\) bandify\(row, r1, s, s\.succession\.session\)/.test(rowSrc)
          && bandSrc.includes("r1.replaceWith(view)") && bandSrc.includes("track.appendChild(r1)"),
        "slotRow + bandify");
      // the depth is the device setting fleet.bandDepth (alle / 3 / 5), read in one place; the route
      // is never capped. Mutation probe: a second bandDepth() reader or a fixed number turns this red.
      check("client: the band depth is the fleet.bandDepth setting, read in one place",
        (code.match(/\bbandDepth\(\)/g) ?? []).length === 1
          && /const bandReach = \(session: number\): number => Math\.min\(session - 1, bandDepth\(\)\)/.test(code)
          && /const bandDepth = \(\): number => \{ const v = Number\(prefText\("fleet\.bandDepth"\)\)/.test(code)
          && !/\bDEPTH\b/.test(code),
        `${(code.match(/\bbandDepth\(\)/g) ?? []).length} code reads`);
      check("client: the mouse is 'weich' and trackpad/finger is round 5 — the chosen values, nowhere else",
        cliSrc.includes("const BAND_MOUSE = { T: 40, k: 0.8, cap: 0.28, ms: 380 };")
          && cliSrc.includes("const BAND_SLOP = 7, BAND_COMMIT = 0.2, BAND_FLICK = 0.35, BAND_SWIPE_COMMIT = 0.33;")
          && /\.slot \.bandtrack\.snap\.mouse \{ transition: transform 0\.38s cubic-bezier\(\.2, 1\.3, \.3, 1\)/.test(indexSrc)
          && /prefers-reduced-motion: reduce\) \{ \.slot \.bandtrack\.snap, \.slot \.bandtrack\.snap\.mouse \{ transition: none/.test(indexSrc)
          && bandSrc.includes("view.setPointerCapture(e.pointerId)") && bandSrc.includes("{ passive: false }")
          && /touch-action: pan-y/.test(cssBody(".slot .bandview")),
        "bandify + band CSS");
      check("client: the hint is one 2px sliver — left on the present, right on a past — and the dots show only on demand",
        /width: 2px/.test(cssBody(".slot.pull::before")) && /left: auto; right: 2px/.test(cssBody(".slot.pull.back::before"))
          && /opacity: 0/.test(cssBody(".slot .depth")) && cliSrc.includes("const BAND_DOTS = 7, BAND_STEPPED_MS = 1200;"),
        JSON.stringify({ hint: cssBody(".slot.pull::before"), depth: cssBody(".slot .depth") }));
      check("client: the sidebar is not rebuilt under a band in the hand, and a rebuilt band keeps the keyboard",
        cliSrc.includes("if (bandGesture > 0) { slotsDirty = true; return; }")
          && cliSrc.includes('slotsEl.querySelector<HTMLElement>(`.slot[data-slot="${bandFocus}"] .bandview`)?.focus()'),
        "renderSlots");
      check("client: a past session is read-only — its own route, a quiet composer, no ✕ over the running session",
        cliSrc.includes("`/api/slots/${slot}/succession/${past}/transcript?after=${this.chatTotal}`")
          && cliSrc.includes("ta.disabled = pastN !== null;")
          && /display: none/.test(cssBody(".slot.back .slotact, .slot.back:hover .slotact, .slot.back:focus-within .slotact")),
        "Pane#pollChat + mountComposer + band CSS");
      // the three top-right pane buttons sit at right 10/46/… px, exactly where the past bar puts
      // "↩ laufende Session" — any one left standing paints over it (the ℹ did, r11 shots 2026-09-21)
      check("client: the past bar's way back is not covered — ℹ, 💬 and ↻ all leave a past pane",
        /display: none/.test(cssBody(".pane.past .viewtoggle, .pane.past .panereload, .pane.past .boardtoggle")),
        cssBody(".pane.past .viewtoggle, .pane.past .panereload, .pane.past .boardtoggle") || "no such rule");
      // K4 (Grammatik): the pane's corner buttons are ONE group with ONE base rule out of the app
      // tokens — no per-button absolute top/right copies, no old-palette literals, gear rightmost
      // (G5), gear + width toggle on the phone's surfaces they do not belong to
      check("client: the corner buttons are one seated group on the chat tokens, gear rightmost — the width toggle never on the phone, its gear in #mhead",
        cliSrc.includes('el("div", "panetools")')
          && /var\(--chat-raised\)/.test(cssBody(".panetools button"))
          && !/rgba\(/.test(cssBody(".panetools button"))
          && /var\(--r1\)/.test(cssBody(".panetools button"))
          && cssBody(".panetools button[aria-pressed=\"true\"]").length > 0
          && cliSrc.includes("icon(\"gear\")")
          && cliSrc.includes('openShell({ id: "board", title: "Info"')
          && !cssBody(".boardtoggle").includes("position: absolute")
          && /display: none !important/.test(cssBody(".panetools .termwidth, .panetools .panegear"))
          && indexSrc.includes(".panetools .termwidth, .panetools .panegear { display: none !important; }")
          && !/(^|\n)\s*\.boardtoggle \{/m.test(indexSrc),
        JSON.stringify({ group: cssBody(".panetools button"), pressed: cssBody(".panetools button[aria-pressed=\"true\"]") }));
      // K5 (Grammatik): exactly ONE module owns outside-click and Escape for the four popovers —
      // #instmenu, .optpop, #board .bmenu and the phone's row menu (.rowmenu, row 69bdf591)
      // register in src/popover.ts. (sizePanel was the
      // fourth until K8: its ONE home is now the settings window's "Schrift" section, G5.3 —
      // no popover of its own anymore.) A second document-level listener for them in client.ts
      // or chatsize.ts would fork the behaviour (close semantics, focus return, arrow walk
      // drift apart) — the form this check pins. Mutation probe: re-adding any old listener
      // form below (or a popover() call outside the counted 4+0) turns this red.
      const popCount = (s: string | null): number => s ? (s.match(/popover\(\{/g) ?? []).length : 0;
      check("client: the four popovers share ONE outside-click/Escape module — no second document listener",
        popSrc !== null
        && popSrc.includes('document.addEventListener("pointerdown"')
        && popSrc.includes('addEventListener("keydown"')
        && popCount(cliSrc) === 4 && popCount(chatSrc) === 0
        && !/document\.addEventListener\("click", \(e\) => \{\s*if \(instMenuOpen/.test(cliSrc ?? "")
        && !/window\.addEventListener\("keydown", \(e\) => \{ if \(e\.key === "Escape" && instMenuOpen/.test(cliSrc ?? "")
        && !/document\.addEventListener\("pointerdown", \(e\) => \{\s*const t = e\.target;\s*if \(!optOpen/.test(cliSrc ?? "")
        && !(cliSrc ?? "").includes('compOpts.addEventListener("keydown"')
        && !/addEventListener\("(pointerdown|keydown)"/.test(chatSrc ?? ""),
        JSON.stringify({ helper: popSrc !== null, popoverCalls: { client: popCount(cliSrc), chatsize: popCount(chatSrc) } }));
      // K8 (Grammatik G5): the gear's window renders the registry — the device rows come FROM the
      // PREFS table (not hand-wired), the size panel is the "Schrift" section's one home,
      // "Fleet" holds its server rows (pinned route by route in e2e/tasks.ts), and the focus returns to the
      // trigger (G4). Mutation probe: wiring a row by hand instead of over PREFS turns this red.
      check("client: the settings window renders the registry — device rows from PREFS, Schrift as the panel's home, Fleet over its server rows",
        /id: "settings", title: "Einstellungen"/.test(cliSrc)
        && /for \(const d of PREFS\)/.test(cliSrc)
        && /appendChild\(sizePanel\(\)\)/.test(cliSrc)
        && /fleetSection\(fleetsec\);/.test(cliSrc)
        && /trigger\?\.focus\(\)/.test(cliSrc),
        JSON.stringify({ title: /title: "Einstellungen"/.test(cliSrc), prefsRows: /for \(const d of PREFS\)/.test(cliSrc),
          schrift: /appendChild\(sizePanel\(\)\)/.test(cliSrc), fleetRows: /fleetSection\(fleetsec\);/.test(cliSrc),
          focusReturn: /trigger\?\.focus\(\)/.test(cliSrc) }));
      // ECKKNOPFE RUNDE 2 (owner 2026-09-22): the open column's close box sits EXACTLY where the
      // corner group's top row sits when the column is closed — one spot, click opens, click
      // again closes. Proven as arithmetic over the CSS constants that produce it (the browser
      // measurement travels in the lane's report): #boardclose center = head padding + box/2;
      // ℹ center = #panes padding + .panetools offset + button/2. Mutation probe: nudge either
      // padding and dx or dy leaves the 2px budget.
      {
        const num = (s: string, re: RegExp): number => Number(re.exec(s)?.[1] ?? NaN);
        const pair = (s: string): [number, number] => {
          const m = /padding:\s*([\d.]+)px\s+([\d.]+)px/.exec(s);
          return m ? [Number(m[1]), Number(m[2])] : [NaN, NaN];
        };
        const [headTop, headRight] = pair(cssBody("#board #boardhead"));
        const closeCss = cssBody("#board #boardclose");
        const toolsCss = cssBody(".panetools");
        const cw = num(closeCss, /width:\s*([\d.]+)px/), ch = num(closeCss, /height:\s*([\d.]+)px/);
        const toolsTop = num(toolsCss, /top:\s*([\d.]+)px/), toolsRight = num(toolsCss, /right:\s*([\d.]+)px/);
        const btnCss = cssBody(".panetools button");
        const bw = num(btnCss, /width:\s*([\d.]+)px/), bh = num(btnCss, /height:\s*([\d.]+)px/);
        const panesPad = num(cssBody("#panes"), /padding:\s*([\d.]+)px/);
        // ℹ is the top row's RIGHTMOST button: its center sits at the row's right edge minus half
        // a button — row right edge = pane corner − panes padding − tools right offset
        const closeCenter = [headRight + cw / 2, headTop + ch / 2];
        const toggleCenter = [panesPad + toolsRight + bw / 2, panesPad + toolsTop + bh / 2];
        const dx = Math.abs(closeCenter[0] - toggleCenter[0]);
        const dy = Math.abs(closeCenter[1] - toggleCenter[1]);
        check("client: #boardclose lands on the closed ℹ spot — centers within 2px at any width",
          Number.isFinite(dx) && Number.isFinite(dy) && dx <= 2 && dy <= 2,
          JSON.stringify({ closeCenter, toggleCenter, dx, dy }));
      }
      // …and the two rows split both-view from view-bound: ℹ 💬 ⚙ never move (top), the active
      // view's own sit below — terminal ↻ ⇔, chat ↑ ↓ Aa (the mapping Pane's build encodes and
      // index.html's visibility rules paint). Mutation probe: move widthBtn into toolsTop and
      // this goes red.
      check("client: the corner group's rows split both-view (⚙ ⌕ 💬 ℹ) from view-bound (terminal ↻ ⇔ / chat ↑ ↓ Aa) — ℹ rightmost, on the corner the close box must land on",
        cliSrc.includes("toolsTop.append(this.gearBtn, this.hoverBtn, this.viewBtn, this.boardBtn)")
        && cliSrc.includes("toolsView.append(this.reloadBtn, this.widthBtn, navUp, navDn, this.sizeBtn)")
        && /flex-direction:\s*column/.test(cssBody(".panetools"))
        && /visibility:\s*hidden/.test(cssBody(".pane.chat .termwidth, .pane.chat .panereload"))
        && /visibility:\s*visible/.test(cssBody(".pane.chat .promptnav, .pane.chat .chatsizebtn")),
        JSON.stringify({ tools: cssBody(".panetools"), viewRow: cssBody(".pane.chat .termwidth, .pane.chat .panereload") }));
      // b3dc378b: the chat view names what runs. The server passes the tool_use id and the
      // tool_result's tool_use_id through (TBlock id/ref); the client pairs a result to its call
      // by id — a subagent call shows "läuft" until the result lands — and the view carries a
      // work indicator on the sessionActive fact with the RECENT_MS hide bound as a one-shot
      // timer (no new poll interval)
      check("chat: a subagent call runs until its result — id through the server, paired on the client, no positional guess",
        /TBlock \{ t: "text" \| "thinking" \| "tool" \| "tool_result"; text: string; name\?: string;\n  id\?: string; ref\?: string \}/.test(cliSrc)
          && serverSrc.includes("typeof blk.tool_use_id === \"string\" && blk.tool_use_id ? { ref: blk.tool_use_id } : {}")
          && serverSrc.includes("typeof blk.id === \"string\" && blk.id ? { id: blk.id } : {}")
          && cliSrc.includes("private openAgents = new Map<string, { step: HTMLElement; run: HTMLElement }>()")
          && cliSrc.includes("Pane.AGENT_TOOL.test(b.name)")
          && cliSrc.includes("this.openAgents.has(b.ref)")
          && cliSrc.includes("this.openAgents.delete(b.ref)")
          && /background: var\(--q-live\)/.test(cssBody(".trundot")),
        JSON.stringify({ dot: cssBody(".trundot"), run: cssBody(".trun") }));
      check("chat: the work indicator rides sessionActive and hides at the RECENT_MS boundary by timer, not by a new poll",
        cliSrc.includes("private readonly workEl = (() => {")
          && cliSrc.includes("this.workTimer = setTimeout(() => { if (this.slot === slot) this.updateWork(); }, Math.max(left, 0));")
          && /const left = RECENT_MS - \(serverNow - s\.lastOutput\);/.test(cliSrc)
          && cliSrc.includes("if (past === null) this.updateWork();")
          && /display: none/.test(cssBody(".chatwork[hidden]")),
        JSON.stringify({ work: cssBody(".chatwork") }));
      // b3dc378b: more hoverable ids — the ENT net widens to 7-12 hex, the KIND is the caller's
      // answer asked in precedence order (task → program → sha), and an unknown string stays
      // text: every branch is gated on the same entityOk answer the task path always used
      let mdSrc = "";
      try { mdSrc = readFileSync(`${dirname(realpathSync(`${ROOT}/node_modules`))}/src/md.ts`, "utf8"); } catch { /* the check below reads as failed, not as skipped */ }
      check("chat: ENT knows programs and commit-sha prefixes — marked only when the board knows them, unknown 8-hex stays text",
        /const ENT = \/\\b\(\[0-9a-f\]\{7,12\}\)\\b\|\\b\(\[Ss\]lots\?\\s\*#\?\)/.test(mdSrc)
          && mdSrc.includes('id.length === 8 && ok("task", id)')
          && mdSrc.includes('id.length === 8 && ok("program", id)')
          && mdSrc.includes('ok("sha", id) ? "sha" : null')
          && mdSrc.includes('if (kind) found.push({ kind, id, start, end: start + id.length });')
          && mdSrc.includes("entityOk(\"sha\", hex) ? \"sha\" : null")
          && cliSrc.includes("if (kind === \"program\") return programsPoll.some((p) => p.id === id);")
          && cliSrc.includes("if (kind === \"sha\") return knownSha(id);")
          && cliSrc.includes("s.taskHead && s.taskHead.startsWith(id)")
          && cliSrc.includes("if (brief) rememberShas(brief.head"),
        "src/md.ts hexKind chain + src/client.ts entityKnown/knownSha");
      // rounds 12–14 (owner): the views square left and unchanged, the functions one right-aligned
      // block — two small rows, then the task queue as its own square in the right corner, sized
      // by ONE constant (--queue-scale 1.48 = 34px, the largest at which two rows still fit) and
      // drawn with the SAME line weight as the small icons — the conditional buttons first in
      // their row so an appearing one moves no fixed button, and a quiet + last
      const rowIds = (id: string): string[] => {
        const m = new RegExp(`<span id="${id}" class="toolrow">([\\s\\S]*?)</span>`).exec(indexSrc);
        return [...(m?.[1] ?? "").matchAll(/<button id="([a-z]+)"/g)].map((x) => x[1]!);
      };
      const rows = ["toolrow1", "toolrow2"].map(rowIds);
      const headHtml = /<div id="sidetools">[\s\S]*?<div id="slots">/.exec(indexSrc)?.[0] ?? "";
      check("client: the head's functions are one right-aligned block — came in and happened · setup, the queue in the corner",
        JSON.stringify(rows) === JSON.stringify([["attnbtn", "opsbtn", "auditbtn", "outcomebtn"], ["devbtn", "saverbtn"]])
          && !headHtml.includes('id="toolrow3"')
          && /<\/span>\s*<\/span>\s*<button id="queuebtn"[^>]*>[^<]*<\/button>\s*<\/div>/.test(headHtml)
          && /justify-content: flex-end/.test(cssBody(".toolrow")) && /margin-left: auto/.test(cssBody("#toolrows"))
          && cliSrc.indexOf('$("toolrow2").appendChild(moreBtn)') >= 0
          && cliSrc.indexOf('$("toolrow2").appendChild(moreBtn)') < cliSrc.indexOf('$("toolrow2").appendChild(plusBtn)')
          && cliSrc.includes('{ id: "headplus", icon: "plus", word: "Eigener Knopf" }'),
        JSON.stringify({ rows, toolrow: cssBody(".toolrow") }));
      check("client: the task queue is sized by ONE constant (1.48 = 34px), same line weight, the views square stays 23px",
        /--queue-scale: 1\.48;/.test(cssBody("#sidetools"))
          && /width: calc\(23px \* var\(--queue-scale\)\); height: calc\(23px \* var\(--queue-scale\)\)/.test(cssBody("#sidetools #queuebtn"))
          && /calc\(14px \* var\(--queue-scale\)\)/.test(cssBody("#sidetools #queuebtn .ico"))
          && /stroke-width: calc\(1\.8px \/ var\(--queue-scale\)\)/.test(cssBody("#sidetools #queuebtn .ico"))
          && /grid-template-columns: 23px 23px; grid-auto-rows: 23px/.test(cssBody("#layouts"))
          && (indexSrc.match(/--queue-scale: [\d.]+;/g) ?? []).length === 1
          && !/data-queue|applyQueueFassung/.test(indexSrc + cliSrc),
        JSON.stringify({ sidetools: cssBody("#sidetools"), queue: cssBody("#sidetools #queuebtn .ico") }));
      // the + is the idea window since 4b6854fa (owner 2026-09-22): it OPENS the shell window and
      // files a row through /api/tasks — and it never types into a pane. The filing shape (kind,
      // queue, prefix) is pinned at the source in e2e/tasks.ts's idee block; this pin holds the
      // window-opening half and the /send ban at the head's own home (the slots family).
      const plusSrc = cut("const plusBtn = ", "// --- end IDEE VOM +-KNOPF ---");
      check("client: the + opens the idea window and only ever POSTs /api/tasks — never /send",
        plusSrc.includes('openShell({ id: "idee", title: "New idea" })')
          && plusSrc.includes('post("/api/tasks"')
          && !plusSrc.includes('"/send"') && !plusSrc.includes("sendText")
          && !/fetch\(|openActivity|showPanel/.test(plusSrc),
        plusSrc.slice(0, 120) || "no + block");
      check("client: a band's past session shows its ctx at the handover, from the line's own route",
        bandSrc.includes('el("span", "ctxfill", `${Math.round(p.ctx.pct)}%`)') && serverSrc.includes("ctx: p.who ? contextFillOf(s, p.who.cwd, p.who.sessionId) : null"),
        "bandify + successionLine");
    }
    check("hover and focus actions use a solid row-coloured surface over passive facts",
      /background:\s*var\(--rb\)/.test(slotactCss)
        && !/transparent|gradient|opacity/i.test(slotactCss)
        && indexSrc.includes(".slot:hover .slotact, .slot:focus-within .slotact { display: flex; }"),
      slotactCss.trim());
    // round 9, "Reihe": the ctx is a NUMBER ("24%"), and unknown is "?" — never 0, never empty
    check("unknown context remains the literal ? reading, and a known one is a bare percentage",
      rowSrc.includes('c ? `${Math.round(c.pct)}%` : "?"'),
      "slotRow context source");
    // ONE LINE PER SESSION IN THE PHONE DRAWER (row 69bdf591; owner 2026-09-22 "die slotLeiste ist
    // viel zu groß"). The row's own line and the action strip share one flex line, the old
    // per-row strip of big buttons is gone, and every action it carried is one tap after ⋯.
    // Measured at 390x844 on a test instance (mixed fixture): 12 of 12 occupied rows visible,
    // 42px each, where the old form showed 4 at 132–176px.
    const mobileSlot = /(?:^|\n)\s*\.slot\s*\{([^}]*)\}/.exec(mobileCss)?.[1] ?? "";
    const mobileMore = /(?:^|\n)\s*\.rowmore\s*\{([^}]*)\}/.exec(mobileCss)?.[1] ?? "";
    check("phone drawer: a session row is ONE flex line of at least 40px, and no row carries a second action line",
      /display:\s*flex/.test(mobileSlot) && /min-height:\s*40px/.test(mobileSlot) && /padding:\s*7px 8px 7px 6px/.test(mobileSlot)
        && /\.slot > \.r1, \.slot > \.bandview \{ flex: 1 1 0; min-width: 0; \}/.test(mobileCss)
        && /\.slotact, \.slot\.lane \.slotact \{ display: flex; position: static;/.test(mobileCss)
        && /\.slotact \.kill \{ display: none; \}/.test(mobileCss)
        && !/rowacts|rowact\b|mkact/.test(indexSrc + rowSrc),
      JSON.stringify({ mobileSlot: mobileSlot.trim() }));
    check("phone drawer: ⋯ is a finger target on every live row and hidden on the desktop",
      /min-height:\s*40px/.test(mobileMore) && /width:\s*36px/.test(mobileMore) && /align-self:\s*stretch/.test(mobileMore)
        && /\.rowmore, \.rowmenu \{ display: none; \}/.test(indexSrc)
        && /const more = el\("button", "rowmore"\)[^\n]*\n\s*more\.appendChild\(icon\("dots"\)\);/.test(rowSrc),
      mobileMore.trim());
    // every action the old strip carried (share/export/rename, and save/land/shelve on a lane),
    // plus kill — same handlers, same guards, in the grammar's context-menu order (danger last)
    const menuSrc = cut("function toggleRowMenu(", "popover({\n  panel: () => rowMenu,");
    const menuLabels = [...menuSrc.matchAll(/item\("([^"]+)"/g)].map((m) => m[1]);
    check("phone drawer: the ⋯ menu carries every action of the old strip, unchanged, kill last in --danger",
      JSON.stringify(menuLabels) === JSON.stringify(["Rename", "Export…", "Save", "Land", "Shelve", "Kill session"])
        && menuSrc.includes('item(s.share ? "Shared — view only…" : "Share…"') && menuSrc.includes("() => openShareDlg(s.id)")
        && menuSrc.includes("startRename(row, s)")
        && /if \(s\.worktree\) item\("Save", [^\n]*doCommit\(s\.id, "quick"\)/.test(menuSrc)
        && /if \(s\.worktree && landsEnabled\) item\("Land", [^\n]*doLand\(s\.id\)/.test(menuSrc)
        && /if \(s\.worktree\) item\("Shelve", [^\n]*doShelve\(s\.id\)/.test(menuSrc)
        && /\.rowmenuitem\.danger \{ color: var\(--danger\); \}/.test(mobileCss)
        && /\.rowmenu\.open \{[^}]*position: fixed;[^}]*left: 0; right: 0; bottom: 0;/.test(mobileCss),
      JSON.stringify(menuLabels));
    // ROW 11e541e0: Rename, Share and Export at ONE visible place per session — the Info tab's head
    // (desktop column, phone through ℹ), as quiet word buttons, not behind ⋯ and not on hover.
    // Export opens the menu of choices; the choices travel to the server as switches.
    {
      const boardSrc = cut("async function renderBoard()", "// 1b — SETUP");
      const expSrc = cut("type ExportPart = ", "async function killSlot(");
      const bmenuSrc = boardSrc.slice(boardSrc.indexOf('const menu = el("div", "bmenu")'));
      check("session actions: Rename, Share and Export are visible word buttons in the Info tab's head, not behind ⋯",
        /const acts = el\("div", "bbtnrow bheadacts"\)/.test(boardSrc) && /el\("button", "bbtn quiet", label\)/.test(boardSrc)
          && boardSrc.includes('act("Rename", ') && boardSrc.includes('act(s.share ? "Shared — view only…" : "Share…", ')
          && boardSrc.includes('act("Export…", ') && boardSrc.includes("void openExportDlg(slot, sessName)")
          && !/item\("(Rename|Export)"|item\(s\.share/.test(bmenuSrc) && bmenuSrc.includes('item("Bring session back"')
          && menuSrc.includes('item("Export…", ') && menuSrc.includes("void openExportDlg(s.id, "),
        "renderBoard head + board ⋯ + row menu");
      const parts = [...expSrc.matchAll(/\["(\w+)", "[^"]+", "[^"]+"\],/g)].map((m) => m[1]);
      check("export menu: content, the five parts plus timestamps, and three conversation formats — sent as server switches",
        JSON.stringify(parts.slice(0, 6)) === JSON.stringify(["user", "assistant", "tools", "results", "thinking", "time"])
          && /\["conversation", "Conversation", [^\n]*!canConv\]/.test(expSrc) && expSrc.includes('["screen", "Screen", ')
          && expSrc.includes('["md", "Markdown", ') && expSrc.includes('["html", "HTML", ') && expSrc.includes('["jsonl", "JSONL", ')
          && expSrc.includes("q.set(k, on[k] ? \"1\" : \"0\")") && expSrc.includes("`/api/slots/${slot}/export/conversation?${q}`")
          && expSrc.includes('`/api/slots/${slot}/export${st.screenFmt === "txt" ? "?format=txt" : ""}`'),
        JSON.stringify(parts));
      check("export menu: a slot without a readable conversation offers the screen only and shows the server's reason",
        expSrc.includes("`/api/slots/${slot}/export/conversation?probe=1`") && expSrc.includes('content: canConv ? "conversation" : "screen"')
          && /if \(!canConv\) body\.appendChild\(el\("div", "hint", probe\?\.why \?\? /.test(expSrc),
        "openExportDlg probe branch");
    }
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
  // -J: since 4b085fd9 the typed delivery header precedes the text, so it straddles the pane's wrap
  const cap2 = await tmuxOut("capture-pane", "-t", "s2", "-p", "-J");
  check("composed text visible in s2 pane", cap2.out.includes("compose-box-to-slot-two"));
  // THE DELIVERY HEADER (4b085fd9): the default adapter is claude's, so the send is preceded by the
  // typed provenance line — path and slot as the server knows them, the credential and never a
  // speaker. -J joins the wrapped rows: the header alone is wider than the pane.
  // BREAKS IF: sendText pastes without typing the header, names another path/slot, or types it after the body.
  const cap2j = await tmuxOut("capture-pane", "-t", "s2", "-p", "-J");
  check("delivery header: a /send into the default (claude) adapter types the provenance line directly before the body",
    cap2j.out.includes("[fleet-zustellung · POST /send mit Owner-Credential · path=owner · Slot 2] compose-box-to-slot-two"),
    cap2j.out.split("\n").filter((l) => l.includes("compose-box-to-slot-two")).join(" / ").slice(-240));
  check("no cross-talk (s1 text absent from s2)", !cap2.out.includes("hello-fleet-typing"));
  const cap1b = await tmuxOut("capture-pane", "-t", "s1", "-p");
  check("no cross-talk (s2 text absent from s1)", !cap1b.out.includes("compose-box-to-slot-two"));
  // --- export (before C-u wipes the input line the sent text sits on) ---
  const expHtml = await get("/api/slots/2/export");
  const expBody = await expHtml.text();
  check("export returns HTML", expHtml.ok && (expHtml.headers.get("content-type") ?? "").includes("text/html"));
  // the export keeps the pane's wrapped rows, and the delivery header pushes the text across one
  check("export contains session content", expBody.replaceAll("\n", "").includes("compose-box-to-slot-two"));
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
  // ...and a foreign harness keeps the paste byte for byte: no measurement says what pi's TUI makes
  // of a typed prefix, so the header is claude's alone (VERBOTEN on 4b085fd9: codex/pi unchanged).
  // BREAKS IF: deliveryHeader stops asking for the default adapter and heads every harness.
  const o3pi = await post("/api/slots/3/open", { cwd: "~", harness: "pi" });
  const piSend = o3pi.ok ? await post("/send", { slot: 3, text: "pi-paste-without-header", submit: false }) : null;
  await Bun.sleep(400);
  const cap3pi = await tmuxOut("capture-pane", "-t", "s3", "-p", "-J");
  check("delivery header: a /send into a pi slot pastes the body alone, no provenance line",
    !!piSend?.ok && cap3pi.out.includes("pi-paste-without-header") && !cap3pi.out.includes("[fleet-zustellung"),
    JSON.stringify({ open: o3pi.status, send: piSend?.status ?? null,
      line: cap3pi.out.split("\n").filter((l) => l.includes("pi-paste")).join(" / ").slice(-200) }));
  await post("/api/slots/3/kill", {});
  const expTxt = await get("/api/slots/2/export?format=txt");
  check("export?format=txt is a plain-text download", expTxt.ok
    && (expTxt.headers.get("content-type") ?? "").includes("text/plain")
    && (expTxt.headers.get("content-disposition") ?? "").includes("attachment"), expTxt.headers.get("content-disposition") ?? "");
  check("txt export contains session content", (await expTxt.text()).replaceAll("\n", "").includes("compose-box-to-slot-two"));
  const expInactive = await get("/api/slots/4/export");
  check("export rejects inactive slot", expInactive.status === 400);

  // --- THE CONVERSATION EXPORT (row 11e541e0): the menu's switches act on the SERVER. A planted
  // claude transcript carries one block of every kind — user text, assistant text, a reasoning
  // trace longer than the chat view's 10 000-char cut, a tool call and its result — plus the owner
  // token and this user's home path inside the words. Each "off" is proven against an "on" over
  // the same fixture, so a filter that drops everything cannot pass as a filter that works.
  {
    const cvCwd = `${tmpdir()}/fleet-e2e-convexport-${process.pid}`;
    const cvProj = `${process.env.HOME}/.claude/projects/${cvCwd.replace(/[^a-zA-Z0-9]/g, "-")}`;
    mkdirSync(cvCwd, { recursive: true });
    mkdirSync(cvProj, { recursive: true });
    const longTrace = `export-thinking-trace ${"x".repeat(12_000)} END-OF-LONG-TRACE`;
    const line = (type: string, content: unknown[]) =>
      `${JSON.stringify({ type, cwd: cvCwd, timestamp: "2026-09-23T10:00:00.000Z", message: { content } })}\n`;
    writeFileSync(`${cvProj}/conv.jsonl`,
      line("user", [{ type: "text", text: `export-user-words <script>x</script> key ${TOKEN} file ${process.env.HOME}/notes.md` }])
      + line("assistant", [{ type: "thinking", thinking: longTrace }, { type: "text", text: "export-assistant-words" },
        { type: "tool_use", id: "tu1", name: "Bash", input: { command: "echo export-tool-input" } }])
      + line("user", [{ type: "tool_result", tool_use_id: "tu1", content: "export-tool-output" }]));
    const cvFree = ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
      .slots.filter((s) => s.cwd === null).map((s) => s.id).pop();
    const cvOpened = cvFree !== undefined && (await post(`/api/slots/${cvFree}/open`, { cwd: cvCwd })).ok;
    check("conversation export fixture: a free slot opens on a throwaway cwd with a planted transcript", cvOpened, `slot=${cvFree}`);
    if (cvOpened) {
      const url = (q: string) => `/api/slots/${cvFree}/export/conversation?${q}`;
      const probe = (await (await get(url("probe=1"))).json()) as { available?: boolean; why?: string | null };
      check("conversation export: the probe finds the slot's conversation", probe.available === true && probe.why === null, JSON.stringify(probe));
      type ExportRow = { role: string; ts?: string; content: { type: string; text?: string; thinking?: string; content?: string; input?: string }[] };
      const rows = async (q: string): Promise<ExportRow[]> => (await (await get(url(q))).text()).split("\n").filter(Boolean).map((l) => JSON.parse(l) as ExportRow);
      const types = (rs: ExportRow[]) => new Set(rs.flatMap((r) => r.content.map((c) => c.type)));
      const all = await rows("format=jsonl&tools=1&results=1&thinking=1");
      const dflt = await rows("format=jsonl");
      const noThink = await rows("format=jsonl&tools=1&results=1&thinking=0");
      const noTools = await rows("format=jsonl&tools=0&results=0&thinking=1&time=0");
      check("conversation export: all switches on carry text, thinking, tool_use and tool_result",
        ["text", "thinking", "tool_use", "tool_result"].every((t) => types(all).has(t)), JSON.stringify([...types(all)]));
      check("conversation export: 'Tool-Calls aus' carries no tool_use and no tool_result block",
        !types(noTools).has("tool_use") && !types(noTools).has("tool_result") && types(noTools).has("thinking"),
        JSON.stringify([...types(noTools)]));
      check("conversation export: 'Reasoning aus' carries no thinking block, the tool traffic stays",
        !types(noThink).has("thinking") && types(noThink).has("tool_use") && types(noThink).has("tool_result"),
        JSON.stringify([...types(noThink)]));
      check("conversation export: the default is the words only — no tools, no reasoning",
        [...types(dflt)].join() === "text" && dflt.some((r) => r.role === "user") && dflt.some((r) => r.role === "assistant"),
        JSON.stringify([...types(dflt)]));
      check("conversation export: timestamps follow their switch",
        dflt.every((r) => r.ts === "2026-09-23T10:00:00.000Z") && noTools.every((r) => r.ts === undefined),
        JSON.stringify({ on: dflt[0]?.ts, off: noTools[0]?.ts }));
      const trace = all.flatMap((r) => r.content).find((c) => c.type === "thinking")?.thinking ?? "";
      check("conversation export: a claude reasoning trace leaves whole, past the chat view's cut",
        trace.endsWith("END-OF-LONG-TRACE") && !trace.includes("[+"), `${trace.length} chars`);
      const allText = JSON.stringify(all);
      const redacted = (await get(url("format=jsonl"))).headers.get("x-fleet-redacted");
      check("conversation export: the owner token and the home path never reach the file",
        TOKEN.length >= 12 && !allText.includes(TOKEN) && allText.includes("key [redacted]")
          && !allText.includes(`${process.env.HOME}/`) && allText.includes("file ~/notes.md") && Number(redacted) >= 2,
        `token planted: ${TOKEN.length >= 12}, x-fleet-redacted=${redacted}`);
      const md = await get(url("format=md&tools=1&results=1"));
      const mdBody = await md.text();
      check("conversation export: Markdown is a download with the turns as headings and tool blocks fenced",
        md.ok && (md.headers.get("content-disposition") ?? "").includes(".md") && mdBody.includes("## You · 2026-09-23 10:00:00")
          && mdBody.includes("**Tool: Bash**") && mdBody.includes("export-tool-output") && !mdBody.includes("export-thinking-trace"),
        mdBody.slice(0, 200));
      const html = await get(url("format=html"));
      const htmlBody = await html.text();
      check("conversation export: HTML is a printable page that escapes the conversation",
        html.ok && (html.headers.get("content-type") ?? "").includes("text/html")
          && htmlBody.includes("&lt;script&gt;x&lt;/script&gt;") && !htmlBody.includes("<script>x"),
        htmlBody.slice(0, 120));
      const badFmt = await get(url("format=pdf"));
      check("conversation export: an unknown format is refused by name", badFmt.status === 400
        && ((await badFmt.json()) as { error?: string }).error?.includes("md, html, jsonl") === true, String(badFmt.status));
      await post(`/api/slots/${cvFree}/kill`, {});
    }
    rmSync(`${cvProj}/conv.jsonl`, { force: true });
    try { rmdirSync(cvProj); } catch { /* not ours to empty */ }
    rmSync(cvCwd, { recursive: true, force: true });
    // a slot with no transcript behind it: the probe says why, and the export itself refuses. Its
    // own empty cwd — "~" would find whatever conversations this machine's user ever had there.
    const bareCwd = `${tmpdir()}/fleet-e2e-convbare-${process.pid}`;
    mkdirSync(bareCwd, { recursive: true });
    const bare = await post("/api/slots/3/open", { cwd: bareCwd });
    if (bare.ok) {
      const p3 = (await (await get("/api/slots/3/export/conversation?probe=1")).json()) as { available?: boolean; why?: string | null };
      const e3 = await get("/api/slots/3/export/conversation?format=md");
      check("conversation export: a slot without a readable conversation offers the screen only and says why",
        p3.available === false && typeof p3.why === "string" && p3.why.includes("Bildschirm") && e3.status === 409,
        JSON.stringify({ p3, status: e3.status }));
      await post("/api/slots/3/kill", {});
    } else check("conversation export: fixture slot 3 opens for the no-transcript probe", false, String(bare.status));
    rmSync(bareCwd, { recursive: true, force: true });
    check("conversation export rejects an inactive slot", (await get("/api/slots/4/export/conversation?probe=1")).status === 400);
  }

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
        pinCap = (await tmuxOut("capture-pane", "-t", "s3", "-p", "-J")).out; // -J: the delivery header wraps the row
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

  // --- A STATE FILE CARRIES THE SOCKET ITS PANES LIVE ON, and a boot on another socket rehydrates
  // none of its slots (server/persist.ts#foreignStateOwner). The class: a scratch server booting a
  // copy of the live fleet.json resumed the live sessions on its own socket (2026-09-20, report
  // af1aa862, slot 11). Every sN pane is killed while the server is down, so a slot can only come
  // back from the STATE FILE — boot's tmux adoption has nothing to find. Three boots:
  //  (a) sock = another socket → zero slots, no pane spawned, the log names both sockets. Mutation:
  //      drop the foreignStateOwner gate in server.ts → the rows rehydrate, ensureSlot respawns → red.
  //  (b) the original bytes (sock = ours) → the identical slot list, every pane respawned.
  //  (c) the field ABSENT (every pre-field file, the live one at first deploy) → still ours, and the
  //      boot's own save writes the field. Mutation: read absence as foreign → red.
  // The original bytes go back after (a), so what (a)'s save pruned (shares, autos, requeued tasks)
  // is restored for the modules after this one. ---
  {
    const statePath = `${ROOT}/fleet.json`;
    type Row = Record<string, unknown> & { id: number; cwd?: string | null };
    const F = ((await (await get("/api/sessions")).json()) as { slots: Row[] }).slots
      .filter((r) => !r.cwd).map((r) => r.id).pop() ?? 16;
    const open = await post(`/api/slots/${F}/open`, { cwd: "~", label: "sock-owner-probe" });
    check("sock-owner fixture: a labelled slot is open to be rehydrated", open.ok, `slot ${F}: ${open.status}`);
    const keys = ["id", "cwd", "label", "mission", "awaiting", "worktree", "harness", "model", "effort", "taskId", "programId"];
    const projection = async (): Promise<string> => {
      const rows = ((await (await get("/api/sessions")).json()) as { slots: Row[] }).slots;
      return JSON.stringify(rows.filter((r) => r.cwd).map((r) => Object.fromEntries(keys.map((k) => [k, r[k] ?? null]))));
    };
    const persistedSock = async (): Promise<unknown> => {
      try { return (JSON.parse(readFileSync(statePath, "utf8")) as { sock?: unknown }).sock; } catch { return "unreadable"; }
    };
    const baseline = await projection();
    let ownSock: unknown = null;
    for (let i = 0; i < 100 && ownSock !== SOCK; i++) { ownSock = await persistedSock(); if (ownSock !== SOCK) await Bun.sleep(50); }
    check("the state file names the tmux socket that wrote it", ownSock === SOCK, JSON.stringify({ ownSock, SOCK }));
    const paneNames = async (): Promise<string[]> =>
      (await tmuxOut("list-sessions", "-F", "#{session_name}")).out.split("\n").filter((n) => /^s\d+$/.test(n));
    const bootWith = async (bytes: string): Promise<string> => {
      await stopSrv();
      for (const n of await paneNames()) await tmuxOut("kill-session", "-t", `=${n}`);
      writeFileSync(statePath, bytes, { mode: 0o600 });
      const logAt = (() => { try { return readFileSync(`${ROOT}/server.log`, "utf8").length; } catch { return 0; } })();
      await restartSrv();
      try { return readFileSync(`${ROOT}/server.log`, "utf8").slice(logAt); } catch { return ""; }
    };
    // THE ANCHOR: with srv stopped and every sN killed, the suite's tmux server would hold no
    // session and EXIT — and the next restartSrv would start a NEW one from this runner, whose env
    // carries every FLEET_* knob. Every later pane inherits that global env, so restart.ts's
    // deliberately dropped FLEET_VERIFY_CMD came back and its three V1/P-7c checks went red on the
    // helper preview d8af48c133bd. One non-slot session keeps the original server alive.
    const anchor = "sock-owner-anchor";
    await tmuxOut("new-session", "-d", "-s", anchor, "sleep 3600");
    await stopSrv();
    const originalBytes = readFileSync(statePath, "utf8");
    const original = JSON.parse(originalBytes) as Record<string, unknown> & { slots?: Record<string, unknown> };
    const rowCount = Object.keys(original.slots ?? {}).length;
    const foreignLog = await bootWith(JSON.stringify({ ...original, sock: `${SOCK}-elsewhere` }, null, 2));
    const foreignRows = await projection();
    await Bun.sleep(1500); // a negative proof: give self-heal its window to respawn anything it holds
    const foreignPanes = await paneNames();
    check("a boot on another socket rehydrates NONE of the state file's slots",
      rowCount >= 1 && foreignRows === "[]", JSON.stringify({ rowCount, foreignRows: foreignRows.slice(0, 300) }));
    check("…spawns no session for them",
      foreignPanes.length === 0, JSON.stringify(foreignPanes));
    check("…and says so in one log line naming both sockets, then keeps serving",
      foreignLog.includes(`state file belongs to tmux socket "${SOCK}-elsewhere", this server runs on '${SOCK}'`)
        && foreignLog.includes(`its ${rowCount} slot row(s)`) && !foreignLog.includes("REFUSING TO START"),
      foreignLog.split("\n").filter((l) => l.includes("state file belongs")).join(" | ").slice(0, 300) || foreignLog.slice(-300));

    await bootWith(originalBytes);
    const sameRows = await projection();
    let respawned: string[] = [];
    const want = (JSON.parse(baseline) as { id: number }[]).map((r) => `s${r.id}`).sort();
    for (let i = 0; i < 100; i++) {
      respawned = (await paneNames()).sort();
      if (want.every((n) => respawned.includes(n))) break;
      await Bun.sleep(50);
    }
    check("a boot on the SAME socket rehydrates every slot exactly as before — identical slot list",
      sameRows === baseline && baseline.includes("sock-owner-probe"),
      JSON.stringify({ baseline: baseline.slice(0, 300), sameRows: sameRows.slice(0, 300) }));
    check("…and brings each of their panes back", want.every((n) => respawned.includes(n)),
      JSON.stringify({ want, respawned }));

    const { sock: _drop, ...legacy } = original;
    await bootWith(JSON.stringify(legacy, null, 2));
    const legacyRows = await projection();
    let legacySock: unknown = null;
    for (let i = 0; i < 100 && legacySock !== SOCK; i++) { legacySock = await persistedSock(); if (legacySock !== SOCK) await Bun.sleep(50); }
    check("a state file WITHOUT the socket field counts as this boot's own — every slot rehydrated",
      legacyRows === baseline, JSON.stringify({ baseline: baseline.slice(0, 300), legacyRows: legacyRows.slice(0, 300) }));
    check("…and that boot's save writes the field", legacySock === SOCK, JSON.stringify(legacySock));
    await post(`/api/slots/${F}/kill`, {});
    await tmuxOut("kill-session", "-t", `=${anchor}`);
  }
}
