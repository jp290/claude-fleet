// The chat view's status line (Neuaufbau K10 S1, server/live-state.ts): the session's live state in the
// owner's words (13.10.: arbeitet, denkt, Hooks laufen, wartet auf dich, unterbrochen, bereit) and a small
// dot that moves while it works. No seconds and no tokens — „[Zitat entfernt]“.
import type { LiveState } from "../server/live-state";

export type { LiveState };
export type LiveKind = "work" | "wait" | "stop" | "idle";

export function liveWord(s: Pick<LiveState, "turn" | "detail">): { word: string; kind: LiveKind } | null {
  if (s.turn === "working") return { word: s.detail === "thinking" ? "denkt" : s.detail === "hooks" ? "Hooks laufen" : "arbeitet", kind: "work" };
  if (s.turn === "asking") return { word: "wartet auf dich", kind: "wait" };
  if (s.turn === "interrupted") return { word: "unterbrochen", kind: "stop" };
  if (s.turn === "ready") return { word: "bereit", kind: "idle" };
  return null;
}

// one line, built once and repainted in place: role=status so a screen reader hears the change
export function liveLine(): HTMLElement {
  const line = document.createElement("div");
  line.className = "mlive";
  line.setAttribute("role", "status");
  const dot = document.createElement("span");
  dot.className = "mlivedot";
  const word = document.createElement("span");
  word.className = "mliveword";
  line.append(dot, word);
  return line;
}
export function paintLiveLine(line: HTMLElement, w: { word: string; kind: LiveKind }): void {
  if (line.dataset.kind !== w.kind) line.dataset.kind = w.kind;
  const word = line.querySelector(".mliveword");
  if (word && word.textContent !== w.word) word.textContent = w.word;
}
