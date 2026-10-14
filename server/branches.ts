// Neuaufbau K5 · Task = Branch (docs/neuaufbau/plan.md §6 K5). Die Arbeitseinheit ist der Branch: Er
// lebt vom Öffnen bis zum Merge, über mehrere Sessions und Chargen. Je (Repo, Branch) ein Datensatz mit
// Board-Name, Punkten und dem „passt“ des Owners. Er hängt am Branch, nicht am Worktree-Pfad: Ein
// entfernter Worktree lässt ihn stehen, ein neu ausgecheckter zeigt ihn wieder; er endet nur mit dem
// Branch. Die Punkte sind Zeilen „- [ ] …“ / „- [x] …“ im einen Text des Branches, der zugleich sein
// Notizblock ist: eine Liste, kein zweiter Stand. `rev` schützt sie: Wer auf einem veralteten Stand
// schreibt, bekommt 409 und den aktuellen Stand zurück, statt den eines anderen Geräts zu überschreiben.
//
// Reine Logik: kein git, keine Datei, kein Server-Zustand. server.ts liest git, hält den Stand und
// persistiert ihn in fleet.json. Jede Funktion gibt einen neuen Stand zurück und lässt den alten stehen.

export const BRANCH_TEXT_MAX = 20_000; // Zeichen, wie der Notizblock bisher (WORKTREE_NOTE_MAX)
export const BRANCH_NAME_MAX = 80;
const SHA_RE = /^[0-9a-f]{40}$/;
const POINT_RE = /^\s*-\s*\[( |x|X)\]\s*(.*)$/; // ein Punkt: „- [ ] …“ offen, „- [x] …“ erledigt
// C0-Steuerzeichen und DEL
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

// über welche Tür „passt“ kam: cookie = das Board des Owners, bearer/query = ein Aufruf mit dem
// Owner-Token (eine Session oder ctl.sh). Einen Sprecher nennt Fleet nie (server.ts#LandActor).
export type SeenVia = "cookie" | "bearer" | "query";
export interface BranchSeen { at: number; head: string; via: SeenVia }
// Eine Charge auf main: genau ein Commit `sha`, gebaut aus den Commits base..tip des Branches. Die
// nächste Charge zählt ab `tip` (chargeBase). `points` sind die Punkte, die diese Charge erledigt hat;
// `passt` sagt, ob der Owner genau diesen Tip gesehen hatte; `checked`, ob ein Merge-Check ihn prüfte.
export interface BranchLand { sha: string; at: number; tip: string; base: string; subject: string; points: string[]; passt: boolean; checked: boolean }
// Neuaufbau K13 · wer den Branch über die Tür geöffnet hat: der Sitz (Slot und Ordner) der Session, die
// /api/branches/open mit ihrem Self-Token neben dem Owner-Bearer rief. Eine Nachfolge behält Slot und
// Ordner und bleibt Öffner; ein Slot mit einer Session in einem anderen Ordner ist jemand anderes. Der
// Öffner und die Session auf dem Branch schreiben sich im Postfach (server.ts#sendMessageFor).
export interface BranchSeat { slot: number; cwd: string }
export interface BranchOpener extends BranchSeat { at: number }
export interface BranchRecord {
  repo: string; branch: string;
  name: string | null; // Board-Name; null = ein Branch mit Punkten, den das Board nicht benannt hat
  base: string | null; // wovon er abzweigt und wogegen sein Diff läuft; null = Integrationszweig des Repos
  text: string; rev: number;
  seen: BranchSeen | null;
  lands: BranchLand[];
  opener?: BranchOpener; // fehlt: vom Board oder ohne Self-Token geöffnet, oder vor K13
  createdAt: number; updatedAt: number;
}
export type BranchBook = readonly BranchRecord[];
export type BranchRefusal = { ok: false; status: 400 | 409; error: string;
  existing?: { branch: string; name: string }; current?: BranchRecord };
