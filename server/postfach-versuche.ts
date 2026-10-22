// WAS EIN POSTFACH-VERSUCH IST UND WIE ER EINEN NEUSTART ÜBERLEBT (Auftrag „Eine getippte
// Postfach-Nachricht kommt nach einem Neustart nicht noch einmal“, branch/postfach-neustart).
//
// server.ts hält die Merkliste `postfachAttempted` im Speicher; dieser Leaf daneben ist die
// dauerhafte Form derselben Tatsache. Eine Zeile sagt: Für Slot X in Session Y wurden die
// Nachrichten-Ids Z getippt (oder könnten getippt worden sein). Nur der TAKT weiß, wann das gilt;
// hier steht ausschließlich, wie eine Zeile aussieht, wie sie wieder zu einer Map wird und wie
// beides begrenzt bleibt.
//
// Der Schlüssel ist die Besetzung (Slot + Session), nicht der Slot allein: eine neue Besetzung
// erbt keine Versuche der alten. Beim Laden werden deshalb nur Zeilen übernommen, deren Session
// noch auf dem Slot sitzt; eine weggefallene Besetzung kostet keine Erinnerung an fremde Worte.
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
}

export interface PostfachVersuchMapRow { session: string; ids: Set<string> }
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
    && typeof row.at === "number" && Number.isFinite(row.at);
};

const trim = (ids: Set<string>, maxIds: number): void => {
  for (const id of ids) {
    if (ids.size <= Math.max(1, maxIds)) return;
    ids.delete(id);
  }
};

// Eine Zeile für das Ledger; `null`, wenn der Aufrufer nichts Merkbares hat (keine Ids).
export function postfachVersuchRow(slot: number, openedAt: number, session: string,
  ids: readonly string[], at: number): PostfachVersuchRow | null {
  const unique = [...new Set(ids.filter(isId))];
  if (!Number.isInteger(slot) || slot <= 0 || !Number.isInteger(openedAt) || openedAt < 0
    || !session || !unique.length) return null;
  return { slot, openedAt, session, ids: unique, at };
}

export function rememberPostfachVersuch(map: PostfachVersuchMap, row: PostfachVersuchRow,
  maxIds: number = POSTFACH_VERSUCH_MAX_IDS): void {
  const previous = map.get(row.slot);
  const ids = previous && previous.session === row.session ? previous.ids : new Set<string>();
  for (const id of row.ids) ids.add(id);
  trim(ids, maxIds);
  if (ids.size) map.set(row.slot, { session: row.session, ids });
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
    if (!besetzung || besetzung.openedAt !== value.openedAt
      || besetzung.session !== value.session) continue;
    const ids = value.ids.filter((id) => besetzung.relevant?.(id) !== false);
    if (!ids.length) continue;
    rememberPostfachVersuch(map, { ...value, ids }, maxIds);
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
  trim(row.ids, maxIds);
  if (!row.ids.size) map.delete(slot);
}
