// DIE BASIS-FIXTURE EINES GEFILTERTEN LAUFS: der cwd von Slot 1 (fleet-e2e.ts).
//
// Ein Lauf, der slots.ts nicht fährt, pflanzt die zwei Slots, die die übrigen Module offen antreffen
// (fleet-e2e.ts): Slot 1 in einem Git-Repository, Slot 2 in einem einfachen Ordner. Slot 1 war
// `~/claude-fleet` — der Haupt-Checkout des Owners, auf dem Host ein Repository, das der Server
// öffnen kann. Hinter Fleets Zaun ist HOME das Temp-Home des Sitzes, und darunter gibt es kein
// `claude-fleet`: der Server antwortete 400, der Runner warf an seiner Basis-Fixture, und jeder
// gefilterte Lauf (eine Lane-Vorschau, ein Audit-Shard, der Merge-Check) war Sekunden nach dem Start
// rot — an der Umgebung, vor der ersten Prüfung. Ein Bauer las daran „grün“ ab, während der echte
// Lauf nie etwas gemessen hatte.
//
// Die Fixture nennt darum keinen Namen aus HOME und nimmt auch nicht den Baum des Laufs: der trägt
// die Game-Maker-Fixture (e2e/programs.ts legt `gamerepo/` und seine Worktrees UNTER den Baum), und
// ein Slot darauf ließ jede Game-Maker-Gründung mit „game-maker tree is already open in slot 1“
// scheitern (gemessen im Merge-Check-Shard a3). Was die Fixture braucht, ist genau das, was slots.ts
// für seinen Slot 1 selbst tut: ein Wegwerf-Repository, das der Lauf anlegt und wieder entfernt.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const made: string[] = [];
let armed = false;
// the runner's own exit, not a signal handler: every wrapper ends the process normally (a filtered
// run is seconds to minutes), and a killed run's scratch is reaped with the rest of TMPDIR
function armCleanup(): void {
  if (armed) return;
  armed = true;
  process.once("exit", () => { for (const d of made) { try { rmSync(d, { recursive: true, force: true }); } catch { /* already gone */ } } });
}

export function baseFixtureRepo(scratch = tmpdir()): string {
  const dir = mkdtempSync(join(scratch, "fleet-e2e-base-repo-"));
  writeFileSync(join(dir, "README.md"), "base fixture\n");
  const git = (...args: string[]): number => Bun.spawnSync(["git", ...args], { cwd: dir, stderr: "ignore" }).exitCode;
  const ready = git("init", "-q", "-b", "main") === 0 && git("add", "-A") === 0
    && git("-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false", "commit", "-qm", "base fixture seed") === 0;
  if (!ready) throw new Error(`base fixture: could not make a git repository in ${dir}`);
  made.push(dir);
  armCleanup();
  return dir;
}
