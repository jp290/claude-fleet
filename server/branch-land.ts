// Neuaufbau K5 S3 + rechts-7 Punkt 5 · DAS LAND EINER CHARGE, ein Kern für zwei Türen. Die Owner-Tür
// POST /api/branches/land und die Self-Tür POST /api/self/branches/land (Owner Z132, 18.10.: „[Zitat entfernt]“
// ; Z87: „[Zitat entfernt]“)
// prüfen dasselbe und bewegen main auf demselben Weg. Die Self-Tür verlangt dazu das „passt“ des Owners auf
// genau dieser Spitze und einen brauchbaren Merge-Check; „ohne Merge-Check“ gibt es nur an der Owner-Tür.
//
// Die Commits seit der letzten Charge werden EIN Commit auf dem Integrationszweig, mit dem Betreff aus der
// Rückfrage. Sein Baum ist der Kandidat des Merge-Checks (oder, ohne Merge-Check und nur mit unchecked, derselbe
// Bau Commit für Commit hier); main bewegt sich per advanceIntegration. Branch, Worktree und Session bleiben;
// das Land steht am Branch. squash:false (oder ohne squash die Land-Form „commits“ des Branches): kein
// Charge-Commit — main springt per Fast-Forward auf den Kandidaten selbst, den ci/merge-check.ts#candidateOf
// Commit für Commit auf genau diesem main gebaut hat. Nur mit Merge-Check: chargeTrees Schritte sind keine
// Commits für main. git, Zustand und was nach einem Land fällig ist, reicht server.ts herein.
import { chargeBase, chargeMessage, doneSinceLastLand, findBranch, recordLand, usableCheck, type BranchBook, type BranchRecord } from "./branches";

export interface GitResult { out: string; err: string; code: number }
export interface LandDeps {
  gitRead(dir: string, ...args: string[]): Promise<GitResult>;
  git(dir: string, ...args: string[]): Promise<GitResult>;
  integrationBranch(repo: string): Promise<string | null>;
  branchExists(repo: string, branch: string): Promise<boolean>;
  hasMergeCheck(repo: string): boolean;
  mergeCheckRows(repo: string): Promise<unknown[]>;
  chargeLog(repo: string, checked: readonly string[] | null, base: string, tip: string, main: string, ...args: string[]): Promise<GitResult>;
  chargeTree(repo: string, main: string, base: string, tip: string): Promise<{ tree: string } | { conflict: string }>;
  advanceIntegration(repo: string, main: string, sha: string): Promise<{ error: string } | null>;
  book(): BranchBook;
  setBook(book: BranchBook): void;
  saveStateNow(): Promise<void>;
  // what a land that moved main owes afterwards: the check after the land, the code graph, the views
  afterLand(repo: string, main: string, branch: string, sha: string): Promise<void>;
  // repos with a charge in flight: one at a time per repo
  landing: Set<string>;
  // the answer's word on a deploy, where the server runs from this repo
  deployNote(repo: string): string | null;
}
export interface LandAsk { repo: string; branch: string; subject: string; unchecked: boolean; squash: boolean | undefined;
  // the session's own door: „passt“ on this very tip and a merge check, or no land
  own: boolean }
export interface LandAnswer { status: number; body: Record<string, unknown> }

export const CHARGE_REWRITTEN = "Branch seit der letzten Charge umgeschrieben, Basis neu wählen";
// a charge after a land must grow from that land's tip; a branch rewritten since has no base to count from
export async function chargeRewritten(gitRead: LandDeps["gitRead"], repo: string, r: BranchRecord, tip: string): Promise<boolean> {
  const last = r.lands.at(-1);
  return !!last && (await gitRead(repo, "merge-base", "--is-ancestor", last.tip, tip)).code !== 0;
}

const refuse = (status: number, error: string): LandAnswer => ({ status, body: { error } });

