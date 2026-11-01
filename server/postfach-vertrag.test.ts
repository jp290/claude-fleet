import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mainLoadMessages, type MainLoad } from "./main-lader.fixtures";
import { MESSAGES_MAX, loadMessages } from "./types";
import { VORLAGEN, VORLAGE_STANDARD, erlaubtDurch, gegenseiten, gegenseitenZeilen, istFremdeSessionHuelle, regelnSatz, ringKuerzen,
  ringAnhaengen, ringFuerPlatte, droppedUnreadVonPlatte, geschichteLuecke, MESSAGES_DROPPED_UNREAD_KEY } from "./postfach-vertrag";

const streng = VORLAGEN[VORLAGE_STANDARD]!;

describe("die Vorlage „streng“ trägt die fünf Regeln, die das Postfach bis W1 im Code hatte", () => {
  test("Reihenfolge: Orchestratorin, Kante, Claude-Paar, Branch-Paar, Ordner-Paar", () => {
    expect(streng.name).toBe("streng");
    expect(streng.regeln.map((r) => r.art)).toEqual(["orchestrator", "kante", "claude-paar", "branch-paar", "ordner-paar"]);
  });
  test("der Satz für die ablehnende Tür entsteht aus den Regeln und nennt jede", () => {
    const satz = regelnSatz(streng);
    for (const r of streng.regeln) expect(satz).toContain(r.text);
    expect(satz).toContain("an unbound session may address only the Orchestrator");
  });
});

describe("dieselben Zeugen beantworten „darf ich?“ und „wen darf ich?“", () => {
  test("die erste Regel in der Reihenfolge der Vorlage erlaubt; ohne Zeugen oder bei Nein erlaubt keine", async () => {
    expect(await erlaubtDurch(streng, { "ordner-paar": () => true, kante: () => true })).toBe("kante");
    expect(await erlaubtDurch(streng, { "branch-paar": async () => true })).toBe("branch-paar");
    expect(await erlaubtDurch(streng, { "claude-paar": () => false })).toBeNull();
    expect(await erlaubtDurch(streng, {})).toBeNull();
  });
  test("die Liste „Arbeitet mit“ enthält genau die Ziele, für die das Senden erlaubt", async () => {
    const ziele = [{ slot: 5, regel: "ordner-paar" as const }, { slot: 6, regel: null }, { slot: 7, regel: "kante" as const }];
    const zeugenFuer = (z: { slot: number; regel: string | null }) => ({ [z.regel ?? "keine"]: () => z.regel !== null }) as never;
    const liste = await gegenseiten(streng, ziele, zeugenFuer, (z) => ({ slot: z.slot, rolle: null, label: null, beziehung: "x" }));
    expect(liste.map((g) => [g.slot, g.regel])).toEqual([[5, "ordner-paar"], [7, "kante"]]);
    const jedes = await Promise.all(ziele.map(async (z) => (await erlaubtDurch(streng, zeugenFuer(z))) !== null));
    expect(jedes).toEqual([true, false, true]);
    const zeilen = gegenseitenZeilen(streng, liste);
    expect(zeilen[0]).toContain("template streng");
    expect(zeilen.join("\n")).toContain("slot 5");
    expect(zeilen.join("\n")).not.toContain("slot 6");
  });
  test("ohne erlaubte Gegenseite sagt die Zeile es und nennt trotzdem die Regeln", () => {
    const zeilen = gegenseitenZeilen(streng, []);
    expect(zeilen[0]).toContain("no seat now");
    expect(zeilen.at(-1)).toContain(streng.regeln[0]!.text);
  });
});

