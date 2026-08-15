// THE OUTBOUND CHANNEL for the two completion predicates (server.ts, Watch + tickWatches): the
// original clean+ahead `doneLooking`, and the distinct dirty+zero-ahead `hostCommitLooking` for a
// fenced harness whose host owns the commit. A watch is a subscription — one slot asks to be told,
// ONCE, when another slot reaches either shape.
//
// What these checks are really guarding is the difference between a notification and a verdict.
// The message must carry the facts it fired on (branch, ahead/dirty) AND say that "looks done" is a
// predicate, not a report from the lane — CLAUDE.md's four look-alike states are indistinguishable
// to it. A message that read as "it is finished" would turn a wait-remover into a land-trigger.
//
// Timing: the harness shrinks the idle gate (FLEET_AUTO_REVIEW_IDLE_MS=1500) and the delivery tick
// (FLEET_AUTOS_TICK_MS), but the git facts the predicate reads refresh on the 10s tickGit, so the
// first fire cannot happen sooner than that. Every wait here is a POLL with a loud bound, never a
// fixed sleep.
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { laneWatchEventKind, laneWatchMessage, laneWatchPayload, laneWatchSignal,
  type LaneSignalView, type LaneWatchEventPayload } from "../lane-signals";
import { AUTOS_TICK_MS, BASE, REPO, ROOT, TOKEN, check, get, paneEnv, plogRead, post, restartSrv, tmuxOut } from "./harness";

interface WatchRow {
  id: string; slot: number; target: number; targetBranch: string;
  slotOpenedAt?: number;
  armed: boolean; firedAt: number | null; lastResult: string | null;
}
type FleetEventStatus = "pending" | "send-uncertain" | "delivered" | "acknowledged" | "receiver-gone";
interface FleetEventRow {
  id: string; watchId: string;
  receiverSlot: number; receiverOpenedAt: number; receiverSessionId: string | null; receiverIdleSec: number;
  subjectSlot: number; subjectBranch: string;
  kind: "lane-ready" | "host-commit-ready"; payload: LaneWatchEventPayload;
  createdAt: number; status: FleetEventStatus; attempts: number;
  deliveredAt: number | null; acknowledgedAt: number | null;
}
interface DeployWatchRow {
  id: string; kind: "deploy"; slot: number; deployId: string;
  slotOpenedAt?: number;
  armed: boolean; firedAt: number | null; lastResult: string | null;
}
interface DeployEventRow {
  id: string; watchId: string; receiverSlot: number; receiverOpenedAt: number;
  receiverSessionId: string | null; kind: "deploy-terminal"; subjectDeployId: string;
  payload: { ok: boolean | null; stage: "build" | "restart" | "boot"; target: string | null;
    bootHead: string | null; hitTarget: boolean | null; bundleStale: boolean | null; at: number; reason?: string };
  status: FleetEventStatus; attempts: number; acknowledgedAt: number | null;
}
const watchRows = async (): Promise<WatchRow[]> =>
  ((await (await get("/api/sessions")).json()) as { watches: WatchRow[] }).watches;
const watchRow = async (id: string): Promise<WatchRow | undefined> =>
  (await watchRows()).find((w) => w.id === id);
const eventRows = async (): Promise<FleetEventRow[]> =>
  ((await (await get("/api/sessions")).json()) as { events: FleetEventRow[] }).events;
const eventForWatch = async (watchId: string): Promise<FleetEventRow | undefined> =>
  (await eventRows()).find((e) => e.watchId === watchId);
const deployWatchRows = async (): Promise<DeployWatchRow[]> =>
  (((await (await get("/api/sessions")).json()) as { watches: unknown[] }).watches as DeployWatchRow[])
    .filter((w) => w.kind === "deploy");
const deployEventRows = async (): Promise<DeployEventRow[]> =>
  (((await (await get("/api/sessions")).json()) as { events: unknown[] }).events as DeployEventRow[])
    .filter((e) => e.kind === "deploy-terminal");
const waitDeployEvent = async (watchId: string): Promise<DeployEventRow | undefined> => {
  let found: DeployEventRow | undefined;
  for (let i = 0; i < 120; i++) {
    found = (await deployEventRows()).find((e) => e.watchId === watchId);
    if (found?.status === "delivered" || found?.status === "acknowledged") return found;
    await Bun.sleep(100);
  }
  return found;
};
const freeSlot = async (): Promise<number> =>
  ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
    .slots.find((x) => x.cwd === null)?.id ?? 0;
const persistedOpenedAt = (slot: number): number | undefined =>
  (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
    { slots?: Record<string, { openedAt?: number }> }).slots?.[String(slot)]?.openedAt;
const selfWatch = (tok: string | null, body: unknown): Promise<Response> =>
  fetch(`${BASE}/api/self/watch`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(tok === null ? {} : { "x-fleet-self-token": tok }) },
    body: JSON.stringify(body),
  });
const selfGet = (tok: string): Promise<Response> =>
  fetch(`${BASE}/api/self`, { headers: { "x-fleet-self-token": tok } });
const ackEvent = (tok: string | null, id: string): Promise<Response> =>
  fetch(`${BASE}/api/self/events/${id}/ack`, {
    method: "POST",
    headers: tok === null ? {} : { "x-fleet-self-token": tok },
  });