export type BranchChange = { ok: true; book: BranchBook; record: BranchRecord };

export function findBranch(book: BranchBook, repo: string, branch: string): BranchRecord | undefined {
  return book.find((r) => r.repo === repo && r.branch === branch);
}

function blank(repo: string, branch: string, at: number): BranchRecord {
  return { repo, branch, name: null, base: null, text: "", rev: 0, seen: null, lands: [], createdAt: at, updatedAt: at };
}
function put(book: BranchBook, record: BranchRecord): BranchChange {
  const i = book.findIndex((r) => r.repo === record.repo && r.branch === record.branch);
  return { ok: true, record, book: i < 0 ? [...book, record] : book.map((r, j) => (j === i ? record : r)) };
}
const nameKey = (name: string): string => name.normalize("NFC").toLocaleLowerCase("de-DE");

export function cleanName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.replace(/[ \t]+/g, " ").trim();
  if (!name) return { ok: false, error: "der Name ist leer" };
  if (CONTROL_RE.test(name)) return { ok: false, error: "der Name enthält Steuerzeichen" };
  if (name.length > BRANCH_NAME_MAX) return { ok: false, error: `der Name hat ${name.length} Zeichen, erlaubt sind ${BRANCH_NAME_MAX}` };
  return { ok: true, name };
}

// Ein Branch bekommt seinen Board-Namen und die Punkte aus dem Öffnen. Neue Punkte werden an einen
// vorhandenen Text angehängt, nie gegen ihn getauscht. Ein Name, den im Repo schon ein anderer Branch
// trägt, wird abgewiesen, und die Antwort nennt den vorhandenen, damit man dorthin weitergehen kann.
export function openBranch(book: BranchBook, o: { repo: string; branch: string; name: string; base: string | null;
  points: readonly string[]; at: number }): BranchChange | BranchRefusal {
  const n = cleanName(o.name);
  if (!n.ok) return { ok: false, status: 400, error: n.error };
  const holder = book.find((r) => r.repo === o.repo && r.branch !== o.branch && r.name !== null && nameKey(r.name) === nameKey(n.name));
  if (holder?.name)
    return { ok: false, status: 409, error: `„${holder.name}“ ist in diesem Repo schon vergeben (${holder.branch})`,
      existing: { branch: holder.branch, name: holder.name } };
  const prev = findBranch(book, o.repo, o.branch) ?? blank(o.repo, o.branch, o.at);
  const lines = o.points.map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean).map((p) => `- [ ] ${p}`);
  const text = [prev.text, ...lines].filter(Boolean).join("\n");
  if (text.length > BRANCH_TEXT_MAX)
    return { ok: false, status: 400, error: `die Punkte ergäben ${text.length} Zeichen, erlaubt sind ${BRANCH_TEXT_MAX}` };
  const changed = lines.length > 0;
  return put(book, { ...prev, name: n.name, base: prev.base ?? o.base, text,
    rev: changed ? prev.rev + 1 : prev.rev, updatedAt: o.at });
}

// Der ganze Text auf einmal, gegen den Stand `rev`, den der Schreibende gelesen hat. Ein Branch ohne
// Datensatz steht auf Stand 0. Abweisungen lassen den gespeicherten Text unverändert.
export function writeText(book: BranchBook, repo: string, branch: string, text: string, rev: number,
  at: number): BranchChange | BranchRefusal {
  if (text.length > BRANCH_TEXT_MAX)
    return { ok: false, status: 400, error: `der Text hat ${text.length} Zeichen, erlaubt sind ${BRANCH_TEXT_MAX}; gespeichert bleibt der alte` };
  const prev = findBranch(book, repo, branch) ?? blank(repo, branch, at);
  if (rev !== prev.rev)
    return { ok: false, status: 409, error: `veralteter Stand: gelesen ${rev}, gespeichert ist ${prev.rev}`, current: prev };
  return put(book, { ...prev, text, rev: prev.rev + 1, updatedAt: at });
}

