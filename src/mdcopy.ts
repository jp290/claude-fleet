// Copy as Markdown: the conversation view's selection and copy buttons hand out the SOURCE shape
// of what they show, not the browser's flattened text. The pattern is t3code's
// apps/web/src/markdown-clipboard.ts (serialize the rendered DOM back to Markdown on `copy`); the
// code below is written for src/md.ts's own element vocabulary and copies none of theirs.
//
// It only READS the DOM and emits a string for the clipboard — nothing here builds markup, and it
// sits outside src/md.ts so that file's §7 invariant (no Range, no parser) stays literal.

const SKIP = ".mmeta, .cbhead, .codelang, button, [data-nocopy]";

function fence(body: string): string {
  const run = Math.max(2, ...[...body.matchAll(/`+/g)].map((m) => m[0].length));
  return "`".repeat(run + 1);
}

function codeSpan(body: string): string {
  const run = Math.max(0, ...[...body.matchAll(/`+/g)].map((m) => m[0].length));
  const tick = "`".repeat(run + 1);
  return run ? `${tick} ${body} ${tick}` : `${tick}${body}${tick}`;
}

function inlineOf(n: Node): string {
  let out = "";
  for (const c of n.childNodes) out += inlineNode(c);
  return out;
}

function inlineNode(n: Node): string {
  if (n.nodeType === Node.TEXT_NODE) return n.textContent ?? "";
  if (!(n instanceof Element) || n.matches(SKIP)) return "";
  const tag = n.tagName.toLowerCase();
  if (tag === "code") return codeSpan(n.textContent ?? "");
  if (tag === "strong" || tag === "b") return `**${inlineOf(n)}**`;
  if (tag === "em" || tag === "i") return `*${inlineOf(n)}*`;
  if (tag === "s") return `~~${inlineOf(n)}~~`;
  if (tag === "a") {
    const label = inlineOf(n);
    const href = n.getAttribute("href") ?? "";
    return !href || href === label ? label : `[${label}](${href})`;
  }
  if (tag === "br") return "\n";
  return inlineOf(n);
}

const indent = (s: string, pad: string, first = pad): string =>
  s.split("\n").map((l, i) => (i === 0 ? first : l ? pad : "") + l).join("\n");

function listOf(n: Element): string {
  const ordered = n.tagName.toLowerCase() === "ol";
  let k = parseInt(n.getAttribute("start") ?? "1", 10) || 1;
  const items: string[] = [];
  for (const li of n.children) {
    if (li.tagName.toLowerCase() !== "li") continue;
    const marker = ordered ? `${k++}. ` : "- ";
    // a tight item holds inline content, a loose one holds blocks — blocksOf handles both
    const hasBlocks = [...li.children].some((c) => /^(p|div|ul|ol|blockquote|table|hr)$/i.test(c.tagName));
    const body = hasBlocks ? blocksOf(li) : inlineOf(li).trim();
    items.push(indent(body, " ".repeat(marker.length), marker));
  }
  return items.join("\n");
}

function tableOf(n: Element): string {
  const rows = [...n.querySelectorAll("tr")].map((tr) =>
    [...tr.children].map((c) => inlineOf(c).replace(/\|/g, "\\|").replace(/\n/g, " ").trim()));
  if (!rows.length) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const line = (r: string[]) => `| ${Array.from({ length: width }, (_, i) => r[i] ?? "").join(" | ")} |`;
  const head = n.querySelector("thead") ? 1 : 0;
  const out = rows.map(line);
  out.splice(head || 1, 0, `|${" --- |".repeat(width)}`);
  return out.join("\n");
}

function blockOf(n: Element): string | null {
  if (n.matches(SKIP)) return "";
  const tag = n.tagName.toLowerCase();
  const cls = n.classList;
  if (cls.contains("code") || tag === "pre") {
    const pre = tag === "pre" ? n : n.querySelector("pre");
    const body = (pre?.textContent ?? "").replace(/\n$/, "");
    const f = fence(body);
    return `${f}${n.getAttribute("data-lang") ?? ""}\n${body}\n${f}`;
  }
  const h = /\bmdh([1-6])\b/.exec(n.className);
  if (h) return `${"#".repeat(Number(h[1]))} ${inlineOf(n).trim()}`;
  if (tag === "p") return inlineOf(n);
  if (tag === "ul" || tag === "ol") return listOf(n);
  if (tag === "blockquote") return indent(blocksOf(n), "> ").replace(/^$/gm, ">");
  if (tag === "hr") return "---";
  if (tag === "table") return tableOf(n);
  if (tag === "summary") return inlineOf(n).trim();
  if (tag === "div" || tag === "details" || tag === "section" || tag === "li") return blocksOf(n);
  return null; // an inline element at block level — the caller folds it into the running paragraph
}

function blocksOf(n: Node): string {
  const parts: string[] = [];
  let run = "";
  const flush = () => { if (run.trim()) parts.push(run.trim()); run = ""; };
  for (const c of n.childNodes) {
    if (c.nodeType === Node.TEXT_NODE) { run += c.textContent ?? ""; continue; }
    if (!(c instanceof Element)) continue;
    const b = blockOf(c);
    if (b === null) { run += inlineNode(c); continue; }
    flush();
    if (b.trim()) parts.push(b);
  }
  flush();
  return parts.join("\n\n");
}

// The selection inside `root` as Markdown, or null when there is nothing of ours to serialize
// (then the browser's default copy stands). A selection that lives inside one code block copies
// as the code itself — nobody selecting three lines of a diff wants a fence around them.
export function selectionMarkdown(root: HTMLElement, sel: Selection | null): string | null {
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const anchor = range.commonAncestorContainer;
  const host = anchor instanceof Element ? anchor : anchor.parentElement;
  if (!host || !root.contains(host)) return null;
  if (host.closest("pre")) return sel.toString();
  const frag = range.cloneContents();
  // a selection inside one paragraph clones as bare inline nodes — serialize those as inline
  const inlineOnly = [...frag.childNodes].every((c) => c.nodeType === Node.TEXT_NODE
    || (c instanceof Element && blockOf(c) === null));
  const md = inlineOnly ? inlineOf(frag) : blocksOf(frag);
  return md.trim() ? md.replace(/\n{3,}/g, "\n\n").trim() : null;
}
