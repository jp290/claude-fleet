// server/recall.ts against Claude Code 2.1.296 as measured on 2026-10-13 (Haiku, tmux, Fleet's own
// delivery): the field forms and BSpace counts below are the measured ones (befunde/08, S3).
import { describe, expect, test } from "bun:test";
import { eraseCount, fieldHolds, ownerPrompt, recall, type RecallPane } from "./recall";
import type { Turn } from "./live-state";

const H = "[fleet-zustellung · Owner-Credential · Slot 1] ";
const PASTED = (id: string, body: string) => `${H}\n\n<pasted_content id="${id}">\n${body}\n</pasted_content id="${id}">`;
const LONG = Array.from({ length: 8 }, (_, i) => `Zeile ${i + 1}: ein langer Absatz über Füchse.`).join("\n");
const BUNDLE = "[fleet-zustellung · gebuendelte Fleet-Zustellungen · path=bundle · Slot 1 · naechster Schritt: x · Grenze: y] [fleet-buendel 1/2 · path=owner] Hallo";
const FOLD = "[Pasted text #1 +8 lines]";

describe("the field Claude Code shows for recalled prompts", () => {
  test("a short prompt stands as typed: erased with one BSpace per code point", () => {
    const p = `${H}Schreibe einen Aufsatz über Füchse mit 400 Wörtern.`;
    expect(fieldHolds([p], [p])).toBe(true);
    expect(eraseCount([p])).toBe(98);
  });
  test("a folded paste is one token: head + 1 BSpace (measured 48)", () => {
    const p = PASTED("e1", LONG);
    expect(fieldHolds([`[fleet-zustellung · Owner-Credential · Slot 1] ${FOLD}`], [p])).toBe(true);
    expect(eraseCount([p])).toBe(48);
  });
  test("↑ joins every waiting prompt with a newline, one row each (measured 117)", () => {
    const q = [`${H}Q2 antworte nur OK-Q2`, PASTED("9bf6", LONG)];
    expect(fieldHolds([`${H}Q2 antworte nur OK-Q2`, `[fleet-zustellung · Owner-Credential · Slot 1] ${FOLD}`], q)).toBe(true);
    expect(eraseCount(q)).toBe(117);
  });
  test("an owner byte before or after the recalled text is a different field", () => {
    const p = `${H}Q1 antworte nur OK-Q1`;
    expect(fieldHolds([`${p} und mehr`], [p])).toBe(false);
    expect(fieldHolds([`x${p}`], [p])).toBe(false);
  });
});

describe("whose text a recall may take", () => {
  test("the owner door and the terminal are the owner's", () => {
    expect(ownerPrompt(`${H}Hallo`)).toBe(true);
    expect(ownerPrompt("im Terminal getippt")).toBe(true);
  });
  test("a Fleet bundle, a cross-session message and Claude Code's plumbing are not", () => {
    expect(ownerPrompt(BUNDLE)).toBe(false);
    expect(ownerPrompt('<cross-session-message from="x">hi</cross-session-message>')).toBe(false);
    expect(ownerPrompt("<task-notification>done</task-notification>")).toBe(false);
  });
});

// Claude Code's field as measured: a folded paste renders as its token and erases as one unit
function fakePane(o: { turn: Turn; queued?: string[]; last?: { n: number; text: string } | null; field?: string;
  escBeforeOutput?: boolean; queueGoneBeforeUp?: boolean }) {
  let field = o.field ?? "";
  let queued = [...(o.queued ?? [])];
  const pressed: string[] = [];
  const shown = (t: string) => t.replace(/\n\n<pasted_content id="([^"]+)">\n[\s\S]*?\n<\/pasted_content id="\1">/g, "");
  const pane: RecallPane & { pressed: string[] } = {
    pressed,
    state: async () => ({ turn: o.turn, queued: [...queued], last: o.last ?? null }),
    rows: async () => field.replace(//g, FOLD).split("\n"),
    press: async (...keys) => {
      pressed.push(keys.join(" "));
      if (keys[0] === "Up") field = o.queueGoneBeforeUp ? `${H}eine frühere Nachricht` : queued.map(shown).join("\n");
      if (keys[0] === "Up" && !o.queueGoneBeforeUp) queued = [];
      if (keys[0] === "Down") field = "";
      if (keys[0] === "Escape" && o.escBeforeOutput && o.last) field = shown(o.last.text);
      return true;
    },
    erase: async (n) => { pressed.push(`BSpace×${n}`); field = [...field].slice(0, Math.max(0, [...field].length - n)).join(""); return true; },
    sleep: async () => {},
  };
  return pane;
}
const QUICK = { settleMs: 300, stepMs: 100 };

