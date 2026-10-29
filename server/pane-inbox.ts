// THE PANE INBOX, READ BACK FOR THE VIEW (brief 2026-10-29). A composer send above server.ts#
// PASTE_MAX_BYTES is never pasted: server.ts#storePaneInboxText stores the text whole under
// streams/pane-inbox/slot<N>-<openedAt>/<sha16>.txt and the pane gets ONE pointer line naming
// file, bytes and sha256. The session keeps exactly that line — this leaf changes nothing it
// receives. The VIEWS (chat, export, tails, the queue read-back) show the owner's words again by
// reading the stored file back, so a long send retires its "wartet" bubble like any other
// (src/pendingsend.ts#pendingSettledBy) and stands as the owner's bubble after a reload too.
//
// Content-addressed on both ends: the file the line names IS the text that was sent. A file gone
// (cleanup, another host) or a byte count that no longer matches leaves the pointer line as it
// stands — the view then says exactly what the session got, never a guessed text.
import { readFileSync } from "node:fs";
import { deliveryHeaderPrefixOf } from "../src/delivery-format";
import { unwrapPasted } from "../src/pendingsend";

// the line exactly as server.ts#storePaneInboxText writes it, with the optional bundle notice
// appended as " <notice>"; one line, the file path carries no spaces
const POINTER_RE =
  /^\[fleet\] message ([0-9a-f]{16}): (\d+) bytes \(sha256 ([0-9a-f]{64})\) is too long to paste into a terminal, so it was stored whole\. Read the complete text from (\S+) before acting on it\.(?: .*)?$/;
// the only shape a pointer may name: a file directly inside this inbox dir, for a slot occupant,
// named by the first 16 hex of the sha256 the line carries
const NAME_RE = /^slot\d+-\d+\/([0-9a-f]{16})\.txt$/;

export interface PaneInboxPointer { file: string; bytes: number; sha256: string }

// `line` is the BARE body of a turn (no delivery head, no pasted envelope): the pointer it names,
// or null. The path is validated against `dir` (the server's PANE_INBOX_DIR) so a transcript line
// can never make the view read a file outside the pane inbox.
export function paneInboxPointer(line: string, dir: string): PaneInboxPointer | null {
  const m = POINTER_RE.exec(line);
  if (!m) return null;
  const [, sha16, bytesText, sha256, file] = m as unknown as [string, string, string, string, string];
  if (!file.startsWith(`${dir}/`)) return null;
  const name = NAME_RE.exec(file.slice(dir.length + 1));
  if (!name || name[1] !== sha16 || !sha256.startsWith(sha16)) return null;
  const bytes = Number(bytesText);
  if (!Number.isSafeInteger(bytes) || bytes <= 0) return null;
  return { file, bytes, sha256 };
}

// The whole turn as the views show it: if the text (a pasted envelope allowed, a Fleet delivery
// head allowed) is exactly one pointer line, the stored text takes its place — the head rides
// along verbatim, so the bubble and its provenance stay as they are. null = no pointer, unchanged.
export function expandPaneInboxText(text: string, dir: string): string | null {
  const bare = unwrapPasted(text);
  // the head stays byte for byte what was typed (splitDeliveryHeader's logic, the prefix kept:
  // transcripts before 2026-10-25 carry the German "[fleet-zustellung · …]" spelling)
  let head = "", body = bare;
  const prefix = deliveryHeaderPrefixOf(bare);
  if (prefix !== null) {
    const end = bare.indexOf("] ", prefix.length);
    if (end < 0) return null;
    head = bare.slice(0, end + 2);
    body = bare.slice(end + 2).replace(/^\s*\n/, "");
  }
  const p = paneInboxPointer(body, dir);
  if (!p) return null;
  let stored: string;
  try { stored = readFileSync(p.file, "utf8"); } catch { return null; }
  // the line's byte count is the send's own measurement (storePaneInboxText): a file that no
  // longer matches it is not this send's text
  if (Buffer.byteLength(stored, "utf8") !== p.bytes) return null;
  return head + stored;
}
