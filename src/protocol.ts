// src/protocol.ts — the values and shapes that MORE THAN ONE TypeScript file in this repo has to
// agree on, in one place.
//
// WHY. An audit of this tree found 34 must-agree pairs and only 3 of them had any mechanism; the
// rest were two hand-written literals that a reader had to notice. Two had already drifted (the
// client's git render key had lost `behind`; six of the eight background workers had no transcript
// mark at all). Every pair below is TS↔TS, and `bunx tsc` already gates every land — so moving the
// value here converts "someone has to remember" into a compile error, at no runtime cost. Pairs
// whose other side is a shell script or a doc cannot be reached this way; those are pinned as text
// rules in e2e/pins.ts, which the same gate runs first.
//
// WHAT BELONGS HERE: a value or a shape that two files must hold identically.
// WHAT DOES NOT: anything one file owns. This is not a dumping ground for constants — a constant
// with a single reader belongs next to that reader, where its comment can say why it has its value.
import { MODEL_DEFAULTS, MODEL_REGISTER } from "../model-register";

export interface SubscriptionWindow {
  used_percent: number;
  window_minutes: number;
  resets_at: number;
}
export interface SubscriptionSnapshot {
  status: "measured" | "stale" | "unknown" | "error";
  primary: SubscriptionWindow | null;
  secondary: SubscriptionWindow | null;
  source: { kind: "local-rollout"; measuredAt: number | null; fetchedAt: number | null;
    ageMs: number | null; staleAfterMs: number; reason: string | null;
    selection: { kind: "recent-file-tails"; maxFiles: 16; maxBytesPerFile: 262144; historyComplete: false };
    limitId: "codex" | null; accountBound: false; provenance: string | null };
}
export interface SubscriptionRefresh {
  target: "local" | "provider" | null;
  status: "not-requested" | "refreshing" | "ok" | "error" | "timeout" | "unsupported";
  startedAt: number | null;
  finishedAt: number | null;
  reason: string | null;
}
// THE CLAUDE ACCOUNT'S QUOTA (K16 E1, docs/neuaufbau/befunde/18-einstellungen.md §2): the two windows Claude Code
// reports in its rate_limit_event, `utilization` 0..1, `resetsAt` in epoch SECONDS. server/usage.ts reads it.
export interface ClaudeQuotaWindow { utilization: number; resetsAt: number }
export interface ClaudeQuota {
  status: "measured" | "unknown" | "error";
  fiveHour: ClaudeQuotaWindow | null;
  sevenDay: ClaudeQuotaWindow | null;
  limitStatus: string | null; // rate_limit_info.status, e.g. "allowed"
  overageStatus: string | null;
  measuredAt: number | null;
  ageMs: number | null;
  maxAgeMs: number;
  reason: string | null;
}
export interface SubscriptionUsage {
  schema: "fleet.subscription-usage/v1";
  generatedAt: number;
  codex: SubscriptionSnapshot & { refresh: SubscriptionRefresh;
    provider: { status: "unsupported"; reason: string } };
  claude: ClaudeQuota;
  otherSubscriptions: { status: "unknown"; reason: string };
  model: {
    ownerPreference: { status: "unknown"; reason: string };
    registerDefaults: typeof MODEL_DEFAULTS;
    selected: { slot: number; harness: string | null; model: string | null; source: "slot-state";
      decisionSource: "unknown"; usedTurnModel: null }[];
  };
}

// --- WS input frame cap -------------------------------------------------------------------------
// The server drops any keystroke frame larger than this, silently (there is no error path to a
// terminal). The client's paste chunker sizes itself from the SAME number, so lowering the cap can
// never leave a client happily emitting frames the server throws away — which is exactly the shape
// the old pair had: 1000 here, 1024 there, and nothing connecting them.
export const WS_INPUT_MAX_BYTES = 1024;

// --- per-slot git facts -------------------------------------------------------------------------
// The wire shape: what /api/sessions carries per active slot and what the board renders. The server
// caches one extra field (`head`) that never goes on the wire — it extends this rather than
// redeclaring it, so a field added for the client cannot be forgotten on the server and vice versa.
export interface GitInfo { branch: string; dirty: number; ahead: number; behind: number }

export const HELPER_REPOS_MAX = 8;
export const HELPER_REPO_REMOTES_MAX = 8;
export const HELPER_REPO_REFS_MAX = 8;
export const HELPER_REPO_COMMITS_MAX = 512;
export const HELPER_REPOS_BYTES_MAX = 32768;
export const HELPER_REPOS_CACHE_MS = 60000;
export const HELPER_REPOS_BUDGET_MS = 5000;
export const HELPER_REPO_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
export const helperGitLabel = (v: unknown): v is string => typeof v === "string"
  && /^[a-zA-Z0-9][a-zA-Z0-9_./-]{0,95}$/.test(v) && !v.includes("..")
  && !/\d+\.\d+\.\d+\.\d+|\.[a-zA-Z]{2,}(?:$|\/)/.test(v);
// THE ARTEFACT PATH RULE of a command job — one function on both sides of the wire. The server
// (server/types.ts) applies it to a job's globs and to every artefact row a helper reports, and
// refuses the WHOLE report when one row fails it; the daemon (helper-daemon/daemon.ts#artifactsOf)
// applies it to each scanned path BEFORE the report, so a path the server would refuse is dropped
// from the receipt instead of costing the verdict. Until 2026-10-09 the daemon checked only `/` and
// `..`, and a scanned path over 300 characters or with a control byte lost the run (D-8,
// docs/messungen/2026-10-09-codebase-review.md). A path is relative and may not climb — `..`
// anywhere, an absolute path or a backslash is refused rather than normalised.
export const HELPER_ARTIFACT_PATH_MAX = 300;
export const helperArtifactPathOk = (p: string): boolean =>
  p.length > 0 && p.length <= HELPER_ARTIFACT_PATH_MAX && !p.startsWith("/") && !p.includes("\\")
  && !p.split("/").some((seg) => seg === ".." || seg === "")
  && ![...p].some((ch) => ch < " " || ch === "\u007f");
export type HelperRepoReason = "unreadable" | "not-repo-root" | "budget" | "unsafe-label" | "ref-cap" | "remote-cap"
  | "commit-cap" | "no-merge-base" | "invalid-report";
export interface HelperRepoRef {
  ref: string | null; head: string | null; updatedAt: number | null;
  mergeBase: string | null; ahead: number | null; behind: number | null; reason: HelperRepoReason | null;
}
export interface HelperRepoReading {
  name: string | null; at: number; head: string | null; branch: string | null;
  remote: "none" | "present" | null; remotes: string[] | null; refs: HelperRepoRef[];
  coverage: "complete" | "incomplete"; reason: HelperRepoReason | null;
}
export interface HelperReposReading { at: number; repos: HelperRepoReading[] }

// --- worker result rail ------------------------------------------------------------------------
// The route, persisted row and FleetEvent payload share this CLOSED vocabulary. Keeping the value
// here makes a new spelling fail compilation in both the server and its transport probe instead of
// silently widening one side. These are reported facts only; no promotion path consumes them.
// `handoff` is the FOURTH and it is not a verdict about the work: it is the baton a lane whose
// context is filling lays down for the successor session that continues on the SAME worktree
// (server.ts#succeedLane). It rides this list rather than a separate object for one reason — the
// coordinator's inbox is where a lane's result already lands, and a handover that landed somewhere
// else would be a second place a MAIN has to look. It moves no task status either, so a MAIN sees
// a lane with a successor entry, never a finished slice.
export const FLEET_REPORT_STATUSES = ["complete", "needs-main", "failed", "handoff"] as const;
export type FleetReportStatus = typeof FLEET_REPORT_STATUSES[number];
export interface FleetReportEventPayload {
  reportId: string;
  status: FleetReportStatus;
  text: string;
  taskId: string | null;
  originId: string | null;
  programId: string | null;
  // "owner-inbox" is the OWNER PRINCIPAL as receiver, and it exists on THIS payload only. A
  // clarification can never carry it: an inbox cannot answer a question, so a worker that asked one
  // would wait forever. A report is terminal — it needs somewhere to land, not somewhere to reply.
  basis: "program-main" | "lane-watch" | "program-main+lane-watch" | "owner-inbox";
}

// --- instance identity --------------------------------------------------------------------------
// WHICH FLEET ANSWERED. Once a second Fleet process exists (dual-host programme, topology A: a
// second standalone instance rather than one process reaching across machines), every answer a
// board or a successor reads is ambiguous without this — two instances render the same slot
// numbers, the same task ids and the same report vocabulary.
//
// THE NAME IS OPERATOR-GIVEN, never derived: no hostname, no interface address, no cwd. This repo
// is public and a hostname in a payload is a hostname in a screenshot; an env value is also the
// only form the operator can change without a code change. Absent or malformed folds to `null`,
// which is the honest "this instance was never named" — deliberately NOT a default string like
// "fleet", because two unnamed instances sharing one invented name is exactly the confusion this
// field exists to remove.
//
// HOW IT RELATES TO `container`/`containerContext` (the pre-existing pair that also names an
// execution place): those two answer "which box, on which docker daemon" WITHIN one instance and
// live per slot; this one answers "which fleet process served this response" and lives ONCE per
// response. They never substitute for each other, and this one is deliberately not per slot — see
// the payload budget probe in e2e/tasks.ts.
export const INSTANCE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
export interface InstanceIdentity { name: string | null; source?: InstanceSource }
export function instanceNameFrom(value: unknown): string | null {
  return typeof value === "string" && INSTANCE_NAME_RE.test(value) ? value : null;
}

