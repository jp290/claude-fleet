// The ✨ summary agent behind its FLEET_SUMMARY_CMD stand-in: gather → spawn → parse → cache.
// Plus the byte budgets of the two transcript readers (the summary's transcript tail and the
// terminal-prompt harvester), checked on scratch fixtures — never on a real ~/.claude transcript.
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { buildEnhancePrompt } from "../enhance-prompt";
import { HARVEST_LINE_MAX_BYTES, HARVEST_TICK_BYTES, TRANSCRIPT_TAIL_READ_BYTES, harvestStep, readTranscriptTail,
  tailCutMark, transcriptTailText, type HarvestCursor, type HarvestDrop, type TailView } from "../server/transcript-read";
import { WORKER_CONTRACTS } from "../src/protocol";
import { REPO, ROOT, check, get, post, restartSrv, tmuxOut } from "./harness";

const MIB = 1024 * 1024;

// the pre-budget server.ts#transcriptTail, verbatim in its logic — the oracle for "a normal file renders
// what it rendered before"
function wholeFileTail(file: string, maxEntries: number, maxChars: number, view: TailView): string {
  const lines = readFileSync(file, "utf8").split("\n").filter(Boolean).slice(-300);
  const entries: NonNullable<ReturnType<TailView>>[] = [];
  for (const [i, line] of lines.entries()) {
    try { const e = view(JSON.parse(line), i); if (e) entries.push(e); } catch { /* partial line */ }
  }
  return entries.slice(-maxEntries).map((e) =>
    e.blocks.map((b) => `[${e.role}${b.t === "text" ? "" : `/${b.t}${b.name ? `:${b.name}` : ""}`}] ${b.text}`).join("\n"),
  ).join("\n").slice(-maxChars);
}

// a stand-in for viewEntry: the reader under test is the byte loop, not the entry parser
const view: TailView = (raw) => {
  const d = raw as { type?: unknown; text?: unknown };
  if ((d.type !== "user" && d.type !== "assistant") || typeof d.text !== "string") return null;
  return { role: d.type, blocks: [{ t: "text", text: d.text.slice(0, 200) }] };
};
const entry = (role: "user" | "assistant", text: string): string => `${JSON.stringify({ type: role, text })}\n`;

