import { describe, expect, test } from "bun:test";
import { abweichungen, gleich, normal, tuer, vorschau, wahlAus, wahlenVon } from "./start-wahl";

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
    expect(abweichungen(w).map((d) => `${d.zeichen} ${d.wort}`)).toEqual(["~ Asks you: Only plans", "+ First task", "+ Fleet's guides", "+ Rights: Builds"]);
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
