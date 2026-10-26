import { describe, expect, test } from "bun:test";
import { abweichungen, gleich, normal, packsAktiv, schaltePack, tuer, vorschau, wahlAus, wahlenVon } from "./start-wahl";

describe("the choices of the start window, read by the doors", () => {
  test("normal sends nothing: the session starts like claude by hand", () => {
    expect(vorschau(normal())).toEqual({});
    expect(tuer(normal())).toEqual({});
    expect(abweichungen(normal())).toEqual([]);
  });
  test("your rules off goes to both doors as weglassen claudeMd and rules", () => {
    const w = { ...normal(), eigeneRegeln: false };
    expect(tuer(w)).toEqual({ weglassen: { claudeMd: true, rules: true } });
    expect(vorschau(w)).toEqual({ weglassen: JSON.stringify({ claudeMd: true, rules: true }) });
    expect(abweichungen(w)).toEqual([{ id: "rules", zeichen: "−", wort: "Your rules left out" }]);
  });
  test("its own notebook goes only with a branch of its own; the preview never asks for it", () => {
    const ohne = { ...normal(), notizbuch: true }, mit = { ...ohne, branch: "fix-hud" };
    expect(tuer(ohne)).toEqual({});
    expect(tuer(mit)).toEqual({ notizbuch: "branch" });
    expect(vorschau(mit)).toEqual({});
    expect(abweichungen(mit).map((d) => d.id)).toEqual(["branch", "notebook"]);
  });
  test("rights, guides, mode and the first task go with the start; the task is its goal", () => {
    const w = { ...normal(), rechte: "bauen" as const, bibliothek: true, permissionMode: "plan", aufgabe: "  Fix the HUD.  " };
    expect(tuer(w)).toEqual({ permissionMode: "plan", rechte: { stufe: "bauen", an: [], aus: [] }, bibliothek: true, goal: "Fix the HUD." });
    expect(abweichungen(w).map((d) => `${d.zeichen} ${d.wort}`)).toEqual(["~ Asks you: Only plans", "+ First task", "+ Fleet's library", "+ Rights: Builds"]);
  });
  test("Plan first goes as the plan mode and comes back as Plan first, Asks you untouched", () => {
    const w = { ...normal(), planFirst: true };
    expect(tuer(w)).toEqual({ permissionMode: "plan" });
    expect(vorschau(w)).toEqual({ permissionMode: "plan" });
    expect(abweichungen(w)).toEqual([{ id: "plan", zeichen: "+", wort: "Plan first" }]);
    expect(wahlAus(wahlenVon(w)).wahl).toEqual(w);
  });
  test("a server left out at Connectors goes to both doors as weglassen.mcp and comes back from a saved agent", () => {
    const w = { ...normal(), mcpAus: ["claude_ai_Gmail", "plugin_playwright_playwright"] };
    expect(tuer(w)).toEqual({ weglassen: { mcp: ["claude_ai_Gmail", "plugin_playwright_playwright"] } });
    expect(vorschau(w)).toEqual({ weglassen: JSON.stringify({ mcp: ["claude_ai_Gmail", "plugin_playwright_playwright"] }) });
    expect(abweichungen(w)).toEqual([{ id: "connectors", zeichen: "−", wort: "Connectors: 2 left out" }]);
    const zurueck = wahlAus(wahlenVon(w));
    expect(zurueck.fremd).toEqual([]);
    expect(zurueck.wahl).toEqual(w);
  });
});

describe("a saved agent and the window's choice", () => {
  test("what the window sets comes back unchanged from the agent's fields", () => {
    const w = { ...normal(), model: "claude-sonnet-5-5", permissionMode: "acceptEdits", eigeneRegeln: false, hooks: false, pluginsAus: ["figma"],
      rechte: "bauen" as const, bibliothek: true, notizbuch: true, schwelle: 45, tools: ["Read", "Edit"] };
    const f = wahlenVon(w);
    expect(f).toEqual({ model: "claude-sonnet-5-5", permissionMode: "acceptEdits", weglassen: { claudeMd: true, rules: true, hooks: true, plugins: ["figma"] },
      tools: ["Read", "Edit"], notizbuch: "branch", rechte: { stufe: "bauen", an: [], aus: [] }, bibliothek: true, schwelle: 45 });
    expect(wahlAus(f)).toEqual({ wahl: w, fremd: [] });
  });
  test("a role, a profile or another harness is not the window's to set: the agent starts whole", () => {
    expect(wahlAus({ rolle: "orchestratorin" }).fremd).toEqual(["rolle"]);
    expect(wahlAus({ harness: "pi", model: "deepseek-flash" }).fremd).toEqual(["harness"]);
    expect(wahlAus({ weglassen: { claudeMd: true } }).fremd).toEqual(["weglassen"]);
    expect(wahlAus({ harness: "claude" }).fremd).toEqual([]);
  });
  test("the first task and the branch never belong to the agent: with them it is still the same agent", () => {
    expect(wahlenVon({ ...normal(), aufgabe: "Fix it.", branch: "fix" })).toEqual({});
    expect(gleich(normal(), { ...normal(), aufgabe: "Fix it.", branch: "fix" })).toBe(true);
    expect(gleich(normal(), { ...normal(), hooks: false })).toBe(false);
  });
});

