// A model id as a person reads it (owner, tenth cut: "wie Claude Code selbst" — "Opus 5 · 1M", not
// "claude-opus-5[1m]"). DISPLAY ONLY: the raw id stays the value that is staged, applied and
// shown in the tooltip. An id no rule below recognises comes back unchanged — a guessed name would
// be worse than the id.

const FAMILY: Record<string, string> = { opus: "Opus", sonnet: "Sonnet", haiku: "Haiku", fable: "Fable" };
const WORD: Record<string, string> = { gpt: "GPT", glm: "GLM" };
const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1);

export function modelLabel(id: string): string {
  const raw = id.trim();
  // a provider prefix (pi-zai/glm-5.3) names where the model is served, not the model
  const bare = raw.includes("/") ? raw.slice(raw.lastIndexOf("/") + 1) : raw;
  const ctx = /\[(\d+)([km])\]$/i.exec(bare);
  const base = ctx ? bare.slice(0, ctx.index) : bare;
  const window = ctx ? ` · ${ctx[1]}${ctx[2].toUpperCase()}` : "";

  // claude-opus-5 · claude-fable-5-1 · claude-haiku-4-5-20251001 · the bare alias "opus"
  const claude = /^(?:claude-)?(opus|sonnet|haiku|fable)(?:-(\d+)(?:-(\d{1,2}))?)?(?:-\d{8})?$/.exec(base);
  if (claude) {
    const [, fam, major, minor] = claude;
    return `${FAMILY[fam]}${major ? ` ${major}${minor ? `.${minor}` : ""}` : ""}${window}`;
  }
  // gpt-5.6-sol · gpt-5.3-codex-spark · glm-5.3-flash: the versioned head, then the words
  const vendor = /^(gpt|glm)-(\d+(?:\.\d+)*)((?:-[a-z]+)*)$/.exec(base);
  if (vendor) {
    const [, w, ver, rest] = vendor;
    const words = rest.split("-").filter(Boolean).map(cap);
    return [`${WORD[w]}-${ver}`, ...words].join(" ") + window;
  }
  return raw;
}
