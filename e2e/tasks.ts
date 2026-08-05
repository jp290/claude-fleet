// The task queue (owner CRUD + dispatch availability) and the Tier-0 gates: the master stop and
// quiet hours reach the DISPATCHER too, proven against a positive control.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { check, get, post, restartSrv, REPO, ROOT } from "./harness";
import { buildEvalPrompt } from "../eval-prompt";
import type { Ctx } from "./ctx";

export async function run(ctx: Ctx): Promise<void> {
  // --- task queue (Phase D). Owner CRUD + dispatch availability ---
  const tCreate = await post("/api/tasks", { text: "e2e owner task", queue: false });
  const tJson = (await tCreate.json()) as { ok: boolean; task: { id: string; status: string; source: string; kind: string } };
  check("create owner task as pending", tCreate.ok && tJson.task.status === "pending" && tJson.task.source === "owner");
  check("an owner task is kind \"lane\" — a runnable brief, dispatchable once queued",
    tJson.task.kind === "lane", JSON.stringify(tJson.task));
  check("queue a task", (await post(`/api/tasks/${tJson.task.id}/queue`, {})).ok);
  const sessT = (await (await get("/api/sessions")).json()) as { tasks: { id: string; status: string }[]; dispatch: { available: boolean; on: boolean } };
  check("queued task reflected in sessions", sessT.tasks.some((t) => t.id === tJson.task.id && t.status === "queued"));
  check("dispatch reports available when repo set", sessT.dispatch.available === true);
  check("unqueue a task", (await post(`/api/tasks/${tJson.task.id}/unqueue`, {})).ok);
  check("delete a task", (await post(`/api/tasks/${tJson.task.id}/delete`, {})).ok);
  check("deleted task gone", !(await (await get("/api/sessions")).json() as { tasks: { id: string }[] }).tasks.some((t) => t.id === tJson.task.id));

  // --- payload budget (docs/data-saver.md §1, lane A). /api/sessions is polled every 2 s by every
  // open tab, so a queue of long prompts must not ride along: measured on the live fleet 2026-07-26,
  // 107 521 B of a 112 410 B response were the 39 task texts. The poll carries digests; the text
  // stays reachable behind GET /api/tasks, which is what the queue overlay reads. Non-tautological:
  // the probe task is proven PRESENT in the same payload that is proven small. ---
  {
    const MARK = "payload-budget-probe";
    const big = `${MARK} ${"x".repeat(15_000 - MARK.length - 1)}`;
    const bigT = (await (await post("/api/tasks", { text: big, queue: false })).json()) as { task: { id: string } };
    const raw = await (await get("/api/sessions")).text();
    const bytes = Buffer.byteLength(raw);
    const dig = (JSON.parse(raw) as { tasks: { id: string; text?: string }[] }).tasks.find((t) => t.id === bigT.task.id);
    check("control: the 15 KB task IS in the polled payload (so the size check below can fail)", !!dig, `${bytes} B`);
    check("the sessions poll carries a task digest, never the prompt text",
      !!dig && dig.text === undefined && !raw.includes(MARK), JSON.stringify(dig));
    check("the sessions payload stays under 10 KB with a 15 KB task in the queue", bytes < 10 * 1024, `${bytes} B`);
    const fullT = ((await (await get("/api/tasks")).json()) as { tasks: { id: string; text: string }[] })
      .tasks.find((t) => t.id === bigT.task.id);
    check("the full prompt text is reachable behind GET /api/tasks (what the queue overlay renders)",
      fullT?.text === big, `${fullT?.text.length ?? -1} of ${big.length} chars`);
    await post(`/api/tasks/${bigT.task.id}/delete`, {});
  }
  // the dispatch switch carries the same contract as /api/autos/switch: the dangerous direction is
  // OFF, because a stop that lives only in memory is silently re-armed by the next srv respawn
  // (boot reloads `dispatch` from fleet.json and the dispatcher spawns lanes again).
  // Non-tautological: `dispatch` starts out false on disk, so the stop is only observable if the
  // file says TRUE first — dispatch is turned on and that ON is pinned into fleet.json through an
  // UNRELATED saveState (a task create+delete), which a switch that never persists cannot fake.
  const dispPersisted = (): boolean | undefined =>
    (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as { dispatch?: boolean }).dispatch;
  await post("/api/dispatch", { on: true });
  const pin = (await (await post("/api/tasks", { text: "dispatch-persist-pin", queue: false })).json()) as { task: { id: string } };
  await post(`/api/tasks/${pin.task.id}/delete`, {});
  await Bun.sleep(150);
  check("control: the persisted state reads dispatch:true right before the stop (so the check below can fail)",
    dispPersisted() === true, `dispatch=${dispPersisted()}`);
  const dispOff = await post("/api/dispatch", { on: false });
  check("dispatch toggle endpoint works", dispOff.ok && ((await dispOff.json()) as { on?: boolean }).on === false);
  await Bun.sleep(150); // let the route's saveState land
  check("the dispatch stop is persisted immediately (so a restart stays stopped)",
    dispPersisted() === false, `dispatch=${dispPersisted()}`);
  const dispAudit = ((await (await get("/api/audit?limit=100")).json()) as { events: { event?: string; detail?: string }[] })
    .events.find((e) => e.event === "dispatch_switch");
  check("the dispatch stop leaves an audit entry recording the direction",
    dispAudit?.detail === "off", JSON.stringify(dispAudit));

  // --- Tier-0 (synergy-findings.md #1): the master stop + quiet hours reach the DISPATCHER too,
  // not just scheduled autos. MUST run before the restart section below — that restart respawns srv
  // WITHOUT FLEET_DISPATCH_REPO, permanently disabling the dispatcher. Non-tautological: the SAME
  // queued task is actually dispatched once both gates open (positive control), proving the negatives
  // stayed queued because of the gate, not a dead queue. Preserves the persistence lane
  // (ctx.restartSelfSlot) that the restart section needs alive. ---
  {
    const DISP_TICK_MS = 9000; // > the 8s tickDispatch interval, so a full tick fires within the wait
    const sessJson = async (): Promise<{ slots: { id: number; cwd: string | null; worktree: unknown | null }[]; tasks: { id: string; status: string; note?: string }[]; dispatch: { on: boolean; maxLanes: number }; autosOn: boolean; quietHours: unknown }> =>
      (await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null; worktree: unknown | null }[]; tasks: { id: string; status: string; note?: string }[]; dispatch: { on: boolean; maxLanes: number }; autosOn: boolean; quietHours: unknown };
    const laneIds = async (): Promise<number[]> => (await sessJson()).slots.filter((s) => s.worktree).map((s) => s.id);
    // free every worktree lane EXCEPT the persistence lane, so lanes < maxLanes and a slot is free
    for (const id of await laneIds()) if (id !== ctx.restartSelfSlot) await post(`/api/slots/${id}/kill`, {});
    await Bun.sleep(600);
    await post("/api/dispatch", { on: true });
    const sess0 = await sessJson();
    const lanes0 = new Set(sess0.slots.filter((s) => s.worktree).map((s) => s.id));
    check("dispatch gate: precondition — dispatcher on, a free slot, lanes < cap (non-tautology guard)",
      sess0.dispatch.on === true && sess0.slots.some((s) => !s.cwd) && lanes0.size < sess0.dispatch.maxLanes,
      `on=${sess0.dispatch.on} free=${sess0.slots.filter((s) => !s.cwd).length} lanes=${lanes0.size}/${sess0.dispatch.maxLanes}`);
    const taskStatus = async (id: string): Promise<string | undefined> => (await sessJson()).tasks.find((t) => t.id === id)?.status;

    // (a) master stop: pause BEFORE queuing (no consumption window), then a full tick must not consume
    await post("/api/autos/switch", { on: false });
    const dTask = (await (await post("/api/tasks", { text: "dispatch-gate-probe", queue: false })).json()) as { task: { id: string } };
    const tid = dTask.task.id;
    await post(`/api/tasks/${tid}/queue`, {});
    await Bun.sleep(DISP_TICK_MS);
    check("master stop (autosOn=false) keeps a dispatch task QUEUED — dispatcher never spawns a lane",
      (await taskStatus(tid)) === "queued" && (await laneIds()).length === lanes0.size, `status=${await taskStatus(tid)} lanes=${(await laneIds()).length} (was ${lanes0.size})`);

    // (b) quiet hours: quiet fleet must NOT consume the still-queued task either
    await post("/api/autos/switch", { on: true });
    const dQh = new Date().getHours();
    await post("/api/autos/quiet", { start: dQh, end: (dQh + 2) % 24 });
    await Bun.sleep(DISP_TICK_MS);
    check("quiet hours keep a dispatch task QUEUED — dispatcher suppressed like the autos surface",
      (await taskStatus(tid)) === "queued" && (await laneIds()).length === lanes0.size, `status=${await taskStatus(tid)} lanes=${(await laneIds()).length} (was ${lanes0.size})`);

    // (c) positive control: both gates open → the SAME task is dispatched (proves the gate is causal)
    await post("/api/autos/quiet", { start: null });
    let consumed = false;
    for (let i = 0; i < 30; i++) { // up to ~15s (≈2 ticks) for the now-eligible task to be dispatched
      await Bun.sleep(500);
      if ((await taskStatus(tid)) !== "queued") { consumed = true; break; }
    }
    const sessEnd = await sessJson();
    const tEnd = sessEnd.tasks.find((x) => x.id === tid);
    check("with both gates open the dispatcher DOES consume the same task (proves the gate, not a dead queue)",
      consumed, `task=${JSON.stringify(tEnd)} dispatchOn=${sessEnd.dispatch.on} autosOn=${sessEnd.autosOn} quiet=${JSON.stringify(sessEnd.quietHours)}`);

    // (d) the lane's founding prompt is the COMPILED brief (the fakeenh stand-in's fixed
    // output), never the raw task text (BACKLOG P-9). Proven off the prompt ledger: the
    // dispatcher's logPrompt records source:"auto" with exactly what sendText injected.
    let autoRows: { source?: string; text?: string }[] = [];
    for (let i = 0; i < 24; i++) { // sendText lands ~4-5s after consumption (boot sleep + compile)
      autoRows = (((await (await get("/api/prompts?limit=100")).json()) as { prompts: { source?: string; text?: string }[] }).prompts)
        .filter((p) => p.source === "auto");
      if (autoRows.some((p) => p.text === "enhanced prompt. own your work! /sharpen3")) break;
      await Bun.sleep(500);
    }
    check("the dispatched lane's founding prompt is the COMPILED brief, never the raw task text",
      autoRows.some((p) => p.text === "enhanced prompt. own your work! /sharpen3")
      && !autoRows.some((p) => (p.text ?? "").includes("dispatch-gate-probe")),
      JSON.stringify(autoRows.slice(0, 3)).slice(0, 300));

    // (e) capacity honesty: saturate the dispatch repo to the cap with a hand-opened lane, queue
    // one more task — the tick must write WHY on the row instead of leaving it silent.
    const capLane = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot?: number };
    const sessCap = await sessJson();
    check("capacity setup: lanes in the dispatch repo reach maxLanes (so the wait-note check below can fail)",
      typeof capLane.slot === "number" && sessCap.slots.filter((s) => s.worktree).length >= sessCap.dispatch.maxLanes,
      `lanes=${sessCap.slots.filter((s) => s.worktree).length}/${sessCap.dispatch.maxLanes}`);
    const cTask = (await (await post("/api/tasks", { text: "capacity-wait-probe", queue: true })).json()) as { task: { id: string } };
    let cNote = "";
    for (let i = 0; i < 24; i++) { // a full 8s tick fires within this wait
      cNote = (await sessJson()).tasks.find((t) => t.id === cTask.task.id)?.note ?? "";
      if (cNote) break;
      await Bun.sleep(500);
    }
    check("a queued task blocked by the lane cap says WHY on its own row (waiting note, not silence)",
      /^waiting: \d+\/\d+ lanes busy/.test(cNote), JSON.stringify(cNote));
    // manual start ("▸ start lane") bypasses the cap: the cap bounds UNATTENDED fan-out, and
    // this is an attended owner click — the very task that just waited spawns immediately.
    // The status flips to `sent` synchronously inside the route, so no poll is needed.
    const byp = await post(`/api/tasks/${cTask.task.id}/dispatch`, {});
    const bypJ = (await byp.json()) as { ok?: boolean; slot?: number };
    const bypRow = (await sessJson()).tasks.find((t) => t.id === cTask.task.id);
    check("manual start bypasses the lane cap (attended click beats the unattended-fan-out bound)",
      byp.ok && bypJ.ok === true && bypRow?.status === "sent", `${byp.status} ${JSON.stringify({ bypJ, bypRow })}`);

    // cleanup — dispatcher OFF FIRST: killing the bypass lane below can land inside its own
    // brief tail, whose identity re-check then REQUEUES the task; with the tick still on, that
    // requeued probe could be re-dispatched into a freshly freed slot and leak a lane. Then
    // kill every lane this section spawned (never the persistence lane) and delete the probes.
    await post("/api/dispatch", { on: false });
    for (const id of await laneIds()) if (!lanes0.has(id) && id !== ctx.restartSelfSlot) await post(`/api/slots/${id}/kill`, {});
    await post(`/api/tasks/${cTask.task.id}/delete`, {});
    await post(`/api/tasks/${tid}/delete`, {});
  }

  // --- (f) the manual start button with the auto dispatcher OFF, and the archive shelf ---
  {
    const fSess = async (): Promise<{ tasks: { id: string; status: string; slot?: number }[] }> =>
      (await (await get("/api/sessions")).json()) as { tasks: { id: string; status: string; slot?: number }[] };
    const mT = (await (await post("/api/tasks", { text: "manual-start-probe", queue: false })).json()) as { task: { id: string } };
    const md = await post(`/api/tasks/${mT.task.id}/dispatch`, {});
    const mdJ = (await md.json()) as { ok?: boolean; slot?: number; branch?: string };
    check("manual start dispatches a PENDING task with the auto dispatcher OFF (the button is tick-independent)",
      md.ok && mdJ.ok === true && typeof mdJ.slot === "number" && (mdJ.branch ?? "").startsWith("fleet/"),
      `${md.status} ${JSON.stringify(mdJ)}`);
    const mdRow = (await fSess()).tasks.find((t) => t.id === mT.task.id);
    check("the manually started task is sent and bound to the spawned lane before the route answers",
      mdRow?.status === "sent" && mdRow.slot === mdJ.slot, JSON.stringify(mdRow));
    check("manual start refuses a sent task (409 — it is already running)",
      (await post(`/api/tasks/${mT.task.id}/dispatch`, {})).status === 409);
    const mdAudit = ((await (await get("/api/audit?limit=50")).json()) as { events: { event?: string; detail?: string }[] })
      .events.find((e) => e.event === "task_dispatch" && e.detail === mT.task.id);
    check("manual start is audited (task_dispatch — an owner act, distinct from the tick)",
      !!mdAudit, JSON.stringify(mdAudit ?? null));
    if (typeof mdJ.slot === "number") await post(`/api/slots/${mdJ.slot}/kill`, {});
    await post(`/api/tasks/${mT.task.id}/delete`, {});

    // archive: a shelf, not a delete — the row survives with its history, is terminal for the
    // dispatcher and the start button alike, and restore goes back to owner review
    const aT = (await (await post("/api/tasks", { text: "archive-probe", queue: false })).json()) as { task: { id: string } };
    check("archive a pending task", (await post(`/api/tasks/${aT.task.id}/archive`, {})).ok);
    check("the archived row survives with status archived (history kept, list uncluttered)",
      (await fSess()).tasks.find((t) => t.id === aT.task.id)?.status === "archived",
      JSON.stringify((await fSess()).tasks.find((t) => t.id === aT.task.id)));
    check("manual start refuses an archived task (409 — terminal until restored)",
      (await post(`/api/tasks/${aT.task.id}/dispatch`, {})).status === 409);
    check("restore returns an archived task to pending (owner review, never straight to queued)",
      (await post(`/api/tasks/${aT.task.id}/unarchive`, {})).ok
      && (await fSess()).tasks.find((t) => t.id === aT.task.id)?.status === "pending",
      JSON.stringify((await fSess()).tasks.find((t) => t.id === aT.task.id)));
    await post(`/api/tasks/${aT.task.id}/delete`, {});
  }

  // --- (g) per-task repo binding: the TASK decides where its lane spawns (owner-only) ---
  {
    const gSess = async (): Promise<{ slots: { id: number; worktree: { repo: string } | null }[] }> =>
      (await (await get("/api/sessions")).json()) as { slots: { id: number; worktree: { repo: string } | null }[] };
    // a second scratch repo next to the harness repo — the whole point is repo ≠ dispatcher default
    const REPO2 = `${ROOT}/repo2`;
    spawnSync("git", ["init", "-q", REPO2]);
    await Bun.write(`${REPO2}/readme.md`, "repo2\n");
    spawnSync("git", ["-C", REPO2, "add", "-A"]);
    spawnSync("git", ["-C", REPO2, "commit", "-qm", "init"]);
    const rT = (await (await post("/api/tasks", { text: "repo2-probe", queue: false, repo: REPO2 })).json()) as { task: { id: string; repo?: string } };
    check("an owner task can carry a target repo (stored resolved)",
      typeof rT.task.repo === "string" && rT.task.repo.endsWith("/repo2"), JSON.stringify(rT.task));
    const rd = await post(`/api/tasks/${rT.task.id}/dispatch`, {});
    const rdJ = (await rd.json()) as { ok?: boolean; slot?: number };
    const rLane = typeof rdJ.slot === "number" ? (await gSess()).slots.find((s) => s.id === rdJ.slot) : undefined;
    check("manual start spawns the lane from the TASK's repo, not the dispatcher default",
      rd.ok && rdJ.ok === true && (rLane?.worktree?.repo ?? "").endsWith("/repo2"),
      `${rd.status} ${JSON.stringify({ rdJ, wt: rLane?.worktree ?? null })}`);
    check("a non-directory repo is refused at task create (400)",
      (await post("/api/tasks", { text: "x", repo: `${ROOT}/does-not-exist-xyz` })).status === 400);
    if (typeof rdJ.slot === "number") await post(`/api/slots/${rdJ.slot}/kill`, {});
    await post(`/api/tasks/${rT.task.id}/delete`, {});
  }

  // --- (h) the eval gate: pending lane tasks get a batched verdict; "auto" runs unattended,
  // "review" waits for the owner, and every worker failure fails CLOSED (the ② contract on the
  // queue). Needs its own server env (stand-in + 1s sweep + cap 1), so this section restarts srv —
  // FLEET_DISPATCH_REPO rides along explicitly because restartSrv builds the spawn line from
  // process.env and the wrapper only ever put that knob in the SERVER's env, not this process's.
  {
    interface HRow { id: string; status: string; note?: string; slot?: number; eval?: { verdict: string; reason: string; at?: number } }
    const hSess = async (): Promise<{ tasks: HRow[]; dispatch: { repo: string } }> =>
      (await (await get("/api/sessions")).json()) as { tasks: HRow[]; dispatch: { repo: string } };
    // the stand-in follows the FLEET_*_CMD convention (prompt on stdin, answer on stdout): tasks
    // whose DATA text carries the AUTO marker pass, everything else is review — deterministic
    // per-task verdicts, so the routing assertions below cannot pass by accident.
    const FAKEEVAL = `${ROOT}/fakeeval`;
    await Bun.write(FAKEEVAL, [
      "#!/bin/sh",
      "cat | bun -e '",
      "const input = await new Response(Bun.stdin.stream()).text();",
      "const segs = input.split(/^TASK id=/m).slice(1);",
      "const verdicts = segs.map((seg) => ({ id: seg.split(/\\s/)[0], verdict: seg.includes(\"EVAL-AUTO-PROBE\") ? \"auto\" : \"review\", reason: \"probe \" + \"x\".repeat(300) }));",
      "console.log(JSON.stringify({ verdicts }));",
      "'",
      "",
    ].join("\n"));
    spawnSync("chmod", ["+x", FAKEEVAL]);
    const dispatchRepo = (await hSess()).dispatch.repo;
    await restartSrv({ FLEET_DISPATCH_REPO: dispatchRepo, FLEET_EVAL_CMD: FAKEEVAL, FLEET_EVAL_MS: "1000", FLEET_EVAL_MAX_AUTO_PER_DAY: "1" });
    await post("/api/dispatch", { on: true });
    const hA = (await (await post("/api/tasks", { text: "eval probe A: EVAL-AUTO-PROBE — append one line to readme.md", queue: false })).json()) as { task: { id: string } };
    const hB = (await (await post("/api/tasks", { text: "eval probe B: something vague the gate must park", queue: false })).json()) as { task: { id: string } };
    const hEval = async (id: string): Promise<HRow["eval"]> => (await hSess()).tasks.find((t) => t.id === id)?.eval;
    let evA: HRow["eval"]; let evB: HRow["eval"];
    for (let i = 0; i < 40 && !(evA && evB); i++) { evA = await hEval(hA.task.id); evB = await hEval(hB.task.id); if (!(evA && evB)) await Bun.sleep(500); }
    check("(h) the sweep stamps every pending lane task in the batch with a per-task verdict",
      evA?.verdict === "auto" && evB?.verdict === "review", JSON.stringify({ evA, evB }));
    let hRow: HRow | undefined;
    for (let i = 0; i < 40; i++) { hRow = (await hSess()).tasks.find((t) => t.id === hA.task.id); if (hRow && hRow.status !== "pending") break; await Bun.sleep(500); }
    check("(h) an eval-auto PENDING task is consumed unattended — no owner promote, audited on its row",
      hRow?.status !== "pending" && (hRow?.note ?? "").includes("auto-dispatched: eval gate passed"), JSON.stringify(hRow));
    const hBRow = (await hSess()).tasks.find((t) => t.id === hB.task.id);
    check("(h) an eval-review task stays pending for the owner — the dispatcher never touches it",
      hBRow?.status === "pending", JSON.stringify(hBRow));
    // reason size contract, both directions: the 2 s poll carries a bounded slice, the queue
    // overlay's own /api/tasks fetch carries the full text. This pins the truncation defect
    // that once made a review verdict read as its own opposite (the stored reason lost its
    // decisive "— but …" clause to a 200-char cap).
    const hFull = ((await (await get("/api/tasks")).json()) as { tasks: { id: string; eval?: { reason: string } }[] })
      .tasks.find((t) => t.id === hB.task.id)?.eval;
    check("(h) digest reason is a bounded slice (≤140) while /api/tasks carries the full reason",
      (hBRow?.eval?.reason.length ?? 999) <= 140 && (hFull?.reason.length ?? 0) > 140,
      JSON.stringify({ digest: hBRow?.eval?.reason.length, full: hFull?.reason.length }));
    // ↻ re-eval: an explicit owner reset clears the verdict and the sweep judges afresh
    const hRst = await post(`/api/tasks/${hB.task.id}/eval-reset`, {});
    let evB2: HRow["eval"];
    for (let i = 0; i < 40; i++) {
      evB2 = await hEval(hB.task.id);
      if (evB2 && (evB2.at ?? 0) > (evB?.at ?? 0)) break;
      evB2 = undefined;
      await Bun.sleep(500);
    }
    check("(h) eval-reset clears a pending verdict and the sweep re-judges it (fresh timestamp)",
      hRst.ok && evB2?.verdict === "review" && (evB2?.at ?? 0) > (evB?.at ?? 0),
      JSON.stringify({ reset: hRst.status, evB2 }));
    // per-day cap (1 here): a second auto verdict is stamped but NOT consumed — a valve, not a floodgate
    const hC = (await (await post("/api/tasks", { text: "eval probe C: EVAL-AUTO-PROBE — a second auto candidate", queue: false })).json()) as { task: { id: string } };
    let evC: HRow["eval"];
    for (let i = 0; i < 40 && !evC; i++) { evC = await hEval(hC.task.id); if (!evC) await Bun.sleep(500); }
    await Bun.sleep(9500); // one full 8s dispatch tick with the cap already spent
    const hCRow = (await hSess()).tasks.find((t) => t.id === hC.task.id);
    check("(h) the per-day cap parks further auto verdicts as pending",
      evC?.verdict === "auto" && hCRow?.status === "pending", JSON.stringify({ evC, hCRow }));
    // fail-closed: a worker answering garbage parks the batch as review with the why — never a pass
    await Bun.write(FAKEEVAL, "#!/bin/sh\ncat >/dev/null\necho 'this is not json'\n");
    const hF = (await (await post("/api/tasks", { text: "eval probe F: EVAL-AUTO-PROBE — would pass, but the worker is broken", queue: false })).json()) as { task: { id: string } };
    let evF: HRow["eval"];
    for (let i = 0; i < 40 && !evF; i++) { evF = await hEval(hF.task.id); if (!evF) await Bun.sleep(500); }
    check("(h) a broken eval worker FAILS CLOSED — verdict review naming the failure, never auto",
      evF?.verdict === "review" && (evF?.reason ?? "").includes("eval worker failed"), JSON.stringify(evF));
    // prompt invariants against the pure builder (the worker's EFFECT is untestable by design)
    const hp = buildEvalPrompt("/some/repo", [{ id: "abc123", source: "owner", text: "raw <task> text" }]);
    check("(h) buildEvalPrompt: mark, id line, DATA fences, verbatim text, strict-JSON contract",
      hp.includes("the EVAL GATE for a fleet task queue") && hp.includes("TASK id=abc123 source=owner")
      && hp.includes("<<<DATA") && hp.includes("DATA>>>") && hp.includes("raw <task> text") && hp.includes('{"verdicts"')
      && hp.includes("DECISIVE factor comes FIRST"),
      hp.slice(0, 120));
    // cleanup — dispatcher off first (same requeue-race reason as (e)), kill the auto-spawned
    // lane, drop the probes. The stand-in env dies with the NEXT restartSrv on its own: extra
    // never enters process.env, so no counter-restart is needed here.
    await post("/api/dispatch", { on: false });
    if (typeof hRow?.slot === "number") await post(`/api/slots/${hRow.slot}/kill`, {});
    for (const id of [hA.task.id, hB.task.id, hC.task.id, hF.task.id]) await post(`/api/tasks/${id}/delete`, {});
  }
}
