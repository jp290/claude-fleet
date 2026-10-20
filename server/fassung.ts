// DIE FASSUNG EINES AGENTEN (docs/agent-objekt.md, Schnitt 1): alles, was eine Session beim Start
// bekommt, in den fünf Teilen Wer · Aufgabe · Liest · Darf · Arbeitet mit/endet, mit einem sha256
// über den Inhalt ALLER fünf Teile. Was Claude Code selbst mitbringt, steht getrennt daneben und
// gehört nicht in den Hash.
//
// Dieses Modul ist rein: es liest keine Datei, ruft keinen Server und schreibt nichts. Die Bausteine
// kommen aus den Funktionen, die auch der Spawn benutzt (server.ts#fassungFuerSlot); hier werden sie
// nur in die eine Form gebracht, die die Route zeigt, und gehasht. Fehlt eine Quelle, steht der
// Abschnitt mit `unknown` und einem Grund da — nie als leere Zeile und nie weggelassen.
import { createHash } from "node:crypto";

export type FassungAnlass = "neu" | "laufend" | "nachfolge";
export type FassungByte = number | "unknown";

/** Die Reihenfolge unter „Liest“ ist die Ladereihenfolge. Übergabe gibt es nur bei einer Nachfolge;
 *  Gedächtnis (Claudes Auto-Memory) lädt zwischen Wissen und Übergabe. */
export const LIEST_REIHENFOLGE = ["rolle", "projektregeln", "wissen", "gedaechtnis", "uebergabe", "eigenes"] as const;
export type LiestAbschnittId = (typeof LIEST_REIHENFOLGE)[number];

export interface FassungAbschnittEingang {
  readonly id: string;
  readonly quelle: string | null;
  readonly aenderbar: boolean | "unknown";
  /** null = die Quelle fehlt; dann nennt `grund` warum, und `bytes` ist "unknown" */
  readonly text?: string | null;
  /** nur setzen, wenn die Bytes nicht die des Textes sind (z. B. ein leerer Ankerblock mit 0) */
  readonly bytes?: FassungByte;
  readonly grund?: string;
  /** die Dateien, die dieser Abschnitt als geladen zeigt (Pfad und Bytes), in Ladereihenfolge */
  readonly dateien?: readonly { readonly pfad: string; readonly bytes: number }[];
}

export interface FassungAbschnitt {
  readonly id: string;
  readonly quelle: string | null;
  readonly aenderbar: boolean | "unknown";
  readonly bytes: FassungByte;
  readonly text: string | null;
  readonly grund?: string;
  readonly dateien?: readonly { readonly pfad: string; readonly bytes: number }[];
}

export interface FassungTeil {
  readonly id: "wer" | "aufgabe" | "liest" | "darf" | "arbeitet";
  readonly abschnitte: readonly FassungAbschnitt[];
}

export interface FassungEingang {
  readonly slot: number;
  readonly anlass: FassungAnlass;
  readonly wer: readonly FassungAbschnittEingang[];
  readonly aufgabe: readonly FassungAbschnittEingang[];
  readonly liest: readonly FassungAbschnittEingang[];
  readonly darf: readonly FassungAbschnittEingang[];
  readonly arbeitet: readonly FassungAbschnittEingang[];
  /** was Claude Code selbst mitbringt (claudeCodeStart); liegt NEBEN der Fassung, nicht im Hash */
  readonly claudeCode?: unknown;
}

export interface Fassung {
  readonly slot: number;
  readonly anlass: FassungAnlass;
  readonly teile: readonly FassungTeil[];
  readonly hash: string;
  /** getrennt vom Hash: was Claude Code selbst mitbringt, null für einen anderen Harness */
  readonly claudeCode: unknown;
  /** sagt es ausdrücklich, damit kein Leser claudeCode versehentlich in den Hash rechnet */
  readonly hashUmfasst: "fuenf-teile";
}

export const textAbschnitt = (id: string, quelle: string | null, text: string, aenderbar: boolean | "unknown" = true,
  bytes?: FassungByte, dateien?: readonly { readonly pfad: string; readonly bytes: number }[],
  grund?: string): FassungAbschnittEingang => ({ id, quelle, aenderbar, text, ...(bytes !== undefined ? { bytes } : {}),
    ...(dateien?.length ? { dateien } : {}), ...(grund ? { grund } : {}) });

export const unknownAbschnitt = (id: string, grund: string, quelle: string | null = null): FassungAbschnittEingang =>
  ({ id, quelle, aenderbar: "unknown", text: null, bytes: "unknown", grund });

