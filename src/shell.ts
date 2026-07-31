// The browse-and-inspect window shell.
//
// Fleet has four surfaces that are the same shape underneath — a list of things on the left, the
// selected thing rendered in full on the right: the diff/commit review, the project picker, the
// task queue and the outcome feed. All four were centred `.overlay > .panel` boxes (520–900px,
// 80vh) with a single scrolling column, which is why all four had to truncate what they showed.
//
// This module owns ONLY the chrome that is identical across them: the window, the header, a
// toolbar slot, the two-pane body, list-row selection with keyboard navigation, the mobile
// list→detail push, and Escape/backdrop closing. Each view fills `tools`, `list` and `detail`
// with its own DOM and keeps its own data model — nothing about rows is generalised here beyond
// "it is an element, and Enter on it does something", because the four row kinds have genuinely
// different anatomy (the picker's pin stars and double-click-to-start have no analogue in a
// commit row) and a common row API would fit none of them.
//
// It deliberately does NOT live in src/client.ts: it is new chrome with no existing e2e assertion
// pinned to it. The view RENDERERS stay in client.ts, where e2e/outcomes.ts and
// fleet-e2e-security.ts read them as source text.

// same node builder as client.ts's — every string goes in through textContent, never innerHTML.
// Duplicated rather than shared: exporting client.ts's would mean reordering a file whose source
// layout e2e/outcomes.ts slices by index.
function el(tag: string, className: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

// A navigable row. `open` is what Enter (and, by the view's own choice, a click) does.
export interface ShellRow {
  el: HTMLElement;
  open?: () => void;
}

export interface ShellOpts {
  // css hook + the localStorage key prefix a view may use for its own prefs
  id: string;
  title: string;
  subtitle?: string;
  // what the detail pane says before anything is selected
  detailHint?: string;
  // list-column width in px (desktop only — mobile is always full-bleed). Views that show paths
  // or prose rows need more than the 320px default.
  listWidth?: number;
  onClose?: () => void;
}

export interface Shell {
  root: HTMLElement;
  tools: HTMLElement;
  list: HTMLElement;
  detail: HTMLElement;
  foot: HTMLElement;
  setTitle(t: string): void;
  setSubtitle(t: string): void;
  // register the rows Enter/↑/↓ walk, in visual order. Views call this after every re-render;
  // the previous registration is dropped, so a row that no longer exists can never be selected.
  setRows(rows: ShellRow[]): void;
  select(i: number, scroll?: boolean): void;
  selectedIndex(): number;
  // mobile only: slide the detail pane in over the list. A no-op on desktop, where both are shown.
  showDetail(on: boolean): void;
  close(): void;
  isOpen(): boolean;
}

const MOBILE_MQ = matchMedia("(max-width: 700px), ((pointer: coarse) and (max-height: 500px))");

export function openShell(o: ShellOpts): Shell {
  const root = el("div", "overlay shell");
  root.id = `shell-${o.id}`;
  root.style.display = "flex";
  const win = el("div", "shellwin");
  if (o.listWidth) win.style.setProperty("--shell-list-w", `${o.listWidth}px`);

  const head = el("div", "shellhead");
  const back = el("button", "shellback", "‹");
  back.title = "back to the list";
  const titles = el("div", "shelltitles");
  const h2 = el("h2", "", o.title);
  const sub = el("div", "shellsub", o.subtitle ?? "");
  titles.append(h2, sub);
  const close = el("button", "shellclose", "✕");
  close.title = "close (Esc)";
  head.append(back, titles, close);

  const tools = el("div", "shelltools");
  const body = el("div", "shellbody");
  const list = el("div", "shelllist");
  const detail = el("div", "shelldetail");
  if (o.detailHint) detail.appendChild(el("div", "shellhint", o.detailHint));
  body.append(list, detail);
  const foot = el("div", "shellfoot");

  win.append(head, tools, body, foot);
  root.appendChild(win);

  let rows: ShellRow[] = [];
  let sel = -1;
  let open = true;

  const setRows = (next: ShellRow[]) => {
    rows = next;
    // keep the selection only if the SAME element is still registered — an index that happens to
    // survive a re-render would otherwise silently point at a different thing
    const cur = sel >= 0 ? rows.findIndex((r) => r.el.classList.contains("sel")) : -1;
    sel = cur;
  };

  const select = (i: number, scroll = true) => {
    sel = Math.max(-1, Math.min(i, rows.length - 1));
    for (const r of rows) r.el.classList.remove("sel");
    const cur = sel >= 0 ? rows[sel] : undefined;
    if (cur) {
      cur.el.classList.add("sel");
      if (scroll) cur.el.scrollIntoView({ block: "nearest" });
    }
  };

  const showDetail = (on: boolean) => { root.classList.toggle("detailmode", on); };

  const finish = () => {
    if (!open) return;
    open = false;
    document.removeEventListener("keydown", onKey, true);
    root.remove();
    o.onClose?.();
  };

  // capture phase, and stopPropagation on the keys we consume: client.ts has a bubble-phase
  // window handler that closes every legacy overlay on Escape, and the discard-arm handler
  // disarms there too. This window must swallow its own Escape before either sees it.
  function onKey(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      // on mobile the detail pane is a pushed screen, so Escape backs out of it first
      if (MOBILE_MQ.matches && root.classList.contains("detailmode")) { showDetail(false); return; }
      finish();
      return;
    }
    if (!rows.length) return;
    const t = e.target as HTMLElement | null;
    // a textarea owns its own arrows and Enter (the queue's "new task" box is one)
    if (t && t.tagName === "TEXTAREA") return;
    const inInput = !!t && t.tagName === "INPUT";
    if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); select(sel + 1); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); select(sel - 1); return; }
    // Home/End move the caret inside a text field; they only walk the list outside one
    if (!inInput && e.key === "Home") { e.preventDefault(); e.stopPropagation(); select(0); return; }
    if (!inInput && e.key === "End") { e.preventDefault(); e.stopPropagation(); select(rows.length - 1); return; }
    if (e.key === "Enter" && sel >= 0) {
      const r = rows[sel];
      if (r?.open) { e.preventDefault(); e.stopPropagation(); r.open(); }
    }
  }
  document.addEventListener("keydown", onKey, true);

  close.onclick = finish;
  back.onclick = () => showDetail(false);
  root.onclick = (e) => { if (e.target === root) finish(); };

  document.body.appendChild(root);

  return {
    root, tools, list, detail, foot,
    setTitle: (t) => { h2.textContent = t; },
    setSubtitle: (t) => { sub.textContent = t; },
    setRows,
    select,
    selectedIndex: () => sel,
    showDetail,
    close: finish,
    isOpen: () => open,
  };
}
