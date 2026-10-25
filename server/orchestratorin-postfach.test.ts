// Die Antwort eines Sitzes erreicht die Orchestratorin, die ihn geöffnet hat (server.ts#messageAddressesFor). Ein Sitz aus
// POST /api/self/branches/open schreibt seiner Öffnerin an {kind:"session",slot}; die Sendetür nahm das an, aber die
// Orchestratorin las nur unter ihrer Rolle, und so lagen in der Nacht zum 25.10. neun Berichte zweier Bau-Sitze ungelesen.
// Hier: sie öffnet einen Sitz, der Sitz schreibt an ihre Session, und in einem späteren Leben des Servers (wie nach einem
// Deploy) steht die Nachricht in ihrem Postfach, lässt sich quittieren und wird in ihre Pane getippt. Was der Sitz ihrer
// Vorgängerin schrieb, liest nach einer Nachfolge die Nachfolgerin.
// Der Ersatz-claude ist der aus server/rueckfrage-zustellung.test.ts: er zeigt seine Rahmen-Datei und schreibt, was in die
// Pane getippt wird, in `.getippt`.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { branchTestkit, get, LIFE_DEADLINE_MS, persisted, post, type Fixture } from "./branches-testkit";

const { TMP, BIN, fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);
const FRAMES = join(TMP, "frames");
mkdirSync(FRAMES);
symlinkSync(process.execPath, join(BIN, "claude-agent"));
writeFileSync(join(TMP, "ersatz.js"), `const fs = require("node:fs"), path = require("node:path");
const f = path.join(${JSON.stringify(FRAMES)}, process.cwd().split("/").slice(-3).join("_"));
let last = null;
setInterval(() => { let c = ""; try { c = fs.readFileSync(f, "utf8").trimEnd(); } catch {}
  if (c !== last) { last = c; process.stdout.write("\\x1b[H\\x1b[2J" + c + "\\n"); } }, 200);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.on("data", (d) => fs.appendFileSync(f + ".getippt", d));
`);
writeFileSync(join(BIN, "claude"), `#!/bin/sh\nexec "${join(BIN, "claude-agent")}" "${join(TMP, "ersatz.js")}"\n`, { mode: 0o755 });

const ORCH = 1;
const QUICK = { FLEET_FOUNDING_BOOT_GRACE_MS: "250", FLEET_READY_WAIT_MS: "500" };
type Seat = { openedAt: number; selfToken: string; cwd: string };
const seat = (f: Fixture, slot: number): Seat => {
  const s = (persisted(f).slots as Record<string, Seat> | undefined)?.[String(slot)];
  if (!s?.openedAt || !s.selfToken) throw new Error(`Slot ${slot} ist in fleet.json nicht besetzt`);
  return s;
};
const as = (self: string, step: { method: string; path: string; body?: unknown }) => ({ ...step, token: null, self });
type Entry = { id: string; from: { kind: string; slot?: number }; to: { kind: string; slot?: number; openedAt?: number };
  payload: { text: string } };
const unread = (a: { body: Record<string, unknown> } | undefined): Entry[] => (a?.body.entries as Entry[] | undefined) ?? [];

// die Orchestratorin im Owner-Weg geöffnet, dann öffnet sie mit ihrem Self-Token einen Sitz
async function orchestratorinMitSitz(): Promise<{ f: Fixture; sitz: number }> {
  const f = fixture();
  const [o] = await life(f, [post(`/api/slots/${ORCH}/open`, { cwd: f.repo, label: "🎛 Orchestratorin" })]);
  expect(o?.status).toBe(200);
  const orch = seat(f, ORCH).selfToken;
  const [made, opened] = await life(f, [as(orch, post("/api/self/branches", { name: "Sitz" })),
    as(orch, post("/api/self/branches/open", { branch: "branch/sitz", goal: "Bericht an die Orchestratorin" }))]);
  expect([made?.status, opened?.status]).toEqual([201, 200]);
  return { f, sitz: Number(opened?.body.slot) };
}
const bericht = (f: Fixture, sitz: number, key: string, text: string) => as(seat(f, sitz).selfToken,
  post("/api/self/messages", { to: { kind: "session", slot: ORCH }, payload: { kind: "text", text }, idempotencyKey: key }));

