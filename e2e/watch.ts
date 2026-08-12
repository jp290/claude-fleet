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
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { laneWatchMessage, laneWatchSignal, type LaneSignalView } from "../lane-signals";
import { AUTOS_TICK_MS, BASE, REPO, ROOT, TOKEN, check, get, paneEnv, plogRead, post, restartSrv, tmuxOut } from "./harness";

interface WatchRow {
  id: string; slot: number; target: number; targetBranch: string;
  armed: boolean; firedAt: number | null; lastResult: string | null;
}
const watchRows = async (): Promise<WatchRow[]> =>
  ((await (await get("/api/sessions")).json()) as { watches: WatchRow[] }).watches;
const watchRow = async (id: string): Promise<WatchRow | undefined> =>
  (await watchRows()).find((w) => w.id === id);
const freeSlot = async (): Promise<number> =>
  ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
    .slots.find((x) => x.cwd === null)?.id ?? 0;
const selfWatch = (tok: string | null, body: unknown): Promise<Response> =>
  fetch(`${BASE}/api/self/watch`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(tok === null ? {} : { "x-fleet-self-token": tok }) },
    body: JSON.stringify(body),
  });

export async function run(): Promise<void> {
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
      const text = laneWatchMessage(7, "host-branch", h, signal);
      check("host-commit watch text names the weaker fact and exact host action",
        text.includes("LOOKS ready for a host commit")
        && text.includes("The work is UNCOMMITTED, 0 ahead is expected for this harness, and the next step is a host commit via POST /api/slots/7/commit.")
        && text.includes("server's weaker predicate") && text.includes("NOT a report from that lane"), text);
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
    check("kill-switch keeps the eligible pi-unfenced Watch armed and delivers no notification",
      paused?.armed === true && paused.lastResult === null
      && !(await plogRead()).some((e) => e.slot === uId
        && e.text.startsWith(`[fleet] slot ${uTgt.slot} (${uTgt.branch})`)), JSON.stringify(paused));
    check("watch pi-unfenced kill-switch fixture: owner releases automation",
      (await post("/api/autos/switch", { on: true })).ok);

    let delivered: WatchRow | undefined;
    for (let i = 0; i < 45 && delivered?.lastResult !== "sent"; i++) {
      await Bun.sleep(1000);
      delivered = subscribedJ.watch?.id ? await watchRow(subscribedJ.watch.id) : undefined;
    }
    const oldPolicySkip = "skipped — harness pi-unfenced is not automatable";
    check("after kill-switch release the explicit Watch reaches live pi-unfenced once: sent, spent, never the old policy skip",
      delivered?.lastResult === "sent" && delivered.armed === false
      && !(delivered.lastResult ?? "").includes(oldPolicySkip), JSON.stringify(delivered));
    const uMessages = (await plogRead()).filter((e) => e.slot === uId
      && e.text.startsWith(`[fleet] slot ${uTgt.slot} (${uTgt.branch})`));
    check("the fixed completion notification has exactly one matching prompt-log row on pi-unfenced",
      uMessages.length === 1, `${uMessages.length}: ${uMessages.map((m) => m.text.slice(0, 80)).join(" | ")}`);
    await Bun.sleep(AUTOS_TICK_MS * 4 + 1500);
    const uAfter = subscribedJ.watch?.id ? await watchRow(subscribedJ.watch.id) : undefined;
    check("the pi-unfenced Watch remains one-shot across later ticks and never records the old skip",
      uAfter?.armed === false && uAfter.lastResult === "sent"
      && (await plogRead()).filter((e) => e.slot === uId
        && e.text.startsWith(`[fleet] slot ${uTgt.slot} (${uTgt.branch})`)).length === 1
      && !(await watchRows()).some((w) => w.slot === uId && (w.lastResult ?? "").includes(oldPolicySkip)),
      JSON.stringify(uAfter));
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
      { slot: number; watches?: WatchRow[]; autos?: unknown[] };
    check("GET /api/self serves the session its OWN watches, beside its autos",
      Array.isArray(selfRow.watches) && Array.isArray(selfRow.autos)
      && selfRow.watches.some((w) => w.id === swJ.watch?.id)
      && selfRow.watches.every((w) => w.slot === cId),
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

  // the busy receiver: same target, but its pane is loud and the gate is an hour. The wait for
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
  const wB = (await (await post(`/api/slots/${bId}/watch`, { target: tgt.slot, idleSec: 3600 })).json()) as
    { watch: WatchRow };
  check("subscribe: a busy receiver may also watch the same lane", !!wB.watch?.id, JSON.stringify(wB).slice(0, 120));

  // --- the fire. Poll the watch row, bounded and loud: the git facts refresh on the 10s tickGit,
  // so this is the one genuinely slow wait in the section. ---
  let fired: WatchRow | undefined;
  for (let i = 0; i < 45 && !(fired?.lastResult === "sent"); i++) {
    await Bun.sleep(1000);
    fired = await watchRow(wAJ.watch.id);
  }
  check("the watch fired by itself when the lane went done-looking — no owner click anywhere",
    fired?.lastResult === "sent" && fired.armed === false && typeof fired.firedAt === "number",
    JSON.stringify(fired));

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
    && msg.includes("NOT a report from that lane") && msg.includes("never land on this message alone"),
    msg.slice(0, 260));
  const capA = await tmuxOut("capture-pane", "-t", `s${aId}`, "-p");
  check("the notification is really in the receiving pane, not just the log",
    capA.out.includes("[fleet] slot "), capA.out.slice(-200));

  // --- EXACTLY ONCE. The predicate is LEVEL-triggered — the lane stays idle+clean+ahead forever —
  // so an armed-forever watch would be a nudge every tick. Several ticks later: still one message. ---
  await Bun.sleep(AUTOS_TICK_MS * 4 + 1500);
  const after = await watchRow(wAJ.watch.id);
  check("a spent watch stays spent — later ticks deliver nothing more",
    after?.armed === false
    && (await ownerWatchMessages(aId)).length === 1,
    JSON.stringify(after));

  // --- the busy receiver, over the same window: the news does not EXPIRE. A notification dropped
  // because its receiver happened to be working is the exact hole the background-watcher crutch
  // had, so the idle gate holds the watch ARMED instead of spending it. ---
  const busy = await watchRow(wB.watch.id);
  check("a busy receiver's watch is held, not spent — it still owes the message",
    busy?.armed === true && busy.lastResult === null
    && (await ownerWatchMessages(bId)).length === 0,
    JSON.stringify(busy));

  // --- the target goes away while a watch is still armed. Deleting the row silently would leave
  // "still waiting" indistinguishable from "will never come" — the belief this feature exists to
  // make impossible. It disarms WITH the reason attached. ---
  await post(`/api/slots/${tgt.slot}/kill`, {});
  const orphan = await watchRow(wB.watch.id);
  check("killing the target disarms the watch with its reason, rather than deleting it silently",
    orphan?.armed === false && (orphan.lastResult ?? "").includes("target session ended"),
    JSON.stringify(orphan));
  check("a disarmed watch never delivers", (await ownerWatchMessages(bId)).length === 0);

  // --- teardown: a watch must not outlive its receiver either ---
  check("delete a watch", (await post(`/api/watches/${wAJ.watch.id}/delete`, {})).ok);
  check("deleted watch gone", !(await watchRow(wAJ.watch.id)));
  await post(`/api/slots/${bId}/kill`, {});
  check("killing the RECEIVER drops its watches entirely — nobody left to tell",
    !(await watchRows()).some((w) => w.slot === bId), JSON.stringify(await watchRows()));
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
