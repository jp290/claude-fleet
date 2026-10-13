// Neuaufbau K5 · Task = Branch: die Branch-Karte in Info. Ein Branch des Boards trägt seinen Namen,
// seine Punkte und das „passt“ des Owners (server/branches.ts); hier hakt man Punkte ab und trägt neue
// nach, sieht den Diff ohne Session, sagt „[Zitat entfernt]“ an der Spitze und startet oder öffnet die Session.
// Der Stand kommt aus GET /api/branches; die Punkte sind derselbe Text wie der Notizblock der Session,
// also eine Liste. Geschrieben wird gegen den gelesenen Stand (rev): Hat ein anderes Gerät inzwischen
// geschrieben, wird der Klick auf dessen Text noch einmal angewandt, statt ihn zu überschreiben.
import { api, el, openActivity, post, renderDiffInto, revealStartedSlot, showSlot } from "./client";
import { askRisk } from "./dialog";
import type { BranchesView, BranchView } from "./protocol";

const BRANCHES_EVERY_MS = 10_000;
let view: BranchesView | null = null;
let viewAt = 0;
let viewBusy = false;
const busy = new Set<string>();
const errs = new Map<string, string>();
const notes = new Map<string, string>(); // what a charge just did, until the next one
const drafts = new Map<string, string>();

const keyOf = (repo: string, branch: string): string => `${repo}\n${branch}`;
// the board reads the worktrees on its own beat; a card that just created one (a session started, a
// charge merged) asks it to read them now, or the branch stood in neither list for up to 10 s
let refreshPlaces: () => void = () => {};
export function onPlacesChanged(fn: () => void): void { refreshPlaces = fn; }

export function loadBranches(force: boolean, repaint: () => void): void {
  if (viewBusy || (!force && Date.now() - viewAt < BRANCHES_EVERY_MS)) return;
  viewBusy = true;
  viewAt = Date.now();
  void api("/api/branches").then(async (r) => { if (r.ok) view = (await r.json()) as BranchesView; })
    .catch(() => undefined)
    .finally(() => { viewBusy = false; repaint(); });
}

// the board branches of a repo that have no worktree: the branch and its points outlive the tree
export function branchesWithoutTree(repo: string): BranchView[] {
  return view?.repos.find((r) => r.repo === repo)?.branches.filter((b) => !b.path) ?? [];
}

export function boardBranch(repo: string, branch: string | null): BranchView | undefined {
  if (!branch) return undefined;
  return view?.repos.find((r) => r.repo === repo)?.branches.find((b) => b.branch === branch);
}

interface Point { line: number; done: boolean; text: string }
const POINT_RE = /^\s*-\s*\[( |x|X)\]\s*(.*)$/;
function pointsOf(text: string): Point[] {
  return text.split("\n").flatMap((l, line) => {
    const m = POINT_RE.exec(l);
    return m && m[2]?.trim() ? [{ line, done: m[1] !== " ", text: m[2].trim() }] : [];
  });
}
// one click on the CURRENT text: tick the point with this text, or add one — null when it is gone
function toggled(text: string, point: string): string | null {
  const lines = text.split("\n");
  const at = pointsOf(text).find((p) => p.text === point);
  if (!at) return null;
  lines[at.line] = `- [${at.done ? " " : "x"}] ${at.text}`;
  return lines.join("\n");
}
const added = (text: string, point: string): string => [text.trimEnd(), `- [ ] ${point}`].filter(Boolean).join("\n");

