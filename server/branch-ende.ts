// DAS ENDE EINES GELANDETEN BRANCHES (Owner 22.10., ~02:15: „[Zitat entfernt]“
// 
// ). Ein Land kopiert die Charge auf main und lässt Branch, Worktree und Datensatz stehen
// (server/branch-land.ts); ohne dieses Ende blieben sie auf dem Board, bis jemand sie von Hand nimmt.
//
// Ob seit dem Land etwas dazukam, sagt der gelandete Tip (BranchLand.tip), nicht ein Merge gegen das main von
// jetzt: Hat main seither dieselben Stellen geändert, zeigt `git merge-tree` neue Zeilen für einen ganz
// gelandeten Branch (gemessen 22.10. an drei Branches). Ein Branch endet nur, wenn seine Spitze genau der Tip
// des letzten Lands ist, sein Worktree nichts trägt, was nicht auf dem Branch steht (auch keine ignorierte
// Datei wie ein Upload in drops/), sein Notizblock keinen offenen Punkt hat und keine Session darin sitzt oder
// gerade hineinkommt. Eine Session, die weiterbaut, hält ihn also; Chargen landen in Folgen.
//
// SEINE TESTINSTANZ ENDET MIT IHM (Owner 22.10.: eine Instanz endet mit ihrem Branch, nicht mit ihrer TTL). Sie
// hält ihn nicht mehr fest: Das Ende stoppt sie durch ihre Tür, `testinstanz.sh down`, und die verweigert bei
// offener Verbindung — wer hineinschaut, hält Instanz und Branch, bis er geht. Nur eine Instanz, die gerade
// startet, hält ihn noch. Eine Instanz aus einem beiseitegelegten Worktree endet genauso (endParkedInstances). Vor dem Löschen steht der ganze Datensatz mit der Spitze im Ledger (server.ts#BRANCH_ENDS_FILE)
// und die Spitze unter refs/fleet/ended/<branch>: Von dort holt `git branch <branch> refs/fleet/ended/<branch>`
// ihn zurück, auch nach einem gc.
//
// git, Slots, Testinstanzen und das Log reicht server.ts herein (server.ts#endLandedBranchesNow).
import { dropBranch, openPoints, type BranchBook, type BranchLand, type BranchRecord } from "./branches";
import type { GitResult } from "./branch-land";

export const ENDED_REF = "refs/fleet/ended/";

export interface EndPlace { path: string; primary: boolean }
export interface EndFacts {
  head: string | null; // die Spitze jetzt; null = nicht lesbar
  place: EndPlace | null; // wo der Branch ausgecheckt ist; null = nirgends
  dirty: boolean | null; // nur mit `place`: ungesicherte Arbeit; null = nicht lesbar
  stray: string[]; // nur mit `place`: ignorierte Dateien, die nicht zum Gerüst einer Session gehören
  held: boolean; // eine Session sitzt im Worktree oder kommt gerade hinein
  instance: Instance; // eine Testinstanz läuft aus dem Worktree oder startet daraus
  baseOf: string | null; // ein anderer Branch im Buch zählt von diesem ab
}
export type Instance = "up" | "starting" | null;
export type EndVerdict = { end: true; land: BranchLand } | { end: false; why: string };

export function endVerdict(r: BranchRecord, f: EndFacts): EndVerdict {
  const land = r.lands.at(-1);
  if (!land) return { end: false, why: "nie gelandet" };
  if (f.head === null) return { end: false, why: "Spitze nicht lesbar" };
  if (f.head !== land.tip) return { end: false, why: `seit dem Land ${land.tip.slice(0, 8)} steht ${f.head.slice(0, 8)} darauf` };
  if (f.place?.primary) return { end: false, why: "im Haupt-Checkout ausgecheckt" };
  if (f.place && f.dirty !== false) return { end: false, why: f.dirty ? "ungesicherte Arbeit im Worktree" : "Worktree-Stand nicht lesbar" };
  if (f.place && f.stray.length) return { end: false, why: `ignorierte Dateien im Worktree: ${f.stray.slice(0, 5).join(", ")}` };
  const open = openPoints(r.text);
  if (open.length) return { end: false, why: `${open.length} offene Punkte im Notizblock` };
  if (f.held) return { end: false, why: "eine Session sitzt im Worktree" };
  if (f.instance === "starting") return { end: false, why: "eine Testinstanz startet aus dem Worktree" };
  if (f.baseOf) return { end: false, why: `${f.baseOf} zweigt von ihm ab` };
  return { end: true, land };
}

