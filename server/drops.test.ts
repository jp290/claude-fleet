// server/drops.ts#ensureDropsIgnored against REAL git repos in a temp dir — no server, no mocks.
// Owner, 2026-10-19: every session must be able to receive a screenshot, whatever repo it works in.
// The cases are the owner's words turned around into git facts: a repo that ignores nothing accepts
// the drop and stays clean, its tracked .gitignore untouched; a second drop writes nothing twice;
// a worktree lane is covered by the root's exclude and still removes without --force; and the two
// ways the rule cannot be supplied still refuse, saying what was tried.
import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DROPS_EXCLUDE_MARK, ensureDropsIgnored, type GitRun } from "./drops";

const base = realpathSync(mkdtempSync(join(tmpdir(), "fleet-drops-")));
afterAll(() => {
  // a read-only info/ from the refusal case would make rmSync fail on its children
  try { chmodSync(join(base, "ro", ".git", "info"), 0o755); } catch { /* not created */ }
  rmSync(base, { recursive: true, force: true });
});

const sh = (dir: string, ...args: string[]): { out: string; code: number } => {
  const p = Bun.spawnSync(["git", "-C", dir, ...args], { stdout: "pipe", stderr: "pipe" });
  return { out: p.stdout.toString().trim(), code: p.exitCode };
};
const git: GitRun = async (dir, ...args) => sh(dir, ...args);
const ID = ["-c", "user.email=e2e@fleet", "-c", "user.name=e2e"];

// a repo with one commit whose .gitignore ignores .env and nothing else — the state of nearly every
// repo a session works in. --template= leaves out .git/info/, so the writer has to create it.
function repo(name: string): string {
  const dir = join(base, name);
  mkdirSync(dir, { recursive: true });
  sh(dir, "init", "-q", "--template=", "-b", "main");
  writeFileSync(join(dir, ".gitignore"), ".env\n");
  sh(dir, "add", ".gitignore");
  sh(dir, ...ID, "commit", "-qm", "init");
  return dir;
}
const rel = (n: string): string => `drops/1790787700000-${n}`;
// what the route does after a yes: the bytes land under drops/
function drop(dir: string, r: string): void {
  mkdirSync(join(dir, "drops"), { recursive: true });
  writeFileSync(join(dir, r), "PNG");
}
const excludeOf = (dir: string): string => sh(dir, "rev-parse", "--path-format=absolute", "--git-path", "info/exclude").out;
const count = (text: string, line: string): number => text.split("\n").filter((l) => l.trim() === line).length;

