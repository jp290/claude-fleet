// src/pending-takeback.ts: eine Blase, die nie ankommt, kann zurück in den Composer (Brief
// 2026-10-29, Ziel 4). Die Blase des Composers wartet, bis der Verlauf die Sendung bringt
// (settlePending) oder die Warteschlange der Session sie nennt (syncQueue gibt ihr einen key).
// Geschieht beides nicht — die Pane stand mitten im Neustart und hält den Text ungesendet
// (docs/messungen/2026-10-03-terminal-vs-chat-warten.md §7) —, wartet sie für immer. Die Regel:
// QUEUE_LEFT_MS (5 s) nach dem ersten Warteschlangen-Sync, der die Sendung nicht nennt — dieselbe
// Frist, nach der heute eine genannte Blase fällt, deren Eintrag die Warteschlange verlassen hat.
import { describe, expect, test } from "bun:test";
import { pendingTakeBack } from "./pending-takeback";

const GRACE = 5_000; // QUEUE_LEFT_MS in src/client.ts

describe("pending-takeback: eine Blase, die nie ankommt", () => {
  test("eine Blase, die die Warteschlange nennt, geht nicht zurück — sie wartet dort", () => {
    expect(pendingTakeBack({ key: "2026-10-29T07:00:00.000Z#0\ntext", leftAt: 1_000 }, 99_000, GRACE)).toBe(false);
  });
  test("innerhalb der Frist geht sie noch nicht: die Warteschlange hat Zeit, sie zu nennen", () => {
    expect(pendingTakeBack({ leftAt: 4_000 }, 8_999, GRACE)).toBe(false); // die letzte Sekunde der Frist
    expect(pendingTakeBack({}, 99_000, GRACE)).toBe(false); // noch nie vom Sync gesehen
  });
  test("nach der Frist ohne Eintrag in Warteschlange oder Verlauf kann der Owner sie zurückholen", () => {
    expect(pendingTakeBack({ leftAt: 4_000 }, 9_001, GRACE)).toBe(true);
  });
});
