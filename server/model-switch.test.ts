// Neuaufbau K10, Mangel 53 S-b. Owner 13.10.: „[Zitat entfernt]“
// . The frames are recorded (model-switch.fixtures.json:
// Claude Code 2.1.296, befunde/12 §5), the local_command lines copied from transcripts.
import { describe, expect, test } from "bun:test";
import { appendFileSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SWITCH_LIMITS, lineTail, switchCommand, switchDialog, switchVerdict, watchSwitch, type SwitchState } from "./model-switch";
import fixtures from "./model-switch.fixtures.json";

const F = fixtures.frames as Record<string, string>;
const FABLE = "claude-fable-5-1[1m]";
const lc = (command: string, args: string, content: string) => JSON.stringify({ type: "system", subtype: "local_command",
  content: `<local-command-stdout>${content}</local-command-stdout>`, level: "info", isMeta: false, commandRun: { command, args } });
const SET = lc("model", FABLE, "Set model to `Fable 5.1` and saved as your default for new sessions");
const KEPT = lc("model", FABLE, "Kept model as `Haiku 4.5`");
const NAME_ONLY = JSON.stringify({ type: "system", subtype: "local_command", content: "<command-name>/model</command-name>\n            <command-message>model</command-message>\n            <command-args>claude-fable-5-1[1m]</command-args>", level: "info", isMeta: false });

