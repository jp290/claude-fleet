// Owner 22.10.: „[Zitat entfernt]“
//  testinstanz-claude.sh is the `claude` such an instance puts first on every pane's PATH; here it runs
// against a fake real claude that records what it was started with, so no model is ever reached.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { branchTestkit, get, post } from "./branches-testkit";
import { REAL_SEAT_WAIT_MS, liveRealSeats, psLstart, realSeatGateFrom, realSeatRefusal, type RealSeatGate } from "./echte-sitze";

const SCRIPT = join(import.meta.dir, "..", "testinstanz-claude.sh");
const root = mkdtempSync(join(tmpdir(), "ti-echte-sitze-"));
const started: number[] = [];
afterAll(() => {
  for (const pid of started) try { process.kill(pid, "SIGKILL"); } catch { /* already gone */ }
  rmSync(root, { recursive: true, force: true });
});

const AUTO_LINE = ["--session-id", "11111111-2222-3333-4444-555555555555", "--model", "claude-haiku-5-5", "--permission-mode", "auto"];
let n = 0;
interface Rig { dir: string; seats: string; owner: string; log: string; env: Record<string, string> }
function rig(o: { armed?: boolean; standIns?: string[]; cap?: number; expiresIn?: number } = {}): Rig {
  const base = join(root, `r${++n}`), dir = join(base, "inst"), seats = join(base, "seats"), owner = join(base, "owner"), log = join(base, "log");
  for (const d of [join(dir, "bin"), seats, owner, log]) mkdirSync(d, { recursive: true });
  // the fake real claude: writes its HOME and argv, then stays as the same pid (exec) like the real one does
  const fake = join(base, "fake-claude");
  writeFileSync(fake, `#!/bin/sh\n{ echo "HOME=$HOME"; for a in "$@"; do echo "$a"; done; } > '${log}'/$$\nexec /bin/sleep 30\n`, { mode: 0o755 });
  // the idle stand-in the wrapper execs for a fixture seat
  writeFileSync(join(dir, "bin", "claude-agent"), `#!/bin/sh\necho idle > '${log}'/idle-$$\n`, { mode: 0o755 });
  if (o.armed ?? true) writeFileSync(join(dir, "bin", ".real-armed"), "");
  if (o.standIns) writeFileSync(join(dir, "bin", ".stand-ins"), o.standIns.map(sha).join("\n") + "\n");
  return { dir, seats, owner, log, env: { PATH: process.env.PATH ?? "", TI_D: dir, TI_REAL_CLAUDE: fake, TI_OWNER_HOME: owner,
    TI_SEATS: seats, TI_SEAT_CAP: String(o.cap ?? 2), TI_EXPIRES: String(Math.floor(Date.now() / 1000) + (o.expiresIn ?? 600)) } };
}
const sha = (t: string): string => new Bun.CryptoHasher("sha256").update(t).digest("hex");

// a short-lived call (refusal or stand-in): its whole output
function call(r: Rig, args: string[], token: string | null = "tok-new", slot = "13"): { code: number; out: string } {
  const p = Bun.spawnSync(["sh", SCRIPT, ...args], { cwd: r.dir,
    env: { ...r.env, ...(token === null ? {} : { FLEET_SELF_TOKEN: token }), FLEET_SELF_SLOT: slot } });
  return { code: p.exitCode ?? -1, out: p.stdout.toString() + p.stderr.toString() };
}
// a seat that comes up and stays: its pid once the fake real claude has written its log
async function seat(r: Rig, token: string, slot: string): Promise<number> {
  const p = Bun.spawn(["sh", SCRIPT, ...AUTO_LINE], { cwd: r.dir, env: { ...r.env, PWD: r.dir, FLEET_SELF_TOKEN: token, FLEET_SELF_SLOT: slot },
    stdout: "ignore", stderr: "ignore" });
  started.push(p.pid);
  for (let i = 0; i < 100 && !existsSync(join(r.log, String(p.pid))); i++) await Bun.sleep(20);
  return p.pid;
}
const realStarts = (r: Rig): string[] => readdirSync(r.log).filter((f) => /^\d+$/.test(f));
const idleStarts = (r: Rig): string[] => readdirSync(r.log).filter((f) => f.startsWith("idle-"));

