// Queue 8ef80095, the watchdog's half: when the tmux socket path vanishes while srv runs on in the old tmux server, watchdog.sh
// used to start a new srv every ~10 s that refused at once ("REFUSING TO START: fleet server pid … already running", server.log
// 1.11. from 21:58:12). This runs the real watchdog.sh from a scratch folder on a socket of its own, with a stand-in server.ts that
// holds fleet.pid and refuses a second start the way server.ts#claimInstanceLock does.
import { afterAll, expect, test } from "bun:test";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = mkdtempSync("/tmp/fws-");
const SOCK = `wd-sock-${process.pid}`;
const sockPath = join(dir, `tmux-${process.getuid?.() ?? 0}`, SOCK);
copyFileSync(join(import.meta.dir, "..", "watchdog.sh"), join(dir, "watchdog.sh"));
writeFileSync(join(dir, "server.ts"), `import { existsSync, readFileSync, writeFileSync } from "node:fs";
if (existsSync("fleet.pid")) {
  const p = Number(readFileSync("fleet.pid", "utf8"));
  let alive = false; try { process.kill(p, 0); alive = true; } catch {}
  if (alive) { console.log("REFUSING TO START: fleet server pid " + p + " is already running"); process.exit(1); }
}
writeFileSync("fleet.pid", process.pid + "\\n");
setInterval(() => {}, 1 << 30);
`);
// an address nothing answers, so the health probe never counts a strike; the probe interval keeps it quiet anyway
writeFileSync(join(dir, ".env"), `FLEET_HOST="127.0.0.1"\nFLEET_PORT="9"\n`);
const env = { ...process.env, TMUX_TMPDIR: dir, FLEET_WATCHDOG_SOCK: SOCK, FLEET_WATCHDOG_PROBE_S: "3600" } as Record<string, string>;
delete env.TMUX;
const tmux = (...a: string[]) => {
  const p = Bun.spawnSync(["tmux", "-N", "-L", SOCK, ...a], { env, stdout: "pipe", stderr: "pipe" });
  return { code: p.exitCode, out: p.stdout.toString().trim() };
};
const answering = (): number | null => { const r = tmux("display-message", "-p", "#{pid}"); return r.code === 0 ? Number(r.out) : null; };
const log = (): string => { try { return readFileSync(join(dir, "server.log"), "utf8"); } catch { return ""; } };
const count = (re: RegExp): number => log().split("\n").filter((l) => re.test(l)).length;
const holder = (): number => { try { return Number(readFileSync(join(dir, "fleet.pid"), "utf8")) || 0; } catch { return 0; } };
const alive = (pid: number): boolean => { try { process.kill(pid, 0); return true; } catch { return false; } };
const waitFor = async (pred: () => boolean, ms: number): Promise<boolean> => {
  for (const until = Date.now() + ms; Date.now() < until;) { if (pred()) return true; await Bun.sleep(200); }
  return pred();
};

// round 3's w5jung needs a live tmux server of this socket name that is OLDER than the one srv starts in: X0, one pane, no path
Bun.spawnSync(["tmux", "-L", SOCK, "new-session", "-d", "-s", "xalt", "sleep 600"], { env });
const x0 = answering() ?? 0;
const x0Start = tmux("display-message", "-p", "#{start_time}").out;
await Bun.sleep(1_200);
unlinkSync(sockPath);
const spawnWd = (path = env.PATH) => Bun.spawn(["sh", join(dir, "watchdog.sh")], { cwd: dir, env: { ...env, PATH: path }, stdout: "ignore", stderr: "ignore" });
let wd = spawnWd();
const started: number[] = [x0];
afterAll(() => {
  try { wd.kill(9); } catch { /* gone */ }
  for (const p of [...started, holder()]) { try { if (p > 0) process.kill(p, 9); } catch { /* gone */ } }
  Bun.spawnSync(["tmux", "-L", SOCK, "kill-server"], { env });
  rmSync(dir, { recursive: true, force: true });
});

// srv up in the first tmux server A, which also holds a seat, as Fleet's server does; Fleet records A in tmux-server
const up = await waitFor(() => alive(holder()) && answering() !== null, 15_000);
const a = answering() ?? 0;
const first = holder();
started.push(first);
tmux("new-session", "-d", "-s", "s1", "export FLEET_SELF_TOKEN='wd-1'; export FLEET_SELF_SLOT='1'; sleep 600; true"); // a seat's line, as ensureSlot's
writeFileSync(join(dir, "tmux-server"), `${a}\t\t${sockPath}\n`);