describe("die Rückfrage im Bild: ein Enter nur für genau das bestellte Modell", () => {
  test("Rückfrage statt Eingabefeld (Session ruht) und über dem leeren Feld (am Ende eines Zugs): bestätigen", () => {
    expect(switchDialog(F.idleDialog!, "model", FABLE)).toBe("confirm");
    expect(switchDialog(F.busyDialog!, "model", FABLE)).toBe("confirm");
  });
  test("Rückfrage für ein anderes Modell, oder „2. No“ markiert: kein Enter", () => {
    expect(switchDialog(F.foreignDialog!, "model", FABLE)).toBe("foreign");
    expect(switchDialog(F.foreignDialog!, "model", "claude-sonnet-5-5")).toBe("confirm");
    expect(switchDialog(F.noSelected!, "model", FABLE)).toBe("foreign");
  });
  test("kein Dialog im Bild, auch nicht mitten im Zug: nichts", () => {
    expect(switchDialog(F.plain!, "model", FABLE)).toBe("none");
    expect(switchDialog(F.busyBefore!, "model", FABLE)).toBe("none");
  });
  test("Mangel 74 — „Change effort level?“ für genau die bestellte Stufe: bestätigen; für eine andere: kein Enter", () => {
    expect(switchDialog(F.effortDialog!, "effort", "high")).toBe("confirm");
    expect(switchDialog(F.effortDialog!, "effort", "xhigh")).toBe("foreign");
  });
  test("Mangel 74 — jede Rückfrage gehört nur ihrem Feld: der Modellwechsel bestätigt keine Effort-Frage und umgekehrt", () => {
    expect(switchDialog(F.effortDialog!, "model", FABLE)).toBe("none");
    expect(switchDialog(F.idleDialog!, "effort", "high")).toBe("none");
  });
  test("ein zerrissenes Bild: ohne Optionen nichts, mit nur einer Option kein Enter", () => {
    const lines = F.idleDialog!.split("\n");
    const yesAt = lines.findIndex((l) => l.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").includes("1. Yes, switch to"));
    expect(yesAt).toBeGreaterThan(0);
    expect(switchDialog(lines.slice(0, yesAt).join("\n"), "model", FABLE)).toBe("none");
    expect(switchDialog(lines.slice(0, yesAt + 1).join("\n"), "model", FABLE)).toBe("foreign");
  });
});

describe("das Urteil steht allein in Claude Codes local_command-Zeile", () => {
  test("„Set model to“ für genau diesen Wunsch: umgestellt; „Kept model as“: behalten", () => {
    expect(switchVerdict([NAME_ONLY, SET], "model", FABLE)).toBe("set");
    expect(switchVerdict([NAME_ONLY, KEPT], "model", FABLE)).toBe("kept");
  });
  test("ein Fehler als Antwort: nicht umgestellt", () => {
    expect(switchVerdict([lc("model", FABLE, "API error: 400 model not found")], "model", FABLE)).toBe("not-set");
  });
  test("andere Befehle, andere Werte, eine Menüwahl ohne Argument und die Namenszeile: kein Urteil", () => {
    expect(switchVerdict([NAME_ONLY, lc("model", "claude-sonnet-5-5", "Set model to `Sonnet 5.5` …"),
      lc("model", "", "Set model to `Fable 5.1` …"), lc("effort", FABLE, "Set effort level to high")], "model", FABLE)).toBeNull();
  });
  test("die zweite Form (User-Zeilen, Argument nur in der Befehlszeile davor, 2.1.296): umgestellt", () => {
    const user = (content: string) => JSON.stringify({ type: "user", message: { role: "user", content } });
    const name = user("<command-name>/model</command-name>\n            <command-message>model</command-message>\n            <command-args>claude-fable-5-1[1m]</command-args>");
    const out = user("<local-command-stdout>Set model to `Fable 5.1` and saved as your default for new sessions</local-command-stdout>");
    expect(switchVerdict([name, out], "model", FABLE)).toBe("set");
    expect(switchVerdict([out], "model", FABLE)).toBeNull();
    expect(switchVerdict([JSON.stringify({ type: "user", isSidechain: true, message: { content: JSON.parse(name).message.content } }), out], "model", FABLE)).toBeNull();
  });
  test("/effort: „Set effort level to“ für die Stufe", () => {
    expect(switchVerdict([lc("effort", "xhigh", "Set effort level to xhigh (saved as your default for new sessions): …")], "effort", "xhigh")).toBe("set");
  });
  test("/effort nach Esc auf die Rückfrage: „Kept effort level as“ → behalten (2.1.300, zweite Form, Mangel 74)", () => {
    const cmd = JSON.stringify({ type: "user", message: { content: "<command-name>/effort</command-name>\n            <command-message>effort</command-message>\n            <command-args>high</command-args>" } });
    const out = JSON.stringify({ type: "user", message: { content: "<local-command-stdout>Kept effort level as low</local-command-stdout>" } });
    expect(switchVerdict([cmd, out], "effort", "high")).toBe("kept");
  });
});

// a pane that plays a script tick by tick, on a clock that only moves when the watch sleeps
function fakePane(o: { frames?: (string | null)[]; lines?: (tick: number, entered: number) => string[]; working?: (tick: number) => boolean; alive?: (tick: number) => boolean }) {
  let t = 0, tick = 0, enters = 0, frameReads = 0;
  const states: SwitchState[] = [];
  return {
    pane: {
      alive: () => o.alive?.(tick) ?? true,
      frame: async () => { frameReads++; return o.frames?.[Math.min(tick, o.frames.length - 1)] ?? null; },
      enter: async () => { enters++; return true; },
      lines: async () => o.lines?.(tick, enters) ?? [],
      working: async () => o.working?.(tick) ?? false,
      publish: (s: SwitchState) => { states.push(s); },
    },
    now: () => t,
    sleep: async (ms: number) => { t += ms; tick++; },
    get enters() { return enters; }, get frameReads() { return frameReads; }, states,
  };
}

describe("der Beobachter: genau ein Enter, Urteil aus dem Transkript, eine Grenze", () => {
  test("die Rückfrage erscheint: ein Enter, auch wenn sie noch ein paar Bilder lang steht, dann „Set model to“ → umgestellt", async () => {
    const p = fakePane({ frames: [F.plain!, F.idleDialog!], lines: (k, entered) => entered && k >= 6 ? [NAME_ONLY, SET] : [] });
    const w = watchSwitch("model", FABLE, p.pane, SWITCH_LIMITS, p.now, p.sleep);
    expect(await w.done).toBe("set");
    expect(p.enters).toBe(1);
    expect(p.states).toEqual(["typed", "set"]);
  });
  test("mitten im Zug: wartet, solange der Zug läuft; die Rückfrage am Zugende bekommt ihr eines Enter", async () => {
    const p = fakePane({ frames: [...Array(60).fill(F.busyBefore!), F.busyDialog!], working: (k) => k < 60,
      lines: (_, entered) => entered ? [SET] : [] });
    const w = watchSwitch("model", FABLE, p.pane, SWITCH_LIMITS, p.now, p.sleep);
    expect(await w.done).toBe("set");
    expect(p.enters).toBe(1);
  });
  test("eine Rückfrage für ein anderes Modell: kein Enter, „fragt im Terminal“, dann zählt nur die Zeile", async () => {
    const p = fakePane({ frames: [F.foreignDialog!], lines: (k) => k >= 40 ? [KEPT] : [] });
    const w = watchSwitch("model", FABLE, p.pane, SWITCH_LIMITS, p.now, p.sleep);
    expect(await w.done).toBe("kept");
    expect(p.enters).toBe(0);
    expect(p.states).toEqual(["typed", "asks", "kept"]);
  });
  test("nichts kommt und der Zug ruht: nach der Nachfrist nicht umgestellt, ohne Enter", async () => {
    const p = fakePane({ frames: [F.plain!] });
    const w = watchSwitch("model", FABLE, p.pane, SWITCH_LIMITS, p.now, p.sleep);
    expect(await w.done).toBe("not-set");
    expect(p.enters).toBe(0);
    expect(p.now()).toBeLessThanOrEqual(SWITCH_LIMITS.graceMs + 2 * SWITCH_LIMITS.tickMs);
  });
  test("ein Zug, der nie endet: höchstens 15 min", async () => {
    const p = fakePane({ frames: [F.busyBefore!], working: () => true });
    expect(await watchSwitch("model", FABLE, p.pane, SWITCH_LIMITS, p.now, p.sleep).done).toBe("not-set");
    expect(p.now()).toBeGreaterThan(SWITCH_LIMITS.capMs);
    expect(p.now()).toBeLessThanOrEqual(SWITCH_LIMITS.capMs + 2 * SWITCH_LIMITS.tickMs);
  });
  test("eine neue Belegung des Slots beendet ihn, ohne Enter und ohne Urteil", async () => {
    const p = fakePane({ frames: [F.plain!, F.idleDialog!], alive: (k) => k < 1 });
    expect(await watchSwitch("model", FABLE, p.pane, SWITCH_LIMITS, p.now, p.sleep).done).toBe("stopped");
    expect(p.enters).toBe(0);
    expect(p.states).toEqual(["typed"]);
  });
  test("ein zweiter Schalterdruck ersetzt ihn: stop() beendet ihn ohne Urteil", async () => {
    const p = fakePane({ frames: [F.plain!] });
    const w = watchSwitch("model", FABLE, p.pane, SWITCH_LIMITS, p.now, p.sleep);
    w.stop();
    expect(await w.done).toBe("stopped");
    expect(p.states).toEqual(["typed"]);
  });
  test("/effort: eine Modell-Rückfrage im Bild ist nicht seine — kein Enter, nur die Zeile", async () => {
    const p = fakePane({ frames: [F.idleDialog!], lines: (k) => k >= 3 ? [lc("effort", "xhigh", "Set effort level to xhigh")] : [] });
    expect(await watchSwitch("effort", "xhigh", p.pane, SWITCH_LIMITS, p.now, p.sleep).done).toBe("set");
    expect(p.enters).toBe(0);
  });
  test("/effort: die Rückfrage für genau diese Stufe bekommt ihr eines Enter, dann „Set effort level to“ → umgestellt (Mangel 74)", async () => {
    const p = fakePane({ frames: [F.plain!, F.effortDialog!, F.effortDialog!, F.effortDialog!],
      lines: (_k, entered) => entered ? [lc("effort", "high", "Set effort level to high")] : [] });
    expect(await watchSwitch("effort", "high", p.pane, SWITCH_LIMITS, p.now, p.sleep).done).toBe("set");
    expect(p.enters).toBe(1);
  });
});

test("das Transkript wird stückweise gelesen: jede Lesung nur die neuen Bytes, eine halbe Zeile wartet", async () => {
  const dir = mkdtempSync(join(tmpdir(), "k10-linetail-"));
  try {
    const file = join(dir, "t.jsonl");
    writeFileSync(file, "vorher, nicht gelesen\n");
    const tail = lineTail(file, statSync(file).size);
    appendFileSync(file, "eins\nzw");
    expect(await tail.lines()).toEqual(["eins"]);
    expect(tail.bytesRead).toBe(7);
    const ue = Buffer.from("ü"); // zwei Bytes, zwischen zwei Lesungen geteilt
    appendFileSync(file, Buffer.concat([Buffer.from("ei "), ue.subarray(0, 1)]));
    expect(await tail.lines()).toEqual(["eins"]);
    appendFileSync(file, Buffer.concat([ue.subarray(1), Buffer.from("\ndrei\n")]));
    expect(await tail.lines()).toEqual(["eins", "zwei ü", "drei"]);
    expect(tail.bytesRead).toBe(7 + 4 + 7);
    expect(await tail.lines()).toEqual(["eins", "zwei ü", "drei"]);
    expect(tail.bytesRead).toBe(18);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("was getippt wird: Claude Codes Befehle, pi-zai mit zai/ und /thinking", () => {
  expect(switchCommand("claude", "model", FABLE)).toBe("/model claude-fable-5-1[1m]");
  expect(switchCommand("claude", "effort", "xhigh")).toBe("/effort xhigh");
  expect(switchCommand("pi-zai", "model", "glm-5.3")).toBe("/model zai/glm-5.3");
  expect(switchCommand("pi-zai", "effort", "high")).toBe("/thinking high");
});
