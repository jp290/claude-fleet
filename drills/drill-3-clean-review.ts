// FIRE-DRILL #3 — ② clean-review, seeded-defect test.
//
// NOT an e2e check. It boots an isolated fleet instance with FLEET_CLEAN_REVIEW=shadow and
// NO reviewer stand-in, so server.ts:3500-3502 falls through to summaryViaSession(... MERGE_TOOLS ...)
// and the REAL model answers through the REAL prompt, parser and outcome-row write.
//
// It seeds a lane/main pair that rebases CLEANLY, passes the (stand-in) gate, and is semantically
// wrong together. Ground truth is sealed in the session scratchpad, outside this repo.
// The drill PRINTS the verdict; it does not assert pass/fail — adjudication is a human step.
import { spawnSync } from "node:child_process";

const IP = "127.0.0.1";
const PORT = Number(process.env.FLEET_PORT ?? 8790);
const SOCK = process.env.FLEET_SOCK ?? "fleetdrill";
if (SOCK === "claudefleet") throw new Error("refusing to run against the live socket");
const BASE = `http://${IP}:${PORT}`;
const stateFile = (await Bun.file(`${import.meta.dir}/fleet.json`).json()) as { token?: string };
const H = { "content-type": "application/json", authorization: `Bearer ${stateFile.token ?? ""}` };
const post = (p: string, b: unknown): Promise<Response> =>
  fetch(BASE + p, { method: "POST", headers: H, body: JSON.stringify(b) });
const get = (p: string): Promise<Response> => fetch(BASE + p, { headers: H });

const REPO = `${import.meta.dir}/drillrepo`;
const git = (cwd: string, ...a: string[]): string => spawnSync("git", ["-C", cwd, ...a]).stdout.toString();
const write = (p: string, s: string): Promise<number> => Bun.write(p, s);

// ---------------------------------------------------------------- fixture: the fork point
spawnSync("git", ["init", "-q", "-b", "main", REPO]);
for (const [k, v] of [["user.email", "d@d"], ["user.name", "d"], ["commit.gpgsign", "false"]]) {
  git(REPO, "config", k, v);
}
await write(`${REPO}/tsconfig.json`, JSON.stringify(
  { compilerOptions: { strict: true, noEmit: true, target: "esnext", module: "esnext", moduleResolution: "bundler" } }, null, 2) + "\n");

// policy.ts — the contract both sides depend on. At the fork point the threshold is MILLISECONDS.
await write(`${REPO}/src/policy.ts`, `export interface AutoRule {
  name: string;
  /** how long the pane must have been quiet before this rule may fire, in MILLISECONDS */
  idleThreshold: number;
}

export function isIdleEnough(rule: AutoRule, idleMs: number): boolean {
  return idleMs >= rule.idleThreshold;
}
`);
// NOTE: the presentation block below is padding with a purpose — the C1 control has the lane
// appending at the BOTTOM of this file while main edits the TOP. Without real distance between
// them git's 3-way merge would see overlapping context and CONFLICT, and a conflicted rebase
// never reaches ② at all (it is the clean path's reviewer). The control must stay clean.
await write(`${REPO}/src/rules.ts`, `import type { AutoRule } from "./policy";

export const RULES: AutoRule[] = [
  { name: "nudge", idleThreshold: 60_000 },
  { name: "sweep", idleThreshold: 900_000 },
];

// --- presentation helpers, kept beside the table so labels travel with it ---

export const RULE_LABELS: Record<string, string> = {
  nudge: "Nudge",
  sweep: "Sweep",
};

export function labelFor(name: string): string {
  return RULE_LABELS[name] ?? name;
}

export const RULE_ORDER: string[] = ["nudge", "sweep"];

export function sortRules(rules: AutoRule[]): AutoRule[] {
  return [...rules].sort((a, b) => RULE_ORDER.indexOf(a.name) - RULE_ORDER.indexOf(b.name));
}
`);
// state.ts — the persisted blob, second contract
await write(`${REPO}/src/state.ts`, `export interface Persisted { [k: string]: unknown }

export function loadFlags(raw: Persisted): { dispatch: boolean } {
  return { dispatch: raw.dispatch === true };
}

export function saveFlags(dispatch: boolean): Persisted {
  return { dispatch };
}
`);
git(REPO, "add", "-A");
git(REPO, "commit", "-qm", "initial rule and state plumbing");

// ---------------------------------------------------------------- the lane forks HERE
const ln = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
console.log(`lane: slot ${ln.slot}  branch ${ln.branch}`);

