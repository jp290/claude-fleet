// WER EINE SESSION GEÖFFNET HAT (Slot.openedBy, Neuaufbau Konstellation Stück 2): die Session, deren Self-Token neben dem
// Owner-Bearer an der Öffnungs-Tür stand (server/auth.ts#resolvePrincipal). Rein: kein Holder, keine Route.
//
// DIE LINIE (Plan Dynamiken §6, Objekt 1): wer wen öffnete, hält Fleet als Linie, nicht als Platznummer. Jede Belegung bekommt beim
// Öffnen eine Linie (Slot.linie, openSlot), jede Nachfolge auf demselben Platz trägt sie weiter (respawnInPlace, restartLaneSession,
// die Übernahme einer Nachfolge-Schuld), und der Datensatz der Öffnerin nennt sie. Wer die Öffnerin ist, entscheidet dann die Linie:
// ihre Nachfolgerin ist es, eine fremde Session, die danach im selben Platz und Ordner öffnet, nicht. Ein Datensatz von vor der Linie
// (ohne `linie`) bekommt sie beim Laden, wenn die Öffnerin nachweislich in der Linie des heutigen Besetzers steht (linieFuerAltenOeffner);
// sonst gilt für ihn, was vorher galt: Platz und Ordner.
import type { Principal } from "./auth";

export interface Opener { slot: number; openedAt: number; cwd: string; linie?: string }
interface Seat { id: number; cwd: string | null; openedAt: number; linie?: string | null }

/** Eine Linie: 24 Hex-Zeichen, dieselbe Form wie eine lineageId (die erste Nachfolge schreibt ihre Übergabe unter dieser Linie). */
export const LINIE_RE = /^[0-9a-f]{24}$/;

/** Der Datensatz der Öffnerin aus ihrem Sitz: Platz, Belegung, Ordner und ihre Linie. */
export const opener = (by: Seat & { cwd: string }): Opener =>
  ({ slot: by.id, openedAt: by.openedAt, cwd: by.cwd, ...(by.linie ? { linie: by.linie } : {}) });

// null = vom Board geöffnet, ohne Self-Token, von einer schon beendeten Belegung, oder die Session hat sich selbst geöffnet
export function openerVon(caller: Principal | null, slots: readonly Seat[], opened: Seat): Opener | null {
  const seat = caller?.kind === "owner" ? caller.session : undefined;
  if (!seat || seat.slot === opened.id) return null;
  const by = slots.find((x) => x.id === seat.slot);
  return by?.cwd && by.openedAt === seat.openedAt ? opener({ ...by, cwd: by.cwd }) : null;
}

// aus fleet.json: nur ein ganzer Datensatz; eine Linie, die keine ist, fällt allein weg (der Datensatz liest sich dann wie ein alter)
export function openerGeladen(raw: unknown): Opener | null {
  if (!raw || typeof raw !== "object") return null;
  const { slot, openedAt, cwd, linie } = raw as Record<string, unknown>;
  return Number.isInteger(slot) && typeof openedAt === "number" && Number.isFinite(openedAt) && typeof cwd === "string" && cwd
    ? { slot: slot as number, openedAt, cwd, ...(typeof linie === "string" && LINIE_RE.test(linie) ? { linie } : {}) } : null;
}

// die Regel selbst teilen Server und Board (src/linie.ts)
export { gleicheOeffnerin, istOeffnerin, type Linienbezug } from "../src/linie";

/** EIN ALTER DATENSATZ (ohne Linie) BEIM LADEN: er bekommt die Linie des heutigen Besetzers seines Platzes, wenn die Öffnerin, die er
 *  nennt, dieser Besetzer ist oder einer seiner Vorgänger in derselben Linie (`vorgaenger`: die Belegungen, die laut Übergabe-Records
 *  und Lane-Sitzen in diese Linie übergaben). Sonst bleibt er, wie er ist. Rein. */
export function linieFuerAltenOeffner(rec: Opener, besetzer: (Seat & { linie: string | null }) | undefined, vorgaenger: readonly number[]): Opener {
  if (rec.linie || !besetzer?.cwd || !besetzer.linie || besetzer.id !== rec.slot || besetzer.cwd !== rec.cwd) return rec;
  return besetzer.openedAt === rec.openedAt || vorgaenger.includes(rec.openedAt) ? { ...rec, linie: besetzer.linie } : rec;
}

