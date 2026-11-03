// Die reine Logik der Postfach-Zustellung (server/postfach-zustellen.ts): was in eine Zustellung
// kommt, wann sie fällig ist und was quittiert wird. Kein Server, keine Pane, keine Uhr.
import { describe, expect, test } from "bun:test";
import {
  POSTFACH_BODY_PREFIX, isDirectPostfachTarget, planPostfachDelivery, postfachEntryText, postfachFleetNoteKey, postfachFromSeat,
  postfachReceiptIds, type PostfachEntry, type PostfachTarget,
} from "./postfach-zustellen";

const now = 1_000_000;
const entry = (id: string, at: number, text: string, target: PostfachTarget = {
  kind: "session", slot: 7, openedAt: 100,
}, from = "Session Slot 3"): PostfachEntry => ({ id, at, text, target, from });

describe("Postfach-Zustellung: was direkt kommt und was im Bündel bleibt", () => {
  test("direkt sind Session, Lane und Rolle — ein Program bleibt beim gebündelten Hinweis", () => {
    expect(isDirectPostfachTarget({ kind: "session", slot: 7, openedAt: 100 })).toBe(true);
    expect(isDirectPostfachTarget({ kind: "lane", slot: 9, openedAt: 200 })).toBe(true);
    expect(isDirectPostfachTarget({ kind: "role", role: "orchestrator" })).toBe(true);
    expect(isDirectPostfachTarget({ kind: "program", id: "a".repeat(24) })).toBe(false);

    const plan = planPostfachDelivery([
      entry("program-message", now - 120_000, "nur ein Programm", { kind: "program", id: "a".repeat(24) }),
      entry("session-message", now - 120_000, "an die Session"),
    ], now, { windowMs: 60_000, maxChars: 8_000 });
    expect(plan?.entries.map((e) => e.id)).toEqual(["session-message"]);
  });

  test("das Fenster ist eine Minute ab dem ältesten Eingang; vorher ist nichts fällig, danach alles, was in ihm ankam", () => {
    const fresh = [entry("a", now - 59_999, "A")];
    expect(planPostfachDelivery(fresh, now, { windowMs: 60_000, maxChars: 8_000 })).toBeNull();
    const due = [entry("a", now - 60_000, "A"), entry("b", now - 10_000, "B")];
    const plan = planPostfachDelivery(due, now, { windowMs: 60_000, maxChars: 8_000 });
    expect(plan?.dueAt).toBe(now);
    expect(plan?.entries.map((e) => e.id)).toEqual(["a", "b"]);
  });

  test("ein Rückstand nach dem Neustart ist sofort fällig, nicht noch einmal eine Minute", () => {
    const plan = planPostfachDelivery([entry("old", now - 3_600_000, "von vor einer Stunde")], now,
      { windowMs: 60_000, maxChars: 8_000 });
    expect(plan?.entries.map((e) => e.id)).toEqual(["old"]);
    expect(plan?.dueAt).toBe(now - 3_600_000 + 60_000);
  });
});

