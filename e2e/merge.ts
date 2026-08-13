// The ⏫ merge/land paths: the agent verdicts (blocked / lying / resolved / prose), the server's
// own conflict-free script pre-pass, confirm-land and its stale-main replay, the V1 deterministic
// verify gate, and the orphan reattach / remove / discard flows.
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { BASE, REPO, REPO2, REPO3, ROOT, check, get, paneEnv, plogRead, post, restartSrv, tmuxOut } from "./harness";
import type { LaneCtx } from "./ctx";
import { exists, fakeClaudeInPane, setMergeMode, settleForMerge, waitMerge } from "./lane-helpers";

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
  (((await (await get("/api/sessions")).json()) as { events: unknown[] }).events as MergeEventRow[])
    .filter((e) => e.kind === "merge-terminal");
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
  await setMergeMode("hang");
  await settleForMerge(lc.lnSlot);
  const mgB = await post(`/api/slots/${lc.lnSlot}/merge`, {});
  check("merge POST starts an async job", ((await mgB.json()) as { running?: boolean }).running === true);
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
  const duplicateR = await selfMergeWatch(receiverBToken, lc.lnSlot);
  const duplicate = (await duplicateR.json()) as { watch?: MergeWatchRow; existing?: boolean };
  check("merge event: duplicate subscription returns the same subscription and never mints a twin",
    duplicateR.ok && duplicate.existing === true && duplicate.watch?.id === subAfter.watch?.id
      && (await mergeEvents()).filter((e) => e.watchId === subAfter.watch?.id).length === 1,
    JSON.stringify(duplicate));
  const ack1 = eventAfter ? await ackMergeEvent(receiverBToken, eventAfter.id) : null;
  const ack2 = eventAfter ? await ackMergeEvent(receiverBToken, eventAfter.id) : null;
  check("merge event: acknowledgement is idempotent",
    ack1?.ok === true && ack2?.ok === true
      && ((await ack2.json()) as { existing?: boolean }).existing === true,
    `${ack1?.status}/${ack2?.status}`);
  await post(`/api/slots/${receiverB}/kill`, {});
  const reopenReceiverB = await post(`/api/slots/${receiverB}/open`, { cwd: REPO });
  receiverBToken = await paneEnv(`s${receiverB}`, "FLEET_SELF_TOKEN") ?? "";
  const replacedAck = eventAfter ? await ackMergeEvent(receiverBToken, eventAfter.id) : null;
  check("merge event: a replacement occupant cannot acknowledge the old session's event",
    reopenReceiverB.ok && replacedAck?.status === 409,
    `${replacedAck?.status} ${replacedAck ? await replacedAck.text() : "no event"}`);

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
    // discarded, not landed: the marker would make every later clean lane in this suite queue too
    await post(`/api/slots/${lnVw.slot}/kill`, {});
    await post("/api/worktrees/discard", { repo: REPO, path: lnVw.cwd, branch: lnVw.branch });
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