/** DIE LINIE, DIE EINE NACHFOLGE TRÄGT (R3-1): openSlot setzt sie vor der ersten Speicherung auf die Nachfolgerin, samt der Öffnerin, wenn die
 *  Nachfolgerin im selben Ordner öffnet (`mitOeffner`; ein Lane-Neustart trägt nur die Linie). Ein Neustart des Servers im Fenster findet sie
 *  so schon in fleet.json. null = der Sitz hat keine (leer oder ohne Linie), die Öffnung beginnt eine neue. */
export interface GetrageneLinie { linie: string; openedBy: Opener | null; cwd: string }
export const getrageneLinie = (s: { linie: string | null; cwd: string | null; openedBy: Opener | null }, mitOeffner: boolean): GetrageneLinie | null =>
  s.linie && s.cwd ? { linie: s.linie, openedBy: mitOeffner ? s.openedBy : null, cwd: s.cwd } : null;

// ---- DIE LINIEN, DIE ENDETEN (Prüfung L3: eine Rolle behält ihre Macht) ----------------------------------------------------------------
// Endet eine Belegung, hält Fleet ihre Linie fest: Platz, Ordner, das Gespräch, das sie führte, und ob sie die Orchestratorin war. Öffnet der
// Owner danach (i) eine Orchestratorin oder (ii) einen Platz, der das Gespräch einer beendeten Belegung fortsetzt (resume), setzt die neue
// Belegung deren Linie fort und ist wieder die Öffnerin ihrer Kinder. Eine frische andere Session bekommt eine neue Linie. Eine Linie, die ein
// lebender Sitz trägt oder eine Nachfolge gerade weitergibt, setzt niemand fort (sonst gäbe es zwei Öffnerinnen); eine Nachfolge schreibt
// darum keine Zeile, nur eine gescheiterte. Persistiert in fleet.json, gekappt auf die jüngsten (die jüngste Orchestratorin bleibt).
export interface EndeteLinie { linie: string; slot: number; cwd: string; sessionId: string | null; orchestrator: boolean; at: number }
export const ENDETE_LINIEN_MAX = 50;

export function linieEndet(liste: readonly EndeteLinie[], e: EndeteLinie): EndeteLinie[] {
  return gekappt([...liste.filter((x) => x.linie !== e.linie), e]);
}

/** Die jüngsten ENDETE_LINIEN_MAX — und die jüngste Orchestratorin dazu, wenn sie älter ist (Prüfung Runde 2, N2): Lanes, Kinder und Enden
 *  aller Art schieben sie sonst hinaus, und die Orchestratorin, die der Owner morgen öffnet, bekäme eine neue Linie statt ihrer Kinder. */
function gekappt(liste: readonly EndeteLinie[]): EndeteLinie[] {
  const rest = liste.slice(-ENDETE_LINIEN_MAX), orch = liste.findLast((x) => x.orchestrator);
  return orch && !rest.includes(orch) ? [orch, ...rest] : rest;
}

/** Die Linie, die eine neue Belegung fortsetzt: die jüngste beendete Orchestratorin (`orchestrator`) oder die Belegung, deren Gespräch sie
 *  fortsetzt (`sessionId`); nie eine, die ein lebender Sitz trägt. null = eine neue Linie. */
export function fortgesetzteLinie(liste: readonly EndeteLinie[], wer: { orchestrator: true } | { sessionId: string },
  lebend: ReadonlySet<string>): string | null {
  const passt = (x: EndeteLinie) => "orchestrator" in wer ? x.orchestrator : x.sessionId === wer.sessionId;
  return [...liste].reverse().find((x) => passt(x) && !lebend.has(x.linie))?.linie ?? null;
}

export function endeteLinienGeladen(raw: unknown): EndeteLinie[] {
  if (!Array.isArray(raw)) return [];
  return gekappt(raw.flatMap((v): EndeteLinie[] => {
    const r = v && typeof v === "object" ? v as Record<string, unknown> : null;
    return r && typeof r.linie === "string" && LINIE_RE.test(r.linie) && Number.isInteger(r.slot) && typeof r.cwd === "string" && r.cwd
      && (r.sessionId === null || typeof r.sessionId === "string") && typeof r.orchestrator === "boolean" && typeof r.at === "number"
      ? [{ linie: r.linie, slot: r.slot as number, cwd: r.cwd, sessionId: r.sessionId as string | null, orchestrator: r.orchestrator, at: r.at }] : [];
  }));
}