export async function run(): Promise<void> {
  // A real process kill cannot reliably land in the sub-millisecond gap between a local tmux
  // call and its return. Pin the ordering that creates that observable crash state, then exercise
  // its persisted image below: marker -> awaited state write -> send, and pending is the sole
  // transport input. Moving any one of those four facts makes this check red.
  const serverSource = readFileSync(`${ROOT}/server.ts`, "utf8");
  const tickStart = serverSource.indexOf("async function tickWatches()");
  const tickSource = tickStart < 0 ? "" : serverSource.slice(tickStart,
    serverSource.indexOf("// The one-line receiver text", tickStart));
  const uncertainAt = tickSource.indexOf('event.status = "send-uncertain";');
  const persistedAt = tickSource.indexOf("await saveStateNow();", uncertainAt);
  const sendAt = tickSource.indexOf("await sendText(s, text, true);", persistedAt);
  check("watch transport persists send-uncertain before sendText and retries pending only",
    tickSource.includes('if (event.status !== "pending") continue;')
    && uncertainAt >= 0 && persistedAt > uncertainAt && sendAt > persistedAt,
    `${uncertainAt}:${persistedAt}:${sendAt}`);

  // --- THE HOST-COMMIT SIBLING. The isolated server deliberately runs with foreign-harness
  // automation OFF (a policy family later proves that refusal). The pure selector below isolates
  // the TARGET's fenced-host-commit completion shape; the runtime blocks below separately prove
  // delivery, including tickWatches' narrow receiver-policy waiver for a live pi-unfenced slot.
  {
    const h: LaneSignalView = { alive: true, idleMs: 5000, git: { dirty: 1, ahead: 0 }, gitOp: false,
      merge: null, observed: true, awaiting: null, hostCommits: true };
    const signal = laneWatchSignal(h, 1500);
    check("watch selector accepts the host-committed dirty+zero-ahead completion shape",
      signal === "host-commit-looking", String(signal));
    if (signal) {
      const text = laneWatchMessage(7, "host-branch", {
        id: "typedfixture", kind: laneWatchEventKind(signal), payload: laneWatchPayload(h),
      });
      check("host-commit watch text names the weaker fact and exact host action",
        text.includes("LOOKS ready for a host commit")
        && text.includes("The work is UNCOMMITTED, 0 ahead is expected for this harness, and the next step is a host commit via POST /api/slots/7/commit.")
        && text.includes("server's weaker predicate") && text.includes("NOT a report from that lane")
        && text.includes("[event typedfixture]")
        && text.includes("POST /api/self/events/typedfixture/ack"), text);
    }
  }

  // --- the original subject: a lane that commits and goes quiet (idle + clean + ahead>0) ---
  const tgt = (await (await post("/api/lanes", { repo: REPO })).json()) as
    { slot: number; cwd: string; branch: string };
  await Bun.write(`${tgt.cwd}/watch-target.txt`, "the work the watcher is waiting for\n");
  spawnSync("git", ["-C", tgt.cwd, "add", "watch-target.txt"]);
  spawnSync("git", ["-C", tgt.cwd, "commit", "-qm", "watch target lane work"]);

  // --- THE MEASURED RETURN-CHANNEL DEFECT. The wrapper's initial server alone has a scratch
  // executable named `pi` on PATH, while FLEET_HARNESS_AUTOMATION=0 stays closed. That makes a
  // pi-unfenced main slot mechanically alive without a provider call. This must be a runtime
  // counterprobe, not a selector unit check: tickWatches is the sole caller allowed to waive the
  // harness WORK-prompt policy for an explicit subscription's fixed completion notification.
  // It must run before this module's restartSrv() below, which deliberately restores normal PATH.
  {
    // Own target identity: the later owner-route check deliberately reuses `tgt` and may recycle
    // this receiver slot. Sharing both would make its exact-once log count include this fixture's
    // earlier delivery. A separate lane gives this probe a disjoint message prefix and is killed
    // with it, so neither family's evidence can satisfy or poison the other.
    const uTgt = (await (await post("/api/lanes", { repo: REPO })).json()) as
      { slot: number; cwd: string; branch: string };
    await Bun.write(`${uTgt.cwd}/watch-pi-unfenced-target.txt`, "isolated watch target\n");
    spawnSync("git", ["-C", uTgt.cwd, "add", "watch-pi-unfenced-target.txt"]);
    spawnSync("git", ["-C", uTgt.cwd, "commit", "-qm", "pi-unfenced watch target"]);
    check("watch pi-unfenced fixture: its controlled target is a distinct committed lane",
      uTgt.slot > 0 && uTgt.slot !== tgt.slot, JSON.stringify(uTgt));

    const uId = await freeSlot();
    const openU = uId ? await post(`/api/slots/${uId}/open`, { cwd: REPO, harness: "pi-unfenced" }) : null;
    check("watch pi-unfenced fixture: a plain main-only receiver opens on the scratch Pi stand-in",
      !!openU?.ok, `${uId} ${openU?.status}`);

    let uAgent: string | null | undefined;
    for (let i = 0; i < 80 && uAgent !== "alive"; i++) {
      const rows = ((await (await get("/api/sessions")).json()) as
        { slots: { id: number; agent: string | null }[] }).slots;
      uAgent = rows.find((x) => x.id === uId)?.agent;
      if (uAgent !== "alive") await Bun.sleep(250);
    }
    check("watch pi-unfenced fixture: the stand-in is genuinely live (agent=alive), not merely a pane",
      uAgent === "alive", String(uAgent));

    const uTok = await paneEnv(`s${uId}`, "FLEET_SELF_TOKEN") ?? "";
    check("watch pi-unfenced fixture: the live receiver answers with its pane-exported Self token",
      /^[0-9a-f]{32}$/.test(uTok), `[${uTok}]`);
    const catalog = (await (await get("/api/harnesses")).json()) as
      { harnesses: { id: string; automatable: boolean; allowsLanes: boolean; singleton: boolean }[] };
    const uHarness = catalog.harnesses.find((h) => h.id === "pi-unfenced");
    check("pi-unfenced's static adapter policy stays false/main-only/singleton; the Watch exception belongs to the subscribed act",
      uHarness?.automatable === false && uHarness.allowsLanes === false && uHarness.singleton === true,
      JSON.stringify(uHarness));

    check("watch pi-unfenced kill-switch fixture: owner pauses automation before subscribing",
      (await post("/api/autos/switch", { on: false })).ok);
    const subscribed = await selfWatch(uTok, { target: uTgt.slot, idleSec: 0 });
    const subscribedJ = (await subscribed.json()) as { watch?: WatchRow; error?: string };
    check("live pi-unfenced Self route explicitly subscribes to its controlled committed lane",
      subscribed.ok && subscribedJ.watch?.armed === true && subscribedJ.watch.target === uTgt.slot,
      `${subscribed.status} ${JSON.stringify(subscribedJ)}`);

    // Only structural prerequisites exposed by this poll: committed+clean target facts and the
    // armed subscription. `lastOutput>0` is not required by idleSec:0 and was a false fixture gate.
    let targetReady = false;
    for (let i = 0; i < 60 && !targetReady; i++) {
      const rows = ((await (await get("/api/sessions")).json()) as
        { slots: { id: number; git: { ahead?: number; dirty?: number } | null }[] }).slots;
      const row = rows.find((x) => x.id === uTgt.slot);
      targetReady = row?.git?.ahead === 1 && row.git.dirty === 0;
      if (!targetReady) await Bun.sleep(500);
    }
    check("watch pi-unfenced kill-switch fixture: target is measurably committed+clean",
      targetReady, String(targetReady));
    await Bun.sleep(AUTOS_TICK_MS * 4 + 500);
    const paused = subscribedJ.watch?.id ? await watchRow(subscribedJ.watch.id) : undefined;
    const pausedEvent = subscribedJ.watch?.id ? await eventForWatch(subscribedJ.watch.id) : undefined;
    check("signal capture spends the pi-unfenced Watch and persists exactly one event even while transport is paused",
      paused?.armed === false && pausedEvent?.status === "pending"
      && (await eventRows()).filter((e) => e.watchId === subscribedJ.watch?.id).length === 1
      && !(await plogRead()).some((e) => e.slot === uId
        && e.text.startsWith(`[fleet] slot ${uTgt.slot} (${uTgt.branch})`)),
      JSON.stringify({ watch: paused, event: pausedEvent }));
    check("watch pi-unfenced kill-switch fixture: owner releases automation",
      (await post("/api/autos/switch", { on: true })).ok);

    let delivered: FleetEventRow | undefined;
    for (let i = 0; i < 45 && delivered?.status !== "delivered"; i++) {
      await Bun.sleep(1000);
      delivered = subscribedJ.watch?.id ? await eventForWatch(subscribedJ.watch.id) : undefined;
    }
    const oldPolicySkip = "skipped — harness pi-unfenced is not automatable";
    check("after kill-switch release the pending event reaches live pi-unfenced once as delivered, never acked by tmux",
      delivered?.status === "delivered" && delivered.attempts === 1
      && delivered.acknowledgedAt === null, JSON.stringify(delivered));
    const uMessages = (await plogRead()).filter((e) => e.slot === uId
      && e.text.startsWith(`[fleet] slot ${uTgt.slot} (${uTgt.branch})`));
    check("the fixed completion notification has exactly one matching prompt-log row on pi-unfenced",
      uMessages.length === 1, `${uMessages.length}: ${uMessages.map((m) => m.text.slice(0, 80)).join(" | ")}`);
    await Bun.sleep(AUTOS_TICK_MS * 4 + 1500);
    const uAfter = subscribedJ.watch?.id ? await watchRow(subscribedJ.watch.id) : undefined;
    const uEventAfter = subscribedJ.watch?.id ? await eventForWatch(subscribedJ.watch.id) : undefined;
    check("the pi-unfenced event remains one-shot across later ticks and never records the old skip",
      uAfter?.armed === false && uAfter.lastResult === "sent" && uEventAfter?.status === "delivered"
      && (await plogRead()).filter((e) => e.slot === uId
        && e.text.startsWith(`[fleet] slot ${uTgt.slot} (${uTgt.branch})`)).length === 1
      && !(await watchRows()).some((w) => w.slot === uId && (w.lastResult ?? "").includes(oldPolicySkip)),
      JSON.stringify({ watch: uAfter, event: uEventAfter }));
    await post(`/api/slots/${uTgt.slot}/kill`, {});
    await post(`/api/slots/${uId}/kill`, {});
  }

  // --- the receivers, both PLAIN slots: the session this feature exists for is a driving main
  // checkout, and that is also the shape the SELF route below is scoped to. Everything down to the
  // teardown drives the OWNER route; the self twin gets its own block, on its own slot, so neither
  // principal's pins can be satisfied by the other's. `rcvA` is left quiet and gets idleSec:0;
  // `rcvB` is deliberately kept busy. ---
  const aId = await freeSlot();
  const openA = aId ? await post(`/api/slots/${aId}/open`, { cwd: REPO }) : null;
  check("watch setup: a plain receiver slot is open", !!openA?.ok, `${aId} ${openA?.status}`);
  const bId = await freeSlot();
  const openB = bId ? await post(`/api/slots/${bId}/open`, { cwd: REPO }) : null;
  check("watch setup: a second plain receiver slot is open", !!openB?.ok, `${bId} ${openB?.status}`);
  // Read both credentials before any Watch can inject into either pane. paneEnv is itself a
  // pane exchange; racing it with the transport under test can consume its unique marker.
  const aTok = await paneEnv(`s${aId}`, "FLEET_SELF_TOKEN") ?? "";
  const bTok = await paneEnv(`s${bId}`, "FLEET_SELF_TOKEN") ?? "";
  check("event ack setup: both receiver panes carry distinct scoped tokens before subscription",
    /^[0-9a-f]{32}$/.test(aTok) && /^[0-9a-f]{32}$/.test(bTok) && aTok !== bTok,
    `${aTok}:${bTok}`);
  // Slots are recyclable, while the prompt ledger is append-only. Count only rows written after
  // these two receiver identities were opened; an earlier occupant's Watch is not this fixture's.
  const ownerWatchLogStart = (await plogRead()).length;
  const ownerWatchMessages = async (slot: number) => (await plogRead()).slice(ownerWatchLogStart)
    .filter((e) => e.slot === slot && e.text.startsWith("[fleet] slot "));

  // --- REJECTIONS. Every one answers the same question — can this watch ever fire? A watch that
  // cannot is worse than none, because it is a silent forever-wait, which is the failure the whole
  // surface removes. So a target the predicate never classifies is refused at CREATE time. ---
  const rNonLane = await post(`/api/slots/${aId}/watch`, { target: bId });
  check("watch on a NON-LANE slot is refused (done-looking only classifies lanes)",
    rNonLane.status === 409, `${rNonLane.status} ${await rNonLane.text()}`);
  const rSelf = await post(`/api/slots/${aId}/watch`, { target: aId });
  check("a session cannot watch itself", rSelf.status === 400, String(rSelf.status));
  const rIdle = await post(`/api/slots/${aId}/watch`, { target: await freeSlot() });
  check("watch on an INACTIVE slot is refused", rIdle.status === 400, String(rIdle.status));
  const rBogus = await post(`/api/slots/${aId}/watch`, { target: 999 });
  check("watch on a nonexistent slot is refused", rBogus.status === 400, String(rBogus.status));
  {
    // the ⚙ steward is a lane by every mechanical test and is still excluded by name — a planning
    // pane's diff is not lane work, so the predicate never fires for it and neither may a watch
    const st = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number };
    await post(`/api/slots/${st.slot}/rename`, { label: "⚙ steward" });
    const rStew = await post(`/api/slots/${aId}/watch`, { target: st.slot });
    check("watch on the ⚙ steward is refused even though it is a worktree lane",
      rStew.status === 409, `${rStew.status} ${await rStew.text()}`);
    await post(`/api/slots/${st.slot}/kill`, {});
  }

  // === THE SELF TWIN: POST /api/self/watch =====================================================
  // Same mint (createWatchForSlot), different principal: `s` comes from the token instead of the
  // URL. The delivery machinery is therefore already proven by the owner half above and is not
  // re-run here — what is NOT shared, and is the whole subject of this block, is the auth binding
  // and the refusals. Its subscriber rule runs the OPPOSITE way to the four lane-only self routes
  // (drift/gate/criterion/verify-intent refuse a plain session 409; this one refuses a LANE 409),
  // and that asymmetry is exactly the kind of thing a later reader "simplifies" into a copy.
  {
    const cId = await freeSlot();
    const openC = cId ? await post(`/api/slots/${cId}/open`, { cwd: REPO }) : null;
    check("self-watch setup: a third plain slot is open to subscribe from", !!openC?.ok, `${cId} ${openC?.status}`);
    // The credential is read out of the PANE, not out of fleet.json, because "a session that was
    // actually handed the token" is the thing being tested — a state read would pass even if the
    // export never reached the pane. paneEnv is the deterministic probe (unique marker, anchored
    // match, send-keys retried); a hand-rolled send-keys + sleep + capture-pane is the flake shape
    // that harness function exists to have removed. null means the pane never answered, which is a
    // harness failure and fails here rather than being mistaken for an absent variable.
    const cTok = await paneEnv(`s${cId}`, "FLEET_SELF_TOKEN") ?? "";
    check("self-watch setup: the plain subscriber's pane carries FLEET_SELF_TOKEN",
      /^[0-9a-f]{32}$/.test(cTok), `[${cTok}]`);
    const laneTok = await paneEnv(`s${tgt.slot}`, "FLEET_SELF_TOKEN") ?? "";
    check("self-watch setup: the target lane's pane carries its own, different FLEET_SELF_TOKEN",
      /^[0-9a-f]{32}$/.test(laneTok) && laneTok !== cTok, `[${laneTok}]`);
    // peer lanes: peers[0] is a VALID target, so the LANE refusal below can only be about the
    // SUBSCRIBER — aimed at a non-lane it would 409 for the other reason and prove nothing. All
    // five together are what fills WATCH_MAX_PER_SLOT at the end of this block.
    const peers: { slot: number; branch: string }[] = [];
    for (let i = 0; i < 5; i++)
      peers.push((await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; branch: string });
    check("self-watch setup: five peer lanes exist (a valid target, and the cap's population)",
      peers.every((p) => p.slot > 0) && new Set(peers.map((p) => p.slot)).size === 5,
      JSON.stringify(peers.map((p) => p.slot)));

    // --- auth: the same three refusals every route in the self family carries. 401 and not 403,
    // because none of these is a recognized credential in the wrong scope — they are not this
    // route's credential at all. ---
    check("self-watch: the owner token does not substitute for a selfToken",
      (await fetch(`${BASE}/api/self/watch`, {
        method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ target: peers[0].slot }),
      })).status === 401);
    check("self-watch: an unknown selfToken is rejected",
      (await selfWatch("0".repeat(32), { target: peers[0].slot })).status === 401);
    check("self-watch: a missing selfToken header is rejected",
      (await selfWatch(null, { target: peers[0].slot })).status === 401);

    // --- THE NEW RIEGEL, and the reason this block exists. A lane's credential is RECOGNIZED and
    // the target is valid: the only thing that can refuse it is the subscriber rule. 409, never
    // 401 — same convention as the four routes that refuse in the other direction, because a 401
    // would send a session hunting for a token it already holds. ---
    const swLane = await selfWatch(laneTok, { target: peers[0].slot });
    const swLaneText = await swLane.text();
    check("a LANE calling /api/self/watch is refused 409 with its own reason — the mirror of the four lane-only routes",
      swLane.status === 409 && swLaneText.includes("a lane may not subscribe"),
      `${swLane.status} ${swLaneText}`);

    // --- the target refusals, re-asserted THROUGH the self path with their exact wording. Sharing
    // createWatchForSlot is what makes them identical today; pinning the strings is what stops a
    // future self-path-only branch from quietly answering something else. ---
    const idle = await freeSlot();
    check("self-watch setup: a genuinely inactive slot is available as a target", idle > 0, String(idle));
    // the ⚙ steward case borrows peers[4] rather than minting a seventh lane: the label is what the
    // check is about, and it is renamed back before the cap block uses that lane as a real target.
    check("self-watch setup: peers[4] is temporarily labelled ⚙ steward",
      (await post(`/api/slots/${peers[4].slot}/rename`, { label: "⚙ steward" })).ok);
    const targetRejects: [string, unknown, number, string][] = [
      ["a nonexistent slot", { target: 999 }, 400, "bad target"],
      ["itself", { target: cId }, 400, "a session cannot watch itself"],
      ["an inactive slot", { target: idle }, 400, "target slot not active"],
      ["a non-lane slot", { target: aId }, 409, "target is not a lane — done-looking only classifies lanes"],
      ["the ⚙ steward", { target: peers[4].slot }, 409, "the ⚙ steward is never classified done-looking"],
    ];
    for (const [what, body, status, reason] of targetRejects) {
      const r = await selfWatch(cTok, body);
      const text = await r.text();
      check(`self-watch on ${what}: refused ${status} with the owner path's wording, verbatim`,
        r.status === status && text.includes(reason), `${r.status} ${text}`);
    }
    check("self-watch setup: peers[4]'s label is restored, so the cap block targets a real lane",
      (await post(`/api/slots/${peers[4].slot}/rename`, { label: "watch-peer" })).ok);

    // --- the binding, and the reason a pane-typing route can be handed to a session at all: the
    // RECEIVER is the token's slot. A `slot` field naming a different one is not validated and
    // rejected, it is structurally never read — createWatchForSlot takes `s` and never the body.
    //
    // EVERY subscription in this block points at a PEER lane, never at `tgt`, and that is not
    // arbitrary: `tgt` carries a commit, so it is on its way to done-looking and a watch on it
    // fires by itself within a tick or two. Firing disarms — which would silently turn the armed
    // count the cap checks below into 4, and the cap's refusal into a pass for the wrong reason.
    // The peers have no commits (ahead 0), so the predicate never classifies them and an armed
    // watch on one stays armed for as long as this block needs it to. ---
    const sw = await selfWatch(cTok, { target: peers[0].slot, idleSec: 3600, slot: aId });
    const swJ = (await sw.json()) as { ok?: boolean; watch?: WatchRow; existing?: boolean };
    check("POST /api/self/watch: a plain session subscribes with its OWN pane-exported token",
      sw.ok && swJ.watch?.armed === true && swJ.watch.target === peers[0].slot
      && swJ.watch.targetBranch === peers[0].branch, `${sw.status} ${JSON.stringify(swJ)}`);
    check("new Self-route Watches persist the receiver occupant openedAt at the shared creation seam",
      swJ.watch?.slotOpenedAt === persistedOpenedAt(cId) && (swJ.watch?.slotOpenedAt ?? 0) > 0,
      `${swJ.watch?.slotOpenedAt} vs ${persistedOpenedAt(cId)}`);
    check("a spoofed `slot` field is ignored — the watch lands on the TOKEN's slot, not the named one",
      swJ.watch?.slot === cId, `landed on ${swJ.watch?.slot}; token slot ${cId}, spoofed ${aId}`);
    const swDup = (await (await selfWatch(cTok, { target: peers[0].slot })).json()) as
      { watch?: WatchRow; existing?: boolean };
    check("self-watch is idempotent too — re-subscribing returns the SAME watch, not a second",
      swDup.existing === true && swDup.watch?.id === swJ.watch?.id
      && (await watchRows()).filter((w) => w.slot === cId && w.armed).length === 1,
      `${swDup.watch?.id} vs ${swJ.watch?.id}`);

    // --- GET /api/self names them next to the autos: the read half of the same credential. Spent
    // rows are served too, and that is load-bearing — a watch disarmed because its target died
    // delivers NOTHING into the pane, so armed-only would make "still waiting" and "will never
    // come" indistinguishable from inside the session, the one belief this surface exists to make
    // impossible. Proven at the end of this block, after the peers are killed. ---
    const selfRow = await (await fetch(`${BASE}/api/self`, { headers: { "x-fleet-self-token": cTok } })).json() as
      { slot: number; watches?: WatchRow[]; autos?: unknown[]; events?: FleetEventRow[] };
    check("GET /api/self serves the session its OWN watches and typed events beside its autos",
      Array.isArray(selfRow.watches) && Array.isArray(selfRow.autos) && Array.isArray(selfRow.events)
      && selfRow.watches.some((w) => w.id === swJ.watch?.id)
      && selfRow.watches.every((w) => w.slot === cId)
      && selfRow.events.every((e) => e.receiverSlot === cId),
      JSON.stringify(selfRow.watches?.map((w) => `${w.slot}:${w.id}`)));

    // --- the cap. WATCH_MAX_PER_SLOT is shared, not re-implemented per principal, and this is what
    // proves the self path did not route around it: peers[0] is already armed, peers[1..4] fill it
    // to five, and a SIXTH distinct valid target — `tgt`, a real lane — is refused. The cap is the
    // LAST check createWatchForSlot makes, so every earlier reason has to be excluded for the
    // refusal to mean anything; that is why these are five live lanes and not five cheap bad ids. ---
    for (const p of peers.slice(1)) {
      const r = await selfWatch(cTok, { target: p.slot, idleSec: 3600 });
      check(`self-watch fills the cap: subscribing to peer lane ${p.slot}`, r.ok, `${r.status} ${await r.text()}`);
    }
    const capped = await selfWatch(cTok, { target: tgt.slot, idleSec: 3600 });
    const cappedText = await capped.text();
    check("WATCH_MAX_PER_SLOT applies on the self path exactly as on the owner's — the sixth is refused",
      capped.status === 400 && cappedText.includes("max 5 active watches per slot"),
      `${capped.status} ${cappedText}`);
    check("the cap counted armed watches, and the refusal minted nothing",
      (await watchRows()).filter((w) => w.slot === cId && w.armed).length === 5,
      JSON.stringify((await watchRows()).filter((w) => w.slot === cId).map((w) => `${w.target}:${w.armed}`)));

    // the peers go away while all five watches are armed: each disarms WITH its reason, and the
    // self row is where the subscribing session can still read that — the check the comment above
    // promised. Nothing was typed into its pane about any of them.
    for (const p of peers) await post(`/api/slots/${p.slot}/kill`, {});
    const after = await (await fetch(`${BASE}/api/self`, { headers: { "x-fleet-self-token": cTok } })).json() as
      { watches?: WatchRow[] };
    const dead = (after.watches ?? []).filter((w) => !w.armed);
    check("a session reads its own DISARMED watches too — 'will never come' is legible, not a silent gap",
      dead.length === 5 && dead.every((w) => (w.lastResult ?? "").includes("target session ended")),
      JSON.stringify(dead.map((w) => `${w.target}:${w.lastResult}`)));
    check("and nothing was ever typed into the subscriber's pane — no watch here ever fired",
      !(await plogRead()).some((e) => e.slot === cId && e.text.startsWith("[fleet] slot ")));
    await post(`/api/slots/${cId}/kill`, {});
  }

  // --- the subscription itself ---
  const wA = await post(`/api/slots/${aId}/watch`, { target: tgt.slot, idleSec: 0 });
  const wAJ = (await wA.json()) as { watch: WatchRow };
  check("subscribe: a plain slot may watch a lane", wA.ok && !!wAJ.watch?.id && wAJ.watch.armed === true,
    JSON.stringify(wAJ).slice(0, 160));
  check("new owner-route Watches persist the receiver occupant openedAt at the shared creation seam",
    wAJ.watch?.slotOpenedAt === persistedOpenedAt(aId) && (wAJ.watch?.slotOpenedAt ?? 0) > 0,
    `${wAJ.watch?.slotOpenedAt} vs ${persistedOpenedAt(aId)}`);
  check("the watch pins the target's BRANCH, not just its recycled slot id",
    wAJ.watch?.targetBranch === tgt.branch, `${wAJ.watch?.targetBranch} vs ${tgt.branch}`);
  // a second subscribe is the same subscription, not a second one: two armed watches would deliver
  // the same news twice into one pane
  const wDup = (await (await post(`/api/slots/${aId}/watch`, { target: tgt.slot })).json()) as
    { watch: WatchRow; existing?: boolean };
  check("re-subscribing to the same target returns the SAME watch, never a second",
    wDup.existing === true && wDup.watch?.id === wAJ.watch.id
    && (await watchRows()).filter((w) => w.slot === aId && w.armed).length === 1,
    `${wDup.watch?.id} vs ${wAJ.watch.id}`);

  // the busy receiver: same target, but its pane is loud and the gate is two seconds. The wait for
  // lastOutput>0 is what makes this a test of the BUSY gate rather than a race with it: until
  // poll() has seen a first byte the field is 0, and `now - 0` is ~1.79e12 ms — the arithmetic
  // that made this very check fail on the first run by handing the message to a pane that had
  // produced nothing yet (server.ts, THE UNOBSERVED-PANE HOLE).
  let observed = 0;
  for (let i = 0; i < 60 && !observed; i++) {
    // the probe is RE-FIRED each round, not merely re-read, and that is the load-bearing half.
    // The `open` above restarted this pane's pipe, and ensureSlot sets quietUntil = now + 1500
    // when it does; poll() streams anything inside that window WITHOUT stamping lastOutput. One
    // send therefore renders on the pane and still leaves the field at 0 — after which a
    // read-only loop spins for its full 15 s against a pane that never prints again. Measured
    // that way twice on the same tree, deterministically, not as a flake: this slot is recycled
    // out of the stalled block just above, so the send always lands inside a fresh window.
    // Same mechanism as docs/verify-tiering.md §11.2c, which is where the family is recorded.
    await tmuxOut("send-keys", "-t", `s${bId}`, "echo watch-busy-marker", "Enter");
    await Bun.sleep(250);
    observed = ((await (await get("/api/sessions")).json()) as { slots: { id: number; lastOutput: number }[] })
      .slots.find((x) => x.id === bId)?.lastOutput ?? 0;
  }
  check("watch setup: the busy receiver's pane has actually been observed (lastOutput>0)",
    observed > 0, String(observed));
  const wB = (await (await post(`/api/slots/${bId}/watch`, { target: tgt.slot, idleSec: 2 })).json()) as
    { watch: WatchRow };
  check("subscribe: a busy receiver may also watch the same lane", !!wB.watch?.id, JSON.stringify(wB).slice(0, 120));

  // --- signal -> event. Keep B loud until BOTH events exist. Event creation is independent of
  // receiver availability, so A may be delivered while B must remain pending. ---
  let eventA: FleetEventRow | undefined;
  let eventB: FleetEventRow | undefined;
  for (let i = 0; i < 180 && !(eventA?.status === "delivered" && eventB?.status === "pending"); i++) {
    await tmuxOut("send-keys", "-t", `s${bId}`, "echo watch-still-busy", "Enter");
    await Bun.sleep(250);
    eventA = await eventForWatch(wAJ.watch.id);
    eventB = await eventForWatch(wB.watch.id);
  }
  check("one signal creates exactly one durable event even for a busy receiver",
    eventB?.status === "pending" && eventB.attempts === 0
    && (await eventRows()).filter((e) => e.watchId === wB.watch.id).length === 1,
    JSON.stringify(eventB));
  const fired = await watchRow(wAJ.watch.id);
  const busySpent = await watchRow(wB.watch.id);
  check("signal capture spends both Watches before transport; the free receiver's event is delivered, not acked",
    fired?.armed === false && busySpent?.armed === false
    && eventA?.status === "delivered" && eventA.attempts === 1 && eventA.acknowledgedAt === null,
    JSON.stringify({ fired, busySpent, eventA }));
  check("owner visibility exposes the typed event array independently of the Watch rows",
    (await eventRows()).some((e) => e.id === eventA?.id)
    && (await eventRows()).some((e) => e.id === eventB?.id));

  // --- WHAT IT SAID. Asserted against the prompt log, which stores the text verbatim, not against
  // capture-pane (a ~450-char line wraps at the pane width and would make the assertion a test of
  // tmux's reflow). The pane itself is checked separately, on a substring that starts a line. ---
  const msgs = await ownerWatchMessages(aId);
  check("the notification reached the pane exactly once", msgs.length === 1,
    `${msgs.length}: ${msgs.map((m) => m.text.slice(0, 40)).join(" | ")}`);
  const msg = msgs[0]?.text ?? "";
  check("the message names the target slot AND its branch",
    msg.includes(`slot ${tgt.slot} (${tgt.branch})`), msg.slice(0, 120));
  check("the message carries the facts the predicate fired on (ahead/dirty)",
    msg.includes("1 ahead / 0 dirty"), msg.slice(0, 200));
  check("the message says LOOKS done, and says why that is not 'is done'",
    msg.includes("LOOKS done") && !/\bis done\b/.test(msg)
    && msg.includes("NOT a report from that lane") && msg.includes("never land on this message alone")
    && msg.includes(`[event ${eventA?.id}]`)
    && msg.includes(`POST /api/self/events/${eventA?.id}/ack`),
    msg.slice(0, 260));
  const capA = await tmuxOut("capture-pane", "-t", `s${aId}`, "-p");
  check("the notification is really in the receiving pane, not just the log",
    capA.out.includes("[fleet] slot "), capA.out.slice(-200));

  check("busy transport owes the already-created event without typing or minting another",
    eventB?.status === "pending" && (await ownerWatchMessages(bId)).length === 0
    && (await eventRows()).filter((e) => e.watchId === wB.watch.id).length === 1,
    JSON.stringify(eventB));

  // --- Ack is a session-bound act. Foreign slot and unknown id fail before the right principal
  // acknowledges; the identical second Ack returns the same terminal fact. ---
  const foreignAck = eventA ? await ackEvent(bTok, eventA.id) : new Response(null, { status: 599 });
  check("a foreign Self principal cannot acknowledge another slot's event",
    foreignAck.status === 409 && (await eventForWatch(wAJ.watch.id))?.status === "delivered",
    `${foreignAck.status} ${await foreignAck.text()}`);
  const falseAck = await ackEvent(aTok, "doesnotexist");
  check("an unknown event id is 4xx and changes no real event", falseAck.status === 404
    && (await eventForWatch(wAJ.watch.id))?.status === "delivered", String(falseAck.status));
  const ackA = eventA ? await ackEvent(aTok, eventA.id) : new Response(null, { status: 599 });
  const ackAJ = await ackA.json() as { ok?: boolean; existing?: boolean; event?: FleetEventRow };
  const ackA2 = eventA ? await ackEvent(aTok, eventA.id) : new Response(null, { status: 599 });
  const ackA2J = await ackA2.json() as { ok?: boolean; existing?: boolean; event?: FleetEventRow };
  check("the bound Self principal acknowledges delivered -> acknowledged, idempotently",
    ackA.ok && ackAJ.existing === false && ackAJ.event?.status === "acknowledged"
    && ackA2.ok && ackA2J.existing === true && ackA2J.event?.acknowledgedAt === ackAJ.event.acknowledgedAt,
    JSON.stringify({ ackAJ, ackA2J }));

  // --- DEPLOY OUTCOME: same subscription/event/transport/ack rail, joined only by deploy id. ---
  const deployLedger = `${ROOT}/deploys.jsonl`;
  const appendDeploy = (row: Record<string, unknown>): void =>
    appendFileSync(deployLedger, `${JSON.stringify(row)}\n`, { mode: 0o600 });
  const deployRow = (id: string, ok: boolean | null, stage: "build" | "restart" | "boot",
    extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    at: Date.now(), id, by: "owner", stage, ok,
    target: "1".repeat(40), bootHead: ok === null ? null : "1".repeat(40), head: "1".repeat(40),
    hitTarget: ok === null ? null : ok, bundleStale: ok === null ? null : !ok, ...extra,
  });
  const malformedDeployId = await selfWatch(aTok, { kind: "deploy", deployId: "NOT-HEX" });
  check("deploy watch: malformed deployId is refused 400 with a named field error",
    malformedDeployId.status === 400 && (await malformedDeployId.text()).includes("deployId must be exactly 8"));
  const unknownDeployId = await selfWatch(aTok, { kind: "deploy", deployId: "deadbeef" });
  const unknownDeployText = await unknownDeployId.text();
  check("deploy watch: an unknown id is refused loudly because it could never fire",
    unknownDeployId.status === 409
      && unknownDeployText.includes("no in-flight or persisted deploy exists with that id — this watch could never fire"),
    `${unknownDeployId.status} ${unknownDeployText}`);

  const successId = "d0000001";
  appendDeploy(deployRow(successId, true, "boot", { hitTarget: true, bundleStale: false }));
  const successSubR = await selfWatch(aTok, { kind: "deploy", deployId: successId, idleSec: 0 });
  const successSub = await successSubR.json() as { watch?: DeployWatchRow };
  const successEvent = successSub.watch ? await waitDeployEvent(successSub.watch.id) : undefined;
  check("deploy watch: subscribing after a green row fires in the subscribe call with typed hitTarget",
    successSubR.ok && successSub.watch?.armed === false && successEvent?.payload.ok === true
      && successEvent.payload.hitTarget === true && successEvent.subjectDeployId === successId,
    JSON.stringify({ successSub, successEvent }));
  check("new non-lane-kind Watches also inherit slotOpenedAt from the one common creation seam",
    successSub.watch?.kind === "deploy" && successSub.watch.slotOpenedAt === persistedOpenedAt(aId)
      && (successSub.watch.slotOpenedAt ?? 0) > 0,
    `${successSub.watch?.slotOpenedAt} vs ${persistedOpenedAt(aId)}`);
  const successText = (await plogRead()).find((p) => p.slot === aId
    && p.text.includes(`[event ${successEvent?.id}]`))?.text ?? "";
  check("deploy watch: success rendering says ok=YES and names notification versus verdict",
    successText.includes("ok=YES") && successText.includes("not a claim that the deploy succeeded"), successText);
  const deployForeignAck = successEvent ? await ackEvent(bTok, successEvent.id) : new Response(null, { status: 599 });
  check("deploy event: a foreign receiver slot cannot acknowledge it",
    deployForeignAck.status === 409, `${deployForeignAck.status} ${await deployForeignAck.text()}`);
  const deployAck1 = successEvent ? await ackEvent(aTok, successEvent.id) : new Response(null, { status: 599 });
  const deployAck2 = successEvent ? await ackEvent(aTok, successEvent.id) : new Response(null, { status: 599 });
  const deployAck2J = await deployAck2.json() as { existing?: boolean };
  check("deploy event: acknowledgement is idempotent in the bound receiver session",
    deployAck1.ok && deployAck2.ok && deployAck2J.existing === true,
    `${deployAck1.status}/${deployAck2.status} ${JSON.stringify(deployAck2J)}`);

  const failureId = "d0000002";
  appendDeploy(deployRow(failureId, false, "build", {
    bootHead: "0".repeat(40), hitTarget: false, bundleStale: true, reason: "build failed deterministically",
  }));
  const failureSub = await (await selfWatch(bTok,
    { kind: "deploy", deployId: failureId, idleSec: 0 })).json() as { watch?: DeployWatchRow };
  const failureEvent = failureSub.watch ? await waitDeployEvent(failureSub.watch.id) : undefined;
  const failureText = (await plogRead()).find((p) => p.slot === bId
    && p.text.includes(`[event ${failureEvent?.id}]`))?.text ?? "";
  check("deploy watch: failed row stays ok=false with bounded reason and never renders as success",
    failureEvent?.payload.ok === false && failureEvent.payload.reason === "build failed deterministically"
      && failureText.includes("ok=NO") && failureText.includes("Reason: build failed deterministically")
      && !failureText.includes("ok=YES"), JSON.stringify({ event: failureEvent, text: failureText }));
  if (failureEvent) await ackEvent(bTok, failureEvent.id);

  const unknownId = "d0000003";
  appendDeploy(deployRow(unknownId, null, "boot", { reason: "the boot head could not be measured" }));
  const unknownSub = await (await selfWatch(bTok,
    { kind: "deploy", deployId: unknownId, idleSec: 0 })).json() as { watch?: DeployWatchRow };
  const unknownEvent = unknownSub.watch ? await waitDeployEvent(unknownSub.watch.id) : undefined;
  const unknownText = (await plogRead()).find((p) => p.slot === bId
    && p.text.includes(`[event ${unknownEvent?.id}]`))?.text ?? "";
  check("deploy watch: unmeasured row stays ok=null and renders UNVERIFIED, never pass",
    unknownEvent?.payload.ok === null && unknownText.includes("ok=UNVERIFIED")
      && !unknownText.includes("ok=YES"), JSON.stringify({ event: unknownEvent, text: unknownText }));
  if (unknownEvent) await ackEvent(bTok, unknownEvent.id);

  const inflightId = "d0000004";
  writeFileSync(`${ROOT}/deploy-inflight.json`, JSON.stringify({
    id: inflightId, at: Date.now(), by: "owner", target: "2".repeat(40), bootHeadBefore: "1".repeat(40),
    buildMs: 1, buildCmd: "true", restartCmd: "true",
  }), { mode: 0o600 });
  const inflightSubR = await selfWatch(aTok, { kind: "deploy", deployId: inflightId, idleSec: 0 });
  const inflightSub = await inflightSubR.json() as { watch?: DeployWatchRow };
  const inflightDup = await (await selfWatch(aTok,
    { kind: "deploy", deployId: inflightId, idleSec: 0 })).json() as { watch?: DeployWatchRow; existing?: boolean };
  check("deploy watch: an in-flight marker admits one armed subscription and duplicate returns existing",
    inflightSubR.ok && inflightSub.watch?.armed === true && inflightDup.existing === true
      && inflightDup.watch?.id === inflightSub.watch?.id
      && (await deployWatchRows()).filter((w) => w.slot === aId && w.deployId === inflightId).length === 1,
    JSON.stringify({ inflightSub, inflightDup }));
  appendDeploy(deployRow(inflightId, false, "restart", {
    bootHead: "1".repeat(40), hitTarget: false, bundleStale: false, reason: "restart failed",
  }));
  rmSync(`${ROOT}/deploy-inflight.json`, { force: true });
  const inflightEvent = inflightSub.watch ? await waitDeployEvent(inflightSub.watch.id) : undefined;
  check("deploy watch: a row appearing after subscribe is level-minted exactly once by the tick",
    inflightEvent?.payload.ok === false && inflightEvent.payload.stage === "restart"
      && (await deployEventRows()).filter((e) => e.watchId === inflightSub.watch?.id).length === 1,
    JSON.stringify(inflightEvent));
  if (inflightEvent) await ackEvent(aTok, inflightEvent.id);

  const laneDeployToken = await paneEnv(`s${tgt.slot}`, "FLEET_SELF_TOKEN") ?? "";
  const laneDeployWatch = await selfWatch(laneDeployToken, { kind: "deploy", deployId: successId });
  check("deploy watch: a lane remains refused 409 on the existing self-watch route",
    laneDeployWatch.status === 409 && (await laneDeployWatch.text()).includes("a lane may not subscribe"));

  // --- Restart boundary. Stop before editing state: a live save chain may replace fleet.json.
  // Plant the exact durable image a crash after the pre-send marker leaves, plus a legacy spent
  // Watch and malicious extra payload keys. Load must preserve uncertainty, invent no legacy event,
  // and rebuild the payload whitelist rather than retaining free text. ---
  await tmuxOut("kill-session", "-t", "srv");
  await Bun.sleep(500);
  const statePath = `${ROOT}/fleet.json`;
  type EventState = { events?: unknown[]; watches?: unknown[] };
  let eventState: EventState | null = null;
  let eventStateError = "";
  try { eventState = JSON.parse(readFileSync(statePath, "utf8")) as EventState; }
  catch (e) { eventStateError = e instanceof Error ? e.message : String(e); }
  check("event restart fixture: fleet state is readable only after srv stopped", eventState !== null, eventStateError);
  const crashId = "crashboundaryfixture";
  const crashWatchId = "crashboundarywatch";
  const legacyWatchId = "legacywatchfixture";
  const malformedOpenedAtWatchId = "malformedopenedatwatch";
  const malformedMergeId = "malformedmergefixture";
  const malformedDeployEventId = "malformeddeployfixture";
  const crashRaw = eventA ? {
    ...eventA, id: crashId, watchId: crashWatchId, status: "send-uncertain", attempts: 1,
    deliveredAt: null, acknowledgedAt: null,
    payload: { ...eventA.payload, text: "$(touch /tmp/must-not-run)", command: "echo unsafe" },
  } : null;
  eventState?.events?.push(crashRaw);
  if (eventA) eventState?.events?.push({
    ...eventA, id: malformedMergeId, watchId: "malformedmergewatch", kind: "merge-terminal",
    subjectCwd: tgt.cwd, payload: {
      status: "resolved", landed: false, branch: tgt.branch, at: Date.now(), verify: null,
    },
  });
  if (eventA) eventState?.events?.push({
    ...eventA, id: malformedDeployEventId, watchId: "malformeddeploywatch", kind: "deploy-terminal",
    subjectDeployId: successId, payload: {
      ok: null, stage: "boot", target: null, bootHead: null, hitTarget: null, bundleStale: null,
      at: Date.now(), reason: "x".repeat(201),
    },
  });
  eventState?.watches?.push({
    id: legacyWatchId, slot: aId, target: tgt.slot, targetCwd: tgt.cwd,
    targetBranch: tgt.branch, idleSec: 0, armed: false, created: Date.now(),
    firedAt: Date.now(), lastResult: "sent",
  });
  eventState?.watches?.push({
    id: malformedOpenedAtWatchId, slot: aId, slotOpenedAt: "nope", target: tgt.slot, targetCwd: tgt.cwd,
    targetBranch: tgt.branch, idleSec: 0, armed: false, created: Date.now(),
    firedAt: Date.now(), lastResult: "malformed",
  });
  if (eventState) writeFileSync(statePath, JSON.stringify(eventState, null, 2), { mode: 0o600 });
  await restartSrv();

  const afterRestartEvents = await eventRows();
  const restartedA = afterRestartEvents.find((e) => e.id === eventA?.id);
  const restartedB = afterRestartEvents.find((e) => e.id === eventB?.id);
  const uncertain = afterRestartEvents.find((e) => e.id === crashId);
  check("restart keeps an acknowledged event terminal and never re-injects it",
    restartedA?.status === "acknowledged" && (await ownerWatchMessages(aId)).length === 1,
    JSON.stringify(restartedA));
  check("restart keeps the busy pending event with the same id and no invented attempt",
    restartedB?.status === "pending" && restartedB.id === eventB?.id && restartedB.attempts === 0
    && (await ownerWatchMessages(bId)).length === 0, JSON.stringify(restartedB));
  await Bun.sleep(AUTOS_TICK_MS * 4 + 500);
  const uncertainAfterTicks = (await eventRows()).find((e) => e.id === crashId);
  check("the send/crash boundary stays visibly uncertain across restart and is never replayed or called acked",
    uncertainAfterTicks?.status === "send-uncertain" && uncertainAfterTicks.attempts === 1
    && uncertainAfterTicks.deliveredAt === null && uncertainAfterTicks.acknowledgedAt === null
    && (await ownerWatchMessages(aId)).length === 1, JSON.stringify(uncertainAfterTicks));
  check("legacy spent Watch loads unchanged without an invented FleetEvent",
    (await watchRows()).some((w) => w.id === legacyWatchId && w.lastResult === "sent"
      && w.slotOpenedAt === undefined)
    && !(await eventRows()).some((e) => e.watchId === legacyWatchId));
  check("Watch reload keeps missing slotOpenedAt as legacy but rejects a present malformed value fail-closed",
    !(await watchRows()).some((w) => w.id === malformedOpenedAtWatchId)
      && (await watchRows()).some((w) => w.id === legacyWatchId && w.slotOpenedAt === undefined),
    JSON.stringify((await watchRows()).filter((w) => w.id === legacyWatchId || w.id === malformedOpenedAtWatchId)));
  check("per-kind event loading rejects a malformed merge payload without breaking legacy event restore",
    !afterRestartEvents.some((e) => e.id === malformedMergeId) && restartedA?.id === eventA?.id,
    JSON.stringify(afterRestartEvents.filter((e) => e.id === malformedMergeId || e.id === eventA?.id)));
  check("per-kind event loading rejects a malformed deploy-terminal payload",
    !(await deployEventRows()).some((e) => e.id === malformedDeployEventId));
  const payloadKeys = Object.keys(uncertainAfterTicks?.payload ?? {}).sort();
  check("persisted FleetEvent payload is a closed typed fact set and cannot carry free shell/text content",
    JSON.stringify(payloadKeys) === JSON.stringify([
      "ahead", "awaiting", "dirty", "gitOp", "hostCommits", "idleMs", "observed",
    ]) && !JSON.stringify(uncertainAfterTicks?.payload).includes("must-not-run")
      && !JSON.stringify(uncertainAfterTicks?.payload).includes("command"), JSON.stringify(uncertainAfterTicks?.payload));
  const selfA = await (await selfGet(aTok)).json() as { events?: FleetEventRow[] };
  check("GET /api/self exposes only this exact receiver session's events, including uncertainty",
    selfA.events?.some((e) => e.id === crashId) === true
    && selfA.events.every((e) => e.receiverSlot === aId && e.receiverOpenedAt === uncertain?.receiverOpenedAt),
    JSON.stringify(selfA.events?.map((e) => `${e.id}:${e.status}`)));
  const resolveUncertain = await ackEvent(aTok, crashId);
  check("the bound session may explicitly resolve a possibly-seen send-uncertain event",
    resolveUncertain.ok && (await eventRows()).find((e) => e.id === crashId)?.status === "acknowledged",
    `${resolveUncertain.status} ${await resolveUncertain.text()}`);

  // --- The pending event survived. Re-observe B after restart, then let its two-second idle gate
  // elapse. The same event is delivered once; repeated ticks neither mint nor inject a twin. ---
  observed = 0;
  for (let i = 0; i < 60 && !observed; i++) {
    await tmuxOut("send-keys", "-t", `s${bId}`, "echo watch-after-restart", "Enter");
    await Bun.sleep(250);
    observed = ((await (await get("/api/sessions")).json()) as { slots: { id: number; lastOutput: number }[] })
      .slots.find((x) => x.id === bId)?.lastOutput ?? 0;
  }
  check("pending restart fixture: receiver output is observed before its idle gate is tested", observed > 0, String(observed));
  let deliveredB: FleetEventRow | undefined;
  for (let i = 0; i < 40 && deliveredB?.status !== "delivered"; i++) {
    await Bun.sleep(250);
    deliveredB = await eventForWatch(wB.watch.id);
  }
  check("busy -> later idle delivers the SAME pending event exactly once",
    deliveredB?.status === "delivered" && deliveredB.id === eventB?.id && deliveredB.attempts === 1
    && (await ownerWatchMessages(bId)).length === 1
    && (await eventRows()).filter((e) => e.watchId === wB.watch.id).length === 1,
    JSON.stringify(deliveredB));
  await Bun.sleep(AUTOS_TICK_MS * 4 + 500);
  check("repeated ticks produce no duplicate event and no second pane injection",
    (await eventRows()).filter((e) => e.watchId === wB.watch.id).length === 1
    && (await ownerWatchMessages(bId)).length === 1);

  // A dead/replaced receiver makes the unacked event terminal for the owner. Neither the old
  // credential nor the replacement occupant can acknowledge it, and the replacement's /self
  // view cannot inherit it merely because the numeric slot was reused.
  await post(`/api/slots/${bId}/kill`, {});
  const gone = await eventForWatch(wB.watch.id);
  check("a dead receiver leaves its event inspectable as receiver-gone in the owner view",
    gone?.status === "receiver-gone" && gone.deliveredAt !== null && gone.acknowledgedAt === null,
    JSON.stringify(gone));
  check("the replaced session's old token is rejected and cannot Ack the gone event",
    (await ackEvent(bTok, gone?.id ?? "missing")).status === 401);
  const reopenB = await post(`/api/slots/${bId}/open`, { cwd: REPO });
  const newBTok = await paneEnv(`s${bId}`, "FLEET_SELF_TOKEN") ?? "";
  const replacementAck = await ackEvent(newBTok, gone?.id ?? "missing");
  const replacementSelf = await (await selfGet(newBTok)).json() as { events?: FleetEventRow[] };
  check("a replacement occupant is session-bound away from the old event",
    reopenB.ok && newBTok !== bTok && replacementAck.status === 409
    && !replacementSelf.events?.some((e) => e.id === gone?.id),
    `${replacementAck.status} ${await replacementAck.text()}`);

  // Watch deletion and subject teardown do not erase the durable completion object.
  check("delete the spent transport Watch", (await post(`/api/watches/${wAJ.watch.id}/delete`, {})).ok);
  check("deleting a Watch does not delete its acknowledged event",
    !(await watchRow(wAJ.watch.id)) && (await eventRows()).some((e) => e.id === eventA?.id));
  await post(`/api/slots/${tgt.slot}/kill`, {});
  check("subject teardown after event creation leaves the event trail intact",
    (await eventRows()).some((e) => e.id === eventA?.id && e.status === "acknowledged"));
  await post(`/api/slots/${bId}/kill`, {});
  await post(`/api/slots/${aId}/kill`, {});
  const reopenA = await post(`/api/slots/${aId}/open`, { cwd: REPO });
  const replacementATok = await paneEnv(`s${aId}`, "FLEET_SELF_TOKEN") ?? "";
  const replacedDeployAck = successEvent ? await ackEvent(replacementATok, successEvent.id)
    : new Response(null, { status: 599 });
  check("deploy event: a replacement receiver session cannot acknowledge the prior session's event",
    reopenA.ok && replacementATok !== aTok && replacedDeployAck.status === 409,
    `${replacedDeployAck.status} ${await replacedDeployAck.text()}`);
  await post(`/api/slots/${aId}/kill`, {});

  // === MAIN-SESSION EXIT: tickMigrate ==========================================================
  // The isolated wrapper explicitly arms the otherwise-default-off tick at 44%. FLEET_CMD=true
  // pins no session id, so this fixture plants identities exactly as the restart/context tests do;
  // that is what makes three above-threshold controls distinguishable from ctx:null.
  {
    const openPlain = async (label?: string): Promise<number> => {
      const id = await freeSlot();
      if (!id) return 0;
      const r = await post(`/api/slots/${id}/open`, { cwd: REPO, ...(label ? { label } : {}) });
      return r.ok ? id : 0;
    };
    const mainId = await openPlain("migrate-main");
    const lane = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
    const stewardId = await openPlain("⚙ steward");
    const unknownId = await openPlain("migrate-unknown");
    check("migration tick setup: main, lane, steward and ctx-unknown controls are all active",
      mainId > 0 && lane.slot > 0 && stewardId > 0 && unknownId > 0,
      JSON.stringify({ mainId, lane: lane.slot, stewardId, unknownId }));

    // Stop before editing fleet.json: a live saveState chain is allowed to replace the file, so an
    // edit made while srv runs would be a probe racing its subject. restartSrv starts it again with
    // the same FLEET_* env after the identities and usage files are in place.
    await tmuxOut("kill-session", "-t", "srv");
    await Bun.sleep(500);
    const statePath = `${ROOT}/fleet.json`;
    let state: { slots?: Record<string, { cwd?: string; sessionId?: string; model?: string }> } | null = null;
    let stateError = "";
    try { state = JSON.parse(readFileSync(statePath, "utf8")) as
      { slots?: Record<string, { cwd?: string; sessionId?: string; model?: string }> }; }
    catch (e) { stateError = e instanceof Error ? e.message : String(e); }
    check("migration tick setup precondition: fleet state is readable before context mutation",
      state !== null, stateError);
    const ids = new Map<number, string>([
      [mainId, "e2e0feed-0000-4000-8000-000000000101"],
      [lane.slot, "e2e0feed-0000-4000-8000-000000000102"],
      [stewardId, "e2e0feed-0000-4000-8000-000000000103"],
    ]);
    for (const [id, sid] of ids) if (state?.slots?.[String(id)]) state.slots[String(id)]!.sessionId = sid;
    if (state) writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });

    const usageFiles: string[] = [];
    if (state) for (const [id, sid] of ids) {
      const cwd = state.slots?.[String(id)]?.cwd ?? "";
      const dir = `${process.env.HOME}/.claude/projects/${cwd.replace(/[^a-zA-Z0-9]/g, "-")}`;
      mkdirSync(dir, { recursive: true });
      const file = `${dir}/${sid}.jsonl`;
      writeFileSync(file, `${JSON.stringify({ message: { usage: {
        input_tokens: 100_000, cache_creation_input_tokens: 100_000,
        cache_read_input_tokens: 300_000, output_tokens: 9_000_000,
      } } })}\n`);
      usageFiles.push(file);
    }
    await restartSrv();

    type CtxRow = { id: number; ctx: { pct: number; windowTokens: number } | null };
    const ctxRows = ((await (await get("/api/sessions")).json()) as { slots: CtxRow[] }).slots;
    const ctxOf = (id: number) => ctxRows.find((x) => x.id === id)?.ctx;
    check("migration tick setup: main/lane/steward are measurably above 44%, while the unpinned control is ctx:null",
      ctxOf(mainId)?.pct === 50 && ctxOf(lane.slot)?.pct === 50 && ctxOf(stewardId)?.pct === 50
        && ctxOf(unknownId) === null,
      JSON.stringify({ main: ctxOf(mainId), lane: ctxOf(lane.slot), steward: ctxOf(stewardId), unknown: ctxOf(unknownId) }));

    const migratePrompts = async (slot: number) => (await plogRead())
      .filter((e) => e.slot === slot && e.text.startsWith("[fleet] Dein Kontext ist bei "));
    let nudges = await migratePrompts(mainId);
    for (let i = 0; i < 80 && nudges.length === 0; i++) {
      await Bun.sleep(100);
      nudges = await migratePrompts(mainId);
    }
    check("tickMigrate sends exactly one prompt to an above-threshold NON-LANE main session",
      nudges.length === 1, `${nudges.length} prompt(s)`);
    const nudge = nudges[0]?.text ?? "";
    check("the migration prompt names measured pct+window, says server predicate, then HANDOFF commit before self/succeed",
      nudge.includes("50%") && nudge.includes("1000000 Tokens im Fenster")
        && nudge.includes("Server-Prädikat, keine Meldung von dir")
        && nudge.indexOf("HANDOFF.md schreiben UND committen") < nudge.indexOf("POST /api/self/succeed")
        && nudge.includes("x-fleet-self-token aus $FLEET_SELF_TOKEN"), nudge);
    check("tickMigrate never nudges a lane, the ⚙ steward, or a ctx:null slot",
      (await migratePrompts(lane.slot)).length === 0
        && (await migratePrompts(stewardId)).length === 0
        && (await migratePrompts(unknownId)).length === 0,
      JSON.stringify({ lane: (await migratePrompts(lane.slot)).length,
        steward: (await migratePrompts(stewardId)).length, unknown: (await migratePrompts(unknownId)).length }));

    const tickMs = Number(process.env.FLEET_MIGRATE_TICK_MS ?? 60_000) | 0;
    await Bun.sleep(tickMs * 4 + 500);
    check("a second migration tick inside MIGRATE_COOLDOWN_MS sends no second prompt",
      (await migratePrompts(mainId)).length === 1, `${(await migratePrompts(mainId)).length} prompt(s)`);

    // Restart resets the process-local marker. With the threshold still armed this same 50% slot
    // would be nudged again; overriding it to zero proves the stronger default-off contract: no
    // timer is registered, rather than a timer that merely decides not to send.
    await restartSrv({ FLEET_MIGRATE_PCT: "0" });
    await Bun.sleep(tickMs * 4 + 500);
    check("FLEET_MIGRATE_PCT=0 registers no migration tick — an eligible fresh process sends nothing",
      (await migratePrompts(mainId)).length === 1, `${(await migratePrompts(mainId)).length} total prompt(s)`);

    for (const id of [mainId, lane.slot, stewardId, unknownId]) if (id) await post(`/api/slots/${id}/kill`, {});
    for (const file of usageFiles) rmSync(file, { force: true });
  }
}
