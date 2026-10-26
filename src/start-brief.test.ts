import { describe, expect, test } from "bun:test";
import { anzeige, fliessend, geaendert, gegenVorgaengerin, packDateien, regelDateien, startbrief, uebergabeHinweis, zeilenDiff, type Dazu, type Fassung } from "./start-brief";
import { schwelleAbschnitt, type SchwelleFakten } from "../server/fassung-umfeld";

const CLAUDE = "# Global Rules\n\n- Lead with the answer.\n- Report faithfully.";
const HOME_AGENTS = "# Home\n\n- Bun, not Node.";
const REPO_AGENTS = "# example-app\n\n- Keep the HUD above the Dock.";
const regeln = (mitEigenen: boolean) => {
  const d = [...(mitEigenen ? [{ pfad: "/Users/o/.claude/CLAUDE.md", bytes: 60, eigentum: "owner", t: CLAUDE }] : []),
    { pfad: "/Users/o/AGENTS.md", bytes: 30, t: HOME_AGENTS }, { pfad: "/Users/o/example-app/AGENTS.md", bytes: 40, t: REPO_AGENTS }];
  return { id: "projektregeln", quelle: d.map((x) => x.pfad).join("\n"), text: d.map((x, i) => `--- ${i + 1}/${d.length} ${x.pfad.split("/").pop()} ---\n${x.t}`).join("\n"),
    dateien: d.map(({ t: _t, ...x }) => x) };
};
const fassung = (o: { eigene?: boolean; packs?: string[]; rechte?: string; modell?: string; einstellungen?: string }): Fassung => ({ teile: [
  { id: "wer", abschnitte: [{ id: "modell", text: o.modell ?? "kein Modell gewählt" }] },
  { id: "liest", abschnitte: [{ id: "systemzusatz", text: "" }, regeln(o.eigene ?? true),
    ...(o.packs ?? []).map((p) => ({ id: "wissen", text: `--- ${p} (docs/packs/${p}.md · # ${p}) ---\n# ${p}\n\nRead this when …` })),
    { id: "gedaechtnis", quelle: "/Users/o/.claude/projects/-wf/memory", text: "- [a](a.md) — note", dateien: [{ pfad: "/Users/o/.claude/projects/-wf/memory/MEMORY.md", bytes: 20 }] }] },
  { id: "darf", abschnitte: [{ id: "darf", text: o.rechte ?? "Keine Rechte gesetzt" }, ...(o.einstellungen ? [{ id: "einstellungen", text: o.einstellungen }] : []),
    { id: "mitgegeben", text: "nichts" }, { id: "hooks-eigene", text: "PreToolUse · Bash · block-no-verify.sh" }] },
  { id: "arbeitet", abschnitte: [{ id: "plugins", text: "figma@claude-plugins-official · an" }, { id: "schwelle", text: "Übergabe ab 35 %" }] },
] });
const dazu: Dazu = { repo: "/Users/o/example-app", gitNormal: "Current branch: main", gitJetzt: "Current branch: main", aufgabe: null, hooksAus: false, ccTokens: 40251 };
const alle = (b: ReturnType<typeof startbrief>) => [...b.anweisungen, ...b.ersteNachricht, ...b.wartend, ...b.einstellungen].flatMap((x) => [x, ...(x.kinder ?? [])]);

