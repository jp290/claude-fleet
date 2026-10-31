// DIE STEINE DES STARTS IN INFO → SETUP (src/start-steine.ts): die drei Sitze der Aufgabe, Sitz für Sitz gegen
// ihre Fassung — ein eigener Agent mit Rolle und Konzept in einem anderen Repo, ein Sitz aus einer fleet-setup/1-
// Datei mit leerem persönlichen Platz, und ein schlichter Sitz ohne Steine, dessen Ansicht sich nicht ändert.
// Jeder Stein wird allein an der Quelle erkannt, die der Server an seinen Abschnitt schreibt, und sein Satz kommt
// aus dem Stein selbst (server/setup-datei.ts#startBlockAusSteinen, server/sitz-wissen.ts#packBlock,
// server/sitz-reise.ts#leererPlatzZeilen, server/tuer-rechte.ts#rechteZeilen): die Texte hier sind die, die diese
// Funktionen wirklich schreiben.
import { describe, expect, test } from "bun:test";
import { korrekturStein } from "../server/korrektur-stein";
import { startSteine } from "./start-steine";
import type { UmfeldAbschnitt, UmfeldTeil } from "./fassung-umfeld-zeilen";

const abschnitt = (id: string, quelle: string | null, text: string): UmfeldAbschnitt =>
  ({ id, quelle, text, bytes: text.length });
const teil = (id: string, abschnitte: readonly UmfeldAbschnitt[]): UmfeldTeil => ({ id, abschnitte });

// SITZ 1 · EIN EIGENER AGENT IN EINEM ANDEREN REPO MIT ROLLE UND KONZEPT: der Rollenstein trägt Starttext,
// Rechtezeile und den Konzept-Block (server/setup-datei.ts#startBlockAusSteinen), seine Packs stehen je als
// eigener „wissen“-Abschnitt mit Quelle und Autor (server.ts#fassungFuerSlot), der Richtungsplatz daneben.
const eigenAgentMitRolle = (): readonly UmfeldTeil[] => [
  teil("liest", [
    abschnitt("rolle", "server/setup-datei.ts#steineFuerAgentWahl (role stone)", [
      "FLEET ROLE (orchestratorin, author: Orchestrator)",
      "",
      "--- ROLE --- Orchestrator: turns owner intent into Programs and cards and brings the owner only real limit questions.",
      "",
      "ROLE RIGHTS (step 2 bundle, granted to this seat): seat.open — open a seat; land.branch — land its own branch",
      "",
      "+ concept k-ziel (author: owner)",
      "",
      "# Where Fleet goes",
      "",
      "Every agent a person can set up well, and every setup something anyone can see.",
    ].join("\n")),
    abschnitt("richtung", "server/setup-datei.ts#RICHTUNG_PLATZ",
      "DIRECTION — empty place: the direction is the person's own. Fill it with yours, or start without one."),
    abschnitt("wissen", "server/sitz-wissen.ts#renderSeatStart", "FLEET LIBRARY (server/sitz-wissen.ts): …"),
    abschnitt("wissen", "server/setup-datei.ts#roleStein (working-with-the-owner)",
      "--- working-with-the-owner (docs/packs/working-with-the-owner.md · # Working with the owner) ---\n"
      + "# Working with the owner\n\nRead this when you talk with the owner or write something they will read."),
  ]),
  teil("darf", [
    abschnitt("darf", "server/tuer-rechte.ts#rechteZeilen (Server-Rechte und Zaun)",
      "FLEET SERVER RIGHTS (checked at Fleet's doors): seat.open — open a seat; land.branch — land its own branch. "
      + "Source: role generic + 0 grant(s).\nFLEET'S FENCE: the four start switches are Claude Code permission rules."),
  ]),
];

