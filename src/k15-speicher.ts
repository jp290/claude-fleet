// K15 · DER SPEICHER AUF DEM SERVER (Owner 16.10. 09:1x: „[Zitat entfernt]“
// ): eigene Profile, Fassungen und Packs des Fensters „[Zitat entfernt]“ liegen hinter SPEICHER_ROUTE in einer Datei im
// Zustandsverzeichnis (server/k15-speicher.ts). Hier stehen die Route, die Grenzen und die Form, die der Server annimmt; Server und
// Fenster lesen beide daraus. Kein DOM, keine Importe. Was ein Eintrag im Einzelnen trägt, liest das Fenster mit seinen eigenen Lesern
// (k15-wortlaut.ts#fassungenImport, k15-kontextpack.ts#packsImport, k15-import.ts#profilAus, für Konstellationen #importKonst).
// KONSTELLATIONEN (Konstellation Stück 1, Owner 19.10.: Agenten frei einstellbar, dann Konstellationen, am Ende teilbar) liegen in der
// Form des vollständigen Exports (k15-entwurf-modell.ts#exportJson) mit ihrer Kennung davor. Die Liste darf fehlen: Ein Fenster von vor
// diesem Schritt kennt sie nicht, und der Server behält dann, was er hat (server/k15-speicher.ts).
export const SPEICHER_ROUTE = "/api/k15/eigenes";
// die Datei dazu im Zustandsverzeichnis
export const SPEICHER_DATEI = "k15-eigenes.json";
// die Freigabe der Rechte eines mitgereisten Sitzes über den Deckel (src/sitz.ts#sitzRechte): POST { konst, pos }. Ein PUT des Speichers bringt sie
// nie mit, er behält nur eine, die hier gegeben wurde (server/k15-speicher.ts)
export const FREIGABE_ROUTE = "/api/k15/freigabe";
// feste Fassungen je Konstellation (server/konst-fassungen.ts): …/:id/fassungen, …/:id/fassungen/:hash, …/:id/diff?von=&zu=, PUT …/:id/aktiv
export const KONST_ROUTE = "/api/k15/konst";
// jeder Start einer Session, neueste zuerst (server/start-historie.ts)
export const HISTORIE_ROUTE = "/api/k15/historie";
// die Läufe einer Konstellation (server/laeufe.ts): GET Liste, GET …/:id, POST bindet einen gestarteten Slot
export const LAEUFE_ROUTE = "/api/k15/laeufe";
export const MAX_FASSUNGEN = 200;
export const MAX_PACKS = 50;
export const MAX_PROFILE = 40;
export const MAX_KONSTELLATIONEN = 50;
export const MAX_SPEICHER_BYTES = 10_000_000;

const LISTEN = [
  { feld: "fassungen", max: MAX_FASSUNGEN, wort: "Fassungen", pflicht: ["abschnitt", "text"] },
  { feld: "packs", max: MAX_PACKS, wort: "Packs", pflicht: ["id", "name", "text"] },
  { feld: "profile", max: MAX_PROFILE, wort: "Profile", pflicht: ["id", "rolle", "schiene"] },
  { feld: "konstellationen", max: MAX_KONSTELLATIONEN, wort: "Konstellationen", pflicht: ["id", "name"], kann: true },
] as const;

// null = der Server nimmt es an; sonst ein Satz, warum nicht
export function speicherFehler(o: unknown): string | null {
  if (!o || typeof o !== "object" || Array.isArray(o)) return "expected an object with fassungen, packs and profile";
  const fremd = Object.keys(o).find((k) => !LISTEN.some((l) => l.feld === k));
  if (fremd !== undefined) return `unknown field “${fremd.slice(0, 40)}”`;
  for (const l of LISTEN) {
    const liste: unknown = Object.getOwnPropertyDescriptor(o, l.feld)?.value;
    if (liste === undefined && "kann" in l) continue;
    if (!Array.isArray(liste)) return `“${l.feld}” is missing or not a list`;
    if (liste.length > l.max) return `${liste.length} ${l.wort} are more than ${l.max}`;
    const i = liste.findIndex((x: unknown) => !x || typeof x !== "object"
      || l.pflicht.some((k) => typeof Object.getOwnPropertyDescriptor(x, k)?.value !== "string"));
    if (i >= 0) return `entry ${i + 1} in “${l.feld}” needs ${l.pflicht.join(", ")} as text`;
  }
  return null;
}