describe("a seat opened on an armed instance is a real claude in auto, under the HOME it is logged in at", () => {
  test("the real claude gets the whole line unchanged, the owner's HOME, and the seat is registered by its own pid", async () => {
    const r = rig();
    const pid = await seat(r, "tok-a", "13");
    const log = readFileSync(join(r.log, String(pid)), "utf8").split("\n");
    expect(log[0]).toBe(`HOME=${r.owner}`);
    expect(log.slice(1, 1 + AUTO_LINE.length)).toEqual(AUTO_LINE);
    const reg = readFileSync(join(r.seats, `${pid}.seat`), "utf8");
    expect(reg).toContain(`pid=${pid}\n`);
    expect(reg).toContain(`where=${r.dir} Slot 13\n`);
  });

  test("its transcript is linked into the instance's HOME under the name the board reads", async () => {
    const r = rig();
    await seat(r, "tok-b", "13");
    const slug = r.dir.replace(/[^a-zA-Z0-9]/g, "-");
    const link = join(r.dir, "home", ".claude", "projects", slug, `${AUTO_LINE[1]}.jsonl`);
    expect(readlinkSync(link)).toContain(`${r.owner}/.claude/projects/`);
    expect(readlinkSync(link).endsWith(`/${AUTO_LINE[1]}.jsonl`)).toBe(true);
  });
});

describe("never bypass, never a worker, and only auto", () => {
  for (const [why, args] of [
    ["the bypass flag", [...AUTO_LINE, "--dangerously-skip-permissions"]],
    ["the allow-bypass flag", [...AUTO_LINE, "--allow-dangerously-skip-permissions"]],
    ["bypassPermissions as the mode", ["--session-id", "x", "--permission-mode", "bypassPermissions"]],
    ["the = spelling of the mode", ["--session-id", "x", "--permission-mode=auto"]],
    ["a line without a permission mode", ["--session-id", "x", "--model", "claude-haiku-5-5"]],
    ["a worker call (-p)", ["-p", "hi", "--permission-mode", "dontAsk"]],
    ["a worker call (--print) even in auto", ["--print", ...AUTO_LINE]],
  ] as const) {
    test(`${why} is refused with a sentence and starts nothing`, () => {
      const r = rig();
      const res = call(r, [...args]);
      expect(res.code).toBe(1);
      expect(res.out).toMatch(/^Testinstanz: (abgelehnt|kein Worker-Aufruf)/);
      expect(realStarts(r)).toEqual([]);
      expect(idleStarts(r)).toEqual([]);
    });
  }
});

describe("the demo stays a demo: the fixtures `up` planted never reach a model", () => {
  test("before the instance is armed, every seat is the idle stand-in", () => {
    const r = rig({ armed: false });
    expect(call(r, AUTO_LINE).code).toBe(0);
    expect(idleStarts(r).length).toBe(1);
    expect(realStarts(r)).toEqual([]);
  });

  test("a fixture's seat stays the stand-in after arming (a heal respawns it), a new seat is real", async () => {
    const r = rig({ standIns: ["tok-fixture"] });
    expect(call(r, AUTO_LINE, "tok-fixture").code).toBe(0);
    expect(idleStarts(r).length).toBe(1);
    expect(realStarts(r)).toEqual([]);
    await seat(r, "tok-new-seat", "14");
    expect(realStarts(r).length).toBe(1);
  });

  test("without a self credential nothing is a seat", () => {
    const r = rig();
    const res = call(r, AUTO_LINE, null);
    expect(res.code).toBe(1);
    expect(res.out).toContain("FLEET_SELF_TOKEN");
    expect(realStarts(r)).toEqual([]);
  });
});

describe("at most two real seats on the whole machine", () => {
  test("a third start while two live is refused with the sentence naming the two, and starts nothing", async () => {
    const r = rig();
    await seat(r, "tok-1", "13");
    await seat(r, "tok-2", "14");
    const res = call(r, AUTO_LINE, "tok-3", "15");
    expect(res.code).toBe(1);
    expect(res.out).toContain("schon 2 echte Claude-Sitze, höchstens 2");
    expect(res.out).toContain(`${r.dir} Slot 13`);
    expect(res.out).toContain(`${r.dir} Slot 14`);
    expect(realStarts(r).length).toBe(2);
  });

  test("a seat that ended frees its place: a registry entry whose pid is gone does not count", async () => {
    const r = rig({ cap: 1 });
    const first = await seat(r, "tok-1", "13");
    expect(call(r, AUTO_LINE, "tok-2", "14").code).toBe(1);
    process.kill(first, "SIGKILL");
    for (let i = 0; i < 50; i++) { try { process.kill(first, 0); } catch { break; } await Bun.sleep(20); }
    await seat(r, "tok-2", "14");
    expect(realStarts(r).length).toBe(2);
    expect(existsSync(join(r.seats, `${first}.seat`))).toBe(false);
  });
});