// --- what a test instance shows (ranke-notiz R11) ------------------------------------------------
// WHICH BRANCH AND WHICH STAND THIS COPY IS, and what of it is not in its target yet. Measured by
// testinstanz.sh BEFORE it copies (git of the source worktree; the copy itself has no .git) and
// handed to the instance as FLEET_INSTANCE_SOURCE. It is the stand AT START: a later commit in the
// worktree changes nothing here, which is why the band says "beim Start".
//
// PRESENCE IS THE TEST-INSTANCE MARK. Unset or empty → null → no `source` on the wire and no band:
// the live fleet never sets it. Set but unreadable → every field null, never dropped: an instance
// that was meant to say its stand and cannot says "unbekannt", it does not fall silent.
// `target.ahead` counts commits of `head` whose change is not on `target` (git rev-list --no-merges
// --cherry-pick --right-only, so a lane already landed by rebase reads 0, not its old count, and a
// merge of the target into the lane adds nothing).
export interface InstanceSource {
  branch: string | null; head: string | null; dirty: number | null; measuredAt: number | null;
  target: { branch: string; head: string | null; ahead: number | null } | null;
  // A ROUND (server/runde.ts): several branches merged onto `main` for one look; `out` collided and stayed out
  round?: { name: string; main: string | null; in: { branch: string; head: string | null }[]; out: { branch: string; why: string }[] };
}
// A BRANCH NAME AS GIT ALLOWS IT, not a positive list: `+`, `@`, `#` and umlauts are valid branch
// names and must not read "unbekannt". Refused are exactly git check-ref-format's rules — control
// characters and space, ~ ^ : ? * [ \, "..", "@{", "//", a lone "@", a leading "-", a leading or
// trailing "/", a trailing "." or ".lock", a component starting with "." or ending in ".lock" —
// plus a length cap. The band renders it as text (textContent), never as markup.
const INSTANCE_BRANCH_MAX = 200;
const instanceBranch = (v: unknown): string | null => {
  if (typeof v !== "string" || v.length === 0 || v.length > INSTANCE_BRANCH_MAX || v === "@") return null;
  if (/[\x00-\x20\x7f~^:?*[\\]/.test(v) || /\.\.|@\{|\/\//.test(v)) return null;
  if (v.startsWith("-") || v.startsWith("/") || v.endsWith("/") || v.endsWith(".")) return null;
  return v.split("/").some((c) => c.startsWith(".") || c.endsWith(".lock")) ? null : v;
};
const instanceCount = (v: unknown): number | null => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null;
const instanceSha = (v: unknown): string | null => typeof v === "string" && /^[0-9a-f]{40}$/.test(v) ? v : null;
export function instanceSourceFrom(value: unknown): InstanceSource | null {
  if (typeof value !== "string" || value === "") return null;
  let v: Record<string, unknown> = {};
  try { const parsed = JSON.parse(value); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) v = parsed; }
  catch { /* unreadable: every field below folds to null */ }
  const t = v.target && typeof v.target === "object" && !Array.isArray(v.target) ? v.target as Record<string, unknown> : null;
  const targetBranch = instanceBranch(t?.branch);
  const measuredAt = instanceCount(v.measuredAt);
  const round = instanceRound(v.round);
  return { branch: instanceBranch(v.branch), head: instanceSha(v.head), dirty: instanceCount(v.dirty),
    measuredAt: measuredAt && measuredAt > 0 ? measuredAt : null,
    target: targetBranch ? { branch: targetBranch, head: instanceSha(t?.head), ahead: instanceCount(t?.ahead) } : null,
    ...(round ? { round } : {}) };
}
const INSTANCE_ROUND_MAX = 20; // branches per side; a round is a handful
const INSTANCE_WHY_MAX = 200;
const records = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.slice(0, INSTANCE_ROUND_MAX).filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x)) : [];
// a round needs its name; a member without a readable branch name is dropped, never shown as "unbekannt"
function instanceRound(v: unknown): InstanceSource["round"] | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  if (typeof r.name !== "string" || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(r.name)) return null;
  const ins = records(r.in).flatMap((m) => { const b = instanceBranch(m.branch); return b ? [{ branch: b, head: instanceSha(m.head) }] : []; });
  const outs = records(r.out).flatMap((m) => {
    const b = instanceBranch(m.branch);
    return b ? [{ branch: b, why: typeof m.why === "string" ? m.why.replace(/[\x00-\x1f\x7f]/g, " ").slice(0, INSTANCE_WHY_MAX) : "Grund unbekannt" }] : [];
  });
  return { name: r.name, main: instanceSha(r.main), in: ins, out: outs };
}

// THE BAND'S WORDS, one pure function so the claim is checkable without a browser. A run marked
// `mono` is a branch or a sha (G0.3). Nothing is guessed: a missing value is the word "unbekannt",
// a count needs the target's sha measured with it ("Abgleich mit ‹ziel› unbekannt" otherwise), and
// "alles schon auf ‹ziel›" needs BOTH counts measured as zero.
export interface InstanceBandRun { t: string; mono?: boolean }
export interface InstanceBandText { segments: InstanceBandRun[][]; text: string; title: string }
export function instanceBandText(s: InstanceSource, clock: (ms: number) => string): InstanceBandText {
  if (s.round) return roundBandText(s.round, s.measuredAt, clock);
  const segments: InstanceBandRun[][] = [];
  segments.push(s.branch ? [{ t: "Zweig " }, { t: s.branch, mono: true }] : [{ t: "Zweig unbekannt" }]);
  if (!s.head) segments.push([{ t: "Stand unbekannt" }]);
  else {
    segments.push([{ t: "Stand beim Start " }, { t: s.head.slice(0, 7), mono: true }]);
    const target = s.target;
    if (!target) segments.push([{ t: "Ziel unbekannt" }]);
    else {
      const on = { t: target.branch, mono: true };
      const commits = target.ahead === null ? null : target.ahead === 1 ? "1 Commit" : `${target.ahead} Commits`;
      const files = s.dirty === null ? null : s.dirty === 1 ? "1 Datei ohne Commit" : `${s.dirty} Dateien ohne Commit`;
      // a count is only a comparison when the target's own sha was measured with it
      if (target.head === null || target.ahead === null) segments.push([{ t: "Abgleich mit " }, on, { t: " unbekannt" }]);
      else if (target.ahead === 0 && s.dirty === 0) segments.push([{ t: "alles schon auf " }, on]);
      else if (s.dirty === null) segments.push([{ t: target.ahead === 0 ? "alle Commits schon auf " : `${commits} noch nicht auf ` }, on, { t: ", Dateien ohne Commit: unbekannt" }]);
      else segments.push([{ t: `${[target.ahead ? commits : null, s.dirty ? files : null].filter(Boolean).join(" und ")} noch nicht auf ` }, on]);
    }
  }
  const text = segments.map((seg) => seg.map((r) => r.t).join("")).join(" · ");
  const when = s.measuredAt ? clock(s.measuredAt) : "unbekannt";
  const title = s.head
    ? `Diese Testinstanz zeigt ${s.branch ?? "einen unbekannten Zweig"} so, wie er beim Start war (${when}, Commit ${s.head}). `
      + "Was danach im Worktree geändert wurde, ist hier nicht enthalten."
      + (s.target ? ` Verglichen mit ${s.target.branch}${s.target.head ? ` (${s.target.head.slice(0, 7)})` : ""} zum selben Zeitpunkt.` : "")
    : "Diese Testinstanz konnte beim Start nicht messen, welchen Stand sie zeigt.";
  return { segments, text, title };
}

// A ROUND'S WORDS: its name, main and every branch in it, then each branch that stayed out with its reason
function roundBandText(r: NonNullable<InstanceSource["round"]>, measuredAt: number | null, clock: (ms: number) => string): InstanceBandText {
  const list = (names: string[]): InstanceBandRun[] => names.flatMap((b, i) => [...(i ? [{ t: ", " }] : []), { t: b, mono: true }]);
  const segments: InstanceBandRun[][] = [[{ t: "Runde " }, { t: r.name, mono: true }]];
  segments.push(r.main ? [{ t: "main " }, { t: r.main.slice(0, 7), mono: true }] : [{ t: "main unbekannt" }]);
  segments.push(r.in.length ? [{ t: "mit " }, ...list(r.in.map((m) => m.branch))] : [{ t: "kein Branch dabei" }]);
  for (const o of r.out) segments.push([{ t: "ohne " }, { t: o.branch, mono: true }, { t: `: ${o.why}` }]);
  const text = segments.map((seg) => seg.map((x) => x.t).join("")).join(" · ");
  const when = measuredAt ? clock(measuredAt) : "unbekannt";
  const title = `Diese Testinstanz zeigt die Runde ${r.name}: main${r.main ? ` (${r.main.slice(0, 7)})` : ""}`
    + (r.in.length ? ` mit ${r.in.map((m) => m.branch).join(", ")} zusammengeführt` : " ohne Branch")
    + `, gebaut um ${when}. Bewegt sich main oder einer der Branches, wird sie neu gebaut.`
    + (r.out.length ? ` Nicht dabei: ${r.out.map((o) => `${o.branch} (${o.why})`).join("; ")}.` : "")
    + " Gelandet wird weiter Branch für Branch.";
  return { segments, text, title };
}

