import { spawnSync } from "node:child_process";
import { accessSync, closeSync, mkdirSync, openSync, readFileSync, constants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function graphifyOnce(raw: string, env: NodeJS.ProcessEnv = process.env): number {
  let input: unknown;
  try { input = JSON.parse(raw); } catch { return 0; }
  if (!input || typeof input !== "object" || !("session_id" in input)) return 0;
  const sessionId = input.session_id;
  if (typeof sessionId !== "string" || !/^[a-zA-Z0-9-]{1,128}$/.test(sessionId)) return 0;

  if (!env.HOME) return 0;
  const graphify = join(env.HOME, ".local/bin/graphify");
  try { accessSync(graphify, constants.X_OK); } catch { return 0; }

  const markerDir = join(env.TMPDIR || tmpdir(), "fleet-graphify-once");
  try { mkdirSync(markerDir, { recursive: true, mode: 0o700 }); } catch { return 0; }
  try { closeSync(openSync(join(markerDir, sessionId), "wx", 0o600)); } catch { return 0; }

  const result = spawnSync(graphify, ["hook-guard", "search"], { input: raw, encoding: "utf8" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status ?? 1;
}

if (import.meta.main) process.exitCode = graphifyOnce(readFileSync(0, "utf8"));
