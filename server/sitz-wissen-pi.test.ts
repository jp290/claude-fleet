// DER PI-SITZ IN DER FASSUNG (Owner 2026-10-26): pi liest den Start-Block über `--append-system-prompt`, aber
// keine Claude-Skills. Die Fassung zeigt darum die Box-Packs als Wissen und behauptet keine Skill-Zeile; der
// Start-Kopf nennt keine Skills, die dieser Harness nie lädt.
import { describe, expect, test } from "bun:test";
import { renderSeatStart, seatFassungAbschnitte, seatPacks, type SeatKnowledge } from "./sitz-wissen";

const K: SeatKnowledge = { tree: "fleet", repoRoot: "/fleet", head: "c".repeat(40), packs: [
  { id: "who-it-is-for", useWhen: "Wenn du baust.", sources: [{ path: "docs/packs/who-it-is-for.md", anchor: "# Who it is for" }], text: "# Who it is for\n\nText." },
  { id: "fleet-doors", useWhen: "Wenn du Türen öffnest.", sources: [{ path: "docs/packs/fleet-doors.md", anchor: "# Fleet's doors" }],
    text: "# Fleet's doors\n\nRead this when you call a door.", weg: "start", zurWahl: true },
  { id: "running-fleet", useWhen: "Bevor du landest.", sources: [{ path: "docs/packs/running-fleet.md", anchor: "# Running Fleet" }], text: "# Running Fleet\n\nLanden." },
] };

describe("ein pi-Sitz liest den Start-Block, keine Claude-Skills", () => {
  test("der Start trägt die Box-Packs wörtlich und nennt keine Skill-Liste", () => {
    const text = renderSeatStart(K, false);
    expect(text).toContain("--- who-it-is-for (");
    expect(text).toContain("--- fleet-doors (");
    expect(text).toContain("Read this when you call a door.");
    expect(text).not.toContain("--- running-fleet (");
    expect(text).not.toContain("As skills");
  });
  test("die Fassung zeigt die Packs als Wissen, nicht als „dieser Harness liest nichts“", () => {
    const a = seatFassungAbschnitte(K, false, null, undefined, true);
    const text = a.map((x) => x.text ?? "").join("\n");
    expect(text).toContain("--- fleet-doors (");
    expect(a.some((x) => x.grund?.includes("wörtlich im Start"))).toBe(true);
    expect(text).not.toContain("weder Start-Block noch Skills");
    expect(text).not.toContain("- running-fleet:");
  });
  test("der Plan nennt für pi keine Skills; box bleibt das, was der Start trägt", () => {
    expect(seatPacks(K, false)).toEqual({ box: ["who-it-is-for", "fleet-doors"], skills: [], skillListe: "" });
  });
});
