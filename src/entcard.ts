// Hover cards for the ids src/md.ts marks in the conversation view (span[data-ent]).
// Timing and shape follow t3code's PullRequestLinkPreview (350 ms open, 120 ms close, a small card
// with a meta line, a title and facts); the implementation is plain DOM and is not copied.
//
// ONE card element for the whole page, positioned from the hovered span's rect. What it says comes
// from the caller's `describe`, which reads only state the board already holds — no request is
// made here. `describe` may return a `later` promise when a detail (a task's prompt text) is still
// loading; the card repaints if the same entity is still showing when it resolves.

export interface EntFacts {
  meta: string;
  title: string;
  lines: string[];
  later?: Promise<unknown>;
  open?: () => void;
}

const OPEN_MS = 350;
const CLOSE_MS = 120;

let card: HTMLElement | null = null;
let current: HTMLElement | null = null;
let openTimer: ReturnType<typeof setTimeout> | undefined;
let closeTimer: ReturnType<typeof setTimeout> | undefined;

function ensureCard(): HTMLElement {
  if (card) return card;
  card = document.createElement("div");
  card.className = "entcard xterm-hover";
  card.setAttribute("role", "tooltip");
  card.addEventListener("pointerenter", () => clearTimeout(closeTimer));
  card.addEventListener("pointerleave", () => scheduleClose());
  document.body.appendChild(card);
  return card;
}

function line(cls: string, text: string): HTMLElement {
  const e = document.createElement("div");
  e.className = cls;
  e.textContent = text;
  return e;
}

function paint(target: HTMLElement, describe: (kind: string, id: string) => EntFacts | null): void {
  const kind = target.getAttribute("data-ent") ?? "";
  const id = target.getAttribute("data-id") ?? "";
  const facts = describe(kind, id);
  if (!facts) { close(); return; }
  const c = ensureCard();
  c.replaceChildren(line("enttitle", facts.title), line("entmeta", facts.meta),
    ...facts.lines.slice(0, kind === "file" ? 12 : 4).map((l) => line("entline", l)));
  if (facts.open) {
    const button = document.createElement("button");
    button.className = "entopen";
    button.textContent = "Datei öffnen";
    button.onclick = facts.open;
    c.appendChild(button);
  }
  // measure hidden-but-laid-out, then place: below the span, flipped above when it would clip
  c.classList.remove("open");
  c.style.display = "block";
  const r = target.getBoundingClientRect();
  const w = c.offsetWidth, h = c.offsetHeight;
  const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
  const below = r.bottom + 6 + h <= window.innerHeight - 8;
  c.style.left = `${left}px`;
  c.style.top = `${below ? r.bottom + 6 : Math.max(8, r.top - h - 6)}px`;
  c.style.transformOrigin = below ? "top left" : "bottom left";
  requestAnimationFrame(() => c.classList.add("open"));
  if (facts.later) {
    void facts.later.then(() => { if (current === target) paint(target, describe); }, () => {});
  }
}

function close(): void {
  clearTimeout(openTimer);
  current = null;
  if (card) { card.classList.remove("open"); card.style.display = "none"; }
}

function scheduleClose(): void {
  clearTimeout(closeTimer);
  closeTimer = setTimeout(close, CLOSE_MS);
}

// Delegated on the scroll container, so entries appended later need no wiring of their own.
export function attachEntityCards(root: HTMLElement, describe: (kind: string, id: string) => EntFacts | null): void {
  const entOf = (t: EventTarget | null): HTMLElement | null =>
    t instanceof Element ? t.closest<HTMLElement>("[data-ent]") : null;
  const enter = (target: HTMLElement) => {
    clearTimeout(closeTimer);
    if (target === current) return;
    clearTimeout(openTimer);
    openTimer = setTimeout(() => { current = target; paint(target, describe); }, current ? 0 : OPEN_MS);
  };
  root.addEventListener("pointerover", (e) => { const t = entOf(e.target); if (t) enter(t); });
  root.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") return;
    const t = entOf(e.target);
    if (!t) { close(); return; }
    clearTimeout(openTimer);
    if (t === current) close();
    else { current = t; paint(t, describe); }
  });
  root.addEventListener("pointerout", (e) => {
    const t = entOf(e.target);
    if (!t || t.contains(e.relatedTarget as Node | null)) return;
    if (e.pointerType === "touch") return;
    clearTimeout(openTimer);
    if (current) scheduleClose();
  });
  root.addEventListener("focusin", (e) => { const t = entOf(e.target); if (t) enter(t); });
  root.addEventListener("focusout", () => scheduleClose());
  root.addEventListener("scroll", close, { passive: true });
}

export function showEntityCard(kind: string, id: string, x: number, y: number,
  describe: (kind: string, id: string) => EntFacts | null): void {
  const anchor = document.createElement("span");
  anchor.dataset.ent = kind;
  anchor.dataset.id = id;
  anchor.getBoundingClientRect = () => new DOMRect(x, y, 0, 0);
  clearTimeout(openTimer);
  clearTimeout(closeTimer);
  current = anchor;
  paint(anchor, describe);
}

export function hideEntityCard(): void { scheduleClose(); }
export function closeEntityCard(): void { close(); }

document.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "touch" || !card) return;
  if (e.target instanceof Element && (e.target.closest("[data-ent]") || card.contains(e.target))) return;
  close();
});

window.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
