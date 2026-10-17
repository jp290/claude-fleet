// Bauleitung e768d9f5 (16.10. 23:05): pi-zai (GLM) nicht am Mac — eine lokale Vorgabe. Am Rechner festgemacht, nicht an der
// Plattform: FLEET_HARNESSES_OFF (Komma-Liste von Harness-IDs, Default leer) schaltet eine Harness auf DIESEM Rechner ab; die Türen,
// die etwas starten, lehnen sie mit diesem Grund ab, der Gründungsplan rechnet weiter.
import { describe, expect, test } from "bun:test";
import { harnessOffReason } from "../model-register";

describe("harnessOffReason: ist eine Harness auf diesem Rechner abgeschaltet?", () => {
  test("eine gelistete Harness ist abgeschaltet und sagt, woher das kommt", () => {
    expect(harnessOffReason("pi-zai", "pi-zai,pi-unfenced")).toBe("auf diesem Rechner abgeschaltet (FLEET_HARNESSES_OFF)");
    expect(harnessOffReason("pi-unfenced", "pi-zai,pi-unfenced")).toBe("auf diesem Rechner abgeschaltet (FLEET_HARNESSES_OFF)");
  });
  test("eine nicht gelistete Harness bleibt an, auch wenn ihr Name in einer gelisteten steckt", () => {
    expect(harnessOffReason("pi", "pi-zai,pi-unfenced")).toBeNull();
    expect(harnessOffReason("claude", "pi-zai")).toBeNull();
  });
  test("ohne Liste ist nichts abgeschaltet (Default leer)", () => {
    expect(harnessOffReason("pi-zai", "")).toBeNull();
  });
  test("Leerzeichen um die Kommas zählen nicht, ein leerer Eintrag schaltet nichts ab", () => {
    expect(harnessOffReason("pi-zai", " codex , pi-zai ")).toBe("auf diesem Rechner abgeschaltet (FLEET_HARNESSES_OFF)");
    expect(harnessOffReason("", "pi-zai,,")).toBeNull();
  });
  test("ohne zweites Argument liest sie FLEET_HARNESSES_OFF bei jedem Aufruf", () => {
    const vorher = process.env.FLEET_HARNESSES_OFF;
    try {
      process.env.FLEET_HARNESSES_OFF = "codex";
      expect(harnessOffReason("codex")).toBe("auf diesem Rechner abgeschaltet (FLEET_HARNESSES_OFF)");
      delete process.env.FLEET_HARNESSES_OFF;
      expect(harnessOffReason("codex")).toBeNull();
    } finally {
      if (vorher === undefined) delete process.env.FLEET_HARNESSES_OFF; else process.env.FLEET_HARNESSES_OFF = vorher;
    }
  });
});
