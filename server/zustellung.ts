// DIE ZUSTELLUNG EINES SLOTS (Auftrag „Die Zustellung von Postfach-Nachrichten wird Teil des Setups“).
//
// Ob eine Postfach-Nachricht sofort in die Pane getippt oder in das bestehende Buendel gelegt wird,
// haengt an der Arbeit: eine Session, mit der der Owner spricht, will sie direkt; eine Lane, die
// gerade baut, will nicht dauerhaft unterbrochen werden. Der Wert steht am Slot (Slot.zustellung),
// wird wie Slot.rechte/Slot.agentMd gespeichert und von der Fassung mit seiner Quelle gezeigt.
//
// Dieses Modul ist rein: es liest keine Datei, ruft keinen Server und schreibt nichts. Die drei
// Fragen, die es beantwortet, sind absichtlich getrennt:
//   · WAS GILT — der gesetzte Wert oder der Standard nach Rolle (Slot mit Worktree = Lane);
//   · WIE KOMMT ES DURCH DIE TUER — nur die zwei Werte, null loescht zurueck auf den Standard;
//   · WAS TUT DER POSTFACH-TAKT — direkt wartet das Postfach-Fenster und geht als „sofort“,
//     gebuendelt ist sofort faellig und geht als „buendelbar“ in das vorhandene Buendel.
import type { FassungAbschnittEingang } from "./fassung";

export type Zustellung = "direkt" | "gebuendelt";
export const ZUSTELLUNG_WERTE = ["direkt", "gebuendelt"] as const;

export interface ZustellungFuerSlot {
  wert: Zustellung;
  quelle: "gesetzt" | "standard";
}

export const istZustellung = (v: unknown): v is Zustellung => v === "direkt" || v === "gebuendelt";

// DER STANDARD NACH ROLLE: eine Lane (ein Slot mit Worktree) sammelt, jede andere Session will
// direkt angesprochen werden. Der Worktree ist die eine Eigenschaft, die eine Lane von einer
// freien Session, einer MAIN und der Orchestratorin unterscheidet.
export const zustellungStandard = (hatWorktree: boolean): Zustellung => hatWorktree ? "gebuendelt" : "direkt";

// Was fuer diesen Slot gilt, und woher es kommt. Ein handgeschriebener oder alter Wert, der nicht
// zu den zwei Werten gehoert, ist kein gesetzter Wert: er faellt auf den Standard zurueck.
export function zustellungFuerSlot(raw: unknown, hatWorktree: boolean): ZustellungFuerSlot {
  return istZustellung(raw) ? { wert: raw, quelle: "gesetzt" }
    : { wert: zustellungStandard(hatWorktree), quelle: "standard" };
}

// Was fleet.json fuer einen Slot halten darf: nur die zwei Werte. Alles andere laedt als „nicht
// gesetzt“, damit eine Handeditur keinen dritten Zustand in die Zustellung bringt.
export const zustellungGeladen = (raw: unknown): Zustellung | null => istZustellung(raw) ? raw : null;

// Der Body der Owner-Tuer. `null` loescht die Wahl und stellt den Standard der Rolle wieder her;
// fehlt das Feld, ist das ein Fehler und keine stille Loeschung.
export function zustellungDerTuer(body: Record<string, unknown> | null):
  { ok: true; zustellung: Zustellung | null } | { ok: false; error: string } {
  const v = body?.zustellung;
  if (v === null) return { ok: true, zustellung: null };
  if (istZustellung(v)) return { ok: true, zustellung: v };
  return { ok: false, error: `zustellung must be ${ZUSTELLUNG_WERTE.map((w) => `"${w}"`).join(" or ")}, or null for the role default` };
}

// WAS DER POSTFACH-TAKT AUS DER WAHL MACHT. `direkt` behaelt das eine Minute kurze Fenster und
// sendet als „sofort“ (der Weg von tickPostfachZustellung heute). `gebuendelt` hat kein eigenes
// Fenster: die Nachricht ist sofort faellig und geht als „buendelbar“ in das Buendel, das schon
// durch DELIVERY_BUNDLE_SEC bestimmt ist, und wird dort mit ihrem Wortlaut getippt.
export interface Zustellart {
  fensterMs: number;
  deliveryClass: "sofort" | "buendelbar";
  gebuendelt: boolean;
}
export function postfachZustellart(wert: Zustellung, direktFensterMs: number): Zustellart {
  return wert === "gebuendelt"
    ? { fensterMs: 0, deliveryClass: "buendelbar", gebuendelt: true }
    : { fensterMs: Math.max(0, direktFensterMs), deliveryClass: "sofort", gebuendelt: false };
}

// Der Satz im Teil „arbeitet“ der Fassung. Wert UND Quelle stehen im Text, damit beide im Hash
// landen: „gebuendelt“ als Standard einer Lane ist ein anderer Setup-Satz als „gebuendelt“ vom
// Owner gesetzt, auch wenn die Zustellung dieselbe ist.
export function zustellungSatz(z: ZustellungFuerSlot): string {
  const quelle = z.quelle === "gesetzt" ? "vom Owner gesetzt"
    : z.wert === "gebuendelt" ? "Standard für eine Lane" : "Standard für diese Session";
  const wirkung = z.wert === "gebuendelt"
    ? "Postfach-Nachrichten warten im Buendel und kommen dort mit ihrem Wortlaut an"
    : "Postfach-Nachrichten kommen nach etwa einer Minute mit ihrem Wortlaut an";
  return `ZUSTELLUNG (${quelle}): ${z.wert} — ${wirkung}.`;
}

export function zustellungAbschnitt(raw: unknown, hatWorktree: boolean): FassungAbschnittEingang {
  const z = zustellungFuerSlot(raw, hatWorktree);
  return { id: "zustellung",
    quelle: z.quelle === "gesetzt" ? "Slot.zustellung (server/zustellung.ts)" : "Slot.zustellung (nicht gesetzt)",
    aenderbar: true, text: zustellungSatz(z) };
}
