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
import {
  chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readlinkSync, realpathSync, rmSync,
  writeFileSync,
} from "node:fs";
import { BASE, REPO, ROOT, check, get, post, restartSrv, tmuxOut } from "./harness";
import { setMergeMode, settleForMerge, waitMerge } from "./lane-helpers";
import { resolveSourceTree } from "./trail-emit";

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

  // === F — the follower's BUNDLE: what a fast-forward invalidates, fleet-sync.sh rebuilds ======
  // §E's subject is the same rail from the other end. `public/*.js` is a gitignored BUILD artifact,
  // so `fleet-sync.sh` moving `main` moves `src/` and leaves the JS behind it untouched — or, on a
  // checkout that was cloned and never built, absent. Measured on the follower 2026-09-06 04:14:
  // `bundleStale {appJsMtime:null, shareJsMtime:null, helperJsMtime:null}` and no `public/*.js` at
  // all, i.e. a board served as HTML with no client. Four facts are proven below, against the REAL
  // script (not a copy of its logic) and a throwaway canonical/follower pair, with the build itself
  // replaced by a STAND-IN: `bun run build` here would prove the bundler works, which is not the
  // question. The question is WHEN the script reaches for it and what it does when it comes back red.
  {
    // WHERE THE REAL SCRIPT IS, in the order the two answers are actually reliable.
    //   1. ${ROOT}/fleet-sync.sh — the instance's own copy, staged by e2e-stage.sh's fixed asset
    //      list. True in a direct checkout too, where ROOT *is* the tree under test.
    //   2. the pointer home (node_modules symlink → source tree), the resolution e2e/trail-emit.ts
    //      uses. It is the FALLBACK now, not the primary, because it answers only when the source
    //      tree is a git work tree — and the post-land audit's source is a `git archive` extract
    //      with no `.git` (server.ts#snapshotIntegrationTree). Measured 2026-09-06 on a rebuilt
    //      audit path: `sourceTree=null`, so this probe failed in every full audit from b224ef8 on
    //      while passing in every lane. Kept as a fallback so an instance staged by something that
    //      predates the copy list still resolves instead of accusing the script.
    const sourceTree = ((): string | null => {
      let link: string | null = null;
      try { link = readlinkSync(`${ROOT}/node_modules`); } catch { /* direct checkout: ROOT answers */ }
      return resolveSourceTree(ROOT, link, (c) => g(c, "rev-parse", "--is-inside-work-tree").out === "true");
    })();
    const script = [`${ROOT}/fleet-sync.sh`, sourceTree === null ? null : `${sourceTree}/fleet-sync.sh`]
      .find((p): p is string => p !== null && existsSync(p)) ?? null;
    // the probe fails as ITSELF: "the script was not reachable from this instance" and "the script
    // misbehaved" are different answers, and the first one rendered as the second accuses the wrong
    // file. On the passing side it NAMES the path it took, so which of the two answers carried the
    // run is readable from the line rather than inferred from the fact that it passed.
    check("(setup F) PROBE: the tree under test resolves and carries fleet-sync.sh",
      script !== null, `script=${script} root=${ROOT} sourceTree=${sourceTree}`);
    if (script !== null) {
      const FIX = `${process.env.TMPDIR ?? "/tmp"}/fleet-e2e-sync-${process.pid}`;
      const can = `${FIX}/canonical`;
      const fol = `${FIX}/follower`;
      const MARK = `${FIX}/build-ran`;
      rmSync(FIX, { recursive: true, force: true });
      mkdirSync(can, { recursive: true });
      g(can, "init", "-q", "-b", "main");
      g(can, "config", "user.email", "e2e@fleet.local");
      g(can, "config", "user.name", "fleet e2e");
      g(can, "config", "commit.gpgsign", "false");
      // the same shape as the real repo: the bundle is IGNORED, which is why a fetch can never
      // carry it and why its absence is not a dirty tree.
      writeFileSync(`${can}/.gitignore`, "public/*.js\n");
      writeFileSync(`${can}/README`, "canonical\n");
      copyFileSync(script, `${can}/fleet-sync.sh`);
      chmodSync(`${can}/fleet-sync.sh`, 0o755);
      const seeded = commitAll(can, "seed");
      const cloned = spawnSync("git", ["clone", "-q", "--origin", "canonical", can, fol], { encoding: "utf8" });
      check("(setup F) a canonical repo and a follower clone that names it `canonical` exist",
        seeded.code === 0 && cloned.status === 0 && existsSync(`${fol}/fleet-sync.sh`),
        `seed=${seeded.code} clone=${cloned.status} ${(cloned.stderr ?? "").trim()}`);

      // The stand-in. It writes the three bundles server.ts calls the client and appends ONE line
      // to a marker OUTSIDE the repo — outside because a marker inside would be an untracked file,
      // and the script refuses a dirty tree before it does anything else.
      const BUILD_OK = `mkdir -p public && for f in app.js share.js helper.js; do echo "// stand-in $f" > public/$f; done && echo ran >> ${MARK}`;
      const builds = (): number => {
        try { return readFileSync(MARK, "utf8").split("\n").filter(Boolean).length; } catch { return 0; }
      };
      const bundlesHere = (): string[] =>
        ["app.js", "share.js", "helper.js"].filter((f) => existsSync(`${fol}/public/${f}`));
      const runSync = (buildCmd: string): { code: number; out: string } => {
        const r = spawnSync("sh", [`${fol}/fleet-sync.sh`],
          { cwd: fol, encoding: "utf8", env: { ...process.env, FLEET_SYNC_BUILD_CMD: buildCmd } });
        return { code: r.status ?? -1, out: `${(r.stdout ?? "").trim()} ${(r.stderr ?? "").trim()}`.trim() };
      };
      const moveCanonical = (name: string): string => {
        writeFileSync(`${can}/${name}`, `${name}\n`);
        commitAll(can, name);
        return g(can, "rev-parse", "HEAD").out;
      };

      // --- A: nothing to fetch, and still something to do. This is the state the follower was
      // actually found in: current with main, and no client at all.
      check("(setup F/A) the fresh clone is current with canonical and carries NO bundle",
        g(fol, "rev-parse", "HEAD").out === g(can, "rev-parse", "HEAD").out && bundlesHere().length === 0,
        `bundles=[${bundlesHere()}]`);
      const a = runSync(BUILD_OK);
      check("a follower that is CURRENT but has no client bundle builds one, and still exits 0",
        a.code === 0 && bundlesHere().length === 3 && builds() === 1,
        `exit=${a.code} bundles=[${bundlesHere()}] builds=${builds()} :: ${a.out}`);

      // --- D: …and having built it, it does NOT build again. The counter-proof to A: a script that
      // simply always builds would pass A and turn a 15-minute timer into a bundler loop.
      const beforeD = builds();
      const d = runSync(BUILD_OK);
      check("a follower that is current WITH its bundle runs no build at all",
        d.code === 0 && builds() === beforeD && /already current/.test(d.out) && !/build/.test(d.out),
        `exit=${d.code} builds=${beforeD}->${builds()} :: ${d.out}`);

      // --- B: the fast-forward case. main moved, so `src/` moved, so the bundle is stale even
      // though all three files are sitting right there — presence is not currency.
      const headB = moveCanonical("moved-b.txt");
      const beforeB = builds();
      const b = runSync(BUILD_OK);
      check("a fast-forward is followed by a build even when all three bundles already exist",
        b.code === 0 && g(fol, "rev-parse", "HEAD").out === headB && builds() === beforeB + 1,
        `exit=${b.code} head=${g(fol, "rev-parse", "HEAD").out.slice(0, 8)} want=${headB.slice(0, 8)} builds=${beforeB}->${builds()} :: ${b.out}`);

      // --- C: the build comes back RED. The sync has already happened by then and it STANDS —
      // which is the whole reason this is exit 5 and not 4: 4 means nothing moved.
      const headC = moveCanonical("moved-c.txt");
      const c = runSync("exit 1");
      check("a red build is exit 5 — a code of its own — and the fast-forward it followed still stands",
        c.code === 5 && g(fol, "rev-parse", "HEAD").out === headC,
        `exit=${c.code} head=${g(fol, "rev-parse", "HEAD").out.slice(0, 8)} want=${headC.slice(0, 8)} :: ${c.out}`);
      check("…and the failure line says BOTH halves: the sync landed, the bundle did not",
        /BUILD FAILED/.test(c.out) && c.out.includes(headC.slice(0, 7)),
        c.out);

      rmSync(FIX, { recursive: true, force: true });
    }
  }

  // === G — THE HUB PUSH: a land that stopped at this machine's main is not integrated (W5b) ====
  // Dual-host topology §6: two hosts land into one history and a bare repo on the second-host is the
  // nabe. The push after each land was a HAND step of the controller's, and the failure mode of a
  // hand step is that the land nobody watched never leaves the machine — after which the other
  // host rebases onto a main that is missing commits. Three facts, against a REAL bare repo:
  // the push happens and is recorded; a hub that has moved on is a NOTE FIELD and not a failed
  // land; and with no FLEET_HUB_REMOTE nothing is pushed and nothing is claimed.
  {
    const repo = `${REPO}.hubpush`;
    const hub = `${REPO}.hubpush.git`;
    const other = `${REPO}.hubpush.other`;
    for (const d of [repo, hub, other]) rmSync(d, { recursive: true, force: true });
    const seed = ((): number => {
      if (spawnSync("git", ["init", "-q", "-b", "main", repo]).status !== 0) return 1;
      for (const kv of [["user.email", "e2e@fleet.local"], ["user.name", "fleet e2e"], ["commit.gpgsign", "false"]])
        g(repo, "config", kv[0] as string, kv[1] as string);
      writeFileSync(`${repo}/base.txt`, "base\n");
      if (commitAll(repo, "base").code !== 0) return 2;
      // the hub is a BARE repo, the same shape as ~/git/claude-fleet.git on the second-host: nothing
      // is checked out there, so a push can never be refused for a dirty tree and the ref update
      // is the whole transaction.
      if (spawnSync("git", ["init", "-q", "--bare", "-b", "main", hub]).status !== 0) return 3;
      return g(repo, "remote", "add", "hub", hub).code === 0 ? 0 : 4;
    })();
    check("(setup G) a repo with a remote named `hub` and a bare hub to push into both exist",
      seed === 0 && existsSync(`${hub}/HEAD`), `step=${seed} remotes=${g(repo, "remote").out}`);

    // one land in this repo, start to finish, plus the note that came out of it. Returns the note
    // PARSED — an unparseable note is a different fact from an absent field and each check below
    // says which one it is looking at.
    const landOnce = async (file: string): Promise<{ before: string; after: string;
      note: Record<string, unknown> | null; noteRaw: string }> => {
      const before = g(repo, "rev-parse", "main").out;
      const lane = (await (await post("/api/lanes", { repo })).json()) as
        { slot?: number; cwd?: string; branch?: string };
      if (!lane.slot || !lane.cwd) return { before, after: before, note: null, noteRaw: "no lane" };
      writeFileSync(`${lane.cwd}/${file}`, `${file}\n`);
      commitAll(lane.cwd, file);
      await settleForMerge(lane.slot);
      await post(`/api/slots/${lane.slot}/merge`, {});
      await waitMerge(lane.slot);
      const after = g(repo, "rev-parse", "main").out;
      const raw = g(repo, "notes", "--ref=fleet/land", "show", after);
      let note: Record<string, unknown> | null = null;
      try { note = JSON.parse(raw.out) as Record<string, unknown>; } catch { /* reported as noteRaw */ }
      return { before, after, note, noteRaw: `${raw.code} ${raw.out.slice(0, 200)}${raw.err.slice(0, 120)}` };
    };
    const hubPushOf = (n: Record<string, unknown> | null): Record<string, unknown> | undefined =>
      (n?.hubPush ?? undefined) as Record<string, unknown> | undefined;
    const verifyOkOf = (n: Record<string, unknown> | null): unknown =>
      (n?.verify as { ok?: unknown } | undefined)?.ok;

    await setMergeMode("blocked"); // the clean auto-land path — no agent, no conflict
    await restartSrv({ FLEET_HUB_REMOTE: "hub" });

    // --- G1: the push happens, and the note is where it is recorded ------------------------
    const one = await landOnce("hub-one.txt");
    check("(setup G1) the first land moved this machine's main", one.after !== one.before && !!one.after,
      `${one.before.slice(0, 8)} -> ${one.after.slice(0, 8)}`);
    const hubMain = (): string => g(hub, "rev-parse", "main").out;
    const trackingMain = (): string => g(repo, "rev-parse", "hub/main").out;
    check("FLEET_HUB_REMOTE: a land fast-forwards the hub to the landed commit and says so on the land note",
      hubMain() === one.after && trackingMain() === one.after
        && hubPushOf(one.note)?.ok === true && hubPushOf(one.note)?.remote === "hub"
        && hubPushOf(one.note)?.sha === one.after,
      `main=${one.after.slice(0, 8)} hub=${hubMain().slice(0, 8)} tracking=${trackingMain().slice(0, 8)} note=${JSON.stringify(hubPushOf(one.note))} raw=${one.noteRaw}`);

    // --- G2: the hub has moved on. The land STANDS; the push is a red field, not a red land ---
    const cloned = spawnSync("git", ["clone", "-q", hub, other], { encoding: "utf8" });
    for (const kv of [["user.email", "e2e@fleet.local"], ["user.name", "fleet e2e"], ["commit.gpgsign", "false"]])
      g(other, "config", kv[0] as string, kv[1] as string);
    writeFileSync(`${other}/foreign.txt`, "landed on the OTHER host\n");
    const foreignCommit = commitAll(other, "foreign work");
    const foreignPush = g(other, "push", "-q", "origin", "main");
    const diverged = hubMain();
    check("(setup G2) another host's commit is on the hub, so this machine's next land is no longer a fast-forward",
      cloned.status === 0 && foreignCommit.code === 0 && foreignPush.code === 0
        && diverged !== one.after,
      `clone=${cloned.status} commit=${foreignCommit.code} push=${foreignPush.code} hub=${diverged.slice(0, 8)} was=${one.after.slice(0, 8)}`);
    const two = await landOnce("hub-two.txt");
    const p2 = hubPushOf(two.note);
    check("a hub that has moved on is a red hubPush field with git's own reason — the land itself still stands",
      two.after !== one.after && g(repo, "merge-base", "--is-ancestor", one.after, two.after).code === 0
        && p2?.ok === false && p2?.remote === "hub"
        && typeof p2?.reason === "string" && /rejected|fetch first|non-fast-forward/i.test(p2.reason as string)
        && (p2.reason as string).length <= 500
        && verifyOkOf(two.note) === true && hubMain() === diverged,
      `main=${two.after.slice(0, 8)} hub=${hubMain().slice(0, 8)} verify.ok=${String(verifyOkOf(two.note))} note=${JSON.stringify(p2)} raw=${two.noteRaw}`);

    // --- G3: no FLEET_HUB_REMOTE, no push and no claim about one -----------------------------
    // The remote is STILL in .git/config, so what is switched off here is the fleet's behaviour and
    // not the fixture: absence of the variable is the off switch, and a note with no hubPush key is
    // the only honest thing to write when nothing was attempted.
    await restartSrv();
    const before3 = hubMain();
    const three = await landOnce("hub-three.txt");
    check("with no FLEET_HUB_REMOTE the land carries NO hubPush field, and the hub is not touched",
      three.after !== two.after && three.note !== null && !("hubPush" in (three.note ?? {}))
        && hubMain() === before3 && g(repo, "remote").out.split("\n").includes("hub"),
      `keys=${Object.keys(three.note ?? {}).join(",")} hub=${hubMain().slice(0, 8)} was=${before3.slice(0, 8)} raw=${three.noteRaw}`);
  }

  // === H — THE NOTE LIFECYCLE AT THE LAND SITE (N2) =====================================
  // docs/notizen-verarbeitung-2026-09-06.md §3 N2. Three facts only a real land can establish, so
  // they live here rather than beside the pure join in e2e/tasks.ts:
  //   · a land STAMPS the pending notes whose surface it actually moved — and only those
  //   · a land CLOSES the notes this branch reported `erledigt` on. The verdict alone never does.
  //   · a KILLED lane closes nothing. The verdict stays readable and the note stays pending, which
  //     is what keeps the claim falsifiable instead of authoritative.
  // `code.txt` is the moved file, `ctx-mod.txt` the untouched control, `AGENTS.md` the HUB control:
  // the land moves it too, and a note standing only on it must still come back unstamped.
  {
    await setMergeMode("blocked"); // the clean auto-land path — no agent, no conflict
    type NRow = { id: string; kind: string; status: string; note?: string | null; files?: string[];
      touched?: { sha: string; branch: string; at: number }[];
      comments?: { text: string; from?: string; verdict?: string }[] };
    const nRows = async (): Promise<NRow[]> =>
      ((await (await get("/api/tasks")).json()) as { tasks: NRow[] }).tasks;
    const nRow = async (id: string): Promise<NRow | undefined> => (await nRows()).find((t) => t.id === id);
    const mkRow = async (text: string, kind: "auftrag" | "notiz"): Promise<string> =>
      ((await (await post("/api/tasks", { text, kind, queue: false, repo: REPO })).json()) as
        { task: { id: string } }).task.id;

    const nTouch = await mkRow("Notiz: code.txt traegt den Zustand doppelt. Zweiter Satz.", "notiz");
    const nOther = await mkRow("Notiz: ctx-mod.txt ist unberuehrt. Zweiter Satz.", "notiz");
    const nHubOnly = await mkRow("Notiz: AGENTS.md allein ist eine Nabe. Zweiter Satz.", "notiz");
    // A PRECONDITION, not a check of the feature: without a derived surface the whole section would
    // pass by measuring nothing — every note would simply fail to intersect anything.
    check("(setup H) the queue derived a surface for each of the three fixture notes",
      (await nRow(nTouch))?.files?.join(",") === "code.txt"
      && (await nRow(nOther))?.files?.join(",") === "ctx-mod.txt"
      && (await nRow(nHubOnly))?.files?.join(",") === "AGENTS.md",
      JSON.stringify([(await nRow(nTouch))?.files, (await nRow(nOther))?.files, (await nRow(nHubOnly))?.files]));

    // --- (n2-touched) ONE LAND THAT MOVES code.txt AND AGENTS.md -------------------------
    const hLane = await openLane();
    check("(setup H) a lane for the touched-stamp case opened", !!hLane, JSON.stringify(hLane));
    let mainAfter1 = "";
    if (hLane) {
      await Bun.write(`${hLane.cwd}/code.txt`, "root\nH-touched\n");
      await Bun.write(`${hLane.cwd}/AGENTS.md`, "# Throwaway repository contract\nH-touched\n");
      check("(setup H) the touched-stamp lane committed its two files",
        commitAll(hLane.cwd, "H: move code.txt and AGENTS.md").code === 0);
      await settleForMerge(hLane.slot);
      await post(`/api/slots/${hLane.slot}/merge`, {});
      await waitMerge(hLane.slot);
      mainAfter1 = g(REPO, "rev-parse", MAIN).out;
    }
    const tTouched = await nRow(nTouch);
    // Mutation that breaks it: dropping the surface intersection (nOther would be stamped), keeping
    // the hub files in it (nHubOnly would be stamped), or writing `mainBefore` as the sha.
    check("(n2-touched) a land stamps the pending note whose NON-HUB surface it moved — and only that one",
      !!mainAfter1 && tTouched?.touched?.length === 1
      && tTouched.touched[0].sha === mainAfter1
      && tTouched.touched[0].branch === hLane?.branch
      && (await nRow(nOther))?.touched === undefined
      && (await nRow(nHubOnly))?.touched === undefined,
      `${JSON.stringify(tTouched?.touched)} want=${mainAfter1.slice(0, 8)}/${hLane?.branch}`
      + ` other=${JSON.stringify((await nRow(nOther))?.touched)} hub=${JSON.stringify((await nRow(nHubOnly))?.touched)}`);

    // A SECOND land on the same file: newest FIRST is what the board line reads ("zuletzt <sha7>"),
    // so an append-at-the-end writer would put the oldest land in the row's own summary.
    const hLane2 = await openLane();
    let mainAfter2 = "";
    if (hLane2) {
      await Bun.write(`${hLane2.cwd}/code.txt`, "root\nH-touched\nH-touched-2\n");
      check("(setup H) the second touched-stamp lane committed",
        commitAll(hLane2.cwd, "H: move code.txt again").code === 0);
      await settleForMerge(hLane2.slot);
      await post(`/api/slots/${hLane2.slot}/merge`, {});
      await waitMerge(hLane2.slot);
      mainAfter2 = g(REPO, "rev-parse", MAIN).out;
    }
    const tTouched2 = await nRow(nTouch);
    check("(n2-touched-order) a second land is prepended — newest first, and the older entry survives",
      !!mainAfter2 && mainAfter2 !== mainAfter1 && tTouched2?.touched?.length === 2
      && tTouched2.touched[0].sha === mainAfter2 && tTouched2.touched[1].sha === mainAfter1,
      `${JSON.stringify(tTouched2?.touched?.map((x) => x.sha.slice(0, 8)))} want=[${mainAfter2.slice(0, 8)},${mainAfter1.slice(0, 8)}]`);

    // --- (n2-closed) THE VERDICT BECOMES WIRKSAM AT THE LAND ------------------------------
    // A DISPATCHED lane, because the verdict door's permission boundary is the context receipt —
    // a hand-opened worktree has none and could not post a verdict at all.
    const nDone = await mkRow("Notiz: code.txt haelt einen erledigten Zustand. Zweiter Satz.", "notiz");
    const aDone = await mkRow("Auftrag: code.txt anfassen.", "auftrag");
    const dRes = await post(`/api/tasks/${aDone}/dispatch`, {});
    const dSlot = ((await dRes.json()) as { slot?: number }).slot ?? null;
    let dCwd = ""; let dBranch = ""; let dTok = "";
    if (dSlot !== null) {
      for (let i = 0; i < 60; i++) {
        const sl = ((await (await get("/api/sessions")).json()) as
          { slots: { id: number; cwd: string | null; worktree?: { branch: string } | null }[] })
          .slots.find((x) => x.id === dSlot);
        dCwd = sl?.cwd ?? ""; dBranch = sl?.worktree?.branch ?? "";
        dTok = await selfTokenOf(dSlot);
        if (dCwd && dBranch && dTok) break;
        await Bun.sleep(100);
      }
    }
    const dNotes = dTok
      ? (await (await fetch(`${BASE}/api/self/notes`, { headers: { "x-fleet-self-token": dTok } })).json()) as
        { notes?: { id: string }[]; receipts?: number }
      : { notes: [], receipts: 0 };
    check("(setup H) the dispatched lane's own receipt delivered the note it is about to judge",
      !!dTok && !!dBranch && (dNotes.notes ?? []).some((x) => x.id === nDone) && (dNotes.receipts ?? 0) >= 1,
      `slot=${dSlot} branch=${dBranch} notes=${JSON.stringify((dNotes.notes ?? []).map((x) => x.id))} receipts=${dNotes.receipts}`);
    const dVerdict = dTok
      ? await fetch(`${BASE}/api/self/notes/${nDone}/verdict`, { method: "POST",
        headers: { "content-type": "application/json", "x-fleet-self-token": dTok },
        body: JSON.stringify({ verdict: "erledigt", text: "H: mit diesem Land erledigt." }) })
      : null;
    // The verdict on its own must leave the row exactly where it was — otherwise the land below
    // would prove nothing, because the status would already have moved.
    check("(n2-verdict-inert) the verdict is accepted and the note is STILL pending before the land",
      dVerdict?.status === 200 && (await nRow(nDone))?.status === "pending",
      `${dVerdict?.status} ${(await nRow(nDone))?.status}`);
    let mainAfter3 = "";
    if (dSlot !== null && dCwd) {
      await Bun.write(`${dCwd}/code.txt`, "root\nH-touched\nH-touched-2\nH-done\n");
      check("(setup H) the judging lane committed its work",
        commitAll(dCwd, "H: the work carrying the erledigt verdict").code === 0);
      await settleForMerge(dSlot);
      await post(`/api/slots/${dSlot}/merge`, {});
      await waitMerge(dSlot);
      mainAfter3 = g(REPO, "rev-parse", MAIN).out;
    }
    const rDone = await nRow(nDone);
    // Mutation that breaks it: closing on ANY erledigt rather than one from THIS branch, closing in
    // the verdict route instead of at the land, or writing the branch's tip instead of main's.
    check("(n2-closed) the land of the branch that reported `erledigt` closes the note, naming its own land sha",
      !!mainAfter3 && rDone?.status === "done"
      && rDone.note === `erledigt durch Land ${mainAfter3.slice(0, 7)} (${dBranch})`,
      `${rDone?.status} ${JSON.stringify(rDone?.note)} want sha=${mainAfter3.slice(0, 7)} branch=${dBranch}`);

    // --- (n2-killed) A LANE THAT DIES CLOSES NOTHING --------------------------------------
    const nKill = await mkRow("Notiz: code.txt bleibt offen, wenn die Lane stirbt. Zweiter Satz.", "notiz");
    const aKill = await mkRow("Auftrag: code.txt erneut anfassen.", "auftrag");
    const kRes = await post(`/api/tasks/${aKill}/dispatch`, {});
    const kSlot = ((await kRes.json()) as { slot?: number }).slot ?? null;
    let kCwd = ""; let kBranch = ""; let kTok = "";
    if (kSlot !== null) {
      for (let i = 0; i < 60; i++) {
        const sl = ((await (await get("/api/sessions")).json()) as
          { slots: { id: number; cwd: string | null; worktree?: { branch: string } | null }[] })
          .slots.find((x) => x.id === kSlot);
        kCwd = sl?.cwd ?? ""; kBranch = sl?.worktree?.branch ?? "";
        kTok = await selfTokenOf(kSlot);
        if (kCwd && kBranch && kTok) break;
        await Bun.sleep(100);
      }
    }
    const kVerdict = kTok
      ? await fetch(`${BASE}/api/self/notes/${nKill}/verdict`, { method: "POST",
        headers: { "content-type": "application/json", "x-fleet-self-token": kTok },
        body: JSON.stringify({ verdict: "erledigt", text: "H: behauptet erledigt, landet aber nie." }) })
      : null;
    check("(setup H) the lane that will be killed did post an `erledigt` verdict",
      kVerdict?.status === 200, `${kVerdict?.status} slot=${kSlot} tok=${!!kTok}`);
    if (kSlot !== null) {
      await post(`/api/slots/${kSlot}/kill`, {});
      if (kCwd) spawnSync("git", ["-C", REPO, "worktree", "remove", "--force", kCwd]);
    }
    const rKill = await nRow(nKill);
    // Mutation that breaks it: moving applyLandToNotes into killSlot or the teardown path, where it
    // would close on the claim alone — the exact shape this whole design exists to refuse.
    check("(n2-killed) a killed lane closes nothing — the note stays pending and the claim stays readable",
      rKill?.status === "pending"
      && (rKill.comments ?? []).some((c) => c.verdict === "erledigt" && c.from === kBranch),
      `${rKill?.status} ${JSON.stringify(rKill?.comments ?? [])}`);

    for (const id of [nTouch, nOther, nHubOnly, nDone, aDone, nKill, aKill])
      await post(`/api/tasks/${id}/delete`, {});
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
