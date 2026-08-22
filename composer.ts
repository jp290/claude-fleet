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
const visible = (raw: string): string => {
  let out = "";
  let dim = false;
  let i = 0;
  for (const m of raw.matchAll(/\x1b\[([0-9;?]*)([A-Za-z])/g)) {
    if (!dim) out += raw.slice(i, m.index);
    i = (m.index ?? 0) + m[0].length;
    if (m[2] !== "m") continue;
    const params = m[1] === "" ? ["0"] : m[1].split(";");
    if (params.includes("2")) dim = true;
    if (params.includes("0") || params.includes("22")) dim = false;
  }
  if (!dim) out += raw.slice(i);
  return out.replace(/\u00a0/g, " ");
};

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