// „Owner hat gesehen / passt“ an genau diesem Commit. Ein Merge zeigt es an, er erzwingt es nicht.
export function markSeen(book: BranchBook, repo: string, branch: string, head: string, via: SeenVia,
  at: number): BranchChange | BranchRefusal {
  if (!SHA_RE.test(head)) return { ok: false, status: 400, error: "head muss eine volle Commit-SHA sein" };
  const prev = findBranch(book, repo, branch) ?? blank(repo, branch, at);
  return put(book, { ...prev, seen: { at, head, via }, updatedAt: at });
}

// Eine Session öffnet den Branch: Sie wird sein Öffner, auch anstelle einer früheren. Ein Öffnen ohne
// Session (Board, Owner-Token allein) ruft das nicht und lässt den Öffner stehen.
export function setOpener(book: BranchBook, repo: string, branch: string, opener: BranchOpener): BranchChange {
  const prev = findBranch(book, repo, branch) ?? blank(repo, branch, opener.at);
  return put(book, { ...prev, opener: { slot: opener.slot, cwd: opener.cwd, at: opener.at }, updatedAt: opener.at });
}
// die Branches, die dieser Sitz geöffnet hat
export function openedBy(book: BranchBook, seat: BranchSeat): BranchRecord[] {
  return book.filter((r) => r.opener?.slot === seat.slot && r.opener.cwd === seat.cwd);
}

// Was GET /api/branches je Repo zeigt, aus den Refs und Worktrees, die server.ts gelesen hat: die
// Board-Branches (Datensatz mit Namen, Branch lebt) und die übrigen für „Bestehend öffnen“. Übrig ist
// jeder Branch ohne Board-Namen außer dem des Haupt-Checkouts, jüngster Commit zuerst, höchstens
// BRANCH_OTHERS_MAX; `othersTotal` sagt, wie viele es sind.
export const BRANCH_OTHERS_MAX = 50;
export interface BranchRef { branch: string; head: string; at: number }
export interface BranchPlace { path: string; branch: string; primary: boolean }
export function repoBranches(book: BranchBook, repo: string, refs: readonly BranchRef[], places: readonly BranchPlace[]): {
  named: { record: BranchRecord & { name: string }; ref: BranchRef; path: string | null }[];
  others: (BranchRef & { path: string | null })[]; othersTotal: number;
} {
  const pathOf = (branch: string): string | null => places.find((p) => p.branch === branch)?.path ?? null;
  const primary = places.find((p) => p.primary)?.branch;
  const named = book.flatMap((record) => {
    const ref = record.repo === repo && record.name !== null ? refs.find((r) => r.branch === record.branch) : undefined;
    return ref && record.name !== null ? [{ record: { ...record, name: record.name }, ref, path: pathOf(ref.branch) }] : [];
  });
  const all = refs.filter((r) => r.branch !== primary && !named.some((n) => n.ref.branch === r.branch))
    .toSorted((a, b) => b.at - a.at);
  return { named, others: all.slice(0, BRANCH_OTHERS_MAX).map((r) => ({ ...r, path: pathOf(r.branch) })), othersTotal: all.length };
}

