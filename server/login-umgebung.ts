// THE LOGIN SHELL'S ENVIRONMENT FOR A SEAT IN ITS OWN SETUP (Mangel 136; brief fremdes-repo-rund, point 4). A pane starts `claude`
// through `$SHELL -c` in the tmux server's environment, so what the user exports in ~/.zshrc or ~/.zprofile was missing: measured
// 24.10. on a live pane against `zsh -l -i -c env`: BUN_INSTALL, FPATH, HOMEBREW_CELLAR/PREFIX/REPOSITORY, INFOPATH, LANG, PNPM_HOME
// and PS1 (USER and SSH_AUTH_SOCK were there — Mangel 136 measured them missing on a test instance, whose tmux server starts bare).
// A hand-started `claude` has all of it, and a seat in its own setup starts like one.
// HOW: the login shell runs once per folder in a child process (`$SHELL -l -i -c env -0`, no tty, bounded), from the base a terminal
// gives it, and its variables go to a 0600 file the pane reads and deletes before `claude` starts. The pane stays `$SHELL -c … claude`,
// so the screen, the readiness markers and the delivery see exactly what they saw before; no value ever stands in a command line.
// PATH follows the login shell, with the directory of the `claude` Fleet starts today in front, so the agent stays the same binary.
// Fleet's own variables (FLEET_*) never come from the user's shell.
import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const MARK = "\0FLEET-LOGIN-ENV\0";
// what the terminal itself sets, or the shell for its own prompt: the pane's own values stay
const OWN = new Set(["TMUX", "TMUX_PANE", "TERM", "TERM_PROGRAM", "TERM_PROGRAM_VERSION", "COLORTERM", "PWD", "OLDPWD", "SHLVL", "_",
  "PS1", "PS2", "PS3", "PS4", "PROMPT", "RPROMPT", "SHELL_SESSION_ID"]);
// the base a terminal hands a login shell: who and where, never the server's own settings
const BASE = ["HOME", "USER", "LOGNAME", "SHELL", "TMPDIR", "SSH_AUTH_SOCK", "LANG", "__CF_USER_TEXT_ENCODING"];
export const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** The variables `env -0` printed after the mark; null = no mark (the shell failed before it). Pure. */
export function parseLoginEnv(out: string): Record<string, string> | null {
  const at = out.indexOf(MARK);
  if (at < 0) return null;
  const vars: Record<string, string> = {};
  for (const entry of out.slice(at + MARK.length).split("\0")) {
    const eq = entry.indexOf("=");
    if (eq > 0) vars[entry.slice(0, eq)] = entry.slice(eq + 1);
  }
  return vars;
}

/** What the pane gets: the login variables without the terminal's own and without FLEET_*, PATH with `agentDir` first. Pure. */
export function paneVars(login: Readonly<Record<string, string>>, agentDir: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(login)) if (NAME_RE.test(k) && !OWN.has(k) && !k.startsWith("FLEET_") && !v.includes("\0")) out[k] = v;
  const path = (login.PATH ?? "").split(":").filter(Boolean);
  out.PATH = [...new Set([...(agentDir ? [agentDir] : []), ...path])].join(":");
  return out;
}

const quote = (v: string): string => `'${v.replaceAll("'", "'\\''")}'`;
/** The file the pane sources: one `export NAME='value'` per variable. Pure. */
export const envFileText = (vars: Readonly<Record<string, string>>): string =>
  Object.entries(vars).map(([k, v]) => `export ${k}=${quote(v)}`).join("\n") + "\n";

/** Runs the login shell in `cwd`; its variables, or the reason there are none. */
export async function readLoginEnv(shell: string, cwd: string, env: Readonly<Record<string, string | undefined>>, timeoutMs = 5000):
  Promise<{ ok: true; vars: Record<string, string>; ms: number } | { ok: false; error: string }> {
  const base: Record<string, string> = { PATH: "/usr/bin:/bin:/usr/sbin:/sbin" };
  for (const k of BASE) if (env[k]) base[k] = env[k]!;
  const t0 = Date.now();
  const p = Bun.spawn([shell, "-l", "-i", "-c", `printf '\\0FLEET-LOGIN-ENV\\0'; env -0`], { cwd, env: base, stdin: "ignore", stdout: "pipe", stderr: "ignore" });
  const timer = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
  const [out, code] = await Promise.all([new Response(p.stdout).text(), p.exited]);
  clearTimeout(timer);
  const vars = parseLoginEnv(out);
  if (!vars) return { ok: false, error: `${shell} -l -i gave no environment (exit ${code}${Date.now() - t0 >= timeoutMs ? ", timed out" : ""})` };
  return { ok: true, vars, ms: Date.now() - t0 };
}

/** Writes the pane's file (0600, in a 0700 folder) and returns the line that reads and deletes it. */
export function writeEnvFile(dir: string, name: string, vars: Readonly<Record<string, string>>): { file: string; line: string } {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = join(dir, `${name}.env`);
  writeFileSync(file, envFileText(vars), { mode: 0o600 });
  chmodSync(file, 0o600);
  return { file, line: `. ${quote(file)}; rm -f ${quote(file)}; ` };
}
export const removeEnvFile = (file: string): void => rmSync(file, { force: true });
export const agentDirOf = (which: string | null): string | null => (which ? dirname(which) : null);