describe("nothing keeps running or billing past the instance's ttl", () => {
  test("an expired instance starts no real seat", () => {
    const r = rig({ expiresIn: -1 });
    const res = call(r, AUTO_LINE);
    expect(res.code).toBe(1);
    expect(res.out).toContain("abgelaufen");
    expect(realStarts(r)).toEqual([]);
  });

  test("a running seat is ended at expiresAt by itself, without a reap tick", async () => {
    const r = rig({ expiresIn: 2 });
    const pid = await seat(r, "tok-ttl", "13");
    let alive = true;
    for (let i = 0; i < 40 && alive; i++) { await Bun.sleep(150); try { process.kill(pid, 0); } catch { alive = false; } }
    expect(alive).toBe(false);
  }, 10_000);
});

describe("the door says it, not only the pane: a lead that opens through a door hears the cap there (server/echte-sitze.ts)", () => {
  const gateRig = (armed = true): { gate: RealSeatGate; reg: string } => {
    const base = join(root, `g${++n}`), reg = join(base, "seats");
    mkdirSync(reg, { recursive: true });
    if (armed) writeFileSync(join(base, ".real-armed"), "");
    return { reg, gate: { registry: reg, cap: 2, armed: join(base, ".real-armed"), waitMs: 600 } };
  };
  const register = (reg: string, pid: number, birth: string, where: string): void =>
    writeFileSync(join(reg, `${pid}.seat`), `pid=${pid}\nbirth=${birth}\ndir=/x\nwhere=${where}\n`);

  test("two live seats → the open is refused with how many, the cap and which slots", async () => {
    const { gate, reg } = gateRig();
    register(reg, process.pid, psLstart(process.pid), "/tmp/a Slot 14");
    register(reg, process.ppid, psLstart(process.ppid), "/tmp/a Slot 1");
    const no = await realSeatRefusal(gate);
    expect(no).toContain("schon 2 echte Claude-Sitze, höchstens 2");
    expect(no).toContain("/tmp/a Slot 1 · /tmp/a Slot 14");
  });

  test("one live seat, or a registered pid whose birth no longer matches (recycled), lets the open go on", async () => {
    const { gate, reg } = gateRig();
    register(reg, process.pid, psLstart(process.pid), "/tmp/a Slot 14");
    register(reg, process.ppid, "Thu Jan  1 00:00:00 1970", "/tmp/a Slot 1");
    expect(await realSeatRefusal(gate)).toBeNull();
  });

  test("before `up` armed the instance nothing is refused — the fixtures are stand-ins", async () => {
    const { gate, reg } = gateRig(false);
    register(reg, process.pid, psLstart(process.pid), "/tmp/a Slot 14");
    register(reg, process.ppid, psLstart(process.ppid), "/tmp/a Slot 1");
    expect(await realSeatRefusal(gate)).toBeNull();
  });

  test("no registry on the machine yet = no seat; the gate exists only with all three settings", async () => {
    expect(await liveRealSeats(join(root, "nowhere"))).toEqual([]);
    expect(realSeatGateFrom({})).toBeNull();
    expect(realSeatGateFrom({ FLEET_REAL_SEAT_REGISTRY: "/r", FLEET_REAL_SEAT_CAP: "0", FLEET_REAL_SEAT_ARMED: "/a" })).toBeNull();
    expect(realSeatGateFrom({ FLEET_REAL_SEAT_REGISTRY: "/r", FLEET_REAL_SEAT_CAP: "2", FLEET_REAL_SEAT_ARMED: "/a" }))
      .toEqual({ registry: "/r", cap: 2, armed: "/a", waitMs: REAL_SEAT_WAIT_MS });
  });
});

