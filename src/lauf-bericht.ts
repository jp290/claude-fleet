// DER LAUF ALS BERICHT IN DER GETEILTEN DATEI (docs/start/direction.md Schritt 3: „An export carries the task with its check, the run …“;
// docs/konstellation/restplan.md T12): ein gefahrener Lauf, so aufgeschrieben, dass eine andere Fleet ihn lesen und dieselben Sitze auf
// dieselbe Aufgabe setzen kann. Er steht neben der Konstellation unter `laeufe` und zählt nicht in ihre Fassung: er nennt sie mit `fassung`.
// Der Import prüft ihn und zeigt ihn an; er startet nichts und schreibt nichts in die eigenen Läufe (server/laeufe.ts), denn Slots und
// Commits sind die der fremden Fleet. Server und Fenster lesen beide hier; kein DOM, nur src/modell-verlauf.ts als Import.
import { modellAbschnittAus, type ModellAbschnitt } from "./modell-verlauf";

// ablehnungen: was der Klassifizierer dem Sitz verweigert hat, je ein Satz; null = nicht nachgesehen. zahlen: was gemessen ist, je Name.
// modelle: welches Modell wirklich antwortete, je Abschnitt ab einem Zeitpunkt, mit dem Grund jedes Wechsels (src/modell-verlauf.ts); null =
// nicht nachgesehen, fehlt in Läufen von davor. Ein Wechsel macht den Lauf nicht ungültig; er steht da, damit niemand „dasselbe Setup“ annimmt
export interface LaufSitz { pos: string; wie: string; ablehnungen: string[] | null; zahlen: Record<string, number>; modelle?: ModellAbschnitt[] | null }
export interface BerichtNachricht { von: string; an: string; was: string; text: string }
export type Urteil = "bestaetigt" | "plausibel" | "verworfen" | "nicht verfolgt";
export interface Befund { titel: string; urteil: Urteil; schwere: string | null; beleg: string }
export interface LaufBericht {
  fassung: string; quelle: string; start: string; ende: string; sitze: LaufSitz[]; nachrichten: BerichtNachricht[];
  befunde: Befund[]; ohneBefund: string[]; kosten: string; grenzen: string[];
}
export const URTEILE: readonly Urteil[] = ["bestaetigt", "plausibel", "verworfen", "nicht verfolgt"];
export const MAX_LAEUFE = 20;
const MAX_TEXT = 40_000;

const obj = (v: unknown): Record<string, unknown> | null => v !== null && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : null;
const text = (v: unknown): string | null => typeof v === "string" && v.trim() && v.length <= MAX_TEXT ? v : null;
const texte = (v: unknown): string[] | null => Array.isArray(v) && v.every((x) => text(x) !== null) ? v.map(String) : null;
const zeit = (v: unknown): string | null => typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : null;

function sitzAus(v: unknown): LaufSitz | null {
  const o = obj(v), pos = text(o?.pos), wie = text(o?.wie);
  if (!o || !pos || !wie) return null;
  const ablehnungen = o.ablehnungen === null ? null : texte(o.ablehnungen);
  const z = o.zahlen === undefined ? {} : obj(o.zahlen);
  if ((o.ablehnungen !== null && !ablehnungen) || !z || Object.values(z).some((x) => typeof x !== "number" || !Number.isFinite(x))) return null;
  const modelle = o.modelle === undefined || o.modelle === null ? o.modelle : liste(o.modelle, modellAbschnittAus);
  if (o.modelle !== undefined && o.modelle !== null && !modelle) return null;
  return { pos, wie, ablehnungen, zahlen: Object.fromEntries(Object.entries(z).map(([k, x]) => [k, Number(x)])), ...(modelle !== undefined ? { modelle } : {}) };
}
function nachrichtAus(v: unknown): BerichtNachricht | null {
  const o = obj(v), von = text(o?.von), an = text(o?.an), was = text(o?.was), t = text(o?.text);
  return von && an && was && t ? { von, an, was, text: t } : null;
}
function befundAus(v: unknown): Befund | null {
  const o = obj(v), titel = text(o?.titel), beleg = text(o?.beleg);
  const urteil = URTEILE.find((u) => u === o?.urteil);
  const ohne = o?.schwere === undefined || o.schwere === null, schwere = ohne ? null : text(o?.schwere);
  return titel && beleg && urteil && (ohne || schwere) ? { titel, urteil, schwere, beleg } : null;
}
function liste<T>(v: unknown, eins: (x: unknown) => T | null): T[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.map(eins);
  return out.every((x): x is T => x !== null) ? out : null;
}

// EIN LAUF: jedes Feld da und von seiner Art, und jeder Sitz und jede Nachricht nennt eine Position der Konstellation (oder „owner“).
// Sonst ein Satz, warum nicht
export function laufBerichtAus(v: unknown, positionen: readonly string[]): LaufBericht | string {
  const o = obj(v);
  if (!o) return "is not an object";
  const fassung = typeof o.fassung === "string" && /^[0-9a-f]{64}$/.test(o.fassung) ? o.fassung : null;
  if (!fassung) return "has no fassung (sha256 of the constellation)";
  const quelle = text(o.quelle), kosten = text(o.kosten), start = zeit(o.start), ende = zeit(o.ende);
  if (!quelle || !kosten || !start || !ende) return "needs quelle, kosten, start and ende";
  const sitze = liste(o.sitze, sitzAus), nachrichten = liste(o.nachrichten, nachrichtAus), befunde = liste(o.befunde, befundAus);
  const ohneBefund = texte(o.ohneBefund), grenzen = texte(o.grenzen);
  if (!sitze?.length) return "has no valid sitze";
  if (!nachrichten) return "has a message missing von, an, was or text";
  if (!befunde) return "has a finding missing titel, beleg or a valid urteil";
  if (!ohneBefund || !grenzen) return "ohneBefund and grenzen are lists of sentences";
  const kennt = (x: string) => x === "owner" || positionen.includes(x);
  const fremd = [...sitze.map((s) => s.pos), ...nachrichten.flatMap((n) => [n.von, n.an])].find((x) => !kennt(x));
  if (fremd !== undefined) return `names “${fremd.slice(0, 40)}”, which is no position of this constellation`;
  return { fassung, quelle, start, ende, sitze, nachrichten, befunde, ohneBefund, kosten, grenzen };
}

export function laufBerichteAus(v: unknown, positionen: readonly string[]): LaufBericht[] | string {
  if (!Array.isArray(v)) return "laeufe is a list";
  if (v.length > MAX_LAEUFE) return `a file carries at most ${MAX_LAEUFE} runs here, this one has ${v.length}`;
  const out: LaufBericht[] = [];
  for (const [i, x] of v.entries()) {
    const l = laufBerichtAus(x, positionen);
    if (typeof l === "string") return `Run ${i + 1} ${l}`;
    out.push(l);
  }
  return out;
}