describe("ensureDropsIgnored", () => {
  test("a repo that ignores nothing: drops/ goes into info/exclude, the drop is ignored, the tree stays clean, .gitignore untouched", async () => {
    const dir = repo("plain");
    expect(existsSync(join(dir, ".git", "info"))).toBe(false);
    expect(sh(dir, "check-ignore", "-q", rel("a.png")).code).toBe(1);
    const r = await ensureDropsIgnored(git, dir, "drops", rel("a.png"));
    const ex = join(dir, ".git", "info", "exclude");
    expect(r).toEqual({ ok: true, added: ex });
    expect(readFileSync(ex, "utf8")).toBe(`${DROPS_EXCLUDE_MARK}\ndrops/\n`);
    drop(dir, rel("a.png"));
    expect(sh(dir, "status", "--porcelain").out).toBe("");
    expect(readFileSync(join(dir, ".gitignore"), "utf8")).toBe(".env\n");
  });

  test("the rule is already there: nothing is written a second time", async () => {
    const dir = repo("twice");
    await ensureDropsIgnored(git, dir, "drops", rel("a.png"));
    const ex = excludeOf(dir);
    const once = readFileSync(ex, "utf8");
    const r = await ensureDropsIgnored(git, dir, "drops", rel("b.png"));
    expect(r).toEqual({ ok: true, added: null });
    expect(readFileSync(ex, "utf8")).toBe(once);
    expect(count(once, "drops/")).toBe(1);
  });

  test("an existing exclude without a final newline keeps its last line intact", async () => {
    const dir = repo("nonl");
    mkdirSync(join(dir, ".git", "info"));
    writeFileSync(join(dir, ".git", "info", "exclude"), "*.log");
    await ensureDropsIgnored(git, dir, "drops", rel("a.png"));
    expect(readFileSync(join(dir, ".git", "info", "exclude"), "utf8")).toBe(`*.log\n${DROPS_EXCLUDE_MARK}\ndrops/\n`);
    expect(sh(dir, "check-ignore", "-q", "x.log").code).toBe(0);
  });

  test("a repo whose .gitignore already ignores drops/: info/exclude is not touched", async () => {
    const dir = repo("ignores");
    writeFileSync(join(dir, ".gitignore"), ".env\ndrops/\n");
    sh(dir, ...ID, "commit", "-qam", "ignore drops");
    const r = await ensureDropsIgnored(git, dir, "drops", rel("a.png"));
    expect(r).toEqual({ ok: true, added: null });
    expect(existsSync(join(dir, ".git", "info", "exclude"))).toBe(false);
  });

  test("a directory outside every git tree: nothing asked, nothing written", async () => {
    const dir = join(base, "plain-dir");
    mkdirSync(dir);
    expect(await ensureDropsIgnored(git, dir, "drops", rel("a.png"))).toEqual({ ok: true, added: null });
    expect(existsSync(join(dir, ".git"))).toBe(false);
  });

  test("a lane (linked worktree): the root's exclude carries the rule, the lane stays clean and removes without --force", async () => {
    const dir = repo("root");
    const lane = join(base, "root.worktrees", "lane");
    sh(dir, "worktree", "add", "-q", "-b", "lane", lane);
    const r = await ensureDropsIgnored(git, lane, "drops", rel("a.png"));
    expect(r).toEqual({ ok: true, added: join(dir, ".git", "info", "exclude") });
    drop(lane, rel("a.png"));
    expect(sh(lane, "status", "--porcelain").out).toBe("");
    expect(sh(dir, "status", "--porcelain").out).toBe("");
    expect(sh(dir, "worktree", "remove", lane).code).toBe(0);
    expect(existsSync(lane)).toBe(false);
  });

  test("a session whose cwd is a subfolder of the repo: its own drops/ is covered too", async () => {
    const dir = repo("sub");
    const cwd = join(dir, "pkg");
    mkdirSync(cwd);
    expect((await ensureDropsIgnored(git, cwd, "drops", rel("a.png"))).ok).toBe(true);
    drop(cwd, rel("a.png"));
    expect(sh(dir, "status", "--porcelain").out).toBe("");
  });

  test("should refuse: the repo's own .gitignore re-includes drops/ — the error says the rule was added and what still overrides it", async () => {
    const dir = repo("negated");
    writeFileSync(join(dir, ".gitignore"), ".env\n!drops/\n");
    sh(dir, ...ID, "commit", "-qam", "re-include drops");
    const r = await ensureDropsIgnored(git, dir, "drops", rel("a.png"));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain(`${join(dir, ".git", "info", "exclude")} lists drops/`);
      expect(r.error).toContain("still does not ignore drops/1790787700000-a.png");
      expect(r.error).toContain('"!drops/"');
    }
    // every further upload into this repo asks again: the rule that is already there is not appended again
    expect((await ensureDropsIgnored(git, dir, "drops", rel("b.png"))).ok).toBe(false);
    expect(count(readFileSync(excludeOf(dir), "utf8"), "drops/")).toBe(1);
  });

  test.skipIf(process.getuid?.() === 0)("should refuse: info/exclude cannot be written — the error names the file and the reason", async () => {
    const dir = repo("ro");
    const info = join(dir, ".git", "info");
    mkdirSync(info);
    chmodSync(info, 0o555);
    const r = await ensureDropsIgnored(git, dir, "drops", rel("a.png"));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain(`adding it to ${join(info, "exclude")} failed (`);
      expect(r.error).toContain("EACCES");
    }
    expect(existsSync(join(info, "exclude"))).toBe(false);
  });
});
