// DER VERTRAG DES POSTFACHS (Paket W1, „Nachrichten folgen Kanten“). Wer wem schreiben darf, steht EINMAL: als Vorlage mit
// Regeln (postfach-vorlage-streng.json), die das Postfach beim Senden fragt (server.ts#sendMessageFor) und aus der dieselbe
// Fassung ihr „Arbeitet mit“ füllt (server.ts#postfachGegenseiten). Eine Regel hat eine Art; was die Art im Lauf prüft, liefern
// die Zeugen des Aufrufers — dieselben Zeugen für „darf ich?“ und für „wen darf ich?“, damit beide nicht auseinanderlaufen.
//
// Der Deckel einer Nachricht ist MAX_MESSAGE_TEXT (server/types.ts) und steht nur dort; die Vorlage wiederholt ihn nicht.
// Seit dem 30.10. gibt es keinen Zaun zwischen den Claude-Sitzen des Owners: das ist die Regel „[Zitat entfernt]“, und sie bleibt.
import streng from "./postfach-vorlage-streng.json";
import { OTHER_SESSION_LEAD } from "../src/agent-message";

export type RegelArt = "orchestrator" | "kante" | "claude-paar" | "branch-paar" | "ordner-paar";
export interface Regel { art: RegelArt; wer: string; text: string }
export interface Vorlage { name: string; satz: string; regeln: readonly Regel[] }

const ARTEN: readonly RegelArt[] = ["orchestrator", "kante", "claude-paar", "branch-paar", "ordner-paar"];

/** Die Vorlagen, die Fleet kennt. „streng“ sind die fünf Regeln, die das Postfach bis W1 fest im Code trug. */
export const VORLAGEN: Readonly<Record<string, Vorlage>> = { streng: lade(streng) };
export const VORLAGE_STANDARD = "streng";

function lade(roh: unknown): Vorlage {
  const r = roh as { name?: unknown; satz?: unknown; regeln?: unknown };
  if (typeof r?.name !== "string" || typeof r.satz !== "string" || !Array.isArray(r.regeln))
    throw new Error("postfach-vorlage: name, satz and regeln are required");
  const regeln = r.regeln.map((x: unknown): Regel => {
    const g = x as Record<string, unknown>;
    if (!ARTEN.includes(g?.art as RegelArt) || typeof g.wer !== "string" || typeof g.text !== "string")
      throw new Error(`postfach-vorlage ${r.name}: a rule needs a known art, wer and text`);
    return { art: g.art as RegelArt, wer: g.wer, text: g.text };
  });
  return { name: r.name, satz: r.satz, regeln };
}

/** Was jede Art im Lauf prüft; der Aufrufer liefert es für EIN Paar (Sender, Ziel). Ein Zeuge fehlt = die Art gilt hier nicht. */
export type Zeugen = Partial<Record<RegelArt, () => boolean | Promise<boolean>>>;

/** Die erste Regel der Vorlage, die das Paar erlaubt — in der Reihenfolge der Vorlage —, sonst null. */
export async function erlaubtDurch(v: Vorlage, z: Zeugen): Promise<RegelArt | null> {
  for (const regel of v.regeln) {
    const zeuge = z[regel.art];
    if (zeuge && await zeuge()) return regel.art;
  }
  return null;
}

/** Die Regeln als ein Satz für die Tür, die ablehnt, und für die Fassung: so liest der Sitz, was ihm fehlt. */
export function regelnSatz(v: Vorlage): string {
  return `${v.satz}. Template ${v.name}: you may write ${regelnText(v)}.`;
}
/** Die Regeln der Vorlage als eine Aufzählung — die eine Stelle, an der ihr Wortlaut zusammengesetzt wird. */
const regelnText = (v: Vorlage): string => v.regeln.map((r) => r.text).join("; ");

export interface Gegenseite { slot: number | null; rolle: string | null; label: string | null; regel: RegelArt; beziehung: string }

