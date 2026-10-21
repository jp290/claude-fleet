// Der Postfach-Takt nach einem gescheiterten Versuch (Auftrag „Eine Postfach-Nachricht, von der
// nichts getippt wurde, wird wieder angeboten“, branch/postfach-befund1).
//
// Kein Server, keine Pane, keine Uhr: der echte Takt-Abschnitt wird aus server.ts gehoben und mit
// Attrappen für sendText, canDeliver, messages und die Ledger ausgeführt — wie e2e/role-address.ts
// es für den Live-Takt tut. So prüft der Test die VERDRAHTUNG beider Wege, nicht eine Nachbildung:
//   · ein Wurf, der „nichts getippt“ nennt (SendRefused, im gebündelten Weg DeliveryGateDropped),
//     bleibt offen und wird nach einer Wartezeit wieder angeboten — nicht bei jedem Takt;
//   · ein Wurf, der getippt haben könnte (SendNotAccepted, sonstiges), bleibt gemerkt wie heute;
//   · ein dauerhaft unbereiter Slot wird weiter angeboten, schreibt aber nicht jeden Takt dieselbe
//     Zeile in server.log und das Prompt-Ledger.
import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const leaf = (name: string): string => {
  const path = join(ROOT, name);
  if (!existsSync(path)) return ""; // vor der Änderung gibt es das neue Blatt noch nicht
  return readFileSync(path, "utf8").replace(/^export /gm, "").replace(/^import .*$/gm, "");
};
const source = readFileSync(join(ROOT, "server.ts"), "utf8");
const section = (from: string, to: string): string => {
  const start = source.indexOf(from), end = source.indexOf(to, start);
  if (start < 0 || end < 0) throw new Error(`Postfach-Takt fehlt in server.ts: ${from} -> ${to}`);
  return source.slice(start, end);
};
const compiled = new Bun.Transpiler({ loader: "ts" }).transformSync([
  leaf("server/postfach-zustellen.ts"),
  leaf("server/zustellung.ts"),
  leaf("server/postfach-fehler.ts"),
  section("const postfachAttempted =", "// --- THE HINT AT THE THRESHOLD"),
].join("\n"));

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
type Occupant = { id: number; cwd: string; openedAt: number; sessionId: string;
  worktree: object | null; lastOutput: number; label: string; history: unknown[];
  selfToken?: string; zustellung?: "direkt" | "gebuendelt" };
type Send = { path?: string; deliveryClass?: string };
type Row = { session: string; ids: Set<string> };

function welt(weg: "direkt" | "gebuendelt") {
  const now = Date.now();
  const slot: Occupant = { id: 29, cwd: "/fixture/session", openedAt: 100, sessionId: "session-a",
    worktree: null, lastOutput: now - 10_000, label: "fixture", history: [], zustellung: weg };
  const rows: Message[] = [{ id: "m1", at: now - 120_000, readBy: null,
    payload: { kind: "text", text: "der ganze Wortlaut" },
    to: { kind: weg === "gebuendelt" ? "lane" : "session", slot: 29, openedAt: 100 },
    from: { kind: "session", slot: 3, openedAt: 90 } }];
  const sends: Send[] = [];
  const errors: string[] = [];
  const prompts: string[] = [];
  let errorCalls = 0;
  const printedErrors = new Set<string>();
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
    // wie server/errors.ts#logError: jede Sichtung zählt, gedruckt wird nur die erste je Signatur
    logError: (where: string, e: unknown) => {
      errorCalls++;
      const key = `${where}|${e instanceof Error ? e.message : String(e)}`;
      if (printedErrors.has(key)) return;
      printedErrors.add(key);
      errors.push(String(e));
    },
    logPrompt: (_s: Occupant, text: string, _source: string, _ts: number, _sendId: string | undefined,
      delivery?: string) => { prompts.push(`${delivery ?? ""}:${text}`); },
    stampMessageRead: (m: Message) => {
      if (m.readBy !== null) return false;
      m.readBy = { slot: 29, openedAt: 100, sessionId: "session-a" };
      return true;
    },
    saveStateNow: async () => {}, saveHistory: () => {}, MAX_HISTORY: 100,
  };
  const api = new Function("deps", `with (deps) { ${compiled}\nreturn { tickPostfachZustellung, postfachAttempted, postfachQueued }; }`)(deps) as {
    tickPostfachZustellung: () => Promise<void>;
    postfachAttempted: Map<number, Row>;
    postfachQueued: Map<number, Row>;
  };
  return {
    slot, rows, sends, errors, prompts, api,
    errorCalls: () => errorCalls,
    failNext: (e: Error) => { failure = e; repeat = false; },
    failAlways: (e: Error) => { failure = e; repeat = true; },
    tick: async () => { await api.tickPostfachZustellung(); await Bun.sleep(1); },
  };
}

const remembered = (w: ReturnType<typeof welt>, id: string): boolean =>
  w.api.postfachAttempted.get(29)?.ids.has(id) ?? false;

