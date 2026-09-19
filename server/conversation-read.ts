// The conversation view for the two harnesses that write no Claude Code transcript: codex (its
// rollout JSONL) and pi (its session JSONL). A leaf like transcript-read.ts: pure functions over the
// file's lines, no server.ts, no filesystem — the caller finds the file by IDENTITY
// (server.ts#codexContextFile / #piContextFile / #piZaiContextFile, never newest-by-mtime) and hands
// the lines in. Formats measured in docs/messungen/2026-09-19-codex-pi-composer-anbindung.md §8.
//
// Both produce the entry shape server.ts#viewEntry produces for Claude, so the client renders all
// three with one code path. `n` is the 1-based LINE number, exactly as for Claude: the client's
// incremental `after` is a line count.

export interface TBlock { t: "text" | "thinking" | "tool" | "tool_result"; text: string; name?: string }
// meta: a harness-injected user turn — real content, not typed by the owner (folded in the view)
export interface TEntry { n: number; role: "user" | "assistant"; ts: string | null; blocks: TBlock[]; meta?: boolean }

// the cache counter's reference: when the newest model REQUEST ran, and against which provider
// (the client maps the provider to its measured TTL — src/client.ts#cacheTtlFor)
export interface CacheRef { at: number; provider: string }
export interface ConversationRead {
  entries: TEntry[];
  // a key that changes when already-served lines stop being the conversation (pi: the leaf moved
  // to another branch of the tree). Empty for a linear file.
  branch: string;
  cache: CacheRef | null;
  // lines the reader could use: a torn LAST line (mid-append) is left out so the next poll re-reads it
  total: number;
}

const trim = (t: string, max: number) => (t.length > max ? t.slice(0, max) + ` … [+${t.length - max} chars]` : t);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function parseLines(lines: string[]): { rows: (Record<string, unknown> | null)[]; total: number } {
  const rows: (Record<string, unknown> | null)[] = [];
  for (let i = 0; i < lines.length; i++) {
    try {
      const j = JSON.parse(lines[i]) as unknown;
      rows.push(typeof j === "object" && j !== null ? (j as Record<string, unknown>) : null);
    } catch {
      // only the final line may be a partial mid-append — stop there; a torn line mid-file is skipped
      if (i === lines.length - 1) return { rows, total: i };
      rows.push(null);
    }
  }
  return { rows, total: lines.length };
}

