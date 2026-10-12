import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { AUTOS_TICK_MS, BASE, REPO, REPO2, ROOT, check, get, paneEnv, plogRead, post, restartSrv, stopSrv, tmuxOut, until } from "./harness";

interface SendAudit { event?: string; slot?: number; path?: string; detail?: string; file?: string;
  ts?: number; dueAt?: number; deliveryClass?: string; ttlSec?: number; ttlQuelle?: string;
  cache?: string; eventId?: string; acceptance?: string; count?: number; paths?: string; reason?: string }
interface DeliveryEvent { id: string; watchId: string | null; status: string; kind: string;
  receiverSlot: number; receiverOpenedAt: number; payload?: { result?: string } }
const auditRows = (): SendAudit[] => readFileSync(`${ROOT}/audit.jsonl`, "utf8").split("\n")
  .filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line) as SendAudit]; } catch { return []; }
  });
const eventRows = async (): Promise<DeliveryEvent[]> =>
  (await (await get("/api/events")).json() as { events: DeliveryEvent[] }).events;
// THE SENTENCES A RECEIVER READS (server.ts#DELIVERY_MEANING), quoted where the pane must show them
const MEANING = {
  auto: "naechster Schritt: beantworte den Check-in im laufenden Auftrag · Grenze: keine neue Befugnis",
  owner: "naechster Schritt: pruefe die Nachricht auf einen Auftrag · Grenze: der Kopf belegt keinen Sprecher",
  bundle: "naechster Schritt: bearbeite die enthaltenen Zustellungen · Grenze: nur innerhalb deiner bestehenden Rolle",
  "fleet-event": "naechster Schritt: lies das Ereignis und handle in deiner Rolle · Grenze: keine neue Befugnis",
} as const;
// the whole scrollback: a header is wider than the pane and a bundle is many lines
const paneText = async (pane: string): Promise<string> =>
  (await tmuxOut("capture-pane", "-p", "-J", "-S", "-", "-t", pane)).out;
// …compared with ALL whitespace removed: the capture trims a space that falls at a row end. What is
// compared is the words and their order.
const squash = (text: string): string => text.replace(/\s+/g, "");
const inPane = (pane: string, expected: string): boolean => squash(pane).includes(squash(expected));
const around = (pane: string, needle: string): string | null => {
  const flat = squash(pane);
  const at = flat.indexOf(squash(needle));
  return at < 0 ? null : flat.slice(Math.max(0, at - 160), at + squash(needle).length + 20);
};
// A plain `cat` in the pane for the deliveries a check reads back off the screen: the tty echoes what
// was typed as it arrived, where the shell's line editor redraws a long multibyte line and overwrote
// the header's start locally ("~%ehenden Rolle]", 2026-09-28). C-c first: a shell left at a quote>
// continuation would read `cat` as more quoted text.
const catPane = async (pane: string): Promise<boolean> => {
  await tmuxOut("send-keys", "-t", pane, "C-c");
  await tmuxOut("send-keys", "-t", pane, "cat", "Enter");
  for (let i = 0; i < 50; i++) {
    if ((await tmuxOut("display-message", "-p", "-t", pane, "#{pane_current_command}")).out.trim() === "cat") return true;
    await Bun.sleep(100);
  }
  return false;
};
const currentSelfToken = (slot: number): string => {
  const state = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
    { slots?: Record<string, { selfToken?: string }> };
  return state.slots?.[String(slot)]?.selfToken ?? "";
};

