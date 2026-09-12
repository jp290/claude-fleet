// The ⏫ merge/land paths: the agent verdicts (blocked / lying / resolved / prose), the server's
// own conflict-free script pre-pass, identity-bound confirm-land, the V1 deterministic
// verify gate, and the orphan reattach / remove / discard flows.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { BASE, REPO, REPO2, REPO3, ROOT, check, get, paneEnv, plogRead, post, restartSrv, tmuxOut } from "./harness";
import type { LaneCtx } from "./ctx";
import { exists, fakeClaudeInPane, setMergeMode, settleForMerge, waitMerge } from "./lane-helpers";
import { projectPromotionPolicyFacts } from "../land-candidate";

type MergeEventRow = {
  id: string; watchId: string; receiverSlot: number; kind: "merge-terminal";
  payload: { status: string; landed: boolean; branch: string; at: number;
    verify?: { ok: boolean | null; timedOut?: true; waitedOut?: true; stale?: true } };
  status: "pending" | "send-uncertain" | "delivered" | "acknowledged" | "receiver-gone";
  attempts: number;
};
type MergeWatchRow = { id: string; kind: "merge"; slot: number; target: number; targetCwd: string;
  targetBranch: string; armed: boolean; firedAt: number | null; lastResult: string | null };
const mergeEvents = async (): Promise<MergeEventRow[]> =>
  (((await (await get("/api/events")).json()) as { events: unknown[] }).events as MergeEventRow[])
    .filter((e) => e.kind === "merge-terminal");
const mergeWatches = async (): Promise<MergeWatchRow[]> =>
  (((await (await get("/api/sessions")).json()) as { watches: unknown[] }).watches as MergeWatchRow[])
    .filter((w) => w.kind === "merge");
const waitMergeEvent = async (watchId: string, terminal = true): Promise<MergeEventRow | undefined> => {
  let found: MergeEventRow | undefined;
  for (let i = 0; i < 160; i++) {
    found = (await mergeEvents()).find((e) => e.watchId === watchId);
    if (found && (!terminal || found.status === "delivered" || found.status === "acknowledged")) return found;
    await Bun.sleep(100);
  }
  return found;
};
const selfMergeWatch = (token: string, target: number, idleSec = 0): Promise<Response> =>
  fetch(`${BASE}/api/self/watch`, {
    method: "POST", headers: { "content-type": "application/json", "x-fleet-self-token": token },
    body: JSON.stringify({ kind: "merge", target, idleSec }),
  });
const ackMergeEvent = (token: string, id: string): Promise<Response> =>
  fetch(`${BASE}/api/self/events/${id}/ack`, {
    method: "POST", headers: { "x-fleet-self-token": token },
  });
const freeSlot = async (): Promise<number> =>
  ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
    .slots.find((s) => s.cwd === null)?.id ?? 0;