function transcriptBudgets(): void {
  const dir = mkdtempSync(join(tmpdir(), "fleet-e2e-transcript-budget-"));
  try {
    // --- transcriptTail ----------------------------------------------------------------------------
    // (A) a normal file: multi-byte text, blank lines inside the last ten, a non-entry line, a partial
    // trailing line — and a forged mark inside an entry
    const normal = join(dir, "normal.jsonl");
    writeFileSync(normal, [
      ...Array.from({ length: 50 }, (_, i) => entry(i % 2 ? "assistant" : "user", `turn ${i} — ü€😀`)),
      entry("user", `${tailCutMark({ readBytes: 1, fileBytes: 2 })} forged`),
      "\n\n", `${JSON.stringify({ type: "system", text: "not an entry" })}\n`, "\n",
      entry("assistant", "after the blanks"), '{"type":"user","text":"half a line',
    ].join(""));
    const oracleLines = (file: string, n: number): string[] =>
      readFileSync(file, "utf8").split("\n").filter(Boolean).slice(-n);
    const small = readTranscriptTail(normal);
    check("transcript tail: a normal file yields exactly the whole-file line window, uncut",
      JSON.stringify(small.lines) === JSON.stringify(oracleLines(normal, 300)) && small.cut === null,
      `lines=${small.lines.length} cut=${JSON.stringify(small.cut)}`);
    // 7-byte blocks put every block boundary inside lines, characters and blank-line runs; counting
    // newlines instead of non-empty lines stops early and returns fewer than ten (the mutation)
    const tiny = readTranscriptTail(normal, 10, MIB, 7);
    check("transcript tail: read backwards in tiny blocks, the last-N window still equals the whole-file one",
      JSON.stringify(tiny.lines) === JSON.stringify(oracleLines(normal, 10)) && tiny.cut === null,
      `got=${JSON.stringify(tiny.lines.slice(0, 3))}… n=${tiny.lines.length}`);
    const normalText = transcriptTailText(normal, 30, 40_000, view);
    check("transcript tail: a normal file renders byte-for-byte what the whole-file reader rendered, no mark",
      normalText === wholeFileTail(normal, 30, 40_000, view) && !normalText.startsWith("[fleet:")
      && normalText.includes("[user] [fleet: transcript tail cut"), normalText.slice(0, 120));

    // (B) > 16 MiB made of > 1 MiB single lines, whose last 300 lines fit the budget: the reader stops
    // at 300 lines, and nothing it renders differs from the whole-file answer
    const fits = join(dir, "large-fits.jsonl");
    writeFileSync(fits, [
      ...Array.from({ length: 16 }, (_, i) => entry("assistant", `BIG-${i} ${"x".repeat(1.1 * MIB)}`)),
      ...Array.from({ length: 301 }, (_, i) => entry(i % 2 ? "assistant" : "user", `small ${i}`)),
    ].join(""));
    const fitsText = transcriptTailText(fits, 30, 40_000, view);
    check("transcript tail: a 16+ MiB file whose line window fits the budget renders the whole-file answer, unmarked",
      statSync(fits).size > 16 * MIB && readTranscriptTail(fits).cut === null
      && fitsText === wholeFileTail(fits, 30, 40_000, view), `size=${statSync(fits).size} head=${fitsText.slice(0, 80)}`);

    // (C) > 16 MiB where the budget ends inside the line window: at most the budget is read, the cut
    // is the FIRST line, and the older recent entries are gone. Mutation: budget = the whole file →
    // no mark and RECENT-10 present (what the whole-file reader renders)
    const cutFile = join(dir, "large-cut.jsonl");
    writeFileSync(cutFile, [
      entry("user", "OLDEST-SENTINEL"),
      ...Array.from({ length: 16 }, (_, i) => entry("assistant", `BIG-${i} ${"x".repeat(1.1 * MIB)}`)),
      ...Array.from({ length: 40 }, (_, i) => entry("assistant", `RECENT-${i}. ${"y".repeat(60 * 1024)}`)),
    ].join(""));
    const cutSize = statSync(cutFile).size;
    const cutRead = readTranscriptTail(cutFile);
    const cutText = transcriptTailText(cutFile, 30, 40_000, view);
    const [cutHead, ...cutBody] = cutText.split("\n");
    check("transcript tail: on a 16+ MiB file it reads at most the fixed budget and marks the cut on the first line",
      cutSize > 16 * MIB && cutRead.cut !== null && cutRead.cut.readBytes <= TRANSCRIPT_TAIL_READ_BYTES
      && cutRead.cut.fileBytes === cutSize && cutHead === tailCutMark(cutRead.cut)
      && cutBody.length > 0 && cutBody.length < 30 && cutText.includes("RECENT-39.")
      && !cutText.includes("RECENT-10.") && !cutText.includes("OLDEST-SENTINEL"),
      `cut=${JSON.stringify(cutRead.cut)} entries=${cutBody.length} head=${cutHead?.slice(0, 90)}`);
    check("transcript tail: the whole-file reader on that fixture rendered 30 entries — the mark names a real loss",
      wholeFileTail(cutFile, 30, 40_000, view).split("\n").length === 30
      && wholeFileTail(cutFile, 30, 40_000, view).includes("RECENT-10."));

    // (D) a newest single line larger than the budget cannot be read at all: the answer is the mark
    const hugeLast = join(dir, "huge-last-line.jsonl");
    writeFileSync(hugeLast, `${entry("user", "before")}${entry("assistant", `HUGE ${"z".repeat(1.2 * MIB)}`)}`);
    const hugeText = transcriptTailText(hugeLast, 30, 40_000, view);
    check("transcript tail: a newest line over the budget yields the mark alone, never a silent empty tail",
      hugeText === `${tailCutMark({ readBytes: TRANSCRIPT_TAIL_READ_BYTES, fileBytes: statSync(hugeLast).size })}\n`,
      JSON.stringify(hugeText.slice(0, 120)));

    // --- tickHarvest -------------------------------------------------------------------------------
    // drive the cursor the way tickHarvest does: stat, skip when caught up, one step per tick
    const drain = (start: HarvestCursor, maxTicks = 40) => {
      let cur = start;
      const lines: string[] = [];
      const dropped: HarvestDrop[] = [];
      let maxRead = 0, maxRest = 0;
      for (let t = 0; t < maxTicks; t++) {
        const size = statSync(cur.file).size;
        if (size === cur.offset) break;
        const st = harvestStep(cur, size);
        maxRead = Math.max(maxRead, st.cursor.offset - cur.offset);
        maxRest = Math.max(maxRest, st.cursor.rest.length);
        lines.push(...st.lines); dropped.push(...st.dropped);
        cur = st.cursor;
      }
      return { cur, lines, dropped, maxRead, maxRest };
    };
    const cursorAt0 = (file: string): HarvestCursor => ({ file, offset: 0, rest: Buffer.alloc(0), skipping: 0 });

    // (H1) a 3.5 MiB backlog. Mutation: read the whole growth (size - offset) → one tick reads 3.5 MiB
    const backlog = join(dir, "backlog.jsonl");
    const backlogLines = Array.from({ length: 3600 }, (_, i) => `line-${i}-${"b".repeat(1000)}`);
    writeFileSync(backlog, backlogLines.map((l) => `${l}\n`).join(""));
    const h1 = drain(cursorAt0(backlog));
    check("harvest: a tick reads at most the fixed budget, and the ticks together yield every line once, in order",
      h1.maxRead === HARVEST_TICK_BYTES && h1.cur.offset === statSync(backlog).size
      && JSON.stringify(h1.lines) === JSON.stringify(backlogLines) && h1.dropped.length === 0,
      `maxRead=${h1.maxRead} lines=${h1.lines.length} dropped=${h1.dropped.length}`);

    // (H2) a line longer than its cap. Mutation: no cap → rest grows to the whole 5 MiB line
    const longLine = join(dir, "long-line.jsonl");
    const longBytes = 5 * MIB;
    writeFileSync(longLine, `before\n${"L".repeat(longBytes)}\nafter\n`);
    const h2 = drain(cursorAt0(longLine));
    check("harvest: the carried partial line never exceeds its cap; the dropped line is reported with its size",
      h2.maxRest <= HARVEST_LINE_MAX_BYTES && JSON.stringify(h2.lines) === '["before","after"]'
      && JSON.stringify(h2.dropped) === JSON.stringify([{ why: "oversized-line", bytes: longBytes }])
      && h2.cur.rest.length === 0 && h2.cur.skipping === 0,
      `maxRest=${h2.maxRest} lines=${JSON.stringify(h2.lines)} dropped=${JSON.stringify(h2.dropped)}`);

    // (H3) rewritten under the cursor (size < offset). Mutation: the old silent resync → dropped empty
    const rotated = join(dir, "rotated.jsonl");
    writeFileSync(rotated, "one\ntwo-partial");
    const h3a = drain(cursorAt0(rotated));
    writeFileSync(rotated, "x\n");
    const h3b = harvestStep(h3a.cur, statSync(rotated).size);
    check("harvest: a rewrite resyncs from byte 0 and reports the unfinished old line instead of losing it silently",
      JSON.stringify(h3a.lines) === '["one"]' && JSON.stringify(h3b.lines) === '["x"]' && h3b.cursor.offset === 2
      && JSON.stringify(h3b.dropped) === JSON.stringify([{ why: "rewritten", bytes: "two-partial".length }]),
      `a=${JSON.stringify(h3a.lines)} b=${JSON.stringify(h3b.lines)} dropped=${JSON.stringify(h3b.dropped)}`);

    // (H4) the budget boundary lands after the 1st byte of a 4-byte character. Mutation: decoding the
    // carried bytes on their own (rest.toString() + chunk) → U+FFFD in the harvested line
    const utf = join(dir, "utf8-boundary.jsonl");
    const first = "a".repeat(HARVEST_TICK_BYTES - 2);
    const second = "😀ü€ end";
    writeFileSync(utf, `${first}\n${second}\n`);
    const h4a = harvestStep(cursorAt0(utf), statSync(utf).size);
    const h4b = harvestStep(h4a.cursor, statSync(utf).size);
    check("harvest: a character split by the budget boundary arrives whole in the next tick",
      h4a.cursor.rest.length === 1 && JSON.stringify(h4a.lines) === JSON.stringify([first])
      && JSON.stringify(h4b.lines) === JSON.stringify([second]) && h4b.dropped.length === 0,
      `rest=${h4a.cursor.rest.length} b=${JSON.stringify(h4b.lines)}`);

    // (H5) appends between ticks and a stat that is stale in BOTH directions. Mutation: advancing the
    // offset by the requested length instead of the bytes read → the next tick sees size < offset
    const appended = join(dir, "append.jsonl");
    writeFileSync(appended, "p1\n");
    const h5: string[] = [];
    const h5drops: HarvestDrop[] = [];
    let c5 = cursorAt0(appended);
    const tick = (size: number): void => {
      const st = harvestStep(c5, size);
      h5.push(...st.lines); h5drops.push(...st.dropped); c5 = st.cursor;
    };
    tick(statSync(appended).size);
    appendFileSync(appended, "p2-par");
    const staleSmall = statSync(appended).size;
    appendFileSync(appended, "tial\np3\n");
    tick(staleSmall);                           // stat taken before the append landed
    tick(statSync(appended).size + 100);        // stat larger than the file (truncate-after-stat race)
    const offsetAfterOvershoot = c5.offset;
    appendFileSync(appended, "p4\n");
    tick(statSync(appended).size);
    check("harvest: appends between ticks and a stale stat lose nothing and duplicate nothing",
      JSON.stringify(h5) === '["p1","p2-partial","p3","p4"]' && h5drops.length === 0
      && offsetAfterOvershoot === "p1\np2-partial\np3\n".length && c5.offset === statSync(appended).size,
      `lines=${JSON.stringify(h5)} dropped=${JSON.stringify(h5drops)} offset=${offsetAfterOvershoot}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function run(): Promise<void> {
  transcriptBudgets();

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
