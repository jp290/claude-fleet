// The pure half of ACP-25: what a harness's rendered composer currently holds, read off one
// `tmux capture-pane -p -e` frame. Pure so the three measured frames (2026-08-22, claude 2.1.240,
// codex-cli 0.147.0, pi 0.84.0) can be pinned deterministically in the suite; server.ts wires it to
// the pane. The forms and their evidence are documented at Harness.composer in server.ts.
export type ComposerForm = { kind: "glyph"; re: RegExp } | { kind: "rules" };

const SGR_RE = /\x1b\[[0-9;?]*[A-Za-z]/g;
const RULE_RE = /^─{8,}$/;
// What a human sees as CONTENT on one raw line: SGR state is tracked, and text painted while the
// dim attribute (param 2 — `\e[2m`, `\e[1;2m`, also `\e[2m\e[39m…`) is on is dropped until a reset
// (0, 22 or bare `\e[m`). That is the measured placeholder/hint form in Claude ("Try …", "Press up
// to edit queued messages") and Codex ("Summarize recent commits"); typed or pasted text is never dim.
const rendered = (raw: string): string => {
  let out = "";
  let dim = false;
  let reverse = false;
  let i = 0;
  const append = (part: string) => {
    if (!dim && !(reverse && /^\s*$/.test(part))) out += part;
  };
  for (const m of raw.matchAll(/\x1b\[([0-9;?]*)([A-Za-z])/g)) {
    append(raw.slice(i, m.index));
    i = (m.index ?? 0) + m[0].length;
    if (m[2] !== "m") continue;
    const params = m[1] === "" ? ["0"] : m[1].split(";");
    if (params.includes("2")) dim = true;
    if (params.includes("7")) reverse = true;
    if (params.includes("0")) { dim = false; reverse = false; }
    if (params.includes("22")) dim = false;
    if (params.includes("27")) reverse = false;
  }
  append(raw.slice(i));
  return out;
};
// ACP-25's residue reader predates exact rollback and intentionally normalizes the prompt's NBSP.
// ACP-26 uses rendered() directly so an owner NBSP can never compare equal to Fleet's ordinary space.
const visible = (raw: string): string => rendered(raw).replace(/\u00a0/g, " ");

// "" = the composer is on screen and empty · text = its residue · null = no composer on this frame.
export function composerResidue(form: ComposerForm, frame: string): string | null {
  const raw = frame.split("\n");
  const plain = raw.map((l) => l.replace(SGR_RE, ""));
  if (form.kind === "glyph") {
    let i = plain.length - 1;
    while (i >= 0 && !form.re.test(plain[i])) i--;
    if (i < 0) return null;
    return visible(raw[i]).replace(form.re, "").trim();
  }
  const rules: number[] = [];
  plain.forEach((l, i) => { if (RULE_RE.test(l.trim())) rules.push(i); });
  if (rules.length < 2) return null;
  const [top, bottom] = rules.slice(-2);
  return raw.slice(top + 1, bottom).map(visible).join("\n").trim();
}

// The exact-region half of ACP-26. Unlike composerResidue, this reader does NOT trim content:
// rollback is allowed to compare Fleet's complete payload only, so an owner byte before or after
// it must remain visible as a difference. Measured on claude 2.1.240 and codex-cli 0.147.0, glyph
// composers reserve one cell after the glyph and two cells on each visual continuation row. Pi
// 0.84.0 has no glyph or continuation chrome; its complete input is between the last two rules.
// A glyph region ends at the first empty row (Codex's mention popup is below it) or a rule.
// null means this frame does not expose the declared composer at all.
export function composerRows(form: ComposerForm, frame: string): string[] | null {
  const raw = frame.split("\n");
  const plain = raw.map((l) => l.replace(SGR_RE, ""));
  if (form.kind === "rules") {
    const rules: number[] = [];
    plain.forEach((l, i) => { if (RULE_RE.test(l.trim())) rules.push(i); });
    if (rules.length < 2) return null;
    const [top, bottom] = rules.slice(-2);
    return raw.slice(top + 1, bottom).map(rendered);
  }

  let i = plain.length - 1;
  while (i >= 0 && !form.re.test(plain[i])) i--;
  if (i < 0) return null;
  const first = rendered(raw[i]).replace(form.re, "");
  // The measured glyph forms always own exactly one separator cell (Claude paints NBSP, Codex a
  // normal space). Refusing an unknown rendering is safer than guessing where owner content starts.
  if (!(first.startsWith(" ") || first.startsWith("\u00a0"))) return null;
  const rows = [first.slice(1)];
  for (let j = i + 1; j < raw.length; j++) {
    const t = plain[j].trim();
    if (RULE_RE.test(t)) break;
    if (t === "") {
      // Codex places one blank row between the composer and its status / `$`-mention overlay. An
      // owner can also insert a blank input row. Treat the suffix as chrome only when EVERY
      // nonblank row has one of the two measured overlay forms or the measured model/effort/status
      // form; any other text below the blank makes the composer unobservable and forbids erase.
      const chrome = plain.slice(j + 1).map((line) => line.trim()).filter(Boolean);
      const known = (line: string): boolean => line === "no matches"
        || line === "Press enter to insert or esc to close"
        || /^\S+ (?:minimal|low|medium|high|xhigh|max|ultra) · \S/.test(line);
      if (!chrome.every(known)) return null;
      break;
    }
    const row = rendered(raw[j]);
    if (!row.startsWith("  ")) return null;
    rows.push(row.slice(2));
  }
  return rows;
}

// The TUI can omit exactly one payload separator (a space or a newline) where it lays one logical
// input across visual rows. Reconstruct against the KNOWN payload rather than joining heuristically:
// every displayed byte must occur in order, every omitted boundary must be a payload byte, and the
// walk must consume the whole payload. Appended, prepended, edited, placeholder or extra-whitespace
// content therefore fails. The erased count still comes from the original payload because those
// omitted separators remain characters in the TUI's input buffer.
export function composerHoldsExactly(rows: readonly string[], payload: string): boolean {
  if (payload.length === 0 || rows.length === 0) return false;
  const walk = (i: number, pos: number): boolean => {
    if (i === rows.length) return pos === payload.length;
    if (!payload.startsWith(rows[i], pos)) return false;
    const next = pos + rows[i].length;
    if (i === rows.length - 1) return next === payload.length;
    if (walk(i + 1, next)) return true;
    const separator = payload[next];
    return (separator === " " || separator === "\n") && walk(i + 1, next + 1);
  };
  return walk(0, 0);
}
