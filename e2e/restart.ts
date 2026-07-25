// File permissions, kill semantics, and the srv restart: what must survive it (state, history,
// prompt log, shares, schedules, a lane's selfToken) and the audit log with its rotation.
// Sets up the deploy-gap repo and the env line the steward section is measured against.
import { spawnSync } from "node:child_process";
import { readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { BASE, IP, PORT, ROOT, SOCK, TOKEN, check, get, plogRead, post, readText, tmuxOut, wsUrl } from "./harness";
import type { Ctx } from "./ctx";
import { MERGE_IDLE_MS, settleForMerge } from "./lane-helpers";

export async function run(ctx: Ctx): Promise<void> {
  // --- file permissions ---
  const streamMode = statSync(`${ROOT}/streams/s1.raw`).mode & 0o777;
  const stateMode = statSync(`${ROOT}/fleet.json`).mode & 0o777;
  check("stream file is 600", streamMode === 0o600, streamMode.toString(8));
  check("fleet.json is 600", stateMode === 0o600, stateMode.toString(8));
  const histMode = statSync(`${ROOT}/streams/s2.history.json`).mode & 0o777;
  check("history file is 600", histMode === 0o600, histMode.toString(8));

  // --- legacy lane (forked BEFORE worktree.baseSha existed): set it up HERE, while slot 1 is still
  // occupied, so it can never take the slot the restart section asserts is empty. The field is
  // stripped from the persisted state below, between the srv kill and the restart, so the restored
  // server sees exactly a pre-field lane — which must keep recording off the base NAME, never guess. ---
  const legacyRepo = process.env.FLEET_E2E_REPO ?? "";
  let legacyLane: { slot: number; cwd: string; branch: string } | null = null;
  if (legacyRepo) {
    const lg = (await (await post("/api/lanes", { repo: legacyRepo })).json()) as { slot?: number; cwd?: string; branch?: string };
    if (lg.slot && lg.cwd && lg.branch) {
      await Bun.write(`${lg.cwd}/legacy.txt`, "work in a lane that predates baseSha\n");
      spawnSync("git", ["-C", lg.cwd, "add", "legacy.txt"]);
      spawnSync("git", ["-C", lg.cwd, "commit", "-qm", "legacy lane work"]);
      legacyLane = { slot: lg.slot, cwd: lg.cwd, branch: lg.branch };
    }
  }

  // --- kill semantics ---
  const k1 = await post("/api/slots/1/kill", {});
  check("kill slot 1 accepted", k1.ok);
  await Bun.sleep(4000);
  const s1dead = await tmuxOut("has-session", "-t", "s1");
  check("killed slot stays dead after 4s", s1dead.code !== 0);
  check("killed slot's share died with it", (await fetch(BASE + `/s/${ctx.shIntId}/info`, { headers: { cookie: ctx.shICookie } })).status === 404);

  await tmuxOut("kill-session", "-t", "s2");
  await Bun.sleep(4500);
  const s2back = await tmuxOut("has-session", "-t", "s2");
  check("externally-killed slot self-heals", s2back.code === 0);

  // --- deploy-gap fact (P-4) setup, consumed in the steward + digest sections below.
  // The dir this suite runs from is a throwaway COPY of the repo (e2e-isolated.sh) and not a git
  // repo at all, so the server is pointed at a dedicated throwaway repo via FLEET_REPO_DIR. It
  // must be its OWN repo, not FLEET_E2E_REPO: the checks commit into it, and the lane/merge tests
  // own the content of that one. Created here because it has to exist BEFORE the server that
  // stamps its boot HEAD — the env rides both restarts below.
  const GAP_REPO = `${process.env.TMPDIR ?? "/tmp"}/fleet-e2e-gaprepo-${process.pid}`;
  const gapGit = (...a: string[]) => Bun.spawnSync(["git", "-C", GAP_REPO, ...a]);
  rmSync(GAP_REPO, { recursive: true, force: true });
  Bun.spawnSync(["mkdir", "-p", GAP_REPO]);
  gapGit("init", "-q");
  gapGit("config", "user.email", "t@t");
  gapGit("config", "user.name", "t");
  writeFileSync(`${GAP_REPO}/server.ts`, "// the build the server boots from\n");
  gapGit("add", "-A");
  gapGit("commit", "-qm", "init");
  const gapEnv = `FLEET_REPO_DIR='${GAP_REPO}' `;

  // --- restart persistence ---
  const srvKill = Bun.spawn(["tmux", "-L", SOCK, "kill-session", "-t", "srv"]);
  await srvKill.exited;
  await Bun.sleep(500);
  // server down → the state file is quiescent: strip baseSha from the legacy lane's persisted
  // worktree record, so the restarted server restores it in its pre-field shape
  if (legacyLane) {
    const stFile = `${ROOT}/fleet.json`;
    const st = JSON.parse(readFileSync(stFile, "utf8")) as
      { slots?: Record<string, { worktree?: { baseSha?: string } | null }> };
    const wtRec = st.slots?.[String(legacyLane.slot)]?.worktree;
    if (wtRec) delete wtRec.baseSha;
    writeFileSync(stFile, JSON.stringify(st, null, 2), { mode: 0o600 });
  }
  // --- context-size proxy setup (consumed in the steward section below): the fact is PINNED-slot
  // only, and this suite runs with FLEET_CMD=true, so no slot ever gets a session uuid pinned at
  // pane creation (server.ts: only a claude BASE_CMD pins one). The one legitimate way in is the
  // same door the server itself uses on a deploy — restore from the state file — so a uuid is
  // planted for the surviving slot 2 while the server is down, and the transcript that uuid names
  // is written after the restart (its cwd is only known from the API).
  const PLANTED_SID = "e2e0feed-0000-4000-8000-000000000001";
  {
    const stFile = `${ROOT}/fleet.json`;
    const st = JSON.parse(readFileSync(stFile, "utf8")) as
      { slots?: Record<string, { cwd?: string; sessionId?: string }> };
    const rec = st.slots?.["2"];
    if (rec) rec.sessionId = PLANTED_SID;
    writeFileSync(stFile, JSON.stringify(st, null, 2), { mode: 0o600 });
  }
  // inherit FLEET_CMD rather than hardcoding one — restarting with a baked-in
  // `--dangerously-skip-permissions` would silently leave the server in unattended
  // mode after the test run, an escalation the README promises is explicit opt-in
  // FLEET_OUTCOME_WINDOW_MS / FLEET_PROMOTION_MIN_N must ride across the restart too, or the
  // post-restart server reverts to the 10-min default window and the outcome tests (which run
  // after this section) can never measure a send inside the test's time budget.
  // FLEET_DISPATCH_REPO + the fake-agent cmds must ride across too, or every post-restart test
  // meets a server whose dispatcher is permanently unavailable and whose merge/summary/commit
  // agents are the real `claude` instead of the suite's stand-ins.
  // FLEET_VERIFY_CMD is DELIBERATELY excluded here (do not add it): the post-restart server
  // must run with NO verify command so the V1 "no cmd → verify field absent, clean path lands
  // as today" case below is exercised against a genuinely unconfigured server (§3). The
  // configured-server verify cases run before this restart.
  const cmdEnv = ["FLEET_CMD", "FLEET_ALLOWED_HOSTS", "FLEET_SHARE_HOSTS", "FLEET_AUDIT_ROTATE_BYTES",
    "FLEET_OUTCOME_WINDOW_MS", "FLEET_OUTCOME_SUSTAIN_MS", "FLEET_HARM_ATTEST_TTL_MS",
    "FLEET_PROMOTION_MIN_N", "FLEET_INTAKE_SECRET", "FLEET_DISPATCH_REPO",
    // without these the post-restart server reverts to the 60s idle gate / 15s tick and no
    // auto-③ can be observed inside the suite's budget
    "FLEET_AUTO_REVIEW_MS", "FLEET_AUTO_REVIEW_IDLE_MS",
    "FLEET_SUMMARY_CMD", "FLEET_ENHANCE_CMD", "FLEET_MERGE_CMD", "FLEET_COMMIT_CMD", "FLEET_DIGEST_CMD",
    "FLEET_REVIEW_CMD"]
    .filter((k) => process.env[k])
    .map((k) => `${k}='${process.env[k]!.replaceAll("'", "'\\''")}' `)
    .join("");
  // restart the server from wherever THIS suite lives (the isolated copy during
  // e2e-isolated.sh runs, the repo itself when run against the live instance),
  // carrying the port/socket so the restarted server is the same instance we tested
  const srvStart = Bun.spawn(["tmux", "-L", SOCK, "new-session", "-d", "-s", "srv",
    `cd '${ROOT}' && FLEET_HOST=${IP} FLEET_PORT=${PORT} FLEET_SOCK=${SOCK} ${cmdEnv}${gapEnv}exec bun server.ts >> server.log 2>&1`]);
  await srvStart.exited;
  await Bun.sleep(3000);
  const api = (await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null; label: string | null }[] };
  check("after restart: slot 2 still active", typeof api.slots[1].cwd === "string", String(api.slots[1].cwd));
  check("after restart: slot 1 still empty", api.slots[0].cwd === null);
  check("after restart: label persisted", api.slots[1].label === "research-agent");
  // the planted uuid rode the restore, so slot 2 is now a PINNED slot: give it a transcript of a
  // KNOWN byte size, which the context-size-proxy checks in the steward section read back.
  const PLANTED_TR_BYTES = 4097;
  const PLANTED_TR = api.slots[1].cwd
    ? `${process.env.HOME}/.claude/projects/${api.slots[1].cwd.replace(/[^a-zA-Z0-9]/g, "-")}/${PLANTED_SID}.jsonl`
    : null;
  if (PLANTED_TR) await Bun.write(PLANTED_TR, "x".repeat(PLANTED_TR_BYTES - 1) + "\n");
  // guards fix A: the lane's selfToken must survive the restart. The lane pane still holds
  // the token baked at spawn; the restarted server must restore the SAME token from state,
  // so a /api/self/autos call authed with the pre-restart token still succeeds.
  if (ctx.restartSelfTok) {
    const restRes = await fetch(BASE + "/api/self/autos", {
      method: "POST",
      headers: { "content-type": "application/json", "x-fleet-self-token": ctx.restartSelfTok },
      body: JSON.stringify({ text: "post-restart self check-in", inSec: 3600 }),
    });
    const restJ = (await restRes.json()) as { ok?: boolean; auto?: { id: string; slot: number } };
    check("after restart: lane selfToken still authorizes /api/self/autos (persisted, not rotated)",
      restRes.ok && restJ.auto?.slot === ctx.restartSelfSlot, `${restRes.status} ${JSON.stringify(restJ)}`);
    if (restJ.auto) await post(`/api/autos/${restJ.auto.id}/delete`, {});
    await post(`/api/slots/${ctx.restartSelfSlot}/kill`, {}); // tear the persistence lane down
  }

  // --- the pre-baseSha lane (set up before the kill-semantics section, field stripped from state
  // above): its outcome record must still be assembled off the base NAME — the optional field is a
  // preference, never a requirement, and an old lane must not silently record nothing. ---
  if (legacyLane) {
    const sessL = (await (await get("/api/sessions")).json()) as
      { slots: { id: number; worktree?: { base?: string; baseSha?: string } | null }[] };
    const wtL = sessL.slots.find((x) => x.id === legacyLane!.slot)?.worktree;
    check("legacy lane: restored WITHOUT baseSha (pre-field lane shape)",
      !!wtL && wtL.baseSha === undefined && typeof wtL.base === "string", JSON.stringify(wtL));
    await post(`/api/slots/${legacyLane.slot}/kill`, {});
    const recL = ((await (await get("/api/lane-outcomes?limit=1000")).json()) as
      { outcomes: { branch: string | null; disposition: string; commitCount: number; base: string | null; filesTouched: string[] }[] })
      .outcomes.find((o) => o.branch === legacyLane!.branch);
    check("legacy lane with NO baseSha still records off the base name (unchanged fallback)",
      recL?.disposition === "killed-dirty" && recL?.commitCount === 1
      && typeof recL?.base === "string" && (recL?.filesTouched ?? []).includes("legacy.txt"), JSON.stringify(recL));
  }

  // --- V1 case C: an UNCONFIGURED server (no FLEET_VERIFY_CMD — deliberately dropped from
  // cmdEnv above). The verify field must be ABSENT from the verdict ("unverified", never
  // silently green — design note §3), and today's clean-path behavior is otherwise unchanged.
  // A CONFLICT lane keeps its verdict readable (a clean land tears the slot down), so we can
  // assert the field's absence directly; that resolved path is exactly where verify WOULD run
  // were a command configured. ---
  {
    const REPO_C = process.env.FLEET_E2E_REPO ?? "";
    if (REPO_C) {
      const modeFile = `${REPO_C.replace(/\/[^/]+$/, "")}/mergemode`;
      await Bun.write(modeFile, "do"); // fakemerge (carried across the restart) really resolves
      const lc = (await (await post("/api/lanes", { repo: REPO_C })).json()) as { slot: number; cwd: string };
      await Bun.write(`${lc.cwd}/code.txt`, "root\nnoverify-lane\n");
      spawnSync("git", ["-C", lc.cwd, "commit", "-aqm", "noverify lane work"]);
      await Bun.write(`${REPO_C}/code.txt`, "root\nnoverify-main\n"); // same line → conflict → agent
      spawnSync("git", ["-C", REPO_C, "commit", "-aqm", "noverify main work"]);
      // settle: wait until the lane pane has been idle ≥ MERGE_IDLE_MS (3s) so the land gate lets
      // the merge start (mirrors the in-block settleForMerge, which is out of scope here)
      for (let i = 0; i < 80; i++) {
        const sx = (await (await get("/api/sessions")).json()) as { now: number; slots: { id: number; lastOutput: number }[] };
        const sl = sx.slots.find((x) => x.id === lc.slot);
        if (sl && sx.now - sl.lastOutput >= 3000) break;
        await Bun.sleep(150);
      }
      await post(`/api/slots/${lc.slot}/merge`, {});
      let lastC: { status?: string; verify?: unknown } | null = null;
      for (let i = 0; i < 100; i++) {
        const j = (await (await get(`/api/slots/${lc.slot}/merge`)).json()) as
          { running?: boolean; last: { status?: string; verify?: unknown } | null };
        if (!j.running) { lastC = j.last; break; }
        await Bun.sleep(100);
      }
      check("V1: with NO FLEET_VERIFY_CMD the resolved verdict omits the verify field (unverified, not silently green)",
        lastC?.status === "resolved" && lastC !== null && !("verify" in lastC), JSON.stringify(lastC));
      await post(`/api/slots/${lc.slot}/kill`, {});
      await Bun.write(modeFile, "blocked"); // restore the default merge mode
    }
  }

  const rec2 = (await (await get("/api/dirs?path=~")).json()) as { recents: string[] };
  check("after restart: recents persisted", rec2.recents.length >= 2, JSON.stringify(rec2.recents));
  const h2b = (await (await get("/api/slots/2/history")).json()) as { history: { text: string }[] };
  check("after restart: history persisted", h2b.history.some((h) => h.text === "compose-box-to-slot-two"), `${h2b.history.length} entries`);
  const plogAfter = await plogRead();
  check("after restart + slot kills: prompt log intact",
    plogAfter.some((e) => e.text === "compose-box-to-slot-two") && plogAfter.some((e) => e.source === "share"), `${plogAfter.length} entries`);
  const shPAuth = await post(`/s/${ctx.shPersistId}/auth`, { password: "persistpass1" });
  check("after restart: share persisted and answers", shPAuth.ok);
  // the size a guest builds its grid from must be TMUX TRUTH, not the fresh process's
  // 200×50 default — the restart is exactly the moment the in-memory cache dies while
  // the pane keeps the size the last client set (regression: every deploy desynced /info)
  {
    // resize the pane BEHIND the server's back (raw tmux, not /resize) — the server cache
    // still holds the old size, so only a live tmux read can answer correctly
    await tmuxOut("resize-window", "-t", "s2", "-x", "77", "-y", "31");
    const shPCookie = (shPAuth.headers.get("set-cookie") ?? "").split(";")[0];
    const inf = (await (await fetch(BASE + `/s/${ctx.shPersistId}/info`, { headers: { cookie: shPCookie } })).json()) as
      { cols: number; rows: number };
    const truth = (await tmuxOut("display-message", "-p", "-t", "s2", "#{window_width} #{window_height}")).out.trim();
    check("share info reports the pane's true size, not the server cache",
      `${inf.cols} ${inf.rows}` === truth && truth === "77 31", `info ${inf.cols}x${inf.rows} vs tmux ${truth}`);
  }
  const sess3 = (await (await get("/api/sessions")).json()) as { autos: { id: string; enabled: boolean; perpetual?: boolean }[] };
  check("after restart: schedule persisted", sess3.autos.some((a) => a.id === ctx.aPersistId && a.enabled));
  check("after restart: perpetual auto persisted with its flag intact",
    sess3.autos.some((a) => a.id === ctx.aPerpPersistId && a.enabled && a.perpetual === true),
    JSON.stringify(sess3.autos.find((a) => a.id === ctx.aPerpPersistId)));
  const replay2 = await new Promise<number>((resolve) => {
    let n = 0;
    const ws = new WebSocket(wsUrl(2));
    ws.binaryType = "arraybuffer";
    ws.onmessage = (e) => { n += (e.data as ArrayBuffer).byteLength; };
    ws.onopen = () => setTimeout(() => { ws.close(); resolve(n); }, 2000);
    ws.onerror = () => resolve(-1);
  });
  check("after restart: WS replay for slot 2 non-empty", replay2 > 100, `${replay2} bytes`);
  const ws404 = await get("/ws/1");
  check("WS route rejects inactive slot", ws404.status === 404);

  // --- audit log: security-relevant event trail, own file/write-chain, owner-gated read ---
  const auditPath = `${ROOT}/audit.jsonl`;
  const auditRead = async (): Promise<{ ts: number; event: string; slot?: number; detail?: string }[]> =>
    (await Bun.file(auditPath).text()).trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  check("audit endpoint requires owner token", (await fetch(BASE + "/api/audit")).status === 401);
  const auditRes = await get("/api/audit?limit=1000");
  const auditJ = (await auditRes.json()) as { events: { event: string; slot?: number }[]; total: number };
  check("audit endpoint returns events", auditRes.ok && Array.isArray(auditJ.events) && auditJ.events.length > 0,
    `${auditJ.events.length}/${auditJ.total}`);
  const auditAll = await auditRead();
  check("audit records slot_open", auditAll.some((e) => e.event === "slot_open" && e.slot === 2), `${auditAll.length} events`);
  check("audit records slot_kill", auditAll.some((e) => e.event === "slot_kill" && e.slot === 1));
  check("audit records share_create", auditAll.some((e) => e.event === "share_create"));
  check("audit records share_revoke", auditAll.some((e) => e.event === "share_revoke"));
  check("audit records share_mode_change", auditAll.some((e) => e.event === "share_mode_change"));
  check("audit records guest auth failure", auditAll.some((e) => e.event === "share_auth_fail"));
  check("audit records guest auth success", auditAll.some((e) => e.event === "share_auth_ok"));
  check("audit records owner auth failure", auditAll.some((e) => e.event === "owner_auth_fail"));
  check("audit records guest ws connect", auditAll.some((e) => e.event === "guest_ws_connect"));
  const readText = async (p: string): Promise<string> => {
    try {
      return await Bun.file(p).text();
    } catch {
      return "";
    }
  };
  const auditRaw = (await readText(auditPath)) + (await readText(`${auditPath}.1`));
  check("audit log never contains the guessed guest password", !auditRaw.includes("totally-wrong"));
  check("audit log never contains a share secret", !auditRaw.includes("viewpass123") && !auditRaw.includes("interpass123"));
  check("audit log never contains the owner token", !auditRaw.includes(TOKEN));
  const auditMode = statSync(auditPath).mode & 0o777;
  check("audit log file is 600", auditMode === 0o600, auditMode.toString(8));

  // --- rotation: restart with the threshold pinned to the CURRENT file size, so the very
  // next audit event is guaranteed to push it over and trigger exactly one rotation —
  // deterministic regardless of how many bytes the rest of the suite happened to produce
  const auditSizeBeforeRotate = statSync(auditPath).size;
  check("audit log has content to rotate", auditSizeBeforeRotate > 0, `${auditSizeBeforeRotate} bytes`);
  const rotKill = Bun.spawn(["tmux", "-L", SOCK, "kill-session", "-t", "srv"]);
  await rotKill.exited;
  await Bun.sleep(500);
  const rotStart = Bun.spawn(["tmux", "-L", SOCK, "new-session", "-d", "-s", "srv",
    `cd '${ROOT}' && FLEET_HOST=${IP} FLEET_PORT=${PORT} FLEET_SOCK=${SOCK} ${cmdEnv}${gapEnv}FLEET_AUDIT_ROTATE_BYTES=${auditSizeBeforeRotate} exec bun server.ts >> server.log 2>&1`]);
  await rotStart.exited;
  await Bun.sleep(3000);
  // one cheap, deterministic audit event: a failed owner-token request (no state mutated)
  await fetch(BASE + "/api/sessions", { headers: { authorization: "Bearer wrong-for-rotation-test" } });
  await Bun.sleep(300); // let the fire-and-forget audit write chain flush
  const auditRotExists = ((): boolean => { try { return statSync(`${auditPath}.1`).isFile(); } catch { return false; } })();
  check("audit log rotates to .1 once the size threshold is crossed", auditRotExists);
  if (auditRotExists) {
    const rotSize = statSync(`${auditPath}.1`).size;
    check("rotated .1 preserves the pre-rotation history", rotSize >= auditSizeBeforeRotate, `${rotSize} vs ${auditSizeBeforeRotate}`);
    const freshSize = statSync(auditPath).size;
    check("post-rotation audit.jsonl starts fresh, smaller than what rotated out", freshSize < auditSizeBeforeRotate, `${freshSize} vs ${auditSizeBeforeRotate}`);
  }

  ctx.cmdEnv = cmdEnv;
  ctx.gapEnv = gapEnv;
  ctx.gapRepo = GAP_REPO;
  ctx.auditPath = auditPath;
  ctx.plantedTranscript = PLANTED_TR;
  ctx.plantedTranscriptBytes = PLANTED_TR_BYTES;
}
