// THE ROLE ADDRESS "orchestrator", NAMED WHEN IT BREAKS (Befund Portfolio-Koordination, 2026-10-05).
//
// The address resolves only while exactly ONE non-lane slot carries an Orchestrator label
// (server.ts#deliveryRecipient) — that rule is not under change here and is not loosened by this
// module. What is under test is that the moment a SECOND holder appears, it is said out loud:
//   (1) one holder: no conflict anywhere, the poll shows label and role apart, the message rail
//       answers the holder — today's behaviour, unchanged.
//   (2) a second holder by RENAME and a third by OPEN: the route that made it names the conflict
//       with every holder, the poll carries the same set once, and the holder's own message rail
//       says why it is a 409.
//   (3) renaming all but one resolves it again, with no slot closed or renamed by Fleet.
//
// Every slot is one this module opened itself, on vacant slots, and killed again at the end.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { BASE, ROOT, check, get, post } from "./harness";

const NO_MESSAGE_ADDRESS = "not a principal with an address";

type RoleConflict = { address: string; slots: number[]; note?: string };
type Row = { id: number; cwd: string | null; label: string | null; worktree?: unknown; role?: string };
interface Poll { slots: Row[]; roleConflict?: RoleConflict }
interface SlotAnswer { ok?: boolean; label?: string | null; roleConflict?: RoleConflict; error?: string }

const sessions = async (): Promise<Poll> => (await (await get("/api/sessions")).json()) as Poll;
const answer = async (r: Response): Promise<SlotAnswer> => {
  try { return (await r.json()) as SlotAnswer; } catch { return {}; }
};
const selfTokenOf = (slot: number): string => {
  try {
    const state = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
      { slots?: Record<string, { selfToken?: string }> };
    return state.slots?.[String(slot)]?.selfToken ?? "";
  } catch { return ""; }
};
// the message rail is the reader that lost the address silently before: 200 for the one holder,
// 409 for a holder while the address resolves to nobody
const inbox = async (slot: number): Promise<{ status: number; body: SlotAnswer }> => {
  const r = await fetch(BASE + "/api/self/messages", { headers: { "x-fleet-self-token": selfTokenOf(slot) } });
  return { status: r.status, body: await answer(r) };
};
const sameSet = (got: number[] | undefined, want: number[]): boolean =>
  !!got && got.length === want.length && want.every((id, i) => got[i] === id);

