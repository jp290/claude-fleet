// The two byte loops that read a Claude transcript .jsonl, with a FIXED byte budget each.
// A leaf like every other module here: node globals only, never server.ts (the entry parser
// viewEntry is handed in by the caller).
//
// WHY A BYTE BUDGET (docs/messungen/2026-09-14-ram-optimierung-astra.md §F9, §Schnitte C4). Both
// readers used to scale with the FILE, not with what they need. server.ts#transcriptTail did
// readFileSync on the whole transcript and only then kept the last 300 lines; server.ts#tickHarvest
// allocated the whole growth since its cursor and concat'ed an unbounded partial line. Measured: the
// largest real transcript is 29 631 099 bytes with one line of 965 313 bytes, and its last 300 lines
// alone carry 14.7 MB — a LINE limit does not bound BYTES. Astra's Bun probe read backwards in 64 KiB
// blocks up to 1 MiB: footprint 93.77 → 34.19 MiB, byte-identical 30-line output. The same probe
// rejected re-decoding a growing tail (208 instead of 136 MiB), so bytes are collected first and
// decoded exactly once, after the cut.
//
// WHAT A CUT LOOKS LIKE. Neither reader may lose a region silently. The tail marks its cut as the
// FIRST line of its text, a position no entry can occupy (every rendered entry starts `[user` or
// `[assistant`). The harvester reports each discarded byte range in `dropped`; the caller surfaces it.
import { closeSync, fstatSync, openSync, readSync } from "node:fs";

export const TRANSCRIPT_TAIL_READ_BYTES = 1024 * 1024;  // the probe's budget, above the largest measured line
export const TRANSCRIPT_TAIL_BLOCK_BYTES = 64 * 1024;
export const TRANSCRIPT_TAIL_LINES = 300;               // the line window the reader always had
export const HARVEST_TICK_BYTES = 1024 * 1024;          // per slot, per tick
export const HARVEST_LINE_MAX_BYTES = 4 * 1024 * 1024;  // 4× the largest measured line; a longer one is dropped, marked

const NL = 0x0a;
const EMPTY = Buffer.alloc(0);

export interface TailCut { readBytes: number; fileBytes: number }
export interface TailLines { lines: string[]; cut: TailCut | null }

// every non-empty "\n"-segment that sits AFTER the first newline of `b` (the first segment's start is
// unknown while more file lies before it), plus the length of that first segment
function segmentsAfterFirst(b: Buffer): { firstLen: number; count: number; lastLen: number } | null {
  const first = b.indexOf(NL);
  if (first === -1) return null;
  let count = 0;
  let prev = first;
  for (let i = b.indexOf(NL, first + 1); i !== -1; i = b.indexOf(NL, i + 1)) {
    if (i - prev > 1) count++;
    prev = i;
  }
  return { firstLen: first, count, lastLen: b.length - prev - 1 };
}

// The last `maxLines` non-empty lines — exactly `readFileSync(file).split("\n").filter(Boolean)
// .slice(-maxLines)` — read BACKWARDS in blocks and never more than `budget` bytes. It stops as soon
// as the window holds `maxLines` whole lines, so a normal file costs a block or two. `cut` is null
// whenever the answer equals the whole-file one; it is set only when the budget ran out first.
export function readTranscriptTail(file: string, maxLines = TRANSCRIPT_TAIL_LINES,
  budget = TRANSCRIPT_TAIL_READ_BYTES, block = TRANSCRIPT_TAIL_BLOCK_BYTES): TailLines {
  const fd = openSync(file, "r");
  try {
    const size = fstatSync(fd).size;
    const blocks: Buffer[] = [];
    let pos = size;
    let total = 0;
    let firstLen = 0;   // bytes before the window's first newline (the head segment, start unknown)
    let known = 0;      // non-empty segments whose start IS known: everything after that head
    while (pos > 0 && total < budget && known < maxLines) {
      const len = Math.min(block, pos, budget - total);
      const b = Buffer.alloc(len);
      let got = 0;
      while (got < len) {
        const n = readSync(fd, b, got, len - got, pos - len + got);
        if (n === 0) throw new Error(`transcript shrank while its tail was read: ${file}`);
        got += n;
      }
      pos -= len;
      total += len;
      blocks.unshift(b);
      const seg = segmentsAfterFirst(b);
      if (!seg) firstLen += len;
      else {
        // b's last segment joins the old head segment into one whose start is now known
        known += seg.count + (seg.lastLen + firstLen > 0 ? 1 : 0);
        firstLen = seg.firstLen;
      }
    }
    const window = blocks.length === 1 ? blocks[0]! : Buffer.concat(blocks);
    // more file lies before the window: its head segment is a partial line, never an entry. A newline
    // byte is never inside a UTF-8 sequence, so the kept bytes start on a character boundary.
    const from = pos > 0 ? (window.indexOf(NL) === -1 ? window.length : window.indexOf(NL) + 1) : 0;
    const lines = window.subarray(from).toString("utf8").split("\n").filter(Boolean).slice(-maxLines);
    return { lines, cut: pos > 0 && known < maxLines ? { readBytes: total, fileBytes: size } : null };
  } finally {
    closeSync(fd);
  }
}