async function writePoints(repo: string, b: BranchView, change: (text: string) => string | null, repaint: () => void): Promise<void> {
  const key = keyOf(repo, b.branch);
  errs.delete(key);
  let text = b.text, rev = b.rev;
  for (let round = 0; round < 3; round++) {
    const next = change(text);
    if (next === null) { errs.set(key, "Den Punkt gibt es nicht mehr — ein anderes Gerät hat die Liste geändert."); break; }
    b.text = next; // shown at once; the answer below corrects it
    repaint();
    const r = await post("/api/branches/note", { repo, branch: b.branch, text: next, rev }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { rev?: number; error?: string; current?: { text: string; rev: number } } | null;
    if (r?.ok && typeof j?.rev === "number") { b.rev = j.rev; break; }
    if (r?.status === 409 && j?.current) { text = j.current.text; rev = j.current.rev; b.text = text; b.rev = rev; continue; }
    b.text = text;
    errs.set(key, `Die Punkte wurden nicht gespeichert: ${j?.error ?? (r ? `Antwort ${r.status}` : "der Server war nicht erreichbar")}`);
    break;
  }
  repaint();
}

async function showDiff(repo: string, b: BranchView): Promise<void> {
  const d = await api(`/api/branches/diff?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(b.branch)}`)
    .then(async (r) => (r.ok ? await r.json() : { error: `Antwort ${r.status}` }))
    .catch(() => ({ error: "der Server war nicht erreichbar" })) as
    { base?: string; files?: string[]; commits?: { sha: string; subject: string }[]; diff?: string; truncated?: boolean; error?: string };
  const body: HTMLElement[] = [];
  if (d.error) body.push(el("div", "diffstat err", `Der Diff kam nicht: ${d.error}`));
  else {
    const n = d.files?.length ?? 0, c = d.commits?.length ?? 0;
    body.push(el("div", "diffstat", `${b.branch} gegen ${d.base ?? "die Basis"} · ${c} ${c === 1 ? "Commit" : "Commits"} · ${n} ${n === 1 ? "Datei" : "Dateien"}${d.truncated ? " · gekürzt" : ""}`));
    for (const x of d.commits ?? []) body.push(commitLine(repo, b.branch, x.sha, x.subject));
    if (d.diff) { const box = el("div", "difftxt"); renderDiffInto(box, d.diff); body.push(box); }
    else body.push(el("div", "diffstat", "Noch keine Änderung gegen die Basis."));
  }
  await askRisk({ title: `Diff · ${b.name}`, body, panelClass: "riskpanel landreviewpanel", buttons: [{ label: "Schließen", value: false }] });
}

async function sayPasst(repo: string, b: BranchView, repaint: () => void): Promise<void> {
  const key = keyOf(repo, b.branch);
  busy.add(key);
  errs.delete(key);
  repaint();
  const r = await post("/api/branches/seen", { repo, branch: b.branch, head: b.head }).catch(() => null);
  const j = (await r?.json().catch(() => null)) as { seen?: BranchView["seen"]; error?: string } | null;
  if (r?.ok && j?.seen) b.seen = j.seen;
  else errs.set(key, `„passt“ wurde nicht gespeichert: ${j?.error ?? (r ? `Antwort ${r.status}` : "der Server war nicht erreichbar")}`);
  busy.delete(key);
  repaint();
}

async function startSession(repo: string, b: BranchView, repaint: () => void): Promise<void> {
  const key = keyOf(repo, b.branch);
  busy.add(key);
  errs.delete(key);
  repaint();
  const r = await post("/api/branches/open", { repo, branch: b.branch }).catch(() => null);
  const j = (await r?.json().catch(() => null)) as { slot?: number; error?: string } | null;
  busy.delete(key);
  if (r?.ok && typeof j?.slot === "number") {
    loadBranches(true, repaint);
    refreshPlaces();
    if (await revealStartedSlot(j.slot)) showSlot(j.slot);
    return;
  }
  errs.set(key, `Die Session startete nicht: ${j?.error ?? (r ? `Antwort ${r.status}` : "der Server war nicht erreichbar")}`);
  repaint();
}

// CHARGE MERGEN (K5 S3/S4b): the commits since the last charge become one commit on main. The
// question shows what goes, in German: the subject (prefilled with the name and the points done since
// the last charge), those points, the passt state, the diff of exactly these commits — and, in a repo
// without a merge check, that it goes without one.
const doneSince = (b: BranchView): string[] => {
  const before = new Set(b.lands.flatMap((l) => l.points));
  return pointsOf(b.text).filter((p) => p.done && !before.has(p.text)).map((p) => p.text);
};
async function startCheck(repo: string, b: BranchView, repaint: () => void): Promise<void> {
  const key = keyOf(repo, b.branch);
  errs.delete(key);
  const r = await post("/api/branches/check", { repo, branch: b.branch }).catch(() => null);
  const j = (await r?.json().catch(() => null)) as { error?: string } | null;
  if (!r?.ok) errs.set(key, `Der Merge-Check startete nicht: ${j?.error ?? (r ? `Antwort ${r.status}` : "der Server war nicht erreichbar")}`);
  loadBranches(true, repaint);
}
async function mergeCharge(repo: string, b: BranchView, repaint: () => void): Promise<void> {
  const key = keyOf(repo, b.branch);
  const unchecked = b.check === null;
  const done = doneSince(b);
  const d = await api(`/api/branches/diff?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(b.branch)}&charge=1`)
    .then(async (r) => (r.ok ? await r.json() : { error: `Antwort ${r.status}` }))
    .catch(() => ({ error: "der Server war nicht erreichbar" })) as
    { files?: string[]; commits?: { sha: string; subject: string }[]; diff?: string; truncated?: boolean; error?: string };
  const subject = el("input", "brc-subject") as HTMLInputElement;
  subject.value = `${b.name}${done.length ? `: ${done.join(", ")}` : ""}`.slice(0, 200);
  subject.maxLength = 200;
  subject.setAttribute("aria-label", "Betreff des Commits auf main");
  const n = d.commits?.length ?? b.chargeCommits ?? 0;
  const body: HTMLElement[] = [
    el("div", "hint", `Die ${n} ${n === 1 ? "Commit" : "Commits"} seit der letzten Charge werden ein Commit auf main. Branch, Worktree und Session bleiben.`),
    el("div", "brc-k", "Betreff"), subject,
    el("div", "brc-k", done.length ? `Erledigt seit der letzten Charge: ${done.join(" · ")}` : "Seit der letzten Charge ist kein Punkt erledigt."),
    el("div", `brc-k${b.seen?.head === b.head ? "" : " warn"}`, b.seen?.head === b.head ? `Owner hat diesen Stand gesehen: passt (${sha7(b.head)}).`
      : "Owner hat diesen Stand noch nicht als „passt“ markiert."),
  ];
  if (unchecked) body.push(el("div", "brc-k warn", "Dieses Repo hat keinen Merge-Check — die Charge geht ohne Merge-Check nach main."));
  if (d.error) body.push(el("div", "diffstat err", `Der Diff kam nicht: ${d.error}`));
  else {
    for (const c of d.commits ?? []) body.push(commitLine(repo, b.branch, c.sha, c.subject));
    if (d.diff) { const box = el("div", "difftxt"); renderDiffInto(box, d.diff); body.push(box); }
  }
  const ok = await askRisk({ title: `Charge mergen · ${b.name}`, body, panelClass: "riskpanel landreviewpanel",
    buttons: [{ label: "Abbrechen", value: false }, { label: unchecked ? "Ohne Merge-Check mergen" : "Mergen", value: true, primary: true, disabled: !!d.error }] });
  if (!ok) return;
  busy.add(key);
  errs.delete(key);
  repaint();
  const r = await post("/api/branches/land", { repo, branch: b.branch, subject: subject.value.trim() || b.name, ...(unchecked ? { unchecked: true } : {}) }).catch(() => null);
  const j = (await r?.json().catch(() => null)) as { sha?: string; deploy?: string; error?: string } | null;
  busy.delete(key);
  if (r?.ok && j?.sha) notes.set(key, `Charge gemergt: ${j.sha.slice(0, 7)} auf main${j.deploy ? ` — ${j.deploy}` : ""}`);
  else errs.set(key, `Die Charge wurde nicht gemergt: ${j?.error ?? (r ? `Antwort ${r.status}` : "der Server war nicht erreichbar")}`);
  loadBranches(true, repaint);
  refreshPlaces();
}
// NEU STARTEN (Critic B7): a session that hangs is ended and the branch continues in a new one, with
// the same conversation where it has a transcript
async function restartSession(repo: string, b: BranchView, slot: number, repaint: () => void): Promise<void> {
  const key = keyOf(repo, b.branch);
  const ok = await askRisk({ title: `Neu starten · ${b.name}`, body: [el("div", "hint",
    `Die Session in Slot ${slot} hängt. Sie wird beendet, und eine neue Session setzt das Gespräch auf diesem Branch fort. Worktree, Commits und Punkte bleiben.`)],
    buttons: [{ label: "Abbrechen", value: false }, { label: "Neu starten", value: true, primary: true }] });
  if (!ok) return;
  busy.add(key);
  errs.delete(key);
  repaint();
  const k = await post(`/api/slots/${slot}/kill`, {}).catch(() => null);
  busy.delete(key);
  if (!k?.ok) { errs.set(key, `Die alte Session ließ sich nicht beenden (Antwort ${k?.status ?? "keine"}).`); repaint(); return; }
  await startSession(repo, b, repaint);
}

const sha7 = (h: string): string => h.slice(0, 7);
// EINEN COMMIT ÖFFNEN (Owner 13.10.: „[Zitat entfernt]“
// ): die Zeile öffnet ihn in der Commit-Ansicht mit Betreff, Text und
// Änderung, in der Geschichte von `branch`. Über einem Dialog öffnet sie darüber; der Dialog bleibt.
function commitLine(repo: string, branch: string | null, sha: string, subject: string): HTMLElement {
  const line = el("button", "diffstat brc-commit brc-open", `${sha7(sha)} ${subject}`) as HTMLButtonElement;
  line.type = "button";
  line.title = "Commit öffnen: Betreff, Text und Änderung";
  line.onclick = (e) => { e.stopPropagation(); void openActivity("commits", { repo, hash: sha, branch }); };
  return line;
}
function seenWords(b: BranchView): string {
  if (!b.seen) return "passt · noch nicht gesehen";
  const day = new Date(b.seen.at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return b.seen.head === b.head ? `passt · an ${sha7(b.seen.head)}, ${day}` : `passt an ${sha7(b.seen.head)} (${day}) — seitdem neue Commits`;
}

export function branchCard(repo: string, b: BranchView, slot: number | null, repaint: () => void, hung = false): HTMLElement {
  injectCss();
  const key = keyOf(repo, b.branch);
  const box = el("div", "zd brc");
  box.dataset.branch = b.branch;
  const points = pointsOf(b.text);
  const open = points.filter((p) => !p.done).length;
  box.appendChild(el("div", "brc-k", points.length ? `Punkte · ${open} offen von ${points.length}` : "Punkte · noch keine"));
  for (const p of points) {
    const t = el("button", `brc-pt${p.done ? " done" : ""}`) as HTMLButtonElement;
    t.type = "button";
    t.setAttribute("role", "checkbox");
    t.setAttribute("aria-checked", String(p.done));
    t.append(el("span", "brc-box", p.done ? "✓" : ""), el("span", "brc-tx", p.text));
    t.onclick = (e) => { e.stopPropagation(); void writePoints(repo, b, (text) => toggled(text, p.text), repaint); };
    box.appendChild(t);
  }
  const add = el("input", "brc-add") as HTMLInputElement;
  add.placeholder = "Punkt hinzufügen, Enter";
  add.setAttribute("aria-label", `Punkt hinzufügen · ${b.name}`); // the board's focus key finds this field again after a repaint
  add.dataset.add = key;
  add.value = drafts.get(key) ?? "";
  add.oninput = () => drafts.set(key, add.value);
  add.onclick = (e) => e.stopPropagation();
  add.onkeydown = (e) => {
    if (e.key !== "Enter" || !add.value.trim()) return;
    e.preventDefault();
    const point = add.value.replace(/\s+/g, " ").trim();
    drafts.delete(key);
    void writePoints(repo, b, (text) => added(text, point), repaint);
  };
  box.appendChild(add);
  const d = b.distance;
  // after a charge the graph counts the branch's own charge commit on main as "behind" — the charge
  // line below says what counts then
  if (!b.lands.length) box.appendChild(el("div", "brc-k", `Stand · ${d ? `${d.ahead} ${d.ahead === 1 ? "Commit" : "Commits"} voraus, ${d.behind} hinter ${b.base ?? "der Basis"}` : "Abstand unbekannt"}`));
  box.appendChild(el("div", `brc-k brc-seen${b.seen && b.seen.head === b.head ? " ok" : ""}`, seenWords(b)));
  const acts = el("div", "brc-acts");
  const diff = el("button", "rk-btn", "Diff") as HTMLButtonElement;
  diff.type = "button";
  diff.onclick = (e) => { e.stopPropagation(); void showDiff(repo, b); };
  const passt = el("button", "rk-btn", b.seen?.head === b.head ? "passt ✓" : "Passt") as HTMLButtonElement;
  passt.type = "button";
  passt.dataset.act = "passt";
  passt.disabled = busy.has(key) || b.seen?.head === b.head;
  passt.title = `Owner hat den Stand ${sha7(b.head)} gesehen und sagt „passt“ — ein Merge zeigt es an`;
  passt.onclick = (e) => { e.stopPropagation(); void sayPasst(repo, b, repaint); };
  const go = el("button", "rk-btn primary", slot ? "Zur Session" : busy.has(key) ? "startet …" : "Session starten") as HTMLButtonElement;
  go.type = "button";
  go.dataset.act = "session";
  go.disabled = !slot && busy.has(key);
  go.title = slot ? `Zur Session in Slot ${slot}` : "Eine Session auf diesem Branch starten — sie setzt das letzte Gespräch fort";
  go.onclick = (e) => { e.stopPropagation(); if (slot) showSlot(slot); else void startSession(repo, b, repaint); };
  acts.append(diff, passt, go);
  if (slot && hung) {
    const again = el("button", "rk-btn", "Neu starten") as HTMLButtonElement;
    again.type = "button";
    again.dataset.act = "restart";
    again.disabled = busy.has(key);
    again.title = "Die hängende Session beenden und den Branch in einer neuen fortsetzen";
    again.onclick = (e) => { e.stopPropagation(); void restartSession(repo, b, slot, repaint); };
    acts.appendChild(again);
  }
  box.appendChild(acts);
  // CHARGE: what the next charge carries, its merge check, and the one button that merges it
  const n = b.chargeCommits ?? 0, last = b.lands.at(-1);
  box.appendChild(el("div", "brc-k", `Charge · ${b.chargeCommits === null ? "Stand unbekannt" : n ? `${n} ${n === 1 ? "Commit" : "Commits"} seit der letzten Charge` : "nichts Neues seit der letzten Charge"}`
    + (last ? ` · ${b.lands.length} ${b.lands.length === 1 ? "Charge" : "Chargen"} auf main, zuletzt:` : "")));
  // the charge commit stands on the integration branch, not on this one
  if (last) box.appendChild(commitLine(repo, view?.repos.find((r) => r.repo === repo)?.integration ?? null, last.sha, `„${last.subject}“`));
  const chk = b.check;
  if (chk) box.appendChild(el("div", `brc-k brc-check ${chk.state}`, chk.state === "running" ? "Merge-Check läuft …"
    : chk.state === "green" ? "Merge-Check grün auf diesem Stand" : chk.state === "red" ? `Merge-Check rot: ${chk.why ?? "ohne Grund"}`
    : chk.state === "stale" ? "Merge-Check auf einem älteren Stand — neu prüfen" : "Noch kein Merge-Check auf diesem Stand"));
  const cacts = el("div", "brc-acts");
  if (chk && chk.state !== "green" && chk.state !== "running" && n) {
    const cb = el("button", "rk-btn", "Merge-Check starten") as HTMLButtonElement;
    cb.type = "button";
    cb.dataset.act = "check";
    cb.title = `${b.branch} gegen ${b.chargeBase ?? "die Basis"} prüfen — der Baum, den main danach hätte`;
    cb.onclick = (e) => { e.stopPropagation(); void startCheck(repo, b, repaint); };
    cacts.appendChild(cb);
  }
  const mb = el("button", "rk-btn primary", busy.has(key) ? "mergt …" : "Charge mergen") as HTMLButtonElement;
  mb.type = "button";
  mb.dataset.act = "merge";
  mb.disabled = busy.has(key) || !n || (!!chk && chk.state !== "green");
  mb.title = !n ? "Nichts zu mergen: keine Commits seit der letzten Charge"
    : chk && chk.state !== "green" ? "Erst ein grüner Merge-Check auf diesem Stand"
    : "Die Commits seit der letzten Charge als einen Commit nach main — Branch, Worktree und Session bleiben";
  mb.onclick = (e) => { e.stopPropagation(); void mergeCharge(repo, b, repaint); };
  cacts.appendChild(mb);
  box.appendChild(cacts);
  const note = notes.get(key);
  if (note) box.appendChild(el("div", "brc-k brc-note", note));
  const err = errs.get(key);
  if (err) box.appendChild(el("div", "err", err));
  return box;
}

const BRANCH_CSS = `
  #board .zd.brc { display: flex; flex-direction: column; align-items: stretch; gap: 3px; padding: 2px 8px 8px calc(var(--rk-rail) + var(--rk-ref) + 8px); text-align: left; }
  #board .zd.brc > * { width: 100%; margin: 0; justify-content: flex-start; }
  #board .zd.brc > .brc-k { color: var(--chat-prose); margin-top: 4px; white-space: normal; }
  #board .zd.brc > .brc-seen.ok { color: var(--chat-ink); }
  #board .zd.brc > .brc-pt { display: flex; align-items: flex-start; gap: 6px; min-height: 28px; padding: 3px 0; border: 0; background: none;
    color: var(--chat-ink); font: inherit; text-align: left; cursor: pointer; }
  #board .zd.brc > .brc-pt.done > .brc-tx { color: var(--chat-faint); text-decoration: line-through; }
  #board .zd.brc .brc-box { flex: 0 0 14px; height: 14px; margin-top: 2px; border: 1px solid var(--chat-edge); border-radius: 3px;
    font-size: 11px; line-height: 12px; text-align: center; }
  #board .zd.brc .brc-tx { white-space: normal; overflow-wrap: anywhere; }
  #board .zd.brc > .brc-add { min-height: 28px; padding: 0 7px; border: 1px solid var(--chat-edge); border-radius: var(--r1);
    background: var(--chat-surface); color: var(--chat-ink); font: inherit; }
  #board .zd.brc > .brc-acts { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; margin-top: 4px; }
  #board .zd.brc > .err { color: var(--danger); white-space: normal; }
  #board .zd.brc > .brc-check.green, #board .zd.brc > .brc-note { color: var(--chat-ink); }
  #board .zd.brc > .brc-check.red { color: var(--danger); }
  .landreviewpanel .brc-subject { width: 100%; box-sizing: border-box; min-height: 32px; padding: 0 8px; margin: 2px 0 8px;
    border: 1px solid var(--chat-edge); border-radius: var(--r1); background: var(--chat-surface); color: var(--chat-ink); font: inherit; }
  .landreviewpanel .brc-k { margin: 4px 0; white-space: normal; }
  .landreviewpanel .brc-k.warn { color: var(--danger); }
  .landreviewpanel .brc-commit { font-family: var(--mono, monospace); }
  .brc-open { display: block; width: 100%; padding: 2px 0; border: 0; background: none; color: inherit; font: inherit; text-align: left;
    cursor: pointer; text-decoration: underline dotted; text-underline-offset: 3px; }
  .brc-open:hover, .brc-open:focus-visible { color: var(--chat-ink); text-decoration-style: solid; }
  #board .zd.brc > .brc-open { color: var(--chat-prose); white-space: normal; overflow-wrap: anywhere; }
`;
let cssIn = false;
function injectCss(): void {
  if (cssIn) return;
  cssIn = true;
  const st = document.createElement("style");
  st.textContent = BRANCH_CSS;
  document.head.appendChild(st);
}