export async function messageDeliveryChecks(): Promise<void> {
  type Occupant = { id: number; cwd: string; openedAt: number; sessionId: string;
    worktree: object | null; lastOutput: number; label: string; history: unknown[] };
  type Address = { kind: "lane" | "session"; slot: number; openedAt: number };
  type MessageRow = { id: string; to: Address; from: { kind: "program"; id: string } | Address; readBy: object | null };
  type Options = { deliveryClass?: string; address?: { kind: string; id: number };
    bypassQueue?: boolean; beforePaste?: (current: Occupant) => void;
    beforeSend?: (current: Occupant) => Promise<void> };
  const source = readFileSync(`${ROOT}/server.ts`, "utf8").replace(/^\s*\/\/.*$/gm, "");
  const section = (from: string, to: string): string => {
    const start = source.indexOf(from), end = source.indexOf(to, start);
    if (start < 0 || end < 0) throw new Error(`message probe source missing: ${from} -> ${to}`);
    return source.slice(start, end);
  };
  const code = [section("const sameAddress =", "const samePayload ="),
    section("function messageAddressesFor(", "const NO_MESSAGE_ADDRESS ="),
    section("function messageInboundFor(", "function programMessageStatus("),
    section("async function canDeliver(", "let autoTickBusy ="),
    section("let messageNudgeBusy =", "const MIGRATE_MAX_NUDGES =")].join("\n");
  const compiled = new Bun.Transpiler({ loader: "ts" }).transformSync(code);
  const now = Date.now();
  const make = (lane = true) => {
    const slot: Occupant = { id: 29, cwd: "/fixture/lane", openedAt: 100, sessionId: "old",
      worktree: lane ? {} : null, lastOutput: now - 400_000, label: "fixture", history: [] };
    const rows: MessageRow[] = [{ id: "old-message", to: { kind: lane ? "lane" : "session", slot: 29, openedAt: 100 },
      from: { kind: "program", id: "main" }, readBy: null }];
    const sent: { openedAt: number; options: Options }[] = [];
    let quiet = false, automatable = true, alive = true, rotateAtProbe = false, rotateAtSend = false;
    let autosOn = true;
    const cancelled: unknown[] = [];
    class Cancelled extends Error {}
    const deps = { slots: [slot], messages: { entries: rows }, STEWARD_LABEL: "steward",
      boundProgramsForMain: () => [], programs: [], deliveryRecipient: () => null,
      isOrchestratorLabel: () => false, slotFrom: () => slot,
      pendingMessageNudges: new Set<number>(), messageNudgeTried: new Map<number, { key: string; lastAt: number }>(),
      backlogSessionKey: (s: Occupant) => `${s.id}:${s.openedAt}:${s.sessionId}`,
      BACKLOG_IDLE_MS: 300_000, REPORT_DECISION_IDLE_MS: 3000, INBOX_NUDGE_COOLDOWN_MS: 600_000,
      // this fixture's sendText types at once, as sendText does with bundling off
      DELIVERY_BUNDLE_SEC: 0,
      get autosOn() { return autosOn; }, harnessAutomatable: () => automatable,
      inQuietHours: () => quiet, slotWakeInflight: new Map<number, unknown>(),
      claudeAlive: async () => { if (rotateAtProbe) slot.openedAt++; return alive; },
      paneReadiness: async () => null, DeliveryCancelled: Cancelled,
      sendText: async (_s: Occupant, _text: string, _submit: boolean, options: Options) => {
        if (rotateAtSend) slot.openedAt++;
        try {
          if (!options.bypassQueue) await options.beforeSend?.(slot);
          options.beforePaste?.(slot);
        } catch (error) { cancelled.push(error); throw error; }
        sent.push({ openedAt: slot.openedAt, options });
        return { acceptance: "observed" };
      }, MAX_HISTORY: 100, saveHistory: () => {}, logPrompt: () => {},
      logError: (_name: string, error: unknown) => { throw error; }, sendFailureDelivery: () => "failed",
      // a0387eec: a held field parks the notice; no fixture here holds one, so nothing is parked
      parkedSends: [], SendComposerOccupied: class extends Error {}, parkFleetSend: () => null };
    const api = new Function("deps", `with (deps) { ${compiled}\nreturn { tickMessageNudge, messageInboundFor, messageAddressesFor }; }`)(deps) as {
      tickMessageNudge: () => Promise<void>;
      messageInboundFor: (s: Occupant, m: MessageRow) => boolean;
      messageAddressesFor: (s: Occupant) => Address[];
    };
    const tick = async () => { await api.tickMessageNudge(); await Bun.sleep(0); };
    return { slot, rows, sent, api, tick, cancelled,
      policy: (p: { quiet?: boolean; automatable?: boolean; alive?: boolean; autosOn?: boolean;
        rotateAtProbe?: boolean; rotateAtSend?: boolean }) => {
        quiet = p.quiet ?? quiet; automatable = p.automatable ?? automatable; alive = p.alive ?? alive;
        autosOn = p.autosOn ?? autosOn; rotateAtProbe = p.rotateAtProbe ?? rotateAtProbe;
        rotateAtSend = p.rotateAtSend ?? rotateAtSend;
      } };
  };
  const idle = make();
  idle.slot.lastOutput = now - 10_000;
  await idle.tick();
  check("lane message: ten-second idle delivers without the backlog's five-minute wait",
    idle.sent.length === 1, `sent=${idle.sent.length}`);
  check("lane message: explicit MAIN traffic bypasses the fifteen-minute bundle at the exact slot address",
    idle.sent[0]?.options.deliveryClass === "sofort"
      && idle.sent[0]?.options.address?.kind === "slot" && idle.sent[0]?.options.address?.id === 29
      && idle.sent[0]?.options.bypassQueue === true && typeof idle.sent[0]?.options.beforePaste === "function",
    JSON.stringify(idle.sent[0]?.options ?? null));
  await idle.tick();
  check("lane message: the same unread set is nudged once", idle.sent.length === 1);
  idle.slot.openedAt = 101; idle.slot.sessionId = "replacement";
  idle.rows.push({ ...idle.rows[0]!, id: "replacement-message", to: { kind: "lane", slot: 29, openedAt: 101 } });
  await idle.tick();
  check("lane message: a replacement's own message is not delayed by the predecessor's cooldown",
    idle.sent.length === 2 && idle.sent[1]?.openedAt === 101, `sent=${idle.sent.length}`);
  const night = make(); night.policy({ quiet: true, automatable: false }); await night.tick();
  check("lane message: an idle Codex lane receives its MAIN's message in quiet hours", night.sent.length === 1);
  const busy = make(); busy.slot.lastOutput = Date.now(); await busy.tick();
  check("lane message: an active pane is still held", busy.sent.length === 0);
  const stopped = make(); stopped.policy({ autosOn: false }); await stopped.tick();
  check("lane message: automation's master stop remains binding", stopped.sent.length === 0);
  const dead = make(); dead.policy({ alive: false }); await dead.tick();
  check("lane message: a dead pane receives nothing", dead.sent.length === 0);
  const generic = make(false); generic.policy({ quiet: true }); await generic.tick();
  check("session message: quiet hours still hold ambient nudges", generic.sent.length === 0);
  const genericHarness = make(false); genericHarness.policy({ automatable: false }); await genericHarness.tick();
  check("session message: harness automation policy still holds ambient nudges", genericHarness.sent.length === 0);
  for (const seam of ["rotateAtProbe", "rotateAtSend"] as const) {
    const changed = make(); changed.policy({ [seam]: true }); await changed.tick();
    check(`lane message: occupant rotation at ${seam} delivers nothing to the replacement`, changed.sent.length === 0);
  }
  const recycled = make(); recycled.slot.openedAt = 101; recycled.slot.sessionId = "new";
  check("lane message: a recycled slot neither inherits the old address nor reads a read or unread predecessor message",
    !recycled.api.messageInboundFor(recycled.slot, recycled.rows[0]!)
      && JSON.stringify(recycled.api.messageAddressesFor(recycled.slot)) === JSON.stringify([{ kind: "lane", slot: 29, openedAt: 101 }])
      && !recycled.api.messageInboundFor(recycled.slot, { ...recycled.rows[0]!, readBy: { openedAt: 100 } }));
  await recycled.tick();
  check("lane message: old unread traffic never wakes a recycled slot", recycled.sent.length === 0);

  // K13 · Owner 14.10.: „[Zitat entfernt]“
  //  Eine Nachricht des Branch-Paars (nur Öffner und Branch-Session
  // schreiben Session an Session) kommt wie die einer MAIN an ihre Lane: nach kurzer Ruhe, an genau diesen
  // Slot, nicht erst mit dem Viertelstunden-Bündel.
  const pair = (p: { quiet?: boolean; automatable?: boolean } = {}) => {
    const fixture = make(false);
    fixture.rows[0] = { ...fixture.rows[0]!, from: { kind: "session", slot: 2, openedAt: 50 } };
    fixture.slot.lastOutput = now - 10_000;
    fixture.policy(p);
    return fixture;
  };
  const pairIdle = pair(); await pairIdle.tick();
  check("branch pair message: ten-second idle delivers it to the exact slot, without the bundle",
    pairIdle.sent.length === 1 && pairIdle.sent[0]?.options.deliveryClass === "sofort"
      && pairIdle.sent[0]?.options.address?.kind === "slot" && pairIdle.sent[0]?.options.address?.id === 29
      && pairIdle.sent[0]?.options.bypassQueue === true,
    JSON.stringify(pairIdle.sent[0]?.options ?? null));
  await pairIdle.tick();
  check("branch pair message: the same unread set is nudged once", pairIdle.sent.length === 1);
  const pairNight = pair({ quiet: true }); await pairNight.tick();
  check("branch pair message: quiet hours do not hold it, as for a lane", pairNight.sent.length === 1);
  const pairBusy = pair(); pairBusy.slot.lastOutput = Date.now(); await pairBusy.tick();
  check("branch pair message: an active pane is still held", pairBusy.sent.length === 0);
  const ambient = make(false); ambient.slot.lastOutput = now - 10_000; await ambient.tick();
  check("session message from a Program or the Orchestrator still waits for the backlog's quiet", ambient.sent.length === 0);
}