export async function run(lc: LaneCtx): Promise<void> {
  const receiverA = await freeSlot();
  const openReceiverA = receiverA ? await post(`/api/slots/${receiverA}/open`, { cwd: REPO }) : null;
  const receiverAToken = receiverA ? await paneEnv(`s${receiverA}`, "FLEET_SELF_TOKEN") ?? "" : "";
  const receiverB = await freeSlot();
  const openReceiverB = receiverB ? await post(`/api/slots/${receiverB}/open`, { cwd: REPO }) : null;
  let receiverBToken = receiverB ? await paneEnv(`s${receiverB}`, "FLEET_SELF_TOKEN") ?? "" : "";
  check("merge-event setup: two non-lane receivers are open with scoped self tokens",
    !!openReceiverA?.ok && !!openReceiverB?.ok && /^[0-9a-f]{32}$/.test(receiverAToken)
      && /^[0-9a-f]{32}$/.test(receiverBToken),
    JSON.stringify({ receiverA, receiverB, a: receiverAToken.length, b: receiverBToken.length }));
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

  // A concrete merge subscription is accepted only while this exact lane operation is running
  // or while its terminal fact is still persisted. The hang makes the before-completion half
  // deterministic; it later settles as a normal blocked MergeLast.
  const deployBuildProbe = `${ROOT}/merge-deploy-build-ran`;
  const deployRestartProbe = `${ROOT}/merge-deploy-restart-ran`;
  rmSync(deployBuildProbe, { force: true });
  rmSync(deployRestartProbe, { force: true });
  await restartSrv({
    FLEET_DEPLOY_BUILD_CMD: `touch ${deployBuildProbe}`,
    FLEET_DEPLOY_RESTART_CMD: `touch ${deployRestartProbe}`,
  });
  await setMergeMode("hang");
  await settleForMerge(lc.lnSlot);
  const mgB = await post(`/api/slots/${lc.lnSlot}/merge`, {});
  check("merge POST starts an async job", ((await mgB.json()) as { running?: boolean }).running === true);
  const mergeBranch = spawnSync("git", ["-C", lc.lnPath, "branch", "--show-current"]).stdout.toString().trim();
  const deployViewWhileMerge = (await (await get("/api/deploys")).json()) as { blocked?: string | null };
  const deployDuringMerge = await post("/api/deploy", {});
  const deployDuringMergeBody = (await deployDuringMerge.json()) as { ok?: unknown; stage?: string; reason?: string };
  check("deploy refuses at preflight while the merge/land is running and names the active land",
    deployDuringMerge.status === 409 && deployDuringMergeBody.ok === false
      && deployDuringMergeBody.stage === "preflight" && mergeBranch.length > 0
      && (deployDuringMergeBody.reason ?? "").includes(mergeBranch),
    `${deployDuringMerge.status} ${JSON.stringify(deployDuringMergeBody)}`);
  check("GET /api/deploys exposes the same active-land blocker to the operator",
    mergeBranch.length > 0 && (deployViewWhileMerge.blocked ?? "").includes(mergeBranch),
    JSON.stringify(deployViewWhileMerge));
  const subBeforeR = await selfMergeWatch(receiverAToken, lc.lnSlot);
  const subBefore = (await subBeforeR.json()) as { watch?: MergeWatchRow; existing?: boolean; error?: string };
  check("merge event: subscription BEFORE completion binds the target slot plus cwd+branch",
    subBeforeR.ok && subBefore.watch?.kind === "merge" && subBefore.watch.target === lc.lnSlot
      && subBefore.watch.targetCwd === lc.lnPath && subBefore.watch.armed === true,
    `${subBeforeR.status} ${JSON.stringify(subBefore)}`);
  const vB = await waitMerge(lc.lnSlot);
  const eventBefore = subBefore.watch ? await waitMergeEvent(subBefore.watch.id) : undefined;
  check("merge event: the running subscription produces exactly one terminal event after settle",
    vB.last?.status === "blocked" && eventBefore?.payload.status === "blocked"
      && eventBefore.payload.landed === false
      && (await mergeEvents()).filter((e) => e.watchId === subBefore.watch?.id).length === 1,
    JSON.stringify({ verdict: vB.last, event: eventBefore }));
  check("deploy refusal is an early no-op: neither build nor restart ran, and the merge reached its normal terminal",
    !exists(deployBuildProbe) && !exists(deployRestartProbe) && vB.last?.status === "blocked"
      && vB.last.detail === "fake hang" && (await get("/api/sessions")).ok,
    JSON.stringify({ build: exists(deployBuildProbe), restart: exists(deployRestartProbe), verdict: vB.last }));
  const deployViewAfterMerge = (await (await get("/api/deploys")).json()) as { blocked?: string | null };
  check("the deploy land blocker disappears after the merge reaches its terminal",
    deployViewAfterMerge.blocked === null, JSON.stringify(deployViewAfterMerge));
  const beforeText = (await plogRead()).filter((p) => p.slot === receiverA
    && p.text.includes(`[event ${eventBefore?.id}]`));
  check("merge event: a negative terminal result is delivered successfully and says landed=NO",
    beforeText.length === 1 && beforeText[0].text.includes("landed=NO")
      && beforeText[0].text.includes("successful notification of the terminal result"),
    beforeText.map((p) => p.text).join(" | "));

  const subAfterR = await selfMergeWatch(receiverBToken, lc.lnSlot);
  const subAfter = (await subAfterR.json()) as { watch?: MergeWatchRow; existing?: boolean; error?: string };
  const eventAfter = subAfter.watch ? await waitMergeEvent(subAfter.watch.id) : undefined;
  check("merge event: subscription AFTER a terminal merge fires immediately from persisted MergeLast",
    subAfterR.ok && subAfter.watch?.armed === false && eventAfter?.payload.status === "blocked"
      && eventAfter.payload.landed === false,
    `${subAfterR.status} ${JSON.stringify({ subAfter, eventAfter })}`);
  const spentWatchCount = (await mergeWatches()).filter((w) => w.slot === receiverB
    && w.target === lc.lnSlot && w.targetCwd === lc.lnPath).length;
  const spentEventCount = (await mergeEvents()).filter((e) => e.receiverSlot === receiverB).length;
  const spentRetryR = await selfMergeWatch(receiverBToken, lc.lnSlot);
  const spentRetry = (await spentRetryR.json()) as { watch?: MergeWatchRow; existing?: boolean; error?: string };
  check("merge event: a spent subscription explicitly refuses the same persisted terminal",
    spentRetryR.status === 409 && spentRetry.watch === undefined && spentRetry.existing === undefined
      && (spentRetry.error ?? "").includes("already fired")
      && (spentRetry.error ?? "").includes("no newer merge"),
    `${spentRetryR.status} ${JSON.stringify(spentRetry)}`);
  check("merge event: the spent refusal creates no watch or event",
    (await mergeWatches()).filter((w) => w.slot === receiverB
      && w.target === lc.lnSlot && w.targetCwd === lc.lnPath).length === spentWatchCount
      && (await mergeEvents()).filter((e) => e.receiverSlot === receiverB).length === spentEventCount,
    JSON.stringify({ spentWatchCount, spentEventCount }));
  const ack1 = eventAfter ? await ackMergeEvent(receiverBToken, eventAfter.id) : null;
  const ack2 = eventAfter ? await ackMergeEvent(receiverBToken, eventAfter.id) : null;
  check("merge event: acknowledgement is idempotent",
    ack1?.ok === true && ack2?.ok === true
      && ((await ack2.json()) as { existing?: boolean }).existing === true,
    `${ack1?.status}/${ack2?.status}`);

  await setMergeMode("hang");
  await settleForMerge(lc.lnSlot);
  const newerMergeR = await post(`/api/slots/${lc.lnSlot}/merge`, {});
  const newerMerge = (await newerMergeR.json()) as { running?: boolean };
  check("merge event: a newer merge starts after the prior terminal fired",
    newerMergeR.ok && newerMerge.running === true, `${newerMergeR.status} ${JSON.stringify(newerMerge)}`);
  const renewedR = await selfMergeWatch(receiverBToken, lc.lnSlot);
  const renewed = (await renewedR.json()) as { watch?: MergeWatchRow; existing?: boolean; error?: string };
  check("merge event: an in-flight newer merge arms a fresh subscription after the spent one",
    renewedR.ok && renewed.existing === undefined && renewed.watch?.armed === true
      && renewed.watch.id !== subAfter.watch?.id,
    `${renewedR.status} ${JSON.stringify(renewed)}`);
  const renewedDuplicateR = await selfMergeWatch(receiverBToken, lc.lnSlot);
  const renewedDuplicate = (await renewedDuplicateR.json()) as { watch?: MergeWatchRow; existing?: boolean };
  check("merge event: an armed duplicate returns the fresh subscription idempotently",
    renewedDuplicateR.ok && renewedDuplicate.existing === true
      && renewedDuplicate.watch?.id === renewed.watch?.id,
    `${renewedDuplicateR.status} ${JSON.stringify(renewedDuplicate)}`);
  const renewedVerdict = await waitMerge(lc.lnSlot);
  const renewedEvent = renewed.watch ? await waitMergeEvent(renewed.watch.id) : undefined;
  check("merge event: the newer terminal fires exactly one event for the fresh subscription",
    renewedVerdict.last?.status === "blocked" && renewedEvent?.payload.status === "blocked"
      && (await mergeEvents()).filter((e) => e.watchId === renewed.watch?.id).length === 1,
    JSON.stringify({ verdict: renewedVerdict.last, event: renewedEvent }));
  if (renewedEvent) await ackMergeEvent(receiverBToken, renewedEvent.id);
  await post(`/api/slots/${receiverB}/kill`, {});
  const reopenReceiverB = await post(`/api/slots/${receiverB}/open`, { cwd: REPO });
  receiverBToken = await paneEnv(`s${receiverB}`, "FLEET_SELF_TOKEN") ?? "";
  const replacedAck = eventAfter ? await ackMergeEvent(receiverBToken, eventAfter.id) : null;
  check("merge event: a replacement occupant cannot acknowledge the old session's event",
    reopenReceiverB.ok && replacedAck?.status === 409,
    `${replacedAck?.status} ${replacedAck ? await replacedAck.text() : "no event"}`);
  rmSync(deployBuildProbe, { force: true });
  rmSync(deployRestartProbe, { force: true });
  await restartSrv();

  await setMergeMode("blocked");
  await settleForMerge(lc.lnSlot);
  await post(`/api/slots/${lc.lnSlot}/merge`, {});
  const vBlocked = await waitMerge(lc.lnSlot);
  check("conflict → agent 'blocked' verdict passes through with detail",
    !vBlocked.gone && vBlocked.last?.status === "blocked" && vBlocked.last.detail === "fake conflict", JSON.stringify(vBlocked));
  // V1 gate: verify runs ONLY against a git-verified rebased tree (design note §6 rule 4).
  // A blocked verdict never rebased anything → no verify field, even though a cmd IS
  // configured. Guards against a mutation that runs verify on a pre-rebase / non-rebased tree.
  check("V1: a blocked verdict (no rebased tree) carries no verify field",
    vBlocked.last !== null && vBlocked.last.verify === undefined, JSON.stringify(vBlocked.last?.verify));

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
  // ② changed what this check MEANS, so the fallback contract is stated rather than implied. Since
  // the author path exists, "the throwaway resolver ran" is a claim about a FALLBACK, and every
  // agent-verdict check in this file holds only because these panes run FLEET_CMD=true and the
  // server's strict alive probe therefore finds no claude to wake. Assert that reason out loud:
  // the verdict names the resolver as the agent AND says why the author was passed over. Without
  // this, a regression that broke the author gate would leave the suite green and silent.
  check("fallback: with no claude in the lane pane the throwaway resolver runs, and the verdict says so",
    (vD.last as { resolvedBy?: string } | null)?.resolvedBy === "agent"
    && (vD.last?.detail ?? "").includes("author unavailable: no-claude"),
    JSON.stringify({ resolvedBy: (vD.last as { resolvedBy?: string } | null)?.resolvedBy, detail: vD.last?.detail }));
  // V1: verify runs on the RESOLVED (conflict) path too — server-side, against the rebased
  // tree, its result recorded as a fact (design note §3, §6 rule 4). This -X theirs resolution
  // leaves no VERIFYBAD marker → green. Proves the call fires on the resolved path (a kept
  // lane whose verdict is readable, unlike a torn-down clean land) and binds mainSha.
  check("V1: resolved verdict carries verify.ok:true against the rebased tree (mainSha bound)",
    vD.last?.verify?.ok === true && vD.last.verify.cmd.endsWith("fakeverify")
      && typeof vD.last.verify.mainSha === "string" && /^[0-9a-f]{40,64}$/.test(vD.last.verify.mainSha),
    JSON.stringify(vD.last?.verify));
  const resolvedSubR = await selfMergeWatch(receiverBToken, lc.lnSlot);
  const resolvedSub = (await resolvedSubR.json()) as { watch?: MergeWatchRow; error?: string };
  const resolvedEvent = resolvedSub.watch ? await waitMergeEvent(resolvedSub.watch.id) : undefined;
  const resolvedText = (await plogRead()).find((p) => p.slot === receiverB
    && p.text.includes(`[event ${resolvedEvent?.id}]`))?.text ?? "";
  check("merge event: resolved/review state is never reported as landed in payload or rendered text",
    resolvedSubR.ok && resolvedEvent?.payload.status === "resolved" && resolvedEvent.payload.landed === false
      && resolvedText.includes("landed=NO") && resolvedText.includes("Awaiting your review")
      && resolvedText.includes("NOT landed"),
    JSON.stringify({ event: resolvedEvent, text: resolvedText }));
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
  // --- WHICH MODEL RESOLVED THE CONFLICT, AND WHAT THAT COST ------------------------------------
  // Until 2026-09-06 both ledgers said THAT a conflict was agent-resolved and neither said by
  // WHOM: `runResolve`/`runRepair` were the only runWorker call sites with no `observe` hook, so
  // "has this model ever failed on a conflict here?" was unanswerable from 470 land notes.
  // The note is read at `main` because the ff-merge just made the lane tip the integration tip.
  // `conflictedFiles` is asserted as the exact 1 this fixture created (code.txt) rather than
  // ">= 0": a count that could be anything would not tell the field from a zero-initialised one.
  // The MODEL is asserted as the literal SUMMARY_MODEL default, which is precisely the value under
  // the owner's question — the merge worker is pinned to the claude route and passes no per-call
  // model, so summaryViaSession resolves `opts.model ?? SUMMARY_MODEL`. The subprocess stand-in
  // takes the same value from the same const, so this asserts the wiring, not the transport.
  type ResolverRunShape = { worker?: string; model?: string; backend?: string; status?: string;
    ms?: number; conflictedFiles?: number };
  const landNoteRuns = (sha: string): ResolverRunShape[] | null | undefined => {
    const raw = spawnSync("git", ["-C", REPO, "notes", "--ref=fleet/land", "show", sha]);
    if (raw.status !== 0) return undefined; // no note at all — a different failure from "no field"
    try { return (JSON.parse(raw.stdout.toString()) as { resolverRuns?: ResolverRunShape[] }).resolverRuns ?? null; }
    catch { return undefined; }
  };
  const outcomeRuns = async (branch: string): Promise<ResolverRunShape[] | null | undefined> =>
    ((await (await get("/api/lane-outcomes?limit=200")).json()) as
      { outcomes: { branch: string | null; disposition: string; resolverRuns?: ResolverRunShape[] }[] })
      .outcomes.find((o) => o.disposition === "landed" && o.branch === branch)?.resolverRuns;
  const resolvedRuns = landNoteRuns("main");
  check("the land note of an agent-resolved conflict names the resolver's model, verdict, cost and difficulty",
    (resolvedRuns ?? []).length === 1 && resolvedRuns?.[0]?.worker === "merge"
      && resolvedRuns[0].status === "rebased" && resolvedRuns[0].model === "claude-sonnet-5[1m]"
      && resolvedRuns[0].conflictedFiles === 1 && typeof resolvedRuns[0].ms === "number"
      && (resolvedRuns[0].ms ?? -1) >= 0 && resolvedRuns[0].backend === undefined,
    JSON.stringify(resolvedRuns ?? null));
  check("the outcome row carries the SAME resolver runs — the lane-side copy of the note's fact",
    JSON.stringify(await outcomeRuns(mergeBranch)) === JSON.stringify(resolvedRuns),
    JSON.stringify({ outcome: await outcomeRuns(mergeBranch), note: resolvedRuns ?? null }));
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
  const lnClean = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
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
  // WHO LANDED IT, on all three carriers. Until 2026-08-24 the land note answered `confirmedByHuman`
  // and nothing else, so a land a session made by reading fleet.json's owner token was
  // BYTE-IDENTICAL in the ledger to one the owner made from the board (measured once, `9cc8b1e`).
  // The note now names the actor class and the token CHANNEL it arrived on; `landedBy` on the
  // outcome row is the same fact where a reader asks about LANES rather than commits; the trail row
  // survives a repo nobody ever clones. This suite drives the owner routes over
  // `Authorization: Bearer` (harness `H`), so `via` is asserted as exactly that — a probe that
  // accepted any channel could not tell the field from a constant. No `suspect`: this lane's task
  // has no Program, and the flag is scoped to a lane whose Program has a LIVE bound MAIN.
  const cleanNoteRaw = spawnSync("git", ["-C", REPO, "notes", "--ref=fleet/land", "show", "main"]);
  type LandNoteShape = { actor?: { kind?: string; via?: string; suspect?: string }; confirmedByHuman?: boolean };
  let cleanNote: LandNoteShape | null = null;
  try { cleanNote = JSON.parse(cleanNoteRaw.stdout.toString()) as LandNoteShape; } catch { /* asserted below */ }
  check("the land note names the ACTOR and the token channel it arrived on, beside confirmedByHuman",
    cleanNoteRaw.status === 0 && cleanNote?.actor?.kind === "owner" && cleanNote.actor.via === "bearer"
      && cleanNote.actor.suspect === undefined && cleanNote.confirmedByHuman === false,
    cleanNoteRaw.stdout.toString().trim().slice(0, 300));
  const cleanOutcome = ((await (await get("/api/lane-outcomes?limit=50")).json()) as
    { outcomes: { branch: string | null; disposition: string; landedBy?: { kind?: string; via?: string } }[] })
    .outcomes.find((o) => o.disposition === "landed" && o.branch === lnClean.branch);
  check("the outcome row carries the same actor as landedBy — the LANE-side copy of the note's fact",
    cleanOutcome?.landedBy?.kind === "owner" && cleanOutcome.landedBy.via === "bearer",
    JSON.stringify(cleanOutcome ?? null));
  const landActorRows = readFileSync(`${ROOT}/audit.jsonl`, "utf8").split("\n").filter(Boolean)
    .flatMap((line) => { try { return [JSON.parse(line) as { event?: string; detail?: string }]; } catch { return []; } })
    .filter((r) => r.event === "land_actor");
  check("recordLand books a land_actor trail row naming the same actor",
    landActorRows.some((r) => (r.detail ?? "").includes(lnClean.branch) && (r.detail ?? "").includes("owner via=bearer")),
    JSON.stringify(landActorRows.slice(-3)));

  // the UNTRACKED twin of the dirty-holder refusal (2026-08-05): a file the lane ADDS that lies
  // untracked in the primary used to pass this guard (it filtered ?? out) and die at the very end
  // — ff-only's raw stderr, after the full verify spend. Now it is the same curated refusal, up
  // front. The unrelated untracked file proves the doctrine survives: only a NAME COLLISION
  // blocks, plain dirt in the holder never does.
  const lnU = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  await Bun.write(`${lnU.cwd}/untracked-collide.txt`, "lane adds this\n");
  spawnSync("git", ["-C", lnU.cwd, "add", "untracked-collide.txt"]);
  spawnSync("git", ["-C", lnU.cwd, "commit", "-qm", "untracked collide work"]);
  await Bun.write(`${REPO}/untracked-collide.txt`, "the holder's uncommitted twin\n"); // untracked there
  await Bun.write(`${REPO}/unrelated-untracked.txt`, "must not block\n");
  await setMergeMode("blocked"); // agent, if wrongly consulted, would block — it must not be
  await settleForMerge(lnU.slot);
  const uRes = (await (await post(`/api/slots/${lnU.slot}/merge`, {})).json()) as { status?: string; detail?: string };
  check("a holder-untracked file the lane ADDS blocks the land up front, curated (not raw ff stderr)",
    uRes.status === "blocked" && (uRes.detail ?? "").includes("UNTRACKED files this lane also adds")
    && (uRes.detail ?? "").includes("untracked-collide.txt"), JSON.stringify(uRes));
  rmSync(`${REPO}/untracked-collide.txt`, { force: true });
  await settleForMerge(lnU.slot);
  await post(`/api/slots/${lnU.slot}/merge`, {});
  const vU = await waitMerge(lnU.slot);
  check("with the twin gone the same lane lands — the unrelated untracked file never blocked",
    vU.gone && exists(`${REPO}/unrelated-untracked.txt`), JSON.stringify(vU));
  rmSync(`${REPO}/unrelated-untracked.txt`, { force: true });

  // a correct rebase answered in PROSE must not be thrown away: git verification is the
  // authority, the agent's JSON is only narrative (seen live — injection-distracted agent
  // rebased perfectly, then narrated instead of answering the contract). Conflict setup so
  // the agent actually runs.
  const lnP = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
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
  // …and the SAME land records the off-contract answer AS off-contract. This is the half the
  // ledger exists for: git verified the rebase and the land is correct, so every other field on
  // this note reads like the clean case above — only `status: "unparseable"` says the model missed
  // its own JSON contract. Folding that into "blocked" (it resolved nothing) or into "rebased"
  // (git says it did) would erase the one measurement of the MODEL on a note that measures git.
  const proseRuns = landNoteRuns("main"); // the ff just made this lane's tip the integration tip
  check("an off-contract resolver answer is counted AS unparseable on the land note, not folded into blocked",
    (proseRuns ?? []).length === 1 && proseRuns?.[0]?.worker === "merge"
      && proseRuns[0].status === "unparseable" && proseRuns[0].model === "claude-sonnet-5[1m]"
      && proseRuns[0].conflictedFiles === 1,
    JSON.stringify(proseRuns ?? null));
  check("the prose land's outcome row counts the same unparseable run",
    ((await outcomeRuns(lnP.branch)) ?? []).some((r) => r.status === "unparseable" && r.worker === "merge"),
    JSON.stringify(await outcomeRuns(lnP.branch)));

  // Main identity and candidate identity are distinct at confirm. This fixture deliberately moves
  // a CONTEXT line in the SAME file, within patch-id's three context lines: the replay is clean and
  // the lane hunk byte-identical, but patch-id changes. The server-observed replay-tip SHA — not a
  // cross-context patch-id comparison — is therefore the second guard's authority.
  await Bun.write(`${REPO}/code.txt`, "a\nb\nc\nTARGET\ne\n");
  spawnSync("git", ["-C", REPO, "commit", "-aqm", "context replay fixture base"]);
  const lnStale = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  await Bun.write(`${lnStale.cwd}/code.txt`, "a\nb\nc\nCHANGED\ne\n");
  spawnSync("git", ["-C", lnStale.cwd, "commit", "-aqm", "stale lane work"]);
  await Bun.write(`${REPO}/code.txt`, "a\nb\nc\nMAIN-SIDE\ne\n"); // TARGET conflict → agent resolves to CHANGED
  spawnSync("git", ["-C", REPO, "commit", "-aqm", "stale main work"]);
  await setMergeMode("do");
  await settleForMerge(lnStale.slot);
  await post(`/api/slots/${lnStale.slot}/merge`, {});
  const vSt = await waitMerge(lnStale.slot);
  check("ACP-03 repair setup: same-file lane hunk is resolved + verified before context movement",
    !vSt.gone && vSt.last?.status === "resolved" && vSt.last.verify?.ok === true
      && /^[0-9a-f]{40,64}$/.test(vSt.last.diffHash ?? ""), JSON.stringify(vSt.last));
  // `b` is two lines above the reviewed TARGET/CHANGED hunk: within patch-id context, outside the
  // changed line. Git replays this conflict-free, but stable patch-id changes with the context.
  await Bun.write(`${REPO}/code.txt`, "a\nb-MOVED\nc\nMAIN-SIDE\ne\n");
  spawnSync("git", ["-C", REPO, "commit", "-aqm", "main moved patch context after resolution"]);
  const replayMainBefore = spawnSync("git", ["-C", REPO, "rev-parse", "main"]).stdout.toString().trim();
  const staleR = await post(`/api/slots/${lnStale.slot}/merge`, { confirm: true });
  const staleJ = (await staleR.json()) as
    { status?: string; landed?: boolean; detail?: string };
  check("ACP-03 repair: same-file context movement replays conflict-free and confirm lands",
    staleR.ok && staleJ.status === "merged" && staleJ.landed === true,
    `${staleR.status} ${JSON.stringify(staleJ)}`);
  check("ACP-03 repair: replayed land carries the byte-identical lane hunk plus moved context",
    spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString().includes("stale lane work")
      && spawnSync("git", ["-C", REPO, "show", "HEAD:code.txt"]).stdout.toString() === "a\nb-MOVED\nc\nCHANGED\ne\n",
    spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString().trim());
  const replayMainAfter = spawnSync("git", ["-C", REPO, "rev-parse", "main"]).stdout.toString().trim();
  const replayDiff = spawnSync("git", ["-C", REPO, "diff", "--binary", `${replayMainBefore}...${replayMainAfter}`, "--"]);
  const replayPatch = spawnSync("git", ["-C", REPO, "patch-id", "--stable"], { input: replayDiff.stdout });
  const replayDiffHash = replayPatch.stdout.toString().trim().split(/\s+/)[0] ?? "";
  check("ACP-03 repair probe bites: same lane hunk has a different patch-id after nearby context moved",
    /^[0-9a-f]{40,64}$/.test(replayDiffHash) && replayDiffHash !== vSt.last?.diffHash,
    JSON.stringify({ reviewed: vSt.last?.diffHash, replayed: replayDiffHash }));
  const contextNoteRaw = spawnSync("git", ["-C", REPO, "notes", "--ref=fleet/land", "show", "main"]);
  let contextNote: { verify?: { mainSha?: string; stale?: true } } | null = null;
  try { contextNote = JSON.parse(contextNoteRaw.stdout.toString()) as { verify?: { mainSha?: string; stale?: true } }; } catch { /* asserted below */ }
  check("ACP-03 repair: replayed confirm marks the pre-move verify stale in provenance",
    contextNoteRaw.status === 0 && contextNote?.verify?.stale === true
      && contextNote.verify.mainSha === vSt.last?.verify?.mainSha,
    contextNoteRaw.stdout.toString().trim());

  // Same-line main movement passes the candidate pre-check, then the controlled replay conflicts
  // and falls back to ⏫ exactly as before. The lane is left clean and unchanged.
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
  const rcR = await post(`/api/slots/${lnReconf.slot}/merge`, { confirm: true });
  const rcJ = (await rcR.json()) as
    { status?: string; detail?: string };
  check("confirm-land falls back to ⏫ when moved main re-conflicts",
    rcJ.status === "blocked" && (rcJ.detail ?? "").includes("re-run"),
    `${rcR.status} ${JSON.stringify(rcJ)}`);
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
  const lnFt = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
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
  const ftGuard = (await (await post(`/api/slots/${lnFt.slot}/merge`, {})).json()) as { status?: string; detail?: string; running?: boolean };
  // The REFUSAL half of the ⏸ pair. It is keyed on the verdict HOLDING a resolution (`conflicted`
  // set — vFt1 above), not on the word "resolved"; the re-runnable half is the wait-out block in
  // section (C3). `running` must stay absent: a refusal that also started a job would land the
  // unreviewed resolution while telling the owner it had refused.
  check("⏸ a re-run is refused while the resolution is still rebased onto main (guard unchanged)",
    ftGuard.status === "resolved" && (ftGuard.detail ?? "").includes("review")
    && ftGuard.running !== true, JSON.stringify(ftGuard));
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

  // ⏸ has to survive a KILL + REATTACH too (2026-08-05). The record describes commits on the
  // BRANCH, and the branch outlives the slot — but the verdict was slot-keyed: openSlot dropped
  // it on every open (reattach included) and the boot restore drops it for slots without a
  // worktree. Kill → reattach → ⏫ then found no pending verdict, carried nothing, and the clean
  // auto-land path landed the agent's resolutions unreviewed — the deploy hole's kill-shaped
  // twin (that one is named in the boot-restore comment; this one had no check until now).
  const lnKr = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  await Bun.write(`${lnKr.cwd}/code.txt`, "root\nkr-lane\n");
  spawnSync("git", ["-C", lnKr.cwd, "commit", "-aqm", "killreattach lane work"]);
  await Bun.write(`${REPO}/code.txt`, "root\nkr-main\n"); // same line → conflict → agent resolves
  spawnSync("git", ["-C", REPO, "commit", "-aqm", "killreattach main work"]);
  await setMergeMode("do");
  await settleForMerge(lnKr.slot);
  await post(`/api/slots/${lnKr.slot}/merge`, {});
  const vKr = await waitMerge(lnKr.slot);
  check("(setup) kill/reattach lane is agent-resolved and paused", vKr.last?.status === "resolved", JSON.stringify(vKr.last));
  const krPath = lnKr.cwd;
  await post(`/api/slots/${lnKr.slot}/kill`, {});
  const krAtt = (await (await post("/api/lanes", { repo: REPO, attach: krPath })).json()) as { slot?: number };
  check("(setup) the killed lane reattaches into a slot", typeof krAtt.slot === "number", JSON.stringify(krAtt));
  const krSlot = krAtt.slot as number;
  const krPend = ((await (await get("/api/sessions")).json()) as { slots: { id: number; mergePending?: boolean }[] })
    .slots.find((s) => s.id === krSlot);
  check("⏸ survives kill + reattach — the reattached lane still wears the pause",
    krPend?.mergePending === true, JSON.stringify(krPend ?? null));
  await setMergeMode("blocked"); // if the re-run consulted the agent, the verdict would be blocked
  await settleForMerge(krSlot);
  const krRe = (await (await post(`/api/slots/${krSlot}/merge`, {})).json()) as { status?: string; detail?: string };
  check("⏸ a re-run after reattach refuses instead of auto-landing the unreviewed resolution",
    krRe.status === "resolved" && (krRe.detail ?? "").includes("review"), JSON.stringify(krRe));
  check("the unreviewed resolution has NOT reached main through the reattach hole",
    !spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString().includes("killreattach lane work"),
    spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString().trim());
  await settleForMerge(krSlot);
  const krConf = (await (await post(`/api/slots/${krSlot}/merge`, { confirm: true })).json()) as
    { status?: string; landed?: boolean };
  check("the reattached lane confirm-lands after review (the park never wedges the land)",
    krConf.status === "merged" && krConf.landed === true, JSON.stringify(krConf));

  // …and the other direction: a ⏸ must not outlive the branch it describes. landLane deletes the
  // branch-keyed park, but killSlot runs milliseconds later and parkMergeVerdict lifts whatever
  // slot-keyed verdict is still in mergeLast straight back INTO that park — and a confirm-land is
  // exactly the shape that still holds one. Both lands just above are that shape (ft never let go
  // of its verdict; kr's came back out of the park at reattach), and both left a phantom entry
  // behind: a review posten pointing at a branch whose worktree is gone. Asserting the STATE FILE
  // rather than an endpoint is deliberate — mergeParked has no route, and the file is the only
  // thing the boot restore reads, so an absence here is also the "not after a restart" half.
  // The complement of the kill+reattach checks above: those two go red if the park is dropped,
  // this one goes red if it is kept too long.
  await Bun.sleep(600); // saveState writes through a promise chain — let it settle before reading
  const parkedAfterLand = Object.keys(((await Bun.file(`${ROOT}/fleet.json`).json()) as
    { mergeParked?: Record<string, unknown> }).mergeParked ?? {});
  check("a LANDED branch leaves no parked ⏸ behind — not in memory, and not in the file a restart reads",
    !parkedAfterLand.includes(lnKr.branch) && !parkedAfterLand.includes(lnFt.branch),
    JSON.stringify({ parked: parkedAfterLand, kr: lnKr.branch, ft: lnFt.branch }));

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
  const lnVp = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  await Bun.write(`${lnVp.cwd}/verify-pass.txt`, "clean lane work, VERIFYSLOWPASS for event subscription\n");
  spawnSync("git", ["-C", lnVp.cwd, "add", "verify-pass.txt"]);
  spawnSync("git", ["-C", lnVp.cwd, "commit", "-qm", "verify-pass lane work"]);
  await Bun.write(`${REPO}/vp-main.txt`, "main side\n"); // different file → clean rebase, no agent
  spawnSync("git", ["-C", REPO, "add", "vp-main.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "vp main work"]);
  await settleForMerge(lnVp.slot);
  await post(`/api/slots/${lnVp.slot}/merge`, {});
  const landedSubR = await selfMergeWatch(receiverBToken, lnVp.slot);
  const landedSub = (await landedSubR.json()) as { watch?: MergeWatchRow; error?: string };
  const vVp = await waitMerge(lnVp.slot);
  const landedEvent = landedSub.watch ? await waitMergeEvent(landedSub.watch.id) : undefined;
  const landedText = (await plogRead()).find((p) => p.slot === receiverB
    && p.text.includes(`[event ${landedEvent?.id}]`))?.text ?? "";
  check("V1: clean rebase that passes verify lands (verify green never blocks a clean land)", vVp.gone, JSON.stringify(vVp));
  check("merge event: landed result survives target teardown and is distinct from verify-red/review",
    landedSubR.ok && landedEvent?.payload.status === "merged" && landedEvent.payload.landed === true
      && landedEvent.payload.verify?.ok === true && landedText.includes("landed=YES")
      && !landedText.includes("Awaiting your review"),
    JSON.stringify({ event: landedEvent, text: landedText }));
  check("V1: passing verify lane's commit reached main",
    spawnSync("git", ["-C", REPO, "log", "--oneline", "-3"]).stdout.toString().includes("verify-pass lane work"));
  spawnSync("git", ["-C", REPO, "rm", "-q", "verify-pass.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "cleanup: drop delayed verify fixture from main"]);

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
  check("ACP-03 Q1: the real merge verdict binds mainSha + candidateSha + stable diffHash",
    /^[0-9a-f]{40,64}$/.test(vVf.last?.mainSha ?? "")
      && /^[0-9a-f]{40,64}$/.test(vVf.last?.candidateSha ?? "")
      && /^[0-9a-f]{40,64}$/.test(vVf.last?.diffHash ?? "")
      && vVf.last?.mainSha === vVf.last?.verify?.mainSha,
    JSON.stringify(vVf.last));
  const vfPolicyFacts = projectPromotionPolicyFacts(vVf.last ?? {}, {
    mainSha: vVf.last?.mainSha ?? "", candidateSha: vVf.last?.candidateSha ?? "",
    diffHash: vVf.last?.diffHash ?? "",
  });
  check("ACP-03 policy sensor: identity/verify freshness and risk facts are read-only inputs, not eligibility",
    vfPolicyFacts.candidateFreshness === "fresh" && vfPolicyFacts.verifyFreshness === "fresh"
      && vfPolicyFacts.riskClasses.includes("verify-failed")
      && vfPolicyFacts.conflicts.length === 0 && vfPolicyFacts.repairRounds === 0
      && !("eligible" in vfPolicyFacts),
    JSON.stringify(vfPolicyFacts));
  const movedMainFacts = projectPromotionPolicyFacts(vVf.last ?? {}, {
    mainSha: "f".repeat(40), candidateSha: vVf.last?.candidateSha ?? "",
    diffHash: vVf.last?.diffHash ?? "",
  });
  check("ACP-03 policy sensor: unrelated main movement keeps candidate fresh but makes verify stale",
    movedMainFacts.candidateFreshness === "fresh" && movedMainFacts.verifyFreshness === "stale",
    JSON.stringify(movedMainFacts));
  check("merge event restart fixture: pause transport before minting the persisted red outcome",
    (await post("/api/autos/switch", { on: false })).ok);
  const redSubR = await selfMergeWatch(receiverAToken, lnVf.slot);
  const redSub = (await redSubR.json()) as { watch?: MergeWatchRow; error?: string };
  const redPending = redSub.watch ? await waitMergeEvent(redSub.watch.id, false) : undefined;
  check("merge event: verify-red mints a pending resolved/landed:false event while transport is paused",
    redSubR.ok && redPending?.status === "pending" && redPending.payload.status === "resolved"
      && redPending.payload.landed === false && redPending.payload.verify?.ok === false,
    JSON.stringify(redPending));
  await restartSrv();
  const redAfterRestart = redSub.watch
    ? (await mergeEvents()).filter((e) => e.watchId === redSub.watch?.id) : [];
  check("merge event: restart AFTER mint but before delivery loses and duplicates nothing",
    redAfterRestart.length === 1 && redAfterRestart[0].status === "pending",
    JSON.stringify(redAfterRestart));
  check("merge event restart fixture: release transport after boot", (await post("/api/autos/switch", { on: true })).ok);
  const redDelivered = redSub.watch ? await waitMergeEvent(redSub.watch.id) : undefined;
  const redText = (await plogRead()).filter((p) => p.slot === receiverA
    && p.text.includes(`[event ${redDelivered?.id}]`));
  check("merge event: verify-red delivers once after restart and is explicit review/NOT landed text",
    redDelivered?.status === "delivered" && redDelivered.payload.verify?.ok === false
      && redText.length === 1 && redText[0].text.includes("verify RED")
      && redText[0].text.includes("Awaiting your review") && redText[0].text.includes("landed=NO"),
    JSON.stringify({ event: redDelivered, texts: redText.map((p) => p.text) }));
  const vfPreLand = spawnSync("git", ["-C", REPO, "log", "--oneline", "-3"]).stdout.toString();
  check("V1: verify-failed lane's commit has NOT reached main",
    !vfPreLand.includes("verify-fail lane work"), vfPreLand.trim());

  // ACP-03 Q2: the verdict reviewed one exact candidate. A later lane commit changes both the
  // tip and canonical diff, so confirm must bite with 409 before markLandIntent/main/note.
  await Bun.write(`${lnVf.cwd}/candidate-after-review.txt`, "this commit was not reviewed\n");
  spawnSync("git", ["-C", lnVf.cwd, "add", "candidate-after-review.txt"]);
  let staleCommit = false;
  for (let i = 0; i < 20 && !staleCommit; i++) {
    staleCommit = spawnSync("git", ["-C", lnVf.cwd, "commit", "-qm", "candidate changed after review"]).status === 0;
    if (!staleCommit) await Bun.sleep(150);
  }
  check("ACP-03 Q2 setup: the post-verdict commit exists (the stale guard is measuring a real change)",
    staleCommit, spawnSync("git", ["-C", lnVf.cwd, "status", "--porcelain"]).stdout.toString().trim());
  const staleTip = spawnSync("git", ["-C", lnVf.cwd, "rev-parse", "HEAD"]).stdout.toString().trim();
  const staleMainBefore = spawnSync("git", ["-C", REPO, "rev-parse", "main"]).stdout.toString().trim();
  const staleNoteBefore = spawnSync("git", ["-C", REPO, "notes", "--ref=fleet/land", "show", staleTip]).status;
  await settleForMerge(lnVf.slot);
  const staleConfirmR = await post(`/api/slots/${lnVf.slot}/merge`, { confirm: true });
  const staleConfirm = (await staleConfirmR.json()) as { status?: string; landed?: boolean; detail?: string };
  const staleMainAfter = spawnSync("git", ["-C", REPO, "rev-parse", "main"]).stdout.toString().trim();
  const staleNoteAfter = spawnSync("git", ["-C", REPO, "notes", "--ref=fleet/land", "show", staleTip]).status;
  check("ACP-03 Q2: post-verdict candidate change makes confirm return 409 stale",
    staleConfirmR.status === 409 && staleConfirm.status === "stale" && staleConfirm.landed === false,
    `${staleConfirmR.status} ${JSON.stringify(staleConfirm)}`);
  check("ACP-03 Q2: stale refusal leaves main byte-for-byte at the pre-confirm SHA",
    staleMainBefore === staleMainAfter,
    JSON.stringify({ before: staleMainBefore, after: staleMainAfter }));
  check("ACP-03 Q2: stale refusal writes no land note for the unreviewed candidate",
    staleNoteBefore !== 0 && staleNoteAfter !== 0,
    JSON.stringify({ candidate: staleTip, noteBeforeExit: staleNoteBefore, noteAfterExit: staleNoteAfter }));
  await post(`/api/slots/${lnVf.slot}/kill`, {});
  await post("/api/worktrees/discard", { repo: REPO, path: lnVf.cwd, branch: lnVf.branch });

  // ACP-03 Q3 counter-probe: the same red-verify review flow, with no commit after the verdict,
  // still preserves owner latitude and lands normally.
  const lnVfresh = (await (await post("/api/lanes", { repo: REPO })).json()) as
    { slot: number; cwd: string; branch: string };
  await Bun.write(`${lnVfresh.cwd}/verify-fresh-confirm.txt`, "lane work with a VERIFYBAD marker\n");
  spawnSync("git", ["-C", lnVfresh.cwd, "add", "verify-fresh-confirm.txt"]);
  let freshCommit = false;
  for (let i = 0; i < 20 && !freshCommit; i++) {
    freshCommit = spawnSync("git", ["-C", lnVfresh.cwd, "commit", "-qm", "fresh candidate confirm lane work"]).status === 0;
    if (!freshCommit) await Bun.sleep(150);
  }
  check("ACP-03 Q3 setup: unchanged-candidate fixture commit exists",
    freshCommit, spawnSync("git", ["-C", lnVfresh.cwd, "status", "--porcelain"]).stdout.toString().trim());
  await Bun.write(`${REPO}/vf-fresh-main.txt`, "main side\n");
  spawnSync("git", ["-C", REPO, "add", "vf-fresh-main.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "fresh candidate main work"]);
  await settleForMerge(lnVfresh.slot);
  await post(`/api/slots/${lnVfresh.slot}/merge`, {});
  const vFresh = await waitMerge(lnVfresh.slot);
  check("ACP-03 Q3 setup: unchanged candidate has a reviewable identity-bound verdict",
    vFresh.last?.status === "resolved" && vFresh.last.verify?.ok === false
      && /^[0-9a-f]{40,64}$/.test(vFresh.last.candidateSha ?? ""), JSON.stringify(vFresh.last));
  const freshMainBefore = spawnSync("git", ["-C", REPO, "rev-parse", "main"]).stdout.toString().trim();
  await settleForMerge(lnVfresh.slot);
  const freshConfirmR = await post(`/api/slots/${lnVfresh.slot}/merge`, { confirm: true });
  const freshConfirm = (await freshConfirmR.json()) as { status?: string; landed?: boolean };
  const freshMainAfter = spawnSync("git", ["-C", REPO, "rev-parse", "main"]).stdout.toString().trim();
  check("ACP-03 Q3: the unchanged candidate still confirm-lands normally",
    freshConfirmR.ok && freshConfirm.status === "merged" && freshConfirm.landed === true
      && freshMainBefore !== freshMainAfter,
    `${freshConfirmR.status} ${JSON.stringify({ freshConfirm, freshMainBefore, freshMainAfter })}`);
  // scrub the VERIFYBAD marker back out of main so later clean lanes (this suite reuses REPO
  // heavily) don't inherit a red verify from this deliberately-broken confirm-land.
  spawnSync("git", ["-C", REPO, "rm", "-q", "verify-fresh-confirm.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "cleanup: drop VERIFYBAD marker from main"]);

  // ACP-03 Q4: boot a genuinely persisted pre-identity row. Killing the scratch server before
  // editing its scratch fleet.json makes the fixture deterministic: no process can overwrite it.
  const lnLegacy = (await (await post("/api/lanes", { repo: REPO })).json()) as
    { slot: number; cwd: string; branch: string };
  await Bun.write(`${lnLegacy.cwd}/legacy-verify.txt`, "lane work with a VERIFYBAD marker\n");
  spawnSync("git", ["-C", lnLegacy.cwd, "add", "legacy-verify.txt"]);
  let legacyCommit = false;
  for (let i = 0; i < 20 && !legacyCommit; i++) {
    legacyCommit = spawnSync("git", ["-C", lnLegacy.cwd, "commit", "-qm", "legacy verdict lane work"]).status === 0;
    if (!legacyCommit) await Bun.sleep(150);
  }
  check("ACP-03 Q4 setup: legacy fixture commit exists",
    legacyCommit, spawnSync("git", ["-C", lnLegacy.cwd, "status", "--porcelain"]).stdout.toString().trim());
  await Bun.write(`${REPO}/legacy-main.txt`, "main side\n");
  spawnSync("git", ["-C", REPO, "add", "legacy-main.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "legacy verdict main work"]);
  await settleForMerge(lnLegacy.slot);
  await post(`/api/slots/${lnLegacy.slot}/merge`, {});
  const legacyWritten = await waitMerge(lnLegacy.slot);
  check("ACP-03 Q4 setup: current server first wrote a complete verdict to downgrade into a legacy fixture",
    legacyWritten.last?.status === "resolved" && /^[0-9a-f]{40,64}$/.test(legacyWritten.last.diffHash ?? ""),
    JSON.stringify(legacyWritten.last));
  await tmuxOut("kill-session", "-t", "srv");
  await Bun.sleep(500);
  const legacyState = (await Bun.file(`${ROOT}/fleet.json`).json()) as
    { merges?: Record<string, Record<string, unknown>> };
  const legacyRow = legacyState.merges?.[String(lnLegacy.slot)];
  check("ACP-03 Q4 setup: persisted MergeLast fixture exists before removing only its identity fields",
    legacyRow !== undefined, JSON.stringify(legacyState.merges ?? null));
  if (legacyRow) {
    delete legacyRow.mainSha;
    delete legacyRow.candidateSha;
    delete legacyRow.diffHash;
  }
  await Bun.write(`${ROOT}/fleet.json`, JSON.stringify(legacyState, null, 2));
  await restartSrv();
  const legacyRendered = await waitMerge(lnLegacy.slot);
  const legacyFacts = projectPromotionPolicyFacts(legacyRendered.last ?? {});
  check("ACP-03 Q4: legacy persisted row without identity deserializes and renders after restart",
    legacyRow !== undefined && legacyRendered.last?.status === "resolved"
      && legacyRendered.last.mainSha === undefined && legacyRendered.last.candidateSha === undefined
      && legacyRendered.last.diffHash === undefined,
    JSON.stringify({ fixture: legacyRow, rendered: legacyRendered.last }));
  check("ACP-03 Q4: the policy projection never calls an identity-less legacy row fresh",
    legacyFacts.candidate === null && legacyFacts.candidateFreshness === "unknown"
      && legacyFacts.verifyFreshness === "unknown",
    JSON.stringify(legacyFacts));
  const legacyConfirmR = await post(`/api/slots/${lnLegacy.slot}/merge`, { confirm: true });
  const legacyConfirm = (await legacyConfirmR.json()) as { status?: string; landed?: boolean };
  check("ACP-03 Q4: identity-UNKNOWN legacy row retains the git-gated owner confirm escape hatch",
    legacyConfirmR.ok && legacyConfirm.status === "merged" && legacyConfirm.landed === true,
    `${legacyConfirmR.status} ${JSON.stringify(legacyConfirm)}`);
  const legacyNoteRaw = spawnSync("git", ["-C", REPO, "notes", "--ref=fleet/land", "show", "main"]);
  let legacyNote: { resolverDetail?: string } | null = null;
  try { legacyNote = JSON.parse(legacyNoteRaw.stdout.toString()) as { resolverDetail?: string }; } catch { /* asserted below */ }
  check("ACP-03 Q4: legacy confirm provenance records identity freshness as UNKNOWN",
    legacyNoteRaw.status === 0 && (legacyNote?.resolverDetail ?? "").includes("freshness was UNKNOWN"),
    legacyNoteRaw.stdout.toString().trim());
  spawnSync("git", ["-C", REPO, "rm", "-q", "legacy-verify.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "cleanup: drop legacy VERIFYBAD marker from main"]);

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

  // (C2) clean rebase whose verify command WORKS and never answers — the server kills it at
  // FLEET_VERIFY_TIMEOUT_MS, the WORK budget. A timeout is a NON-answer, so it lands in ok:null
  // WITH `timedOut` — same never-land group as SKIPPED, different words. (The land that was
  // actually stopped on 2026-08-06 was killed while QUEUED, not while working; that shape is C3
  // below, and telling the two apart is the whole point of having two budgets.)
  // The four things asserted here are the four that could regress independently: the STATE
  // (ok:null + timedOut, and explicitly NOT false), the SAFETY (no auto-land, commit not on main),
  // the ACCOUNTING (`ms` present, `waitMs` summed from the acquire lines), and the RE-ARM — that
  // the 4s this run spent queueing was credited back to the work budget instead of eaten out of
  // it, which is the difference between a gate that gets its full budget and one that gets
  // whatever the machine leaves over.
  {
    const budget = Number(process.env.FLEET_VERIFY_TIMEOUT_MS ?? 0) || 0;
    const waitBudget = Number(process.env.FLEET_VERIFY_WAIT_MS ?? 0) || 0;
    check("V1 setup: the suite runs with a verify timeout small enough to be reachable (e2e-isolated.sh)",
      budget > 0 && budget <= 30_000, `FLEET_VERIFY_TIMEOUT_MS=${process.env.FLEET_VERIFY_TIMEOUT_MS ?? "(unset)"}`);
    // the two budgets must be DIFFERENT and the wait one smaller, or neither of the two blocks
    // below can tell which clock fired and both would pass on a server that only has one
    check("V1 setup: the wait budget is separately configured and below the work budget",
      waitBudget > 0 && waitBudget < budget,
      `FLEET_VERIFY_WAIT_MS=${process.env.FLEET_VERIFY_WAIT_MS ?? "(unset)"} vs FLEET_VERIFY_TIMEOUT_MS=${budget}`);
    const lnVt = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${lnVt.cwd}/verify-hang.txt`, "lane work carrying a VERIFYHANG marker\n");
    spawnSync("git", ["-C", lnVt.cwd, "add", "verify-hang.txt"]);
    // same retry as the skip cases: a server git poll holding index.lock makes a one-shot commit
    // fail, and a lane with no marker committed would verify GREEN and land — reporting this
    // check's own failure for the wrong reason
    let vtCommitted = false;
    for (let i = 0; i < 20 && !vtCommitted; i++) {
      vtCommitted = spawnSync("git", ["-C", lnVt.cwd, "commit", "-qm", "verify-hang lane work"]).status === 0;
      if (!vtCommitted) await Bun.sleep(150);
    }
    check("V1 setup: the hanging-verify lane committed its marker (precondition for the timeout below)",
      vtCommitted, spawnSync("git", ["-C", lnVt.cwd, "status", "--porcelain"]).stdout.toString().trim());
    await Bun.write(`${REPO}/vt-main.txt`, "main side\n"); // different file → clean rebase, no agent
    spawnSync("git", ["-C", REPO, "add", "vt-main.txt"]);
    spawnSync("git", ["-C", REPO, "commit", "-qm", "vt main work"]);
    await settleForMerge(lnVt.slot);
    await post(`/api/slots/${lnVt.slot}/merge`, {});
    // waitMerge's 60s ceiling comfortably covers this job: it blocks for the whole budget (8s)
    // before the server can even record a verdict
    const vVt = await waitMerge(lnVt.slot);
    const vt = vVt.last?.verify;
    check("V1: a verify KILLED by the timeout records ok:null + timedOut — a non-answer, not a failure",
      vt?.ok === null && vt?.timedOut === true, JSON.stringify(vt));
    check("V1: the timeout is NOT ok:false — it must never read as a reasoned no about the tree",
      vt?.ok !== false, JSON.stringify(vt?.ok));
    check("V1: the timed-out verdict says TIMED OUT in words, and does not blame the tree",
      (vVt.last?.detail ?? "").includes("TIMED OUT") && !(vVt.last?.detail ?? "").includes("verify failed"),
      JSON.stringify(vVt.last?.detail));
    check("V1: the retained output keeps what the gate managed to print AND names the timeout",
      (vt?.out ?? "").includes("ALL PASS") && /\[verify TIMED OUT after \d+ms/.test(vt?.out ?? ""),
      JSON.stringify((vt?.out ?? "").slice(-260)));
    // THE RE-ARM, and the reason this check is worth more than the state checks above it. The
    // stand-in reports 4s of queueing (3s + 0s + 1s) and then works until it is killed. Under one
    // wall-clock budget the kill lands at `budget`; with the wait charged to its own budget it
    // lands at `budget + 4s`, because the gate is owed its full work budget regardless of who else
    // was on the machine. A land that spent 255s of a 300s budget queueing — the 2026-08-06 shape
    // — got 45s of gate under the old arithmetic and calls that a verdict.
    // the 500ms of slack is timer granularity, not room for doubt: the two answers this separates
    // are `budget` and `budget + 4000`, and nothing lands in between
    check("V1: the work budget is RE-ARMED past the reported queueing (killed at budget + 4s, not at budget)",
      typeof vt?.ms === "number" && vt.ms >= budget + 3_500,
      JSON.stringify({ ms: vt?.ms, startedAt: vt?.startedAt, budget, expected: budget + 4_000 }));
    // THE SPLIT: the stand-in prints the same `[suite-lock] … acquired after Ns` lines e2e-stage.sh
    // prints in a real chain — three staged steps, 3s + 0s + 1s. A total duration alone would have
    // said nothing about the 2026-08-06 land; the point of the field is that the queueing is
    // separable from the work, and only summing the reports the waiter itself wrote can do that.
    // Every step here got in, so the total is EXACT and carries no `waitPartial` — the lower-bound
    // case (a step still queued when the run ended) is now a kill of its own and lives in C3.
    check("V1: waitMs sums the reported waits of the steps that got in (3+0+1), exactly, no lower bound",
      vt?.waitMs === 4_000 && vt?.waitPartial === undefined, JSON.stringify({ waitMs: vt?.waitMs, partial: vt?.waitPartial, ms: vt?.ms }));
    check("V1: the reserved note counts only the steps that blocked",
      /\[suite mutex: 4s of this \d+s run was spent waiting for [^\n]*, not verifying \(2 of 3 staged steps blocked\)\]/.test(vt?.out ?? ""),
      JSON.stringify((vt?.out ?? "").slice(-360)));
    check("V1: the verdict's own sentence carries the split, so the owner reads it without opening the output",
      /queued behind the suite mutex rather than verifying/.test(vVt.last?.detail ?? ""), JSON.stringify(vVt.last?.detail));
    check("V1: a signal-killed run records exitCode:null rather than inventing an exit status",
      vt?.exitCode === null, JSON.stringify(vt?.exitCode));
    // THE SAFETY INVARIANT: `verify` absent (unconfigured) is the only state that auto-lands.
    // A form change at the gate that quietly moved the timeout out of the never-land group would
    // open an unattended land behind a gate that measured nothing, and this is what catches it.
    check("V1: a timed-out verify does NOT auto-land (downgraded to resolved, lane kept)",
      !vVt.gone && vVt.last?.status === "resolved" && vVt.last?.landed === false && exists(lnVt.cwd),
      JSON.stringify(vVt.last));
    const vtLog = spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString();
    check("V1: the timed-out lane's commit has NOT reached main",
      !vtLog.includes("verify-hang lane work"), vtLog.trim());
    // discarded, not landed: the marker would make every later clean lane in this suite hang too
    await post(`/api/slots/${lnVt.slot}/kill`, {});
    await post("/api/worktrees/discard", { repo: REPO, path: lnVt.cwd, branch: lnVt.branch });
  }

  // (C3) clean rebase whose verify command NEVER GETS TO START — it is still queued behind the
  // suite mutex when FLEET_VERIFY_WAIT_MS runs out. THIS is the 2026-08-06 verdict in its real
  // shape: a land stopped with `verify.ok:false` and "clean rebase, but verify failed" over an
  // output holding zero FAIL lines and one suite's ALL PASS, because ~255s of its 300s budget had
  // gone to queueing behind somebody else's ~8-minute run. As `ok:false` that reads as a reasoned
  // no about the tree, and the affected lane spent an afternoon looking for a defect of its own.
  // The distinction C2 cannot make and this block exists for: a timeout at least LOOKED at the
  // tree, a wait-out never did. They are separate flags, never both set, and neither is `false`.
  {
    const budget = Number(process.env.FLEET_VERIFY_TIMEOUT_MS ?? 0) || 0;
    const waitBudget = Number(process.env.FLEET_VERIFY_WAIT_MS ?? 0) || 0;
    const lnVw = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${lnVw.cwd}/verify-wait.txt`, "lane work carrying a VERIFYWAIT marker\n");
    spawnSync("git", ["-C", lnVw.cwd, "add", "verify-wait.txt"]);
    let vwCommitted = false;
    for (let i = 0; i < 20 && !vwCommitted; i++) {
      vwCommitted = spawnSync("git", ["-C", lnVw.cwd, "commit", "-qm", "verify-wait lane work"]).status === 0;
      if (!vwCommitted) await Bun.sleep(150);
    }
    check("V1 setup: the queued-verify lane committed its marker (precondition for the wait-out below)",
      vwCommitted, spawnSync("git", ["-C", lnVw.cwd, "status", "--porcelain"]).stdout.toString().trim());
    await Bun.write(`${REPO}/vw-main.txt`, "main side\n"); // different file → clean rebase, no agent
    spawnSync("git", ["-C", REPO, "add", "vw-main.txt"]);
    spawnSync("git", ["-C", REPO, "commit", "-qm", "vw main work"]);
    await settleForMerge(lnVw.slot);
    await post(`/api/slots/${lnVw.slot}/merge`, {});
    const vVw = await waitMerge(lnVw.slot);
    const vw = vVw.last?.verify;
    check("V1: a verify killed while QUEUED records ok:null + waitedOut — it never looked at the tree",
      vw?.ok === null && vw?.waitedOut === true, JSON.stringify(vw));
    check("V1: the two kills are never both set — a wait-out is not also a timeout",
      vw?.waitedOut === true && vw?.timedOut === undefined, JSON.stringify({ waitedOut: vw?.waitedOut, timedOut: vw?.timedOut }));
    check("V1: a wait-out is NOT ok:false — the exact misreading that cost a lane an afternoon",
      vw?.ok !== false, JSON.stringify(vw?.ok));
    // WHICH CLOCK FIRED, in wall-clock terms. The stand-in credits 1s of reported wait and then
    // queues forever, so the wait budget expires ~4s in — well before the 8s work budget could
    // have. Under a single budget this run would have died at 8s wearing the timeout's words.
    check("V1: it was the WAIT budget that ended the run, not the work budget",
      typeof vw?.ms === "number" && vw.ms >= waitBudget - 1_000 && vw.ms < budget,
      JSON.stringify({ ms: vw?.ms, waitBudget, workBudget: budget }));
    check("V1: the verdict says NEVER STARTED in words — not failed, not timed out, not about the tree",
      (vVw.last?.detail ?? "").includes("NEVER STARTED")
        && !(vVw.last?.detail ?? "").includes("verify failed")
        && !(vVw.last?.detail ?? "").includes("TIMED OUT"), JSON.stringify(vVw.last?.detail));
    check("V1: the retained output keeps what the chain managed to print AND names the wait-out",
      (vw?.out ?? "").includes("ALL PASS") && /\[verify NEVER STARTED — killed after \d+ms still queued/.test(vw?.out ?? ""),
      JSON.stringify((vw?.out ?? "").slice(-300)));
    // the LOWER-BOUND half of the wait accounting, which lives here now: the step that was still
    // queued at the kill never got to write its own acquire line, so its wait is known only to its
    // last heartbeat (1s reported + 4s heartbeat). Reporting 0s for it would be this whole change
    // telling the original lie again — `waitPartial`, and "at least" in the words.
    check("V1: waitMs counts the step still queued at the kill and marks the total a lower bound (1 +2)",
      vw?.waitMs === 3_000 && vw?.waitPartial === true, JSON.stringify({ waitMs: vw?.waitMs, partial: vw?.waitPartial, ms: vw?.ms }));
    check("V1: the reserved note marks the total a lower bound and names the still-queued step",
      /\[suite mutex: at least 3s of this \d+s run was spent waiting for [^\n]*, not verifying \(1 of 1 staged step blocked, and one more was still queued after 2s when the run ended\)\]/.test(vw?.out ?? ""),
      JSON.stringify((vw?.out ?? "").slice(-360)));
    check("V1: a signal-killed run records exitCode:null rather than inventing an exit status",
      vw?.exitCode === null, JSON.stringify(vw?.exitCode));
    // THE SAFETY INVARIANT, again on the new flag: `verify` absent (unconfigured) is the only state
    // that auto-lands. A wait-out that fell outside the never-land group would open an unattended
    // land behind a gate that had not merely failed to finish — it had never begun.
    check("V1: a wait-out does NOT auto-land (downgraded to resolved, lane kept)",
      !vVw.gone && vVw.last?.status === "resolved" && vVw.last?.landed === false && exists(lnVw.cwd),
      JSON.stringify(vVw.last));
    const vwLog = spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString();
    check("V1: the wait-out lane's commit has NOT reached main",
      !vwLog.includes("verify-wait lane work"), vwLog.trim());
    // …and it must stay RE-RUNNABLE. This is the OTHER half of the ⏸ pair (the refusal half is the
    // fall-through block above, "a re-run is refused while the resolution is still rebased onto
    // main"): "resolved" is one word for four sachlagen, and this one holds NO agent resolution —
    // nothing was resolved here, nothing was even measured. The guard used to key on the word
    // alone, so a second ⏫ answered "conflict resolution awaits your review": a false statement
    // about this tree, and a refusal of the exact remedy this verdict's own text prescribes
    // ("Re-run the gate once the machine is free"). Measured live on 2026-08-17 and twice more on
    // 2026-08-19 — including on a RED gate, where it made the mandated flake proof (run the same
    // tree again) undrivable through the gate and left `{confirm:true}`, the path that skips the
    // measurement, as the only exit. Neither half of this pair proves anything alone: the refusal
    // half without this one is satisfied by the old word-keyed guard, and this half without the
    // refusal half is satisfied by deleting the guard.
    const vwMain = spawnSync("git", ["-C", REPO, "rev-parse", "--abbrev-ref", "HEAD"]).stdout.toString().trim();
    const vwAnc = spawnSync("git", ["-C", REPO, "merge-base", "--is-ancestor", vwMain, lnVw.branch]);
    // the guard's own precondition, failing as ITSELF: once main is no longer an ancestor the guard
    // lapses for every verdict shape, and a re-run below would start for a reason that is not this
    // change. Then the check would read "re-runnable" while having measured nothing of the kind.
    check("V1 setup: main is still an ancestor of the waited-out lane — the ⏸ guard's own precondition",
      vwAnc.status === 0, `merge-base --is-ancestor ${vwMain} ${lnVw.branch} → exit ${vwAnc.status}`);
    check("V1 setup: the wait-out verdict holds NO agent resolution — no conflicted, no resolvedBy",
      (vVw.last?.conflicted ?? []).length === 0
        && (vVw.last as { resolvedBy?: string } | null)?.resolvedBy === undefined,
      JSON.stringify({ conflicted: vVw.last?.conflicted,
        resolvedBy: (vVw.last as { resolvedBy?: string } | null)?.resolvedBy }));
    await settleForMerge(lnVw.slot);
    const vwRerun = (await (await post(`/api/slots/${lnVw.slot}/merge`, {})).json()) as
      { running?: boolean; status?: string; detail?: string };
    check("⏸ a 'resolved' that holds NO resolution is RE-RUNNABLE — the gate starts instead of refusing",
      vwRerun.running === true && vwRerun.status === undefined
        && !(vwRerun.detail ?? "").includes("conflict resolution awaits"), JSON.stringify(vwRerun));
    const vVw2 = await waitMerge(lnVw.slot);
    // and it really MEASURED again rather than replaying the parked verdict: a fresh verify record
    // (the stand-in queues forever, so the second run waits out exactly as the first did)
    check("⏸ the re-run produced a NEW verify record, not a replay of the old verdict",
      vVw2.last?.verify?.waitedOut === true && typeof vVw2.last?.verify?.at === "number"
        && typeof vVw.last?.verify?.at === "number" && vVw2.last.verify.at > vVw.last.verify.at,
      JSON.stringify({ at1: vVw.last?.verify?.at, at2: vVw2.last?.verify?.at, ok: vVw2.last?.verify?.ok }));
    check("⏸ the re-run still did NOT auto-land — re-runnable is not a licence to land unmeasured",
      !vVw2.gone && vVw2.last?.status === "resolved" && vVw2.last?.landed === false
        && !spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString().includes("verify-wait lane work"),
      JSON.stringify(vVw2.last));
    // discarded, not landed: the marker would make every later clean lane in this suite queue too
    await post(`/api/slots/${lnVw.slot}/kill`, {});
    await post("/api/worktrees/discard", { repo: REPO, path: lnVw.cwd, branch: lnVw.branch });
  }

  // (C3b) THE MACHINE IS TAKEN BEFORE THE REBASE, so two lands of ONE server can never both be
  // rebased onto the same main. Until 2026-09-12 the hold began at the first GATE, ~200 lines and
  // an unbounded number of seconds after the pre-pass rebase, and a second land of the same server
  // was refused the lock INSTANTLY (`suiteLockHeld`, one hold per process) and then ran that whole
  // span beside the first. Both then rebased onto the same main, both declared a land, one won the
  // fast-forward and the other was refused it — `ff-lost` → re-rebase → RE-RUN THE WHOLE GATE.
  // That is ~107 s of work on the single suite this box has, plus its queue, bought twice for one
  // land, and it is measured rather than imagined: of the 546 land notes in this repo five carry
  // `ffRounds`, and THREE of those five had main moved under them by a land of this same server
  // (the 2026-09-12 pair c42c5a65 → af494028 among them).
  //
  // The assertion is deliberately NOT "the lock was taken" — that is a fact about a mkdir, and a
  // fixture can be satisfied by a hold that serializes nothing. It is the OUTCOME that only
  // serialization can produce: NEITHER land carries `ffRounds`, and the second one's note names
  // the first one's tip as its own base. Two lands that overlap cannot both get that, whichever of
  // them wins — the loser is refused the fast-forward BY DEFINITION (its base is no longer main)
  // and its note says so. So this is one check that fails from either side of the race.
  //
  // Read off the LAND NOTES and not off the merge row: a successful land tears its lane down, so
  // `/api/slots/:id/merge` is 400 by the time either verdict could be asked for — the note is the
  // durable artifact, and it is also the one the owner brief names.
  //
  // Three pieces of fixture do the work. A PRIVATE suite lock, because this suite's own server is
  // started inside e2e-stage.sh's hold (`FLEET_SUITE_LOCK_HELD_BY`) and a server that knows it is
  // inside somebody's hold takes nothing — against a lock dir of our own `inheritedSuiteHolder()`
  // is null and the take is real. The product's own TEST-ONLY ff latch, which parks a land one
  // step before its fast-forward, i.e. INSIDE the hold, for as long as this fixture wants. And a
  // 60 s wait budget, because the suite's own 5 s would expire while the second land queues and
  // turn this into a `waitedOut` measurement of something else.
  {
    const phLock = `${ROOT}/prehold-suite.lock`;
    const phLatch = `${ROOT}/prehold-ff.latch`;
    const phArm = (): void => {
      for (const f of [`${phLatch}.reached`, `${phLatch}.release`]) rmSync(f, { force: true });
      writeFileSync(phLatch, "armed\n", { mode: 0o600 });
    };
    const phParked = async (): Promise<boolean> => {
      for (let i = 0; i < 600; i++) {
        if (existsSync(`${phLatch}.reached`)) return true;
        await Bun.sleep(100);
      }
      return false;
    };
    const phMain = (): string =>
      spawnSync("git", ["-C", REPO, "rev-parse", "HEAD"]).stdout.toString().trim();
    type PhNote = { branch?: string; mainBefore?: string; mainAfter?: string; ffRounds?: number;
      waitRounds?: number; verify?: { ok?: boolean | null; mainSha?: string } };
    const phNote = (sha: string): PhNote | null => {
      const r = spawnSync("git", ["-C", REPO, "notes", "--ref=fleet/land", "show", sha]);
      if (r.status !== 0) return null;
      try { return JSON.parse(r.stdout.toString()) as PhNote; } catch { return null; }
    };
    // a clean lane with NO sabotage marker in it — fakeverify is green on such a tree, so both
    // lands take the clean auto-land path, which is the only one that reaches a fast-forward
    const phLane = async (name: string): Promise<{ slot: number; cwd: string; branch: string }> => {
      const ln = (await (await post("/api/lanes", { repo: REPO })).json()) as
        { slot: number; cwd: string; branch: string };
      await Bun.write(`${ln.cwd}/${name}.txt`, `clean lane work, no sabotage marker — ${name}\n`);
      spawnSync("git", ["-C", ln.cwd, "add", `${name}.txt`]);
      spawnSync("git", ["-C", ln.cwd, "commit", "-qm", `prehold ${name} lane work`]);
      return ln;
    };
    rmSync(phLock, { recursive: true, force: true });
    for (const f of [phLatch, `${phLatch}.reached`, `${phLatch}.release`]) rmSync(f, { force: true });
    await restartSrv({
      FLEET_SUITE_LOCK: phLock,
      FLEET_TEST_LAND_FF_LATCH: phLatch,
      FLEET_VERIFY_WAIT_MS: "60000",
      FLEET_VERIFY_TIMEOUT_MS: "60000",
    });
    const lnP1 = await phLane("preholdfirst");
    const lnP2 = await phLane("preholdsecond");
    const p1Base = spawnSync("git", ["-C", lnP1.cwd, "rev-parse", "HEAD~1"]).stdout.toString().trim();
    const p2Base = spawnSync("git", ["-C", lnP2.cwd, "rev-parse", "HEAD~1"]).stdout.toString().trim();
    const mainAtStart = phMain();
    // the premise of the whole race, failing as ITSELF: both lanes must fork from the SAME main.
    // If they did not, the second land would have nothing to be overtaken by and the check below
    // would read "serialized" having measured two independent lands.
    check("(C3b) setup: two clean lanes, both forked from the same main, both committed",
      p1Base === mainAtStart && p2Base === mainAtStart && p1Base !== "",
      JSON.stringify({ mainAtStart, p1Base, p2Base }));
    await settleForMerge(lnP1.slot);
    await settleForMerge(lnP2.slot);
    phArm();
    await post(`/api/slots/${lnP1.slot}/merge`, {});
    const p1Parked = await phParked();
    check("(C3b) setup: the first land is parked one step before its fast-forward, holding the machine",
      p1Parked, p1Parked ? "latch reached" : "the first land never reached the ff latch");
    // FIRED WHILE THE FIRST LAND STILL HOLDS THE MACHINE. Under the cut this must block before its
    // pre-pass rebase; without it, it rebases onto `mainAtStart` right here and the sleep below is
    // what gives it time to do so — so a hold that slid back behind the rebase fails this arm
    // rather than passing it by being fast.
    const p2Fired = await post(`/api/slots/${lnP2.slot}/merge`, {});
    await Bun.sleep(3_000);
    // …and only NOW may the first land move main
    writeFileSync(`${phLatch}.release`, "go\n", { mode: 0o600 });
    const vP1 = await waitMerge(lnP1.slot);
    const vP2 = await waitMerge(lnP2.slot);
    // READ BACKWARDS FROM THE FINAL TIP, and not by sampling main between the two lands: the second
    // land is released by the first one's own `finally`, so any `git rev-parse` in that window is a
    // race with it — and a fixture that reads the first tip a moment too late would find the
    // SECOND note under it and fail as a regression. Walking `mainBefore` back from the tip is the
    // same fact without the clock: main went mainAtStart → first → second, each in ONE round.
    const p2Tip = phMain();
    const nP2 = phNote(p2Tip);
    const p1Tip = nP2?.mainBefore ?? "";
    const nP1 = p1Tip === "" ? null : phNote(p1Tip);
    check("(C3b) two lands of ONE server are serialized across the whole rebase→gate→fast-forward span: both land, NEITHER carries ffRounds, and the second one's base IS the first one's tip",
      p2Fired.ok && vP1.gone && vP2.gone
        && nP1?.branch === lnP1.branch && nP1.ffRounds === undefined
        && nP1.mainBefore === mainAtStart && nP1.mainAfter === p1Tip
        && nP2?.branch === lnP2.branch && nP2.ffRounds === undefined && nP2.mainAfter === p2Tip
        && p1Tip !== mainAtStart && p2Tip !== p1Tip,
      JSON.stringify({ mainAtStart, p1Tip, p2Tip, first: nP1, second: nP2,
        fired: p2Fired.ok, goneFirst: vP1.gone, goneSecond: vP2.gone }));
    // …and the second land's GATE ran against the main it actually landed on, in its first and only
    // round. This is the half the ff retry chain would repair after the fact: a retried land also
    // ends with `verify.mainSha === <the new main>`, which is exactly why the round count above is
    // the discriminator and this line is the corroboration rather than the proof.
    check("(C3b) the second land verified the tree it landed — one gate run, against the post-first-land main",
      nP2?.verify?.ok === true && nP2.verify?.mainSha === p1Tip && nP2.waitRounds === undefined,
      JSON.stringify({ verify: nP2?.verify, waitRounds: nP2?.waitRounds, p1Tip }));

    // (C3b-ii) THE GEGENPROBE, and it is what keeps the arm above from being a claim about a hold
    // that simply stops the world: this machine's suite mutex binds SUITES, never the owner's own
    // hands. A commit made in the main checkout while a land sits inside its hold still takes the
    // fast-forward away from it — the ff retry chain then re-rebases, RE-RUNS the gate against the
    // new main and lands, and `ffRounds: 1` says so on the note. If this arm ever went green with
    // no round recorded, the ledger the whole class is counted from would be silently lying.
    const lnP3 = await phLane("preholdintruder");
    await settleForMerge(lnP3.slot);
    const p3Start = phMain();
    phArm();
    await post(`/api/slots/${lnP3.slot}/merge`, {});
    const p3Parked = await phParked();
    check("(C3b) setup: the intruder arm's land is parked one step before its fast-forward",
      p3Parked, p3Parked ? "latch reached" : "the intruder arm's land never reached the ff latch");
    await Bun.write(`${REPO}/prehold-intruder-main.txt`, "a commit of the main checkout itself\n");
    spawnSync("git", ["-C", REPO, "add", "prehold-intruder-main.txt"]);
    spawnSync("git", ["-C", REPO, "commit", "-qm", "prehold intruder commit on main"]);
    const intruder = phMain();
    writeFileSync(`${phLatch}.release`, "go\n", { mode: 0o600 });
    const vP3 = await waitMerge(lnP3.slot);
    const p3Tip = phMain();
    const nP3 = phNote(p3Tip);
    check("(C3b) a commit of the main checkout DURING the hold still steals the fast-forward — the land re-rebases, re-verifies against the new main and records ffRounds: 1",
      vP3.gone && intruder !== p3Start && nP3?.branch === lnP3.branch && nP3.ffRounds === 1
        && nP3.mainBefore === intruder && nP3.verify?.mainSha === intruder && nP3.verify?.ok === true,
      JSON.stringify({ p3Start, intruder, p3Tip, note: nP3, gone: vP3.gone }));
    rmSync(phLock, { recursive: true, force: true });
    for (const f of [phLatch, `${phLatch}.reached`, `${phLatch}.release`]) rmSync(f, { force: true });
    await restartSrv(); // back to the suite's own lock, budgets and latch-less server
  }

  // (C4) a verify command that IGNORES the term it is sent — the case a timeout alone cannot end.
  // The clock fires, `timedOut` is set, SIGTERM goes out... and the server then awaits a process
  // that has decided not to leave. The verdict is already `null` at that point, so every second
  // after it is the server blocked on an answer it has promised never to use — and on the live
  // fleet the budget is 300s, so "the gate is over" and "the merge job is over" could be five
  // minutes apart with nothing saying so. The staffel (SIGTERM → VERIFY_KILL_GRACE_MS → SIGKILL,
  // server.ts fire()) is what closes that, and it is the same one the post-land audit path has
  // run since it was written.
  // The two outcomes are far apart on the clock and that separation IS the measurement: killed at
  // budget + grace (8s + 5s), or the stand-in's own exit at 30s. A check that only asserted the
  // state would have passed against the un-escalated server too — it reached ok:null either way,
  // just 17 seconds later.
  {
    const budget = Number(process.env.FLEET_VERIFY_TIMEOUT_MS ?? 0) || 0;
    // this block's own precondition, failing as ITSELF rather than as the thing it measures: with
    // no reachable work budget the kill never fires at all and every assertion below would read as
    // "the escalation is broken" when nothing was ever measured
    check("V1 setup: a work budget small enough for the kill staffel to be reachable inside the suite",
      budget > 0 && budget <= 30_000, `FLEET_VERIFY_TIMEOUT_MS=${process.env.FLEET_VERIFY_TIMEOUT_MS ?? "(unset)"}`);
    const lnVk = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${lnVk.cwd}/verify-nokill.txt`, "lane work carrying a VERIFYNOKILL marker\n");
    spawnSync("git", ["-C", lnVk.cwd, "add", "verify-nokill.txt"]);
    // same index.lock retry as the other verify fixtures: an uncommitted marker would make this
    // lane verify GREEN and land, and the failure would name the wrong thing
    let vkCommitted = false;
    for (let i = 0; i < 20 && !vkCommitted; i++) {
      vkCommitted = spawnSync("git", ["-C", lnVk.cwd, "commit", "-qm", "verify-nokill lane work"]).status === 0;
      if (!vkCommitted) await Bun.sleep(150);
    }
    check("V1 setup: the term-ignoring lane committed its marker (precondition for the staffel below)",
      vkCommitted, spawnSync("git", ["-C", lnVk.cwd, "status", "--porcelain"]).stdout.toString().trim());
    await Bun.write(`${REPO}/vk-main.txt`, "main side\n"); // different file → clean rebase, no agent
    spawnSync("git", ["-C", REPO, "add", "vk-main.txt"]);
    spawnSync("git", ["-C", REPO, "commit", "-qm", "vk main work"]);
    await settleForMerge(lnVk.slot);
    await post(`/api/slots/${lnVk.slot}/merge`, {});
    const vVk = await waitMerge(lnVk.slot);
    const vk = vVk.last?.verify;
    check("V1: a verify that ignores the term is still ended — ok:null + timedOut, same verdict as any timeout",
      vk?.ok === null && vk?.timedOut === true, JSON.stringify(vk));
    // THE MEASUREMENT. 30_000 is the stand-in's own sleep: a run that got there was never killed,
    // it simply finished. The window is wide on purpose — the answer being separated is 13s vs
    // 30s, and pinning the grace exactly would make this fail on a machine under load rather than
    // on a regression.
    check("V1: the SIGKILL escalation ends the run near budget+grace, far short of the stand-in's own 30s exit",
      typeof vk?.ms === "number" && vk.ms >= budget && vk.ms < 25_000,
      JSON.stringify({ ms: vk?.ms, budget, standInExitsAt: 30_000 }));
    check("V1: a signal-killed run records exitCode:null rather than inventing an exit status",
      vk?.exitCode === null, JSON.stringify(vk?.exitCode));
    check("V1: what the gate printed before it stopped listening is still retained",
      (vk?.out ?? "").includes("stopped listening") && /\[verify TIMED OUT after \d+ms/.test(vk?.out ?? ""),
      JSON.stringify((vk?.out ?? "").slice(-260)));
    check("V1: an escalated kill does NOT auto-land (downgraded to resolved, lane kept)",
      !vVk.gone && vVk.last?.status === "resolved" && vVk.last?.landed === false && exists(lnVk.cwd),
      JSON.stringify(vVk.last));
    // discarded, not landed: the marker would make every later clean lane in this suite hang too
    await post(`/api/slots/${lnVk.slot}/kill`, {});
    await post("/api/worktrees/discard", { repo: REPO, path: lnVk.cwd, branch: lnVk.branch });
  }

  // (E) PER-REPO verify commands (P-7c). One FLEET_VERIFY_CMD had to serve every repo a lane could
  // live in, so being right in more than one meant guarding on the tree and DECLINING elsewhere —
  // and a decline costs that lane its auto-land (the SKIP contract, server.ts). The map gives a
  // repo its own command instead, and the compatibility half is that a repo NOT in it keeps the
  // global exactly as before.
  //
  // WHAT MAKES THIS MEASURABLE rather than merely green: the two commands know DIFFERENT sabotage
  // markers, and each lane carries the one the other command ignores. testrepo2's lane trips
  // fakeverify2 and would sail past fakeverify; testrepo3's lane trips fakeverify and would sail
  // past fakeverify2. So the wrong resolution does not produce a differently-worded pass — it
  // produces a GREEN verify and an auto-land, which the assertions below cannot mistake for the
  // right answer. (The third state, a repo in NEITHER the map nor the global, cannot be reached on
  // this server: the global is configured for the whole suite. It is asserted in e2e/restart.ts,
  // against the server that boots without FLEET_VERIFY_CMD.)
  {
    // the block's own precondition. Empty/missing fixture repos mean nothing below was measured,
    // and that must fail as ITSELF rather than as "per-repo resolution is broken".
    const haveRepos = !!REPO2 && !!REPO3 && exists(REPO2) && exists(REPO3);
    check("V1 setup: the two per-repo fixture repos exist (precondition — these checks are about WHICH of two commands ran)",
      haveRepos, JSON.stringify({ REPO2, REPO3 }));
    if (haveRepos) {
      // repo, marker file, marker text, the command that MUST have run, and the words that command
      // prints. Driven as a table so neither half can quietly stop being asserted.
      const cases = [
        { repo: REPO2, name: "r2", marker: "VERIFY2BAD", cmdEnds: "fakeverify2", says: "verify2 FAIL", why: "its own entry in FLEET_VERIFY_CMD_REPOS" },
        { repo: REPO3, name: "r3", marker: "VERIFYBAD", cmdEnds: "fakeverify", says: "verify FAIL", why: "no entry — the global FLEET_VERIFY_CMD default" },
      ] as const;
      for (const c of cases) {
        const ln = (await (await post("/api/lanes", { repo: c.repo })).json()) as { slot: number; cwd: string; branch: string };
        check(`V1 setup: a lane opened in ${c.name} (precondition for the resolution check)`,
          typeof ln.slot === "number" && typeof ln.cwd === "string" && exists(ln.cwd ?? ""), JSON.stringify(ln));
        if (typeof ln.slot !== "number") continue;
        await Bun.write(`${ln.cwd}/${c.name}-lane.txt`, `lane work carrying a ${c.marker} marker\n`);
        spawnSync("git", ["-C", ln.cwd, "add", `${c.name}-lane.txt`]);
        let committed = false;
        for (let i = 0; i < 20 && !committed; i++) {
          committed = spawnSync("git", ["-C", ln.cwd, "commit", "-qm", `${c.name} lane work`]).status === 0;
          if (!committed) await Bun.sleep(150);
        }
        check(`V1 setup: the ${c.name} lane committed its marker (an uncommitted one verifies GREEN and lands)`,
          committed, spawnSync("git", ["-C", ln.cwd, "status", "--porcelain"]).stdout.toString().trim());
        await Bun.write(`${c.repo}/${c.name}-main.txt`, "main side\n"); // different file → clean rebase, no agent
        spawnSync("git", ["-C", c.repo, "add", `${c.name}-main.txt`]);
        spawnSync("git", ["-C", c.repo, "commit", "-qm", `${c.name} main work`]);
        await settleForMerge(ln.slot);
        await post(`/api/slots/${ln.slot}/merge`, {});
        const v = await waitMerge(ln.slot);
        const vr = v.last?.verify;
        check(`P-7c: the land in ${c.name} ran ${c.cmdEnds} — ${c.why}`,
          typeof vr?.cmd === "string" && vr.cmd.endsWith(c.cmdEnds), JSON.stringify(vr?.cmd));
        check(`P-7c: ${c.name}'s gate is the one that SPOKE — its own words in the retained output, not the other command's`,
          (vr?.out ?? "").includes(c.says) && (vr?.out ?? "").includes(c.marker), JSON.stringify((vr?.out ?? "").slice(0, 200)));
        // the counter-probe, and the reason the markers are crossed: the OTHER command does not
        // know this marker, so a mis-resolution reaches ok:true and the lane is gone
        check(`P-7c: ${c.name}'s lane was judged RED and kept — a mis-resolved gate would have passed it and landed it`,
          vr?.ok === false && !v.gone && v.last?.status === "resolved" && v.last?.landed === false,
          JSON.stringify({ ok: vr?.ok, gone: v.gone, status: v.last?.status, landed: v.last?.landed }));
        check(`P-7c: the ${c.name} lane's commit has NOT reached that repo's main`,
          !spawnSync("git", ["-C", c.repo, "log", "--oneline", "-4"]).stdout.toString().includes(`${c.name} lane work`),
          spawnSync("git", ["-C", c.repo, "log", "--oneline", "-4"]).stdout.toString().trim());
        await post(`/api/slots/${ln.slot}/kill`, {});
        await post("/api/worktrees/discard", { repo: c.repo, path: ln.cwd, branch: ln.branch });
      }
    }
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

  // --- ② SERVER-FIRST SYNC: the AUTHOR resolves its own conflict; the worker is the FALLBACK ---
  // Owner decision 2026-08-05, Form 1 (briefs/server-first-sync.md). Every other merge check in
  // this file exercises the fallback — this suite's panes run FLEET_CMD=true, so the server's
  // strict alive probe finds no claude to wake. Here one lane is given a pane that DOES satisfy
  // that probe (fakeClaudeInPane), which is the only difference, and the whole round trip is
  // asserted: hand-off → the author's own resolution → the stop for review → the confirm-land →
  // the attribution surviving all the way onto the outcome row.
  {
    const lnA = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${lnA.cwd}/code.txt`, "root\nauthor-lane\n");
    spawnSync("git", ["-C", lnA.cwd, "commit", "-aqm", "author lane work"]);
    await Bun.write(`${REPO}/code.txt`, "root\nauthor-main\n"); // same line → a real rebase conflict
    spawnSync("git", ["-C", REPO, "commit", "-aqm", "author main work"]);
    // "blocked" throughout: if the throwaway resolver were consulted at any point below, the
    // verdict would be "blocked" and every author assertion here would fail loudly.
    await setMergeMode("blocked");
    const ready = await fakeClaudeInPane(lnA.slot);
    check("② setup: the author lane's pane satisfies the server's STRICT claude-alive probe",
      ready, `slot ${lnA.slot}`);
    await settleForMerge(lnA.slot);
    await post(`/api/slots/${lnA.slot}/merge`, {});
    const vA1 = await waitMerge(lnA.slot);
    check("② a conflict is handed to the lane's OWN session, not to the throwaway resolver",
      !vA1.gone && vA1.last?.status === "awaiting-author", JSON.stringify(vA1.last));
    check("② the hand-off records WHO was asked (resolvedBy:'author') and WHICH files",
      (vA1.last as { resolvedBy?: string } | null)?.resolvedBy === "author"
      && (vA1.last?.conflicted ?? []).includes("code.txt"), JSON.stringify(vA1.last));
    const authorSubR = await selfMergeWatch(receiverBToken, lnA.slot);
    const authorSub = (await authorSubR.json()) as { watch?: MergeWatchRow; error?: string };
    const authorEvent = authorSub.watch ? await waitMergeEvent(authorSub.watch.id) : undefined;
    const authorText = (await plogRead()).find((p) => p.slot === receiverB
      && p.text.includes(`[event ${authorEvent?.id}]`))?.text ?? "";
    check("merge event: awaiting-author is delivered as waiting/unlanded, never as success",
      authorSubR.ok && authorEvent?.payload.status === "awaiting-author"
        && authorEvent.payload.landed === false && authorText.includes("landed=NO")
        && authorText.includes("waiting on the author/review path") && authorText.includes("NOT landed"),
      JSON.stringify({ event: authorEvent, text: authorText }));
    // the fallback did not silently also run: mergemode is "blocked", so ANY consultation of the
    // fake resolver puts its verdict ("blocked") and its answer text ("fake conflict") on the
    // record — neither appears, so the worker never ran.
    check("② the throwaway resolver was never consulted (mergemode 'blocked' would have said so)",
      vA1.last?.status !== "blocked" && !(vA1.last?.detail ?? "").includes("fake conflict"),
      JSON.stringify(vA1.last?.detail));
    // the pre-pass ABORTED, so the promise the brief makes to the author must actually hold
    check("② nothing landed, and the lane is left pristine at its own commits (pre-pass aborted)",
      vA1.last?.landed === false && exists(lnA.cwd)
      && spawnSync("git", ["-C", lnA.cwd, "status", "--porcelain"]).stdout.toString().trim() === "",
      spawnSync("git", ["-C", lnA.cwd, "status", "--porcelain"]).stdout.toString());
    const aPreLand = spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString();
    check("② the unresolved conflict has NOT reached main", !aPreLand.includes("author lane work"), aPreLand.trim());
    // the brief REALLY arrived: the fake claude echoes what is pasted into it, so the pane's own
    // output is the witness — not the server's claim that it sent something.
    check("② the brief was actually delivered into the author's pane",
      (await tmuxOut("capture-pane", "-t", `s${lnA.slot}`, "-p", "-S", "-")).out
        .includes("MERGE CONFLICT IN YOUR OWN LANE"), `slot ${lnA.slot}`);
    // …and it is on the durable prompt journal, like every other server-injected prompt
    check("② the brief is journalled as an injected prompt for this lane (source 'auto')",
      (await plogRead()).some((e) => e.cwd === lnA.cwd && e.source === "auto"
        && e.text.includes("MERGE CONFLICT IN YOUR OWN LANE")), lnA.cwd);
    check("② the hand-off is audited (merge_wake_author names the lane)",
      ((await (await get("/api/audit?limit=100")).json()) as { events: { event?: string; slot?: number }[] })
        .events.some((e) => e.event === "merge_wake_author" && e.slot === lnA.slot), `slot ${lnA.slot}`);

    // THE AUTHOR NOW DOES ITS JOB — the test plays it, exactly as the brief instructs: rebase,
    // resolve, continue, leave the tree clean and committed. (What a real claude would make of the
    // brief is not fakeable here, same limit buildMergePrompt has always had; the mechanism around
    // it is what this covers.)
    const rbA = spawnSync("git", ["-C", lnA.cwd, "rebase", "main"]);
    check("② setup: the author's own rebase hits the conflict the server told it about",
      rbA.status !== 0 && spawnSync("git", ["-C", lnA.cwd, "diff", "--name-only", "--diff-filter=U"])
        .stdout.toString().includes("code.txt"), rbA.stderr.toString().slice(0, 200));
    await Bun.write(`${lnA.cwd}/code.txt`, "root\nauthor-main\nauthor-lane\n"); // both intents kept
    spawnSync("git", ["-C", lnA.cwd, "add", "code.txt"]);
    const contA = spawnSync("git", ["-C", lnA.cwd, "rebase", "--continue"], { env: { ...process.env, GIT_EDITOR: "true" } });
    check("② setup: the author completes the rebase and leaves a clean, committed tree",
      contA.status === 0 && spawnSync("git", ["-C", lnA.cwd, "status", "--porcelain"]).stdout.toString().trim() === "",
      contA.stderr.toString().slice(0, 200));

    // The return trip. THIS is the invariant the whole design turns on: the second ⏫ takes the
    // CLEAN path (the author already rebased), and it must still STOP — because `carried` says
    // semantic choices nobody reviewed are sitting in this lane. An author's unreviewed resolution
    // is exactly as unreviewed as a worker's.
    await settleForMerge(lnA.slot);
    await post(`/api/slots/${lnA.slot}/merge`, {});
    const vA2 = await waitMerge(lnA.slot);
    check("② the re-run STOPS for review instead of auto-landing the author's resolution",
      !vA2.gone && vA2.last?.status === "resolved" && vA2.last?.landed === false && exists(lnA.cwd),
      JSON.stringify(vA2.last));
    check("② the attribution survives the re-run that supersedes the verdict (still 'author')",
      (vA2.last as { resolvedBy?: string } | null)?.resolvedBy === "author"
      && (vA2.last?.conflicted ?? []).includes("code.txt"), JSON.stringify(vA2.last));
    // git verified the author's claim with the SAME check a worker's claim gets — a resolution that
    // left the tree dirty or unrebased would have come back "error", not "resolved"
    check("② the author's resolution was git-verified, and verify ran against the rebased tree",
      vA2.last?.verify?.ok === true && (vA2.last?.verify?.cmd ?? "").endsWith("fakeverify"),
      JSON.stringify(vA2.last?.verify));
    // the negative half of the wait accounting, on the nearest readable verdict with a NORMAL run:
    // this stand-in prints no `[suite-lock]` line, so the field must be ABSENT rather than 0. The
    // two answers are different — "this command does not report its waits" versus "it waited none"
    // — and a 0 here would read as a measurement nobody made. `ms` is present regardless.
    check("② a verify that reports no lock waits carries NO waitMs at all (absent ≠ zero), but still carries ms",
      vA2.last?.verify?.waitMs === undefined && vA2.last?.verify?.waitPartial === undefined
        && typeof vA2.last?.verify?.ms === "number",
      JSON.stringify(vA2.last?.verify));
    const a2Log = spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString();
    check("② the author's resolution has NOT reached main before the owner confirms",
      !a2Log.includes("author lane work"), a2Log.trim());
    // the stop is a pause, never a block — the owner reviews and lands deliberately
    await settleForMerge(lnA.slot);
    const aConf = (await (await post(`/api/slots/${lnA.slot}/merge`, { confirm: true })).json()) as
      { status?: string; landed?: boolean };
    check("② the owner can confirm-land the author's reviewed resolution",
      aConf.status === "merged" && aConf.landed === true, JSON.stringify(aConf));
    check("② after the confirm the author's resolution IS on main, with both intents kept",
      spawnSync("git", ["-C", REPO, "show", "HEAD:code.txt"]).stdout.toString() === "root\nauthor-main\nauthor-lane\n",
      JSON.stringify(spawnSync("git", ["-C", REPO, "show", "HEAD:code.txt"]).stdout.toString()));
    // Auflage 1, end to end: the ledger separates the two resolvers. Without this the fallback
    // could become the normal case and no row would ever say so.
    const aOut = ((await (await get("/api/lane-outcomes?limit=1000")).json()) as
      { outcomes: { branch: string | null; disposition: string; resolvedConflict?: boolean; resolvedBy?: string }[] })
      .outcomes.find((o) => o.branch === lnA.branch);
    check("② the outcome row attributes the land to the AUTHOR (resolvedBy:'author')",
      aOut?.disposition === "landed" && aOut?.resolvedConflict === true && aOut?.resolvedBy === "author",
      JSON.stringify(aOut));
  }

  // --- THE VERDICT GOES BACK TO THE LANE THAT WROTE THE TREE (2026-08-26) ---------------------
  // A merge run that KEEPS the lane used to end on the owner's board and nowhere else: the session
  // that wrote the code sat idle beside a tree it believed it had finished. The terminal of
  // mergeJob now types the verdict into that pane once, through the same sendText/canDeliver pair
  // wakeAuthor and every FleetEvent transport use.
  //
  // FIVE exits are asserted here and they are not variations of one check: three of them are the
  // WORDS a lane acts on (fix-or-prove · rebase · nothing-to-fix), and two are the silences —
  // a land must say nothing at all, and a delivered verdict must never be said twice.
  {
    type VerdictDelivery = { at: number; attempts: number; sent: boolean; kind: string; gate?: string };
    const verdictSends = async (branch: string): Promise<string[]> =>
      (await plogRead()).filter((e) => e.text.includes(`[fleet land verdict — ${branch}]`)).map((e) => e.text);
    const verdictMark = async (slot: number): Promise<VerdictDelivery | null> => {
      const r = await get(`/api/slots/${slot}/merge`);
      if (r.status === 400) return null; // slot torn down — a land, which delivers nothing
      return ((await r.json()) as { last: { verdictDelivery?: VerdictDelivery } | null })
        .last?.verdictDelivery ?? null;
    };
    // Deterministic, never a sleep-then-look: poll the server's own marker until it reaches the
    // state under test. Returns whatever it last saw so a failure prints the real shape.
    const awaitMark = async (slot: number, want: (d: VerdictDelivery) => boolean): Promise<VerdictDelivery | null> => {
      let seen: VerdictDelivery | null = null;
      for (let i = 0; i < 400; i++) {
        seen = await verdictMark(slot);
        if (seen && want(seen)) return seen;
        await Bun.sleep(50);
      }
      return seen;
    };
    // One lane carrying one sabotage marker, plus an unrelated commit on main so the rebase is
    // CLEAN and no agent is consulted. Same commit-retry as every other marker lane in this file:
    // a server git poll holding index.lock makes a one-shot commit fail, and a lane with no marker
    // committed would verify GREEN and land — failing the checks below for the wrong reason.
    const markerLane = async (name: string, body: string): Promise<{ slot: number; cwd: string; branch: string }> => {
      const ln = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
      await Bun.write(`${ln.cwd}/${name}.txt`, body);
      spawnSync("git", ["-C", ln.cwd, "add", `${name}.txt`]);
      let committed = false;
      for (let i = 0; i < 20 && !committed; i++) {
        committed = spawnSync("git", ["-C", ln.cwd, "commit", "-qm", `${name} lane work`]).status === 0;
        if (!committed) await Bun.sleep(150);
      }
      check(`land-verdict setup: the ${name} lane committed its marker (precondition for the verdict below)`,
        committed, spawnSync("git", ["-C", ln.cwd, "status", "--porcelain"]).stdout.toString().trim());
      await Bun.write(`${REPO}/${name}-main.txt`, "main side\n");
      spawnSync("git", ["-C", REPO, "add", `${name}-main.txt`]);
      spawnSync("git", ["-C", REPO, "commit", "-qm", `${name} main work`]);
      return ln;
    };
    const dropLane = async (ln: { slot: number; cwd: string; branch: string }): Promise<void> => {
      await post(`/api/slots/${ln.slot}/kill`, {});
      await post("/api/worktrees/discard", { repo: REPO, path: ln.cwd, branch: ln.branch });
    };

    // (i) VERIFY RED on a kept lane — the exit this whole path exists for.
    const lnR = await markerLane("verdict-red", "lane work with a VERIFYBAD marker\n");
    await settleForMerge(lnR.slot);
    await post(`/api/slots/${lnR.slot}/merge`, {});
    const vR = await waitMerge(lnR.slot);
    check("land verdict setup: the red lane settles as resolved/NOT landed and is KEPT",
      !vR.gone && vR.last?.status === "resolved" && vR.last.landed === false
        && vR.last.verify?.ok === false && exists(lnR.cwd), JSON.stringify(vR.last));
    const markR = await awaitMark(lnR.slot, (d) => d.sent);
    const sendsR = await verdictSends(lnR.branch);
    check("land verdict: a kept verify-RED lane is told, exactly once, on its first attempt",
      markR?.sent === true && markR.kind === "review" && markR.attempts === 1 && sendsR.length === 1,
      JSON.stringify({ mark: markR, sends: sendsR.length }));
    // WHAT it was told. Three independent halves: the verdict, the gate's own last lines, and an
    // instruction that names BOTH exits the rulebook allows on a red check — re-run the same tree
    // to prove non-determinism, or fix it. A message that carried only "fix it" would push every
    // flake into a hunt for a defect that is not there.
    check("land verdict: the red text carries the verdict, the verify tail and the fix-or-prove instruction",
      (sendsR[0] ?? "").includes("landed=NO")
        && (sendsR[0] ?? "").includes("VERIFYBAD marker present in the rebased tree")
        && (sendsR[0] ?? "").includes("run the SAME tree again")
        && (sendsR[0] ?? "").includes("report done again"),
      JSON.stringify((sendsR[0] ?? "").slice(0, 400)));
    // …and it is the SERVER speaking, in the same fixed envelope every other injected prompt
    // carries. A verdict that could read as the owner talking is a different kind of message.
    const plogR = (await plogRead()).filter((e) => e.text.includes(`[fleet land verdict — ${lnR.branch}]`));
    check("land verdict: it is journalled against the lane's own slot as machine-typed text",
      plogR.length === 1 && plogR[0].slot === lnR.slot && plogR[0].source === "auto",
      JSON.stringify(plogR.map((e) => ({ slot: e.slot, source: e.source }))));
    // (ii) …and NEVER twice. The tick that owns the bounded retry (FACT 3 in tickWatches) runs
    // every FLEET_AUTOS_TICK_MS=250ms here, so this window is many ticks — every one of them sees
    // the same terminal state and must stay silent.
    await Bun.sleep(3_000);
    const sendsR2 = await verdictSends(lnR.branch);
    const markR2 = await verdictMark(lnR.slot);
    check("land verdict: a dozen further ticks on the SAME terminal state send nothing more",
      sendsR2.length === 1 && markR2?.attempts === 1 && markR2.sent === true,
      JSON.stringify({ sends: sendsR2.length, mark: markR2 }));
    await dropLane(lnR);

    // (iii) an ERROR verdict — the lane is kept, main did not move, and the only thing that helps
    // is a rebase the lane does itself. Produced by the lying agent, which is this file's
    // deterministic route to `status:"error"` on a kept lane.
    const lnE = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${lnE.cwd}/code.txt`, "root\nverdict-error-lane\n");
    spawnSync("git", ["-C", lnE.cwd, "commit", "-aqm", "verdict-error lane work"]);
    await Bun.write(`${REPO}/code.txt`, "root\nverdict-error-main\n"); // same file+lines → real conflict
    spawnSync("git", ["-C", REPO, "commit", "-aqm", "verdict-error main work"]);
    await setMergeMode("lie");
    await settleForMerge(lnE.slot);
    await post(`/api/slots/${lnE.slot}/merge`, {});
    const vE = await waitMerge(lnE.slot);
    check("land verdict setup: the lying-agent lane settles as error/NOT landed and is KEPT",
      !vE.gone && vE.last?.status === "error" && vE.last.landed === false && exists(lnE.cwd),
      JSON.stringify(vE.last));
    const markE = await awaitMark(lnE.slot, (d) => d.sent);
    const sendsE = await verdictSends(lnE.branch);
    check("land verdict: an error verdict is delivered once and tells the lane to rebase and re-verify",
      markE?.sent === true && markE.kind === "error" && sendsE.length === 1
        && (sendsE[0] ?? "").includes("Rebase it onto") && (sendsE[0] ?? "").includes("run the verification chain")
        && !(sendsE[0] ?? "").includes("NOTHING TO FIX"),
      JSON.stringify({ mark: markE, text: (sendsE[0] ?? "").slice(-260) }));
    await dropLane(lnE);

    // (iii-bis) THE COUNTER-PROBE to (i), and the reason `review` is not one text: a conflict the
    // agent resolved stops for the owner's review with a GREEN gate. It is the same kind and the
    // same envelope, but "fix it" would be a lie about this tree — so the closing line must be the
    // other one. Without this check a mutation collapsing the two would leave (i) green.
    await setMergeMode("do");
    const lnC = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${lnC.cwd}/code.txt`, "root\nverdict-clean-conflict-lane\n");
    spawnSync("git", ["-C", lnC.cwd, "commit", "-aqm", "verdict-clean-conflict lane work"]);
    await Bun.write(`${REPO}/code.txt`, "root\nverdict-clean-conflict-main\n"); // same lines → real conflict
    spawnSync("git", ["-C", REPO, "commit", "-aqm", "verdict-clean-conflict main work"]);
    await settleForMerge(lnC.slot);
    await post(`/api/slots/${lnC.slot}/merge`, {});
    const vC = await waitMerge(lnC.slot);
    check("land verdict setup: the resolved-conflict lane is kept with a GREEN gate, not landed",
      !vC.gone && vC.last?.status === "resolved" && vC.last.landed === false
        && vC.last.verify?.ok === true && exists(lnC.cwd), JSON.stringify(vC.last?.verify));
    const markC = await awaitMark(lnC.slot, (d) => d.sent);
    const sendsC = await verdictSends(lnC.branch);
    check("land verdict: a resolved verdict with NO failure says so — no fix order, no flake proof",
      markC?.sent === true && markC.kind === "review" && sendsC.length === 1
        && (sendsC[0] ?? "").includes("nothing here to fix")
        && (sendsC[0] ?? "").includes("stopped for the owner's review")
        && !(sendsC[0] ?? "").includes("run the SAME tree again"),
      JSON.stringify({ mark: markC, text: (sendsC[0] ?? "").slice(-260) }));
    await dropLane(lnC);

    // (iv) a WAIT-OUT — the one kept-lane exit that carries NO work. The gate was killed while
    // still queued behind the suite mutex and never looked at the tree, so a fix-or-prove
    // instruction here would send a session hunting a defect nothing ever measured: verbatim the
    // afternoon lost on 2026-08-06. Asserted as the ABSENCE of that instruction, not only as the
    // presence of its own words — the two texts share the envelope and differ exactly there.
    const lnW = await markerLane("verdict-wait", "lane work carrying a VERIFYWAIT marker\n");
    await settleForMerge(lnW.slot);
    await post(`/api/slots/${lnW.slot}/merge`, {});
    const vW = await waitMerge(lnW.slot);
    check("land verdict setup: the queued-verify lane settles as resolved with verify.waitedOut",
      !vW.gone && vW.last?.status === "resolved" && vW.last.verify?.waitedOut === true && exists(lnW.cwd),
      JSON.stringify(vW.last?.verify));
    const markW = await awaitMark(lnW.slot, (d) => d.sent);
    const sendsW = await verdictSends(lnW.branch);
    check("land verdict: a wait-out is delivered as its own text — nothing to fix, no proof to run",
      markW?.sent === true && markW.kind === "waited" && sendsW.length === 1
        && (sendsW[0] ?? "").includes("NEVER LOOKED AT THIS TREE")
        && (sendsW[0] ?? "").includes("NOTHING TO FIX")
        && !(sendsW[0] ?? "").includes("run the SAME tree again")
        && !(sendsW[0] ?? "").includes("Rebase it onto"),
      JSON.stringify({ mark: markW, text: (sendsW[0] ?? "").slice(-300) }));
    await dropLane(lnW);

    // (vi) THE BOUND, and the check that makes (ii) mean something: a delivery the gate REFUSES is
    // retried exactly once and then stands. Driven deterministically rather than hoped for — the
    // VERIFYHANG gate holds the job for the whole 8s work budget, so the pane can be made busy
    // AFTER the merge starts (the merge route has an idle gate of its own and would refuse the
    // start), and it is still busy at the terminal and at every retry tick after it.
    const lnB = await markerLane("verdict-busy", "lane work carrying a VERIFYHANG marker\n");
    await settleForMerge(lnB.slot);
    await post(`/api/slots/${lnB.slot}/merge`, {});
    await tmuxOut("send-keys", "-t", `s${lnB.slot}`, "while true; do date; sleep 0.2; done", "Enter");
    const vB2 = await waitMerge(lnB.slot);
    check("land verdict setup: the busy lane settles as a kept resolved verdict (timed-out gate)",
      !vB2.gone && vB2.last?.status === "resolved" && vB2.last.verify?.timedOut === true,
      JSON.stringify(vB2.last?.verify));
    const markB = await awaitMark(lnB.slot, (d) => d.attempts >= 2);
    await Bun.sleep(3_000); // many further ticks — the cap must hold, not merely be reached
    const markB2 = await verdictMark(lnB.slot);
    const sendsB = await verdictSends(lnB.branch);
    check("land verdict: a refused delivery is retried exactly ONCE, then gives up and stays visible",
      markB?.attempts === 2 && markB2?.attempts === 2 && markB2.sent === false
        && markB2.gate === "busy" && sendsB.length === 0,
      JSON.stringify({ mark: markB2, sends: sendsB.length }));
    await tmuxOut("send-keys", "-t", `s${lnB.slot}`, "C-c");
    await dropLane(lnB);

    // (v) THE SILENCE THAT MATTERS MOST: a successful land delivers nothing. It holds by
    // construction — the land tears the worktree down before the delivery runs — and that is
    // exactly why it needs an assertion: a future edit that moved the call ahead of the teardown
    // would type a verdict into a pane whose lane no longer exists.
    const lnG = await markerLane("verdict-green", "clean lane work, no marker\n");
    await settleForMerge(lnG.slot);
    await post(`/api/slots/${lnG.slot}/merge`, {});
    const vG = await waitMerge(lnG.slot);
    await Bun.sleep(1_500); // several retry ticks after the land, in case anything wanted to speak
    check("land verdict: a successful land tells the lane NOTHING — the lane is gone",
      vG.gone && !exists(lnG.cwd) && (await verdictSends(lnG.branch)).length === 0,
      JSON.stringify({ gone: vG.gone, last: vG.last }));

    // --- ...AND WHO THE VERDICT IS FOR (2026-09-04) ---------------------------------------------
    // Everything above is the OWNER's case: the owner drove ⏫ from the board, so the lane is the
    // only session left holding something to do. A Program-MAIN self-land is the other case, and
    // until this cut it was answered with the owner's — measured on 2026-09-04, a ff-lost verdict
    // typed into a LANE pane was read there as an order and re-ran the whole verification chain on
    // this machine's ONE suite mutex, six times on a single row, three of them ff-lost. The
    // receiver now follows the land's ACTOR: a `main` land answers the MAIN and tells the lane
    // nothing at all.
    //
    // The `main` arm needs a Program, a bound MAIN and the self-land door, all of which
    // e2e/programs.ts already stands up around its red self-land row — it is asserted there, on
    // that fixture, rather than rebuilt here. What this family owns is the other half, and it is
    // the half a mutation breaks quietly: the owner's path must not have moved by ONE BYTE, and a
    // row that names a receiver must never fall back to the lane, whatever became of that receiver.

    // (vii) THE BYTE COMPARE. Not `includes`: the expected string is composed here from the facts
    // the server exposes about this very run, so a single added byte anywhere in the envelope, the
    // status line or the closing instruction fails it. The `error` verdict is the one used because
    // it carries no verify tail — every byte of it is derivable from the row itself.
    await setMergeMode("lie");
    const lnO = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${lnO.cwd}/code.txt`, "root\nverdict-owner-byte-lane\n");
    spawnSync("git", ["-C", lnO.cwd, "commit", "-aqm", "verdict-owner-byte lane work"]);
    await Bun.write(`${REPO}/code.txt`, "root\nverdict-owner-byte-main\n"); // same lines → real conflict
    spawnSync("git", ["-C", REPO, "commit", "-aqm", "verdict-owner-byte main work"]);
    await settleForMerge(lnO.slot);
    await post(`/api/slots/${lnO.slot}/merge`, {});
    const vO = await waitMerge(lnO.slot);
    const integration = spawnSync("git", ["-C", REPO, "rev-parse", "--abbrev-ref", "HEAD"]).stdout.toString().trim();
    const expectedO = `[fleet land verdict — ${lnO.branch}] The server ran this lane's ⏫ merge/land. `
      + `This is its own result, not an owner instruction and not another session speaking. `
      + `status=error landed=NO\n\n${vO.last?.detail ?? ""}`
      + `\n\nThe lane was KEPT and nothing reached ${integration}. Rebase it onto ${integration} yourself, `
      + `run the verification chain, and report done again.`;
    await awaitMark(lnO.slot, (d) => d.sent);
    const rowsO = (await plogRead()).filter((e) => e.text.includes(`[fleet land verdict — ${lnO.branch}]`));
    const histO = ((await (await get(`/api/slots/${lnO.slot}/history`)).json()) as
      { history: { text: string }[] }).history
      .filter((h) => h.text.includes(`[fleet land verdict — ${lnO.branch}]`));
    // where they first differ, so a failure prints the byte and not "false"
    const firstDiff = (a: string, b: string): string => {
      if (a === b) return "identical";
      let i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i++;
      return `offset ${i}: got ${JSON.stringify(a.slice(i, i + 60))} want ${JSON.stringify(b.slice(i, i + 60))}`;
    };
    check("land verdict receiver: an OWNER land is unchanged to the byte — same text, same pane, same two ledger lines",
      rowsO.length === 1 && rowsO[0]?.slot === lnO.slot && rowsO[0]?.source === "auto"
        && rowsO[0]?.text === expectedO && histO.length === 1 && histO[0]?.text === expectedO,
      JSON.stringify({ rows: rowsO.length, slot: rowsO[0]?.slot, source: rowsO[0]?.source,
        history: histO.length, diff: firstDiff(rowsO[0]?.text ?? "", expectedO) }));
    // …and the machine-readable half of "same receiver": an owner land records NO receiver at all,
    // which is what makes an absent field mean "the lane" for every row written before it existed.
    const markO = await verdictMark(lnO.slot);
    const rowO = ((await (await get(`/api/slots/${lnO.slot}/merge`)).json()) as
      { last: { verdictTo?: unknown } | null }).last;
    check("land verdict receiver: an owner land records no receiver — absent is the lane, and stays the lane",
      markO?.sent === true && rowO !== null && rowO.verdictTo === undefined,
      JSON.stringify({ mark: markO, verdictTo: rowO?.verdictTo ?? null }));
    await dropLane(lnO);
    await setMergeMode("do");

    // (viii) THE PERSISTED RECEIVER, and the four ways a restored row can name one. The tick's
    // retry (FACT 3) has no job frame to inherit an actor from, so it reads the receiver off the
    // ROW — which is the whole reason the field is persisted. Four rows are planted at once and
    // the SAME tick decides all four, so the discrimination is real rather than four timings:
    //   · a row with NO receiver is the legacy bestand and goes to the lane, exactly as today;
    //   · a row with a TORN receiver is dropped whole by the loader — half an attribution is a
    //     different claim, not a weaker one — and therefore also goes to the lane;
    //   · a row naming a receiver that is GONE goes NOWHERE. Not to the lane: falling back is
    //     precisely the paste this cut removes, so it is booked as undeliverable and stays readable.
    //   · and a row naming a receiver whose SLOT WAS RECYCLED — the shape the incident's own worry
    //     is about, and a different arm of the check from the one above: the Program is there and
    //     still bound to the occupant that asked, but that occupant is no longer in the slot. A
    //     stranger must not be handed another session's answer, and neither must the lane.
    const lnLegacyTo = await markerLane("verdict-legacy-to", "lane work with a VERIFYBAD marker\n");
    const lnTornTo = await markerLane("verdict-torn-to", "lane work with a VERIFYBAD marker\n");
    const lnGoneTo = await markerLane("verdict-gone-to", "lane work with a VERIFYBAD marker\n");
    const lnRecycledTo = await markerLane("verdict-recycled-to", "lane work with a VERIFYBAD marker\n");
    // the recycled arm needs a Program that EXISTS and is still bound to the occupant that asked.
    // Minted through the owner route so its content is the real validated shape; only the two
    // fields no route may write — `status` and the `main` binding — are set in the plant below.
    const recyclProg = ((await (await post("/api/programs", {
      title: "verdict receiver fixture", intent: "hold a binding a recycled receiver can be measured against",
      successCriterion: "the planted receiver resolves to a slot that is no longer its occupant",
      nonGoals: [], decisions: [], evidence: [], openQuestions: [],
    })).json()) as { program?: { id: string } }).program?.id ?? "";
    for (const ln of [lnLegacyTo, lnTornTo, lnGoneTo, lnRecycledTo]) {
      await settleForMerge(ln.slot);
      await post(`/api/slots/${ln.slot}/merge`, {});
      await waitMerge(ln.slot);
      await awaitMark(ln.slot, (d) => d.sent);
    }
    const beforeTo = await Promise.all([lnLegacyTo, lnTornTo, lnGoneTo, lnRecycledTo]
      .map(async (ln) => (await verdictSends(ln.branch)).length));
    check("land verdict receiver setup: all four planted lanes were told exactly once before the plant",
      beforeTo.every((n) => n === 1) && !!recyclProg, JSON.stringify({ sends: beforeTo, program: recyclProg }));
    // killing the scratch server before editing its scratch fleet.json makes the plant
    // deterministic — no process can overwrite it (the ACP-03 Q4 fixture's discipline)
    await tmuxOut("kill-session", "-t", "srv");
    await Bun.sleep(500);
    const toState = (await Bun.file(`${ROOT}/fleet.json`).json()) as
      { merges?: Record<string, Record<string, unknown>>;
        programs?: Record<string, unknown>[] };
    const replant = { at: Date.now(), attempts: 1, sent: false, kind: "review" };
    const rowLegacy = toState.merges?.[String(lnLegacyTo.slot)];
    const rowTorn = toState.merges?.[String(lnTornTo.slot)];
    const rowGone = toState.merges?.[String(lnGoneTo.slot)];
    const rowRecycled = toState.merges?.[String(lnRecycledTo.slot)];
    // openedAt 1 is an occupant no live slot can be: the binding still names it, the slot does not.
    const recyclRow = toState.programs?.find((p) => (p as { id?: string }).id === recyclProg);
    if (recyclRow) {
      // the loader refuses an active row without both stamps, so the plant supplies exactly the
      // two fields the lifecycle demands and nothing more
      recyclRow.status = "active";
      recyclRow.confirmedAt = Date.now();
      recyclRow.activatedAt = Date.now();
      recyclRow.main = { slot: lnRecycledTo.slot, openedAt: 1, sessionId: null, boundAt: 1 };
    }
    if (rowRecycled) {
      rowRecycled.verdictDelivery = { ...replant };
      rowRecycled.verdictTo = { slot: lnRecycledTo.slot, program: recyclProg, task: "0".repeat(24),
        occupant: { openedAt: 1, sessionId: null } };
    }
    if (rowLegacy) rowLegacy.verdictDelivery = { ...replant };
    if (rowTorn) {
      rowTorn.verdictDelivery = { ...replant };
      // torn on every field at once, occupant included: an occupant KEY that is present but
      // unreadable is a torn row, not the (legitimate) "binding was unreadable" row
      rowTorn.verdictTo = { slot: "not-a-slot", program: 7, task: "", occupant: { openedAt: "later" } };
    }
    if (rowGone) {
      rowGone.verdictDelivery = { ...replant };
      rowGone.verdictTo = { slot: lnGoneTo.slot, program: "0".repeat(24), task: "0".repeat(24),
        occupant: { openedAt: 1, sessionId: null } };
    }
    check("land verdict receiver setup: the four persisted rows exist, were replanted as owed-a-retry, and the fixture binding is in place",
      !!rowLegacy && !!rowTorn && !!rowGone && !!rowRecycled && !!recyclRow,
      JSON.stringify({ merges: Object.keys(toState.merges ?? {}), program: !!recyclRow }));
    await Bun.write(`${ROOT}/fleet.json`, JSON.stringify(toState, null, 2));
    // THE TICK IS SLOWED FOR THIS ONE RESTART, and it is a precondition rather than a convenience:
    // boot stamps every pane's `lastOutput` to boot time (unknown is never permission), so with the
    // suite's 250ms cadence both remaining attempts would burn against canDeliver's 3s busy gate
    // within the first second and every row below would read "silent" for a reason that has nothing
    // to do with its receiver. One tick at ~6s, after the panes are idle again, measures the
    // receiver and nothing else. Restored to the suite's cadence at the end of the block.
    await restartSrv({ FLEET_AUTOS_TICK_MS: "6000" });
    const sentAgain = async (ln: { slot: number; branch: string }): Promise<number> => {
      for (let i = 0; i < 600; i++) {
        if ((await verdictSends(ln.branch)).length > 1) break;
        await Bun.sleep(50);
      }
      return (await verdictSends(ln.branch)).length;
    };
    const legacyAgain = await sentAgain(lnLegacyTo);
    const tornAgain = await sentAgain(lnTornTo);
    const legacyRows = (await plogRead()).filter((e) => e.text.includes(`[fleet land verdict — ${lnLegacyTo.branch}]`));
    const tornRow = ((await (await get(`/api/slots/${lnTornTo.slot}/merge`)).json()) as
      { last: { verdictTo?: unknown } | null }).last;
    check("land verdict receiver: a restored row with NO receiver is the legacy bestand — it loads and goes to the lane",
      legacyAgain === 2 && legacyRows.every((e) => e.slot === lnLegacyTo.slot),
      JSON.stringify({ sends: legacyAgain, slots: legacyRows.map((e) => e.slot) }));
    check("land verdict receiver: a TORN receiver is dropped whole at load, never repaired field-wise, and the row goes to the lane",
      tornAgain === 2 && tornRow !== null && tornRow.verdictTo === undefined,
      JSON.stringify({ sends: tornAgain, verdictTo: tornRow?.verdictTo ?? null }));
    // the third one is the SILENCE, and it is asserted after the other two have already moved —
    // the same tick that redelivered them is the tick that refused this one, so "nothing yet" and
    // "nothing ever" are not being confused.
    const goneMark = await awaitMark(lnGoneTo.slot, (d) => d.attempts >= 2);
    const goneSends = await verdictSends(lnGoneTo.branch);
    const goneRow = ((await (await get(`/api/slots/${lnGoneTo.slot}/merge`)).json()) as
      { last: { verdictTo?: { slot?: number; program?: string } } | null }).last;
    const goneAudit = readFileSync(`${ROOT}/audit.jsonl`, "utf8").split("\n").filter(Boolean)
      .flatMap((line) => { try { return [JSON.parse(line) as { event?: string; slot?: number; detail?: string }]; } catch { return []; } })
      .filter((r) => r.event === "merge_verdict_undeliverable" && (r.detail ?? "").startsWith(`${lnGoneTo.branch}:`));
    check("land verdict receiver: a receiver that is GONE is told nothing and the LANE is not told either — no fallback",
      goneSends.length === 1 && goneMark?.sent === false && goneMark.gate === "receiver-gone"
        && goneRow?.verdictTo?.slot === lnGoneTo.slot,
      JSON.stringify({ sends: goneSends.length, mark: goneMark, verdictTo: goneRow?.verdictTo ?? null }));
    check("land verdict receiver: the trail NAMES why the verdict went nowhere — the only place that disappearance is written down",
      goneAudit.length === 1 && (goneAudit[0]?.detail ?? "").includes("review")
        && (goneAudit[0]?.detail ?? "").includes("is gone")
        && (goneAudit[0]?.detail ?? "").includes(`lane slot=${lnGoneTo.slot}`),
      JSON.stringify(goneAudit.slice(-2)));
    // …and the arm the incident's own worry names: the Program is there and still bound to the
    // occupant that asked, but that occupant is not in the slot any more. Its own refusal, in its
    // own words — a reader must be able to tell "the program went away" from "the session did".
    const recyclMark = await awaitMark(lnRecycledTo.slot, (d) => d.attempts >= 2);
    const recyclSends = await verdictSends(lnRecycledTo.branch);
    const recyclAudit = readFileSync(`${ROOT}/audit.jsonl`, "utf8").split("\n").filter(Boolean)
      .flatMap((line) => { try { return [JSON.parse(line) as { event?: string; detail?: string }]; } catch { return []; } })
      .filter((r) => r.event === "merge_verdict_undeliverable" && (r.detail ?? "").startsWith(`${lnRecycledTo.branch}:`));
    check("land verdict receiver: a MAIN slot recycled between the land and the verdict gets NOTHING, the lane gets nothing, and the trail says which of the two it was",
      recyclSends.length === 1 && recyclMark?.sent === false && recyclMark.gate === "receiver-gone"
        && recyclAudit.length === 1 && (recyclAudit[0]?.detail ?? "").includes("was recycled since the land")
        && !(recyclAudit[0]?.detail ?? "").includes("is gone"),
      JSON.stringify({ sends: recyclSends.length, mark: recyclMark, audit: recyclAudit.slice(-1) }));
    for (const ln of [lnLegacyTo, lnTornTo, lnGoneTo, lnRecycledTo]) await dropLane(ln);
    await restartSrv(); // back to the suite's own cadence for everything after this block
  }

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
  await post(`/api/slots/${receiverA}/kill`, {});
  await post(`/api/slots/${receiverB}/kill`, {});
}
