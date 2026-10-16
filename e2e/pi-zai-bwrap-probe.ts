// The Linux fence MEASURED, not read: a shell is started behind the argument list that
// server/pi-zai-fence.ts#piZaiBwrapArgs builds for a synthetic fixture, and tries the reads of the
// measured rules T1-T3 (docs/messungen/2026-09-21-pi-zai-lesezaun.md) plus the writes the SBPL profile
// refuses. Every probe has its CONTROL: the same script run without a fence must read what the fenced
// one is refused, otherwise a "denied" proves nothing. Two MUTANTS keep the detector honest: the
// fence taken away, and the allowlist widened by the home — both must show leaks.
//
// `bun e2e/pi-zai-bwrap-probe.ts` prints the table; e2e/pins.ts imports probeBwrapFence() and turns
// the parts into rows. Where bwrap is absent or refused (macOS, a host without unprivileged user
// namespaces, a run already inside a fence) the result says `unavailable` with the reason; the caller
// prints a SKIP under its own name instead of a green.
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { type PiZaiFenceInput, piSessionSlug, piZaiBwrapArgs, piZaiGitOf, piZaiTiocstiClosed, piZaiTmpFor } from "../server/pi-zai-fence";

// what a probe may find: a needle in a file the fixture made. A probe is READ when the needle came back.
const NEEDLE = "PZSECRET-7f3a";

export interface BwrapProbe {
  unavailable?: string;
  args: string[] | null;
  /** probe name -> true when the script reached it */
  fenced: Record<string, boolean>;
  control: Record<string, boolean>;
  noFence: Record<string, boolean>;
  homeOpen: Record<string, boolean>;
  tmuxOpen: Record<string, boolean>;
  /** facts about the argument list and the builder's refusals, each named by what it claims */
  build: Record<string, boolean>;
}

// protected = the fence must refuse it; allowed = the pane's work, the fence must let it through
export const PROTECTED = ["ssh", "key", "fleetjson", "envfile", "zshrc", "otherwt", "denyroot", "foreignsession", "scaffoldenv",
  "foreignenviron", "tmuxlive", "homewrite", "mainref", "hook"] as const;
export const ALLOWED = ["cwdfile", "tool", "cwdwrite", "ownsession", "gitcommit"] as const;

function probeScript(f: Fx): string {
  const r = (name: string, path: string): string => `if grep -aq ${NEEDLE} '${path}' 2>/dev/null; then echo '${name}=1'; else echo '${name}=0'; fi`;
  return [
    r("ssh", `${f.home}/.ssh/id`), r("key", `${f.home}/.config/claude-fleet/secrets/zai.key`),
    r("fleetjson", `${f.fleet}/fleet.json`), r("envfile", `${f.fleet}/.env`), r("zshrc", `${f.home}/.zshrc`),
    r("otherwt", `${f.home}/other/file`), r("denyroot", `${f.deny}/child/canary`),
    r("foreignsession", `${f.agent}/sessions/--foreign--/s.jsonl`), r("scaffoldenv", `${f.cwd}/.env`),
    r("foreignenviron", `/proc/${f.foreignPid}/environ`),
    `if tmux -S '${f.tmuxSock}' list-sessions >/dev/null 2>&1; then echo 'tmuxlive=1'; else echo 'tmuxlive=0'; fi`,
    `if echo x > '${f.home}/pwn' 2>/dev/null; then echo 'homewrite=1'; else echo 'homewrite=0'; fi`,
    `if git -C '${f.cwd}' update-ref refs/heads/main HEAD 2>/dev/null; then echo 'mainref=1'; else echo 'mainref=0'; fi`,
    `if echo x > '${f.main}/.git/hooks/pre-commit' 2>/dev/null; then echo 'hook=1'; else echo 'hook=0'; fi`,
    r("cwdfile", `${f.cwd}/work.txt`), r("tool", `${f.home}/.local/bin/tool`),
    `if echo x > '${f.cwd}/w2' 2>/dev/null; then echo 'cwdwrite=1'; else echo 'cwdwrite=0'; fi`,
    `if echo x > '${f.agent}/sessions/${piSessionSlug(f.cwd)}/own' 2>/dev/null; then echo 'ownsession=1'; else echo 'ownsession=0'; fi`,
    `if git -C '${f.cwd}' -c user.email=a@b -c user.name=n commit -q --allow-empty -m lane 2>/dev/null; then echo 'gitcommit=1'; else echo 'gitcommit=0'; fi`,
  ].join("\n");
}

