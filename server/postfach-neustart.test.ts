// Was ein Neustart von den Postfach-Versuchen behalten muss (Auftrag „Eine getippte
// Postfach-Nachricht kommt nach einem Neustart nicht noch einmal“, branch/postfach-neustart).
//
// Die Merkliste lebte bisher nur im Speicher: nach einem Deploy war sie leer und jede ungelesene,
// schon getippte Nachricht wurde ein zweites Mal getippt. Diese Tests spielen den Neustart mit dem
// GESPEICHERTEN Stand nach: der Takt schreibt jede gemerkte Nachricht in ein Ledger, der nächste
// Prozess liest genau dieses Ledger wieder ein. Geprüft werden der direkte, der gebündelte und der
// geparkte Weg, die Grenze zwischen „könnte getippt haben“ und „sicher nichts getippt“ und der
// Besatzerwechsel, der keine fremden Versuche erben darf.
import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { POSTFACH_VERSUCH_MAX_IDS, restorePostfachVersuche } from "./postfach-versuche";

const ROOT = join(import.meta.dir, "..");
const leaf = (name: string): string => {
  const path = join(ROOT, name);
  return existsSync(path) ? readFileSync(path, "utf8").replace(/^export /gm, "").replace(/^import .*$/gm, "") : "";
};
const source = readFileSync(join(ROOT, "server.ts"), "utf8");
const section = (from: string, to: string): string => {
  const start = source.indexOf(from), end = source.indexOf(to, start);
  if (start < 0 || end < 0) throw new Error(`Postfach-Takt fehlt in server.ts: ${from} -> ${to}`);
  return source.slice(start, end);
};
const takt = [
  leaf("server/postfach-versuche.ts"),
  leaf("server/postfach-zustellen.ts"),
  leaf("server/zustellung.ts"),
  leaf("server/postfach-fehler.ts"),
  section("const postfachAttempted =", "// --- THE HINT AT THE THRESHOLD"),
];
const transpile = (parts: string[]): string =>
  new Bun.Transpiler({ loader: "ts" }).transformSync(parts.join("\n"));
const compiled = transpile(takt);
const compiledGeparkt = transpile([...takt,
  section("const PARKED_SEND_MAX_PER_SLOT", "// --- THE OWNER HINT FOR A HELD COMPOSER")]);

class SendRefused extends Error {}
class DeliveryGateDropped extends SendRefused {}
class SendNotAccepted extends Error {}
class SendComposerOccupied extends SendRefused {
  constructor(readonly chars: number) { super(`composer occupied (${chars} chars) — nothing typed`); }
}
class DeliveryCancelled extends Error {}

type Address =
  | { kind: "session" | "lane"; slot: number; openedAt: number }
  | { kind: "role"; role: string }
  | { kind: "program"; id: string };
type Message = { id: string; at: number; to: Address; from: Address;
  payload: { kind: "text"; text: string }; readBy: unknown };
type Occupant = { id: number; cwd: string; openedAt: number; sessionId: string | null;
  worktree: object | null; lastOutput: number; label: string; history: unknown[];
  selfToken?: string; zustellung?: "direkt" | "gebuendelt" };
type Send = { path?: string; deliveryClass?: string };
type Row = { session: string; ids: Set<string> };

