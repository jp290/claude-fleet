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
  ui: { label: "Interface", min: 9, max: 16, def: 11, step: 0.5, v: "--chat-ui-fs" },
  width: { label: "Width", min: 600, max: 1640, def: 780, step: 20, v: "--chat-col" },
};
export const COLUMN_FULL = SIZE_SPEC.width.max;
const cssValue = (k: SizeKey, n: number): string => (k === "width" && n >= COLUMN_FULL ? "100000px" : `${n}px`);
const shown = (k: SizeKey, n: number): string => (k === "width" && n >= COLUMN_FULL ? "full" : `${n}px`);

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

// THE TERMINAL'S FONT SIZE (card K8, T6): one px value for every pane's xterm. It stands apart from
// the conversation's sizes — their keys, steps and Ctrl/Cmd 0 reset are untouched — and rides in the
// same fleet.chatsize document under "term". null = nothing chosen: the device default the pane
// constructor has always used (11 px on a phone, 12 px elsewhere), handed in by src/client.ts.
export const TERM_SPEC = { label: "Terminal", min: 9, max: 18, step: 1 };
let termPx: number | null = null;
let termDefault = (): number => 12;
const termListeners = new Set<() => void>();
const clampTerm = (n: number): number => Math.round(Math.min(TERM_SPEC.max, Math.max(TERM_SPEC.min, n)));
export const termFontSize = (): number => termPx ?? termDefault();
export function setTermDefault(fn: () => number): void { termDefault = fn; }
export function onTermSize(fn: () => void): void { termListeners.add(fn); }
export function setTermSize(n: number | null): void {
  termPx = n === null ? null : clampTerm(n);
  for (const l of termListeners) l();
  save();
}
// Ctrl/Cmd +/− with a terminal on screen: one px per step; 0 goes back to the device default
export function stepTermSize(dir: -1 | 0 | 1): void {
  setTermSize(dir === 0 ? null : termFontSize() + dir);
}

function save(): void {
  prefSet("fleet.chatsize", JSON.stringify(termPx === null ? sizes : { ...sizes, term: termPx }));
}

export function loadChatSizes(): void {
  const raw = prefJSON<Partial<Record<SizeKey | "term", unknown>> | null>("fleet.chatsize");
  if (raw && typeof raw === "object") {
    const next = { ...sizes };
    for (const k of KEYS) if (typeof raw[k] === "number" && Number.isFinite(raw[k])) next[k] = clamp(k, raw[k]);
    sizes = next;
    if (typeof raw.term === "number" && Number.isFinite(raw.term)) termPx = clampTerm(raw.term);
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
  // the terminal row: same shape as the chat rows, its own value (TERM_SPEC)
  const termRow = document.createElement("label");
  termRow.className = "sizerow";
  const termName = document.createElement("span");
  termName.textContent = TERM_SPEC.label;
  const termInput = document.createElement("input");
  termInput.type = "range";
  termInput.min = String(TERM_SPEC.min);
  termInput.max = String(TERM_SPEC.max);
  termInput.step = String(TERM_SPEC.step);
  termInput.setAttribute("aria-label", "Terminal font size");
  const termVal = document.createElement("span");
  termVal.className = "sizeval";
  termInput.addEventListener("input", () => setTermSize(Number(termInput.value)));
  termRow.title = "Font size in every pane's terminal — the column count follows";
  termRow.append(termName, termInput, termVal);
  const sync = () => {
    for (const r of rows) {
      r.input.value = String(sizes[r.k]);
      r.val.textContent = shown(r.k, sizes[r.k]);
    }
    termInput.value = String(termFontSize());
    termVal.textContent = `${termFontSize()}px`;
  };
  listeners.add(sync);
  termListeners.add(sync);
  sync();
  const reset = document.createElement("button");
  reset.className = "sizereset";
  reset.textContent = "Reset";
  reset.title = "Default sizes, width and terminal font (Ctrl/⌘ 0 resets the visible view)";
  reset.addEventListener("click", () => { stepChatSizes(0); setTermSize(null); });
  const hint = document.createElement("div");
  hint.className = "sizehint";
  hint.textContent = "Ctrl/⌘ + / − / 0";
  box.append(...rows.map((r) => r.row), termRow, reset, hint);
  panel = box;
  return box;
}
