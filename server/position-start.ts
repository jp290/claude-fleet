// WAS REIST, STARTET, WO ES LANDET (F1 Runde 2): eine Position einer gespeicherten Konstellation (`sitz: "<konst>/<pos>"`) startet mit dem Ziel, das die
// Datei ihr gibt (Position.ziel → erste Nachricht), und in dem Ordner, den die Person für den leeren Platz der Datei wählt (Position.ordner → `cwd`). Reine Teile,
// die die Türen teilen (Slot-Tür des Owners, Ordner-Tür des Sitzes, Branch-Tür); die Türen selbst stehen in server.ts. Der Sitz selbst (Slot.sitz) trägt Ziel, Platz und
// den Namen der Konstellation, damit Fassung und GET /api/self sie zeigen (server/sitz-reise.ts#SitzStart).
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import type { SitzStart } from "./sitz-reise";

export interface PositionsZiel { ziel: string; aus: "datei" | "tuer" | "keins"; ersetzt: boolean }
/** Welches Ziel gilt: das der Tür (goal oder aufgabe) vor dem der Datei; ersetzt es ein Ziel der Datei, sagt die Antwort das. */
export function zielAusPosition(zielDerTuer: string, sitz: SitzStart | null): PositionsZiel {
  const datei = sitz?.ziel?.trim() ? sitz.ziel : "";
  if (zielDerTuer) return { ziel: zielDerTuer, aus: "tuer", ersetzt: datei !== "" };
  return datei ? { ziel: datei, aus: "datei", ersetzt: false } : { ziel: "", aus: "keins", ersetzt: false };
}

/** Der Satz, wenn der leere Ordnerplatz einer Position ohne `cwd` bleibt — gut genug, dass das Startfenster ihn so zeigen kann. */
export function ordnerFehlt(sitz: SitzStart | null, cwdGegeben: boolean, selbst: boolean): string | null {
  if (!sitz?.ordner || cwdGegeben) return null;
  return ordnerSatz(sitz.pos, sitz.ordner.hint, selbst);
}
export function ordnerSatz(pos: string, hint: string | null, selbst: boolean): string {
  return `folder for seat "${pos}": a folder${selbst ? " under your seat root" : ""}, ${hint ? `the sender used "${hint}"`
    : "the sender's folder lay outside their seat root, so there is no hint"}`;
}

/** Der Vorschlag für den Ordner, wenn ein Sitz seine Geschwister öffnet und kein `cwd` nennt: der Hinweis neben seinem eigenen Ordner, wenn es ihn gibt. */
export function ordnerVorschlag(hint: string | null, oeffnerCwd: string, existiert: (pfad: string) => boolean = existsSync): string | null {
  if (!hint || hint === "." || isAbsolute(hint) || hint.split(/[/\\]/).includes("..")) return null;
  const pfad = join(dirname(oeffnerCwd), hint);
  return existiert(pfad) ? pfad : null;
}

/** Die erste Nachricht eines Sitzes, dessen Position ein Ziel mitbringt: der Kopf sagt, was er ist und woher das Ziel kommt, und nennt die anderen Sitze
 *  seiner Konstellation mit den Türen, durch die er sie öffnet; `vorn` ist, was davor steht, etwa wer die Session öffnete. */
export function zielNachricht(sitz: SitzStart, vorn: string | null, andere: readonly { id: string; name: string; auftrag: string | null; ordner: string | null }[]): string {
  const sitze = andere.map((x) => `${x.id} (${x.name}${x.ordner ? `, folder hint "${x.ordner}"` : ""})`).join(", ");
  const kopf = `[Fleet: you are the seat „${sitz.pos}“ of an imported constellation${sitz.konstName ? ` „${sitz.konstName}“` : ""}, and below is the goal of this position in the constellation „${sitz.konstName ?? sitz.konst}“ — from the file.${
    andere.length ? ` You open its other seats with "sitz": "<id>" at POST /api/self/branches/open (a branch, no goal) or POST /api/self/seats/open (a folder: without cwd the folder is the hint next to yours, when it exists). Seats: ${sitze}.` : ""}]`;
  return [vorn, kopf].filter(Boolean).join(" ") + `\n\n${sitz.ziel ?? ""}`;
}

/** Das Ziel im Abschnitt „aufgabe“ der Fassung: als „zuerst gesagt, aus der Datei“; ersetzt es die Tür, steht das dort. */
export function fassungAufgabeAusSitz(sitz: SitzStart | null): { quelle: string; text: string } | null {
  if (!sitz?.ziel) return null;
  return { quelle: `Slot.sitz (${sitz.konst}/${sitz.pos}, Ziel aus der Datei „${sitz.konstName ?? sitz.konst}“) — ${sitz.zielErsetzt
    ? "the file's goal, replaced by the goal given at the door" : "told first (from the file)"}`, text: sitz.ziel };
}

/** Was GET /api/self vom Sitz aus einer Datei zeigt: seine Position, das Ziel (und ob es ersetzt wurde) und der gefüllte Platz mit dem Hinweis. */
export function sitzAnsicht(sitz: SitzStart | null, cwd: string | null): Record<string, unknown> | null {
  if (!sitz) return null;
  return { konst: sitz.konst, pos: sitz.pos, ...(sitz.konstName ? { name: sitz.konstName } : {}),
    ...(sitz.ziel ? { goal: { text: sitz.ziel, from: "file", replaced: sitz.zielErsetzt === true } } : {}),
    ...(sitz.ordner ? { folder: { filled: cwd, hint: sitz.ordner.hint } } : {}) };
}
