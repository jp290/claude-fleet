// ONE popover behaviour for the page (Grammatik G4.1, Karte K5): a popover hangs at exactly the
// button that opens it, closes on outside click and Escape, Escape hands focus back to that
// button, and the arrow keys walk the current row. The four surfaces — #instmenu, .optpop,
// #board .bmenu, sizePanel — register here; no second outside-click or Escape listener for them
// may appear in src/client.ts or src/chatsize.ts (e2e/slots.ts pins that form).
//
// Arrow walking skips text fields: in the model switch's free-text input the arrows move the
// CARET, and G4.1's "Pfeiltasten bewegen die aktuelle Zeile" must not take that native editing
// away. Rows are read at keypress time because three of the four surfaces rebuild their DOM.
export interface PopoverSpec {
  panel(): HTMLElement | null;
  trigger(): HTMLElement | null;
  isOpen(): boolean;
  // refocus says WHY the popover closes: Escape returns focus to the trigger, an outside
  // pointerdown does not (the user's attention already moved).
  close(refocus: boolean): void;
  rows?(): HTMLElement[];
  // The composer's popovers listen on their own subtree (compOpts) so a handled Escape never
  // reaches the window-level handlers (shell windows) — the shape the surface had before K5.
  // Absent: window, the shape instmenu/sizePanel already had.
  scope?: HTMLElement;
}
export function popover(spec: PopoverSpec): void {
  document.addEventListener("pointerdown", (e) => {
    if (!spec.isOpen()) return;
    const t = e.target;
    if (t instanceof Element && (spec.panel()?.contains(t) || spec.trigger()?.contains(t))) return;
    spec.close(false);
  });
  const move = (e: KeyboardEvent) => {
    if (e.key === "Escape" && spec.isOpen()) {
      e.preventDefault();
      if (spec.scope) e.stopPropagation();
      spec.close(true);
      return;
    }
    if (!spec.rows || (e.key !== "ArrowDown" && e.key !== "ArrowUp") || !spec.isOpen()) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const rows = spec.rows().filter((r) => r.offsetParent !== null);
    if (!rows.length) return;
    const i = rows.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? Math.min(i + 1, rows.length - 1) : Math.max(i - 1, 0);
    e.preventDefault();
    if (spec.scope) e.stopPropagation();
    rows[next].focus();
  };
  if (spec.scope) spec.scope.addEventListener("keydown", move);
  else window.addEventListener("keydown", move);
}
