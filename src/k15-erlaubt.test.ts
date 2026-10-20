// Was eine Konstellation erlaubt (Harness 2.0 Schritt 6, modell.md Änderung 10: „Ein Import listet Rechte, Befehle und Agent-MDs je
// Position auf, bevor etwas startet“; harness-2-0-antwort.md Lücke 5: Rechte gelten nur für Claude Code, ein Sitz, dessen Agent hier nicht
// startet, wird genannt).
import { describe, expect, test } from "bun:test";
import { katalogAus } from "./k15-agent";
import { DU, PROFILE0, pos, type Konst, type Profil } from "./k15-entwurf-modell";
import { erlaubtZeilen } from "./k15-erlaubt-modell";
import { modelLabel } from "./modelname";

const h = (id: string, o: Record<string, unknown> = {}) => ({ id, role: "agent", default: false, allowsLanes: true, hier: true, grund: null,
  availability: { status: "available" }, supports: { model: true, effort: true }, models: [], effortLevels: ["low", "high"], ...o });
const K = katalogAus({ harnesses: [h("claude", { default: true }), h("pi"),
  h("codex", { availability: { status: "unavailable", since: "2026-10-08", reason: "pausiert bis zum Kontingent-Reset" } })], defaultModel: null, modelRegistry: [] });
if (!K) throw new Error("Fixture: katalogAus lehnt die Server-Form ab");

const bau = PROFILE0.find((p) => p.id === "bau")!;
const MD = { titel: "Bauer.md", v: 1, pfad: "eigene Datei", abschnitte: [{ titel: "Auftrag", text: "Bau S1." }, { titel: "Grenze", text: "Nur server/." }] };
const BAUER: Profil = { ...bau, id: "bauer", name: "Bauer", autor: DU, werte: { "permission-mode": "acceptEdits" }, datei: MD as Profil["datei"] };
const PROFILE = [...PROFILE0, BAUER];
const k = (...wurzeln: Konst["wurzeln"]): Konst => ({ id: "k", name: "K", v: 1, satz: "", wurzeln });

describe("was eine Konstellation erlaubt", () => {
  test("je Session: Profil mit Autor, Agent, Permission-Mode, Agent-MD", () => {
    const [z] = erlaubtZeilen(k(pos("b", "Bauer", "bauer")), PROFILE, K);
    expect(z?.satz).toBe("Bauer v1 von du · Claude Code · Standard-Modell · Permission-Mode acceptEdits · eigene Agent-MD „Bauer.md“ (2 Abschnitte) · Autonomie wie die Rollenkarte");
    expect(z?.warnung).toBeNull();
  });
  test("ein anderer Agent: der Permission-Mode gilt dort nicht, und das steht da", () => {
    const [z] = erlaubtZeilen(k(pos("b", "Bauer", "bauer", { abw: { agent: "pi" } })), PROFILE, K);
    expect(z?.satz).toContain("Pi · Standard-Modell · Permission-Mode acceptEdits gilt hier nicht (nur Claude Code)");
  });
  test("ein Modell steht da: das eigene, sonst das Standard-Modell des Agenten", () => {
    const [mit] = erlaubtZeilen(k(pos("b", "Bauer", "bauer", { abw: { modell: "claude-opus-5-5[1m]" } })), PROFILE, K);
    expect(mit?.satz).toContain(`Claude Code · ${modelLabel("claude-opus-5-5[1m]")} ·`);
    const std = katalogAus({ harnesses: [h("claude", { default: true })], defaultModel: "claude-sonnet-5-5", modelRegistry: [] });
    expect(erlaubtZeilen(k(pos("b", "Bauer", "bauer")), PROFILE, std)[0]?.satz).toContain(`Standard-Modell (${modelLabel("claude-sonnet-5-5")})`);
  });
  test("ein Agent, der hier pausiert ist oder fehlt, und ein fehlendes Profil: die Session startet nicht, mit Grund", () => {
    const zs = erlaubtZeilen(k(pos("a", "A", "bauer", { abw: { agent: "codex" } }), pos("b", "B", "bauer", { abw: { agent: "gibtsnicht" } }), pos("c", "C", "weg")), PROFILE, K);
    expect(zs.map((z) => z.warnung)).toEqual(["startet hier nicht: Codex pausiert (pausiert bis zum Kontingent-Reset)",
      "startet hier nicht: Gibtsnicht fehlt (hier nicht eingerichtet)", "startet so nicht"]);
  });
  test("Kinder kommen mit, in der Reihenfolge des Aufbaus", () => {
    expect(erlaubtZeilen(k(pos("a", "A", "bau", { kids: [pos("b", "B", "ordner")] })), PROFILE, K).map((z) => z.pos)).toEqual(["a", "b"]);
  });
});
