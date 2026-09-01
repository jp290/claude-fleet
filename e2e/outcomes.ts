// The per-lane attributed-outcome ledger: one record per terminal event, the review-staleness
// relation on it, the client-source assertions about how it renders, and the criteria counter.
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { BASE, REPO, ROOT, check, get, post, restartSrv } from "./harness";
import { exists, setMergeMode, settleForMerge, waitMerge } from "./lane-helpers";
import { postLandAlarm } from "../src/plaudit";

export async function run(): Promise<void> {
  // --- per-lane attributed-outcome RECORDER: drive a lane through each terminal event and
  // assert the server-stamped fact reaches GET /api/lane-outcomes. Own throwaway repo so the
  // records are precise and independent of the merge sequence above. ---
  {
    type Outcome = { ts: number; branch: string | null; base: string | null; headSha: string | null;
      disposition: string; model: string | null; briefHash: string | null; shortstat: string;
      // optional at the reader because legacy ledger rows predate all four fields. Fresh lane rows
      // always carry harness/effort (null means default adapter/level); only task lanes carry ids.
      harness?: string | null; effort?: string | null; taskId?: string; originId?: string; programId?: string;
      commitCount: number; filesTouched: string[]; e2eTouched: boolean; verified: boolean | null;
      sessionMs: number | null; ownerPrompts: number;
      resolvedConflict: boolean; repairRounds: number; confirmedByHuman: boolean;
      // optional on purpose, and the checks below depend on it staying that way: a lane with no
      // queue row behind it — and every row written before the field existed — has no answer here
      releasedBy?: "owner" | "machine";
      review?: { state: string; findings?: unknown[]; model?: string; head?: string | null;
        patchId?: string | null; landedPatchId?: string | null;
        // optional here on purpose: rows written before discrepancy-audit F5 was fixed carry none
        // of the three, and the feed's "cannot tell whether this parsed" case depends on that
        scope?: string; notes?: string; raw?: boolean };
      // optional for the same reason: rows predate them, and mainAfter is absent by design on any
      // land that did not move the integration branch
      repo?: string; mainAfter?: string;
      // optional for the same reason again: rows written before the sensor existed carry no key at
      // all, and `null` (measured, unknowable) is a different answer from that absence
      toolResultBytes?: { total: number; byTool: Record<string, number> } | null };
    const readOutcomes = async (): Promise<Outcome[]> =>
      ((await (await get("/api/lane-outcomes?limit=1000")).json()) as { outcomes: Outcome[] }).outcomes;
    // outcomes are newest-first → the first match for a (unique) lane branch is its latest record
    const forBranch = (os: Outcome[], branch: string): Outcome | undefined => os.find((o) => o.branch === branch);

    const oRepo = `${REPO}.outcomes`;
    spawnSync("git", ["init", "-q", "-b", "main", oRepo]); // fakemerge hardcodes `git rebase main`
    spawnSync("git", ["-C", oRepo, "config", "user.email", "e2e@test"]);
    spawnSync("git", ["-C", oRepo, "config", "user.name", "e2e"]);
    await Bun.write(`${oRepo}/seed.txt`, "seed\n");
    spawnSync("git", ["-C", oRepo, "add", "seed.txt"]);
    spawnSync("git", ["-C", oRepo, "commit", "-qm", "seed"]);
    const oBare = `${oRepo}.remote.git`;
    spawnSync("git", ["init", "--bare", "-q", oBare]);

    // MAIN-direct provenance is deliberately not inferred from git history. A plain session
    // declares before work, then the server reads both integration tips around a real commit.
    const sess = (await (await get("/api/sessions")).json()) as { slots: { id: number; cwd?: string | null }[] };
    const mdSlot = sess.slots.find((s) => !s.cwd)?.id ?? 10;
    check("main-direct fixture: a plain MAIN session opens on the test repo",
      (await post(`/api/slots/${mdSlot}/open`, { cwd: oRepo })).ok, String(mdSlot));
    let mdToken = "";
    for (let i = 0; i < 50 && !mdToken; i++) {
      try {
        mdToken = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
          { slots?: Record<string, { selfToken?: string }> }).slots?.[String(mdSlot)]?.selfToken ?? "";
      } catch { /* atomic state rename can race this read; retry */ }
      if (!mdToken) await Bun.sleep(50);
    }
    const mdFetch = (path: string, body?: unknown, method = "POST") => fetch(BASE + path, {
      method, headers: { "content-type": "application/json", "x-fleet-self-token": mdToken },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const pfRes = await mdFetch("/api/self/main-direct/preflight", { repo: oRepo });
    const pf = (await pfRes.json()) as { preflight?: { id: string; mainBefore: string; repo: string; integrationBranch: string; slot: number } };
    check("main-direct: preflight persists server-read repo, integration branch, prior HEAD and session identity",
      pfRes.ok && !!pf.preflight && pf.preflight.repo === realpathSync(oRepo)
      && pf.preflight.integrationBranch === "main" && pf.preflight.slot === mdSlot
      && /^[0-9a-f]{40,64}$/.test(pf.preflight.mainBefore), JSON.stringify(pf));
    await Bun.write(`${oRepo}/main-direct.txt`, "main direct\n");
    spawnSync("git", ["-C", oRepo, "add", "main-direct.txt"]);
    spawnSync("git", ["-C", oRepo, "commit", "-qm", "main direct fixture"]);
    const mdAfter = spawnSync("git", ["-C", oRepo, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
    const verifyReport = { command: "bun test focused", result: "pass" };
    const finBody = { id: pf.preflight?.id, result: "landed", mainAfter: mdAfter, verify: verifyReport };
    const finRes = await mdFetch("/api/self/main-direct/finalize", finBody);
    const fin = (await finRes.json()) as { outcome?: Record<string, unknown>; existing?: boolean };
    check("main-direct: finalize records one main-direct row with both server-read heads and reported verify",
      finRes.ok && fin.outcome?.origin === "main-direct" && fin.outcome?.mainBefore === pf.preflight?.mainBefore
      && fin.outcome?.mainAfter === mdAfter && JSON.stringify(fin.outcome?.verify) === JSON.stringify(verifyReport), JSON.stringify(fin));
    const idem = await mdFetch("/api/self/main-direct/finalize", finBody);
    const idemJ = (await idem.json()) as { existing?: boolean };
    const mdRows = readFileSync(`${ROOT}/lane-outcomes.jsonl`, "utf8").split("\n").filter(Boolean)
      .map((l) => JSON.parse(l) as { origin?: string; id?: string }).filter((r) => r.origin === "main-direct" && r.id === pf.preflight?.id);
    check("main-direct: identical finalize is idempotent and leaves exactly one ledger row",
      idem.ok && idemJ.existing === true && mdRows.length === 1, JSON.stringify({ status: idem.status, rows: mdRows.length }));
    const conflict = await mdFetch("/api/self/main-direct/finalize", { ...finBody, result: "abandoned", reason: "contradiction" });
    check("main-direct: contradictory finalize is 409 and cannot overwrite the row", conflict.status === 409
      && readFileSync(`${ROOT}/lane-outcomes.jsonl`, "utf8").split("\n").filter(Boolean)
        .map((l) => JSON.parse(l) as { id?: string }).filter((r) => r.id === pf.preflight?.id).length === 1, String(conflict.status));

    const stillPf = (await (await mdFetch("/api/self/main-direct/preflight", { repo: oRepo })).json()) as { preflight?: { id: string } };
    const unmoved = await mdFetch("/api/self/main-direct/finalize",
      { id: stillPf.preflight?.id, result: "landed", mainAfter: mdAfter, verify: "not run" });
    check("main-direct: landed with an unmoved HEAD is rejected honestly and records nothing",
      unmoved.status === 409 && !readFileSync(`${ROOT}/lane-outcomes.jsonl`, "utf8").includes(stillPf.preflight?.id ?? "never"), String(unmoved.status));
    const view = await mdFetch("/api/self/main-direct", undefined, "GET");
    const viewJ = (await view.json()) as { open?: { id: string; stale: boolean }[] };
    check("main-direct: an open preflight is visible with explicit stale state",
      view.ok && viewJ.open?.some((p) => p.id === stillPf.preflight?.id && typeof p.stale === "boolean") === true, JSON.stringify(viewJ));
    const abandoned = await mdFetch("/api/self/main-direct/abandon", { id: stillPf.preflight?.id, reason: "fixture stops here" });
    const afterAbandon = await mdFetch("/api/self/main-direct/finalize",
      { id: stillPf.preflight?.id, result: "landed", mainAfter: mdAfter, verify: "unknown" });
    check("main-direct: abandon closes the visible preflight with a reason; later finalize is 409",
      abandoned.ok && afterAbandon.status === 409, JSON.stringify({ abandon: abandoned.status, finalize: afterAbandon.status }));

    const stateRepo = `${oRepo}.state-fixture`;
    spawnSync("git", ["init", "-q", "-b", "main", stateRepo]);
    // Staged suites intentionally carry no path-read shell assets. Their node_modules symlink is
    // the one documented pointer back to the source tree (same mechanism as the client checks).
    const sourceRoot = dirname(realpathSync(`${ROOT}/node_modules`));
    copyFileSync(`${sourceRoot}/state.sh`, `${stateRepo}/state.sh`);
    await Bun.write(`${stateRepo}/server.ts`, "// fixture\n");
    await Bun.write(`${stateRepo}/lane-outcomes.jsonl`,
      `${JSON.stringify({ ts: 1, disposition: "landed", resolvedConflict: false, repairRounds: 0 })}\n`
      + `${JSON.stringify({ ts: 2, origin: "main-direct", result: "landed" })}\n`);
    spawnSync("git", ["-C", stateRepo, "add", "state.sh", "server.ts"]);
    spawnSync("git", ["-C", stateRepo, "-c", "user.email=e2e@test", "-c", "user.name=e2e", "commit", "-qm", "fixture"]);
    const stateOut = spawnSync("sh", ["state.sh"], { cwd: stateRepo, encoding: "utf8" }).stdout;
    check("state.sh: main-direct is separate and cannot change lane counts",
      stateOut.includes("outcomes 1") && stateOut.includes("main-direct 1") && stateOut.includes("lanes 1: landed 1"), stateOut.split("\n").filter((l) => /outcomes|main-direct|lanes /.test(l)).join(" | "));
    await post(`/api/slots/${mdSlot}/kill`, {});

    // (1) LANDED with commits — a lane that touches an e2e/test file, gets an owner prompt,
    // is committed + pushed, then landed via the simple ⏏ route (teardown of merged/pushed work).
    const oc1 = (await (await post("/api/lanes", { repo: oRepo })).json()) as { slot: number; cwd: string; branch: string };
    await post("/send", { slot: oc1.slot, text: "implement the feature exactly per this brief" }); // logged as an owner prompt regardless of pane readiness
    await Bun.write(`${oc1.cwd}/feature.e2e.ts`, "// lane test\n");
    spawnSync("git", ["-C", oc1.cwd, "add", "feature.e2e.ts"]);
    spawnSync("git", ["-C", oc1.cwd, "commit", "-qm", "landed lane work"]);
    spawnSync("git", ["-C", oc1.cwd, "remote", "add", "origin", oBare]);
    spawnSync("git", ["-C", oc1.cwd, "push", "-q", "origin", oc1.branch]);
    const land1 = await post(`/api/slots/${oc1.slot}/land`, {});
    check("outcome: landed lane teardown succeeds", land1.ok, await land1.text());
    const rec1 = forBranch(await readOutcomes(), oc1.branch);
    check("outcome: LANDED record with the right branch + disposition",
      rec1?.disposition === "landed" && rec1?.branch === oc1.branch, JSON.stringify(rec1));
    check("outcome: landed record carries a non-empty shortstat + commitCount 1",
      (rec1?.shortstat ?? "").includes("1 file") && rec1?.commitCount === 1, JSON.stringify(rec1));
    check("outcome: landed record flags e2eTouched from the .e2e.ts file",
      rec1?.e2eTouched === true && (rec1?.filesTouched ?? []).includes("feature.e2e.ts"), JSON.stringify(rec1?.filesTouched));
    check("outcome: landed record is server-stamped (headSha + base present)",
      /^[0-9a-f]{40,64}$/.test(rec1?.headSha ?? "") && typeof rec1?.base === "string", JSON.stringify({ head: rec1?.headSha, base: rec1?.base }));
    check("outcome: landed record counts the owner prompt + hashes the brief (attention proxies)",
      (rec1?.ownerPrompts ?? 0) >= 1 && /^[0-9a-f]{12}$/.test(rec1?.briefHash ?? ""), JSON.stringify({ op: rec1?.ownerPrompts, bh: rec1?.briefHash }));
    // land-shape facts: a direct ⏏ land of already-pushed work — human-confirmed, no conflict, no repair
    check("outcome: direct ⏏ land records confirmedByHuman:true, resolvedConflict:false, repairRounds:0",
      rec1?.confirmedByHuman === true && rec1?.resolvedConflict === false && rec1?.repairRounds === 0,
      JSON.stringify({ c: rec1?.confirmedByHuman, rc: rec1?.resolvedConflict, rr: rec1?.repairRounds }));
    // …and NO resolvedBy key on it. The attribution answers "which resolver chose these lines"; on a
    // land with no conflict that question has no subject, and a key present everywhere would make
    // "there was nothing to resolve" indistinguishable from "we did not record who resolved it".
    check("outcome: a land with no conflict carries no resolvedBy key at all (absence ≠ unknown)",
      !("resolvedBy" in (rec1 ?? {})), JSON.stringify({ resolvedBy: (rec1 as { resolvedBy?: string } | undefined)?.resolvedBy }));
    // WHERE THE WORK ENDED UP. `filesTouched` is a list of names until a row says which repository
    // and which revision to read them at. The repo is known for every lane; this land integrated
    // work that was ALREADY on the integration branch, so main never advanced and there is no
    // mainAfter to state — absent, not invented, exactly as recordLand skips such a land.
    // realpath, not the literal: the server resolves the path it stores, and on macOS /var is a
    // symlink to /private/var — comparing the raw fixture path fails on a difference that is not one
    const oRepoReal = realpathSync(oRepo);
    check("outcome: a landed record names the repository its files live in",
      rec1?.repo === oRepoReal, JSON.stringify({ repo: rec1?.repo, want: oRepoReal }));
    check("outcome: a land that did NOT move main states no mainAfter rather than guessing one",
      !("mainAfter" in (rec1 ?? {})), JSON.stringify(rec1?.mainAfter ?? null));

    // (2) KILLED-DIRTY — a lane with a commit, abandoned via ✕ kill
    const oc2 = (await (await post("/api/lanes", { repo: oRepo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${oc2.cwd}/abandoned.txt`, "wip\n");
    spawnSync("git", ["-C", oc2.cwd, "add", "abandoned.txt"]);
    spawnSync("git", ["-C", oc2.cwd, "commit", "-qm", "abandoned work"]);
    await post(`/api/slots/${oc2.slot}/kill`, {});
    const rec2 = forBranch(await readOutcomes(), oc2.branch);
    check("outcome: killed lane WITH a commit → killed-dirty, commitCount 1",
      rec2?.disposition === "killed-dirty" && rec2?.commitCount === 1, JSON.stringify(rec2));

    // tool_result BYTES, negative half — the attention-cost sensor for tool output. The rulebook
    // tells a lane to keep suite output out of its context; nothing measured whether that has any
    // effect, because no outcome row recorded what tool output cost. This half is the one that
    // matters: an unmeasurable lane must record null, never 0.
    // Both halves ride lanes this family ALREADY creates. That is not tidiness: outcomes.run() runs
    // before tasks.run(), whose payload-budget probe measures a /api/sessions response with only
    // ~76 B of headroom left — an extra lane here spends that budget in a check three families away,
    // where nobody would look for it. (Measured 2026-08-19: base 12212 B, +1 fixture lane 12722 B.)
    const projDirOf = (cwd: string) =>
      `${process.env.HOME}/.claude/projects/${cwd.replace(/[^a-zA-Z0-9]/g, "-")}`;
    // the precondition fails as ITSELF: if this dir somehow existed, "null" below would be a real
    // (and wrong) measurement rather than this assertion's subject
    check("outcome: tool_result fixture precondition — the killed lane's project dir does not exist",
      !existsSync(projDirOf(oc2.cwd)), projDirOf(oc2.cwd));
    check("outcome: a lane with no transcript dir records toolResultBytes null — the key is PRESENT (measured: unknowable), never 0",
      rec2 !== undefined && "toolResultBytes" in rec2 && rec2.toolResultBytes === null, JSON.stringify(rec2?.toolResultBytes));

    // (3) KILLED-EMPTY — a lane with no commits at all
    const oc3 = (await (await post("/api/lanes", { repo: oRepo })).json()) as { slot: number; branch: string };
    await post(`/api/slots/${oc3.slot}/kill`, {});
    const rec3 = forBranch(await readOutcomes(), oc3.branch);
    check("outcome: killed lane with NO commits → killed-empty, commitCount 0",
      rec3?.disposition === "killed-empty" && rec3?.commitCount === 0, JSON.stringify(rec3));

    // (4) SHELVED — a lane set aside with a note
    const oc4 = (await (await post("/api/lanes", { repo: oRepo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${oc4.cwd}/shelf.txt`, "later\n");
    spawnSync("git", ["-C", oc4.cwd, "add", "shelf.txt"]);
    spawnSync("git", ["-C", oc4.cwd, "commit", "-qm", "shelved work"]);
    // tool_result BYTES, positive half — planted BEFORE the terminal event, because buildLaneOutcome
    // reads the transcripts at that moment. One assistant line naming two tools, one user line
    // carrying three results: an attributed Bash string (10 B), an attributed Read whose content is
    // an ARRAY (stringified — 29 B), and an ORPHAN whose tool_use id this file never declared (3 B,
    // which must land under "?" rather than vanish). The byte counts are hand-computed, never
    // recomputed by the rule under test. The torn line must be skipped without sinking the file.
    const trDir = projDirOf(oc4.cwd);
    mkdirSync(trDir, { recursive: true });
    await Bun.write(`${trDir}/fixture.jsonl`, [
      JSON.stringify({ type: "assistant", message: { content: [
        { type: "tool_use", id: "tu_bash", name: "Bash" },
        { type: "tool_use", id: "tu_read", name: "Read" },
      ] } }),
      JSON.stringify({ type: "user", message: { content: [
        { type: "tool_result", tool_use_id: "tu_bash", content: "0123456789" },
        { type: "tool_result", tool_use_id: "tu_read", content: [{ type: "text", text: "hi" }] },
        { type: "tool_result", tool_use_id: "tu_never_declared", content: "abc" },
      ] } }),
      "{ not json",
      "",
    ].join("\n"));
    check("outcome: tool_result fixture precondition — the planted transcript is on disk where projDir() looks",
      existsSync(`${trDir}/fixture.jsonl`), trDir);
    await post(`/api/slots/${oc4.slot}/shelve`, { note: "resume later" });
    const rec4 = forBranch(await readOutcomes(), oc4.branch);
    check("outcome: shelved lane → shelved disposition", rec4?.disposition === "shelved", JSON.stringify(rec4));
    check("outcome: toolResultBytes carries the EXACT planted bytes, split by the tool that produced them",
      rec4?.toolResultBytes?.total === 42
      && rec4.toolResultBytes.byTool.Bash === 10
      && rec4.toolResultBytes.byTool.Read === 29
      && rec4.toolResultBytes.byTool["?"] === 3, JSON.stringify(rec4?.toolResultBytes));
    rmSync(trDir, { recursive: true, force: true });

    // (5) REVERTED — a conflict-free lane lands via the server script path (ADVANCES main), then
    // /api/repos/undo-land reverts it. The strongest negative outcome, assembled from the undo
    // record (no live slot) — model/briefHash are honestly null there.
    const oc5 = (await (await post("/api/lanes", { repo: oRepo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${oc5.cwd}/reverted.txt`, "lands then reverts\n");
    spawnSync("git", ["-C", oc5.cwd, "add", "reverted.txt"]);
    spawnSync("git", ["-C", oc5.cwd, "commit", "-qm", "reverted lane work"]);
    await setMergeMode("blocked"); // conflict-free → the server's script path lands it; the agent is never consulted
    await settleForMerge(oc5.slot);
    await post(`/api/slots/${oc5.slot}/merge`, {});
    const vRev = await waitMerge(oc5.slot);
    check("outcome: revert setup — conflict-free lane lands via the script (advances main)", vRev.gone, JSON.stringify(vRev));
    const undo = await post("/api/repos/undo-land", { repo: oRepo });
    check("outcome: undo-land succeeds", undo.ok, await undo.text());
    const rec5 = forBranch(await readOutcomes(), oc5.branch);
    check("outcome: reverted land → reverted disposition, commitCount 1, correct file",
      rec5?.disposition === "reverted" && rec5?.commitCount === 1 && (rec5?.filesTouched ?? []).includes("reverted.txt"),
      JSON.stringify(rec5));
    check("outcome: reverted row has no live-slot provenance to invent and records adapter pins as null",
      !!rec5 && !("taskId" in rec5) && !("originId" in rec5) && !("programId" in rec5)
      && rec5.harness === null && rec5.effort === null, JSON.stringify(rec5));

    // (6) LANDED after a REPAIRED conflict resolution, confirm-landed by the owner — the full
    // autonomy-calibration record: resolvedConflict:true, repairRounds>=1 (verify went red→green via
    // today's repair loop), confirmedByHuman:true. This ties the repair-loop signal into the ledger.
    await setMergeMode("do");
    const ocR = (await (await post("/api/lanes", { repo: oRepo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${ocR.cwd}/seed.txt`, "seed\nocR-lane VERIFYBAD\n"); // conflict + sabotage → resolution red → repaired
    spawnSync("git", ["-C", ocR.cwd, "commit", "-aqm", "ocR lane work (sabotaged)"]);
    await Bun.write(`${oRepo}/seed.txt`, "seed\nocR-main\n"); // same line on main → conflict → agent resolves
    spawnSync("git", ["-C", oRepo, "commit", "-aqm", "ocR main work"]);
    await settleForMerge(ocR.slot);
    await post(`/api/slots/${ocR.slot}/merge`, {});
    const vR = await waitMerge(ocR.slot);
    check("outcome: repaired conflict resolution paused for review with repairRounds>=1",
      !vR.gone && vR.last?.status === "resolved" && (vR.last?.repairRounds ?? 0) >= 1 && vR.last?.verify?.ok === true,
      JSON.stringify(vR.last));
    const rConf = await post(`/api/slots/${ocR.slot}/merge`, { confirm: true });
    check("outcome: owner confirm-lands the repaired resolution", rConf.ok, await rConf.text());
    const recR = forBranch(await readOutcomes(), ocR.branch);
    check("outcome: confirm-land of a repaired conflict → resolvedConflict:true, repairRounds>=1, confirmedByHuman:true",
      recR?.disposition === "landed" && recR?.resolvedConflict === true
      && (recR?.repairRounds ?? 0) >= 1 && recR?.confirmedByHuman === true, JSON.stringify(recR));
    // …and it names WHICH resolver chose those lines. Today only the throwaway agent can have, so
    // "agent" is the whole truth — the point of writing it now is that the day a second resolver
    // exists (② hands the conflict to the lane's own session), the two are separable from the first
    // row instead of being retrofitted onto history that never recorded the difference.
    check("outcome: a resolved conflict names its resolver — resolvedBy:'agent' today",
      (recR as { resolvedBy?: string } | undefined)?.resolvedBy === "agent",
      JSON.stringify({ resolvedBy: (recR as { resolvedBy?: string } | undefined)?.resolvedBy }));
    // the confirm-land moved main onto this lane too — its footprint must be the lane's OWN work
    // (measured from the commit it was rebased onto), never the empty shape a re-resolved name gives
    check("outcome: confirm-land record carries the lane's real footprint + verify verdict",
      (recR?.commitCount ?? 0) >= 1 && (recR?.filesTouched ?? []).includes("seed.txt")
      && recR?.verified === true, JSON.stringify({ cc: recR?.commitCount, f: recR?.filesTouched, v: recR?.verified }));
    // …and THIS land moved main, so the row can say where its files ended up: repo + the commit the
    // integration branch landed on. Together they are what turns the row's file list from names into
    // files a reader can open, and they are also the honest Commits↔Lands join a ±1h timestamp
    // match was standing in for.
    const mainNow = spawnSync("git", ["-C", oRepo, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
    check("outcome: a land that MOVED main records repo + the commit main ended up at",
      recR?.repo === realpathSync(oRepo) && recR?.mainAfter === mainNow
      && /^[0-9a-f]{40}$/.test(recR?.mainAfter ?? ""),
      JSON.stringify({ repo: recR?.repo, mainAfter: recR?.mainAfter, mainNow }));
    await setMergeMode("blocked"); // restore the suite default

    // (7) LANDED via the CLEAN AUTO-LAND path — the only unattended land, and the one the recorder
    // used to zero out: by record time the server has already advanced main onto the lane, so
    // re-resolving the base NAME made the merge-base HEAD and every fingerprint field collapsed to
    // nothing; `verified` was structurally unreadable too (the merge route clears the slot's verdict
    // before the job starts and writes the new one only after landLane returns). mergemode stays
    // "blocked" and the lane touches its own file — a land here proves the agent was never consulted.
    const oc7 = (await (await post("/api/lanes", { repo: oRepo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${oc7.cwd}/auto.e2e.ts`, "// clean auto-land lane test file\n");
    spawnSync("git", ["-C", oc7.cwd, "add", "auto.e2e.ts"]);
    spawnSync("git", ["-C", oc7.cwd, "commit", "-qm", "clean auto-land lane work"]);
    await Bun.write(`${oRepo}/auto-main.txt`, "main side\n"); // different file → clean rebase, no agent
    spawnSync("git", ["-C", oRepo, "add", "auto-main.txt"]);
    spawnSync("git", ["-C", oRepo, "commit", "-qm", "auto main work"]);
    await settleForMerge(oc7.slot);
    await post(`/api/slots/${oc7.slot}/merge`, {});
    const v7 = await waitMerge(oc7.slot);
    check("outcome: clean auto-land setup — conflict-free lane lands unattended (slot torn down)", v7.gone, JSON.stringify(v7));
    const rec7 = forBranch(await readOutcomes(), oc7.branch);
    check("outcome: CLEAN AUTO-LAND record carries the lane's real shape (commitCount 1 + files + e2eTouched), not zeros",
      rec7?.disposition === "landed" && rec7?.commitCount === 1 && (rec7?.shortstat ?? "").includes("1 file")
      && (rec7?.filesTouched ?? []).includes("auto.e2e.ts") && rec7?.e2eTouched === true, JSON.stringify(rec7));
    check("outcome: clean auto-land record carries that job's verify verdict (verified:true), not null",
      rec7?.verified === true && rec7?.confirmedByHuman === false,
      JSON.stringify({ verified: rec7?.verified, confirmed: rec7?.confirmedByHuman }));

    // (7a) TASK→DISPATCH→SLOT→OUTCOME provenance, including the process boundary. The first lane
    // names every attended spawn pin, then the real server is restarted before teardown: the
    // killed-empty row can only retain task/origin/program if saveState + loadState carried the slot stamp.
    const outcomeProgramRes = await post("/api/programs", {
      title: "Outcome provenance program", intent: "Carry owner Program membership through a lane.",
      successCriterion: "The terminal outcome names the Program attached to its task.",
      nonGoals: [], decisions: [], evidence: [], openQuestions: [],
    });
    const outcomeProgram = (await outcomeProgramRes.json()) as { program?: { id: string } };
    const outcomeProgramId = outcomeProgram.program?.id ?? "";
    const outcomeProgramConfirm = await post(`/api/programs/${outcomeProgramId}/confirm`, {});
    check("provenance setup: an owner Program is confirmed for the task→slot→outcome chain",
      outcomeProgramRes.ok && outcomeProgramConfirm.ok && /^[0-9a-f]{24}$/.test(outcomeProgramId),
      `${outcomeProgramRes.status}/${outcomeProgramConfirm.status} ${JSON.stringify(outcomeProgram)}`);
    const pinTask = (await (await post("/api/tasks", {
      text: "execution-provenance explicit-pin probe", repo: oRepo, programId: outcomeProgramId,
    })).json()) as { task: { id: string; originId?: string; programId?: string } };
    const pinModel = "openai/gpt-5-codex";
    const pinDispatch = await post(`/api/tasks/${pinTask.task.id}/dispatch`, {
      harness: "codex", model: pinModel, effort: "high",
    });
    const pinLane = (await pinDispatch.json()) as { ok?: boolean; slot?: number; branch?: string };
    check("provenance setup: explicit harness/model/effort dispatch creates a task-bound lane",
      pinDispatch.ok && pinLane.ok === true && typeof pinLane.slot === "number" && typeof pinLane.branch === "string",
      `${pinDispatch.status} ${JSON.stringify(pinLane)}`);
    type PinSlot = { taskId?: string | null; originId?: string | null; programId?: string | null; harness?: string | null;
      model?: string | null; effort?: string | null };
    let pinSlot: PinSlot | undefined;
    for (let i = 0; i < 20; i++) {
      try {
        pinSlot = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
          { slots?: Record<string, PinSlot> }).slots?.[String(pinLane.slot)];
      } catch { /* atomic state rename can race this read; retry */ }
      if (pinSlot?.taskId === pinTask.task.id && pinSlot.originId === pinTask.task.originId
        && pinSlot.programId === pinTask.task.programId) break;
      await Bun.sleep(50);
    }
    check("dispatch stamps taskId/originId/programId and exact requested pins onto the persisted slot",
      pinSlot?.taskId === pinTask.task.id && pinSlot.originId === pinTask.task.originId
      && pinSlot.programId === outcomeProgramId && pinTask.task.programId === outcomeProgramId
      && pinSlot.harness === "codex" && pinSlot.model === pinModel && pinSlot.effort === "high",
      JSON.stringify(pinSlot));
    await restartSrv();
    if (typeof pinLane.slot === "number") await post(`/api/slots/${pinLane.slot}/kill`, {});
    const pinOutcome = forBranch(await readOutcomes(), pinLane.branch ?? "");
    check("outcome: after save/load + killed-empty teardown, task/origin/program and explicit spawn pins remain exact",
      pinOutcome?.disposition === "killed-empty"
      && pinOutcome.taskId === pinTask.task.id && pinOutcome.originId === pinTask.task.originId
      && pinOutcome.programId === outcomeProgramId
      && pinOutcome.harness === "codex" && pinOutcome.model === pinModel && pinOutcome.effort === "high",
      JSON.stringify(pinOutcome));
    await post(`/api/tasks/${pinTask.task.id}/delete`, {});

    const defaultTask = (await (await post("/api/tasks", {
      text: "execution-provenance default-adapter probe", repo: oRepo,
    })).json()) as { task: { id: string; originId?: string } };
    const defaultDispatch = await post(`/api/tasks/${defaultTask.task.id}/dispatch`, {});
    const defaultLane = (await defaultDispatch.json()) as { ok?: boolean; slot?: number; branch?: string };
    check("provenance setup: body-less dispatch creates a task-bound default-adapter lane",
      defaultDispatch.ok && defaultLane.ok === true && typeof defaultLane.slot === "number"
      && typeof defaultLane.branch === "string", `${defaultDispatch.status} ${JSON.stringify(defaultLane)}`);
    if (typeof defaultLane.slot === "number")
      await post(`/api/slots/${defaultLane.slot}/shelve`, { note: "default adapter provenance probe" });
    const defaultOutcome = forBranch(await readOutcomes(), defaultLane.branch ?? "");
    check("outcome: a body-less dispatch records task/origin but harness:null and effort:null honestly",
      defaultOutcome?.disposition === "shelved"
      && defaultOutcome.taskId === defaultTask.task.id && defaultOutcome.originId === defaultTask.task.originId
      && !("programId" in defaultOutcome)
      && defaultOutcome.harness === null && defaultOutcome.effort === null,
      JSON.stringify(defaultOutcome));
    await post(`/api/tasks/${defaultTask.task.id}/delete`, {});

    // (7b) WHO RELEASED IT, which is NOT who landed it. `confirmedByHuman` answers the land art —
    // did the owner press ⏫, or did it auto-land clean+green — and on the live trail 77 of the 89
    // landed rows carry `false` on it although a human released every single one. So an unattended
    // land is not evidence of an unattended lane, and any criterion that selects "the first N
    // machine-started lanes" off that field counts attended work. `releasedBy` is the field that
    // does answer it, and this pin holds BOTH halves together: an owner-released task, landed
    // through the same unattended clean path as (7), must record releasedBy:"owner" AND keep
    // confirmedByHuman:false. Drop either half and the new field has silently become a rename.
    const relMark = "released-by pin — an owner-released lane";
    const relTask = (await (await post("/api/tasks", { text: relMark, repo: oRepo })).json()) as
      { task: { id: string; originId?: string } };
    check("release pin setup: the owner promotes the draft (▸ queue — the release act itself)",
      (await post(`/api/tasks/${relTask.task.id}/queue`, {})).ok);
    const relD = await post(`/api/tasks/${relTask.task.id}/dispatch`, {});
    const relJ = (await relD.json()) as { slot?: number; branch?: string };
    check("release pin setup: the released task starts a lane in the outcomes repo",
      relD.ok && typeof relJ.slot === "number" && typeof relJ.branch === "string", JSON.stringify(relJ));
    const relSlot = relJ.slot ?? 0;
    const relBranch = relJ.branch ?? "";
    const relCwd = ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
      .slots.find((s) => s.id === relSlot)?.cwd ?? "";
    check("release pin setup: the dispatched lane has a worktree to commit in", !!relCwd, JSON.stringify({ relSlot, relCwd }));
    // SETTLE, not an assertion — the delivery contract itself is pinned in e2e/tasks.ts (d). The
    // wait exists because briefAndSend sleeps ~4 s before injecting the founding brief and then
    // re-checks that the slot is still ITS lane; tearing the lane down inside that window makes it
    // requeue the row, which is noise this check has no business generating.
    for (let i = 0; i < 24; i++) {
      const ps = ((await (await get("/api/prompts?limit=100")).json()) as { prompts: { source?: string; text?: string }[] }).prompts;
      if (ps.some((p) => p.source === "auto" && (p.text ?? "").includes(relMark))) break;
      await Bun.sleep(500);
    }
    await Bun.write(`${relCwd}/released.e2e.ts`, "// owner-released lane test file\n");
    spawnSync("git", ["-C", relCwd, "add", "released.e2e.ts"]);
    spawnSync("git", ["-C", relCwd, "commit", "-qm", "owner-released lane work"]);
    await Bun.write(`${oRepo}/released-main.txt`, "main side, second\n"); // different file → clean rebase, no agent
    spawnSync("git", ["-C", oRepo, "add", "released-main.txt"]);
    spawnSync("git", ["-C", oRepo, "commit", "-qm", "released-pin main work"]);
    await settleForMerge(relSlot);
    await post(`/api/slots/${relSlot}/merge`, {});
    const vRel = await waitMerge(relSlot);
    check("release pin setup: the owner-released lane lands UNATTENDED via the clean path (slot torn down)",
      vRel.gone, JSON.stringify(vRel));
    const recRel = forBranch(await readOutcomes(), relBranch);
    check("outcome: an owner-released lane records releasedBy:\"owner\" — while the LAND art stays what it was (unattended clean land ⇒ confirmedByHuman:false)",
      recRel?.disposition === "landed" && recRel?.releasedBy === "owner" && recRel?.confirmedByHuman === false
      && recRel.taskId === relTask.task.id && recRel.originId === relTask.task.originId,
      JSON.stringify({ releasedBy: recRel?.releasedBy, taskId: recRel?.taskId,
        originId: recRel?.originId, confirmed: recRel?.confirmedByHuman, d: recRel?.disposition }));
    // …and the complementary half: a lane that came from NO queue row (rec1 was opened by hand via
    // POST /api/lanes) carries no key at all. Absence has to stay readable as "this row cannot
    // say" — the moment it defaults to "owner", every pre-field row on disk starts claiming a
    // release nobody recorded, which is the exact failure this field was added to prevent.
    check("outcome: a hand-opened lane carries no releasedBy key at all (absence ≠ owner)",
      !("releasedBy" in (rec1 ?? {})), JSON.stringify({ releasedBy: rec1?.releasedBy }));
    check("outcome: a hand-opened lane carries no taskId/originId/programId, while default adapter pins stay explicit null",
      !!rec1 && !("taskId" in rec1) && !("originId" in rec1) && !("programId" in rec1)
      && rec1.harness === null && rec1.effort === null, JSON.stringify(rec1));

    // (7c) THE DOSSIER — the same lanes read as ONE story instead of six ledgers. Every lane above
    // is already a fixture for it: oc1 landed WITHOUT moving main (so it has no note, and that is a
    // measurement), oc7 auto-landed and moved it (so it has one, carrying the verbatim verify
    // command and output that no other route in this product reads), and the release-pin lane was
    // dispatched from a queue row and then torn down (so its task can only be recovered by hash).
    // The checks are split along the one line that matters: what the join FINDS, and what it says
    // when it cannot look — an unreadable source must never render as an empty one.
    {
      type Measured<T> = { state: "read"; value: T } | { state: "unknown"; why: string };
      type Note = { state: string; sha: string; note?: { branch?: string; confirmedByHuman?: boolean;
        verify?: { cmd?: string; ok?: boolean | null; out?: string } }; why?: string };
      type Dossier = { branch: string; repo: string | null; worktree: string | null;
        slot: number | null; liveSlot: number | null;
        task: Measured<{ id: string; text: string; match: string } | null>;
        prompts: Measured<{ rows: { text?: string; source?: string }[]; total: number }>;
        events: Measured<{ rows: { event?: string; slot?: number; detail?: string }[]; total: number }>;
        commits: Measured<{ rows: { sha: string; subject: string }[]; total: number }>;
        outcomes: Measured<{ rows: { disposition?: string; branch?: string }[]; total: number }>;
        landNotes: Measured<Note[]>;
        audits: Measured<{ rows: unknown[]; total: number }> };
      const dossier = async (branch: string): Promise<Dossier> =>
        (await (await get(`/api/lane?branch=${encodeURIComponent(branch)}`)).json()) as Dossier;

      // the index: what there is to read. A landed lane comes off the outcome ledger; a lane that is
      // still OPEN has no outcome row at all, and listing only the finished ones would make this a
      // graveyard that never shows the lane the owner is actually watching.
      const openLane = (await (await post("/api/lanes", { repo: oRepo })).json()) as { slot: number; branch: string };
      // asserted as its own step: every other check below reads through this lane, and a slot
      // shortage here would otherwise surface as four unrelated-looking failures
      check("dossier setup: an open lane exists to read (a free slot was available)",
        typeof openLane.slot === "number" && !!openLane.branch, JSON.stringify(openLane));
      const idx = (await (await get("/api/lane")).json()) as
        { lanes: { branch: string; disposition: string | null; live: number | null }[]; total: number };
      check("dossier: the index lists a LANDED lane with its disposition and an OPEN lane with its live slot",
        idx.lanes.some((l) => l.branch === oc7.branch && l.disposition === "landed" && l.live === null)
        && idx.lanes.some((l) => l.branch === openLane.branch && l.live === openLane.slot),
        JSON.stringify(idx.lanes.slice(0, 6)));

      // THE JOIN. oc7 auto-landed clean+green and its slot is gone — every source below has to be
      // recovered from the branch name alone.
      const d7 = await dossier(oc7.branch);
      check("dossier: a torn-down lane still resolves its repo and the worktree path its trail is keyed by",
        d7.repo === realpathSync(oRepo) && d7.worktree === `${realpathSync(oRepo)}.worktrees/${oc7.branch.replace(/[^a-zA-Z0-9._-]/g, "-")}`,
        JSON.stringify({ repo: d7.repo, worktree: d7.worktree }));
      check("dossier: it carries the lane's own outcome row (landed), not the whole ledger",
        d7.outcomes.state === "read" && d7.outcomes.value.rows.length === 1
        && d7.outcomes.value.rows[0].disposition === "landed" && d7.outcomes.value.rows[0].branch === oc7.branch,
        JSON.stringify(d7.outcomes));
      // the commits resolve base..head AFTER the branch was landed and the worktree removed — the
      // outcome row carries the fork point as a COMMIT, which is what keeps this readable.
      check("dossier: a landed lane's own commits are still walkable after its worktree is gone",
        d7.commits.state === "read" && d7.commits.value.rows.length === 1
        && d7.commits.value.rows[0].subject === "clean auto-land lane work",
        JSON.stringify(d7.commits));
      // THE POINT OF THE WHOLE FEATURE: the fleet/land note, which until now had a writer and no
      // reader anywhere in the product. It is where the verbatim verify command and its output live.
      const n7 = d7.landNotes.state === "read" ? d7.landNotes.value[0] : null;
      check("dossier: the fleet/land note is READ — with the verbatim verify command and its output",
        d7.landNotes.state === "read" && d7.landNotes.value.length === 1 && n7?.state === "read"
        && n7.sha === rec7?.mainAfter && n7.note?.branch === oc7.branch
        && (n7.note?.verify?.cmd ?? "").includes("fakeverify") && n7.note?.verify?.ok === true
        && typeof n7.note?.verify?.out === "string" && n7.note?.confirmedByHuman === false,
        JSON.stringify(d7.landNotes));
      // the slot events, bounded to the window this lane actually held the slot. `slot_open`'s
      // detail IS the cwd, which is the only durable way back to a torn-down lane's slot.
      check("dossier: the lane's slot is recovered from slot_open and its events are the lane's own",
        d7.events.state === "read" && d7.slot === oc7.slot && d7.liveSlot === null
        && d7.events.value.rows.some((e) => e.event === "slot_open" && e.detail === d7.worktree)
        && d7.events.value.rows.every((e) => e.slot === oc7.slot),
        JSON.stringify({ slot: d7.slot, live: d7.liveSlot, rows: d7.events.state === "read" ? d7.events.value.rows.length : d7.events }));

      // the prompt trail, keyed by the derived worktree path — oc1 was sent an owner prompt before
      // it landed, and the path it was recorded under no longer exists on disk.
      const d1 = await dossier(oc1.branch);
      check("dossier: prompts sent to a lane are still found by the derived worktree path after teardown",
        d1.prompts.state === "read"
        && d1.prompts.value.rows.some((p) => (p.text ?? "").includes("implement the feature exactly per this brief")),
        JSON.stringify(d1.prompts));
      // …and the honesty rule's first half: oc1's ⏏ land did NOT move main, so there is no note to
      // read. `read` + empty is a MEASUREMENT ("we looked, this land wrote none"); it must not
      // arrive as `unknown`, which would claim we could not look.
      check("dossier: a land that never moved main reports NO note as a measurement, not as unknown",
        d1.landNotes.state === "read" && d1.landNotes.value.length === 0
        && !("mainAfter" in (rec1 ?? {})), JSON.stringify(d1.landNotes));

      // the queue row behind a dispatched lane. Its slot has been recycled since, so the live
      // binding is gone; the immutable outcome taskId recovers it without re-deriving the fresh
      // ContextPlan suffix from a later tree, and the row says WHICH join fired.
      const dRel = await dossier(relBranch);
      check("dossier: a dispatched lane recovers its queue row by outcome taskId after teardown, and names the join",
        dRel.task.state === "read" && dRel.task.value?.id === relTask.task.id
        && dRel.task.value?.text === relMark && dRel.task.value?.match === "outcome-task-id",
        JSON.stringify(dRel.task));
      // the complementary half: a hand-opened lane has no queue row, and `read` + null says exactly
      // that — we consulted the list and nothing matched.
      check("dossier: a hand-opened lane reports NO queue row as a measurement (read + null)",
        d1.task.state === "read" && d1.task.value === null, JSON.stringify(d1.task));

      // THE HONESTY RULE, second half: a branch nothing on this server has ever heard of. Every
      // git-backed source needs a repository, and this one has none — so they must come back
      // `unknown` WITH a reason. An empty `read` here would be the exact lie this window exists to
      // prevent: "nothing happened in this lane" instead of "we could not look".
      const dGhost = await dossier("fleet/never-existed");
      check("dossier: an unknown branch invents no repository — it stays null rather than defaulting",
        dGhost.repo === null && dGhost.worktree === null && dGhost.slot === null, JSON.stringify(dGhost.repo));
      check("dossier: with no repository every git-backed source is UNKNOWN with a reason, never an empty list",
        dGhost.prompts.state === "unknown" && !!dGhost.prompts.why
        && dGhost.events.state === "unknown" && !!dGhost.events.why
        && dGhost.commits.state === "unknown" && !!dGhost.commits.why
        && dGhost.landNotes.state === "unknown" && !!dGhost.landNotes.why,
        JSON.stringify({ p: dGhost.prompts, e: dGhost.events, c: dGhost.commits, n: dGhost.landNotes }));
      // …while the source that genuinely IS empty stays a measurement: no lane by that name ended,
      // and the outcome ledger can say so because reading it needs no repository at all.
      check("dossier: the outcome ledger still answers for an unknown branch — read, and empty",
        dGhost.outcomes.state === "read" && dGhost.outcomes.value.rows.length === 0, JSON.stringify(dGhost.outcomes));
      // tier 2 is not configured in this harness, and "the suite never ran" is a different sentence
      // from "the suite ran and found nothing about this lane". Both dossiers must say the first.
      check("dossier: with no post-land audit command configured, tier 2 reads UNKNOWN — never a silent green",
        d7.audits.state === "unknown" && /never ran|not configured/.test(d7.audits.why ?? ""),
        JSON.stringify(d7.audits));

      // an OPEN lane answers from the live slot instead of the ledger — no outcome row yet, and
      // that absence is a measurement too (it has not ended).
      const dOpen = await dossier(openLane.branch);
      check("dossier: an open lane binds to its LIVE slot and honestly reports no outcome yet",
        dOpen.liveSlot === openLane.slot && dOpen.slot === openLane.slot
        && dOpen.outcomes.state === "read" && dOpen.outcomes.value.rows.length === 0
        && dOpen.repo === realpathSync(oRepo), JSON.stringify({ live: dOpen.liveSlot, o: dOpen.outcomes, r: dOpen.repo }));
      await post(`/api/slots/${openLane.slot}/kill`, {});
    }

    // (8) LANDED where verify did NOT run for this land, while a STALE green verdict sits on the
    // slot: an agent-resolved lane is left un-landed (verdict "resolved", verify.ok:true, kept for
    // review), the owner pushes it and tears it down with the direct ⏏ land instead. That route
    // runs no verify AND never clears mergeLast, so the record must say verified:null — reporting
    // the earlier run's green would attribute a verification to a land that never had one.
    await setMergeMode("do");
    const oc8 = (await (await post("/api/lanes", { repo: oRepo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${oc8.cwd}/seed.txt`, "seed\noc8-lane\n"); // no VERIFYBAD → the resolution verifies GREEN
    spawnSync("git", ["-C", oc8.cwd, "commit", "-aqm", "oc8 lane work"]);
    await Bun.write(`${oRepo}/seed.txt`, "seed\noc8-main\n"); // same line on main → conflict → agent resolves
    spawnSync("git", ["-C", oRepo, "commit", "-aqm", "oc8 main work"]);
    await settleForMerge(oc8.slot);
    await post(`/api/slots/${oc8.slot}/merge`, {});
    const v8 = await waitMerge(oc8.slot);
    check("outcome: stale-verdict setup — resolved lane kept for review with verify.ok:true on record",
      !v8.gone && v8.last?.status === "resolved" && v8.last?.verify?.ok === true, JSON.stringify(v8.last));
    spawnSync("git", ["-C", oc8.cwd, "remote", "add", "origin", oBare]);
    spawnSync("git", ["-C", oc8.cwd, "push", "-q", "origin", oc8.branch]); // pushed → ⏏ may tear it down
    const land8 = await post(`/api/slots/${oc8.slot}/land`, {});
    check("outcome: direct ⏏ land of the resolved-but-unlanded lane succeeds", land8.ok, await land8.text());
    const rec8 = forBranch(await readOutcomes(), oc8.branch);
    check("outcome: a land that ran NO verify records verified:null even with a stale green verdict on the slot",
      rec8?.disposition === "landed" && rec8?.verified === null,
      JSON.stringify({ verified: rec8?.verified, confirmed: rec8?.confirmedByHuman }));
    await setMergeMode("blocked"); // restore the suite default

    // (9) THE STALENESS RULE (docs/perception-layer.md §5): a persisted review must carry whether
    // it actually described what reached the terminal event. Three lanes, three answers — and the
    // un-covered case is a state word, never a missing field, so no consumer can read findings
    // without reading what they covered.
    const ocRv = (await (await post("/api/lanes", { repo: oRepo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${ocRv.cwd}/reviewed.txt`, "reviewed then shelved\n");
    spawnSync("git", ["-C", ocRv.cwd, "add", "reviewed.txt"]);
    spawnSync("git", ["-C", ocRv.cwd, "commit", "-qm", "reviewed lane work"]);
    check("staleness setup: the owner's ③ click populates the cache for this tree",
      (await post(`/api/slots/${ocRv.slot}/review`, {})).ok);
    await post(`/api/slots/${ocRv.slot}/shelve`, { note: "reviewed, then set aside" });
    const recRv = forBranch(await readOutcomes(), ocRv.branch);
    check("outcome: a review of the exact content that ended up shelved is recorded as covered",
      recRv?.review?.state === "covered" && (recRv?.review?.findings?.length ?? 0) === 2
      && typeof recRv?.review?.model === "string", JSON.stringify(recRv?.review ?? null).slice(0, 200));

    // the tree MOVES after the review — the row must say so rather than present stale findings
    // as coverage of what was actually abandoned
    const ocSup = (await (await post("/api/lanes", { repo: oRepo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${ocSup.cwd}/superseded.txt`, "first state\n");
    spawnSync("git", ["-C", ocSup.cwd, "add", "superseded.txt"]);
    spawnSync("git", ["-C", ocSup.cwd, "commit", "-qm", "state the review saw"]);
    await post(`/api/slots/${ocSup.slot}/review`, {});
    await Bun.write(`${ocSup.cwd}/superseded.txt`, "second state — the review never saw this\n");
    spawnSync("git", ["-C", ocSup.cwd, "commit", "-aqm", "state the review never saw"]);
    await post(`/api/slots/${ocSup.slot}/kill`, {});
    const recSup = forBranch(await readOutcomes(), ocSup.branch);
    check("outcome: a review computed for an EARLIER git state is recorded as superseded, not as coverage",
      recSup?.review?.state === "superseded" && (recSup?.review?.findings?.length ?? 0) === 2,
      JSON.stringify(recSup?.review ?? null).slice(0, 200));

    // (9b) F5 — an OFF-CONTRACT reviewer answer must not reach the ledger as a clean review.
    // `runReview` fails soft: prose, an error or a refusal keeps `raw: true` and puts the model's
    // text in `notes` with `findings` empty. Persisting the findings ALONE made that byte-identical
    // to a real clean review — so every reviewer FAILURE was recorded as coverage
    // (discrepancy-audit.md F5). The stand-in is wrapped to answer prose for THIS lane's worktree
    // only, matched on the branch slug in $PWD rather than on a marker file written after the lane
    // exists: auto-③ can review a done-looking lane before the click below, and would then serve a
    // parsed result from cache and quietly void the test.
    const oCtl = REPO.replace(/\/[^/]+$/, "");
    await Bun.write(`${oCtl}/fakereview.orig`, await Bun.file(`${oCtl}/fakereview`).text());
    spawnSync("chmod", ["+x", `${oCtl}/fakereview.orig`]);
    await Bun.write(`${oCtl}/fakereview`, ["#!/bin/sh",
      'case "$PWD" in',
      '  *raw-review*) cat >/dev/null; echo "$PWD" >> "$(dirname "$0")/reviewruns";',
      '    printf "I cannot review this diff — there is no JSON here at all."; exit 0 ;;',
      "esac",
      'exec "$(dirname "$0")/fakereview.orig"', ""].join("\n"));
    spawnSync("chmod", ["+x", `${oCtl}/fakereview`]);
    const ocRaw = (await (await post("/api/lanes", { repo: oRepo, branch: "raw-review" })).json()) as
      { slot: number; cwd: string; branch: string };
    await Bun.write(`${ocRaw.cwd}/unparsed.txt`, "the reviewer will answer prose about this\n");
    spawnSync("git", ["-C", ocRaw.cwd, "add", "unparsed.txt"]);
    spawnSync("git", ["-C", ocRaw.cwd, "commit", "-qm", "work the reviewer fails to parse"]);
    const rawClick = await post(`/api/slots/${ocRaw.slot}/review`, {});
    const rawClickBody = (await rawClick.text()).slice(0, 200);
    check("raw-review setup: the ③ click returns, off-contract answer and all (fail-soft, never a 500)",
      rawClick.ok, rawClickBody);
    // … but a click that RETURNED has not necessarily WRITTEN anything, and that gap is the
    // §11.2k flake. `server.ts#reviewResponse` joins whatever job `reviewInflight` holds for the
    // slot, and that map is never cleared when a slot is recycled (server.ts#teardownSlotOccupant
    // clears reviewCache, not reviewInflight) — so a review left running by the slot's PREVIOUS
    // occupant is joined here, and its cache write is then dropped by server.ts#startReview's
    // identity re-check (`s.cwd === job.cwd`). The caller's await resolves all the same, saying
    // `stale: true`. Killing at that moment mints review.state:"none" and the proof check below
    // reads a race as a regression. So wait for the PERSISTED effect — the cache entry keyed on
    // THIS tree, which is exactly what server.ts#outcomeReview reads at kill — and re-click while
    // it is absent (GET is a pure cache lookup and never spawns). The precondition fails AS
    // ITSELF when it cannot be established, so the proof below is never asked to carry it.
    let rawSeen: { cached?: boolean; stale?: boolean } | null = null;
    let rawClicks = 1;
    const rawDeadline = Date.now() + 30_000;
    while (Date.now() < rawDeadline) {
      rawSeen = (await (await get(`/api/slots/${ocRaw.slot}/review`)).json()) as { cached?: boolean; stale?: boolean };
      if (rawSeen?.cached === true && rawSeen?.stale === false) break;
      if (rawClicks < 6) { rawClicks++; await post(`/api/slots/${ocRaw.slot}/review`, {}); }
      else await new Promise((r) => setTimeout(r, 250));
    }
    check("raw-review precondition: the review verdict persisted before the kill",
      rawSeen?.cached === true && rawSeen?.stale === false,
      `clicks=${rawClicks} firstClick=${rawClickBody.slice(0, 120)} lastGet=${JSON.stringify(rawSeen).slice(0, 160)}`);
    await post(`/api/slots/${ocRaw.slot}/kill`, {});
    const recRaw = forBranch(await readOutcomes(), ocRaw.branch);
    check("outcome: a reviewer answer that did NOT parse is persisted as raw:true carrying its text — not as a clean review",
      recRaw?.review?.state === "covered" && recRaw?.review?.raw === true
      && (recRaw?.review?.findings?.length ?? 0) === 0
      && (recRaw?.review?.notes ?? "").includes("no JSON here at all"),
      JSON.stringify(recRaw?.review ?? null).slice(0, 240));
    // the other half of F5: without this the two rows above and below are the SAME row on disk.
    check("outcome: a review that DID parse persists raw:false plus its scope — a failed review is distinguishable from a clean one",
      recRv?.review?.raw === false && (recRv?.review?.scope ?? "").length > 0,
      JSON.stringify({ raw: recRv?.review?.raw, scope: recRv?.review?.scope }));
    await Bun.write(`${oCtl}/fakereview`, await Bun.file(`${oCtl}/fakereview.orig`).text());
    spawnSync("chmod", ["+x", `${oCtl}/fakereview`]);

    // (9c) THE SECOND ROW SHAPE. Rows written before the review field existed (rows 1–3 of the live
    // ledger) have NO `review` key at all — not `{state:"none"}`. The feed renders that as "not
    // measured", which is only reachable if the route hands the absence through untouched: a reader
    // that defaults it would turn "nobody measured this" into "we measured, nothing covered it".
    appendFileSync(`${oCtl}/lane-outcomes.jsonl`,
      JSON.stringify({ ts: Date.now(), branch: "legacy/pre-review-field", base: null, headSha: null,
        disposition: "landed", model: null, briefHash: null, shortstat: "", commitCount: 0,
        filesTouched: [], e2eTouched: false, verified: null, sessionMs: null, ownerPrompts: 0,
        resolvedConflict: false, repairRounds: 0, confirmedByHuman: false }) + "\n");
    const recLegacy = forBranch(await readOutcomes(), "legacy/pre-review-field");
    check("outcome: a legacy row survives /api/lane-outcomes with old absent fields untouched (reader never throws or defaults)",
      !!recLegacy && !("review" in recLegacy) && !("taskId" in recLegacy) && !("originId" in recLegacy)
      && !("programId" in recLegacy)
      && !("harness" in recLegacy) && !("effort" in recLegacy), JSON.stringify(recLegacy ?? null).slice(0, 240));

    // (9d) …and the renderer keeps the two shapes apart. Asserted over the CLIENT SOURCE, not a
    // rendered DOM: this suite has no DOM harness, so what is proved here is that the classifier
    // has an "unmeasured" case distinct from "none" and that raw:true is worded as not-a-review.
    // Weaker than a render test and named so — it catches the regression that matters (someone
    // collapsing the missing-key case into "none", or calling zero findings clean).
    // the suite runs from a scratch copy that carries server.ts + public/ but NOT src/client.ts — the only
    // link back to the checkout is the node_modules symlink e2e-isolated.sh makes, so the real
    // source is its realpath's parent. Read the SOURCE rather than public/app.js on purpose: the
    // bundle is minified, so a regex over it would assert about the minifier as much as the code.
    let cliSrc: string | null = null;
    let cliSrcError = "";
    try {
      cliSrc = readFileSync(`${dirname(realpathSync(`${ROOT}/node_modules`))}/src/client.ts`, "utf8");
    } catch (e) { cliSrcError = e instanceof Error ? e.message : String(e); }
    check("precondition: node_modules exposes src/client.ts for outcome client checks",
      cliSrc !== null, cliSrcError);
    if (cliSrc === null) return;
    check("client: the outcome renderer classifies an absent review as 'unmeasured', a case distinct from 'none'",
      /function reviewRel[\s\S]{0,400}?return[\s\S]{0,200}?"unmeasured"/.test(cliSrc)
      && /unmeasured:\s*"review not measured/.test(cliSrc) && /none:\s*"no ③ review on record/.test(cliSrc),
      "reviewRel / REL_WORD in src/client.ts");
    check("client: the outcome renderer words raw:true as not-a-review and empty findings as not-clean",
      /r\.raw === true/.test(cliSrc) && /did not parse — this is NOT a review/.test(cliSrc)
      && /not a clean bill of/.test(cliSrc), "reviewBody in src/client.ts");

    // (9d2) THE DOSSIER LENS, CLIENT HALF. Same method and the same stated limit as (9d): a regex
    // over the source, not a rendered DOM. It pins the ONE property that makes the lens worth
    // having — `akteSource` must send an `unknown` source down a path that prints the reason and
    // returns null, so the caller draws no rows. The regression it catches is the one that would
    // quietly undo the whole feature: someone rendering an unreadable source as an empty section,
    // which reads as "nothing happened in this lane".
    check("client: the dossier's source classifier prints \"not measured\" + the reason and yields NO rows",
      /function akteSource[\s\S]{0,600}?src\.state === "unknown"[\s\S]{0,300}?"not measured"[\s\S]{0,200}?src\.why[\s\S]{0,120}?return null/.test(cliSrc),
      "akteSource in src/client.ts");
    // …and the verify verdict on a land note keeps the six states apart, for the same reason the
    // merge verdict does: a skip, a timeout and a never-started run are each "nothing was measured",
    // and none of the three may render as a pass.
    check("client: a land note's verify renders skipped/timed-out/never-started as measurements that did NOT happen",
      /v\.ok === true \? "passed" : v\.ok === false \? "FAILED"/.test(cliSrc)
      && /timedOut \?[\s\S]{0,120}?nothing was measured/.test(cliSrc)
      && /waitedOut \?[\s\S]{0,140}?nothing was measured/.test(cliSrc)
      && /declined to verify \(skipped\) — nothing was measured/.test(cliSrc),
      "renderAkteDetail in src/client.ts");
    // an un-adjudicated RED tier-2 row must say so on the lane's own page: "nobody has looked at
    // this" is the state the adjudication rail exists to make visible, and it is precisely the one
    // that went unnoticed on 2026-07-26 when the trail had no reader at all.
    check("client: the dossier flags an un-adjudicated red tier-2 audit as un-ruled, not as merely red",
      /a\.result === "red"[\s\S]{0,160}?un-adjudicated — nobody has ruled on this red yet/.test(cliSrc),
      "renderAkteDetail in src/client.ts");
    const auditRender = cliSrc.slice(cliSrc.indexOf("for (const a of (audits as Capped<DossierAudit>"),
      cliSrc.indexOf("// --- the activity window"));
    check("client: the dossier renders remote FAIL names with the same 50×300 bounds as the wire",
      auditRender.includes(".slice(0, 50)") && auditRender.includes(".slice(0, 300)")
        && auditRender.includes("fails.map((name) => `FAIL  ${name}`)"),
      auditRender.slice(0, 240) || "no DossierAudit render block in src/client.ts");

    // (9e) THE DISPOSITION RAIL, CLIENT HALF. Same method and same limits as (9d): asserted over
    // the client SOURCE because this suite has no DOM harness — weaker than a render test, named
    // so, and it catches the two regressions that would silently corrupt the label evidence.
    // First: an outcome row with no owner label must render as UNLABELED. If someone ever defaults
    // the missing case to a verdict, every unjudged land silently becomes evidence.
    check("client: an outcome row with no owner label renders \"unlabeled\", never a default verdict",
      /const cur = dispoOf\("land", ref\)/.test(cliSrc)
      && /cur \? `your label: \$\{DISPO_WORD_UI\[cur\]\}` : "unlabeled"/.test(cliSrc),
      "the land label strip in renderOutcomes (src/client.ts)");
    // Second: the ✨ flow's three deterministic cases. `accepted` iff what was SENT is byte-equal to
    // what the enhancer returned, `edited` iff it was sent changed, `ignored` iff the box was
    // cleared by hand — and nothing at all in any other case (reload, re-run, auto-schedule).
    check("client: the ✨ flow writes accepted/edited from the SEND and ignored from a hand-cleared box",
      /text === p\.text\.trim\(\) \? "accepted" : "edited"/.test(cliSrc)
      && /ta\.value\.trim\(\) === ""[\s\S]{0,200}?labelDisposition\("enhance", p\.draftId, "ignored"\)/.test(cliSrc),
      "doSend + the ta input listener (src/client.ts)");
    check("client: a ✨ result dropped as stale arms no disposition watch (nothing was shown to rule on)",
      /pendingEnhance = j\.draftId \? \{ draftId: j\.draftId, text: j\.prompt \} : null/.test(cliSrc)
      && cliSrc.indexOf("pendingEnhance = j.draftId") > cliSrc.indexOf("if (ta.value.trim() === text &&"),
      "the enhance handler (src/client.ts)");

    // (9f) CRITERIA PROGRESS (docs/graduation-criteria.md §1 + §2). Unlike (9d)/(9e) this is not a
    // regex over the source: the counting rules are the whole point, so the REAL `kProgress` is cut
    // out of src/client.ts, transpiled (it is TS, and the browser bundle is the only other consumer)
    // and run against synthetic ledgers carrying every row shape. What stays unproved is the
    // rendering around it — this suite has no DOM harness — so the header's own gates are asserted
    // by regex right after.
    const kSrc = cliSrc.slice(cliSrc.indexOf("const K1_ANCHOR_BRANCH"), cliSrc.indexOf("let outcomeData"));
    check("client: the criteria counter is extractable as a pure function (no DOM in kProgress)",
      kSrc.includes("function kProgress") && !/document|el\(|chip\(/.test(kSrc), kSrc.slice(0, 80));
    const kProgress = new Function(
      new Bun.Transpiler({ loader: "ts" }).transformSync(kSrc) + "\nreturn kProgress;")() as
      (rows: unknown[]) => { anchored: boolean; k1: number; noConfirmStep: number; unknown: number;
        undos: number; k2: number };
    const kRow = (o: Record<string, unknown>): Record<string, unknown> =>
      ({ disposition: "landed", confirmedByHuman: false, ...o });
    // newest-first on purpose — that is the order the route serves, and the counter must sort itself.
    const kLedger = [
      kRow({ ts: 900, branch: "later-clean-2", cleanReviewShadow: { verdict: "would_stop" } }),
      kRow({ ts: 800, branch: "shadow-failed", cleanReviewShadow: { verdict: null, raw: true } }),
      kRow({ ts: 700, branch: "confirm-land", confirmedByHuman: true }),
      kRow({ ts: 600, branch: "killed-lane", disposition: "killed-dirty" }),
      kRow({ ts: 500, branch: "later-clean-1", cleanReviewShadow: { verdict: "pass" } }),
      kRow({ ts: 400, branch: "f9-verify-deps" }),                       // the anchor itself: excluded
      kRow({ ts: 300, branch: "legacy/pre-review-field" }),              // rows 1–4 shape: excluded
      kRow({ ts: 200, branch: "legacy-2", confirmedByHuman: true }),
    ];
    const k = kProgress(kLedger);
    check("criteria: K1 counts only lands AFTER the f9-verify-deps anchor — legacy rows and the anchor itself are out",
      k.anchored && k.k1 === 4, JSON.stringify(k));
    check("criteria: a confirm-land counts toward K1 but NOT toward the no-confirm-step sub-count",
      k.noConfirmStep === 3, JSON.stringify(k));
    check("criteria: a killed lane neither counts as a land nor breaks the streak",
      JSON.stringify(kProgress(kLedger.filter((o) => o.branch !== "killed-lane"))) === JSON.stringify(k),
      JSON.stringify(k));
    check("criteria: K2 counts recorded shadow verdicts; verdict null (failed measurement) is not one",
      k.k2 === 2, JSON.stringify(k));
    check("criteria: no undo in this ledger reads as 0 undos", k.undos === 0, JSON.stringify(k));
    // an undo is disposition:"reverted" (server.ts buildRevertedOutcome) — it breaks the CONSECUTIVE
    // streak §1 asks for, and is reported separately so a reset never reads as "nothing happened".
    const kUndo = kProgress([...kLedger, kRow({ ts: 650, branch: "confirm-land", disposition: "reverted" })]);
    check("criteria: an undo (disposition reverted) resets the K1 streak and is counted on its own",
      kUndo.k1 === 3 && kUndo.noConfirmStep === 2 && kUndo.undos === 1, JSON.stringify(kUndo));
    check("criteria: an undo does not retroactively drop shadow verdicts from K2", kUndo.k2 === 2, JSON.stringify(kUndo));
    check("criteria: an empty ledger is unanchored — nothing is counted, no zeros are claimed",
      JSON.stringify(kProgress([]))
      === JSON.stringify({ anchored: false, k1: 0, noConfirmStep: 0, unknown: 0, undos: 0, k2: 0 }),
      JSON.stringify(kProgress([])));

    // UNKNOWN ≠ ZERO, inside the counter that would license autonomy. `confirmedByHuman` is
    // OPTIONAL on OutcomeRow, so a row that records nothing must not be read as "no human
    // confirmed it" — that is the one direction of error that flatters the criterion.
    const kUnknown = kProgress([
      kRow({ ts: 400, branch: "f9-verify-deps" }),
      { ts: 500, branch: "no-flag-at-all", disposition: "landed" },          // (a) field absent
      { ts: 550, branch: "explicit-null", disposition: "landed", confirmedByHuman: null }, // absent's JSON twin
      kRow({ ts: 600, branch: "auto-clean" }),                               // (b) explicit false
      kRow({ ts: 700, branch: "owner-confirmed", confirmedByHuman: true }),  // (c) explicit true
    ]);
    check("criteria: a land with NO confirmedByHuman counts toward K1 but NOT toward the sub-count — unknown is not false",
      kUnknown.k1 === 4 && kUnknown.noConfirmStep === 1, JSON.stringify(kUnknown));
    check("criteria: the unknown lands are counted on their own, never silently dropped (absent and null alike)",
      kUnknown.unknown === 2, JSON.stringify(kUnknown));
    check("criteria: an explicit confirmedByHuman:false is still a no-confirm-step land, an explicit true still is not",
      kProgress([kRow({ ts: 400, branch: "f9-verify-deps" }), kRow({ ts: 500, branch: "auto" })]).noConfirmStep === 1
      && kProgress([kRow({ ts: 400, branch: "f9-verify-deps" }),
        kRow({ ts: 500, branch: "owner", confirmedByHuman: true })]).noConfirmStep === 0,
      JSON.stringify(kUnknown));
    check("criteria: an undo resets the unknown count with the rest of the streak",
      kProgress([kRow({ ts: 400, branch: "f9-verify-deps" }),
        { ts: 500, branch: "no-flag", disposition: "landed" },
        kRow({ ts: 600, branch: "confirm-land", disposition: "reverted" })]).unknown === 0);

    // §2 (`docs/graduation-criteria.md`) carries NO anchor requirement — the anchor is about the F9
    // verify fix's deploy boundary and says nothing about ② shadow verdicts. A ledger that cannot
    // be anchored must still report the verdicts it recorded.
    const kNoAnchor = kProgress(kLedger.filter((o) => o.branch !== "f9-verify-deps"));
    check("criteria: without the anchor row §1 counts nothing rather than counting from row 1",
      kNoAnchor.anchored === false && kNoAnchor.k1 === 0 && kNoAnchor.noConfirmStep === 0
      && kNoAnchor.unknown === 0 && kNoAnchor.undos === 0, JSON.stringify(kNoAnchor));
    check("criteria: K2 counts recorded shadow verdicts even when the ledger has no anchor row (§2 has none)",
      kNoAnchor.k2 === 2, JSON.stringify(kNoAnchor));
    check("client: the criteria header is gated on there being rows at all (empty ledger → no header)",
      /if \(outcomeData\.length\) \{\s*\n\s*const k = kProgress\(outcomeData\);/.test(cliSrc),
      "the criteria block in renderOutcomes (src/client.ts)");
    // the negative half is scoped to the header block on purpose: a phrase like "criterion met" is
    // legitimate PROSE anywhere else in the file, and only a verdict RENDERED here would be the
    // regression (the client counting toward a criterion and then declaring it satisfied).
    const kBlock = cliSrc.slice(cliSrc.indexOf("if (outcomeData.length) {"),
      cliSrc.indexOf("const rows = outcomeData.filter"));
    check("client: the criteria header counts and does not evaluate (no met/passed banner)",
      /K1 \$\{k\.k1\}\/20/.test(kBlock) && /K2 \$\{k\.k2\}\/25/.test(kBlock)
      && !/criterion met|criteria met|graduated|erfüllt/i.test(kBlock), kBlock.slice(0, 60));
    // the header must not read as a claim the counter cannot support: whenever any land in the
    // streak recorded no confirmedByHuman, the sub-count chip is accompanied by the unknown count.
    // Source-level like the rest of (9d)–(9f) — no DOM harness here.
    check("client: the criteria header surfaces the unknown lands next to the sub-count",
      /davon \$\{k\.noConfirmStep\}\/10/.test(kBlock)
      && /if \(k\.unknown\) kel\.appendChild\(chip\(`\$\{k\.unknown\} unknown`, "warn"/.test(kBlock),
      kBlock.slice(kBlock.indexOf("davon"), kBlock.indexOf("davon") + 60));
    // TRUTH IN LABELS. `confirmedByHuman:false` records that no second confirm click was needed; it
    // is NOT evidence that nobody was attending, because every caller of mergeJob is a ROUTE — since
    // 2026-08-24 two of them, the owner merge route and the Program-MAIN self-land route, and no
    // tick (pinned in e2e/pins.ts). §1 wants UNATTENDED lands, so the chip that counts toward it
    // must not use the word the criterion uses for a property this data cannot show.
    check("client: the sub-count chip names the confirm step and never claims an unattended land",
      /ohne Confirm-Schritt|no confirm step/i.test(kBlock)
      && /nicht|not evidence|NOT evidence/.test(kBlock)
      && /one caller|POST \/api\/slots\/:id\/merge/.test(kBlock)
      && !/clean auto-land/.test(kBlock), kBlock.slice(kBlock.indexOf("davon"), kBlock.indexOf("davon") + 120));
    // and the K2 chip sits OUTSIDE the anchored branch, matching the counter: §2 asks for no anchor,
    // so an unanchorable ledger still shows its shadow verdicts instead of hiding them behind §1.
    check("client: the K2 chip is rendered outside the anchored branch (§2 needs no anchor)",
      // indentation IS the structure here: the §1 chips sit six-deep inside `else {`, the K2 chip
      // four-deep beside the whole if/else — that is what "shown even when unanchored" looks like.
      /\n {4}kel\.appendChild\(chip\(`K2 \$\{k\.k2\}\/25`/.test(kBlock)
      && /\n {6}kel\.appendChild\(chip\(`K1 \$\{k\.k1\}\/20`/.test(kBlock),
      kBlock.slice(kBlock.indexOf("OUTSIDE the anchored branch"), kBlock.indexOf("OUTSIDE the anchored branch") + 60));

    // (9g) THE VERIFY BADGE'S FOUR STATES. Same method and same limits as (9d)/(9e) — a regex over
    // the client SOURCE, no DOM harness — and it lives here because this is the only module that
    // reads that source; the behaviour it guards is the merge/land family's (e2e/merge.ts, V1).
    // The regression that matters: the skipped state (verify.ok === null) collapsing back into a
    // boolean, which would render a gate that ran NOTHING as either green or red. It must be its
    // own branch, tested BEFORE the falsy `!v.ok` one, and the four states must stay four.
    const vbBlock = cliSrc.slice(cliSrc.indexOf("function verifyBadge"), cliSrc.indexOf("function showVerifyOutput"));
    check("client: the verify badge carries a skipped state of its own, checked before the red one",
      /ok: boolean \| null/.test(cliSrc)
      && /if \(v\.ok === null\)/.test(vbBlock) && /vbadge skip/.test(vbBlock)
      && vbBlock.indexOf("v.ok === null") < vbBlock.indexOf("if (!v.ok)"),
      "verifyBadge in src/client.ts");
    check("client: the verify badge renders all four states and only the passing one reads green",
      /vbadge none/.test(vbBlock) && /vbadge skip/.test(vbBlock) && /vbadge bad/.test(vbBlock)
      && /vbadge ok/.test(vbBlock) && (vbBlock.match(/vbadge ok/g) ?? []).length === 1,
      "verifyBadge in src/client.ts");

    // (9h) THE POST-LAND AUDIT ALARM, CLIENT HALF. Tier 2 gates nothing, so RENDERING its result is
    // the entire safety net — a red audit nobody sees is a red audit that never happened (two went
    // unread on 2026-07-26, when the field was shipped 30×/minute to a client with no reader at
    // all). The classifier is imported from src/plaudit.ts and RUN (kProgress above is still cut
    // out of client.ts): the rules (green is silent, red ≠ unknown, an ack is keyed to one audit)
    // are the whole point and a regex would only prove the words are present. The rendering
    // around it stays regex-asserted — no DOM harness here — and the ON-path server behaviour
    // lives in ./e2e-postland-audit.sh.
    type PlaAudit = { at: number; result: string; repo: string; main: string; mainSha: string;
      covers: string[]; reason?: string };
    type PlaAlarm = { tone: string; headline: string; where: string; note: string } | null;
    // what is asserted about client.ts is that it SHIPS the module under test — a classifier
    // re-inlined there would leave every alarm check below measuring code the bundle never runs
    check("client: renderPostLandAudit takes postLandAlarm and its ack key from src/plaudit.ts, the module under test",
      /import \{[^}]*\bpostLandAlarm\b[^}]*\} from "\.\/plaudit"/.test(cliSrc)
      && /import \{[^}]*\bPLA_ACK_KEY\b[^}]*\} from "\.\/plaudit"/.test(cliSrc),
      "the plaudit import in src/client.ts");
    const plaRow = (o: Partial<PlaAudit>): PlaAudit =>
      ({ at: 1000, result: "red", repo: "claude-fleet", main: "main",
        mainSha: "abcdef0123456789", covers: ["fleet/lane-a"], ...o });
    const plaCall = (a: PlaAudit | null, acked = 0): PlaAlarm => {
      try { return postLandAlarm(a, acked); } catch { return null; }
    };
    check("alarm: a GREEN audit raises nothing — a passing suite is the expected case",
      plaCall(plaRow({ result: "green" })) === null && plaCall(null) === null,
      JSON.stringify(plaCall(plaRow({ result: "green" }))));
    const plaRed = plaCall(plaRow({ covers: ["fleet/lane-a", "fleet/lane-b"] }));
    check("alarm: a RED audit raises an alarm that NAMES the land(s) it covers",
      plaRed?.tone === "red" && plaRed.where.includes("fleet/lane-a") && plaRed.where.includes("fleet/lane-b")
      && plaRed.where.includes("abcdef01"), JSON.stringify(plaRed));
    // unknown ≠ red and unknown ≠ green (A4): a measurement that never happened is neither a pass
    // nor a defect, and its REASON is the only thing that says which non-measurement it was.
    const plaUnk = plaCall(plaRow({ result: "unknown", reason: "audit timed out after 1800000ms — no verdict" }));
    check("alarm: an UNKNOWN audit is its own tone and carries the reason (a non-measurement, not a defect)",
      plaUnk?.tone === "unknown" && plaUnk.where.includes("timed out")
      && !/\bred\b/i.test(plaUnk.headline), JSON.stringify(plaUnk));
    // the ack is keyed to ONE audit's `at`. A sticky "dismissed" flag would swallow the next alarm.
    check("alarm: acknowledging THIS audit silences it — and only it",
      plaCall(plaRow({}), 1000) === null && plaCall(plaRow({ at: 2000 }), 1000)?.tone === "red",
      JSON.stringify(plaCall(plaRow({ at: 2000 }), 1000)));
    check("alarm: an audit naming no lane says so — coverage-not-recorded never reads as 'after nothing'",
      /not recorded|no lane/i.test(plaCall(plaRow({ covers: [] }))?.where ?? ""),
      JSON.stringify(plaCall(plaRow({ covers: [] }))));
    check("client: the poll payload's postLandAudit is read on every refresh and rendered",
      /postLandAudit\?:/.test(cliSrc) && /postLandAudit = data\.postLandAudit \?\? null/.test(cliSrc)
      && /renderPostLandAudit\(\)/.test(cliSrc), "refresh() in src/client.ts");
    check("client: the ack button records THIS audit's `at`, so a later alarm is not pre-dismissed",
      /localStorage\.setItem\(PLA_ACK_KEY, String\(postLandAudit\?\.at \?\? 0\)\)/.test(cliSrc),
      "renderPostLandAudit in src/client.ts");

    // (9i) ABSENT ≠ FALSE at the land-shape render sites. `confirmedByHuman` is OPTIONAL on the row,
    // and the renderer used to print the strongest positive claim in the whole feed ("auto-landed
    // clean+green") for a row that recorded NOTHING. Its neighbours have the same shape. And the
    // wording itself: `confirmedByHuman:false` means "no confirm step", never "no human involved" —
    // every caller of mergeJob is a route (POST /api/slots/:id/merge and, since 2026-08-24,
    // POST /api/self/tasks/:id/land), so every land on the ledger was started by a request some
    // principal made.
    const ocBlock = cliSrc.slice(cliSrc.indexOf('if (dispo === "landed") {'),
      cliSrc.indexOf("row.appendChild(facts);"));
    check("client: an absent confirmedByHuman renders as not-recorded, never as a positive land claim",
      /o\.confirmedByHuman === true/.test(ocBlock) && /o\.confirmedByHuman === false/.test(ocBlock)
      && /not recorded/.test(ocBlock) && !/auto-landed clean\+green/.test(cliSrc), ocBlock.slice(0, 200));
    check("client: the confirm chip says what the field measures (confirm step), not who was attending",
      /confirm step/i.test(ocBlock) && /one caller|POST \/api\/slots\/:id\/merge/.test(ocBlock),
      ocBlock.slice(0, 200));
    check("client: resolvedConflict / repairRounds distinguish a recorded 'no' from no record at all",
      /o\.resolvedConflict === true/.test(ocBlock) && /o\.resolvedConflict !== "boolean"|typeof o\.resolvedConflict/.test(ocBlock)
      && /typeof o\.repairRounds/.test(ocBlock), ocBlock.slice(0, 300));
    // and the null-collision one file over: `briefHash: null` is carried by every lane briefed
    // through a route that logs no owner prompt, and all those nulls compare equal. Absence must not
    // render as an identifier, or two unbriefed rows read as "briefed alike".
    check("client: an absent briefHash renders as no-brief-on-record, never as an identity two rows share",
      /o\.briefHash\s*$/m.test(ocBlock) && /no brief on record/.test(ocBlock)
      && /ABSENT value/.test(ocBlock) && /never a hash/.test(ocBlock), ocBlock.slice(0, 200));
    check("client: an absent ownerPrompts is not rendered as a measured zero",
      !/\$\{o\.ownerPrompts \?\? 0\}/.test(cliSrc) && /typeof o\.ownerPrompts === "number"/.test(cliSrc),
      "the owner-prompt chip in renderOutcomes (src/client.ts)");

    // (10) THE REBASE CASE — the reason the relation is content identity and not commit identity:
    // the land path rebases the lane onto main before the ff-merge, so the landed commit is NEVER
    // the reviewed commit on a clean land. The diff is byte-identical, so the review DID describe
    // what landed and the row must say covered. A sha/cache-key comparison fails exactly here.
    const ocReb = (await (await post("/api/lanes", { repo: oRepo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${ocReb.cwd}/rebased.txt`, "reviewed before the rebase\n");
    spawnSync("git", ["-C", ocReb.cwd, "add", "rebased.txt"]);
    spawnSync("git", ["-C", ocReb.cwd, "commit", "-qm", "rebase-case lane work"]);
    const rebRev = (await (await post(`/api/slots/${ocReb.slot}/review`, {})).json()) as { head: string | null };
    check("rebase-case setup: the lane is reviewed BEFORE main moves", /^[0-9a-f]{40}$/.test(rebRev.head ?? ""), String(rebRev.head));
    await Bun.write(`${oRepo}/rebase-main.txt`, "main side\n"); // different file → clean rebase, no agent
    spawnSync("git", ["-C", oRepo, "add", "rebase-main.txt"]);
    spawnSync("git", ["-C", oRepo, "commit", "-qm", "main work under the reviewed lane"]);
    await settleForMerge(ocReb.slot);
    await post(`/api/slots/${ocReb.slot}/merge`, {});
    const vReb = await waitMerge(ocReb.slot);
    check("rebase-case setup: the lane rebases onto main and auto-lands", vReb.gone, JSON.stringify(vReb));
    const recReb = forBranch(await readOutcomes(), ocReb.branch);
    check("outcome: a REBASED land whose diff is unchanged is covered, not superseded (content id, not sha)",
      recReb?.review?.state === "covered" && recReb?.review?.patchId === recReb?.review?.landedPatchId
      && typeof recReb?.review?.patchId === "string",
      JSON.stringify(recReb?.review ?? null).slice(0, 220));
    check("outcome: the rebase really did move the commit (the sha comparison would have said superseded)",
      !!recReb?.headSha && !!recReb?.review?.head && recReb.headSha !== recReb.review.head,
      JSON.stringify({ landed: recReb?.headSha, reviewed: recReb?.review?.head }));

    // never reviewed at all → an explicit answer, not an absent field
    const ocNone = (await (await post("/api/lanes", { repo: oRepo })).json()) as { slot: number; branch: string };
    await post(`/api/slots/${ocNone.slot}/kill`, {});
    const recNone = forBranch(await readOutcomes(), ocNone.branch);
    check("outcome: a never-reviewed lane records review.state \"none\" (an answer, not a missing field)",
      recNone?.review?.state === "none" && !("findings" in (recNone?.review ?? {})),
      JSON.stringify(recNone?.review));
    // …and every row the SERVER wrote does. The one synthetic row appended by (9c) is excluded by
    // branch: it is the deliberately hand-written pre-review-field shape, and its whole point is
    // that the key is missing — asserting it here would contradict the check it exists for.
    const written = (await readOutcomes()).filter((o) => o.branch !== "legacy/pre-review-field").slice(0, 12);
    check("outcome: every disposition the server wrote carries the review relation, including reverted",
      written.every((o) => typeof o.review?.state === "string"),
      JSON.stringify(written.map((o) => o.review?.state)));

    // access model: the read route is owner-only — no token → 401 (same as /api/audit)
    check("lane-outcomes route requires the owner token", (await fetch(BASE + "/api/lane-outcomes")).status === 401);
    // the trail returns a total count alongside the (limited) window, newest-first
    const finalRead = (await (await get("/api/lane-outcomes?limit=1000")).json()) as
      { outcomes: Outcome[]; total: number; malformed: number };
    check("lane-outcomes returns { outcomes, total } with all five dispositions present",
      finalRead.total >= 5 && ["landed", "killed-dirty", "killed-empty", "shelved", "reverted"]
        .every((d) => finalRead.outcomes.some((o) => o.disposition === d)),
      JSON.stringify({ total: finalRead.total, seen: [...new Set(finalRead.outcomes.map((o) => o.disposition))] }));
    // the counts must be separable even on a HEALTHY file: `total` is what parsed, `malformed` is
    // the hole. Reporting only one number is what let a torn row hide behind the cap message
    // (the torn-file proof itself is in land-provenance.ts, on the one trail nothing here writes).
    check("lane-outcomes reports malformed separately from total (0 on an intact trail)",
      finalRead.malformed === 0 && finalRead.total === finalRead.outcomes.length,
      JSON.stringify({ total: finalRead.total, malformed: finalRead.malformed, rows: finalRead.outcomes.length }));
    const auditShape = (await (await get("/api/audit?limit=1000")).json()) as { events: unknown[]; total: number; malformed: number };
    check("audit trail reports malformed separately from total too (same reader, same contract)",
      auditShape.malformed === 0 && auditShape.total >= auditShape.events.length,
      JSON.stringify({ total: auditShape.total, malformed: auditShape.malformed, rows: auditShape.events.length }));
    const dispoShape = (await (await get("/api/dispositions")).json()) as { dispositions: unknown[]; total: number; malformed: number };
    check("disposition rail reports malformed separately from total too",
      dispoShape.malformed === 0 && dispoShape.total === dispoShape.dispositions.length,
      JSON.stringify({ total: dispoShape.total, malformed: dispoShape.malformed, rows: dispoShape.dispositions.length }));
  }
}
