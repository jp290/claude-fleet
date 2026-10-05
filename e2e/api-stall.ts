import { createHash, randomBytes } from "node:crypto";
import { openSync, readSync, closeSync, readFileSync, mkdtempSync, writeFileSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fleetEventFrom, type FleetEvent } from "../server/types";
import { HARNESS_BLOCK_DETAIL_MAX } from "../lane-signals";

type Check = (name: string, ok: boolean, detail?: string) => void;
interface ErrorLine { at: number; text: string; kind: string; resetAt: number | null }
interface TestSlot {
  id: number; cwd: string | null; sessionId: string; openedAt: number; harness: string;
  lastOutput: number; sleeping: boolean; awaiting: string | null; programId: string | null;
  worktree: { branch: string } | null;
}
interface Fixture {
  tickApiStallResume(): Promise<void>; tickRateLimitResume(): Promise<void>;
  readPaneApiErrors(now: number): Promise<void>;
  paneApiError(h: { id: string }, screen: string, at: number): ErrorLine | null;
  paneLimitFactFor(s: TestSlot): ErrorLine | null;
  apiStallFact(s: TestSlot, err: ErrorLine | null, now: number): ErrorLine | null;
  readClaudeTail(file: string, size: number): { read: number | null; apiError: ErrorLine | null };
  events(): FleetEvent[];
  fleetEventMessage(event: FleetEvent): string;
}

