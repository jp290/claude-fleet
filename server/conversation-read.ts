// The conversation view for the two harnesses that write no Claude Code transcript: codex (its
// rollout JSONL) and pi (its session JSONL). A leaf like transcript-read.ts: pure functions over the
// file's lines, no server.ts, no filesystem — the caller finds the file by IDENTITY
// (server.ts#codexContextFile / #piContextFile / #piZaiContextFile, never newest-by-mtime) and hands
// the lines in. Formats measured in docs/messungen/2026-09-19-codex-pi-composer-anbindung.md §8.
//
// Both produce the entry shape server.ts#viewEntry produces for Claude, so the client renders all
// three with one code path. `n` is the 1-based LINE number, exactly as for Claude: the client's
// incremental `after` is a line count.

// id: the tool_use id an assistant block carries; ref: the tool_use_id a tool_result answers —
// the pair is how the chat view can show a subagent call as RUNNING until its result lands
// (without them, pairing stays positional as it always was; codex/pi blocks carry none)
export interface TBlock { t: "text" | "thinking" | "tool" | "tool_result"; text: string; name?: string;
  id?: string; ref?: string;
  // owner transcript routes only (row 1e01b4f3): a native Claude Code AskUserQuestion call, typed
  // from the ORIGINAL input — never from the 600-char `text` — and whether it is bound to the
  // terminal of the confirmed current occupant; on its tool_result, the typed answer
  ask?: NativeAsk; terminal?: Binding; answer?: NativeAnswer }
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
  // the model the newest request ran on, as the file names it (codex turn_context, pi assistant
  // message) — the composer shows it where the slot record names none
  model: string | null;
  // the reasoning effort the session runs at, as the file names it (codex turn_context `effort`, pi
  // its newest thinking_level_change on the path) — null when the file names none, and then the
  // composer says "default" rather than guess
  effort: string | null;
  // lines the reader could use: a torn LAST line (mid-append) is left out so the next poll re-reads it
  total: number;
}

// --- native Claude Code questions (row 1e01b4f3) -----------------------------------------------
// ONE original is measured: Claude Code 2.1.286, a single-select call, already answered. The call is
// an assistant tool_use named AskUserQuestion whose input is exactly {questions: [{question, header,
// multiSelect, options: [{label, description}]}]}. Its answer rides on the user line that carries the
// tool_result (tool_use_id = the call's id), as that LINE's top-level `toolUseResult`: {questions —
// the call's questions again, answers — keyed by the question TEXT, a single-select value is the
// chosen option's label, annotations — {}}. Multi-select and free-text answers, `preview`/
// `metadata` fields and non-empty annotations are UNMEASURED: they classify as `unsupported`, never
// as a guessed form. Codex and pi questions are unmeasured too — their readers above classify none.
export const ASK_TOOL = "AskUserQuestion";
// a typed form longer than this (its JSON) is answered `clipped` with its size and NO questions — a
// cut question or option would be an invented one
export const ASK_MAX = 20_000;
export interface AskOption { label: string; description: string }
export interface AskQuestion { question: string; header: string; multiSelect: boolean; options: AskOption[] }
export type NativeAsk =
  | { state: "complete"; questions: AskQuestion[] }
  | { state: "clipped"; chars: number; limit: number }
  | { state: "invalid" | "unsupported"; reason: string };
// `question`/`option` index the CALL's questions and that question's options, found by the answer's
// key (the question text) and value (the label) — never by position
export type NativeAnswer =
  | { state: "answered"; answers: { question: number; form: "single"; option: number; label: string }[] }
  | { state: "clipped"; chars: number; limit: number }
  | { state: "invalid" | "unsupported"; reason: string };
// whether something read from a transcript may be treated as the CURRENT occupant's terminal state.
// `none` always names why; it is the default, and `current` only follows from server-side identity
export type Binding = { state: "current" } | { state: "none"; reason: string };
export interface Occupant { slot: number; openedAt: number }
// where the served conversation came from: the session id that names its file, and the occupant
// that is RECORDED for it — null when no record proves one (an adopted pane's newest file, a past
// session whose record names none). `via` says which identity found the file.
export interface TranscriptOrigin { sessionId: string | null; occupant: Occupant | null;
  via: "pinned" | "newest-file" | "succession-record" | "harness-file" | null }