// 1 · the path vanishes while srv runs on in A
unlinkSync(sockPath);
const before = count(/srv was down, restarted/);
await Bun.sleep(16_000);
const respawns = count(/srv was down, restarted/) - before;
const refusals = count(/REFUSING TO START/);
const told = count(/no second srv/);

// 2 · and the fleet server is gone too: only the watchdog is left to give A its path back
process.kill(first, 9);
const back = await waitFor(() => answering() === a && tmux("has-session", "-t", "=srv").code === 0, 45_000)
  && await waitFor(() => holder() !== first && alive(holder()), 10_000); // the stand-in writes fleet.pid a moment after srv exists
const second = holder();
if (second !== first) started.push(second);
const sessions = tmux("list-sessions", "-F", "#{session_name}").out.split("\n").sort();
const secondUp = alive(second) && second !== first;

// 3 · slot 7's W1: a foreign server B takes the path, then the fleet server goes. `-N` alone would start srv inside B, beside none
// of the seats; the watchdog must give A its path back first.
unlinkSync(sockPath);
Bun.spawnSync(["tmux", "-L", SOCK, "new-session", "-d", "-s", "fremd", "sleep 600"], { env });
const foreign = answering() ?? 0;
if (foreign && foreign !== a) started.push(foreign);
try { process.kill(second, 9); } catch { /* scenario 2 did not bring it up; scenario 3 still runs */ }
const backFromForeign = await waitFor(() => answering() === a && tmux("has-session", "-t", "=srv").code === 0, 45_000)
  && await waitFor(() => holder() !== second && alive(holder()), 10_000);
const third = holder();
if (third !== second) started.push(third);
const sessionsAfterForeign = tmux("list-sessions", "-F", "#{session_name}").out.split("\n").sort();

// 4 · slot 7's N5: the record names a second live server X of this socket name, while A, where srv ran, answers and holds the
// seat. Then the fleet server goes. The watchdog must not hand X the path: srv starts again in A, beside the seat.
await Bun.sleep(6_000); // the loop has seen srv in A
unlinkSync(sockPath);
Bun.spawnSync(["tmux", "-L", SOCK, "new-session", "-d", "-s", "keep", "sleep 600"], { env });
const x = answering() ?? 0;
const xStart = tmux("display-message", "-p", "#{start_time}").out;
if (x && x !== a) started.push(x);
unlinkSync(sockPath);
process.kill(a, "SIGUSR1");
await waitFor(() => answering() === a, 5_000);
writeFileSync(join(dir, "tmux-server"), `${x}\t${xStart}\t${sockPath}\n`);
try { process.kill(third, 9); } catch { /* scenario 3 did not bring it up */ }
const n5Up = await waitFor(() => tmux("has-session", "-t", "=srv").code === 0 && holder() !== third && alive(holder()), 45_000);
const fourth = holder();
if (fourth !== third) started.push(fourth);
const n5 = { answering: answering(), sessions: tmux("list-sessions", "-F", "#{session_name}").out.split("\n").sort(), xAlive: alive(x) };

// 5 · round 3's w5jung, after launchd restarted the watchdog (nothing of the old loop is remembered): srv ran in A, which is newer
// and holds the seat; the record names the older X0 with one pane. Then the fleet server goes. X0 must get no signal.
try { wd.kill(9); } catch { /* gone */ }
await Bun.sleep(500);
wd = spawnWd();
await Bun.sleep(6_000);
writeFileSync(join(dir, "tmux-server"), `${x0}\t${x0Start}\t${sockPath}\n`);
try { process.kill(fourth, 9); } catch { /* scenario 4 did not bring it up */ }
const jungUp = await waitFor(() => tmux("has-session", "-t", "=srv").code === 0 && holder() !== fourth && alive(holder()), 45_000);
const fifth = holder();
if (fifth !== fourth) started.push(fifth);
const jung = { answering: answering(), sessions: tmux("list-sessions", "-F", "#{session_name}").out.split("\n").sort(), x0Alive: alive(x0) };

// 6 · round 4's R6b for the watchdog: the same conflict (the record names X0, A answers), but `ps -A` needs 5 s. What cannot be
// read waits: one line, no signal, no srv start, and the loop goes on instead of hanging on the table.
const slowA = join(dir, "slowA");
mkdirSync(slowA);
writeFileSync(join(slowA, "ps"), "#!/bin/sh\ncase \" $* \" in *\" -A \"*) sleep 5;; esac\nexec /bin/ps \"$@\"\n");
chmodSync(join(slowA, "ps"), 0o755);
try { wd.kill(9); } catch { /* gone */ }
await Bun.sleep(500);
wd = spawnWd(`${slowA}:${env.PATH}`);
await Bun.sleep(3_000);
const signalsBefore = count(new RegExp(`SIGUSR1 to ${x0}`));
try { process.kill(fifth, 9); } catch { /* scenario 5 did not bring it up */ }
const waited = await waitFor(() => count(/ps -A did not answer within 3 s/) >= 2, 40_000);
const slow = { waited, signals: count(new RegExp(`SIGUSR1 to ${x0}`)) - signalsBefore, answering: answering(), x0Alive: alive(x0) };