// --- the instance switcher's list ----------------------------------------------------------------
// WHICH OTHER FLEETS EXIST, and nothing more. Topology A federates by HAND (docs/dual-host-topologie-
// entscheidung-2026-09-05.md §2): two standalone instances, no proxy, no shared token, no outbound
// request from either server. So the list this parses is a set of LINKS the board offers the owner —
// a click changes `location.origin` and the browser then presents that origin's own cookie to that
// origin's own login. Nothing here ever travels between the two servers.
//
// THE URL IS AN ORIGIN AND THE CHARSET SAYS SO. scheme + host + optional port, one optional trailing
// slash that is stripped, and nothing else: no userinfo (`@`), no path, no query, no fragment. That
// is not decoration — this string ends up in `location.assign`, so the charset IS the guarantee that
// a switch cannot carry a credential, cannot smuggle a `javascript:` scheme, and cannot be aimed at
// a deeper path on a host the operator only meant to name. An IPv6 literal is deliberately outside
// it (it would need brackets, and every address in this fleet is a name or IPv4); such an entry is
// dropped WITH a reason rather than silently, which is the whole point of `rejected`.
export const INSTANCE_URL_RE =
  /^https?:\/\/[A-Za-z0-9](?:[A-Za-z0-9.-]{0,126}[A-Za-z0-9])?(?::\d{1,5})?$/;

// THE LIST IS BOUNDED IN BYTES, not in entries, because the constraint it is actually up against is
// a byte one: /api/sessions is polled every 2 s by every open tab and is measured against 14 KiB
// (e2e/tasks.ts), with roughly 1 300 B of headroom. A cap on the COUNT would not bound the payload
// (a name may be 64 chars and a host 128), while this bounds both the payload and — since a menu
// long enough to matter cannot fit under it — the switcher's own length.
export const INSTANCE_LINKS_MAX_BYTES = 1024;

export const CODEX_CLI_MAX_AGE_MS = 300_000;
export const CODEX_CLI_REASONS = ["not-observed", "binary-missing", "timeout", "output-limit", "probe-failed", "invalid-version", "binary-changed"] as const;
export type CodexCliReason = typeof CODEX_CLI_REASONS[number];
export interface CodexCliSnapshot {
  source: "local-spawn-binary";
  binary: string | null;
  version: string | null;
  bootAt: number;
  observedAt: number | null;
  reason: CodexCliReason | null;
}
export const CODEX_CLI_VERSION_RE = /^\d{1,6}\.\d{1,6}\.\d{1,6}(?:[-+][A-Za-z0-9.-]{1,40})?$/;
export function codexCliSnapshotFrom(value: unknown): CodexCliSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (v.source !== "local-spawn-binary"
    || !(v.binary === null || typeof v.binary === "string" && /^[a-f0-9]{24}$/.test(v.binary))
    || !(v.version === null || typeof v.version === "string" && CODEX_CLI_VERSION_RE.test(v.version))
    || typeof v.bootAt !== "number" || !Number.isSafeInteger(v.bootAt) || v.bootAt <= 0 || v.bootAt > 8_640_000_000_000_000
    || !(v.observedAt === null || typeof v.observedAt === "number" && Number.isSafeInteger(v.observedAt) && v.observedAt >= v.bootAt && v.observedAt <= 8_640_000_000_000_000)
    || !(v.reason === null || CODEX_CLI_REASONS.some((r) => r === v.reason))
    || (v.version !== null && (v.binary === null || v.observedAt === null || v.reason !== null))
    || (v.version === null && v.reason === null)) return null;
  return { source: v.source, binary: v.binary, version: v.version, bootAt: v.bootAt,
    observedAt: v.observedAt, reason: v.reason as CodexCliReason | null };
}
export function codexCliUnknown(value: unknown, now: number): string | null {
  const snapshot = codexCliSnapshotFrom(value);
  if (!snapshot) return "missing-or-invalid-snapshot";
  if (!Number.isSafeInteger(now) || snapshot.bootAt > now
    || snapshot.observedAt !== null && snapshot.observedAt > now) return "future-observation";
  if (snapshot.observedAt === null) return snapshot.reason ?? "not-observed";
  if (now - snapshot.observedAt > CODEX_CLI_MAX_AGE_MS) return "stale-snapshot";
  return snapshot.reason;
}
export function compareCodexCli(left: unknown, right: unknown, now: number):
  { state: "same" | "drift" | "unknown"; reason: string | null } {
  const reason = codexCliUnknown(left, now) ?? codexCliUnknown(right, now);
  if (reason) return { state: "unknown", reason };
  const a = codexCliSnapshotFrom(left)!, b = codexCliSnapshotFrom(right)!;
  return { state: a.version === b.version ? "same" : "drift", reason: null };
}

export interface InstanceLink { name: string; url: string; codexCli?: CodexCliSnapshot }
// `rejected` is the reason half, and it exists so that a dropped entry is an EVENT rather than an
// absence: the server logs each line at boot. An operator whose typo'd URL simply vanished from the
// header would have no way to tell it from "the list never reached this process".
export interface InstanceLinksParse { links: InstanceLink[]; rejected: string[] }

const shortly = (v: unknown): string => {
  const s = JSON.stringify(v) ?? String(v);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
};

// Parses FLEET_INSTANCES. ABSENCE IS NOT AN ERROR (an unset variable is the ordinary single-host
// case and must not log anything); a present-but-broken value is, down to the individual entry —
// one bad row never costs the good ones.
export function instanceLinksFrom(value: unknown): InstanceLinksParse {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return { links: [], rejected: [] };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch (e) { return { links: [], rejected: [`not JSON (${e instanceof Error ? e.message : String(e)})`] }; }
  if (!Array.isArray(parsed)) return { links: [], rejected: [`not a JSON array: ${shortly(parsed)}`] };
  const links: InstanceLink[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();
  let bytes = 2; // the "[]" the entries go inside — the budget is on the SERIALISED list
  for (let i = 0; i < parsed.length; i++) {
    const entry = parsed[i] as unknown;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      rejected.push(`entry #${i} is not an object: ${shortly(entry)}`);
      continue;
    }
    const e = entry as { name?: unknown; url?: unknown; codexCli?: unknown };
    const name = instanceNameFrom(e.name);
    if (name === null) { rejected.push(`entry #${i} has no valid name: ${shortly(e.name)}`); continue; }
    const rawUrl = typeof e.url === "string" ? e.url.trim().replace(/\/$/, "") : "";
    if (!INSTANCE_URL_RE.test(rawUrl)) {
      rejected.push(`entry #${i} (${name}) has no valid http(s) origin as url: ${shortly(e.url)}`);
      continue;
    }
    const key = rawUrl.toLowerCase();
    if (seen.has(key)) { rejected.push(`entry #${i} (${name}) repeats an url already listed: ${shortly(rawUrl)}`); continue; }
    const codexCli = codexCliSnapshotFrom(e.codexCli);
    if (e.codexCli !== undefined && !codexCli) rejected.push(`entry #${i} (${name}) has an invalid Codex snapshot`);
    const link: InstanceLink = { name, url: rawUrl, ...(codexCli ? { codexCli } : {}) };
    const cost = new TextEncoder().encode(JSON.stringify(link)).length + (links.length ? 1 : 0);
    if (bytes + cost > INSTANCE_LINKS_MAX_BYTES) {
      rejected.push(`entry #${i} (${name}) does not fit the ${INSTANCE_LINKS_MAX_BYTES} B list budget`);
      continue;
    }
    bytes += cost;
    seen.add(key);
    links.push(link);
  }
  return { links, rejected };
}

// --- stable lane ownership ----------------------------------------------------------------------
// A lane belongs to one main-session OCCUPANT, not merely to a numbered slot: slots recycle, so
// the opening timestamp is the generation half of the identity. Optional on every carrier because
// old fleet state and an older server have no anchor to report. The normalizer is shared by state
// load and the client join; malformed disk/wire data degrades to absence and never invents history.
export interface LaneAnchor { slot: number; openedAt: number }
export function normalizeLaneAnchor(value: unknown): LaneAnchor | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const v = value as { slot?: unknown; openedAt?: unknown };
  return Number.isInteger(v.slot) && (v.slot as number) > 0
    && typeof v.openedAt === "number" && Number.isFinite(v.openedAt) && v.openedAt > 0
    ? { slot: v.slot as number, openedAt: v.openedAt }
    : null;
}

