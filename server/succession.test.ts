// Neuaufbau K9 · S1. Owner 13.10.: „[Zitat entfernt]“ — der Knopf sagt in einem Satz,
// was die Nachfolgerin bekommt („[Zitat entfernt]“ oder „[Zitat entfernt]“
// ). Bauleitung 13.10.: Die Einstellung gilt für die ganze Linie im Slot (Frage 2).
// S2, Owner 13.10.: „[Zitat entfernt]“ — ein Schalter, eine
// Entscheidung, warm/kalt aus dem Transkript. S2b, Owner 13.10.: „[Zitat entfernt]“
//  — der eigene Text des Warm-Turns, nur Text, ohne Zugangsdaten.
// S3, Owner 13.10.: „[Zitat entfernt]“
//  und
// „wieder mit Hinweisen arbeiten“: Schwelle je Art, der Hinweis an der Basis, die Handlung an der Obergrenze.
import { describe, expect, test } from "bun:test";
import { actDecision, agoText, betweenOrdersLine, DOOR_LINE, lineStaysInField, restingHandoverLine, ZWISCHEN_AUFTRAEGEN_PCT, ZWISCHEN_AUFTRAEGEN_MIN_TOKENS, autoCompactOff, cacheCooling, cacheView, choiceInput, choicesFor, fleetChoiceOf, handoverLines, HintLedger, hintText, MAX_NUDGES,
  onHandoverBand, orchestratorContextLine, ownSetting, REARM_SPENT, rearmStepOf, settingForSuccessor, successionBriefText, successorSentence, successorSpawnOf,
  thresholdOf, thresholdOffOf, thresholdStep, warmDecision, warmTextInput, type ActFacts, type HandoverFacts, type LaneNow, type SucceedPreviewFacts,
  type ThresholdChoice, type WarmFacts } from "./succession";
import { loadHandoverSetting, loadLineageHandover, type HandoverSetting, type LineageObligationRef } from "./types";

const setting = (slot: number, openedAt: number): HandoverSetting => ({ thresholdPct: 55, nudge: false, keepCache: true,
  keepCacheIdleMin: 45, keepCacheText: "Lies den Stand und antworte mit einem Satz.", atThreshold: "succeed", setAt: 1,
  occupant: { slot, openedAt } });

describe("die Einstellung der Linie", () => {
  test("die eigene Einstellung der gehenden Besetzung geht unverändert auf die Nachfolgerin über", () => {
    const own = ownSetting(setting(3, 100), { slot: 3, openedAt: 100 });
    const next = settingForSuccessor(own, { slot: 3, openedAt: 200 }, 999);
    expect(next).toEqual({ thresholdPct: 55, nudge: false, keepCache: true, keepCacheIdleMin: 45,
      keepCacheText: "Lies den Stand und antworte mit einem Satz.", atThreshold: "succeed", setAt: 999, occupant: { slot: 3, openedAt: 200 } });
  });
  test("eine Einstellung, die eine andere Besetzung nennt, geht nicht mit", () => {
    expect(ownSetting(setting(3, 100), { slot: 3, openedAt: 101 })).toBeNull();
    expect(ownSetting(setting(4, 100), { slot: 3, openedAt: 100 })).toBeNull();
    expect(settingForSuccessor(null, { slot: 3, openedAt: 200 }, 999)).toBeNull();
  });
  test("die Vorlage bleibt stehen", () => {
    const own = Object.freeze(setting(3, 100));
    settingForSuccessor(own, { slot: 3, openedAt: 200 }, 999);
    expect(own.occupant.openedAt).toBe(100);
  });
});

describe("was die Nachfolgerin bekommt", () => {
  const ready = (o: Partial<SucceedPreviewFacts>): SucceedPreviewFacts => ({ refusal: null, rail: "generic",
    standingHandover: null, tail: { state: "read", entries: 0, omitted: 0 }, ...o });
  test("stehende Übergabe und Rest", () => {
    expect(successorSentence(ready({ standingHandover: { ageMs: 12 * 60_000 }, tail: { state: "read", entries: 9, omitted: 0 } })))
      .toBe("The successor gets the standing handover (12 min old) and 9 entries of transcript tail.");
  });
  test("ohne Übergabe nur der Transkript-Rest, und der Satz sagt es", () => {
    expect(successorSentence(ready({ tail: { state: "read", entries: 1, omitted: 0 } })))
      .toBe("The successor gets 1 entry of transcript tail; the session wrote no handover.");
    expect(successorSentence(ready({ tail: { state: "read", entries: 30, omitted: 12 } })))
      .toBe("The successor gets 30 entries of transcript tail (12 older left out); the session wrote no handover.");
  });
  test("eine Übergabe ohne Rest danach, und die Program-Schiene", () => {
    expect(successorSentence(ready({ standingHandover: { ageMs: 30_000 } })))
      .toBe("The successor gets the standing handover (just written).");
    expect(successorSentence(ready({ rail: "program", standingHandover: { ageMs: 3 * 3_600_000 }, tail: { state: "read", entries: 2, omitted: 0 } })))
      .toBe("The successor gets the Program record, the standing handover (3 h old) and 2 entries of transcript tail.");
  });
  test("nichts zu lesen ist nur der Start-Brief, ein unlesbares Transkript wird genannt", () => {
    expect(successorSentence(ready({}))).toBe("The successor gets only its start brief; the session wrote no handover.");
    expect(successorSentence(ready({ summary: true, tail: { state: "read", entries: 4, omitted: 0 } })))
      .toBe("The successor gets a summary of the conversation (the session is not woken for it) and 4 entries of transcript tail; the session wrote no handover.");
    expect(successorSentence(ready({ standingHandover: { ageMs: 5 * 60_000 }, tail: { state: "none", entries: 0, omitted: 0 } })))
      .toBe("The successor gets the standing handover (5 min old); Fleet cannot read the transcript.");
  });
  test("eine abgewiesene Tür sagt den Grund in Worten", () => {
    expect(successorSentence(ready({ refusal: { reason: "busy" } }))).toBe("Not possible right now: it is working right now; once it is idle, it works.");
    expect(successorSentence(ready({ refusal: { reason: "lane" } }))).toBe("Not possible right now: a lane hands over from its own session, with a handover report.");
    expect(successorSentence(ready({ refusal: { reason: "neu" } }))).toBe("Not possible right now: neu.");
  });
  test("das Alter in Worten", () => {
    expect([0, 59_000, 60_000, 89 * 60_000, 90 * 60_000, 47 * 3_600_000, 48 * 3_600_000, 72 * 3_600_000].map(agoText))
      .toEqual(["just written", "just written", "1 min old", "89 min old", "2 h old", "47 h old", "2 days old", "3 days old"]);
  });
});

describe("warm oder kalt", () => {
  const MIN = 60_000;
  test("bis zum Ende der Stufe warm, danach kalt; die Stufe kommt aus dem Transkript", () => {
    expect(cacheView(0, 3600, null, 59 * MIN)).toEqual({ state: "warm", lastCallAt: 0, ttlSec: 3600, coldAt: 60 * MIN });
    expect(cacheView(0, 3600, null, 61 * MIN).state).toBe("kalt");
    expect(cacheView(0, 300, null, 6 * MIN).state).toBe("kalt");
  });
  test("eine Kompaktierung nach dem letzten Aufruf heißt kompaktiert, eine davor zählt nicht", () => {
    expect(cacheView(10 * MIN, 3600, 64 * MIN, 70 * MIN).state).toBe("kompaktiert");
    expect(cacheView(10 * MIN, 3600, 5 * MIN, 20 * MIN).state).toBe("warm");
  });
  test("ohne gelesenen Aufruf unbekannt", () => {
    expect(cacheView(null, 300, null, 1)).toEqual({ state: "unbekannt", lastCallAt: null, ttlSec: 300, coldAt: null });
  });
});

describe("die Warm-Entscheidung", () => {
  const MIN = 60_000;
  const on = (o: Partial<WarmFacts> = {}): WarmFacts => ({ on: true, asleep: false, pinned: true, lastCallAt: 0, tier: "1h",
    compactedAt: null, idleMin: 50, lifetimeMin: 60, warmTurns: 0, warmMax: 24, warmLastHour: 0, hourCap: 2, ...o });
  test("an, nach der Ruhezeit und vor dem Verfall: ein Warm-Turn", () => {
    expect(warmDecision(on(), 51 * MIN)).toEqual({ act: "warm", reason: "due", lastUsageAt: 0, dueAt: 50 * MIN });
  });
  test("aus: keiner", () => {
    expect(warmDecision(on({ on: false }), 51 * MIN)).toEqual({ act: null, reason: "off", lastUsageAt: null, dueAt: null });
  });
  test("vor der Ruhezeit nichts, nach dem Verfall nichts (ein kalter Cache wird nicht gewärmt)", () => {
    expect(warmDecision(on(), 49 * MIN)).toMatchObject({ act: null, reason: "before-duration", dueAt: 50 * MIN });
    expect(warmDecision(on(), 61 * MIN)).toMatchObject({ act: null, reason: "expired" });
  });
  test("5-min-Stufe, Kompaktierung, schlafend, ohne Gespräch, ohne Aufruf: keiner, mit Namen", () => {
    expect(warmDecision(on({ tier: "5m" }), 51 * MIN).reason).toBe("cache-5m");
    expect(warmDecision(on({ compactedAt: 40 * MIN }), 51 * MIN).reason).toBe("compacted");
    expect(warmDecision(on({ asleep: true }), 51 * MIN).reason).toBe("asleep");
    expect(warmDecision(on({ pinned: false }), 51 * MIN).reason).toBe("unpinned");
    expect(warmDecision(on({ lastCallAt: null }), 51 * MIN).reason).toBe("no-usage");
  });
  test("die Deckel: ohne eigenen Turn und je Stunde", () => {
    expect(warmDecision(on({ warmTurns: 24 }), 51 * MIN).reason).toBe("warm-cap");
    expect(warmDecision(on({ warmLastHour: 2 }), 51 * MIN).reason).toBe("hour-cap");
    expect(warmDecision(on({ warmLastHour: 1 }), 51 * MIN).act).toBe("warm");
  });
});

