import { describe, expect, test } from "bun:test";
import { anzeige, geaendert, packDateien, regelDateien, startbrief, uebergabeHinweis, zeilenDiff, type Dazu, type Fassung } from "./start-brief";
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
const fassung = (o: { eigene?: boolean; packs?: string[]; rechte?: string; modell?: string }): Fassung => ({ teile: [
  { id: "wer", abschnitte: [{ id: "modell", text: o.modell ?? "kein Modell gewählt" }] },
  { id: "liest", abschnitte: [{ id: "systemzusatz", text: "" }, regeln(o.eigene ?? true),
    ...(o.packs ?? []).map((p) => ({ id: "wissen", text: `--- ${p} (docs/packs/${p}.md · # ${p}) ---\n# ${p}\n\nRead this when …` })),
    { id: "gedaechtnis", quelle: "/Users/o/.claude/projects/-wf/memory", text: "- [a](a.md) — note", dateien: [{ pfad: "/Users/o/.claude/projects/-wf/memory/MEMORY.md", bytes: 20 }] }] },
  { id: "darf", abschnitte: [{ id: "darf", text: o.rechte ?? "Keine Rechte gesetzt" }, { id: "mitgegeben", text: "nichts" }, { id: "hooks-eigene", text: "PreToolUse · Bash · block-no-verify.sh" }] },
  { id: "arbeitet", abschnitte: [{ id: "plugins", text: "figma@claude-plugins-official · an" }, { id: "schwelle", text: "Übergabe ab 35 %" }] },
] });
const dazu: Dazu = { repo: "/Users/o/example-app", gitNormal: "Current branch: main", gitJetzt: "Current branch: main", aufgabe: null, hooksAus: false, ccTokens: 40251 };
const alle = (b: ReturnType<typeof startbrief>) => [...b.anweisungen, ...b.ersteNachricht, ...b.einstellungen].flatMap((x) => [x, ...(x.kinder ?? [])]);

describe("the start brief, file by file against claude by hand", () => {
  test("a repo pinned as /tmp/… owns its files the server names under /private/tmp/…", () => {
    const f = (repo: string): Fassung => ({ teile: [{ id: "liest", abschnitte: [{ id: "projektregeln", text: REPO_AGENTS,
      dateien: [{ pfad: `/private${repo}/AGENTS.md`, bytes: 40 }] }] }] });
    const b = startbrief(f("/tmp/wf/example-app"), f("/tmp/wf/example-app"), { ...dazu, repo: "/tmp/wf/example-app" });
    expect(b.ersteNachricht.filter((x) => x.key.startsWith("regel:")).map((x) => [x.pfad, x.wer])).toEqual([["example-app/AGENTS.md", "This repo"]]);
  });
  test("with no choice nothing differs, and the files stand in reading order", () => {
    const b = startbrief(fassung({}), fassung({}), dazu);
    expect(geaendert(b)).toBe(0);
    expect(b.anweisungen.map((x) => x.key)).toEqual(["cc"]);
    expect(b.ersteNachricht.map((x) => x.pfad)).toEqual(["~/.claude/CLAUDE.md", "~/AGENTS.md", "example-app/AGENTS.md",
      "~/.claude/projects/…/memory/MEMORY.md", "git status", "first message", "skills, agents, plugins, connectors"]);
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
  test("Fleet's guides appear as texts of their own under From Fleet, each with + lines", () => {
    const b = startbrief(fassung({ packs: ["who-it-is-for", "working-with-the-owner"] }), fassung({}), dazu);
    const fleet = b.anweisungen.find((x) => x.key === "fleet")!;
    expect(fleet.zeichen).toBe("+");
    expect(fleet.kinder!.map((k) => [k.pfad, k.zeichen])).toEqual([["docs/packs/who-it-is-for.md", "+"], ["docs/packs/working-with-the-owner.md", "+"]]);
    expect(fleet.kinder![0].diff![0]).toEqual({ z: "+", t: "# who-it-is-for" });
    expect(geaendert(b)).toBe(2);
  });
  test("rights add their sentence to what Fleet appends; a changed model shows in the start line", () => {
    const b = startbrief(fassung({ rechte: "FLEET-RECHTE (Stufe „Bauen“)", modell: "claude-sonnet-5-5" }), fassung({}), dazu);
    expect(b.anweisungen.find((x) => x.key === "fleet")!.kinder!.map((k) => k.key)).toEqual(["rechte"]);
    const line = b.einstellungen.find((x) => x.key === "line")!;
    expect(line.zeichen).toBe("~");
    expect(line.diff!.filter((z) => z.z !== " ").map((z) => z.z + z.t.trim())).toEqual(["−model           kein Modell gewählt", "+model           claude-sonnet-5-5"]);
  });
  test("hooks off makes what runs along a − part; a first task is a + part", () => {
    const b = startbrief(fassung({}), fassung({}), { ...dazu, hooksAus: true, aufgabe: "Fix the HUD." });
    expect(alle(b).find((x) => x.key === "along")!.zeichen).toBe("−");
    expect(alle(b).find((x) => x.key === "task")!.diff).toEqual([{ z: "+", t: "Fix the HUD." }]);
  });
});
describe("the pieces", () => {
  test("a line diff keeps what is common and marks only what changed", () => {
    expect(zeilenDiff("a\nb\nc", "a\nx\nc").map((z) => z.z + z.t)).toEqual([" a", "−b", "+x", " c"]);
  });
  test("the rule files and the guides split at their markers", () => {
    expect(regelDateien(regeln(true)).map((r) => [r.pfad, r.text.split("\n")[0]])).toEqual([["/Users/o/.claude/CLAUDE.md", "# Global Rules"],
      ["/Users/o/AGENTS.md", "# Home"], ["/Users/o/example-app/AGENTS.md", "# example-app"]]);
    expect(packDateien(fassung({ packs: ["a-b"] })).map((p) => [p.id, p.pfad, p.titel])).toEqual([["a-b", "docs/packs/a-b.md", "a-b"]]);
  });
  test("a file is named as the window shows it: the repo's by its name, yours under ~/.claude wherever home is", () => {
    expect(anzeige("/tmp/ti/home/.claude/CLAUDE.md", "/tmp/wf/example-app", "owner")).toBe("~/.claude/CLAUDE.md");
    expect(anzeige("/tmp/wf/example-app/AGENTS.md", "/tmp/wf/example-app")).toBe("example-app/AGENTS.md");
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
