// Drops: make sure the directory an owner upload lands in is IGNORED by the repo it lands in.
// server.ts#DROP_DIR says why the bytes live inside the session's working directory (owner,
// 2026-08-06) and why that needs an ignore rule: an untracked file there blocks the land. Until
// 19.10. the upload route REFUSED in every repo whose .gitignore lacked `drops/` — Fleet's own repo
// has the line, almost no other repo does (measured: a session in a foreign repo got 409 on every
// screenshot). Owner, 2026-10-19: „[Zitat entfernt]“
// . The owner must be able to hand ANY
// session a picture, whatever repo it works in.
//
// So the route now SUPPLIES the rule instead of asking for it, and puts it where it touches nothing
// the repo tracks: `$GIT_COMMON_DIR/info/exclude`. That file is never committed, changes no file in
// any tree, and is the one exclude a linked worktree actually reads (measured on git 2.50.1, see
// server.ts#excludeLaneScratch — a worktree's own `$GIT_DIR/info/exclude` does not bite), so one
// line covers the root checkout and every lane of the repo. `--path-format=absolute --git-path`
// resolves exactly that file from either form. The gate itself stays: after writing, git is asked
// again, and only a "yes, ignored" lets the bytes land — a repo whose own .gitignore re-includes
// drops/ (`!drops/` outranks info/exclude) or whose .git is not writable still answers 409, now
// with what was tried.
//
// A leaf: node globals and the caller's git runner, never server.ts. The runner is passed in so the
// server's lock-free, time-boxed gitRead does the asking and a test can use a plain spawn.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

export type GitRun = (dir: string, ...args: string[]) => Promise<{ out: string; code: number }>;
// added: the exclude file this call appended to (for the audit row), null when nothing was written
export type DropsIgnored = { ok: true; added: string | null } | { ok: false; error: string };

export const DROPS_EXCLUDE_MARK = "# fleet: owner uploads (POST /api/slots/:id/upload) — ignored so the lane stays landable";

// root: the session's realpath'd cwd; rel: `<dropDir>/<name>`, relative to root — the very path the
// bytes will be written to. Outside every git tree there is nothing to block and nothing to ask.
export async function ensureDropsIgnored(git: GitRun, root: string, dropDir: string, rel: string): Promise<DropsIgnored> {
  const inTree = await git(root, "rev-parse", "--is-inside-work-tree");
  if (inTree.code !== 0 || inTree.out !== "true") return { ok: true, added: null };
  // A non-zero exit is "not ignored" whether it means that (1) or that git could not answer (128):
  // the refusal must not depend on a probe succeeding.
  if ((await git(root, "check-ignore", "-q", rel)).code === 0) return { ok: true, added: null };
  const pattern = `${dropDir}/`;
  const ex = await git(root, "rev-parse", "--path-format=absolute", "--git-path", "info/exclude");
  if (ex.code !== 0 || !ex.out)
    return { ok: false, error: `this repository does not ignore ${pattern}, and git would not name its info/exclude to add it there — an upload here would leave an untracked file and block the land.` };
  const file = ex.out;
  let added: string | null = null;
  try {
    const prev = existsSync(file) ? readFileSync(file, "utf8") : "";
    if (!prev.split("\n").some((l) => l.trim() === pattern)) {
      mkdirSync(dirname(file), { recursive: true });
      // APPEND (O_APPEND), the same judgement as excludeLaneScratch: a concurrent writer can at
      // worst cause a duplicate line, which git reads the same as one, never a lost one
      appendFileSync(file, `${prev && !prev.endsWith("\n") ? "\n" : ""}${DROPS_EXCLUDE_MARK}\n${pattern}\n`);
      added = file;
    }
  } catch (e) {
    return { ok: false, error: `this repository does not ignore ${pattern}, and adding it to ${file} failed (${e instanceof Error ? e.message : String(e)}) — an upload here would leave an untracked file and block the land.` };
  }
  if ((await git(root, "check-ignore", "-q", rel)).code !== 0)
    return { ok: false, error: `${file} lists ${pattern}, but git still does not ignore ${rel} — a rule in the repository itself (e.g. "!${pattern}" in a .gitignore) re-includes it. An upload here would leave an untracked file and block the land.` };
  return { ok: true, added };
}
