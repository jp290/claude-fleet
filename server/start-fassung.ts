// DIE FASSUNG, MIT DER EINE BELEGUNG GESTARTET WURDE (Harness 2.0 Schritt 1: „der Hash, den Fleet vor dem Start zeigt, ist der Hash,
// der läuft“). Der Spawn hält die Fassung fest, die er für diese Belegung gerechnet hat; `anlass=laufend` zeigt sie, statt sie beim
// Lesen neu zu rechnen (neu gerechnet wanderte sie mit main, obwohl die Unterhaltung ihren Start behält). Eine Datei je Slot und
// Belegung; hängt an `slot` und `openedAt` wie jede Spur einer Belegung. Gelesen gilt sie nur, wenn ihr Hash stimmt.
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fassungsHash, type Fassung, type FassungAnlass } from "./fassung";

export const FASSUNG_ORDNER = "start-fassungen";

export interface GehalteneFassung {
  readonly fassung: Fassung;
  /** wie sie entstand: ein neuer Start oder eine Nachfolge */
  readonly wie: FassungAnlass;
  readonly am: number;
}

const datei = (dir: string, slot: number, openedAt: number): string => join(dir, FASSUNG_ORDNER, `${slot}-${openedAt}.json`);

/** Hält die Fassung dieser Belegung fest; eine ältere Belegung desselben Slots wird dabei vergessen. */
export function halteFassung(dir: string, slot: number, openedAt: number, fassung: Fassung, wie: FassungAnlass, am = Date.now()): void {
  const ordner = join(dir, FASSUNG_ORDNER);
  mkdirSync(ordner, { recursive: true, mode: 0o700 });
  const ziel = datei(dir, slot, openedAt);
  const roh = `${ziel}.${process.pid}.tmp`;
  writeFileSync(roh, JSON.stringify({ fassung, wie, am } satisfies GehalteneFassung), { mode: 0o600 });
  renameSync(roh, ziel);
  for (const name of readdirSync(ordner))
    if (name.startsWith(`${slot}-`) && name.endsWith(".json") && join(ordner, name) !== ziel) rmSync(join(ordner, name), { force: true });
}

/** Vergisst die Fassung dieser Belegung: ein Start, der vor dem Pane abbrach, lässt keine Datei zurück, die eine Belegung behauptet, die nie lief. */
export function vergissFassung(dir: string, slot: number, openedAt: number): void {
  rmSync(datei(dir, slot, openedAt), { force: true });
}

/** Die festgehaltene Fassung dieser Belegung, oder null: keine Datei, nicht lesbar, oder ihr Hash stimmt nicht mehr mit ihren Teilen. */
export function holeFassung(dir: string, slot: number, openedAt: number): GehalteneFassung | null {
  let roh: unknown;
  try {
    roh = JSON.parse(readFileSync(datei(dir, slot, openedAt), "utf8"));
  } catch {
    return null;
  }
  if (!roh || typeof roh !== "object") return null;
  const { fassung, wie, am } = roh as Partial<GehalteneFassung>;
  if (!fassung || typeof fassung !== "object" || !Array.isArray(fassung.teile) || typeof fassung.hash !== "string") return null;
  if ((wie !== "laufend" && wie !== "nachfolge" && wie !== "neu") || typeof am !== "number") return null;
  return fassungsHash(fassung.teile) === fassung.hash ? { fassung, wie, am } : null;
}
