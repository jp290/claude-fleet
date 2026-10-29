// A LONG BUBBLE OF THE OWNER'S FOLDS (brief 2026-10-29). The owner's own words are the anchors of
// this view, but a send of 43,808 bytes stood as one huge bubble, unfolded — on the phone a screen
// full of one message. Beyond a few lines a bubble now shows its beginning, and one quiet button
// in the ink the waiting state already uses opens the rest. Folding is looks, not loss: the copy
// button and the tooltip keep the whole text (src/client.ts#addMessage copies `text`, bodySource
// holds it), and a short bubble is not touched — no class, no button, exactly as it is today.
// Owner bubbles only: an answer may be long, its length is the session's, not a send's.
export const FOLD_LINES = 10;
export const FOLD_CHARS = 800;

export function foldOwner(text: string): boolean {
  return text.length > FOLD_CHARS || text.split("\n").length > FOLD_LINES;
}

// what the quiet button says while the rest is hidden; open, it offers the way back
export function foldLabel(text: string, open: boolean): string {
  const lines = text.split("\n").length;
  return open ? "Show less" : lines > 1 ? `Show all ${lines} lines` : "Show all";
}

// THE BUBBLE'S OWN FOLD: clamps `body` (the .mbody the renderer filled) and returns the button
// that opens and closes it — null when the text is short, so nothing changes for it. The clamp is
// height, not a text cut: markdown, lists and code keep their shape, the beginning stays readable.
export function foldOwnerToggle(body: HTMLElement, text: string): HTMLButtonElement | null {
  if (!foldOwner(text)) return null;
  body.classList.add("mfold");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "msendnow mfoldbtn";
  btn.title = "This message is folded — open to read the whole text";
  const paint = () => { btn.textContent = foldLabel(text, body.classList.contains("open")); };
  paint();
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    body.classList.toggle("open");
    paint();
  });
  return btn;
}
