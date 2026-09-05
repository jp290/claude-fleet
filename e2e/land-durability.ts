// What the merge/land path must still be able to say after the process that was running it died.
//
// The deploy ritual for this fleet is `tmux kill-session -t srv` — server.log holds 125 watchdog
// respawns in 12 days, ~10/day — so every window in the land path is entered ~10×/day. Two of them
// were holes (docs/data-audit-2026-07-27.md items 2 and 3):
//   · route deletes the previous verdict → job runs → verdict written at the END. A restart in
//     between leaves NO verdict, the ⏸ guard has nothing to key on, and a re-run finds the lane
//     already rebased (by an agent, resolving conflicts nobody saw) and auto-lands it.
//   · advanceIntegration moves main → recordLand writes the undo record, the note and the tier-2
//     audit. A restart in between leaves main advanced with none of it — and a retry cannot repair
//     it, because recordLand returns early on mainBefore === mainAfter.
// Both are reproduced here against a REAL kill of the real server, not a simulated one.
import { spawnSync } from "node:child_process";
import { chmodSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { BASE, REPO, ROOT, check, get, post, restartSrv, tmuxOut } from "./harness";
import { setMergeMode, settleForMerge, waitMerge } from "./lane-helpers";

const g = (dir: string, ...a: string[]): { out: string; err: string; code: number } => {
  const r = spawnSync("git", ["-C", dir, ...a], { encoding: "utf8" });
  return { out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim(), code: r.status ?? 1 };
};
// A git WRITE from the test races the server's own git in the same worktree — `tickGit` refreshes
// the index every 10s and `git status` takes index.lock to do it, which is the very race
// server.ts documents at its own mutating-git sites. Measured, not hypothetical: one run of this
// module left `A  landdur.txt` staged and uncommitted, and every assertion downstream of it
// collapsed into a false accusation against the server. So a write retries, and its success is a
// CHECK — a fixture that silently didn't happen must never read as a defect.
const gitWrite = (dir: string, ...a: string[]): { out: string; err: string; code: number } => {
  let r = g(dir, ...a);
  for (let i = 0; i < 8 && r.code !== 0; i++) {
    spawnSync("sleep", ["0.25"]);
    r = g(dir, ...a);
  }
  return r;
};
const commitAll = (dir: string, msg: string): { out: string; err: string; code: number } => {
  const add = gitWrite(dir, "add", "-A");
  return add.code !== 0 ? add : gitWrite(dir, "commit", "-qm", msg);
};

interface Lane { slot: number; cwd: string; branch: string }
const openLane = async (): Promise<Lane | null> => {
  const j = (await (await post("/api/lanes", { repo: REPO })).json()) as
    { slot?: number; cwd?: string; branch?: string };
  return j.slot && j.cwd && j.branch ? { slot: j.slot, cwd: j.cwd, branch: j.branch } : null;
};

// a slot's own scoped credential, out of the persisted state — the MAIN land door takes nothing
// else. Polled for the shape rather than read once: openSlot queues saveState before it awaits the
// pane spawn, so the file can lag the route by a hair. A timeout returns what was last seen, so a
// genuine absence fails its own check instead of hiding inside a retry loop.
const selfTokenOf = async (slot: number): Promise<string> => {
  let seen = "";
  for (let i = 0; i < 60; i++) {
    try {
      seen = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
        { slots?: Record<string, { selfToken?: string }> }).slots?.[String(slot)]?.selfToken ?? "";
    } catch { /* mid-write */ }
    if (/^[0-9a-f]{32}$/.test(seen)) return seen;
    await Bun.sleep(50);
  }
  return seen;
};

interface AuditEvent { event?: string; detail?: string }
const auditEvents = async (): Promise<AuditEvent[]> =>
  ((await (await get("/api/audit?limit=1000")).json()) as { events: AuditEvent[] }).events;

