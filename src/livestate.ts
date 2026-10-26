// The chat view's status line (Neuaufbau K10 S1, server/live-state.ts): the session's live state in the
// owner's words (13.10.: arbeitet, denkt, Hooks laufen, wartet auf dich, unterbrochen, bereit) and a small
// dot that moves while it works. No seconds and no tokens — „[Zitat entfernt]“.
import type { LiveState } from "../server/live-state";

export type { LiveState };
export type LiveKind = "work" | "wait" | "stop" | "idle";

// the subagents the session runs beside its turn; 0 from a server that does not report it yet. Shell commands
// are reported too (server/live-state.ts) but do not count: a watch that looks every 2 minutes is no work
export const backgroundCount = (s: Partial<Pick<LiveState, "background">>): number => s.background?.agents ?? 0;

export function liveWord(s: Pick<LiveState, "turn" | "detail"> & Partial<Pick<LiveState, "background">>): { word: string; kind: LiveKind } | null {
  if (s.turn === "working") return { word: s.detail === "thinking" ? "thinking" : s.detail === "hooks" ? "hooks running" : "working", kind: "work" };
  if (s.turn === "asking") return { word: "waiting for you", kind: "wait" };
  if (s.turn === "interrupted") return { word: "interrupted", kind: "stop" };
  // owner 25.10.: the turn is over, but a subagent still runs (a background command alone does not count) — that is work, not „[Zitat entfernt]“
  if ((s.turn === "ready" || s.turn === "unknown") && backgroundCount(s) > 0) return { word: "working in the background", kind: "work" };
  if (s.turn === "ready") return { word: "ready", kind: "idle" };
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