/** „Arbeitet mit“: wen das Postfach diesem Sitz heute erlaubt, gefragt mit denselben Zeugen wie beim Senden. */
export async function gegenseiten<K>(v: Vorlage, kandidaten: readonly K[], zeugenFuer: (k: K) => Zeugen,
  beschreibe: (k: K, regel: RegelArt) => Omit<Gegenseite, "regel">): Promise<Gegenseite[]> {
  const out: Gegenseite[] = [];
  for (const k of kandidaten) {
    const regel = await erlaubtDurch(v, zeugenFuer(k));
    if (regel) out.push({ ...beschreibe(k, regel), regel });
  }
  return out;
}

/** Die Zeilen unter „Arbeitet mit“: die erlaubten Gegenseiten mit Slot und Grund, danach die Regeln der Vorlage.
 *  `paare` null = vor dem Start: es gibt noch keinen Platz, also keine Paare, aber schon die Regeln. */
export function gegenseitenZeilen(v: Vorlage, paare: readonly Gegenseite[] | null): string[] {
  const regeln = `The rules the mailbox checks: ${regelnText(v)}.`;
  if (paare === null) return [`Mailbox, template ${v.name}: the seats you may write appear here once the seat runs. ${regeln}`];
  const wen = paare.map((g) => `- ${g.slot === null ? g.rolle : `slot ${g.slot}${g.label ? ` (${g.label})` : ""}`}: ${g.beziehung}`);
  return [`Mailbox, template ${v.name}: you may write ${paare.length ? "these seats now" : "no seat now"}${paare.length ? ":" : "."}`, ...wen, regeln];
}

/** EINE NACHRICHT EINER ANDEREN SESSION ist nie die Eingabe des Owners (Mangel 80): Claude Code reicht sie als `<cross-session-message from-name="…">`
 *  (ruhend hinter einem der drei Vorsätze aus src/agent-message.ts#OTHER_SESSION_LEAD, mitten im Zug als eingereihter Befehl) oder als `<agent-message …>`.
 *  Die Hülle trägt Attribute, darum reichte „ein Tag ohne Attribute“ nicht. Rein. */
const FREMDE_HUELLE = new RegExp(`^(?:${OTHER_SESSION_LEAD})?<(?:cross-session-message|agent-message)(?:\\s[^>]*)?>`);
export const istFremdeSessionHuelle = (text: string): boolean => FREMDE_HUELLE.test(text.trimStart());

/** DER RING KÜRZT in dieser Reihenfolge: zuerst Post an einen Empfänger, den es nicht mehr gibt, dann Gelesenes, zuletzt die älteste ungelesene Zeile.
 *  Nur der letzte Fall kann einem lebenden Sitz Post gekostet haben; er allein zählt in `droppedUnread`. `behalte` (die neue Zeile) geht nie zuerst. Rein. */
export function ringKuerzen<E extends { readBy: unknown }>(entries: readonly E[], max: number, empfaengerWeg: (e: E) => boolean, behalte?: E):
  { entries: E[]; dropped: number; droppedUnread: number } {
  let rest = [...entries];
  let dropped = 0, droppedUnread = 0;
  while (rest.length > max) {
    let idx = rest.findIndex((e) => e !== behalte && e.readBy === null && empfaengerWeg(e));
    if (idx < 0) idx = rest.findIndex((e) => e.readBy !== null);
    if (idx < 0) { idx = 0; droppedUnread++; }
    rest = rest.filter((_, i) => i !== idx);
    dropped++;
  }
  return { entries: rest, dropped, droppedUnread };
}

