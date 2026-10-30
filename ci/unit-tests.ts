// DIE UNIT-TESTS DES MERGE-CHECKS: ein fester Mindestsatz (./ci, ./server) UND die Pfade von `package.json` „test“. Der Check zählte
// früher nur ci und server und ließ ./src und ./session-blocks.test.ts weg: ein Rot in src/*.test.ts landete ungesehen. Das
// Skript gehört dem Kandidaten, also darf es den Check erweitern, nie verengen: ein Skript, das nur './server' nennt, fährt
// trotzdem ./ci. Ein Skript, das diese Datei nicht sicher liest (kein `bun test ./pfad …`: Flag, Glob, Pfad ohne ./, Kette),
// ist ROT mit Grund — nie still der Standard, nie „na“. Ein genannter Pfad ohne Tests im Baum fällt weg (ein Kandidat darf
// Tests löschen); „na“ gibt es nur, wenn auch ci und server keine haben. Keine Imports außer node: — `ci/merge-check-run.sh`
// lädt diese Datei im Baum des Kandidaten.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FIXED_PATHS = ["./ci", "./server"];

const hasTests = (path: string): boolean => {
  const st = statSync(path, { throwIfNoEntry: false });
  if (!st) return false;
  if (st.isFile()) return /\.test\.[cm]?[jt]sx?$/.test(path);
  return readdirSync(path, { withFileTypes: true }).some((e) =>
    e.name !== "node_modules" && hasTests(join(path, e.name)));
};

// die Pfade des Skripts, oder der Grund, warum es nicht zu lesen ist
export function scriptPaths(tree: string): { paths: string[] } | { error: string } {
  let script: unknown;
  try { script = JSON.parse(readFileSync(join(tree, "package.json"), "utf8")).scripts?.test; } catch (e) {
    return { error: `package.json ist nicht lesbar (${e instanceof Error ? e.message : String(e)})` };
  }
  if (typeof script !== "string" || script.trim() === "") return { error: "package.json hat kein Skript „test“" };
  const m = /^bun test((?:\s+\.\/[A-Za-z0-9._\/-]+)+)\s*$/.exec(script.trim());
  if (!m) return { error: `das Skript „test“ (${script.trim().slice(0, 120)}) ist nicht von der Form \`bun test ./pfad …\` ohne Flag, Glob oder Kette` };
  const paths = m[1]!.trim().split(/\s+/);
  const escaping = paths.find((p) => p.split("/").includes(".."));
  return escaping ? { error: `das Skript „test“ nennt einen Pfad mit „..“ (${escaping})` } : { paths };
}

export function unitTestCommand(tree: string): { cmd: string; na: string | null; error: string | null } {
  const read = scriptPaths(tree);
  if ("error" in read) return { cmd: "", na: null, error: read.error };
  const paths = [...new Set([...FIXED_PATHS, ...read.paths])].filter((p) => hasTests(join(tree, p)));
  return paths.length
    ? { cmd: `bun test ${paths.join(" ")}`, na: null, error: null }
    : { cmd: "true", na: "der Kandidat hat keine Tests in ci, server und den Pfaden von package.json „test“", error: null };
}
