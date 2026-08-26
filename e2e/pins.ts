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
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  FRAGMENTS_FOR, FRAGMENT_BY_RULE_PREFIX, RULEBOOK_AUDIENCES, RULEBOOK_DIR, RULEBOOK_FRAGMENTS,
  RULEBOOK_BACKREF_HEADING,
  FRAGMENT_TITLES, fragmentFileName, renderRulebook, renderBackref, rulebookBody, type RulebookFragment,
} from "../rulebook";
import {
  SYSTEM_CAPABILITIES, SELF_GET_ADAPTER_PROBE, QUESTION_ROUTES,
  UNMODELED_CAPABILITY_DIMENSIONS, renderSystemCapabilities,
} from "../capability-map";
import { collectRepoMap, firstCommentLine, renderRepoMap } from "../repo-map";
import { CAPABILITY_FUNCTIONS } from "../src/protocol";
// The Fleet manifest rules below run the SAME pure functions the delivery seams run — a pin that
// re-implemented the validator would only pin its own copy of the rules.
import { CONTEXT_PACKS, CONTEXT_PACK_TRIGGERS } from "../context-packs";
import { readContextManifest } from "../context-manifest";
import { validUseWhen, validateContextPacks } from "../context-pack-validator";

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

// The checkout a lane's copies and private deployment configuration come FROM. `.git` is a
// DIRECTORY in the main checkout and a FILE pointing at `…/.git/worktrees/<name>` in a lane.
// Read, never write: the public-repo leak pin and sections 6/6b all need this source boundary.
const SOURCE_DIR = ((): string | null => {
  try {
    if (statSync(`${ROOT}/.git`).isDirectory()) return ROOT;
    const m = /gitdir:\s*(\S+)/.exec(readFileSync(`${ROOT}/.git`, "utf8"));
    const i = m ? m[1].indexOf("/.git/worktrees/") : -1;
    return i > 0 ? m![1].slice(0, i) : null;
  } catch { return null; }
})();

// ================================================================================================
// 0. Public-repository deployment identity
// ================================================================================================
// The forbidden values are private configuration, so writing them into this tracked probe would
// reproduce the leak it guards. Derive the configured hosts at runtime, then ask git to search
// only paths it tracks. A public clone has neither source; that is an explicit unprobed result.
{
  const RULE = "leak-pin: tracked files contain no configured deploy identity";
  const keys = ["FLEET_HOST", "FLEET_ALLOWED_HOSTS", "FLEET_SHARE_HOSTS"] as const;
  const configured = new Map<string, string>();
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) configured.set(key, value);
  }

  let sourceEnvPresent = false;
  let sourceEnvUnreadable = false;
  if (SOURCE_DIR !== null) {
    const path = `${SOURCE_DIR}/.env`;
    try {
      const envText = readFileSync(path, "utf8");
      sourceEnvPresent = true;
      for (const line of envText.split("\n")) {
        const match = /^(?:export\s+)?(FLEET_(?:HOST|ALLOWED_HOSTS|SHARE_HOSTS))\s*=\s*(.*)\s*$/.exec(line.trim());
        if (!match || configured.has(match[1])) continue;
        let value = match[2].trim();
        if ((value.startsWith("'") && value.endsWith("'"))
          || (value.startsWith('"') && value.endsWith('"'))) value = value.slice(1, -1);
        if (value) configured.set(match[1], value);
      }
    } catch {
      try { statSync(path); sourceEnvUnreadable = true; }
      catch { /* absent in a public clone is handled explicitly below */ }
    }
  }

  if (configured.size === 0 && sourceEnvUnreadable) {
    pin("leak-pin: identity source is readable", false, "source-checkout .env exists but could not be read");
  } else if (configured.size === 0 && !sourceEnvPresent) {
    skip("leak-pin: no identity source, unprobed", "FLEET identity env and source-checkout .env absent");
  } else {
    const publicExamples = /^(?:localhost|0\.0\.0\.0|127\.0\.0\.1|::|::1|100\.64\.0\.1)$/i;
    const reservedDomains = /(?:^|\.)(?:example\.(?:com|org|net)|example|invalid|test)$/i;
    const malformed: string[] = [];
    const hosts = [...new Set([...configured.values()].flatMap((value) => value.split(","))
      .map((entry) => {
        const raw = entry.trim();
        if (!raw) return null;
        try {
          return new URL(raw.includes("://") ? raw : `http://${raw}`).hostname.toLowerCase();
        } catch {
          malformed.push(raw);
          return null;
        }
      })
      .filter((host): host is string => host !== null && !publicExamples.test(host) && !reservedDomains.test(host)))];
    const identities = [...new Set(hosts.flatMap((host) => {
      const labels = host.split(".");
      const parent = !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) && labels.length >= 3
        ? labels.slice(1).join(".") : null;
      return parent && !reservedDomains.test(parent) ? [host, parent] : [host];
    }))];

    if (malformed.length > 0 || identities.length === 0) {
      pin("leak-pin: identity source is probeable", false,
        `${configured.size} configured field(s), ${malformed.length} malformed value(s), ${identities.length} searchable host(s)`);
    } else {
      const args = ["-C", ROOT, "grep", "-I", "-i", "-n", "-F"];
      for (const identity of identities) args.push("-e", identity);
      args.push("--");
      const probe = spawnSync("git", args,
        { encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" }, maxBuffer: 16 * 1024 * 1024 });
      if (probe.error || probe.status === null || probe.status > 1) {
        pin("leak-pin: tracked-file search probe completed", false,
          (probe.error?.message || probe.stderr || `git grep exited ${String(probe.status)}`).trim().slice(0, 160));
      } else if (probe.status === 1) {
        pin(RULE, true, `${identities.length} configured host(s) checked`);
      } else {
        const locations = probe.stdout.trim().split("\n").filter(Boolean)
          .map((line) => /^(.+?:\d+):/.exec(line)?.[1] ?? "tracked file (line unavailable)");
        pin(RULE, false, `${locations.length} hit(s): [${locations.join(", ")}]`);
      }
    }
  }
}

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

