// Slot 7's round 3 on branch/stabilitaet 95f020073 (~/local-notes/w2-start-setzen/stabilitaet-pruefung.md, RUNDE 3), with its inputs
// (its probe p8runde3.ts): the path goes to the server that holds Fleet's own seats, known by identity, never by age or count alone.
// - N5b: Fleet in A (keep and the seats s2, s3; the path; newer); the record names an older live X with one pane. A keeps the path.
// - N5c: the same, X holds only srv. A keeps the path.
// - W1d: Fleet in an older intruder B (b1, b2, b3, srv; the path); the seats sit in the newer A (keep, s2), the record names A.
//   A gets the path back. A has no path, so its seat shows only in its pane's command line, as every Fleet seat's line carries
//   `export FLEET_SELF_TOKEN='…'; export FLEET_SELF_SLOT='<n>'` (server.ts#ensureSlot); the seats here are started with that line
//   (round 4: a session name alone is no seat).
// - B2: $TMUX names a reused pid, a process called tmux with `-L <sock>` in its arguments: no restart.
// - B3 stays: Fleet really runs in a pane of X while A answers and is recorded: one restart.
// Real tmux servers on sockets of their own; the child imports only server/tmux-wacht.ts, so this runs against a tree without the fix.
import { afterAll, expect, test } from "bun:test";
import { copyFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const dir = mkdtempSync("/tmp/ftd-");
const fakebin = join(dir, "bin");
mkdirSync(fakebin);
// the checker's decoy: a program named tmux (perl under that name) that lives with `-L <sock>` in its arguments
copyFileSync("/usr/bin/perl", join(fakebin, "tmux"));
chmodSync(join(fakebin, "tmux"), 0o755);
const PATH = process.env.PATH ?? "/usr/bin:/bin";
const base = { HOME: dir, TMUX_TMPDIR: dir, LANG: "en_US.UTF-8", PATH };
const socks: string[] = [];
afterAll(() => {
  for (const s of socks) Bun.spawnSync(["tmux", "-L", s, "kill-server"], { env: base });
  rmSync(dir, { recursive: true, force: true });
});
const MOD = JSON.stringify(join(import.meta.dir, "tmux-wacht.ts"));

const prelude = (sock: string): string => `
const W = await import(${MOD});
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
const SOCK = ${JSON.stringify(sock)};
const dir = ${JSON.stringify(dir)};
const path = ${JSON.stringify(join(dir, `tmux-${process.getuid?.() ?? 0}`, sock))};
const file = ${JSON.stringify(join(dir, `hs-${sock}`))};
const envN = { HOME: dir, TMUX_TMPDIR: dir, PATH: ${JSON.stringify(PATH)} };
delete process.env.TMUX;
const sh = (...a: string[]) => { const r = Bun.spawnSync(a, { env: envN, stdout: "pipe", stderr: "pipe" }); return { code: r.exitCode, out: r.stdout.toString().trim() }; };
const info = () => ({ pid: Number(sh("tmux", "-N", "-L", SOCK, "display", "-p", "#{pid}").out), start: sh("tmux", "-N", "-L", SOCK, "display", "-p", "#{start_time}").out });
const sess = (name: string, cmd = "sleep 300") => sh("tmux", "-L", SOCK, "new-session", "-d", "-s", name, cmd);
const seat = (n: number) => sess("s" + n, "export FLEET_SELF_TOKEN='t-" + n + "'; export FLEET_SELF_SLOT='" + n + "'; sleep 300; true");
const answering = () => { const r = sh("tmux", "-N", "-L", SOCK, "display", "-p", "#{pid}"); return r.code === 0 ? Number(r.out) : null; };
const sessions = () => { const r = sh("tmux", "-N", "-L", SOCK, "ls", "-F", "#S"); return r.code === 0 ? r.out.split("\\n").sort() : []; };
const rec = (pid: number, start: string) => writeFileSync(file, pid + "\\t" + start + "\\t" + path + "\\n");
const recorded = () => { try { return Number(readFileSync(file, "utf8").split("\\t")[0]); } catch { return null; } };
let neustart = 0; const lines: string[] = [];
W.configureTmuxWacht({ sock: SOCK, env: envN, file, melde: (l: string) => lines.push(l), neustart: () => { neustart++; return true; },
  answerTimeoutMs: 1500, reattachWaitMs: 2500, refusedSignalMs: 6000 });
const done = (o: object) => console.log(JSON.stringify({ ...o, neustart, lines }));
`;

async function child(name: string, body: string): Promise<Record<string, any>> {
  const sock = `ftd-${name}-${process.pid}`;
  socks.push(sock);
  const script = join(dir, `${name}.ts`);
  await Bun.write(script, prelude(sock) + body);
  const p = Bun.spawn([process.execPath, script], { cwd: dir, stdout: "pipe", stderr: "pipe", env: base });
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  await p.exited;
  const line = out.trim().split("\n").at(-1) ?? "";
  if (!line.startsWith("{")) throw new Error(`${name} failed: ${err.slice(0, 600)} ${out.slice(0, 300)}`);
  return JSON.parse(line);
}

// N5b, as the checker built it: X older with one pane, then A with keep, s2, s3
const n5b = await child("n5b", `
sess("keep"); const X = info();
await Bun.sleep(1200); rmSync(path);
sess("keep"); const A = info(); seat(2); seat(3);
rec(X.pid, X.start);
process.env.TMUX = path + "," + A.pid + ",0";
const g = await W.vorNeuerSitzung();
await Bun.sleep(300);
const r = { a: A.pid, x: X.pid, g, answering: answering(), recorded: recorded() };
process.kill(X.pid, "SIGTERM"); process.kill(A.pid, "SIGTERM");
done(r);
`);
// N5c: X older and holds only srv
const n5c = await child("n5c", `
sess("srv"); const X = info();
await Bun.sleep(1200); rmSync(path);
sess("keep"); const A = info(); seat(2); seat(3);
rec(X.pid, X.start);
process.env.TMUX = path + "," + A.pid + ",0";
const g = await W.vorNeuerSitzung();
await Bun.sleep(300);
const r = { a: A.pid, x: X.pid, g, answering: answering(), recorded: recorded() };
process.kill(X.pid, "SIGTERM"); process.kill(A.pid, "SIGTERM");
done(r);
`);
// W1d: B older with three sessions of its own and srv; A newer with keep and the seat s2; B holds the path, the record names A
const w1d = await child("w1d", `
sess("b1"); const B = info().pid; sess("b2"); sess("b3"); sess("srv");
await Bun.sleep(1200); rmSync(path);
sess("keep"); const A = info(); seat(2);
rmSync(path); process.kill(B, "SIGUSR1"); await Bun.sleep(500);
rec(A.pid, A.start);
process.env.TMUX = path + "," + B + ",0";
const g = await W.vorNeuerSitzung();
await Bun.sleep(300);
const r = { a: A.pid, b: B, g, answering: answering(), sessions: sessions() };
process.kill(B, "SIGTERM"); process.kill(A.pid, "SIGTERM");
done(r);
`);
// B2: A answers and is recorded; $TMUX names the decoy's pid
const b2 = await child("b2", `
sess("keep"); const A = info();
rec(A.pid, A.start);
const d = Bun.spawn([${JSON.stringify(join(fakebin, "tmux"))}, "-e", "sleep 600", "--", "-L", SOCK, "capture-pane"]);
await Bun.sleep(400);
process.env.TMUX = path + "," + d.pid + ",0";
const g = await W.vorNeuerSitzung();
const g2 = await W.vorNeuerSitzung();
const r = { g, g2, decoyAlive: (() => { try { process.kill(d.pid, 0); return true; } catch { return false; } })() };
d.kill(9); process.kill(A.pid, "SIGTERM");
done(r);
`);
// B3 for real: the checking process runs in a pane of X (its $TMUX set by tmux, X its ancestor); X loses the path, A answers and is recorded
const b3 = await child("b3", `
const inner = dir + "/b3-inner-" + SOCK + ".ts";
const out = dir + "/b3-out-" + SOCK + ".json";
writeFileSync(inner, \`
const W = await import(${MOD.replace(/`/g, "\\`")});
let neustart = 0; const lines: string[] = [];
W.configureTmuxWacht({ sock: \${JSON.stringify(SOCK)}, env: \${JSON.stringify(envN)}, file: \${JSON.stringify(file)}, melde: (l: string) => lines.push(l),
  neustart: () => { neustart++; return true; }, answerTimeoutMs: 1500, reattachWaitMs: 2500, refusedSignalMs: 6000 });
