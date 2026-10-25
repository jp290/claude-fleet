// KANTEN: ZWEI SESSIONS SCHREIBEN SICH DIREKT, AUF ZEIT, MIT FREIGABE DER ORCHESTRATORIN (branch/kanten, Owner 25.10. über
// Slot 16: „[Zitat entfernt]“). Eine Kante ist ein Paar von Sitzen — Slot und
// Ordner, so bleibt eine Nachfolge an ihrem Ende, und ein Slot, der in einen anderen Ordner wechselt, fällt heraus — mit Grund und
// Ende. Sie gibt nur das Schreiben im Postfach frei, in beide Richtungen, und sonst nichts. Geprüft wird beim Senden
// (server.ts#sendMessageFor), also gilt sie sofort in den laufenden Sessions und erlischt von selbst.
// Rein: kein Holder, keine Route, keine Uhr außer der übergebenen.

export interface KantenEnde { slot: number; cwd: string }
export interface Kante {
  id: string;
  a: KantenEnde; b: KantenEnde;
  why: string;
  at: number; until: number;
  // die Orchestratorin hat sie vor ihrem Ende geschlossen
  endedAt: number | null;
  // die Nachrichten, die nur diese Kante durchließ (ids im Postfach) — was die Orchestratorin mitliest
  messages: string[];
}

export const KANTE_MINUTEN_STANDARD = 60;
export const KANTE_MINUTEN_MAX = 24 * 60;
export const KANTE_GRUND_MAX = 500;
const KANTE_NACHRICHTEN_MAX = 200;
// eine beendete Kante bleibt einen Tag im Buch: die Abweisung nennt ihr Ende, die Orchestratorin liest nach
const KANTE_NACHHALL_MS = 24 * 60 * 60 * 1000;

const gleich = (x: KantenEnde, y: KantenEnde): boolean => x.slot === y.slot && x.cwd === y.cwd;
const verbindet = (k: Kante, x: KantenEnde, y: KantenEnde): boolean =>
  (gleich(k.a, x) && gleich(k.b, y)) || (gleich(k.a, y) && gleich(k.b, x));
export const kanteEnde = (k: Kante): number => k.endedAt ?? k.until;
export const kanteLebt = (k: Kante, now: number): boolean => kanteEnde(k) > now;
export const kanteBeruehrt = (k: Kante, x: KantenEnde): boolean => gleich(k.a, x) || gleich(k.b, x);
export const andererSlot = (k: Kante, x: KantenEnde): number => (gleich(k.a, x) ? k.b : k.a).slot;

export function lebendeKante(book: readonly Kante[], x: KantenEnde, y: KantenEnde, now: number): Kante | null {
  return book.find((k) => verbindet(k, x, y) && kanteLebt(k, now)) ?? null;
}
// die zuletzt beendete Kante dieses Paars — damit die Abweisung sagt, seit wann
export function beendeteKante(book: readonly Kante[], x: KantenEnde, y: KantenEnde, now: number): Kante | null {
  return book.filter((k) => verbindet(k, x, y) && !kanteLebt(k, now))
    .sort((p, q) => kanteEnde(q) - kanteEnde(p))[0] ?? null;
}

export type KantenWunsch = { ok: true; slots: [number, number]; why: string; minutes: number } | { ok: false; error: string };
// der Body der Tür: { between: [slot, slot], why, minutes? } — sonst nichts
export function kantenWunsch(body: unknown): KantenWunsch {
  const r = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  if (!r) return { ok: false, error: "body must be an object { between: [slot, slot], why, minutes? }" };
  const extra = Object.keys(r).filter((k) => !["between", "why", "minutes"].includes(k));
  if (extra.length) return { ok: false, error: `body reads only between, why, minutes — [${extra.join(", ")}] is not read: an edge frees writing and nothing else` };
  const between = r.between;
  if (!Array.isArray(between) || between.length !== 2 || !between.every((x) => Number.isInteger(x) && (x as number) > 0))
    return { ok: false, error: "between must be two slot numbers" };
  const [x, y] = between as [number, number];
  if (x === y) return { ok: false, error: "between names one slot twice — an edge joins two sessions" };
  if (typeof r.why !== "string" || !r.why.trim() || r.why.length > KANTE_GRUND_MAX)
    return { ok: false, error: `why must be the reason in at most ${KANTE_GRUND_MAX} chars` };
  const minutes = r.minutes === undefined ? KANTE_MINUTEN_STANDARD : r.minutes;
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0 || minutes > KANTE_MINUTEN_MAX)
    return { ok: false, error: `minutes must be more than 0 and at most ${KANTE_MINUTEN_MAX}; without it an edge holds ${KANTE_MINUTEN_STANDARD}` };
  return { ok: true, slots: [x, y], why: r.why.trim(), minutes };
}

