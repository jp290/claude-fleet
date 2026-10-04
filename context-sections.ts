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
  const start = lines.findIndex((line) => !line.code && line.text.trimStart().startsWith(anchor));
  if (start < 0) return null;
  const first = lines[start]!;
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
