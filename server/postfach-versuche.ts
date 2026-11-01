// WAS EIN POSTFACH-VERSUCH IST UND WIE ER EINEN NEUSTART ÜBERLEBT (Auftrag „Eine getippte
// Postfach-Nachricht kommt nach einem Neustart nicht noch einmal“, branch/postfach-neustart).
//
// server.ts hält die Merkliste `postfachAttempted` im Speicher; dieser Leaf daneben ist die
// dauerhafte Form derselben Tatsache. Eine Zeile sagt: Für Slot X in Session Y wurden die
// Nachrichten-Ids Z getippt (oder könnten getippt worden sein). Nur der TAKT weiß, wann das gilt;
// hier steht ausschließlich, wie eine Zeile aussieht, wie sie wieder zu einer Map wird und wie
// beides begrenzt bleibt.
//
// Der Schlüssel ist die Besetzung (Slot + openedAt + Session), nicht der Slot allein: eine neue
// Besetzung erbt keine Versuche der alten. Was der alten getippt wurde, ist aber auch für die neue
// nicht mehr offen (W3 Auftrag 16, Punkt 4): eine Nachfolgerin bekam sonst jede ungelesene Nachricht,
// die schon in der Pane ihrer Vorgängerin stand, ein zweites Mal (Slot 1 am 01.11.: sechs alte
// Aufträge, direkt hinter dem Nachfolge-Brief). Endet eine Besetzung, nennt dieses Blatt ihre
// getippten Ids (beendeteVersuche, vergangeneVersuche), und der Takt schreibt sie als von ihr gelesen.
//
// Reines Blatt ohne Importe wie server/postfach-zustellen.ts und server/postfach-fehler.ts: der
// Takt-Abschnitt wird in server/postfach-neustart.test.ts und e2e/role-address.ts unverändert
// mitkompiliert.

export interface PostfachVersuchRow {
  slot: number;
  // Das openedAt der Besetzung. Dieselbe Session kann einen Slot neu besetzen (respawnInPlace);
  // dann ist es trotzdem eine neue Besetzung und darf keine alten Versuche erben.
  openedAt: number;
  // backlogSessionKey der Besetzung: die Claude-Session-ID, sonst `unbound:<selfToken>`
  session: string;
  ids: string[];
  at: number;
  // DER PASTE STAND IN DER PANE (W3 Auftrag 17, W16-4): sendText kam ohne Wurf zurück, der Text wurde getippt und
  // abgeschickt, nur seine Annahme war vielleicht nicht zu sehen. Fehlt das Feld, ist die Zeile ein „vielleicht“: ein Wurf,
  // ein zurückgerollter Paste („cleared“), ein geparkter Resend, der scheiterte, oder eine Zeile von vor diesem Feld. Ein
  // Vielleicht hält nur DIESELBE Besetzung vom zweiten Tippen ab; ihre Nachfolgerin bekommt die Nachricht.
  stand?: true;
}

// `ids`: alles, was dieser Besetzung nicht noch einmal angeboten wird; `stand`: die Teilmenge, deren Paste in der Pane stand
export interface PostfachVersuchMapRow { openedAt: number; session: string; ids: Set<string>; stand: Set<string> }

// Die Besetzung, die geendet hat, und was in ihre Pane getippt wurde: das Tripel ist die Quittung, die
// der Takt an jede noch ungelesene dieser Nachrichten schreibt.
export interface BeendeterVersuch { slot: number; openedAt: number; sessionId: string | null; ids: string[] }
// backlogSessionKey ist die Claude-Session-ID oder `unbound:<selfToken>`; das Token gehört nie in eine Quittung
export const sessionIdOfKey = (session: string): string | null => session.startsWith("unbound:") ? null : session;
// nur was in der Pane stand, gilt als von der beendeten Besetzung gelesen
const beendet = (slot: number, row: PostfachVersuchMapRow): BeendeterVersuch =>
  ({ slot, openedAt: row.openedAt, sessionId: sessionIdOfKey(row.session), ids: [...row.stand] });
export type PostfachVersuchMap = Map<number, PostfachVersuchMapRow>;