describe("Postfach-Zustellung: der Wortlaut einer Zustellung", () => {
  test("jeder Eintrag trägt Kennung, Absender und den vollen Text, mehrere in einer Zustellung mit einer Trennzeile", () => {
    const a = entry("aaaa", now - 90_000, "erste Zeile\nzweite Zeile", undefined, "Orchestrator");
    const b = entry("bbbb", now - 80_000, "und danach", { kind: "lane", slot: 4, openedAt: 9 });
    expect(postfachEntryText(a)).toBe(`${POSTFACH_BODY_PREFIX} aaaa from Orchestrator\n\nerste Zeile\nzweite Zeile`);
    const plan = planPostfachDelivery([a, b], now, { windowMs: 60_000, maxChars: 8_000 });
    expect(plan?.text).toBe(`${postfachEntryText(a)}\n\n${postfachEntryText(b)}`);
    expect(plan?.text).toContain("erste Zeile\nzweite Zeile");
    expect(plan?.text).toContain("bbbb from Session Slot 3");
  });

  test("die Grenze einer Zustellung: so viele älteste Nachrichten wie hineinpassen, eine immer, der Rest wartet auf den nächsten Takt", () => {
    const big = "x".repeat(2_000);
    const entries = ["a", "b", "c", "d", "e"].map((id, i) => entry(id, now - 120_000 + i, big));
    const plan = planPostfachDelivery(entries, now, { windowMs: 60_000, maxChars: 8_000 });
    // 2 000 Text + Absenderkopf je Eintrag: drei passen in 8 000, der vierte nicht
    expect(plan?.entries.map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(plan!.text.length).toBeLessThanOrEqual(8_000);

    const only = planPostfachDelivery([entry("one", now - 120_000, "y".repeat(2_000))], now,
      { windowMs: 60_000, maxChars: 100 });
    expect(only?.entries.map((e) => e.id)).toEqual(["one"]);
  });

  test("eine bereits getippte Kennung wird nicht noch einmal angeboten; eine neue Nachricht geht allein", () => {
    const skip = new Set(["old"]);
    expect(planPostfachDelivery([entry("old", now - 120_000, "schon getippt")], now,
      { windowMs: 60_000, maxChars: 8_000, skip })).toBeNull();
    const plan = planPostfachDelivery([
      entry("old", now - 120_000, "schon getippt"),
      entry("new", now - 120_000, "neu"),
    ], now, { windowMs: 60_000, maxChars: 8_000, skip });
    expect(plan?.entries.map((e) => e.id)).toEqual(["new"]);
  });
});

describe("Postfach-Zustellung: die Quittung", () => {
  test("nur eine beobachtete Annahme quittiert, und dann genau die Einträge dieser Zustellung", () => {
    const entries = [entry("a", now, "A"), entry("b", now, "B")];
    expect(postfachReceiptIds(entries, "observed")).toEqual(["a", "b"]);
    expect(postfachReceiptIds(entries, "unobservable")).toEqual([]);
    expect(postfachReceiptIds(entries, "not-observed")).toEqual([]);
    expect(postfachReceiptIds(entries, "not-applicable")).toEqual([]);
  });
});

// Auftrag 2, Punkt 4: wessen Nachricht die Zeile zwischen zwei Aufträgen bringt. Nur Arbeit von einem anderen Sitz; ein Wort des Owners
// und Fleets eigene Notizen (Kantensatz, Warte-Notiz) tragen keine.
describe("Postfach-Zustellung: von einem Sitz, nicht vom Owner und nicht von Fleets eigenen Notizen", () => {
  const text = (id: string, von: string) => postfachEntryText(entry(id, 1, "text", undefined, von));
  const note = new Set(["note1", "note2"]);
  test("die Schlüssel, unter denen Fleet seine Notizen schreibt, und kein anderer", () => {
    expect(postfachFleetNoteKey("kante:0123456789abcdef:auf:4")).toBe(true);
    expect(postfachFleetNoteKey("kante:0123456789abcdef:zu:12")).toBe(true);
    expect(postfachFleetNoteKey("warte-hinweis:5:1791100005:1791100000")).toBe(true);
    for (const k of ["ctl-seat-ab12", "kante:", "kante:x:auf:4:5", "warte-hinweis:5:6", "xkante:a:b:1", "warte-hinweis:a:b:c", "kante:x:auf:4\nx"])
      expect({ k, note: postfachFleetNoteKey(k) }).toEqual({ k, note: false });
  });
  test("ein Auftrag von einem Sitz ist von einem Sitz; Owner und Notizen allein sind es nicht, ein Auftrag neben ihnen schon", () => {
    const istNote = (id: string) => note.has(id);
    const faelle = [
      { fall: "Sitz", an: postfachFromSeat(text("a1", "Session Slot 3"), istNote), soll: true },
      { fall: "Orchestratorin", an: postfachFromSeat(text("a1", "Orchestrator"), istNote), soll: true },
      { fall: "Program", an: postfachFromSeat(text("a1", "Program abc"), istNote), soll: true },
      { fall: "Owner", an: postfachFromSeat(text("a1", "Owner"), istNote), soll: false },
      { fall: "Notiz der Orchestratorin", an: postfachFromSeat(text("note1", "Orchestrator"), istNote), soll: false },
      { fall: "Notiz eines Sitzes", an: postfachFromSeat(text("note2", "Session Slot 5"), istNote), soll: false },
      { fall: "Owner und Notiz", an: postfachFromSeat(`${text("a1", "Owner")}\n\n${text("note1", "Orchestrator")}`, istNote), soll: false },
      { fall: "Notiz und Auftrag", an: postfachFromSeat(`${text("note1", "Orchestrator")}\n\n${text("a1", "Session Slot 3")}`, istNote), soll: true },
      { fall: "ohne Kopf: die alte Seite", an: postfachFromSeat("freier Text", istNote), soll: true },
      { fall: "ohne Notiz-Frage: jede Marke zählt", an: postfachFromSeat(text("note1", "Orchestrator")), soll: true },
    ];
    expect(faelle.map(({ fall, an }) => ({ fall, an }))).toEqual(faelle.map(({ fall, soll }) => ({ fall, an: soll })));
  });
});