function welt(weg: "direkt" | "gebuendelt", opts: { geparkt?: boolean; sessionId?: string | null;
  openedAt?: number; ledger?: unknown[] } = {}) {
  const now = Date.now();
  const openedAt = opts.openedAt ?? 100;
  const sessionId = opts.sessionId === undefined ? "session-a" : opts.sessionId;
  const slot: Occupant = { id: 29, cwd: "/fixture/session", openedAt, sessionId,
    worktree: null, lastOutput: now - 10_000, label: "fixture", history: [], zustellung: weg };
  const rows: Message[] = [{ id: "m1", at: now - 120_000, readBy: null,
    payload: { kind: "text", text: "der ganze Wortlaut" },
    to: { kind: weg === "gebuendelt" ? "lane" : "session", slot: 29, openedAt },
    from: { kind: "session", slot: 3, openedAt: 90 } }];
  const sends: Send[] = [];
  const ledger = opts.ledger ?? [];
  let failure: Error | null = null;
  let repeat = false;
  const deps = {
    slots: [slot], messages: { entries: rows },
    backlogSessionKey: (s: Occupant) => s.sessionId ?? `unbound:${s.selfToken ?? ""}`,
    messageInboundFor: () => true,
    POSTFACH_WINDOW_MS: 0, POSTFACH_MAX_CHARS: 8_000, POSTFACH_TICK_MS: 10_000,
    REPORT_DECISION_IDLE_MS: 3_000,
    canDeliver: async () => ({ ok: true as const }),
    sendText: async (_s: Occupant, _text: string, _submit: boolean, options: Send) => {
      sends.push(options);
      if (failure) {
        const e = failure;
        if (!repeat) failure = null;
        throw e;
      }
      return { acceptance: "observed" as const };
    },
    SendRefused, SendNotAccepted, SendComposerOccupied, DeliveryCancelled,
    sendFailureDelivery: (e: unknown) => e instanceof SendRefused ? "SendRefused"
      : e instanceof SendNotAccepted ? "SendNotAccepted" : "send-failed",
    parkFleetSend: () => "no room",
    parkedSends: [] as { fleet?: { key: string } }[],
    logError: () => {},
    logPrompt: () => {},
    stampMessageRead: (m: Message) => {
      if (m.readBy !== null) return false;
      m.readBy = { slot: 29, openedAt, sessionId };
      return true;
    },
    saveStateNow: async () => {}, saveHistory: () => {}, MAX_HISTORY: 100,
    POSTFACH_VERSUCH_FILE: "/fixture/postfach-versuche.jsonl",
    readLedger: async () => ({ rows: ledger, total: ledger.length, malformed: 0 }),
    appendEvent: async (_file: string, row: unknown) => { ledger.push(structuredClone(row)); },
    // nur für den echten Parkplatz (compiledGeparkt)
    slotStreamOccupant: (s: Occupant) => s.cwd
      ? { slot: s.id, openedAt: s.openedAt, selfToken: s.selfToken } : null,
    sameSlotStreamOccupant: (s: Occupant, o: { slot: number; openedAt: number; selfToken?: string }) =>
      !!s.cwd && s.id === o.slot && s.openedAt === o.openedAt && s.selfToken === o.selfToken,
    holdBackoffMs: () => 1_000,
    randomBytes: (n: number) => Buffer.alloc(n, 7),
    audit: () => {},
  };
  const api = new Function("deps", `with (deps) { ${opts.geparkt ? compiledGeparkt : compiled}\nreturn { tickPostfachZustellung, ladePostfachVersuche, postfachAttempted, ${opts.geparkt ? "tickParkedSends, parkedSends" : "parkedSends"} }; }`)(deps) as {
    tickPostfachZustellung: () => Promise<void>;
    ladePostfachVersuche: () => Promise<void>;
    postfachAttempted: Map<number, Row>;
    tickParkedSends?: () => Promise<void>;
    parkedSends: unknown[];
  };
  return {
    slot, rows, sends, ledger, api,
    failNext: (e: Error) => { failure = e; repeat = false; },
    failAlways: (e: Error) => { failure = e; repeat = true; },
    tick: async () => { await api.tickPostfachZustellung(); await Bun.sleep(1); },
    tickParked: async () => { await api.tickParkedSends?.(); await Bun.sleep(1); },
  };
}

// Der Neustart: nur dieses Ledger kommt mit, die Map ist im neuen Prozess leer. Geladen wird mit
// derselben Funktion, die auch der Boot benutzt — nicht mit einer Nachbildung im Test.
const neustart = async (w: ReturnType<typeof welt>): Promise<void> => {
  await w.api.ladePostfachVersuche();
};
const advance = (ms = 5 * 60_000): void => { setSystemTime(new Date(Date.now() + ms)); };
afterEach(() => setSystemTime());