// SITZ 2 · EIN SITZ AUS EINER fleet-setup/1-DATEI MIT LEEREM PERSÖNLICHEN PLATZ: Rolle als Verweis mit Autor und
// Freigabe (server.ts#fassungSitzRolle), ihr Starttext unter „eigenes“ (server/agentmd.ts#agentMdBlock), der
// mitgereiste Pack mit „mitgereist“-Wurzel in der Quelle (server/sitz-reise.ts#sitzWissen) und die leeren
// Plätze als Zeilen (server/sitz-reise.ts#leererPlatzZeilen).
const importierterSitz = (): readonly UmfeldTeil[] => [
  teil("liest", [
    abschnitt("rolle", "Slot.sitz.rolle (role stone from fleet-setup/1)", [
      "FLEET ROLE nachtwache (author: Fleet der Nacht) — the role stone this seat was imported with; its start text rides in „Liest › Eigenes“.",
      "ROLE RIGHTS (step 2 bundle, confirmed by this Fleet's owner — the seat starts with them): seat.open, land.branch",
    ].join("\n")),
    abschnitt("eigenes", "Slot.agentMd (Profil „setup-wache“)",
      "AGENT-MD (profile “setup-wache”, file “Nachtwache”, set by the owner at start):\nRuns the night watch and lands what it checked."),
    abschnitt("wissen", "mitgereist/docs/packs/verify-e2e.md · # verify-e2e",
      "--- verify-e2e (docs/packs/verify-e2e.md · # verify-e2e · author: Fleet der Nacht) ---\n"
      + "# Verify e2e\n\nRun and read the e2e check before you call the work done."),
    abschnitt("wissen", "server/sitz-reise.ts#leererPlatzZeilen", [
      "EMPTY PLACE this-machine — the person's own pack, empty here; the importer fills it with their own text or the pack of that name in their library.",
      "DIRECTION — empty place: the direction is the person's own. Fill it with yours, or start without one.",
    ].join("\n")),
  ]),
  teil("darf", [
    abschnitt("darf", "server/tuer-rechte.ts#rechteZeilen (Server-Rechte und Zaun)",
      "FLEET SERVER RIGHTS (checked at Fleet's doors): seat.open — open a seat; land.branch — land its own branch. "
      + "Source: role generic + 2 grant(s).\nFLEET'S FENCE: the four start switches are Claude Code permission rules."),
  ]),
];

// SITZ 3 · EIN SCHLICHTER SITZ: keine Rolle, Fleets Bibliothek aus ihrem eigenen Baum, keine Zusage — kein Stein.
const schlichterSitz = (): readonly UmfeldTeil[] => [
  teil("liest", [
    abschnitt("rolle", null, "keine stehende Rolle — eine freie Session startet ohne Rollenkarte"),
    abschnitt("wissen", "server/sitz-wissen.ts#renderSeatStart", "FLEET LIBRARY (server/sitz-wissen.ts): Fleet's knowledge for your seat."),
    abschnitt("wissen", "/repo/docs/packs/working-with-the-owner.md · # Working with the owner",
      "--- working-with-the-owner (/repo/docs/packs/working-with-the-owner.md · # Working with the owner) ---\n"
      + "# Working with the owner\n\nRead this when you talk with the owner."),
  ]),
  teil("darf", [
    abschnitt("darf", "server/tuer-rechte.ts#rechteZeilen (Server-Rechte und Zaun)",
      "FLEET SERVER RIGHTS (checked at Fleet's doors): seat.open — open a seat; land.branch — land its own branch. "
      + "Source: role generic + 0 grant(s).\nFLEET'S FENCE: the four start switches are Claude Code permission rules."),
  ]),
];

describe("start-steine: ein eigener Agent mit Rolle und Konzept", () => {
  test("nennt jeden Stein seiner Fassung: Rolle, Pack, Konzept, Richtung, Rechte — in dieser Ordnung", () => {
    expect(startSteine(eigenAgentMitRolle()).map((s) => [s.art, s.label, s.id])).toEqual([
      ["rolle", "Role", "orchestratorin"],
      ["pack", "Context pack", "working-with-the-owner"],
      ["konzept", "Concept", "k-ziel"],
      ["richtung", "Direction", null],
      ["rechte", "Rights", null],
    ]);
  });
  test("jede Zeile sagt, was der Stein dem Agenten gibt — aus dem Stein selbst, nie die Kennung", () => {
    const steine = startSteine(eigenAgentMitRolle());
    expect(steine[0]!.satz).toBe("turns owner intent into Programs and cards and brings the owner only real limit questions");
    expect(steine[1]!.satz).toBe("Read this when you talk with the owner or write something they will read.");
    expect(steine[2]!.satz).toBe("Every agent a person can set up well, and every setup something anyone can see.");
    expect(steine[3]!.satz).toBe("empty place: yours to fill");
    expect(steine[4]!.satz).toBe("may open a seat; land its own branch");
  });
  test("Pack und Konzept tragen ihren Namen wie das Startfenster (den Titel ihres Texts) und ihren Autor", () => {
    const steine = startSteine(eigenAgentMitRolle());
    expect([steine[1]!.name, steine[1]!.autor]).toEqual(["Working with the owner", "Fleet"]);
    expect([steine[2]!.name, steine[2]!.autor]).toEqual(["Where Fleet goes", "owner"]);
  });
  test("der Klick zeigt den ganzen Stein: Quelle und Text des Abschnitts, der ihn trägt", () => {
    const rolle = startSteine(eigenAgentMitRolle())[0]!;
    expect(rolle.quelle).toBe("server/setup-datei.ts#steineFuerAgentWahl (role stone)");
    expect(rolle.text).toContain("FLEET ROLE (orchestratorin, author: Orchestrator)");
    expect(rolle.text).toContain("+ concept k-ziel (author: owner)");
  });
});

