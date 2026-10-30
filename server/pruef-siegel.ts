// PRÜF-GEDÄCHTNIS (Owner 29.10.: „[Zitat entfernt]“).
//
// Ein SIEGEL sagt: auf dem Baum T liefen diese Units, grün oder rot, auf dieser Maschine, in diesem Lauf. Es hängt als Git-Note am
// BAUM-Objekt (nicht am Commit): ein Squash-Land macht einen neuen Commit mit demselben Baum, und der Baum ist, was die Suite sieht.
//   · Wo es steht: refs/notes/fleet/seal/<maschine>. Jede Maschine schreibt nur ihren eigenen Ref, darum gibt es keinen Merge-Konflikt.
//     Was vom Hub kommt, landet unter refs/notes/fleet/seal-hub/<maschine>, nie über einen eigenen Ref: ein Abruf überschreibt nichts.
//   · Wie es reist: der Schreiber schiebt seinen Ref zum Hub (pushSiegel), die andere Seite holt ihn (holeSiegel) — fleet-sync.sh holt ihn
//     ebenfalls. Ohne Hub bleibt das Siegel lokal; das ist kein Fehler.
//   · Was es deckt: nur seine eigenen Units (deckung). Ein Siegel mit Baum T deckt nichts für Baum T'. Für jede Unit entscheidet das
//     NEUESTE Siegel, das sie nennt: ist es rot, ist die Unit ungedeckt (ein Rot wird neu gelaufen, es zählt nie als „schon geprüft“).
//   · Was NICHT reist: ein Urteil (Adjudikation) — es steht in keiner Siegel-Zeile, und ein Feld, das ein Siegel nicht kennt, wird beim
//     Lesen verworfen. Plattform und bun-Version stehen im Siegel und werden angezeigt. Ungebunden ist der Standard: nur eine ausdrücklich markierte Unit
//     (e2e/ctx.ts#ShardUnit.plattformGebunden, heute keine) verlangt ein Siegel der Plattform des Fragenden (deckung).
//   · VERTRAUEN: ein Siegel kann schreiben, wer auf den Hub pushen kann; das Deploy-Tor glaubt ihm so, wie es heute dem Helfer glaubt,
//     und jedes Siegel nennt seinen Lauf (Maschine + Run-Ordner), damit „grün“ nachprüfbar bleibt.
import { hostname } from "node:os";
import { SHARD_UNITS } from "../e2e/ctx";

export const SIEGEL_REF = "refs/notes/fleet/seal";
export const SIEGEL_HUB_REF = "refs/notes/fleet/seal-hub";
const MACHINE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const UNIT = /^[a-z0-9][a-z0-9-]{0,63}$/;
const TREE = /^[0-9a-f]{40}$/;
const MAX_LINES_PER_TREE = 200;

export type SiegelTiefe = "check" | "audit";
export interface Siegel {
  v: 1;
  tree: string;
  /** die Units, die dieser Lauf wirklich lief (e2e/ctx.ts#SHARD_UNITS) */
  units: string[];
  tiefe: SiegelTiefe;
  ergebnis: "green" | "red";
  /** wer es ausgeführt hat — der Name, der im Anzeigetext steht */
  maschine: string;
  plattform: { os: string; arch: string; bun: string };
  /** der Lauf, damit „grün“ nachprüfbar bleibt: Run-Ordner (Basisname) oder Job */
  lauf: string;
  at: number;
}
/** eine Quelle der zusammengesetzten Deckung: wer welche Units wann lief */
export interface SiegelQuelle {
  maschine: string; lauf: string; tiefe: SiegelTiefe; units: string[]; at: number;
  plattform: { os: string; arch: string; bun: string };
}
export interface Deckung {
  /** geforderte Units, die ein grünes Siegel deckt */
  gedeckt: string[];
  /** geforderte Units ohne Deckung: genau das muss noch laufen */
  luecke: string[];
  quellen: SiegelQuelle[];
}

/** Der Name dieser Maschine im Siegel: FLEET_MACHINE (lokale Bindung), sonst der Hostname. */
export function maschinenName(env: Record<string, string | undefined> = process.env): string {
  const raw = (env.FLEET_MACHINE ?? "").trim() || hostname().split(".")[0] || "maschine";
  const clean = raw.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return MACHINE.test(clean) ? clean : "maschine";
}
export const plattformHier = (): Siegel["plattform"] => ({ os: process.platform, arch: process.arch, bun: Bun.version });

/** Die Units einer Suite ohne Mutanten-Scheiben, ohne die geskippten (die Tabelle eines Laufs, e2e/ctx.ts#unitsOfRun). */
export const geforderteUnits = (skip: readonly string[] = []): string[] =>
  SHARD_UNITS.filter((u) => !u.mutantsOf && !skip.includes(u.unit)).map((u) => u.unit);

