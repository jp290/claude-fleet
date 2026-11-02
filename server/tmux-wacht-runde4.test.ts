// Slot 7's round 4 on branch/stabilitaet 0f08fbcfe (~/local-notes/w2-start-setzen/stabilitaet-pruefung.md, RUNDE 4), with its inputs
// (its probes p11runde4.ts, p12runde4.ts and slowAbin/ps). Fleet hands the guard its slots with their current self credential, as
// server.ts does; here slot 1 holds the credential "cur-1" (a test value).
// - R4a: a foreign B at the path holds two panes whose line merely contains `FLEET_SELF_SLOT=`; A, recorded, holds one real seat.
// - R4b: the same, B holds two bare sessions named s1 and s2.
// - R4c: the same, B's two panes carry real-looking seat lines with a stale credential (an orphaned Fleet server, 26.10. / 1.11.).
//   In all three A gets the path back, is recorded, and Fleet does not restart into B.
// - R6b: the checker's R1 (Fleet in A, newer, three seats; the record names an older X without a seat) with a `ps` that needs 5 s
//   only for `-A`: what cannot be read waits. No signal to X, no restart, A keeps the path, the gate refuses with a line.
// - and while Fleet does not know its seats yet (before its state is loaded), the same conflict waits too.
// Real tmux servers on sockets of their own; the child imports only server/tmux-wacht.ts, so this runs against a tree without the fix.
// No pane's argument text is ever read back into a result here; results carry pids, counts and the guard's own lines.
import { afterAll, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = mkdtempSync("/tmp/ftv-");
const slowA = join(dir, "slowA");
mkdirSync(slowA);
// the checker's slowAbin/ps: slow only for the whole table
writeFileSync(join(slowA, "ps"), "#!/bin/sh\ncase \" $* \" in *\" -A \"*) sleep 5;; esac\nexec /bin/ps \"$@\"\n");
chmodSync(join(slowA, "ps"), 0o755);
const PATH = process.env.PATH ?? "/usr/bin:/bin";
const base = { HOME: dir, TMUX_TMPDIR: dir, LANG: "en_US.UTF-8", PATH };
const socks: string[] = [];
afterAll(() => {
  for (const s of socks) Bun.spawnSync(["tmux", "-L", s, "kill-server"], { env: base });
  rmSync(dir, { recursive: true, force: true });
});

const prelude = (sock: string, slowPs: boolean, sitze: string): string => `
const W = await import(${JSON.stringify(join(import.meta.dir, "tmux-wacht.ts"))});
import { readFileSync, rmSync, writeFileSync } from "node:fs";
const SOCK = ${JSON.stringify(sock)};
const path = ${JSON.stringify(join(dir, `tmux-${process.getuid?.() ?? 0}`, sock))};
const file = ${JSON.stringify(join(dir, `hs-${sock}`))};
const envN = { HOME: ${JSON.stringify(dir)}, TMUX_TMPDIR: ${JSON.stringify(dir)}, PATH: ${JSON.stringify(PATH)} };
const envW = ${slowPs ? `{ ...envN, PATH: ${JSON.stringify(`${slowA}:${PATH}`)} }` : "envN"};
delete process.env.TMUX;
const sh = (...a: string[]) => { const r = Bun.spawnSync(a, { env: envN, stdout: "pipe", stderr: "pipe" }); return { code: r.exitCode, out: r.stdout.toString().trim() }; };
const info = () => ({ pid: Number(sh("tmux", "-N", "-L", SOCK, "display", "-p", "#{pid}").out), start: sh("tmux", "-N", "-L", SOCK, "display", "-p", "#{start_time}").out });
const sess = (name: string, cmd = "sleep 300") => sh("tmux", "-L", SOCK, "new-session", "-d", "-s", name, cmd);
const line = (token: string, n: number) => "export FLEET_SELF_TOKEN='" + token + "'; export FLEET_SELF_SLOT='" + n + "'; sleep 300; true";
const DECOY = "echo FLEET_SELF_SLOT=; sleep 300; true";
const answering = () => { const r = sh("tmux", "-N", "-L", SOCK, "display", "-p", "#{pid}"); return r.code === 0 ? Number(r.out) : null; };
const rec = (pid: number, start: string) => writeFileSync(file, pid + "\\t" + start + "\\t" + path + "\\n");
const recorded = () => { try { return Number(readFileSync(file, "utf8").split("\\t")[0]); } catch { return null; } };
let neustart = 0; const lines: string[] = [];
W.configureTmuxWacht({ sock: SOCK, env: envW, file, melde: (l: string) => lines.push(l), neustart: () => { neustart++; return true; },
  answerTimeoutMs: 1500, reattachWaitMs: 2500, refusedSignalMs: 6000, sitze: ${sitze} });
const done = (o: object) => console.log(JSON.stringify({ ...o, neustart, lines }));
`;

const CURRENT = `() => [{ slot: 1, token: "cur-1" }, { slot: 2, token: "cur-2" }, { slot: 3, token: "cur-3" }]`;
async function child(name: string, body: string, slowPs = false, sitze = CURRENT): Promise<Record<string, any>> {
  const sock = `ftv-${name}-${process.pid}`;
  socks.push(sock);
  const script = join(dir, `${name}.ts`);
  await Bun.write(script, prelude(sock, slowPs, sitze) + body);
  const p = Bun.spawn([process.execPath, script], { cwd: dir, stdout: "pipe", stderr: "pipe", env: base });
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  await p.exited;
  const last = out.trim().split("\n").at(-1) ?? "";
  if (!last.startsWith("{")) throw new Error(`${name} failed (exit ${p.exitCode}, ${err.length} bytes on stderr)`);
  return JSON.parse(last);
}

// R4: A with one real seat, recorded; Fleet in A; then a foreign B takes the path with the given panes
const decoy = (name: string, panes: string) => child(name, `
sess("s1", line("cur-1", 1)); const A = info();
rec(A.pid, A.start);
await Bun.sleep(1200); rmSync(path);
${panes}
const B = info().pid;
process.env.TMUX = path + "," + A.pid + ",0";
const g = await W.vorNeuerSitzung();
await Bun.sleep(300);
const r = { a: A.pid, b: B, g, answering: answering(), recorded: recorded() };
process.kill(B, "SIGTERM"); process.kill(A.pid, "SIGTERM");
done(r);
`);
const r4a = await decoy("r4a", `sess("d1", DECOY); sess("d2", DECOY);`);
const r4b = await decoy("r4b", `sess("s1"); sess("s2");`);
const r4c = await decoy("r4c", `sess("o1", line("old-1", 1)); sess("o2", line("old-2", 2));`);

// R6b: the checker's R1 with ps slow only for -A
const r1 = (name: string, slowPs: boolean, sitze = CURRENT) => child(name, `
sess("xalt"); const X = info();
await Bun.sleep(1200); rmSync(path);
sess("a1", line("cur-1", 1)); const A = info(); sess("a2", line("cur-2", 2)); sess("a3", line("cur-3", 3));
rec(X.pid, X.start);
process.env.TMUX = path + "," + A.pid + ",0";
const g = await W.vorNeuerSitzung();
await Bun.sleep(300);
const r = { a: A.pid, x: X.pid, g, answering: answering(), recorded: recorded() };
process.kill(X.pid, "SIGTERM"); process.kill(A.pid, "SIGTERM");
done(r);
`, slowPs, sitze);
const r6b = await r1("r6b", true);
const early = await r1("early", false, "() => null");
const r1ok = await r1("r1ok", false);

for (const [name, r] of [["R4a: lines that merely contain FLEET_SELF_SLOT=", r4a], ["R4b: bare sessions named s1, s2", r4b],
  ["R4c: seat lines with a stale credential", r4c]] as const) {
  test(`${name} in a foreign server do not take the path from the server with Fleet's real seat`, () => {
    expect(r.answering).toBe(r.a);
    expect(r.recorded).toBe(r.a);
    expect(r.neustart).toBe(0);
    expect(r.g).toEqual({ flags: ["-N"], startsServer: false });
  });
}

test("R6b: a process table that does not answer in time decides nothing: no signal, no restart, the gate waits with a line", () => {
  expect(r6b.neustart).toBe(0);
  expect(r6b.answering).toBe(r6b.a);
  expect(r6b.recorded).toBe(r6b.x); // nothing was decided, so nothing was recorded
  expect(r6b.g.refuse).toBeDefined();
  expect(r6b.g.refuse).toContain("ps -A did not answer within 3 s");
});

test("while Fleet does not know its own seats yet, the same conflict waits too", () => {
  expect(early.neustart).toBe(0);
  expect(early.answering).toBe(early.a);
  expect(early.g.refuse).toContain("Fleet does not know its own seats yet");
});

test("with the table read in time, the seats with the current credential keep the path (R1 = N5b)", () => {
  expect(r1ok.neustart).toBe(0);
  expect(r1ok.answering).toBe(r1ok.a);
  expect(r1ok.recorded).toBe(r1ok.a);
  expect(r1ok.g).toEqual({ flags: ["-N"], startsServer: false });
  expect(r1ok.lines.join("\n")).toContain(`pid ${r1ok.x} (recorded in`); // here the record does name it
});
