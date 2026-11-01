// DIE ÜBERSICHT FÜR AGENTEN (C1, ~/local-notes/lagebild/auftrag.md; Owner 1.11.: „[Zitat entfernt]“).
// Die reinen Teile: jedes Feld aus den Tatsachen, die Fleet hält, mit seiner Quelle, und unbekannt mit Grund statt geraten; die Reichweite
// (die Linie, die Orchestratorin alles, die eigenen Sitze des Owners streng); keine Rückfrage mit Wortlaut. Die Tür selbst: lagebild-tuer.test.ts.
import { describe, expect, test } from "bun:test";
import { lagebild, lageZweigAus, lebendeZeile, naeherFuer, OWNER_SITZ_FELDER, warteLesung, type LageFakten } from "./lagebild";
import { checkAusLedger } from "./branches";
import type { Sicht } from "./konstellation-sicht";

const NOW = 1_800_000_000_000, TAKT = { warteTickMs: 5000, ruhigMs: 5000 };
const LINIE = (n: number) => n.toString(16).padStart(24, "0");
function fakt(slot: number, mehr: Partial<LageFakten> = {}): LageFakten {
  return { slot, openedAt: NOW - 3_600_000, cwd: `/w/${slot}`, linie: LINIE(slot), openedBy: null, lane: false, fleetRolle: null, agent: "alive", name: `Sitz ${slot}`, role: null, purpose: null,
    harness: null, model: "claude-opus-5-5", effort: null, sleepingAt: null, retiringAt: null, lastOutput: NOW - 120_000,
    warte: { claude: true, look: NOW - 2000, frageSeit: null, vertrauenAt: null }, mail: { count: 0, oldestAt: null, missing: [] }, hint: null,
    ctxPct: 41.5, cache: { at: NOW - 60_000, warm: true }, ...mehr };
}
const von = (o: LageFakten) => ({ slot: o.slot, openedAt: o.openedAt, cwd: o.cwd, linie: o.linie! });
const leer: Sicht = { me: { slot: 1, role: null, reportsTo: null, position: null }, seats: [] };
const sitz = (slot: number, relations: string[], state: "live" | "ended" = "live") => ({ slot, position: null, name: `Sitz ${slot}`, relations,
  folder: { path: null, hint: null }, role: null, purpose: null, harness: null, model: null, effort: null, state, address: null });

