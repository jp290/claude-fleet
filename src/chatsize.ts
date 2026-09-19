// The conversation view's three text sizes — prose, code, and the surface around them (meta rows,
// step summaries, buttons). Three independent px variables rather than one zoom, the t3code
// appearance model: code usually wants to stay a step smaller than prose, and scaling the chrome
// with the prose makes a large reading size feel like a toy. Set on :root, so every pane follows.

export type SizeKey = "text" | "code" | "ui";

export const SIZE_SPEC: Record<SizeKey, { label: string; min: number; max: number; def: number; v: string }> = {
  text: { label: "Text", min: 11, max: 24, def: 14, v: "--chat-fs" },
  code: { label: "Code", min: 10, max: 22, def: 12.5, v: "--chat-code-fs" },
  ui: { label: "Oberfläche", min: 9, max: 16, def: 11, v: "--chat-ui-fs" },
};

const KEY = "fleet.chatsize";
const KEYS = Object.keys(SIZE_SPEC) as SizeKey[];

let sizes: Record<SizeKey, number> = { text: SIZE_SPEC.text.def, code: SIZE_SPEC.code.def, ui: SIZE_SPEC.ui.def };
const listeners = new Set<() => void>();

const clamp = (k: SizeKey, n: number): number =>
  Math.round(Math.min(SIZE_SPEC[k].max, Math.max(SIZE_SPEC[k].min, n)) * 2) / 2;

function apply(): void {
  for (const k of KEYS) document.documentElement.style.setProperty(SIZE_SPEC[k].v, `${sizes[k]}px`);
  for (const l of listeners) l();
}

function save(): void {
  try { localStorage.setItem(KEY, JSON.stringify(sizes)); } catch { /* private mode — the size just isn't remembered */ }
}

export function loadChatSizes(): void {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Record<SizeKey, unknown>> | null;
    if (raw && typeof raw === "object") {
      const next = { ...sizes };
      for (const k of KEYS) if (typeof raw[k] === "number" && Number.isFinite(raw[k])) next[k] = clamp(k, raw[k]);
      sizes = next;
    }
  } catch { /* unreadable or blocked storage — defaults */ }
  apply();
}

export const chatSize = (k: SizeKey): number => sizes[k];

export function setChatSize(k: SizeKey, n: number): void {
  sizes = { ...sizes, [k]: clamp(k, n) };
  apply();
  save();
}

// Ctrl/Cmd +/− move all three together by one step, each inside its own range; 0 resets
export function stepChatSizes(dir: -1 | 0 | 1): void {
  sizes = dir === 0
    ? { text: SIZE_SPEC.text.def, code: SIZE_SPEC.code.def, ui: SIZE_SPEC.ui.def }
    : { text: clamp("text", sizes.text + dir), code: clamp("code", sizes.code + dir), ui: clamp("ui", sizes.ui + dir * 0.5) };
  apply();
  save();
}

// The popover the view's "Aa" button opens: one range per variable plus a reset. A single element
// for the page — the pane that opens it moves it into itself — so a layout switch leaks nothing.
let panel: HTMLElement | null = null;
export function sizePanel(): HTMLElement {
  if (panel) return panel;
  const box = document.createElement("div");
  box.className = "sizepanel";
  const rows = KEYS.map((k) => {
    const spec = SIZE_SPEC[k];
    const row = document.createElement("label");
    row.className = "sizerow";
    const name = document.createElement("span");
    name.textContent = spec.label;
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = "0.5";
    const val = document.createElement("span");
    val.className = "sizeval";
    input.addEventListener("input", () => setChatSize(k, Number(input.value)));
    row.append(name, input, val);
    return { k, input, val, row };
  });
  const sync = () => {
    for (const r of rows) {
      r.input.value = String(sizes[r.k]);
      r.val.textContent = `${sizes[r.k]}px`;
    }
  };
  listeners.add(sync);
  sync();
  const reset = document.createElement("button");
  reset.className = "sizereset";
  reset.textContent = "Standard";
  reset.title = "Standardgrößen (Strg/⌘ 0)";
  reset.addEventListener("click", () => stepChatSizes(0));
  const hint = document.createElement("div");
  hint.className = "sizehint";
  hint.textContent = "Strg/⌘ + / − / 0";
  box.append(...rows.map((r) => r.row), reset, hint);
  const shut = () => box.classList.remove("open");
  document.addEventListener("pointerdown", (e) => {
    const t = e.target;
    if (t instanceof Element && !box.contains(t) && !t.closest(".chatsizebtn")) shut();
  });
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") shut(); });
  panel = box;
  return box;
}
