// THE LANE'S SOURCE PACKAGE — exact excerpts, from ONE immutable commit, of the symbols the
// effective brief actually names.
//
// WHAT IT IS NOT. It is not a second data layer beside the anchors and the notes: nothing is
// persisted here, nothing is registered, and no row is written. The anchor block says WHERE to look
// and copies no source; the notes block hands over what someone WROTE about a surface. Between them
// sat the measured cost this module answers: a lane whose brief names `server.ts#briefAndSend`
// still has to find it. The baseline (docs/messungen/opus-lane-kontextkosten-2026-09-12.md) counts a
// median of 52 Bash calls before the first PRODUCTIVE MARKER — the first `Edit`/`Write`/
// `NotebookEdit` or `git commit` — and for 153 of its 187 lanes that marker is the commit, so it is
// not "the first file change". That number is the cost this module aims at; that it lowers it is
// unmeasured until lanes have run with the block.
//
// TWO PHASES, AND THE SPLIT IS THE POINT. `planSnippets` is pure over the brief text plus the tree
// LISTING (paths and modes — what `git ls-tree -r` already yields at the delivery seam) and answers
// which few files may be read at all. Only then does the caller read those files, and
// `buildSnippetPackage` cuts the excerpts. A one-phase module would have had to hold the whole tree
// in memory to find one symbol; `server.ts` alone is ~1.5 MB at this commit, and reading it because
// a brief said "AUFTRAG" is the repo-wide load this shape structurally cannot perform.
//
// EVIDENCE DISCIPLINE. A path reaches phase 2 only as a tracked regular blob of this repo. Absolute
// paths, `..` escapes, symlinks and gitlinks (a symlink is the escape hatch a path check alone does
// not close), untracked/ignored files, the private overlay, and binary content each carry their own
// refusal reason — an unsupported source states its reason rather than rendering as an empty
// success. The same rule the omission ladder in context-plan.ts follows: the FIRST rule a candidate
// fails is the reason it is omitted.

/** ±this many lines of context around every hit, budget permitting. */
export const SNIPPET_CONTEXT_LINES = 20;
/** The whole additional block, labels included. UTF-8 bytes, never characters. */
export const SNIPPET_BLOCK_MAX_BYTES = 8192;
/** A single excerpt's ceiling in lines. A longer body is cut and SAYS it was cut. */
export const SNIPPET_HIT_MAX_LINES = 120;
/** Context sizes pass two tries, widest first. Never below what pass one already placed. */
export const SNIPPET_CONTEXT_LADDER = [SNIPPET_CONTEXT_LINES, 12, 6, 2] as const;
/** The omission line's own ceiling inside the block: a long list is cut and says how much it cut. */
export const SNIPPET_OMISSION_MAX_BYTES = 1024;

// Source kinds whose definitions this module can locate. Anything else is refused by name:
// "no snippet" and "nothing to snip here" are different facts and a reader must be able to tell.
const SUPPORTED_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"] as const;

// Tracked-but-private: the overlay and the operative state files are gitignored today, so the tree
// listing already omits them. The deny list stands anyway — it is the rule, not the side effect of
// a .gitignore that someone may edit, and a leaked overlay is not recoverable after delivery.
const PRIVATE_PATHS = ["CLAUDE.md", ".env", "fleet.json"] as const;
const PRIVATE_SUFFIXES = [".jsonl"] as const;

export const SNIPPET_OMISSION_REASONS = [
  "path-outside-repo",
  "not-tracked",
  "not-a-regular-file",
  "private-source",
  "unsupported-source",
  "binary-source",
  "source-unreadable",
  "symbol-not-found",
  "symbol-ambiguous",
  "budget-exhausted",
] as const;
export type SnippetOmissionReason = (typeof SNIPPET_OMISSION_REASONS)[number];

export interface SnippetRow {
  readonly id: string;
  readonly files?: readonly string[];
}

