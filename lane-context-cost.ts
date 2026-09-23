// What a lane's grounding costs before its first productive step, per brief cohort — read off the transcripts.
//
// The baseline (docs/messungen/opus-lane-kontextkosten-2026-09-12.md) counted a median of 52 Bash
// calls before the first PRODUCTIVE MARKER over 187 explicit Opus-5 lanes; its extractor lived only
// in /tmp. This is its tracked successor, cut to the numbers E3 asks for
// (docs/messungen/2026-09-14-queue-intelligenz-schichten.md §5): did the source package
// (context-snippets.ts#renderSnippetBlock) lower that cost, with the card head held apart as a
// covariate so its effect is not read as the package's.
//
//   bun lane-context-cost.ts                         # cohorts A/B, markdown tables
//   bun lane-context-cost.ts --json                  # the same rows as JSON (no brief text, no commands)
//   bun lane-context-cost.ts --baseline 1789204092324  # the 2026-09-12 baseline: outcomes with ts <= that
//   bun lane-context-cost.ts --budget --quality <land-quality.jsonl> [--until <iso>] [--days 14]
//                                                    # peak context vs land quality, pots, waves, baton
//   flags: --root <checkout> (default: main checkout) · --projects <dir> (default ~/.claude/projects)
//          --b-from <iso> · --a-from <iso> · --until <iso>
//
// READ-ONLY. It reads streams/prompts.jsonl, context-receipts.jsonl, lane-outcomes.jsonl and
// land-quality.jsonl under the root, and each lane's direct transcript files under
// <projects>/<worktree path with every non-alphanumeric byte as "-">/*.jsonl. Nested subagent
// transcripts are excluded: their context is not the lane's. Nothing is written.
//
// DEFINITIONS (the baseline's, unchanged):
//   - productive marker: the first Edit / Write / NotebookEdit tool call, or the first Bash call
//     whose executable text (heredoc bodies removed) starts a segment with `git [opts] commit`.
//     An invocation, not proof of success; a write through other shell commands is not a marker.
//   - bashBefore: Bash tool calls strictly before the marker, deduplicated by tool_use id.
//   - context: input + cache_creation + cache_read tokens of ONE request (a snapshot, never a sum);
//     at the marker = the request that issued it, end = the last request. Absolute tokens.
//   - order: ISO timestamp, then file (mtime, name), line, content block.
//   - brief: the first owner-or-auto prompt logged for the worktree cwd — the same selection and
//     hash as server.ts#laneOwnerPrompts / #briefHashOf, so `briefHash` joins receipt and outcome.
//   - package: the brief contains the rendered block head "\n\nQuellpaket — ".
//   - symbol: the brief contains `path.ext#symbol` (context-snippets.ts's QUALIFIED pattern).
//   - card: the brief contains the rendered card head (wave-brief.ts#renderCardHead).
//
// DIRECTION DISCIPLINE: an unknowable value is null, never 0. A lane without a transcript (a foreign
// harness, or a transcript that was never written) is "nicht messbar" and enters no median; a lane
// without a marker is censored for the marker columns and still carries its end context.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { readLedger } from "./server/persist";
import { landWaveUnits } from "./task-land-waves";
import type { TaskCardSize } from "./task-waves";
import { CARD_HEAD_MARK } from "./wave-brief";

export const DEFAULT_A_FROM = "2026-09-13T01:17:00+02:00";
/** the first lane brief that carried a rendered source package */
export const DEFAULT_B_FROM = "2026-09-13T20:57:00+02:00";
export const OPUS_MODELS: ReadonlySet<string> = new Set(["claude-opus-5[1m]", "claude-opus-5", "claude-bridge/claude-opus-5"]);
/** its own class: Opus 5.5 lanes neither fall into "andere" nor into the Opus-5 medians */
export const OPUS_5_5_MODELS: ReadonlySet<string> = new Set(["claude-opus-5-5[1m]", "claude-opus-5-5"]);
const WRITE_TOOLS = new Set(["Edit", "Write", "NotebookEdit"]);
const DELEGATE_TOOLS = new Set(["Agent", "Task"]);
const PACKAGE_HEAD = "\n\nQuellpaket — ";
const CARD_HEAD = `${CARD_HEAD_MARK} · gegen den Baum validiert`;
const QUALIFIED = /(?:[/~])?[A-Za-z0-9_@.][A-Za-z0-9_@./-]*\.[A-Za-z0-9]+#[A-Za-z_$][A-Za-z0-9_$]*/;

export type ModelClass = "opus-5" | "opus-5.5" | "fable-5.1" | "andere";
type Key = readonly [number, string, number, number, number];
type Row = Record<string, unknown>;

export interface TranscriptMetrics {
  files: number;
  subagentFiles: number;
  models: string[];
  firstCacheContext: number | null;
  marker: string | null;
  bashBefore: number | null;
  delegateBefore: number | null;
  contextAtMarker: number | null;
  endContext: number | null;
  /** the largest single request — once a lane has handed over, its END is its successor's, its peak is not */
  peakContext: number | null;
  bashTotal: number;
}

export interface LaneRow {
  branch: string;
  cohort: "A" | "B" | "A-ohne-symbol" | "B-ohne-paket" | "baseline";
  briefAt: number | null;
  briefBytes: number | null;
  briefHash: string | null;
  hashJoin: "receipt" | "outcome" | "both" | "none";
  card: boolean | null;
  symbol: boolean | null;
  pkg: boolean | null;
  model: string | null;
  /** the class the medians group by; `transcript` = the ledgers said null and the transcript named it */
  modelClass: ModelClass | null;
  modelSource: "ledger" | "transcript" | null;
  harness: string | null;
  disposition: string | null;
  rework3d: number | null;
  insertedLines: number | null;
  measurable: boolean;
  metrics: TranscriptMetrics | null;
}