export async function landCharge(d: LandDeps, a: LandAsk): Promise<LandAnswer> {
  const { repo, branch, subject } = a;
  const record = findBranch(d.book(), repo, branch);
  if (!record?.name || !(await d.branchExists(repo, branch))) return refuse(404, `${branch} is no board branch here`);
  if (d.landing.has(repo)) return refuse(409, "in diesem Repo wird gerade eine Charge gemergt");
  d.landing.add(repo);
  try {
    const main = await d.integrationBranch(repo);
    if (!main) return refuse(400, "cannot resolve the repo's integration branch");
    const [tipR, mainR] = await Promise.all([d.gitRead(repo, "rev-parse", `refs/heads/${branch}`), d.gitRead(repo, "rev-parse", `refs/heads/${main}`)]);
    if (tipR.code !== 0 || mainR.code !== 0) return refuse(400, "branch or integration branch unreadable");
    const tip = tipR.out, mainSha = mainR.out;
    if (await chargeRewritten(d.gitRead, repo, record, tip)) return refuse(409, CHARGE_REWRITTEN);
    // THE SESSION'S OWN LAND waits for the owner's eye on exactly this tip (Mangel 121): a commit after „[Zitat entfernt]“ is unseen
    if (a.own && record.seen?.head !== tip)
      return refuse(409, record.seen ? `„passt“ gilt ${record.seen.head.slice(0, 8)}, die Spitze ist ${tip.slice(0, 8)} — der Owner hat sie noch nicht gesehen`
        : `noch kein „passt“ auf ${tip.slice(0, 8)} — der Owner hat diesen Stand noch nicht gesehen`);
    const base = chargeBase(record, main);
    if (!base) return refuse(400, "cannot resolve the charge's base");
    const checked = d.hasMergeCheck(repo);
    if (a.own && !checked) return refuse(409, "dieses Repo hat keinen Merge-Check — ohne ihn landet eine Session nicht selbst");
    const form = a.squash === undefined ? record.landForm ?? "squash" : a.squash ? "squash" : "commits";
    if (form === "commits" && !checked)
      return refuse(409, "alle Commits nur mit Merge-Check — dieses Repo hat keinen; „ein Commit“ geht (squash: true)");
    const use = checked ? usableCheck(await d.mergeCheckRows(repo), { branch, base, tip, main: mainSha }) : null;
    if (use && !use.ok) return refuse(409, use.why);
    if (!checked && !a.unchecked)
      return refuse(409, "dieses Repo hat keinen Merge-Check — mergen nur ausdrücklich „ohne Merge-Check“ (unchecked: true)");
    const log = await d.chargeLog(repo, use?.row.commits ?? null, base, tip, mainSha, "--format=%H%x00%s");
    const commits = log.out.split("\n").filter(Boolean).map((line) => { const [sha, s2] = line.split("\0"); return { sha: sha ?? "", subject: s2 ?? "" }; });
    if (log.code !== 0 || !commits.length) return refuse(409, `nichts zu mergen: keine Commits seit ${base.slice(0, 12)}`);
    let tree: string;
    if (use) {
      const ct = await d.gitRead(repo, "rev-parse", `${use.row.candidate}^{tree}`);
      if (ct.code !== 0 || ct.out !== use.row.tree) return refuse(409, "der Kandidat des Merge-Checks fehlt hier oder hat einen anderen Baum — neu prüfen");
      tree = use.row.tree;
    } else {
      const built = await d.chargeTree(repo, mainSha, base, tip);
      if ("conflict" in built) return refuse(409, built.conflict);
      tree = built.tree;
    }
    const passt = record.seen?.head === tip;
    let sha: string;
    if (form === "commits" && use) sha = use.row.candidate;
    else {
      const commit = await d.git(repo, "commit-tree", tree, "-p", mainSha, "-m", chargeMessage(subject, { branch, tip, commits, passt, checked }));
      if (commit.code !== 0 || !commit.out) return refuse(409, `commit-tree: ${commit.err.slice(0, 200)}`);
      sha = commit.out;
    }
    const moved = await d.advanceIntegration(repo, main, sha);
    if (moved) return refuse(409, `main wurde nicht bewegt: ${moved.error}`);
    const landed = recordLand(d.book(), repo, branch, { sha, at: Date.now(), tip, base, subject, points: doneSinceLastLand(record), passt, checked, form });
    if (landed.ok) d.setBook(landed.book);
    await d.saveStateNow();
    await d.afterLand(repo, main, branch, sha);
    const deploy = d.deployNote(repo);
    return { status: 200, body: { ok: true, sha, main, commits: commits.length, passt, checked, form, ...(deploy ? { deploy } : {}) } };
  } finally {
    d.landing.delete(repo);
  }
}
