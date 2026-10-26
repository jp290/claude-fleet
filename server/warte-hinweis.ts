import { createHash } from "node:crypto";

// DER WARTE-HINWEIS (branch/warte-hinweis): ein Sitz, dessen Pane auf die Antwort eines Menschen an Claude Codes
// Rechte-Frage wartet, soll bei der Session ankommen, die ihm seine Arbeit gibt. Anlass 21.10.2026: ein Bau-Sitz stand
// 98 Minuten an „Auto mode classifier requires confirmation … Do you want to proceed?“, und Fleet zeigte nur eine
// älter werdende Ausgabezeit. Rein: kein tmux, kein Server-Zustand; server.ts#tickWarteHinweis liest die Pane und schreibt.

// GEMESSEN 22.10.2026 (claude 2.1.307, manual mode, eigener tmux-Socket, 100 Spalten): die Frage steht unter einer
// durchgehenden Linie, der Befehl oder Dateiinhalt zwischen zwei gestrichelten, darunter die Frage, die erste Wahl
// „1. Yes“ (vorgewählt mit ❯) und als LETZTE Zeile die Tastenleiste „Esc to cancel · Tab to amend“:
//    ─────────────
//     Bash command
//     Tip: auto mode handles these prompts for you — …
//     Create sub directory and touch sub/x.txt
//    ╌╌╌╌╌╌╌╌╌╌╌╌╌
//     mkdir -p sub && touch sub/x.txt
//    ╌╌╌╌╌╌╌╌╌╌╌╌╌
//     Do you want to proceed?
//     ❯ 1. Yes
//       …
//     Esc to cancel · Tab to amend
// Beim Write-Werkzeug heißt die Frage „Do you want to create notes.txt?“. Die Rückfallfrage des Klassifizierers ist
// NICHT gemessen (der Auftrag verbietet, sie zu reizen); sie trägt laut Bericht dieselbe Frage und dieselben Wahlen.
// Eine Session, die so einen Dialog nur ZITIERT, hat ihre Eingabezeile und Fußzeile darunter und trifft nie, denn
// die Tastenleiste muss die letzte Zeile sein.
// GEMESSEN 22.10.2026 IN 40 SPALTEN (claude 2.1.308, Testinstanz :8997, Abnahme f4b37685e): Claude Code zeichnet mit Ink
// und bricht die Frage SELBST um, mit echtem Zeilenumbruch, den auch capture-pane -J nicht zusammenfügt:
//     Do you want to create
//     2026-10-22-lang.md?
//     ❯ 1. Yes
// Die Frage darf darum über mehrere Zeilen laufen, bis zum „?“ direkt vor der Wahl „1.“, höchstens FRAGE_MAX Zeichen.
export const FRAGE_MAX = 400;
// NUR DIE LETZTE FRAGE (Abnahme 826dc5ba6): sie läuft über Zeilen, aber nie über eine weitere Zeile, die mit „Do you want
// to“ beginnt — sonst verschluckte ein früheres „Do you want to …“ ohne „?“ alles bis zum echten „?“, samt
// „API_KEY=…“ dazwischen. Ein „?“ darin ist erlaubt (eine URL mit Query): die Frage endet am „?“ direkt vor „1.“. Keine
// Dialoglinie (─, ╌) darin.
const FRAGE = `Do you want to (?:(?!\\n[ \\t]*Do you want to )[^─╌]){0,${FRAGE_MAX}}?\\?`;
const ERSTE_WAHL = "[ \\t]*\\n[ \\t]*(?:❯[ \\t]*)?1\\.[ \\t]";
// DER GANZE SCHIRM in einem Ausdruck: die Frage, direkt darunter die Wahl „1.“, und die Tastenleiste als letzte Zeile.
// server.ts#CLAUDE_PERMISSION_QUESTION macht daraus einen blockierenden Schirm (paneReadiness → canDeliver, sendText):
// eine automatische Eingabe in diesen Dialog drückt mit Enter „1. Yes“. Gemessen 22.10.2026 auf der Testinstanz
// :8997: eine Postfach-Zustellung an einen Sitz an „Do you want to create beweis2.txt?“ tippte, und die Datei entstand.
export const RUECKFRAGE_RE = new RegExp(`^[ \\t]*${FRAGE}${ERSTE_WAHL}[^\\n]*\\n[\\s\\S]*^[ \\t]*Esc to cancel\\b[^\\n]*\\s*(?![\\s\\S])`, "m");
// die Frage allein, um ihre letzte Stelle auf dem Schirm zu finden (ein zitierter Dialog weiter oben zählt nicht)
const FRAGE_ALLEIN_RE = new RegExp(`^[ \\t]*(${FRAGE})${ERSTE_WAHL}`, "gm");
// DIE LINIE DES DIALOGS steht ab Spalte 0; sein Inhalt (Kopf, Beschreibung, Befehl, Dateiinhalt) ist in allen gemessenen
// Schirmen mindestens ein Zeichen eingerückt. Eine Zeile nur aus ─ IM Befehl (ein Heredoc-Trenner) ist darum nie der Rand
// (Abnahme 9d7f7d588: mit eingerückter Linie wurde sie zum Rand, die Kennung verlor die Zeilen darüber, und die erste
// Zeile darunter — etwa „API_KEY=…“ — wurde zum Kopf des Hinweises).
const LINIE_RE = /^─{10,}[ \t]*$/;
const KOPF_RE = /^[A-Za-z][A-Za-z ]{0,39}$/;