/** Eine Zeile aus einer Note, streng gelesen. Unbekannte Felder (etwa ein Urteil) fallen weg; Unlesbares ist null. */
export function siegelAusZeile(line: string): Siegel | null {
  let raw: unknown;
  try { raw = JSON.parse(line); } catch { return null; }
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const p = r.plattform as Record<string, unknown> | undefined;
  if (r.v !== 1 || typeof r.tree !== "string" || !TREE.test(r.tree)
    || !Array.isArray(r.units) || r.units.length > 200 || !r.units.every((u) => typeof u === "string" && UNIT.test(u))
    || (r.tiefe !== "check" && r.tiefe !== "audit") || (r.ergebnis !== "green" && r.ergebnis !== "red")
    || typeof r.maschine !== "string" || !MACHINE.test(r.maschine)
    || !p || typeof p.os !== "string" || typeof p.arch !== "string" || typeof p.bun !== "string"
    || typeof r.lauf !== "string" || !r.lauf || r.lauf.length > 200
    || typeof r.at !== "number" || !Number.isFinite(r.at)) return null;
  return { v: 1, tree: r.tree, units: [...new Set(r.units as string[])], tiefe: r.tiefe, ergebnis: r.ergebnis, maschine: r.maschine,
    plattform: { os: p.os.slice(0, 20), arch: p.arch.slice(0, 20), bun: p.bun.slice(0, 20) }, lauf: r.lauf, at: r.at };
}

/** `plattform`: die des Fragenden (Standard: diese Maschine); `gebunden`: ob eine Unit plattformgebunden ist (Standard: die Markierung in ShardUnit). */
export interface PlattformRegel { plattform?: string; gebunden?: (unit: string) => boolean }
const istPlattformGebunden = (unit: string): boolean => SHARD_UNITS.some((u) => u.unit === unit && u.plattformGebunden === true);

/**
 * Was die Siegel zu den geforderten Units decken. Nur ein grünes Siegel deckt; für jede Unit gilt das NEUESTE Siegel, das sie nennt
 * (ist es rot, bleibt sie in der Lücke). Die Quellen sind die Siegel, die wirklich etwas beitragen, je mit ihrem Beitrag.
 */
export function deckung(siegel: readonly Siegel[], gefordert: readonly string[], opts: PlattformRegel = {}): Deckung {
  const hier = opts.plattform ?? plattformHier().os;
  const gebunden = opts.gebunden ?? istPlattformGebunden;
  const neuesteZuerst = [...siegel].sort((a, b) => b.at - a.at);
  const gedeckt: string[] = [];
  const luecke: string[] = [];
  const beitrag = new Map<Siegel, string[]>();
  for (const unit of gefordert) {
    // DIE PLATTFORM-REGEL: ungebunden ist der Standard, ein Siegel jeder Plattform deckt die Unit. Nur eine ausdrücklich gebundene Unit
    // (ShardUnit.plattformGebunden) zählt allein das Siegel der Plattform des Fragenden; ein Siegel der anderen deckt sie nicht, und der Fragende fährt sie.
    const passt = (s: Siegel): boolean => !gebunden(unit) || s.plattform.os === hier;
    const massgeblich = neuesteZuerst.find((s) => s.units.includes(unit) && passt(s));
    if (massgeblich && massgeblich.ergebnis === "green") {
      gedeckt.push(unit);
      beitrag.set(massgeblich, [...(beitrag.get(massgeblich) ?? []), unit]);
    } else luecke.push(unit);
  }
  const quellen = [...beitrag].map(([s, units]): SiegelQuelle => ({
    maschine: s.maschine, lauf: s.lauf, tiefe: s.tiefe, units, at: s.at, plattform: s.plattform })).sort((a, b) => a.at - b.at);
  return { gedeckt, luecke, quellen };
}

/** „geprüft am <Rechner>, <Tiefe>“ — der Satz für die zweite Fleet und das Deploy-Tor. */
export function geprueftAm(quellen: readonly SiegelQuelle[]): string {
  if (!quellen.length) return "";
  const tiefe = (t: SiegelTiefe): string => t === "audit" ? "voller Audit" : "Merge-Check";
  return "geprüft am " + quellen.map((q) => `${q.maschine}, ${tiefe(q.tiefe)} (${q.units.length} Units, ${q.lauf})`).join(" + ");
}

// ---- Git: Notes am Baum-Objekt ------------------------------------------------------------------------------------------------------

