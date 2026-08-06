// Lane lifecycle: risk vs the configured integration branch, shelve → resume, the lane-scoped
// brief, and the 💾 commit endpoint (lane vs main-session staging, detached HEAD, wedged rebase).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { REPO, ROOT, check, get, post, tmuxOut } from "./harness";
import type { LaneCtx } from "./ctx";
import { exists } from "./lane-helpers";

export async function run(lc: LaneCtx): Promise<void> {
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
    const wmap = (await (await get(`/api/slots/${lc.lnSlot}/worktrees`)).json()) as
      { worktrees: { path: string; slot: number | null; note: string | null }[] };
    const orphan = wmap.worktrees.find((w) => w.path === sh.cwd);
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
    const slotAudit = (): string[] => readFileSync(`${ROOT}/audit.jsonl`, "utf8").split("\n").filter(Boolean)
      .map((l) => { try { return JSON.parse(l) as { event?: string; slot?: number }; } catch { return null; } })
      .filter((r): r is { event?: string; slot?: number } => !!r && r.slot === rs.slot)
      .map((r) => String(r.event ?? ""));

    await Bun.sleep(300); // saveState/audit writes are chained and fire-and-forget — let the setup land before baselining
    const recBefore = await slotRecord();
    const outBefore = (await outcomes()).length;
    const auditBefore = slotAudit().length;
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
    const clRes = (await (await post(`/api/slots/${cl.slot}/commit`, { mode: "quick" })).json()) as { committed?: boolean };
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
    const mRes = (await (await post("/api/slots/9/commit", { mode: "quick" })).json()) as { committed?: boolean };
    const mStatus = spawnSync("git", ["-C", mainRepo, "status", "--porcelain"]).stdout.toString();
    check("main-session commit stages tracked (add -u), leaves untracked untracked",
      mRes.committed === true && /\?\? scratch\.txt/.test(mStatus) && !/f\.txt/.test(mStatus),
      `committed=${mRes.committed} status=${JSON.stringify(mStatus)}`);

    // (c) a detached HEAD is refused (would otherwise be a dangling commit)
    spawnSync("git", ["-C", mainRepo, "checkout", "-q", "--detach"]);
    await Bun.write(`${mainRepo}/f.txt`, "3\n");
    const dRes = (await (await post("/api/slots/9/commit", { mode: "quick" })).json()) as { committed?: boolean; reason?: string };
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
    const glCommit = (await (await post(`/api/slots/${gl.slot}/commit`, { mode: "quick" })).json()) as { committed?: boolean; reason?: string };
    check("commit is blocked during an interrupted rebase", glCommit.committed === false && (glCommit.reason ?? "").includes("in progress"), JSON.stringify(glCommit));
    spawnSync("git", ["-C", gl.cwd, "rebase", "--abort"]);
    await post(`/api/slots/${gl.slot}/kill`, {});
  }
}