export interface SnippetRequest {
  /** The brief bytes as they will be delivered — the only place symbols are read from. */
  readonly briefText: string;
  /** The lane's rows, head first. Their file surface is where a BARE symbol may resolve. */
  readonly rows: readonly SnippetRow[];
  /** `git ls-tree -r <commit>`, parsed: repo-relative path → git mode. */
  readonly tracked: ReadonlyMap<string, string>;
  /** A clarify lane receives no package at all, for the exit footer's reason. */
  readonly clarify?: boolean;
}

/** One reference the brief made, after path gating and before the source is read. */
export interface SnippetRef {
  readonly symbol: string;
  /** The single path this ref may resolve in, or the candidate surface for a bare symbol. */
  readonly paths: readonly string[];
  /** `true` when the brief wrote `path#symbol` itself. */
  readonly qualified: boolean;
  /** Order of first mention in the brief — the whole determinism of the selection. */
  readonly at: number;
}

export interface SnippetOmission {
  /** `path#symbol` when a path is known, else the bare symbol — what the reader was promised. */
  readonly ref: string;
  readonly why: SnippetOmissionReason;
}

export interface SnippetPlan {
  readonly refs: readonly SnippetRef[];
  /** Exactly the paths phase 2 needs. Sorted, deduplicated; empty is a valid plan. */
  readonly reads: readonly string[];
  readonly omitted: readonly SnippetOmission[];
}

export interface SnippetFile {
  readonly path: string;
  /** `null` = the caller could not read it at that commit; it becomes `source-unreadable`. */
  readonly text: string | null;
  /** The git blob sha at the planned commit — the excerpt's actual source version. */
  readonly blob?: string | null;
}

export interface SnippetHit {
  readonly path: string;
  /** Every symbol whose span this excerpt covers, in selection order — merged ranges keep both. */
  readonly symbols: readonly string[];
  /** 1-based, inclusive, context included. */
  readonly from: number;
  readonly to: number;
  readonly text: string;
  readonly blob: string | null;
  /** The body hit the line ceiling and is cut — rendered as such, never as a whole symbol. */
  readonly incomplete: boolean;
  /** Context lines actually granted; below SNIPPET_CONTEXT_LINES the budget trimmed them. */
  readonly context: number;
  /** The lane rows whose surface holds this path. Attribution only a wave needs. */
  readonly taskIds: readonly string[];
}

export interface SnippetPackage {
  readonly shown: readonly SnippetHit[];
  readonly omitted: readonly SnippetOmission[];
  /** How many omissions the rendered line lists (in `orderedOmissions` order); the rest are counted. */
  readonly listed: number;
  /** UTF-8 bytes of the rendered block — 0 when nothing is delivered. */
  readonly bytes: number;
  /** The commit the excerpts were cut from; named in the block so the version is checkable. */
  readonly commit: string | null;
  /** Wave attribution. A single-task lane needs none and its block does not carry one. */
  readonly showTasks: boolean;
}

