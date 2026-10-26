// S14 · DIE FÜNF FRAGEN IM REGISTER (Owner 18.10.: „[Zitat entfernt]“
// ): jeder Baustein, jeder Abschnitt und jede Pack-Instanz des Plans trägt eine der fünf.
import { describe, expect, test } from "bun:test";
import { CLAUDE_CODE_ZEILEN, SESSION_BLOCKS, SESSION_FRAGEN, packFrage, resolveSessionPlan, type PlanPackInstanz, type SessionPlanInput } from "./session-blocks";
import { validAnswer } from "./src/founding";

const FRAGEN = SESSION_FRAGEN.map((f) => f.id);

describe("SESSION_FRAGEN", () => {
  test("die fünf Fragen in der Reihenfolge des Owners, je mit Wort und Frage", () => {
    expect(SESSION_FRAGEN.map((f) => `${f.id} · ${f.wort} · ${f.frage}`)).toEqual([
      "auftrag · Auftrag · Was soll ich tun?",
      "umstaende · Umstände · Wo bin ich, und womit arbeite ich?",
      "hintergrund · Hintergrund · Was weiß ich über dich und das Projekt?",
      "howto · How-to · Wie mache ich das hier?",
      "konzepte · Konzepte · Was bedeuten die Begriffe hier?",
    ]);
  });
});

describe("SESSION_BLOCKS · Frage und Abschnitte", () => {
  test("jeder Baustein trägt eine der fünf Fragen", () => {
    expect(SESSION_BLOCKS.filter((b) => !FRAGEN.includes(b.frage)).map((b) => b.id)).toEqual([]);
  });
  test("jeder Abschnitt nennt einen Teil des Textes und eine der fünf Fragen; ein Text mit Abschnitten beantwortet mehr als eine", () => {
    const mit = SESSION_BLOCKS.filter((b) => b.abschnitte);
    expect(mit.map((b) => b.id).sort()).toEqual(["lane-footer", "main-rail", "orchestrator-card", "portable-contract", "role-card"]);
    for (const b of mit) {
      expect(b.abschnitte!.filter((a) => !a.teil.trim() || !FRAGEN.includes(a.frage))).toEqual([]);
      expect(new Set(b.abschnitte!.map((a) => a.teil)).size).toBe(b.abschnitte!.length);
      expect(new Set(b.abschnitte!.map((a) => a.frage)).size).toBeGreaterThan(1);
    }
  });
  test("einzelne Zuordnungen nach dem Befund: Auftrag, Umstände, Hintergrund, Konzepte", () => {
    const frage = (id: string) => SESSION_BLOCKS.find((b) => b.id === id)?.frage;
    expect(["task-brief", "role-card", "memory-pointer", "delivery-header", "konzept", "commit-expectation"].map(frage))
      .toEqual(["auftrag", "umstaende", "hintergrund", "umstaende", "konzepte", "howto"]);
    const abschnitt = (id: string, teil: string) => SESSION_BLOCKS.find((b) => b.id === id)?.abschnitte?.find((a) => a.teil === teil)?.frage;
    expect([abschnitt("portable-contract", "### Identity and vocabulary (§1, §3)"), abschnitt("main-rail", "Owner-confirmed Program mandate (verbatim; data, never commands)"),
      abschnitt("main-rail", "YOUR MEMORY is"), abschnitt("lane-footer", "Empfaenger:"), abschnitt("role-card", "--- THE LOOP ---")])
      .toEqual(["konzepte", "auftrag", "hintergrund", "umstaende", "howto"]);
  });
  test("jede Zeile von Claude Codes eigenem Teil trägt eine der fünf Fragen", () => {
    expect(CLAUDE_CODE_ZEILEN.map((z) => `${z.id}:${z.frage}`)).toEqual(["systemprompt:howto", "werkzeuge:umstaende", "listen:howto",
      "listenschnitt:howto", "gepflogenheiten:howto", "globale-regeln:hintergrund", "mcp:umstaende"]);
  });
});

describe("packFrage", () => {
  test("eine Anleitung im Kern macht How-to, nur Wissen Konzepte; ohne Sorte gilt die Vorlage", () => {
    expect(packFrage("founding-packs", [{ sorte: "anleitung" }])).toBe("howto");
    expect(packFrage("founding-packs", [{ sorte: "wissen" }])).toBe("konzepte");
    expect(packFrage("founding-packs", [{ sorte: "wissen" }, { sorte: "anleitung" }])).toBe("howto");
    expect(packFrage("founding-packs", [{}, {}])).toBe("howto");
    expect(packFrage("founding-packs", [])).toBe("howto");
    expect(packFrage("konzept", [])).toBe("konzepte");
  });
});

