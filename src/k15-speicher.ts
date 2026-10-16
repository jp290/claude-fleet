// K15 · DER SPEICHER AUF DEM SERVER (Owner 16.10. 09:1x: „[Zitat entfernt]“
// ): eigene Profile, Fassungen und Packs des Fensters „[Zitat entfernt]“ liegen hinter SPEICHER_ROUTE in einer Datei im
// Zustandsverzeichnis (server/k15-speicher.ts). Hier stehen die Route, die Grenzen und die Form, die der Server annimmt; Server und
// Fenster lesen beide daraus. Kein DOM, keine Importe. Was ein Eintrag im Einzelnen trägt, liest das Fenster mit seinen eigenen Lesern
// (k15-wortlaut.ts#fassungenImport, k15-kontextpack.ts#packsImport, k15-import.ts#profilAus).
export const SPEICHER_ROUTE = "/api/k15/eigenes";
export const MAX_FASSUNGEN = 200;
export const MAX_PACKS = 50;
export const MAX_PROFILE = 40;
export const MAX_SPEICHER_BYTES = 10_000_000;

const LISTEN = [
  { feld: "fassungen", max: MAX_FASSUNGEN, wort: "Fassungen", pflicht: ["abschnitt", "text"] },
  { feld: "packs", max: MAX_PACKS, wort: "Packs", pflicht: ["id", "name", "text"] },
  { feld: "profile", max: MAX_PROFILE, wort: "Profile", pflicht: ["id", "rolle", "schiene"] },
] as const;

// null = der Server nimmt es an; sonst ein Satz, warum nicht
export function speicherFehler(o: unknown): string | null {
  if (!o || typeof o !== "object" || Array.isArray(o)) return "erwartet ist ein Objekt mit fassungen, packs und profile";
  const fremd = Object.keys(o).find((k) => !LISTEN.some((l) => l.feld === k));
  if (fremd !== undefined) return `unbekanntes Feld „${fremd.slice(0, 40)}“`;
  for (const l of LISTEN) {
    const liste: unknown = Object.getOwnPropertyDescriptor(o, l.feld)?.value;
    if (!Array.isArray(liste)) return `„${l.feld}“ fehlt oder ist keine Liste`;
    if (liste.length > l.max) return `${liste.length} ${l.wort} sind mehr als ${l.max}`;
    const i = liste.findIndex((x: unknown) => !x || typeof x !== "object"
      || l.pflicht.some((k) => typeof Object.getOwnPropertyDescriptor(x, k)?.value !== "string"));
    if (i >= 0) return `Eintrag ${i + 1} in „${l.feld}“ braucht ${l.pflicht.join(", ")} als Text`;
  }
  return null;
}
