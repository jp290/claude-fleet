// Queue 8ef80095: when the tmux server that holds Fleet's panes loses its socket path while it lives, Fleet opens no second copy
// of any seat. Checked the way it happened: a real tmux server on a socket of its own, its path deleted, taken by another server,
// or its server stalled with a full listen backlog, and then the one thing Fleet does in that moment, a `new-session` through
// server/tmux.ts. The child imports only server/tmux.ts, so the same file runs against a tree that has no guard.
import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

// under /tmp: macOS' tmpdir() is too long for a tmux socket path
const dir = mkdtempSync("/tmp/ftw-");
const SOCK = `tmux-wacht-${process.pid}`;
const env = {
  PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: dir, TMUX_TMPDIR: dir, LANG: "en_US.UTF-8",
  FLEET_SOCK: SOCK, FLEET_TMUX_ANSWER_MS: "800", FLEET_TMUX_REATTACH_MS: "800",
};
afterAll(() => {
  Bun.spawnSync(["tmux", "-L", SOCK, "kill-server"], { env });
  rmSync(dir, { recursive: true, force: true });
});

interface Step { code: number | null; refused: boolean; err: string; answering: number | null; sessions: string[]; servers: number[] }
interface Run { a: number; b: number | null; lost: Step; displaced: Step; hung: Step; afterHung: Step; congested: Step | null; afterCongested: Step | null; extra: number[] }

async function drive(): Promise<Run> {
  const script = join(dir, "drive.ts");
  await Bun.write(script, `
import { tmuxNewSession } from ${JSON.stringify(join(import.meta.dir, "tmux.ts"))};
import { existsSync, statSync, unlinkSync } from "node:fs";
import { connect } from "node:net";
const SOCK = ${JSON.stringify(SOCK)};
const path = ${JSON.stringify(join(dir, `tmux-${process.getuid?.() ?? 0}`, SOCK))};
const raw = (...a: string[]) => { const p = Bun.spawnSync(["tmux", "-N", "-L", SOCK, ...a], { env: process.env, stdout: "pipe", stderr: "pipe" });
  return { code: p.exitCode, out: p.stdout.toString().trim() }; };
const answering = () => { const r = raw("display-message", "-p", "#{pid}"); return r.code === 0 ? Number(r.out) : null; };
const sessions = () => { const r = raw("list-sessions", "-F", "#{session_name}"); return r.code === 0 ? r.out.split("\\n").sort() : []; };
// every tmux server of this socket name, by its pid (pgrep would print command lines; ps -o pid,comm,args is read, not printed)
const servers = () => Bun.spawnSync(["ps", "-ax", "-o", "pid=", "-o", "comm=", "-o", "args="]).stdout.toString().split("\\n")
  .filter((l) => / tmux /.test(l + " ") && l.includes("-L " + SOCK) && !l.includes("display-message") && !l.includes("list-sessions"))
  .map((l) => Number(l.trim().split(/\\s+/)[0])).filter((n) => n > 0).sort((x, y) => x - y);
const step = async (name: string): Promise<any> => {
  const r = await tmuxNewSession("-d", "-s", name, "sleep 300");
  await Bun.sleep(150);
  return { code: r.code, refused: !!(r as any).refused, err: r.err, answering: answering(), sessions: sessions(), servers: servers() };
};
const extra: number[] = [];
const r1 = await tmuxNewSession("-d", "-s", "s1", "sleep 300");
if (r1.code !== 0) { console.error(r1.err); process.exit(2); }
const a = answering()!;
// 1 · the path is deleted while the server lives
unlinkSync(path);
const lost = await step("s2");
// 2 · another server takes the path (the watchdog's new-session on 1.11.)
if (existsSync(path)) unlinkSync(path);
Bun.spawnSync(["tmux", "-L", SOCK, "new-session", "-d", "-s", "srv", "sleep 300"], { env: process.env });
// the stand-in's pane runs on, so its server outlives the path; a real watchdog srv refuses and exits, and its server with it
const b = answering(); if (b && b !== a) extra.push(b);
const displaced = await step("s3");
// 3 · the path is gone and the old server does not answer: nothing may start
if (existsSync(path)) unlinkSync(path);
await Bun.sleep(5200); // past the signal's rate limit, so this episode signals again
process.kill(a, "SIGSTOP");
const hung = await step("s4");
const pathDuringHang = existsSync(path);
process.kill(a, "SIGCONT");
for (let i = 0; i < 30 && answering() !== a; i++) await Bun.sleep(100);
const afterHung = { ...(await step("s5")), pathDuringHang };
// 4 · the real cause: a stalled server, 128 queued connections, the next connect refused (macOS; Linux blocks instead)
let congested = null, afterCongested = null;
if (process.platform === "darwin") {
  const inode = statSync(path).ino;
  await Bun.sleep(5200);
  process.kill(a, "SIGSTOP");
  const socks: any[] = [];
  let refused = false;
  for (let i = 0; i < 400 && !refused; i++) {
    refused = await new Promise<boolean>((res) => { const s = connect(path); s.on("connect", () => { socks.push(s); res(false); });
      s.on("error", (e: any) => res(e.code === "ECONNREFUSED")); });
  }
  congested = { ...(await step("s6")), backlogRefused: refused, sameInode: existsSync(path) && statSync(path).ino === inode };
  for (const s of socks) s.destroy();
  process.kill(a, "SIGCONT");
  for (let i = 0; i < 30 && answering() !== a; i++) await Bun.sleep(100);
  await Bun.sleep(300);
  afterCongested = { code: 0, refused: false, err: "", answering: answering(), sessions: sessions(), servers: servers() };
}
for (const p of servers()) if (p !== a && !extra.includes(p)) extra.push(p);
console.log(JSON.stringify({ a, b, lost, displaced, hung, afterHung, congested, afterCongested, extra }));
for (const p of extra) { try { process.kill(p, "SIGKILL"); } catch {} }
`);
  // cwd outside the checkout: Bun would load its .env into the child
  const p = Bun.spawn([process.execPath, script], { cwd: dir, env, stdout: "pipe", stderr: "pipe" });
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  await p.exited;
  const line = out.trim().split("\n").at(-1) ?? "";
  if (!line.startsWith("{")) throw new Error(`driver failed: ${err.slice(0, 600)} ${out.slice(0, 300)}`);
  return JSON.parse(line) as Run;
}

