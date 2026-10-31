// DER SITZ ÖFFNET EINEN SITZ IN EINEM ORDNER (POST /api/self/seats/open, Richtung Schritt 5, Owner 30.10.): dieselbe Öffnen-Tür wie die des
// Owners (server.ts#openSeatInFolder), dieselbe Deckelung wie die Branch-Tür (server/kind-weite.ts#kindNieWeiter). Jede Probe geht
// mit der Self-Token einer Session durch einen Server in eigenem Prozess (server/branches-testkit.ts).
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { branchTestkit, get, LIFE_DEADLINE_MS, persisted, post, type Answer, type Fixture } from "./branches-testkit";

const { fixture, life, serve, cleanup } = branchTestkit();
afterAll(cleanup);

const tokenOf = (f: Fixture, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
  if (!t) throw new Error(`no self token for slot ${slot}`);
  return t;
};
const as = (self: string, step: { method: string; path: string; body?: unknown }) => ({ ...step, token: null, self });
const slotRow = (f: Fixture, slot: number): Record<string, any> => (persisted(f).slots as Record<string, Record<string, any>>)[String(slot)]!;
const liest = (a: Answer | undefined, id: string): string | null =>
  ((a?.body.teile as { id: string; abschnitte: { id: string; text: string | null }[] }[] | undefined) ?? [])
    .find((t) => t.id === "liest")?.abschnitte.find((x) => x.id === id)?.text ?? null;
const missing = (a: Answer | undefined, id: string): void => {
  expect({ status: a?.status, missing: a?.body.missingRight, door: typeof a?.body.door }).toEqual({ status: 409, missing: id, door: "string" });
  expect(String(a?.body.error)).toContain(`missing right \`${id}\``);
};
const OPEN = "/api/self/seats/open";
// die Wurzel der Probe: der Ordner der Fixture, in dem Repo und Ordner der Kinder liegen
const wurzel = (f: Fixture): string => dirname(f.repo);
const ordner = (f: Fixture, name: string): string => { const d = join(wurzel(f), name); mkdirSync(d, { recursive: true }); return d; };