/** a ledger model id first; only when that is null, the single model the transcript's requests named */
export function classify(ledger: string | null, transcript: readonly string[]): { cls: ModelClass | null; source: LaneRow["modelSource"] } {
  const of = (m: string): ModelClass =>
    OPUS_MODELS.has(m) ? "opus-5" : OPUS_5_5_MODELS.has(m) ? "opus-5.5" : /^(claude-)?fable/.test(m) ? "fable-5.1" : "andere";
  if (ledger !== null) return { cls: of(ledger), source: "ledger" };
  const named = transcript.filter((m) => m.startsWith("claude-"));
  return named.length === 1 ? { cls: of(named[0]!), source: "transcript" } : { cls: null, source: null };
}

const cmpKey = (a: Key, b: Key): number => {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
};

const keyOf = (ts: unknown, file: number, line: number, block: number): Key =>
  typeof ts === "string" && ts ? [0, ts, file, line, block] : [1, "", file, line, block];

const int = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) ? v : null);

function contextOf(usage: unknown): number | null {
  if (!usage || typeof usage !== "object") return null;
  const u = usage as Row;
  const parts = [int(u.input_tokens), int(u.cache_creation_input_tokens), int(u.cache_read_input_tokens)];
  return parts.every((p) => p !== null) ? (parts as number[]).reduce((s, p) => s + p, 0) : null;
}

function cacheOf(usage: unknown): number | null {
  if (!usage || typeof usage !== "object") return null;
  const u = usage as Row;
  const cc = int(u.cache_creation_input_tokens), cr = int(u.cache_read_input_tokens);
  return cc !== null && cr !== null ? cc + cr : null;
}

/** a Bash command split into its executable lines and the characters of its heredoc bodies */
export function splitHeredocs(command: string): { kept: string; bodyChars: number } {
  const kept: string[] = [];
  let bodyChars = 0;
  let delimiter: string | null = null;
  let stripTabs = false;
  for (const line of command.split("\n")) {
    if (delimiter !== null) {
      if ((stripTabs ? line.replace(/^\t+/, "") : line).trim() === delimiter) delimiter = null;
      else bodyChars += line.length + 1;
      continue;
    }
    kept.push(line);
    const heredoc = /<<(-?)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2/.exec(line);
    if (heredoc) { stripTabs = heredoc[1] === "-"; delimiter = heredoc[3] ?? null; }
  }
  return { kept: kept.join("\n"), bodyChars };
}

/** true when some executable segment of a Bash command runs `git … commit` — heredoc bodies never count */
export function isGitCommit(command: string): boolean {
  for (const raw of splitHeredocs(command).kept.split(/\n|&&|\|\||;|\|/)) {
    const segment = raw.trim()
      .replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=(?:'[^']*'|"[^"]*"|\S+)\s+)+/, "")
      .replace(/^(?:command|env|sudo)\s+/, "");
    const m = /^(?:\S*\/)?git(?:\s+([\s\S]+))?$/.exec(segment);
    if (!m) continue;
    const args = (m[1] ?? "").trim().split(/\s+/);
    for (let i = 0; i < args.length;) {
      const token = args[i] ?? "";
      if (token === "commit") return true;
      if (!token.startsWith("-")) break;
      i += ["-C", "-c", "--git-dir", "--work-tree", "--namespace"].includes(token) ? 2 : 1;
    }
  }
  return false;
}

export function transcriptDir(projects: string, worktree: string): string {
  return join(projects, worktree.replace(/[^A-Za-z0-9]/g, "-"));
}

interface ToolEvent { key: Key; name: string; messageId: string | null; input: unknown }
interface Request { key: Key; usage: unknown }

