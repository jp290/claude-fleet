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
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
import { HANDOFF_WARN_KB, splitHandoff } from "../handoff-rotate";
import { VERIFY_SKIP_EXIT as LAND_LOG_SKIP_EXIT, renderLandLog, verifyLabel, type MainCommit } from "../land-log";
import { SHARD_UNITS } from "./ctx";
// the pane-hint builders are IMPORTED and CALLED by the sigil rule at the end of this file: only a
// rendered hint shows the tail `${eventAck(id)}` actually contributes, which a source scan cannot.
import {
  attentionAnswerMessage, auditWatchMessage, clarificationReplyMessage, clarificationWatchMessage,
  fleetReportDecisionMessage,
  commandJobWatchMessage, deployWatchMessage, laneSuiteWatchMessage, laneWatchMessage, mergeWatchMessage,
  harnessBlockMessage, laneReviewMessage,
} from "../lane-signals";
// the allowlist is IMPORTED, never re-spelled: a pin that copied the list would pin its own copy
import { HELPER_CMD_ALLOW, HELPER_CMD_FORBIDDEN, helperCmdCheck } from "../server/types";
import { readEventLog, readLedger } from "../server/persist";
import { readJsonl } from "../briefstats";
import { CAPABILITY_FUNCTIONS, INSTANCE_URL_RE } from "../src/protocol";
// The Fleet manifest rules below run the SAME pure functions the delivery seams run — a pin that
// re-implemented the validator would only pin its own copy of the rules.
// the deploy-gap's path classifier is IMPORTED and RUN over this very tree: the whole finding it
// replaces was a hand-kept copy of the roles going stale, so a pin that re-spelled them would be
// the same defect one layer up.
import { buildRepoGraph, roleOf, type PathRole } from "../server/deploy-classify";
import { GATE_MACHINERY_FILES, isGateMachinery } from "../task-land-waves";
import { CONTEXT_PACKS, CONTEXT_PACK_TRIGGERS } from "../context-packs";
import { readContextManifest } from "../context-manifest";
import { validUseWhen, validateContextPacks } from "../context-pack-validator";
// the lane-permission hook is IMPORTED for its pure decision and SPAWNED for its stdin/exit contract —
// Claude Code runs the file, so only the file run proves what the session sees
import { HARNESS_BLOCK_ROUTE, WAITING_NOTIFICATIONS, decide as hookDecide } from "../.claude/hooks/lane-permission";

const ROOT = resolve(import.meta.dir, "..");
const read = (rel: string): string => readFileSync(`${ROOT}/${rel}`, "utf8");
const exists = (rel: string): boolean => { try { statSync(`${ROOT}/${rel}`); return true; } catch { return false; } };

// ================================================================================================
// UNIVERSES — a pin's subject is a MODULE SET, never one file name
// ================================================================================================
// The bug this exists to prevent has a name and a date: VACUUM-GREEN AFTER A SPLIT (Generalsanierung
// plan §Randbedingung 1). A pin of the shape "X occurs in server.ts and NOWHERE ELSE" reads exactly
// one file. Move the subject into `server/foo.ts` and the pin keeps passing — it has stopped
// measuring anything and says so with the same word it used when it did. That is the most expensive
// failure class in this repository, because it survives review: the row is green.
//
// So the searchable subject is a UNIVERSE: an ordered, DERIVED module set. `server.ts` plus
// `server/*.ts` when that directory exists; `src/*.ts` with the bundle entry first. Derived, never
// typed as a list — a list would need editing by the same commit that splits the file, which is the
// edit nobody remembers to make.
//
// `.text` is every module joined, which is what `includes`/`matchAll`/`split` want: a second
// promote door in a NEW client module fails the "and nowhere else" row instead of quietly existing.
// `span()` is the other half: an anchored body must not cross a module boundary, so it finds the
// anchor's OWN module and slices inside it. It returns null when either anchor is missing anywhere
// in the universe, and null is never a pass — every caller renders it as "anchor not found".
type UniverseFile = { file: string; text: string };
type Span = { file: string; at: number; text: string };
interface Universe {
  readonly name: string;
  readonly files: readonly UniverseFile[];
  readonly text: string;
  span(from: string, to: string, tail?: number): Span | null;
  /** one module's own text — for the bodies whose head and tail anchors are different symbols */
  module(file: string): string;
}
function universe(name: string, rels: readonly string[]): Universe {
  const files: UniverseFile[] = rels.map((file) => ({ file, text: read(file) }));
  // `at` is an offset into the JOINED text, so the index arithmetic pins already do (is this match
  // inside that body?) keeps meaning what it meant when the universe was one file.
  const offsets: number[] = [];
  let acc = 0;
  for (const f of files) { offsets.push(acc); acc += f.text.length + 1; }
  const text = files.map((f) => f.text).join("\n");
  return {
    name, files, text,
    module(file: string): string { return files.find((f) => f.file === file)?.text ?? ""; },
    span(from: string, to: string, tail = 0): Span | null {
      for (let i = 0; i < files.length; i++) {
        const local = files[i]!.text.indexOf(from);
        if (local < 0) continue;
        const end = files[i]!.text.indexOf(to, local);
        if (end < 0) return null;   // the body's own terminator is missing: not a body, not a pass
        return { file: files[i]!.file, at: offsets[i]! + local, text: files[i]!.text.slice(local, end + tail) };
      }
      return null;
    },
  };
}
const isDir = (rel: string): boolean => { try { return statSync(`${ROOT}/${rel}`).isDirectory(); } catch { return false; } };
// server.ts stays the ENTRY name (plan §Randbedingung 2: stage sentinel, Dockerfile, watchdog.sh,
// state.sh pgrep all read it), so it leads; `server/` is where the split puts its modules.
const serverU = universe("server", ["server.ts",
  ...(isDir("server") ? readdirSync(`${ROOT}/server`).filter((f) => f.endsWith(".ts")).sort().map((f) => `server/${f}`) : [])]);
// the bundle entry leads, the rest alphabetically. `src/` is read as CLIENT everywhere in this repo
// (bundleStale, verify-proportion.ts#ruleFor, task-metadata.ts#processesForPath), so the whole
// directory is the universe — a program transition posted from src/share.ts is a finding, not an
// exemption.
const clientU = universe("client", (() => {
  const all = readdirSync(`${ROOT}/src`).filter((f) => f.endsWith(".ts")).sort();
  return ["client.ts", ...all.filter((f) => f !== "client.ts")].map((f) => `src/${f}`);
})());

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

// The universes must fail as THEMSELVES. An empty or one-sided module set makes every "and nowhere
// else" row below trivially true — the same green, measured over nothing.
pin("the server universe is derived and holds its entry module",
  serverU.files.length > 0 && serverU.files[0]!.file === "server.ts" && serverU.text.length > 0,
  `${serverU.files.length} module(s): [${serverU.files.map((f) => f.file).join(", ")}]`);
pin("the client universe is derived and holds its bundle entry",
  clientU.files.length > 0 && clientU.files[0]!.file === "src/client.ts" && clientU.text.length > 0,
  `${clientU.files.length} module(s): [${clientU.files.map((f) => f.file).join(", ")}]`);

// THE CROSS-MODULE SLICE TRIPWIRE, and it is the other half of `span()`. ~95 rows below still cut
// a server body with two bare indexOf calls — the shape that was correct while the universe was one
// file. After the split those two anchors can land in DIFFERENT modules, and a raw slice between
// them over the joined text returns everything in between: a body big enough that every `includes`
// against it is true. That is vacuum-green with extra steps.
//
// Converting all ~95 during a feature freeze would be a large blind edit; converting the ones a
// P4 slice actually moves is the right size, and this row is what tells that slice WHICH. It reads
// the anchor pairs out of this file's own source and fails only on a pair whose two anchors are in
// different modules — zero today, exactly the broken ones tomorrow. The plan's slice protocol asks
// step (c) to look for vacuum-green pins by hand; this makes that half mechanical.
{
  const RULE_SPAN = "no pin cuts a server body ACROSS two modules (a raw slice between anchors in different modules returns everything between them, and everything contains anything)";
  const pinsSrc = read("e2e/pins.ts");
  // regex literals, so the patterns carry no literal `server.slice(` and this file's own scan
  // cannot report itself. `LIT` is a double-quoted JS string with its escapes intact — JSON.parse
  // turns it back into the anchor the pin actually searches for.
  const STARTS = /const (\w+) = server\.indexOf\(("(?:[^"\\]|\\.)*")\)/g;
  const CUTS = /server\.slice\(\s*(?:server\.indexOf\(("(?:[^"\\]|\\.)*")\)|(\w+))\s*,\s*server\.indexOf\(("(?:[^"\\]|\\.)*")/g;
  const starts = new Map<string, string>();
  for (const m of pinsSrc.matchAll(STARTS)) starts.set(m[1]!, JSON.parse(m[2]!) as string);
  const pairs: { from: string; to: string }[] = [];
  for (const m of pinsSrc.matchAll(CUTS)) {
    const from = m[1] !== undefined ? JSON.parse(m[1]) as string : starts.get(m[2]!);
    if (from === undefined) continue;   // a computed offset, not an anchor pair — not this class
    pairs.push({ from, to: JSON.parse(m[3]!) as string });
  }
  const moduleOf = (needle: string): string | null =>
    serverU.files.find((f) => f.text.includes(needle))?.file ?? null;
  const crossing = pairs
    .map((x) => ({ ...x, a: moduleOf(x.from), b: moduleOf(x.to) }))
    .filter((x) => x.a !== null && x.b !== null && x.a !== x.b);
  pin(`${RULE_SPAN} — the anchor pairs are derived from this file's own source`,
    pairs.length > 0, `${pairs.length} anchored server body cut(s)`);
  pin(RULE_SPAN, pairs.length > 0 && crossing.length === 0,
    crossing.length > 0
      ? crossing.map((x) => `${JSON.stringify(x.from)} in ${x.a} → ${JSON.stringify(x.to)} in ${x.b}`).join("; ")
      : `${pairs.length} cut(s), each inside one module`);
}

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
    // The loopback spellings are listed TWICE on purpose, and only the second pair is reachable.
    // A bare `::`/`::1` never arrives here: `new URL("http://::1")` THROWS, so that spelling is
    // already counted as a malformed value below. What a configured IPv6 loopback actually becomes
    // is the bracketed form `new URL()` renders — `[::1]`, and every longer spelling normalises
    // into it (`[0:0:0:0:0:0:0:1]` -> `[::1]`). Listing only the bare pair left the reachable one
    // unfiltered, where the bracket rule below correctly reads it as a routable IP literal and
    // makes it a needle: a host configured on IPv6 loopback then searches the tree for `[::1]` and
    // goes red on tracked prose that merely SPELLS it (e2e/tasks.ts carries it as fixture data).
    // The bare pair stays because it is the spelling a reader looks for; the bracketed pair is the
    // one that does the work.
    const publicExamples = /^(?:localhost|0\.0\.0\.0|127\.0\.0\.1|::|::1|\[::\]|\[::1\]|100\.64\.0\.1)$/i;
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
    // A SINGLE-LABEL host is a LAN name, and a LAN name is not a deploy identity: it routes
    // nowhere outside this segment, so publishing it discloses nothing — while colliding with
    // ordinary vocabulary, because this repo NAMES its hosts by role in tracked prose on purpose
    // (`FLEET_INSTANCE` is "a role word, not a hostname" and stands in every /api/sessions answer).
    // Measured on the follower 2026-09-11: needle `second-host` hit 406 tracked lines — every one of
    // them the role word — while the actual secrets, the tailnet IP and both dotted names, hit
    // ZERO. A rule that cannot distinguish those two is not a leak check on such a host; it is a
    // permanent red on stage 1 of the land gate, which is where this rule runs. Excluded needles
    // are NAMED below rather than dropped in silence: a check may narrow what it looks at, never
    // hide that it narrowed.
    // ...but `new URL()` renders an IP LITERAL in its bracketed form, and that form carries no dot
    // either: `http://[2001:db8::1]` yields hostname `[2001:db8::1]`, and an IPv4-mapped address is
    // normalised into pure hex groups (`[::ffff:192.0.2.1]` -> `[::ffff:c000:201]`), so a bracketed
    // hostname NEVER contains one. Reading it as a LAN name would drop a globally routable address
    // out of the needle set while the skip() line above called it "not a deploy identity" — a
    // silent narrowing of a leak sensor, stated as a falsehood. Brackets decide before dots do.
    const ipLiteral = (host: string) => host.startsWith("[");
    const lanOnly = hosts.filter((host) => !ipLiteral(host) && !host.includes("."));
    const routable = hosts.filter((host) => ipLiteral(host) || host.includes("."));
    if (lanOnly.length > 0) {
      skip("leak-pin: single-label LAN names are not deploy identities",
        `not searched: [${lanOnly.join(", ")}]`);
    }
    const identities = [...new Set(routable.flatMap((host) => {
      const labels = host.split(".");
      const parent = !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) && labels.length >= 3
        ? labels.slice(1).join(".") : null;
      return parent && !reservedDomains.test(parent) ? [host, parent] : [host];
    }))];

    // Two different facts used to share one red. A malformed value means the configuration could
    // not be READ, and that stays a hard failure. An empty identity set after a clean read means
    // the opposite: every field parsed, and none of them names a routable host — reachable through
    // ordinary configuration, since FLEET_ALLOWED_HOSTS and FLEET_SHARE_HOSTS both default to "".
    // Reporting that as "identity source is probeable: false" denies a fact that HOLDS and sends
    // the reader hunting a broken .env. It is the unprobed case, and it says so under its own name.
    if (malformed.length > 0) {
      pin("leak-pin: identity source is probeable", false,
        `${configured.size} configured field(s), ${malformed.length} malformed value(s), ${identities.length} searchable host(s)`);
    } else if (identities.length === 0) {
      skip("leak-pin: no routable identity configured, unprobed",
        `${configured.size} configured field(s) read, 0 routable host(s) among them`);
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
// e2e-postland-audit.sh died the day continuity.ts landed and stayed dead for weeks; attic/steward-arena.sh
// shipped missing two of four modules. Both were hand-written `cp` lists of server.ts's local
// imports. e2e-stage.sh replaced every one of them with a derived closure. These two rules keep the
// class extinct rather than re-listing the seven scripts that currently obey it.

{
  // a `cp` naming a MODULE — ANY tracked .ts file in this tree, which is what the import closure
  // already stages. e2e-stage.sh's own copy loop passes a variable, which is the whole difference
  // between a derived closure and a list.
  //
  // THE SET IS THE WHOLE TREE, not root+src/ (W3, 2026-09-01). It was root+src/ until the server
  // split put modules under `server/` and the harness modules under `e2e/`: a `cp e2e/harness.ts`
  // or a `cp server/persist.ts` is exactly this bug and walked straight past a two-directory set.
  // Derived from git, so a new directory needs no edit here.
  //
  // THE ONE EXEMPTION, and it survives the widening on purpose: a fixture that NO entry imports
  // (drills/drill-3-clean-review.ts, copied by drills/drill-3.sh) is NOT this class — nothing
  // derives it, so a hand copy is the only way it can get there. Under root+src/ it was out of the
  // set by accident of its directory; over the whole tree it has to be named, or the widening
  // would fail the one honest hand-copy in the repo.
  const HAND_COPIED = new Set(["drill-3-clean-review.ts"]);
  const trackedTs = spawnSync("git", ["-C", ROOT, "ls-files", "-z", "--", "*.ts"],
    { encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" }, maxBuffer: 16 * 1024 * 1024 });
  const trackedPaths = trackedTs.status === 0
    ? trackedTs.stdout.split("\0").filter(Boolean) : [];
  // the derivation must fail as ITSELF. A `git ls-files` that could not run yields an empty set,
  // and an empty set makes every `cp` innocent — vacuum-green for the exact class this guards.
  pin("the module set for the copy guard is derived from tracked files, and the derivation ran",
    trackedTs.status === 0 && trackedPaths.length > 0,
    trackedTs.status === 0 ? `${trackedPaths.length} tracked .ts file(s)`
      : (trackedTs.error?.message || trackedTs.stderr || `git ls-files exited ${String(trackedTs.status)}`).trim().slice(0, 160));
  const modules = new Set(trackedPaths
    .map((f) => f.slice(f.lastIndexOf("/") + 1))
    .filter((b) => !HAND_COPIED.has(b)));
  const offenders: string[] = [];
  for (const f of shellScripts)
    for (const l of read(f).split("\n")) {
      if (!/(^|[;&|]|\s)cp\s/.test(l)) continue;
      for (const m of l.matchAll(/([A-Za-z0-9_.-]+\.ts)\b/g)) if (modules.has(m[1])) offenders.push(`${f}: ${m[1]}`);
    }
  pin("no shell script copies a module by name (staging is derived, never listed)",
    modules.size > 0 && offenders.length === 0,
    offenders.length ? offenders.join(", ") : `${modules.size} module name(s) guarded`);
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
  // drills/drill-3.sh and attic/steward-arena.sh stage an instance too and are deliberately out: a drill
  // is a hand-driven rig and the arena is a long-lived fixture — neither returns a pass/fail, so
  // "ends by propagating its exit code" would be a rule about something they never claimed to be.
  const stagers = shellScripts.filter((f) =>
    /^e2e-[a-z-]+\.sh$/.test(f) && /^\s*stage_instance\s+\S/m.test(read(f)));
  // Both halves read the CODE lines only. The runner half read the whole file until 2026-09-14
  // (Astra finding 5): `# eval "… bun fleet-e2e.ts"` — the runner commented out — still matched,
  // so the one mutation this rule exists for passed as long as it left a comment behind.
  const codeLines = (f: string) => read(f).split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const noRunner = stagers.filter((f) => !codeLines(f).some((l) => /\bbun\s+fleet-e2e[a-z-]*\.ts\b/.test(l)));
  const noExit = stagers.filter((f) => {
    const lines = codeLines(f);
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
// THE SERVER UNIVERSE, not the entry file. Every `server.includes(...)`, `matchAll` and `split`
// below now searches and counts across `server.ts` + `server/*.ts`, so an "and nowhere else" row
// keeps its meaning after the split instead of going vacuum-green on a moved subject.
const server = serverU.text;

{
  // THREE FleetEvent kinds carry no Watch, and the third joined them for a different reason than
  // the first two: a clarification and a fleet-report are ASKED for, while a `lane-suite` verdict
  // reaches a lane that COULD NOT have subscribed (/api/self/watch answers a lane 409). Keep both
  // directions of that persisted discriminant coupled: accepting null on any Watch-backed kind
  // loses provenance, while requiring a string on any of the three invents a Watch that does not
  // exist — and THAT direction is not hypothetical, it dropped both preview rows at every boot
  // until e2e/lane-suite.ts (LS.9) measured a restart.
  // CUT THROUGH THE UNIVERSE'S span(), not through two bare indexOf calls on the joined text:
  // once the parser lives in `server/persist.ts` and its terminator in the core, a raw slice
  // between them would hand this rule a body spanning half the server — and a body that big makes
  // every `includes` below true. `null` is the honest answer to a missing anchor, and it FAILS.
  const parserSpan = serverU.span("function fleetEventFrom(", "function clarificationFrom(");
  const mintSpan = serverU.span("async function openClarification(", "async function replyClarification(");
  const parser = parserSpan?.text ?? "";
  const mint = mintSpan?.text ?? "";
  const watchlessKinds = 'const watchless = e.kind === "clarification-request" || e.kind === "fleet-report"\n'
    + '    || e.kind === "lane-suite" || e.kind === "harness-block" || e.kind === "lane-review";';
  const watchlessEquivalence = parser.includes(watchlessKinds)
    && parser.includes('    || (watchless !== (e.watchId === null))\n'
      + "    || !(ownerReceiver || (Number.isInteger(e.receiverSlot)");
  const nullMints = (mint.match(/watchId: null/g) ?? []).length;
  const missingAnchor = [parserSpan === null ? "fleetEventFrom" : "", mintSpan === null ? "openClarification" : ""]
    .filter(Boolean);
  pin("FleetEvent watchId is null exactly for clarification-request, fleet-report, lane-suite, harness-block and lane-review, and a string for every Watch event",
    missingAnchor.length === 0
      && /watchId: string \| null/.test(server)
      && watchlessEquivalence
      && mint.includes("const event: ClarificationFleetEvent")
      && mint.includes("const event: FleetReportFleetEvent")
      && nullMints === 2
      // the third watchless mint lives in its own function and is counted there rather than
      // widened into `mint`'s span: one `watchId: null`, shared by both rows it can produce.
      && (serverU.span("async function mintLaneSuiteEvents(", "// THE OPEN RED PREVIEWS")?.text
        .match(/watchId: null/g) ?? []).length === 1
      // …and the fourth in openHarnessBlock, the one row a lane's hook mints for itself
      && (serverU.span("async function openHarnessBlock(", "async function openClarification(")?.text
        .match(/watchId: null/g) ?? []).length === 1
      // …and the fifth in fileLaneReview, the verdict a task row asked for (Task.review)
      && (serverU.span("async function fileLaneReview(", "// --- THE AUTOMATIC LANE CLOSE")?.text
        .match(/watchId: null/g) ?? []).length === 1
      && (server.match(/watchId: w\.id/g) ?? []).length >= 4,
    missingAnchor.length > 0
      ? `anchor not found in the server universe: ${missingAnchor.join(", ")}`
      : `equivalence=${watchlessEquivalence} nullMints=${nullMints} in=${parserSpan!.file}/${mintSpan!.file}`);

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
  // ONE verify-entry lookup, asked by both doors. The self-land route's step 7 decides whether a
  // repo can be measured at all and `verifyCmdFor` decides which command that is — if those two
  // resolve the map differently, a MAIN is refused for a repo the gate would happily have measured
  // (the 2026-08-29 linked-worktree miss, where the map carried the primary path and the checkout
  // reported the worktree's own toplevel). The pin is structural because the disagreement is: no
  // test of one door can see the other door's spelling.
  const region = /const verifyRepoKeyCache[\s\S]*?const verifyCmdFor = /.exec(server);
  const usages = [...server.matchAll(/VERIFY_CMD_REPOS\.(get|has)\(/g)].map((m) => m.index ?? -1);
  const outside = region === null ? usages
    : usages.filter((i) => i < (region.index ?? 0) || i >= (region.index ?? 0) + region[0].length);
  pin("server.ts reads VERIFY_CMD_REPOS in exactly one place — the shared entry resolver",
    region !== null && usages.length > 0 && outside.length === 0,
    region === null ? "no verifyRepoKeyCache…verifyCmdFor region" : `usages=${usages.length} outside=${outside.length}`);
  pin("the self-land door and the gate resolver both go through verifyEntryFor",
    /if \(!\(await verifyEntryFor\(lane\.worktree\.repo\)\)\)/.test(server)
      && /const verifyCmdFor = async \(repo: string\): Promise<string \| null> => \(await verifyEntryFor\(repo\)\)/.test(server),
    `step7=${/await verifyEntryFor\(lane\.worktree\.repo\)/.test(server)} resolver=${/verifyCmdFor = async/.test(server)}`);
  // …and the resolver must stay off the synchronous path: it is reached from a route, so its git
  // read is awaited, never spawned in-line the way repoRunsShortChain's existsSync can be.
  pin("the verify-entry resolver spawns no synchronous git",
    region !== null && !/spawnSync|execSync/.test(region[0]) && /await gitCommonDirOf\(/.test(region[0]),
    region === null ? "no region" : `sync=${/spawnSync|execSync/.test(region[0])}`);
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
  // `LC_ALL=C` is part of the probe, not decoration: `ps -o lstart=` is locale-formatted and
  // _st_valid_birth requires English month/day names. On the Debian/de_DE helper the unfenced
  // command yields "Di Sep  1 ..." (measured 2026-09-01), the validator rejects it, identityProven
  // stays null and the suite-lock family falls closed. A probe that cannot produce a valid reading
  // proves nothing, so the fence is pinned WITH the equality it feeds.
  // docs/messungen/second-host-baseline-2026-08-29.md §Plattform-Signatur.
  pin("suite-lock contender proves a live holder by pid AND process birth before waiting",
    stage.includes('$_st_birth_now" = "$_st_hb"') && stage.includes("LC_ALL=C ps -o lstart="),
    `birthEquality=${stage.includes('$_st_birth_now" = "$_st_hb"')} localeFencedProbe=${stage.includes("LC_ALL=C ps -o lstart=")}`);
  pin("suite-lock reaper re-checks pid AND process birth before removing a stale/recycled lock",
    stage.includes('$_st_cur_pid" = "$_st_hp"') && stage.includes('$_st_cur_birth" = "$_st_hb"'),
    "missing reap-time birth equality in e2e-stage.sh");

  // THE INHERITED HOLD (2026-09-04) is a must-pair across a shell script and a TypeScript file —
  // exactly the drift no compiler sees. server.ts's ff retry chain holds this mutex itself and
  // hands the name of its hold to the gate child; e2e-stage.sh is the only thing that reads it.
  // Rename either side and NOTHING breaks loudly: the retry rounds simply queue again for a lock
  // this very server is holding, and the wait the whole change exists to remove comes back silent.
  // The shell's three conditions are pinned WITH the variable, because the variable alone must
  // never be enough — a stale export that skipped the lock file would let a suite run unserialized.
  // The server half moved into server.ts#verifyChildEnv on 2026-09-05 (the gate child's env is
  // scrubbed of FLEET_* now, so this one has to be MINTED rather than left in place) — same name,
  // same must-pair, an assignment instead of an object-literal entry.
  pin("the inherited suite-mutex hold is one name on both sides, and the shell honours it only over a LIVE pid the lock file itself records",
    server.includes("env.FLEET_SUITE_LOCK_HELD_BY = String(heldSuiteLock)")
      && stage.includes('_st_held_by="${FLEET_SUITE_LOCK_HELD_BY:-}"')
      && stage.includes('kill -0 "$_st_held_by" 2>/dev/null')
      && stage.includes('"$(cat "$FLEET_SUITE_LOCK/pid" 2>/dev/null || true)" = "$_st_held_by"'),
    `server=${server.includes("env.FLEET_SUITE_LOCK_HELD_BY = String(heldSuiteLock)")} shellVar=${stage.includes('_st_held_by="${FLEET_SUITE_LOCK_HELD_BY:-}"')} alive=${stage.includes('kill -0 "$_st_held_by" 2>/dev/null')} onDisk=${stage.includes('"$(cat "$FLEET_SUITE_LOCK/pid" 2>/dev/null || true)" = "$_st_held_by"')}`);
  // THE HAND-DOWN GOES ONE LEVEL FURTHER UP (M1, 2026-09-06). Since the clean land path takes this
  // mutex IN THE SERVER before it spawns the gate, a test server that does not know it is running
  // inside its own wrapper's hold queues for a lock that wrapper owns for the whole run — every
  // clean land in that suite then dies `waitedOut` without ever looking at a tree. Measured, not
  // predicted: ./e2e-clean-review.sh hung at waitMerge for its full 60 s on 2026-09-06 the first
  // time the hold was pulled forward. So every wrapper that hands its server a FLEET_VERIFY_CMD
  // must tell it whose hold it is in — with `$_st_lock_pid`, the holder e2e-stage.sh RESOLVED, and
  // never the literal `$$` (2026-09-07): inside the live land gate the wrapper is itself an
  // inherited step and the lock file names the LIVE SERVER, so `$$` fails the server's "lock file
  // names this pid" check, the test server queues behind the outer hold, and every code land dies
  // at waitMerge after 60 s (measured on the first code land after M1 was deployed, slot 1,
  // 2026-09-07 04:24; reproduced under a simulated holder before and after the fix). Outside a
  // hold `_st_lock_pid` IS `$$`, so the standalone case is unchanged. A pair no compiler and no
  // single suite can see, because the wrapper that breaks it is the one whose own runner holds
  // the lock.
  {
    const wrappersWithGate = ["e2e-isolated.sh", "e2e-clean-review.sh", "e2e-postland-audit.sh"];
    const missing = wrappersWithGate.filter((w) => {
      const src = read(w);
      return src.includes("FLEET_VERIFY_CMD")
        && (!src.includes("FLEET_SUITE_LOCK_HELD_BY=$_st_lock_pid") || src.includes("FLEET_SUITE_LOCK_HELD_BY=$$"));
    });
    pin("every wrapper that configures a land gate for its server tells that server whose suite-mutex hold it is running inside — the holder e2e-stage.sh resolved ($_st_lock_pid), never the literal $$, so a test server never queues behind its own runner nor behind the live server's hold",
      missing.length === 0, `wrappers not handing $_st_lock_pid across (or still handing $$): ${missing.join(", ") || "(none)"}`);
    // …and the server half: the hold the clean path takes is the SAME primitive the retry chain
    // takes, asked for BEFORE the gate rather than between its rounds. Both call sites pinned, so
    // deleting the first one silently restores the queue this cut removed.
    const m1Take = server.includes("gateHeld = await gateRun(() => holdSuiteLock(VERIFY_WAIT_MS, holdOwner));");
    // `gateChildHold` since M5 (2026-09-07), not `gateHoldBy` — same hand-down, one filter in
    // front of it (the short chain is minted nothing; see the M5 rows below).
    const m1Hand = server.includes("runVerify(cwd, mainSha, firstVerifyPlan, gateChildHold, gateHeld ? gateWaitMs : 0)");
    const m1Retry = server.includes("let ffHeld = gateHoldBy !== null;");
    // and the machine goes back even when the process is killed rather than returned from: the
    // deploy ritual on this box IS a kill, and before M1 a leaked hold cost one retry — now it
    // would deny every land until an unrelated wrapper contended for the lock.
    const m1Signal = server.includes('for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"] as const)')
      && server.includes("process.on(sig, () => { releaseSuiteLock(); process.exit(0); });");
    pin("the clean land path asks for the suite mutex BEFORE the first gate, hands that hold to the gate, and gives it back on a signal as well as on every code path",
      m1Take && m1Hand && m1Retry && m1Signal,
      `take=${m1Take} handDown=${m1Hand} retryInherits=${m1Retry} signalRelease=${m1Signal}`);
    // …AND IT IS TAKEN IN FRONT OF THE PRE-PASS REBASE (owner brief, 2026-09-12). An ORDER, which
    // is exactly what no compiler and no single verdict can see: a take that slides back BEHIND
    // `tryScriptRebase` still compiles, still holds the machine for the gate, still releases — and
    // silently reopens the window in which another land of this server moves main under this
    // tree, which costs a full second gate chain (`ffRounds`, measured: 3 of this repo's 5 such
    // notes were this server racing itself). Held as the three facts that make the span one:
    //   · the take precedes the pre-pass rebase,
    //   · an in-process contender QUEUES on the same lock (`suiteLockOwner`) rather than being
    //     refused and running beside us — without this the order buys nothing,
    //   · and the hold is given back before an AGENT runs, because a resolver is not a suite.
    const preTake = server.indexOf("gateHeld = await gateRun(() => holdSuiteLock(VERIFY_WAIT_MS, holdOwner));");
    const preRebase = server.indexOf("const pre = await tryScriptRebase(cwd, main);");
    const preOwnerQueue = server.includes("if (suiteLockHeld && (owner === null || suiteLockOwner === owner)) return false;")
      && server.includes("const holdOwner: symbol = Symbol(`land:${s.id}:${branch}`);");
    const preAgentRelease = server.indexOf("if (gateHoldPid !== null && !(pre.clean && unreviewed.length === 0)) {");
    const preAuthor = server.indexOf("const authorGate = pre.clean ? \"clean\" : await wakeAuthor(");
    pin("the suite mutex is taken BEFORE the pre-pass rebase and held to the fast-forward, an in-process contender queues on it instead of running beside the holder, and it is handed back before any resolver agent runs",
      preTake > 0 && preRebase > preTake && preOwnerQueue
        && preAgentRelease > preRebase && preAuthor > preAgentRelease,
      `take=${preTake} rebase=${preRebase} ownerQueue=${preOwnerQueue} release=${preAgentRelease} authorGate=${preAuthor}`);
    // M2 (2026-09-07) — …AND A DENIAL IS ASKED AGAIN, A BOUNDED NUMBER OF TIMES. The bound is the
    // whole safety of it and it is one expression: the loop takes the hold, and leaves ONLY on a
    // grant or on the cap. Widen that condition and a land can queue forever holding a slot; drop
    // the `waitRounds++` and it spins on a machine it will never get. Neither shows up in a type,
    // and the arm that would catch it (a land that is denied twice) needs a busy machine to exist
    // at all — which is exactly the condition no unit test has. The cap's declaration is pinned
    // with it, because the way back out of this cut is `FLEET_LAND_WAIT_ROUNDS=0` and it has to
    // keep meaning byte-for-byte M1: one take, no round, no field, no sentence.
    // The third exit ("this server already holds the machine for another land") is GONE since
    // 2026-09-12: it was the line that let the second land run unserialized, and a contender of
    // this process now queues on the lock instead. So the loop leaves on a grant or on the cap,
    // and on nothing else — widen it again and a land can queue forever holding a slot.
    const m2Loop = server.includes("if (gateHeld || waitRounds >= LAND_WAIT_ROUNDS) break;")
      && !server.includes("const suiteLockHeldHere =") && !server.includes("|| suiteLockHeldHere()")
      && server.includes("mergeWaiting.set(s.id, { round: waitRounds, retryAt: Date.now() });");
    const m2Cap = /const LAND_WAIT_ROUNDS = Math\.min\(3, Math\.max\(0, Number\(process\.env\.FLEET_LAND_WAIT_ROUNDS \?\? 1\) \| 0\)\);/.test(server);
    // the counter-proof lives in the suite, exactly as the ff retry's `"0"` arm does
    const m2Zero = read("e2e/programs.ts").includes('FLEET_LAND_WAIT_ROUNDS: "0"');
    pin("a land denied the suite mutex goes back for it a BOUNDED number of rounds — the loop leaves on a grant or on FLEET_LAND_WAIT_ROUNDS (whose 0 is the way back to M1), and on nothing else",
      m2Loop && m2Cap && m2Zero, `loop=${m2Loop} cap=${m2Cap} zeroArm=${m2Zero}`);
    // M5 (2026-09-07) — THE SERVER REAPS NOW, AND ONLY THE THREE WAYS THE WRAPPER DOES.
    // Another pair with no compiler between its halves, and a nastier one than most: the shell's
    // reap and the server's reap must agree about WHICH lock dirs may be removed, and the state
    // they must both refuse — the pid-LESS dir, a human's manual park — is the one no suite will
    // ever produce on its own, so nothing but this row notices if the server starts eating it.
    // Held as the four decisions that make the mirror a mirror, each falsifiable alone; the
    // shell's own triage and its reap-time re-check are pinned in their own rows above, so a
    // divergence fails on whichever side moved.
    {
      const m5Fn = server.includes("function suiteLockReapStale(): boolean {");
      const m5Called = server.includes("const reaped = suiteLockReapStale();");
      // the park: a dir with a pid file is judged, a dir with NEITHER pid nor birth is not touched
      const m5Park = server.includes('reap = hb !== "";');
      // only a PROVEN birth mismatch is a recycled pid — missing/malformed/unmeasurable is kept
      const m5Unknown = server.includes("reap = PROCESS_BIRTH_RE.test(stored) && current !== null && current !== stored;");
      // and the window-narrowing the wrappers do, done here too
      const m5Recheck = server.includes('if (readSuiteLockFile("pid") !== hp || readSuiteLockFile("birth") !== hb) return false;');
      pin("the server reaps a dead suite-mutex holder itself, by the wrapper's own triage — a manual park (pid-less dir) is never touched, an unproven identity is kept, and the pid/birth VALUES are re-checked immediately before the rm",
        m5Fn && m5Called && m5Park && m5Unknown && m5Recheck,
        `fn=${m5Fn} calledFromHold=${m5Called} parkKept=${m5Park} unknownKept=${m5Unknown} recheck=${m5Recheck}`);
      // M5's other half: THE SHORT CHAIN DOES NOT TAKE THE MACHINE. Two sides again — the take is
      // skipped in server.ts, and the reason it is SAFE to skip is a property of the proportional
      // COMMAND itself: it sources no suite wrapper, so there is no staged step that could need a
      // hold handed down to it. Pinning the command keeps that argument mechanical rather than
      // remembered: the day someone puts an `e2e-*.sh` into the short chain, this row fails
      // instead of a docs-only land quietly running a suite beside somebody else's.
      const shortCmd = /const VERIFY_PROPORTIONAL_CMD = '([^']+)'/.exec(server)?.[1] ?? "";
      const m5Plan = server.includes("const gateProportional = firstVerifyPlan?.proportional === true;");
      // TWO HALVES since the take moved ahead of the rebase (2026-09-12), and both are needed: the
      // ENTRY plan keeps a docs-only land out of the queue in the first place (that queue is the
      // 710 s M5 measured), and the authoritative plan gives the hold BACK if it disagrees — a
      // chain with no staged step must never be parked on the machine, whichever plan noticed.
      const m5Skip = server.includes("if (gateInherited === null && entryPlan && !entryPlan.proportional && entryDirty === null) {")
        && server.includes("if (gateProportional && gateHoldPid !== null) {");
      const m5NoMint = server.includes("const gateChildHold = gateProportional ? null : gateHoldBy;");
      const m5CmdIsSuiteless = shortCmd !== "" && !/e2e-[a-z0-9-]*\.sh|e2e-stage/.test(shortCmd);
      pin("a docs-only land does not take the suite mutex at all: the short chain spawns no suite (its command names no wrapper), so the gate neither queues for the machine nor is minted a hold it has no staged step to inherit",
        m5Plan && m5Skip && m5NoMint && m5CmdIsSuiteless,
        `planFlag=${m5Plan} takeSkipped=${m5Skip} noMint=${m5NoMint} cmdSuiteless=${m5CmdIsSuiteless} cmd=${JSON.stringify(shortCmd)}`);
    }
    // THE SERVER NAMES ITSELF AS THE HOLDER (2026-09-14). A lane read /tmp/fleet-e2e.lock/pid,
    // killed that pid, and it was the live server holding the machine for a land (watchdog restart
    // 00:48:05, land 1aaf7eb8 interrupted). A pid file cannot say WHAT holds it, so the server
    // writes `held-by-fleet-server` beside it and e2e-stage.sh turns that into a wait line that
    // says "never kill this pid". Four facts, each falsifiable alone, all invisible to a compiler:
    //   · the marker is written BEFORE the hold is believed (`suiteLockHeld = true`), after pid/birth;
    //   · release removes it, and the land job's `finally` is what calls release;
    //   · every reaper that rmdirs this lock removes it too, or a non-empty dir reads as a PARK;
    //   · the shell reads it over a live pid and prints the phrase verbatim.
    {
      const body = (head: string): string => {
        const at = server.indexOf(head);
        return at < 0 ? "" : server.slice(at, server.indexOf("\n}\n", at));
      };
      const markerWrite = "writeFileSync(`${SUITE_LOCK}/${SUITE_LOCK_SERVER_MARKER}`, `${process.pid}\\n`, { mode: 0o600 });";
      const markerRm = "rmSync(`${SUITE_LOCK}/${SUITE_LOCK_SERVER_MARKER}`, { force: true });";
      const named = server.includes('const SUITE_LOCK_SERVER_MARKER = "held-by-fleet-server";');
      const take = body("function suiteLockTryTake(");
      const tBirth = take.indexOf("writeFileSync(`${SUITE_LOCK}/birth`");
      const tMarker = take.indexOf(markerWrite);
      const tHeld = take.indexOf("suiteLockHeld = true;");
      const writtenBeforeHold = tBirth > 0 && tMarker > tBirth && tHeld > tMarker;
      const release = body("function releaseSuiteLock(");
      const removedOnRelease = release.includes(markerRm)
        && release.indexOf(markerRm) < release.indexOf("rmSync(`${SUITE_LOCK}/pid`");
      const finalRelease = server.indexOf("    if (gateHoldPid !== null) releaseSuiteLock(holdOwner);");
      const finallyAt = finalRelease > 0 ? server.lastIndexOf("  } finally {", finalRelease) : -1;
      const releaseInFinally = finallyAt > 0 && finalRelease - finallyAt < 1500
        && !/\n  \} (catch|finally)/.test(server.slice(finallyAt + 1, finalRelease));
      const serverReap = body("function suiteLockReapStale(").includes(markerRm);
      const shellReads = stage.includes('_st_srv=$(cat "$FLEET_SUITE_LOCK/held-by-fleet-server" 2>/dev/null || true)')
        && stage.includes('if [ "$_st_srv" = "$_st_hp" ]; then');
      const shellSays = stage.includes('_st_srv_say="held by the fleet server itself — never kill this pid $_st_hp;')
        && (stage.match(/_st_why="\$\{_st_srv_say\}/g) ?? []).length === 4;
      const shellReap = stage.includes('rm -f "$FLEET_SUITE_LOCK/held-by-fleet-server" "$FLEET_SUITE_LOCK/pid" "$FLEET_SUITE_LOCK/birth" && rmdir "$FLEET_SUITE_LOCK"');
      const ctlReap = read("ctl.sh").includes('fs.rmSync(LOCK + "/held-by-fleet-server", { force: true }); fs.rmSync(LOCK + "/pid", { force: true });');
      pin("the fleet server marks its own suite-mutex hold (held-by-fleet-server) before it believes it holds, removes the marker on the release its land's finally runs, every reaper removes it with pid/birth, and e2e-stage.sh names such a holder verbatim: \"held by the fleet server itself — never kill this pid\"",
        named && writtenBeforeHold && removedOnRelease && releaseInFinally && serverReap && shellReads && shellSays && shellReap && ctlReap,
        `named=${named} writtenBeforeHold=${writtenBeforeHold} removedOnRelease=${removedOnRelease} releaseInFinally=${releaseInFinally} serverReap=${serverReap} shellReads=${shellReads} shellSays=${shellSays} shellReap=${shellReap} ctlReap=${ctlReap}`);
    }
  }
  // THE FIFO SEAM (2026-09-05). The mutex used to be a race: `sleep 15` + retry `mkdir`, no order,
  // so waiting longer bought nothing — measured, slot 7's post-land audit waited 2h45m and lost
  // three races to younger contenders. The fix is one ticket per contender, and it is exactly the
  // kind of seam this file exists for: nothing in TypeScript can see it, and if it comes undone the
  // suite still runs and still serializes — it just quietly goes back to starving whoever waits
  // longest, on a machine where the starved contender is often a LAND gate.
  // Held as the three properties that make it a queue, each falsifiable on its own:
  {
    const lines = stage.split("\n");
    const lockAcquire = lines.findIndex((l) => /mkdir "\$FLEET_SUITE_LOCK"/.test(l));
    const ticketTake = lines.findIndex((l) => /mkdir "\$FLEET_SUITE_QUEUE\/t\$_st_myn\.\$\$"/.test(l));
    // (1) the lock is taken by the FRONT ONLY. This is the whole mechanism: without the guard every
    //     contender races for `mkdir` again and the tickets become decoration.
    const lockAttempts = lines.filter((l) => /mkdir "\$FLEET_SUITE_LOCK"/.test(l));
    pin("only the front of the ticket queue attempts the suite mutex",
      lockAttempts.length === 1 && /\[ "\$_st_pos" -eq 1 \] && mkdir "\$FLEET_SUITE_LOCK"/.test(lockAttempts[0] ?? ""),
      `${lockAttempts.length} mkdir site(s): ${JSON.stringify(lockAttempts.map((l) => l.trim()))}`);
    // (2) the ticket is taken at ARRIVAL — before the WAIT LOOP is even entered, not merely before
    //     the mkdir inside it. A ticket drawn after a failed attempt would record the order in which
    //     contenders LOSE, not the order in which they arrived. Anchored on the loop head rather
    //     than on the lock's own line, because the loop ALSO re-stakes a ticket a /tmp sweeper
    //     removed, and that second site would satisfy a naive "before the lock" ordering.
    const loopHead = lines.findIndex((l) => /^while :; do$/.test(l));
    pin("the queue ticket is taken before the wait loop is entered, so arrival order is arrival order",
      ticketTake >= 0 && loopHead >= 0 && lockAcquire > loopHead && ticketTake < loopHead,
      `ticket@${ticketTake} loop@${loopHead} lock@${lockAcquire}`);
    // (3) a dead contender's ticket blocks nobody — the lock's own orphan rule, applied to the
    //     queue. Without it the fairness queue starves harder than the race it replaced.
    pin("an orphaned ticket is reaped: a contender's place dies with its process",
      /kill -0 "\$_st_tp"/.test(stage) && /rmdir "\$_st_tk"/.test(stage),
      `liveness=${/kill -0 "\$_st_tp"/.test(stage)} reap=${/rmdir "\$_st_tk"/.test(stage)}`);
    // and the wait line carries the POSITION next to the elapsed seconds. Seconds alone cannot say
    // whether waiting longer is worth anything, which is what a later wrapper-budget cut needs.
    const waitLine = lines.find((l) => /printf '\[suite-lock\] %s waiting/.test(l)) ?? "";
    pin("the wait line names the contender's own position, not just its elapsed seconds",
      /"\$_st_where"/.test(waitLine) && /_st_where="position \$_st_pos of \$_st_qn"/.test(stage),
      JSON.stringify(waitLine.trim()));
    // the queue path is DERIVED from the lock path: a probe pointed at a private lock must not
    // order itself against the machine's real waiters (e2e/verify-queue.ts §2c depends on this).
    pin("the ticket queue is derived from the lock path, never configured apart from it",
      /^FLEET_SUITE_QUEUE="\$FLEET_SUITE_LOCK\.q"$/m.test(stage), "FLEET_SUITE_QUEUE is not derived from FLEET_SUITE_LOCK");
    // the poll cadence stays 15s by default. The knob exists so §2c can drive a handover in seconds;
    // a changed DEFAULT would silently re-time every wrapper's wait on the live box.
    pin("the suite-mutex poll cadence still defaults to 15s",
      /^FLEET_SUITE_POLL_SEC="\$\{FLEET_SUITE_POLL_SEC:-15\}"$/m.test(stage), "default poll cadence changed");
    // AND THE FOURTH PROPERTY, where the two 2026-09 changes meet: an INHERITED step must never be
    // enqueued. It is already running inside somebody's hold, so a ticket would put it in line
    // behind the very lock it holds — a deadlock, and a silent one. The guard is structural rather
    // than a condition of its own: the ticket lives INSIDE `if [ "$_st_inherited" = 0 ]`, so the
    // inherited path cannot reach it. Pinned as that containment, because a later edit that lifts
    // the ticket out of the guard would look harmless and wedge every ff retry round.
    const guardOpen = lines.findIndex((l) => /^if \[ "\$_st_inherited" = 0 \]; then$/.test(l));
    // the guard's OWN `fi`, not the first one: the birth refusal inside it closes at column 0 too.
    // Anchored on the shared acquire printf, which is the first statement after the guard closes.
    const acquireAt = lines.findIndex((l) => /printf '\[suite-lock\] %s acquired after/.test(l));
    const guardClose = acquireAt < 0 ? -1
      : lines.reduce((acc, l, i) => (i > guardOpen && i < acquireAt && /^fi$/.test(l) ? i : acc), -1);
    pin("an inherited hold is never enqueued: ticket, wait loop and lock all live inside the _st_inherited guard",
      guardOpen >= 0 && guardClose > guardOpen && ticketTake > guardOpen && lockAcquire < guardClose,
      `guard=${guardOpen}..${guardClose} ticket@${ticketTake} lock@${lockAcquire}`);
  }

  // AND THE SAME FENCE EVERYWHERE A BIRTH IS READ, as a rule over a derived set rather than as
  // four remembered file names: every `lstart=` reader — in the shell scripts, in the e2e modules
  // AND in server.ts — must carry LC_ALL at its call site. Four sites today
  // (e2e-stage.sh#_st_birth_of, e2e/verify-queue.ts#processBirthOf, state.sh's LIVE line,
  // server.ts#processBirthFingerprint); a fifth added tomorrow without the fence is caught here
  // instead of on a foreign host nine minutes after a land.
  //
  // server.ts JOINED THE SET on 2026-09-02, and that is the whole point of the widening: it was
  // the one reader left unfenced, so on the de_DE second-host the shell validator accepted a birth
  // the server's own probe still read as null — birth.state `unmeasurable`, and six checks of the
  // lock-identity family (e2e/verify-queue.ts §2 held/overdue/PID+birth/recycled-PID,
  // e2e/steward-outcomes.ts's gate fact) fell CLOSED on every remote audit. Deterministic, and it
  // read like a regress. Set the fence, and the class is shut for both halves at once.
  {
    const RULE_LOCALE = "every reader of `ps -o lstart=` fences the locale (a localised birth reads as NO identity, not as a mismatch)";
    const WINDOW = 3;
    // an INVOCATION, not a mention: `ps ... lstart=` in a shell line, or "lstart=" as an argv
    // element in a spawn call. Comment lines are out, and so is this file — a linter that quotes
    // the strings it pins would otherwise report itself as the offender it is looking for.
    const INVOKES = /(?:(?:^|[^A-Za-z_])ps[^A-Za-z_][^\n]*lstart=)|(?:"lstart=")/;
    const readers: { where: string; fenced: boolean }[] = [];
    const corpus = ["server.ts", ...shellScripts, ...readdirSync(`${ROOT}/e2e`).filter((x) => x.endsWith(".ts")).map((x) => `e2e/${x}`)]
      .filter((f) => f !== "e2e/pins.ts");
    for (const f of corpus) {
      const lines = read(f).split("\n");
      lines.forEach((l, i) => {
        if (/^\s*(#|\/\/|\*)/.test(l) || !INVOKES.test(l)) return;
        const near = lines.slice(Math.max(0, i - WINDOW), i + WINDOW + 1).join("\n");
        readers.push({ where: `${f}:${i + 1}`, fenced: /LC_ALL/.test(near) });
      });
    }
    const unfenced = readers.filter((r) => !r.fenced).map((r) => r.where);
    // the derivation fails as itself: no readers found means the scan, not the tree, changed
    pin(`${RULE_LOCALE} — the reader set is derived and not empty`,
      readers.length > 0, `${readers.length} lstart reader(s)`);
    pin(RULE_LOCALE, readers.length > 0 && unfenced.length === 0,
      unfenced.length ? `unfenced=[${unfenced.join(", ")}]` : `${readers.length} reader(s) fenced`);
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
  // src/helper.ts (the remote helper portal's page script, 2026-08-26) is an ENTRY too — nothing
  // imports it, so unlike src/md.ts it gets no coverage by being reached from client.ts.
  //
  // A HAND-KEPT ENTRY LIST WAS STILL A SNAPSHOT (Astra finding 4, 2026-09-14): it named server.ts,
  // three browser entries and the fleet-e2e-*.ts harnesses, and so it went green while src/hub.ts
  // (built into public/hub.js by `bun run build`) and six tool scripts reached no compiler at all.
  // The rule is now over the TREE: every .ts git knows of (tracked, or new and not ignored — a lane
  // sees its fresh file go red before it commits it) is either reached from the tsc list through
  // imports, or named in TSC_EXEMPT with its reason. Reachability uses Bun's own import scanner,
  // which drops type-only imports: that can only UNDER-count coverage (a false red, fixed by listing
  // the file), never claim a file tsc does not see. Measured equal to `tsc --listFilesOnly` on the
  // tree it replaced: the same seven files missing from both.
  const TSC_EXEMPT = new Map<string, string>([]);
  const tscArgs = /--types bun ([^&]+?)(?:&&|$)/.exec(verifyCmd)?.[1]?.trim().split(/\s+/) ?? [];
  const lsTs = spawnSync("git", ["-C", ROOT, "ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "*.ts"],
    { encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" }, maxBuffer: 16 * 1024 * 1024 });
  const treeTs = lsTs.status === 0 ? [...new Set(lsTs.stdout.split("\0").filter((f) => f && exists(f)))] : [];
  const scanner = new Bun.Transpiler({ loader: "ts" });
  const unscannable: string[] = [];
  const reached = new Set<string>();
  const queue = tscArgs.filter((f) => exists(f));
  while (queue.length > 0) {
    const f = queue.pop()!;
    if (reached.has(f)) continue;
    reached.add(f);
    let found: { path: string; kind: string }[] = [];
    try { found = scanner.scanImports(read(f).replace(/^#!.*/, "")); } catch { unscannable.push(f); }
    for (const imp of found) {
      if (imp.kind === "require-call" || !imp.path.startsWith(".")) continue;
      const base = resolve(ROOT, f, "..", imp.path).slice(ROOT.length + 1);
      const hit = [base, `${base}.ts`, base.replace(/\.js$/, ".ts"), `${base}/index.ts`]
        .find((c) => c.endsWith(".ts") && exists(c) && statSync(`${ROOT}/${c}`).isFile());
      if (hit !== undefined && !reached.has(hit)) queue.push(hit);
    }
  }
  // a derivation that could not run must fail as ITSELF: an empty tree has nothing uncovered
  pin("the tree's .ts set for the type-gate coverage rule is derived from git, and the derivation ran",
    lsTs.status === 0 && treeTs.length > 0 && unscannable.length === 0,
    lsTs.status === 0 ? `${treeTs.length} .ts file(s), unscannable=[${unscannable}]`
      : (lsTs.error?.message || lsTs.stderr || `git ls-files exited ${String(lsTs.status)}`).trim().slice(0, 160));
  const uncovered = treeTs.filter((f) => !reached.has(f) && !TSC_EXEMPT.has(f)).sort();
  const staleExempt = [...TSC_EXEMPT.keys()].filter((f) => !treeTs.includes(f) || reached.has(f));
  pin("every .ts in the tree reaches watchdog.sh's tsc list through imports, or is exempt by name with a reason",
    tscArgs.length > 0 && uncovered.length === 0 && staleExempt.length === 0,
    `${tscArgs.length} listed, ${reached.size} reached, ${TSC_EXEMPT.size} exempt; uncovered=[${uncovered}] stale-exempt=[${staleExempt}]`);
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

  // THE SECOND BOOT PATH, held to the first. macOS starts watchdog.sh through
  // launchd-example.plist; Linux starts THE SAME script through fleet-watchdog.service. Because
  // both only start the script, VERIFY_CMD and AUDIT_CMD are defined once and inherited twice —
  // that is what makes gate drift between the two boot paths impossible rather than unlikely, and
  // these rows are what keeps it so. The unit may DESCRIBE the chain (its PATH is the whole reason
  // the chain can run at all on a host whose systemd default PATH has neither bun nor claude) and
  // may never DEFINE one. So: the described order is held against VERIFY_CMD's own, a rival
  // command definition is a failure, and the PATH is derived from watchdog.sh rather than copied.
  const UNIT = "fleet-watchdog.service";
  const RULE_UNIT = "the systemd boot path describes watchdog.sh's chain in watchdog.sh's order";
  const unit = ((): string | null => { try { return read(UNIT); } catch { return null; } })();
  // the probe fails as ITSELF: "no template" and "the template disagrees with the gate" are
  // different answers, and a missing file rendered as a chain mismatch would send its reader to
  // the wrong file.
  if (unit === null) pin(`${RULE_UNIT} — PROBE: the template is readable`, false, `${UNIT} not found at the repo root`);
  else {
    const unitChain = stepsOf(unit).join(">");
    const gateChainHere = stepsOf(verifyCmd).join(">");
    pin(RULE_UNIT, unitChain.length > 0 && unitChain === gateChainHere,
      `unit=[${unitChain}] gate=[${gateChainHere}]`);

    // AUDIT_CMD is the other half of the contract this template claims to carry, and it is the
    // half a reader of the unit cannot see anywhere else: tier 2 runs AFTER the land, so a host
    // whose PATH cannot reach it produces `unknown` — a non-measurement that is silent by design.
    const auditSuites = [...auditCmd.matchAll(/\.\/(e2e-[a-z-]+\.sh)/g)].map((m) => m[1]);
    const unnamedAudit = auditSuites.filter((f) => !unit.includes(f));
    const rival = ["VERIFY_CMD=", "AUDIT_CMD="].filter((k) => unit.includes(k));
    const runsScript = /^ExecStart=\S*\/sh\s+\S*watchdog\.sh\s*$/m.test(unit);
    pin("the systemd unit starts watchdog.sh itself, names its audit tier and defines no gate of its own",
      auditSuites.length > 0 && unnamedAudit.length === 0 && rival.length === 0 && runsScript,
      `execstart=${runsScript} audit=[${auditSuites}] unnamed=[${unnamedAudit}] rival=[${rival}]`);

    // THE PFLICHTZEILE. watchdog.sh PREPENDS to the PATH it is handed, and its own additions are
    // the macOS ones — so on Linux the inherited half is the only half that can carry bun and
    // claude, and a service that takes systemd's default has neither. Derived from watchdog.sh's
    // own export, never a copied list: the $HOME-relative entries are exactly the ones no
    // distribution ships, and they are the two this machine has already paid for twice.
    const watchdogPath = /^export PATH="([^"]*)"/m.exec(watchdog)?.[1] ?? "";
    const homeEntries = watchdogPath.split(":").filter((e) => e.startsWith("$HOME/"))
      .map((e) => e.replace("$HOME", ""));
    const unitPath = unit.split("\n").find((l) => l.startsWith("Environment=PATH=")) ?? "";
    const unreachable = homeEntries.filter((e) => !unitPath.includes(e));
    pin("the systemd unit sets PATH explicitly and reaches every home-relative tool watchdog.sh names",
      homeEntries.length > 0 && unitPath !== "" && unreachable.length === 0,
      `watchdog=[${homeEntries}] unit line ${unitPath === "" ? "MISSING" : "present"}, unreachable=[${unreachable}]`);
  }

  // THE FOLLOWER'S TRANSPORT, whose two halves are a POSIX shell script and a systemd unit — no
  // compiler is ever going to look at either. fleet-sync.sh answers in exit codes and nothing else:
  // the timer's whole semantics is "anything but 0 leaves the unit failed", so the unit's comment is
  // the only place a human reads what a code MEANS, and a code the unit does not know about is a
  // failure nobody can name. Three sides, because two would let prose agree with prose: what the
  // script CAN exit with, what its own header table promises, and what the unit lists.
  const SYNC = "fleet-sync.sh";
  const SYNC_UNIT = "fleet-sync.service";
  const RULE_SYNC = "fleet-sync's real exits, its header table and the unit's list are one set";
  const syncSrc = ((): string | null => { try { return read(SYNC); } catch { return null; } })();
  const syncUnit = ((): string | null => { try { return read(SYNC_UNIT); } catch { return null; } })();
  // the probe fails as ITSELF (the rule at the head of this file): "no file" and "the two disagree"
  // send their reader to different places.
  if (syncSrc === null || syncUnit === null)
    pin(`${RULE_SYNC} — PROBE: both halves are readable`, false,
      `${SYNC}=${syncSrc === null ? "MISSING" : "ok"} ${SYNC_UNIT}=${syncUnit === null ? "MISSING" : "ok"}`);
  else {
    // a `·`-separated table written across comment lines: fold the continuations away, then take
    // each item's leading number. Same shape on both sides, so one reader serves both.
    const codesIn = (table: string): string[] =>
      [...new Set(table.replace(/\n#/g, " ").split("·")
        .map((item) => /^\s*(\d+)\b/.exec(item)?.[1] ?? "")
        .filter((c) => c !== ""))].sort();
    const declared = codesIn(/# Exit codes:([\s\S]*?)Every non-zero/.exec(syncSrc)?.[1] ?? "");
    const unitCodes = codesIn(/answers in [a-z]+\n# exits \(([^)]*)\)/.exec(syncUnit)?.[1] ?? "");
    // what the script can ACTUALLY do — comment lines dropped first, so the table above is not
    // read back as its own evidence.
    const real = [...new Set([...syncSrc.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n")
      .matchAll(/\bexit (\d+)/g)].map((m) => m[1]))].sort();
    pin(RULE_SYNC,
      real.length > 0 && declared.join(",") === real.join(",") && unitCodes.join(",") === real.join(","),
      `real=[${real}] table=[${declared}] unit=[${unitCodes}]`);

    // AND THE BUNDLE LIST. fleet-sync.sh decides whether the follower needs a build by looking for
    // these three files; server.ts decides whether the board's bundle is stale by timing the same
    // three. A fourth entry landing in server.ts alone would leave the follower shipping a bundle
    // that is two thirds built, and bundleStale would report it — from the host that cannot fix it.
    const serverBundles = [...(/const BUNDLES = \[([^\]]*)\]/.exec(server)?.[1] ?? "")
      .matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const syncBundles = (/^BUNDLES="([^"]*)"/m.exec(syncSrc)?.[1] ?? "").split(/\s+/).filter(Boolean);
    pin("fleet-sync.sh looks for exactly the bundles server.ts calls the client",
      serverBundles.length > 0 && serverBundles.join(",") === syncBundles.join(","),
      `server=[${serverBundles}] sync=[${syncBundles}]`);
  }

  const proportionalCmd = /const VERIFY_PROPORTIONAL_CMD = '([^']+)'/.exec(server)?.[1] ?? "";
  const proportionalSteps = stepsOf(proportionalCmd);
  // The REPO GUARD is pinned as a THIRD side of the same sentence, because the short chain is the
  // one gate string that is chosen for a repo without being written for it: any repo whose
  // candidate is docs-only gets this fleet-shaped command instead of its own. Unguarded, that is a
  // RED verdict on a tree nothing looked at (`bun e2e/pins.ts` → Module not found) where the tri-
  // state has a state for exactly this — SKIPPED. Guard TEXT and EXIT CODE are held against
  // watchdog.sh's own guard and against server.ts's VERIFY_SKIP_EXIT: three files, one sentence,
  // and shell on one side of it, so no compiler sees this drift.
  const skipExitHere = Number(/const VERIFY_SKIP_EXIT = (\d+)/.exec(server)?.[1] ?? NaN);
  const REPO_GUARD = /^\[ -f fleet-e2e\.ts \] \|\| \{ echo "(verify skipped: [^"]+)"; exit (\d+); \}; /;
  const propGuard = REPO_GUARD.exec(proportionalCmd);
  const gateGuard = REPO_GUARD.exec(verifyCmd);
  pin("the docs-proportional server gate carries the full chain's repo guard, then is exactly install then pins",
    proportionalCmd.replace(REPO_GUARD, "") === "bun install --frozen-lockfile && bun e2e/pins.ts"
      && !!propGuard && !!gateGuard && propGuard[1] === gateGuard[1]
      && Number(propGuard[2]) === skipExitHere
      && proportionalSteps.length === 2
      && proportionalSteps[0] === "install" && proportionalSteps[1] === "pins",
    `cmd=${JSON.stringify(proportionalCmd)} chain=[${proportionalSteps.join(">")}] `
    + `guard=${JSON.stringify(propGuard?.[1] ?? null)}/${propGuard?.[2] ?? null} `
    + `gateGuard=${JSON.stringify(gateGuard?.[1] ?? null)} skipExit=${skipExitHere}`);

  // …AND THE STEP NAMES THAT COMMAND IS SOLD AS. The gate never states them separately — it stamps
  // whatever verify-proportion.ts classified for the actual diff — but the post-land audit has no
  // diff to classify (owner 2026-09-04: a docs-only land gets the short chain in tier 2 as well),
  // so it stamps VERIFY_PROPORTIONAL_STEPS onto its ledger row. That constant is prose about the
  // command above it, and nothing else in the tree would notice if the two stopped agreeing: a row
  // could then claim `steps:["install","pins"]` over a chain that had grown a third step.
  const proportionalStepsConst = /const VERIFY_PROPORTIONAL_STEPS: LocalProofStep\[\] = \[([^\]]*)\]/
    .exec(server)?.[1] ?? "";
  const declaredSteps = [...proportionalStepsConst.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
  pin("the audit's proportional step names are exactly the steps its command runs",
    declaredSteps.length > 0 && declaredSteps.join(">") === proportionalSteps.join(">"),
    `declared=[${declaredSteps.join(">")}] cmd=[${proportionalSteps.join(">")}]`);

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
      .filter((t) => t !== "CLAUDE.md" && t !== "graphify-out/graph.json");
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
  // THE QUEUE ANALYST IS RETIRED (2026-09-10), and a retirement is only real if it is STRUCTURAL.
  // These are negative rules: not "the feature is off" — off was its state for a month while every
  // symbol, route and field stayed — but "no producer, no carrier, no door exists". The restore
  // anchor is 7ff56eab83f64b0826142139c7f4d1be274ebd2d.
  const client = clientU.text;
  const executableServer = server.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  const executableClient = client.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

  // 1. THE MODULES ARE GONE. Named individually rather than as a count, so a re-appearance says
  // which one came back.
  const retiredModules = ["analysis-prompt.ts", "analysis-staleness.ts", "task-analysis-warning.ts"]
    .filter((f) => exists(f));
  pin("the three analyst modules are absent from the tree",
    retiredModules.length === 0, retiredModules.join(", ") || "none present");

  // 2. NO PRODUCER AND NO CARRIER IN EXECUTABLE CODE. Comments are excluded on purpose: this file's
  // own retirement notes name the retired symbols, and a rule that could not survive being
  // explained is a rule people delete.
  const deadSymbols = ["ANALYSIS_ON", "ANALYSIS_TICK_MS", "ANALYSIS_MODEL", "ANALYSIS_CMD",
    "tickAnalysisSweep", "analysisDue", "analysisFailed", "recordAnalysisVerdict", "analysisStale",
    "buildAnalysisPrompt", "ANALYSIS_BLOCKERS", "TaskAnalysis", "AnalysisBlocker"];
  const aliveServer = deadSymbols.filter((sym) => executableServer.includes(sym));
  pin("no retired analyst symbol survives in executable server code",
    aliveServer.length === 0, aliveServer.join(", ") || "none");
  const aliveTypes = deadSymbols.filter((sym) =>
    read("server/types.ts").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n").includes(sym));
  pin("the task record declares no analysis field and no analysis type",
    aliveTypes.length === 0 && !/\banalysis\?:/.test(read("server/types.ts")),
    aliveTypes.join(", ") || "none");

  // 3. THE ROUTE IS RETIRED, not merely refusing. A door that answers 409 is a door; this one must
  // not be reachable at all, so the pattern that matched its handler is absent from the file.
  pin("POST /api/tasks/:id/reanalyse has no handler left",
    !executableServer.includes("reanalyse"), "");

  // 4. LEGACY STATE IS DROPPED, NOT CARRIED. A fleet.json written before the retirement still holds
  // `analysis` on its rows. The normalizer must not restore it — the load-bearing half of the cut,
  // because a restored verdict is a claim about a tree that has since moved and nothing refreshes.
  //
  // THE RULE IS POSITIVE, and it has to be. This pin first asserted the ABSENCE of an `analysis:`
  // line in the normalizer's field list — and passed while the hole was wide open, because that
  // map SPREADS the persisted row (`{ ...t, … }`): an unlisted field rides through untouched.
  // Absence of a line is not absence of the field. So the explicit strip is what is pinned, and
  // the spread it defends against is named beside it. (Found by e2e/tasks.ts §(h6) on a live
  // server, 2026-09-10 — a source rule that cannot see a spread needs a driven twin.)
  const normStart = server.indexOf("// kind migration as load normalisation");
  const normBody = normStart < 0 ? "" : server.slice(normStart, server.indexOf("criterion: t.criterion &&", normStart));
  pin("the task normalizer STRIPS a persisted analysis rather than leaving it to the spread",
    normBody !== ""
      && /\.map\(\(\{ analysis: _retiredAnalysis, \.\.\.t \}[^)]*\) => \(\{ \.\.\.t,/.test(normBody)
      && normBody.includes("brief: t.brief"),
    normBody === "" ? "the normalizer slice was not found" : `${normBody.split("\n").length} lines`);

  // 5. THE WIRE CARRIES NEITHER THE PER-ROW READING NOR THE MODE. Both directions: the poll must not
  // send them, and the client must not read them — a client that kept reading an absent field would
  // silently degrade to whatever `undefined` means at that site.
  // The ONE legitimate `analysis:` left in executable server code is the normalizer's STRIP (rule 4
  // above) — a destructure that removes the field, not a carrier that transports it. It is excluded
  // by its exact binding name so a second, differently-named use cannot slip through with it.
  const analysisCarriers = executableServer.split("\n")
    .filter((l) => /\banalysis\??:/.test(l) && !l.includes("analysis: _retiredAnalysis"));
  pin("neither the 2 s poll nor GET /api/tasks carries an analysis field",
    analysisCarriers.length === 0, analysisCarriers.map((l) => l.trim()).join(" | ") || "none");
  pin("the client reads no analysis digest, cache or runtime mode",
    !executableClient.includes("analysisOn") && !executableClient.includes("taskAnalysisFull")
      && !/t\.analysis/.test(executableClient) && !executableClient.includes("classifyAnalystOffWarning"), "");

  // 6. THE DISPOSITION RAIL'S WRITE DOOR IS CLOSED — and only the write door. The reader validates
  // no worker name, so labels already filed under `analysis` stay readable: retiring a producer
  // must not rewrite what an owner once said.
  const protocol = read("src/protocol.ts");
  const readerBody = server.slice(server.indexOf("async function readDispositions"),
    server.indexOf("function writeDisposition"));
  pin("the disposition worker set no longer admits `analysis`, while the reader still validates none",
    /export const DISPOSITION_WORKERS: DispositionWorker\[\] = \["land", "review3", "enhance"\];/.test(protocol)
      && readerBody !== "" && !readerBody.includes("DISPOSITION_WORKERS"), "");

  // 7. THE WAVE PROJECTION IS DETERMINISTIC OR IT IS NOTHING. Model edges and the running-work block
  // they alone could fill are gone; what remains must still be the file-surface rule, not an empty
  // module that reports "no collision" about a question nobody asked.
  const waves = read("task-waves.ts");
  const wavesCode = waves.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  pin("the wave projection keeps its file-surface rule and carries no model-edge vocabulary",
    /const bFiles = new Set\(b\.files \?\? \[\]\);/.test(wavesCode)
      && /return \(a\.files \?\? \[\]\)\.some\(\(file\) => bFiles\.has\(file\)\);/.test(wavesCode)
      && !wavesCode.includes("modelEdges") && !wavesCode.includes("analysisOn")
      && !wavesCode.includes("blockedByRunning") && !wavesCode.includes("trustedCollides"), "");
  // …and the door that feeds it. The derived-surface review (src/client.ts, 2026-09-12) gave the
  // owner's confirm a SECOND producer — the mechanically derived list, offered path by path — and
  // the whole point of that cut was that it opens no new route: every file-surface act on the board
  // still lands on the one owner handler that already existed. This is the must-agree pair, and the
  // count is deliberate: three acts (promote a proposal · discard a proposal · confirm the ticked
  // derived paths), so a fourth producer has to come here and say what it is.
  const surfaceActs = [...client.matchAll(/qAct\(t\.id, "files", /g)].length;
  pin("every file-surface act on the board goes through the one existing owner route",
    surfaceActs === 3
      && server.includes(String.raw`const taskFiles = /^\/api\/tasks\/([a-z0-9]+)\/files$/`)
      && !/"files-confirm"|\/files\/confirm/.test(client),
    `${surfaceActs} file-surface act(s) in the client`);

  // --- AND WHAT SURVIVED IT. The brief compiler was fused to the analyst on one switch until
  // 2026-08-08 and is the half that stayed; these rules are what keep the cut from having taken it
  // along. Its own fact, its own guard, its own registration, and a sweep that writes no reading.
  const briefFactDefs = [...executableServer.matchAll(/const BRIEF_ON = BRIEF_TICK_MS > 0;/g)];
  pin("one plainly named server fact derives brief-compiler mode from its own configured cadence",
    briefFactDefs.length === 1, `${briefFactDefs.length} BRIEF_ON definition(s)`);
  const briefStart = server.indexOf("async function tickBriefSweep");
  const briefBody = briefStart < 0 ? "" : server.slice(briefStart, server.indexOf("// --- ↻ refine", briefStart));
  const briefCode = briefBody.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  pin("BRIEF_ON feeds the brief sweep guard and its only scheduler registration",
    /sweepBusy \|\| !BRIEF_ON/.test(briefBody)
      && /if \(BRIEF_ON\) setInterval\([^\n]*tickBriefSweep[^\n]*, BRIEF_TICK_MS\);/.test(executableServer));
  pin("the compiler sweep compiles and never judges: no verdict, no reading",
    briefCode.length > 0 && !briefCode.includes("ANALYSIS") && !briefCode.includes(".analysis"),
    briefCode.length ? "" : "tickBriefSweep not found");
  // ONE site writes a machine brief, and after the retirement exactly ONE caller reaches it — the
  // analyst's own compile step was the second. A third would be a new producer of the bytes a lane
  // is founded on, which is the one thing this rule exists to make visible.
  pin("exactly one site writes a machine-compiled brief, and one sweep goes through it",
    [...executableServer.matchAll(/\.brief = \{ text, at: Date\.now\(\), model: SUMMARY_MODEL, edited: false \}/g)].length === 1
      && [...executableServer.matchAll(/await compileBriefs\(/g)].length === 1);
  pin("the owner poll carries the compiler mode as its own fact, omitted at zero",
    /\.\.\.\(BRIEF_ON \? \{ briefCompiler: \{ on: true \} \} : \{\}\),/.test(executableServer)
      && client.includes("briefCompilerOn = data.briefCompiler?.on;"));
  pin("every brief exposes one text-free top-level generation that invalidates client full/list/detail caches",
    /& \{ briefAt\?: number; criterion\?:/.test(server)
      && /\.\.\.\(t\.brief \? \{ briefAt: t\.brief\.at \} : \{\}\)/.test(server)
      && client.includes("briefAt?: number;")
      && /const qTaskFullKey =[\s\S]{0,300}?t\.briefAt \?\? 0/.test(client)
      && /t\.filesOrigin, t\.cluster, t\.briefAt,/.test(client)
      && /t\.note, t\.kind, t\.briefAt,/.test(client));
  // THE RELEASE DOOR IS UNCHANGED BY THE CUT, and that has to be said mechanically: releasing was
  // the decision before the analyst existed and stays the decision after it. What went is the
  // override arm (`release anyway ▸`, the `task_override` audit line, the note), which had no
  // producer left once no verdict could contradict a release.
  const releaseStart = server.indexOf('else if (taskAct[2] === "queue")');
  const releaseSlice = releaseStart < 0 ? "" : server.slice(releaseStart, server.indexOf('else if (taskAct[2] === "unqueue")', releaseStart));
  // comments excluded: the retirement note AT that call site names the arm it removed, and a rule
  // that fails on its own explanation is a rule the next reader deletes
  const releaseBody = releaseSlice.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  pin("release stays one owner act with no override arm and no verdict to overrule",
    releaseSlice !== "" && /releaseTask\(t, "owner"\);/.test(releaseBody)
      && !releaseBody.includes("task_override") && !releaseBody.includes(".analysis"),
    releaseSlice === "" ? "the queue action was not found" : `${releaseBody.split("\n").length} code lines`);

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
// THE SUFFIX IS NOW BOUND TO A NAME (`anchored`) rather than interpolated into the argument, and
// the rule follows it there rather than being loosened: since 2026-09-06 each worker is timed for
// its ResolverRun row, and an anchor block computed inside the timed expression would charge every
// resolver run a git+classification read the model never paid. Both halves are still held exact —
// the same one-line append at both sites, and the same bound name passed at both calls — so a
// third worker still cannot inherit landing rules and neither site can quietly drop the suffix.
{
  const appended = [...server.matchAll(/^  const anchored = `\$\{prompt\}\$\{await landingAnchorBlock\(root\)\}`;$/gm)].length;
  const passed = [...server.matchAll(/^      anchored, cwd\);$/gm)].length;
  pin("the merge and repair workers each append the landing anchors, and no shared runner hands them to anyone else",
    appended === 2 && passed === 2
    && /const sourceTree = await dispatchSourceTree\(root\)\.catch\(\(\) => null\);\n  if \(sourceTree === null\) return "";/.test(server)
    && /async function landingAnchorBlock\(root: string\): Promise<string> \{/.test(server)
    && /triggers: \["landing"\],/.test(server)
    && [...server.matchAll(/landingAnchorBlock\(/g)].length === appended + 1
    && !/interface WorkerSpec \{[^}]*plan/.test(server),
    `${appended} call-site append(s), ${passed} bound pass(es)`);
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

// server/persist.ts#readLedger is the one read door for every JSONL ledger, and its callers read
// fields straight off a row (server.ts#stewardRecentSends: `e.event`). A line that PARSES but is not
// a record — `null`, a primitive, an array — used to be delivered as a row with malformed=0, and the
// consumer threw a TypeError (Astra finding 3, docs/messungen/2026-09-14-astra-suiten-types-tests-befunde.md
// R3). The reader is IMPORTED and RUN over scratch fixtures: a source match would stay green the day
// the check moved below the push.
{
  const RULE_LEDGER = "readLedger delivers only records: a parseable non-object line is counted malformed, never a row";
  const dir = mkdtempSync(`${tmpdir()}/fleet-pins-ledger-`);
  try {
    const valid = ['{"event":"a","ts":1}', '{"event":"b","ts":2,"detail":"x:y"}'];
    for (const [i, form] of ["null", "42", "-1.5", '"text"', "true", "false", "[]", '[{"event":"a"}]'].entries()) {
      for (const generation of [".1", ""]) {
        const file = `${dir}/shape-${i}-${generation ? "older" : "current"}.jsonl`;
        writeFileSync(`${file}${generation}`, `${valid[0]}\n${form}\n${valid[1]}\n`);
        const got = await readLedger<Record<string, unknown>>(file);
        pin(`${RULE_LEDGER} — ${form} in the ${generation ? "older" : "current"} generation`,
          got.total === 2 && got.malformed === 1 && got.rows.length === 2
            && got.rows.every((r) => r !== null && typeof r === "object" && !Array.isArray(r))
            && JSON.stringify(got.rows) === `[${valid.join(",")}]`,
          `total=${got.total} malformed=${got.malformed} rows=${JSON.stringify(got.rows).slice(0, 120)}`);
      }
    }
    // the torn line keeps its count, and both kinds of hole add up rather than one masking the other
    const mixed = `${dir}/mixed.jsonl`;
    writeFileSync(mixed, `null\n{"event":"torn"\n${valid[0]}\n`);
    const holes = await readLedger<Record<string, unknown>>(mixed);
    pin(`${RULE_LEDGER} — a torn line and a null line are two holes`,
      holes.total === 1 && holes.malformed === 2, `total=${holes.total} malformed=${holes.malformed}`);
    // …and today's ledgers read exactly as before: a fixture of valid records across both generations
    // yields the same rows, in chronological order, byte-identical to a plain parse of each line.
    const older = ['{"event":"steward_send","ts":1,"slot":3,"detail":"nudge:r1"}', '{"at":2,"covers":[{"branch":"b","mainAfter":"abc"}],"nested":{"k":[1,null,"s"]}}'];
    const current = ['{"id":"d1","target":"srv","at":3,"empty":{}}', '{"text":"ümlaut \\"quoted\\" \\n","ts":4,"n":null}'];
    const same = `${dir}/same.jsonl`;
    writeFileSync(`${same}.1`, `${older.join("\n")}\n`);
    writeFileSync(same, `${current.join("\n")}\n`);
    const read = await readLedger<Record<string, unknown>>(same);
    const plain = [...older, ...current];
    pin(`${RULE_LEDGER} — valid records across both generations are delivered unchanged and in order`,
      read.total === plain.length && read.malformed === 0
        && read.rows.map((r) => JSON.stringify(r)).join("\n") === plain.join("\n"),
      `total=${read.total} malformed=${read.malformed}`);
    // readEventLog is the rows-only door on top of it and must inherit the shape guarantee
    const viaEventLog = await readEventLog(`${dir}/mixed.jsonl`);
    pin(`${RULE_LEDGER} — readEventLog inherits it`,
      viaEventLog.total === 1 && viaEventLog.rows.every((r) => r !== null && typeof r === "object"),
      `total=${viaEventLog.total}`);
    // briefstats.ts#readJsonl was a hand copy of this reader that kept the old defect after 99c8d74d.
    // Run it, not grep it: a delegation that re-grew its own parse loop must still turn this red.
    const brief = `${dir}/briefstats.jsonl`;
    writeFileSync(brief, `${valid[0]}\nnull\n`);
    const viaBrief = await readJsonl<Record<string, unknown>>(brief);
    pin(`${RULE_LEDGER} — briefstats.ts#readJsonl inherits it (one record + one null line → rows=1 malformed=1)`,
      viaBrief.rows.length === 1 && viaBrief.malformed === 1 && JSON.stringify(viaBrief.rows) === `[${valid[0]}]`,
      `rows=${JSON.stringify(viaBrief.rows).slice(0, 120)} malformed=${viaBrief.malformed}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
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
  const receiptWrites = [...server.matchAll(/appendEvent(?:Strict)?\(CONTEXT_RECEIPT_FILE, \{[\s\S]*?\n\s*\}\);/g)]
    .map((m) => m[0]);
  pin("every context-receipt writer carries briefHash AND briefSource — the ledger has one row shape, not two",
    receiptWrites.length === 5
    && receiptWrites.every((w) => /briefHash: briefHashOf\(deliveredBrief\)/.test(w)
      && /briefSource(: FOUNDING_BRIEF_SOURCE)?,/.test(w)),
    `${receiptWrites.length} writer(s), ${receiptWrites.filter((w) => !/briefHash/.test(w)).length} without briefHash`);
  // …and the model resolved at write time plus the source-package account (2026-09-14). A writer
  // that went back to `model: free.model` would write null for every unpinned slot again; one
  // without `snippet` would read as a row from before the count existed.
  pin("every context-receipt writer resolves the model through receiptModel and carries a snippet account",
    receiptWrites.length === 5
    && receiptWrites.every((w) => /\.\.\.receiptModel\(free\)/.test(w) && !/model: free\.model/.test(w)
      && /snippet: (snippet\.receipt|NO_SNIPPET_RECEIPT)/.test(w)),
    `${receiptWrites.filter((w) => !/receiptModel/.test(w)).length} without receiptModel, `
      + `${receiptWrites.filter((w) => !/snippet:/.test(w)).length} without snippet`);
  // THE REPORT LEDGER: every place that opens a report or stamps a verdict writes its row. A fourth
  // decision site without the line would leave that verdict only in the prunable live list.
  const reportOpens = server.split('audit("fleet_report_open"').length - 1;
  const decisionStamps = server.split("report.decision = {").length - 1;
  pin("fleet-reports.jsonl gets an OPEN row at every report filing and a DECISION row at every verdict stamp",
    /const FLEET_REPORT_LEDGER_FILE = `\$\{import\.meta\.dir\}\/fleet-reports\.jsonl`;/.test(server)
    && reportOpens === 2 && server.split("const ledgered = ledgerReportOpen(report);").length - 1 === reportOpens
    && decisionStamps === 3
    && server.split("const ledgered = ledgerReportDecision(report, report.decision);").length - 1 === decisionStamps
    && read(".gitignore").split("\n").includes("fleet-reports.jsonl"),
    `opens=${reportOpens} stamps=${decisionStamps}`);
  // The set is CLOSED at the type, and every literal in it is produced by something: six by the
  // dispatch-seam derivation, the seventh by the founding constant. A value in the union that no
  // writer can emit is a category the ledger promises and never delivers. ("main" joined 2026-09-11
  // with POST /api/self/tasks/:id/brief — a MAIN-sharpened brief booked as "owner" would put the
  // very falsehood that door was built to end into a RATE.)
  // S6 (08ec67c0) · THE FILING TEMPLATE IS A DOC↔CODE PAIR. AGENTS.md tells every filer which card
  // fields the create doors read; authorCardFrom's closed list decides it. A field renamed on one
  // side only would teach filers a 400 — and no compiler sees prose.
  const cardDoorFields = /const known = \[([^\]]+)\];\n  const extra = Object\.keys\(c\)/.exec(server)?.[1] ?? "";
  const agentsCard = /optional `card\{ziel, surface\{files, symbols\}, done, verify, verboten, size\}`/.test(read("AGENTS.md"));
  pin("AGENTS.md's card template names exactly the card fields the create doors read",
    cardDoorFields.replace(/\s/g, "") === '"ziel","surface","done","verify","verboten","size"' && agentsCard
    && /ZIEL: [^\n]*\nFLAECHE: [^\n]*\nDONE: [^\n]*\nVERIFY: [^\n]*\nVERBOTEN: [^\n]*\nROLLE: /.test(read("AGENTS.md")),
    `door=[${cardDoorFields}] agents=${agentsCard}`);
  const briefSourceType = /type BriefSource = ([^;]+);/.exec(server)?.[1] ?? "";
  pin("BriefSource is a closed set whose every literal has a producer",
    briefSourceType.trim() === '"compiled" | "owner" | "main" | "raw" | "clarify" | "founding" | "card"'
    && /if \(clarify\) return "clarify";/.test(server)
    && /if \(t\.card\?\.valid\) return "card";/.test(server)
    && /if \(!t\.brief\) return "raw";/.test(server)
    && /if \(t\.brief\.by === "main"\) return "main";/.test(server)
    && /t\.brief\.edited \|\| t\.brief\.model === "owner" \? "owner" : "compiled"/.test(server)
    && /const FOUNDING_BRIEF_SOURCE: BriefSource = "founding";/.test(server),
    briefSourceType.trim() || "no BriefSource type");

  // ACP-25 · THE AUTHORSHIP OF A PINNED BRIEF, held as a SOURCE rule because no runtime probe can
  // see it: the three sites that turn `TaskBrief.edited` into words live in the client bundle, and
  // the whole defect this act repaired was that they turned it into a claim about a PERSON. Two
  // halves, and the second is the one that protects the backlog:
  //   (1) every site that renders the edited flag consults `by` through the ONE shared reading —
  //       a fourth site added tomorrow that forgets it would re-mint "edited by the owner" on a
  //       machine-written brief, which is exactly the sentence this act removed;
  //   (2) the LEGACY strings survive byte-for-byte on the else branch. A brief carrying no `by`
  //       was written before authorship was recorded, and a render that merely LOOKED different
  //       would have re-interpreted every stored entry — the one thing the act was told not to do.
  const briefClient = clientU.text;
  const briefServerExec = server.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  const briefEditSites = briefClient.split("\n")
    .map((l, i) => ({ l, n: i + 1 }))
    .filter(({ l }) => /\bbrief\.edited\b/.test(l) || /\bt\.brief\.edited\b/.test(l));
  const unguarded = briefEditSites.filter(({ n }) =>
    !/briefByMain\(/.test(briefClient.split("\n").slice(n - 1, n + 2).join("\n")));
  pin("every client site that renders a pinned brief's edited flag reads its AUTHOR through the one shared predicate",
    briefEditSites.length === 3 && unguarded.length === 0
      && /const briefByMain = \(b: \{ edited: boolean; by\?: string \} \| undefined\): boolean =>\n\s*!!b && b\.edited && b\.by === "main";/.test(briefClient),
    `sites=${briefEditSites.length} unguarded=[${unguarded.map((x) => x.n).join(",")}]`);
  pin("a brief with no recorded author renders in the three legacy strings, unchanged",
    briefClient.includes('" · edited by the owner"') && briefClient.includes('" · yours"')
      && briefClient.includes('" — yours, pinned"'),
    "legacy branches");
  // …and the SERVER half of the same rule: the author is stamped, never read off a request, and the
  // normalizer restores only the two literals — a hand-edited state file must not be one word away
  // from crediting a brief to the owner.
  pin("TaskBrief.by is stamped at both doors and restored from a closed pair, never taken from a body",
    /t\.brief = \{ text, at: Date\.now\(\), model: "owner", edited: true, by: "owner" \};/.test(briefServerExec)
      && /t\.brief = \{ text, at: Date\.now\(\), model: "main", edited: true, by: "main" \};/.test(briefServerExec)
      && /\.\.\.\(t\.brief\.by === "owner" \|\| t\.brief\.by === "main" \? \{ by: t\.brief\.by \} : \{\}\)/.test(briefServerExec)
      && !/by: (body|typeof body)/.test(briefServerExec),
    "stamped");
  // THE DOOR ITSELF, in the shape its four neighbours are pinned in: program from the binding, repo
  // from the caller's checkout, and a CLOSED body — plus the two refusals that keep it off the
  // owner's own text. An unauthored pinned brief is protected by the same line as an owner-authored
  // one, and that is the point: absence is not harmlessness.
  const sharpenAt = server.indexOf("async function sharpenBriefForMain");
  const sharpenBody = sharpenAt < 0 ? "" : server.slice(sharpenAt, server.indexOf("async function releaseTaskForMain", sharpenAt));
  pin("the brief-sharpening door DERIVES program and repo, closes its body, and refuses the owner's own text",
    sharpenBody.length > 0
      && /const bound = boundProgramForMain\(s\);/.test(sharpenBody)
      && /t\.programId !== program\.id/.test(sharpenBody)
      && /const mainRepo = await repoKeyOf\(s\);/.test(sharpenBody)
      && /repoCanon\(target\) !== mainRepo/.test(sharpenBody)
      && /Object\.keys\(body \?\? \{\}\)\.filter\(\(k\) => k !== "text" && k !== "review"\)/.test(sharpenBody)
      && /t\.brief\?\.edited && t\.brief\.by === "owner"/.test(sharpenBody)
      && /t\.brief\?\.edited && t\.brief\.by === undefined/.test(sharpenBody)
      && /audit\("main_brief", s\.id/.test(sharpenBody),
    sharpenBody.length > 0 ? "derivation" : "sharpenBriefForMain missing");
  // …and its route's non-lane exclusion, in the family's own shape. Pinned as a PAIR with the
  // sentence, because a route that silently lost the check would pass every runtime fixture that
  // only ever calls it as a MAIN.
  const sharpenRouteAt = server.indexOf("const selfTaskBrief = ");
  const sharpenRoute = sharpenRouteAt < 0 ? "" : server.slice(sharpenRouteAt, server.indexOf("// ACP-16 · Program-MAIN release", sharpenRouteAt));
  pin("the brief-sharpening route excludes a lane in its own words and hands the handler the token's own slot",
    sharpenRouteAt > 0 && /s\.worktree && s\.label !== STEWARD_LABEL/.test(sharpenRoute)
      && sharpenRoute.includes("a lane may not sharpen a brief")
      && /return sharpenBriefForMain\(s, selfTaskBrief\[1\]!, await readJson\(req\)\);/.test(sharpenRoute),
    sharpenRoute.length > 0 ? "lane-excluded" : "brief route missing");

  // ...and the READER of that ledger carries the same two sets, in a second file, as literal arrays.
  // tsc holds neither to the other — two independent literal unions are both perfectly well typed —
  // so a new briefSource or a renamed disposition would leave briefstats.ts silently booking real
  // rows as `unknownSource` or as malformed, which is a hole that reads like data. Stated as a set
  // comparison rather than as a copied list, so a value added tomorrow is covered tomorrow.
  const briefstats = read("briefstats.ts");
  const literals = (src: string): string[] =>
    [...src.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]!).sort();
  const readerSources = literals(/export const BRIEF_SOURCES = \[([^\]]+)\]/.exec(briefstats)?.[1] ?? "");
  pin("briefstats.ts's BRIEF_SOURCES is server.ts's BriefSource union, value for value",
    readerSources.length === 7 && readerSources.join() === literals(briefSourceType).join(),
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
  // relying on an optional property whose absence could acquire a meaning later. The ONE optional
  // field, `browser?: true` (2026-09-14), is the exception by design: its absence already HAS its
  // meaning — a text lane, the default — so DEFAULT_SPAWN carries none and the tick spawns text lanes.
  pin("the attended dispatch carries model+harness+effort+browser, while the tick default keeps all three null and no browser",
    /type DispatchSpawn = \{ harness: string \| null; model: string \| null; effort: string \| null; browser\?: true \};/.test(server)
    && /const DEFAULT_SPAWN: DispatchSpawn = \{ harness: null, model: null, effort: null \};/.test(server)
    && /openSlot\(free, wt\.path, dRef, spawn\.model, null, spawn\.harness, spawn\.effort, NO_BOX, null, spawn\.browser === true\)/.test(dBody),
    dBody.match(/openSlot\([^;]*/)?.[0]?.slice(0, 180) ?? "no openSlot call");
  const tStart = server.indexOf("async function tickDispatch");
  const tBody = server.slice(tStart, server.indexOf("\n}\n", tStart));
  pin("tickDispatch's body is bounded and non-empty (an unbounded slice would make the rule below vacuous)",
    tStart > 0 && tBody.length > 500 && tBody.length < 20_000, `${tBody.length} bytes`);
  // THE TICK STARTS BY THE START PLAN SINCE SCHNITT 2 (docs/messungen/2026-09-13-queue-pipeline-
  // system-entwurf.md §5). Four rules over the source, none visible to tsc:
  //   · the tick walks startPlanWaves() and nothing else — no second oldest-first sweep over `tasks`
  //     beside it, which is how a plan-driven tick quietly grows a second decider;
  //   · the plan is built in one place, from ONE row builder (startPlanRowOf) that the tick's last
  //     re-check before a start reads too, and a row's release policy reaches it only through
  //     programReleasePolicy — the Program record, never a request (Schnitt 3, pinned below);
  //   · dispatchTask and releaseTaskForMain still never reach the plan — the dispatch core starts
  //     what it is handed, and a release is a decision, not a projection;
  //   · GET /api/start-plan and the wave door read the same plan (one projection for board, door, tick).
  // The probe half fails as itself: a server that no longer imports start-plan.ts makes the rest vacuous.
  {
    const spImport = /import \{[^}]*\bprojectStartPlan\b[^}]*\} from "\.\/start-plan";/.test(server);
    const spRoute = server.indexOf('url.pathname === "/api/start-plan" && req.method === "GET"');
    pin("start plan PROBE: server.ts imports start-plan.ts and serves GET /api/start-plan", spImport && spRoute > 0,
      `import=${spImport} route=${spRoute > 0}`);
    const bodyOf = (head: string): string => {
      const at = server.indexOf(head);
      return at < 0 ? "" : server.slice(at, server.indexOf("\n}\n", at));
    };
    const reach = ["async function dispatchTask", "function releaseTaskForMain"]
      .filter((head) => { const body = bodyOf(head); return !body || /\b(?:startPlanNow|startPlanWaves|projectStartPlan|startPlanChecks)\b|start-plan/.test(body); });
    const planFn = server.match(/function startPlanNow\([\s\S]*?\n\}\n/)?.[0] ?? "";
    const wavesFn = server.match(/function startPlanWaves\(\)[\s\S]*?\n\}\n/)?.[0] ?? "";
    const wDoorAt = server.indexOf('url.pathname === "/api/wave/dispatch"');
    const wDoor = wDoorAt < 0 ? "" : server.slice(wDoorAt, wDoorAt + 6000);
    pin("tickDispatch walks the start plan's waves, built from the one row builder — no oldest-first sweep beside it; dispatchTask and releaseTaskForMain never reach the plan",
      /const candidates = startPlanWaves\(\)\.flatMap\(/.test(tBody)
      && !/tasks\.filter\(/.test(tBody) && !/landWaveProjectionNow\(\)/.test(tBody)
      && /projectStartPlan\(\{ projection, rows, statuses, lanes, caps \}\)/.test(planFn)
      && /rows\.push\(startPlanRowOf\(t\)\);/.test(planFn)
      && /const releaseVerdictNow = \(t: Task\): StartPlanReleaseVerdict => releaseVerdict\(startPlanRowOf\(t\)\);/.test(server)
      && (server.match(/projectStartPlan\(/g) ?? []).length === 1
      && /const plan = startPlanNow\(projection\);/.test(wavesFn)
      && /url\.pathname === "\/api\/start-plan" && req\.method === "GET"\) return json\(startPlanNow\(\)\)/.test(server)
      && /const wPlanWaves = startPlanWaves\(\);/.test(wDoor) && !/landWaveProjectionNow\(\)/.test(wDoor)
      && reach.length === 0,
      JSON.stringify({ tick: /startPlanWaves\(\)/.test(tBody), sweep: /tasks\.filter\(/.test(tBody), rowBuilder: /startPlanRowOf/.test(planFn),
        door: /startPlanWaves\(\)/.test(wDoor), reach }));
    // ...and the plan's verdict is a gate that SKIPS, sits after the harness gate and before both
    // caps, and leaves the CAP verdict to the live caps: a plan counted before this instant must never
    // be the reason a lane starts past a full repo, and must never write a second cap sentence.
    const planGate = tBody.indexOf('if (plan.next !== "now" && !("cap" in plan.next)) {');
    const planStmt = planGate < 0 ? "" : tBody.slice(planGate, tBody.indexOf("}", tBody.indexOf("continue;", planGate)) + 1);
    pin("the plan's verdict gate skips its own wave, runs after the harness gate and before both caps, and never decides a cap",
      planGate > tBody.indexOf("if (!harnessAutomatableFor(rowH)) {")
      && planGate < tBody.indexOf("if (lanes >= repoCap.max)")
      && /waiting\(startPlanWaitNote\(plan\.next\)\);\s*continue;/.test(planStmt) && !/\breturn;/.test(planStmt),
      planStmt.replace(/\s+/g, " ").slice(0, 200) || "no plan gate");
  }
  // THE ONE SOURCE, at the one call a tick can make. The tick MAY now hand dispatchTask a spawn —
  // but only the ROW's own persisted, SET-time-validated choice, through the one accessor
  // (taskSpawnOf = t.spawn ?? DEFAULT_SPAWN). Any other argument here — a request value, an env
  // default, a computed harness — is the change that would hand an unattended lane an agent nobody
  // validated at set time, and it is invisible to tsc (the parameter accepts any DispatchSpawn) and
  // to every runtime test on a fleet with FLEET_HARNESS_AUTOMATION off, which is every suite.
  // one nested paren level, because the expected argument list itself contains a call. The sixth
  // argument is the wave hand-over (Schnitt 2) — followers of a start-plan wave, never a spawn.
  const tickCalls = [...tBody.matchAll(/dispatchTask\(((?:[^()]|\([^()]*\))*)\)/g)].map((m) => m[1].trim());
  pin("the tick's dispatch call carries the ROW's persisted choice through taskSpawnOf and nothing else",
    tickCalls.length === 1 && tickCalls[0] === "next, free, false, false, taskSpawnOf(next), handover",
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
  // ...and it runs BEFORE both lane caps, which is the whole of the R6 finding and is a POSITION, so
  // no runtime check on a fleet whose cap happens to be free can see it. This gate names the one
  // PERMANENT property in the loop — no number of lanes closing makes a declining adapter
  // automatable — while both caps are temporary by construction. Below them, the permanent reason
  // reached the row only inside the transient windows in which a temporary one did not hold, and
  // `waiting` writes on change with last-writer-wins: measured on a scratch instance, the harness
  // note appeared for ~4 s after a lane closed and was overwritten by the cap note on the next tick,
  // permanently. That is how 746513d1 came to sit at `waiting: 2/2 lanes busy in claude-fleet` for
  // hours while nothing about the cap was its reason (2026-09-07 04:47-05:14).
  //
  // The MASTER STOP stays above it and that is deliberate, not an oversight: a row the fleet queue
  // never looks at must keep its note byte-identical, or one program's grant would start painting
  // sentences onto every unrelated queued row in the fleet.
  const harnessGateIdx = tBody.indexOf("if (!harnessAutomatableFor(rowH)) {");
  const masterStopIdx = tBody.indexOf("if (!dispatchOn && !pd) continue;");
  pin("the harness-automation gate runs BEFORE both lane caps and AFTER the per-row master stop — a permanent reason outranks a temporary one",
    masterStopIdx > 0 && harnessGateIdx > masterStopIdx
      && tBody.indexOf("if (lanes >= repoCap.max)") > harnessGateIdx
      && tBody.indexOf("if (next.programId) {") > harnessGateIdx
      && tBody.indexOf("if (!free) {") > harnessGateIdx,
    JSON.stringify({ masterStopIdx, harnessGateIdx, repoCapIdx: tBody.indexOf("if (lanes >= repoCap.max)"),
      progGuardIdx: tBody.indexOf("if (next.programId) {"), freeIdx: tBody.indexOf("if (!free) {") }));
  // ...and the note says the two things a reader needs and NEITHER of them falsely: the harness, that
  // the only remaining path is a hand dispatch, and WHICH of the two conditions declined. The last one
  // is why the sentence is derived rather than written twice — with the flag SET, `pi-zai` still
  // declines on its own `automatable: false`, and a note that said "FLEET_HARNESS_AUTOMATION off"
  // there would send the owner after an env change that changes nothing.
  const whyFn = server.match(/const harnessAutomationWhy = [\s\S]*?;\n/)?.[0] ?? "";
  const whyReaders = server.split("harnessAutomationWhy()").length - 1;
  pin("the harness wait-note names the harness, 'hand dispatch only' and the condition that actually declined — from the one derived sentence",
    /waiting\(`waiting: harness \$\{rowH\.id\} is not automatable — no unattended path may drive it, hand dispatch only \(\$\{harnessAutomationWhy\(\)\}\)`\)/.test(tBody)
      && whyFn.includes("FLEET_HARNESS_AUTOMATION is set; the adapter declines")
      && whyFn.includes("FLEET_HARNESS_AUTOMATION is off; no named harness is automatable without it")
      && whyReaders === 2
      && !/FLEET_HARNESS_AUTOMATION off\)/.test(tBody),
    `note=${tBody.match(/waiting\(`waiting: harness[^`]*`\)/)?.[0] ?? "none"} readers=${whyReaders}`);
  // ...and it still SKIPS. A property of one row may never stop the sweep, and hoisting the gate made
  // that more load-bearing rather than less: it is now the FIRST note-writing branch, so a `return`
  // here would hold every row behind the oldest non-automatable one in the queue.
  const harnessStmt = tBody.slice(harnessGateIdx, tBody.indexOf("}", tBody.indexOf("continue;", harnessGateIdx)) + 1);
  pin("the harness gate holds only its own row — it continues, and one such row never stops the sweep",
    harnessGateIdx > 0 && /\bcontinue;/.test(harnessStmt) && !/\breturn;/.test(harnessStmt),
    harnessStmt.replace(/\s+/g, " ").slice(0, 200));

  // THE TWO CAPS AND THEIR ORDER, pinned as SHAPE because no runtime test can see the difference
  // between "the program cap narrows the repo cap" and "the program cap replaced it". A later
  // refactor that hoists the program check above the repo check, or that drops the repo check for
  // rows carrying a programId, still passes every behavioural check written with the per-program
  // cap set BELOW the repo cap — which is the only configuration a test ever exercises — while
  // silently permitting programs × per-program lanes on a fixed slot board.
  const repoCapIdx = tBody.indexOf("if (lanes >= repoCap.max)");
  const progGuardIdx = tBody.indexOf("if (next.programId) {");
  const progCapIdx = tBody.indexOf("programLanes >= programCap");
  pin("the repo lane cap is checked UNCONDITIONALLY and BEFORE the per-program one — the second cap can only narrow",
    repoCapIdx > 0 && progGuardIdx > repoCapIdx && progCapIdx > progGuardIdx
    // six spaces = the candidate loop's own body level: the repo check sits under no further `if`
    && /\n      if \(lanes >= repoCap\.max\) \{/.test(tBody),
    JSON.stringify({ repoCapIdx, progGuardIdx, progCapIdx }));
  // ...and WHERE that number comes from, which is the rule the per-repo entry adds and the one no
  // runtime test on a repo WITHOUT an entry can see: the tick reads the cap through repoLaneCap
  // (entry-then-env) for the ROW'S OWN target repo, never the env constant directly. A refactor
  // that reaches past the accessor to DISPATCH_MAX_LANES here would make every per-repo entry
  // silently inert — the value stored, echoed back by the route, and never counted against.
  // Unlike the per-program cap this one may RAISE the env default, so the ceiling that keeps it
  // honest is a different one and is asserted as itself: REPO_MAX_LANES_MAX is the slot board.
  const repoCapFn = server.match(/const repoLaneCap = \(repo: string\): RepoLaneCap => \{[\s\S]*?\n\};/)?.[0] ?? "";
  pin("the repo cap number is read through repoLaneCap (entry-then-env), and its ceiling is the slot board",
    /const repoCap = repoLaneCap\(repo\);/.test(tBody)
    && !/DISPATCH_MAX_LANES\b/.test(tBody)
    && /repoLaneCaps\[repoCanon\(repo\)\]/.test(repoCapFn)
    && /\{ max: DISPATCH_MAX_LANES, source: "default" \}/.test(repoCapFn)
    && /Math\.min\(v, REPO_MAX_LANES_MAX\)/.test(repoCapFn)
    && /const REPO_MAX_LANES_MAX = MAX_SLOTS;/.test(server),
    repoCapFn.slice(0, 400) || "repoLaneCap missing");
  // ...and the note carries the SOURCE next to the number. Two owner actions hide behind one
  // sentence — the machine default needs an env change and a restart, a repo entry needs one API
  // call — and a board that prints only "1/1" cannot tell them apart. Pinned as shape because a
  // fleet with no entry (every suite fixture by default) renders only the default branch.
  const repoSourceNote = tBody.match(/waiting\(`waiting: \$\{lanes\}[^`]*`\)/)?.[0] ?? "";
  pin("the repo cap's wait-note names the SOURCE of the number it held against, not just the number",
    /repoCap\.source === "repo" \? "repo cap" : "machine default"/.test(repoSourceNote),
    repoSourceNote || "no repo cap note");
  // ...and the NUMBER that second cap uses is now an OWNER-writable one (Program.dispatch.maxLanes),
  // which is exactly the shape that could quietly widen the machine. It cannot, and the reason is one
  // expression: programDispatchCap is a Math.min against DISPATCH_MAX_LANES_PER_PROGRAM, so an owner
  // record can only ever LOWER the env budget and a program without a grant computes the env number
  // itself. No runtime test can see this — every suite runs with the env default, where a widening
  // record and a narrowing one produce the same board.
  const progCapFn = server.match(/const programDispatchCap = [\s\S]*?\n\};/)?.[0] ?? "";
  pin("the per-program cap number can only be LOWERED by an owner record — programDispatchCap is a min against the machine number",
    /const programCap = programDispatchCap\(pd, repoCap\.max\);/.test(tBody)
    && /const machine = DISPATCH_MAX_LANES_PER_PROGRAM \?\? repoMax;/.test(progCapFn)
    && /Math\.min\(pd\?\.maxLanes \?\? machine, machine\)/.test(progCapFn)
    && !/DISPATCH_MAX_LANES_PER_PROGRAM/.test(tBody.slice(progGuardIdx, progCapIdx + 60)),
    progCapFn || "programDispatchCap missing");
  // ...and what that machine number FALLS BACK TO when the operator configured none: the ROW'S OWN
  // repo cap, never the env repo constant. This is the rule that keeps an unconfigured knob inert
  // now that repo caps differ per repo — anchored to FLEET_DISPATCH_MAX_LANES, raising one repo to 3
  // would leave every Program row in it held at 1/1 by a budget nobody set, under a note naming the
  // program. Invisible to every suite: with no repo entry the two anchors compute the same number,
  // which is exactly the configuration every fixture runs in.
  pin("an UNCONFIGURED per-program cap follows the ROW'S repo cap, so it stays inert when one repo is raised",
    /const DISPATCH_MAX_LANES_PER_PROGRAM: number \| null =\n  process\.env\.FLEET_DISPATCH_MAX_LANES_PER_PROGRAM\n/.test(server)
    && /\n    : null;/.test(server.slice(server.indexOf("const DISPATCH_MAX_LANES_PER_PROGRAM: number | null ="), server.indexOf("const DISPATCH_MAX_LANES_PER_PROGRAM: number | null =") + 400))
    && /\(pd: ProgramDispatch \| undefined, repoMax: number\)/.test(progCapFn),
    server.match(/const DISPATCH_MAX_LANES_PER_PROGRAM: number \| null =[\s\S]*?\n(?:    : null;|.*\n)/)?.[0] ?? "constant missing");
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
  const capStmt = tBody.match(/if \(lanes >= repoCap\.max\) \{[^\n]*\}/)?.[0] ?? "";
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
  // helper's own line plus the documented restores that are deliberately NOT releases:
  //   1. the requeue after a failed post-spawn gate (briefAndSend#requeue) — ONE loop over the
  //      rows the tail still OWNS, head and wave followers alike (until 2026-09-13 two writes, one
  //      for the head and one for the followers; folded when ownership became the loop's filter);
  //   2. the boot reconcile of an orphaned `sent` row;
  //   3. W3's self-split: a wave lane hands back the rows the bundling surface did not reach.
  // The followers in (1) and the rows in (3) are restores for the same reason the head is: these
  // rows WERE released, the lane simply is not the place they get done, so `pending` — the abort's
  // answer — would withdraw a release nobody withdrew.
  const releaseCalls = [...server.matchAll(/(?<!function )releaseTask\(([^)]*)\)/g)].map((m) => m[1].trim());
  // The third is the tick's POLICY release (Schnitt 3): a pending row a program's release policy
  // releases passes `queued` through the same helper, so `by` and the lifted hold cannot be forgotten.
  pin("releaseTask has exactly the three known call sites — the owner's ▸ queue, the Program-MAIN door and the tick's policy release",
    releaseCalls.length === 3 && releaseCalls.includes('t, "owner"') && releaseCalls.includes('t, "machine"')
    && /for \(const row of byPolicy\) \{\n        releaseTask\(row, "machine"\);/.test(tBody),
    releaseCalls.join(" | ") || "no releaseTask call");
  const queuedWrites = (server.match(/\bstatus = "queued";/g) ?? []).length;
  pin("\"queued\" is written by releaseTask plus exactly the documented non-release restores",
    queuedWrites === 4
      && /function releaseTask\(t: Task, by: "owner" \| "machine"\): void \{\n  t\.status = "queued";/.test(server),
    `${queuedWrites} direct writes of status = "queued"`);
  // W3 · ▸ START WAVE. Two pairs whose other side is not TypeScript.
  //
  // (1) THE BRIEF IS EXECUTABLE BYTES. wave-brief.ts hands a lane a curl line for the self-split
  // door; if that path is ever renamed on the server side, tsc sees a string on one side and a
  // string on the other and says nothing — the lane finds out by getting a 404 at the moment it
  // has already decided a row does not belong in its wave. Same class as LANE_EXIT_FOOTER quoting
  // the fleet-report statuses, and stated as a rule over EVERY route the brief quotes rather than
  // as a list of the one it quotes today.
  const waveBrief = ((): string | null => { try { return read("wave-brief.ts"); } catch { return null; } })();
  if (waveBrief === null) {
    skip("every /api/self route the wave brief quotes is registered in server.ts", "wave-brief.ts is not in this tree");
  } else {
    const quoted = [...new Set([...waveBrief.matchAll(/\/api\/self\/[a-z0-9/-]+/g)].map((m) => m[0]))];
    const unregistered = quoted.filter((route) => !server.includes(`"${route}"`));
    pin("every /api/self route the wave brief quotes is registered in server.ts",
      quoted.length > 0 && unregistered.length === 0,
      quoted.length === 0 ? "the brief quotes no self route — the split door went missing from it"
        : `${quoted.length} quoted: ${quoted.join(", ")}${unregistered.length ? ` · UNREGISTERED: ${unregistered.join(", ")}` : ""}`);
  }
  // (2) THE WAVE BUDGET (S7, 5ac5565d) HAS ONE DEFINITION, A PINNED DEFAULT, AND IS NOT THE UNDO
  // DEPTH. The door bounds on IDENTIFIERS — the live budget (env over the default) and the row
  // ceiling — so no literal can drift from the sensor's cut; the defaults are pinned by VALUE, so a
  // widening is a deliberate edit here and not a silent one there; and the constant's comment still
  // says in writing that a wave is ONE undo record, because the old cap agreed with UNDO_STACK_MAX
  // on 3 by coincidence and the new budget must not be read as a statement about it either.
  const landWaves = ((): string | null => { try { return read("task-land-waves.ts"); } catch { return null; } })();
  const capDoorAt = server.indexOf('url.pathname === "/api/wave/dispatch"');
  const capDoor = capDoorAt < 0 ? "" : server.slice(capDoorAt, capDoorAt + 4000);
  const budgetDefault = /export const LAND_WAVE_BUDGET_DEFAULT = (\d+);/.exec(landWaves ?? "")?.[1] ?? null;
  const rowsMax = /export const LAND_WAVE_ROWS_MAX = (\d+);/.exec(landWaves ?? "")?.[1] ?? null;
  const units = /LAND_WAVE_SIZE_UNITS[^=]*= \{ klein: 1, mittel: 2, gross: 3 \}/.test(landWaves ?? "");
  const envRead = /const LAND_WAVE_BUDGET = \(\(\): number => \{\n\s+const raw = Number\(process\.env\.FLEET_LAND_WAVE_BUDGET\);[\s\S]{0,160}: LAND_WAVE_BUDGET_DEFAULT;/.test(server);
  pin("the wave budget: default 5, ceiling 6 rows, klein/mittel/gross = 1/2/3, env over default, and it is not UNDO_STACK_MAX",
    landWaves !== null && capDoorAt > 0
      && budgetDefault === "5" && rowsMax === "6" && units && envRead
      && /wIds\.length > LAND_WAVE_ROWS_MAX/.test(capDoor)
      && /wUnits > LAND_WAVE_BUDGET\)/.test(capDoor)
      && !/wIds\.length > \d/.test(capDoor) && !/wUnits > \d/.test(capDoor)
      && !/LAND_WAVE_MAX_DEFAULT/.test(server + (landWaves ?? ""))
      && /IT IS NOT COUPLED TO UNDO_STACK_MAX/.test(landWaves ?? ""),
    `door=${capDoorAt > 0} default=${budgetDefault} rowsMax=${rowsMax} units=${units} env=${envRead}`
      + ` rowsIdent=${/wIds\.length > LAND_WAVE_ROWS_MAX/.test(capDoor)} budgetIdent=${/wUnits > LAND_WAVE_BUDGET\)/.test(capDoor)}`
      + ` disclaimer=${/IT IS NOT COUPLED TO UNDO_STACK_MAX/.test(landWaves ?? "")}`);

  // (2b) R2'S PREDICATE IS FASTENED TO THE FILES ON DISK (2026-09-12). `isGateMachinery` is what
  // makes a row land alone, and its other side is a SHELL SCRIPT and a directory listing — nothing
  // tsc can reach. Three rules, and the third is the one the change was made for:
  //   A. every wrapper and runner in the tree answers TRUE. The predicate says this with two globs
  //      rather than a list, so A also fails the day someone replaces them with a literal list and
  //      a new `e2e-foo.sh` appears beside it.
  //   B. every singleton the list names still EXISTS. A list that outlives its files silently
  //      shrinks R2, and the shrinking is invisible: rows simply start bundling.
  //   C. a check module under `e2e/` that is not one of those singletons answers FALSE — the whole
  //      finding. `verify-proportion.ts#ruleFor` classifies all of `e2e/` as `e2e-or-merge-land`
  //      (isolatedPreview:true), which is the right PROOF recommendation and the wrong answer to
  //      "did this row change the gate": borrowing it held back every row that brings tests.
  //      C is what goes red if the predicate is ever pointed back at isolatedPreview.
  const rootEntries = readdirSync(ROOT);
  const wrappersAndRunners = rootEntries
    .filter((f) => /^e2e-.*\.sh$/.test(f) || /^fleet-e2e.*\.ts$/.test(f)).sort();
  const missedMachinery = wrappersAndRunners.filter((f) => !isGateMachinery(f));
  pin("R2: every e2e wrapper and fleet-e2e runner on disk is gate machinery",
    wrappersAndRunners.length >= 6 && missedMachinery.length === 0,
    `${wrappersAndRunners.length} on disk${missedMachinery.length ? ` · MISSED: ${missedMachinery.join(", ")}` : ""}`);
  const goneMachinery = GATE_MACHINERY_FILES.filter((f) => !exists(f));
  pin("R2: every file the gate-machinery list names singly still exists",
    GATE_MACHINERY_FILES.length > 0 && goneMachinery.length === 0,
    `${GATE_MACHINERY_FILES.length} named${goneMachinery.length ? ` · GONE: ${goneMachinery.join(", ")}` : ""}`);
  const checkModules = readdirSync(`${ROOT}/e2e`)
    .filter((f) => f.endsWith(".ts")).map((f) => `e2e/${f}`)
    .filter((f) => !GATE_MACHINERY_FILES.includes(f)).sort();
  const misreadModules = checkModules.filter(isGateMachinery);
  pin("R2: a check module beside its family is NOT gate machinery — the passenger is not the apparatus",
    checkModules.length >= 10 && misreadModules.length === 0
      && ["e2e/harness.ts", "e2e/ctx.ts", "e2e/pins.ts"].every(isGateMachinery),
    `${checkModules.length} check modules${misreadModules.length ? ` · MISREAD: ${misreadModules.join(", ")}` : ""}`);

  // (3) THE AUDIT COVER'S `proportional` IS THE GATE'S OWN, and the whole pass-through is source-
  // only: recordLand hands `prov.verify?.proportional === true` to schedulePostLandAudit, that
  // becomes a cover field, and entryRunsShortChain reads it back with an `every`. A wave lands ONCE
  // and therefore mints ONE cover, so "proportional exactly when all n rows were docs" reduces to
  // "the gate classified the one rebased diff" — but only while these three ends agree, and no
  // suite can watch them together (tier 2 is OFF where the lands are, and the tier-2 harness lands
  // nothing docs-shaped). Both directions: the `every` is what makes ONE non-proportional cover
  // buy the whole coalesced entry the full chain, and dropping it would silently let a mixed burst
  // run short.
  pin("the post-land cover's `proportional` is the land gate's own verdict, and one non-proportional cover buys the full chain",
    /schedulePostLandAudit\(repo, main, branch, mainAfter, prov\.verify\?\.proportional === true\)/.test(server)
      && /covers\.length > 0 && covers\.every\(\(c\) => c\.proportional === true\) && repoRunsShortChain\(repo\)/.test(server),
    `schedule=${/schedulePostLandAudit\(repo, main, branch, mainAfter, prov\.verify\?\.proportional === true\)/.test(server)} every=${/covers\.every\(\(c\) => c\.proportional === true\)/.test(server)}`);

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
  pin("the Program-MAIN filing door DERIVES program and repo and reads a CLOSED body — text, kind, the spawn triple and an optional card",
    crBody.length > 0
      && /const bound = boundProgramForMain\(s\);/.test(crBody)
      && /programId: program\.id,/.test(crBody)
      && /const mainRepo = await repoKeyOf\(s\);/.test(crBody)
      && /repo: mainRepo,/.test(crBody)
      && /if \(body\.programId !== undefined\)/.test(crBody)
      && /const SELF_TASK_FIELDS = \["text", "kind", "harness", "model", "effort", "card"\];/.test(crBody)
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
  const loadKindBody = serverU.span("const loadTaskKind = (", "\n};\n")?.text ?? "";
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
    // 14 KB: the literal stood at 11.9 KB when the 2026-09-14 text-lane profile added its append
    xStart > 0 && xBody.length > 500 && xBody.length < 14_000, `${xBody.length} bytes`);
  const xCode = xBody.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  // automation-eligibility FLIPPED 2026-08-12, and the pin flips WITH its condition: the flip is
  // only sound alongside the declared readiness seam (trust and sign-in were measured in rendered
  // frames on 2026-08-12; the update screen's missing ready marker follows from its `pending`
  // result under the blocks-first order in the 2026-09-01 incident). These screens keep the node
  // wrapper alive, so no process probe can refuse them — only the rendered pane can. An
  // automatable:true WITHOUT the readiness declaration would re-open the silent brief-eat this
  // seam closed, and on a suite fleet (FLEET_HARNESS_AUTOMATION=0) that regression is invisible
  // at runtime — hence a rule over the source, coupling the two fields as one decision.
  pin("the codex adapter is automation-eligible ONLY alongside its declared readiness seam (one decision, two fields)",
    /\n  automatable: true,/.test(xBody) && /\n  readiness: \{/.test(xBody)
    && /Do you trust the contents of this directory/.test(xBody)
    && /Sign in with ChatGPT\|Welcome to Codex/.test(xBody)
    && /Update available![^\n]*\\s\\S[^\n]*Update now/.test(xBody)
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
    && /waitForFoundingReadiness\(free, candidateCurrent\)/.test(successionBody)
    && /waitForFoundingReadiness\(free, stillCurrent\)/.test(bootstrapBody),
    "shared founding readiness wait used by briefAndSend, Program-MAIN bootstrap, and succession");
  // ...AND EVERY founding delivery is covered, counted rather than named. The 2026-09-03 cut was
  // briefed as "the five `sendText(free, deliveredBrief, true)` sites"; there are SIX, and the
  // sixth — handleSelfSucceed's generic branch — carries a different variable name, so it fell
  // through the literal search AND was the only one with no gate at all. It was where all four
  // live `composer still holds N chars` failures happened. A count is the only shape of this pin
  // that a seventh rail cannot walk past: adding a founding delivery without its grace and its
  // bounded wait moves one of these three numbers off the others.
  const foundingSends = (server.match(/await sendText\(free, [A-Za-z]+, true\);/g) ?? []).length;
  const foundingWaits = (server.match(/await waitForFoundingReadiness\(free, /g) ?? []).length;
  const foundingGraces = (server.match(/await Bun\.sleep\(FOUNDING_BOOT_GRACE_MS\);/g) ?? []).length;
  // …and the SEVENTH rail (2026-09-12, the lane baton: server.ts#succeedLane) founds into the slot
  // it ALREADY holds, because the successor keeps the predecessor's worktree. Its three lines
  // therefore name `s`, not `free`, and counting them in the three numbers above would have meant
  // widening every regex to a variable name that also matches sends which are not foundings. So it
  // is asserted as itself, in its own body — the rule is unchanged (no founding delivery without
  // its grace and its bounded wait), only the shape of the slot it delivers into is.
  const laneRailStart = server.indexOf("async function succeedLane(");
  const laneRailBody = laneRailStart < 0 ? ""
    : server.slice(laneRailStart, server.indexOf("async function handleSelfSucceed", laneRailStart));
  const laneRailGated = /await Bun\.sleep\(FOUNDING_BOOT_GRACE_MS\);/.test(laneRailBody)
    && /await waitForFoundingReadiness\(s, stillCurrent\)/.test(laneRailBody)
    && /await sendText\(s, brief, true\);/.test(laneRailBody);
  pin("all SEVEN founding deliveries are gated — same count of sends, bounded waits and shared boot graces, and no naked 4 s sleep left",
    foundingSends === 6 && foundingWaits === 6 && foundingGraces === 7 && laneRailGated
      && !/await Bun\.sleep\(4000\);/.test(server),
    `sends=${foundingSends} waits=${foundingWaits} graces=${foundingGraces} laneRail=${laneRailGated}`);
  // ...and the ONE fixture that has to place a marker on the far side of that grace mirrors its
  // value. `unbound succession` proves the generic rail withholds a founding brief until the ready
  // marker appears, which only holds as a statement about READINESS if the marker lands after the
  // grace expires. The mirror is a source-level pair with no compiler between its halves: raising
  // FOUNDING_BOOT_GRACE_MS without moving the fixture would silently demote that block to a proof
  // of the grace, and lowering it would leave the marker inside the readiness budget by luck.
  const serverGraceMs = /const FOUNDING_BOOT_GRACE_MS = (\d+);/.exec(server)?.[1] ?? "";
  const fixtureGraceMs = /const UNBOUND_GRACE_MS = (\d+); \/\/ mirrors server\.ts FOUNDING_BOOT_GRACE_MS/
    .exec(read("e2e/programs.ts"))?.[1] ?? "";
  pin("the unbound-succession fixture mirrors the server's founding boot grace, so its late marker stays late",
    serverGraceMs !== "" && serverGraceMs === fixtureGraceMs,
    `server=${serverGraceMs || "missing"} fixture=${fixtureGraceMs || "missing"}`);
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
  // THREE doors share this body since the bind seam (2026-09-07): founding, succession and the
  // bind of an already-running session. The count is the point — a door that composes its OWN role
  // text is a second answer to "what is a Supervisor", and the two would drift with nothing saying so.
  const svBriefAt = server.indexOf("const supervisorBriefBody = ()");
  const svBriefBody = svBriefAt < 0 ? ""
    : server.slice(svBriefAt, server.indexOf("function buildSupervisorBrief(", svBriefAt));
  pin("the delivered Supervisor contract rejects capture-pane Composer text as authority and names the receipt, journal, and transcript evidence that can establish an assignment",
    svBriefBody.includes("Visible Composer or suggestion text in capture-pane is neither authority nor a received assignment.")
      && svBriefBody.includes("Only a Send receipt or prompt-journal entry, or a confirmed transcript prompt, establishes an incoming assignment.")
      && (server.match(/\.\.\.supervisorBriefBody\(\)/g) ?? []).length === 3,
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
      && /const refusal = supervisorRefusal\(s\);\s*\n\s*if \(refusal\) return json\(\{ error: refusal \}, 409\);/.test(svViewRouteBody)
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
    "/api/self/programs [widening]",     // GET-filter disjunct — the Supervisor reads every Program's content
    // STN-1: the one reader OUTSIDE the dispatcher, and it NARROWS rather than widens — the
    // Supervisor may not register a transition watch on itself (it is the completer). Named by
    // its enclosing function and the `exclusion` shape: `if (isBoundSupervisor(s))` → 409.
    "createWatchForSlot [exclusion]",
    // 2026-09-07: the three ROUTE gates collapsed into ONE reader. They used to hold three copies
    // of `!isBoundSupervisor(s) → NOT_SUPERVISOR/409`, which answered a session the same sentence
    // whether someone else held the role or the binding had died with its occupant — a fleet-level
    // fault that was, from inside a pane, indistinguishable from ordinary refusal. supervisorRefusal
    // reads the predicate ONCE and returns the SENTENCE; the routes turn it into the 409, and the
    // pin below keeps that half honest. `refusal` is its own shape: not a gate (it decides nothing
    // by itself) and emphatically not a widening.
    "supervisorRefusal [refusal]",
    // ACP-18 · the addressed message rail's TWO readers, both OUTSIDE the dispatcher and both of a
    // shape none of the four above describes: they neither gate a route nor widen a query, they
    // DERIVE THE CALLER'S OWN ADDRESS — "is this session the principal `role:supervisor`?" — so the
    // Supervisor can send and be sent to under a name that survives its own succession. Their own
    // shape (`principal`) rather than `unclassified`, because two entries parked in the catch-all
    // would blunt exactly the distinction this pin exists to keep.
    "messageSenderFor [principal]",
    "messageAddressesFor [principal]",
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
      : /^isBoundSupervisor\(s\) \? null : NOT_SUPERVISOR;/.test(after) ? "refusal"
      // ACP-18: the caller's own address, not a route decision. Both forms are spelled out so a
      // reader of a DIFFERENT shape cannot drift into this bucket; the function name in the entry
      // keeps the same line appearing elsewhere from passing as one of these two.
      : /^isBoundSupervisor\(s\)\) out\.push\(\{ kind: "role", role: "supervisor" \}\);/.test(after) ? "principal"
      : /const sup = $/.test(before) ? "principal"
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
  // THE OTHER HALF OF THE COLLAPSE. supervisorRefusal returns a SENTENCE and refuses nothing on its
  // own, so the pin above can no longer see that the three doors are gated at all — a route that
  // dropped its two lines would read as "one fewer reader" and pass. Named, not counted, on the same
  // discipline: each call site is the nearest preceding route literal, and each must turn the
  // sentence into the 409 immediately, before the handler is entered.
  const SV_REFUSAL_ROUTES = [
    "/api/self/nudge",                                                // the one bounded VOICE
    "/api/self/supervisor-view",                                      // the SENSES
    "/^\\/api\\/self\\/supervisor-watch\\/([a-z0-9]+)\\/complete$/", // STN-1, the SECOND voice
  ];
  const svRefusalFound = [...server.matchAll(/const refusal = supervisorRefusal\(s\);\s*\n\s*if \(refusal\) return json\(\{ error: refusal \}, 409\);/g)]
    .map((m) => {
      let route = "OUTSIDE THE ROUTE DISPATCHER";
      const at = m.index;
      if (svDispatcherAt >= 0 && at > svDispatcherAt)
        for (const r of svRoutesAt) { if (r.at < at) route = r.path; else break; }
      return route;
    }).sort();
  const svRefusalCalls = (server.match(/supervisorRefusal\(s\)/g) ?? []).length;
  pin("supervisorRefusal is read by EXACTLY the three Supervisor self routes, each turning the sentence straight into a 409",
    JSON.stringify(svRefusalFound) === JSON.stringify([...SV_REFUSAL_ROUTES].sort())
      && svRefusalCalls === SV_REFUSAL_ROUTES.length,
    `found=[${svRefusalFound.join(" · ")}] calls=${svRefusalCalls}`);
  // The bind door is the SECOND way the cross-program binding is ever written, so it carries both
  // rules its neighbours carry, for their reason: neither is visible at runtime. A bind reachable
  // with a self token would let a session appoint itself, and a binding written before the send
  // would only be wrong on the run where the send fails — appointing a Supervisor that was never
  // told it holds the role, which is the exact silence this whole seam exists to end.
  const svBindRouteAt = server.indexOf('url.pathname === "/api/supervisor/bind"');
  const svBindRouteBody = svBindRouteAt < 0 ? "" : server.slice(svBindRouteAt, svBindRouteAt + 600);
  const svBindAtFn = server.indexOf("async function bindSupervisor(");
  const svBindBody = svBindAtFn < 0 ? "" : server.slice(svBindAtFn, server.indexOf("\n}\n", svBindAtFn));
  const svBindSendAt = svBindBody.indexOf("await sendText(target, delivered, true);");
  const svBindWriteAt = svBindBody.indexOf("supervisor = {");
  pin("the Supervisor bind is minted on the OWNER rail only, names its slot explicitly, and writes the binding only AFTER a successful send",
    svBindRouteAt > 0 && selfRailAt > 0 && svBindRouteAt > selfRailAt
      && /if \(!\(await tokenGate\(tokenFrom\(req\)\)\)\) return json\(\{ error: "unauthorized" \}, 401\);/.test(svBindRouteBody)
      && !/x-fleet-self-token/.test(svBindRouteBody)
      && svBindSendAt > 0 && svBindWriteAt > svBindSendAt
      // no label match, no "first idle", no wildcard: the target comes from body.slot and nothing else
      && /const target = slotFrom\(body\.slot as number\);/.test(svBindBody)
      && !/slots\.find\(/.test(svBindBody) && !/\.label\b/.test(svBindBody),
    `route=${svBindRouteAt} send=${svBindSendAt} write=${svBindWriteAt}`);
  pin("the codex adapter declares its OWN comms — a null would hand it back the unprobed waiver",
    /\n  comms: \["codex", "node"\],/.test(xBody), xBody.match(/\n  comms: [^\n]*/)?.[0]?.trim() ?? "no comms field");
  pin("the codex spawn line runs full access — approvals and sandbox bypassed by owner decision 2026-08-12",
    /codex --dangerously-bypass-approvals-and-sandbox/.test(xCode) && !/--sandbox workspace-write/.test(xCode),
    xBody.match(/let cmd = [^\n]*/)?.[0] ?? "no spawn line");
  pin("the codex spawn disables startup update checks through the documented config override",
    (xCode.match(/-c check_for_update_on_startup=false/g) ?? []).length === 2,
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
  // `card` joined the Claude side in 2026-09 and is NOT an unmigrated straggler: it is the one
  // worker whose model is chosen at the call site (CARD_MODEL, a Haiku), and the codex-exec route
  // cannot express a per-call model. Named here so the six read as two different reasons.
  pin("the complete worker route table leaves the five unmigrated workers, plus the per-call card, on Claude",
    JSON.stringify(claudeRoutes) === JSON.stringify([
      "card", "cleanReview", "merge", "refine", "repair", "review",
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
  // RepoWorkerKey — so the two failures this invites are silent in opposite directions: a name in the
  // list with no call site is a setting the owner configures, sees echoed back, and which changes
  // nothing; a call site with no listed name is a resolution nobody can ever reach. The rule is
  // stated as set EQUALITY for that reason, not as one-way coverage.
  const declared = (serverExec.match(/const REPO_WORKER_KEYS: RepoWorkerKey\[\] = \[([^\]]*)\]/)?.[1] ?? "")
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
  // --- EVERY OWNER PROGRAM SUB-ROUTE IS ADMITTED BY THE ROUTER'S OWN ALLOWLIST. The programs
  // handler matches its sub-routes with regexes of its own, but nothing reaches it unless the
  // router's path test lets the URL through first — and that test is a hand-written alternation of
  // names, one function and 3 800 lines away. A door added to the handler without its name in that
  // list compiles, typechecks, passes every pin about its shape, and answers 404 forever. Measured
  // 2026-09-05: the program-dispatch door shipped complete and unreachable, and the FIVE runtime
  // checks that caught it all reported the same "not found" — the cheapest possible signature for
  // the most expensive possible mistake. This is the structural half, so the next door cannot pay
  // for it again.
  const ownerProgFn = serverU.span("async function handleOwnerProgramRoute", "\n}\n")?.text ?? "";
  const gateLine = server.split("\n").find((l) => l.includes("api\\/programs(?:\\/[^/]+\\/(?:")) ?? "";
  const gateNames = (gateLine.match(/\(\?:([a-z|-]+)\)\)\?\$/)?.[1] ?? "").split("|").filter(Boolean);
  const SUB = "/^\\/api\\/programs\\/([^/]+)\\/";
  const declaredSubRoutes: string[] = [];
  for (let at = ownerProgFn.indexOf(SUB); at >= 0; at = ownerProgFn.indexOf(SUB, at + 1)) {
    const end = ownerProgFn.indexOf("$/", at);
    if (end < 0) break;
    for (const name of ownerProgFn.slice(at + SUB.length, end).replace(/^\(|\)$/g, "").split("|"))
      declaredSubRoutes.push(name);
  }
  const unreachable = declaredSubRoutes.filter((n) => !gateNames.includes(n));
  pin("every /api/programs/:id/<sub> route the handler declares is named in the router's allowlist — an unlisted door is a permanent 404",
    ownerProgFn.length > 1000 && gateNames.length >= 8 && declaredSubRoutes.length >= 8
    && unreachable.length === 0,
    JSON.stringify({ declared: declaredSubRoutes, gate: gateNames, unreachable }));
  // --- THE PROGRAM-DISPATCH RECORD HAS EXACTLY ONE WRITER, for the promotion record's reason one
  // record over — a self route that could write it would be a program granting ITSELF the right to
  // have its own released rows started unattended, which is the one shape the record exists to
  // prevent. Same construction: over the source, because on a fleet with no dispatch record — every
  // fleet by default — no runtime probe can see a second writer that simply never fired. Assignment
  // AND deletion, because a revocation written from a second place is the same defect reversed.
  const progDispWrites = [...serverExec.matchAll(/(?:\w+)\.dispatch = |delete (?:\w+)\.dispatch/g)];
  const progDispRouteStart = serverExec.indexOf("const programDispatchRoute = /^");
  const progDispRouteEnd = serverExec.indexOf("const action = /^", progDispRouteStart);
  pin("program.dispatch is written by exactly one route — the owner program-dispatch door, and nothing else",
    progDispWrites.length === 2 && progDispRouteStart > 0 && progDispRouteEnd > progDispRouteStart
    && progDispWrites.every((m) => m.index > progDispRouteStart && m.index < progDispRouteEnd),
    `${progDispWrites.length} write(s): ${progDispWrites.map((m) => m[0]).join(" | ")}`);
  // --- THE RELEASE POLICY (Schnitt 3) IS NEVER READ FROM A SELF BODY. It widens which rows start
  // unattended, so a MAIN that could set it would release its own queue past every card check — the
  // shape the per-row release door exists to keep attended. Three halves over the source, because no
  // runtime probe on a fleet without a policy (every fleet by default) can see a second writer that
  // never fired: (1) `program.release` is written — set AND cleared — only inside the owner route;
  // (2) the one reader of the record is programReleasePolicy, and it reads the PROGRAM, never a
  // request; (3) the hold route, the one self door of this cut, reads no body at all.
  const relWrites = [...serverExec.matchAll(/(?:\w+)\.release = |delete (?:\w+)\.release\b/g)];
  const relRouteStart = serverExec.indexOf("const programReleaseRoute = /^");
  const relRouteEnd = serverExec.indexOf("const action = /^", relRouteStart);
  const relReaders = [...serverExec.matchAll(/\bp\??\.release\b|program\.release\b/g)];
  const relPolicyFn = serverExec.match(/const programReleasePolicy = [\s\S]*?\n\};/)?.[0] ?? "";
  const relPolicyAt = serverExec.indexOf("const programReleasePolicy = ");
  const inside = (at: number | undefined, from: number, to: number): boolean => at !== undefined && at > from && at < to;
  const holdRouteAt = server.indexOf("const selfTaskHold = ");
  const holdRoute = holdRouteAt < 0 ? "" : server.slice(holdRouteAt, server.indexOf("const selfTaskLand", holdRouteAt));
  const holdFnAt = server.indexOf("async function holdTaskForMain(");
  const holdFn = holdFnAt < 0 ? "" : server.slice(holdFnAt, server.indexOf("\n}\n", holdFnAt));
  pin("program.release is written only by the owner release door, read only through programReleasePolicy off the Program record, and the self hold door reads no body",
    relWrites.length === 2 && relRouteStart > 0 && relRouteEnd > relRouteStart
    && relWrites.every((m) => m.index > relRouteStart && m.index < relRouteEnd)
    && /return p\?\.status === "active" && p\.release \? p\.release\.policy : "manual";/.test(relPolicyFn)
    && relReaders.length >= 2
    && relReaders.every((m) => inside(m.index, relPolicyAt, relPolicyAt + relPolicyFn.length) || inside(m.index, relRouteStart, relRouteEnd))
    && holdRoute.length > 0 && /return holdTaskForMain\(s, selfTaskHold\[1\]\);/.test(holdRoute) && !/readJson/.test(holdRoute)
    && holdFn.length > 0 && !/\bbody\b|\breq\b|readJson/.test(holdFn),
    JSON.stringify({ writes: relWrites.map((m) => m[0]), readers: relReaders.length, holdRoute: holdRoute.length, holdFn: holdFn.length }));
  // ...and it is READ through exactly one predicate in the tick. The record's whole meaning is
  // "may the tick start this program's rows under a stopped fleet", and that question is asked in
  // four places (entry guard, per-row master stop, per-program cap, quiet-hours waiver). A second
  // reading of `p.dispatch` inside tickDispatch is how the ACTIVE-program clause silently stops
  // applying to one of them.
  const progDispReads = [...tBody.matchAll(/\.dispatch\b/g)];
  pin("tickDispatch reads Program.dispatch through programDispatchOn/programDispatchCap only — never a second inline read",
    progDispReads.length === 0
    && /const pd = programDispatchOn\(next\);/.test(tBody)
    && /if \(!dispatchOn && !pd\) continue;/.test(tBody),
    `${progDispReads.length} inline read(s) in tickDispatch`);
  // ...and the ACTIVE clause itself: a complete program's leftover queued rows must not keep
  // spawning lanes on a permission granted while it was still running. Both readers carry it —
  // the per-row predicate and the tick's own entry guard, which is the one that decides whether
  // the loop runs at all under a stopped fleet.
  const progDispGrantFn = server.match(/const programDispatchGrant = [^;]+;/)?.[0] ?? "";
  pin("a program-scoped dispatch grant is spent only while the program is ACTIVE — and that clause is written exactly once",
    /p\.status === "active" && p\.dispatch\?\.on \? p\.dispatch : undefined/.test(progDispGrantFn)
    && (server.match(/p\.status === "active" && p\.dispatch\?\.on/g) ?? []).length === 1
    && /return p \? programDispatchGrant\(p\) : undefined;/.test(server)
    && /if \(!dispatchOn && !programs\.some\(programDispatchGrant\)\) return;/.test(tBody),
    progDispGrantFn || "programDispatchGrant missing");
  // ...and the QUIET-HOURS WAIVER is that one named pair and nothing looser: an ACTIVE grant AND a
  // row the MACHINE released. Widening it to "any row of a granted program" would hand an owner's
  // 3am ▸ queue click an unattended lane, which is precisely what the window defers. For a wave the
  // pair holds for EVERY row (Schnitt 2): one owner-released row makes the whole lane an owner act.
  pin("quiet hours are waived for exactly one pair — an active program grant and a machine-released row",
    /const quietWaived = !!pd && rows\.every\(\(row\) => row\.releasedBy === "machine"\);/.test(tBody)
    && /\.\.\.\(quietWaived \? \{ quietHours: false \} : \{\}\)/.test(tBody)
    && /if \(pre\.gate === "quiet-hours"\) continue;/.test(tBody),
    tBody.match(/const quietWaived[^\n]*/)?.[0] ?? "no waiver");
  // ...and the loader degrades a malformed dispatch record to ABSENT rather than repairing it
  // field-wise — loadPromotion's structural half, one record over, and here absence is the byte-for-
  // byte legacy behaviour under the global switch.
  const progDispLoader = serverU.span("const loadProgramDispatch = ", "\n};")?.text ?? "";
  pin("loadProgramDispatch returns undefined on every malformed shape — no field-wise repair of a permission",
    progDispLoader.includes("return undefined;")
    && (progDispLoader.match(/return undefined;/g) ?? []).length >= 5
    && /Object\.keys\(r\)\.some\(\(k\) => !\["v", "on", "maxLanes", "confirmedAt"\]\.includes\(k\)\)/.test(progDispLoader),
    progDispLoader ? `${(progDispLoader.match(/return undefined;/g) ?? []).length} refusals` : "loadProgramDispatch missing");
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
  const promoLoader = serverU.span("const loadPromotion = ", "\n};")?.text ?? "";
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
  const sendLocalProbes = [...sendBody.matchAll(/paneAgentAt\(bound\.paneId, bound\.comms\)/g)].length;
  const sendProbeResolved = /const comms = commsFor\(s\);/.test(sendBody) && sendLocalProbes > 0;
  pin("every slot liveness/readiness probe resolves through commsFor(s), never the fleet-wide set",
    sendProbeResolved && slotProbeArgs.length > 0
      && slotProbeArgs.every((a) => a === "commsFor(s)" || a === "AUTHOR_COMMS"),
    `${sendProbeResolved ? "send-resolved" : "send-unresolved"}: ${slotProbeArgs.join(" | ")}`);
  // Pane output is not readiness: tmux can repaint before the agent prints, and the agent can print
  // before its composer is ready. A separate openedAt guard first answers whether this pane could
  // still be booting; only then may the bounded probe loop run. It retains BOTH outcomes: settle
  // after the transition, or audited fall-through so an owner can still type into a newly opened
  // pane whose agent died. An established dead pane never enters this block and stays immediate.
  const sendCode = sendBody.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  const sendFreshnessGuard = /const mayStillBeBooting = Date\.now\(\) - occupant\.openedAt < SEND_BOOT_FRESH_MS;\s*if \(mayStillBeBooting\) \{\s*if \(bound\.comms\.length > 0\)/.test(sendCode);
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
      && sendBody.includes("const bootSettleMs = form.bootSettleMs ?? DEFAULT_BOOT_SETTLE_MS")
      && sendCode.includes("await Bun.sleep(bound.bootSettleMs)")
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
  // THE LANE MCP PROFILE (Slot.browser, 2026-09-14). A text lane starts without the Playwright MCP;
  // every half of that is string concatenation on a shell line, so no compiler sees it drift. The
  // suites prove the flag reaches a pane (fleet-e2e-claude-gate.ts, e2e/lanes-basic.ts, e2e/restart.ts);
  // these rows hold the SHAPE every future spawn inherits — and the one promise no suite can observe:
  // Fleet switches the profile per launch and never by writing the owner's global plugin settings.
  const acStart = server.indexOf("function agentCmd(");
  const acBody = server.slice(acStart, server.indexOf("\n}\n", acStart));
  const claudeBranch = acBody.slice(acBody.indexOf("if (claude) {"), acBody.indexOf("else if (HARNESS_MODEL_FLAG"));
  const acCode = acBody.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  pin("agentCmd appends --strict-mcp-config exactly once, only on the claude branch, only when browserMcp is off",
    (acCode.match(/--strict-mcp-config/g) ?? []).length === 1
    && /if \(!browserMcp\) cmd \+= " --strict-mcp-config";/.test(claudeBranch),
    `branch=${claudeBranch.length}b`);
  pin("the codex text-lane override is the FULL playwright server definition with enabled=false, single-quoted",
    /\nconst CODEX_TEXT_LANE_MCP = `'mcp_servers\.playwright=\{command="npx",args=\["@playwright\/mcp@latest"\],enabled=false\}'`;\n/.test(server),
    server.match(/const CODEX_TEXT_LANE_MCP = [^\n]*/)?.[0] ?? "no constant");
  const cxStart = server.indexOf("const CODEX_HARNESS: Harness = {");
  const cxCode = (cxStart < 0 ? "" : server.slice(cxStart, server.indexOf("\n};\n", cxStart)))
    .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  // AFTER the fresh/resume ternary, so both forms carry it — one append, not one per form
  const cxTernary = cxCode.indexOf("let cmd = o.resume && o.sessionId");
  const cxAppend = cxCode.indexOf("if (!o.browserMcp) cmd += ` -c ${CODEX_TEXT_LANE_MCP}`;");
  pin("the codex spawn appends the override once, after the fresh/resume choice, only when browserMcp is off",
    cxTernary > 0 && cxAppend > cxTernary && (cxCode.match(/CODEX_TEXT_LANE_MCP/g) ?? []).length === 1,
    `ternary@${cxTernary} append@${cxAppend}`);
  pin("ensureSlot resolves the profile for LANES only — a slot without a worktree keeps its ambient MCPs",
    /browserMcp: !s\.worktree \|\| occupant\.browser \}\)/.test(server), "browserMcp: !s.worktree || occupant.browser");
  const applies = [...server.matchAll(/\n  browserProfile: "(apply|not-applicable|unsupported)",/g)].map((m) => m[1]);
  pin("exactly claude and codex apply the browser profile; the other adapter literals dispose it explicitly",
    applies.filter((a) => a === "apply").length === 2 && applies.length === 6, applies.join(",") || "no browserProfile literal");
  // THE NEGATIVE PROMISE. Code lines only (comments explain these files and may name them). The one
  // config.toml writer that exists is codex's per-path TRUST prelude, and it may append nothing but a
  // `[projects."…"]` table with `trust_level` — no `plugins`, no `mcp_servers`, no `enabled` key.
  const codeLines = server.split("\n").filter((l) => !l.trim().startsWith("//"));
  const settingsJson = codeLines.filter((l) => /settings\.json/.test(l));
  const configToml = codeLines.filter((l) => /config\.toml/.test(l));
  pin("Fleet writes no global plugin settings: no code line names ~/.claude/settings.json",
    settingsJson.length === 0, settingsJson.map((l) => l.trim().slice(0, 80)).join(" | "));
  pin("Fleet writes no global plugin settings: the only config.toml code line is the codex trust prelude",
    configToml.length === 1 && /printf '\\n\[projects\."%s"\]\\ntrust_level = "trusted"\\n'/.test(configToml[0] ?? "")
    && !/plugins|mcp_servers|enabled/.test(configToml[0] ?? ""),
    configToml.map((l) => l.trim().slice(0, 80)).join(" | ") || "no config.toml line");
  pin("Fleet writes no global plugin settings: enabledPlugins is never named in code",
    !codeLines.some((l) => /enabledPlugins/.test(l)), "");
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

{
  // 5c. NO docs/ PATH CITED FROM LIVE CODE IS DEAD — the third success measure of the
  // Generalsanierung, held as a class instead of counted by hand.
  //
  // W2 rewrote 14 dead citations to 0 (docs/sanierung-2026-09/w2-filter.md). A number reached by
  // hand rots the day after it is written: the attic move alone produced 11 of those 14, and the
  // next move produces the next batch. A reader sent at a path that does not exist learns nothing
  // and — worse — reads the absence as "this was never written down".
  //
  // THE FILTER IS THE ONE W2 NOTED BEFORE COUNTING, verbatim (w2-filter.md §"Das Kommando"), and
  // that matters: "12 dead paths" was not derivable because every filter gave a different number
  // (11-16, and 56 with the e2e fixtures). Source set = tracked *.ts and *.sh across the WHOLE
  // tree, minus `e2e/` (fixtures and test texts name non-existent paths ON PURPOSE) and minus
  // `attic/` (archived code keeps its historical state). Same filter here as there, or the
  // success measure would be measuring something else than the thing it closed.
  //
  // Two rows, not one: a scan that could not run must fail as ITSELF. `git grep` exits 1 on "no
  // matches", which is indistinguishable from "the pathspec found no files" — and an empty corpus
  // yields zero dead paths, i.e. green, having measured nothing.
  const RULE_DOCPATH = "no docs/ path cited from live code is dead";
  const CITED = /docs\/[A-Za-z0-9._/-]+\.md/g;
  const grep = spawnSync("git",
    ["-C", ROOT, "grep", "-nIE", "--", CITED.source, "*.ts", "*.sh", ":!e2e/*", ":!attic/*"],
    { encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" }, maxBuffer: 16 * 1024 * 1024 });
  const scanned = grep.error || grep.status === null || grep.status > 1
    ? null : grep.stdout.split("\n").filter(Boolean);
  // first sighting wins: the detail names ONE place to go, not every echo of the same path
  const sightings = new Map<string, string>();
  for (const line of scanned ?? []) {
    const where = /^(.+?:\d+):/.exec(line)?.[1];
    if (!where) continue;
    for (const m of line.matchAll(CITED)) if (!sightings.has(m[0])) sightings.set(m[0], where);
  }
  pin(`${RULE_DOCPATH} — the citation scan ran and its source set is not empty`,
    scanned !== null && sightings.size > 0,
    scanned === null
      ? (grep.error?.message || grep.stderr || `git grep exited ${String(grep.status)}`).trim().slice(0, 160)
      : `${sightings.size} distinct docs/ path(s) cited in ${new Set([...sightings.values()].map((w) => w.split(":")[0])).size} file(s)`);
  const dead = [...sightings].filter(([path]) => !exists(path));
  pin(RULE_DOCPATH,
    scanned !== null && sightings.size > 0 && dead.length === 0,
    dead.length > 0
      ? `${dead.length} dead: ${dead.map(([path, where]) => `${path} (${where})`).join(", ")}`
      : `${sightings.size} citation(s) checked, all resolve`);
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
  const client = clientU.text;
  // bounded to the declaration's OWN module and its OWN braces: a `status:` found further down a
  // joined universe would be some other row's field, read as this one's union.
  const cliRow = clientU.span("interface FleetEventRow {", "\n}", 2);
  const cliBody = cliRow?.text ?? "";
  const cliStatus = cliBody.indexOf("status:");
  const cliWords = cliStatus >= 0 ? words(cliBody.slice(cliStatus, cliBody.indexOf(";", cliStatus))) : [];
  pin("the client's FleetEventRow status union is the same SET of words as the server's FleetEventStatus",
    cliRow !== null && cliStatus >= 0 && srvWords.length >= 6 && srvWords.join("|") === cliWords.join("|"),
    cliRow === null ? "anchor not found in the client universe: interface FleetEventRow"
      : cliStatus < 0 ? `no status field in FleetEventRow (${cliRow.file})`
        : `server=[${srvWords.join(",")}] client=[${cliWords.join(",")}]`);

  const recoveryBody = server.slice(server.indexOf("async function recoverFleetReportDelivery("),
    server.indexOf("async function tickWatches("));
  const receiverGuardBody = server.slice(server.indexOf("function receiverStillMatchesFleetEvent("),
    server.indexOf("function terminalizeFleetReportRecovery("));
  const receiverIsBody = server.slice(server.indexOf("function fleetEventReceiverIs("),
    server.indexOf("function fleetEventReceiver(e: FleetEvent)"));
  const recoveryLatch = recoveryBody.indexOf("await waitForFleetReportRecoveryTestLatch(event, expected);");
  const recoveryGuard = recoveryBody.indexOf("receiverStillMatchesFleetEvent(event, receiver, expected)");
  const recoverySend = recoveryBody.indexOf("await sendText(receiver, text, true, { rollbackOwnPayload: true })");
  const nonAcceptanceBody = server.slice(server.indexOf("function recordFleetReportNonAcceptance("),
    server.indexOf("function receiverStillMatchesFleetEvent("));
  pin("fleet-report recovery is bounded to rollback-cleared rows and rechecks exact receiver identity before resend",
    recoveryBody !== "" && /event\.status !== "send-uncertain" \|\| event\.recovery\?\.state !== "retryable"/.test(recoveryBody)
      && nonAcceptanceBody.includes('if (rollback !== "cleared") {')
      && nonAcceptanceBody.includes("if (fleetReportRecoveryExhausted(event)) {")
      && recoveryBody.includes('recordFleetReportNonAcceptance(event, e instanceof SendNotAccepted ? e.rollback : null, "recovery")')
      && receiverGuardBody.includes("event.receiverOpenedAt === expected.openedAt")
      && receiverGuardBody.includes("s.openedAt === expected.openedAt")
      && receiverGuardBody.includes("s.sessionId === expected.sessionId")
      // the session-id half is the ONE receiver predicate every event door shares (66df05b4): exact,
      // or null minted before this occupation's recorded learn of exactly its current id
      && receiverGuardBody.includes("fleetEventReceiverIs(event, s)")
      && receiverIsBody.includes("e.receiverOpenedAt !== s.openedAt")
      && receiverIsBody.includes("if (e.receiverSessionId === s.sessionId) return true;")
      && receiverIsBody.includes("e.receiverSessionId === null && learned !== null && s.sessionId === learned.id")
      && receiverIsBody.includes("e.createdAt <= learned.at")
      && recoveryLatch >= 0 && recoveryGuard > recoveryLatch && recoverySend > recoveryGuard
      && recoveryBody.includes("terminalizeFleetReportRecovery(event,")
      && server.includes('event.status = "receiver-gone";') && !recoveryBody.includes("selfLandTaskForMain("),
    recoveryBody === "" ? "recoverFleetReportDelivery not found"
      : JSON.stringify({ latch: recoveryLatch, guard: recoveryGuard, send: recoverySend }));

  // THE FIVE UNATTENDED SENDERS AND THE ROLLBACK, pinned by NAME. Measured 2026-09-09/10
  // (docs/messungen/2026-09-10-gegencheck-datenschichten-glm.md §2 B1): these five called sendText
  // without the flag and threw the acceptance value away, so an unaccepted paste STAYED in the
  // composer and blocked that channel for every later sender (one live case: 1x "prompt not
  // accepted — still holds 49 chars", then 8x "composer occupied (49 chars)" over thirteen
  // minutes), while `s.quietUntil` — set only under the flag — left Fleet's own failed paste
  // counted as occupant OUTPUT in the very idle measurement the retry consults.
  //
  // Two rows on purpose. The first is the PROBE's own precondition: a renamed or moved sender must
  // fail as "this pin could not locate its subject", never as "that sender lost its rollback" —
  // and never silently as a body of "" whose `includes` are all trivially false.
  const unattendedSenders = ["tickAuditPing", "tickInboxNudge", "tickBacklogNudge", "tickMigrate",
    "deliverMergeVerdict"] as const;
  const senderBodies = unattendedSenders.map((name) => ({
    name, body: serverU.span(`async function ${name}(`, "\n}\n", 2)?.text ?? "" }));
  const unlocatable = senderBodies.filter((s) => s.body.length < 200 || !s.body.trimEnd().endsWith("}"));
  pin("rollback pin precondition: all five unattended sendText callers are locatable as whole bodies in the server universe",
    unlocatable.length === 0,
    unlocatable.length === 0 ? `${senderBodies.map((s) => `${s.name}=${s.body.length}B`).join(" ")}`
      : `not locatable: ${unlocatable.map((s) => `${s.name}(${s.body.length}B)`).join(", ")}`);
  // …and the rule itself: the flag AND the journal word, per sender. `delivery` is what makes the
  // failing path readable at all — before this cut prompts.jsonl held 3 120 auto lines and not one
  // of them carried a delivery state, so a paste that never landed was indistinguishable from a
  // delivered one in the only file that records what Fleet typed.
  const senderGaps = senderBodies.filter((s) => s.body.length >= 200
    && !(/await sendText\([^)]*\{ rollbackOwnPayload: true \}\)/.test(s.body)
      && s.body.includes("sendFailureDelivery(e)")
      && /logPrompt\([^;]*undefined, acceptance\)/.test(s.body)));
  pin("every unattended sendText caller passes rollbackOwnPayload and journals its delivery — the acceptance value when it lands, the failure class when it does not",
    unlocatable.length === 0 && senderGaps.length === 0
      && server.includes('if (e instanceof SendRefused) return "SendRefused";')
      && server.includes('if (e instanceof SendNotAccepted) return "SendNotAccepted";')
      && server.includes('  sendId?: string, delivery?: PromptDelivery): void {'),
    senderGaps.length ? `missing rollback and/or delivery: ${senderGaps.map((s) => s.name).join(", ")}`
      : unlocatable.length ? "precondition failed above" : `${senderBodies.length} senders`);

  // THE CAP AND ITS STATE WORD live in three places with no compiler between them: the env default
  // in server.ts, the documented default and state name in docs/self-api.md, and the recovery union
  // the client renders. Measured 2026-09-01 (FleetEvent 8ca8c38e…): unbounded because nothing
  // compared `attempts` to anything; the comparison is one expression, and this pins that it exists,
  // that the docs name the same default, and that the tickWatches first-attempt path and the
  // recovery path write through the same recorder (a second writer would be a second, uncapped loop).
  const capDefault = server.match(/const raw = Number\(process\.env\.FLEET_REPORT_RECOVERY_MAX_ATTEMPTS \?\? (\d+)\);/)?.[1] ?? "";
  const capFallback = server.match(/return Number\.isInteger\(raw\) && raw >= 1 \? raw : (\d+);/)?.[1] ?? "";
  const selfApiCap = read("docs/self-api.md");
  const docsCapDefault = selfApiCap.match(/`FLEET_REPORT_RECOVERY_MAX_ATTEMPTS` \(Default (\d+),/)?.[1] ?? "";
  const tickBody = server.slice(server.indexOf("async function tickWatches("), server.indexOf("async function tickWatches(") + 20000);
  pin("fleet-report recovery cap: FLEET_REPORT_RECOVERY_MAX_ATTEMPTS defaults to 5 in server.ts and docs/self-api.md, blocks by name, and both non-acceptance paths share one recorder",
    capDefault === "5" && capFallback === "5" && docsCapDefault === "5"
      && server.includes("const fleetReportRecoveryExhausted = (event: FleetReportFleetEvent): boolean =>\n  event.attempts >= FLEET_REPORT_RECOVERY_MAX_ATTEMPTS;")
      && selfApiCap.includes('recovery.state:"blocked"') && selfApiCap.includes("NIE wieder gepastet")
      && selfApiCap.includes("manual receiver acknowledgement if the pane text was read, or MAIN/owner intervention")
      && server.includes('"manual receiver acknowledgement if the pane text was read, or MAIN/owner intervention"')
      && tickBody.includes('recordFleetReportNonAcceptance(event, e instanceof SendNotAccepted ? e.rollback : null, "transport")')
      && recoveryBody.includes("if (fleetReportRecoveryExhausted(event)) {")
      // after the send, only the recorder decides a NON-acceptance: the one direct `retryable`
      // write left there is the pre-paste refusal (nothing typed, count rolled back), never a paste
      && (recoveryBody.slice(recoverySend).match(/setFleetReportRecovery\(event, "retryable"/g)?.length ?? 0) === 1
      && recoveryBody.slice(recoverySend).includes('"recovery send was refused before Fleet typed its payload"')
      && !tickBody.includes('setFleetReportRecovery(event, "retryable"'),
    JSON.stringify({ capDefault, capFallback, docsCapDefault }));
  // THE HOLD BACKOFF (K1, 2026-09-11) lives in three places with no compiler between them: the
  // schedule in server.ts, the tick counts docs/self-api.md promises a waiting session, and the
  // two send paths that must read ONE gate and write through ONE writer. A second writer would be
  // a second, unbounded retry loop — the same failure the recovery cap above pins against — and a
  // doc that names a different ceiling would promise a silence the server does not keep.
  const holdBody = server.slice(server.indexOf("const holdOccupant = (s: Slot): string =>"),
    server.indexOf("async function recoverFleetReportDelivery("));
  const holdBase = server.match(/const HOLD_BACKOFF_BASE_MS = AUTOS_TICK_MS \* (\d+);/)?.[1] ?? "";
  const holdMax = server.match(/const HOLD_BACKOFF_MAX_MS = AUTOS_TICK_MS \* (\d+);/)?.[1] ?? "";
  const selfApiHold = read("docs/self-api.md");
  const docsHoldBase = selfApiHold.match(/wartet der Server deshalb \*\*(\d+) Ticks\*\*/)?.[1] ?? "";
  const docsHoldMax = selfApiHold.match(/bis zur Decke von \*\*(\d+) Ticks\*\*/)?.[1] ?? "";
  const holdTickGate = tickBody.indexOf("if (composerHoldActive(event, s, Date.now())) continue;");
  const holdTickCanDeliver = tickBody.indexOf("const verdict = await canDeliver(s, {");
  const holdRecoveryGate = recoveryBody.indexOf("if (composerHoldActive(event, receiver, Date.now())) return false;");
  const holdRecoveryCanDeliver = recoveryBody.indexOf("const verdict = await canDeliver(receiver, {");
  pin("hold backoff: one schedule (2 ticks, ceiling 12) in server.ts and docs/self-api.md, one gate read before canDeliver on BOTH send paths, one writer",
    holdBase === "2" && holdMax === "12" && docsHoldBase === holdBase && docsHoldMax === holdMax
      && holdTickGate > 0 && holdTickCanDeliver > holdTickGate
      && holdRecoveryGate > 0 && holdRecoveryCanDeliver > holdRecoveryGate
      // exactly one writer of a hold row, and both refusal arms go through it
      && (server.match(/audit\("fleet_event_held"/g)?.length ?? 0) === 2
      && (holdBody.match(/audit\("fleet_event_held"/g)?.length ?? 0) === 2
      && tickBody.includes("noteComposerHold(event, s, e.message);")
      && recoveryBody.includes("const held = noteComposerHold(event, receiver, `recovery ${e.message}`);")
      // …and the retry time rides the EXISTING recovery prose, not a new persisted field
      && recoveryBody.includes('"recovery send was refused before Fleet typed its payload"\n        + held.note,')
      && holdBody.includes("return { holds: row.holds, waitMs, note: ` (hold ${row.holds}, next probe in ${waitMs}ms)` };"),
    JSON.stringify({ holdBase, holdMax, docsHoldBase, docsHoldMax,
      tickGateBeforeCanDeliver: holdTickGate > 0 && holdTickCanDeliver > holdTickGate,
      recoveryGateBeforeCanDeliver: holdRecoveryGate > 0 && holdRecoveryCanDeliver > holdRecoveryGate,
      writers: server.match(/audit\("fleet_event_held"/g)?.length ?? 0 }));

  // THE STOPLINE, pinned as a property of the block rather than as a promise: the backoff is a
  // process-local DELAY. It may not touch a row's status, may not persist anything, and may not
  // spend an attempt — so a reset or an elapsed timer can never turn `send-uncertain` into
  // `delivered`, which is the one way a retry thinner could invent a delivery that never happened.
  pin("hold backoff: the backoff block writes no row state, persists nothing and spends no attempt",
    holdBody.length > 500
      && !/\bstatus = /.test(holdBody) && !holdBody.includes("saveState")
      && !holdBody.includes("attempts") && !holdBody.includes("deliveredAt")
      && !holdBody.includes("sendText") && holdBody.includes("const composerHolds = new Map<string, ComposerHold>();")
      // the occupant triple IS the key, so a recycled receiver cannot inherit a dead one's wait
      && holdBody.includes("const holdOccupant = (s: Slot): string => `${s.id}:${s.openedAt}:${s.sessionId ?? \"\"}`;")
      && holdBody.includes("if (row.occupant !== holdOccupant(s)) {")
      && holdBody.includes('clearComposerHold(event.id, event.receiverSlot, "hold ended — the receiver occupant was replaced");'),
    JSON.stringify({ bytes: holdBody.length, status: /\bstatus = /.test(holdBody),
      save: holdBody.includes("saveState"), attempts: holdBody.includes("attempts") }));

  // THE OWN-PASTE WINDOW: an event-transport send opens quietUntil at the paste and closes it to a
  // tail when the send resolves, so neither the paste, the acceptance read nor the rollback repaint
  // stamps lastOutput. Without it every recovery paste re-armed the receiver's idle gate for every
  // other pending event of that pane (the starvation half of the same measurement).
  const sendBodyForQuiet = server.slice(server.indexOf("async function sendText("), server.indexOf("function commsFor("));
  pin("fleet-report transport: an own-payload send covers its paste, acceptance read and rollback with quietUntil and cuts it to a tail on resolve",
    sendBodyForQuiet.indexOf("s.quietUntil = Date.now() + OWN_PASTE_QUIET_MS;") > 0
      && sendBodyForQuiet.indexOf("s.quietUntil = Date.now() + OWN_PASTE_QUIET_MS;")
        < sendBodyForQuiet.indexOf('const pb = await tmux("paste-buffer"')
      && sendBodyForQuiet.includes("if (ownPasteQuiet) s.quietUntil = Date.now() + OWN_PASTE_QUIET_TAIL_MS;")
      && sendBodyForQuiet.indexOf("if (ownPasteQuiet) s.quietUntil") > sendBodyForQuiet.indexOf("} finally {")
      // The gate this depends on, in its post-2026-09-05 shape: the window still vetoes the
      // REFRESH — which is the starvation half above — and no longer vetoes the transition out of
      // `lastOutput === 0`, because "never seen" is a different fact from "last seen at T"
      // (e2e/slots.ts measures that half against a live pane).
      && server.includes("if (Date.now() > s.quietUntil || s.lastOutput === 0) s.lastOutput = Date.now();"),
    JSON.stringify({ open: sendBodyForQuiet.indexOf("OWN_PASTE_QUIET_MS"), tail: sendBodyForQuiet.indexOf("OWN_PASTE_QUIET_TAIL_MS") }));

  const selfApiForRecovery = read("docs/self-api.md");
  pin("fleet-report send-uncertain records current recovery state for the Operations panel and docs",
    selfApiForRecovery.includes('recovery.state:"retryable"') && selfApiForRecovery.includes("rollback=cleared")
      && selfApiForRecovery.includes("dieselbe `FleetEvent.id`")
      && client.includes("e.recovery?.state")
      && client.includes("next: ${e.recovery.nextAction}")
      && client.includes("reason: ${e.recovery.reason}")
      && client.includes("effect: ${e.recovery.effect}"),
    JSON.stringify({
      docs: selfApiForRecovery.includes('recovery.state:"retryable"') && selfApiForRecovery.includes("rollback=cleared"),
      clientRecovery: client.includes("e.recovery?.state"),
    }));

  // THE PERSISTED PROGRAM-MAIN LINEAGE (2026-09-02): its cap and its state names are typed once in
  // server.ts and documented once in docs/self-api.md §authority.lineage, and a successor reads the
  // docs to interpret the record — so the two must agree on the number, on every `via`/`endedBy`
  // name, and on the two unknown sentences the view renders. A renamed state or a moved cap that
  // the docs did not follow would make the documented reading of a persisted history wrong.
  {
    const selfApiLineage = read("docs/self-api.md");
    const lineageDoc = selfApiLineage.slice(selfApiLineage.indexOf("### `authority.lineage`"));
    const lineageCap = server.match(/^const PROGRAM_LINEAGE_MAX = (\d+);/m)?.[1] ?? "";
    const docsLineageCap = lineageDoc.match(/`PROGRAM_LINEAGE_MAX` \((\d+)\)/)?.[1] ?? "";
    const unionNames = (line: RegExp): string[] =>
      [...(server.match(line)?.[1] ?? "").matchAll(/"([a-z-]+)"/g)].map((m) => m[1] ?? "");
    const via = unionNames(/^type ProgramLineageVia = (.+);$/m);
    const endedBy = unionNames(/^type ProgramLineageEndedBy = (.+);$/m);
    const absentLine = "1 lineage gap: no persisted Program-MAIN lineage exists; earlier bound sessions of this program are not reconstructible.";
    pin("Program-MAIN lineage: the cap (50) and every via/endedBy state name in server.ts are the ones docs/self-api.md §authority.lineage documents, and the unknown sentences match",
      lineageCap === "50" && docsLineageCap === "50"
        && via.length === 4 && endedBy.length === 4
        && [...via, ...endedBy].every((name) => lineageDoc.includes(`| \`${name}\` |`))
        && server.includes(`"${absentLine}"`) && lineageDoc.includes(absentLine)
        && server.includes("`1 lineage gap: lineage begins at ${p.lineage.entries[0].boundAt}; earlier bound sessions are not reconstructible.`")
        && lineageDoc.includes("1 lineage gap: lineage begins at <boundAt>; earlier bound sessions are not reconstructible.")
        && server.includes("oldest lineage entries were dropped at the cap of ${PROGRAM_LINEAGE_MAX}; those bound sessions are not reconstructible.")
        && lineageDoc.includes("oldest lineage entries were dropped at the cap of 50; those bound sessions are not reconstructible."),
      JSON.stringify({ lineageCap, docsLineageCap, via, endedBy, docFound: lineageDoc.length > 0 }));
  }
}

// --- STALENESS WAS ONE RULE, RENDERED BY TWO READERS, and both readers retired with the queue
// analyst on 2026-09-10. The rule (analysis-staleness.ts) decided whether a verdict was still about
// today's tree by intersecting what a land MOVED with the row's own file surface; register.sh
// rendered the same intersection in Python so the two could not drift. Four pins held them equal.
//
// What replaces them is a NEGATIVE: neither reader may come back on its own. A re-grown `!head` arm
// in register.sh would be a second meaning of "stale" with nothing on the server side to agree
// with, which is precisely the drift those four pins were paid for.
{
  const reg = read("register.sh");
  const regCode = reg.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
  pin("register.sh renders no verdict staleness and derives no moved surface of its own",
    !regCode.includes("moved_since") && !regCode.includes("MAINSHA")
      && !/git diff --name-only --no-renames/.test(regCode)
      && !regCode.includes('"analysis"') && !regCode.includes("collides"),
    "");
  // …and it still renders the THREE provenance states, which is the half of that section the
  // retirement does not touch: an unknown surface is not an empty one, before and after.
  pin("register.sh still separates confirmed, derived and UNKNOWN surface provenance",
    reg.includes("[bestätigt/mechanisch]") && reg.includes("[abgeleitet]") && reg.includes("UNBEKANNT"),
    "");
}

pin("e2e-isolated.sh explicitly arms server.ts's default-off migration tick (otherwise its runtime checks measure nothing)", /const MIGRATE_PCT = Number\(process\.env\.FLEET_MIGRATE_PCT \?\? 0\) \| 0/.test(server) && /\bFLEET_MIGRATE_PCT=[1-9]\d*\b/.test(read("e2e-isolated.sh")));
// …and the LANE rail's own threshold beside it. This one is not default-off (40), so the wrapper
// does not have to arm it for the fixture to fire — which is exactly why it is pinned: a later
// change of that default to 0 would otherwise turn the lane half of the migration block into a
// silent no-measurement instead of a failure.
pin("e2e-isolated.sh arms the LANE migration threshold explicitly, so the lane baton is measured and not merely defaulted into", /const LANE_MIGRATE_PCT = Number\(process\.env\.FLEET_LANE_MIGRATE_PCT \?\? 40\) \| 0/.test(server) && /\bFLEET_LANE_MIGRATE_PCT=[1-9]\d*\b/.test(read("e2e-isolated.sh")));

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
  // …AND BOTH ARE BEHIND THE FOLLOWER'S LOCK (dual-host S2, 2026-09-05). `FLEET_LANDS=0` makes this
  // instance one that fast-forwards a canonical main instead of writing one, and the guarantee it
  // owes is not "the click is refused" but "no land record exists": no job, no mergeLast, no
  // lane-outcomes line, no fleet/land note. That is a property of WHERE the guard sits, which no
  // runtime check can see — a guard moved three lines down, below `mergeStart.add` or below the
  // route's first git read, still answers 409 and still leaves a trace. So the position is pinned
  // textually: per door, the refusal appears AFTER the door opens and BEFORE that door's mergeJob
  // call. The two doors are asserted separately rather than as one interleaving, because the
  // self-land handler sits far above the owner route in the file and their order is not a property
  // worth freezing.
  const guardLine = "if (!LANDS_ENABLED) return json({ error: LANDS_LOCKED }, 409);";
  const guards = lines.map((line, i) => ({ line, n: i }))
    .filter(({ line }) => line.includes(guardLine) && !line.trim().startsWith("//"));
  const ownerGuard = guards.find((gd) => ownerRoute >= 0 && gd.n > ownerRoute
    && !!ownerCall && gd.n < ownerCall.n);
  const selfGuard = guards.find((gd) => selfHandler >= 0 && gd.n > selfHandler
    && !!selfCall && gd.n < selfCall.n);
  pin(`${RULE_LAND} — exactly two FLEET_LANDS guards, one per door, each above its own mergeJob call`,
    guards.length === 2 && !!ownerGuard && !!selfGuard && ownerGuard.n !== selfGuard.n,
    `guards=[${guards.map((gd) => gd.n + 1).join(",")}] ownerGuard=${(ownerGuard?.n ?? -1) + 1} selfGuard=${(selfGuard?.n ?? -1) + 1}`);
  // …and the owner door's guard is above the FIRST thing that door writes. `mergeStart.add` is that
  // line by name (the reservation taken before the first await), and it is the cheapest proof that
  // the refusal costs no state: everything the route does after it is downstream of that reservation.
  const mergeStartAdd = lines.findIndex((l, i) => i > ownerRoute && l.includes("mergeStart.add("));
  pin(`${RULE_LAND} — the ⏫ door's lock is asked before the route reserves anything`,
    !!ownerGuard && mergeStartAdd > ownerGuard.n,
    `guard=${(ownerGuard?.n ?? -1) + 1} mergeStart.add=${mergeStartAdd + 1}`);
  // …and the sentence itself is ONE constant, not two string literals that can drift apart. Both
  // doors answer a follower's caller identically, and docs/e2e quote it.
  pin(`${RULE_LAND} — the refusal is one shared constant with the canonical-main wording`,
    /const LANDS_LOCKED = "this instance does not land — it follows a canonical main";/.test(server)
      && server.split("this instance does not land").length - 1 === 1,
    `LANDS_LOCKED occurrences of the sentence: ${server.split("this instance does not land").length - 1}`);
  // …and the switch defaults OPEN. A fail-closed reading of an unset or unrecognised value would
  // strand the canonical host on a typo, which is the one outcome worse than a follower landing once.
  pin(`${RULE_LAND} — FLEET_LANDS defaults to landing and only 0/off/false/no closes it`,
    /const LANDS_ENABLED = !LANDS_OFF_RE\.test\(LANDS_RAW\);/.test(server)
      && /const LANDS_OFF_RE = \/\^\(0\|off\|false\|no\)\$\/i;/.test(server),
    JSON.stringify({ derived: /const LANDS_ENABLED = !LANDS_OFF_RE\.test\(LANDS_RAW\);/.test(server) }));
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
  // --- THE HUB PUSH IS FF-ONLY, OFF BY DEFAULT, AND CANNOT UNDO A LAND (W5b, topology §6) -------
  // Three properties, none of them visible to a compiler. (1) Absence is OFF: an unset
  // FLEET_HUB_REMOTE means no push AND no note field — a default remote name would push the
  // owner's history somewhere nobody chose. (2) The push is a plain non-force push of the LANDED
  // sha: `--force` anywhere in that line would turn the nabe's one arbitration rule (fast-forward
  // or nothing) into a silent overwrite of the other host's work. (3) It runs BEFORE the note, or
  // the note could not carry its outcome and the only record of a refused push would be nowhere.
  const hubPushBody = server.slice(server.indexOf("async function pushLandToHub("),
    server.indexOf("\n}", server.indexOf("async function pushLandToHub(")));
  pin(`${RULE_LAND} — the hub push is opt-in by env, ff-only, and pushes the landed sha with its own timeout`,
    /const HUB_REMOTE = \(process\.env\.FLEET_HUB_REMOTE \?\? ""\)\.trim\(\);/.test(server)
      && /const HUB_PUSH_TIMEOUT_MS = 60_000;/.test(server)
      && hubPushBody.includes("if (!HUB_REMOTE) return null;")
      && hubPushBody.includes('"git", "-C", repo, "push", HUB_REMOTE, `${mainAfter}:refs/heads/${main}`')
      && !/--force/.test(hubPushBody)
      && hubPushBody.includes("}, HUB_PUSH_TIMEOUT_MS);"),
    JSON.stringify({ env: /FLEET_HUB_REMOTE/.test(server), body: hubPushBody.length,
      forced: /--force/.test(hubPushBody) }));
  // …and the land is never the casualty: every exit of the push is a FIELD. The push sits between
  // the land_actor row and the note write in recordLand — the one choke point every main-MOVING
  // land funnels through, which is what makes the clean auto-land, the confirm-land and the boot
  // recovery reach the hub by the same door.
  const recordBody = server.slice(server.indexOf("async function recordLand("),
    server.indexOf("\n}", server.indexOf("async function recordLand(")));
  const pushAt = recordBody.indexOf("const hubPush = await pushLandToHub(repo, main, mainAfter);");
  pin(`${RULE_LAND} — the push runs at the land choke point, before the note, and only ever answers with a field`,
    pushAt > recordBody.indexOf('audit("land_actor"')
      && pushAt < recordBody.indexOf("await writeLandNote(")
      && recordBody.includes("hubPush ? { ...prov, hubPush } : prov")
      && (hubPushBody.match(/ok: false, remote: HUB_REMOTE/g) ?? []).length === 2
      && !/throw /.test(hubPushBody)
      && /\n      \.\.\.\(prov\.hubPush \? \{ hubPush: prov\.hubPush \} : \{\}\),/.test(noteWriter)
      && /\n  hubPush\?: HubPushResult;/.test(provDecl),
    JSON.stringify({ pushAt, note: recordBody.indexOf("await writeLandNote("),
      redExits: (hubPushBody.match(/ok: false, remote: HUB_REMOTE/g) ?? []).length }));
  // …and the owner's graph follows the moved main (Worktrail IV §3.5, Owner 2026-09-13), from the
  // same choke point and with none of the land's weight: not awaited, no suite lock, and only ever
  // in the PRIMARY checkout that holds main — a graphify-out/ in a lane blocks its land
  // (buildCodeGraph's comment). `graphify watch` and git hooks stay buried
  // (docs/work-register-2026-08-06.md §7), so neither verb may appear in the step's bodies.
  const graphRebuild = serverU.span("async function rebuildMainCheckoutGraph(", "\n}\n")?.text ?? "";
  const graphSchedule = serverU.span("function scheduleMainGraphRebuild(", "\n}\n")?.text ?? "";
  const graphBodies = graphRebuild + graphSchedule;
  const graphSpawnAt = graphRebuild.indexOf('runGraphStep(["graphify", ".", "--code-only"], holder.path)');
  pin(`${RULE_LAND} — a moved main rebuilds the graph code-only in the PRIMARY checkout, coalesced, unawaited, lock-free, never watch or hooks`,
    graphSpawnAt > 0
      && graphRebuild.indexOf("if (!holder.primary)") > 0 && graphRebuild.indexOf("if (!holder.primary)") < graphSpawnAt
      && graphRebuild.indexOf('"check-ignore", "-q", "graphify-out/"') > 0 && graphRebuild.indexOf('"check-ignore", "-q", "graphify-out/"') < graphSpawnAt
      && (graphRebuild.match(/runGraphStep\(/g) ?? []).length === 1
      && !/\bwatch\b|hook|\.git\/|SUITE_LOCK|holdSuiteLock|\bthrow\b/.test(graphBodies.replace(/^\s*\/\/.*$/gm, ""))
      && graphSchedule.includes("if (mainGraphRunning) { mainGraphAgain = { repo, main }; return; }")
      && recordBody.includes("\n  scheduleMainGraphRebuild(repo, main);\n")
      && !/await scheduleMainGraphRebuild/.test(server)
      && (server.match(/scheduleMainGraphRebuild\(/g) ?? []).length === 2,
    JSON.stringify({ rebuild: graphRebuild.length, schedule: graphSchedule.length, spawnAt: graphSpawnAt,
      callers: (server.match(/scheduleMainGraphRebuild\(/g) ?? []).length - 1 }));
  // …and the CHANNEL is READ, not guessed. `tokenChannel` mirrors tokenFrom's own precedence
  // (bearer → cookie → query); if the two ever disagree the suspect flag would be stamped on the
  // wrong requests and nothing at runtime would notice. Asserted as "both read the same three
  // sources in the same order" rather than by comparing bodies, which would break on a reformat.
  const chanBody = server.slice(server.indexOf("function tokenChannel("),
    server.indexOf("\n}", server.indexOf("function tokenChannel(")));
  // tokenFrom moved to server/auth.ts in the P4 auth slice, so its body is cut with span() —
  // a raw slice would run from that module's anchor to the first `\n}` in server.ts.
  const fromSpan = serverU.span("function tokenFrom(", "\n}");
  const fromBody = fromSpan?.text ?? "";
  const tokenOrder = (b: string): string[] =>
    [...b.matchAll(/authorization|fleet=|searchParams\.get\("token"\)/g)].map((m) => m[0]);
  pin(`${RULE_LAND} — tokenChannel reads the SAME three token sources in the SAME order tokenFrom accepts them`,
    fromSpan !== null && tokenOrder(chanBody).length === 3
    && JSON.stringify(tokenOrder(chanBody)) === JSON.stringify(tokenOrder(fromBody)),
    JSON.stringify({ channel: tokenOrder(chanBody), from: tokenOrder(fromBody), fromIn: fromSpan?.file ?? null }));
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
    "deploy-terminal", "command-job", "lane-suite", "clarification-request", "fleet-report",
    "supervisor-transition", "harness-block", "lane-review"].sort();
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
  pin(`${RULE_KINDS} — the interfaces yield exactly the twelve known kinds`,
    JSON.stringify(got) === JSON.stringify(expected), `[${got.join(",")}]`);
  pin(`${RULE_KINDS} — every union member is one of those interfaces (no kind enters off-list)`,
    union.length > 0 && union.every((m) => new RegExp(`interface ${m} extends FleetEventBase \\{`).test(server)),
    `[${union.join(",")}]`);
}

// --- THE LOST FAST-FORWARD IS A TYPED FACT, NOT A SENTENCE. `errorReason` is the ONE field on a
// merge verdict that can make a lane done-looking again, and its whole value is that it does NOT
// live in prose: the day somebody rewords `detail` ("rebase ok, but fast-forwarding main failed"),
// a predicate that had parsed it would silently re-block every Program-MAIN's re-land — exactly
// the failure this fastens against. Three directions, because each drifts on its own.
{
  const RULE_FF = "the lost fast-forward is a closed typed fact";
  const signals = read("lane-signals.ts");
  const selfApiFf = read("docs/self-api.md");
  const reasons = (signals.match(/export type MergeErrorReason =([^;\n]+)/)?.[1] ?? "")
    .split("|").map((w) => w.trim().replace(/"/g, "")).filter(Boolean);
  // both directions: every name in the code is documented, and the doc invents none. The doc's
  // side is read out of its own fenced/inline `errorReason` mentions rather than a prose scan, so
  // a paragraph that merely says the words cannot stand in for naming the value.
  const documented = [...selfApiFf.matchAll(/errorReason"?\s*:\s*"([a-z-]+)"/g)].map((m) => m[1] ?? "");
  pin(`${RULE_FF} — every MergeErrorReason is named in docs/self-api.md §land, and the doc invents none`,
    reasons.length > 0 && reasons.every((r) => documented.includes(r))
      && documented.every((d) => reasons.includes(d)),
    `code=[${reasons.join(",")}] doc=[${[...new Set(documented)].join(",")}]`);
  // the enum's runtime twin must list exactly the type's members — a loader validating against a
  // shorter list would silently drop a reason the writer is still minting
  const listed = (signals.match(/MERGE_ERROR_REASONS: readonly MergeErrorReason\[\] = \[([^\]]*)\]/)?.[1] ?? "")
    .split(",").map((w) => w.trim().replace(/"/g, "")).filter(Boolean);
  pin(`${RULE_FF} — MERGE_ERROR_REASONS lists exactly the members of the type the loader validates against`,
    listed.length === reasons.length && reasons.every((r) => listed.includes(r)),
    `type=[${reasons.join(",")}] const=[${listed.join(",")}]`);
  // the predicate reads the FIELD and never the prose: no `detail` anywhere in the exemption, and
  // the three clause lists go through the one helper rather than the raw list
  const blocksAt = signals.indexOf("export function mergeBlocksLane(");
  const blocksBody = blocksAt < 0 ? "" : signals.slice(blocksAt, signals.indexOf("\n}", blocksAt) + 2);
  // …and it tests the LIST, not a literal. With one value the two were the same test; with two
  // they are not, and a predicate that kept the literal would go on blocking a lane whose reason
  // the loader happily carries across a boot — an exemption the enum grants and no clause spends.
  // The `!== undefined` clause is pinned with it: it is what keeps an ABSENT reason UNKNOWN.
  pin(`${RULE_FF} — mergeBlocksLane tests the closed STATUS+field pair against the ENUM and never parses \`detail\``,
    blocksBody.includes('m?.status === "error" && m.errorReason !== undefined')
      && blocksBody.includes("MERGE_ERROR_REASONS.includes(m.errorReason)")
      && !/"ff-lost"|"dirty-main"/.test(blocksBody)
      && !/detail/.test(blocksBody)
      && (signals.match(/!mergeBlocksLane\(v\.merge\)/g) ?? []).length === 3
      && (signals.match(/MERGE_BLOCKING\.includes/g) ?? []).length === 1,
    `body=${blocksBody.replace(/\s+/g, " ").slice(0, 160)}`);
  // ONE runtime writer on the clean path, plus ONE loader-only legacy backfill. The latter has to
  // prove every old-writer field before it can mint the exemption; an invalid present reason takes
  // the validation/drop arm and can never fall through into migration.
  const loaderAt = server.indexOf("function withValidErrorReason(row: MergeLast): MergeLast {");
  const loaderEnd = loaderAt < 0 ? -1 : server.indexOf("\n}\n", loaderAt);
  const loaderBody = loaderAt < 0 || loaderEnd < 0 ? "" : server.slice(loaderAt, loaderEnd + 2);
  const reasonSites = [...server.matchAll(/errorReason: "ff-lost"/g)].map((m) => m.index);
  const cleanAdvance = server.indexOf("await advanceIntegration(root, main, branch)");
  pin(`${RULE_FF} — server.ts keeps one clean-path runtime mint plus one loader-only legacy backfill`,
    reasonSites.length === 2
      && reasonSites.filter((at) => at >= loaderAt && at < loaderEnd).length === 1
      && reasonSites.filter((at) => at > cleanAdvance).length === 1
      && server.includes("MERGE_ERROR_REASONS.includes(row.errorReason)")
      && (server.match(/withValidErrorReason\(identityComplete/g) ?? []).length === 2,
    `reasonSites=${reasonSites.length} loader=${reasonSites.filter((at) => at >= loaderAt && at < loaderEnd).length} runtime=${reasonSites.filter((at) => at > cleanAdvance).length} calls=${(server.match(/withValidErrorReason\(identityComplete/g) ?? []).length}`);
  pin(`${RULE_FF} — the legacy backfill requires the complete old lost-FF proof and no existing reason`,
    loaderBody.includes('row.errorReason === undefined')
      && loaderBody.includes('row.status === "error"')
      && loaderBody.includes("row.landed === false")
      && loaderBody.includes("row.verify?.ok === true")
      && loaderBody.includes("LEGACY_FF_LOST_DETAIL.test(row.detail)")
      && loaderBody.includes('return { ...row, errorReason: "ff-lost" }'),
    `body=${loaderBody.replace(/\s+/g, " ").slice(0, 240)}`);
  // the default-off latch that lets a suite hit the race, and the fixture that arms it — same
  // shape and same reason as the Game-Maker open latch pinned further down
  const ffLatch = server.indexOf("await waitForLandFfTestLatch();");
  const ffIntent = server.indexOf("await markLandIntent(root, main, branch, mainBefore,");
  const ffAdvance = server.indexOf("const adv = await advanceIntegration(root, main, branch);");
  // ...AND THE BOUNDED RETRY MAY NEVER LAND A TREE THE GATE HAS NOT SEEN. After a second rebase
  // the tree is a different one, so the re-rebase, the re-verify and the stop on anything non-green
  // must all sit BETWEEN the lost fast-forward and the next advance, in that order. An edit that
  // hoists the gate out of the loop would land a re-rebased tree behind the FIRST round's green —
  // the one thing this retry must never do, and a change that reads as a harmless simplification.
  const ffRetry = server.indexOf("if (mainMoved && ffRounds < LAND_FF_RETRY_ROUNDS && ffHeld) {");
  const ffReRebase = server.indexOf("const again = await tryScriptRebase(cwd, main);", ffRetry);
  // the retry gate names the HOLDER it runs under rather than a bare `true` since M1: the hold may
  // be one this job took or one the wrapper above it is keeping, and the child has to be told which
  // pid the lock file records (e2e-stage.sh compares them).
  const ffReVerify = server.indexOf("verify = await gateRun(() => runVerify(cwd, landMain, retryPlan, gateInherited ?? gateHoldPid));", ffRetry);
  const ffReStop = server.indexOf("res = { ...cleanVerifyStop(verify, branch), ffRounds }; break;", ffRetry);
  const ffMint = server.indexOf('errorReason: "ff-lost"', ffRetry);
  pin(`${RULE_FF} — the bounded retry re-rebases, RE-RUNS THE GATE and stops on any non-green before it may advance again`,
    ffRetry > 0 && ffReRebase > ffRetry && ffReVerify > ffReRebase && ffReStop > ffReVerify
      && ffMint > ffReStop
      && /const LAND_FF_RETRY_ROUNDS = Math\.min\(5, Math\.max\(0, Number\(process\.env\.FLEET_LAND_FF_RETRY_ROUNDS \?\? 2\) \| 0\)\);/.test(server)
      // and the premise itself: main MOVING is what a retry answers. A fast-forward refused over a
      // dirty main checkout leaves main where it was, and re-gating the same tree twice for that
      // would hold this machine's one mutex through two full chains to reach the same verdict.
      && server.includes('const mainMoved = /^[0-9a-f]{40,64}$/.test(mainNow) && mainNow !== mainBefore;')
      && read("e2e/programs.ts").includes('FLEET_LAND_FF_RETRY_ROUNDS: "0"'),
    `retry=${ffRetry} rebase=${ffReRebase} verify=${ffReVerify} stop=${ffReStop} mint=${ffMint}`);
  // --- M3 · AND THE OTHER REASON IS AN ORDERING, WHICH NO COMPILER CAN SEE ---------------------
  // `dirty-main` buys exactly one thing: the gate never runs for a land that cannot fast-forward.
  // That is not a property of the check, it is a property of WHERE it sits — an edit that moved it
  // below `verifyPlanFor` would leave every assertion about the verdict true and the whole cut
  // spent (median 107 s of work behind a p90 1 784 s queue, §2.2). The second look has the mirror
  // ordering: after the land declaration, before the advance, so a checkout that went dirty during
  // the gate is named rather than re-read as the ff race. Both mints go through ONE builder, so
  // the two sites cannot word the same fact differently.
  // THREE sites since the take moved in front of the pre-pass rebase (2026-09-12), and the first
  // of them exists for exactly the sentence above with one word changed: a land that cannot
  // fast-forward must not pay the QUEUE either. It is read-only and writes nothing — the count of
  // `errorReason: "dirty-main"` mints below is what holds that, and it stays ONE.
  const m3Entry = server.indexOf("const entryDirty = entryPlan ? await dirtyMainStop(");
  const m3Pre = server.indexOf("const dirtyStop = cleanPath ? await dirtyMainStop(");
  const m3Plan = server.indexOf("const firstVerifyPlan = dirtyStop ? null : await verifyPlanFor(");
  const m3Second = server.indexOf("const dirtyNow = await dirtyMainStop(");
  pin(`${RULE_FF} — the dirty-main preflight precedes the suite-mutex take AND the verify PLAN, and the second look precedes the advance`,
    m3Entry > 0 && m3Pre > m3Entry && m3Plan > m3Pre && m3Second > m3Plan && ffAdvance > m3Second
      && ffIntent < m3Second
      && m3Entry < server.indexOf("gateHeld = await gateRun(() => holdSuiteLock(VERIFY_WAIT_MS, holdOwner));")
      && (server.match(/errorReason: "dirty-main"/g) ?? []).length === 1
      && (server.match(/await dirtyMainStop\(/g) ?? []).length === 3
      && server.includes("if (dirtyNow) { clearLandIntent(root); res = dirtyNow; break; }"),
    `entry=${m3Entry} pre=${m3Pre} plan=${m3Plan} second=${m3Second} intent=${ffIntent} advance=${ffAdvance}`);
  // …and the probe cannot MINT what it could not MEASURE: an unreadable status or diff returns
  // null and the land goes on exactly as it did before M3, where the ff-merge still catches it.
  const m3Body = server.match(/async function dirtyMainOverlap\([\s\S]*?\n\}/)?.[0] ?? "";
  pin(`${RULE_FF} — dirtyMainOverlap fails to null on an unreadable read, reads status where the ff runs, and keeps both sides of a rename`,
    m3Body.includes("if (st.code !== 0) return null;") && m3Body.includes("if (diff.code !== 0) return null;")
      && m3Body.includes('const holder = (await listWorktrees(repo)).find((w) => w.branch === main);')
      && m3Body.includes('gitReadRaw(holder.path, "status", "--porcelain", "-z")')
      && m3Body.includes('"--no-renames"')
      && read("server.ts").includes("if (/[RC]/.test(entry.slice(0, 2))) {"),
    `body=${m3Body.replace(/\s+/g, " ").slice(0, 200)}`);
  pin(`${RULE_FF} — the default-off E2E latch sits between the land declaration and the fast-forward, and a fixture arms it`,
    server.includes("process.env.FLEET_TEST_LAND_FF_LATCH ?? null")
      && ffIntent >= 0 && ffLatch > ffIntent && ffAdvance > ffLatch
      && read("e2e/programs.ts").includes("FLEET_TEST_LAND_FF_LATCH: ffLatch")
      && read("e2e/programs.ts").includes("ffLatchReached")
      && read("e2e/programs.ts").includes("ffLatchRelease"),
    `intent=${ffIntent} latch=${ffLatch} advance=${ffAdvance}`);
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
  // The list is quoted here rather than imported so a widening has to be a DELIBERATE edit in two
  // places: `handoff` (2026-09-12, the lane baton) had to be added to the route's vocabulary and to
  // this pin, and that is the point — it is the one status that is not a verdict, and a fourth
  // spelling appearing here unannounced would be exactly what this pin exists to catch.
  const statuses = ["complete", "needs-main", "failed", "handoff"];
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
  // …and the report CAP is one number across route, footer and AGENTS.md. Measured price of it living
  // only in docs/self-api.md: 130/181 Claude lanes hit "text must be at most … chars" at least once,
  // 334 retries in 14 days (docs/messungen/2026-09-13-worktrail-iv-agents-ctxpacks-fable.md §2.1).
  // The footer interpolates the constant, so it cannot drift by construction — the pin holds that
  // construction (no literal) and the prose half, which can drift, against the declared value.
  const capDeclared = read("server/types.ts").match(/const MAX_FLEET_REPORT_TEXT = (\d+);/)?.[1] ?? null;
  const agentsReporting = ((): string => {
    const doc = read("AGENTS.md");
    const at = doc.indexOf("\n## Reporting");
    return at < 0 ? "" : doc.slice(at).split(/\n## /)[1] ?? "";
  })();
  const capInAgents = agentsReporting.match(/at most (\d+) characters/)?.[1] ?? null;
  pin(`${RULE_RECEIVER} — the report cap is one number across route constant, footer and AGENTS.md §Reporting`,
    capDeclared !== null && footer.includes("${MAX_FLEET_REPORT_TEXT}") && !footer.includes(capDeclared)
      && capInAgents === capDeclared && agentsReporting.includes("MAX_FLEET_REPORT_TEXT"),
    capDeclared === null ? "MAX_FLEET_REPORT_TEXT declaration not found in server/types.ts"
      : `declared=${capDeclared} footerInterpolates=${footer.includes("${MAX_FLEET_REPORT_TEXT}")} `
        + `footerLiteral=${footer.includes(capDeclared)} agents=${capInAgents}`);
  // …and the BOOT clause, pinned separately because it is the one rule that lives nowhere near
  // the parser and is therefore the one a future parser fix will forget. The reconciliation asks
  // "did this event's endpoint survive the restart"; `fleetEventReceiver` answers null for an
  // owner row BY CONSTRUCTION, so without an explicit skip the boot buries every unread owner
  // report and zeroes the inbox ceiling with it. Measured once, exactly that way (B4 survival:
  // inbox -> receiver-gone across this loop). The ORDER is pinned too: the skip must come before
  // the call, or the null answer is consumed before anyone can distinguish it from a loss.
  const bootReconcile = server.slice(
    server.indexOf("// An event does not disappear merely because its transport endpoint did."),
    server.indexOf("for (const id of new Set(fleetEvents.map((e) => e.receiverSlot)))"));
  const ownerSkip = bootReconcile.indexOf("e.receiverSlot === null");
  const receiverCall = bootReconcile.indexOf("fleetEventReceiver(e)");
  const goneAssign = bootReconcile.indexOf('e.status = "receiver-gone";');
  pin(`${RULE_RECEIVER} — boot reconciliation leaves the owner principal's rows untouched (B4)`,
    bootReconcile !== "" && ownerSkip >= 0 && receiverCall >= 0 && goneAssign >= 0
      && ownerSkip < receiverCall && receiverCall < goneAssign,
    bootReconcile === "" ? "boot reconciliation loop not found in server.ts"
      : `ownerSkip@${ownerSkip} receiverCall@${receiverCall} goneAssign@${goneAssign}`);

  // B4, THE OWNER-INBOX FALLBACK, pinned at its three edges because each one fails silently and
  // in a different direction: a widened trigger routes a bound lane's result past its MAIN, a
  // copied literal drifts from the refusal it is supposed to mirror, and a clarification that
  // learned the same fallback would wait forever on an inbox that cannot answer.
  const eventParser = server.slice(server.indexOf("function fleetEventFrom("),
    server.indexOf("function clarificationFrom("));
  const reportDoor = server.match(/async function openFleetReport\([\s\S]*?\n\}/)?.[0] ?? "";
  const clarifyDoor = server.match(/async function openClarification\([\s\S]*?\n\}/)?.[0] ?? "";
  pin(`${RULE_RECEIVER} — the report door falls through on the ONE named refusal, for a task-bearing lane with no program (B4)`,
    reportDoor !== "" && /const NO_RECEIVER_EVIDENCE = "no exact clarification receiver evidence";/.test(server)
      && reportDoor.includes("reason !== NO_RECEIVER_EVIDENCE || s.programId || !s.taskId")
      && !reportDoor.includes('"no exact clarification receiver evidence"'),
    reportDoor === "" ? "openFleetReport not found in server.ts"
      : `gate=${reportDoor.includes("reason !== NO_RECEIVER_EVIDENCE || s.programId || !s.taskId")}`);
  pin(`${RULE_RECEIVER} — a clarification never reaches the inbox: an inbox cannot answer (B4)`,
    clarifyDoor !== "" && clarifyDoor.includes('if ("error" in resolved) return json({ error: resolved.error }, 409);')
      && !clarifyDoor.includes("inbox"),
    clarifyDoor === "" ? "openClarification not found in server.ts"
      : `mentionsInbox=${clarifyDoor.includes("inbox")}`);
  // The equivalence, in the reverse-state parser rather than the door: a row that survives a
  // restart must still be unable to claim inbox transport with a session receiver, or a slot
  // recycle would mark the owner's unread report `receiver-gone`.
  // THREE fields carry "who was this filed to" — the transport (`delivery`), the event payload's
  // `basis`, and the persisted FleetReport's `basis`. Each is pinned to the receiver separately,
  // because an unbound one does not fail loudly: it hydrates and then LIES to whichever sight
  // reads it. The fourth and fifth clauses keep the owner principal to the kinds that can have one
  // — TWO since the preview rail (a red `lane-suite` files an owner row so the process outlives
  // the lane), and both are read off ONE `ownerAddressable` list so a kind can never be admitted
  // to the membership test without also being admitted to the transport equivalence.
  const ownerEquivalences = [
    'const ownerAddressable = e.kind === "fleet-report" || e.kind === "lane-suite" || e.kind === "harness-block"\n    || e.kind === "lane-review";',
    '|| (ownerReceiver && !ownerAddressable)',
    '|| (ownerAddressable && (e.delivery === "inbox") !== ownerReceiver)',
    '|| ((p.basis === "owner-inbox") !== ownerReceiver)) return null;',
    '|| (e.kind === "clarification-request" && e.delivery === "inbox")',
    '|| (ownerReceiver && e.status !== "inbox" && e.status !== "acknowledged")',
  ];
  const reportRowParser = server.match(/function fleetReportFrom\([\s\S]*?\n\}/)?.[0] ?? "";
  pin(`${RULE_RECEIVER} — every carrier of "filed to the owner" is bound to the receiver, in the parser (B4)`,
    ownerEquivalences.every((clause) => eventParser.includes(clause))
      && eventParser.includes('"program-main+lane-watch", "owner-inbox"')
      && reportRowParser.includes('r.basis === "program" || r.basis === "owner-inbox"')
      && reportRowParser.includes('? r.receiver !== null : !occupant(r.receiver, false)'),
    `missing=[${ownerEquivalences.filter((c) => !eventParser.includes(c)).map((c) => c.slice(3, 40)).join(" | ")}]`
      + ` allowlist=${eventParser.includes('"program-main+lane-watch", "owner-inbox"')}`
      + ` reportRow=${reportRowParser.includes('r.basis === "program" || r.basis === "owner-inbox"')}`);
  // --- D1 · THE ACCEPTANCE DOOR. The event ACK is a TRANSPORT receipt by contract, so the
  // judgement had to get its own door and its own persisted word. Four halves can drift without a
  // compiler noticing: the closed disposition vocabulary (server/types.ts vs the doc), the two
  // route paths (regex vs the doc a MAIN is sent to), the refusal sentences (prose in two files),
  // and the rule that the door SETTLES transport through the ack writer instead of writing a
  // second terminal transition of its own.
  const dispositions = (server.match(/FLEET_REPORT_DISPOSITIONS = \[([^\]]*)\]/)?.[1] ?? "")
    .split(",").map((w) => w.trim().replace(/"/g, "")).filter(Boolean);
  const decisionSection = selfApi.slice(selfApi.indexOf("### Annahme — `POST /api/self/fleet-report/:id/accept`"));
  pin(`${RULE_RECEIVER} — the two dispositions are one closed list across server/types.ts and docs/self-api.md (D1)`,
    JSON.stringify(dispositions) === JSON.stringify(["accepted", "rejected"])
      && decisionSection !== "" && dispositions.every((word) => decisionSection.includes(word))
      && !/"(approved|declined|acked|ok)"/.test(server.match(/FLEET_REPORT_DISPOSITIONS = \[([^\]]*)\]/)?.[0] ?? ""),
    `declared=[${dispositions.join(",")}] docSection=${decisionSection !== ""}`);
  pin(`${RULE_RECEIVER} — both decision route paths exist in the route table and in the doc a MAIN is sent to (D1)`,
    server.includes("/^\\/api\\/self\\/fleet-report\\/([0-9a-f]{24})\\/(accept|reject)$/")
      && decisionSection.includes("POST /api/self/fleet-report/:id/accept")
      && decisionSection.includes("POST /api/self/fleet-report/:id/reject"),
    `regex=${server.includes("(accept|reject)$/")} doc=${decisionSection.includes("/accept")}`);
  // The four refusals, verbatim in BOTH files. Each fails silently in its own direction: a reworded
  // server sentence leaves a MAIN searching the doc for a refusal it will never see, and a reworded
  // doc teaches a door that does not exist.
  const decisionRefusals = [
    "a lane may not judge a fleet report — a lane files its own result, it does not accept the results its own MAIN is owed",
    "owner-inbox report — accepting or rejecting it belongs to the owner, who has no session to bind a decision to",
    "fleet report belongs to another or replaced MAIN session",
    "body must contain only reason",
  ];
  const refusalDrift = decisionRefusals.filter((line) => !server.includes(line) || !decisionSection.includes(line));
  pin(`${RULE_RECEIVER} — every decision refusal reads the same in server.ts and docs/self-api.md (D1)`,
    refusalDrift.length === 0, `drift=[${refusalDrift.map((l) => l.slice(0, 40)).join(" | ")}]`);
  // …and the (c) rule, as SOURCE: one writer for the terminal transition, called by both the ack
  // route and the decision door. A door that assigned the status itself would pass every runtime
  // fixture the day it was written and drift from the prune key and the audit word afterwards.
  const decisionDoor = server.match(/async function decideFleetReport\([\s\S]*?\n\}/)?.[0] ?? "";
  const ackWriter = server.match(/function settleFleetEventAcknowledged\([\s\S]*?\n\}/)?.[0] ?? "";
  const ackRoute = server.slice(server.indexOf("async function acknowledgeFleetEvent"),
    server.indexOf("async function ownerAcknowledgeFleetEvent"));
  pin(`${RULE_RECEIVER} — the decision settles transport through the ack writer, never with a second terminal write (D1)`,
    decisionDoor !== "" && ackWriter !== "" && ackRoute !== ""
      && decisionDoor.includes("settleFleetEventAcknowledged(event)")
      && ackRoute.includes("settleFleetEventAcknowledged(event)")
      && !/event\.status = /.test(decisionDoor) && !/event\.status = /.test(ackRoute)
      && ackWriter.includes('event.status = "acknowledged";')
      && decisionDoor.includes("!FLEET_EVENT_TERMINAL.includes(event.status)"),
    `door=${decisionDoor !== ""} writer=${ackWriter !== ""} doorAssigns=${/event\.status = /.test(decisionDoor)}`);
  // …and the (d) rule, likewise as source: the door records a judgement and actuates NOTHING. Each
  // forbidden token is a lifecycle act that a later "while we are here" edit would reach for.
  // `\b` on each, because `event.status` legitimately contains `t.status` — a substring match here
  // would fail on the one line the rule above requires the door to have.
  const decisionForbidden = ["sendText", "mergeJob", "killSlot", "landLane", "pruneFleetReports",
    "detachSlotTasks", "releaseTask", "tasks"]
    .filter((token) => new RegExp(`\\b${token}\\b`).test(decisionDoor));
  const decisionCallSites = server.split("decideFleetReport(").length - 2; // declaration excluded
  pin(`${RULE_RECEIVER} — the decision door actuates nothing and has exactly one call site, the route (D1)`,
    decisionDoor !== "" && decisionForbidden.length === 0 && decisionCallSites === 1
      && !/\.status = /.test(decisionDoor)
      && /return decideFleetReport\(s, selfReportDecision\[1\],/.test(server),
    `forbidden=[${decisionForbidden.join(",")}] callSites=${decisionCallSites}`);

  // --- D1b · THE OWNER DOOR beside it, and the four halves that drift the same way. The finding it
  // closes was measured, not imagined: a Program-MAIN with an unjudged report could not be retired
  // without making the verdict permanently unreachable, so the fleet accumulated panes to keep a
  // decision alive. Everything here is a SOURCE rule, because each failure is silent at runtime.
  const ownerDoor = server.match(/async function ownerDecideFleetReport\([\s\S]*?\n\}/)?.[0] ?? "";
  const livenessFn = server.match(/function reportReceiverLiveness\([\s\S]*?\n\}/)?.[0] ?? "";
  const ownerSection = selfApi.slice(selfApi.indexOf("### Die OWNER-Tür — `POST /api/fleet-report/:id/accept`"));
  pin(`${RULE_RECEIVER} — the owner decision route exists in the route table and in the doc (D1b)`,
    ownerDoor !== ""
      && server.includes("/^\\/api\\/fleet-report\\/([0-9a-f]{24})\\/(accept|reject)$/")
      && server.includes('url.pathname === "/api/fleet-report" && req.method === "GET"')
      && ownerSection !== "" && ownerSection.includes("POST /api/fleet-report/:id/accept")
      && ownerSection.includes("GET /api/fleet-report")
      // …and the doc hands the OWNER credential, not a self token. The route sits behind the plain
      // owner gate (tokenFrom: Bearer, the fleet cookie, ?token=), so a curl teaching
      // `x-fleet-self-token` here would send the reader to a 401 that looks like a broken door.
      && /-H "authorization: Bearer \$FLEET_TOKEN"/.test(ownerSection)
      && !/x-fleet-self-token/.test(ownerSection.slice(0, ownerSection.indexOf("**Sichtbarkeit"))),
    `door=${ownerDoor !== ""} route=${server.includes("(accept|reject)$/")} doc=${ownerSection !== ""}`
      + ` bearer=${/-H "authorization: Bearer \$FLEET_TOKEN"/.test(ownerSection)}`);
  // THE BOUNDARY, as source: the owner door refuses a LIVE receiver, and it is the FIRST thing it
  // does. A door that checked liveness after the already-decided branch would still be correct
  // today and would stop being correct the first time somebody reordered the two.
  const ownerLivenessGuardAt = ownerDoor.indexOf('reportReceiverLiveness(report) === "live"');
  const ownerDecidedGuardAt = ownerDoor.indexOf("if (report.decision)");
  pin(`${RULE_RECEIVER} — the owner door refuses a live receiver, before any other branch (D1b)`,
    ownerDoor !== "" && ownerLivenessGuardAt > 0 && ownerDecidedGuardAt > ownerLivenessGuardAt
      && ownerDoor.includes("the verdict belongs to that MAIN through POST /api/self/fleet-report/"),
    `liveGuardAt=${ownerLivenessGuardAt} decidedGuardAt=${ownerDecidedGuardAt}`);
  // ONE rule for both doors. Two copies is how "two principals may judge one row" and "neither may"
  // are both reachable from an edit that looked local — and neither shows up as a red check.
  const livenessReaders = server.split("reportReceiverLiveness(").length - 2; // declaration excluded
  pin(`${RULE_RECEIVER} — receiver liveness is ONE function, resolving the occupation and not the session id (D1b)`,
    livenessFn !== "" && livenessReaders >= 3
      && /live\.openedAt === report\.receiver\.openedAt/.test(livenessFn)
      && !/sessionId/.test(livenessFn)
      && ownerDoor.includes("reportReceiverLiveness(report)")
      && server.includes("const reportAwaitsOwner = (report: FleetReport): boolean =>"),
    `fn=${livenessFn !== ""} readers=${livenessReaders} gatesSession=${/sessionId/.test(livenessFn)}`);
  // …and the self door reads the SAME occupation. This is the sessionId divergence that made slot
  // 12 unjudgeable by anyone: resolution never gated it, judgement did, and the owner door could
  // not help because the occupant was alive.
  const selfDoorGate = server.match(/if \(report\.basis !== "program" && report\.receiver\n\s*&&[\s\S]*?\n/)?.[0] ?? "";
  pin(`${RULE_RECEIVER} — the self door gates the occupation only, like clarificationReceiverFor (D1b)`,
    selfDoorGate.includes("report.receiver.openedAt !== s.openedAt")
      && !selfDoorGate.includes("sessionId")
      && (server.match(/function clarificationReceiverFor\([\s\S]*?\n\}/)?.[0] ?? "")
        .includes("sessionId is deliberately reported, never gated"),
    `gate=${selfDoorGate.trim().slice(0, 80)}`);
  // THE STAMP, both halves: the row records the owner as a principal (never the dead MAIN's
  // triple), and the parser admits that shape on the way back in. A parser that still demanded an
  // occupant would DISCARD every owner verdict at the next boot — silently, one whole row at a time.
  pin(`${RULE_RECEIVER} — an owner verdict is stamped "owner" and survives hydration (D1b)`,
    ownerDoor.includes('by: "owner"') && !/by: \{ slot/.test(ownerDoor)
      && reportRowParser.includes('if (d.by !== "owner" && !rule)')
      && /by\.openedAt !== r\.receiver\.openedAt/.test(reportRowParser)
      && !/by\.sessionId !== r\.receiver\.sessionId/.test(reportRowParser),
    `stamp=${ownerDoor.includes('by: "owner"')} parser=${reportRowParser.includes('if (d.by !== "owner" && !rule)')}`);
  // The owner door actuates nothing either, and no TICK may reach it: an owner act is what closes a
  // report, and a scheduled one would age an absence into a verdict nobody gave.
  const ownerForbidden = ["sendText", "mergeJob", "killSlot", "landLane", "detachSlotTasks",
    "releaseTask", "pruneFleetReports"].filter((t) => new RegExp(`\\b${t}\\b`).test(ownerDoor));
  const ownerCallSites = server.split("ownerDecideFleetReport(").length - 2; // declaration excluded
  pin(`${RULE_RECEIVER} — the owner door actuates nothing and has exactly one call site, the route (D1b)`,
    ownerDoor !== "" && ownerForbidden.length === 0 && ownerCallSites === 1
      && !/\.status = /.test(ownerDoor)
      && ownerDoor.includes("settleFleetEventAcknowledged(event)"),
    `forbidden=[${ownerForbidden.join(",")}] callSites=${ownerCallSites}`);
  // VISIBILITY, the half the door cannot buy: an orphaned row must not be prunable, and the count
  // that lights the board must exist. Both fail silently — a pruned row is simply not there any
  // more, and a missing counter renders as "nothing is filed".
  const pruneFn = server.match(/function pruneFleetReports\([\s\S]*?\n\}/)?.[0] ?? "";
  pin(`${RULE_RECEIVER} — a report awaiting the owner is held out of the retention tail and counted on the poll (D1b)`,
    pruneFn.includes("if (reportAwaitsOwner(report)) return false;")
      && server.includes("const awaiting = fleetReports.filter(reportAwaitsOwner).length;")
      && server.includes("reportsAwaitingOwner: awaiting")
      && clientU.text.includes("reportsAwaitingOwner")
      && clientU.text.includes('api("/api/fleet-report")'),
    `prune=${pruneFn.includes("reportAwaitsOwner")} poll=${server.includes("reportsAwaitingOwner: awaiting")}`);
  // …and the unattended actuator stays where it was. The auto-close reads a verdict as "the
  // coordinating MAIN is finished with this lane" — a fact an owner verdict does not carry, and
  // widening it here would let a door built to UNBLOCK an owner start killing panes on his behalf.
  const autoCloseRefusalFn = server.match(/function laneAutoCloseRefusal\([\s\S]*?\n\}/)?.[0] ?? "";
  pin(`${RULE_RECEIVER} — an owner verdict does not arm the unattended lane auto-close (D1b)`,
    autoCloseRefusalFn.includes('if (d.by === "owner")')
      && autoCloseRefusalFn.includes("a report of this lane was judged by the owner, not by its MAIN")
      && server.includes('if (!report || !decision || decision.by === "owner") continue;'),
    `refusal=${autoCloseRefusalFn.includes('d.by === "owner"')}`);

  // --- D1d · RULE DECISIONS (owner 2026-09-13, §D of the task-aggregation note). Each rule is a
  // silent auto-verdict if one conjunct goes missing, and every such mutation passes a fixture that
  // happens not to plant that case — so the refusals are held as SOURCE here as well.
  const ablReading = server.match(/function acceptByLandReading\([\s\S]*?\n\}/)?.[0] ?? "";
  pin(`${RULE_RECEIVER} — accepted-by-land refuses a red audit, a non-complete report, a sent task, a land older than the report and a missing audit (D1d)`,
    ablReading.includes('report.status !== "complete"')
      && ablReading.includes('task?.status === "sent"')
      && ablReading.includes("o.ts < report.reportedAt")
      && ablReading.includes('covering.find((row) => row.result === "red")')
      && ablReading.includes("if (!newest) return { accept: false"),
    `fn=${ablReading !== ""}`);
  const carryReading = server.match(/function carryFlakeReading\([\s\S]*?\n\}/)?.[0] ?? "";
  const carrySinks = server.split('if (row.result === "red") await carryFlakeAdjudications("audit", row.at);').length - 1;
  // THREE sinks since the sharded audit (server.ts#writeShardedAuditRow): local run, remote helper, sharded run
  pin(`${RULE_RECEIVER} — carried-flake carries only ONE signature from an OWNER flake inside 14 days, in all three audit sinks (D1d)`,
    carryReading.includes('adj.verdict !== "flake" || adj.by !== "owner"')
      && carryReading.includes("row.at - prior.at > CARRIED_FLAKE_WINDOW_MS")
      && /const CARRIED_FLAKE_WINDOW_MS = 14 \* 24 \* 3600_000;/.test(server)
      && carryReading.includes("names.length > 1")
      && carrySinks === 3 && !/appendEvent\(POSTLAND_AUDIT_FILE/.test(carryReading),
    `fn=${carryReading !== ""} sinks=${carrySinks}`);
  const reconcileFn = server.match(/function reconcileAttention\([\s\S]*?\n\}/)?.[0] ?? "";
  const successorFn = server.match(/function attentionSuccessorFor\([\s\S]*?\n\}/)?.[0] ?? "";
  pin(`${RULE_RECEIVER} — attention is rebound only to a successor the Program lineage records via succeed; everything else still refuses (D1d)`,
    successorFn.includes('e.endedBy === "succeed"')
      && reconcileFn.indexOf("attentionSuccessorFor(a)") >= 0
      && reconcileFn.indexOf("attentionSuccessorFor(a)") < reconcileFn.indexOf('refuseAttention(a, "requester session ended")'),
    `successor=${successorFn !== ""} reconcile=${reconcileFn !== ""}`);

  // --- D1c · THE CARRY BACK TO THE LANE. Until 2026-09-12 neither door told the worker anything —
  // form (i) of the three the finding named: not a send that failed, not an owner-only send, NO send.
  // Measured 2026-09-06: reports 097cd80b and b8188322 were rejected and the lane in slot 11 learned
  // it only because the Controller forwarded the news by hand. Every rule below is SOURCE, because
  // each failure is silent at runtime — a second deliverer, a carry wired into one door only, or a
  // carry hoisted above the already-decided refusal all pass every fixture the day they are written.
  const carryFn = server.match(/async function deliverFleetReportDecision\([\s\S]*?\n\}/)?.[0] ?? "";
  const carrySites = server.split("deliverFleetReportDecision(").length - 2; // declaration excluded
  // …and the RULE (accepted-by-land, 2026-09-13) is the third caller: a verdict nobody typed reaches
  // the lane through the same deliverer, never a second one.
  const ruleTick = server.match(/async function tickAcceptByLand\([\s\S]*?\n\}/)?.[0] ?? "";
  pin(`${RULE_RECEIVER} — ONE deliverer carries a verdict to the lane, and BOTH doors and the land rule call it (D1c)`,
    carryFn !== "" && carrySites === 3
      && decisionDoor.includes("await deliverFleetReportDecision(report);")
      && ownerDoor.includes("await deliverFleetReportDecision(report);")
      && ruleTick.includes("await deliverFleetReportDecision(report);"),
    `fn=${carryFn !== ""} sites=${carrySites} self=${decisionDoor.includes("deliverFleetReportDecision")}`
      + ` owner=${ownerDoor.includes("deliverFleetReportDecision")}`);
  // THE ORDER, in both doors and for the same two reasons: the verdict must be RECORDED before it is
  // carried (a paste that raced the row would tell a lane about a judgement no row holds), and the
  // carry must sit BELOW the already-decided refusal (a second call would otherwise paste a second,
  // duplicate verdict into a lane that had already read the first). This is the mutation the runtime
  // exactly-once check is written against, held here as position rather than as behaviour.
  const orderOk = (door: string): boolean => {
    const decided = door.indexOf("if (report.decision)");
    const stamp = door.indexOf("report.decision = {");
    const carry = door.indexOf("await deliverFleetReportDecision(report);");
    return decided > 0 && stamp > decided && carry > stamp;
  };
  pin(`${RULE_RECEIVER} — the carry runs after the verdict is stamped and below the already-decided refusal, in both doors (D1c)`,
    orderOk(decisionDoor) && orderOk(ownerDoor),
    `self=${orderOk(decisionDoor)} owner=${orderOk(ownerDoor)}`);
  // EXACTLY ONCE, keyed on the stored fact rather than on the callers' manners — and the guard is
  // the FIRST branch, so no later edit can put work above it.
  pin(`${RULE_RECEIVER} — the deliverer refuses a second carry on the stored delivery record itself (D1c)`,
    carryFn.includes("if (report.decisionDelivery !== undefined && report.decisionDelivery !== null) return;")
      && carryFn.indexOf("report.decisionDelivery !== undefined") < carryFn.indexOf("slotFrom("),
    carryFn.match(/if \(report\.decisionDelivery[^\n]*/)?.[0] ?? "no guard");
  // THE OCCUPATION, and that a failure is NAMED rather than dropped: slot AND openedAt, because a
  // carry keyed on the slot NUMBER would paste one lane's verdict into whoever holds that number now.
  // The session id is deliberately NOT part of the gate — clarificationReceiverFor's doctrine and the
  // slot-12 measurement of 2026-09-07 — and this pin holds that in BOTH directions: a future edit
  // that adds the comparison would withhold a verdict from a live Codex lane whose bind moved the id
  // inside one occupation, which is the exact failure the carry exists to end.
  pin(`${RULE_RECEIVER} — the carry gates the worker's OCCUPATION, never the session id, and records WHY it did not deliver (D1c)`,
    carryFn.includes("worker.openedAt !== report.worker.openedAt")
      && !/worker\.sessionId !== report\.worker\.sessionId\s*\n?\s*\?/.test(carryFn)
      && !carryFn.includes("|| worker.sessionId !== report.worker.sessionId")
      && carryFn.includes('stamp("worker-gone"')
      && carryFn.includes("RECYCLED")
      // …and it is carried as EVIDENCE on the delivered line, so a moved id is observable without
      // ever having been a refusal
      && carryFn.includes("the pane's session id moved since filing")
      && !/report\.decisionDelivery = \{/.test(decisionDoor + ownerDoor),
    `openedAt=${carryFn.includes("worker.openedAt !== report.worker.openedAt")}`
      + ` gatesSession=${/worker\.sessionId !== report\.worker\.sessionId\s*\n?\s*\?/.test(carryFn)}`);
  // …and the four states are ONE closed list across the type, the parser and this deliverer. A state
  // the deliverer writes and the parser does not admit is a row DISCARDED at the next boot, one at a
  // time and with every check green.
  const deliveryStates = (server.match(/FLEET_REPORT_DELIVERY_STATES = \[([^\]]*)\]/)?.[1] ?? "")
    .split(",").map((w) => w.trim().replace(/"/g, "")).filter(Boolean);
  const stampedStates = [...carryFn.matchAll(/stamp\("([a-z-]+)"/g)].map((m) => m[1]!);
  pin(`${RULE_RECEIVER} — the delivery states are one closed list, and the deliverer writes exactly them (D1c)`,
    JSON.stringify(deliveryStates) === JSON.stringify(["delivered", "send-uncertain", "worker-gone", "blocked"])
      && stampedStates.length === 4
      && stampedStates.every((w) => deliveryStates.includes(w))
      && new Set(stampedStates).size === 4
      && reportRowParser.includes("FLEET_REPORT_DELIVERY_STATES.includes(d.state as FleetReportDeliveryState)")
      // a carry can only exist for a row that was judged, and only "delivered" explains nothing
      && reportRowParser.includes("if (decision === undefined || decision === null) return null;")
      && reportRowParser.includes('d.state === "delivered" ? d.reason !== null'),
    `declared=[${deliveryStates.join(",")}] written=[${stampedStates.join(",")}]`);
  // THE TRANSPORT MARKER, replyClarification's FACT 2 one rail over: persisted BEFORE tmux is
  // touched, so a death mid-send is an UNKNOWN afterwards rather than a delivery nobody observed.
  // And nothing replays it — the decision door is shut by then, so this row is a record, not a debt.
  pin(`${RULE_RECEIVER} — the carry persists send-uncertain before the paste, and no tick replays it (D1c)`,
    carryFn.indexOf('stamp("send-uncertain"') > 0
      && carryFn.indexOf('stamp("send-uncertain"') < carryFn.indexOf("await sendText(")
      && carryFn.indexOf("await saveStateNow();") < carryFn.indexOf("await sendText(")
      && carryFn.indexOf("await saveStateNow();") > carryFn.indexOf('stamp("send-uncertain"')
      // the only pane-touching caller in this family, and the waiver it takes is the ONE
      // replyClarification takes: the work-prompt policy, never the kill-switch or the liveness probe
      && carryFn.includes("canDeliver(worker, { now: Date.now(), harness: false, idleMs: 0 })")
      && !/killSwitch|alive: false|quietHours: false/.test(carryFn),
    `marker=${carryFn.indexOf('stamp("send-uncertain"')} send=${carryFn.indexOf("await sendText(")}`);

  // --- D2 · THE AUTOMATIC LANE CLOSE, the acceptance door's only consumer. Three halves can drift
  // without a compiler noticing, and each one is a behaviour that closes panes unattended: the
  // FLAG NAME (env string vs the doc that tells an owner how to arm it), the DISPOSITION WORD (the
  // LaneDisposition union vs the assertion vs the doc), and the two source rules that keep the act
  // where it belongs — armed only by the flag, and unreachable from the lane-START path.
  const autoCloseTick = server.match(/async function tickLaneAutoClose\([\s\S]*?\n\}/)?.[0] ?? "";
  const autoCloseRefusal = server.match(/function laneAutoCloseRefusal\([\s\S]*?\n\}/)?.[0] ?? "";
  const autoCloseSection = selfApi.slice(selfApi.indexOf("### Der automatische Lane-Schluss"));
  pin(`${RULE_RECEIVER} — the auto-close flag is one name in server.ts and in the doc that tells an owner how to arm it (D2)`,
    /process\.env\.FLEET_LANE_AUTOCLOSE/.test(server)
      && autoCloseSection !== "" && autoCloseSection.includes("FLEET_LANE_AUTOCLOSE")
      // the off-by-default shape itself: the recognised spellings are NAMED, so an unrecognised
      // value cannot pass for a decision (FLEET_CLEAN_REVIEW's own 2026-07-28 lesson)
      && server.includes("const LANE_AUTOCLOSE_OFF_RE = /^(0|off|false|no)$/i;")
      && server.includes('const LANE_AUTOCLOSE_ON = /^(1|true|on|yes)$/i.test(LANE_AUTOCLOSE_RAW);')
      && autoCloseSection.includes("`1`/`true`/`on`/`yes`"),
    `env=${/process\.env\.FLEET_LANE_AUTOCLOSE/.test(server)} docSection=${autoCloseSection !== ""}`);
  // …and the SUITE side of that same flag, which no compiler and no runtime check can see: a knob
  // the wrappers do not NAME is inherited from whatever shell started them, and this is the knob
  // the deployed fleet arms (watchdog.sh). Since 2026-09-05 server.ts#runVerify scrubs FLEET_* out
  // of the land gate's child (verifyChildEnv, pinned below), so the wrappers are no longer the only
  // thing standing between that armed 1 and a suite reading it — both halves are stated, which is
  // what a knob with two independent inheritance paths is worth. Three statements, because they
  // cover three different callers: the SRV_ENV line covers the isolated suite's own srv and runner,
  // the e2e-stage.sh export covers all seven wrappers, and the probe is what turns the off-state
  // from an assumption into a measurement.
  // Scoped to the SRV_ENV assignment itself, not to the file — the comment above it names the
  // string too, and a pin that its own explanation satisfies measures nothing.
  const isoSrvEnv = /^SRV_ENV="([^\n]*)"$/m.exec(read("e2e-isolated.sh"))?.[1] ?? "";
  pin(`${RULE_RECEIVER} — the suites STATE FLEET_LANE_AUTOCLOSE=0 instead of inheriting it, and measure that they did (D2)`,
    /\bFLEET_LANE_AUTOCLOSE=0\b/.test(isoSrvEnv)
      && /^export FLEET_LANE_AUTOCLOSE=0$/m.test(read("e2e-stage.sh"))
      && /export async function srvEnv\(/.test(read("e2e/harness.ts"))
      && read("e2e/watch.ts").includes('srvEnv("FLEET_LANE_AUTOCLOSE")'),
    `srvEnv=${/\bFLEET_LANE_AUTOCLOSE=0\b/.test(isoSrvEnv)} stage=${/^export FLEET_LANE_AUTOCLOSE=0$/m.test(read("e2e-stage.sh"))}`
      + ` helper=${/export async function srvEnv\(/.test(read("e2e/harness.ts"))}`
      + ` probe=${read("e2e/watch.ts").includes('srvEnv("FLEET_LANE_AUTOCLOSE")')}`);
  // …AND THE SERVER SIDE OF THE SAME INHERITANCE, which the line above could only work around.
  // runVerify's Bun.spawn passed no `env` at all until 2026-09-05, so Bun handed the land gate's
  // chain `process.env` whole — measured 2026-09-05 through e2e-clean-review.sh's verify stand-in:
  // fourteen FLEET_* names arrived in the child, FLEET_SELF_TOKEN and FLEET_SELF_SLOT among them.
  // The gate was therefore measuring a world no lane running those same three wrappers by hand can
  // reproduce, which is the "green in the lane, red at the gate, and nobody can say why" class.
  //
  // Four coupled facts, because each fails differently and only the first is obvious:
  //   · the spawn passes an env AT ALL — delete the option and Bun silently inherits everything
  //   · it is built by a RULE over the FLEET_ prefix, never a list of known-bad names (the payload
  //     boots three more fleet servers, so the wrong knob is not enumerable in advance)
  //   · exactly the SUITE-MUTEX knobs survive it: this server holds the same lock and hands its
  //     hold across, so scrubbing FLEET_SUITE_LOCK would have the child queue for a lock this
  //     process is holding — a silent deadlock, never a red check
  //   · FLEET_SUITE_LOCK_HELD_BY is MINTED under a real hold, never carried across from
  //     `process.env`: a value kept blind is a licence to skip a mutex nobody is holding for that
  //     child. What is minted is the pid that ACTUALLY holds the lock — ours when we took it, and
  //     since M1 the wrapper's when this server was started inside one and validated the claim
  //     against the lock file and the process table (inheritedSuiteHolder). Naming ourselves there
  //     would fail e2e-stage.sh's own pid comparison and queue the child behind its own hold.
  // The measurement is pinned beside the rule for the same reason the D2 probe is above it: a
  // source-text rule with no run behind it is an assumption with a green box around it.
  const verifyEnvBody = serverU.span("// PATH IS NOT TOUCHED", "// `heldSuiteLock` —")?.text ?? "";
  const verifyEnvKeeps = 'const VERIFY_CHILD_KEEPS = new Set(["FLEET_SUITE_LOCK", "FLEET_SUITE_POLL_SEC"]);';
  const verifyEnvSpawn = server.includes("env: verifyChildEnv(heldSuiteLock) });");
  const verifyEnvRule = verifyEnvBody.includes('!k.startsWith("FLEET_") || VERIFY_CHILD_KEEPS.has(k)');
  const verifyEnvMint = verifyEnvBody.includes("if (heldSuiteLock !== null) env.FLEET_SUITE_LOCK_HELD_BY = String(heldSuiteLock);")
    && !verifyEnvBody.includes('"FLEET_SUITE_LOCK_HELD_BY"')
    // and the holder is PROVEN, never taken from the variable: the three conditions e2e-stage.sh
    // applies, in this server too — the lock file names it and the process is alive.
    && server.includes("function inheritedSuiteHolder(): number | null {")
    && server.includes('if (readFileSync(`${SUITE_LOCK}/pid`, "utf8").trim() !== named) return null;')
    && server.includes("process.kill(Number(named), 0);");
  const verifyEnvProbe = read("e2e-clean-review.sh").includes('} > "$0.env"')
    && read("fleet-e2e-clean-review.ts").includes('srvEnv("FLEET_CLEAN_REVIEW")');
  pin("the land gate's chain is spawned with a SCRUBBED env — the same FLEET_* rule auditChildEnv applies to the tier-2 child",
    verifyEnvSpawn && verifyEnvRule && verifyEnvBody.includes(verifyEnvKeeps)
      && verifyEnvMint && verifyEnvProbe,
    `spawn=${verifyEnvSpawn} rule=${verifyEnvRule} keeps=${verifyEnvBody.includes(verifyEnvKeeps)}`
      + ` minted=${verifyEnvMint} probe=${verifyEnvProbe}`);
  // PATH is the one thing the scrub must NOT touch, and it is safe by CONSTRUCTION rather than by a
  // name in a list: the rule keeps every non-FLEET variable, so PATH cannot be dropped without
  // dropping the rule. Pinned as the negative it is — a `delete env.PATH`, a PATH key written into
  // the built env, or an inverted filter that keeps only FLEET_* would each kill every land gate on
  // this machine at `bun install` (launchd carries neither ~/.bun/bin nor ~/.local/bin nor brew,
  // which is why watchdog.sh exports one). e2e-clean-review.sh compares the child's PATH to the
  // runner's on every land gate; this is the source half of that measurement.
  pin("the gate-child scrub cannot lose PATH: it keeps every non-FLEET variable, and says so",
    verifyEnvBody !== "" && !/\bdelete env\.PATH\b/.test(verifyEnvBody) && !/env\.PATH\s*=/.test(verifyEnvBody)
      && verifyEnvBody.includes("PATH IS NOT TOUCHED")
      && read("fleet-e2e-clean-review.ts").includes("process.env.PATH"),
    `body=${verifyEnvBody !== ""} stated=${verifyEnvBody.includes("PATH IS NOT TOUCHED")}`
      + ` measured=${read("fleet-e2e-clean-review.ts").includes("process.env.PATH")}`);
  // --- THE AUDIT SNAPSHOT'S OWN GIT CONTEXT (2026-09-05). `snapshotIntegrationTree` extracts the
  // tip with `git archive`, which carries no `.git`, and the proportional chain runs `bun
  // e2e/pins.ts` in that tree NAKED — no wrapper, none of the staging `./e2e-isolated.sh` does for
  // the full chain. SIX PINS IN THIS FILE ask git what the tree tracks, and from the deploy of
  // 2026-09-05 07:36 every docs-only land was red with `fatal: not a git repository` (audit rows
  // 2e671a47 and 8a4655cb, two out of two). The rule is pinned HERE, at gate speed, and not only
  // in fleet-e2e-postland-audit.ts, because no gate runs that harness.
  // ORDER IS THE OTHER HALF, and it is not stylistic: `.gitignore`'s `node_modules/` — trailing
  // slash — does not match a SYMLINK of that name, so an index built AFTER the link holds 629
  // paths of a 628-path tree, and every pin stays green over the wrong number. The offsets are
  // compared rather than the presence of both lines, because presence is what the reversed
  // version also has.
  // NO COMMIT is the third fact and it is deliberate: a fabricated HEAD would answer
  // `git rev-parse HEAD` with a sha that is NOT the audited mainSha, turning a question that
  // currently fails as itself into a wrong answer in a right shape.
  // AND IT IS THE SHORT CHAIN'S ALONE, held as the CALL's own argument. The full chain stages its
  // own repo, and a `.git` here would make `e2e/trail-emit.ts#resolveSourceTree` — which follows a
  // staged instance's node_modules symlink and asks the target `--is-inside-work-tree` — answer YES
  // for a directory the server deletes after the run, moving every audit run's trail rows inside it
  // and out of the flake register. "The snapshot has a git context" and "the run that needs one
  // gets one" are different claims; only the second is true here.
  // Read off the STATEMENT, never the prose: both spellings occur in the comment that explains
  // them, and a pin that matches its own explanation is green on a file with no code in it.
  const snapBody = serverU.span("async function snapshotIntegrationTree(", "\n}\n", 3)?.text ?? "";
  const snapCode = snapBody.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  const snapScript = /const gitScript = ('[^']*'|"[^"]*");/.exec(snapCode)?.[1] ?? "";
  const snapAt = snapCode.indexOf("const gitScript =");
  const snapLinkAt = snapCode.indexOf("symlinkSync(");
  const snapGated = /if \(gitContext\) \{/.test(snapCode)
    && server.includes("await snapshotIntegrationTree(repo, mainSha, dir, proportional);");
  const snapProbed = read("fleet-e2e-postland-audit.ts").includes("git named this tree");
  pin("the audit snapshot gets a git context of its own, indexed BEFORE the node_modules symlink and never committed",
    snapCode !== "" && snapAt >= 0 && snapLinkAt > snapAt
      && /init -q -b main/.test(snapScript) && /add -A -f/.test(snapScript)
      && !/\bcommit\b/.test(snapCode) && snapGated && snapProbed,
    `script=${snapScript || "not found"} script@${snapAt} link@${snapLinkAt}`
      + ` commitless=${!/\bcommit\b/.test(snapCode)} shortChainOnly=${snapGated} measured=${snapProbed}`);
  pin(`${RULE_RECEIVER} — killed-empty is one word across the disposition union, the tick's assertion and the doc (D2)`,
    /type LaneDisposition = [^\n]*"killed-empty"/.test(server)
      && autoCloseTick.includes('row.disposition !== "killed-empty"')
      && !/"killed-dirty"/.test(autoCloseTick)
      && autoCloseSection.includes("killed-empty") && autoCloseSection.includes("killed-dirty"),
    `union=${/type LaneDisposition = [^\n]*"killed-empty"/.test(server)}`
      + ` assertion=${autoCloseTick.includes('row.disposition !== "killed-empty"')}`);
  // The act, as SOURCE. The trail must be written BEFORE the teardown (killSlot clears the lane
  // state buildLaneOutcome reads), the tick must never reach a land, and the timer must exist only
  // behind the flag — a registration outside that guard is a tick that arms itself.
  const emitAt = autoCloseTick.indexOf("emitLaneOutcome({ ...row, autoClose:");
  const killAt = autoCloseTick.indexOf('await killSlot(s, "owner");');
  const autoCloseForbidden = ["landLane", "mergeJob", "sendText", "removeWorktreeSafe",
    "tickDispatch", "dispatchTask"].filter((token) => new RegExp(`\\b${token}\\b`).test(autoCloseTick));
  // …and the ONE-ATTEMPT ceiling, spent BEFORE the row: the trigger is level-triggered, so a lane
  // that survives a thrown teardown would otherwise earn a second outcome row for one close.
  const triedAt = autoCloseTick.indexOf("autoCloseTried.set(s.id, s.openedAt);");
  pin(`${RULE_RECEIVER} — the auto-close records before it tears down, lands nothing, and is registered only behind the flag (D2)`,
    autoCloseTick !== "" && emitAt >= 0 && killAt > emitAt && autoCloseForbidden.length === 0
      && triedAt >= 0 && triedAt < emitAt
      && autoCloseTick.includes("autoCloseTried.get(s.id) === s.openedAt")
      && server.includes("if (LANE_AUTOCLOSE_ON) setInterval(() => void tickLaneAutoClose()")
      && (server.split("tickLaneAutoClose(").length - 2) === 1,
    `emit@${emitAt} kill@${killAt} forbidden=[${autoCloseForbidden.join(",")}]`
      + ` callSites=${server.split("tickLaneAutoClose(").length - 2}`);
  // …and the permission list is default-DENY: every clause returns a sentence, the only `null` is
  // the last line, and the two facts that cannot be re-derived elsewhere (the exact receiver
  // occupant, the Program binding) are tested here rather than inherited from the door that wrote
  // them. A guarantee an actuator inherits is a guarantee it stops noticing.
  pin(`${RULE_RECEIVER} — the auto-close permission is a list of named refusals with exactly one null (D2)`,
    autoCloseRefusal !== ""
      && (autoCloseRefusal.match(/return null;/g) ?? []).length === 1
      && autoCloseRefusal.includes("if (!autosOn) return")
      // matched by BRANCH, not merely by slot: mergeLast survives a recycle, so `has(s.id)` alone
      // would refuse forever on a slot whose PREVIOUS occupant merged
      && autoCloseRefusal.includes("verdict.branch !== s.worktree.branch")
      && autoCloseRefusal.includes("laneSpentLooking(laneSignalView(s, now), STALLED_IDLE_MS)")
      // the receiver OCCUPATION, matching both decision doors and fleetReportFrom — and the arm
      // that keeps this unattended actuator out of the owner door's reach entirely
      && autoCloseRefusal.includes("by.openedAt !== r.receiver.openedAt")
      && autoCloseRefusal.includes("program.lineage.entries.some(")
      && autoCloseRefusal.includes('if (d.by === "owner")')
      && autoCloseRefusal.includes('program.status !== "active"'),
    `nulls=${(autoCloseRefusal.match(/return null;/g) ?? []).length}`
      + ` refusals=${(autoCloseRefusal.match(/return "/g) ?? []).length}`);
  // The predicate half is COMPOSED from the stalled clause list, never restated: `stalled` and
  // `spent` must not be able to disagree about "this lane has nothing to show for itself".
  const laneSignals = read("lane-signals.ts");
  pin(`${RULE_RECEIVER} — spent-looking is STALLED_RULES plus one clean-tree clause, not a second clause list (D2)`,
    laneSignals.includes("export const SPENT_RULES: readonly LaneRule[] = [\n  ...STALLED_RULES,")
      && laneSignals.includes('{ prose: "clean tree", holds: (v) => v.git !== null && v.git.dirty === 0 },')
      && laneSignals.includes("export function laneSpentLooking("),
    `composed=${laneSignals.includes("...STALLED_RULES,")}`);

  // The footer is a LIFECYCLE instruction, and a clarify lane has a different lifecycle: it stops
  // for the owner. Appending it there would tell a lane to finish work it was told not to start.
  // THE WHOLE SEAM IS THE PIN, in order: the brief, the queue notes standing on this task's files
  // (N1 — the empty string when nothing matches, so a no-hit dispatch is byte-identical), the
  // studio's lane blocks (S2 — empty for a lane in no studio, so an unbound lane's bytes are
  // unchanged), the anchors, and the footer LAST. The order is not cosmetic: the context receipt
  // hashes the anchor block alone, so anything appended after it would be hashed as if it were an
  // anchor, and the three closing acts must be the last thing a lane reads.
  // N3 · THE THREE BOUNDS THAT MUST NOT SILENTLY DESTROY WHAT THEY BOUND. None of the three is
  // drivable from a suite — 50 distinct (task, branch) verdicts would need 50 dispatches of one
  // note — so the property is pinned from the SOURCE, which is also where each of them went wrong:
  //   · upsertNoteVerdict used `slice(-N)` and dropped the OLDEST record at the 51st key;
  //   · capTasks/delete/archive/kind each decided retention for themselves, and three of the four
  //     did not decide it at all.
  // A raised cap would make every one of these green again while changing nothing, which is why
  // the pins are about the SHAPE of the refusal and not about any number.
  {
    // The RULE is pure and lives in task-notes.ts, where e2e/tasks.ts (d7) DRIVES all three of its
    // arms — that is the proof, and this pin is not a substitute for it. What a test cannot see is
    // whether the fleet still routes through that one rule instead of growing a second copy beside
    // it, so this pin is about the BINDING: server.ts owns the bound and the `taskExists` fact and
    // nothing else, and no `slice` survives anywhere on the path.
    const upsertBody = server.match(/function upsertNoteVerdict\([\s\S]*?\n\}/)?.[0] ?? "";
    const ruleBody = read("task-notes.ts").match(/export function upsertKeyedVerdict[\s\S]*?\n\}/)?.[0] ?? "";
    pin(`${RULE_RECEIVER} — the task-verdict cap is ONE pure rule; server.ts binds it and adds no second copy (N3)`,
      upsertBody !== "" && ruleBody !== ""
        && !/\.slice\(/.test(upsertBody) && !/\.slice\(/.test(ruleBody)
        && /return upsertKeyedVerdict\(list, entry, NOTE_VERDICTS_MAX,/.test(upsertBody)
        && /tasks\.some\(\(t\) => t\.id === taskId\)/.test(upsertBody)
        // the rule's own three arms, in order: same key first, then the bound, then the refusal
        && ruleBody.indexOf("findIndex") < ruleBody.indexOf("list.length < max")
        && /return \{ ok: false, error:/.test(ruleBody)
        && /!taskExists\(v\.taskId\)/.test(ruleBody),
      upsertBody === "" ? "upsertNoteVerdict not found" : ruleBody === "" ? "upsertKeyedVerdict not found"
        : `binds=${/upsertKeyedVerdict\(list, entry/.test(upsertBody)} slice=${/\.slice\(/.test(ruleBody)}`);
    // …and the refusal has to REACH the caller. A door that ignored the false arm would answer 200
    // while a record had just been lost, which is the failure the whole rewrite is about.
    pin(`${RULE_RECEIVER} — the verdict door answers the cap's refusal with 409 instead of a silent 200 (N3)`,
      /if \(!up\.ok\) return json\(\{ error: up\.error \}, 409\);/.test(server));
    // ONE retention test, four entrances. Derived: every call site of sourceHolders is counted, so
    // a fifth door added without it shows up as a missing entrance rather than as a silent hole.
    const holderCalls = (server.match(/sourceHolders(?:In)?\(/g) ?? []).length;
    const capBody = server.match(/function capTasks\([\s\S]*?\n\}/)?.[0] ?? "";
    pin(`${RULE_RECEIVER} — capTasks, delete/archive and the kind change all ask the ONE source-retention test (N3)`,
      /const sourceHoldersIn = /.test(server) && /const sourceHolders = /.test(server)
        && holderCalls >= 5
        && /taskAct\[2\] === "delete" \|\| taskAct\[2\] === "archive"/.test(server)
        && /const kindHolders = before === "notiz" \? sourceHolders\(t\.id\) : \[\];/.test(server)
        // the cap protects what a SURVIVOR names — computed after the two keep-sets, or a terminal
        // holder would keep its source alive forever instead of releasing it when it goes itself
        && /const survivors = \[\.\.\.live, \.\.\.keptDone\];/.test(capBody)
        && /sourceHoldersIn\(survivors, t\.id\)/.test(capBody),
      `sourceHolders call sites=${holderCalls}`);
    // …and the LAND may not close a source at all. `t.status = "done"` inside applyLandToNotes is
    // allowed exactly once — the legacy path for a note nobody assigned — and that path is itself
    // gated on there being no holder and no task verdict.
    const landBody = server.match(/async function applyLandToNotes\([\s\S]*?\n\}\nasync function landLane/)?.[0] ?? "";
    pin(`${RULE_RECEIVER} — a task verdict settles the USAGE; only the unassigned legacy path closes a note (N3)`,
      landBody !== ""
        && (landBody.match(/t\.status = "done";/g) ?? []).length === 1
        && /v\.landedAt = at;/.test(landBody)
        && /if \(sourceHolders\(t\.id\)\.length > 0 \|\| \(t\.verdicts\?\.length \?\? 0\) > 0\) continue;/.test(landBody),
      landBody === "" ? "applyLandToNotes not found"
        : `closes=${(landBody.match(/t\.status = "done";/g) ?? []).length} settles=${/v\.landedAt = at;/.test(landBody)}`);
  }

  // K2 · THE SAME BARGAIN ON THE PROGRAM SIDE, and the one half a suite cannot see. e2e/programs.ts
  // DRIVES the behaviour (planted state, both entrances, seven counter-probes) — that is the proof.
  // What no test can observe is the ORDER inside loadState: if the Program cap ever ran before the
  // task list was read back, the reference check would ask an EMPTY queue, evict every bracket an
  // open row names, and stay green on a fresh state file that has no tasks in it at all. So the
  // ordering is pinned at the source, together with the shape that makes it an obligation: the task
  // list is a PARAMETER of capPrograms, which is what forces every call site to name the state it
  // is deciding against instead of closing over a global that may not be filled yet.
  {
    const capBody = server.match(/function capPrograms\([\s\S]*?\n\}/)?.[0] ?? "";
    const callSites = (server.match(/capPrograms\([^)]*\)/g) ?? []).filter((c) => !c.startsWith("capPrograms(list"));
    pin(`${RULE_RECEIVER} — capPrograms is asked with a task list, and keeps the COMPLETE rows an open row names (K2)`,
      capBody !== ""
        && /function capPrograms\(list: Program\[\], rows: Task\[\]\): Program\[\]/.test(capBody)
        && /!taskTerminal\(t\)/.test(capBody)
        && /referenced\.has\(p\.id\)/.test(capBody)
        // the set is built from rows that EXIST; nothing here reaches back into `programs`
        && !/programs\./.test(capBody)
        // every entrance hands over the live queue — a call site that forgot it would not compile,
        // but one that passed `[]` to silence the compiler would, and that is what is counted here
        && callSites.length === 3 && callSites.every((c) => c.endsWith(", tasks)")),
      capBody === "" ? "capPrograms not found"
        : `callSites=${callSites.length} ${callSites.join(" | ")}`);
    // THE ORDER, read off the one file that decides it. `tasks = capTasks(tasks)` is the last write
    // to the task list in loadState; the Program cap must come after it.
    const tasksCapAt = server.indexOf("      tasks = capTasks(tasks);");
    const programsCapAt = server.indexOf("      programs = capPrograms(loaded, tasks);");
    pin(`${RULE_RECEIVER} — loadState reads the task list back BEFORE it caps Programs against it (K2)`,
      tasksCapAt > 0 && programsCapAt > 0 && tasksCapAt < programsCapAt,
      `tasksCapAt=${tasksCapAt} programsCapAt=${programsCapAt}`);
  }

  // THREE mentions since 2026-09-12, not two: the declaration, the dispatch seam, and the LANE
  // SUCCESSION brief (server.ts#buildLaneSuccessionBrief). The count is still pinned because the
  // rule it enforces is unchanged — a lane's ending must be appended at a seam, never retyped —
  // and the successor is a lane that ends exactly like the founding one, so it gets the identical
  // bytes from the identical constant. A FOURTH mention is a new hand-written copy until proven
  // otherwise, and that is what should fail here.
  pin(`${RULE_RECEIVER} — the exit footer is appended to mutating briefs only, clarify exempted at the seam`,
    /const deliveredBrief = `\$\{brief\}\$\{notesBlock\}\$\{snippetBlock\}\$\{studioLaneBlock\}\$\{anchorBlock\}\$\{clarify \? "" : LANE_EXIT_FOOTER\}`;/.test(server)
      && /\]\.join\("\\n"\) \+ LANE_EXIT_FOOTER;/.test(server)
      && (server.split("LANE_EXIT_FOOTER").length - 1) === 3,
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
  // The rail is COMPOSED since the execution-profile cut: one head, one selected role paragraph,
  // one tail. Read the parts and join them the way the server joins them, so this rule keeps
  // measuring the DELIVERED text rather than one constant's spelling — and so the game-maker
  // composition is measurable at all.
  const railPart = (name: string): string =>
    server.match(new RegExp(`const ${name} = \`[\\s\\S]*?\\n[^\\n]*\`;`))?.[0] ?? "";
  const railHead = railPart("RAIL_HEAD");
  const railRoleStandard = railPart("RAIL_ROLE_STANDARD");
  const railRoleGameMaker = railPart("RAIL_ROLE_GAME_MAKER");
  const railTail = railPart("RAIL_TAIL");
  const rail = railHead === "" || railRoleStandard === "" || railTail === ""
    ? "" : railHead + railRoleStandard + railTail;
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
    rail === "" ? "the RAIL_HEAD / RAIL_ROLE_STANDARD / RAIL_TAIL parts were not all found in server.ts"
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
  // (D) THE PROFILE SELECTS ITS ROLE PARAGRAPH, IT DOES NOT APPEND AN OVERRIDE. Two role paragraphs
  // exist and they say opposite things about substantial work; the composition is what guarantees a
  // founding text carries exactly one. The falsifier this closes: a game-maker rail that still
  // carried "Use an isolated worker lane for substantial product implementation" beside its own
  // licence to work serially, leaving the session to follow whichever sentence it reached first.
  // The owner's amendment is checked on the portable-contract side too, since that is where a
  // session actually binds to it.
  const gameMakerRail = railHead === "" || railRoleGameMaker === "" || railTail === ""
    ? "" : railHead + railRoleGameMaker + railTail;
  const checkpointFields = [...(server.match(
    /const GAME_CHECKPOINT_FIELDS = \[([\s\S]*?)\] as const;/)?.[1] ?? "")
    .matchAll(/"([^"]+)"/g)].map((match) => match[1]!);
  const documentedCheckpointFields = (text: string, label: string): string[] =>
    [...(text.match(new RegExp(`${label}: ([^\\n]+)`))?.[1] ?? "").matchAll(/`([^`]+)`/g)]
      .map((match) => match[1]!);
  const selfApiCheckpointFields = documentedCheckpointFields(selfApiDoc, "Checkpoint-Feldreihenfolge");
  const studioDoc = read("docs/product-studio-working-circle.md");
  const studioCheckpointFields = documentedCheckpointFields(studioDoc, "Checkpoint field order");
  const gmExclusive = gameMakerRail !== ""
    && !gameMakerRail.includes("Use an isolated worker lane for substantial product implementation")
    && !gameMakerRail.includes("THE ROLE SPLIT IS A JUDGEMENT, NOT A WALL")
    && gameMakerRail.includes("SUBSTANTIAL SERIAL PRODUCT WORK MAY STAY IN THIS PANE")
    && gameMakerRail.includes("fresh independent cross-model Review")
    && gameMakerRail.includes("SENSORY CRITIC IS POST-PLAY ONLY")
    && gameMakerRail.includes('KEEP THE COMMITTED "## Current game checkpoint" CURRENT')
    && railRoleGameMaker.includes('${GAME_CHECKPOINT_FIELDS.join(", ")}')
    && !railRoleStandard.includes("SUBSTANTIAL SERIAL PRODUCT WORK MAY STAY IN THIS PANE");
  const preflightOrder = [
    "FILE ONE NORMAL ARCHITECT TASK",
    "OPTIONALLY RUN ZERO TO TWO NAMED FACT/RISK PROBES",
    "THEN RUN ONE FRESH INDEPENDENT CROSS-MODEL REVIEW",
    "MAIN DISPOSITION IS EXACTLY ACCEPT, RETHINK OR OWNER",
    "NO IMPLEMENTATION TASK MAY BE FILED OR RELEASED BEFORE ACCEPT",
  ] as const;
  const preflightOrderAt = preflightOrder.map((step) => railRoleGameMaker.indexOf(step));
  const preflightDocs = [agents, selfApiDoc, studioDoc].every((text) =>
    /Architect -> 0-2 named\s+fact\/risk probes -> fresh independent cross-model Review/.test(text)
      && text.includes("ACCEPT|RETHINK|OWNER")
      && text.includes("SENSORY CRITIC IS POST-PLAY ONLY"));
  pin(`${RULE_RAIL} — every new Game Program completes one independent Preflight before implementation, while sensory Critic stays blind and post-play`,
    preflightOrderAt.every((at, i) => at >= 0 && (i === 0 || at > preflightOrderAt[i - 1]!))
      && railRoleGameMaker.includes("DRAFT GAME-CARD.md")
      && railRoleGameMaker.includes("one to four executable first-slice briefs")
      && railRoleGameMaker.includes("dependencies, exclusive write set, stop, Done and literal Verify")
      && railRoleGameMaker.includes("Program, repository, Architect SHA and named probe facts")
      && railRoleGameMaker.includes("ACCEPT <final-card-sha>")
      && railRoleGameMaker.includes("LAND EXACTLY THE REVIEWER'S FINAL")
      && railRoleGameMaker.includes("copy its first-slice briefs verbatim")
      && railRoleGameMaker.includes("DIRECT SLICE")
      && railRoleGameMaker.includes("no Game Card, no HANDOFF.md and no hypotheses")
      && railRoleGameMaker.includes("sealed build, launch, real-input and capture pack")
      && preflightDocs,
    `order=[${preflightOrderAt.join(",")}] docs=${preflightDocs}`);
  const preflightTruthMarkers = [
    "BINDING ROLE OBLIGATION, NOT A SERVER GATE",
    "EXISTING DOORS DO NOT AUTHORIZE A BYPASS",
    "Architect task/model/SHA",
    "Reviewer task/model/reported SHA",
    "actual landed SHA",
    "Fleet does not assemble or prove this receipt",
    "owner lands that exact Reviewer commit from the Board",
    "need not be one of the Card's named first slices",
    "owner-confirmed core pivot or new game inside an existing Program starts a new Preflight",
    "Hashes identify the sealed bytes only",
    "blindness and delivery are operator-attested or unknown",
  ] as const;
  const compactText = (text: string): string => text.replace(/\s+/g, " ");
  const missingRailTruth = preflightTruthMarkers.filter((marker) =>
    !compactText(railRoleGameMaker).includes(marker));
  const selfApiTruthMarkers = [
    "BINDING ROLE OBLIGATION, NOT A SERVER GATE",
    "EXISTING DOORS DO NOT AUTHORIZE A BYPASS",
    "Architect task/model/SHA",
    "Reviewer task/model/reported SHA",
    "actual landed SHA",
    "Fleet does not assemble or prove this receipt",
    "landet der Owner exakt diesen Reviewer-Commit über das Board",
    "muss nicht zu den benannten First Slices der Card gehören",
    "vom Owner bestätigter Core-Pivot oder ein neues Spiel in einem bestehenden Program startet einen neuen Preflight",
    "Hashes identifizieren nur die versiegelten Bytes",
    "Blindheit und Zustellung bestätigt der Operator, sonst bleiben sie `unknown`",
  ] as const;
  const docTruthSurfaces = [
    ["AGENTS.md", agents, preflightTruthMarkers],
    ["docs/self-api.md", selfApiDoc, selfApiTruthMarkers],
    ["docs/product-studio-working-circle.md", studioDoc, preflightTruthMarkers],
  ] as const;
  const missingDocTruth = docTruthSurfaces.map(([name, text, markers]) => ({
    name,
    missing: markers.filter((marker) => !compactText(text).includes(marker)),
  })).filter(({ missing }) => missing.length > 0);
  pin(`${RULE_RAIL} — Preflight names its role authority, manual receipt and hash limits without inventing machine enforcement`,
    missingRailTruth.length === 0 && missingDocTruth.length === 0,
    `railMissing=[${missingRailTruth.join(" | ")}] docsMissing=${JSON.stringify(missingDocTruth)}`);
  const client = clientU.text;
  const profileSpan = clientU.span("function profileState(", "// --- V1a");
  const profileSummary = profileSpan?.text ?? "";
  pin(`${RULE_RAIL} — the Board profile summary names re-Preflight and the operator-run post-play Critic`,
    profileSummary.includes("new game or owner-confirmed core pivot")
      && profileSummary.includes("Preflight")
      && profileSummary.includes("Sensory Critic is an operator-run post-play act")
      && !profileSummary.includes("fresh-critic work still goes"),
    `profileFound=${profileSpan !== null} pivot=${profileSummary.includes("new game or owner-confirmed core pivot")} preflight=${profileSummary.includes("Preflight")} postPlay=${profileSummary.includes("Sensory Critic is an operator-run post-play act")} stale=${profileSummary.includes("fresh-critic work still goes")}`);
  pin(`${RULE_RAIL} — the Game-Maker rail, machine gate and both operator contracts share one ordered checkpoint vocabulary`,
    checkpointFields.length === 7
      && JSON.stringify(selfApiCheckpointFields) === JSON.stringify(checkpointFields)
      && JSON.stringify(studioCheckpointFields) === JSON.stringify(checkpointFields)
      && railRoleGameMaker.includes('${GAME_CHECKPOINT_FIELDS.join(", ")}')
      && /Last replay: <[^>\n]*seed[^>\n]*input[^>\n]*capture[^>\n]*>/i.test(studioDoc),
    `machine=[${checkpointFields.join(", ")}] selfApi=[${selfApiCheckpointFields.join(", ")}] studio=[${studioCheckpointFields.join(", ")}] railSource=${railRoleGameMaker.includes('${GAME_CHECKPOINT_FIELDS.join(", ")}')}`);
  const checkpointReaderAt = server.indexOf("function readGameCheckpoint(");
  const checkpointReader = checkpointReaderAt < 0 ? "" : server.slice(checkpointReaderAt,
    server.indexOf("async function gameMakerCheckpointError", checkpointReaderAt));
  pin(`${RULE_RAIL} — the checkpoint reader enforces that shared vocabulary as an exact order, not a set`,
    checkpointReader.includes("GAME_CHECKPOINT_FIELDS.findIndex")
      && checkpointReader.includes("checkpoint field order must be")
      && checkpointReader.indexOf("GAME_CHECKPOINT_FIELDS.findIndex")
        < checkpointReader.indexOf("return { ok: true, build }")
      && read("e2e/programs.ts").includes('["a shuffled field order"'),
    "ordered reader or shuffled-field runtime rejection missing");
  const agentsProfile = agents.includes("Game-Maker Program-MAIN")
    && agents.includes("causally coupled product act");
  // (E) THE LEGACY STANDARD RAIL IS FROZEN, AND THE HASH IS THE POINT. e2e/programs.ts proves the
  // four founding shapes carry ONE block byte for byte — which is true of four shapes that drifted
  // TOGETHER, and the whole rail is now composed, so a change to the shared head or tail moves all
  // four at once and that check stays green. This row is the change-control rule the composition
  // needs: the standard rail's bytes are pinned to a baseline, so editing it is a deliberate act
  // that updates this constant, never a side effect of touching the profile beside it. Rewrite the
  // baseline ONLY when the text was meant to change, and say so in the commit body.
  const RAIL_STANDARD_SHA256 = "bfba216cd986eb70d47046c244c321a9bfed8468b9caa9e7e0c72ea50e860065";
  const railBody = (part: string): string =>
    part === "" ? "" : part.slice(part.indexOf("`") + 1, part.lastIndexOf("`"));
  const standardBytes = rail === ""
    ? "" : railBody(railHead) + railBody(railRoleStandard) + railBody(railTail);
  const standardSha = standardBytes === ""
    ? "" : createHash("sha256").update(standardBytes).digest("hex");
  pin(`${RULE_RAIL} — the legacy Standard rail still hashes to its pinned baseline (E)`,
    standardSha === RAIL_STANDARD_SHA256,
    standardBytes === "" ? "the rail parts were not all found in server.ts"
      : `bytes=${standardBytes.length} sha256=${standardSha}`);
  pin(`${RULE_RAIL} — the game-maker role paragraph REPLACES the generic one, and the portable contract names the same exception (D)`,
    gmExclusive && agentsProfile && !/\b\d+\s*(lines|files|LOC)\b/.test(gameMakerRail),
    `exclusive=${gmExclusive} agents=${agentsProfile} gmLen=${gameMakerRail.length}`);
}

// --- THE GAME-MAKER TREE IS A LEASE, NOT A ONE-TIME PREFLIGHT. The runtime suite races the two
// request orders and proves the resulting topology. These source rules cover the pieces a
// single-process happy path cannot see: reservation before the first await, object-identity release,
// the common open gate, and an error whose 409 mapping cannot widen every existing open failure.
{
  const RULE_GM_TREE = "a Game-Maker tree stays exclusive from request entry through receipt, at the shared open seam";
  const openAt = server.indexOf("async function openSlot(");
  const openBody = openAt < 0 ? "" : server.slice(openAt, server.indexOf("\n}\n", openAt) + 3);
  const bootstrapAt = server.indexOf("async function bootstrapProgramMainReserved(");
  const bootstrapBody = bootstrapAt < 0 ? "" : server.slice(bootstrapAt, server.indexOf("\n}\n", bootstrapAt) + 3);
  const succeedAt = server.indexOf("async function succeedProgramMain(");
  const succeedBody = succeedAt < 0 ? "" : server.slice(succeedAt, bootstrapAt);
  pin(`${RULE_GM_TREE} — process-local lease and open-intent reservations exist beside laneSpawn`,
    /interface GameMakerTreeLease[\s\S]*?programId: string[\s\S]*?requestedRoot: string[\s\S]*?canonicalRoot: string \| null[\s\S]*?predecessor:/.test(server)
      && /const gameMakerTreeLeases = new Set<GameMakerTreeLease>\(\)/.test(server)
      && /interface OpenSlotIntent/.test(server)
      && /const openSlotIntents = new Set<OpenSlotIntent>\(\)/.test(server),
    "lease/open-intent declarations are missing or incomplete");
  pin(`${RULE_GM_TREE} — bootstrap and succession reserve before preflight, canonicalize after it, permit only their exact lease, and release by object identity`,
    bootstrapBody.indexOf("reserveProgramFounding") >= 0
      && bootstrapBody.indexOf("reserveProgramFounding") < bootstrapBody.indexOf("await preflightProgramMain")
      && bootstrapBody.indexOf("canonicalizeGameMakerTreeLease") > bootstrapBody.indexOf("await preflightProgramMain")
      && /openSlot\([\s\S]*?treeLease\)/.test(bootstrapBody)
      && /releaseGameMakerTreeLease\(treeLease\)/.test(bootstrapBody)
      && succeedBody.indexOf("reserveProgramFounding") >= 0
      && succeedBody.indexOf("reserveProgramFounding") < succeedBody.indexOf("await preflightProgramMain")
      && succeedBody.indexOf("canonicalizeGameMakerTreeLease") > succeedBody.indexOf("await preflightProgramMain")
      && /openSlot\([\s\S]*?treeLease\)/.test(succeedBody)
      && /releaseGameMakerTreeLease\(treeLease\)/.test(succeedBody),
    `bootstrap=${bootstrapBody.length} succession=${succeedBody.length}`);
  pin(`${RULE_GM_TREE} — openSlot checks the shared Game-Maker gate and holds one intent until its finally`,
    openBody.includes("assertGameMakerTreeOpen")
      && openBody.includes("openSlotIntents.add(openIntent)")
      && openBody.includes("openSlotIntents.delete(openIntent)")
      && openBody.includes("finally"),
    `openSlot=${openBody.length}`);
  const firstFoundingPermit = openBody.indexOf("assertProgramFoundingTargetOpen");
  const secondFoundingPermit = openBody.indexOf("assertProgramFoundingTargetOpen", firstFoundingPermit + 1);
  const orphanTeardown = openBody.indexOf('await killSlot(s, "reopen")');
  const testLatch = openBody.indexOf("await waitForGameMakerOpenTestLatch(treeLease)");
  pin(`${RULE_GM_TREE} — openSlot revalidates its exact founding permit after tmux teardown and before Slot mutation`,
    firstFoundingPermit >= 0
      && openBody.indexOf("await waitForSlotTeardown(s.id)") >= 0
      && orphanTeardown > openBody.indexOf("await waitForSlotTeardown(s.id)")
      && secondFoundingPermit > orphanTeardown
      && secondFoundingPermit < openBody.indexOf("s.cwd = cwd"),
    `first=${firstFoundingPermit} teardown=${orphanTeardown} second=${secondFoundingPermit} mutation=${openBody.indexOf("s.cwd = cwd")}`);
  pin(`${RULE_GM_TREE} — the default-off E2E latch sits only after orphan teardown and before the second permit check`,
    server.includes("process.env.FLEET_TEST_GAME_MAKER_OPEN_LATCH ?? null")
      && orphanTeardown >= 0 && testLatch > orphanTeardown && testLatch < secondFoundingPermit
      && read("e2e/programs.ts").includes("FLEET_TEST_GAME_MAKER_OPEN_LATCH: gmPreOpenKillLatch")
      && read("e2e/programs.ts").includes("gmPreOpenKillReached")
      && read("e2e/programs.ts").includes("gmPreOpenKillRelease"),
    `teardown=${orphanTeardown} latch=${testLatch} second=${secondFoundingPermit}`);
  const ensureAt = server.indexOf("async function ensureSlot(");
  const ensureBody = ensureAt < 0 ? "" : server.slice(ensureAt, server.indexOf("\n}\n", ensureAt) + 3);
  const killAt = server.indexOf("async function killSlot(");
  const killBody = killAt < 0 ? "" : server.slice(killAt, server.indexOf("\n}\n", killAt) + 3);
  const teardownAt = server.indexOf("async function teardownSlotOccupant(");
  const teardownBody = teardownAt < 0 ? "" : server.slice(teardownAt, killAt);
  const hasAwait = ensureBody.indexOf('await tmux("has-session"');
  const afterHasIdentity = ensureBody.indexOf("sameSlotSpawnOccupant(s, occupant)", hasAwait);
  const beforeSpawnIdentity = ensureBody.lastIndexOf("sameSlotSpawnOccupant(s, occupant)",
    ensureBody.indexOf("tmuxNewSession("));
  pin(`${RULE_GM_TREE} — self-heal snapshots the occupant, rechecks after has-session and before spawn, while teardown joins the spawn commit`,
    /let occupant = slotSpawnOccupant\(s\)/.test(ensureBody)
      && hasAwait >= 0 && afterHasIdentity > hasAwait
      && beforeSpawnIdentity > afterHasIdentity
      && beforeSpawnIdentity < ensureBody.indexOf("tmuxNewSession(")
      && ensureBody.includes("slotSpawnInflight.set(s.id, spawn)")
      && ensureBody.includes("if (slotSpawnInflight.get(s.id) === spawn) slotSpawnInflight.delete(s.id)")
      && /const concurrentSpawn = slotSpawnInflight\.get\(s\.id\);[\s\S]*?if \(concurrentSpawn\) \{ await concurrentSpawn; return; \}[\s\S]*?if \(!sameSlotSpawnOccupant\(s, occupant\) \|\| slotTeardownInflight\.has\(s\.id\)\) return;[\s\S]*?slotSpawnInflight\.set\(s\.id, spawn\)/.test(ensureBody)
      && ensureBody.includes("if (slotTeardownInflight.has(s.id)) return")
      && openBody.indexOf("await waitForSlotTeardown(s.id)") < openBody.indexOf("await waitForSlotSpawn(s.id)")
      && teardownBody.indexOf("await waitForSlotSpawn(streamOccupant.slot)") < teardownBody.indexOf('audit("slot_kill"'),
    `has=${hasAwait} after=${afterHasIdentity} before=${beforeSpawnIdentity} spawn=${ensureBody.indexOf("tmuxNewSession(")}`);
  const streamPathAt = server.indexOf("const occupantStreamPath");
  const stageWriteAt = ensureBody.indexOf("await Bun.write(stagePath");
  const postCaptureLatchAt = ensureBody.indexOf("await waitForSlotPostCaptureTestLatch");
  const publishAt = ensureBody.indexOf("renameSync(stagePath, finalPath)");
  const exactPipeAt = ensureBody.indexOf('tmux("pipe-pane", "-t", target.paneId');
  const exactRepaintAt = ensureBody.indexOf("await repaint(target.windowId)");
  pin(`${RULE_GM_TREE} — stream files are occupant-specific and a staged capture publishes only after the post-capture identity recheck`,
    streamPathAt >= 0 && server.includes("createHash(\"sha256\").update(occupant.selfToken)")
      && ensureBody.includes("const finalPath = occupantStreamPath(occupant)")
      && ensureBody.includes("const stagePath = occupantStreamStagePath(occupant)")
      && postCaptureLatchAt > ensureBody.indexOf('tmux("capture-pane", "-t", target.paneId')
      && stageWriteAt > postCaptureLatchAt
      && ensureBody.indexOf("sameSlotSpawnOccupant(s, occupant)", stageWriteAt) > stageWriteAt
      && publishAt > ensureBody.indexOf("sameSlotSpawnOccupant(s, occupant)", stageWriteAt),
    `path=${streamPathAt} latch=${postCaptureLatchAt} write=${stageWriteAt} publish=${publishAt}`);
  pin(`${RULE_GM_TREE} — capture/pipe/repaint bind immutable tmux pane/window ids, never the reusable sN name`,
    ensureBody.includes('"-P", "-F", "#{pane_id}\\t#{window_id}"')
      && ensureBody.includes("await existingTmuxTarget(name)")
      && exactPipeAt >= 0 && exactRepaintAt > exactPipeAt
      && !/tmux\("(?:capture-pane|pipe-pane)"[\s\S]*?"-t", name/.test(ensureBody),
    `pipe=${exactPipeAt} repaint=${exactRepaintAt}`);
  // tmux resolves a bare `-t name` exact-first and PREFIX second: with `s1` gone, `-t s1` lands on
  // `s10` (measured 2026-09-01 — a founding brief for slot 1 was pasted into the controller's pane in
  // slot 10, and a kill of slot 1 would have killed it). Every tmux() call that targets by NAME goes
  // through sessTarget (`=name`, session verbs) or paneTarget (`=name:`, pane/window verbs); the
  // immutable %pane/@window ids are exact by construction. e2e/slots.ts proves the has-session path
  // live; this pin closes the class for every other verb without booting a server.
  const RULE_EXACT_TARGET = "no tmux() call passes a bare session name as -t (only sessTarget/paneTarget or an immutable pane/window id)";
  const targetArgs = [...server.matchAll(/\btmux\("[a-z-]+"[^\n]*?"-t", ([^,)]+)/g)].map((m) => m[1]);
  const looseTargets = targetArgs.filter((a) => !/^(?:sessTarget\(|paneTarget\(|exact$|windowId$|\w+\.(?:paneId|windowId)$)/.test(a));
  pin(`${RULE_EXACT_TARGET} — the -t argument set is derived from server.ts and not empty`,
    targetArgs.length >= 20 && server.includes("const sessTarget = (name: string): string => `=${name}`")
      && server.includes("const paneTarget = (name: string): string => `=${name}:`"),
    `${targetArgs.length} -t sites`);
  pin(RULE_EXACT_TARGET, looseTargets.length === 0, looseTargets.length ? looseTargets.join(" | ") : `${targetArgs.length} sites, all exact`);
  pin(`${RULE_GM_TREE} — only tmuxNewSession owns new-session, with bounded TERM/KILL and honest invalid-env fallback`,
    !server.includes('tmux("new-session"')
      && server.includes("async function tmuxNewSession(")
      && server.includes("TMUX_NEW_SESSION_TIMEOUT_MS")
      && server.includes("FLEET_TMUX_NEW_SESSION_TIMEOUT_MS")
      && /raw !== undefined && \/\^\\d\+\$\/\.test\(raw\)/.test(server)
      && server.includes("p.kill()") && server.includes("p.kill(9)")
      && ensureBody.includes("await tmuxNewSession(")
      && read("e2e/slots.ts").includes('FLEET_TMUX_NEW_SESSION_TIMEOUT_MS: "150"'),
    "new-session bypass, timeout escalation, invalid-env fallback, or runtime arm is missing");
  pin(`${RULE_GM_TREE} — new-session errors never reflect child output because its argv contains raw pane credentials`,
    !ensureBody.includes('created.err || created.out || "no diagnostic"')
      && read("e2e/programs.ts").includes('!safeText.includes("FLEET_SELF_TOKEN")')
      && read("e2e/programs.ts").includes("printf '%s\\\\n' \"$*\" >&2"),
    "tmux child output can still cross an API error or the adversarial diagnostic probe is missing");
  pin(`${RULE_GM_TREE} — teardown removes only its captured occupant stream and the legacy sN.raw name is migration-only`,
    killBody.includes("const streamOccupant = slotStreamOccupant(s)")
      && teardownBody.includes("sameSlotStreamOccupant(s, streamOccupant)")
      && teardownBody.includes("occupantStreamPath(streamOccupant)")
      && ensureBody.includes("legacyStreamPath(s.id)")
      && read("e2e/slots.ts").includes("slot-post-capture-latch"),
    "exact cleanup, legacy migration, or deterministic stale-continuation arm is missing");

  const sendAt = server.indexOf("async function sendText(");
  const sendBody = sendAt < 0 ? "" : server.slice(sendAt, server.indexOf("\n}\n", sendAt) + 3);
  const wsAt = server.indexOf("websocket: {");
  const wsBody = wsAt < 0 ? "" : server.slice(wsAt, server.indexOf("\n  },\n});", wsAt));
  const ownerWsUpgradeAt = server.indexOf("const wsMatch = /^\\/ws\\/(\\d+)$/");
  const ownerWsUpgradeBody = ownerWsUpgradeAt < 0 ? ""
    : server.slice(ownerWsUpgradeAt, server.indexOf('if (url.pathname === "/api/sessions")', ownerWsUpgradeAt));
  const occupantCaptureAt = sendBody.indexOf("const occupant = slotStreamOccupant(s)");
  const enqueueAt = sendBody.indexOf("s.inputChain.then");
  const targetAt = sendBody.indexOf("await existingTmuxTarget(sess(occupant.slot))", enqueueAt);
  const pasteAt = sendBody.indexOf('tmux("paste-buffer"');
  const enterAt = sendBody.indexOf('tmux("send-keys"');
  pin(`${RULE_GM_TREE} — every composed send binds one caller-time occupant and immutable pane through paste, Enter, reads and rollback`,
    occupantCaptureAt >= 0 && occupantCaptureAt < enqueueAt && targetAt > enqueueAt
      && sendBody.includes("sameBoundPane(s, bound)")
      && pasteAt > targetAt && sendBody.indexOf("sameBoundPane(s, bound)", targetAt) < pasteAt
      && enterAt > pasteAt && sendBody.lastIndexOf("sameBoundPane(s, bound)", enterAt) >= pasteAt
      && !/tmux\("(?:capture-pane|paste-buffer|send-keys)"[\s\S]*?"-t", sess\(s\.id\)/.test(sendBody)
      && server.includes("readComposer(s, bound)") && server.includes("readExactComposer(s, bound)")
      && server.includes("awaitComposer(s, bound,") && server.includes("rollbackOwnComposerPayload(s, bound,"),
    `capture=${occupantCaptureAt} enqueue=${enqueueAt} target=${targetAt} paste=${pasteAt} enter=${enterAt}`);
  pin(`${RULE_GM_TREE} — composed sends own unique tmux buffers and delete them in finally`,
    sendBody.includes("randomBytes(8).toString(\"hex\")")
      && sendBody.includes('tmux("delete-buffer", "-b", buf)') && sendBody.includes("finally"),
    "sendText lacks a unique buffer or its finally cleanup");
  const teardownRegisterAt = killBody.indexOf("slotTeardownInflight.set(s.id, latch)");
  const teardownAwaitAt = killBody.indexOf("await promise");
  const cwdNullAt = teardownBody.indexOf("s.cwd = null");
  const teardownSaveAt = teardownBody.indexOf("saveState()", cwdNullAt);
  pin(`${RULE_GM_TREE} — teardown registers synchronously, joins duplicates, stops an exact pane and publishes cwd null last`,
    server.includes("const slotTeardownInflight = new Map<number, SlotTeardownLatch>()")
      && killBody.includes("if (existing) { await existing.promise; return; }")
      && teardownRegisterAt >= 0 && teardownRegisterAt < teardownAwaitAt
      && teardownBody.includes('tmux("kill-pane", "-t", target.paneId)')
      && !teardownBody.includes('tmux("kill-session", "-t", sess(s.id))')
      && teardownBody.includes("s.inputChain = Promise.resolve()")
      && teardownBody.includes("s.resizeChain = Promise.resolve()")
      && cwdNullAt > teardownBody.indexOf("s.clients.clear()")
      && teardownSaveAt > cwdNullAt
      && !teardownBody.slice(cwdNullAt, teardownSaveAt).includes("await "),
    `register=${teardownRegisterAt}/${teardownAwaitAt} cwdNull=${cwdNullAt} save=${teardownSaveAt}`);
  pin(`${RULE_GM_TREE} — owner WebSocket input stores and rechecks an occupant-bound immutable pane`,
    /ownerInput\?: \{ occupant: SlotStreamOccupant; paneId: string \}/.test(server)
      && ownerWsUpgradeBody.indexOf("await existingTmuxTarget(sess(occupant.slot))")
        < ownerWsUpgradeBody.indexOf("server.upgrade(req")
      && ownerWsUpgradeBody.includes("sameSlotStreamOccupant(s, occupant)")
      && ownerWsUpgradeBody.includes("ownerInput: { occupant, paneId: inputTarget.paneId }")
      && wsBody.includes("const inputBinding = ws.data.share ? undefined : ws.data.ownerInput")
      && wsBody.includes("const binding = ws.data.ownerInput")
      && wsBody.includes('tmux("send-keys", "-t", binding.paneId')
      && wsBody.includes("sameSlotStreamOccupant(s, binding.occupant)")
      && !wsBody.includes('tmux("send-keys", "-t", sess(s.id)'),
    "owner WS input is not bound to one occupant and %pane");
  const lifecycleRuntime = read("e2e/slots.ts");
  const foundingRuntime = read("e2e/programs.ts");
  pin(`${RULE_GM_TREE} — runtime names queued-send, post-paste, owner-WS and teardown/recycle race arms`,
    foundingRuntime.includes("queued founding send cannot paste into a recycled candidate")
      && foundingRuntime.includes("pasted founding brief cannot Enter or bind after candidate recycle")
      && lifecycleRuntime.includes("old owner WS input cannot reach the recycled occupant")
      && lifecycleRuntime.includes("teardown keeps A published, joins duplicate kill, suppresses heal and preserves B"),
    "one or more deterministic P2a runtime arms are absent");
  pin(`${RULE_GM_TREE} — only the dedicated conflict type selects 409 at owner open seams`,
    /class GameMakerTreeConflict extends Error/.test(server)
      && /e instanceof GameMakerTreeConflict \? 409 : 400/.test(server)
      && /e instanceof GameMakerTreeConflict \? 409 : 500/.test(server),
    "the typed conflict or its narrow HTTP mappings are missing");
  pin(`${RULE_GM_TREE} — Fleet and candidate repository identity both fail closed`,
    /FLEET_GIT_COMMON === null \|\| v\.commonDir === null/.test(server),
    "gameMakerMachineError does not reject an unreadable Fleet or candidate common-dir");
}

// --- THE OWNER RESEED READS THE SEAM TWICE (§11.2b). A stat taken only BEFORE the capture lets a line
// written in between reach the seed AND the live bytes — the `42 marks, 1..41` duplicate the runtime
// check caught at ~1 %, a rate no single suite run can prove away. So the ORDER is pinned: stat →
// capture → stat, the exact case gated on equal sizes, a round cap, and a fallback that stays on the
// gap-safe side (the stat before the last capture). Remove the second stat and this goes red.
{
  const seedSpan = serverU.span("async function ownerSeedCapture(", "\n}\n");
  const body = seedSpan?.text ?? "";
  const beforeAt = body.indexOf("let before = await sizeOf()");
  const captureAt = body.indexOf('tmux("capture-pane", "-t", target.paneId');
  const afterAt = body.indexOf("const after = await sizeOf()");
  const exitAt = body.indexOf("if (after === before || after === null || round >= OWNER_SEED_ROUNDS) return { cap: cap.out, seedUntil: before }");
  const advanceAt = body.indexOf("before = after;");
  const wsAt = server.indexOf("websocket: {");
  const wsBody = wsAt < 0 ? "" : server.slice(wsAt, server.indexOf("\n  },\n});", wsAt));
  const ownerAt = wsBody.indexOf("// Owner reconnect at a width that already matches");
  const ownerBranch = ownerAt < 0 ? "" : wsBody.slice(ownerAt, wsBody.indexOf("ws.data.ready = true", ownerAt));
  pin("owner reseed seeds between two stream stats: stat → capture → stat, exact only when equal, capped at 3 rounds, fallback never past a pre-capture stat",
    seedSpan !== null
      && beforeAt >= 0 && captureAt > beforeAt && afterAt > captureAt && exitAt > afterAt && advanceAt > exitAt
      && /const OWNER_SEED_ROUNDS = 3;/.test(server)
      && body.includes("if (before === null) return { cap: cap.out, seedUntil: 0 }")
      && (body.match(/if \(!live\(\)\) return null;/g) ?? []).length === 3
      && ownerBranch.includes("await ownerSeedCapture(s, occupant, streamFile, target, seedLines)")
      && ownerBranch.includes("ws.data.seedUntil = seeded.seedUntil")
      && !ownerBranch.includes("stat(streamFile)") && !ownerBranch.includes('tmux("capture-pane"'),
    `span=${seedSpan !== null} before=${beforeAt} capture=${captureAt} after=${afterAt} exit=${exitAt} advance=${advanceAt} owner=${ownerAt}`);
}

// Standard and Game-Maker founding share one durable v2 transition. These rules pin the three
// boundaries a happy-path bootstrap cannot prove: closed marker identity, marker/Slot publication
// before pane creation, and the typed unknown response that preserves a pending recovery marker.
{
  const RULE_FOUNDING_V2 = "Program.founding v2 owns every Program-MAIN attempt without becoming a second lifecycle";
  const openAt = server.indexOf("async function openSlot(");
  const openBody = openAt < 0 ? "" : server.slice(openAt, server.indexOf("\n}\n", openAt) + 3);
  const persistAt = server.indexOf("async function persistProgramFounding(");
  const persistBody = persistAt < 0 ? "" : server.slice(persistAt, server.indexOf("\n}\n", persistAt) + 3);
  const bootstrapAt = server.indexOf("async function bootstrapProgramMainReserved(");
  const bootstrapBody = bootstrapAt < 0 ? "" : server.slice(bootstrapAt,
    server.indexOf("async function handleOwnerProgramRoute", bootstrapAt));
  const succeedAt = server.indexOf("async function succeedProgramMain(");
  const succeedBody = succeedAt < 0 ? "" : server.slice(succeedAt, bootstrapAt);
  const recoveryAt = server.indexOf("async function recoverInterruptedProgramFoundings(");
  const recoveryBody = recoveryAt < 0 ? "" : server.slice(recoveryAt,
    server.indexOf("// These answer different questions", recoveryAt));
  const unavailableAt = server.indexOf("async function unavailableFoundingResponse(");
  const unavailableBody = unavailableAt < 0 ? "" : server.slice(unavailableAt, recoveryAt);
  const unavailableResultAt = server.indexOf("const foundingUnavailableResponse =");
  const unavailableResultBody = unavailableResultAt < 0 ? "" : server.slice(unavailableResultAt,
    server.indexOf("// --- the ONE assembly point", unavailableResultAt));

  pin(`${RULE_FOUNDING_V2} — the closed marker binds profile, root, both occupant generations and no raw token`,
    /interface ProgramFoundingV2[\s\S]*?v: 2[\s\S]*?profileKind: ProgramFoundingProfileKind[\s\S]*?targetRoot: string[\s\S]*?target: ProgramFoundingIdentity[\s\S]*?predecessor: ProgramFoundingIdentity \| null/.test(server)
      && /interface ProgramFoundingOccupant \{ slot: number; openedAt: number \}/.test(server)
      && /interface ProgramFoundingIdentity extends ProgramFoundingOccupant \{ selfTokenHash: string \}/.test(server)
      && server.includes('/^[0-9a-f]{64}$/')
      && !persistBody.includes("selfToken:"),
    "v2 profile/root/hashed occupant schema or raw-token exclusion is missing");
  const markerSaveAt = persistBody.indexOf("await saveStateNow()");
  const slotSaveAt = openBody.indexOf("await saveStateNow()");
  const ensureAt = openBody.indexOf('await ensureSlot(s, "open")');
  pin(`${RULE_FOUNDING_V2} — marker save precedes open and the exact Slot row is durable before tmux`,
    markerSaveAt >= 0
      && bootstrapBody.indexOf("await persistProgramFounding") < bootstrapBody.indexOf("await openSlot")
      && succeedBody.indexOf("await persistProgramFounding") < succeedBody.indexOf("await openSlot")
      && openBody.includes("treeLease?.founding?.target.openedAt")
      && openBody.includes("treeLease?.targetSelfToken")
      && slotSaveAt >= 0 && slotSaveAt < ensureAt,
    `markerSave=${markerSaveAt} slotSave=${slotSaveAt} ensure=${ensureAt}`);
  pin(`${RULE_FOUNDING_V2} — Standard preserves the exact requested cwd while Game-Maker canonicalizes the protected repository tree`,
    /lease\.canonicalRoot = lease\.profileKind === "game-maker"\s*\? repoCanon\(repoRoot\) : lease\.requestedRoot/.test(server),
    "profile-specific targetRoot canonicalization is missing");
  pin(`${RULE_FOUNDING_V2} — timeout is a 503 unknown result, exact rollback decides rolled-back versus pending, and retry reuses affected`,
    bootstrapBody.includes("e instanceof TmuxNewSessionUnavailable")
      && succeedBody.includes("e instanceof TmuxNewSessionUnavailable")
      && unavailableResultBody.includes('availability: "unknown"')
      && unavailableResultBody.includes("foundingAffected(founding)")
      && unavailableResultBody.includes("}, 503)")
      && unavailableBody.includes('foundingUnavailableResponse(founding, "rolled-back"')
      && unavailableBody.includes('foundingUnavailableResponse(founding, "pending"')
      && unavailableBody.indexOf("await rollbackProgramFounding")
        < unavailableBody.indexOf('foundingUnavailableResponse(founding, "rolled-back"')
      && unavailableBody.includes("const safeError =")
      && !unavailableBody.includes("error.message")
      && bootstrapBody.includes("foundingUnavailableResponse")
      && succeedBody.includes("foundingUnavailableResponse")
      && recoveryBody.includes("isStandardFounding(founding)")
      && recoveryBody.includes("same-root token mismatch"),
    "typed timeout rollback/pending response, retry reuse, or Standard recovery branch is missing");
}

// A Game-Maker founding is a persisted transition, not a process-local promise. Runtime exercises
// the crash cuts; these rules hold the ordering and fail-closed loader/IO seams that a graceful
// single-process run cannot manufacture without killing its own server.
{
  const RULE_GM_FOUNDING = "a Game-Maker founding has one durable target identity across crash, complete and cleanup";
  const foundingSelfApi = read("docs/self-api.md");
  const foundingStudioDoc = read("docs/product-studio-working-circle.md");
  const documentedMarkerAt = foundingSelfApi.indexOf("bevor** `openSlot`");
  const documentedRecoveryAt = foundingSelfApi.indexOf("Restart und der eine Erfolgsschnitt");
  const bootstrapAt = server.indexOf("async function bootstrapProgramMain(");
  const bootstrapBody = bootstrapAt < 0 ? "" : server.slice(bootstrapAt, server.indexOf("async function handleOwnerProgramRoute", bootstrapAt));
  const succeedAt = server.indexOf("async function succeedProgramMain(");
  const succeedBody = succeedAt < 0 ? "" : server.slice(succeedAt, bootstrapAt);
  const programLoadAt = server.indexOf("const loaded: Program[] = [];");
  const programLoadBody = programLoadAt < 0 ? "" : server.slice(programLoadAt,
    server.indexOf("// The Supervisor binding", programLoadAt));
  const completeAt = server.indexOf('if (action[2] === "complete")');
  const completeBody = completeAt < 0 ? "" : server.slice(completeAt, server.indexOf('if (program.status !== "proposed")', completeAt));
  const selfSucceedAt = server.indexOf("async function handleSelfSucceed(");
  const selfSucceedBody = selfSucceedAt < 0 ? "" : server.slice(selfSucceedAt,
    server.indexOf("async function handleSelfRetire", selfSucceedAt));
  const selfRetireAt = server.indexOf("async function handleSelfRetire(");
  const selfRetireBody = selfRetireAt < 0 ? "" : server.slice(selfRetireAt,
    server.indexOf("function pruneSpentWatches", selfRetireAt));
  const bootRecoverAt = server.indexOf("await recoverInterruptedProgramFoundings(bootTmux);");
  const bootObserveAt = server.indexOf("const bootTmux = await observeTmuxSlots();");
  const bootAdoptAt = server.indexOf("if (bootTmux.known)", bootObserveAt);
  const ensureBootAt = server.indexOf("for (const s of slots) {", bootRecoverAt);
  pin(`${RULE_GM_FOUNDING} — the closed v1/v2 parser rejects malformed/unknown markers into a startup refusal, never absent`,
    /interface ProgramFoundingV1[\s\S]*?v: 1[\s\S]*?attemptId[\s\S]*?mode[\s\S]*?canonicalRoot[\s\S]*?target[\s\S]*?predecessor[\s\S]*?startedAt/.test(server)
      && /type ProgramFounding = ProgramFoundingV1 \| ProgramFoundingV2/.test(server)
      && server.includes("const loadProgramFounding =")
      && server.includes('if (r.v !== 1 && r.v !== 2) return { ok: false, error: "v must be 1 or 2" }')
      && server.includes("repoCanon(root) !== root")
      && server.includes("predecessor.slot === target.slot")
      && server.includes("startupStateRefusal")
      && server.includes("REFUSING TO START")
      && server.includes("The safety marker was left on disk for owner inspection")
      && programLoadBody.indexOf("const foundingRead =") >= 0
      && programLoadBody.indexOf("const foundingRead =") < programLoadBody.indexOf("validateProgramContent(x)")
      && programLoadBody.includes("has a legacy v1 founding marker on a Standard Program")
      && programLoadBody.includes("has a succession founding marker that does not name its current MAIN")
      && programLoadBody.includes("has a bootstrap founding marker but is not unbound"),
    "closed parser or startup refusal missing");
  pin(`${RULE_GM_FOUNDING} — marker save rejects to its caller, precedes openSlot, and exact openedAt comes from that marker`,
    server.includes("tail = run.catch(onError);") && server.includes("    return run;\n  };")
      && server.includes("const queueStateSave = coalescedSaver(")
      && bootstrapBody.indexOf("await persistProgramFounding") >= 0
      && bootstrapBody.indexOf("await persistProgramFounding") < bootstrapBody.indexOf("await openSlot")
      && succeedBody.indexOf("await persistProgramFounding") >= 0
      && succeedBody.indexOf("await persistProgramFounding") < succeedBody.indexOf("await openSlot")
      && server.includes("treeLease?.founding?.target.openedAt ?? Date.now()"),
    `bootstrap=${bootstrapBody.length} succession=${succeedBody.length}`);
  pin(`${RULE_GM_FOUNDING} — bootstrap persists marker plus unbound fallback, while succession retains its exact predecessor`,
    /if \(mode === "bootstrap"\) delete program\.main;[\s\S]*?program\.founding = founding;[\s\S]*?await saveStateNow\(\)/.test(server)
      && server.includes('mode === "bootstrap"') && server.includes("lease.predecessor === null")
      && server.includes("program.main?.slot === founding.predecessor.slot")
      && server.includes("program.main.openedAt === founding.predecessor.openedAt"),
    "the durable marker does not encode the promised bootstrap/succession fallback");
  const bootstrapCandidateAt = bootstrapBody.indexOf("const candidateIdentity: SuccessionPredecessorIdentity");
  const bootstrapSendAt = bootstrapBody.indexOf("await sendText(free, deliveredBrief, true)", bootstrapCandidateAt);
  const bootstrapAfterSendAt = bootstrapBody.indexOf("if (!stillCurrent())", bootstrapSendAt);
  const bootstrapReceiptAt = bootstrapBody.indexOf("await appendEventStrict(CONTEXT_RECEIPT_FILE", bootstrapAfterSendAt);
  const bootstrapPreBindAt = bootstrapBody.indexOf("if (!stillCurrent())", bootstrapReceiptAt);
  const bootstrapBindAt = bootstrapBody.indexOf("program.main = { slot: candidateIdentity.slot", bootstrapPreBindAt);
  pin(`${RULE_GM_FOUNDING} — Standard and Game-Maker bootstrap bind only the full live candidate after send and receipt`,
    bootstrapCandidateAt >= 0 && bootstrapBody.includes("sameSuccessionOccupant(free, candidateIdentity)")
      && bootstrapBody.includes("expectedMainCurrent") && bootstrapSendAt > bootstrapCandidateAt
      && bootstrapAfterSendAt > bootstrapSendAt && bootstrapReceiptAt > bootstrapAfterSendAt
      && bootstrapPreBindAt > bootstrapReceiptAt && bootstrapBindAt > bootstrapPreBindAt
      && !/\bprogram\.main\s*=(?!=)/.test(bootstrapBody.slice(bootstrapCandidateAt, bootstrapBindAt)),
    `candidate=${bootstrapCandidateAt} send=${bootstrapSendAt} after=${bootstrapAfterSendAt} receipt=${bootstrapReceiptAt} prebind=${bootstrapPreBindAt} bind=${bootstrapBindAt}`);
  pin(`${RULE_GM_FOUNDING} — complete checks both the synchronous lease and durable marker before status mutation`,
    completeBody.includes("programBootstrapInflight.has(program.id) || program.founding")
      && completeBody.indexOf("programBootstrapInflight.has(program.id) || program.founding")
        < completeBody.indexOf('program.status = "complete"'),
    completeBody);
  pin(`${RULE_GM_FOUNDING} — boot recovery runs after tmux adoption and before any restored-slot ensure`,
    bootObserveAt >= 0 && bootAdoptAt > bootObserveAt && bootRecoverAt > bootAdoptAt
      && ensureBootAt > bootRecoverAt && server.indexOf("Bun.serve<WSData>") > ensureBootAt,
    `observe=${bootObserveAt} adopt=${bootAdoptAt} recover=${bootRecoverAt} ensure=${ensureBootAt} serve=${server.indexOf("Bun.serve<WSData>")}`);
  const identityCaptureAt = selfSucceedBody.indexOf("const predecessorIdentity");
  const firstSucceedAwaitAt = selfSucceedBody.indexOf("await readJson(req)");
  const bindingClassifyAt = selfSucceedBody.indexOf("const bound = programs.filter");
  const handoffAwaitAt = selfSucceedBody.indexOf("await handoffCommittedAfterOpen(s)");
  const identityRecheckAt = selfSucceedBody.indexOf("sameSuccessionOccupant(s, predecessorIdentity)", handoffAwaitAt);
  const dispatchAt = selfSucceedBody.indexOf("await succeedProgramMain(", identityRecheckAt);
  // THE ORDER INVERTED on 2026-09-08, and the inversion is the property: classification used to
  // sit AFTER the HANDOFF read, which made the post-await recheck the only thing standing between
  // an owner recycle and a Program succession silently downgraded to the generic rail. It now
  // joins the CAPTURED occupant and runs first, so that downgrade is structurally unreachable —
  // and the recheck, still here and still before any transfer, refuses the recycled caller
  // outright. The file gate is asked only on the rails it still proves something for, and only an
  // explicit `false` refuses, so a rail added later cannot inherit the permissive answer.
  pin(`${RULE_GM_FOUNDING} — self succession captures the exact occupant before its first await, classifies the rail from THAT identity, and revalidates before any transfer`,
    identityCaptureAt >= 0 && identityCaptureAt < firstSucceedAwaitAt
      && bindingClassifyAt > firstSucceedAwaitAt
      && selfSucceedBody.includes("p.main.slot === predecessorIdentity.slot && p.main.openedAt === predecessorIdentity.openedAt")
      && !selfSucceedBody.includes("p.main.slot === s.id")
      && handoffAwaitAt > bindingClassifyAt
      // since e3e5084a the file is asked of the game-maker rail alone; unbound and Supervisor write a
      // role-lineage record instead, and the pointer's own git read sits before the same recheck
      && selfSucceedBody.includes("const gameMaker = bound.length === 1 && isGameMaker(bound[0]!);")
      && selfSucceedBody.includes("const handoffReady = gameMaker ? await handoffCommittedAfterOpen(s) : null;")
      && selfSucceedBody.indexOf("await lineagePointerCommitted(") > handoffAwaitAt
      && identityRecheckAt > selfSucceedBody.indexOf("await lineagePointerCommitted(")
      && selfSucceedBody.includes("if (handoffReady === false)")
      && identityRecheckAt > handoffAwaitAt && dispatchAt > identityRecheckAt
      && selfRetireBody.includes("successionInflight.has(s.selfToken)")
      && read("e2e/programs.ts").includes("retire is refused in flight, owner recycle cannot downgrade Program succession"),
    `capture=${identityCaptureAt} firstAwait=${firstSucceedAwaitAt} classify=${bindingClassifyAt} handoff=${handoffAwaitAt} recheck=${identityRecheckAt} dispatch=${dispatchAt} retireGate=${selfRetireBody.includes("successionInflight.has(s.selfToken)")}`);
  const proveStopAt = server.indexOf("async function proveFoundingCandidateStopped");
  const proveStopBody = proveStopAt < 0 ? "" : server.slice(proveStopAt,
    server.indexOf("const exactFoundingPredecessor", proveStopAt));
  pin(`${RULE_GM_FOUNDING} — cleanup proves tmux absence before killSlot state clearing, and owner kill uses that path`,
    /observeTmuxSlots\(\)[\s\S]*?await killSlot\(s, "reopen"\)[\s\S]*?observeTmuxSlots\(\)[\s\S]*?presence !== "absent"/.test(proveStopBody)
      && !proveStopBody.includes('tmux("kill-session"')
      && server.includes('rollbackProgramFounding(foundingProgram, founding, "owner-kill")'),
    "absence proof or owner-kill routing missing");
  const recoveryAt = server.indexOf("async function recoverInterruptedProgramFoundings(");
  const recoveryBody = recoveryAt < 0 ? "" : server.slice(recoveryAt,
    server.indexOf("const SEND_BOOT_FRESH_MS", recoveryAt));
  pin(`${RULE_GM_FOUNDING} — restart observation is tri-state and successful enumeration replaces HOME inference`,
    server.includes('type TmuxPresence = "present" | "absent" | "unknown"')
      && server.includes("async function observeTmuxSlots")
      && server.includes("TmuxSlotObservations")
      && !server.includes("s.cwd = p.out || HOME")
      && recoveryBody.includes('presence !== "absent"')
      && recoveryBody.includes("assertNoFoundingTreeOccupant"),
    "tri-state observation, explicit absence or same-root scan is missing");
  pin(`${RULE_GM_FOUNDING} — recovery scans restored Slot cwd rows as well as tmux, except the exact succession predecessor`,
    /const exactFoundingPredecessor = [\s\S]*?founding\.predecessor\.slot[\s\S]*?founding\.predecessor\.openedAt/.test(server)
      && /function assertNoFoundingSlotOccupant[\s\S]*?for \(const slot of slots\)[\s\S]*?treePathsOverlap[\s\S]*?exactFoundingPredecessor/.test(server)
      && /function assertNoFoundingTreeOccupant[\s\S]*?assertNoFoundingSlotOccupant/.test(server)
      && read("e2e/programs.ts").includes("a dormant same-root Slot row is preserved and refuses startup")
      && read("e2e/programs.ts").includes("a dormant sibling-root Slot row does not block stale-marker cleanup"),
    "persisted Slot root scan, exact predecessor exception or planted restart arms missing");
  pin(`${RULE_GM_FOUNDING} — a wrong occupant outside the tree survives; one inside the protected tree stops startup`,
    recoveryBody.indexOf("!treePathsOverlap(targetRoot, markerRoot)") >= 0
      && recoveryBody.indexOf("assertNoFoundingTreeOccupant(program, founding, bootTmux)") >= 0
      && recoveryBody.indexOf('clearProgramFounding(program, founding, "boot-stale-foreign-target-preserved")') >= 0
      && recoveryBody.indexOf("throw new Error(`REFUSING TO START:",
        recoveryBody.indexOf("!treePathsOverlap(targetRoot, markerRoot)"))
        > recoveryBody.indexOf("!treePathsOverlap(targetRoot, markerRoot)"),
    recoveryBody);
  pin(`${RULE_GM_FOUNDING} — receipt precedes the one durable marker-to-binding state cut in both founding modes`,
    server.includes("function appendEventStrict")
      && bootstrapBody.indexOf("await appendEventStrict(CONTEXT_RECEIPT_FILE") >= 0
      && bootstrapBody.indexOf("await appendEventStrict(CONTEXT_RECEIPT_FILE") < bootstrapBody.indexOf("delete program.founding")
      && bootstrapBody.indexOf("delete program.founding") < bootstrapBody.indexOf("await saveStateNow()", bootstrapBody.indexOf("delete program.founding"))
      && succeedBody.indexOf("await appendEventStrict(CONTEXT_RECEIPT_FILE") >= 0
      && succeedBody.indexOf("await appendEventStrict(CONTEXT_RECEIPT_FILE") < succeedBody.indexOf("delete program.founding")
      && succeedBody.indexOf("delete program.founding") < succeedBody.indexOf("await saveStateNow()", succeedBody.indexOf("delete program.founding")),
    `bootstrap=${bootstrapBody.length} succession=${succeedBody.length}`);
  const candidateCurrentAt = succeedBody.indexOf("const candidateCurrent =");
  const transferCurrentAt = succeedBody.indexOf("const transferCurrent =");
  const afterOpenLatchAt = succeedBody.indexOf("SUCCESSION_AFTER_OPEN_LATCH");
  const afterOpenRecheckAt = succeedBody.indexOf("if (!transferCurrent())", afterOpenLatchAt);
  const sendAt = succeedBody.indexOf("await sendText(free, deliveredBrief, true)");
  const afterSendRecheckAt = succeedBody.indexOf("if (!transferCurrent())", sendAt);
  const receiptAt = succeedBody.indexOf("await appendEventStrict(CONTEXT_RECEIPT_FILE");
  const afterReceiptLatchAt = succeedBody.indexOf("SUCCESSION_AFTER_RECEIPT_LATCH", receiptAt);
  const afterReceiptRecheckAt = succeedBody.indexOf("if (!transferCurrent())", afterReceiptLatchAt);
  const bindingCutAt = succeedBody.indexOf("program.main = { slot: free.id", afterReceiptRecheckAt);
  pin(`${RULE_GM_FOUNDING} — succession keeps candidate identity separate from live predecessor authority and rechecks both around delivery evidence`,
    /interface SuccessionPredecessorIdentity\s*{\s*readonly slot:[\s\S]*?readonly openedAt:[\s\S]*?readonly cwd:[\s\S]*?readonly selfToken:/.test(server)
      && /readonly predecessor: ProgramFoundingIdentity \| null/.test(server)
      && server.includes("selfTokenHash: hashSelfToken(predecessor.selfToken)")
      && succeedBody.includes("predecessor: SuccessionPredecessorIdentity")
      && candidateCurrentAt >= 0 && transferCurrentAt > candidateCurrentAt
      && succeedBody.includes("sameSuccessionOccupant(free, candidateIdentity)")
      && succeedBody.includes("sameSuccessionOccupant(s, predecessor)")
      && succeedBody.includes("const transferCurrent = (): boolean => candidateCurrent() && predecessorCurrent()")
      && /if \(candidateCurrent\(\) \|\| !target\?\.cwd\)\s*await rollbackProgramFounding\(program, founding, "successor-failed"\)/.test(succeedBody)
      && afterOpenLatchAt > transferCurrentAt && afterOpenRecheckAt > afterOpenLatchAt
      && sendAt > afterOpenRecheckAt && afterSendRecheckAt > sendAt && afterSendRecheckAt < receiptAt
      && afterReceiptLatchAt > receiptAt && afterReceiptRecheckAt > afterReceiptLatchAt
      && bindingCutAt > afterReceiptRecheckAt
      && read("e2e/programs.ts").includes("revocation after target open rejects before receipt and preserves recycled predecessor")
      && read("e2e/programs.ts").includes("revocation after receipt leaves one orphan receipt without transferring authority"),
    `candidate=${candidateCurrentAt} transfer=${transferCurrentAt} openLatch=${afterOpenLatchAt}/${afterOpenRecheckAt} send=${sendAt}/${afterSendRecheckAt} receipt=${receiptAt}/${afterReceiptLatchAt}/${afterReceiptRecheckAt} bind=${bindingCutAt}`);
  const runtimeCases = [
    "bootstrap persists the exact target before delivery, blocks complete",
    "the exact founding target follows kill, absence proof, slot and marker cleanup",
    "post-await permit recheck leaves no main, receipt, pane or slot orphan",
    "the released tree remains recoverable",
    "an unwritable receipt ledger rolls back without binding, marker, pane or evidence",
    "a matching orphan receipt never auto-binds and survives exact-candidate cleanup as history",
    "a pre-open marker clears, while a different-tree target is preserved",
    "an unknown marker version refuses startup and preserves the marker bytes",
    "a bootstrap marker plus an existing main refuses startup",
    "a succession predecessor that is not current main refuses startup",
    "a marker on an otherwise unreadable Program row refuses startup",
    "inconsistent lifecycle timestamps with a marker refuse startup",
    "tmux observation failure is unknown, preserves the marker and refuses startup",
    "a same-root other-slot occupant is preserved and refuses startup",
    "a dormant same-root Slot row is preserved and refuses startup",
    "a dormant sibling-root Slot row does not block stale-marker cleanup",
    "retire is refused in flight, owner recycle cannot downgrade Program succession",
    '["a shuffled field order"',
    "candidate rolls back while predecessor binding and receipt count stay unchanged",
    "revocation after target open rejects before receipt and preserves recycled predecessor",
    "revocation after receipt leaves one orphan receipt without transferring authority",
  ];
  pin(`${RULE_GM_FOUNDING} — runtime suite names bootstrap, complete, pre-open, exact-candidate, foreign-target and succession crash arms`,
    runtimeCases.every((text) => read("e2e/programs.ts").includes(text)),
    `missing=[${runtimeCases.filter((text) => !read("e2e/programs.ts").includes(text)).join(" | ")}]`);
  pin(`${RULE_GM_FOUNDING} — operator and studio docs distinguish durable intent, rollback and evidence from authority`,
    foundingSelfApi.includes("Program.founding")
      && documentedMarkerAt >= 0 && documentedRecoveryAt > documentedMarkerAt
      && foundingSelfApi.includes("Brief-Replay noch Auto-Bind")
      && foundingSelfApi.includes("Den Live-Identitätscheck bis zum Bindungsschnitt")
      && foundingSelfApi.includes("Completion beendet eine vorhandene MAIN-Pane nicht automatisch")
      && foundingStudioDoc.includes("A restart never guesses authority")
      && foundingStudioDoc.includes("evidence of an interrupted delivery, not authority")
      && foundingStudioDoc.includes("revoked transfer is still evidence only")
      && foundingStudioDoc.includes("automatically kill an existing MAIN pane"),
    "the durable marker/recovery contract drifted out of the operator or studio document");
}

// --- THE OWNER BOARD'S DURABLE FOUNDING MARKER -------------------------------------------------
// The server can answer bootstrap-main with a typed 503 after it has durably written Program.founding.
// This source boundary is the last guard against the Board erasing that fact back to `unbound` and
// offering a second bootstrap. The live suite proves the server transition; these rules execute the
// client's wire decoder/classifier and fasten the DOM/response wiring that no TypeScript type can see.
{
  const RULE_FOUNDING_BOARD = "the Board treats a public durable founding marker as pending recovery, never bootstrap room";
  const client = clientU.text;
  // head and tail are DIFFERENT symbols, so the body is cut inside the module the function lives
  // in — never from a type in one module to a brace in the next.
  const stateFnSpan = clientU.span("\nfunction programFoundingState(", "\n}\n", 3);
  const stateMod = stateFnSpan ? clientU.module(stateFnSpan.file) : "";
  const stateHeadAt = stateMod.indexOf("type PublicProgramFoundingMode");
  const stateFnAt = stateMod.indexOf("\nfunction programFoundingState(");
  const stateTailAt = stateFnAt < 0 ? -1 : stateMod.indexOf("\n}\n", stateFnAt);
  const stateSource = stateHeadAt < 0 || stateFnAt < stateHeadAt || stateTailAt < stateFnAt ? ""
    : stateMod.slice(stateHeadAt, stateTailAt + 3);

  type FoundingView = { state: string; record?: { v?: number; mode?: string;
    attemptId?: string; target?: { slot?: number; openedAt?: number } } };
  let foundingState: ((value: unknown) => FoundingView) | null = null;
  let foundingStateErr = "";
  if (stateSource !== "") {
    try {
      foundingState = new Function(new Bun.Transpiler({ loader: "ts" }).transformSync(stateSource)
        + "\nreturn programFoundingState;")() as (value: unknown) => FoundingView;
    } catch (e) { foundingStateErr = e instanceof Error ? e.message : String(e); }
  }
  pin(`${RULE_FOUNDING_BOARD} — the public v1/v2 decoder is extractable, DOM-free and carries no token or hash field`,
    foundingState !== null && !/document|\bel\(|selfToken|Hash/.test(stateSource),
    stateSource === "" ? "programFoundingState not found" : foundingStateErr || `${stateSource.length} bytes`);

  const V1 = { v: 1, attemptId: "a".repeat(32), mode: "bootstrap", canonicalRoot: "/repo",
    target: { slot: 4, openedAt: 1750000000000 }, predecessor: null, startedAt: 1750000000001 };
  const V2 = { v: 2, profileKind: "standard", attemptId: "b".repeat(32), mode: "succession",
    targetRoot: "/repo", target: { slot: 5, openedAt: 1750000000002 },
    predecessor: { slot: 4, openedAt: 1750000000000 }, startedAt: 1750000000003 };
  const views = foundingState ? {
    absent: foundingState(undefined), v1: foundingState(V1), v2: foundingState(V2),
    nulled: foundingState(null), extra: foundingState({ ...V1, surprise: true }),
    leaked: foundingState({ ...V2, target: { ...V2.target, selfTokenHash: "f".repeat(64) } }),
  } : null;
  // Mutation caught: accepting null, an unknown top-level key or a private identity hash would turn
  // an unreadable/private wire shape into an actionable pending record; dropping either v1 or v2
  // would make a real durable marker disappear back into bootstrap room.
  pin(`${RULE_FOUNDING_BOARD} — exact public v1 and v2 are pending; absent, null, unknown-key and private-hash edges fail closed`,
    !!views && views.absent.state === "absent"
      && views.v1.state === "pending" && views.v1.record?.v === 1
      && views.v2.state === "pending" && views.v2.record?.v === 2
      && views.nulled.state === "unreadable" && views.extra.state === "unreadable"
      && views.leaked.state === "unreadable",
    JSON.stringify(views));

  const markSource = clientU.span("\nfunction programMark(p: ProgramInfo)", "\n}\n", 3)?.text ?? "";
  let mark: ((p: Record<string, unknown>) => { mark: string; why: string }) | null = null;
  let markErr = "";
  if (stateSource !== "" && markSource !== "") {
    try {
      const prelude = 'let programsRead = "ok"; let fleet = []; function fmtTs(ts) { return "TS:" + ts; }\n';
      mark = new Function(new Bun.Transpiler({ loader: "ts" }).transformSync(
        prelude + stateSource + markSource) + "\nreturn programMark;")();
    } catch (e) { markErr = e instanceof Error ? e.message : String(e); }
  }
  const marks = mark ? { pending: mark({ founding: V2 }), absent: mark({}), malformed: mark({ founding: null }) } : null;
  // Mutation caught: moving the main-absence branch above foundingState recreates the production bug:
  // the same no-main row changes from `founding` to `unbound` and regrows bootstrap controls.
  pin(`${RULE_FOUNDING_BOARD} — classification checks pending/unreadable founding before the no-main unbound branch`,
    !!marks && marks.pending.mark === "founding" && marks.absent.mark === "unbound"
      && marks.malformed.mark === "unknown" && /recovery pending/.test(marks.pending.why),
    markErr || JSON.stringify(marks));

  const detail = clientU.span("function renderProgramDetail(", "\n}\n", 3)?.text ?? "";
  const pendingAt = detail.indexOf('if (mark === "founding") {');
  const staleAt = detail.indexOf('if (mark === "stale") {');
  const unknownAt = detail.indexOf('if (mark === "unknown") {');
  const bootstrapAt = detail.indexOf('const bs = qDetailSection(shell.detail, "Found a Program-MAIN")');
  const pendingBlock = pendingAt < 0 || unknownAt < pendingAt ? "" : detail.slice(pendingAt, unknownAt);
  // Mutation caught: deleting the pending return or moving the bootstrap section above it makes one
  // durable attempt render cwd/label inputs and the "found Program-MAIN" button again.
  pin(`${RULE_FOUNDING_BOARD} — pending Board copy names mode, attempt and affected slot, says availability/recovery, and returns before every bootstrap control`,
    pendingBlock !== "" && /record\.mode/.test(pendingBlock) && /record\.attemptId/.test(pendingBlock)
      && /record\.target\.slot/.test(pendingBlock) && pendingBlock.includes("availability unknown")
      && pendingBlock.includes("recovery pending") && /\n\s*return;/.test(pendingBlock)
      && unknownAt > pendingAt && bootstrapAt > unknownAt,
    `pending=${pendingAt} unknown=${unknownAt} bootstrap=${bootstrapAt}`);
  const staleBlock = staleAt < 0 || bootstrapAt < staleAt ? "" : detail.slice(staleAt, bootstrapAt);
  // Mutation caught: merging stale back into the fail-closed unknown return removes the only Board
  // entry point for a Program whose recorded MAIN occupant is gone, although the server deliberately
  // replaces that exact stale binding during bootstrap.
  pin(`${RULE_FOUNDING_BOARD} — a stale MAIN exposes replacement founding while unknown still returns fail-closed`,
    staleAt > unknownAt && staleBlock.includes("replace the stale binding")
      && !/if \(mark === "stale"\)[\s\S]*?\n\s*return;/.test(staleBlock)
      && /if \(mark === "unknown"\)[\s\S]*?\n\s*return;/.test(detail.slice(unknownAt, staleAt)),
    `unknown=${unknownAt} stale=${staleAt} bootstrap=${bootstrapAt}`);

  const responseAt = detail.indexOf("const j = (await r.json().catch(() => null)) as unknown;");
  const response = responseAt < 0 ? "" : detail.slice(responseAt, detail.indexOf("acts.appendChild(go);", responseAt));
  const refreshAt = response.indexOf("await loadPrograms(true);");
  const failureAt = response.indexOf("if (failure !== null)");
  // Mutation caught: restoring the old success-only refresh leaves a typed pending 503 classified
  // from stale pre-click facts, so rolled-back cannot unlock and pending cannot visibly stay locked.
  pin(`${RULE_FOUNDING_BOARD} — every answered bootstrap refreshes Program facts before its failure branch, including typed 503`,
    response !== "" && response.includes("bootstrapFailureMessage(r.status, j)")
      && refreshAt >= 0 && failureAt > refreshAt
      && response.split("await loadPrograms(true);").length - 1 === 1,
    response === "" ? "bootstrap response path not found" : `refresh=${refreshAt} failure=${failureAt}`);

  const failureFnSpan = clientU.span("\nfunction bootstrapFailureMessage(", "\n}\n", 3);
  const failureMod = failureFnSpan ? clientU.module(failureFnSpan.file) : "";
  const failureHeadAt = failureMod.indexOf("interface BootstrapUnavailable");
  const failureFnAt = failureMod.indexOf("\nfunction bootstrapFailureMessage(");
  const failureTailAt = failureFnAt < 0 ? -1 : failureMod.indexOf("\n}\n", failureFnAt);
  const failureSource = failureHeadAt < 0 || failureFnAt < failureHeadAt || failureTailAt < failureFnAt ? ""
    : failureMod.slice(failureHeadAt, failureTailAt + 3);
  let failureMessage: ((status: number, value: unknown) => string) | null = null;
  let failureErr = "";
  if (stateSource !== "" && failureSource !== "") {
    try {
      const prelude = 'function fmtTs(ts) { return "TS:" + ts; }\n';
      failureMessage = new Function(new Bun.Transpiler({ loader: "ts" }).transformSync(
        prelude + stateSource + failureSource) + "\nreturn bootstrapFailureMessage;")();
    } catch (e) { failureErr = e instanceof Error ? e.message : String(e); }
  }
  const pending503 = failureMessage?.(503, { error: "founding delivery outcome is unknown",
    availability: "unknown", recovery: "pending",
    affected: { attemptId: "c".repeat(32), slot: 6, openedAt: 1750000000004 } }) ?? "";
  const rolledBack503 = failureMessage?.(503, { error: "founding rolled back",
    availability: "unknown", recovery: "rolled-back",
    affected: { attemptId: "d".repeat(32), slot: 7, openedAt: 1750000000005 } }) ?? "";
  // Mutation caught: narrowing the response to `{error,slot}` or omitting one typed field makes the
  // operator lose which durable attempt/slot is pending, or mistake rolled-back for pending.
  pin(`${RULE_FOUNDING_BOARD} — typed pending and rolled-back 503 messages preserve error, availability, recovery and the exact affected identity`,
    pending503.startsWith("503: founding delivery outcome is unknown")
      && pending503.includes("availability unknown") && pending503.includes("recovery pending")
      && pending503.includes("affected attempt " + "c".repeat(32))
      && pending503.includes("affected slot 6") && pending503.includes("TS:1750000000004")
      && rolledBack503.startsWith("503: founding rolled back")
      && rolledBack503.includes("recovery rolled-back") && rolledBack503.includes("affected slot 7"),
    failureErr || JSON.stringify({ pending503, rolledBack503 }));
}

// --- THE INSTANCE SWITCHER (dual-host S3) ↔ THE ONE PROPERTY THAT MAKES IT SAFE TO HAVE.
// Topology A federates BY HAND: a switch is the browser moving to another origin, and each instance
// keeps its own login only because a cookie is per origin. That holds exactly as long as the
// destination is the projected url and nothing else. The day someone appends `?token=` so the other
// board "opens logged in", these two instances share one credential and the cut has quietly built
// the thing it was designed without — and it would be a one-line, well-meant edit. tsc sees none of
// it (both sides are strings) and there is no DOM harness here, so it is fastened at the source; the
// charset and the projection are measured live in e2e/tasks.ts.
{
  const RULE_SWITCH = "the Board's instance switcher navigates to a projected origin and carries no credential";
  const client = clientU.text;
  const head = clientU.span("function renderInstanceHead(", "\n}\n", 3)?.text ?? "";
  pin(`${RULE_SWITCH} — the switch is location.assign of the link's own url, with nothing concatenated onto it`,
    head.includes("location.assign(link.url)")
      && !/location\.assign\([^)]*[+`]/.test(head)
      && !/token|cookie|credential|document\.cookie/i.test(head),
    head === "" ? "renderInstanceHead not found" : `${head.length} bytes`);
  pin(`${RULE_SWITCH} — that is the ONLY navigation in the client, and the wire list is re-checked against the shared charset first`,
    client.split("location.assign(").length - 1 === 1
      && client.includes("INSTANCE_URL_RE.test(l.url)")
      && client.includes('from "./protocol"'),
    `assignOccurrences=${client.split("location.assign(").length - 1}`);
  // The charset itself is the guarantee, so it must stay a charset: an origin and nothing after it.
  const charset = clientU.module("src/protocol.ts");
  pin(`${RULE_SWITCH} — INSTANCE_URL_RE is anchored at both ends and admits no path, query, fragment or userinfo`,
    /export const INSTANCE_URL_RE =\s*\n?\s*\/\^https\?:/.test(charset)
      && INSTANCE_URL_RE.source.startsWith("^https?:")
      && INSTANCE_URL_RE.source.endsWith("$")
      && !["http://u:p@h", "http://h/board", "http://h?t=1", "http://h#f", "javascript:alert(1)"]
        .some((u) => INSTANCE_URL_RE.test(u)),
    INSTANCE_URL_RE.source);
}

// The profile buttons are an owner actuator, not decorative prose. Runtime executes the pure
// request builder; these pins keep the real click path on that one builder and preserve its
// busy/generation/finally discipline.
{
  const RULE_PROFILE_ACTOR = "the Board's profile buttons execute one pure, closed request builder";
  const client = clientU.text;
  const actor = clientU.span("function profileRequestOf(", "\n}\n", 3)?.text ?? "";
  const run = clientU.span("const prRun = async", "\n    };", 7)?.text ?? "";
  pin(`${RULE_PROFILE_ACTOR} — the pure builder is closed over exactly grant and clear`,
    client.includes('type ProfileAct = "game-maker" | "clear"')
      && actor.includes("/api/programs/${programId}/profile")
      && actor.includes('{ profile: { v: 1, kind: "game-maker" } }')
      && actor.includes("{ profile: null }")
      && !/\bpost\(|document|qPr|Date\.now/.test(actor),
    actor === "" ? "profileRequestOf not found" : `${actor.length} bytes`);
  pin(`${RULE_PROFILE_ACTOR} — prRun posts only the builder result and retains generation, busy and finally guards`,
    run.includes("const request = profileRequestOf(forPrId, act)")
      && run.includes("post(request.path, request.body)")
      && !run.includes("PR_BODY")
      && run.includes("const seq = ++qPrSeq") && run.includes("const mine = () =>")
      && run.includes("qPrBusy = true") && run.includes("finally") && run.includes("qPrBusy = false"),
    run === "" ? "prRun not found" : `${run.length} bytes`);
  pin(`${RULE_PROFILE_ACTOR} — the builder has one runtime consumer and prRun itself fires only from the click handler`,
    client.split("profileRequestOf(").length - 1 === 2
      && client.split("prRun(").length - 1 === 1
      && /b\.onclick = \(\) => \{ void prRun\(act\); \}/.test(client),
    `builderOccurrences=${client.split("profileRequestOf(").length - 1} prRunOccurrences=${client.split("prRun(").length - 1}`);

  const serverProfileAt = server.indexOf('const profileRoute = /^\\/api\\/programs\\/([^/]+)\\/profile$/');
  const serverProfile = serverProfileAt < 0 ? ""
    : server.slice(serverProfileAt, server.indexOf("// THE PROMOTION DOOR", serverProfileAt));
  const noOpAt = serverProfile.indexOf("const current = program.profile");
  const inflightAt = serverProfile.indexOf("programBootstrapInflight.has(program.id)");
  const completeAt = serverProfile.indexOf('program.status === "complete"');
  const liveAt = serverProfile.indexOf('program.status === "active" && liveBound');
  const noOpReturn = noOpAt < 0 ? "" : serverProfile.slice(noOpAt, inflightAt);
  pin(`${RULE_PROFILE_ACTOR} — identical grants and clears return before inflight/LIVE/complete without audit, timestamp or save`,
    noOpAt >= 0 && inflightAt > noOpAt && completeAt > inflightAt && liveAt > completeAt
      && noOpReturn.includes("return json({ ok: true, program: publicProgram(program) })")
      && !/confirmedAt: Date\.now|\baudit\(|saveState/.test(noOpReturn),
    `noOp=${noOpAt} inflight=${inflightAt} complete=${completeAt} live=${liveAt}`);
}

// --- THE PROMOTE DOOR ON THE BOARD ↔ THE TWO OWNER-GATED ROUTES. Promotion was terminal-only
// (promote-program.sh) until the Program pane grew a button for it. There is no DOM harness here,
// so the client half of that pair can only be fastened at the source — and these are exactly the
// properties no compiler sees: that both transitions are issued from ONE pane and in order, that a
// refusal reaches the owner as the server's own sentence, and that the pane never re-issues a
// confirm as a repair. The route half is measured live in e2e/programs.ts ("promote button: …").
{
  const RULE_PROMOTE = "the Board's promote door is the two owner-gated transitions, in order, and nowhere else";
  const client = clientU.text;
  const detailSpan = clientU.span("function renderProgramDetail(", "\n}\n", 3);
  const from = detailSpan?.at ?? -1;
  // bounded by the function's OWN closing brace (column 0), not by whatever function follows it:
  // an anchor on the next declaration would swallow a promote door pasted in between and call it
  // "inside the pane" — which is precisely the edit the outside-count below exists to catch.
  const detail = detailSpan?.text ?? "";
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
    detail === "" ? "renderProgramDetail not found anywhere in the client universe"
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
  const client = clientU.text;
  const detailSpan = clientU.span("function renderProgramDetail(", "\n}\n", 3);
  const from = detailSpan?.at ?? -1;
  // the function's OWN closing brace, exactly as RULE_PROMOTE bounds it, and for the same reason:
  // an anchor on the next declaration would swallow a promotion door pasted in between.
  const detail = detailSpan?.text ?? "";
  const pmAt = detail.indexOf("if (qPmFor !== p.id) {");
  const unknownAt = detail.indexOf('if (mark === "unknown") {');
  const pm = pmAt < 0 || unknownAt < 0 || unknownAt < pmAt ? "" : detail.slice(pmAt, unknownAt);

  // (1) ONE DOOR. Every promotion POST the client makes is collected across the WHOLE file: a
  // second surface onto an owner-only permission rail fails this row instead of quietly existing.
  const pmPostsAll = [...client.matchAll(/post\(`\/api\/programs\/\$\{[^}]+\}\/promotion`/g)];
  const pmOutside = pmPostsAll.filter((m) => {
    const i = m.index ?? -1;
    return i < from || i >= from + detail.length || i - from < pmAt || i - from >= unknownAt;
  });
  pin(`${RULE_PROMOTION_UI} — exactly one promotion POST exists in the client and it is inside renderProgramDetail's promotion section`,
    detail !== "" && pm !== "" && pmPostsAll.length === 1 && pmOutside.length === 0,
    detail === "" ? "renderProgramDetail not found anywhere in the client universe"
      : pm === "" ? `the promotion section was not found (pmAt=${pmAt} unknownAt=${unknownAt})`
        : `posts=${pmPostsAll.length} outside=${pmOutside.length}`);

  // (2) PLACEMENT IS LOAD-BEARING, not taste. Above the unknown early return, because that return
  // fires for exactly the program whose standing permission an owner may need to inspect; and
  // clear of RULE_PROMOTE's own span, which is sliced by text and would otherwise swallow this.
  const frameAt = detail.indexOf('qDetailSection(shell.detail, "Frame"');
  const promoteAt = detail.indexOf('if (p.status === "proposed" || p.status === "confirmed") {');
  pin(`${RULE_PROMOTION_UI} — the section sits after Frame, before the unknown return, and outside the promote block`,
    frameAt >= 0 && promoteAt >= 0 && frameAt < pmAt && pmAt < unknownAt && unknownAt < promoteAt,
    `frame=${frameAt} pm=${pmAt} unknown=${unknownAt} promote=${promoteAt}`);

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
  const ps = clientU.span("\nfunction promotionState(p: ProgramInfo)", "\n}\n", 3)?.text ?? "";
  const states = ["absent", "off", "green-only", "guarded", "unreadable"];
  pin(`${RULE_PROMOTION_UI} — promotionState is top-level, DOM-free and clock-free, and names all five displayed states`,
    ps !== "" && !/document|\bel\(|chip\(|Date\.now\(|new Date\(/.test(ps)
      && states.every((st) => ps.includes(`state: "${st}"`))
      && /const stamped = fmtTs\(rec\.confirmedAt\);/.test(ps)
      && ps.split("stamped: null").length - 1 === 2,
    ps === "" ? "promotionState not found anywhere in the client universe" : `${ps.split("\n").length} lines`);

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

// ================================================================================================
// LANE SUITES IN THE REMOTE HELPER PORTAL — the two pairs whose other side is not TypeScript
// ================================================================================================
// The feature's own behaviour is proved in e2e/lane-suite.ts against a live server. What NO check
// there can see is where its statements go OUT of TypeScript: into a shell line a human types on
// another machine, and into a rulebook fragment that is not even in this tree.
{
  const helperSrc = ((): string => { try { return read("src/helper.ts"); } catch { return ""; } })();
  const serverSrc = serverU.text;

  // --- S8. THE `-b` IN THE BOOTSTRAP, and it is the whole difference between a helper who can work
  // and one who cannot. An audit bundle names the integration branch and a plain `git clone` checks
  // it out; a PREVIEW bundle carries a transient branch that is not its HEAD, and cloning it without
  // `-b` produces a directory with NO working tree and no error a person would read as "you needed
  // -b" (measured, design doc M6). The line is typed by a human, so no compiler is on this seam.
  const RULE_CLONE = "the portal's preview bootstrap clones with -b, and the branch it names comes from the claim";
  if (helperSrc === "") skip(RULE_CLONE, "src/helper.ts is not in this tree");
  else {
    const fn = /function bootstrapText\([\s\S]*?\n}/.exec(helperSrc)?.[0] ?? "";
    // both arms, and the negative half matters as much as the positive: the AUDIT arm must NOT
    // grow a `-b`, or the two kinds have silently become one command that is wrong for one of them
    const laneArm = /isLaneSuite\(job\)[\s\S]*?:\s*\[`git clone /.exec(fn)?.[0] ?? "";
    const auditArm = /:\s*\[`git clone ([^`]*)`\]/.exec(fn)?.[1] ?? "";
    pin(RULE_CLONE,
      fn !== "" && /git clone -b \$\{job\.branch/.test(laneArm) && auditArm !== "" && !/ -b /.test(auditArm)
        && /branch\?: string/.test(helperSrc),
      fn === "" ? "bootstrapText not found" : `laneArm=${/git clone -b/.test(laneArm)} audit=${JSON.stringify(auditArm)}`);
  }

  // --- and the sentence that WAS the bug. The portal's subline and its empty card described the
  // audit queue as the only source there was ("post-land audits this fleet has queued" / "no audit
  // is waiting"), which is exactly why a lane's offered preview could not be found on this page.
  // A page that lists two sources and names one is a page that lies about what it shows.
  // …and the STATIC half of the same sentence, which is where the wrong one physically sat: the
  // page ships a fallback subline in markup, and that is what a viewer reads until the first poll
  // answers. It was found here by grep, not by this rule — so the rule now covers it.
  const RULE_SAYS_BOTH = "the portal's subline and empty card name BOTH job sources, not audits alone";
  const pageSrc = ((): string => { try { return read("public/helper.html"); } catch { return ""; } })();
  if (pageSrc !== "") {
    const sub = /id="sub"[^>]*>([^<]*)</.exec(pageSrc)?.[1]?.toLowerCase() ?? "";
    pin(`${RULE_SAYS_BOTH} — including the static fallback subline in public/helper.html`,
      sub !== "" && sub.includes("preview") && sub.includes("audit"),
      sub === "" ? 'no id="sub" node in public/helper.html' : JSON.stringify(sub.slice(0, 90)));
  } else skip(`${RULE_SAYS_BOTH} — including the static fallback subline in public/helper.html`,
    "public/helper.html is not in this tree");
  if (helperSrc === "") skip(RULE_SAYS_BOTH, "src/helper.ts is not in this tree");
  else {
    const refresh = /async function refresh\([\s\S]*?\n}/.exec(helperSrc)?.[0] ?? "";
    const strings = [...refresh.matchAll(/"([^"\\]{20,})"|`([^`\\$]{20,})`/g)].map((m) => m[1] ?? m[2] ?? "");
    const prose = strings.join(" ").toLowerCase();
    pin(RULE_SAYS_BOTH,
      refresh !== "" && prose.includes("preview") && prose.includes("audit")
        && !/no audit is waiting/.test(refresh),
      refresh === "" ? "refresh() not found"
        : `preview=${prose.includes("preview")} audit=${prose.includes("audit")} `
          + `auditOnlyEmptyCard=${/no audit is waiting/.test(refresh)}`);
  }

  // --- S9. THE WAITING NUMBERS, held across the one boundary that has no compiler at all: the
  // rulebook fragment lives in the SOURCE checkout, is gitignored, and a worktree never materialises
  // it — so this rule reads it through SOURCE_DIR and SKIPS under its own name where it cannot look,
  // exactly like section 6b. It also skips while the rule itself has not been promoted into the
  // fragment yet: a lane may PROPOSE a rule, only the owner makes it normative, and a pin that went
  // red over an un-promoted proposal would be this file demanding its own change be adopted.
  const RULE_WAIT = "the suite-offer waiting numbers are the same in rulebook/lane-discipline.md and server.ts";
  const freeSec = Number(/const SUITE_OFFER_WAIT_FREE_MS = ([0-9_]+)/.exec(serverSrc)?.[1]?.replaceAll("_", "") ?? NaN) / 1000;
  const heldSec = Number(/const SUITE_OFFER_WAIT_HELD_MS = ([0-9_]+)/.exec(serverSrc)?.[1]?.replaceAll("_", "") ?? NaN) / 1000;
  const fragment = ((): string | null => {
    if (SOURCE_DIR === null) return null;
    try { return readFileSync(`${SOURCE_DIR}/${RULEBOOK_DIR}/${fragmentFileName("lane-discipline")}`, "utf8"); }
    catch { return null; }
  })();
  if (!Number.isFinite(freeSec) || !Number.isFinite(heldSec))
    pin(RULE_WAIT, false, `server.ts names no SUITE_OFFER_WAIT_* pair (free=${freeSec} held=${heldSec})`);
  else if (fragment === null)
    skip(RULE_WAIT, SOURCE_DIR === null ? "source checkout not locatable from here"
      : "rulebook/lane-discipline.md not readable in the source checkout");
  else if (!fragment.includes("/api/self/suite-offer"))
    skip(RULE_WAIT, "the suite-offer rule is not in the rulebook yet — proposed, not promoted");
  else {
    // the numbers as the fragment writes them, in seconds, beside the route they belong to
    const hasFree = new RegExp(`\\b${freeSec} s\\b`).test(fragment);
    const hasHeld = new RegExp(`\\b${heldSec} s\\b`).test(fragment);
    pin(RULE_WAIT, hasFree && hasHeld,
      `server free=${freeSec}s held=${heldSec}s; fragment names them: free=${hasFree} held=${hasHeld}`);
  }
}

// ================================================================================================
// SECTION S10 — THE REMOTE COMMAND JOB. Invariant 6 (`cmd` is allowlisted; an agent harness is
// refused unconditionally) and the three-field wire between server and daemon.
// ================================================================================================
// WHY THIS IS A PIN AND NOT A TEST. Both halves have an other side that is not TypeScript from the
// compiler's point of view: the refusal is a STRING the server returns, and the daemon is a program
// that runs on another machine and is only reachable here as text. A compiler cannot see that the
// allowlist stopped being consulted, and it cannot see that the daemon stopped reading a field the
// claim still serves. The constant itself is IMPORTED rather than re-spelled — a pin that copied
// the list would only pin its own copy.
{
  const RULE_ALLOW = "a remote command job's cmd is allowlisted, and an agent harness is refused whatever the list says";
  const cmds = Object.keys(HELPER_CMD_ALLOW);
  pin(`${RULE_ALLOW} — the allowlist is non-empty and every entry's argv is the command, split`,
    cmds.length > 0 && cmds.every((c) => {
      const argv = HELPER_CMD_ALLOW[c];
      return Array.isArray(argv) && argv.length > 0 && argv.join(" ") === c;
    }),
    `[${cmds.join(" | ")}]`);
  // the REFUSAL, read out of the source of truth by running it — not by matching a message in
  // server.ts, which would go green the day the check stopped being called.
  const forbidden = HELPER_CMD_FORBIDDEN.flatMap((f) => [f, `${f} -p hello`, `./${f}`, `/usr/bin/${f} run`,
    `bun run build && ${f}`, f.toUpperCase()]);
  const refused = forbidden.filter((c) => helperCmdCheck(c).ok === false);
  pin(`${RULE_ALLOW} — every shape that names an agent harness as a token is refused`,
    refused.length === forbidden.length,
    `${refused.length}/${forbidden.length} refused; forbidden=[${HELPER_CMD_FORBIDDEN.join(",")}]`);
  // …and the direction that is NOT implied by it: a legitimate entry still passes, or the rule above
  // would be satisfied by a function that refuses everything.
  const accepted = cmds.filter((c) => helperCmdCheck(c).ok === true);
  pin(`${RULE_ALLOW} — and every allowlist entry itself passes (the refusal is not "refuse everything")`,
    accepted.length === cmds.length && helperCmdCheck("rm -rf /").ok === false
      && helperCmdCheck("bun run build; echo hi").ok === false,
    `${accepted.length}/${cmds.length} accepted`);
  // THE DOOR ACTUALLY CONSULTS IT. The self route must call the checker and must not spell a
  // command list of its own — the two ways this rule dies quietly.
  const jobsDoor = serverU.span('/api/self/jobs" && req.method === "POST"', "return json({ jobId: job.id")?.text ?? null;
  pin(`${RULE_ALLOW} — POST /api/self/jobs runs the shared checker and refuses with 400 before a row exists`,
    jobsDoor !== null && /helperCmdCheck\(body\?\.cmd\)/.test(jobsDoor)
      && /return json\(\{ error: cmdCheck\.error \}, 400\)/.test(jobsDoor)
      && jobsDoor.indexOf("helperCmdCheck") < jobsDoor.indexOf("commandJobs.set("),
    jobsDoor === null ? "the self jobs door was not found in the server universe"
      : `checker@${jobsDoor.indexOf("helperCmdCheck")} row@${jobsDoor.indexOf("commandJobs.set(")}`);
  // NO SHELL, either side. The server hands over argv; the daemon execs it through the runner that
  // has no `sh -c` in it. `runCmd` keeps its shell for the OWNER's own configured strings — that is
  // the distinction, and a command job crossing back into it is the regression.
  const daemonSrc = exists("helper-daemon/daemon.ts") ? read("helper-daemon/daemon.ts") : "";
  if (daemonSrc === "") skip(`${RULE_ALLOW} — the daemon runs a command job as argv`, "helper-daemon/daemon.ts is not in this tree");
  else {
    // ONE `sh -c` in the whole file, and it is runCmd's — the runner for the OWNER's own config
    // strings. A second one is either a command job that grew a shell or a new wire that did.
    const shSites = (daemonSrc.match(/"sh", "-c"/g) ?? []).length;
    pin(`${RULE_ALLOW} — the daemon runs a command job through runArgv (no sh -c) and never through runCmd`,
      /async function runArgv\(/.test(daemonSrc)
        && /Bun\.spawn\(argv, \{/.test(daemonSrc)
        && /\? await runArgv\(j\.argv!/.test(daemonSrc)
        && shSites === 1
        && /function runCmd\([\s\S]{0,400}?runArgv\(\["sh", "-c", cmd\]/.test(daemonSrc),
      `runArgv=${/async function runArgv\(/.test(daemonSrc)} shCallSites=${shSites}`);
  }

  // --- ONE PREDICATE FOR "NO HELPER COULD EVER TAKE THIS", AND NO SECOND COPY OF ITS REASONS ------
  // Four readers ask whether an audit entry is offerable at all: the claim door, the job list, the
  // wake rail, and the drain (which must know whether waiting out AUDIT_HELPER_GRACE_MS buys
  // anything). Until 2026-09-08 each carried the list by hand and TWO had already drifted — the wake
  // rail packeted a machine awake for a short-chain job the claim door then refused, and the drain
  // held a repo-worker entry the full grace for an offer that structurally never comes. TypeScript
  // cannot see that: every copy type-checks, and a fifth reason added to helperClaimBar would leave
  // whichever site re-derived it silently offering the job.
  //
  // So the rule is mechanical: each of the four must CALL the predicate, and none of them may
  // re-derive an arm of it. The drain is allowed exactly ONE `entryRunsShortChain` — the argument
  // that chooses the chain for the run it is about to start, a different question from "may anyone
  // else run this" — so the count is pinned, not the absence.
  const RULE_BAR = "the four readers of 'no helper could ever claim this' call helperClaimBar and none re-derives its reasons";
  const barFn = serverU.span("function helperClaimBar(", "\n}")?.text ?? null;
  const barReasons = serverU.span("const HELPER_CLAIM_BAR_REASON:", "\n};")?.text ?? null;
  const drainFn = serverU.span("async function drainPostLandAudits(", "\n}")?.text ?? null;
  const jobsViewFn = serverU.span("function helperJobsView(", "// --- THE OWNER'S HALF OF THE REGISTER")?.text ?? null;
  const wakeFn = serverU.span("function helperWorkAwaitingClaim(", "\n}")?.text ?? null;
  const claimAudit = serverU.span("async function helperClaim(", "\n}")?.text ?? null;
  const barReaders: [string, string | null][] =
    [["drain", drainFn], ["jobsView", jobsViewFn], ["wake", wakeFn], ["claim", claimAudit]];
  if (barFn === null || barReasons === null || barReaders.some(([, t]) => t === null))
    pin(RULE_BAR, false,
      `predicate=${barFn !== null} reasons=${barReasons !== null} `
      + barReaders.map(([n, t]) => `${n}=${t !== null}`).join(" "));
  else {
    const noCall = barReaders.filter(([, t]) => !t!.includes("helperClaimBar(")).map(([n]) => n);
    // a re-derivation is either arm of the predicate spelled out again in a reader
    const reDerived = barReaders.filter(([n, t]) =>
      /source === "repo-worker"/.test(t!)
      || (t!.split("entryRunsShortChain(").length - 1) > (n === "drain" ? 1 : 0)
      || (n !== "drain" && /auditCmdFor\(/.test(t!))).map(([n]) => n);
    pin(RULE_BAR,
      noCall.length === 0 && reDerived.length === 0
        // the three arms live in the predicate, each with a sentence the claim door can print
        && ["unconfigured", "repo-worker", "short-chain"].every((a) =>
          barFn.includes(`"${a}"`) && barReasons.includes(a)),
      `notCalling=[${noCall}] reDeriving=[${reDerived}]`);
  }

  // --- THE WIRE. Three fields, and each must exist on BOTH sides or a job is claimed and then run
  // with a default nobody asked for. This is exactly the failure the S1 handshake exists to prevent,
  // so it is fastened here too rather than trusted to a running suite.
  const RULE_WIRE = "the command job's three wire fields stand in HelperJobView, in the claim, and in the daemon's ClaimedJob";
  const jobView = serverU.span("interface HelperJobView {", "\n}")?.text ?? null;
  const claimFn = serverU.span("async function claimCommandJob(", "\n}")?.text ?? null;
  const claimedJob = /interface ClaimedJob \{[\s\S]*?\n\}/.exec(daemonSrc)?.[0] ?? "";
  const fields = ["cmd", "timeoutMs", "artifacts"];
  const missView = fields.filter((f) => !new RegExp(`\\b${f}\\??:`).test(jobView ?? ""));
  const missClaim = fields.filter((f) => !new RegExp(`\\b${f}:`).test(claimFn ?? ""));
  const missDaemon = fields.filter((f) => !new RegExp(`\\b${f}\\?:`).test(claimedJob));
  if (jobView === null || claimFn === null || claimedJob === "")
    pin(RULE_WIRE, false, `view=${jobView !== null} claim=${claimFn !== null} daemon=${claimedJob !== ""}`);
  else pin(RULE_WIRE,
    missView.length === 0 && missClaim.length === 0 && missDaemon.length === 0
      && /\bargv\?: string\[\]/.test(claimedJob) && /argv: j\.argv/.test(claimFn),
    `missing view=[${missView}] claim=[${missClaim}] daemon=[${missDaemon}]`);

  // --- THE SHARDED AUDIT (FLEET_AUDIT_SHARDS). Three halves no running suite can hold alone:
  //   (a) n absent/1/unreadable IS TODAY — every new branch sits behind `AUDIT_SHARDS > 1` or an open
  //       run (which only n>1 opens), the unsharded row literal and job push carry no shard field, and a
  //       state file without runs gets no new key. A suite at n=1 passes whether or not the guards exist;
  //       this is what fails when one goes missing.
  //   (b) THE HANDSHAKE on both doors plus the daemon's own word: listed only under `shardCapable`,
  //       claimed only with the feature, the feature NOT sticky on the heartbeat, and the daemon sends it.
  //   (c) THE MERGE ORDER: green only when all n reported green, red before unknown.
  const RULE_SHARDS = "a sharded audit changes nothing at n=1, is offered and claimed only by a daemon declaring audit-shard, and is green only when all n shards are";
  const shardParse = serverU.span("function parseAuditShards(", "\n}")?.text ?? null;
  const shardRowOf = serverU.span("function shardedAuditRowOf(", "\n}")?.text ?? null;
  const shardClaimFn = serverU.span("async function claimAuditShard(", "\n}")?.text ?? null;
  const unshardedClaim = serverU.span("async function helperClaim(", "\n}")?.text ?? null;
  const expireFn = serverU.span("function expireHelperClaims(", "\n}")?.text ?? null;
  const shardViewFn = serverU.span("function helperJobsView(", "// --- THE OWNER'S HALF OF THE REGISTER")?.text ?? null;
  const resultFn = serverU.span("async function helperResult(", "\n}")?.text ?? null;
  const heartbeat = serverU.span('if (url.pathname === "/api/helper/device" && req.method === "POST")', "const d = setHelperDevice(")?.text ?? null;
  const shardParts: [string, string | null][] = [["parse", shardParse], ["rowOf", shardRowOf], ["claimShard", shardClaimFn],
    ["claim", unshardedClaim], ["expire", expireFn], ["view", shardViewFn], ["result", resultFn], ["heartbeat", heartbeat]];
  if (shardParts.some(([, t]) => t === null))
    pin(RULE_SHARDS, false, shardParts.map(([n, t]) => `${n}=${t !== null}`).join(" "));
  else {
    const unshardedRow = /const row: PostLandAuditRow = \{[\s\S]*?\n  \};/.exec(resultFn!)?.[0] ?? "";
    pin(`${RULE_SHARDS} (a) n=1 is today: an empty or unreadable FLEET_AUDIT_SHARDS is 1, and every shard branch is guarded`,
      /if \(t === ""\) return 1;/.test(shardParse!) && /stay unsharded \(1\)"\);\n  return 1;/.test(shardParse!)
        && /const AUDIT_SHARDS = parseAuditShards\(process\.env\.FLEET_AUDIT_SHARDS\);/.test(server)
        && /if \(!c && \(shardRun \|\| AUDIT_SHARDS > 1\)\)/.test(shardViewFn!)
        && /if \(AUDIT_SHARDS > 1 \|\| auditShardRuns\.has\(repo\)\)/.test(unshardedClaim!)
        && /if \(auditShardRuns\.size && settleAuditShardRuns\(now\)\)/.test(expireFn!)
        && /\.\.\.\(auditShardRuns\.size \? \{ auditShardRuns: /.test(server)
        && unshardedRow !== "" && !/shard/.test(unshardedRow),
      `row=${unshardedRow !== ""} rowNamesShard=${/shard/.test(unshardedRow)}`);
    pin(`${RULE_SHARDS} (b) both doors read the feature, the heartbeat replaces it every beat, and the daemon declares it`,
      /if \(shardCapable\) jobs\.push\(\.\.\.auditShardJobViews\(/.test(shardViewFn!)
        && /features\?\.includes\(AUDIT_SHARD_FEATURE\)/.test(shardViewFn!)
        && /if \(!helperDevices\.get\(deviceId\)\?\.features\?\.includes\(AUDIT_SHARD_FEATURE\)\)/.test(shardClaimFn!)
        && /const AUDIT_SHARD_FEATURE = "audit-shard";/.test(server)
        && /reported\.features = Array\.isArray\(body\?\.features\)[\s\S]*?: undefined;/.test(heartbeat!)
        && /export const DAEMON_FEATURES: readonly string\[\] = \["audit-shard"\];/.test(daemonSrc)
        && /features: DAEMON_FEATURES,/.test(daemonSrc),
      `view=${/shardCapable/.test(shardViewFn!)} claim=${/AUDIT_SHARD_FEATURE/.test(shardClaimFn!)} daemon=${/DAEMON_FEATURES/.test(daemonSrc)}`);
    pin(`${RULE_SHARDS} (c) the merge is green only with all n green, and red outranks unknown`,
      /const allGreen = reported\.length === n && reported\.every\(\(x\) => x\.r\.result === "green"\);/.test(shardRowOf!)
        && /reds\.length \? "red" : allGreen \? "green" : "unknown"/.test(shardRowOf!),
      `allGreenNeedsN=${/reported\.length === n/.test(shardRowOf!)}`);
  }

  // --- THE S1 HANDSHAKE. A command job is offered ONLY to a device whose heartbeat named a
  // `daemonSha`, and the claim refuses one that did not. Both halves, because the jobs list alone is
  // not a gate: a device may POST a jobId it learned any other way.
  const RULE_SHA = "a command job is offered and claimed only by a daemon that named its own daemonSha";
  // the body's terminator is the NEXT declaration, not a bare `\n}` — the function opens with a
  // multi-line return TYPE whose own closing brace would cut this span short of everything it reads
  const jobsView = serverU.span("function helperJobsView(", "// --- THE OWNER'S HALF OF THE REGISTER")?.text ?? null;
  pin(RULE_SHA,
    jobsView !== null && /daemonSha/.test(jobsView) && /if \(!cmdCapable\) break;/.test(jobsView)
      && claimFn !== null && /helperDevices\.get\(deviceId\)\?\.daemonSha/.test(claimFn),
    jobsView === null ? "helperJobsView not found"
      : `view=${/daemonSha/.test(jobsView)} claim=${claimFn !== null && /daemonSha/.test(claimFn)}`);

  // --- …AND THE SHA IS READ, NOT COUNTED. Presence proves the daemon measured its own tree; it does
  // not prove that tree knows `kind`. A daemon between `79acd2e` and `1748417` reports a sha and
  // still falls through to `cfg.suiteCmd` — the receipt of a suite run for a command nobody ran. So
  // the claim measures ANCESTRY of the command-kind commit, and the three halves are pinned here
  // because none of them is TypeScript's to keep: the floor DEFAULT is a literal (an env knob may
  // move it for a throwaway instance, never for this fleet), the measurement is a git call whose
  // exit code is the answer, and an unmeasurable vintage must fall on the REFUSING side — a
  // `?? true` there would reopen the whole door while every type still checked.
  const RULE_VINTAGE = "a command job is claimed only by a daemon whose sha HAS the command-kind commit as an ancestor, from a per-sha cache";
  const vintageFn = serverU.span("async function daemonKnowsCommandKind(", "\n}")?.text ?? null;
  const floorLine = serverU.span("const HELPER_CMD_FLOOR_SHA =", ";\n")?.text ?? null;
  if (vintageFn === null || claimFn === null || floorLine === null)
    pin(RULE_VINTAGE, false, `vintage=${vintageFn !== null} claim=${claimFn !== null} floor=${floorLine !== null}`);
  else pin(RULE_VINTAGE,
    // the floor default is the commit that taught the daemon `kind: "command"` — measured with
    // `git log -S'kind === "command"' -- helper-daemon/`, not quoted from the Befund that asked for
    // this guard (that one named `d4bb687`, two commits later and an e2e-only change)
    /"1748417c8008224e839f9b944dacb534ce4905a2"/.test(floorLine)
      && /merge-base", "--is-ancestor", HELPER_CMD_FLOOR_SHA, sha/.test(vintageFn)
      && /HELPER_UPDATE_REPO === null \? false/.test(vintageFn)      // unmeasured refuses
      && /helperCmdVintage\.get\(sha\)/.test(vintageFn)             // the cache is keyed by the SHA
      && /helperCmdVintage\.set\(sha, \{ ok, at: Date\.now\(\) \}\)/.test(vintageFn)
      && /HELPER_CMD_VINTAGE_TTL_MS/.test(vintageFn)
      && /await daemonKnowsCommandKind\(daemonSha\)/.test(claimFn),
    `floor=${/1748417c8008224e839f9b944dacb534ce4905a2/.test(floorLine)}`
    + ` mergeBase=${/merge-base/.test(vintageFn)} failClosed=${/=== null \? false/.test(vintageFn)}`
    + ` shaKeyed=${/helperCmdVintage\.get\(sha\)/.test(vintageFn)} calledFromClaim=${/daemonKnowsCommandKind/.test(claimFn)}`);

  // --- PARALLEL SUITES ARE COUNTED, AND THE COUNT IS NOT THE LOAD AVERAGE ------------------------
  // Three parts, none of them TypeScript's to keep, each one a way this could go back to being a
  // load reading without a single type moving.
  //
  // (a) THE COUNT DECIDES, AND IT DECIDES FIRST. `tick` must consult `freeSuiteSlots` BEFORE it
  //     asks for the job list, and must launch through `start` (which reserves the slot
  //     synchronously) rather than awaiting `work` directly. Awaiting it again would still be
  //     correct at cap 1 and would silently cap the work-horse at one forever.
  //
  // (b) EACH PARALLEL RUN GETS ITS OWN LOCK, AND ONLY ABOVE CAP 1. ./e2e-isolated.sh takes
  //     /tmp/fleet-e2e.lock through e2e-stage.sh INSIDE the clone, so two runs on the default lock
  //     serialize there and the whole field buys nothing. The `> 1` is the other half: at cap 1 the
  //     shared lock is what makes a hand-started suite on that machine serialize against the
  //     daemon's, and moving off it would end that silently for every operator who never touched
  //     the new field.
  //
  // (c) THE SERVER REFUSES A FULL MACHINE WITH THAT MACHINE'S OWN WORDS, AND FORGETS THE COUNT OVER
  //     A RESTART. `maxParallelSuites` is that box's configuration and is restored; `running` is a
  //     live fact about another machine's processes, and a restored one would refuse a HEALTHY
  //     helper until the next heartbeat. The asymmetry is the safety, so it is pinned: `running`
  //     must not appear in the device restore block at all.
  const RULE_PAR = "parallel helper runs are COUNTED (not derived from load1), each gets its own suite lock above cap 1, and a restart forgets the count but keeps the cap";
  const tickFn = /export async function tick\([\s\S]*?\n\}/.exec(daemonSrc)?.[0] ?? "";
  const workFn = /async function work\(cfg: HelperConfig, job: JobView\)[\s\S]*?\n\}/.exec(daemonSrc)?.[0] ?? "";
  const devRestore = serverU.span("persisted as { helperDevices?: unknown }).helperDevices", "helperUpdates?: unknown")?.text ?? null;
  const claimDoor = serverU.span("async function helperClaim(", "\n}")?.text ?? null;
  if (daemonSrc === "" || tickFn === "" || workFn === "" || devRestore === null || claimDoor === null)
    pin(RULE_PAR, false,
      `daemon=${daemonSrc !== ""} tick=${tickFn !== ""} work=${workFn !== ""}`
      + ` restore=${devRestore !== null} claim=${claimDoor !== null}`);
  else {
    const freeAt = tickFn.indexOf("freeSuiteSlots(cfg, runningJobs)");
    const listAt = tickFn.indexOf("/api/helper/jobs");
    pin(`${RULE_PAR} (a) the count is consulted before the job list, and work is launched through the reserving start()`,
      freeAt >= 0 && listAt >= 0 && freeAt < listAt
        && /for \(const j of open\) start\(cfg, j\);/.test(tickFn)
        && !/await work\(/.test(tickFn)
        && /function start\([\s\S]{0,400}?runningJobs\+\+;[\s\S]{0,200}?void work\(/.test(daemonSrc),
      `freeSlots@${freeAt} jobsList@${listAt} awaitsWork=${/await work\(/.test(tickFn)}`);
    pin(`${RULE_PAR} (b) a run above cap 1 gets its own FLEET_SUITE_LOCK, and at cap 1 the shared one is left alone`,
      /cfg\.maxParallelSuites > 1\s*\n?\s*\? \{ FLEET_SUITE_LOCK: `\$\{runDir\}\/e2e\.lock` \} : \{\}/.test(workFn)
        // C1 (2026-09-13): the scratch rides at EVERY cap, the lock only above 1 — both in the one env
        // …and a shard job's FLEET_E2E_SHARD beside them (the sharded audit, shardEnv) — spread LAST of the three
        && /const suiteEnv: Record<string, string> = \{ TMPDIR: scratch, \.\.\.lockEnv, \.\.\.shardVars \};/.test(workFn)
        && /const scratch = `\$\{runDir\}\/tmp`;/.test(workFn)
        // the trailing `ctl.signal` is the withdrawal switch (7e601e57) — the lock still travels with the run
        && /runArgv\(j\.argv!, clone, logPath, timeoutMs, suiteEnv(, ctl\.signal)?\)/.test(workFn)
        && /runCmd\(cfg\.suiteCmd, clone, logPath, timeoutMs, suiteEnv(, ctl\.signal)?\)/.test(workFn),
      `suiteEnv=${/maxParallelSuites > 1/.test(workFn)} passedToRun=${/, suiteEnv(, ctl\.signal)?\)/.test(workFn)}`);
    pin(`${RULE_PAR} (c) the claim door reads the device's own pair, and the restore keeps the cap while forgetting the count`,
      /dev\?\.maxParallelSuites !== undefined && \(dev\.running \?\? 0\) >= dev\.maxParallelSuites/.test(claimDoor)
        && claimDoor.indexOf("maxParallelSuites") < claimDoor.indexOf("laneSuiteJobs.get(jobId)")
        && /maxParallelSuites: d\.maxParallelSuites/.test(devRestore)
        // the KEY, not the word: the block's own comment explains why the count is absent, and a
        // bare-word test would be satisfied by deleting that explanation
        && !/\brunning:/.test(devRestore),
      `door=${/dev\?\.maxParallelSuites/.test(claimDoor)}`
      + ` capRestored=${/maxParallelSuites: d\.maxParallelSuites/.test(devRestore)}`
      + ` countRestored=${/\brunning:/.test(devRestore)}`);
  }
}

// --- WAKE-ON-LAN IS THE ONE NAMED EXCEPTION TO "NO PUSH", AND IT STAYS ONE ---------------------
// Three rules, and each one guards a different way this could quietly stop being true.
//
// (a) ONE SOCKET. `helper-daemon/README.md` §The rules names exactly one place this Fleet opens
//     anything towards a helper. A second UDP call site anywhere in the server universe is a second
//     such place — that is a doctrine change, not a refactor, and it has to be argued rather than
//     merged. The pin is a COUNT, so a new one fails here whatever it calls itself.
//
// (b) THAT SOCKET CALLS setBroadcast. Measured on the fleet host 2026-09-03: without it every send
//     to a broadcast address fails EACCES (a Python control without SO_BROADCAST fails identically,
//     and with it 102 bytes go out at once). A constructor OPTION proves nothing — Bun 1.3.9
//     accepts `{thisOptionDoesNotExist:true}` without complaint, so a `{broadcast:true}` in the
//     options object is not evidence of anything. Drop the METHOD call and the suite stays green
//     over a loopback address while every real send throws: a feature that exists only in its test.
//
// (c) NO MAC IN THE CODE. The address of a helper machine's card is env on the host and nothing
//     else — this repo is public. A MAC-shaped literal in the server or client universe is either
//     a hard-coded device or a debug line that outlived its debugging.
{
  const RULE_WOL = "wake-on-lan is one UDP call site in the server, it calls setBroadcast, and no MAC is written down";
  const udpSites = [...serverU.text.matchAll(/Bun\.udpSocket\(/g)].length;
  const sender = serverU.span("async function sendWakeFrame(", "\n}\n", 3);
  pin(`${RULE_WOL} — exactly one Bun.udpSocket call site in the server universe`,
    udpSites === 1, `${udpSites} call site(s)`);
  pin(`${RULE_WOL} — that call site is sendWakeFrame and it calls setBroadcast(true) before sending`,
    sender !== null && /Bun\.udpSocket\(/.test(sender.text)
      && /\.setBroadcast\(true\)/.test(sender.text)
      && sender.text.indexOf(".setBroadcast(true)") < sender.text.indexOf(".send("),
    sender === null ? "sendWakeFrame was not found in the server universe"
      : `broadcast@${sender.text.indexOf(".setBroadcast(true)")} send@${sender.text.indexOf(".send(")} in ${sender.file}`);
  // the literal below is built rather than written, so this rule cannot match itself
  const macRe = new RegExp(`(?:[0-9a-fA-F]{2}${":"}){5}[0-9a-fA-F]{2}`);
  const macHits = [...serverU.files, ...clientU.files].filter((f) => macRe.test(f.text)).map((f) => f.file);
  pin(`${RULE_WOL} — no MAC-shaped literal in the server or client universe`,
    macHits.length === 0, macHits.length ? macHits.join(", ") : "clean");
  // …and the address is MANDATORY CONFIGURATION, never a baked-in default. `255.255.255.255` was
  // measured EHOSTUNREACH from a 0.0.0.0-bound socket on this host even WITH the broadcast flag,
  // so a default would be a value that throws in production while the suite points elsewhere.
  const addrLine = /const HELPER_WAKE_ADDR[^\n]*\n/.exec(serverU.module("server.ts"))?.[0] ?? "";
  // scanned on the DECLARATION LINE, not over the whole universe: the measurement that produced
  // this rule is written down in the prose beside it, and a rule that forbids naming the value it
  // forbids would make its own reasoning unwritable.
  pin(`${RULE_WOL} — the wake address is required configuration with no default`,
    /process\.env\.FLEET_HELPER_WAKE_ADDR/.test(addrLine) && /\|\| null;/.test(addrLine)
      && !/["'`]/.test(addrLine.replace(/^[^=]*=/, "")),
    addrLine.trim() || "HELPER_WAKE_ADDR not found");
}

// ================================================================================================
// SECTION S11 — HELPER PRESENCE HAS ONE SOURCE. "Is that machine there?" is answered in three
// places now — the owner's dot, /api/self/gate, and the door that decides whether a lane's preview
// offer is minted at all — and before this cut two of them were going to answer it from two
// different copies of 90_000 (src/client.ts had its own const). A window that drifts does not
// fail loudly: the board draws a green dot over a machine the offer door has already written off.
// ================================================================================================
// WHY A PIN AND NOT A TEST. The two sides are a TypeScript constant and a number that travels
// through a JSON payload into a DOM string; a compiler sees neither the duplication nor its
// absence. Pinned on the DECLARATION rather than on the literal, deliberately: `90_000` also
// appears in src/client.ts as gateAge's formatting threshold, which is a different number that
// happens to be equal, and a rule that could not tell them apart would be a rule nobody keeps.
{
  const RULE_ONLINE = "the helper online window is declared once, in the server, and reaches the client through the projection";
  const decls = (u: Universe): string[] =>
    u.files.filter((f) => /const DEVICE_ONLINE_MS\s*=/.test(f.text)).map((f) => f.file);
  const serverDecls = decls(serverU);
  const clientDecls = decls(clientU);
  pin(`${RULE_ONLINE} — exactly one declaration, and it is in the server universe`,
    serverDecls.length === 1 && serverDecls[0] === "server.ts" && clientDecls.length === 0,
    `server=[${serverDecls.join(",")}] client=[${clientDecls.join(",")}]`);
  // …and it is CONFIGURABLE with the measured default kept. A knob whose default drifted would move
  // production behaviour under a line whose whole justification is the 90 s measurement beside it.
  const line = /const DEVICE_ONLINE_MS[^\n]*\n/.exec(serverU.module("server.ts"))?.[0] ?? "";
  pin(`${RULE_ONLINE} — env-tunable with the 90 s default unchanged`,
    /process\.env\.FLEET_DEVICE_ONLINE_MS/.test(line) && /90_000/.test(line),
    line.trim() || "DEVICE_ONLINE_MS not found");
  // THE WIRE. The window and the rows travel TOGETHER — a payload with devices and no window is one
  // the client cannot judge — and the client reads the served value rather than a fallback of its own.
  const proj = /\.\.\.\(helperDevices\.size \? \{[^}]*\}/.exec(serverU.module("server.ts"))?.[0] ?? "";
  pin(`${RULE_ONLINE} — /api/sessions ships helperOnlineMs in the SAME conditional as helperDevices`,
    /helperDevices:/.test(proj) && /helperOnlineMs: DEVICE_ONLINE_MS/.test(proj),
    proj.trim().slice(0, 160) || "the helperDevices projection was not found");
  const clientText = clientU.text;
  pin(`${RULE_ONLINE} — the client reads the served window and never falls back to a number of its own`,
    /deviceOnlineMs = data\.helperOnlineMs \?\? null/.test(clientText)
      && !/helperOnlineMs \?\? \d/.test(clientText),
    /deviceOnlineMs = data\.helperOnlineMs/.test(clientText) ? "reads the projection" : "no read of data.helperOnlineMs found");
  // …and the harness ARMS the knob. Same shape as the FLEET_MIGRATE_PCT pin above and the same
  // reason: with the 90 s production default, e2e/lane-suite.ts's "nothing is beating" precondition
  // would be a race against how long the nine modules before it happened to take, not a fact.
  pin(`${RULE_ONLINE} — e2e-isolated.sh arms a short window, or the offline half measures nothing`,
    /\bFLEET_DEVICE_ONLINE_MS=[1-9]\d*\b/.test(read("e2e-isolated.sh")),
    /FLEET_DEVICE_ONLINE_MS=(\d+)/.exec(read("e2e-isolated.sh"))?.[1] ?? "not armed");
  // THE DOOR. The refusal has to stand in front of MINTING and behind the idempotent
  // existing-offer branch, or a lane loses track of an offer it already made the moment its helper
  // goes quiet. Order asserted by position, the same shape §S10 uses on the jobs door.
  const offerDoor = serverU.span('/api/self/suite-offer" && (req.method === "GET"', "laneSuiteJobs.set(job.id, job)")?.text ?? null;
  pin(`${RULE_ONLINE} — the offer door refuses to MINT while nothing is beating, after the existing-offer branch`,
    offerDoor !== null && /helperPresence\(\)/.test(offerDoor)
      && /reason: "no helper online"/.test(offerDoor)
      && offerDoor.indexOf("existing: true") < offerDoor.indexOf('reason: "no helper online"'),
    offerDoor === null ? "the suite-offer door was not found in the server universe"
      : `existing@${offerDoor.indexOf("existing: true")} refusal@${offerDoor.indexOf('reason: "no helper online"')}`);
}

// ================================================================================================
// SECTION S11b — A WITHDRAWN SUITE OFFER KEEPS ITS INTERNAL RECEIPT WITHOUT WIDENING THE WIRE.
// The history is useful only if the live claim is copied before the field whose nullness drives
// claimability is cleared. These fields are records, never inputs to waiting or dispatch decisions.
// ================================================================================================
{
  const RULE_RECEIPT = "suite-offer withdrawal records the former live claim and end time without making either a decision input";
  const route = serverU.span('if (url.pathname === "/api/self/suite-offer/withdraw"',
    '// the lane\'s own account of a verify-suite run')?.text ?? null;
  const claimWasAt = route?.indexOf("job.claimWas =") ?? -1;
  const endedAt = route?.indexOf("job.endedAt = Date.now()") ?? -1;
  const clearAt = route?.indexOf("job.claim = null") ?? -1;
  pin(`${RULE_RECEIPT} — the held claim and end time are recorded BEFORE the live claim is cleared`,
    route !== null && claimWasAt >= 0 && endedAt >= 0 && clearAt >= 0
      && claimWasAt < clearAt && endedAt < clearAt
      && /job\.claimWas\s*=\s*\{\s*deviceId:\s*held\.deviceId,\s*name:\s*held\.name,\s*claimedAt:\s*held\.claimedAt,\s*expiresAt:\s*held\.expiresAt\s*\}/s.test(route),
    route === null ? "the suite-offer withdraw route was not found"
      : `claimWas@${claimWasAt} endedAt@${endedAt} clear@${clearAt}`);
  // THE NO-READER HALF, and it is asymmetric on purpose — the two field names are not equally
  // provable by text. `claimWas` is unique in this tree, so counting every mention in server.ts
  // proves there is no reader ANYWHERE in it. `endedAt` is not: `ProgramLineageEntry` carries a
  // field of the same name and reads it legitimately (the auto-close authority join added in
  // 42692a0a is one such reader). A whole-file count of `endedAt` therefore measures the lineage,
  // not the receipt — that is why it went red on a correct tree and was dropped. What replaces it
  // is the reachable half: the receipt field is only ever touched through the `job` binding, so
  // `job.endedAt` occurring exactly once means the one occurrence is the write. The title says
  // that asymmetry out loud rather than claiming a proof this pin does not carry.
  const srvText = serverU.module("server.ts");
  const suiteJob = srvText.match(/interface LaneSuiteJob \{[\s\S]*?\n\}/)?.[0] ?? "";
  const claimWasMentions = (srvText.match(/\bclaimWas\b/g) ?? []).length;
  const endedAtOnJob = (srvText.match(/\bjob\.endedAt\b/g) ?? []).length;
  const endedAtWrites = (srvText.match(/\bjob\.endedAt\s*=/g) ?? []).length;
  pin(`${RULE_RECEIPT} — claimWas has one declaration and one write and NO reader in server.ts, and endedAt none through the job binding`,
    suiteJob !== "" && (suiteJob.match(/\bclaimWas\??:/g) ?? []).length === 1
      && (suiteJob.match(/\bendedAt\??:/g) ?? []).length === 1
      && claimWasMentions === 2 && endedAtOnJob === 1 && endedAtWrites === 1,
    `suite job=${suiteJob !== ""}; claimWas mentions=${claimWasMentions} (declaration+write=2); `
      + `job.endedAt uses=${endedAtOnJob} writes=${endedAtWrites}`);
}

// ================================================================================================
// SECTION S12 — THE HELPER ARTEFACT RAIL. A suite.log arrives AFTER the audit row it belongs to,
// and the whole design rests on two facts a compiler cannot see: the rail never touches the audit
// trail, and the daemon uploads only after its verdict is already in. Both other sides are text —
// an append-only file and a program on another machine.
// ================================================================================================
{
  const RULE_ART = "the artefact rail is a SIDE rail: it cannot reach the audit trail, and the upload follows the verdict";
  const srv = serverU.module("server.ts");
  // 1. THE RAIL AND THE TRAIL ARE DIFFERENT FILES, and the upload handler writes only to the rail.
  //    A single appendEvent(POSTLAND_AUDIT_FILE, …) inside it would make "an upload cannot move a
  //    result" a rule somebody has to keep instead of a thing the code cannot do.
  const route = serverU.span("const artifact = /^\\/api\\/helper\\/artifact", "const bundle = /^")?.text ?? null;
  pin(`${RULE_ART} — the upload handler appends to HELPER_ARTIFACT_FILE and to nothing else`,
    route !== null && /appendEvent\(HELPER_ARTIFACT_FILE/.test(route)
      && !/appendEvent\(POSTLAND_AUDIT_FILE/.test(route)
      && !/writeFileSync\(POSTLAND_AUDIT_FILE/.test(route),
    route === null ? "the artefact route was not found in the server universe" : "one writer, the rail");
  // 2. THE KEY IS THE ROW'S `at`, never the job id. An audit job's id is sha256(repo) and repeats
  //    for every audit of that repo — a jobId key would collide by construction, which is exactly
  //    the mistake the adjudication rail's comment warns about. Since 2026-09-06 the rail keys TWO
  //    kinds of row and the variable is `rowAt`; the property pinned is unchanged — the key comes
  //    off `?at=`, and each kind resolves ITS OWN row from it with no newest-anything fallback.
  pin(`${RULE_ART} — the route REQUIRES the row key and offers no newest-job fallback`,
    route !== null && /searchParams\.get\("at"\)/.test(route)
      && /expected \?at=/.test(route)
      && /r\.at === rowAt/.test(route)
      && /lane\.result\.remote\.reportedAt !== rowAt/.test(route),
    route === null ? "not found" : "at is required and resolves the row");
  // 3. THE ORDER, on the daemon's side. `report()` sends the verdict and only then calls the
  //    uploader; a call site that moved above the result POST would make a transfer able to hold a
  //    verdict up, which is the one property this whole rail is built around.
  const daemonSrc = exists("helper-daemon/daemon.ts") ? read("helper-daemon/daemon.ts") : "";
  if (daemonSrc === "") skip(`${RULE_ART} — the daemon uploads AFTER the result POST`, "helper-daemon/daemon.ts is not in this tree");
  else {
    const reportFn = /async function report\([\s\S]*?\n\}/.exec(daemonSrc)?.[0] ?? "";
    const postAt = reportFn.indexOf('"/api/helper/result"');
    const upAt = reportFn.indexOf("uploadSuiteLog(");
    pin(`${RULE_ART} — the daemon uploads AFTER the result POST, and never awaits it before one`,
      postAt >= 0 && upAt > postAt,
      reportFn === "" ? "report() was not found" : `resultPOST@${postAt} upload@${upAt}`);
    // …and a failed upload is a LOG LINE. A throw would propagate out of report() into work()'s
    // `finally`, and a retry loop would hammer a box that may simply be down.
    const upFn = /async function uploadSuiteLog\([\s\S]*?\n\}/.exec(daemonSrc)?.[0] ?? "";
    pin(`${RULE_ART} — an upload failure is logged and dropped: no throw, no retry, no backoff`,
      upFn !== "" && /catch \(e\) \{/.test(upFn) && /log\(`suite\.log upload/.test(upFn)
        && !/for \(|while \(|setTimeout\(/.test(upFn),
      upFn === "" ? "uploadSuiteLog was not found" : "one try/catch, one log line");
  }
  // 4. THE STORE IS UNDER STREAM_DIR, which .gitignore ignores as a whole directory. An artefact
  //    written anywhere else would be the untracked file that blocks a land — silently, hours later.
  pin(`${RULE_ART} — artefacts are stored under STREAM_DIR, and .gitignore ignores that directory`,
    /const HELPER_ARTIFACT_DIR = `\$\{STREAM_DIR\}\/helper-artifacts`/.test(srv)
      && /^streams\/$/m.test(read(".gitignore"))
      && /^helper-artifacts\.jsonl$/m.test(read(".gitignore")),
    `dir=${/HELPER_ARTIFACT_DIR = `[^\n]*/.exec(srv)?.[0] ?? "not found"}`);
}

{
  // THE HEARTBEAT IS NEVER SUSPENDED BY A JOB. Measured 2026-09-05: the daemon took a lane's
  // preview at 14:01:17 and did not POST /api/helper/device again until 14:31:03 — 1789 s of
  // silence around a 1768 s run, because `tick()` then ended in `await work(cfg, open)`. The whole
  // register is derived from that one timestamp (server.ts#helperPresence, 90 s window), so for
  // half an hour every lane asking "is another machine there?" was told NO by a machine that was
  // at that moment running that lane's own suite — and the audit rail never noticed, because its
  // remote assignment is a pull queue that asks no presence question at all. 84c16f2 fixed it by
  // launching the job instead of awaiting it. This pin is here rather than in a suite because the
  // property is a SHAPE of one file, costs a millisecond, and its loss is invisible for exactly as
  // long as nobody looks. docs/messungen/2026-09-05-suite-offer-online-divergenz.md
  const RULE_BEAT = "the helper daemon's heartbeat is never suspended by a job it is running";
  const src = exists("helper-daemon/daemon.ts") ? read("helper-daemon/daemon.ts") : "";
  if (src === "") skip(`${RULE_BEAT} — tick() launches a job instead of awaiting it`, "helper-daemon/daemon.ts is not in this tree");
  else {
    // FAILS AS ITSELF when it cannot measure: a renamed tick() or start() must make this pin red on
    // its own terms, never pass because the regex found nothing to object to.
    const tickFn = /export async function tick\(cfg: HelperConfig, st: LoopState\)[\s\S]*?\n\}/.exec(src)?.[0] ?? "";
    const startFn = /function start\(cfg: HelperConfig, job: JobView\): void \{[\s\S]*?\n\}/.exec(src)?.[0] ?? "";
    pin(`${RULE_BEAT} — tick() and start() are both still there to be read`,
      tickFn !== "" && startFn !== "",
      `tick=${tickFn.split("\n").length} lines start=${startFn.split("\n").length} lines`);
    // 1. THE LAUNCH IS NOT AWAITED. `await work(` anywhere in tick() is the 2026-09-05 regression
    //    byte for byte; the job goes through start(), which returns void.
    pin(`${RULE_BEAT} — tick() hands the job to start() and never awaits work()`,
      tickFn !== "" && /start\(cfg, j\);/.test(tickFn) && !/await work\(/.test(tickFn),
      tickFn === "" ? "tick() was not found" : `awaitWork=${/await work\(/.test(tickFn)}`);
    pin(`${RULE_BEAT} — start() launches work() fire-and-forget (void, with catch and finally)`,
      startFn !== "" && /void work\(cfg, job\)/.test(startFn) && !/await work\(/.test(startFn)
        && /\.finally\(/.test(startFn),
      startFn === "" ? "start() was not found" : "void work(...) with a finally");
    // 2. THE BEAT COMES FIRST. A machine at its cap returns from tick() before it reads the job
    //    list; if the heartbeat sat below that return, a busy daemon would go dark by a second
    //    route and this rule would be worth nothing.
    const beatAt = tickFn.indexOf('"/api/helper/device"');
    const capAt = tickFn.indexOf("freeSuiteSlots(");
    pin(`${RULE_BEAT} — the heartbeat is sent BEFORE the capacity return, so a machine at its cap stays visible`,
      beatAt >= 0 && capAt > beatAt,
      tickFn === "" ? "tick() was not found" : `beat@${beatAt} capReturn@${capAt}`);
  }
}

{
  // A DAEMON-UPDATE STARTS ALONE, ON AN EMPTY MACHINE. Measured 2026-09-14 09:24 on
  // secondhostlinux1: one poll claimed the waiting post-land audit AND the update; the update swapped
  // and exited 75, and the audit's claim stayed on the fleet ~45 min with no run behind it — the
  // deploy behind that audit waited with it. The behaviour is checked in e2e/helper-daemon.ts (HD),
  // which runs only in ./e2e-isolated.sh; this pin is the gate's half: tick() must pick its starts
  // through jobsToStart, and jobsToStart must still carry both rules (nothing beside or before the
  // update; the update only at running 0).
  const RULE_UPD = "a helper daemon offered its own daemon-update claims nothing else in that poll and starts the update only with no job running";
  const src = exists("helper-daemon/daemon.ts") ? read("helper-daemon/daemon.ts") : "";
  if (src === "") skip(RULE_UPD, "helper-daemon/daemon.ts is not in this tree");
  else {
    const tickFn = /export async function tick\(cfg: HelperConfig, st: LoopState\)[\s\S]*?\n\}/.exec(src)?.[0] ?? "";
    const pickFn = /export function jobsToStart\([\s\S]*?\n\}/.exec(src)?.[0] ?? "";
    const routed = /const open = jobsToStart\(list\.jobs \?\? \[\], free, runningJobs\);/.test(tickFn)
      && /for \(const j of open\) start\(cfg, j\);/.test(tickFn);
    const updateFirst = /const update = jobs\.find\(\(j\) => j\.kind === "daemon-update"\);/.test(pickFn)
      && /if \(update && \(running > 0 \|\| !update\.claim\)\) return running === 0 \? \[update\] : \[\];/.test(pickFn);
    const neverBeside = /j\.kind !== "daemon-update"/.test(pickFn);
    pin(RULE_UPD, tickFn !== "" && pickFn !== "" && routed && updateFirst && neverBeside,
      `tick=${tickFn !== ""} jobsToStart=${pickFn !== ""} routed=${routed} updateGate=${updateFirst} excludedFromSlice=${neverBeside}`);
  }
}

{
  const RULE_D2 = "program status is a read-only projection and the poll derives only stale active Programs";
  const sessionsAt = server.indexOf('url.pathname === "/api/sessions"');
  const tasksAt = sessionsAt < 0 ? -1 : server.indexOf("tasks: tasks.map(taskDigest)", sessionsAt);
  const attentionAt = sessionsAt < 0 ? -1 : server.indexOf("attentionOpen:", sessionsAt);
  const pollStatus = attentionAt < 0 || tasksAt < 0 ? "" : server.slice(attentionAt, tasksAt);
  pin(`${RULE_D2} — programsStale is derived from programOccupancy for active Programs and omitted at zero`,
    pollStatus.includes('p.status === "active"')
      && pollStatus.includes('programOccupancy(p) === "stale"')
      && pollStatus.includes("stale > 0 ? { programsStale: stale } : {}"),
    pollStatus === "" ? "the attentionOpen→taskDigest poll block was not found"
      : `${pollStatus.split("\n").length} lines inspected`);
  pin(`${RULE_D2} — the owner poll reads no ledger`,
    pollStatus !== "" && !pollStatus.includes("readLedger("),
    pollStatus === "" ? "the attentionOpen→taskDigest poll block was not found" : "poll block inspected");

  const statusSpan = serverU.span("function programStatusView(p: Program, ctx?: ProgramStatusContext)",
    "// V1b — THE RETURN PATH");
  const statusBody = statusSpan?.text ?? "";
  pin(`${RULE_D2} — programStatusView contains no mutation primitive`,
    statusBody !== "" && !/\b(?:saveState|saveStateNow|appendEvent|sendText|spawnCmd)\b/.test(statusBody),
    statusBody === "" ? "programStatusView not found in server.ts" : "projection body inspected");

  const ownerSpan = serverU.span('url.pathname === "/api/programs" && req.method === "GET"',
    'url.pathname === "/api/programs" && req.method === "POST"');
  const ownerBody = ownerSpan?.text ?? "";
  pin(`${RULE_D2} — the owner list calls programStatusView without a ledger and opens no ledger`,
    ownerBody.includes("executionStatus: programStatusView(p)") && !ownerBody.includes("readLedger("),
    ownerBody === "" ? "the GET /api/programs route was not found" : "owner list body inspected");
}

{
  const RULE_FAILS = "the local audit row's fails pass through helperFailNames";
  const local = server.match(/function localFailNames\([\s\S]*?\n\}/)?.[0] ?? "";
  const audit = server.match(/async function runPostLandAudit\([\s\S]*?\n\}/)?.[0] ?? "";
  pin(`${RULE_FAILS} — localFailNames exists and reads the harness's FAIL lines`,
    local !== "" && local.includes("/^FAIL  (.*)$/") && local.includes('.indexOf("  (")'),
    local === "" ? "localFailNames not found in server.ts" : "FAIL line and detail suffix are explicit");
  const failNamesAt = audit.indexOf("helperFailNames(localFailNames(");
  pin(`${RULE_FAILS} — the local audit row's fails pass through helperFailNames`,
    audit !== "" && failNamesAt >= 0,
    audit === "" ? "runPostLandAudit not found in server.ts" : `helperFailNames(localFailNames)@${failNamesAt}`);
  const redAt = audit.indexOf('result = "red"');
  pin(`${RULE_FAILS} — local fail names are assigned only after red classification`,
    audit !== "" && redAt >= 0 && failNamesAt > redAt,
    audit === "" ? "runPostLandAudit not found in server.ts" : `red@${redAt} fails@${failNamesAt}`);
  pin(`${RULE_FAILS} — local check counting keeps the helper-name argument absent`,
    audit.includes("postLandAuditChecks(completeOutput, exitCode, undefined, true)"),
    audit === "" ? "runPostLandAudit not found in server.ts" : "postLandAuditChecks local call inspected");
}

// ================================================================================================
// A FLEET-COMPOSED PANE HINT NEVER ENDS ON A SHELL SIGIL TOKEN
// ================================================================================================
// Measured 2026-09-05 (docs/messungen/2026-09-05-astra-d0-report-zustellung.md, repro at
// codex-cli 0.153.4 / 200x50): every event hint ended `… from $FLEET_SELF_TOKEN.`, and in the Codex
// TUI a `$`-token sitting at the CURSOR — which after a paste is the last token — opens the mention
// overlay ("no matches" / "Press enter to insert or esc to close"). That overlay EATS the Enter.
// Fleet then behaved exactly as designed and that is why nothing shouted: the composer still held
// the full payload, rollbackOwnComposerPayload cleared it, the send was recorded send-uncertain,
// and the bounded recovery replayed the identical paste five times. 9 of 9 events to that slot were
// never delivered; every Claude receiver in the same ledger took the same tail at attempts=1.
//
// The trigger is POSITIONAL — the control run with the same `$` token NOT at the end submitted
// fine — so this is deliberately NOT a sigil ban on shell text, user text, or docs. It is a rule
// about the END of the small, DERIVED set of strings Fleet composes and types into someone's pane.
{
  const RULE_SIGIL = "a Fleet-composed pane hint never ENDS on a shell sigil token (a cursor-adjacent $NAME opens the Codex mention overlay, which eats the Enter)";
  // the tail shape itself: a `$NAME` token with nothing after it but closing punctuation
  const SIGIL_TAIL = /\$[A-Za-z_][A-Za-z0-9_]*[\s.,;:!?)\]"'`]*$/;
  // THE SUBJECT IS DERIVED, never listed: every builder whose output the server assigns to `text`
  // and hands to sendText. A new event kind with a new builder joins this rule by existing; a
  // `const text = await req.text()` contributes no name and is silently not this class.
  // which half of the derived set each name belongs to is DERIVED TOO, from lane-signals.ts's own
  // export list — a builder moved between the two files changes halves without an edit here.
  const LANE_SIGNAL_MESSAGE_EXPORTS = new Set(
    [...read("lane-signals.ts").matchAll(/export function (\w*Message)\s*\(/g)].map((m) => m[1]!));
  const builders = new Set<string>();
  for (const m of serverU.text.matchAll(/const text = ((?:[^;]|\n)*?);/g))
    for (const n of m[1]!.matchAll(/\b(\w*Message)\s*\(/g)) builders.add(n[1]!);
  // fails as ITSELF, and in BOTH halves: a derivation that collapsed to one file would leave every
  // row below trivially true — the same green, measured over half the subject.
  pin(`${RULE_SIGIL} — the subject set is derived from the server universe's pane sends, and holds both halves`,
    builders.size > 0
      && [...builders].some((n) => LANE_SIGNAL_MESSAGE_EXPORTS.has(n))
      && [...builders].some((n) => !LANE_SIGNAL_MESSAGE_EXPORTS.has(n)),
    `${builders.size} builder(s): [${[...builders].sort().join(", ")}]`);

  // --- HALF ONE: the lane-signals builders are CALLED, not read. Rendering is the only way to see
  //     the tail that `${eventAck(event.id)}` actually contributes — a source scan sees `}`.
  const laneEvent = { id: "e1", kind: "lane-ready" as const,
    payload: { ahead: 3, dirty: 0, idleMs: 120_000, observed: true, gitOp: false, awaiting: null, hostCommits: false } };
  const rendered: Record<string, string> = {
    laneWatchMessage: laneWatchMessage(7, "fleet/probe", laneEvent, { report: null, suiteOffer: { id: "j3", state: "claimed" } }),
    laneReported: laneWatchMessage(7, "fleet/probe", laneEvent, { report: { id: "r2", status: "complete" }, suiteOffer: null }),
    hostCommitReady: laneWatchMessage(7, "fleet/probe", { ...laneEvent, kind: "host-commit-ready" }, null),
    mergeWatchMessage: mergeWatchMessage(7, "/tmp/probe", { id: "e2", kind: "merge-terminal",
      payload: { status: "merged", landed: true, branch: "fleet/probe", at: 0, verify: { ok: true } } }),
    auditWatchMessage: auditWatchMessage("probe", "a".repeat(40), { id: "e3", kind: "post-land-audit",
      payload: { result: "green", mainSha: "a".repeat(40), covers: [], checks: { ran: 9, failed: 0 } } }),
    deployWatchMessage: deployWatchMessage("d1", { id: "e4", kind: "deploy-terminal",
      payload: { ok: true, stage: "boot", target: "a".repeat(40), bootHead: "a".repeat(40), hitTarget: true, bundleStale: false, at: 0 } }),
    commandJobWatchMessage: commandJobWatchMessage("j1", { id: "e5", kind: "command-job",
      payload: { result: "green", cmd: "bun run build", exitCode: 0, artifacts: [] } }),
    laneSuiteWatchMessage: laneSuiteWatchMessage("j2", { id: "e7", kind: "lane-suite",
      payload: { result: "red", branch: "fleet/probe", exitCode: 1, fails: ["a check"], failCount: 1,
        tail: "12 FAILURES" } }),
    harnessBlockMessage: harnessBlockMessage(7, "fleet/probe", { id: "e8", kind: "harness-block",
      payload: { signal: "denied", tool: "Bash", detail: "rm -rf $SP/$v", key: "0".repeat(16), count: 3, escalated: true } }),
    laneReviewMessage: laneReviewMessage(7, "fleet/probe", { id: "e9", kind: "lane-review",
      payload: { taskId: "deadbeef", programId: null, diffSha: "a".repeat(40), head: "b".repeat(40), model: "claude-opus-5[1m]",
        describedThisDiff: true, raw: false, findingCount: 1, notes: "could not read $HOME",
        findings: [{ title: "unchecked $VAR", file: "server.ts", line: 12, impact: "high" }] } }),
    clarificationWatchMessage: clarificationWatchMessage(7, "fleet/probe", { id: "e6", kind: "clarification-request",
      payload: { requestId: "r1", question: "q", taskId: null, originId: null, programId: null, basis: "lane-watch" } }),
    clarificationReplyMessage: clarificationReplyMessage("r1", "q", "a"),
    attentionAnswerMessage: attentionAnswerMessage("r1", "decision", "raised", "answer"),
    // BOTH branches, because they are two different tails and only one of them is rendered by a
    // single call: the accepted form ends on the MAIN's own reason when it gave one, the rejected
    // form on the re-file instruction. A table that rendered one would leave the other unmeasured.
    fleetReportDecisionAccepted: fleetReportDecisionMessage("a".repeat(24), "accepted", "took the work"),
    fleetReportDecisionRejected: fleetReportDecisionMessage("a".repeat(24), "rejected", null),
  };
  // BOTH DIRECTIONS. A derived builder that lane-signals exports but this table forgot would
  // otherwise leave the rule green over a hint nobody rendered.
  // the table's KEYS are fixture names, not builder names — a builder with more than one shape is
  // rendered under one key per shape (fleetReportDecisionMessage: accepted and rejected). So the
  // coverage question is asked over the builders those keys STAND FOR, declared here beside them,
  // and a builder that reaches this file with neither its own key nor an entry here is still
  // `missing`. Without this the two-shape builder would read as uncovered while being rendered
  // twice, and the honest repair for that is to say which key covers what, not to widen the match.
  const RENDERED_UNDER: Record<string, string> = {
    hostCommitReady: "laneWatchMessage",
    laneReported: "laneWatchMessage",
    fleetReportDecisionAccepted: "fleetReportDecisionMessage",
    fleetReportDecisionRejected: "fleetReportDecisionMessage",
  };
  const exported = new Set(Object.keys(rendered).map((k) => RENDERED_UNDER[k] ?? k));
  const missing = [...builders].filter((n) => LANE_SIGNAL_MESSAGE_EXPORTS.has(n) && !exported.has(n));
  pin(`${RULE_SIGIL} — every derived builder exported by lane-signals.ts is rendered here`,
    missing.length === 0, missing.length ? `no fixture for: ${missing.join(", ")}` : `${exported.size} rendered`);
  const badRender = Object.entries(rendered).filter(([, text]) => SIGIL_TAIL.test(text));
  pin(`${RULE_SIGIL} — rendered: no lane-signals hint ends on $NAME`,
    badRender.length === 0,
    badRender.length
      ? badRender.map(([n, t]) => `${n}: …${JSON.stringify(t.slice(-48))}`).join("; ")
      : `${Object.keys(rendered).length} rendered hint(s), tails clean`);

  // --- HALF TWO: the server-local builders cannot be imported (server.ts boots on import), so they
  //     are read. What is judged is the MESSAGE TAIL and only that: a literal that TERMINATES a
  //     statement. Judging every literal in the body instead was over-broad and was caught in
  //     review — `\`notes $HOME\` + \` in passing.\`` and `\`notes $HOME${suffix}\`` are both legal
  //     (the rendered hint does not end on the sigil), and both were being failed. The counter-probe
  //     two rows down holds that line in BOTH directions so it cannot quietly drift back.
  const TAIL_LIT = /([`"'])((?:\\.|(?!\1)[\s\S])*)\1\s*;/g;
  const ENDS_IN_INTERPOLATION = /\$\{[^}]*\}\s*$/;
  // one tail literal -> flagged / unjudgeable / clean. An interpolated end is NOT strippable: the
  // real last characters are a runtime value, so the honest answer is "not measured", never a pass.
  const judgeTails = (body: string): { tails: number; flagged: string[]; unjudgeable: number } => {
    const flagged: string[] = [];
    let tails = 0, unjudgeable = 0;
    for (const m of body.matchAll(TAIL_LIT)) {
      tails++;
      const lit = m[2]!;
      if (ENDS_IN_INTERPOLATION.test(lit)) { unjudgeable++; continue; }
      if (SIGIL_TAIL.test(lit)) flagged.push(lit);
    }
    return { tails, flagged, unjudgeable };
  };
  const serverLocal = [...builders].filter((n) => !LANE_SIGNAL_MESSAGE_EXPORTS.has(n)).sort();
  const unread: string[] = [];
  const badLit: string[] = [];
  const unjudged: string[] = [];
  for (const name of serverLocal) {
    const body = new RegExp(`(?:async )?function ${name}\\([\\s\\S]*?\\n\\}`).exec(serverU.text)?.[0] ?? "";
    if (!body) { unread.push(name); continue; }
    const r = judgeTails(body);
    if (!r.tails) { unread.push(name); continue; }
    for (const lit of r.flagged) badLit.push(`${name}: …${JSON.stringify(lit.slice(-48))}`);
    if (r.unjudgeable) unjudged.push(`${name}×${r.unjudgeable}`);
  }
  // fails as ITSELF: a builder with no readable message tail is NOT a measured builder
  pin(`${RULE_SIGIL} — every server-local derived builder has a readable message tail`,
    unread.length === 0 && serverLocal.length > 0,
    unread.length ? `no tail found: ${unread.join(", ")}` : `${serverLocal.length} read: [${serverLocal.join(", ")}]`);
  pin(`${RULE_SIGIL} — source: no server-local message TAIL ends on $NAME`,
    badLit.length === 0, badLit.length ? badLit.join("; ") : `${serverLocal.length} builder(s) clean`);
  // never a silent pass: a tail whose last characters are a runtime value was not measured, and the
  // row says so under its own name rather than borrowing the green above.
  if (unjudged.length)
    skip(`${RULE_SIGIL} — tails ending in an interpolation are not judgeable from source`,
      `not measured: ${unjudged.join(", ")}`);

  // --- HALF THREE: the pane texts a tick builds INLINE. Half two's universe is the set of BUILDER
  //     NAMES assigned to `const text`, so a tick that composes its hint from literals on the spot
  //     contributes no name and was never in the subject at all. Read 2026-09-12 at the source: the
  //     inbox nudge closed on `… aus $FLEET_SELF_TOKEN).` and EVERY row above stayed green, while
  //     the Program-MAIN reported 82 unaccepted `inboxNudgeSend` deliveries to a codex pane in one
  //     boot. The relapse list below missed the same text by one character — the `)` before the
  //     period — which is why a substring list can never be the subject. The member set is
  //     DERIVED the same way as the other two halves — a function that calls sendText and assigns a
  //     `const text` opening on a string literal, with no `*Message(` call in the expression (that
  //     is half two's half, and a runtime value like `body.text.trim()` is nobody's).
  const FN_DECL = /(?:async )?function (\w+)\([\s\S]*?\n\}/g;
  const inlineSenders: string[] = [];
  const inlineBad: string[] = [];
  const inlineUnread: string[] = [];
  const inlineUnjudged: string[] = [];
  let fnsScanned = 0;
  for (const m of serverU.text.matchAll(FN_DECL)) {
    fnsScanned++;
    const body = m[0], name = m[1]!;
    if (!body.includes("sendText(")) continue;
    for (const a of body.matchAll(/const text = ((?:[^;]|\n)*?);/g)) {
      const rhs = a[1]!;
      if (/\b\w*Message\s*\(/.test(rhs) || !/^\s*[`"']/.test(rhs)) continue;
      inlineSenders.push(name);
      // the same tail judge as half two, fed ONLY the assignment: a tick body is full of other
      // statement-terminating literals (log lines, keys) that are not the pane hint.
      const r = judgeTails(`const text = ${rhs};`);
      if (!r.tails) { inlineUnread.push(name); continue; }
      for (const lit of r.flagged) inlineBad.push(`${name}: …${JSON.stringify(lit.slice(-48))}`);
      if (r.unjudgeable) inlineUnjudged.push(`${name}×${r.unjudgeable}`);
    }
  }
  // fails as ITSELF, twice over: a body scan that stopped parsing server.ts, and an inline hint
  // whose tail could not be read, are both "not measured" — never the green of a clean tail. An
  // EMPTY member set is the same answer: if every tick hint ever moves behind a builder, half two
  // owns them and THIS row is what says so out loud instead of passing over nothing.
  pin(`${RULE_SIGIL} — the inline tick pane-hint surface is readable`,
    fnsScanned > 100 && inlineSenders.length > 0 && inlineUnread.length === 0,
    inlineUnread.length ? `no tail found: ${inlineUnread.join(", ")}`
      : `${fnsScanned} function(s) scanned, inline hint(s): [${[...new Set(inlineSenders)].sort().join(", ")}]`);
  pin(`${RULE_SIGIL} — source: no inline tick pane hint ends on $NAME`,
    inlineBad.length === 0,
    inlineBad.length ? inlineBad.join("; ") : `${new Set(inlineSenders).size} tick hint(s) clean`);
  if (inlineUnjudged.length)
    skip(`${RULE_SIGIL} — inline tick hints ending in an interpolation are not judgeable from source`,
      `not measured: ${inlineUnjudged.join(", ")}`);

  // THE COUNTER-PROBE, both directions, on the predicate itself — three lines of fixture, no parser.
  // Without it "narrow enough" is an opinion; with it, over-broad and under-broad both fail here.
  const PROBE = [
    { want: true, why: "the measured old closing form", body: "function f(){ return `a ` + `x-fleet-self-token from $FLEET_SELF_TOKEN.`; }" },
    { want: false, why: "a mid-text sigil followed by concatenation", body: "function f(){ return `notes $HOME` + ` in passing.`; }" },
    { want: false, why: "a mid-text sigil before a closing interpolation", body: "function f(){ return `notes $HOME${suffix}`; }" },
  ];
  const wrong = PROBE.filter((c) => (judgeTails(c.body).flagged.length > 0) !== c.want);
  pin(`${RULE_SIGIL} — the tail predicate flags the old closing form and NOTHING mid-text`,
    wrong.length === 0,
    wrong.length ? `misjudged: ${wrong.map((c) => c.why).join("; ")}` : `${PROBE.length} fixtures, both directions`);

  // --- THE MEASURED OLD FORM, negatively. Named as the byte sequence the live failure carried, so
  //     a reintroduction fails under the sentence that describes the incident and not under a regex.
  // the 2026-09-12 form differs from the 2026-09-05 pair by ONE character — the `)` before the
  // period — which is exactly why a substring list is kept beside the derived universe and not
  // instead of it: this row names the byte sequence, half three names the surface.
  const OLD_FORMS = ["x-fleet-self-token from $FLEET_SELF_TOKEN.", "x-fleet-self-token aus $FLEET_SELF_TOKEN.",
    "x-fleet-self-token aus $FLEET_SELF_TOKEN)."];
  const relapsed = OLD_FORMS.filter((f) =>
    serverU.text.includes(f) || read("lane-signals.ts").includes(f)
    || Object.values(rendered).some((t) => t.includes(f)));
  pin(`${RULE_SIGIL} — the exact live-failure tails of 2026-09-05 and 2026-09-12 are gone from every hint universe`,
    relapsed.length === 0, relapsed.length ? `back: ${relapsed.join(" | ")}` : `none of the ${OLD_FORMS.length} measured forms present`);
}

// --- THE ADJUDICATION RAIL'S ACTOR (I14). The land path stopped guessing who acted on 2026-08-23
// (LandProvenance.actor); the adjudication rail kept stamping `by: "owner"` and nothing else, so a
// script judging a red audit was byte-identical in the ledger to the owner clicking the board. The
// three facts below are one function's CONTROL FLOW and a loader's PRESENCE test — a compiler sees
// neither, which is why they are pinned textually and their behaviour is proved in e2e/programs.ts.
{
  const RULE_ACTOR = "the adjudication rail measures its token channel";
  const write = server.match(/async function writeAuditAdjudication\([\s\S]*?\n\}/)?.[0] ?? "";
  const load = server.match(/async function adjudicationsByAudit\([\s\S]*?\n\}/)?.[0] ?? "";
  const bridge = server.match(/async function programsForAuditRow\([\s\S]*?\n\}/)?.[0] ?? "";
  pin(`${RULE_ACTOR} — writeAuditAdjudication takes the request and measures its channel`,
    write !== "" && write.includes("req: Request") && write.includes("tokenChannel(req)"),
    write === "" ? "writeAuditAdjudication not found in server.ts"
      : `req param=${write.includes("req: Request")} tokenChannel=${write.includes("tokenChannel(req)")}`);
  // the principal is still SERVER-STAMPED. Measuring the channel must not turn `by` into something
  // the body can say — that inversion is the whole reason `by` was stamped in the first place.
  pin(`${RULE_ACTOR} — the owner principal stays stamped beside the measured actor`,
    write !== "" && write.includes('by: "owner"') && write.includes("landActorDetail(actor)")
      && write.includes('audit("owner_token_ambient_use"'),
    write === "" ? "writeAuditAdjudication not found in server.ts"
      : `by=${write.includes('by: "owner"')} detail=${write.includes("landActorDetail(actor)")}`);
  // the SUSPECT arm is narrow by construction: cookie is the board's own shape and is never
  // flagged, and the bridge that decides coverage joins repo+branch+tip, never the branch alone.
  pin(`${RULE_ACTOR} — the suspect arm excludes cookie and reads coverage through programsForAuditRow`,
    write !== "" && write.includes('via !== "cookie"') && write.includes("programsForAuditRow(")
      && bridge !== "" && bridge.includes("o.repo !== row.repo") && bridge.includes("o.branch !== cover.branch")
      && bridge.includes("o.mainAfter !== cover.mainAfter"),
    write === "" || bridge === "" ? "writeAuditAdjudication or programsForAuditRow not found in server.ts"
      : `cookie-exempt=${write.includes('via !== "cookie"')} join=${
        ([["repo", "o.repo !== row.repo"], ["branch", "o.branch !== cover.branch"],
          ["mainAfter", "o.mainAfter !== cover.mainAfter"]] as [string, string][])
          .filter(([, c]) => bridge.includes(c)).map(([n]) => n).join("+") || "none"}`);
  // …and the LOADER never invents one. loadLandActor turns unreadable into the honest `unknown`
  // arm, but a persisted row that never carried the key must come back WITHOUT the field: a
  // default here would retro-stamp every judgement made before this rail existed.
  pin(`${RULE_ACTOR} — adjudicationsByAudit loads actor only from a present persisted key`,
    load !== "" && load.includes('hasOwnProperty.call(r, "actor")') && load.includes("loadLandActor(r.actor)"),
    load === "" ? "adjudicationsByAudit not found in server.ts"
      : `presence guard=${load.includes('hasOwnProperty.call(r, "actor")')} loader=${load.includes("loadLandActor(r.actor)")}`);
}

// ================================================================================================
// THE PROGRAM INBOX — the durable back-channel that belongs to the Program, not to an occupant.
// ================================================================================================
// Three of these hold invariants a compiler cannot: an entry that grew a receiver key would turn a
// Program record back into an occupant mailbox (and a succession would lose it again); an inbox
// counted against the FleetEvent delivery cap would make a MAIN's own backlog close its return
// path; and a loader that repaired a bad record field by field would report "there were never any
// pointers" for "these pointers were lost". The fourth is the writer count: the cap and `dropped`
// are only consistent while ONE function maintains them.
{
  const RULE_INBOX = "the program inbox belongs to the Program and names no receiver";
  const entryIface = server.match(/interface ProgramInboxEntry \{[\s\S]*?\n\}/)?.[0] ?? "";
  const getBody = server.match(/function programInboxFor\([\s\S]*?\n\}/)?.[0] ?? "";
  const readBody = server.match(/async function readProgramInboxEntry\([\s\S]*?\n\}\n/)?.[0] ?? "";
  const scope = server.match(/function inboxProgramFor\([\s\S]*?\n\}/)?.[0] ?? "";
  // I1 — no receiver key on the entry, and both doors reach their Program through the ONE authority
  // bracket. A door that read `receiverSlot` would be answering a different question entirely.
  pin(`${RULE_INBOX} — the entry interface names no receiver or requester key, and both inbox routes derive the program through boundProgramForMain only`,
    entryIface !== "" && !/\breceiver\b/.test(entryIface) && !/\brequester\b/.test(entryIface)
      && scope !== "" && scope.includes("boundProgramForMain(")
      && getBody !== "" && getBody.includes("inboxProgramFor(")
      && readBody !== "" && readBody.includes("inboxProgramFor(")
      && !getBody.includes("receiverSlot") && !readBody.includes("receiverSlot")
      && !getBody.includes("fleetEventReceiver(") && !readBody.includes("fleetEventReceiver("),
    entryIface === "" ? "interface ProgramInboxEntry not found in the server universe"
      : scope === "" || getBody === "" || readBody === ""
        ? "inboxProgramFor, programInboxFor or readProgramInboxEntry not found in the server universe"
        : `receiver-free=${!/\breceiver\b/.test(entryIface)} bracket=${scope.includes("boundProgramForMain(")}`);
  // I2 — the delivery cap is about the FleetEvent transport, and the inbox is not on it. If this
  // ever reads an inbox, a Program with 5 unread pointers stops being able to receive reports.
  const budget = server.match(/function slotDeliveryBudget\([\s\S]*?\n\}/)?.[0] ?? "";
  pin(`${RULE_INBOX} — slotDeliveryBudget reads fleetEvents and watches and never an inbox`,
    budget !== "" && budget.includes("fleetEvents.filter(") && budget.includes("watches.filter(")
      && !budget.includes("inbox"),
    budget === "" ? "slotDeliveryBudget not found in the server universe"
      : `events=${budget.includes("fleetEvents.filter(")} watches=${budget.includes("watches.filter(")} inbox=${budget.includes("inbox")}`);
  // I3 — closed and versioned in loadProgramLineage's exact discipline: an unknown key is a refusal,
  // not a tolerated extra, and a v2 shape can never be read as a v1 record.
  const loader = server.match(/const loadProgramInbox = \(value: unknown\): ProgramInboxRead => \{[\s\S]*?\n\};/)?.[0] ?? "";
  pin(`${RULE_INBOX} — loadProgramInbox is closed and versioned like loadProgramLineage`,
    loader !== "" && loader.includes('Object.keys(r).some((k) => !["v", "entries", "dropped"]')
      && loader.includes("r.v !== 1") && loader.includes("PROGRAM_INBOX_MAX"),
    loader === "" ? "loadProgramInbox not found in the server universe"
      : `closed=${loader.includes('Object.keys(r).some((k) => !["v", "entries", "dropped"]')} versioned=${loader.includes("r.v !== 1")}`);
  // …and the ONE writer. `dropped` is only a true count while a single function maintains it, so a
  // second assignment anywhere in the universe is the violation — not a style question.
  const writers = (server.match(/program\.inbox = /g) ?? []).length;
  const append = server.match(/function appendProgramInbox\([\s\S]*?\n\}/)?.[0] ?? "";
  pin(`${RULE_INBOX} — appendProgramInbox is the only writer of the record`,
    writers === 1 && append !== "" && append.includes("program.inbox = ")
      && append.includes("PROGRAM_INBOX_MAX") && append.includes('audit("program_inbox_append"'),
    append === "" ? "appendProgramInbox not found in the server universe"
      : `assignments=${writers} capped=${append.includes("PROGRAM_INBOX_MAX")}`);
  // I4 — the row and its pointer are one state cut, and no occupant transport remains. Appending
  // after the answered assignment or adding a second save would reopen a crash window between the
  // subject and its only durable address.
  const answer = server.match(/async function answerAttention\([\s\S]*?\n\}/)?.[0] ?? "";
  const appendAt = answer.indexOf("appendProgramInbox(");
  const answeredAt = answer.indexOf('request.status = "answered";');
  const savedAt = answer.indexOf("await saveStateNow();", answeredAt);
  const answerSaves = (answer.match(/await saveStateNow\(\);/g) ?? []).length;
  const prune = server.match(/function pruneAttention\([\s\S]*?\n\}/)?.[0] ?? "";
  pin(`${RULE_INBOX} — attention answer appends before answered and persists both once without pane delivery`,
    answer !== "" && appendAt >= 0 && answeredAt > appendAt && savedAt > answeredAt
      && answerSaves === 1 && !answer.includes("sendText(")
      && prune.includes('a.status === "answered" || a.status === "refused"'),
    answer === "" ? "answerAttention not found in server.ts"
      : `append=${appendAt} answered=${answeredAt} saved=${savedAt} saves=${answerSaves} send=${answer.includes("sendText(")}`);
  // I5 — one positive-only timer, and the exact teardown reason reaches the attention reconciler.
  // A second timer can duplicate a paste before the first async tick records its process-local key.
  const inboxTimers = server.split("\n").filter((line) => line.includes("setInterval")
    && line.includes("tickInboxNudge"));
  const teardown = server.match(/async function teardownSlotOccupant\([\s\S]*?\n\}/)?.[0] ?? "";
  const drop = server.match(/function dropWatchesFor\([\s\S]*?\n\}/)?.[0] ?? "";
  pin(`${RULE_INBOX} — the inbox nudge is one positive-only timer and teardown carries its reason to attention reconcile`,
    /const INBOX_NUDGE_MS = [^;\n]*process\.env\.FLEET_INBOX_NUDGE_MS \?\? 60_000[^;\n]*;/.test(server)
      && inboxTimers.length === 1
      && /if \(INBOX_NUDGE_MS > 0\) setInterval\([^\n]*tickInboxNudge/.test(server)
      && teardown.includes("dropWatchesFor(s.id, why)")
      && drop.includes("reconcileAttention(slotId, why)"),
    `timers=${inboxTimers.length} teardown=${teardown.includes("dropWatchesFor(s.id, why)")} reconcile=${drop.includes("reconcileAttention(slotId, why)")}`);
  // I6 — Program reports are a fourth persisted basis but NEVER a FleetEvent payload: all three
  // carrier facts are checked together on hydration, and the open door spends budget only in the
  // older transport branch. A missing symbol fails as itself rather than making an empty body pass.
  const reportParser = server.match(/function fleetReportFrom\([\s\S]*?\n\}/)?.[0] ?? "";
  const reportOpen = server.match(/async function openFleetReport\([\s\S]*?\n\}/)?.[0] ?? "";
  const reportDecide = server.match(/async function decideFleetReport\([\s\S]*?\n\}/)?.[0] ?? "";
  const programDecisionAt = reportDecide.indexOf('report.basis === "program"');
  const nullReceiverAt = reportDecide.indexOf("report.receiver === null");
  pin(`${RULE_INBOX} — fleetReportFrom binds basis program to a null receiver, null eventId and programId`,
    reportParser !== "" && reportParser.includes('r.basis === "program" || r.basis === "owner-inbox"')
      && reportParser.includes('r.basis === "program"') && reportParser.includes("r.eventId !== null")
      && reportParser.includes('typeof provenance.programId !== "string"')
      && reportOpen !== "" && reportOpen.includes('basis: "program", eventId: null')
      && (reportOpen.match(/slotDeliveryBudget\(/g) ?? []).length === 1
      && programDecisionAt >= 0 && nullReceiverAt > programDecisionAt,
    reportParser === "" ? "fleetReportFrom not found in the server universe"
      : reportOpen === "" || reportDecide === "" ? "openFleetReport or decideFleetReport not found in server.ts"
        : `receiver+event=${reportParser.includes("r.eventId !== null")} budgets=${(reportOpen.match(/slotDeliveryBudget\(/g) ?? []).length} decisionOrder=${programDecisionAt}/${nullReceiverAt}`);
  // I7 — the unattended actuator accepts the decision only from the Program's durable authority
  // history. Reading the current binding here would reject a valid verdict after succession.
  const autoClose = server.match(/function laneAutoCloseRefusal\([\s\S]*?\n\}/)?.[0] ?? "";
  pin(`${RULE_INBOX} — the auto-close authority of a program-addressed report is read from Program.lineage`,
    autoClose !== "" && autoClose.includes('r.basis === "owner-inbox"')
      && autoClose.includes('r.basis === "program"') && autoClose.includes("program.lineage.entries.some(")
      && autoClose.includes("e.boundAt <= d.at") && autoClose.includes("e.endedAt >= d.at"),
    autoClose === "" ? "laneAutoCloseRefusal not found in server.ts"
      : `program=${autoClose.includes('r.basis === "program"')} lineage=${autoClose.includes("program.lineage.entries.some(")}`);
  // I8 — A RED POST-LAND AUDIT ADDRESSES THE PROGRAM THAT OWNS THE LAND, and the four halves of
  // that rail are each a must-agree pair no compiler can hold:
  //  · BOTH audit sinks write it. The local run and the helper report produce the same kind of row
  //    about the same tree; a rail wired into only one is silently half a rail, and the remote half
  //    is the one no local test run would ever notice was missing.
  //  · The join is repo + branch + mainAfter TOGETHER. A branch name is reused; a tip is not. On
  //    `branch` alone the second land of `fleet/foo` would drag the first land's Program in.
  //  · The ping is suppressed only on a COMPLETE hand-off (`addressed === row.covers.length`). The
  //    tempting `addressed > 0` is exactly the bug: a mixed land whose programless half nobody sees.
  //  · `audit-red` NEVER arms the pane nudge. The kind exists to take a red OFF the composer; a
  //    nudge on it would put it straight back, into the one pane the owner ruled out of
  //    merge/audit notification (2026-09-08).
  const auditInboxWriter = server.match(/async function writeAuditInboxEntries\([\s\S]*?\n\}/)?.[0] ?? "";
  const auditProgramJoin = server.match(/async function programsForAuditRow\([\s\S]*?\n\}/)?.[0] ?? "";
  const auditRunBody = server.match(/async function runPostLandAudit\([\s\S]*?\n\}\n/)?.[0] ?? "";
  const helperResultBody = server.match(/async function helperResult\([\s\S]*?\n\}\n/)?.[0] ?? "";
  // the third sink (the sharded audit's one row) walks the same two steps in the same order
  const shardRowBody = server.match(/async function writeShardedAuditRow\([\s\S]*?\n\}\n/)?.[0] ?? "";
  const afterMint = (body: string): boolean => {
    const mint = body.indexOf("await mintAuditEvents(row);");
    const write = body.indexOf("await writeAuditInboxEntries(row);");
    return mint >= 0 && write === mint + "await mintAuditEvents(row);\n  ".length;
  };
  pin(`${RULE_INBOX} — a red audit addresses its Program from EVERY sink, joined on repo+branch+mainAfter, and only a COMPLETE hand-off silences the ping`,
    auditInboxWriter !== "" && auditProgramJoin !== "" && auditRunBody !== "" && helperResultBody !== ""
      && afterMint(auditRunBody) && afterMint(helperResultBody) && afterMint(shardRowBody)
      && auditProgramJoin.includes("o.repo !== row.repo") && auditProgramJoin.includes("o.branch !== cover.branch")
      && auditProgramJoin.includes("o.mainAfter !== cover.mainAfter")
      && auditProgramJoin.includes('o.disposition !== "landed"')
      && auditInboxWriter.includes('if (row.result !== "red") return;')
      && auditInboxWriter.includes('p.status !== "active"')
      && auditInboxWriter.includes("addressed === row.covers.length")
      && !/addressed > 0/.test(auditInboxWriter)
      && auditInboxWriter.includes('appendProgramInbox(p, "audit-red", ref)')
      && auditInboxWriter.includes('e.kind === "audit-red" && e.ref === ref'),
    auditInboxWriter === "" ? "writeAuditInboxEntries not found in the server universe"
      : auditProgramJoin === "" ? "programsForAuditRow not found in the server universe"
        : auditRunBody === "" || helperResultBody === "" ? "runPostLandAudit or helperResult not found in the server universe"
          : `local=${afterMint(auditRunBody)} remote=${afterMint(helperResultBody)} sharded=${afterMint(shardRowBody)} tip=${auditProgramJoin.includes("o.mainAfter !== cover.mainAfter")} complete=${auditInboxWriter.includes("addressed === row.covers.length")}`);
  // …and the state the suppression is EXPRESSED in. `program-inbox` is a fourth status, not a
  // flavour of `delivered` (nothing was typed), so the tick must skip it and the loader must accept
  // it back — a loader that dropped it would turn every restart into a repeat paste.
  const pingLoader = server.match(/\["pending", "delivered", "adjudicated"[^\]]*\]\.includes\(String\(p\.status\)\)/)?.[0] ?? "";
  const pingTick = server.match(/async function tickAuditPing\([\s\S]*?\n\}/)?.[0] ?? "";
  const nudgeGate = server.match(/function nudgeableUnread\([\s\S]*?\n\}/)?.[0] ?? "";
  const nudgeTick = server.match(/async function tickInboxNudge\([\s\S]*?\n\}/)?.[0] ?? "";
  const pingRender = server.match(/function auditPingMessage\([\s\S]*?\n\}/)?.[0] ?? "";
  pin(`${RULE_INBOX} — program-inbox is a persisted fourth ping status the tick skips, and audit-red never arms the pane nudge`,
    pingLoader.includes('"program-inbox"')
      && pingTick !== "" && pingTick.includes('!== "program-inbox"')
      && nudgeGate !== "" && nudgeGate.includes('entry.kind !== "audit-red"')
      && nudgeTick !== "" && (nudgeTick.match(/nudgeableUnread\(program\)/g) ?? []).length === 2
      && !/entries \?\? \[\]\)\s*\n?\s*\.filter\(\(entry\) => entry\.readBy === null\)\.map/.test(nudgeTick),
    pingLoader === "" ? "the auditPings status loader list not found in the server universe"
      : nudgeGate === "" ? "nudgeableUnread not found in the server universe"
        : `loader=${pingLoader.includes('"program-inbox"')} tick=${pingTick.includes('!== "program-inbox"')} nudge=${(nudgeTick.match(/nudgeableUnread\(program\)/g) ?? []).length}`);
  // …and the ONE derivation behind both readers. The ping and the `audit-red` subject must say the
  // same thing about the same row, which is only structurally true while both render from
  // auditSubjectOf — and the ping's twelve labels must stay in the order a reader learned them.
  // Judged over the RETURN ARRAY, which is the rendered order — not over the whole body, where a
  // hoisted `const` would read as out-of-sequence while the pane text is unchanged. The twelfth
  // label lives in that const (RULE_SIGIL needs a statement-terminating literal to read the tail
  // from), so it is pinned as itself: the const carries it and the array's LAST element is it.
  const pingArray = pingRender.slice(pingRender.indexOf("return ["),
    pingRender.indexOf('].join("\n");'));
  const pingLabels = ["[fleet post-land audit] Unbeurteiltes Audit-Ereignis", "Audit-Baum (Land-SHA):",
    "covers:", "result:", "checks.ran", "NICHTS wurde gemessen", "Fehlgeschlagene Checks",
    "Letzte bis zu 15 Zeilen", "--- audit output ---", "--- end audit output ---",
    "Lege das Urteil ab mit POST /api/post-land-audits/adjudicate"];
  let labelCursor = -1;
  let labelsInOrder = pingArray !== "";
  for (const label of pingLabels) {
    const at = pingArray.indexOf(label, labelCursor + 1);
    if (at <= labelCursor) { labelsInOrder = false; break; }
    labelCursor = at;
  }
  const tailNamed = /const closing = "verdict ∈ real\|flake\|stale-test\|unknowable\./.test(pingRender)
    && /\n\s*closing,\n\s*\]\.join\("\\n"\);/.test(pingRender);
  const subjectJoin = server.match(/async function auditRedSubject\([\s\S]*?\n\}/)?.[0] ?? "";
  pin(`${RULE_INBOX} — the ping and the audit-red subject render from ONE derivation, and the ping's twelve labels keep their order`,
    pingRender !== "" && pingRender.includes("auditSubjectOf(row)") && labelsInOrder && tailNamed
      && subjectJoin !== "" && subjectJoin.includes("auditSubjectOf(raw)")
      && subjectJoin.includes("is no longer on the trail (retention)")
      && subjectJoin.includes("not readable as an audit row")
      && subjectJoin.includes("POST /api/post-land-audits/adjudicate"),
    pingRender === "" ? "auditPingMessage not found in the server universe"
      : subjectJoin === "" ? "auditRedSubject not found in the server universe"
        : `derivation=${pingRender.includes("auditSubjectOf(row)")} order=${labelsInOrder} tail=${tailNamed} subject=${subjectJoin.includes("auditSubjectOf(raw)")}`);
  // I9 — the one helper owns both report branches. Only exact lane subscriptions are superseded:
  // merge is a different fact, firedAt remains proof of a real fire, and a missing helper or call
  // fails under its own symbol instead of letting an empty extraction satisfy negative checks.
  const reportDedupe = server.match(/function disarmLaneWatchesForReport\([\s\S]*?\n\}/)?.[0] ?? "";
  const reportDedupeCalls = (reportOpen.match(/disarmLaneWatchesForReport\(/g) ?? []).length;
  pin(`${RULE_INBOX} — the report dedupe disarms lane watches only`,
    reportDedupe !== "" && reportDedupe.includes('watchKind(w) !== "lane"')
      && reportDedupe.includes('audit("watch_superseded"')
      && reportDedupe.includes("w.slotOpenedAt !== holder.openedAt")
      && reportDedupe.includes("pruneSpentWatches(w.slot)")
      && !reportDedupe.includes('watchKind(w) === "merge"') && !reportDedupe.includes("w.firedAt =")
      && reportDedupeCalls === 2
      && reportOpen.includes('programOccupancy(program) === "live" ? program.main! : null')
      && reportOpen.includes("bound?.receiver ?? null"),
    reportDedupe === "" ? "disarmLaneWatchesForReport not found in server.ts"
      : `calls=${reportDedupeCalls} lane=${reportDedupe.includes('watchKind(w) !== "lane"')} merge=${reportDedupe.includes('watchKind(w) === "merge"')} fired=${reportDedupe.includes("w.firedAt =")}`);
  // the doc a MAIN is actually sent to must carry the section and both route paths — the same
  // doc↔route pair RULE_RECEIVER pins for §fleet-report, and for its reason: a route named only in
  // code is a route no session ever learns to call.
{
  // THE LANE-ONLY SCOPE LIST IS A MUST-AGREE PAIR whose other side is markdown. The refusal lives in
  // server.ts as `409 not a lane — …`; the LIST of which routes carry it lives only in a sentence in
  // docs/self-api.md, and CLAUDE.md sends every session to that sentence for the complete scope
  // ("Vollstaendige Scope-Liste: docs/self-api.md"). A route that gains or loses the guard without
  // the sentence following leaves a lane either hunting for a token it already holds, or believing a
  // door is open that answers 409 — the same failure the exit-footer pin exists to prevent.
  //
  // DERIVED, never listed here: the routes are read out of server.ts by walking each `not a lane`
  // refusal back to the route guard above it, so a new lane-only door is covered the day it is
  // written. A sub-route is represented by its parent (`suite-offer/withdraw` by `suite-offer`,
  // `notes/:id/verdict` by `notes`) — the sentence names doors, not every method on one.
  const RULE_LANE_ONLY = "every lane-only self route is named in docs/self-api.md's lane-only scope sentence";
  const selfSrc = read("server.ts");
  const laneOnly = new Set<string>();
  let currentRoute = "";
  for (const line of selfSrc.split("\n")) {
    const literal = /url\.pathname === "\/api\/self\/([^"]+)"/.exec(line);
    if (literal) currentRoute = literal[1]!;
    const pattern = /= \/\^\\\/api\\\/self\\\/(.+?)\$\/\.exec/.exec(line);
    if (pattern) currentRoute = pattern[1]!.replace(/\\\//g, "/").replace(/\([^)]*\)/g, ":id");
    if (currentRoute && /error: "not a lane/.test(line)) laneOnly.add(currentRoute);
  }
  // a sub-route is covered by its parent door
  const doors = [...laneOnly].filter((r) => ![...laneOnly].some((other) => other !== r && r.startsWith(`${other}/`)))
    .sort();
  const scopeSentence = /\*\*Nicht lane-only[\s\S]{0,1400}?\n\n/.exec(read("docs/self-api.md"))?.[0] ?? "";
  const unnamed = doors.filter((d) => !scopeSentence.includes(`\`${d}\``));
  // The derivation must fail as ITSELF: an empty door set would make "every door is named" trivially
  // true, and the four oldest doors are the ones the sentence has always claimed.
  pin(`${RULE_LANE_ONLY} — the derivation finds the known doors and the sentence names every one of them`,
    doors.length >= 6 && ["criterion", "drift", "gate", "verify-intent"].every((d) => doors.includes(d))
      && scopeSentence !== "" && unnamed.length === 0,
    `doors=[${doors.join(",")}] unnamed=[${unnamed.join(",")}] sentence=${scopeSentence.length}B`);
}
  const selfApiInbox = read("docs/self-api.md");
  pin(`${RULE_INBOX} — docs/self-api.md carries §inbox and names both route paths`,
    /^## inbox/m.test(selfApiInbox) && selfApiInbox.includes("GET /api/self/inbox")
      && selfApiInbox.includes("/api/self/inbox/:id/read"),
    `section=${/^## inbox/m.test(selfApiInbox)} get=${selfApiInbox.includes("GET /api/self/inbox")} read=${selfApiInbox.includes("/api/self/inbox/:id/read")}`);

  // ACP-18 · THE ADDRESSED MESSAGE RAIL. Same discipline as the inbox above, pinned for the same
  // reasons — plus the two properties that are this rail's own and that no compiler can see.
  const RULE_MESSAGES = "an addressed message names principals, never slots";
  const msgIface = server.match(/interface Message \{[\s\S]*?\n\}/)?.[0] ?? "";
  const msgAddr = server.match(/type MessageAddress = [^\n]*/)?.[0] ?? "";
  // M1 — THE ADDRESS IS A CLOSED UNION OF PRINCIPALS AND CARRIES NO SLOT. A `slot` on either end is
  // how criterion (1) and (2) die together: a recycled occupant would inherit the mailbox of the
  // one before it, and a successor would lose the thread it is supposed to continue.
  pin(`${RULE_MESSAGES} — MessageAddress is a closed program|role union and no address field is a slot`,
    msgAddr.includes('{ kind: "program"; id: string }') && msgAddr.includes('{ kind: "role"; role: MessageRole }')
      && msgIface !== "" && /\bfrom: MessageAddress;/.test(msgIface) && /\bto: MessageAddress;/.test(msgIface)
      && !/\b(from|to)Slot\b/.test(msgIface),
    msgAddr === "" ? "type MessageAddress not found in the server universe"
      : msgIface === "" ? "interface Message not found in the server universe"
        : `union=${msgAddr.includes('{ kind: "role"; role: MessageRole }')} ends=${/\bfrom: MessageAddress;/.test(msgIface)}`);
  // M2 — THE SENDER IS DERIVED, NEVER READ FROM A BODY. One line of `body.from` would make every
  // other property on this rail unprovable, because any principal could then claim any address.
  const msgSend = server.match(/async function sendMessageFor\([\s\S]*?\n\}\n/)?.[0] ?? "";
  pin(`${RULE_MESSAGES} — sendMessageFor derives the sender from the binding and reads a closed body that cannot name one`,
    msgSend !== "" && msgSend.includes("messageSenderFor(s)")
      && msgSend.includes('["to", "payload", "idempotencyKey", "replyTo"]')
      && !/body\.(from|sender|slot)\b/.test(msgSend),
    msgSend === "" ? "sendMessageFor not found in the server universe"
      : `derived=${msgSend.includes("messageSenderFor(s)")} closed=${msgSend.includes('["to", "payload", "idempotencyKey", "replyTo"]')}`);
  // M3 — ONE PREDICATE FOR THE ROLE. A second copy of the Supervisor rule is how the view and the
  // delivery start disagreeing about who holds the role; both message readers go through the one
  // predicate, and the reader-set pin above additionally names them.
  const msgSender = server.match(/function messageSenderFor\([\s\S]*?\n\}/)?.[0] ?? "";
  const msgAddrs = server.match(/function messageAddressesFor\([\s\S]*?\n\}/)?.[0] ?? "";
  pin(`${RULE_MESSAGES} — both principal derivations resolve the role through isBoundSupervisor and never through a label or a slot number`,
    msgSender !== "" && msgAddrs !== ""
      && msgSender.includes("isBoundSupervisor(s)") && msgAddrs.includes("isBoundSupervisor(s)")
      && !/supervisor\.slot\s*===/.test(msgSender) && !/supervisor\.slot\s*===/.test(msgAddrs)
      && !/SUPERVISOR_LABEL/.test(msgSender) && !/SUPERVISOR_LABEL/.test(msgAddrs),
    msgSender === "" || msgAddrs === "" ? "messageSenderFor or messageAddressesFor not found in the server universe"
      : `sender=${msgSender.includes("isBoundSupervisor(s)")} reader=${msgAddrs.includes("isBoundSupervisor(s)")}`);
  // M4 — THE ONE WRITER, counted like the inbox's: `dropped` is only a true number while a single
  // function maintains it, so a second assignment anywhere in the universe is the violation.
  const msgWriters = (server.match(/\bmessages = \{/g) ?? []).length;
  const msgAppend = server.match(/function appendMessage\([\s\S]*?\n\}/)?.[0] ?? "";
  pin(`${RULE_MESSAGES} — appendMessage is the only writer of the record`,
    msgWriters === 1 && msgAppend !== "" && msgAppend.includes("messages = {")
      && msgAppend.includes("MESSAGES_MAX") && msgAppend.includes('audit("message_append"'),
    msgAppend === "" ? "appendMessage not found in the server universe"
      : `assignments=${msgWriters} capped=${msgAppend.includes("MESSAGES_MAX")}`);
  // M5 — CLOSED AND VERSIONED, in loadProgramInbox's exact discipline: an unknown key is a refusal
  // and never a tolerated extra, and a v2 shape can never be read as a v1 record.
  const msgLoader = server.match(/const loadMessages = \(value: unknown\): MessagesRead => \{[\s\S]*?\n\};/)?.[0] ?? "";
  const msgPayload = server.match(/const loadMessagePayload = [\s\S]*?\n\};/)?.[0] ?? "";
  pin(`${RULE_MESSAGES} — loadMessages is closed and versioned and loadMessagePayload refuses an unknown payload kind`,
    msgLoader !== "" && msgLoader.includes('Object.keys(r).some((k) => !["v", "entries", "dropped"]')
      && msgLoader.includes("r.v !== 1") && msgLoader.includes("MESSAGES_MAX")
      && msgPayload !== "" && msgPayload.includes('r.kind !== "text"'),
    msgLoader === "" ? "loadMessages not found in the server universe"
      : `closed=${msgLoader.includes("r.v !== 1")} payload=${msgPayload.includes('r.kind !== "text"')}`);
  // M6 — THE DOC SEAM, on the inbox seam's terms. The idempotency LIMIT is pinned by name because it
  // is the one promise a reader would otherwise over-read: dedupe lives inside the retention, so a
  // replay after a cap eviction can mint again. A doc that omitted that would be claiming
  // exactly-once, which this rail does not provide.
  pin(`${RULE_MESSAGES} — docs/self-api.md carries §messages, names all three route paths and states the idempotency boundary`,
    /^## messages/m.test(selfApiInbox) && selfApiInbox.includes("GET /api/self/messages")
      && selfApiInbox.includes("POST /api/self/messages")
      && selfApiInbox.includes("/api/self/messages/:id/read")
      && /[Ee]xactly-once/.test(selfApiInbox),
    `section=${/^## messages/m.test(selfApiInbox)} get=${selfApiInbox.includes("GET /api/self/messages")} read=${selfApiInbox.includes("/api/self/messages/:id/read")} limit=${/[Ee]xactly-once/.test(selfApiInbox)}`);
}

// ================================================================================================
// 20. deployGap's path roles, run over THIS tree
// ================================================================================================
// The counter-proof the e2e fixture cannot give: e2e/deploy-facts.ts drives a synthetic repo, so it
// proves the RULE. This proves the rule still answers correctly about the real checkout — which is
// the half that went wrong four times when the roles were a hand-kept list (src/helper.ts and
// src/backoff.ts until 2026-09-01, then task-land-waves.ts, then fleet-e2e-harness.ts, each a land
// whose whole diff was one file reading codeBehind:true for work that never touched the process).
// One representative per rule, not an inventory: a table that listed every file would rot the same
// way the list did, and would fail on every rename instead of on a broken derivation.
{
  const RULE_ROLES = "deployGap's path roles are derived from this tree's own import graph";
  const graph = buildRepoGraph(ROOT);
  const EXPECT: Array<[string, PathRole]> = [
    // server — the entry itself, a top-level module it imports (the near miss the harness
    // neighbours make), a module under server/, and the one src/ file it imports
    ["server.ts", "server"], ["merge-prompt.ts", "server"], ["server/types.ts", "server"],
    ["src/protocol.ts", "server"],
    // …and a module that CHANGED ROLE, which is the case a hand-kept list could never survive:
    // task-land-waves.ts was the client's sensor alone until W3 (2026-09-07) gave the wave door in
    // server.ts the same classifier the board and the CLI read, so one import moved it into the
    // process. The derivation noticed on the very next land; this row followed it, and that is the
    // whole reason the roles stopped being written down by hand.
    ["task-land-waves.ts", "server"],
    // server by deliberate rule, not by graph: no import graph can answer either of these
    ["watchdog.sh", "server"], ["package.json", "server"],
    // non-server — a module the bundle imports and no line of server.ts names (src/backoff.ts, the
    // finding the old list got wrong until 2026-09-01), the bundle entries that list forgot, and
    // the SIXTH runner it never grew to hold
    ["src/client.ts", "non-server"],
    ["src/helper.ts", "non-server"], ["src/backoff.ts", "non-server"],
    ["fleet-e2e-harness.ts", "non-server"], ["fleet-e2e.ts", "non-server"],
    ["e2e/harness.ts", "non-server"], ["public/index.html", "non-server"], ["AGENTS.md", "non-server"],
  ];
  // A probe that could not run must fail as ITSELF: a missing file classifies as `unknown` and a
  // table full of absent paths would read as a broken derivation, which is a different report.
  const absent = EXPECT.map(([p]) => p).filter((p) => !existsSync(`${ROOT}/${p}`));
  if (graph === null) {
    pin(`${RULE_ROLES} — PROBE: the graph was built from the repo root`, false,
      "buildRepoGraph returned null: server.ts unreadable at the root this pin measures");
  } else if (absent.length > 0) {
    pin(`${RULE_ROLES} — PROBE: every path the table names still exists`, false, absent.join(", "));
  } else {
    const wrong = EXPECT.filter(([p, want]) => roleOf(p, graph) !== want)
      .map(([p, want]) => `${p}: ${roleOf(p, graph)} ≠ ${want}`);
    pin(RULE_ROLES, wrong.length === 0, wrong.join("; ") || `${EXPECT.length} paths`);
    // …and it is genuinely THREE-valued over this tree. A classifier that collapsed `unknown` into
    // either neighbour would pass the table above — the table has no unknown row it could ask for,
    // because which files are underivable is exactly what must not be written down by hand.
    const tracked = spawnSync("git", ["-C", ROOT, "ls-files", "-z"],
      { encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" }, maxBuffer: 16 * 1024 * 1024 });
    if (tracked.error || tracked.status !== 0) {
      pin(`${RULE_ROLES} — PROBE: git enumerated the tracked tree`, false,
        (tracked.error?.message || tracked.stderr || `git ls-files exited ${String(tracked.status)}`).trim().slice(0, 160));
    } else {
      const seen = new Set(tracked.stdout.split("\0").filter(Boolean).map((p) => roleOf(p, graph)));
      pin(`${RULE_ROLES} — all three roles occur, so none is a dead branch`,
        seen.has("server") && seen.has("non-server") && seen.has("unknown"),
        [...seen].sort().join(", "));
    }
  }
}

// ================================================================================================
// ctl.sh — the controller's verb layer, and the two files that must agree about it
// ================================================================================================
// The other half of both pairs is a SHELL SCRIPT and a DOC, so no compiler can see either. And the
// failure they guard is the ordinary one: a verb gains a flag, or is renamed, or is added — and
// docs/controller.md §Werkzeuge keeps describing the fleet as it was. A controller reads that
// section instead of the script, so a stale paragraph is a wrong instruction, not a stale comment.
// Both DIRECTIONS, the rule this file states for every set: a verb with no paragraph, and a
// paragraph naming a verb that does not exist.
{
  const RULE_CTL = "ctl.sh's verb list, its usage block and docs/controller.md §Werkzeuge are one set";
  const ctl = read("ctl.sh");
  const controllerDoc = read("docs/controller.md");
  const declared = /^CTL_VERBS="([^"]+)"$/m.exec(ctl)?.[1]?.trim().split(/\s+/).filter(Boolean) ?? [];
  // a dash in a declared verb is the CLI's space: `wait-merge` is typed `./ctl.sh wait merge`
  const cliForm = (v: string): string => v.replace("-", " ");
  const werkzeuge = (() => {
    const at = controllerDoc.indexOf("\n## Werkzeuge\n");
    if (at < 0) return "";
    const rest = controllerDoc.slice(at + 1);
    const end = rest.indexOf("\n## ", 1);
    return end < 0 ? rest : rest.slice(0, end);
  })();
  // A bullet OPENS a verb's paragraph: `- **\`ctl.sh <cli form>` …`. The character after the form
  // must be a space or the closing backtick, so `land` cannot be satisfied by a `lands` entry.
  const namesVerb = (text: string, v: string): boolean => {
    const head = "- **`ctl.sh " + cliForm(v);
    const at = text.indexOf(head);
    return at >= 0 && [" ", "`"].includes(text.charAt(at + head.length));
  };
  pin(`${RULE_CTL} — CTL_VERBS is declared in ctl.sh and every verb has a §Werkzeuge paragraph`,
    declared.length > 0 && werkzeuge !== "" && declared.every((v) => namesVerb(werkzeuge, v)),
    declared.length === 0 ? "no CTL_VERBS= line in ctl.sh"
      : werkzeuge === "" ? "no §Werkzeuge section in docs/controller.md"
        : `undocumented=[${declared.filter((v) => !namesVerb(werkzeuge, v)).join(", ")}]`);
  // …and back. Every `- **\`ctl.sh …` bullet in the section must be one of the declared verbs —
  // otherwise the doc teaches a verb the script does not have, which is the more expensive half.
  const documented = [...werkzeuge.matchAll(/^- \*\*`ctl\.sh ([^`]+)`/gm)].map((m) => m[1]!.trim());
  const orphan = documented.filter((d) => !declared.some((v) => {
    const f = cliForm(v);
    return d === f || d.startsWith(f + " ");
  }));
  pin(`${RULE_CTL} — every §Werkzeuge bullet names a verb ctl.sh actually declares`,
    documented.length > 0 && orphan.length === 0,
    documented.length === 0 ? "no `ctl.sh <verb>` bullets found in §Werkzeuge"
      : `documented=${documented.length} orphan=[${orphan.join(", ")}]`);
  // The usage block is what a session sees when it types the script's name with no argument. A verb
  // missing THERE is invisible in exactly the moment someone is looking for it.
  const usage = ctl.slice(ctl.indexOf("usage() {"), ctl.indexOf("USAGE\n"));
  pin(`${RULE_CTL} — the usage block lists every declared verb`,
    usage !== "" && declared.every((v) => usage.includes("\n  " + cliForm(v))),
    `missing=[${declared.filter((v) => !usage.includes("\n  " + cliForm(v))).join(", ")}]`);
  // TOKEN HYGIENE, as a fastener rather than a habit (CLAUDE.md §Self-scheduling): ensureSlot bakes
  // every pane's self-credential into its zsh line, so a `ps` that prints COMMANDS prints foreign
  // slots' tokens into whatever reads the output. ctl.sh may COUNT processes and must never render
  // one — so `command` may appear in a ps invocation only where it is piped straight into `grep -c`.
  // COMMENTS ARE NOT CODE, and this file's own prose names the forbidden form to explain it — a
  // scan that read them would fail the rule for stating it. Shell `#` and the embedded program's
  // `//` lines are dropped before the scan; nothing else is.
  const ctlCode = ctl.split("\n").filter((l) => !/^\s*(#|\/\/)/.test(l)).join("\n");
  const psUses = [...ctlCode.matchAll(/ps [^"'\n]*command[^"'\n]*/g)].map((m) => m[0]);
  pin(`${RULE_CTL} — ctl.sh counts processes and never renders a command line`,
    psUses.length > 0 && psUses.every((u) => u.includes("grep -c")),
    `ps-command uses=${psUses.length} rendering=[${psUses.filter((u) => !u.includes("grep -c")).join(" | ")}]`);
  // the module that MEASURES the script must be booted by the runner, and beside its family rather
  // than appended: a check module nothing imports is the vacuum-green shape this file exists for.
  const runner = read("fleet-e2e.ts");
  pin(`${RULE_CTL} — e2e/ctl.ts exists and the runner boots it inside the lane block`,
    exists("e2e/ctl.ts") && runner.includes('import * as ctl from "./e2e/ctl"')
      && runner.includes("await ctl.run();"),
    `module=${exists("e2e/ctl.ts")} imported=${runner.includes('import * as ctl from "./e2e/ctl"')} called=${runner.includes("await ctl.run();")}`);
}

// --- THE SHARD TABLE NAMES EVERY MODULE THE RUNNER BOOTS, ONCE (2026-09-14) ---------------------
// A must-agree pair with no compiler between its halves: fleet-e2e.ts imports the check modules and
// tags each step with a UNIT; e2e/ctx.ts#SHARD_UNITS lists which modules form which unit. A module
// imported but listed nowhere would run in NO shard (`--shard k/n` drops what no unit claims) — the
// vacuum-green shape, one shard at a time. A module listed in two units runs in both shards — only
// ever on purpose (self-token, 2026-09-14: `programs` carries its own lane token run), so it is legal
// only where the runner's step for that module names exactly those units (`unit` + `alsoIn`); a
// table-only listing would silently claim a run the runner never makes — and a step tagged with one
// unit while the table lists its module under another is the same lie in the other direction. The runner's own
// startup check covers only the unit NAMES; this pin covers the modules.
{
  const RULE_SHARD = "every check module the runner boots sits in a shard unit, and in several only as its step says";
  // `//` lines are dropped before any scan (Astra finding 5, 2026-09-14): a `// await x.run(check);`
  // is an import that runs nothing, and the step scan below counted it as the module's run.
  const runner = read("fleet-e2e.ts").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  const imports = [...runner.matchAll(/^import \* as (\w+) from "\.\/e2e\/([\w-]+)";$/gm)];
  const booted = imports.map((m) => m[2]!)
    .filter((m) => m !== "trail"); // the trail family runs in every shard by construction
  const moduleOf = new Map(imports.map((m) => [m[1]!, m[2]!]));
  const listed = SHARD_UNITS.flatMap((u) => u.modules);
  const unlisted = booted.filter((m) => !listed.includes(m));
  const phantom = listed.filter((m) => !booted.includes(m));
  // a step is `{ unit: "x"[, alsoIn: [...]]… } },`; its units, per module it awaits
  const stepUnitsOf = new Map<string, string[]>();
  for (const st of runner.matchAll(/\{ unit: "([\w-]+)"(?:, alsoIn: \[([^\]]*)\])?[^]*?\n  \} \},/g)) {
    const units = [st[1]!, ...[...(st[2] ?? "").matchAll(/"([\w-]+)"/g)].map((m) => m[1]!)].sort();
    for (const call of st[0].matchAll(/await (\w+)\.run\(/g)) {
      const mod = moduleOf.get(call[1]!);
      if (mod) stepUnitsOf.set(mod, units);
    }
  }
  const multi = [...new Set(listed.filter((m, i) => listed.indexOf(m) !== i))];
  const unitsListing = (m: string) => SHARD_UNITS.filter((u) => u.modules.includes(m)).map((u) => u.unit).sort();
  const twice = [...new Set(listed)].filter((m) => JSON.stringify(unitsListing(m)) !== JSON.stringify(stepUnitsOf.get(m) ?? []));
  pin(`${RULE_SHARD} — booted modules ⊆ listed, none phantom, every module's table units = its runner step's units`,
    booted.length > 30 && stepUnitsOf.size === booted.length && unlisted.length === 0 && twice.length === 0 && phantom.length === 0,
    `booted=${booted.length} stepMapped=${stepUnitsOf.size} listed=${listed.length} multi=[${multi}] unlisted=[${unlisted}] mismatched=[${twice.map((m) => `${m}:${unitsListing(m)}≠${stepUnitsOf.get(m) ?? []}`)}] phantom=[${phantom}]`);
  // the trail family is exempt from the table, not from running: outside every step, so the step
  // scan above never sees it — its own top-level call is what says it still runs
  pin(`${RULE_SHARD} — the trail family, outside every step, is still awaited by the runner`,
    moduleOf.get("trail") === "trail" && /^await trail\.run\(/m.test(runner),
    `imported=${moduleOf.get("trail") === "trail"} awaited=${/^await trail\.run\(/m.test(runner)}`);
  // the runner's own startup check on the step NAMES fires only when the runner boots — behind a
  // server start and the suite mutex (2026-09-13: 26 min of queue for a unit renamed in the table
  // and not in the runner). The same fact, here, costs milliseconds and no server.
  const stepUnits = [...runner.matchAll(/\{ unit: "([\w-]+)"(?:, alsoIn: \[([^\]]*)\])?/g)]
    .flatMap((m) => [m[1]!, ...[...(m[2] ?? "").matchAll(/"([\w-]+)"/g)].map((x) => x[1]!)]);
  const unknownSteps = stepUnits.filter((u) => !SHARD_UNITS.some((x) => x.unit === u));
  pin(`${RULE_SHARD} — every step's unit name in the runner is a unit the table knows`,
    stepUnits.length > 20 && unknownSteps.length === 0, `steps=${stepUnits.length} unknown=[${unknownSteps}]`);
  // the seconds are a measurement, and the balance the plan computes is only as honest as they are:
  // a unit with no weight silently rides along wherever the tie-break puts it
  pin(`${RULE_SHARD} — every unit carries a non-negative measured weight and a non-empty module list`,
    SHARD_UNITS.every((u) => Number.isFinite(u.seconds) && u.seconds >= 0 && u.modules.length > 0));
}

// --- THE CARD STAMPS THE MODEL THAT RAN (S3, 2026-09-12) -----------------------------------------
// A must-agree pair whose other side is not a type: `WorkerRunObservation` is what runWorker knows
// about the run it just made, and nothing forces a caller to read it. The brief compiler does not —
// it writes `model: SUMMARY_MODEL` at the assignment, so every stored brief names the summary tier
// whatever route actually answered. That is a false provenance on a live field today, and this pin
// is what keeps the card from repeating it: the card's model must come from the OBSERVATION.
//
// Stated as a rule about the two writers rather than as a snapshot of either line: the card reads
// the observation, the brief reads the constant, and the day the brief is fixed this pin narrows to
// its first half rather than failing.
{
  const RULE_CARD = "a stored model name is the model that RAN";
  const srv = read("server.ts");
  const cardAssign = /return \{ \.\.\.checked\.body, model: observed\.model,/.test(srv);
  const cardFallback = /model: observed\.model, at: Date\.now\(\), ms, valid: false,/.test(srv);
  pin(`${RULE_CARD} — extractCard stamps observed.model on BOTH its answer paths, never a constant`,
    cardAssign && cardFallback, `validated=${cardAssign} unreadable=${cardFallback}`);
  // the contrast, and it is the reason the rule exists. If this ever stops matching, the brief
  // compiler was fixed — delete this half, do not widen it.
  const briefAssign = /t\.brief = \{ text, at: Date\.now\(\), model: SUMMARY_MODEL, edited: false \}/.test(srv);
  pin(`${RULE_CARD} — the brief compiler still stamps the CONSTANT, which is why the card may not`,
    briefAssign, `briefStampsConstant=${briefAssign}`);
  // DEFAULT OFF means no timer, not a guarded one — the property that makes a suite unable to spawn
  // a real extractor by forgetting a stand-in. Both halves: the arming condition and the const.
  const cardOff = /const CARD_ON = CARD_TICK_MS > 0;/.test(srv)
    && /if \(CARD_ON\) setInterval\(\(\) => void tickCardSweep\(\)/.test(srv);
  pin(`${RULE_CARD} — an unset FLEET_CARD_MS registers NO tick, rather than a tick that returns early`,
    cardOff, `armedOnly=${cardOff}`);
  // the extractor is TEXT_ONLY by contract, not by configuration: it makes claims about a text it
  // was given, and a repository in its hands would only make an unverifiable claim more convincing.
  const textOnly = /worker: "card", cmd: CARD_CMD, tools: TEXT_ONLY_TOOLS,/.test(srv);
  pin(`${RULE_CARD} — the card worker runs TEXT_ONLY, with no repository to read`,
    textOnly, `textOnly=${textOnly}`);

  // 2026-09-13 · the three defects between card and bundling. Each half is a mechanism the e2e
  // family proves on behaviour; these pin that the mechanism is the one the docs name.
  const RULE_CARD_V2 = "a card is refused by the tree, not by a stale graph or a foreign field";
  const cx = read("card-extract.ts");
  // v5 (2026-09-14): rolle normalised and advisory; the prompt asks for creates and after.
  const versionConst = /^export const CARD_VALIDATOR_VERSION = 5;$/m.test(cx);
  pin(`${RULE_CARD_V2} — CARD_VALIDATOR_VERSION is 5 (bump it when a rule change can turn a refusal into an acceptance)`,
    versionConst, `const=${versionConst}`);
  // v3 (2026-09-13): the filing format. A formatted row is read by the PARSER before the extractor
  // is ever started, and the ledger says which of the two produced each card.
  const formatFirst = /const formatted = formatCardOf\(t, snapshot, index\);\n\s+const run: \{ answer\?: string \} = \{\};\n\s+const card = formatted \?\? await extractCard\(t, repo, snapshot, index, \(answer\) => \{ run\.answer = answer; \}\);/.test(srv)
    && /taskId: t\.id, source: formatted \? "format" : "model",/.test(srv);
  pin(`${RULE_CARD_V2} — the card tick asks parseFormattedCard before the extractor, and cards.jsonl carries source format|model`,
    formatFirst, `formatFirst=${formatFirst}`);
  const createsRule = /if \(ctx\.trackedPaths\.has\(path\)\) \{ gaps\.push\(`surface\.creates: /.test(cx)
    && /rowKnown: \(id\) => tasks\.some\(\(t\) => t\.id === id\),/.test(srv);
  pin(`${RULE_CARD_V2} — NEU is refused when tracked (never waved through surface.files), NACH is checked against the queue`,
    createsRule, `createsRule=${createsRule}`);
  const declFallback = /if \(!ctx\.declares\(file, symbol\)\) \{/.test(cx)
    && /declares: \(file, symbol\) => !!snapshot\?\.paths\.has\(file\) && declaresSymbol\(sourceOf\(file\), symbol\),/.test(srv);
  pin(`${RULE_CARD_V2} — a symbol the graph lacks is looked up as a declaration in the tracked file, through the ONE shared context`,
    declFallback, `declFallback=${declFallback}`);
  const reread = /if \(!t\.card\.valid && \(t\.card\.validatorVersion \?\? 1\) < CARD_VALIDATOR_VERSION\) return true;/.test(srv);
  pin(`${RULE_CARD_V2} — cardDue re-reads only an INVALID card from an older validator`,
    reread, `reread=${reread}`);
  const surfaceConfirm = /: !card\.surfaceValid \? /.test(srv) && !/!card\?\.valid \|\| !card\.surface\.files\.length/.test(srv);
  const surfaceDerived = /valid: cardValid\(gaps\), surfaceValid: cardSurfaceValid\(gaps\), gaps,/.test(srv)
    && /export const cardValid = \(gaps: readonly string\[\]\): boolean => gaps\.every\(cardAdvisoryGap\);/.test(cx);
  pin(`${RULE_CARD_V2} — confirm-cards reads surfaceValid (not valid), and the loader derives both from gaps through the one advisory rule`,
    surfaceConfirm && surfaceDerived, `confirm=${surfaceConfirm} derived=${surfaceDerived}`);
}

// 2026-09-13 · A LANE NEVER WAITS ON A DIALOG NOBODY ANSWERS. The two sides that no compiler joins:
// .claude/settings.json (JSON, read by Claude Code) and the hook file it names; and the hook's
// stdin/stdout/exit contract, which only a spawned run shows. The door's own promises (one event,
// dedupe, escalation) are behaviour and live in e2e/self-token.ts.
{
  const RULE_HOOK = "a lane's permission dialog is denied by the tracked hook .claude/settings.json names";
  const HOOK_REL = ".claude/hooks/lane-permission.ts";
  type HookCmd = { type?: string; command?: string; async?: boolean; timeout?: number };
  type HookGroup = { matcher?: string; hooks?: HookCmd[] };
  let settings: { hooks?: Record<string, HookGroup[]> } | null = null;
  try { settings = JSON.parse(read(".claude/settings.json")); } catch { settings = null; }
  pin(`${RULE_HOOK} — .claude/settings.json exists and parses`, settings !== null);
  const groups = (event: string): HookGroup[] => settings?.hooks?.[event] ?? [];
  const cmds = (event: string): HookCmd[] => groups(event).flatMap((g) => g.hooks ?? []);
  const hookCmd = (mode: string) => `bun "$CLAUDE_PROJECT_DIR/${HOOK_REL}" ${mode}`;
  const decideCmds = cmds("PermissionRequest").filter((c) => c.command === hookCmd("decide"));
  const reportCmds = cmds("PermissionRequest").filter((c) => c.command === hookCmd("report"));
  pin(`${RULE_HOOK} — PermissionRequest runs \`decide\` SYNCHRONOUSLY (async would make the deny arrive after the dialog)`,
    decideCmds.length === 1 && decideCmds[0]!.async !== true && groups("PermissionRequest").some((g) => (g.matcher ?? "") === ""),
    `decide=${decideCmds.length} async=${decideCmds[0]?.async}`);
  const notifyGroup = groups("Notification").find((g) => (g.hooks ?? []).some((c) => c.command === hookCmd("report")));
  const notifyMatch = (notifyGroup?.matcher ?? "").split("|").sort();
  pin(`${RULE_HOOK} — \`report\` is ASYNC on PermissionRequest and on exactly the hook's WAITING_NOTIFICATIONS`,
    reportCmds.length === 1 && reportCmds[0]!.async === true
      && (notifyGroup?.hooks ?? []).every((c) => c.async === true)
      && JSON.stringify(notifyMatch) === JSON.stringify([...WAITING_NOTIFICATIONS].sort()),
    `report=${reportCmds.length} matcher=[${notifyMatch.join("|")}]`);
  // both directions: every file the settings name exists, and every hook file is named
  const named = [...read(".claude/settings.json").matchAll(/\$CLAUDE_PROJECT_DIR\/([^"\\ ]+)/g)].map((m) => m[1]!);
  const hookFiles = exists(".claude/hooks") ? readdirSync(`${ROOT}/.claude/hooks`).map((f) => `.claude/hooks/${f}`) : [];
  pin(`${RULE_HOOK} — every path the settings name exists, and every file in .claude/hooks/ is named`,
    named.length > 0 && named.every(exists) && hookFiles.length > 0 && hookFiles.every((f) => named.includes(f)),
    `named=[${[...new Set(named)].join(",")}] files=[${hookFiles.join(",")}]`);
  // TRACKED, or no lane ever sees it: createWorktree copies only settings.local.json. Read off
  // .gitignore rather than `git check-ignore`, because the post-land audit runs from a git archive.
  const ignored = read(".gitignore").split("\n").some((l) => l.trim() === ".claude/settings.json");
  pin(`${RULE_HOOK} — .claude/settings.json is not gitignored (an ignored copy never reaches a lane)`, !ignored);
  // MERGED, never replaced: the graphify search guard the file carried before it was tracked, with no
  // account-name path (the reason it was ignored) and a silent exit where graphify is not installed.
  // The read guard is GONE on purpose (owner 2026-09-13, worktrail IV §3.5: 74 % of reads followed a
  // query anyway) — a re-added one is caught here, not rediscovered in the nudge count.
  const graphify = (matcher: string, mode: string) => groups("PreToolUse").some((g) => g.matcher === matcher
    && (g.hooks ?? []).some((c) => c.command === `[ -x "$HOME/.local/bin/graphify" ] || exit 0; exec "$HOME/.local/bin/graphify" hook-guard ${mode}`));
  const readGuard = cmds("PreToolUse").some((c) => (c.command ?? "").includes("hook-guard read"));
  pin(`${RULE_HOOK} — the graphify search guard survives beside it (no read guard), through $HOME and with no /Users/ path`,
    graphify("Bash|Grep", "search") && !readGuard && !read(".claude/settings.json").includes("/Users/"),
    `search=${graphify("Bash|Grep", "search")} read=${readGuard}`);
  // the two pane facts the hook reads are the two ensureSlot bakes, and the route it posts to is served
  const srvHook = read("server.ts");
  const bakesLane = srvHook.includes("export FLEET_SELF_URL='http://${HOST}:${PORT}'; ${s.worktree ? \"export FLEET_SELF_LANE='1'; \" : \"\"}");
  const hookSrc = read(HOOK_REL);
  pin(`${RULE_HOOK} — ensureSlot bakes FLEET_SELF_LANE from s.worktree and FLEET_SELF_URL, the hook reads exactly those, and the server serves its route`,
    bakesLane && hookSrc.includes('env.FLEET_SELF_LANE === "1"') && hookSrc.includes("env.FLEET_SELF_URL")
      && srvHook.includes(`url.pathname === "${HARNESS_BLOCK_ROUTE}" && req.method === "POST"`),
    `bakes=${bakesLane} route=${HARNESS_BLOCK_ROUTE}`);

  // THE CONTRACT, SPAWNED. Every case exits 0 — exit 2 would block the session — and only a lane's
  // PermissionRequest produces output.
  const LANE = { FLEET_SELF_LANE: "1", FLEET_SELF_TOKEN: "f".repeat(32) };
  const rmReq = JSON.stringify({ hook_event_name: "PermissionRequest", tool_name: "Bash",
    tool_input: { command: "for v in a b; do rm -rf $SP/$v; done" } });
  const run = (mode: string, stdin: string, env: Record<string, string>) => {
    const base = Object.fromEntries(Object.entries(process.env)
      .filter(([k]) => !k.startsWith("FLEET_SELF_"))) as Record<string, string>;
    const r = spawnSync("bun", [`${ROOT}/${HOOK_REL}`, mode], { input: stdin, env: { ...base, ...env }, encoding: "utf8", timeout: 10_000 });
    return { code: r.status, out: (r.stdout ?? "").trim() };
  };
  const lane = run("decide", rmReq, LANE);
  let laneDecision: { behavior?: string; message?: string } = {};
  try { laneDecision = JSON.parse(lane.out).hookSpecificOutput?.decision ?? {}; } catch { laneDecision = {}; }
  pin(`${RULE_HOOK} — spawned: a LANE's PermissionRequest is denied with the request verbatim and the \${VAR:?} rewrite`,
    lane.code === 0 && laneDecision.behavior === "deny"
      && (laneDecision.message ?? "").includes("for v in a b; do rm -rf $SP/$v; done")
      && (laneDecision.message ?? "").includes('"${SP:?}/${v:?}"')
      && !(laneDecision.message ?? "").includes("f".repeat(32)),
    `exit=${lane.code} behavior=${laneDecision.behavior}`);
  const cases: [string, string, Record<string, string>][] = [
    ["a PLAIN session (token, no FLEET_SELF_LANE) gets no output — Claude Code asks as usual", rmReq, { FLEET_SELF_TOKEN: "f".repeat(32) }],
    ["FLEET_SELF_LANE=0 is not a lane", rmReq, { ...LANE, FLEET_SELF_LANE: "0" }],
    ["a lane flag without a token is not a lane", rmReq, { FLEET_SELF_LANE: "1" }],
    ["BROKEN JSON in a lane passes instead of crashing into a deny", "{\"hook_event_name\": \"PermissionRe", LANE],
    ["EMPTY stdin in a lane passes", "", LANE],
    ["a JSON ARRAY in a lane passes", "[1,2]", LANE],
  ];
  const silent = cases.map(([why, stdin, env]) => ({ why, ...run("decide", stdin, env) }));
  pin(`${RULE_HOOK} — spawned: non-lanes and malformed input exit 0 with NO output (= ask)`,
    silent.every((c) => c.code === 0 && c.out === ""),
    silent.filter((c) => c.code !== 0 || c.out !== "").map((c) => `${c.why}: exit=${c.code} out=${c.out.slice(0, 40)}`).join("; ") || `${silent.length} cases`);
  // report with nowhere to send is still exit 0 and silent — the deny never depended on it
  const orphanReport = run("report", rmReq, LANE);
  pin(`${RULE_HOOK} — spawned: \`report\` without FLEET_SELF_URL exits 0 and prints nothing`,
    orphanReport.code === 0 && orphanReport.out === "", `exit=${orphanReport.code}`);
  // the pure decision: which notifications count as waiting, and that report never denies
  const note = (type: string) => hookDecide(JSON.stringify({ hook_event_name: "Notification", notification_type: type, message: "m" }), LANE).kind;
  pin(`${RULE_HOOK} — decide: permission_prompt is reported as waiting, idle_prompt is not, and neither is denied`,
    note("permission_prompt") === "report" && note("idle_prompt") === "pass"
      && hookDecide(rmReq, { FLEET_SELF_TOKEN: "x" }).kind === "pass",
    `permission_prompt=${note("permission_prompt")} idle_prompt=${note("idle_prompt")}`);
}

// ================================================================================================
// the suite's shortened waits are TEST settings — the production defaults under them do not move
// ================================================================================================
// e2e-isolated.sh runs its server with shorter timers than production so a full suite spends its
// time measuring instead of waiting (2026-09-13: 69 % of a 2 618 s run were gaps of 3 s or more).
// Every such timer is an env knob whose UNSET value is the production literal. The cut is only
// honest while that stays true: a knob whose default drifted would re-time the live fleet, and
// the suite — which sets the knob — could never notice. So the defaults are pinned here, where no
// suite env reaches, next to the one pair where the TEST side mirrors the server's parse.
{
  const RULE_DEFAULTS = "a timer the isolated suite shortens keeps its production default when unset";
  const defaults: [string, RegExp][] = [
    ["tickGit cadence 10 s", /const GIT_TICK_MS = Math\.max\(1000, Number\(process\.env\.FLEET_GIT_TICK_MS \?\? 10_000\) \| 0\);/],
    ["tickGit is scheduled on that cadence", /setInterval\(\(\) => void tickGit\(\)\.catch\(\(e: unknown\) => logError\("tickGit", e\)\), GIT_TICK_MS\);/],
    ["merge/commit idle gate 3 s", /const MERGE_IDLE_MS = Math\.max\(500, Number\(process\.env\.FLEET_MERGE_IDLE_MS \?\? 3000\) \| 0\);/],
    ["autos tick 5 s", /Number\(process\.env\.FLEET_AUTOS_TICK_MS \?\? 5000\)/],
    ["dispatch tick 8 s", /Number\(process\.env\.FLEET_DISPATCH_TICK_MS \?\? 8000\)/],
    ["verify work budget 120 s", /Number\(process\.env\.FLEET_VERIFY_TIMEOUT_MS \?\? 120_000\)/],
    ["verify queue budget 900 s", /Number\(process\.env\.FLEET_VERIFY_WAIT_MS \?\? 900_000\)/],
    ["ready-marker wait 20 s", /Number\(process\.env\.FLEET_READY_WAIT_MS \?\? 20_000\)/],
    ["acceptance window 3 s", /Number\(process\.env\.FLEET_ACCEPT_WAIT_MS \?\? 3000\)/],
    ["device-online window 90 s", /Number\(process\.env\.FLEET_DEVICE_ONLINE_MS \?\? 90_000\)/],
    ["server suite-lock poll 5 s", /^const SUITE_LOCK_POLL_MS = 5_000;$/m],
    ["founding boot grace 4 s", /^const FOUNDING_BOOT_GRACE_MS = 4000;$/m],
  ];
  const moved = defaults.filter(([, re]) => !re.test(server)).map(([name]) => name);
  pin(`${RULE_DEFAULTS} — server.ts`, moved.length === 0,
    moved.length ? `default changed or knob reshaped: ${moved.join("; ")}` : `${defaults.length} defaults`);
  const stageSh = read("e2e-stage.sh");
  pin(`${RULE_DEFAULTS} — e2e-stage.sh's suite-mutex poll is 15 s`,
    /^FLEET_SUITE_POLL_SEC="\$\{FLEET_SUITE_POLL_SEC:-15\}"$/m.test(stageSh), "default poll cadence changed");
  // the harness waits on the SAME number the server gates on: identical parse, identical default
  const helpers = read("e2e/lane-helpers.ts");
  pin(`${RULE_DEFAULTS} — e2e/lane-helpers.ts parses FLEET_MERGE_IDLE_MS exactly as server.ts does`,
    /export const MERGE_IDLE_MS = Math\.max\(500, Number\(process\.env\.FLEET_MERGE_IDLE_MS \?\? 3000\) \| 0\);/.test(helpers),
    "the harness idle wait and the server idle gate can disagree");
}

// ================================================================================================
// HANDOFF.md rotation — the archive gets every byte the handoff loses, and nothing else
// ================================================================================================
// handoff-rotate.ts slices HANDOFF.md as bytes: the top `#` section stays, the rest is appended to
// docs/attic/handoff-archiv-<date>.md. Its whole value is that nothing is lost or rewritten, so the
// rule is held on a FIXTURE through the file run, not on the live HANDOFF.md (a lane never touches
// it). The fixture carries the three ways a heading scan goes wrong: `#` inside a ``` fence, `#`
// inside a ~~~~ fence that a ``` line does not close, and `#hashtag` with no space — plus a
// preamble, umlauts (bytes != chars), a CRLF heading and a last line with no newline.
{
  const RULE_ROTATE = "handoff-rotate.ts keeps the top # section and appends the rest byte-exact to the archive";
  const fixture = Buffer.from([
    "vorspann\n",
    "# HANDOFF — neueste Übergabe\n", "## 0. unterabschnitt\n", "```sh\n# kein abschnitt (fence)\n```\n", "text\n\n",
    "# HANDOFF — ältere ü\n", "~~~~\n# noch fence\n```\n# noch fence, ``` schliesst ~~~~ nicht\n~~~~\n", "#hashtag ohne leerzeichen\n",
    "# HANDOFF — älteste\r\n", "letzte zeile ohne newline",
  ].join(""), "utf8");
  const split = splitHandoff(fixture);
  const headings = split.archived.map((s) => s.heading);
  pin(`${RULE_ROTATE} — the split sees exactly the unfenced h1 headings`,
    split.kept?.heading === "# HANDOFF — neueste Übergabe"
      && JSON.stringify(headings) === JSON.stringify(["# HANDOFF — ältere ü", "# HANDOFF — älteste"])
      && fixture.subarray(split.keepEnd).toString("utf8").startsWith("# HANDOFF — ältere ü\n"),
    `kept=${JSON.stringify(split.kept?.heading)} archived=${JSON.stringify(headings)}`);

  const dir = mkdtempSync(`${tmpdir()}/fleet-pins-handoff-`);
  try {
    const handoff = `${dir}/HANDOFF.md`;
    const archive = `${dir}/docs/attic/handoff-archiv-2026-01-02.md`;
    const run = (...extra: string[]) => spawnSync("bun", [`${ROOT}/handoff-rotate.ts`, "--root", dir, "--date", "2026-01-02", ...extra],
      { encoding: "utf8", timeout: 10_000 });
    writeFileSync(handoff, fixture);

    const dry = run("--dry-run");
    pin(`${RULE_ROTATE} — --dry-run names every section it would archive and touches nothing`,
      dry.status === 0 && headings.every((h) => dry.stdout.includes(h)) && !existsSync(archive)
        && readFileSync(handoff).equals(fixture),
      `exit ${String(dry.status)} ${(dry.stderr || "").trim().slice(0, 120)}`);

    // a pre-existing archive is APPENDED to, never replaced
    rmSync(`${dir}/docs`, { recursive: true, force: true });
    mkdirSync(`${dir}/docs/attic`, { recursive: true });
    const prior = Buffer.from("# frueheres archiv\n", "utf8");
    writeFileSync(archive, prior);
    const real = run();
    const kept = readFileSync(handoff);
    const archived = readFileSync(archive);
    pin(`${RULE_ROTATE} — bytes before = kept + appended, in order, on top of the prior archive`,
      real.status === 0 && kept.equals(fixture.subarray(0, split.keepEnd))
        && archived.equals(Buffer.concat([prior, fixture.subarray(split.keepEnd)]))
        && kept.length + archived.length - prior.length === fixture.length,
      `exit ${String(real.status)}; ${fixture.length} B before, ${kept.length} B kept, ${archived.length - prior.length} B appended`);

    const again = run();
    pin(`${RULE_ROTATE} — a handoff with one section is left alone`,
      again.status === 0 && again.stdout.includes("nothing to rotate") && readFileSync(handoff).equals(kept)
        && readFileSync(archive).equals(archived),
      `exit ${String(again.status)}`);

    // the archive now ends without a newline (the fixture's last line): appending would glue the next
    // heading onto it, so the run must refuse and leave HANDOFF.md whole
    writeFileSync(handoff, fixture);
    const refused = run();
    pin(`${RULE_ROTATE} — it refuses to append behind an archive whose last line has no newline`,
      refused.status === 2 && readFileSync(handoff).equals(fixture) && readFileSync(archive).equals(archived),
      `exit ${String(refused.status)} ${(refused.stderr || "").trim().slice(0, 120)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  pin("state.sh warns about HANDOFF.md above handoff-rotate.ts#HANDOFF_WARN_KB",
    read("state.sh").includes(`-gt $((${HANDOFF_WARN_KB} * 1024))`), `threshold ${HANDOFF_WARN_KB} KB`);
}

// state.sh "machine hygiene" is a SENSOR. Counting names listed the live `claudefleet` as a leak —
// an invitation to exactly the kill the rulebook forbids (docs/messungen/2026-09-14-ram-optimierung-astra.md
// §F6). Held twice: textually (no destructive verb, tmux only reads the probed socket) and by running
// the block over a fake TMUX_TMPDIR whose two dead sockets are `claudefleet` and `fleettest1`.
{
  const RULE_HYGIENE = "state.sh machine hygiene skips the production socket claudefleet and never kills or deletes";
  const state = read("state.sh");
  const from = state.indexOf('echo "=== machine hygiene');
  const block = from < 0 ? "" : state.slice(from, state.indexOf('echo "=== config sensor', from));
  const code = block.split("\n").filter((l) => !l.trimStart().startsWith("#")).join("\n");
  const destructive = code.match(/\b(rm|rmdir|unlink|kill|pkill|killall)\b/g) ?? [];
  const tmuxCalls = code.match(/\btmux -[^\n]*/g) ?? [];
  const foreignTmux = tmuxCalls.filter((c) => !/^tmux -S "\$hy_sock" (list-sessions|display-message) /.test(c));
  pin(`${RULE_HYGIENE} — no destructive verb, tmux only lists/displays the probed socket`,
    code.length > 0 && destructive.length === 0 && tmuxCalls.length > 0 && foreignTmux.length === 0,
    `${block.length} B block; destructive=${JSON.stringify(destructive)} foreign tmux=${JSON.stringify(foreignTmux)}`);

  const dir = mkdtempSync(`${tmpdir()}/fleet-pins-hy-`);
  try {
    const sockdir = `${dir}/tmux-${process.getuid?.() ?? 0}`;
    mkdirSync(sockdir, { mode: 0o700 });
    // bound, never listening: the file stays and a connect is refused — what a SIGKILLed server leaves
    for (const name of ["claudefleet", "fleettest1"]) {
      spawnSync("python3", ["-c", "import socket,sys; socket.socket(socket.AF_UNIX).bind(sys.argv[1])", `${sockdir}/${name}`]);
    }
    const run = spawnSync("sh", ["-c", code], {
      encoding: "utf8", timeout: 15_000,
      env: { ...process.env, TMUX_TMPDIR: dir, TMPDIR: dir, MAIN_CHECKOUT: dir },
    });
    const out = run.stdout ?? "";
    pin(`${RULE_HYGIENE} — over dead claudefleet + fleettest1 it counts one dead test socket and names production once`,
      run.status === 0 && out.includes("e2e tmux sockets: 0 live · 1 dead · 0 unknown")
        && /no process RAM: fleettest1$/m.test(out) && out.split("claudefleet").length === 2,
      `exit ${String(run.status)}; ${out.split("\n").filter((l) => /sockets|claudefleet|dead|unknown/.test(l)).join(" | ").slice(0, 300)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ================================================================================================
// Land-Chronik — one line per land off the notes, and a land with no audit row yet is RUNNING
// ================================================================================================
// land-log.ts is a view, so the only thing to hold is what it says. The formatter is pure and runs on
// a FIXTURE: two days of main, four lands (a three-commit land, a failed gate with no audit row, a
// no-gate land judged by a covers-less audit row, a note whose mainAfter left main), direct commits
// on both days and one commit before the window. The label that must never drift is the missing
// audit row: it is "laeuft" (queued or running), never a claim that the audit was lost or passed.
{
  const RULE_LANDLOG = "land-log.ts prints one line per land and one direct-commit line per day";
  const t = (day: number, h: number, mi = 0) => Date.UTC(2026, 8, day, h, mi);
  const long = "feat(a): first of three — a subject long enough to be cut at the sixty-character column";
  const commits: MainCommit[] = [
    { sha: "c9".repeat(20), at: t(2, 10), subject: "docs(handoff): Slot 1" },
    { sha: "c8".repeat(20), at: t(2, 9, 30), subject: "chore: no gate" },
    { sha: "c7".repeat(20), at: t(2, 9), subject: "fix: direct on main" },
    { sha: "c6".repeat(20), at: t(1, 12), subject: "feat(a): third" },
    { sha: "c5".repeat(20), at: t(1, 11, 50), subject: "feat(a): second" },
    { sha: "c4".repeat(20), at: t(1, 11, 40), subject: long },
    { sha: "c3".repeat(20), at: t(1, 8), subject: "fix(b): gate said no" },
    { sha: "c2".repeat(20), at: t(1, 7), subject: "docs(handoff): Slot 0" },
    { sha: "c1".repeat(20), at: t(1, 6), subject: "docs(handoff): before the window" },
  ];
  const sha = (n: number) => `c${n}`.repeat(20);
  const notes = [
    { branch: "fleet/L3", mainBefore: sha(7), mainAfter: sha(8), at: t(2, 9, 30), verify: null },
    { branch: "fleet/L2", mainBefore: sha(3), mainAfter: sha(6), at: t(1, 12), verify: { ok: true, proportional: true, exitCode: 0 } },
    { branch: "fleet/L0", mainBefore: "dead".repeat(10), mainAfter: "beef".repeat(10), at: t(1, 11), verify: { ok: true, proportional: false } },
    { branch: "fleet/L1", mainBefore: sha(2), mainAfter: sha(3), at: t(1, 8), verify: { ok: false, exitCode: 1 } },
    { branch: "fleet/old", mainBefore: sha(0), mainAfter: sha(1), at: t(1, 6), verify: { ok: true } },
  ];
  const audits = [
    { at: 100, result: "red", mainSha: sha(9), covers: [{ branch: "fleet/L2", mainAfter: sha(6) }] },
    { at: 200, result: "green", mainSha: sha(9), covers: [{ branch: "fleet/L2", mainAfter: sha(6) }, { branch: "fleet/old", mainAfter: sha(1) }] },
    { at: 300, result: "unknown", mainSha: sha(8), covers: [] },
  ];
  const lines = renderLandLog({ notes, audits, commits, sinceMs: t(1, 7) });
  const land = (b: string) => lines.find((l) => l.includes(` ${b} `)) ?? "";
  const expectL2 = `2026-09-01 12:00  c6c6c6c6  ${"fleet/L2".padEnd(23)}    3 Commits  ${long.slice(0, 59)}…  verify proportional  audit gruen`;
  pin(`${RULE_LANDLOG} — the column layout, on a three-commit land whose first subject is cut`,
    land("fleet/L2") === expectL2, `got: ${land("fleet/L2")}`);
  pin(`${RULE_LANDLOG} — newest day first, lands newest first, the day's direct-commit line after its lands`,
    lines.length === 6 && ["fleet/L3", "(direkt)", "fleet/L2", "fleet/L0", "fleet/L1", "(direkt)"].every((k, i) => lines[i]?.includes(` ${k} `)),
    lines.map((l) => l.slice(0, 44)).join(" | "));
  pin(`${RULE_LANDLOG} — a land with no audit row is "laeuft", never lost; a covers-less row joins over mainSha`,
    land("fleet/L1").endsWith("verify failed        audit laeuft") && !lines.some((l) => /verloren|lost/i.test(l))
      && land("fleet/L3").endsWith("verify skipped       audit unknown") && land("fleet/L3").includes("  1 Commit   chore: no gate"),
    `L1: ${land("fleet/L1").slice(-34)} · L3: ${land("fleet/L3").slice(-34)}`);
  pin(`${RULE_LANDLOG} — a land whose mainAfter is not on main claims no count and no subject`,
    land("fleet/L0").includes("  ? Commits  ? (mainAfter nicht auf main)"), land("fleet/L0"));
  pin(`${RULE_LANDLOG} — direct commits are counted per day, HANDOFF among them, the window cut respected`,
    lines[1]?.endsWith("  2 Direkt-Commits, davon 1 HANDOFF") === true && lines[5]?.endsWith("  1 Direkt-Commit, davon 1 HANDOFF") === true,
    `${lines[1]} | ${lines[5]}`);
  const noLedger = renderLandLog({ notes, audits: null, commits, sinceMs: t(1, 7) }).filter((l) => !l.includes("(direkt)"));
  pin(`${RULE_LANDLOG} — with no audit ledger every land says "audit ?", not a verdict`,
    noLedger.length === 4 && noLedger.every((l) => l.endsWith("audit ?")), noLedger.map((l) => l.slice(-10)).join(" | "));
  const labels = [verifyLabel(null), verifyLabel({ ok: true, exitCode: LAND_LOG_SKIP_EXIT }), verifyLabel({ ok: null }),
    verifyLabel({ ok: false }), verifyLabel({ ok: true, proportional: true }), verifyLabel({ ok: true })];
  pin(`${RULE_LANDLOG} — verify reads no gate, the skip exit and a waitedOut as skipped`,
    labels.join(",") === "skipped,skipped,skipped,failed,proportional,ok", labels.join(","));
  pin("land-log.ts#VERIFY_SKIP_EXIT is server.ts#VERIFY_SKIP_EXIT",
    new RegExp(`^const VERIFY_SKIP_EXIT = ${LAND_LOG_SKIP_EXIT};`, "m").test(server), `land-log says ${LAND_LOG_SKIP_EXIT}`);
}

console.log(rows.join("\n"));
console.log(failed ? `\n${failed} FAILURES` : "\nALL PASS");
process.exit(failed ? 1 : 0);
