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
export interface InstanceIdentity { name: string | null }
export function instanceNameFrom(value: unknown): string | null {
  return typeof value === "string" && INSTANCE_NAME_RE.test(value) ? value : null;
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

export interface InstanceLink { name: string; url: string }
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
    const e = entry as { name?: unknown; url?: unknown };
    const name = instanceNameFrom(e.name);
    if (name === null) { rejected.push(`entry #${i} has no valid name: ${shortly(e.name)}`); continue; }
    const rawUrl = typeof e.url === "string" ? e.url.trim().replace(/\/$/, "") : "";
    if (!INSTANCE_URL_RE.test(rawUrl)) {
      rejected.push(`entry #${i} (${name}) has no valid http(s) origin as url: ${shortly(e.url)}`);
      continue;
    }
    const key = rawUrl.toLowerCase();
    if (seen.has(key)) { rejected.push(`entry #${i} (${name}) repeats an url already listed: ${shortly(rawUrl)}`); continue; }
    const cost = JSON.stringify({ name, url: rawUrl }).length + (links.length ? 1 : 0);
    if (bytes + cost > INSTANCE_LINKS_MAX_BYTES) {
      rejected.push(`entry #${i} (${name}) does not fit the ${INSTANCE_LINKS_MAX_BYTES} B list budget`);
      continue;
    }
    bytes += cost;
    seen.add(key);
    links.push({ name, url: rawUrl });
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

// --- disposition rail ---------------------------------------------------------------------------
// Which advisory worker an owner verdict is about, and the verdict vocabulary. The server validates
// POST /api/dispositions against these lists; the client renders the same four words and sends the
// same worker names. Typing the client's call sites against `DispositionWorker` is what makes
// a mistyped "review-3" a compile error instead of a 400 nobody sees.
// A fourth worker — `analysis`, the queue analyst's verdict on ONE task row, ref = the taskId —
// stood here until 2026-09-10. The analyst is retired, so nothing produces a reading to have an
// opinion about and the write door closes with it. The rail is append-only and the READER validates
// no worker name, so the labels already filed under it stay readable: closing the door retires a
// producer, it does not rewrite what an owner once said. `enhance` — the ✨ compose-box rework,
// ref = the draftId POST /api/enhance stamped — followed on 2026-09-19 for the same reason: the
// route is gone, so no draft exists to label, and its filed rows stay readable the same way.
export type DispositionWorker = "land" | "review3";
export type DispositionVerdict = "accepted" | "edited" | "ignored" | "wrong";
export const DISPOSITION_WORKERS: DispositionWorker[] = ["land", "review3"];
export const DISPOSITION_VERDICTS: DispositionVerdict[] = ["accepted", "edited", "ignored", "wrong"];

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
  } | null;
  // lands whose audit has not begun: coalesced into the NEXT run, and today indistinguishable from
  // "no audit planned" on every surface. `at` is when the land queued them.
  waiting: { repo: string; main: string; branch: string; mainAfter: string; at: number }[];
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
// Baked into every pane command that does not pin its own model. It lives here because
// fleet-e2e-claude-gate.ts asserts the exact quoted form `--model 'claude-opus-5[1m]'` reaches the
// tmux line (unquoted, zsh's no-match glob kills every spawn), and that assertion used to carry its
// own copy of the string — a copy that would keep passing after the server's default moved.
export const FLEET_DEFAULT_MODEL = "claude-opus-5[1m]";

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
  "claude-opus-5": CONTEXT_WINDOW_1M,
  // the successor id, read 2026-09-22 out of the installed Claude Code 2.1.280 model table
  // (~/.local/share/claude/versions/2.1.280), which carries for this id verbatim
  //   "claude-opus-5-5",…,fallback_3p:"claude-opus-5",context:{window:1e6,native_1m:!0,supports_1m_beta:!0,supports_1m_suffix:!0}
  // — the id answers on this machine too (probed 2026-09-22 with `claude --model claude-opus-5-5 -p`).
  // Owner 2026-09-22: the orchestrating roles run on it. The row is the id, never the family.
  "claude-opus-5-5": CONTEXT_WINDOW_1M,
  "claude-sonnet-5": CONTEXT_WINDOW_1M,
  // 200k as a ceiling rather than a tier — there is no 1M variant of this one to ask for.
  "claude-haiku-4-5": CONTEXT_WINDOW_BASE,
  // the DATED release id slot records carry when spawned with the full name — same 200k ceiling, no 1M variant of it to ask for either.
  "claude-haiku-4-5-20251001": CONTEXT_WINDOW_BASE,
  // 1M WITHOUT a suffix — the model that broke the old rule, measured 2026-08-18 on a live slot:
  // 176,680 tokens, which its own pane reported as 17.7%.
  "claude-fable-5": CONTEXT_WINDOW_1M,
  // the successor id, named 2026-09-21 because live slots carry exactly this string and published
  // ctx: null without a row (owner intake: "Fable Sessions scheinen keine KontextZahl anzuzeigen").
  // Same source as the opus-5 rows above — the installed Claude Code 2.1.278 model table, read
  // 2026-09-21, carries for this id verbatim
  //   "claude-fable-5-1",…,fallback_3p:"claude-fable-5",context:{window:1e6,native_1m:!0,supports_1m_beta:!0}
  // — its own window is 1M and its third-party fallback is the 1M row above. The row is the id,
  // never the family: `claude-fable-9` appears nowhere in the binary's table and must stay null.
  "claude-fable-5-1": CONTEXT_WINDOW_1M,
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
  if (model === "x-preview-f-free") return CONTEXT_WINDOW_1M;
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
  enhance: { mark: "Du bist JPs Prompt-Veredler", key: "prompt" },
  merge: { mark: "You are preparing a fleet worktree lane for landing", key: "status" },
  repair: { mark: "You are REPAIRING a fleet worktree lane", key: "status" },
  cleanReview: { mark: "You are REVIEWING a fleet lane", key: "verdict" },
  digest: { mark: "read-only SENSING worker for a fleet steward", key: "digest" },
  // one key for BOTH answer shapes on purpose: runWorker polls the transcript for `"tasks"` and
  // returns the moment it appears, so a triage answer keyed on anything else ("unchanged") would
  // sit out the full timeout before the poller gave up and returned it anyway. The refiner's
  // contract therefore always spells `tasks` — an empty array plus `unchanged: true` is how it
  // says "already brief-shaped" (refine-prompt.ts).
  refine: { mark: "a read-only BRIEF COMPILER for a fleet task queue", key: "tasks" },
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

// Question transports are role policy, not a fourth stable Fleet function: `ask_question` remains
// future vocabulary. Keeping the current rail beside the capability rows still lets a reader learn
// where a question goes without repeating the Supervisor brief's false attention promise.
export type QuestionRole = "lane" | "program-main" | "supervisor" | "other-session";
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