type Out = { code: number; out: string; err: string };
async function git(repo: string, args: string[], timeoutMs = 20_000): Promise<Out> {
  try {
    const p = Bun.spawn(["git", "-C", repo, ...args], { stdout: "pipe", stderr: "pipe", stdin: "ignore",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
    const timer = setTimeout(() => { try { p.kill(); } catch { /* gone */ } }, timeoutMs);
    try {
      const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
      return { code: await p.exited, out: out.trim(), err: err.trim() };
    } finally { clearTimeout(timer); }
  } catch (e) { return { code: 1, out: "", err: e instanceof Error ? e.message : String(e) }; }
}

/** Der Baum eines Commits, oder null. */
export async function baumVon(repo: string, sha: string): Promise<string | null> {
  const r = await git(repo, ["rev-parse", "--verify", "--quiet", `${sha}^{tree}`]);
  return r.code === 0 && TREE.test(r.out) ? r.out : null;
}

// Schreiben nacheinander: zwei `notes append` auf denselben Ref gleichzeitig scheitern an git's Ref-Sperre.
let schreibKette: Promise<unknown> = Promise.resolve();

/** Hängt das Siegel an die Note seines Baums im Ref dieser Maschine. Gibt false zurück, wenn git es nicht nahm. */
export function schreibeSiegel(repo: string, s: Siegel, schreiber: string = maschinenName()): Promise<boolean> {
  const next = schreibKette.then(async () => {
    if (!MACHINE.test(schreiber) || !siegelAusZeile(JSON.stringify(s))) return false;
    const r = await git(repo, ["-c", "user.name=fleet", "-c", "user.email=fleet@localhost", "notes", `--ref=${SIEGEL_REF}/${schreiber}`,
      "append", "-m", JSON.stringify(s), s.tree]);
    return r.code === 0;
  });
  schreibKette = next.catch(() => false);
  return next;
}

/**
 * Alle Siegel zu einem Baum aus beiden Namensräumen (eigene Refs und die vom Hub geholten), ohne Doppelte.
 * `fremdFuer`: nur Siegel, die ein ANDERER Schreiber in den Hub gelegt hat — der Ref, nicht das Feld `maschine`, sagt, wessen Fleet es schrieb
 * (der Helfer, der einen Audit der einen Fleet fuhr, trägt den Namen der anderen). Der Hub-Abruf des eigenen Refs zählt nicht.
 */
export async function leseSiegel(repo: string, tree: string, opts: { fremdFuer?: string } = {}): Promise<Siegel[]> {
  if (!TREE.test(tree)) return [];
  const refs = await git(repo, ["for-each-ref", "--format=%(refname)", ...(opts.fremdFuer ? [`${SIEGEL_HUB_REF}/`] : [`${SIEGEL_REF}/`, `${SIEGEL_HUB_REF}/`])]);
  if (refs.code !== 0 || !refs.out) return [];
  const seen = new Set<string>();
  const found: Siegel[] = [];
  for (const ref of refs.out.split("\n")) {
    if (opts.fremdFuer && ref.slice(ref.lastIndexOf("/") + 1) === opts.fremdFuer) continue;
    const note = await git(repo, ["notes", `--ref=${ref}`, "show", tree]);
    if (note.code !== 0) continue;
    for (const line of note.out.split("\n").slice(0, MAX_LINES_PER_TREE)) {
      const s = line.trim() ? siegelAusZeile(line.trim()) : null;
      if (!s || s.tree !== tree) continue;
      const key = `${s.maschine}\0${s.lauf}\0${s.tiefe}\0${s.ergebnis}\0${s.at}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(s);
    }
  }
  return found;
}

/** Schiebt den eigenen Ref zum Hub (nur Fast-Forward, nur der eigene Ref). Best effort: ohne Remote oder Hub bleibt es lokal. */
export async function pushSiegel(repo: string, remote: string, schreiber: string = maschinenName()): Promise<boolean> {
  if (!remote) return false;
  const ref = `${SIEGEL_REF}/${schreiber}`;
  if ((await git(repo, ["rev-parse", "--verify", "--quiet", ref])).code !== 0) return false;
  return (await git(repo, ["push", "--quiet", remote, `${ref}:${ref}`], 30_000)).code === 0;
}

let zuletztGeholt = 0;
/** Holt die Siegel der anderen Maschinen vom Hub in den Hub-Namensraum. Höchstens einmal je `mindestensMs`. */
export async function holeSiegel(repo: string, remote: string, mindestensMs = 30_000): Promise<boolean> {
  if (!remote) return false;
  const now = Date.now();
  if (now - zuletztGeholt < mindestensMs) return true;
  zuletztGeholt = now;
  return (await git(repo, ["fetch", "--quiet", remote, `+${SIEGEL_REF}/*:${SIEGEL_HUB_REF}/*`], 30_000)).code === 0;
}
/** Nur für Tests: die Abrufsperre zurücksetzen. */
export const vergesseAbruf = (): void => { zuletztGeholt = 0; };

/**
 * Der Plan eines Audits für einen Stand: was schon gedeckt ist und was noch läuft. `gefordert` sind die Units, die dieser Lauf schulden
 * würde. Ohne lesbaren Baum ist alles Lücke — nicht lesbar heißt ungeprüft.
 */
export async function planFuer(repo: string, sha: string, gefordert: readonly string[]): Promise<Deckung & { tree: string | null }> {
  const tree = await baumVon(repo, sha);
  if (!tree) return { tree: null, gedeckt: [], luecke: [...gefordert], quellen: [] };
  return { tree, ...deckung(await leseSiegel(repo, tree), gefordert) };
}