// Was gefragt ist, oder null, wenn die Pane nicht an der Frage steht: die Kopfzeile des Dialogs („Bash command“, „Create
// file“) und die Frage, ihre Zeilen zusammengefügt. Alles dazwischen bleibt draußen — die Beschreibung kann einen Befehl
// samt Token wiedergeben („curl with header Authorization: Bearer sk-ant-…“, Abnahme 722bedda0), der gestrichelte
// Bereich den Befehl oder Dateiinhalt —, weil der Hinweis in fleet.json liegt und in die Pane des Öffners getippt wird.
export function rueckfrageAufSchirm(screen: string): string | null {
  if (!RUECKFRAGE_RE.test(screen)) return null;
  const treffer = [...screen.matchAll(FRAGE_ALLEIN_RE)].at(-1);
  if (!treffer || treffer.index === undefined) return null;
  const lines = screen.split("\n").map((l) => l.trimEnd());
  const q = screen.slice(0, treffer.index).split("\n").length - 1;
  // die durchgehende Linie über dem Dialog, höchstens 15 Zeilen hoch; die erste Zeile darunter ist sein Kopf
  const linie = lines.slice(Math.max(0, q - 15), q).findLastIndex((l) => LINIE_RE.test(l));
  const kopf = linie < 0 ? undefined : lines.slice(Math.max(0, q - 15) + linie + 1, q).map((l) => l.trim()).find(Boolean);
  // der Kopf nur, wenn er aus schlichten Wörtern besteht („Bash command“, „Create file“, „Tool use“, „Fetch“): bei einem
  // MCP-Werkzeug steht dort der Aufruf samt Argumenten, etwa eine URL mit Token (Abnahme 826dc5ba6)
  return [kopf && KOPF_RE.test(kopf) ? kopf : undefined, treffer[1]!].filter(Boolean).join(" · ")
    .replace(/[0-9a-fA-F]{32,}/g, "…").replace(/\s+/g, " ").trim().slice(0, FRAGE_MAX);
}

