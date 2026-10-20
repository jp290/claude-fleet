// WER EINE SESSION GEÖFFNET HAT (Slot.openedBy, Neuaufbau Konstellation Stück 2): die Session, deren Self-Token neben dem
// Owner-Bearer an der Öffnungs-Tür stand (server/auth.ts#resolvePrincipal). Rein: kein Holder, keine Route.
import type { Principal } from "./auth";

export interface Opener { slot: number; openedAt: number; cwd: string }
interface Seat { id: number; cwd: string | null; openedAt: number }

// null = vom Board geöffnet, ohne Self-Token, von einer schon beendeten Belegung, oder die Session hat sich selbst geöffnet
export function openerVon(caller: Principal | null, slots: readonly Seat[], opened: Seat): Opener | null {
  const seat = caller?.kind === "owner" ? caller.session : undefined;
  if (!seat || seat.slot === opened.id) return null;
  const by = slots.find((x) => x.id === seat.slot);
  return by?.cwd && by.openedAt === seat.openedAt ? { slot: by.id, openedAt: by.openedAt, cwd: by.cwd } : null;
}

// aus fleet.json: nur ein ganzer Datensatz
export function openerGeladen(raw: unknown): Opener | null {
  if (!raw || typeof raw !== "object") return null;
  const { slot, openedAt, cwd } = raw as Record<string, unknown>;
  return Number.isInteger(slot) && typeof openedAt === "number" && Number.isFinite(openedAt) && typeof cwd === "string" && cwd
    ? { slot: slot as number, openedAt, cwd } : null;
}
