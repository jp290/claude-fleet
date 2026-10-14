// Mangel 64 S-i (owner: „[Zitat entfernt]“): the field takes its text pastes itself
// (src/paste.ts). Measured 14.10.: Chrome sometimes inserts nothing after an uncancelled paste event that carries the
// text. What must hold: the text stands in the field exactly once, at the selection, whether the editing command
// inserted it or did nothing — and the field hears an input event either way.
import { describe, expect, test } from "bun:test";
import { pasteText, type PasteField } from "../src/paste";

function field(value: string, start = value.length, end = start) {
  const events: string[] = [];
  const f: PasteField = {
    value, selectionStart: start, selectionEnd: end,
    setRangeText(text, s, e) { f.value = f.value.slice(0, s) + text + f.value.slice(e); f.selectionStart = f.selectionEnd = s + text.length; },
    dispatchEvent(ev) { events.push(ev.type); return true; },
  };
  return { f, events };
}
// the editing command as the browser runs it when it works: inserts at the selection, fires the input event itself
const working = (f: PasteField, events: string[]) => (text: string) => { f.setRangeText(text, f.selectionStart, f.selectionEnd, "end"); events.push("input(native)"); };
const blocked = () => () => {};

describe("pasteText", () => {
  test("the editing command works: the text stands once, and no second input event", () => {
    const { f, events } = field("Hallo ");
    pasteText(f, "Welt", working(f, events));
    expect(f.value).toBe("Hallo Welt");
    expect(events).toEqual(["input(native)"]);
  });
  test("the editing command inserts nothing (measured on the owner's Mac): the text still lands, at the caret, with an input event", () => {
    const { f, events } = field("vorn hinten", 5);
    pasteText(f, "MITTE ", blocked());
    expect(f.value).toBe("vorn MITTE hinten");
    expect(f.selectionStart).toBe(11);
    expect(events).toEqual(["input"]);
  });
  test("a selection is replaced, not kept beside the text", () => {
    const { f } = field("alt neu", 0, 3);
    pasteText(f, "frisch", blocked());
    expect(f.value).toBe("frisch neu");
  });
  test("replacing a selection with the same text is no change, and never a second copy", () => {
    const { f, events } = field("gleich", 0, 6);
    pasteText(f, "gleich", blocked());
    expect(f.value).toBe("gleich");
    expect(events).toEqual([]);
  });
  test("an empty field takes a multi-line text whole", () => {
    const { f } = field("");
    pasteText(f, "Zeile 1\n\nZeile 3", blocked());
    expect(f.value).toBe("Zeile 1\n\nZeile 3");
  });
});