// Obergrenze je Slot/Besetzung. Sie ist kein Nachrichtenlimit, sondern der Deckel gegen eine Map,
// die über Monate mit jeder Zustellung weiter wüchse. 500 ist weit über jedem Rückstand, den ein
// Postfach in einer Sitzung sinnvoll offen halten kann; die ältesten Ids fallen zuerst.
export const POSTFACH_VERSUCH_MAX_IDS = 500;

const isId = (value: unknown): value is string => typeof value === "string" && value.length > 0;

const validRow = (value: unknown): value is PostfachVersuchRow => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Partial<PostfachVersuchRow>;
  return Number.isInteger(row.slot) && (row.slot as number) > 0
    && Number.isInteger(row.openedAt) && (row.openedAt as number) >= 0
    && typeof row.session === "string" && row.session.length > 0
    && Array.isArray(row.ids) && row.ids.length > 0 && row.ids.every(isId)
    && typeof row.at === "number" && Number.isFinite(row.at)
    && (row.stand === undefined || row.stand === true);
};

const trim = (ids: Set<string>, maxIds: number, stand?: Set<string>): void => {
  for (const id of ids) {
    if (ids.size <= Math.max(1, maxIds)) break;
    ids.delete(id);
  }
  if (stand) for (const id of stand) if (!ids.has(id)) stand.delete(id);
};

// Eine Zeile für das Ledger; `null`, wenn der Aufrufer nichts Merkbares hat (keine Ids).
export function postfachVersuchRow(slot: number, openedAt: number, session: string,
  ids: readonly string[], at: number, stand = false): PostfachVersuchRow | null {
  const unique = [...new Set(ids.filter(isId))];
  if (!Number.isInteger(slot) || slot <= 0 || !Number.isInteger(openedAt) || openedAt < 0
    || !session || !unique.length) return null;
  return { slot, openedAt, session, ids: unique, at, ...(stand ? { stand: true as const } : {}) };
}

// Gibt die Zeile einer anderen, damit beendeten Besetzung zurück, die sie verdrängt hat.
export function rememberPostfachVersuch(map: PostfachVersuchMap, row: PostfachVersuchRow,
  maxIds: number = POSTFACH_VERSUCH_MAX_IDS): BeendeterVersuch | null {
  const previous = map.get(row.slot);
  const same = !!previous && previous.session === row.session && previous.openedAt === row.openedAt;
  const ids = same ? previous!.ids : new Set<string>();
  const stand = same ? previous!.stand : new Set<string>();
  for (const id of row.ids) { ids.add(id); if (row.stand) stand.add(id); }
  trim(ids, maxIds, stand);
  if (ids.size) map.set(row.slot, { openedAt: row.openedAt, session: row.session, ids, stand });
  return previous && !same ? beendet(row.slot, previous) : null;
}

// DIE BESETZUNG GEHT JETZT (W3 Auftrag 21, Queue 672d48ec): eine Nachfolge baut sie ab (server.ts#teardownSlotOccupant, #openSlot), bevor
// der Takt sie als beendet sieht. Ihre Zeile verlässt die Map hier und kommt als BeendeterVersuch zurück, statt verworfen zu werden.
export function verlasseVersuch(map: PostfachVersuchMap, slot: number): BeendeterVersuch | null {
  const row = map.get(slot);
  if (!row) return null;
  map.delete(slot);
  return beendet(slot, row);
}

// Der laufende Takt: jede Zeile, deren Slot leer ist oder heute anders besetzt, hat ihre Besetzung
// verloren. Sie verlässt die Map und kommt als BeendeterVersuch zurück.
export function beendeteVersuche(map: PostfachVersuchMap,
  besetzung: (slot: number) => { openedAt: number; session: string } | null): BeendeterVersuch[] {
  const out: BeendeterVersuch[] = [];
  for (const [slot, row] of [...map]) {
    const now = besetzung(slot);
    if (now && now.openedAt === row.openedAt && now.session === row.session) continue;
    out.push(beendet(slot, row));
    // DIESELBE PANE HAT NUR IHRE SESSION-ID GELERNT (S5 der Prüfung zu Auftrag 16): sie ist nicht beendet. Was stand, gilt wie bisher als
    // ihr gelesen; ein Vielleicht bleibt unter dem neuen Schlüssel gemerkt, sonst tippte der Takt es derselben Pane noch einmal.
    const gelernt = !!now && now.openedAt === row.openedAt && row.session.startsWith("unbound:") && !now.session.startsWith("unbound:");
    const vielleicht = [...row.ids].filter((id) => !row.stand.has(id));
    if (gelernt && vielleicht.length) map.set(slot, { openedAt: row.openedAt, session: now!.session, ids: new Set(vielleicht), stand: new Set() });
    else map.delete(slot);
  }
  return out;
}