export async function run(): Promise<void> {
  await messageDeliveryChecks();
  const before = await sessions();
  const vacant = before.slots.filter((s) => !s.cwd).map((s) => s.id);
  const held = before.slots.filter((s) => s.role === "orchestrator").map((s) => s.id);
  check("role-address SETUP: three vacant slots and no slot holding the Orchestrator role",
    vacant.length >= 3 && held.length === 0 && !before.roleConflict,
    JSON.stringify({ vacant, held, roleConflict: before.roleConflict ?? null }));
  if (vacant.length < 3 || held.length > 0 || before.roleConflict) return;
  const [a = 0, b = 0, c = 0] = vacant.slice(0, 3).sort((x, y) => x - y);
  try {
    // --- (1) ONE holder: everything as today ---
    await post(`/api/slots/${a}/open`, { cwd: "~" });
    await post(`/api/slots/${b}/open`, { cwd: "~" });
    const nameA = await post(`/api/slots/${a}/rename`, { label: "🎛 Orchestratorin · role-address" });
    const nameABody = await answer(nameA);
    check("one holder: the rename answer carries no roleConflict",
      nameABody.ok === true && nameABody.roleConflict === undefined, JSON.stringify(nameABody));
    const one = await sessions();
    const rowA1 = one.slots.find((s) => s.id === a);
    const rowB1 = one.slots.find((s) => s.id === b);
    check("one holder: the poll carries no roleConflict", one.roleConflict === undefined,
      JSON.stringify(one.roleConflict ?? null));
    check("one holder: the poll shows A's label and its role apart (label as typed, role orchestrator)",
      rowA1?.label === "🎛 Orchestratorin · role-address" && rowA1.role === "orchestrator", JSON.stringify(rowA1));
    check("one holder: a plain session has no role key on the poll", !!rowB1 && rowB1.role === undefined,
      JSON.stringify(rowB1));
    const inboxA1 = await inbox(a);
    check("one holder: the role address resolves — A's message rail answers 200",
      inboxA1.status === 200, `${inboxA1.status} ${JSON.stringify(inboxA1.body).slice(0, 200)}`);

    // --- (2a) a SECOND holder by rename ---
    const nameB = await post(`/api/slots/${b}/rename`, { label: "Orchestrator zwei · role-address" });
    const nameBBody = await answer(nameB);
    check("second holder by rename: the rename itself still succeeds (no refusal, no auto-rename)",
      nameB.ok && nameBBody.label === "Orchestrator zwei · role-address", `${nameB.status} ${JSON.stringify(nameBBody)}`);
    check("second holder by rename: the answer names the conflict with BOTH slots",
      nameBBody.roleConflict?.address === "orchestrator" && sameSet(nameBBody.roleConflict.slots, [a, b])
        && (nameBBody.roleConflict.note ?? "").includes(`slots ${a}, ${b}`),
      JSON.stringify(nameBBody.roleConflict ?? null));
    const two = await sessions();
    check("second holder: the poll carries the conflict once, with both slots",
      two.roleConflict?.address === "orchestrator" && sameSet(two.roleConflict.slots, [a, b]),
      JSON.stringify(two.roleConflict ?? null));
    check("second holder: both rows keep their own label and the role the server gives them",
      [a, b].every((id) => two.slots.find((s) => s.id === id)?.role === "orchestrator")
        && two.slots.find((s) => s.id === b)?.label === "Orchestrator zwei · role-address",
      JSON.stringify(two.slots.filter((s) => s.id === a || s.id === b)));
    const inboxA2 = await inbox(a);
    check("second holder: A's message rail is a 409 that names the conflict instead of only the absence",
      inboxA2.status === 409 && (inboxA2.body.error ?? "").startsWith(NO_MESSAGE_ADDRESS)
        && sameSet(inboxA2.body.roleConflict?.slots, [a, b]),
      `${inboxA2.status} ${JSON.stringify(inboxA2.body)}`);

    // --- (2b) a THIRD holder by open: the open answer names it too ---
    const openC = await post(`/api/slots/${c}/open`, { cwd: "~", label: "Orchestrator drei · role-address" });
    const openCBody = await answer(openC);
    check("third holder by open: the open answer names the conflict with all three slots",
      openC.ok && sameSet(openCBody.roleConflict?.slots, [a, b, c]),
      `${openC.status} ${JSON.stringify(openCBody.roleConflict ?? openCBody.error ?? null)}`);
    const killC = await post(`/api/slots/${c}/kill`, {});
    const afterKill = await sessions();
    check("a holder that leaves drops out of the conflict (killed C: A and B remain)",
      killC.ok && sameSet(afterKill.roleConflict?.slots, [a, b]), JSON.stringify(afterKill.roleConflict ?? null));

    // --- (3) renaming all but one resolves the address again ---
    const rename = await post(`/api/slots/${b}/rename`, { label: "zweiter Slot · role-address" });
    const renameBody = await answer(rename);
    check("resolution by rename: the answer carries no roleConflict",
      rename.ok && renameBody.roleConflict === undefined, `${rename.status} ${JSON.stringify(renameBody)}`);
    const resolved = await sessions();
    check("resolution by rename: the poll carries no roleConflict", resolved.roleConflict === undefined,
      JSON.stringify(resolved.roleConflict ?? null));
    check("resolution by rename: A keeps the role, B has none",
      resolved.slots.find((s) => s.id === a)?.role === "orchestrator"
        && resolved.slots.find((s) => s.id === b)?.role === undefined,
      JSON.stringify(resolved.slots.filter((s) => s.id === a || s.id === b)));
    const inboxA3 = await inbox(a);
    check("resolution by rename: A's message rail answers 200 again", inboxA3.status === 200,
      `${inboxA3.status} ${JSON.stringify(inboxA3.body).slice(0, 200)}`);
  } finally {
    for (const id of [a, b, c]) await post(`/api/slots/${id}/kill`, {});
  }
}