export async function run(check: Check): Promise<void> {
  const source = readFileSync(join(import.meta.dir, "../server.ts"), "utf8");
  const fn = (name: string): string => {
    const match = new RegExp(`^(?:async )?function ${name}\\b`, "m").exec(source);
    if (!match) throw new Error(`api-stall probe missing function ${name}`);
    const end = source.indexOf("\n}", match.index);
    if (end < 0) throw new Error(`api-stall probe missing end ${name}`);
    return source.slice(match.index, end + 2);
  };
  const region = source.slice(source.indexOf("// --- apiStall:"), source.indexOf("// --- harness limits:"));
  const compiled = new Bun.Transpiler({ loader: "ts" }).transformSync([
    fn("apiErrorKind"), fn("claudeLimitResetAt"), fn("readClaudeTail"), region,
    "const RATE_LIMIT_RESUME_AFTER_MS = 60_000; const RATE_LIMIT_RESUME_MAX = 3; let rateLimitTickBusy = false;",
    fn("tickRateLimitResume"), fn("fleetEventMessage"),
  ].join("\n"));
  const claude = { id: "claude" }, codex = { id: "codex" }, pi = { id: "pi-zai" };
  const harnessOf = (id: string) => id === "claude" ? claude : id === "codex" ? codex : id === "pi-zai" ? pi : { id };
  const slot = (harness: string, id = 1): TestSlot => ({ id, cwd: "/fixture", sessionId: `session-${id}`,
    openedAt: 1, harness, lastOutput: 1_000, sleeping: false, awaiting: null,
    programId: "program", worktree: { branch: "fleet/fixture" } });
  const build = (on = true, rateOn = false) => {
    let now = 91_000;
    const slots = [slot("claude")];
    const errors = new Map<number, ErrorLine | null>();
    const screens = new Map<number, string>();
    const sends: { id: number; text: string; path: string; at: number }[] = [];
    const main = slot("claude", 9), orchestrator = slot("claude", 10);
    let receiverPresent = true, budget = 1, captureFails = false, sendFails = false, contextReadable = true;
    let captureEffect: (() => void) | null = null, sendEffect: (() => void) | null = null;
    const deps = {
      Date: class extends Date { static override now() { return now; } }, Buffer,
      openSync, readSync, closeSync, CTX_TAIL_BYTES: 65536, API_STALL_TEXT_MAX: 300,
      slots, CLAUDE_HARNESS: claude, CODEX_HARNESS: codex, PI_ZAI_HARNESS: pi, harnessOf,
      API_STALL_RESUME_ON: on, RATE_LIMIT_RESUME_ON: rateOn, HARNESS_BLOCK_DETAIL_MAX,
      createHash, randomBytes, fleetEvents: [] as FleetEvent[], LAND_READY_WATCH_PREFIX: "land-ready:",
      slotFrom: (id: number) => slots.find((s) => s.id === id),
      contextReading: (s: TestSlot) => ({ ctx: contextReadable ? { usedTokens: 100 } : null, apiError: contextReadable ? errors.get(s.id) ?? null : null }),
      deliveryRecipient: (address: { kind: string }) => receiverPresent ? address.kind === "program" ? main : orchestrator : null,
      slotDeliveryBudget: () => ({ free: budget }), audit: () => {}, saveStateNow: async () => {},
      noteHarnessLimits: () => {}, logError: () => {}, sess: (id: number) => String(id), paneTarget: (id: string) => id,
      tmux: async (...args: string[]) => {
        const id = Number(args.at(-1));
        const out = screens.get(id) ?? "";
        captureEffect?.(); captureEffect = null;
        return { code: captureFails ? 1 : 0, out };
      },
      sendText: async (s: TestSlot, text: string, _enter: boolean, options: { path: string }) => {
        sends.push({ id: s.id, text, path: options.path, at: now });
        sendEffect?.(); sendEffect = null;
        if (sendFails) throw new Error("external paste failed");
      },
    };
    const api = new Function(...Object.keys(deps), `${compiled}\nreturn { tickApiStallResume, tickRateLimitResume,
      readPaneApiErrors, paneApiError, paneLimitFactFor, apiStallFact, readClaudeTail, fleetEventMessage, events: () => fleetEvents };`)(
      ...Object.values(deps)) as Fixture;
    return { api, slots, errors, screens, sends, at: (t: number) => { now = t; },
      captureEffect: (effect: () => void) => { captureEffect = effect; },
      sendEffect: (effect: () => void) => { sendEffect = effect; },
      failCapture: (value: boolean) => { captureFails = value; }, failSend: () => { sendFails = true; },
      contextReadable: (value: boolean) => { contextReadable = value; },
      receiver: (value: boolean) => { receiverPresent = value; }, budget: (value: number) => { budget = value; } };
  };
  const stream = "API Error: The response stopped arriving. The response above may be incomplete.";
  const capacity = "Selected model is at capacity. Please try a different model.";
  const usage = 'Error: Retry failed after 3 attempts: 429: {"code":"1308","message":"Usage limit reached for 5 hour. Your limit will reset at 2026-09-22 18:19:39"}';
  const weekly = '429 {"code":"1310","message":"Weekly/Monthly Limit Exhausted. Your limit will reset at 2026-09-26 16:53:22"}';
  const noReset = '429 {"code":"1308","message":"Usage limit reached for 5 hour"}';
  const home = mkdtempSync(join(tmpdir(), "fleet-api-stall-"));
  try {
    const f = build(), file = join(home, "claude.jsonl");
    const row = (text: string, error?: string, marked = true) => JSON.stringify({ type: "assistant",
      timestamp: "2026-10-01T12:00:00.000Z", isApiErrorMessage: marked, error,
      message: { model: marked ? "<synthetic>" : "claude", usage: { input_tokens: marked ? 0 : 123 },
        content: [{ type: "text", text }] } });
    const tail = (text: string) => { writeFileSync(file, text); return f.api.readClaudeTail(file, statSync(file).size); };
    const streamFact = tail(row(stream)).apiError;
    check("api-stall: measured Claude stream-abort fixture gets stream_interrupted without an error field",
      streamFact?.kind === "stream_interrupted" && streamFact.text === stream && streamFact.at === Date.parse("2026-10-01T12:00:00Z"));
    check("api-stall: explicit Claude authentication failure overrides transient-looking text",
      tail(row(stream, "authentication_failed")).apiError?.kind === "authentication_failed");
    check("api-stall: a normal Claude reply quoting the abort clears the last error round",
      tail(row(stream) + "\n" + row(stream, undefined, false)).apiError === null);
    check("api-stall: Claude error rounds retain preceding real usage",
      tail(row("reply", undefined, false) + "\n" + row(stream, "server_error")).read === 123);
    for (const [h, text, kind, reset] of [[codex, capacity, "capacity", null],
      [pi, usage, "rate_limit", Date.parse("2026-09-22T10:19:39Z")],
      [pi, weekly, "rate_limit", Date.parse("2026-09-26T08:53:22Z")],
      [pi, noReset, "rate_limit", null]] as const) {
      const fact = f.api.paneApiError(h, text, 1_000);
      check(`api-stall: ${h.id} measured ${text === weekly ? "1310" : text === noReset ? "1308 without reset" : kind} fixture is typed`,
        fact?.kind === kind && fact.resetAt === reset && fact.text === text);
      check(`api-stall: ${h.id} quoted ${text === weekly ? "1310" : text === noReset ? "1308 without reset" : kind} is rejected`,
        f.api.paneApiError(h, `> ${text}`, 1_000) === null);
    }
    check("api-stall: unrelated harness and ordinary prose about capacity are not errors",
      f.api.paneApiError(pi, capacity, 1_000) === null && f.api.paneApiError(codex, `We saw ${capacity}`, 1_000) === null);
    const s = f.slots[0]!;
    const err: ErrorLine = { at: 1_000, text: stream, kind: "stream_interrupted", resetAt: null };
    check("api-stall: unobserved and active panes cannot be declared stalled",
      f.api.apiStallFact({ ...s, lastOutput: 0 }, err, 91_000) === null
      && f.api.apiStallFact({ ...s, lastOutput: 90_999 }, err, 91_000) === null);

    // t(ms) | event                         | exclusive owner
    //  90k  | 89s since error: no send       | old occupant
    //  91k  | first send                    | old occupant
    // 180k  | 89s since first: no send      | old occupant
    // 181k  | second send; new error line   | old occupant, same outage
    // 271k  | exhaustion event              | MAIN, never a third send
    for (const harness of ["claude", "codex"]) {
      const b = build(); b.slots[0]!.harness = harness;
      const fresh = async (at: number) => {
        if (harness === "claude") b.errors.set(1, { ...err, at });
        else { b.slots[0]!.lastOutput = at; b.screens.set(1, capacity); await b.api.readPaneApiErrors(at); }
      };
      await fresh(1_000); b.at(90_000); await b.api.tickApiStallResume();
      check(`api-stall: ${harness} waits the complete 90s`, b.sends.length === 0);
      b.at(91_000); await b.api.tickApiStallResume();
      check(`api-stall: ${harness} first attempt is exactly resume on the audited API path`,
        b.sends.length === 1 && b.sends[0]!.text === "resume" && b.sends[0]!.path === "api-stall-resume");
      await fresh(92_000); b.at(180_000); await b.api.tickApiStallResume();
      check(`api-stall: ${harness} refreshed error does not shorten spacing`, b.sends.length === 1);
      b.at(182_000); await b.api.tickApiStallResume();
      await fresh(183_000); b.at(273_000); await b.api.tickApiStallResume();
      const event = b.api.events()[0];
      check(`api-stall: ${harness} at most two attempts per outage despite new error lines`, b.sends.length === 2);
      check(`api-stall: ${harness} exhaustion is one typed persisted MAIN event`,
        b.api.events().length === 1 && event?.kind === "harness-block" && event.receiverSlot === 9
        && event.payload.tool === `api-stall:${harness === "claude" ? "stream_interrupted" : "capacity"}`
        && event.payload.detail.includes("reason=exhausted") && event.payload.detail.includes("tries=2")
        && fleetEventFrom(event) !== null);
      check(`api-stall: ${harness} receiver text names the kind, reason and existing ACK door`,
        !!event && b.api.fleetEventMessage(event).includes(`API STALL: Slot 1`)
        && b.api.fleetEventMessage(event).includes("reason=exhausted")
        && b.api.fleetEventMessage(event).includes(`/api/self/events/${event.id}/ack`));
      if (event) event.status = "acknowledged";
      b.at(400_000); await b.api.tickApiStallResume();
      check(`api-stall: ${harness} acknowledgement never buys a second report or third resume`,
        b.api.events().length === 1 && b.sends.length === 2);
      if (harness === "claude") b.errors.set(1, null);
      else { b.screens.set(1, "reply complete"); await b.api.readPaneApiErrors(400_000); }
      await b.api.tickApiStallResume(); await fresh(401_000); b.at(491_000); await b.api.tickApiStallResume();
      check(`api-stall: ${harness} measured recovery returns the next outage's budget`, b.sends.length === 3);
      const off = build(false); off.slots[0]!.harness = harness;
      if (harness === "claude") off.errors.set(1, err);
      else { off.screens.set(1, capacity); await off.api.readPaneApiErrors(1_000); }
      off.at(400_000); await off.api.tickApiStallResume();
      check(`api-stall: ${harness} OFF still measures but never types`, off.sends.length === 0
        && off.api.apiStallFact(off.slots[0]!, harness === "claude" ? err : null, 400_000) !== null);
    }
    for (const kind of ["rate_limit", "authentication_failed", "invalid_request", "unknown"]) {
      const b = build(); b.errors.set(1, { ...err, kind }); b.at(400_000);
      await b.api.tickApiStallResume(); await b.api.tickApiStallResume();
      const event = b.api.events()[0];
      check(`api-stall: Claude ${kind} never types and reports exactly once`, b.sends.length === 0
        && b.api.events().length === 1 && event?.kind === "harness-block"
        && event.payload.tool === `api-stall:${kind}`);
    }
    for (const text of [usage, weekly, noReset]) {
      const b = build(true, true); b.slots[0]!.harness = "pi-zai"; b.screens.set(1, text);
      await b.api.readPaneApiErrors(1_000); await b.api.tickApiStallResume(); await b.api.tickApiStallResume();
      check(`api-stall: pi-zai ${text === weekly ? "1310" : text === noReset ? "1308 no reset" : "1308"} never uses API resume and reports once`,
        b.sends.length === 0 && b.api.events().length === 1);
      b.at(Date.parse("2026-10-01T12:00:00Z"));
      await b.api.tickRateLimitResume(); await b.api.tickRateLimitResume();
      check(`api-stall: pi-zai ${text === weekly ? "1310" : text === noReset ? "1308 no reset" : "1308"} preserves the separate reset contract`,
        b.sends.length === (text === noReset ? 0 : 1) && b.sends.every((x) => x.path === "rate-limit-resume"));
      const off = build(false, false); off.slots[0]!.harness = "pi-zai"; off.screens.set(1, text);
      await off.api.tickRateLimitResume(); await off.api.tickApiStallResume();
      check(`api-stall: pi-zai ${text === weekly ? "1310" : text === noReset ? "1308 no reset" : "1308"} both flags OFF never types`, off.sends.length === 0);
    }
    const pin = build(); pin.slots[0]!.harness = "codex"; pin.screens.set(1, capacity);
    pin.captureEffect(() => { pin.slots[0]!.sessionId = "replacement"; });
    await pin.api.readPaneApiErrors(1_000); await pin.api.tickApiStallResume();
    check("api-stall: pane capture re-proves the occupant after its external await", pin.api.paneLimitFactFor(pin.slots[0]!) === null && pin.sends.length === 0);
    await pin.api.readPaneApiErrors(1_000); await pin.api.tickApiStallResume();
    pin.failCapture(true); await pin.api.readPaneApiErrors(1_000); await pin.api.tickApiStallResume();
    pin.failCapture(false); await pin.api.readPaneApiErrors(1_000); pin.at(181_000); await pin.api.tickApiStallResume();
    pin.at(271_000); await pin.api.tickApiStallResume();
    check("api-stall: unreadable pane intervals never replenish the outage budget", pin.sends.length === 2);
    pin.slots[0]!.openedAt = 2; pin.slots[0]!.sessionId = "new-session";
    pin.at(400_000); await pin.api.tickApiStallResume();
    check("api-stall: recycled occupant inherits no pane error", pin.sends.length === 2);
    const unreadable = build(); unreadable.errors.set(1, err);
    await unreadable.api.tickApiStallResume(); unreadable.contextReadable(false); await unreadable.api.tickApiStallResume();
    unreadable.contextReadable(true); unreadable.at(181_000); await unreadable.api.tickApiStallResume();
    unreadable.at(271_000); await unreadable.api.tickApiStallResume();
    check("api-stall: unreadable Claude tail never replenishes the outage budget", unreadable.sends.length === 2);
    const failed = build(); failed.errors.set(1, err); failed.failSend();
    await failed.api.tickApiStallResume(); failed.at(181_000); await failed.api.tickApiStallResume();
    failed.at(271_000); await failed.api.tickApiStallResume();
    check("api-stall: failed external pastes spend both attempts and report exhaustion", failed.sends.length === 2 && failed.api.events().length === 1);
    for (const guard of ["sleeping", "awaiting"] as const) {
      const b = build(); b.errors.set(1, err);
      if (guard === "sleeping") b.slots[0]!.sleeping = true; else b.slots[0]!.awaiting = "owner";
      await b.api.tickApiStallResume();
      check(`api-stall: ${guard} remains parked`, b.sends.length === 0 && b.api.events().length === 0);
    }
    const routing = build(false); routing.errors.set(1, { ...err, kind: "rate_limit" });
    routing.slots[0]!.worktree = null; routing.slots[0]!.programId = null;
    routing.receiver(false); await routing.api.tickApiStallResume();
    routing.receiver(true); routing.budget(0); await routing.api.tickApiStallResume();
    check("api-stall: absent receiver or exhausted event budget does not discard the notification", routing.api.events().length === 0);
    routing.budget(1); await routing.api.tickApiStallResume(); await routing.api.tickApiStallResume();
    check("api-stall: slot without Lane-Program reports once to the Orchestrator with valid persisted shape",
      routing.api.events().length === 1 && routing.api.events()[0]?.receiverSlot === 10 && fleetEventFrom(routing.api.events()[0]) !== null);
    const concurrent = build(); concurrent.slots.push(slot("claude", 2));
    concurrent.errors.set(1, err); concurrent.errors.set(2, err);
    concurrent.sendEffect(() => { concurrent.slots[1] = { ...slot("claude", 2), sessionId: "new", openedAt: 2 }; concurrent.errors.delete(2); });
    await concurrent.api.tickApiStallResume();
    check("api-stall: an external send await cannot resume the replaced next occupant", concurrent.sends.length === 1 && concurrent.sends[0]!.id === 1);
  } finally { rmSync(home, { recursive: true, force: true }); }
}
