// A SUBAGENT'S REPORT, HANDED BACK into the session it serves (owner 29.10.: a report „[Zitat entfernt]“, like every message the owner did not write — Mangel 78). Claude Code wraps
// it in <agent-message from="…"> and writes it in two shapes (measured 2026-10-29 in this host's
// transcripts: 107 lines resting, 11 queued mid-turn): a resting session gets a meta user line behind
// Claude Code's own "Another Claude session sent a message:" lead (server.ts#crossSessionEntry serves
// it and injects the subagent's name from the line's origin as a name="…" attribute), mid-turn it
// waits as the prompt of a queued_command attachment with commandMode "prompt". The wrapper's frame is
// Claude Code's, not the report's: a "[Subagent hand-back] … The report follows:" paragraph before the
// report, two spaces of indent on every report line, and after the closing tag a paragraph about
// permission laundering. This module reads the report out of the frame for the chat's quiet line
// (src/client.ts#addFleetLine): `who` names the sender, `text` is the report itself, `note` says its
// length before it is opened. Anchored at the start — a text that merely mentions the tag stays the
// owner's own words.

// attributes as measured: from="…", plus the name="…" server.ts#crossSessionEntry injects; whatever
// follows the closing tag is frame (measured: the permission-laundering paragraph) and goes. The closing
// tag may be missing: the chat view's entries are cut at 20,000 characters (server.ts#trim), and a long
// report loses its end there — it is still a report, never the owner's words
const AGENT_MESSAGE = /^(?:Another Claude session sent a message:\n)?<agent-message((?: [a-z-]+="[^"]*")*)>\n?([\s\S]*?)\n?(?:<\/agent-message>[\s\S]*)?$/;
// the frame's hand-back paragraph, from its mark to the sentence that ends it (measured wording)
const HAND_BACK = /^\[Subagent hand-back\][\s\S]*?The report follows:\s*\n/;

export interface AgentReport { who: string; text: string; note: string }

export function agentMessage(entry: string): AgentReport | null {
  const m = AGENT_MESSAGE.exec(entry);
  if (!m || !m[2]?.trim()) return null;
  const who = / name="([^"]*)"/.exec(m[1] ?? "")?.[1] || "agent";
  const inner = m[2] ?? "";
  const frame = HAND_BACK.exec(inner);
  // the two-space indent Claude Code puts on EVERY report line goes; the report's own depth stays
  const report = (frame ? inner.slice(frame[0].length) : inner)
    .split("\n").map((l) => l.replace(/^  /, "")).join("\n").trim();
  const lines = report === "" ? 0 : report.split("\n").length;
  return { who, text: report, note: lines > 1 ? `${lines} lines` : "" };
}

// the quiet line's tooltip: names what the line is — a report from inside this session, not a message
// from another one, and not the owner's words
export const AGENT_LINE_TITLE = "A subagent's report, handed back into this session — not your words";
