// Lane lifecycle: risk vs the configured integration branch, shelve → resume, the lane-scoped
// brief, the 💾 commit endpoint (lane vs main-session staging, detached HEAD, wedged rebase), and
// the CLONE lane form — same lifecycle, a working copy that is its own repository.
import { spawnSync } from "node:child_process";
import { lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { laneDoneLooking, laneHostCommitLooking, type LaneSignalView } from "../lane-signals";
import { BASE, PORT, REPO, ROOT, SOCK, TOKEN, UntilTimeout, check, get, lastReviewPromptFor, plogRead, post, restartSrv,
  reviewRunsFor, stopSrv, tmuxOut, until } from "./harness";
import type { LaneCtx } from "./ctx";
import { exists, setMergeMode, settleForMerge, waitMerge } from "./lane-helpers";

export async function run(lc: LaneCtx): Promise<void> {
  // --- the second completion FACT is served beside doneLooking, with the same lane-only scope.
  // The isolated server keeps foreign-harness automation OFF, so its policy-reduced `alive` fact
  // cannot honestly manufacture the positive Pi case here; prompts.ts owns that positive matrix.
  // This integration half proves the served field is present and remains false for the identical
  // dirty+zero-ahead shape on Claude — paired with positive git/adapter reads, never a null reader.
  {
    const hostShape: LaneSignalView = { alive: true, idleMs: 5000, git: { dirty: 1, ahead: 0 },
      gitOp: false, merge: null, observed: true, awaiting: null, hostCommits: true };
    check("hostCommitLooking accepts fenced dirty+zero-ahead work, but not identical Claude dirt or awaiting-owner",
      laneHostCommitLooking(hostShape, 1500) === true
      && laneHostCommitLooking({ ...hostShape, hostCommits: false }, 1500) === false
      && laneHostCommitLooking({ ...hostShape, awaiting: "owner" }, 1500) === false);
    check("hostCommitLooking and doneLooking are disjoint on both completion shapes",
      laneDoneLooking(hostShape, 1500) === false
      && laneHostCommitLooking({ ...hostShape, git: { dirty: 0, ahead: 1 } }, 1500) === false
      && laneDoneLooking({ ...hostShape, git: { dirty: 0, ahead: 1 } }, 1500) === true);

    type SignalSlot = { id: number; git: { dirty: number; ahead: number } | null;
      hostCommits: boolean; hostCommitLooking: boolean; doneLooking: boolean };
    const svTok = ((await (await get("/api/steward/token")).json()) as { token: string }).token;
    const signal = async (slot: number): Promise<SignalSlot | undefined> =>
      ((await (await fetch(BASE + "/api/steward/sessions",
        { headers: { authorization: `Bearer ${svTok}` } })).json()) as { slots: SignalSlot[] })
        .slots.find((s) => s.id === slot);

    const clRes = await post("/api/lanes", { repo: REPO });
    const cl = (await clRes.json()) as { ok?: boolean; slot?: number; cwd?: string; error?: string };
    check("host-commit fact probe setup: a Claude lane was created",
      clRes.ok && cl.ok === true && typeof cl.slot === "number" && typeof cl.cwd === "string",
      `${clRes.status} ${JSON.stringify(cl)}`);
    if (clRes.ok && cl.ok && cl.slot && cl.cwd) {
      await Bun.write(`${cl.cwd}/host-commit-fact.txt`, "dirty tree on self-committing harness\n");
      let clV: SignalSlot | undefined;
      for (let i = 0; i < 60; i++) {
        clV = await signal(cl.slot);
        if (clV?.git?.dirty === 1 && clV.git.ahead === 0 && clV.hostCommits === false) break;
        await Bun.sleep(500);
      }
      const readerReady = clV?.git?.dirty === 1 && clV.git.ahead === 0 && clV.hostCommits === false;
      check("host-commit fact probe prerequisite: steward reads the dirty+zero-ahead tree and adapter fact",
        readerReady, JSON.stringify(clV));
      if (readerReady) {
        check("hostCommitLooking is served false for Claude dirt (that state stays stalled-dirty)",
          clV?.hostCommitLooking === false && clV.doneLooking === false, JSON.stringify(clV));
      }
      // --- the workbench's lane ↔ task join (src/client.ts qLaneJoins) over this same lane, from the
      // OWNER poll it actually reads. Two facts, both about a lane no task row ever named: it hangs
      // on no row however same-repo it is (the join is the dispatcher's pointer, never a repo
      // guess), and its state line carries the dirty count the steward view just confirmed, with
      // running/idle said only where output was observed and UNKNOWN where it was not.
      {
        type PollSlot = { id: number; cwd: string | null; openedAt?: number; lastOutput: number;
          git?: { dirty: number; ahead: number } | null; worktree?: { repo: string; branch: string } | null };
        type PollTask = { id: string; status: string; created: number; slot?: number; repo?: string };
        type Join = { kind: "lane"; lane: { slot: number; state: string; dirty: number | null; quietMs: number | null } }
          | { kind: "none" } | { kind: "refused"; slot: number; why: string };
        type JoinFns = { qLaneJoins: (t: PollTask[], s: PollSlot[], repo: string, now: number) => Map<string, Join>;
          qLaneState: (s: PollSlot, now: number) => { state: string; dirty: number | null; quietMs: number | null } };
        let joinFns: JoinFns | null = null;
        let joinErr = "";
        try {
          const src = readFileSync(`${resolve(realpathSync(`${ROOT}/node_modules`), "..")}/src/client.ts`, "utf8");
          const a = src.indexOf("type QGroup =");
          const b = src.indexOf("function qWaveProjection", a);
          joinFns = new Function(new Bun.Transpiler({ loader: "ts" }).transformSync(src.slice(a, b))
            + "\nreturn { qLaneJoins, qLaneState };")() as JoinFns;
        } catch (e) { joinErr = e instanceof Error ? e.message : String(e); }
        check("lane join precondition: the workbench join block is cut out of the real client source",
          joinFns !== null && typeof joinFns.qLaneJoins === "function", joinErr);
        const live = (await (await get("/api/sessions")).json()) as
          { now: number; dispatch: { repo: string }; slots: PollSlot[]; tasks: PollTask[] };
        const mine = live.slots.find((x) => x.id === cl.slot);
        const joins = joinFns?.qLaneJoins(live.tasks, live.slots, live.dispatch.repo, live.now) ?? new Map<string, Join>();
        const hung = [...joins.values()].filter((x) => x.kind === "lane" && x.lane.slot === cl.slot);
        check("lane join: a hand-opened lane with no task pointer hangs on no task row, same repo or not",
          !!joinFns && !!mine?.worktree && hung.length === 0,
          JSON.stringify({ slot: cl.slot, worktree: mine?.worktree ?? null, hung, rows: live.tasks.length }));
        const st = mine && joinFns ? joinFns.qLaneState(mine, live.now) : null;
        const observed = (mine?.lastOutput ?? 0) > 0;
        check("lane join: the state line carries the dirty count the poll serves, and says running/idle only for an observed pane",
          !!st && st.dirty === 1
            && (observed ? (st.state === "running" || st.state === "idle") && st.quietMs !== null
              : st.state === "unknown" && st.quietMs === null),
          JSON.stringify({ st, observed, lastOutput: mine?.lastOutput, git: mine?.git ?? null }));
      }
    }
    if (cl.slot) await post(`/api/slots/${cl.slot}/kill`, {});
    if (cl.cwd) spawnSync("git", ["worktree", "remove", "--force", cl.cwd], { cwd: REPO });
  }

  // --- OWNER.md rides into a lane like CLAUDE.md does. It is the owner model the steward ritual
  // names as a load duty, and until this landed neither a lane nor the steward worktree ever saw
  // it. Two halves, and the second is the one that could break the fleet: its ABSENCE in the
  // primary must not break a spawn (the copy loop skips a missing file), so the no-file case is
  // asserted FIRST, on a tree where the file genuinely does not exist yet. ---
  {
    const ownerSrc = `${REPO}/OWNER.md`;
    rmSync(ownerSrc, { force: true }); // start from provable absence
    const noFile = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; error?: string };
    check("a lane still spawns when the primary has no OWNER.md", typeof noFile.slot === "number" && exists(noFile.cwd),
      JSON.stringify(noFile));
    check("…and no OWNER.md is invented in the lane", !exists(`${noFile.cwd}/OWNER.md`));
    await post(`/api/slots/${noFile.slot}/kill`, {});
    spawnSync("git", ["worktree", "remove", "--force", noFile.cwd], { cwd: REPO });

    writeFileSync(ownerSrc, "# the owner model\nnever push from this machine\n", { mode: 0o644 });
    const withFile = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
    const copied = `${withFile.cwd}/OWNER.md`;
    check("OWNER.md arrives in a freshly spawned lane",
      exists(copied) && readFileSync(copied, "utf8").includes("never push from this machine"), copied);
    // same 0600 floor as .env/CLAUDE.md: the source is 0644 here on purpose, so a mode-preserving
    // copy would fail this — the floor is asserted, not the source's accident.
    const mode = ((): number => { try { return statSync(copied).mode & 0o777; } catch { return -1; } })();
    check("the copied OWNER.md is owner-only (0600)", mode === 0o600, mode === -1 ? "missing" : mode.toString(8));
    // and it must not dirty the lane — a copied UNIGNORED file shows as untracked and blocks land
    const lDiff = (await (await get(`/api/slots/${withFile.slot}/diff`)).json()) as { status: string[] };
    check("the OWNER.md copy leaves the lane clean (gitignored, so land stays possible)",
      lDiff.status.length === 0, JSON.stringify(lDiff.status));
    await post(`/api/slots/${withFile.slot}/kill`, {});
    spawnSync("git", ["worktree", "remove", "--force", withFile.cwd], { cwd: REPO });
    rmSync(ownerSrc, { force: true });
  }

  // --- issue 2: risk/merged checks measure against the integration branch, not the primary's
  // HEAD. A lane merged into a CONFIGURED integration branch (distinct from main) must read as
  // safe-to-remove — otherwise landLane's own removeWorktreeSafe would wedge after a
  // ref-advance land (lane merged into main, but primary HEAD parked elsewhere). ---
  {
    const l2 = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${l2.cwd}/issue2.txt`, "work\n");
    spawnSync("git", ["-C", l2.cwd, "add", "issue2.txt"]);
    spawnSync("git", ["-C", l2.cwd, "commit", "-qm", "issue2 lane work"]);
    // an integration branch that already CONTAINS the lane (points at its tip), unlike main
    spawnSync("git", ["-C", REPO, "branch", "intb", l2.branch]);
    // baseline (unconfigured → integration branch = main): the lane's commit is unmerged
    const riskBefore = (await (await get(`/api/slots/${l2.slot}/risk`)).json()) as { unpushedCommits: unknown[]; empty: boolean };
    check("issue2: lane reads as unpushed vs main before config", riskBefore.unpushedCommits.length === 1 && riskBefore.empty === false,
      JSON.stringify(riskBefore));
    // configure integration branch = intb (which contains the lane) → lane now reads merged/safe
    await post("/api/repo-base", { repo: REPO, branch: "intb" });
    const riskAfter = (await (await get(`/api/slots/${l2.slot}/risk`)).json()) as { unpushedCommits: unknown[]; empty: boolean };
    check("issue2: lane merged into the configured integration branch reads as safe (no unpushed)",
      riskAfter.unpushedCommits.length === 0 && riskAfter.empty === true, JSON.stringify(riskAfter));
    await post("/api/repo-base", { repo: REPO, branch: "" }); // clear config
    spawnSync("git", ["-C", REPO, "branch", "-D", "intb"]);
    await post(`/api/slots/${l2.slot}/kill`, {});
  }

  // --- shelve → resume round-trip: a lane set aside with a note keeps its worktree AND its
  // uncommitted work; the worktrees map surfaces the note on the now-orphan lane; reopening
  // (attach) re-seats it in a slot and clears the note. (A bare kill leaves a note-less orphan.) ---
  {
    const sh = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${sh.cwd}/shelve-work.txt`, "half done\n"); // uncommitted work that must NOT be lost
    const shRes = await post(`/api/slots/${sh.slot}/shelve`, { note: "finish the parser, then add a test" });
    check("shelve returns ok", shRes.ok, await shRes.text());
    check("shelved slot is now inactive (killed)",
      ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
        .slots.find((x) => x.id === sh.slot)?.cwd === null);
    check("shelved worktree kept on disk (not destroyed)", exists(sh.cwd));
    check("uncommitted work survives the shelve", exists(`${sh.cwd}/shelve-work.txt`));
    // the board route is a DISPLAY cache (server.ts, THE SWITCH CONTRACT): an entry older than
    // GIT_TICK_MS is served as-is while it recomputes, so a lane opened seconds ago may not be in the
    // list yet — a fast module-only run read it on the stale answer and failed at HEAD 8498717c too.
    // The row is awaited; its FIELDS are then asserted on the answer that carries it.
    type ShRow = { path: string; slot: number | null; note: string | null };
    let orphan: ShRow | undefined;
    try {
      orphan = await until(async () => ((await (await get(`/api/slots/${lc.lnSlot}/worktrees`)).json()) as
        { worktrees: ShRow[] }).worktrees.find((w) => w.path === sh.cwd), { timeoutMs: 10_000, what: "the shelved lane on the board" });
    } catch (e) { if (!(e instanceof UntilTimeout)) throw e; }
    check("shelved lane is an orphan (no holding slot)", orphan != null && orphan.slot === null, JSON.stringify(orphan));
    check("shelve note surfaced on the orphan", orphan?.note === "finish the parser, then add a test", JSON.stringify(orphan));
    const reopen = (await (await post("/api/lanes", { repo: REPO, attach: sh.cwd })).json()) as { ok?: boolean; slot?: number; error?: string };
    check("resume (attach) re-seats the shelved lane in a slot", reopen.ok === true && typeof reopen.slot === "number", JSON.stringify(reopen));
    const wmap2 = (await (await get(`/api/slots/${lc.lnSlot}/worktrees`)).json()) as { worktrees: { path: string; note: string | null }[] };
    check("resuming clears the shelve note", wmap2.worktrees.find((w) => w.path === sh.cwd)?.note == null,
      JSON.stringify(wmap2.worktrees.find((w) => w.path === sh.cwd)));
    check("shelve rejects a non-worktree slot", (await post("/api/slots/2/shelve", { note: "x" })).status === 400);
    await post(`/api/slots/${reopen.slot ?? 0}/kill`, {}); // free the slot for later tests
  }

  // --- THE CLICKED PLACE and the repo card (Gruendungsfenster B3): attach takes the slot the owner
  // clicked — exactly that one, or a 409 naming who sits there — and dirinfo carries the repo's
  // orphans (worktrees no slot holds) and its declared pack ids at HEAD. Attach WITHOUT `slot` is
  // the shelve → resume round-trip above, unchanged. ---
  {
    type Sl = { id: number; cwd: string | null; label: string | null };
    const slotsNow = async (): Promise<Sl[]> => ((await (await get("/api/sessions")).json()) as { slots: Sl[] }).slots;
    type Info = { git?: boolean; packs?: string[] | { error: string }; orphans?: { path: string; branch: string }[] };
    const info = async (p: string): Promise<Info> =>
      (await (await get(`/api/dirinfo?path=${encodeURIComponent(p)}`)).json()) as Info;
    const isOrphan = (i: Info, p: string): boolean | undefined => i.orphans?.some((o) => o.path === p);

    const ob = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    check("clicked-place probe setup: a lane opened", typeof ob.slot === "number" && exists(ob.cwd), JSON.stringify(ob));
    await post(`/api/slots/${ob.slot}/kill`, {});
    const listed = spawnSync("git", ["-C", REPO, "worktree", "list", "--porcelain"], { encoding: "utf8" }).stdout
      .split("\n").filter((l) => l.startsWith("worktree ")).map((l) => l.slice(9));
    check("clicked-place probe setup: git lists the primary, the held lane and the killed lane as worktrees",
      listed.length >= 3 && listed.includes(lc.lnPath) && listed.includes(ob.cwd), JSON.stringify(listed));
    const before = await info(REPO);
    check("dirinfo lists a killed lane's worktree as an orphan, with its branch",
      before.orphans?.some((o) => o.path === ob.cwd && o.branch === ob.branch) === true, JSON.stringify(before.orphans));
    check("…and neither a worktree a slot holds nor the primary checkout",
      isOrphan(before, lc.lnPath) === false && isOrphan(before, listed[0]) === false, JSON.stringify(before.orphans));

    const held = (await slotsNow()).find((x) => x.id === lc.lnSlot);
    const heldName = held?.label || basename(held?.cwd ?? "");
    const busy = await post("/api/lanes", { repo: REPO, attach: ob.cwd, slot: lc.lnSlot });
    const busyJ = (await busy.json()) as { error?: string; occupant?: { slot: number; name: string } };
    check("attach onto an occupied clicked slot is refused 409 and names who sits there",
      heldName !== "" && busy.status === 409 && busyJ.occupant?.slot === lc.lnSlot && busyJ.occupant.name === heldName
        && (busyJ.error ?? "").includes(heldName), `${busy.status} ${JSON.stringify(busyJ)} expected ${heldName}`);
    check("…and the refused attach seated nothing: the tree is still an orphan, the slot still its holder's",
      isOrphan(await info(REPO), ob.cwd) === true && (await slotsNow()).find((x) => x.id === lc.lnSlot)?.cwd === lc.lnPath);
    check("slot without attach is refused 400 — a new lane on a clicked place is open-worktree",
      (await post("/api/lanes", { repo: REPO, slot: lc.lnSlot })).status === 400);
    check("a slot that is not an integer place is refused 400",
      (await post("/api/lanes", { repo: REPO, attach: ob.cwd, slot: "3" })).status === 400
        && (await post("/api/lanes", { repo: REPO, attach: ob.cwd, slot: 0 })).status === 400);

    // the LAST free place, so a server that ignored `slot` and took its own first-free pick is caught
    const freeIds = (await slotsNow()).filter((x) => !x.cwd).map((x) => x.id);
    const target = freeIds[freeIds.length - 1];
    check("clicked-place probe setup: two free places, so the clicked one is not the server's own pick",
      freeIds.length >= 2, JSON.stringify(freeIds));
    const seated = (await (await post("/api/lanes", { repo: REPO, attach: ob.cwd, slot: target })).json()) as
      { ok?: boolean; slot?: number; error?: string };
    check("attach with a free clicked slot seats the orphan exactly there, not in the first free place",
      seated.ok === true && seated.slot === target && target !== freeIds[0], JSON.stringify({ seated, freeIds }));
    check("…the clicked slot now holds the orphan's tree, and dirinfo no longer calls it an orphan",
      (await slotsNow()).find((x) => x.id === target)?.cwd === ob.cwd && isOrphan(await info(REPO), ob.cwd) === false);
    await post(`/api/slots/${target}/kill`, {});
    spawnSync("git", ["worktree", "remove", "--force", ob.cwd], { cwd: REPO });

    // packs are read at HEAD from a fixture repo of their own, so REPO's history stays as the
    // merge sections expect it
    const pk = `${REPO}.dirinfo-packs-fixture`;
    rmSync(pk, { recursive: true, force: true });
    mkdirSync(pk, { recursive: true });
    const g = (...a: string[]): number | null =>
      spawnSync("git", ["-C", pk, "-c", "user.email=e2e@test", "-c", "user.name=e2e", ...a]).status;
    writeFileSync(`${pk}/README.md`, "fixture\n");
    check("packs probe setup: a fixture repo with one commit and no manifest",
      g("init", "-q", "-b", "main") === 0 && g("add", "README.md") === 0 && g("commit", "-qm", "no manifest") === 0);
    const none = await info(pk);
    check("dirinfo on a repo without .fleet/context-packs.json: packs is [] (measured absent)",
      none.git === true && Array.isArray(none.packs) && none.packs.length === 0, JSON.stringify(none.packs));
    check("…and a repo without other worktrees has orphans []",
      Array.isArray(none.orphans) && none.orphans.length === 0, JSON.stringify(none.orphans));
    mkdirSync(`${pk}/.fleet`);
    writeFileSync(`${pk}/.fleet/context-packs.json`, JSON.stringify([{ id: "alpha" }, { id: "beta" }]));
    const unborn = await info(pk);
    check("packs are read at HEAD: a manifest on disk but not committed is not there yet",
      Array.isArray(unborn.packs) && unborn.packs.length === 0, JSON.stringify(unborn.packs));
    g("add", ".fleet/context-packs.json");
    g("commit", "-qm", "manifest");
    const two = await info(pk);
    check("dirinfo carries the manifest's pack ids at HEAD, in file order",
      JSON.stringify(two.packs) === JSON.stringify(["alpha", "beta"]), JSON.stringify(two.packs));
    writeFileSync(`${pk}/.fleet/context-packs.json`, "[{ not json");
    g("commit", "-qam", "broken manifest");
    const broken = await info(pk);
    check("an unparseable manifest is the packs field WITH a reason, never a silent []",
      broken.packs !== undefined && !Array.isArray(broken.packs) && typeof broken.packs.error === "string"
        && broken.packs.error.length > 0, JSON.stringify(broken.packs));
    writeFileSync(`${pk}/.fleet/context-packs.json`, JSON.stringify([{ id: "alpha" }, { useWhen: "no id" }]));
    g("commit", "-qam", "pack without id");
    const noId = await info(pk);
    check("a pack without an id is an error naming its index, not a shortened list",
      noId.packs !== undefined && !Array.isArray(noId.packs) && noId.packs.error.includes("pack 1"), JSON.stringify(noId.packs));
    rmSync(pk, { recursive: true, force: true });
  }

  // --- the OTHER teardown, and the one that had none: a dispatch that requeues after the lane is
  // already spawned. briefAndSend's post-spawn gate is retry-shaped — the row goes back to `queued`
  // — and until this landed the worktree and the slot it had just created stayed standing, owned by
  // nobody. Same edge as shelve above, opposite answer: shelve KEEPS a tree because the owner said
  // so, a requeue keeps one only when it holds work, and must say so on the row.
  //
  // The gate is made genuinely red (master stop, flipped inside briefAndSend's 4 s boot sleep), not
  // simulated: the requeue has to actually run for "no worktree left" to mean anything. Every
  // precondition the probe depends on is asserted as ITS OWN check — a lane that never spawned, or
  // a queue that never moved, must fail as a broken probe and never as a clean teardown.
  {
    type Sess = { slots: { id: number; cwd: string | null; worktree: { repo: string } | null }[];
      tasks: { id: string; status: string; slot?: number; note?: string }[];
      dispatch: { on: boolean; maxLanes: number; repo: string } };
    const sess = async (): Promise<Sess> => (await (await get("/api/sessions")).json()) as Sess;
    const rowOf = (s: Sess, id: string): Sess["tasks"][number] | undefined => s.tasks.find((t) => t.id === id);
    // poll rather than sleep: the dispatch tick is 250 ms here and the boot sleep is 4 s, so the
    // flip we are waiting for has to be caught, not timed
    const until = async (id: string, status: string): Promise<Sess> => {
      const t0 = Date.now();
      let last = await sess();
      while (Date.now() - t0 < 15000) {
        if (rowOf(last, id)?.status === status) return last;
        await Bun.sleep(50);
        last = await sess();
      }
      return last;
    };
    const queue = async (text: string): Promise<string> =>
      ((await (await post("/api/tasks", { text, queue: true })).json()) as { task: { id: string } }).task.id;

    await post("/api/autos/switch", { on: true });
    await post("/api/dispatch", { on: true });
    const pre = await sess();
    // the cap the DISPATCHER applies, measured the way it measures: lanes in the dispatch repo,
    // not occupied slots. Paths are compared through realpath because a lane stores the git
    // toplevel (/var → /private/var) while the env keeps whatever the operator typed.
    const canon = (p: string): string => { try { return realpathSync(p); } catch { return p; } };
    const lanesNow = pre.slots.filter((s) => s.worktree && canon(s.worktree.repo) === canon(pre.dispatch.repo)).length;
    check("requeue probe precondition: dispatcher on, a free slot, dispatch-repo lanes under the cap",
      pre.dispatch.on === true && pre.slots.some((s) => !s.cwd) && lanesNow < pre.dispatch.maxLanes,
      `on=${pre.dispatch.on} free=${pre.slots.filter((s) => !s.cwd).length} lanes=${lanesNow}/${pre.dispatch.maxLanes}`);

    // (a) EMPTY lane → the requeue takes the whole lane with it
    const emptyId = await queue("requeue-teardown-empty");
    const sentE = await until(emptyId, "sent");
    const slotE = rowOf(sentE, emptyId)?.slot;
    const cwdE = sentE.slots.find((s) => s.id === slotE)?.cwd ?? "";
    check("requeue probe (empty): the lane really spawned — worktree on disk, slot held",
      typeof slotE === "number" && cwdE !== "" && exists(cwdE), `slot=${slotE} cwd=${cwdE}`);
    await post("/api/autos/switch", { on: false }); // master stop → the post-spawn gate fails for real
    const backE = await until(emptyId, "queued");
    const noteE = rowOf(backE, emptyId)?.note ?? "";
    check("requeue probe (empty): the row went back to queued through the GATE, not some other path",
      rowOf(backE, emptyId)?.status === "queued" && noteE.includes("kill-switch"), `note=${noteE}`);
    check("an empty lane is torn down by its own requeue — no worktree left behind", !exists(cwdE), cwdE);
    check("…and no slot left held by it either",
      backE.slots.find((s) => s.id === slotE)?.cwd === null && rowOf(backE, emptyId)?.slot === undefined,
      `cwd=${backE.slots.find((s) => s.id === slotE)?.cwd} slot=${rowOf(backE, emptyId)?.slot}`);
    await post(`/api/tasks/${emptyId}/delete`, {});

    // (b) DIRTY lane → kept, and the row says why. A silently kept worktree is the same defect.
    await post("/api/autos/switch", { on: true });
    const dirtyId = await queue("requeue-teardown-dirty");
    const sentD = await until(dirtyId, "sent");
    const slotD = rowOf(sentD, dirtyId)?.slot;
    const cwdD = sentD.slots.find((s) => s.id === slotD)?.cwd ?? "";
    check("requeue probe (dirty): the lane really spawned — worktree on disk, slot held",
      typeof slotD === "number" && cwdD !== "" && exists(cwdD), `slot=${slotD} cwd=${cwdD}`);
    if (cwdD) await Bun.write(`${cwdD}/half-written.txt`, "the pane got here first\n");
    check("requeue probe (dirty): the tree is genuinely dirty before the gate fires",
      spawnSync("git", ["-C", cwdD || REPO, "status", "--porcelain"]).stdout.toString().includes("half-written.txt"));
    await post("/api/autos/switch", { on: false });
    const backD = await until(dirtyId, "queued");
    const noteD = rowOf(backD, dirtyId)?.note ?? "";
    check("requeue probe (dirty): the row went back to queued through the GATE",
      rowOf(backD, dirtyId)?.status === "queued" && noteD.includes("kill-switch"), `note=${noteD}`);
    check("a requeue never eats work: a dirty lane is KEPT and the row names the reason",
      exists(cwdD) && exists(`${cwdD}/half-written.txt`) && noteD.includes("lane kept")
        && noteD.includes("uncommitted"), `note=${noteD} tree=${exists(cwdD)}`);
    await post(`/api/tasks/${dirtyId}/delete`, {});
    await post("/api/dispatch", { on: false });
    if (typeof slotD === "number") await post(`/api/slots/${slotD}/kill`, {});
    if (cwdD) spawnSync("git", ["worktree", "remove", "--force", cwdD], { cwd: REPO });
    await post("/api/autos/switch", { on: true });

    // (c) A LANDED ROW IS NOT THE TAIL'S TO REQUEUE. The founding brief is delivered by a DETACHED
    // tail (briefAndSend), and a lane can land inside that window: landLane marks the row `done`
    // and kills the slot, the pending send then throws "slot changed …", and the requeue used to
    // write the landed row back to `queued` (e2e trail 2026-09-12, the self-land progress guard's
    // "REPAIRED candidate" check, twice with note `dispatch failed: slot changed before submit;
    // lane kept (git status failed — worktree gone?)`). The interleaving is FORCED, not timed:
    // the send-before-paste latch parks the tail at a known line, the land runs to completion
    // while it is parked, and only then is the tail released.
    // Mutation caught: dropping the ownership read at the top of briefAndSend#requeue.
    const latch = `${ROOT}/requeue-landed-latch`;
    for (const f of [latch, `${latch}.reached`, `${latch}.release`]) rmSync(f, { force: true });
    const marker = `requeue-landed-probe-${Date.now()}`;
    writeFileSync(latch, marker, { mode: 0o600 });
    await restartSrv({ FLEET_TEST_SEND_BEFORE_PASTE_LATCH: latch });
    await post("/api/dispatch", { on: false }); // a requeued row must not be re-dispatched under the check
    const rlId = ((await (await post("/api/tasks", { text: marker })).json()) as { task: { id: string } }).task.id;
    const rlStart = await post(`/api/tasks/${rlId}/dispatch`, {});
    const rlSlot = ((await rlStart.json()) as { slot?: number }).slot;
    let rlReached = false;
    for (let i = 0; i < 300 && !rlReached; i++) { rlReached = exists(`${latch}.reached`); if (!rlReached) await Bun.sleep(50); }
    check("landed-requeue probe setup: the founding send is PARKED at the pre-paste latch",
      rlStart.ok && typeof rlSlot === "number" && rlReached, `${rlStart.status} slot=${rlSlot} reached=${rlReached}`);
    const rlCwd = (await sess()).slots.find((s) => s.id === rlSlot)?.cwd ?? "";
    let rlLanded = false;
    let rlAtLand: Sess["tasks"][number] | undefined;
    if (rlReached && typeof rlSlot === "number" && rlCwd) {
      writeFileSync(`${rlCwd}/requeue-landed.txt`, "landed while the brief was parked\n");
      spawnSync("git", ["-C", rlCwd, "add", "requeue-landed.txt"]);
      spawnSync("git", ["-C", rlCwd, "commit", "-qm", "requeue landed probe"]);
      await settleForMerge(rlSlot);
      await post(`/api/slots/${rlSlot}/merge`, {});
      rlLanded = (await waitMerge(rlSlot)).gone;
      rlAtLand = rowOf(await sess(), rlId);
    }
    check("landed-requeue probe setup: the lane LANDED while the tail was parked, and the land retired the row",
      rlLanded && rlAtLand?.status === "done" && !exists(`${latch}.release`),
      JSON.stringify({ landed: rlLanded, row: rlAtLand }));
    writeFileSync(`${latch}.release`, "release\n", { mode: 0o600 });
    // the tail's terminal is either the row moving or its skip line on the trail — polled, never slept
    const rlSkipped = (): boolean => readFileSync(`${ROOT}/audit.jsonl`, "utf8").split("\n")
      .some((l) => l.includes('"dispatch_requeue_skipped"') && l.includes(rlId));
    let rlAfter = rowOf(await sess(), rlId);
    for (let i = 0; i < 200 && rlAfter?.status === "done" && !rlSkipped(); i++) {
      await Bun.sleep(50);
      rlAfter = rowOf(await sess(), rlId);
    }
    check("a row landed under a parked founding brief STAYS done — the released tail requeues nothing it no longer owns",
      rlLanded && rlAfter?.status === "done" && (rlAfter.note ?? "").startsWith("landed") && rlSkipped(),
      JSON.stringify({ row: rlAfter, skipped: rlSkipped() }));
    await post(`/api/tasks/${rlId}/delete`, {});
    for (const f of [latch, `${latch}.reached`, `${latch}.release`]) rmSync(f, { force: true });
    await restartSrv();
  }

  // --- ↻ restart: the one slot verb that is NOT a teardown. Every other exit (kill, shelve, the
  // recycle inside openSlot) funnels through killSlot, which clears sessionId/worktree/label/model/
  // mission, drops the slot's shares and autos, detaches its tasks and — for a lane — emits a lane
  // outcome. Restart must do NONE of that: it kills the pane so ensureSlot can respawn it against
  // the still-pinned conversation. Measured as a before/after on the persisted slot record plus the
  // two ledgers, because that boundary is the whole verb and a future edit that routes it through
  // killSlot "to reuse the teardown" would look perfectly reasonable in a diff.
  //
  // WHAT THIS SUITE CANNOT PROVE: the `--resume <id>` string itself. e2e-isolated.sh runs
  // FLEET_CMD=true, and slotCmd only pins/resumes a session when BASE_CMD starts with `claude` —
  // so sessionId is null on both sides here and asserting the resume string would assert something
  // this harness never produces. That half lives in fleet-e2e-claude-gate.ts, which runs a real
  // `claude` stand-in and therefore has a pin to preserve. ---
  {
    const rs = (await (await post("/api/lanes", { repo: REPO, model: "restart-probe-model-5" })).json()) as
      { slot: number; cwd: string; branch: string };
    await post(`/api/slots/${rs.slot}/mission`, { mission: "the restart must not eat this" });
    const shJ = (await (await post(`/api/slots/${rs.slot}/share`, { mode: "view" })).json()) as { id?: string };
    const auJ = (await (await post(`/api/slots/${rs.slot}/autos`, { text: "survive the restart", inSec: 3600 })).json()) as
      { auto?: { id: string } };
    await Bun.write(`${rs.cwd}/restart-uncommitted.txt`, "half done\n"); // the worktree must be untouched too

    // fleet.json's per-slot record IS the state under test — cwd, label, mission, awaiting,
    // sessionId, worktree, model and selfToken in one object (server.ts saveState). Comparing the
    // WHOLE record rather than a hand-picked field list means a field added to a slot later is
    // covered by this check without anyone remembering to extend it.
    const slotRecord = async (): Promise<string> => JSON.stringify(
      ((await Bun.file(`${ROOT}/fleet.json`).json()) as { slots: Record<string, unknown> }).slots[String(rs.slot)] ?? null);
    const liveState = async () => {
      const j = (await (await get("/api/sessions")).json()) as
        { slots: { id: number; cwd: string | null; share?: { id: string } | null }[]; autos: { id: string; slot: number }[] };
      return { slot: j.slots.find((x) => x.id === rs.slot), autos: j.autos };
    };
    const outcomes = async (): Promise<{ branch?: string }[]> =>
      ((await (await get("/api/lane-outcomes?limit=1000")).json()) as { outcomes: { branch?: string }[] }).outcomes;
    // DELTA off a baseline, never an absolute count: opening this lane already wrote a
    // self_heal_recreate row of its own (ensureSlot audits its FIRST spawn too), and slot ids are
    // recycled across the suite, so this id legitimately carries older rows.
    let slotAuditError = "";
    const slotAudit = (): string[] => {
      try {
        return readFileSync(`${ROOT}/audit.jsonl`, "utf8").split("\n").filter(Boolean)
          .map((l) => { try { return JSON.parse(l) as { event?: string; slot?: number }; } catch { return null; } })
          .filter((r): r is { event?: string; slot?: number } => !!r && r.slot === rs.slot)
          .map((r) => String(r.event ?? ""));
      } catch (e) {
        slotAuditError = e instanceof Error ? e.message : String(e);
        return [];
      }
    };

    await Bun.sleep(300); // saveState/audit writes are chained and fire-and-forget — let the setup land before baselining
    const recBefore = await slotRecord();
    const outBefore = (await outcomes()).length;
    const auditBefore = slotAudit().length;
    check("restart fixture precondition: audit.jsonl is readable before the delta baseline",
      slotAuditError === "", slotAuditError);
    const paneBefore = (await tmuxOut("display-message", "-p", "-t", `s${rs.slot}`, "#{pane_pid}")).out.trim();

    const rsRes = await post(`/api/slots/${rs.slot}/restart`, {});
    const rsJ = (await rsRes.json()) as { ok?: boolean; resumed?: boolean; error?: string };
    check("↻ restart answers ok, and says whether the pinned conversation came back",
      rsRes.ok && rsJ.ok === true && typeof rsJ.resumed === "boolean", `${rsRes.status} ${JSON.stringify(rsJ)}`);
    // FLEET_CMD=true pins nothing, so `false` is the TRUTH here, not a defect — the route must
    // report it rather than claim a resume it did not perform (the claude-gate suite owns the
    // other branch of this same field).
    check("↻ restart under an unpinned FLEET_CMD reports resumed:false, never a claimed resume",
      rsJ.resumed === false, JSON.stringify(rsJ));

    const paneAfter = (await tmuxOut("display-message", "-p", "-t", `s${rs.slot}`, "#{pane_pid}")).out.trim();
    check("↻ restart leaves a LIVE pane behind — rebuilt inline, not left to the 2s self-heal tick",
      paneAfter !== "" && paneAfter !== paneBefore, `before=${paneBefore} after=${paneAfter}`);

    check("↻ restart changes NOTHING in the slot's persisted record (sessionId, worktree, label, model, mission, selfToken)",
      (await slotRecord()) === recBefore, `before=${recBefore} after=${await slotRecord()}`);

    const live = await liveState();
    check("↻ restart keeps the slot's share — a restart is not a session ending",
      !!shJ.id && live.slot?.share?.id === shJ.id, `${shJ.id} → ${live.slot?.share?.id}`); // id only — the detail must not echo the share secret
    check("↻ restart keeps the slot's scheduled prompts",
      !!auJ.auto?.id && live.autos.some((a) => a.id === auJ.auto?.id && a.slot === rs.slot),
      `${auJ.auto?.id} → ${JSON.stringify(live.autos.filter((a) => a.slot === rs.slot))}`);
    const outAfter = await outcomes();
    check("↻ restart writes NO lane outcome — the lane did not end, so the ledger must stay silent",
      outAfter.length === outBefore && !outAfter.some((o) => o.branch === rs.branch),
      `before=${outBefore} after=${outAfter.length} thisBranch=${outAfter.filter((o) => o.branch === rs.branch).length}`);
    check("↻ restart leaves the worktree and its uncommitted work alone", exists(`${rs.cwd}/restart-uncommitted.txt`));

    // the trail must say WHO rebuilt the pane. Booking an owner-triggered restart as
    // self_heal_recreate would feed slotstats' resumed/heals a rebuild that resumes by
    // construction — inflating the exact durability rate it is no evidence for.
    let auditNew: string[] = [];
    for (let i = 0; i < 50; i++) { // the audit write is chained and fire-and-forget — poll, never sleep-and-hope
      auditNew = slotAudit().slice(auditBefore);
      if (auditNew.length > 0) break;
      await Bun.sleep(100);
    }
    check("↻ restart is trailed as slot_restart, never as a self-heal (slotstats must not read it as a heal)",
      auditNew.length === 1 && auditNew[0] === "slot_restart", JSON.stringify(auditNew));

    await post(`/api/slots/${rs.slot}/kill`, {});
    check("↻ restart refuses an inactive slot", (await post(`/api/slots/${rs.slot}/restart`, {})).status === 400);
  }

  // --- lane brief must be LANE-SCOPED and match git exactly (regression: it used to show
  // the base branch's whole history for lanes, and truncated the first uncommitted file) ---
  {
    const bl = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    // two lane commits on top of the base
    await Bun.write(`${bl.cwd}/lane-a.txt`, "a\n");
    spawnSync("git", ["-C", bl.cwd, "add", "lane-a.txt"]);
    spawnSync("git", ["-C", bl.cwd, "commit", "-qm", "lane commit one"]);
    await Bun.write(`${bl.cwd}/lane-b.txt`, "b\n");
    spawnSync("git", ["-C", bl.cwd, "add", "lane-b.txt"]);
    spawnSync("git", ["-C", bl.cwd, "commit", "-qm", "lane commit two"]);
    // main diverges on a file the lane never touched (regression bait for two-dot footprint)
    await Bun.write(`${REPO}/divergent.txt`, "main only\n");
    spawnSync("git", ["-C", REPO, "add", "divergent.txt"]);
    spawnSync("git", ["-C", REPO, "commit", "-qm", "main divergence"]);
    // mixed uncommitted work: unstaged modify (leading-space porcelain), staged add, untracked
    await Bun.write(`${bl.cwd}/lane-a.txt`, "a changed\n");
    await Bun.write(`${bl.cwd}/lane-staged.txt`, "s\n");
    spawnSync("git", ["-C", bl.cwd, "add", "lane-staged.txt"]);
    await Bun.write(`${bl.cwd}/lane-untracked.txt`, "u\n");

    const blb = (await (await get(`/api/slots/${bl.slot}/brief`)).json()) as
      { laneScoped: boolean; laneBase: string; ahead: number; behind: number; head: string | null;
        commits: { subject: string }[]; repoCommits: { subject: string }[];
        files: string[]; uncommittedFiles: string[] };
    // git truth for comparison
    const gitCommits = spawnSync("git", ["-C", bl.cwd, "log", "--format=%s", `${blb.laneBase}..HEAD`]).stdout.toString().split("\n").filter(Boolean);
    const gitStatus = spawnSync("git", ["-C", bl.cwd, "status", "--porcelain"]).stdout.toString().split("\n").filter(Boolean);
    const gitFootprint = spawnSync("git", ["-C", bl.cwd, "diff", "--name-only", `${blb.laneBase}...HEAD`]).stdout.toString().split("\n").filter(Boolean);

    check("lane brief is laneScoped with the base branch", blb.laneScoped === true && (blb.laneBase === "main" || blb.laneBase === "master"));
    check("lane commits = git main..HEAD exactly (no base history)",
      blb.commits.map((c) => c.subject).join("|") === gitCommits.join("|")
      && blb.commits.length === 2 && !blb.commits.some((c) => c.subject.startsWith("main:")),
      `brief=${JSON.stringify(blb.commits.map((c) => c.subject))} git=${JSON.stringify(gitCommits)}`);
    check("lane ahead/behind vs base match git (ahead 2, behind 1)", blb.ahead === 2 && blb.behind === 1,
      `ahead=${blb.ahead} behind=${blb.behind}`);
    check("lane footprint is three-dot (only lane's own files, not main's divergence)",
      blb.files.map((f) => f.slice(3)).sort().join(",") === gitFootprint.sort().join(",")
      && !blb.files.some((f) => f.includes("divergent.txt")),
      `brief=${JSON.stringify(blb.files)} git=${JSON.stringify(gitFootprint)}`);
    check("lane uncommittedFiles match git status byte-for-byte (columns preserved)",
      blb.uncommittedFiles.join("\n") === gitStatus.join("\n"),
      `brief=${JSON.stringify(blb.uncommittedFiles)} git=${JSON.stringify(gitStatus)}`);
    check("first uncommitted entry keeps its leading status column (not truncated)",
      blb.uncommittedFiles.some((f) => f === " M lane-a.txt"), JSON.stringify(blb.uncommittedFiles));
    // --- the board's identity line (§F4): the commit the tree actually sits on. A branch name
    // says WHICH lane, never WHERE it is — two lanes off the same base read identically until
    // one of them commits, and this is the field that tells them apart.
    const gitHead = spawnSync("git", ["-C", bl.cwd, "rev-parse", "--short", "HEAD"]).stdout.toString().trim();
    check("lane brief carries the short HEAD sha, and it is git's", blb.head === gitHead && /^[0-9a-f]{7,}$/.test(blb.head ?? ""),
      `brief=${blb.head} git=${gitHead}`);
    // --- repoCommits is the COMPLEMENT of `commits`, not a second copy of it: for a lane that is
    // the base branch's own recent history ("what the project got while I was working"). The lane's
    // commits appearing here would make the board's two subheads say the same thing twice.
    const repoSubjects = (blb.repoCommits ?? []).map((c) => c.subject);
    check("lane repoCommits = the BASE branch's history (has main's divergence, not the lane's own commits)",
      repoSubjects.includes("main divergence") && !repoSubjects.some((s) => s.startsWith("lane commit")),
      JSON.stringify(repoSubjects));
    // HEAD is a fact about the tree, not a cached label — one more commit must move it
    await Bun.write(`${bl.cwd}/lane-c.txt`, "c\n");
    spawnSync("git", ["-C", bl.cwd, "add", "lane-c.txt"]);
    spawnSync("git", ["-C", bl.cwd, "commit", "-qm", "lane commit three"]);
    const blb2 = (await (await get(`/api/slots/${bl.slot}/brief`)).json()) as { head: string | null };
    check("lane brief HEAD follows a new commit", blb2.head !== null && blb2.head !== blb.head
      && blb2.head === spawnSync("git", ["-C", bl.cwd, "rev-parse", "--short", "HEAD"]).stdout.toString().trim(),
      `before=${blb.head} after=${blb2.head}`);
    await post(`/api/slots/${bl.slot}/kill`, {}); // free the slot; worktree orphaned in the throwaway repo
  }

  // --- 💾 commit endpoint: a LANE stages untracked too (add -A), a MAIN (non-lane) session
  // stages tracked only (add -u) so scratch/secrets never sweep into a shipped branch, and a
  // detached HEAD is refused. All on throwaway repos — never the real checkout. ---
  {
    // (a) lane commit includes untracked → clean tree afterwards
    const cl = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
    await Bun.write(`${cl.cwd}/tracked.txt`, "x\n");
    spawnSync("git", ["-C", cl.cwd, "add", "tracked.txt"]);
    spawnSync("git", ["-C", cl.cwd, "commit", "-qm", "seed"]);
    await Bun.write(`${cl.cwd}/tracked.txt`, "x changed\n");    // tracked modify
    await Bun.write(`${cl.cwd}/fresh-untracked.txt`, "u\n");    // untracked
    const clRes = (await (await post(`/api/slots/${cl.slot}/commit`, { mode: "quick", confirm: true })).json()) as { committed?: boolean };
    const clStatus = spawnSync("git", ["-C", cl.cwd, "status", "--porcelain"]).stdout.toString().trim();
    check("lane commit stages untracked too (add -A) → clean tree", clRes.committed === true && clStatus === "",
      `committed=${clRes.committed} status=${JSON.stringify(clStatus)}`);
    await post(`/api/slots/${cl.slot}/kill`, {});

    // (b) main-session commit stages tracked only (add -u), leaves untracked alone
    const mainRepo = `${REPO}.commit-main`;
    spawnSync("git", ["init", "-q", "-b", "main", mainRepo]); // fakemerge hardcodes `git rebase main`
    spawnSync("git", ["-C", mainRepo, "config", "user.email", "e2e@test"]);
    spawnSync("git", ["-C", mainRepo, "config", "user.name", "e2e"]);
    await Bun.write(`${mainRepo}/f.txt`, "1\n");
    spawnSync("git", ["-C", mainRepo, "add", "f.txt"]);
    spawnSync("git", ["-C", mainRepo, "commit", "-qm", "init"]);
    await post("/api/slots/9/kill", {}); // ensure the slot is free before opening
    const mOpen = await post("/api/slots/9/open", { cwd: mainRepo });
    check("open a main (non-lane) session for commit test", mOpen.ok, JSON.stringify(await mOpen.json().catch(() => ({}))));
    await Bun.write(`${mainRepo}/f.txt`, "2\n");                 // tracked modify
    await Bun.write(`${mainRepo}/scratch.txt`, "secret\n");     // untracked — must NOT be committed
    const mRes = (await (await post("/api/slots/9/commit", { mode: "quick", confirm: true })).json()) as { committed?: boolean };
    const mStatus = spawnSync("git", ["-C", mainRepo, "status", "--porcelain"]).stdout.toString();
    check("main-session commit stages tracked (add -u), leaves untracked untracked",
      mRes.committed === true && /\?\? scratch\.txt/.test(mStatus) && !/f\.txt/.test(mStatus),
      `committed=${mRes.committed} status=${JSON.stringify(mStatus)}`);

    // (c) a detached HEAD is refused (would otherwise be a dangling commit)
    spawnSync("git", ["-C", mainRepo, "checkout", "-q", "--detach"]);
    await Bun.write(`${mainRepo}/f.txt`, "3\n");
    const dRes = (await (await post("/api/slots/9/commit", { mode: "quick", confirm: true })).json()) as { committed?: boolean; reason?: string };
    check("commit refuses a detached HEAD", dRes.committed === false && (dRes.reason ?? "").includes("detached"), JSON.stringify(dRes));
    await post("/api/slots/9/kill", {});

    // (d) an interrupted rebase is surfaced (brief.gitOp) and blocks commit — restart-recovery
    // detection. Isolated repo so the induced conflict never touches the shared test repo.
    const gopRepo = `${REPO}.gitop`;
    spawnSync("git", ["init", "-q", "-b", "main", gopRepo]); // fakemerge hardcodes `git rebase main`
    spawnSync("git", ["-C", gopRepo, "config", "user.email", "e2e@test"]);
    spawnSync("git", ["-C", gopRepo, "config", "user.name", "e2e"]);
    await Bun.write(`${gopRepo}/c.txt`, "base\n");
    spawnSync("git", ["-C", gopRepo, "add", "c.txt"]);
    spawnSync("git", ["-C", gopRepo, "commit", "-qm", "base"]);
    const gl = (await (await post("/api/lanes", { repo: gopRepo })).json()) as { slot: number; cwd: string };
    await Bun.write(`${gl.cwd}/c.txt`, "lane side\n");            // lane edit
    spawnSync("git", ["-C", gl.cwd, "commit", "-aqm", "lane edit"]);
    const gopMain = spawnSync("git", ["-C", gopRepo, "rev-parse", "--abbrev-ref", "HEAD"]).stdout.toString().trim();
    await Bun.write(`${gopRepo}/c.txt`, "main side\n");           // main edits the SAME line → conflict
    spawnSync("git", ["-C", gopRepo, "commit", "-aqm", "main edit"]);
    spawnSync("git", ["-C", gl.cwd, "rebase", gopMain]);          // stops mid-rebase on the conflict
    const glBrief = (await (await get(`/api/slots/${gl.slot}/brief`)).json()) as { gitOp?: boolean };
    check("brief flags an interrupted rebase (gitOp)", glBrief.gitOp === true, JSON.stringify(glBrief.gitOp));
    const glCommit = (await (await post(`/api/slots/${gl.slot}/commit`, { mode: "quick", confirm: true })).json()) as { committed?: boolean; reason?: string };
    check("commit is blocked during an interrupted rebase", glCommit.committed === false && (glCommit.reason ?? "").includes("in progress"), JSON.stringify(glCommit));
    spawnSync("git", ["-C", gl.cwd, "rebase", "--abort"]);
    await post(`/api/slots/${gl.slot}/kill`, {});
  }

  // --- THE LANE FORM: a working copy that is its own repository. A worktree's `.git` is a FILE
  // pointing into the primary's common dir, so a worktree is not self-contained: handed alone to a
  // sandbox it is a directory git cannot work in, and handed WITH its common dir it carries
  // `.git/hooks`, whose contents run on the HOST on the owner's next commit. A clone lane has its
  // own object database, hooks and config. Everything below exists to prove that the boundary is
  // real AND that the lane is still a lane: same board numbers, same land, same ledgers.
  {
    const g = (repo: string, ...a: string[]): string =>
      spawnSync("git", ["-C", repo, ...a], { encoding: "utf8" }).stdout.toString().trim();
    const cRepo = `${REPO}.cloneform`;
    rmSync(cRepo, { recursive: true, force: true });
    spawnSync("git", ["init", "-q", "-b", "main", cRepo]);
    spawnSync("git", ["-C", cRepo, "config", "user.email", "e2e@test"]);
    spawnSync("git", ["-C", cRepo, "config", "user.name", "e2e"]);
    writeFileSync(`${cRepo}/base.txt`, "base\n");
    spawnSync("git", ["-C", cRepo, "add", "base.txt"]);
    spawnSync("git", ["-C", cRepo, "commit", "-qm", "base"]);

    const cl = (await (await post("/api/lanes", { repo: cRepo, form: "clone" })).json()) as
      { ok?: boolean; slot?: number; cwd?: string; branch?: string; form?: string; error?: string };
    check("a lane opens with form=clone", cl.ok === true && cl.form === "clone" && typeof cl.cwd === "string",
      JSON.stringify(cl));
    check("an unknown lane form is refused rather than silently defaulted",
      (await post("/api/lanes", { repo: cRepo, form: "shallow" })).status === 400);
    const cCwd = cl.cwd ?? "";
    const cSlot = cl.slot ?? -1;
    const cBranch = cl.branch ?? "";

    // THE BOUNDARY, as a measurement and not a claim. `--git-common-dir` is the directory git
    // would read hooks and config from: for a worktree it is the PRIMARY's, for a clone it must be
    // the clone's own. The pair is asserted together, because "the clone is isolated" and "the
    // worktree still is not" are the two halves of one fact — and the second is what makes the
    // first worth having.
    const commonDir = (dir: string): string =>
      g(dir, "rev-parse", "--path-format=absolute", "--git-common-dir");
    const cCommon = commonDir(cCwd);
    check("a clone lane's git common dir is its OWN .git, not the repo's",
      cCommon !== "" && realpathSync(cCommon) === realpathSync(`${cCwd}/.git`)
      && realpathSync(cCommon) !== realpathSync(`${cRepo}/.git`),
      `${cCommon} vs ${cRepo}/.git`);
    check("the repo's hooks directory is not reachable from inside a clone lane",
      !exists(`${cCommon}/../../.git/hooks`) || realpathSync(`${cCommon}/hooks`) !== realpathSync(`${cRepo}/.git/hooks`),
      `${cCommon}/hooks`);
    check("a clone lane's .git is a directory (a worktree lane's is a gitdir FILE)",
      exists(`${cCwd}/.git`) && lstatSync(`${cCwd}/.git`).isDirectory()
      && exists(`${lc.lnPath}/.git`) && lstatSync(`${lc.lnPath}/.git`).isFile(),
      `clone=${exists(`${cCwd}/.git`) ? lstatSync(`${cCwd}/.git`).isDirectory() : "missing"}`);
    // --no-hardlinks is the whole point of the form: an `alternates` file or shared object inodes
    // would leave the two repos reading the same bytes, which is the separation this is for.
    check("a clone lane borrows no objects from the repo (no alternates file)",
      !exists(`${cCwd}/.git/objects/info/alternates`));
    check("a clone lane is invisible to `git worktree list` — it is not a worktree of the repo",
      !g(cRepo, "worktree", "list", "--porcelain").includes(cCwd), cCwd);
    // ...which is exactly why the lane map has to add it back: that surface answers "every lane
    // open on this repo", and an omission there would read as "no such lane".
    const cMap = (await (await get(`/api/slots/${cSlot}/worktrees`)).json()) as
      { repo?: string; worktrees?: { path: string; branch: string; slot: number | null }[] };
    check("the lane map lists a clone lane, anchored on the REPO and not on the clone itself",
      realpathSync(cMap.repo ?? "/") === realpathSync(cRepo)
      && (cMap.worktrees ?? []).some((w) => w.path === cCwd && w.branch === cBranch && w.slot === cSlot),
      JSON.stringify(cMap).slice(0, 300));

    // THE MIRROR. Everything Fleet knows about a lane is read either root-side by branch name
    // (drift, risk, `branch --merged`, the ff-merge) or tree-side against the base branch (the git
    // tick's ahead/behind, the rebase). A clone satisfies neither until both refs are mirrored.
    check("a fresh clone lane's branch is mirrored into the repo at spawn, not at the first tick",
      g(cRepo, "rev-parse", "--verify", `refs/heads/${cBranch}`) === g(cCwd, "rev-parse", "HEAD"),
      `${g(cRepo, "rev-parse", "--verify", `refs/heads/${cBranch}`)} vs ${g(cCwd, "rev-parse", "HEAD")}`);

    writeFileSync(`${cCwd}/lane.txt`, "clone lane work\n");
    spawnSync("git", ["-C", cCwd, "add", "lane.txt"]);
    spawnSync("git", ["-C", cCwd, "commit", "-qm", "clone lane work"]);
    writeFileSync(`${cRepo}/main.txt`, "main side\n"); // different file → no conflict
    spawnSync("git", ["-C", cRepo, "add", "main.txt"]);
    spawnSync("git", ["-C", cRepo, "commit", "-qm", "clone-form main work"]);

    // The board's numbers, from the clone. `behind` is the one that can only be right if the tick
    // mirrors the base branch DOWN into the clone — without it the clone measures against main as
    // it stood at clone time and reports 0 forever, which is a confident wrong answer rather than
    // a missing one. Polled past one full tick because that tick IS the mechanism under test.
    type Sess = { slots: { id: number; git: { branch: string; ahead: number; behind: number; dirty: number } | null }[] };
    let cGit: Sess["slots"][number]["git"] = null;
    for (let i = 0; i < 160; i++) {
      cGit = ((await (await get("/api/sessions")).json()) as Sess).slots.find((x) => x.id === cSlot)?.git ?? null;
      if (cGit && cGit.ahead === 1 && cGit.behind === 1) break;
      await Bun.sleep(150);
    }
    check("the board reads branch/ahead/behind/dirty for a clone lane out of the clone",
      cGit?.branch === cBranch && cGit.ahead === 1 && cGit.behind === 1 && cGit.dirty === 0,
      JSON.stringify(cGit));
    check("the tick mirrors the lane's new commit back into the repo",
      g(cRepo, "rev-parse", `refs/heads/${cBranch}`) === g(cCwd, "rev-parse", "HEAD"));

    // STALENESS, said out loud. Every root-side number about a clone lane is read off the mirror,
    // so it can be a moment old — and a stale-but-confident number is precisely the failure this
    // form must not introduce. A worktree lane has no copy and is never stale.
    // Its own lane in its own repo: the probe has to WEDGE a rebase to hold the mirror still, and
    // a wedged lane is the last thing to leave lying next to the one about to be landed.
    const driftOf = async (slot: number): Promise<{ stale?: boolean | null; behind?: number; error?: string }> => {
      let tok = "";
      try {
        tok = ((JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
          { slots?: Record<string, { selfToken?: string }> }).slots?.[String(slot)]?.selfToken) ?? "";
      } catch { /* state file mid-write — an empty token fails as unauthorized, which is honest */ }
      return (await (await fetch(`${BASE}/api/self/drift`, { headers: { "x-fleet-self-token": tok } })).json()) as
        { stale?: boolean | null; behind?: number; error?: string };
    };
    check("drift on a synced clone lane reports itself fresh", (await driftOf(cSlot)).stale === false,
      JSON.stringify(await driftOf(cSlot)));
    check("drift on a worktree lane is never stale — there is no copy to be stale",
      (await driftOf(lc.lnSlot)).stale === false, JSON.stringify(await driftOf(lc.lnSlot)));
    {
      const sRepo = `${REPO}.clonestale`;
      rmSync(sRepo, { recursive: true, force: true });
      spawnSync("git", ["init", "-q", "-b", "main", sRepo]);
      spawnSync("git", ["-C", sRepo, "config", "user.email", "e2e@test"]);
      spawnSync("git", ["-C", sRepo, "config", "user.name", "e2e"]);
      writeFileSync(`${sRepo}/f.txt`, "base\n");
      spawnSync("git", ["-C", sRepo, "add", "f.txt"]);
      spawnSync("git", ["-C", sRepo, "commit", "-qm", "base"]);
      const sl = (await (await post("/api/lanes", { repo: sRepo, form: "clone" })).json()) as
        { ok?: boolean; slot?: number; cwd?: string };
      const sSlot = sl.slot ?? -1;
      const sCwd = sl.cwd ?? "";
      check("stale probe precondition: a second clone lane opened", sl.ok === true && sCwd !== "", JSON.stringify(sl));
      // Deterministic, not a race against the 10 s tick: the tick deliberately does not write refs
      // into a lane whose git is mid-operation, so a wedged rebase pins the mirror where it is for
      // as long as the probe needs. That is also the real scenario worth pinning — while a lane is
      // being rewritten, Fleet must not report its root-side numbers as current.
      writeFileSync(`${sCwd}/f.txt`, "lane side\n");
      spawnSync("git", ["-C", sCwd, "commit", "-aqm", "stale-probe lane edit"]);
      writeFileSync(`${sRepo}/f.txt`, "main side\n");
      spawnSync("git", ["-C", sRepo, "commit", "-aqm", "stale-probe main edit"]);
      spawnSync("git", ["-C", sCwd, "fetch", "-q", sRepo, "+refs/heads/main:refs/heads/main"]);
      spawnSync("git", ["-C", sCwd, "rebase", "main"]); // halts on the conflict, mid-rebase
      check("stale probe precondition: the clone lane is genuinely wedged mid-rebase",
        exists(`${sCwd}/.git/rebase-merge`) || exists(`${sCwd}/.git/rebase-apply`));
      let staleSeen: boolean | null | undefined;
      for (let i = 0; i < 120; i++) {
        staleSeen = (await driftOf(sSlot)).stale;
        if (staleSeen === true) break;
        await Bun.sleep(150);
      }
      check("drift SAYS SO when the repo's mirror no longer matches the clone", staleSeen === true,
        JSON.stringify(await driftOf(sSlot)));
      spawnSync("git", ["-C", sCwd, "rebase", "--abort"]);
      let backFresh: boolean | null | undefined;
      for (let i = 0; i < 160; i++) {
        backFresh = (await driftOf(sSlot)).stale;
        if (backFresh === false) break;
        await Bun.sleep(150);
      }
      check("...and once the lane's git is free again the tick clears the staleness by itself",
        backFresh === false, JSON.stringify(await driftOf(sSlot)));
      await post(`/api/slots/${sSlot}/kill`, {});
      rmSync(sCwd, { recursive: true, force: true }); // kill keeps the tree; nothing else will collect a clone
    }

    // THE LAND. Same verbs, same ledgers: the branch reaches the repo by fetch instead of by
    // shared refs, and everything downstream of that is the path a worktree lane takes.
    const cMainBefore = g(cRepo, "rev-parse", "main");
    await setMergeMode("blocked"); // the agent, if wrongly consulted, would block — it must not be
    await settleForMerge(cSlot);
    await post(`/api/slots/${cSlot}/merge`, {});
    const cV = await waitMerge(cSlot);
    check("a clone lane lands through the ordinary script path, agent never consulted", cV.gone,
      JSON.stringify(cV));
    check("the clone lane's commit reached the repo's main",
      g(cRepo, "log", "--oneline", "-8").includes("clone lane work"), g(cRepo, "log", "--oneline", "-3"));
    check("landing a clone lane removes the clone from disk", !exists(cCwd), cCwd);
    const cMainAfter = g(cRepo, "rev-parse", "main");
    const cNote = spawnSync("git", ["-C", cRepo, "notes", "--ref=fleet/land", "show", cMainAfter], { encoding: "utf8" });
    check("a clone land is recorded like any other: git-note provenance on the landed tip",
      cNote.status === 0 && cMainAfter !== cMainBefore
      && (JSON.parse(cNote.stdout.toString().trim()) as { branch?: string }).branch === cBranch,
      `${cNote.status} ${cNote.stdout.toString().slice(0, 160)}`);
    const cOut = ((await (await get("/api/lane-outcomes?limit=1000")).json()) as
      { outcomes: { branch: string; disposition: string; verified: boolean | null }[] }).outcomes;
    const cRow = cOut.find((o) => o.branch === cBranch);
    check("a clone land emits its LaneOutcome unchanged",
      cRow?.disposition === "landed" && cRow.verified === true,
      JSON.stringify(cRow).slice(0, 200));

    // THE DEFAULT, unchanged: a lane asked for without a form is still a worktree, sharing the
    // repo's git. Asserted here rather than assumed, because the whole cut of this change is
    // "clones ALONGSIDE worktrees" — if the default moved, that cut did not hold.
    const dflt = (await (await post("/api/lanes", { repo: cRepo })).json()) as
      { ok?: boolean; slot?: number; cwd?: string; form?: string };
    check("a lane requested with no form is still a worktree sharing the repo's git",
      dflt.ok === true && dflt.form === "worktree"
      && lstatSync(`${dflt.cwd}/.git`).isFile()
      && realpathSync(commonDir(dflt.cwd ?? "")) === realpathSync(`${cRepo}/.git`),
      `form=${dflt.form} common=${commonDir(dflt.cwd ?? "")}`);
    const dfltSess = (await (await get("/api/sessions")).json()) as
      { slots: { id: number; worktree: { form?: string } | null }[] };
    check("...and it persists with no form field at all — today's shape, byte for byte",
      dfltSess.slots.find((x) => x.id === dflt.slot)?.worktree?.form === undefined,
      JSON.stringify(dfltSess.slots.find((x) => x.id === dflt.slot)?.worktree));
    await post(`/api/slots/${dflt.slot ?? 0}/kill`, {});
    spawnSync("git", ["-C", cRepo, "worktree", "remove", "--force", dflt.cwd ?? ""]);
    await setMergeMode("blocked");
  }
  // === THE LANE'S BATON: a lane whose context filled hands over on the SAME worktree ============
  // Until 2026-09-12 POST /api/self/succeed answered a lane 409 "a lane lands — it does not
  // migrate". Measured that day: Slot 7 ended a two-row wave at 48.7 % of a 1M window, its pane
  // stream carrying 111 suite-wrapper lines and 49 FAIL lines. A lane that full is in the worst
  // position to do the one thing that refusal told it to do. So it now hands the baton to a fresh
  // session on the same worktree, branch, slot and queue rows — and what this block proves is that
  // NOTHING ELSE moves: no land, no second worktree, no row status, and nothing at all when the
  // tree is dirty.
  {
    type BatonState = {
      slots?: Record<string, { selfToken?: string; openedAt?: number; taskId?: string | null;
        programId?: string | null; laneSuccessions?: number; worktree?: { branch?: string } | null }>;
      tasks?: { id: string; status: string; slot: number | null; programId?: string | null }[];
      programs?: Record<string, unknown>[];
    };
    const batonState = (): BatonState => JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as BatonState;
    const batonSlot = (id: number) => batonState().slots?.[String(id)];
    const selfGet = (token: string, path = "/api/self"): Promise<Response> =>
      fetch(BASE + path, { headers: { "x-fleet-self-token": token } });
    const selfPost = (token: string, path: string, body: unknown): Promise<Response> =>
      fetch(BASE + path, { method: "POST",
        headers: { "content-type": "application/json", "x-fleet-self-token": token },
        body: JSON.stringify(body) });

    const BATON_TASK_TEXT = "BATON FIXTURE: cut one of three — the relay's founding row, quoted back to the successor verbatim";
    const BATON_HANDOFF = "BATON HANDOFF: cut one committed and green; cut two is the parser; open number is the 3.4 s wrapper wait.";
    const lnRes = await post("/api/lanes", { repo: REPO });
    const ln = (await lnRes.json()) as { ok?: boolean; slot?: number; cwd?: string; branch?: string };
    const batonCwd = ln.cwd ?? "";
    const batonBranch = ln.branch ?? "";
    const batonSlotId = ln.slot ?? 0;
    check("baton setup: a lane for the succession fixture exists on disk",
      ln.ok === true && batonSlotId > 0 && batonBranch !== "" && exists(batonCwd), JSON.stringify(ln));
    const taskRes = await post("/api/tasks", { text: BATON_TASK_TEXT, queue: false });
    const batonTaskId = ((await taskRes.json()) as { task?: { id: string } }).task?.id ?? "";
    check("baton setup: the founding queue row exists", batonTaskId !== "", batonTaskId);

    // committed lane work — the successor inherits the BRANCH, so this is the state it must be shown
    writeFileSync(`${batonCwd}/baton.txt`, "cut one\n");
    spawnSync("git", ["-C", batonCwd, "add", "baton.txt"]);
    spawnSync("git", ["-C", batonCwd, "commit", "-qm", "baton: cut one of the relay"]);

    // …and what only the dispatcher writes: the row this lane holds and the Program it belongs to.
    // Planted through the state file exactly as the migration and acceptance-door fixtures do,
    // because no owner route binds an EXISTING lane to a row, and the subject of this block is the
    // handover, not the dispatch that would otherwise have to precede it.
    await stopSrv();
    const batonProgramId = "ba7017".padEnd(24, "0");
    const plant = batonState();
    const plantedAt = Date.now();
    plant.programs = [...(plant.programs ?? []), {
      id: batonProgramId, title: "Baton relay fixture", intent: "Prove a lane hands over on its own worktree",
      successCriterion: "A successor session continues the same branch", nonGoals: [],
      decisions: [], evidence: [], openQuestions: [], status: "active",
      createdAt: plantedAt - 1000, proposedBy: { kind: "owner" },
      confirmedAt: plantedAt - 900, activatedAt: plantedAt - 800,
    }];
    const plantedSlot = plant.slots?.[String(batonSlotId)];
    if (plantedSlot) { plantedSlot.taskId = batonTaskId; plantedSlot.programId = batonProgramId; }
    const plantedRow = plant.tasks?.find((t) => t.id === batonTaskId);
    if (plantedRow) { plantedRow.status = "sent"; plantedRow.slot = batonSlotId; plantedRow.programId = batonProgramId; }
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(plant, null, 2), { mode: 0o600 });
    await restartSrv();
    const batonTok = batonSlot(batonSlotId)?.selfToken ?? "";
    const batonOpenedAt = batonSlot(batonSlotId)?.openedAt ?? 0;
    check("baton setup: the lane carries its row and its Program, and its credential is readable",
      /^[0-9a-f]{32}$/.test(batonTok) && batonSlot(batonSlotId)?.taskId === batonTaskId
        && batonSlot(batonSlotId)?.programId === batonProgramId
        && batonState().tasks?.find((t) => t.id === batonTaskId)?.status === "sent",
      JSON.stringify({ task: batonSlot(batonSlotId)?.taskId, program: batonSlot(batonSlotId)?.programId,
        row: batonState().tasks?.find((t) => t.id === batonTaskId)?.status }));

    // A DIRTY TREE REFUSES, AND SPAWNS NOTHING. The successor inherits the branch and nothing else,
    // so an uncommitted line is not "unfinished work carried over" — it is work destroyed by a
    // handover that looked like it worked.
    writeFileSync(`${batonCwd}/baton-uncommitted.txt`, "this line would be lost\n");
    const dirtyRes = await selfPost(batonTok, "/api/self/succeed", {});
    const dirtyBody = (await dirtyRes.json()) as { error?: string; status?: string[] };
    check("(baton) a lane with an unclean tree is refused 409, and the porcelain lines come back with it",
      dirtyRes.status === 409 && (dirtyBody.error ?? "").includes("not clean")
        && (dirtyBody.status ?? []).some((l) => l.includes("baton-uncommitted.txt")),
      `${dirtyRes.status} ${JSON.stringify(dirtyBody).slice(0, 240)}`);
    check("(baton) …and that refusal spawned nothing: same occupant, same credential, no baton counted",
      batonSlot(batonSlotId)?.openedAt === batonOpenedAt
        && batonSlot(batonSlotId)?.selfToken === batonTok
        && (batonSlot(batonSlotId)?.laneSuccessions ?? 0) === 0,
      JSON.stringify(batonSlot(batonSlotId)).slice(0, 200));
    rmSync(`${batonCwd}/baton-uncommitted.txt`, { force: true });

    // THE HANDOVER DOCUMENT. `handoff` is the fourth report status and the only one that is not a
    // verdict: it moves no row, needs no HANDOFF.md commit, and lands in the Program's inbox beside
    // every other result of this lane.
    const handoffRes = await selfPost(batonTok, "/api/self/fleet-report",
      { status: "handoff", text: BATON_HANDOFF });
    const handoffBody = (await handoffRes.json()) as
      { ok?: boolean; report?: { id: string; status: string; basis: string }; inbox?: string };
    const programInbox = ((await (await get("/api/programs")).json()) as
      { programs: { id: string; inbox?: { entries: { id: string; kind: string; ref: string }[] } }[] })
      .programs.find((p) => p.id === batonProgramId)?.inbox;
    check("(baton) status `handoff` is accepted and filed into the Program inbox like any other result",
      handoffRes.ok && handoffBody.report?.status === "handoff" && handoffBody.report?.basis === "program"
        && (programInbox?.entries ?? []).some((e) => e.kind === "fleet-report" && e.ref === handoffBody.report?.id),
      `${handoffRes.status} ${JSON.stringify(handoffBody).slice(0, 200)} inbox=${JSON.stringify(programInbox?.entries ?? []).slice(0, 200)}`);
    check("(baton) the row the lane holds is untouched by the report — a report is a MESSAGE",
      batonState().tasks?.find((t) => t.id === batonTaskId)?.status === "sent",
      JSON.stringify(batonState().tasks?.find((t) => t.id === batonTaskId) ?? {}).slice(0, 160));

    // …and `carry` is refused rather than ignored: two handover channels can disagree, and nobody
    // could then say which one the successor obeyed.
    const carryRes = await selfPost(batonTok, "/api/self/succeed", { carry: "a second channel" });
    const carryText = await carryRes.text();
    check("(baton) a lane succession takes no carry — the handoff report is the one handover channel",
      carryRes.status === 409 && carryText.includes("takes no carry"),
      `${carryRes.status} ${carryText.slice(0, 200)}`);

    // THE HANDOVER ITSELF.
    const promptsBefore = (await plogRead()).filter((e) => e.slot === batonSlotId).length;
    const succeedRes = await selfPost(batonTok, "/api/self/succeed", {});
    const succeedBody = (await succeedRes.json()) as { ok?: boolean; slot?: number; branch?: string;
      successions?: number; session?: number; delivered?: boolean; error?: string };
    check("(baton) a clean lane succeeds into its OWN slot, on its own branch, counting the baton",
      succeedRes.ok && succeedBody.slot === batonSlotId && succeedBody.branch === batonBranch
        && succeedBody.successions === 1 && succeedBody.session === 2 && succeedBody.delivered === true,
      `${succeedRes.status} ${JSON.stringify(succeedBody)}`);
    const after = batonSlot(batonSlotId);
    check("(baton) the successor is a NEW session on the SAME lane: worktree, row and Program held, credential and occupant rotated",
      after?.worktree?.branch === batonBranch && after?.taskId === batonTaskId
        && after?.programId === batonProgramId && after?.laneSuccessions === 1
        && after?.openedAt !== batonOpenedAt && after?.selfToken !== batonTok
        && exists(batonCwd),
      JSON.stringify(after).slice(0, 240));
    // THE LINE, SESSION BY SESSION (the bar's #band=d hover): session 1 is the predecessor — it
    // began at the occupant's openedAt and its handoff report is the one filed just above.
    const chainRes = await get(`/api/slots/${batonSlotId}/succession`);
    const chain = (await chainRes.json()) as { session?: number;
      past?: { session: number; startedAt: number | null; handedAt: number | null; report: string | null }[] };
    check("(baton) GET /api/slots/:id/succession names the predecessor: its begin, its handover, its handoff report",
      chainRes.ok && chain.session === 2 && chain.past?.length === 1 && chain.past[0]?.session === 1
        && chain.past[0]?.startedAt === batonOpenedAt && chain.past[0]?.report === handoffBody.report?.id
        && typeof chain.past[0]?.handedAt === "number" && chain.past[0].handedAt >= batonOpenedAt,
      `${chainRes.status} ${JSON.stringify(chain).slice(0, 240)}`);
    const noChain = await get("/api/slots/0/succession");
    check("(baton) GET /api/slots/:id/succession refuses a slot that is not one (400), never an empty line",
      noChain.status === 400, String(noChain.status));

    // THE BAND'S READ OF A PAST SESSION — GET /api/slots/:id/succession/:n/transcript. The identity
    // is the handoff report's worker.sessionId + cwd and NOTHING ELSE: a past session whose report
    // names no session is "nicht zugeordnet", never the newest file of its cwd. Each check below
    // turns red on the one violation it names: a route that guessed by cwd would hand back entries
    // in (1) and on the main in (4); a route keyed on something other than the report's sessionId
    // would miss the planted file in (3); a route that served the RUNNING session as a past one
    // would answer n=2 in (2).
    {
      type PastBody = { assigned?: boolean; reason?: string; entries?: { role: string }[]; source?: string | null;
        session?: number; report?: string | null; ctx?: { usedTokens: number; windowTokens: number; pct: number } | null;
        error?: string };
      const pastOf = async (id: number, n: number): Promise<{ status: number; body: PastBody }> => {
        const r = await get(`/api/slots/${id}/succession/${n}/transcript`);
        return { status: r.status, body: (await r.json()) as PastBody };
      };
      type ReportRow = { id: string; worker: { sessionId: string | null; cwd: string } };
      const reportRow = (): ReportRow | undefined => (batonState() as { fleetReports?: ReportRow[] }).fleetReports
        ?.find((r) => r.id === handoffBody.report?.id);
      // (1) FLEET_CMD=true pins no session, so the report names none — the premise is asserted too
      const bare = await pastOf(batonSlotId, 1);
      check("(band) a past session whose handoff report names no session is 'nicht zugeordnet' — no file is guessed from its cwd",
        reportRow()?.worker.sessionId === null && bare.status === 200 && bare.body.assigned === false
          && (bare.body.reason ?? "").includes("nicht zugeordnet") && (bare.body.entries ?? []).length === 0
          && bare.body.report === handoffBody.report?.id,
        `${bare.status} ${JSON.stringify(bare.body).slice(0, 240)} sid=${reportRow()?.worker.sessionId}`);
      // (2) only a PAST session of the line: 0, the running session (2) and beyond are 404
      const outOfLine = await Promise.all([0, 2, 9].map(async (n) => (await get(`/api/slots/${batonSlotId}/succession/${n}/transcript`)).status));
      check("(band) n that is not a past session of the line — 0, the running one, beyond — answers 404",
        outOfLine.every((c) => c === 404), JSON.stringify(outOfLine));

      // (3) + (4): plant a session on the report and its transcript on disk, and a one-record line on
      // a MAIN — through the state file, with the server stopped, as the fixtures above do
      await stopSrv();
      const sid = crypto.randomUUID();
      const USED = 123_456;
      const proj = `${process.env.HOME}/.claude/projects/${batonCwd.replace(/[^a-zA-Z0-9]/g, "-")}`;
      mkdirSync(proj, { recursive: true });
      writeFileSync(`${proj}/${sid}.jsonl`, [
        { type: "user", timestamp: new Date().toISOString(), message: { content: "BAND PROBE: what did the predecessor say?" } },
        { type: "assistant", timestamp: new Date().toISOString(), message: { content: [{ type: "text", text: "BAND PROBE: the answer" }],
          usage: { input_tokens: USED, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 } } },
      ].map((l) => JSON.stringify(l)).join("\n") + "\n");
      const lineageId = "ba4d".padEnd(24, "0");
      const bandPlant = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as { fleetReports?: ReportRow[];
        slots?: Record<string, { cwd?: string | null; worktree?: unknown; openedAt?: number; lineageId?: string | null }>;
        lineageHandovers?: { lineageId: string }[] };
      const pr = bandPlant.fleetReports?.find((r) => r.id === handoffBody.report?.id);
      if (pr) pr.worker.sessionId = sid;
      // a main with no line of its own: the planted record must be the only one it has
      const mainEntry = Object.entries(bandPlant.slots ?? {}).find(([, x]) => x.cwd && !x.worktree && x.openedAt && !x.lineageId);
      const mainId = mainEntry ? Number(mainEntry[0]) : 0;
      const mainOpened = mainEntry?.[1].openedAt ?? 0;
      if (mainEntry) {
        mainEntry[1].lineageId = lineageId;
        bandPlant.lineageHandovers = [...(bandPlant.lineageHandovers ?? []), { v: 1, lineageId, role: "generic",
          at: mainOpened, from: { slot: mainId, openedAt: mainOpened - 3_600_000 }, to: { slot: mainId, openedAt: mainOpened },
          obligations: [], intent: "band probe", pointer: null, supersededBy: null } as { lineageId: string }];
      }
      writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(bandPlant, null, 2), { mode: 0o600 });
      await restartSrv();
      const named = await pastOf(batonSlotId, 1);
      const ctx = named.body.ctx ?? null;
      check("(band) a lane's past session is read through the session its handoff report names — its entries and its ctx at the handover",
        named.status === 200 && named.body.assigned === true && named.body.source === `${sid}.jsonl`
          && (named.body.entries ?? []).map((e) => e.role).join(",") === "user,assistant"
          && ctx !== null && ctx.usedTokens === USED && ctx.windowTokens > 0
          && ctx.pct === Math.round((USED / ctx.windowTokens) * 1000) / 10,
        `${named.status} ${JSON.stringify({ ...named.body, entries: named.body.entries?.length }).slice(0, 300)}`);
      const chainNow = (await (await get(`/api/slots/${batonSlotId}/succession`)).json()) as { past?: { ctx: unknown }[] };
      check("(band) the line itself carries that ctx per past session, for the band's cells",
        JSON.stringify(chainNow.past?.[0]?.ctx) === JSON.stringify(ctx), JSON.stringify(chainNow).slice(0, 240));
      const mainPast = mainId ? await pastOf(mainId, 1) : { status: 0, body: {} as PastBody };
      check("(band) a MAIN's past session on an OLD lineage record (slot + openedAt only, written before `from` named a session) stays the honest empty state — no backfill",
        mainId > 0 && mainPast.status === 200 && mainPast.body.assigned === false
          && (mainPast.body.reason ?? "").includes("nicht zugeordnet") && (mainPast.body.entries ?? []).length === 0,
        `main=${mainId} ${mainPast.status} ${JSON.stringify(mainPast.body).slice(0, 240)}`);

      // (5) THE SEAT: the succession wrote the leaving occupant onto the slot itself (Slot.laneSeats),
      // because the report is pruned and the seat is not. FLEET_CMD=true had no session to give, so the
      // seat says null; with the pair moved from the report onto the seat, the band must still find the
      // file — a route that read only the report would answer "nicht zugeordnet" here.
      type SeatRow = { openedAt: number; handedAt: number; sessionId: string | null; cwd: string };
      await stopSrv();
      const seatPlant = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as typeof bandPlant
        & { slots?: Record<string, { laneSeats?: SeatRow[] }> };
      const seats = seatPlant.slots?.[String(batonSlotId)]?.laneSeats ?? [];
      check("(band) a lane succession leaves the leaving occupant's seat on the slot: its begin, the handover, its cwd, and null for no session",
        seats.length === 1 && seats[0]?.openedAt === batonOpenedAt && seats[0].sessionId === null && seats[0].cwd === batonCwd
          && seats[0].handedAt >= batonOpenedAt,
        JSON.stringify(seats));
      const seatReport = seatPlant.fleetReports?.find((r) => r.id === handoffBody.report?.id);
      if (seatReport) seatReport.worker.sessionId = null;
      if (seats[0]) seats[0].sessionId = sid;
      writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(seatPlant, null, 2), { mode: 0o600 });
      await restartSrv();
      const bySeat = await pastOf(batonSlotId, 1);
      check("(band) the seat's pair outlives the report's: with the report naming no session, the band still reads the predecessor's file",
        bySeat.status === 200 && bySeat.body.assigned === true && bySeat.body.source === `${sid}.jsonl`
          && bySeat.body.report === handoffBody.report?.id,
        `${bySeat.status} ${JSON.stringify({ ...bySeat.body, entries: bySeat.body.entries?.length }).slice(0, 240)}`);

      // un-plant: the line on the main, the seat's session and the file; the report goes with the block's own cleanup below
      await stopSrv();
      const bandUnplant = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as typeof seatPlant;
      for (const seat of bandUnplant.slots?.[String(batonSlotId)]?.laneSeats ?? []) seat.sessionId = null;
      bandUnplant.lineageHandovers = (bandUnplant.lineageHandovers ?? []).filter((r) => r.lineageId !== lineageId);
      if (mainId && bandUnplant.slots?.[String(mainId)]) delete bandUnplant.slots[String(mainId)]!.lineageId;
      writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(bandUnplant, null, 2), { mode: 0o600 });
      rmSync(`${proj}/${sid}.jsonl`, { force: true });
      await restartSrv();
    }
    const oldTokenNow = (await selfGet(batonTok)).status;
    check("(baton) the predecessor's credential went with its session — the old token authenticates nothing",
      oldTokenNow === 401, String(oldTokenNow));
    const heirTok = after?.selfToken ?? "";
    const heirSelf = (await (await selfGet(heirTok)).json()) as
      { slot?: number; lane?: { repo: string; branch: string } | null };
    check("(baton) GET /api/self of the successor names the SAME lane it inherited",
      heirSelf.slot === batonSlotId && heirSelf.lane?.branch === batonBranch
        && typeof heirSelf.lane?.repo === "string",
      JSON.stringify(heirSelf).slice(0, 200));
    check("(baton) the queue row never left the lane — still `sent`, still pointing at this slot",
      batonState().tasks?.find((t) => t.id === batonTaskId)?.status === "sent"
        && batonState().tasks?.find((t) => t.id === batonTaskId)?.slot === batonSlotId,
      JSON.stringify(batonState().tasks?.find((t) => t.id === batonTaskId) ?? {}).slice(0, 160));

    const heirPrompts = (await plogRead()).filter((e) => e.slot === batonSlotId);
    const heirBrief = heirPrompts.length > promptsBefore ? heirPrompts[heirPrompts.length - 1]!.text : "";
    check("(baton) the successor's FIRST prompt carries the brief, its own git log, the clean-tree proof, the handoff text and the exit footer",
      heirBrief.includes(BATON_TASK_TEXT) && heirBrief.includes("baton: cut one of the relay")
        && heirBrief.includes("git status --porcelain") && heirBrief.includes(BATON_HANDOFF)
        && heirBrief.includes("HOW THIS LANE ENDS") && heirBrief.includes(batonBranch),
      JSON.stringify(heirBrief).slice(0, 400));

    // …and /retire is untouched by all of this: retiring would end the session and leave the
    // committed work as an orphan worktree, so a lane still has exactly one exit there.
    const laneRetire = await selfPost(heirTok, "/api/self/retire", {});
    const laneRetireText = await laneRetire.text();
    check("(baton) /api/self/retire still answers a lane 409 — it lands, it does not migrate",
      laneRetire.status === 409 && laneRetireText.includes("a lane lands"),
      `${laneRetire.status} ${laneRetireText.slice(0, 160)}`);

    // …and what the LEDGER says about a lane that took two sessions. The kill is the teardown this
    // fixture needs anyway, and it is the cheapest disposition that writes a row: `successions` is
    // the only field on it that can say the lane spanned more than one conversation, because
    // sessionMs measures the LAST session alone — which is exactly why it must be on the row and
    // not inferred from the count of prompts in a pane nobody keeps.
    await post(`/api/slots/${batonSlotId}/kill`, {});
    const batonOutcome = ((await (await get("/api/lane-outcomes?limit=1000")).json()) as
      { outcomes: { branch: string; disposition: string; successions?: number; commitCount: number }[] })
      .outcomes.find((o) => o.branch === batonBranch);
    check("(baton) the outcome row counts the batons — one lane, two sessions, one commit",
      batonOutcome?.successions === 1 && batonOutcome.commitCount === 1
        && batonOutcome.disposition === "killed-dirty",
      JSON.stringify(batonOutcome ?? null).slice(0, 240));
    spawnSync("git", ["-C", REPO, "worktree", "remove", "--force", batonCwd]);
    await post(`/api/tasks/${batonTaskId}/delete`, {});
    // …AND THE PLANTED RECORDS GO BACK OUT THE WAY THEY CAME IN. This is not tidiness: an active
    // Program rides the 2 s /api/sessions poll as a digest FOREVER, and that payload is measured
    // against a 14 KiB budget by e2e/tasks.ts — which runs after this file. Measured on the run
    // that first left them standing (2026-09-12): 14 631 B against 14 336 B. A fixture that makes
    // a later section's budget check fail is a fixture that has to be un-planted, not a budget
    // that has to be raised. The report row goes with it for the same reason it exists here: it is
    // the planted Program's, it counts into `reportsAwaitingOwner` once that Program has no live
    // MAIN, and nothing outside this block ever reads it.
    await stopSrv();
    const unplant = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
      { programs?: { id: string }[]; fleetReports?: { id: string }[] };
    unplant.programs = (unplant.programs ?? []).filter((p) => p.id !== batonProgramId);
    unplant.fleetReports = (unplant.fleetReports ?? []).filter((r) => r.id !== (handoffBody.report?.id ?? ""));
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(unplant, null, 2), { mode: 0o600 });
    await restartSrv();
    const remaining = ((await (await get("/api/programs")).json()) as
      { programs: { id: string }[] }).programs;
    check("(baton) fixture cleanup: the planted Program is gone — the 2 s poll must not carry a fixture for the rest of the suite",
      !remaining.some((p) => p.id === batonProgramId), `${remaining.length} program(s) left`);
  }

  // === THE REVIEW PARK: a finished lane set aside for a LATER owner review, slot freed, identity kept ==
  // (docs/messungen/2026-09-23-worktree-lebenszyklus.md §3, corrected: a park that frees the slot, not
  // a halt that holds it). What each check below turns red on: a park that admits an unaccepted or
  // dirty lane; rows that go back to pending/queued (the old detach) or come back after a restart
  // (the boot requeue); a board without the identity; a resume that forgets the rows, keeps the old
  // verify as current, or seats the tree twice; and a plain shelve that changed on the way.
  {
    type RpRow = { id: string; status: string; slot: number | null; note?: string | null; programId?: string | null };
    type RpCandidate = { id: string; parkedAt: number; expiresAt: number; expired?: boolean; branch: string; head: string;
      base: string | null; baseSha: string | null; taskIds: string[]; taskId: string | null; programId: string | null; reportId: string };
    type RpState = {
      slots?: Record<string, { selfToken?: string; openedAt?: number; sessionId?: string | null; taskId?: string | null;
        programId?: string | null; worktree?: { branch?: string; resumedFrom?: Record<string, unknown> } | null }>;
      tasks?: RpRow[]; programs?: Record<string, unknown>[];
      fleetReports?: { id: string; worker: { sessionId: string | null }; decision?: unknown }[];
      shelved?: Record<string, { note: string; at?: number; review?: RpCandidate }>;
      worktreeNotes?: Record<string, string>;
      lanePreviews?: Record<string, unknown>;
      candidateReviews?: Record<string, unknown>;
    };
    type PvView = { id: string; candidate: string; head: string; state: string; url: string | null; expiresAt: number;
      endedAt: number | null; why: string | null; laneHead: string | null; stale: boolean | null };
    type CrRec = { id: string; candidate: string; head: string; base: string; patchId: string; at: number | null;
      state: string; why: string | null; scope: string; notes: string; raw: boolean | null;
      findings: { title: string; impact: string }[]; patchNow?: string | null; stale?: boolean | null };
    type RpBoard = { path: string; slot: number | null; note: string | null; notepad?: string | null;
      review?: RpCandidate | null; preview?: PvView | null; reviews?: CrRec[] | null };
    const rpState = (): RpState => JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as RpState;
    // the rows through the API, not the state file: a queued save may still be in flight after a response
    const rpRows = async (ids: string[]): Promise<(RpRow | undefined)[]> => {
      const all = ((await (await get("/api/tasks")).json()) as { tasks: RpRow[] }).tasks;
      return ids.map((id) => all.find((t) => t.id === id));
    };
    const rpSelfPost = (token: string, path: string, body: unknown): Promise<Response> =>
      fetch(BASE + path, { method: "POST",
        headers: { "content-type": "application/json", "x-fleet-self-token": token }, body: JSON.stringify(body) });
    const rpSessions = async () => ((await (await get("/api/sessions")).json()) as
      { slots: { id: number; cwd: string | null; worktree?: { branch: string; resumedFrom?: Record<string, unknown> } | null }[] }).slots;
    const rpLane = (await (await post("/api/lanes", { repo: REPO })).json()) as { ok?: boolean; slot?: number; cwd?: string; branch?: string };
    const rpSlot = rpLane.slot ?? 0;
    const rpCwd = rpLane.cwd ?? "";
    const rpBoard = async (): Promise<RpBoard | undefined> =>
      ((await (await get(`/api/slots/${lc.lnSlot}/worktrees`)).json()) as { worktrees: RpBoard[] }).worktrees.find((w) => w.path === rpCwd);
    const rpIds: string[] = [];
    for (const text of ["REVIEW PARK FIXTURE: the founding row", "REVIEW PARK FIXTURE: the wave follower"])
      rpIds.push(((await (await post("/api/tasks", { text, queue: false })).json()) as { task?: { id: string } }).task?.id ?? "");
    writeFileSync(`${rpCwd}/review-park.txt`, "finished work\n");
    // …and what makes its head PREVIEWABLE (lane-preview.sh wants server.ts, package.json and a
    // build): a stub server that answers on the port it was given and writes down the environment it
    // was started with, so the isolation checks read the instance's real env rather than a promise
    const rpPkg = JSON.parse(readFileSync(`${rpCwd}/package.json`, "utf8")) as Record<string, unknown>;
    writeFileSync(`${rpCwd}/package.json`, JSON.stringify({ ...rpPkg, scripts: { build: "mkdir -p public && echo built > public/built.txt" } }) + "\n");
    writeFileSync(`${rpCwd}/server.ts`, [
      'import { writeFileSync } from "node:fs";',
      "const e = process.env;",
      "writeFileSync(\"seen-env.json\", JSON.stringify({ keys: Object.keys(e).filter((k) => k.startsWith(\"FLEET_\")).sort(),",
      "  token: e.FLEET_TOKEN ?? null, sock: e.FLEET_SOCK ?? null, port: e.FLEET_PORT ?? null, cmd: e.FLEET_CMD ?? null, home: e.HOME ?? null }));",
      "Bun.serve({ hostname: e.FLEET_HOST, port: Number(e.FLEET_PORT), fetch: () => new Response(\"preview stub\") });",
      "",
    ].join("\n"));
    spawnSync("git", ["-C", rpCwd, "add", "review-park.txt", "package.json", "server.ts"]);
    spawnSync("git", ["-C", rpCwd, "commit", "-qm", "review park: the finished cut"]);
    const rpHead = spawnSync("git", ["-C", rpCwd, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
    await stopSrv();
    const rpProgramId = "7e71e0".padEnd(24, "0");
    const rpPlant = rpState();
    const rpAt = Date.now();
    rpPlant.programs = [...(rpPlant.programs ?? []), {
      id: rpProgramId, title: "Review park fixture", intent: "Prove a finished lane parks for review",
      successCriterion: "The parked lane resumes with its rows", nonGoals: [], decisions: [], evidence: [],
      openQuestions: [], status: "active", createdAt: rpAt - 1000, proposedBy: { kind: "owner" },
      confirmedAt: rpAt - 900, activatedAt: rpAt - 800,
    }];
    const rpSl = rpPlant.slots?.[String(rpSlot)];
    if (rpSl) { rpSl.taskId = rpIds[0]; rpSl.programId = rpProgramId; }
    for (const row of rpPlant.tasks ?? [])
      if (rpIds.includes(row.id)) { row.status = "sent"; row.slot = rpSlot; row.programId = rpProgramId; }
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(rpPlant, null, 2), { mode: 0o600 });
    await restartSrv();
    const rpTok = rpState().slots?.[String(rpSlot)]?.selfToken ?? "";
    check("review park setup: a committed lane carries two sent rows and a Program",
      rpLane.ok === true && rpSlot > 0 && exists(rpCwd) && /^[0-9a-f]{40}$/.test(rpHead) && /^[0-9a-f]{32}$/.test(rpTok)
        && (await rpRows(rpIds)).every((t) => t?.status === "sent" && t.slot === rpSlot),
      JSON.stringify({ lane: rpLane, rows: (await rpRows(rpIds)) }));

    const park = (body: Record<string, unknown>) => post(`/api/slots/${rpSlot}/shelve`, { note: "review me", review: true, ...body });
    const noReport = await park({});
    check("(review park) refused without a report — nothing parked, the slot still holds the lane",
      noReport.status === 409 && (await noReport.text()).includes("filed no report")
        && (await rpSessions()).find((x) => x.id === rpSlot)?.cwd === rpCwd, String(noReport.status));
    const repRes = await rpSelfPost(rpTok, "/api/self/fleet-report", { status: "complete", text: "REVIEW PARK FIXTURE: done and verified." });
    const rpReportId = ((await repRes.json()) as { report?: { id: string } }).report?.id ?? "";
    const undecided = await park({});
    check("(review park) refused while the MAIN has not accepted the report",
      repRes.ok && undecided.status === 409 && (await undecided.text()).includes("undecided"), `${repRes.status} ${undecided.status}`);
    // the acceptance planted as the program MAIN's verdict: the subject here is the park, not the decision door
    await stopSrv();
    const rpDecide = rpState();
    const rpRep = rpDecide.fleetReports?.find((r) => r.id === rpReportId);
    if (rpRep) rpRep.decision = { disposition: "accepted", at: Date.now(), by: { slot: 3, openedAt: rpAt - 500, sessionId: null },
      reason: null, fulfilled: null };
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(rpDecide, null, 2), { mode: 0o600 });
    await restartSrv();
    writeFileSync(`${rpCwd}/review-park-dirty.txt`, "uncommitted\n");
    const dirty = await park({});
    const dirtyText = await dirty.text();
    rmSync(`${rpCwd}/review-park-dirty.txt`, { force: true });
    check("(review park) refused on an unclean tree, naming the file",
      dirty.status === 409 && dirtyText.includes("not clean") && dirtyText.includes("review-park-dirty.txt"), `${dirty.status} ${dirtyText.slice(0, 160)}`);
    check("(review park) a malformed deadline is a 400, not a default",
      (await park({ hours: 0 })).status === 400 && (await park({ hours: "2" })).status === 400);
    check("(review park) every refusal left the lane and its rows exactly as they were",
      (await rpSessions()).find((x) => x.id === rpSlot)?.cwd === rpCwd
        && (await rpRows(rpIds)).every((t) => t?.status === "sent" && t.slot === rpSlot) && !rpState().shelved?.[rpCwd],
      JSON.stringify((await rpRows(rpIds))));

    // === THE OWNER'S NOTEPAD on this worktree (owner 2026-09-23/24): one free text per PATH that
    // rides review park, resume and restart, capped with a named refusal, the owner's alone. What
    // each check turns red on: a save the board cannot read back; a cap the server evicts or
    // truncates instead of refusing; a text a lane's self token can read or write; a park, a
    // restart or a resume that loses it; a discarded tree whose note stays behind as an orphan.
    const noteText = "NOTEPAD FIXTURE: langfristig arbeiten — bleibt über Park und Neustart";
    const notePost = (text: string): Promise<Response> =>
      post("/api/worktrees/note", { repo: REPO, path: rpCwd, text });
    const noteSave = await notePost(noteText);
    const noteSavedBoard = await rpBoard();
    check("(notepad) the owner saves a note on the live lane's worktree and the board row carries it back",
      noteSave.ok && noteSavedBoard?.notepad === noteText, `${noteSave.status} ${JSON.stringify(noteSavedBoard)}`);
    const overRes = await notePost("x".repeat(20_001));
    const overBody = await overRes.text();
    check("(notepad) a note above the 20000-character cap is refused by name and the stored note survives whole",
      overRes.status === 400 && overBody.includes("20000") && (await rpBoard())?.notepad === noteText,
      `${overRes.status} ${overBody.slice(0, 120)}`);
    const atCapRes = await notePost("y".repeat(20_000));
    check("(notepad) exactly 20000 characters are accepted", atCapRes.ok && (await rpBoard())?.notepad?.length === 20_000,
      String(atCapRes.status));
    await notePost(noteText); // the small survival note rides the park/resume/restart checks below
    const selfWriteHdr = await fetch(BASE + "/api/worktrees/note", { method: "POST",
      headers: { "content-type": "application/json", "x-fleet-self-token": rpTok },
      body: JSON.stringify({ repo: REPO, path: rpCwd, text: "the lane wrote this" }) });
    const selfWriteBearer = await fetch(BASE + "/api/worktrees/note", { method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${rpTok}` },
      body: JSON.stringify({ repo: REPO, path: rpCwd, text: "the lane wrote this" }) });
    const selfRead = await fetch(BASE + `/api/slots/${lc.lnSlot}/worktrees`, { headers: { authorization: `Bearer ${rpTok}` } });
    check("(notepad) a lane's self token can neither write (header or bearer) nor read the note — 401 every way, text unchanged",
      selfWriteHdr.status === 401 && selfWriteBearer.status === 401 && selfRead.status === 401
        && (await rpBoard())?.notepad === noteText,
      `${selfWriteHdr.status}/${selfWriteBearer.status}/${selfRead.status}`);

    // THE PARK
    const parkRes = await park({ hours: 2 });
    const parked = ((await parkRes.json()) as { ok?: boolean; candidate?: RpCandidate }).candidate;
    check("(review park) an accepted, clean lane parks as ONE candidate with rows, branch, head, base, report and deadline",
      parkRes.ok && !!parked && /^[0-9a-f]{12}$/.test(parked.id) && parked.branch === rpLane.branch && parked.head === rpHead
        && typeof parked.base === "string" && parked.base !== "" && /^[0-9a-f]{40}$/.test(parked.baseSha ?? "")
        && JSON.stringify([...parked.taskIds].sort()) === JSON.stringify([...rpIds].sort()) && parked.taskId === rpIds[0]
        && parked.reportId === rpReportId && parked.expiresAt - parked.parkedAt === 2 * 3_600_000,
      JSON.stringify(parked));
    check("(review park) the slot is free and the worktree with its commit stays on disk",
      (await rpSessions()).find((x) => x.id === rpSlot)?.cwd === null && exists(`${rpCwd}/review-park.txt`));
    check("(review park) the rows stay SENT with no slot — not handed back to pending or queued",
      (await rpRows(rpIds)).every((t) => t?.status === "sent" && t.slot === null && (t.note ?? "").includes(parked?.id ?? "-")),
      JSON.stringify((await rpRows(rpIds))));
    const rpDispatch = await post(`/api/tasks/${rpIds[0]}/dispatch`, {});
    const rpQueue = await post(`/api/tasks/${rpIds[1]}/queue`, {});
    const rpUnqueue = await post(`/api/tasks/${rpIds[0]}/unqueue`, {});
    check("(review park) no door can start a parked row again: dispatch, queue and unqueue all refuse",
      rpDispatch.status === 409 && rpQueue.status === 409 && rpUnqueue.status === 409
        && (await rpRows(rpIds)).every((t) => t?.status === "sent" && t.slot === null),
      `${rpDispatch.status} ${rpQueue.status} ${rpUnqueue.status} ${JSON.stringify((await rpRows(rpIds)))}`);
    const board1 = await rpBoard();
    check("(review park) the board shows the candidate's identity on the orphan",
      board1?.slot === null && board1.note === "review me" && board1.review?.id === parked?.id
        && board1.review?.head === rpHead && board1.review?.reportId === rpReportId && board1.review?.expired === false
        && board1.review?.taskIds.length === 2, JSON.stringify(board1));
    check("(notepad) the note rides the review park — the parked row still carries it",
      board1?.notepad === noteText, (board1?.notepad ?? "null").slice(0, 60));

    // === THE REVIEW PREVIEW of this candidate (lane-preview.sh, server.ts#startLanePreview): one
    // time-boxed isolated instance of the STORED head. What turns each check red: a start that copies
    // the working tree or its .env, an instance that inherits this server's token/socket/port/HOME, a
    // second preview of one candidate or one past the budget, a stop or deadline that leaves the URL
    // answering, a lane head that moved without the record saying so, and a boot that re-arms a
    // preview whose deadline passed while the server was down.
    {
      type PvRec = { id: string; candidate: string; head: string; port: number; dir: string; sock: string;
        state: string; url?: string; token?: string; expiresAt: number; why: string | null };
      const reach = (u: string): Promise<string | null> =>
        fetch(u, { signal: AbortSignal.timeout(2000) }).then((r) => r.text()).catch(() => null);
      const gone = async (u: string, what: string): Promise<boolean> => {
        try { await until(async () => (await reach(u)) === null, { timeoutMs: 8000, what }); return true; }
        catch (e) { if (e instanceof UntilTimeout) return false; throw e; }
      };
      const pvStart = async (cand: string) => {
        const r = await post(`/api/review-candidates/${cand}/preview`, {});
        return { status: r.status, body: (await r.json().catch(() => ({}))) as { ok?: boolean; preview?: PvRec; error?: string } };
      };
      // a SECOND candidate, planted: its own worktree at the same head, parked by record — the
      // budget refusal needs two candidates, and the subject here is the preview, not the park door
      const pvbPath = `${rpCwd}-pvb`;
      const pvbBranch = `fleet/pvb-${Date.now()}`;
      spawnSync("git", ["-C", REPO, "worktree", "add", "-q", "-b", pvbBranch, pvbPath, rpHead]);
      const pvbId = "b0b0b0b0b0b0";
      await stopSrv();
      const pvPlant = rpState();
      pvPlant.shelved = { ...(pvPlant.shelved ?? {}), [pvbPath]: { note: "preview budget fixture", at: Date.now(),
        review: { id: pvbId, parkedAt: Date.now(), expiresAt: Date.now() + 3_600_000, branch: pvbBranch, head: rpHead,
          base: "main", baseSha: null, taskIds: ["pvb-fixture-row"], taskId: null, originId: null, programId: null, reportId: "pvb-fixture-report" } as RpCandidate } };
      writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(pvPlant, null, 2), { mode: 0o600 });
      await restartSrv({ FLEET_LANE_PREVIEW_MAX: "1", FLEET_LANE_PREVIEW_TTL_MS: "600000" });
      const cand = parked?.id ?? "";
      check("(preview) setup: the lane worktree carries a .env the copy must NOT take, and a second candidate is on the board",
        exists(`${rpCwd}/.env`) && exists(pvbPath) && (await rpBoard())?.review?.id === cand,
        JSON.stringify({ env: exists(`${rpCwd}/.env`), pvb: exists(pvbPath) }));
      const pvbNote = "pvb notepad fixture — geht mit dem Baum weg";
      const pvbSaved = await post("/api/worktrees/note", { repo: REPO, path: pvbPath, text: pvbNote });
      check("(notepad) the second candidate's worktree carries a note of its own",
        pvbSaved.ok && rpState().worktreeNotes?.[pvbPath] === pvbNote, String(pvbSaved.status));

      const a = await pvStart(cand);
      const pa = a.body.preview;
      check("(preview) a start answers ONE running record of the candidate's stored head on a band port, own socket, deadline set",
        a.status === 200 && pa?.candidate === cand && pa.head === rpHead && pa.state === "running"
          && pa.port >= 25400 && pa.port < 25420 && pa.port !== PORT && pa.sock !== SOCK && /^fleetpv[0-9a-f]{12}$/.test(pa.sock)
          && pa.token === undefined && pa.expiresAt - Date.now() > 500_000,
        `${a.status} ${JSON.stringify(a.body).slice(0, 400)}`);
      const url = pa?.url ?? "";
      check("(preview) the URL answers — the instance is up", (await reach(url)) === "preview stub", url.replace(/token=.*/, "token=…"));
      const seen = (() => {
        try { return JSON.parse(readFileSync(`${pa?.dir ?? "-"}/tree/seen-env.json`, "utf8")) as
          { keys: string[]; token: string | null; sock: string | null; port: string | null; cmd: string | null; home: string | null }; }
        catch { return null; }
      })();
      check("(preview) the copy is the tracked head only: no .env, no working-tree file, the stored server.ts",
        !!pa && exists(`${pa.dir}/tree/server.ts`) && !exists(`${pa.dir}/tree/.env`)
          && readFileSync(`${pa.dir}/tree/review-park.txt`, "utf8") === "finished work\n", pa?.dir);
      check("(preview) the instance runs on its OWN token, socket, port and HOME — nothing of this server's env reaches it",
        !!seen && !!seen.token && seen.token !== TOKEN && url.includes(seen.token) && seen.sock === pa?.sock
          && seen.port === String(pa?.port) && seen.cmd === "true" && (seen.home ?? "").startsWith(pa?.dir ?? "-")
          && !seen.keys.some((k) => k.startsWith("FLEET_SELF_") || k.startsWith("FLEET_STEWARD") || k === "FLEET_VERIFY_CMD" || k.startsWith("FLEET_E2E_")),
        JSON.stringify({ ...seen, token: seen?.token ? "<set>" : null }));
      const b1 = await rpBoard();
      check("(preview) the board row names candidate, commit, URL and deadline, and the head is current",
        b1?.preview?.candidate === cand && b1.preview.head === rpHead && b1.preview.url === url && b1.preview.state === "running"
          && b1.preview.expiresAt === pa?.expiresAt && b1.preview.stale === false && b1.preview.laneHead === rpHead,
        JSON.stringify({ ...b1?.preview, url: b1?.preview?.url ? "<set>" : null }));

      const again = await pvStart(cand);
      check("(preview) a second preview of the SAME candidate is refused, naming the running one",
        again.status === 409 && (again.body.error ?? "").includes("already has preview") && (again.body.error ?? "").includes(pa?.id ?? "-"),
        `${again.status} ${again.body.error}`);
      const over = await pvStart(pvbId);
      check("(preview) a preview past the fleet-wide budget is refused, naming the budget",
        over.status === 409 && (over.body.error ?? "").includes("budget") && (over.body.error ?? "").includes("1 of 1"),
        `${over.status} ${over.body.error}`);

      // THE HEAD MOVES under the candidate: the record is stale while it differs — and only then
      writeFileSync(`${rpCwd}/moved.txt`, "a later commit\n");
      spawnSync("git", ["-C", rpCwd, "add", "moved.txt"]);
      spawnSync("git", ["-C", rpCwd, "commit", "-qm", "moved after the park"]);
      const moved = spawnSync("git", ["-C", rpCwd, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
      const b2 = await rpBoard();
      spawnSync("git", ["-C", rpCwd, "reset", "-q", "--hard", rpHead]);
      const b3 = await rpBoard();
      check("(preview) a lane head that moved off the stored head marks the preview stale, and back on it is current again",
        moved !== rpHead && b2?.preview?.stale === true && b2.preview.laneHead === moved && b2.preview.head === rpHead
          && b3?.preview?.stale === false,
        JSON.stringify({ moved: b2?.preview?.stale, back: b3?.preview?.stale }));

      // THE STOP
      const stop = await post(`/api/review-candidates/${cand}/preview/stop`, {});
      const stopped = ((await stop.json().catch(() => ({}))) as { preview?: PvRec }).preview;
      check("(preview) stop ends it: URL unreachable, scratch copy and socket gone, record says stopped",
        stop.ok && stopped?.state === "stopped" && (await gone(url, "stopped preview unreachable")) && !exists(pa?.dir ?? "-")
          && spawnSync("tmux", ["-L", pa?.sock ?? "-", "has-session"]).status !== 0,
        `${stop.status} ${String(JSON.stringify(stopped)).slice(0, 300)}`);
      const b4 = await rpBoard();
      check("(preview) the board keeps the ended record, without a URL",
        b4?.preview?.state === "stopped" && b4.preview.id === pa?.id && !!pa && b4.preview.url === null, JSON.stringify(b4?.preview));
      check("(preview) a second stop is refused by name, not repeated",
        (await post(`/api/review-candidates/${cand}/preview/stop`, {})).status === 409);

      // THE DEADLINE, on the server's timer: a short clock for this one restart
      await restartSrv({ FLEET_LANE_PREVIEW_MAX: "1", FLEET_LANE_PREVIEW_TTL_MS: "4000" });
      const bRes = await pvStart(pvbId);
      const pb = bRes.body.preview;
      const bUp = !!pb?.url && (await reach(pb.url)) === "preview stub";
      const pvbBoard = async () => ((await (await get(`/api/slots/${lc.lnSlot}/worktrees`)).json()) as { worktrees: RpBoard[] })
        .worktrees.find((w) => w.path === pvbPath);
      let pbEnd: PvView | null | undefined = null;
      try {
        pbEnd = await until(async () => { const v = (await pvbBoard())?.preview; return v?.state === "expired" ? v : null; },
          { timeoutMs: 20_000, what: "the second preview expired on its deadline" });
      } catch (e) { if (!(e instanceof UntilTimeout)) throw e; }
      check("(preview) with the first stopped the budget is free again, and the deadline ends the preview: URL unreachable, copy gone",
        bRes.status === 200 && bUp && pbEnd?.state === "expired" && (pbEnd.why ?? "").includes("deadline") && pbEnd.url === null
          && !!pb?.url && (await gone(pb.url, "expired preview unreachable"))
          // the record turns `expired` BEFORE the stop script runs (endLanePreview); the copy goes with the script
          && (await until(() => !exists(pb.dir), { timeoutMs: 8000, what: "expired preview copy removed" }).catch(() => false)) === true,
        `${bRes.status} up=${bUp} ${JSON.stringify(pbEnd)}`);

      // …and on a deadline that passed while the server was DOWN: the boot ends it (the script's own
      // backstop fires only a grace later, so this is the server's answer)
      const c2 = await pvStart(cand);
      const pc = c2.body.preview;
      await stopSrv();
      const cUpWhileDown = !!pc?.url && (await reach(pc.url)) === "preview stub";
      await Bun.sleep(Math.max(0, (pc?.expiresAt ?? 0) - Date.now()) + 300);
      await restartSrv();
      const b5 = await rpBoard();
      check("(preview) a deadline passed during downtime is ended at boot: expired, unreachable, copy gone",
        c2.status === 200 && cUpWhileDown && !!pc && b5?.preview?.state === "expired" && b5.preview.id === pc.id
          && (b5.preview.why ?? "").includes("server was down") && !!pc?.url && (await gone(pc.url, "boot-expired preview unreachable"))
          && !exists(pc?.dir ?? "-"),
        `${c2.status} up=${cUpWhileDown} ${JSON.stringify(b5?.preview)}`);

      // the planted candidate leaves the way the owner would remove it — and its record with it
      const disc = await post("/api/worktrees/discard", { repo: REPO, path: pvbPath, branch: pvbBranch });
      check("(preview) fixture cleanup: the planted candidate's worktree is discarded",
        disc.ok && !exists(pvbPath), String(disc.status));
      check("(notepad) a discarded worktree takes its note along — no orphan entry, the parked tree's note untouched",
        rpState().worktreeNotes?.[pvbPath] === undefined && rpState().worktreeNotes?.[rpCwd] === noteText,
        JSON.stringify(rpState().worktreeNotes ?? {}).slice(0, 200));
    }

    // === THE REVIEW ON PRESS of this candidate (server.ts#startCandidateReview; owner 2026-09-24 "nur
    // auf Knopfdruck, nie periodisch"). The reviewer is the FLEET_REVIEW_CMD stand-in, never an agent,
    // and its per-cwd spawn log is the fact behind every "ran"/"did not run". What each check turns red
    // on: a run nobody pressed for; a subject read from the worktree instead of the stored head; a
    // second run of one patch; a comment that stays "current" after the patch moved; a sixth run of one
    // candidate; comments lost on a restart.
    const crCand = parked?.id ?? "-";
    const crCtl = ROOT; // the stand-in reads its switches next to itself
    const crPress = async (cand: string) => {
      const r = await post(`/api/review-candidates/${cand}/review`, {});
      return { status: r.status, body: (await r.json().catch(() => ({}))) as { ok?: boolean; review?: CrRec; error?: string } };
    };
    const crRuns0 = reviewRunsFor(rpCwd);
    await Bun.sleep(2500); // more than two auto-③ ticks (FLEET_AUTO_REVIEW_MS=1000 in this suite)
    check("(review on press) nothing runs without a press: a parked candidate past two auto-review ticks has no comment and no spawn",
      reviewRunsFor(rpCwd) === crRuns0 && ((await rpBoard())?.reviews ?? null) === null && !rpState().candidateReviews,
      `${reviewRunsFor(rpCwd)} vs ${crRuns0}`);
    const crUnknown = await crPress("0123456789ab");
    check("(review on press) an id that names no parked candidate is refused by name",
      crUnknown.status === 404 && (crUnknown.body.error ?? "").includes("no parked review candidate"), `${crUnknown.status} ${crUnknown.body.error}`);

    // a failed reviewer files nothing, and the run counts
    writeFileSync(`${crCtl}/reviewfail`, "1");
    const crFail = await crPress(crCand);
    rmSync(`${crCtl}/reviewfail`, { force: true });
    check("(review on press) a failed reviewer is a named 502 that files no comment",
      crFail.status === 502 && (crFail.body.error ?? "").includes("failed") && reviewRunsFor(rpCwd) === crRuns0 + 1
        && ((await rpBoard())?.reviews ?? []).map((r) => r.state).join() === "failed",
      `${crFail.status} ${crFail.body.error} runs=${reviewRunsFor(rpCwd) - crRuns0}`);

    // THE SUBJECT IS THE STORED HEAD: the worktree moves on first, and the review must not read that
    writeFileSync(`${rpCwd}/review-moved.txt`, "a commit after the park\n");
    spawnSync("git", ["-C", rpCwd, "add", "review-moved.txt"]);
    spawnSync("git", ["-C", rpCwd, "commit", "-qm", "review: moved after the park"]);
    const crMoved = spawnSync("git", ["-C", rpCwd, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
    const crOk = await crPress(crCand);
    const c1 = crOk.body.review;
    const c1Prompt = lastReviewPromptFor(rpCwd);
    check("(review on press) a press runs the stand-in ONCE and files a dated comment bound to the stored head's patch",
      crOk.status === 200 && c1?.state === "filed" && c1.candidate === crCand && c1.head === rpHead && /^[0-9a-f]{40}$/.test(c1.patchId)
        && typeof c1.at === "number" && c1.findings.map((f) => f.impact).join() === "high,low" && c1.raw === false
        && reviewRunsFor(rpCwd) === crRuns0 + 2,
      `${crOk.status} ${JSON.stringify(crOk.body).slice(0, 300)}`);
    check("(review on press) the reviewer read the stored head's diff, not the worktree that moved on",
      c1Prompt.includes("review-park.txt") && !c1Prompt.includes("review-moved.txt") && (c1?.scope ?? "").includes("stored head"),
      `${c1Prompt.length} chars, moved=${c1Prompt.includes("review-moved.txt")} scope=${c1?.scope}`);
    const crAgain = await crPress(crCand);
    check("(review on press) a second press on the same patch is refused by name, and runs nothing",
      crAgain.status === 409 && (crAgain.body.error ?? "").includes("already reviewed") && (crAgain.body.error ?? "").includes(c1?.id ?? "-")
        && reviewRunsFor(rpCwd) === crRuns0 + 2,
      `${crAgain.status} ${crAgain.body.error}`);
    const crB1 = (await rpBoard())?.reviews?.find((r) => r.id === c1?.id);
    spawnSync("git", ["-C", rpCwd, "reset", "-q", "--hard", rpHead]);
    const crB2 = (await rpBoard())?.reviews?.find((r) => r.id === c1?.id);
    check("(review on press) the comment is stale while the worktree carries another patch, and current on the stored head",
      crB1?.stale === true && crB1.patchNow !== c1?.patchId && typeof crB1.patchNow === "string"
        && crB2?.stale === false && crB2.patchNow === c1?.patchId,
      JSON.stringify({ moved: crB1 && { stale: crB1.stale, now: crB1.patchNow }, back: crB2 && { stale: crB2.stale, now: crB2.patchNow } }));

    // A LATER PARK of the same tree at the moved head (planted: the subject is the review, not the
    // park door, which the checks above already cover) — a second candidate, a changed patch
    await stopSrv();
    const crPlant = rpState();
    const crA = crPlant.shelved?.[rpCwd]?.review;
    const crBId = "c0c0c0c0c0c0";
    if (crPlant.shelved?.[rpCwd] && crA) crPlant.shelved[rpCwd].review = { ...crA, id: crBId, head: crMoved };
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(crPlant, null, 2), { mode: 0o600 });
    spawnSync("git", ["-C", rpCwd, "reset", "-q", "--hard", crMoved]);
    await restartSrv();
    writeFileSync(`${crCtl}/reviewfail`, "1");
    const crFails: number[] = [];
    for (let i = 0; i < 4; i++) crFails.push((await crPress(crBId)).status);
    rmSync(`${crCtl}/reviewfail`, { force: true });
    const crB = await crPress(crBId);
    const c2 = crB.body.review;
    const crBoard3 = (await rpBoard())?.reviews ?? [];
    check("(review on press) the changed patch gets its own comment, and marks the earlier one visibly stale",
      crB.status === 200 && c2?.state === "filed" && c2.head === crMoved && !!c1 && c2.patchId !== c1.patchId
        && crBoard3.find((r) => r.id === c1.id)?.stale === true && crBoard3.find((r) => r.id === c2.id)?.stale === false,
      `${crB.status} ${JSON.stringify(crBoard3.map((r) => ({ id: r.id, state: r.state, stale: r.stale })))}`);
    const crCap = await crPress(crBId);
    check("(review on press) a candidate is capped at 5 runs, failed ones counted — the sixth press is refused and runs nothing",
      crFails.every((x) => x === 502) && crCap.status === 409 && (crCap.body.error ?? "").includes("5 of 5")
        && reviewRunsFor(rpCwd) === crRuns0 + 7,
      `${crFails.join()} ${crCap.status} ${crCap.body.error} runs=${reviewRunsFor(rpCwd) - crRuns0}`);

    // back to the real candidate for the park checks below; the comments must survive the restart
    await stopSrv();
    const crRestore = rpState();
    if (crRestore.shelved?.[rpCwd] && crA) crRestore.shelved[rpCwd].review = crA;
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(crRestore, null, 2), { mode: 0o600 });
    spawnSync("git", ["-C", rpCwd, "reset", "-q", "--hard", rpHead]);
    await restartSrv();
    const crBoard4 = (await rpBoard())?.reviews ?? [];
    check("(review on press) the comments survive a restart, and staleness follows the tree back to the first patch",
      crBoard4.length === 7 && crBoard4.find((r) => r.id === c1?.id)?.stale === false
        && crBoard4.find((r) => r.id === c2?.id)?.stale === true && reviewRunsFor(rpCwd) === crRuns0 + 7,
      JSON.stringify(crBoard4.map((r) => ({ id: r.id, state: r.state, stale: r.stale }))));

    // RESTART, with the deadline moved into the past: the rows must not be requeued by the boot
    // reconcile, and an expired candidate is marked — never removed.
    await stopSrv();
    const rpAge = rpState();
    const rpShelf = rpAge.shelved?.[rpCwd]?.review;
    if (rpShelf) rpShelf.expiresAt = Date.now() - 1000;
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(rpAge, null, 2), { mode: 0o600 });
    await restartSrv();
    check("(review park) across a restart the rows stay parked — no boot requeue, no second dispatch",
      (await rpRows(rpIds)).every((t) => t?.status === "sent" && t.slot === null), JSON.stringify((await rpRows(rpIds))));
    const board2 = await rpBoard();
    check("(review park) a passed deadline marks the candidate expired and keeps its worktree",
      board2?.review?.id === parked?.id && board2?.review?.expired === true && exists(`${rpCwd}/review-park.txt`),
      JSON.stringify(board2));
    check("(notepad) the note survives the restart beside the expired candidate",
      board2?.notepad === noteText, (board2?.notepad ?? "null").slice(0, 60));

    // RESUME
    const resumeRes = await post("/api/lanes", { repo: REPO, attach: rpCwd });
    const resumed = (await resumeRes.json()) as { ok?: boolean; slot?: number;
      resumed?: { candidate: string; head: string; reportId: string; taskIds: string[]; verify: string } };
    const rpSlot2 = resumed.slot ?? 0;
    check("(review park) reopening the worktree resumes the candidate and binds both rows back",
      resumeRes.ok && rpSlot2 > 0 && resumed.resumed?.candidate === parked?.id && resumed.resumed?.verify === "stale"
        && JSON.stringify([...(resumed.resumed?.taskIds ?? [])].sort()) === JSON.stringify([...rpIds].sort())
        && (await rpRows(rpIds)).every((t) => t?.status === "sent" && t.slot === rpSlot2),
      `${resumeRes.status} ${JSON.stringify(resumed)} ${JSON.stringify((await rpRows(rpIds)))}`);
    const rpSeat = rpState().slots?.[String(rpSlot2)];
    const rpFrom = (await rpSessions()).find((x) => x.id === rpSlot2)?.worktree?.resumedFrom;
    check("(review park) the resumed lane carries its founding row and Program, and marks the pre-park verify stale",
      rpSeat?.taskId === rpIds[0] && rpSeat.programId === rpProgramId && rpFrom?.candidate === parked?.id
        && rpFrom?.verify === "stale" && rpFrom?.head === rpHead && rpFrom?.reportId === rpReportId
        && rpSeat.worktree?.resumedFrom?.candidate === parked?.id,
      JSON.stringify({ seat: rpSeat, from: rpFrom }));
    const board3 = await rpBoard();
    check("(review park) the resume consumed the candidate: the board shows no candidate and no note",
      board3?.slot === rpSlot2 && board3.review == null && board3.note == null, JSON.stringify(board3));
    check("(notepad) the note survives the resume — the live lane's row carries it again",
      board3?.notepad === noteText && board3?.slot === rpSlot2, (board3?.notepad ?? "null").slice(0, 60));
    const crLive = await crPress(crCand);
    check("(review on press) a candidate resumed into a live lane is refused by name, and runs nothing",
      crLive.status === 409 && (crLive.body.error ?? "").includes(`live lane slot ${rpSlot2}`) && reviewRunsFor(rpCwd) >= crRuns0 + 7
        && ((await rpBoard())?.reviews ?? []).length === 7,
      `${crLive.status} ${crLive.body.error}`);
    const second = await post("/api/lanes", { repo: REPO, attach: rpCwd });
    check("(review park) a second attach of the same worktree is refused and moves no row",
      second.status === 409 && (await rpRows(rpIds)).every((t) => t?.status === "sent" && t.slot === rpSlot2), String(second.status));

    // THE PLAIN SHELVE, unchanged: no candidate, and its rows go back to owner review as before
    const plain = await post(`/api/slots/${rpSlot2}/shelve`, { note: "plain" });
    const plainBody = (await plain.json()) as { ok?: boolean; candidate?: unknown };
    const board4 = await rpBoard();
    check("(review park) a shelve without review:true is the old shelve — no candidate, rows back to pending",
      plain.ok && plainBody.ok === true && plainBody.candidate === undefined && board4?.note === "plain" && board4.review == null
        && (await rpRows(rpIds)).every((t) => t?.status === "pending" && t.slot === null),
      `${JSON.stringify(plainBody)} ${JSON.stringify(board4)} ${JSON.stringify((await rpRows(rpIds)))}`);

    const crPlain = await crPress(crCand);
    check("(review on press) a worktree shelved without review is not a candidate — refused by name",
      crPlain.status === 409 && (crPlain.body.error ?? "").includes("shelved without review"), `${crPlain.status} ${crPlain.body.error}`);

    // the planted records leave the way they came (the 2 s poll's budget, see the baton cleanup)
    spawnSync("git", ["-C", REPO, "worktree", "remove", "--force", rpCwd]);
    for (const id of rpIds) await post(`/api/tasks/${id}/delete`, {});
    await stopSrv();
    const rpUnplant = rpState();
    rpUnplant.programs = (rpUnplant.programs ?? []).filter((p) => p.id !== rpProgramId);
    rpUnplant.fleetReports = (rpUnplant.fleetReports ?? []).filter((r) => r.id !== rpReportId);
    if (rpUnplant.shelved) delete rpUnplant.shelved[rpCwd];
    delete rpUnplant.lanePreviews; // the ended preview records of this fixture — no instance is left behind them
    delete rpUnplant.candidateReviews; // …and the review comments on its removed worktree
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(rpUnplant, null, 2), { mode: 0o600 });
    await restartSrv();
    check("(review park) fixture cleanup: Program, report and rows are gone",
      !(rpState().programs ?? []).some((p) => p.id === rpProgramId) && !rpIds.some((id) => rpState().tasks?.some((t) => t.id === id)));
    check("(notepad) fixture cleanup: the removed worktree's note was swept at boot — no orphan entry",
      rpState().worktreeNotes?.[rpCwd] === undefined, JSON.stringify(rpState().worktreeNotes ?? null));
  }
}
