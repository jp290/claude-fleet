// Slot 7's round 5 on branch/stabilitaet ea69707de (~/local-notes/w2-start-setzen/stabilitaet-pruefung.md, RUNDE 5), with its inputs
// (its probes p14loop.sh and p13runde5.ts): O is the older server with three seat lines whose credentials are stale, A the newer one
// with two current seats. Fleet hands the guard its slots as server.ts does; "cur-1" … are test values.
// - L2: the path is at O and the record names O. L4: the path is at O and there is no record (the first boot after this lands).
//   Fleet runs in O, compared nothing and said nothing. Now, once after loading, A gets its path and Fleet restarts beside it.
// - the same with Fleet not in a pane, and with nothing answering on the path (a new server would have been a copy).
// - before loading it does not decide; a tie and a majority at the path stay where they are, with a line; a table that cannot be read waits.
// - stale lines elsewhere change nothing, and neither do current ones under a server of another socket name.
// - R4e: two panes that copied the current credential and slot of one seat count once.
// - on Linux a tmux server's comm is `tmux: server` (tmux compat/setproctitle.c): a recorded server shown that way is still known.
// Real tmux servers on sockets of their own; the child imports only server/tmux-wacht.ts, so this runs against a tree without the fix.
// No pane's argument text is ever read back into a result here; results carry pids, counts and the guard's own lines.
import { afterAll, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = mkdtempSync("/tmp/ftw-");
const slowA = join(dir, "slowA");
mkdirSync(slowA);
writeFileSync(join(slowA, "ps"), "#!/bin/sh\ncase \" $* \" in *\" -A \"*) sleep 5;; esac\nexec /bin/ps \"$@\"\n");
chmodSync(join(slowA, "ps"), 0o755);
const linuxName = join(dir, "linuxName");
mkdirSync(linuxName);
// …and procps may read `-o a=,b=` as one column whose header is the rest (its man page: use several -o), so this one refuses a comma list
writeFileSync(join(linuxName, "ps"), "#!/bin/sh\ncase \" $* \" in *=,*) echo folded; exit 1 ;; *comm=*) /bin/ps \"$@\" | sed -E 's#[^ ]*tmux$#tmux: server#' ;; *) exec /bin/ps \"$@\" ;; esac\n");
chmodSync(join(linuxName, "ps"), 0o755);
const PATH = process.env.PATH ?? "/usr/bin:/bin";
const base = { HOME: dir, TMUX_TMPDIR: dir, LANG: "en_US.UTF-8", PATH };
const socks: string[] = [];
afterAll(() => {
  for (const s of socks) Bun.spawnSync(["tmux", "-L", s, "kill-server"], { env: base });
  rmSync(dir, { recursive: true, force: true });
});

const prelude = (sock: string, psDir: string | null, sitze: string): string => `
const W = await import(${JSON.stringify(join(import.meta.dir, "tmux-wacht.ts"))});
import { readFileSync, rmSync, writeFileSync } from "node:fs";
const SOCK = ${JSON.stringify(sock)};
const path = ${JSON.stringify(join(dir, `tmux-${process.getuid?.() ?? 0}`, sock))};
const file = ${JSON.stringify(join(dir, `hs-${sock}`))};
const envN = { HOME: ${JSON.stringify(dir)}, TMUX_TMPDIR: ${JSON.stringify(dir)}, PATH: ${JSON.stringify(PATH)} };
const envW = ${psDir ? `{ ...envN, PATH: ${JSON.stringify(`${psDir}:${PATH}`)} }` : "envN"};
delete process.env.TMUX;
const sh = (...a: string[]) => { const r = Bun.spawnSync(a, { env: envN, stdout: "pipe", stderr: "pipe" }); return { code: r.exitCode, out: r.stdout.toString().trim() }; };
const info = () => ({ pid: Number(sh("tmux", "-N", "-L", SOCK, "display", "-p", "#{pid}").out), start: sh("tmux", "-N", "-L", SOCK, "display", "-p", "#{start_time}").out });
const sess = (name: string, cmd: string) => sh("tmux", "-L", SOCK, "new-session", "-d", "-s", name, cmd);
const line = (token: string, n: number) => "export FLEET_SELF_TOKEN='" + token + "'; export FLEET_SELF_SLOT='" + n + "'; sleep 300; true";
const answering = () => { const r = sh("tmux", "-N", "-L", SOCK, "display", "-p", "#{pid}"); return r.code === 0 ? Number(r.out) : null; };
const rec = (pid: number, start: string) => writeFileSync(file, pid + "\\t" + start + "\\t" + path + "\\n");
const recorded = () => { try { return Number(readFileSync(file, "utf8").split("\\t")[0]); } catch { return null; } };
let neustart = 0; const lines: string[] = []; let bekannt = true;
W.configureTmuxWacht({ sock: SOCK, env: envW, file, melde: (l: string) => lines.push(l), neustart: () => { neustart++; return true; },
  answerTimeoutMs: 1500, reattachWaitMs: 2500, refusedSignalMs: 6000, sitze: ${sitze} });
const done = (o: object) => console.log(JSON.stringify({ ...o, neustart, lines }));
// O: older, three stale seat lines. A: newer, the given current seats. Then O takes the path back, as the watchdog's signal does.
const OA = async (aSeats: number[], oLines: [string, number][] = [["old-1", 1], ["old-2", 2], ["old-3", 3]]) => {
  sess("s1", line(...oLines[0])); const O = info();
  for (const [i, l] of oLines.slice(1).entries()) sess("s" + (i + 2), line(...l));
  await Bun.sleep(1200); rmSync(path);
  for (const n of aSeats) sess("s" + n, line("cur-" + n, n));
  const A = info();
  rmSync(path); process.kill(O.pid, "SIGUSR1"); await Bun.sleep(500);
  return { O, A };
};
const ende = (...pids: (number | null)[]) => { for (const p of pids) if (p) try { process.kill(p, "SIGTERM"); } catch {} };
`;

const CURRENT = `() => bekannt ? [{ slot: 1, token: "cur-1" }, { slot: 2, token: "cur-2" }, { slot: 3, token: "cur-3" }] : null`;
async function child(name: string, body: string, psDir: string | null = null, sitze = CURRENT): Promise<Record<string, any>> {
  const sock = `ftw-${name}-${process.pid}`;
  socks.push(sock);
  const script = join(dir, `${name}.ts`);
  await Bun.write(script, prelude(sock, psDir, sitze) + body);
  const p = Bun.spawn([process.execPath, script], { cwd: dir, stdout: "pipe", stderr: "pipe", env: base });
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  await p.exited;
  const last = out.trim().split("\n").at(-1) ?? "";
  if (!last.startsWith("{")) throw new Error(`${name} failed (exit ${p.exitCode}, ${err.length} bytes on stderr)`);
  return JSON.parse(last);
}

// Fleet in O, the record as the case says
const fleetInO = (name: string, setup: string) => child(name, `
const { O, A } = await OA([1, 2]);
${setup}
process.env.TMUX = path + "," + O.pid + ",0";
const g = await W.vorNeuerSitzung();
await Bun.sleep(300);
const r = { o: O.pid, a: A.pid, g, answering: answering(), recorded: recorded() };
ende(O.pid, A.pid);
done(r);
`);

const [l2, l4, frei, niemand, vorLaden, gleich, mehrHier, langsam, alt, fremd, r4e, linux] = await Promise.all([
  fleetInO("l2", `rec(O.pid, O.start);`),
  fleetInO("l4", ``),
  // Fleet outside a pane: A gets the path, O runs on, nothing restarts
  child("frei", `
const { O, A } = await OA([1, 2]);
const g = await W.vorNeuerSitzung();
const r = { o: O.pid, a: A.pid, g, answering: answering(), recorded: recorded() };
ende(O.pid, A.pid); done(r);
`),
  // nothing answers and nothing is recorded, A lives with the seats: a new-session would have started a server with a copy
  child("niemand", `
sess("s1", line("cur-1", 1)); const A = info(); sess("s2", line("cur-2", 2));
rmSync(path);
const g = await W.vorNeuerSitzung();
const r = { a: A.pid, g, answering: answering(), recorded: recorded() };
ende(A.pid); done(r);
`),
  // before the state is loaded nothing is decided, and the first check after it does
  child("vorladen", `
bekannt = false;
const { O, A } = await OA([1, 2]);
rec(O.pid, O.start);
process.env.TMUX = path + "," + O.pid + ",0";
const vorher = await W.pruefeTmux();
const antwortVorher = answering();
bekannt = true;
const g = await W.vorNeuerSitzung();
const r = { o: O.pid, a: A.pid, vorher, antwortVorher, g, answering: answering(), recorded: recorded() };
ende(O.pid, A.pid); done(r);
`),
  // a healed copy carries the same credential: on a tie the path stays, with a line
  child("gleich", `
const { O, A } = await OA([1, 2], [["cur-1", 1], ["cur-2", 2]]);
rec(O.pid, O.start);
process.env.TMUX = path + "," + O.pid + ",0";
const g = await W.vorNeuerSitzung();
const r = { o: O.pid, a: A.pid, g, answering: answering(), recorded: recorded() };
ende(O.pid, A.pid); done(r);
`),
  // more of the seats at the path: it stays there, and the line names the others
  child("mehrhier", `
const { O, A } = await OA([3], [["cur-1", 1], ["cur-2", 2]]);
const g = await W.vorNeuerSitzung();
const r = { o: O.pid, a: A.pid, g, answering: answering(), recorded: recorded() };
ende(O.pid, A.pid); done(r);
`),
  // what cannot be read waits with a line, as in R6b
  child("langsam", `
const { O, A } = await OA([1, 2]);
rec(O.pid, O.start);
const g = await W.vorNeuerSitzung();
const r = { o: O.pid, a: A.pid, g, answering: answering(), recorded: recorded() };
ende(O.pid, A.pid); done(r);
`, slowA),
  // the end state of L1: stale lines without a path are no seats; nothing is said or signalled
  child("alt", `
sess("s1", line("old-1", 1)); const O = info();
await Bun.sleep(1200); rmSync(path);
sess("s1", line("cur-1", 1)); const A = info();
rec(A.pid, A.start);
const g = await W.vorNeuerSitzung();
const r = { o: O.pid, a: A.pid, g, answering: answering(), recorded: recorded() };
ende(O.pid, A.pid); done(r);
`),
  // current lines under a tmux server of another socket name are no server of this path
  child("fremd", `
sh("tmux", "-L", SOCK + "x", "new-session", "-d", "-s", "s1", line("cur-1", 1));
const F = Number(sh("tmux", "-N", "-L", SOCK + "x", "display", "-p", "#{pid}").out);
sess("h1", "sleep 300"); const H = info();
const g = await W.vorNeuerSitzung();
const r = { h: H.pid, f: F, g, answering: answering(), recorded: recorded() };
ende(H.pid, F); done(r);
`),
  // the checker's R4e: A, recorded, holds one seat; B at the path holds two panes with slot 1's current credential copied
  child("r4e", `
sess("s1", line("cur-1", 1)); const A = info();
rec(A.pid, A.start);
await Bun.sleep(1200); rmSync(path);
sess("k1", line("cur-1", 1)); sess("k2", line("cur-1", 1));
const B = info().pid;
process.env.TMUX = path + "," + A.pid + ",0";
const g = await W.vorNeuerSitzung();
await Bun.sleep(300);
const r = { a: A.pid, b: B, g, answering: answering(), recorded: recorded() };
ende(A.pid, B); done(r);
`),
  // ps shows the recorded server as Linux does: A with the seat, recorded; a foreign B at the path
  child("linux", `
sess("s1", line("cur-1", 1)); const A = info();
rec(A.pid, A.start);
await Bun.sleep(1200); rmSync(path);
sess("d1", "sleep 300");
const B = info().pid;
const g = await W.vorNeuerSitzung();
await Bun.sleep(300);
const r = { a: A.pid, b: B, g, answering: answering(), recorded: recorded() };
ende(A.pid, B); done(r);
`, linuxName),
]);

for (const [name, r] of [["L2: a wrong record", l2], ["L4: no record", l4]] as const) {
  test(`${name} with the path at O: the server with the current seats gets its path, Fleet restarts beside them and says so`, () => {
    expect(r.answering).toBe(r.a);
    expect(r.recorded).toBe(r.a);
    expect(r.neustart).toBe(1);
    expect(r.lines.join("\n")).toContain(`pid ${r.a}`);
    expect(r.lines.join("\n")).toContain("took the path back");
  });
}

test("the same with Fleet outside a pane: the path goes to the seats, nothing restarts, the line names the server left behind", () => {
  expect(frei.answering).toBe(frei.a);
  expect(frei.recorded).toBe(frei.a);
  expect(frei.neustart).toBe(0);
  expect(frei.lines.join("\n")).toContain(`pid ${frei.o} runs on without a path`);
});

test("nothing answers and nothing is recorded while the seats live: their server gets the path, no second server starts", () => {
  expect(niemand.answering).toBe(niemand.a);
  expect(niemand.recorded).toBe(niemand.a);
  expect(niemand.g.startsServer).not.toBe(true);
});

test("before the state is loaded nothing is decided; the first check after it decides", () => {
  expect(vorLaden.vorher.state).toBe("ok");
  expect(vorLaden.antwortVorher).toBe(vorLaden.o);
  expect(vorLaden.answering).toBe(vorLaden.a);
  expect(vorLaden.neustart).toBe(1);
});

test("a tie stays where the path is: no signal, no restart, and a line that names the other server", () => {
  expect(gleich.answering).toBe(gleich.o);
  expect(gleich.recorded).toBe(gleich.o);
  expect(gleich.neustart).toBe(0);
  expect(gleich.lines).toHaveLength(1);
  expect(gleich.lines[0]).toContain(`pid ${gleich.a}`);
  expect(gleich.lines[0]).toContain("holds 2 of Fleet's seats");
  expect(gleich.lines[0]).toContain("holding 2 of");
  expect(gleich.lines[0]).not.toContain("recorded in"); // the record names the server at the path, not this one
});

test("more seats at the path: the path stays, and the line names the seats that lie elsewhere", () => {
  expect(mehrHier.answering).toBe(mehrHier.o);
  expect(mehrHier.neustart).toBe(0);
  expect(mehrHier.lines[0]).toContain("holds 2 of Fleet's seats");
  expect(mehrHier.lines[0]).toContain("holding 1 of");
  expect(mehrHier.lines[0]).not.toContain("recorded in");
});

test("a process table that does not answer in time decides nothing: no signal, the gate waits with a line", () => {
  expect(langsam.answering).toBe(langsam.o);
  expect(langsam.neustart).toBe(0);
  expect(langsam.g.refuse).toContain("ps -A did not answer within 3 s");
});

test("stale seat lines elsewhere are no seats: no signal, no line", () => {
  expect(alt.answering).toBe(alt.a);
  expect(alt.neustart).toBe(0);
  expect(alt.lines).toEqual([]);
  expect(alt.g).toEqual({ flags: ["-N"], startsServer: false });
});

test("current seat lines under a tmux server of another socket name change nothing", () => {
  expect(fremd.answering).toBe(fremd.h);
  expect(fremd.neustart).toBe(0);
  expect(fremd.lines).toEqual([]);
});

test("a recorded server that ps shows as `tmux: server` and with procps's reading of a comma list, as on Linux, is still known and gets its path back", () => {
  expect(linux.answering).toBe(linux.a);
  expect(linux.recorded).toBe(linux.a);
});

test("R4e: two panes that copied one seat's credential and slot count once: the recorded server with that seat gets the path back", () => {
  expect(r4e.answering).toBe(r4e.a);
  expect(r4e.recorded).toBe(r4e.a);
  expect(r4e.neustart).toBe(0);
});
