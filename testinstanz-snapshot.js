import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";

const dir = process.env.FLEET_TI_DIR;
const checkout = process.env.FLEET_TI_SRC;
const sock = process.env.FLEET_TI_SOCK;
const token = process.env.FLEET_TI_TOKEN;
if (!dir || !checkout || !sock || !token) throw new Error("snapshot needs the isolated instance environment");
const common = spawnSync("git", ["-C", checkout, "rev-parse", "--git-common-dir"], { encoding: "utf8" });
if (common.status !== 0) throw new Error("cannot locate the source git common directory");
const source = resolve(process.env.FLEET_TI_SNAPSHOT_SRC ?? dirname(resolve(checkout, common.stdout.trim())));
if (source === dir || source.startsWith(`${dir}/`)) throw new Error("snapshot source is the instance");
const original = JSON.parse(readFileSync(`${source}/fleet.json`, "utf8"));
const secrets = new Set();
const secretKeys = /^(token|selfToken|stewardToken|helperToken|secret|password|apiKey|authorization)$/i;
function collect(value, key = "") {
  if (typeof value === "string" && secretKeys.test(key) && value.length >= 8) secrets.add(value);
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) collect(v, k);
}
collect(original);
const envFile = `${source}/.env`;
if (existsSync(envFile)) for (const line of readFileSync(envFile, "utf8").split("\n")) {
  const value = line.match(/^[A-Za-z_][A-Za-z_0-9]*=(.*)$/)?.[1]?.replace(/^['"]|['"]$/g, "");
  if (value && value.length >= 8) secrets.add(value);
}
const hiddenKeys = /^(token|selfToken|stewardToken|helperToken|helperDevices|shares|secret|password|apiKey|authorization)$/i;
function clean(value, key = "") {
  if (hiddenKeys.test(key)) return undefined;
  if (typeof value === "string") {
    let out = value;
    for (const secret of secrets) out = out.replaceAll(secret, "[redacted]");
    if (/^(cwd|repo|path|root|worktree)$/.test(key) && out.startsWith("/")) return dir;
    return out;
  }
  if (Array.isArray(value)) return value.map((v) => clean(v)).filter((v) => v !== undefined);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .map(([k, v]) => [k, clean(v, k)]).filter(([, v]) => v !== undefined));
  return value;
}
const slots = Object.fromEntries(Object.entries(original.slots ?? {}).filter(([, s]) => s && typeof s.cwd === "string")
  .map(([id, s]) => [id, {
    cwd: dir, label: clean(s.label), openedAt: s.openedAt, mission: clean(s.mission),
    awaiting: s.awaiting, model: s.model, harness: s.harness, effort: s.effort,
    taskId: s.taskId, originId: s.originId, programId: s.programId,
    laneSuccessions: s.laneSuccessions, lineageId: s.lineageId,
  }]));
// THE CHECK AND LAND FACTS of the right tab: the lanes' local command jobs and preview offers ride
// along so GET /api/worktrees can read checks.local/preview and /api/sessions its suiteOffers. A
// projection, not a copy: `repo` stays the real path (workplaceCheckObservations matches the mirror
// repo by it), `cwd` points into the copy (a bundle built from it finds no git), and everything that
// names a helper machine or carries output is emptied — deviceId, bundle path, tail, trail,
// artifacts. The server's write fence (SNAPSHOT_MIRROR) refuses every claim and report anyway.
const realRepo = (value) => typeof value === "string" && value.startsWith("/") ? value : null;
function mirrorJob(value, key = "") {
  if (key === "deviceId") return "snapshot";
  if (key === "bundle") return typeof value === "string" ? "" : value;
  if (key === "tail" || key === "trail") return "";
  if (key === "artifacts") return [];
  if (key === "cwd") return dir;
  if (key === "repo" && realRepo(value)) return value;
  if (Array.isArray(value)) return value.map((v) => mirrorJob(v));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .filter(([k]) => !hiddenKeys.test(k)).map(([k, v]) => [k, mirrorJob(v, k)]));
  return typeof value === "string" ? clean(value) : value;
}
const jobs = (rows) => (Array.isArray(rows) ? rows : []).filter((j) => j && realRepo(j.repo)).map((j) => mirrorJob(j));
const state = {
  sock, token, slots, tasks: clean(original.tasks ?? []), programs: clean(original.programs ?? []),
  fleetReports: clean(original.fleetReports ?? []), attentionRequests: clean(original.attentionRequests ?? []),
  laneSuiteJobs: jobs(original.laneSuiteJobs), commandJobs: jobs(original.commandJobs),
  // the land verdicts per slot (checks.gate): the server restores a row only for a slot whose
  // mirrored session names the same branch (server.ts#snapshotLaneOf), since slot.worktree is gone
  merges: clean(Object.fromEntries(Object.entries(original.merges ?? {}).filter(([id]) => id in slots))),
  mergeParked: clean(original.mergeParked ?? {}),
  dispatch: false, autosOn: false,
};
writeFileSync(`${dir}/fleet.json`, JSON.stringify(state, null, 2), { mode: 0o600 });
const sourceCommon = spawnSync("git", ["-C", source, "rev-parse", "--git-common-dir"], { encoding: "utf8" });
if (sourceCommon.status !== 0) throw new Error("snapshot state source is not a git repository");
const repo = dirname(resolve(source, sourceCommon.stdout.trim()));
const sessions = Object.entries(original.slots ?? {}).flatMap(([slot, s]) =>
  s && typeof s.cwd === "string" && s.cwd.startsWith("/") && Number.isFinite(s.openedAt)
    ? [{ slot: Number(slot), openedAt: s.openedAt, path: clean(s.cwd),
      taskId: typeof s.taskId === "string" ? clean(s.taskId) : null,
      branch: typeof s.worktree?.branch === "string" ? clean(s.worktree.branch) : null,
      base: typeof s.worktree?.base === "string" ? clean(s.worktree.base) : null,
      baseSha: typeof s.worktree?.baseSha === "string" && /^[0-9a-f]{40}$/.test(s.worktree.baseSha) ? s.worktree.baseSha : null }] : []);
writeFileSync(`${dir}/.testinstanz.mirror.json`, JSON.stringify({ repo, sessions }), { mode: 0o600 });
const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
for (const name of ["lane-outcomes.jsonl", "post-land-audits.jsonl", "audit.jsonl"]) {
  const rows = [];
  for (const suffix of [".1", ""]) {
    const file = `${source}/${name}${suffix}`;
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!line) continue;
      let row;
      try { row = JSON.parse(line); } catch { continue; }
      const when = row.ts ?? row.at ?? row.time;
      if (typeof when !== "number" || when < cutoff) continue;
      // `repo` stays the real path: the audit reader matches the mirror repo by it, and clean()
      // would otherwise fold it into the instance directory, where no audit can ever cover a lane
      const out = clean(row);
      if (realRepo(row.repo)) out.repo = row.repo;
      rows.push(JSON.stringify(out));
    }
  }
  writeFileSync(`${dir}/${name}`, rows.join("\n") + (rows.length ? "\n" : ""), { mode: 0o600 });
}
console.log(`snapshot planted: ${state.tasks.length} tasks, ${state.programs.length} programs, ${Object.keys(slots).length} slots`);