const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
// `path#symbol` — the repo's own reference convention since the 2026-08-25 promotion. A path token
// must carry an extension, so a `#` in prose cannot manufacture one.
// The leading `/` or `~` is CAPTURED, not skipped: dropping it turned `/etc/shadow.ts#x` into the
// relative `etc/shadow.ts` and the gate then answered `not-tracked` — true of that relative path and
// the wrong answer about the one the brief wrote. An escape must be refused AS an escape.
const QUALIFIED = /((?:[/~])?[A-Za-z0-9_@.][A-Za-z0-9_@./-]*\.[A-Za-z0-9]+)#([A-Za-z_$][A-Za-z0-9_$]*)/g;
// A bare symbol is recognised the two ways this repo's prose actually names one: in backticks, or
// by a lower→upper transition (`briefAndSend`, `ContextPlan`). An ALL-CAPS section heading has no
// such transition, which is why `AUFTRAG` and `DONE` never become candidates.
const BACKTICKED = /`([^`\n]{1,120})`/g;
const CAMEL = /\b([A-Za-z_$][A-Za-z0-9_$]*)\b/g;

const supported = (path: string): boolean =>
  SUPPORTED_EXTENSIONS.some((extension) => path.endsWith(extension));

const isPrivate = (path: string): boolean =>
  (PRIVATE_PATHS as readonly string[]).includes(path)
  || PRIVATE_SUFFIXES.some((suffix) => path.endsWith(suffix));

/**
 * Path-level gate, in ladder order. Returns the first failed rule or null.
 *
 * `mode` is git's own: `100644`/`100755` is a regular blob, `120000` a symlink, `160000` a
 * submodule. A symlink is refused HERE rather than at read time because the escape it enables is
 * invisible to any check on the path string.
 */
export function snippetPathRefusal(path: string, tracked: ReadonlyMap<string, string>): SnippetOmissionReason | null {
  if (path.startsWith("/") || path.startsWith("~")
    || path.split("/").some((segment) => segment === ".." || segment === "")) return "path-outside-repo";
  const mode = tracked.get(path);
  if (mode === undefined) return "not-tracked";
  if (!/^100[67][45][45]$/.test(mode)) return "not-a-regular-file";
  if (isPrivate(path)) return "private-source";
  if (!supported(path)) return "unsupported-source";
  return null;
}

const pushOmission = (into: SnippetOmission[], ref: string, why: SnippetOmissionReason): void => {
  if (!into.some((entry) => entry.ref === ref && entry.why === why)) into.push({ ref, why });
};

/**
 * Phase 1: which symbols the brief named, and which files may be opened to find them.
 *
 * The BARE surface is the lane's own rows — for a wave the union of all of them, under the one cap
 * the package shares, because a wave touches every one of those surfaces and joining per row would
 * multiply the byte budget the cap IS. A qualified reference brings its own path and is never
 * widened to the surface: the brief chose that file.
 */
export function planSnippets(request: SnippetRequest): SnippetPlan {
  if (request.clarify) return { refs: [], reads: [], omitted: [] };
  const text = request.briefText;
  const omitted: SnippetOmission[] = [];

  // the lane's named surface, gated once; a refused surface path is NOT reported as an omission —
  // nobody asked for a symbol in it yet, and a refusal nobody requested is noise.
  const surface = [...new Set(request.rows.flatMap((row) => row.files ?? []))].sort()
    .filter((path) => snippetPathRefusal(path, request.tracked) === null);

  const refs: SnippetRef[] = [];
  // Every symbol the brief QUALIFIED, refused paths included. A bare fallback must never resolve a
  // symbol whose file the brief already chose: `link.ts#alphaOne` is refused as a symlink, and
  // answering it with `alpha.ts#alphaOne` would deliver a different file's same-named symbol as if
  // it were the one asked for — "irgendeinen Treffer waehlen" with a correct-looking label.
  const qualifiedSymbols = new Set<string>();
  const seen = new Map<string, number>(); // "path#symbol" or "#symbol" → index in refs
  const add = (symbol: string, path: string | null, at: number): void => {
    const key = `${path ?? ""}#${symbol}`;
    if (seen.has(key)) return;
    if (path !== null) {
      const why = snippetPathRefusal(path, request.tracked);
      if (why) { pushOmission(omitted, key, why); seen.set(key, -1); return; }
    }
    seen.set(key, refs.length);
    refs.push({ symbol, paths: path !== null ? [path] : surface, qualified: path !== null, at });
  };

  for (const match of text.matchAll(QUALIFIED)) {
    qualifiedSymbols.add(match[2]!);
    add(match[2]!, match[1]!, match.index ?? 0);
  }
  for (const match of text.matchAll(BACKTICKED)) {
    const token = match[1]!.trim();
    if (identifier.test(token)) add(token, null, match.index ?? 0);
  }
  for (const match of text.matchAll(CAMEL)) {
    const token = match[1]!;
    if (/[a-z][A-Z]/.test(token)) add(token, null, match.index ?? 0);
  }

  // A bare symbol with no surface left to search is named as such, not silently dropped — unless the
  // brief also qualified it: that request already has its own answer, and the echo would list it twice.
  const usable = refs.filter((ref) => {
    if (ref.paths.length > 0) return true;
    if (!qualifiedSymbols.has(ref.symbol)) pushOmission(omitted, `#${ref.symbol}`, "symbol-not-found");
    return false;
  });
  // QUALIFIED FIRST, and only then the brief's order. The brief that wrote `context-plan.ts#planContext`
  // named a file; a camelCase token in a sentence is a guess about the same kind of thing. When the
  // budget cannot hold everything, the explicit choice is the one that must survive — measured on
  // this module's own brief, where ±20 context around two bare hits displaced both qualified refs.
  const ordered = [...usable]
    // …and a bare ref for a symbol the brief also qualified is the same request twice
    .filter((ref) => ref.qualified || !qualifiedSymbols.has(ref.symbol))
    .sort((a, b) => Number(b.qualified) - Number(a.qualified) || a.at - b.at
      || a.symbol.localeCompare(b.symbol));
  const reads = [...new Set(ordered.flatMap((ref) => ref.paths))].sort();
  return { refs: ordered, reads, omitted };
}

