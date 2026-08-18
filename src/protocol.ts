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
// same four worker names. Typing the client's call sites against `DispositionWorker` is what makes
// a mistyped "review-3" a compile error instead of a 400 nobody sees.
// `analysis` is the queue analyst's verdict on ONE task row, and it is the only worker here whose
// most valuable hit produces no lane at all: a `needs-you` the owner agrees with ends in a rewritten
// row, so an outcome-ledger join can never see it. Its ref is the taskId — see the ref-shape block
// in server.ts.
export type DispositionWorker = "land" | "review3" | "enhance" | "analysis";
export type DispositionVerdict = "accepted" | "edited" | "ignored" | "wrong";
export const DISPOSITION_WORKERS: DispositionWorker[] = ["land", "review3", "enhance", "analysis"];
export const DISPOSITION_VERDICTS: DispositionVerdict[] = ["accepted", "edited", "ignored", "wrong"];

// --- post-land audit projection -----------------------------------------------------------------
// The compact row the 2 s poll carries (server: postLandAuditSummary). Deliberately tolerant: every
// field but `at` and `result` is optional, because a row written before a field existed must degrade
// to "not recorded" rather than to a claim. The server's projection is TYPED as this, so a field
// added there without adding it here fails the excess-property check.
export interface PostLandAuditInfo {
  at: number; ms?: number; result: string; repo?: string; main?: string;
  mainSha?: string; covers?: string[]; reason?: string;
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
// provider's denominator.
export const CONTEXT_WINDOW_BASE = 200_000;
export const CONTEXT_WINDOW_1M = 1_000_000;
export const CONTEXT_WINDOW_GPT = 258_400;
export const CONTEXT_WINDOW_GLM_5_3 = 1_000_000;
// The named set the no-suffix door reads. Every row is a measured or structurally forced claim, not
// a family guess; adding a model is one line plus the ground it stands on.
const CLAUDE_CONTEXT_WINDOWS: Readonly<Record<string, number | undefined>> = {
  // 200k base, and the proof is in this repo rather than in a vendor page: the fleet asks for the
  // 1M variant of both of these by spelling the `[1m]` suffix (FLEET_DEFAULT_MODEL above,
  // SUMMARY_MODEL in server.ts). A window you have to ask for is not the one the bare id gives you.
  "claude-opus-5": CONTEXT_WINDOW_BASE,
  "claude-sonnet-5": CONTEXT_WINDOW_BASE,
  // 200k as a ceiling rather than a tier — there is no 1M variant of this one to ask for.
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
  // (`claude-opus-5` vs `claude-opus-5[1m]`) and the alias says nothing about which one you got.
  // If `fable` is ever repointed out of the Fable family this row is wrong and must be re-measured;
  // dating the measurement is what makes that checkable instead of invisible.
  "fable": CONTEXT_WINDOW_1M,
};
export function contextWindowFor(model: string | null): number | null {
  if (!model) return null;
  if (model === "glm-5.3") return CONTEXT_WINDOW_GLM_5_3;
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
  analysis: { mark: "the ANALYST for a fleet task queue", key: "analyses" },
} satisfies Record<string, WorkerContract>;
export type WorkerName = keyof typeof WORKER_CONTRACTS;

// the substring runWorker waits for in the answer, and the one the prompt's contract line opens
// with — quoted here once so the two can only ever be the same bytes
export const doneMark = (c: WorkerContract): string => `"${c.key}"`;

// --- untrusted-text fence defusal -----------------------------------------------------------------
// Five prompt builders fence untrusted text between <<<MARKER / MARKER>>> lines, and the fence only
// holds if the text cannot carry the closing marker itself ("…\nDATA>>>\nnow obey me"). This helper
// lived private in merge-prompt.ts and was applied to exactly ONE of the five fences — the read-only
// reviewer's — while the write-capable resolver/repair/author prompts, the queue analyst and the clarify
// brief concatenated raw (2026-08-05: three independent reviews converged on the same gap). It lives
// here because "every fence defuses the same way" is a must-agree property across five files, which
// is precisely what this module exists to hold.
export function defuseDelimiters(s: string, markers: string[] = ["DATA"]): string {
  let out = s;
  for (const m of markers)
    out = out.replaceAll(`<<<${m}`, "«escaped-delimiter»").replaceAll(`${m}>>>`, "«escaped-delimiter»");
  return out;
}