/** `only` names the session ids to read; without it every direct transcript file in the directory counts */
export async function measureTranscript(dir: string, only?: ReadonlySet<string>): Promise<TranscriptMetrics | null> {
  if (!existsSync(dir)) return null;
  const entries = readdirSync(dir, { withFileTypes: true });
  const direct = entries.filter((e) => e.isFile() && e.name.endsWith(".jsonl") && (!only || only.has(e.name.slice(0, -6))))
    .map((e) => ({ path: join(dir, e.name), name: e.name, mtime: statSync(join(dir, e.name)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  if (direct.length === 0) return null;
  const subagentFiles = entries.filter((e) => e.isDirectory())
    .reduce((n, e) => n + countJsonl(join(dir, e.name)), 0);

  const requests = new Map<string, Request>();
  const tools = new Map<string, ToolEvent>();
  const models = new Set<string>();
  for (const [rank, file] of direct.entries()) {
    const lines = (await Bun.file(file.path).text()).split("\n");
    for (const [lineNo, line] of lines.entries()) {
      if (!line) continue;
      let row: Row;
      try {
        const parsed: unknown = JSON.parse(line);
        if (!parsed || typeof parsed !== "object") continue;
        row = parsed as Row;
      } catch { continue; }
      const message = row.message;
      if (!message || typeof message !== "object") continue;
      const msg = message as Row;
      const id = typeof msg.id === "string" && msg.id ? msg.id : null;
      if (msg.role === "assistant") {
        const reqId = id ?? `missing:${rank}:${lineNo}`;
        const key = keyOf(row.timestamp, rank, lineNo, -1);
        const seen = requests.get(reqId);
        if (!seen) requests.set(reqId, { key, usage: msg.usage });
        else if (cmpKey(key, seen.key) < 0) requests.set(reqId, { ...seen, key });
        if (typeof msg.model === "string") models.add(msg.model);
      }
      if (!Array.isArray(msg.content)) continue;
      for (const [blockNo, block] of msg.content.entries()) {
        if (!block || typeof block !== "object" || (block as Row).type !== "tool_use") continue;
        const b = block as Row;
        const toolId = typeof b.id === "string" && b.id ? b.id : `missing:${rank}:${lineNo}:${blockNo}`;
        if (tools.has(toolId)) continue;
        tools.set(toolId, {
          key: keyOf(row.timestamp, rank, lineNo, blockNo),
          name: typeof b.name === "string" ? b.name : "unknown",
          messageId: id,
          input: b.input,
        });
      }
    }
  }

  const ordered = [...tools.values()].sort((a, b) => cmpKey(a.key, b.key));
  const byTime = [...requests.values()].sort((a, b) => cmpKey(a.key, b.key));
  const commandOf = (t: ToolEvent): string =>
    t.input && typeof t.input === "object" && typeof (t.input as Row).command === "string" ? (t.input as Row).command as string : "";
  const marker = ordered.find((t) => WRITE_TOOLS.has(t.name) || (t.name === "Bash" && isGitCommit(commandOf(t)))) ?? null;
  const before = marker ? ordered.filter((t) => cmpKey(t.key, marker.key) < 0) : null;
  const markerRequest = marker?.messageId ? requests.get(marker.messageId) : undefined;
  return {
    files: direct.length,
    subagentFiles,
    models: [...models].sort(),
    firstCacheContext: byTime[0] ? cacheOf(byTime[0].usage) : null,
    marker: marker ? (marker.name === "Bash" ? "git commit" : marker.name) : null,
    bashBefore: before ? before.filter((t) => t.name === "Bash").length : null,
    delegateBefore: before ? before.filter((t) => DELEGATE_TOOLS.has(t.name)).length : null,
    contextAtMarker: markerRequest ? contextOf(markerRequest.usage) : null,
    endContext: byTime.length ? contextOf(byTime[byTime.length - 1]?.usage) : null,
    peakContext: byTime.reduce<number | null>((max, r) => {
      const c = contextOf(r.usage);
      return c === null ? max : Math.max(max ?? c, c);
    }, null),
    bashTotal: ordered.filter((t) => t.name === "Bash").length,
  };
}

function countJsonl(dir: string): number {
  return readdirSync(dir, { withFileTypes: true }).reduce((n, e) =>
    n + (e.isDirectory() ? countJsonl(join(dir, e.name)) : e.name.endsWith(".jsonl") ? 1 : 0), 0);
}

// server/persist.ts#readLedger itself, not a copy (the pattern of briefstats.ts#readJsonl): the hand
// copy that stood here delivered an array line as a row and dropped torn lines uncounted. The
// cohort tables have no place for a hole count, so only the rows travel on.
export async function readJsonl(file: string): Promise<Row[]> {
  return (await readLedger<Row>(file)).rows;
}

/** baseline quantiles: the median averages the two middle values; p90 is nearest rank ceil(0.9n) */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function p90(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.ceil(0.9 * s.length) - 1]!;
}

const latestBy = (rows: Row[], field: string, ts: string): Map<string, Row> => {
  const out = new Map<string, Row>();
  for (const r of rows) {
    const k = r[field];
    if (typeof k !== "string") continue;
    const old = out.get(k);
    if (!old || (int(r[ts]) ?? 0) >= (int(old[ts]) ?? 0)) out.set(k, r);
  }
  return out;
};

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const worktreeOf = (root: string, branch: string): string => `${root}.worktrees/${branch.replace("/", "-")}`;

async function baselineRows(root: string, projects: string, until: number): Promise<LaneRow[]> {
  const outcomes = latestBy((await readJsonl(`${root}/lane-outcomes.jsonl`)).filter((r) => (int(r.ts) ?? 0) <= until), "branch", "ts");
  const rows: LaneRow[] = [];
  for (const [branch, o] of [...outcomes].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const model = str(o.model);
    // the baseline globbed `…-worktrees-fleet-*`; a named branch (game-maker/hardening) was outside it
    if (!branch.startsWith("fleet/") || !model || !OPUS_MODELS.has(model)) continue;
    const metrics = await measureTranscript(transcriptDir(projects, worktreeOf(root, branch)));
    if (!metrics) continue;
    rows.push({
      branch, cohort: "baseline", briefAt: null, briefBytes: null, briefHash: str(o.briefHash), hashJoin: "none",
      card: null, symbol: null, pkg: null, model, modelClass: "opus-5", modelSource: "ledger",
      harness: str(o.harness), disposition: str(o.disposition),
      rework3d: null, insertedLines: null, measurable: true, metrics,
    });
  }
  return rows;
}

async function cohortRows(root: string, projects: string, aFrom: number, bFrom: number, until: number): Promise<LaneRow[]> {
  const prefix = `${root}.worktrees/fleet-`;
  const briefs = new Map<string, { at: number; text: string }>();
  for (const p of await readJsonl(`${root}/streams/prompts.jsonl`)) {
    const cwd = str(p.cwd), text = str(p.text), at = int(p.ts);
    if (!cwd?.startsWith(prefix) || text === null || at === null) continue;
    if ((p.source === "owner" || p.source === "auto") && !briefs.has(cwd)) briefs.set(cwd, { at, text });
  }
  const receipts = latestBy(await readJsonl(`${root}/context-receipts.jsonl`), "branch", "at");
  const outcomes = latestBy(await readJsonl(`${root}/lane-outcomes.jsonl`), "branch", "ts");
  const quality = latestBy(await readJsonl(`${root}/land-quality.jsonl`), "branch", "landedAt");

  const rows: LaneRow[] = [];
  for (const [cwd, brief] of [...briefs].sort(([, a], [, b]) => a.at - b.at)) {
    if (brief.at < aFrom || brief.at > until) continue;
    const branch = `fleet/${cwd.slice(prefix.length)}`;
    const receipt = receipts.get(branch), outcome = outcomes.get(branch), q = quality.get(branch);
    const hash = createHash("sha256").update(brief.text).digest("hex").slice(0, 12);
    const onReceipt = str(receipt?.briefHash) === hash, onOutcome = str(outcome?.briefHash) === hash;
    const pkg = brief.text.includes(PACKAGE_HEAD), symbol = QUALIFIED.test(brief.text);
    const late = brief.at >= bFrom;
    const cohort: LaneRow["cohort"] = late ? (pkg ? "B" : "B-ohne-paket") : (symbol && !pkg ? "A" : "A-ohne-symbol");
    const harness = str(outcome?.harness) ?? str(receipt?.harness);
    const model = str(outcome?.model) ?? str(receipt?.model);
    const foreign = harness !== null && harness !== "claude";
    const metrics = foreign ? null : await measureTranscript(transcriptDir(projects, cwd));
    const { cls, source } = classify(model, metrics?.models ?? []);
    rows.push({
      branch, cohort, briefAt: brief.at, briefBytes: Buffer.byteLength(brief.text), briefHash: hash,
      hashJoin: onReceipt && onOutcome ? "both" : onReceipt ? "receipt" : onOutcome ? "outcome" : "none",
      card: brief.text.includes(CARD_HEAD), symbol, pkg, model, modelClass: cls, modelSource: source, harness,
      disposition: str(outcome?.disposition), rework3d: int(q?.reworkLines3d), insertedLines: int(q?.insertedLines),
      measurable: metrics !== null, metrics,
    });
  }
  return rows;
}

const fmt = (v: number | null): string => (v === null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(1));

function summaryLine(label: string, rows: LaneRow[]): string {
  const m = rows.filter((r) => r.metrics !== null);
  const marked = m.filter((r) => r.metrics?.bashBefore !== null);
  // a commit marker means no Edit/Write came first, so its count spans the whole implementation —
  // the file-write column compares like with like across periods whose commit-marker share differs
  const written = marked.filter((r) => r.metrics?.marker !== "git commit");
  const pick = (f: (x: TranscriptMetrics) => number | null, from: LaneRow[]): number[] =>
    from.map((r) => (r.metrics ? f(r.metrics) : null)).filter((v): v is number => v !== null);
  const bash = pick((x) => x.bashBefore, marked), bashW = pick((x) => x.bashBefore, written);
  const ctx = pick((x) => x.contextAtMarker, marked), end = pick((x) => x.endContext, m);
  const viaTranscript = rows.filter((r) => r.modelSource === "transcript").length;
  return `| ${label} | ${rows.length} (${viaTranscript}) | ${m.length} | ${marked.length} | ${fmt(median(bash))} / ${fmt(p90(bash))} | `
    + `${written.length}: ${fmt(median(bashW))} | ${fmt(median(ctx))} | ${fmt(median(end))} |`;
}

const SUMMARY_HEAD = [
  "| Gruppe | n Briefs (Modell aus Transkript) | n messbar | n mit Marker | Bash bis Marker median / p90 | n mit Edit/Write-Marker: Bash davor median | Kontext am Marker median | Endkontext median |",
  "|---|---:|---:|---:|---:|---:|---:|---:|",
];

/** medians run over CLOSED Opus-5 lanes (an outcome exists); open lanes are listed, never summed */
export function renderCohorts(rows: LaneRow[]): string {
  const group = (c: LaneRow["cohort"], card?: boolean): LaneRow[] =>
    rows.filter((r) => r.cohort === c && r.modelClass === "opus-5" && r.disposition !== null
      && (card === undefined || r.card === card));
  const summary = [...SUMMARY_HEAD];
  for (const c of ["A", "B"] as const) {
    summary.push(summaryLine(`${c} · Opus 5`, group(c)));
    summary.push(summaryLine(`${c} · mit KARTE`, group(c, true)));
    summary.push(summaryLine(`${c} · ohne KARTE`, group(c, false)));
  }
  const lanes = [
    "| Branch | Kohorte | Brief (lokal) | Bytes | Hash-Join | KARTE | Modell (Klasse) | Harness | Disposition | Marker | Bash bis Marker | Agent bis Marker | Kontext am Marker | Endkontext | rework3d/inserted |",
    "|---|---|---|---:|---|---|---|---|---|---|---:|---:|---:|---:|---:|",
    ...rows.map((r) => {
      const m = r.metrics;
      const at = r.briefAt === null ? "—" : new Date(r.briefAt).toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }).slice(5, 16);
      const model = `${r.model ?? "null"} (${r.modelClass ?? "?"}${r.modelSource === "transcript" ? ", Transkript" : ""})`;
      return `| ${r.branch.slice(r.branch.indexOf("/") + 1)} | ${r.cohort} | ${at} | ${fmt(r.briefBytes)} | ${r.hashJoin} | ${r.card ? "ja" : "nein"} | `
        + `${model} | ${r.harness ?? "claude"} | ${r.disposition ?? "offen"} | `
        + (m ? `${m.marker ?? "kein"} | ${fmt(m.bashBefore)} | ${fmt(m.delegateBefore)} | ${fmt(m.contextAtMarker)} | ${fmt(m.endContext)}`
          : "nicht messbar | — | — | — | —")
        + ` | ${r.rework3d === null ? "—" : `${r.rework3d}/${fmt(r.insertedLines)}`} |`;
    }),
  ];
  return [...summary, "", ...lanes].join("\n");
}

// ── --budget: is a lane's context a quality budget or only a cost? (docs/messungen/2026-09-14-lange-lanes-kontextbudget.md)
//
// One row per CLOSED claude lane in the window, measured on its PEAK session: the one session whose
// largest request is largest. Only the sessions the fleet itself prompted in that worktree count
// (prompts.jsonl sessionIds); a probe that happened to run with the worktree as cwd is not the lane.
//   - pots: first = the first request; ownOutput = Σ output_tokens (thinking included, which the
//     transcript does not show as text); fed = peak − first − ownOutput (tool results, reminders,
//     prompts). `retainRatio` checks that output really stays in context: on turns whose tool result
//     is < 200 chars, (context delta) / (previous output) — ≈ 1 means it does.
//   - quality: joined by branch to a land-quality.jsonl (bun land-quality.ts --out), never recomputed.
//   - nudges: prompts whose text opens with the server's migrate head; armed = the first such delivery.

const MIGRATE_HEAD = "[fleet] Dein Kontext ist bei ";
const WAVE_HEAD = /DIESE LANE TRÄGT EINE WELLE: (\d+) QUEUE-ZEILEN/;
const CARD_SIZE = /GROESSE: (klein|mittel|gross)\b/g;
/** server.ts#LANE_MIGRATE_PCT's default; the window of every Opus-5 lane is 1M */
const LANE_THRESHOLD_PCT = 40;
const OPUS_WINDOW = 1_000_000;
const SMALL_RESULT_CHARS = 200;
const BANDS = [[0, 20], [20, 30], [30, 40], [40, 100]] as const;
const INSERTED_STRATA = [[0, 150], [151, 500], [501, Infinity]] as const;

export interface SessionAnatomy {
  id: string; startedAt: number | null; requests: number; bash: number;
  first: number | null; peak: number | null; ownOutput: number;
  toolResultChars: number; textChars: number; toolInputChars: number; heredocChars: number;
  retainRatio: number | null; overThresholdAt: number | null;
}

export async function sessionAnatomy(file: string, thresholdTokens: number): Promise<SessionAnatomy> {
  const requests = new Map<string, { at: number; ctx: number | null; out: number }>();
  const seen = new Set<string>();
  const turns: [number, number, number][] = []; // [ctx delta, previous output, result chars between]
  const a: SessionAnatomy = {
    id: file.slice(file.lastIndexOf("/") + 1, -6), startedAt: null, requests: 0, bash: 0, first: null, peak: null,
    ownOutput: 0, toolResultChars: 0, textChars: 0, toolInputChars: 0, heredocChars: 0, retainRatio: null, overThresholdAt: null,
  };
  let lastId: string | null = null;
  let between = 0;
  for (const line of (await Bun.file(file).text()).split("\n")) {
    if (!line) continue;
    let row: Row;
    try {
      const parsed: unknown = JSON.parse(line);
      if (!parsed || typeof parsed !== "object") continue;
      row = parsed as Row;
    } catch { continue; }
    const msg = row.message;
    if (!msg || typeof msg !== "object") continue;
    const m = msg as Row;
    const at = typeof row.timestamp === "string" ? Date.parse(row.timestamp) : NaN;
    if (m.role === "assistant" && typeof m.id === "string" && !Number.isNaN(at)) {
      const usage = m.usage && typeof m.usage === "object" ? m.usage as Row : null;
      const ctx = contextOf(usage), out = int(usage?.output_tokens) ?? 0;
      const old = requests.get(m.id);
      if (!old) {
        const prev = lastId === null ? undefined : requests.get(lastId);
        if (prev && prev.ctx !== null && ctx !== null) turns.push([ctx - prev.ctx, prev.out, between]);
        lastId = m.id;
        between = 0;
      }
      requests.set(m.id, { at: Math.min(old?.at ?? at, at), ctx: ctx ?? old?.ctx ?? null, out: Math.max(out, old?.out ?? 0) });
    }
    if (!Array.isArray(m.content)) continue;
    for (const [blockNo, block] of m.content.entries()) {
      if (!block || typeof block !== "object") continue;
      const b = block as Row;
      const id = str(b.id) ?? str(b.tool_use_id) ?? `${str(row.uuid)}:${blockNo}`;
      if (seen.has(`${b.type}:${id}`)) continue;
      seen.add(`${b.type}:${id}`);
      if (b.type === "tool_result") {
        const c = b.content;
        const chars = typeof c === "string" ? c.length
          : Array.isArray(c) ? c.reduce((n: number, x: unknown) => n + (x && typeof x === "object" && typeof (x as Row).text === "string" ? ((x as Row).text as string).length : 0), 0) : 0;
        a.toolResultChars += chars;
        between += chars;
      } else if (m.role === "assistant" && b.type === "text" && typeof b.text === "string") {
        a.textChars += b.text.length;
      } else if (m.role === "assistant" && b.type === "tool_use") {
        a.toolInputChars += JSON.stringify(b.input ?? {}).length;
        if (b.name === "Bash") {
          a.bash++;
          const command = b.input && typeof b.input === "object" ? str((b.input as Row).command) : null;
          a.heredocChars += splitHeredocs(command ?? "").bodyChars;
        }
      }
    }
  }
  const byTime = [...requests.values()].sort((x, y) => x.at - y.at);
  const known = byTime.filter((r) => r.ctx !== null) as { at: number; ctx: number; out: number }[];
  a.requests = byTime.length;
  a.startedAt = byTime[0]?.at ?? null;
  a.ownOutput = byTime.reduce((n, r) => n + r.out, 0);
  a.first = known[0]?.ctx ?? null;
  a.peak = known.length ? Math.max(...known.map((r) => r.ctx)) : null;
  a.overThresholdAt = known.find((r) => r.ctx >= thresholdTokens)?.at ?? null;
  a.retainRatio = median(turns.filter(([, out, chars]) => chars < SMALL_RESULT_CHARS && out > 300).map(([d, out]) => d / out));
  return a;
}

export interface BudgetRow {
  branch: string; briefAt: number | null; disposition: string | null; successions: number | null;
  waveRows: number; waveUnits: number; filesTouched: number | null; sessions: number; peakSession: SessionAnatomy;
  nudges: number[]; insertedLines: number | null; rework3d: number | null; fix3d: boolean | null;
  codeLand: boolean | null; auditRed: boolean | null;
}

export async function budgetRows(root: string, projects: string, quality: string, from: number, until: number, thresholdTokens: number): Promise<BudgetRow[]> {
  const outcomes = latestBy((await readJsonl(`${root}/lane-outcomes.jsonl`)).filter((o) => o.repo === root), "branch", "ts");
  const land = latestBy(await readJsonl(quality), "branch", "landedAt");
  const byCwd = new Map<string, Row[]>();
  for (const p of await readJsonl(`${root}/streams/prompts.jsonl`)) {
    const cwd = str(p.cwd);
    if (cwd) byCwd.set(cwd, [...(byCwd.get(cwd) ?? []), p]);
  }
  const rows: BudgetRow[] = [];
  for (const [branch, o] of [...outcomes].sort(([x], [y]) => (x < y ? -1 : 1))) {
    const ts = int(o.ts);
    const harness = str(o.harness);
    if (!branch.startsWith("fleet/") || ts === null || ts < from || ts > until || (harness !== null && harness !== "claude")) continue;
    const cwd = worktreeOf(root, branch), dir = transcriptDir(projects, cwd), prompts = byCwd.get(cwd) ?? [];
    const ids = new Set(prompts.map((p) => str(p.sessionId)).filter((s): s is string => s !== null));
    if (!existsSync(dir)) continue;
    const sessions: SessionAnatomy[] = [];
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".jsonl") && ids.has(f.slice(0, -6))))
      sessions.push(await sessionAnatomy(join(dir, f), thresholdTokens));
    const peakSession = sessions.filter((s) => s.peak !== null).sort((x, y) => (y.peak ?? 0) - (x.peak ?? 0))[0];
    if (!peakSession) continue;
    const metrics = await measureTranscript(dir, ids);
    if (classify(str(o.model), metrics?.models ?? []).cls !== "opus-5") continue;
    const brief = str(prompts.find((p) => p.source === "owner" || p.source === "auto")?.text) ?? "";
    const waveRows = Number(WAVE_HEAD.exec(brief)?.[1] ?? 1);
    const sizes = [...brief.matchAll(CARD_SIZE)].map((x) => x[1] as TaskCardSize).slice(0, waveRows);
    const q = land.get(branch);
    rows.push({
      branch, briefAt: int(prompts.find((p) => p.source === "owner" || p.source === "auto")?.ts), disposition: str(o.disposition),
      successions: int(o.successions), waveRows,
      waveUnits: sizes.reduce((n, s) => n + landWaveUnits(s), 0) + landWaveUnits(null) * (waveRows - sizes.length),
      filesTouched: Array.isArray(o.filesTouched) ? o.filesTouched.length : null, sessions: sessions.length, peakSession,
      nudges: prompts.filter((p) => str(p.text)?.startsWith(MIGRATE_HEAD)).map((p) => int(p.ts)).filter((t): t is number => t !== null),
      insertedLines: int(q?.insertedLines), rework3d: int(q?.reworkLines3d),
      fix3d: typeof q?.reworkByFixSubject === "boolean" ? q.reworkByFixSubject : null,
      codeLand: typeof q?.codeLand === "boolean" ? q.codeLand : null, auditRed: typeof q?.auditRed === "boolean" ? q.auditRed : null,
    });
  }
  return rows;
}

