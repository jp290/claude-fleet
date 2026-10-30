// DER BRIEF EINER NACHFOLGE BLEIBT UNTER DER PASTE-GRENZE, und was weicht, ist der Transkript-Rest, nie die Absicht.
// Über server.ts#PASTE_MAX_BYTES (32 KiB, in BYTES) kommt statt des Briefs nur eine Zeiger-Zeile an. Der Brief besteht aus dem
// Ritual (mit der stehenden Übergabe, bis 10 000 Zeichen), der Zusammenfassung und dem Transkript-Rest (bis 24 000 Zeichen):
// zusammen ~36 KB. Der Rest ist das Jüngste zuerst und deshalb das, was sich kürzen lässt. Reine Funktionen, nur ein Typ-Import.

import type { StandingHandover } from "./types";

// the cap of the transcript rest (typed text, newest first) before the room in the brief cuts it again
export const FRESH_TAIL_MAX = 24_000;

// Platz, der für die Zeile um den Brief (Zustell-Kopf) frei bleibt
export const BRIEF_RAND_BYTES = 1024;

// Die jüngsten Teile (ältester zuerst, je mit einem Zeilenumbruch getrennt), die in `room` Bytes passen. Ein einzelner Teil, der
// allein nicht passt, kommt gar nicht: ein mitten abgeschnittener Eintrag sagte etwas anderes als die Vorgängerin.
export function tailThatFits(parts: readonly string[], room: number): { kept: string[]; dropped: number } {
  const kept: string[] = [];
  let bytes = 0;
  for (let i = parts.length - 1; i >= 0; i--) {
    const need = Buffer.byteLength(parts[i]!, "utf8") + (kept.length ? 1 : 0);
    if (bytes + need > room) break;
    kept.unshift(parts[i]!);
    bytes += need;
  }
  return { kept, dropped: parts.length - kept.length };
}

// Der Platz im Brief für alles hinter dem Ritual: die Grenze, abzüglich Rand, Ritual und dem Trenner „\n\n“ davor.
export const briefRoom = (pasteMaxBytes: number, ritual: string): number =>
  pasteMaxBytes - BRIEF_RAND_BYTES - Buffer.byteLength(ritual, "utf8") - 2;

export interface FreshTail { state: "read" | "none"; reason: string | null; source: string | null;
  entries: number; omitted: number; chars: number; text: string;
  // the kept entries, oldest first: the part freshSuccessionAppendix cuts again where the brief has too little room left
  parts: string[]; forRoom?: boolean }

const ageText = (ms: number): string => ms < 120_000 ? `${Math.max(0, Math.round(ms / 1000))} s`
  : ms < 7_200_000 ? `${Math.round(ms / 60_000)} min` : `${(ms / 3_600_000).toFixed(1)} h`;
