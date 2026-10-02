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
const state = {
  sock, token, slots, tasks: clean(original.tasks ?? []), programs: clean(original.programs ?? []),
  fleetReports: clean(original.fleetReports ?? []), attentionRequests: clean(original.attentionRequests ?? []),
  dispatch: false, autosOn: false,
};
writeFileSync(`${dir}/fleet.json`, JSON.stringify(state, null, 2), { mode: 0o600 });
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
      rows.push(JSON.stringify(clean(row)));
    }
  }
  writeFileSync(`${dir}/${name}`, rows.join("\n") + (rows.length ? "\n" : ""), { mode: 0o600 });
}
console.log(`snapshot planted: ${state.tasks.length} tasks, ${state.programs.length} programs, ${Object.keys(slots).length} slots`);