interface Fx {
  root: string; home: string; fleet: string; deny: string; agent: string; cwd: string; main: string; tmuxSock: string;
  foreignPid: number; own: string; input: PiZaiFenceInput;
}

function parse(out: string): Record<string, boolean> {
  const m: Record<string, boolean> = {};
  for (const line of out.split("\n")) { const x = /^([a-z0-9]+)=([01])$/.exec(line.trim()); if (x) m[x[1]!] = x[2] === "1"; }
  return m;
}

export async function probeBwrapFence(): Promise<BwrapProbe> {
  const none = (unavailable: string): BwrapProbe => ({ unavailable, args: null, fenced: {}, control: {}, noFence: {}, homeOpen: {}, tmuxOpen: {}, build: {} });
  if (process.platform !== "linux") return none("not linux");
  const bwrap = process.env.FLEET_PI_ZAI_BWRAP ?? "/usr/bin/bwrap";
  const smoke = spawnSync(bwrap, ["--ro-bind", "/", "/", "--unshare-pid", "--proc", "/proc", "--dev", "/dev", "/usr/bin/true"], { encoding: "utf8" });
  if (smoke.status !== 0) return none(`bwrap smoke failed: ${(smoke.stderr ?? smoke.error?.message ?? "").trim().slice(0, 120)}`);
  if (spawnSync("git", ["--version"]).status !== 0 || spawnSync("tmux", ["-V"]).status !== 0) return none("git or tmux missing");

  const root = realpathSync(mkdtempSync(`${tmpdir()}/pz-bwrap-`));
  let foreign: ReturnType<typeof spawn> | null = null;
  let ownDir = "";
  const tmuxSock = `${root}/live-tmux/claudefleet`;
  try {
    const home = `${root}/home`, fleet = `${home}/claude-fleet`, deny = `${home}/deny-a`, agent = `${root}/agent`;
    const main = `${root}/repo`, cwd = `${root}/lane`;
    const scaffold = `${cwd}/.env`;
    const put = (p: string, text = NEEDLE): void => { mkdirSync(p.replace(/\/[^/]*$/, ""), { recursive: true }); writeFileSync(p, `${text}\n`); };
    put(`${home}/.ssh/id`); put(`${home}/.config/claude-fleet/secrets/zai.key`); put(`${fleet}/fleet.json`); put(`${fleet}/.env`);
    put(`${home}/.zshrc`); put(`${home}/other/file`); put(`${deny}/child/canary`);
    put(`${home}/.local/bin/tool`, "#!/bin/sh\n" + NEEDLE); chmodSync(`${home}/.local/bin/tool`, 0o755);
    put(`${agent}/auth.json`, "{}"); put(`${agent}/sessions/--foreign--/s.jsonl`);
    mkdirSync(`${root}/live-tmux`, { recursive: true });
    const sh = (cmd: string[], cwdOf = root): void => { const r = spawnSync(cmd[0]!, cmd.slice(1), { cwd: cwdOf, encoding: "utf8" }); if (r.status !== 0) throw new Error(`${cmd.join(" ")}: ${r.stderr}`); };
    sh(["git", "init", "-q", "-b", "main", main]);
    sh(["git", "-c", "user.email=a@b", "-c", "user.name=n", "commit", "-q", "--allow-empty", "-m", "init"], main);
    sh(["git", "worktree", "add", "-q", "-b", "fleet/lane-x", cwd], main);
    put(`${cwd}/work.txt`); sh(["git", "add", "work.txt"], cwd);
    sh(["git", "-c", "user.email=a@b", "-c", "user.name=n", "commit", "-q", "-m", "lane work"], cwd); // HEAD != main
    put(scaffold);
    const g = piZaiGitOf(cwd, "fleet/lane-x");
    const own = piZaiTmpFor(realpathSync(tmpdir()), cwd);
    ownDir = own;
    mkdirSync(`${own}/home`, { recursive: true }); mkdirSync(`${own}/tmp`, { recursive: true });
    mkdirSync(`${agent}/sessions/${piSessionSlug(cwd)}`, { recursive: true });
    // a REAL tmux server on a socket outside every mount stands in for the live fleet's
    sh(["tmux", "-S", tmuxSock, "new-session", "-d", "-s", "pzfx", "sleep 300"]);
    // a FOREIGN process (own session) whose environment carries the needle
    foreign = spawn("/bin/sleep", ["300"], { detached: true, stdio: "ignore", env: { ...process.env, PZ_CANARY: NEEDLE } });
    foreign.unref();
    const input: PiZaiFenceInput = {
      home, fleetDir: fleet, agentDir: agent, keyFile: `${home}/.config/claude-fleet/secrets/zai.key`, cwd,
      tmuxDir: `${root}/live-tmux`, sockets: [], denyRoots: [deny], tmpRoots: [realpathSync(tmpdir())], ownTmp: own,
      suiteLock: `${root}/fleet-e2e.lock`, toolRoots: [`${home}/.local/bin`], git: g,
    };
    const f: Fx = { root, home, fleet, deny, agent, cwd, main, tmuxSock, foreignPid: foreign.pid ?? 0, own, input };
    const script = probeScript(f);
    // the fixture's tool dir carries a real shell script; the system tools come from /usr
    const env = { ...process.env, HOME: `${own}/home`, TMPDIR: `${own}/tmp`, PATH: "/usr/bin:/bin" };
    const run = (args: string[] | null): Record<string, boolean> => {
      const r = args ? spawnSync(bwrap, [...args, "/bin/sh", "-c", script], { encoding: "utf8", env, timeout: 60_000 })
        : spawnSync("/bin/sh", ["-c", script], { encoding: "utf8", env, timeout: 60_000 });
      const m = parse(r.stdout ?? "");
      m.homewrite = existsSync(`${home}/pwn`); // the HOST's answer: a write into the sandbox's own tmpfs reaches nothing
      return m;
    };
    const bw = piZaiBwrapArgs(input, { newSession: true });
    if (bw) for (const d of bw.mkdirs) mkdirSync(d, { recursive: true });
    const args = bw?.args ?? null;
    // Every run that can move something is followed by its restore: main back to its first commit, the
    // two writes removed. CONTROL first - the unfenced script must reach every probe.
    const mainFirst = spawnSync("git", ["-C", main, "rev-parse", "main"], { encoding: "utf8" }).stdout.trim();
    const restore = (): void => {
      sh(["git", "-C", main, "update-ref", "refs/heads/main", mainFirst]);
      rmSync(`${home}/pwn`, { force: true }); rmSync(`${main}/.git/hooks/pre-commit`, { force: true });
    };
    const control = run(null); restore();
    const fenced = args ? run(args) : {}; restore();
    // MUTANT 1: no fence at all (the probe itself must see every leak)
    const noFence = run(null); restore();
    // MUTANT 2: the allowlist widened by the home; MUTANT 3: by the tmux dir
    const homeOpen = args ? run([...args, "--bind", home, home]) : {}; restore();
    const tmuxOpen = args ? run([...args, "--bind", `${root}/live-tmux`, `${root}/live-tmux`]) : {}; restore();
    // the builder's own contract: what it refuses, where the masks sit, which switches it carries
    const at = (re: (x: string, k: number, all: string[]) => boolean): number => (args ?? []).findIndex(re);
    const cwdBind = at((x, k, all) => x === "--bind" && all[k + 1] === cwd);
    const maskAt = at((x, k, all) => x === "--ro-bind" && all[k + 1] === "/dev/null" && all[k + 2] === scaffold);
    const authBackup = readFileSync(`${agent}/auth.json`, "utf8");
    writeFileSync(`${agent}/auth.json`, '{"zai":{"key":"synthetic-login"}}');
    const populated = piZaiBwrapArgs(input);
    writeFileSync(`${agent}/auth.json`, authBackup);
    const topLevel = piZaiBwrapArgs({ ...input, git: g && { ...g, ref: "refs/heads/toplevel" } });
    const withNew = piZaiBwrapArgs(input, { newSession: true })?.args ?? [], without = piZaiBwrapArgs(input, { newSession: false })?.args ?? [];
    const build = {
      refusesNullDenyRoots: piZaiBwrapArgs({ ...input, denyRoots: null }) === null,
      refusesEmptyDenyRoots: piZaiBwrapArgs({ ...input, denyRoots: [] }) === null,
      refusesQuoteInPath: piZaiBwrapArgs({ ...input, cwd: `${cwd}'x` }) === null && piZaiBwrapArgs({ ...input, cwd: `${cwd}"x` }) === null,
      refusesDotDot: piZaiBwrapArgs({ ...input, cwd: `${cwd}/../x` }) === null,
      refusesPopulatedCredentialStore: populated === null,
      refusesToolRootAtHome: piZaiBwrapArgs({ ...input, toolRoots: [home] }) === null && piZaiBwrapArgs({ ...input, toolRoots: ["/"] }) === null,
      refusesBadRef: piZaiBwrapArgs({ ...input, git: g && { ...g, ref: 'refs/heads/a"b' } }) === null,
      maskAfterOpening: cwdBind >= 0 && maskAt > cwdBind,
      rootReadOnlyLast: args?.slice(-2).join(" ") === "--remount-ro /",
      pidNamespaceNetShared: !!args && args.includes("--unshare-all") && args.includes("--share-net") && !args.includes("--share-pid"),
      diesWithParent: !!args && args.includes("--die-with-parent"),
      noWholeHomeNoRootBind: !!args && !args.some((x, k) => (x === home || x === "/") && ["--bind", "--ro-bind"].includes(args[k - 1] ?? "")),
      noMainRefBinding: !!topLevel && !topLevel.args.some((x) => x === `${g?.common}/refs/heads` || x === `${g?.common}/logs/refs/heads`),
      newSessionSwitch: withNew.includes("--new-session") && !without.includes("--new-session"),
      tiocstiRead: piZaiTiocstiClosed(() => "0\n") && !piZaiTiocstiClosed(() => "1\n") && !piZaiTiocstiClosed(() => { throw new Error("absent"); }),
    };
    return { args, fenced, control, noFence, homeOpen, tmuxOpen, build };
  } finally {
    foreign?.kill();
    spawnSync("tmux", ["-S", tmuxSock, "kill-server"]);
    rmSync(root, { recursive: true, force: true });
    if (ownDir) rmSync(ownDir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const p = await probeBwrapFence();
  if (p.unavailable) { console.log(`unavailable: ${p.unavailable}`); process.exit(0); }
  const col = (m: Record<string, boolean>, k: string): string => (m[k] === undefined ? "?" : m[k] ? "1" : "0");
  console.log(`build: ${JSON.stringify(p.build)}`);
  console.log(`${"probe".padEnd(16)} control fenced noFence homeOpen tmuxOpen`);
  for (const k of [...PROTECTED, ...ALLOWED]) console.log(`${k.padEnd(16)} ${col(p.control, k).padEnd(7)} ${col(p.fenced, k).padEnd(6)} ${col(p.noFence, k).padEnd(7)} ${col(p.homeOpen, k).padEnd(8)} ${col(p.tmuxOpen, k)}`);
}
