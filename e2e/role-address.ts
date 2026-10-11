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
import { readFileSync } from "node:fs";
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
  type MessageRow = { id: string; to: Address; from: { kind: "program"; id: string }; readBy: object | null };
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
    section("let messageNudgeBusy =", "let backlogNudgeBusy =")].join("\n");
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