const g = await W.vorNeuerSitzung();
await Bun.write(\${JSON.stringify(out)}, JSON.stringify({ g, neustart, lines, tmux: (process.env.TMUX ?? "").split(",")[1] }));
\`);
const go = dir + "/b3-go-" + SOCK;
sess("x", "while [ ! -f " + go + " ]; do sleep 0.2; done; " + process.execPath + " " + inner + "; sleep 300");
const X = info();
rmSync(path);
sess("keep"); const A = info();
rec(A.pid, A.start);
writeFileSync(go, "");
for (let i = 0; i < 100 && !existsSync(out); i++) await Bun.sleep(100);
await Bun.sleep(200);
const r = { x: X.pid, a: A.pid, inner: existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : null };
process.kill(X.pid, "SIGTERM"); process.kill(A.pid, "SIGTERM");
done(r);
`);

test("N5b: an older X in the record with one pane does not take the path from A, which holds Fleet's seats", () => {
  expect(n5b.neustart).toBe(0);
  expect(n5b.answering).toBe(n5b.a);
  expect(n5b.recorded).toBe(n5b.a);
  expect(n5b.g).toEqual({ flags: ["-N"], startsServer: false });
  expect(n5b.lines.join("\n")).not.toMatch(new RegExp(`pid ${n5b.x} \\(running since[^;]*holds every seat`));
});

test("N5c: an older X in the record that holds only srv does not take the path either", () => {
  expect(n5c.neustart).toBe(0);
  expect(n5c.answering).toBe(n5c.a);
  expect(n5c.recorded).toBe(n5c.a);
});

test("W1d: Fleet in an older intruder with sessions of its own gives the seats' server its path back and restarts", () => {
  expect(w1d.answering).toBe(w1d.a);
  expect(w1d.sessions).toEqual(["keep", "s2"]);
  expect(w1d.neustart).toBe(1);
  expect(w1d.g).toEqual({ flags: ["-N"], startsServer: false });
  expect(w1d.lines.join("\n")).not.toMatch(/b1, b2, b3[^;]*; pid \d+.*Fleet keeps the path/);
});

test("B2: a stale $TMUX whose pid a tmux client took over starts no restart", () => {
  expect(b2.neustart).toBe(0);
  expect(b2.g).toEqual({ flags: ["-N"], startsServer: false });
  expect(b2.decoyAlive).toBe(true);
});

test("B3 stays: Fleet really running in a pane of a pathless server restarts once, beside the seats", () => {
  expect(b3.inner).not.toBeNull();
  expect(Number(b3.inner.tmux)).toBe(b3.x);
  expect(b3.inner.neustart).toBe(1);
  expect(b3.inner.g).toEqual({ flags: ["-N"], startsServer: false });
});
