// THE UNIT SUITE LEAVES ITS WORKTREE AS IT FOUND IT. Preloaded by bunfig.toml, so these two hooks
// run once around the whole `bun test` run. A file a test or a tool leaves in the worktree keeps a
// landed branch standing: Fleet ends a landed branch only when every ignored file in it belongs to
// the allowed scaffold (server/branch-ende.ts#endVerdict). Two landed branches stood on 24.10. over
// a 3-byte fleet.json ("{}"). A path that is new after the run, untracked or ignored, turns the run
// red and is named. What a test writes belongs in a temp dir (os.tmpdir(), mkdtempSync).
import { afterAll, beforeAll } from "bun:test";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

// untracked and ignored paths, as git names them; null outside a git checkout (nothing to compare)
export function strayPaths(root: string): string[] | null {
  const r = Bun.spawnSync(["git", "-C", root, "status", "--porcelain", "--ignored"]);
  if (r.exitCode !== 0) return null;
  return r.stdout.toString().split("\n").filter((l) => l.startsWith("?? ") || l.startsWith("!! ")).map((l) => l.slice(3));
}

export const newPaths = (before: string[], after: string[]): string[] => after.filter((p) => !before.includes(p));

let before: string[] | null = null;
beforeAll(() => { before = strayPaths(ROOT); });
afterAll(() => {
  const after = strayPaths(ROOT);
  if (!before || !after) return;
  const added = newPaths(before, after);
  if (added.length > 0)
    throw new Error(`the unit suite left new files in the worktree ${ROOT}: ${added.join(", ")} — a test writes into a temp dir, never into its cwd (ci/worktree-clean.ts)`);
});
