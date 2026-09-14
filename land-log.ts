// Land-Chronik — one line per land, read off the fleet/land notes that already exist.
//
//   bun land-log.ts [--since 7d] [--repo <checkout>] [--audits <post-land-audits.jsonl>]
//
// WHY: 861 commits in 14 days do not read as ~200 lands. Rewriting history to make them read that
// way was ruled out (notes, lane-outcomes.jsonl, post-land-audits.jsonl and docs all hang on shas),
// so this is a VIEW: nothing is written, not to git, not to a ledger.
//
// SOURCES (read-only, GIT_OPTIONAL_LOCKS=0):
//   - refs/notes/fleet/land — server.ts writes one JSON note per land onto mainAfter
//     (branch, mainBefore, mainAfter, at, verify{ok,proportional,exitCode,…}).
//   - main's first-parent history — the land's commits are mainBefore..mainAfter on it (lands
//     rebase, so the range is exactly the land); every commit in no land's range is a direct commit.
//   - post-land-audits.jsonl — gitignored, lives only in the main checkout. Joined per land over
//     covers[].mainAfter, and over mainSha for a row that covers nothing. Absent file = "audit ?".
//
// LABELS, each a reading of the record and never a guess past it:
//   verify  ok | proportional (ok on the proportional chain) | failed (ok:false) |
//           skipped (no gate, the reserved skip exit 42, or a waitedOut/timedOut with no verdict)
//   audit   gruen | rot | unknown (the audit ran and measured nothing) | laeuft (no audit row covers
//           this land YET — it is queued or running, never "lost") | ? (no audit ledger to read)
//   A land whose mainAfter is not on main (history rewritten under it) prints "?" for count/subject.

import { existsSync, realpathSync } from "node:fs";

const DAY = 86_400_000;
const SUBJECT_WIDTH = 60;
export const VERIFY_SKIP_EXIT = 42; // server.ts#VERIFY_SKIP_EXIT, held equal by e2e/pins.ts

export interface LandNote {
  branch?: unknown; mainBefore?: unknown; mainAfter?: unknown; at?: unknown;
  verify?: { ok?: unknown; proportional?: unknown; exitCode?: unknown } | null;
}
export interface AuditRow { at?: unknown; result?: unknown; mainSha?: unknown; covers?: unknown }
/** main's first-parent history, NEWEST FIRST (git log order); at = committer time in ms */
export interface MainCommit { sha: string; at: number; subject: string }
export interface LandLogInput {
  notes: LandNote[]; audits: AuditRow[] | null; commits: MainCommit[];
  sinceMs: number; offsetMin?: (ms: number) => number;
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export function verifyLabel(v: LandNote["verify"]): "ok" | "proportional" | "failed" | "skipped" {
  if (!v || v.exitCode === VERIFY_SKIP_EXIT) return "skipped";
  if (v.ok === false) return "failed";
  if (v.ok !== true) return "skipped";
  return v.proportional === true ? "proportional" : "ok";
}

export function auditLabel(mainAfter: string, audits: AuditRow[] | null): "gruen" | "rot" | "unknown" | "laeuft" | "?" {
  if (audits === null) return "?";
  let newest: AuditRow | null = null;
  for (const a of audits) {
    const covers = Array.isArray(a.covers) ? (a.covers as { mainAfter?: unknown }[]) : [];
    const hit = covers.length ? covers.some((c) => c?.mainAfter === mainAfter) : a.mainSha === mainAfter;
    if (hit && (newest === null || Number(a.at) >= Number(newest.at))) newest = a;
  }
  if (newest === null) return "laeuft";
  return newest.result === "green" ? "gruen" : newest.result === "red" ? "rot" : "unknown";
}

export function renderLandLog({ notes, audits, commits, sinceMs, offsetMin = () => 0 }: LandLogInput): string[] {
  const index = new Map(commits.map((c, i) => [c.sha, i]));
  const inLand = new Set<string>();
  const lands: { at: number; line: (day: string, time: string) => string }[] = [];
  for (const n of notes) {
    const after = str(n.mainAfter), before = str(n.mainBefore);
    if (!after) continue;
    const ia = index.get(after), ib = before ? index.get(before) : undefined;
    const onMain = ia !== undefined && ib !== undefined && ib > ia;
    if (onMain) for (let i = ia; i < ib; i++) inLand.add(commits[i].sha);
    const at = typeof n.at === "number" ? n.at : ia !== undefined ? commits[ia].at : null;
    if (at === null || at < sinceMs) continue;
    const count = onMain ? String(ib - ia).padStart(3) + (ib - ia === 1 ? " Commit " : " Commits") : "  ? Commits";
    const subjectRaw = onMain ? commits[ib - 1].subject : "? (mainAfter nicht auf main)";
    const subject = subjectRaw.length > SUBJECT_WIDTH ? `${subjectRaw.slice(0, SUBJECT_WIDTH - 1)}…` : subjectRaw.padEnd(SUBJECT_WIDTH);
    const branch = (str(n.branch) ?? "?").padEnd(23);
    lands.push({ at, line: (day, time) =>
      `${day} ${time}  ${after.slice(0, 8)}  ${branch}  ${count}  ${subject}  verify ${verifyLabel(n.verify).padEnd(12)}  audit ${auditLabel(after, audits)}` });
  }
  const stamp = (ms: number): [string, string] => {
    const iso = new Date(ms + offsetMin(ms) * 60_000).toISOString();
    return [iso.slice(0, 10), iso.slice(11, 16)];
  };
  const days = new Map<string, { lands: { at: number; text: string }[]; direct: number; handoff: number }>();
  const dayOf = (day: string) => {
    const known = days.get(day);
    if (known) return known;
    const fresh = { lands: [] as { at: number; text: string }[], direct: 0, handoff: 0 };
    days.set(day, fresh);
    return fresh;
  };
  for (const l of lands) {
    const [day, time] = stamp(l.at);
    dayOf(day).lands.push({ at: l.at, text: l.line(day, time) });
  }
  for (const c of commits) {
    if (c.at < sinceMs || inLand.has(c.sha)) continue;
    const d = dayOf(stamp(c.at)[0]);
    d.direct++;
    if (/\bhandoff\b/i.test(c.subject)) d.handoff++;
  }
  const out: string[] = [];
  for (const [day, d] of [...days].sort(([a], [b]) => (a < b ? 1 : -1))) {
    for (const l of d.lands.sort((a, b) => b.at - a.at)) out.push(l.text);
    if (d.direct) out.push(`${day}        ${"·".padEnd(8)}  ${"(direkt)".padEnd(23)}  ${d.direct} Direkt-Commit${d.direct === 1 ? "" : "s"}, davon ${d.handoff} HANDOFF`);
  }
  return out;
}

async function git(repo: string, args: string[]): Promise<string> {
  const p = Bun.spawn(["git", "-C", repo, ...args], {
    stdout: "pipe", stderr: "pipe", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  });
  const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  if (code !== 0) throw new Error(`git ${args[0]}: ${err.trim() || `exit ${code}`}`);
  return out;
}

async function main(argv: string[]): Promise<number> {
  const flag = (name: string): string | null => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
  };
  const since = flag("--since") ?? "7d";
  const m = /^(\d+)([dh])$/.exec(since);
  if (!m) { console.error(`land-log: --since wants <N>d or <N>h, got "${since}"`); return 2; }
  const sinceMs = Date.now() - Number(m[1]) * (m[2] === "d" ? DAY : DAY / 24);
  const repo = realpathSync(flag("--repo") ?? (await git(".", ["rev-parse", "--path-format=absolute", "--git-common-dir"])).trim().replace(/\/\.git$/, ""));