// THE POSTFACH IN A REAL BROWSER (K13 S10, src/postfach.ts). Owner 14.10.: „[Zitat entfernt]“
// 
//  Owner-Satz: „[Zitat entfernt]“
// 
//  The real client bundle behind a fixture
// origin: /api/sessions names two sessions, /api/messages carries one long message from the second to the
// first and one short answer; the board shows the first with its Postfach tab open. Every claim reads the
// DOM. Driven by e2e/dom.ts; a lane can call it with an artefact folder and against another tree.
export interface PostfachDomResult { width: number; height: number; claims: Record<string, boolean>; facts: Record<string, unknown> }
export async function runPostfachDom(sourceRoot: string, artifacts?: string): Promise<PostfachDomResult[]> {
  const scratch = resolve(tmpdir(), `fleet-postfach-dom-${process.pid}-${crypto.randomUUID()}`);
  mkdirSync(scratch, { recursive: true });
  const built = await Bun.build({ entrypoints: [resolve(sourceRoot, "src/client.ts")], target: "browser" });
  if (!built.success) { rmSync(scratch, { recursive: true, force: true }); throw new Error(built.logs.join("\n")); }
  const appJs = await built.outputs[0]!.text();
  const indexHtml = readFileSync(resolve(sourceRoot, "public/index.html"), "utf8");
  const now = Date.now();
  const lead = { kind: "session", slot: 1, openedAt: 1000 }, strand = { kind: "session", slot: 2, openedAt: 2000 };
  // a second counterpart, older than the strand's last word: the list in the head (S12) chooses between them
  const pruefer = { kind: "session", slot: 3, openedAt: 3000 };
  const long = ["S6 fertig: das Postfach liest sich als Gespräch, Merge-Check grün.",
    "Nur Client: src/postfach.ts und das Postfach-CSS.", "Nicht geprüft: Kopfzeile in einer echten claude-Pane."];
  // newest first, as the route answers
  const entries = [
    { id: "m-long", from: strand, to: lead, at: now - 60_000, payload: { kind: "text", text: long.join("\n") }, replyTo: "m-ask", readAt: null },
    { id: "m-ask", from: lead, to: strand, at: now - 600_000, payload: { kind: "text", text: "Bitte S6 bauen." }, replyTo: null, readAt: now - 300_000 },
    { id: "m-pruef", from: pruefer, to: lead, at: now - 3_600_000, payload: { kind: "text", text: "dom grün auf dem Kandidaten." }, replyTo: null, readAt: null },
  ];
  const executable = process.env.FLEET_E2E_BROWSER ?? Bun.which("chromium") ?? Bun.which("chromium-browser") ?? Bun.which("google-chrome") ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (!Bun.file(executable).size) { rmSync(scratch, { recursive: true, force: true }); throw new Error("postfach DOM probe needs Chromium (FLEET_E2E_BROWSER): " + executable); }
  const browser = Bun.spawn([executable, "--headless", "--no-sandbox", "--disable-gpu", "--no-first-run", "--disable-background-networking", "--remote-debugging-port=0", `--user-data-dir=${scratch}/profile`, "about:blank"], { stdout: "ignore", stderr: "pipe" });
  let socket: WebSocket | undefined;
  try {
    let startupTimer: ReturnType<typeof setTimeout> | undefined;
    let startupLog = "";
    const endpoint = await Promise.race([
      (async () => { for await (const chunk of browser.stderr) { startupLog += new TextDecoder().decode(chunk); const m = /DevTools listening on (ws:\/\/[^\s]+)/.exec(startupLog); if (m) return m[1]; } throw new Error("browser exited before CDP endpoint: " + startupLog); })(),
      new Promise<never>((_, reject) => { startupTimer = setTimeout(() => reject(new Error("browser CDP startup timeout: " + startupLog)), 45000); }),
    ]).finally(() => clearTimeout(startupTimer));
    socket = new WebSocket(String(endpoint));
    await new Promise<void>((ok, bad) => { socket!.onopen = () => ok(); socket!.onerror = () => bad(new Error("CDP connection failed")); });
    let serial = 0, sessionId: string | undefined;
    let loaded: (() => void) | null = null;
    const pending = new Map<number, { ok: (v: Record<string, unknown>) => void; bad: (e: Error) => void }>();
    const send = (method: string, params: Record<string, unknown> = {}) => new Promise<Record<string, unknown>>((ok, bad) => {
      const id = ++serial;
      const timeout = setTimeout(() => { pending.delete(id); bad(new Error("CDP timeout: " + method)); }, 30000);
      pending.set(id, { ok: (v) => { clearTimeout(timeout); ok(v); }, bad: (e) => { clearTimeout(timeout); bad(e); } });
      socket!.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    const reply = (requestId: string, status: number, body: string, type = "application/json") =>
      send("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: [{ name: "content-type", value: type }],
        body: Buffer.from(body).toString("base64") }).catch(() => undefined);
    const json = (requestId: string, value: unknown, status = 200) => reply(requestId, status, JSON.stringify(value));
    socket.onmessage = (event) => {
      const msg = JSON.parse(String(event.data)) as { id?: number; error?: unknown; result?: Record<string, unknown>; method?: string; params?: Record<string, unknown> };
      if (msg.id !== undefined) {
        const waiting = pending.get(msg.id); if (!waiting) return;
        pending.delete(msg.id);
        if (msg.error) waiting.bad(new Error(JSON.stringify(msg.error))); else waiting.ok(msg.result ?? {});
        return;
      }
      if (msg.method === "Page.loadEventFired") { const fire = loaded; loaded = null; fire?.(); return; }
      if (msg.method === "Page.javascriptDialogOpening") { void send("Page.handleJavaScriptDialog", { accept: false }).catch(() => undefined); return; }
      if (msg.method !== "Fetch.requestPaused" || !msg.params) return;
      const { requestId, request } = msg.params as { requestId: string; request: { url: string; method: string } };
      const p = new URL(request.url).pathname;
      if (request.method === "POST") return void json(requestId, { ok: true });
      if (p === "/" || p === "/blank") return void reply(requestId, 200, p === "/" ? indexHtml : "<!doctype html><title>blank</title>", "text/html");
      if (p === "/app.js") return void reply(requestId, 200, appJs, "text/javascript");
      if (p === "/api/sessions") return void json(requestId, { now: Date.now(), chips: [], tasks: [],
        slots: [{ id: 1, cwd: "/fixture/leitung", label: "Bauleitung", openedAt: 1000, harness: "claude" },
          { id: 2, cwd: "/fixture/strang", label: "Strang", openedAt: 2000, harness: "claude" },
          { id: 3, cwd: "/fixture/pruefer", label: "Prüfer", openedAt: 3000, harness: "claude" },
          ...Array.from({ length: 13 }, (_, i) => ({ id: i + 4, cwd: null }))] });
      if (p === "/api/messages") return void json(requestId, { entries });
      return void json(requestId, { error: "fixture: not served" }, 404);
    };
    const evaluate = async <T>(expression: string): Promise<T> => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error("postfach DOM probe: evaluate failed: " + expression.replace(/\s+/g, " ").slice(0, 120));
      return (r.result as { value: T }).value;
    };
    const settle = (ms = 60) => evaluate(`new Promise(r => setTimeout(r, ${ms}))`);
    const navigate = async (to: string) => {
      const done = new Promise<void>((ok) => { loaded = ok; });
      await send("Page.navigate", { url: to });
      await Promise.race([done, Bun.sleep(15000)]);
    };
    const wait = async (condition: string, ms = 8000) => evaluate<boolean>(`new Promise((ok) => { const until = Date.now() + ${ms};
      const tick = () => { let v = false; try { v = !!(${condition}); } catch {} if (v) return ok(true); if (Date.now() > until) return ok(false); setTimeout(tick, 20); }; tick(); })`);
    const shot = async (name: string) => {
      if (!artifacts) return;
      const png = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(resolve(artifacts, `${name}.png`), Buffer.from(String(png.data), "base64"));
    };
    // the time as the owner's clock writes it, derived here without the client's formatter
    const clock = (ms: number) => evaluate<string>(`(() => { const d = new Date(${ms}); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); })()`);
    const TAB = `document.querySelector('#boardbody .btab[data-tab="postfach"]')`;
    const READ = `(() => { const tab = ${TAB}; if (!tab) return null; const t = tab.getBoundingClientRect();
      return [...tab.querySelectorAll('.bgespr .bmsg')].map((r) => { const b = r.getBoundingClientRect(), line = r.querySelector('.bmsgline');
        return { id: r.dataset.mid, open: r.classList.contains('open'), expanded: line?.getAttribute('aria-expanded') ?? null,
          who: r.querySelector('.bmsgwho')?.textContent ?? null, at: r.querySelector('.bmsgat')?.textContent ?? null,
          first: r.querySelector('.bmsgfirst')?.textContent ?? null, firstShown: !!r.querySelector('.bmsgfirst') && getComputedStyle(r.querySelector('.bmsgfirst')).display !== 'none',
          full: r.querySelector('.bmsgtx')?.textContent ?? null, text: r.innerText, h: Math.round(b.height),
          inside: b.left >= t.left - 0.5 && b.right <= t.right + 0.5 && !!line && line.scrollWidth <= line.clientWidth + 1 }; }); })()`;
    type Row = { id: string; open: boolean; expanded: string | null; who: string | null; at: string | null; first: string | null;
      firstShown: boolean; full: string | null; text: string; h: number; inside: boolean };
    const results: PostfachDomResult[] = [];
    let targetId = "";
    for (const [width, height, phone] of [[1200, 900, false], [390, 844, true]] as const) {
      const claims: Record<string, boolean> = {};
      const facts: Record<string, unknown> = {};
      if (targetId) { const old = targetId; sessionId = undefined; await send("Target.closeTarget", { targetId: old }).catch(() => undefined); }
      targetId = String((await send("Target.createTarget", { url: "about:blank" })).targetId);
      sessionId = String((await send("Target.attachToTarget", { targetId, flatten: true })).sessionId);
      await send("Fetch.enable", { patterns: [{ urlPattern: "http://fleet.fixture/*" }] });
      await send("Page.enable"); await send("Runtime.enable");
      await send("Page.addScriptToEvaluateOnNewDocument", { source: `window.WebSocket = class { constructor() { this.readyState = 0; } send() {} close() {} };` });
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: phone });
      await navigate("http://fleet.fixture/blank");
      // the phone opens Info by a tap on the island, which toggles the remembered state: start closed there
      await evaluate(`(() => { localStorage.clear(); localStorage.setItem('fleet.view', JSON.stringify({ layout: 1, panes: [1], focused: 0 }));
        localStorage.setItem('fleet.board', '${phone ? "0" : "1"}'); localStorage.setItem('fleet.board.folds', JSON.stringify(['postfach'])); })()`);
      await navigate("http://fleet.fixture/");
      if (phone) {
        await wait("document.querySelector('#mpill')", 8000); await settle(400);
        await evaluate("document.querySelector('#mpill')?.click()"); await wait("document.body.classList.contains('mopen')", 2000); await settle(200);
        await evaluate("document.querySelector('#minfo')?.click()");
      }
      const booted = await wait(`${TAB}?.querySelector('.bgespr .bmsg')`, 15000);
      if (!booted) throw new Error(`postfach DOM probe ${width}: no message in the Postfach tab: ` + await evaluate<string>("document.body.innerText.slice(0, 300)"));
      await evaluate(`${TAB}.scrollIntoView({ block: 'start' })`);
      await settle(200);
      const closed = await evaluate<Row[]>(READ);
      const [longAt, askAt] = [await clock(now - 60_000), await clock(now - 600_000)];
      const byId = (rows: Row[], id: string) => rows.find((r) => r.id === id);
      const l0 = byId(closed, "m-long"), a0 = byId(closed, "m-ask");
      facts.closed = closed;
      // one compact line: who, when, the first line with „…“ for more — and none of the rest, two text lines at most
      claims["every message first shows as one compact line — sender, time and the first line of its text, not the rest"] =
        closed.length === 2 && !!l0 && !!a0 && closed.every((r) => !r.open && r.expanded === "false" && r.full === null && r.firstShown && r.h < 60)
        && l0.who === "Strang" && l0.at === longAt && l0.first === `${long[0]} …` && !l0.text.includes(long[1]!) && !l0.text.includes(long[2]!)
        && a0.who === "Bauleitung" && a0.at === askAt && a0.first === "Bitte S6 bauen.";
      claims["the compact lines stay inside the Postfach column, their text cut, not running over"] = closed.every((r) => r.inside)
        && await evaluate<boolean>("document.documentElement.scrollWidth <= innerWidth");
      await shot(`postfach-${width}-zu`);
      // open the long one: its whole text, as written; a second click closes it again
      await evaluate(`${TAB}.querySelector('.bmsg[data-mid="m-long"] .bmsgline').click()`);
      await settle(150);
      const opened = await evaluate<Row[]>(READ);
      const l1 = byId(opened, "m-long"), a1 = byId(opened, "m-ask");
      await shot(`postfach-${width}-auf`);
      // S11 · Owner 14.10. 12:1x: „[Zitat entfernt]“
      // . Every text, fill and edge of a conversation is one
      // of the board's grays (their channels lie within 10 of each other: --chat-mute #8b8b94 is the widest), and a colour
      // stands only on a mark of at most 8 px: the speaker's dot before the name, the unread dot. Read with one message open.
      const tones = await evaluate<{ big: string[]; marks: { who: string; bg: string; w: number; h: number; hued: boolean }[] } | null>(`(() => {
        const tab = ${TAB}; if (!tab) return null;
        const hued = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return false; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number);
          return (p.length < 4 || p[3] > 0) && Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]) > 10; };
        const big = [];
        for (const e of tab.querySelectorAll('.bgespr, .bgespr *')) {
          const cs = getComputedStyle(e), b = e.getBoundingClientRect();
          if (b.width <= 8 && b.height <= 8) continue;
          const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          for (const [k, v] of [['color', own ? cs.color : ''], ['background', cs.backgroundColor], ['border', parseFloat(cs.borderTopWidth) > 0 ? cs.borderTopColor : '']])
            if (v && hued(v)) big.push(e.className + ' ' + k + ' ' + v);
        }
        const marks = [...tab.querySelectorAll('.bgespr .bmsgwho, .bgespr .bgesprwho')].map((e) => { const cs = getComputedStyle(e, '::before');
          return { who: e.textContent, bg: cs.backgroundColor, w: parseFloat(cs.width), h: parseFloat(cs.height), hued: hued(cs.backgroundColor) }; });
        return { big, marks };
      })()`);
      facts.tones = tones;
      claims["the conversation is black and white — grays for every text, fill and edge; a speaker's colour only as a small mark before the name"] =
        !!tones && tones.big.length === 0 && tones.marks.length >= 3 && tones.marks.every((m) => m.hued && m.w <= 8 && m.h <= 8)
        && new Set(tones.marks.filter((m) => m.who === "Strang").map((m) => m.bg)).size === 1
        && new Set(tones.marks.filter((m) => m.who === "Bauleitung").map((m) => m.bg)).size === 1
        && tones.marks.find((m) => m.who === "Strang")?.bg !== tones.marks.find((m) => m.who === "Bauleitung")?.bg;
      await evaluate(`${TAB}.querySelector('.bmsg[data-mid="m-long"] .bmsgline').click()`);
      await settle(150);
      const again = await evaluate<Row[]>(READ);
      const l2 = byId(again, "m-long");
      facts.opened = l1; facts.closedAgain = l2;
      claims["a click on a line opens the whole message as written; the others stay compact; a second click closes it"] =
        !!l1 && l1.open && l1.expanded === "true" && l1.full === long.join("\n") && !l1.firstShown
        && !!a1 && !a1.open && a1.full === null
        && !!l2 && !l2.open && l2.full === null && l2.firstShown;
      // S12 · Owner 14.10. 13:2x: „[Zitat entfernt]“
      //  The list names every counterpart, the newest conversation first and chosen;
      // a choice shows that conversation alone and holds over a repaint of the board (a tab's fold redraws it).
      // S12b · Owner 20:3x: „[Zitat entfernt]“ The list
      // is the column's switch and menu, not a <select> whose open list the system paints: open, hovered and focused
      // it is the board's grays (a colour only on a mark ≤ 8 px), the same under a light and a dark system scheme;
      // Escape hands the focus back to the switch, a press beside it closes it. No list is this claim's red, never a
      // probe that could not go on: the other claims of this width stand.
      const PICK = `(() => { const tab = ${TAB}; const sw = tab?.querySelector('.bgespr .bgesprhd button.bgesprsel');
        const pop = tab?.querySelector('.bgespr .bgesprpop');
        return { convs: tab ? tab.querySelectorAll('.bgespr').length : -1, select: !!tab?.querySelector('.bgespr select'),
          shown: sw?.querySelector('.t')?.textContent ?? null, expanded: sw?.getAttribute('aria-expanded') ?? null, open: !!pop,
          opts: pop ? [...pop.querySelectorAll('[role="option"]')].map((o) => [o.querySelector('.t')?.textContent ?? '', o.querySelector('.kk')?.textContent ?? '', o.getAttribute('aria-selected')]) : null,
          focus: document.activeElement === sw ? 'switch' : document.activeElement?.closest?.('.bgesprpop') ? 'list:' + (document.activeElement.querySelector('.t')?.textContent ?? '') : 'elsewhere',
          ids: tab ? [...tab.querySelectorAll('.bgespr .bmsg')].map((r) => r.dataset.mid) : [], stale: !!tab?.querySelector('.bgespr')?.__before }; })()`;
      type Pick = { convs: number; select: boolean; shown: string | null; expanded: string | null; open: boolean; opts: string[][] | null;
        focus: string; ids: string[]; stale: boolean };
      // every text, fill, edge and outline of the head with its list open: [hued ones beyond a mark, the list's tones]
      const HEADTONES = `(() => { const hd = ${TAB}?.querySelector('.bgespr .bgesprhd'); if (!hd) return null;
        const hued = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return false; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number);
          return (p.length < 4 || p[3] > 0) && Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]) > 10; };
        const big = [], tones = [];
        for (const e of [hd, ...hd.querySelectorAll('*')]) {
          const cs = getComputedStyle(e), b = e.getBoundingClientRect();
          const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          const vals = [['color', own ? cs.color : ''], ['background', cs.backgroundColor], ['border', parseFloat(cs.borderTopWidth) > 0 ? cs.borderTopColor : ''],
            ['outline', cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? cs.outlineColor : '']];
          for (const [k, v] of vals) { if (!v) continue; tones.push(k + '=' + v); if (!(b.width <= 8 && b.height <= 8) && hued(v)) big.push(e.className + ' ' + k + ' ' + v); }
        }
        return { big, tones: tones.join(' ') }; })()`;
      const press = (sel: string) => evaluate(`(() => { ${TAB}?.querySelector(${JSON.stringify(sel)})?.click(); })()`);
      const p0 = await evaluate<Pick>(PICK);
      await press(".bgesprhd button.bgesprsel");
      await settle(150);
      const p1 = await evaluate<Pick>(PICK);
      const dark = await evaluate<{ big: string[]; tones: string } | null>(HEADTONES);
      // the pointer over the second row: its hover is a gray too
      const at = await evaluate<{ x: number; y: number } | null>(`(() => { const r = ${TAB}?.querySelectorAll('.bgesprpop [role="option"]')[1]?.getBoundingClientRect();
        return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; })()`);
      if (at) await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y });
      await settle(100);
      const hover = await evaluate<{ big: string[]; tones: string } | null>(HEADTONES);
      if (at) await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 1 });
      await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
      await settle(100);
      const light = await evaluate<{ big: string[]; tones: string } | null>(HEADTONES);
      await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
      await shot(`postfach-${width}-liste`);
      await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
      await settle(150);
      const p2 = await evaluate<Pick>(PICK);
      await press(".bgesprhd button.bgesprsel");
      await settle(150);
      await evaluate(`document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`);
      await settle(150);
      const p3 = await evaluate<Pick>(PICK);
      await press(".bgesprhd button.bgesprsel");
      await settle(150);
      await press('.bgesprpop [role="option"]:nth-child(2)');
      await settle(150);
      const p4 = await evaluate<Pick>(PICK);
      await evaluate(`(() => { const b = ${TAB}?.querySelector('.bgespr'); if (b) b.__before = true; })()`);
      for (let i = 0; i < 2; i++) { await evaluate(`document.querySelector('#boardbody .btab[data-tab="setup"] .btabbtn')?.click()`); await settle(250); }
      const p5 = await evaluate<Pick>(PICK);
      facts.pick = { p0, p1, p2, p3, p4, p5, dark: dark?.big, hover: hover?.big, light: light?.big };
      claims["with two counterparts a list in the head chooses the conversation — the newest first and chosen — and only that one stands below, also after the board redraws"] =
        p0.convs === 1 && !p0.select && p0.shown === "Strang · 1 ungelesen" && p0.expanded === "false" && !p0.open && JSON.stringify(p0.ids) === JSON.stringify(["m-long", "m-ask"])
        && p1.open && p1.expanded === "true" && JSON.stringify(p1.opts) === JSON.stringify([["Strang", "1 ungelesen", "true"], ["Prüfer", "1 ungelesen", "false"]])
        && p1.focus === "list:Strang"
        && p4.convs === 1 && !p4.open && p4.shown === "Prüfer · 1 ungelesen" && JSON.stringify(p4.ids) === JSON.stringify(["m-pruef"])
        && p5.convs === 1 && !p5.stale && p5.shown === "Prüfer · 1 ungelesen" && JSON.stringify(p5.ids) === JSON.stringify(["m-pruef"]);
      claims["the list is the column's own switch and menu in black and white — open, hovered and focused only grays, the same under a light and a dark system scheme; Escape gives the focus back, a press beside it closes it"] =
        !!dark && !!hover && !!light && dark.big.length === 0 && hover.big.length === 0 && light.big.length === 0 && light.tones === dark.tones
        && !p2.open && p2.focus === "switch" && !p3.open;
      results.push({ width, height, claims, facts });
    }
    return results;
  } finally {
    socket?.close(); browser.kill(); await browser.exited; rmSync(scratch, { recursive: true, force: true });
  }
}
