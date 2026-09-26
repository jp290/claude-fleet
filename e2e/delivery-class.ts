import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { BASE, REPO, ROOT, check, get, paneEnv, plogRead, post, restartSrv, tmuxOut, until } from "./harness";

interface SendAudit { event?: string; slot?: number; path?: string; detail?: string; file?: string;
  deliveryClass?: string; ttlSec?: number; ttlQuelle?: string; cache?: string }
const auditRows = (): SendAudit[] => readFileSync(`${ROOT}/audit.jsonl`, "utf8").split("\n")
  .filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line) as SendAudit]; } catch { return []; }
  });

export async function run(): Promise<void> {
  const marker = `delivery-class-${Date.now()}`;
  const autoText = `${marker}: kompletter Check-in`;
  const ownerText = `${marker}: sofortige Owner-Nachricht`;
  const composerMode = process.env.FLEET_E2E_COMPOSER_MODE ?? "";
  await restartSrv({ FLEET_DELIVERY_BUNDLE_SEC: "2" });
  try {
    const session = (await (await get("/api/sessions")).json()) as
      { slots: { id: number; cwd: string | null }[] };
    check("delivery-class fixture: slot 2 remains open after the isolated restart",
      session.slots.some((s) => s.id === 2 && !!s.cwd));
    const before = (await plogRead()).length;
    const sendsBefore = auditRows().filter((r) => r.event === "send" && r.slot === 2).length;
    const scheduled = await post("/api/slots/2/autos", { text: autoText, inSec: 1, idleSec: 0 });
    check("delivery-class fixture: one-shot check-in is scheduled", scheduled.ok, `${scheduled.status}`);
    const queued = await until(() => auditRows().find((r) => r.event === "delivery_bundle_queued"
      && r.slot === 2 && r.path === "auto" && r.cache === "kalt"),
    { timeoutMs: 8_000, what: "cold auto enters a nonzero bundle window" });
    check("cold bundle audit names the class and a derived TTL",
      queued.deliveryClass === "buendelbar" && queued.ttlSec === 300 && queued.ttlQuelle === "unknown",
      JSON.stringify(queued));
    await Bun.sleep(2200);
    check("a cold bundle waits beyond its two-second configured window for an immediate delivery",
      !(await plogRead()).slice(before).some((p) => p.slot === 2 && p.text.includes(autoText)));
    const owner = await post("/send", { slot: 2, text: ownerText });
    check("the immediate Owner delivery succeeds while the cold bundle is waiting", owner.ok, `${owner.status}`);
    const typed = await until(async () => {
      const rows = (await plogRead()).slice(before).filter((p) => p.slot === 2 && p.text.includes(marker));
      return rows.length === 2 ? rows : null;
    }, { timeoutMs: 5_000, what: "bundle and owner delivery receipts" });
    const sends = auditRows().filter((r) => r.event === "send" && r.slot === 2);
    const bundled = auditRows().filter((r) => r.event === "delivery_bundle_sent" && r.slot === 2);
    check("one physical bundle send carries two complete source texts and its path audit",
      typed.some((p) => p.text === autoText) && typed.some((p) => p.text === ownerText)
        && sends.length === sendsBefore + 1 && sends.at(-1)?.path === "bundle"
        && bundled.at(-1)?.detail === "slot:2 count=1",
      JSON.stringify({ texts: typed.map((p) => p.text), sends: sends.length - sendsBefore,
        path: sends.at(-1)?.path, bundle: bundled.at(-1)?.detail }));

    await restartSrv({ FLEET_DELIVERY_BUNDLE_SEC: "10" });
    const largeToken = await paneEnv("s2", "FLEET_SELF_TOKEN") ?? "";
    const largeDeployId = ((Date.now() + 2) >>> 0).toString(16).padStart(8, "0");
    appendFileSync(`${ROOT}/deploys.jsonl`, `${JSON.stringify({ at: Date.now(), id: largeDeployId,
      by: "owner", stage: "boot", ok: true, target: "1".repeat(40), bootHead: "1".repeat(40),
      head: "1".repeat(40), hitTarget: true, bundleStale: false })}\n`);
    const largeSub = await fetch(`${BASE}/api/self/watch`, { method: "POST",
      headers: { "content-type": "application/json", "x-fleet-self-token": largeToken },
      body: JSON.stringify({ kind: "deploy", deployId: largeDeployId, idleSec: 0 }) });
    const largeWatch = await largeSub.json() as { watch?: { id: string } };
    check("large bundle fixture: green watch is subscribed by the current recipient",
      largeSub.ok && !!largeWatch.watch?.id, `${largeSub.status}`);
    const largeEvent = await until(async () => {
      const row = (await (await get("/api/events")).json() as
        { events: { id: string; watchId: string | null; status: string }[] }).events
        .find((r) => r.watchId === largeWatch.watch?.id);
      return row?.status === "pending" && auditRows().some((a) => a.event === "delivery_bundle_queued"
        && a.slot === 2 && a.path === "fleet-event") ? row : null;
    }, { timeoutMs: 8_000, what: "large fixture event waits in the ten-second bundle window" });
    const eventRead = await fetch(`${BASE}/api/self/events/${largeEvent.id}`,
      { headers: { "x-fleet-self-token": largeToken } });
    const eventBody = await eventRead.json() as { text?: string };
    check("large bundle fixture: the original event text is readable", eventRead.ok && !!eventBody.text);
    const largeOwner = `${marker}: immediate first\n${"ü".repeat(18_000)}`;
    const largeFrom = auditRows().length;
    const largeSent = await post("/send", { slot: 2, text: largeOwner });
    const largeRows = auditRows().slice(largeFrom).filter((r) => r.slot === 2);
    const stored = largeRows.filter((r) => r.event === "pane_inbox_stored");
    const physical = largeRows.filter((r) => r.event === "send");
    const expected = `[fleet-buendel 1/2 · path=owner]\n${largeOwner}\n\n`
      + `[fleet-buendel 2/2 · path=fleet-event]\n${eventBody.text}`;
    const disk = stored[0]?.file ? readFileSync(stored[0].file) : null;
    check("a bundle above 32 KiB writes one byte-complete file, with the immediate original first",
      largeSent.ok && Buffer.byteLength(expected, "utf8") > 32 * 1024
        && stored.length === 1 && disk?.equals(Buffer.from(expected, "utf8")) === true,
      `${largeSent.status} stored=${stored.length} equal=${disk?.equals(Buffer.from(expected, "utf8"))}`);
    check("the large bundle costs exactly one physical send turn",
      physical.length === 1 && physical[0]?.path === "bundle",
      `${physical.length} ${physical[0]?.path}`);
    const largeCap = (await tmuxOut("capture-pane", "-p", "-J", "-t", "s2")).out;
    check("the large bundle pointer names its event ID and both classes without opening the file",
      largeCap.includes(largeEvent.id) && largeCap.includes("sofort(owner)")
        && largeCap.includes("buendelbar(fleet-event)")
        && largeCap.includes(stored[0]?.file ?? "missing file"), largeCap.slice(-400));
    await restartSrv({ FLEET_DELIVERY_BUNDLE_SEC: "2" });

    const vacant = (await (await get("/api/sessions")).json() as
      { slots: { id: number; cwd: string | null }[] }).slots.find((s) => !s.cwd)?.id ?? 0;
    const opened = vacant ? await post(`/api/slots/${vacant}/open`, { cwd: REPO, harness: "pi" }) : null;
    const token = opened?.ok ? await paneEnv(`s${vacant}`, "FLEET_SELF_TOKEN") : null;
    check("watch reroute fixture: a separate slot opens with a self token",
      !!opened?.ok && !!token, `${vacant} ${opened?.status}`);
    check("watch refusal fixture: the suite owns a stand-in composer mode file",
      !!composerMode, composerMode ? "mode available" : "mode unavailable");
    if (composerMode) writeFileSync(composerMode, "normal\n");
    const draft = `unsubmitted-${marker}`;
    await tmuxOut("send-keys", "-l", "-t", `s${vacant}`, draft);
    const draftVisible = await until(async () =>
      (await tmuxOut("capture-pane", "-p", "-t", `s${vacant}`)).out.includes(draft) || null,
    { timeoutMs: 5_000, what: "stand-in composer holds an owner draft" });
    check("watch refusal fixture: the first occupant has an unsent draft", draftVisible);
    const deployId = (Date.now() >>> 0).toString(16).padStart(8, "0");
    appendFileSync(`${ROOT}/deploys.jsonl`, `${JSON.stringify({ at: Date.now(), id: deployId, by: "owner",
      stage: "boot", ok: true, target: "1".repeat(40), bootHead: "1".repeat(40), head: "1".repeat(40),
      hitTarget: true, bundleStale: false })}\n`);
    const subscribed = await fetch(`${BASE}/api/self/watch`, { method: "POST",
      headers: { "content-type": "application/json", "x-fleet-self-token": token ?? "" },
      body: JSON.stringify({ kind: "deploy", deployId, idleSec: 0 }) });
    const watch = await subscribed.json() as { watch?: { id: string } };
    check("green deploy watch is accepted for the first occupant",
      subscribed.ok && !!watch.watch?.id, `${subscribed.status}`);
    const event = await until(async () => {
      const rows = (await (await get("/api/events")).json() as
        { events: { id: string; watchId: string | null; status: string; receiverOpenedAt: number }[] }).events;
      const row = rows.find((r) => r.watchId === watch.watch?.id);
      return row?.status === "pending" && auditRows().some((a) => a.event === "delivery_bundle_queued"
        && a.slot === vacant && a.path === "fleet-event") ? row : null;
    }, { timeoutMs: 8_000, what: "green watch queued before its first pane attempt" });
    const refused = await until(() => auditRows().find((r) => r.event === "delivery_bundle_refused"
      && r.slot === vacant && r.detail?.includes("composer occupied")) ?? null,
    { timeoutMs: 8_000, what: "watch bundle refused before paste by the draft" });
    check("a composer refusal leaves the green watch pending for a later recipient",
      refused.detail?.includes("nothing typed") === true
        && (await (await get("/api/events")).json() as
          { events: { id: string; status: string }[] }).events.find((r) => r.id === event.id)?.status === "pending",
      refused.detail ?? "");
    const killed = await post(`/api/slots/${vacant}/kill`, {});
    const successor = await post(`/api/slots/${vacant}/open`, { cwd: REPO });
    check("watch reroute fixture: the old slot occupant ends and a new one opens",
      killed.ok && successor.ok, `${killed.status}/${successor.status}`);
    const delivered = await until(async () => {
      const rows = (await (await get("/api/events")).json() as
        { events: { id: string; status: string; receiverOpenedAt: number }[] }).events;
      const row = rows.find((r) => r.id === event.id);
      return row?.status === "delivered" ? row : null;
    }, { timeoutMs: 12_000, what: "queued watch reaches the replacement occupant" });
    check("an unattempted subscribed watch follows the current slot occupant with a reroute audit",
      delivered.receiverOpenedAt !== event.receiverOpenedAt
        && auditRows().some((r) => r.event === "delivery_bundle_rerouted"
          && r.slot === vacant && r.detail?.includes(event.id)),
      `${event.receiverOpenedAt} -> ${delivered.receiverOpenedAt}`);
    const successorToken = await paneEnv(`s${vacant}`, "FLEET_SELF_TOKEN") ?? "";
    await fetch(`${BASE}/api/self/events/${event.id}/ack`, { method: "POST",
      headers: { "x-fleet-self-token": successorToken } });
    await post(`/api/slots/${vacant}/kill`, {});
    const uncertainReceiver = await post(`/api/slots/${vacant}/open`, { cwd: REPO, harness: "pi" });
    const uncertainToken = uncertainReceiver.ok ? await paneEnv(`s${vacant}`, "FLEET_SELF_TOKEN") ?? "" : "";
    check("uncertain fixture: a composer-backed receiver opens for the second watch",
      uncertainReceiver.ok && !!uncertainToken, `${uncertainReceiver.status}`);
    if (composerMode) writeFileSync(composerMode, "hold\n");
    const uncertainDeployId = ((Date.now() + 1) >>> 0).toString(16).padStart(8, "0");
    appendFileSync(`${ROOT}/deploys.jsonl`, `${JSON.stringify({ at: Date.now(), id: uncertainDeployId,
      by: "owner", stage: "boot", ok: true, target: "1".repeat(40), bootHead: "1".repeat(40),
      head: "1".repeat(40), hitTarget: true, bundleStale: false })}\n`);
    const uncertainSub = await fetch(`${BASE}/api/self/watch`, { method: "POST",
      headers: { "content-type": "application/json", "x-fleet-self-token": uncertainToken },
      body: JSON.stringify({ kind: "deploy", deployId: uncertainDeployId, idleSec: 0 }) });
    const uncertainWatch = await uncertainSub.json() as { watch?: { id: string } };
    check("uncertain fixture: a second green watch is accepted on the replacement occupant",
      uncertainSub.ok && !!uncertainWatch.watch?.id, `${uncertainSub.status}`);
    const uncertain = await until(async () => {
      const rows = (await (await get("/api/events")).json() as
        { events: { id: string; watchId: string | null; status: string; receiverOpenedAt: number }[] }).events;
      const row = rows.find((r) => r.watchId === uncertainWatch.watch?.id);
      return row?.status === "send-uncertain" ? row : null;
    }, { timeoutMs: 10_000, what: "the second watch was pasted but not accepted" });
    await until(() => auditRows().some((r) => r.event === "fleet_event_send_uncertain"
      && r.detail?.includes(uncertain.id)) || null,
    { timeoutMs: 5_000, what: "the uncertain paste has a terminal transport audit" });
    check("uncertain paste is audited with the bound openedAt and never marked delivered",
      auditRows().some((r) => r.event === "delivery_bundle_uncertain"
        && r.slot === vacant && r.detail?.includes(`openedAt=${uncertain.receiverOpenedAt}`))
        && auditRows().some((r) => r.event === "fleet_event_send_uncertain" && r.detail?.includes(uncertain.id)),
      `${uncertain.id} openedAt=${uncertain.receiverOpenedAt}`);
    await post(`/api/slots/${vacant}/kill`, {});
    if (composerMode) writeFileSync(composerMode, "normal\n");
    const third = await post(`/api/slots/${vacant}/open`, { cwd: REPO });
    await Bun.sleep(2500);
    const finalEvent = (await (await get("/api/events")).json() as
      { events: { id: string; status: string; receiverOpenedAt: number }[] }).events
      .find((r) => r.id === uncertain.id);
    check("a send-uncertain watch stays bound to its openedAt and is never rerouted to a later occupant",
      third.ok && finalEvent?.receiverOpenedAt === uncertain.receiverOpenedAt
        && finalEvent.status !== "delivered"
        && !auditRows().some((r) => r.event === "delivery_bundle_rerouted" && r.detail?.includes(uncertain.id)),
      JSON.stringify(finalEvent));
    await post(`/api/slots/${vacant}/kill`, {});

    const roleOpen = await post(`/api/slots/${vacant}/open`,
      { cwd: REPO, label: "Orchestratorin delivery fixture", harness: "pi" });
    check("role bundle fixture: the first Orchestratorin occupant opens", roleOpen.ok, `${roleOpen.status}`);
    if (composerMode) writeFileSync(composerMode, "normal\n");
    const roleDraft = `role-draft-${marker}`;
    await tmuxOut("send-keys", "-l", "-t", `s${vacant}`, roleDraft);
    await until(async () => (await tmuxOut("capture-pane", "-p", "-t", `s${vacant}`)).out
      .includes(roleDraft) || null,
    { timeoutMs: 5_000, what: "role occupant has an unsent draft" });
    const roleToken = roleOpen.ok ? await paneEnv(`s${vacant}`, "FLEET_SELF_TOKEN") ?? "" : "";
    const roleDeployId = ((Date.now() + 3) >>> 0).toString(16).padStart(8, "0");
    appendFileSync(`${ROOT}/deploys.jsonl`, `${JSON.stringify({ at: Date.now(), id: roleDeployId,
      by: "owner", stage: "boot", ok: true, target: "1".repeat(40), bootHead: "1".repeat(40),
      head: "1".repeat(40), hitTarget: true, bundleStale: false })}\n`);
    const roleSub = await fetch(`${BASE}/api/self/watch`, { method: "POST",
      headers: { "content-type": "application/json", "x-fleet-self-token": roleToken },
      body: JSON.stringify({ kind: "deploy", deployId: roleDeployId, idleSec: 0 }) });
    const roleWatch = await roleSub.json() as { watch?: { id: string } };
    check("role bundle fixture: Orchestratorin subscribes its own green watch",
      roleSub.ok && !!roleWatch.watch?.id, `${roleSub.status}`);
    const roleEvent = await until(async () => {
      const row = (await (await get("/api/events")).json() as
        { events: { id: string; watchId: string | null; status: string; receiverOpenedAt: number }[] }).events
        .find((r) => r.watchId === roleWatch.watch?.id);
      return row?.status === "pending" && auditRows().some((a) => a.event === "delivery_bundle_queued"
        && a.slot === vacant && a.path === "fleet-event") ? row : null;
    }, { timeoutMs: 8_000, what: "role-addressed green watch is queued" });
    const roleRefused = await until(() => auditRows().find((r) => r.event === "delivery_bundle_refused"
      && r.slot === vacant && r.detail?.includes("composer occupied")) ?? null,
    { timeoutMs: 8_000, what: "role bundle is refused before paste" });
    check("role bundle is still unattempted after the composer refusal",
      roleRefused.detail?.includes("nothing typed") === true
        && (await (await get("/api/events")).json() as
          { events: { id: string; status: string }[] }).events.find((e) => e.id === roleEvent.id)?.status === "pending",
      roleRefused.detail ?? "");
    const roleBefore = auditRows().length;
    const roleKilled = await post(`/api/slots/${vacant}/kill`, {});
    const roleNext = (await (await get("/api/sessions")).json() as
      { slots: { id: number; cwd: string | null }[] }).slots
      .find((s) => !s.cwd && s.id !== vacant)?.id ?? 0;
    const roleSuccessor = roleNext ? await post(`/api/slots/${roleNext}/open`,
      { cwd: REPO, label: "Orchestratorin delivery successor" }) : null;
    check("role bundle fixture: the successor occupies a different slot",
      roleKilled.ok && !!roleSuccessor?.ok && roleNext !== vacant,
      `${roleKilled.status}/${roleSuccessor?.status} slot=${roleNext}`);
    const roleReceipt = await until(async () =>
      (await (await get("/api/events")).json() as
        { events: { id: string; status: string; receiverSlot: number; receiverOpenedAt: number }[] }).events
        .find((r) => r.id === roleEvent.id && r.status === "delivered") ?? null,
    { timeoutMs: 12_000, what: "role watch reaches successor's session" });
    check("unattempted role bundle follows the current occupant across slots with an audit",
      roleReceipt.receiverSlot === roleNext && roleReceipt.receiverOpenedAt !== roleEvent.receiverOpenedAt
        && auditRows().slice(roleBefore).some((r) => r.event === "delivery_bundle_rerouted"
          && r.slot === roleNext && r.detail?.includes(`from slot=${vacant}`)),
      `from=${vacant} to=${roleNext}`);
    await post(`/api/slots/${roleNext}/kill`, {});
  } finally {
    if (composerMode) writeFileSync(composerMode, "normal\n");
    await restartSrv({ FLEET_DELIVERY_BUNDLE_SEC: "0" });
  }
}