// Freigeben: eine lebende Kante desselben Paars wird ersetzt (neuer Grund, neues Ende), nie verdoppelt.
export function kanteGeben(book: readonly Kante[], a: KantenEnde, b: KantenEnde, why: string, minutes: number,
  now: number, id: string): { book: Kante[]; kante: Kante } {
  const kante: Kante = { id, a, b, why, at: now, until: now + Math.round(minutes * 60_000), endedAt: null, messages: [] };
  const rest = book.map((k) => verbindet(k, a, b) && kanteLebt(k, now) ? { ...k, endedAt: now } : k);
  return { book: [...rest, kante], kante };
}
export function kanteSchliessen(book: readonly Kante[], id: string, now: number): { book: Kante[]; kante: Kante | null } {
  const k = book.find((x) => x.id === id && kanteLebt(x, now));
  if (!k) return { book: [...book], kante: null };
  const done = { ...k, endedAt: now };
  return { book: book.map((x) => x === k ? done : x), kante: done };
}
export function kanteMerkt(book: readonly Kante[], id: string, messageId: string): Kante[] {
  return book.map((k) => k.id !== id ? k : { ...k, messages: [...k.messages, messageId].slice(-KANTE_NACHRICHTEN_MAX) });
}
export const kantenGestutzt = (book: readonly Kante[], now: number): Kante[] =>
  book.filter((k) => kanteEnde(k) > now - KANTE_NACHHALL_MS);

const ende = (raw: unknown): KantenEnde | null => {
  const r = raw && typeof raw === "object" ? raw as Record<string, unknown> : null;
  return r && Number.isInteger(r.slot) && typeof r.cwd === "string" && r.cwd ? { slot: r.slot as number, cwd: r.cwd } : null;
};
// aus fleet.json: nur ganze Datensätze
export function kantenGeladen(raw: unknown, now: number): Kante[] {
  if (!Array.isArray(raw)) return [];
  const out: Kante[] = [];
  for (const v of raw) {
    const r = v && typeof v === "object" ? v as Record<string, unknown> : null;
    const a = ende(r?.a), b = ende(r?.b);
    if (!r || !a || !b || typeof r.id !== "string" || typeof r.why !== "string" || typeof r.at !== "number"
      || typeof r.until !== "number" || (r.endedAt !== null && typeof r.endedAt !== "number")) continue;
    const messages = Array.isArray(r.messages) ? r.messages.filter((m): m is string => typeof m === "string") : [];
    out.push({ id: r.id, a, b, why: r.why, at: r.at, until: r.until, endedAt: r.endedAt as number | null, messages });
  }
  return kantenGestutzt(out, now);
}

// „15:30“ in der Zeit des Rechners, auf dem Fleet läuft — die Uhr, die der Owner und die Sitze sehen
export const uhrzeit = (ms: number): string =>
  new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

// DIE SÄTZE AN DIE SESSIONS: einer, wenn die Kante gilt, einer, wenn sie geschlossen wird, einer, wenn sie abweist
export const kanteGilt = (k: Kante, du: KantenEnde): string => {
  const other = andererSlot(k, du);
  return `Du kannst Slot ${other} bis ${uhrzeit(k.until)} direkt schreiben (POST /api/self/messages, to {"kind":"session","slot":${other}}); `
    + `die Orchestratorin liest mit. Grund: ${k.why}`;
};
export const kanteGeschlossen = (k: Kante, du: KantenEnde): string =>
  `Deine Kante zu Slot ${andererSlot(k, du)} ist seit ${uhrzeit(kanteEnde(k))} geschlossen; schreib wieder über die Orchestratorin.`;
export const kanteAbgelaufen = (k: Kante, du: KantenEnde): string =>
  `your edge to slot ${andererSlot(k, du)} ended at ${uhrzeit(kanteEnde(k))} — ask the Orchestrator for a new one`;