const byteLength = (text: string): number => Buffer.byteLength(text);

function normalisiere(a: FassungAbschnittEingang): FassungAbschnitt {
  const text = typeof a.text === "string" ? a.text : null;
  const bytes = a.bytes ?? (text !== null ? byteLength(text) : "unknown");
  // Eine fehlende Quelle bleibt ein Abschnitt: unknown, Grund, nie leer.
  if (text === null)
    return { id: a.id, quelle: a.quelle, aenderbar: a.aenderbar, bytes: "unknown", text: null,
      grund: a.grund?.trim() || "keine Quelle — der Grund wurde nicht genannt", ...(a.dateien?.length ? { dateien: a.dateien } : {}) };
  return { id: a.id, quelle: a.quelle, aenderbar: a.aenderbar, bytes, text, ...(a.grund?.trim() ? { grund: a.grund } : {}),
    ...(a.dateien?.length ? { dateien: a.dateien } : {}) };
}

// kanonisch: Schlüssel sortiert, damit derselbe Inhalt denselben Hash ergibt, unabhängig von der
// Reihenfolge, in der ein Aufrufer seine Felder gebaut hat.
const kanon = (v: unknown): unknown => Array.isArray(v) ? v.map(kanon)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v)
    .filter(([, x]) => x !== undefined)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => [k, kanon(x)])) : v;

// DER HASH HÄNGT AM INHALT, NICHT AM ORT. `quelle` und die Pfade in `dateien` sind Anzeige (woher
// der Inhalt kommt); zwei Checkouts mit demselben Inhalt — auch über einen Symlink erreicht —
// ergeben denselben Hash. Von den Dateien zählen nur ihre Bytes und ihre Reihenfolge. Der `grund`
// eines fehlenden Abschnitts ist ebenfalls Anzeige: fehlt die Quelle, ist `text` null, und das
// genügt, um den Abschnitt als fehlend zu hashen, ohne einen lokalen Pfad in den Hash zu tragen.
const hashInhalt = (a: FassungAbschnitt): unknown => ({
  id: a.id, aenderbar: a.aenderbar, bytes: a.bytes, text: a.text,
  ...(a.dateien ? { dateien: a.dateien.map((datei) => datei.bytes) } : {}),
});

/** sha256 über den Inhalt der fünf Teile in kanonischer Form — claudeCode und Anlass gehören nicht dazu. */
export function fassungsHash(teile: readonly FassungTeil[]): string {
  return createHash("sha256").update(JSON.stringify(kanon(teile.map((t) =>
    ({ id: t.id, abschnitte: t.abschnitte.map(hashInhalt) }))))).digest("hex");
}

function teil(id: FassungTeil["id"], eingang: readonly FassungAbschnittEingang[]): FassungTeil {
  return { id, abschnitte: eingang.map(normalisiere) };
}

/**
 * Baut die Fassung aus den Bausteinen des Spawns. Unter „Liest“ gilt die Ladereihenfolge; bei
 * `laufend` fällt die Übergabe weg, auch wenn ein Aufrufer eine mitgibt. Jeder fehlende Abschnitt
 * wird durch `unknown` mit Grund ersetzt.
 */
export function baueFassung(e: FassungEingang): Fassung {
  const vorhanden = new Map<string, FassungAbschnittEingang[]>();
  for (const a of e.liest) vorhanden.set(a.id, [...(vorhanden.get(a.id) ?? []), a]);
  const reihenfolge = e.anlass === "nachfolge" ? LIEST_REIHENFOLGE : LIEST_REIHENFOLGE.filter((id) => id !== "uebergabe");
  const liest: FassungAbschnittEingang[] = reihenfolge.flatMap((id) => vorhanden.get(id) ?? [unknownAbschnitt(id,
    id === "uebergabe" ? "keine Übergabe gefunden (kein stehender Record, kein handoff-Report)"
      : id === "gedaechtnis" ? "kein Auto-Memory für diese Session"
      : `keine Quelle für „${id}“ genannt`)]);
  const teile = [
    teil("wer", e.wer),
    teil("aufgabe", e.aufgabe),
    teil("liest", liest),
    teil("darf", e.darf),
    teil("arbeitet", e.arbeitet),
  ];
  return { slot: e.slot, anlass: e.anlass, teile, hash: fassungsHash(teile),
    claudeCode: e.claudeCode ?? null, hashUmfasst: "fuenf-teile" };
}
