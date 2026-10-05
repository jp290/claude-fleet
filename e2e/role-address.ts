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

export async function run(): Promise<void> {
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
    const openA = await post(`/api/slots/${a}/open`, { cwd: "~" });
    const openB = await post(`/api/slots/${b}/open`, { cwd: "~" });
    const nameA = await post(`/api/slots/${a}/rename`, { label: "🎛 Orchestratorin · role-address" });
    const nameABody = await answer(nameA);
    check("role-address SETUP: slot A and B open, A renamed to an Orchestrator label",
      openA.ok && openB.ok && nameA.ok, `${openA.status} ${openB.status} ${nameA.status}`);
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