describe("je Sitz jedes Feld, mit Quelle oder mit Grund", () => {
  const lead = fakt(1);
  const kind = fakt(2, { openedBy: von(lead), harness: "claude", effort: "high", ctxPct: 63.2, cache: { at: NOW - 600_000, warm: false },
    warte: { claude: true, look: NOW - 3000, frageSeit: NOW - 240_000, vertrauenAt: NOW - 3000 },
    mail: { count: 2, oldestAt: NOW - 900_000, missing: [] }, hint: { nudges: 2, lastAt: NOW - 300_000, gaveUp: false } });

  test("ein Kind: Name, Harness, Modell, Effort, Zustand seit, Öffnerin nach der Linie, Rückfrage, Vertrauensfrage, Post, Übergabe-Hinweis, Kontext, Cache, still seit, Branch", () => {
    const z = lebendeZeile(kind, "child", { alle: [lead, kind], naeher: true, now: NOW, takt: TAKT,
      zweig: { branch: "branch/bau", head: "abc123", check: { state: "green", at: NOW - 1000 }, why: {} } });
    expect(z).toEqual({ slot: 2, relation: "child", name: "Sitz 2", role: null, purpose: null, harness: "claude", model: "claude-opus-5-5", effort: "high",
      state: "live", since: NOW - 3_600_000, openedBy: { slot: 1, live: true },
      waits: [{ kind: "permission", since: NOW - 240_000 }, { kind: "trust", seenAt: NOW - 3000 }, { kind: "mail", count: 2, oldestAt: NOW - 900_000 },
        { kind: "handover", step: "hinted", nudges: 2, lastAt: NOW - 300_000, gaveUp: false }],
      ctxPct: 63.2, cacheWarm: false, agent: "alive", idleMs: 120_000, branch: { name: "branch/bau", head: "abc123", check: { state: "green", at: NOW - 1000 } }, unknown: {} });
  });

  test("jedes Feld hat einen Eintrag in den Quellen", () => {
    const bild = lagebild({ ich: 1, sicht: { ...leer, seats: [sitz(2, ["child"])] }, alle: [lead, kind], orchestratorin: false, zweige: new Map(), now: NOW, bootAt: NOW - 1, takt: TAKT });
    const keys = Object.keys(bild.sources).flatMap((k) => k.split("/"));
    for (const feld of ["seats", "name", "role", "purpose", "harness", "model", "effort", "state", "since", "openedBy", "waits.permission", "waits.trust",
      "waits.mail", "waits.handover", "ctxPct", "cacheWarm", "idleMs", "branch"]) expect(keys).toContain(feld);
    expect(bild.sources["waits.handover"]).toContain(new Date(NOW - 1).toISOString());
  });

  test("was Fleet nicht weiß, ist null mit Grund: kein Transkript, kein Modellaufruf, nie beobachtet, kein frischer Blick, keine Adresse, kein Branch", () => {
    const blind = fakt(3, { openedBy: von(lead), ctxPct: null, cache: { at: null, warm: false }, lastOutput: 0, mail: null, hint: "no-session",
      warte: { claude: true, look: NOW - 60_000, frageSeit: NOW - 90_000, vertrauenAt: null } });
    const z = lebendeZeile(blind, "child", { alle: [lead, blind], naeher: true, now: NOW, takt: TAKT,
      zweig: { unknown: "the seat works on no branch of its own" } });
    expect([z.ctxPct, z.cacheWarm, z.idleMs, z.branch, z.waits]).toEqual([null, null, null, null, []]);
    expect(Object.keys(z.unknown!).sort()).toEqual(["branch", "cacheWarm", "ctxPct", "idleMs", "waits.handover", "waits.mail", "waits.permission", "waits.trust"]);
    expect(z.unknown!["waits.permission"]).toMatch(/no look by the waiting tick/);
    expect(z.unknown!.branch).toBe("the seat works on no branch of its own");
  });

  test("der Warte-Tick: ein alter Blick oder einer auf die vorige Belegung sagt nichts, ein Pi-Pane und ein schlafendes sind unbekannt", () => {
    expect(warteLesung(fakt(4, { warte: { claude: true, look: NOW - 16_000, frageSeit: NOW - 1, vertrauenAt: null } }), NOW, TAKT).unknown).toMatch(/no look/);
    // der Blick ist frisch, aber älter als diese Belegung: er galt der vorigen
    expect(warteLesung(fakt(4, { openedAt: NOW - 1000, warte: { claude: true, look: NOW - 2000, frageSeit: null, vertrauenAt: null } }), NOW, TAKT).unknown).toMatch(/no look/);
    expect(warteLesung(fakt(4, { harness: "pi", warte: { claude: false, look: null, frageSeit: null, vertrauenAt: null } }), NOW, TAKT).unknown).toMatch(/only Claude Code panes/);
    expect(warteLesung(fakt(4, { sleepingAt: NOW - 5000 }), NOW, TAKT).unknown).toMatch(/asleep/);
    expect(warteLesung(fakt(4), NOW, TAKT)).toEqual({ waits: [], unknown: null });
  });

  test("Zustand: eine laufende Nachfolge ist handing-over seit ihrem Moment und wartet auf die Übergabe, ein schlafender Sitz asleep seit dem Einschlafen", () => {
    const geht = lebendeZeile(fakt(5, { retiringAt: NOW - 30_000, hint: { nudges: 1, lastAt: NOW - 400_000, gaveUp: false } }), "fleet",
      { alle: [], naeher: false, now: NOW, takt: TAKT, zweig: undefined });
    expect([geht.state, geht.since, geht.waits]).toEqual(["handing-over", NOW - 30_000, [{ kind: "handover", step: "succession-under-way", since: NOW - 30_000 }]]);
    const schlaeft = lebendeZeile(fakt(6, { sleepingAt: NOW - 50_000 }), "fleet", { alle: [], naeher: false, now: NOW, takt: TAKT, zweig: undefined });
    expect([schlaeft.state, schlaeft.since]).toEqual(["asleep", NOW - 50_000]);
  });

  test("die Öffnerin nach der Linie: ihre Nachfolgerin auf einem anderen Platz ist live, eine fremde Session im selben Platz und Ordner nicht", () => {
    const nachfolgerin = fakt(9, { linie: LINIE(1), cwd: "/w/1" });
    const fremd = fakt(1, { linie: LINIE(77) });
    const k = fakt(2, { openedBy: { slot: 1, openedAt: NOW - 9_000_000, cwd: "/w/1", linie: LINIE(1) } });
    expect(lebendeZeile(k, "child", { alle: [nachfolgerin, k], naeher: false, now: NOW, takt: TAKT, zweig: undefined }).openedBy).toEqual({ slot: 9, live: true });
    expect(lebendeZeile(k, "child", { alle: [fremd, k], naeher: false, now: NOW, takt: TAKT, zweig: undefined }).openedBy).toEqual({ slot: 1, live: false });
  });

  test("die Rückfrage geht nur als „da, seit“: ihr Wortlaut steht in keiner Tatsache und in keiner Zeile", () => {
    const z = lebendeZeile(kind, "child", { alle: [lead, kind], naeher: false, now: NOW, takt: TAKT, zweig: undefined });
    expect(z.waits?.[0]).toEqual({ kind: "permission", since: NOW - 240_000 });
    expect(Object.keys(z.waits![0]!).sort()).toEqual(["kind", "since"]);
  });
});

