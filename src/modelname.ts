import { contextWindowFor } from "./protocol";

// A model id as a person reads it (owner, tenth cut: "wie Claude Code selbst" — "Opus 5 · 1M", not
// "claude-opus-5[1m]"). DISPLAY ONLY: the raw id stays the value that is staged, applied and
// shown in the tooltip. An id no rule below recognises comes back unchanged — a guessed name would
// be worse than the id.
//
// Eleventh cut (owner: the window behind EVERY model): the number is the window of THIS id, never
// of its family. First protocol.ts#contextWindowFor — the table the server divides the ctx chip by,
// so the label and the chip cannot disagree; it gives a bare claude-opus-5 its 200K, because
// Claude Code grants 1M only to the [1m] spelling ("append [1m] to the model name for 1M", a string
// in the installed 2.1.278 binary). Then the rows below, for ids that table does not name, each with
// its ground. GPT ids never take contextWindowFor's 258,400 — that is the USABLE share of the window
// (95 %) and matches every gpt-* by shape; a label shows the model's nominal window, and only for a
// slug Codex's own catalogue lists. No row, no number.
const DISPLAY_WINDOWS: Readonly<Record<string, number>> = {
  // claude-api skill model table (cached 2026-06-24): Haiku 4.5 = 200K, and it has no 1M variant
  "claude-haiku-4-5-20251001": 200_000,
  // server.ts#PI_ZAI_HARNESS injects contextWindow 1000000 for it; pi-ai's zai.json says the same
  "glm-5.3-flash": 1_000_000,
  // ~/.codex/models_cache.json fetched 2026-09-19: context_window 272000 for both slugs
  "gpt-5.6-sol": 272_000,
  "gpt-5.5": 272_000,
};
const isGpt = (id: string): boolean => /(?:^|\/)gpt-/i.test(id);

export function modelWindow(id: string): number | null {
  const raw = id.trim();
  if (!raw) return null;
  return DISPLAY_WINDOWS[raw] ?? (isGpt(raw) ? null : contextWindowFor(raw));
}
const fmtWindow = (n: number): string => (n % 1_000_000 === 0 ? `${n / 1_000_000}M` : `${Math.round(n / 1000)}K`);

const FAMILY: Record<string, string> = { opus: "Opus", sonnet: "Sonnet", haiku: "Haiku", fable: "Fable" };
const WORD: Record<string, string> = { gpt: "GPT", glm: "GLM" };
const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1);

export function modelLabel(id: string): string {
  const w = modelWindow(id);
  const name = modelName(id);
  return w === null ? name : `${name} · ${fmtWindow(w)}`;
}

function modelName(id: string): string {
  const raw = id.trim();
  // a provider prefix (pi-zai/glm-5.3) names where the model is served, not the model
  const bare = raw.includes("/") ? raw.slice(raw.lastIndexOf("/") + 1) : raw;
  // the [1m] suffix is a window, not part of the name — the window comes from modelWindow
  const ctx = /\[\w+\]$/.exec(bare);
  const base = ctx ? bare.slice(0, ctx.index) : bare;

  // claude-opus-5 · claude-fable-5-1 · claude-haiku-4-5-20251001 · the bare alias "opus"
  const claude = /^(?:claude-)?(opus|sonnet|haiku|fable)(?:-(\d+)(?:-(\d{1,2}))?)?(?:-\d{8})?$/.exec(base);
  if (claude) {
    const [, fam, major, minor] = claude;
    return `${FAMILY[fam]}${major ? ` ${major}${minor ? `.${minor}` : ""}` : ""}`;
  }
  // gpt-5.6-sol · gpt-5.3-codex-spark · glm-5.3-flash: the versioned head, then the words
  const vendor = /^(gpt|glm)-(\d+(?:\.\d+)*)((?:-[a-z]+)*)$/.exec(base);
  if (vendor) {
    const [, w, ver, rest] = vendor;
    const words = rest.split("-").filter(Boolean).map(cap);
    return [`${WORD[w]}-${ver}`, ...words].join(" ");
  }
  return raw;
}
