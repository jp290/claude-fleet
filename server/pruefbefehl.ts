// THE CHECK COMMAND OF A REPO (owner 23.10. ~22:00: „[Zitat entfernt]“;
// brief fremdes-repo-rund, point 1). A repo without ci/merge-check.ts gets one command line — `python -m pytest`,
// `npm test`, `make check` — that Fleet runs with `sh -c` in a copy of the tree main would have after a land; its exit
// code is the verdict. The same command is the repo's merge check, its land gate and its audit after a land, so a
// stranger sets one thing in the board and the board's „Looks good — the session may land it“ comes true.
// WHO DECIDES WHAT RUNS: the person at the board. The owner door stores a command and it runs from then on; a session
// may only PROPOSE one, which the board shows next to „[Zitat entfernt]“, and nothing runs a proposal (the brief's second limit:
// no command from the board without its user's word). Fleet's own repo keeps ci/merge-check.ts and its helper.
// Stored in fleet.json beside repoWorkers, keyed by the canonical primary checkout; a change holds without a restart.
export interface CheckProposal { cmd: string; by: string; at: number }
export interface RepoCheck { cmd: string | null; by: string | null; at: number | null; proposal: CheckProposal | null }
export type RepoChecks = Readonly<Record<string, RepoCheck>>;

export const CHECK_CMD_MAX = 500;
export const OWN_MERGE_CHECK = "this repo brings its own merge check (ci/merge-check.ts) — it needs no check command";

// one line a shell runs; the door says why it refuses, and a refused value changes nothing
export function checkCmdProblem(cmd: string): string | null {
  if (!cmd.trim()) return "the check command is empty";
  if (/[\r\n\0]/.test(cmd)) return "the check command is one line";
  if (cmd.length > CHECK_CMD_MAX) return `the check command has ${cmd.length} characters — the cap is ${CHECK_CMD_MAX}`;
  return null;
}

const tidy = (checks: RepoChecks, repo: string, next: RepoCheck): RepoChecks => {
  const out = { ...checks };
  if (next.cmd === null && next.proposal === null) delete out[repo];
  else out[repo] = next;
  return out;
};
// the owner's word: a command runs from now on (a proposal of the same text is answered with it), null clears it
export function setCheck(checks: RepoChecks, repo: string, cmd: string | null, by: string, at: number): RepoChecks {
  const prev = checks[repo];
  const proposal = prev?.proposal && prev.proposal.cmd !== cmd ? prev.proposal : null;
  return tidy(checks, repo, cmd === null ? { cmd: null, by: null, at: null, proposal } : { cmd, by, at, proposal });
}
// a session's word: shown on the board, never run until the owner takes it
export function proposeCheck(checks: RepoChecks, repo: string, cmd: string, by: string, at: number): RepoChecks {
  const prev = checks[repo] ?? { cmd: null, by: null, at: null, proposal: null };
  return tidy(checks, repo, { ...prev, proposal: prev.cmd === cmd ? null : { cmd, by, at } });
}
export const confirmedCheck = (checks: RepoChecks, repo: string): string | null => checks[repo]?.cmd ?? null;

// fleet.json → checks, every value judged again on the way in; what fails is named and dropped
export function readRepoChecks(raw: unknown): { checks: RepoChecks; dropped: string[] } {
  const out: Record<string, RepoCheck> = {}, dropped: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { checks: out, dropped };
  for (const [repo, v] of Object.entries(raw as Record<string, unknown>)) {
    const r = v as Partial<Record<keyof RepoCheck, unknown>> | null;
    const cmd = typeof r?.cmd === "string" && !checkCmdProblem(r.cmd) ? r.cmd : null;
    const p = r?.proposal as Partial<Record<keyof CheckProposal, unknown>> | null | undefined;
    const proposal = p && typeof p.cmd === "string" && !checkCmdProblem(p.cmd) && typeof p.by === "string" && typeof p.at === "number"
      ? { cmd: p.cmd, by: p.by, at: p.at } : null;
    if (!repo.startsWith("/") || (cmd === null && proposal === null)) { dropped.push(repo); continue; }
    out[repo] = { cmd, by: cmd !== null && typeof r?.by === "string" ? r.by : null, at: cmd !== null && typeof r?.at === "number" ? r.at : null, proposal };
  }
  return { checks: out, dropped };
}

// the board's view of a repo's check: which way it checks, the command and what a session proposed
export interface RepoCheckView { way: "merge-check" | "command" | "none"; cmd: string | null; by: string | null; at: number | null;
  proposal: CheckProposal | null }
export function repoCheckView(checks: RepoChecks, repo: string, ownMergeCheck: boolean): RepoCheckView {
  const c = checks[repo];
  return { way: ownMergeCheck ? "merge-check" : c?.cmd ? "command" : "none", cmd: ownMergeCheck ? null : c?.cmd ?? null,
    by: ownMergeCheck ? null : c?.by ?? null, at: ownMergeCheck ? null : c?.at ?? null, proposal: ownMergeCheck ? null : c?.proposal ?? null };
}
