// DIE AUFGABE EINES STARTS (Harness 2.0 Schritt 3; ~/local-notes/grok-auswertung/harness-2-0-antwort.md Lücke 2, die Felder aus SYSTEM.md
// §Act): was entstehen soll, was er nicht anfasst, wann es fertig ist, womit er das belegt, an wen er zurückmeldet. Nur das Ziel muss sein.
// Die Branch-Tür macht daraus die erste Nachricht an die Session (aufgabeAlsText), die Historie trägt sie als Objekt. Server und Fenster
// lesen beide hier; kein DOM, keine Importe.
export interface Aufgabe { ziel: string; grenze?: string; fertig?: string; beleg?: string; rueckweg?: string }
export const AUFGABE_FELDER = [["grenze", "Leave alone"], ["fertig", "Done when"], ["beleg", "Proof"], ["rueckweg", "Report back to"]] as const;
export type AufgabeFeld = typeof AUFGABE_FELDER[number][0];
export const AUFGABE_MAX = 4000;

// nur mit dem Ziel ist die Nachricht das Ziel selbst, wie vor der Aufgabe; sonst je Feld eine Zeile
export function aufgabeAlsText(a: Aufgabe): string {
  const mehr = AUFGABE_FELDER.flatMap(([k, wort]) => { const t = a[k]?.trim(); return t ? [`${wort}: ${t}`] : []; });
  return mehr.length ? [`Goal: ${a.ziel.trim()}`, ...mehr].join("\n") : a.ziel.trim();
}

// was eine Tür annimmt: ein Objekt mit Ziel und höchstens den vier Feldern, alles Text; leere Felder fallen weg. Sonst ein Satz, warum nicht
export function aufgabeAus(v: unknown): Aufgabe | string {
  if (!v || typeof v !== "object" || Array.isArray(v)) return "aufgabe is an object { ziel, grenze?, fertig?, beleg?, rueckweg? }";
  const o = Object.fromEntries(Object.entries(v));
  const fremd = Object.keys(o).find((k) => k !== "ziel" && !AUFGABE_FELDER.some(([f]) => f === k));
  if (fremd !== undefined) return `aufgabe has no field “${fremd.slice(0, 40)}”`;
  if (Object.values(o).some((x) => typeof x !== "string")) return "every field of aufgabe is text";
  const ziel = typeof o.ziel === "string" ? o.ziel.trim() : "";
  if (!ziel) return "a task needs a goal (ziel)";
  const a: Aufgabe = { ziel, ...Object.fromEntries(AUFGABE_FELDER.flatMap(([k]) => { const t = typeof o[k] === "string" ? o[k].trim() : ""; return t ? [[k, t]] : []; })) };
  const n = aufgabeAlsText(a).length;
  return n > AUFGABE_MAX ? `the task has ${n} characters, ${AUFGABE_MAX} are allowed` : a;
}
