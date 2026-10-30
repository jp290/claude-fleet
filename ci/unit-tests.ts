// DIE UNIT-TESTS DES MERGE-CHECKS SIND DIE VON `package.json` „test“. Der Check zählte seine Verzeichnisse selbst (ci, server)
// und ließ ./src und ./session-blocks.test.ts weg: ein Rot in src/*.test.ts landete ungesehen. Jetzt liest er die Pfade aus
// dem Skript des Kandidaten und fährt davon die, die der Baum hat — ein Pfad ohne Tests im Baum ist „nicht anwendbar“, nie
// ein grün geprüfter Teil. Keine Imports außer node: — `ci/merge-check-run.sh` lädt diese Datei im Baum des Kandidaten.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_PATHS = ["./ci", "./server"];

const hasTests = (path: string): boolean => {
  const st = statSync(path, { throwIfNoEntry: false });
  if (!st) return false;
  if (st.isFile()) return /\.test\.[cm]?[jt]sx?$/.test(path);
  return readdirSync(path, { withFileTypes: true }).some((e) =>
    e.name !== "node_modules" && hasTests(join(path, e.name)));
};

export function unitTestPaths(tree: string): string[] {
  let script = "";
  try { script = String(JSON.parse(readFileSync(join(tree, "package.json"), "utf8")).scripts?.test ?? ""); } catch { /* none */ }
  const m = /^bun test((?:\s+\.\/\S+)+)\s*$/.exec(script.trim());
  return m ? m[1]!.trim().split(/\s+/) : DEFAULT_PATHS;
}

export function unitTestCommand(tree: string): { cmd: string; na: string | null } {
  const paths = unitTestPaths(tree).filter((p) => hasTests(join(tree, p)));
  return paths.length
    ? { cmd: `bun test ${paths.join(" ")}`, na: null }
    : { cmd: "true", na: "der Kandidat hat keine Tests in den Pfaden von package.json „test“" };
}
