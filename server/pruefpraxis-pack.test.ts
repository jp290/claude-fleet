// Neuaufbau K11 S2 (docs/neuaufbau/befunde/15-pruefpraxis.md): die Prüfpraxis als Repo-Pack im Format, das
// .fleet/context-packs.json schon hat. Owner 13.10.: „[Zitat entfernt]“
//  Geprüft wird
// das echte Manifest am Commit dieses Baums (HEAD, per git gelesen wie server.ts#repoManifestContextPlan, nie
// aus dem Arbeitsbaum) mit derselben Leiter, die jede Pack-Naht fährt: Das Pack ist gültig, sein
// Abschnitt lässt sich schneiden, und die alte Zustellung (Lane-Karte, Gründung) plant es nicht, also liefert
// sie byte-gleich. Nur auf Abruf mit `landing` ist es gewählt.
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { CONTEXT_MANIFEST_PATH, planRepoContext, readContextManifest, taskContextTriggers } from "../context-manifest";
import { type ContextPackTrigger } from "../context-packs";
import { sourceSection } from "../context-sections";

const ROOT = join(import.meta.dir, "..");
const PACK = "pruefpraxis";

// eine Datei am Commit HEAD; null, wenn es sie dort nicht gibt
function atHead(path: string): string | null {
  const shown = Bun.spawnSync(["git", "-C", ROOT, "show", `HEAD:${path}`]);
  return shown.exitCode === 0 ? shown.stdout.toString() : null;
}
function realTree() {
  const manifest = readContextManifest(atHead(CONTEXT_MANIFEST_PATH));
  const listed = Bun.spawnSync(["git", "-C", ROOT, "ls-tree", "-r", "-z", "--name-only", "HEAD"]);
  if (manifest.kind !== "packs" || listed.exitCode !== 0) throw new Error(`Manifest ${manifest.kind}, git ls-tree ${listed.exitCode}`);
  const sourceBytes = new Map<string, string>();
  for (const path of manifest.referencedPaths) {
    const bytes = atHead(path);
    if (bytes !== null) sourceBytes.set(path, bytes); // fehlt sie, nennt der Validator die Quelle
  }
  return { manifest, repo: { trackedPaths: new Set(listed.stdout.toString().split("\0").filter(Boolean)), sourceBytes } };
}
const plan = (triggers: readonly ContextPackTrigger[], position: "lane" | "main") => {
  const { manifest, repo } = realTree();
  return planRepoContext({ manifest, repo, facts: { harness: "claude", mode: "mutating", triggers,
    capabilities: ["tracked-source-read", "git-inspect"], position } });
};

describe("ContextPack pruefpraxis im echten Manifest", () => {
  test("auf Abruf mit landing gewählt, als ein Zeiger auf einen Abschnitt, der sich im Baum schneiden lässt", () => {
    const chosen = plan(["landing"], "lane").selected.find((pack) => pack.id === PACK);
    expect(chosen).toBeDefined();
    const sources = chosen!.sources as readonly { path: string; anchor: string }[];
    expect(sources).toHaveLength(1);
    const section = sourceSection(atHead(sources[0]!.path) ?? "", sources[0]!.path, sources[0]!.anchor);
    expect(section?.content.startsWith(sources[0]!.anchor)).toBe(true);
    // estimatedBytes nennt, was ein Leser hinter dem Zeiger findet; es darf nicht still wegdriften
    expect(chosen!.estimatedBytes).toBe(section!.bytes);
  });

  test("die alte Zustellung plant es nicht: Lane-Karte mit Code oder Messung, Gründung einer MAIN", () => {
    const lane = (texts: string[]) => plan(taskContextTriggers(texts, ["always", "verification", "jev-use"]), "lane");
    const founding = plan(["always", "verification", "orchestration"], "main");
    for (const p of [lane(["ZIEL: Queue-Ansicht korrigieren", "FLAECHE: src/client.ts"]),
      lane(["ZIEL: Zustellungsdauer messen", "FLAECHE: docs/messungen/latenz.md"]), founding]) {
      expect(p.selected.map((pack) => pack.id)).not.toContain(PACK);
      expect(p.omitted).toContainEqual({ id: PACK, why: "trigger-not-matched" });
    }
  });
});
