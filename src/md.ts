// The shared markdown renderer of the owner chat view and the guest reader.
//
// THE INVARIANT THIS FILE EXISTS TO KEEP IS NOT "render markdown" — it is that transcript text is
// hostile input on both surfaces, so not one byte of it may ever become markup. Every node below
// is built with createElement; every character of the source lands in a textContent, or in an
// href that passed safeHref(). There is no innerHTML, no DOMParser, no Range, no template — and
// that is asserted as a property of THIS SOURCE by fleet-e2e-security.ts §7, which is the only
// reason a real renderer is allowed to live here at all. A structure that cannot be expressed by
// building a node is not a feature we want.
//
// Until 2026-09-11 the whole file was 22 lines: ``` fences became a code block and EVERYTHING else
// was dumped into one <pre>. That was safe and unreadable — headings, lists, tables and inline
// code all arrived as flat grey text.
//
// The grammar is deliberately a SUBSET. Two omissions are decisions, not gaps:
//   * `_` never emphasises. This transcript text is full of snake_case identifiers and file paths,
//     and CommonMark's word-boundary rules for `_` need lookbehind, which Safari only learned in
//     16.4 — a regex literal that fails to parse takes the whole bundle down, not just this call.
//   * Raw HTML in the source stays literal text. It is the invariant, seen from the other side.
// Single newlines inside a paragraph survive as newlines (the CSS gives .mdp `pre-wrap`): agent
// text uses them to mean something, and collapsing them the way a document renderer would loses it.