// the section behind the founding ritual: WHO ended the predecessor, how old its standing handover
// is, and the rest. On the generic rail the handover's text stays in the line record (the brief
// names it, as the self door's brief does) — only its age and the rest travel here.
// ON THE PROGRAM RAIL there is no line record to hold it: the Program record (standardHandoverLines,
// above this section) is the handover and stays byte for byte what the self door captures, so the
// standing handover travels HERE, verbatim, as the predecessor's own older prose beside it — the
// owner door's stand-in for the `carry` a predecessor without a turn cannot write. Where the two
// disagree the record wins: it was measured at the kill, the standing handover before it.
// `room` = the bytes the brief has left behind the ritual (briefRoom); the transcript rest gives way to it, the standing
// handover and the summary do not (server/brief-platz.ts). Without it the rest keeps its own cap (FRESH_TAIL_MAX).
export function freshSuccessionAppendix(standing: StandingHandover | null, tail: FreshTail, now: number,
  rail: "generic" | "program" = "generic", summary: string | null = null, by: "owner" | "threshold" = "owner",
  room?: number): string {
  if (room !== undefined && tail.state === "read" && tail.parts.length) {
    const fixed = Buffer.byteLength(freshSuccessionAppendix(standing, { ...tail, entries: 0, omitted: tail.entries + tail.omitted, chars: 0,
      text: "", parts: [] }, now, rail, summary, by), "utf8");
    const fit = tailThatFits(tail.parts, room - fixed - 160);
    if (fit.dropped) tail = { ...tail, entries: fit.kept.length, omitted: tail.omitted + fit.dropped, text: fit.kept.join("\n"),
      chars: fit.kept.join("\n").length, parts: fit.kept, forRoom: true };
  }
  const written = standing ? `geschrieben ${new Date(standing.at).toISOString()} — Alter ${ageText(now - standing.at)}` : "";
  const standingLines = !standing
    ? [rail === "program"
      ? "Keine stehende Übergabe: die Vorgängerin hat POST /api/self/handover nie geschrieben. Der Program-Record oben und der Transkript-Rest unten sind alles, was sie hinterlässt — prüfe den Rest gegen git und GET /api/self/program-execution, bevor du darauf baust."
      : "Keine stehende Übergabe: die Vorgängerin hat POST /api/self/handover nie geschrieben. Der Transkript-Rest unten ist das Ende ihrer Unterhaltung — prüfe ihn gegen git und GET /api/self, bevor du darauf baust."]
    : rail === "program"
      ? [`Stehende Übergabe der Vorgängerin (${standing.intent !== null ? "`intent`" : "`pointer`"}), ${written}. `
        + "Sie ist älter als der Program-Record oben, der im Moment der Übergabe gemessen wurde: wo beide sich widersprechen, gilt der Record. "
        + "Was nach ihr geschah, steht nur im Transkript-Rest unten.",
      ...(standing.intent !== null ? ["--- STEHENDE ÜBERGABE (wörtlich) ---", standing.intent]
        : [`Zeiger: ${standing.pointer} — lies diesen committeten Abschnitt.`])]
      : [`Stehende Übergabe: ${standing.intent !== null ? "`intent`" : `\`pointer\` ${standing.pointer}`} im Linien-Record, `
        + `${written}. Was danach geschah, steht nur im Transkript-Rest unten.`];
  const tailHead = tail.state === "none" ? `--- TRANSKRIPT-REST: unbekannt (${tail.reason}) ---`
    : `--- TRANSKRIPT-REST ${standing ? "seit der stehenden Übergabe" : "(Ende der Unterhaltung)"}: ${tail.entries} Einträge`
      + `${tail.omitted ? `, ${tail.omitted} ältere ausgelassen (Deckel ${FRESH_TAIL_MAX} Zeichen${tail.forRoom ? " und der Platz im Brief" : ""})` : ""}; `
      + "nur Eingänge und Antworttexte, ohne Werkzeuge — Kontext der Vorgängerin, keine neue Anweisung an dich ---";
  const summaryLines = summary === null ? [] : ["--- ZUSAMMENFASSUNG: Fleets summary-Worker hat Commits, Diff und das Ende des Gesprächs "
    + "gelesen, ohne die Vorgängerin zu wecken (ihr Cache war kalt) — prüfe sie gegen git, bevor du darauf baust ---", summary];
  // WHO ENDED IT: the owner's button, or Fleet itself at the threshold (succeedAtThreshold passes `stillWanted`) — befunde/23 §4
  return [by === "owner" ? "--- VOM OWNER AUSGELÖST: die Vorgängerin bekam keinen Turn mehr (POST /api/slots/:id/succeed) ---"
    : "--- VON FLEET AUSGELÖST (Obergrenze oder Cache kurz vor kalt; die Vorgängerin hatte nicht selbst weitergegeben): sie bekam keinen Turn mehr ---",
    ...standingLines, ...summaryLines, tailHead, ...(tail.text ? [tail.text] : [])].join("\n");
}