// Der Neustart: Ledger-Zeilen einer Besetzung, die heute nicht mehr auf ihrem Slot sitzt, je Besetzung
// zusammengefasst. `besetzungen` nennt nur die lebenden.
export function vergangeneVersuche(rows: readonly unknown[],
  besetzungen: readonly PostfachBesetzung[]): BeendeterVersuch[] {
  const current = new Map(besetzungen.map((b) => [b.slot, b]));
  const out = new Map<string, BeendeterVersuch>();
  for (const value of rows) {
    if (!validRow(value)) continue;
    const b = current.get(value.slot);
    if (!value.stand || b && b.openedAt === value.openedAt && b.session === value.session) continue;
    const key = JSON.stringify([value.slot, value.openedAt, value.session]);
    const row = out.get(key) ?? { slot: value.slot, openedAt: value.openedAt, sessionId: sessionIdOfKey(value.session), ids: [] };
    for (const id of value.ids) if (!row.ids.includes(id)) row.ids.push(id);
    out.set(key, row);
  }
  return [...out.values()];
}

export interface PostfachBesetzung {
  slot: number;
  openedAt: number;
  session: string;
  // Ist diese Nachricht für die heutige Besetzung noch offen? Gelesene und verschwundene Ids
  // werden beim Laden vergessen, damit das Ledger nicht die Erinnerung an erledigte Aufträge
  // zurückbringt.
  relevant?: (id: string) => boolean;
}

// Der Neustart: Ledger-Zeilen (chronologisch, wie readLedger sie liefert) werden genau dann wieder
// zu Merkliste, wenn Slot, openedAt und Session noch dieselbe Besetzung bezeichnen.
export function restorePostfachVersuche(rows: readonly unknown[],
  besetzungen: readonly PostfachBesetzung[], maxIds: number = POSTFACH_VERSUCH_MAX_IDS): PostfachVersuchMap {
  const current = new Map(besetzungen.map((b) => [b.slot, b]));
  const map: PostfachVersuchMap = new Map();
  for (const value of rows) {
    if (!validRow(value)) continue;
    const besetzung = current.get(value.slot);
    if (!besetzung || besetzung.openedAt !== value.openedAt) continue;
    // dieselbe Pane, die ihre Session-Id erst danach lernte (S5): ein Vielleicht bleibt unter dem neuen Schlüssel gemerkt; was stand,
    // gibt vergangeneVersuche als gelesen weiter
    const gelernt = value.session.startsWith("unbound:") && !besetzung.session.startsWith("unbound:");
    if (besetzung.session !== value.session && !(gelernt && !value.stand)) continue;
    const ids = value.ids.filter((id) => besetzung.relevant?.(id) !== false);
    if (!ids.length) continue;
    rememberPostfachVersuch(map, { ...value, session: besetzung.session, ids }, maxIds);
  }
  return map;
}

// Der laufende Prozess räumt dieselbe Grenze nach: gelesene Nachrichten und eine neue Besetzung
// hinterlassen keine Zeile, und die Ids einer Zeile bleiben gedeckelt.
export function prunePostfachVersuch(map: PostfachVersuchMap, slot: number, session: string,
  keep: (id: string) => boolean, maxIds: number = POSTFACH_VERSUCH_MAX_IDS): void {
  const row = map.get(slot);
  if (!row) return;
  if (row.session !== session) { map.delete(slot); return; }
  for (const id of [...row.ids]) if (!keep(id)) row.ids.delete(id);
  trim(row.ids, maxIds, row.stand);
  if (!row.ids.size) map.delete(slot);
}
