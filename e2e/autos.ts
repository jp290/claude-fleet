// Scheduled prompts: one-shots and the idle gate, perpetual beats, the global kill-switch and
// quiet hours. Hands the two persistence probes to restart.ts.
import { readFileSync } from "node:fs";
import { check, get, plogRead, post, tmuxOut } from "./harness";
import type { Ctx } from "./ctx";

export async function run(ctx: Ctx): Promise<void> {
  // --- scheduled prompts (FLEET_CMD=true → claude-alive gate is off by design) ---
  const aBad = await post("/api/slots/2/autos", { text: "x", everySec: 5, runs: 3 });
  check("auto rejects sub-minimum interval", aBad.status === 400);
  const aBad2 = await post("/api/slots/2/autos", { text: "x", everySec: 60, runs: 999 });
  check("auto rejects runs over cap", aBad2.status === 400);
  const aFire = await post("/api/slots/2/autos", { text: "auto-fire-check", inSec: 2, idleSec: 0 });
  const aFireJ = (await aFire.json()) as { auto: { id: string } };
  check("create one-shot auto", aFire.ok && !!aFireJ.auto?.id);
  // make slot 1 look busy (fresh output), then schedule with a huge idle gate — must NOT fire
  await tmuxOut("send-keys", "-t", "s1", "echo busy-marker", "Enter");
  const aBusy = await post("/api/slots/1/autos", { text: "auto-must-wait", inSec: 2, idleSec: 3600 });
  const aBusyJ = (await aBusy.json()) as { auto: { id: string } };
  check("create idle-gated auto", aBusy.ok && !!aBusyJ.auto?.id);
  await Bun.sleep(9000); // past due + one 5s scheduler tick
  const cap2a = await tmuxOut("capture-pane", "-t", "s2", "-p");
  check("due auto fired into its pane", cap2a.out.includes("auto-fire-check"));
  const cap1a = await tmuxOut("capture-pane", "-t", "s1", "-p");
  check("idle-gated auto held back while busy", !cap1a.out.includes("auto-must-wait"));
  const sess1 = (await (await get("/api/sessions")).json()) as { autos: { id: string; enabled: boolean; lastResult: string | null; runsLeft: number }[] };
  const fired = sess1.autos.find((a) => a.id === aFireJ.auto.id);
  const waiting = sess1.autos.find((a) => a.id === aBusyJ.auto.id);
  check("fired one-shot is disabled, result 'sent', runsLeft driven to 0 (spent is one predicate)", !!fired && !fired.enabled && fired.lastResult === "sent" && fired.runsLeft === 0, JSON.stringify(fired));
  check("gated auto still waiting within grace", !!waiting && waiting.enabled && waiting.lastResult === null, JSON.stringify(waiting));
  const h2auto = (await (await get("/api/slots/2/history")).json()) as { history: { text: string }[] };
  check("auto send recorded in prompt history", h2auto.history.some((h) => h.text === "auto-fire-check"));
  check("auto send in prompt log with source 'auto'",
    (await plogRead()).some((e) => e.slot === 2 && e.source === "auto" && e.text === "auto-fire-check"));
  check("delete auto", (await post(`/api/autos/${aBusyJ.auto.id}/delete`, {})).ok);
  const sess2 = (await (await get("/api/sessions")).json()) as { autos: { id: string }[] };
  check("deleted auto gone", !sess2.autos.some((a) => a.id === aBusyJ.auto.id));
  // persistence probe: far-future one-shot on slot 2, checked again after the restart section
  const aPersist = await post("/api/slots/2/autos", { text: "auto-persist-probe", inSec: 3600 });
  const aPersistJ = (await aPersist.json()) as { auto: { id: string } };
  check("create persistence-probe auto", aPersist.ok && !!aPersistJ.auto?.id);
  ctx.aPersistId = aPersistJ.auto.id;

  // --- perpetual autos: an owner-only recurring beat that re-arms instead of expiring at the runs
  // cap. Proven by CONTRAST — a runs=1 control dies after one fire; a runs=1 perpetual, same params,
  // survives it. Both fire on slot 2 (idleSec:0 bypasses the idle gate); the C-u below clears both. ---
  const aPerp = await post("/api/slots/2/autos", { text: "perp-beat", inSec: 1, everySec: 10, idleSec: 0, perpetual: true });
  const aPerpJ = (await aPerp.json()) as { ok?: boolean; auto?: { id: string; perpetual?: boolean } };
  check("owner can create a perpetual auto (flagged perpetual)", aPerp.ok && aPerpJ.auto?.perpetual === true, JSON.stringify(aPerpJ.auto));
  const aCtl = await post("/api/slots/2/autos", { text: "ctl-beat", inSec: 1, everySec: 10, runs: 1, idleSec: 0 });
  const aCtlJ = (await aCtl.json()) as { auto?: { id: string } };
  check("perpetual requires a recurring interval (one-shot + perpetual -> 400)",
    (await post("/api/slots/2/autos", { text: "x", inSec: 2, perpetual: true })).status === 400);
  await Bun.sleep(9000); // one fire + a 5s scheduler tick
  const sessP = (await (await get("/api/sessions")).json()) as { autos: { id: string; enabled: boolean; runsLeft: number; lastResult: string | null; perpetual?: boolean }[] };
  const perp = sessP.autos.find((a) => a.id === aPerpJ.auto?.id);
  const ctl = sessP.autos.find((a) => a.id === aCtlJ.auto?.id);
  check("control (runs=1, non-perpetual) is spent after one fire", !!ctl && !ctl.enabled && ctl.runsLeft === 0, JSON.stringify(ctl));
  check("perpetual SURVIVES the same fire — enabled, runsLeft un-decremented, sent",
    !!perp && perp.enabled === true && perp.runsLeft === 1 && perp.lastResult === "sent" && perp.perpetual === true, JSON.stringify(perp));
  check("a perpetual auto is still killable (delete succeeds)", (await post(`/api/autos/${aPerpJ.auto?.id}/delete`, {})).ok);
  if (aCtlJ.auto) await post(`/api/autos/${aCtlJ.auto.id}/delete`, {});
  const aPerpPersist = await post("/api/slots/2/autos", { text: "perp-persist-probe", inSec: 3600, everySec: 3600, perpetual: true });
  const aPerpPersistJ = (await aPerpPersist.json()) as { auto?: { id: string } };
  check("create perpetual persistence-probe", aPerpPersist.ok && !!aPerpPersistJ.auto?.id);
  ctx.aPerpPersistId = aPerpPersistJ.auto?.id ?? "";

  // --- global kill-switch (/api/autos/switch): pauses the entire scheduled-auto surface. Proven
  // by an auto that must NOT fire while paused, then fires once resumed; persisted immediately. ---
  check("autosOn defaults on and is exposed in state",
    ((await (await get("/api/sessions")).json()) as { autosOn?: boolean }).autosOn === true);
  check("switch rejects a non-boolean body (400)", (await post("/api/autos/switch", { on: "off" })).status === 400);
  const swOff = await post("/api/autos/switch", { on: false });
  check("owner kills the automation surface", swOff.ok && ((await swOff.json()) as { autosOn?: boolean }).autosOn === false);
  await Bun.sleep(150); // let the route's saveState land
  check("the kill-switch state is persisted immediately (so a restart stays killed)",
    (JSON.parse(readFileSync("fleet.json", "utf8")) as { autosOn?: boolean }).autosOn === false);
  const aKill = await post("/api/slots/2/autos", { text: "killswitch-probe", inSec: 1, idleSec: 0 });
  const aKillJ = (await aKill.json()) as { auto?: { id: string } };
  await Bun.sleep(7000); // well past when it would fire if automation were live
  const killed = ((await (await get("/api/sessions")).json()) as { autos: { id: string; enabled: boolean; lastResult: string | null }[] }).autos.find((a) => a.id === aKillJ.auto?.id);
  check("no auto fires while the kill-switch is off", !!killed && killed.enabled === true && killed.lastResult === null, JSON.stringify(killed));
  check("owner re-enables the automation surface",
    ((await (await post("/api/autos/switch", { on: true })).json()) as { autosOn?: boolean }).autosOn === true);
  await Bun.sleep(7000); // now it may fire
  const resumed = ((await (await get("/api/sessions")).json()) as { autos: { id: string; lastResult: string | null }[] }).autos.find((a) => a.id === aKillJ.auto?.id);
  check("the same auto fires once automation is resumed", !!resumed && resumed.lastResult === "sent", JSON.stringify(resumed));
  if (aKillJ.auto) await post(`/api/autos/${aKillJ.auto.id}/delete`, {});

  // --- quiet hours: mute the PERIODIC surface during the owner's local-hour window. Set to cover
  // the current hour so the test is deterministic regardless of when it runs; a recurring pulse is
  // held while a one-shot still fires; clearing the window lets the held pulse fire. ---
  const nowH = new Date().getHours();
  check("quiet-hours rejects an invalid window (400)", (await post("/api/autos/quiet", { start: 5, end: 5 })).status === 400);
  const qSet = await post("/api/autos/quiet", { start: nowH, end: (nowH + 2) % 24 });
  check("owner sets a quiet-hours window covering now",
    qSet.ok && ((await qSet.json()) as { quietHours?: { start: number } }).quietHours?.start === nowH);
  const aQuietRec = await post("/api/slots/2/autos", { text: "quiet-recurring", inSec: 1, everySec: 10, runs: 5, idleSec: 0 });
  const aQuietRecJ = (await aQuietRec.json()) as { auto?: { id: string } };
  const aQuietOne = await post("/api/slots/2/autos", { text: "quiet-oneshot", inSec: 1, idleSec: 0 });
  const aQuietOneJ = (await aQuietOne.json()) as { auto?: { id: string } };
  await Bun.sleep(9000);
  const sessQ = (await (await get("/api/sessions")).json()) as { autos: { id: string; enabled: boolean; lastResult: string | null; nextAt: number }[] };
  const qRec = sessQ.autos.find((a) => a.id === aQuietRecJ.auto?.id);
  const qOne = sessQ.autos.find((a) => a.id === aQuietOneJ.auto?.id);
  check("a recurring pulse is held (does not fire) during quiet hours",
    !!qRec && qRec.enabled === true && qRec.lastResult === null && qRec.nextAt > Date.now(), JSON.stringify(qRec));
  check("a one-shot still fires during quiet hours (only the periodic surface is muted)",
    !!qOne && qOne.lastResult === "sent", JSON.stringify(qOne));
  check("clearing quiet hours nulls the window",
    ((await (await post("/api/autos/quiet", { start: null })).json()) as { quietHours: unknown }).quietHours === null);
  await Bun.sleep(12000); // > everySec, so the held recurring pulse now fires
  const qRec2 = ((await (await get("/api/sessions")).json()) as { autos: { id: string; lastResult: string | null }[] }).autos.find((a) => a.id === aQuietRecJ.auto?.id);
  check("the held recurring pulse fires once quiet hours are cleared", !!qRec2 && qRec2.lastResult === "sent", JSON.stringify(qRec2));
  if (aQuietRecJ.auto) await post(`/api/autos/${aQuietRecJ.auto.id}/delete`, {});
  if (aQuietOneJ.auto) await post(`/api/autos/${aQuietOneJ.auto.id}/delete`, {});

  await tmuxOut("send-keys", "-t", "s2", "C-u");
}