describe("start-steine: ein Sitz aus einer fleet-setup/1-Datei mit leerem persönlichen Platz", () => {
  test("nennt Rolle, mitgereisten Pack, Richtung, den leeren Platz und die Rechte — Stein für Stein", () => {
    const steine = startSteine(importierterSitz());
    expect(steine.map((s) => [s.art, s.id])).toEqual([
      ["rolle", "nachtwache"], ["pack", "verify-e2e"], ["richtung", null], ["platz", "this-machine"], ["rechte", null],
    ]);
  });
  test("der Starttext der importierten Rolle steht unter „eigenes“; die Zeile sagt ihn als Satz", () => {
    const rolle = startSteine(importierterSitz())[0]!;
    expect(rolle.satz).toBe("Runs the night watch and lands what it checked");
    expect(rolle.autor).toBe("Fleet der Nacht");
    expect(rolle.text).toContain("confirmed by this Fleet's owner");
  });
  test("der mitgereiste Pack nennt Quelle, Autor und seine eigenen Anfangszeilen", () => {
    const pack = startSteine(importierterSitz()).find((s) => s.art === "pack")!;
    expect([pack.name, pack.autor, pack.satz]).toEqual(["Verify e2e", "Fleet der Nacht",
      "Run and read the e2e check before you call the work done."]);
    expect(pack.quelle).toBe("mitgereist/docs/packs/verify-e2e.md · # verify-e2e");
  });
  test("der leere persönliche Platz und der Richtungsplatz stehen je als eigene Zeile", () => {
    const steine = startSteine(importierterSitz());
    expect(steine.find((s) => s.art === "platz")).toMatchObject({ id: "this-machine", satz: "this-machine: yours to fill" });
    expect(steine.find((s) => s.art === "richtung")).toMatchObject({ satz: "empty place: yours to fill" });
  });
  test("die Rechte zeigen, weil der Rollenstein freigegeben ist — die Fassung sagt es selbst", () => {
    expect(startSteine(importierterSitz()).find((s) => s.art === "rechte")!.satz)
      .toBe("may open a seat; land its own branch");
  });
});

describe("start-steine: ein schlichter Sitz", () => {
  test("trägt keinen Stein: keine Rolle, kein Pack der Bibliothek, kein Bundel, keine Zeile", () => {
    expect(startSteine(schlichterSitz())).toEqual([]);
  });
  test("auch die Rollenkarte einer Lane oder MAIN ist kein Stein des Starts", () => {
    const lane = [...schlichterSitz()];
    lane[0] = teil("liest", [
      abschnitt("rolle", "server/rollenkarten.ts#LANE_ROLE_CARD", "--- ROLE --- Lane: you carry out exactly one card and report to your MAIN."),
      ...lane[0]!.abschnitte.slice(1),
    ]);
    expect(startSteine(lane)).toEqual([]);
  });
});

