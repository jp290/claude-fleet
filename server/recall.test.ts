// server/recall.ts against Claude Code 2.1.296 as measured on 2026-10-13 (Haiku, tmux, Fleet's own
// delivery): the field forms and BSpace counts below are the measured ones (befunde/08, S3).
import { describe, expect, test } from "bun:test";
import { deliveredInField, eraseCount, fieldHolds, ownerPrompt, recall, type RecallPane } from "./recall";
import { composerHoldsExactly, composerRows } from "../composer";
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
  test("a prompt ending in a paste is stored with one more \\n, which the field does not show (measured 14.10., Mangel 62)", () => {
    const stored = `${PASTED("ba78", "Das ist ein erfundener Sa.\n\nDas ist ein erfunde.\n\nAntworte in drei Sätzen.")}\n`;
    const field = [`${H}[Pasted text #2 +4 lines]`];
    expect(fieldHolds(field, [stored])).toBe(true);
    expect(eraseCount([stored])).toBe(eraseCount([stored.slice(0, -1)]));
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

// Mangel 62: Esc put the delivered prompt back, and the next send submitted it as a rest — the session got it twice
// (measured 14.10. on :8982, both forms; the field rows are composerRows' reading of the captured frame)
describe("a delivered prompt back in Claude's field", () => {
  const head = `${H}Das ist ein erfundener Sa.`;
  test("two paragraphs as typed, the blank row read as input: it is the transcript's newest prompt", () => {
    expect(deliveredInField([head, "", "Das ist ein erfunde."], { text: `${head}\n\nDas ist ein erfunde.` })).toBe(true);
  });
  test("a folded paste, stored with its closing \\n: it is the transcript's newest prompt", () => {
    const stored = `${PASTED("ba78", "Das ist ein erfundener Sa.\n\nDas ist ein erfunde.\n\nAntworte in drei Sätzen.")}\n`;
    expect(deliveredInField([`${H}[Pasted text #2 +4 lines]`], { text: stored })).toBe(true);
  });
  test("another prompt, an unreadable field or no prompt: not a delivered one", () => {
    expect(deliveredInField([head], { text: `${H}Eine andere Nachricht.` })).toBe(false);
    expect(deliveredInField(null, { text: head })).toBe(false);
    expect(deliveredInField([head], null)).toBe(false);
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
  escBeforeOutput?: boolean; queueGoneBeforeUp?: boolean; slowErase?: number }) {
  let field = o.field ?? "";
  let queued = [...(o.queued ?? [])];
  let lag = 0; // reads until a BSpace burst shows (measured: the TUI works it off key by key)
  let after = "";
  const pressed: string[] = [];
  const shown = (t: string) => t.replace(/\n\n<pasted_content id="([^"]+)">\n[\s\S]*?\n<\/pasted_content id="\1">/g, "\uE000");
  const pane: RecallPane & { pressed: string[] } = {
    pressed,
    state: async () => ({ turn: o.turn, queued: [...queued], last: o.last ?? null }),
    rows: async () => {
      if (lag > 0 && --lag === 0) field = after;
      return field.replace(/\uE000/g, FOLD).split("\n");
    },
    press: async (...keys) => {
      pressed.push(keys.join(" "));
      if (keys[0] === "Up") field = o.queueGoneBeforeUp ? `${H}eine frühere Nachricht` : queued.map(shown).join("\n");
      if (keys[0] === "Up" && !o.queueGoneBeforeUp) queued = [];
      if (keys[0] === "Down") field = "";
      if (keys[0] === "Escape" && o.escBeforeOutput && o.last) field = shown(o.last.text);
      return true;
    },
    erase: async (n) => {
      pressed.push(`BSpace×${n}`);
      after = [...field].slice(0, Math.max(0, [...field].length - n)).join("");
      if (o.slowErase) lag = o.slowErase; else field = after;
      return true;
    },
    sleep: async () => {},
  };
  return pane;
}
const QUICK = { settleMs: 300, eraseMs: 300, stepMs: 100 };

describe("↑: the waiting prompts come back", () => {
  test("mid-turn, two waiting prompts: ↑, then exactly their BSpaces, and both texts come back", async () => {
    const q = [`${H}Q2 antworte nur OK-Q2`, PASTED("9bf6", LONG)];
    const pane = fakePane({ turn: "working", queued: q });
    expect(await recall("queued", pane, QUICK)).toEqual({ result: "recalled", texts: q, lines: [], interrupted: false });
    expect(pane.pressed).toEqual(["Up", "BSpace×117"]);
  });
  test("a slow TUI: the field empties a few reads after the BSpaces — still recalled, nothing pressed twice", async () => {
    const q = [`${H}Q1 antworte nur OK-Q1`];
    const pane = fakePane({ turn: "working", queued: q, slowErase: 3 });
    expect((await recall("queued", pane, QUICK)).result).toBe("recalled");
    expect(pane.pressed).toEqual(["Up", `BSpace×${eraseCount(q)}`]);
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

// composer.ts#composerRows against Claude Code 2.1.296 as captured on 14.10. (Mangel 62, measuring instance :8982): an
// owner message of two paragraphs that Esc put back into Claude's field. The blank row between them is input.
const CLAUDE = { kind: "glyph" as const, re: /^❯/ };
const CODEX = { kind: "glyph" as const, re: /^›/ };
const RULE = "─".repeat(200);
const HEAD = "[fleet-zustellung · Owner-Credential · Slot 1] Das ist ein erfundener Satz ohne echten Inhalt und dient nur als Platzhalter im Test Das ist ein erfundener Satzx?";
const SECOND = "Das ist ein erfundener Satz ohne echten Inhalt und dient nur als Platzhalter im Test Das ist ein erfund.";
// the captured frame: the composer between two rules, Claude's status rows below
const frame = (field: string[]) => [RULE, ...field, RULE, "  ctx [#---------] 18%  |  Haiku 4.5", "  ⏸ manual mode on", "", ""].join("\n");

describe("composerRows: a blank row inside Claude's input", () => {
  test("two paragraphs Esc put back: three rows, the blank one empty, and they hold the message exactly", () => {
    const rows = composerRows(CLAUDE, frame([`❯ ${HEAD}`, "", `  ${SECOND}`]));
    expect(rows).toEqual([HEAD, "", SECOND]);
    expect(composerHoldsExactly(rows ?? [], `${HEAD}\n\n${SECOND}`)).toBe(true);
  });
  test("three paragraphs: every blank row between them is input", () => {
    expect(composerRows(CLAUDE, frame([`❯ ${HEAD}`, "", `  ${SECOND}`, "", "  Antworte in drei Sätzen."])))
      .toEqual([HEAD, "", SECOND, "", "Antworte in drei Sätzen."]);
  });
  test("a blank row with only the rule below it ends nothing new: unreadable, as before", () => {
    expect(composerRows(CLAUDE, frame([`❯ ${HEAD}`, ""]))).toBeNull();
  });
  test("a blank row, then a row that is no continuation: unreadable, as before", () => {
    expect(composerRows(CLAUDE, frame([`❯ ${HEAD}`, "", SECOND]))).toBeNull();
  });
  test("Codex: the measured overlays below a blank row stay chrome", () => {
    expect(composerRows(CODEX, ["› Hallo", "", "  no matches"].join("\n"))).toEqual(["Hallo"]);
    expect(composerRows(CODEX, ["› Hallo", "", "  gpt-5.3-codex high · 100% left"].join("\n"))).toEqual(["Hallo"]);
  });
});