describe("Postfach: ein Sitz antwortet der Orchestratorin, die ihn geöffnet hat", () => {
  test("sie liest die Nachricht an ihre Session, quittiert sie, und eine zweite wird in ihre Pane getippt", async () => {
    const { f, sitz } = await orchestratorinMitSitz();
    const [a] = await life(f, [bericht(f, sitz, "a", "Bericht A: fertig")]);
    expect([a?.status, (a?.body.holder as { slot?: number } | null)?.slot]).toEqual([200, ORCH]);
    const id = String((a?.body.message as { id: string }).id);

    // ein späteres Leben des Servers, wie nach einem Deploy: die Nachricht liegt in fleet.json und wird gelesen
    const orch = seat(f, ORCH).selfToken;
    const [view, receipt, after] = await life(f, [as(orch, get("/api/self/messages?unread=1")),
      as(orch, post(`/api/self/messages/${id}/read`, {})), as(orch, get("/api/self/messages?unread=1"))]);
    expect(view?.status).toBe(200);
    expect(unread(view).map((m) => [m.id, m.from.slot, m.to])).toEqual([[id, sitz,
      { kind: "session", slot: ORCH, openedAt: seat(f, ORCH).openedAt }]]);
    expect([receipt?.status, receipt?.body.existing]).toEqual([200, false]);
    expect(unread(after)).toEqual([]);

    const frame = join(FRAMES, seat(f, ORCH).cwd.split("/").slice(-3).join("_"));
    const getippt = `${frame}.getippt`;
    const r = await life(f, [{ datei: frame, text: "⏺ Die Orchestratorin wartet.\n", ms: 1500 },
      bericht(f, sitz, "b", "Bericht B: in die Pane"), { ausgabe: ORCH, vorMs: 10_000 },
      { postfach: true }, { until: getippt, ms: 10_000 }], { FLEET_POSTFACH_FENSTER_SEC: "0" });
    expect([r[1]?.status, r[4]?.status]).toEqual([200, 200]);
    const typed = existsSync(getippt) ? readFileSync(getippt, "utf8") : "";
    expect(typed).toContain("Bericht B: in die Pane");
  }, LIFE_DEADLINE_MS * 4);

  test("nach einer Nachfolge liest die Nachfolgerin, was der Sitz ihrer Vorgängerin geschrieben hat", async () => {
    const { f, sitz } = await orchestratorinMitSitz();
    const vorher = seat(f, ORCH);
    const [a] = await life(f, [bericht(f, sitz, "a", "Bericht an die Vorgängerin")]);
    expect(a?.status).toBe(200);
    const id = String((a?.body.message as { id: string }).id);
    const [succeeded] = await life(f, [as(vorher.selfToken, post("/api/self/succeed", {}))], QUICK);
    expect(succeeded?.body.slot).toBe(ORCH);
    const nachher = seat(f, ORCH);
    expect(nachher.openedAt).toBeGreaterThan(vorher.openedAt);

    const [view, receipt] = await life(f, [as(nachher.selfToken, get("/api/self/messages?unread=1")),
      as(nachher.selfToken, post(`/api/self/messages/${id}/read`, {}))]);
    expect(unread(view).map((m) => [m.id, m.to])).toEqual([[id, { kind: "session", slot: ORCH, openedAt: vorher.openedAt }]]);
    expect([receipt?.status, receipt?.body.existing]).toEqual([200, false]);
    // ihre Rolle bleibt die erste Adresse: was sie sendet und was an die Rolle geht, ändert sich nicht
    expect((view?.body.addresses as unknown[])[0]).toEqual({ kind: "role", role: "orchestrator" });
  }, LIFE_DEADLINE_MS * 4);
});
