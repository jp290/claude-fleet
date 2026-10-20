// DIE AUFGABE EINES STARTS (Harness 2.0 Schritt 3; ~/local-notes/grok-auswertung/harness-2-0-antwort.md Lücke 2, die Felder aus SYSTEM.md
// §Act): was entstehen soll, was er nicht anfasst, wann es fertig ist, womit er das belegt, an wen er zurückmeldet. Nur das Ziel muss sein.
// Die Branch-Tür macht daraus die erste Nachricht an die Session (aufgabeAlsText), die Historie trägt sie als Objekt. Server und Fenster
// lesen beide hier; kein DOM, keine Importe.
export interface Aufgabe { ziel: string; grenze?: string; fertig?: string; beleg?: string; rueckweg?: string }
export const AUFGABE_FELDER = [["grenze", "Grenze"], ["fertig", "Fertig, wenn"], ["beleg", "Beleg"], ["rueckweg", "Rückweg"]] as const;
export type AufgabeFeld = typeof AUFGABE_FELDER[number][0];
export const AUFGABE_MAX = 4000;

// nur mit dem Ziel ist die Nachricht das Ziel selbst, wie vor der Aufgabe; sonst je Feld eine Zeile
export function aufgabeAlsText(a: Aufgabe): string {
  const mehr = AUFGABE_FELDER.flatMap(([k, wort]) => { const t = a[k]?.trim(); return t ? [`${wort}: ${t}`] : []; });
  return mehr.length ? [`Ziel: ${a.ziel.trim()}`, ...mehr].join("\n") : a.ziel.trim();
}

// was eine Tür annimmt: ein Objekt mit Ziel und höchstens den vier Feldern, alles Text; leere Felder fallen weg. Sonst ein Satz, warum nicht
export function aufgabeAus(v: unknown): Aufgabe | string {
  if (!v || typeof v !== "object" || Array.isArray(v)) return "aufgabe ist ein Objekt { ziel, grenze?, fertig?, beleg?, rueckweg? }";
  const o = Object.fromEntries(Object.entries(v));
  const fremd = Object.keys(o).find((k) => k !== "ziel" && !AUFGABE_FELDER.some(([f]) => f === k));
  if (fremd !== undefined) return `aufgabe kennt kein Feld „${fremd.slice(0, 40)}“`;
  if (Object.values(o).some((x) => typeof x !== "string")) return "jedes Feld der Aufgabe ist Text";
  const ziel = typeof o.ziel === "string" ? o.ziel.trim() : "";
  if (!ziel) return "eine Aufgabe braucht ein Ziel";
  const a: Aufgabe = { ziel, ...Object.fromEntries(AUFGABE_FELDER.flatMap(([k]) => { const t = typeof o[k] === "string" ? o[k].trim() : ""; return t ? [[k, t]] : []; })) };
  const n = aufgabeAlsText(a).length;
  return n > AUFGABE_MAX ? `die Aufgabe hat ${n} Zeichen, erlaubt sind ${AUFGABE_MAX}` : a;
}
