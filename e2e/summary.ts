// The ✨ summary agent behind its FLEET_SUMMARY_CMD stand-in: gather → spawn → parse → cache.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { WORKER_CONTRACTS } from "../src/protocol";
import { ROOT, check, get, post, restartSrv, tmuxOut } from "./harness";

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
    FLEET_CODEX_EXEC_BIN: fakeCodex,
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
    const toRes = await post("/api/slots/1/summary", {});
    const to = (await toRes.json()) as { error?: string };
    check("codex timeout is named with the caller budget and kills the stand-in process",
      toRes.status === 500 && to.error === "worker via codex exec timed out after 180000ms"
      && existsSync(`${ROOT}/codex-killed`), `${toRes.status} ${to.error ?? ""}`);
    check("codex worker removes its fresh tmp directory after timeout", tmpGone());

    await setMode("missing");
    await restartSrv(codexEnv);
    const noOutRes = await post("/api/slots/1/summary", {});
    const noOut = (await noOutRes.json()) as { error?: string };
    check("codex exit 0 without an -o last message is a named 500",
      noOutRes.status === 500 && noOut.error === "codex exec exited 0 but wrote no last message",
      `${noOutRes.status} ${noOut.error ?? ""}`);
    check("codex worker removes its fresh tmp directory after a missing-output error", tmpGone());

    await setMode("success");
    await restartSrv(codexEnv);
    const beforeEnhance = runs();
    const enhRes = await post("/api/enhance", { slot: 1, text: "prove worker isolation" });
    const enh = (await enhRes.json()) as { prompt?: string };
    check("a non-summary worker stays on its existing subprocess route while summary defaults to Codex",
      enhRes.ok && enh.prompt === "enhanced prompt. own your work! /sharpen3" && runs() === beforeEnhance,
      `${enhRes.status} ${JSON.stringify(enh)} codexRuns=${runs()}/${beforeEnhance}`);

    // This combines the explicit rollback value with the existing FLEET_SUMMARY_CMD stand-in:
    // it proves the reversible setting still reaches the old response shape without Codex usage.
    await restartSrv({ ...codexEnv, FLEET_WORKER_ROUTE_SUMMARY: "claude", FLEET_SUMMARY_CMD: `${ROOT}/fakesum` });
    const backRes = await post("/api/slots/1/summary", {});
    const back = (await backRes.json()) as { summary?: string; model?: string; backend?: string; usage?: unknown };
    check("FLEET_WORKER_ROUTE_SUMMARY=claude preserves the old summary path and response defaults",
      backRes.ok && back.summary === "fake summary of the session" && back.backend === undefined
      && back.usage === undefined && back.model !== "gpt-5.3-codex-spark", JSON.stringify(back));
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