// --- post-land audit projection -----------------------------------------------------------------
// The compact row the 2 s poll carries (server: postLandAuditSummary). Deliberately tolerant: every
// field but `at` and `result` is optional, because a row written before a field existed must degrade
// to "not recorded" rather than to a claim. The server's projection is TYPED as this, so a field
// added there without adding it here fails the excess-property check.
export interface PostLandAuditInfo {
  at: number; ms?: number; result: string; repo?: string; main?: string;
  mainSha?: string; covers?: string[]; reason?: string;
  // WHY the other machine measured nothing, in its own account rather than in this server's
  // classification of an exit code — a closed set on the server (server.ts#helperNoMeasureOf), a
  // plain string here for the usual reason: a value this client does not know must degrade to
  // "not recorded", never be mapped onto one it does know. `remoteTimeoutMs` rides with
  // `remoteReason: "timeout"` alone; both absent on a local row and on every historical one.
  remoteReason?: string; remoteTimeoutMs?: number;
  // the artefact rail, JOINED onto the row by the server (server.ts, THE HELPER ARTEFACT RAIL).
  // Absent means no suite.log was uploaded for this audit — which is a different statement from
  // "the run produced none", and the alarm draws neither as the other. `url` is served by the
  // server rather than built here on purpose: the storage layout is this box's business, and a
  // client that composed the path would be a second place that has to know it.
  artifact?: { bytes: number; sha256: string; url: string };
  // WHICH CHAIN measured this tip. Present only when the audit ran the docs-only short chain
  // (install+pins, since 2026-09-04); absent is the full configured suite, which is what every
  // older row means too. The alarm needs it because its red headline NAMES the suite — a
  // proportional red is a failing pins run, not a failing `./e2e-isolated.sh`, and the difference
  // is the first thing the reader does next.
  proportional?: true;
  // WHO HAS IT — the two rails GET /api/post-land-audits joins, projected for this one row
  // (server.ts#postLandAuditSummary). `ping` is the delivery rail: `pending` = no session took it
  // yet, `delivered` = typed into `slot` (`sameSession`: the session that got it still runs there),
  // `program-inbox` = it sits in the owning Program's inbox and no pane was typed into,
  // `adjudicated` = judged before it was delivered. `adjudication` is the newest judgement on the
  // row. Both absent: nobody was told and nobody judged — which is what every unknown row is,
  // since only a red is ever delivered. A status this client does not know reads as "not recorded".
  ping?: { status: string; slot?: number; deliveredAt?: number; sameSession?: boolean };
  adjudication?: { verdict: string; at: number; by: string };
}

// --- post-land audit: the run that has NOT finished ---------------------------------------------
// The companion to the row above, and a SEPARATE carrier on purpose (server: postLandAuditLiveView).
// The whole object is `null` when nothing runs and nothing waits — never "unknown"; the one
// genuinely indeterminate state is `running.phase === "starting"`, the drain lock held before a run
// has stamped itself. `mainSha: null` is the same distinction one level down: the tip is resolved
// inside the run, so until then the tree under audit is not known, and "" would be a claim.
// `stats` is the runtime distribution of PAST runs of the same repo (null below three samples), and
// it is what makes the elapsed number answerable — see auditCounts for which rows are allowed in.
export interface PostLandAuditLiveInfo {
  running: {
    phase: "running" | "starting";
    repo: string | null; main: string | null; mainSha: string | null;
    startedAt: number | null; covers: string[];
    // present only on a SHARDED helper run (server.ts#auditShardRuns): `startedAt` is then its first
    // claim, and `shards` is one entry per k of n. `running` = a live claim, `open` = nobody holds it
    // yet, `closed` = it will produce no result (lapsed, unclaimed, or a sibling already ruled green
    // out). A run between two claims has no claim at all and is still THIS run, not a wait.
    sharded?: { n: number; shards: { k: number; state: "reported" | "running" | "open" | "closed"; device: string | null }[] };
  } | null;
  // lands whose audit has not begun: coalesced into the NEXT run, and today indistinguishable from
  // "no audit planned" on every surface. `at` is when the land queued them. `hold`: this box would
  // run it and the host disk holds it (server.ts#auditHoldOf).
  waiting: { repo: string; main: string; branch: string; mainAfter: string; at: number; hold?: "disk-space-held" }[];
  stats: { n: number; p50: number; p90: number } | null;
}

// --- a lane's suite offer, as the board's suite meter reads it ---------------------------------
// The owner-side projection of server.ts#laneSuiteJobs: an offer that is still OPEN (no helper has
// taken it), CLAIMED (a helper runs it) or REPORTED within the last few minutes. Withdrawn, lapsed,
// abandoned and reaped offers are not here — they measured nothing. `result` is set on `reported`
// only; `device` is the helper's own name on `claimed` and `reported`.
export interface SuiteOfferRow {
  slot: number; branch: string;
  state: "open" | "claimed" | "reported";
  device: string | null; at: number;
  result: "green" | "red" | "unknown" | null;
}

// --- the fleet's default interactive model ------------------------------------------------------
// Baked into every pane command that does not pin its own model. The gate asserts the quoted
// `--model` argument against this value; the policy itself lives in model-register.ts.
export const FLEET_DEFAULT_MODEL = MODEL_DEFAULTS.main.id;

