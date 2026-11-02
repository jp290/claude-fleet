// Slot 7's round 2 on branch/stabilitaet 39e227417 (~/local-notes/w2-start-setzen/stabilitaet-pruefung.md, RUNDE 2), with its inputs
// (its probes p7eperm.ts and p6runde2.ts):
// - U1: the record `tmux-server` names a pid of another user (pid 1, launchd; after a restart of the Mac the old pid may be a root
//   process). That is never Fleet's tmux server: the gate opens, with -N when a server answers, and start-server may run at boot.
//   A line that does wait names its real reason and the record's file.
// - N5: Fleet runs in server A, which answers and holds a seat; the record names a second live server X of the same socket name.
//   Fleet gives X no path and ends nothing, and no line says X holds every seat.
// - W1 stays: Fleet in a foreign server B that holds only srv still gives the seats' server A its path back and restarts.
// Real tmux servers on sockets of their own; the child imports only server/tmux-wacht.ts, so this runs against a tree without the fix.
import { afterAll, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = mkdtempSync("/tmp/ftr-");
const fakebin = join(dir, "bin");
mkdirSync(fakebin);
writeFileSync(join(fakebin, "ps"), "#!/bin/sh\nsleep 5\nexec /bin/ps \"$@\"\n");
chmodSync(join(fakebin, "ps"), 0o755);
const PATH = process.env.PATH ?? "/usr/bin:/bin";
const base = { HOME: dir, TMUX_TMPDIR: dir, LANG: "en_US.UTF-8", PATH };
const socks: string[] = [];
afterAll(() => {
  for (const s of socks) Bun.spawnSync(["tmux", "-L", s, "kill-server"], { env: base });
  rmSync(dir, { recursive: true, force: true });
});

const prelude = (sock: string, slowPs: boolean): string => `
const W = await import(${JSON.stringify(join(import.meta.dir, "tmux-wacht.ts"))});
import { readFileSync, rmSync, writeFileSync } from "node:fs";
const SOCK = ${JSON.stringify(sock)};
const path = ${JSON.stringify(join(dir, `tmux-${process.getuid?.() ?? 0}`, sock))};
const file = ${JSON.stringify(join(dir, `hs-${sock}`))};
const envN = { HOME: ${JSON.stringify(dir)}, TMUX_TMPDIR: ${JSON.stringify(dir)}, PATH: ${JSON.stringify(PATH)} };
const envW = ${slowPs ? `{ ...envN, PATH: ${JSON.stringify(`${fakebin}:${PATH}`)} }` : "envN"};
delete process.env.TMUX;
const sh = (...a: string[]) => { const r = Bun.spawnSync(a, { env: envN, stdout: "pipe", stderr: "pipe" }); return { code: r.exitCode, out: r.stdout.toString().trim() }; };
const srvA = (name = "keep") => { sh("tmux", "-L", SOCK, "new-session", "-d", "-s", name, "sleep 300");
  return { pid: Number(sh("tmux", "-N", "-L", SOCK, "display", "-p", "#{pid}").out), start: sh("tmux", "-N", "-L", SOCK, "display", "-p", "#{start_time}").out }; };
const answering = () => { const r = sh("tmux", "-N", "-L", SOCK, "display", "-p", "#{pid}"); return r.code === 0 ? Number(r.out) : null; };
const sessions = () => { const r = sh("tmux", "-N", "-L", SOCK, "ls", "-F", "#S"); return r.code === 0 ? r.out.split("\\n").sort() : []; };
const rec = (pid: number, start: string) => writeFileSync(file, pid + "\\t" + start + "\\t" + path + "\\n");
const recorded = () => { try { return Number(readFileSync(file, "utf8").split("\\t")[0]); } catch { return null; } };
let neustart = 0; const lines: string[] = [];
W.configureTmuxWacht({ sock: SOCK, env: envW, file, melde: (l: string) => lines.push(l), neustart: () => { neustart++; return true; },
  answerTimeoutMs: 1500, reattachWaitMs: 2500, refusedSignalMs: 6000 });
const done = (o: object) => console.log(JSON.stringify({ ...o, neustart, lines }));
`;

async function child(name: string, body: string, slowPs = false): Promise<Record<string, any>> {
  const sock = `ftr-${name}-${process.pid}`;
  socks.push(sock);
  const script = join(dir, `${name}.ts`);
  await Bun.write(script, prelude(sock, slowPs) + body);
  const p = Bun.spawn([process.execPath, script], { cwd: dir, stdout: "pipe", stderr: "pipe", env: base });
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  await p.exited;
  const line = out.trim().split("\n").at(-1) ?? "";
  if (!line.startsWith("{")) throw new Error(`${name} failed: ${err.slice(0, 600)} ${out.slice(0, 300)}`);
  return JSON.parse(line);
}

// the checker's N8: the record names pid 1, Fleet runs in a new server Y that answers
const n8 = await child("n8", `
const Y = srvA();
rec(1, "1793000000");
process.env.TMUX = path + "," + Y.pid + ",0";
const g1 = await W.vorNeuerSitzung();
await Bun.sleep(1200);
const g2 = await W.vorNeuerSitzung();
done({ y: Y.pid, g1, g2, answering: answering(), recorded: recorded() });
`);
// the checker's N9: the record names pid 1 and no server answers (Fleet's start after the Mac restarted)
const n9 = await child("n9", `
rec(1, "1793000000");
const g = await W.vorNeuerSitzung();
const lage = await W.pruefeTmux();
done({ g, state: lage.state });
`);
// the checker's N5: A holds the seat and answers, Fleet runs in A; the record names a second live server X
const n5 = await child("n5", `
const A = srvA();
rmSync(path);
const X = srvA();
rmSync(path);
process.kill(A.pid, "SIGUSR1");
await Bun.sleep(500);
rec(X.pid, X.start);
process.env.TMUX = path + "," + A.pid + ",0";
const g = await W.vorNeuerSitzung();
await Bun.sleep(300);
const r = { a: A.pid, x: X.pid, g, answering: answering(), sessions: sessions(), recorded: recorded(), xAlive: (() => { try { process.kill(X.pid, 0); return true; } catch { return false; } })() };
process.kill(X.pid, "SIGTERM");
done(r);
`);
// the checker's W1: Fleet in B, which holds only srv; the record names A, which holds the seat
const w1 = await child("w1", `
const A = srvA();
rec(A.pid, A.start);
rmSync(path);
sh("tmux", "-L", SOCK, "new-session", "-d", "-s", "srv", "sleep 300");
const B = answering()!;
process.env.TMUX = path + "," + B + ",0";
const g = await W.vorNeuerSitzung();
await Bun.sleep(300);
const r = { a: A.pid, b: B, g, answering: answering(), sessions: sessions() };
process.kill(B, "SIGTERM");
done(r);
`);
// W1 with a tie, found in a run of the real watchdog.sh with this module: Fleet runs in a foreign, younger B that holds one session
// of its own; A holds one seat, is stalled while Fleet asks for its path and takes it back only after the wait. A keeps the path,
// the record stays A, and Fleet restarts so srv runs beside the seat.
const tie = await child("tie", `
const A = srvA("s1");
rec(A.pid, A.start);
rmSync(path);
await Bun.sleep(1100); // B starts a second later than A
sh("tmux", "-L", SOCK, "new-session", "-d", "-s", "fremd", "sleep 300");
const B = answering()!;
process.env.TMUX = path + "," + B + ",0";
process.kill(A.pid, "SIGSTOP");
const g1 = await W.vorNeuerSitzung();
process.kill(A.pid, "SIGCONT");
await Bun.sleep(1000);
const g2 = await W.vorNeuerSitzung();
const r = { a: A.pid, b: B, g1, g2, answering: answering(), recorded: recorded() };
process.kill(B, "SIGTERM");
done(r);
`);
// a wait that is real: A lives without a path and ps needs 5 s. The line names the reason and the record's file.
const slow = await child("slow", `
const A = srvA();
rec(A.pid, A.start);
rmSync(path);
const g = await W.vorNeuerSitzung();
const r = { a: A.pid, g, file };
process.kill(A.pid, "SIGTERM");
done(r);
`, true);

test("U1: a record naming another user's pid (pid 1) does not lock the gate; a pane opens with -N in the server that answers", () => {
  expect(n8.g1).toEqual({ flags: ["-N"], startsServer: false });
  expect(n8.g2).toEqual({ flags: ["-N"], startsServer: false });
  expect(n8.answering).toBe(n8.y);
  expect(n8.recorded).toBe(n8.y);
  expect(n8.lines.join("\n")).not.toMatch(/ps did not answer/);
});

test("U1: with that record and no server, Fleet may start one (the boot's start-server runs)", () => {
  expect(n9.g).toEqual({ flags: [], startsServer: true });
  expect(n9.state).toBe("none");
});

test("U1: a gate that waits on an unconfirmed pid names its real reason and the record's file", () => {
  expect(slow.g.refuse).toBeDefined();
  expect(slow.g.refuse).toContain(`pid ${slow.a}`);
  expect(slow.g.refuse).toContain("ps did not answer within 3 s");
  expect(slow.g.refuse).toContain(slow.file);
});

test("N5: Fleet runs in the server with the seat; a second live server in the record gets no path and nothing restarts", () => {
  expect(n5.neustart).toBe(0);
  expect(n5.answering).toBe(n5.a);
  expect(n5.sessions).toEqual(["keep"]);
  expect(n5.g).toEqual({ flags: ["-N"], startsServer: false });
  expect(n5.recorded).toBe(n5.a);
  expect(n5.xAlive).toBe(true);
  const all = n5.lines.join("\n");
  expect(all).not.toContain(`pid ${n5.x} (running since`);
  expect(all).not.toMatch(new RegExp(`pid ${n5.x}[^;]*holds every seat`));
  expect(all).toMatch(new RegExp(`Fleet runs in (tmux server )?pid ${n5.a}\\b`));
});

test("W1 stays: Fleet in a foreign server that holds only srv gives the seats' server its path back and restarts", () => {
  expect(w1.neustart).toBe(1);
  expect(w1.answering).toBe(w1.a);
  expect(w1.g).toEqual({ flags: ["-N"], startsServer: false });
});

test("W1 with a tie: Fleet in a younger foreign server never takes the seats' path; once A answers, Fleet restarts beside it", () => {
  expect(tie.g1.refuse).toBeDefined();
  expect(tie.answering).toBe(tie.a);
  expect(tie.recorded).toBe(tie.a);
  expect(tie.g2).toEqual({ flags: ["-N"], startsServer: false });
  expect(tie.neustart).toBe(1);
  expect(tie.lines.join("\n")).not.toMatch(new RegExp(`pid ${tie.b} \\(running since[^;]*holds every seat`));
});