export interface NativeTranscript { questions: "claude-code" | "unsupported"; origin: TranscriptOrigin; binding: Binding }

type Parsed<T> = { ok: T } | { state: "invalid" | "unsupported"; reason: string };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
// known keys typed, a missing or mistyped one invalid, an EXTRA one unsupported — unknown stays unknown
function strictKeys(o: Record<string, unknown>, known: string[], what: string): Parsed<true> {
  const extra = Object.keys(o).filter((k) => !known.includes(k));
  if (extra.length) return { state: "unsupported", reason: `${what}: unmeasured field ${extra.sort().join(", ")}` };
  return { ok: true };
}
function askQuestions(v: unknown): Parsed<AskQuestion[]> {
  if (!Array.isArray(v) || v.length === 0) return { state: "invalid", reason: "questions is not a non-empty array" };
  const out: AskQuestion[] = [];
  for (const [i, q] of v.entries()) {
    if (!isObj(q)) return { state: "invalid", reason: `question ${i} is not an object` };
    const k = strictKeys(q, ["question", "header", "multiSelect", "options"], `question ${i}`);
    if (!("ok" in k)) return k;
    if (typeof q.question !== "string" || typeof q.header !== "string" || typeof q.multiSelect !== "boolean")
      return { state: "invalid", reason: `question ${i}: question/header/multiSelect mistyped or missing` };
    if (!Array.isArray(q.options) || q.options.length === 0) return { state: "invalid", reason: `question ${i}: options is not a non-empty array` };
    const options: AskOption[] = [];
    for (const [j, o] of q.options.entries()) {
      if (!isObj(o)) return { state: "invalid", reason: `question ${i} option ${j} is not an object` };
      const ok = strictKeys(o, ["label", "description"], `question ${i} option ${j}`);
      if (!("ok" in ok)) return ok;
      if (typeof o.label !== "string" || typeof o.description !== "string")
        return { state: "invalid", reason: `question ${i} option ${j}: label/description mistyped or missing` };
      options.push({ label: o.label, description: o.description });
    }
    out.push({ question: q.question, header: q.header, multiSelect: q.multiSelect, options });
  }
  return { ok: out };
}
function callQuestions(input: unknown): Parsed<AskQuestion[]> {
  if (!isObj(input)) return { state: "invalid", reason: "input is not an object" };
  const k = strictKeys(input, ["questions"], "input");
  return "ok" in k ? askQuestions(input.questions) : k;
}
// the call, typed whole or not at all
export function nativeAsk(input: unknown): NativeAsk {
  const p = callQuestions(input);
  if (!("ok" in p)) return p;
  const chars = JSON.stringify(p.ok).length;
  return chars > ASK_MAX ? { state: "clipped", chars, limit: ASK_MAX } : { state: "complete", questions: p.ok };
}
// the answer, from the result line's `toolUseResult`, against the call it answers (same file, by id)
export function nativeAnswer(result: unknown, callInput: unknown): NativeAnswer {
  if (!isObj(result)) return { state: "unsupported", reason: "no structured result on the tool_result line (a refusal or error is unmeasured)" };
  const k = strictKeys(result, ["questions", "answers", "annotations"], "result");
  if (!("ok" in k)) return k;
  if (result.annotations !== undefined && !(isObj(result.annotations) && Object.keys(result.annotations).length === 0))
    return { state: "unsupported", reason: "non-empty annotations are unmeasured" };
  const call = callQuestions(callInput);
  if (!("ok" in call)) return { state: call.state, reason: `the call: ${call.reason}` };
  const asked = askQuestions(result.questions);
  if (!("ok" in asked)) return { state: asked.state, reason: `the result's questions: ${asked.reason}` };
  if (JSON.stringify(asked.ok) !== JSON.stringify(call.ok)) return { state: "invalid", reason: "the result's questions differ from the call's" };
  if (!isObj(result.answers)) return { state: "invalid", reason: "answers is not an object" };
  const answers: { question: number; form: "single"; option: number; label: string }[] = [];
  for (const [text, value] of Object.entries(result.answers)) {
    const hits = call.ok.flatMap((q, i) => (q.question === text ? [i] : []));
    if (hits.length !== 1) return { state: "invalid", reason: hits.length ? "an answer's question text is not unique in the call" : "an answer names no question of the call" };
    const qi = hits[0]!;
    const q = call.ok[qi]!;
    if (q.multiSelect) return { state: "unsupported", reason: "the multi-select answer form is unmeasured" };
    if (typeof value !== "string") return { state: "unsupported", reason: "a non-string answer value is unmeasured" };
    const opts = q.options.flatMap((o, j) => (o.label === value ? [j] : []));
    if (opts.length > 1) return { state: "invalid", reason: "the answer's label is not unique among the options" };
    if (!opts.length) return { state: "unsupported", reason: "a free-text answer (no option label) is unmeasured" };
    answers.push({ question: qi, form: "single", option: opts[0]!, label: value });
  }
  if (answers.length !== call.ok.length) return { state: "unsupported", reason: "a partial answer (not every question answered) is unmeasured" };
  answers.sort((a, b) => a.question - b.question);
  const chars = JSON.stringify(answers).length;
  return chars > ASK_MAX ? { state: "clipped", chars, limit: ASK_MAX } : { state: "answered", answers };
}
// THE RESPONSE'S BINDING. `before` is the slot as the read began, `after` the same slot once the file
// was read (null: gone) — an occupant or session that changed across the await is not the one whose
// file was read. Only a live read of the slot's own PINNED session, in a harness whose question form is
// measured, can be current; history stays history even when its session id was resumed later.
export interface ReadSeat { slot: number; openedAt: number; sessionId: string | null }
export function transcriptBinding(f: { history: boolean; questions: boolean; pinned: boolean;
  fileSession: string | null; before: ReadSeat; after: ReadSeat | null }): Binding {
  if (f.history) return { state: "none", reason: "history: a past session of the line, never the current terminal" };
  if (!f.questions) return { state: "none", reason: "harness: its native question form is unmeasured" };
  if (!f.pinned || !f.before.sessionId) return { state: "none", reason: "unbound: the slot has no pinned session id (an adopted pane's newest file proves no occupant)" };
  if (f.fileSession !== f.before.sessionId) return { state: "none", reason: "session mismatch: the file is not the slot's pinned session" };
  if (!f.after) return { state: "none", reason: "occupant gone during the read" };
  if (f.after.slot !== f.before.slot || f.after.openedAt !== f.before.openedAt)
    return { state: "none", reason: "occupant changed during the read" };
  if (f.after.sessionId !== f.before.sessionId) return { state: "none", reason: "session changed during the read" };
  return { state: "current" };
}
// one call's terminal binding: the response's, narrowed by what this call is. No result in the file is
// NOT proof that the terminal still waits — `current` says only "unanswered in the current occupant's
// own file, in the measured single-select form"; an answered call is history whatever the response is.
export function askTerminal(response: Binding, ask: NativeAsk, answered: boolean): Binding {
  if (response.state !== "current") return response;
  if (answered) return { state: "none", reason: "answered: the file carries this call's result" };
  if (ask.state !== "complete") return { state: "none", reason: `form ${ask.state}` };
  if (ask.questions.some((q) => q.multiSelect)) return { state: "none", reason: "the multi-select answer form is unmeasured" };
  return { state: "current" };
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
  let model: string | null = null;
  let effort: string | null = null;
  rows.forEach((row, i) => {
    if (!row) return;
    const ts = str(row.timestamp) || null;
    if (row.type === "turn_context") {
      const tc = (row.payload ?? {}) as { model?: unknown; effort?: unknown };
      model = str(tc.model) || model;
      effort = str(tc.effort) || effort;
      return;
    }
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
  return { entries, branch: "", cache, model, effort, total };
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
  let model: string | null = null;
  // pi writes a thinking_level_change at session start and on every in-session switch
  let effort: string | null = null;
  rows.forEach((row, i) => {
    if (row?.type === "thinking_level_change" && onPath.has(str(row.id))) effort = str(row.thinkingLevel) || effort;
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
      model = str(m.model) || model;
    } else if (m.role === "toolResult") {
      const text = parts.map((b) => (b.type === "text" ? str(b.text) : "")).filter(Boolean).join("\n");
      entries.push({ n, role: "assistant", ts, blocks: [{ t: "tool_result", text: trim(text, 3000) }] });
    }
  });
  return { entries, branch, cache, model, effort, total };
}
