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
import { actDecision, agoText, cacheCooling, cacheView, choiceInput, choicesFor, fleetChoiceOf, HintLedger, hintText, MAX_NUDGES,
  orchestratorContextLine, ownSetting, settingForSuccessor, successorSentence, successorSpawnOf, thresholdOf, thresholdStep, warmDecision,
  warmTextInput, type ActFacts, type SucceedPreviewFacts, type ThresholdChoice, type WarmFacts } from "./succession";
import { loadHandoverSetting, type HandoverSetting } from "./types";

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
      .toBe("Die Nachfolgerin bekommt die stehende Übergabe von vor 12 min und 9 Einträge Transkript-Rest.");
  });
  test("ohne Übergabe nur der Transkript-Rest, und der Satz sagt es", () => {
    expect(successorSentence(ready({ tail: { state: "read", entries: 1, omitted: 0 } })))
      .toBe("Die Nachfolgerin bekommt 1 Eintrag Transkript-Rest; eine Übergabe hat die Session nicht geschrieben.");
    expect(successorSentence(ready({ tail: { state: "read", entries: 30, omitted: 12 } })))
      .toBe("Die Nachfolgerin bekommt 30 Einträge Transkript-Rest (12 ältere ausgelassen); eine Übergabe hat die Session nicht geschrieben.");
  });
  test("eine Übergabe ohne Rest danach, und die Program-Schiene", () => {
    expect(successorSentence(ready({ standingHandover: { ageMs: 30_000 } })))
      .toBe("Die Nachfolgerin bekommt die stehende Übergabe von eben.");
    expect(successorSentence(ready({ rail: "program", standingHandover: { ageMs: 3 * 3_600_000 }, tail: { state: "read", entries: 2, omitted: 0 } })))
      .toBe("Die Nachfolgerin bekommt den Program-Eintrag, die stehende Übergabe von vor 3 h und 2 Einträge Transkript-Rest.");
  });
  test("nichts zu lesen ist nur der Start-Brief, ein unlesbares Transkript wird genannt", () => {
    expect(successorSentence(ready({}))).toBe("Die Nachfolgerin bekommt nur ihren Start-Brief; eine Übergabe hat die Session nicht geschrieben.");
    expect(successorSentence(ready({ summary: true, tail: { state: "read", entries: 4, omitted: 0 } })))
      .toBe("Die Nachfolgerin bekommt eine Zusammenfassung des Gesprächs (die Session wird dafür nicht geweckt) und 4 Einträge Transkript-Rest; eine Übergabe hat die Session nicht geschrieben.");
    expect(successorSentence(ready({ standingHandover: { ageMs: 5 * 60_000 }, tail: { state: "none", entries: 0, omitted: 0 } })))
      .toBe("Die Nachfolgerin bekommt die stehende Übergabe von vor 5 min; das Transkript kann Fleet nicht lesen.");
  });
  test("eine abgewiesene Tür sagt den Grund in Worten", () => {
    expect(successorSentence(ready({ refusal: { reason: "busy" } }))).toBe("Geht gerade nicht: sie arbeitet gerade; sobald sie ruht, geht es.");
    expect(successorSentence(ready({ refusal: { reason: "lane" } }))).toBe("Geht gerade nicht: eine Lane gibt aus ihrer eigenen Session weiter, mit Übergabebericht.");
    expect(successorSentence(ready({ refusal: { reason: "neu" } }))).toBe("Geht gerade nicht: neu.");
  });
  test("das Alter in Worten", () => {
    expect([0, 59_000, 60_000, 89 * 60_000, 90 * 60_000, 47 * 3_600_000, 48 * 3_600_000, 72 * 3_600_000].map(agoText))
      .toEqual(["eben", "eben", "vor 1 min", "vor 89 min", "vor 2 h", "vor 47 h", "vor 2 Tagen", "vor 3 Tagen"]);
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
  const FLEET = "[fleet] Cache warmhalten. Antworte nur mit „ok“ — beginne nichts, rufe kein Werkzeug auf.";
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
  test("die Tabelle ab Werk: Orchestratorin 45/50, Program-MAIN und Bau-Session 40/45, Lane 37/42", () => {
    const rows = (["orchestrator", "program-main", "bau", "session", "lane"] as const)
      .map((k) => [k, thresholdOf(k, null, null)] as const)
      .map(([k, t]) => `${k} ${t.basePct}/${t.capPct} ${t.from}`);
    expect(rows).toEqual(["orchestrator 45/50 fleet", "program-main 40/45 fleet", "bau 40/45 fleet", "session 40/45 fleet",
      "lane 37/42 fleet"]);
  });
  test("die Env verschiebt die Basis ihrer Schiene, die Obergrenze bleibt 5 darüber; die Orchestratorin behält ihre Zeile", () => {
    expect(thresholdOf("program-main", 44, null)).toEqual({ kind: "program-main", basePct: 44, capPct: 49, from: "env" });
    expect(thresholdOf("bau", 44, null)).toMatchObject({ basePct: 44, capPct: 49, from: "env" });
    expect(thresholdOf("lane", 30, null)).toMatchObject({ basePct: 30, capPct: 35, from: "env" });
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
    expect(t.startsWith("[fleet] Dein Kontext ist bei 46% (460000 von 1000000 Tokens im Fenster). ")).toBe(true);
    expect(t).toContain("Die Schwelle dieser Session ist 44 %, die Obergrenze 49 %.");
    expect(t).toContain("Fleet übergibt nicht selbst, du wählst den Punkt");
    expect(t).toContain("POST /api/self/handover");
    expect(t).toContain("POST /api/self/succeed");
    expect(t).not.toContain("Obergrenze ist erreicht");
  });
  test("ein Text für jede Schiene außer der Lane: die Program-MAIN liest dasselbe wie eine Session", () => {
    expect(hintText(facts("program-main", 46))).toBe(hintText(facts("session", 46)));
  });
  test("die Lane gibt mit ihrem handoff-Report weiter, nicht mit einer stehenden Übergabe", () => {
    const t = hintText(facts("lane", 46));
    expect(t).toContain("Die Schwelle dieser Lane ist 44 %");
    expect(t.indexOf("committe")).toBeLessThan(t.indexOf("status `handoff`"));
    expect(t.indexOf("status `handoff`")).toBeLessThan(t.indexOf("POST /api/self/succeed"));
    expect(t).not.toContain("/api/self/handover");
  });
  test("fällig sagt er, warum: Obergrenze oder kalter Cache", () => {
    expect(hintText(facts("session", 50))).toContain("Die Obergrenze ist erreicht.");
    expect(hintText(facts("session", 46, "kalt"))).toContain("Dein Cache ist kalt");
  });
  test("keine alten Kanäle: weder Watches, Autos noch Linien-Record oder HANDOFF.md", () => {
    for (const k of ["session", "lane", "program-main"] as const)
      for (const c of ["hint", "compact", "succeed"] as const)
        expect(hintText(facts(k, 50, "warm", c))).not.toMatch(/Watches|Autos|Linien-Record|HANDOFF\.md/);
  });
  test("ein Text je Wahl: er nennt die Handlung und bittet um die stehende Übergabe", () => {
    const compact = hintText(facts("session", 46, "warm", "compact"));
    expect(compact).toContain("Ab 49 % oder kurz bevor dein Cache kalt wird tippt Fleet `/compact`, sobald du ruhst");
    expect(compact).toContain("POST /api/self/handover");
    expect(compact).not.toContain("Fleet übergibt nicht selbst");
    const succeed = hintText(facts("session", 46, "warm", "succeed"));
    expect(succeed).toContain("öffnet Fleet in diesem Slot eine neue Session, sobald du ruhst");
    expect(succeed).toContain("in deine Pane wird dafür nichts getippt");
    expect(succeed).toContain("POST /api/self/handover");
    expect(hintText(facts("lane", 46, "warm", "compact"))).toContain("Committe vorher deinen Stand.");
  });
  test("kurz vor kalt sagt er es", () => {
    expect(hintText(facts("session", 46, "warm", "succeed", true))).toContain("Dein Cache wird bald kalt.");
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
  test("Owner 07.08.: „[Zitat entfernt]“ — ab Werk eine neue Session, die Lane bleibt beim Hinweis", () => {
    for (const kind of ["orchestrator", "program-main", "bau", "session"] as const) expect(fleetChoiceOf(kind)).toBe("succeed");
    expect(fleetChoiceOf("lane")).toBe("hint");
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
    expect(line).toContain("Ab 45 % schreibt Fleet dir einen Hinweis");
    expect(line).toContain("bis 50 % arbeitest du weiter, solange dein Cache warm ist");
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