describe("Postfach nach einem Neustart", () => {
  for (const weg of ["direkt", "gebuendelt"] as const) {
    test(`${weg}: ein möglicher Tipp wird gespeichert und nach dem Neustart nicht noch einmal getippt`, async () => {
      const vorher = welt(weg);
      vorher.failNext(new SendNotAccepted("prompt not submitted — the composer still held part of the payload"));
      await vorher.tick();
      expect(vorher.sends).toHaveLength(1);
      expect(vorher.rows[0]!.readBy).toBeNull();
      expect(vorher.ledger).toHaveLength(1);

      const nachher = welt(weg, { ledger: vorher.ledger });
      await neustart(nachher);
      expect(nachher.api.postfachAttempted.get(29)?.ids.has("m1")).toBe(true);
      await nachher.tick();
      expect(nachher.sends).toHaveLength(0);
    });

    test(`${weg}: ein Versuch, der sicher nichts getippt hat, bleibt nach dem Neustart offen`, async () => {
      const vorher = welt(weg);
      vorher.failNext(new SendRefused("slot unavailable or changed before send — nothing typed"));
      await vorher.tick();
      expect(vorher.sends).toHaveLength(1);
      expect(vorher.ledger).toHaveLength(0);

      const nachher = welt(weg, { ledger: vorher.ledger });
      await neustart(nachher);
      expect(nachher.api.postfachAttempted.size).toBe(0);
      await nachher.tick();
      expect(nachher.sends).toHaveLength(1);
      expect(nachher.rows[0]!.readBy).not.toBeNull();
    });
  }

  test("geparkt: ein möglicher Tipp hinter dem Entwurf des Owners überlebt den Neustart", async () => {
    const vorher = welt("direkt", { geparkt: true });
    vorher.failNext(new SendComposerOccupied(12));
    await vorher.tick();
    expect(vorher.api.parkedSends).toHaveLength(1);
    vorher.failNext(new SendNotAccepted("prompt not submitted — the composer still held part of the payload"));
    advance();
    await vorher.tickParked();
    expect(vorher.rows[0]!.readBy).toBeNull();
    expect(vorher.ledger).toHaveLength(1);

    const nachher = welt("direkt", { geparkt: true, ledger: vorher.ledger });
    await neustart(nachher);
    await nachher.tick();
    await nachher.tickParked();
    expect(nachher.sends).toHaveLength(0);
  });

  test("unbound: ein möglicher Tipp ohne Claude-Session überlebt den Neustart", async () => {
    const vorher = welt("direkt", { sessionId: null });
    vorher.slot.selfToken = "tok-a";
    vorher.failNext(new SendNotAccepted("prompt not submitted — the composer still held part of the payload"));
    await vorher.tick();
    expect(vorher.sends).toHaveLength(1);
    expect(vorher.rows[0]!.readBy).toBeNull();
    expect(vorher.ledger).toHaveLength(1);

    const nachher = welt("direkt", { sessionId: null, ledger: vorher.ledger });
    nachher.slot.selfToken = "tok-a";
    await neustart(nachher);
    expect(nachher.api.postfachAttempted.get(29)?.ids.has("m1")).toBe(true);
    await nachher.tick();
    expect(nachher.sends).toHaveLength(0);
  });

  for (const neu of [{ sessionId: "session-b", openedAt: 100 },
    { sessionId: "session-a", openedAt: 101 }] as const) {
    test(`ein neuer Besatzer erbt die gemerkten Versuche nicht (session=${neu.sessionId}, openedAt=${neu.openedAt})`, async () => {
      const alte = welt("direkt");
      alte.failNext(new SendNotAccepted("prompt not submitted — the composer still held part of the payload"));
      await alte.tick();
      expect(alte.ledger).toHaveLength(1);

      // Dieselbe Slot-Nummer, aber eine neue Besetzung: andere Session ODER anderes openedAt.
      const neue = welt("direkt", { ledger: alte.ledger, ...neu });
      await neustart(neue);
      expect(neue.api.postfachAttempted.size).toBe(0);
      await neue.tick();
      expect(neue.sends).toHaveLength(1);
    });
  }

  test("die Merkliste ist je Besetzung begrenzt", () => {
    const rows = Array.from({ length: POSTFACH_VERSUCH_MAX_IDS + 7 }, (_, i) =>
      ({ slot: 29, openedAt: 100, session: "session-a", ids: [`m${i}`], at: i }));
    const restored = restorePostfachVersuche(rows, [{
      slot: 29, openedAt: 100, session: "session-a", relevant: () => true,
    }]);
    expect(restored.get(29)?.ids.size).toBe(POSTFACH_VERSUCH_MAX_IDS);
    expect(restored.get(29)?.ids.has("m0")).toBe(false);
    expect(restored.get(29)?.ids.has(`m${POSTFACH_VERSUCH_MAX_IDS + 6}`)).toBe(true);
  });
});