describe("der Text des Warm-Turns", () => {
  const FLEET = "[fleet] Keep the cache warm. Answer with ok only — start nothing, call no tool.";
  const TOKEN = "f1e2d3c4b5a6978877665544";
  const input = (v: unknown) => warmTextInput(v, FLEET, [TOKEN, "1"]);
  test("ein eigener Text wird gespeichert, getrimmt, auch mit Zeilenumbruch", () => {
    expect(input("  Lies HANDOVER.md und nenne den nächsten Schritt.\nNichts bauen.  "))
      .toEqual({ ok: true, text: "Lies HANDOVER.md und nenne den nächsten Schritt.\nNichts bauen." });
  });
  test("null, leer oder der Fleet-Text selbst heißt Fleet-Standard und speichert nichts", () => {
    expect(input(null)).toEqual({ ok: true, text: null });
    expect(input("   ")).toEqual({ ok: true, text: null });
    expect(input(FLEET)).toEqual({ ok: true, text: null });
  });
  test("nur Text: kein anderer Typ, kein Steuerzeichen, kein Befehl, nicht über dem Deckel", () => {
    for (const v of [42, true, ["ok"], "a\u001b[2Jb", "a\tb", "a\rb", "/clear", "!rm -rf .", "x".repeat(501)])
      expect(input(v)).toEqual({ ok: false, refusal: "bad-keep-cache-text" });
    expect(input("x".repeat(500))).toEqual({ ok: true, text: "x".repeat(500) });
  });
  test("keine Zugangsdaten dieser Fleet; ein kurzer Env-Wert zählt nicht", () => {
    expect(input(`bitte ${TOKEN} benutzen`)).toEqual({ ok: false, refusal: "keep-cache-secret" });
    expect(input("Version 1 lesen")).toEqual({ ok: true, text: "Version 1 lesen" });
  });
  test("fleet.json: ein Datensatz ohne Feld liest null, ein kaputter Text verwirft den Datensatz", () => {
    const rec = { thresholdPct: null, nudge: true, keepCache: true, keepCacheIdleMin: 50, setAt: 1, occupant: { slot: 3, openedAt: 100 } };
    expect(loadHandoverSetting(rec)?.keepCacheText).toBeNull();
    expect(loadHandoverSetting({ ...rec, keepCacheText: "Stand lesen." })?.keepCacheText).toBe("Stand lesen.");
    expect(loadHandoverSetting({ ...rec, keepCacheText: "/clear" })).toBeNull();
    expect(loadHandoverSetting({ ...rec, keepCacheText: 7 })).toBeNull();
  });
  test("fleet.json: die Wahl an der Schwelle — ohne Feld der Fleet-Wert, eine unbekannte Wahl verwirft den Datensatz", () => {
    const rec = { thresholdPct: null, nudge: true, keepCache: null, keepCacheIdleMin: 50, setAt: 1, occupant: { slot: 3, openedAt: 100 } };
    expect(loadHandoverSetting(rec)?.atThreshold).toBeNull();
    expect(loadHandoverSetting({ ...rec, atThreshold: "hint" })?.atThreshold).toBe("hint");
    expect(loadHandoverSetting({ ...rec, atThreshold: "compact" })?.atThreshold).toBe("compact");
    expect(loadHandoverSetting({ ...rec, atThreshold: "succeed" })?.atThreshold).toBe("succeed");
    expect(loadHandoverSetting({ ...rec, atThreshold: "clear" })).toBeNull();
  });
  test("fleet.json: 0 ist „Aus“ und bleibt stehen, 1 bis 4 und 100 verwerfen den Datensatz", () => {
    const rec = { thresholdPct: 0, nudge: true, keepCache: null, keepCacheIdleMin: 50, setAt: 1, occupant: { slot: 3, openedAt: 100 } };
    expect(loadHandoverSetting(rec)?.thresholdPct).toBe(0);
    expect(loadHandoverSetting({ ...rec, thresholdPct: 70 })?.thresholdPct).toBe(70);
    for (const pct of [1, 4, 100, -5]) expect(loadHandoverSetting({ ...rec, thresholdPct: pct })).toBeNull();
  });
});

describe("die Schwelle je Art", () => {
  // Owner 03.11.: „[Zitat entfernt]“ — nur Bauer und freier Sitz wandern (40 -> 30)
  test("die Tabelle ab Werk: Orchestratorin 45/50, Program-MAIN 40/45, Bau-Session und freier Sitz 30/35, Lane 37/42", () => {
    const rows = (["orchestrator", "program-main", "bau", "session", "lane"] as const)
      .map((k) => [k, thresholdOf(k, null, null)] as const)
      .map(([k, t]) => `${k} ${t.basePct}/${t.capPct} ${t.from}`);
    expect(rows).toEqual(["orchestrator 45/50 fleet", "program-main 40/45 fleet", "bau 30/35 fleet", "session 30/35 fleet",
      "lane 37/42 fleet"]);
  });
  test("die Env verschiebt die Basis ihrer Schiene, die Obergrenze bleibt 5 darüber; die Orchestratorin behält ihre Zeile", () => {
    expect(thresholdOf("program-main", 44, null)).toEqual({ kind: "program-main", basePct: 44, capPct: 49, from: "env" });
    expect(thresholdOf("bau", 44, null)).toMatchObject({ basePct: 44, capPct: 49, from: "env" });
    expect(thresholdOf("lane", 30, null)).toMatchObject({ basePct: 30, capPct: 35, from: "env" });
    // im eigenen Setup aus, bis die Session eine eigene Schwelle hat; die Env-Zeile schaltet es nicht an
    expect(thresholdOf("session", 44, null, true)).toEqual({ kind: "session", basePct: 0, capPct: 0, from: "setup" });
    expect(thresholdStep(60, thresholdOf("session", null, null, true), "warm")).toBe("below");
    expect(thresholdOf("session", 44, 40, true)).toEqual({ kind: "session", basePct: 40, capPct: 45, from: "session" });
    expect(thresholdOf("orchestrator", 40, null)).toEqual({ kind: "orchestrator", basePct: 45, capPct: 50, from: "fleet" });
  });
  test("der eigene Wert der Session ist ihre Basis und gewinnt über Env und Tabelle, auch bei der Orchestratorin", () => {
    expect(thresholdOf("lane", 30, 55)).toEqual({ kind: "lane", basePct: 55, capPct: 60, from: "session" });
    expect(thresholdOf("orchestrator", null, 60)).toMatchObject({ basePct: 60, capPct: 65, from: "session" });
  });
  test("eine Env 0 schaltet die Schiene ab, ein eigener Wert schaltet sie für diese Session wieder an", () => {
    expect(thresholdOf("lane", 0, null)).toMatchObject({ basePct: 0, capPct: 0 });
    expect(thresholdStep(90, thresholdOf("lane", 0, null), "warm")).toBe("below");
    expect(thresholdOf("lane", 0, 40)).toMatchObject({ basePct: 40, capPct: 45, from: "session" });
  });
  // K9 S3c (Owner 14.10.: „[Zitat entfernt]“): 0 als eigener Wert ist „[Zitat entfernt]“
  test("ein eigener Wert 0 schaltet diese Session ab, auch über Env und Tabelle: an der Obergrenze weder Hinweis noch Handlung", () => {
    for (const [kind, env] of [["session", 44], ["orchestrator", null], ["lane", null]] as const) {
      const t = thresholdOf(kind, env, 0);
      expect(t).toMatchObject({ basePct: 0, capPct: 0, from: "session" });
      for (const cache of ["warm", "kalt"] as const) expect(thresholdStep(99, t, cache, true)).toBe("below");
    }
  });
});

describe("die Stufe an der Schwelle", () => {
  const orch = thresholdOf("orchestrator", null, null);
  test("Owner: die Orchestratorin bis 50 %, solange der Cache warm bleibt", () => {
    expect(thresholdStep(44, orch, "warm")).toBe("below");
    expect(thresholdStep(47, orch, "warm")).toBe("hint");
    expect(thresholdStep(50, orch, "warm")).toBe("due");
  });
  test("kalt über der Basis ist die Handlung fällig, kalt unter der Basis nichts", () => {
    expect(thresholdStep(47, orch, "kalt")).toBe("due");
    expect(thresholdStep(40, orch, "kalt")).toBe("below");
  });
  test("je Zeile: an der Basis der Hinweis, an der Obergrenze fällig", () => {
    for (const k of ["program-main", "bau", "session", "lane"] as const) {
      const t = thresholdOf(k, null, null);
      expect([thresholdStep(t.basePct - 1, t, "warm"), thresholdStep(t.basePct, t, "warm"), thresholdStep(t.capPct - 1, t, "warm"),
        thresholdStep(t.capPct, t, "warm")]).toEqual(["below", "hint", "hint", "due"]);
    }
  });
  test("kompaktiert und unbekannt zählen nicht als kalt", () => {
    expect(thresholdStep(47, orch, "kompaktiert")).toBe("hint");
    expect(thresholdStep(47, orch, "unbekannt")).toBe("hint");
  });
});

