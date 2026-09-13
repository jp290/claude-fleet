// .claude/hooks/lane-permission.ts — a lane never waits on a permission dialog nobody answers.
//
// MEASURED 2026-09-13 (claude 2.1.270, bypassPermissions, scratch tmux): some Claude Code safety
// checks ask a human even in bypass mode — "Dangerous rm operation on possibly-empty variable path:
// $SP/$v … Do you want to proceed? ❯ 1. Yes / 2. No". A lane's pane has no human, no Fleet sensor
// saw the dialog, and a server paste+Enter would pick the preselected "1. Yes". The probe that
// decided this file's shape:
//   · the dialog passes through the PermissionRequest hook (PreToolUse fires first, too, but only
//     PermissionRequest fires EXACTLY when a dialog would be shown — no heuristic to re-implement);
//   · `decision.behavior: "deny"` suppresses it, the message reaches the model as the tool error,
//     and the session carries on with its next step without anyone typing;
//   · the hook input carries tool_name + tool_input and NOT the dialog's question text, so the
//     reason below quotes the REQUEST verbatim — the question itself is not available to a hook;
//   · Notification `permission_prompt` still fires in bypass mode for a dialog no deny covered.
//
// TWO MODES, one decision function, so the two can never disagree about what happened:
//   decide  — synchronous, local, no network: prints the deny JSON or nothing (= the normal dialog).
//   report  — registered `async`, so the network never delays a decision: tells the server.
// Exit is ALWAYS 0. Exit 2 would block, and unparseable input must never block a session.
//
// WHO IS DENIED: only a Fleet LANE. FLEET_SELF_SLOT is in every pane since d02f1ec and says nothing
// about lane-ness; FLEET_SELF_LANE is baked by server.ts#ensureSlot from `s.worktree`, the same
// predicate every lane-only /api/self route answers 409 on. Everyone else (owner, MAIN, a clone of
// this public repo) gets no output — Claude Code then asks exactly as it would without this file.

export const HARNESS_BLOCK_ROUTE = "/api/self/harness-block";
export const HOOK_DETAIL_MAX = 300;
const REASON_REQUEST_MAX = 1000;
const REPORT_TIMEOUT_MS = 5000;
// the notifications that mean "this session is waiting for a person". idle_prompt is NOT one: an
// idle lane is the ordinary end of a turn, and the done-looking sensors already see it.
export const WAITING_NOTIFICATIONS: readonly string[] = ["permission_prompt", "elicitation_dialog", "agent_needs_input"];

export interface HarnessSignal {
  signal: "denied" | "waiting";
  tool: string | null;
  detail: string;
}

export type HookOutcome =
  | { kind: "pass"; why: string }
  | { kind: "deny"; reason: string; report: HarnessSignal }
  | { kind: "report"; report: HarnessSignal };

type Env = Record<string, string | undefined>;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

export const isLaneEnv = (env: Env): boolean => env.FLEET_SELF_LANE === "1" && !!env.FLEET_SELF_TOKEN;

// a 32+ hex run is the shape of every Fleet credential; a request quoting one must not carry it on
const redact = (text: string): string => text.replace(/[0-9a-fA-F]{32,}/g, "…");

function requestText(toolInput: unknown): string {
  if (isRecord(toolInput) && typeof toolInput.command === "string") return toolInput.command;
  try { return JSON.stringify(toolInput) ?? ""; } catch { return ""; }
}

// an rm whose path holds an unguarded $VAR is the measured case; `${VAR:?}` makes the shell abort
// on an empty variable, which is what the harness is afraid of
const UNGUARDED_RM = /\brm\b[^\n;&|]*\$(?:[A-Za-z_]\w*|\{[A-Za-z_]\w*(?![^}]*:\?)[^}]*\})/;

export function denyReason(tool: string | null, request: string): string {
  const quoted = request.length > REASON_REQUEST_MAX ? `${request.slice(0, REASON_REQUEST_MAX)}…` : request;
  const hint = UNGUARDED_RM.test(request)
    ? "This looks like the harness question \"Dangerous rm operation on possibly-empty variable path\": "
      + "guard every variable in the path so an empty one aborts instead of resolving to /, e.g. "
      + "rm -rf \"${SP:?}/${v:?}\" — or name the literal path."
    : "Rewrite it into a form that needs no approval (a narrower literal path, quoted and guarded variables, no destructive flag).";
  return `[fleet lane] Claude Code wanted a human to approve this ${tool ?? "tool"} call, and nobody answers `
    + `a lane's pane — so the fleet hook DENIED it instead of letting the session hang. The request, verbatim: `
    + `${redact(quoted)} — Do not repeat the identical call. ${hint} If no safe form exists, skip this step, `
    + `keep working on the rest, and name what you skipped in your fleet-report.`;
}

export function decide(raw: string, env: Env): HookOutcome {
  let input: unknown;
  try { input = JSON.parse(raw); } catch { return { kind: "pass", why: "unparseable hook input" }; }
  if (!isRecord(input)) return { kind: "pass", why: "hook input is not an object" };
  if (!isLaneEnv(env)) return { kind: "pass", why: "not a fleet lane" };
  if (input.hook_event_name === "PermissionRequest") {
    const tool = typeof input.tool_name === "string" ? input.tool_name.slice(0, 64) : null;
    const request = requestText(input.tool_input);
    return { kind: "deny", reason: denyReason(tool, request),
      report: { signal: "denied", tool, detail: redact(request).slice(0, HOOK_DETAIL_MAX) } };
  }
  if (input.hook_event_name === "Notification" && typeof input.notification_type === "string"
    && WAITING_NOTIFICATIONS.includes(input.notification_type)) {
    const message = typeof input.message === "string" ? input.message : "";
    return { kind: "report", report: { signal: "waiting", tool: null,
      detail: redact(`${input.notification_type}: ${message}`).slice(0, HOOK_DETAIL_MAX) } };
  }
  return { kind: "pass", why: "not a permission request or waiting notification" };
}

export function denyOutput(reason: string): string {
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "PermissionRequest",
    decision: { behavior: "deny", message: reason } } });
}

async function report(signal: HarnessSignal, env: Env): Promise<void> {
  const base = env.FLEET_SELF_URL;
  const token = env.FLEET_SELF_TOKEN;
  if (!base || !token) return;
  try {
    await fetch(`${base.replace(/\/+$/, "")}${HARNESS_BLOCK_ROUTE}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-fleet-self-token": token },
      body: JSON.stringify(signal),
      signal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
    });
  } catch {
    // unreachable server: the deny already happened locally; this hook has no one to tell
  }
}

if (import.meta.main) {
  const mode = process.argv[2];
  let raw = "";
  try { raw = await Bun.stdin.text(); } catch { raw = ""; }
  let outcome: HookOutcome;
  try { outcome = decide(raw, process.env); } catch { outcome = { kind: "pass", why: "decide threw" }; }
  if (mode === "decide" && outcome.kind === "deny") process.stdout.write(denyOutput(outcome.reason));
  if (mode === "report" && outcome.kind !== "pass") await report(outcome.report, process.env);
  process.exit(0);
}
