// Welche großen Units (ci/merge-check-run.sh#BIG_UNITS) ein Kandidat dem Merge-Check schuldet.
// Owner 22.10.: zwei Lands bestanden ihren Merge-Check und machten main erst im Audit rot (993b4e90
// in e2e/programs.ts, 437e457b in e2e/security.ts und e2e/watch.ts), weil der Merge-Check die großen
// Units nie fuhr. Jetzt fährt er die, deren Fußabdruck ein geänderter Pfad trifft, und bleibt schnell,
// wo keiner trifft.
//
// Der Fußabdruck einer Unit ist, was ./e2e-isolated.sh für einen Lauf von ihr in die Instanz legt
// oder liest, abgeleitet aus dem Kandidaten-Baum selbst:
//   · der Import-Abschluss von server.ts und fleet-e2e.ts, von fleet-e2e.ts aus aber nur die
//     Moduldateien dieser Unit (e2e/<modul>.ts, e2e/ctx.ts#SHARD_UNITS);
//   · STAGE_EXTRA und jedes $SRC/<pfad>, das e2e-isolated.sh selbst kopiert (AGENTS.md, .fleet/…);
//   · was e2e-stage.sh#stage_instance ganz kopiert (STAGE_WHOLE) und der Wrapper selbst;
//   · was diese Dateien durch den node_modules-Link aus src/ und public/ lesen
//     (suite-modules.ts#symlinkReads).
// Lässt sich das nicht ableiten, ist jede Unit geschuldet, nie keine. Grenze wie bei
// suite-modules.ts#gateSuitesForPaths: abgeleitet, nicht gemessen; ein dritter Weg in den
// Quellbaum bleibt unsichtbar, und den fängt weiter das Audit.
// dom nie: das Audit nach einem Land und vor dem Deploy lässt sie aus, sie läuft nachts
// (e2e/ctx.ts#selectSkipUnits).
import { SHARD_UNITS } from "../e2e/ctx";
import { stageClosure, symlinkReads, wrapperStage, type TreeReader } from "../suite-modules";

export const BIG_UNITS = ["core", "core-tasks", "programs", "lanes", "watch", "dom"] as const;
export const NIGHT_ONLY = "dom";
const WRAPPER = "e2e-isolated.sh";
const STAGE_WHOLE = ["e2e-stage.sh", "package.json", "bun.lock", "fleet-sync.sh"];
const STAGE_WHOLE_DIRS = ["public/", "docs/start/", "docs/packs/"];

