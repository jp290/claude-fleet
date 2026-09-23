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
  { key: "fleet.datasaver", kind: "bool", label: "Datensparen", def: "0", row: "toggle",
    hint: "Hält das Fenster ruhig, wenn es im Hintergrund liegt: Abfragen gedehnt, Scrollback-Start gekappt." },
  { key: "fleet.board", kind: "bool", label: "Info-Spalte", def: "0", row: "toggle", desktopOnly: true,
    hint: "Die rechte Spalte mit den Infos zur fokussierten Sitzung." },
  { key: "fleet.sidecollapsed", kind: "bool", label: "Seitenleiste zugeklappt", def: "0", row: "toggle", desktopOnly: true,
    hint: "Die linke Leiste eingeklappt — ein Klick auf ‹ öffnet sie wieder." },
  { key: "fleet.bandDepth", kind: "choice", label: "Zieh-Band: wie weit zurück", def: "all", values: ["all", "3", "5"], row: "choice",
    hint: "Wie viele frühere Sitzungen eine Zeile der linken Leiste beim Ziehen erreicht." },
  { key: "fleet.termlimit", kind: "bool", label: "Terminal auf die Textspalte begrenzen", def: "0", row: "toggle",
    hint: "Wirkt, wo das Layout Platz dafür lässt — ein Mehrfach-Layout oder das Telefon heben es auf." },
  { key: "fleet.meter.open", kind: "bool", label: "Checks im Info-Bereich aufgeklappt", def: "0", row: "toggle",
    hint: "Der Aufklapper mit Sperre, laufenden Checks und jeder Meldung." },
  { key: "fleet.more", kind: "bool", label: "Panel „mehr“ aufgeklappt", def: "0", row: "toggle",
    hint: "Der Aufklapper mit weiteren Aktionen unter dem Kopf der Leiste." },
  { key: "fleet.histall", kind: "bool", label: "Prompt-Verlauf: alle Sitzungen", def: "0", row: "toggle",
    hint: "Sonst zeigt der Verlauf nur die Sitzung des fokussierten Panes." },
  { key: "fleet.modelSwitchWarn", kind: "bool", label: "Beim Modellwechsel nachfragen", def: "1", row: "toggle", offValue: "off",
    hint: "Ein Modellwechsel kostet die Sitzung ihren Prompt-Cache — Apply fragt erst." },
  { key: "fleet.queue.scope", kind: "choice", label: "Warteschlange", def: "tree", values: ["tree", "line"], row: "choice",
    hint: "Baum: ein Programmbaum neben der Liste. Zeile: eine Auswahl in der Werkzeugzeile. Ein Telefon bekommt immer die Zeile." },
  { key: "fleet.hidewt", kind: "bool", label: "Lanes im Ordner-Picker ausblenden", def: "1", row: "toggle",
    hint: "Worktree-Kopien (fleet-*) überfluten die Vorschläge — der Standard blendet sie aus." },
  { key: "fleet.pkdot", kind: "bool", label: "Punkt-Ordner im Picker zeigen", def: "0", row: "toggle",
    hint: "Ohne diesen Schalter sind .claude und .github nur über den Pfad erreichbar." },
  { key: "fleet.pkdir", kind: "text", label: "Zuletzt gewählter Ordner", def: "~", row: "value",
    hint: "Der Picker startet bei seinem nächsten Öffnen hier." },
  { key: "fleet.board.folds", kind: "json", label: "Zugeklappte Abschnitte der Info-Spalte", def: "[]", row: "value",
    hint: "Zurücksetzen klappt alle Abschnitte wieder auf." },
  { key: "fleet.stacks.closed", kind: "json", label: "Zugeklappte Stapel der Sitzungsliste", def: "[]", row: "value",
    hint: "Zurücksetzen klappt alle Stapel wieder auf." },
  { key: "fleet.view", kind: "json", label: "Fenster-Layout", def: "{}", row: "value",
    hint: "Anordnung und Fokus der Panes. Standard ist ein Pane." },
  { key: PLA_ACK_KEY, kind: "number", label: "Quittung des letzten Checks", def: "0", row: "value",
    hint: "Zurücksetzen zeigt eine als gesehen markierte Prüfmeldung wieder." },
  { key: "fleet.chatsize", kind: "json", label: "Schrift und Spalte", row: false,
    def: '{"text":14,"code":12.5,"ui":11,"width":780}',
    hint: "Die Zahlen pflegt src/chatsize.ts (SIZE_SPEC); die Zeilen liegen im Fenster unter „Schrift“." },

  // --- registered without a row: another page's storage, or legacy plumbing --------------------
  { key: "fleet.stacks", kind: "json", label: "alt: zugeklappte Stapel", def: "[]", row: false,
    hint: "Wird beim ersten Schreiben gelöscht — die alte Liste meinte die OFFENEN Stapel." },
  { key: "fleet.current", kind: "number", label: "alt: letzter Slot", def: "0", row: false,
    hint: "Nur Migration beim Start; die neue Ablage ist fleet.view." },
  { key: "fleetShareFont", kind: "number", label: "Teilen-Ansicht: Schriftgröße", def: "12", row: false,
    hint: "Speicher der separaten Teilen-Ansicht, nicht dieses Fensters." },
  { key: "fleetShareName", kind: "text", label: "Teilen-Ansicht: Kommentar-Name", def: "", row: false,
    hint: "Speicher der separaten Teilen-Ansicht." },
  { key: "fleetShareSide", kind: "bool", label: "Teilen-Ansicht: Seitenleiste offen", def: "1", row: false,
    hint: "Speicher der separaten Teilen-Ansicht; ein Telefon startet immer auf dem Strom." },
  { key: "fleetHelperDevice", kind: "text", label: "Helfer-Portal: Geräte-ID", def: "", row: false,
    hint: "Nur eine Kennung, kein Geheimnis: bindet diesen Browser an den Namen, den er im Helfer-Portal wählte." },
  { key: "fleetHelperClaim", kind: "json", label: "Helfer-Portal: gezogener Auftrag", def: "null", row: false,
    hint: "Welches Bündel dieses Browser im Helfer-Portal zieht." },
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
