// DER SCHREIBER DER SKILLS (Owner-Ja 22.10.; pi-Skills 27.10. über Slot 11): Claude Codes Ordner gehört einer Belegung und
// wird als Ganzes ersetzt; der `skills/`-Ordner im Agent-Verzeichnis eines pi-Sitzes gehört dem Adapter und kann eigene
// Skills enthalten — dort schreibt Fleet nur seine Packs hinein und räumt beim nächsten Spawn nur, was es selbst schrieb.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { piSkillsManifest, piSkillsWrite, seatSkillsWrite } from "./sitz-skills";
import { seatSkillFiles, type SeatKnowledge } from "./sitz-wissen";

const K: SeatKnowledge = { tree: "fleet", repoRoot: "/fleet", head: "c".repeat(40), packs: [
  { id: "who-it-is-for", useWhen: "Wenn du baust.", sources: [{ path: "docs/packs/who-it-is-for.md", anchor: "# Who it is for" }], text: "# Who it is for\n\nText." },
  { id: "running-fleet", useWhen: "Bevor du landest.", sources: [{ path: "docs/packs/running-fleet.md", anchor: "# Running Fleet" }], text: "# Running Fleet\n\nLanden." },
  { id: "sharpen3", useWhen: "Wenn ein Auftrag geschärft wird.", sources: [{ path: "docs/skills/sharpen3.md", anchor: "# Schärfen" }], text: "# Schärfen\n\nSchärfe." },
] };
const OHNE = { ...K, packs: K.packs.filter((pack) => pack.id !== "sharpen3") };
const AGENT = mkdtempSync(join(tmpdir(), "fleet-pi-skills-"));
afterAll(() => rmSync(AGENT, { recursive: true, force: true }));

const ids = (): string[] => existsSync(join(AGENT, "skills")) ? readdirSync(join(AGENT, "skills")).sort() : [];
const gelesen = (pfad: string): string => readFileSync(pfad, "utf8");
const manifest = (): unknown => JSON.parse(gelesen(piSkillsManifest(AGENT)));

