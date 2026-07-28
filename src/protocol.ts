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

// --- disposition rail ---------------------------------------------------------------------------
// Which advisory worker an owner verdict is about, and the verdict vocabulary. The server validates
// POST /api/dispositions against these lists; the client renders the same four words and sends the
// same three worker names. Typing the client's call sites against `DispositionWorker` is what makes
// a mistyped "review-3" a compile error instead of a 400 nobody sees.
export type DispositionWorker = "land" | "review3" | "enhance";
export type DispositionVerdict = "accepted" | "edited" | "ignored" | "wrong";
export const DISPOSITION_WORKERS: DispositionWorker[] = ["land", "review3", "enhance"];
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

// --- the fleet's default interactive model ------------------------------------------------------
// Baked into every pane command that does not pin its own model. It lives here because
// fleet-e2e-claude-gate.ts asserts the exact quoted form `--model 'claude-opus-5[1m]'` reaches the
// tmux line (unquoted, zsh's no-match glob kills every spawn), and that assertion used to carry its
// own copy of the string — a copy that would keep passing after the server's default moved.
export const FLEET_DEFAULT_MODEL = "claude-opus-5[1m]";

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
} satisfies Record<string, WorkerContract>;
export type WorkerName = keyof typeof WORKER_CONTRACTS;

// the substring runWorker waits for in the answer, and the one the prompt's contract line opens
// with — quoted here once so the two can only ever be the same bytes
export const doneMark = (c: WorkerContract): string => `"${c.key}"`;
