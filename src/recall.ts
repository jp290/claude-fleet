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
  "Claude's input field holds text": "The terminal field holds text — nothing recalled.",
  "Claude's input field is not readable": "The terminal field can't be read right now — nothing recalled.",
  "nothing waits in the queue": "No message is waiting.",
  "a Fleet delivery waits in the queue": "A Fleet delivery is waiting — it stays where it is.",
  "a Fleet delivery waits in the queue — Esc would start it": "A Fleet delivery is waiting and Esc would start it — cancel in the terminal.",
  "the queue was taken before ↑ reached it": "The session already took the message.",
};
export function recallNotice(r: RecallResult): string | null {
  if (r.result === "recalled" || r.result === "interrupted" || r.result === "sent-now") return null;
  if (r.result === "refused" && r.why === "the session is not working") return null;
  return NOTICE[r.why] ?? (r.result === "kept" ? "Text is still in the terminal field — look there." : r.why);
}

// the phone's Esc: one button on the status line while the session works (desktop: the Esc key)
export function recallButton(onPress: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "mliveesc";
  b.textContent = "Cancel";
  b.title = "Like Esc in the terminal: cancels and brings your message back into the input";
  b.addEventListener("click", (e) => { e.stopPropagation(); onPress(); });
  return b;
}
// "jetzt senden" on a waiting bubble: ctrl+x ctrl+s in the terminal
export function sendNowButton(onPress: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "msendnow";
  b.textContent = "Send now";
  b.title = "Like ctrl+x ctrl+s in the terminal: cancels the running step and sends the waiting message at once";
  b.addEventListener("click", (e) => { e.stopPropagation(); onPress(); });
  return b;
}