describe("das Budget der Hinweise", () => {
  const MIN = 60_000;
  // eine echte Uhrzeit: lastAt 0 heißt im Budget „nie“
  const T0 = Date.parse("2026-10-14T08:00:00Z");
  test("zwischen Basis und Obergrenze ein Hinweis; die Session wählt den Punkt", () => {
    const l = new HintLedger(3, 15 * MIN);
    const c = l.claim(1, "a", "hint", T0, "warm");
    expect(c).not.toBeNull();
    l.delivered(c!, T0);
    l.release(c!);
    expect(l.due(1, "a", "hint", T0 + 60 * MIN, "warm")).toBe(false);
  });
  test("ist die Handlung fällig, kommen weitere, im Abstand und höchstens drei", () => {
    const l = new HintLedger(3, 15 * MIN);
    const sent: number[] = [];
    for (let t = T0; t <= T0 + 90 * MIN; t += 5 * MIN) {
      const c = l.claim(1, "a", "due", t, "warm");
      if (!c) continue;
      const r = l.delivered(c, t);
      l.release(c);
      sent.push((t - T0) / MIN);
      if (r.gaveUp) expect(r.nudges).toBe(3);
    }
    expect(sent).toEqual([0, 15, 30]);
    expect(l.of(1, "a")).toMatchObject({ nudges: 3, gaveUp: true });
  });
  test("ein Hinweis, der ankommt, während ein späterer Tick noch wartet, wird nicht ein zweites Mal getippt", () => {
    const l = new HintLedger(3, 15 * MIN);
    // Tick 2 sieht B als fällig, bevor Tick 1 sendet …
    expect(l.due(2, "b", "due", T0, "warm")).toBe(true);
    const first = l.claim(2, "b", "due", T0, "warm");
    // … während Tick 1s Hinweis unterwegs ist, reserviert Tick 2 nichts …
    expect(l.claim(2, "b", "due", T0 + 1, "warm")).toBeNull();
    l.delivered(first!, T0 + 2);
    l.release(first!);
    // … und nach dessen Ankunft auch nicht: der Abstand gilt ab der Ankunft
    expect(l.claim(2, "b", "due", T0 + 3, "warm")).toBeNull();
  });
  test("ein fehlgeschlagener Versuch zählt nicht, wartet aber den Abstand ab", () => {
    const l = new HintLedger(3, 15 * MIN);
    const c = l.claim(1, "a", "hint", T0, "warm")!;
    l.failed(c, T0);
    l.release(c);
    expect(l.claim(1, "a", "hint", T0 + 5 * MIN, "warm")).toBeNull();
    const again = l.claim(1, "a", "hint", T0 + 15 * MIN, "warm");
    expect(again?.attempt.nudges).toBe(0);
  });
  test("der Füllstand des letzten angekommenen Hinweises bleibt stehen; ein fehlgeschlagener ändert ihn nicht", () => {
    const l = new HintLedger(3, 15 * MIN);
    const c = l.claim(1, "a", "due", T0, "warm")!;
    expect(c.attempt.pct).toBeUndefined();
    l.delivered(c, T0, 41);
    l.release(c);
    expect(l.of(1, "a")?.pct).toBe(41);
    const late = l.claim(1, "a", "due", T0 + 15 * MIN, "warm")!;
    l.failed(late, T0 + 15 * MIN);
    l.release(late);
    expect(l.of(1, "a")?.pct).toBe(41);
    const third = l.claim(1, "a", "due", T0 + 30 * MIN, "warm")!;
    l.delivered(third, T0 + 30 * MIN, 46);
    expect(l.of(1, "a")).toMatchObject({ nudges: 2, pct: 46 });
  });
  test("ein neues Gespräch im Slot beginnt bei null", () => {
    const l = new HintLedger(3, 15 * MIN);
    const c = l.claim(1, "a", "hint", T0, "warm")!;
    l.delivered(c, T0);
    l.release(c);
    expect(l.of(1, "b")).toBeNull();
    expect(l.due(1, "b", "hint", T0 + 1, "warm")).toBe(true);
  });
  // K16 Runde C, Owner 16.10. 19:3x: „[Zitat entfernt]“
  test("Fleets Budget: genau ein Stups je Gespräch — auch an der Obergrenze und lange nach dem Abstand kein zweiter", () => {
    const l = new HintLedger(MAX_NUDGES, 15 * MIN);
    const c = l.claim(1, "a", "hint", T0, "warm")!;
    expect(l.delivered(c, T0, 40)).toEqual({ nudges: 1, gaveUp: true });
    l.release(c);
    for (const t of [T0 + 15 * MIN, T0 + 60 * MIN, T0 + 240 * MIN]) {
      expect(l.due(1, "a", "due", t, "warm")).toBe(false);
      expect(l.claim(1, "a", "due", t, "warm")).toBeNull();
    }
  });
  // Owner 16.10. 21:1x: „[Zitat entfernt]“
  test("in eine kalte Session wird kein Stups getippt, auch nicht der erste und nicht an der Obergrenze", () => {
    const l = new HintLedger(MAX_NUDGES, 15 * MIN);
    expect(l.due(1, "a", "hint", T0, "kalt")).toBe(false);
    expect(l.claim(1, "a", "due", T0, "kalt")).toBeNull();
    expect(l.of(1, "a")).toBeNull();
    expect(l.claim(1, "a", "due", T0, "warm")).not.toBeNull();
    expect(l.due(2, "b", "hint", T0, "unbekannt")).toBe(true);
    expect(l.due(3, "c", "hint", T0, "kompaktiert")).toBe(true);
  });
});

