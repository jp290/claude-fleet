// Neuaufbau K5 · Task = Branch: die Branches des Boards (server/branches.ts) für die git-Struktur — der Stand aus
// GET /api/branches, die Wahl „On land“, Session starten und neu starten, der Merge-Check und die Charge im Menü.
import { api, el, openActivity, post, revealStartedSlot, showSlot } from "./client";
import { askRisk } from "./dialog";
import type { BranchesRepoView, BranchesView, BranchView } from "./protocol";

const BRANCHES_EVERY_MS = 10_000;
let view: BranchesView | null = null;
let viewAt = 0;
let viewBusy = false;
const busy = new Set<string>();
const errs = new Map<string, string>();

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

export function boardRepo(repo: string): BranchesRepoView | undefined {
  return view?.repos.find((r) => r.repo === repo);
}

export function boardBranch(repo: string, branch: string | null): BranchView | undefined {
  if (!branch) return undefined;
  return view?.repos.find((r) => r.repo === repo)?.branches.find((b) => b.branch === branch);
}

// K16 · how the branch's charges land, kept on the server (Bauleitung e194d4b3: the owner moves between phone and
// desktop, and the Bauleitung lands through the route): one commit, or main moves onto the merge check's candidate
export async function chooseLandForm(repo: string, b: BranchView, form: BranchView["landForm"], repaint: () => void): Promise<void> {
  const key = keyOf(repo, b.branch);
  const was = b.landForm;
  errs.delete(key);
  b.landForm = form;
  repaint();
  const r = await post("/api/branches/note", { repo, branch: b.branch, landForm: form }).catch(() => null);
  if (!r?.ok) {
    const j = (await r?.json().catch(() => null)) as { error?: string } | null;
    b.landForm = was;
    errs.set(key, `The “On land” choice was not saved: ${j?.error ?? (r ? `answer ${r.status}` : "the server was not reachable")}`);
  }
  repaint();
}

export async function startSession(repo: string, b: BranchView, repaint: () => void): Promise<void> {
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
  errs.set(key, `The session did not start: ${j?.error ?? (r ? `answer ${r.status}` : "the server was not reachable")}`);
  repaint();
}

export async function startCheck(repo: string, b: BranchView, repaint: () => void): Promise<void> {
  const key = keyOf(repo, b.branch);
  errs.delete(key);
  const r = await post("/api/branches/check", { repo, branch: b.branch }).catch(() => null);
  const j = (await r?.json().catch(() => null)) as { error?: string } | null;
  if (!r?.ok) errs.set(key, `The merge check did not start: ${j?.error ?? (r ? `answer ${r.status}` : "the server was not reachable")}`);
  loadBranches(true, repaint);
}
// NEU STARTEN (Critic B7): a session that hangs is ended and the branch continues in a new one, with
// the same conversation where it has a transcript
export async function restartSession(repo: string, b: BranchView, slot: number, repaint: () => void): Promise<void> {
  const key = keyOf(repo, b.branch);
  const ok = await askRisk({ title: `Restart · ${b.name}`, body: [el("div", "hint",
    `The session in slot ${slot} hangs. It is ended, and a new session continues the conversation on this branch. Worktree and commits stay.`)],
    buttons: [{ label: "Cancel", value: false }, { label: "Restart", value: true, primary: true }] });
  if (!ok) return;
  busy.add(key);
  errs.delete(key);
  repaint();
  const k = await post(`/api/slots/${slot}/kill`, {}).catch(() => null);
  busy.delete(key);
  if (!k?.ok) { errs.set(key, `The old session could not be ended (answer ${k?.status ?? "none"}).`); repaint(); return; }
  await startSession(repo, b, repaint);
}