describe("Fleets Skills im Agent-Verzeichnis eines pi-Sitzes", () => {
  test("beim Start stehen die SKILL.md dort, mit dem Renderer-Text; ein eigener Skill des Owners bleibt stehen", () => {
    mkdirSync(join(AGENT, "skills", "owner-skill"), { recursive: true });
    writeFileSync(join(AGENT, "skills", "owner-skill", "SKILL.md"), "---\nname: owner-skill\ndescription: \"meiner\"\n---\nmeiner\n");
    const files = seatSkillFiles(K, { art: "pi", agentDir: AGENT });
    piSkillsWrite(AGENT, files);
    expect(files.map((file) => file.pfad)).toEqual([`${AGENT}/skills/running-fleet/SKILL.md`, `${AGENT}/skills/sharpen3/SKILL.md`]);
    for (const file of files) expect(gelesen(file.pfad)).toBe(file.text);
    expect(gelesen(join(AGENT, "skills", "owner-skill", "SKILL.md"))).toContain("meiner");
    expect(ids()).toEqual(["owner-skill", "running-fleet", "sharpen3"]);
    expect(manifest()).toEqual({ packs: ["running-fleet", "sharpen3"] });
  });
  test("beim nächsten Spawn geht, was nicht mehr dazugehört — der eigene Skill bleibt", () => {
    piSkillsWrite(AGENT, seatSkillFiles(OHNE, { art: "pi", agentDir: AGENT }));
    expect(ids()).toEqual(["owner-skill", "running-fleet"]);
    expect(manifest()).toEqual({ packs: ["running-fleet"] });
    expect(gelesen(join(AGENT, "skills", "running-fleet", "SKILL.md"))).toContain("description: \"Bevor du landest.\"");
  });
  test("Bibliothek aus: keine Datei geschrieben, und Fleets alte sind fort", () => {
    piSkillsWrite(AGENT, []);
    expect(ids()).toEqual(["owner-skill"]);
    expect(manifest()).toEqual({ packs: [] });
    expect(existsSync(piSkillsManifest(AGENT))).toBe(true);
  });
  test("Claude Codes Ordner dagegen ist der einer Belegung: ein Schreiben ersetzt ihn ganz", () => {
    const dir = join(AGENT, "belegung", "3-100");
    seatSkillsWrite(dir, seatSkillFiles(K));
    expect(gelesen(join(dir, ".claude", "skills", "sharpen3", "SKILL.md"))).toContain("Schärfe.");
    seatSkillsWrite(dir, seatSkillFiles(OHNE));
    expect(existsSync(join(dir, ".claude", "skills", "sharpen3"))).toBe(false);
    expect(readdirSync(join(dir, ".claude", "skills"))).toEqual(["running-fleet"]);
  });

  test("ein Beleg mit Ids, die keine Pack-Ids sind, räumt nichts außerhalb von skills/", () => {
    const wurzel = mkdtempSync(join(tmpdir(), "fleet-pi-skills-flucht-"));
    try {
      const agent = join(wurzel, "agent");
      mkdirSync(join(agent, "skills"), { recursive: true });
      mkdirSync(join(wurzel, "fremd"), { recursive: true });
      writeFileSync(join(wurzel, "fremd", "wichtig.txt"), "bleibt");
      mkdirSync(join(agent, "skills", "Gross"), { recursive: true });
      writeFileSync(join(agent, "fleet-skills.json"), JSON.stringify({ packs: ["../../fremd", "../skills", "Gross", "a/b", ""] }));
      piSkillsWrite(agent, seatSkillFiles(K, { art: "pi", agentDir: agent }));
      expect(readFileSync(join(wurzel, "fremd", "wichtig.txt"), "utf8")).toBe("bleibt");
      expect(existsSync(join(agent, "skills", "Gross"))).toBe(true);
      expect(readdirSync(join(agent, "skills")).sort()).toEqual(["Gross", "running-fleet", "sharpen3"]);
    } finally { rmSync(wurzel, { recursive: true, force: true }); }
  });
  test("eine Datei außerhalb von skills/<id>/ wird nicht geschrieben", () => {
    const wurzel = mkdtempSync(join(tmpdir(), "fleet-pi-skills-flucht-"));
    try {
      const agent = join(wurzel, "agent");
      piSkillsWrite(agent, [{ pfad: `${agent}/skills/../../fremd/SKILL.md`, text: "böse" },
        { pfad: `${agent}/skills/running-fleet/SKILL.md`, text: "gut" }]);
      expect(existsSync(join(wurzel, "fremd"))).toBe(false);
      expect(readdirSync(join(agent, "skills"))).toEqual(["running-fleet"]);
      expect(JSON.parse(readFileSync(piSkillsManifest(agent), "utf8"))).toEqual({ packs: ["running-fleet"] });
    } finally { rmSync(wurzel, { recursive: true, force: true }); }
  });
  test("ein Ordner, den Fleet nicht schrieb, wird nicht überschrieben — auch nicht beim Pack gleichen Namens", () => {
    const wurzel = mkdtempSync(join(tmpdir(), "fleet-pi-skills-fremd-"));
    try {
      const agent = join(wurzel, "agent");
      mkdirSync(join(agent, "skills", "sharpen3"), { recursive: true });
      writeFileSync(join(agent, "skills", "sharpen3", "SKILL.md"), "mein eigener Skill");
      piSkillsWrite(agent, seatSkillFiles(K, { art: "pi", agentDir: agent }));
      expect(gelesen(join(agent, "skills", "sharpen3", "SKILL.md"))).toBe("mein eigener Skill");
      expect(gelesen(join(agent, "skills", "running-fleet", "SKILL.md"))).toContain("Landen.");
      // der fremde Ordner steht nicht im Beleg: ein späterer Spawn räumt ihn auch nicht
      expect(JSON.parse(gelesen(piSkillsManifest(agent)))).toEqual({ packs: ["running-fleet"] });
      piSkillsWrite(agent, []);
      expect(gelesen(join(agent, "skills", "sharpen3", "SKILL.md"))).toBe("mein eigener Skill");
      expect(existsSync(join(agent, "skills", "running-fleet"))).toBe(false);
    } finally { rmSync(wurzel, { recursive: true, force: true }); }
  });
  test("ein Ordner, den Fleet schrieb (im alten Beleg), wird weiter aktualisiert", () => {
    const wurzel = mkdtempSync(join(tmpdir(), "fleet-pi-skills-eigen-"));
    try {
      const agent = join(wurzel, "agent");
      piSkillsWrite(agent, seatSkillFiles(K, { art: "pi", agentDir: agent }));
      const neu = { ...K, packs: K.packs.map((p) => p.id === "sharpen3" ? { ...p, text: "# Schärfen\n\nNeu." } : p) };
      piSkillsWrite(agent, seatSkillFiles(neu, { art: "pi", agentDir: agent }));
      expect(gelesen(join(agent, "skills", "sharpen3", "SKILL.md"))).toContain("Neu.");
    } finally { rmSync(wurzel, { recursive: true, force: true }); }
  });
});

describe("Claude Codes Ordner einer Belegung, wenn ein Skill nicht geschrieben werden kann", () => {
  test("ein Name, den das Dateisystem nicht trägt, kostet nur diesen Skill; die übrigen stehen, kein .tmp bleibt liegen", () => {
    const wurzel = mkdtempSync(join(tmpdir(), "fleet-seat-skills-"));
    try {
      const dir = join(wurzel, "4-200");
      seatSkillsWrite(dir, [{ pfad: `.claude/skills/${"a".repeat(300)}/SKILL.md`, text: "lang" }, { pfad: ".claude/skills/gut/SKILL.md", text: "gut" }]);
      expect(gelesen(join(dir, ".claude", "skills", "gut", "SKILL.md"))).toBe("gut");
      expect(readdirSync(join(dir, ".claude", "skills"))).toEqual(["gut"]);
      expect(readdirSync(wurzel)).toEqual(["4-200"]);
    } finally { rmSync(wurzel, { recursive: true, force: true }); }
  });
});