/** DER RING AUF DER PLATTE behält genau die Form {v, entries, dropped}, die jeder ältere Server liest. main 491bcd016 lehnt jeden
 *  weiteren Schlüssel im Record ab („must contain exactly v, entries, dropped“), bootet dann mit leerem Postfach und überschreibt beim
 *  nächsten Speichern das alte: ein Rückweg kostete sonst die ganze Post. Der Zähler der verdrängten ungelesenen Post steht darum NEBEN
 *  dem Ring, als eigener Schlüssel des Zustands, den ein älterer Server übergeht (er liest jeden Schlüssel einzeln) und nicht mitspeichert.
 *  Grenze: kommt dieser Stand nach einem Rückweg wieder, beginnt der Zähler bei 0; was der ältere Server dazwischen verdrängt hat, steht
 *  nur im Satz zur unvollständigen Geschichte (`dropped`), nicht im Zähler. */
export const MESSAGES_DROPPED_UNREAD_KEY = "messagesDroppedUnread";
export interface Ring<E> { v: 1; entries: E[]; dropped: number }

/** Eine Zeile anhängen und kürzen: der neue Ring in der alten Form und der neue Zähler daneben. Rein; server.ts#appendMessage ist der eine Schreiber. */
export function ringAnhaengen<E extends { readBy: unknown }>(ring: Ring<E>, droppedUnread: number, neu: E, max: number,
  empfaengerWeg: (e: E) => boolean): { ring: Ring<E>; droppedUnread: number } {
  const cut = ringKuerzen([...ring.entries, neu], max, empfaengerWeg, neu);
  return { ring: { v: 1, entries: cut.entries, dropped: ring.dropped + cut.dropped }, droppedUnread: droppedUnread + cut.droppedUnread };
}

/** Was der Zustand auf die Platte schreibt: der Ring unverändert, der Zähler nur, wenn er nicht 0 ist (ein Zustand ohne Verlust trägt keinen neuen Schlüssel). */
export function ringFuerPlatte<E>(ring: Ring<E>, droppedUnread: number): { messages: Ring<E>; messagesDroppedUnread?: number } {
  return { messages: ring, ...(droppedUnread ? { messagesDroppedUnread: droppedUnread } : {}) };
}

/** Den Zähler beim Boot lesen. Fehlt er, ist er 0. Ist er unlesbar oder größer als `dropped`, gilt der schlechteste Fall: jede verdrängte
 *  Zeile kann ungelesen gewesen sein — so sagt die Ansicht „unbekannt“, statt einen kaputten Zähler als Gesundheit zu zeigen. */
export function droppedUnreadVonPlatte(roh: unknown, dropped: number): { wert: number; fehler: string | null } {
  if (roh === undefined) return { wert: 0, fehler: null };
  if (typeof roh === "number" && Number.isInteger(roh) && roh >= 0 && roh <= dropped) return { wert: roh, fehler: null };
  return { wert: dropped, fehler: `${MESSAGES_DROPPED_UNREAD_KEY} must be an integer from 0 to dropped (${dropped}); every dropped row counts as possibly unread` };
}

/** DIE GESCHICHTE IST UNVOLLSTÄNDIG, sobald überhaupt eine Zeile den Ring verlassen hat — auch wenn es nur gelesene oder tote waren: wer
 *  die Liste liest, sieht dann nicht mehr jede Nachricht. Das ist ein anderer Satz als „unbekannt“ beim Zähler der ungelesenen Post, der nur
 *  von `droppedUnread` abhängt; darum steht er in einem eigenen Feld (`history`), und die Zahl der ungelesenen bleibt eine echte Zahl. */
export function geschichteLuecke(dropped: number, droppedUnread: number, max: number): string[] {
  if (dropped <= 0) return [];
  const rest = dropped - droppedUnread;
  return [`${dropped} messages have fallen off the fleet-wide cap of ${max} since this record began, so this list is not the whole history`
    + (droppedUnread ? `; ${droppedUnread} of them left unread while their receiver still lived.` : `; ${rest === 1 ? "it was" : "all were"} read or addressed to a receiver that no longer exists, so no unread mail is missing.`)];
}
