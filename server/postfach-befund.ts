// DAS URTEIL HAT EINEN NAMEN — die nicht zugestellte Nachricht (Owner 28.10.: „[Zitat entfernt]“)
//
// canDeliver (server.ts) weiss, WARUM eine Pane nichts bekommt — es sind sechs benannte Tore. Sein
// Urteil kam beim Absender nie an: zustellePostfachDirekt kehrte still zurück, und das Senden
// antwortete `{ok:true}`. Dieses Blatt übersetzt das Urteil in das, was Absender und Board lesen:
// das Tor, den Sitz, einen Satz.
//
// Es entscheidet NICHTS selbst und weicht kein Tor auf — es ist die Übersetzung, nicht das Urteil.
// Es ist rein (keine Datei, kein Server, kein tmux), wie server/postfach-zustellen.ts, dessen Takt
// es beschreibt.
//
// ZWEI WÖRTER FÜR EIN TOR, absichtlich: `gate` ist das Wort von canDeliver (der genaue Grund, etwa
// `blocked-screen`), `tor` das Wort des Owners (alive, idle, quiet-hours, kill-switch, harness). Ein
// Satz, der nur `busy` sagt, nennt das Tor `idle` nicht; einer, der nur `idle` sagt, verschweigt die
// Pane. Beide zusammen sind der Grund, den der Absender lesen soll.
export type PostfachGate = "kill-switch" | "harness" | "not-alive" | "blocked-screen" | "quiet-hours" | "busy";
export const POSTFACH_GATES: readonly PostfachGate[] = ["kill-switch", "harness", "not-alive", "blocked-screen", "quiet-hours", "busy"];
export type PostfachTor = "alive" | "idle" | "quiet-hours" | "kill-switch" | "harness";
export const POSTFACH_TORE: readonly PostfachTor[] = ["alive", "idle", "quiet-hours", "kill-switch", "harness"];

// Das Tor, unter dem ein Gate beim Owner heißt. blocked-screen ist die Pane-seitige Schwester von
// not-alive (der Agent lebt, ein Schirm isst das Einfügen) — beide sind die Frage „[Zitat entfernt]“.
const TOR: Record<PostfachGate, PostfachTor> = {
  "kill-switch": "kill-switch",
  "harness": "harness",
  "not-alive": "alive",
  "blocked-screen": "alive",
  "quiet-hours": "quiet-hours",
  "busy": "idle",
};
export const postfachTor = (gate: PostfachGate): PostfachTor => TOR[gate];

const WARUM: Record<PostfachGate, string> = {
  "kill-switch": "automation is switched off fleet-wide",
  "harness": "that harness may not be driven unattended",
  "not-alive": "no agent is running in its pane",
  "blocked-screen": "its pane is on a blocking screen",
  "quiet-hours": "the owner's quiet hours are in force",
  "busy": "its pane is busy",
};

// WAS AM EINTRAG STEHT, WENN ER NICHT ANKAM. Kein Zustellversprechen und keine Ankunft: die Sperre
// nennt den Grund, solange sie gilt, und verschwindet mit dem Tippen (loescheSperre). Der Schlüssel
// `delivery` fehlt am Eintrag, solange nichts ihn hindert — „kein Hindernis bekannt“ ist etwas
// anderes als „angekommen“, und nur die Quittung (`readBy`) behauptet eine Ankunft.
export interface PostfachHindernis {
  state: "not-delivered";
  gate: PostfachGate;
  tor: PostfachTor;
  slot: number;
  at: number;
  reason: string;
}

// Die Grenze ist die des Record-Loaders (server/types.ts#loadPostfachHindernis): ein zu langer Satz
// wäre nach einem Neustart ein kaputter Eintrag, und ein kaputter Eintrag ist ein VERLORENER Record.
// Darum wird hier gekürzt, nicht dort abgelehnt.
export const POSTFACH_REASON_MAX = 500;
export const POSTFACH_DETAIL_MAX = 200;
export function postfachHindernis(gate: PostfachGate, slot: number, at: number,
  detail?: string | null): PostfachHindernis {
  const tor = postfachTor(gate);
  const why = detail ? `: ${detail.slice(0, POSTFACH_DETAIL_MAX)}` : "";
  const reason = `not delivered to slot ${slot} — ${WARUM[gate]} (gate ${gate}, ${tor})${why}; `
    + "the message stays unread in the Postfach and is typed as soon as that gate opens";
  return { state: "not-delivered", gate, tor, slot, at, reason: reason.slice(0, POSTFACH_REASON_MAX) };
}

// DIESELBE SPERRE NOCH EINMAL? Dann schreibt der Takt sie nicht jede Runde erneut in fleet.json.
// `at` zählt nicht mit: die erste Beobachtung des Tores ist die Angabe, nicht die letzte Taktzeit.
export const dieselbeSperre = (a: PostfachHindernis | null | undefined, b: PostfachHindernis): boolean =>
  !!a && a.gate === b.gate && a.slot === b.slot;

// EINE ANKUNFT LÖSCHT DIE SPERRE — was der Takt getippt hat (Annahme gleich welcher Beobachtung) ist
// kein „nicht zugestellt“ mehr. `true` heisst: der Eintrag wurde geändert und muss gespeichert werden.
export function loescheSperre(entry: { delivery?: PostfachHindernis | null }): boolean {
  if (!entry.delivery) return false;
  delete entry.delivery;
  return true;
}