const run = await drive();
// every tmux server of this socket name except the displacing stand-in of step 2
const own = (servers: number[]): number[] => servers.filter((p) => p !== run.b);

test("a deleted socket path: the old server takes it back and the new pane opens in it, not in a second server", () => {
  expect(run.lost.code).toBe(0);
  expect(run.lost.answering).toBe(run.a);
  expect(run.lost.sessions).toEqual(["s1", "s2"]);
  expect(run.lost.servers).toEqual([run.a]);
});

test("a path taken by another tmux server: Fleet's server takes it back, every pane is reachable again", () => {
  expect(run.displaced.code).toBe(0);
  expect(run.displaced.answering).toBe(run.a);
  expect(run.displaced.sessions).toEqual(["s1", "s2", "s3"]);
});

test("a lost path whose server does not answer: nothing opens, the line names the pid, and no second server starts", () => {
  expect(run.hung.refused).toBe(true);
  expect(run.hung.err).toContain(`pid ${run.a}`);
  expect(run.hung.err).toContain("opens no second copy");
  expect((run.afterHung as Step & { pathDuringHang: boolean }).pathDuringHang).toBe(false);
  // once it answers again it has its path back (the signal waited for it) and the next pane opens in it
  expect(run.afterHung.answering).toBe(run.a);
  expect(run.afterHung.sessions).toContain("s5");
  expect(own(run.afterHung.servers)).toEqual([run.a]);
});

test("the cause of 1.11.: a stalled server with a full backlog keeps its socket, and no new-session starts a second server", () => {
  if (process.platform !== "darwin" || !run.congested) return; // Linux blocks a connect to a full backlog instead of refusing it
  const c = run.congested as Step & { backlogRefused: boolean; sameInode: boolean };
  expect(c.backlogRefused).toBe(true);
  expect(c.code).not.toBe(0);
  expect(c.sameInode).toBe(true);
  expect(own(c.servers)).toEqual([run.a]);
  expect(run.afterCongested?.answering).toBe(run.a);
  expect(run.afterCongested?.sessions).toContain("s1");
});