describe("without --real-seats nothing changes: no seat ever reaches a model (testinstanz-agent.sh, as ti_serve runs it)", () => {
  const AGENT = join(import.meta.dir, "..", "testinstanz-agent.sh");
  // the instance's agent setup and FLEET_CMD, then one pane start the way the server types it — in the worst case:
  // armed, with a self credential. The only `claude` the caller has is the fake, which writes a log when it runs.
  function paneStart(realSeats: boolean): { cmd: string; standIn: boolean; modelCalls: number } {
    const base = join(root, `a${++n}`), dir = join(base, "inst"), fakeBin = join(base, "fakebin"), log = join(base, "log"), home = join(base, "home");
    for (const d of [dir, fakeBin, log, home]) mkdirSync(d, { recursive: true });
    writeFileSync(join(fakeBin, "claude"), `#!/bin/sh\necho "$@" > '${log}'/$$\n`, { mode: 0o755 });
    const state = join(dir, "testinstanz.state");
    writeFileSync(state, `expiresAt=${Math.floor(Date.now() / 1000) + 600}\nmode=mixed\n${realSeats ? "realSeats=1\n" : ""}`);
    const PATH = `${fakeBin}:${process.env.PATH ?? ""}`;
    const env = { PATH, HOME: home, DIR: dir, STATE: state, SRC: join(import.meta.dir, ".."), TI_KIND: "mixed",
      FLEET_TI_SEAT_REGISTRY: join(base, "seats") };
    const setup = Bun.spawnSync(["sh", "-c", `. '${AGENT}'; ti_agent_setup; ti_agent_cmd`], { env });
    expect(setup.exitCode).toBe(0);
    const cmd = setup.stdout.toString().trim();
    writeFileSync(join(dir, "bin", ".real-armed"), "");
    Bun.spawnSync(["sh", "-c", `${cmd} ${AUTO_LINE.join(" ")}`], { cwd: dir,
      env: { PATH: `${dir}/bin:${PATH}`, HOME: home, FLEET_SELF_TOKEN: "tok-after-up", FLEET_SELF_SLOT: "14" } });
    return { cmd, standIn: existsSync(join(dir, "bin", "claude")), modelCalls: readdirSync(log).length };
  }

  test("no switch: the pane runs `true`, the instance has no claude of its own, and nothing calls claude", () => {
    expect(paneStart(false)).toEqual({ cmd: "true", standIn: false, modelCalls: 0 });
  });

  test("the switch: the same pane start reaches claude once — the control that keeps the test above honest", () => {
    expect(paneStart(true)).toEqual({ cmd: "claude", standIn: true, modelCalls: 1 });
  });
});

describe("MUSS 1 — one registry for the machine, whatever FLEET_TI_ROOT an instance lives under", () => {
  test("two roots name the same registry, and with real seats the server counts that one", () => {
    const AGENT = join(import.meta.dir, "..", "testinstanz-agent.sh");
    const ask = (rootDir: string): string[] => Bun.spawnSync(["sh", "-c", `. '${AGENT}'; TI_REAL=1; ti_real_env`],
      { env: { PATH: process.env.PATH ?? "", TI_ROOT: rootDir, FLEET_TI_ROOT: rootDir, DIR: `${rootDir}/fleet-testinstanz-1` } })
      .stdout.toString().trim().split("\n");
    const a = ask("/tmp/root-a"), b = ask("/var/root-b");
    const registry = (env: string[]): string | undefined => env.find((l) => l.startsWith("FLEET_REAL_SEAT_REGISTRY="));
    expect(registry(a)).toBe("FLEET_REAL_SEAT_REGISTRY=/tmp/fleet-echte-sitze");
    expect(registry(b)).toBe(registry(a));
  });
});

describe("what the instance server gets with real seats (testinstanz-agent.sh#ti_real_env, ti_serve passes it)", () => {
  const AGENT = join(import.meta.dir, "..", "testinstanz-agent.sh");
  const env = (real: boolean): string => Bun.spawnSync(["sh", "-c", `. '${AGENT}'; TI_REAL=${real ? 1 : 0}; ti_real_env`],
    { env: { PATH: process.env.PATH ?? "", DIR: "/tmp/fleet-testinstanz-x", FLEET_TI_SEAT_REGISTRY: "/r" } }).stdout.toString();
  test("no role in bypass, a cheap default model, and the registry, cap and armed file of the door", () => {
    expect(env(true).trim().split("\n")).toEqual(["FLEET_NO_BYPASS=1", "FLEET_MODEL=claude-sonnet-5-5",
      "FLEET_REAL_SEAT_REGISTRY=/r", "FLEET_REAL_SEAT_CAP=2", "FLEET_REAL_SEAT_ARMED=/tmp/fleet-testinstanz-x/bin/.real-armed"]);
  });
  test("without the switch the server gets none of it", () => {
    expect(env(false)).toBe("");
  });
});

