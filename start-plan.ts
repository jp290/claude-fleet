// Deterministic, read-only START PLAN — what the dispatcher WOULD start next, and what each row passed.
//
// Schnitt 1 of docs/messungen/2026-09-13-queue-pipeline-system-entwurf.md §5: the land waves
// (task-land-waves.ts#projectLandWaves) are read in their own order and each wave is given ONE
// `next` — the first reason it would not start, or "now". Order, collision and the lane caps are
// read as one computation (§4 F4) instead of three separate deciders. Nothing here dispatches,
// releases or writes. Since Schnitt 2 server.ts#tickDispatch walks this plan in its order instead of
// the oldest queued row, and GET /api/start-plan shows the owner the same object the tick reads —
// one projection, never a second one for the board (pinned in e2e/pins.ts).
//
// Every wave also carries its rows' `checks`, straight off the card and the row's provenance
// (owner 2026-09-13: "sicherstellen, dass das, was dann startet, geprüft wird oder wurde"), and the
// `release` verdict read from them under the row's program policy (Schnitt 3, releaseVerdict). No
// new check is invented; the card already knows these facts.
//
// Pure like its sibling. The CLI at the bottom reaches the filesystem only inside `import.meta.main`.
import { rangesCollide, LAND_WAVE_BUDGET_DEFAULT, type LandWaveClass, type LandWaveProjection,
  type LandWaveReasonAgainst, type LandWaveUnresolved } from "./task-land-waves";
import { isTaskCardSize, type TaskCardSize, type TaskWaveRange } from "./task-waves";
import { laneHunkDiffArgs, laneHunkRanges } from "./land-collision-stats";

export interface StartPlanChecks {
  // null = the row has no card at all — nobody read it, which is not the same fact as a refused card
  cardValid: boolean | null;
  surfaceValid: boolean | null;
  done: string | null;
  verify: string | null;
  size: TaskCardSize | null;
  filedBy: string;
  gaps: string[];
  // an `[idee scout-*]` sketch is never started directly (rulebook), whatever its card says
  scout: boolean;
  // the paths the card BACKS — its tracked files plus the files it creates, each one checked by the
  // validator; null = no card. A path that failed its check is not in here, it is a `surface.*` gap.
  cardFiles: number | null;
  // the brief was rewritten after the card was read, so the card speaks about an older text
  cardStale: boolean;
}

export interface StartPlanCardFacts {
  valid?: unknown; surfaceValid?: unknown; done?: unknown; verify?: unknown; size?: unknown; gaps?: unknown;
  at?: unknown; surface?: { files?: unknown; creates?: unknown } | null;
}