// Die Wartezeit wird nicht ausgesessen: die Uhr steht still und springt erst, wenn ein späterer
// Takt sie sehen soll. Fünf Minuten sind länger als jeder Versuch-Backoff und kürzer als die
// zehnminütige Ruhezeit des Prompt-Ledgers.
const advance = (ms = 5 * 60_000): void => { setSystemTime(new Date(Date.now() + ms)); };
afterEach(() => setSystemTime());

// Der Wurf, den der Weg in der Produktion wirklich wirft: direkt ist es ein blanker SendRefused
// (kein Gate im Bundle), gebündelt der Gate-Abbruch der Bundle-Zustellung.
const echterWurf = (weg: "direkt" | "gebuendelt"): Error => weg === "direkt"
  ? new SendRefused("slot pane unavailable or changed before send — nothing typed")
  : new DeliveryGateDropped("gate=no-agent — nothing typed");

describe("Postfach-Takt: was nach einem Fehlversuch offen bleibt", () => {
  for (const weg of ["direkt", "gebuendelt"] as const) {
    test(`${weg}: ein Versuch ohne Tippen bleibt offen und wird nach der Wartezeit wieder angeboten, ein möglicher Tipp bleibt gemerkt`, async () => {
      const w = welt(weg);
      // Der Slot ist nicht bereit: der Wurf nennt ausdrücklich „nothing typed“.
      w.failAlways(echterWurf(weg));
      await w.tick();
      expect(w.sends).toHaveLength(1);
      expect(remembered(w, "m1")).toBe(false);
      expect(w.rows[0]!.readBy).toBeNull();
      // Derselbe Takt kurz darauf wiederholt den Versuch nicht.
      await w.tick();
      expect(w.sends).toHaveLength(1);
      // Nach der Wartezeit ist dieselbe Nachricht wieder dran.
      advance();
      await w.tick();
      expect(w.sends).toHaveLength(2);
      expect(remembered(w, "m1")).toBe(false);

      // Jetzt ein Wurf, der getippt haben könnte: derselbe Text darf nicht zweimal landen.
      w.failNext(new SendNotAccepted("prompt not submitted — the composer still held part of the payload"));
      advance();
      await w.tick();
      expect(w.sends).toHaveLength(3);
      expect(remembered(w, "m1")).toBe(true);
      advance();
      await w.tick();
      expect(w.sends).toHaveLength(3);
    });

    test(`${weg}: sechs Takte innerhalb der Wartezeit versuchen dieselbe Nachricht höchstens einmal`, async () => {
      const w = welt(weg);
      w.failAlways(echterWurf(weg));
      for (let i = 0; i < 6; i++) await w.tick();
      expect(w.sends).toHaveLength(1);
      expect(w.errorCalls()).toBe(1);
    });

    test(`${weg}: ein dauerhaft unbereiter Slot schreibt dieselbe Zeile in keinem der beiden Ledger je Takt`, async () => {
      const w = welt(weg);
      w.failAlways(echterWurf(weg));
      for (let i = 0; i < 5; i++) await w.tick();
      expect(w.sends).toHaveLength(1);
      // der Fehlerkanal zählt jeden Versuch, druckt aber nur die erste Sichtung
      expect(w.errorCalls()).toBe(1);
      expect(w.errors).toHaveLength(1);
      expect(w.prompts).toHaveLength(1);
      expect(w.errors[0]).toContain("nothing typed");
      expect(w.prompts[0]).toContain("SendRefused:");

      // Nach der Wartezeit zählt der Fehlerkanal den neuen Versuch, das Prompt-Ledger schweigt
      // weiter, weil dieselbe Zeile noch in der Ruhezeit steht.
      advance();
      await w.tick();
      expect(w.sends).toHaveLength(2);
      expect(w.errorCalls()).toBe(2);
      expect(w.errors).toHaveLength(1);
      expect(w.prompts).toHaveLength(1);

      // Ein anderer Grund ist eine andere Zeile und wird sofort gesagt.
      w.failAlways(weg === "direkt"
        ? new SendRefused("slot unavailable for send — nothing typed")
        : new DeliveryGateDropped("gate=harness — nothing typed"));
      advance();
      await w.tick();
      expect(w.sends).toHaveLength(3);
      expect(w.errorCalls()).toBe(3);
      expect(w.errors).toHaveLength(2);
      expect(w.prompts).toHaveLength(2);
    });
  }

  test("direkt: ein wachsender Entwurf ist keine neue Zeile im Prompt-Ledger", async () => {
    const w = welt("direkt");
    // Die Park-Grenze ist voll, deshalb erreicht der belegte Composer die Fehlerentscheidung.
    w.failAlways(new SendComposerOccupied(42));
    await w.tick();
    expect(w.sends).toHaveLength(1);
    expect(w.prompts).toHaveLength(1);
    advance();
    // Derselbe Entwurf ist gewachsen: server.log nennt die neue Zahl, der Vergleichsschlüssel
    // der Bremse lässt sie weg.
    w.failAlways(new SendComposerOccupied(99));
    await w.tick();
    expect(w.sends).toHaveLength(2);
    expect(w.errorCalls()).toBe(2);
    expect(w.errors).toHaveLength(2);
    expect(w.prompts).toHaveLength(1);
  });
});
