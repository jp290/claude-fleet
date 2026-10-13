// Esc and ↑ in the chat view, as in the terminal (Neuaufbau K10 S3; the pane side is server/recall.ts).
// Owner, 13.10.: „[Zitat entfernt]“
//  — „[Zitat entfernt]“
// 
import type { RecallKind, RecallResult } from "../server/recall";
import { splitDeliveryHeader, unwrapPasted } from "./pendingsend";

export type { RecallKind, RecallResult };

// the owner's words, without Fleet's head and Claude Code's paste wrapper: the interrupted prompt
// first, the waiting ones below in their order, a blank line between (Bauleitung 13.10.)
export function recalledBodies(texts: readonly string[]): string[] {
  return texts.map((t) => splitDeliveryHeader(unwrapPasted(t)).body.trim()).filter((b) => b !== "");
}
export function recalledText(texts: readonly string[], draft: string): string {
  return [...recalledBodies(texts), draft.trim()].filter((b) => b !== "").join("\n\n");
}

// what the owner reads when nothing (or not all) came back; null = nothing to say
const NOTICE: Record<string, string> = {
  "Claude's input field holds text": "Im Terminal-Feld steht Text — nichts zurückgeholt.",
  "Claude's input field is not readable": "Das Terminal-Feld ist gerade nicht lesbar — nichts zurückgeholt.",
  "nothing waits in the queue": "Es wartet keine Nachricht.",
  "a Fleet delivery waits in the queue": "Eine Fleet-Zustellung wartet — sie bleibt, wo sie ist.",
  "a Fleet delivery waits in the queue — Esc would start it": "Eine Fleet-Zustellung wartet, Esc würde sie losschicken — im Terminal abbrechen.",
  "the queue was taken before ↑ reached it": "Die Session hat die Nachricht schon genommen.",
};
export function recallNotice(r: RecallResult): string | null {
  if (r.result === "recalled" || r.result === "interrupted" || r.result === "sent-now") return null;
  if (r.result === "refused" && r.why === "the session is not working") return null;
  return NOTICE[r.why] ?? (r.result === "kept" ? "Im Terminal-Feld steht noch Text — bitte dort ansehen." : r.why);
}

// the phone's Esc: one button on the status line while the session works (desktop: the Esc key)
export function recallButton(onPress: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "mliveesc";
  b.textContent = "abbrechen";
  b.title = "Wie Esc im Terminal: bricht ab und holt deine Nachricht zurück in die Eingabe";
  b.addEventListener("click", (e) => { e.stopPropagation(); onPress(); });
  return b;
}
// "jetzt senden" on a waiting bubble: ctrl+x ctrl+s in the terminal
export function sendNowButton(onPress: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "msendnow";
  b.textContent = "jetzt senden";
  b.title = "Wie ctrl+x ctrl+s im Terminal: bricht den laufenden Schritt ab und schickt die wartende Nachricht sofort";
  b.addEventListener("click", (e) => { e.stopPropagation(); onPress(); });
  return b;
}
