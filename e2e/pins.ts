// e2e/pins.ts — the must-agree pairs whose OTHER SIDE IS NOT TYPESCRIPT.
//
// `bun e2e/pins.ts` from the repo root. No server, no tmux, no network: it reads files and
// compares them, in milliseconds, which is why it goes FIRST in watchdog.sh's verify chain — a
// land that violates one of these should not pay for a type check to find out.
//
// WHY THIS EXISTS. src/protocol.ts handles the pairs where both sides are TypeScript: share the
// declaration and tsc turns a drift into a compile error. That mechanism cannot reach a pair whose
// other half is a shell script or a doc — and those are the ones that actually broke here. The gate
// ran a suite its own comment said it did not run. The type gate omitted one of the five harnesses.
// A wrapper's port band and the table that assigns bands disagreed by 1800. A doc described a
// verification tier as switched off while the srv line switched it on. None of that is detectable
// by any compiler, and all of it is one file read away.
//
// HOW TO ADD ONE. Write a RULE, never a snapshot. "Every wrapper obtains its instance through
// stage_instance" survives a rewrite of all seven wrappers; a list of the seven wrapper names does
// not, and a pin that has to be edited whenever the thing it guards is edited guards nothing. Each
// row below states the rule in its name, so a failure reads as the violated rule rather than as a
// diff. Both directions where a set is involved: an entry with no file AND a file with no entry.
//
// NOT what this file is for: e2e/dirs-pins.ts, an unrelated neighbour, tests the directory picker's
// bookmark list. "Pin" there is a UI feature; "pin" here is a fastener between two files.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const read = (rel: string): string => readFileSync(`${ROOT}/${rel}`, "utf8");
const exists = (rel: string): boolean => { try { statSync(`${ROOT}/${rel}`); return true; } catch { return false; } };