// A href is the one place where source text reaches something other than a textContent, so the
// test is an allowlist and not a blocklist: http(s), mailto, in-page and site-absolute. Control
// characters and whitespace are stripped FIRST — "java\nscript:x" is a working javascript: URL in
// some parsers — and a protocol-relative "//host" is rejected with everything else it isn't. The
// stripped range is U+0000-U+0020 and U+007F and is NOT meant as the complete set of characters a
// parser might ignore: U+00A0, U+200B and U+FEFF survive it on purpose, because surviving means the
// allowlist no longer matches and the href is DISCARDED. The omission fails safe; widening the strip
// would be the change that could stop failing safe, so it needs a reason, not a reflex.
const SAFE_HREF = /^(?:https?:\/\/|mailto:[^\s]|\/(?!\/)|#)/i;

function safeHref(raw: string): string | null {
  const url = raw.replace(/[\u0000-\u0020\u007f]/g, "");
  return url && SAFE_HREF.test(url) ? url : null;
}

function node(tag: string, cls: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// --- entities --------------------------------------------------------------------------
// The owner view makes task ids and slot numbers hoverable. The renderer only MARKS them — a span
// with data-ent/data-id and the matched source as its textContent — and only for ids the caller
// confirms exist; what a hover shows is the caller's business. Unset (the guest reader, §7b), the
// text path below is the plain createTextNode it always was. Module state rather than a parameter
// threaded through every recursion: mdInto is synchronous, so the hook cannot leak across calls.
export type MdEntityKind = "task" | "slot" | "program" | "sha" | "file" | "attention" | "report" | "event" | "lane";
export interface MdOpts { entity?: (kind: MdEntityKind, id: string) => boolean }
let entityOk: MdOpts["entity"] | null = null;

// Full 24-hex ids name programs, attentions, reports or events; 8-hex ids also name task rows,
// program prefixes and observed commit prefixes. The caller resolves the kind and rejects unknown
// ids, so a matching shape alone never earns a card.
const ENT = /\b([0-9a-f]{24}|[0-9a-f]{7,12})\b|\b([Ss]lots?\s*#?)(\d{1,3}(?:\s*[/,+&]\s*#?\d{1,3})*)\b|\b(\d{1,3}[A-Z])\b/g;
const FILE_REF = /\b((?:[\w.-]+\/)*[\w.-]+\.[A-Za-z][\w-]*(?::\d+(?:-\d+)?|#[A-Za-z_$][\w.$-]*))\b/g;

export function entityMatches(s: string, ok: (kind: MdEntityKind, id: string) => boolean):
  { kind: MdEntityKind; id: string; start: number; end: number }[] {
  const found: { kind: MdEntityKind; id: string; start: number; end: number }[] = [];
  for (const m of s.matchAll(FILE_REF)) {
    const start = m.index ?? 0, id = m[1];
    if (id && ok("file", id)) found.push({ kind: "file", id, start, end: start + id.length });
  }
  for (const m of s.matchAll(ENT)) {
    const start = m.index ?? 0;
    if (found.some((f) => start >= f.start && start < f.end)) continue;
    if (m[1]) {
      const id = m[1];
      const kind = id.length === 24
        ? (["program", "attention", "report", "event"] as const).find((k) => ok(k, id)) ?? null
        : id.length === 8 && ok("task", id) ? "task"
        : id.length === 8 && ok("program", id) ? "program" : ok("sha", id) ? "sha" : null;
      if (kind) found.push({ kind, id, start, end: start + id.length });
    } else if (m[2]) {
      let pos = start + m[2].length;
      for (const part of m[3].split(/(\d+)/)) {
        if (/^\d+$/.test(part) && ok("slot", part)) found.push({ kind: "slot", id: part, start: pos, end: pos + part.length });
        pos += part.length;
      }
    } else if (m[4] && ok("lane", m[4])) found.push({ kind: "lane", id: m[4], start, end: start + m[4].length });
  }
  return found.sort((a, b) => a.start - b.start);
}

function entity(kind: MdEntityKind, id: string, text: string): HTMLElement {
  const e = node("span", `ent ent-${kind}`, text);
  e.setAttribute("data-ent", kind);
  e.setAttribute("data-id", id);
  e.setAttribute("tabindex", "0");
  return e;
}

function text(target: HTMLElement, s: string): void {
  const ok = entityOk;
  if (!ok) { target.appendChild(document.createTextNode(s)); return; }
  let at = 0;
  const put = (upto: number): void => {
    if (upto > at) target.appendChild(document.createTextNode(s.slice(at, upto)));
  };
  for (const m of entityMatches(s, ok)) {
    put(m.start);
    target.appendChild(entity(m.kind, m.id, s.slice(m.start, m.end)));
    at = m.end;
  }
  put(s.length);
}

// --- inline spans ------------------------------------------------------------------------
// One left-to-right scan, alternatives in precedence order: a code span wins over everything
// inside it, `**` is tried before `*`. Emphasis recurses, so `**bold `code`**` nests correctly;
// recursion terminates because the captured content is always strictly shorter than its match.
const INLINE = new RegExp([
  "(`+)([\\s\\S]*?)\\1",                 // 1,2  `code`, ``code with ` inside``
  "\\*\\*([\\s\\S]+?)\\*\\*",            // 3    **bold**
  "~~([\\s\\S]+?)~~",                    // 4    ~~strike~~
  "\\*([^\\s*][^*\\n]*?)\\*",            // 5    *italic* — single line, never around whitespace
  "\\[([^\\]\\n]*)\\]\\(([^()\\s]+)\\)", // 6,7  [text](url)
  "(https?://[^\\s<>()\\[\\]]+)",        // 8    bare url
].join("|"), "g");

function inline(target: HTMLElement, src: string): void {
  let at = 0;
  for (const m of src.matchAll(INLINE)) {
    const i = m.index ?? 0;
    if (i < at) continue; // an earlier alternative already consumed this span
    if (i > at) text(target, src.slice(at, i));
    at = i + m[0].length;
    if (m[2] !== undefined) {
      const body = m[2].replace(/^ (.*) $/, "$1");
      const code = node("code", "mdcode", body);
      // a code span that IS a known id (`0617cf27`) is the most common way an agent writes one —
      // same kind chain as the plain-text path, unknown stays a plain code span
      const hex = /^[0-9a-f]{7,12}$/.test(body) ? body : null;
      const kind = hex && entityOk
        ? (hex.length === 8 && entityOk("task", hex) ? "task"
          : hex.length === 8 && entityOk("program", hex) ? "program"
          : entityOk("sha", hex) ? "sha" : null)
        : null;
      const file = entityMatches(body, entityOk ?? (() => false)).find((x) => x.kind === "file" && x.start === 0 && x.end === body.length);
      if ((hex && kind) || file) {
        code.className = `mdcode ent ent-${kind ?? "file"}`;
        code.setAttribute("data-ent", kind ?? "file");
        code.setAttribute("data-id", hex && kind ? hex : body);
        code.setAttribute("tabindex", "0");
      }
      target.appendChild(code);
    } else if (m[3] !== undefined) {
      const b = node("strong", "");
      inline(b, m[3]);
      target.appendChild(b);
    } else if (m[4] !== undefined) {
      const s = node("s", "");
      inline(s, m[4]);
      target.appendChild(s);
    } else if (m[5] !== undefined) {
      const e = node("em", "");
      inline(e, m[5]);
      target.appendChild(e);
    } else if (m[7] !== undefined) {
      const href = safeHref(m[7]);
      if (href) {
        const a = node("a", "mdlink");
        a.setAttribute("href", href);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
        inline(a, m[6] || m[7]);
        target.appendChild(a);
      } else {
        // an unsafe scheme is not an error to swallow: show the source as the text it is
        target.appendChild(document.createTextNode(m[0]));
      }
    } else if (m[8] !== undefined) {
      // trailing punctuation belongs to the sentence, not to the url
      const url = m[8].replace(/[.,;:!?'")\]]+$/, "");
      at = i + url.length;
      const href = safeHref(url);
      if (href) {
        const a = node("a", "mdlink", url);
        a.setAttribute("href", href);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
        target.appendChild(a);
      } else {
        target.appendChild(document.createTextNode(url));
      }
    }
  }
  if (at < src.length) text(target, src.slice(at));
}

// --- block grammar -----------------------------------------------------------------------
const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)\s*$/;
const HEAD = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const HR = /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/;
const QUOTE = /^ {0,3}>\s?(.*)$/;
const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const TROW = /\|/;
const TDELIM = /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*:?-*:?\s*$/;

const indentOf = (line: string): number => /^\s*/.exec(line)?.[0].length ?? 0;
const starts = (line: string): boolean =>
  FENCE.test(line) || HEAD.test(line) || HR.test(line) || QUOTE.test(line) || ITEM.test(line);

const cells = (line: string): string[] =>
  line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());

function blocks(target: HTMLElement, lines: string[]): void {
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line.trim()) { i++; continue; }

    const fence = FENCE.exec(line);
    if (fence) {
      const closer = new RegExp(`^ {0,3}\\${fence[1][0]}{${fence[1].length},}\\s*$`);
      const body: string[] = [];
      i++;
      while (i < lines.length && !closer.test(lines[i] ?? "")) { body.push(lines[i] ?? ""); i++; }
      i++; // the closing fence, or the end of input for an unterminated block
      const wrap = node("div", "code");
      if (fence[2]) wrap.setAttribute("data-lang", fence[2]);
      if (fence[2]) wrap.appendChild(node("div", "codelang", fence[2]));
      wrap.appendChild(node("pre", "", body.join("\n")));
      target.appendChild(wrap);
      continue;
    }

    const head = HEAD.exec(line);
    if (head) {
      const h = node("div", `mdh mdh${head[1].length}`);
      inline(h, head[2]);
      target.appendChild(h);
      i++;
      continue;
    }

    if (HR.test(line)) { target.appendChild(node("hr", "mdhr")); i++; continue; }

    if (QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length) {
        const q = QUOTE.exec(lines[i] ?? "");
        if (q) { inner.push(q[1]); i++; continue; }
        if ((lines[i] ?? "").trim() && !starts(lines[i] ?? "")) { inner.push(lines[i] ?? ""); i++; continue; }
        break;
      }
      const bq = node("blockquote", "mdq");
      blocks(bq, inner);
      target.appendChild(bq);
      continue;
    }

    const item = ITEM.exec(line);
    if (item) { i = list(target, lines, i, item); continue; }

    // a table is the header row PLUS its delimiter — a lone pipe line is prose
    if (TROW.test(line) && TDELIM.test(lines[i + 1] ?? "") && cells(line).length > 1) {
      i = table(target, lines, i);
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && (lines[i] ?? "").trim() && !starts(lines[i] ?? "")) {
      if (TROW.test(lines[i] ?? "") && TDELIM.test(lines[i + 1] ?? "")) break;
      para.push(lines[i] ?? "");
      i++;
    }
    if (!para.length) { para.push(lines[i] ?? ""); i++; } // a line only `starts` could claim
    const p = node("p", "mdp");
    inline(p, para.join("\n"));
    target.appendChild(p);
  }
}

// A list runs until a line that is neither an item nor indented under one. Continuation lines are
// dedented to the item's content column and re-parsed, which is what makes nesting, fences and
// paragraphs inside a list item work without a second grammar.
function list(target: HTMLElement, lines: string[], from: number, first: RegExpExecArray): number {
  const ordered = /\d/.test(first[2]);
  const base = first[1].length;
  const cut = base + first[2].length + 1;
  const box = node(ordered ? "ol" : "ul", ordered ? "mdol" : "mdul");
  if (ordered) {
    const n = parseInt(first[2], 10);
    if (n !== 1) box.setAttribute("start", String(n));
  }
  let buf: string[] | null = null;
  const flush = (): void => {
    if (!buf) return;
    const li = node("li", "");
    // a tight item is inline text; anything with a blank line or a nested construct is blocks
    if (buf.every((l) => l.trim() !== "") && !buf.some((l, k) => k > 0 && starts(l))) {
      inline(li, buf.join("\n"));
    } else {
      blocks(li, buf);
    }
    box.appendChild(li);
    buf = null;
  };
  let i = from;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const m = ITEM.exec(line);
    if (m && m[1].length <= base + 1 && /\d/.test(m[2]) === ordered) {
      flush();
      buf = [m[3]];
      i++;
      continue;
    }
    if (!buf) break;
    if (!line.trim()) {
      const next = lines[i + 1] ?? "";
      if (!next.trim() || (!ITEM.test(next) && indentOf(next) < cut)) break; // the list ended
      buf.push("");
      i++;
      continue;
    }
    if (m || indentOf(line) >= cut) { buf.push(line.slice(Math.min(indentOf(line), cut))); i++; continue; }
    if (starts(line)) break;
    buf.push(line.trim()); // lazy continuation of the item's own paragraph
    i++;
  }
  flush();
  target.appendChild(box);
  return i;
}

function table(target: HTMLElement, lines: string[], from: number): number {
  const head = cells(lines[from] ?? "");
  const align = cells(lines[from + 1] ?? "").map((c) =>
    c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : "");
  const tbl = node("table", "mdtable");
  const thead = node("thead", "");
  const headRow = node("tr", "");
  head.forEach((c, k) => {
    const th = node("th", "");
    if (align[k]) th.style.textAlign = align[k];
    inline(th, c);
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  tbl.appendChild(thead);
  const tbody = node("tbody", "");
  let i = from + 2;
  while (i < lines.length && (lines[i] ?? "").trim() && TROW.test(lines[i] ?? "")) {
    const row = node("tr", "");
    cells(lines[i] ?? "").forEach((c, k) => {
      const td = node("td", "");
      if (align[k]) td.style.textAlign = align[k];
      inline(td, c);
      row.appendChild(td);
    });
    tbody.appendChild(row);
    i++;
  }
  tbl.appendChild(tbody);
  target.appendChild(tbl);
  return i;
}

export function mdInto(target: HTMLElement, text: string, opts: MdOpts = {}): void {
  entityOk = opts.entity ?? null;
  try {
    blocks(target, text.replace(/\r\n?/g, "\n").split("\n"));
  } finally {
    entityOk = null;
  }
}
