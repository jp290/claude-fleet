// Mangel 64 (owner 14.10.: „[Zitat entfernt]“): the board counts
// its pastes into the field rows it already sends (src/fieldperf.ts → POST /api/perf/field). What must hold without a
// browser: the rows the board wrote before stay valid, a row with the pastes the board now builds is accepted — a
// refused row would drop the whole minute — and nothing but flags and numbers gets in.
import { describe, expect, test } from "bun:test";
import { PasteLog, pasteEl } from "../src/fieldperf";
import { FIELD_PASTES_MAX, validFieldRow, type FieldPaste, type FieldRow } from "../src/protocol";

const ROW: FieldRow = { v: 7, sha: "0123abc", dev: { w: 1440, h: 900, touch: false, ua: "chrome-mac" }, pageMs: 61_000,
  windowMs: 60_000, firstSlotMs: null, clicks: [], routes: { "/api/sessions": { n: 30, bytes: 2_000 } }, selfMs: 0.4 };
const PASTE: FieldPaste = { el: "ta", keyOff: false, ev: true, off: false, files: false, landed: true, sel: false, sinceFrontMs: 1200,
  len: 42, types: 2 };

describe("the field row with pastes", () => {
  test("a row without pastes, as the board wrote it before, stays valid", () => {
    expect(validFieldRow(ROW)).toBe(true);
  });
  test("a row with the pastes the log hands out is accepted, flags set by the handlers included", () => {
    const log = new PasteLog();
    log.front(100);
    const k = log.keys("body", 350, true);
    if (k) k.keyOff = true;
    const p = log.paste(900, null);
    if (p) { p.off = true; p.files = true; p.landed = false; p.len = 0; p.types = 1; }
    expect(validFieldRow({ ...ROW, pastes: log.take() })).toBe(true);
  });
  test("refused: an empty list, more than the cap, a foreign key, an unknown place, a flag that is not one, a negative time", () => {
    expect(validFieldRow({ ...ROW, pastes: [] })).toBe(false);
    expect(validFieldRow({ ...ROW, pastes: Array.from({ length: FIELD_PASTES_MAX + 1 }, () => PASTE) })).toBe(false);
    expect(validFieldRow({ ...ROW, pastes: [{ ...PASTE, text: "geheim" }] })).toBe(false);
    expect(validFieldRow({ ...ROW, pastes: [{ ...PASTE, el: "composer" }] })).toBe(false);
    expect(validFieldRow({ ...ROW, pastes: [{ ...PASTE, landed: 1 }] })).toBe(false);
    expect(validFieldRow({ ...ROW, pastes: [{ ...PASTE, sinceFrontMs: -1 }] })).toBe(false);
    expect(validFieldRow({ ...ROW, pastes: [{ ...PASTE, len: 1.5 }] })).toBe(false);
    expect(validFieldRow({ ...ROW, pastes: [{ ...PASTE, len: "42" }] })).toBe(false);
    expect(validFieldRow({ ...ROW, pastes: [{ ...PASTE, types: -1 }] })).toBe(false);
    const { sel: _, ...noSel } = PASTE;
    expect(validFieldRow({ ...ROW, pastes: [noSel] })).toBe(false);
  });
});

describe("PasteLog: one entry per Cmd+V and per paste into the chat field", () => {
  test("the keys and the paste they cause are ONE entry, timed from the window coming to the front", () => {
    const log = new PasteLog();
    log.front(1000);
    const k = log.keys("ta", 1250, false);
    expect(log.paste(1251, k)).toBe(k);
    expect(log.take()).toEqual([{ el: "ta", keyOff: false, ev: true, off: false, files: false, landed: false, sel: false, sinceFrontMs: 250,
      len: null, types: null }]);
  });
  test("keys with no paste after them stay an entry without an event: the Cmd+V that went nowhere", () => {
    const log = new PasteLog();
    log.keys("body", 10, true);
    expect(log.take()).toEqual([{ el: "body", keyOff: false, ev: false, off: false, files: false, landed: false, sel: true, sinceFrontMs: null,
      len: null, types: null }]);
  });
  test("a paste without pending keys (a menu), or after keys that already had theirs, is an entry of its own", () => {
    const log = new PasteLog();
    const k = log.keys("ta", 10, false);
    log.paste(11, k);
    log.paste(20, k);
    log.paste(30, null);
    expect(log.take().map((p) => [p.el, p.ev])).toEqual([["ta", true], [null, true], [null, true]]);
  });
  test("take empties the log; past the cap nothing more is kept", () => {
    const log = new PasteLog();
    for (let i = 0; i < FIELD_PASTES_MAX; i++) log.keys("ta", i, false);
    expect(log.keys("ta", 99, false)).toBeNull();
    expect(log.paste(99, null)).toBeNull();
    expect(log.take()).toHaveLength(FIELD_PASTES_MAX);
    expect(log.take()).toEqual([]);
  });
});

describe("pasteEl: where the keys stood", () => {
  const node = (cls = "") => ({ classList: { contains: (c: string) => c === cls } }) as unknown as Element;
  const field = node(), body = node();
  test("the chat field, the terminal's input, body or nothing, anything else", () => {
    expect(pasteEl(field, field, body)).toBe("ta");
    expect(pasteEl(node("xterm-helper-textarea"), field, body)).toBe("term");
    expect(pasteEl(body, field, body)).toBe("body");
    expect(pasteEl(null, field, body)).toBe("body");
    expect(pasteEl(node("riskbtn"), field, body)).toBe("other");
  });
});