describe("MUSS 2 — a succession at the cap does not lose its seat: the door waits for the predecessor to end", () => {
  test("the predecessor's claude is still dying when the successor opens → the open goes on once it is gone", async () => {
    const base = join(root, `s${++n}`), reg = join(base, "seats");
    mkdirSync(reg, { recursive: true });
    writeFileSync(join(base, ".real-armed"), "");
    const other = Bun.spawn(["sleep", "30"]), dying = Bun.spawn(["sleep", "1"]);
    started.push(other.pid);
    for (const [p, w] of [[other.pid, "Slot 15"], [dying.pid, "Slot 14 (Vorgänger)"]] as const)
      writeFileSync(join(reg, `${p}.seat`), `pid=${p}\nbirth=${psLstart(p)}\ndir=/x\nwhere=${w}\n`);
    const t0 = Date.now();
    expect(await realSeatRefusal({ registry: reg, cap: 2, armed: join(base, ".real-armed"), waitMs: 8000 })).toBeNull();
    expect(Date.now() - t0).toBeLessThan(5000);
  }, 15_000);
});

describe("SOLLTE 3 — the registry lock is never taken from a live holder", () => {
  test("a live holder keeps it past the old 5 s theft; a dead holder's lock is taken over at once", async () => {
    const r = rig();
    mkdirSync(join(r.seats, ".lock"));
    writeFileSync(join(r.seats, ".lock", "pid"), String(process.pid));
    const p = Bun.spawn(["sh", SCRIPT, ...AUTO_LINE], { cwd: r.dir, env: { ...r.env, PWD: r.dir, FLEET_SELF_TOKEN: "tok-l", FLEET_SELF_SLOT: "13" },
      stdout: "ignore", stderr: "ignore" });
    started.push(p.pid);
    await Bun.sleep(6500);
    expect(realStarts(r)).toEqual([]);
    const dead = Bun.spawn(["true"]);
    await dead.exited;
    writeFileSync(join(r.seats, ".lock", "pid"), String(dead.pid));
    for (let i = 0; i < 50 && realStarts(r).length === 0; i++) await Bun.sleep(50);
    expect(realStarts(r).length).toBe(1);
  }, 15_000);
});

describe("down ends every real seat of its instance, and what the seat started (testinstanz.sh down)", () => {
  test("a registered seat and its child are gone after down; the instance directory too", async () => {
    const base = mkdtempSync(join(tmpdir(), "ti-down-")), dir = join(base, "fleet-testinstanz-t"), reg = join(base, "seats");
    mkdirSync(dir); mkdirSync(reg);
    const SRC = Bun.spawnSync(["pwd", "-P"], { cwd: join(import.meta.dir, "..") }).stdout.toString().trim();
    const probe = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
    const port = probe.port; probe.stop(true);
    writeFileSync(join(dir, "testinstanz.state"), `src=${SRC}\nport=${port}\nsock=fleettidown${process.pid}\ndir=${dir}\nrealSeats=1\n`);
    const seatProc = Bun.spawn(["sh", "-c", "sleep 60 & wait"]);
    started.push(seatProc.pid);
    await Bun.sleep(200);
    const child = Number(Bun.spawnSync(["pgrep", "-P", String(seatProc.pid)]).stdout.toString().trim());
    writeFileSync(join(reg, `${seatProc.pid}.seat`), `pid=${seatProc.pid}\nbirth=${psLstart(seatProc.pid)}\ndir=${dir}\nwhere=${dir} Slot 14\n`);
    const down = Bun.spawnSync([join(SRC, "testinstanz.sh"), "down"], { cwd: SRC, env: { ...process.env,
      FLEET_TI_ROOT: base, FLEET_TI_DIR: dir, FLEET_TI_SOCK: `fleettidown${process.pid}`, FLEET_TI_SEAT_REGISTRY: reg } });
    const alive = (pid: number): boolean => { try { process.kill(pid, 0); return true; } catch { return false; } };
    expect({ code: down.exitCode, ended: down.stdout.toString().includes("real seats ended:") }).toEqual({ code: 0, ended: true });
    expect(child).toBeGreaterThan(1);
    for (let i = 0; i < 20 && (alive(seatProc.pid) || alive(child)); i++) await Bun.sleep(100);
    expect([alive(seatProc.pid), alive(child), existsSync(dir)]).toEqual([false, false, false]);
    rmSync(base, { recursive: true, force: true });
  }, 20_000);
});