export async function run(): Promise<void> {
  const marker = `delivery-class-${Date.now()}`;
  const autoText = `${marker}: kompletter Check-in`;
  const ownerText = `${marker}: sofortige Owner-Nachricht`;
  const composerMode = process.env.FLEET_E2E_COMPOSER_MODE ?? "";
  await restartSrv({ FLEET_DELIVERY_BUNDLE_SEC: "2" });
  try {
    await catPane("s2");
    const oneShotText = `${marker}: sofortiger One-Shot`, oneShotAuditBefore = auditRows().length, oneShotPlBefore = (await plogRead()).length;
    const oneShot = await post("/api/slots/2/autos", { text: oneShotText, everySec: null, inSec: 1, idleSec: 0 });
    const oneShotBody = await oneShot.json() as { auto?: { id: string; everySec: number | null } };
    const oneShotFire = await until(() => auditRows().slice(oneShotAuditBefore).find((r) =>
      r.event === "auto_fire" && r.slot === 2 && r.detail === oneShotBody.auto?.id) ?? null,
    { timeoutMs: 8_000, what: "one-shot reaches its audit receipt" });
    const oneShotAudit = auditRows().slice(oneShotAuditBefore);
    const oneShotSends = oneShotAudit.filter((r) => r.event === "send" && r.slot === 2 && r.path === "auto");
    check("a due one-shot is sent with deliveryClass sofort", oneShotSends.length === 1
      && oneShotSends[0]?.deliveryClass === "sofort" && !!oneShotFire, JSON.stringify(oneShotSends));
    check("a one-shot never enters the auto bundle window", !oneShotAudit.some((r) =>
      r.event === "delivery_bundle_queued" && r.slot === 2 && r.path === "auto"), JSON.stringify(oneShotAudit));
    check("the immediate one-shot delivers its full text once", (await plogRead()).slice(oneShotPlBefore).filter((p) => p.slot === 2 && p.text === oneShotText).length === 1);
    const before = (await plogRead()).length;
    const sendsBefore = auditRows().filter((r) => r.event === "send" && r.slot === 2).length;
    const scheduled = await post("/api/slots/2/autos", { text: autoText, everySec: 60, runs: 1, inSec: 1, idleSec: 0 });
    const scheduledBody = await scheduled.json() as { auto?: { id: string; everySec: number | null } };
    const queued = await until(() => auditRows().slice(oneShotAuditBefore).find((r) => r.event === "delivery_bundle_queued"
      && r.slot === 2 && r.path === "auto" && r.cache === "kalt"),
    { timeoutMs: 8_000, what: "cold auto enters a nonzero bundle window" });
    check("cold bundle audit names its delivery class",
      queued.deliveryClass === "buendelbar", JSON.stringify(queued));
    check("a recipient without readable assistant usage gets the five-minute TTL, never a guessed hour",
      queued.ttlSec === 300 && queued.ttlQuelle === "unknown" && queued.cache === "kalt",
      JSON.stringify(queued));
    check("a cold auto stays queued before its two-second window ends",
      !(await plogRead()).slice(before).some((p) => p.slot === 2 && p.text.includes(autoText)));
    const owner = await Promise.race([post("/send", { slot: 2, text: ownerText }),
      Bun.sleep(3_000).then(() => null)]);
    check("the immediate Owner delivery succeeds while the cold bundle is waiting",
      owner?.ok === true, `${owner?.status ?? "timed out before the bundle window"}`);
    if (!owner?.ok) return;
    const typed = await until(async () => {
      const rows = (await plogRead()).slice(before).filter((p) => p.slot === 2 && p.text.includes(marker));
      return rows.length === 2 ? rows : null;
    }, { timeoutMs: 5_000, what: "bundle and owner delivery receipts" });
    const afterRecurring = await (await get("/api/sessions")).json() as { autos: { id: string; enabled: boolean; runsLeft: number; lastResult: string | null }[] };
    check("a recurring bundle fixture with runs:1 is spent after its delivery", afterRecurring.autos.some((a) => a.id === scheduledBody.auto?.id && !a.enabled && a.runsLeft === 0 && a.lastResult === "sent"));
    const sends = auditRows().filter((r) => r.event === "send" && r.slot === 2);
    const bundled = auditRows().filter((r) => r.event === "delivery_bundle_sent" && r.slot === 2);
    check("one physical bundle send carries two complete source texts and its path audit",
      typed.some((p) => p.text === autoText) && typed.some((p) => p.text === ownerText)
        && sends.length === sendsBefore + 1 && sends.at(-1)?.path === "bundle"
        && bundled.at(-1)?.detail === "slot:2 count=1",
      JSON.stringify({ texts: typed.map((p) => p.text), sends: sends.length - sendsBefore,
        path: sends.at(-1)?.path, bundle: bundled.at(-1)?.detail }));
    const twoPane = await paneText("s2");
    check("a two-entry bundle is headed path=bundle and each mark carries its own path's sentence",
      inPane(twoPane, `path=bundle · Slot 2 · ${MEANING.bundle}] [fleet-buendel 1/2 · path=owner · ${MEANING.owner}]`)
        && inPane(twoPane, `[fleet-buendel 2/2 · path=auto · ${MEANING.auto}]`),
      JSON.stringify([around(twoPane, "[fleet-buendel 1/2"), around(twoPane, "[fleet-buendel 2/2")]));
    const timedAuto = `${marker}: kalter Auto-Termin`;
    const timedAutoAuditBefore = auditRows().length;
    const timedAutoPlBefore = (await plogRead()).length;
    await post("/api/slots/2/autos", { text: timedAuto, everySec: 60, runs: 1, inSec: 1, idleSec: 0 });
    const timedAutoQueued = await until(() => auditRows().slice(timedAutoAuditBefore).find((r) =>
      r.event === "delivery_bundle_queued" && r.slot === 2 && r.path === "auto" && r.cache === "kalt") ?? null,
    { timeoutMs: 8_000, what: "second cold auto enters its own window" });
    await Bun.sleep(3_000);
    const timedAutoSends = auditRows().slice(timedAutoAuditBefore).filter((r) =>
      r.event === "send" && r.slot === 2);
    const timedAutoPrompts = (await plogRead()).slice(timedAutoPlBefore).filter((p) =>
      p.slot === 2 && p.text === timedAuto);
    const timedAutoFlushed = timedAutoQueued.deliveryClass === "buendelbar"
      && typeof timedAutoQueued.dueAt === "number"
      && timedAutoSends.length === 1 && (timedAutoSends[0]?.ts ?? 0) >= timedAutoQueued.dueAt - 100
      && timedAutoPrompts.length === 1;
    check("a cold auto arrives after its bundle window without another wakeup", timedAutoFlushed,
      `due=${timedAutoQueued.dueAt} sends=${timedAutoSends.length} prompts=${timedAutoPrompts.length}`);
    if (!timedAutoFlushed) return;
    const timedAutoBundled = auditRows().slice(timedAutoAuditBefore).filter((r) =>
      r.event === "delivery_bundle_sent" && r.slot === 2);
    const timedAutoPane = await paneText("s2");
    check("a single bundled auto is typed with its own header — path=auto and its sentence — and counted count=1",
      timedAutoSends.length === 1 && timedAutoSends[0]?.path === "auto"
        && timedAutoBundled.length === 1 && timedAutoBundled[0]?.count === 1
        && timedAutoBundled[0]?.paths === "auto"
        && inPane(timedAutoPane, `[fleet-zustellung · geplanter Check-in · path=auto · Slot 2 · ${MEANING.auto}] ${timedAuto}`),
      JSON.stringify({ sends: timedAutoSends.map((r) => r.path), bundled: timedAutoBundled.map((r) => [r.count, r.paths]),
        line: around(timedAutoPane, timedAuto) }));
    const loneText = `${marker}: allein im leeren Buendel`;
    const loneAuditBefore = auditRows().length;
    const loneScheduled = await post("/api/slots/2/autos", { text: `${marker}: geloeschter Check-in`, everySec: 60, runs: 1, inSec: 1, idleSec: 0 });
    const loneAutoId = ((await loneScheduled.json()) as { auto?: { id: string } }).auto?.id ?? "";
    await until(() => auditRows().slice(loneAuditBefore).find((r) =>
      r.event === "delivery_bundle_queued" && r.slot === 2 && r.path === "auto") ?? null,
    { timeoutMs: 8_000, what: "the auto that will be deleted enters its window" });
    const loneDeleted = await post(`/api/autos/${loneAutoId}/delete`, {});
    const loneSent = await post("/send", { slot: 2, text: loneText });
    const loneBundled = await until(() => auditRows().slice(loneAuditBefore).find((r) =>
      r.event === "delivery_bundle_sent" && r.slot === 2) ?? null,
    { timeoutMs: 5_000, what: "the immediate delivery flushes the emptied bundle" }).catch(() => null);
    const loneSends = auditRows().slice(loneAuditBefore).filter((r) => r.event === "send" && r.slot === 2);
    const lonePane = await paneText("s2");
    check("a single immediate delivery into an emptied bundle keeps its own path — path=owner, its own (short) header",
      loneScheduled.ok && loneDeleted.ok && loneSent.ok
        && loneBundled?.paths === "owner" && loneBundled.count === 1 && loneBundled.deliveryClass === "sofort"
        && auditRows().slice(loneAuditBefore).some((r) => r.event === "delivery_bundle_dropped" && r.path === "auto")
        && loneSends.length === 1 && loneSends[0]?.path === "owner"
        && inPane(lonePane, `[fleet-zustellung · Owner-Credential · Slot 2] ${loneText}`),
      JSON.stringify({ status: [loneScheduled.status, loneDeleted.status, loneSent.status],
        bundled: loneBundled ? [loneBundled.count, loneBundled.paths, loneBundled.deliveryClass] : null,
        sends: loneSends.map((r) => r.path),
        line: around(lonePane, loneText) }));

    const slashText = `/fleet-probe-${marker}`;
    const slashAutoText = `${marker}: Check-in neben einem Befehl`;
    const slashAuditBefore = auditRows().length;
    const slashScheduled = await post("/api/slots/2/autos", { text: slashAutoText, everySec: 60, runs: 1, inSec: 1, idleSec: 0 });
    await until(() => auditRows().slice(slashAuditBefore).find((r) =>
      r.event === "delivery_bundle_queued" && r.slot === 2 && r.path === "auto") ?? null,
    { timeoutMs: 8_000, what: "an auto waits in the window beside the coming command" });
    const slashSent = await post("/send", { slot: 2, text: slashText });
    const slashAutoFlush = await until(() => auditRows().slice(slashAuditBefore).find((r) =>
      r.event === "delivery_bundle_sent" && r.slot === 2) ?? null,
    { timeoutMs: 8_000, what: "the waiting auto flushes after the command" }).catch(() => null);
    const slashSends = auditRows().slice(slashAuditBefore).filter((r) => r.event === "send" && r.slot === 2);
    const slashRows = (await paneText("s2")).split("\n").filter((row) => row.includes(slashText));
    check("an owner /-command beside a waiting bundle is typed alone, first and headerless; the auto flushes on its own",
      slashScheduled.ok && slashSent.ok
        && slashSends.length === 2 && slashSends[0]?.path === "owner" && slashSends[1]?.path === "auto"
        && slashAutoFlush?.count === 1 && slashAutoFlush.paths === "auto"
        && slashRows.length > 0 && slashRows.every((row) => row.trim() === slashText),
      JSON.stringify({ status: [slashScheduled.status, slashSent.status], sends: slashSends.map((r) => r.path),
        flush: slashAutoFlush ? [slashAutoFlush.count, slashAutoFlush.paths] : null,
        rows: slashRows.map((row) => row.slice(0, 200)) }));

    await tmuxOut("send-keys", "-t", "s2", "C-c"); // the header read-backs are done: hand s2 back to its shell
    await stopSrv();
    const coldState = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as {
      slots: Record<string, { openedAt: number; sessionId: string | null }>;
      events?: Record<string, unknown>[] };
    const coldOccupant = coldState.slots["2"]!;
    const coldIds = [0, 1, 2].map((i) => `${(Date.now() + i).toString(16).padStart(24, "0")}`);
    coldState.events = [...(coldState.events ?? []), ...coldIds.map((id, i) => ({
      id, watchId: null, receiverSlot: 2, receiverOpenedAt: coldOccupant.openedAt,
      receiverSessionId: coldOccupant.sessionId, receiverAddress: { kind: "slot", id: 2 },
      receiverIdleSec: 0, subjectJobId: `${(Date.now() + i).toString(16).padStart(12, "0")}`,
      kind: "lane-suite", payload: { result: "green", branch: `fleet/delivery-cold-${i}`,
        exitCode: 0, fails: [], failCount: 0, tail: "ALL PASS" },
      createdAt: Date.now(), status: "pending", attempts: 0, deliveredAt: null,
      acknowledgedAt: null, delivery: "pane",
    }))];
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(coldState, null, 2));
    const coldSendsBefore = auditRows().filter((r) => r.event === "send" && r.slot === 2).length;
    await restartSrv({ FLEET_DELIVERY_BUNDLE_SEC: "10" });
    await until(async () => {
      const rows = await eventRows();
      return coldIds.every((id) => rows.some((e) => e.id === id && e.status === "pending"))
        && auditRows().some((r) => r.event === "delivery_bundle_queued" && r.slot === 2
          && r.path === "fleet-event") ? true : null;
    }, { timeoutMs: 8_000, what: "three validated green watchless events enter the cold queue" });
    await Bun.sleep(10_300);
    const coldStill = await eventRows();
    check("three green events to a cold recipient stay pending beyond the whole window",
      coldIds.every((id) => coldStill.some((e) => e.id === id && e.status === "pending"))
        && auditRows().filter((r) => r.event === "send" && r.slot === 2).length === coldSendsBefore,
      `pending=${coldIds.filter((id) => coldStill.some((e) => e.id === id && e.status === "pending")).length}`);
    const redAfter = `${(Date.now() >>> 0).toString(16).padStart(8, "0")}${"2".repeat(32)}`;
    const redAt = Date.now();
    appendFileSync(`${ROOT}/post-land-audits.jsonl`, `${JSON.stringify({ at: redAt, startedAt: redAt - 1,
      ms: 1, repo: REPO, main: "main", mainSha: redAfter, result: "red", cmd: "delivery-red-fixture",
      exitCode: 1, out: "FAIL", checks: { ran: 1, failed: 1 },
      covers: [{ branch: "fleet/delivery-red", mainAfter: redAfter, at: redAt - 2 }] })}\n`);
    const redWatch = await post("/api/slots/2/watch", { kind: "audit", repo: REPO,
      mainAfter: redAfter, idleSec: 0 });
    const redBody = await redWatch.json() as { watch?: { id: string } };
    const redEvent = await until(async () => (await eventRows()).find((e) =>
      e.watchId === redBody.watch?.id && e.status === "delivered") ?? null,
    { timeoutMs: 8_000, what: "red audit wakes the cold recipient" });
    const afterRed = await eventRows();
    const redSends = auditRows().filter((r) => r.event === "send" && r.slot === 2).slice(coldSendsBefore);
    check("a red audit bypasses the window and carries all three cold green events in one turn",
      redEvent.kind === "post-land-audit" && redEvent.payload?.result === "red"
        && coldIds.every((id) => afterRed.some((e) => e.id === id && e.status === "delivered"))
        && redSends.length === 1 && redSends[0]?.path === "bundle"
        && redSends[0]?.deliveryClass === "sofort"
        && typeof redSends[0]?.ts === "number" && redSends[0].ts - redAt < 10_000,
      `${redSends.length} sends; green=${coldIds.filter((id) => afterRed.some((e) => e.id === id && e.status === "delivered")).length}; elapsed=${(redSends[0]?.ts ?? 0) - redAt}`);
    const largeToken = currentSelfToken(2);
    const largeDeployId = ((Date.now() + 2) >>> 0).toString(16).padStart(8, "0");
    appendFileSync(`${ROOT}/deploys.jsonl`, `${JSON.stringify({ at: Date.now(), id: largeDeployId,
      by: "owner", stage: "boot", ok: true, target: "1".repeat(40), bootHead: "1".repeat(40),
      head: "1".repeat(40), hitTarget: true, bundleStale: false })}\n`);
    const largeQueueBefore = auditRows().length;
    const largeSub = await fetch(`${BASE}/api/self/watch`, { method: "POST",
      headers: { "content-type": "application/json", "x-fleet-self-token": largeToken },
      body: JSON.stringify({ kind: "deploy", deployId: largeDeployId, idleSec: 0 }) });
    const largeWatch = await largeSub.json() as { watch?: { id: string } };
    const largeEvent = await until(async () => {
      const row = (await (await get("/api/events")).json() as
        { events: { id: string; watchId: string | null; status: string }[] }).events
        .find((r) => r.watchId === largeWatch.watch?.id);
      return row?.status === "pending" && auditRows().slice(largeQueueBefore).some((a) => a.event === "delivery_bundle_queued"
        && a.slot === 2 && a.path === "fleet-event") ? row : null;
    }, { timeoutMs: 8_000, what: "large fixture event waits in the ten-second bundle window" });
    const eventRead = await fetch(`${BASE}/api/self/events/${largeEvent.id}`,
      { headers: { "x-fleet-self-token": largeToken } });
    const eventBody = await eventRead.json() as { text?: string };
    const largeOwner = `${marker}: immediate first\n${"ü".repeat(18_000)}`;
    const largeFrom = auditRows().length;
    const largeSent = await post("/send", { slot: 2, text: largeOwner });
    const largeRows = auditRows().slice(largeFrom).filter((r) => r.slot === 2);
    const stored = largeRows.filter((r) => r.event === "pane_inbox_stored");
    const physical = largeRows.filter((r) => r.event === "send");
    const expected = `[fleet-buendel 1/2 · path=owner · ${MEANING.owner}]\n${largeOwner}\n\n`
      + `[fleet-buendel 2/2 · path=fleet-event · ${MEANING["fleet-event"]}]\n${eventBody.text}`;
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

    const warmSlot = (await (await get("/api/sessions")).json() as
      { slots: { id: number; cwd: string | null }[] }).slots.find((s) => !s.cwd)?.id ?? 0;
    if (warmSlot) await post(`/api/slots/${warmSlot}/open`, { cwd: REPO });
    await stopSrv();
    const warmState = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as {
      slots: Record<string, { cwd: string; sessionId: string | null }> };
    const warmOccupant = warmState.slots[String(warmSlot)]!;
    warmOccupant.sessionId ??= "e2e0feed-0000-4000-8000-000000000126";
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(warmState, null, 2));
    const projectRoot = `${ROOT}/delivery-cache-projects`;
    const projectDir = `${projectRoot}/${warmOccupant.cwd.replace(/[^a-zA-Z0-9]/g, "-")}`;
    mkdirSync(projectDir, { recursive: true });
    const usageFile = `${projectDir}/${warmOccupant.sessionId}.jsonl`;
    let usageSerial = 0;
    const writeUsage = (tier: "1h" | "5m", ageSec: number): number => {
      const at = Date.now() - ageSec * 1000;
      writeFileSync(usageFile, `${JSON.stringify({ type: "assistant", timestamp: new Date(at).toISOString(),
        message: { id: `delivery-usage-${++usageSerial}`, model: "claude-opus-5-5[1m]",
          usage: { input_tokens: 100, cache_creation_input_tokens: 1, cache_read_input_tokens: 200,
            cache_creation: { ephemeral_1h_input_tokens: tier === "1h" ? 1 : 0,
              ephemeral_5m_input_tokens: tier === "5m" ? 1 : 0 } } } })}\n`);
      return at;
    };
    let deploySerial = Date.now() >>> 0;
    const subscribeGreen = async (): Promise<string> => {
      const id = (deploySerial++).toString(16).padStart(8, "0");
      appendFileSync(`${ROOT}/deploys.jsonl`, `${JSON.stringify({ at: Date.now(), id, by: "owner",
        stage: "boot", ok: true, target: "1".repeat(40), bootHead: "1".repeat(40),
        head: "1".repeat(40), hitTarget: true, bundleStale: false })}\n`);
      const res = await post(`/api/slots/${warmSlot}/watch`, { kind: "deploy", deployId: id, idleSec: 0 });
      const body = await res.json() as { watch?: { id: string } };
      return body.watch?.id ?? "";
    };
    writeUsage("1h", 0);
    await restartSrv({ FLEET_CLAUDE_PROJECTS_DIR: projectRoot, FLEET_DELIVERY_BUNDLE_SEC: "5" });
    const warmSendsBefore = auditRows().filter((r) => r.event === "send" && r.slot === warmSlot).length;
    const warmWatchIds = await Promise.all([subscribeGreen(), subscribeGreen(), subscribeGreen()]);
    await until(async () => {
      const rows = await eventRows();
      return warmWatchIds.every((id) => rows.some((e) => e.watchId === id && e.status === "pending"))
        && auditRows().some((r) => r.event === "delivery_bundle_queued" && r.slot === warmSlot
          && r.ttlQuelle === "1h") ? true : null;
    }, { timeoutMs: 8_000, what: "three warm green events are queued" });
    const warmQueued = auditRows().find((r) => r.event === "delivery_bundle_queued"
      && r.slot === warmSlot && r.ttlQuelle === "1h")!;
    await Bun.sleep(1_500);
    check("three green events to an idle warm recipient do not arrive before the window",
      auditRows().filter((r) => r.event === "send" && r.slot === warmSlot).length === warmSendsBefore
        && warmWatchIds.every((id) => id !== ""),
      `queued=${warmWatchIds.length} sends=${auditRows().filter((r) => r.event === "send" && r.slot === warmSlot).length - warmSendsBefore}`);
    const warmDone = await until(async () => {
      const rows = await eventRows();
      return warmWatchIds.every((id) => rows.some((e) => e.watchId === id && e.status === "delivered"))
        ? rows.filter((e) => warmWatchIds.includes(e.watchId ?? "")) : null;
    }, { timeoutMs: 9_000, what: "three green events flush after the warm window" });
    const warmSends = auditRows().filter((r) => r.event === "send" && r.slot === warmSlot)
      .slice(warmSendsBefore);
    // Which PATH that one send carries is not fixed: deliverFleetEventBundle already joins events that
    // are ready in the same tick into ONE fleet-event entry, and a bundle of one entry is typed under
    // its own path (Buendel 5a). So the flush's own row decides — one entry: fleet-event, more: bundle.
    const warmFlush = auditRows().filter((r) => r.event === "delivery_bundle_sent" && r.slot === warmSlot).at(-1);
    check("three green events to one idle warm recipient flush as one send after the window",
      warmDone.length === 3 && warmSends.length === 1 && !!warmFlush
        && warmSends[0]?.path === (warmFlush.count === 1 ? "fleet-event" : "bundle")
        && warmSends[0]?.deliveryClass === "buendelbar"
        && warmQueued.dueAt !== undefined && (warmSends[0]?.ts ?? 0) >= warmQueued.dueAt - 100,
      `events=${warmDone.length} sends=${warmSends.length} due=${warmQueued.dueAt} sent=${warmSends[0]?.ts}`);
    for (const e of warmDone) await fetch(`${BASE}/api/self/events/${e.id}/ack`, { method: "POST",
      headers: { "x-fleet-self-token": currentSelfToken(warmSlot) } });

    for (const tier of ["1h", "5m"] as const) {
      const edgeSec = tier === "1h" ? 3300 : 240;
      const usageAt = writeUsage(tier, edgeSec - 4);
      await restartSrv({ FLEET_CLAUDE_PROJECTS_DIR: projectRoot, FLEET_DELIVERY_BUNDLE_SEC: "10" });
      const edgeBefore = auditRows().length;
      const edgeWatch = await subscribeGreen();
      const edgeQueued = await until(() => auditRows().slice(edgeBefore).find((r) =>
        r.event === "delivery_bundle_queued" && r.slot === warmSlot && r.path === "fleet-event") ?? null,
      { timeoutMs: 5_000, what: `${tier} event enters the edge-limited window` });
      const edgeAt = usageAt + edgeSec * 1000;
      check(`${tier} Usage calculates the ${edgeSec}-second cache edge before the ten-second window`,
        edgeQueued.ttlSec === (tier === "1h" ? 3600 : 300)
          && edgeQueued.ttlQuelle === tier && edgeQueued.cache === "warm"
          && typeof edgeQueued.dueAt === "number"
          && edgeQueued.dueAt <= edgeAt && edgeQueued.dueAt >= edgeAt - 1000
          && edgeQueued.dueAt < (edgeQueued.ts ?? 0) + 10_000,
        JSON.stringify({ tier: edgeQueued.ttlQuelle, ttlSec: edgeQueued.ttlSec,
          queuedAt: edgeQueued.ts, dueAt: edgeQueued.dueAt, edgeAt }));
      const edgeEvent = await until(async () => (await eventRows()).find((e) =>
        e.watchId === edgeWatch && e.status === "delivered") ?? null,
      { timeoutMs: 13_000, what: `${tier} cache-edge delivery resolves` });
      const edgeSends = auditRows().slice(edgeBefore).filter((r) => r.event === "send" && r.slot === warmSlot);
      check(`${tier} edge delivers the green event before the full ten-second bundle window`,
        edgeEvent.kind === "deploy-terminal" && edgeSends.length === 1
          && edgeSends[0]?.path === "fleet-event"
          && (edgeSends[0]?.ts ?? Infinity) < (edgeQueued.ts ?? 0) + 10_000
          && (edgeSends[0]?.ts ?? Infinity) <= edgeAt + 1000,
        `sends=${edgeSends.length} queued=${edgeQueued.ts} sent=${edgeSends[0]?.ts} edge=${edgeAt}`);
      await fetch(`${BASE}/api/self/events/${edgeEvent.id}/ack`, { method: "POST",
        headers: { "x-fleet-self-token": currentSelfToken(warmSlot) } });
    }
    await post(`/api/slots/${warmSlot}/kill`, {});
    rmSync(projectRoot, { recursive: true, force: true });
    await restartSrv({ FLEET_DELIVERY_BUNDLE_SEC: "2" });

    await post(`/api/slots/${warmSlot}/open`,
      { cwd: REPO, label: "cold inbox MAIN fixture", harness: "pi" });
    await stopSrv();
    const inboxProgramId = "d".repeat(24);
    const inboxState = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as {
      slots: Record<string, { openedAt: number; sessionId: string | null }>;
      programs?: Record<string, unknown>[] };
    const inboxOccupant = inboxState.slots[String(warmSlot)]!;
    const inboxAt = Date.now() - 5000;
    inboxState.programs = [...(inboxState.programs ?? []), {
      id: inboxProgramId, title: "Cold inbox bundle fixture", intent: "Deliver one unread inbox hint",
      successCriterion: "The cold hint is delivered after its window", nonGoals: [], decisions: [],
      evidence: [], openQuestions: [], status: "active", createdAt: inboxAt - 1000,
      proposedBy: { kind: "owner" }, confirmedAt: inboxAt - 900, activatedAt: inboxAt - 800,
      main: { slot: warmSlot, openedAt: inboxOccupant.openedAt,
        sessionId: inboxOccupant.sessionId, boundAt: inboxAt - 700 },
      inbox: { v: 1, dropped: 0, entries: [{ id: "e".repeat(24), kind: "attention-answer",
        at: inboxAt - 500, ref: "cold-inbox-fixture", readBy: null, readAt: null }] },
    }];
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(inboxState, null, 2));
    const inboxAuditBefore = auditRows().length;
    const inboxPlBefore = (await plogRead()).length;
    await restartSrv({ FLEET_DELIVERY_BUNDLE_SEC: "2", FLEET_HARNESS_AUTOMATION: "1",
      FLEET_INBOX_NUDGE_MS: "100", FLEET_BACKLOG_NUDGE_IDLE_MS: "0" });
    await tmuxOut("send-keys", "-t", `s${warmSlot}`, "Enter");
    const inboxQueued = await until(() => auditRows().slice(inboxAuditBefore).find((r) =>
      r.event === "delivery_bundle_queued" && r.slot === warmSlot
        && r.path === "inbox-nudge" && r.cache === "kalt") ?? null,
    { timeoutMs: 8_000, what: "cold program inbox nudge enters its window" });
    await Bun.sleep(2_700);
    const inboxSends = auditRows().slice(inboxAuditBefore).filter((r) =>
      r.event === "send" && r.slot === warmSlot && r.path === "inbox-nudge");
    const inboxPrompts = (await plogRead()).slice(inboxPlBefore).filter((p) =>
      p.slot === warmSlot && p.text.startsWith(`[fleet inbox] 1 ungelesene Eintraege in der Inbox deines Programs ${inboxProgramId}`));
    check("a cold inbox nudge reaches its MAIN after the bundle window without another wakeup",
      inboxQueued.deliveryClass === "buendelbar" && typeof inboxQueued.dueAt === "number"
        && inboxSends.length === 1 && (inboxSends[0]?.ts ?? 0) >= inboxQueued.dueAt - 100
        && inboxPrompts.length === 1,
      `due=${inboxQueued.dueAt} sends=${inboxSends.length} prompts=${inboxPrompts.length}`);
    await post(`/api/slots/${warmSlot}/kill`, {});
    await stopSrv();
    const inboxClean = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as {
      programs?: { id?: string }[] };
    inboxClean.programs = (inboxClean.programs ?? []).filter((p) => p.id !== inboxProgramId);
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(inboxClean, null, 2));
    await restartSrv({ FLEET_DELIVERY_BUNDLE_SEC: "2" });

    const vacant = (await (await get("/api/sessions")).json() as
      { slots: { id: number; cwd: string | null }[] }).slots.find((s) => !s.cwd)?.id ?? 0;
    if (vacant) await post(`/api/slots/${vacant}/open`, { cwd: REPO, harness: "pi" });
    const fakeDir = mkdtempSync(`${tmpdir()}/fleet-bundle-gate-`);
    const sleeper = Bun.which("sleep");
    if (!sleeper) throw new Error("bundle gate fixture needs sleep");
    symlinkSync(sleeper, `${fakeDir}/pi`);
    try {
      await tmuxOut("respawn-pane", "-k", "-t", `s${vacant}`, `exec '${fakeDir}/pi' 100000`);
      const gateToken = currentSelfToken(vacant);
      const queueWatch = async (suffix: number): Promise<{ id: string; auditAt: number }> => {
        const deployId = ((Date.now() + suffix) >>> 0).toString(16).padStart(8, "0");
        appendFileSync(`${ROOT}/deploys.jsonl`, `${JSON.stringify({ at: Date.now(), id: deployId,
          by: "owner", stage: "boot", ok: true, target: "1".repeat(40), bootHead: "1".repeat(40),
          head: "1".repeat(40), hitTarget: true, bundleStale: false })}\n`);
        const auditAt = auditRows().length;
        const response = await fetch(`${BASE}/api/self/watch`, { method: "POST",
          headers: { "content-type": "application/json", "x-fleet-self-token": gateToken },
          body: JSON.stringify({ kind: "deploy", deployId, idleSec: 0 }) });
        const body = await response.json() as { watch?: { id: string } };
        const event = await until(async () => (await eventRows()).find((row) =>
          row.watchId === body.watch?.id && row.status === "pending"
          && auditRows().slice(auditAt).some((audit) => audit.event === "delivery_bundle_queued"
            && audit.slot === vacant)) ?? null,
        { timeoutMs: 8_000, what: "gate fixture event enters the bundle window" });
        return { id: event.id, auditAt };
      };
      const held = await queueWatch(10);
      await post("/api/autos/switch", { on: false });
      await until(() => auditRows().slice(held.auditAt).find((row) =>
        row.event === "delivery_bundle_refused" && row.detail?.includes("gate=kill-switch")) ?? null,
      { timeoutMs: 8_000, what: "queued bundle reaches the paused gate" });
      const heldPane = (await tmuxOut("capture-pane", "-p", "-J", "-t", `s${vacant}`)).out;
      check("kill-switch after enqueue types nothing and leaves the event pending",
        !heldPane.includes(held.id) && (await eventRows()).find((row) => row.id === held.id)?.status === "pending");
      await post("/api/autos/switch", { on: true });
      const released = await until(() => auditRows().slice(held.auditAt).find((row) =>
        row.event === "delivery_bundle_sent" && row.slot === vacant) ?? null,
      { timeoutMs: 12_000, what: "held bundle is typed after kill-switch release" });
      check("normal bundle paste resumes after release",
        released.detail === `slot:${vacant} count=1`
          && (await tmuxOut("capture-pane", "-p", "-J", "-t", `s${vacant}`)).out.includes(held.id));

      const dead = await queueWatch(20);
      await tmuxOut("respawn-pane", "-k", "-t", `s${vacant}`, "exec sh");
      const dropped = await until(() => auditRows().slice(dead.auditAt).find((row) =>
        row.event === "delivery_bundle_dropped" && row.detail?.includes("gate=no-agent")) ?? null,
      { timeoutMs: 8_000, what: "dead agent is caught by the flush gate" }).catch(() => null);
      const deadPane = (await tmuxOut("capture-pane", "-p", "-J", "-t", `s${vacant}`)).out;
      check("dead agent bundle is dropped before any paste into its shell",
        dropped?.detail?.includes("nothing typed") === true && !deadPane.includes(dead.id),
        `drop=${dropped?.detail ?? "missing"} pasted=${deadPane.includes(dead.id)}`);
    } finally {
      await post("/api/autos/switch", { on: true });
      await post(`/api/slots/${vacant}/kill`, {});
      rmSync(fakeDir, { recursive: true, force: true });
    }
    await restartSrv({ FLEET_DELIVERY_BUNDLE_SEC: "2", FLEET_AUTOS_TICK_MS: "10000" });
    const reportTask = (await (await post("/api/tasks", { text: `${marker} predecessor report lane`, repo: REPO2, queue: false, harness: "pi" })).json() as { task: { id: string } }).task.id;
    let successorTask = "";
    let reportSlot = 0;
    try {
      const firstDispatchAt = auditRows().length;
      const dispatched = await post(`/api/tasks/${reportTask}/dispatch`, {});
      reportSlot = ((await dispatched.json()) as { slot?: number }).slot ?? 0;
      await until(() => auditRows().slice(firstDispatchAt).find((r) =>
        r.event === "send" && r.path === "brief" && r.slot === reportSlot) ?? null,
      { timeoutMs: 12_000, what: "predecessor founding brief is typed" });
      const oldOpenedAt = ((await (await get("/api/sessions")).json()) as
        { slots: { id: number; openedAt: number }[] }).slots.find((s) => s.id === reportSlot)?.openedAt ?? 0;
      const oldToken = reportSlot ? currentSelfToken(reportSlot) : "";
      const filed = await fetch(`${BASE}/api/self/fleet-report`, { method: "POST",
        headers: { "content-type": "application/json", "x-fleet-self-token": oldToken },
        body: JSON.stringify({ status: "complete", text: `${marker} report held for a decision` }) });
      const reportId = filed.ok ? ((await filed.json()) as { report?: { id?: string } }).report?.id ?? "" : "";
      if (composerMode) writeFileSync(composerMode, "normal\n");
      const draft = `${marker}-report-draft`;
      await tmuxOut("send-keys", "-l", "-t", `s${reportSlot}`, draft);
      await until(async () => (await paneText(`s${reportSlot}`)).includes(draft) || null,
        { timeoutMs: 5_000, what: "predecessor composer holds a draft" });
      await Bun.sleep(3_500);
      const reportAuditAt = auditRows().length;
      await post(`/api/fleet-report/${reportId}/accept`, { reason: `${marker} accepted` });
      await until(() => auditRows().slice(reportAuditAt).find((r) =>
        r.event === "delivery_bundle_refused" && r.slot === reportSlot
        && r.detail?.includes("composer occupied")) ?? null,
      { timeoutMs: 12_000, what: "report decision remains bundled after composer refusal" });
      const successorFiled = await post("/api/tasks", { text: `${marker} successor dispatch brief`, repo: REPO2, queue: false });
      successorTask = ((await successorFiled.json()) as { task: { id: string } }).task.id;
      await post(`/api/slots/${reportSlot}/kill`, {});
      await post(`/api/tasks/${reportTask}/delete`, {});
      const dispatchAt = auditRows().length;
      const successorDispatch = await post(`/api/tasks/${successorTask}/dispatch`, {});
      const successorSlot = ((await successorDispatch.json()) as { slot?: number }).slot ?? 0;
      await until(() => auditRows().slice(dispatchAt).find((r) =>
        r.event === "send" && r.path === "brief" && r.slot === successorSlot) ?? null,
      { timeoutMs: 12_000, what: "successor founding brief is typed" });
      const ownerOnly = `${marker} owner text for successor alone`, ownerSend = await post("/send", { slot: successorSlot, text: ownerOnly });
      const dropped = await until(() => auditRows().slice(reportAuditAt).find((r) =>
        r.event === "delivery_bundle_dropped" && r.path === "report-decision"
        && r.detail?.includes(`slot:${reportSlot}`)) ?? null,
      { timeoutMs: 12_000, what: "predecessor report bundle is dropped" });
      const report = await until(async () => ((await (await get("/api/fleet-report")).json()) as
        { reports: { id: string; decisionDelivery?: { state: string; reason: string | null } }[] })
        .reports.find((r) => r.id === reportId && r.decisionDelivery?.state === "worker-gone") ?? null,
      { timeoutMs: 8_000, what: "report delivery records worker-gone" });
      const successorPane = successorSlot ? await paneText(`s${successorSlot}`) : "";
      const successorHistory = successorSlot ? ((await (await get(`/api/slots/${successorSlot}/history`)).json()) as
        { history: { text: string }[] }).history : [];
      const tailAudit = auditRows().slice(dispatchAt);
      const noReroute = !tailAudit.some((r) => r.event === "delivery_bundle_rerouted" && r.detail?.includes(`slot:${reportSlot}`));
      check("recycled slot drops its queued report decision without showing it to the successor",
        !successorPane.includes("YOUR REPORT WAS")
          && !successorHistory.some((h) => h.text.includes("YOUR REPORT WAS"))
          && report.decisionDelivery?.reason?.includes(String(oldOpenedAt)) === true
          && dropped.detail?.includes("ended") === true && noReroute,
        `drop=${dropped.detail} state=${report.decisionDelivery?.state}`);
      check("successor dispatch delivers its brief and owner text alone without requeue or old verdict",
        successorDispatch.ok && successorSlot === reportSlot && ownerSend.ok && successorPane.includes(ownerOnly)
          && tailAudit.some((r) => r.event === "send" && r.path === "brief" && r.slot === successorSlot) && noReroute
          && !tailAudit.some((r) => r.event === "dispatch_requeued" && r.detail?.includes(successorTask))
          && !tailAudit.some((r) => r.event === "fleet_report_decision_delivered" && r.detail?.includes(reportId)),
        `dispatch=${successorDispatch.status} owner=${ownerSend.status}`);
    } finally {
      if (reportSlot) await post(`/api/slots/${reportSlot}/kill`, {});
      for (const id of [reportTask, successorTask]) if (id) await post(`/api/tasks/${id}/delete`, {});
    }
    await restartSrv({ FLEET_DELIVERY_BUNDLE_SEC: "2", FLEET_AUTOS_TICK_MS: String(AUTOS_TICK_MS) });
    const emptyOpen = await post(`/api/slots/${vacant}/open`, { cwd: REPO, harness: "pi" });
    const emptyToken = emptyOpen.ok ? currentSelfToken(vacant) : "", emptyDeployId = (Date.now() >>> 0).toString(16).padStart(8, "0");
    appendFileSync(`${ROOT}/deploys.jsonl`, `${JSON.stringify({ at: Date.now(), id: emptyDeployId,
      by: "owner", stage: "boot", ok: true, target: "1".repeat(40), bootHead: "1".repeat(40),
      head: "1".repeat(40), hitTarget: true, bundleStale: false })}\n`);
    const emptyAuditAt = auditRows().length;
    const emptySub = await fetch(`${BASE}/api/self/watch`, { method: "POST",
      headers: { "content-type": "application/json", "x-fleet-self-token": emptyToken },
      body: JSON.stringify({ kind: "deploy", deployId: emptyDeployId, idleSec: 0 }) });
    await until(() => auditRows().slice(emptyAuditAt).find((r) =>
      r.event === "delivery_bundle_queued" && r.slot === vacant && r.path === "fleet-event") ?? null,
    { timeoutMs: 8_000, what: "empty-slot fixture queues a green watch" });
    await post(`/api/slots/${vacant}/kill`, {});
    const emptyDrop = await until(() => auditRows().slice(emptyAuditAt).find((r) =>
      r.event === "delivery_bundle_dropped" && r.detail?.includes(`slot:${vacant}`)) ?? null,
    { timeoutMs: AUTOS_TICK_MS + 5_000, what: "empty slot bundle is dropped on a watch tick" });
    const emptyDropAt = auditRows().length;
    await Bun.sleep(3 * AUTOS_TICK_MS + 500);
    check("an empty slot drops its bundle once and queues or refuses nothing for three ticks",
      emptySub.ok && emptyDrop.detail?.includes("slot occupant ended") === true
        && !auditRows().slice(emptyDropAt).some((r) =>
          (r.event === "delivery_bundle_queued" || r.event === "delivery_bundle_refused")
            && r.detail?.includes(`slot:${vacant}`)),
      `drop=${emptyDrop.detail}`);
    const opened = vacant ? await post(`/api/slots/${vacant}/open`, { cwd: REPO, harness: "pi" }) : null;
    const token = opened?.ok ? await paneEnv(`s${vacant}`, "FLEET_SELF_TOKEN") : null;
    if (composerMode) writeFileSync(composerMode, "normal\n");
    const draft = `unsubmitted-${marker}`;
    await tmuxOut("send-keys", "-l", "-t", `s${vacant}`, draft);
    await until(async () =>
      (await tmuxOut("capture-pane", "-p", "-t", `s${vacant}`)).out.includes(draft) || null,
    { timeoutMs: 5_000, what: "stand-in composer holds an owner draft" });
    const deployId = (Date.now() >>> 0).toString(16).padStart(8, "0");
    appendFileSync(`${ROOT}/deploys.jsonl`, `${JSON.stringify({ at: Date.now(), id: deployId, by: "owner",
      stage: "boot", ok: true, target: "1".repeat(40), bootHead: "1".repeat(40), head: "1".repeat(40),
      hitTarget: true, bundleStale: false })}\n`);
    const subscribed = await fetch(`${BASE}/api/self/watch`, { method: "POST",
      headers: { "content-type": "application/json", "x-fleet-self-token": token ?? "" },
      body: JSON.stringify({ kind: "deploy", deployId, idleSec: 0 }) });
    const watch = await subscribed.json() as { watch?: { id: string } };
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
    check("a composer refusal leaves the green watch pending for its bound occupant",
      refused.detail?.includes("nothing typed") === true
        && (await (await get("/api/events")).json() as
          { events: { id: string; status: string }[] }).events.find((r) => r.id === event.id)?.status === "pending",
      refused.detail ?? "");
    await post(`/api/slots/${vacant}/kill`, {});
    const afterKill = (await eventRows()).find((row) => row.id === event.id)?.status;
    await post(`/api/slots/${vacant}/open`, { cwd: REPO });
    const gone = await until(async () => {
      const rows = (await (await get("/api/events")).json() as
        { events: { id: string; status: string; receiverOpenedAt: number }[] }).events;
      const row = rows.find((r) => r.id === event.id);
      return row?.status === "receiver-gone" ? row : null;
    }, { timeoutMs: 12_000, what: "queued slot watch ends with its original receiver" });
    check("an unattempted subscribed slot watch ends receiver-gone without rerouting to a replacement",
      afterKill === "receiver-gone" && gone.receiverOpenedAt === event.receiverOpenedAt
        && !auditRows().some((r) => r.event === "delivery_bundle_rerouted"
          && r.slot === vacant && r.detail?.includes(event.id)),
      `${event.receiverOpenedAt} -> ${gone.receiverOpenedAt}`);
    await post(`/api/slots/${vacant}/kill`, {});
    const uncertainReceiver = await post(`/api/slots/${vacant}/open`, { cwd: REPO, harness: "pi" });
    const uncertainToken = uncertainReceiver.ok ? await paneEnv(`s${vacant}`, "FLEET_SELF_TOKEN") ?? "" : "";
    if (composerMode) writeFileSync(composerMode, "hold\n");
    const uncertainDeployId = ((Date.now() + 1) >>> 0).toString(16).padStart(8, "0");
    appendFileSync(`${ROOT}/deploys.jsonl`, `${JSON.stringify({ at: Date.now(), id: uncertainDeployId,
      by: "owner", stage: "boot", ok: true, target: "1".repeat(40), bootHead: "1".repeat(40),
      head: "1".repeat(40), hitTarget: true, bundleStale: false })}\n`);
    const uncertainSub = await fetch(`${BASE}/api/self/watch`, { method: "POST",
      headers: { "content-type": "application/json", "x-fleet-self-token": uncertainToken },
      body: JSON.stringify({ kind: "deploy", deployId: uncertainDeployId, idleSec: 0 }) });
    const uncertainWatch = await uncertainSub.json() as { watch?: { id: string } };
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
    const roleNext = (await (await get("/api/sessions")).json() as
      { slots: { id: number; cwd: string | null }[] }).slots
      .find((s) => !s.cwd && s.id !== vacant)?.id ?? 0;
    if (roleNext) await post(`/api/slots/${roleNext}/open`,
      { cwd: REPO, label: "delivery successor staging", harness: "pi" });
    await stopSrv();
    const roleState = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as {
      slots: Record<string, { label: string | null }> };
    roleState.slots[String(vacant)]!.label = "retired delivery occupant";
    roleState.slots[String(roleNext)]!.label = "Orchestratorin delivery successor";
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(roleState, null, 2));
    await restartSrv({ FLEET_DELIVERY_BUNDLE_SEC: "2" });
    const roleSend = await until(() => auditRows().slice(roleBefore).find((r) =>
      r.event === "send" && r.slot === roleNext && r.path === "fleet-event") ?? null,
    { timeoutMs: 12_000, what: "role bundle is typed in the successor's session" });
    const roleOutcome = await until(async () => {
      const state = (await eventRows()).find((e) => e.id === roleEvent.id)?.status;
      const uncertain = auditRows().slice(roleBefore).some((r) => r.event === "fleet_event_send_uncertain"
        && r.slot === roleNext && r.detail?.includes(roleEvent.id));
      return state === "delivered" || uncertain ? { state, uncertain } : null;
    }, { timeoutMs: 5_000, what: "role bundle records observed delivery or uncertain paste" });
    check("unattempted role bundle is typed to the current occupant across slots with an audit",
      roleSend.deliveryClass === "buendelbar"
        && auditRows().slice(roleBefore).some((r) => r.event === "delivery_bundle_rerouted"
          && r.slot === roleNext && r.detail?.includes(`from slot=${vacant}`)
          && r.eventId === roleEvent.id)
        && (roleSend.acceptance === "observed" ? roleOutcome.state === "delivered"
          : roleOutcome.uncertain && roleOutcome.state !== "delivered"),
      `from=${vacant} to=${roleNext} acceptance=${roleSend.acceptance}`);
    await post(`/api/slots/${vacant}/kill`, {});
    await post(`/api/slots/${roleNext}/kill`, {});

    // WHAT WAITS FOR A SESSION AT WORK (Owner 12.10., docs/neuaufbau/maengel.md #1): it waits in the
    // bundle, where the row shows it as held and the owner's next message takes it along.
    {
      type Held = { count: number; dueAt: number | null; paths: string[] };
      const heldOf = async (slot: number): Promise<Held | undefined> =>
        ((await (await get("/api/sessions")).json()) as { slots: { id: number; heldDeliveries?: Held }[] })
          .slots.find((s) => s.id === slot)?.heldDeliveries;
      const openBusyFixture = async (label: string): Promise<number> => {
        if (composerMode) writeFileSync(composerMode, "normal\n");
        const slot = (await (await get("/api/sessions")).json() as { slots: { id: number; cwd: string | null }[] })
          .slots.find((s) => !s.cwd)?.id ?? 0;
        if (!slot) throw new Error(`${label}: no free slot`);
        await post(`/api/slots/${slot}/open`, { cwd: REPO, label, harness: "pi" });
        await until(async () => ((await (await get("/api/sessions")).json()) as { slots: { id: number; agent: string }[] })
          .slots.find((s) => s.id === slot)?.agent === "alive", { timeoutMs: 8_000, what: `${label}: the stand-in agent is alive` });
        return slot;
      };
      // a BSpace into the stand-in's empty composer repaints it: fresh pane output, nothing typed
      const keepBusy = (slot: number): (() => Promise<void>) => {
        let busy = true;
        const loop = (async () => {
          while (busy) {
            await tmuxOut("send-keys", "-t", `s${slot}`, "BSpace");
            await Bun.sleep(50);
          }
        })();
        return async () => { busy = false; await loop; };
      };

      // 1a · A BUSY REFUSAL WAITS FOR ITS HORIZON: the gate cannot open before the pane has been quiet
      // for the entry's idle threshold, so the next try comes no earlier than lastOutput + idleMs, and
      // "gehalten bis" names that moment instead of the next 5 s probe.
      {
        await restartSrv({ FLEET_DELIVERY_BUNDLE_SEC: "2", FLEET_HARNESS_AUTOMATION: "1" });
        const slot = await openBusyFixture("busy horizon fixture");
        const text = `${marker}: Check-in hinter acht Sekunden Ruhe`;
        const from = auditRows().length;
        const scheduled = await post(`/api/slots/${slot}/autos`, { text, everySec: 60, runs: 1, inSec: 1, idleSec: 8 });
        const autoId = ((await scheduled.json()) as { auto?: { id: string } }).auto?.id;
        await until(() => auditRows().slice(from).some((r) => r.event === "delivery_bundle_queued"
          && r.slot === slot && r.path === "auto") || null,
        { timeoutMs: 20_000, what: "the auto with an 8 s idle gate enters its 2 s bundle" });
        const stop = keepBusy(slot);
        let refused: SendAudit | undefined;
        let held: Held | undefined;
        let again: SendAudit[] = [];
        try {
          refused = await until(() => auditRows().slice(from).find((r) => r.event === "delivery_bundle_refused"
            && r.slot === slot && r.reason === "gate=busy — nothing typed") ?? null,
          { timeoutMs: 8_000, what: "the busy gate refuses the due bundle" });
          held = await heldOf(slot);
          await Bun.sleep(6_500);
          again = auditRows().slice(from).filter((r) => r.event === "delivery_bundle_refused"
            && r.slot === slot && (r.ts ?? 0) > (refused?.ts ?? 0));
        } finally { await stop(); }
        check("a busy refusal retries no earlier than its idle horizon, and the held row names that horizon",
          typeof refused?.ts === "number" && typeof held?.dueAt === "number"
            && held.dueAt - refused.ts >= 7_000 && again.length === 0,
          JSON.stringify({ refusedAt: refused?.ts ?? null, heldDueInMs: held?.dueAt != null && refused?.ts != null
            ? held.dueAt - refused.ts : null, retriesWithin6500ms: again.length }));
        if (autoId) await post(`/api/autos/${autoId}/delete`, {});
        await post(`/api/slots/${slot}/kill`, {});
      }
    }
  } finally {
    if (composerMode) writeFileSync(composerMode, "normal\n");
    await restartSrv({ FLEET_DELIVERY_BUNDLE_SEC: "0" });
    // Slot 2 is a plain shell pane shared with later modules. The bundles above were typed into it
    // as prose, and an apostrophe in them leaves zsh at a `quote>` continuation that swallows every
    // later paneEnv probe (self-token's plain-slot checks). Abort that line and wait for the shell to answer.
    await tmuxOut("send-keys", "-t", "s2", "C-c");
    await paneEnv("s2", "FLEET_SELF_SLOT", 5_000);
  }
}
