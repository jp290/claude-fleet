// ONE helper for the question before a consequential action (grammar G4.5, card K3): a window in
// the chat material wearing the existing .riskbtns form — not the browser's confirm(). The six
// copied risk dialogs in src/client.ts ask through askRisk() and carry no overlay shell of their
// own. Closes on Escape (capture phase, before the global discard-arm and legacy-dialog handlers
// see it) and on an outside click, and gives the focus back to the trigger (G4.1). Before
// painting it closes the phone drawer: #side sits at z 30 above every .overlay at z 20, so a
// dialog opened from inside the drawer would land UNDER it, where no tap reaches its buttons —
// the inventory's measured error 1 (docs/messungen/2026-09-22-untermenue-und-einstellungen-inventar.md, D-1).

export interface RiskBtn {
  label: string;
  /** what the promise resolves to when this button is clicked */
  value: boolean;
  /** G1.2 Gefahr: --danger as text and edge only */
  danger?: boolean;
  /** G1.2 primär: ink-filled */
  primary?: boolean;
  disabled?: boolean;
  /** retry-style: dismiss this dialog and adopt the returned one's answer */
  next?: () => Promise<boolean>;
}

let closeDrawer: (() => void) | null = null;
// client.ts hands in setDrawer(false) once — the drawer keeps that one mechanism, this file
// never toggles the class itself.
export function onDialogWillOpen(fn: () => void): void { closeDrawer = fn; }

function el(tag: string, className: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function askRisk(spec: {
  title: string;
  /** nodes between the h2 and the button row, built by the caller — this helper owns only the shell */
  body: HTMLElement[];
  buttons: RiskBtn[];
  /** panel classes after "panel" (default "riskpanel", e.g. "riskpanel landreviewpanel") */
  panelClass?: string;
}): Promise<boolean> {
  closeDrawer?.();
  const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  return new Promise((resolve) => {
    const overlay = el("div", "overlay riskoverlay");
    overlay.style.display = "flex";
    const panel = el("div", `panel ${spec.panelClass ?? "riskpanel"}`);
    panel.appendChild(el("h2", "", spec.title));
    for (const node of spec.body) panel.appendChild(node);
    const btns = el("div", "riskbtns");
    const dismiss = () => {
      document.removeEventListener("keydown", onKey, true);
      overlay.remove();
      if (trigger?.isConnected) trigger.focus();
    };
    const finish = (ok: boolean) => { dismiss(); resolve(ok); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); finish(false); } };
    document.addEventListener("keydown", onKey, true);
    for (const b of spec.buttons) {
      const btn = el("button", `riskbtn${b.danger ? " danger" : ""}${b.primary ? " primary" : ""}`, b.label) as HTMLButtonElement;
      btn.disabled = !!b.disabled;
      btn.onclick = () => {
        if (b.next) { dismiss(); resolve(b.next()); }
        else finish(b.value);
      };
      btns.appendChild(btn);
    }
    overlay.onclick = (e) => { if (e.target === overlay) finish(false); };
    panel.appendChild(btns);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  });
}
