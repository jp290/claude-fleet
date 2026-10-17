// Mangel 100 · Nachfolge ohne Verlust. Owner 17.10.: „[Zitat entfernt]“
// 
//  Belegt am selben Tag: Die Audit-Wache der Bauleitung musste ihre Nachfolgerin von Hand neu setzen.
//
// Jedes `life` ist ein Leben des Servers in einem eigenen Prozess (server/branches.drive.ts): Zustand laden, Anfragen
// über den Route-Handler, tmux auf einem eigenen Socket, `claude` ein Ersatz, der nur wartet (server/branches-testkit.ts).
import { afterAll, describe, expect, test } from "bun:test";
import { branchTestkit, commitIn, type Fixture, get, LIFE_DEADLINE_MS, persisted, post, sh } from "./branches-testkit";

const { fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

const SLOT = 3;
type Row = { id: string; slot: number; slotOpenedAt?: number; kind?: string; repo?: string; mainAfter?: string; idleSec: number;
  armed: boolean; text?: string; everySec?: number | null; runsLeft?: number; nextAt?: number; enabled?: boolean };
type Obligation = { kind: string; id: string; target?: Record<string, unknown> | null; rearmed?: string; notRearmed?: string };
const occupant = (f: Fixture): { openedAt: number; selfToken: string } => {
  const s = (persisted(f).slots as Record<string, { openedAt?: number; selfToken?: string }>)[String(SLOT)];
  if (!s?.openedAt || !s.selfToken) throw new Error(`Slot ${SLOT} ist in fleet.json nicht besetzt`);
  return { openedAt: s.openedAt, selfToken: s.selfToken };
};
const rows = (f: Fixture, key: "watches" | "autos"): Row[] => (persisted(f)[key] as Row[] | undefined) ?? [];
const as = (self: string, step: { method: string; path: string; body?: unknown }) => ({ ...step, token: null, self });
// Der Ersatz ist kein Agent, also stellt Fleet der Nachfolgerin ihren Brief nicht zu: succeed endet hier als Schuld
// (500, „founding brief was not delivered“), kurz gewartet. Auch dann laufen ihre Wachen weiter; den Weg mit
// zugestelltem Brief fährt e2e/self-token.ts.
const QUICK = { FLEET_FOUNDING_BOOT_GRACE_MS: "250", FLEET_READY_WAIT_MS: "500" };

// Ein Land auf main reiht den Audit des neuen Tips ein; ohne laufende Suite bleibt er stehen (das Ruhefenster hält
// ihn), also bleibt eine Wache darauf scharf (server/branches-charge.test.ts, „nach der Charge“)
const AUDIT_ENV = { FLEET_POSTLAND_AUDIT_CMD: "true", FLEET_AUDIT_HELPER_GRACE_MS: "60000" };

describe("Nachfolge: die Wachen und Wiederholungen der Vorgängerin laufen bei der Nachfolgerin weiter", () => {
  test("eine Audit-Wache, dann succeed: die Nachfolgerin hat genau eine scharfe Wache mit demselben Ziel, ohne eigenen Aufruf", async () => {
    const f = fixture();
    const [opened, made] = await life(f, [post(`/api/slots/${SLOT}/open`, { cwd: f.repo, label: "vorher" }),
      post("/api/branches", { repo: f.repo, name: "Probe" })]);
    expect(opened?.status).toBe(200);
    commitIn(String(made?.body.path), "probe.txt", "Arbeit");
    const before = occupant(f);
    const [landed, armed, succeeded] = await life(f, [
      post("/api/branches/land", { repo: f.repo, branch: "branch/probe", subject: "Probe", unchecked: true }),
      as(before.selfToken, post("/api/self/watch", { kind: "audit", repo: f.repo, mainAfter: "$0.sha", idleSec: 0 })),
      as(before.selfToken, post("/api/self/succeed", { intent: "erst den Audit lesen, dann weiter" }))], { ...AUDIT_ENV, ...QUICK });
    const tip = sh(f.repo, "rev-parse", "main");
    expect(landed?.body.sha).toBe(tip);
    expect([armed?.status, (armed?.body.watch as Row | undefined)?.armed]).toEqual([200, true]);
    const watchA = (armed?.body.watch as Row).id;
    expect(succeeded?.body.slot).toBe(SLOT);

    const after = occupant(f);
    expect(after.openedAt).toBeGreaterThan(before.openedAt);
    const live = rows(f, "watches").filter((w) => w.armed);
    expect(live.map((w) => [w.slot, w.slotOpenedAt, w.kind, w.repo, w.mainAfter, w.idleSec]))
      .toEqual([[SLOT, after.openedAt, "audit", f.repo, tip, 0]]);
    expect(live[0]?.id).not.toBe(watchA);

    // der Record sagt je Pflicht, was aus ihr wurde, und die Nachfolgerin liest es an ihrer eigenen Tür
    const [self] = await life(f, [as(after.selfToken, get("/api/self"))]);
    const record = (self?.body.lineage as { record?: { obligations?: Obligation[] } } | undefined)?.record;
    expect(record?.obligations?.map((o) => [o.kind, o.id, o.rearmed, o.notRearmed]))
      .toEqual([["watch", watchA, live[0]?.id, undefined]]);
  }, LIFE_DEADLINE_MS * 3);

  test("eine Wiederholung behält Takt, Rest und Zeitpunkt; eine angehaltene bleibt aus, mit Grund im Record", async () => {
    const f = fixture();
    await life(f, [post(`/api/slots/${SLOT}/open`, { cwd: f.repo })]);
    const before = occupant(f);
    const text = "Linien-Probe: lies den Audit der Welle";
    const [beat, paused] = await life(f, [
      as(before.selfToken, post("/api/self/autos", { text, everySec: 600, runs: 3, idleSec: 120, inSec: 900 })),
      as(before.selfToken, post("/api/self/autos", { text: "angehalten", everySec: 600, runs: 2 }))]);
    const beatRow = beat?.body.auto as Row;
    const pausedId = (paused?.body.auto as Row).id;
    const [toggled, succeeded] = await life(f, [
      post(`/api/autos/${pausedId}/toggle`, {}),
      as(before.selfToken, post("/api/self/succeed", {}))], QUICK);
    expect(toggled?.status).toBe(200);
    expect(succeeded?.body.slot).toBe(SLOT);

    const after = occupant(f);
    const autos = rows(f, "autos").filter((a) => a.slot === SLOT && a.enabled);
    expect(autos.map((a) => [a.text, a.everySec, a.runsLeft, a.idleSec])).toEqual([[text, 600, 3, 120]]);
    // derselbe Zeitpunkt, auf die Sekunde: nicht „alle 10 min ab jetzt“
    expect(Math.abs((autos[0]?.nextAt ?? 0) - (beatRow.nextAt ?? 0))).toBeLessThanOrEqual(1000);
    const [self] = await life(f, [as(after.selfToken, get("/api/self"))]);
    const obligations = (self?.body.lineage as { record?: { obligations?: Obligation[] } }).record?.obligations ?? [];
    expect(obligations.find((o) => o.id === beatRow.id)?.rearmed).toBe(autos[0]?.id);
    expect(obligations.find((o) => o.id === pausedId)?.notRearmed).toBe("sie war angehalten");
  }, LIFE_DEADLINE_MS * 3);
});

