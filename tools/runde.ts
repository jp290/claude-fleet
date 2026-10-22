// Eine Testinstanz für die Branches einer Runde (server/runde.ts) — von Hand aufstellen, ansehen, beenden.
//
//   bun tools/runde.ts up <name> <branch> [<branch> …] [--snapshot]   aufstellen, oder die Branches neu setzen
//   bun tools/runde.ts status                                          jede Runde: drin, draußen, Port, Instanz
//   bun tools/runde.ts tick                                            ein Takt von Hand (der Server takt jede Minute)
//   bun tools/runde.ts down <name> [--force]                           Instanz, Worktree und Runde weg
//
// Läuft in jedem Checkout des Repos; die Runde liegt neben dem Haupt-Checkout (`<repo>.worktrees/runde-<name>`).
// Gedruckt wird nie ein Token: den Link mit Token baut, wer mit dem Owner spricht (docs/testinstanz.md, „[Zitat entfernt]“
// ); danach führt ihn der Instanz-Chip des Boards als runde-<name>. Was gelandet oder beiseitegelegt
// ist und ob eine Session im Runden-Worktree sitzt, weiß nur der Server: `tick` von Hand baut neu, beendet aber nichts. `down` beendet von Hand, nicht bei Änderungen im Worktree und
// nicht innerhalb der Schonfrist nach dem letzten Blick (server/instanz-blick.ts); `--force` übergeht nur den Blick.
import { dirname } from "node:path";
import type { GitResult } from "../server/branch-land";
import { instanceDirOf, lastLook, lookHolds } from "../server/instanz-blick";
import { endRound, listRounds, readRound, roundPath, tickRounds, upRound, validRound, type Round, type RoundDeps } from "../server/runde";

async function git(dir: string, ...args: string[]): Promise<GitResult> {
  const p = Bun.spawn(["git", "-C", dir, ...args], { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  return { out: out.trim(), err: err.trim(), code };
}
// dieselbe schmale Umgebung wie server.ts#testinstanzCommand: kein Self-Token, kein FLEET_* des Aufrufers
function env(): Record<string, string> {
  const e: Record<string, string> = { FLEET_TI_TARGET: "main" };
  for (const key of ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "LC_CTYPE", "USER", "LOGNAME", "SHELL", "FLEET_TI_ROOT"]) {
    const v = process.env[key];
    if (v) e[key] = v;
  }
  return e;
}
async function spawn(cmd: string[], cwd: string): Promise<{ code: number; out: string }> {
  const p = Bun.spawn(cmd, { cwd, env: env(), stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  // die Ausgabe von up trägt den Link mit Token: nur Zeilen ohne ihn
  if (code !== 0) process.stderr.write((out + err).split("\n").filter((l) => !l.includes("token=")).slice(-15).join("\n") + "\n");
  return { code, out };
}
const deps: RoundDeps = {
  git,
  ti: (wt, args) => spawn([`${wt}/testinstanz.sh`, ...args], wt),
  stop: async (wt) => {
    const dir = instanceDirOf(process.env.FLEET_TI_ROOT || "/tmp", wt);
    const held = dir ? lookHolds(lastLook(dir), Date.now()) : null;
    if (held) return held;
    const down = await spawn([`${wt}/testinstanz.sh`, "down"], wt);
    return down.code === 0 ? null : down.code === 3 ? "jemand schaut in die Testinstanz (offene Verbindung)" : `testinstanz.sh down exit ${down.code}`;
  },
  install: (wt) => spawn(["bun", "install", "--frozen-lockfile"], wt),
  landed: () => null, parked: async () => null, held: () => null,
  scaffold: ["node_modules/"],
  now: () => Date.now(),
};

async function repoOf(): Promise<string> {
  const common = await git(process.cwd(), "rev-parse", "--path-format=absolute", "--git-common-dir");
  if (common.code !== 0) throw new Error("kein git-Repo");
  return dirname(common.out);
}
// die Zeile aus `testinstanz.sh list`, ohne Token: Port, Restzeit, Link
async function listed(r: Round): Promise<string> {
  const l = await spawn([`${r.path}/testinstanz.sh`, "list"], r.path);
  return l.out.split("\n").find((x) => x.includes(` ${r.path} `)) ?? "keine Instanz";
}
function describe(r: Round): string[] {
  const b = r.built;
  if (!b) return ["  noch nicht gebaut"];
  return [`  main ${b.main.slice(0, 8)} · Stand ${b.commit.slice(0, 8)}`,
    ...b.in.map((i) => `  drin     ${i.branch} ${i.head.slice(0, 8)}`),
    ...b.out.map((o) => `  draußen  ${o.branch}: ${o.why}`),
    ...(r.failed ? [`  rot      ${r.failed.why}`] : [])];
}

const [cmd, ...rest] = process.argv.slice(2);
const repo = await repoOf();
if (cmd === "up") {
  const flags = rest.filter((a) => a.startsWith("--")), [name, ...branches] = rest.filter((a) => !a.startsWith("--"));
  if (!name || flags.some((f) => f !== "--snapshot")) { console.error("usage: bun tools/runde.ts up <name> <branch> [<branch> …] [--snapshot]"); process.exit(2); }
  const r = await upRound(deps, { repo, name, branches, mode: flags.includes("--snapshot") ? "snapshot" : "mixed" });
  if ("error" in r) { console.error(`runde: ${r.error}`); process.exit(2); }
  console.log(`runde ${r.round.name}: ${r.did}`);
  for (const line of describe(r.round)) console.log(line);
  console.log(`  ${await listed(r.round)}`);
  process.exit(r.did.startsWith("gebaut") ? 0 : 1);
} else if (cmd === "status") {
  const { rounds, skipped } = await listRounds(git, repo);
  for (const line of skipped) console.log(line);
  if (!rounds.length) console.log("keine Runde");
  for (const r of rounds) {
    console.log(`runde ${r.name}  ${r.path}  [${r.branches.join(" ")}]`);
    for (const line of describe(r)) console.log(line);
    console.log(`  ${await listed(r)}`);
  }
} else if (cmd === "tick") {
  for (const line of await tickRounds(deps, repo)) console.log(line);
} else if (cmd === "down") {
  const name = rest.find((a) => !a.startsWith("--"));
  const r = name ? readRound(roundPath(repo, name)) : null;
  if (!r) { console.error(`runde: keine Runde ${name ?? ""}`); process.exit(2); }
  const bad = await validRound(git, repo, roundPath(repo, r.name), r);
  if (bad) { console.error(`runde ${r.name}: ${bad}`); process.exit(2); }
  const kept = await endRound(deps, r, { manual: true, force: rest.includes("--force") });
  console.log(kept ? `runde ${r.name} bleibt: ${kept}` : `runde ${r.name}: Instanz, Worktree und Runde weg`);
  process.exit(kept ? 3 : 0);
} else {
  console.error("usage: bun tools/runde.ts up <name> <branch>… [--snapshot] | status | tick | down <name> [--force]");
  process.exit(2);
}
