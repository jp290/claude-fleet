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
import { istOeffnerin, LINIE_RE } from "./opener";

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
// `passt` sagt, ob der Owner genau diesen Tip gesehen hatte; `zusage` sagt, ob sie stattdessen auf der
// stehenden Zusage des Repos stand (server/land-zusage.ts) — dann ist `passt` false; `checked`, ob ein
// Merge-Check ihn prüfte.
// `form` "commits": main sprang auf den Kandidaten des Merge-Checks, `sha` ist dessen Spitze; fehlt = ein Commit.
export type LandForm = "squash" | "commits";
export interface BranchLand { sha: string; at: number; tip: string; base: string; subject: string; points: string[]; passt: boolean; checked: boolean;
  // das Land stand auf der stehenden Zusage des Owners für dieses Repo, nicht auf einem „[Zitat entfernt]“ dieser Spitze
  zusage?: true;
  // der Land lief auf einem ROTEN main, weil der Branch es belegt behebt (ci/repair-proof.ts,
  // server/branch-land.ts): der Grund steht im Merge-Check und in der Land-Zeile, damit man später
  // sieht, welche Länder trotz rotem main liefen. Fehlt das Feld, war main nicht rot.
  repair?: boolean;
  form?: LandForm;
  // das Land stand auf dem „passt“ eines Sitzes mit dem Recht branch.passt (W3b): wer es gab
  passtVon?: PasstVonSitz }