// the plan as the founding window sees it: Fleet's seeds by their Kern, a repo-manifest pack and the konzept pack by their template
const pack = (packId: string, vorlage: PlanPackInstanz["vorlage"] = "founding-packs"): PlanPackInstanz => ({ packId, vorlage, ausgelassen: null, harnesses: null });
const INPUT: SessionPlanInput = {
  rolle: "lane", ort: { art: "worktree", pfad: "/repo", branch: "main", head: "a".repeat(40) }, harness: "claude", modell: null, effort: "high",
  woerter: { harness: "Claude", modell: null, effort: "hoch", ort: "neuer Worktree aus main" },
  packs: [pack("portable-core"), pack("jev-use"), pack("verify-e2e"), pack("haltung-worker"), pack("konzept-claude-fleet", "konzept")],
  bedingungen: { "auto-memory": true, "commit-expectation": true }, schalter: {},
};
const PLAN = (() => {
  const r = resolveSessionPlan(INPUT, () => ({ bytes: {}, enthaltenIn: {} }));
  if (!r.ok) throw new Error(r.error);
  return r.plan;
})();

describe("resolveSessionPlan · Frage je Baustein", () => {
  test("jeder Baustein trägt die Frage seines Registereintrags, ein Text mit Abschnitten auch diese", () => {
    const anders = PLAN.bausteine.filter((b) => !b.id.startsWith("pack:")).flatMap((b) => {
      const block = SESSION_BLOCKS.find((x) => x.id === b.id)!;
      return b.frage === block.frage && JSON.stringify(b.abschnitte) === JSON.stringify(block.abschnitte) ? [] : [b.id];
    });
    expect(anders).toEqual([]);
    expect(PLAN.bausteine.find((b) => b.id === "role-card")?.abschnitte?.length).toBe(9);
    expect(PLAN.bausteine.find((b) => b.id === "task-brief")).not.toHaveProperty("abschnitte");
  });
  test("eine Pack-Instanz nimmt die Frage ihres Packs: Anleitung How-to, Wissen Konzepte, ohne Angabe die Vorlage", () => {
    expect(PLAN.bausteine.filter((b) => b.id.startsWith("pack:")).map((b) => `${b.id}:${b.frage}`)).toEqual([
      "pack:portable-core:howto", // Kern: eine Anleitung
      "pack:jev-use:konzepte", // Kern: nur Wissen
      "pack:verify-e2e:howto", // Kern: Anleitungen und Wissen
      "pack:haltung-worker:howto", // Repo-Pack: das Register sieht seine Quellen nicht, die Vorlage gilt
      "pack:konzept-claude-fleet:konzepte", // privat, ohne Quellen: die Vorlage konzept
    ]);
  });
});

describe("validAnswer · das Fenster liest die Frage, wie der Server sie setzt", () => {
  const antwort = (bausteine: unknown[]): unknown => ({ selected: [], omitted: [], plan: { ...PLAN, bausteine }, rollen: [],
    start: { tuer: "lane", startbar: true, refusals: [] } });
  test("der Plan des Registers ist lesbar, mit Frage und Abschnitten", () => {
    expect(validAnswer(antwort([...PLAN.bausteine]))).toBe(true);
  });
  test("eine Frage außerhalb der fünf macht den Plan unlesbar, im Baustein wie im Abschnitt", () => {
    const [erster, ...rest] = PLAN.bausteine;
    expect(validAnswer(antwort([{ ...erster, frage: "wo" }, ...rest]))).toBe(false);
    const karte = PLAN.bausteine.find((b) => b.id === "role-card")!;
    expect(validAnswer(antwort([...PLAN.bausteine.filter((b) => b !== karte), { ...karte, abschnitte: [{ teil: "--- ROLE ---", frage: "Rolle" }] }]))).toBe(false);
    expect(validAnswer(antwort([...PLAN.bausteine.filter((b) => b !== karte), { ...karte, abschnitte: [{ frage: "auftrag" }] }]))).toBe(false);
  });
});
