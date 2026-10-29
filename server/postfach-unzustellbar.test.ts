// EINE NACHRICHT, DIE NICHT ANKOMMT, SAGT WARUM (Owner 28.10.: „[Zitat entfernt]“)
//
// Gemessen am 28.10. nach dem Neustart: drei Branch-Sitzen je eine Nachricht geschickt, dreimal
// `{"ok":true,"existing":false}`, keine Zeile erschien je in einer Pane, und niemand erfuhr davon.
// Die Zustell-Tür `canDeliver` hatte die Gründe längst benannt — sie kamen beim Absender nie an.
//
// Geprüft wird an der ECHTEN Tür und am gespeicherten Record (Fixture-Leben, kein Live-Server,
// keine Verbindung nach außen):
//   (a) eine Pane ohne lebenden Agenten → die Antwort nennt `alive` und den Sitz, der Eintrag steht
//       als nicht zugestellt, und die Nachricht bleibt ungelesen in der Post des Empfängers;
//   (b) eine lebende, ruhende Pane → zugestellt wie bisher (der Takt tippt sie, genau einmal);
//   (c) ein gekillter Autos-Schalter → `kill-switch` genannt, die Nachricht bleibt unangetastet.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadMessages } from "./types";
import { branchTestkit, get, LIFE_DEADLINE_MS, persisted, post, type Answer, type Fixture } from "./branches-testkit";

// ZWEI KITS, absichtlich: `tot` startet den Ersatz-claude des Kits (`exec sleep 600`), den die
// Lebendigkeitsprobe NICHT als Agenten liest — das ist die Pane ohne lebenden Agenten aus dem Befund.
const tot = branchTestkit();
// `lebt` bekommt einen Ersatz, dessen Name mit `claude` beginnt: so antwortet die Probe „alive“,
// und was in die Pane getippt wird, steht in `.getippt`.
const lebt = branchTestkit();
afterAll(() => { tot.cleanup(); lebt.cleanup(); });

const FRAMES = join(lebt.TMP, "frames");
mkdirSync(FRAMES, { recursive: true });
symlinkSync(process.execPath, join(lebt.BIN, "claude-agent"));
writeFileSync(join(lebt.TMP, "ersatz.js"), `const fs = require("node:fs"), path = require("node:path");
const f = path.join(${JSON.stringify(FRAMES)}, process.cwd().split("/").slice(-3).join("_"));
let last = null;
setInterval(() => { let c = ""; try { c = fs.readFileSync(f, "utf8").trimEnd(); } catch {}
  if (c !== last) { last = c; process.stdout.write("\\x1b[H\\x1b[2J" + c + "\\n"); } }, 200);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.on("data", (d) => fs.appendFileSync(f + ".getippt", d));
`);
writeFileSync(join(lebt.BIN, "claude"), `#!/bin/sh\nexec "${join(lebt.BIN, "claude-agent")}" "${join(lebt.TMP, "ersatz.js")}"\n`, { mode: 0o755 });

const ORCH = 1, A = 2, B = 3;
type Seat = { openedAt: number; selfToken: string; cwd: string };
const seat = (f: Fixture, slot: number): Seat => {
  const s = (persisted(f).slots as Record<string, Seat> | undefined)?.[String(slot)];
  if (!s?.openedAt || !s.selfToken) throw new Error(`Slot ${slot} ist in fleet.json nicht besetzt`);
  return s;
};
const as = (f: Fixture, slot: number, step: { method: string; path: string; body?: unknown }) =>
  ({ ...step, token: null, self: seat(f, slot).selfToken });
const schreib = (f: Fixture, from: number, to: number, key: string, text: string) => as(f, from,
  post("/api/self/messages", { to: { kind: "session", slot: to }, payload: { kind: "text", text }, idempotencyKey: key }));
const kante = (f: Fixture, from: number, to: number) => as(f, ORCH,
  post("/api/self/kanten", { between: [from, to], why: "Nachricht an einen Sitz, der sie nicht annehmen kann" }));
type Hindernis = { state: string; gate: string; tor: string; slot: number; at: number; reason: string };
type Row = { id: string; readBy: unknown; delivery?: Hindernis; payload: { text: string } };
const rows = (f: Fixture): Row[] =>
  ((persisted(f).messages as { entries?: Row[] } | undefined)?.entries ?? []);
