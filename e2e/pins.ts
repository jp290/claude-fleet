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
function pin(name: string, ok: boolean, detail = ""): void {
  rows.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
}

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
  // FLEET_CLEAN_REVIEW is three-valued and every unrecognised spelling falls through to "off".
  // A typo here does not fail — it silently disables the reviewer, which is why it is pinned to the
  // server's OWN parse expressions rather than to a list of words written down twice.
  const val = /FLEET_CLEAN_REVIEW=(\S+)/.exec(spawnLine)?.[1] ?? "";
  const shadowRe = /\/\^shadow\$\/i\.test/.test(server);
  const gateSrc = /\/\^\((1\|true\|on\|yes)\)\$\/i\.test\(process\.env\.FLEET_CLEAN_REVIEW/.exec(server);
  pin("server.ts's FLEET_CLEAN_REVIEW parse expressions are where this pin expects them",
    shadowRe && !!gateSrc, `shadow=${shadowRe} gate=${!!gateSrc}`);
  const recognised = /^shadow$/i.test(val) || (gateSrc ? new RegExp(`^(${gateSrc[1]})$`, "i").test(val) : false);
  pin("watchdog.sh's FLEET_CLEAN_REVIEW value is one server.ts recognises (a typo means silent off)",
    val === "" || recognised, `value=${val || "(unset)"}`);
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

console.log(rows.join("\n"));
console.log(failed ? `\n${failed} FAILURES` : "\nALL PASS");
process.exit(failed ? 1 : 0);