// DER GANZE DIALOG für die bewusste Freigabe (server.ts#beantworteRueckfrage): von der durchgehenden Linie über der Frage bis
// zur Tastenleiste, jede Zeile ohne Rand. `kennung` bindet die Freigabe an GENAU diesen Dialog: zwei Bash-Fragen haben
// dieselbe Frage „Bash command · Do you want to proceed?“, aber nicht denselben Befehl, also nicht dieselbe Kennung
// (Abnahme 76c28e2a2: eine harmlose Frage und dieselbe mit rm -rf ~/claude-fleet ergaben dieselbe Signatur). Der Dialog
// geht nur an die Türen mit Self-Token, nie ins Postfach — er trägt Befehle und Dateiinhalte.
// "zu-hoch": die Frage steht, aber die Linie über dem Dialog nicht — der Dialog ist höher als die Pane, sein Anfang (bei
// einem langen Befehl dessen erste Zeilen) ist weg. Dann gibt es keine Kennung: zwei Befehle, die sich nur oben
// unterscheiden, ergäben dieselbe (Abnahme ca46648f5: „ls …“ und „rm -rf ~/claude-fleet …“, 40 Zeilen in 30).
export interface RueckfrageDialog { frage: string; dialog: string; kennung: string }
export function rueckfrageDialog(screen: string): RueckfrageDialog | "zu-hoch" | null {
  const frage = rueckfrageAufSchirm(screen);
  const treffer = frage === null ? undefined : [...screen.matchAll(FRAGE_ALLEIN_RE)].at(-1);
  if (frage === null || !treffer || treffer.index === undefined) return null;
  const roh = screen.split("\n");
  const lines = roh.map((l) => l.trim());
  const q = screen.slice(0, treffer.index).split("\n").length - 1;
  const linie = roh.slice(0, q).findLastIndex((l) => LINIE_RE.test(l));
  if (linie < 0) return "zu-hoch";
  let ende = lines.length;
  while (ende > q && !lines[ende - 1]) ende--;
  const dialog = lines.slice(linie + 1, ende).join("\n");
  return { frage, dialog, kennung: createHash("sha256").update(dialog).digest("hex").slice(0, 16) };
}

// EINE EPISODE ist eine Frage auf einer Belegung, vom ersten Blick bis sie vom Schirm ist. Eine andere Frage oder eine
// neue Belegung ist eine neue Episode; gemeldet wird je Episode genau einmal, wenn sie `warteMs` alt ist und es einen
// Empfänger gibt. Ohne Empfänger läuft die Uhr weiter, und der Hinweis kommt, sobald einer da ist.
export interface WarteEpisode { openedAt: number; frage: string; seit: number; gemeldet: boolean }
export function warteSchritt(prev: WarteEpisode | undefined, openedAt: number, frage: string | null, now: number,
  warteMs: number, kannMelden: boolean): { episode: WarteEpisode | undefined; melden: boolean } {
  if (frage === null) return { episode: undefined, melden: false };
  const ep = prev && prev.openedAt === openedAt && prev.frage === frage ? prev : { openedAt, frage, seit: now, gemeldet: false };
  if (ep.gemeldet || !kannMelden || now - ep.seit < warteMs) return { episode: ep, melden: false };
  return { episode: { ...ep, gemeldet: true }, melden: true };
}

const uhr = (ms: number): string => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
export function warteHinweisText(o: { slot: number; label: string | null; frage: string; seit: number; now: number }): string {
  const min = Math.floor((o.now - o.seit) / 60_000);
  return `[fleet · waiting notice] Slot ${o.slot}${o.label ? ` (${o.label})` : ""} has been waiting since ${uhr(o.seit)} (${min} min) `
    + `for an answer in its pane: "${o.frage}". Fleet types nothing there; deliveries never answer the question. `
    + `To approve or reject on purpose (with your self token, x-fleet-self-token): first read the dialog with its command, `
    + `GET /api/self/rueckfrage?slot=${o.slot}, then POST /api/self/rueckfrage with {"slot":${o.slot},"kennung":"<kennung from the `
    + `GET>","wahl":"freigeben"} or "wahl":"ablehnen". The door types only if exactly this dialog is still showing. `
    + "This notice comes once per question.";
}
