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
  // Die Sperre der nicht zugestellten Nachricht: der Takt schreibt sie an den Eintrag
  // (server/postfach-befund.ts, Owner 28.10.: „[Zitat entfernt]“), und er stellt seine Tore mit
  // DEMSELBEN Objekt, mit dem die Sendetür den Absender fragt.
  leaf("server/postfach-befund.ts"),
  section("const POSTFACH_GATE =", "async function postfachHindernisFuer("),
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
  // die Annahme des nächsten Pastes, der ohne Wurf zurückkommt (W16-4: getippt, aber nicht beobachtet)
  let acceptance: "observed" | "not-observed" | "unobservable" = "observed";
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
      const a = acceptance;
      acceptance = "observed";
      return { acceptance: a };
    },
    SendRefused, SendNotAccepted, SendComposerOccupied, DeliveryCancelled,
    sendFailureDelivery: (e: unknown) => e instanceof SendRefused ? "SendRefused"
      : e instanceof SendNotAccepted ? "SendNotAccepted" : "send-failed",
    parkFleetSend: () => "no room",
    parkedSends: [] as { fleet?: { key: string } }[],
    logError: () => {},
    logPrompt: () => {},
    stampMessageRead: (m: Message, o: { id: number; openedAt: number; sessionId: string | null }) => {
      if (m.readBy !== null) return false;
      m.readBy = { slot: o.id, openedAt: o.openedAt, sessionId: o.sessionId };
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
    acceptNext: (a: "not-observed" | "unobservable") => { acceptance = a; },
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

  // W3 Auftrag 16, Punkt 4 (umgedreht): was in die Pane der Vorgängerin getippt wurde, bekommt die
  // Nachfolgerin nicht noch einmal; der Eintrag gilt als gelesen von der Besetzung, die ihn bekam.
  for (const neu of [{ sessionId: "session-b", openedAt: 100 },
    { sessionId: "session-a", openedAt: 101 }] as const) {
    test(`nach einem Neustart: was der alten Besetzung getippt wurde, gilt als ihr gelesen (session=${neu.sessionId}, openedAt=${neu.openedAt})`, async () => {
      const alte = welt("direkt");
      alte.acceptNext("unobservable");
      await alte.tick();
      expect(alte.rows[0]!.readBy).toBeNull();
      expect(alte.ledger).toHaveLength(1);

      // Dieselbe Slot-Nummer, aber eine neue Besetzung: andere Session ODER anderes openedAt.
      const neue = welt("direkt", { ledger: alte.ledger, ...neu });
      await neustart(neue);
      expect(neue.api.postfachAttempted.size).toBe(0);
      await neue.tick();
      expect(neue.sends).toHaveLength(0);
      expect(neue.rows[0]!.readBy).toEqual({ slot: 29, openedAt: 100, sessionId: "session-a" });
    });
  }

  test("Nachfolge im laufenden Prozess: Getipptes bleibt bei der Vorgängerin, Neues und nie Getipptes kommt an", async () => {
    const w = welt("direkt");
    w.acceptNext("not-observed");
    await w.tick();
    expect(w.sends).toHaveLength(1);
    expect(w.rows[0]!.readBy).toBeNull();
    expect(w.api.postfachAttempted.get(29)?.ids.has("m1")).toBe(true);
    // m0 an die Vorgängerin erreicht ihre Pane nie: die Nachfolge kommt vor dem nächsten Takt
    w.rows.push({ ...structuredClone(w.rows[0]!), id: "m0", at: Date.now() });

    // die Nachfolge: dieselbe Slot-Nummer, neue Besetzung, und eine neue Nachricht an sie
    w.slot.openedAt = 200;
    w.slot.sessionId = "session-b";
    w.rows.push({ ...structuredClone(w.rows[0]!), id: "m2", at: Date.now(), to: { kind: "session", slot: 29, openedAt: 200 } });
    advance();
    await w.tick();
    expect(w.sends).toHaveLength(2);
    const [m1, m0, m2] = w.rows;
    expect(m1!.readBy).toEqual({ slot: 29, openedAt: 100, sessionId: "session-a" });
    expect(m0!.readBy).toEqual({ slot: 29, openedAt: 200, sessionId: "session-b" });
    expect(m2!.readBy).toEqual({ slot: 29, openedAt: 200, sessionId: "session-b" });
    await w.tick();
    expect(w.sends).toHaveLength(2);
  });

  // W3 Auftrag 17, W16-4: als gelesen gilt nur, was in der Pane STAND. Ein zurückgerollter Paste („cleared“) und ein Wurf vor
  // dem Tippen sind nur ein Vielleicht: dieselbe Besetzung bekommt sie nicht noch einmal, ihre Nachfolgerin schon.
  for (const [wie, fehler] of [
    ["ein zurückgerollter Paste", new SendNotAccepted("prompt not submitted — Fleet's own paste was cleared")],
    ["ein Wurf", new Error("tmux: can't find pane: %41")],
  ] as const) {
    test(`Nachfolge nach ${wie}: die Nachfolgerin bekommt die Nachricht, im Prozess und nach einem Neustart`, async () => {
      const w = welt("direkt");
      w.failNext(fehler);
      await w.tick();
      expect(w.sends).toHaveLength(1);
      expect(w.rows[0]!.readBy).toBeNull();
      advance();
      await w.tick();
      expect(w.sends).toHaveLength(1); // dieselbe Besetzung: kein zweites Tippen
      expect(w.ledger).toHaveLength(1);

      const neu = welt("direkt", { ledger: w.ledger, sessionId: "session-b", openedAt: 200 });
      await neustart(neu);
      await neu.tick();
      expect(neu.sends).toHaveLength(1);
      expect(neu.rows[0]!.readBy).toEqual({ slot: 29, openedAt: 200, sessionId: "session-b" });

      w.slot.openedAt = 200;
      w.slot.sessionId = "session-b";
      advance();
      await w.tick();
      expect(w.sends).toHaveLength(2);
      expect(w.rows[0]!.readBy).toEqual({ slot: 29, openedAt: 200, sessionId: "session-b" });
    });
  }

  // S5 der Prüfung: dieselbe Besetzung lernt ihre Session-Id erst nach dem Tippen. Sie ist nicht beendet: was stand, gilt als ihr gelesen
  // (wie bisher), und ein Vielleicht wird ihr nicht noch einmal getippt.
  for (const [wie, vorher] of [["getippt", "acceptNext"], ["ein Vielleicht", "failNext"]] as const) {
    test(`S5: die Session-Id kommt nach dem Tippen (${wie}): kein zweites Tippen in dieselbe Pane`, async () => {
      const w = welt("direkt", { sessionId: null });
      w.slot.selfToken = "tok-a";
      if (vorher === "acceptNext") w.acceptNext("unobservable");
      else w.failNext(new SendNotAccepted("prompt not submitted — Fleet's own paste was cleared"));
      await w.tick();
      expect(w.sends).toHaveLength(1);
      w.slot.sessionId = "session-a";
      advance();
      await w.tick();
      expect(w.sends).toHaveLength(1);
      expect(w.rows[0]!.readBy).toEqual(vorher === "acceptNext" ? { slot: 29, openedAt: 100, sessionId: null } : null);
    });
  }

  test("S5 über einen Neustart: ein Vielleicht derselben Pane, die inzwischen ihre Session-Id kennt, wird ihr nicht noch einmal getippt", async () => {
    const vorher = welt("direkt", { sessionId: null });
    vorher.slot.selfToken = "tok-a";
    vorher.failNext(new SendNotAccepted("prompt not submitted — Fleet's own paste was cleared"));
    await vorher.tick();
    expect(vorher.ledger).toHaveLength(1);
    const nachher = welt("direkt", { sessionId: "session-a", ledger: vorher.ledger });
    nachher.slot.selfToken = "tok-a";
    await neustart(nachher);
    await nachher.tick();
    expect({ sends: nachher.sends.length, readBy: nachher.rows[0]!.readBy }).toEqual({ sends: 0, readBy: null });
  });

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
