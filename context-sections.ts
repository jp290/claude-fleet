// context-sections.ts — exact source sections shared by borrowing and session rendering.
import { createHash } from "node:crypto";

function sectionSpan(text: string, path: string, anchor: string): { start: number; end: number } | null {
  const markdown = /\.(md|markdown)$/i.test(path);
  const lines = [...text.matchAll(/[^\n]+\n?|\n/g)].map((match) => ({
    text: match[0].replace(/\r?\n$/, ""), offset: match.index, level: 0, code: false,
  }));
  let fence: { char: string; length: number } | null = null;
  if (markdown) for (const [index, line] of lines.entries()) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line.text);
    if (fence) {
      line.code = true;
      if (marker && marker[1]![0] === fence.char && marker[1]!.length >= fence.length && !marker[2]!.trim()) fence = null;
      continue;
    }
    if (marker && (marker[1]![0] !== "`" || !marker[2]!.includes("`"))) {
      fence = { char: marker[1]![0]!, length: marker[1]!.length }; line.code = true; continue;
    }
    if (/^(?: {4}|\t)/.test(line.text)) { line.code = true; continue; }
    line.level = /^ {0,3}(#{1,6})(?:[ \t]+|$)/.exec(line.text)?.[1]?.length ?? 0;
    const previous = lines[index - 1];
    if (/^ {0,3}(?:=+|-+)[ \t]*$/.test(line.text) && previous?.text.trim() && !previous.code && !previous.level)
      previous.level = line.text.trimStart()[0] === "=" ? 1 : 2;
  }
  const exact = lines.flatMap((line, index) => !line.code && line.text.trimStart() === anchor ? [index] : []);
  const matches = exact.length ? exact
    : lines.flatMap((line, index) => !line.code && line.text.trimStart().startsWith(anchor) ? [index] : []);
  if (matches.length > 1) {
    const error = new Error(`more than one line in ${path} matches anchor ${JSON.stringify(anchor)}`);
    error.name = "source-anchor-ambiguous";
    throw error;
  }
  const start = matches[0] ?? -1;
  if (start < 0) return null;
  const first = lines[start]!;
  if (!markdown) {
    // Code sections end before the next top-level declaration.
    // Lexical tokens keep declarations inside comments, literals and bodies out of the cut.
    const tokens = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\/(?:\\[^\n]|\[(?:\\[^\n]|[^\]\\\n])*\]|[^/\\\n])+\/[dgimsuvy]*|[A-Za-z_$][\w$]*|[^\s]/g;
    const declaration = /^(?:(?:export|default|declare|abstract|async)\s+)*(?:const|let|var|function|class|interface|type|enum|namespace|import)\b/;
    let depth = 0;
    let previous = "";
    let lineIndex = 0;
    let template = false;
    const interpolations: number[] = [];
    while (tokens.lastIndex < text.length) {
      if (template) {
        let offset = tokens.lastIndex;
        for (; offset < text.length; offset++) {
          if (text[offset] === "\\") { offset++; continue; }
          if (text[offset] === "`") { template = false; previous = "`"; offset++; break; }
          if (text[offset] === "$" && text[offset + 1] === "{") {
            interpolations.push(++depth);
            template = false; previous = "{"; offset += 2; break;
          }
        }
        tokens.lastIndex = offset;
        continue;
      }
      const token = tokens.exec(text);
      if (!token) break;
      const offset = token.index;
      while (lineIndex + 1 < lines.length && lines[lineIndex + 1]!.offset <= offset) lineIndex++;
      const line = lines[lineIndex]!;
      const head = line.offset + line.text.length - line.text.trimStart().length;
      if (lineIndex > start && offset === head && depth === 0 && declaration.test(line.text.trimStart()))
        return { start: first.offset, end: line.offset };
      const value = token[0];
      if (value.startsWith("//") || value.startsWith("/*")) continue;
      if (value.startsWith("/") && value.length > 1
        && !/^(?:|[=(:,!&|?;{}\[\]]|return|throw|case|yield|await)$/.test(previous)) {
        // A slash after an operand is division; rescan its contents as code.
        tokens.lastIndex = offset + 1;
        previous = "/";
        continue;
      }
      if (/^[({\[]$/.test(value)) depth++;
      else if (/^[)}\]]$/.test(value)) {
        if (value === "}" && interpolations.at(-1) === depth) { interpolations.pop(); template = true; }
        depth--;
      } else if (value === "`") template = true;
      previous = value;
    }
    return { start: first.offset, end: text.length };
  }
  const next = markdown ? lines.slice(start + 1).find((line) => line.level > 0 && (!first.level || line.level <= first.level)) : undefined;
  return { start: first.offset, end: next?.offset ?? text.length };
}

export function sectionAt(text: string, path: string, anchor: string): string | null {
  const span = sectionSpan(text, path, anchor);
  return span ? text.slice(span.start, span.end) : null;
}

export function sourceSection(text: string, path: string, anchor: string) {
  const span = sectionSpan(text, path, anchor);
  if (!span) return null;
  const content = text.slice(span.start, span.end);
  return { path, anchor, content, ...span,
    sha256: createHash("sha256").update(content).digest("hex"), bytes: Buffer.byteLength(content) };
}