const rowOf = (f: Fixture, a: Answer | undefined): Row => {
  const id = (a?.body.message as { id?: string } | undefined)?.id;
  const row = rows(f).find((m) => m.id === id);
  if (!row) throw new Error(`Nachricht ${id} steht nicht in fleet.json`);
  return row;
};

// Drei Sitze: die Orchestratorin und zwei schlichte Sessions, die sich über eine Kante schreiben.
async function dreiSitze(kit: ReturnType<typeof branchTestkit>): Promise<Fixture> {
  const f = kit.fixture();
  for (const d of ["a", "b"]) mkdirSync(join(f.repo, d));
  const opened = await kit.life(f, [post(`/api/slots/${ORCH}/open`, { cwd: f.repo, label: "🎛 Orchestratorin" }),
    post(`/api/slots/${A}/open`, { cwd: join(f.repo, "a"), label: "Startfenster" }),
    post(`/api/slots/${B}/open`, { cwd: join(f.repo, "b"), label: "Wicht" })]);
  expect(opened.map((o) => o.status)).toEqual([200, 200, 200]);
  const grant = await kit.life(f, [kante(f, A, B)]);
  expect(grant[0]?.status).toBe(201);
  return f;
}

describe("Eine Nachricht, die nicht zugestellt werden kann, sagt warum", () => {
  test("(a) eine Pane ohne lebenden Agenten: die Antwort nennt das Tor `alive` und den Sitz, der Eintrag steht als nicht zugestellt",
    async () => {
      const f = await dreiSitze(tot);
      const [gesendet, inboxB] = await tot.life(f, [schreib(f, A, B, "a1", "kommt diese an?"),
        as(f, B, get("/api/self/messages?unread=1"))]);
      expect(gesendet?.status).toBe(200);
      const hindernis = gesendet?.body.delivery as Hindernis | undefined;
      // DER GRUND, beim Namen: das Tor (`not-alive`), das Owner-Wort (`alive`) und der Sitz (3).
      expect([hindernis?.state, hindernis?.gate, hindernis?.tor, hindernis?.slot])
        .toEqual(["not-delivered", "not-alive", "alive", B]);
      expect(hindernis?.reason).toContain(`slot ${B}`);
      expect(hindernis?.reason).toContain("alive");
      // DER EINTRAG STEHT ALS NICHT ZUGESTELLT — im Record wie in der Post des Empfängers, ungelesen:
      // nichts ist verloren, und die Sperre behauptet keine Ankunft.
      const row = rowOf(f, gesendet);
      expect([row.delivery?.gate, row.delivery?.tor, row.readBy]).toEqual(["not-alive", "alive", null]);
      // sie liegt weiter in der Post des Empfängers (neben dem Satz, den die Kante beiden Enden schreibt)
      expect(((inboxB?.body.entries as Row[] | undefined) ?? []).map((m) => m.id)).toContain(row.id);
    }, LIFE_DEADLINE_MS * 3);

  test("(b) eine lebende, ruhende Pane: zugestellt wie bisher — ohne Grund in der Antwort, getippt genau einmal",
    async () => {
      const f = await dreiSitze(lebt);
      const [gesendet] = await lebt.life(f, [schreib(f, A, B, "b1", "Bericht B: kommt an")]);
      expect(gesendet?.status).toBe(200);
      // `delivery` fehlt: kein Hindernis bekannt (die Ankunft behauptet erst die Quittung des Takts)
      expect(gesendet?.body.delivery).toBeUndefined();
      expect([(gesendet?.body.holder as { slot?: number } | undefined)?.slot, rowOf(f, gesendet).delivery])
        .toEqual([B, undefined]);
      const getippt = `${join(FRAMES, seat(f, B).cwd.split("/").slice(-3).join("_"))}.getippt`;
      const lauf = await lebt.life(f, [{ ausgabe: B, vorMs: 10_000 }, { postfach: true }, { until: getippt, ms: 10_000 }],
        { FLEET_POSTFACH_FENSTER_SEC: "0" });
      expect(lauf[2]?.status).toBe(200);
      // ein ZWEITER Takt tippt dieselbe Nachricht nicht noch einmal
      await lebt.life(f, [{ ausgabe: B, vorMs: 10_000 }, { postfach: true }], { FLEET_POSTFACH_FENSTER_SEC: "0" });
      const text = readFileSync(getippt, "utf8");
      expect(text).toContain("Bericht B: kommt an");
      expect(text.split("Bericht B: kommt an").length - 1).toBe(1);
      // und keine Sperre bleibt stehen: was getippt ist, ist kein „nicht zugestellt“ mehr
      expect(rowOf(f, gesendet).delivery).toBeUndefined();
    }, LIFE_DEADLINE_MS * 5);

  test("(c) ein gekillter Autos-Schalter: `kill-switch` genannt, die Nachricht bleibt unangetastet",
    async () => {
      const f = await dreiSitze(tot);
      const [aus, gesendet] = await tot.life(f, [post("/api/autos/switch", { on: false }),
        schreib(f, A, B, "c1", "bei totem Schalter")]);
      expect(aus?.body.autosOn).toBe(false);
      expect(gesendet?.status).toBe(200);
      const hindernis = gesendet?.body.delivery as Hindernis | undefined;
      expect([hindernis?.gate, hindernis?.tor, hindernis?.slot]).toEqual(["kill-switch", "kill-switch", B]);
      const row = rowOf(f, gesendet);
      expect([row.delivery?.gate, row.readBy]).toEqual(["kill-switch", null]);
    }, LIFE_DEADLINE_MS * 3);

  test("(d) wer eine als nicht zugestellt vermerkte Nachricht holt und quittiert, lässt keine Sperre am gelesenen Eintrag — der Record lädt",
    async () => {
      const f = await dreiSitze(tot);
      const [gesendet, geholt] = await tot.life(f, [schreib(f, A, B, "d1", "wird geholt, nicht getippt"),
        as(f, B, get("/api/self/messages?unread=1&read=1"))]);
      expect(gesendet?.body.delivery).toBeDefined();
      expect(geholt?.status).toBe(200);
      const row = rowOf(f, gesendet);
      // die Quittung ist die Ankunft: die Sperre, die sie festhielt, steht nicht mehr am Eintrag ...
      expect([row.readBy === null, row.delivery]).toEqual([false, undefined]);
      // ... und der gespeicherte Record lädt, statt nach dem nächsten Neustart das ganze Postfach zu verlieren
      expect(loadMessages(persisted(f).messages).ok).toBe(true);
    }, LIFE_DEADLINE_MS * 3);

  test("(e) ein schlafender Empfänger: die Sendetür antwortet ohne Wecken und ohne `delivery` — geweckt wird erst vom Takt",
    async () => {
      const f = await dreiSitze(tot);
      const b = seat(f, B) as Seat & { sessionId?: string };
      if (!b.sessionId) throw new Error(`Slot ${B} hat in fleet.json keine Session-Id — der Schlaf wäre nicht fortsetzbar`);
      // der Schlaf verlangt das Transkript der Unterhaltung auf der Platte (server.ts#sleepSlot)
      const projekt = join(tot.PROJECTS, b.cwd.replace(/[^a-zA-Z0-9]/g, "-"));
      mkdirSync(projekt, { recursive: true });
      writeFileSync(join(projekt, `${b.sessionId}.jsonl`), "");
      const [, schlaf, gesendet] = await tot.life(f, [{ ausgabe: B, vorMs: 60_000 },
        post(`/api/slots/${B}/sleep`, {}), schreib(f, A, B, "e1", "an einen Schlafenden"), "save"]);
      expect(schlaf?.status).toBe(200);
      expect(gesendet?.status).toBe(200);
      // geweckt, fände der Sendeweg einen Sitz ohne lebenden Agenten und nennte `alive`; hier fehlt die Sperre ganz
      expect(gesendet?.body.delivery).toBeUndefined();
      expect(rowOf(f, gesendet).delivery).toBeUndefined();
      // und der Sitz schläft weiter: die Sendetür hat ihn nicht geweckt
      expect((persisted(f).slots as Record<string, { sleeping?: unknown }>)[String(B)]?.sleeping).toBeTruthy();
    }, LIFE_DEADLINE_MS * 3);
});
