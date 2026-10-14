// THE CHAT FIELD TAKES ITS TEXT PASTES ITSELF (Mangel 64). Measured on the owner's Mac 14.10. 20:3x–20:4x
// (src/fieldperf.ts, FieldRow.pastes): 4 of 11 Cmd+V reached the focused field as an uncancelled paste event
// carrying the text (89–120 chars) and Chrome still inserted nothing; the same keys again landed it. So the
// board no longer leaves the insertion to the browser: the caller cancels the paste and hands the text here.
// `insertText` is the editing command (document.execCommand("insertText")), which keeps Cmd+Z and fires the
// field's own input event; when it leaves the field as it was, the text goes in at the selection directly and
// the field hears an input event like after typing.
export interface PasteField {
  value: string; selectionStart: number; selectionEnd: number;
  setRangeText(text: string, start: number, end: number, mode: "end"): void;
  dispatchEvent(event: Event): boolean;
}
export function pasteText(field: PasteField, text: string, insertText: (text: string) => void): void {
  const { value: before, selectionStart: start, selectionEnd: end } = field;
  insertText(text);
  // replacing a selection with the same text changes nothing and is done — a second copy would be wrong
  if (field.value !== before || before.slice(start, end) === text) return;
  field.setRangeText(text, start, end, "end");
  field.dispatchEvent(new Event("input", { bubbles: true }));
}
