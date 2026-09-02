// separate tmux socket per instance — lets a test instance (FLEET_SOCK=fleettest)
// run its own s1..sN sessions without touching the live fleet's
export const SOCK = process.env.FLEET_SOCK ?? "claudefleet";
export interface TmuxResult { out: string; err: string; code: number }
export async function tmux(...args: string[]): Promise<TmuxResult> {
  const p = Bun.spawn(["tmux", "-L", SOCK, ...args], { stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([
    new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited,
  ]);
  return { out: out.trim(), err: err.trim(), code };
}

export interface TmuxNewSessionResult { out: string; err: string; code: number | null; timedOut: boolean }
export const tmuxNewSessionTimeout = (raw: string | undefined): number => {
  const parsed = raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : NaN;
  return Number.isSafeInteger(parsed) && parsed >= 100 ? parsed : 15_000;
};
export const TMUX_NEW_SESSION_TIMEOUT_MS = tmuxNewSessionTimeout(process.env.FLEET_TMUX_NEW_SESSION_TIMEOUT_MS);
export const TMUX_NEW_SESSION_KILL_GRACE_MS = 500;

// Only process creation gets a wall-clock bound. A generic timeout on has-session, capture-pane or
// send-keys would turn an unknown observation/delivery into an ordinary negative result at dozens
// of unrelated call sites. new-session is different: open/kill wait on its per-slot promise, so an
// unbounded client process strands both lifecycle verbs. Kill only the exact Bun child we started:
// TERM first, KILL after a short grace, and never a name-pattern/process-tree sweep.
export async function tmuxNewSession(...args: string[]): Promise<TmuxNewSessionResult> {
  const p = Bun.spawn(["tmux", "-L", SOCK, "new-session", ...args], { stdout: "pipe", stderr: "pipe" });
  const outP = new Response(p.stdout).text().catch(() => "");
  const errP = new Response(p.stderr).text().catch(() => "");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<"timeout">((resolveTimeout) => {
    timer = setTimeout(() => resolveTimeout("timeout"), TMUX_NEW_SESSION_TIMEOUT_MS);
  });
  const settled = await Promise.race([p.exited, deadline]);
  if (timer) clearTimeout(timer);
  let code: number | null = typeof settled === "number" ? settled : null;
  const timedOut = settled === "timeout";
  if (timedOut) {
    try { p.kill(); } catch { /* already exited */ }
    const term = await Promise.race([
      p.exited,
      Bun.sleep(TMUX_NEW_SESSION_KILL_GRACE_MS).then(() => "grace" as const),
    ]);
    if (term === "grace") {
      try { p.kill(9); } catch { /* already exited */ }
      const killed = await Promise.race([
        p.exited,
        Bun.sleep(TMUX_NEW_SESSION_KILL_GRACE_MS).then(() => null),
      ]);
      if (typeof killed === "number") code = killed;
    } else {
      code = term;
    }
  }
  const bounded = (value: Promise<string>): Promise<string> => timedOut
    ? Promise.race([value, Bun.sleep(TMUX_NEW_SESSION_KILL_GRACE_MS).then(() => "")])
    : value;
  const [out, err] = await Promise.all([bounded(outP), bounded(errP)]);
  return { out: out.trim(), err: err.trim(), code, timedOut };
}

export class TmuxNewSessionUnavailable extends Error {
  readonly availability = "unknown" as const;
}

export type TmuxPresence = "present" | "absent" | "unknown";
export interface TmuxSlotObservation { presence: TmuxPresence; root: string | null }
export interface TmuxSlotObservations {
  known: boolean;
  sessions: ReadonlyMap<string, string>;
  detail: string;
}