// The declaration forms this repo writes, with the NAME captured. Patterns only, never a parse.
// Form 2 is deliberately loose enough to match a call line as well; that costs nothing, because a
// symbol with more than one match is refused as ambiguous rather than guessed at either way.
const DEFINITION_FORMS = [
  /^\s*(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:function\s*\*?|class|interface|type|enum|const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/,
  /^\s*(?:(?:public|private|protected|static|readonly|async|get|set)\s+)*\*?\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:<[^>]*>)?\s*\(/,
  /^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*[:=]\s*(?:async\s*)?(?:function\b|\(|<)/,
] as const;

/**
 * Every declared name in `lines` → the 0-based lines declaring it.
 *
 * ONE PASS PER FILE, not one per symbol. Sixty tokens against four files including `server.ts`
 * (24k lines) cost 421 ms measured; the index is ~10 ms for the same work, and the old shape got
 * slower with every symbol a brief happened to mention. A dispatch seam is not the place for a cost
 * that grows with how chatty a brief is.
 */
export function definitionIndex(lines: readonly string[]): Map<string, number[]> {
  const index = new Map<string, number[]>();
  for (let i = 0; i < lines.length; i++) {
    for (const form of DEFINITION_FORMS) {
      const name = form.exec(lines[i]!)?.[1];
      if (!name) continue;
      const at = index.get(name);
      if (at) { if (at[at.length - 1] !== i) at.push(i); } else index.set(name, [i]);
    }
  }
  return index;
}

/** The lines defining one symbol. The index is the cheap path; this is the readable one. */
export function definitionLines(lines: readonly string[], symbol: string): number[] {
  return definitionIndex(lines).get(symbol) ?? [];
}

/**
 * The span of the construct starting at `start`, 0-based inclusive.
 *
 * THE HEAD LINE'S BRACKET BALANCE DECIDES WHAT KIND OF THING THIS IS, not its last character. A
 * multi-line signature's first line ends in a COMMA — `async function briefAndSend(next: Task,` —
 * and a rule that read the last character delivered that one line as a whole function, signature
 * without body, which is worse than delivering nothing.
 *
 * The CLOSER is then found by indentation, not by counting brackets onward: this repo's sources are
 * full of template literals carrying `{` and `}` (the exit footer itself is one), and a counter
 * walking through them closes a function dozens of lines early or never. A formatter's closing line
 * is the first later line at or left of the head's indentation that begins with a closing bracket —
 * unless that line itself opens the body (`): SnippetPackage {`), which is the multi-line signature
 * again and not an ending.
 */
export function symbolSpan(lines: readonly string[], start: number, maxLines = SNIPPET_HIT_MAX_LINES): { to: number; incomplete: boolean } {
  const code = (line: string): string => line.replace(/\/\/.*$/, "").trimEnd();
  const balance = (line: string): number => {
    let net = 0;
    for (const ch of code(line)) {
      if (ch === "(" || ch === "[" || ch === "{") net++;
      else if (ch === ")" || ch === "]" || ch === "}") net--;
    }
    return net;
  };
  const head = lines[start] ?? "";
  const headCode = code(head);
  const opens = balance(head) > 0;
  const continues = /(?:=>|=|&&|\|\||\?|:|\+|,)$/.test(headCode);
  if (!opens && !continues) return { to: start, incomplete: false };
  const indent = (head.match(/^\s*/)?.[0] ?? "").length;
  const ceiling = Math.min(lines.length - 1, start + maxLines - 1);
  for (let i = start + 1; i <= ceiling; i++) {
    const line = lines[i]!;
    if (!line.trim()) continue;
    const lead = (line.match(/^\s*/)?.[0] ?? "").length;
    const body = code(line);
    if (opens && lead <= indent && /^\s*[)}\]]/.test(line)) {
      if (/[{([]$/.test(body)) continue;    // `): T {` — the signature closed, the body opens
      return { to: i, incomplete: false };
    }
    // A statement that merely CONTINUED (a wrapped arrow, a wrapped type) ends at its semicolon.
    if (!opens && /;$/.test(body)) return { to: i, incomplete: false };
    // a sibling declaration at the same indentation means the construct ended on the line before
    if (lead <= indent && !/^\s*[.?:]/.test(line)
      && /^\s*(?:export|function|class|interface|type|enum|const|let|var|\/\/|\/\*)\b/.test(line))
      return { to: i - 1, incomplete: false };
  }
  return { to: ceiling, incomplete: ceiling < lines.length - 1 };
}

const byteLength = (text: string): number => new TextEncoder().encode(text).byteLength;

const labelFor = (hit: SnippetHit, showTasks: boolean): string => {
  const version = hit.blob ? ` · blob ${hit.blob.slice(0, 12)}` : " · Quellversion unbekannt";
  // The body was cut — by the line ceiling or by the half-block share. The label states the FACT
  // (it goes on) and not a reason it would sometimes get wrong.
  const cut = hit.incomplete ? " · GEKUERZT — das Symbol laeuft weiter" : "";
  const context = hit.context < SNIPPET_CONTEXT_LINES ? ` · ±${hit.context} Kontext` : "";
  const tasks = showTasks && hit.taskIds.length ? ` · zu ${hit.taskIds.join(", ")}` : "";
  return `- ${hit.path}#${hit.symbols.join("+")} · Zeilen ${hit.from}-${hit.to}`
    + `${version}${context}${cut}${tasks}`;
};

const renderHit = (hit: SnippetHit, showTasks: boolean): string =>
  `${labelFor(hit, showTasks)}\n\`\`\`\n${hit.text}\n\`\`\``;

/**
 * Phase 2: cut the excerpts under one byte budget.
 *
 * BUDGET RULE, stated because its opposite is the silent failure: a hit that does not fit is
 * omitted BY NAME and the loop continues, so a 4 KB function cannot displace three 300-byte ones
 * that come after it. Context lines are the first thing traded away (they are the cheap half of the
 * excerpt), and a trimmed hit says how much context it kept.
 */
export function buildSnippetPackage(
  plan: SnippetPlan, files: readonly SnippetFile[],
  opts?: { readonly maxBytes?: number; readonly rows?: readonly SnippetRow[]; readonly commit?: string | null },
): SnippetPackage {
  const maxBytes = opts?.maxBytes ?? SNIPPET_BLOCK_MAX_BYTES;
  const omitted: SnippetOmission[] = [...plan.omitted];
  const byPath = new Map(files.map((file) => [file.path, file]));
  const splitCache = new Map<string, string[]>();
  const indexCache = new Map<string, Map<string, number[]>>();
  const fileLines = (path: string): string[] => {
    const already = splitCache.get(path);
    if (already) return already;
    const lines = byPath.get(path)!.text!.split("\n");
    splitCache.set(path, lines);
    return lines;
  };
  const rows = opts?.rows ?? [];
  const showTasks = rows.length > 1;

  type Resolved = { path: string; symbol: string; start: number; to: number; incomplete: boolean };
  const resolved: Resolved[] = [];
  for (const ref of plan.refs) {
    const hits: Resolved[] = [];
    let unreadable = false;
    for (const path of ref.paths) {
      const file = byPath.get(path);
      if (!file) continue;                       // not read: a bare surface path phase 2 skipped
      if (file.text === null) { unreadable = true; continue; }
      if (file.text.includes(" ")) { pushOmission(omitted, path, "binary-source"); continue; }
      const lines = fileLines(path);
      let index = indexCache.get(path);
      if (!index) { index = definitionIndex(lines); indexCache.set(path, index); }
      for (const start of index.get(ref.symbol) ?? []) {
        const span = symbolSpan(lines, start);
        hits.push({ path, symbol: ref.symbol, start, to: span.to, incomplete: span.incomplete });
      }
    }
    const named = ref.qualified ? `${ref.paths[0]}#${ref.symbol}` : `#${ref.symbol}`;
    if (hits.length === 0) {
      // a bare symbol that matches nothing on the surface is prose, not a missing source: only a
      // reference the brief QUALIFIED is worth reporting as unfound.
      if (ref.qualified) pushOmission(omitted, named, unreadable ? "source-unreadable" : "symbol-not-found");
      continue;
    }
    if (hits.length > 1) { pushOmission(omitted, named, "symbol-ambiguous"); continue; }
    resolved.push(hits[0]!);
  }

  const commit = opts?.commit ?? null;
  const shown: SnippetHit[] = [];
  // THE BUDGET IS MEASURED ON THE RENDERED BLOCK, not on a sum of per-hit costs. The omission line
  // is part of the block, and a `budget-exhausted` entry LENGTHENS it — an accounting that ignored
  // that overshot 8192 by exactly the list of what it had already dropped.
  // The omission line is capped on its own, so a brief that names forty missing things cannot evict
  // the excerpts it did get — and cut, it still counts what it no longer names.
  const listCap = Math.min(SNIPPET_OMISSION_MAX_BYTES, maxBytes);
  const draft = (): SnippetPackage => ({ shown, omitted,
    listed: listedWithin(orderedOmissions(omitted), listCap), bytes: 0, commit, showTasks });
  const fits = (): boolean => byteLength(renderSnippetBlock(draft())) <= maxBytes;
  const linesOf = fileLines;
  const hitFor = (entry: Resolved, context: number, lastLine?: number): SnippetHit => {
    const lines = fileLines(entry.path);
    const from = Math.max(0, entry.start - context);
    const to = Math.min(lines.length - 1, lastLine ?? entry.to + context);
    return { path: entry.path, symbols: [entry.symbol], from: from + 1, to: to + 1,
      text: lines.slice(from, to + 1).join("\n"), blob: byPath.get(entry.path)!.blob ?? null,
      incomplete: entry.incomplete || to < entry.to, context,
      taskIds: rows.filter((row) => (row.files ?? []).includes(entry.path)).map((row) => row.id) };
  };
  // NO SINGLE HIT MAY TAKE MORE THAN HALF THE BLOCK. `briefAndSend` is 120 lines at its own line
  // ceiling — about 7 KB — and placing it whole leaves four symbols the same brief named with
  // nothing but a `budget-exhausted` line. A cut body still describes itself truthfully: `to` is the
  // last line actually shown and `incomplete` says so. A cut NEIGHBOUR cannot say anything at all,
  // because it is not there. The floor is the DEFINITION line: an excerpt that lost the line it is
  // named after would be a label about a place, pointing somewhere else.
  const share = Math.floor(maxBytes / 2);
  const clipped = (entry: Resolved, context: number): SnippetHit => {
    let hit = hitFor(entry, context);
    while (byteLength(renderHit(hit, showTasks)) > share && hit.to - 1 > entry.start) {
      const drop = Math.max(1, Math.floor((hit.to - 1 - entry.start) / 4));
      hit = hitFor(entry, context, hit.to - 1 - drop);
    }
    return hit;
  };

  // TWO PASSES, AND COVERAGE COMES FIRST. Pass one places every symbol at its cheapest — the body
  // alone — so whether a symbol the brief named appears at all never depends on how much context an
  // earlier hit happened to want. Only pass two spends what is left on context, in the same order.
  // Greedily taking ±20 up front cost two QUALIFIED refs on this module's own brief.
  for (const entry of resolved) {
    shown.push(clipped(entry, 0));
    if (fits()) continue;
    shown.pop();
    pushOmission(omitted, `${entry.path}#${entry.symbol}`, "budget-exhausted");
  }
  for (let i = 0; i < shown.length; i++) {
    // A hit whose BODY is already cut buys no context: twenty lines of the comment above a function
    // whose body stops mid-way is the budget spent on the wrong half of the excerpt.
    if (shown[i]!.incomplete) continue;
    const entry = resolved.find((candidate) => candidate.path === shown[i]!.path
      && candidate.symbol === shown[i]!.symbols[0])!;
    for (const context of SNIPPET_CONTEXT_LADDER) {
      const previous = shown[i]!;
      shown[i] = clipped(entry, context);
      if (fits()) break;
      shown[i] = previous;
    }
  }

  // …and ONLY NOW are overlaps merged, once every range is final. Merging before the context was
  // decided chained four symbols 210 lines apart into one entry, whose clipped excerpt then carried
  // a label naming three symbols it did not contain — a false statement about a source, which is the
  // one thing this module must never produce.
  // OVERLAP IS SYMMETRIC, and `shown` is in the brief's order, not the file's. Testing only
  // `later.from <= earlier.to + 1` fused `briefSourceOf` (9430-9447) into `briefAndSend`
  // (9460-9506) because the second range started EARLIER — and the union then delivered the twelve
  // lines between them that neither hit had selected, growing the block past its own cap.
  for (let i = shown.length - 1; i > 0; i--) {
    const later = shown[i]!;
    const into = shown.findIndex((earlier, index) => index < i && earlier.path === later.path
      && later.from <= earlier.to + 1 && earlier.from <= later.to + 1);
    if (into < 0) continue;
    const earlier = shown[into]!;
    const from = Math.min(earlier.from, later.from);
    const to = Math.max(earlier.to, later.to);
    shown[into] = { path: later.path, symbols: [...earlier.symbols, ...later.symbols],
      from, to, text: linesOf(later.path).slice(from - 1, to).join("\n"), blob: later.blob,
      incomplete: earlier.incomplete || later.incomplete,
      context: Math.min(earlier.context, later.context), taskIds: later.taskIds };
    shown.splice(i, 1);
  }
  // A drop LENGTHENS the omission line, so the last placements can be pushed back over the cap by
  // entries that came after them. Give the tail back, one hit at a time, each one named — the cap is
  // hard and the alternative is a block that states a budget it exceeds.
  while (shown.length > 0 && !fits()) {
    const dropped = shown.pop()!;
    pushOmission(omitted, `${dropped.path}#${dropped.symbols.join("+")}`, "budget-exhausted");
  }
  // With hits left the block fits (the loop above). With none, the header alone may still push the
  // omission line over a small cap: shorten the list until it fits, and below that deliver nothing.
  const final = draft();
  for (let listed = final.listed; listed >= 0; listed--) {
    const candidate = { ...final, listed };
    const bytes = byteLength(renderSnippetBlock(candidate));
    if (bytes <= maxBytes) return { ...candidate, bytes };
  }
  return { shown: [], omitted: [], listed: 0, bytes: 0, commit, showTasks };
}

// A bare token that resolved nowhere is the brief's PROSE, not a source it named: every camelCase
// word of a brief without a file surface lands there. Everything else — a qualified reference, a
// refused path, an ambiguous or unreadable source, a budget drop — is something the brief asked for.
const namedByBrief = (entry: SnippetOmission): boolean =>
  !(entry.ref.startsWith("#") && entry.why === "symbol-not-found");

/** Rendering order of the omission line: what the brief named first, prose tokens after. Stable. */
export const orderedOmissions = (omitted: readonly SnippetOmission[]): SnippetOmission[] =>
  [...omitted.filter(namedByBrief), ...omitted.filter((entry) => !namedByBrief(entry))];

const omissionLine = (ordered: readonly SnippetOmission[], listed: number): string => {
  const parts = ordered.slice(0, listed).map((entry) => `${entry.ref} (${entry.why})`);
  if (listed < ordered.length) parts.push(`… ${ordered.length - listed} weitere gekuerzt`);
  return `ausgelassen: ${parts.join(" · ")}`;
};

// The largest prefix whose line fits. Each entry adds more bytes than the shrinking "weitere" count
// can take away, so the first prefix that does not fit ends the search.
const listedWithin = (ordered: readonly SnippetOmission[], maxBytes: number): number => {
  let listed = 0;
  while (listed < ordered.length && byteLength(omissionLine(ordered, listed + 1)) <= maxBytes) listed++;
  return listed;
};

/**
 * The delivered block, or the empty string — which is what keeps a dispatch with nothing to say
 * byte-identical to every dispatch before this module existed.
 *
 * A block with NO excerpt still renders when the brief explicitly named a source that could not be
 * delivered (missing, ambiguous, refused, binary, unreadable, over budget): a lane told nothing
 * would go looking for exactly that source. A brief whose only misses are prose tokens, or that
 * named no symbol at all, renders nothing.
 */
export function renderSnippetBlock(pkg: SnippetPackage): string {
  const ordered = orderedOmissions(pkg.omitted);
  if (pkg.shown.length === 0 && !ordered.some(namedByBrief)) return "";
  const at = pkg.commit ? ` aus ${pkg.commit.slice(0, 12)}` : "";
  const lines = [pkg.shown.length > 0
    ? `Quellpaket — exakte Ausschnitte${at} (deterministisch gewaehlt; Zeilennummern sind die dieses Stands):`
    : `Quellpaket — kein Ausschnitt${at}; im Brief genannt, aber nicht geliefert:`];
  for (const hit of pkg.shown) lines.push(renderHit(hit, pkg.showTasks));
  if (ordered.length > 0) lines.push(omissionLine(ordered, Math.min(pkg.listed, ordered.length)));
  return `\n\n${lines.join("\n")}`;
}

export interface SnippetReceipt {
  /** UTF-8 bytes of the delivered block — 0 exactly when `renderSnippetBlock` delivers nothing. */
  readonly bytes: number;
  /** Excerpts shown; a merged range covering two symbols is one. */
  readonly hits: number;
  /** What the brief NAMED and did not get, in rendering order — prose tokens are not a request. */
  readonly omitted: readonly SnippetOmission[];
}

/**
 * The receipt's account of the source package, derived from the SAME package the block is rendered
 * from — so a row reads 0/0/[] exactly when the brief carried no block, never when it merely had
 * nothing to show.
 */
export function snippetReceipt(pkg: SnippetPackage): SnippetReceipt {
  const block = renderSnippetBlock(pkg);
  if (block === "") return { bytes: 0, hits: 0, omitted: [] };
  return { bytes: byteLength(block), hits: pkg.shown.length,
    omitted: orderedOmissions(pkg.omitted).filter(namedByBrief).map((entry) => ({ ref: entry.ref, why: entry.why })) };
}
