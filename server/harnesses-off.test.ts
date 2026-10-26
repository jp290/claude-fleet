// Bauleitung e768d9f5 (16.10. 23:05): pi-zai (GLM) nicht am Mac — eine lokale Vorgabe. Am Rechner festgemacht, nicht an der
// Plattform: FLEET_HARNESSES_OFF (Komma-Liste von Harness-IDs, Default leer) schaltet eine Harness auf DIESEM Rechner ab; die Türen,
// die etwas starten, lehnen sie mit diesem Grund ab, der Gründungsplan rechnet weiter.
import { describe, expect, test } from "bun:test";
import { harnessOffReason } from "../model-register";

describe("harnessOffReason: is a harness switched off on this machine?", () => {
  test("eine gelistete Harness ist abgeschaltet und sagt, woher das kommt", () => {
    expect(harnessOffReason("pi-zai", "pi-zai,pi-unfenced")).toBe("switched off on this machine (FLEET_HARNESSES_OFF)");
    expect(harnessOffReason("pi-unfenced", "pi-zai,pi-unfenced")).toBe("switched off on this machine (FLEET_HARNESSES_OFF)");
  });
  test("eine nicht gelistete Harness bleibt an, auch wenn ihr Name in einer gelisteten steckt", () => {
    expect(harnessOffReason("pi", "pi-zai,pi-unfenced")).toBeNull();
    expect(harnessOffReason("claude", "pi-zai")).toBeNull();
  });
  test("ohne Liste ist nichts abgeschaltet (Default leer)", () => {
    expect(harnessOffReason("pi-zai", "")).toBeNull();
  });
  test("Leerzeichen um die Kommas zählen nicht, ein leerer Eintrag schaltet nichts ab", () => {
    expect(harnessOffReason("pi-zai", " codex , pi-zai ")).toBe("switched off on this machine (FLEET_HARNESSES_OFF)");
    expect(harnessOffReason("", "pi-zai,,")).toBeNull();
  });
  test("ohne zweites Argument liest sie FLEET_HARNESSES_OFF bei jedem Aufruf", () => {
    const vorher = process.env.FLEET_HARNESSES_OFF;
    try {
      process.env.FLEET_HARNESSES_OFF = "codex";
      expect(harnessOffReason("codex")).toBe("switched off on this machine (FLEET_HARNESSES_OFF)");
      delete process.env.FLEET_HARNESSES_OFF;
      expect(harnessOffReason("codex")).toBeNull();
    } finally {
      if (vorher === undefined) delete process.env.FLEET_HARNESSES_OFF; else process.env.FLEET_HARNESSES_OFF = vorher;
    }
  });
});

// Owner 2026-10-26: die offene GLM-Sitz am Workhorse ist eine bewusste Ausnahme, also nicht ab
// Werk an. Sie braucht ein ausdrückliches Ja des Rechners und bleibt am Mac aus.
describe("harnessOffReason: die offene GLM-Sitz ist ab Werk aus", () => {
  // Der Rechner wird GENANNT, nicht gelesen: derselbe Lauf muss am Linux-Workhorse und am Mac dasselbe
  // sagen, und was auf dem einen Rechner gilt, ist kein Befund ueber den anderen.
  test("ohne FLEET_HARNESSES_ON ist sie abgeschaltet und nennt den Schalter", () => {
    const grund = harnessOffReason("pi-zai-unfenced", "", "", "linux");
    expect(grund).not.toBeNull();
    expect(grund).toContain("FLEET_HARNESSES_ON");
  });
  test("der Owner schaltet sie für diesen Rechner ausdrücklich ein", () => {
    expect(harnessOffReason("pi-zai-unfenced", "", "pi-zai-unfenced", "linux")).toBeNull();
    expect(harnessOffReason("pi-zai-unfenced", "", " codex , pi-zai-unfenced ", "linux")).toBeNull();
  });
  test("am Mac bleibt sie aus, auch wenn FLEET_HARNESSES_ON sie nennt", () => {
    expect(harnessOffReason("pi-zai-unfenced", "", "pi-zai-unfenced", "darwin"))
      .toBe("not available on this machine: other providers' models run only on the Workhorse");
  });
  test("FLEET_HARNESSES_OFF schlägt das Einschalten, und keine andere Harness ändert sich", () => {
    expect(harnessOffReason("pi-zai-unfenced", "pi-zai-unfenced", "pi-zai-unfenced", "linux"))
      .toBe("switched off on this machine (FLEET_HARNESSES_OFF)");
    expect(harnessOffReason("pi-zai", "", "", "linux")).toBeNull();
    expect(harnessOffReason("pi-unfenced", "", "", "linux")).toBeNull();
    expect(harnessOffReason("pi", "", "pi-zai-unfenced", "linux")).toBeNull();
  });
});

// Owner 2026-10-26, Stufe 2: der DeepSeek-Sitz laeuft hinter DEMSELBEN bwrap-Zaun wie pi-zai. Der Zaun
// ist die Zulassung, also braucht er am Workhorse KEIN zweites Ja — am Mac bleibt er aus, weil Modelle
// anderer Anbieter nur auf dem Workhorse laufen.
describe("harnessOffReason: der DeepSeek-Sitz folgt dem Rechner, nicht einem Schalter", () => {
  test("am Linux-Workhorse ist er ohne FLEET_HARNESSES_ON an", () => {
    expect(harnessOffReason("pi-deepseek", "", "", "linux")).toBeNull();
  });
  test("am Mac ist er aus, auch wenn FLEET_HARNESSES_ON ihn nennt", () => {
    const grund = harnessOffReason("pi-deepseek", "", "pi-deepseek", "darwin");
    expect(grund).toBe("not available on this machine: other providers' models run only on the Workhorse");
  });
  test("FLEET_HARNESSES_OFF schlägt auch hier, und keine andere Harness ändert sich", () => {
    expect(harnessOffReason("pi-deepseek", "pi-deepseek", "", "linux"))
      .toBe("switched off on this machine (FLEET_HARNESSES_OFF)");
    // die Nachbarn behalten ihre eigenen Regeln: pi-zai ist ueberall an, pi-zai-unfenced braucht sein Ja
    expect(harnessOffReason("pi-zai", "", "", "darwin")).toBeNull();
    expect(harnessOffReason("pi-zai-unfenced", "", "", "linux")).toContain("FLEET_HARNESSES_ON");
    expect(harnessOffReason("pi-unfenced", "", "", "linux")).toBeNull();
  });
});