// 7 · on Linux a tmux server's comm is `tmux: server` (tmux compat/setproctitle.c), so this `ps` shows it that way: the recorded
// server is still known: a foreign server at the path gives way, and srv starts beside the seat, not in the foreign server.
const linuxName = join(dir, "linuxName");
mkdirSync(linuxName);
writeFileSync(join(linuxName, "ps"), "#!/bin/sh\ncase \" $* \" in *=,*) echo folded; exit 1 ;; *comm=*) /bin/ps \"$@\" | sed -E 's#[^ ]*tmux$#tmux: server#' ;; *) exec /bin/ps \"$@\" ;; esac\n");
chmodSync(join(linuxName, "ps"), 0o755);
try { wd.kill(9); } catch { /* gone */ }
await Bun.sleep(500);
writeFileSync(join(dir, "tmux-server"), `${a}\t\t${sockPath}\n`);
unlinkSync(sockPath);
Bun.spawnSync(["tmux", "-L", SOCK, "new-session", "-d", "-s", "fremd2", "sleep 600"], { env });
const foreign2 = answering() ?? 0;
if (foreign2 && foreign2 !== a) started.push(foreign2);
wd = spawnWd(`${linuxName}:${env.PATH}`);
const linuxBack = await waitFor(() => answering() === a && tmux("has-session", "-t", "=srv").code === 0, 20_000);
if (holder()) started.push(holder());
const onLinux = { back: linuxBack, answering: answering() };

test("the watchdog starts srv in its own tmux server", () => {
  expect(up).toBe(true);
  expect(a).toBeGreaterThan(0);
});

test("a vanished socket while the fleet server lives: no respawn loop, no refusal, one line naming the pid", () => {
  expect({ respawns, refusals }).toEqual({ respawns: 0, refusals: 0 });
  expect(told).toBe(1);
  expect(log()).toContain(`fleet server pid ${first} still runs`);
});

test("with the fleet server gone, the watchdog gives the old tmux server its path back and srv starts there, not in a second server", () => {
  expect(back).toBe(true);
  expect(sessions).toEqual(["s1", "srv"]);
  expect(secondUp).toBe(true);
});

test("W1: a foreign tmux server holds the path and the fleet server is gone: srv starts beside the seats, not in the foreign server", () => {
  expect(foreign).toBeGreaterThan(0);
  expect(foreign).not.toBe(a);
  expect(backFromForeign).toBe(true);
  expect(sessionsAfterForeign).toEqual(["s1", "srv"]);
  expect(log()).toContain(`tmux server pid ${foreign} holds the path`);
});

test("N5: the record names a second live tmux server; srv starts again in the server that holds the seat, which keeps its path", () => {
  expect(x).toBeGreaterThan(0);
  expect(x).not.toBe(a);
  expect(n5Up).toBe(true);
  expect(n5.answering).toBe(a);
  expect(n5.sessions).toEqual(["s1", "srv"]);
  expect(n5.xAlive).toBe(true);
  expect(log()).not.toContain(`SIGUSR1 to ${x}`);
});

test("w5jung: after its own restart the watchdog still gives no signal to an older recorded server without seats; srv starts in A", () => {
  expect(x0).toBeGreaterThan(0);
  expect(x0).not.toBe(a);
  expect(jungUp).toBe(true);
  expect(jung.answering).toBe(a);
  expect(jung.sessions).toEqual(["s1", "srv"]);
  expect(jung.x0Alive).toBe(true);
  expect(log()).not.toContain(`SIGUSR1 to ${x0}`);
});

test("a recorded server that ps shows as `tmux: server`, as on Linux, is known: it gets its path back from a foreign server and srv starts in it", () => {
  expect(onLinux.back).toBe(true);
  expect(onLinux.answering).toBe(a);
});

test("R6b: when ps -A does not answer in time the watchdog waits round after round, signals nothing and starts no srv", () => {
  expect(slow.waited).toBe(true);
  expect(slow.signals).toBe(0);
  expect(slow.answering).toBe(a);
  expect(slow.x0Alive).toBe(true);
});