describe("eine Nachricht einer anderen Session ist nie Owner-Eingabe (Mangel 80)", () => {
  test("die Hülle mit Attributen, ruhend und eingereiht, wird erkannt; Owner-Wort nicht", () => {
    expect(istFremdeSessionHuelle('<cross-session-message from-name="w1">\nhallo\n</cross-session-message>')).toBe(true);
    expect(istFremdeSessionHuelle('Another Claude session sent a message:\n<cross-session-message from-name="w1">\nhallo')).toBe(true);
    expect(istFremdeSessionHuelle('<agent-message name="x">ok</agent-message>')).toBe(true);
    expect(istFremdeSessionHuelle("ein Satz ohne Hülle da")).toBe(false);
    expect(istFremdeSessionHuelle("<b>fett</b> ist kein Fremdtext")).toBe(false);
  });
  // die drei Vorsätze, die Claude Code 2.1.316 laut Binary schreibt; der zweite steht als meta-Zeile in einem echten Transkript dieses Macs
  const VORSAETZE = ["Another Claude session sent a message:", "Another Claude session sent a message while you were working:",
    "A peer session sent a message while you were working:"];
  test("jeder Vorsatz vor jeder Hülle ist eine andere Session, und Owner-Text, der sie nur nennt, bleibt seiner", () => {
    for (const v of VORSAETZE) {
      expect(istFremdeSessionHuelle(`${v}\n<agent-message from="a0000000000000001">\nbericht\n</agent-message>`)).toBe(true);
      expect(istFremdeSessionHuelle(`${v}\n<cross-session-message from-name="w1">\nhallo\n</cross-session-message>`)).toBe(true);
      expect(istFremdeSessionHuelle(`${v} bitte prüf das`)).toBe(false);
    }
    expect(istFremdeSessionHuelle("please look at <agent-message> parsing")).toBe(false);
  });
});

describe("der Ring lässt zuerst tote Post, dann Gelesenes, zuletzt Ungelesenes fallen — und zählt nur das Letzte", () => {
  type Z = { id: number; readBy: unknown; tot: boolean };
  const z = (id: number, o: Partial<Z> = {}): Z => ({ id, readBy: null, tot: false, ...o });
  const tot = (e: Z) => e.tot;
  test("tote ungelesene Post geht vor Gelesenem, und der Zähler bleibt 0", () => {
    const r = ringKuerzen([z(1, { readBy: {} }), z(2, { tot: true }), z(3), z(4)], 3, tot);
    expect(r.entries.map((e) => e.id)).toEqual([1, 3, 4]);
    expect(r).toMatchObject({ dropped: 1, droppedUnread: 0 });
  });
  test("ohne Tote geht das Gelesene zuerst", () => {
    const r = ringKuerzen([z(1), z(2, { readBy: {} }), z(3)], 2, tot);
    expect(r.entries.map((e) => e.id)).toEqual([1, 3]);
    expect(r.droppedUnread).toBe(0);
  });
  test("sind alle lebend und ungelesen, fällt die älteste, und nur das zählt als verlorene ungelesene Post", () => {
    const r = ringKuerzen([z(1), z(2), z(3)], 2, tot);
    expect(r.entries.map((e) => e.id)).toEqual([2, 3]);
    expect(r).toMatchObject({ dropped: 1, droppedUnread: 1 });
  });
  test("die neue Zeile geht nie zuerst, auch wenn ihr Empfänger schon weg ist", () => {
    const neu = z(9, { tot: true });
    const r = ringKuerzen([z(1, { tot: true }), neu], 1, tot, neu);
    expect(r.entries).toEqual([neu]);
  });
  test("ein Ring mit 148 toten Zeilen und 52 lebenden verdrängt beim 201. nichts Ungelesenes", () => {
    const alt = [...Array.from({ length: 148 }, (_, i) => z(i, { tot: true })), ...Array.from({ length: 52 }, (_, i) => z(1000 + i))];
    let ring = alt;
    for (let i = 0; i < 34; i++) ring = ringKuerzen([...ring, z(2000 + i)], MESSAGES_MAX, tot).entries;
    expect(ring.filter((e) => !e.tot).length).toBe(52 + 34);
    expect(ring.length).toBe(MESSAGES_MAX);
  });
});

