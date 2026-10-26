// THE ONE REGISTRY for every device-local preference (Grammatik G5.1, card K2).
//
// Everything that only changes THIS browser's view — text size, data saver, picker filters,
// remembered folds and section states — lives under one fleet.* key, and every key stands in
// the PREFS table below with an owner label and its default. All reads and writes go through
// the functions at the bottom, each of them try/catch-guarded: a blocked, full or broken
// localStorage degrades to the default for this page load, it never breaks the page. No naked
// localStorage call may appear in src/ outside this file (e2e/slots.ts pins that).
//
// The table is also what the settings window renders: every key with row !== false shows up
// under "Dieses Gerät" with its label, its default and a way back (G5.1). Keys with
// row: false are registered for the same reason — another page's storage, or legacy plumbing —
// but have no row in this app's window.
//
// What belongs here is DEVICE-LOCAL only. Anything that changes the Fleet for every device is
// a server value behind a route (G5.2) and enters the window's "Fleet" section — never this
// table. Key names are never renamed: a stored value must survive this file (VERBOTEN, K2).

import { PLA_ACK_KEY } from "./plaudit";

export interface PrefDef {
  key: string;
  // how the stored string is read back: bool "1"/"0" (or offValue), choice of values, number,
  // raw text, or an opaque JSON document
  kind: "bool" | "choice" | "number" | "text" | "json";
  label: string;
  // the value when nothing is stored — for kind "json" the empty document, for "bool" "1"/"0"
  def: string;
  hint?: string;
  // the "Dieses Gerät" row shape; false = registered, but no row in this app's window
  row?: "toggle" | "choice" | "value" | false;
  values?: string[];
  // legacy encoding: a bool stored as this word when off (fleet.modelSwitchWarn stores "off")
  offValue?: string;
  // row hidden on MOBILE_MQ: the control it mirrors does not exist on the phone
  desktopOnly?: boolean;
}