// --- how many tokens a model's context window holds ---------------------------------------------
// The DENOMINATOR of the context-fill sensor, and the reason that sensor cannot be a single number:
// the same 150k tokens are 15% of a 1M window and 75% of a 200k one. Two things can spell the
// window: MODEL_RE's optional bracket suffix (`claude-opus-5[1m]`), which exists for exactly this,
// and — for a model spawned without one — the model id itself.
//
// Three answers, and the third is the point: a name this file cannot place returns null — "cannot
// tell" — rather than falling back to a default. A wrong denominator does not fail, it publishes a
// confident percentage that is off by a factor of five, which is worse than showing nothing.
//
// That null used to stop at the suffix door. An unrecognised suffix was "cannot tell", but a claude
// id with NO suffix fell through to the base window, on the claim that every claude model without a
// variant suffix is 200k. Claude Fable 5 ended that claim — its base window is 1M — and it ended it
// as exactly the failure the paragraph above forbids: on 2026-08-18 a live `claude-fable-5` slot at
// 176,680 tokens was published as 88.3% of a 200k window ("past the compaction cliff, hand over")
// while the same session's own pane read 17.7%. A handoff on that number throws away a session with
// ~800k of window still free.
//
// So the no-suffix door now goes through CLAUDE_CONTEXT_WINDOWS, a named set, and a claude id that
// is not in it is null like everything else unknown. A table of model ids does need tending, which
// the pure name function did not — but that is the honest failure mode: a missing row shows nothing
// and asks to be measured, where the old default showed a number and asked for nothing. Every row
// below carries the ground it stands on; a row without one is a guess wearing a table's clothes.
//
// Scope: the NAMED claude models below plus GPT model ids, the latter matched by shape because a
// GPT id carries no variant to confuse — including a provider prefix and Pi's optional thinking
// suffix. GPT's 258,400 is the USABLE window measured from Codex's own 272,000 nominal window at
// `effective_context_window_percent: 95` (2026-08-08). Using 272,000 here would make the warning
// instrument systematically optimistic. Everything else remains null rather than borrowing either
// provider's denominator. A claude id that carries a provider prefix is matched WHOLE, as its own
// row: the prefix is part of the claim, because the same bare id can hold a different window behind
// a bridge than it holds on its own (see `claude-bridge/claude-opus-5` below).
export const CONTEXT_WINDOW_BASE = 200_000;
export const CONTEXT_WINDOW_1M = 1_000_000;
export const CONTEXT_WINDOW_GPT = 258_400;
export const CONTEXT_WINDOW_GLM_5_3 = 1_000_000;
// The named set the no-suffix door reads. Every row is a measured or structurally forced claim, not
// a family guess; adding a model is one line plus the ground it stands on.
const CLAUDE_CONTEXT_WINDOWS: Readonly<Record<string, number | undefined>> = {
  // 1M WITHOUT a suffix, read 2026-09-19 out of the installed Claude Code 2.1.278 binary
  // (~/.local/share/claude/versions/2.1.278), whose model table carries for these two ids verbatim
  //   "claude-opus-5",…,context:{window:1e6,native_1m:!0,supports_1m_beta:!0,supports_1m_suffix:!0}
  //   "claude-sonnet-5",…,context:{window:1e6,native_1m:!0,native_1m_3p:{bedrock:!0,vertex:!0,foundry:!0},supports_1m_beta:!0}
  // (Befund Chat-Lane db81f382, Report 4aef7415). REFUTED, the old ground of these rows: "the fleet
  // asks for the 1M variant by spelling `[1m]` (FLEET_DEFAULT_MODEL, SUMMARY_MODEL), so the bare
  // id is 200k" — a suffix the fleet writes proves nothing about what the bare id gives; it
  // published a bare-id session's fill ~5x too high.
  // Where Claude Code still falls back to 200k: CLAUDE_CODE_DISABLE_1M_CONTEXT set (the binary's
  // `if(eO())return!1` gate on native_1m: "1M context is turned off here (CLAUDE_CODE_DISABLE_1M_CONTEXT
  // is set)"), and an account whose long-context credits are off (429 long_context_credits_required,
  // "Usage credits required for 1M context"). Neither is visible from a model id, so this row is a
  // claim about THIS host, where the variable is unset (2026-09-19: `env | grep -c` → 0).
  // the successor id, read 2026-09-22 out of the installed Claude Code 2.1.280 model table
  // (~/.local/share/claude/versions/2.1.280), which carries for this id verbatim
  //   "claude-opus-5-5",…,fallback_3p:"claude-opus-5",context:{window:1e6,native_1m:!0,supports_1m_beta:!0,supports_1m_suffix:!0}
  // — the id answers on this machine too (probed 2026-09-22 with `claude --model claude-opus-5-5 -p`).
  // Owner 2026-09-22: the orchestrating roles run on it. The row is the id, never the family.
  // 200k as a ceiling rather than a tier — there is no 1M variant of this one to ask for.
  // the DATED release id slot records carry when spawned with the full name — same 200k ceiling, no 1M variant of it to ask for either.
  // 1M WITHOUT a suffix — the model that broke the old rule, measured 2026-08-18 on a live slot:
  // 176,680 tokens, which its own pane reported as 17.7%.
  // the successor id, named 2026-09-21 because live slots carry exactly this string and published
  // ctx: null without a row (owner intake: „[Zitat entfernt]“).
  // Same source as the opus-5 rows above — the installed Claude Code 2.1.278 model table, read
  // 2026-09-21, carries for this id verbatim
  //   "claude-fable-5-1",…,fallback_3p:"claude-fable-5",context:{window:1e6,native_1m:!0,supports_1m_beta:!0}
  // — its own window is 1M and its third-party fallback is the 1M row above. The row is the id,
  // never the family: `claude-fable-9` appears nowhere in the binary's table and must stay null.
  // The registered ids and windows above are now read from model-register.ts.
  ...Object.fromEntries(MODEL_REGISTER.filter((entry) => entry.harness === "claude" && !entry.id.includes("[")
    && entry.displayWindow !== undefined).map((entry) => [entry.id, entry.displayWindow])),
  // This older bare alias is absent from the adapter list but still appears in slot records.
  "claude-haiku-4-5": CONTEXT_WINDOW_BASE,
  // 1M WITHOUT a suffix — the model that broke the old rule, measured 2026-08-18 on a live slot:
  // 176,680 tokens, which its own pane reported as 17.7%.
  "claude-fable-5": CONTEXT_WINDOW_1M,
  // `fable` — the BARE alias, and a deliberate exception to "ids only". It is what lands in a slot
  // record when a session is spawned by alias: slot 9, the standing supervisor, carries literally
  // this string, so without this row the one slot the incident above happened on publishes no fill
  // at all. Against the row: an alias is resolved by the harness and can be repointed under us, and
  // then the denominator is a guess again. It is here anyway, because an alias resolves within ONE
  // model family and every Fable released so far is 1M — "fable is 1M" survives the next Fable
  // where "fable is claude-fable-5" would not. Note what does NOT get the same treatment: bare
  // `opus`, `sonnet` and `haiku` stay null, because those families genuinely hold both windows
  // across versions (a family alias outlives the version it points at, and the table above only
  // measured the current ids — bare `claude-opus-5` is 1M since 2026-09-19) and the alias says
  // nothing about which one you got.
  // If `fable` is ever repointed out of the Fable family this row is wrong and must be re-measured;
  // dating the measurement is what makes that checkable instead of invisible.
  "fable": CONTEXT_WINDOW_1M,
  // Pi's `claude-bridge` provider, measured 2026-08-21: a live slot spawned as
  // `--model 'claude-bridge/claude-opus-5'` published ctx: null while its own pi footer read
  // `13.0%/1.0M`. The prefix is part of the id and must never be stripped to reach this table —
  // a stripped id is a claim about a different runtime (bare `claude-opus-5` has been 1M too since
  // 2026-09-19, but by Claude Code's own table, not by the bridge's mapping).
  // What makes this a row rather than a guess is not the footer but the bridge's own mapping: it
  // REWRITES the id it hands to Claude Code. pi-claude-bridge 0.6.3, src/models.ts,
  // `resolveClaudeCodeRuntimeModel` maps `claude-opus-5` to cliModelId `claude-opus-5[1m]`,
  // contextWindow 1M, unconditionally — that branch reads no plan setting. The pane really is on the
  // [1m] variant; this row only spells the suffix where Fleet can see it.
  // Against the row: it is a claim about a THIRD-PARTY package at one version. Repoint the bridge,
  // downgrade it, or let that branch turn plan-dependent (two of its siblings already are) and this
  // row is wrong — dating the measurement is what makes that checkable instead of invisible.
  // The siblings are deliberately absent: the bridge's `claude-haiku-4-5` is 200k, and its
  // `claude-opus-4-6`/`claude-sonnet-4-6` hang on a plan flag that lives in the bridge's config and
  // not in anything Fleet reads. Every other `claude-bridge/*` id stays null and asks to be
  // measured — including the ones that package source would let us guess at.
  "claude-bridge/claude-opus-5": CONTEXT_WINDOW_1M,
};
export function contextWindowFor(model: string | null): number | null {
  if (!model) return null;
  if (model === "glm-5.3") return CONTEXT_WINDOW_GLM_5_3;
  // flash's window is a fact of THIS repo: server.ts#PI_ZAI_HARNESS injects contextWindow 1000000 for it.
  if (model === "glm-5.3-flash") return CONTEXT_WINDOW_GLM_5_3;
  if (/(?:^|\/)gpt-[A-Za-z0-9][A-Za-z0-9._-]*(?::[A-Za-z0-9_-]+)?$/i.test(model)) {
    return CONTEXT_WINDOW_GPT;
  }
  const m = /^(claude-[^[]+|fable)(?:\[([A-Za-z0-9]{1,8})\])?$/.exec(model);
  if (!m) return null;
  // An explicit suffix still wins over the table, and still only for a suffix this file recognises.
  // It is not the same kind of claim as the id: whoever spawned the slot WROTE the variant into the
  // name, so `[1m]` is a statement about that pane, not an inference about a model id.
  if (m[2] !== undefined) return m[2].toLowerCase() === "1m" ? CONTEXT_WINDOW_1M : null;
  return CLAUDE_CONTEXT_WINDOWS[m[1]!] ?? null;
}

// --- background-worker contracts ----------------------------------------------------------------
// Every throwaway claude this fleet spawns runs through server.ts's runWorker, and each one owes two
// strings that used to be written by hand in two places each:
//
//   mark — a phrase INTERPOLATED INTO ITS PROMPT and nowhere else. A worker's transcript lands in
//     the same ~/.claude/projects/<cwd> directory as the slot it was run for, so the transcript
//     view's newest-by-mtime fallback would serve it as that slot's own conversation. The live sid
//     set that would otherwise catch it is process memory and is empty after a restart; the mark in
//     the prompt text is then the only thing left to recognise the stray file by. Six of the eight
//     workers had no mark at all until this table existed.
//   key — the first key of the worker's STRICT JSON contract. runWorker polls the transcript until
//     it sees `"<key>"`, and the prompt's own contract line is built from the same value, so a
//     renamed key cannot leave the poller waiting for a string the model was never asked to produce.
//
// Adding a worker means adding a row here: `WorkerSpec.worker` is keyed on this object, so a call
// site that names no contract does not compile, and a contract that exists is automatically in
// BACKGROUND_MARKS. That is the whole mechanism — there is no list to keep in step by hand.
//
// COST, stated because it is real: a mark is prose, and a human conversation whose first 16 KB
// happens to quote one is classified as background and hidden from the transcript view. That only
// touches slots with no pinned session id (a pinned slot never reaches the sniff), and it degrades
// to "no transcript" rather than to someone else's, so the failure is visible and safe in the
// direction that matters. Keep marks specific enough that only the prompt says them.
export interface WorkerContract { mark: string; key: string }
export const WORKER_CONTRACTS = {
  summary: { mark: "read-only reviewer summarizing the state of a coding session", key: "summary" },
  review: { mark: "read-only code reviewer. The diffs below are the WHOLE subject", key: "findings" },
  commitMsg: { mark: "writing ONE git commit message for the uncommitted work in a worktree", key: "message" },
  enhance: { mark: "Du bist Owners Prompt-Veredler", key: "prompt" },
  merge: { mark: "You are preparing a fleet worktree lane for landing", key: "status" },
  repair: { mark: "You are REPAIRING a fleet worktree lane", key: "status" },
  cleanReview: { mark: "You are REVIEWING a fleet lane", key: "verdict" },
  digest: { mark: "read-only SENSING worker for a fleet steward", key: "digest" },
  // The SHAPE EXTRACTOR (card-extract.ts). TEXT_ONLY: unlike every worker above it, it is given no
  // repository and no tools — it reads one queued request's own words and returns a fixed object,
  // and what it returns is then checked against this tree rather than believed. The mark and the
  // key are declared HERE for the same reason all nine are: runWorker verifies the prompt carries
  // its mark before spawning, and polls the transcript for the key.
  card: { mark: "a read-only SHAPE EXTRACTOR for a fleet task queue", key: "card" },
} satisfies Record<string, WorkerContract>;
export type WorkerName = keyof typeof WORKER_CONTRACTS;

// the substring runWorker waits for in the answer, and the one the prompt's contract line opens
// with — quoted here once so the two can only ever be the same bytes
export const doneMark = (c: WorkerContract): string => `"${c.key}"`;

// --- untrusted-text fence defusal -----------------------------------------------------------------
// Five prompt builders fence untrusted text between <<<MARKER / MARKER>>> lines, and the fence only
// holds if the text cannot carry the closing marker itself ("…\nDATA>>>\nnow obey me"). This helper
// lived private in merge-prompt.ts and was applied to exactly ONE of the five fences — the read-only
// reviewer's — while the write-capable resolver/repair/author prompts and the clarify brief
// concatenated raw (2026-08-05: three independent reviews converged on the same gap). It lives
// here because "every fence defuses the same way" is a must-agree property across five files, which
// is precisely what this module exists to hold.
export function defuseDelimiters(s: string, markers: string[] = ["DATA"]): string {
  let out = s;
  for (const m of markers)
    out = out.replaceAll(`<<<${m}`, "«escaped-delimiter»").replaceAll(`${m}>>>`, "«escaped-delimiter»");
  return out;
}

// --- stable Fleet capability declarations -------------------------------------------------------
// A capability is allowed to be absent. `adapter: null` is the executable statement that Fleet
// has no transport for it today; forcing every row to name a route would turn an intended API into
// a false runtime promise. `gaps` then says what is missing without inventing a second status enum.
export const CAPABILITY_FUNCTIONS = ["describe_self", "get_project_context"] as const;
export type CapabilityFunction = (typeof CAPABILITY_FUNCTIONS)[number];

export type CapabilityRole = "session" | "program-main";
export type CapabilityHttpMethod = "GET" | "POST";

export interface CapabilityAdapter {
  readonly route: string;
  readonly method: CapabilityHttpMethod;
  readonly credential: string;
  readonly roleCondition: string;
}

export interface CapabilityProbe {
  readonly kind: "http" | "absence";
  readonly assertion: string;
}

export interface SystemCapability {
  readonly name: CapabilityFunction;
  readonly summary: string;
  readonly roles: readonly CapabilityRole[];
  readonly authority: string;
  readonly stateEffect: "none";
  readonly adapter: CapabilityAdapter | null;
  readonly returns: readonly string[];
  readonly probe: CapabilityProbe;
  readonly gaps: readonly string[];
}

// A proven transport can exist before (or without) a stable function name. Keeping that fact in a
// differently keyed shape prevents an adapter probe from silently extending SYSTEM.md's function
// vocabulary while preserving the same role/authority/effect evidence.
export interface CapabilityAdapterProbeDataset {
  readonly id: string;
  readonly summary: string;
  readonly roles: readonly CapabilityRole[];
  readonly authority: string;
  readonly stateEffect: "none";
  readonly adapter: CapabilityAdapter;
  readonly returns: readonly string[];
  readonly probe: CapabilityProbe;
  readonly gaps: readonly string[];
}

export interface CapabilityDimensionGap {
  readonly dimension: "uiGesture" | "traceEffect" | "harnessSupport";
  readonly gap: string;
}

export type QuestionRole = "lane" | "program-main" | "other-session";
export interface QuestionRoute {
  readonly role: QuestionRole;
  readonly recipient: string;
  readonly adapter: CapabilityAdapter | null;
  readonly constraints: readonly string[];
  readonly gaps: readonly string[];
}

// --- immutable land-candidate identity and future policy inputs --------------------------------
// These are facts, not a PromotionPolicy and not an eligibility decision. The merge server binds
// the three identity fields onto a reviewable verdict; land-candidate.ts projects that record for
// later read-only surfaces without giving the projection any place in a land path.
export interface LandCandidateVerifyRun {
  readonly cmd: string;
  readonly ok: boolean | null;
  readonly out: string;
  readonly at: number;
  readonly mainSha: string;
  readonly stale?: boolean;
  readonly timedOut?: true;
  readonly waitedOut?: true;
  readonly serverDown?: true;
  readonly startedAt?: number;
  readonly ms?: number;
  readonly waitMs?: number;
  readonly waitPartial?: true;
  readonly exitCode?: number | null;
}

export interface LandCandidate {
  readonly mainSha: string;
  readonly candidateSha: string;
  readonly diffHash: string;
  readonly verify: LandCandidateVerifyRun | null;
}

export type CandidateFreshness = "fresh" | "stale" | "unknown";
export type VerifyFreshness = "fresh" | "stale" | "not-run" | "unknown";
export type PromotionRiskClass =
  | "conflict-resolution"
  | "repair-rounds"
  | "verify-failed"
  | "verify-unmeasured"
  | "verify-not-run"
  | "clean-review-flagged";

export interface PromotionPolicyFacts {
  readonly candidate: LandCandidate | null;
  readonly candidateFreshness: CandidateFreshness;
  readonly verifyFreshness: VerifyFreshness;
  readonly riskClasses: readonly PromotionRiskClass[];
  readonly conflicts: readonly string[];
  readonly repairRounds: number;
}

// --- the founding window's role presets ---------------------------------------------------------
// What each founding role switches on over a founding plan (src/founding.ts). Fleet-wide, so the
// owner's redrawn presets live in fleet.json behind POST /api/role-presets (G5.2); the window owns
// the built-in ones. One shape for both sides: the server keeps only what this normalizer accepts,
// and the window applies exactly that. `base` decides an unnamed pack — a repo's own packs come
// along under "all" without anyone naming them — plus/minus are the named exceptions.
export const FOUNDING_ROLES = ["leer", "lane", "orch", "steward"] as const;
export type FoundingRole = (typeof FOUNDING_ROLES)[number];
export interface RolePreset { base: "all" | "none"; plus: string[]; minus: string[] }
export type RolePresets = Partial<Record<FoundingRole, RolePreset>>;
export const ROLE_PRESET_IDS_MAX = 64;
const ROLE_PRESET_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
// null for anything else — an unknown role, a third base, a non-id — never a partial repair
export function normalizeRolePresets(x: unknown): RolePresets | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const out: RolePresets = {};
  const ids = (a: unknown): string[] | null =>
    Array.isArray(a) && a.length <= ROLE_PRESET_IDS_MAX && a.every((i) => typeof i === "string" && ROLE_PRESET_ID_RE.test(i))
      ? [...new Set(a as string[])] : null;
  for (const [role, v] of Object.entries(x)) {
    if (!(FOUNDING_ROLES as readonly string[]).includes(role) || !v || typeof v !== "object" || Array.isArray(v)) return null;
    const { base, plus, minus } = v as Record<string, unknown>;
    const p = ids(plus), m = ids(minus);
    if ((base !== "all" && base !== "none") || !p || !m) return null;
    out[role as FoundingRole] = { base, plus: p, minus: m };
  }
  return out;
}