describe("das Recht seat.open an der Ordner-Tür", () => {
  test("ohne das Recht 409 mit missingRight, mit der Zusage öffnet dieselbe Session einen Sitz im Ordner — und beide sind einander Gegenüber im Postfach", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    const kind = ordner(f, "kind");
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, rechte: { buendel: "none" } })], env);
    expect(opened?.status).toBe(200);
    const self = tokenOf(f, 1);
    const [ohne] = await life(f, [as(self, post(OPEN, { cwd: kind, goal: "Prüfe die Texte." }))], env);
    missing(ohne, "seat.open");
    const [grant] = await life(f, [post("/api/slots/1/rechte", { grant: ["seat.open"] })], env);
    expect(grant?.status).toBe(200);

    const [mit] = await life(f, [as(self, post(OPEN, { cwd: kind, goal: "Prüfe die Texte.", label: "Prüfer", permissionMode: "plan",
      purpose: "Du prüfst nur und baust nichts um." }))], env);
    expect(mit?.status).toBe(200);
    const child = Number(mit?.body.slot);
    expect([mit?.body.cwd, mit?.body.goal, Number.isInteger(mit?.body.openedAt)]).toEqual([kind, "follows", true]);
    // er steht in diesem Ordner, hat den Zweck mit der Hand seiner Öffnerin und die erste Nachricht kommt mit ihrem Kopf
    const row = slotRow(f, child);
    expect([row.cwd, row.label, row.openedBy.slot, row.openedBy.cwd]).toEqual([kind, "Prüfer", 1, f.repo]);
    const [fassung] = await life(f, [get(`/api/slots/${child}/fassung?anlass=laufend`)], env);
    expect(liest(fassung, "eigenes")).toBe("PURPOSE (written for you by the session in slot 1):\nDu prüfst nur und baust nichts um.");

    // Gegenüber im Postfach, in beide Richtungen; ein Dritter ist es nicht
    // der Dritte ist ein pi-Sitz: zwei Claude-Sitze schreiben sich seit dem 30.10. auch ohne Paar (server/anthropic-post.test.ts)
    const [fremd] = await life(f, [post("/api/slots/3/open", { cwd: f.repo, harness: "pi" })], env);
    expect(fremd?.status).toBe(200);
    const childTok = tokenOf(f, child), fremdTok = tokenOf(f, 3);
    const send = (tok: string, slot: number, key: string) =>
      as(tok, post("/api/self/messages", { to: { kind: "session", slot }, payload: { kind: "text", text: "Hallo" }, idempotencyKey: key }));
    const [hin, zurueck, quer, an] = await life(f, [send(self, child, "k1"), send(childTok, 1, "k2"), send(fremdTok, child, "k3"), send(childTok, 3, "k4")], env);
    expect([hin?.status, zurueck?.status, quer?.status, an?.status]).toEqual([200, 200, 409, 409]);
    expect(String(quer?.body.error)).toContain("POST /api/self/seats/open");
  }, LIFE_DEADLINE_MS * 8);

  test("der Deckel hält auch gegen gleichzeitige Öffnungen: bei einem Kind Spielraum öffnet von dreien gleichzeitigen genau eine", async () => {
    const f = fixture();
    const server = await serve(f, { FLEET_SELF_SEAT_ROOT: wurzel(f), FLEET_SELF_SEAT_CAP: "1" });
    expect((await server.call("/api/slots/1/open", { body: { cwd: f.repo } })).status).toBe(200);
    let self: string | undefined;
    for (let i = 0; i < 50 && !self; i++) {
      self = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.["1"]?.selfToken;
      if (!self) await Bun.sleep(100);
    }
    if (!self) throw new Error("no self token for slot 1");
    const open = (name: string) => server.call(OPEN, { self, body: { cwd: ordner(f, name), goal: `Sitz ${name}.` } });
    const antworten = await Promise.all([open("p1"), open("p2"), open("p3")]);
    expect(antworten.map((a) => a.status).sort()).toEqual([200, 409, 409]);
    for (const a of antworten.filter((x) => x.status === 409)) expect(String(a.body.error)).toContain("FLEET_SELF_SEAT_CAP (1)");
  }, LIFE_DEADLINE_MS * 4);

  test("ein Kind ist nie weiter: weder Modus noch Harness noch Rechte noch Label noch Ordner noch Zahl", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f), FLEET_SELF_SEAT_CAP: "2" };
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo })], env);
    expect(opened?.status).toBe(200);
    const self = tokenOf(f, 1);
    const draussen = dirname(wurzel(f)), ausgang = join(wurzel(f), "ausgang");
    symlinkSync(draussen, ausgang);
    const a = ordner(f, "a"), b = ordner(f, "b"), c = ordner(f, "c");
    const open = (body: Record<string, unknown>) => as(self, post(OPEN, body));
    const [bypass, codex, recht, rolleLabel, aussen, symlink, ohneOrdner, kein, eins, zwei, drei] = await life(f, [
      open({ cwd: a, permissionMode: "bypassPermissions" }), open({ cwd: a, harness: "codex" }),
      open({ cwd: a, rechte: { recht: ["fleet.deploy"] } }), open({ cwd: a, label: "Orchestrator (Kind)" }),
      open({ cwd: draussen }), open({ cwd: ausgang }), open({ goal: "x" }), open({ cwd: join(wurzel(f), "gibt-es-nicht") }),
      open({ cwd: a, goal: "Eins." }), open({ cwd: b, goal: "Zwei." }), open({ cwd: c, goal: "Drei." })], env);
    expect(bypass?.status).toBe(409);
    expect(String(bypass?.body.error)).toContain("wider than the opener's own");
    expect(codex?.status).toBe(409);
    expect(String(codex?.body.error)).toContain("harness codex is not yours");
    expect(recht?.status).toBe(409);
    expect(String(recht?.body.error)).toContain("rechte give fleet.deploy more than yours");
    expect(rolleLabel?.status).toBe(409);
    expect(String(rolleLabel?.body.error)).toContain("reads as a role");
    expect([aussen?.status, symlink?.status]).toEqual([409, 409]);
    expect(String(aussen?.body.error)).toContain("outside the root");
    expect(String(symlink?.body.error)).toContain("outside the root");
    expect([ohneOrdner?.status, kein?.status]).toEqual([400, 400]);
    // die Zahl: der Deckel steht bei zwei, der dritte lebende Sitz wird abgewiesen, mit der Zahl und dem Namen der Einstellung
    expect([eins?.status, zwei?.status, drei?.status]).toEqual([200, 200, 409]);
    expect(String(drei?.body.error)).toContain("FLEET_SELF_SEAT_CAP (2)");
    // nichts davon hat einen Sitz zurückgelassen: außer dem Öffner leben genau die zwei
    const lebende = Object.entries(persisted(f).slots as Record<string, { cwd?: string }>).filter(([, s]) => s.cwd).map(([id]) => Number(id));
    expect(lebende.sort()).toEqual([1, Number(eins?.body.slot), Number(zwei?.body.slot)].sort());
  }, LIFE_DEADLINE_MS * 4);

  test("der Owner-Weg bleibt, wie er war: dieselbe Tür, ohne die Felder der Selbst-Tür", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    const [owner, ownerGoal] = await life(f, [post("/api/slots/1/open", { cwd: f.repo }), post("/api/slots/2/open", { cwd: ordner(f, "owner"), goal: "Von mir." })], env);
    expect([owner?.status, ownerGoal?.status]).toEqual([200, 200]);
    // die Antwort der Owner-Tür trägt keine neuen Felder: Slot und Belegung nennt nur die Selbst-Tür
    expect(Object.keys(ownerGoal?.body ?? {})).not.toContain("slot");
    const row = slotRow(f, 2);
    expect(row.openedBy ?? null).toBeNull();
  }, LIFE_DEADLINE_MS * 3);
});
