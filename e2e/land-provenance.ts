// One-gesture land, ↩ undo-land and its refusals, V2 git-note provenance, the G1 guarantees that
// provenance survives a failed teardown or a stale verify, and the resolver↔verify repair loop.
import { spawnSync } from "node:child_process";
import { REPO, check, get, post } from "./harness";
import { VerifyField, exists, setMergeMode, settleForMerge, waitMerge } from "./lane-helpers";

export async function run(): Promise<void> {
  // === Lane A: one-gesture land (commit-if-dirty → land) + ↩ undo-last-land ===
  // Isolated fresh repos so main-mutation + undo never touch the shared REPO later tests use.
  {
    const freshRepo = async (suffix: string): Promise<{ repo: string; main: string; sha: string }> => {
      const repo = `${REPO}.${suffix}`;
      spawnSync("git", ["init", "-q", "-b", "main", repo]); // fakemerge hardcodes `git rebase main`
      spawnSync("git", ["-C", repo, "config", "user.email", "e2e@test"]);
      spawnSync("git", ["-C", repo, "config", "user.name", "e2e"]);
      spawnSync("git", ["-C", repo, "config", "commit.gpgsign", "false"]);
      await Bun.write(`${repo}/base.txt`, "base\n");
      spawnSync("git", ["-C", repo, "add", "base.txt"]);
      spawnSync("git", ["-C", repo, "commit", "-qm", "base"]);
      return { repo, main: "main", sha: spawnSync("git", ["-C", repo, "rev-parse", "HEAD"]).stdout.toString().trim() };
    };
    const headOf = (repo: string, ref = "HEAD"): string => spawnSync("git", ["-C", repo, "rev-parse", ref]).stdout.toString().trim();
    // land a lane with committed work via the clean script path (no conflict → agent never consulted)
    const landClean = async (slot: number): Promise<void> => {
      await setMergeMode("blocked"); // a clean rebase must NOT consult the agent
      await settleForMerge(slot);
      await post(`/api/slots/${slot}/merge`, {});
      await waitMerge(slot);
    };

    // --- one-gesture land: a lane with ONLY uncommitted work lands in one flow (commit → land),
    // the owner never pre-commits. Mirrors doLand: commit (agent message) then /land→/merge. ---
    const og = await freshRepo("onegesture");
    const lane = (await (await post("/api/lanes", { repo: og.repo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${lane.cwd}/feature.txt`, "feature work\n"); // uncommitted — the friction one-gesture removes
    const ogCommit = (await (await post(`/api/slots/${lane.slot}/commit`, { mode: "agent" })).json()) as { committed?: boolean; subject?: string };
    check("one-gesture land: the dirty tree is committed first (agent message)",
      ogCommit.committed === true && ogCommit.subject === "feat: stand-in commit message", JSON.stringify(ogCommit));
    check("one-gesture land: direct /land refuses the committed-but-unmerged lane (→ /merge fallback)",
      (await post(`/api/slots/${lane.slot}/land`, {})).status === 409);
    // a second lane on the SAME repo, kept open, so the undoable land is observable on the board
    const probe = (await (await post("/api/lanes", { repo: og.repo })).json()) as { slot: number; branch: string };
    const ogBefore = headOf(og.repo, og.main);
    await landClean(lane.slot);
    check("one-gesture land: committed work then landed (landed slot torn down)",
      (await get(`/api/slots/${lane.slot}/merge`)).status === 400);
    const ogAfter = headOf(og.repo, og.main);
    check("one-gesture land: main advanced past its pre-land SHA", ogAfter !== ogBefore, `${ogBefore} -> ${ogAfter}`);
    check("one-gesture land: the committed work reached main with the expected message",
      spawnSync("git", ["-C", og.repo, "log", "--oneline"]).stdout.toString().includes("stand-in commit message"),
      spawnSync("git", ["-C", og.repo, "log", "--oneline"]).stdout.toString().trim());
    // the undoable land surfaces to the board via GET /merge on any live lane of the same repo
    const probeMg = (await (await get(`/api/slots/${probe.slot}/merge`)).json()) as { undoable?: { branch: string } | null };
    check("undo: the landed lane is exposed as undoable on the repo's board",
      probeMg.undoable?.branch === lane.branch, JSON.stringify(probeMg.undoable));

    // --- undo resets main to the EXACT pre-land SHA; keeps the branch; is one-shot ---
    const undo = await post("/api/repos/undo-land", { repo: og.repo });
    const undoJ = (await undo.json()) as { ok?: boolean; to?: string };
    check("undo-land resets main to the exact pre-land SHA",
      undo.ok === true && headOf(og.repo, og.main) === ogBefore, `${JSON.stringify(undoJ)} now=${headOf(og.repo, og.main)} want=${ogBefore}`);
    check("undo-land keeps the landed branch (work recoverable by reopening the lane)",
      spawnSync("git", ["-C", og.repo, "rev-parse", "--verify", "-q", `refs/heads/${lane.branch}`]).status === 0);
    check("undo-land clears the undoable record from the board",
      (((await (await get(`/api/slots/${probe.slot}/merge`)).json()) as { undoable?: unknown }).undoable ?? null) === null);
    check("undo-land is one-shot — a second undo has nothing left to undo",
      (await post("/api/repos/undo-land", { repo: og.repo })).status === 404);
    await post(`/api/slots/${probe.slot}/kill`, {});

    // --- undo REFUSES when main moved since the land (a new commit landed on top) ---
    const mv = await freshRepo("undomoved");
    const mvLane = (await (await post("/api/lanes", { repo: mv.repo })).json()) as { slot: number; cwd: string };
    await Bun.write(`${mvLane.cwd}/f.txt`, "work\n");
    spawnSync("git", ["-C", mvLane.cwd, "add", "f.txt"]);
    spawnSync("git", ["-C", mvLane.cwd, "commit", "-qm", "lane work"]);
    await landClean(mvLane.slot);
    const mvAfterLand = headOf(mv.repo, mv.main);
    await Bun.write(`${mv.repo}/onmain.txt`, "later\n"); // main moves on top of the land
    spawnSync("git", ["-C", mv.repo, "add", "onmain.txt"]);
    spawnSync("git", ["-C", mv.repo, "commit", "-qm", "later main work"]);
    const mvMoved = headOf(mv.repo, mv.main);
    const mvUndo = await post("/api/repos/undo-land", { repo: mv.repo });
    const mvUndoJ = (await mvUndo.json()) as { error?: string };
    check("undo REFUSES when main moved since the land",
      mvUndo.status === 409 && (mvUndoJ.error ?? "").includes("moved"), `${mvUndo.status} ${JSON.stringify(mvUndoJ)}`);
    check("refused undo (moved) leaves main exactly where it was",
      headOf(mv.repo, mv.main) === mvMoved && mvMoved !== mvAfterLand, `now=${headOf(mv.repo, mv.main)}`);

    // --- undo REFUSES when the landed commit is already on a remote (would rewrite shared history) ---
    const rm = await freshRepo("undoremote");
    spawnSync("git", ["init", "--bare", "-q", `${rm.repo}.remote.git`]);
    spawnSync("git", ["-C", rm.repo, "remote", "add", "origin", `${rm.repo}.remote.git`]);
    const rmLane = (await (await post("/api/lanes", { repo: rm.repo })).json()) as { slot: number; cwd: string };
    await Bun.write(`${rmLane.cwd}/f.txt`, "work\n");
    spawnSync("git", ["-C", rmLane.cwd, "add", "f.txt"]);
    spawnSync("git", ["-C", rmLane.cwd, "commit", "-qm", "lane work"]);
    await landClean(rmLane.slot);
    const rmAfterLand = headOf(rm.repo, rm.main);
    spawnSync("git", ["-C", rm.repo, "push", "-q", "origin", rm.main]); // land now on a remote
    spawnSync("git", ["-C", rm.repo, "fetch", "-q", "origin"]);
    const rmUndo = await post("/api/repos/undo-land", { repo: rm.repo });
    const rmUndoJ = (await rmUndo.json()) as { error?: string };
    check("undo REFUSES when the landed commit is already on a remote",
      rmUndo.status === 409 && (rmUndoJ.error ?? "").includes("remote"), `${rmUndo.status} ${JSON.stringify(rmUndoJ)}`);
    check("refused undo (remote) leaves main exactly where it was", headOf(rm.repo, rm.main) === rmAfterLand);

    // --- REGRESSION GUARD: a CONFLICTING one-gesture land still PAUSES for review (human gate) ---
    const cf = await freshRepo("conflict");
    const cfLane = (await (await post("/api/lanes", { repo: cf.repo })).json()) as { slot: number; cwd: string };
    await Bun.write(`${cfLane.cwd}/base.txt`, "base\nlane-side\n"); // uncommitted — one-gesture commits it
    check("regression guard: one-gesture commits the dirty conflicting lane",
      ((await (await post(`/api/slots/${cfLane.slot}/commit`, { mode: "quick" })).json()) as { committed?: boolean }).committed === true);
    await Bun.write(`${cf.repo}/base.txt`, "base\nmain-side\n"); // same line → rebase conflict → agent path
    spawnSync("git", ["-C", cf.repo, "commit", "-aqm", "main conflict"]);
    const cfMainBefore = headOf(cf.repo, cf.main);
    await setMergeMode("do"); // agent resolves the conflict, then the server PAUSES for review
    await settleForMerge(cfLane.slot);
    await post(`/api/slots/${cfLane.slot}/merge`, {});
    const cfV = await waitMerge(cfLane.slot);
    check("regression guard: a conflicting land PAUSES (resolved, NOT landed, lane kept)",
      !cfV.gone && cfV.last?.status === "resolved" && cfV.last.landed === false && exists(cfLane.cwd), JSON.stringify(cfV.last));
    check("regression guard: the human gate held — nothing reached main, no undoable land recorded",
      headOf(cf.repo, cf.main) === cfMainBefore
      && (((await (await get(`/api/slots/${cfLane.slot}/merge`)).json()) as { undoable?: unknown }).undoable ?? null) === null,
      `main=${headOf(cf.repo, cf.main)} before=${cfMainBefore}`);
    await post(`/api/slots/${cfLane.slot}/kill`, {});

    // --- V2: server-written git-note provenance at land ("own your work", design note §4).
    // On every land that MOVES main, the SERVER attaches the review story to the landed tip
    // as a note under refs/notes/fleet/land — server-authored (never the agent), best-effort
    // (a note-write failure never fails the land), never deleted (survives undo-land). ---
    const readNote = (repo: string, sha: string): { ok: boolean; json: Record<string, unknown> | null } => {
      const r = spawnSync("git", ["-C", repo, "notes", "--ref=fleet/land", "show", sha]);
      if (r.status !== 0) return { ok: false, json: null };
      try { return { ok: true, json: JSON.parse(r.stdout.toString().trim()) as Record<string, unknown> }; }
      catch { return { ok: false, json: null }; }
    };

    // (1) clean-path land → a note that PARSES and carries the land's own before/after +
    //     the server verify result (green). Mutation guard: drop writeLandNote → this fails.
    const pn = await freshRepo("provnote");
    const pnLane = (await (await post("/api/lanes", { repo: pn.repo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${pnLane.cwd}/prov.txt`, "clean lane work, no marker\n");
    spawnSync("git", ["-C", pnLane.cwd, "add", "prov.txt"]);
    spawnSync("git", ["-C", pnLane.cwd, "commit", "-qm", "prov lane work"]);
    const pnBefore = headOf(pn.repo, pn.main);
    await landClean(pnLane.slot);
    const pnAfter = headOf(pn.repo, pn.main);
    const pnNote = readNote(pn.repo, pnAfter);
    check("V2: a clean-path land writes a fleet/land git note on the landed tip that parses", pnNote.ok, JSON.stringify(pnNote));
    check("V2: the note records this land's own mainBefore→mainAfter, branch, and confirmedByHuman:false",
      pnNote.json?.mainBefore === pnBefore && pnNote.json?.mainAfter === pnAfter
      && pnNote.json?.branch === pnLane.branch && pnNote.json?.confirmedByHuman === false,
      `before=${pnBefore} after=${pnAfter} ${JSON.stringify(pnNote.json)}`);
    check("V2: the note carries the SERVER verify fact (green), not an agent self-claim",
      (pnNote.json?.verify as { ok?: boolean; mainSha?: string } | undefined)?.ok === true
      && typeof (pnNote.json?.verify as { mainSha?: string } | undefined)?.mainSha === "string",
      JSON.stringify(pnNote.json?.verify));

    // (2) the note SURVIVES undo-land — it is the record THAT the land happened, never deleted.
    const pnUndo = await post("/api/repos/undo-land", { repo: pn.repo });
    check("V2 setup: undo-land succeeds on the clean-path land", pnUndo.ok === true,
      `${pnUndo.status} main=${headOf(pn.repo, pn.main)} before=${pnBefore}`);
    const pnNoteAfterUndo = readNote(pn.repo, pnAfter);
    check("V2: the provenance note survives undo-land (the record of THAT it happened is never deleted)",
      pnNoteAfterUndo.ok && pnNoteAfterUndo.json?.mainAfter === pnAfter, JSON.stringify(pnNoteAfterUndo));

    // (3) confirm-land → confirmedByHuman:true, carrying the reviewed conflicted files + resolver detail.
    const pc = await freshRepo("provconfirm");
    const pcLane = (await (await post("/api/lanes", { repo: pc.repo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${pcLane.cwd}/base.txt`, "base\nlane-side\n"); // conflict on base.txt
    spawnSync("git", ["-C", pcLane.cwd, "commit", "-aqm", "prov confirm lane work"]);
    await Bun.write(`${pc.repo}/base.txt`, "base\nmain-side\n");    // same line on main → agent resolves
    spawnSync("git", ["-C", pc.repo, "commit", "-aqm", "prov confirm main work"]);
    await setMergeMode("do");
    await settleForMerge(pcLane.slot);
    await post(`/api/slots/${pcLane.slot}/merge`, {});
    const pcV = await waitMerge(pcLane.slot);
    check("V2 setup: conflicting lane resolved + paused for review", !pcV.gone && pcV.last?.status === "resolved", JSON.stringify(pcV.last));
    const pcBefore = headOf(pc.repo, pc.main);
    await settleForMerge(pcLane.slot);
    const pcConf = (await (await post(`/api/slots/${pcLane.slot}/merge`, { confirm: true })).json()) as { status?: string; landed?: boolean };
    check("V2 setup: the owner confirm-lands the reviewed resolution", pcConf.status === "merged" && pcConf.landed === true, JSON.stringify(pcConf));
    const pcAfter = headOf(pc.repo, pc.main);
    const pcNote = readNote(pc.repo, pcAfter);
    check("V2: the confirm-land note records confirmedByHuman:true (the human owned this land)",
      pcNote.ok && pcNote.json?.confirmedByHuman === true, JSON.stringify(pcNote.json));
    check("V2: the confirm-land note carries the reviewed conflicted files + the resolver detail",
      Array.isArray(pcNote.json?.conflicted) && (pcNote.json?.conflicted as string[]).includes("base.txt")
      && typeof pcNote.json?.resolverDetail === "string" && (pcNote.json?.resolverDetail as string).length > 0,
      JSON.stringify(pcNote.json));
    check("G1 control: an un-moved confirm-land note carries a FRESH verify (green, no stale marker)",
      (pcNote.json?.verify as VerifyField | undefined)?.ok === true
      && (pcNote.json?.verify as VerifyField | undefined)?.stale === undefined,
      JSON.stringify(pcNote.json?.verify));

    // (4) a land whose NOTE-WRITE FAILS still lands (best-effort provenance, landing is the job).
    //     Sabotage: refs/notes/fleet as a FILE → `git notes add refs/notes/fleet/land` hits a
    //     D/F lock error, while refs/heads/main (the land's own ff) is untouched.
    const pf = await freshRepo("provfail");
    const pfLane = (await (await post("/api/lanes", { repo: pf.repo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${pfLane.cwd}/pf.txt`, "clean lane work\n");
    spawnSync("git", ["-C", pfLane.cwd, "add", "pf.txt"]);
    spawnSync("git", ["-C", pfLane.cwd, "commit", "-qm", "provfail lane work"]);
    await Bun.write(`${pf.repo}/.git/refs/notes/fleet`, "block\n"); // non-directory in the notes-ref path
    const pfBefore = headOf(pf.repo, pf.main);
    await landClean(pfLane.slot);
    const pfAfter = headOf(pf.repo, pf.main);
    check("V2: a land whose note-write FAILS still lands (main advanced, lane torn down)",
      pfAfter !== pfBefore && (await get(`/api/slots/${pfLane.slot}/merge`)).status === 400,
      `before=${pfBefore} after=${pfAfter}`);
    check("V2: the failed note-write left no note and did not wedge the land", readNote(pf.repo, pfAfter).ok === false);

    // --- G1: land provenance survives teardown failure. recordLand must couple to the
    // MAIN-MOVE (advanceIntegration), not the teardown: a landLane failure after a
    // successful advance previously left main ff'd with NO note and NO undo record while
    // the owner read "not landed" — a silent provenance hole on the human-gated action.
    // Lever: chmod the lane worktree dir read-only — every pre-land step is a read
    // (status/rebase-up-to-date/verify/advance-in-repo) and passes, but `git worktree
    // remove` cannot unlink the entries and fails deterministically.

    // (a1) CLEAN path (mergeJob): advance ok, landLane fails → verdict carries a distinct
    // landError, and note + undo record exist anyway.
    const tf = await freshRepo("teardownfail");
    const tfLane = (await (await post("/api/lanes", { repo: tf.repo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${tfLane.cwd}/tf.txt`, "teardown-fail lane work\n");
    spawnSync("git", ["-C", tfLane.cwd, "add", "tf.txt"]);
    spawnSync("git", ["-C", tfLane.cwd, "commit", "-qm", "teardown-fail lane work"]);
    const tfProbe = (await (await post("/api/lanes", { repo: tf.repo })).json()) as { slot: number }; // board observer for undoable
    const tfBefore = headOf(tf.repo, tf.main);
    spawnSync("chmod", ["555", tfLane.cwd]); // the teardown obstacle
    await setMergeMode("blocked"); // clean rebase — agent must not be consulted
    await settleForMerge(tfLane.slot);
    await post(`/api/slots/${tfLane.slot}/merge`, {});
    const tfV = await waitMerge(tfLane.slot);
    spawnSync("chmod", ["755", tfLane.cwd]); // restore before asserting, whatever happened
    const tfAfter = headOf(tf.repo, tf.main);
    check("G1a setup: the obstacle held — main advanced but the lane survived on disk",
      tfAfter !== tfBefore && exists(tfLane.cwd), `before=${tfBefore} after=${tfAfter} exists=${exists(tfLane.cwd)}`);
    check("G1a: clean-path verdict reports the teardown failure as its own landError field (merged, landed:false)",
      !tfV.gone && tfV.last?.status === "merged" && tfV.last.landed === false
      && (tfV.last.landError ?? "").includes("worktree remove failed"),
      JSON.stringify(tfV.last));
    const tfNote = readNote(tf.repo, tfAfter);
    check("G1a: the moved main carries its fleet/land note despite the failed teardown",
      tfNote.ok && tfNote.json?.mainBefore === tfBefore && tfNote.json?.mainAfter === tfAfter
      && tfNote.json?.branch === tfLane.branch && tfNote.json?.confirmedByHuman === false,
      JSON.stringify(tfNote.json));
    const tfUndoable = (await (await get(`/api/slots/${tfProbe.slot}/merge`)).json()) as { undoable?: { branch: string } | null };
    check("G1a: the undo record exists despite the failed teardown (the land stays undoable)",
      tfUndoable.undoable?.branch === tfLane.branch, JSON.stringify(tfUndoable.undoable));
    await post(`/api/slots/${tfLane.slot}/kill`, {});
    await post(`/api/slots/${tfProbe.slot}/kill`, {});

    // (a2) CONFIRM-land path: same invariant on the human-gated route — the response
    // reports the teardown failure distinctly instead of a bare "not landed" error.
    const tc = await freshRepo("teardownconfirm");
    const tcLane = (await (await post("/api/lanes", { repo: tc.repo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${tcLane.cwd}/base.txt`, "base\ntc-lane\n"); // conflict on base.txt → agent path
    spawnSync("git", ["-C", tcLane.cwd, "commit", "-aqm", "tc lane work"]);
    await Bun.write(`${tc.repo}/base.txt`, "base\ntc-main\n");
    spawnSync("git", ["-C", tc.repo, "commit", "-aqm", "tc main work"]);
    const tcProbe = (await (await post("/api/lanes", { repo: tc.repo })).json()) as { slot: number };
    await setMergeMode("do");
    await settleForMerge(tcLane.slot);
    await post(`/api/slots/${tcLane.slot}/merge`, {});
    const tcV = await waitMerge(tcLane.slot);
    check("G1b setup: conflicting lane resolved + paused for review", !tcV.gone && tcV.last?.status === "resolved", JSON.stringify(tcV.last));
    const tcBefore = headOf(tc.repo, tc.main);
    spawnSync("chmod", ["555", tcLane.cwd]);
    const tcConfRes = await post(`/api/slots/${tcLane.slot}/merge`, { confirm: true });
    const tcConf = (await tcConfRes.json()) as { status?: string; landed?: boolean; landError?: string; error?: string };
    spawnSync("chmod", ["755", tcLane.cwd]);
    const tcAfter = headOf(tc.repo, tc.main);
    check("G1b setup: confirm-land advanced main, lane survived on disk",
      tcAfter !== tcBefore && exists(tcLane.cwd), `before=${tcBefore} after=${tcAfter} exists=${exists(tcLane.cwd)}`);
    check("G1b: confirm-land reports the teardown failure as its own landError field (merged, landed:false)",
      tcConf.status === "merged" && tcConf.landed === false
      && (tcConf.landError ?? "").includes("worktree remove failed"),
      `http=${tcConfRes.status} ${JSON.stringify(tcConf)}`);
    const tcNote = readNote(tc.repo, tcAfter);
    check("G1b: the confirm-land note exists despite the failed teardown, owned by the human",
      tcNote.ok && tcNote.json?.mainBefore === tcBefore && tcNote.json?.mainAfter === tcAfter
      && tcNote.json?.confirmedByHuman === true, JSON.stringify(tcNote.json));
    const tcUndoable = (await (await get(`/api/slots/${tcProbe.slot}/merge`)).json()) as { undoable?: { branch: string } | null };
    check("G1b: the undo record exists despite the failed teardown",
      tcUndoable.undoable?.branch === tcLane.branch, JSON.stringify(tcUndoable.undoable));
    await post(`/api/slots/${tcLane.slot}/kill`, {});
    await post(`/api/slots/${tcProbe.slot}/kill`, {});

    // (b) STALE-VERIFY guard: main moves between the verify (at resolve time) and the
    // owner's confirm; the replay lands cleanly — but the recorded verify never saw the
    // landed state ("a verdict is void once main moves past it"). The note must mark it
    // stale, never carry a silently stale green.
    const sv = await freshRepo("staleverify");
    const svLane = (await (await post("/api/lanes", { repo: sv.repo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${svLane.cwd}/base.txt`, "base\nsv-lane\n"); // conflict → agent resolves, verify runs
    spawnSync("git", ["-C", svLane.cwd, "commit", "-aqm", "sv lane work"]);
    await Bun.write(`${sv.repo}/base.txt`, "base\nsv-main\n");
    spawnSync("git", ["-C", sv.repo, "commit", "-aqm", "sv main work"]);
    await setMergeMode("do");
    await settleForMerge(svLane.slot);
    await post(`/api/slots/${svLane.slot}/merge`, {});
    const svV = await waitMerge(svLane.slot);
    check("G1c setup: lane resolved with a green verify bound to the pre-move main",
      !svV.gone && svV.last?.status === "resolved" && svV.last.verify?.ok === true
      && typeof svV.last.verify.mainSha === "string", JSON.stringify(svV.last?.verify));
    const svVerifiedSha = svV.last?.verify?.mainSha ?? "";
    await Bun.write(`${sv.repo}/moved.txt`, "moved after verify\n"); // unrelated move → replay lands
    spawnSync("git", ["-C", sv.repo, "add", "moved.txt"]);
    spawnSync("git", ["-C", sv.repo, "commit", "-qm", "sv main moved after verify"]);
    const svConf = (await (await post(`/api/slots/${svLane.slot}/merge`, { confirm: true })).json()) as { status?: string; landed?: boolean };
    check("G1c setup: the replayed confirm-land landed", svConf.status === "merged" && svConf.landed === true, JSON.stringify(svConf));
    const svAfter = headOf(sv.repo, sv.main);
    const svNote = readNote(sv.repo, svAfter);
    const svNoteVerify = svNote.json?.verify as VerifyField | undefined;
    check("G1c: the landed note marks the outdated verify STALE (never a silently stale green)",
      svNote.ok && svNoteVerify?.ok === true && svNoteVerify.stale === true,
      JSON.stringify(svNoteVerify));
    check("G1c: the stale verify still names the main it actually verified (≠ the landed mainBefore)",
      svNoteVerify?.mainSha === svVerifiedSha && svNote.json?.mainBefore !== svVerifiedSha,
      `verified=${svVerifiedSha} mainBefore=${String(svNote.json?.mainBefore)}`);

    // --- REPAIR LOOP: a conflict resolution that rebases clean but FAILS verify is repaired
    // in-loop (the resolver is fed the exact failure and fixes it), so the human reviews a
    // GREEN resolution instead of a dead-ended red one. Still human-gated — never auto-landed.
    // Non-tautology: with MERGE_REPAIR_ROUNDS=0 the verdict would be verify.ok:false, repairRounds
    // absent; the assertions below require the flip false→true AND repairRounds>=1. ---
    const rl = await freshRepo("repairloop");
    const rlLane = (await (await post("/api/lanes", { repo: rl.repo })).json()) as { slot: number; cwd: string; branch: string };
    // the lane's conflicting line carries the VERIFYBAD sabotage marker; -X theirs (fakemerge "do")
    // keeps the lane side, so the resolution rebases clean but verify is RED — the loop's trigger.
    await Bun.write(`${rlLane.cwd}/base.txt`, "base\nrl-lane VERIFYBAD\n");
    spawnSync("git", ["-C", rlLane.cwd, "commit", "-aqm", "rl lane work (sabotaged)"]);
    await Bun.write(`${rl.repo}/base.txt`, "base\nrl-main\n"); // same line on main → conflict → agent
    spawnSync("git", ["-C", rl.repo, "commit", "-aqm", "rl main work"]);
    await setMergeMode("do");
    await settleForMerge(rlLane.slot);
    await post(`/api/slots/${rlLane.slot}/merge`, {});
    const rlV = await waitMerge(rlLane.slot);
    check("repair loop: a resolution that fails verify is repaired to GREEN, still paused for review (not landed)",
      !rlV.gone && rlV.last?.status === "resolved" && rlV.last?.landed === false
      && rlV.last?.verify?.ok === true && (rlV.last?.repairRounds ?? 0) >= 1, JSON.stringify(rlV.last));
    // assert the FACT, not just the verdict: the marker is actually gone from the repaired tree
    check("repair loop: the VERIFYBAD marker is actually scrubbed from the repaired lane tree",
      !spawnSync("git", ["-C", rlLane.cwd, "grep", "-I", "VERIFYBAD"]).stdout.toString().includes("VERIFYBAD"),
      spawnSync("git", ["-C", rlLane.cwd, "log", "--oneline", "-3"]).stdout.toString());
    // and it never reached main — the human still gates the land
    check("repair loop: the repaired resolution has NOT auto-landed onto main",
      !spawnSync("git", ["-C", rl.repo, "log", "--oneline", "-5"]).stdout.toString().includes("rl lane work"),
      spawnSync("git", ["-C", rl.repo, "log", "--oneline", "-5"]).stdout.toString());

    // --- VERIFICATION TIER 2, DEFAULT OFF: the post-land audit is configured by a command
    // (FLEET_POSTLAND_AUDIT_CMD), and this suite sets none. Every land above — clean-path,
    // confirm-land, teardown-failure, stale-verify — therefore has to leave the land path exactly
    // as it was: no audit spawned, no trail, nothing on the board. The ON behaviour lives in its
    // own harness (./e2e-postland-audit.sh), which is also why an accidental nested suite run is
    // structurally impossible here: with no command set there is nothing to spawn.
    const pla = (await (await get("/api/post-land-audits")).json()) as
      { audits: unknown[]; total: number; configured: boolean };
    check("tier 2 default OFF: no command configured, so none of this suite's lands audited anything",
      pla.configured === false && pla.total === 0 && pla.audits.length === 0, JSON.stringify(pla));
    check("tier 2 default OFF: the board's poll payload carries no audit result",
      (((await (await get("/api/sessions")).json()) as { postLandAudit: unknown }).postLandAudit ?? null) === null);

    await setMergeMode("blocked"); // restore the suite default for later tests in this scope
  }
}
