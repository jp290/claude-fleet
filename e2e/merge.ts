// The ⏫ merge/land paths: the agent verdicts (blocked / lying / resolved / prose), the server's
// own conflict-free script pre-pass, confirm-land and its stale-main replay, the V1 deterministic
// verify gate, and the orphan reattach / remove / discard flows.
import { spawnSync } from "node:child_process";
import { REPO, check, get, post } from "./harness";
import type { LaneCtx } from "./ctx";
import { exists, setMergeMode, settleForMerge, waitMerge } from "./lane-helpers";

export async function run(lc: LaneCtx): Promise<void> {
  // ⏫ merge: dirty lane → deterministic block, no agent run
  await Bun.write(`${lc.lnPath}/code.txt`, "root\nmerge-work\n");
  const mgDirty = (await (await post(`/api/slots/${lc.lnSlot}/merge`, {})).json()) as { status?: string; detail?: string };
  check("merge blocks a dirty lane deterministically",
    mgDirty.status === "blocked" && (mgDirty.detail ?? "").includes("uncommitted"), JSON.stringify(mgDirty));

  spawnSync("git", ["-C", lc.lnPath, "commit", "-aqm", "merge work"]);
  // diverge main on the SAME file+lines the lane touched → a genuine rebase conflict, which
  // is the ONLY case that reaches the agent (a conflict-free rebase is done by the server's
  // script pre-pass; that path is covered separately below). The lane is also not a
  // descendant of main, so a lying "rebased" claim stays deterministically detectable.
  await Bun.write(`${REPO}/code.txt`, "root\nmainline-work\n");
  spawnSync("git", ["-C", REPO, "commit", "-aqm", "mainline work"]);

  await setMergeMode("blocked");
  await settleForMerge(lc.lnSlot);
  const mgB = await post(`/api/slots/${lc.lnSlot}/merge`, {});
  check("merge POST starts an async job", ((await mgB.json()) as { running?: boolean }).running === true);
  const vB = await waitMerge(lc.lnSlot);
  check("conflict → agent 'blocked' verdict passes through with detail",
    !vB.gone && vB.last?.status === "blocked" && vB.last.detail === "fake conflict", JSON.stringify(vB));
  // V1 gate: verify runs ONLY against a git-verified rebased tree (design note §6 rule 4).
  // A blocked verdict never rebased anything → no verify field, even though a cmd IS
  // configured. Guards against a mutation that runs verify on a pre-rebase / non-rebased tree.
  check("V1: a blocked verdict (no rebased tree) carries no verify field",
    vB.last !== null && vB.last.verify === undefined, JSON.stringify(vB.last?.verify));

  await setMergeMode("lie");
  await settleForMerge(lc.lnSlot);
  await post(`/api/slots/${lc.lnSlot}/merge`, {});
  const vL = await waitMerge(lc.lnSlot);
  check("merge re-verifies the rebase claim — lying agent → error, lane kept",
    !vL.gone && vL.last?.status === "error" && exists(lc.lnPath), JSON.stringify(vL.last));

  await setMergeMode("do");
  await settleForMerge(lc.lnSlot);
  await post(`/api/slots/${lc.lnSlot}/merge`, {});
  const vD = await waitMerge(lc.lnSlot);
  check("agent resolves the conflict → PAUSES for review (verified, NOT landed, lane kept)",
    !vD.gone && vD.last?.status === "resolved" && exists(lc.lnPath), JSON.stringify(vD.last));
  // V1: verify runs on the RESOLVED (conflict) path too — server-side, against the rebased
  // tree, its result recorded as a fact (design note §3, §6 rule 4). This -X theirs resolution
  // leaves no VERIFYBAD marker → green. Proves the call fires on the resolved path (a kept
  // lane whose verdict is readable, unlike a torn-down clean land) and binds mainSha.
  check("V1: resolved verdict carries verify.ok:true against the rebased tree (mainSha bound)",
    vD.last?.verify?.ok === true && vD.last.verify.cmd.endsWith("fakeverify")
      && typeof vD.last.verify.mainSha === "string" && /^[0-9a-f]{40,64}$/.test(vD.last.verify.mainSha),
    JSON.stringify(vD.last?.verify));
  const preLand = spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString();
  check("resolved conflict has NOT reached main before the owner confirms",
    !preLand.includes("merge work"), preLand.trim());
  const md = (await (await get(`/api/slots/${lc.lnSlot}/merge-diff`)).json()) as { files?: string[]; diff?: string };
  check("merge-diff shows exactly what will land (main..HEAD)",
    (md.files ?? []).includes("code.txt") && typeof md.diff === "string", JSON.stringify(md.files));
  // regression (land-check fix): an UNRELATED dirty tracked file in the primary must NOT
  // block the land — git's ff only rewrites the lane's own files (code.txt), so a dirty
  // .gitignore the lane never touched has to be left alone, not wedge the land. The OLD
  // check refused on ANY dirty tracked file and returned status:"blocked" here.
  await Bun.write(`${REPO}/.gitignore`, ".env\n# unrelated dirty edit — must not block the land\n");
  await settleForMerge(lc.lnSlot);
  const conf = await post(`/api/slots/${lc.lnSlot}/merge`, { confirm: true });
  const confJ = (await conf.json()) as { status?: string; landed?: boolean };
  check("owner confirm → server ff-merges the reviewed resolution + tears down the slot",
    conf.ok && confJ.status === "merged" && confJ.landed === true, JSON.stringify(confJ));
  check("land ignores an UNRELATED dirty file in the primary (ff only touches lane files)",
    confJ.status === "merged" && spawnSync("git", ["-C", REPO, "status", "--porcelain"]).stdout.toString().includes(".gitignore"),
    "expected .gitignore to stay dirty AND the land to still succeed");
  spawnSync("git", ["-C", REPO, "checkout", "--", ".gitignore"]); // restore for later checks
  check("confirmed lane removed from disk", !exists(lc.lnPath));
  const mainLog = spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString();
  check("main received the lane's commit on top of the diverged mainline",
    mainLog.includes("merge work") && mainLog.includes("mainline work"), mainLog.trim());
  check("merge rejects a non-lane slot", (await post("/api/slots/2/merge", {})).status === 400);

  // --- F5: merge-job state must not bleed across a slot recycle. A slot recycled while its
  // merge job is still in flight must NOT report the OLD job as running for whatever lane
  // takes the slot next (which would 409 the new lane's commit/merge routes until the stale
  // job's finally fired). openSlot/killSlot now drop the slot's mergeInflight/mergeStart. ---
  {
    const f5 = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${f5.cwd}/code.txt`, "root\nf5-lane\n");
    spawnSync("git", ["-C", f5.cwd, "commit", "-aqm", "f5 lane work"]);
    await Bun.write(`${REPO}/code.txt`, "root\nf5-main\n"); // same line → conflict → the agent (hang) runs
    spawnSync("git", ["-C", REPO, "commit", "-aqm", "f5 main work"]);
    await setMergeMode("hang"); // fakemerge sleeps, keeping the job in flight while we recycle
    await settleForMerge(f5.slot);
    const mgStart = (await (await post(`/api/slots/${f5.slot}/merge`, {})).json()) as { running?: boolean };
    check("F5 setup: merge job is in flight (running:true) before the recycle", mgStart.running === true, JSON.stringify(mgStart));
    // recycle the slot mid-job: kill, then re-open a fresh lane in the SAME slot
    await post(`/api/slots/${f5.slot}/kill`, {});
    const reopen = await post(`/api/slots/${f5.slot}/open-worktree`, { repo: REPO, branch: "e2e-f5-recycle" });
    check("F5: recycled slot re-opens a fresh lane", reopen.ok, await reopen.text());
    const mgAfter = (await (await get(`/api/slots/${f5.slot}/merge`)).json()) as { running?: boolean };
    check("F5: recycled slot's new lane reports the stale merge job as NOT running (mergeInflight/mergeStart cleared)",
      mgAfter.running === false, JSON.stringify(mgAfter));
    await post(`/api/slots/${f5.slot}/kill`, {}); // free the slot; the leftover hung job self-checks identity on finish
    await setMergeMode("blocked"); // restore default for later merge tests
  }

  // script pre-pass: a conflict-FREE lane is rebased and landed by the server itself, the
  // agent is NEVER spawned. Proof: mergemode is set to "blocked" — if the agent were
  // consulted the lane would be kept, not landed.
  const lnClean = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  await Bun.write(`${lnClean.cwd}/clean-lane.txt`, "lane side\n");
  spawnSync("git", ["-C", lnClean.cwd, "add", "clean-lane.txt"]);
  spawnSync("git", ["-C", lnClean.cwd, "commit", "-qm", "clean lane work"]);
  await Bun.write(`${REPO}/clean-main.txt`, "main side\n"); // different file → no conflict
  spawnSync("git", ["-C", REPO, "add", "clean-main.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "clean main work"]);
  await setMergeMode("blocked"); // agent, if wrongly consulted, would block — it must not be
  await settleForMerge(lnClean.slot);
  await post(`/api/slots/${lnClean.slot}/merge`, {});
  const vC = await waitMerge(lnClean.slot);
  check("conflict-free lane merges + lands via the script, agent never consulted", vC.gone, JSON.stringify(vC));
  check("script-path lane commit reached main",
    spawnSync("git", ["-C", REPO, "log", "--oneline", "-3"]).stdout.toString().includes("clean lane work"));

  // a correct rebase answered in PROSE must not be thrown away: git verification is the
  // authority, the agent's JSON is only narrative (seen live — injection-distracted agent
  // rebased perfectly, then narrated instead of answering the contract). Conflict setup so
  // the agent actually runs.
  const lnP = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  await Bun.write(`${lnP.cwd}/code.txt`, "root\nprose-lane\n");
  spawnSync("git", ["-C", lnP.cwd, "commit", "-aqm", "prose lane work"]);
  await Bun.write(`${REPO}/code.txt`, "root\nprose-main\n"); // same file+line → conflict
  spawnSync("git", ["-C", REPO, "commit", "-aqm", "prose main work"]);
  await setMergeMode("prose");
  await settleForMerge(lnP.slot);
  await post(`/api/slots/${lnP.slot}/merge`, {});
  const vP = await waitMerge(lnP.slot);
  check("off-contract agent answer over a git-verified rebase → resolved (paused for review)",
    !vP.gone && vP.last?.status === "resolved", JSON.stringify(vP.last));
  await settleForMerge(lnP.slot);
  check("prose-resolved lane confirms + lands",
    ((await (await post(`/api/slots/${lnP.slot}/merge`, { confirm: true })).json()) as { landed?: boolean }).landed === true);
  check("prose-merged lane's commit reached main",
    spawnSync("git", ["-C", REPO, "log", "--oneline", "-3"]).stdout.toString().includes("prose lane work"));

  // atomic confirm-land: if main moves between the resolution and the owner's confirm, the
  // earlier rebase is stale — but the resolution was already made, so the server REPLAYS it
  // onto the current main and lands in one step (no full agent re-run) when the move doesn't
  // re-conflict. Only a move that touches the SAME lines falls back to ⏫. (Was: confirm hard-
  // refused on ANY move, which in a busy fleet meant a resolved lane could never win the race.)
  const lnStale = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  await Bun.write(`${lnStale.cwd}/code.txt`, "root\nstale-lane\n");
  spawnSync("git", ["-C", lnStale.cwd, "commit", "-aqm", "stale lane work"]);
  await Bun.write(`${REPO}/code.txt`, "root\nstale-main\n"); // conflict → agent runs → resolved
  spawnSync("git", ["-C", REPO, "commit", "-aqm", "stale main work"]);
  await setMergeMode("do");
  await settleForMerge(lnStale.slot);
  await post(`/api/slots/${lnStale.slot}/merge`, {});
  const vSt = await waitMerge(lnStale.slot);
  check("stale-test lane resolved + paused", !vSt.gone && vSt.last?.status === "resolved", JSON.stringify(vSt.last));
  // main moves on an UNRELATED file before confirm → the resolution still replays cleanly
  await Bun.write(`${REPO}/moved.txt`, "moved\n");
  spawnSync("git", ["-C", REPO, "add", "moved.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "main moved after resolution"]);
  const staleJ = (await (await post(`/api/slots/${lnStale.slot}/merge`, { confirm: true })).json()) as
    { status?: string; landed?: boolean; detail?: string };
  check("confirm-land re-rebases onto a moved main and lands (unrelated move, no agent re-run)",
    staleJ.status === "merged" && staleJ.landed === true, JSON.stringify(staleJ));
  check("confirm-landed lane's resolution + the intervening main move both reached main",
    ((): boolean => { const lg = spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString();
      return lg.includes("stale lane work") && lg.includes("main moved after resolution"); })(),
    spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString().trim());
  check("confirm-landed lane kept its resolved content on main (theirs = lane side)",
    spawnSync("git", ["-C", REPO, "show", "HEAD:code.txt"]).stdout.toString() === "root\nstale-lane\n",
    JSON.stringify(spawnSync("git", ["-C", REPO, "show", "HEAD:code.txt"]).stdout.toString()));

  // the fallback still holds: when the moved main touches the SAME lines the resolution did,
  // the re-rebase re-conflicts — the server aborts it cleanly and sends the owner back to ⏫
  // (never landing a NEW, unreviewed auto-resolution). Lane is left exactly as it was.
  const lnReconf = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  await Bun.write(`${lnReconf.cwd}/code.txt`, "root\nrc-lane\n");
  spawnSync("git", ["-C", lnReconf.cwd, "commit", "-aqm", "reconf lane work"]);
  await Bun.write(`${REPO}/code.txt`, "root\nrc-main\n"); // conflict → agent resolves
  spawnSync("git", ["-C", REPO, "commit", "-aqm", "reconf main work"]);
  await settleForMerge(lnReconf.slot);
  await post(`/api/slots/${lnReconf.slot}/merge`, {});
  const vRc = await waitMerge(lnReconf.slot);
  check("reconf lane resolved + paused", !vRc.gone && vRc.last?.status === "resolved", JSON.stringify(vRc.last));
  await Bun.write(`${REPO}/code.txt`, "root\nrc-main2\n"); // main re-touches the SAME line before confirm
  spawnSync("git", ["-C", REPO, "commit", "-aqm", "reconf main re-touch"]);
  const rcJ = (await (await post(`/api/slots/${lnReconf.slot}/merge`, { confirm: true })).json()) as
    { status?: string; detail?: string };
  check("confirm-land falls back to ⏫ when the moved main re-conflicts",
    rcJ.status === "blocked" && (rcJ.detail ?? "").includes("re-run"), JSON.stringify(rcJ));
  check("re-conflicting confirm leaves the lane intact (no half-rebase, no git op stuck)",
    exists(lnReconf.cwd)
    && spawnSync("git", ["-C", lnReconf.cwd, "status", "--porcelain"]).stdout.toString().trim() === "",
    spawnSync("git", ["-C", lnReconf.cwd, "status", "--porcelain"]).stdout.toString());
  await post(`/api/slots/${lnReconf.slot}/kill`, {});
  await post(`/api/slots/${lnStale.slot}/kill`, {}); // free the slot for the orphan tests below

  // ⏸ has to survive a RE-RUN. The pause-for-review guard keys on main still being an ancestor of
  // the lane branch, so it lapses the moment main moves on — by design, because the stored verdict
  // is then a stale statement about a rebase. But the agent's resolutions are not stale: they are
  // committed in this lane and still unreviewed, and because they were resolved once already the
  // fresh run's pre-pass replays them onto the new main with NO conflict. That put them on the
  // clean auto-land path, which landed conflict resolutions no human had ever seen. M3's "the
  // conflict path always stops" must hold across the re-run, not just within one run.
  const lnFt = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  await Bun.write(`${lnFt.cwd}/code.txt`, "root\nft-lane\n");
  spawnSync("git", ["-C", lnFt.cwd, "commit", "-aqm", "fallthrough lane work"]);
  await Bun.write(`${REPO}/code.txt`, "root\nft-main\n"); // same line → conflict → the agent resolves
  spawnSync("git", ["-C", REPO, "commit", "-aqm", "fallthrough main work"]);
  await setMergeMode("do");
  await settleForMerge(lnFt.slot);
  await post(`/api/slots/${lnFt.slot}/merge`, {});
  const vFt1 = await waitMerge(lnFt.slot);
  check("(setup) fall-through lane's conflict is agent-resolved and paused for review",
    vFt1.last?.status === "resolved" && (vFt1.last.conflicted ?? []).includes("code.txt"), JSON.stringify(vFt1.last));
  // the half that never changed: while main is STILL an ancestor, a re-run is refused outright
  await settleForMerge(lnFt.slot);
  const ftGuard = (await (await post(`/api/slots/${lnFt.slot}/merge`, {})).json()) as { status?: string; detail?: string };
  check("⏸ a re-run is refused while the resolution is still rebased onto main (guard unchanged)",
    ftGuard.status === "resolved" && (ftGuard.detail ?? "").includes("review"), JSON.stringify(ftGuard));
  // main moves on an UNRELATED file → the guard lapses and the resolution replays with no conflict
  await Bun.write(`${REPO}/ft-moved.txt`, "moved\n");
  spawnSync("git", ["-C", REPO, "add", "ft-moved.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "ft main moved after resolution"]);
  // "blocked": if the re-run consulted the agent at all the verdict would be blocked, not resolved
  // — so this also proves the stop comes from the CARRIED resolution, not from a fresh conflict.
  await setMergeMode("blocked");
  await settleForMerge(lnFt.slot);
  await post(`/api/slots/${lnFt.slot}/merge`, {});
  const vFt2 = await waitMerge(lnFt.slot);
  check("re-run after main moved STOPS for review instead of auto-landing the carried resolution",
    !vFt2.gone && vFt2.last?.status === "resolved" && vFt2.last.landed === false && exists(lnFt.cwd),
    JSON.stringify(vFt2.last));
  check("the stop names the carried resolution as its reason (no conflict occurred on this run)",
    (vFt2.last?.conflicted ?? []).includes("code.txt") && (vFt2.last?.detail ?? "").includes("unreviewed"),
    JSON.stringify(vFt2.last?.detail));
  const ftLog = spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString();
  check("the unreviewed resolution has NOT reached main", !ftLog.includes("fallthrough lane work"), ftLog.trim());
  // the stop is a pause, never a block: the owner reviews and lands it deliberately
  await settleForMerge(lnFt.slot);
  const ftConf = (await (await post(`/api/slots/${lnFt.slot}/merge`, { confirm: true })).json()) as
    { status?: string; landed?: boolean };
  check("the owner can still confirm-land the carried resolution after reviewing it",
    ftConf.status === "merged" && ftConf.landed === true, JSON.stringify(ftConf));
  check("after the owner's confirm the carried resolution IS on main",
    spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString().includes("fallthrough lane work"),
    spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString().trim());

  // --- V1: deterministic verify in the merge verdict (design note §3). The server runs
  // FLEET_VERIFY_CMD (here $DIR/fakeverify — a git-grep for a VERIFYBAD sabotage marker)
  // against the REBASED tree, before any land, and records verify:{cmd,ok,out,at,mainSha}.
  // Two CLEAN-rebase lanes (own file, no conflict → the server's script path, agent never
  // consulted) exercise the pass and fail gates. mergemode stays "blocked" throughout: if
  // the agent were wrongly spawned the lane would be kept, so a land here also proves the
  // clean path ran. ---
  await setMergeMode("blocked");

  // (B first) clean rebase whose tree PASSES verify → lands as today. Run BEFORE the fail
  // case: the fail case's owner-confirm-land (below) commits the VERIFYBAD marker onto main,
  // which every later clean lane would then inherit — so the passing case must land first,
  // against a still-clean main.
  const lnVp = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  await Bun.write(`${lnVp.cwd}/verify-pass.txt`, "clean lane work, no marker\n");
  spawnSync("git", ["-C", lnVp.cwd, "add", "verify-pass.txt"]);
  spawnSync("git", ["-C", lnVp.cwd, "commit", "-qm", "verify-pass lane work"]);
  await Bun.write(`${REPO}/vp-main.txt`, "main side\n"); // different file → clean rebase, no agent
  spawnSync("git", ["-C", REPO, "add", "vp-main.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "vp main work"]);
  await settleForMerge(lnVp.slot);
  await post(`/api/slots/${lnVp.slot}/merge`, {});
  const vVp = await waitMerge(lnVp.slot);
  check("V1: clean rebase that passes verify lands (verify green never blocks a clean land)", vVp.gone, JSON.stringify(vVp));
  check("V1: passing verify lane's commit reached main",
    spawnSync("git", ["-C", REPO, "log", "--oneline", "-3"]).stdout.toString().includes("verify-pass lane work"));

  // (A) clean rebase whose tree FAILS verify → the auto-land is downgraded to a stop-and-
  // review "resolved" verdict (verify.ok:false), NOT landed — broken code never auto-lands.
  const lnVf = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  await Bun.write(`${lnVf.cwd}/verify-fail.txt`, "lane work with a VERIFYBAD marker\n"); // marker survives the rebase
  spawnSync("git", ["-C", lnVf.cwd, "add", "verify-fail.txt"]);
  spawnSync("git", ["-C", lnVf.cwd, "commit", "-qm", "verify-fail lane work"]);
  await Bun.write(`${REPO}/vf-main.txt`, "main side\n"); // different file → clean rebase, no agent
  spawnSync("git", ["-C", REPO, "add", "vf-main.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "vf main work"]);
  await settleForMerge(lnVf.slot);
  await post(`/api/slots/${lnVf.slot}/merge`, {});
  const vVf = await waitMerge(lnVf.slot);
  check("V1: clean rebase that fails verify does NOT auto-land (downgraded to resolved)",
    !vVf.gone && vVf.last?.status === "resolved" && vVf.last?.landed === false && exists(lnVf.cwd), JSON.stringify(vVf.last));
  check("V1: the verdict carries verify.ok:false with the failing command's output tail",
    vVf.last?.verify?.ok === false && vVf.last.verify.cmd.endsWith("fakeverify")
      && vVf.last.verify.out.includes("VERIFYBAD") && typeof vVf.last.verify.mainSha === "string" && /^[0-9a-f]{40,64}$/.test(vVf.last.verify.mainSha),
    JSON.stringify(vVf.last?.verify));
  const vfPreLand = spawnSync("git", ["-C", REPO, "log", "--oneline", "-3"]).stdout.toString();
  check("V1: verify-failed lane's commit has NOT reached main",
    !vfPreLand.includes("verify-fail lane work"), vfPreLand.trim());
  // owner latitude (OWNER.md §4a): confirm-land must NOT hard-block on verify.ok:false — the
  // owner reviewed the failure and may land anyway. The clean rebase left main an ancestor,
  // so confirm ff-lands directly.
  await settleForMerge(lnVf.slot);
  const vfConf = (await (await post(`/api/slots/${lnVf.slot}/merge`, { confirm: true })).json()) as { status?: string; landed?: boolean };
  check("V1: owner may confirm-land a verify-failed resolution anyway (no hard block on ok:false)",
    vfConf.status === "merged" && vfConf.landed === true, JSON.stringify(vfConf));
  check("V1: after the owner's confirm the verify-failed lane's commit is on main",
    spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString().includes("verify-fail lane work"));
  // scrub the VERIFYBAD marker back out of main so later clean lanes (this suite reuses REPO
  // heavily) don't inherit a red verify from this deliberately-broken confirm-land.
  spawnSync("git", ["-C", REPO, "rm", "-q", "verify-fail.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "cleanup: drop VERIFYBAD marker from main"]);

  // (C) clean rebase whose verify command DECLINES to verify the tree (server.ts VERIFY_SKIP_EXIT).
  // This is the hole the tri-state closes: the guard used to `exit 0`, which recorded ok:true and
  // auto-landed behind a gate that executed nothing — a foreign repo, or a fleet lane that moved
  // the file the guard tests for. A skip is now its own state (ok:null) and never auto-lands.
  // Two lanes, one per half of the contract: the reserved exit code, and the legacy marker line at
  // exit 0 (which a running-but-not-yet-kickstarted watchdog still emits). Neither is confirm-
  // landed: their markers must not reach main, so each is killed and discarded instead.
  for (const [marker, name, label] of [
    ["VERIFYSKIP42", "exit-42", "the reserved skip exit code"],
    ["VERIFYSKIPZERO", "legacy-marker", "the legacy 'verify skipped:' line at exit 0"],
  ] as const) {
    const lnVs = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${lnVs.cwd}/verify-skip-${name}.txt`, `lane work carrying a ${marker} marker\n`);
    spawnSync("git", ["-C", lnVs.cwd, "add", `verify-skip-${name}.txt`]);
    // retried + asserted: the server polls lane git state on a timer, and a poll holding
    // `index.lock` makes a one-shot commit fail — a lane with no marker committed would verify
    // GREEN and land, i.e. report the exact failure this case exists to catch, for the wrong reason
    let committed = false;
    for (let i = 0; i < 20 && !committed; i++) {
      committed = spawnSync("git", ["-C", lnVs.cwd, "commit", "-qm", `verify-skip ${name} lane work`]).status === 0;
      if (!committed) await Bun.sleep(150);
    }
    check(`V1 setup: the ${label} lane committed its marker (precondition for the skip below)`,
      committed, spawnSync("git", ["-C", lnVs.cwd, "status", "--porcelain"]).stdout.toString().trim());
    await Bun.write(`${REPO}/vs-main-${name}.txt`, "main side\n"); // different file → clean rebase, no agent
    spawnSync("git", ["-C", REPO, "add", `vs-main-${name}.txt`]);
    spawnSync("git", ["-C", REPO, "commit", "-qm", `vs main work ${name}`]);
    await settleForMerge(lnVs.slot);
    await post(`/api/slots/${lnVs.slot}/merge`, {});
    const vVs = await waitMerge(lnVs.slot);
    check(`V1: a verify that skips itself via ${label} records ok:null — SKIPPED, never a pass`,
      vVs.last?.verify?.ok === null && vVs.last.verify.cmd.endsWith("fakeverify")
        && vVs.last.verify.out.includes("verify skipped:")
        && typeof vVs.last.verify.mainSha === "string" && /^[0-9a-f]{40,64}$/.test(vVs.last.verify.mainSha),
      JSON.stringify(vVs.last?.verify));
    check(`V1: a skipped verify (${label}) does NOT clean-auto-land (downgraded to resolved)`,
      !vVs.gone && vVs.last?.status === "resolved" && vVs.last?.landed === false && exists(lnVs.cwd),
      JSON.stringify(vVs.last));
    check(`V1: the skipped verdict (${label}) says SKIPPED, not failed and not verified`,
      (vVs.last?.detail ?? "").includes("SKIPPED"), JSON.stringify(vVs.last?.detail));
    const vsLog = spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString();
    check(`V1: the skipped lane's commit (${label}) has NOT reached main`,
      !vsLog.includes(`verify-skip ${name} lane work`), vsLog.trim());
    // discard rather than land: the marker must never reach main (every later clean lane in this
    // suite would inherit it and skip too), and discard leaves no orphan behind either.
    await post(`/api/slots/${lnVs.slot}/kill`, {});
    await post("/api/worktrees/discard", { repo: REPO, path: lnVs.cwd, branch: lnVs.branch });
  }

  // (D) a red verify whose log has the SHAPE a real suite's has: the failing check named once,
  // buried among hundreds of PASS lines, only the count at the end, and a noisy stderr alongside.
  // The stored `verify.out` used to be `(stdout + stderr).slice(-2048)`, which on exactly this
  // shape kept stderr and nothing else — measured on the two red post-land audit rows of
  // 2026-07-26 (data-audit-2026-07-27 item 6: 33 retained result lines, all PASS, zero FAIL
  // names, and which checks failed is unrecoverable). A gate result that cannot say what failed
  // is not a gate result, so retention keeps the failure lines, keeps the tail, marks the gap,
  // and keeps stderr in its own labelled section that cannot displace the stdout verdict.
  const lnVn = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  await Bun.write(`${lnVn.cwd}/verify-noisy.txt`, "lane work carrying a VERIFYNOISY marker\n");
  spawnSync("git", ["-C", lnVn.cwd, "add", "verify-noisy.txt"]);
  let vnCommitted = false;
  for (let i = 0; i < 20 && !vnCommitted; i++) {
    vnCommitted = spawnSync("git", ["-C", lnVn.cwd, "commit", "-qm", "verify-noisy lane work"]).status === 0;
    if (!vnCommitted) await Bun.sleep(150);
  }
  check("V1 setup: the noisy-verify lane committed its marker (precondition for the retention checks)",
    vnCommitted, spawnSync("git", ["-C", lnVn.cwd, "status", "--porcelain"]).stdout.toString().trim());
  await Bun.write(`${REPO}/vn-main.txt`, "main side\n"); // different file → clean rebase, no agent
  spawnSync("git", ["-C", REPO, "add", "vn-main.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "vn main work"]);
  await settleForMerge(lnVn.slot);
  await post(`/api/slots/${lnVn.slot}/merge`, {});
  const vVn = await waitMerge(lnVn.slot);
  const vnOut = vVn.last?.verify?.out ?? "";
  check("V1: a red verify NAMES its failing check, not just the pass lines around it",
    vVn.last?.verify?.ok === false && vnOut.includes("FAIL  §9 the needle check that actually broke"),
    JSON.stringify(vnOut.slice(0, 300)));
  check("V1: the red verify's tail survives too — the failure COUNT is still in the retained output",
    vnOut.includes("1 FAILURES") && vnOut.includes("PASS  trailing filler 399"), JSON.stringify(vnOut.slice(-200)));
  check("V1: a flooding stderr cannot displace the stdout verdict — it is kept in its own section",
    vnOut.includes("--- stderr ---") && vnOut.includes("noise: deprecation warning 399"),
    JSON.stringify(vnOut.slice(-200)));
  check("V1: retention marks the lines it dropped instead of closing the gap silently",
    /… \[\d+ lines elided\]/.test(vnOut), JSON.stringify(vnOut.slice(0, 120)));
  // the cap is in BYTES, which is what the constant's comment always claimed
  check("V1: the retained output honours the 2048-BYTE cap (not 2048 UTF-16 units)",
    new TextEncoder().encode(vnOut).length <= 2048,
    `${new TextEncoder().encode(vnOut).length} bytes / ${vnOut.length} units`);
  const vnLog = spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString();
  check("V1: the noisy-verify lane's commit has NOT reached main", !vnLog.includes("verify-noisy lane work"), vnLog.trim());
  // discard: the VERIFYNOISY marker must never reach main, or every later clean lane inherits it
  await post(`/api/slots/${lnVn.slot}/kill`, {});
  await post("/api/worktrees/discard", { repo: REPO, path: lnVn.cwd, branch: lnVn.branch });

  // orphan flow: a killed lane's worktree survives on disk, shows slot:null in the map,
  // can be reattached into a fresh slot (landable again) or safely removed
  const ln2 = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  await post(`/api/slots/${ln2.slot}/kill`, {});
  check("killed lane's worktree survives on disk", exists(ln2.cwd));
  const probeRes = await post("/api/lanes", { repo: REPO }); // any repo slot can read the map
  const probe = (await probeRes.json()) as { slot: number; cwd: string };
  const wm2 = (await (await get(`/api/slots/${probe.slot}/worktrees`)).json()) as
    { worktrees: { path: string; branch: string; slot: number | null }[] };
  check("orphaned worktree listed with slot null",
    wm2.worktrees.some((w) => w.branch === ln2.branch && w.slot === null), JSON.stringify(wm2.worktrees));
  const att = await post("/api/lanes", { repo: REPO, attach: ln2.cwd });
  const attJ = (await att.json()) as { ok?: boolean; slot?: number; branch?: string; error?: string };
  check("orphan reattaches into a free slot with its lane tag intact",
    att.ok && attJ.branch === ln2.branch, JSON.stringify(attJ));
  check("attach refuses a worktree already open in a slot",
    (await post("/api/lanes", { repo: REPO, attach: ln2.cwd })).status === 409);
  // `.ok` alone proved only that the route answered. A land is a claim about DISK and GIT, so it is
  // asserted there too (the lanes-basic.ts pattern): the worktree is gone, git's own worktree
  // registry no longer carries it (an rm -rf without a prune leaves a stale entry behind), and the
  // slot it was reattached into is free again.
  const attLand = await post(`/api/slots/${attJ.slot}/land`, {});
  check("reattached orphan lands (clean, merged)", attLand.ok, await attLand.clone().text());
  check("landed orphan is gone from disk AND from git's worktree registry",
    !exists(ln2.cwd)
      && !spawnSync("git", ["-C", REPO, "worktree", "list", "--porcelain"]).stdout.toString().includes(ln2.cwd),
    spawnSync("git", ["-C", REPO, "worktree", "list", "--porcelain"]).stdout.toString().trim());
  check("landed orphan's slot is free again",
    ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
      .slots.find((x) => x.id === attJ.slot)?.cwd === null, `slot ${attJ.slot}`);

  // removal path: dirty orphan refused, clean orphan dropped; slot-held worktree refused
  const ln3 = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  check("remove refuses a worktree still open in a slot",
    (await post("/api/worktrees/remove", { repo: REPO, path: ln3.cwd })).status === 409);
  await post(`/api/slots/${ln3.slot}/kill`, {});
  await Bun.write(`${ln3.cwd}/code.txt`, "root\ndirty-orphan\n");
  check("remove refuses a dirty orphan",
    (await post("/api/worktrees/remove", { repo: REPO, path: ln3.cwd })).status === 409);
  spawnSync("git", ["-C", ln3.cwd, "checkout", "-q", "--", "code.txt"]);
  check("remove drops a clean orphan", (await post("/api/worktrees/remove", { repo: REPO, path: ln3.cwd })).ok);
  check("removed orphan gone from disk", !exists(ln3.cwd));

  // ☠ discard path: the deliberate-destruction endpoint MUST take the dirty+unmerged
  // orphan `remove` refuses — and must itself refuse slot-held trees and stale identities
  const ln4 = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  await Bun.write(`${ln4.cwd}/junk.txt`, "experiment gone wrong\n");
  spawnSync("git", ["-C", ln4.cwd, "add", "junk.txt"]);
  spawnSync("git", ["-C", ln4.cwd, "commit", "-qm", "unmerged junk"]);
  await Bun.write(`${ln4.cwd}/dirty.txt`, "uncommitted\n");
  const ln4head = spawnSync("git", ["-C", ln4.cwd, "rev-parse", "HEAD"]).stdout.toString().trim();
  check("discard refuses a worktree still open in a slot",
    (await post("/api/worktrees/discard", { repo: REPO, path: ln4.cwd, branch: ln4.branch })).status === 409);
  await post(`/api/slots/${ln4.slot}/kill`, {});
  check("discard refuses on branch mismatch (stale board)",
    (await post("/api/worktrees/discard", { repo: REPO, path: ln4.cwd, branch: "not-the-branch" })).status === 409);
  const discRes = await post("/api/worktrees/discard", { repo: REPO, path: ln4.cwd, branch: ln4.branch });
  const discJ = (await discRes.json()) as { ok?: boolean; head?: string | null; branchDeleted?: boolean };
  check("discard drops a dirty, unmerged orphan (the case remove refuses)", discRes.ok, JSON.stringify(discJ));
  check("discard returns the pre-delete head sha as undo ammo", discJ.head === ln4head, `${discJ.head} vs ${ln4head}`);
  check("discarded worktree gone from disk", !exists(ln4.cwd));
  check("discarded branch deleted",
    discJ.branchDeleted === true
      && spawnSync("git", ["-C", REPO, "rev-parse", "--verify", "-q", `refs/heads/${ln4.branch}`]).status !== 0);
  check("discard on an unknown path is refused",
    (await post("/api/worktrees/discard", { repo: REPO, path: ln4.cwd, branch: ln4.branch })).status === 400);
  await post(`/api/slots/${probe.slot}/land`, {}); // clean up the probe lane too
}