const IMPORT_LINE = /(?:from|import)[ \t]*\(?[ \t]*"\./;
interface FileReads { files: Set<string>; dirs: Set<string> }
// über Aufrufe hinweg, nach Pfad und Inhalt: das Übersetzen (server.ts allein ~0,5 s) ist der teure Teil
const readsMemo = new Map<string, FileReads | null>();

export interface BigUnitSelection {
  /** die Units, die laufen, in der Reihenfolge von BIG_UNITS */
  run: string[];
  /** je Unit: die geänderten Pfade, die sie schuldig machen, oder der Grund, warum sie ausbleibt */
  why: Record<string, string>;
}

const all = (why: string): BigUnitSelection => {
  const run = BIG_UNITS.filter((u) => u !== NIGHT_ONLY);
  return { run, why: { ...Object.fromEntries(run.map((u) => [u, why])), [NIGHT_ONLY]: nightWhy } };
};
const nightWhy = "läuft nachts, wie im Audit nach dem Land";

export function bigUnitsFor(paths: readonly string[], readTree: TreeReader): BigUnitSelection {
  const cache = new Map<string, string | null>();
  const read: TreeReader = (p) => {
    if (!cache.has(p)) cache.set(p, readTree(p));
    return cache.get(p)!;
  };
  // je Datei einmal, nicht je Unit: die Units teilen den größten Teil ihres Abschlusses. Für den
  // Abschluss genügen die Importzeilen (suite-modules.ts#stageClosure liest nur sie, Zeile für Zeile)
  const importsOnly = new Map<string, string | null>();
  const importRead: TreeReader = (p) => {
    if (!importsOnly.has(p)) importsOnly.set(p, read(p)?.split("\n").filter((l) => IMPORT_LINE.test(l)).join("\n") ?? null);
    return importsOnly.get(p)!;
  };
  const reads = (f: string): FileReads | null => {
    const text = read(f) ?? "";
    const key = `${f}\0${Bun.hash(text)}`;
    if (!readsMemo.has(key)) {
      const files = new Set<string>(), dirs = new Set<string>();
      readsMemo.set(key, symlinkReads(() => text, [f], files, dirs) ? { files, dirs } : null);
    }
    return readsMemo.get(key)!;
  };
  const stage = wrapperStage(read, WRAPPER);
  const e2e = importRead("fleet-e2e.ts");
  if (stage === null || e2e === null) return all(`Fußabdruck nicht ableitbar (${WRAPPER} oder fleet-e2e.ts)`);
  const copied = [...(read(WRAPPER) ?? "").split("\n").filter((l) => !/^\s*#/.test(l)).join("\n")
    .matchAll(/"\$\{?SRC\}?\/([\w.\/-]+)"/g)].map((m) => m[1]!);
  const moduleFile = (m: string): string => `e2e/${m}.ts`;
  const allModules = new Set(SHARD_UNITS.flatMap((u) => u.modules));
  const why: Record<string, string> = { [NIGHT_ONLY]: nightWhy };
  const run: string[] = [];
  for (const unit of BIG_UNITS) {
    if (unit === NIGHT_ONLY) continue;
    const own = new Set(SHARD_UNITS.find((u) => u.unit === unit)?.modules ?? []);
    if (!own.size) return all(`${unit} fehlt in e2e/ctx.ts#SHARD_UNITS`);
    // fleet-e2e.ts ohne die Importe der Moduldateien anderer Units: der Rest seines Abschlusses
    // (harness, ctx, suite-modules) gehört jeder Unit
    const others = [...allModules].filter((m) => !own.has(m)).map(moduleFile);
    const unitRead: TreeReader = (p) => p !== "fleet-e2e.ts" ? importRead(p) : e2e.split("\n")
      .filter((l) => !others.some((f) => l.includes(`from "./${f.replace(/\.ts$/, "")}"`))).join("\n");
    const closure = stageClosure(unitRead, [...stage.entries]);
    if (closure === null) return all(`Fußabdruck von ${unit} nicht ableitbar (ein Import löst sich nicht auf)`);
    const files = new Set([...stage.files, ...copied, ...STAGE_WHOLE, WRAPPER, ...closure]);
    const dirs = new Set([...stage.dirs, ...STAGE_WHOLE_DIRS]);
    for (const f of closure) {
      const r = reads(f);
      if (r === null) return all(`Fußabdruck von ${unit} nicht ableitbar (${f} lässt sich nicht übersetzen)`);
      for (const x of r.files) files.add(x);
      for (const x of r.dirs) dirs.add(x);
    }
    const hits = paths.filter((p) => files.has(p) || [...dirs].some((d) => p.startsWith(d)));
    if (hits.length) {
      run.push(unit);
      why[unit] = hits.length > 3 ? `${hits.slice(0, 3).join(", ")} und ${hits.length - 3} weitere` : hits.join(", ");
    } else why[unit] = "kein geänderter Pfad im Fußabdruck";
  }
  return { run, why };
}

// eine Zeile für Note und Ausgabe: was lief und wodurch, was nicht und warum
export function bigUnitsLine(s: BigUnitSelection): string {
  const grouped = (units: readonly string[]): string => {
    const byWhy = new Map<string, string[]>();
    for (const u of units) byWhy.set(s.why[u]!, [...(byWhy.get(s.why[u]!) ?? []), u]);
    return [...byWhy].map(([w, us]) => `${us.join(", ")} (${w})`).join("; ");
  };
  return `große Units: ${grouped(s.run) || "keine"} · ausgelassen: ${grouped(BIG_UNITS.filter((u) => !s.run.includes(u)))}`;
}