{
  // Clarifications and fleet reports are the only FleetEvent kinds without a Watch. Keep both
  // directions of that persisted discriminant coupled: accepting null on any Watch-backed kind
  // loses provenance, while requiring a string on either sibling invents a Watch that does not exist.
  const parser = server.slice(server.indexOf("function fleetEventFrom("),
    server.indexOf("function clarificationFrom("));
  const mint = server.slice(server.indexOf("async function openClarification("),
    server.indexOf("async function replyClarification("));
  const watchlessKinds = 'const watchless = e.kind === "clarification-request" || e.kind === "fleet-report";';
  const watchlessEquivalence = parser.includes(watchlessKinds)
    && parser.includes('    || (watchless !== (e.watchId === null))\n'
      + "    || !Number.isInteger(e.receiverSlot)");
  const nullMints = (mint.match(/watchId: null/g) ?? []).length;
  pin("FleetEvent watchId is null exactly for clarification-request and fleet-report, and a string for every Watch event",
    /watchId: string \| null/.test(server)
      && watchlessEquivalence
      && mint.includes("const event: ClarificationFleetEvent")
      && mint.includes("const event: FleetReportFleetEvent")
      && nullMints === 2
      && (server.match(/watchId: w\.id/g) ?? []).length >= 4,
    `equivalence=${watchlessEquivalence} nullMints=${nullMints}`);

  // The reply's truth boundary is tmux acceptance. Any answered assignment before sendText would
  // recreate the original bug: an API success/terminal row while the worker never got the text.
  const reply = server.slice(server.indexOf("async function replyClarification("),
    server.indexOf("async function acknowledgeFleetEvent("));
  const send = reply.indexOf("await sendText(worker, text, true);");
  const answered = reply.indexOf('request.status = "answered";');
  pin("clarification reply cannot set answered before successful sendText",
    send >= 0 && answered > send && !reply.slice(0, send).includes('request.status = "answered";'),
    `send=${send} answered=${answered}`);

  // The transport marker's whole value is its ORDER: persisted (awaited) before tmux is touched, so
  // a process death after that point is visible after restart instead of vanishing. Paired with the
  // prune contract, because a "terminal" that swallowed send-uncertain would delete exactly the row
  // that says this text may already be in the pane. Moving the assignment below sendText, dropping
  // its saveStateNow, or letting prune treat send-uncertain as terminal each makes this red.
  const uncertain = reply.indexOf('request.status = "send-uncertain";');
  const uncertainSaved = reply.indexOf("await saveStateNow();", uncertain);
  const prune = server.slice(server.indexOf("function pruneClarifications("),
    server.indexOf("const sameOccupant ="));
  pin("clarification reply persists send-uncertain before sendText and only answered|refused are terminal",
    uncertain >= 0 && uncertainSaved > uncertain && send > uncertainSaved
    && prune.includes('c.status === "answered" || c.status === "refused"'),
    `uncertain=${uncertain} saved=${uncertainSaved} send=${send} prune=${prune.includes('c.status === "answered" || c.status === "refused"')}`);

  // The owner-facing twin inherits the same crash boundary, so it inherits the same pin: the
  // send-uncertain marker is assigned and AWAITED to disk textually before its sendText, and only
  // answered|refused count as terminal for the prune. An answer that reached the pane while the row
  // said "open" — or a prune that swallowed send-uncertain — would each be invisible in exactly the
  // way this channel exists to prevent. Moving either assignment below sendText makes this red.
  const answer = server.slice(server.indexOf("async function answerAttention("),
    server.indexOf("async function refuseAttentionRequest("));
  const aSend = answer.indexOf("await sendText(requester, text, true);");
  const aUncertain = answer.indexOf('request.status = "send-uncertain";');
  const aSaved = answer.indexOf("await saveStateNow();", aUncertain);
  const aAnswered = answer.indexOf('request.status = "answered";');
  const aPrune = server.slice(server.indexOf("function pruneAttention("),
    server.indexOf("function boundProgramForMain("));
  pin("attention answer persists send-uncertain before sendText and only answered|refused are terminal",
    aUncertain >= 0 && aSaved > aUncertain && aSend > aSaved && aAnswered > aSend
    && aPrune.includes('a.status === "answered" || a.status === "refused"'),
    `uncertain=${aUncertain} saved=${aSaved} send=${aSend} answered=${aAnswered} prune=${aPrune.includes('a.status === "answered" || a.status === "refused"')}`);

  // The owner's own send inherits the same crash boundary and therefore the same rule: exactly one
  // sendText, inside a try, whose catch JOURNALS the attempt as uncertain. A bare `await sendText`
  // here is an untyped 500 that leaves no trace at all — the silent loss Cut 3 removes — and a
  // catch that returned without logPrompt would be the same loss wearing a status code.
  const sendRoute = server.slice(server.indexOf('url.pathname === "/send"'),
    server.indexOf('url.pathname === "/resize"'));
  const sTry = sendRoute.indexOf("try {");
  const sSend = sendRoute.indexOf("await sendText(");
  const sCatch = sendRoute.indexOf("} catch (e) {", sSend);
  const sLog = sendRoute.indexOf("logPrompt(", sCatch);
  const sUncertain = sendRoute.indexOf('"uncertain"', sLog);
  pin("the owner /send route sends inside a try and journals the attempt as uncertain in its catch",
    sendRoute.split("await sendText(").length === 2
    && sTry >= 0 && sSend > sTry && sCatch > sSend && sLog > sCatch && sUncertain > sLog,
    `sends=${sendRoute.split("await sendText(").length - 1} try=${sTry} send=${sSend} catch=${sCatch} log=${sLog} uncertain=${sUncertain}`);
}
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

  const RULE_LOCAL_PROOF = "AGENTS.md asks a lane's self/gate localProof before choosing local verification";
  if (agents === null) skip(RULE_LOCAL_PROOF, "no AGENTS.md in this tree");
  else pin(RULE_LOCAL_PROOF,
    agents.includes("`GET /api/self/gate`") && agents.includes("`localProof.steps`"),
    `self-gate=${agents.includes("`GET /api/self/gate`")} steps=${agents.includes("`localProof.steps`")}`);

  // The B2 split made a Fleet lane's private rulebook structurally partial. AGENTS.md used to
  // keep saying "full", "copied into each lane" and "read it completely" after that change,
  // sending Codex/Pi through the wholesale private load the split removed. Couple the public loader
  // claim to the executable audience partition so neither side can move alone again.
  const RULE_LOADER_BOUNDARY = "AGENTS.md names the partial lane overlay and never requires a wholesale private read";
  if (agents === null) skip(RULE_LOADER_BOUNDARY, "no AGENTS.md in this tree");
  else {
    const partialLane = FRAGMENTS_FOR.lane.length < RULEBOOK_FRAGMENTS.length;
    const namesPartial = agents.includes("smaller render plus explicit back-references");
    const rejectsWholesale = agents.includes("must not read it wholesale");
    const staleFullClaim = /full private operating rulebook|copied into each lane|Read it completely/.test(agents);
    pin(RULE_LOADER_BOUNDARY,
      partialLane ? namesPartial && rejectsWholesale && !staleFullClaim : !namesPartial,
      `lane=${FRAGMENTS_FOR.lane.length}/${RULEBOOK_FRAGMENTS.length}, partial-claim=${namesPartial}, `
      + `no-wholesale=${rejectsWholesale}, stale-full-claim=${staleFullClaim}`);
  }

  // THE SHARP ONE, both directions. A suite the gate runs that AGENTS.md omits sends a Codex lane
  // into the land under-verified; a suite AGENTS.md lists that the gate does not run makes the file
  // claim coverage nobody has. Same for the tsc entry list — the exact drift that left the tier-2
  // harness with no type coverage at all. Scoped to the fenced ```sh block so that prose ABOUT a
  // suite (this file names ./e2e-isolated.sh in the paragraph below it, correctly, as NOT a gate)
  // is not read as a claim to run it.
  // AND "EXACTLY" NOW MEANS THE WHOLE CHAIN, not two of its subsets. Until 2026-08-15 this rule
  // compared the SUITE names and the tsc entry list and nothing else, so the two steps that are
  // neither — `bun install` and `bun run build` — were unpinned in a rule whose name said
  // "exactly". `bun run build` had drifted out of VERIFY_CMD and stayed green here for as long as
  // anyone had looked: a break only the bundler can see (src/client.ts, src/share.ts) walked
  // through the land gate untouched, and AGENTS.md meanwhile told every lane to run it. A pin that
  // claims more than it compares is worse than none, because it makes the hole look guarded.
  //
  // The fix is to compare the ORDERED STEP SEQUENCE, and to do it against a THIRD side that
  // already had the answer: verify-proportion.ts's LOCAL_PROOF_STEPS is the vocabulary the server
  // hands a lane in `localProof.steps`, so it was recommending `build` to lanes the gate never ran.
  // Steps are located by first occurrence of an unambiguous marker and sorted by position, which
  // is why VERIFY_CMD's repo guard, its `|| { echo … }` handlers and its `;`/`&&` mix need no
  // parsing: what is compared is which steps appear and in what order, in all three files.
  const STEP_MARKERS: readonly [string, string][] = [
    ["install", "bun install"],
    ["pins", "bun e2e/pins.ts"],
    ["tsc", "bunx tsc"],
    ["build", "bun run build"],
    ["clean-review", "./e2e-clean-review.sh"],
    ["security", "./e2e-security.sh"],
    ["claude-gate", "./e2e-claude-gate.sh"],
  ];
  const stepsOf = (text: string): string[] => STEP_MARKERS
    .map(([step, marker]) => [step, text.indexOf(marker)] as const)
    .filter(([, at]) => at >= 0)
    .sort((a, b) => a[1] - b[1])
    .map(([step]) => step);
  // read as a FILE, not imported: this file is fs-only by design (see the header), and that keeps
  // verify-proportion.ts a pinned SIDE rather than a compile-time dependency of the pin.
  const proportion = ((): string[] => {
    let src = "";
    try { src = read("verify-proportion.ts"); } catch { return []; }
    const block = /export const LOCAL_PROOF_STEPS = \[([\s\S]*?)\]/.exec(src)?.[1] ?? "";
    return [...block.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
  })();

  const RULE_VERIFY = "AGENTS.md, watchdog.sh's VERIFY_CMD and LOCAL_PROOF_STEPS are the same ordered chain";
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
    // the step sequences, as strings so a failure names the drift instead of a boolean
    const docChain = stepsOf(fence).join(">");
    const gateChain = stepsOf(verifyCmd).join(">");
    const proofChain = proportion.join(">");
    pin(RULE_VERIFY,
      docSuites.length > 0 && docTsc.length > 0
      && !missSuite && !extraSuite && !missTsc && !extraTsc
      && proofChain.length > 0 && docChain === gateChain && docChain === proofChain,
      `chain doc=[${docChain}] gate=[${gateChain}] localProof=[${proofChain}]; `
      + `suites missing=[${missSuite}] extra=[${extraSuite}]; tsc missing=[${missTsc}] extra=[${extraTsc}]`);
  }

  const proportionalCmd = /const VERIFY_PROPORTIONAL_CMD = '([^']+)'/.exec(server)?.[1] ?? "";
  const proportionalSteps = stepsOf(proportionalCmd);
  pin("the docs-proportional server gate is exactly install then pins (pins are never optional)",
    proportionalCmd === "bun install --frozen-lockfile && bun e2e/pins.ts"
      && proportionalSteps.length === 2
      && proportionalSteps[0] === "install" && proportionalSteps[1] === "pins",
    `cmd=${JSON.stringify(proportionalCmd)} chain=[${proportionalSteps.join(">")}]`);

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
// 3b. Capability source -> generated map -> real server adapters
// ================================================================================================
// One source has to be able to say BOTH "this route exists" and "this function has no adapter".
// Otherwise get_project_context would be forced onto a neighbouring GET and recreate the exact
// false-capability defect this registry exists to prevent. The document is only a projection; the
// registry and server remain the two executable sides.
{
  const DOC = "docs/system-capabilities.generated.md";
  const rendered = renderSystemCapabilities();
  const generated = ((): string | null => { try { return read(DOC); } catch { return null; } })();
  pin("the generated system capability map is byte-for-byte fresh from capability-map.ts",
    generated !== null && generated === rendered,
    generated === null ? `${DOC} missing` : `rendered ${Buffer.byteLength(rendered)} B vs file ${Buffer.byteLength(generated)} B`);

  const declaredNames = SYSTEM_CAPABILITIES.map((capability) => capability.name);
  pin("the capability source declares exactly the two promoted stable functions, once and in order",
    declaredNames.length === 2 && new Set(declaredNames).size === declaredNames.length
      && CAPABILITY_FUNCTIONS.every((name, index) => declaredNames[index] === name),
    `[${declaredNames.join(",")}]`);

  // SYSTEM.md owns the stable vocabulary. The source may additionally hold adapter/probe datasets,
  // but neither their id nor a transport-shaped alias may become a function heading by accident.
  const system = read("SYSTEM.md");
  const vocabularyAt = system.indexOf("## Funktionen statt Routenwissen");
  const vocabularyEnd = vocabularyAt < 0 ? -1 : system.indexOf("\n## ", vocabularyAt + 3);
  const vocabularyBlock = vocabularyAt < 0 || vocabularyEnd < 0 ? "" : system.slice(vocabularyAt, vocabularyEnd);
  const systemFunctions = new Set([...vocabularyBlock.matchAll(/^- `([a-z_]+)`/gm)].map((match) => match[1]!));
  const stableBlock = generated === null ? ""
    : generated.slice(generated.indexOf("## Stable functions"), generated.indexOf("## Current adapter/probe datasets"));
  const stableHeadings = [...stableBlock.matchAll(/^### `([a-z_]+)`/gm)].map((match) => match[1]!);
  const foreignFunctions = CAPABILITY_FUNCTIONS.filter((name) => !systemFunctions.has(name));
  const foreignHeadings = stableHeadings.filter((name) => !systemFunctions.has(name));
  pin("every stable function comes from SYSTEM.md while the Self GET stays an adapter/probe dataset",
    systemFunctions.size > 0 && foreignFunctions.length === 0 && foreignHeadings.length === 0
      && stableHeadings.length === declaredNames.length
      && stableHeadings.every((name, index) => name === declaredNames[index])
      && SELF_GET_ADAPTER_PROBE.id === "self_get_adapter_probe",
    `system=[${[...systemFunctions].join(",")}] stable=[${stableHeadings.join(",")}] foreign-source=[${foreignFunctions.join(",")}] foreign-heading=[${foreignHeadings.join(",")}] dataset=${SELF_GET_ADAPTER_PROBE.id}`);

  // Derive HTTP pairs from the actual route conditions. All current self handlers keep their
  // pathname and accepted methods on the same condition line; collecting every method on that
  // line handles both the single-method form and the GET-or-POST form without a route inventory.
  const serverPairs = new Set<string>();
  for (const line of server.split("\n")) {
    const route = /url\.pathname === "(\/api\/[^"]+)"/.exec(line)?.[1];
    if (!route) continue;
    for (const method of line.matchAll(/req\.method === "([A-Z]+)"/g))
      serverPairs.add(`${method[1]} ${route}`);
  }
  const adapters = [
    ...SYSTEM_CAPABILITIES.map((capability) => ({ owner: capability.name, adapter: capability.adapter })),
    { owner: SELF_GET_ADAPTER_PROBE.id, adapter: SELF_GET_ADAPTER_PROBE.adapter },
    ...QUESTION_ROUTES.map((route) => ({ owner: `question:${route.role}`, adapter: route.adapter })),
  ];
  const unresolved = adapters.filter((entry) => entry.adapter !== null
    && !serverPairs.has(`${entry.adapter.method} ${entry.adapter.route}`));
  pin("every non-null capability and question adapter resolves as the declared method on server.ts",
    unresolved.length === 0,
    unresolved.map((entry) => `${entry.owner}=${entry.adapter!.method} ${entry.adapter!.route}`).join(", "));

  // A null adapter may cite a checked neighbour only in the explicit REJECTED grammar. Route text
  // anywhere else would still read as a promise in the generated entry, despite `adapter: null`.
  const rejected = /^Rejected neighbor: (GET|POST) (\/api\/\S+) returns .+, not .+\.$/;
  const falsePromises: string[] = [];
  for (const capability of SYSTEM_CAPABILITIES) {
    if (capability.adapter !== null) continue;
    const outsideGaps = JSON.stringify({ ...capability, gaps: [] });
    if (/\/api\//.test(outsideGaps)) falsePromises.push(`${capability.name}: route outside gaps`);
    for (const gap of capability.gaps)
      if (/\b(?:GET|POST) \/api\//.test(gap) && !rejected.test(gap))
        falsePromises.push(`${capability.name}: ${gap}`);
  }
  pin("an unsupported capability names no route except an explicitly rejected checked neighbour",
    falsePromises.length === 0, falsePromises.join(" | "));

  const project = SYSTEM_CAPABILITIES.find((capability) => capability.name === "get_project_context");
  const projectRejected = project?.gaps.filter((gap) => rejected.test(gap)) ?? [];
  pin("get_project_context is a measured absence with both non-equivalent Self GET neighbours named",
    project?.adapter === null
      && project.gaps.some((gap) => gap.includes("authoritative project sources and selectable packs"))
      && projectRejected.some((gap) => gap.includes("GET /api/self/programs") && gap.includes("Program content"))
      && projectRejected.some((gap) => gap.includes("GET /api/self/program-execution") && gap.includes("execution state")),
    project ? project.gaps.join(" | ") : "entry missing");

  const describe = SYSTEM_CAPABILITIES.find((capability) => capability.name === "describe_self");
  const safe = SELF_GET_ADAPTER_PROBE;
  const missingDescribeFacts = ["Role", "Authority", "Capabilities", "active Act"];
  pin("describe_self exposes only the real Self payload and names every unimplemented SYSTEM.md promise",
    describe?.adapter?.method === "GET" && describe.adapter.route === "/api/self"
      && missingDescribeFacts.every((fact) => describe.gaps.some((gap) => gap.includes(fact))),
    describe ? `gaps=[${describe.gaps.join(" | ")}]` : "entry missing");
  pin("the named adapter/probe dataset is the every-session read-only Self GET with the scoped header credential",
    safe.adapter.method === "GET" && safe.adapter.route === "/api/self"
      && safe.adapter.credential === "header x-fleet-self-token"
      && safe.adapter.roleCondition === "any current session with cwd"
      && safe.stateEffect === "none" && safe.gaps.length === 0,
    `${safe.adapter.method} ${safe.adapter.route}; ${safe.adapter.credential}; ${safe.adapter.roleCondition}`);

  // Read the top-level keys of GET /api/self's object literal, ignoring comments and its nested
  // `lane` object. The registry therefore cannot silently gain or lose a returned field while its
  // route continues to exist and the broad route pin stays green.
  const selfAt = server.indexOf('if (url.pathname === "/api/self" && req.method === "GET")');
  const returnAt = selfAt < 0 ? -1 : server.indexOf("return json({\n        slot:", selfAt);
  const returnEnd = returnAt < 0 ? -1 : server.indexOf("\n      });", returnAt);
  const objectText = returnAt < 0 || returnEnd < 0 ? ""
    : server.slice(returnAt + "return json({".length, returnEnd)
      .split("\n").map((line) => line.replace(/\/\/.*$/, "")).join("\n");
  const selfFields = new Set<string>();
  let depth = 1;
  for (let i = 0; i < objectText.length;) {
    const ch = objectText[i]!;
    if (ch === "{") { depth++; i++; continue; }
    if (ch === "}") { depth--; i++; continue; }
    if (depth === 1 && /[A-Za-z_]/.test(ch)) {
      const word = /^[A-Za-z_]\w*/.exec(objectText.slice(i))?.[0] ?? "";
      let after = i + word.length;
      while (/\s/.test(objectText[after] ?? "")) after++;
      if (word && objectText[after] === ":") selfFields.add(word);
      i += Math.max(1, word.length);
      continue;
    }
    i++;
  }
  const fieldDrift = (fields: readonly string[]): string[] => [
    ...fields.filter((field) => !selfFields.has(field)).map((field) => `declared-only:${field}`),
    ...[...selfFields].filter((field) => !fields.includes(field)).map((field) => `server-only:${field}`),
  ];
  const describeDrift = describe ? fieldDrift(describe.returns) : ["describe_self missing"];
  const safeDrift = fieldDrift(safe.returns);
  pin("describe_self and the Self adapter/probe dataset declare exactly the fields GET /api/self returns",
    selfFields.size > 0 && describeDrift.length === 0 && safeDrift.length === 0,
    `server=[${[...selfFields].join(",")}] drift=[${[...describeDrift, ...safeDrift].join(",")}]`);

  const laneQuestion = QUESTION_ROUTES.find((route) => route.role === "lane");
  const mainQuestion = QUESTION_ROUTES.find((route) => route.role === "program-main");
  const supervisorQuestion = QUESTION_ROUTES.find((route) => route.role === "supervisor");
  const clarificationRouteAt = server.indexOf('if (url.pathname === "/api/self/clarifications"');
  const clarificationRouteBody = clarificationRouteAt < 0 ? ""
    : server.slice(clarificationRouteAt, server.indexOf("const selfClarificationReply", clarificationRouteAt));
  const clarificationOpenAt = server.indexOf("async function openClarification(");
  const clarificationOpenBody = clarificationOpenAt < 0 ? ""
    : server.slice(clarificationOpenAt, server.indexOf("async function replyClarification(", clarificationOpenAt));
  const attentionRouteAt = server.indexOf('if (url.pathname === "/api/self/attention"');
  const attentionRouteBody = attentionRouteAt < 0 ? ""
    : server.slice(attentionRouteAt, server.indexOf("const selfEventAck", attentionRouteAt));
  const attentionOpenAt = server.indexOf("async function openAttention(");
  const attentionOpenBody = attentionOpenAt < 0 ? ""
    : server.slice(attentionOpenAt, server.indexOf("function attentionFor(", attentionOpenAt));
  const serverQuestionCuts = /if \(!s\.worktree\)/.test(clarificationRouteBody)
    && /clarificationReceiverFor\(s\)/.test(clarificationOpenBody)
    && /receiver: resolved\.receiver/.test(clarificationOpenBody)
    && /const MAX_CLARIFICATION_QUESTION = 2000;/.test(server)
    && /clarifications\.find\(/.test(clarificationOpenBody)
    && !/body\.receiver/.test(clarificationOpenBody)
    && /if \(s\.worktree && s\.label !== STEWARD_LABEL\)/.test(attentionRouteBody)
    && /boundProgramForMain\(s\)/.test(attentionOpenBody)
    && /programId: program\.id/.test(attentionOpenBody)
    && !/body\.programId/.test(attentionOpenBody);
  pin("question return paths preserve the lane->derived Program-MAIN and bound Program-MAIN->owner role cuts",
    laneQuestion?.adapter?.route === "/api/self/clarifications"
      && laneQuestion.adapter.method === "POST" && laneQuestion.adapter.roleCondition === "lane only"
      && laneQuestion.recipient.includes("request.receiver")
      && laneQuestion.constraints.some((constraint) => constraint.includes("at most 2000"))
      && laneQuestion.constraints.some((constraint) => constraint.includes("Exactly one"))
      && mainQuestion?.adapter?.route === "/api/self/attention"
      && mainQuestion.adapter.method === "POST"
      && mainQuestion.adapter.roleCondition === "non-lane current bound MAIN of an active Program"
      && mainQuestion.recipient === "owner"
      && mainQuestion.constraints.some((constraint) => constraint.includes("programId is derived"))
      && supervisorQuestion?.adapter === null
      && serverQuestionCuts,
    `lane=${laneQuestion?.adapter?.method ?? "none"} ${laneQuestion?.adapter?.route ?? "none"}; main=${mainQuestion?.adapter?.method ?? "none"} ${mainQuestion?.adapter?.route ?? "none"}; supervisor=${supervisorQuestion?.adapter === null ? "unsupported" : "adapter"}; server-cuts=${serverQuestionCuts}`);

  // Every HTTP pair printed anywhere in the generated document — adapters AND explicitly rejected
  // neighbours — must resolve. Source-symbol anchors are held by declarations, not line numbers.
  const generatedPairs = generated === null ? []
    : [...generated.matchAll(/\b(GET|POST) (\/api\/[A-Za-z0-9_./:-]+)/g)].map((match) => `${match[1]} ${match[2]}`);
  const deadGenerated = generatedPairs.filter((pair) => !serverPairs.has(pair));
  const capabilitySource = read("capability-map.ts");
  const protocolSource = read("src/protocol.ts");
  pin("every route and source symbol named by the generated capability map resolves in this tree",
    generatedPairs.length > 0 && deadGenerated.length === 0
      && /export const SYSTEM_CAPABILITIES\b/.test(capabilitySource)
      && /export const SELF_GET_ADAPTER_PROBE\b/.test(capabilitySource)
      && /export const QUESTION_ROUTES\b/.test(capabilitySource)
      && /export const UNMODELED_CAPABILITY_DIMENSIONS\b/.test(capabilitySource)
      && /export interface SystemCapability\b/.test(protocolSource)
      && /export interface CapabilityAdapter\b/.test(protocolSource),
    `${generatedPairs.length} route mention(s), dead=[${deadGenerated.join(",")}]`);

  const dimensions = new Map(UNMODELED_CAPABILITY_DIMENSIONS.map((row) => [row.dimension, row.gap]));
  pin("UI gesture, trace effect and harness support remain explicit unmodeled follow-up dimensions",
    dimensions.size === 3
      && ["uiGesture", "traceEffect", "harnessSupport"].every((name) => dimensions.get(name as never)?.includes("not modeled"))
      && generated?.includes("## Dimensions not yet modeled") === true,
    `[${[...dimensions].map(([name, gap]) => `${name}:${gap}`).join(" | ")}]`);
}

// ================================================================================================
// 3c. Repo top level -> generated repo map
// ================================================================================================
// `rg` finds only what the searcher can already spell, and nothing named this repo's ten top-level
// directories in one place: `lerntisch/` and `studio-kit/` appeared in no start-context file, and
// `task-waves.ts` in no prose at all (docs/messungen/video-codebase-klarheit-2026-08-25.md §2.4).
// docs/repo-map.generated.md is that name list. Same fastener as 3b — the document is a projection,
// the repo's own top level is the executable side — plus one rule 3b does not need: the document is
// held against an INDEPENDENT enumeration too, because a renderer that dropped a row would drop it
// from both sides of a freshness comparison and the pin would go green on a shorter map.
{
  const DOC = "docs/repo-map.generated.md";
  const RULE_MAP = "the generated repo map names every top-level directory and entry file";
  const probe = collectRepoMap(ROOT);
  const generated = ((): string | null => { try { return read(DOC); } catch { return null; } })();
  if (!probe.ok) {
    // A probe that could not run must fail as ITSELF. "git named no paths" is not "the map is stale".
    pin(`${RULE_MAP} — PROBE: git named the repo's top level`, false, probe.detail);
  } else if (generated === null) {
    pin(`${RULE_MAP} — PROBE: the generated map is readable`, false, `${DOC} missing; run \`bun repo-map.ts\``);
  } else {
    const rendered = renderRepoMap(probe.facts);
    pin("the generated repo map is byte-for-byte fresh from repo-map.ts",
      generated === rendered,
      `rendered ${Buffer.byteLength(rendered)} B vs file ${Buffer.byteLength(generated)} B`);

    // The independent side: enumerate the top level again, straight from git, and require a row for
    // each name. This is what catches a new top-level file whose author never re-rendered.
    const ls = spawnSync("git", ["-C", ROOT, "ls-files", "--cached", "-z"],
      { encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" }, maxBuffer: 16 * 1024 * 1024 });
    if (ls.error || ls.status !== 0) {
      pin(`${RULE_MAP} — PROBE: the independent enumeration ran`, false,
        (ls.error?.message || ls.stderr || `git ls-files exited ${String(ls.status)}`).trim().slice(0, 160));
    } else {
      const paths = ls.stdout.split("\0").filter(Boolean);
      const wantDirs = [...new Set(paths.filter((p) => p.includes("/")).map((p) => p.slice(0, p.indexOf("/"))))];
      const wantFiles = paths.filter((p) => !p.includes("/") && (p.endsWith(".ts") || p.endsWith(".sh")));
      const missing = [
        ...wantDirs.filter((name) => !generated.includes(`\n- \`${name}/\` — `)).map((name) => `${name}/`),
        ...wantFiles.filter((name) => !generated.includes(`\n- \`${name}\` — `)),
      ];
      const counted = /^## Directories \((\d+)\)$/m.exec(generated)?.[1];
      const countedFiles = /^## Top-level `\.ts` and `\.sh` files \((\d+)\)$/m.exec(generated)?.[1];
      pin(RULE_MAP,
        missing.length === 0 && counted === String(wantDirs.length) && countedFiles === String(wantFiles.length),
        `${wantDirs.length} dir(s) / ${wantFiles.length} file(s) on disk, doc says ${counted}/${countedFiles}; missing=[${missing.join(",")}]`);
    }

    // A row whose sentence is unavailable must SAY so. The whole defect this map answers is a thing
    // that was present but unnamed, so an empty sentence rendered as nothing would rebuild it.
    const unsentenced = [...probe.facts.directories, ...probe.facts.files].filter((entry) => entry.note === null);
    const marked = generated.split("**no sentence**").length - 1;
    pin("every top-level entry without a sentence renders a visible marker instead of an empty row",
      marked === unsentenced.length,
      `${unsentenced.length} without a header comment or a DIRECTORY_NOTES entry [${unsentenced.map((e) => e.name).join(",")}], ${marked} marker(s) in the doc`);

    // The sentences are the FILES' OWN first comment lines. Held against the files directly, so a
    // renderer that started inventing prose — or reading a second line — is a red, not a nicer map.
    const drifted = probe.facts.files.filter((entry) => {
      if (entry.note === null) return false;
      let source: string;
      try { source = read(entry.name); } catch { return true; }
      return firstCommentLine(source) !== entry.note;
    });
    pin("a file's sentence in the map is that file's own first comment line and nothing else",
      drifted.length === 0, `[${drifted.map((e) => e.name).join(",")}]`);
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
    /sweepBusy \|\| !ANALYSIS_ON/.test(sweepBody)
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
  // THE BRIEF COMPILER IS A SECOND MODE, not a shade of the first. One number used to switch both,
  // so these rules exist to keep the split from silently collapsing back: its own fact, its own
  // guard, its own registration, and — the load-bearing one — a sweep that writes no reading.
  const briefFactDefs = [...executableServer.matchAll(/const BRIEF_ON = BRIEF_TICK_MS > 0;/g)];
  pin("one plainly named server fact derives brief-compiler mode from its own configured cadence",
    briefFactDefs.length === 1, `${briefFactDefs.length} BRIEF_ON definition(s)`);
  const briefStart = server.indexOf("async function tickBriefSweep");
  const briefBody = briefStart < 0 ? "" : server.slice(briefStart, server.indexOf("async function tickAnalysisSweep", briefStart));
  const briefCode = briefBody.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  pin("BRIEF_ON feeds the brief sweep guard and its only scheduler registration",
    /sweepBusy \|\| !BRIEF_ON/.test(briefBody)
      && /if \(BRIEF_ON\) setInterval\([^\n]*tickBriefSweep[^\n]*, BRIEF_TICK_MS\);/.test(executableServer));
  pin("the compiler sweep compiles and never judges: no analyst switch, no verdict, no reading",
    briefCode.length > 0 && !briefCode.includes("ANALYSIS_ON")
      && !briefCode.includes("recordAnalysisVerdict") && !briefCode.includes(".analysis"),
    briefCode.length ? "" : "tickBriefSweep not found");
  pin("exactly one site writes a machine-compiled brief, and both sweeps go through it",
    [...executableServer.matchAll(/\.brief = \{ text, at: Date\.now\(\), model: SUMMARY_MODEL, edited: false \}/g)].length === 1
      && [...executableServer.matchAll(/await compileBriefs\(/g)].length === 2);
  pin("the owner poll carries the compiler mode as its own fact, omitted at zero",
    /analysis: \{ on: ANALYSIS_ON \},\s*\.\.\.\(BRIEF_ON \? \{ briefCompiler: \{ on: true \} \} : \{\}\),/.test(executableServer)
      && client.includes("briefCompilerOn = data.briefCompiler?.on;")
      && /classifyAnalystOffWarning\(\{\s*analysisOn,\s*briefCompilerOn,/.test(client)
      && warning.includes("input.briefCompilerOn === true"));

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

// ContextPlan's first production consumer is the founding-brief seam. The import is the cheap
// cross-file fact a compiler cannot protect against: deleting the consumer would leave both pure
// modules and their unit tests green while restoring the dead island this cut exists to end.
pin("server.ts imports and calls the pure ContextPlan producer at the dispatch delivery seam",
  /from "\.\/context-plan";/.test(server) && /const base = planContext\(planFacts\);/.test(server));

// ...and its SECOND consumer, the two mutating workers. Same argument, one seam further: the pure
// plan checks in e2e/context-plan.ts assert the facts→plan mapping and would stay green with the
// server.ts wiring deleted. Held EXACT at two call sites, and the suffix form is part of the rule —
// appending is what keeps runWorker's contract-mark check satisfied, and computing the plan at the
// call site is what keeps the other nine workers from inheriting landing rules through WorkerSpec.
{
  const appended = [...server.matchAll(/\$\{await landingAnchorBlock\(root\)\}`, cwd\);/g)].length;
  pin("the merge and repair workers each append the landing anchors, and no shared runner hands them to anyone else",
    appended === 2
    && /const sourceTree = await dispatchSourceTree\(root\)\.catch\(\(\) => null\);\n  if \(sourceTree === null\) return "";/.test(server)
    && /async function landingAnchorBlock\(root: string\): Promise<string> \{/.test(server)
    && /triggers: \["landing"\],/.test(server)
    && [...server.matchAll(/landingAnchorBlock\(/g)].length === appended + 1
    && !/interface WorkerSpec \{[^}]*plan/.test(server),
    `${appended} call-site append(s)`);
}

{
  // WHICH TREE A SEAM IS DELIVERING INTO IS DERIVED, NEVER DECLARED. A hard-coded `sourceTree`
  // does not fail loudly: the packs resolve for the seam's author (who is inside Fleet) and the
  // receipt asserts them against some other repository's head — the only failure mode in this
  // subsystem where the LEDGER becomes untrue rather than the delivery merely poor. Dispatch
  // carried exactly that literal until 2026-08-16, with its own admission comment above it.
  //
  // A RULE, NOT A SNAPSHOT, so it binds the next seam too: no assignment of `sourceTree` may open
  // with a string, and every one of the two classifiers that may produce it must decide by
  // comparing a git toplevel against FLEET_REPO_ROOT. The conditional form
  // (`sourceTree: frame === … ? "fleet" : "foreign"`) is deliberately allowed — the literals there
  // are the branches of a derivation, and banning the token everywhere would only push the same
  // constant one alias further away.
  //
  // The comparison count is held EXACT and every occurrence is named below, so an unnamed new one
  // still trips this rule. Since 2026-08-18 there are three, and only the first two classify a
  // delivery seam: refineValidationFor answers the same fleet/foreign question for the refine
  // acceptance (whether LOCAL_PROOF_STEPS describes the target tree at all), which reaches no
  // receipt and no pack — it is listed here to keep the count honest, not because it delivers.
  const literal = [...server.matchAll(/sourceTree:\s*"/g)].length;
  const classifiers = [...server.matchAll(/=== FLEET_REPO_ROOT\b/g)].length;
  pin("no delivery seam declares its sourceTree — every planContext caller derives it from a repository-root comparison",
    literal === 0 && classifiers === 3
    && /async function dispatchSourceTree\(repo: string\): Promise<"fleet" \| "foreign"> \{\n  const repoRoot = await repoRootOf\(repo\);/.test(server)
    && /const sourceTree = await dispatchSourceTree\(wt\.repo\);/.test(server)
    && /const frame: ProgramMainFrame = FLEET_REPO_ROOT !== null && repoRoot === FLEET_REPO_ROOT/.test(server)
    && /tree: snapshot === null \? null\n\s*: FLEET_REPO_ROOT !== null && snapshot\.repo === FLEET_REPO_ROOT \? "fleet" : "foreign",/.test(server),
    `${literal} literal sourceTree assignment(s), ${classifiers} FLEET_REPO_ROOT comparison(s)`);
}

{
  // THE MANIFEST IS READ AT A COMMIT, NEVER FROM A WORKING TREE. A target repository declares its
  // own packs in a tracked `.fleet/context-packs.json`, and the receipt asserts `head` — so a
  // working-tree read would receipt an anchor that commit does not carry, and the receipt is the
  // only thing a later reader has. That failure is silent by construction: the anchors resolve for
  // whoever is standing in the dirty tree and for nobody else, ever again.
  //
  // A RULE, NOT A SNAPSHOT: the path constant lives in the pure module, no filesystem reader may
  // name that path, and the seam's one blob reader must be spelled `git show <head>:<path>`.
  const manifest = read("context-manifest.ts");
  const fsReaders = [...server.matchAll(/(?:readFileSync|readFile|Bun\.file)\s*\([^)\n]*(?:CONTEXT_MANIFEST_PATH|\.fleet\/context-packs\.json)/g)];
  const seamFrom = server.indexOf("async function showAtHead(");
  const seamTo = server.indexOf("\nfunction buildProgramMainBrief(");
  const seam = seamFrom > 0 && seamTo > seamFrom ? server.slice(seamFrom, seamTo) : "";
  pin("the repo context manifest is read only via `git show` at the preflight head, never from a working tree",
    /const CONTEXT_MANIFEST_PATH = "\.fleet\/context-packs\.json";/.test(manifest)
    && [...server.matchAll(/"\.fleet\/context-packs\.json"/g)].length === 0
    && fsReaders.length === 0 && seam !== ""
    && /gitRead\(repoRoot, "show", `\$\{head\}:\$\{path\}`\)/.test(seam)
    && /showAtHead\(repoRoot, head, CONTEXT_MANIFEST_PATH/.test(seam),
    `${fsReaders.length} filesystem reader(s), seam=${seam.length} bytes`);
}

{
  // ============================================================================================
  // FLEET'S OWN MANIFEST — unlandable while invalid
  // ============================================================================================
  // Since 2026-08-19 the fleet-control frame reads `.fleet/context-packs.json` too, so this repo
  // declares its own packs as a tracked JSON commit instead of a TypeScript change plus a deploy.
  // The price of that convenience is that a typo in a JSON file can silently empty an anchor block
  // at every delivery seam: planRepoContext turns a defect into an omission row, which is honest
  // and completely invisible unless someone reads a receipt. This pin is the gate — `bun e2e/pins.ts`
  // is step 1 of the land chain, so an invalid Fleet manifest cannot reach main.
  //
  // The probe runs the SAME pure functions the server runs (readContextManifest + the shared
  // validator), fed the SAME kind of facts: paths git actually tracks and the referenced files'
  // actual bytes. A probe that could not gather those facts fails UNDER ITS OWN NAME below —
  // "could not be read" must never be spelled as "the manifest is invalid".
  const MANIFEST = ".fleet/context-packs.json";
  const RULE_MANIFEST = "Fleet's own context manifest is valid at every rule the delivery seam applies";
  let manifestText: string | null = null;
  try { manifestText = read(MANIFEST); } catch { manifestText = null; }
  const lsFiles = spawnSync("git", ["-C", ROOT, "ls-files", "-z"],
    { encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" }, maxBuffer: 16 * 1024 * 1024 });
  if (manifestText === null)
    pin(`${RULE_MANIFEST} — PROBE: the tracked manifest is readable`, false,
      `${MANIFEST} could not be read; it is tracked and every seam reads it`);
  else if (lsFiles.status !== 0)
    pin(`${RULE_MANIFEST} — PROBE: git named the tracked paths`, false,
      (lsFiles.stderr || `git ls-files exited ${String(lsFiles.status)}`).trim().slice(0, 160));
  else {
    const trackedPaths = new Set(lsFiles.stdout.split("\0").filter(Boolean));
    const manifest = readContextManifest(manifestText);
    if (manifest.kind !== "packs")
      pin(RULE_MANIFEST, false, manifest.kind === "invalid" ? manifest.detail : "the tracked manifest parses as absent");
    else {
      const sourceBytes = new Map<string, string>();
      const unreadable: string[] = [];
      for (const path of manifest.referencedPaths) {
        try { sourceBytes.set(path, read(path)); } catch { unreadable.push(path); }
      }
      const result = validateContextPacks({ packs: manifest.packs, repo: { trackedPaths, sourceBytes }, capabilities: new Map() });
      const errors = result.issues.filter((issue) => issue.severity === "error");
      const seedIds = new Set<string>(CONTEXT_PACKS.map((pack) => pack.id));
      const records = manifest.packs.filter((pack): pack is Record<string, unknown> =>
        typeof pack === "object" && pack !== null && !Array.isArray(pack));
      const noUseWhen = records.filter((pack) => !validUseWhen(pack.useWhen))
        .map((pack) => String(pack.id ?? "?"));
      const collisions = records.map((pack) => String(pack.id ?? "?")).filter((id) => seedIds.has(id));
      // useWhen is OPTIONAL to the shared validator on purpose (a target repo's manifest may predate
      // the field). FLEET'S OWN manifest is held to the stricter rule the code seeds already meet:
      // a pointer this repo publishes about itself without saying WHEN it is needed is a pointer a
      // lane must open to find out, which is the cost the whole v2 block exists to avoid.
      pin(RULE_MANIFEST, errors.length === 0 && unreadable.length === 0
        && records.length === manifest.packs.length && noUseWhen.length === 0 && collisions.length === 0,
        `${manifest.packs.length} pack(s); errors=[${errors.map((i) => `${i.code}:${i.packId}`).join(",")}]`
        + ` unreadable=[${unreadable}] no-useWhen=[${noUseWhen}] seed-collision=[${collisions}]`);
    }
  }
}

{
  // ============================================================================================
  // TRIGGER REACHABILITY — a pack whose trigger no seam ever passes is shelf-ware
  // ============================================================================================
  // MEASURED 2026-08-19 over every context receipt on the ledger: the trigger histogram contains
  // `always` and `verification` and nothing else. Three call sites in server.ts are the entire
  // supply of triggers, and only these three:
  //   DISPATCH_CONTEXT_TRIGGERS   — the dispatch delivery seam
  //   BOOTSTRAP_CONTEXT_TRIGGERS  — Program-MAIN / Supervisor founding and succession
  //   landingAnchorBlock          — the two mutating merge workers, `triggers: ["landing"]`
  // A pack whose triggers all lie outside that union can never be selected anywhere. That is a
  // legitimate state (a seam that will pass them is not built yet) but it must be DECLARED, not
  // discovered — otherwise a pack is authored, validated, committed, and silently never delivered.
  //
  // WHY THIS PIN GREPS THE THREE NAMED CALL SITES AND NEVER A BARE LITERAL — do not "simplify" it:
  // counting `"verification"` across server.ts is counting phantoms. That literal also appears as a
  // JSON KEY inside a WORKER_CONTRACTS template (the worker-contract block, unrelated to context
  // packs), and it has already falsified one Supervisor count of this exact question. Binding to
  // the constant names and to landingAnchorBlock's own body is the same real-call-site-vs-phantom
  // separation the rulebook means when it says to reach for ast-grep instead of grep.
  const RULE_REACH = "every active context pack has a trigger some delivery seam actually passes";
  const triggersOf = (source: string): string[] =>
    [...source.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
  const constTriggers = (name: string): string[] | null => {
    const m = new RegExp(`const ${name}: readonly ContextPackTrigger\\[\\] = \\[([^\\]]*)\\]`).exec(server);
    return m ? triggersOf(m[1]) : null;
  };
  const landingFrom = server.indexOf("async function landingAnchorBlock(root: string)");
  const landingBody = landingFrom < 0 ? "" : server.slice(landingFrom, server.indexOf("\n}", landingFrom));
  const landingTriggers = /triggers: \["landing"\],/.test(landingBody) ? ["landing"] : null;
  const dispatchTriggers = constTriggers("DISPATCH_CONTEXT_TRIGGERS");
  const bootstrapTriggers = constTriggers("BOOTSTRAP_CONTEXT_TRIGGERS");

  if (!dispatchTriggers || !bootstrapTriggers || !landingTriggers)
    pin(`${RULE_REACH} — PROBE: all three delivery call sites were located`, false,
      `dispatch=${dispatchTriggers ?? "not found"} bootstrap=${bootstrapTriggers ?? "not found"} landing=${landingTriggers ?? "not found"}`);
  else {
    const reaching = new Set([...dispatchTriggers, ...bootstrapTriggers, ...landingTriggers]);
    // DORMANT — triggers with ZERO literals at those three call sites, listed in full and on
    // purpose. Each is ruled by a seam Fleet has not built and the owner has not decided on:
    // `task-queue` (no queue-reading seam plans context), `harness-selection` (adapter choice
    // happens before any plan is derived), `deployment` (Verb 2 derives no plan at all).
    // A SHORT list here would be worse than none: it would pass while asserting that the trigger
    // it forgot is reachable, so the set is held EXACTLY equal to the complement of the union.
    const DORMANT = ["task-queue", "harness-selection", "deployment"];
    const complement = CONTEXT_PACK_TRIGGERS.filter((trigger) => !reaching.has(trigger));
    pin(`${RULE_REACH} — the dormant list is exactly the triggers no seam passes`,
      JSON.stringify([...complement].sort()) === JSON.stringify([...DORMANT].sort()),
      `union=[${[...reaching].sort()}] complement=[${[...complement].sort()}] declared-dormant=[${[...DORMANT].sort()}]`);

    const active: { id: string; triggers: string[] }[] = CONTEXT_PACKS
      .filter((pack) => pack.status === "active")
      .map((pack) => ({ id: pack.id, triggers: [...pack.triggers] }));
    let manifestRead = "";
    try {
      const manifest = readContextManifest(read(".fleet/context-packs.json"));
      if (manifest.kind !== "packs") manifestRead = `manifest ${manifest.kind}`;
      else for (const pack of manifest.packs) {
        if (typeof pack !== "object" || pack === null || Array.isArray(pack)) continue;
        const record = pack as Record<string, unknown>;
        if (record.status !== "active" || !Array.isArray(record.triggers)) continue;
        active.push({ id: String(record.id ?? "?"), triggers: record.triggers.map(String) });
      }
    } catch { manifestRead = "manifest unreadable"; }
    const stranded = active.filter((pack) => !pack.triggers.some((trigger) => reaching.has(trigger)))
      .filter((pack) => !pack.triggers.every((trigger) => (DORMANT as readonly string[]).includes(trigger)))
      .map((pack) => `${pack.id}[${pack.triggers}]`);
    if (manifestRead)
      pin(`${RULE_REACH} — PROBE: the Fleet manifest's active packs were read`, false, manifestRead);
    else
      pin(RULE_REACH, stranded.length === 0,
        `${active.length} active pack(s); stranded=[${stranded.join(" ")}]`);
  }
}

{
  const routeStart = server.indexOf('if (url.pathname === "/api/context-receipts"');
  const routeBody = routeStart < 0 ? "" : server.slice(routeStart, server.indexOf("\n    }", routeStart));
  pin("context-receipts.jsonl is one ledger constant shared by its append-only writer and owner reader route",
    /const CONTEXT_RECEIPT_FILE = `\$\{import\.meta\.dir\}\/context-receipts\.jsonl`;/.test(server)
    && /appendEvent\(CONTEXT_RECEIPT_FILE, \{/.test(server)
    && /readLedger<Record<string, unknown>>\(CONTEXT_RECEIPT_FILE\)/.test(routeBody),
    routeBody ? `${routeBody.length} route bytes` : "reader route missing");

  // EVERY writer carries the brief pair, and the count is asserted so a sixth delivery seam cannot
  // be added silently without it. Absent on a row means "written before the field existed" — a
  // date — so one writer omitting it would forever read as an old row instead of a gap. The two
  // values are a PAIR by construction: briefHash without briefSource cannot say by which route the
  // bytes were authored, and briefSource without briefHash joins nothing.
  const receiptWrites = [...server.matchAll(/appendEvent\(CONTEXT_RECEIPT_FILE, \{[\s\S]*?\n\s*\}\);/g)]
    .map((m) => m[0]);
  pin("every context-receipt writer carries briefHash AND briefSource — the ledger has one row shape, not two",
    receiptWrites.length === 5
    && receiptWrites.every((w) => /briefHash: briefHashOf\(deliveredBrief\)/.test(w)
      && /briefSource(: FOUNDING_BRIEF_SOURCE)?,/.test(w)),
    `${receiptWrites.length} writer(s), ${receiptWrites.filter((w) => !/briefHash/.test(w)).length} without briefHash`);
  // The set is CLOSED at the type, and every literal in it is produced by something: four by the
  // dispatch-seam derivation, the fifth by the founding constant. A value in the union that no
  // writer can emit is a category the ledger promises and never delivers.
  const briefSourceType = /type BriefSource = ([^;]+);/.exec(server)?.[1] ?? "";
  pin("BriefSource is a closed set whose every literal has a producer",
    briefSourceType.trim() === '"compiled" | "owner" | "raw" | "clarify" | "founding"'
    && /if \(clarify\) return "clarify";/.test(server)
    && /if \(!t\.brief\) return "raw";/.test(server)
    && /t\.brief\.edited \|\| t\.brief\.model === "owner" \? "owner" : "compiled"/.test(server)
    && /const FOUNDING_BRIEF_SOURCE: BriefSource = "founding";/.test(server),
    briefSourceType.trim() || "no BriefSource type");

  // ...and the READER of that ledger carries the same two sets, in a second file, as literal arrays.
  // tsc holds neither to the other — two independent literal unions are both perfectly well typed —
  // so a sixth briefSource or a renamed disposition would leave briefstats.ts silently booking real
  // rows as `unknownSource` or as malformed, which is a hole that reads like data. Stated as a set
  // comparison rather than as a copied list, so a value added tomorrow is covered tomorrow.
  const briefstats = read("briefstats.ts");
  const literals = (src: string): string[] =>
    [...src.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]!).sort();
  const readerSources = literals(/export const BRIEF_SOURCES = \[([^\]]+)\]/.exec(briefstats)?.[1] ?? "");
  pin("briefstats.ts's BRIEF_SOURCES is server.ts's BriefSource union, value for value",
    readerSources.length === 5 && readerSources.join() === literals(briefSourceType).join(),
    `reader=[${readerSources}] server=[${literals(briefSourceType)}]`);
  const dispositionType = /type LaneDisposition = ([^;]+);/.exec(server)?.[1] ?? "";
  const readerDispositions = literals(/export const LANE_DISPOSITIONS = \[([^\]]+)\]/.exec(briefstats)?.[1] ?? "");
  pin("briefstats.ts's LANE_DISPOSITIONS is server.ts's LaneDisposition union, value for value",
    readerDispositions.length === 5 && readerDispositions.join() === literals(dispositionType).join(),
    `reader=[${readerDispositions}] server=[${literals(dispositionType)}]`);
}

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
  // THE ONE SOURCE, at the one call a tick can make. The tick MAY now hand dispatchTask a spawn —
  // but only the ROW's own persisted, SET-time-validated choice, through the one accessor
  // (taskSpawnOf = t.spawn ?? DEFAULT_SPAWN). Any other argument here — a request value, an env
  // default, a computed harness — is the change that would hand an unattended lane an agent nobody
  // validated at set time, and it is invisible to tsc (the parameter accepts any DispatchSpawn) and
  // to every runtime test on a fleet with FLEET_HARNESS_AUTOMATION off, which is every suite.
  // one nested paren level, because the expected argument list itself contains a call
  const tickCalls = [...tBody.matchAll(/dispatchTask\(((?:[^()]|\([^()]*\))*)\)/g)].map((m) => m[1].trim());
  pin("the tick's dispatch call carries the ROW's persisted choice through taskSpawnOf and nothing else",
    tickCalls.length === 1 && tickCalls[0] === "next, free, false, false, taskSpawnOf(next)",
    tickCalls.join(" | ") || "no dispatchTask call");
  // ...and the accessor itself stays the one bridge from a row to a choice: the row's own field,
  // DEFAULT_SPAWN on absence. A second derivation, or a fallback to anything but DEFAULT_SPAWN,
  // is how "which agent would this row run" grows two answers.
  pin("taskSpawnOf is the row field or DEFAULT_SPAWN — nothing else can answer for a row's agent choice",
    /const taskSpawnOf = \(t: Task\): DispatchSpawn => t\.spawn \?\? DEFAULT_SPAWN;/.test(server),
    server.match(/const taskSpawnOf[^\n]*/)?.[0] ?? "taskSpawnOf missing");
  // ...and the tick's own row gate asks the SAME automatability predicate before reserving a slot,
  // writing the refusal on the row: a stored non-automatable choice must wait loudly, never fall
  // back to the default adapter and never sit silent.
  pin("the tick refuses a non-automatable row choice through harnessAutomatableFor and says so on the row",
    /const rowH = harnessOf\(rowSpawn\.harness\);/.test(tBody)
    && /if \(!harnessAutomatableFor\(rowH\)\) \{/.test(tBody)
    && /waiting\(`waiting: harness \$\{rowH\.id\} is not automatable/.test(tBody),
    tBody.match(/harnessAutomatableFor[^\n]*/)?.[0] ?? "no row gate");
  // THE TWO CAPS AND THEIR ORDER, pinned as SHAPE because no runtime test can see the difference
  // between "the program cap narrows the repo cap" and "the program cap replaced it". A later
  // refactor that hoists the program check above the repo check, or that drops the repo check for
  // rows carrying a programId, still passes every behavioural check written with the per-program
  // cap set BELOW the repo cap — which is the only configuration a test ever exercises — while
  // silently permitting programs × per-program lanes on a fixed slot board.
  const repoCapIdx = tBody.indexOf("if (lanes >= DISPATCH_MAX_LANES)");
  const progGuardIdx = tBody.indexOf("if (next.programId) {");
  const progCapIdx = tBody.indexOf("programLanes >= DISPATCH_MAX_LANES_PER_PROGRAM");
  pin("the repo lane cap is checked UNCONDITIONALLY and BEFORE the per-program one — the second cap can only narrow",
    repoCapIdx > 0 && progGuardIdx > repoCapIdx && progCapIdx > progGuardIdx
    // six spaces = the candidate loop's own body level: the repo check sits under no further `if`
    && /\n      if \(lanes >= DISPATCH_MAX_LANES\) \{/.test(tBody),
    JSON.stringify({ repoCapIdx, progGuardIdx, progCapIdx }));
  // NO NULL BUCKET. `s.programId === next.programId` alone is true for every unbracketed row against
  // every unbracketed lane, so without the truthy guard the cap would silently bind rows whose only
  // shared property is that nobody bracketed them. The `s.cwd &&` is the second half of the same
  // rule: openSlot clears programId, but a cap counting slots it has not proven occupied is a cap on
  // history rather than on load.
  const progCount = tBody.match(/const programLanes = [^;]+;/)?.[0] ?? "";
  pin("the per-program cap fires only for a row that NAMES a program, and counts only OCCUPIED slots of that program",
    /\n      if \(next\.programId\) \{/.test(tBody)
    && /slots\.filter\(\(s\) => s\.cwd && s\.programId === next\.programId\)\.length/.test(progCount),
    progCount || "no programLanes count");
  // The two caps write onto the SAME row, so the owner can only tell which one held from the words.
  // A refactor that reuses the repo cap's sentence would leave the board unable to distinguish them.
  const capNotes = [...tBody.matchAll(/waiting\(`(waiting: [^`]*)`\)/g)].map((m) => m[1]);
  const repoNote = capNotes.find((n) => n.includes("lanes busy in ${basename(repo)}")) ?? "";
  const progNote = capNotes.find((n) => n.includes("lanes busy in program")) ?? "";
  pin("each lane cap names ITSELF on the row — the repo one names the repo, the program one names the program",
    !!repoNote && !!progNote && repoNote !== progNote && !repoNote.includes("program"),
    JSON.stringify({ repoNote, progNote }));
  // ...and WHAT EACH CAP DOES TO THE SWEEP, which is a different rule from the two above and the
  // one no runtime test can see on a single-repo fleet: the per-repo cap must hold ITS OWN ROW and
  // let the sweep walk on. It used to `return`, so one saturated project stopped the whole tick and
  // every unrelated repo's queue starved behind it while its row displayed an ordinary-looking
  // wait-note. The behavioural half is the two-repo regression in e2e/tasks.ts (e3); this is the
  // structural half, because a fleet with one repo — which is every suite fixture by default —
  // cannot tell `return` from `continue` at all. `no free slot` is deliberately asserted as the
  // OPPOSITE: it is the one genuinely fleet-wide resource here, and it must still stop the tick.
  const capStmt = tBody.match(/if \(lanes >= DISPATCH_MAX_LANES\) \{[^\n]*\}/)?.[0] ?? "";
  const freeStmt = tBody.match(/if \(!free\) \{[^\n]*\}/)?.[0] ?? "";
  pin("the repo cap holds only its own row, never the sweep — it continues, while the fleet-wide 'no free slot' still returns",
    /\bcontinue;\s*\}$/.test(capStmt) && !/\breturn;/.test(capStmt)
    && /\breturn;\s*\}$/.test(freeStmt),
    JSON.stringify({ capStmt: capStmt.slice(0, 200), freeStmt }));
  // THE SECOND LOCK, for the case the absence above cannot cover: a future unattended caller that
  // does pass one. Same two conditions as every other unattended path (the operator's env flag AND
  // the adapter's own claim), so a harness added tomorrow inherits the refusal rather than the
  // permission — the mistake the comms repair exists to undo, one field to the right.
  pin("dispatchTask refuses a foreign harness on an UNATTENDED call — the flag and the adapter's claim, both",
    /!ownerAct && !\(HARNESS_AUTOMATION && spawnH\.automatable\)/.test(dBody),
    dBody.match(/spawnH[^\n]*/)?.[0]?.slice(0, 140) ?? "no unattended guard");
  // ACP-16 · THE SECOND RELEASE DOOR. Three rules over the SOURCE, because none of the three is
  // visible at runtime: a handler that read `programId` off a request would answer happily on every
  // request that happens not to carry one; a bare `t.status = "queued"` would record nothing and
  // look identical to a release; and a harness gate asking a DIFFERENT question than the tick's
  // would only be wrong on the fleet where the two answers differ.
  const relStart = server.indexOf("async function releaseTaskForMain(");
  const relBody = relStart < 0 ? "" : server.slice(relStart, server.indexOf("\n}\n", relStart));
  pin("releaseTaskForMain's body is bounded and non-empty (an unbounded slice would make the rules below vacuous)",
    relStart > 0 && relBody.length > 500 && relBody.length < 20_000, `${relBody.length} bytes`);
  // Both halves of "the caller cannot nominate its own work": the program comes from the binding
  // and the repo from the caller's checkout, and the handler mentions neither a request nor a body
  // at all — the strongest form of the /api/self/autos rule, which merely IGNORES a `slot` field.
  pin("the Program-MAIN release door DERIVES program and repo — no request field can nominate either",
    relBody.length > 0
      && /const bound = boundProgramForMain\(s\);/.test(relBody)
      && /t\.programId !== program\.id/.test(relBody)
      && /const mainRepo = await repoKeyOf\(s\);/.test(relBody)
      && /repoCanon\(target\) !== mainRepo/.test(relBody)
      && !/\bbody\b/.test(relBody) && !/\breq\b/.test(relBody),
    relBody.length > 0 ? "derivation" : "releaseTaskForMain missing");
  const relRouteAt = server.indexOf("const selfTaskRelease = ");
  const relRouteBody = relRouteAt < 0 ? ""
    : server.slice(relRouteAt, server.indexOf("const selfEventAck", relRouteAt));
  pin("the release route hands its handler nothing but the token's own slot and the path id",
    relRouteAt > 0 && relRouteBody.length > 0
      && /return releaseTaskForMain\(s, selfTaskRelease\[1\]\);/.test(relRouteBody)
      && !/readJson/.test(relRouteBody),
    relRouteBody.length > 0 ? "no body read" : "release route missing");
  // THE TRANSITION HAS ONE WRITER, and the rule is stated in both directions: every release goes
  // through releaseTask (so `by` cannot be forgotten), and the direct writes of "queued" stay the
  // helper's own line plus the two documented restores that are deliberately NOT releases — the
  // requeue after a failed post-spawn gate and the boot reconcile of an orphaned `sent` row.
  const releaseCalls = [...server.matchAll(/(?<!function )releaseTask\(([^)]*)\)/g)].map((m) => m[1].trim());
  pin("releaseTask has exactly the two known call sites — the owner's ▸ queue and the Program-MAIN door",
    releaseCalls.length === 2 && releaseCalls.includes('t, "owner"') && releaseCalls.includes('t, "machine"'),
    releaseCalls.join(" | ") || "no releaseTask call");
  const queuedWrites = (server.match(/\bstatus = "queued";/g) ?? []).length;
  pin("\"queued\" is written by releaseTask plus exactly the two documented non-release restores",
    queuedWrites === 3
      && /function releaseTask\(t: Task, by: "owner" \| "machine"\): void \{\n  t\.status = "queued";/.test(server),
    `${queuedWrites} direct writes of status = "queued"`);
  // ACP-23 · THE FILING DOOR, and it gets rules over the SOURCE for the same reason its release
  // neighbour has three: not one of them is visible at runtime on a green fleet. A handler that
  // read `programId` off the request would answer happily on every request that happens not to
  // carry one; a status assembled from the body instead of written as a literal would look
  // identical until the first caller spelled `queued`; and an open-ended body would drop a field
  // the caller believed was honoured.
  const crStart = server.indexOf("async function createTaskForMain(");
  const crBody = crStart < 0 ? "" : server.slice(crStart, server.indexOf("\n}\n", crStart));
  pin("createTaskForMain's body is bounded and non-empty (an unbounded slice would make the rules below vacuous)",
    crStart > 0 && crBody.length > 500 && crBody.length < 20_000, `${crBody.length} bytes`);
  pin("the Program-MAIN filing door DERIVES program and repo and reads a CLOSED body — text, kind, and the spawn triple",
    crBody.length > 0
      && /const bound = boundProgramForMain\(s\);/.test(crBody)
      && /programId: program\.id,/.test(crBody)
      && /const mainRepo = await repoKeyOf\(s\);/.test(crBody)
      && /repo: mainRepo,/.test(crBody)
      && /if \(body\.programId !== undefined\)/.test(crBody)
      && /const SELF_TASK_FIELDS = \["text", "kind", "harness", "model", "effort"\];/.test(crBody)
      && /Object\.keys\(body\)\.filter\(\(k\) => !SELF_TASK_FIELDS\.includes\(k\)\)/.test(crBody),
    crBody.length > 0 ? "derivation + closed body" : "createTaskForMain missing");
  // THE SPAWN TRIPLE HAS ONE SET-TIME VALIDATOR, and both create doors go through it: the same
  // three adapter validators the attended route runs, harness first. A door that stored the three
  // fields raw — or its own re-derivation — would mint a choice no adapter ever judged, and on a
  // suite fleet nothing at runtime distinguishes that from the validated path until dispatch.
  pin("both task-create doors validate the spawn triple through taskSpawnFromBody and persist it only when chosen",
    [...server.matchAll(/const spawnChoice = taskSpawnFromBody\(body\);/g)].length === 2
    && [...server.matchAll(/\.\.\.\(spawnChoice\.spawn \? \{ spawn: spawnChoice\.spawn \} : \{\}\),/g)].length === 2,
    `${[...server.matchAll(/taskSpawnFromBody\(body\)/g)].length} validator call(s)`);
  // FILING IS NOT RELEASING, and the whole separation rests on this one line staying a literal.
  // Both directions: the status is written as `"pending"`, and the two spellings that would turn a
  // filing into a release — a `queued` anywhere in this handler, or a `releasedBy` stamp — are
  // absent. A row that arrives released would bypass nothing at the tick, but it would erase the
  // deliberate second act the owner's promotion made the condition of the first.
  // Read over the CODE only: the two absences are rules about what this handler DOES, and the
  // paragraphs above it name both spellings while explaining why neither is written.
  const crCode = crBody.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  pin("a filed row arrives pending as a LITERAL — the filing door writes no other status and stamps no releasedBy",
    crCode.length > 0
      && /\n    status: "pending", created: Date\.now\(\), slot: null, note: null,\n/.test(crCode)
      && !/releasedBy/.test(crCode) && !/"queued"/.test(crCode),
    crCode.match(/\n    status: [^\n]*/)?.[0]?.trim() ?? "no status line");
  // THE TRAP A NEW `source` SETS, held as a SET COMPARISON. loadState filters the persisted task
  // list through a LITERAL allowlist of source values, and tsc holds it to nothing at all: the
  // array is a `string[]`, the union is a type, and neither knows about the other. A producer whose
  // value is missing there writes rows that survive every runtime probe of its own route and then
  // VANISH at the next boot — silently, with the whole suite green, in a place no probe of the
  // writing door can reach. Stated as a set rather than as a copied list, so a fifth source added
  // tomorrow is covered tomorrow.
  const taskSourceUnion = /\n  source: ("owner"[^;\n]*);\n/.exec(server)?.[1] ?? "";
  const taskLoadAllowed = /&& \[([^\]]+)\]\.includes\(\(x as Task\)\.source\)/.exec(server)?.[1] ?? "";
  const srcLiterals = (s: string): string[] => [...s.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]!).sort();
  pin("loadState's task-source allowlist is the Task['source'] union, value for value — a source it omits is dropped at the next boot",
    srcLiterals(taskSourceUnion).length === 4
      && srcLiterals(taskSourceUnion).join() === srcLiterals(taskLoadAllowed).join(),
    `union=[${srcLiterals(taskSourceUnion)}] allowlist=[${srcLiterals(taskLoadAllowed)}]`);
  // …and the OTHER load-time reader of the same field, which decides what a MALFORMED row's kind
  // degrades to. A main row falling to `auftrag` would promote an advisory filing into the one
  // executable category across a reload — the safe default has to name this producer too.
  const loadKindStart = server.indexOf("const loadTaskKind = (");
  const loadKindBody = loadKindStart < 0 ? "" : server.slice(loadKindStart, server.indexOf("\n};\n", loadKindStart));
  pin("loadTaskKind's safe default is advisory for BOTH producers whose door defaults to notiz",
    loadKindBody.length > 0
      && /return source === "steward" \|\| source === "main" \? "notiz" : "auftrag";/.test(loadKindBody),
    loadKindBody.match(/return source[^\n]*/)?.[0] ?? "loadTaskKind missing");

  // ONE PREDICATE for "may an unattended path drive this harness", asked by the slot-level gate and
  // by the release door about the adapter the TICK would spawn for THIS row (taskSpawnOf — the
  // row's persisted choice, DEFAULT_SPAWN on absence, whose accessor the pin above locks). Both
  // named conditions must stay inside it: a helper reduced to `return true` falls here, and on a
  // suite fleet with FLEET_HARNESS_AUTOMATION=0 nothing else would notice.
  const hafStart = server.indexOf("function harnessAutomatableFor(");
  const hafBody = hafStart < 0 ? "" : server.slice(hafStart, server.indexOf("\n}\n", hafStart));
  pin("the unattended-harness question is ONE predicate carrying both conditions — the operator's flag AND the adapter's own claim",
    hafBody.length > 0
      && /if \(h === CLAUDE_HARNESS\) return true;/.test(hafBody)
      && /return HARNESS_AUTOMATION && h\.automatable;/.test(hafBody)
      && /return harnessAutomatableFor\(harnessOf\(s\.harness\)\);/.test(server)
      && /const spawnH = harnessOf\(taskSpawnOf\(t\)\.harness\);/.test(relBody)
      && /if \(!harnessAutomatableFor\(spawnH\)\)/.test(relBody),
    hafBody.length > 0 ? "shared predicate" : "harnessAutomatableFor missing");
  // The bolt above is generic (it names no adapter), which is what makes it cover an adapter added
  // tomorrow. This one is specific and belongs next to it: the CONTAINER adapter's automatable is an
  // owner decision that has NOT been made, so it fails closed — and unlike pi's `true`, nothing at
  // runtime can tell a wrong `true` from a right one on a fleet with FLEET_HARNESS_AUTOMATION off
  // (which is every suite). An absence again, so: a rule over the source, scoped to that adapter's
  // own object literal rather than the file, or a `automatable: false` anywhere would satisfy it.
  const cStart = server.indexOf("const CONTAINER_HARNESS: Harness = {");
  const cBody = cStart < 0 ? "" : server.slice(cStart, server.indexOf("\n};\n", cStart));
  // The upper bound is a VACUITY guard (an unfound terminator must not let the slice swallow the
  // declarations after it), never a size policy on the adapter. It was 8_000 and started failing on
  // a legitimate comment in 2026-08-21's effort cut — shrinking prose to fit a magic number is
  // editing the thing the pin guards in order to satisfy the pin, so the number moved instead. It
  // still guards what it was written for: server.ts is two orders of magnitude larger than this.
  pin("the container adapter's literal is bounded and non-empty (an unfound one would make the rule below vacuous)",
    cStart > 0 && cBody.length > 500 && cBody.length < 12_000, `${cBody.length} bytes`);
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
  const xCode = xBody.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
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
  // Resume is the same paired-decision shape. `pinsSession` MUST remain false (fresh Codex accepts
  // no id), while supports.resume is sound only because tickGit owns an exact-cwd, user-thread,
  // UUID-validated rollout discovery seam and ensureSlot rechecks the exact id suffix before use.
  pin("the codex adapter advertises resume ONLY beside exact lazy rollout discovery (one decision, two fields)",
    /\n  pinsSession: false,/.test(xBody) && /\n    resume: true,/.test(xBody)
      && /async function tickCodexRecovery\(s: Slot\)/.test(server)
      && /meta\.threadSource !== "user" \|\| meta\.cwd !== s\.cwd/.test(server)
      && /CODEX_UUID_RE\.test\(p\.id\)/.test(server)
      && /await codexRolloutForId\(priorSessionId\)/.test(server)
      && !xCode.includes("--last"),
    xBody.match(/(?:pinsSession|resume): (?:true|false)/g)?.join(" | ") ?? "resume pair absent");
  // The attended route is a persistence seam, not a second recovery engine. This rule guards the
  // whole mutation class that runtime happy-path checks cannot: every piece of identity evidence
  // must occur before the first assignment, and the route must remain unable to touch a pane or
  // grow a second adapter-spawn call. Text order is semantic here because the handler is linear.
  const ownerBindStart = server.indexOf("const codexBindMatch =");
  const ownerBindBody = ownerBindStart < 0 ? ""
    : server.slice(ownerBindStart, server.indexOf("// the rows behind the poll", ownerBindStart));
  const ownerBindMutation = ownerBindBody.indexOf("s.sessionId = id;");
  const ownerBindChecks = [
    'harnessOf(s.harness).id !== "codex"',
    '!CODEX_UUID_RE.test(id)',
    "await codexRolloutForId(id)",
    'meta.threadSource !== "user"',
    "meta.cwd !== s.cwd",
    "o.sessionId === id",
  ].map((needle) => ownerBindBody.indexOf(needle));
  pin("codex owner bind fully revalidates identity before a persistence-only mutation",
    ownerBindMutation > 0 && ownerBindChecks.every((at) => at > 0 && at < ownerBindMutation)
      && ownerBindBody.indexOf("saveState();", ownerBindMutation) > ownerBindMutation
      && ownerBindBody.indexOf('audit("codex_owner_bind"', ownerBindMutation) > ownerBindMutation
      && !/ensureSlot\(|tmux\(|\.spawnCmd\(/.test(ownerBindBody),
    `checks=${ownerBindChecks.join(",")} mutation=${ownerBindMutation}`);
  const ensureStart = server.indexOf("async function ensureSlot(");
  const ensureBody = ensureStart < 0 ? "" : server.slice(ensureStart, server.indexOf("\n}\n", ensureStart));
  pin("ensureSlot after has-session failure is the single writer of every adapter spawn, including Codex resume",
    (server.match(/\.spawnCmd\(/g) ?? []).length === 1
      && /if \(has\.code !== 0\)/.test(ensureBody)
      && /h\.spawnCmd\(\{ sessionId: candidate, resume,/.test(ensureBody),
    `${(server.match(/\.spawnCmd\(/g) ?? []).length} spawnCmd call(s)`);
  pin("the codex adapter stays transcript-less until an owner decides otherwise",
    /\n    transcript: false,/.test(xBody), "transcript field");
  // ...and the seam's two consumers exist in the source, because only the dispatch tail is
  // exercisable on this fleet (e2e/tasks.ts f3): canDeliver's screen gate protects the unattended
  // paths (autos, steward send, watches) that HARNESS_AUTOMATION=0 keeps unreachable in-suite.
  pin("canDeliver refuses a blocked screen behind the same probe opt-out as not-alive",
    /gate: "blocked-screen", detail: rd\.why/.test(server) && /rd\?\.state === "blocked"/.test(server),
    "blocked-screen gate in canDeliver");
  const successionStart = server.indexOf("async function succeedProgramMain");
  const successionBody = successionStart < 0 ? ""
    : server.slice(successionStart, server.indexOf("async function bootstrapProgramMain", successionStart));
  const bootstrapStart = server.indexOf("async function bootstrapProgramMain");
  const bootstrapBody = bootstrapStart < 0 ? ""
    : server.slice(bootstrapStart, server.indexOf("async function handleOwnerProgramRoute", bootstrapStart));
  pin("every program-aware founding rail and the dispatch tail share the BOUNDED readiness wait — a blind sleep is never the proof",
    /pane blocked on \$\{rd\.why\}/.test(server) && /never showed its ready marker within/.test(server)
    && /READY_WAIT_MS/.test(server) && /waitForFoundingReadiness\(free, \(\) => !identityLost\(\)\)/.test(server)
    && /waitForFoundingReadiness\(free, stillCurrent\)/.test(successionBody)
    && /waitForFoundingReadiness\(free, stillCurrent\)/.test(bootstrapBody),
    "shared founding readiness wait used by briefAndSend, Program-MAIN bootstrap, and succession");
  const executionStart = server.indexOf("async function programExecutionView(");
  const executionBody = executionStart < 0 ? ""
    : server.slice(executionStart, server.indexOf("\n}\n", executionStart));
  pin("ProgramExecutionView is a read-only projection with no mutation primitive in its handler",
    executionBody.length > 0
      && !/\b(?:saveState|saveStateNow|appendEvent|sendText|spawnCmd)\b/.test(executionBody),
    executionBody.length > 0 ? "mutation primitive present" : "ProgramExecutionView handler missing");
  // The Supervisor binding is cross-program identity, so both halves of its authority story are
  // rules over the SOURCE: the only route that mints it must sit on the owner rail, and the
  // transfer must keep the same one-way crash boundary the Program-MAIN rail has. Neither is
  // visible at runtime — a bootstrap moved under the self-token dispatcher would answer happily,
  // and a binding written before the send would only be wrong on the run where the send fails.
  const supervisorRouteAt = server.indexOf('url.pathname === "/api/supervisor/bootstrap"');
  const selfRailAt = server.indexOf('url.pathname === "/api/self/verify-intent"');
  const supervisorRouteBody = supervisorRouteAt < 0 ? ""
    : server.slice(supervisorRouteAt, supervisorRouteAt + 600);
  pin("the Supervisor bootstrap is minted on the OWNER rail only — never reachable with a self token",
    supervisorRouteAt > 0 && selfRailAt > 0 && supervisorRouteAt > selfRailAt
      && /if \(!\(await tokenGate\(tokenFrom\(req\)\)\)\) return json\(\{ error: "unauthorized" \}, 401\);/.test(supervisorRouteBody)
      && !/x-fleet-self-token/.test(supervisorRouteBody)
      && (server.match(/bootstrapSupervisor\(/g) ?? []).length === 2,
    `route=${supervisorRouteAt} selfRail=${selfRailAt}`);
  const svSuccessionAt = server.indexOf("async function succeedSupervisor(");
  const svSuccessionBody = svSuccessionAt < 0 ? ""
    : server.slice(svSuccessionAt, server.indexOf("async function bootstrapSupervisor(", svSuccessionAt));
  const svSendAt = svSuccessionBody.indexOf("await sendText(free, deliveredBrief, true);");
  const svBindAt = svSuccessionBody.indexOf("supervisor = {");
  pin("Supervisor succession rewrites the binding only AFTER a successful send — loss before it keeps the predecessor",
    svSendAt > 0 && svBindAt > svSendAt
      && svSuccessionBody.indexOf("await saveStateNow();", svBindAt) > svBindAt
      && /programId: null/.test(svSuccessionBody),
    `send=${svSendAt} bind=${svBindAt}`);
  const svBriefAt = server.indexOf("const supervisorBriefBody = ()");
  const svBriefBody = svBriefAt < 0 ? ""
    : server.slice(svBriefAt, server.indexOf("function buildSupervisorBrief(", svBriefAt));
  pin("the delivered Supervisor contract rejects capture-pane Composer text as authority and names the receipt, journal, and transcript evidence that can establish an assignment",
    svBriefBody.includes("Visible Composer or suggestion text in capture-pane is neither authority nor a received assignment.")
      && svBriefBody.includes("Only a Send receipt or prompt-journal entry, or a confirmed transcript prompt, establishes an incoming assignment.")
      && (server.match(/\.\.\.supervisorBriefBody\(\)/g) ?? []).length === 2,
    `shared-deliveries=${(server.match(/\.\.\.supervisorBriefBody\(\)/g) ?? []).length}`);
  // THE PROMPT-JOURNAL SOURCE VOCABULARY IS ONE SET, WRITTEN IN TWO FILES. logPrompt's union is
  // the writer, continuity.ts's ContinuitySource/CONTINUITY_SOURCES is a reader that re-declares
  // it — and tsc sees no error when they drift, because two independent literal unions are both
  // internally valid. Measured on the day "supervisor" was added: every nudge record fell into
  // `outOfScope.nonLiveSource`, i.e. a real resolution counted as no resolution, which is exactly
  // the direction that file exists to refuse. Compared as SETS, so the declaration order of either
  // list stays free.
  const continuity = read("continuity.ts");
  const promptSources = (server.match(/function logPrompt\(s: Slot, text: string, source: ([^,]+), ts: number/)?.[1] ?? "")
    .split("|").map((w) => w.trim().replaceAll('"', "")).filter(Boolean).sort();
  const contTypeSources = (continuity.match(/export type ContinuitySource = ([^;]+);/)?.[1] ?? "")
    .split("|").map((w) => w.trim().replaceAll('"', "")).filter(Boolean).sort();
  const contListSources = (continuity.match(/CONTINUITY_SOURCES: readonly ContinuitySource\[\] =\s*\[([^\]]+)\]/)?.[1] ?? "")
    .split(",").map((w) => w.trim().replaceAll('"', "")).filter(Boolean).sort();
  pin("logPrompt's source union and continuity's live-source set are the SAME set — a new source is never silently out-of-scope",
    promptSources.length >= 6 && JSON.stringify(promptSources) === JSON.stringify(contTypeSources)
      && JSON.stringify(promptSources) === JSON.stringify(contListSources),
    `logPrompt=${promptSources.join(",")} type=${contTypeSources.join(",")} list=${contListSources.join(",")}`);

  // Cut 2's two rules over the SOURCE, for the same reason as the two above: neither regression is
  // visible at runtime. A nudge that read a slot off the body would answer happily on every request
  // whose body happens not to carry one, and a view that mutated would only be wrong on the state
  // it silently changed.
  const svNudgeAt = server.indexOf("async function supervisorNudge(");
  const svNudgeBody = svNudgeAt < 0 ? ""
    : server.slice(svNudgeAt, server.indexOf("\n}\n", svNudgeAt));
  pin("the Supervisor nudge DERIVES its receiver from the named program's binding — it never reads a slot off the body",
    svNudgeBody.length > 0
      && /programs\.find\(\(p\) => p\.id === body\.programId\)/.test(svNudgeBody)
      && /slotFrom\(main\.slot\)/.test(svNudgeBody)
      && !/body\.(?:slot|receiver|target|receiverSlot)\b/.test(svNudgeBody)
      && !/slotFrom\(body/.test(svNudgeBody),
    svNudgeBody.length > 0 ? "receiver derivation" : "supervisorNudge handler missing");
  const svViewAt = server.indexOf("async function supervisorView(");
  const svViewBody = svViewAt < 0 ? "" : server.slice(svViewAt, server.indexOf("\n}\n", svViewAt));
  const svViewRouteAt = server.indexOf('url.pathname === "/api/self/supervisor-view"');
  const svViewRouteBody = svViewRouteAt < 0 ? "" : server.slice(svViewRouteAt, svViewRouteAt + 600);
  pin("SupervisorExecutionView is registered on the self rail and holds no mutation primitive in its handler",
    svViewBody.length > 0 && svViewRouteAt > 0
      && /x-fleet-self-token/.test(svViewRouteBody)
      && /isBoundSupervisor\(s\)/.test(svViewRouteBody)
      && !/\b(?:saveState|saveStateNow|appendEvent|audit|sendText|spawnCmd|logPrompt)\s*\(/.test(svViewBody),
    svViewBody.length > 0 ? "mutation primitive present" : "supervisorView handler missing");
  // WHO MAY READ isBoundSupervisor — the SET of its readers is the rule, and it is named here.
  // The predicate was written as a LOCAL rule of the two Cut-2 routes; the comment over its
  // definition still calls it "the whole authorization story of both routes below", and it is the
  // ONLY authorization condition those routes have. fa69586 gave it a THIRD reader, a disjunct in
  // the programs list far below that block, and nothing recorded that the sentence had stopped
  // being true. Every further reader widens what a bound Supervisor may reach, and it costs one
  // line that reads like reuse: no compiler, no review diff and no suite makes that visible.
  //
  // IDENTIFIED, NOT COUNTED. A `=== 3` would fall on a correctly moved call or a renamed slot
  // variable and then say nothing useful, while three readers that are the WRONG three would pass
  // it. So each call names itself by the ROUTE it sits in (nearest preceding url.pathname literal —
  // a reader outside the dispatcher gets no route name and fails) plus its SHAPE: `gate` refuses a
  // non-Supervisor with NOT_SUPERVISOR/409, `widening` is a disjunct that hands the Supervisor
  // something a plain session would not see. Compared as a MULTISET, so the order of the three in
  // the file stays free, while a gate quietly turned into a disjunct — or a second reader inside an
  // already-named route — is a different set and falls.
  const SV_READERS_ALLOWED = [
    "/api/self/nudge [gate]",            // the one bounded VOICE — refuses a non-Supervisor outright
    "/api/self/programs [widening]",     // GET-filter disjunct — the Supervisor reads every Program's content
    "/api/self/supervisor-view [gate]",  // the SENSES — refuses a non-Supervisor outright
    // STN-1: the SECOND voice — completes one Controller-registered transition watch; refuses a
    // non-Supervisor outright. A regex route, named by its literal (see svRoutesAt below).
    "/^\\/api\\/self\\/supervisor-watch\\/([a-z0-9]+)\\/complete$/ [gate]",
    // STN-1: the one reader OUTSIDE the dispatcher, and it NARROWS rather than widens — the
    // Supervisor may not register a transition watch on itself (it is the completer). Named by
    // its enclosing function and the `exclusion` shape: `if (isBoundSupervisor(s))` → 409.
    "createWatchForSlot [exclusion]",
  ];
  // literal routes AND regex routes, both by position: a regex route between two literals would
  // otherwise be named after the literal above it, which is a different door.
  const svRoutesAt = [
    ...[...server.matchAll(/url\.pathname === "([^"]+)"/g)].map((m) => ({ at: m.index, path: m[1] ?? "" })),
    ...[...server.matchAll(/(\/\^[^\n]*?\/)\.exec\(url\.pathname\)/g)].map((m) => ({ at: m.index, path: m[1] ?? "" })),
  ].sort((a, b) => a.at - b.at);
  const svFunctionsAt = [...server.matchAll(/^(?:async )?function ([A-Za-z0-9_]+)\(/gm)]
    .map((m) => ({ at: m.index, name: m[1] ?? "" }));
  const svDispatcherAt = server.indexOf("async function handle(");
  const svReadersFound = [...server.matchAll(/isBoundSupervisor\s*\(/g)].map((m) => {
    const at = m.index;
    const before = server.slice(Math.max(0, at - 120), at);
    const after = server.slice(at, at + 200);
    const kind = /!\s*isBoundSupervisor\s*\($/.test(`${before}isBoundSupervisor(`)
        && /NOT_SUPERVISOR/.test(after) && /\b409\b/.test(after) ? "gate"
      : /(?:\|\||&&)\s*$/.test(before) ? "widening"
      : /if \($/.test(before) && /^isBoundSupervisor\(s\)\)\s*\n\s*return json\(\{ error: "[^"]*" \}, 409\)/.test(after) ? "exclusion"
      : "unclassified";
    let route = "OUTSIDE THE ROUTE DISPATCHER";
    if (svDispatcherAt >= 0 && at > svDispatcherAt) {
      for (const r of svRoutesAt) { if (r.at < at) route = r.path; else break; }
    } else {
      for (const f of svFunctionsAt) { if (f.at < at) route = f.name; else break; }
    }
    return `${route} [${kind}]`;
  }).sort();
  const svMissingFrom = (a: string[], b: string[]): string[] => {
    const rest = [...b], out: string[] = [];
    for (const x of a) { const i = rest.indexOf(x); if (i < 0) out.push(x); else rest.splice(i, 1); }
    return out;
  };
  const svUnnamed = svMissingFrom(svReadersFound, SV_READERS_ALLOWED);
  const svVanished = svMissingFrom(SV_READERS_ALLOWED, svReadersFound);
  pin("every reader of isBoundSupervisor is named here — a reader not in this list widens the Supervisor's reach, so name it here or take it back",
    svUnnamed.length === 0 && svVanished.length === 0,
    svUnnamed.length > 0 || svVanished.length > 0
      ? `unnamed=[${svUnnamed.join(" · ")}] no-longer-there=[${svVanished.join(" · ")}] found=[${svReadersFound.join(" · ")}]`
      : svReadersFound.join(" · "));
  pin("the codex adapter declares its OWN comms — a null would hand it back the unprobed waiver",
    /\n  comms: \["codex", "node"\],/.test(xBody), xBody.match(/\n  comms: [^\n]*/)?.[0]?.trim() ?? "no comms field");
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

  // pi-zai's key must cross the process boundary through pane-shell expansion only. Reading it in
  // server.ts would put the secret bytes into pane_start_command; any second assignment mechanism
  // would make the safe-looking $(cat ...) line a decoy rather than the whole rule.
  const pzStart = server.indexOf("const PI_ZAI_HARNESS: Harness = {");
  const pzBody = pzStart < 0 ? "" : server.slice(pzStart, server.indexOf("\n};\n", pzStart));
  const pzCode = pzBody.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  pin("pi-zai is a bounded self-contained adapter declaration, never inherited through object spread",
    pzStart > 0 && pzBody.length > 500 && pzBody.length < 8_000 && !pzCode.includes("..."),
    `${pzBody.length} bytes`);
  pin("pi-zai reads key bytes only through $(cat ...) in the pane shell",
    pzCode.includes("ZAI_API_KEY=\"$(cat '${PI_ZAI_KEY_FILE}')\"")
    && (pzCode.match(/ZAI_API_KEY=/g) ?? []).length === 1
    && !/(?:readFileSync|Bun\.file|readText)\(PI_ZAI_KEY_FILE/.test(pzCode),
    pzCode.match(/ZAI_API_KEY=[^\n]+/)?.[0]?.slice(0, 180) ?? "no ZAI_API_KEY assignment");
  pin("pi-zai is registered in the stable harness order beside the two Pi adapters",
    server.includes("const HARNESSES: readonly Harness[] = [CLAUDE_HARNESS, PI_HARNESS, PI_ZAI_HARNESS, PI_OX_HARNESS, PI_UNFENCED_HARNESS, CONTAINER_HARNESS, CODEX_HARNESS];"),
    server.match(/const HARNESSES: readonly Harness\[\] = \[[^\n]+/)?.[0] ?? "registry absent");

  const poStart = server.indexOf("const PI_OX_HARNESS: Harness = {");
  const poBody = poStart < 0 ? "" : server.slice(poStart, server.indexOf("\n};\n", poStart));
  const poCode = poBody.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  pin("pi-ox is a bounded self-contained adapter declaration, never a native OpenCode harness",
    poStart > 0 && poBody.length > 500 && poBody.length < 8_000 && !poCode.includes("..."),
    `${poBody.length} bytes`);
  pin("pi-ox pins Pi, provider, model, cycle list and public Canary key without a fallback",
    poCode.includes("pi --provider opencode --model 'x-preview-f-free' --models opencode/x-preview-f-free --api-key public --no-approve --no-extensions --no-skills --no-prompt-templates --no-themes --verbose")
      && (poCode.match(/--provider /g) ?? []).length === 1
      && (poCode.match(/--models /g) ?? []).length === 1
      && (poCode.match(/--no-extensions/g) ?? []).length === 1
      && !/(?:OPENCODE|OPENAI)_API_KEY=/.test(poCode),
    poCode.match(/let cmd = [^\n]+/)?.[0] ?? "no pi-ox command");
  const poCatalog = poCode.match(/const catalog = '([^']+)'/)?.[1] ?? "";
  let poCatalogShape: unknown = null;
  try { poCatalogShape = JSON.parse(poCatalog); } catch { /* asserted below */ }
  const poProvider = (poCatalogShape as { providers?: { opencode?: { apiKey?: unknown; models?: unknown[] } } } | null)
    ?.providers?.opencode;
  pin("pi-ox's single-quoted shell catalogue is JSON-safe and contains exactly the Canary's one public model",
    !!poCatalog && !poCatalog.includes("'") && poProvider?.apiKey === "public"
      && poProvider.models?.length === 1
      && (poProvider.models[0] as { id?: unknown })?.id === "x-preview-f-free",
    `bytes=${poCatalog.length} models=${poProvider?.models?.length ?? "invalid"}`);
  pin("pi-ox validates a separate absolute base and derives one fail-closed root per Fleet session UUID",
    server.includes('throw new Error("FLEET_PI_OX_AGENT_DIR must be a safe absolute path without ..")')
      && server.includes("sessionId && CODEX_UUID_RE.test(sessionId) ? `${PI_OX_AGENT_DIR}/${sessionId}` : null")
      && poCode.includes("if (!agentDir)")
      && poCode.includes("PI_CODING_AGENT_DIR='${agentDir}'")
      && (poCode.match(/PI_CODING_AGENT_DIR=/g) ?? []).length === 1,
    poCode.match(/PI_CODING_AGENT_DIR=[^\n]+/)?.[0]?.slice(0, 180) ?? "no isolated root");
  pin("pi-ox replaces its session-local catalogue atomically and fails closed before Pi on preparation errors",
    poCode.includes("mktemp '${agentDir}/.models.json.XXXXXX'")
      && poCode.includes("mv -f \"$fleet_pi_ox_catalog_tmp\" '${agentDir}/models.json'")
      && poCode.includes("rm -f \"$fleet_pi_ox_catalog_tmp\"")
      && poCode.indexOf("mv -f \"$fleet_pi_ox_catalog_tmp\"") < poCode.indexOf("PI_CODING_AGENT_DIR=")
      && !poCode.includes("> '${agentDir}/models.json'"),
    poCode.match(/fleet_pi_ox_catalog_tmp[^\n]+/)?.[0]?.slice(0, 280) ?? "no atomic catalogue prelude");
  pin("pi-ox automation is paired with explicit no-trust startup and a blocking readiness seam",
    /automatable: true/.test(poCode)
      && poCode.includes("--no-approve --no-extensions --no-skills --no-prompt-templates --no-themes --verbose")
      && /readiness: \{/.test(poCode)
      && /accept: \/Model scope: x-preview-f-free\//.test(poCode)
      && /re: \/Trust project folder\\\?\//.test(poCode),
    poCode.match(/readiness: \{[\s\S]{0,240}?\n  \}/)?.[0] ?? "no pi-ox readiness");

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
  const cxStart = server.indexOf("async function workerViaCodexExec(");
  const cxBody = cxStart < 0 ? "" : server.slice(cxStart, server.indexOf("\n}\n", cxStart));
  const cxCode = cxBody.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  pin("the Codex timeout test seam is readable only behind the controlled-binary condition",
    cxStart > 0
      && /const binOverride = process\.env\.FLEET_CODEX_EXEC_BIN;/.test(cxCode)
      && /const testTimeoutMs = binOverride \? Number\(process\.env\.FLEET_CODEX_EXEC_TIMEOUT_MS\) : NaN;/.test(cxCode)
      && /Number\.isFinite\(testTimeoutMs\) && testTimeoutMs > 0 \? testTimeoutMs : opts\.timeoutMs/.test(cxCode),
    cxCode.match(/const testTimeoutMs = [^;]+;/)?.[0] ?? "timeout seam absent");

  const routesStart = server.indexOf("const WORKER_ROUTES = {");
  const routesBody = routesStart < 0 ? "" : server.slice(routesStart, server.indexOf("} satisfies Record<WorkerName, WorkerRouteConfig>;", routesStart));
  const sparkRoutes = [...routesBody.matchAll(/^  (\w+): codexSparkRoute\(process\.env\.(FLEET_WORKER_ROUTE_[A-Z]+)\),$/gm)]
    .map((m) => `${m[1]}:${m[2]}`).sort();
  const claudeRoutes = [...routesBody.matchAll(/^  (\w+): \{ route: "claude" \},$/gm)].map((m) => m[1]).sort();
  pin("the complete worker route table sends only the four migrated workers to their own Spark rollback keys",
    JSON.stringify(sparkRoutes) === JSON.stringify([
      "commitMsg:FLEET_WORKER_ROUTE_COMMITMSG",
      "digest:FLEET_WORKER_ROUTE_DIGEST",
      "enhance:FLEET_WORKER_ROUTE_ENHANCE",
      "summary:FLEET_WORKER_ROUTE_SUMMARY",
    ]), sparkRoutes.join(" | ") || "no Spark routes parsed");
  pin("the complete worker route table leaves all six unmigrated workers on Claude",
    JSON.stringify(claudeRoutes) === JSON.stringify([
      "analysis", "cleanReview", "merge", "refine", "repair", "review",
    ]), claudeRoutes.join(" | ") || "no Claude routes parsed");
  pin("all migrated worker routes share the one exact Codex Spark model value",
    /const CODEX_SPARK_MODEL = "gpt-5\.3-codex-spark";/.test(server)
      && /\{ route: "codex-exec", model: CODEX_SPARK_MODEL \}/.test(server)
      && !server.includes("CODEX_SUMMARY_MODEL"),
    server.match(/const CODEX_[A-Z_]+_MODEL = "[^"]+";/g)?.join(" | ") ?? "Spark model constant absent");

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
  // All six are pinned OWNER DECISIONS: full local access is the normal
  // operating mode, every agent records its own work, and /commit is a recovery act. A `true`
  // reappearing here would silently re-route a harness's lifecycle through host rescue.
  const ownerHostCommitExpected: Record<string, string> = {
    CLAUDE: "false", PI: "false", PI_ZAI: "false", PI_OX: "false", PI_UNFENCED: "false", CONTAINER: "false", CODEX: "false",
  };
  const wrongOwnerDecision = Object.entries(ownerHostCommitExpected)
    .filter(([name, expected]) => hostCommitsOf(name) !== expected);
  pin("every adapter keeps its owner-decided commit ownership — nobody is fenced out of .git",
    wrongOwnerDecision.length === 0,
    wrongOwnerDecision.map(([name, expected]) => `${name}:${hostCommitsOf(name) ?? "missing"} expected=${expected}`).join(" ")
      || "all seven agree");
  // `supports` is written inline on one adapter and one-field-per-line on the others, so the
  // field is matched WITHOUT its leading newline — anchoring on the layout would have made this
  // rule true for three adapters and unaskable for the fourth.
  const wrongWorker = adapters.filter((a) => {
    const exec = stripComments(a.body);
    const hosts = !/\n {2}worker: \(\) => null,/.test(exec);
    return hosts !== /\btranscript: true\b/.test(exec);
  });
  pin("no adapter offers a worker session it could not read the answer from (worker ⇔ supports.transcript)",
    wrongWorker.length === 0, wrongWorker.map((a) => a.name).join(", ") || "all six agree");

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
  // Scoped to the ENCLOSING top-level function rather than to a byte window. The window version
  // (2500 chars) was arbitrary and started failing the day the confirm path grew its fresh-verify
  // arm between the two calls — a rule that fires on a line it cannot describe teaches its readers
  // to loosen it, so it was replaced by the boundary the property actually lives in: the land site
  // is one function, and the mirror refresh has to be somewhere in it before the advance.
  const fnStartBefore = (at: number): number => {
    const head = serverExec.slice(0, at);
    return Math.max(head.lastIndexOf("\nasync function "), head.lastIndexOf("\nfunction "));
  };
  const advUnsynced = advCalls.filter((m) =>
    !serverExec.slice(Math.max(0, fnStartBefore(m.index)), m.index).includes("syncLaneRefs("));
  pin("every advanceIntegration call site refreshes the lane mirror first (a clone lands from the mirror, not from the tree)",
    advCalls.length > 0 && advUnsynced.length === 0,
    `${advCalls.length} call sites, ${advUnsynced.length} without a syncLaneRefs earlier in the same function`);
  // --- THE PROMOTION RECORD HAS EXACTLY ONE WRITER, and it is the OWNER route. A self route that
  // could write it would be a permission granting itself — the one shape this whole record exists
  // to prevent. It is a rule over the source because on a fleet with no promotion record, which is
  // every fleet by default, no runtime probe can see a second writer that simply never fired.
  // Assignment AND deletion are both counted: a revocation written from a second place is the same
  // defect pointing the other way.
  const promoWrites = [...serverExec.matchAll(/(?:\w+)\.promotion = |delete (?:\w+)\.promotion/g)];
  const promoRouteStart = serverExec.indexOf("const promotionRoute = /^");
  const promoRouteEnd = serverExec.indexOf("const action = /^", promoRouteStart);
  pin("program.promotion is written by exactly one route — the owner promotion door, and nothing else",
    promoWrites.length === 2 && promoRouteStart > 0 && promoRouteEnd > promoRouteStart
    && promoWrites.every((m) => m.index > promoRouteStart && m.index < promoRouteEnd),
    `${promoWrites.length} write(s): ${promoWrites.map((m) => m[0]).join(" | ")}`);
  // ...and the three rungs of the ladder are the SAME closed set in the type, the runtime list and
  // the loader. They are three separate expressions of one decision, and a value added to the type
  // alone would compile while the route refused it — a permission that exists and cannot be granted.
  pin("the selfLand ladder is off/green-only/guarded in the type and in the runtime list the route validates against",
    /type PromotionSelfLand = "off" \| "green-only" \| "guarded";/.test(server)
    && /const PROMOTION_SELF_LAND: PromotionSelfLand\[\] = \["off", "green-only", "guarded"\];/.test(server),
    JSON.stringify({ type: /type PromotionSelfLand =[^\n]*/.exec(server)?.[0] ?? "absent",
      list: /const PROMOTION_SELF_LAND[^\n]*/.exec(server)?.[0] ?? "absent" }));
  // ...and the loader degrades a malformed record to ABSENT rather than repairing it field-wise.
  // The dangerous direction is planted at runtime in e2e/programs.ts; this is the structural half,
  // because a field-wise repair added later would still pass that probe for the one field it kept.
  const promoLoader = server.slice(server.indexOf("const loadPromotion = "),
    server.indexOf("\n};", server.indexOf("const loadPromotion = ")));
  pin("loadPromotion returns undefined on every malformed shape — no field-wise repair of a permission",
    promoLoader.length > 0 && (promoLoader.match(/return undefined;/g) ?? []).length === 5
    && (promoLoader.match(/return \{ v: 1,/g) ?? []).length === 1,
    JSON.stringify({ rejects: (promoLoader.match(/return undefined;/g) ?? []).length }));
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
  // THE EFFORT FLAG'S SHELL FORM, pinned at the SOURCE because no runtime suite can cover the rule.
  // A suite proves the levels somebody thought to type; the property that has to hold is about every
  // level the list will ever carry, and both halves of it are string concatenation — invisible to
  // tsc, and exactly the shape e2e/pins.ts exists for.
  //
  // Half one: `--effort` is interpolated SINGLE-QUOTED and sits on the claude branch. A foreign
  // BASE_CMD must never see it — `--effort` is claude's spelling; pi has `--thinking` and codex has
  // a `-c` config key, and both are their own adapters' business. An append that slipped below the
  // branch would hand claude's flag to a binary that has never heard of it, and the pane would die
  // at spawn with the task text about to be typed into a bare shell.
  const acStart = server.indexOf("function agentCmd(");
  const acBody = server.slice(acStart, server.indexOf("\n}\n", acStart));
  pin("agentCmd's body is bounded and non-empty (an unbounded slice would make the rules below vacuous)",
    acStart > 0 && acBody.length > 400 && acBody.length < 8_000, `${acBody.length} bytes`);
  const claudeBranch = acBody.slice(acBody.indexOf("if (claude) {"), acBody.indexOf("else if (HARNESS_MODEL_FLAG"));
  const effortAppends = (acBody.match(/cmd \+= ` --effort /g) ?? []).length;
  pin("agentCmd appends --effort single-quoted, exactly once, and only on the claude branch",
    effortAppends === 1
    && claudeBranch.length > 100
    && /if \(effort\) cmd \+= ` --effort '\$\{effort\}'`;/.test(claudeBranch),
    `appends=${effortAppends} branch=${claudeBranch.length}b`);
  // Half two: the reason those quotes are sufficient rather than merely tidy. Every adapter's
  // effortLevels is a CLOSED list of bare lowercase words, so there is no metacharacter any level
  // could carry into the line — which is the argument agentCmd's comment makes and this row is what
  // keeps it true as the lists grow. Both directions matter: a level with a quote in it would break
  // out of the wrap, and one with a glob would abort the pane under zsh.
  const levelLists = [...server.matchAll(/effortLevels: \[([^\]]*)\]/g)].map((m) => (m[1] ?? "").trim());
  pin("every adapter's effortLevels is a closed list of bare lowercase words — the property the quoting rests on",
    levelLists.length >= 5 && levelLists.every((l) => l === "" || /^"[a-z]+"(?:, "[a-z]+")*$/.test(l)),
    levelLists.map((l) => `[${l}]`).join(" ") || "no effortLevels literal found");
  // ...and the pair that must never disagree, in BOTH directions: a declared capability with an
  // empty set is a picker offering nothing, and a non-empty set behind `effort: false` is a list
  // effortOf refuses every member of. Read off the adapter literals rather than the running server
  // so it is judged before the type check, not after a suite boots.
  const adapters = [...server.matchAll(/effortLevels: \[([^\]]*)\],\n(?:\s*\/\/[^\n]*\n)*\s*supports: \{([^}]*)\}/g)]
    .map((m) => ({ levels: (m[1] ?? "").trim(), effort: /effort: true/.test(m[2] ?? "") }));
  pin("effortLevels and supports.effort agree in both directions on every adapter that states them together",
    adapters.length >= 2 && adapters.every((a) => a.effort === (a.levels !== "")),
    adapters.map((a) => `${a.effort}/${a.levels === "" ? "empty" : "set"}`).join(" ") || "no adapter pair matched");
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
  const sourcePath = SOURCE_DIR === null ? null : `${SOURCE_DIR}/${CLAUDE}`;
  const source = ((): string | null => {
    try { return sourcePath ? readFileSync(sourcePath, "utf8") : null; } catch { return null; }
  })();
  // A lane is no longer HANDED the source file: since B2 it is written the LANE rendering of the
  // fragments (3 of 7) plus a back-reference block. Both shapes are "current" — comparing only
  // against the monolith would demote every fresh lane to advisory, which is this section going
  // quiet exactly where it was built to speak. Body-only, because the block carries a timestamp.
  const laneSource = ((): string | null => {
    if (SOURCE_DIR === null) return null;
    const frag = new Map<RulebookFragment, string>();
    for (const f of RULEBOOK_FRAGMENTS) {
      try { frag.set(f, readFileSync(`${SOURCE_DIR}/${RULEBOOK_DIR}/${fragmentFileName(f)}`, "utf8")); }
      catch { return null; }
    }
    try { return renderRulebook("lane", frag); } catch { return null; }
  })();
  const matchesSource = copy !== null
    && ((source !== null && source === copy) || (laneSource !== null && rulebookBody(copy) === laneSource));
  const state = copy === null ? "absent"
    : source === null && laneSource === null ? "unpaired"
    : matchesSource ? "current" : "stale";
  const soft = state !== "current";

  // the rule NAMES are the same in every branch — a reader grepping the report for a rule must find
  // its row whether it passed, warned or was never evaluated
  const RULE_PATHS = "every path CLAUDE.md cites still resolves";
  const RULE_GREPS = "every grep CLAUDE.md sends the reader on still finds something";
  const RULE_SUBJ = "CLAUDE.md yields anchors of both classes (a rule with no subject is not a pass)";
  const RULE_ANCHORS = "every section anchor CLAUDE.md cites resolves to a heading in that file";

  if (copy === null) {
    skip(RULE_SUBJ, `no rulebook in this tree (state=${state})`);
    skip(RULE_PATHS, "no rulebook in this tree");
    skip(RULE_ANCHORS, "no rulebook in this tree");
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

    // --- class C: a cited SECTION ANCHOR that no longer resolves. Class A holds a cited path to
    // the existence of its FILE and stops there, so a rulebook may point at `docs/self-api.md`
    // §release for months while that file has no such section — which is exactly how the reference
    // for POST /api/self/tasks/:id/release stayed missing after 83468e0 landed the route: the
    // rulebook named the door and the errand ended in nothing, with every check green. The form
    // held here is the one the rulebook actually writes: a path immediately followed by `§<anchor>`
    // (backticks optional — one citation carries none), filtered by the SAME attributable/exists
    // gate as class A so a gitignored or foreign path is not double-reported here and there.
    //
    // THE MATCH IS DELIBERATELY TOLERANT, because a pin that reds on a correct heading is worse
    // than no pin: the anchor is a shorthand, never the heading. Two shapes, and no special-case
    // list — a list of exceptions in here would BE the defect:
    //   · a numeric anchor (`§4`, `§11.7`) must START its heading, once a leading `§` is stripped
    //     from the heading too (the messgeschichten file writes its headings as `## §4 …`). The
    //     start requirement is what keeps `§1` from resolving against `## 11. …`.
    //   · a word anchor (`§PATH`, `§autos`, `§Faktschicht`) may stand anywhere in the heading on
    //     word boundaries — `§succeed` answers to `## succeed / retire — …` and `§Faktschicht` to
    //     `## Die Faktschicht \`agent\``, and neither is a prefix of its heading. SLASHED TOKENS
    //     ARE DROPPED FIRST, and that is not tidiness: these headings quote the route they document
    //     (`## watch — POST /api/self/watch`), so a plain word match reads the ROUTE and the anchor
    //     then resolves against any heading that merely mentions it. Measured, not feared — renaming
    //     that heading to `## abonnieren — POST /api/self/watch` left the first version of this rule
    //     GREEN on a broken anchor. A path token inside a heading is not that heading's name.
    const deadAnchors: string[] = [];
    let anchors = 0;
    const headingCache = new Map<string, string[] | null>();
    const headingsOf = (rel: string): string[] | null => {
      if (!headingCache.has(rel)) {
        let hs: string[] | null = null;
        try {
          hs = read(rel).split("\n").filter((l) => /^#{1,6}\s/.test(l))
            .map((l) => l.replace(/^#{1,6}\s+/, "").replace(/[`*]/g, "").replace(/^§/, "").trim());
        } catch { hs = null; }
        headingCache.set(rel, hs);
      }
      return headingCache.get(rel) ?? null;
    };
    const anchorResolves = (rel: string, anc: string): boolean => {
      const hs = headingsOf(rel);
      if (hs === null) return false;
      const numeric = /^[0-9]+(?:\.[0-9]+)*$/.test(anc);
      const esc = anc.replace(/[.+^${}()|[\]\\*?]/g, "\\$&");
      if (numeric) {
        const re = new RegExp(`^${esc}(?![A-Za-z0-9])`);
        return hs.some((h) => re.test(h));
      }
      const re = new RegExp(`(?<![A-Za-z0-9])${esc}(?![A-Za-z0-9])`, "i");
      return hs.some((h) => re.test(h.split(/\s+/).filter((t) => !t.includes("/")).join(" ")));
    };
    for (let i = 0; i < lines.length; i++)
      for (const m of lines[i].matchAll(/`?([A-Za-z0-9_][A-Za-z0-9_./-]*\.md)`?\s+§([^\s,;)]+)/g)) {
        const p = m[1].replace(/^\.\//, "");
        const anc = m[2].replace(/[.,;:]+$/, "");
        if (!anc || !attributable(p) || !exists(p)) continue;
        anchors++;
        if (!anchorResolves(p, anc)) deadAnchors.push(`${CLAUDE}:${i + 1} ${safe(`${p} §${anc}`)}`);
      }

    // --- is this copy a PARTIAL rendering? Since B2 a lane is not handed the whole rulebook but
    // three of the seven fragments, and the errand form `…, grep \`sym\`` happens to live only in
    // fragments a lane never receives: the lane rendering carries 50 paths and ZERO errands. So
    // "both classes non-empty" would red the land gate of every lane spawned after that split —
    // for a class its rulebook structurally cannot host. The marker is the back-reference block's
    // own audience line, taken FROM renderBackref rather than typed out here, and it is structural
    // rather than an equality against a freshly rendered lane copy: a long-running lane goes STALE
    // the moment a fragment moves, and that copy is no less partial for it.
    const partialLines = RULEBOOK_AUDIENCES
      .filter((a) => FRAGMENTS_FOR[a].length < RULEBOOK_FRAGMENTS.length)
      .flatMap((a) => renderBackref(a, { repoRoot: "/", at: "", sourceHash: "" })
        .split("\n").filter((l) => l.includes(`${a.toUpperCase()}-Fassung`)));
    const partial = partialLines.length > 0 && partialLines.some((l) => copy.includes(l));

    // both classes non-empty, or the two rules below are measuring nothing and saying "fine". For
    // a FULL rendering — the main checkout's CLAUDE.md, which RULE_RENDER holds byte-identical to
    // renderRulebook("main") and which therefore carries no back-reference block at all — that is
    // unchanged: a rulebook with no errand in it is a rule with no subject. For a partial one the
    // errand half is not demanded, and RULE_GREPS then says NEVER MEASURED under its own name
    // instead of passing over an empty set, which is the same vacuum-green this pin exists to stop.
    pin(RULE_SUBJ, paths > 0 && (greps > 0 || partial),
      `state=${state}${partial ? ", partial rendering" : ""}; ${paths} path(s), ${greps} grep errand(s)`);
    pin(RULE_PATHS, deadPaths.length === 0,
      `${state === "current" ? "" : `${state} copy — advisory; `}${deadPaths.join("; ")}`, soft);
    // No anchor in these fragments is not a defect of the tree — it is a rulebook that sends the
    // reader on no sectioned errand, and this rule then says NEVER MEASURED under its own name
    // rather than passing over an empty set (the vacuum-green RULE_GREPS is skipped for above).
    if (anchors === 0) {
      skip(RULE_ANCHORS, `state=${state} — no \`path §anchor\` citation in this rendering`);
    } else {
      pin(RULE_ANCHORS, deadAnchors.length === 0,
        `${state === "current" ? "" : `${state} copy — advisory; `}${anchors} anchor(s)${deadAnchors.length ? `; ${deadAnchors.join("; ")}` : ""}`, soft);
    }
    if (partial && greps === 0) {
      skip(RULE_GREPS, `partial rendering (state=${state}) — no errand in these fragments to follow`);
    } else {
      pin(RULE_GREPS, deadGreps.length === 0,
        `${state === "current" ? "" : `${state} copy — advisory; `}${deadGreps.join("; ")}`, soft);
    }
  }
}

// ================================================================================================
// 6b. The rulebook is SEVEN FRAGMENTS, and CLAUDE.md is their render — not a hand-kept file
// ================================================================================================
// Section 6 holds CLAUDE.md's anchors to the tree. This one holds CLAUDE.md to its SOURCE. Since
// the B1 split the file is a GENERAT of `rulebook/loader.md` … `rulebook/graphify.md`, assembled by
// rulebook.ts; a hand edit to CLAUDE.md is lost at the next render, and a fragment that loses a
// rule leaves no trace in git — the whole layer is gitignored, exactly like the monolith was.
//
// FOUR CONSTRAINTS, each one the reason a rule below is shaped the way it is:
//
// (1) `rulebook/` LIVES IN THE SOURCE CHECKOUT ALONE. Gitignored, so a worktree never materialises
//     it. The rules that need it read it through SOURCE_DIR; where that is unreachable they SKIP
//     under their own name. A pin that goes green because it could not look is the exact failure
//     mode CLAUDE.md's own "eine Sonde, die nicht laufen konnte, muss als SIE SELBST scheitern"
//     was written about, and it would be worse here than elsewhere: silence would read as proof.
// (2) NO CONTENT LEAVES THIS FILE, same as section 6. The fragments carry the deploy host and IP.
//     Emitted detail is rule ids, fragment names, and counts — never a line of rulebook text.
// (3) THE FRAGMENT COLUMN IS A RULE, NOT A LIST. It must equal the id prefix; a row that departs
//     from its prefix has to be NAMED in the doc's own prose as a cut-C move. So the two rules C
//     relocated are legal and self-documenting, and a silent third one is not.
// (4) PLACEMENT IS HELD HARD, UNIQUENESS IS ONLY REPORTED. "Every rule stands in the fragment its
//     column names" catches a loss or a silent move. "…and in no other" cannot be demanded: eleven
//     patterns are generic substrings (`409`, `mergeJob`, `⚙ steward`) that legitimately recur, and
//     demanding uniqueness would mean rewriting those patterns — i.e. blunting the probe to make
//     the pin green. The count is printed instead, so a drop is visible without being fatal.
{
  const PROBE = "docs/attic/regelbuch-bedeutungsprobe-2026-08-18.md";
  const RULE_RENDER = 'CLAUDE.md is renderRulebook("main", rulebook/) byte for byte';
  const RULE_PLACED = "every rule of the meaning probe stands in the fragment its Fragment column names";
  const RULE_COLUMN = "the Fragment column is the id prefix, and every departure is named as a cut-C move";
  const RULE_SELECT = "FRAGMENTS_FOR keeps all seven for main and a duplicate-free subset for a lane";
  const RULE_HOLE = "renderRulebook refuses to assemble a rulebook with a fragment missing";

  // --- the module's own arithmetic. Needs no checkout: it is data in a tracked file.
  {
    const mainOk = FRAGMENTS_FOR.main.length === RULEBOOK_FRAGMENTS.length
      && RULEBOOK_FRAGMENTS.every((f, i) => FRAGMENTS_FOR.main[i] === f);
    const lane = FRAGMENTS_FOR.lane;
    const laneOk = lane.length > 0 && lane.length < RULEBOOK_FRAGMENTS.length
      && new Set(lane).size === lane.length
      && lane.every((f) => (RULEBOOK_FRAGMENTS as readonly string[]).includes(f));
    // the prefix map must be total and injective, or the Fragment column below is not derivable
    const mapped = Object.values(FRAGMENT_BY_RULE_PREFIX);
    const mapOk = new Set(mapped).size === RULEBOOK_FRAGMENTS.length
      && RULEBOOK_FRAGMENTS.every((f) => mapped.includes(f));
    pin(RULE_SELECT, mainOk && laneOk && mapOk,
      `main=${FRAGMENTS_FOR.main.length}/${RULEBOOK_FRAGMENTS.length}, lane=${lane.length}, prefixes=${Object.keys(FRAGMENT_BY_RULE_PREFIX).length}`);
  }
  {
    let threw = false;
    try { renderRulebook("main", new Map()); } catch { threw = true; }
    pin(RULE_HOLE, threw);
  }

  // --- the probe table. Rows wrap: a cell may run over several physical lines (P7's does), and a
  // line-wise parser hands such a row ZERO patterns, whereupon `every()` over an empty list says
  // true and the row passes having measured nothing. Joining continuations first is what keeps
  // that vacuum out; a row that still yields no pattern is counted as a violation, by name.
  const norm = (t: string): string => t.replace(/`/g, "").replace(/\*\*/g, "").split(/\s+/).join(" ");
  const probe = ((): string | null => { try { return read(PROBE); } catch { return null; } })();
  const rows: { id: string; frag: string; pats: string[] }[] = [];
  if (probe !== null) {
    const joined: string[] = [];
    for (const l of probe.split("\n")) {
      if (l.startsWith("| ")) joined.push(l);
      else if (joined.length && !joined[joined.length - 1].trimEnd().endsWith("|")) joined[joined.length - 1] += ` ${l}`;
    }
    for (const l of joined) {
      const c = l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((x) => x.trim());
      if (c.length < 5 || !/^[LEDSFPG]\d+$/.test(c[0])) continue;
      rows.push({ id: c[0], frag: c[2], pats: [...c[4].matchAll(/<code>([\s\S]*?)<\/code>/g)].map((m) => norm(m[1])) });
    }
  }

  if (probe === null) {
    skip(RULE_COLUMN, "the meaning probe is not in this tree");
  } else {
    // a departure from the prefix is legal only where the doc says WHY, by id, as a cut-C move
    const prose = probe.slice(0, probe.indexOf("| id |"));
    const bad = rows.filter((r) => {
      if (!(RULEBOOK_FRAGMENTS as readonly string[]).includes(r.frag)) return true;
      if (r.frag === FRAGMENT_BY_RULE_PREFIX[r.id[0]]) return false;
      return !(prose.includes(r.id) && prose.includes("Schnitt C"));
    });
    pin(RULE_COLUMN, rows.length > 0 && bad.length === 0,
      `${rows.length} row(s); unexplained: ${bad.map((r) => r.id).join(",") || "none"}`);
  }

  // --- and the two rules that need the source checkout
  const fragments = new Map<RulebookFragment, string>();
  const unreadable: string[] = [];
  for (const f of RULEBOOK_FRAGMENTS) {
    try { fragments.set(f, readFileSync(`${SOURCE_DIR}/${RULEBOOK_DIR}/${fragmentFileName(f)}`, "utf8")); }
    catch { unreadable.push(f); }
  }
  const why = SOURCE_DIR === null ? "source checkout not locatable from here"
    : `rulebook/ not readable in the source checkout (${unreadable.length}/${RULEBOOK_FRAGMENTS.length} fragment(s))`;

  if (unreadable.length > 0) {
    skip(RULE_RENDER, why);
    skip(RULE_PLACED, why);
  } else {
    const rendered = renderRulebook("main", fragments);
    const monolith = ((): string | null => {
      try { return readFileSync(`${SOURCE_DIR}/CLAUDE.md`, "utf8"); } catch { return null; }
    })();
    if (monolith === null) skip(RULE_RENDER, "CLAUDE.md not readable in the source checkout");
    else pin(RULE_RENDER, rendered === monolith,
      `rendered ${Buffer.byteLength(rendered)} B vs CLAUDE.md ${Buffer.byteLength(monolith)} B`);

    if (probe === null) {
      skip(RULE_PLACED, "the meaning probe is not in this tree");
    } else {
      const text = new Map([...fragments].map(([f, t]) => [f as string, norm(t)]));
      const misplaced: string[] = [];
      let unique = 0;
      for (const r of rows) {
        if (r.pats.length === 0) { misplaced.push(`${r.id}(no pattern)`); continue; }
        const hits = [...text].filter(([, t]) => r.pats.every((p) => t.includes(p))).map(([f]) => f);
        if (!hits.includes(r.frag)) misplaced.push(r.id);
        else if (hits.length === 1) unique++;
      }
      pin(RULE_PLACED, rows.length > 0 && misplaced.length === 0,
        `${rows.length - misplaced.length}/${rows.length} placed, ${unique} of them in that fragment alone${misplaced.length ? `; misplaced: ${misplaced.join(",")}` : ""}`);
    }
  }

  // --- 6c. The back-reference block, and the one seam it protects. A lane no longer HOLDS four of
  // the seven fragments; the block is the only thing that tells it they exist. Needs no checkout:
  // the renderer is pure, so the block can be produced here and read back.
  {
    const RULE_BACKREF = "the lane rulebook's back-reference block names every omitted fragment and an absolute read path for it";
    const RULE_SPLIT = "rulebookBody strips the back-reference block and nothing else — the timestamp cannot read as drift";
    const block = renderBackref("lane", { repoRoot: "/src/repo", at: "2026-01-01T00:00:00.000Z", sourceHash: "deadbeef" });
    const omitted = RULEBOOK_FRAGMENTS.filter((f) => !FRAGMENTS_FOR.lane.includes(f));
    const named = omitted.filter((f) => block.includes(FRAGMENT_TITLES[f]));
    const pathed = omitted.filter((f) => block.includes(`/src/repo/${RULEBOOK_DIR}/${fragmentFileName(f)}`));
    pin(RULE_BACKREF,
      omitted.length > 0 && named.length === omitted.length && pathed.length === omitted.length
        && block.includes(RULEBOOK_BACKREF_HEADING) && block.includes("deadbeef")
        && block.includes("2026-01-01T00:00:00.000Z")
        // `git show main:` is the wrong reflex here and the block says so — the fragments are untracked
        && /git show main:/.test(block),
      `${named.length}/${omitted.length} named, ${pathed.length}/${omitted.length} with a path`);

    const body = renderRulebook("lane", new Map(RULEBOOK_FRAGMENTS.map((f) => [f, `# ${f}\nbody of ${f}\n`])));
    const later = renderBackref("lane", { repoRoot: "/src/repo", at: "2026-06-06T06:06:06.000Z", sourceHash: "deadbeef" });
    pin(RULE_SPLIT,
      rulebookBody(body + block) === body && rulebookBody(body + later) === body && rulebookBody(body) === body
        && block !== later,
      `body ${Buffer.byteLength(body)} B, block ${Buffer.byteLength(block)} B`);
  }
  {
    // The seam and the probe must agree on the expected bytes BY CONSTRUCTION: one function, two
    // call sites. If the gate ever compared against `${repo}/CLAUDE.md` again while the spawn wrote
    // a rendering, `rulebookDrifted` would be permanently true and would order every lane to load
    // the 34 KB the split just saved — the self-cancelling state this cut was written to avoid.
    const RULE_ONE_EXPECTED = "the spawn seam and the /api/self/gate drift probe derive a lane's rulebook from the SAME function";
    const calls = [...server.matchAll(/laneRulebookFor\(/g)].length;
    const wtFrom = server.indexOf("async function createWorktree(");
    const wtTo = server.indexOf("async function syncLaneRefs(");
    const wt = wtFrom > 0 && wtTo > wtFrom ? server.slice(wtFrom, wtTo) : "";
    const gateFrom = server.indexOf('if (url.pathname === "/api/self/gate"');
    const gateTo = gateFrom > 0 ? server.indexOf("suiteLock: suiteLockView()", gateFrom) : -1;
    const gate = gateFrom > 0 && gateTo > gateFrom ? server.slice(gateFrom, gateTo) : "";
    pin(RULE_ONE_EXPECTED,
      calls >= 3 && wt !== "" && gate !== ""
        && wt.includes("laneRulebookFor(root") && wt.includes('writeFileSync(`${path}/CLAUDE.md`')
        && gate.includes("laneRulebookFor(s.worktree.repo") && gate.includes("rulebookBody(copy)"),
      `${calls} call(s); seam=${wt.includes("laneRulebookFor(root")} probe=${gate.includes("laneRulebookFor(s.worktree.repo")}`);
  }
}

// The transport split (owner operations inbox): an inbox event must be unable to reach pane
// delivery BY CONSTRUCTION rather than by a guard someone can forget — FACT 2 selects `pending`
// alone, and an inbox event is minted straight to a status that loop never looks at. Its twin rule
// is the ack split: exactly one principal can close each row, decided by `delivery`. Neither is a
// type. tsc is perfectly content with a loop that selects one more status word, and with two ack
// routes that accept the same row under two different meanings.
{
  const fact2From = server.indexOf("// FACT 2:");
  const fact2To = server.indexOf("// The one-line receiver text is composed");
  const fact2 = fact2From > 0 && fact2To > fact2From ? server.slice(fact2From, fact2To) : "";
  const loopAt = fact2.indexOf("for (const event of fleetEvents) {");
  const selects = loopAt >= 0 && /^for \(const event of fleetEvents\) \{\n\s*if \(event\.status !== "pending"\) continue;/
    .test(fact2.slice(loopAt));
  pin('the FACT 2 transport loop selects status === "pending" alone — an inbox event cannot reach sendText',
    fact2 !== "" && selects && fact2.includes("await sendText(") && !fact2.includes('"inbox"'),
    fact2 === "" ? "FACT 2 region not found in server.ts"
      : `selects=${selects} sends=${fact2.includes("await sendText(")} mentionsInbox=${fact2.includes('"inbox"')}`);

  const selfFrom = server.indexOf("async function acknowledgeFleetEvent");
  const ownerFrom = server.indexOf("async function ownerAcknowledgeFleetEvent");
  const selfAck = selfFrom > 0 && ownerFrom > selfFrom ? server.slice(selfFrom, ownerFrom) : "";
  const ownerAck = ownerFrom > 0 ? server.slice(ownerFrom, ownerFrom + 2000) : "";
  pin("the ack split holds in both directions — self refuses an inbox row, owner refuses a pane row",
    selfAck.includes('event.delivery === "inbox"') && selfAck.includes("belongs to the owner")
      && ownerAck.includes('event.delivery !== "inbox"') && ownerAck.includes("belongs to the receiver session"),
    `self=${selfAck !== ""} owner=${ownerAck !== ""}`);

  // BOTH SIDES ARE TYPESCRIPT AND THAT IS EXACTLY WHY THIS PIN EXISTS. src/client.ts declares the
  // event status union itself rather than importing it, so the pair has no compiler between it: a
  // word added on one side does not fail to build, it silently produces rows the other side never
  // matches. That class has fired twice here already (the `awaiting` cast, the task `kind` rename),
  // and the client now DERIVES from these words — an unmatched status reads as "no such row exists".
  // A share in src/protocol.ts would retire this rule; until someone promotes that, this is the
  // fastener. Rule, not snapshot: the two SETS must be equal, in either direction.
  const words = (s: string): string[] =>
    [...s.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]).sort();
  const srvUnion = server.slice(server.indexOf("type FleetEventStatus ="));
  const srvWords = words(srvUnion.slice(0, srvUnion.indexOf(";")));
  const client = read("src/client.ts");
  const cliFrom = client.indexOf("interface FleetEventRow {");
  const cliStatus = cliFrom > 0 ? client.indexOf("status:", cliFrom) : -1;
  const cliWords = cliStatus > 0 ? words(client.slice(cliStatus, client.indexOf(";", cliStatus))) : [];
  pin("the client's FleetEventRow status union is the same SET of words as the server's FleetEventStatus",
    srvWords.length >= 6 && srvWords.join("|") === cliWords.join("|"),
    `server=[${srvWords.join(",")}] client=[${cliWords.join(",")}]`);
}

// --- STALENESS IS ONE RULE, RENDERED BY TWO READERS. The server decides it in
// analysis-staleness.ts; register.sh renders `!head` from fleet.json on disk, in Python, with no
// compiler between them. Until 2026-08-18 both were a bare tip comparison and agreed by accident;
// now both must intersect what a land MOVED with the row's own file surface and fall to stale when
// either side is unknown. A reader that quietly reverts to the tip is the regression this fastens
// shut — it would look like a simplification and would silently expire every open verdict again.
{
  const RULE_STALE = "staleness is the same FLÄCHE rule on both sides";
  const rule = read("analysis-staleness.ts");
  const reg = read("register.sh");
  // read the arms off the rule's own reason union, never off a copy of the list kept here
  const arms = new Set((rule.match(/export type StaleReason =([^;\n]+)/)?.[1] ?? "")
    .split("|").map((w) => w.trim().replace(/"/g, "")).filter(Boolean));
  pin(`${RULE_STALE} — the rule keeps a surface arm AND both unknown arms`,
    arms.has("brief") && arms.has("surface") && arms.has("unknown-surface") && arms.has("unknown-movement"),
    `[${[...arms].join(",")}]`);
  // server.ts must DECIDE through the rule and ask git for the moved side, never re-derive either
  const body = server.match(/function analysisStale\([\s\S]*?\n\}/)?.[0] ?? "";
  pin(`${RULE_STALE} — analysisStale decides through the rule and asks for the moved surface`,
    /analysisStaleness\(/.test(body) && /movedSurfaceBetween\(/.test(body) && /surfaceOfView\(/.test(body),
    body === "" ? "analysisStale not found in server.ts" : `${body.split("\n").length} lines`);
  // …and register.sh's `!head` arm must do the same two things: intersect a moved set, and treat
  // an unreadable one as stale. The slice is the arm itself, so a bare tip comparison fails here.
  const arm = reg.match(/stale = \[\][\s\S]*?stale\.append\("head"\)/)?.[0] ?? "";
  pin(`${RULE_STALE} — register.sh's !head arm intersects a moved set and falls to stale on unknown`,
    /moved_since\(/.test(arm) && /is None/.test(arm) && /not known/.test(arm),
    arm === "" ? "the !head arm was not found in register.sh" : `${arm.split("\n").length} lines`);
  pin(`${RULE_STALE} — both derive that set the same way: two-dot, rename-blind`,
    /git diff --name-only --no-renames/.test(reg)
    && /"diff", "--name-only", "--no-renames"/.test(server), "");
}

pin("e2e-isolated.sh explicitly arms server.ts's default-off migration tick (otherwise its runtime checks measure nothing)", /const MIGRATE_PCT = Number\(process\.env\.FLEET_MIGRATE_PCT \?\? 0\) \| 0/.test(server) && /\bFLEET_MIGRATE_PCT=[1-9]\d*\b/.test(read("e2e-isolated.sh")));

// --- SLICE A: THE DERIVED PROGRAM PHASE IS A PROJECTION, AND A PROJECTION HAS TO STAY ONE.
// program-phase.ts computes where a Program row sits on the rail from a closed input list. Three
// things could quietly turn it into something else, and none of them is visible to a compiler:
// a third consumer (an actuator reading `phase` and then DOING something), a pruned or spawning
// input sneaking into the reducer, and a second `mergeJob(` call site appearing under cover of
// "the projection needed it". Each row below is a rule, not a snapshot.
{
  const RULE_PHASE = "the program phase reducer is a projection, never an actuator";
  const reducer = read("program-phase.ts");
  const body = (name: string): string =>
    server.match(new RegExp(`async function ${name}\\(s: Slot\\): Promise<Response> \\{[\\s\\S]*?\\n\\}`))?.[0] ?? "";
  const execBody = body("programExecutionView");
  const supBody = body("supervisorView");
  const callsIn = (text: string): number => text.split("phaseOf(").length - 1;
  // the honesty arm is part of the TYPE, so a build that dropped it could not compile a caller
  // that handles it — this pin catches the edit that removes it from the union instead.
  const phaseUnion = reducer.match(/export type Phase =([\s\S]*?);/)?.[1] ?? "";
  pin(`${RULE_PHASE} — Phase keeps its UNKNOWN arm and the reducer exports phaseOf`,
    /"UNKNOWN"/.test(phaseUnion) && /export function phaseOf\(/.test(reducer),
    `union=[${phaseUnion.trim()}]`);
  pin(`${RULE_PHASE} — server.ts calls phaseOf in exactly the two view functions and nowhere else`,
    execBody !== "" && supBody !== "" && callsIn(execBody) === 1 && callsIn(supBody) === 1
      && callsIn(server) === 2,
    `exec=${callsIn(execBody)} supervisor=${callsIn(supBody)} server=${callsIn(server)}`);
  // Condition 1 of the review: a pruned input (fleetReports, terminal attention rows) or a git
  // spawn would make the same row project differently between two GETs with no fact change.
  // comments STRIPPED first: the file's header names these very tokens to say it must not read
  // them, and a pin that failed on the prose explaining the rule would delete the explanation.
  const reducerCode = reducer.split("\n").filter((l) => !l.trim().startsWith("//"))
    .map((l) => l.replace(/\s\/\/.*$/, "")).join("\n");
  const forbidden = ["fleetReports", "spawnSync", "execFile", "readLedger", "transcript"]
    .filter((token) => reducerCode.includes(token));
  pin(`${RULE_PHASE} — the reducer reads no pruned, spawned or text input`,
    forbidden.length === 0, `[${forbidden.join(",")}]`);
  // …and the other half of that pair: the server-side input builder is the ONE place attention
  // rows enter, so its filter must carry the open-status guard rather than counting pruned rows.
  const inputBuilder = server.match(/function programPhaseInput\([\s\S]*?\n\}/)?.[0] ?? "";
  const attentionFilters = server.split("attentionRequests.filter(").length - 1;
  // Falsifier §10.6: the Supervisor rollup is the one place a projection could leak row bodies onto
  // the largest Supervisor payload. A histogram is under 100 B per program; per-row bases are not.
  const rollup = supBody.match(/tasks: \{[^}]*phases[^}]*\}/)?.[0] ?? "";
  pin(`${RULE_PHASE} — the Supervisor rollup carries phase COUNTS, never row bodies`,
    rollup !== "" && !/phaseBasis|candidate|rows:/.test(rollup)
      && /phases\[derived\.phase\] = \(phases\[derived\.phase\] \?\? 0\) \+ 1;/.test(supBody),
    rollup === "" ? "no phases rollup found in supervisorView" : rollup.trim());
  // …and the POINTER that rides beside the phase. `nextAction` is a projection like `phase` and
  // inherits its one hard rule: it says WHERE a row sits and WHICH door is next, never whether the
  // work is good. A grading word here would smuggle a judgement into a mechanism that must not
  // grade — and it would do it on the surface a MAIN reads before deciding to land. Checked as a
  // rule over the source because the branches are few and every one of them is a literal.
  const nextBody = server.slice(server.indexOf("function nextActionFor("),
    server.indexOf("\n}", server.indexOf("function nextActionFor(")));
  const grading = ["good", "bad", "ready to ship", "looks", "quality", "healthy", "broken", "safe"]
    .filter((w) => new RegExp(`\\b${w}\\b`, "i").test(nextBody.split("\n")
      .filter((l) => !l.trim().startsWith("//")).join("\n")));
  pin(`${RULE_PHASE} — nextAction names a door, never a grade, and reads only phase + status + the promotion record`,
    nextBody !== "" && grading.length === 0
    && !/fleetReports|lastOutput|transcript|readLedger|spawnSync/.test(nextBody)
    && /promotion && promotion\.selfLand !== "off"/.test(nextBody),
    JSON.stringify({ grading, hasPolicyBranch: /promotion && promotion\.selfLand !== "off"/.test(nextBody) }));
  pin(`${RULE_PHASE} — the phase input counts only OPEN attention rows`,
    inputBuilder !== "" && /attentionRequests\.filter\(/.test(inputBuilder)
      && /a\.status === "open" \|\| a\.status === "send-uncertain"/.test(inputBuilder),
    inputBuilder === "" ? "programPhaseInput not found in server.ts"
      : `${attentionFilters} attentionRequests.filter sites in server.ts`);
}

// --- ONE LAND PATH, NOW WITH TWO DOORS ONTO IT. The phase projection names INTEGRATING and
// CONTINUE; naming them must never become a reason to actuate them. From 2026-08-24 `mergeJob(` has
// exactly TWO textual call sites and both are ROUTES: the owner merge route and the Program-MAIN
// self-land route. The NUMBER is not the property — the property is that no TICK calls it. An
// auto-land is a non-goal of the authority slice in the owner's own words, and the whole difference
// between "a principal asked" and "the server decided" is one call site inside a scheduler.
// Deliberately counted textually rather than through a wrapper: a `startMergeRun()` helper would
// read as one call site and let a third caller hide behind its name.
{
  const RULE_LAND = "mergeJob is reachable only from routes";
  const lines = server.split("\n");
  const callSites = lines
    .map((line, i) => ({ line, n: i }))
    .filter(({ line }) => line.includes("mergeJob(")
      && !line.trim().startsWith("//")
      && !/^async function mergeJob\(/.test(line.trim()));
  const ownerRoute = lines.findIndex((l) => l.includes("const mgMatch = /^\\/api\\/slots\\/(\\d+)\\/merge$/"));
  const selfHandler = lines.findIndex((l) => l.includes("async function selfLandTaskForMain("));
  const selfHandlerEnd = lines.findIndex((l, i) => i > selfHandler && l === "}");
  pin(`${RULE_LAND} — exactly two call sites`, callSites.length === 2,
    `${callSites.length} sites: [${callSites.map((c) => c.n + 1).join(",")}]`);
  // …and WHERE they sit. One inside the ⏫ owner merge route (bounded by the next route matcher,
  // which needs no brace count), one inside the self-land handler.
  const ownerCall = callSites.find((c) => c.n > ownerRoute);
  const nextRoute = ownerCall ? lines.findIndex((l, i) => i > ownerCall.n && /\/\^\\\/api\\\//.test(l)) : -1;
  const selfCall = callSites.find((c) => c.n > selfHandler && c.n < selfHandlerEnd);
  pin(`${RULE_LAND} — one sits inside the ⏫ owner merge route, the other inside selfLandTaskForMain`,
    !!ownerCall && ownerRoute >= 0 && nextRoute > ownerCall.n
      && !!selfCall && selfHandler >= 0 && selfHandlerEnd > selfHandler,
    `owner route=${ownerRoute + 1} call=${(ownerCall?.n ?? -1) + 1} nextRoute=${nextRoute + 1} | self ${selfHandler + 1}..${selfHandlerEnd + 1} call=${(selfCall?.n ?? -1) + 1}`);
  // …and the direction that actually matters, asserted as ITSELF rather than inferred from the two
  // above: NO tick calls it. A third call site added inside a scheduler would move the count to 3
  // and fail the first pin, but a future edit that also relaxed the count would slip past — so the
  // tick bodies are read directly.
  const tickBody = (sig: string): string => {
    const i = server.indexOf(sig);
    return i < 0 ? "" : server.slice(i, server.indexOf("\n}\n", i));
  };
  const ticks = ["async function tickDispatch(", "async function tickAutos(", "async function tickGit(",
    "async function tickWatches(", "async function tickAutoReview("].map(tickBody).filter(Boolean);
  pin(`${RULE_LAND} — no tick calls mergeJob at all`,
    ticks.length >= 3 && ticks.every((b) => !b.includes("mergeJob(")),
    `${ticks.length} tick bodies scanned`);
  // …and both doors derive what a re-run carries out of the superseded verdict through the ONE
  // shared helper. A route that grew its own copy would sooner or later drop unreviewed conflict
  // resolutions on one path while honouring them on the other — the ⏸ guard lives in there too.
  const carryCalls = lines.filter((l) => l.includes("carriedFromPendingVerdict(")
    && !l.trim().startsWith("//") && !/^async function carriedFromPendingVerdict\(/.test(l.trim()));
  // --- THE ACTOR IS NEVER ABSENT ON A NEW NOTE. `LandProvenance.actor` is a REQUIRED field, which
  // tsc enforces at every construction — but tsc cannot stop the field from being made optional in
  // a later edit, and an optional actor would be absent on exactly the land nobody wanted to
  // attribute. So the requirement itself is pinned, together with the note writer actually writing
  // it: a required field that writeLandNote dropped would be a type nobody could read back.
  const provDecl = server.slice(server.indexOf("interface LandProvenance {"),
    server.indexOf("\n}", server.indexOf("interface LandProvenance {")));
  const noteWriter = server.slice(server.indexOf("async function writeLandNote("),
    server.indexOf("\n}", server.indexOf("async function writeLandNote(")));
  pin(`${RULE_LAND} — LandProvenance.actor is REQUIRED and writeLandNote puts it in every note it writes`,
    /\n  actor: LandActor;/.test(provDecl) && !/actor\?:/.test(provDecl)
    && /\n      actor: prov\.actor,/.test(noteWriter),
    JSON.stringify({ required: /\n  actor: LandActor;/.test(provDecl),
      written: /actor: prov\.actor/.test(noteWriter) }));
  // …and the CHANNEL is READ, not guessed. `tokenChannel` mirrors tokenFrom's own precedence
  // (bearer → cookie → query); if the two ever disagree the suspect flag would be stamped on the
  // wrong requests and nothing at runtime would notice. Asserted as "both read the same three
  // sources in the same order" rather than by comparing bodies, which would break on a reformat.
  const chanBody = server.slice(server.indexOf("function tokenChannel("),
    server.indexOf("\n}", server.indexOf("function tokenChannel(")));
  const fromBody = server.slice(server.indexOf("function tokenFrom("),
    server.indexOf("\n}", server.indexOf("function tokenFrom(")));
  const tokenOrder = (b: string): string[] =>
    [...b.matchAll(/authorization|fleet=|searchParams\.get\("token"\)/g)].map((m) => m[0]);
  pin(`${RULE_LAND} — tokenChannel reads the SAME three token sources in the SAME order tokenFrom accepts them`,
    tokenOrder(chanBody).length === 3
    && JSON.stringify(tokenOrder(chanBody)) === JSON.stringify(tokenOrder(fromBody)),
    JSON.stringify({ channel: tokenOrder(chanBody), from: tokenOrder(fromBody) }));
  // …and the CONFIRM step has exactly one implementation too, with two callers. The `guarded` rung
  // widens WHO may take the existing confirm, and the whole argument for allowing it rests on there
  // being no second land path to audit — so a second `markLandIntent` outside the two known writers
  // (the clean auto-land in mergeJob and this confirm function) is the shape that breaks it.
  const confirmCalls = lines.filter((l) => l.includes("confirmResolvedCandidate(")
    && !l.trim().startsWith("//") && !/^async function confirmResolvedCandidate\(/.test(l.trim()));
  const intentCalls = lines.filter((l) => l.includes("markLandIntent(")
    && !l.trim().startsWith("//") && !/^async function markLandIntent\(/.test(l.trim()));
  pin(`${RULE_LAND} — one confirm implementation with two callers, and only two writers declare a land intent`,
    confirmCalls.length === 2 && intentCalls.length === 2,
    `${confirmCalls.length} confirmResolvedCandidate call sites, ${intentCalls.length} markLandIntent call sites`);
  // …and the two arms differ in exactly the dimension the owner policy names: the MAIN arm
  // RE-VERIFIES. A `byHuman:false` path that reached the land without a runVerify would be a
  // "guarded" promotion that guards nothing, and no runtime probe on a fleet without a promotion
  // record could see it.
  const confirmBody = server.slice(server.indexOf("async function confirmResolvedCandidate("),
    server.indexOf("\n}\n", server.indexOf("async function confirmResolvedCandidate(")));
  const confirmPlan = confirmBody.indexOf("verifyPlanFor(cwd, repo, mainBefore)");
  const confirmReport = confirmBody.indexOf("reportServerRun(");
  const confirmRun = confirmBody.indexOf("runVerify(cwd, mainBefore, verifyPlan)");
  pin(`${RULE_LAND} — the MAIN arm plans before publishing its run, then verifies and lands only on ok:true`,
    /if \(!opts\.byHuman\) \{/.test(confirmBody)
    && confirmPlan >= 0 && confirmReport > confirmPlan && confirmRun > confirmReport
    && /if \(!fresh \|\| fresh\.ok !== true\)/.test(confirmBody)
    && confirmRun < confirmBody.indexOf("markLandIntent("),
    JSON.stringify({ arm: /if \(!opts\.byHuman\) \{/.test(confirmBody),
      plan: confirmPlan, report: confirmReport, run: confirmRun,
      beforeIntent: confirmRun < confirmBody.indexOf("markLandIntent(") }));
  pin(`${RULE_LAND} — both doors derive carried/carriedBy through the one shared helper`,
    carryCalls.length === 2
    && !/const carried = \(pend\?\.conflicted/.test(server.slice(server.indexOf("const mgMatch = /^"))),
    `${carryCalls.length} carriedFromPendingVerdict call sites`);
}

// --- THE EVENT KINDS ARE A CLOSED SET. Every new kind inherits the whole transport failure surface
// (pending / send-uncertain / delivered / inbox / receiver-gone), and the state slice deliberately
// adds none: it derives from facts the server already holds. A kind appearing here without that
// decision being made on purpose is exactly the drift this fastens.
{
  const RULE_KINDS = "the FleetEvent kind set is closed";
  const expected = ["lane-ready", "host-commit-ready", "merge-terminal", "post-land-audit",
    "deploy-terminal", "clarification-request", "fleet-report", "supervisor-transition"].sort();
  const signals = read("lane-signals.ts");
  const laneKinds = (signals.match(/export type LaneWatchEventKind =([^;\n]+)/)?.[1] ?? "")
    .split("|").map((w) => w.trim().replace(/"/g, "")).filter(Boolean);
  const found = new Set<string>();
  for (const block of server.match(/interface \w+FleetEvent extends FleetEventBase \{[\s\S]*?\n\}/g) ?? []) {
    const kind = block.match(/\n\s+kind: ([^;]+);/)?.[1]?.trim() ?? "";
    if (kind === "LaneWatchEventKind") laneKinds.forEach((k) => found.add(k));
    else kind.split("|").forEach((k) => found.add(k.trim().replace(/"/g, "")));
  }
  const union = (server.match(/type FleetEvent =([\s\S]*?);/)?.[1] ?? "")
    .split("|").map((w) => w.trim()).filter(Boolean);
  const got = [...found].sort();
  pin(`${RULE_KINDS} — the interfaces yield exactly the eight known kinds`,
    JSON.stringify(got) === JSON.stringify(expected), `[${got.join(",")}]`);
  pin(`${RULE_KINDS} — every union member is one of those interfaces (no kind enters off-list)`,
    union.length > 0 && union.every((m) => new RegExp(`interface ${m} extends FleetEventBase \\{`).test(server)),
    `[${union.join(",")}]`);
}

// --- SLICE B: THE RETURN PATH. Two halves of one rule, and they fail in opposite directions.
// clarificationReceiverFor answers "who coordinates this lane" for both self-routes. For a lane
// with a Program the answer is the binding and nothing else may outrank it — an outsider's stale
// subscription is not evidence about a bound lane, and consulting it first refused reports the
// worker could not have prevented. For a lane WITHOUT a Program the watch rows are the only
// evidence there is, so two of them naming different occupants must stay a refusal rather than
// become a coin toss. Textual order is the pin because both halves are one function's control
// flow: a compiler cannot see that a return moved below a block.
{
  const RULE_RECEIVER = "the clarification receiver answers program binding BEFORE watch evidence";
  const receiver = server.match(/function clarificationReceiverFor\([\s\S]*?\n\}/)?.[0] ?? "";
  const programReturn = receiver.indexOf('return { receiver: programReceiver, basis: "program-main" };');
  const watchBlock = receiver.indexOf("const watchReceivers");
  pin(`${RULE_RECEIVER} — the program-main return precedes the watch block (B1)`,
    receiver !== "" && programReturn >= 0 && watchBlock >= 0 && programReturn < watchBlock,
    receiver === "" ? "clarificationReceiverFor not found in server.ts"
      : `program-main@${programReturn} watchReceivers@${watchBlock}`);
  // The opposite direction, and it is NOT implied by the one above: a reorder that also deleted
  // the refusal would pass B1 and silently route a program-less lane to an arbitrary watcher.
  pin(`${RULE_RECEIVER} — the program-LESS multi-watcher refusal survives verbatim (B2)`,
    receiver.includes('return { error: "lane-watch evidence names multiple receiver occupants" };'),
    receiver === "" ? "clarificationReceiverFor not found in server.ts"
      : `${(receiver.match(/return \{ error: "[^"]*" \}/g) ?? []).length} refusal sentences in the function`);
  // B3, doc ↔ route ↔ footer. The footer is the only text most lanes ever read about how to end,
  // so a route renamed without it becomes a curl that 404s in every founding brief from then on.
  const selfApi = read("docs/self-api.md");
  const footer = server.match(/const LANE_EXIT_FOOTER = `[\s\S]*?\n`;/)?.[0] ?? "";
  const statuses = ["complete", "needs-main", "failed"];
  pin(`${RULE_RECEIVER} — docs/self-api.md carries §fleet-report and §tasks, and the footer names the route (B3)`,
    /^## fleet-report/m.test(selfApi) && /^## tasks/m.test(selfApi)
      && footer.includes("/api/self/fleet-report") && selfApi.includes("/api/self/fleet-report"),
    `fleet-report=${/^## fleet-report/m.test(selfApi)} tasks=${/^## tasks/m.test(selfApi)} footer=${footer !== ""}`);
  // …and the three statuses are ONE list. The footer interpolates FLEET_REPORT_STATUSES so it
  // cannot drift from the route by construction; the doc is prose and can, which is why it is
  // checked against the same literal source the route validates against.
  const declared = (read("src/protocol.ts").match(/FLEET_REPORT_STATUSES = \[([^\]]*)\]/)?.[1] ?? "")
    .split(",").map((w) => w.trim().replace(/"/g, "")).filter(Boolean);
  const reportSection = selfApi.slice(selfApi.indexOf("## fleet-report"));
  pin(`${RULE_RECEIVER} — the three report statuses are one list across protocol, footer and doc`,
    JSON.stringify(declared) === JSON.stringify(statuses)
      && footer.includes("FLEET_REPORT_STATUSES.join")
      && statuses.every((status) => reportSection.includes(status)),
    `declared=[${declared.join(",")}]`);
  // The footer is a LIFECYCLE instruction, and a clarify lane has a different lifecycle: it stops
  // for the owner. Appending it there would tell a lane to finish work it was told not to start.
  pin(`${RULE_RECEIVER} — the exit footer is appended to mutating briefs only, clarify exempted at the seam`,
    /const deliveredBrief = `\$\{brief\}\$\{anchorBlock\}\$\{clarify \? "" : LANE_EXIT_FOOTER\}`;/.test(server)
      && (server.split("LANE_EXIT_FOOTER").length - 1) === 2,
    `LANE_EXIT_FOOTER mentions=${server.split("LANE_EXIT_FOOTER").length - 1}`);
}

// --- THE PROGRAM-MAIN EXECUTION RAIL ↔ THE TWO PROSE CONTRACTS. The block is the only text a
// freshly founded Program-MAIN is guaranteed to read, and it is the reason the doors it names must
// keep existing under those spellings. TypeScript sees none of that: `AGENTS.md` is the portable
// contract a session binds to and `docs/self-api.md` is the reference it is sent to, and both are
// markdown. A route renamed in one place and not the others produces a founding brief full of
// curls that 404, exactly the way the lane exit footer would — same failure, same kind of pin.
{
  const RULE_RAIL = "the founding execution rail, the portable role contract and the Self-API reference name ONE set of doors";
  const rail = server.match(/const PROGRAM_MAIN_RAIL_BLOCK = `[\s\S]*?\n[^\n]*`;/)?.[0] ?? "";
  const selfApiDoc = read("docs/self-api.md");
  const agents = read("AGENTS.md");
  // The doors, spelled as the delivered text spells them. `<taskId>` in the brief and `:id` in the
  // docs are the same door in two notations, so each is checked against its own side's spelling.
  const doors: readonly (readonly [string, string])[] = [
    ["GET /api/self/program-execution", "GET /api/self/program-execution"],
    ["POST /api/self/tasks with", "POST /api/self/tasks"],
    ["POST /api/self/tasks/<taskId>/release", "POST /api/self/tasks/:id/release"],
    ["POST /api/self/tasks/<taskId>/land", "POST /api/self/tasks/:id/land"],
    ["POST /api/self/watch", "POST /api/self/watch"],
    ["POST /api/self/attention", "POST /api/self/attention"],
  ];
  const missingRail = doors.filter(([inRail]) => !rail.includes(inRail)).map(([d]) => d);
  const missingDoc = doors.filter(([, inDoc]) => !selfApiDoc.includes(inDoc)).map(([, d]) => d);
  pin(`${RULE_RAIL} — every door the founding block names has a section that documents it (A)`,
    rail !== "" && /^## Program-MAIN-Ausführungsschiene/m.test(selfApiDoc)
      && missingRail.length === 0 && missingDoc.length === 0,
    rail === "" ? "PROGRAM_MAIN_RAIL_BLOCK not found in server.ts"
      : `railMissing=[${missingRail.join(",")}] docMissing=[${missingDoc.join(",")}]`);
  // The ADDRESS is the falsifier the owner paid for by hand: a MAIN that has to search for Fleet.
  // It must be the server's OWN interpolated HOST/PORT — a literal would be right on this machine
  // and wrong on every other — and it must be the self credential, never an owner one.
  pin(`${RULE_RAIL} — the block interpolates the server's own address and names only the self credential (B)`,
    rail.includes("http://${HOST}:${PORT}")
      && rail.includes("x-fleet-self-token: $FLEET_SELF_TOKEN")
      && !/x-fleet-token|\/api\/slots\/|\/api\/programs\//.test(rail),
    `host=${rail.includes("http://${HOST}:${PORT}")} selfToken=${rail.includes("x-fleet-self-token: $FLEET_SELF_TOKEN")}`);
  // THE OWNER'S CORRECTION OF 2026-08-24 lives in three files and fails in opposite directions in
  // each: a blanket "every mutation goes to a worker" makes the MAIN a scheduler, and dropping the
  // lane half puts the whole product back in the MAIN checkout. The portable contract is where a
  // session actually binds to it, so it is the side that must not go silent — and it must stay a
  // JUDGEMENT: a posture enum, a size threshold or a decision table is precisely what was refused.
  const agentsRule = agents.includes("is a JUDGEMENT, never a posture, a")
    && agents.includes("Small, reversible, low-risk changes inside the confirmed scope")
    && agents.includes("isolated worker lane");
  const railRule = rail.includes("THE ROLE SPLIT IS A JUDGEMENT, NOT A WALL")
    && rail.includes("Use an isolated worker lane for substantial product implementation");
  pin(`${RULE_RAIL} — both halves of the role judgement stand in the block and in the portable contract (C)`,
    agentsRule && railRule && !/\b\d+\s*(lines|files|LOC)\b/.test(rail),
    `agents=${agentsRule} rail=${railRule}`);
}

// --- THE PROMOTE DOOR ON THE BOARD ↔ THE TWO OWNER-GATED ROUTES. Promotion was terminal-only
// (promote-program.sh) until the Program pane grew a button for it. There is no DOM harness here,
// so the client half of that pair can only be fastened at the source — and these are exactly the
// properties no compiler sees: that both transitions are issued from ONE pane and in order, that a
// refusal reaches the owner as the server's own sentence, and that the pane never re-issues a
// confirm as a repair. The route half is measured live in e2e/programs.ts ("promote button: …").
{
  const RULE_PROMOTE = "the Board's promote door is the two owner-gated transitions, in order, and nowhere else";
  const client = read("src/client.ts");
  const from = client.indexOf("function renderProgramDetail(");
  // bounded by the function's OWN closing brace (column 0), not by whatever function follows it:
  // an anchor on the next declaration would swallow a promote door pasted in between and call it
  // "inside the pane" — which is precisely the edit the outside-count below exists to catch.
  const detail = from < 0 ? "" : client.slice(from, client.indexOf("\n}\n", from) + 3);
  const blockAt = detail.indexOf('if (p.status === "proposed" || p.status === "confirmed") {');
  const block = blockAt < 0 ? "" : detail.slice(blockAt, detail.indexOf("const bs = qDetailSection", blockAt));
  // BOTH transitions, and only from here. Every POST the client aims at a program route is
  // collected, so a second promote door built anywhere else fails this row instead of quietly
  // becoming a second surface onto an owner-only rail.
  const posts = [...client.matchAll(/post\(`\/api\/programs\/\$\{[^}]+\}\//g)];
  const outside = posts.filter((m) => (m.index ?? -1) < from || (m.index ?? -1) >= from + detail.length);
  pin(`${RULE_PROMOTE} — renderProgramDetail posts confirm AND activate, and no other client code posts a program transition`,
    detail !== "" && block !== "" && outside.length === 0
      && /action: "confirm" \| "activate"/.test(block)
      && /post\(`\/api\/programs\/\$\{forId\}\/\$\{action\}`, \{\}\)/.test(block)
      && /step\("confirm"\)/.test(block) && /step\("activate"\)/.test(block),
    detail === "" ? "renderProgramDetail not found in src/client.ts"
      : block === "" ? "the promote section was not found in renderProgramDetail"
        : `postsOutsideThePane=${outside.length}`);
  // ORDER, and the guard on it. An unconditional activate would turn a refused confirm into a
  // second refusal the owner has to decode, and on a proposed row it would simply be wrong.
  const confirmAt = block.indexOf('await step("confirm")');
  const activateAt = block.indexOf('await step("activate")');
  pin(`${RULE_PROMOTE} — activate runs after confirm and only on confirm's ok; nothing activates unconditionally`,
    confirmAt >= 0 && activateAt > confirmAt
      && /if \(err === null\) \{/.test(block.slice(confirmAt, activateAt))
      && block.split('await step("activate")').length - 1 === 1,
    `confirm=${confirmAt} activate=${activateAt}`);
  // VERBATIM. confirm's 409 and activate's 409 are the same sentence shape, so the pane must carry
  // the server's status AND its own words, name the step, and put it where the pane already puts
  // refusals — a toast would take the one line that says which door closed and float it away.
  const stepFn = block.match(/const step = async[\s\S]*?\n    \};/)?.[0] ?? "";
  pin(`${RULE_PROMOTE} — a refusal renders the server's own status and sentence, names its step, and is never a toast`,
    /\$\{r\.status\}: \$\{j\.error\}/.test(stepFn) && /no readable reason/.test(stepFn)
      && /\$\{action\} failed/.test(stepFn)
      && /pkdwarn", qPlErr/.test(block) && !/toast\(|alert\(|window\.confirm/.test(block),
    stepFn === "" ? "the promote step function was not found" : `${stepFn.split("\n").length} lines`);
  // BUSY AND GENERATION, both. The busy flag alone still lets a late answer write into a draft that
  // has moved on; the generation alone still lets the owner fire the pair twice.
  pin(`${RULE_PROMOTE} — the button is disabled in flight AND a late answer is fenced by generation and id`,
    /qPlBusy = true;/.test(block) && /\.disabled = qPlBusy;/.test(block)
      && /const seq = \+\+qPlSeq;/.test(block) && /seq === qPlSeq && qPlFor === forId/.test(block)
      && /qPlSeq\+\+;/.test(block),
    `busy=${/\.disabled = qPlBusy;/.test(block)} seq=${/const seq = \+\+qPlSeq;/.test(block)}`);
  // THE RECOVERY DOOR. A confirm that landed while its activate failed is a real state, and it is
  // repairable here only if `confirmed` renders its own action AND that action starts at activate.
  // Re-issuing confirm as a repair would meet the server's "conflicting confirm" 409 for a row that
  // is in fact perfectly fine.
  pin(`${RULE_PROMOTE} — a confirmed program gets its own activate action and never re-issues confirm as a repair`,
    /run\(p\.status === "proposed" \? "proposed" : "confirmed"\)/.test(block)
      && /if \(from === "proposed"\) \{\s*\n\s*err = await step\("confirm"\);/.test(block)
      && /if \(moved\) await loadPrograms\(true\);/.test(block),
    `confirmedBranch=${/: "confirmed"\)/.test(block)}`);
  // A REJECTED REQUEST IS AN OUTCOME, NOT AN ESCAPE. `post` → `api` → `fetch`, and a fetch that
  // rejects (offline, a dropped link, the server restarting under the click — the board is read
  // from a phone) walks out of the step, out of the run and out of the `void run(...)` in the
  // onclick as an unhandled rejection: the door then stays disabled on "promoting…" and the pane
  // says nothing at all. Every promote request is therefore caught AT its call and the caught case
  // returns a sentence, exactly like a refusal does.
  const promotePosts = [...block.matchAll(/post\(`[^`]*`, \{\}\)(\.catch\()?/g)];
  const unguarded = promotePosts.filter((m) => !m[1]).length;
  pin(`${RULE_PROMOTE} — a request that rejects is caught at its call and becomes a sentence, never an escaping rejection`,
    promotePosts.length > 0 && unguarded === 0
      && /\.catch\(\(\) => null\)/.test(stepFn) && /if \(!r\) return noAnswer\(action\);/.test(stepFn),
    stepFn === "" ? "the promote step function was not found"
      : `promotePosts=${promotePosts.length} unguarded=${unguarded}`);
  // CLEARED ON EVERY EXIT, not per branch. The flag used to be cleared in the one branch that
  // reached the tail, so any exit before it left the button disabled forever — recoverable only by
  // selecting another program, which is not a recovery the owner can be expected to find. A
  // `finally` cannot be exited around; `mine()` still fences the write, because a busy flag set by
  // a NEWER run belongs to that run and an orphan must not enable a button that is in flight.
  const runFn = block.match(/const run = async[\s\S]*?\n    \};/)?.[0] ?? "";
  const finallyAt = runFn.indexOf("} finally {");
  const clearAt = runFn.indexOf("qPlBusy = false;");
  pin(`${RULE_PROMOTE} — the busy flag is cleared in a finally, on every exit, and nowhere else in the run`,
    runFn !== "" && /\n      try \{/.test(runFn) && finallyAt > 0 && clearAt > finallyAt
      && runFn.split("qPlBusy = false;").length - 1 === 1
      && /if \(mine\(\)\) \{\s*\n\s*qPlBusy = false;/.test(runFn),
    runFn === "" ? "the promote run function was not found" : `finally=${finallyAt} clear=${clearAt}`);
  // NO INVENTED STATUS, AND NOT A PROOF THAT NOTHING HAPPENED. A refusal prints the server's own
  // status; a request that got no answer HAS none, so its sentence names its step and says the
  // outcome is unknown rather than borrowing a number. And because it may well have landed, it
  // counts as moved-UNKNOWN at BOTH steps: the facts are re-read instead of a stale `proposed`
  // being repainted over a program that is in truth already confirmed.
  const noAnswerFn = block.match(/const noAnswer = [\s\S]*?;\n/)?.[0] ?? "";
  pin(`${RULE_PROMOTE} — an unanswered request invents no status code and counts as moved-UNKNOWN at both steps`,
    noAnswerFn !== "" && !/r\.status/.test(noAnswerFn) && /\$\{action\}/.test(noAnswerFn)
      && /moved = err === null \|\| err === noAnswer\("confirm"\);/.test(block)
      && /moved = moved \|\| err === null \|\| err === noAnswer\("activate"\);/.test(block),
    noAnswerFn === "" ? "the unanswered-request sentence was not found"
      : `sentence=${noAnswerFn.trim().length} chars`);
}

// --- THE SELF-LAND PROMOTION DOOR, CLIENT HALF ------------------------------------------------
// The route half is measured live in e2e/programs.ts ("promotion door: …") and the pure display
// function is CUT OUT AND RUN there too. What neither of those can reach is the wiring: that the
// four owner acts are issued from ONE pane, that each is an explicit click and none fires on a
// render, that the bodies are exactly the closed shapes the server reads, and that a refusal
// reaches the owner as the server's own sentence. Those are properties of the source, so they are
// fastened at the source — the same reason and the same shape as RULE_PROMOTE above.
//
// A PERMISSION IS WHY THIS IS PINNED AT ALL. A promote door that quietly grew a second call site,
// a body that grew a fifth key, or a grant that fired on render would each hand a MAIN authority
// nobody clicked for — and none of the three is visible to a compiler.
{
  const RULE_PROMOTION_UI = "the Board's self-land promotion door is four explicit owner acts in one pane, and nowhere else";
  const client = read("src/client.ts");
  const from = client.indexOf("function renderProgramDetail(");
  // the function's OWN closing brace, exactly as RULE_PROMOTE bounds it, and for the same reason:
  // an anchor on the next declaration would swallow a promotion door pasted in between.
  const detail = from < 0 ? "" : client.slice(from, client.indexOf("\n}\n", from) + 3);
  const pmAt = detail.indexOf("if (qPmFor !== p.id) {");
  const staleAt = detail.indexOf('if (mark === "stale" || mark === "unknown") {');
  const pm = pmAt < 0 || staleAt < 0 || staleAt < pmAt ? "" : detail.slice(pmAt, staleAt);

  // (1) ONE DOOR. Every promotion POST the client makes is collected across the WHOLE file: a
  // second surface onto an owner-only permission rail fails this row instead of quietly existing.
  const pmPostsAll = [...client.matchAll(/post\(`\/api\/programs\/\$\{[^}]+\}\/promotion`/g)];
  const pmOutside = pmPostsAll.filter((m) => {
    const i = m.index ?? -1;
    return i < from || i >= from + detail.length || i - from < pmAt || i - from >= staleAt;
  });
  pin(`${RULE_PROMOTION_UI} — exactly one promotion POST exists in the client and it is inside renderProgramDetail's promotion section`,
    detail !== "" && pm !== "" && pmPostsAll.length === 1 && pmOutside.length === 0,
    detail === "" ? "renderProgramDetail not found in src/client.ts"
      : pm === "" ? `the promotion section was not found (pmAt=${pmAt} staleAt=${staleAt})`
        : `posts=${pmPostsAll.length} outside=${pmOutside.length}`);

  // (2) PLACEMENT IS LOAD-BEARING, not taste. Above the stale/unknown early return, because that
  // return fires for exactly the program whose standing permission an owner most wants back; and
  // clear of RULE_PROMOTE's own span, which is sliced by text and would otherwise swallow this.
  const frameAt = detail.indexOf('qDetailSection(shell.detail, "Frame"');
  const promoteAt = detail.indexOf('if (p.status === "proposed" || p.status === "confirmed") {');
  pin(`${RULE_PROMOTION_UI} — the section sits after Frame, before the stale/unknown return, and outside the promote block`,
    frameAt >= 0 && promoteAt >= 0 && frameAt < pmAt && pmAt < staleAt && staleAt < promoteAt,
    `frame=${frameAt} pm=${pmAt} stale=${staleAt} promote=${promoteAt}`);

  // (3) THE FOUR BODIES, AND NO FIFTH. The server refuses an extra top-level key and an unknown key
  // inside the policy, so the client must not be able to assemble one: the shapes are DATA, stated
  // once, and the counts below are what makes "closed" checkable — three rungs, one revoke, and a
  // `policy` that appears nowhere but the table and its type.
  // counted on `selfLand: "` — the quote matters: the Record's own type annotation carries a bare
  // `selfLand: string`, and counting that as a rung would let a fourth rung slip in unnoticed.
  const rungs = pm.split('selfLand: "').length - 1;
  const revokes = pm.split("policy: null").length - 1;
  pin(`${RULE_PROMOTION_UI} — the four bodies are the server's exact closed shapes, written as data, with no fifth key`,
    /const PM_BODY: Record<PmAct, \{ policy: \{ v: 1; selfLand: string \} \| null \}> = \{/.test(pm)
      && /"green-only": \{ policy: \{ v: 1, selfLand: "green-only" \} \},/.test(pm)
      && /guarded: \{ policy: \{ v: 1, selfLand: "guarded" \} \},/.test(pm)
      && /off: \{ policy: \{ v: 1, selfLand: "off" \} \},/.test(pm)
      && /revoke: \{ policy: null \},/.test(pm)
      && rungs === 3 && revokes === 1
      && /post\(`\/api\/programs\/\$\{forPmId\}\/promotion`, PM_BODY\[act\]\)/.test(pm),
    `rungs=${rungs} revokes=${revokes}`);

  // (4) BUSY AND GENERATION, both — the busy flag alone still lets a late answer write into a pane
  // that has moved to another program; the generation alone still lets the owner fire twice.
  pin(`${RULE_PROMOTION_UI} — every button is disabled in flight AND a late answer is fenced by generation and id`,
    /qPmBusy = true;/.test(pm) && /b\.disabled = qPmBusy;/.test(pm)
      && /const seq = \+\+qPmSeq;/.test(pm) && /seq === qPmSeq && qPmFor === forPmId/.test(pm)
      && /qPmSeq\+\+;/.test(pm),
    `busy=${/b\.disabled = qPmBusy;/.test(pm)} seq=${/const seq = \+\+qPmSeq;/.test(pm)}`);

  // (5) CLEARED IN A FINALLY, ONCE. The failure this prevents is the one the promote door already
  // paid for: an exit before the tail leaves all four doors disabled forever, recoverable only by
  // selecting another program. `mine()` still fences the write — a flag set by a NEWER run is that
  // run's, and an orphan must not enable a door that is in flight.
  const pmRunFn = pm.match(/const pmRun = async[\s\S]*?\n    \};/)?.[0] ?? "";
  const pmFinallyAt = pmRunFn.indexOf("} finally {");
  const pmClearAt = pmRunFn.indexOf("qPmBusy = false;");
  pin(`${RULE_PROMOTION_UI} — the busy flag is cleared in a finally, on every exit, and nowhere else in the run`,
    pmRunFn !== "" && /\n      try \{/.test(pmRunFn) && pmFinallyAt > 0 && pmClearAt > pmFinallyAt
      && pmRunFn.split("qPmBusy = false;").length - 1 === 1
      && /if \(mine\(\)\) \{\s*\n\s*qPmBusy = false; qPmAct = null;/.test(pmRunFn),
    pmRunFn === "" ? "the promotion run function was not found" : `finally=${pmFinallyAt} clear=${pmClearAt}`);

  // (6) A REJECTED REQUEST IS AN OUTCOME, NOT AN ESCAPE. `post` → `api` → `fetch`, and a fetch that
  // rejects (offline, a dropped link, the server restarting under the click — the board is read
  // from a phone) would walk out of pmRun and out of the `void pmRun(...)` in the onclick as an
  // unhandled rejection, leaving four dead doors and a pane that says nothing. Caught AT the call.
  const pmPostsInBlock = [...pm.matchAll(/post\(`[^`]*`, PM_BODY\[act\]\)(\.catch\()?/g)];
  const pmUnguarded = pmPostsInBlock.filter((m) => !m[1]).length;
  pin(`${RULE_PROMOTION_UI} — a request that rejects is caught at its call and becomes a sentence, never an escaping rejection`,
    pmPostsInBlock.length === 1 && pmUnguarded === 0
      && /\.catch\(\(\) => null\)/.test(pmRunFn)
      && /if \(!r\) \{ err = pmNoAnswer\(act\); moved = true; \}/.test(pmRunFn),
    `posts=${pmPostsInBlock.length} unguarded=${pmUnguarded}`);

  // (7) VERBATIM, AND NEVER A TOAST. The server's refusals here name which key was not read and
  // which rung is not in the closed set — the half a paraphrase drops is exactly the half that says
  // what to send instead. And an unanswered request HAS no status, so it borrows none and counts as
  // moved-UNKNOWN: the facts are re-read rather than a stale permission repainted.
  const pmNoAnswerFn = pm.match(/const pmNoAnswer = [\s\S]*?;\n/)?.[0] ?? "";
  pin(`${RULE_PROMOTION_UI} — a refusal renders the server's own status and sentence in the pane, and an unanswered request invents no status`,
    /\$\{act\} failed — \$\{r\.status\}: \$\{j\.error\}/.test(pm)
      && /no readable reason/.test(pm)
      && /pkdwarn", qPmErr/.test(pm) && !/toast\(|alert\(|window\.confirm/.test(pm)
      && pmNoAnswerFn !== "" && !/r\.status/.test(pmNoAnswerFn) && /\$\{act\}/.test(pmNoAnswerFn)
      && /if \(moved\) await loadPrograms\(true\);/.test(pm),
    pmNoAnswerFn === "" ? "the unanswered-request sentence was not found" : `${pmNoAnswerFn.trim().length} chars`);

  // (8) NOTHING AUTO-SUBMITS. A permission that arrives by default is one nobody granted, so the
  // only path to the POST is a click: `pmRun` appears exactly twice in the section — its own
  // definition and the onclick that calls it — and no render path reaches it.
  // `pmRun` is DECLARED as `const pmRun = async (act…` — no parenthesis after the name — so every
  // `pmRun(` in the section is a CALL. Exactly one, and it is the click handler.
  const pmRunCalls = pm.split("pmRun(").length - 1;
  const onclicks = pm.split("b.onclick = () => { void pmRun(act); };").length - 1;
  pin(`${RULE_PROMOTION_UI} — no act fires on a render: the only call site of the run is a click handler`,
    pmRunCalls === 1 && onclicks === 1 && !/pmRun\("/.test(pm),
    `calls=${pmRunCalls} onclick=${onclicks}`);

  // (9) THE DISPLAY FUNCTION IS PURE AND TOP-LEVEL, which is what lets e2e/programs.ts cut it out
  // and RUN it over all five states. A DOM reference or a clock inside it would make that probe
  // impossible and would also let the pane date the owner's act for them: the stamp is the
  // SERVER's confirmedAt through fmtTs and nothing else.
  const psAt = client.indexOf("\nfunction promotionState(p: ProgramInfo)");
  const ps = psAt < 0 ? "" : client.slice(psAt, client.indexOf("\n}\n", psAt) + 3);
  const states = ["absent", "off", "green-only", "guarded", "unreadable"];
  pin(`${RULE_PROMOTION_UI} — promotionState is top-level, DOM-free and clock-free, and names all five displayed states`,
    ps !== "" && !/document|\bel\(|chip\(|Date\.now\(|new Date\(/.test(ps)
      && states.every((st) => ps.includes(`state: "${st}"`))
      && /const stamped = fmtTs\(rec\.confirmedAt\);/.test(ps)
      && ps.split("stamped: null").length - 1 === 2,
    ps === "" ? "promotionState not found in src/client.ts" : `${ps.split("\n").length} lines`);

  // (10) ABSENT AND OFF MUST NOT READ ALIKE. The server keeps them apart on purpose — "the owner
  // never said" vs "the owner said no" — and a pane that collapsed them would make a revocation
  // look like a program nobody ever reached. Readability follows the SERVER's own loader rule, so
  // a record the running server treats as absent is never displayed here as a live permission.
  pin(`${RULE_PROMOTION_UI} — absent and off carry different labels, and readability follows the server's own v1 rule`,
    /label: "self-land: never granted"/.test(ps) && /label: "self-land: off"/.test(ps)
      && /label: "self-land: unreadable record"/.test(ps)
      && /rec\.v !== 1/.test(ps) && /!PROMOTION_RUNGS\.includes\(rec\.selfLand\)/.test(ps)
      && /!Number\.isFinite\(rec\.confirmedAt\) \|\| rec\.confirmedAt <= 0/.test(ps),
    `absent=${/label: "self-land: never granted"/.test(ps)} off=${/label: "self-land: off"/.test(ps)}`);
}

console.log(rows.join("\n"));
console.log(failed ? `\n${failed} FAILURES` : "\nALL PASS");
process.exit(failed ? 1 : 0);
