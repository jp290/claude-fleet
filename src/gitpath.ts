// git path decoding, kept out of client.ts so it can be unit-tested without a DOM
// (e2e/explorer.ts calls gitUnquote/porcelainPath directly).

// --- GITPATH: git's two path shapes, decoded once, at the one boundary that matters -----------
//
// Git hands this client paths in two shapes and the difference is invisible until a click misses.
// `git status --porcelain`, `git diff --name-status` and the `diff --git` header all QUOTE a path
// the moment it holds a space or a byte above ASCII; `git ls-files -z` (the explorer tree) never
// does. Measured on 2026-08-20:
//     ?? "untracked file.txt"                          ← a SPACE is enough
//      M "umlaut-\303\244\303\266\303\274.txt"         ← \NNN is an octal BYTE, not a character
//     R  "old name.txt" -> "new name.txt"              ← a rename names both sides
//     diff --git "a/umlaut-\303\244….txt" "b/umlaut-\303\244….txt"   ← prefix INSIDE the quotes
// Every file row here turns such a line into a REQUEST PATH, so the decode belongs at that
// boundary, once: an undecoded `"untracked file.txt"` asks the server for a file whose name really
// does begin with a quote, and gets "no such file" — which reads to the owner as "that file is
// gone". Both producers (porcelain rows, diff headers) go through this ONE decoder on purpose:
// a file pick matches a diff file by string equality, so two half-decodes would miss each other.
//
// Pure, and kept clear of the DOM/localStorage lines below it: the e2e suite has no DOM harness,
// so it cuts this block out and runs it for real (e2e/explorer.ts) — same method as pollPlan above.
const GITPATH_ESCAPES: Record<string, number> = {
  a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '"': 34, "\\": 92,
};
export function gitUnquote(s: string): string {
  if (s.length < 2 || !s.startsWith('"') || !s.endsWith('"')) return s;
  const body = s.slice(1, -1);
  const enc = new TextEncoder();
  const bytes: number[] = [];
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c !== "\\") { for (const b of enc.encode(c)) bytes.push(b); continue; }
    const n = body[++i];
    if (n === undefined) break;
    if (n >= "0" && n <= "7") { bytes.push(parseInt(body.slice(i, i + 3), 8) & 0xff); i += 2; continue; }
    const known = GITPATH_ESCAPES[n];
    if (known !== undefined) bytes.push(known);
    else for (const b of enc.encode(n)) bytes.push(b);
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}
// One porcelain-shaped row → the path the reader means. The rename ARROW is only read when the
// status code actually says rename/copy: a file may legitimately be NAMED `a -> b`, and git does
// not quote it for that, so splitting on the arrow unconditionally would invent a path.
export function porcelainPath(line: string): string {
  const rest = line.slice(3);
  if (line[0] === "R" || line[0] === "C") {
    const arrow = rest.indexOf(" -> ");
    // a rename means the file that EXISTS now — the old name is history, and nothing can open it
    if (arrow >= 0) return gitUnquote(rest.slice(arrow + 4));
  }
  return gitUnquote(rest);
}