// --- the founding plan's pack rows, and the preview held against the receipt ---------------------
// GET /api/founding-plan writes one row per selected pack (server.ts, the route) and the founding
// window reads it (src/founding.ts#validPlan); after a start the window holds that PREVIEW against the
// receipt the delivery wrote (GET /api/context-receipts). The fields come from the plan itself — the
// stamped source hash and the declared rule facts — never from a second read of a source.
// `harnesses` is the pack's ALLOWED list, never a claim about who wrote it or which model fits: the
// pack schema has no model field (context-pack-validator.ts refuses one), so no row names a model.
export type PackAnchors = readonly { readonly path: string; readonly anchor: string }[] | { readonly privateSourceId: string };
export interface FoundingPlanPart {
  id: string; packId: string | null; path: string | null; anchor: string | null; privateSourceId?: string;
  sorte: "anleitung" | "wissen"; ort: "box" | "ausleihe";
  sha256: string | null; bytes: number | null; content: string | null;
  refusal: "source-unavailable" | "source-anchor-missing" | "source-anchor-ambiguous" | null;
}
export interface FoundingSessionAgents {
  text: string; bytes: number; parts: readonly FoundingPlanPart[]; projectDocMaxBytes?: number;
}
export interface FoundingPlanPack {
  id: string; bytes: number; source: "fleet-seed" | "repo-manifest"; useWhen?: string;
  // absent on a server older than these fields — the window says "nicht gemeldet", never guesses
  harnesses?: string[]; triggers?: string[]; anchors?: PackAnchors; sourceHash?: string;
  group?: "grundlagen" | "pruefen-landen" | "sessions-fuehren" | "vor-arbeiten"; parts?: readonly FoundingPlanPart[];
}
export interface FoundingPlanOmission { id: string; reason: string; harnesses?: string[] }

// A pack's FASSUNG exists only where its id declares one, by the suffix `-v<N>` (codex-native-context-v1).
// A source hash is the version of the bytes a pointer points INTO, a konzept ledger version is the
// private file's own count — neither is a pack fassung, and an id without the suffix has none.
const PACK_ID_FASSUNG_RE = /-v([1-9]\d{0,3})$/;
export function packIdFassung(id: string): number | null {
  const m = PACK_ID_FASSUNG_RE.exec(id);
  return m ? Number(m[1]) : null;
}