describe("↑: the waiting prompts come back", () => {
  test("mid-turn, two waiting prompts: ↑, then exactly their BSpaces, and both texts come back", async () => {
    const q = [`${H}Q2 antworte nur OK-Q2`, PASTED("9bf6", LONG)];
    const pane = fakePane({ turn: "working", queued: q });
    expect(await recall("queued", pane, QUICK)).toEqual({ result: "recalled", texts: q, lines: [], interrupted: false });
    expect(pane.pressed).toEqual(["Up", "BSpace×117"]);
  });
  test("a Fleet delivery in the queue: nothing is pressed", async () => {
    const pane = fakePane({ turn: "working", queued: [`${H}Q1`, BUNDLE] });
    expect((await recall("queued", pane, QUICK)).result).toBe("refused");
    expect(pane.pressed).toEqual([]);
  });
  test("the turn ended first and ↑ fetched a history entry: ↓ puts the field back, nothing erased", async () => {
    const pane = fakePane({ turn: "working", queued: [`${H}Q1`], queueGoneBeforeUp: true });
    expect(await recall("queued", pane, QUICK)).toEqual({ result: "kept", why: "the queue was taken before ↑ reached it", field: "" });
    expect(pane.pressed).toEqual(["Up", "Down"]);
  });
  test("an empty queue: nothing is pressed", async () => {
    const pane = fakePane({ turn: "working" });
    expect((await recall("queued", pane, QUICK)).result).toBe("refused");
    expect(pane.pressed).toEqual([]);
  });
});

describe("Esc: the turn stops and its prompt comes back", () => {
  const prompt = { n: 41, text: PASTED("e1", LONG) };
  test("before any answer: Claude puts it back into its field, Fleet erases exactly it, the line is withdrawn", async () => {
    const pane = fakePane({ turn: "working", last: prompt, escBeforeOutput: true });
    expect(await recall("esc", pane, QUICK)).toEqual({ result: "recalled", texts: [prompt.text], lines: [41], interrupted: false });
    expect(pane.pressed).toEqual(["Escape", "BSpace×48"]);
  });
  test("while Claude answers: the field stays empty, the prompt comes back from the transcript", async () => {
    const pane = fakePane({ turn: "working", last: prompt });
    expect(await recall("esc", pane, QUICK)).toEqual({ result: "recalled", texts: [prompt.text], lines: [], interrupted: true });
    expect(pane.pressed).toEqual(["Escape"]);
  });
  test("way B: a waiting prompt comes back first, then the turn stops — nothing starts on its own", async () => {
    const q = [`${H}Q4 antworte nur OK-Q4`];
    const pane = fakePane({ turn: "working", last: prompt, queued: q });
    expect(await recall("esc", pane, QUICK)).toEqual({ result: "recalled", texts: [prompt.text, ...q], lines: [], interrupted: true });
    expect(pane.pressed).toEqual(["Up", `BSpace×${eraseCount(q)}`, "Escape"]);
  });
  test("way B before any answer: queue, then the prompt Claude put back, each erased exactly", async () => {
    const q = [`${H}Q4 antworte nur OK-Q4`];
    const pane = fakePane({ turn: "working", last: prompt, queued: q, escBeforeOutput: true });
    expect(await recall("esc", pane, QUICK)).toEqual({ result: "recalled", texts: [prompt.text, ...q], lines: [41], interrupted: false });
    expect(pane.pressed).toEqual(["Up", `BSpace×${eraseCount(q)}`, "Escape", "BSpace×48"]);
  });
  test("a Fleet delivery waits: Esc would start it — nothing is pressed", async () => {
    const pane = fakePane({ turn: "working", last: prompt, queued: [BUNDLE] });
    expect((await recall("esc", pane, QUICK)).result).toBe("refused");
    expect(pane.pressed).toEqual([]);
  });
  test("a turn a Fleet delivery started: it stops, nothing comes back", async () => {
    const pane = fakePane({ turn: "working", last: { n: 7, text: BUNDLE } });
    expect(await recall("esc", pane, QUICK)).toEqual({ result: "interrupted" });
  });
  test("text in Claude's field: Esc would only clear it there — nothing is pressed", async () => {
    const pane = fakePane({ turn: "working", last: prompt, field: "Entwurf im Terminal" });
    expect((await recall("esc", pane, QUICK)).result).toBe("refused");
    expect(pane.pressed).toEqual([]);
  });
  test("a session that is not working: a second Esc would open the rewind list — nothing is pressed", async () => {
    const pane = fakePane({ turn: "ready", last: prompt });
    expect((await recall("esc", pane, QUICK)).result).toBe("refused");
    expect(pane.pressed).toEqual([]);
  });
});

describe("jetzt senden", () => {
  test("a waiting prompt: ctrl+x ctrl+s", async () => {
    const pane = fakePane({ turn: "working", queued: [`${H}Q1`] });
    expect(await recall("send-now", pane, QUICK)).toEqual({ result: "sent-now" });
    expect(pane.pressed).toEqual(["C-x C-s"]);
  });
});
