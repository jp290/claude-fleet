// Worktree lanes, the base layer: create/diff/land, the one-click /api/lanes route, the worktrees
// map, the land gate against a busy pane, and the integration-branch config.
import { spawnSync } from "node:child_process";
import { lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { ROOT, REPO, check, get, post, tmuxOut } from "./harness";
import type { LaneCtx } from "./ctx";
import { MERGE_IDLE_MS, exists, settleForMerge } from "./lane-helpers";

// newest-first ledger → the first row for a unique lane branch is its terminal record
const outcomeFor = async (branch: string): Promise<Record<string, unknown> | undefined> =>
  ((await (await get("/api/lane-outcomes?limit=1000")).json()) as { outcomes: Record<string, unknown>[] })
    .outcomes.find((o) => o.branch === branch);

export async function run(lc: LaneCtx): Promise<void> {
  const wtOpen = await post("/api/slots/5/open-worktree", { repo: REPO, branch: "e2e-lane" });
  const wtJson = (await wtOpen.json()) as { ok?: boolean; branch?: string; error?: string };
  check("open-worktree creates a lane", wtOpen.ok && wtJson.branch === "e2e-lane", JSON.stringify(wtJson));
  const wtDir = `${REPO}.worktrees/e2e-lane`;
  const wtEnv = `${wtDir}/.env`;
  // guarded through exists() rather than a bare statSync: if open-worktree failed above, an ENOENT
  // thrown while evaluating check()'s ARGUMENTS escapes the whole run and takes every later result
  // with it — one missing lane must cost one FAIL, not the suite's report.
  check("worktree dir materialized on disk", exists(wtDir) && statSync(wtDir).isDirectory());
  check("untracked .env copied into the worktree", exists(wtEnv) && statSync(wtEnv).isFile());
  // SEC-12: the copy is the one path that deliberately carries .env into every lane, so it must
  // land 0600 regardless of the source's mode (the live source was 0644 when this was written)
  const wtEnvMode = ((): number => { try { return statSync(wtEnv).mode & 0o777; } catch { return -1; } })();
  check("copied .env is owner-only (0600)", wtEnvMode === 0o600, wtEnvMode === -1 ? "missing" : wtEnvMode.toString(8));
  const wtRefused = await post("/api/slots/5/open-worktree", { repo: REPO, branch: "e2e-lane" });
  check("open-worktree on an active slot is refused", wtRefused.status === 400);

  // --- a LANE can name its harness too, and it travels a different road than a plain session's:
  // the route hands it to openLaneInSlot, which hands it on to openSlot. Two extra parameter hops
  // is exactly where a choice gets silently dropped, and a dropped harness is invisible — the lane
  // simply comes up as claude and nobody is told. So the pane's own command line is the assertion.
  // (The DEFAULT stays default for anything a tick spawns; that bolt is pinned in e2e/pins.ts.)
  await post("/api/slots/7/kill", {}); // ensure the slot is free before opening (suite convention)
  const hw = await post("/api/slots/7/open-worktree", { repo: REPO, branch: "e2e-lane-pi", harness: "pi", effort: "high" });
  check("open-worktree accepts a harness for a hand-started lane", hw.ok, String(hw.status));
  const hwCmd = (await tmuxOut("display-message", "-p", "-t", "s7", "#{pane_start_command}")).out;
  check("a lane spawned with harness=pi actually runs pi, with its session pinned and effort passed",
    /(^|\s|;)pi --session-id [0-9a-f-]{36}\b/.test(hwCmd) && hwCmd.includes("--thinking high"), hwCmd.slice(-160));
  // ...and it runs it BARE. Full local access is the owner decision of 2026-08-12: the fence that
  // used to wrap this line (sandbox-exec; ~/.claude, off-lane and lane .git denied) is retired,
  // so the assertion FLIPS — the spawn line must carry no sandbox machinery at all. There is no
  // profile left to execute: the agent process runs with the owner's own reach by construction,
  // which is exactly what the old canaries proved the fence prevented.
  const hwFlat = hwCmd.replaceAll("\\", "");
  check("the pi lane's spawn line is bare — no sandbox-exec, no fence variable, full local access",
    !hwFlat.includes("sandbox-exec") && !hwFlat.includes("FLEET_PI_SB")
      && /(^|\s|;)pi --session-id/.test(hwFlat), hwFlat.slice(-160));
  await post("/api/slots/7/kill", {});
  spawnSync("git", ["worktree", "remove", "--force", `${REPO}.worktrees/e2e-lane-pi`], { cwd: REPO });
  // ...and the same road for the container harness, which is the one where the lane path MATTERS:
  // its whole cut is that git stays host-local while only the agent moves into the box, so a lane
  // is its primary shape. `-w "$PWD"` is what carries the worktree's own path in — the pane's cwd
  // is the host worktree, and the mount must be at that same path.
  const hc = await post("/api/slots/7/open-worktree", { repo: REPO, branch: "e2e-lane-container", harness: "container" });
  check("open-worktree accepts the container harness for a hand-started lane", hc.ok, String(hc.status));
  // backslashes stripped: tmux re-quotes pane_start_command for display and escapes `"` and `$`,
  // so the raw capture reads `-w \"\$PWD\"`. Nothing else in this line carries a backslash.
  const hcCmd = (await tmuxOut("display-message", "-p", "-t", "s7", "#{pane_start_command}")).out.replaceAll("\\", "");
  check("a lane spawned with harness=container execs into the container at the lane's own cwd",
    hcCmd.includes(`docker --context 'default' exec -it -w "$PWD" 'fleet' `), hcCmd.slice(-160));
  await post("/api/slots/7/kill", {});
  spawnSync("git", ["worktree", "remove", "--force", `${REPO}.worktrees/e2e-lane-container`], { cwd: REPO });
  // ...and the ONE-CLICK lane route, which is a THIRD road to the same choice: /api/lanes picks the
  // free slot itself, so the harness travels body → harnessIdOf → openLaneInSlot → openSlot without
  // a slot id anywhere in it. The two routes are asserted separately on purpose — a harness dropped
  // on one of them is invisible on the other, and invisible either way from the response, which is
  // why the assertion is the PANE's command line rather than the 200.
  const lnRes = await post("/api/lanes", { repo: REPO, harness: "codex", model: "gpt-5-codex" });
  const lnJson = (await lnRes.json()) as { slot?: number; cwd?: string; form?: string; error?: string };
  check("POST /api/lanes accepts a harness and a model for the codex adapter", lnRes.ok && !!lnJson.slot, JSON.stringify(lnJson));
  if (lnJson.slot) {
    const lnCmd = (await tmuxOut("display-message", "-p", "-t", `s${lnJson.slot}`, "#{pane_start_command}")).out;
    const lnFlat = lnCmd.replaceAll("\\", "");
    check("a lane spawned with harness=codex runs codex full-access, disables startup update checks, and passes --model",
      /(^|\s|;)codex --dangerously-bypass-approvals-and-sandbox/.test(lnFlat)
      && lnFlat.includes("-c check_for_update_on_startup=false")
      && lnFlat.includes("--model 'gpt-5-codex'"), lnFlat.slice(-220));
    // the trust prelude rides the same line: without the persisted per-path entry codex blocks on
    // its own "Do you trust this directory?" prompt (measured 2026-08-12 — the bypass flag does
    // NOT cover it) and an unattended brief lands in a dead prompt instead of an agent
    check("the codex spawn line writes the lane's trust entry before starting codex",
      lnFlat.includes('trust_level = "trusted"') && lnFlat.indexOf("trust_level") < lnFlat.indexOf("codex --dangerously"),
      lnFlat.slice(0, 200));
    // THE TEXT-LANE MCP PROFILE (Slot.browser, 2026-09-14): a lane that names no browser starts codex with
    // the FULL playwright server definition switched off — the only override measured to leave no
    // Playwright children (server.ts#CODEX_TEXT_LANE_MCP). Every other -c key stays as it was.
    check("a codex lane with no browser need spawns with the playwright MCP override (enabled=false)",
      lnFlat.includes(`-c 'mcp_servers.playwright={command="npx",args=["@playwright/mcp@latest"],enabled=false}'`),
      lnFlat.slice(-260));
    // --- THE ADAPTER NO LONGER PREFERS A FORM. Clone existed to keep a codex lane's repository
    // inside a write sandbox; the 2026-08-12 full-access spawn erects none, so a request that
    // names no form falls through to the default worktree — same shape as every other lane, and
    // its slot record carries no form key (the non-regression row below pins that shape for the
    // default adapter; this asserts codex now shares it). The `.git` ENTRY on disk is the
    // assertion, not the route's `form` field.
    const lnCwd = lnJson.cwd ?? "";
    check("a codex lane that names no form is a WORKTREE again — no adapter clone preference is left",
      lnJson.form === "worktree" && exists(`${lnCwd}/.git`) && lstatSync(`${lnCwd}/.git`).isFile(),
      `${lnJson.form} @ ${lnCwd}`);
    const lnState = ((await Bun.file(`${ROOT}/fleet.json`).json()) as
      { slots: Record<string, { worktree?: { form?: string } } | undefined> }).slots[String(lnJson.slot)];
    check("the default worktree form stores NO form key on the slot record (byte-identical shape)",
      !!lnState?.worktree && !("form" in lnState.worktree), JSON.stringify(lnState?.worktree));
    const lnSess = (await (await get("/api/sessions")).json()) as { slots: { id: number; worktree: { branch: string } | null }[] };
    const lnBranch = lnSess.slots.find((x) => x.id === lnJson.slot)?.worktree?.branch ?? "";
    await post(`/api/slots/${lnJson.slot}/kill`, {});
    // modelResolved answers only for an UNPINNED codex lane: this one named its model, so the row has
    // no such key — `model` already is the answer
    const lnRec = (await outcomeFor(lnBranch)) ?? {};
    check("outcome: a codex lane WITH a model pin carries no modelResolved key",
      lnRec.model === "gpt-5-codex" && !("modelResolved" in lnRec), JSON.stringify(lnRec));
    if (lnCwd) spawnSync("git", ["worktree", "remove", "--force", lnCwd], { cwd: REPO });
    if (lnBranch) spawnSync("git", ["branch", "-qD", lnBranch], { cwd: REPO });
  }
  // ...and the form stays a CALLER OPTION: an explicit `form: "clone"` must still produce a clone
  // even though no adapter prefers one anymore. If this ever flips to "the adapter overrules the
  // caller", the field has quietly become a capability and the 400 is the honest shape instead.
  const lnW = (await (await post("/api/lanes", { repo: REPO, harness: "codex", form: "clone" })).json()) as
    { slot?: number; cwd?: string; branch?: string; form?: string };
  check("an explicit form:clone still wins over the default (a preference, not a capability)",
    lnW.form === "clone" && exists(`${lnW.cwd ?? ""}/.git`) && lstatSync(`${lnW.cwd}/.git`).isDirectory(),
    `${lnW.form} @ ${lnW.cwd}`);
  if (lnW.slot) await post(`/api/slots/${lnW.slot}/kill`, {});
  // an unpinned codex lane that never bound a session has no rollout to read: the key is PRESENT and
  // null — never ~/.codex/config.toml's default, which Fleet would be guessing
  const lnWRec = (await outcomeFor(lnW.branch ?? "")) ?? {};
  check("outcome: an unpinned codex lane with no bound rollout records modelResolved null (key present)",
    lnWRec.model === null && "modelResolved" in lnWRec && lnWRec.modelResolved === null, JSON.stringify(lnWRec));
  // ...and every rollout-read field on the same row is an unknown, not a zero: no rollout, no measurement
  check("outcome: a codex lane with no bound rollout records sessionMs, toolResultBytes, effortObserved and subagentCount as null (keys present)",
    lnWRec.sessionMs === null && lnWRec.toolResultBytes === null
    && "effortObserved" in lnWRec && lnWRec.effortObserved === null
    && "subagentCount" in lnWRec && lnWRec.subagentCount === null, JSON.stringify(lnWRec));
  // a clone is an ordinary directory, NOT a worktree of REPO — remove it directly and delete the
  // branch it mirrored back into REPO at spawn
  if (lnW.cwd) rmSync(lnW.cwd, { recursive: true, force: true });
  if (lnW.branch) spawnSync("git", ["branch", "-qD", lnW.branch], { cwd: REPO });
  // ...and the BROWSER lane on codex: browser:true keeps the ambient MCP set, so the line carries no
  // playwright override at all — the half that makes "Default AUS" a choice rather than a removal.
  const lnB = (await (await post("/api/lanes", { repo: REPO, harness: "codex", browser: true })).json()) as
    { slot?: number; cwd?: string; branch?: string; error?: string };
  check("POST /api/lanes accepts browser:true for the codex adapter", !!lnB.slot, JSON.stringify(lnB));
  if (lnB.slot) {
    const lnBFlat = (await tmuxOut("display-message", "-p", "-t", `s${lnB.slot}`, "#{pane_start_command}")).out.replaceAll("\\", "");
    check("MCP profile precondition: the codex browser lane's pane carries the codex line",
      /(^|\s|;)codex --dangerously-bypass-approvals-and-sandbox/.test(lnBFlat), lnBFlat.slice(-160) || "no pane command");
    check("a codex lane with browser:true spawns WITHOUT the playwright override (ambient MCPs kept)",
      !lnBFlat.includes("mcp_servers.playwright"), lnBFlat.slice(-260));
    // modelResolved, positive half, on this lane because it is UNPINNED and already exists (a second
    // codex spawn would boot one more host agent). A synthetic rollout under the suite's scratch
    // FLEET_CODEX_SESSIONS_DIR, bound through the owner route, carrying two turn_context records with
    // different models and a torn line between them: the NEWEST record's model is the answer.
    const codexRoot = process.env.FLEET_CODEX_SESSIONS_DIR ?? "";
    const lnBCwd = ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
      .slots.find((x) => x.id === lnB.slot)?.cwd ?? "";
    const SID = "30000000-0000-4000-8000-00000000000c";
    const d = new Date();
    const rDir = `${codexRoot}/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    const rFile = `${rDir}/rollout-${Date.now()}-${SID}.jsonl`;
    // The same rollout carries the other codex outcome sensors: record timestamps 90 s apart (sessionMs),
    // one output of each payload kind attributed by call_id plus one whose call is not in the file
    // (toolResultBytes), and an effort that changes between the two turn_contexts (effortObserved). Next
    // to it, subagent rollouts: two naming SID as spawn parent, one naming a stranger, and one torn first
    // record that never mentions SID — which must be skipped, not turned into an unknown.
    const T0 = Date.now() - 120_000;
    const at = (ms: number): string => new Date(T0 + ms).toISOString();
    const patchOut = [{ type: "input_text", text: "Success. Updated the following files" }];
    const SUB = ["30000000-0000-4000-8000-00000000001a", "30000000-0000-4000-8000-00000000001b",
      "30000000-0000-4000-8000-00000000001c", "30000000-0000-4000-8000-00000000001d"];
    const subMeta = (id: string, parent: string): string => JSON.stringify({ timestamp: at(30_000), type: "session_meta",
      payload: { id, cwd: lnBCwd, timestamp: at(30_000), thread_source: "subagent", parent_thread_id: parent,
        source: { subagent: { thread_spawn: { parent_thread_id: parent, depth: 1, agent_path: "/root/x" } } } } }) + "\n";
    const subFiles = SUB.map((id) => `${rDir}/rollout-${T0}-${id}.jsonl`);
    if (codexRoot && lnBCwd) {
      mkdirSync(rDir, { recursive: true });
      writeFileSync(rFile, [
        JSON.stringify({ timestamp: at(0), type: "session_meta", payload: { id: SID, cwd: lnBCwd, timestamp: new Date().toISOString(),
          thread_source: "user", originator: "codex-tui" } }),
        JSON.stringify({ timestamp: at(1_000), type: "turn_context", payload: { cwd: lnBCwd, model: "fixture-model-early", effort: "high" } }),
        JSON.stringify({ timestamp: at(2_000), type: "response_item", payload: { type: "function_call", call_id: "c1", name: "exec_command", arguments: "{}" } }),
        JSON.stringify({ timestamp: at(3_000), type: "response_item", payload: { type: "function_call_output", call_id: "c1", output: "0123456789" } }),
        '{"type":"turn_context", torn',
        JSON.stringify({ timestamp: at(4_000), type: "response_item", payload: { type: "custom_tool_call", call_id: "c2", name: "apply_patch", input: "x" } }),
        JSON.stringify({ timestamp: at(5_000), type: "response_item", payload: { type: "custom_tool_call_output", call_id: "c2", output: patchOut } }),
        JSON.stringify({ timestamp: at(6_000), type: "response_item", payload: { type: "function_call_output", call_id: "gone", output: "üü" } }),
        JSON.stringify({ timestamp: at(90_000), type: "turn_context", payload: { cwd: lnBCwd, model: "fixture-model-late", effort: "medium" } }),
      ].join("\n") + "\n");
      writeFileSync(subFiles[0], subMeta(SUB[0], SID));
      writeFileSync(subFiles[1], subMeta(SUB[1], SID));
      writeFileSync(subFiles[2], subMeta(SUB[2], "30000000-0000-4000-8000-0000000000ff"));
      writeFileSync(subFiles[3], '{"type":"session_meta", torn\n');
    }
    const bind = await post(`/api/slots/${lnB.slot}/codex-bind`, { sessionId: SID });
    check("modelResolved fixture: the synthetic rollout binds to the unpinned codex lane",
      !!codexRoot && bind.ok, `${codexRoot} ${bind.status} ${await bind.text()}`);
    await post(`/api/slots/${lnB.slot}/kill`, {});
    const lnBRec = (await outcomeFor(lnB.branch ?? "")) ?? {};
    check("outcome: an unpinned codex lane records modelResolved from its rollout's NEWEST turn_context",
      lnBRec.model === null && lnBRec.modelResolved === "fixture-model-late", JSON.stringify(lnBRec));
    check("outcome: a codex lane's sessionMs is its rollout's last minus first record timestamp",
      lnBRec.sessionMs === 90_000, JSON.stringify(lnBRec.sessionMs));
    const trb = lnBRec.toolResultBytes as { total?: number; byTool?: Record<string, number> } | null | undefined;
    const patchBytes = Buffer.byteLength(JSON.stringify(patchOut), "utf8");
    check("outcome: a codex lane's toolResultBytes sums both output kinds, by call name, orphan under \"?\", torn line skipped",
      trb?.byTool?.exec_command === 10 && trb.byTool.apply_patch === patchBytes && trb.byTool["?"] === 4
      && trb.total === 14 + patchBytes && Object.keys(trb.byTool).length === 3, JSON.stringify(trb));
    check("outcome: a codex lane's effortObserved is the NEWEST turn_context effort, not an earlier turn's",
      lnBRec.effortObserved === "medium", JSON.stringify(lnBRec.effortObserved));
    check("outcome: a codex lane's subagentCount counts only rollouts naming it as spawn parent (stranger + torn skipped)",
      lnBRec.subagentCount === 2, JSON.stringify(lnBRec.subagentCount));
    rmSync(rFile, { force: true }); // later codex families count candidates under the same root
    for (const f of subFiles) rmSync(f, { force: true });
  }
  if (lnB.cwd) spawnSync("git", ["worktree", "remove", "--force", lnB.cwd], { cwd: REPO });
  if (lnB.branch) spawnSync("git", ["branch", "-qD", lnB.branch], { cwd: REPO });
  // the adapters the profile does NOT apply to answer 400 BEFORE a working copy exists, each naming its
  // disposition — refused, never dropped: a browser the owner asked for and the pane never had is the
  // same failure an ignored effort is. Plus the malformed value, which must not coerce to either profile.
  for (const [body, want] of [
    [{ harness: "pi", browser: true }, "harness pi takes no browser profile (not-applicable)"],
    [{ harness: "container", browser: true }, "harness container takes no browser profile (unsupported)"],
    [{ browser: "yes" }, "browser must be a boolean"],
  ] as const) {
    const r = await post("/api/lanes", { repo: REPO, ...body });
    const rj = (await r.json()) as { error?: string };
    check(`POST /api/lanes refuses ${JSON.stringify(body)} with 400 and its reason`,
      r.status === 400 && rj.error === want, `${r.status} ${JSON.stringify(rj)}`);
  }
  // THE NON-REGRESSION ROW, and the most important one here: a lane with no harness is still a
  // worktree AND its persisted record carries no `form` key at all. The absence is the assertion —
  // every lane that predates this field must serialize byte-identically, or a state file written by
  // this server reads as a different shape to every reader of the old one.
  const lnD = (await (await post("/api/lanes", { repo: REPO })).json()) as
    { slot?: number; cwd?: string; branch?: string; form?: string };
  const lnDState = ((await Bun.file(`${ROOT}/fleet.json`).json()) as
    { slots: Record<string, { worktree?: Record<string, unknown> } | undefined> }).slots[String(lnD.slot)];
  check("a lane with no harness is a worktree, and its slot record carries NO form key (the shape is unchanged)",
    lnD.form === "worktree" && exists(`${lnD.cwd ?? ""}/.git`) && lstatSync(`${lnD.cwd}/.git`).isFile()
    && !!lnDState?.worktree && !("form" in lnDState.worktree),
    `${lnD.form} / ${JSON.stringify(lnDState?.worktree)}`);
  if (lnD.slot) await post(`/api/slots/${lnD.slot}/kill`, {});
  // the control for the codex rollout sensors: a default-adapter lane's row gains none of their keys
  const lnDRec = (await outcomeFor(lnD.branch ?? "")) ?? {};
  check("outcome: a default-adapter (claude) lane carries no effortObserved / subagentCount / modelResolved key",
    lnDRec.harness === null && !("effortObserved" in lnDRec) && !("subagentCount" in lnDRec) && !("modelResolved" in lnDRec),
    JSON.stringify(lnDRec));
  if (lnD.cwd) spawnSync("git", ["worktree", "remove", "--force", lnD.cwd], { cwd: REPO });
  const sessWt = (await (await get("/api/sessions")).json()) as { slots: { id: number; worktree: { branch: string } | null }[] };
  check("slot 5 tagged as a worktree lane", sessWt.slots[4].worktree?.branch === "e2e-lane", JSON.stringify(sessWt.slots[4].worktree));
  // the copied .env is gitignored in the test repo, so it must NOT show as dirty — a fresh
  // lane has to be clean, or `land` would be permanently blocked by scaffolding files
  const freshDiff = (await (await get("/api/slots/5/diff")).json()) as { status: string[] };
  check("fresh lane is clean (gitignored .env copy not counted dirty)", freshDiff.status.length === 0, JSON.stringify(freshDiff.status));

  // ...and the same must hold for scratch a HARNESS throws into the lane's cwd: Playwright-MCP
  // writes `.playwright-mcp/` wherever it was started, and one untracked directory is enough to
  // pin dirty>0 forever — which is `done-looking`'s clean-tree clause (lane-signals.ts), the
  // clean-tree step of `selfLandTaskForMain`, and the owner's land path, all three. So createWorktree
  // excludes the known patterns at spawn. Written as a DIRECTORY with a file in it, because that is
  // the live shape and because `git status` never reports an empty directory at all — asserting on
  // an empty one would pass with the mechanism ripped out.
  mkdirSync(`${wtDir}/.playwright-mcp`, { recursive: true });
  await Bun.write(`${wtDir}/.playwright-mcp/trace.json`, "{}\n");
  const scratchDiff = (await (await get("/api/slots/5/diff")).json()) as { status: string[] };
  check("harness tool scratch thrown into a lane does not make it dirty",
    scratchDiff.status.length === 0, JSON.stringify(scratchDiff.status));
  // the counter-probe, and it is the half that keeps the check honest: an exclude wide enough to
  // swallow real work would pass the line above just as well. A plain untracked file must still
  // count, or the lane would land with work it never committed.
  await Bun.write(`${wtDir}/real-work.txt`, "uncommitted\n");
  const realDirty = (await (await get("/api/slots/5/diff")).json()) as { status: string[] };
  check("a real untracked working file still counts as dirty",
    realDirty.status.some((l) => l.includes("real-work.txt")), JSON.stringify(realDirty.status));
  rmSync(`${wtDir}/real-work.txt`, { force: true });
  // done-looking's clean-tree clause reads the same git the diff route does — assert it on the
  // predicate's own input, with the scratch dir still on disk, so the fix is proven where it failed.
  const scratchGit = spawnSync("git", ["-C", wtDir, "status", "--porcelain"], { encoding: "utf8" });
  check("done-looking's clean-tree clause can fire with tool scratch present",
    scratchGit.status === 0 && scratchGit.stdout === "", JSON.stringify(scratchGit.stdout));

  // diff endpoint: make a tracked change in the lane, expect it in the diff
  await Bun.write(`${wtDir}/code.txt`, "root\nlane-edit\n");
  const diff = (await (await get("/api/slots/5/diff")).json()) as { branch: string; status: string[]; diff: string };
  check("diff endpoint reports branch + changed file", diff.branch === "e2e-lane" && diff.status.some((l) => l.includes("code.txt")), JSON.stringify(diff.status));
  check("diff endpoint returns the tracked change", diff.diff.includes("lane-edit"));
  check("diff rejects non-git slot", (await get("/api/slots/2/diff")).status === 400);

  // land refuses a dirty lane
  const landDirty = await post("/api/slots/5/land", {});
  check("land refuses a dirty worktree", landDirty.status === 409, `status ${landDirty.status}`);

  // commit the change → still no upstream, but the branch is at a commit ahead of HEAD,
  // so land must still refuse (unpushed + not merged)
  spawnSync("git", ["-C", wtDir, "commit", "-aqm", "lane work"]);
  const landUnpushed = await post("/api/slots/5/land", {});
  check("land refuses unpushed commits", landUnpushed.status === 409, `status ${landUnpushed.status}`);

  // pushing the lane to a remote (WITHOUT -u/upstream) must make land succeed — the work is
  // preserved on the remote even though @{push} is unresolvable. Regression for the
  // over-strict no-upstream fallback.
  const bare = `${REPO}.remote.git`;
  spawnSync("git", ["init", "--bare", "-q", bare]);
  spawnSync("git", ["-C", wtDir, "remote", "add", "origin", bare]);
  spawnSync("git", ["-C", wtDir, "push", "-q", "origin", "e2e-lane"]); // no -u: creates refs/remotes/origin/*
  const landPushed = await post("/api/slots/5/land", {});
  check("land accepts a lane pushed to a remote (no upstream set)", landPushed.ok, await landPushed.text());
  check("pushed lane removed from disk", !((): boolean => { try { return statSync(wtDir).isDirectory(); } catch { return false; } })());

  // a lane clean AND merged into HEAD (fresh lane at HEAD) lands cleanly. Open a second one.
  const wt2 = await post("/api/slots/6/open-worktree", { repo: REPO, branch: "e2e-clean" });
  check("second clean lane opens", wt2.ok);
  const landClean = await post("/api/slots/6/land", {});
  check("land removes a clean, merged lane", landClean.ok, await landClean.text());
  check("landed slot is now inactive", (await (await get("/api/sessions")).json() as { slots: { cwd: string | null }[] }).slots[5].cwd === null);
  check("landed worktree removed from disk", !((): boolean => { try { return statSync(`${REPO}.worktrees/e2e-clean`).isDirectory(); } catch { return false; } })());
  check("land rejects a non-worktree slot", (await post("/api/slots/2/land", {})).status === 400);

  // --- lane lifecycle v2: worktrees map, one-click lanes, orphan flows, ⏫ merge agent ---

  // one-click lane: the server picks the free slot and auto-names the branch
  const ln1res = await post("/api/lanes", { repo: REPO });
  const ln1 = (await ln1res.json()) as { ok?: boolean; slot?: number; branch?: string; cwd?: string; error?: string };
  check("POST /api/lanes creates a lane in a server-picked free slot",
    ln1res.ok && typeof ln1.slot === "number" && (ln1.branch ?? "").startsWith("fleet/"), JSON.stringify(ln1));
  const lnSlot = ln1.slot ?? 0;
  const lnPath = ln1.cwd ?? "";
  lc.lnSlot = lnSlot;
  lc.lnPath = lnPath;
  check("lanes slot is tagged as a worktree lane",
    ((await (await get("/api/sessions")).json()) as { slots: { id: number; worktree: { branch: string } | null }[] })
      .slots.find((x) => x.id === lnSlot)?.worktree?.branch === ln1.branch);

  // the lane map: repo-wide worktree list with slot attribution, queryable FROM the lane
  const wm = (await (await get(`/api/slots/${lnSlot}/worktrees`)).json()) as
    { repo: string; main: string; worktrees: { path: string; branch: string; slot: number | null; dirty: number; ahead: number }[] };
  check("worktrees map: primary repo + main branch resolved from a lane slot",
    wm.repo.endsWith("/testrepo") && (wm.main === "main" || wm.main === "master"), JSON.stringify({ repo: wm.repo, main: wm.main }));
  check("worktrees map lists the lane with its holding slot",
    wm.worktrees.some((w) => w.slot === lnSlot && w.branch === ln1.branch), JSON.stringify(wm.worktrees));

  // --- landGate busy block (server.ts merge route, canDeliver idleMs: MERGE_IDLE_MS): a
  // non-confirm land is refused while the pane is ACTIVELY producing output, so an owner never
  // lands mid-work on top of the agent's own trailing changes. Every OTHER merge test calls
  // settleForMerge first, so deleting this gate passes them all — this is the one test that
  // fires the merge WHILE busy. lnSlot is a fresh, clean one-click lane (nothing committed yet →
  // no uncommitted-changes / git-op refusal fires first; the idle gate is what we reach). ---
  {
    // Fire the land WHILE the pane is producing output. Robust against a freshly-spawned lane
    // whose shell isn't yet ready to accept send-keys (the probe would be dropped and the pane
    // read idle): retry send-keys until the server's own clock reports the pane busy well inside
    // MERGE_IDLE_MS, then POST immediately — the eval is one round-trip later, still < the gate.
    const isBusy = async (): Promise<boolean> => {
      const sx = (await (await get("/api/sessions")).json()) as { now: number; slots: { id: number; lastOutput: number }[] };
      const sl = sx.slots.find((x) => x.id === lnSlot);
      return !!sl && sx.now - sl.lastOutput < MERGE_IDLE_MS - 1000; // ≥1s margin before the gate
    };
    let busyConfirmed = false;
    let busyMerge: { status?: string; detail?: string; running?: boolean; landed?: boolean } = {};
    for (let attempt = 0; attempt < 15 && !busyConfirmed; attempt++) {
      await tmuxOut("send-keys", "-t", `s${lnSlot}`, `echo landgate-busy-probe-${attempt}`, "Enter");
      for (let i = 0; i < 12; i++) { // ≤600ms for this probe's output to register (poll runs every 100ms)
        if (await isBusy()) { busyConfirmed = true; break; }
        await Bun.sleep(50);
      }
      if (busyConfirmed)
        busyMerge = (await (await post(`/api/slots/${lnSlot}/merge`, {})).json()) as typeof busyMerge;
    }
    check("landgate setup: the lane pane reads BUSY before the land (non-tautology guard)", busyConfirmed);
    check("land is BLOCKED while the pane is actively working (idle gate), never starting a job",
      busyMerge.status === "blocked" && (busyMerge.detail ?? "").includes("actively working"), JSON.stringify(busyMerge));
    // it must have been the gate, not a spawned job — confirm no merge job is running afterward
    const busyAfter = (await (await get(`/api/slots/${lnSlot}/merge`)).json()) as { running?: boolean; error?: string };
    check("the busy-blocked land started no merge job", busyAfter.running === false, JSON.stringify(busyAfter));
  }

  // --- the 💾 commit route's own idle gate. The mid-run warning used to live ONLY in the client
  // (confirmMidRun), so every other way in — a self-token auto, the raw owner API, a second tab —
  // snapshotted a half-finished tree with no warning at all. The route now runs the same
  // canDeliver(idleMs: MERGE_IDLE_MS) the land path runs, and `confirm` waives it. Deleting the
  // gate does NOT pass this block: a clean lane without the gate answers 200 "nothing to commit",
  // which is exactly what the confirm case below asserts, so the two checks pin both directions. ---
  {
    const isBusy = async (): Promise<boolean> => {
      const sx = (await (await get("/api/sessions")).json()) as { now: number; slots: { id: number; lastOutput: number }[] };
      const sl = sx.slots.find((x) => x.id === lnSlot);
      return !!sl && sx.now - sl.lastOutput < MERGE_IDLE_MS - 1000; // ≥1s margin before the gate
    };
    let busyConfirmed = false;
    let blocked: { committed?: boolean; reason?: string; error?: string } = {};
    let status = 0;
    for (let attempt = 0; attempt < 15 && !busyConfirmed; attempt++) {
      await tmuxOut("send-keys", "-t", `s${lnSlot}`, `echo commitgate-busy-probe-${attempt}`, "Enter");
      for (let i = 0; i < 12; i++) { // ≤600ms for the probe's output to register (100ms poll)
        if (await isBusy()) { busyConfirmed = true; break; }
        await Bun.sleep(50);
      }
      if (busyConfirmed) {
        const r = await post(`/api/slots/${lnSlot}/commit`, { mode: "quick" }); // gate-proof: unconfirmed on purpose
        status = r.status;
        blocked = (await r.json()) as typeof blocked;
      }
    }
    check("commitgate setup: the lane pane reads BUSY before the commit (non-tautology guard)", busyConfirmed);
    check("commit is BLOCKED server-side while the pane is actively working (not client-only)",
      status === 409 && (blocked.reason ?? "").includes("actively working"), `${status} ${JSON.stringify(blocked)}`);
    // and the confirm the client sends once its dialog was acknowledged waives the gate — else a
    // confirmed mid-run save (the whole point of "commit anyway") would bounce off the new gate.
    let confirmedStatus = 0;
    let confirmed: { committed?: boolean; reason?: string } = {};
    for (let attempt = 0; attempt < 15; attempt++) {
      await tmuxOut("send-keys", "-t", `s${lnSlot}`, `echo commitgate-confirm-probe-${attempt}`, "Enter");
      let busy = false;
      for (let i = 0; i < 12; i++) { if (await isBusy()) { busy = true; break; } await Bun.sleep(50); }
      if (!busy) continue;
      const r = await post(`/api/slots/${lnSlot}/commit`, { mode: "quick", confirm: true });
      confirmedStatus = r.status;
      confirmed = (await r.json()) as typeof confirmed;
      break;
    }
    check("a confirmed commit waives the idle gate (reaches the tree, reports on it instead)",
      confirmedStatus === 200 && confirmed.committed === false && !(confirmed.reason ?? "").includes("actively working"),
      `${confirmedStatus} ${JSON.stringify(confirmed)}`);

    // ROT GUARD for the exception above. This gate fires on machine LOAD, not on the tree: any
    // OTHER commit probe that omits `confirm` becomes a flake whose failing check moves from run
    // to run — 4 of the gate's first 16 suite runs, plus two red audits (docs/verify-tiering.md
    // §11.2e). The rule, not a list of today's call sites: a commit POST may omit `confirm` only
    // where it marks itself as the gate's own proof, which is the line a few lines above this one.
    const GATE_PROOF_MARK = "gate-proof: unconfirmed on purpose";
    const offenders: string[] = [];
    let sourceError = "";
    try {
      for (const f of readdirSync(`${ROOT}/e2e`).filter((x) => x.endsWith(".ts"))) {
        readFileSync(`${ROOT}/e2e/${f}`, "utf8").split("\n").forEach((line, i) => {
          if (!/post\([^)]*\/commit["`]/.test(line)) return;
          if (/confirm/.test(line) || line.includes(GATE_PROOF_MARK)) return;
          offenders.push(`${f}:${i + 1}`);
        });
      }
    } catch (e) { sourceError = e instanceof Error ? e.message : String(e); }
    check("precondition: e2e sources are readable for the commit-probe rot guard",
      sourceError === "", sourceError);
    check("every other commit probe in the suite sends confirm (an unconfirmed one is a load-dependent flake)",
      sourceError === "" && offenders.length === 0, offenders.join(", "));
  }

  // --- ✎ message: the agent half of the SAVE may fail, and the fallback to a wip message is
  // RIGHT (a save must never fail on the model) — what was wrong is that it was silent, so the
  // caller could not tell an agent-written subject from a wip one. Kill the message worker and
  // assert both halves: the commit still happens, AND the answer says the message is a fallback. ---
  // Its own throwaway lane, not lnSlot's: lnSlot travels on into e2e/merge.ts, and two extra
  // commits on a shared fixture is the kind of coupling that makes a later module fail for a
  // reason no one can find. Slot 5 is free again here (its e2e-lane landed above).
  {
    const modeDir = REPO.replace(/\/[^/]+$/, "");
    const fbBranch = "e2e-msg-fallback";
    const fbDir = `${REPO}.worktrees/${fbBranch}`;
    const fbOpen = await post("/api/slots/5/open-worktree", { repo: REPO, branch: fbBranch });
    check("throwaway lane for the ✎ message fallback opens", fbOpen.ok, String(fbOpen.status));
    await Bun.write(`${fbDir}/code.txt`, "root\nfallback-probe\n");
    await Bun.write(`${modeDir}/commitfail`, "1");
    const r = await post("/api/slots/5/commit", { mode: "agent", confirm: true });
    const j = (await r.json()) as { committed?: boolean; subject?: string; messageFallback?: boolean };
    await Bun.write(`${modeDir}/commitfail`, "0");
    check("a failed ✎ message still commits (the save never fails on the model)",
      r.ok && j.committed === true && (j.subject ?? "").startsWith("wip:"), `${r.status} ${JSON.stringify(j)}`);
    check("…and it SAYS so: the answer carries messageFallback instead of passing wip off as the agent's work",
      j.messageFallback === true, JSON.stringify(j));
    // the counter-case: a working worker must NOT set the flag, or the flag degrades to noise
    await Bun.write(`${fbDir}/code.txt`, "root\nfallback-probe\nagent-ok-probe\n");
    const r2 = await post("/api/slots/5/commit", { mode: "agent", confirm: true });
    const j2 = (await r2.json()) as { committed?: boolean; subject?: string; messageFallback?: boolean };
    check("a working ✎ message sets no fallback flag",
      r2.ok && j2.committed === true && j2.subject === "feat: stand-in commit message" && j2.messageFallback === undefined,
      `${r2.status} ${JSON.stringify(j2)}`);

    // --- PER-REPO worker override (/api/repo-worker). FLEET_COMMIT_CMD is a module constant read
    // from the server's env, so it is fleet-WIDE: pointing it at a wrapper that ships the diff to
    // a third party would ship EVERY repo's diff there, which is why a finished wrapper could not
    // be switched on. Both halves are asserted by SUBJECT, because subject is the only externally
    // visible difference between the two stand-ins — a resolution that silently ignored the stored
    // entry would otherwise come back as an ordinary passing commit.
    {
      const alt = `${modeDir}/fakecommit2`;
      const canon = realpathSync(REPO);
      const setR = await post("/api/repo-worker", { repo: REPO, worker: "commitMsg", cmd: alt });
      const setJ = (await setR.json()) as { ok?: boolean; repo?: string; cmd?: string | null };
      // the key is CANONICAL, not the spelling the caller used: lanes arrive from createWorktree
      // carrying the symlink-resolved toplevel, so a raw-string key would be written once and
      // never matched again (the dispatch cap and VERIFY_CMD_REPOS canonicalize for this reason)
      check("repo-worker stores a commitMsg override under the CANONICAL repo path",
        setR.ok && setJ.cmd === alt && setJ.repo === canon, `${setR.status} ${JSON.stringify(setJ)} want repo=${canon}`);
      await Bun.write(`${fbDir}/code.txt`, "root\nfallback-probe\nagent-ok-probe\nper-repo-probe\n");
      const r3 = await post("/api/slots/5/commit", { mode: "agent", confirm: true });
      const j3 = (await r3.json()) as { committed?: boolean; subject?: string; messageFallback?: boolean };
      check("a repo WITH an override runs it instead of the fleet-wide FLEET_COMMIT_CMD",
        r3.ok && j3.committed === true && j3.subject === "feat: per-repo stand-in commit message"
        && j3.messageFallback === undefined, `${r3.status} ${JSON.stringify(j3)}`);

      // The value is spawned in ARRAY form with no shell, so anything that is not a bare absolute
      // path to an executable is refused rather than coerced — accepting one would create the
      // pressure to split it here later, which is how a shell gets back into a path that has none.
      const bad: [string, string][] = [
        ["a command line with arguments", `${alt} --model x`],
        ["a shell metacharacter", `${alt};id`],
        ["a relative path (it would resolve against the lane's own tree)", "fakecommit2"],
        ["a .. traversal", `${modeDir}/../${REPO.replace(/^.*\//, "")}/../fakecommit2`],
        ["a file that is not executable", `${ROOT}/package.json`],
        ["a path that does not exist", `${modeDir}/no-such-worker`],
      ];
      for (const [why, cmd] of bad) {
        const rb = await post("/api/repo-worker", { repo: REPO, worker: "commitMsg", cmd });
        check(`repo-worker rejects ${why}`, rb.status === 400, `${rb.status} ${await rb.text()}`);
      }
      // a worker NOTHING consults: storing it would echo back a setting that does nothing, which
      // reads as applied and is worse than a refusal
      const rw = await post("/api/repo-worker", { repo: REPO, worker: "merge", cmd: alt });
      check("repo-worker rejects a worker name nothing resolves through it", rw.status === 400, String(rw.status));
      const rn = await post("/api/repo-worker", { repo: `${modeDir}/definitely-not-a-repo`, worker: "commitMsg", cmd: alt });
      check("repo-worker rejects a path that is not a git repository", rn.status === 400, String(rn.status));
      // every refusal above must have left the GOOD value alone — a rejected write that cleared
      // the stored one would silently move the repo's diffs back to the fleet-wide default
      const rd = (await (await get("/api/repo-workers")).json()) as
        { keys?: string[]; workers?: Record<string, Record<string, string>> };
      check("a rejected value changes nothing: the stored override is still there",
        rd.workers?.[canon]?.commitMsg === alt, JSON.stringify(rd.workers));
      check("...and the read names which workers can be configured at all, so 'no override' is"
        + " distinguishable from 'never wired up'", (rd.keys ?? []).includes("commitMsg"), JSON.stringify(rd.keys));

      // THE COMPATIBILITY HALF, proven rather than asserted: with the entry gone, this repo must
      // behave exactly as it did before the feature existed — the env default, same subject as the
      // check a few lines above.
      const clr = await post("/api/repo-worker", { repo: REPO, worker: "commitMsg", cmd: "" });
      const clrJ = (await clr.json()) as { ok?: boolean; cmd?: string | null };
      check("repo-worker clears an override", clr.ok && clrJ.cmd === null, `${clr.status} ${JSON.stringify(clrJ)}`);
      await Bun.write(`${fbDir}/code.txt`, "root\nfallback-probe\nagent-ok-probe\nper-repo-probe\ncleared-probe\n");
      const r4 = await post("/api/slots/5/commit", { mode: "agent", confirm: true });
      const j4 = (await r4.json()) as { committed?: boolean; subject?: string };
      check("a repo with NO entry is unchanged: back to the fleet-wide env default",
        r4.ok && j4.committed === true && j4.subject === "feat: stand-in commit message", `${r4.status} ${JSON.stringify(j4)}`);
    }
    await post("/api/slots/5/kill", {});
    spawnSync("git", ["worktree", "remove", "--force", fbDir], { cwd: REPO });
    spawnSync("git", ["-C", REPO, "branch", "-qD", fbBranch]);
  }

  // --- integration-branch config (/api/repo-base): overrides the branch derived from the
  // primary's HEAD, so the primary can be parked off the integration branch. Set to a decoy
  // real branch, confirm the worktrees map reports it, then clear back to derived. ---
  {
    spawnSync("git", ["-C", REPO, "branch", "-f", "integ-decoy", "HEAD"]);
    const setBad = await post("/api/repo-base", { repo: REPO, branch: "no-such-branch" });
    check("repo-base rejects a nonexistent branch", setBad.status === 400, String(setBad.status));
    const setOk = (await (await post("/api/repo-base", { repo: REPO, branch: "integ-decoy" })).json()) as { ok?: boolean; base?: string };
    check("repo-base sets the integration branch", setOk.ok === true && setOk.base === "integ-decoy", JSON.stringify(setOk));
    const wmCfg = (await (await get(`/api/slots/${lnSlot}/worktrees`)).json()) as { main: string };
    check("worktrees map reflects the configured integration branch", wmCfg.main === "integ-decoy", wmCfg.main);
    const clr = (await (await post("/api/repo-base", { repo: REPO, branch: "" })).json()) as { base: string | null };
    check("repo-base clears back to derived (null)", clr.base === null, JSON.stringify(clr));
    const wmClr = (await (await get(`/api/slots/${lnSlot}/worktrees`)).json()) as { main: string };
    check("worktrees map derives main again after clear", wmClr.main === "main" || wmClr.main === "master", wmClr.main);
  }
}
