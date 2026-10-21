// WAS EIN GESCHEITERTER POSTFACH-VERSUCH HINTERLÄSST — und wie oft er gesagt wird
// (Auftrag „Eine Postfach-Nachricht, von der nichts getippt wurde, wird wieder angeboten“,
// branch/postfach-befund1).
//
// sendTexts Wurf trägt die Unterscheidung schon: SendRefused heißt, die Ablehnung geschah VOR dem
// Tippen (keine Pane, blockierter Bildschirm, Harness-Politik, belegter Composer, beschäftigte
// Pane) — die Nachricht wurde nie getippt und muss im Postfach offen bleiben. SendNotAccepted und
// ein untypisierter Transportfehler können Text in der Pane hinterlassen; die bleiben gemerkt,
// damit derselbe Wortlaut nicht ein zweites Mal landet. SendComposerOccupied parkt weiterhin über
// parkFleetSend und erreicht diese Entscheidung nicht, solange ein Parkplatz frei ist; ist die
// Parkgrenze voll, zählt der belegte Composer wie jeder andere SendRefused.
//
// Die zweite Hälfte ist die Bremse für das PROMPT-LEDGER: ein Slot, der stundenlang nicht bereit
// ist, würde sonst bei jedem Takt (in Produktion alle 10 s) dieselbe Zeile schreiben. Dieselbe
// Zustellung (Empfänger, Weg, Fehlerwort, Grund und Nachrichten-Ids) wird deshalb einmal gesagt;
// erst nach einer Ruhezeit oder bei einer anderen Zeile steht sie wieder da. server.log braucht
// diese Bremse nicht: server/errors.ts#logError zählt Wiederholungen je Signatur und druckt nur die
// erste Sichtung — deshalb ruft der Takt logError weiter bei jedem Versuch.
//
// Die dritte Hälfte hält den VERSUCH selbst auf: nach einem Wurf, der nichts getippt hat, wird
// dieselbe Nachricht für diesen Slot erst nach einer Wartezeit wieder angeboten
// (PostfachVersuche). Sonst liest der Takt bei jedem Lauf die Pane, schreibt eine Audit-Zeile und
// wiederholt denselben vergeblichen sendText — auch wenn das Ledger längst schweigt.
//
// Reines Blatt ohne Importe wie server/postfach-zustellen.ts: der Takt-Abschnitt wird in
// server/postfach-fehler.test.ts und e2e/role-address.ts unverändert mitkompiliert.

export type PostfachWeg = "direkt" | "gebuendelt";
export type PostfachFehlerwort = "SendRefused" | "SendNotAccepted" | "send-failed";

// Zehn Minuten: lang genug, dass ein dauerhaft unbereiter Slot nicht jeden Takt schreibt, kurz
// genug, dass ein Betreiber den Zustand auch ohne Zustandswechsel im Log wiederfindet.
export const POSTFACH_FEHLER_RUHE_MS = 10 * 60_000;

// Nur ein Wurf, der „nichts getippt“ nennt, darf erneut angeboten werden. Alles andere könnte
// getippt haben und bleibt gemerkt.
export const postfachNichtsGetippt = (wort: PostfachFehlerwort): boolean => wort === "SendRefused";

// Die eine Zeile, die ein Leser sieht: der Grund des Wurfs, gekürzt wie die übrigen Ledger-Gründe.
export const postfachFehlerGrund = (e: unknown): string =>
  (e instanceof Error ? e.message : String(e)).slice(0, 300);

// DERSELBE GRUND FÜR DIE BREMSE, ohne veränderliche Zahlen. `composer occupied (42 chars)` und
// `(99 chars)` sind derselbe Zustand: der Entwurf wuchs, die Zeile ist nicht neu. Der Leser sieht
// die genaue Zahl weiter über postfachFehlerGrund.
export const postfachFehlerVergleich = (e: unknown): string =>
  postfachFehlerGrund(e).replace(/\(\d+ chars\)/g, "(N chars)");

export interface PostfachFehlerzeile {
  weg: PostfachWeg;
  wort: PostfachFehlerwort;
  grund: string;
}

