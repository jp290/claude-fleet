// The task queue (owner CRUD + dispatch availability) and the Tier-0 gates: the master stop and
// quiet hours reach the DISPATCHER too, proven against a positive control.
import { check, get, post } from "./harness";
import type { Ctx } from "./ctx";

export async function run(ctx: Ctx): Promise<void> {
  // --- task queue (Phase D). Owner CRUD + dispatch availability ---
  const tCreate = await post("/api/tasks", { text: "e2e owner task", queue: false });
  const tJson = (await tCreate.json()) as { ok: boolean; task: { id: string; status: string; source: string } };
  check("create owner task as pending", tCreate.ok && tJson.task.status === "pending" && tJson.task.source === "owner");
  check("queue a task", (await post(`/api/tasks/${tJson.task.id}/queue`, {})).ok);
  const sessT = (await (await get("/api/sessions")).json()) as { tasks: { id: string; status: string }[]; dispatch: { available: boolean; on: boolean } };
  check("queued task reflected in sessions", sessT.tasks.some((t) => t.id === tJson.task.id && t.status === "queued"));
  check("dispatch reports available when repo set", sessT.dispatch.available === true);
  check("unqueue a task", (await post(`/api/tasks/${tJson.task.id}/unqueue`, {})).ok);
  check("delete a task", (await post(`/api/tasks/${tJson.task.id}/delete`, {})).ok);
  check("deleted task gone", !(await (await get("/api/sessions")).json() as { tasks: { id: string }[] }).tasks.some((t) => t.id === tJson.task.id));
  const dispOff = await post("/api/dispatch", { on: false });
  check("dispatch toggle endpoint works", dispOff.ok);

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

    // cleanup: kill only the lane the positive control spawned (a worktree slot new since setup, never
    // the persistence lane), delete the probe task, restore the dispatcher off (persisted off).
    for (const id of await laneIds()) if (!lanes0.has(id) && id !== ctx.restartSelfSlot) await post(`/api/slots/${id}/kill`, {});
    await post(`/api/tasks/${tid}/delete`, {});
    await post("/api/dispatch", { on: false });
  }
}