export const tailCutMark = (cut: TailCut): string =>
  `[fleet: transcript tail cut — only the last ${cut.readBytes} of ${cut.fileBytes} bytes were read; entries outside that window are omitted]`;

export interface TailBlock { t: string; text: string; name?: string }
export type TailView = (raw: unknown, n: number) => { role: string; blocks: TailBlock[] } | null;

// last `maxEntries` entries flattened to plain text, capped to the last `maxChars` characters. The cut
// mark is added AFTER the character cap, so the cap can never slice it away — and only when the budget
// actually cost entries: a window that still yields `maxEntries` renders exactly what the whole file did.
export function transcriptTailText(file: string, maxEntries: number, maxChars: number, view: TailView): string {
  const { lines, cut } = readTranscriptTail(file);
  const entries: { role: string; blocks: TailBlock[] }[] = [];
  for (const [i, line] of lines.entries()) {
    try {
      const e = view(JSON.parse(line), i);
      if (e) entries.push(e);
    } catch {
      // partial mid-append line — skip
    }
  }
  const text = entries.slice(-maxEntries).map((e) =>
    e.blocks.map((b) =>
      `[${e.role}${b.t === "text" ? "" : `/${b.t}${b.name ? `:${b.name}` : ""}`}] ${b.text}`,
    ).join("\n"),
  ).join("\n").slice(-maxChars);
  return cut && entries.length < maxEntries ? `${tailCutMark(cut)}\n${text}` : text;
}

// --- the harvester's cursor step ---------------------------------------------------------------------
// `skipping` > 0: the cursor is inside a line longer than HARVEST_LINE_MAX_BYTES and has discarded that
// many of its bytes so far; the range is reported once its newline arrives.
export interface HarvestCursor { file: string; offset: number; rest: Buffer; skipping: number }
export interface HarvestDrop { why: "oversized-line" | "rewritten"; bytes: number }
export interface HarvestStep { cursor: HarvestCursor; lines: string[]; dropped: HarvestDrop[] }

// One tick's read: at most `budget` bytes from the cursor, split into complete lines. Bytes are split on
// the newline BEFORE decoding, so a budget boundary inside a multi-byte character only moves that
// character into `rest`. `size` is the caller's stat and may already be stale: the offset advances by
// the bytes actually read, never by `size`, so a concurrent append or truncate costs nothing.
export function harvestStep(cur: HarvestCursor, size: number,
  budget = HARVEST_TICK_BYTES, lineMax = HARVEST_LINE_MAX_BYTES): HarvestStep {
  const dropped: HarvestDrop[] = [];
  let { offset, rest, skipping } = cur;
  if (size < offset) {
    // rewritten under the cursor — resync from 0; the unfinished line of the old file is gone
    if (rest.length + skipping > 0) dropped.push({ why: "rewritten", bytes: rest.length + skipping });
    offset = 0; rest = EMPTY; skipping = 0;
  }
  const want = Math.min(size - offset, budget);
  if (want <= 0) return { cursor: { ...cur, offset, rest, skipping }, lines: [], dropped };
  const buf = Buffer.alloc(want);
  const fd = openSync(cur.file, "r");
  let n: number;
  try {
    n = readSync(fd, buf, 0, want, offset);
  } finally {
    closeSync(fd);
  }
  offset += n;
  let chunk = buf.subarray(0, n);
  const lines: string[] = [];
  let nl: number;
  while ((nl = chunk.indexOf(NL)) !== -1) {
    if (skipping > 0) {
      dropped.push({ why: "oversized-line", bytes: skipping + nl });
      skipping = 0;
    } else if (rest.length + nl > lineMax) {
      dropped.push({ why: "oversized-line", bytes: rest.length + nl });
    } else {
      lines.push((rest.length ? Buffer.concat([rest, chunk.subarray(0, nl)]) : chunk.subarray(0, nl)).toString("utf8"));
    }
    rest = EMPTY;
    chunk = chunk.subarray(nl + 1);
  }
  if (skipping > 0) skipping += chunk.length;
  else if (rest.length + chunk.length > lineMax) { skipping = rest.length + chunk.length; rest = EMPTY; }
  // a copy either way — a subarray would pin the whole read buffer
  else if (chunk.length) rest = rest.length ? Buffer.concat([rest, chunk]) : Buffer.from(chunk);
  return { cursor: { file: cur.file, offset, rest, skipping }, lines, dropped };
}
