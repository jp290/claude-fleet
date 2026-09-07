// One-gesture land, ↩ undo-land and its refusals, V2 git-note provenance, the G1 guarantees that
// provenance survives a failed teardown or a stale verify, and the resolver↔verify repair loop.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { REPO, REPO2, ROOT, check, get, post } from "./harness";
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
    const ogCommit = (await (await post(`/api/slots/${lane.slot}/commit`, { mode: "agent", confirm: true })).json()) as { committed?: boolean; subject?: string };
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

    // --- THE UNDO STACK: a pointer with a SHORT MEMORY (UNDO_STACK_MAX = 3) ------------------
    // One record per repo was only sufficient while the doctrine forbade a second land before the
    // post-land audit reported. That doctrine was retired on 2026-08-08 and `drainPostLandAudits`
    // states in its own contract that ONE audit may cover N lands — so a collective red could name
    // lands the single record had already forgotten. What follows pins the whole of the widened
    // shape: it stacks, it is capped, it breaks at a gap, it writes one ledger row per record, and
    // its remote gate covers every commit it would discard rather than only the tip.
    //
    // land a fresh lane carrying one commit per given file, and report the SHAs it moved main over
    const landWork = async (repo: string, files: string[]): Promise<{ branch: string; before: string; after: string }> => {
      const l = (await (await post("/api/lanes", { repo })).json()) as { slot: number; cwd: string; branch: string };
      for (const f of files) {
        await Bun.write(`${l.cwd}/${f}`, `${f} work\n`);
        spawnSync("git", ["-C", l.cwd, "add", f]);
        spawnSync("git", ["-C", l.cwd, "commit", "-qm", `work ${f}`]);
      }
      const before = headOf(repo, "main");
      await landClean(l.slot);
      return { branch: l.branch, before, after: headOf(repo, "main") };
    };
    const undoOnce = async (repo: string): Promise<{ status: number; error?: string; ok?: boolean }> => {
      const r = await post("/api/repos/undo-land", { repo });
      const j = (await r.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      return { status: r.status, ...j };
    };
    // the ledger is appended through a promise chain — poll for the rows rather than race the write
    const revertedRows = async (branches: string[]): Promise<{ branch?: string; disposition?: string }[]> => {
      for (let i = 0; i < 40; i++) {
        const all = ((await (await get("/api/lane-outcomes?limit=1000")).json()) as
          { outcomes: { branch?: string; disposition?: string }[] }).outcomes
          .filter((o) => o.disposition === "reverted" && branches.includes(o.branch ?? ""));
        if (all.length >= branches.length) return all;
        await Bun.sleep(100);
      }
      return ((await (await get("/api/lane-outcomes?limit=1000")).json()) as
        { outcomes: { branch?: string; disposition?: string }[] }).outcomes
        .filter((o) => o.disposition === "reverted" && branches.includes(o.branch ?? ""));
    };

    // (S1) POSITIVE CONTROL: two lands, two undos, main back at the FIRST land's mainBefore —
    // and the board offers the older land the moment the newer one is undone (a stack, not a
    // record that merely survived).
    const st = await freshRepo("undostack");
    const st1 = await landWork(st.repo, ["s1.txt"]);
    const st2 = await landWork(st.repo, ["s2.txt"]);
    const stProbe = (await (await post("/api/lanes", { repo: st.repo })).json()) as { slot: number };
    const undoableOf = async (slot: number): Promise<string | null> =>
      ((await (await get(`/api/slots/${slot}/merge`)).json()) as { undoable?: { branch: string } | null }).undoable?.branch ?? null;
    check("undo stack: setup — two lands in a row, each advancing main",
      st1.after === st2.before && st1.before !== st1.after && st2.before !== st2.after,
      `${st1.before.slice(0, 8)} -> ${st1.after.slice(0, 8)} -> ${st2.after.slice(0, 8)}`);
    check("undo stack: the board offers the NEWEST land first", await undoableOf(stProbe.slot) === st2.branch);
    const stU1 = await undoOnce(st.repo);
    check("undo stack: the first undo reverses the newest land only (main back at its mainBefore)",
      stU1.ok === true && headOf(st.repo, st.main) === st2.before,
      `${JSON.stringify(stU1)} now=${headOf(st.repo, st.main)} want=${st2.before}`);
    check("undo stack: …and the land UNDER it becomes the next ↩ (the memory is a stack, not one record)",
      await undoableOf(stProbe.slot) === st1.branch);
    const stU2 = await undoOnce(st.repo);
    check("undo stack: the second undo reaches the FIRST land's mainBefore",
      stU2.ok === true && headOf(st.repo, st.main) === st1.before,
      `${JSON.stringify(stU2)} now=${headOf(st.repo, st.main)} want=${st1.before}`);
    check("undo stack: both landed branches still exist (two rewinds, nothing destroyed)",
      spawnSync("git", ["-C", st.repo, "rev-parse", "--verify", "-q", `refs/heads/${st1.branch}`]).status === 0
      && spawnSync("git", ["-C", st.repo, "rev-parse", "--verify", "-q", `refs/heads/${st2.branch}`]).status === 0);
    check("undo stack: an emptied stack has nothing left to undo", (await undoOnce(st.repo)).status === 404);
    // …and the LEDGER counted both. One `reverted` row per record undone — two lands back must
    // read as two reverts, or the trail understates what was taken off main.
    const stRows = await revertedRows([st1.branch, st2.branch]);
    check("undo stack: EXACTLY ONE reverted ledger row per record undone (two lands back = two rows)",
      stRows.length === 2 && stRows.filter((r) => r.branch === st1.branch).length === 1
      && stRows.filter((r) => r.branch === st2.branch).length === 1,
      JSON.stringify(stRows));
    await post(`/api/slots/${stProbe.slot}/kill`, {});

    // (S2) THE CAP HOLDS, and the refusal says why. Four lands on a 3-deep stack: the oldest is
    // gone, and the refusal must name the cap rather than read like "this repo never landed".
    const cp = await freshRepo("undocap");
    const cp1 = await landWork(cp.repo, ["c1.txt"]);
    await landWork(cp.repo, ["c2.txt"]);
    await landWork(cp.repo, ["c3.txt"]);
    await landWork(cp.repo, ["c4.txt"]);
    const cpU = [await undoOnce(cp.repo), await undoOnce(cp.repo), await undoOnce(cp.repo)];
    check("undo cap: the three newest lands are all reversible",
      cpU.every((r) => r.ok === true), JSON.stringify(cpU));
    check("undo cap: three undos rewind exactly to the OLDEST KEPT land's mainBefore, not further",
      headOf(cp.repo, cp.main) === cp1.after && cp1.after !== cp1.before,
      `now=${headOf(cp.repo, cp.main)} want=${cp1.after} (first land's mainBefore=${cp1.before})`);
    const cpU4 = await undoOnce(cp.repo);
    check("undo cap: the 4th land back is NOT reversible — it aged out of the stack",
      cpU4.status === 404 && headOf(cp.repo, cp.main) !== cp1.before, `${JSON.stringify(cpU4)} main=${headOf(cp.repo, cp.main)}`);
    check("undo cap: …and the refusal SAYS SO (names the cap, never a bare 'nothing recorded')",
      /at most 3 lands/.test(cpU4.error ?? "") && /left this repo's undo stack/.test(cpU4.error ?? ""), cpU4.error);

    // (S3) A GAP BREAKS THE CHAIN. The stack is a rewind path only while each record starts
    // exactly where the one below it ended — CHECKED (`stack[n].mainBefore === stack[n-1].mainAfter`
    // in pushUndo), never assumed. A commit fleet did not land sits between these two, so the older
    // record is unreachable and must be dropped WITH ITS REASON, not discovered as a confusing
    // "main moved" one refusal later.
    const gp = await freshRepo("undogap");
    const gp1 = await landWork(gp.repo, ["g1.txt"]);
    await Bun.write(`${gp.repo}/byhand.txt`, "not landed by fleet\n"); // the gap
    spawnSync("git", ["-C", gp.repo, "add", "byhand.txt"]);
    spawnSync("git", ["-C", gp.repo, "commit", "-qm", "hand commit on main"]);
    const gpHand = headOf(gp.repo, gp.main);
    const gp2 = await landWork(gp.repo, ["g2.txt"]);
    check("undo gap: setup — the hand commit really sits between the two lands",
      gp1.after !== gpHand && gp2.before === gpHand, `${gp1.after.slice(0, 8)} | ${gpHand.slice(0, 8)} | ${gp2.before.slice(0, 8)}`);
    const gpU1 = await undoOnce(gp.repo);
    check("undo gap: the land above the gap is still reversible (down to the hand commit, not past it)",
      gpU1.ok === true && headOf(gp.repo, gp.main) === gpHand,
      `${JSON.stringify(gpU1)} now=${headOf(gp.repo, gp.main)} want=${gpHand}`);
    const gpU2 = await undoOnce(gp.repo);
    check("undo gap: the land BELOW the gap was dropped at land time — refused as a gap, not as 'main moved'",
      gpU2.status === 404 && /did not start where the previous land ended/.test(gpU2.error ?? ""), `${gpU2.status} ${gpU2.error}`);
    check("undo gap: …and the hand commit is untouched by the refusal",
      headOf(gp.repo, gp.main) === gpHand && spawnSync("git", ["-C", gp.repo, "cat-file", "-e", gpHand]).status === 0);

    // (S4) THE SAFETY GATE COVERS EVERY RECORD, AND EVERY COMMIT OF IT. The remote probe asks
    // about the whole range an undo would discard, not just its tip: a remote branch parked on an
    // INTERMEDIATE commit of an older land leaves that land's tip contained by nothing, so a
    // tip-only probe would rewind past shared history. The newer land here is on NO remote and
    // undoes fine — the refusal comes from the older record's own commits, when its turn arrives.
    const rr = await freshRepo("undorange");
    spawnSync("git", ["init", "--bare", "-q", `${rr.repo}.remote.git`]);
    spawnSync("git", ["-C", rr.repo, "remote", "add", "origin", `${rr.repo}.remote.git`]);
    const rr1 = await landWork(rr.repo, ["r1a.txt", "r1b.txt"]); // TWO commits — the tip is not the whole land
    const rr2 = await landWork(rr.repo, ["r2.txt"]);
    const rrMid = spawnSync("git", ["-C", rr.repo, "rev-parse", `${rr1.after}^`]).stdout.toString().trim(); // r1a: inside rr1's range, not its tip
    spawnSync("git", ["-C", rr.repo, "push", "-q", "origin", `${rrMid}:refs/heads/keep`]);
    spawnSync("git", ["-C", rr.repo, "fetch", "-q", "origin"]);
    // the CONTROL that makes this a test of the range and not of the tip: the record's own
    // mainAfter is on no remote at all, so the tip-only probe this replaces would have allowed it
    check("undo remote-range: control — the older land's TIP is on no remote (a tip-only probe would pass it)",
      spawnSync("git", ["-C", rr.repo, "branch", "-r", "--contains", rr1.after]).stdout.toString().trim() === ""
      && spawnSync("git", ["-C", rr.repo, "branch", "-r", "--contains", rrMid]).stdout.toString().includes("origin/keep"),
      `tip=${rr1.after.slice(0, 8)} mid=${rrMid.slice(0, 8)}`);
    const rrU1 = await undoOnce(rr.repo);
    check("undo remote-range: the newer land, on no remote, still undoes",
      rrU1.ok === true && headOf(rr.repo, rr.main) === rr2.before, `${JSON.stringify(rrU1)} now=${headOf(rr.repo, rr.main)}`);
    const rrU2 = await undoOnce(rr.repo);
    check("undo remote-range: the older land is REFUSED — one of ITS commits is on a remote, tip or not",
      rrU2.status === 409 && (rrU2.error ?? "").includes(rrMid.slice(0, 8)) && /remote/.test(rrU2.error ?? ""),
      `${rrU2.status} ${rrU2.error}`);
    check("undo remote-range: the refusal moved nothing — main still sits on the older land's tip",
      headOf(rr.repo, rr.main) === rr1.after, `now=${headOf(rr.repo, rr.main)} want=${rr1.after}`);

    // --- REGRESSION GUARD: a CONFLICTING one-gesture land still PAUSES for review (human gate) ---
    const cf = await freshRepo("conflict");
    const cfLane = (await (await post("/api/lanes", { repo: cf.repo })).json()) as { slot: number; cwd: string };
    await Bun.write(`${cfLane.cwd}/base.txt`, "base\nlane-side\n"); // uncommitted — one-gesture commits it
    check("regression guard: one-gesture commits the dirty conflicting lane",
      ((await (await post(`/api/slots/${cfLane.slot}/commit`, { mode: "quick", confirm: true })).json()) as { committed?: boolean }).committed === true);
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

    // --- DOCS-PROPORTIONAL LAND GATE -----------------------------------------------------------
    // The test server gives the two-step docs chain and the full chain different executables. A
    // command-selection regression therefore changes the observable command/output, not merely a
    // label. All three candidates are clean rebases and green, so each also leaves the authoritative
    // server-written note behind for the chain provenance check.
    const landProportionCase = async (name: string, files: Record<string, string>) => {
      const l = (await (await post("/api/lanes", { repo: REPO })).json()) as
        { slot: number; cwd: string; branch: string };
      for (const [file, content] of Object.entries(files)) {
        mkdirSync(`${l.cwd}/${file.split("/").slice(0, -1).join("/")}`, { recursive: true });
        await Bun.write(`${l.cwd}/${file}`, content);
      }
      spawnSync("git", ["-C", l.cwd, "add", "-A"]);
      const committed = spawnSync("git", ["-C", l.cwd, "commit",
        ...(Object.keys(files).length === 0 ? ["--allow-empty"] : []), "-qm", `${name} proportional gate fixture`]);
      if (committed.status !== 0)
        throw new Error(`${name} proportional-gate fixture did not commit: ${committed.stderr.toString().slice(0, 200)}`);
      const before = headOf(REPO, "main");
      await landClean(l.slot);
      const after = headOf(REPO, "main");
      const note = readNote(REPO, after);
      return { landed: before !== after && (await get(`/api/slots/${l.slot}/merge`)).status === 400,
        verify: note.json?.verify as VerifyField | undefined, note };
    };
    const docsGate = await landProportionCase("docs-only", {
      "docs/proportional-only.md": "measurement note\n",
    });
    check("docs-proportional gate: a docs-only lane runs the short chain and lands",
      docsGate.landed && docsGate.verify?.ok === true
      && docsGate.verify.cmd.includes("bun install --frozen-lockfile")
      && docsGate.verify.cmd.endsWith("bun e2e/pins.ts")
      && docsGate.verify.out.includes("proportional fixture pins PASS"), JSON.stringify(docsGate));

    const fullSteps = ["install", "pins", "tsc", "build", "clean-review", "security", "claude-gate"];
    const mixedGate = await landProportionCase("mixed", {
      "docs/proportional-mixed.md": "measurement note\n",
      "src/proportional-mixed.ts": "export const measured = true;\n",
    });
    check("docs-proportional gate: a mixed docs+code lane runs the full chain",
      mixedGate.landed && mixedGate.verify?.ok === true
      && mixedGate.verify.cmd === process.env.FLEET_VERIFY_CMD
      && mixedGate.verify.proportional === false
      && JSON.stringify(mixedGate.verify.steps) === JSON.stringify(fullSteps), JSON.stringify(mixedGate));

    const codeGate = await landProportionCase("one-code-file", {
      "src/proportional-code.ts": "export const oneCodeFile = true;\n",
    });
    check("docs-proportional gate: even one code file runs the full chain",
      codeGate.landed && codeGate.verify?.ok === true
      && codeGate.verify.cmd === process.env.FLEET_VERIFY_CMD
      && codeGate.verify.proportional === false
      && JSON.stringify(codeGate.verify.steps) === JSON.stringify(fullSteps), JSON.stringify(codeGate));

    const emptyGate = await landProportionCase("empty-diff", {});
    check("docs-proportional gate: an empty diff never counts as harmless and runs the full chain",
      emptyGate.landed && emptyGate.verify?.ok === true
      && emptyGate.verify.cmd === process.env.FLEET_VERIFY_CMD
      && emptyGate.verify.proportional === false
      && JSON.stringify(emptyGate.verify.steps) === JSON.stringify(fullSteps), JSON.stringify(emptyGate));

    check("docs-proportional gate: the land note marks a short green with its exact steps",
      docsGate.note.ok && docsGate.verify?.proportional === true
      && JSON.stringify(docsGate.verify.steps) === JSON.stringify(["install", "pins"]),
      JSON.stringify(docsGate.note.json?.verify));
    check("docs-proportional gate: the short chain is repo-guarded and the guard passed in THIS repo",
      docsGate.verify?.cmd.startsWith('[ -f fleet-e2e.ts ] || { echo "verify skipped: not the fleet repo"; exit 42; }; ') === true
      && docsGate.verify.ok === true && !docsGate.verify.out.includes("verify skipped:"),
      JSON.stringify(docsGate.verify));

    // --- W3 · A WAVE LANDS ONCE ----------------------------------------------------------------
    // The hard half of the ▸ start wave done-sentence (docs/queue-wellen-2026-09-06.md §5 S3): n
    // queue rows founded into ONE lane must leave exactly ONE fleet/land note, ONE undo record and
    // ONE audit cover behind, and all n rows must go to `done` together. Every one of those is a
    // property of the LAND, so this is where it is measured — the door's own refusals, the N:1
    // binding and the self-split are checked in e2e/tasks.ts, where the queue lives.
    //
    // The cover is measured through the note's `verify.proportional`: `recordLand` passes exactly
    // `prov.verify?.proportional === true` to schedulePostLandAudit, and `entryRunsShortChain`
    // reads that same field back off `covers[]`. Tier 2 is OFF in this suite by design (see the
    // block at the end of this module), so the note is the field's authoritative reading here, and
    // e2e/pins.ts holds the two source ends of that pass-through together.
    //
    // AND THE SURFACE IS NOT THE DIFF, deliberately: both rows declare AGENTS.md, the lane writes
    // two OTHER docs files. If the gate ever classified the declared surface instead of the actual
    // rebased diff, this land would still read docs — so the negative half lives in the mixed case
    // above, and what this proves is that a wave changes nothing about which command is chosen.
    {
      // CONFIRMED is enough and `activate` is deliberately not called: the sensor's second
      // bundling criterion is that the rows carry the SAME programId, and it reads no status —
      // activating one here would add a moving part this check has no opinion about.
      const wvProposed = (await (await post("/api/programs", {
        title: "Wave land provenance program",
        intent: "Two rows of one program that land together in one lane.",
        successCriterion: "One land leaves one note, one undo record and both rows done.",
        nonGoals: [], decisions: [], evidence: [], openQuestions: [],
      })).json()) as { program?: { id?: string } };
      const wvProg = wvProposed.program?.id ?? "";
      if (wvProg) await post(`/api/programs/${wvProg}/confirm`, {});
      const wvMint = async (text: string): Promise<string> => {
        const r = (await (await post("/api/tasks", { text, queue: false, repo: REPO, programId: wvProg })).json()) as
          { task?: { id?: string } };
        return r.task?.id ?? "";
      };
      // Both rows name AGENTS.md — tracked in the fixture repo and docs-or-prose, so the sensor
      // classes the wave `docs`; a gate-changing path would be refused by R2 and this would then
      // be measuring R2.
      const wvA = await wvMint("wave land one: the first half of AGENTS.md");
      const wvB = await wvMint("wave land two: the second half of AGENTS.md");
      for (const id of [wvA, wvB]) await post(`/api/tasks/${id}/files`, { files: ["AGENTS.md"] });
      check("(w3) fixture: two rows of one Program, both with an owner-CONFIRMED surface",
        !!wvProg && !!wvA && !!wvB, JSON.stringify({ program: wvProg, a: wvA, b: wvB }));

      const wvSess = async (): Promise<{ slots: { id: number; cwd: string | null }[];
        tasks: { id: string; status: string; note?: string | null }[] }> =>
        (await (await get("/api/sessions")).json()) as {
          slots: { id: number; cwd: string | null }[];
          tasks: { id: string; status: string; note?: string | null }[] };
      // THE UNDO STACK IS PERSISTED STATE, not poll payload: `/api/sessions` carries no `undoLands`
      // key at all, so reading it there returned 0 before AND 0 after and the check reported "no
      // undo record was written" for a land that had written one. A probe that could not measure
      // must fail as ITSELF — so this returns null on an unreadable state file, and its own check
      // below says so, rather than letting an absence read as a count.
      const wvUndoTotal = async (): Promise<number | null> => {
        for (let i = 0; i < 40; i++) {
          try {
            const st = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
              { undoLands?: Record<string, unknown[]> };
            if (st.undoLands) return Object.values(st.undoLands).reduce((n, recs) => n + recs.length, 0);
            return 0; // the key is absent while no land is undoable — a real zero, not an unreadable one
          } catch { /* saveState writes tmp+rename; a read landing mid-write throws */ }
          await Bun.sleep(100);
        }
        return null;
      };
      const wvNotes = (): number => spawnSync("git", ["-C", REPO, "notes", "--ref=fleet/land", "list"])
        .stdout.toString().split("\n").filter(Boolean).length;
      const wvUndoBefore = await wvUndoTotal();
      const wvNotesBefore = wvNotes();

      const wvSince1 = Date.now();
      const wvRes = await post("/api/wave/dispatch", { ids: [wvA, wvB] });
      const wvBody = (await wvRes.json()) as { ok?: boolean; slot?: number; branch?: string; error?: string;
        wave?: { ids: string[]; klasse: string } };
      check("(w3) the wave started as ONE docs lane on both rows",
        wvRes.ok && wvBody.wave?.klasse === "docs" && wvBody.wave.ids.length === 2
        && typeof wvBody.slot === "number",
        `${wvRes.status} ${JSON.stringify(wvBody)}`);
      const wvSlot = wvBody.slot ?? 0;
      const wvCwd = wvSlot ? ((await wvSess()).slots.find((x) => x.id === wvSlot)?.cwd ?? "") : "";
      // WAIT FOR THE BRIEF, not for a clock: until it is delivered the dispatch tail can still
      // requeue the whole wave, and a land raced against that would be measuring the race. Scoped
      // by `since` for the reason e2e/programs.ts states — slot ids are recycled and this run
      // delivers more than one wave brief, so an unscoped poll returns on the PREVIOUS wave's
      // prompt and the wait it was supposed to perform never happens.
      const wvWaitBrief = async (slot: number, since: number): Promise<boolean> => {
        for (let i = 0; i < 120 && slot; i++) {
          const j = (await (await get("/api/prompts?limit=50&q=WELLE")).json()) as
            { prompts: { ts?: number; slot?: number; text?: string }[] };
          if (j.prompts.some((x) => x.slot === slot && typeof x.ts === "number" && x.ts >= since
            && (x.text ?? "").includes("EIN LAND"))) return true;
          await Bun.sleep(250);
        }
        return false;
      };
      const wvBriefed = await wvWaitBrief(wvSlot, wvSince1);
      check("(w3) fixture: the wave brief reached the lane before anything was committed into it",
        wvBriefed && !!wvCwd, `briefed=${wvBriefed} cwd=${wvCwd || "none"}`);

      if (wvCwd && wvBriefed) {
        // ONE COMMIT PER ROW — the brief's own first rule, and the thing that buys a red audit its
        // bisect back. Two DOCS files, neither of them the declared surface.
        for (const [n, id] of (wvBody.wave?.ids ?? []).entries()) {
          await Bun.write(`${wvCwd}/docs/wave-land-${n + 1}.md`, `wave row ${id}\n`);
          spawnSync("git", ["-C", wvCwd, "add", `docs/wave-land-${n + 1}.md`]);
          spawnSync("git", ["-C", wvCwd, "commit", "-qm", `docs(wave): ${id}`]);
        }
        const wvMainBefore = headOf(REPO, "main");
        await landClean(wvSlot);
        const wvMainAfter = headOf(REPO, "main");
        const wvNote = readNote(REPO, wvMainAfter);
        const wvVerify = wvNote.json?.verify as VerifyField | undefined;
        check("(w3) LAND: the wave lane landed — main moved to the lane tip",
          wvMainBefore !== wvMainAfter && (await get(`/api/slots/${wvSlot}/merge`)).status === 400,
          `${wvMainBefore.slice(0, 8)} → ${wvMainAfter.slice(0, 8)}`);
        check("(w3) ONE fleet/land note for the whole wave — not one per row",
          wvNotes() === wvNotesBefore + 1 && wvNote.ok,
          `${wvNotesBefore} → ${wvNotes()} note(s), note readable=${wvNote.ok}`);
        const wvUndoAfter = await wvUndoTotal();
        check("(w3) probe: the undo stack was readable on BOTH sides of the land (a delta over an absence is not a measurement)",
          wvUndoBefore !== null && wvUndoAfter !== null, `${wvUndoBefore} → ${wvUndoAfter}`);
        check("(w3) ONE undo-land record for the whole wave — the wave costs the undo stack what one land costs it",
          wvUndoBefore !== null && wvUndoAfter === wvUndoBefore + 1,
          `${wvUndoBefore} → ${wvUndoAfter} record(s)`);
        // …and the field the audit cover is built from. `proportional` is true because the ACTUAL
        // diff is docs-only, which is also true of every row in this wave — the two coincide here,
        // and the mixed/code cases above are what prove the gate reads the diff and not the class.
        check("(w3) the land note's verify is the SHORT chain — an all-docs wave buys the audit cover its proportional",
          wvVerify?.proportional === true && wvVerify.ok === true
          && JSON.stringify(wvVerify.steps) === JSON.stringify(["install", "pins"]),
          JSON.stringify(wvVerify ?? null));
        const wvRows = (await wvSess()).tasks;
        const wvDoneA = wvRows.find((t) => t.id === wvA);
        const wvDoneB = wvRows.find((t) => t.id === wvB);
        check("(w3) ALL n rows go to `done` on the one land, both naming the branch that landed them",
          wvDoneA?.status === "done" && wvDoneB?.status === "done"
          && (wvDoneA.note ?? "").includes(wvBody.branch ?? "\u0000")
          && (wvDoneB.note ?? "").includes(wvBody.branch ?? "\u0000"),
          JSON.stringify({ a: wvDoneA, b: wvDoneB, branch: wvBody.branch }));
      }
      for (const id of [wvA, wvB]) await post(`/api/tasks/${id}/delete`, {});

      // ...AND THE OTHER HALF OF "genau dann wenn". The done sentence says the cover's
      // `proportional` is true EXACTLY when all n rows were docs — so a wave that DECLARES docs and
      // whose lane then touches a code file has to come out false, or the field would be a
      // statement about the declaration instead of about the tree. This is the owner's case (ii)
      // of 2026-09-07 ("die Flaeche war zu klein"): the gate stays correct, and the price is the
      // bisect, which is exactly why the split door exists beside it.
      const wvC = await wvMint("wave land three: AGENTS.md again, but the work reaches further");
      const wvD = await wvMint("wave land four: AGENTS.md once more");
      for (const id of [wvC, wvD]) await post(`/api/tasks/${id}/files`, { files: ["AGENTS.md"] });
      const wvSince2 = Date.now();
      const wvRes2 = await post("/api/wave/dispatch", { ids: [wvC, wvD] });
      const wvBody2 = (await wvRes2.json()) as { ok?: boolean; slot?: number; error?: string;
        wave?: { ids: string[]; klasse: string } };
      const wvSlot2 = wvBody2.slot ?? 0;
      const wvCwd2 = wvSlot2 ? ((await wvSess()).slots.find((x) => x.id === wvSlot2)?.cwd ?? "") : "";
      check("(w3) fixture: a second wave, declared `docs` by the sensor exactly like the first",
        wvRes2.ok && wvBody2.wave?.klasse === "docs" && !!wvCwd2,
        `${wvRes2.status} ${JSON.stringify(wvBody2)} cwd=${wvCwd2 || "none"}`);
      const wvBriefed2 = await wvWaitBrief(wvSlot2, wvSince2);
      check("(w3) fixture: the second wave's brief reached its lane before anything was committed",
        wvBriefed2, `slot=${wvSlot2} since=${wvSince2}`);
      if (wvCwd2 && wvBriefed2) {
        await Bun.write(`${wvCwd2}/docs/wave-land-3.md`, `wave row ${wvC}\n`);
        spawnSync("git", ["-C", wvCwd2, "add", "docs/wave-land-3.md"]);
        spawnSync("git", ["-C", wvCwd2, "commit", "-qm", `docs(wave): ${wvC}`]);
        await Bun.write(`${wvCwd2}/src/wave-land-4.ts`, "export const surfaceWasTooSmall = true;\n");
        spawnSync("git", ["-C", wvCwd2, "add", "src/wave-land-4.ts"]);
        spawnSync("git", ["-C", wvCwd2, "commit", "-qm", `feat(wave): ${wvD}`]);
        await landClean(wvSlot2);
        const wvVerify2 = readNote(REPO, headOf(REPO, "main")).json?.verify as VerifyField | undefined;
        check("(w3) a wave that DECLARED docs but touched code runs the FULL chain — the gate reads the diff, never the declaration",
          wvVerify2?.proportional === false && wvVerify2.ok === true
          && wvVerify2.cmd === process.env.FLEET_VERIFY_CMD,
          JSON.stringify(wvVerify2 ?? null));
        const wvRows2 = (await wvSess()).tasks;
        check("(w3) …and both rows of that wave still go to `done` on the one land",
          wvRows2.find((t) => t.id === wvC)?.status === "done"
          && wvRows2.find((t) => t.id === wvD)?.status === "done",
          JSON.stringify(wvRows2.filter((t) => t.id === wvC || t.id === wvD)));
      }
      for (const id of [wvC, wvD]) await post(`/api/tasks/${id}/delete`, {});
    }

    // --- A DOCS-ONLY CANDIDATE IN A REPO THAT IS NOT THIS ONE -----------------------------------
    // Docs-only is a property of the DIFF; being verifiable by `bun e2e/pins.ts` is a property of
    // the REPO, and until 2026-08-26 `proportional` asked only the first. So any repo whose
    // candidate happened to be docs-only had its OWN configured command replaced by the fleet's
    // short chain, which then hit its own `[ -f fleet-e2e.ts ]` guard and exited 42: SKIPPED,
    // ok:null, no auto-land — and nothing measured, in a repo that has a real gate configured for
    // it. Twice live on 2026-08-26 (private-repo-j lands 5ddfcea and 6d9a1cd, both noted
    // `proportional:true, steps:["install","pins"], exitCode:42`).
    // These two assert the repo half of the question, on the fixture with NO map entry: the global
    // FLEET_VERIFY_CMD runs, it measures the tree, and the note stamps the full chain it ran.
    // Mutation guard: drop `&& repoRunsShortChain(repo)` from verifyPlanFor and the fleet-shaped
    // command is chosen again — cmd stops being fakeverify, out says "verify skipped: not the
    // fleet repo", ok goes null and the land never happens.
    // The guard inside VERIFY_PROPORTIONAL_CMD stays the second line of defense (it is what still
    // catches a FLEET lane that moved the sentinel); that it is still IN the string is pinned
    // statically by e2e/pins.ts, which is where that half is now asserted from.
    const foreign = await freshRepo("proportional-foreign");
    const fgLane = (await (await post("/api/lanes", { repo: foreign.repo })).json()) as
      { slot: number; cwd: string; branch: string };
    mkdirSync(`${fgLane.cwd}/docs`, { recursive: true });
    await Bun.write(`${fgLane.cwd}/docs/foreign-note.md`, "a docs-only change in a foreign repo\n");
    spawnSync("git", ["-C", fgLane.cwd, "add", "-A"]);
    // retried like the skip family in e2e/merge.ts: the server polls lane git state on a timer, and
    // a poll holding index.lock makes a one-shot commit fail — an empty candidate would take the
    // conservative FULL chain and report this case's own failure for the wrong reason
    let fgCommitted = false;
    for (let i = 0; i < 20 && !fgCommitted; i++) {
      fgCommitted = spawnSync("git", ["-C", fgLane.cwd, "commit", "-qm", "foreign docs-only candidate"]).status === 0;
      if (!fgCommitted) await Bun.sleep(150);
    }
    check("foreign-repo docs-only setup: the candidate committed (precondition — an empty diff takes the full chain for another reason)",
      fgCommitted, spawnSync("git", ["-C", fgLane.cwd, "status", "--porcelain"]).stdout.toString().trim());
    const fgBefore = headOf(foreign.repo, foreign.main);
    await landClean(fgLane.slot);
    const fgAfter = headOf(foreign.repo, foreign.main);
    const fgVerify = readNote(foreign.repo, fgAfter).json?.verify as VerifyField | undefined;
    check("docs-proportional gate: a docs-only candidate in a foreign repo runs THAT REPO'S configured chain, not the fleet short chain",
      fgVerify?.ok === true && fgVerify.cmd === process.env.FLEET_VERIFY_CMD
      && !fgVerify.out.includes("verify skipped: not the fleet repo")
      && fgVerify.out.includes("verify OK: no sabotage marker in the tree"), JSON.stringify(fgVerify));
    check("docs-proportional gate: the foreign-repo note stamps the FULL chain it actually ran, never install+pins",
      fgVerify?.proportional === false
      && JSON.stringify(fgVerify.steps) === JSON.stringify(fullSteps), JSON.stringify(fgVerify));
    check("docs-proportional gate: measured green, the foreign docs-only lane LANDS (the skip used to stop it here)",
      fgAfter !== fgBefore && (await get(`/api/slots/${fgLane.slot}/merge`)).status === 400,
      JSON.stringify({ before: fgBefore, after: fgAfter }));

    // --- THE SAME CASE WHERE THE REPO HAS ITS OWN ENTRY, AND THE GATE HAS SOMETHING TO SAY --------
    // testrepo2 is the one fixture repo with its own FLEET_VERIFY_CMD_REPOS command ($DIR/
    // fakeverify2) — the production shape of the incident: a product repo for which a real verify
    // IS configured. The docs-only candidate carries fakeverify2's own sabotage marker, so the
    // check is not "a different string was recorded" but "that command READ THIS TREE": only
    // fakeverify2 knows VERIFY2BAD, and the short chain would never have looked. This is the half
    // the note's own words cannot fake — under the old behaviour the whole tree went unmeasured.
    // Mutation guard: drop `&& repoRunsShortChain(repo)` from verifyPlanFor and this lane's
    // sabotage is never seen — ok:null with "verify skipped: not the fleet repo" instead of red.
    if (REPO2 && exists(REPO2)) {
      const r2Lane = (await (await post("/api/lanes", { repo: REPO2 })).json()) as
        { slot: number; cwd: string; branch: string };
      mkdirSync(`${r2Lane.cwd}/docs`, { recursive: true });
      await Bun.write(`${r2Lane.cwd}/docs/proportional-sabotage.md`,
        "a docs-only change carrying a VERIFY2BAD marker only fakeverify2 knows\n");
      spawnSync("git", ["-C", r2Lane.cwd, "add", "-A"]);
      let r2Committed = false;
      for (let i = 0; i < 20 && !r2Committed; i++) {
        r2Committed = spawnSync("git", ["-C", r2Lane.cwd, "commit", "-qm", "repo2 docs-only sabotage candidate"]).status === 0;
        if (!r2Committed) await Bun.sleep(150);
      }
      check("per-repo docs-only setup: the sabotage candidate committed (an uncommitted marker verifies GREEN and lands)",
        r2Committed, spawnSync("git", ["-C", r2Lane.cwd, "status", "--porcelain"]).stdout.toString().trim());
      const r2Before = headOf(REPO2, "main");
      await setMergeMode("blocked"); // clean rebase — the agent is never consulted
      await settleForMerge(r2Lane.slot);
      await post(`/api/slots/${r2Lane.slot}/merge`, {});
      const r2V = await waitMerge(r2Lane.slot);
      const r2Verify = r2V.last?.verify;
      check("docs-proportional gate: a docs-only candidate in a repo WITH its own FLEET_VERIFY_CMD_REPOS entry runs that entry",
        r2Verify?.cmd?.endsWith("fakeverify2") === true
        && !(r2Verify.out ?? "").includes("verify skipped: not the fleet repo"),
        JSON.stringify(r2Verify?.cmd));
      check("docs-proportional gate: that command READ the docs-only tree — it names the marker only it knows",
        (r2Verify?.out ?? "").includes("verify2 FAIL") && (r2Verify?.out ?? "").includes("VERIFY2BAD"),
        JSON.stringify((r2Verify?.out ?? "").slice(0, 200)));
      check("docs-proportional gate: the red verdict keeps the lane and holds main — a docs diff buys no exemption",
        r2Verify?.ok === false && r2Verify.proportional === false
        && JSON.stringify(r2Verify.steps) === JSON.stringify(fullSteps)
        && !r2V.gone && r2V.last?.status === "resolved" && r2V.last.landed === false
        && headOf(REPO2, "main") === r2Before,
        JSON.stringify({ ok: r2Verify?.ok, proportional: r2Verify?.proportional, steps: r2Verify?.steps,
          gone: r2V.gone, landed: r2V.last?.landed, main: headOf(REPO2, "main"), before: r2Before }));
      await post(`/api/slots/${r2Lane.slot}/kill`, {});
      await post("/api/worktrees/discard", { repo: REPO2, path: r2Lane.cwd, branch: r2Lane.branch });
    } else {
      check("per-repo docs-only setup: testrepo2 exists (precondition — this check is about WHICH command ran)",
        false, JSON.stringify({ REPO2 }));
    }

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
    // tolerate a non-JSON body (a server without the route answers 404/HTML): this must fail as
    // ONE check, not abort the suite at the parse — the checks after it are unrelated
    const pla = (await (await get("/api/post-land-audits")).json().catch(() => ({}))) as
      { audits?: unknown[]; total?: number; configured?: boolean };
    check("tier 2 default OFF: no command configured, so none of this suite's lands audited anything",
      pla.configured === false && pla.total === 0 && pla.audits?.length === 0, JSON.stringify(pla));
    check("tier 2 default OFF: the board's poll payload carries no audit result",
      (((await (await get("/api/sessions")).json()) as { postLandAudit: unknown }).postLandAudit ?? null) === null);

    // A TORN row must read as a hole, not as a cap. Every ledger route used to answer
    // `total: lines.length` while the array excluded whatever it could not parse, so one
    // half-written mid-append line arrived at the client as the benign "latest 1 of 2" message —
    // a lost row rendered as a display limit. This trail is the one ledger nothing in this suite
    // writes (tier 2 is OFF here), so it can be planted deterministically and removed again.
    const plaFile = `${ROOT}/post-land-audits.jsonl`;
    await Bun.write(plaFile, `${JSON.stringify({ at: 1, result: "green", covers: [] })}\n`
      + `{"at":2,"result":"red","cove\n`  // a mid-append tear: the writer died between bytes
      + `${JSON.stringify({ at: 3, result: "green", covers: [] })}\n`);
    const plaTorn = (await (await get("/api/post-land-audits")).json().catch(() => ({}))) as
      { audits?: unknown[]; total?: number; malformed?: number };
    check("ledger read: a torn row is COUNTED as malformed, never folded into the total",
      plaTorn.malformed === 1 && plaTorn.total === 2 && plaTorn.audits?.length === 2, JSON.stringify(plaTorn));
    rmSync(plaFile, { force: true });
    check("ledger read: the planted trail is gone again (tier 2 stays OFF for the rest of the suite)",
      (((await (await get("/api/post-land-audits")).json()) as { total?: number; malformed?: number }).total === 0)
      && ((await (await get("/api/post-land-audits")).json()) as { malformed?: number }).malformed === 0);

    await setMergeMode("blocked"); // restore the suite default for later tests in this scope
  }
}