const within = (cwd: string, path: string): boolean => cwd === path || cwd.startsWith(`${path}/`);
// Was einen Worktree hält, außer einer Testinstanz. `busy` ist server.ts#attachBusy: Pfade, die gerade an eine
// Session gehen. Das Ende nimmt den Pfad dort selbst, bevor es etwas tut, damit kein Öffnen dazwischenkommt.
export interface EndHolds {
  busy: Set<string>;
  transit(): string[]; // Pfade einer Nachfolge zwischen Kill und Öffnen (server.ts#holdSuccessionPaths)
  cwds(): string[]; // das cwd jedes besetzten Slots
  real(path: string): string;
}
// `own`: der Pfad steht in `busy`, weil dieses Ende ihn genommen hat
export function heldBy(h: EndHolds, path: string, own = false): boolean {
  const p = h.real(path);
  return (!own && h.busy.has(path)) || h.transit().some((t) => h.real(t) === p) || h.cwds().some((c) => within(h.real(c), p));
}

export interface BranchEnd { repo: string; branch: string; head: string; path: string | null; land: string }
export interface EndDeps {
  gitRead(dir: string, ...args: string[]): Promise<GitResult>;
  git(dir: string, ...args: string[]): Promise<GitResult>;
  worktrees(repo: string): Promise<{ path: string; branch: string; primary: boolean }[]>; // wirft, wenn nicht lesbar
  holds: EndHolds;
  instance(path: string): Instance;
  // die Instanz durch ihre Tür beenden; null = beendet, sonst warum sie steht (jemand schaut)
  stopInstance(path: string): Promise<string | null>;
  // ignorierte Pfade, die Fleet selbst in einen Worktree legt (`git status --ignored` nennt sie so)
  scaffold: readonly string[];
  book(): BranchBook;
  setBook(book: BranchBook): void;
  saveStateNow(): Promise<void>;
  // vor dem Löschen, und es muss stehen: wirft es, bleibt der Branch. `record` ist der ganze Datensatz mit Notizblock
  log(end: BranchEnd, record: BranchRecord): Promise<void>;
  // was am Worktree sonst hängt (Ablage-Notiz, geparkter Merge)
  ended(end: BranchEnd): void;
  // Repos mit einer Charge im Flug: dort endet nichts
  landing: ReadonlySet<string>;
}

async function factsOf(d: EndDeps, r: BranchRecord, places: { path: string; branch: string; primary: boolean }[]): Promise<EndFacts> {
  const ref = await d.gitRead(r.repo, "rev-parse", "--verify", "--quiet", `refs/heads/${r.branch}`);
  const at = places.find((w) => w.branch === r.branch);
  // ohne --ignored sähe status keinen Upload in drops/, und `git worktree remove` ohne --force löscht ihn
  const st = at && !at.primary ? await d.gitRead(at.path, "status", "--porcelain", "--ignored") : null;
  const lines = st?.code === 0 ? st.out.split("\n").filter(Boolean) : [];
  const baseOf = d.book().find((o) => o.repo === r.repo && o.branch !== r.branch && o.base === r.branch)?.branch ?? null;
  return { head: ref.code === 0 && ref.out ? ref.out : null, place: at ? { path: at.path, primary: at.primary } : null,
    dirty: st ? (st.code === 0 ? lines.some((l) => !l.startsWith("!! ")) : null) : null,
    stray: lines.filter((l) => l.startsWith("!! ")).map((l) => l.slice(3)).filter((x) => !d.scaffold.includes(x)),
    held: !!at && heldBy(d.holds, at.path), instance: at ? d.instance(at.path) : null, baseOf };
}