describe("die Reichweite", () => {
  const lead = fakt(1), k1 = fakt(2, { openedBy: von(fakt(1)) }), k2 = fakt(3, { openedBy: von(fakt(1)) });
  const owner16 = fakt(16, { name: "Mein Agent", purpose: "Privates" });
  const lane = fakt(8, { lane: true });
  const fremdKind = fakt(11, { openedBy: von(owner16) });
  const alle = [lead, k1, k2, owner16, lane, fremdKind];

  test("ein Sitz sieht seine Linie, sonst nichts; still seit und Branch nur bei seinen Kindern", () => {
    const sicht: Sicht = { ...leer, seats: [sitz(2, ["child"]), sitz(3, ["child"])] };
    const bild = lagebild({ ich: 1, sicht, alle, orchestratorin: false, zweige: new Map(), now: NOW, bootAt: NOW, takt: TAKT });
    expect(bild.me.scope).toBe("line");
    expect(bild.seats.map((s) => s.slot)).toEqual([2, 3]);
    expect(bild.seats.every((s) => "idleMs" in s && "branch" in s)).toBe(true);
    // das Kind sieht die Öffnerin und sein Geschwister, aber an keinem den Öffner-Teil
    const ausKind = lagebild({ ich: 2, sicht: { ...leer, seats: [sitz(1, ["opener"]), sitz(3, ["sibling"])] }, alle, orchestratorin: false, zweige: new Map(), now: NOW, bootAt: NOW, takt: TAKT });
    expect(ausKind.seats.map((s) => [s.slot, s.relation, "idleMs" in s])).toEqual([[1, "opener", false], [3, "sibling", false]]);
  });

  test("die Orchestratorin sieht jeden Sitz; die eigenen des Owners außerhalb ihrer Linie nur mit Platz, Zustand und „ein Sitz des Owners“", () => {
    const orch = fakt(5);
    const bild = lagebild({ ich: 5, sicht: leer, alle: [...alle, orch], orchestratorin: true, zweige: new Map(), now: NOW, bootAt: NOW, takt: TAKT });
    expect(bild.me.scope).toBe("fleet");
    expect(bild.seats.map((s) => [s.slot, s.relation])).toEqual([[1, "owner-seat"], [2, "fleet"], [3, "fleet"], [8, "fleet"], [11, "fleet"], [16, "owner-seat"]]);
    expect(bild.seats.find((s) => s.slot === 16)).toEqual({ slot: 16, relation: "owner-seat", state: "live" });
    expect(JSON.stringify(bild)).not.toContain("Mein Agent");
    expect(JSON.stringify(bild)).not.toContain("Privates");
    expect(bild.ownerSeats).toEqual({ shows: OWNER_SITZ_FELDER, decision: "server/lagebild.ts#OWNER_SITZ_FELDER (the owner's word)" });
    // den Öffner-Teil hat sie an jedem Sitz, der keiner des Owners ist — wie an der Rückfrage
    expect(bild.seats.filter((s) => "idleMs" in s).map((s) => s.slot)).toEqual([2, 3, 8, 11]);
  });

  test("das Recht des Öffners: die Öffnerin nach der Linie, die Orchestratorin außer an den Sitzen des Owners, sonst niemand", () => {
    expect(naeherFuer(lead, k1, false)).toBe(true);
    expect(naeherFuer(k1, k2, false)).toBe(false);
    expect(naeherFuer(k1, lead, false)).toBe(false);
    expect(naeherFuer(fakt(5), fremdKind, true)).toBe(true);
    expect(naeherFuer(fakt(5), owner16, true)).toBe(false);
  });

  test("ein beendetes Kind steht da, ohne lebende Tatsachen und mit Grund", () => {
    const bild = lagebild({ ich: 1, sicht: { ...leer, seats: [sitz(7, ["child"], "ended")] }, alle: [lead], orchestratorin: false, zweige: new Map(), now: NOW, bootAt: NOW, takt: TAKT });
    expect(bild.seats[0]).toMatchObject({ slot: 7, relation: "child", state: "ended", since: null, ctxPct: null, cacheWarm: null });
    expect(bild.seats[0]!.unknown!.since).toMatch(/not when it ended/);
  });
});