describe("the start brief, file by file against claude by hand", () => {
  test("a repo pinned as /tmp/… owns its files the server names under /private/tmp/…", () => {
    const f = (repo: string): Fassung => ({ teile: [{ id: "liest", abschnitte: [{ id: "projektregeln", text: REPO_AGENTS,
      dateien: [{ pfad: `/private${repo}/AGENTS.md`, bytes: 40 }] }] }] });
    const b = startbrief(f("/tmp/wf/example-app"), f("/tmp/wf/example-app"), { ...dazu, repo: "/tmp/wf/example-app" });
    expect(b.ersteNachricht.filter((x) => x.key.startsWith("regel:")).map((x) => [x.pfad, x.wer])).toEqual([["AGENTS.md", "This repo"]]);
  });
  test("with no choice nothing differs, and the files stand in reading order", () => {
    const b = startbrief(fassung({}), fassung({}), dazu);
    expect(geaendert(b)).toBe(0);
    expect(b.anweisungen.map((x) => x.key)).toEqual(["cc"]);
    expect(b.ersteNachricht.map((x) => x.pfad)).toEqual(["~/.claude/CLAUDE.md", "~/AGENTS.md", "AGENTS.md", "Memory", "git status", "first message"]);
    expect(b.ersteNachricht.find((x) => x.pfad === "Memory")!.datei).toBe("~/.claude/projects/…/memory/MEMORY.md");
    expect(b.wartend.map((x) => x.pfad)).toEqual(["skills, agents, plugins, connectors"]);
  });
  test("leaving your rules out shows your CLAUDE.md word for word as − lines, and the repo's file unchanged", () => {
    const b = startbrief(fassung({ eigene: false }), fassung({}), dazu);
    const mine = alle(b).find((x) => x.key === "regel:/Users/o/.claude/CLAUDE.md")!;
    expect(mine.zeichen).toBe("−");
    expect(mine.text).toBeNull();
    expect(mine.diff!.map((z) => z.z + z.t)).toEqual(["−# Global Rules", "−", "−- Lead with the answer.", "−- Report faithfully."]);
    expect(mine.wer).toBe("Yours");
    const repo = alle(b).find((x) => x.key === "regel:/Users/o/example-app/AGENTS.md")!;
    expect([repo.zeichen, repo.wer]).toEqual([null, "This repo"]);
  });
  test("each of Fleet's context packs stands on its own with every request, under its title, with + lines and no group around it", () => {
    const b = startbrief(fassung({ packs: ["who-it-is-for", "working-with-the-owner"] }), fassung({}), dazu);
    expect(b.anweisungen.map((x) => [x.key, x.pfad, x.datei ?? null, x.zeichen])).toEqual([["cc", "Claude Code's system prompt", null, null],
      ["pack:who-it-is-for", "who-it-is-for", "docs/packs/who-it-is-for.md", "+"], ["pack:working-with-the-owner", "working-with-the-owner", "docs/packs/working-with-the-owner.md", "+"]]);
    expect(b.anweisungen.some((x) => x.kinder)).toBe(false);
    expect(b.anweisungen[1].diff![0]).toEqual({ z: "+", t: "# who-it-is-for" });
    expect(geaendert(b)).toBe(2);
  });
  test("when it fits: a rule file with paths, the lists by name, and each pack that waits as a skill under the title the library gives it", () => {
    const pfadRegel = "---\npaths:\n  - \"**/*.ts\"\n---\n# TypeScript\n\n- strict types.";
    const f = (skill: boolean): Fassung => ({ teile: [{ id: "liest", abschnitte: [
      { id: "projektregeln", text: `--- 1/2 CLAUDE.md ---\n${CLAUDE}\n--- 2/2 typescript.md ---\n${pfadRegel}`,
        dateien: [{ pfad: "/Users/o/.claude/CLAUDE.md", bytes: 60, eigentum: "owner" }, { pfad: "/Users/o/.claude/rules/typescript.md", bytes: 50, eigentum: "owner" }] },
      ...(skill ? [{ id: "wissen", text: "- advanced-features: When you want a second computer." }] : [])] }] });
    const b = startbrief(f(true), f(false), { ...dazu, pack: (id) => id === "advanced-features" ? { titel: "Fleet's advanced features", wann: null } : null });
    expect(b.ersteNachricht.filter((x) => x.key.startsWith("regel:")).map((x) => x.pfad)).toEqual(["~/.claude/CLAUDE.md"]);
    expect(b.wartend.map((x) => [x.pfad, x.wer, x.satz, x.zeichen])).toEqual([["~/.claude/rules/typescript.md", "Yours", "when it reads a matching file", null],
      ["skills, agents, plugins, connectors", "Yours", "their names only; each loads when it fits", null],
      ["Fleet's advanced features", "Fleet", "When you want a second computer.", "+"]]);
  });
  test("rights add their sentence to what Fleet appends; a changed model shows in the start line", () => {
    const b = startbrief(fassung({ rechte: "FLEET RIGHTS (level “build”)", modell: "claude-sonnet-5-5" }), fassung({}), dazu);
    expect(b.anweisungen.map((k) => k.key)).toEqual(["cc", "rechte"]);
    const line = b.einstellungen.find((x) => x.key === "line")!;
    expect(line.zeichen).toBe("~");
    expect(line.diff!.filter((z) => z.z !== " ").map((z) => z.z + z.t.trim())).toEqual(["−model           kein Modell gewählt", "+model           claude-sonnet-5-5"]);
  });
  test("a connector left out marks only the setting it adds, not the whole --settings line around it", () => {
    const vorher = { claudeMdExcludes: ["~/.claude/CLAUDE.md"], autoMode: { environment: ["a long text that stays"] } };
    const b = startbrief(fassung({ einstellungen: JSON.stringify({ ...vorher, permissions: { deny: ["mcp__claude_ai_Gmail"] } }) }),
      fassung({ einstellungen: JSON.stringify(vorher) }), dazu);
    const line = b.einstellungen.find((x) => x.key === "line")!;
    expect(line.zeichen).toBe("~");
    expect(line.diff!.filter((z) => z.z !== " ").map((z) => z.z + z.t.trim())).toEqual(['+permissions: {"deny":["mcp__claude_ai_Gmail"]}']);
  });
  test("hooks off makes what runs along a − part; a first task is a + part", () => {
    const b = startbrief(fassung({}), fassung({}), { ...dazu, hooksAus: true, aufgabe: "Fix the HUD." });
    expect(alle(b).find((x) => x.key === "along")!.zeichen).toBe("−");
    expect(alle(b).find((x) => x.key === "task")!.diff).toEqual([{ z: "+", t: "Fix the HUD." }]);
  });
});
describe("the pieces", () => {
  test("a file reads as it was meant: a hand-wrapped paragraph and list item become one line each, code, headings and tables stay", () => {
    const datei = "# Title\n\nFirst line of a paragraph\nthat goes on here.\n\n- An item that wraps\n  onto a second line.\n- Next item\n  - nested\n\n| a | b |\n| - | - |\n\n```\ncode\n  stays\n```\n---\nafter";
    expect(fliessend(datei).split("\n")).toEqual(["# Title", "", "First line of a paragraph that goes on here.", "", "- An item that wraps onto a second line.",
      "- Next item", "  - nested", "", "| a | b |", "| - | - |", "", "```", "code", "  stays", "```", "---", "after"]);
  });
  test("a line diff keeps what is common and marks only what changed", () => {
    expect(zeilenDiff("a\nb\nc", "a\nx\nc").map((z) => z.z + z.t)).toEqual([" a", "−b", "+x", " c"]);
  });
  test("the rule files and the guides split at their markers", () => {
    expect(regelDateien(regeln(true)).map((r) => [r.pfad, r.text.split("\n")[0]])).toEqual([["/Users/o/.claude/CLAUDE.md", "# Global Rules"],
      ["/Users/o/AGENTS.md", "# Home"], ["/Users/o/example-app/AGENTS.md", "# example-app"]]);
    expect(packDateien(fassung({ packs: ["a-b"] })).map((p) => [p.id, p.pfad, p.titel])).toEqual([["a-b", "docs/packs/a-b.md", "a-b"]]);
  });
  test("a file is named as the window shows it: the repo's by its path in the repo, yours under ~/.claude wherever home is", () => {
    expect(anzeige("/tmp/ti/home/.claude/CLAUDE.md", "/tmp/wf/example-app", "owner")).toBe("~/.claude/CLAUDE.md");
    expect(anzeige("/tmp/wf/example-app/AGENTS.md", "/tmp/wf/example-app")).toBe("AGENTS.md");
    expect(anzeige("/Users/o/AGENTS.md", "/Users/o/example-app")).toBe("~/AGENTS.md");
  });
});