// CHARGEN. Eine Charge sind die Commits des Branches seit der letzten Charge; die erste zählt ab der
// Basis des Branches, sonst ab dem Integrationszweig.
export function chargeBase(r: BranchRecord | undefined, integration: string | null): string | null {
  return r?.lands.at(-1)?.tip ?? r?.base ?? integration;
}
const donePoints = (text: string): string[] => text.split("\n").flatMap((l) => {
  const m = POINT_RE.exec(l);
  return m && m[1] !== " " && m[2]?.trim() ? [m[2].trim()] : [];
});
// erledigt und in keiner früheren Charge genannt
export function doneSinceLastLand(r: BranchRecord): string[] {
  const before = new Set(r.lands.flatMap((l) => l.points));
  return donePoints(r.text).filter((p) => !before.has(p));
}
export function recordLand(book: BranchBook, repo: string, branch: string, land: BranchLand): BranchChange {
  const prev = findBranch(book, repo, branch) ?? blank(repo, branch, land.at);
  return put(book, { ...prev, lands: [...prev.lands, land], updatedAt: land.at });
}
// Der Commit einer Charge: der Betreff aus der Rückfrage, im Body die Commits des Branches (SHA und
// Betreff), damit die Herkunft lesbar bleibt, und ob der Owner diesen Stand gesehen hatte.
export function chargeMessage(subject: string, o: { branch: string; tip: string; commits: readonly { sha: string; subject: string }[];
  passt: boolean; checked: boolean }): string {
  const lines = o.commits.map((c) => `- ${c.sha.slice(0, 8)} ${c.subject}`);
  return [subject.trim(), "", `Charge aus ${o.branch} bis ${o.tip.slice(0, 8)}${o.checked ? "" : " (ohne Merge-Check)"}:`, ...lines, "",
    o.passt ? `Owner hat diesen Stand gesehen: passt (${o.tip.slice(0, 8)}).` : "Owner hat diesen Stand nicht als „passt“ markiert."].join("\n");
}
// Ist die jüngste Merge-Check-Zeile dieses Branches eine, auf die eine Charge bauen darf? Sie muss
// genau diesen Tip gegen genau diese Basis prüfen, mergebar sein und den main von jetzt kennen. Ihre
// `commits` sind die, die der Kandidat trägt: Was der Owner sieht und was gemergt wird, zählt sie, nicht
// die Basis von jetzt, die als Ref-Name seit dem Check gewandert sein kann.
export interface MergeCheckRow { tip: string; base: string; main: string; candidate: string; tree: string; at: number; commits: string[] }
export function usableCheck(rows: readonly unknown[], want: { branch: string; base: string; tip: string; main: string }):
  { ok: true; row: MergeCheckRow } | { ok: false; why: string } {
  const mine = rows.filter((x): x is Record<string, unknown> => !!x && typeof x === "object"
    && (x as Record<string, unknown>).branch === want.branch && (x as Record<string, unknown>).tip === want.tip);
  const last = mine.at(-1);
  if (!last) return { ok: false, why: `kein Merge-Check auf ${want.tip.slice(0, 8)} — erst prüfen` };
  if (last.base !== want.base) return { ok: false, why: `der Merge-Check prüfte gegen ${String(last.base)}, die Charge zählt ab ${want.base} — neu prüfen` };
  if (last.mergeable !== true) return { ok: false, why: `der Merge-Check auf ${want.tip.slice(0, 8)} ist nicht mergebar: ${String(last.why ?? last.verdict ?? "rot")}` };
  if (last.main !== want.main) return { ok: false, why: "main ist seit dem Merge-Check weitergelaufen — neu prüfen" };
  if (!str(last.candidate) || !str(last.tree) || !num(last.at)) return { ok: false, why: "die Merge-Check-Zeile nennt keinen Kandidaten" };
  const commits = last.commits;
  if (!Array.isArray(commits) || !commits.every((c): c is string => str(c) && SHA_RE.test(c)))
    return { ok: false, why: "die Merge-Check-Zeile nennt die geprüften Commits nicht — neu prüfen" };
  return { ok: true, row: { tip: want.tip, base: want.base, main: want.main, candidate: last.candidate, tree: last.tree, at: last.at,
    commits: [...commits] } };
}

export function dropBranch(book: BranchBook, repo: string, branch: string): BranchBook {
  return book.filter((r) => !(r.repo === repo && r.branch === branch));
}

// Beim Boot: `alive` sagt je Branch true/false, oder null, wenn die Refs des Repos nicht lesbar waren.
// Nur ein sicher fehlender Branch nimmt seinen Datensatz mit.
export function pruneBook(book: BranchBook, alive: (repo: string, branch: string) => boolean | null): BranchBook {
  return book.filter((r) => alive(r.repo, r.branch) !== false);
}