export const PREFS: PrefDef[] = [
  // --- rows of the settings window, in window order -------------------------------------------
  { key: "fleet.datasaver", kind: "bool", label: "Data saver", def: "0", row: "toggle",
    hint: "Keeps the window quiet while it is in the background: slower polls, shorter scrollback at start." },
  { key: "fleet.board", kind: "bool", label: "Info column", def: "0", row: "toggle", desktopOnly: true,
    hint: "The right column with info on the focused session." },
  { key: "fleet.sidecollapsed", kind: "bool", label: "Sidebar collapsed", def: "0", row: "toggle", desktopOnly: true,
    hint: "The left sidebar folded away — a click on ‹ opens it again." },
  { key: "fleet.bandDepth", kind: "choice", label: "Drag band: how far back", def: "all", values: ["all", "3", "5"], row: "choice",
    hint: "How many earlier sessions a sidebar row reaches when you drag it." },
  { key: "fleet.termlimit", kind: "bool", label: "Limit terminal to the text column", def: "0", row: "toggle",
    hint: "Applies where the layout has room — a multi-pane layout or a phone overrides it." },
  { key: "fleet.ranke.repos", kind: "json", label: "Open and closed repos in Workplaces", def: "{}", row: "value",
    hint: "Reset opens the repo of the selected session." },
  { key: "fleet.more", kind: "bool", label: "“More” panel open", def: "0", row: "toggle",
    hint: "The drop-down with more actions under the sidebar header." },
  { key: "fleet.histall", kind: "bool", label: "Prompt history: all sessions", def: "0", row: "toggle",
    hint: "Otherwise the history shows only the session of the focused pane." },
  { key: "fleet.modelSwitchWarn", kind: "bool", label: "Ask before switching model", def: "1", row: "toggle", offValue: "off",
    hint: "A model switch costs the session its prompt cache — Apply asks first." },
  { key: "fleet.queue.scope", kind: "choice", label: "Queue", def: "tree", values: ["tree", "line"], row: "choice",
    hint: "Tree: programs and their branches as a tree beside the list. Line: a picker in the tool row. A phone always gets the line." },
  { key: "fleet.board.folds", kind: "json", label: "Open sections of the info column", def: "[]", row: "value",
    hint: "Setup, Rights, Files, Your prompts and the full History. Reset closes them all." },
  { key: "fleet.gs.view", kind: "json", label: "git structure: landed branches and heads without a session", def: "{}", row: "value",
    hint: "The gear in the repo header hides them. Reset shows everything." },
  { key: "fleet.board.landform", kind: "json", label: "Land form per project and lane", def: "{}", row: "value",
    hint: "Commits as worked, or one commit at land. Reset sets everything to commits as worked." },
  { key: "fleet.stacks.closed", kind: "json", label: "Collapsed stacks in the session list", def: "[]", row: "value",
    hint: "Reset opens all stacks again." },
  { key: "fleet.view", kind: "json", label: "Window layout", def: "{}", row: "value",
    hint: "Arrangement and focus of the panes. The default is one pane." },
  { key: PLA_ACK_KEY, kind: "number", label: "Acknowledgement of the last check", def: "0", row: "value",
    hint: "Reset shows a check message marked as seen again." },
  { key: "fleet.chatsize", kind: "json", label: "Text size and column", row: false,
    def: '{"text":14,"code":12.5,"ui":11,"width":780}',
    hint: "The sizes themselves are set in the window under “Text size”." },

  // --- registered without a row: another page's storage, or legacy plumbing --------------------
  { key: "fleet.stacks", kind: "json", label: "legacy: collapsed stacks", def: "[]", row: false,
    hint: "Deleted on the first write — the old list meant the OPEN stacks." },
  { key: "fleet.current", kind: "number", label: "legacy: last slot", def: "0", row: false,
    hint: "Migration at start only; the new store is fleet.view." },
  { key: "fleetShareFont", kind: "number", label: "Share view: font size", def: "12", row: false,
    hint: "Storage of the separate share view, not of this window." },
  { key: "fleetShareName", kind: "text", label: "Share view: comment name", def: "", row: false,
    hint: "Storage of the separate share view." },
  { key: "fleetShareSide", kind: "bool", label: "Share view: sidebar open", def: "1", row: false,
    hint: "Storage of the separate share view; a phone always starts on the stream." },
  { key: "fleetHelperDevice", kind: "text", label: "Helper portal: device ID", def: "", row: false,
    hint: "Only an identifier, no secret: binds this browser to the name it chose in the helper portal." },
  { key: "fleetHelperClaim", kind: "json", label: "Helper portal: claimed task", def: "null", row: false,
    hint: "Which bundle this browser claims in the helper portal." },
  { key: "fleet.drafts", kind: "json", label: "Unsent drafts", def: "{}", row: false,
    hint: "The composer draft per slot, so it survives a reload; gone after sending." },
];

const byKey = new Map(PREFS.map((p) => [p.key, p]));
export const prefDef = (key: string): PrefDef | undefined => byKey.get(key);

// --- storage. Every access guarded: private mode, full quota or a corrupted entry degrades to
// the default instead of taking the page down (G5.1 — before the registry only 5 of 46 call
// sites were guarded, several bare reads sat on the boot path).
export function prefRaw(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function prefSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* storage refused — the value holds for this page load only */ }
}

export function prefBool(key: string): boolean {
  const raw = prefRaw(key);
  if (raw === null) return (byKey.get(key)?.def ?? "0") === "1";
  return raw !== (byKey.get(key)?.offValue ?? "0");
}

export function prefSetBool(key: string, on: boolean): void {
  prefSet(key, on ? "1" : byKey.get(key)?.offValue ?? "0");
}

export function prefNumber(key: string): number {
  const def = byKey.get(key)?.def ?? "0";
  const n = Number(prefRaw(key) ?? def);
  return Number.isFinite(n) ? n : Number(def) || 0;
}

export function prefText(key: string): string {
  return prefRaw(key) ?? byKey.get(key)?.def ?? "";
}

export function prefJSON<T>(key: string): T {
  const def = byKey.get(key)?.def ?? "null";
  const raw = prefRaw(key) ?? def;
  try { return JSON.parse(raw) as T; }
  catch { try { return JSON.parse(def) as T; } catch { return null as T; } }
}