// RUNDE 2 (~/local-notes/lagebild/pruefung.md, Entscheide der Orchestratorin)
describe("Runde 2", () => {
  const K = { konst: "k1", pos: "p1" };
  test("C1-1: ein vom Owner geöffneter Sitz auf einer Position der eigenen gespeicherten Konstellation steht ganz da; ein anderer Sitz des Owners bleibt streng; scopeRule und sources sagen es", () => {
    const lead = fakt(4), team = fakt(5, { name: "Team p5", ctxPct: 71 }), fremd = fakt(6, { name: "Fremd" });
    const sicht: Sicht = { ...leer, me: { ...leer.me, slot: 4, position: { ...K, name: "Leitung" } }, seats: [{ ...sitz(5, ["position"]), position: "p5" }] };
    const bild = lagebild({ ich: 4, sicht, alle: [lead, team, fremd], orchestratorin: false, zweige: new Map(), now: NOW, bootAt: NOW, takt: TAKT });
    expect(bild.seats.map((z) => [z.slot, z.relation])).toEqual([[5, "position"]]);
    expect(bild.seats[0]).toMatchObject({ name: "Team p5", ctxPct: 71, waits: [] });
    const own = /holding a position of your own saved constellation \(whoever opened them\)/;
    expect(bild.me.scopeRule).toMatch(own);
    expect(bild.sources.seats).toMatch(/holding a position of your own saved constellation, whoever opened them/);
    // bei der Orchestratorin: die Position ihrer Konstellation ganz, der übrige Sitz des Owners streng
    const orch = lagebild({ ich: 4, sicht, alle: [lead, team, fremd], orchestratorin: true, zweige: new Map(), now: NOW, bootAt: NOW, takt: TAKT });
    expect(orch.seats.map((z) => [z.slot, z.relation])).toEqual([[5, "position"], [6, "owner-seat"]]);
    expect(orch.seats[1]).toEqual({ slot: 6, relation: "owner-seat", state: "live" });
    expect(orch.me.scopeRule).toMatch(own);
  });

  test("C1-4: eine Program-MAIN, der Steward, eine Lane und eine Orchestratorin ohne Öffnerin sind nie „ein Sitz des Owners“ — die Orchestratorin sieht sie ganz, mit dem Öffner-Teil", () => {
    const orch = fakt(5);
    const main = fakt(2, { fleetRolle: "program-main", name: "MAIN" }), steward = fakt(3, { fleetRolle: "steward", name: "⚙ steward" });
    const lane = fakt(7, { lane: true, fleetRolle: "lane" }), owner = fakt(16);
    const bild = lagebild({ ich: 5, sicht: leer, alle: [orch, main, steward, lane, owner], orchestratorin: true, zweige: new Map(), now: NOW, bootAt: NOW, takt: TAKT });
    expect(bild.seats.map((z) => [z.slot, z.relation, "idleMs" in z])).toEqual([[2, "fleet", true], [3, "fleet", true], [7, "fleet", true], [16, "owner-seat", false]]);
    expect(bild.seats[0]).toMatchObject({ name: "MAIN", ctxPct: 41.5 });
  });

  test("C1-2: der Branch aus dem Tick ohne Kopf: Name da, Kopf null mit Grund", () => {
    const lead = fakt(1), k = fakt(2, { openedBy: von(fakt(1)) });
    const z = lebendeZeile(k, "child", { alle: [lead, k], naeher: true, now: NOW, takt: TAKT,
      zweig: { branch: "feat-a", head: null, check: null, why: { "branch.head": "no head", "branch.check": "no check" } } });
    expect(z.branch).toEqual({ name: "feat-a", head: null, check: null });
    expect(z.unknown).toMatchObject({ "branch.head": "no head", "branch.check": "no check" });
  });

  test("C1-5: die eigene Zeile steht unter me.seat, mit dem Lebenszeichen des Agenten und dem Branch", () => {
    const ich = fakt(1, { agent: "no-agent" });
    const bild = lagebild({ ich: 1, sicht: leer, alle: [ich], orchestratorin: false, now: NOW, bootAt: NOW, takt: TAKT,
      zweige: new Map([[1, { branch: "main", head: "f00", check: null, why: {} }]]) });
    expect(bild.me.seat).toMatchObject({ slot: 1, relation: "self", agent: "no-agent", branch: { name: "main", head: "f00" }, idleMs: 120_000 });
    expect(bild.seats).toEqual([]);
  });
});

