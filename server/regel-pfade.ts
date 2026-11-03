// A RULE FILE WITH `paths:` IN ITS HEAD loads only when Claude reads a matching file (code.claude.com/docs/en/memory). One reading for the server and the window
// (server.ts#nativeLoaderBytes, src/start-brief.ts), so the window says what the server does. It runs in the browser too, so no YAML package: it reads what real Claude Code measurably
// reads (`claude -p`, Auftrag 9). The head stands at the file's start, after a BOM at most, and ends at the first `---` line; `paths` is a key of its top level, however indented; and it
// names something: no value, `[]`, `~`, `null`, `""` and a bare `**` load at the start.
const einzug = (z: string): number => z.length - z.trimStart().length;
const nennt = (wert: string): boolean => wert.replace(/^\[|\]$/g, "").split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""))
  .some((p) => p && p !== "**" && p !== "~" && p !== "null");
export const nurBeiPfaden = (text: string): boolean => {
  const kopf = /^\uFEFF?---[ \t]*\r?\n((?:[^\n]*\n)*?)---/.exec(text);
  const zeilen = (kopf?.[1] ?? "").split(/\r?\n/).filter((z) => z.trim() && !z.trimStart().startsWith("#"));
  const at = zeilen.findIndex((z) => einzug(z) === einzug(zeilen[0]!) && /^\s*paths\s*:/.test(z));
  if (at < 0) return false;
  const wert = zeilen[at]!.slice(zeilen[at]!.indexOf(":") + 1).replace(/(^|\s)#.*$/, "").trim();
  if (wert) return nennt(wert);
  const liste = zeilen.slice(at + 1);
  const ende = liste.findIndex((z) => !/^\s*-(\s|$)/.test(z));
  return (ende < 0 ? liste : liste.slice(0, ende)).some((z) => nennt(z.trim().slice(1)));
};