// --- codex rollout ------------------------------------------------------------------------------
// response_item rows carry the conversation: payload.type "message" with role user/assistant/
// developer, content input_text/output_text; tool calls as function_call / custom_tool_call and
// their *_output. developer rows and the user rows codex INJECTS (AGENTS.md, <environment_context>,
// <skills_instructions> …) are not the owner's words and are dropped. The cache reference is the
// newest token_usage_record (one per model response, the measurement note's row 6).
const CODEX_INJECTED = /^(# AGENTS\.md instructions|<[a-z_]+>)/;

export function readCodexRollout(lines: string[]): ConversationRead {
  const { rows, total } = parseLines(lines);
  const entries: TEntry[] = [];
  let cache: CacheRef | null = null;
  rows.forEach((row, i) => {
    if (!row) return;
    const ts = str(row.timestamp) || null;
    if (row.type === "token_usage_record") {
      const at = ts ? Date.parse(ts) : NaN;
      if (Number.isFinite(at)) cache = { at, provider: "openai" };
      return;
    }
    if (row.type !== "response_item") return;
    const p = (row.payload ?? {}) as Record<string, unknown>;
    const n = i + 1;
    if (p.type === "message") {
      if (p.role !== "user" && p.role !== "assistant") return;
      const text = Array.isArray(p.content)
        ? p.content.map((c) => str((c as { text?: unknown }).text)).filter(Boolean).join("\n")
        : "";
      if (!text) return;
      if (p.role === "user" && CODEX_INJECTED.test(text)) return;
      entries.push({ n, role: p.role, ts, blocks: [{ t: "text", text: trim(text, p.role === "user" ? 20_000 : 40_000) }] });
    } else if (p.type === "reasoning") {
      const text = Array.isArray(p.summary)
        ? p.summary.map((s) => str((s as { text?: unknown }).text)).filter(Boolean).join("\n") : "";
      if (text) entries.push({ n, role: "assistant", ts, blocks: [{ t: "thinking", text: trim(text, 10_000) }] });
    } else if (p.type === "function_call" || p.type === "custom_tool_call") {
      const args = p.type === "function_call" ? str(p.arguments) : str(p.input);
      entries.push({ n, role: "assistant", ts, blocks: [{ t: "tool", name: str(p.name) || "tool", text: trim(args, 600) }] });
    } else if (p.type === "function_call_output" || p.type === "custom_tool_call_output") {
      const o = p.output;
      const text = typeof o === "string" ? o : JSON.stringify(o ?? "");
      entries.push({ n, role: "assistant", ts, blocks: [{ t: "tool_result", text: trim(text, 3000) }] });
    }
  });
  return { entries, branch: "", cache, total };
}

// --- pi session ---------------------------------------------------------------------------------
// A TREE (id/parentId), not a log: /tree and /fork leave abandoned branches in the same file. The
// conversation is the path from the NEWEST entry (the leaf pi appends under) back to the root; only
// entries on that path are shown. Roles: user / assistant (text, thinking, toolCall) / toolResult.
// The cache reference is the newest assistant message on the path: its message.timestamp (Unix ms)
// is set when the request STARTS (measurement note, row 6), and its provider names the TTL.
export function readPiSession(lines: string[]): ConversationRead {
  const { rows, total } = parseLines(lines);
  const parent = new Map<string, string | null>();
  const children = new Map<string, number>();
  let leaf: string | null = null;
  for (const row of rows) {
    const id = str(row?.id);
    if (!row || !id || row.type === "session") continue;
    const pid = str(row.parentId) || null;
    parent.set(id, pid);
    if (pid) children.set(pid, (children.get(pid) ?? 0) + 1);
    leaf = id;
  }
  const onPath = new Set<string>();
  // deepest fork on the path, with the child the path takes — a branch switch changes it,
  // a plain append never does
  let branch = "";
  for (let id = leaf, below: string | null = null; id && !onPath.has(id); below = id, id = parent.get(id) ?? null) {
    onPath.add(id);
    if (!branch && below && (children.get(id) ?? 0) > 1) branch = `${id}>${below}`;
  }
  const entries: TEntry[] = [];
  let cache: CacheRef | null = null;
  rows.forEach((row, i) => {
    if (!row || row.type !== "message" || !onPath.has(str(row.id))) return;
    const m = (row.message ?? {}) as Record<string, unknown>;
    const ts = str(row.timestamp) || null;
    const n = i + 1;
    const content = m.content;
    const parts = typeof content === "string" ? [{ type: "text", text: content }]
      : Array.isArray(content) ? (content as Record<string, unknown>[]) : [];
    if (m.role === "user") {
      const text = parts.map((b) => (b.type === "text" ? str(b.text) : "")).filter(Boolean).join("\n");
      if (text) entries.push({ n, role: "user", ts, blocks: [{ t: "text", text: trim(text, 20_000) }] });
    } else if (m.role === "assistant") {
      const blocks: TBlock[] = [];
      for (const b of parts) {
        if (b.type === "text" && str(b.text)) blocks.push({ t: "text", text: trim(str(b.text), 40_000) });
        else if (b.type === "thinking" && str(b.thinking)) blocks.push({ t: "thinking", text: trim(str(b.thinking), 10_000) });
        else if (b.type === "toolCall")
          blocks.push({ t: "tool", name: str(b.name) || "tool", text: trim(JSON.stringify(b.arguments ?? {}), 600) });
      }
      if (blocks.length) entries.push({ n, role: "assistant", ts, blocks });
      const at = typeof m.timestamp === "number" ? m.timestamp : ts ? Date.parse(ts) : NaN;
      if (Number.isFinite(at)) cache = { at, provider: str(m.provider) };
    } else if (m.role === "toolResult") {
      const text = parts.map((b) => (b.type === "text" ? str(b.text) : "")).filter(Boolean).join("\n");
      entries.push({ n, role: "assistant", ts, blocks: [{ t: "tool_result", text: trim(text, 3000) }] });
    }
  });
  return { entries, branch, cache, total };
}