// RUNDE 3 (~/local-notes/lagebild/pruefung.md, RUNDE 2: C1-8, C1-10)
describe("Runde 3: der Branch aus dem Tick", () => {
  const ZEILE = (base: string, tip = "h1") => ({ at: NOW - 5000, branch: "branch/x", tip, base, mergeable: true, verdict: "green" });
  const ein = (mehr: Partial<Parameters<typeof lageZweigAus>[0]> = {}) => lageZweigAus({ branch: "branch/x", head: "h1", gitAt: NOW - 4000, tickMs: 10_000, now: NOW,
    repo: "/r", mergeCheck: true, laeuft: false, base: "main", imBuch: true, rows: [ZEILE("main")], ...mehr });

  test("C1-10: ist der letzte Lauf des Git-Ticks älter als zwei Takte, sind Kopf und Check null mit seinem Alter; der Name bleibt", () => {
    expect(ein()).toEqual({ branch: "branch/x", head: "h1", check: { state: "green", at: NOW - 5000 }, why: {} });
    const alt = ein({ gitAt: NOW - 25_000 });
    expect(alt).toMatchObject({ branch: "branch/x", head: null, check: null });
    expect((alt as { why: Record<string, string> }).why["branch.head"]).toBe("the git tick last ran 25 s ago (more than two ticks of 10 s), so its head may be old");
    expect((ein({ gitAt: null }) as { why: Record<string, string> }).why["branch.check"]).toMatch(/last run failed, or it has not run/);
  });

  test("C1-8: dieselbe Regel wie die Branch-Sicht — eine andere Basis ist stale, ein laufender Check running; ohne Basis ohne git null mit Grund", () => {
    expect(ein({ rows: [ZEILE("elsewhere")] })).toMatchObject({ check: { state: "stale" } });
    expect(ein({ rows: [ZEILE("main", "h0")] })).toMatchObject({ check: { state: "stale" } });
    expect(ein({ laeuft: true })).toMatchObject({ check: { state: "running", at: null } });
    const ohneBuch = ein({ imBuch: false, base: null }) as { check: unknown; why: Record<string, string> };
    expect(ohneBuch.check).toBeNull();
    expect(ohneBuch.why["branch.check"]).toMatch(/^the base was not compared: branch\/x has no record in Fleet's branch book, .*\(the newest ledger row says green for this tip\)$/);
    const ohneBasis = ein({ base: null }) as { check: unknown; why: Record<string, string> };
    expect([ohneBasis.check, ohneBasis.why["branch.check"]]).toEqual([null, expect.stringMatching(/could not name the repository's integration branch \(no repoBases entry/)]);
    // die Branch-Sicht des Boards nimmt dieselbe Funktion: dieselben Fälle, dieselben Antworten
    expect(checkAusLedger([ZEILE("elsewhere")], "branch/x", "h1", "main", false).state).toBe("stale");
    expect(checkAusLedger([ZEILE("main")], "branch/x", "h1", "main", false).state).toBe("green");
    expect(checkAusLedger([], "branch/x", "h1", "main", false).state).toBe("none");
    expect(checkAusLedger([{ branch: "branch/x", exit: 3, at: 1 }], "branch/x", "h1", "main", false).state).toBe("uncheckable");
  });
});
