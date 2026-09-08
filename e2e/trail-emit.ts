// The per-check trail: one durable, structured row per check() call.
//
// WHY. check() (harness.ts) is a single choke point that builds ~870 structured results per run
// — name, pass/fail, detail — pushes formatted STRINGS into an array, prints them, and throws
// the structure away. Every run, every lane, ~20 times a day. So "is this check flaky?" is
// answered by a seven-minute same-tree re-run (docs/verify-tiering.md §11.7) instead of a query,
// a red post-land audit row cannot name which checks failed, and nobody can see which checks are
// slow. Fleet records conclusions and discards observations; conclusions rot, observations do not
// (docs/knowledge-currency.md §4-5a). This module keeps the observations.
//
// WHERE, and why not next to the run: e2e-isolated.sh `rm -rf`s its instance dir on SUCCESS, so
// a trail written inside it would vanish on exactly the GREEN runs — the baseline that makes a
// red one legible. The trail is therefore resolved OUTSIDE the instance dir, next to the main
// checkout's other append-only ledgers (audit.jsonl, post-land-audits.jsonl, …). Resolved here,
// inside the harness, so no wrapper needs changing. FLEET_E2E_TRAIL_DIR overrides the location;
// setting it to the empty string disables the trail.
//
// ONE FILE PER RUN, not one appended ledger: three suites can run at once from three lanes, and
// appends from separate processes can interleave into torn lines. A directory of run files has
// exactly one writer per file — no locking, no torn rows, and a killed run keeps what it wrote.
//
// This module writes nothing on import: the file is opened lazily on the first row, so a run
// that emits no checks leaves no empty file behind.
import { spawnSync } from "node:child_process";
import { mkdirSync, openSync, readlinkSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

// same directory expression as harness.ts's ROOT — deliberately re-derived rather than imported,
// because harness.ts imports THIS module and a cycle would run into its top-level await
const ROOT = resolve(import.meta.dir, "..");

const git = (cwd: string, ...args: string[]): string | null => {
  const p = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  return p.status === 0 ? p.stdout.trim() : null;
};

// THREE ANSWERS, NOT TWO. `isWorkTree` returning false folded "this directory is not a work tree"
// together with "git could not be asked at all", and those are not the same fact: the first
// describes the environment correctly, the second means the probe never measured anything. The
// post-land audit is the live instance of the first — its source is a `git archive` extract with
// no `.git` (server.ts#snapshotIntegrationTree builds a git context ONLY for the proportional
// short chain), so `rev-parse --is-inside-work-tree` exits 128 there. Measured 2026-09-08 on a
// stand-in built the same way: the pointer home reads fine, the rev-parse is what says no.
export type WorkTreeVerdict = "yes" | "no" | "git-unavailable";

// How ROOT's `node_modules` answered. The pointer home is the ONLY way a staged instance can name
// the tree under test, so "there is none" (a direct checkout) and "there is one and it is broken"
// (a staged instance whose link is a real directory, or unreadable) must not collapse into one
// word — the second would otherwise read as a direct-checkout run and blame ROOT.
export type PointerState = "symlink" | "absent" | `unreadable:${string}`;

export interface SourceTreeProbe {
  /** the tree under test, or null when none could be named */
  tree: string | null;
  /** the single directory that was asked */
  candidate: string;
  /** whose answer was consulted: the instance's pointer home, or ROOT itself */
  via: "pointer" | "root";
  /** why `tree` is null — null exactly when it is not */
  why: "not-a-work-tree" | "git-unavailable" | null;
}

// The tree under test. A node_modules symlink marks ROOT as a staged wrapper instance, whose own
// git identity belongs to the fixture and must never answer for the tree under test; only the
// symlink target may answer. Without that symlink this is a direct checkout run and ROOT answers.
export const probeSourceTree = (
  root: string,
  linkedNodeModules: string | null,
  verdict: (candidate: string) => WorkTreeVerdict,
): SourceTreeProbe => {
  const via = linkedNodeModules === null ? "root" : "pointer";
  const candidate = linkedNodeModules === null ? root : dirname(linkedNodeModules);
  const v = verdict(candidate);
  return {
    tree: v === "yes" ? candidate : null,
    candidate,
    via,
    why: v === "yes" ? null : v === "git-unavailable" ? "git-unavailable" : "not-a-work-tree",
  };
};

// the boolean face of the same probe, for the caller that wants the tree and not the verdict union
export const resolveSourceTree = (
  root: string,
  linkedNodeModules: string | null,
  isWorkTree: (candidate: string) => boolean,
): string | null =>
  probeSourceTree(root, linkedNodeModules, (c) => (isWorkTree(c) ? "yes" : "no")).tree;

// the classification, split off the spawn so all three answers are reachable without a box that
// happens to be missing a git. `status === null` is the binary never having RUN (ENOENT, or killed
// by a signal); every other exit is git's own answer about the directory, and `false` on exit 0 is
// a real answer too (a bare repo). Reading the first as "no" reports a missing git as a
// correctly-described non-repository — the fold this type exists to undo.
export const workTreeVerdictOf = (status: number | null, spawnFailed: boolean, stdout: string): WorkTreeVerdict =>
  spawnFailed || status === null ? "git-unavailable"
    : status === 0 && stdout.trim() === "true" ? "yes" : "no";

export const gitWorkTreeVerdict = (cwd: string): WorkTreeVerdict => {
  const p = spawnSync("git", ["-C", cwd, "rev-parse", "--is-inside-work-tree"], { encoding: "utf8" });
  return workTreeVerdictOf(p.status, !!p.error, p.stdout ?? "");
};

const pointerHome = (): { link: string | null; state: PointerState } => {
  try {
    return { link: readlinkSync(`${ROOT}/node_modules`), state: "symlink" };
  } catch (e) {
    const code = (e as { code?: string }).code ?? "unknown";
    return { link: null, state: code === "ENOENT" ? "absent" : `unreadable:${code}` };
  }
};

const POINTER = pointerHome();
export const TRAIL_SOURCE: SourceTreeProbe = probeSourceTree(ROOT, POINTER.link, gitWorkTreeVerdict);
export const TRAIL_POINTER: PointerState = POINTER.state;
const SRC = TRAIL_SOURCE.tree;

export const TRAIL_SCHEMA = 1;
// the detail string is the only unbounded field in a row — a check is free to hand check() a
// whole transcript. Capped, with the marker below appended so a reader can tell.
export const TRAIL_DETAIL_MAX = 2000;
export const TRAIL_TRUNCATED = "…[truncated]";

export const TRAIL_SUITE = process.env.FLEET_E2E_SUITE ?? "isolated";
export const TRAIL_TREE = SRC ? git(SRC, "rev-parse", "HEAD") : null;
// A sha alone is not a tree identity: two runs on the same sha with different uncommitted work
// are different code, and that is exactly the distinction a flake query turns on. null when no
// tree was resolvable at all (then `tree` is null too and the row claims nothing).
export const TRAIL_DIRTY = SRC && TRAIL_TREE ? (git(SRC, "status", "--porcelain") ?? "") !== "" : null;

// WHY A ROW CLAIMS NOTHING — the other half of `tree:null`, and the reason this module now keeps a
// probe instead of a boolean. `tree:null` is LEGITIMATE (a post-land audit measures a tree that is
// not a repository, docs/e2e-trail.md §7) and must never be red; but a reader of an anonymous trail
// file could not tell that correctly-described run from a broken pointer home or a missing git,
// and an anonymous row can never serve as flake evidence (trailstats: `unknownRows`). So the loss
// is NAMED rather than removed. Non-null exactly when TRAIL_TREE is null: one statement, two halves.
export const TRAIL_TREE_WHY: string | null = TRAIL_TREE !== null ? null
  : (SRC === null
    ? `no source tree: via=${TRAIL_SOURCE.via} candidate=${TRAIL_SOURCE.candidate}`
      + ` why=${TRAIL_SOURCE.why} pointer=${TRAIL_POINTER}`
    : `source tree ${SRC} resolves but has no HEAD (an indexed snapshot with no commit)`
  ).slice(0, 300);

// a linked worktree's common dir is the MAIN checkout's .git, so every lane's runs land in ONE
// trail — which is what makes "has this check failed on trees that do not contain my change?"
// answerable at all. Only if no tree resolves does the trail fall back to a scratch dir.
const defaultDir = (): string => {
  const common = SRC ? git(SRC, "rev-parse", "--path-format=absolute", "--git-common-dir") : null;
  return common ? join(dirname(common), "e2e-trail") : join(tmpdir(), "fleet-e2e-trail");
};
const envDir = process.env.FLEET_E2E_TRAIL_DIR;
export const TRAIL_DIR = envDir === "" ? null : (envDir ?? defaultDir());

const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
export const TRAIL_RUN = `${TRAIL_SUITE}-${stamp}-${process.pid}`;
export const trailFile = TRAIL_DIR ? join(TRAIL_DIR, `${TRAIL_RUN}.jsonl`) : null;

export interface TrailRow {
  v: number;
  run: string;
  suite: string;
  tree: string | null;
  dirty?: boolean;
  // present exactly when `tree` is null: the reason no tree could be named. A row that claims
  // nothing now says why it claims nothing, in the row itself — a trail file is read long after
  // the tail that produced it is gone.
  treeWhy?: string;
  check: string;
  ok: boolean;
  // NOT the check's own runtime: check() is handed an already-computed boolean, so the only
  // truthful measurement available at the choke point is the wall clock since the previous check
  // returned — the cost of getting from there to here. Named for what it is; a field called "ms"
  // would be read as a per-check duration and would be a wrong number.
  msSincePrev: number;
  ts: number;
  detail?: string;
}

export const trailRow = (check: string, ok: boolean, detail: string, msSincePrev: number, ts: number): TrailRow => ({
  v: TRAIL_SCHEMA,
  run: TRAIL_RUN,
  suite: TRAIL_SUITE,
  tree: TRAIL_TREE,
  ...(TRAIL_DIRTY === null ? {} : { dirty: TRAIL_DIRTY }),
  ...(TRAIL_TREE_WHY === null ? {} : { treeWhy: TRAIL_TREE_WHY }),
  check,
  ok,
  msSincePrev,
  ts,
  ...(!ok && detail
    ? { detail: detail.length > TRAIL_DETAIL_MAX ? detail.slice(0, TRAIL_DETAIL_MAX) + TRAIL_TRUNCATED : detail }
    : {}),
});

let fd: number | null = null;
let stopped = false;

// The trail is an observation sink hanging off the suite's choke point: it must never change a
// run's outcome. A write that fails stops the trail for the rest of the run instead of throwing
// — the loss is visible as the missing/short file, which e2e/trail.ts asserts on.
export function writeTrailRow(check: string, ok: boolean, detail: string, msSincePrev: number, ts: number): void {
  if (stopped || !trailFile) return;
  try {
    if (fd === null) {
      mkdirSync(dirname(trailFile), { recursive: true });
      fd = openSync(trailFile, "a");
    }
    writeSync(fd, `${JSON.stringify(trailRow(check, ok, detail, msSincePrev, ts))}\n`);
  } catch {
    stopped = true;
  }
}