// Ein Durchgang über alle gelandeten Branches im Buch. Was nicht sicher endet, bleibt; ein Fehlschlag mitten
// im Ende (Worktree ließ sich nicht entfernen, Spitze bewegte sich) lässt Branch und Datensatz stehen.
export async function endLandedBranches(d: EndDeps): Promise<{ ended: BranchEnd[]; kept: { branch: string; why: string }[] }> {
  const ended: BranchEnd[] = [], kept: { branch: string; why: string }[] = [];
  const places = new Map<string, { path: string; branch: string; primary: boolean }[] | null>();
  for (const r of d.book().filter((x) => x.lands.length > 0)) {
    if (d.landing.has(r.repo)) { kept.push({ branch: r.branch, why: "eine Charge ist im Flug" }); continue; }
    // eine Liste, die nicht lesbar war, ist nicht leer: sonst fiele ein ausgecheckter Branch unter „nirgends“
    if (!places.has(r.repo)) places.set(r.repo, await d.worktrees(r.repo).catch(() => null));
    const list = places.get(r.repo);
    if (!list) { kept.push({ branch: r.branch, why: "Worktrees des Repos nicht lesbar" }); continue; }
    const f = await factsOf(d, r, list);
    const v = endVerdict(r, f);
    if (!v.end) { kept.push({ branch: r.branch, why: v.why }); continue; }
    const done = await endOne(d, r, v.land, f.place?.path ?? null, f.instance === "up");
    if (typeof done === "string") { kept.push({ branch: r.branch, why: done }); continue; }
    ended.push(done);
  }
  if (ended.length) await d.saveStateNow();
  return { ended, kept };
}

async function endOne(d: EndDeps, r: BranchRecord, land: BranchLand, path: string | null, instance: boolean): Promise<BranchEnd | string> {
  const head = land.tip; // = die Spitze, das hat endVerdict geprüft
  const end: BranchEnd = { repo: r.repo, branch: r.branch, head, path, land: land.sha };
  // prüfen und nehmen ohne await dazwischen: kein Öffnen kann sich zwischen die beiden schieben
  if (path) {
    if (heldBy(d.holds, path)) return "eine Session kam dazu";
    d.holds.busy.add(path);
  }
  try {
    if (path && instance) {
      const stays = await d.stopInstance(path);
      if (stays) return stays;
    }
    const keep = await d.git(r.repo, "update-ref", `${ENDED_REF}${r.branch}`, head);
    if (keep.code !== 0) return `Spitze nicht gesichert: ${keep.err.slice(0, 200)}`;
    try { await d.log(end, r); }
    catch (e) { return `Log nicht geschrieben: ${e instanceof Error ? e.message : "unbekannt"}`; }
    if (path) {
      // eine Nachfolge oder ein Öffnen mit eigenem cwd fragt `busy` nicht: direkt vor dem Entfernen noch einmal
      if (heldBy(d.holds, path, true)) return "eine Session kam dazu";
      // ohne --force: was git noch für ungesichert hält, lässt den Worktree stehen
      const rmv = await d.git(r.repo, "worktree", "remove", path);
      if (rmv.code !== 0) return `Worktree blieb: ${(rmv.err || rmv.out).slice(0, 200)}`;
    }
    // nur, wenn die Spitze noch die geprüfte ist
    const del = await d.git(r.repo, "update-ref", "-d", `refs/heads/${r.branch}`, head);
    if (del.code !== 0) return `Branch blieb: ${del.err.slice(0, 200)}`;
    d.setBook(dropBranch(d.book(), r.repo, r.branch));
    d.ended(end);
    return end;
  } finally {
    if (path) d.holds.busy.delete(path);
  }
}

// DIE INSTANZ EINES BEISEITEGELEGTEN WORKTREES: Der Branch bleibt (er ist nicht gelandet), seine Instanz zeigt
// niemandem mehr etwas, was gerade gebaut wird. Sie endet durch ihre Tür, außer jemand schaut.
export async function endParkedInstances(d: Pick<EndDeps, "instance" | "stopInstance">, parked: readonly string[]):
  Promise<{ stopped: string[]; kept: { path: string; why: string }[] }> {
  const stopped: string[] = [], kept: { path: string; why: string }[] = [];
  for (const path of parked) {
    if (d.instance(path) !== "up") continue;
    const why = await d.stopInstance(path);
    if (why) kept.push({ path, why }); else stopped.push(path);
  }
  return { stopped, kept };
}