// PREVIEW AGAINST RECEIPT. The preview is the source state when the window PLANNED; the receipt is the
// state the delivery seam stamped when it SENT. Per requested pack:
//  same          both sides name a hash and the anchors, and they agree
//  changed       both sides name them and they differ — the receipt's is what was delivered
//  unknown       one side names no hash (an old receipt, an old server, an unobservable source)
//  drift         a private pack whose file at delivery is not the declared fassung
//  not-delivered requested, but the receipt carries it as omitted, or not at all
//  extra         in the receipt without having been requested
// `unknown` is never `same`: a missing fact is never a compatibility pass. Delivered says the pointer
// was in the brief — whether the agent read it is not a fact either side has.
export type PackStandKind = "same" | "changed" | "unknown" | "drift" | "not-delivered" | "extra";
export interface PackStandRow { id: string; stand: PackStandKind; preview: string | null; delivered: string | null; why: string | null }
export interface PackStandPreview {
  head: string | null;
  packs: readonly { id: string; anchors?: PackAnchors; sourceHash?: string }[];
}
export interface PackStandReceipt {
  head?: unknown;
  selected: readonly { id: string; anchors?: unknown; sourceHash?: unknown; private?: { verdict?: unknown; version?: unknown } }[];
  omitted?: readonly { id: string; why?: unknown; reason?: unknown }[];
}
export interface PackStand { head: "same" | "changed" | "unknown"; previewHead: string | null; deliveredHead: string | null; packs: PackStandRow[] }

export function standSincePreview(preview: PackStandPreview | null, receipt: PackStandReceipt, requested: readonly string[]): PackStand {
  const str = (v: unknown): string | null => typeof v === "string" && v ? v : null;
  const previewHead = preview?.head ?? null;
  const deliveredHead = str(receipt.head);
  const head = previewHead === null || deliveredHead === null ? "unknown" : previewHead === deliveredHead ? "same" : "changed";
  const packs: PackStandRow[] = [];
  for (const id of requested) {
    const got = receipt.selected.find((p) => p.id === id);
    const before = preview?.packs.find((p) => p.id === id);
    const was = before?.sourceHash ?? null;
    if (!got) {
      const o = receipt.omitted?.find((p) => p.id === id);
      const why = o ? [str(o.why), str(o.reason)].filter(Boolean).join(": ") || null : null;
      packs.push({ id, stand: "not-delivered", preview: was, delivered: null, why });
      continue;
    }
    const now = str(got.sourceHash);
    if (got.private && typeof got.private === "object") {
      const verdict = str(got.private.verdict);
      const stand: PackStandKind = verdict === "match" ? "same" : verdict === "drift" ? "drift"
        : verdict === "missing" ? "not-delivered" : "unknown";
      packs.push({ id, stand, preview: was, delivered: now, why: verdict });
      continue;
    }
    if (was === null || now === null) { packs.push({ id, stand: "unknown", preview: was, delivered: now, why: null }); continue; }
    const anchorsMoved = before?.anchors !== undefined && got.anchors !== undefined
      && JSON.stringify(before.anchors) !== JSON.stringify(got.anchors);
    packs.push({ id, stand: was !== now || anchorsMoved ? "changed" : "same", preview: was, delivered: now,
      why: anchorsMoved ? "anchors" : was !== now ? "sourceHash" : null });
  }
  for (const got of receipt.selected)
    if (!requested.includes(got.id)) packs.push({ id: got.id, stand: "extra", preview: null, delivered: str(got.sourceHash), why: null });
  return { head, previewHead, deliveredHead, packs };
}

export interface FactReason { field: string; reason: string }
export interface WorktreeDistance { ahead: number; behind: number }
export interface WorkplaceBranch {
  branch: "main" | "overhaul"; head: string | null;
  distance: WorktreeDistance | null; reasons: FactReason[];
}
export interface WorkplaceCheck {
  state: "running" | "green" | "red" | "skipped" | "waiting";
  head: string | null; at: number | null; fails: string[]; stale: boolean | null;
}
export type WorkplaceChecks = Record<"local" | "preview" | "gate" | "audit", WorkplaceCheck | null>;
export interface WorkplaceRow {
  path: string; primary: boolean; branch: string | null; head: string | null;
  base: { branch: string; head: string } | null; distance: WorktreeDistance | null;
  dirty: number | null; mirrored?: true;
  session: { slot: number; openedAt: number; taskId: string | null } | null;
  target: { branch: string; head: string | null; behind: number | null;
    landed: "yes" | "no" | null; landedAs: string | null; basis: "land-note" };
  checks: WorkplaceChecks;
  template: "present" | "missing" | null;
  testinstanz: { state: string; instance: Record<string, unknown> } | null;
  reasons: FactReason[];
}
export interface WorkplaceRepo {
  repo: string; branches: WorkplaceBranch[] | null;
  worktrees: WorkplaceRow[] | null; landNotes: { truncated: boolean | null }; reasons: FactReason[];
}
export interface WorkplaceGitComparison {
  ref: string; head: string | null; mergeBase: string | null; distance: WorktreeDistance | null;
  codeBehind: boolean | null; reasons: FactReason[];
}
export interface WorkplaceRemote extends Omit<WorkplaceGitComparison, "ref"> {
  ref: string | null; name: string | null; refUpdatedAt: number | null; refAgeMs: number | null;
}
export interface WorkplaceStand {
  kind: "worktree" | "live-server" | "test-instance" | "helper-daemon" | "helper-instance" | "helper-repo" | "linked-instance";
  repo: string | null; name: string | null; path: string | null; head: string | null;
  basis: "worktree-head" | "boot-head" | "copy-unproven" | "checkout-unproven" | "heartbeat" | "link-only";
  reportedCheckout?: { head: string; observedAt: number };
  reportedBranch?: string | null;
  remotes?: string[] | null;
  coverage?: { state: "complete" | "incomplete" | "unreported"; reason: string | null };
  codeScope: "server" | "helper-daemon" | "repository";
  observedAt: number | null; target: WorkplaceGitComparison | null;
  remote: "none" | WorkplaceRemote[] | null;
  update: { state: string; main: string | null; mainSha: string | null } | null; reasons: FactReason[];
}
export interface Workplaces { repos: WorkplaceRepo[]; stands: WorkplaceStand[]; measuredAt: number; cacheMs: number }
// GET /api/branches (Neuaufbau K5, server/branches.ts): je Repo die Branches mit Board-Namen und die
// übrigen Branches für „Bestehend öffnen“. `base` ist die Basis, gegen die Abstand und Diff zählen
// (die des Branches, sonst der Integrationszweig). `text` ist die Punkteliste, zugleich der Notizblock; `rev`
// ist der Stand, gegen den POST /api/branches/note schreibt. `seen` ist „Owner hat gesehen / passt“
// an genau `seen.head`; ob das noch die Spitze ist, sagt der Vergleich mit `head`.
export interface BranchSeenView { at: number; head: string; via: "cookie" | "bearer" | "query" }
// A CHARGE (K5 S3) is the branch's commits since its last charge (`chargeBase`, the tip of the last
// one); `chargeCommits` counts them. `check` is the merge check of the current tip against that base —
// null where the repo has no ci/merge-check.ts (a charge there needs the explicit „ohne Merge-Check“).
// `form` says how a charge landed (K16): "squash" one commit, "commits" main fast-forwarded to the
// merge check's candidate; `landForm` on the branch is how the next one lands when the board does not say.
export interface BranchLandView { sha: string; at: number; subject: string; points: string[]; passt: boolean; checked: boolean; form: "squash" | "commits" }
export interface BranchCheckView { state: "none" | "running" | "green" | "red" | "stale"; at: number | null; why: string | null }
export interface BranchView {
  branch: string; name: string; base: string | null; head: string;
  text: string; rev: number; seen: BranchSeenView | null;
  path: string | null; session: { slot: number; openedAt: number } | null;
  distance: WorktreeDistance | null;
  lands: BranchLandView[]; landForm: "squash" | "commits"; chargeBase: string | null; chargeCommits: number | null; check: BranchCheckView | null;
}
export interface BranchOtherView { branch: string; head: string; at: number; path: string | null }
export interface BranchesRepoView {
  // integration: the branch charges land on (main), null when the repo has none readable
  repo: string; integration: string | null; branches: BranchView[]; others: BranchOtherView[]; othersTotal: number; reasons: FactReason[];
  // how this repo checks a charge (server/pruefbefehl.ts): its own ci/merge-check.ts, the owner's check command, or none yet —
  // and a command a session proposed, which runs only once the owner takes it
  checkCommand?: RepoCheckView;
}
export interface RepoCheckView { way: "merge-check" | "command" | "none"; cmd: string | null; by: string | null; at: number | null;
  proposal: { cmd: string; by: string; at: number } | null }
export interface BranchesView { repos: BranchesRepoView[] }
export interface DeployLand {
  sha: string; branch: string | null; task: string | null; at: number | null;
  reasons: FactReason[];
}
export interface DeployGap {
  bootHead: string | null; head: string | null; behindCount: number | null;
  codeBehind: boolean | null; codeBehindUnknown: string[] | null;
  lands: DeployLand[] | null; truncated: boolean | null; reasons: FactReason[];
}


