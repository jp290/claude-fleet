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
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { BASE, ROOT, check, get, post, restartSrv, stopSrv } from "./harness";

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
    worktree: object | null; lastOutput: number; label: string; history: unknown[];
    laneSeats: { openedAt: number }[]; lineageId?: string; zustellung?: "direkt" | "gebuendelt" };
  type Address = { kind: "lane" | "session"; slot: number; openedAt: number };
  type RoleAddress = { kind: "role"; role: "orchestrator" };
  type ProgramAddress = { kind: "program"; id: string };
  type MessageRow = { id: string; to: Address | RoleAddress | ProgramAddress; from: ProgramAddress | Address | RoleAddress; readBy: object | null;
    at: number; payload: { kind: "text"; text: string } };
  type Options = { path?: string; deliveryClass?: string; address?: { kind: string; id: number };
    bypassQueue?: boolean; beforePaste?: (current: Occupant) => void; requireAgent?: boolean;
    beforeSend?: (current: Occupant) => Promise<void> };
  const source = readFileSync(`${ROOT}/server.ts`, "utf8").replace(/^\s*\/\/.*$/gm, "");
  const section = (from: string, to: string): string => {
    const start = source.indexOf(from), end = source.indexOf(to, start);
    if (start < 0 || end < 0) throw new Error(`message probe source missing: ${from} -> ${to}`);
    return source.slice(start, end);
  };
  const code = [readFileSync(`${ROOT}/server/postfach-zustellen.ts`, "utf8").replace(/^export /gm, ""),
    // the setting's pure decision is compiled in, like the postfach leaf: the tick calls it
    readFileSync(`${ROOT}/server/zustellung.ts`, "utf8").replace(/^export /gm, "").replace(/^import .*$/gm, ""),
    section("const sameAddress =", "const samePayload ="),
    section("function messageAddressesFor(", "const NO_MESSAGE_ADDRESS ="),
    section("function messageInboundFor(", "function programMessageStatus("),
    section("async function canDeliver(", "let autoTickBusy ="),
    section("let messageNudgeBusy =", "const MIGRATE_MAX_NUDGES =")].join("\n");
  const compiled = new Bun.Transpiler({ loader: "ts" }).transformSync(code);
  const now = Date.now();
  // orchestrator: the slot is the one holder of the role address, and the message goes to that role;
  // bound: the slot is the bound MAIN of that Program, and the message goes to the Program
  const make = (lane = true, orchestrator = false, bound?: string) => {
    const slot: Occupant = { id: 29, cwd: "/fixture/lane", openedAt: 100, sessionId: "old",
      worktree: lane ? {} : null, lastOutput: now - 400_000, label: orchestrator ? "🎛 Orchestratorin" : "fixture",
      history: [], laneSeats: [], zustellung: "direkt" };
    const lineage: { lineageId: string; from: { slot: number; openedAt: number } }[] = [];
    const rows: MessageRow[] = [{ id: "old-message", at: now - 400_000,
      payload: { kind: "text", text: "fixture message" },
      to: orchestrator ? { kind: "role", role: "orchestrator" } : bound ? { kind: "program", id: bound }
        : { kind: lane ? "lane" : "session", slot: 29, openedAt: 100 },
      from: { kind: "program", id: "main" }, readBy: null }];
    const sent: { openedAt: number; options: Options; text: string }[] = [];
    let quiet = false, automatable = true, alive = true, rotateAtProbe = false, rotateAtSend = false;
    let autosOn = true;
    const cancelled: unknown[] = [];
    class Cancelled extends Error {}
    const deps = { slots: [slot], messages: { entries: rows }, STEWARD_LABEL: "steward", lineageHandovers: lineage,
      boundProgramsForMain: () => bound ? [{ id: bound }] : [], programs: [], deliveryRecipient: () => orchestrator ? slot : null,
      isOrchestratorLabel: () => orchestrator, slotFrom: () => slot,
      pendingMessageNudges: new Set<number>(), messageNudgeTried: new Map<number, { key: string; lastAt: number }>(),
      backlogSessionKey: (s: Occupant) => `${s.id}:${s.openedAt}:${s.sessionId}`,
      BACKLOG_IDLE_MS: 300_000, REPORT_DECISION_IDLE_MS: 3000, INBOX_NUDGE_COOLDOWN_MS: 600_000,
      // the fixture types at once: no window, one paste bounded like production
      POSTFACH_WINDOW_MS: 0, POSTFACH_MAX_CHARS: 8_000,
      stampMessageRead: (entry: MessageRow, current: Occupant) => {
        if (entry.readBy !== null) return false;
        entry.readBy = { slot: current.id, openedAt: current.openedAt, sessionId: current.sessionId };
        return true;
      }, saveStateNow: async () => {},
      // this fixture's sendText types at once, as sendText does with bundling off
      DELIVERY_BUNDLE_SEC: 0,
      get autosOn() { return autosOn; }, harnessAutomatable: () => automatable,
      inQuietHours: () => quiet, slotWakeInflight: new Map<number, unknown>(),
      claudeAlive: async () => { if (rotateAtProbe) slot.openedAt++; return alive; },
      paneReadiness: async () => null, DeliveryCancelled: Cancelled,
      sendText: async (_s: Occupant, text: string, _submit: boolean, options: Options) => {
        if (rotateAtSend) slot.openedAt++;
        try {
          if (!options.bypassQueue) await options.beforeSend?.(slot);
          options.beforePaste?.(slot);
        } catch (error) { cancelled.push(error); throw error; }
        sent.push({ openedAt: slot.openedAt, options, text });
        return { acceptance: "observed" };
      }, MAX_HISTORY: 100, saveHistory: () => {}, logPrompt: () => {},
      logError: (_name: string, error: unknown) => { throw error; }, sendFailureDelivery: () => "failed",
      // a0387eec: a held field parks the notice; no fixture here holds one, so nothing is parked
      parkedSends: [], SendComposerOccupied: class extends Error {}, parkFleetSend: () => null };
    const api = new Function("deps", `with (deps) { ${compiled}\nreturn { tickPostfachZustellung, tickMessageNudge, messageInboundFor, messageAddressesFor }; }`)(deps) as {
      tickPostfachZustellung: () => Promise<void>;
      tickMessageNudge: () => Promise<void>;
      messageInboundFor: (s: Occupant, m: MessageRow) => boolean;
      messageAddressesFor: (s: Occupant) => (Address | RoleAddress)[];
    };
    const tick = async () => { await api.tickPostfachZustellung(); await api.tickMessageNudge(); await Bun.sleep(0); };
    return { slot, rows, sent, api, tick, cancelled, lineage,
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
  check("lane message: explicit MAIN traffic bypasses the fifteen-minute bundle at the exact slot address, with the sender, the id and the whole text",
    idle.sent[0]?.options.deliveryClass === "sofort"
      && idle.sent[0]?.options.address?.kind === "slot" && idle.sent[0]?.options.address?.id === 29
      && idle.sent[0]?.options.bypassQueue === true && typeof idle.sent[0]?.options.beforePaste === "function"
      && idle.sent[0]?.options.path === "postfach"
      && idle.sent[0]?.text.includes("old-message") && idle.sent[0]?.text.includes("Program main")
      && idle.sent[0]?.text.includes("fixture message"),
    JSON.stringify({ options: idle.sent[0]?.options ?? null, text: idle.sent[0]?.text ?? null }));
  await idle.tick();
  check("lane message: the same unread set is delivered once and receipted as read", idle.sent.length === 1
    && idle.rows[0]?.readBy !== null);
  // the new default: no setting on a lane means the message waits in the existing bundle, full text
  const bundled = make(); bundled.slot.zustellung = undefined; bundled.slot.lastOutput = now - 10_000;
  await bundled.tick();
  check("lane default: without a setting a lane hands the message to the bundle, with the whole text",
    bundled.sent.length === 1 && bundled.sent[0]?.options.deliveryClass === "buendelbar"
      && bundled.sent[0]?.options.bypassQueue !== true && bundled.sent[0]?.options.path === "postfach"
      && bundled.sent[0]?.text.includes("fixture message")
      && bundled.rows[0]?.readBy !== null,
    JSON.stringify({ options: bundled.sent[0]?.options ?? null, text: bundled.sent[0]?.text ?? null }));
  idle.slot.openedAt = 101; idle.slot.sessionId = "replacement";
  idle.rows.push({ ...idle.rows[0]!, id: "replacement-message", readBy: null,
    to: { kind: "lane", slot: 29, openedAt: 101 } });
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
  check("session message: a session address is direct traffic now, so quiet hours no longer hold it",
    generic.sent.length === 1 && generic.sent[0]?.options.path === "postfach");
  const genericHarness = make(false); genericHarness.policy({ automatable: false }); await genericHarness.tick();
  check("session message: harness automation policy no longer holds a direct session message either",
    genericHarness.sent.length === 1 && genericHarness.sent[0]?.options.path === "postfach");
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

  // MANGEL 79 (15.10.): „[Zitat entfernt]“
  // The successor's own line is its predecessor's address: a lane's baton seat, a session's line record.
  // The notice is the same tick as above, so it is typed into the successor, never held for the predecessor.
  const baton = make(); baton.slot.openedAt = 101; baton.slot.sessionId = "successor";
  baton.slot.laneSeats = [{ openedAt: 100 }]; baton.slot.lastOutput = now - 10_000;
  await baton.tick();
  check("lane message: the baton successor holds its own address first, then its predecessor's, and reads the unread message",
    JSON.stringify(baton.api.messageAddressesFor(baton.slot))
      === JSON.stringify([{ kind: "lane", slot: 29, openedAt: 101 }, { kind: "lane", slot: 29, openedAt: 100 }])
      && baton.api.messageInboundFor(baton.slot, baton.rows[0]!),
    JSON.stringify(baton.api.messageAddressesFor(baton.slot)));
  check("lane message: the baton successor is nudged for its predecessor's unread message",
    baton.sent.length === 1 && baton.sent[0]?.openedAt === 101, `sent=${JSON.stringify(baton.sent.map((x) => x.openedAt))}`);
  const heir = make(false); heir.slot.openedAt = 101; heir.slot.sessionId = "successor";
  heir.slot.lineageId = "a".repeat(24);
  heir.lineage.push({ lineageId: "a".repeat(24), from: { slot: 29, openedAt: 100 } },
    { lineageId: "b".repeat(24), from: { slot: 29, openedAt: 90 } }, { lineageId: "a".repeat(24), from: { slot: 30, openedAt: 80 } });
  await heir.tick();
  check("session message: a successor on the same line holds its own address first, then only its own line's predecessor on this slot",
    JSON.stringify(heir.api.messageAddressesFor(heir.slot))
      === JSON.stringify([{ kind: "session", slot: 29, openedAt: 101 }, { kind: "session", slot: 29, openedAt: 100 }])
      && heir.api.messageInboundFor(heir.slot, heir.rows[0]!),
    JSON.stringify(heir.api.messageAddressesFor(heir.slot)));
  check("session message: the successor is nudged for its predecessor's unread message",
    heir.sent.length === 1 && heir.sent[0]?.openedAt === 101, `sent=${JSON.stringify(heir.sent.map((x) => x.openedAt))}`);

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
  check("session message from a Program is direct and carries its full text now", ambient.sent.length === 1
    && ambient.sent[0]?.options.path === "postfach", `sent=${ambient.sent.length}`);

  // MANGEL 141 (Vorführung 19.10.): messages to the role "orchestrator" lay unread for 16 minutes and longer.
  // In the bundle every further message cancelled the waiting notice at its deadline and the next tick
  // queued a fresh fifteen minutes (audit: "orchestrator messages for slot 6 changed before paste"). A
  // message to the role is direct traffic like a MAIN's lane message: short idle, the exact slot, no bundle.
  const orchestratorFixture = (p: { quiet?: boolean; automatable?: boolean } = {}) => {
    const fixture = make(false, true);
    fixture.slot.lastOutput = now - 10_000;
    fixture.policy(p);
    return fixture;
  };
  const orch = orchestratorFixture();
  check("role message: the Orchestratorin holds the role address and reads a message to it",
    JSON.stringify(orch.api.messageAddressesFor(orch.slot)) === JSON.stringify([{ kind: "role", role: "orchestrator" }])
      && orch.api.messageInboundFor(orch.slot, orch.rows[0]!),
    JSON.stringify(orch.api.messageAddressesFor(orch.slot)));
  await orch.tick();
  check("role message: ten-second idle delivers the Orchestratorin's message with its full text to her exact slot, without the bundle",
    orch.sent.length === 1 && orch.sent[0]?.options.deliveryClass === "sofort"
      && orch.sent[0]?.options.address?.kind === "slot" && orch.sent[0]?.options.address?.id === 29
      && orch.sent[0]?.options.bypassQueue === true && orch.sent[0]?.options.path === "postfach"
      && orch.sent[0]?.text.includes("old-message") && orch.sent[0]?.text.includes("fixture message"),
    `sent=${orch.sent.length} options=${JSON.stringify(orch.sent[0]?.options ?? null)}`);
  await orch.tick();
  check("role message: the same unread set is delivered once and receipted as read", orch.sent.length === 1
    && orch.rows[0]?.readBy !== null, `sent=${orch.sent.length}`);
  orch.rows.push({ ...orch.rows[0]!, id: "further-message", readBy: null });
  await orch.tick();
  check("role message: a further message is announced at once instead of restarting a wait",
    orch.sent.length === 2, `sent=${orch.sent.length}`);
  const orchNight = orchestratorFixture({ quiet: true, automatable: false }); await orchNight.tick();
  check("role message: quiet hours and harness policy do not hold it, as for a lane", orchNight.sent.length === 1,
    `sent=${orchNight.sent.length}`);
  const orchBusy = orchestratorFixture(); orchBusy.slot.lastOutput = Date.now(); await orchBusy.tick();
  check("role message: an active Orchestratorin pane is still held", orchBusy.sent.length === 0);

  // bau/ohne-owner-token Schnitt 4 · der Rückweg: Post der Orchestratorin an ein Program erreicht dessen MAIN so
  // schnell wie ihr /send unter dem Owner-Token, aber als Inbox-Hinweis statt als „[Zitat entfernt]“
  // (server/recall.ts#ownerPrompt nimmt ihn deshalb nicht als Owner-Eingabe zurück).
  const toMain = (from: MessageRow["from"], p: { quiet?: boolean; automatable?: boolean } = {}) => {
    const fixture = make(false, false, "p1");
    fixture.rows[0] = { ...fixture.rows[0]!, from };
    fixture.slot.lastOutput = now - 10_000;
    fixture.policy(p);
    return fixture;
  };
  const fromOrch = toMain({ kind: "role", role: "orchestrator" });
  check("program message: the bound MAIN holds its Program's address and reads the Orchestratorin's message",
    JSON.stringify(fromOrch.api.messageAddressesFor(fromOrch.slot)) === JSON.stringify([{ kind: "program", id: "p1" }])
      && fromOrch.api.messageInboundFor(fromOrch.slot, fromOrch.rows[0]!),
    JSON.stringify(fromOrch.api.messageAddressesFor(fromOrch.slot)));
  await fromOrch.tick();
  check("program message: ten-second idle delivers the Orchestratorin's message to the MAIN's exact slot, without the bundle",
    fromOrch.sent.length === 1 && fromOrch.sent[0]?.options.deliveryClass === "sofort"
      && fromOrch.sent[0]?.options.address?.kind === "slot" && fromOrch.sent[0]?.options.address?.id === 29
      && fromOrch.sent[0]?.options.bypassQueue === true && fromOrch.sent[0]?.options.path === "inbox-nudge",
    `sent=${fromOrch.sent.length} options=${JSON.stringify(fromOrch.sent[0]?.options ?? null)}`);
  await fromOrch.tick();
  check("program message: the same unread set is nudged once", fromOrch.sent.length === 1, `sent=${fromOrch.sent.length}`);
  const fromOrchNight = toMain({ kind: "role", role: "orchestrator" }, { quiet: true, automatable: false });
  await fromOrchNight.tick();
  check("program message: quiet hours and harness policy do not hold the Orchestratorin's message",
    fromOrchNight.sent.length === 1, `sent=${fromOrchNight.sent.length}`);
  const fromOrchBusy = toMain({ kind: "role", role: "orchestrator" }); fromOrchBusy.slot.lastOutput = Date.now();
  await fromOrchBusy.tick();
  check("program message: an active MAIN pane is still held", fromOrchBusy.sent.length === 0);
  const fromProgram = toMain({ kind: "program", id: "p2" }); await fromProgram.tick();
  check("program message from another Program still waits for the backlog's quiet", fromProgram.sent.length === 0,
    `sent=${fromProgram.sent.length}`);
}

// MANGEL 79 THROUGH THE DOORS. Owner-Satz der Bauleitung (15.10.): „[Zitat entfernt]“
//  That day two Owner verdicts to the session K15 never arrived: its
// successor (same slot, same line, new openedAt) could neither see nor receipt what was addressed to the
// predecessor. A real succession needs a founding turn, so the state is planted in fleet.json: a line record
// handing slot H from openedAt A to its live occupant, which holds that line, and unread messages to
// {session, H, A}. The two counter-probes are the two ways a slot is NOT a successor: another line on a slot
// with history, and a recycle (openSlot clears the line).
type SelfBody = { addresses?: unknown[]; entries?: { id: string }[]; ok?: boolean; existing?: boolean;
  message?: { readBy?: { slot?: number; openedAt?: number } | null }; error?: string };
type PlantState = { slots: Record<string, { openedAt: number; lineageId?: string | null }>;
  lineageHandovers?: { lineageId: string }[]; messages?: { v: 1; entries: { id: string }[]; dropped: number } };
async function lineageMessageChecks(): Promise<void> {
  const vacant = (await sessions()).slots.filter((s) => !s.cwd).map((s) => s.id);
  check("lineage message SETUP: two vacant slots", vacant.length >= 2, JSON.stringify(vacant));
  if (vacant.length < 2) return;
  const [heir = 0, other = 0] = vacant;
  const self = async (slot: number, path: string, method = "GET"): Promise<{ status: number; body: SelfBody }> => {
    const r = await fetch(BASE + path, { method, headers: { "x-fleet-self-token": selfTokenOf(slot) } });
    return { status: r.status, body: (await r.json().catch(() => ({}))) as SelfBody };
  };
  const ids = (b: SelfBody): string[] => (b.entries ?? []).map((m) => m.id);
  const hex = (): string => randomBytes(12).toString("hex");
  const line = hex(), oldLine = hex(), otherLine = hex();
  const msg = { heirOne: hex(), heirTwo: hex(), foreign: hex(), own: hex() };
  const plantedIds = new Set(Object.values(msg));
  const readState = (): PlantState => JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as PlantState;
  try {
    await post(`/api/slots/${heir}/open`, { cwd: "~", label: "Nachfolgerin · role-address" });
    await post(`/api/slots/${other}/open`, { cwd: "~", label: "andere Linie · role-address" });
    await stopSrv();
    const state = readState();
    // past the record's cap the loader refuses the whole rail and scars it for good (server/types.ts#loadMessages)
    const room = 200 - (state.messages?.entries.length ?? 0) >= plantedIds.size;
    check("lineage message SETUP: the message record has room for the four planted rows", room,
      `entries=${state.messages?.entries.length ?? 0}`);
    if (!room) return;
    const H = state.slots[String(heir)]!, O = state.slots[String(other)]!;
    const record = (lineageId: string, slot: number, from: number, to: number) => ({ v: 1, lineageId, role: "generic",
      at: to - 1, from: { slot, openedAt: from }, to: { slot, openedAt: to }, obligations: [], intent: null,
      pointer: null, supersededBy: null });
    const message = (id: string, slot: number, openedAt: number) => ({ id, from: { kind: "role", role: "orchestrator" },
      to: { kind: "session", slot, openedAt }, at: Date.now() - 5000, payload: { kind: "text", text: `Mangel 79 fixture ${id}` },
      idempotencyKey: `mangel-79-${id}`, replyTo: null, readBy: null, readAt: null });
    H.lineageId = line;
    O.lineageId = otherLine;
    state.lineageHandovers = [...(state.lineageHandovers ?? []),
      record(line, heir, H.openedAt - 1000, H.openedAt),
      // the other slot held an older line, was recycled, and its occupant has since founded a line of its own
      record(oldLine, other, O.openedAt - 3000, O.openedAt - 2000),
      record(otherLine, other, O.openedAt - 1000, O.openedAt)];
    state.messages = { v: 1, dropped: state.messages?.dropped ?? 0, entries: [...(state.messages?.entries ?? []),
      message(msg.heirOne, heir, H.openedAt - 1000), message(msg.heirTwo, heir, H.openedAt - 1000),
      message(msg.foreign, other, O.openedAt - 3000), message(msg.own, other, O.openedAt - 1000)] };
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(state, null, 2));
    await restartSrv();

    const unread = await self(heir, "/api/self/messages?unread=1");
    check("successor: GET /api/self/messages?unread=1 shows both messages addressed to its predecessor, its own address first",
      unread.status === 200 && [msg.heirOne, msg.heirTwo].every((id) => ids(unread.body).includes(id))
        && JSON.stringify(unread.body.addresses?.[0]) === JSON.stringify({ kind: "session", slot: heir, openedAt: H.openedAt }),
      `${unread.status} ${JSON.stringify(unread.body).slice(0, 400)}`);
    const read = await self(heir, `/api/self/messages/${msg.heirOne}/read`, "POST");
    check("successor: POST /api/self/messages/<id>/read receipts the predecessor's message under the successor's own occupation",
      read.status === 200 && read.body.ok === true && read.body.existing === false
        && read.body.message?.readBy?.slot === heir && read.body.message.readBy.openedAt === H.openedAt,
      `${read.status} ${JSON.stringify(read.body).slice(0, 400)}`);
    const otherView = await self(other, "/api/self/messages?unread=1");
    const otherRead = await self(other, `/api/self/messages/${msg.foreign}/read`, "POST");
    check("another line: a slot reads its own line's predecessor's message, never one addressed to an occupation of the slot's older line (404)",
      otherView.status === 200 && ids(otherView.body).includes(msg.own) && !ids(otherView.body).includes(msg.foreign)
        && otherRead.status === 404,
      `${otherView.status} ${JSON.stringify(ids(otherView.body))} read=${otherRead.status} ${otherRead.body.error ?? ""}`);

    const heirToken = selfTokenOf(heir);
    await post(`/api/slots/${heir}/kill`, {});
    await post(`/api/slots/${heir}/open`, { cwd: "~", label: "Neubelegung · role-address" });
    let fresh = false;
    for (let k = 0; k < 60 && !fresh; k++) {
      const t = selfTokenOf(heir);
      fresh = /^[0-9a-f]{32}$/.test(t) && t !== heirToken;
      if (!fresh) await Bun.sleep(100);
    }
    const recycledView = await self(heir, "/api/self/messages");
    const recycledRead = await self(heir, `/api/self/messages/${msg.heirTwo}/read`, "POST");
    check("recycle: a new occupant of the slot sees neither the read nor the unread message of the old line, and its receipt is a 404",
      fresh && recycledView.status === 200 && !ids(recycledView.body).includes(msg.heirOne)
        && !ids(recycledView.body).includes(msg.heirTwo) && recycledRead.status === 404,
      `fresh=${fresh} ${recycledView.status} ${JSON.stringify(ids(recycledView.body))} read=${recycledRead.status} ${recycledRead.body.error ?? ""}`);
  } finally {
    for (const id of [heir, other]) await post(`/api/slots/${id}/kill`, {}).catch(() => null);
    await stopSrv();
    const state = readState();
    state.lineageHandovers = (state.lineageHandovers ?? []).filter((r) => ![line, oldLine, otherLine].includes(r.lineageId));
    if (state.messages) state.messages = { ...state.messages, entries: state.messages.entries.filter((m) => !plantedIds.has(m.id)) };
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(state, null, 2));
    await restartSrv();
  }
}

