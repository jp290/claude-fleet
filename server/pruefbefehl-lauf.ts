#!/usr/bin/env bun
// THE MERGE CHECK OF A REPO WITH A CHECK COMMAND (server/pruefbefehl.ts): what ci/merge-check.ts is for Fleet's own repo,
// for any other. The server starts it in the background (POST /api/branches/check); it builds the tree main would have
// after the charge, commit by commit like ci/merge-check.ts#candidateOf, unpacks it into a scratch directory with a
// git context of its own (a check may run `git diff`), runs the command there with `sh -c`, and writes one row to
// <git-common-dir>/merge-checks.jsonl in the shape server/branches.ts#usableCheck reads: exit 0 is mergeable, anything
// else is not, a run past the time limit is not either.
//
//   bun server/pruefbefehl-lauf.ts '{"repo":…,"branch":…,"base":…,"main":…,"cmd":…}'
import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { candidateOf } from "../ci/merge-check";

export interface CheckAsk { repo: string; branch: string; base: string; main: string; cmd: string; timeoutMs?: number }
const TAIL = 2000;

function git(dir: string, ...args: string[]): string {
  const r = Bun.spawnSync(["git", "-C", dir, ...args], { stdin: "ignore" });
  if (r.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr.toString().trim()}`);
  return r.stdout.toString().trim();
}
// the child's environment: the server's, without Fleet's own keys (its tokens among them)
export function checkEnv(env: Record<string, string | undefined> = process.env): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (typeof v === "string" && !k.startsWith("FLEET_")) out[k] = v;
  return out;
}

async function run(cmd: string, cwd: string, timeoutMs: number): Promise<{ exit: number | null; out: string; timedOut: boolean }> {
  const p = Bun.spawn(["sh", "-c", `exec 2>&1; ${cmd}`], { cwd, env: checkEnv(), stdin: "ignore", stdout: "pipe" });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; p.kill("SIGKILL"); }, timeoutMs);
  let out = "";
  const dec = new TextDecoder();
  for await (const chunk of p.stdout) out = (out + dec.decode(chunk)).slice(-4 * TAIL);
  const exit = await p.exited;
  clearTimeout(timer);
  return { exit: timedOut ? null : exit, out: out.slice(-TAIL), timedOut };
}

export async function repoCheck(a: CheckAsk): Promise<Record<string, unknown>> {
  const t0 = Date.now();
  const mainSha = git(a.repo, "rev-parse", `refs/heads/${a.main}`);
  const tip = git(a.repo, "rev-parse", `refs/heads/${a.branch}`);
  const row: Record<string, unknown> = { at: t0, branch: a.branch, base: a.base, tip, main: mainSha, cmd: a.cmd, source: "check-command" };
  const finish = (verdict: string, mergeable: boolean, why: string): Record<string, unknown> => {
    Object.assign(row, { verdict, mergeable, why, ms: Date.now() - t0 });
    appendFileSync(join(git(a.repo, "rev-parse", "--path-format=absolute", "--git-common-dir"), "merge-checks.jsonl"), `${JSON.stringify(row)}\n`);
    return row;
  };
  const cand = candidateOf(mainSha, a.base, a.branch, a.repo);
  if ("conflict" in cand) return finish("conflict", false, cand.conflict.split("\n")[0] ?? "conflict");
  Object.assign(row, { candidate: cand.sha, tree: git(a.repo, "rev-parse", `${cand.sha}^{tree}`), commits: cand.commits,
    ...(cand.onMain.length ? { alreadyOnMain: cand.onMain } : {}) });
  const dir = mkdtempSync(join(tmpdir(), "fleet-check-"));
  try {
    // sequential `&&`, not a pipe, as server.ts#snapshotIntegrationTree: a failing archive must not look like an empty tree
    const unpack = Bun.spawnSync(["sh", "-c", 'git -C "$1" archive --format=tar "$2" > "$3/.fleet-check.tar" && tar -xf "$3/.fleet-check.tar" -C "$3"'
      + ' && rm -f "$3/.fleet-check.tar" && git -C "$3" init -q -b main && git -C "$3" add -A -f', "sh", a.repo, cand.sha, dir]);
    if (unpack.exitCode !== 0) return finish("error", false, `the candidate could not be unpacked: ${unpack.stderr.toString().trim().slice(0, 200)}`);
    const r = await run(a.cmd, dir, a.timeoutMs ?? 30 * 60_000);
    row.out = r.out;
    row.exit = r.exit;
    const last = r.out.trim().split("\n").at(-1)?.trim().slice(0, 200) ?? "";
    if (r.timedOut) return finish("red", false, `the check command ran longer than ${Math.round((a.timeoutMs ?? 30 * 60_000) / 1000)} s`);
    return r.exit === 0 ? finish("green", true, `\`${a.cmd}\` exit 0${last ? ` · ${last}` : ""}`)
      : finish("red", false, `\`${a.cmd}\` exit ${r.exit}${last ? ` · ${last}` : ""}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const a = JSON.parse(process.argv[2] ?? "{}") as CheckAsk;
  const row = await repoCheck(a).catch((e: unknown) => ({ verdict: "error", mergeable: false, why: e instanceof Error ? e.message : String(e) }));
  console.log(JSON.stringify(row));
  process.exit(row.mergeable === true ? 0 : 1);
}
