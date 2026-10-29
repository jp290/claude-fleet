// EINE QUITTUNG LÖSCHT DIE SPERRE, und ein Record mit beiden lädt (Leitung 29.10.: „[Zitat entfernt]“). Der Fehler: stampMessageRead setzte readBy und ließ `delivery` stehen; der Loader lehnte die Zeile ab, und
// loadMessages ist alles-oder-nichts — ein Sitz, der Post mit ?unread=1&read=1 holte, nachdem sie als nicht zugestellt
// vermerkt war, kostete beim Neustart das ganze Postfach. Zwei Seiten, beide geprüft: der Loader verwirft die Sperre an
// einem quittierten Eintrag still, und die Quittung selbst räumt sie (die Tür, am echten Record).
import { describe, expect, test } from "bun:test";
import { loadMessageEntry, loadMessages } from "./types";
import { postfachHindernis } from "./postfach-befund";

const ID = "0123456789abcdef01234567";
const hindernis = postfachHindernis("busy", 3, 1_700_000_000_000);
const zeile = (extra: Record<string, unknown>): Record<string, unknown> => ({
  id: ID, from: { kind: "session", slot: 2, openedAt: 1_000 }, to: { kind: "session", slot: 3, openedAt: 1_000 },
  at: 1_700_000_000_000, payload: { kind: "text", text: "kommt das an?" }, idempotencyKey: "k1", replyTo: null,
  readBy: null, readAt: null, ...extra,
});
const quittiert = { readBy: { slot: 3, openedAt: 1_000, sessionId: null }, readAt: 1_700_000_100_000 };

describe("eine Sperre an einer quittierten Nachricht", () => {
  test("der Loader lädt den Eintrag und lässt die Sperre weg, statt das ganze Postfach zu verwerfen", () => {
    const r = loadMessages({ v: 1, dropped: 0, entries: [zeile({ ...quittiert, delivery: hindernis }), zeile({ id: "fedcba987654321001234567", idempotencyKey: "k2" })] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.messages.entries.length).toBe(2);
    const first = r.messages.entries[0]!;
    expect(first.readBy?.slot).toBe(3);
    expect("delivery" in first).toBe(false);
  });

  test("eine Sperre an einer UNGELESENEN Nachricht bleibt stehen", () => {
    const e = loadMessageEntry(zeile({ delivery: hindernis }), 0);
    expect(typeof e).not.toBe("string");
    expect((e as { delivery?: unknown }).delivery).toEqual(hindernis);
  });

  test("eine kaputte Sperre an einer quittierten Nachricht ist weiter ein kaputter Eintrag", () => {
    const e = loadMessageEntry(zeile({ ...quittiert, delivery: { state: "not-delivered" } }), 0);
    expect(typeof e).toBe("string");
  });
});
