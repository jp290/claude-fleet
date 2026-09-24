// Is a stream increment NOTHING BUT window-title updates? Pure so the fixtures in e2e/slots.ts pin
// it byte for byte; server.ts#poll wires it to the activity stamp. Measured 2026-09-24 on a codex
// MAIN whose own request_user_input waited for an answer: the pane was static for over an hour, but
// the stream grew ~240 B every 3 s with `ESC ]0;[.] Action Required | … BEL` alternating with `[!]`,
// and each such tick refreshed `lastOutput` — the board read "running" on a session that was waiting.
//
// A title update is OSC 0, 1 or 2: `ESC ] Ps ; text` ended by BEL or by ST (`ESC \`). An increment
// is title-only when EVERY byte in it is DEFINITELY part of one. The carry is the scanner position
// at the increment's end, so a sequence cut by a read boundary is still recognised in the next one.
// Undecided counts as activity: an increment that ends where the sequence's kind is not known yet
// (a lone ESC, `ESC ]`, `ESC ]0` before its `;`, an ESC inside the title before its `\`) is never
// title-only — the next increment decides, and the only cost is one refresh too many, i.e. today.
export type TitleCarry = "text" | "esc" | "ps" | "psDigit" | "title" | "titleEsc";

const ESC = 0x1b;
const BEL = 0x07;

export function scanTitleOnly(bytes: Uint8Array, carry: TitleCarry): { titleOnly: boolean; carry: TitleCarry } {
  let state = carry;
  let other = false;
  for (const b of bytes) {
    switch (state) {
      case "text":
        if (b === ESC) state = "esc";
        else other = true;
        break;
      case "esc":
        if (b === 0x5d) state = "ps"; // ]
        else { other = true; state = "text"; }
        break;
      case "ps":
        if (b >= 0x30 && b <= 0x32) state = "psDigit"; // 0 1 2
        else { other = true; state = b === ESC ? "esc" : "text"; }
        break;
      case "psDigit":
        if (b === 0x3b) state = "title"; // ;
        else { other = true; state = b === ESC ? "esc" : "text"; }
        break;
      case "title":
        if (b === BEL) state = "text";
        else if (b === ESC) state = "titleEsc";
        break;
      case "titleEsc":
        // anything but `\` after ESC aborts the OSC; that byte starts ordinary output again
        if (b === 0x5c) state = "text";
        else { other = true; state = b === ESC ? "esc" : "text"; }
        break;
    }
  }
  // the carried bytes before this increment were already judged; what stays open at its end is not
  const settled = state === "text" || state === "title";
  return { titleOnly: bytes.length > 0 && !other && settled, carry: state };
}
