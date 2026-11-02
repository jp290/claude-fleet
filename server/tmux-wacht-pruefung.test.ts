// Slot 7's findings on branch/stabilitaet 5e641359a (~/local-notes/w2-start-setzen/stabilitaet-pruefung.md), each with its input:
// - S1: Fleet's tmux server stalls AND `ps` takes over 3 s (one swap load): the gate must not open without -N.
// - S2: a server that only answers slowly keeps its socket: no SIGUSR1, and the line does not say "lost".
// - W1: Fleet runs in a foreign server B that took the path, its seats sit in A: A gets the path back, and no line advises
//   ending the server that holds the seats.
// Real tmux servers on a socket of their own; the child imports only server/tmux.ts, so this runs against a tree without the fix.
import { afterAll, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = mkdtempSync("/tmp/ftp-");
const fakebin = join(dir, "bin");
mkdirSync(fakebin);
// the checker's input: a ps that sleeps 5 s before it answers
writeFileSync(join(fakebin, "ps"), "#!/bin/sh\nsleep 5\nexec /bin/ps \"$@\"\n");
chmodSync(join(fakebin, "ps"), 0o755);
const base = { HOME: dir, TMUX_TMPDIR: dir, LANG: "en_US.UTF-8", FLEET_TMUX_ANSWER_MS: "800", FLEET_TMUX_REATTACH_MS: "800",
  FLEET_TMUX_NEW_SESSION_TIMEOUT_MS: "4000" };
const PATH = process.env.PATH ?? "/usr/bin:/bin";
const socks: string[] = [];
afterAll(() => {
  for (const s of socks) Bun.spawnSync(["tmux", "-L", s, "kill-server"], { env: { ...base, PATH } });
  rmSync(dir, { recursive: true, force: true });
});

// shared helpers of both children; /bin/ps on purpose, so the slow ps only reaches the module under test
const prelude = (sock: string): string => `
import { tmuxNewSession } from ${JSON.stringify(join(import.meta.dir, "tmux.ts"))};
import { existsSync, statSync, unlinkSync } from "node:fs";
import { connect } from "node:net";
const SOCK = ${JSON.stringify(sock)};
const path = ${JSON.stringify(join(dir, `tmux-${process.getuid?.() ?? 0}`, sock))};
const raw = (...a: string[]) => { const p = Bun.spawnSync(["tmux", "-N", "-L", SOCK, ...a], { env: process.env, stdout: "pipe", stderr: "pipe" });
  return { code: p.exitCode, out: p.stdout.toString().trim() }; };
const answering = () => { const r = raw("display-message", "-p", "#{pid}"); return r.code === 0 ? Number(r.out) : null; };
const sessions = () => { const r = raw("list-sessions", "-F", "#{session_name}"); return r.code === 0 ? r.out.split("\\n").sort() : []; };
const servers = () => Bun.spawnSync(["/bin/ps", "-ax", "-o", "pid=", "-o", "comm=", "-o", "args="]).stdout.toString().split("\\n")
  .filter((l) => / tmux /.test(l + " ") && l.includes("-L " + SOCK) && !l.includes("display-message") && !l.includes("list-sessions"))
  .map((l) => Number(l.trim().split(/\\s+/)[0])).filter((n) => n > 0).sort((x, y) => x - y);
const lines: string[] = [];
const log = console.log; console.log = (...a: unknown[]) => { lines.push(a.join(" ")); };
const done = (o: object) => { log(JSON.stringify({ ...o, lines })); };
`;

async function child(name: string, body: string, slowPs: boolean): Promise<Record<string, any>> {
  const sock = `twp-${name}-${process.pid}`;
  socks.push(sock);
  const script = join(dir, `${name}.ts`);
  await Bun.write(script, prelude(sock) + body);
  const p = Bun.spawn([process.execPath, script], { cwd: dir, stdout: "pipe", stderr: "pipe",
    env: { ...base, FLEET_SOCK: sock, PATH: slowPs ? `${fakebin}:${PATH}` : PATH } });
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  await p.exited;
  const line = out.trim().split("\n").at(-1) ?? "";
  if (!line.startsWith("{")) throw new Error(`${name} failed: ${err.slice(0, 600)} ${out.slice(0, 300)}`);
  return JSON.parse(line);
}

// S1: a stalled server (on macOS with its queue full, as on 1.11.) and a ps that needs 5 s
const s1 = await child("s1", `
const r1 = await tmuxNewSession("-d", "-s", "s1", "sleep 300");
if (r1.code !== 0) { console.error(r1.err); process.exit(2); }
const a = answering()!;
const inode = statSync(path).ino;
process.kill(a, "SIGSTOP");
const held: any[] = [];
let full = false;
if (process.platform === "darwin") for (let i = 0; i < 400 && !full; i++)
  full = await new Promise<boolean>((res) => { const s = connect(path); s.on("connect", () => { held.push(s); res(false); });
    s.on("error", (e: any) => res(e.code === "ECONNREFUSED")); });
const r2 = await tmuxNewSession("-d", "-s", "s2", "sleep 300");
const during = { code: r2.code, refused: !!(r2 as any).refused, err: r2.err, sameInode: existsSync(path) && statSync(path).ino === inode, servers: servers() };
for (const s of held) s.destroy();
process.kill(a, "SIGCONT");
for (let i = 0; i < 30 && answering() !== a; i++) await Bun.sleep(100);
for (const p of servers()) if (p !== a) { try { process.kill(p, "SIGKILL"); } catch {} }
done({ a, full, during });
`, true);

// S2 and W1 with the normal ps
const s2w1 = await child("w1", `
const r1 = await tmuxNewSession("-d", "-s", "s1", "sleep 300");
if (r1.code !== 0) { console.error(r1.err); process.exit(2); }
const a = answering()!;
// S2 · only slow: stopped for 2 s, the path intact
const inode = statSync(path).ino;
process.kill(a, "SIGSTOP");
const slowR = await tmuxNewSession("-d", "-s", "s2", "sleep 300");
await Bun.sleep(1200);
process.kill(a, "SIGCONT");
for (let i = 0; i < 30 && answering() !== a; i++) await Bun.sleep(100);
await Bun.sleep(300);
const slowLines = lines.splice(0);
const s2 = { refused: !!(slowR as any).refused, sameInode: statSync(path).ino === inode, answering: answering(), lines: slowLines };
await Bun.sleep(5200); // past any signal rate limit
// W1 · B takes the path, Fleet runs in a pane of B, its seats in A
raw("new-session", "-d", "-s", "keep", "sleep 300");
unlinkSync(path);
Bun.spawnSync(["tmux", "-L", SOCK, "new-session", "-d", "-s", "fremd", "sleep 300"], { env: process.env });
const b = answering();
process.env.TMUX = path + "," + b + ",0";
const w = await tmuxNewSession("-d", "-s", "s3", "sleep 300");
await Bun.sleep(200);
const w1 = { code: w.code, refused: !!(w as any).refused, err: w.err, b, answering: answering(), sessions: sessions(), lines: lines.splice(0) };
for (const p of servers()) if (p !== a) { try { process.kill(p, "SIGKILL"); } catch {} }
done({ a, s2, w1 });
`, false);

test("S1: a stalled server and a ps that needs 5 s: the new-session is refused, the socket stays, no second server starts", () => {
  const d = s1.during;
  expect(d.refused).toBe(true);
  expect(d.err).toContain(`pid ${s1.a}`);
  expect(d.sameInode).toBe(true);
  expect(d.servers).toEqual([s1.a]);
  if (process.platform === "darwin") expect(s1.full).toBe(true);
});

test("S2: a server that only answers slowly keeps its socket, gets no signal, and the line says slow, not lost", () => {
  expect(s2w1.s2.refused).toBe(true);
  expect(s2w1.s2.sameInode).toBe(true);
  expect(s2w1.s2.answering).toBe(s2w1.a);
  expect(s2w1.s2.lines.join("\n")).not.toMatch(/lost/);
});

test("W1: Fleet in a foreign server gives the seats' server its path back; the pane opens beside the seats", () => {
  const w = s2w1.w1;
  expect(w.b).not.toBe(s2w1.a);
  expect(w.refused).toBe(false);
  expect(w.code).toBe(0);
  expect(w.answering).toBe(s2w1.a);
  expect(w.sessions).toEqual(expect.arrayContaining(["keep", "s1", "s3"]));
  expect(w.sessions).not.toContain("fremd");
  // S3: the line names what the other server held instead of claiming nothing ran twice
  expect(w.lines.join("\n")).toContain("fremd");
});

test("no line ever advises ending the server that holds the seats", () => {
  const all = [s1.during.err, ...s1.lines, ...s2w1.s2.lines, s2w1.w1.err, ...s2w1.w1.lines].join("\n");
  expect(all).not.toMatch(/ends? that pid|owner ends|end (pid|the server)/i);
});