export type PerfJourney = "J1" | "J2" | "J3" | "J4";
export interface PerfAttrs {
  view?: "chat" | "term";
  shelf?: boolean;
  bytes?: number;
  entries?: number;
  htmlBytes?: number;
  bundleBytes?: number;
  cold?: boolean;
  hidden?: boolean;
  reason?: "composer-timeout" | "fetch-error" | "http-error";
  bubbleMs?: number | null;
  responseMs?: number | null;
  transcriptMs?: number | null;
  serverMs?: "ws-seed-unmeasured" | "timing-unavailable";
}
export interface PerfRecord {
  j: PerfJourney;
  ms: number | null;
  clientMs: number | null;
  serverMs: number | null;
  netMs: number | null;
  dev: "mobile" | "desktop";
  saver: boolean;
  v: number;
  slots: number;
  ok: boolean;
  attrs?: PerfAttrs;
}
// THE BOARD MEASURES ITSELF ON THE OWNER'S DEVICE (UI-MAIN 11.10., owner „[Zitat entfernt]“):
// one row per open page and minute, numbers only — no token, no content, no path beyond the /api route
// shape. `firstSlotMs` is navigation start → the first painted row of the left bar (once per page);
// `clicks` each click in the left bar, the right tab or the queue → the paint after the DOM answered;
// `routes` the /api requests of the minute by route shape (`/api/slots/:n/brief`), count and bytes;
// `selfMs` what the measuring itself cost inside its handlers that minute (src/fieldperf.ts).
export const FIELD_AREAS = ["side", "board", "queue"] as const;
export type FieldArea = typeof FIELD_AREAS[number];
// `pastes` (Mangel 64, owner 14.10. 12:0x: „[Zitat entfernt]“): one entry per Cmd/Ctrl+V
// and per paste into the chat field — where the keys stood (`el`: the chat field, the terminal, body, anything else;
// null for a paste without the keys, from a menu), whether a handler cancelled the keys (`keyOff`), whether a paste
// event reached the chat field (`ev`), cancelled (`off`) or carrying files, whether the field grew within 100 ms
// (`landed`), whether text on the page stood selected at the keys (`sel`: copied from the board itself), how long
// after the window last came to the front, and what the paste event carried: the length of its plain text (`len`)
// and how many types (`types`) — null for keys no paste followed. Measured 14.10. 13:5x: the paste reaches the field
// uncancelled and still lands nothing the first time; `len` tells an empty clipboard from text the board lost. Flags and numbers only, never the text; a row
// without a paste leaves the field out, so the rows before it stay valid.
export const FIELD_PASTE_ELS = ["ta", "term", "body", "other"] as const;
export type FieldPasteEl = typeof FIELD_PASTE_ELS[number];
export interface FieldPaste {
  el: FieldPasteEl | null; keyOff: boolean; ev: boolean; off: boolean; files: boolean; landed: boolean; sel: boolean;
  sinceFrontMs: number | null; len: number | null; types: number | null;
}
export interface FieldRow {
  v: number; sha: string | null;
  dev: { w: number; h: number; touch: boolean; ua: string };
  pageMs: number; windowMs: number; firstSlotMs: number | null;
  clicks: { a: FieldArea; ms: number }[];
  routes: Record<string, { n: number; bytes: number }>;
  selfMs: number;
  pastes?: FieldPaste[];
}
export const FIELD_CLICKS_MAX = 200, FIELD_ROUTES_MAX = 60, FIELD_PASTES_MAX = 50;
const FIELD_UA = /^(chrome|safari|firefox|edge|other)-(ios|android|mac|win|linux|other)$/;
const PASTE_FLAGS = ["keyOff", "ev", "off", "files", "landed", "sel"] as const;
function validPaste(p: unknown): boolean {
  if (!p || typeof p !== "object" || Array.isArray(p)) return false;
  const x = p as Record<string, unknown>;
  return Object.keys(x).length === 10 && (x.el === null || (FIELD_PASTE_ELS as readonly unknown[]).includes(x.el))
    && PASTE_FLAGS.every((k) => typeof x[k] === "boolean")
    && (x.sinceFrontMs === null || (typeof x.sinceFrontMs === "number" && Number.isFinite(x.sinceFrontMs) && x.sinceFrontMs >= 0 && x.sinceFrontMs <= 86_400_000))
    && (x.len === null || (Number.isSafeInteger(x.len) && Number(x.len) >= 0 && Number(x.len) <= 10_000_000))
    && (x.types === null || (Number.isSafeInteger(x.types) && Number(x.types) >= 0 && Number(x.types) <= 100));
}
export function validFieldRow(raw: unknown): raw is FieldRow {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const r = raw as Record<string, unknown>;
  const keys = ["v", "sha", "dev", "pageMs", "windowMs", "firstSlotMs", "clicks", "routes", "selfMs", ...("pastes" in r ? ["pastes"] : [])];
  if ("pastes" in r && !(Array.isArray(r.pastes) && r.pastes.length >= 1 && r.pastes.length <= FIELD_PASTES_MAX && r.pastes.every(validPaste)))
    return false;
  if (Object.keys(r).length !== keys.length || !keys.every((k) => k in r)) return false;
  const ms = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 86_400_000;
  const int = (n: unknown, max: number) => Number.isSafeInteger(n) && Number(n) >= 0 && Number(n) <= max;
  if (!int(r.v, Number.MAX_SAFE_INTEGER) || !(r.sha === null || (typeof r.sha === "string" && /^[0-9a-f]{7,40}$/.test(r.sha)))) return false;
  const d = r.dev as Record<string, unknown> | null;
  if (!d || typeof d !== "object" || Object.keys(d).length !== 4 || !int(d.w, 20_000) || !int(d.h, 20_000)
    || typeof d.touch !== "boolean" || typeof d.ua !== "string" || !FIELD_UA.test(d.ua)) return false;
  if (!ms(r.pageMs) || !ms(r.windowMs) || !(r.firstSlotMs === null || ms(r.firstSlotMs)) || !ms(r.selfMs)) return false;
  if (!Array.isArray(r.clicks) || r.clicks.length > FIELD_CLICKS_MAX || !r.clicks.every((c) => !!c && typeof c === "object"
    && Object.keys(c).length === 2 && (FIELD_AREAS as readonly unknown[]).includes((c as { a: unknown }).a) && ms((c as { ms: unknown }).ms))) return false;
  const routes = r.routes as Record<string, unknown> | null;
  if (!routes || typeof routes !== "object" || Array.isArray(routes) || Object.keys(routes).length > FIELD_ROUTES_MAX) return false;
  return Object.entries(routes).every(([k, x]) => /^\/api(\/[a-z0-9:_-]{1,40}){0,6}$/.test(k) && !!x && typeof x === "object"
    && Object.keys(x).length === 2 && int((x as { n: unknown }).n, 100_000) && int((x as { bytes: unknown }).bytes, 1e12));
}
export const PERF_BATCH_MAX = 50;
export const PERF_BODY_MAX = 64_000;
export const PERF_ROTATE_BYTES = 1_000_000;
const perfMs = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 86_400_000;
export function validPerfRecord(raw: unknown): raw is PerfRecord {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const r = raw as Record<string, unknown>;
  if (Object.keys(r).some((k) => !["j", "ms", "clientMs", "serverMs", "netMs", "dev", "saver", "v", "slots", "ok", "attrs"].includes(k))) return false;
  if (!["J1", "J2", "J3", "J4"].includes(r.j as string) || !["mobile", "desktop"].includes(r.dev as string)
    || typeof r.saver !== "boolean" || typeof r.ok !== "boolean"
    || !Number.isSafeInteger(r.v) || Number(r.v) < 0 || !Number.isSafeInteger(r.slots) || Number(r.slots) < 0 || Number(r.slots) > 1000) return false;
  if (![r.ms, r.clientMs, r.serverMs, r.netMs].every((n) => n === null || perfMs(n))) return false;
  if (r.ok ? !perfMs(r.ms) || !perfMs(r.clientMs) : r.ms !== null || r.clientMs !== null || r.serverMs !== null || r.netMs !== null) return false;
  if (r.attrs !== undefined) {
    if (!r.attrs || typeof r.attrs !== "object" || Array.isArray(r.attrs)) return false;
    const a = r.attrs as Record<string, unknown>;
    for (const [k, v] of Object.entries(a)) {
      if (["bytes", "entries", "htmlBytes", "bundleBytes"].includes(k)) { if (!Number.isSafeInteger(v) || Number(v) < 0) return false; }
      else if (["bubbleMs", "responseMs", "transcriptMs"].includes(k)) { if (v !== null && !perfMs(v)) return false; }
      else if (["shelf", "cold", "hidden"].includes(k)) { if (typeof v !== "boolean") return false; }
      else if (k === "reason") { if (v !== "composer-timeout" && v !== "fetch-error" && v !== "http-error") return false; }
      else if (k === "view") { if (v !== "chat" && v !== "term") return false; }
      else if (k === "serverMs") { if (v !== "ws-seed-unmeasured" && v !== "timing-unavailable") return false; }
      else return false;
    }
  }
  return true;
}
export function nearestRank(sorted: readonly number[], q: number): number | null {
  return sorted.length ? sorted[Math.ceil(q * sorted.length) - 1] : null;
}