/** The checks a row carries, read off its card and its source — the one reader for server and CLI. */
export function startPlanChecks(row: { text: string; source: string; card?: StartPlanCardFacts | null; briefAt?: number | null }): StartPlanChecks {
  const card = row.card ?? null;
  const text1 = (v: unknown): string | null => typeof v === "string" && v.trim() ? v.trim() : null;
  return {
    cardValid: card ? card.valid === true : null,
    surfaceValid: card ? card.surfaceValid === true : null,
    done: card ? text1(card.done) : null,
    verify: card ? text1(card.verify) : null,
    size: card && isTaskCardSize(card.size) ? card.size : null,
    filedBy: row.source,
    gaps: card && Array.isArray(card.gaps) ? card.gaps.filter((g): g is string => typeof g === "string") : [],
    scout: /\[idee scout-/.test(row.text),
    cardFiles: card ? startPlanCardPaths(card).length : null,
    cardStale: !!card && typeof card.at === "number" && typeof row.briefAt === "number" && row.briefAt > card.at,
  };
}

/**
 * The paths a card backs, for the COLLISION reading of a row a policy may start: its files (only a
 * validated path is stored) and the files it creates. A row whose card has a `surface.*` gap on
 * files is never released by `card-valid`, so what this returns for it is never what starts it.
 */
export function startPlanCardPaths(card: StartPlanCardFacts | null): string[] {
  const list = (v: unknown): string[] => Array.isArray(v) ? v.filter((e): e is string => typeof e === "string") : [];
  return card ? [...list(card.surface?.files), ...list(card.surface?.creates)] : [];
}

// WHO DECIDED THAT A ROW MAY START — a PROGRAM's policy, set by the owner (server.ts, the release
// door). `manual` is the fleet before Schnitt 3 and every program's default: the owner's or a MAIN's
// release IS the check, so a queued row starts whatever its card says and a pending one never does.
// `card-valid` also starts a PENDING row whose card carries what an unattended start cannot do
// without; `all` starts every pending row. A queued row is released under every policy, a held row
// under none, and an `[idee scout-*]` sketch is never started by a policy at all.
export type StartPlanRelease = "manual" | "card-valid" | "all";
export const START_PLAN_RELEASES: readonly StartPlanRelease[] = ["manual", "card-valid", "all"];

export type StartPlanReleaseVerdict =
  | { released: true; by: "release" | "policy"; hints: string[] }
  // `why: null` = nothing to say on the row: a pending row under `manual` waits for a release, as it always did
  | { released: false; why: string | null };

// The gaps an unattended start cannot do without (owner 2026-09-13: "was startet, muss geprueft
// sein" — and "ich mache mir Sorgen, ob es zu streng wird"). HARD is only what safety rests on: a
// done sentence, a verify path, and files the tree backs, because the plan reads them for collisions.
// Every other gap — no size (weighs mittel), an unresolved symbol, a role field (default spawn), a
// goal or an `after` id the validator refused — starts and is named as a hint in the start note.
const HARD_GAP = /^(?:done|answer|verify|surface\.files|surface\.creates):/;
const clip = (s: string, n: number): string => s.length > n ? `${s.slice(0, n - 1)}…` : s;

/** Is this row released, and by what? Pure over the row's status, its program's policy, a hold and its checks. */
export function releaseVerdict(row: { status: string; checks: StartPlanChecks; release?: StartPlanRelease; held?: boolean }): StartPlanReleaseVerdict {
  if (row.held) return { released: false, why: "held by its MAIN — a release lifts the hold" };
  if (row.status === "queued") return { released: true, by: "release", hints: [] };
  const policy = row.release ?? "manual";
  if (row.status !== "pending" || policy === "manual") return { released: false, why: null };
  const c = row.checks;
  if (c.scout) return { released: false, why: "an [idee scout-*] sketch is never started by a policy" };
  if (policy === "all") return { released: true, by: "policy", hints: [] };
  const gap = (re: RegExp): string => { const g = c.gaps.find((x) => re.test(x)); return g ? ` (${clip(g, 90)})` : ""; };
  const hard: string[] = [];
  if (c.filedBy !== "owner" && c.filedBy !== "main")
    hard.push(`filed by ${c.filedBy} — only the owner's rows and its MAIN's start by policy`);
  if (c.cardValid === null) hard.push("no card yet");
  else {
    if (!c.done || c.gaps.some((g) => /^(?:done|answer):/.test(g))) hard.push(`no done criterion${gap(/^(?:done|answer):/)}`);
    if (!c.verify || c.gaps.some((g) => g.startsWith("verify:"))) hard.push(`no verify path${gap(/^verify:/)}`);
    if (!c.cardFiles || c.gaps.some((g) => /^surface\.(?:files|creates):/.test(g)))
      hard.push(`files not backed by the tree${gap(/^surface\.(?:files|creates):/)}`);
    if (c.cardStale) hard.push("the brief changed after the card was read");
  }
  if (hard.length) return { released: false, why: `card-valid needs ${hard.join("; ")}` };
  const hints = [...(c.size ? [] : ["no size (weighs mittel)"]),
    ...c.gaps.filter((g) => !HARD_GAP.test(g)).map((g) => clip(g, 90))];
  return { released: true, by: "policy", hints };
}

// An open row the projection may name. `files: null` = no surface known — it makes no collision edge
// (see collision below) and is held by the lane caps alone, never read as "touches nothing".
export interface StartPlanRow {
  id: string; status: string; programId: string | null;
  files: readonly string[] | null; ranges: readonly TaskWaveRange[] | null;
  after: readonly string[]; checks: StartPlanChecks;
  // the row's PROGRAM policy (absent = manual) and whether its MAIN holds it — releaseVerdict's inputs
  release?: StartPlanRelease; held?: boolean;
  // the variant GROUP this row is one variant of (server/types.ts#Task.variantOf); absent = no group
  variantOf?: string;
}
export interface StartPlanLane {
  slot: number; repo: string | null; programId: string | null;
  files: readonly string[] | null; ranges: readonly TaskWaveRange[] | null;
  // the variant group of the row this lane runs, if it runs one — absent otherwise
  variantOf?: string;
  // what the lane REALLY changed since its fork (land-collision-stats.ts#laneHunkRanges): file → its
  // NEW-side hunks as ranges. A file not in here is not changed yet, `[]` changed without line hunks
  // (binary, mode); absent = not read (no fork sha, the diff failed). See collision for the order.
  hunks?: Readonly<Record<string, readonly TaskWaveRange[]>>;
}
export interface StartPlanCap { max: number; source: "default" | "repo" }
export interface StartPlanRepoCaps extends StartPlanCap {
  // the per-program cap this repo computes for each program (server.ts#programDispatchCap); a
  // program absent here gets the repo's own number, which is what that formula yields without an
  // env value and without a grant
  programs: Readonly<Record<string, number>>;
}

export interface StartPlanInput {
  projection: LandWaveProjection;
  rows: readonly StartPlanRow[];
  // EVERY queue row's status, for `after` — a target that is not a row of the queue is not done
  statuses: Readonly<Record<string, string>>;
  lanes: readonly StartPlanLane[];
  // keyed by the projection's repo string; a repo without an entry is never "now"
  caps: Readonly<Record<string, StartPlanRepoCaps>>;
}

export type StartPlanNext =
  | "now"
  | { after: string }
  | { unreleased: string[] }
  | { unchecked: string[] }
  | { collides: { slot?: number; row?: string; file: string; symbol?: string } }
  | { cap: string };

export interface StartPlanWave {
  ids: string[];
  klasse: LandWaveClass;
  units: number;
  reasonAgainst: LandWaveReasonAgainst | null;
  next: StartPlanNext;
  rows: { id: string; status: string; checks: StartPlanChecks | null; release: StartPlanReleaseVerdict | null }[];
}
export interface StartPlanRepo { repo: string; lanes: number; cap: StartPlanCap | null; waves: StartPlanWave[] }
export interface StartPlan {
  version: 1; budget: number; repos: StartPlanRepo[]; unresolved: LandWaveUnresolved[];
}

interface Surface { files: readonly string[] | null; ranges: readonly TaskWaveRange[] | null; hunks?: StartPlanLane["hunks"] }

// The ranges a surface holds on one file: its row ranges there; else, for a running lane, the hunks it
// already wrote there; else none — and none is rangesCollide's whole-file fallback. A named file the
// lane has not touched yet (or touched without line hunks) is UNKNOWN, never free.
const rangesOn = (s: Surface, file: string): readonly TaskWaveRange[] => {
  const own = (s.ranges ?? []).filter((r) => r.file === file);
  return own.length ? own : s.hunks?.[file] ?? [];
};

/**
 * Where two surfaces collide, or null. Per shared file the rule is task-land-waves.ts#rangesCollide
 * itself — no range on either side = collides — so a change to that fallback moves this plan too.
 * The card-surface guard of collidesOn is deliberately NOT applied: it may only SEPARATE rows for
 * bundling, and separating is the unsafe direction for a start.
 *
 * A WHOLE SURFACE NOBODY KNOWS IS NO EDGE (Schnitt 2, 2026-09-14). The edge is a SHARED file
 * (entwurf §4 F4 step 3, collidesOn's own shape); the unknown-range fallback above lives inside a
 * shared file. Schnitt 1 had widened it to "no files known = collides with everything", and as a
 * motor that is a new lane cap nobody decided: one hand-opened lane (it carries no row, so no
 * surface) held every released row of its repo, and so did any running row without files — on the
 * live fleet of 2026-09-14, slot 1's row with 0 files would have stopped all of claude-fleet. Rows
 * whose surface is unknown are bounded by the two lane caps, exactly as before the plan read them.
 *
 * A RUNNING LANE COLLIDES WITH ITS REAL HUNKS (2026-09-15, rangesOn). A lane whose row names
 * server.ts without a range held every row on server.ts for its whole life; scored on 34 lands with
 * forkSha, the file fallback was P 0.20 R 1.00 and R4 on real hunks P 0.60 R 1.00. Hunks are in the
 * lane's coordinates, row ranges in main's — the ±LAND_WAVE_RANGE_GAP of R4 is the only slack, and n
 * is small, so hunks only replace the fallback on a file the lane already changed.
 */
function collision(a: Surface, b: Surface): { file: string; symbol?: string } | null {
  if (!a.files?.length || !b.files?.length) return null;
  for (const file of a.files) {
    if (!b.files.includes(file)) continue;
    const ra = rangesOn(a, file);
    const rb = rangesOn(b, file);
    if (!rangesCollide(ra, rb)) continue;
    const symbol = ra.find((x) => rb.some((y) => rangesCollide([x], [y])))?.symbol;
    return { file, ...(symbol ? { symbol } : {}) };
  }
  return null;
}

const basenameOf = (repo: string): string => repo.replace(/\/+$/, "").split("/").pop() || repo;

/** Give every projected wave its `next`, repo by repo, in the projection's own order. */
export function projectStartPlan(input: StartPlanInput): StartPlan {
  const rowById = new Map(input.rows.map((row) => [row.id, row]));
  // A "now" wave takes a lane, so it counts against the caps of every wave after it — across repos
  // for the program cap, because tickDispatch counts a program's lanes machine-wide.
  const nowByProgram = new Map<string, number>();
  const repos: StartPlanRepo[] = input.projection.repos.map(({ repo, waves }) => {
    const repoLanes = input.lanes.filter((lane) => lane.repo === repo);
    const caps = input.caps[repo] ?? null;
    let nowInRepo = 0;
    // earlier waves that hold their files against later ones (see the `claims` rule below)
    const claimed: { row: StartPlanRow }[] = [];
    const out = waves.map((wave): StartPlanWave => {
      const members = wave.ids.map((id) => rowById.get(id));
      const known = members.filter((row): row is StartPlanRow => !!row);
      const next = ((): StartPlanNext => {
        // A projected id the caller handed no row for has no status, no surface and no checks:
        // every reading below would be a guess, so the wave is refused as unchecked.
        if (known.length !== members.length)
          return { unchecked: wave.ids.filter((id) => !rowById.has(id)) };
        // 1. AFTER is hard: the target must be done. An id inside the same wave is ordered by the lane.
        for (const row of known) for (const id of row.after)
          if (!wave.ids.includes(id) && input.statuses[id] !== "done") return { after: id };
        // 2. A release decides — the owner's, a MAIN's, or the program's policy (releaseVerdict);
        //    a partner that is not released holds the whole wave.
        const unreleased = known.filter((row) => !releaseVerdict(row).released).map((row) => row.id);
        if (unreleased.length) return { unreleased };
        // 3. Collision with running work first, then with an earlier wave that is still in line.
        //    A VARIANT never collides with its own group (E4): the n variants of one group share every
        //    file by construction and are MEANT to run at once — only one of them will ever land. A
        //    lane or row of any other group, or of none, still holds it exactly as before.
        const sameGroup = (row: StartPlanRow, other: { variantOf?: string }): boolean =>
          !!row.variantOf && row.variantOf === other.variantOf;
        for (const row of known) for (const lane of repoLanes) {
          if (sameGroup(row, lane)) continue;
          const hit = collision(row, lane);
          if (hit) return { collides: { slot: lane.slot, ...hit } };
        }
        for (const row of known) for (const earlier of claimed) {
          if (sameGroup(row, earlier.row)) continue;
          const hit = collision(row, earlier.row);
          if (hit) return { collides: { row: earlier.row.id, ...hit } };
        }
        // 4. The two lane caps, in tickDispatch's order and with its sentences.
        if (!caps) return { cap: `no lane cap known for ${basenameOf(repo)}` };
        const lanes = repoLanes.length + nowInRepo;
        if (lanes >= caps.max)
          return { cap: `${lanes}/${caps.max} lanes busy in ${basenameOf(repo)} (${caps.source === "repo" ? "repo cap" : "machine default"})` };
        const programId = known[0]?.programId ?? null;
        if (programId) {
          const programCap = caps.programs[programId] ?? caps.max;
          const programLanes = input.lanes.filter((lane) => lane.programId === programId).length
            + (nowByProgram.get(programId) ?? 0);
          if (programLanes >= programCap)
            return { cap: `${programLanes}/${programCap} lanes busy in program ${programId}` };
        }
        return "now";
      })();
      if (next === "now") {
        nowInRepo++;
        const programId = known[0]?.programId;
        if (programId) nowByProgram.set(programId, (nowByProgram.get(programId) ?? 0) + 1);
      }
      // A wave CLAIMS its files against later waves unless it is not released (no release, a card its
      // program's policy refuses, a hold) or was handed no row: such a wave does not start until someone
      // acts, and letting it hold released rows behind it would be the one-row-holds-the-queue stall
      // tickDispatch's skip-not-return comments describe. Everything else — now, after, collides, cap — is in line.
      const claims = typeof next === "string" || !("unreleased" in next || "unchecked" in next);
      if (claims) for (const row of known) claimed.push({ row });
      return {
        ids: [...wave.ids], klasse: wave.klasse, units: wave.units, reasonAgainst: wave.reasonAgainst, next,
        rows: wave.ids.map((id) => {
          const row = rowById.get(id);
          return { id, status: row?.status ?? "unknown", checks: row?.checks ?? null, release: row ? releaseVerdict(row) : null };
        }),
      };
    });
    return { repo, lanes: repoLanes.length, cap: caps ? { max: caps.max, source: caps.source } : null, waves: out };
  });
  return { version: 1, budget: input.projection.budget, repos,
    unresolved: [...input.projection.unresolved] };
}

/**
 * The wait-note a queued row carries for its wave's `next` — the normalized sentences of §4 F4
 * step 5, one per reason. `cap` repeats the plan's own sentence; the tick writes its live cap notes
 * instead, because the caps it counts right before a start are the ones that hold.
 */
export function startPlanWaitNote(next: Exclude<StartPlanNext, "now">): string {
  if ("after" in next) return `waiting: after ${next.after} not landed`;
  if ("unreleased" in next) return `waiting: wave partner ${next.unreleased.join(", ")} is not released`;
  if ("unchecked" in next) return `waiting: ${next.unchecked.join(", ")} not checked — the plan was handed no row for it`;
  if ("collides" in next) {
    const { slot, row, file, symbol } = next.collides;
    return `waiting: collides with ${slot !== undefined ? `lane ${slot}` : `row ${row} ahead in the plan`} on ${file}${symbol ? `#${symbol}` : ""}`;
  }
  return `waiting: ${next.cap}`;
}

// --- CLI: the same projector over a state file. A lane has no fleet.json; the MAIN runs it in the
// main checkout and compares it with GET /api/start-plan:
//   bun start-plan.ts --state fleet.json [--default-repo REPO] [--budget N]
const argAfter = (name: string): string | null => {
  const at = process.argv.indexOf(name);
  const value = at >= 0 ? process.argv[at + 1] : undefined;
  return typeof value === "string" ? value : null;
};

interface StateTask {
  id?: unknown; kind?: unknown; text?: unknown; source?: unknown; status?: unknown; slot?: unknown; programId?: unknown;
  card?: (StartPlanCardFacts & { after?: unknown }) | null; brief?: { at?: unknown } | null; hold?: unknown;
  variantOf?: unknown; variants?: unknown;
}
interface StateSlot { cwd?: unknown; worktree?: { repo?: unknown; baseSha?: unknown } | null; programId?: unknown }

async function cli(): Promise<void> {
  const statePath = argAfter("--state");
  if (!statePath) throw new Error("usage: bun start-plan.ts --state FILE [--default-repo REPO] [--budget N]");
  const defaultRepo = argAfter("--default-repo") ?? process.env.FLEET_DISPATCH_REPO ?? null;
  const budgetEnv = Number(process.env.FLEET_LAND_WAVE_BUDGET);
  const budget = argAfter("--budget")
    ?? String(Number.isFinite(budgetEnv) && budgetEnv >= 1 ? Math.floor(budgetEnv) : LAND_WAVE_BUDGET_DEFAULT);
  const run = (script: string, extra: string[]): unknown => {
    const r = Bun.spawnSync(["bun", `${import.meta.dir}/${script}`, "--state", statePath,
      ...(defaultRepo ? ["--default-repo", defaultRepo] : []), ...extra], { stdout: "pipe", stderr: "pipe" });
    if (!r.success) throw new Error(`${script} failed: ${r.stderr.toString().trim() || `exit ${r.exitCode}`}`);
    return JSON.parse(r.stdout.toString());
  };
  // The waves and the surfaces are REUSED from their own CLIs, never re-derived here.
  const projection = run("task-land-waves.ts", ["--budget", budget]) as LandWaveProjection;
  const meta = run("task-metadata.ts", []) as {
    tasks?: Record<string, { files?: string[]; ranges?: TaskWaveRange[] | null }>;
  };
  const state = await Bun.file(statePath).json() as {
    tasks?: unknown; slots?: unknown; repoLaneCaps?: unknown; programs?: unknown;
  };
  const tasks = Array.isArray(state.tasks) ? state.tasks as StateTask[] : [];
  const strings = (v: unknown): string[] => Array.isArray(v) ? v.filter((e): e is string => typeof e === "string") : [];
  const { realpathSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const canon = (repo: string): string => { try { return realpathSync(resolve(repo)); } catch { return repo; } };

  // the program policies as server.ts#programReleasePolicy reads them: an ACTIVE program's record, else manual
  const policies = new Map<string, StartPlanRelease>();
  for (const p of Array.isArray(state.programs) ? state.programs as { id?: unknown; status?: unknown; release?: { policy?: unknown } }[] : [])
    if (typeof p.id === "string" && p.status === "active" && START_PLAN_RELEASES.includes(p.release?.policy as StartPlanRelease))
      policies.set(p.id, p.release?.policy as StartPlanRelease);
  const policyOf = (task: StateTask): StartPlanRelease =>
    typeof task.programId === "string" ? policies.get(task.programId) ?? "manual" : "manual";
  const surfaceOf = (task: StateTask): Surface => {
    const derived = typeof task.id === "string" ? meta.tasks?.[task.id] : undefined;
    const read = [...(derived?.files ?? []), ...(task.card?.surfaceValid === true ? strings(task.card.surface?.creates) : [])];
    const files = policyOf(task) === "manual" ? read : [...new Set([...read, ...startPlanCardPaths(task.card ?? null)])];
    return { files: files.length ? files : null, ranges: derived?.ranges ?? null };
  };
  const statuses: Record<string, string> = {};
  const rows: StartPlanRow[] = [];
  // A VARIANT reads its card, text and brief off its GROUP row, as server.ts#startPlanRowOf does: the
  // group is the one source every variant is briefed from, and a variant carries no reading of its own.
  const sourceOf = (task: StateTask): StateTask =>
    (typeof task.variantOf === "string" && tasks.find((t) => t.id === task.variantOf)) || task;
  for (const task of tasks) {
    if (typeof task.id !== "string") continue;
    const status = typeof task.status === "string" ? task.status : "";
    statuses[task.id] = status;
    if (task.kind !== "auftrag" || (status !== "pending" && status !== "queued") || Array.isArray(task.variants)) continue;
    const src = sourceOf(task);
    rows.push({ id: task.id, status, programId: typeof task.programId === "string" && task.programId ? task.programId : null,
      ...surfaceOf(task), after: strings(src.card?.after),
      checks: startPlanChecks({ text: typeof src.text === "string" ? src.text : "",
        source: typeof task.source === "string" ? task.source : "unknown", card: src.card ?? null,
        briefAt: typeof src.brief?.at === "number" ? src.brief.at : null }),
      ...(policyOf(task) !== "manual" ? { release: policyOf(task) } : {}),
      ...(task.hold ? { held: true } : {}),
      ...(typeof task.variantOf === "string" && task.variantOf ? { variantOf: task.variantOf } : {}) });
  }

  // a lane's repo is stored canonical; map it back onto the projection's own repo string
  const projectionRepoFor = new Map(projection.repos.map((r) => [canon(r.repo), r.repo]));
  const slots = state.slots && typeof state.slots === "object" ? state.slots as Record<string, StateSlot> : {};
  const lanes: StartPlanLane[] = [];
  for (const [id, slot] of Object.entries(slots)) {
    const laneRepo = typeof slot.worktree?.repo === "string" ? slot.worktree.repo : null;
    const programId = typeof slot.programId === "string" && slot.programId ? slot.programId : null;
    if (!laneRepo && !programId) continue;
    const ownRows = tasks.filter((t) => t.slot === Number(id) && t.status === "sent");
    const own = ownRows.map(surfaceOf);
    const files = own.flatMap((s) => s.files ?? []);
    const variantOf = ownRows.map((t) => t.variantOf).find((v): v is string => typeof v === "string" && !!v);
    // the lane's real hunks, read here once per lane as server.ts#tickGit reads them per tick
    const forkSha = typeof slot.worktree?.baseSha === "string" && slot.worktree.baseSha ? slot.worktree.baseSha : null;
    const diff = forkSha && typeof slot.cwd === "string" && slot.cwd
      ? Bun.spawnSync(["git", "-C", slot.cwd, ...laneHunkDiffArgs(forkSha)],
        { stdout: "pipe", stderr: "pipe", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } })
      : null;
    lanes.push({ ...(diff?.success ? { hunks: laneHunkRanges(diff.stdout.toString()) } : {}), slot: Number(id), repo: laneRepo ? projectionRepoFor.get(canon(laneRepo)) ?? laneRepo : null, programId,
      // one row without a known surface makes the lane's surface unknown as a whole
      files: own.length && own.every((s) => s.files) ? files : null,
      ranges: own.some((s) => s.ranges) ? own.flatMap((s) => s.ranges ?? []) : null,
      ...(variantOf ? { variantOf } : {}) });
  }
  lanes.sort((a, b) => a.slot - b.slot);

  // the caps as server.ts#repoLaneCap and #programDispatchCap compute them, from this state and env
  const machineMax = Math.max(1, Number(process.env.FLEET_DISPATCH_MAX_LANES ?? 3) | 0);
  const perProgram = process.env.FLEET_DISPATCH_MAX_LANES_PER_PROGRAM
    ? Math.max(1, Number(process.env.FLEET_DISPATCH_MAX_LANES_PER_PROGRAM) | 0) : null;
  const repoCaps = state.repoLaneCaps && typeof state.repoLaneCaps === "object" ? state.repoLaneCaps as Record<string, unknown> : {};
  const grants = new Map<string, number>();
  for (const p of Array.isArray(state.programs) ? state.programs as { id?: unknown; status?: unknown; dispatch?: { on?: unknown; maxLanes?: unknown } }[] : [])
    if (typeof p.id === "string" && p.status === "active" && p.dispatch?.on === true && typeof p.dispatch.maxLanes === "number")
      grants.set(p.id, p.dispatch.maxLanes);
  const programIds = [...new Set(rows.map((r) => r.programId).filter((p): p is string => !!p))].sort();
  const caps: Record<string, StartPlanRepoCaps> = {};
  for (const { repo } of projection.repos) {
    const entry = repoCaps[canon(repo)];
    const cap: StartPlanCap = typeof entry === "number" ? { max: entry, source: "repo" } : { max: machineMax, source: "default" };
    const machine = perProgram ?? cap.max;
    caps[repo] = { ...cap, programs: Object.fromEntries(programIds.map((id) => [id, Math.min(grants.get(id) ?? machine, machine)])) };
  }

  process.stdout.write(`${JSON.stringify(projectStartPlan({ projection, rows, statuses, lanes, caps }))}\n`);
}

if (import.meta.main) {
  cli().catch((error: unknown) => {
    console.error(`start-plan: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  });
}