// Die Identität „derselbe Versuch“: Empfänger-Session, Weg, Fehlerwort, Grund und die Ids, die in
// dieser Zustellung standen. Kommt eine Nachricht dazu, ist es eine andere Zeile und wird gesagt.
export const postfachFehlerSignatur = (session: string, ids: readonly string[],
  zeile: PostfachFehlerzeile): string =>
  `${session}|${zeile.weg}|${zeile.wort}|${zeile.grund}|${ids.join(",")}`;

// Die Bremse je Slot für die Ledger-Zeile; die Signatur trägt die Session, ein neuer Besatzer fällt
// also nicht unter die Ruhezeit des Vorgängers. Der Zustand ist auf die Slot-Zahl begrenzt und
// braucht kein Teardown.
export class PostfachFehlerbremse {
  private readonly letzte = new Map<number, { signatur: string; at: number }>();

  constructor(private readonly ruheMs: number = POSTFACH_FEHLER_RUHE_MS,
    private readonly jetzt: () => number = Date.now) {}

  // true = diese Zeile jetzt schreiben; false = dieselbe Zeile stand vor weniger als ruheMs da.
  faellig(slot: number, signatur: string): boolean {
    const at = this.jetzt();
    const letzte = this.letzte.get(slot);
    if (letzte && letzte.signatur === signatur && at - letzte.at < this.ruheMs) return false;
    this.letzte.set(slot, { signatur, at });
    return true;
  }

  // Eine geglückte Zustellung beendet die Ruhezeit: ein späterer Fehler ist wieder eine neue Zeile.
  vergessen(slot: number): void { this.letzte.delete(slot); }
}

// DIE WARTEZEIT NACH EINEM VERSUCH, DER NICHTS GETIPPT HAT. Der Takt ist kurz (10 s in Produktion),
// die Pane ändert sich in dieser Zeit nicht: derselbe Versuch wird nicht bei jedem Lauf wiederholt.
// Zwei Takte Grund, Verdopplung bis zwölf — dasselbe Muster wie holdBackoffMs für parkedSends in
// server.ts, nur mit der Taktlänge des Postfachs. Die Signatur trägt Session und Nachrichten-Ids:
// ein neuer Besatzer oder eine zusätzliche Nachricht ist ein anderer Versuch und darf sofort.
export const postfachVersuchSignatur = (session: string, ids: readonly string[]): string =>
  `${session}|${ids.join(",")}`;

export const postfachVersuchWarteMs = (taktMs: number, versuche: number): number => {
  const takt = Math.max(250, taktMs);
  return Math.min(takt * 2 * 2 ** Math.max(0, versuche - 1), takt * 12);
};

// Der Zustand ist auf die Slot-Zahl begrenzt und braucht kein Teardown: die Signatur nennt die
// Session, ein neuer Besatzer fällt also nicht unter die Wartezeit des Vorgängers.
export class PostfachVersuche {
  private readonly rows = new Map<number, { signatur: string; versuche: number; nextAt: number }>();

  constructor(private readonly taktMs: number, private readonly jetzt: () => number = Date.now) {}

  // true = dieser Versuch darf jetzt laufen (neue Nachricht, neuer Besatzer oder Wartezeit vorbei).
  faellig(slot: number, signatur: string): boolean {
    const row = this.rows.get(slot);
    return !row || row.signatur !== signatur || this.jetzt() >= row.nextAt;
  }

  // Nach einem Wurf, der nichts getippt hat: die Wartezeit für genau diesen Versuch beginnt.
  warten(slot: number, signatur: string): number {
    const prev = this.rows.get(slot);
    const versuche = prev && prev.signatur === signatur ? prev.versuche + 1 : 1;
    const warteMs = postfachVersuchWarteMs(this.taktMs, versuche);
    this.rows.set(slot, { signatur, versuche, nextAt: this.jetzt() + warteMs });
    return warteMs;
  }

  // Eine geglückte Zustellung oder eine gemerkte Nachricht beendet die Wartezeit.
  vergessen(slot: number): void { this.rows.delete(slot); }
}