const sha7 = (h: string): string => h.slice(0, 7);
// EINEN COMMIT ÖFFNEN (Owner 13.10.: „[Zitat entfernt]“
// ): die Zeile öffnet ihn in der Commit-Ansicht mit Betreff, Text und
// Änderung, in der Geschichte von `branch`. Über einem Dialog öffnet sie darüber; der Dialog bleibt.
function commitLine(repo: string, branch: string | null, sha: string, subject: string): HTMLElement {
  const line = el("button", "diffstat brc-commit brc-open", `${sha7(sha)} ${subject}`) as HTMLButtonElement;
  line.type = "button";
  line.title = "Open the commit: subject, text and change";
  line.onclick = (e) => { e.stopPropagation(); void openActivity("commits", { repo, hash: sha, branch }); };
  return line;
}
// THE BATCH in the git structure's menu (owner Z83): what the next batch carries and its merge check
export function branchCharge(repo: string, b: BranchView): HTMLElement {
  injectCss();
  const box = el("div", "zd brc");
  box.dataset.branch = b.branch;
  const n = b.chargeCommits ?? 0, last = b.lands.at(-1);
  box.appendChild(el("div", "brc-k", `Batch · ${b.chargeCommits === null ? "state unknown" : n ? `${n} ${n === 1 ? "commit" : "commits"} since the last batch` : "nothing new since the last batch"}`
    + (last ? ` · ${b.lands.length} ${b.lands.length === 1 ? "batch" : "batches"} on main, last:` : "")));
  // the charge commit stands on the integration branch, not on this one
  if (last) box.appendChild(commitLine(repo, view?.repos.find((r) => r.repo === repo)?.integration ?? null, last.sha, `“${last.subject}”`));
  // the merge check is said once, in step 1 of the menu (src/board.ts#gsPanel)
  box.append(...said(keyOf(repo, b.branch)));
  return box;
}
// „PASST“ AS A BUTTON (owner Z132, 18.10.: „[Zitat entfernt]“; Mangel 121): the owner
// marks the tip he looked at — POST /api/branches/seen with the tip this view read. The line says which tip that is,
// and a commit after it asks again; on the tip he marked, the session lands the branch itself (/api/self/branches/land)
export function lookedLine(repo: string, b: BranchView, repaint: () => void): HTMLElement {
  injectCss();
  const key = keyOf(repo, b.branch);
  const tip = sha7(b.head), at = b.seen?.head ?? null;
  const line = el("div", "zd brc-seen");
  line.dataset.seen = at === b.head ? "tip" : at ? "older" : "none";
  line.appendChild(el("span", "tx", at === b.head ? `Looks good at ${tip} — the session may land it`
    : `Not seen yet · tip ${tip}${at ? ` (you looked at ${sha7(at)})` : ""}`));
  if (at !== b.head) {
    const r = el("span", "r");
    const btn = el("button", "rk-btn primary", "Looks good") as HTMLButtonElement;
    btn.type = "button";
    btn.title = `Mark ${tip}, the tip of ${b.branch} now, as looked at — the session may land it then`;
    btn.disabled = busy.has(key);
    btn.onclick = (e) => { e.stopPropagation(); void markLooked(repo, b, repaint); };
    r.appendChild(btn);
    line.appendChild(r);
  }
  line.append(...said(key));
  return line;
}
async function markLooked(repo: string, b: BranchView, repaint: () => void): Promise<void> {
  const key = keyOf(repo, b.branch), head = b.head;
  busy.add(key);
  errs.delete(key);
  repaint();
  const r = await post("/api/branches/seen", { repo, branch: b.branch, head }).catch(() => null);
  const j = (await r?.json().catch(() => null)) as { seen?: BranchView["seen"]; error?: string } | null;
  busy.delete(key);
  if (r?.ok && j?.seen) b.seen = j.seen;
  else errs.set(key, `“Looks good” was not saved: ${j?.error ?? (r ? `answer ${r.status}` : "the server was not reachable")}`);
  loadBranches(true, repaint);
}
export const branchBusy = (repo: string, b: BranchView): boolean => busy.has(keyOf(repo, b.branch));
export const mayCheck = (b: BranchView): boolean => !!b.check && b.check.state !== "green" && b.check.state !== "running" && !!b.chargeCommits;
// why the last act on this branch failed
function said(key: string): HTMLElement[] {
  const err = errs.get(key);
  return err ? [el("div", "err", err)] : [];
}

const BRANCH_CSS = `
  #board .zd.brc { display: flex; flex-direction: column; align-items: stretch; gap: 3px; padding: 2px 8px 8px calc(var(--rk-rail) + var(--rk-ref) + 8px); text-align: left; }
  #board .zd.brc > * { width: 100%; margin: 0; justify-content: flex-start; }
  #board .zd.brc > .brc-k { color: var(--chat-prose); margin-top: 4px; white-space: normal; }
  #board .zd.brc > .err { color: var(--danger); white-space: normal; }
  #board .zd.brc-seen > .err { flex-basis: 100%; color: var(--danger); white-space: normal; }
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