// the banner names the note Fleet types at the mark; it reads it from the words the server writes for arbeitet/schwelle, so a change of
// those words (Mangel 149) shows here instead of the sentence quietly going away
describe("uebergabeHinweis", () => {
  const f: SchwelleFakten = { art: "Session", basePct: 40, capPct: 55, von: "fleet", envName: "FLEET_MIGRATE_PCT", aus: null, wahl: "hint", hinweis: true };
  test("reads the mark from the server's own text, and nothing when the note is off or the threshold is", () => {
    expect(uebergabeHinweis(schwelleAbschnitt(f).text)).toBe(40);
    expect(uebergabeHinweis(schwelleAbschnitt({ ...f, basePct: 37, von: "env" }).text)).toBe(37);
    expect(uebergabeHinweis(schwelleAbschnitt({ ...f, hinweis: false }).text)).toBeNull();
    expect(uebergabeHinweis(schwelleAbschnitt({ ...f, aus: "eigenes Setup ohne gewählte Schwelle" }).text)).toBeNull();
    expect(uebergabeHinweis(null)).toBeNull();
  });
});

// INFO → SETUP NACH EINER NACHFOLGE (POST /api/self/einrichten): dieselbe Vergleichsfunktion, die Vorgängerin an der Stelle von „normal“
describe("what a successor has that its predecessor didn't", () => {
  const ZWECK = "PURPOSE (written for you by your predecessor in this slot):\nDu bist der Rezept-Agent.";
  const mitZweck = (f: Fassung): Fassung => ({ teile: f.teile.map((t) => t.id !== "liest" ? t
    : { ...t, abschnitte: [...t.abschnitte, { id: "zweck", text: ZWECK }] }) });
  test("every line of a pack and a purpose it gave itself is a + line; what stayed the same has no row", () => {
    const vorher = fassung({ packs: ["who-it-is-for"] }), jetzt = mitZweck(fassung({ packs: ["who-it-is-for", "mein-agent"] }));
    const neu = gegenVorgaengerin(jetzt, vorher, dazu.repo);
    expect(neu.map((b) => [b.key, b.zeichen])).toEqual([["zweck", "+"], ["pack:mein-agent", "+"]]);
    expect(neu.find((b) => b.key === "zweck")!.diff).toEqual(ZWECK.split("\n").map((t) => ({ z: "+", t })));
    expect(neu.find((b) => b.key === "pack:mein-agent")!.diff!.map((z) => z.z)).toEqual(["+", "+", "+"]);
  });
  test("the same start twice has nothing new", () => {
    expect(gegenVorgaengerin(fassung({}), fassung({}), dazu.repo)).toEqual([]);
  });
});