// RÜCKWEG (Prüfung W1, Befund 4a): ein Ring aus 200 ungelesenen Zeilen an einen lebenden Empfänger plus eine schrieb bisher
// {v, entries, dropped, droppedUnread}; main 491bcd016 lehnt das ab, bootet mit leerem Postfach und überschreibt beim nächsten
// Speichern die ganze Post. Der Test lädt main's eigenen Lader aus git und lässt ihn lesen, was dieser Stand auf die Platte schreibt.
describe("ein Rückweg auf main 491bcd016 behält das Postfach: der Zähler steht neben dem Ring", () => {
  let mainLoad: MainLoad;
  let cleanup = () => {};
  beforeAll(async () => { ({ load: mainLoad, cleanup } = await mainLoadMessages()); });
  afterAll(() => cleanup());

  const zeile = (i: number) => ({ id: i.toString(16).padStart(24, "0"), from: { kind: "session", slot: 2, openedAt: 1 },
    to: { kind: "role", role: "orchestrator" }, at: 1_790_000_000_000 + i, payload: { kind: "text", text: `n${i}` },
    idempotencyKey: `k${i}`, replyTo: null, readBy: null, readAt: null });

  test("200 ungelesene an einen lebenden Empfänger plus eine: main liest den Record ganz, und der Zähler kommt zurück", () => {
    const voll = loadMessages({ v: 1, entries: Array.from({ length: MESSAGES_MAX }, (_, i) => zeile(i)), dropped: 0 });
    if (!voll.ok) throw new Error(voll.error);
    const next = ringAnhaengen(voll.messages, 0, zeile(MESSAGES_MAX) as never, MESSAGES_MAX, () => false);
    expect(next.droppedUnread).toBe(1);
    const platte = JSON.parse(JSON.stringify(ringFuerPlatte(next.ring, next.droppedUnread))) as Record<string, unknown>;
    const alt = mainLoad(platte.messages);
    expect(alt.error).toBeUndefined();
    expect(alt.ok).toBe(true);
    expect(alt.messages?.entries.length).toBe(MESSAGES_MAX);
    expect(alt.messages?.dropped).toBe(1);
    // dieser Stand liest denselben Record und den Zähler daneben
    const neu = loadMessages(platte.messages);
    expect(neu.ok).toBe(true);
    expect(droppedUnreadVonPlatte(platte[MESSAGES_DROPPED_UNREAD_KEY], 1)).toEqual({ wert: 1, fehler: null });
    // Gegenprobe, dass main's Lader wirklich streng ist: die Form des Vorgängers lehnt er ab
    expect(mainLoad({ ...(platte.messages as object), droppedUnread: 1 }).ok).toBe(false);
  });
  test("ohne Verlust trägt der Zustand keinen neuen Schlüssel", () => {
    expect(ringFuerPlatte({ v: 1, entries: [], dropped: 3 }, 0)).toEqual({ messages: { v: 1, entries: [], dropped: 3 } });
  });
});

describe("der Zähler der verdrängten ungelesenen Post beim Boot", () => {
  test("fehlt er, ist er 0; ein stimmiger Wert bleibt", () => {
    expect(droppedUnreadVonPlatte(undefined, 5)).toEqual({ wert: 0, fehler: null });
    expect(droppedUnreadVonPlatte(2, 5)).toEqual({ wert: 2, fehler: null });
  });
  test("unlesbar oder größer als dropped: jede verdrängte Zeile gilt als möglicherweise ungelesen, und der Fehler wird genannt", () => {
    for (const roh of [6, -1, 1.5, "2", null]) {
      const r = droppedUnreadVonPlatte(roh, 5);
      expect(r.wert).toBe(5);
      expect(r.fehler).toContain("messagesDroppedUnread");
    }
  });
});

// Befund 4b: fielen nur gelesene oder tote Zeilen aus dem Ring, ist die Zahl der ungelesenen echt — aber die Liste ist nicht mehr die
// ganze Geschichte, und das muss die Ansicht sagen, in einem eigenen Feld neben `unknown`.
describe("die Ansicht sagt, dass die Geschichte unvollständig ist, sobald eine Zeile den Ring verließ", () => {
  test("nichts verdrängt: kein Satz", () => expect(geschichteLuecke(0, 0, MESSAGES_MAX)).toEqual([]));
  test("nur gelesene oder tote verdrängt: die Liste ist unvollständig, ungelesene Post fehlt keine", () => {
    const [satz] = geschichteLuecke(3, 0, MESSAGES_MAX);
    expect(satz).toContain("3 messages have fallen off");
    expect(satz).toContain("not the whole history");
    expect(satz).toContain("no unread mail is missing");
  });
  test("auch ungelesene verdrängt: der Satz nennt sie", () => {
    expect(geschichteLuecke(3, 1, MESSAGES_MAX)[0]).toContain("1 of them left unread while their receiver still lived");
  });
});