// Die alten Notizblöcke hingen am Worktree-Pfad (server.ts#worktreeNotes). Jeder wandert einmal auf
// den Branch, der an seinem Pfad ausgecheckt ist. Ein Branch, der schon einen Datensatz hat, behält
// seinen Text, auch einen geleerten: Damit ändert ein zweiter Boot nichts. Pfade ohne Worktree kommen
// als `orphans` zurück; die alte Liste selbst bleibt unberührt.
export function adoptNotes(book: BranchBook, notes: Readonly<Record<string, string>>,
  branchAt: ReadonlyMap<string, { repo: string; branch: string }>, at: number): { book: BranchBook; orphans: string[] } {
  let next = book;
  const orphans: string[] = [];
  for (const [path, text] of Object.entries(notes)) {
    const place = branchAt.get(path);
    if (!place) { orphans.push(path); continue; }
    if (findBranch(next, place.repo, place.branch)) continue;
    next = put(next, { ...blank(place.repo, place.branch, at), text, rev: 1 }).book;
  }
  return { book: next, orphans };
}

function str(v: unknown): v is string { return typeof v === "string"; }
function num(v: unknown): v is number { return typeof v === "number" && Number.isFinite(v) && v >= 0; }
function seenOf(v: unknown): BranchSeen | null | undefined {
  if (v === null) return null;
  if (!v || typeof v !== "object") return undefined;
  const s = v as Record<string, unknown>;
  return num(s.at) && str(s.head) && SHA_RE.test(s.head) && (s.via === "cookie" || s.via === "bearer" || s.via === "query")
    ? { at: s.at, head: s.head, via: s.via } : undefined;
}
// a land comes back whole or not at all; a record from before S3 has none
function landsOf(v: unknown): BranchLand[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x): BranchLand[] => {
    if (!x || typeof x !== "object") return [];
    const l = x as Record<string, unknown>;
    return str(l.sha) && SHA_RE.test(l.sha) && num(l.at) && str(l.tip) && SHA_RE.test(l.tip) && str(l.base) && str(l.subject)
      && Array.isArray(l.points) && l.points.every(str) && typeof l.passt === "boolean" && typeof l.checked === "boolean"
      ? [{ sha: l.sha, at: l.at, tip: l.tip, base: l.base, subject: l.subject, points: [...l.points], passt: l.passt, checked: l.checked }] : [];
  });
}
// ein Öffner kommt ganz oder gar nicht; ein kaputter nimmt den Datensatz nicht mit
function openerOf(v: unknown): BranchOpener | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  return typeof o.slot === "number" && Number.isInteger(o.slot) && o.slot >= 1 && str(o.cwd) && o.cwd !== "" && num(o.at)
    ? { slot: o.slot, cwd: o.cwd, at: o.at } : undefined;
}
// fleet.json → Stand. Was nicht die Form eines Datensatzes hat, fällt heraus; doppelte Einträge für
// denselben Branch: der erste gilt.
export function restoreBook(raw: unknown): BranchBook {
  if (!Array.isArray(raw)) return [];
  const out: BranchRecord[] = [];
  for (const v of raw) {
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    const seen = seenOf(r.seen);
    const lands = landsOf(r.lands);
    if (!str(r.repo) || !str(r.branch) || !(r.name === null || str(r.name)) || !(r.base === null || str(r.base))
      || !str(r.text) || !num(r.rev) || !Number.isInteger(r.rev) || seen === undefined || !num(r.createdAt) || !num(r.updatedAt)) continue;
    if (findBranch(out, r.repo, r.branch)) continue;
    const opener = openerOf(r.opener);
    out.push({ repo: r.repo, branch: r.branch, name: r.name, base: r.base, text: r.text, rev: r.rev, seen, lands,
      ...(opener ? { opener } : {}), createdAt: r.createdAt, updatedAt: r.updatedAt });
  }
  return out;
}