const pctOf = (tokens: number | null): number => (tokens ?? 0) / (OPUS_WINDOW / 100);
const rateOf = (rows: BudgetRow[], pick: (r: BudgetRow) => boolean | null): string => {
  const known = rows.map(pick).filter((v): v is boolean => v !== null);
  const k = known.filter(Boolean).length;
  return known.length ? `${k}/${known.length} (${Math.round((100 * k) / known.length)} %)` : "—";
};
const inBand = (r: BudgetRow, [lo, hi]: readonly [number, number]): boolean => pctOf(r.peakSession.peak) > lo && pctOf(r.peakSession.peak) <= hi;
const reworkRatio = (r: BudgetRow): number | null => (r.rework3d !== null && r.insertedLines ? r.rework3d / r.insertedLines : null);
const nums = (rows: BudgetRow[], f: (r: BudgetRow) => number | null): number[] => rows.map(f).filter((v): v is number => v !== null);
const ratio = (v: number | null): string => (v === null ? "—" : v.toFixed(3));

/** `nudgeTimes`: every migrate delivery in prompts.jsonl, main or lane — the first one dates the arming */
export function renderBudget(rows: BudgetRow[], nudgeTimes: number[], thresholdPct: number): string {
  const out: string[] = [];
  const bandLabel = ([lo, hi]: readonly [number, number]): string => (lo === 0 ? `≤ ${hi} %` : hi === 100 ? `> ${lo} %` : `${lo}–${hi} %`);
  out.push(`## (a) Peak-Kontext gegen Landqualitaet — ${rows.length} geschlossene Opus-5-Lanes`, "",
    "| Band | n | landed | rework3d > 0 | rework3d/inserted median | inserted median | fix3d (Code-Lands) | auditRed |",
    "|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const band of BANDS) {
    const g = rows.filter((r) => inBand(r, band));
    out.push(`| ${bandLabel(band)} | ${g.length} | ${rateOf(g, (r) => r.disposition === "landed")} | ${rateOf(g, (r) => (r.rework3d === null ? null : r.rework3d > 0))} | `
      + `${ratio(median(nums(g, reworkRatio)))} | ${fmt(median(nums(g, (r) => r.insertedLines)))} | ${rateOf(g, (r) => (r.codeLand ? r.fix3d : null))} | ${rateOf(g, (r) => r.auditRed)} |`);
  }
  out.push("", "Gleiche Landgroesse (inserted lines), Band fuer Band: n mit geschlossenem 3-d-Fenster · rework3d/inserted median · fix3d/Code-Lands", "",
    `| inserted | ${BANDS.map(bandLabel).join(" | ")} |`, `|---|${BANDS.map(() => "---:").join("|")}|`);
  for (const [lo, hi] of INSERTED_STRATA) {
    const s = rows.filter((r) => r.rework3d !== null && r.insertedLines !== null && r.insertedLines >= lo && r.insertedLines <= hi);
    out.push(`| ${hi === Infinity ? `> ${lo - 1}` : `${lo}–${hi}`} | ${BANDS.map((b) => {
      const g = s.filter((r) => inBand(r, b));
      const code = g.filter((r) => r.codeLand && r.fix3d !== null);
      return `${g.length} · ${ratio(median(nums(g, reworkRatio)))} · ${code.filter((r) => r.fix3d).length}/${code.length}`;
    }).join(" | ")} |`);
  }
  const pots = (label: string, g: BudgetRow[]): string => {
    const p = (f: (s: SessionAnatomy) => number | null): string => fmt(median(nums(g, (r) => f(r.peakSession))));
    const share = (f: (s: SessionAnatomy) => number): string => {
      const v = median(nums(g, (r) => (r.peakSession.peak ? f(r.peakSession) / r.peakSession.peak : null)));
      return v === null ? "—" : `${Math.round(100 * v)} %`;
    };
    const fed = (s: SessionAnatomy): number => Math.max(0, (s.peak ?? 0) - (s.first ?? 0) - s.ownOutput);
    return `| ${label} | ${g.length} | ${p((s) => s.peak)} | ${p((s) => s.first)} (${share((s) => s.first ?? 0)}) | ${p((s) => s.ownOutput)} (${share((s) => s.ownOutput)}) | `
      + `${p(fed)} (${share(fed)}) | ${p((s) => s.toolResultChars)} | ${p((s) => s.toolInputChars)} / ${p((s) => s.heredocChars)} | ${p((s) => s.textChars)} | ${p((s) => s.bash)} | ${ratio(median(nums(g, (r) => r.peakSession.retainRatio)))} |`;
  };
  const potHead = ["| Gruppe | n | Peak | erster Request | eigene Ausgabe | Tool-Ergebnisse + Eingespeistes | Tool-Ergebnis-Zeichen | Tool-Input-Zeichen / davon Heredoc | Text-Zeichen | Bash | Rueckhalte-Test |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|"];
  out.push("", "## (b) Zusammensetzung der Peak-Session (Tokens median, Anteil am Peak median)", "", ...potHead, pots("alle", rows),
    pots(`Peak > ${thresholdPct} %`, rows.filter((r) => pctOf(r.peakSession.peak) > thresholdPct)));
  const firstWave = Math.min(...nums(rows.filter((r) => r.waveRows > 1), (r) => r.briefAt));
  const since = rows.filter((r) => r.briefAt !== null && r.briefAt >= firstWave);
  out.push("", `## (c) Wellen — Lanes mit Brief ab der ersten Wellen-Lane (${Number.isFinite(firstWave) ? new Date(firstWave).toISOString() : "keine"})`, "",
    `| Gruppe | n | Peak % median | p90 | max | > ${thresholdPct} % | Dateien median | Einheiten median | Peak je Zeile median | auditRed |`, "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const [label, g] of [["Einzel-Lane", since.filter((r) => r.waveRows === 1)], ["Welle (≥ 2 Zeilen)", since.filter((r) => r.waveRows > 1)]] as const) {
    const peaks = nums(g, (r) => pctOf(r.peakSession.peak));
    out.push(`| ${label} | ${g.length} | ${fmt(median(peaks))} | ${fmt(p90(peaks))} | ${peaks.length ? fmt(Math.max(...peaks)) : "—"} | ${peaks.filter((v) => v > thresholdPct).length} | `
      + `${fmt(median(nums(g, (r) => r.filesTouched)))} | ${fmt(median(g.map((r) => r.waveUnits)))} | ${fmt(median(nums(g, (r) => pctOf(r.peakSession.peak) / r.waveRows)))} | ${rateOf(g, (r) => r.auditRed)} |`);
  }
  out.push("", "| Einheiten (Karte, ohne Groesse = mittel) | n | Peak % median | max |", "|---:|---:|---:|---:|");
  for (const u of [...new Set(since.map((r) => r.waveUnits))].sort((x, y) => x - y)) {
    const peaks = nums(since.filter((r) => r.waveUnits === u), (r) => pctOf(r.peakSession.peak));
    out.push(`| ${u} | ${peaks.length} | ${fmt(median(peaks))} | ${fmt(Math.max(...peaks))} |`);
  }
  const armed = Math.min(...nudgeTimes);
  const after = rows.filter((r) => r.briefAt !== null && r.briefAt >= armed);
  const afterPeaks = nums(after, (r) => pctOf(r.peakSession.peak));
  out.push("", `## (d) Staffelstab — scharf seit der ersten Zustellung ${Number.isFinite(armed) ? new Date(armed).toISOString() : "nie"}`, "",
    `Zustellungen gesamt ${nudgeTimes.length}, davon an Lane-Worktrees ${rows.reduce((n, r) => n + r.nudges.length, 0)} (in dieser Grundmenge). `
    + `Lanes mit Brief danach: ${after.length}, Peak % median ${fmt(median(afterPeaks))} · p90 ${fmt(p90(afterPeaks))} · > ${thresholdPct} %: ${afterPeaks.filter((v) => v > thresholdPct).length}.`, "",
    "| Branch | Peak % | Schwelle erreicht | Nudges | Sessions | successions | Disposition |", "|---|---:|---|---:|---:|---:|---|");
  for (const r of rows.filter((r) => r.nudges.length > 0 || (r.peakSession.overThresholdAt !== null && r.peakSession.overThresholdAt >= armed)))
    out.push(`| ${r.branch} | ${fmt(pctOf(r.peakSession.peak))} | ${r.peakSession.overThresholdAt === null ? "—" : new Date(r.peakSession.overThresholdAt).toISOString()} | `
      + `${r.nudges.length} | ${r.sessions} | ${fmt(r.successions)} | ${r.disposition ?? "offen"} |`);
  return out.join("\n");
}