describe("der Hinweis", () => {
  const facts = (kind: "session" | "lane" | "program-main", fillPct: number, cache: "warm" | "kalt" = "warm",
    choice: ThresholdChoice = "hint", cooling = false) => {
    const threshold = thresholdOf(kind, 44, null);
    return { fillPct, usedTokens: fillPct * 10_000, windowTokens: 1_000_000, threshold, cache, choice,
      step: thresholdStep(fillPct, threshold, cache, cooling) };
  };
  test("er nennt Füllstand, Schwelle und Obergrenze und bittet um die stehende Übergabe", () => {
    const t = hintText(facts("session", 46));
    expect(t.startsWith("[fleet] Your context is at 46% (460000 of 1000000 tokens in the window). ")).toBe(true);
    expect(t).toContain("The threshold of this session is 44 %, the cap 49 %.");
    expect(t).toContain("Fleet does not hand over itself, you choose the point");
    expect(t).toContain("POST /api/self/handover");
    expect(t).toContain("POST /api/self/succeed");
    expect(t).not.toContain("The cap is reached");
  });
  test("ein Text für jede Schiene außer der Lane: die Program-MAIN liest dasselbe wie eine Session", () => {
    expect(hintText(facts("program-main", 46))).toBe(hintText(facts("session", 46)));
  });
  test("die Lane gibt mit ihrem handoff-Report weiter, nicht mit einer stehenden Übergabe", () => {
    const t = hintText(facts("lane", 46));
    expect(t).toContain("The threshold of this lane is 44 %");
    expect(t.indexOf("commit")).toBeLessThan(t.indexOf("status `handoff`"));
    expect(t.indexOf("status `handoff`")).toBeLessThan(t.indexOf("POST /api/self/succeed"));
    expect(t).not.toContain("/api/self/handover");
  });
  test("fällig sagt er, warum: Obergrenze oder kalter Cache", () => {
    expect(hintText(facts("session", 50))).toContain("The cap is reached.");
    expect(hintText(facts("session", 46, "kalt"))).toContain("Your cache is cold");
  });
  test("keine alten Kanäle: weder Watches, Autos noch Linien-Record oder HANDOFF.md", () => {
    for (const k of ["session", "lane", "program-main"] as const)
      for (const c of ["hint", "compact", "succeed"] as const)
        expect(hintText(facts(k, 50, "warm", c))).not.toMatch(/Watches|Autos|Linien-Record|HANDOFF\.md/);
  });
  test("ein Text je Wahl: er nennt die Handlung und bittet um die stehende Übergabe", () => {
    const compact = hintText(facts("session", 46, "warm", "compact"));
    expect(compact).toContain("From 49 % or shortly before your cache goes cold Fleet types `/compact` as soon as you are idle");
    expect(compact).toContain("POST /api/self/handover");
    expect(compact).not.toContain("Fleet does not hand over itself");
    // Owner 07.08. und 18.10.: die Session gibt selbst weiter, Fleets neue Session ist nur der Rückfall
    const succeed = hintText(facts("session", 46, "warm", "succeed"));
    expect(succeed).toContain("Hand over yourself");
    expect(succeed).toContain("POST /api/self/succeed");
    expect(succeed).toContain("POST /api/self/handover");
    expect(succeed).toContain("Only if you do not, Fleet opens a new session itself from 49 % or shortly before your cache goes cold");
    expect(succeed.indexOf("POST /api/self/succeed")).toBeLessThan(succeed.indexOf("Fleet opens a new session"));
    expect(hintText(facts("session", 49, "warm", "succeed"))).toContain("Fleet opens a new session itself now or shortly before");
    expect(hintText(facts("lane", 46, "warm", "compact"))).toContain("Commit your state first.");
  });
  // Owner 01.11.: „[Zitat entfernt]“: der Hinweis nennt den nächsten natürlichen Punkt und nicht die Obergrenze als Ziel
  test("er bittet um die Übergabe am nächsten natürlichen Punkt, nicht um ein Weiterlaufen bis zur Obergrenze; die Lane behält ihren Weg", () => {
    const punkt = "at your next natural break (when your current order is reported, or at a finished, committed step inside the work)";
    const t = hintText(facts("session", 46));
    expect(t).toContain(`you choose the point: hand over ${punkt}, and do not run on to the cap.`);
    expect(t.indexOf("POST /api/self/handover")).toBeLessThan(t.indexOf("POST /api/self/succeed"));
    expect(hintText(facts("session", 46, "warm", "succeed"))).toContain(`keep it current; ${punkt}, when nothing is running, call POST /api/self/succeed`);
    expect(hintText(facts("lane", 46))).not.toContain(punkt);
    expect(hintText(facts("session", 46, "warm", "compact"))).not.toContain(punkt);
  });
  test("die Zeile zwischen zwei Aufträgen: ab der Marke, nie für eine Lane, nie ohne Schwelle, nie mit ausgeschaltetem Hinweis, nie ohne Füllstand", () => {
    const an = { fillPct: ZWISCHEN_AUFTRAEGEN_PCT, usedTokens: 250_000, threshold: thresholdOf("bau", 35, null), choice: "hint" as const,
      off: null, nudge: true };
    expect(ZWISCHEN_AUFTRAEGEN_PCT).toBe(25);
    expect(betweenOrdersLine(an)).toContain("Your context is at 25 %, at or above the between-orders mark of 25 %.");
    expect(betweenOrdersLine({ ...an, threshold: thresholdOf("session", null, null) })).not.toBeNull(); // ein freier Sitz auf Fleets Basis
    expect(betweenOrdersLine({ ...an, choice: "succeed" })).not.toBeNull();
    expect(betweenOrdersLine({ ...an, fillPct: 24.9 })).toBeNull();
    expect(betweenOrdersLine({ ...an, fillPct: null })).toBeNull();
    expect(betweenOrdersLine({ ...an, usedTokens: null })).toBeNull();
    expect(betweenOrdersLine({ ...an, threshold: thresholdOf("lane", 35, null) })).toBeNull();
    expect(betweenOrdersLine({ ...an, off: "session" })).toBeNull();
    expect(betweenOrdersLine({ ...an, off: "rail" })).toBeNull();
    expect(betweenOrdersLine({ ...an, off: "steward" })).toBeNull();
    expect(betweenOrdersLine({ ...an, nudge: false })).toBeNull();
    // eine eigene Schwelle des Owners (auch 0) und die Wahl Compact behalten ihren Hinweis und bekommen die Zeile nicht
    expect(betweenOrdersLine({ ...an, fillPct: 30, threshold: thresholdOf("bau", 35, 60) })).toBeNull();
    expect(betweenOrdersLine({ ...an, fillPct: 30, threshold: thresholdOf("bau", 35, 0), off: "session" })).toBeNull();
    expect(betweenOrdersLine({ ...an, fillPct: 30, choice: "compact" })).toBeNull();
    expect(betweenOrdersLine(an)).not.toMatch(/['"]/);
  });
  // Owner 03.11.: die Marke gilt für jeden Sitz, der Arbeit von einem anderen Sitz bekommt (Punkt 2)
  test("die Zeile erreicht auch die Orchestratorin und einen Sitz im eigenen Setup, dessen Schwelle aus ist; ein MAIN bleibt draußen", () => {
    const an = { fillPct: 30, usedTokens: 300_000, choice: "hint" as const, nudge: true };
    // Auftrag 2, Punkt 5 (Entscheid der Orchestratorin 03.11.): ein MAIN ruht in der heutigen Richtung und liest über seine Program-Adresse
    for (const [kind, zeile] of [["orchestrator", true], ["program-main", false], ["bau", true], ["session", true], ["lane", false]] as const)
      expect({ kind, zeile: betweenOrdersLine({ ...an, threshold: thresholdOf(kind, 35, null), off: null }) !== null }).toEqual({ kind, zeile });
    const eigenes = thresholdOf("session", null, null, true);
    expect(eigenes).toMatchObject({ basePct: 0, from: "setup" });
    expect(betweenOrdersLine({ ...an, threshold: eigenes, off: "setup" })).not.toBeNull();
    expect(betweenOrdersLine({ ...an, threshold: thresholdOf("bau", null, null, true), off: "setup" })).not.toBeNull();
    // ...aber nur, solange nichts anderes die Übergabe ausschaltet
    expect(betweenOrdersLine({ ...an, threshold: eigenes, off: "harness" })).toBeNull();
    expect(betweenOrdersLine({ ...an, threshold: eigenes, off: "waiting" })).toBeNull();
    // und eine Lane nie, auch nicht mit der Marke weit überschritten
    expect(betweenOrdersLine({ ...an, fillPct: 60, threshold: thresholdOf("lane", null, null), off: null })).toBeNull();
  });
  // Auftrag 2, Punkt 1: die Zeile lässt sich ausführen. Ein Sitz im eigenen Setup, den nichts über die Form der Tür belehrt, und eine Prüferin
  // ohne Kenntnis von Fleet übergaben nicht; wer die Tür kannte, übergab. Die Zeile nennt Adresse, Header, Feld und was die Übergabe tragen muss.
  test("die Zeile nennt die Tür (Adresse, Header, Feld intent), verlangt den Inhalt der Nachricht in der Übergabe und bleibt getippt", () => {
    const zeile = betweenOrdersLine({ fillPct: 30, usedTokens: 300_000, threshold: thresholdOf("session", null, null), choice: "hint", off: null, nudge: true })!;
    expect(zeile).toContain("POST $FLEET_SELF_URL/api/self/handover");
    expect(zeile).toContain("the header x-fleet-self-token: $FLEET_SELF_TOKEN");
    expect(zeile).toContain("the body field intent");
    expect(zeile).toContain("POST $FLEET_SELF_URL/api/self/succeed");
    expect(zeile).toContain("what this message asks for");
    expect(zeile).toContain("not the id alone");
    expect(zeile).not.toMatch(/['"`]/);
    expect(zeile).not.toContain("\n");
  });
  // Auftrag 2, Punkt 6: das Ruhe-Band bleibt, wo es auf main war. Verglichen wird mit dem alten Verhalten, nachgebaut aus dem Text von main:
  // 25 % bis unter die Basis, die die Tabelle damals gab (40 für einen Bauer und einen freien Sitz) oder der Env-Wert. Beide Tabellen, alle Füllstände.
  test("die ruhende Zeile feuert bei jedem Füllstand genau dort, wo sie auf main feuerte, bei beiden Tabellen und beim Env-Wert", () => {
    const altOben = (kind: string, env: number | null): number => env ?? (kind === "orchestrator" ? 45 : kind === "lane" ? 37 : 40);
    const alt = (fill: number, kind: "bau" | "session" | "lane" | "orchestrator" | "program-main", env: number | null): boolean =>
      (kind === "bau" || kind === "session") && fill >= 25 && fill < altOben(kind, env);
    const zeilen: string[] = [];
    for (const kind of ["bau", "session", "lane", "orchestrator", "program-main"] as const)
      for (const env of [null, 35, 30]) {
        const t = thresholdOf(kind, env, null);
        for (let fill = 0; fill <= 100; fill += 0.5) {
          const neu = restingHandoverLine({ fillPct: fill, usedTokens: 300_000, threshold: t, cooling: true, choice: "succeed" }) !== null;
          if (neu !== alt(fill, kind, env)) zeilen.push(`${kind} env=${env} fill=${fill}: alt ${alt(fill, kind, env)} neu ${neu}`);
        }
      }
    expect(zeilen).toEqual([]);
    // der Fall, den der erste Entwurf verlor: ein Bauer auf Fleets Tabelle (Basis jetzt 30) bleibt bis 40 im Band
    const bau = thresholdOf("bau", null, null);
    expect(bau.basePct).toBe(30);
    expect(restingHandoverLine({ fillPct: 39.5, usedTokens: 300_000, threshold: bau, cooling: true, choice: "succeed" })).not.toBeNull();
    expect(restingHandoverLine({ fillPct: 40, usedTokens: 300_000, threshold: bau, cooling: true, choice: "succeed" })).toBeNull();
  });
  // Auftrag 2, Punkt 2 (geändert in Auftrag 3, Punkt 2: kein „kam nach der Übergabe an“ mehr, sondern „gelesen oder getippt, Ausgang offen“)
  test("der Brief nennt die Post mit dem, was er weiß: gelesen oder getippt nach der stehenden Übergabe, ob erledigt unbekannt; die genannte Kennung zuerst", () => {
    const basis: HandoverFacts = { obligations: [], intent: "nimm die Nachricht 0123456789abcdef01234567", pointer: null, carry: false, now: 0, laneNow: () => null };
    expect(handoverLines(basis).join("\n")).not.toContain("$FLEET_SELF_URL");
    const spaet = { id: "aaaaaaaaaaaaaaaaaaaaaaaa", from: "Session Slot 3", at: Date.UTC(2026, 10, 3, 12, 34), text: "bitte stoppe den Lauf\nund melde dich", late: true };
    const genannt = { id: "0123456789abcdef01234567", from: "Orchestrator", at: Date.UTC(2026, 10, 3, 12, 0), text: "der eigentliche Auftrag", late: false, named: true };
    const stehend = { since: Date.UTC(2026, 10, 3, 11, 0), standing: true, omitted: 0 };
    const text = handoverLines({ ...basis, mail: [spaet, genannt], mailFacts: stehend }).join("\n");
    expect(text).toContain("Nach ihrer stehenden Übergabe von 11:00 UTC hat sie diese Post gelesen oder in ihre Pane getippt bekommen. Ob sie erledigt ist, ist nicht bekannt");
    expect(text).toContain("prüfe am Stand, bevor du etwas wiederholst");
    expect(text).not.toContain("kam noch an");
    expect(text).not.toContain("in keiner Liste Ungelesener");
    expect(text).toContain("- aaaaaaaaaaaaaaaaaaaaaaaa von Session Slot 3 um 12:34 UTC: „bitte stoppe den Lauf und melde dich“");
    expect(text).toContain("Ihre Übergabe nennt diese Post:\n- 0123456789abcdef01234567 von Orchestrator um 12:00 UTC");
    expect(text).toContain("GET $FLEET_SELF_URL/api/self/messages mit dem Header x-fleet-self-token: $FLEET_SELF_TOKEN");
    // die Post steht vor dem, was die Vorgängerin vorhatte; die genannte vor der übrigen
    expect(text.indexOf("Nach ihrer stehenden")).toBeLessThan(text.indexOf("Was sie vorhatte"));
    expect(text.indexOf("Ihre Übergabe nennt")).toBeLessThan(text.indexOf("Nach ihrer stehenden"));
    // eine Kennung, die die Übergabe nennt UND die danach gelesen wurde, steht einmal, unter dem Genannten
    const beides = { ...spaet, named: true };
    const einmal = handoverLines({ ...basis, mail: [beides], mailFacts: stehend }).join("\n");
    expect(einmal.split("\n").filter((l) => l.startsWith("- aaaaaaaaaaaaaaaaaaaaaaaa"))).toHaveLength(1);
    expect(einmal).toContain("Ihre Übergabe nennt diese Post:");
    expect(einmal).not.toContain("hat sie diese Post gelesen");
    // ohne stehende Übergabe (Succeed mit `intent` im Body) das Zeitfenster
    expect(handoverLines({ ...basis, mail: [spaet], mailFacts: { since: 0, standing: false, omitted: 0 } }).join("\n"))
      .toContain("In den letzten 10 Minuten vor ihrer Übergabe hat sie diese Post gelesen oder in ihre Pane getippt bekommen");
    // ein Text ohne Anfang (persönlich markiert) steht nur mit Kennung, Absender und Zeit
    expect(handoverLines({ ...basis, mail: [{ ...spaet, text: "" }], mailFacts: stehend }).join("\n")).toContain("- aaaaaaaaaaaaaaaaaaaaaaaa von Session Slot 3 um 12:34 UTC\n");
  });
  test("der Deckel sagt, wie viele Zeilen er ausließ und wo sie stehen; auch wenn nur Ausgelassenes bleibt", () => {
    const basis: HandoverFacts = { obligations: [], intent: "x", pointer: null, carry: false, now: 0, laneNow: () => null };
    const mail = [{ id: "a".repeat(24), from: "Session Slot 3", at: 0, text: "eins", late: true }];
    const mit = handoverLines({ ...basis, mail, mailFacts: { since: 0, standing: true, omitted: 3 } }).join("\n");
    expect(mit).toContain("- … und 3 weitere ließ ich hier aus (der Brief zeigt die neuesten); alle stehen, gelesen und ungelesen, in GET $FLEET_SELF_URL/api/self/messages");
    expect(handoverLines({ ...basis, mail: [], mailFacts: { since: 0, standing: true, omitted: 2 } }).join("\n")).toContain("… und 2 weitere ließ ich hier aus");
    expect(handoverLines({ ...basis, mail, mailFacts: { since: 0, standing: true, omitted: 0 } }).join("\n")).not.toContain("ließ ich hier aus");
  });
  // Auftrag 3, Punkt 3: jeder Brief gibt Adresse und Header der Tür, auch ohne Post-Zeilen und auch dort, wo ein Repo seine eigenen Schritte setzt
  test("jeder Brief der Nachfolge gibt $FLEET_SELF_URL und den Header, mit und ohne Post-Zeilen, bei eigenen Schritten des Repos", () => {
    const basis: HandoverFacts = { obligations: [], intent: "x", pointer: null, carry: false, now: 0, laneNow: () => null };
    const post = { id: "a".repeat(24), from: "Session Slot 3", at: 0, text: "eins", late: true };
    for (const f of [basis, { ...basis, mail: [post] }, { ...basis, intent: null, carry: true }]) {
      const brief = successionBriefText(["1. Lies das Handbuch des Repos."], null, f);
      expect(brief).toContain(DOOR_LINE);
      expect(brief).toContain("$FLEET_SELF_URL");
      expect(brief).toContain("x-fleet-self-token: $FLEET_SELF_TOKEN");
      expect(brief.indexOf(DOOR_LINE)).toBeLessThan(brief.indexOf("Beginne exakt in dieser Reihenfolge"));
    }
    expect(DOOR_LINE).not.toMatch(/['"]/);
  });
  // Auftrag 3, Punkt 5: eine Vorschau von 80 Zeichen teilt kein Zeichen
  test("die Vorschau einer Post bei 80 Zeichen teilt kein Zeichen (ein Emoji an der Schnittstelle bleibt ganz oder geht ganz)", () => {
    const basis: HandoverFacts = { obligations: [], intent: "x", pointer: null, carry: false, now: 0, laneNow: () => null };
    const row = (text: string): string => handoverLines({ ...basis, mail: [{ id: "b".repeat(24), from: "Session Slot 3", at: 0, text, late: true }],
      mailFacts: { since: 0, standing: true, omitted: 0 } }).join("\n");
    for (const kopf of [79, 80, 81]) {
      const text = row("x".repeat(kopf) + "😀tail");
      expect(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(text)).toBe(false);
    }
    expect(row("x".repeat(79) + "😀tail")).toContain(`„${"x".repeat(79)}😀…“`);
    expect(row("x".repeat(80) + "ab")).toContain(`„${"x".repeat(80)}…“`);
    expect(row("😀".repeat(80))).toContain(`„${"😀".repeat(80)}“`);
    expect(row("😀".repeat(81))).toContain(`„${"😀".repeat(80)}…“`);
  });
  // Auftrag 3, Punkt 5, zweiter Satz: gebucht wird die Zeile nur, wenn sie im Feld blieb
  test("die Zeile gilt als gegeben, wenn getippt wurde und das Zurückrollen das Feld nicht leerte", () => {
    expect(lineStaysInField(120, null)).toBe(true);
    expect(lineStaysInField(0, null)).toBe(false);
    expect(lineStaysInField(120, { rollback: "cleared" })).toBe(false);
    for (const rollback of [null, "residue", "kept:differs", "kept:identity-changed"]) expect({ rollback, bleibt: lineStaysInField(120, { rollback }) }).toEqual({ rollback, bleibt: true });
  });
  // Punkt 6: die Marke bleibt Prozent, unter 100k Tokens feuert keine der zwei Zeilen
  test("unter 100k Tokens feuert weder die Zeile zwischen zwei Aufträgen noch die ruhende, auf einem kleinen Fenster auch bei 30 %", () => {
    expect(ZWISCHEN_AUFTRAEGEN_MIN_TOKENS).toBe(100_000);
    const an = { fillPct: 30, threshold: thresholdOf("bau", null, null), choice: "hint" as const, off: null, nudge: true };
    expect(betweenOrdersLine({ ...an, usedTokens: 99_999 })).toBeNull();
    expect(betweenOrdersLine({ ...an, usedTokens: 100_000 })).not.toBeNull();
    const ruh = { fillPct: 27, threshold: thresholdOf("bau", null, null), cooling: true, choice: "succeed" as const };
    expect(restingHandoverLine({ ...ruh, usedTokens: 99_999 })).toBeNull();
    expect(restingHandoverLine({ ...ruh, usedTokens: 100_000 })).not.toBeNull();
  });
  test("die ruhende Übergabe-Zeile (Auftrag 16, Punkt 5): ab der Marke bis unter die Basis, nur bei kühlendem Cache, nie für eine Lane, nie bei Compact, nie ohne Schwelle", () => {
    const an = { fillPct: 30, usedTokens: 300_000, threshold: thresholdOf("bau", 35, null), cooling: true, choice: "succeed" as const };
    expect(restingHandoverLine(an)).toContain("Your context is at 30 %, at or above the between-orders mark of 25 %, you are resting");
    expect(restingHandoverLine({ ...an, choice: "hint" })).not.toBeNull();
    expect(restingHandoverLine({ ...an, fillPct: ZWISCHEN_AUFTRAEGEN_PCT })).not.toBeNull();
    expect(restingHandoverLine({ ...an, fillPct: 24.9 })).toBeNull();
    expect(restingHandoverLine({ ...an, fillPct: 35 })).toBeNull(); // ab der Basis spricht der Hinweis, mit seiner Handlung
    expect(restingHandoverLine({ ...an, cooling: false })).toBeNull();
    expect(restingHandoverLine({ ...an, choice: "compact" })).toBeNull();
    expect(restingHandoverLine({ ...an, threshold: thresholdOf("lane", 35, null) })).toBeNull();
    expect(restingHandoverLine({ ...an, threshold: thresholdOf("bau", 0, null) })).toBeNull();
    expect(restingHandoverLine({ ...an, threshold: thresholdOf("bau", null, null, true) })).toBeNull();
    // W16-2: die eigene Schwelle des Owners (auch dieselbe Zahl) und eine Rolle mit höherer Basis bekommen sie nicht
    expect(restingHandoverLine({ ...an, threshold: thresholdOf("bau", 35, 35) })).toBeNull();
    expect(restingHandoverLine({ ...an, fillPct: 40, threshold: thresholdOf("orchestrator", 35, null) })).toBeNull();
    expect(restingHandoverLine({ ...an, threshold: thresholdOf("program-main", 35, null) })).toBeNull();
    expect(restingHandoverLine(an)).not.toMatch(/['"]/);
  });
  test("kurz vor kalt sagt er es", () => {
    expect(hintText(facts("session", 46, "warm", "succeed", true))).toContain("Your cache will be cold soon.");
  });
});

describe("kurz vor kalt", () => {
  const MIN = 60_000;
  test("bei 60 min Stufe ab 50 min Ruhe, solange der Cache noch warm ist", () => {
    expect(cacheCooling(cacheView(0, 3600, null, 49 * MIN), 49 * MIN)).toBe(false);
    expect(cacheCooling(cacheView(0, 3600, null, 50 * MIN), 50 * MIN)).toBe(true);
    expect(cacheCooling(cacheView(0, 3600, null, 61 * MIN), 61 * MIN)).toBe(false);
  });
  test("eine 5-min-Stufe bekommt eine Minute Vorlauf; kompaktiert und unbekannt kühlen nicht", () => {
    expect(cacheCooling(cacheView(0, 300, null, 3.9 * MIN), 3.9 * MIN)).toBe(false);
    expect(cacheCooling(cacheView(0, 300, null, 4 * MIN), 4 * MIN)).toBe(true);
    expect(cacheCooling(cacheView(0, 3600, 1, 55 * MIN), 55 * MIN)).toBe(false);
    expect(cacheCooling(cacheView(null, 3600, null, 55 * MIN), 55 * MIN)).toBe(false);
  });
  test("kurz vor kalt ist die Handlung über der Basis fällig, darunter nicht", () => {
    const t = thresholdOf("orchestrator", null, null);
    expect(thresholdStep(47, t, "warm", true)).toBe("due");
    expect(thresholdStep(44, t, "warm", true)).toBe("below");
  });
});

describe("die Wahl an der Schwelle", () => {
  test("Owner 07.08. und 18.10. (Z132): Fleet stößt nur an und ersetzt keine Session selbst — ab Werk der Hinweis, für jede Art", () => {
    for (const kind of ["orchestrator", "program-main", "bau", "session", "lane"] as const) expect(fleetChoiceOf(kind)).toBe("hint");
  });
  test("Claude Codes eigene Kompaktierung bleibt der Rückfall, wo Fleet an der Obergrenze nicht handelt", () => {
    expect(autoCompactOff(40, fleetChoiceOf("bau"))).toBe(false);
    // die Lane (37 %): Fleet ersetzt sie nie, also bleibt ihr Claude Codes Kompaktierung (Board-Check fa54eed9, e2e auto-compact)
    expect(autoCompactOff(37, fleetChoiceOf("lane"))).toBe(false);
    expect(autoCompactOff(40, "hint")).toBe(false);
    // nur wer „succeed“ oder Compact wählt, bekommt Fleets Handlung an der Obergrenze, und nur dann ist sie aus
    expect(autoCompactOff(40, "succeed")).toBe(true);
    expect(autoCompactOff(37, "compact")).toBe(true);
    // „Aus“ (Schwelle 0): Fleet tut nichts, Claude Code kompaktiert selbst
    expect(autoCompactOff(0, "succeed")).toBe(false);
  });
  test("ab Werk nur Hinweis; eine Lane wählt Hinweis oder Compact, jede andere Art auch neue Session", () => {
    expect(choicesFor("lane")).toEqual(["hint", "compact"]);
    expect(choicesFor("orchestrator")).toEqual(["hint", "compact", "succeed"]);
    expect(choicesFor("bau")).toEqual(["hint", "compact", "succeed"]);
  });
  test("„hint“ und null speichern nichts, eine Lane bekommt keine neue Session, anderes ist kein Wert", () => {
    expect(choiceInput(null, "session")).toEqual({ ok: true, choice: null });
    expect(choiceInput("hint", "session")).toEqual({ ok: true, choice: "hint" });
    expect(choiceInput("succeed", "session")).toEqual({ ok: true, choice: "succeed" });
    expect(choiceInput("compact", "lane")).toEqual({ ok: true, choice: "compact" });
    expect(choiceInput("succeed", "lane")).toEqual({ ok: false, refusal: "lane-succeed" });
    expect(choiceInput("clear", "session")).toEqual({ ok: false, refusal: "bad-at-threshold" });
    expect(choiceInput(1, "session")).toEqual({ ok: false, refusal: "bad-at-threshold" });
  });
});

describe("die Handlung", () => {
  const base: ActFacts = { choice: "succeed", step: "due", resting: true, hinted: true, hintOn: true, cold: false, atCap: true,
    actedAt: null, retryMs: 15 * 60_000, now: 1_000_000 };
  test("fällig, Hinweis angekommen, ruhend: die gewählte Handlung", () => {
    expect(actDecision(base)).toEqual({ act: "succeed", reason: "due" });
    expect(actDecision({ ...base, choice: "compact" })).toEqual({ act: "compact", reason: "due" });
  });
  test("Owner: Fleet handelt nur an einer ruhenden Session, nie mitten im Turn", () => {
    expect(actDecision({ ...base, resting: false })).toEqual({ act: null, reason: "working" });
  });
  test("erst der Hinweis, der die Handlung nennt — außer der Owner hat ihn abgeschaltet", () => {
    expect(actDecision({ ...base, hinted: false })).toEqual({ act: null, reason: "hint-first" });
    expect(actDecision({ ...base, hinted: false, hintOn: false })).toEqual({ act: "succeed", reason: "due" });
  });
  // K16 Runde C, Bauleitung 16.10. für den Owner: kalt unter der Obergrenze nur das Angebot; die Notbremse bleibt, kalt ohne Vorab-Hinweis
  test("kalt unter der Obergrenze: keine Handlung, das Angebot „New session from summary“ steht in der Ansicht", () => {
    expect(actDecision({ ...base, cold: true, atCap: false })).toEqual({ act: null, reason: "cold-offer" });
    expect(actDecision({ ...base, cold: true, atCap: false, hinted: false, hintOn: false })).toEqual({ act: null, reason: "cold-offer" });
  });
  test("kalt an der Obergrenze: die Notbremse handelt, ohne auf den Hinweis zu warten, den Fleet nicht mehr tippt", () => {
    expect(actDecision({ ...base, cold: true, hinted: false })).toEqual({ act: "succeed", reason: "due" });
    expect(actDecision({ ...base, cold: true, hinted: false, resting: false })).toEqual({ act: null, reason: "working" });
    expect(actDecision({ ...base, cold: false, hinted: false })).toEqual({ act: null, reason: "hint-first" });
  });
  test("warm unter der Obergrenze, kurz vor kalt: wie bisher, nach dem Hinweis", () => {
    expect(actDecision({ ...base, atCap: false })).toEqual({ act: "succeed", reason: "due" });
    expect(actDecision({ ...base, atCap: false, hinted: false })).toEqual({ act: null, reason: "hint-first" });
  });
  test("nur Hinweis, nicht fällig, eben gehandelt: nichts", () => {
    expect(actDecision({ ...base, choice: "hint" }).reason).toBe("choice-hint");
    expect(actDecision({ ...base, step: "hint" }).reason).toBe("not-due");
    expect(actDecision({ ...base, actedAt: base.now - 60_000 }).reason).toBe("acted");
    expect(actDecision({ ...base, actedAt: base.now - 15 * 60_000 }).act).toBe("succeed");
  });
});

describe("die Rollenkarte der Orchestratorin", () => {
  test("Owner: „[Zitat entfernt]“ — ihre Kontext-Zeile nennt ihre Zeile 45/50", () => {
    const line = orchestratorContextLine(thresholdOf("orchestrator", 40, null));
    expect(line).toContain("From 45 % Fleet writes you a hint");
    expect(line).toContain("up to 50 % you keep working while your cache is warm");
    expect(line).not.toContain("spaetestens bei 45");
    expect(line).not.toContain("FLEET_MIGRATE_PCT");
  });
});

// K16 Runde C, Owner 16.10. 21:1x: „[Zitat entfernt]“
//  — die Vorgabe sind die bisherigen
describe("Agent, Modell und Effort der neuen Session", () => {
  const cur = { harness: "claude", model: "claude-opus-5-5[1m]", effort: "xhigh" };
  test("ohne Angabe: die bisherigen, nichts geändert", () => {
    expect(successorSpawnOf({ expectedOpenedAt: 5 }, cur)).toEqual({ ok: true, pick: cur, changed: false });
    expect(successorSpawnOf(null, cur)).toEqual({ ok: true, pick: cur, changed: false });
    expect(successorSpawnOf({ harness: "claude", model: "claude-opus-5-5[1m]", effort: "xhigh" }, cur)).toEqual({ ok: true, pick: cur, changed: false });
    expect(successorSpawnOf({ harness: "claude" }, cur)).toEqual({ ok: true, pick: cur, changed: false });
  });
  test("ein anderes Modell oder ein anderer Effort beim selben Agenten", () => {
    expect(successorSpawnOf({ model: "claude-sonnet-5-5[1m]" }, cur))
      .toEqual({ ok: true, pick: { ...cur, model: "claude-sonnet-5-5[1m]" }, changed: true });
    expect(successorSpawnOf({ effort: "high" }, cur)).toEqual({ ok: true, pick: { ...cur, effort: "high" }, changed: true });
    expect(successorSpawnOf({ model: null }, cur)).toEqual({ ok: true, pick: { ...cur, model: null }, changed: true });
  });
  test("ein anderer Agent ohne Modell und Effort nimmt dessen Vorgabe, nie das Modell des alten", () => {
    expect(successorSpawnOf({ harness: "codex" }, cur))
      .toEqual({ ok: true, pick: { harness: "codex", model: null, effort: null }, changed: true });
    expect(successorSpawnOf({ harness: "codex", model: "gpt-6.1-sol", effort: "medium" }, cur))
      .toEqual({ ok: true, pick: { harness: "codex", model: "gpt-6.1-sol", effort: "medium" }, changed: true });
  });
  test("leer oder null heißt die Vorgabe; ein Wert, der kein Text ist, wird abgewiesen", () => {
    expect(successorSpawnOf({ harness: "", model: " " }, cur)).toEqual({ ok: true, pick: { ...cur, model: null }, changed: true });
    expect(successorSpawnOf({ harness: null }, cur)).toEqual({ ok: true, pick: cur, changed: false });
    expect(successorSpawnOf({ model: 5 }, cur).ok).toBe(false);
    expect(successorSpawnOf({ harness: ["codex"] }, cur).ok).toBe(false);
    expect(successorSpawnOf({ effort: { x: 1 } }, cur).ok).toBe(false);
  });
});

// Mangel 100 · Owner 17.10.: „[Zitat entfernt]“
// 
const NOW = 1_800_000_000_000;
const SHA = "816923e67a1b2c3d4e5f60718293a4b5c6d7e8f9";
const owedBy = "slot 2@1700000000000";
const watch = (id: string, target: LineageObligationRef["target"]): LineageObligationRef =>
  ({ kind: "watch", id, owedBy, reArm: "POST /api/self/watch", target });
const auto = (id: string, target: LineageObligationRef["target"]): LineageObligationRef =>
  ({ kind: "auto", id, owedBy, reArm: "POST /api/self/autos", target });
const auditWatch = watch("a1b2c3d4", { kind: "audit", repo: "/Users/x/claude-fleet", mainAfter: SHA, idleSec: 0, delivery: null });
const laneWatch = watch("e5f6a7b8", { kind: "lane", target: 7, targetCwd: "/w/bau-x", targetBranch: "bau/x", idleSec: 60, delivery: null });
const noLane: LaneNow = () => null;
const sameLane: LaneNow = (slot) => slot === 7 ? { cwd: "/w/bau-x", branch: "bau/x" } : null;
const beat = (over: Partial<{ text: string; everySec: number | null; runsLeft: number; nextAt: number; enabled: boolean; perpetual: boolean }> = {}) =>
  ({ text: "Lies den Audit der Welle", everySec: 600 as number | null, idleSec: 120, runsLeft: 3,
    nextAt: NOW + 900_000, enabled: true, perpetual: false, ...over });

describe("die Pflichten der Vorgängerin: was neu scharf wird", () => {
  test("eine Audit-Wache wird mit demselben Ziel und derselben Zustellung neu gesetzt", () => {
    expect(rearmStepOf(auditWatch, NOW, noLane)).toEqual({ door: "watch", body: { kind: "audit", repo: "/Users/x/claude-fleet", mainAfter: SHA, idleSec: 0 } });
    const inbox = watch("a1b2c3d4", { kind: "audit", repo: "/r", mainAfter: SHA, idleSec: 30, delivery: "inbox" });
    expect(rearmStepOf(inbox, NOW, noLane)).toEqual({ door: "watch", body: { kind: "audit", repo: "/r", mainAfter: SHA, idleSec: 30, delivery: "inbox" } });
    // ein Record von vorher kennt die Zustellung nicht: die Tür nimmt ihre Vorgabe
    expect(rearmStepOf(watch("a1", { kind: "audit", repo: "/r", mainAfter: SHA }), NOW, noLane))
      .toEqual({ door: "watch", body: { kind: "audit", repo: "/r", mainAfter: SHA } });
  });
  test("Deploy- und Helfer-Wachen tragen ihre Kennung so, wie die Tür sie liest", () => {
    expect(rearmStepOf(watch("d1", { kind: "deploy", deployId: "1a2b3c4d" }), NOW, noLane))
      .toEqual({ door: "watch", body: { kind: "deploy", deployId: "1a2b3c4d" } });
    expect(rearmStepOf(watch("j1", { kind: "job", jobId: "0123456789ab" }), NOW, noLane))
      .toEqual({ door: "watch", body: { kind: "job", target: "0123456789ab" } });
  });
  test("eine Lane-Wache gilt nur derselben Lane, nicht der nächsten im Slot", () => {
    expect(rearmStepOf(laneWatch, NOW, sameLane)).toEqual({ door: "watch", body: { kind: "lane", target: 7, idleSec: 60 } });
    expect(rearmStepOf(laneWatch, NOW, noLane)).toEqual({ skip: "die Lane läuft dort nicht mehr" });
    expect(rearmStepOf(laneWatch, NOW, () => ({ cwd: "/w/bau-x", branch: "bau/y" }))).toEqual({ skip: "die Lane läuft dort nicht mehr" });
  });
  test("eine Erinnerung behält ihren Zeitpunkt, eine Wiederholung Takt, Rest und Zeitpunkt, eine ohne Ende bleibt ohne Ende", () => {
    expect(rearmStepOf(auto("o1", beat({ everySec: null, runsLeft: 1, nextAt: NOW + 2_520_000 })), NOW, noLane))
      .toEqual({ door: "auto", perpetual: false, body: { text: "Lies den Audit der Welle", everySec: null, idleSec: 120, inSec: 2520 } });
    expect(rearmStepOf(auto("r1", beat()), NOW, noLane))
      .toEqual({ door: "auto", perpetual: false, body: { text: "Lies den Audit der Welle", everySec: 600, idleSec: 120, runs: 3, inSec: 900 } });
    expect(rearmStepOf(auto("p1", beat({ perpetual: true, runsLeft: 1 })), NOW, noLane))
      .toEqual({ door: "auto", perpetual: true, body: { text: "Lies den Audit der Welle", everySec: 600, idleSec: 120, perpetual: true, inSec: 900 } });
    // überfällig: sobald die Nachfolgerin ruht, nicht nie
    expect(rearmStepOf(auto("o2", beat({ everySec: null, runsLeft: 1, nextAt: NOW - 60_000 })), NOW, noLane))
      .toMatchObject({ door: "auto", body: { inSec: 1 } });
    // ein Record von vorher kennt den Zeitpunkt einer Wiederholung nicht: ihr Takt ab jetzt
    expect(rearmStepOf(auto("r2", { text: "x", everySec: 600, idleSec: 60, runsLeft: 2 }), NOW, noLane))
      .toEqual({ door: "auto", perpetual: false, body: { text: "x", everySec: 600, idleSec: 60, runs: 2 } });
  });
  test("was nicht neu scharf wird, sagt warum; Ereignis und Bericht bleiben Lese-Pflichten, ein Ausgang gilt nur einmal", () => {
    expect(rearmStepOf(watch("w1", null), NOW, noLane)).toEqual({ skip: "ihr Ziel ist nicht überliefert" });
    expect(rearmStepOf({ kind: "watch", id: "w2", owedBy, reArm: "POST /api/self/watch" }, NOW, noLane)).toEqual({ skip: "ihr Ziel ist nicht überliefert" });
    expect(rearmStepOf(auto("s1", beat({ runsLeft: 0, enabled: false })), NOW, noLane)).toEqual({ skip: REARM_SPENT });
    expect(rearmStepOf(auto("h1", beat({ enabled: false })), NOW, noLane)).toEqual({ skip: "sie war angehalten" });
    expect(rearmStepOf(auto("o3", { text: "x", everySec: null, idleSec: 60, runsLeft: 1 }), NOW, noLane))
      .toEqual({ skip: "ihr Zeitpunkt ist nicht überliefert" });
    expect(rearmStepOf({ kind: "inbox", id: "e1", owedBy, reArm: null }, NOW, noLane)).toBeNull();
    expect(rearmStepOf({ kind: "report", id: "r1", owedBy, reArm: null }, NOW, noLane)).toBeNull();
    expect(rearmStepOf({ ...auditWatch, rearmed: "ffff0000" }, NOW, noLane)).toBeNull();
    expect(rearmStepOf({ ...auditWatch, notRearmed: "Fleet lehnte ab: 409" }, NOW, noLane)).toBeNull();
  });
});

describe("der Brief sagt in Worten, was scharf ist und was als Nächstes kommt", () => {
  const facts = (obligations: LineageObligationRef[], over: Partial<HandoverFacts> = {}): HandoverFacts =>
    ({ obligations, intent: null, pointer: null, carry: false, now: NOW, laneNow: noLane, ...over });
  const STEPS = ["1. Lies GET /api/self → `lineage.record`.", "2. Gründe dich auf git."];
  const head = (text: string): string => text.slice(0, text.indexOf("Beginne exakt in dieser Reihenfolge:"));
  test("keine Maschinenwörter; die Wache steht mit ihrem Ziel drin; fehlt die Absicht, sagt es ein Satz", () => {
    const text = successionBriefText(STEPS, null, facts([auditWatch,
      { kind: "inbox", id: "e1", owedBy, reArm: null }, { kind: "report", id: "r1", owedBy, reArm: null }, { kind: "report", id: "r2", owedBy, reArm: null }]));
    // seit Auftrag 3 steht die Tür (Adresse und Header) gleich unter dem Kopf, in jedem Brief
    expect(text.split("\n").slice(0, 4)).toEqual([
      "[fleet succession] Die Vorgängerin ist auf diesem Slot beendet; du übernimmst ihre Arbeit.",
      DOOR_LINE,
      "Fleet stellt für dich wieder scharf:",
      "- Wache: Audit von main 816923e6 in claude-fleet"]);
    expect(text).toContain("Ungelesen geblieben sind 1 Ereignis und 2 Berichte an sie;");
    expect(handoverLines(facts([{ kind: "inbox", id: "e1", owedBy, reArm: null }]))).toContain(
      "Ungelesen geblieben ist 1 Ereignis an sie; die Kennung steht in GET /api/self, lineage.record.");
    expect(text).toContain("Deine Vorgängerin hat nicht aufgeschrieben, was sie vorhatte und was als Nächstes zu tun ist.");
    expect(text).not.toMatch(/Linien-Record|watch\/auto|inbox\/report|ohne intent|ohne pointer|Pflichten per ID|neu armiert|intent und|pointer\b/);
    // der Kopf ist Text für die Chat-Ansicht: keine Backticks, die dort roh stehen blieben (Mangel 95)
    expect(head(text)).not.toContain("`");
    expect(text).toContain(`Beginne exakt in dieser Reihenfolge:\n${STEPS.join("\n")}`);
  });
  test("die Absicht steht selbst im Brief, je Zeile eingerückt: keine ihrer Zeilen sieht aus wie ein Schritt", () => {
    const intent = "Erst den Audit von main lesen.\n1. dann die Charge landen\nKorrektur: Slot 3 ist NICHT frei.";
    const text = successionBriefText(STEPS, null, facts([], { intent }));
    expect(head(text).trimEnd().split("\n").slice(-4)).toEqual(["Was sie vorhatte und was als Nächstes kommt, hat sie dir aufgeschrieben:",
      "  Erst den Audit von main lesen.", "  1. dann die Charge landen", "  Korrektur: Slot 3 ist NICHT frei."]);
    expect(text.split("\n").filter((l) => /^\d+\./.test(l))).toEqual(STEPS);
    expect(text).not.toContain("hat nicht aufgeschrieben");
  });
  test("Zeiger oder erster Schritt: je ein Satz, kein Feldname", () => {
    expect(handoverLines(facts([], { pointer: "docs/stand-2026-10-17.md#weiter" })).at(-1))
      .toBe("Was sie vorhatte und was als Nächstes kommt, steht in docs/stand-2026-10-17.md#weiter.");
    const carried = successionBriefText(STEPS, "Erst den Audit lesen.", facts([], { carry: true }));
    expect(carried).toContain("Was sie als Erstes täte, steht am Ende dieses Briefs.");
    expect(carried.endsWith("\n\nDas Erste, was deine Vorgängerin als Nächstes täte:\nErst den Audit lesen.")).toBe(true);
    expect(carried).not.toContain("hat nicht aufgeschrieben");
  });
  test("was nicht wieder scharf wird, steht mit Grund drin; eine abgelaufene Erinnerung nicht", () => {
    const lines = handoverLines(facts([laneWatch, auto("s1", beat({ text: "ABGELAUFEN", runsLeft: 0, enabled: false })),
      auto("h1", beat({ text: "Angehalten", enabled: false }))]));
    expect(lines.slice(0, 4)).toEqual(["Nicht wieder scharf:",
      "- Wache: Lane bau/x in Slot 7 ist fertig — die Lane läuft dort nicht mehr",
      "- Wiederholung alle 10 min, noch 3 Mal: „Angehalten“ — sie war angehalten",
      "Deine Vorgängerin hat nicht aufgeschrieben, was sie vorhatte und was als Nächstes zu tun ist."]);
    expect(lines.join("\n")).not.toContain("ABGELAUFEN");
  });
  test("ohne Wachen und Wiederholungen ein Satz; Wiederholung und Erinnerung in Worten, lange Texte gekürzt", () => {
    expect(handoverLines(facts([]))[0]).toBe("Laufende Wachen oder Wiederholungen hatte sie keine.");
    expect(handoverLines(facts([auto("s1", beat({ runsLeft: 0, enabled: false }))]))[0]).toBe("Laufende Wachen oder Wiederholungen hatte sie keine.");
    const long = `${"Erst lesen,\n dann ".repeat(12)}schreiben`;
    expect(handoverLines(facts([auto("r1", beat()), auto("p1", beat({ perpetual: true, everySec: 3600, runsLeft: 1 })),
      auto("o1", beat({ everySec: null, runsLeft: 1, nextAt: NOW + 2_520_000, text: long })), auto("o2", beat({ everySec: null, runsLeft: 1, nextAt: NOW - 1 }))])).slice(1, 5))
      .toEqual(["- Wiederholung alle 10 min, noch 3 Mal: „Lies den Audit der Welle“",
        "- Wiederholung alle 60 min, ohne Ende: „Lies den Audit der Welle“",
        `- Erinnerung in 42 min: „${"Erst lesen, dann ".repeat(12).slice(0, 80)}…“`,
        "- Erinnerung, jetzt fällig: „Lies den Audit der Welle“"]);
  });
  test("eine lange Liste nennt zehn und zählt den Rest", () => {
    const many = Array.from({ length: 12 }, (_, i) => watch(`w${i}`, { kind: "deploy", deployId: `0000000${i % 10}`.slice(-8) }));
    const lines = handoverLines(facts(many));
    expect(lines.filter((l) => l.startsWith("- Wache: Deploy"))).toHaveLength(10);
    expect(lines[11]).toBe("- … und 2 weitere (GET /api/self, lineage.record)");
  });
});

describe("der Record trägt Ziel und Ausgang je Pflicht, und der Loader liest ihn zurück", () => {
  const record = (obligations: unknown[]) => ({ v: 1 as const, lineageId: "ec415625ec415625ec415625", role: "generic" as const, at: NOW,
    from: { slot: 2, openedAt: 1700000000000 }, to: { slot: 2, openedAt: 1700000000001 }, obligations,
    intent: null, pointer: null, supersededBy: null });
  test("Wache mit Zustellung, Auto mit Zeitpunkt, Ausgang neu gesetzt oder mit Grund: unverändert zurück", () => {
    const obligations = [{ ...auditWatch, rearmed: "0a1b2c3d" }, { ...auto("r1", beat()), notRearmed: "sie war angehalten" },
      watch("j1", { kind: "job", jobId: "0123456789ab", idleSec: 0, delivery: "inbox" }), { kind: "inbox", id: "e1", owedBy, reArm: null }];
    const read = loadLineageHandover(JSON.parse(JSON.stringify(record(obligations))));
    expect(read).toEqual({ ok: true, handover: record(obligations) as Extract<typeof read, { ok: true }>["handover"] });
  });
  test("ein Record von vorher bleibt lesbar: Wache ohne Zustellung, Auto mit vier Feldern, kein Ausgang", () => {
    const old = [watch("a1", { kind: "audit", repo: "/r", mainAfter: SHA }), auto("x1", { text: "x", everySec: null, idleSec: 60, runsLeft: 1 })];
    const read = loadLineageHandover(record(old));
    expect(read).toEqual({ ok: true, handover: record(old) as Extract<typeof read, { ok: true }>["handover"] });
  });
  test("abgewiesen: halbe Zustellung, halber Zeitpunkt, zwei Ausgänge, ein Ausgang an einer Lese-Pflicht, ein Grund über mehrere Zeilen", () => {
    const refused = (o: unknown): string => {
      const r = loadLineageHandover(record([o]));
      return r.ok ? "geladen" : r.error;
    };
    expect(refused(watch("a1", { kind: "audit", repo: "/r", mainAfter: SHA, idleSec: 0 } as LineageObligationRef["target"])))
      .toContain("each with both of idleSec and delivery or neither");
    expect(refused(watch("a1", { kind: "audit", repo: "/r", mainAfter: SHA, idleSec: 0, delivery: "mail" } as unknown as LineageObligationRef["target"])))
      .toContain("target.delivery must be null");
    expect(refused(watch("d1", { kind: "deploy", deployId: "nicht-hex" }))).toContain("target.deployId must be 8 hex characters");
    expect(refused(auto("r1", { text: "x", everySec: 600, idleSec: 60, runsLeft: 2, nextAt: NOW } as LineageObligationRef["target"])))
      .toContain("optionally with all of nextAt, enabled and perpetual");
    expect(refused({ ...auditWatch, rearmed: "0a1b2c3d", notRearmed: "beides" })).toContain("only once");
    expect(refused({ kind: "inbox", id: "e1", owedBy, reArm: null, notRearmed: "gelesen" })).toContain("only a watch or an auto is re-armed");
    expect(refused({ ...auditWatch, notRearmed: "erste Zeile\nzweite Zeile" })).toContain("notRearmed must be one line");
    expect(refused({ ...auditWatch, rearmed: "../x" })).toContain("rearmed must be 1-64 id characters");
  });
});

// OWNER 29.10. („[Zitat entfernt]“): auch ein pi-Sitz bekommt die
// Übergabe-Schwelle. Dieselbe Zeile, derselbe Entscheid — nur der Harness-Filter öffnet sich
// (server/succession.ts#onHandoverBand, server.ts#successionThresholdOff/#tickMigrate).
describe("die pi-Sitze liegen auf Fleets Übergabe-Band", () => {
  const t = thresholdOf("session", 40, null);
  const off = (o: { harness?: string; steward?: boolean; awaitingOwner?: boolean; pinned?: boolean; fleetPct?: number;
    threshold?: typeof t } = {}) => thresholdOffOf({ steward: false, awaitingOwner: false, pinned: true, harness: "claude",
      fleetPct: 44, threshold: t, ...o });
  test("Claude und jeder pi-Adapter liegen darauf, Codex und der Container nicht", () => {
    for (const h of ["claude", "pi", "pi-zai", "pi-zai-unfenced", "pi-unfenced", "pi-deepseek"])
      expect(onHandoverBand(h)).toBe(true);
    for (const h of ["codex", "container", "ein-anderer-agent"]) expect(onHandoverBand(h)).toBe(false);
  });
  test("ein pi-Sitz feuert bei 40/45 wie ein Claude-Sitz — kein „harness“ mehr", () => {
    for (const h of ["claude", "pi-zai", "pi-deepseek"]) expect(off({ harness: h })).toBeNull();
    expect(off({ harness: "codex" })).toBe("harness");
    expect(off({ harness: "container" })).toBe("harness");
  });
  test("die Reihenfolge der Gründe bleibt: Steward, Warten, kein Pin, Harness, Hauptschalter, Basis 0", () => {
    expect(off({ steward: true, pinned: false, harness: "codex" })).toBe("steward");
    expect(off({ awaitingOwner: true, pinned: false, harness: "codex" })).toBe("waiting");
    expect(off({ pinned: false, harness: "codex" })).toBe("unpinned");
    expect(off({ fleetPct: 0, harness: "pi-zai" })).toBe("fleet");
    expect(off({ harness: "pi-zai", threshold: thresholdOf("session", 0, null) })).toBe("rail");
    expect(off({ harness: "pi-zai", threshold: thresholdOf("session", 44, 0) })).toBe("session");
    expect(off({ harness: "pi-zai", threshold: thresholdOf("session", 44, null, true) })).toBe("setup");
  });
  test("an der Obergrenze übergibt ein pi-Sitz an dieselbe Harness und dasselbe Modell; an der Basis kommt nur der Hinweis", () => {
    // die Start-Fassung der Nachfolgerin: kein Wechsel auf Claude, kein Modellwechsel
    expect(successorSpawnOf(null, { harness: "pi-zai", model: "glm-5.3", effort: "high" }))
      .toEqual({ ok: true, changed: false, pick: { harness: "pi-zai", model: "glm-5.3", effort: "high" } });
    expect(successorSpawnOf(null, { harness: "pi-deepseek", model: "deepseek-flash", effort: null }))
      .toEqual({ ok: true, changed: false, pick: { harness: "pi-deepseek", model: "deepseek-flash", effort: null } });
    // der Übergabe-Entscheid: bei „succeed“ handelt Fleet erst an der Obergrenze, vorher nur der Hinweis
    const pi = thresholdOf("session", 44, null);
    const act = (fill: number, choice: ThresholdChoice) => actDecision({ choice, step: thresholdStep(fill, pi, "unbekannt"),
      resting: true, hinted: true, hintOn: true, cold: false, atCap: fill >= pi.capPct, actedAt: null, retryMs: 60_000, now: NOW });
    expect(act(46, "succeed")).toEqual({ act: null, reason: "not-due" });
    expect(act(50, "succeed")).toEqual({ act: "succeed", reason: "due" });
    // die eine Zeile, die der pi-Sitz zu lesen bekommt: derselbe Text, nur der Agent heißt Pi
    const piFacts = (choice: ThresholdChoice) => ({ fillPct: 46, usedTokens: 460_000, windowTokens: 1_000_000,
      threshold: pi, cache: "unbekannt" as const, choice, step: thresholdStep(46, pi, "unbekannt"), agent: "Pi" });
    expect(hintText(piFacts("hint"))).toContain("Fleet does not hand over itself, you choose the point");
    expect(hintText(piFacts("succeed"))).toContain("Fleet opens a new session itself from 49 %");
    expect(hintText(piFacts("compact"))).toContain("Pi summarizes the conversation and you keep working");
    expect(hintText({ ...piFacts("compact"), agent: undefined })).toContain("Claude summarizes the conversation");
  });
});