describe("start-steine: was ein Stein nicht mitbringt", () => {
  test("ein Pack ohne eigenen Einleitungsabsatz sagt in schlichten Worten, was er ist", () => {
    const teile = [teil("liest", [abschnitt("wissen", "mitgereist/nur-liste.md · # nur-liste",
      "--- nur-liste (nur-liste.md · # nur-liste) ---\n# Nur Liste\n\n- erster Punkt\n- zweiter Punkt")])];
    const pack = startSteine(teile)[0]!;
    expect([pack.id, pack.name, pack.satz]).toEqual(["nur-liste", "Nur Liste", "a context pack"]);
  });
  test("ein Skill-Pack sagt seine useWhen-Zeile, die die Fassung als seinen ganzen Text trägt", () => {
    const teile = [teil("liest", [abschnitt("wissen", "mitgereist/docs/skills/schaerfen.md · # Schärfen",
      "- schaerfen: Turns your rough order into a sharp one, on request.")])];
    expect(startSteine(teile)[0]).toMatchObject({ id: "schaerfen", satz: "Turns your rough order into a sharp one, on request." });
  });
  test("eine Rolle, deren Starttext keinen Satz hergibt, sagt die Kennung in schlichten Worten", () => {
    const teile = [teil("liest", [
      abschnitt("rolle", "server/setup-datei.ts#steineFuerAgentWahl (role stone)",
        "FLEET ROLE (wache, author: Wache)\n\n# Wache\n\nROLE RIGHTS (step 2 bundle, granted to this seat): none"),
    ])];
    expect(startSteine(teile)[0]).toMatchObject({ id: "wache", satz: "role wache" });
  });
  test("nur erbetene, nicht freigegebene Rechte einer importierten Rolle zeigen keine Zeile", () => {
    const teile = [
      teil("liest", [abschnitt("rolle", "Slot.sitz.rolle (role stone from fleet-setup/1)",
        "FLEET ROLE nachtwache (author: Fleet der Nacht) — the role stone this seat was imported with; its start text rides in „Liest › Eigenes“.\n"
        + "ROLE RIGHTS (step 2 bundle, only requested by the file — not confirmed, the seat starts without them): seat.open, land.branch")]),
      ...schlichterSitz()!.slice(1),
    ];
    expect(startSteine(teile).some((s) => s.art === "rechte")).toBe(false);
  });
  test("eine Zusage aus dem Lauf ist kein Stein des Starts — dieselbe Zahl, aber kein Start", () => {
    const teile = schlichterSitz().map((t) => t.id === "darf"
      ? teil("darf", [abschnitt("darf", "server/tuer-rechte.ts#rechteZeilen (Server-Rechte und Zaun)",
        "FLEET SERVER RIGHTS (checked at Fleet's doors): text.pack — write a pack; seat.open — open a seat. "
        + "Source: role generic + 1 grant(s).\nFLEET'S FENCE: the four start switches are Claude Code permission rules.")])
      : t);
    expect(startSteine(teile)).toEqual([]);
  });
});

// SITZ 4 · EIN SITZ OHNE ROLLE IN FLEETS REPO trägt die Korrekturen des Owners als Stein (server/korrektur-stein.ts#korrekturStein,
// server.ts#fassungKorrekturZeiger); steht an ihrer Stelle der Zeiger, weil die Tür abwies, ist das kein Stein.
describe("start-steine: die Korrekturen des Owners", () => {
  const stein = korrekturStein({ konzept: "k-owner-korrekturen", version: 4, sha256: "abcdef0123456789", geltendeEintraege: [
    { id: "karten-bleiben-stehen", aussage: "Karten bleiben stehen.", geltung: { modi: "*" } },
    { id: "plan-an-vorgabe-abschneiden", aussage: "Pläne an der Vorgabe abschneiden.", geltung: { modi: ["planung"] } }] }, "http://h:1/tuer");
  const quelle = "konzept k-owner-korrekturen · server/korrektur-stein.ts#korrekturStein";
  test("eine Zeile gleich nach der Rolle: deine Korrekturen, vom Owner, mit der Zahl seiner Entscheidungen, der Klick zeigt den ganzen Stein", () => {
    const steine = startSteine([teil("liest", [abschnitt("korrekturen", quelle, stein)])]);
    expect(steine.map((s) => [s.art, s.label, s.id, s.name, s.autor, s.satz])).toEqual([
      ["korrekturen", "Your corrections", "k-owner-korrekturen", "your corrections v4", "owner",
        `2 of your decisions, each with its id · ${stein.length} B`]]);
    // die Größe steht wie im Startfenster: ab 1000 Bytes in kB
    const gross = startSteine([teil("liest", [{ ...abschnitt("korrekturen", quelle, stein), bytes: 5039 }])]);
    expect(gross[0]!.satz).toBe("2 of your decisions, each with its id · 5.0 kB");
    expect([steine[0]!.quelle, steine[0]!.text]).toEqual([quelle, stein]);
  });
  test("der Zeiger, der bei einer abweisenden Tür an ihrer Stelle steht, ist kein Stein", () => {
    expect(startSteine([teil("liest", [abschnitt("korrekturen", "AGENTS.md (What applies here) · server.ts#korrekturLeserFor",
      "Zeiger, nicht im Start: GET /api/self/konzepte/k-owner-korrekturen/leseansicht …")])])).toEqual([]);
  });
});