function mainCheckout(): string {
  const p = Bun.spawnSync(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], { stderr: "ignore" });
  const common = p.stdout.toString().trim();
  return common ? realpathSync(dirname(common)) : process.cwd();
}

async function main(argv: string[]): Promise<number> {
  const flag = (name: string): string | null => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1]! : null;
  };
  const time = (name: string, fallback: string | null): number | null => {
    const v = flag(name) ?? fallback;
    if (v === null) return Date.now();
    const t = Date.parse(v);
    if (Number.isNaN(t)) { console.error(`lane-context-cost: ${name} wants an ISO timestamp, got "${v}"`); return null; }
    return t;
  };
  const root = realpathSync(flag("--root") ?? mainCheckout());
  const projects = flag("--projects") ?? join(homedir(), ".claude", "projects");
  const baseline = flag("--baseline");
  if (baseline !== null) {
    const until = Number(baseline);
    if (!Number.isInteger(until)) { console.error("lane-context-cost: --baseline wants an epoch-ms outcome horizon"); return 2; }
    const rows = await baselineRows(root, projects, until);
    console.log(argv.includes("--json") ? JSON.stringify(rows, null, 2) : [...SUMMARY_HEAD, summaryLine("Opus 5 (explizit)", rows)].join("\n"));
    return 0;
  }
  if (argv.includes("--budget")) {
    const until = time("--until", null), days = Number(flag("--days") ?? 14);
    if (until === null || !(days > 0)) { console.error("lane-context-cost: --budget wants --days > 0 and an ISO --until"); return 2; }
    const quality = flag("--quality") ?? `${root}/land-quality.jsonl`;
    if (!existsSync(quality)) { console.error(`lane-context-cost: ${quality} does not exist — quality is UNKNOWN, not clean`); return 2; }
    const rows = await budgetRows(root, projects, quality, until - days * 86_400_000, until, LANE_THRESHOLD_PCT * (OPUS_WINDOW / 100));
    const nudgeTimes = (await readJsonl(`${root}/streams/prompts.jsonl`))
      .filter((p) => str(p.text)?.startsWith(MIGRATE_HEAD) && (int(p.ts) ?? Infinity) <= until).map((p) => int(p.ts) ?? 0);
    console.log(argv.includes("--json") ? JSON.stringify(rows, null, 2) : renderBudget(rows, nudgeTimes, LANE_THRESHOLD_PCT));
    return 0;
  }
  const aFrom = time("--a-from", DEFAULT_A_FROM), bFrom = time("--b-from", DEFAULT_B_FROM), until = time("--until", null);
  if (aFrom === null || bFrom === null || until === null) return 2;
  const rows = await cohortRows(root, projects, aFrom, bFrom, until);
  console.log(argv.includes("--json") ? JSON.stringify(rows, null, 2) : renderCohorts(rows));
  return 0;
}

if (import.meta.main) process.exit(await main(Bun.argv.slice(2)));
