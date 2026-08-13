// The ✨ summary agent behind its FLEET_SUMMARY_CMD stand-in: gather → spawn → parse → cache.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { buildEnhancePrompt } from "../enhance-prompt";
import { WORKER_CONTRACTS } from "../src/protocol";
import { REPO, ROOT, check, get, post, restartSrv, tmuxOut } from "./harness";

export async function run(): Promise<void> {
  // --- ✨ summary agent (FLEET_SUMMARY_CMD points at a stand-in that answers in
  // claude -p's json envelope — tests the real gather→spawn→parse→cache pipeline) ---
  const sm0 = (await (await get("/api/slots/1/summary")).json()) as { cached: boolean; summary?: string };
  check("summary GET before any run → cache miss, no spawn", sm0.cached === false && sm0.summary === undefined);
  const sm1res = await post("/api/slots/1/summary", {});
  const sm1 = (await sm1res.json()) as { summary: string; openThreads: string[]; verification: string;
    cached: boolean; raw: boolean; head: string | null };
  check("summary POST runs the agent and parses strict JSON",
    sm1res.ok && sm1.summary === "fake summary of the session" && sm1.raw === false,
    JSON.stringify(sm1).slice(0, 140));
  check("summary carries openThreads + verification",
    sm1.openThreads.length === 1 && sm1.openThreads[0] === "thread-a" && sm1.verification === "none seen");
  check("summary pins the git state it ran on", typeof sm1.head === "string" && /^[0-9a-f]{40}$/.test(sm1.head ?? ""));
  check("summary first run is uncached", sm1.cached === false);
  const sm2 = (await (await post("/api/slots/1/summary", {})).json()) as { cached: boolean; summary: string };
  check("summary cache hit on unchanged git state", sm2.cached === true && sm2.summary === sm1.summary);
  const sm3 = (await (await get("/api/slots/1/summary")).json()) as { cached: boolean; stale: boolean };
  check("summary GET now serves the cache", sm3.cached === true && sm3.stale === false);
  check("summary rejects inactive slot", (await post("/api/slots/4/summary", {})).status === 400);

  // --- per-worker Codex exec route ------------------------------------------------------------
  // The wrapper deliberately sets FLEET_SUMMARY_CMD for every ordinary check above. Precedence 1
  // makes those checks immune to the new production default. Only this bounded restart section
  // passes an explicit empty value, so the fake Codex binary exercises precedence 2; finally
  // restores the original wrapper env before the next e2e family runs.
  const fakeCodex = `${ROOT}/fakecodex`;
  const modeFile = `${ROOT}/codex-mode`;
  const runsFile = `${ROOT}/codex-runs`;
  const codexEnv = {
    FLEET_SUMMARY_CMD: "",
    FLEET_COMMIT_CMD: "",
    FLEET_ENHANCE_CMD: "",
    FLEET_DIGEST_CMD: "",
    FLEET_CODEX_EXEC_BIN: fakeCodex,
    FLEET_CODEX_EXEC_TIMEOUT_MS: "1500",
  };
  const runs = (): number => {
    try { return readFileSync(runsFile, "utf8").split("\n").filter(Boolean).length; } catch { return 0; }
  };
  const tmpGone = (): boolean => {
    try {
      const out = readFileSync(`${ROOT}/codex-tmpout`, "utf8").trim();
      return !!out && !existsSync(dirname(out));
    } catch { return false; }
  };
  const setMode = async (mode: string): Promise<void> => {
    await Bun.write(modeFile, `${mode}\n`);
    rmSync(`${ROOT}/codex-killed`, { force: true });
  };
  try {
    check("FLEET_SUMMARY_CMD precedence keeps the ordinary suite off the default Codex route",
      runs() === 0, `codexRuns=${runs()}`);
    rmSync(runsFile, { force: true });
    await setMode("success");
    await restartSrv(codexEnv);
    const cx1res = await post("/api/slots/1/summary", {});
    const cx1 = (await cx1res.json()) as { summary?: string; openThreads?: string[];
      verification?: string; model?: string; backend?: string; usage?: { input?: number; output?: number };
      cached?: boolean; raw?: boolean };
    check("codex summary parses the -o last message and exposes its actual backend/model/observed usage",
      cx1res.ok && cx1.summary === "codex summary of the session" && cx1.raw === false
      && cx1.model === "gpt-5.3-codex-spark" && cx1.backend === "codex-exec"
      && cx1.usage?.input === 17 && cx1.usage?.output === 5,
      JSON.stringify(cx1).slice(0, 240));

    const argv = readFileSync(`${ROOT}/codex-argv`, "utf8").split("\n").filter(Boolean);
    const pair = (flag: string, value: string): boolean => {
      const at = argv.indexOf(flag);
      return at >= 0 && argv[at + 1] === value && argv.lastIndexOf(flag) === at;
    };
    check("codex summary argv pins the exact model, read-only sandbox and ephemeral headless protocol",
      argv[0] === "exec" && pair("-m", "gpt-5.3-codex-spark") && pair("-s", "read-only")
      && argv.includes("--ephemeral") && argv.includes("--skip-git-repo-check")
      && pair("--color", "never") && argv.includes("--json") && argv.includes("-o")
      && argv[argv.length - 1] === "-" && !argv.some((a) => a.startsWith("--dangerously")), argv.join(" "));
    const capturedPrompt = readFileSync(`${ROOT}/codex-prompt`, "utf8");
    check("codex summary receives the complete marked prompt on stdin (never as an argv fragment)",
      capturedPrompt.includes(WORKER_CONTRACTS.summary.mark)
      && capturedPrompt.includes(`{\"summary\": \"...\", \"openThreads\": [\"...\"], \"verification\": \"...\"}`)
      && !argv.some((a) => a.includes(WORKER_CONTRACTS.summary.mark)),
      `bytes=${Buffer.byteLength(capturedPrompt)} mark=${capturedPrompt.includes(WORKER_CONTRACTS.summary.mark)}`);
    check("codex worker removes its fresh tmp directory after success", tmpGone());
    const cxRuns = runs();
    const cx2 = (await (await post("/api/slots/1/summary", {})).json()) as { cached?: boolean; summary?: string };
    check("codex summary is cached on unchanged git state without a second exec",
      cx2.cached === true && cx2.summary === cx1.summary && runs() === cxRuns,
      `cached=${cx2.cached} runs=${runs()}/${cxRuns}`);

    await setMode("unknown");
    await restartSrv({ ...codexEnv, FLEET_WORKER_ROUTE_SUMMARY: "not-a-route" });
    const unknownRes = await post("/api/slots/1/summary", {});
    const unknown = (await unknownRes.json()) as { summary?: string; model?: string; backend?: string; usage?: unknown };
    check("an invalid summary route fails toward Codex, while unobserved usage stays absent (never estimated)",
      unknownRes.ok && unknown.summary === "codex summary without usage"
      && unknown.model === "gpt-5.3-codex-spark" && unknown.backend === "codex-exec"
      && unknown.usage === undefined, JSON.stringify(unknown));

    await setMode("nonzero");
    await restartSrv(codexEnv);
    const nzRes = await post("/api/slots/1/summary", {});
    const nz = (await nzRes.json()) as { error?: string };
    const sessionsAfterNz = (await tmuxOut("list-sessions", "-F", "#{session_name}")).out.split("\n").filter(Boolean);
    check("codex nonzero exit is a named 500 with stderr/stdout evidence and no Claude sum-* session",
      nzRes.status === 500 && (nz.error ?? "").includes("worker via codex exec exited 23")
      && (nz.error ?? "").includes("controlled codex failure")
      && !sessionsAfterNz.some((name) => name.startsWith("sum-")),
      `${nzRes.status} ${nz.error ?? ""} sessions=${sessionsAfterNz.join(",")}`);
    check("codex worker removes its fresh tmp directory after a nonzero error", tmpGone());

    await setMode("timeout");
    await restartSrv(codexEnv);
    const timeoutStarted = Date.now();
    const toRes = await post("/api/slots/1/summary", {});
    const timeoutMs = Date.now() - timeoutStarted;
    const to = (await toRes.json()) as { error?: string };
    check("codex timeout is named with the effective test budget and kills the stand-in process promptly",
      toRes.status === 500 && to.error === "worker via codex exec timed out after 1500ms"
      && timeoutMs >= 1200 && timeoutMs < 5000 && existsSync(`${ROOT}/codex-killed`),
      `${toRes.status} ${to.error ?? ""} elapsed=${timeoutMs}ms`);
    check("codex worker removes its fresh tmp directory after timeout", tmpGone());

    await setMode("missing");
    await restartSrv(codexEnv);
    const noOutRes = await post("/api/slots/1/summary", {});
    const noOut = (await noOutRes.json()) as { error?: string };
    check("codex exit 0 without an -o last message is a named 500",
      noOutRes.status === 500 && noOut.error === "codex exec exited 0 but wrote no last message",
      `${noOutRes.status} ${noOut.error ?? ""}`);
    check("codex worker removes its fresh tmp directory after a missing-output error", tmpGone());

    const latestArgv = (): string[] => readFileSync(`${ROOT}/codex-argv`, "utf8").split("\n").filter(Boolean);
    const noSumSession = async (): Promise<boolean> =>
      !(await tmuxOut("list-sessions", "-F", "#{session_name}")).out.split("\n").some((name) => name.startsWith("sum-"));

    // Enhance: use the no-slot form so the expected prompt is exactly reconstructible. Equality,
    // not a substring, proves stdin received the complete buildEnhancePrompt result.
    const enhanceDraft = "prove migrated enhancer";
    await setMode("enhance");
    await restartSrv(codexEnv);
    const enhRes = await post("/api/enhance", { text: enhanceDraft });
    const enh = (await enhRes.json()) as { prompt?: string; draftId?: string };
    const enhanceArgv = latestArgv();
    const enhancePrompt = readFileSync(`${ROOT}/codex-prompt`, "utf8");
    check("Codex enhance preserves its wrapped-JSON fallback and exact response contract",
      enhRes.ok && enh.prompt === "codex enhanced prompt. own your work! /sharpen3"
      && typeof enh.draftId === "string" && enh.draftId.length === 16, `${enhRes.status} ${JSON.stringify(enh)}`);
    check("Codex enhance pins Spark/read-only/ephemeral and receives the complete marked prompt only on stdin",
      enhanceArgv[enhanceArgv.indexOf("-m") + 1] === "gpt-5.3-codex-spark"
      && enhanceArgv[enhanceArgv.indexOf("-s") + 1] === "read-only" && enhanceArgv.includes("--ephemeral")
      && enhancePrompt === buildEnhancePrompt(enhanceDraft, null)
      && enhancePrompt.includes(WORKER_CONTRACTS.enhance.mark)
      && !enhanceArgv.some((a) => a.includes(WORKER_CONTRACTS.enhance.mark)) && await noSumSession(),
      `argv=${enhanceArgv.join(" ")} bytes=${Buffer.byteLength(enhancePrompt)}`);
    check("codex worker removes its fresh tmp directory after enhance success", tmpGone());

    await setMode("malformed");
    const badEnhRes = await post("/api/enhance", { text: "malformed enhance probe" });
    const badEnh = (await badEnhRes.json()) as { error?: string };
    check("a malformed Codex enhance answer remains the caller's named 502",
      badEnhRes.status === 502 && badEnh.error === "enhancer returned no JSON",
      `${badEnhRes.status} ${badEnh.error ?? ""}`);
    check("codex worker removes its fresh tmp directory after malformed enhance output", tmpGone());

    const beforeEnhanceStandin = runs();
    await restartSrv({ ...codexEnv, FLEET_ENHANCE_CMD: `${ROOT}/fakeenh` });
    const standinEnhRes = await post("/api/enhance", { slot: 1, text: "prove stand-in precedence" });
    const standinEnh = (await standinEnhRes.json()) as { prompt?: string };
    check("FLEET_ENHANCE_CMD stays ahead of the Codex route",
      standinEnhRes.ok && standinEnh.prompt === "enhanced prompt. own your work! /sharpen3"
      && runs() === beforeEnhanceStandin,
      `${standinEnhRes.status} ${JSON.stringify(standinEnh)} codexRuns=${runs()}/${beforeEnhanceStandin}`);

    const beforeEnhanceRollback = runs();
    await restartSrv({ ...codexEnv, FLEET_WORKER_ROUTE_ENHANCE: "claude", FLEET_WORKER_HARNESS: "codex" });
    const rollbackEnhRes = await post("/api/enhance", { text: "prove explicit enhance rollback" });
    const rollbackEnh = (await rollbackEnhRes.json()) as { error?: string };
    check("FLEET_WORKER_ROUTE_ENHANCE=claude selects the old session lane without a Codex fallback",
      rollbackEnhRes.status === 502 && (rollbackEnh.error ?? "").includes('harness "codex" cannot host a worker session')
      && runs() === beforeEnhanceRollback,
      `${rollbackEnhRes.status} ${rollbackEnh.error ?? ""} codexRuns=${runs()}/${beforeEnhanceRollback}`);

    // Commit-message: a private throwaway lane is needed because the real caller's response
    // contract is the commit result itself. It is removed before the later lane families start.
    if (!REPO) {
      check("Codex commit-message probe has the isolated fixture repo it requires", false, "FLEET_E2E_REPO absent");
    } else {
      const commitBranch = "e2e-codex-commit-message";
      let commitSlot = 0;
      let commitCwd = "";
      try {
        await setMode("commit");
        await restartSrv(codexEnv);
        const openRes = await post("/api/slots/5/open-worktree", { repo: REPO, branch: commitBranch });
        const opened = (await openRes.json()) as { slot?: number; cwd?: string };
        commitSlot = opened.slot ?? 5;
        commitCwd = opened.cwd ?? "";
        check("throwaway lane for the Codex commit-message caller opens",
          openRes.ok && commitSlot === 5 && !!commitCwd, `${openRes.status} ${JSON.stringify(opened)}`);

        if (commitCwd) {
          await Bun.write(`${commitCwd}/codex-worker-probe.txt`, "codex commit probe one\n");
          const commitRes = await post("/api/slots/5/commit", { mode: "agent", confirm: true });
          const committed = (await commitRes.json()) as { committed?: boolean; subject?: string; messageFallback?: boolean };
          const commitArgv = latestArgv();
          const commitPrompt = readFileSync(`${ROOT}/codex-prompt`, "utf8");
          check("Codex commitMsg preserves sanitizeCommitMsg and the caller's commit response contract",
            commitRes.ok && committed.committed === true && committed.subject === "feat(worker): codex spark commit message"
            && committed.messageFallback === undefined, `${commitRes.status} ${JSON.stringify(committed)}`);
          check("Codex commitMsg pins Spark/read-only/ephemeral and receives its complete marked diff prompt only on stdin",
            commitArgv[commitArgv.indexOf("-m") + 1] === "gpt-5.3-codex-spark"
            && commitArgv[commitArgv.indexOf("-s") + 1] === "read-only" && commitArgv.includes("--ephemeral")
            && commitPrompt.includes(WORKER_CONTRACTS.commitMsg.mark)
            && commitPrompt.includes("## shortstat") && commitPrompt.includes("## per-file stat")
            && commitPrompt.includes("codex commit probe one")
            && !commitArgv.some((a) => a.includes(WORKER_CONTRACTS.commitMsg.mark)) && await noSumSession(),
            `argv=${commitArgv.join(" ")} bytes=${Buffer.byteLength(commitPrompt)}`);
          check("codex worker removes its fresh tmp directory after commitMsg success", tmpGone());

          await setMode("malformed");
          await Bun.write(`${commitCwd}/codex-worker-probe.txt`, "codex commit probe one\nmalformed answer\n");
          const badCommitRes = await post("/api/slots/5/commit", { mode: "agent", confirm: true });
          const badCommit = (await badCommitRes.json()) as { committed?: boolean; subject?: string; messageFallback?: boolean };
          check("a malformed Codex commitMsg answer keeps the existing explicit wip fallback contract",
            badCommitRes.ok && badCommit.committed === true && badCommit.messageFallback === true
            && (badCommit.subject ?? "").startsWith("wip:"), `${badCommitRes.status} ${JSON.stringify(badCommit)}`);
          check("codex worker removes its fresh tmp directory after malformed commitMsg output", tmpGone());

          await setMode("commit");
          const beforeCommitStandin = runs();
          await restartSrv({ ...codexEnv, FLEET_COMMIT_CMD: `${ROOT}/fakecommit` });
          await Bun.write(`${commitCwd}/codex-worker-probe.txt`, "codex commit probe one\nmalformed answer\nstand-in\n");
          const standinCommitRes = await post("/api/slots/5/commit", { mode: "agent", confirm: true });
          const standinCommit = (await standinCommitRes.json()) as { committed?: boolean; subject?: string };
          check("FLEET_COMMIT_CMD stays ahead of the Codex route",
            standinCommitRes.ok && standinCommit.committed === true && standinCommit.subject === "feat: stand-in commit message"
            && runs() === beforeCommitStandin,
            `${standinCommitRes.status} ${JSON.stringify(standinCommit)} codexRuns=${runs()}/${beforeCommitStandin}`);

          const beforeCommitRollback = runs();
          await restartSrv({ ...codexEnv, FLEET_WORKER_ROUTE_COMMITMSG: "claude", FLEET_WORKER_HARNESS: "codex" });
          await Bun.write(`${commitCwd}/codex-worker-probe.txt`, "codex commit probe one\nmalformed answer\nstand-in\nrollback\n");
          const rollbackCommitRes = await post("/api/slots/5/commit", { mode: "agent", confirm: true });
          const rollbackCommit = (await rollbackCommitRes.json()) as { committed?: boolean; subject?: string; messageFallback?: boolean };
          check("FLEET_WORKER_ROUTE_COMMITMSG=claude selects the old lane and preserves its caller fallback",
            rollbackCommitRes.ok && rollbackCommit.committed === true && rollbackCommit.messageFallback === true
            && (rollbackCommit.subject ?? "").startsWith("wip:") && runs() === beforeCommitRollback,
            `${rollbackCommitRes.status} ${JSON.stringify(rollbackCommit)} codexRuns=${runs()}/${beforeCommitRollback}`);
        }
      } finally {
        if (commitSlot) await post(`/api/slots/${commitSlot}/kill`, {});
        if (commitCwd) Bun.spawnSync(["git", "-C", REPO, "worktree", "remove", "--force", commitCwd]);
        Bun.spawnSync(["git", "-C", REPO, "branch", "-qD", commitBranch]);
      }
    }

    // Route rollback is probed against an adapter that cannot host session workers. That makes
    // selection of the old lane observable immediately, without starting Claude or needing login.
    const beforeSummaryRollback = runs();
    await restartSrv({ ...codexEnv, FLEET_WORKER_ROUTE_SUMMARY: "claude", FLEET_WORKER_HARNESS: "codex" });
    const routeBackRes = await post("/api/slots/1/summary", {});
    const routeBack = (await routeBackRes.json()) as { error?: string };
    check("FLEET_WORKER_ROUTE_SUMMARY=claude selects the old session lane without a Codex fallback",
      routeBackRes.status === 500 && (routeBack.error ?? "").includes('harness "codex" cannot host a worker session')
      && runs() === beforeSummaryRollback,
      `${routeBackRes.status} ${routeBack.error ?? ""} codexRuns=${runs()}/${beforeSummaryRollback}`);

    // Stand-in remains precedence 1 even when the explicit rollback is present, and preserves
    // the pre-migration SummaryResult defaults without starting either production transport.
    await restartSrv({ ...codexEnv, FLEET_WORKER_ROUTE_SUMMARY: "claude", FLEET_SUMMARY_CMD: `${ROOT}/fakesum` });
    const backRes = await post("/api/slots/1/summary", {});
    const back = (await backRes.json()) as { summary?: string; model?: string; backend?: string; usage?: unknown };
    check("FLEET_SUMMARY_CMD remains first and preserves the old summary response defaults",
      backRes.ok && back.summary === "fake summary of the session" && back.backend === undefined
      && back.usage === undefined && back.model !== "gpt-5.3-codex-spark" && runs() === beforeSummaryRollback,
      `${JSON.stringify(back)} codexRuns=${runs()}/${beforeSummaryRollback}`);
  } finally {
    // The wrapper's initial srv command prepends ROOT solely so the later Watch family's fake
    // `pi` is observable. Our new early restarts would otherwise be the first ones to drop that
    // prerequisite. PATH_EXPORT is frozen from the SERVER process env at boot, so this must be an
    // explicit assignment on that final boot command; changing tmux's global/client environment
    // does not change the already-composed server command. A missing receiver must fail as itself,
    // not as six downstream Watch claims.
    await restartSrv({ PATH: `${ROOT}:${process.env.PATH ?? ""}` });
  }
}
