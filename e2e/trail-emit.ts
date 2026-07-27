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

// The tree under test. Run through e2e-isolated.sh, ROOT is a throwaway copy with no .git of its
// own — but the wrapper symlinks node_modules back to the source checkout, and that link is the
// only pointer home from inside the copy. Run directly from a checkout, there is no symlink and
// ROOT itself is the tree. Symlink first: it is the exact answer when it exists.
const sourceTree = (): string | null => {
  const candidates: string[] = [];
  try {
    candidates.push(dirname(readlinkSync(`${ROOT}/node_modules`)));
  } catch {
    // no symlink → not a wrapper instance; ROOT below is the answer
  }
  candidates.push(ROOT);
  for (const c of candidates) if (git(c, "rev-parse", "--is-inside-work-tree") === "true") return c;
  return null;
};

const SRC = sourceTree();

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