// LANE SIDE — additive files only, so the rebase is textually clean.
// D1 collision: a new rule table written against the MILLISECOND convention.
await write(`${ln.cwd}/src/extra-rules.ts`, `import type { AutoRule } from "./policy";

export const EXTRA_RULES: AutoRule[] = [
  { name: "digest", idleThreshold: 300_000 },
  { name: "reap", idleThreshold: 1_800_000 },
];
`);
// D2 collision: a reader that reaches for the persisted flag by its OLD key name.
await write(`${ln.cwd}/src/report.ts`, `import type { Persisted } from "./state";

export function describeDispatch(raw: Persisted): string {
  return raw["dispatch"] === true ? "dispatch is on" : "dispatch is off";
}
`);
// C1 control: an unrelated addition at the BOTTOM of a file main also edits (at the top).
await write(`${ln.cwd}/src/rules.ts`, `${(await Bun.file(`${ln.cwd}/src/rules.ts`).text())}
export const RULE_NAMES: string[] = RULES.map((r) => r.name);
`);
for (let i = 0; i < 12; i++) {
  git(ln.cwd, "add", "-A");
  git(ln.cwd, "commit", "-qm", "add digest and reap rules plus a dispatch summary line");
  if (git(ln.cwd, "log", "--oneline", "-1").includes("digest and reap")) break;
  await Bun.sleep(300);
}
console.log("lane commit:", git(ln.cwd, "log", "--oneline", "-1").trim());

// ---------------------------------------------------------------- MAIN moves under the lane
// D1: the unit becomes SECONDS. Type unchanged (number) → tsc cannot see it.
await write(`${REPO}/src/policy.ts`, `export interface AutoRule {
  name: string;
  /** how long the pane must have been quiet before this rule may fire, in SECONDS */
  idleThreshold: number;
}

export function isIdleEnough(rule: AutoRule, idleMs: number): boolean {
  return idleMs / 1000 >= rule.idleThreshold;
}
`);
const rulesNow = await Bun.file(`${REPO}/src/rules.ts`).text();
await write(`${REPO}/src/rules.ts`, `// rule table — thresholds are SECONDS since the unit change
${rulesNow.replace("idleThreshold: 60_000", "idleThreshold: 60").replace("idleThreshold: 900_000", "idleThreshold: 900")}`);
git(REPO, "add", "-A");
git(REPO, "commit", "-qm", "express idle thresholds in seconds");

// D2: the persisted key is renamed on both sides of main's own code.
await write(`${REPO}/src/state.ts`, `export interface Persisted { [k: string]: unknown }

export function loadFlags(raw: Persisted): { dispatch: boolean } {
  return { dispatch: raw.dispatchOn === true };
}

export function saveFlags(dispatch: boolean): Persisted {
  return { dispatchOn: dispatch };
}
`);
git(REPO, "add", "-A");
git(REPO, "commit", "-qm", "name the persisted flag dispatchOn");
console.log("main gained:\n" + git(REPO, "log", "--oneline", "-3"));

// ---------------------------------------------------------------- drive the merge
const settle = async (slot: number): Promise<void> => {
  for (let i = 0; i < 80; i++) {
    const sx = (await (await get("/api/sessions")).json()) as { now: number; slots: { id: number; lastOutput: number }[] };
    const sl = sx.slots.find((x) => x.id === slot);
    if (sl && sx.now - sl.lastOutput >= 3000) return;
    await Bun.sleep(150);
  }
};
type Verdict = { status: string; detail: string; landed: boolean };
for (let a = 0; a < 8; a++) {
  await settle(ln.slot);
  await post(`/api/slots/${ln.slot}/merge`, {});
  const r = await get(`/api/slots/${ln.slot}/merge`);
  if (r.status === 400) break;
  const j = (await r.json()) as { running: boolean; last: Verdict | null };
  if (j.running || j.last !== null) break;
  await Bun.sleep(800);
}
// the real reviewer needs real time — the server's own cap is CLEAN_REVIEW_TIMEOUT_MS (180s default)
let last: Verdict | null = null;
let gone = false;
for (let i = 0; i < 3000; i++) {
  const r = await get(`/api/slots/${ln.slot}/merge`);
  if (r.status === 400) { gone = true; break; }
  const j = (await r.json()) as { running: boolean; last: Verdict | null };
  if (!j.running && j.last !== null) { last = j.last; break; }
  await Bun.sleep(200);
}

// ---------------------------------------------------------------- the measurement
type Shadow = { verdict: string | null; raw: boolean; notes: string; model: string; rawAnswer?: string };
const outs = (await (await get("/api/lane-outcomes?limit=300")).json()) as
  { outcomes: { branch: string | null; disposition: string; cleanReviewShadow?: Shadow }[] };
const row = outs.outcomes.find((o) => o.branch === ln.branch);

console.log("\n================ FIRE-DRILL #3 — ② clean-review ================");
console.log("landed:", gone, "| merge verdict:", JSON.stringify(last));
console.log("outcome disposition:", row?.disposition);
console.log("shadow:", JSON.stringify(row?.cleanReviewShadow, null, 2));
console.log("\n--- composed tree (what actually landed on main) ---");
console.log(git(REPO, "log", "--oneline", "-6"));
console.log("================================================================");
console.log("verdict 'would_stop' = ② flagged it | 'pass' = ② missed it | null = non-measurement");