const rows: string[] = [];
let failed = 0;
// `soft` is for a rule that RAN but whose subject cannot be held against this tree — section 6's
// stale rulebook copy is the only case. It prints its findings and does not fail, because a lane
// carrying a month-old copy did not break the anchor it names. WARN, not PASS: a violation that
// prints as a pass is how a check stops being read.
function pin(name: string, ok: boolean, detail = "", soft = false): void {
  rows.push(`${ok ? "PASS" : soft ? "WARN" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok && !soft) failed++;
}
// a rule that could not be evaluated at all must say SO, under its own name. A skipped rule that
// prints PASS is vacuum-green: the same word for "measured, fine" and "never measured".
function skip(name: string, why: string): void { rows.push(`SKIP  ${name}  (${why})`); }

const shellScripts = [
  ...readdirSync(ROOT).filter((f) => f.endsWith(".sh")),
  ...readdirSync(`${ROOT}/drills`).filter((f) => f.endsWith(".sh")).map((f) => `drills/${f}`),
].sort();

// ================================================================================================
// 1. Instance staging — the class of bug that killed two harnesses silently
// ================================================================================================
// e2e-postland-audit.sh died the day continuity.ts landed and stayed dead for weeks; steward-arena.sh
// shipped missing two of four modules. Both were hand-written `cp` lists of server.ts's local
// imports. e2e-stage.sh replaced every one of them with a derived closure. These two rules keep the
// class extinct rather than re-listing the seven scripts that currently obey it.

{
  // a `cp` naming a MODULE — a .ts file at the repo root or under src/, which is exactly what the
  // import closure already stages. e2e-stage.sh's own copy loop passes a variable, which is the
  // whole difference between a derived closure and a list. A fixture that no entry imports
  // (drills/drill-3-clean-review.ts) is NOT this class: nothing derives it, so a hand copy is the
  // only way it can get there.
  const modules = new Set([
    ...readdirSync(ROOT).filter((f) => f.endsWith(".ts")),
    ...readdirSync(`${ROOT}/src`).filter((f) => f.endsWith(".ts")),
  ]);
  const offenders: string[] = [];
  for (const f of shellScripts)
    for (const l of read(f).split("\n")) {
      if (!/(^|[;&|]|\s)cp\s/.test(l)) continue;
      for (const m of l.matchAll(/([A-Za-z0-9_.-]+\.ts)\b/g)) if (modules.has(m[1])) offenders.push(`${f}: ${m[1]}`);
    }
  pin("no shell script copies a module by name (staging is derived, never listed)",
    offenders.length === 0, offenders.join(", "));
}

{
  // a CALL has arguments on the line; `stage_instance() {` in e2e-stage.sh is the definition
  const calls = shellScripts.filter((f) => /^\s*stage_instance\s+\S/m.test(read(f)));
  const sources = shellScripts.filter((f) => /\.\s+"\$SRC\/e2e-stage\.sh"/.test(read(f)));
  const callsNoSource = calls.filter((f) => !sources.includes(f));
  const sourceNoCall = sources.filter((f) => !calls.includes(f));
  pin("every script that stages an instance sources e2e-stage.sh, and vice versa",
    callsNoSource.length === 0 && sourceNoCall.length === 0,
    `${calls.length} stagers; calls-without-source=[${callsNoSource}] source-without-call=[${sourceNoCall}]`);
}

{
  // The DECAPITATION rule, and it is a measured one. 613faa3 rewrote the SRV_ENV line at the end of
  // e2e-isolated.sh and took the 22 lines behind it with it — srv spawn, port wait, `bun
  // fleet-e2e.ts`, teardown, `exit $code`. The truncated file is still valid sh: it assigns a
  // variable and falls off the end with status 0. So the tier-2 audit reported GREEN on two
  // consecutive lands having measured NOTHING (1.8s instead of ~690s, zero PASS lines), and
  // state.sh reported that green to the next session as fact.
  // Neither tsc nor any existing pin could see it: the pin 613faa3 itself added
  // (FLEET_MIGRATE_PCT is armed in e2e-isolated.sh) reads the SRV_ENV line, which SURVIVED.
  // A stager that does not run a runner, or does not end by propagating its exit code, has stopped
  // being a suite while still looking like one — this is the only place that can say so.
  // Scoped to the root `e2e-*.sh` suite wrappers, which is the set whose ONLY product is a verdict.
  // drills/drill-3.sh and steward-arena.sh stage an instance too and are deliberately out: a drill
  // is a hand-driven rig and the arena is a long-lived fixture — neither returns a pass/fail, so
  // "ends by propagating its exit code" would be a rule about something they never claimed to be.
  const stagers = shellScripts.filter((f) =>
    /^e2e-[a-z-]+\.sh$/.test(f) && /^\s*stage_instance\s+\S/m.test(read(f)));
  const noRunner = stagers.filter((f) => !/\bbun\s+fleet-e2e[a-z-]*\.ts\b/.test(read(f)));
  const noExit = stagers.filter((f) => {
    const lines = read(f).split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    return lines[lines.length - 1] !== "exit $code";
  });
  pin("every staged suite RUNS a runner and ends by propagating its exit code (a decapitated wrapper exits 0 having measured nothing)",
    stagers.length > 0 && noRunner.length === 0 && noExit.length === 0,
    `${stagers.length} stagers; no-runner=[${noRunner}] no-exit=[${noExit}]`);
}

// ================================================================================================
// 2. Port bands — the table in e2e-isolated.sh against the wrappers that claim a band
// ================================================================================================
// Every harness binds `base + $$ % width`. Two harnesses whose bands overlap collide on the HTTP
// port for the same $$, and distinct tmux sockets do not help. The table is the ONE place a band is
// assigned; this pins it to the arithmetic, in both directions.

{
  const iso = read("e2e-isolated.sh");
  // `#   e2e-isolated.sh         8800 – 10799`
  const table = new Map<string, [number, number]>();
  for (const l of iso.split("\n")) {
    const m = /^#\s+(\S+\.sh)\s+(\d+)\s*[–-]\s*(\d+)\s*$/.exec(l);
    if (m) table.set(m[1], [Number(m[2]), Number(m[3])]);
  }
  pin("the port-band table in e2e-isolated.sh is parseable and non-empty", table.size > 0, `${table.size} bands`);

  // every script that computes a $$-derived port, found by the arithmetic itself
  const claimed = new Map<string, [number, number]>();
  for (const f of shellScripts) {
    const m = /PORT=\$\(\((\d+)\s*\+\s*\$\$\s*%\s*(\d+)\)\)/.exec(read(f));
    if (m) claimed.set(f, [Number(m[1]), Number(m[1]) + Number(m[2]) - 1]);
  }
  const missingFromTable = [...claimed.keys()].filter((f) => !table.has(f));
  const missingFromDisk = [...table.keys()].filter((f) => !claimed.has(f));
  pin("port-band table and the PORT= lines name the same scripts",
    missingFromTable.length === 0 && missingFromDisk.length === 0,
    `unlisted=[${missingFromTable}] stale=[${missingFromDisk}]`);

  const mismatched = [...claimed.entries()]
    .filter(([f, [lo, hi]]) => { const t = table.get(f); return t && (t[0] !== lo || t[1] !== hi); })
    .map(([f, [lo, hi]]) => `${f}: table ${table.get(f)!.join("–")} vs code ${lo}–${hi}`);
  pin("each script's band matches the range the table assigns it", mismatched.length === 0, mismatched.join("; "));

  const bands = [...claimed.entries()];
  const overlaps: string[] = [];
  for (let i = 0; i < bands.length; i++)
    for (let j = i + 1; j < bands.length; j++) {
      const [fa, [la, ha]] = bands[i], [fb, [lb, hb]] = bands[j];
      if (la <= hb && lb <= ha) overlaps.push(`${fa} ∩ ${fb}`);
    }
  pin("harness port bands are pairwise disjoint", overlaps.length === 0, overlaps.join(", "));

  // the live fleet's port is the one address no test run may ever bind
  const LIVE_PORT = Number(/const LIVE_PORT = (\d+)/.exec(read("e2e/harness.ts"))?.[1] ?? NaN);
  pin("harness.ts states the live port", Number.isFinite(LIVE_PORT), String(LIVE_PORT));
  const swallows = bands.filter(([, [lo, hi]]) => LIVE_PORT >= lo && LIVE_PORT <= hi).map(([f]) => f);
  pin("no harness band contains the live fleet's port", swallows.length === 0, `${LIVE_PORT} in [${swallows}]`);
}

// ================================================================================================
// 3. watchdog.sh's gate ↔ server.ts's contract for it
// ================================================================================================
// The srv-spawn line is baked in at `launchctl kickstart` and is the live fleet's actual policy.
// server.ts parses what it says; these rows pin the two ends of that conversation.

const watchdog = read("watchdog.sh");
const server = read("server.ts");
const verifyCmd = /^VERIFY_CMD='([\s\S]*?)'$/m.exec(watchdog)?.[1] ?? "";
const auditCmd = /^AUDIT_CMD='([\s\S]*?)'$/m.exec(watchdog)?.[1] ?? "";
const spawnLine = watchdog.split("\n").find((l) => l.includes("exec bun server.ts")) ?? "";
pin("watchdog.sh yields a VERIFY_CMD, an AUDIT_CMD and an srv-spawn line",
  !!verifyCmd && !!auditCmd && !!spawnLine,
  `verify=${verifyCmd.length}B audit=${auditCmd.length}B spawn=${spawnLine.length}B`);

{
  // a command that declines to verify must say so with the ONE reserved exit code; any other code
  // is read as a real pass or a real failure, and a self-declared skip that lands as a pass is the
  // exact hole VERIFY_SKIP_EXIT was reserved to close
  const skipExit = Number(/const VERIFY_SKIP_EXIT = (\d+)/.exec(server)?.[1] ?? NaN);
  pin("server.ts states VERIFY_SKIP_EXIT", Number.isFinite(skipExit), String(skipExit));
  const wrong: string[] = [];
  for (const [label, cmd] of [["VERIFY_CMD", verifyCmd], ["AUDIT_CMD", auditCmd]] as const)
    for (const m of cmd.matchAll(/echo "([a-z]+ skipped:[^"]*)";\s*exit (\d+)/g))
      if (Number(m[2]) !== skipExit) wrong.push(`${label}: "${m[1]}" exits ${m[2]}`);
  pin("every self-declared skip in watchdog.sh exits with server.ts's VERIFY_SKIP_EXIT",
    wrong.length === 0, wrong.join("; "));
}

{
  // the legacy half of the same contract: a server deployed without a kickstart still runs an older
  // VERIFY_CMD string, so server.ts also honours the printed marker line on exit 0
  const src = /const VERIFY_SKIP_MARK = \/(.+?)\/([a-z]*);/.exec(server);
  pin("server.ts states VERIFY_SKIP_MARK", !!src, src?.[1] ?? "");
  if (src) {
    const re = new RegExp(src[1], src[2]);
    const echoes = [...verifyCmd.matchAll(/echo "([^"]*skipped:[^"]*)"/g)].map((m) => m[1]);
    const unmatched = echoes.filter((e) => !re.test(e));
    pin("VERIFY_CMD's skip line matches server.ts's VERIFY_SKIP_MARK",
      echoes.length > 0 && unmatched.length === 0, `${echoes.length} echoes, unmatched=[${unmatched}]`);
  }
}

{
  // The suite mutex reports its own wait, and server.ts's runVerify PARSES that report to split a
  // verify run into work and waiting. Shell printf on one side, a RegExp on the other, and nothing
  // between them — the shape this file exists for. If the format drifts, nothing breaks loudly:
  // waitMs simply goes absent and the gate is back to a wall-clock number that silently contains
  // an unbounded queue, which is the 2026-08-06 incident in full.
  // Stated as a RULE, not a snapshot: render EVERY suite-lock format the script has and hold it
  // against the server's one expression. Both directions matter and they fail differently — a
  // format the parser cannot see at all is a wait recorded as zero; a heartbeat that classifies as
  // an ACQUIRE would be summed a second time and inflate the reported wait.
  const stage = read("e2e-stage.sh");
  const fmts = [...stage.matchAll(/printf '(\[suite-lock\][^']*)\\n'/g)].map((m) => m[1]);
  pin("e2e-stage.sh reports on the suite mutex it takes", fmts.length >= 2, `${fmts.length} formats`);
  const lockSrc = /const SUITE_LOCK_RE = \/(.+?)\/([a-z]*);/.exec(server);
  pin("server.ts states SUITE_LOCK_RE", !!lockSrc, lockSrc?.[1] ?? "");
  if (lockSrc && fmts.length) {
    // without `g`: .exec() on a global RegExp carries lastIndex between calls
    const re = new RegExp(lockSrc[1], lockSrc[2].replace(/g/g, ""));
    const rendered = fmts.map((f) => f.replace(/%s/g, "7"));
    const parsed = rendered.map((l) => re.exec(l)?.[1] ?? null);
    pin("every suite-lock line e2e-stage.sh prints is one runVerify can parse",
      parsed.every((k) => k !== null), `${JSON.stringify(rendered.filter((_, i) => parsed[i] === null))}`);
    pin("exactly one of them is the ACQUIRE runVerify sums; the rest are heartbeats",
      parsed.filter((k) => k === "acquired after").length === 1
        && parsed.filter((k) => k === "waiting").length === parsed.length - 1,
      `parsed=${JSON.stringify(parsed)}`);
  }
}

{
  // FLEET_CLEAN_REVIEW is three-valued and every unrecognised spelling falls through to "off".
  // A typo here does not fail — it silently disables the reviewer, which is why it is pinned to the
  // server's OWN parse expressions rather than to a list of words written down twice.
  const val = /FLEET_CLEAN_REVIEW=(\S+)/.exec(spawnLine)?.[1] ?? "";
  const shadowRe = /\/\^shadow\$\/i\.test/.test(server);
  const gateSrc = /\/\^\((1\|true\|on\|yes)\)\$\/i\.test\(CLEAN_REVIEW_RAW\)/.exec(server);
  // the third set. Until server.ts named its OFF spellings this pin had only two, so the owner's
  // deliberate `off` was indistinguishable from a typo and this pin failed on a correct config —
  // red from 2026-07-28 until it was noticed, with the whole land gate behind it.
  const offSrc = /CLEAN_REVIEW_OFF_RE = \/\^\((0\|off\|false\|no)\)\$\/i/.exec(server);
  pin("server.ts's FLEET_CLEAN_REVIEW parse expressions are where this pin expects them",
    shadowRe && !!gateSrc && !!offSrc, `shadow=${shadowRe} gate=${!!gateSrc} off=${!!offSrc}`);
  const inSet = (src: RegExpExecArray | null) => (src ? new RegExp(`^(${src[1]})$`, "i").test(val) : false);
  const recognised = /^shadow$/i.test(val) || inSet(gateSrc) || inSet(offSrc);
  pin("watchdog.sh's FLEET_CLEAN_REVIEW value is one server.ts recognises (a typo means silent off)",
    val === "" || recognised, `value=${val || "(unset)"}`);
}

{
  // A knob the srv line sets under a name server.ts never reads is not a policy — it is a silent
  // fallback to the default, the same failure shape as the FLEET_CLEAN_REVIEW typo above and just
  // as invisible: the land keeps running, on numbers nobody chose. Stated as a rule over the spawn
  // line's OWN assignments rather than as a list, so a knob added tomorrow is covered tomorrow.
  const set = [...new Set([...spawnLine.matchAll(/\b(FLEET_[A-Z_0-9]+)=/g)].map((m) => m[1]))].sort();
  pin("the srv-spawn line sets FLEET_* knobs this rule can check", set.length > 0, `${set.length} knobs`);
  const unread = set.filter((k) => !new RegExp(`process\\.env\\.${k}\\b`).test(server));
  pin("every FLEET_* knob the srv-spawn line sets is one server.ts actually reads",
    unread.length === 0, unread.join(", "));
}

{
  // the type gate must see every entry file in the tree. It did not: fleet-e2e-postland-audit.ts was
  // absent from this list, so the harness guarding the whole tier-2 path had no type coverage at all.
  const tscArgs = /--types bun ([^&]+?)(?:&&|$)/.exec(verifyCmd)?.[1]?.trim().split(/\s+/) ?? [];
  const entries = [
    "server.ts", "src/client.ts", "src/share.ts", "fleet-e2e.ts",
    ...readdirSync(ROOT).filter((f) => /^fleet-e2e-.*\.ts$/.test(f)).sort(),
  ];
  const uncovered = entries.filter((f) => !tscArgs.includes(f));
  pin("watchdog.sh's tsc list covers every entry file on disk", uncovered.length === 0,
    `${tscArgs.length} listed, uncovered=[${uncovered}]`);
  const ghosts = tscArgs.filter((f) => !exists(f));
  pin("every file in watchdog.sh's tsc list exists", ghosts.length === 0, ghosts.join(", "));
}

const gateSuites = [...verifyCmd.matchAll(/\.\/(e2e-[a-z-]+\.sh)/g)].map((m) => m[1]);
{
  const missing = gateSuites.filter((f) => !exists(f));
  const notExec = gateSuites.filter((f) => exists(f) && (statSync(`${ROOT}/${f}`).mode & 0o111) === 0);
  pin("every suite the gate runs exists and is executable",
    gateSuites.length > 0 && missing.length === 0 && notExec.length === 0,
    `${gateSuites.length} suites, missing=[${missing}] non-exec=[${notExec}]`);
}

{
  // the comment above VERIFY_CMD listed ./e2e-security.sh under "NOT here" while the line below it
  // ran exactly that suite. A reader trusting the comment mis-scoped what the gate covers, and no
  // test could notice, because the comment is not code.
  // The convention the comment states and this row enforces: the exclusion clause is the LAST thing
  // in the block, so everything after "NOT here:" is the denied set. Prose after it would be read as
  // a denial, which is a cheap price for a rule that needs no marker syntax in a shell comment.
  const lines = watchdog.split("\n");
  const at = lines.findIndex((l) => l.startsWith("VERIFY_CMD="));
  let from = at;
  while (from > 0 && lines[from - 1].startsWith("#")) from--;
  const block = lines.slice(from, at).join("\n");
  const notHere = block.includes("NOT here:") ? block.slice(block.indexOf("NOT here:")) : "";
  const denied = [...notHere.matchAll(/\.\/(e2e-[a-z-]+\.sh)/g)].map((m) => m[1]);
  const lying = denied.filter((f) => gateSuites.includes(f));
  pin("watchdog.sh's \"NOT here\" comment names no suite the gate actually runs",
    lying.length === 0, `denied=[${denied}] but run=[${lying}]`);
}

{
  // AGENTS.md is the same gate written out for a reader — Codex's convention, and the only rulebook
  // a Codex lane ever sees (it does not read CLAUDE.md, which is git-ignored and therefore cannot be
  // tracked into a worktree at all). So it must be TRACKED, it must not leak the deploy identity
  // into a public repo, and above all its verify block must not drift away from what actually gates.
  // That last one is why this sits at the end of the VERIFY_CMD family rather than in section 4:
  // the pair is AGENTS.md ↔ watchdog.sh's own line, and it rots the moment a suite is added to one.
  const AGENTS = "AGENTS.md";
  let agents: string | null = null;
  try { agents = read(AGENTS); } catch { /* absent → every rule below says so under its own name */ }

  // tracked-ness read out of the git index, never shelled out to: this file is fs-only by design.
  // `.git` is a directory in the main checkout and a file pointing at `…/.git/worktrees/<name>` in
  // a lane; the index that governs THIS tree lives beside whichever of the two it is. Unreadable →
  // SKIP, because "could not look" and "not tracked" are different answers.
  const indexPath = ((): string | null => {
    try {
      if (statSync(`${ROOT}/.git`).isDirectory()) return `${ROOT}/.git/index`;
      const m = /gitdir:\s*(\S+)/.exec(readFileSync(`${ROOT}/.git`, "utf8"));
      return m ? `${m[1]}/index` : null;
    } catch { return null; }
  })();
  const RULE_TRACKED = "AGENTS.md exists at the repo root and is tracked (an untracked one reaches no lane)";
  if (agents === null) pin(RULE_TRACKED, false, "no AGENTS.md in this tree");
  else if (indexPath === null) skip(RULE_TRACKED, "git index not locatable from here");
  else {
    let idx: string | null = null;
    try { idx = readFileSync(indexPath, "latin1"); } catch { /* unreadable */ }
    if (idx === null) skip(RULE_TRACKED, "git index unreadable");
    else {
      const inIndex = idx.includes(`${AGENTS}\0`);
      pin(RULE_TRACKED, inIndex, inIndex ? "on disk and in the index" : "present on disk, absent from the index");
    }
  }

  // the leak rule is stated in SHAPES, not in the secrets themselves — naming them here would put
  // them in a public tracked file, which is the very thing being prevented. An IPv4 literal and an
  // absolute URL are the two forms the deploy identity takes; neither has any business in a file
  // whose whole job is to point at CLAUDE.md for the operational detail.
  const RULE_SECRET = "AGENTS.md carries no deploy identity (no IPv4 literal, no absolute URL)";
  if (agents === null) skip(RULE_SECRET, "no AGENTS.md in this tree");
  else {
    const ips = (agents.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) ?? []).length;
    const urls = (agents.match(/\bhttps?:\/\/\S+/g) ?? []).length;
    pin(RULE_SECRET, ips === 0 && urls === 0, `${ips} ip-shaped, ${urls} url(s)`);
  }

  // THE SHARP ONE, both directions. A suite the gate runs that AGENTS.md omits sends a Codex lane
  // into the land under-verified; a suite AGENTS.md lists that the gate does not run makes the file
  // claim coverage nobody has. Same for the tsc entry list — the exact drift that left the tier-2
  // harness with no type coverage at all. Scoped to the fenced ```sh block so that prose ABOUT a
  // suite (this file names ./e2e-isolated.sh in the paragraph below it, correctly, as NOT a gate)
  // is not read as a claim to run it.
  const RULE_VERIFY = "AGENTS.md's verify block runs exactly what watchdog.sh's VERIFY_CMD gates";
  const fence = agents === null ? null : /```sh\n([\s\S]*?)```/.exec(agents)?.[1] ?? null;
  if (fence === null) pin(RULE_VERIFY, false, agents === null ? "no AGENTS.md" : "no ```sh verify block");
  else {
    const same = (a: string[], b: string[]): string =>
      [...new Set(a.filter((x) => !b.includes(x)))].sort().join(",");
    const docSuites = [...fence.matchAll(/\.\/(e2e-[a-z-]+\.sh)/g)].map((m) => m[1]);
    // the tsc invocation only: from `bunx tsc` to the end of its backslash continuation, so a future
    // `bun something.ts` line elsewhere in the block is not mistaken for a type-gate entry
    const tscLines = ((): string => {
      const ls = fence.split("\n");
      const at = ls.findIndex((l) => l.includes("bunx tsc"));
      if (at < 0) return "";
      let to = at;
      while (to < ls.length - 1 && ls[to].trimEnd().endsWith("\\")) to++;
      return ls.slice(at, to + 1).join(" ");
    })();
    const docTsc = tscLines.split(/\s+/).filter((t) => /\.ts$/.test(t));
    // recomputed rather than borrowed from the block above: these rows must keep working whoever
    // edits the neighbouring family, and the expression is the same one line either way
    const gateTsc = /--types bun ([^&]+?)(?:&&|$)/.exec(verifyCmd)?.[1]?.trim().split(/\s+/) ?? [];
    const missSuite = same(gateSuites, docSuites), extraSuite = same(docSuites, gateSuites);
    const missTsc = same(gateTsc, docTsc), extraTsc = same(docTsc, gateTsc);
    pin(RULE_VERIFY,
      docSuites.length > 0 && docTsc.length > 0
      && !missSuite && !extraSuite && !missTsc && !extraTsc,
      `suites missing=[${missSuite}] extra=[${extraSuite}]; tsc missing=[${missTsc}] extra=[${extraTsc}]`);
  }

  // and the anchors, held HARD — unlike section 6's, which are advisory because a lane's CLAUDE.md
  // is a spawn-time copy. This file is tracked, so the tree it ships with is the tree it describes.
  // CLAUDE.md is the one exception and it is named rather than derived: it is git-ignored, so a
  // fresh clone of this public repo has no copy, and its absence there says nothing about drift.
  const RULE_ANCHORS = "every path AGENTS.md cites resolves in this tree";
  if (agents === null) skip(RULE_ANCHORS, "no AGENTS.md in this tree");
  else {
    // fenced blocks come out FIRST. A ```sh fence is itself made of backticks, so a naive span scan
    // swallows the whole block as one "span" and silently mis-pairs every backtick after it — the
    // failure mode being a rule that reports one anchor and calls the file covered. What is inside
    // the fence is the verify block, and the rule above already holds it against watchdog.sh.
    const prose = agents.replace(/```[\s\S]*?```/g, "\n");
    const cited = [...new Set([...prose.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()))]
      .filter((t) => /^\.?\/?[A-Za-z0-9_][A-Za-z0-9_./-]*\.(?:md|ts|sh|json)$/.test(t))
      .map((t) => t.replace(/^\.\//, ""))
      .filter((t) => t !== "CLAUDE.md");
    const dead = cited.filter((p) => !exists(p));
    pin(RULE_ANCHORS, cited.length > 0 && dead.length === 0, `${cited.length} cited, dead=[${dead}]`);
  }
}

// ================================================================================================
// 4. Docs that state the live land-path configuration
// ================================================================================================
// A doc claiming tier 2 is "default OFF … commented out in watchdog.sh" outlived the day tier 2 went
// live by two days and would have outlived it indefinitely: prose has no gate. A doc that wants to
// make a claim about the srv-spawn line opts in with a marker, and then the claim is checked.
//
//   <!-- pin:watchdog-spawn FLEET_POSTLAND_AUDIT_CMD=set FLEET_CLEAN_REVIEW=shadow -->
//
// `set` / `unset` assert presence; anything else asserts the literal value. Absent a marker, nothing
// is checked — the pin makes an honest claim verifiable, it cannot make prose honest.
{
  const docs = readdirSync(`${ROOT}/docs`).filter((f) => f.endsWith(".md")).map((f) => `docs/${f}`);
  const spawnVars = new Map<string, string>();
  for (const m of spawnLine.matchAll(/\b(FLEET_[A-Z_]+)=('[^']*'|"[^"]*"|\S+)/g))
    spawnVars.set(m[1], m[2].replace(/^['"]|['"]$/g, ""));
  pin("the srv-spawn line yields its FLEET_* assignments", spawnVars.size > 0, `${spawnVars.size} vars`);

  const bad: string[] = [];
  let markers = 0;
  for (const d of docs)
    for (const m of read(d).matchAll(/<!--\s*pin:watchdog-spawn\s+([^>]*?)-->/g)) {
      markers++;
      for (const claim of m[1].trim().split(/\s+/)) {
        const [k, want] = claim.split("=");
        const got = spawnVars.get(k);
        const ok = want === "set" ? got !== undefined : want === "unset" ? got === undefined : got === want;
        if (!ok) bad.push(`${d}: ${k}=${want} but spawn line has ${got === undefined ? "(unset)" : got}`);
      }
    }
  pin("every doc claim about the srv-spawn line matches watchdog.sh", bad.length === 0,
    `${markers} markers in ${docs.length} docs; ${bad.join("; ")}`);
}

{
  // register.sh and the server must not grow separate path parsers again. The shell may format
  // the projection, but task-metadata.ts alone decides whether a path is tracked and which source
  // strength it carries. These are rules over the boundary, not snapshots of an output fixture.
  const register = read("register.sh");
  pin("register delegates task surfaces to the shared read-only metadata projector",
    register.includes("bun task-metadata.ts --state")
      && !register.includes("PATHRE") && !register.includes("surface_of("));
  pin("register names confirmed, derived and UNKNOWN provenance as three distinct display states",
    register.includes("[bestätigt/mechanisch]") && register.includes("[abgeleitet]")
      && register.includes("UNBEKANNT") && register.includes("Only kind=auftrag rows appear"));
}

{
  // ANALYST MODE IS ONE RUNTIME FACT. A stored verdict cannot say whether the reader exists now,
  // so every server consumer must read ANALYSIS_ON, the poll must transport that exact fact, and
  // the client warning must consume the transported value. This is a wiring rule, not a pin of
  // warning prose or cadence: ANALYSIS_TICK_MS remains free to carry the interval itself.
  const client = read("src/client.ts");
  const warning = read("task-analysis-warning.ts");
  const executableServer = server.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  const factDefs = [...executableServer.matchAll(/const ANALYSIS_ON = ANALYSIS_TICK_MS > 0;/g)];
  pin("one plainly named server fact derives analyst mode from the configured cadence",
    factDefs.length === 1, `${factDefs.length} ANALYSIS_ON definition(s)`);

  const sweepStart = server.indexOf("async function tickAnalysisSweep");
  const sweepBody = sweepStart < 0 ? "" : server.slice(sweepStart, server.indexOf("function refineChildText", sweepStart));
  const dispatchStart = server.indexOf("async function tickDispatch");
  const dispatchBody = dispatchStart < 0 ? "" : server.slice(dispatchStart, server.indexOf("// A freshly seeded socket", dispatchStart));
  const reanalyseStart = server.indexOf("const taskReanalyse =");
  const reanalyseBody = reanalyseStart < 0 ? "" : server.slice(reanalyseStart, server.indexOf("const taskRefine =", reanalyseStart));
  pin("ANALYSIS_ON feeds the sweep guard and its only scheduler registration",
    /analysisBusy \|\| !ANALYSIS_ON/.test(sweepBody)
      && /if \(ANALYSIS_ON\) setInterval\([^\n]*tickAnalysisSweep[^\n]*, ANALYSIS_TICK_MS\);/.test(executableServer));
  pin("ANALYSIS_ON feeds the dispatch analysis invariant and reanalyse refusal",
    /if \(ANALYSIS_ON\) \{/.test(dispatchBody) && /if \(!ANALYSIS_ON\)/.test(reanalyseBody));
  pin("the owner poll exposes the same ANALYSIS_ON fact as a global sibling of dispatch",
    /dispatch: \{[^\n]*\},\s*analysis: \{ on: ANALYSIS_ON \},/.test(executableServer));

  // Outside its numeric declaration, shared fact, and setInterval delay, the cadence must not be
  // read directly. Any fourth use is a new derivation/consumer bypassing the named runtime fact.
  const directCadenceUses = executableServer.split("\n").filter((l) => l.includes("ANALYSIS_TICK_MS"));
  const cadenceBypasses = directCadenceUses.filter((l) =>
    !l.includes("const ANALYSIS_TICK_MS =")
    && !l.includes("const ANALYSIS_ON = ANALYSIS_TICK_MS > 0;")
    && !/setInterval\([^\n]*tickAnalysisSweep[^\n]*, ANALYSIS_TICK_MS\);/.test(l));
  pin("no server analyst consumer derives on/off directly from ANALYSIS_TICK_MS",
    directCadenceUses.length >= 3 && cadenceBypasses.length === 0,
    `${directCadenceUses.length} cadence use(s); bypasses=[${cadenceBypasses.map((l) => l.trim()).join(" | ")}]`);
  pin("the queue warning consumes the owner poll fact and only classifies explicit false as off",
    client.includes("analysisOn = data.analysis?.on;")
      && /classifyAnalystOffWarning\(\{\s*analysisOn,/.test(client)
      && warning.includes("if (input.analysisOn !== false) return null;"));
  pin("every brief exposes one text-free top-level generation that invalidates client full/list/detail caches",
    /& \{ briefAt\?: number; criterion\?:/.test(server)
      && /\.\.\.\(t\.brief \? \{ briefAt: t\.brief\.at \} : \{\}\)/.test(server)
      && client.includes("briefAt?: number;")
      && /const qTaskFullKey =[\s\S]{0,300}?t\.briefAt \?\? 0/.test(client)
      && /t\.filesOrigin, t\.cluster, t\.briefAt, t\.analysis\?\.at/.test(client)
      && /t\.note, t\.kind, t\.briefAt, t\.analysis\?\.verdict/.test(client));

  // register is the offline view of the queue. Visibility in the browser must not turn that shell
  // path into an API client; comments are excluded so a warning about curl would not trip the rule.
  const registerCode = read("register.sh").split("\n")
    .filter((l) => !l.trim().startsWith("#")).join("\n");
  pin("register remains offline and API-independent",
    !/\b(curl|wget|fetch)\b|https?:\/\/|\/api\//.test(registerCode));
}

// ================================================================================================
// 5. The L1 rot detector — prose that has gone out of date with the code it describes
// ================================================================================================
// BACKLOG P-10, asked for in July and unbuilt until 2026-08-06. Two mechanical checks, both aimed
// at the failure this repository measured rather than at doc quality in general: the shelf carried
// claims nobody re-derived. `docs/README.md`'s own index failed its pointer check for two days
// after the attic move — 10 of 61 pointers resolved, and the doc stating the rule was the one
// breaking it. Separately, `BACKLOG.md` P-4 said "Client rendering still open" while `deployGap`
// stood 5× in src/client.ts.
//
// These do NOT check whether prose is true. They check the two things a machine can: that a
// pointer resolves, and that a symbol a doc calls ABSENT is in fact absent. Everything else stays
// reading work — ./register.sh prints the open markers so a human can do it.

{
  // 5a. Every doc pointer in the index resolves. The pattern is the index's own — lowercase
  // basenames in backticks — and that is deliberate: `docs/attic/…` and the neighbouring
  // repository's `docs/fixtures.md` carry a slash, and the four unpublished security documents and
  // the demo write-up are named WITHOUT an extension precisely so this check does not trip on files
  // that are supposed to be absent. A check people learn to ignore is worse than no check.
  const idx = read("docs/README.md");
  const named = [...new Set([...idx.matchAll(/`([a-z0-9-]+\.md)`/g)].map((m) => m[1]))].sort();
  pin("docs/README.md yields doc pointers to check", named.length > 0, `${named.length} pointers`);
  const broken = named.filter((f) => !exists(`docs/${f}`));
  pin("every doc pointer in docs/README.md resolves to a file", broken.length === 0, broken.join(", "));
  // The other direction is NOT pinned, and that is a decision, not an oversight: the index names
  // twelve OPERATIVE docs on purpose and the shelf holds more, so an unlisted doc is a call to make
  // (index it, or attic it) rather than a defect to fail a land on. ./register.sh §5 prints it.
}

{
  // 5b. No doc calls ABSENT a symbol that is present.
  //
  // The rule, stated so it survives a rewrite of every doc: a line that pairs an absence phrase
  // with a backticked symbol is making a checkable claim, and the symbol must not occur in the
  // source the claim is about — the .ts/.sh file named in the same clause, or server.ts by default,
  // which is the wording BACKLOG P-10 used.
  //
  // The SUBJECT is bound to the clause, not to the line. That is what keeps this quiet on a corpus
  // full of measurements: the work-register row for P-7c used to read "`FLEET_VERIFY_CMD` pro Repo
  // — `verifyCmdFor`/`repoVerify` kommen **0×** vor", and only the two after the dash were claimed
  // absent — `FLEET_VERIFY_CMD` itself was very much in server.ts. A line-wide scan would fail on a
  // true sentence, and a pin that cries on truth gets switched off.
  // That example is quoted from its OWN history on purpose: P-7c landed on 2026-08-08, `verifyCmdFor`
  // exists, and the row was rewritten in the same change — which is this rule doing its job, one
  // measurement's worth of it. Kept here because the shape is what the rule is about, not the row.
  //
  // Deliberately narrow, and the misses are known: a claim whose subject is prose rather than a
  // backticked symbol is not checkable ("Client rendering still open"), and neither is one that
  // wraps across two lines. Under-coverage that stays silent beats a net that has to be muted.
  //
  // THE ESCAPE HATCH, and why it is not optional (briefs/work-register.md §6). "Defined" is not
  // "built": a symbol can exist, be read in two places, and still have nothing act on it — which
  // is exactly what BACKLOG Track A says about the ladder, and it is a TRUE "unbuilt" claim about
  // a symbol that is present. A detector with no answer to that fails on a true sentence at its
  // first real case and gets switched off within the week. So a line may opt out with
  //
  //   <!-- rot-ok: defined but no consumer acts on it -->
  //
  // on the line itself or the one above it. The exemption is COUNTED and printed in the pin's
  // detail: a silent exception is just drift again, wearing a comment.
  const ABSENCE = /(?:\bungebaut|\bunbuilt|\bnicht gebaut|\bnot built|0\s*[×x]\s*\*{0,2}\s*vor\b)/gi;
  const BOUNDARY = /[|—(),;:·„"“”]/;
  const ROTOK = /<!--\s*rot-ok:/;
  const docs = readdirSync(`${ROOT}/docs`).filter((f) => f.endsWith(".md")).map((f) => `docs/${f}`);
  const claims: { where: string; sym: string; target: string }[] = [];
  let exempt = 0;
  for (const d of docs) {
    const lines = read(d).split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (!ABSENCE.test(lines[i])) { ABSENCE.lastIndex = 0; continue; }
      ABSENCE.lastIndex = 0;
      if (ROTOK.test(lines[i]) || (i > 0 && ROTOK.test(lines[i - 1]))) { exempt++; continue; }
      for (const m of lines[i].matchAll(ABSENCE)) {
        const before = lines[i].slice(0, m.index);
        let cut = 0;
        for (let k = before.length - 1; k >= 0; k--) if (BOUNDARY.test(before[k])) { cut = k + 1; break; }
        const clause = before.slice(cut);
        // one backtick span = one token, never split further. A doc listing alternatives writes
        // them as separate spans ("`verifyCmdFor`/`repoVerify`" is two), so splitting on the
        // slash buys nothing and destroys the single-span route names ("`api/deploy`" is one).
        const toks = [...clause.matchAll(/`([^`]+)`/g)].map((t) => t[1].trim()).filter(Boolean);
        const files = toks.filter((t) => /\.(ts|sh)$/.test(t) && exists(t));
        const syms = toks.filter((t) => /^[A-Za-z_][A-Za-z0-9_/-]*$/.test(t) && t.length >= 3);
        for (const sym of syms)
          for (const target of files.length ? files : ["server.ts"])
            claims.push({ where: `${d}:${i + 1}`, sym, target });
      }
    }
  }
  const src = new Map<string, string>();
  const live = claims.filter((c) => {
    if (!src.has(c.target)) src.set(c.target, read(c.target));
    return src.get(c.target)!.includes(c.sym);
  });
  pin("no doc calls \"unbuilt\" a symbol its own source defines",
    live.length === 0,
    `${claims.length} checkable claim(s) in ${docs.length} docs, ${exempt} rot-ok exemption(s); ` +
    live.map((c) => `${c.where}: "${c.sym}" IS in ${c.target}`).join("; "));
}

pin("the backlog nudge is opt-in: unset means zero and exactly one positive-only timer can call it", /const BACKLOG_NUDGE_MS = [^;\n]*process\.env\.FLEET_BACKLOG_NUDGE_MS \?\? 0[^;\n]*;/.test(server) && server.split("\n").filter((l) => l.includes("setInterval") && l.includes("tickBacklogNudge")).length === 1 && /if \(BACKLOG_NUDGE_MS > 0\) setInterval\([^\n]*tickBacklogNudge/.test(server));
pin("the audit ping is opt-in: unset means zero and exactly one positive-only timer can call it", /const AUDIT_PING_MS = [^;\n]*process\.env\.FLEET_AUDIT_PING_MS \?\? 0[^;\n]*;/.test(server) && server.split("\n").filter((l) => l.includes("setInterval") && l.includes("tickAuditPing")).length === 1 && /if \(AUDIT_PING_MS > 0\) setInterval\([^\n]*tickAuditPing/.test(server));

{
  // The DISPATCHER'S BOLT, pinned at the source because that is where it lives. Pi ships no
  // permission layer at all (PI_HARNESS.note), and whether an UNATTENDED lane may run without one
  // is an owner decision that has not been made — so until it is, the dispatcher spawns the
  // default harness and nothing else.
  //
  // WHERE THE BOLT MOVED, and why the rule below is now stated over the CALL SITE rather than over
  // dispatchTask's body. The bolt used to be openSlot's parameter default: dispatchTask called the
  // short form, so it could not pass a harness at all. That stopped being true when the attended
  // ▸ start button gained the choice (a foreign-harness lane started the /api/lanes way keeps no
  // queue link, which is what that plumbing buys). dispatchTask therefore DOES name a harness now —
  // the one it was handed — and the property that must hold is one level up: the unattended caller
  // hands it nothing. Two pins, because that absence and the second lock are different claims and a
  // single one of them would be a weaker guarantee than the pair reads as.
  //
  // Bounded to the callers' OWN bodies — an unbounded slice to EOF swallows every route and makes
  // the rule vacuously true, which is how this pin failed the first time it was written.
  const dStart = server.indexOf("async function dispatchTask");
  const dBody = server.slice(dStart, server.indexOf("\n}\n", dStart));
  pin("dispatchTask's body is bounded and non-empty (an unbounded slice would make the rule below vacuous)",
    dStart > 0 && dBody.length > 500 && dBody.length < 20_000, `${dBody.length} bytes`);
  // The attended route may name all three adapter choices. The tick still calls the short form
  // below, so DEFAULT_SPAWN is its entire spawn decision; pin every field to null rather than
  // relying on an optional property whose absence could acquire a meaning later.
  pin("the attended dispatch carries model+harness+effort, while the tick default keeps all three null",
    /type DispatchSpawn = \{ harness: string \| null; model: string \| null; effort: string \| null \};/.test(server)
    && /const DEFAULT_SPAWN: DispatchSpawn = \{ harness: null, model: null, effort: null \};/.test(server)
    && /openSlot\(free, wt\.path, dRef, spawn\.model, null, spawn\.harness, spawn\.effort\)/.test(dBody),
    dBody.match(/openSlot\([^;]*/)?.[0]?.slice(0, 180) ?? "no openSlot call");
  const tStart = server.indexOf("async function tickDispatch");
  const tBody = server.slice(tStart, server.indexOf("\n}\n", tStart));
  pin("tickDispatch's body is bounded and non-empty (an unbounded slice would make the rule below vacuous)",
    tStart > 0 && tBody.length > 500 && tBody.length < 20_000, `${tBody.length} bytes`);
  // THE ABSENCE, at the one call a tick can make. A `spawn` argument here — from a Task field, an
  // env default, anything — is the change that would hand an unattended lane a foreign agent, and
  // it is invisible to tsc (the parameter is optional) and to every runtime test on a fleet with
  // FLEET_HARNESS_AUTOMATION off, which is every suite.
  const tickCalls = [...tBody.matchAll(/dispatchTask\(([^)]*)\)/g)].map((m) => m[1].trim());
  pin("the tick's own dispatch call names no harness — the choice enters only through an attended request body",
    tickCalls.length === 1 && tickCalls[0] === "next, free, false", tickCalls.join(" | ") || "no dispatchTask call");
  // THE SECOND LOCK, for the case the absence above cannot cover: a future unattended caller that
  // does pass one. Same two conditions as every other unattended path (the operator's env flag AND
  // the adapter's own claim), so a harness added tomorrow inherits the refusal rather than the
  // permission — the mistake the comms repair exists to undo, one field to the right.
  pin("dispatchTask refuses a foreign harness on an UNATTENDED call — the flag and the adapter's claim, both",
    /!ownerAct && !\(HARNESS_AUTOMATION && spawnH\.automatable\)/.test(dBody),
    dBody.match(/spawnH[^\n]*/)?.[0]?.slice(0, 140) ?? "no unattended guard");
  // The bolt above is generic (it names no adapter), which is what makes it cover an adapter added
  // tomorrow. This one is specific and belongs next to it: the CONTAINER adapter's automatable is an
  // owner decision that has NOT been made, so it fails closed — and unlike pi's `true`, nothing at
  // runtime can tell a wrong `true` from a right one on a fleet with FLEET_HARNESS_AUTOMATION off
  // (which is every suite). An absence again, so: a rule over the source, scoped to that adapter's
  // own object literal rather than the file, or a `automatable: false` anywhere would satisfy it.
  const cStart = server.indexOf("const CONTAINER_HARNESS: Harness = {");
  const cBody = cStart < 0 ? "" : server.slice(cStart, server.indexOf("\n};\n", cStart));
  pin("the container adapter's literal is bounded and non-empty (an unfound one would make the rule below vacuous)",
    cStart > 0 && cBody.length > 500 && cBody.length < 8_000, `${cBody.length} bytes`);
  pin("the container adapter stays automation-INELIGIBLE and transcript-less until an owner decides otherwise",
    /\n  automatable: false,/.test(cBody) && /\n    transcript: false,/.test(cBody),
    cBody.match(/automatable: \w+/)?.[0] ?? "no automatable field");
  // ...and its box comes off the SLOT, never off the module constant. The runtime rows
  // (e2e/security.ts §6d2) prove two slots disagree; this proves the source cannot quietly go back,
  // and a reversion is one plausible edit away: `CONTAINER_NAME` still exists (it is the DEFAULT),
  // so typing it into the spawn line again compiles, passes tsc, and re-freezes every container
  // slot onto one box — a regression whose only symptom is that a per-slot choice stops arriving.
  const cSpawn = cBody.match(/spawnCmd: \(o\) =>[\s\S]*?exec \$\{SHELL\}`,/)?.[0] ?? "";
  pin("the container adapter's spawn line reads its box from the SLOT, not from the fleet-wide constant",
    /\$\{o\.containerContext\}/.test(cSpawn) && /\$\{o\.container\}/.test(cSpawn)
    && !/CONTAINER_NAME|CONTAINER_CONTEXT/.test(cSpawn), cSpawn.slice(-140) || "no spawn line");
  // The same rule for the CODEX adapter, and it carries one clause the container's does not. Two of
  // its three properties are absences that no runtime check can see on a suite fleet:
  //   - `automatable: false` — every suite runs with FLEET_HARNESS_AUTOMATION off, so a wrongly
  //     `true` field is indistinguishable from a right `false` at runtime. Same argument as above.
  //   - `comms` NON-NULL — this is what strips the "unprobed" waiver. A `null` here would silently
  //     defer to the fleet-wide HARNESS_COMMS, and on an undeclared FLEET_CMD that is the empty set,
  //     i.e. every codex slot would read `unprobed` and no gate would ever hold it. The runtime row
  //     (e2e/security.ts §6e) proves the probe HAPPENS; this proves it cannot stop happening.
  //   - and the spawn profile. Full access via --dangerously-bypass-approvals-and-sandbox is the
  //     OWNER decision of 2026-08-12; the failure mode of silently narrowing it back (or of losing
  //     the trust prelude) is not a red check but a lane that wedges on codex's own trust prompt
  //     and eats its brief. Scoped to this adapter's own object literal, so the string appearing
  //     in a comment elsewhere cannot satisfy or break it.
  const xStart = server.indexOf("const CODEX_HARNESS: Harness = {");
  const xBody = xStart < 0 ? "" : server.slice(xStart, server.indexOf("\n};\n", xStart));
  pin("the codex adapter's literal is bounded and non-empty (an unfound one would make the rules below vacuous)",
    xStart > 0 && xBody.length > 500 && xBody.length < 12_000, `${xBody.length} bytes`);
  // automation-eligibility FLIPPED 2026-08-12, and the pin flips WITH its condition: the flip is
  // only sound alongside the declared readiness seam (both measured block screens keep the node
  // wrapper alive, so no process probe can refuse them — only the rendered pane can). An
  // automatable:true WITHOUT the readiness declaration would re-open the silent brief-eat this
  // seam closed, and on a suite fleet (FLEET_HARNESS_AUTOMATION=0) that regression is invisible
  // at runtime — hence a rule over the source, coupling the two fields as one decision.
  pin("the codex adapter is automation-eligible ONLY alongside its declared readiness seam (one decision, two fields)",
    /\n  automatable: true,/.test(xBody) && /\n  readiness: \{/.test(xBody)
    && /Do you trust the contents of this directory/.test(xBody)
    && /Sign in with ChatGPT\|Welcome to Codex/.test(xBody)
    && />_ OpenAI Codex \\\(v/.test(xBody),
    xBody.match(/automatable: \w+/)?.[0] ?? "no automatable field");
  pin("the codex adapter stays transcript-less until an owner decides otherwise",
    /\n    transcript: false,/.test(xBody), "transcript field");
  // ...and the seam's two consumers exist in the source, because only the dispatch tail is
  // exercisable on this fleet (e2e/tasks.ts f3): canDeliver's screen gate protects the unattended
  // paths (autos, steward send, watches) that HARNESS_AUTOMATION=0 keeps unreachable in-suite.
  pin("canDeliver refuses a blocked screen behind the same probe opt-out as not-alive",
    /gate: "blocked-screen", detail: rd\.why/.test(server) && /rd\?\.state === "blocked"/.test(server),
    "blocked-screen gate in canDeliver");
  pin("the dispatch tail waits BOUNDED on the accept marker — a blind sleep is a grace period, never the readiness proof",
    /pane blocked on \$\{rd\.why\}/.test(server) && /never showed its ready marker within/.test(server)
    && /READY_WAIT_MS/.test(server),
    "readiness wait in briefAndSend");
  pin("the codex adapter declares its OWN comms — a null would hand it back the unprobed waiver",
    /\n  comms: \["codex", "node"\],/.test(xBody), xBody.match(/\n  comms: [^\n]*/)?.[0]?.trim() ?? "no comms field");
  const xCode = xBody.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  pin("the codex spawn line runs full access — approvals and sandbox bypassed by owner decision 2026-08-12",
    /codex --dangerously-bypass-approvals-and-sandbox/.test(xCode) && !/--sandbox workspace-write/.test(xCode),
    xBody.match(/let cmd = [^\n]*/)?.[0] ?? "no spawn line");
  // The trust prelude is what keeps that spawn UNATTENDED-bootable: codex blocks on its per-path
  // trust prompt for any cwd absent from ~/.codex/config.toml, and the bypass flag does NOT skip
  // it (measured 2026-08-12). Losing the prelude or the charset guard is invisible at runtime on a
  // suite fleet, so both are rules over the source.
  pin("the codex spawn writes its idempotent trust entry, guarded by the spawn-path charset",
    /grep -qxF '\[projects\."\$\{o\.cwd\}"\]'/.test(xCode) && /trust_level = "trusted"/.test(xCode)
    && /SPAWN_PATH_RE\.test\(o\.cwd\)/.test(xCode),
    xCode.match(/const trust = [^\n]*/)?.[0] ?? "no trust prelude");
  // The PI adapter runs BARE by owner decision 2026-08-12 — full local access is the normal
  // operating mode, and the sandbox-exec fence of 2026-08-08..11 is retired, not conditional. A
  // rule over the source, because the regression is invisible at runtime on a suite fleet: a
  // re-grown fence would behave exactly like the bare spawn until a real lane's commit dies on it.
  const pStart = server.indexOf("const PI_HARNESS: Harness = {");
  const pBody = pStart < 0 ? "" : server.slice(pStart, server.indexOf("\n};\n", pStart));
  pin("the pi adapter's literal is bounded and non-empty (an unfound one would make the rules below vacuous)",
    pStart > 0 && pBody.length > 500 && pBody.length < 12_000, `${pBody.length} bytes`);
  const pSpawn = pBody.slice(pBody.indexOf("spawnCmd: (o) => {"), pBody.indexOf("worker: () => null"));
  const pCode = pSpawn.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  pin("the pi spawn line starts pi bare with the owner's full reach — no sandbox-exec anywhere in it",
    /return `\$\{PATH_EXPORT\}\$\{cmd\}; exec \$\{SHELL\}`/.test(pCode) && !pCode.includes("sandbox-exec"),
    pCode.match(/return `[^`]*`/g)?.join(" | ").slice(0, 200) ?? "no return");

  // The one unfenced Pi is an explicit adapter, never a conditional hole in normal Pi's fence.
  // Pin both the power and all three blast-radius limits: changing only one side would make either
  // the picker warning false or an unrestricted agent reachable unattended/as a lane/as a pool.
  const puStart = server.indexOf("const PI_UNFENCED_HARNESS: Harness = {");
  const puBody = puStart < 0 ? "" : server.slice(puStart, server.indexOf("\n};\n", puStart));
  const puCode = puBody.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  pin("pi-unfenced is a bounded explicit adapter rather than a branch in normal Pi's fence",
    puStart > 0 && puBody.length > 400 && puBody.length < 5_000, `${puBody.length} bytes`);
  pin("pi-unfenced really starts bare Pi and says UNFENCED before the owner picks it",
    /return `\$\{PATH_EXPORT\}\$\{cmd\}; exec \$\{SHELL\}`/.test(puCode)
    && !puCode.includes("sandbox-exec") && /note: "UNFENCED host access:/.test(puCode),
    puCode.match(/return `[^`]+`/)?.[0] ?? "no raw spawn line");
  pin("pi-unfenced stays attended, main-only and singleton",
    /automatable: false/.test(puCode) && /allowsLanes: false/.test(puCode)
    && /singleton: true/.test(puCode) && /hostCommits: false/.test(puCode),
    puCode.match(/(?:automatable|allowsLanes|singleton|hostCommits): [^,]+/g)?.join(" | ") ?? "policy fields absent");
  pin("the lane constructor refuses a main-only harness before createWorktree",
    /if \(!h\.allowsLanes\) throw new Error\(`harness \$\{h\.id\} is main-session only/.test(server)
    && server.indexOf("if (!h.allowsLanes) throw", server.indexOf("async function openLaneInSlot"))
      < server.indexOf("createWorktree(root", server.indexOf("async function openLaneInSlot")),
    "openLaneInSlot policy ordering");


  // --- the WORKER spawn, and why it is a rule over the source rather than a test -----------------
  // This file used to hold TWO spawn implementations: slotCmd/agentCmd (which the registry covers,
  // and which the sibling pin above states "names no harness" for the dispatcher) and
  // summaryViaSession, which built `claude --session-id … --model … <tools>` for itself. Nothing
  // could notice the second one: it is the path behind the merge resolver and the ② reviewer, every
  // suite drives it through a FLEET_*_CMD subprocess stand-in instead, and a re-grown literal there
  // would be invisible until a fleet ran a harness that is not claude. So: a rule over the body.
  //
  // Bounded to summaryViaSession's OWN body for the same reason dispatchTask's is — an unbounded
  // slice reaches the whole file and makes the rule vacuously false rather than vacuously true,
  // which is the louder failure but still the wrong one.
  const wStart = server.indexOf("async function summaryViaSession(");
  const wBody = wStart < 0 ? "" : server.slice(wStart, server.indexOf("\n}\n", wStart));
  // TRAILING comments stripped as well as whole-line ones, unlike the docker rule above. This body
  // ends in `await tmux("kill-session", …); // never leave an unattended claude behind` — a sentence
  // about the cleanup, which a leading-`//` filter alone leaves in and the rule below then reads as
  // a re-grown spawn literal. (It did, on the first run: the pin failed on prose. Same lesson as
  // the docker rule, reached by a second route, so the strip is spelled out here rather than shared:
  // stripping trailing `//` file-wide would cut into string literals that carry `//`.)
  const stripComments = (s: string): string =>
    s.split("\n").filter((l) => !l.trim().startsWith("//")).map((l) => l.replace(/\s+\/\/.*$/, "")).join("\n");
  const wExec = stripComments(wBody);
  pin("summaryViaSession's body is bounded and non-empty (an unfound one would make the rules below vacuous)",
    wStart > 0 && wExec.length > 800 && wExec.length < 8_000, `${wExec.length} bytes of code`);
  pin("the worker spawn names no agent binary and no spawn flags of its own — the line comes from the adapter",
    /WORKER_HARNESS\.worker\(/.test(wExec) && !/\bclaude\b/.test(wExec)
      && !/--session-id|--model|--tools/.test(wExec),
    wExec.match(/.{0,30}(claude|--session-id|--model|--tools).{0,30}/)?.[0] ?? "no agent literal");
  // ...and the readiness probe follows the line rather than restating what it expects to find. A
  // literal comms list here is what the removed claudeAliveAt was, and it would go on answering
  // "claude" for a worker line the adapter had since changed.
  pin("the worker readiness probe asks the adapter's comms, never a literal",
    /paneAgentAt\(name, w\.comms\)/.test(wExec) && !/paneAgentAt\([^)]*\["/.test(wExec),
    wExec.match(/paneAgentAt\([^)]*\)/)?.[0] ?? "no paneAgentAt call");

  // The worker's answer is READ FROM a host-side transcript, so `worker` and `supports.transcript`
  // are two statements of one fact and may not disagree. The direction that matters is the one that
  // fails silently: an adapter offering a worker line it cannot read the answer from spawns a real
  // agent, spends a real run, and then polls a path that never appears until the timeout. Stated
  // over EVERY adapter literal, so the one added tomorrow is covered tomorrow.
  const adapters = [...server.matchAll(/const ([A-Z_]+)_HARNESS: Harness = \{/g)]
    .map((m) => ({ name: m[1], body: server.slice(m.index!, server.indexOf("\n};\n", m.index!)) }));
  pin("server.ts yields its harness adapter literals (an unparsed set would make the rule below vacuous)",
    adapters.length >= 4 && adapters.every((a) => a.body.length > 300),
    adapters.map((a) => `${a.name}:${a.body.length}B`).join(" "));
  // Repository-write ownership is an adapter declaration, never an id/form guess. Match each
  // literal's executable source and require exactly one explicit boolean so an adapter added
  // tomorrow cannot inherit an answer.
  const hostCommitFields = adapters.map((a) => ({
    name: a.name,
    values: [...stripComments(a.body).matchAll(/\n  hostCommits: (true|false),/g)].map((m) => m[1]),
  }));
  pin("every harness adapter literal explicitly answers who commits (no optional/default answer)",
    hostCommitFields.length >= 4 && hostCommitFields.every((a) => a.values.length === 1),
    hostCommitFields.map((a) => `${a.name}:${a.values.join("|") || "missing"}`).join(" "));
  const hostCommitsOf = (name: string): string | undefined =>
    hostCommitFields.find((a) => a.name === name)?.values[0];
  // All five are pinned OWNER DECISIONS since 2026-08-12: full local access is the normal
  // operating mode, every agent records its own work, and /commit is a recovery act. A `true`
  // reappearing here would silently re-route a harness's lifecycle through host rescue.
  const ownerHostCommitExpected: Record<string, string> = {
    CLAUDE: "false", PI: "false", PI_UNFENCED: "false", CONTAINER: "false", CODEX: "false",
  };
  const wrongOwnerDecision = Object.entries(ownerHostCommitExpected)
    .filter(([name, expected]) => hostCommitsOf(name) !== expected);
  pin("every adapter keeps its owner-decided commit ownership — nobody is fenced out of .git",
    wrongOwnerDecision.length === 0,
    wrongOwnerDecision.map(([name, expected]) => `${name}:${hostCommitsOf(name) ?? "missing"} expected=${expected}`).join(" ")
      || "all five agree");
  // `supports` is written inline on one adapter and one-field-per-line on the other three, so the
  // field is matched WITHOUT its leading newline — anchoring on the layout would have made this
  // rule true for three adapters and unaskable for the fourth.
  const wrongWorker = adapters.filter((a) => {
    const exec = stripComments(a.body);
    const hosts = !/\n {2}worker: \(\) => null,/.test(exec);
    return hosts !== /\btranscript: true\b/.test(exec);
  });
  pin("no adapter offers a worker session it could not read the answer from (worker ⇔ supports.transcript)",
    wrongWorker.length === 0, wrongWorker.map((a) => a.name).join(", ") || "all four agree");

  // ...and its docker is PINNED, never ambient. Stated over the whole file because the harm is a
  // bare `docker` ANYWHERE on this path, not only in the adapter literal: the active context is a
  // user setting, and a dev box can carry several VMs with unrelated containers. The runtime row
  // (e2e/security.ts §6d) proves the spawn line; this proves no second call site grows without one.
  // COMMENT LINES STRIPPED FIRST. This region discusses docker at length, and a pin that counts
  // prose counts the wrong thing — it failed exactly that way when first written (10 hits, every
  // one of them a sentence). Same lesson, same fix as the HARNESS_COMMS rule below.
  const serverExec = server.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  pin("every docker invocation server.ts emits pins its context (pinned, never ambient)",
    [...serverExec.matchAll(/\bdocker (?!--context )/g)].length === 0,
    [...serverExec.matchAll(/.{0,40}\bdocker (?!--context ).{0,40}/g)].map((m) => m[0]).join(" | ") || "none");
  // REPO_WORKER_KEYS is what /api/repo-worker will STORE; workerCmdFor is what actually resolves a
  // stored entry at a worker's call site. tsc holds neither to the other — both sides are a plain
  // WorkerName — so the two failures this invites are silent in opposite directions: a name in the
  // list with no call site is a setting the owner configures, sees echoed back, and which changes
  // nothing; a call site with no listed name is a resolution nobody can ever reach. The rule is
  // stated as set EQUALITY for that reason, not as one-way coverage.
  const declared = (serverExec.match(/const REPO_WORKER_KEYS: WorkerName\[\] = \[([^\]]*)\]/)?.[1] ?? "")
    .split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean);
  const resolved = [...new Set([...serverExec.matchAll(/workerCmdFor\("([A-Za-z]+)"/g)].map((m) => m[1]))];
  pin("server.ts yields a non-empty REPO_WORKER_KEYS (an unparsed one would make the rule below vacuous)",
    declared.length > 0, declared.join(", ") || "none");
  pin("every per-repo-configurable worker is resolved through workerCmdFor, and vice versa",
    declared.length === resolved.length && declared.every((k) => resolved.includes(k)),
    `declared=[${declared.join(", ")}] resolved=[${resolved.join(", ")}]`);
  // ...and the choice can only ever enter through a request: harnessIdOf reads a BODY, so a caller
  // that has no body cannot name a harness. Stated over the whole file so a third spawn path added
  // tomorrow is covered tomorrow.
  // call sites only — the declaration's parameter list is not a call, and it is the one occurrence
  // carrying a type annotation, so `:` is what separates the two
  // The accepted shape is `…Body`, not the single name `body`: the dispatch route already had a
  // `dBody` of its own when it gained the choice, and a rule that forced one spelling would have
  // been answered by renaming a variable rather than by keeping the property. What the rule is
  // actually about is the SOURCE — a readJson(req) result and never server state — and every such
  // variable in this file is named for it.
  const harnessSources = [...server.matchAll(/harnessIdOf\(([^)]*)\)/g)]
    .map((m) => m[1].trim()).filter((a) => !a.includes(":"));
  pin("a harness is only ever chosen from a request body, never from server state",
    harnessSources.length > 0 && harnessSources.every((a) => /^[a-z]*[Bb]ody$/.test(a)), harnessSources.join(" | "));
  // ...and every one of those names really is a parsed request body at its own site — the half the
  // name-shape rule above cannot see. A `const fooBody = someCache.get(...)` would satisfy the
  // spelling and break the property, which is the whole point of the rule.
  const bodyDecls = [...new Set(harnessSources)].filter((n) =>
    !new RegExp(`const ${n} = await readJson\\(req\\)`).test(server));
  pin("each of those body variables is a readJson(req) result, not a lookalike name",
    bodyDecls.length === 0, bodyDecls.join(" | ") || "all bound to readJson(req)");

  // --- the CLONE lane form. Its one reason to exist is that the working copy shares nothing with
  // the repo it came from — no object database, and therefore no `.git/hooks` reachable from a
  // sandbox that holds the tree. `git clone` from a local path HARDLINKS objects by default, so a
  // second call site written without --no-hardlinks would silently give back the very sharing the
  // form removes, and every check in the suite would still pass: the tree is correct, the boundary
  // is gone. Nothing in TypeScript can see that, and neither can a test that only reads git's
  // answers. Same comment-stripping as the docker rule above, same reason.
  // ANCHORED on the delimiter that makes `"clone"` an ARGV ELEMENT — a `,` or a `[` before it — and
  // not on the bare literal: the string also occurs as a VALUE now (Harness.laneForm), where
  // --no-hardlinks would be meaningless. The unanchored version failed on exactly that the day the
  // adapter gained the field, and a rule that fires on a line it cannot describe teaches its
  // readers to loosen it.
  const cloneArgv = /[,[]\s*"clone",(?! *"--no-hardlinks")/g;
  pin("every clone server.ts emits refuses hardlinked objects (a shared object DB is the boundary this form removes)",
    [...serverExec.matchAll(cloneArgv)].length === 0,
    [...serverExec.matchAll(/.{0,30}[,[]\s*"clone",(?! *"--no-hardlinks").{0,40}/g)].map((m) => m[0]).join(" | ") || "none");
  // ...and the OTHER half of the form: a clone's branch exists only in the clone until syncLaneRefs
  // mirrors it, so every root-side reader of it (the ancestry check, markLandIntent,
  // advanceIntegration) is reading a copy. The rule is that the copy is refreshed on the way in.
  // Stated as "the land path calls it" rather than as a list of readers, because the readers are
  // what will grow. A land site that skips it does not fail loudly — it fast-forwards main to an
  // earlier version of the lane, which is the worst failure this file guards against.
  const advCalls = [...serverExec.matchAll(/\badvanceIntegration\(/g)]
    .filter((m) => !/(async function|await advanceIntegration in)/.test(serverExec.slice(m.index - 30, m.index)));
  const advUnsynced = advCalls.filter((m) => !serverExec.slice(Math.max(0, m.index - 2500), m.index).includes("syncLaneRefs("));
  pin("every advanceIntegration call site refreshes the lane mirror first (a clone lands from the mirror, not from the tree)",
    advCalls.length > 0 && advUnsynced.length === 0,
    `${advCalls.length} call sites, ${advUnsynced.length} without a preceding syncLaneRefs`);
  // ...and WHO chooses the form. `createWorktree`'s third parameter defaults to "worktree", so a
  // new lane-creating path that simply omits it compiles and runs — and silently drops whatever
  // form the CALLER named (an explicit clone request would come back a worktree, torn down later
  // as the wrong thing). So the rule is that every caller ASKS, and it is
  // a rule over the source because the mistake is an ABSENCE — the same shape as the bolt above.
  // Deliberately about the call sites and not about laneFormOf's body: the resolution is one
  // function precisely so that the interesting question is who fails to call it.
  const cwCalls = [...serverExec.matchAll(/await createWorktree\(([^;]*?)\)/g)].map((m) => m[1]);
  const cwUnasked = cwCalls.filter((a) => !/\bform\b/.test(a.split(",").slice(2).join(",")));
  pin("every lane-creating call site asks laneFormOf for the form — none takes createWorktree's default",
    cwCalls.length >= 2 && cwUnasked.length === 0,
    `${cwCalls.length} call sites, ${cwUnasked.length} passing no form: ${cwUnasked.join(" | ") || "none"}`);
  // ...and the values those call sites pass really do come from the ONE resolution. A second
  // derivation ("if harness === codex then clone") would satisfy the rule above and be exactly the
  // drift the single function exists to prevent — it is how the adapter's answer and the request's
  // override come apart on one road and not the other.
  const formSources = [...new Set(cwCalls.map((a) => (a.split(",")[2] ?? "").trim().split(".")[0]))];
  const notFromLaneFormOf = formSources.filter((v) => !new RegExp(`(const ${v} = laneFormOf\\(|\\b${v}: LaneForm)`).test(server));
  pin("each of those form values is a laneFormOf result (or the parameter carrying one), not a second derivation",
    formSources.length > 0 && notFromLaneFormOf.length === 0, notFromLaneFormOf.join(" | ") || formSources.join(" | "));

  // --- every slot probe resolves its comm set PER SLOT. The git/alive tick, claudeAlive and the
  // fresh-pane send readiness wait must go through commsFor; a call that reaches back for the
  // fleet-wide HARNESS_COMMS would silently re-pin every slot to the server's own harness, which
  // is the exact defect b28ce533 was filed about — and it would break NO test, because on a claude
  // fleet the two answers agree for every claude slot. An absence again, so: a rule over the source.
  // The three legitimate readers are named, and each for a stated reason.
  // comment lines stripped first: this file DISCUSSES HARNESS_COMMS at length, and a pin that counts
  // prose counts the wrong thing — it failed exactly that way when first written (13 vs 5).
  const serverCode = server.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  const commsReaders = [...serverCode.matchAll(/HARNESS_COMMS/g)].length;
  const commsAllowed = [ // matched against the full source: these four are code, and one spans two lines
    /const HARNESS_COMMS: string\[\]/,                   // the declaration
    /return own \? \[\.\.\.own\] : HARNESS_COMMS;/,       // commsFor's default-adapter fallback
    /DECLARED_HARNESS = !IS_CLAUDE && HARNESS_COMMS\.length/, // the declared-harness definition
    /AUTHOR_COMMS = \[\.\.\.new Set\(\[\.\.\.HARNESS_COMMS, "claude"\]\)\]/, // wakeAuthor's superset
  ].filter((re) => re.test(server)).length;
  pin("HARNESS_COMMS has exactly its four named readers — the probe resolves per slot through commsFor",
    commsAllowed === 4 && commsReaders === 5, `${commsReaders} occurrences, ${commsAllowed}/4 named forms present`);
  const slotProbeArgs = [...server.matchAll(/paneAgentAt\(sess\(s\.id\), ([A-Za-z_]+(?:\(s\))?)\)/g)]
    .map((m) => m[1]);
  const sendStart = server.indexOf("async function sendText(");
  const sendBody = sendStart < 0 ? "" : server.slice(sendStart, server.indexOf("// --- scheduled prompts", sendStart));
  const sendLocalProbes = [...sendBody.matchAll(/paneAgentAt\(sess\(s\.id\), comms\)/g)].length;
  const sendProbeResolved = /const comms = commsFor\(s\);/.test(sendBody) && sendLocalProbes > 0;
  pin("every slot liveness/readiness probe resolves through commsFor(s), never the fleet-wide set",
    sendProbeResolved && slotProbeArgs.length > 0
      && slotProbeArgs.filter((a) => a === "comms").length === sendLocalProbes
      && slotProbeArgs.every((a) => a === "commsFor(s)" || a === "AUTHOR_COMMS" || a === "comms"),
    `${sendProbeResolved ? "send-resolved" : "send-unresolved"}: ${slotProbeArgs.join(" | ")}`);
  // Pane output is not readiness: tmux can repaint before the agent prints, and the agent can print
  // before its composer is ready. A separate openedAt guard first answers whether this pane could
  // still be booting; only then may the bounded probe loop run. It retains BOTH outcomes: settle
  // after the transition, or audited fall-through so an owner can still type into a newly opened
  // pane whose agent died. An established dead pane never enters this block and stays immediate.
  const sendCode = sendBody.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  const sendFreshnessGuard = /const mayStillBeBooting = s\.openedAt > 0\s*&& Date\.now\(\) - s\.openedAt < SEND_BOOT_FRESH_MS;\s*if \(mayStillBeBooting\) \{\s*const comms = commsFor\(s\);/.test(sendCode);
  const freshLiteral = /const SEND_BOOT_FRESH_MS = ([\d_]+);/.exec(server)?.[1];
  const waitLiteral = /const SEND_BOOT_WAIT_MS = ([\d_]+);/.exec(server)?.[1];
  const freshMs = Number(freshLiteral?.replaceAll("_", ""));
  const waitMs = Number(waitLiteral?.replaceAll("_", ""));
  const independentlySizedFreshness = freshMs >= 10_000 && waitMs > 0 && freshMs > waitMs;
  const sendTimeoutAt = sendCode.indexOf('audit("send_boot_timeout"');
  const sendDeliveryAt = sendCode.indexOf("const buf =", sendTimeoutAt);
  const timeoutStillDelivers = sendTimeoutAt >= 0 && sendDeliveryAt > sendTimeoutAt
    && !/\b(?:return|throw)\b/.test(sendCode.slice(sendTimeoutAt, sendDeliveryAt));
  pin("sendText boot readiness is freshness-guarded, probe-driven and bounded; timeout still delivers",
    sendFreshnessGuard
      && independentlySizedFreshness
      && !/\bs\.lastOutput\b/.test(sendCode)
      && sendLocalProbes >= 2
      && (sendCode.match(/\bSEND_BOOT_WAIT_MS\b/g) ?? []).length >= 2
      && sendCode.includes("bootSettleMs ?? DEFAULT_BOOT_SETTLE_MS")
      && timeoutStillDelivers,
    `fresh=${sendFreshnessGuard} windows=${freshMs}/${waitMs} output=${/\bs\.lastOutput\b/.test(sendCode)} probes=${sendLocalProbes} fallthrough=${timeoutStillDelivers}`);
  // ...and the POLICY is not the probe: aliveInfo (a gate) carries harnessAutomatable, agentInfo
  // (a fact) must not. Reversing them would either lie on the board or open the gates by accident.
  pin("the fact layer stays unconditional while the gate carries the harness policy",
    /agentInfo\.set\(s\.id, agentState\);/.test(server)
    && /aliveInfo\.set\(s\.id, \(agentState === "alive" \|\| agentState === "unprobed"\) && harnessAutomatable\(s\)\);/.test(server),
    "agentInfo unconditional + aliveInfo gated");
}

{
  // A CAST ON A NETWORK RESPONSE IS A CLAIM ABOUT A FOREIGN SURFACE, NOT A TYPE — and this one bit
  // twice on 2026-08-09, in two files, by two different authors, on the same field. Both wrote
  // `as { slots: Row[] }` with `awaiting` on Row. The poll does not carry `awaiting` (it lives on
  // laneSignalView, the STEWARD view), so `row.awaiting === "owner"` compiled and was `undefined`
  // forever: a probe that could never be green, failing as if the product's filter were broken.
  // tsc cannot see it — the cast is what makes it legal. Both fixtures were writing the flag into
  // fleet.json correctly; only the read asked the wrong surface. (8e2b3e5, then e2e/tasks.ts.)
  //
  // The rule is derived, not a list: whatever key names the poll's slot row emits TODAY are the
  // permitted ones. Deliberately over-permissive in one direction — the nested `share` object's own
  // keys land in the allowed set too — because the failure this guards is a name the payload cannot
  // produce AT ALL, and a pin that under-permits would fail on honest edits.
  // Several keys share one line (`id: s.id, cwd: s.cwd, ...`), so this must not anchor to line
  // start — that mistake was this pin's own first red, and it made honest files look guilty.
  const rowLiteral = /slots: slots\.map\(\(s\) => \{[\s\S]*?\n(\s*)\}\),/.exec(server)?.[0] ?? "";
  const emitted = new Set([...rowLiteral.matchAll(/([A-Za-z_]\w*):/g)].map((m) => m[1]!));
  const tsFiles = [
    ...readdirSync(ROOT).filter((f) => /^fleet-e2e[a-z-]*\.ts$/.test(f)),
    ...readdirSync(`${ROOT}/e2e`).filter((f) => f.endsWith(".ts")).map((f) => `e2e/${f}`),
  ];
  const offenders: string[] = [];
  let castsSeen = 0;
  for (const f of tsFiles) {
    const src = read(f);
    // ONLY the owner poll. The steward view (/api/steward/sessions) is cast the same way and DOES
    // carry doneLooking/stalled/hostCommits — matching on the cast shape alone accuses it wrongly,
    // which is what this pin did on its first run.
    for (const cast of src.matchAll(/get\("\/api\/sessions"\)[\s\S]{0,120}?\{\s*slots:\s*([A-Za-z_]\w*)\[\]\s*\}/g)) {
      const name = cast[1]!;
      const decl = new RegExp(`type ${name} = \\{([\\s\\S]*?)\\};`).exec(src);
      if (!decl) continue; // an imported/shared type is not this trap — it has a real declaration
      castsSeen++;
      // TOP-LEVEL fields only. A nested shape (`ctx: { pct, windowTokens }`) is built by a function,
      // never by the row literal, so descending into it accuses honest code — this pin's second red.
      let depth = 0, flat = "";
      for (const ch of decl[1]!) {
        if (ch === "{") { depth++; continue; }
        if (ch === "}") { depth--; continue; }
        if (depth === 0) flat += ch;
      }
      for (const field of flat.matchAll(/(?:^|[;\n,])\s*([A-Za-z_]\w*)\s*[?]?:/g)) {
        const k = field[1]!;
        if (!emitted.has(k)) offenders.push(`${f}: ${name}.${k}`);
      }
    }
  }
  if (!emitted.size || !castsSeen) {
    skip("no e2e cast over the /api/sessions poll names a field the payload cannot emit",
      `emitted=${emitted.size} casts=${castsSeen} — the derivation found nothing, which is not a pass`);
  } else {
    pin("no e2e cast over the /api/sessions poll names a field the payload cannot emit",
      offenders.length === 0,
      `${castsSeen} cast(s) over ${emitted.size} emitted keys; offenders=[${offenders}]`);
  }
}

// ================================================================================================
// 6. CLAUDE.md — the one steering document with no drift pin at all
// ================================================================================================
// Section 5 walks `docs/`. CLAUDE.md is not in `docs/`, and it is the document every session and
// every lane is told to obey FIRST — so it was the only one whose anchors nothing checked. Its
// anchors rot the same way a doc's do: `BACKLOG.md` moved to the attic, a script gets renamed, a
// `grep X server.ts` outlives the symbol, and the rulebook keeps sending readers at nothing.
//
// TWO CONSTRAINTS shape everything below, and both are the difference between a pin that survives
// and one that gets switched off within the week:
//
// (1) THREE-VALUED, like server.ts's `rulebookDrifted`. CLAUDE.md is gitignored: a lane holds a
//     COPY taken at spawn time. Absent → the rule is SKIPped under its own name. Present but
//     differing from the source checkout, or not comparable to it → findings print as WARN. Only a
//     copy that IS the source (main checkout) or matches it byte for byte is held hard. An old lane
//     did not break the anchor its old copy names, and a pin that reds every lane guards nothing.
//
// (2) NO CONTENT LEAVES THIS FILE. CLAUDE.md carries the deploy host and IP; this repo is public
//     and pin output lands in logs, reports and the land record. So the emitted detail is: the
//     violated rule's name, the line NUMBER, and the dead anchor itself — never the line it sits
//     on. The two extractors only ever yield tokens from narrow charsets (a path shape with no
//     whitespace; a grep needle), safe() truncates and redacts an IPv4 literal on top, and nothing
//     else in this section touches the text.
{
  const CLAUDE = "CLAUDE.md";
  const safe = (s: string): string =>
    s.replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "<ip>").slice(0, 60);

  // --- the three values. The source of a lane's copy is the checkout its worktree hangs off:
  // `.git` is a DIRECTORY in the main checkout and a FILE pointing at `…/.git/worktrees/<name>`
  // in a lane. Read, never shelled out to — this file is fs-only by design.
  let copy: string | null = null;
  try { copy = read(CLAUDE); } catch { /* absent → not comparable */ }
  const sourcePath = ((): string | null => {
    try {
      if (statSync(`${ROOT}/.git`).isDirectory()) return `${ROOT}/${CLAUDE}`; // the copy IS the source
      const m = /gitdir:\s*(\S+)/.exec(readFileSync(`${ROOT}/.git`, "utf8"));
      const i = m ? m[1].indexOf("/.git/worktrees/") : -1;
      return i > 0 ? `${m![1].slice(0, i)}/${CLAUDE}` : null;
    } catch { return null; }
  })();
  const source = ((): string | null => {
    try { return sourcePath ? readFileSync(sourcePath, "utf8") : null; } catch { return null; }
  })();
  const state = copy === null ? "absent" : source === null ? "unpaired" : source === copy ? "current" : "stale";
  const soft = state !== "current";

  // the rule NAMES are the same in every branch — a reader grepping the report for a rule must find
  // its row whether it passed, warned or was never evaluated
  const RULE_PATHS = "every path CLAUDE.md cites still resolves";
  const RULE_GREPS = "every grep CLAUDE.md sends the reader on still finds something";
  const RULE_SUBJ = "CLAUDE.md yields anchors of both classes (a rule with no subject is not a pass)";

  if (copy === null) {
    skip(RULE_SUBJ, `no rulebook in this tree (state=${state})`);
    skip(RULE_PATHS, "no rulebook in this tree");
    skip(RULE_GREPS, "no rulebook in this tree");
  } else {
    // --- what counts as a citation THIS repo can be held to. Three filters, each for a class of
    // false red that would otherwise land on a correct rulebook:
    //   · git-ignored → a runtime artifact (fleet.json, the .jsonl ledgers, graphify-out/). Its
    //     absence in a worktree is its normal state and proves nothing. Unparseable .gitignore →
    //     everything counts as ignored, i.e. the pin under-covers rather than cries.
    //   · absolute or under .git/ → not this tree's to own (`/tmp/fleet-e2e.lock`, `.git/index.lock`).
    //   · not attributable to this repo → a path whose first segment is not a directory that exists
    //     here (`demo/src/demo.ts` lives in the neighbouring demo repo, as this very file explains),
    //     and any BARE top-level `.ts`/`.json` name, which is the shape that repo's modules have
    //     too (`build.ts`) and cannot be told apart by name. Top-level `.sh` and `.md` stay in:
    //     those are ours, and a renamed wrapper or an attic'd register is the case this pin is for.
    const ignorePats = ((): string[] | null => {
      try { return read(".gitignore").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")); }
      catch { return null; }
    })();
    const ignored = (p: string): boolean => {
      if (ignorePats === null) return true;
      return ignorePats.some((raw) => {
        const pat = raw.replace(/\/+$/, "").replace(/^\/+/, "");
        const re = new RegExp(`^${pat.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}$`);
        return re.test(p) || (!pat.includes("/") && p.split("/").some((seg) => re.test(seg)));
      });
    };
    const topDirs = new Set(readdirSync(ROOT).filter((f) => { try { return statSync(`${ROOT}/${f}`).isDirectory(); } catch { return false; } }));
    const PATH_SHAPE = /^\.?\/?[A-Za-z0-9_][A-Za-z0-9_./-]*\.(?:md|ts|sh|json|jsonl|html|js|lock|plist|yml|yaml)$/;
    const attributable = (p: string): boolean => {
      if (p.startsWith("/") || p.startsWith(".git/") || ignored(p)) return false;
      const seg = p.split("/");
      return seg.length > 1 ? topDirs.has(seg[0]) : /\.(sh|md)$/.test(p);
    };

    const lines = copy.split("\n");
    // --- class A: a cited path that no longer resolves
    const deadPaths: string[] = [];
    let paths = 0;
    for (let i = 0; i < lines.length; i++)
      for (const t of new Set([...lines[i].matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()))) {
        if (!PATH_SHAPE.test(t)) continue;
        const p = t.replace(/^\.\//, "");
        if (!attributable(p)) continue;
        paths++;
        if (!exists(p)) deadPaths.push(`${CLAUDE}:${i + 1} ${safe(p)}`);
      }

    // --- class B: an errand the rulebook sends the reader on — `…, grep \`sym\`` — that finds
    // nothing. The needle is the backticked span AFTER the word; the haystack is the nearest
    // backticked .ts/.sh file named just before it, server.ts by default, which is the form every
    // one of these takes today. A `grep` INSIDE a backtick span is a shell command being quoted,
    // not an errand, and is left alone — that is what keeps the redaction probe (which names the
    // real host) out of this rule entirely.
    const deadGreps: string[] = [];
    let greps = 0;
    for (let i = 0; i < lines.length; i++)
      for (const m of lines[i].matchAll(/(?<!`)\bgrep\s+`([^`]+)`/g)) {
        const before = lines[i].slice(Math.max(0, m.index - 140), m.index);
        const named = [...before.matchAll(/`([^`]+\.(?:ts|sh))`/g)].map((x) => x[1]);
        const target = named.length ? named[named.length - 1] : "server.ts";
        greps++;
        let hay: string | null = null;
        try { hay = read(target); } catch { /* target itself is gone */ }
        if (hay === null) deadGreps.push(`${CLAUDE}:${i + 1} ${safe(target)} (target missing)`);
        else if (!hay.includes(m[1])) deadGreps.push(`${CLAUDE}:${i + 1} ${safe(m[1])} not in ${safe(target)}`);
      }

    // both classes non-empty, or the two rules below are measuring nothing and saying "fine"
    pin(RULE_SUBJ, paths > 0 && greps > 0, `state=${state}; ${paths} path(s), ${greps} grep errand(s)`);
    pin(RULE_PATHS, deadPaths.length === 0,
      `${state === "current" ? "" : `${state} copy — advisory; `}${deadPaths.join("; ")}`, soft);
    pin(RULE_GREPS, deadGreps.length === 0,
      `${state === "current" ? "" : `${state} copy — advisory; `}${deadGreps.join("; ")}`, soft);
  }
}

pin("e2e-isolated.sh explicitly arms server.ts's default-off migration tick (otherwise its runtime checks measure nothing)", /const MIGRATE_PCT = Number\(process\.env\.FLEET_MIGRATE_PCT \?\? 0\) \| 0/.test(server) && /\bFLEET_MIGRATE_PCT=[1-9]\d*\b/.test(read("e2e-isolated.sh")));

console.log(rows.join("\n"));
console.log(failed ? `\n${failed} FAILURES` : "\nALL PASS");
process.exit(failed ? 1 : 0);
