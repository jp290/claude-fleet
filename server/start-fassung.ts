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
// DIE FASSUNG DER VORGÄNGERIN (POST /api/self/einrichten): neben der Belegung, die ihr nachfolgte, damit Info → Setup zeigt, was neu ist.
// Eine eigene Datei, geschrieben, sobald die Nachfolgerin steht — nicht erst mit ihrem Brief, der ausbleiben kann.
const vorherDatei = (dir: string, slot: number, openedAt: number): string => join(dir, FASSUNG_ORDNER, `${slot}-${openedAt}.vorher.json`);

/** Hält die Fassung dieser Belegung fest; eine ältere Belegung desselben Slots wird dabei vergessen. */
export function halteFassung(dir: string, slot: number, openedAt: number, fassung: Fassung, wie: FassungAnlass, am = Date.now()): void {
  const ordner = join(dir, FASSUNG_ORDNER);
  mkdirSync(ordner, { recursive: true, mode: 0o700 });
  const ziel = datei(dir, slot, openedAt);
  const roh = `${ziel}.${process.pid}.tmp`;
  writeFileSync(roh, JSON.stringify({ fassung, wie, am } satisfies GehalteneFassung), { mode: 0o600 });
  renameSync(roh, ziel);
  for (const name of readdirSync(ordner))
    if (name.startsWith(`${slot}-`) && name.endsWith(".json") && join(ordner, name) !== ziel && join(ordner, name) !== vorherDatei(dir, slot, openedAt))
      rmSync(join(ordner, name), { force: true });
}

/** Hält die Fassung der Vorgängerin neben dieser Belegung fest; die Datei einer älteren Belegung räumt halteFassung. */
export function halteVorgaengerin(dir: string, slot: number, openedAt: number, fassung: Fassung): void {
  mkdirSync(join(dir, FASSUNG_ORDNER), { recursive: true, mode: 0o700 });
  const ziel = vorherDatei(dir, slot, openedAt), roh = `${ziel}.${process.pid}.tmp`;
  writeFileSync(roh, JSON.stringify(fassung), { mode: 0o600 });
  renameSync(roh, ziel);
}
/** Die Fassung der Vorgängerin dieser Belegung, oder null: keine Nachfolge, nicht lesbar, oder ihr Hash stimmt nicht mehr. */
export function holeVorgaengerin(dir: string, slot: number, openedAt: number): Fassung | null {
  try {
    const f = JSON.parse(readFileSync(vorherDatei(dir, slot, openedAt), "utf8")) as Fassung;
    return f && Array.isArray(f.teile) && typeof f.hash === "string" && fassungsHash(f.teile) === f.hash ? f : null;
  } catch { return null; }
}

/** Vergisst die Fassung dieser Belegung: ein Start, der vor dem Pane abbrach, lässt keine Datei zurück, die eine Belegung behauptet, die nie lief. */
export function vergissFassung(dir: string, slot: number, openedAt: number): void {
  rmSync(datei(dir, slot, openedAt), { force: true });
  rmSync(vorherDatei(dir, slot, openedAt), { force: true });
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
