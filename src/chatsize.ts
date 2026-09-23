// The conversation view's three text sizes (and, since the fifteenth cut, its column width) — prose, code, and the surface around them (meta rows,
// step summaries, buttons). Three independent px variables rather than one zoom, the t3code
// appearance model: code usually wants to stay a step smaller than prose, and scaling the chrome
// with the prose makes a large reading size feel like a toy. Set on :root, so every pane follows.

// The fourth variable is the column (owner, fifteenth cut): the transcript's and the composer's
// max width. Its top stop is FULL — no cap, the column fills the pane (the padding keeps 18px).
export type SizeKey = "text" | "code" | "ui" | "width";

import { prefJSON, prefSet } from "./prefs";

export const SIZE_SPEC: Record<SizeKey, { label: string; min: number; max: number; def: number; step: number; v: string }> = {
  text: { label: "Text", min: 11, max: 24, def: 14, step: 0.5, v: "--chat-fs" },
  code: { label: "Code", min: 10, max: 22, def: 12.5, step: 0.5, v: "--chat-code-fs" },
  ui: { label: "Oberfläche", min: 9, max: 16, def: 11, step: 0.5, v: "--chat-ui-fs" },
  width: { label: "Breite", min: 600, max: 1640, def: 780, step: 20, v: "--chat-col" },
};
export const COLUMN_FULL = SIZE_SPEC.width.max;
const cssValue = (k: SizeKey, n: number): string => (k === "width" && n >= COLUMN_FULL ? "100000px" : `${n}px`);
const shown = (k: SizeKey, n: number): string => (k === "width" && n >= COLUMN_FULL ? "voll" : `${n}px`);

const KEYS = Object.keys(SIZE_SPEC) as SizeKey[];

const DEFAULTS: Record<SizeKey, number> = { text: SIZE_SPEC.text.def, code: SIZE_SPEC.code.def, ui: SIZE_SPEC.ui.def, width: SIZE_SPEC.width.def };
let sizes: Record<SizeKey, number> = { ...DEFAULTS };

const listeners = new Set<() => void>();

const clamp = (k: SizeKey, n: number): number =>
  Math.round(Math.min(SIZE_SPEC[k].max, Math.max(SIZE_SPEC[k].min, n)) / SIZE_SPEC[k].step) * SIZE_SPEC[k].step;

function apply(): void {
  for (const k of KEYS) document.documentElement.style.setProperty(SIZE_SPEC[k].v, cssValue(k, sizes[k]));
  for (const l of listeners) l();
}

function save(): void {
  prefSet("fleet.chatsize", JSON.stringify(sizes));
}

export function loadChatSizes(): void {
  const raw = prefJSON<Partial<Record<SizeKey, unknown>> | null>("fleet.chatsize");
  if (raw && typeof raw === "object") {
    const next = { ...sizes };
    for (const k of KEYS) if (typeof raw[k] === "number" && Number.isFinite(raw[k])) next[k] = clamp(k, raw[k]);
    sizes = next;
  }
  apply();
}

export const chatSize = (k: SizeKey): number => sizes[k];

// A subscriber for size changes — the pane corner's width toggle keeps its limited terminal on the
// column: when the slider moves --chat-col, the pane reruns ITS OWN fit path (no second resize way).
export function onChatSize(fn: () => void): void { listeners.add(fn); }

export function setChatSize(k: SizeKey, n: number): void {
  sizes = { ...sizes, [k]: clamp(k, n) };
  apply();
  save();
}

// Ctrl/Cmd +/− move the three TEXT sizes together by one step, each inside its own range (the
// column stays where it is); 0 resets all four
export function stepChatSizes(dir: -1 | 0 | 1): void {
  sizes = dir === 0
    ? { ...DEFAULTS }
    : { ...sizes, text: clamp("text", sizes.text + dir), code: clamp("code", sizes.code + dir), ui: clamp("ui", sizes.ui + dir * 0.5) };
  apply();
  save();
}

// The "Schrift" section of the settings window: one range per variable plus a reset. A single
// element for the page — the window (src/client.ts#openSettings) moves it into itself — so a
// reopened window leaks nothing. Its ONE home is that section (G5.3); the Aa corner button opens
// the window right there, the panel has no popover of its own anymore.
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
    input.step = String(spec.step);
    const val = document.createElement("span");
    val.className = "sizeval";
    input.addEventListener("input", () => setChatSize(k, Number(input.value)));
    row.append(name, input, val);
    return { k, input, val, row };
  });
  const sync = () => {
    for (const r of rows) {
      r.input.value = String(sizes[r.k]);
      r.val.textContent = shown(r.k, sizes[r.k]);
    }
  };
  listeners.add(sync);
  sync();
  const reset = document.createElement("button");
  reset.className = "sizereset";
  reset.textContent = "Standard";
  reset.title = "Standardgrößen und -breite (Strg/⌘ 0)";
  reset.addEventListener("click", () => stepChatSizes(0));
  const hint = document.createElement("div");
  hint.className = "sizehint";
  hint.textContent = "Strg/⌘ + / − / 0";
  box.append(...rows.map((r) => r.row), reset, hint);
  panel = box;
  return box;
}
