// Ein gehaltenes Event wird nach dem Leeren des Composers innerhalb der Decke erneut geprobt
// (server.ts#holdBackoffMs). Die Prüfung in e2e/watch.ts liest das aus den Zeilen des Servers und
// zählt nicht mit, was Fleet vorher anderes in dieselbe Pane tippt. Die Zeiten der zwei roten
// Merge-Checks stehen hier relativ zur ersten Zeile; Decke und Spielraum wie im Lauf (Tick 250 ms).
import { describe, expect, test } from "bun:test";
import { holdCeiling, type HoldRow } from "../e2e/hold-ceiling";

const TICK = 250;
const CAP = TICK * 12;
const SLACK = TICK * 4 + 2000;
const ID = "f131dda8a8f3831c2d8de686";
const PANE = 6;

const probe = (ts: number, phase: string, nextProbeInMs: number): HoldRow =>
  ({ event: "fleet_event_held", slot: PANE, ts, detail: `${ID} composer occupied (45 chars) — nothing typed`, phase, nextProbeInMs });
const end = (ts: number): HoldRow =>
  ({ event: "fleet_event_held", slot: PANE, ts, detail: `${ID} hold ended — the composer cleared and Fleet typed into it`, phase: "end", nextProbeInMs: 0 });
// was der Server schreibt, wenn er ein ANDERES Event in die Pane getippt hat (hier das Audit-Bündel)
const other = (ts: number, slot = PANE): HoldRow[] => [
  { event: "fleet_event_held", slot, ts, detail: "ca2109541459a1f34854108e hold ended — the composer cleared and Fleet typed into it", phase: "end" },
  { event: "fleet_event_send_uncertain", slot, ts, detail: "bundle=ca2109541459a1f34854108e,7368b438573e39d0056272fa acceptance unobservable" }];
// die send-Zeile nennt kein Event
const send = (ts: number): HoldRow => ({ event: "send", slot: PANE, ts, detail: "fleet-event 830B observed" });
// die sechs Proben aus 1024100528-bb69cdaf: 500, 1000, 2000 und dann die Decke
const held = (last = 11905, lastWait = CAP): HoldRow[] => [probe(326, "entry", 500), probe(1144, "repeat", 1000),
  probe(2314, "repeat", 2000), probe(4572, "repeat", 3000), probe(7825, "repeat", 3000), probe(last, "repeat", lastWait)];
const verdict = (rows: HoldRow[], releaseAt: number) =>
  holdCeiling({ rows, eventId: ID, receiverSlot: PANE, releaseAt, capMs: CAP, slackMs: SLACK });

describe("der Server hält die Decke", () => {
  test("1024100528-bb69cdaf: erst tippt Fleet das Audit-Bündel in die Pane, dann dieses Event", () => {
    const v = verdict([...held(), ...other(17762), send(18354), end(18354)], 11950);
    expect(v.ok).toBe(true);
    expect(v.typedBefore).toEqual([17762, 17762]);
    // die alte Wanduhr-Grenze hätte hier rot gesagt
    expect(18354 - 11950).toBeGreaterThan(CAP + SLACK);
  });

  test("1024042626-67bb3141: dasselbe Muster", () => {
    expect(verdict([...held(), ...other(17926), send(18902), end(18903)], 11955).ok).toBe(true);
  });

  test("ohne andere Zustellung kommt das Ende eine Sendung nach der Fälligkeit", () => {
    expect(verdict([...held(), end(11905 + CAP + 600)], 11950).ok).toBe(true);
  });
});

describe("die Prüfung bleibt rot, wo die Decke bricht", () => {
  test("ein Backoff über die Decke hinaus (ungedeckelt wären es 16 s bei der sechsten Probe)", () => {
    const v = verdict([...held(11905, 16000), end(11905 + 16000 + 600)], 11950);
    expect(v.ok).toBe(false);
    expect(v.why).toBe("the promised probe lies past the ceiling");
  });

  test("eine Probe, die ihre Fälligkeit um einen ganzen Zyklus verpasst", () => {
    expect(verdict([...held(), end(11905 + CAP + CAP + 600)], 11950).why).toBe("the probe came late");
  });

  test("eine Abweisung nach dem Leeren", () => {
    expect(verdict([...held(), probe(14905, "repeat", CAP), end(15500)], 11950).why)
      .toBe("the cleared composer was refused again");
  });

  test("Getipptes in eine andere Pane zählt nicht", () => {
    expect(verdict([...held(), ...other(17762, 7), end(18354)], 11950).ok).toBe(false);
  });

  test("die eigene send-Zeile eine Millisekunde vor dem Ende entschuldigt nichts (1024042626-67bb3141)", () => {
    expect(verdict([...held(), send(18902), end(18903)], 11955).why).toBe("the probe came late");
  });

  test("Getipptes nach dem Ende entschuldigt keine späte Probe", () => {
    expect(verdict([...held(), end(11905 + CAP + CAP + 600), ...other(11905 + CAP + CAP + 900)], 11950).why)
      .toBe("the probe came late");
  });

  test("ein Hold, der nie endet", () => {
    expect(verdict(held(), 11950).why).toBe("the hold never ended");
  });
});