  const log = await git(repo, ["log", "--first-parent", "--format=%H%x09%ct%x09%s", "main"]);
  const commits = log.split("\n").filter(Boolean).map((l) => {
    const [sha, ct, ...s] = l.split("\t");
    return { sha, at: Number(ct) * 1000, subject: s.join("\t") };
  });

  const list = await git(repo, ["notes", "--ref=fleet/land", "list"]);
  const blobs = list.split("\n").filter(Boolean).map((l) => l.split(" ")[0]);
  const notes: LandNote[] = [];
  if (blobs.length) {
    const batch = Buffer.from(await new Response(Bun.spawn(["git", "-C", repo, "cat-file", "--batch"], {
      stdin: new TextEncoder().encode(blobs.join("\n") + "\n"), stdout: "pipe", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    }).stdout).arrayBuffer());
    for (let pos = 0; pos < batch.length;) {
      const nl = batch.indexOf(10, pos);
      const size = Number(batch.subarray(pos, nl).toString().split(" ")[2]);
      if (!Number.isFinite(size)) break;
      try { notes.push(JSON.parse(batch.subarray(nl + 1, nl + 1 + size).toString("utf8"))); } catch { /* a non-JSON note is not a land record */ }
      pos = nl + 1 + size + 1;
    }
  }

  const auditFile = flag("--audits") ?? `${repo}/post-land-audits.jsonl`;
  let audits: AuditRow[] | null = null;
  if (existsSync(auditFile)) {
    audits = [];
    for (const l of (await Bun.file(auditFile).text()).split("\n")) {
      if (!l.trim()) continue;
      try { audits.push(JSON.parse(l)); } catch { /* a torn row is skipped, never guessed */ }
    }
  }

  const lines = renderLandLog({ notes, audits, commits, sinceMs, offsetMin: (ms) => -new Date(ms).getTimezoneOffset() });
  console.log(`land-log ${since} · ${repo} · audits: ${audits === null ? `keine (${auditFile} fehlt — audit ?)` : auditFile}`);
  console.log(lines.join("\n"));
  return 0;
}

if (import.meta.main) process.exit(await main(Bun.argv.slice(2)));