// DAS „PASST“ EINES SITZES (W3b, Owner 31.10.: „[Zitat entfernt]“): die Öffnerin eines Sitzes setzt es mit
// dem Recht branch.passt auf genau eine Spitze seines Branches (POST /api/self/seats/<n>/passt). Es steht neben dem des Owners (`seen`), ersetzt es nie und
// wird wie es durch einen späteren Commit alt; die Land-Tür der Session liest beide (server/branch-land.ts).
export interface PasstVonSitz { slot: number; openedAt: number; name: string | null }
export interface SitzPasst extends PasstVonSitz { at: number; head: string }
// Neuaufbau K13 · wer den Branch über die Tür geöffnet hat: der Sitz (Slot und Ordner) der Session, die
// /api/branches/open mit ihrem Self-Token neben dem Owner-Bearer rief. Eine Nachfolge behält Slot und
// Ordner und bleibt Öffner; ein Slot mit einer Session in einem anderen Ordner ist jemand anderes. Der
// Öffner und die Session auf dem Branch schreiben sich im Postfach (server.ts#sendMessageFor).
// `linie` (server/opener.ts): die Linie der Öffnerin — ihre Nachfolgerin bleibt Öffner, eine fremde Session in Slot und Ordner nicht;
// ein Datensatz ohne Linie (vor der Linie) gilt nach Slot und Ordner wie bisher
export interface BranchSeat { slot: number; cwd: string; linie?: string | null }
export interface BranchOpener { slot: number; cwd: string; linie?: string; at: number }
export interface BranchRecord {
  repo: string; branch: string;
  name: string | null; // Board-Name; null = ein Branch mit Punkten, den das Board nicht benannt hat
  base: string | null; // wovon er abzweigt und wogegen sein Diff läuft; null = Integrationszweig des Repos
  text: string; rev: number;
  seen: BranchSeen | null;
  lands: BranchLand[];
  opener?: BranchOpener; // fehlt: vom Board oder ohne Self-Token geöffnet, oder vor K13
  passtVon?: SitzPasst; // das „passt“ eines Sitzes auf eine Spitze (W3b); fehlt: keins
  landForm?: LandForm; // wie eine Charge landet, wenn die Route es nicht sagt; fehlt = ein Commit
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

// Ein Sitz mit dem Recht branch.passt gibt „passt“ an genau diesem Commit; ein neues ersetzt das alte, das des Owners bleibt unberührt.
export function markPasstVonSitz(book: BranchBook, repo: string, branch: string, passt: SitzPasst): BranchChange | BranchRefusal {
  if (!SHA_RE.test(passt.head)) return { ok: false, status: 400, error: "head muss eine volle Commit-SHA sein" };
  const prev = findBranch(book, repo, branch) ?? blank(repo, branch, passt.at);
  return put(book, { ...prev, passtVon: { slot: passt.slot, openedAt: passt.openedAt, name: passt.name, at: passt.at, head: passt.head }, updatedAt: passt.at });
}

// Eine Session öffnet den Branch: Sie wird sein Öffner, auch anstelle einer früheren. Ein Öffnen ohne
// Session (Board, Owner-Token allein) ruft das nicht und lässt den Öffner stehen.
export function setOpener(book: BranchBook, repo: string, branch: string, opener: BranchOpener): BranchChange {
  const prev = findBranch(book, repo, branch) ?? blank(repo, branch, opener.at);
  return put(book, { ...prev, opener: { slot: opener.slot, cwd: opener.cwd, ...(opener.linie ? { linie: opener.linie } : {}), at: opener.at }, updatedAt: opener.at });
}
export function setLandForm(book: BranchBook, repo: string, branch: string, form: LandForm, at: number): BranchChange {
  const prev = findBranch(book, repo, branch) ?? blank(repo, branch, at);
  return put(book, { ...prev, landForm: form, updatedAt: at });
}
export const isLandForm = (v: unknown): v is LandForm => v === "squash" || v === "commits";
// die Branches, die dieser Sitz geöffnet hat
export function openedBy(book: BranchBook, seat: BranchSeat): BranchRecord[] {
  return book.filter((r) => istOeffnerin(seat, r.opener));
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
// die offenen Punkte, „- [ ] …“
export const openPoints = (text: string): string[] => text.split("\n").flatMap((l) => {
  const m = POINT_RE.exec(l);
  return m && m[1] === " " && m[2]?.trim() ? [m[2].trim()] : [];
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
// `english`: der main eines fremden Repos liest englisch (Brief fremdes-repo-rund, Punkt 6) — Fleets eigener behält seine Sprache
export function chargeMessage(subject: string, o: { branch: string; tip: string; commits: readonly { sha: string; subject: string }[];
  passt: boolean; zusage?: boolean; checked: boolean; english?: boolean; passtVon?: PasstVonSitz }): string {
  const lines = o.commits.map((c) => `- ${c.sha.slice(0, 8)} ${c.subject}`);
  const tip = o.tip.slice(0, 8);
  const sitz = o.passtVon ? `slot ${o.passtVon.slot}${o.passtVon.name ? ` (${o.passtVon.name})` : ""}` : null;
  if (o.english) return [subject.trim(), "", `Batch from ${o.branch} up to ${tip}${o.checked ? "" : " (without a check)"}:`, ...lines, "",
    o.passt ? `Looked at and marked “looks good” at ${tip}.`
      : sitz ? `Marked “looks good” at ${tip} by the seat that opened it: ${sitz}.`
      : o.zusage ? `Landed on the owner's standing word for this repo, not on a “looks good” at ${tip}.` : "Not marked “looks good”."].join("\n");
  return [subject.trim(), "", `Charge aus ${o.branch} bis ${tip}${o.checked ? "" : " (ohne Merge-Check)"}:`, ...lines, "",
    o.passt ? `Owner hat diesen Stand gesehen: passt (${tip}).`
      : sitz ? `„passt“ auf ${tip} vom Sitz, der ihn öffnete: ${sitz}.`
      : o.zusage ? `Owner hat für dieses Repo zugesagt: das Land steht auf der stehenden Zusage, nicht auf einem „passt“ dieser Spitze (${tip}).`
      : "Owner hat diesen Stand nicht als „passt“ markiert."].join("\n");
}
// Ist die jüngste Merge-Check-Zeile dieses Branches eine, auf die eine Charge bauen darf? Sie muss
// genau diesen Tip gegen genau diese Basis prüfen, mergebar sein und den main von jetzt kennen. Ihre
// `commits` sind die, die der Kandidat trägt: Was der Owner sieht und was gemergt wird, zählt sie, nicht
// die Basis von jetzt, die als Ref-Name seit dem Check gewandert sein kann.
export interface MergeCheckRow { tip: string; base: string; main: string; candidate: string; tree: string; at: number; commits: string[];
  // der Branch behebt damit ein rotes main, und der Check hat es belegt (ci/repair-proof.ts):
  // nur dann durfte er auf rotem main „mergebar“ sagen, und das Land schreibt es an seinen Eintrag
  repair: boolean }
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
    commits: [...commits], repair: last.repair === true } };
}

// WAS EINE ZEILE AM BRANCH SAGT: ein Lauf, der vor dem Urteil endete (exit 3 — kein Helfer, der Kandidat kam nicht
// hinüber, der Runner starb, oder ein Konflikt), ist „nicht prüfbar“ mit seinem Grund, kein Rot, das keine Suite maß.
// Ältere Zeilen ohne `exit` erkennt man an ihrem Urteil.
export type CheckVerdict = "green" | "red" | "uncheckable";
export function checkVerdictOf(row: Record<string, unknown>): CheckVerdict {
  const exit = typeof row.exit === "number" ? row.exit : null;
  const verdict = typeof row.verdict === "string" ? row.verdict : null;
  if (exit === 3 || verdict === "error" || verdict === "conflict") return "uncheckable";
  return row.mergeable === true ? "green" : "red";
}

/** WAS DER LETZTE MERGE-CHECK EINES BRANCHES ÜBER SEINEN TIP SAGT — die eine Regel, die die Branch-Sicht des Boards (server.ts#chargeCheckView)
 *  und die Übersicht für Agenten (server.ts#lageZweig) teilen: „running“, solange ein Check für diesen Tip läuft; „none“ ohne Zeile; „stale“,
 *  wenn die Zeile einen anderen Tip ODER eine andere Basis prüfte; ein Lauf, der vor dem Urteil abbrach, sagt es für diesen Tip. `rows` sind
 *  die Zeilen des Merge-Check-Ledgers, in ihrer Reihenfolge. Rein. */
export function checkAusLedger(rows: readonly unknown[], branch: string, tip: string, base: string | null, laeuft: boolean):
  { state: "none" | "running" | "green" | "red" | "stale" | "uncheckable"; at: number | null; why: string | null } {
  if (laeuft) return { state: "running", at: null, why: null };
  const last = rows.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && (x as Record<string, unknown>).branch === branch).at(-1);
  if (!last) return { state: "none", at: null, why: null };
  const at = typeof last.at === "number" ? last.at : null, why = typeof last.why === "string" ? last.why : null;
  const state = checkVerdictOf(last);
  // ein Lauf, der vor dem Urteil abbrach, sagt es für DIESEN Tip — auch wenn er die Spitze nie auflöste (kein tip in der Zeile)
  if (state === "uncheckable" && (last.tip === undefined || last.tip === tip)) return { state, at, why };
  if (last.tip !== tip || last.base !== base) return { state: "stale", at, why: `geprüft war ${String(last.tip).slice(0, 8)} gegen ${String(last.base)}` };
  return { state, at, why };
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
function passtVonOf(v: unknown): PasstVonSitz | undefined {
  if (!v || typeof v !== "object") return undefined;
  const p = v as Record<string, unknown>;
  return num(p.slot) && Number.isInteger(p.slot) && num(p.openedAt) && (p.name === null || str(p.name))
    ? { slot: p.slot, openedAt: p.openedAt, name: p.name } : undefined;
}
function sitzPasstOf(v: unknown): SitzPasst | undefined {
  const von = passtVonOf(v);
  const p = v as Record<string, unknown> | null;
  return von && p && num(p.at) && str(p.head) && SHA_RE.test(p.head) ? { ...von, at: p.at, head: p.head } : undefined;
}
// a land comes back whole or not at all; a record from before S3 has none
function landsOf(v: unknown): BranchLand[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x): BranchLand[] => {
    if (!x || typeof x !== "object") return [];
    const l = x as Record<string, unknown>;
    return str(l.sha) && SHA_RE.test(l.sha) && num(l.at) && str(l.tip) && SHA_RE.test(l.tip) && str(l.base) && str(l.subject)
      && Array.isArray(l.points) && l.points.every(str) && typeof l.passt === "boolean" && typeof l.checked === "boolean"
      && (l.form === undefined || isLandForm(l.form)) && (l.zusage === undefined || typeof l.zusage === "boolean")
      ? [{ sha: l.sha, at: l.at, tip: l.tip, base: l.base, subject: l.subject, points: [...l.points], passt: l.passt, checked: l.checked,
        ...(l.zusage === true ? { zusage: true as const } : {}), ...(l.form ? { form: l.form } : {}),
        ...(passtVonOf(l.passtVon) ? { passtVon: passtVonOf(l.passtVon)! } : {}) }] : [];
  });
}
// ein Öffner kommt ganz oder gar nicht; ein kaputter nimmt den Datensatz nicht mit
function openerOf(v: unknown): BranchOpener | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  return typeof o.slot === "number" && Number.isInteger(o.slot) && o.slot >= 1 && str(o.cwd) && o.cwd !== "" && num(o.at)
    ? { slot: o.slot, cwd: o.cwd, ...(typeof o.linie === "string" && LINIE_RE.test(o.linie) ? { linie: o.linie } : {}), at: o.at } : undefined;
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
    const opener = openerOf(r.opener), passtVon = sitzPasstOf(r.passtVon);
    out.push({ repo: r.repo, branch: r.branch, name: r.name, base: r.base, text: r.text, rev: r.rev, seen, lands,
      ...(opener ? { opener } : {}), ...(passtVon ? { passtVon } : {}), ...(isLandForm(r.landForm) ? { landForm: r.landForm } : {}), createdAt: r.createdAt, updatedAt: r.updatedAt });
  }
  return out;
}