export async function run(): Promise<void> {
  await messageDeliveryChecks();
  await lineageMessageChecks();
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
  // newest first, as the route answers; the lead's thanks answers the strand's report and is not read yet (S12c)
  const entries = [
    { id: "m-dank", from: lead, to: strand, at: now - 30_000, payload: { kind: "text", text: "Danke, passt.\nAls Nächstes S7." }, replyTo: "m-long", readAt: null },
    { id: "m-long", from: strand, to: lead, at: now - 60_000, payload: { kind: "text", text: long.join("\n") }, replyTo: "m-ask", readAt: null },
    { id: "m-ask", from: lead, to: strand, at: now - 600_000, payload: { kind: "text", text: "Bitte S6 bauen." }, replyTo: null, readAt: now - 300_000 },
    { id: "m-pruef", from: pruefer, to: lead, at: now - 3_600_000, payload: { kind: "text", text: "dom grün auf dem Kandidaten." }, replyTo: null, readAt: null },
  ];
  const executable = process.env.FLEET_E2E_BROWSER ?? Bun.which("chromium") ?? Bun.which("chromium-browser") ?? Bun.which("google-chrome") ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (!Bun.file(executable).size) { rmSync(scratch, { recursive: true, force: true }); throw new Error("postfach DOM probe needs Chromium (FLEET_E2E_BROWSER): " + executable); }
  // A MOUSE, WHATEVER THE MACHINE (as e2e/slots.ts): the Linux helper's headless Chromium reports (hover: none) and
  // (pointer: none), so the edge under the pointer (S12c, `@media (hover: hover)`) never came there (k13-s12c-coredom:
  // red on the helper, green on this Mac). Blink HoverType 2 and PointerType 4 give every run the desktop's hover and
  // fine pointer; the PROBE claim below checks it took.
  const pointer = "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4";
  const browser = Bun.spawn([executable, "--headless", "--password-store=basic", "--no-sandbox", "--disable-gpu", "--no-first-run", "--disable-background-networking", "--remote-debugging-port=0", pointer, `--user-data-dir=${scratch}/profile`, "about:blank"], { stdout: "ignore", stderr: "pipe" });
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
    // per row also its place in the conversation (dl/dr: px from the box's left/right edge), its quote, its read sign
    // and the edge and fill it paints (S12c)
    const READ = `(() => { const tab = ${TAB}; if (!tab) return null; const t = tab.getBoundingClientRect();
      const g = tab.querySelector('.bgespr')?.getBoundingClientRect();
      const paint = (e) => { if (!e) return null; const cs = getComputedStyle(e); return { edge: parseFloat(cs.borderTopWidth) > 0 ? cs.borderTopColor : 'none', fill: cs.backgroundColor }; };
      return [...tab.querySelectorAll('.bgespr .bmsg')].map((r) => { const b = r.getBoundingClientRect(), line = r.querySelector('.bmsgline');
        const re = r.querySelector('.bmsgre'), sign = r.querySelector('.bmsgread'), first = r.querySelector('.bmsgfirst');
        return { id: r.dataset.mid, mine: r.classList.contains('mine'), open: r.classList.contains('open'), expanded: line?.getAttribute('aria-expanded') ?? null,
          who: r.querySelector('.bmsgwho')?.textContent ?? null, at: r.querySelector('.bmsgat')?.textContent ?? null,
          first: first?.textContent ?? null, firstShown: !!first && getComputedStyle(first).display !== 'none',
          full: r.querySelector('.bmsgtx')?.textContent ?? null, text: r.innerText, h: Math.round(b.height), lineH: Math.round(line?.getBoundingClientRect().height ?? 0),
          inside: b.left >= t.left - 0.5 && b.right <= t.right + 0.5 && !!line && line.scrollWidth <= line.clientWidth + 1,
          dl: g ? Math.round(b.left - g.left) : null, dr: g ? Math.round(g.right - b.right) : null,
          quote: re ? { text: re.textContent, above: !!line && re.getBoundingClientRect().bottom <= line.getBoundingClientRect().top + 0.5,
            fs: parseFloat(getComputedStyle(re).fontSize), color: getComputedStyle(re).color, firstFs: first ? parseFloat(getComputedStyle(first).fontSize) : null,
            firstColor: first ? getComputedStyle(first).color : null } : null,
          sign: sign ? { title: sign.title, text: sign.textContent, w: sign.getBoundingClientRect().width, h: sign.getBoundingClientRect().height,
            besideTime: !!r.querySelector('.bmsgat') && Math.abs(sign.getBoundingClientRect().top + sign.getBoundingClientRect().height / 2
              - (r.querySelector('.bmsgat').getBoundingClientRect().top + r.querySelector('.bmsgat').getBoundingClientRect().height / 2)) <= 3 } : null,
          row: paint(r), line: paint(line) }; }); })()`;
    type Paint = { edge: string; fill: string } | null;
    type Row = { id: string; mine: boolean; open: boolean; expanded: string | null; who: string | null; at: string | null; first: string | null;
      firstShown: boolean; full: string | null; text: string; h: number; lineH: number; inside: boolean; dl: number | null; dr: number | null;
      quote: { text: string; above: boolean; fs: number; color: string; firstFs: number | null; firstColor: string | null } | null;
      sign: { title: string; text: string; w: number; h: number; besideTime: boolean } | null; row: Paint; line: Paint };
    // a computed colour paints when it is not fully transparent; its brightness for „quieter than the text“
    const shows = (c: string | undefined) => !!c && c !== "none" && !/^rgba\([^)]*,\s*0\)$/.test(c) && c !== "transparent";
    const lum = (c: string | null | undefined) => { const p = (c ?? "").match(/[\d.]+/g)?.map(Number) ?? []; return p.length >= 3 ? (p[0]! + p[1]! + p[2]!) / 3 : NaN; };
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
      // the phone starts with Info closed and opens it by a tap on the island
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
      claims["PROBE: the fixture browser is a mouse — (hover: hover) and (pointer: fine), whatever the host"] =
        await evaluate<boolean>("matchMedia('(hover: hover)').matches && matchMedia('(pointer: fine)').matches");
      await evaluate(`${TAB}.scrollIntoView({ block: 'start' })`);
      await settle(200);
      const closed = await evaluate<Row[]>(READ);
      const [longAt, askAt] = [await clock(now - 60_000), await clock(now - 600_000)];
      const byId = (rows: Row[], id: string) => rows.find((r) => r.id === id);
      const l0 = byId(closed, "m-long"), a0 = byId(closed, "m-ask"), d0 = byId(closed, "m-dank");
      facts.closed = closed;
      // one compact line: who, when, the first line with „…“ for more — and none of the rest, two text lines at most
      claims["every message first shows as one compact line — sender, time and the first line of its text, not the rest"] =
        closed.length === 3 && !!l0 && !!a0 && !!d0 && closed.every((r) => !r.open && r.expanded === "false" && r.full === null && r.firstShown && r.lineH < 60)
        && l0.who === "Strang" && l0.at === longAt && l0.first === `${long[0]} …` && !l0.text.includes(long[1]!) && !l0.text.includes(long[2]!)
        && a0.at === askAt && a0.first === "Bitte S6 bauen." && d0.first === "Danke, passt. …";
      claims["the compact lines stay inside the Postfach column, their text cut, not running over"] = closed.every((r) => r.inside)
        && await evaluate<boolean>("document.documentElement.scrollWidth <= innerWidth");
      // S12c · Owner 14.10. 21:0x on Slot 2's postfach, whose own message carried „[Zitat entfernt]“: „[Zitat entfernt]“
      //  What this session sent stands right without a name, only with its time; the name is the
      // other side's, on the left. This session's label is in none of its rows.
      claims["what this session sent stands right without a name, only its time; only the other side carries a name, on the left"] =
        !!l0 && !!a0 && !!d0 && [a0, d0].every((r) => r.mine && r.who === null && !r.text.includes("Bauleitung") && r.dr !== null && r.dr <= 1 && (r.dl ?? 0) > 8)
        && a0.at === askAt && !l0.mine && l0.who === "Strang" && l0.dl !== null && l0.dl <= 1 && (l0.dr ?? 0) > 8;
      // S12c · Owner: „[Zitat entfernt]“. An answer
      // carries over its line the beginning of what it answers, closed already and also when the original stands right
      // under it, smaller and darker than its own text; a message that answers nothing has none.
      claims["an answer shows what it answers — a quiet quote line with the beginning of the original over it, already closed"] =
        !!l0?.quote && !!d0?.quote && !!a0 && a0.quote === null
        && l0.quote.text === "Bitte S6 bauen." && d0.quote.text === `${long[0]} …`
        && [l0.quote, d0.quote].every((q) => q.above && q.firstFs !== null && q.fs < q.firstFs && lum(q.color) < lum(q.firstColor));
      // S12c · Owner: „[Zitat entfernt]“. At
      // rest no row and no line paints an edge or a fill; the pointer over one message gives it a gray edge, the others
      // none; on the phone no message shows an edge, also under the pointer.
      const rest = closed.every((r) => !shows(r.row?.edge) && !shows(r.row?.fill) && !shows(r.line?.fill));
      const over = await evaluate<{ x: number; y: number } | null>(`(() => { const r = ${TAB}?.querySelector('.bmsg[data-mid="m-long"] .bmsgline')?.getBoundingClientRect();
        return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; })()`);
      if (over) await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: over.x, y: over.y });
      await settle(450);
      const hovered = await evaluate<Row[]>(READ);
      if (over) await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 1 });
      await settle(450);
      const h0 = byId(hovered, "m-long");
      const gray = (c: string | undefined) => { const p = (c ?? "").match(/[\d.]+/g)?.map(Number) ?? []; return p.length >= 3 && Math.max(p[0]!, p[1]!, p[2]!) - Math.min(p[0]!, p[1]!, p[2]!) <= 10; };
      facts.bubble = { rest: closed.map((r) => [r.id, r.row, r.line]), hovered: hovered.map((r) => [r.id, r.row]) };
      if (!phone) claims["at rest a message is no bubble — no edge, no fill; a light edge comes only with the pointer"] =
        rest && !!over && shows(h0?.row?.edge) && gray(h0?.row?.edge) && hovered.filter((r) => r.id !== "m-long").every((r) => !shows(r.row?.edge));
      else claims["on the phone a message never shows an edge, at rest nor under the pointer"] =
        rest && !!over && hovered.every((r) => !shows(r.row?.edge) && !shows(r.row?.fill));
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
      // (since S12c this session's lines carry no name, so the marks are the other side's: the head and its lines)
      claims["the conversation is black and white — grays for every text, fill and edge; a speaker's colour only as a small mark before the name"] =
        !!tones && tones.big.length === 0 && tones.marks.length >= 2 && tones.marks.every((m) => m.hued && m.w <= 8 && m.h <= 8)
        && new Set(tones.marks.filter((m) => m.who === "Strang").map((m) => m.bg)).size === 1;
      await evaluate(`${TAB}.querySelector('.bmsg[data-mid="m-long"] .bmsgline').click()`);
      await settle(150);
      const again = await evaluate<Row[]>(READ);
      const l2 = byId(again, "m-long");
      facts.opened = l1; facts.closedAgain = l2;
      claims["a click on a line opens the whole message as written; the others stay compact; a second click closes it"] =
        !!l1 && l1.open && l1.expanded === "true" && l1.full === long.join("\n") && !l1.firstShown
        && !!a1 && !a1.open && a1.full === null
        && !!l2 && !l2.open && l2.full === null && l2.firstShown;
      // S12c · the Bauleitung from the owner's screenshot: „[Zitat entfernt]“ becomes quieter. Whether a sent message was
      // read is a sign of at most 10 px beside its time with its words as title — closed and opened; no row writes it out.
      await evaluate(`${TAB}.querySelector('.bmsg[data-mid="m-dank"] .bmsgline').click()`);
      await settle(150);
      const d1 = byId(await evaluate<Row[]>(READ), "m-dank");
      await evaluate(`${TAB}.querySelector('.bmsg[data-mid="m-dank"] .bmsgline').click()`);
      await settle(150);
      const readAt = await clock(now - 300_000);
      facts.signs = { d0: d0?.sign, a0: a0?.sign, d1: d1?.sign, d1text: d1?.text };
      claims["whether a sent message was read is a small sign beside its time, its words only in the title"] =
        !!d0?.sign && !!a0?.sign && !!d1?.sign && d1.open && d1.full === "Danke, passt.\nAls Nächstes S7."
        && d0.sign.title === "not read yet" && d1.sign.title === "not read yet" && a0.sign.title === `read ${readAt}`
        && [d0.sign, a0.sign, d1.sign].every((s) => s.text === "" && s.w <= 10 && s.h <= 10 && s.besideTime)
        && !!l1 && [d0, a0, d1, l1].every((r) => !/\bread\b/.test(r.text));
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
        p0.convs === 1 && !p0.select && p0.shown === "Strang · 1 unread" && p0.expanded === "false" && !p0.open && JSON.stringify(p0.ids) === JSON.stringify(["m-dank", "m-long", "m-ask"])
        && p1.open && p1.expanded === "true" && JSON.stringify(p1.opts) === JSON.stringify([["Strang", "1 unread", "true"], ["Prüfer", "1 unread", "false"]])
        && p1.focus === "list:Strang"
        && p4.convs === 1 && !p4.open && p4.shown === "Prüfer · 1 unread" && JSON.stringify(p4.ids) === JSON.stringify(["m-pruef"])
        && p5.convs === 1 && !p5.stale && p5.shown === "Prüfer · 1 unread" && JSON.stringify(p5.ids) === JSON.stringify(["m-pruef"]);
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