describe("SOLLTE 5 — a real seat's line forbids another claude, and every role is auto (server.ts#agentCmd)", () => {
  test("with FLEET_NO_BYPASS the --settings deny claude by name and path beside the seat's own rights; the Orchestratorin starts in auto", async () => {
    const dir = mkdtempSync(join(tmpdir(), "echte-sitze-line-")), out = join(dir, "out.json");
    const script = `
      const S = await import(${JSON.stringify(join(import.meta.dir, "..", "server.ts"))});
      const R = await import(${JSON.stringify(join(import.meta.dir, "rechte.ts"))});
      const rechte = { stufe: "standard", an: ["lesen", "bearbeiten"], aus: ["loeschen"] };
      const id = "11111111-2222-4333-8444-555555555555";
      await Bun.write(process.env.LINE_OUT, JSON.stringify({ own: R.rechteSettings(rechte).permissions,
        generic: S.slotCmd(id, false, "claude-haiku-5-5", "low", true, null, [], "generic", false, null, rechte, null, null),
        orchestrator: S.slotCmd(id, false, "claude-haiku-5-5", "low", true, true, [], "orchestrator", false, null, null, null, null) }));
    `;
    const proc = Bun.spawn([process.execPath, "--no-env-file", "-e", script], { cwd: join(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe",
      env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: join(dir, "home"), SHELL: "/bin/sh", FLEET_HOST: "127.0.0.1", FLEET_PORT: "8790",
        FLEET_SOCK: "fleetfixture", FLEET_STATE_DIR: join(dir, "state"), FLEET_CMD: "claude", FLEET_NO_BYPASS: "1", LINE_OUT: out } });
    const code = await Promise.race([proc.exited, Bun.sleep(60_000).then(() => { proc.kill("SIGKILL"); return -1; })]);
    try {
      expect({ code, err: code === 0 ? "" : (await new Response(proc.stderr).text()).slice(-800) }).toEqual({ code: 0, err: "" });
      const { own, ...lines } = JSON.parse(readFileSync(out, "utf8")) as Record<string, string> & { own: { allow: string[]; deny: string[] } };
      const settings = (line: string): { permissions?: { allow: string[]; deny: string[] } } => {
        const m = /--settings '((?:[^']|'\\'')*)'/.exec(line);
        return JSON.parse((m?.[1] ?? "{}").replaceAll("'\\''", "'"));
      };
      // the seat's own rights stay whole, the three rules come beside them
      expect(own.deny.length).toBeGreaterThan(0);
      expect(settings(lines.generic ?? "").permissions).toEqual({ allow: own.allow,
        deny: [...own.deny, "Bash(claude:*)", "Bash(*/claude *)", "Bash(*/claude)"] });
      expect(lines.orchestrator).toContain("--permission-mode 'auto'");
      expect(settings(lines.orchestrator ?? "").permissions?.deny).toEqual(["Bash(claude:*)", "Bash(*/claude *)", "Bash(*/claude)"]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 75_000);
});

describe("the open door of a real-seat instance refuses at the cap (route POST /api/slots/:id/open, openSlot)", () => {
  const kit = branchTestkit();
  afterAll(() => kit.cleanup());
  const gateEnv = (): Record<string, string> => {
    const base = join(kit.TMP, `gate${++n}`), reg = join(base, "seats");
    mkdirSync(reg, { recursive: true });
    writeFileSync(join(base, ".real-armed"), "");
    for (const p of [process.pid, process.ppid])
      writeFileSync(join(reg, `${p}.seat`), `pid=${p}\nbirth=${psLstart(p)}\ndir=/x\nwhere=/x Slot ${p === process.pid ? 14 : 15}\n`);
    return { FLEET_REAL_SEAT_REGISTRY: reg, FLEET_REAL_SEAT_CAP: "2", FLEET_REAL_SEAT_ARMED: join(base, ".real-armed"), FLEET_REAL_SEAT_WAIT_MS: "300" };
  };
  test("two live seats → 400 with the sentence, the slot stays empty", async () => {
    const f = kit.fixture();
    const [opened, sessions] = await kit.life(f, [post("/api/slots/3/open", { cwd: f.repo }), get("/api/sessions")], gateEnv());
    expect(opened?.status).toBe(400);
    expect(String(opened?.body.error)).toContain("schon 2 echte Claude-Sitze, höchstens 2");
    const slot3 = (sessions?.body as { slots: { id: number; cwd?: string | null }[] }).slots.find((s) => s.id === 3);
    expect(slot3?.cwd ?? null).toBeNull();
  }, 40_000);
  test("the same open on a server without the gate goes through — the control", async () => {
    const f = kit.fixture();
    const [opened] = await kit.life(f, [post("/api/slots/3/open", { cwd: f.repo })]);
    expect(opened?.status).toBe(200);
  }, 40_000);
});
