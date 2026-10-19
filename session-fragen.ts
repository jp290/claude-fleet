// THE FIVE QUESTIONS a start answers for its agent (owner 18.10., Z132 „[Zitat entfernt]“: one order that the window „[Zitat entfernt]“ and the
// register read alike, docs/session-ui/entwurf.md „[Zitat entfernt]“). Its own module without imports, so the browser bundle can take it.
export type SessionFrage = "auftrag" | "umstaende" | "hintergrund" | "howto" | "konzepte";
export const SESSION_FRAGEN: readonly { readonly id: SessionFrage; readonly wort: string; readonly frage: string }[] = [
  { id: "auftrag", wort: "Auftrag", frage: "Was soll ich tun?" },
  { id: "umstaende", wort: "Umstände", frage: "Wo bin ich, und womit arbeite ich?" },
  { id: "hintergrund", wort: "Hintergrund", frage: "Was weiß ich über dich und das Projekt?" },
  { id: "howto", wort: "How-to", frage: "Wie mache ich das hier?" },
  { id: "konzepte", wort: "Konzepte", frage: "Was bedeuten die Begriffe hier?" },
];
export const istFrage = (v: unknown): v is SessionFrage => SESSION_FRAGEN.some((f) => f.id === v);
