// DER PI-SITZ UND FLEETS SKILLS (Owner 27.10., Auftrag über Slot 11): ein pi-Sitz liest den Start-Block über
// `--append-system-prompt` UND — wie Claude Code — Skills. pi sucht sie als `<agent-dir>/skills/<id>/SKILL.md`
// (vendor docs des installierten Pakets: docs/configuration.md „<agent-dir>/skills/ | User skills and supporting
// files“, docs/skills.md „Place the skill in your user or project skills directory“), mit demselben Format wie
// Claude: Name und Beschreibung im Kontext, der Text erst beim Aufruf. Das Agent-Verzeichnis setzt der Adapter
// (server.ts#PI_ZAI_AGENT_DIR, #PI_DEEPSEEK_AGENT_DIR). Die Claude-Seite (`.claude/skills` im --add-dir-Ordner)
// bleibt, wie sie ist.
import { describe, expect, test } from "bun:test";
import { bibliothekGewaehlt, piSkillsWeg, renderSeatStart, renderSkillFile, seatFassungAbschnitte, seatPacks, seatSkillFiles,
  type SeatKnowledge, type SkillOrt } from "./sitz-wissen";

const K: SeatKnowledge = { tree: "fleet", repoRoot: "/fleet", head: "c".repeat(40), packs: [
  { id: "who-it-is-for", useWhen: "Wenn du baust.", sources: [{ path: "docs/packs/who-it-is-for.md", anchor: "# Who it is for" }], text: "# Who it is for\n\nText." },
  { id: "fleet-doors", useWhen: "Wenn du Türen öffnest.", sources: [{ path: "docs/packs/fleet-doors.md", anchor: "# Fleet's doors" }],
    text: "# Fleet's doors\n\nRead this when you call a door.", weg: "start", zurWahl: true },
  { id: "running-fleet", useWhen: "Bevor du landest.", sources: [{ path: "docs/packs/running-fleet.md", anchor: "# Running Fleet" }], text: "# Running Fleet\n\nLanden." },
] };
// GLM und DeepSeek: jeder Adapter gibt seinem Sitz sein eigenes Agent-Verzeichnis; der Sitz selbst liegt woanders
const ZAI: SkillOrt = { art: "pi", agentDir: "/home/o/.config/claude-fleet/pi-zai-agent" };
const DEEPSEEK: SkillOrt = { art: "pi", agentDir: "/home/o/.config/claude-fleet/pi-deepseek-agent" };

describe("ein pi-Sitz liest den Start-Block, seine Skills liegen in seinem Agent-Verzeichnis", () => {
  test("der Start trägt die Box-Packs wörtlich", () => {
    const text = renderSeatStart(K, false);
    expect(text).toContain("--- who-it-is-for (");
    expect(text).toContain("--- fleet-doors (");
    expect(text).toContain("Read this when you call a door.");
    expect(text).not.toContain("--- running-fleet (");
  });
  test("jeder pi-Adapter bekommt seine Packs unter seinem Agent-Verzeichnis, nicht in .claude/ und nicht im Projekt", () => {
    for (const ort of [ZAI, DEEPSEEK] as const) {
      const files = seatSkillFiles(K, ort);
      expect(files.map((file) => file.pfad)).toEqual([`${ort.agentDir}/skills/running-fleet/SKILL.md`]);
      // derselbe Renderer wie für Claude: Kopf (name, description = useWhen) und Text aus dem Pack
      expect(files[0]!.text).toBe(renderSkillFile(K.packs.find((pack) => pack.id === "running-fleet")!, K.head));
      expect(files[0]!.text.startsWith(`---\nname: running-fleet\ndescription: "Bevor du landest."\n---\n`)).toBe(true);
      expect(files[0]!.text.endsWith("# Running Fleet\n\nLanden.")).toBe(true);
      for (const file of files) {
        expect(file.pfad.startsWith(`${ort.agentDir}/skills/`)).toBe(true);
        expect(file.pfad).not.toContain(".claude/");
        expect(file.pfad).not.toContain("/.pi/");
        expect(file.pfad.startsWith(`${K.repoRoot}/`)).toBe(false);
      }
    }
    // die Claude-Seite bleibt, wie sie ist: relativ zum --add-dir-Ordner
    expect(seatSkillFiles(K).map((file) => file.pfad)).toEqual([".claude/skills/running-fleet/SKILL.md"]);
  });
  test("ein Sitz ohne Bibliothek bekommt keine Skill-Datei", () => {
    const ohne = bibliothekGewaehlt(K, false, [], false);
    expect(ohne.packs).toEqual([]);
    expect(seatSkillFiles(ohne, ZAI)).toEqual([]);
    expect(seatSkillFiles(ohne)).toEqual([]);
    // ein pi-Adapter ohne eigenes Agent-Verzeichnis (pi, pi-unfenced) schreibt keine: ihn gibt es nicht
    expect(seatSkillFiles(K, { art: "pi", agentDir: null })).toEqual([]);
  });
  test("die Fassung (Info → Setup) zeigt dem pi-Sitz seine Skills mit dem Pfad im Agent-Verzeichnis", () => {
    const a = seatFassungAbschnitte(K, false, null, undefined, ZAI);
    const text = a.map((x) => x.text ?? "").join("\n");
    expect(text).toContain("--- fleet-doors (");
    expect(a.some((x) => x.grund?.includes("wörtlich im Start"))).toBe(true);
    expect(text).not.toContain("weder Start-Block noch Skills");
    const zeile = a.find((x) => x.text === "- running-fleet: Bevor du landest.");
    expect(zeile?.quelle?.split("\n")[0]).toBe(`${ZAI.agentDir}/skills/running-fleet/SKILL.md`);
    expect(zeile?.grund).toContain("Skill");
    // ein pi ohne eigenes Agent-Verzeichnis zeigt den Start, aber keine Skill-Zeile
    const ohne = seatFassungAbschnitte(K, false, null, undefined, { art: "pi", agentDir: null }).map((x) => x.text ?? "").join("\n");
    expect(ohne).toContain("--- fleet-doors (");
    expect(ohne).not.toContain("- running-fleet:");
  });
  test("der Plan nennt für pi dieselben Skills, die er als Datei bekommt", () => {
    expect(seatPacks(K, true)).toEqual({ box: ["who-it-is-for", "fleet-doors"], skills: ["running-fleet"],
      skillListe: "- running-fleet: Bevor du landest." });
  });
  // DER ORDNER GEHÖRT DEM ADAPTER, NICHT DER BELEGUNG: das Manifest sagt, was Fleet schrieb; nur das wird geräumt
  test("beim nächsten Spawn räumt Fleet nur, was es selbst schrieb", () => {
    expect(piSkillsWeg(["running-fleet", "sharpen3"], ["running-fleet"])).toEqual(["sharpen3"]);
    expect(piSkillsWeg(["a"], ["b"])).toEqual(["a"]);
    expect(piSkillsWeg([], ["b"])).toEqual([]);
    expect(piSkillsWeg(["a"], [])).toEqual(["a"]);
  });
});