// EACH CONTEXT PACK A STONE OF ITS OWN (owner 25.10.): no choice gives what the place gives; a list is exactly these packs, at both doors
describe("context packs one by one", () => {
  test("no choice sends nothing; a list goes as bibliothek, and an empty one switches the library off", () => {
    expect(tuer(normal()).bibliothek).toBeUndefined();
    expect(tuer({ ...normal(), packs: ["who-it-is-for", "mein-agent"] }).bibliothek).toEqual(["who-it-is-for", "mein-agent"]);
    expect(vorschau({ ...normal(), packs: ["who-it-is-for", "mein-agent"] }).bibliothek).toBe("who-it-is-for,mein-agent");
    expect(tuer({ ...normal(), packs: [] }).bibliothek).toBe(false);
    expect(vorschau({ ...normal(), packs: [] }).bibliothek).toBe("false");
  });
  test("what differs is counted against the place: a pack switched on is +, one of the place's switched off is −", () => {
    const ort = { standard: ["who-it-is-for", "working-in-few-calls"], wort: (id: string) => id === "who-it-is-for" ? "Who it is for" : id };
    expect(abweichungen({ ...normal(), packs: ["who-it-is-for", "working-in-few-calls"] }, undefined, ort)).toEqual([]);
    expect(abweichungen({ ...normal(), packs: ["working-in-few-calls", "mein-agent"] }, undefined, ort).map((d) => `${d.zeichen} ${d.wort}`))
      .toEqual(["+ Context pack: mein-agent", "− Context pack: Who it is for"]);
    expect(abweichungen({ ...normal(), packs: ["mein-agent"] }).map((d) => [d.id, d.zeichen])).toEqual([["pack:mein-agent", "+"]]);
  });
  test("an agent saved with its packs comes back with them, as the window's own choice", () => {
    const w = { ...normal(), packs: ["who-it-is-for", "mein-agent"] };
    expect(wahlenVon(w)).toEqual({ bibliothek: ["who-it-is-for", "mein-agent"] });
    expect(wahlAus(wahlenVon(w))).toEqual({ wahl: w, fremd: [] });
    expect(wahlAus(wahlenVon({ ...normal(), packs: [] }))).toEqual({ wahl: { ...normal(), packs: [] }, fremd: [] });
  });
});

// WHAT THE WINDOW SHOWS ON IS WHAT THE START GETS (owner 25.10.: „[Zitat entfernt]“): the place's
// packs without a choice, and a variant (seat-choice, `statt`) never beside the one it replaces, as the server drops it
describe("the packs a start gets, switch by switch", () => {
  const ort = ["who-it-is-for", "no-longer-humans-gentle"], katalog = [{ id: "who-it-is-for" }, { id: "no-longer-humans-gentle" },
    { id: "no-longer-humans-hard", statt: "no-longer-humans-gentle" }], reihe = katalog.map((p) => p.id);
  test("without a choice the place's packs; the library whole for an agent saved before 25.10.; none where the place gives none", () => {
    expect(packsAktiv(normal(), ort, ort, katalog)).toEqual(ort);
    expect(packsAktiv({ ...normal(), bibliothek: true }, [], ort, katalog)).toEqual(ort);
    expect(packsAktiv(normal(), [], ort, katalog)).toEqual([]);
  });
  test("a variant switched on takes the other's place, switched off gives it back, and that is normal again", () => {
    const w = normal();
    schaltePack(w, "no-longer-humans-hard", ort, ort, katalog, reihe);
    expect(packsAktiv(w, ort, ort, katalog)).toEqual(["who-it-is-for", "no-longer-humans-hard"]);
    expect(tuer(w).bibliothek).toEqual(["who-it-is-for", "no-longer-humans-hard"]);
    schaltePack(w, "no-longer-humans-gentle", ort, ort, katalog, reihe);
    expect(packsAktiv(w, ort, ort, katalog)).toEqual(["who-it-is-for", "no-longer-humans-gentle"]);
    expect(w.packs).toBeNull();
    schaltePack(w, "no-longer-humans-hard", ort, ort, katalog, reihe);
    schaltePack(w, "no-longer-humans-hard", ort, ort, katalog, reihe);
    expect(w.packs).toBeNull();
  });
  test("an own setup: on is exactly the chosen ones, off again is no choice", () => {
    const w = normal();
    schaltePack(w, "who-it-is-for", [], ort, katalog, reihe);
    expect(packsAktiv(w, [], ort, katalog)).toEqual(["who-it-is-for"]);
    schaltePack(w, "who-it-is-for", [], ort, katalog, reihe);
    expect(w.packs).toBeNull();
  });
});