export async function run(): Promise<void> {
  const MAIN = g(REPO, "symbolic-ref", "--short", "HEAD").out || "main";
  const receiver = ((await (await get("/api/sessions")).json()) as
    { slots: { id: number; cwd: string | null }[] }).slots.find((s) => s.cwd === null)?.id ?? 0;
  const openedReceiver = receiver ? await post(`/api/slots/${receiver}/open`, { cwd: REPO }) : null;
  check("merge-event restart setup: a non-lane receiver is open",
    !!openedReceiver?.ok, `${receiver} ${openedReceiver?.status}`);

  // === A — a merge run interrupted mid-flight (audit item 2) ============================
  // The dangerous shape: the agent has ALREADY rewritten the lane (conflicts resolved, rebased
  // onto main) when the server dies. Nothing about that tree is reviewable-by-git afterwards —
  // `tryScriptRebase` will happily exit 0 on it — so the only thing standing between those
  // resolutions and main is a record that the run happened at all.
  await setMergeMode("dohang");
  const la = await openLane();
  check("(setup A) lane for the interrupted-merge case opened", !!la, JSON.stringify(la));
  if (la) {
    await Bun.write(`${la.cwd}/code.txt`, "root\nlane-side-A\n");
    const cA = commitAll(la.cwd, "lane A work");
    await Bun.write(`${REPO}/code.txt`, "root\nmain-side-A\n"); // same line → conflict → agent
    const cM = commitAll(REPO, "main A work");
    check("(setup A) the lane and main commits that create the conflict both landed",
      cA.code === 0 && cM.code === 0, `${cA.code}/${cM.code} ${cA.err} ${cM.err}`.slice(0, 200));
    const mainBeforeA = g(REPO, "rev-parse", MAIN).out;
    await settleForMerge(la.slot);
    const started = (await (await post(`/api/slots/${la.slot}/merge`, {})).json()) as { running?: boolean };
    check("(setup A) the merge job started", started.running === true, JSON.stringify(started));
    const subscribedR = await post(`/api/slots/${receiver}/watch`, { kind: "merge", target: la.slot, idleSec: 0 });
    const subscribed = (await subscribedR.json()) as { watch?: { id: string; armed: boolean }; error?: string };
    check("merge-event restart setup: subscription is armed before the terminal fact",
      subscribedR.ok && subscribed.watch?.armed === true, `${subscribedR.status} ${JSON.stringify(subscribed)}`);
    // deterministic signal, not a sleep: the agent's rebase is done exactly when main becomes an
    // ancestor of the lane branch. Everything after this point is "the resolutions are committed".
    let rebased = false;
    for (let i = 0; i < 300 && !rebased; i++) {
      rebased = g(REPO, "merge-base", "--is-ancestor", MAIN, la.branch).code === 0;
      if (!rebased) await Bun.sleep(100);
    }
    check("(setup A) the agent rebased the lane onto main before the kill", rebased);

    await restartSrv(); // the deploy ritual, mid-run

    const afterA = (await (await get(`/api/slots/${la.slot}/merge`)).json()) as
      { running?: boolean; last: { status?: string; conflicted?: string[]; detail?: string } | null };
    check("an interrupted merge run leaves a verdict on record, not silence",
      afterA.last?.status === "interrupted", JSON.stringify(afterA.last));
    check("the interrupted verdict names the conflicts the agent was resolving",
      (afterA.last?.conflicted ?? []).includes("code.txt"), JSON.stringify(afterA.last?.conflicted));
    let interruptedEvents: { watchId: string; kind: string; status: string;
      payload?: { status?: string; landed?: boolean } }[] = [];
    for (let i = 0; i < 160; i++) {
      interruptedEvents = ((await (await get("/api/sessions")).json()) as
        { events: { watchId: string; kind: string; status: string;
          payload?: { status?: string; landed?: boolean } }[] }).events
        .filter((e) => e.watchId === subscribed.watch?.id);
      if (interruptedEvents[0]?.status === "delivered") break;
      await Bun.sleep(100);
    }
    check("merge event: restart BEFORE the terminal fact re-runs the level check and delivers once",
      interruptedEvents.length === 1 && interruptedEvents[0].kind === "merge-terminal"
        && interruptedEvents[0].payload?.status === "interrupted"
        && interruptedEvents[0].payload?.landed === false,
      JSON.stringify(interruptedEvents));
    const sessA = (await (await get("/api/sessions")).json()) as { slots: { id: number; mergePending?: boolean }[] };
    check("the board flags the interrupted lane as needing review (⏸)",
      sessA.slots.find((s) => s.id === la.slot)?.mergePending === true);

    // the payload: a re-run must NOT sail through the clean path and land the agent's unreviewed
    // resolutions. Same refusal the settled "resolved" verdict gets. (settle first — the land
    // gate refuses a non-confirm run while the pane is still emitting, and boot just touched it.)
    await settleForMerge(la.slot);
    const rerun = (await (await post(`/api/slots/${la.slot}/merge`, {})).json()) as
      { running?: boolean; status?: string; detail?: string };
    check("a re-run over an interrupted conflict resolution is REFUSED, not auto-landed",
      rerun.running !== true && rerun.status === "interrupted", JSON.stringify(rerun));
    check("the refusal explains that nobody has seen the resolutions",
      /no verdict was ever recorded/.test(rerun.detail ?? ""), rerun.detail);
    // give a re-run that DID start (the defect) the time it needs to reach main, so this reads a
    // settled fact rather than winning a race against the job it is supposed to catch
    for (let i = 0; i < 60 && g(REPO, "rev-parse", MAIN).out === mainBeforeA; i++) await Bun.sleep(100);
    check("main did not move while the interrupted lane was re-run",
      g(REPO, "rev-parse", MAIN).out === mainBeforeA, g(REPO, "rev-parse", MAIN).out.slice(0, 8));
    const sessA2 = (await (await get("/api/sessions")).json()) as
      { slots: { id: number; worktree?: { branch?: string } | null }[] };
    check("the interrupted lane was not torn down behind the owner's back",
      sessA2.slots.find((s) => s.id === la.slot)?.worktree?.branch === la.branch,
      JSON.stringify(sessA2.slots.find((s) => s.id === la.slot)?.worktree));

    // …and the owner's escape hatch still works: confirm-land is a pure git ff of the rebased
    // lane, so the reviewed resolution lands and the lane tears down. Doubles as cleanup.
    const conf = (await (await post(`/api/slots/${la.slot}/merge`, { confirm: true })).json()) as
      { status?: string; landed?: boolean; detail?: string };
    check("the owner can still confirm-land an interrupted resolution after reviewing it",
      conf.status === "merged" && conf.landed === true, JSON.stringify(conf));
  }

  // === B — a land interrupted between "main moved" and "the land is recorded" (audit item 3) ===
  // Widened by FLEET_TEST_LAND_PAUSE_MS, which exists only for this: the real window is a few
  // milliseconds of straight-line code and cannot be hit from outside, and an unproven fix for it
  // would be worth nothing. The kill itself is real — the same kill-session the deploy uses.
  await restartSrv({ FLEET_TEST_LAND_PAUSE_MS: "30000" });
  await setMergeMode("blocked"); // a CLEAN lane: no conflict, no agent, the auto-land path
  const lb = await openLane();
  check("(setup B) lane for the interrupted-land case opened", !!lb, JSON.stringify(lb));
  if (lb) {
    await Bun.write(`${lb.cwd}/landdur.txt`, "work that reaches main with nobody recording it\n");
    const cB = commitAll(lb.cwd, "lane B work");
    check("(setup B) the lane commit landed (nothing left staged for the land gate to refuse)",
      cB.code === 0 && g(lb.cwd, "status", "--porcelain").out === "", `${cB.code} ${cB.err}`.slice(0, 200));
    const mainBeforeB = g(REPO, "rev-parse", MAIN).out;
    const laneTipB = g(REPO, "rev-parse", lb.branch).out;
    await settleForMerge(lb.slot);
    const startedB = (await (await post(`/api/slots/${lb.slot}/merge`, {})).json()) as
      { running?: boolean; status?: string; detail?: string };
    check("(setup B) the clean auto-land job started", startedB.running === true, JSON.stringify(startedB));
    let advanced = false;
    for (let i = 0; i < 300 && !advanced; i++) {
      advanced = g(REPO, "rev-parse", MAIN).out !== mainBeforeB;
      if (!advanced) await Bun.sleep(100);
    }
    check("(setup B) main advanced — the server is now inside the advance→record window", advanced,
      `${mainBeforeB.slice(0, 8)} -> ${g(REPO, "rev-parse", MAIN).out.slice(0, 8)}`);
    const mainAfterB = g(REPO, "rev-parse", MAIN).out;
    check("(setup B) main was fast-forwarded to exactly the lane tip", mainAfterB === laneTipB);

    await restartSrv(); // …and the pause knob is gone with it

    // Everything below is what a restart in that window used to destroy, permanently: a retry
    // hits recordLand's mainBefore === mainAfter early return and creates none of it either.
    const mgB = (await (await get(`/api/slots/${lb.slot}/merge`)).json()) as
      { undoable?: { branch: string } | null };
    check("an interrupted land is still UNDOABLE after the restart (the reversibility pointer survived)",
      mgB.undoable?.branch === lb.branch, JSON.stringify(mgB.undoable));
    const note = g(REPO, "notes", "--ref=fleet/land", "show", mainAfterB);
    check("the interrupted land carries its provenance note on the landed tip",
      note.code === 0 && note.out.includes(lb.branch), `${note.code} ${note.out.slice(0, 160)}`);
    const evs = await auditEvents();
    check("the recovery is on the audit trail, naming the branch and the move",
      evs.some((e) => e.event === "land_recovered" && (e.detail ?? "").includes(lb.branch)),
      JSON.stringify(evs.slice(0, 3)));
    check("the land-in-flight marker is cleared once the land is recorded",
      Object.keys(await readLandPending()).length === 0, JSON.stringify(await readLandPending()));

    // the lane itself was never torn down (landLane never ran) — the already-merged path is the
    // owner's finish, and it must still work on a lane whose work is already on main
    await settleForMerge(lb.slot);
    const fin = (await (await post(`/api/slots/${lb.slot}/merge`, {})).json()) as
      { status?: string; landed?: boolean; detail?: string };
    check("the half-landed lane still lands cleanly afterwards (already-merged path)",
      fin.status === "merged" && fin.landed === true, JSON.stringify(fin));
  }

  // === C — the recovery must not INVENT a record ========================================
  // Two markers planted by hand into the quiescent state file, because both are states the
  // recovery has to tell apart from a real interrupted land and neither can be produced on
  // demand: a land whose advance never happened, and a main that moved somewhere this server
  // cannot account for. Fabricating an undo record for either would be worse than none — ↩ would
  // reset past work nobody recorded.
  {
    const mainNow = g(REPO, "rev-parse", MAIN).out;
    // (i) main is still exactly where the marker says it was → the advance never happened
    await plantMarker({ main: MAIN, branch: "fleet/never-advanced", mainBefore: mainNow, laneTip: mainNow.replace(/.$/, "0") });
    const st1 = await readLandPending();
    check("a marker whose advance never happened is dropped, not recorded",
      Object.keys(st1).length === 0, JSON.stringify(st1));
    const evs1 = await auditEvents();
    check("…and it invents no undo record and no recovery event",
      !evs1.some((e) => (e.detail ?? "").includes("fleet/never-advanced")));

    // (ii) main is at neither the pre-land nor the landed commit → unaccountable, audited loudly
    await plantMarker({ main: MAIN, branch: "fleet/unaccounted", mainBefore: "0".repeat(40), laneTip: "1".repeat(40) });
    const st2 = await readLandPending();
    check("an unaccountable marker is dropped rather than retried forever",
      Object.keys(st2).length === 0, JSON.stringify(st2));
    const evs2 = await auditEvents();
    check("…and says so on the audit trail instead of guessing a mainAfter",
      evs2.some((e) => e.event === "land_recover_fail" && (e.detail ?? "").includes("fleet/unaccounted")),
      JSON.stringify(evs2.slice(0, 2)));
  }

  // === D — the undo stack must READ the pre-stack shape it replaced =====================
  // `undoLands` changed from one record per repo to a capped stack of them. The deploy ritual is
  // `tmux kill-session -t srv`, ~10×/day, so a state file written by the previous shape is boot
  // input on the very first deploy after the upgrade — and a boot that only understood the array
  // would read every land recorded before it as "no land", deleting the owner's reversibility at
  // exactly the moment the change was meant to widen it. A silent loss: nothing fails, the button
  // is simply gone. So the old shape is planted here for real and booted onto.
  {
    const repo = `${REPO}.undomigrate`;
    spawnSync("git", ["init", "-q", "-b", "main", repo]);
    spawnSync("git", ["-C", repo, "config", "user.email", "e2e@test"]);
    spawnSync("git", ["-C", repo, "config", "user.name", "e2e"]);
    spawnSync("git", ["-C", repo, "config", "commit.gpgsign", "false"]);
    await Bun.write(`${repo}/base.txt`, "base\n");
    spawnSync("git", ["-C", repo, "add", "base.txt"]);
    spawnSync("git", ["-C", repo, "commit", "-qm", "base"]);
    const lane = (await (await post("/api/lanes", { repo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${lane.cwd}/mig.txt`, "work recorded under the old shape\n");
    spawnSync("git", ["-C", lane.cwd, "add", "mig.txt"]);
    spawnSync("git", ["-C", lane.cwd, "commit", "-qm", "migration lane work"]);
    const migBefore = g(repo, "rev-parse", "main").out;
    await setMergeMode("blocked");
    await settleForMerge(lane.slot);
    await post(`/api/slots/${lane.slot}/merge`, {});
    await waitMerge(lane.slot);
    const migAfter = g(repo, "rev-parse", "main").out;
    check("(setup D) a land was recorded for the repo whose state file is about to be rewritten",
      migAfter !== migBefore, `${migBefore.slice(0, 8)} -> ${migAfter.slice(0, 8)}`);

    // rewrite the QUIESCENT state file from the stack shape back to the single-record shape
    await tmuxOut("kill-session", "-t", "srv");
    await Bun.sleep(500);
    const path = `${ROOT}/fleet.json`;
    let st: { undoLands?: Record<string, unknown> } | null = null;
    let stateError = "";
    try { st = JSON.parse(readFileSync(path, "utf8")) as
      { undoLands?: Record<string, unknown> }; }
    catch (e) { stateError = e instanceof Error ? e.message : String(e); }
    check("(setup D) precondition: fleet state is readable before the old-shape rewrite",
      st !== null, stateError);
    // the state file keys by the CANONICAL repo path (createWorktree realpaths it), which on this
    // machine is /private/var/... where the test holds /var/... — look the key up instead of
    // assuming it, or the rewrite below silently edits nothing and the whole section passes
    // vacuously on an untouched file (measured: it did, on the first run of this check)
    const key = Object.keys(st?.undoLands ?? {}).find((k) => k === repo || k === realpathSync(repo));
    check("(setup D) the planted land is findable in the state file (probe fails as itself, not as the server)",
      !!key, `looked for ${repo} / ${realpathSync(repo)} in ${Object.keys(st?.undoLands ?? {}).join(", ")}`);
    const stacked = key ? st?.undoLands?.[key] : undefined;
    check("(setup D) the current server persists the land as a STACK (an array of records)",
      Array.isArray(stacked) && stacked.length === 1, JSON.stringify(stacked));
    if (st?.undoLands && key && Array.isArray(stacked)) st.undoLands[key] = stacked[stacked.length - 1] as unknown;
    if (st) {
      writeFileSync(path, JSON.stringify(st, null, 2), { mode: 0o600 });
      chmodSync(path, 0o600);
    }
    let replanted: unknown;
    let replantedError = "";
    try {
      replanted = key
        ? (JSON.parse(readFileSync(path, "utf8")) as { undoLands?: Record<string, unknown> }).undoLands?.[key]
        : undefined;
    } catch (e) { replantedError = e instanceof Error ? e.message : String(e); }
    check("(setup D) precondition: rewritten fleet state is readable for the fixture proof",
      replantedError === "", replantedError);
    check("(setup D) the planted file really carries the OLD one-object shape",
      !!replanted && !Array.isArray(replanted) && typeof (replanted as { mainAfter?: unknown }).mainAfter === "string",
      JSON.stringify(replanted));
    await restartSrv();

    const migUndo = await post("/api/repos/undo-land", { repo });
    const migJ = (await migUndo.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    check("a land persisted in the PRE-STACK shape is read back as a one-element stack and is still undoable",
      migJ.ok === true && g(repo, "rev-parse", "main").out === migBefore,
      `${migUndo.status} ${JSON.stringify(migJ)} now=${g(repo, "rev-parse", "main").out.slice(0, 8)} want=${migBefore.slice(0, 8)}`);
    check("…and that migrated stack holds exactly the one record it was given (nothing invented under it)",
      (await post("/api/repos/undo-land", { repo })).status === 404);
  }

  // === E — FLEET_LANDS=0: the instance that FOLLOWS a canonical main (dual-host S2) ======
  // The follower host runs its own fleet and fast-forwards main from the canonical one. Until this
  // flag existed, "the follower never lands" was an owner rule with nothing behind it: fleet-sync.sh
  // only MEASURES the divergence a single ⏫ click would create (exit 3), after the fact. What is
  // proven here is not that a click is refused — a 409 further down the route would also be a
  // refusal — but that the refusal costs NO LAND RECORD: no job, no mergeLast verdict, no
  // lane-outcomes line. And the counter-proof rides with it, because a lock that also fired when
  // nobody asked for it would be a canonical host that cannot land.
  {
    const le = await openLane();
    check("(setup E) lane for the land-lock case opened", !!le, JSON.stringify(le));
    const recvTok = receiver ? await selfTokenOf(receiver) : "";
    check("(setup E) the non-lane receiver carries a self-credential to knock on the MAIN land door with",
      /^[0-9a-f]{32}$/.test(recvTok), `${recvTok.length} chars, slot ${receiver}`);
    if (le) {
      const laneTok = await selfTokenOf(le.slot);
      check("(setup E) the lane carries a self-credential to read /api/self/gate with",
        /^[0-9a-f]{32}$/.test(laneTok), `${laneTok.length} chars`);
      // the lane is left DIRTY on purpose. With the flag OPEN the ⏫ door must reach its OWN first
      // refusal (uncommitted changes) — a control that spends no merge job and, unlike a green
      // land, can be run again after the restart to show the door reopening.
      await Bun.write(`${le.cwd}/lands.txt`, "follower\n");

      const LOCK = "this instance does not land — it follows a canonical main";
      const ownerDoor = async (body: Record<string, unknown> = {}): Promise<string> => {
        const r = await post(`/api/slots/${le.slot}/merge`, body);
        const j = (await r.json().catch(() => ({}))) as { error?: string; detail?: string; status?: string };
        return `${r.status} ${j.error ?? j.detail ?? j.status ?? ""}`;
      };
      const mainDoor = async (): Promise<string> => {
        const r = await fetch(`${BASE}/api/self/tasks/deadbeef/land`,
          { method: "POST", headers: { "content-type": "application/json", "x-fleet-self-token": recvTok } });
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        return `${r.status} ${j.error ?? ""}`;
      };
      const pollLands = async (): Promise<boolean | undefined> =>
        ((await (await get("/api/sessions")).json()) as { lands?: boolean }).lands;
      const gateLands = async (): Promise<boolean | undefined> => {
        const r = await fetch(`${BASE}/api/self/gate`, { headers: { "x-fleet-self-token": laneTok } });
        return ((await r.json().catch(() => ({}))) as { lands?: boolean }).lands;
      };
      const ledgerLines = (): number => {
        try { return readFileSync(`${ROOT}/lane-outcomes.jsonl`, "utf8").split("\n").filter(Boolean).length; }
        catch { return 0; }
      };

      // --- the counter-proof FIRST, on the server this module has been running on all along:
      // no FLEET_LANDS anywhere in its env, so this is "today's behaviour" by construction.
      const openPoll = await pollLands();
      const openGate = await gateLands();
      check("with no FLEET_LANDS set, the fleet says it LANDS on both the poll and the lane's gate",
        openPoll === true && openGate === true, JSON.stringify({ poll: openPoll, gate: openGate }));
      const openOwner = await ownerDoor();
      check("…and the ⏫ door is reached: it refuses for its OWN reason (the dirty tree), not for the lock",
        !openOwner.includes(LOCK) && /uncommitted changes/.test(openOwner), openOwner);
      const openMain = await mainDoor();
      check("…and the MAIN land door is reached: it refuses on the binding bracket, not on the lock",
        !openMain.includes(LOCK) && openMain.startsWith("409") && /bound MAIN/.test(openMain), openMain);

      // --- FLEET_LANDS=0 -------------------------------------------------------------------
      await restartSrv({ FLEET_LANDS: "0" });
      const beforeLedger = ledgerLines();
      const lockedPoll = await pollLands();
      const lockedGate = await gateLands();
      check("FLEET_LANDS=0: the poll and the lane's gate both say this fleet does NOT land",
        lockedPoll === false && lockedGate === false, JSON.stringify({ poll: lockedPoll, gate: lockedGate }));
      const lockedOwner = await ownerDoor();
      check("FLEET_LANDS=0: the ⏫ owner merge door answers 409 with the canonical-main sentence",
        lockedOwner === `409 ${LOCK}`, lockedOwner);
      const lockedConfirm = await ownerDoor({ confirm: true });
      check("FLEET_LANDS=0: the ⏬ confirm-land door — the other way that route reaches main — answers the same",
        lockedConfirm === `409 ${LOCK}`, lockedConfirm);
      const lockedMain = await mainDoor();
      check("FLEET_LANDS=0: the Program-MAIN land door answers 409 with the same sentence, before the binding bracket",
        lockedMain === `409 ${LOCK}`, lockedMain);
      // …and the part that a 409 alone would not prove: nothing was written on the way out.
      const after = (await (await get(`/api/slots/${le.slot}/merge`)).json()) as
        { running?: boolean; last: unknown };
      check("FLEET_LANDS=0: three refused land attempts leave NO verdict and NO running job — GET still answers",
        after.running === false && after.last === null, JSON.stringify(after));
      check("FLEET_LANDS=0: …and no lane-outcome line was minted by the refusals",
        ledgerLines() === beforeLedger, `${beforeLedger} -> ${ledgerLines()}`);

      // --- FLEET_LANDS=1, and an unrecognised value ------------------------------------------
      await restartSrv({ FLEET_LANDS: "1" });
      const onPoll = await pollLands();
      const onOwner = await ownerDoor();
      check("FLEET_LANDS=1: the fleet lands again and the ⏫ door is back at its own dirty-tree refusal",
        onPoll === true && !onOwner.includes(LOCK) && /uncommitted changes/.test(onOwner),
        `${JSON.stringify({ poll: onPoll })} ${onOwner}`);
      await restartSrv({ FLEET_LANDS: "vielleicht" });
      const oddPoll = await pollLands();
      const oddOwner = await ownerDoor();
      check("an unrecognised FLEET_LANDS value leaves the instance LANDING (it says so in a log line, it does not strand the host)",
        oddPoll === true && !oddOwner.includes(LOCK), `${JSON.stringify({ poll: oddPoll })} ${oddOwner}`);
      await restartSrv(); // the flag is a per-restart `extra`, never in process.env — leave it gone
      await post(`/api/slots/${le.slot}/kill`, {});
    }
  }

  await setMergeMode("blocked"); // leave the shared mode file as the other modules expect it
  if (receiver) await post(`/api/slots/${receiver}/kill`, {});
}

// the marker map as it stands on disk. `saveState` writes through a promise chain, so a read
// taken the instant the server answers can beat the write it is checking — settle first.
async function readLandPending(): Promise<Record<string, unknown>> {
  await Bun.sleep(600);
  const st = (await Bun.file(`${ROOT}/fleet.json`).json()) as { landPending?: Record<string, unknown> };
  return st.landPending ?? {};
}

// Plant a land-in-flight marker into the QUIESCENT state file and boot onto it — a live server
// would overwrite it on its next saveState, and the whole point is a marker the previous process
// left behind. Mode is re-asserted explicitly: writeFileSync only applies `mode` when it creates
// the file, and the suite checks fleet.json is 600 later on.
async function plantMarker(m: { main: string; branch: string; mainBefore: string; laneTip: string }): Promise<void> {
  await tmuxOut("kill-session", "-t", "srv");
  await Bun.sleep(500);
  const path = `${ROOT}/fleet.json`;
  let st: Record<string, unknown> | null = null;
  let stateError = "";
  try { st = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>; }
  catch (e) { stateError = e instanceof Error ? e.message : String(e); }
  check("land marker setup precondition: fleet state is readable before mutation",
    st !== null, stateError);
  if (st) {
    st.landPending = { [REPO]: { repo: REPO, ...m, at: Date.now(), prov: { confirmedByHuman: false } } };
    writeFileSync(path, JSON.stringify(st, null, 2), { mode: 0o600 });
    chmodSync(path, 0o600);
  }
  await restartSrv();
}
