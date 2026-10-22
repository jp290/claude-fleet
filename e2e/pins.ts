import { sourceSection } from "../context-sections";
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
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { basename, join, resolve } from "node:path";
import {
  FRAGMENTS_FOR, FRAGMENT_BY_RULE_PREFIX, RULEBOOK_DIR, RULEBOOK_FRAGMENTS,
  RULEBOOK_BACKREF_HEADING,
  FRAGMENT_TITLES, ROLE_SECTION_CUT, fragmentFileName, fragmentSections, renderRulebook, renderRoleRulebook, LANE_CUT_INLINE,
  rulebookBody, type RoleAudience, type RoleRulebook, type RulebookFragment,
} from "../rulebook";
import { HANDOFF_WARN_KB, splitHandoff } from "../tools/handoff-rotate";
import { VERIFY_SKIP_EXIT as LAND_LOG_SKIP_EXIT, renderLandLog, verifyLabel, type MainCommit } from "../tools/land-log";
import { SHARD_UNITS, selectSkipUnits, shardPlan } from "./ctx";
// the module filter's map is IMPORTED and RUN, never re-spelled: a pin holding a second copy of
// the edges would pin the copy. What cannot be imported is the modules' own sources — those are
// re-derived below and compared against the map.
import { FIXTURES, MODULE_FIXTURES, moduleListFrom, modulePlanFor, modulesForPaths, selectModules } from "../suite-modules";
// the pane-hint builders are IMPORTED and CALLED by the sigil rule at the end of this file: only a
// rendered hint shows the tail `${eventAck(id)}` actually contributes, which a source scan cannot.
import {
  attentionAnswerMessage, auditWatchMessage, clarificationReplyMessage, clarificationWatchMessage,
  fleetReportDecisionMessage,
  commandJobWatchMessage, deployWatchMessage, laneSuiteWatchMessage, laneWatchMessage, mergeWatchMessage,
  harnessBlockMessage, laneReviewMessage,
} from "../lane-signals";
// the allowlist is IMPORTED, never re-spelled: a pin that copied the list would pin its own copy
import { HELPER_CMD_ALLOW, HELPER_CMD_FORBIDDEN, helperCmdCheck, REMOTE_NAME_MAX, remoteControlName, codexPermissionsFrom, CODEX_PERMISSIONS_DEFAULT } from "../server/types";
import { auditScopeEnv, modulesEnv } from "../helper-daemon/daemon";
import { readEventLog, readLedger } from "../server/persist";
// pi-zai's read-fence builder is IMPORTED and RUN: the pin holds the profile it generates, not prose
import { ALLOWED as BW_ALLOWED, PROTECTED as BW_PROTECTED, probeBwrapFence } from "./pi-zai-bwrap-probe";
import { LIVE_TMUX_SOCK, PIZAI_NSIRD_TOOLS, PRIVATE_SCAFFOLD, parsePiZaiDenyRoots, piZaiFenceProfile, piZaiGitOf } from "../server/pi-zai-fence";
import { readJsonl } from "../tools/briefstats";
import { laneStandNudge, laneStandNudgeText, type LaneStandView } from "../lane-signals";
import { quotaPosition, newResetEntries, parseQuotaRollout, readLocalQuota, readIdentityBound, createSubscriptionReader, SUBSCRIPTION_STALE_MS, PROVIDER_UNSUPPORTED } from "../codex-quota";
import {
  readJsonl as landQualityReadJsonl, modelKey, renderSummary, sizeIndexOf, sizeStampOrJoin,
} from "../tools/land-quality";
import { measureTranscript, readJsonl as laneContextCostReadJsonl, sessionAnatomy } from "../tools/lane-context-cost";
import { CAPABILITY_FUNCTIONS, INSTANCE_URL_RE } from "../src/protocol";
import { BoxDraft, DraftBook } from "../src/drafts";
import { fleetEventBundleText } from "../src/delivery-format";
import { runningEffort, runningModel } from "../src/running";
import { HARNESS_AVAILABILITY, MODEL_ALIASES, MODEL_DEFAULTS, MODEL_REGISTER, codexAvailability, roleDefaultsFor, codexModelSupport, modelEntry, modelsForHarness, resolveWorkerModel, workerModelWarnings, type FleetWorkerRole } from "../model-register";
import { FLEET_DEFAULT_MODEL, WORKER_CONTRACTS } from "../src/protocol";
import { modelLabel, modelWindow } from "../src/modelname";
// The Fleet manifest rules below run the SAME pure functions the delivery seams run — a pin that
// re-implemented the validator would only pin its own copy of the rules.
// the deploy-gap's path classifier is IMPORTED and RUN over this very tree: the whole finding it
// replaces was a hand-kept copy of the roles going stale, so a pin that re-spelled them would be
// the same defect one layer up.
import { buildRepoGraph, roleOf, type PathRole } from "../server/deploy-classify";
import { GATE_MACHINERY_FILES, isGateMachinery } from "../task-land-waves";
// S3's byte-equality rule is DRIVEN, not scanned: the renderer is pure (no clock, no git, no
// state — wave-brief.ts's own header says so), so the pin runs it over the no-comment shapes.
import { withCardHead, renderRowComments, renderCardHead, ROW_COMMENTS_MARK, ROW_COMMENTS_MAX_BYTES } from "../wave-brief";
import { CONTEXT_PACKS, CONTEXT_PACK_TRIGGERS, type ContextPackCapability, type ContextPackMode, type ContextPackSource, type ContextPackTrigger } from "../context-packs";
import { planContext } from "../context-plan";
import { SESSION_FILE_REF, renderSessionAgents, sessionFileRefMisses, type SessionAgents } from "../session-agents";
import { CLAUDE_CODE_MESSUNG, CLAUDE_CODE_ZEILEN, FLEET_BYTES_JE_TOKEN, SESSION_BLOCKS, resolveSessionPlan, type SessionBlock, type SessionPlanInput, type SessionPlanMessung, type SessionRole } from "../session-blocks";
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
// server.ts stays the ENTRY name (plan §Randbedingung 2: stage sentinel, ops/Dockerfile, watchdog.sh,
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
// A rule whose EVERY input is the SOURCE checkout's own state (its gitignored CLAUDE.md, rulebook/,
// .env) measures that checkout, not the tree under test. In the source checkout itself that IS the
// tree, and the rule fails like any other. Anywhere else — a lane, the land gate's rebased
// worktree — no byte of the tree can make it red or green, so a red there is TYPED `SRC-FAIL`,
// printed with its difference, and does not count: a lane must not lose its land to a defect it
// cannot repair (measured 2026-09-04: three hand edits to the main CLAUDE.md killed every land of
// this machine at stage 1 for ~20 min). The row prefix deliberately does not start with `FAIL`,
// which every `^FAIL` log reader counts as the tree's own. Bound after SOURCE_DIR below.
let sourceFailed = 0;
function pinSource(name: string, ok: boolean, detail: string, inSource: boolean): void {
  if (ok || inSource) { pin(name, ok, detail); return; }
  rows.push(`SRC-FAIL  ${name}  (${detail}) — the source checkout's own state, not this tree's; fix it there`);
  sourceFailed++;
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
// the ONE place a source-scoped rule is held hard (pinSource above): the tree under test IS the source
const IN_SOURCE = SOURCE_DIR === ROOT;

// ================================================================================================
// 0. Public-repository deployment identity
// ================================================================================================
{
  const RULE = "leak-pin: tracked files contain no Tailscale address beyond the placeholders";
  const octet = String.raw`(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])`;
  const address = String.raw`100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.` + octet + String.raw`\.` + octet;
  const boundary = String.raw`(^|[^[:digit:].])` + address + String.raw`([^[:digit:].]|$)`;
  const foundAddress = new RegExp(String.raw`(^|[^0-9.])(` + address + String.raw`)(?=[^0-9.]|$)`, "g");
  const placeholders = new Set(["100.64.0.0", "100.64.0.1"]);
  const probe = spawnSync("git", ["-C", ROOT, "grep", "-a", "-n", "-E", "-e", boundary, "--"],
    { encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" }, maxBuffer: 16 * 1024 * 1024 });
  if (probe.error || probe.status === null || probe.status > 1) {
    pin("leak-pin: Tailscale address search probe completed", false,
      (probe.error?.message || probe.stderr || `git grep exited ${String(probe.status)}`).trim().slice(0, 160));
  } else {
    const locations = probe.status === 1 ? [] : probe.stdout.trim().split("\n").filter(Boolean).flatMap((line) => {
      const location = /^(.+?:\d+):/.exec(line)?.[1] ?? "tracked file (line unavailable)";
      return [...line.matchAll(foundAddress)].some((match) => !placeholders.has(match[2])) ? [location] : [];
    });
    pin(RULE, locations.length === 0, `${locations.length} forbidden hit(s): [${locations.join(", ")}]`);
  }
}

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
    // Measured on the follower 2026-09-11: needle `workhorse` hit 406 tracked lines — every one of
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

const verifyCmd = /^VERIFY_CMD='([\s\S]*?)'$/m.exec(watchdog)?.[1] ?? "";
const auditCmd = /^AUDIT_CMD='([\s\S]*?)'$/m.exec(watchdog)?.[1] ?? "";
const spawnLine = watchdog.split("\n").find((l) => l.includes("exec bun server.ts")) ?? "";

const gateSuites = [...verifyCmd.matchAll(/\.\/(e2e-[a-z-]+\.sh)/g)].map((m) => m[1]);

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


  // The ordered step names in AGENTS.md §Verify, Lane are the reader's view of the live
  // command. Compare all three sides: documentation, watchdog.sh and LOCAL_PROOF_STEPS.
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
    // tools/briefstats.ts#readJsonl was a hand copy of this reader that kept the old defect after 99c8d74d.
    // Run it, not grep it: a delegation that re-grew its own parse loop must still turn this red.
    const brief = `${dir}/briefstats.jsonl`;
    writeFileSync(brief, `${valid[0]}\nnull\n`);
    const viaBrief = await readJsonl<Record<string, unknown>>(brief);
    pin(`${RULE_LEDGER} — tools/briefstats.ts#readJsonl inherits it (one record + one null line → rows=1 malformed=1)`,
      viaBrief.rows.length === 1 && viaBrief.malformed === 1 && JSON.stringify(viaBrief.rows) === `[${valid[0]}]`,
      `rows=${JSON.stringify(viaBrief.rows).slice(0, 120)} malformed=${viaBrief.malformed}`);
    // tools/land-quality.ts and tools/lane-context-cost.ts carried the last two hand copies: `v && typeof v ===
    // "object"` let an array line through as a row, and lane-context-cost swallowed torn lines uncounted.
    // Run both over record + array + null + torn, AND hold the source: each CLI imports readLedger and
    // its readJsonl body carries no JSON.parse of its own.
    const cli = `${dir}/cli.jsonl`;
    writeFileSync(cli, `${valid[0]}\n[]\nnull\n{"event":"torn"\n`);
    const viaLandQuality = await landQualityReadJsonl(cli);
    const viaLaneCost = await laneContextCostReadJsonl(cli);
    const copies = ["tools/land-quality.ts", "tools/lane-context-cost.ts"].map((file) => {
      const src = readFileSync(`${ROOT}/${file}`, "utf8"); // `read` is shadowed by the ledger fixture above
      const start = src.search(/\n(export )?async function readJsonl\(/);
      const body = start < 0 ? "" : src.slice(start, src.indexOf("\n}", start));
      return `${file}: ${/import \{[^}]*\breadLedger\b[^}]*\} from "\.\.\/server\/persist";/.test(src) ? "imports" : "NO import"}`
        + ` · ${!body ? "readJsonl missing" : body.includes("readLedger") && !body.includes("JSON.parse") ? "delegates" : "HAND COPY"}`;
    });
    pin(`${RULE_LEDGER} — tools/land-quality.ts#readJsonl and tools/lane-context-cost.ts#readJsonl delegate to it, no hand copy`,
      viaLandQuality.rows.length === 1 && viaLandQuality.malformed === 3
        && JSON.stringify(viaLandQuality.rows) === `[${valid[0]}]` && JSON.stringify(viaLaneCost) === `[${valid[0]}]`
        && copies.every((c) => c.endsWith("imports · delegates")),
      `land-quality rows=${viaLandQuality.rows.length} malformed=${viaLandQuality.malformed} · `
        + `lane-context-cost rows=${viaLaneCost.length} · ${copies.join(" · ")}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ...and a generation that VANISHES between the reader's decision and its read is missing, never a
// throw. server/persist.ts#rotateEventLog renames `x.jsonl` to `x.jsonl.1` while readLedger awaits;
// under the old existsSync-then-read that surfaced as ENOENT out of server.ts#seedInbound's top-level
// await and killed the boot before Bun.serve (lane 1370e250: `ENOENT ... audit.jsonl` right after
// `taking it over`). The race is FORCED, not waited for: Bun.file is wrapped so the rotation's rename
// lands exactly when the current generation is opened. The second pin keeps the catch narrow.
{
  const RULE_VANISH = "readLedger counts a generation that vanished before its read as missing (ENOENT), and only ENOENT";
  const dir = mkdtempSync(`${tmpdir()}/fleet-pins-vanish-`);
  const realFile = Bun.file;
  try {
    const file = `${dir}/audit.jsonl`;
    writeFileSync(`${file}.1`, '{"event":"older","ts":1}\n');
    writeFileSync(file, '{"event":"current","ts":2}\n');
    let opened = 0;
    Bun.file = ((path: string, options?: BlobPropertyBag) => {
      if (path === file && opened++ === 0) renameSync(file, `${file}.1`); // rotateEventLog's rename, mid-read
      return realFile(path, options);
    }) as typeof Bun.file;
    let got: string;
    try {
      const r = await readLedger<Record<string, unknown>>(file);
      got = `total=${r.total} malformed=${r.malformed} rows=${JSON.stringify(r.rows)}`;
    } catch (e: unknown) {
      got = `THREW ${(e as { code?: string }).code ?? String(e)}`;
    } finally {
      Bun.file = realFile;
    }
    pin(`${RULE_VANISH} — the current generation renamed away mid-read yields what was read, no throw`,
      opened === 1 && got === 'total=1 malformed=0 rows=[{"event":"older","ts":1}]', `opened=${opened} ${got}`);
    const dirGen = `${dir}/dirgen.jsonl`;
    mkdirSync(dirGen);
    const other = await readLedger(dirGen).then(() => "no throw", (e: unknown) => `threw ${(e as { code?: string }).code}`);
    pin(`${RULE_VANISH} — any other read error still throws (a generation that is a directory: EISDIR)`,
      other === "threw EISDIR", other);
  } finally {
    Bun.file = realFile;
    rmSync(dir, { recursive: true, force: true });
  }
}

{
  // docs/astra-auftraege.md §1: exact ±10-point band, milliseconds in / seconds at reset.
  // t (ms) | event | elapsed: 0 start 0%; 1_800_000 observation 50%; 3_600_000 reset 100%.
  const limits = (used_percent: number) => ({ primary: { used_percent, window_minutes: 60, resets_at: 3600 } });
  for (const [used, expected] of [[39, "unter"], [40, "innerhalb"], [50, "innerhalb"], [60, "innerhalb"], [61, "ueber"]] as const) {
    const value = quotaPosition(limits(used), 1_800_000);
    pin(`codex-quota: ${used}% at half-window is ${expected}`, value.position === expected && value.elapsed_percent === 50 && value.used_percent === used, JSON.stringify(value));
  }
  for (const [now, expected] of [[-1, 0], [3_600_001, 100]] as const) {
    pin(`codex-quota: elapsed clamps to ${expected}`, quotaPosition(limits(50), now).elapsed_percent === expected);
  }
  const errorOf = (fn: () => unknown) => { try { fn(); return "no error"; } catch (e) { return e instanceof Error ? e.message : String(e); } };
  for (const value of [null, undefined, {}, limits(-1), limits(101), { primary: { used_percent: 0, window_minutes: 0, resets_at: 3600 } }]) {
    pin("codex-quota: invalid quota is a named rollout error", errorOf(() => quotaPosition(value, 0)) === "rollout: invalid rate_limits.primary");
  }
  const entry = (id: string) => ({ id, reset_type: "banked", announced_at: "2026-09-15T00:00:00Z", text: "Reset announced", source: { type: "observed", url: "https://example.com/reset" } });
  pin("codex-quota: feed returns only the new announcement", JSON.stringify(newResetEntries({ data: [entry("new"), entry("known")] }, new Set(["known"]))) === JSON.stringify([entry("new")]));
  pin("codex-quota: empty feed has no new announcements", newResetEntries({ data: [] }, new Set()).length === 0);
  for (const feed of [null, undefined, {}, { data: null }]) {
    pin("codex-quota: missing data is a named feed error", errorOf(() => newResetEntries(feed, new Set())) === "feed: missing data array");
  }
  pin("codex-quota: malformed announcement fails even if known", errorOf(() => newResetEntries({ data: [{ id: "known" }] }, new Set(["known"]))) === "feed: invalid announcement");
}

{
  // t (ms) | event | exclusive owner
  // now-900001 | stale stored quota | local source; now | read/refresh | server clock
  // read pending -> 10 ms timeout -> late result | one acquisition | reader generation
  const now = Date.parse("2026-10-03T12:00:00Z");
  const window = { used_percent: 27, window_minutes: 300, resets_at: now / 1000 + 7200 };
  const limits = { limit_id: "codex", primary: window,
    secondary: { used_percent: 61, window_minutes: 10080, resets_at: now / 1000 + 604800 } };
  const event = (at = now, rate_limits: unknown = limits) => JSON.stringify({ timestamp: new Date(at).toISOString(), payload: { rate_limits } });
  const measured = parseQuotaRollout(event(), now);
  pin("subscription: unequal primary/secondary windows come from one event in seconds", measured.primary?.used_percent === 27
    && measured.primary.window_minutes === 300 && measured.primary.resets_at === now / 1000 + 7200
    && measured.secondary?.used_percent === 61 && measured.secondary.window_minutes === 10080
    && measured.source.measuredAt === now && measured.source.ageMs === 0 && measured.source.accountBound === false);
  const missing = parseQuotaRollout(event(now, { primary: window }), now);
  pin("subscription: absent secondary and legacy limit id remain null", missing.secondary === null && missing.source.limitId === null);
  const zero = parseQuotaRollout(event(now, { primary: { ...window, used_percent: 0 } }), now);
  pin("subscription: measured zero is retained", zero.status === "measured" && zero.primary?.used_percent === 0);
  const old = parseQuotaRollout(event(now - SUBSCRIPTION_STALE_MS - 1), now);
  pin("subscription: stale is event age, never read time", old.status === "stale" && old.source.ageMs === SUBSCRIPTION_STALE_MS + 1
    && old.source.fetchedAt === now && old.source.reason === "event-older-than-15-minutes");
  pin("subscription: torn last line is ignored", parseQuotaRollout(event() + '\n{"payload":', now).primary?.used_percent === 27);
  for (const text of ['{broken}\n' + event(), event() + '\n{broken}\n']) {
    const value = parseQuotaRollout(text, now);
    pin("subscription: malformed complete/interior line invalidates source", value.status === "error" && value.primary === null
      && value.secondary === null && value.source.reason === "invalid-json-line");
  }
  for (const bad of [{ ...limits, primary: { ...window, resets_at: window.resets_at * 1000 } },
    { ...limits, secondary: { ...window, used_percent: 101 } }, { ...limits, primary: { ...window, window_minutes: 0 } }]) {
    const value = parseQuotaRollout(event(now, bad), now);
    pin("subscription: invalid window fails without fallback to old event", value.status === "error" && value.primary === null
      && value.source.reason === "invalid-window");
  }
  const foreign = parseQuotaRollout(event(now, { ...limits, limit_id: "other" }), now);
  pin("subscription: foreign limit id cannot masquerade as codex", foreign.status === "unknown" && foreign.primary === null);
  const future = parseQuotaRollout(event(now + 1), now);
  pin("subscription: server clock rejects future event time", future.status === "unknown" && future.source.reason === "event-time-ahead-of-server");
  const noTime = parseQuotaRollout(JSON.stringify({ payload: { rate_limits: limits } }), now);
  pin("subscription: event time is required, not inferred from mtime", noTime.status === "unknown" && noTime.source.measuredAt === null);
  const dir = mkdtempSync(join(tmpdir(), "subscription-quota-"));
  try {
    const tailDay = join(dir, "tail-cases", "2026", "10", "03");
    mkdirSync(tailDay, { recursive: true });
    const cap = 262144;
    const boundaryEvent = event(now, { ...limits, primary: { ...window, used_percent: 10 } });
    const fillTail = (text: string) => text + " ".repeat(cap - Buffer.byteLength(text) - 1) + "\n";
    const tailCases = [
      { name: "event exactly at bounded tail start is measured", text: '{}\n' + fillTail(boundaryEvent + '\n'), used: 10, at: now },
      { name: "tail inside a line discards its valid-looking quota suffix", text: '{}\n ' + fillTail(boundaryEvent + '\n' + event(now - 60_000) + '\n'), used: 27, at: now - 60_000 },
      { name: "small complete file is measured", text: boundaryEvent + '\n', used: 10, at: now },
      { name: "torn final line retains the preceding measurement", text: boundaryEvent + '\n{"payload":', used: 10, at: now },
    ];
    for (const test of tailCases) {
      writeFileSync(join(tailDay, "fixture.jsonl"), test.text);
      const snapshot = await readLocalQuota(join(dir, "tail-cases"), () => now);
      pin(`codex-quota: ${test.name}`, snapshot.status === "measured" && snapshot.primary?.used_percent === test.used
        && snapshot.source.measuredAt === test.at && snapshot.source.selection.maxBytesPerFile === cap
        && snapshot.source.selection.historyComplete === false,
        `status=${snapshot.status}; used=${snapshot.primary?.used_percent}; at=${snapshot.source.measuredAt}; reason=${snapshot.source.reason}`);
    }
    const day = join(dir, "2026", "10", "03");
    mkdirSync(day, { recursive: true });
    writeFileSync(join(day, "a.jsonl"), event(now));
    writeFileSync(join(day, "z.jsonl"), event(now - 60_000));
    const local = await readLocalQuota(dir, () => now);
    pin("subscription: newest event wins over later-written other session", local.source.measuredAt === now && local.primary?.used_percent === 27);
    const absent = await readLocalQuota(join(dir, "absent"), () => now);
    pin("subscription: missing source is unknown with null windows", absent.status === "unknown" && absent.primary === null
      && absent.secondary === null && absent.source.reason === "missing-source");
    writeFileSync(join(day, "a.jsonl"), JSON.stringify({ payload: { fixture: "x".repeat(300_000) } }) + '\n' + event());
    const bounded = await readLocalQuota(dir, () => now);
    pin("subscription: bounded tail skips only its incomplete leading fragment and retains the event",
      bounded.primary?.used_percent === 27 && bounded.source.selection.historyComplete === false
      && bounded.source.measuredAt === now);
    writeFileSync(join(day, "z.jsonl"), '{bad}\n' + event());
    const corrupt = await readLocalQuota(dir, () => now);
    pin("subscription: corrupt file cannot fall back to another session", corrupt.status === "error" && corrupt.primary === null);
    const probe = spawnSync(process.execPath, ["-e", `
      let calls = 0;
      globalThis.fetch = () => { calls++; throw new Error("network-forbidden"); };
      Bun.write = () => { calls++; throw new Error("write-forbidden"); };
      const fs = await import("node:fs/promises");
      for (const name of ["mkdir", "rename", "unlink"]) fs.default[name] = () => { calls++; throw new Error("cache-forbidden"); };
      await import(${JSON.stringify(resolve(ROOT, "codex-quota.ts"))});
      console.log(JSON.stringify({calls, cache: (await import("node:fs")).existsSync(${JSON.stringify(join(dir, ".cache"))})}));
    `], { env: { ...process.env, HOME: dir, CODEX_HOME: dir }, encoding: "utf8", timeout: 10_000 });
    pin("subscription: import causes no CLI, network, feed or cache action", probe.status === 0
      && probe.stdout.trim() === '{"calls":0,"cache":false}', `status=${probe.status}`);
    const cliHome = join(dir, "cli-home"), cliDay = join(cliHome, "sessions", "2026", "10", "03");
    mkdirSync(cliDay, { recursive: true });
    const preload = join(dir, "cli-preload.ts");
    writeFileSync(preload, `Date.now = () => ${now};\nglobalThis.fetch = async () => Response.json({data: []});\n`);
    for (const stale of [true, false]) {
      writeFileSync(join(cliDay, "fixture.jsonl"), event(stale ? now - SUBSCRIPTION_STALE_MS - 1 : now) + "\n");
      const cli = spawnSync(process.execPath, ["--preload", preload, resolve(ROOT, "codex-quota.ts"), "--json"], {
        env: { ...process.env, HOME: cliHome, CODEX_HOME: cliHome }, encoding: "utf8", timeout: 10_000 });
      let result: unknown;
      try { result = JSON.parse(cli.stdout); } catch {}
      const expected = stale
        ? { quota: null, announcements: [], errors: ["rollout: stale codex rate_limits (event-older-than-15-minutes)"], exit_code: 2 }
        : { quota: quotaPosition(limits, now), announcements: [], errors: [], exit_code: 0 };
      pin(`subscription CLI: ${stale ? "stale snapshot is refused as current quota" : "fresh snapshot retains exact current quota"}`,
        cli.status === expected.exit_code && JSON.stringify(result) === JSON.stringify(expected),
        `status=${cli.status}; result=${JSON.stringify(result)}; stderr=${cli.stderr.trim()}`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
  let identity = "own";
  const rejected = await readIdentityBound(async () => identity, async () => { identity = "foreign"; return measured; })
    .then(() => "accepted", (error: unknown) => error instanceof Error ? error.message : "other");
  pin("subscription: identity replacement after await rejects foreign result", rejected === "source-identity-changed");
  const accepted = await readIdentityBound(async () => "own", async () => measured);
  pin("subscription: unchanged identity admits exact result", accepted.primary?.used_percent === 27);
  const reader = createSubscriptionReader(async () => old, () => now, 100);
  await reader.get();
  const reread = await reader.refresh("local");
  pin("subscription: local refresh never clears stale", reread.status === "stale" && reread.refresh.status === "ok"
    && reread.source.measuredAt === old.source.measuredAt);
  const unsupported = await reader.refresh("provider");
  pin("subscription: provider request is explicitly unsupported, keeps local provenance", unsupported.refresh.status === "unsupported"
    && unsupported.refresh.target === "provider" && unsupported.refresh.reason === PROVIDER_UNSUPPORTED
    && unsupported.source.measuredAt === old.source.measuredAt);
  let forbiddenReads = 0;
  const providerOnly = createSubscriptionReader(async () => { forbiddenReads++; return measured; }, () => now);
  const providerResult = await providerOnly.refresh("provider");
  pin("subscription: unsupported provider performs no local fallback read", forbiddenReads === 0
    && providerResult.primary === null && providerResult.refresh.status === "unsupported");
  // t | event | refresh owner
  // now | deferred local read starts | local request; now+1 | provider refused | provider request
  // now+2 | local read resolves/rejects | provider request remains unsupported
  for (const outcome of ["success", "failure"]) {
    let clock = now;
    let resolveRead!: (value: typeof measured) => void, rejectRead!: (error: Error) => void;
    const deferred = new Promise<typeof measured>((resolve, reject) => { resolveRead = resolve; rejectRead = reject; });
    const racing = createSubscriptionReader(() => deferred, () => clock, 1000);
    const local = racing.refresh("local");
    clock++;
    const provider = await racing.refresh("provider");
    clock++;
    if (outcome === "success") resolveRead(measured);
    else rejectRead(new Error("fixture-read-failed"));
    const settled = await local;
    pin(`subscription: deferred local ${outcome} cannot overwrite or misattribute provider unsupported`,
      provider.refresh.target === "provider" && provider.refresh.status === "unsupported"
        && JSON.stringify(settled.refresh) === JSON.stringify(provider.refresh)
        && settled.provider.status === "unsupported" && settled.provider.reason === PROVIDER_UNSUPPORTED
        && (outcome === "success" ? settled.status === "measured" && settled.primary?.used_percent === 27
          && settled.source.provenance === measured.source.provenance
          : settled.status === "error" && settled.primary === null && settled.source.reason === "read-failed"),
      JSON.stringify({ refresh: settled.refresh, status: settled.status, provider: settled.provider }));
  }
  const localOnly = await createSubscriptionReader(async () => measured, () => now, 100).refresh("local");
  pin("subscription: local completion retains its exact local success without a competing provider request",
    localOnly.refresh.target === "local" && localOnly.refresh.status === "ok" && localOnly.refresh.startedAt === now
      && localOnly.refresh.finishedAt === now && localOnly.primary?.used_percent === 27);
  // t | event | acquisition / refresh owner
  // now | initial get starts one deferred read | initial acquisition / no request
  // now+1 | local refresh joins; optional provider refusal follows | same read / local or provider
  // now+2 | read succeeds, fails or times out | same acquisition / last request retained
  for (const outcome of ["success", "stale", "failure", "timeout"] as const) for (const providerWins of [false, true]) {
    let clock = now, reads = 0;
    let resolveRead!: (value: typeof measured) => void, rejectRead!: (error: Error) => void;
    const deferred = new Promise<typeof measured>((resolve, reject) => { resolveRead = resolve; rejectRead = reject; });
    const joining = createSubscriptionReader(() => { reads++; return deferred; }, () => clock, 10);
    const initial = joining.get();
    clock++;
    const local = joining.refresh("local");
    const provider = providerWins ? await joining.refresh("provider") : null;
    clock++;
    if (outcome === "success") resolveRead(measured);
    else if (outcome === "stale") resolveRead(old);
    else if (outcome === "failure") rejectRead(new Error("fixture-initial-read-failed"));
    const [first, last] = await Promise.all([initial, local]);
    const reason = outcome === "failure" ? "read-failed" : outcome === "timeout" ? "read-timeout" : last.source.reason;
    pin(`subscription: local refresh joining initial ${outcome} shares one read and ${providerWins ? "preserves provider unsupported" : "records its exact completion"}`,
      reads === 1 && JSON.stringify(first) === JSON.stringify(last) && !joining.busy()
        && (provider ? JSON.stringify(last.refresh) === JSON.stringify(provider.refresh) && last.refresh.target === "provider"
          && last.refresh.status === "unsupported" && last.refresh.reason === PROVIDER_UNSUPPORTED
          : last.refresh.target === "local" && last.refresh.startedAt === now + 1 && last.refresh.finishedAt === now + 2
            && last.refresh.status === (outcome === "failure" ? "error" : outcome === "timeout" ? "timeout" : "ok")
            && last.refresh.reason === reason)
        && (outcome === "success" ? last.status === "measured" && last.primary?.used_percent === 27 && last.source.measuredAt === now
          : outcome === "stale" ? last.status === "stale" && last.source.measuredAt === old.source.measuredAt
          : last.status === "error" && last.primary === null && last.secondary === null && last.source.reason === reason),
      JSON.stringify({ reads, refresh: last.refresh, status: last.status, measuredAt: last.source.measuredAt }));
    if (outcome === "timeout") {
      resolveRead(measured);
      await Promise.resolve();
      const late = await joining.get();
      pin(`subscription: late initial read retains timeout ${providerWins ? "and provider unsupported" : "and local timeout completion"}`,
        reads === 1 && JSON.stringify(late) === JSON.stringify(last), JSON.stringify(late));
    }
  }
  // t | event | exclusive read owner
  // now | two initial getters join | one acquisition; neither caller has an observation
  // now | deferred read settles | both callers receive that same observation
  for (const outcome of ["success", "failure", "timeout"] as const) {
    let reads = 0, firstSettled = false, secondSettled = false;
    let resolveRead!: (value: typeof measured) => void, rejectRead!: (error: Error) => void;
    const deferred = new Promise<typeof measured>((resolve, reject) => { resolveRead = resolve; rejectRead = reject; });
    const concurrent = createSubscriptionReader(() => { reads++; return deferred; }, () => now, 10);
    const first = concurrent.get().then((value) => { firstSettled = true; return value; });
    const second = concurrent.get().then((value) => { secondSettled = true; return value; });
    await Promise.resolve();
    pin(`subscription: concurrent initial ${outcome} getters both await the single acquisition`,
      reads === 1 && concurrent.busy() && !firstSettled && !secondSettled,
      JSON.stringify({ reads, firstSettled, secondSettled, busy: concurrent.busy() }));
    if (outcome === "success") resolveRead(measured);
    else if (outcome === "failure") rejectRead(new Error("fixture-concurrent-read-failed"));
    const [a, b] = await Promise.all([first, second]);
    pin(`subscription: concurrent initial ${outcome} getters receive the exact shared result without another read`,
      reads === 1 && firstSettled && secondSettled && !concurrent.busy() && JSON.stringify(a) === JSON.stringify(b)
        && a.refresh.target === null && a.refresh.status === "not-requested"
        && (outcome === "success" ? a.status === "measured" && a.primary?.used_percent === 27 && a.source.measuredAt === now
          : a.status === "error" && a.primary === null && a.source.reason === (outcome === "failure" ? "read-failed" : "read-timeout")),
      JSON.stringify({ reads, status: a.status, measuredAt: a.source.measuredAt, reason: a.source.reason }));
  }
  let calls = 0;
  let release: ((value: typeof measured) => void) | undefined;
  const pending = createSubscriptionReader(async () => { calls++; return new Promise(resolve => { release = resolve; }); }, () => now, 10);
  const refreshing = pending.refresh("local");
  await Promise.resolve();
  const inFlight = await pending.get();
  pin("subscription: active refresh is visible without a second read", inFlight.refresh.status === "refreshing" && calls === 1);
  const timedOut = await refreshing;
  pin("subscription: read timeout has null windows and sanitized error", timedOut.refresh.status === "timeout"
    && timedOut.primary === null && timedOut.secondary === null && timedOut.source.reason === "read-timeout");
  release?.(measured);
  await Promise.resolve();
  pin("subscription: late read cannot overwrite timeout", (await pending.get()).refresh.status === "timeout" && (await pending.get()).primary === null);
  const failed = createSubscriptionReader(async () => { throw new Error("token/private/path/prompt"); }, () => now, 100);
  const failure = await failed.refresh("local");
  pin("subscription: unexpected source errors cannot leak raw details", failure.refresh.status === "error"
    && failure.source.reason === "read-failed" && !JSON.stringify(failure).includes("token/private"));
}

{
  // A LANE THAT HANDED OVER KEEPS ITS PEAK. Since the lane baton went live, a worktree's transcript
  // directory holds the full session AND its successor, and `endContext` (the last request over all
  // files) read Slot 7's 403 568-token lane as 78 729 — the successor's twelve seconds. A session the
  // fleet never prompted there (a probe run with the worktree as cwd) is not the lane at all.
  // docs/messungen/2026-09-14-lange-lanes-kontextbudget.md §d.
  const dir = mkdtempSync(`${tmpdir()}/lane-peak-`);
  try {
    const asst = (at: string, id: string, ctx: number, out: number): string => JSON.stringify({ timestamp: `2026-09-14T17:${at}Z`,
      message: { role: "assistant", id, model: "claude-opus-5", usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: ctx, output_tokens: out }, content: [{ type: "text", text: "x" }] } });
    const result = (at: string, tool: string, chars: number): string => JSON.stringify({ timestamp: `2026-09-14T17:${at}Z`,
      message: { role: "user", content: [{ type: "tool_result", tool_use_id: tool, content: "r".repeat(chars) }] } });
    writeFileSync(`${dir}/full.jsonl`, [asst("00:00", "a1", 100_000, 500), result("00:01", "t1", 2),
      asst("00:02", "a2", 100_510, 100), result("00:03", "t2", 5_000), asst("00:04", "a3", 400_000, 0)].join("\n") + "\n");
    writeFileSync(`${dir}/probe.jsonl`, asst("05:00", "p1", 900_000, 0) + "\n");
    writeFileSync(`${dir}/successor.jsonl`, asst("10:00", "b1", 80_000, 0) + "\n");
    const lane = await measureTranscript(dir, new Set(["full", "successor"]));
    const everything = await measureTranscript(dir);
    const full = await sessionAnatomy(`${dir}/full.jsonl`, 400_000);
    pin("lane-context-cost: a handed-over lane keeps its peak, and only the sessions the fleet prompted are the lane",
      lane?.files === 2 && lane.peakContext === 400_000 && lane.endContext === 80_000
        && everything?.files === 3 && everything.peakContext === 900_000,
      `lane files=${lane?.files} peak=${lane?.peakContext} end=${lane?.endContext} · unfiltered files=${everything?.files} peak=${everything?.peakContext}`);
    pin("lane-context-cost: the peak session's pots — output tokens retained (delta/output on a small-result turn), result chars, first threshold crossing",
      full.first === 100_000 && full.peak === 400_000 && full.ownOutput === 600 && full.toolResultChars === 5_002
        && full.retainRatio === 1.02 && full.overThresholdAt === Date.parse("2026-09-14T17:00:04Z"),
      JSON.stringify(full));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

{
  // the READER half, run rather than read: tools/land-quality.ts's model groups must keep the three
  // origins apart, and an old row's null must stay the one that says nothing. Without this a
  // `default` land silently joins the pinned population and the 16 % becomes invisible instead of
  // addressable — the same loss the ledger fix undoes, one file further on.
  {
    const mk = (model: string | null, modelOrigin: string | null): string =>
      modelKey({ model, harness: null, modelOrigin });
    const labels = {
      spawn: mk("claude-opus-5[1m]", "spawn"), dflt: mk("claude-opus-5[1m]", "default"),
      ambient: mk(null, "ambient"), unknown: mk(null, null), foreign: mk("glm-5.3", "spawn"),
    };
    pin("land-quality's model group names the origin: pinned, ~default, ambient and the row that cannot say are five distinct labels",
      labels.spawn === "claude/opus-5" && labels.dflt === "claude/opus-5~default"
      && labels.ambient === "claude/ambient" && labels.unknown === "claude/?"
      && labels.foreign === "claude/glm-5.3" && new Set(Object.values(labels)).size === 5,
      JSON.stringify(labels));
  }
  // THE SUMMARY ON NO ROWS (2026-09-18): state.sh prints renderSummary's output as its one
  // land-quality line, and an empty window must say so rather than print a zero share.
  {
    const empty = renderSummary([], "x");
    pin("land-quality's summary on no rows says 0 lands and never a zero share",
      empty.includes(": 0 lands") && !/nacharbeit 0/.test(empty), empty.split("\n")[0] ?? "");
  }
  // THE SIZE JOIN reads the archive (2026-09-18, S1 of the queue-fields note
  // docs/messungen/2026-09-17-queue-felder-und-ihre-leser.md): capTasks evicts rows into
  // tasks-archive.jsonl and a size that lived only on the row died there — 63 of the 255
  // size-null lands in the 14 d window. Run rather than read, on the ONE exported builder
  // main() feeds: an archive line with card.size counts, the NEWEST archive line per id wins
  // (an older size must not survive a newer sizeless row), fleet.json wins the double, and a
  // task on neither shelf stays absent rather than guessed.
  {
    const arch = [
      { task: { id: "t3", card: { size: "mittel" } } },
      { task: { id: "t3", card: { size: "klein" } } },
      { task: { id: "t2", card: { size: "mittel" } } },
      { task: "garbage" }, { nope: 1 },
    ];
    const m = sizeIndexOf({ tasks: [{ id: "t1", card: { size: "klein" } }, { id: "t4" }] }, arch);
    pin("land-quality's size index joins tasks-archive.jsonl (newest line per id) and fleet.json wins the double",
      m.get("t1") === "klein" && m.get("t2") === "mittel" && m.get("t3") === "klein"
      && !m.has("t4") && m.size === 3,
      `t1=${m.get("t1")} (fleet over archive) t2=${m.get("t2")} (archive only) `
        + `t3=${m.get("t3")} (newest archive line) t4 absent n=${m.size}`);
  }
  // …and the STAMP both halves agree on (2026-09-18, S2 of the queue-fields note): the writer
  // reads the card size off the task row at land time through ONE lookup (live first, then the
  // archive — the resolvedModel pattern), and the reader prefers that stamp in BOTH forms; only a
  // pre-stamp row falls back to the join. A null stamp that silently joined again would re-derive
  // exactly the answer the writer already read, off a row the eviction may have emptied.
  {
    const j = new Map(["t9"].map((id) => [id, "klein"] as const));
    pin("land-quality prefers the row's size stamp — value AND explicit none — over the join; only pre-stamp rows join",
      sizeStampOrJoin({ size: "gross" }, j, "t9", null) === "gross"
      && sizeStampOrJoin({ size: null }, j, "t9", null) === null
      && sizeStampOrJoin({}, j, "t9", null) === "klein"
      && sizeStampOrJoin({}, j, null, null) === null,
      "stamp=value kept · stamp=null stays none · absent joins · join miss stays null");
  }
  // THE BRIEF FORMS exist where the doc names them (2026-09-18): both scripts parse --brief and
  // reject an unknown flag, and docs/controller.md's loop section names both. A doc naming a flag
  // no script parses is the P-4 failure mode ("client rendering still open" beside 5× deployGap).
  {
    const state = read("state.sh"), register = read("register.sh"), ctl = read("docs/controller.md");
    const dispatch = (src: string) => /--brief\)/.test(src);
    const rejects = (src: string) => /unbekanntes Flag/.test(src);
    pin("state.sh and register.sh dispatch --brief and reject an unknown flag; docs/controller.md names both brief forms",
      dispatch(state) && rejects(state) && dispatch(register) && rejects(register)
      && /state\.sh --brief/.test(ctl) && /register\.sh --brief/.test(ctl),
      `state=${dispatch(state)}/${rejects(state)} register=${dispatch(register)}/${rejects(register)} `
        + `doc=${/state\.sh --brief/.test(ctl)}/${/register\.sh --brief/.test(ctl)}`);
    const dir = mkdtempSync(join(tmpdir(), "fleet-held-cli-"));
    try {
      const python = spawnSync("python3", ["-c", "import sys;print(sys.executable)"], {encoding: "utf8"});
      pin("held CLI fixture precondition: Python interpreter executes", python.status === 0 && !!python.stdout.trim(), python.stderr);
      const log = join(dir, "calls");
      writeFileSync(join(dir, "python3"), `#!${python.stdout.trim()}
import os, sys
with open(os.environ['HELD_PROBE_LOG'], 'a') as f: f.write('python\\n')
exec(compile(sys.stdin.read(), '<held-cli>', 'exec'))
`);
      chmodSync(join(dir, "python3"), 0o755);
      writeFileSync(join(dir, "ctl.sh"), read("ctl.sh"));
      chmodSync(join(dir, "ctl.sh"), 0o755);
      const home = join(dir, "owner-home");
      mkdirSync(home);
      writeFileSync(join(home, ".env"), "FLEET_HOST='held.fixture'\nFLEET_PORT=8765\n");
      writeFileSync(join(home, "fleet.json"), JSON.stringify({token: "PROBE_CREDENTIAL_MARKER"}, null, 2));
      writeFileSync(join(home, "server.ts"), "");
      writeFileSync(join(dir, "git"), `#!/bin/sh
printf 'git-home\\n' >> "$HELD_PROBE_LOG"
[ "$2" = "$HELD_PROBE_DIR" ] && [ "$3" = "rev-parse" ] && [ "$4" = "--path-format=absolute" ] && [ "$5" = "--git-common-dir" ] || exit 91
printf '%s/.git\\n' "$HELD_PROBE_HOME"
`);
      chmodSync(join(dir, "git"), 0o755);
      writeFileSync(join(dir, "bun"), `#!${process.execPath}
import {appendFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
const note = (s) => appendFileSync(process.env.HELD_PROBE_LOG, s + "\\n");
note("bun");
if (process.argv.join(" ").includes("PROBE_CREDENTIAL_MARKER")) throw new Error("credential in argv");
globalThis.fetch = async (url, opts) => {
  note("http");
  if (url !== "http://held.fixture:8765/api/operational-view") throw new Error("wrong home/.env host");
  if (opts.headers.authorization !== "Bearer PROBE_CREDENTIAL_MARKER") throw new Error("wrong home owner credential");
  const mode = process.env.HELD_PROBE_MODE;
  if (mode === "offline") throw new Error("PROBE_CREDENTIAL_MARKER private error");
  if (mode === "denied") return new Response('{"error":"PROBE_CREDENTIAL_MARKER refused"}', {status:401});
  return new Response(mode === "old" ? '{"version":0}' : process.env.HELD_PROBE_VIEW, {headers:{"content-type":"application/json"}});
};
await import(pathToFileURL(process.argv[2]).href);
`);
      chmodSync(join(dir, "bun"), 0o755);
      const fixture = {schema: "fleet.operational-view/v1", scope: "owner-metadata", bootEpoch: 1, computedAt: 2,
        revision: "queue:r1/bindings:b1/addresses:a1/git:g1/gateAudit:u1", observedRevision: "queue:r1/bindings:b1/addresses:a1/git:g1/gateAudit:u1",
        freshness: "fresh", pending: false, inflight: false, failed: null,
        sources: {queue: {revision: "r1", computedRevision: "r1", observedAt: 2, cadenceMs: 100, ageMs: 0, state: "fresh"}}, unknown: [],
        data: {rows: [{id: "row1", status: "queued", programId: "program1", held: false, after: []}],
          startable: [{id: "row1", by: "release"}], exceptions: [{kind: "audit", id: "row2", reason: "unknown", relatedIds: []}]} };
      const env: NodeJS.ProcessEnv = {...process.env, PATH: `${dir}:${process.env.PATH}`, FLEET_CTL_HOME: home,
        FLEET_SELF_URL: "http://wrong-pane-host",
        HELD_PROBE_LOG: log, HELD_PROBE_DIR: realpathSync(dir), HELD_PROBE_HOME: home,
        HELD_PROBE_MODE: "fresh", HELD_PROBE_VIEW: JSON.stringify(fixture)};
      for (const key of ["FLEET_TOKEN", "FLEET_CTL_TOKEN", "FLEET_CTL_URL", "FLEET_SELF_TOKEN"]) delete env[key];
      const run = (script: string, flag: string, mode = "fresh", view: unknown = fixture, credential = true, anchor = true) => {
        writeFileSync(log, "");
        writeFileSync(join(home, "fleet.json"), JSON.stringify(credential ? {token: "PROBE_CREDENTIAL_MARKER"} : {}, null, 2));
        const result = spawnSync("/bin/sh", [script, flag], {encoding: "utf8", timeout: 10_000,
          env: {...env, HELD_PROBE_MODE: mode, HELD_PROBE_VIEW: JSON.stringify(view), FLEET_CTL_HOME: anchor ? home : ""}});
        return {...result, calls: readFileSync(log, "utf8").trim().split("\n").filter(Boolean)};
      };
      for (const [name, source] of [["state.sh", state], ["register.sh", register]]) {
        const end = source.indexOf("\nesac\n");
        const prefix = source.slice(0, end + 7);
        const script = join(dir, name);
        // The executed dispatch chooses a full-path tripwire. Full diagnostics themselves retain
        // their existing body; this probe must fail if any brief success/failure enters that body.
        writeFileSync(script, prefix + `\nprintf 'full\\n' >> "$HELD_PROBE_LOG"\nprintf '__FULL_PATH__\\n'\n`);
        chmodSync(script, 0o755);
        const fresh = run(script, "--brief");
        pin(`${name} --brief without environment Owner token/URL executes ctl.sh get with home/.env and fleet.json, never the full path`,
          fresh.status === 0 && fresh.calls.join(",") === "python,bun,http" && fresh.stdout.includes(fixture.revision)
          && fresh.stdout.includes("startable row1 by=release") && (name === "state.sh" ? /boundary audit row2 .*reason=unknown/.test(fresh.stdout) : fresh.stdout.includes("boundary audit row2 reason=unknown"))
          && !fresh.stdout.includes("__FULL_PATH__") && !/PROBE_CREDENTIAL_MARKER/.test(fresh.stdout + fresh.stderr),
          `${Buffer.byteLength(fresh.stdout)} CLI bytes; calls=${fresh.calls.join(",")}`);
        for (const mode of ["offline", "old", "denied"])
          { const result = run(script, "--brief", mode);
            pin(`${name} --brief ${mode} source is concretely unknown without a full fallback or secret output`,
              result.status === 0 && result.stdout.includes("unknown source /api/operational-view")
              && result.calls.join(",") === "python,bun,http" && !result.stdout.includes("__FULL_PATH__")
              && result.stdout.includes(`full diagnosis: ./${name} --full`)
              && !/PROBE_CREDENTIAL_MARKER/.test(result.stdout + result.stderr)); }
        const laneHome = run(script, "--brief", "fresh", fixture, true, false);
        pin(`${name} --brief finds the same Owner home from the lane common git directory (no history read)`,
          laneHome.status === 0 && laneHome.calls.join(",") === "python,git-home,bun,http"
          && laneHome.stdout.includes(fixture.revision) && !/PROBE_CREDENTIAL_MARKER/.test(laneHome.stdout + laneHome.stderr),
          `calls=${laneHome.calls.join(",")}; exit=${laneHome.status}`);
        const missing = run(script, "--brief", "fresh", fixture, false);
        pin(`${name} --brief missing Owner credential is unknown before any HTTP or full work`,
          missing.status === 0 && missing.calls.join(",") === "python" && missing.stdout.includes("freshness=unknown")
          && missing.stdout.includes(`unknown source /api/operational-view reason=${name === "state.sh" ? "credential-or-local-validation-missing" : "ctl-read-failed"}${name === "state.sh" ? "; freshness=unknown" : ""}; full diagnosis: ./${name} --full`));
        const stale = run(script, "--brief", "fresh", {...fixture, freshness: "unknown", data: null,
          unknown: [{id: "git", reason: "stale"}]});
        pin(`${name} --brief carries stale source ID/reason and claims no startable row`,
          stale.status === 0 && (name === "state.sh" ? stale.stdout.includes("unknown door=GET /api/operational-view git reason=stale") : stale.stdout.includes("unknown git reason=stale")) && !stale.stdout.includes("startable row1"));
        const many = run(script, "--brief", "fresh", {...fixture, data: {...fixture.data,
          exceptions: Array.from({length: 100}, (_, i) => ({kind: "audit", id: `row${i}`, reason: "unknown"}))}});
        pin(`${name} --brief preserves its boundary budget contract with explicit overflow`,
          many.status === 0 && (name === "state.sh"
            ? many.stdout.includes("boundary count=100 omitted=95") && /boundary audit row99 .*reason=unknown/.test(many.stdout)
              && many.stdout.trimEnd().split("\n").length <= 80 && Buffer.byteLength(many.stdout) <= 10_000
            : many.stdout.trim().split("\n").length === 40 && many.stdout.includes("omitted=")));
        if (name === "state.sh") {
          const large = {...fixture, data: {...fixture.data,
            rows: Array.from({length: 207}, (_, i) => ({id: `row${i}`, status: "queued", programId: "program1", held: false, after: []})),
            bindings: Array.from({length: 82}, (_, i) => ({programId: `program${i}`, status: i < 68 ? "complete" : "active", state: "unknown"})),
            messages: Array.from({length: 201}, (_, i) => ({id: `message${i}`, unread: true})),
            audits: Array.from({length: 89}, (_, i) => ({taskId: `audit${i}`, state: "unknown"})),
            exceptions: Array.from({length: 49}, (_, i) => ({kind: "audit", id: `boundary${i}`, reason: "unknown"}))}};
          const bytesWithinBudget = (text: string) => Buffer.byteLength(text) <= 10_000;
          const measured = run(script, "--brief", "fresh", large);
          pin("state.sh live-size start has at most 80 lines and 10000 UTF-8 bytes",
            measured.status === 0 && measured.stdout.trimEnd().split("\n").length <= 80 && bytesWithinBudget(measured.stdout),
            `${measured.stdout.trimEnd().split("\n").length} lines; ${Buffer.byteLength(measured.stdout)} bytes`);
        }
        const full = run(script, "--full"), invalid = run(script, "--not-a-flag");
        pin(`${name} --full selects diagnosis, unknown flag rejects before either producer`,
          full.calls.join(",") === "full" && full.stdout.includes("__FULL_PATH__") && invalid.status === 2 && invalid.calls.length === 0);
      }
      const operationalRoute = /if \(url\.pathname === "\/api\/operational-view" && req\.method === "GET"\)[\s\S]{0,250}/.exec(server)?.[0] ?? "";
      const ownerGate = server.lastIndexOf('if (!(await tokenGate(tokenFrom(req))))', server.indexOf(operationalRoute));
      pin("held view wire/docs agree on the sole Owner-auth GET and no GET-triggered refresh",
        operationalRoute.includes("operationalView?.read()") && ownerGate >= 0
        && read("docs/self-api.md").includes('schema: "fleet.operational-view/v1"')
        && !/observe\(|produceOperationalData\(|invalidate\(/.test(operationalRoute));
    } finally { rmSync(dir, {recursive: true, force: true}); }
  }
  {
    const body = (head: string) => server.match(new RegExp(head.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\s\\S]*?\\n\\}\\n"))?.[0] ?? "";
    const role = body("function selfPosition("), inbound = body("function messageInboundFor(");
    const scopeSource = `
      const s = {id: 1, openedAt: 1, sessionId: 'mine', cwd: '/fixture', label: 'MAIN'};
      const slots = [s], messages = {entries: [
        {id: 'own', readBy: null, to: {kind: 'program', id: 'own-program'}},
        {id: 'foreign', readBy: null, to: {kind: 'role', role: 'orchestrator'}}]};
      const watches = [], parkedSends = [], clarifications = [], successionDebts = [];
      const mainBindingOf = () => ({ok: true, programs: [{id: 'own-program'}]});
      const positionRole = () => 'program-main', isOrchestratorLabel = () => false;
      const fleetReportsFor = () => [], slotFrom = () => s;
      const messageAddressesFor = () => [{kind: 'program', id: 'own-program'}];
      const sameAddress = (a,b) => JSON.stringify(a) === JSON.stringify(b);
      const resolveMessageAddress = () => ({ok:true, escalatedTo:null, holder:null});
      ${inbound}
      ${role}
      return selfPosition(s).waitingOnMe;
    `;
    try {
      const scope = new Function(new Bun.Transpiler({loader: "ts"}).transformSync(scopeSource));
      const rows = scope() as {id: string}[];
      const mutant = new Function(new Bun.Transpiler({loader: "ts"}).transformSync(
        scopeSource.replace("m.readBy === null && messageInboundFor(s, m)", "m.readBy === null")))() as {id: string}[];
      pin("start own waiting facts exclude a foreign-role message; removed-scope mutation admits it",
        rows.length === 1 && rows[0]?.id === "own" && !JSON.stringify(rows).includes("foreign")
        && mutant.length === 2 && mutant[1]?.id === "foreign");
    } catch (e) { pin("start message scope fixture executes", false, String(e)); }
    for (const path of ["/api/self", "/api/self/program-execution"]) {
      const at = server.indexOf(`if (url.pathname === "${path}" && req.method === "GET")`);
      const end = server.indexOf("\n    }", at);
      const route = server.slice(at, end + 6);
      pin(`${path} re-proves exact occupant after its ledger await and performs no state write`,
        route.indexOf("const still = resolveSelfPrincipal(req)") > route.indexOf("await ")
        && route.includes("s.sessionId !== sessionId") && route.includes("slotFrom(s.id) !== s")
        && route.includes('refusal: "occupant-changed"') && !/saveState|audit\(|\.readBy\s*=(?!=)|createAuto|createWatch/.test(route));
      const exercise = async (change: boolean, mutant = false): Promise<{status: number; refusal?: string}> => {
        const tested = mutant ? route.replace(/      if \(still\?\.kind[\s\S]*?return json\(\{ refusal: "occupant-changed"[^\n]*\n/, "") : route;
        const code = `return (async () => {
          const url = {pathname: ${JSON.stringify(path)}}, req = {method: 'GET'};
          const s = {id:1, openedAt:1, sessionId:'original', cwd:'/fixture', lastOutput:1};
          let slots = [s];
          const resolveSelfPrincipal = () => slots[0] === s ? {kind:'session',slot:1,openedAt:1} : null;
          const slotFrom = () => slots[0];
          const program = {id:'own'}, boundProgramsForMain = () => [program];
          const crossAwait = async () => {await Promise.resolve();
            if (${change}) slots = [{...s,openedAt:2,sessionId:'replacement'}];};
          const readLedger = async () => {await crossAwait(); return {rows:[]};};
          const programExecutionView = async () => {await crossAwait(); return json({});};
          const json = (body, status = 200) => ({...body,status});
          const Bun = {sleep: async () => {}};
          const LANE_OUTCOME_FILE = '/fixture';
          const messageAddressesFor = () => [], messageRetentionUnknown = () => [], NO_MESSAGE_ADDRESS = 'unsupported';
          const messages = {entries:[],dropped:0}, attentionRequests = [], autos = [], watches = [], fleetEvents = [];
          const selfPosition = () => ({}), lineageSelfView = () => null, attentionFor = () => [], selfContextView = () => null;
          ${tested}
          throw Error('route did not execute');
        })();`;
        const result = await new Function(new Bun.Transpiler({loader: "ts"}).transformSync(code))() as {status: number; refusal?: string};
        return result;
      };
      try {
        const control = await exercise(false), changed = await exercise(true), mutant = await exercise(true, true);
        pin(`${path} executed await probe refuses recycled occupant; removed-guard mutation fails that invariant`,
          control.status === 200 && changed.status === 409 && changed.refusal === "occupant-changed" && mutant.status === 200,
          `control=${control.status} recycled=${changed.status} mutant=${mutant.status}`);
      } catch (e) { pin(`${path} await probe executes`, false, String(e)); }
    }
  }
  // THE REPORT LEDGER: every place that opens a report or stamps a verdict writes its row. A fourth
  // decision site without the line would leave that verdict only in the prunable live list.
  const reportOpens = server.split('audit("fleet_report_open"').length - 1;
  const decisionStamps = server.split("report.decision = {").length - 1;
}

{
  const tStart = server.indexOf("async function tickDispatch");
  const tBody = server.slice(tStart, server.indexOf("\n}\n", tStart));
  // ACP-16 · THE SECOND RELEASE DOOR. Three rules over the SOURCE, because none of the three is
  // visible at runtime: a handler that read `programId` off a request would answer happily on every
  // request that happens not to carry one; a bare `t.status = "queued"` would record nothing and
  // look identical to a release; and a harness gate asking a DIFFERENT question than the tick's
  // would only be wrong on the fleet where the two answers differ.
  const relStart = server.indexOf("async function releaseTaskForMain(");
  const relBody = relStart < 0 ? "" : server.slice(relStart, server.indexOf("\n}\n", relStart));

  // …and since the in-place cut (server.ts#respawnInPlace, owner 2026-09-21) the three MAIN
  // succession rails found into the slot they already hold as well — generic, Supervisor and
  // Program-MAIN — so they left the `free` count and are asserted in their own bodies like the lane
  // baton: same three lines, each naming `s`.
  const bodyOf = (from: string, to: string): string => {
    const at = server.indexOf(from);
    return at < 0 ? "" : server.slice(at, server.indexOf(to, at));
  };
  const home = mkdtempSync(`${tmpdir()}/fleet-pin-permissions-`);

  const pzStart = server.indexOf("const PI_ZAI_HARNESS: Harness = {");
  const pzBody = pzStart < 0 ? "" : server.slice(pzStart, server.indexOf("\n};\n", pzStart));
  const pzCode = pzBody.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  // PI-ZAI'S READ FENCE (docs/messungen/2026-09-21-pi-zai-lesezaun.md §5 item 2). The builder runs
  // over fixture paths and the GENERATED profile must carry the three rules that each, alone, would
  // have failed a probe: T1 the fleet.json/.env regex (a literal missed the .bak copies), T3 the PAIR
  // process-info-others + sysctl kern.procargs (either alone left 508–531 PIDs' environments
  // readable), T2 the live tmux socket — present even when the fixture names no socket of its own.
  // Mutation: strike any one of those lines in server/pi-zai-fence.ts and this row is red. What the
  // rules DO (EPERM, the own process group's PIDs only) is executed, not read, in e2e/security.ts §6a.
  {
    const RULE_PZ_FENCE = "pi-zai's generated read fence holds the three measured rules: fleet.json/.env regex, process-info+sysctl pair, live tmux socket";
    const fx = { home: "/Users/fx", fleetDir: "/Users/fx/claude-fleet", agentDir: "/Users/fx/.config/claude-fleet/pi-zai-agent",
      keyFile: "/Users/fx/.config/claude-fleet/secrets/zai.key", cwd: "/Users/fx/claude-fleet.worktrees/lane-1",
      tmuxDir: "/private/tmp/tmux-501", sockets: [] as string[],
      // five SYNTHETIC deny roots — the owner's real ones are private names and live only in the
      // host's .env; no tracked file may carry them
      denyRoots: ["/Users/fx/deny-a", "/Users/fx/deny-b", "/Users/fx/deny-b.worktrees", "/Users/fx/Desktop/deny-c", "/Users/fx/deny-d"],
      tmpRoots: ["/private/tmp", "/private/var/folders/fx/fx"], ownTmp: "/private/tmp/fleet-pi-zai/0123456789abcdef",
      suiteLock: "/private/tmp/fleet-e2e.lock",
      toolRoots: ["/Users/fx/.bun/bin", "/Users/fx/.local/bin", "/Users/fx/.local/lib/node_modules/@scope/pi"],
      git: { common: "/Users/fx/claude-fleet/.git", admin: "/Users/fx/claude-fleet/.git/worktrees/lane-1", ref: "refs/heads/fleet/lane-1" } };
    const prof = piZaiFenceProfile(fx) ?? "";
    // the never-deny runs up to the allow that re-opens this pane's own session
    const NEVER = "(deny file-read-data file-read-metadata file-read-xattr file-write* ";
    const dfAt = prof.indexOf(NEVER);
    const denyFiles = dfAt < 0 ? "" : prof.slice(dfAt, prof.indexOf(")(allow ", dfAt));
    const parts = {
      regex: denyFiles.includes('(regex #"^/Users/fx/claude-fleet/(fleet[.]json|[.]env)")'),
      procInfo: prof.includes("(deny process-info* (target others))"),
      sysctl: prof.includes('(deny sysctl-read (sysctl-name-regex #"^kern[.]procargs"))'),
      liveSock: prof.includes(`(deny network-outbound (remote unix-socket (path-literal "/private/tmp/tmux-501/${LIVE_TMUX_SOCK}"))`)
        && LIVE_TMUX_SOCK === "claudefleet",
      allowDefault: prof.startsWith("(version 1)(allow default)"),
    };
    pin(RULE_PZ_FENCE, Object.values(parts).every(Boolean), JSON.stringify(parts));
    // THE ALLOWLIST SHAPE (owner 2026-10-06, docs/messungen/2026-10-06-pi-zai-lesebedarf.md): home and
    // the shared temp roots are closed for content and writes FIRST, every opening follows, and every
    // never-rule follows every opening — SBPL's later rule wins within one operation. And no file
    // rule may use the `file-read*` wildcard: a rule naming `file-read-data` beats a wildcard one in
    // EITHER order (measured on macOS 26.3), so one wildcard never-rule would silently lose to an
    // opening and the key file or a foreign session would read straight through. Mutation: open a
    // never-rule with `file-read*`, or move the home deny below an opening — red.
    const RULE_PZ_ALLOWLIST = "pi-zai's fence closes home and the temp roots first, opens only named areas, and never-rules come last in explicit operations";
    const closeAt = prof.indexOf('(deny file-read-data file-read-xattr file-write* (subpath "/Users/fx") (subpath "/private/tmp") (subpath "/private/var/folders/fx/fx"))');
    // every allow but the leading `(allow default)`; past the never-rules only this pane's own
    // session may re-open (and the bare listing of sessions/ that pi's mkdir needs)
    const openings = [...prof.matchAll(/\(allow (?!default\))[^()]*/g)].map((m) => m.index ?? -1);
    const lateOpenings = openings.filter((i) => i > dfAt).map((i) => prof.slice(i, prof.indexOf("))", i)));
    const shape = {
      closedFirst: closeAt > 0 && openings.length > 0 && openings.every((i) => i > closeAt),
      cwdOpen: prof.includes(`(allow file-read-data file-read-xattr file-write* (subpath "${fx.cwd}")`),
      neverAfterOpenings: dfAt > 0 && lateOpenings.length === 2 && lateOpenings.every((o) => o.includes(`"${fx.agentDir}/sessions`)),
      noWildcardFileRule: !/\((?:allow|deny) file-read\*/.test(prof),
      noBareAllow: !/\(allow (?!default\))[a-z*-]+(?: [a-z*-]+)*\)/.test(prof),
      ownBranchOnly: prof.includes(`(literal "${fx.git.common}/${fx.git.ref}")`) && !prof.includes(`(subpath "${fx.git.common}/refs")`),
    };
    pin(RULE_PZ_ALLOWLIST, Object.values(shape).every(Boolean), JSON.stringify(shape));
    // what may never be written even inside an opening: every file that makes the NEXT, unfenced git
    // run in this worktree execute something (hooks, a config's fsmonitor/hooksPath, a re-aimed
    // `.git` or `commondir` pointer), and the private scaffold's content inside the cwd
    const gitNever = ["hooks", "config", "config.worktree", "commondir", "gitdir"].flatMap((f) =>
      [fx.git.common, fx.git.admin].map((d) => f === "hooks" ? `(subpath "${d}/hooks")` : `(literal "${d}/${f}")`));
    const neverW = prof.slice(prof.lastIndexOf("(deny file-write* "));
    pin("pi-zai's fence never lets a lane write a file that steers the server's unfenced git, nor read the private scaffold in its cwd",
      gitNever.every((r) => neverW.includes(r)) && neverW.includes(`(literal "${fx.cwd}/.git")`)
        && PRIVATE_SCAFFOLD.every((f) => prof.includes(`(literal "${fx.cwd}/${f}")`))
        && ["CLAUDE.md", "OWNER.md", ".env"].every((f) => (PRIVATE_SCAFFOLD as readonly string[]).includes(f)),
      `${gitNever.filter((r) => !neverW.includes(r)).length} git rules missing / scaffold=${PRIVATE_SCAFFOLD.join(",")}`);
    // SwiftPM's atomic writes stage in <DARWIN_USER_TEMP_DIR>/TemporaryItems/NSIRD_<tool>_*, inside the
    // closed temp roots: opened for the named tools only, and only create + unlink — never a read, never
    // a write into a file that already exists (another process's staged content). Without a userTemp no
    // such rule at all. Mutation: widen the ops, drop the tool names, or emit it without userTemp — red.
    {
      const ut = "/private/var/folders/fx/fx/T";
      const withUt = piZaiFenceProfile({ ...fx, userTemp: ut }) ?? "";
      const nsird = `(allow file-write-create file-write-unlink (regex #"^${ut}/TemporaryItems/NSIRD_(${PIZAI_NSIRD_TOOLS.join("|")})_[^/]+(/|$)"))`;
      const nsirdParts = {
        exact: withUt.includes(nsird) && (withUt.match(/NSIRD_/g) ?? []).length === 1,
        beforeNever: withUt.indexOf(nsird) > 0 && withUt.indexOf(nsird) < withUt.indexOf(NEVER),
        swiftOnly: PIZAI_NSIRD_TOOLS.length > 0 && PIZAI_NSIRD_TOOLS.every((t) => /^swift-[a-z]+$/.test(t)),
        absentWithout: !prof.includes("NSIRD_") && !(piZaiFenceProfile({ ...fx, userTemp: null }) ?? "").includes("NSIRD_"),
        quoteRefused: piZaiFenceProfile({ ...fx, userTemp: '/private/var/folders/fx/"T' }) === null,
      };
      pin("pi-zai's fence lets SwiftPM stage atomic writes in the per-user temp dir: named tools, create and unlink only",
        Object.values(nsirdParts).every(Boolean), JSON.stringify(nsirdParts));
    }
    {
      const wt = realpathSync(mkdtempSync(`${tmpdir()}/pi-zai-auth-`));
      const agentDir = `${wt}/agent`;
      const auth = `${agentDir}/auth.json`;
      const keyFile = `${wt}/zai.key`;
      const grant = `(allow file-read-data (literal "${auth}"))`;
      const reason = 'pi-zai: credential store is not an empty regular JSON object or is unreadable; auth.json remains blocked';
      const input = { ...fx, home: wt, agentDir, keyFile, cwd: `${wt}/cwd`, ownTmp: `${wt}/own`,
        tmpRoots: [realpathSync(tmpdir())], suiteLock: `${wt}/lock`, tmuxDir: `${wt}/tmux`,
        toolRoots: [], git: null };
      try {
        for (const d of [agentDir, input.cwd, input.ownTmp]) mkdirSync(d, { recursive: true });
        const build = (text: string): string => {
          writeFileSync(auth, text);
          return piZaiFenceProfile(input) ?? "";
        };
        for (const text of ["", "{}", " \n { } \n"]) {
          const p = build(text);
          pin("pi-zai grants exactly credential-store data reads only for an empty regular JSON object",
            p.includes(grant) && !p.includes(reason)
              && !p.includes(`(allow file-read-data file-read-metadata (literal "${auth}"))`), JSON.stringify(text));
        }
        for (const text of ['{"zai":{"key":"synthetic-login"}}', '{"zai":null}', "[]", "null", "false", "broken"]) {
          const p = build(text);
          pin("pi-zai keeps a populated or invalid credential store denied and names the startup refusal",
            !p.includes(grant) && p.includes(`(literal "${auth}")`) && p.endsWith(`(error "${reason}")`), JSON.stringify(text));
        }
        rmSync(auth);
        pin("pi-zai refuses a missing credential store with its named reason", (piZaiFenceProfile(input) ?? "").includes(reason));
        writeFileSync(`${wt}/other-auth`, "{}");
        symlinkSync(`${wt}/other-auth`, auth);
        pin("pi-zai refuses a symlink credential store even when its target is empty", (piZaiFenceProfile(input) ?? "").includes(reason));
        rmSync(auth);
        const p = build("{}");
        if (process.platform === "darwin") {
          const sbx = "/usr/bin/sandbox-exec";
          const run = (profile: string, command: string, args: string[] = []) => spawnSync(sbx,
            ["-p", profile, command, ...args], { encoding: "utf8", timeout: 20_000, cwd: input.cwd });
          const self = run(p, "/usr/bin/true");
          pin("pi-zai empty-store fence self-test stays green", self.status === 0, self.stderr);
          writeFileSync(keyFile, "synthetic-key");
          writeFileSync(`${agentDir}/models.json`, JSON.stringify({ providers: { zai: { models: [
            { id: "glm-5.3", name: "GLM-5.3", contextWindow: 1000000, maxTokens: 131072, reasoning: true },
          ] } } }));
          const ext = `${input.cwd}/probe.ts`;
          writeFileSync(ext, `import { readFileSync, writeFileSync } from "node:fs";
export default function (pi) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const key = await ctx.modelRegistry.getApiKeyForProvider("zai");
      console.error("AUTH_READY=" + (key === "synthetic-key" ? "OK" : "MISSING"));
    } catch (err) { console.error("AUTH_READY=FAILED " + err.message); }
  });
  for (const [name, attempt] of [
    ["AUTH_WRITE", () => writeFileSync(process.env.PROBE_AUTH, "{}")],
    ["KEY_READ", () => readFileSync(process.env.PROBE_KEY)],
  ]) {
    try { attempt(); console.error(name + "=OPEN"); }
    catch (err) { console.error(name + "=" + err.code); }
  }
}
`);
          const pi = (profile: string) => spawnSync(sbx, ["-p", profile, "pi", "--offline", "--mode", "rpc",
            "--provider", "zai", "--model", "glm-5.3", "--no-session", "--no-approve", "--no-extensions",
            "--no-skills", "--no-prompt-templates", "--no-themes", "--no-context-files", "--extension", ext], {
            encoding: "utf8", timeout: 20_000, cwd: input.cwd,
            input: '{"id":"fence-ready","type":"get_state"}\n',
            env: { PATH: process.env.PATH, HOME: input.ownTmp, TMPDIR: input.ownTmp,
              PI_CODING_AGENT_DIR: agentDir, ZAI_API_KEY: "synthetic-key", PROBE_AUTH: auth, PROBE_KEY: keyFile },
          });
          const booted = (r: ReturnType<typeof pi>): boolean => r.status === 0 && r.stderr.includes("AUTH_READY=OK")
            && r.stdout.split("\n").some((line) => {
              try {
                const row: unknown = JSON.parse(line);
                if (!row || typeof row !== "object" || !("data" in row)) return false;
                const data = row.data;
                if (!data || typeof data !== "object" || !("model" in data)) return false;
                const model = data.model;
                return "id" in row && row.id === "fence-ready" && "success" in row && row.success === true
                  && !!model && typeof model === "object" && "provider" in model && model.provider === "zai";
              }
              catch { return false; }
            });
          const baseline = pi(p);
          pin("pi-zai installed pi bootstraps beyond credential-store reading under the empty-store profile",
            booted(baseline), `${baseline.error?.message ?? baseline.status} / ${baseline.stderr.slice(-500)}`);
          pin("pi-zai the same pi run cannot write auth.json or read the key file",
            baseline.stderr.includes("AUTH_WRITE=EPERM") && baseline.stderr.includes("KEY_READ=EPERM")
              && readFileSync(auth, "utf8") === "{}", baseline.stderr.slice(-500));
          const populated = build('{"zai":{"key":"synthetic-login"}}');
          const refusal = run(populated, "/usr/bin/true");
          const withoutError = populated.replace(`(error "${reason}")`, "");
          const read = (profile: string) => run(profile, "/bin/sh", ["-c", `: < '${auth}'`]);
          const denied = read(withoutError);
          pin("pi-zai populated store names its startup refusal and stays mechanically unreadable",
            refusal.status !== 0 && refusal.stderr.includes(reason) && denied.status !== 0
              && denied.stderr.includes("Operation not permitted"), `${refusal.status} / ${denied.stderr.trim()}`);
        } else {
          skip("pi-zai real pi credential-store fence execution", "Darwin sandbox-exec is unavailable; generated-profile checks ran");
        }
      } finally { rmSync(wt, { recursive: true, force: true }); }
    }
    // THE WRITABLE BRANCH COMES FROM FLEET, NEVER FROM THE WORKTREE. <admin>/HEAD lies in the admin dir
    // the fence opens for writing: a lane that re-aimed it at refs/heads/main would have had main
    // granted on its next spawn. Fixture: a worktree whose HEAD names main, handed Fleet's record
    // branch — the ref is the record's, null without one, and main appears in no generated rule.
    // Mutation: read HEAD again in piZaiGitOf — red.
    {
      const wt = realpathSync(mkdtempSync(`${tmpdir()}/pi-zai-head-`));
      try {
        mkdirSync(`${wt}/common/worktrees/lane-x`, { recursive: true });
        mkdirSync(`${wt}/cwd`);
        writeFileSync(`${wt}/cwd/.git`, `gitdir: ${wt}/common/worktrees/lane-x\n`);
        writeFileSync(`${wt}/common/worktrees/lane-x/commondir`, "../..\n");
        writeFileSync(`${wt}/common/worktrees/lane-x/HEAD`, "ref: refs/heads/main\n");
        const g = piZaiGitOf(`${wt}/cwd`, "fleet/lane-x");
        const gNone = piZaiGitOf(`${wt}/cwd`, null);
        const p = g ? piZaiFenceProfile({ ...fx, git: g }) ?? "" : "";
        const headParts = {
          recordRef: g?.ref === "refs/heads/fleet/lane-x" && g.common === `${wt}/common`,
          noRecordNoRef: gNone !== null && gNone.ref === null,
          mainNowhere: p.includes(`(literal "${wt}/common/refs/heads/fleet/lane-x")`) && !p.includes("refs/heads/main"),
        };
        pin("pi-zai's writable branch is Fleet's lane record, never the worktree's own HEAD",
          Object.values(headParts).every(Boolean), JSON.stringify(headParts));
      } finally { rmSync(wt, { recursive: true, force: true }); }
    }
    // DARWIN FAILS CLOSED: without a resolved per-user temp dir (getconf answered nothing) the per-user
    // dir would stay open — $TMPDIR, the user cache and Fleet's copies in them — while the profile
    // still looked complete. On darwin no userTemp, or one outside the closed tmpRoots, builds NO
    // profile, and pi does not start. Mutation: drop the darwin check — red.
    {
      const ut = "/private/var/folders/fx/fx/T";
      const darwinParts = {
        noUserTemp: piZaiFenceProfile({ ...fx, darwin: true }) === null && piZaiFenceProfile({ ...fx, darwin: true, userTemp: null }) === null,
        outsideRoots: piZaiFenceProfile({ ...fx, darwin: true, userTemp: "/private/var/folders/zz/zz/T" }) === null,
        resolvedBuilds: (piZaiFenceProfile({ ...fx, darwin: true, userTemp: ut }) ?? "").startsWith("(version 1)"),
        offDarwinBuilds: (piZaiFenceProfile({ ...fx, darwin: false }) ?? "").startsWith("(version 1)"),
      };
      pin("pi-zai builds NO fence on darwin when the per-user temp dir is unresolved, so pi does not start",
        Object.values(darwinParts).every(Boolean), JSON.stringify(darwinParts));
    }
    pin("pi-zai builds NO fence when a tool root would re-open home, or no temp root is named",
      piZaiFenceProfile({ ...fx, toolRoots: ["/Users/fx"] }) === null && piZaiFenceProfile({ ...fx, toolRoots: ["/Users"] }) === null
        && piZaiFenceProfile({ ...fx, tmpRoots: [] }) === null && piZaiFenceProfile({ ...fx, git: { ...fx.git, ref: "refs/heads/a\"b" } }) === null,
      "a home-wide tool root, an empty temp list or a quote-bearing ref still built a profile");
    pin("pi-zai's generated file-read/file-write deny covers every configured deny root",
      fx.denyRoots.every((p) => denyFiles.includes(`(subpath "${p}")`)),
      `${fx.denyRoots.filter((p) => !denyFiles.includes(`(subpath "${p}")`)).length} missing roots`);
    // FAIL-CLOSED CONFIG: FLEET_PI_ZAI_DENY_ROOTS absent, empty or malformed parses to null, and a
    // null or empty list builds NO profile — so the spawn starts no pi instead of a fence without
    // the private roots. Each malformed form is one way a hand-written .env line goes wrong.
    const env = fx.denyRoots.join(":");
    const badEnv: [string, string | undefined][] = [["absent", undefined], ["empty", ""], ["relative", "deny-a:/x/b"],
      ["empty entry", "/x/a::/x/b"], ["trailing colon", "/x/a:"], ["`..` segment", "/x/a:/x/../b"], ["root", "/x/a:/"],
      ["quote", "/x/a:/x/b'c"], ["leading blank", "/x/a: /x/b"], ["duplicate", "/x/a:/x/a"]];
    const parsedBad = badEnv.filter(([, raw]) => parsePiZaiDenyRoots(raw) !== null).map(([what]) => what);
    pin("FLEET_PI_ZAI_DENY_ROOTS parses deterministically: five colon-separated roots round-trip, every malformed form is null",
      JSON.stringify(parsePiZaiDenyRoots(env)) === JSON.stringify(fx.denyRoots) && parsedBad.length === 0,
      `accepted malformed: [${parsedBad.join(", ")}] / parsed=${JSON.stringify(parsePiZaiDenyRoots(env))}`);
    pin("pi-zai builds NO fence without deny roots (null or empty), so pi does not start",
      piZaiFenceProfile({ ...fx, denyRoots: null }) === null && piZaiFenceProfile({ ...fx, denyRoots: [] }) === null,
      "a profile was built without deny roots");
    // HOST-NEUTRAL, the row above only on a host where /Users exists: a root whose FIRST missing
    // ancestor sits at `/` must still yield single-slash subpaths. The resolver joined `/` + `/`
    // + name into `//Users/fx/…`, which the Mac never showed and the workhorse's pins did (4 roots).
    const rootless = `/pi-zai-absent-${process.pid}/fx`;
    const rootlessProf = piZaiFenceProfile({ ...fx, home: rootless, denyRoots: [`${rootless}/deny-a`] }) ?? "";
    pin("pi-zai's deny-root subpaths stay single-slash when the missing chain reaches /",
      rootlessProf.includes(`(subpath "${rootless}/deny-a")`) && !rootlessProf.includes('(subpath "//'),
      (rootlessProf.match(/\(subpath "[^"]*deny-a"\)/) ?? ["no deny-a subpath"])[0]);
    const symlinkFixture = realpathSync(mkdtempSync(`${tmpdir()}/pi-zai-roots-`));
    try {
      mkdirSync(`${symlinkFixture}/home`);
      mkdirSync(`${symlinkFixture}/actual`);
      symlinkSync(`${symlinkFixture}/actual`, `${symlinkFixture}/home/deny-a`);
      const linked = piZaiFenceProfile({ ...fx, home: `${symlinkFixture}/home`, denyRoots: [`${symlinkFixture}/home/deny-a`] }) ?? "";
      pin("pi-zai resolves a deny-root symlink before writing the SBPL subpath",
        linked.includes(`(subpath "${symlinkFixture}/actual")`)
          && !linked.includes(`(subpath "${symlinkFixture}/home/deny-a")`),
        `resolved=${linked.includes(`(subpath "${symlinkFixture}/actual")`)}`);
    } finally { rmSync(symlinkFixture, { recursive: true, force: true }); }
    pin(`${RULE_PZ_FENCE} — a path that could escape SBPL or shell quoting builds NO profile`,
      piZaiFenceProfile({ ...fx, cwd: "/Users/fx/lane'1" }) === null && piZaiFenceProfile({ ...fx, cwd: '/Users/fx/lane"1' }) === null,
      "quote-bearing cwd must yield null");
  }
  // THE LINUX FENCE (bwrap; owner 2026-10-16). The macOS rows above stay as they are; these hold the Linux
  // line beside them. A BEHAVIOUR test: a shell behind the generated argument list tries the T1-T3 reads
  // (owner secrets, another session, a foreign process's environment, the live tmux socket) and the
  // writes the profile refuses; every protected probe is READ by the unfenced control, REFUSED behind the
  // fence, and the pane's work (a file in the worktree, a tool, a git commit on its own branch) still goes
  // through. MUTANTS: no fence, the home added to the allowlist, the tmux dir added - each must show leaks,
  // else the detector measures nothing. Skipped by name where bwrap cannot run.
  {
    const RULE_BW = "pi-zai's Linux fence (bwrap)";
    const bw = await probeBwrapFence();
    if (bw.unavailable) {
      skip(`${RULE_BW} behaviour and mutants`, bw.unavailable);
    } else {
      const leaks = (m: Record<string, boolean>): string[] => BW_PROTECTED.filter((k) => m[k] !== false);
      const broken = (m: Record<string, boolean>): string[] => BW_ALLOWED.filter((k) => m[k] !== true);
      const fmt = (a: string[]): string => (a.length ? a.join(",") : "none");
      pin(`${RULE_BW} control: the unfenced script reaches every probe, so a refusal behind the fence means something`,
        BW_PROTECTED.every((k) => bw.control[k] === true) && BW_ALLOWED.every((k) => bw.control[k] === true),
        `unreached: ${fmt([...BW_PROTECTED, ...BW_ALLOWED].filter((k) => bw.control[k] !== true))}`);
      pin(`${RULE_BW} refuses T1-T3 and the writes: owner secrets, key, fleet.json/.env, home, other worktree, deny root, foreign session, scaffold .env, foreign environ, live tmux socket, main ref, git hook`,
        leaks(bw.fenced).length === 0, `leaks: ${fmt(leaks(bw.fenced))}`);
      pin(`${RULE_BW} lets the pane work: a file in the worktree, a PATH tool, a write in the worktree, the own session dir, a commit on the own branch`,
        broken(bw.fenced).length === 0, `refused: ${fmt(broken(bw.fenced))}`);
      pin(`${RULE_BW} mutant: no fence at all - the probe reports leaks (detector can fail)`,
        leaks(bw.noFence).length === BW_PROTECTED.length, `leaks: ${fmt(leaks(bw.noFence))}`);
      pin(`${RULE_BW} mutant: the home added to the allowlist - the probe reports the home, other worktree and secrets`,
        ["ssh", "zshrc", "otherwt", "fleetjson"].every((k) => leaks(bw.homeOpen).includes(k)), `leaks: ${fmt(leaks(bw.homeOpen))}`);
      pin(`${RULE_BW} mutant: the tmux dir added to the allowlist - the probe reports the live socket`,
        leaks(bw.tmuxOpen).includes("tmuxlive"), `leaks: ${fmt(leaks(bw.tmuxOpen))}`);
      const bad = Object.entries(bw.build).filter(([, ok]) => !ok).map(([k]) => k);
      pin(`${RULE_BW} builder contract: refuses unbuildable input, masks lie after the openings, pid namespace, net shared, root read-only, no home/root bind`,
        bad.length === 0, `failed: ${fmt(bad)}`);
    }
  }
  // automation-eligibility FLIPPED 2026-09-18, coupled to its readiness seam the way codex's is:
  // the Trust prompt keeps `pi` alive, so only the rendered pane can refuse it, and on a suite
  // fleet (FLEET_HARNESS_AUTOMATION=0) a flip without the seam is invisible at runtime. The seam is
  // not only present but RUN here against the measured Pi 0.85.0 frames (140×44, 2026-09-18): the
  // trust tail must block, the ready footer must accept and not block, and the same dialog QUOTED
  // above a live footer — a transcript, not a screen — must not block.
  const pzRe = (field: string): RegExp | null => {
    const m = pzCode.match(new RegExp(`${field}: \\/(.+)\\/([a-z]*),\\n`));
    try { return m ? new RegExp(m[1]!, m[2]) : null; } catch { return null; }
  };
  const pzAccept = pzRe("accept");
  const pzBlock = pzRe("re");
  const pzRule = "─".repeat(140);
  const pzTrustFrame = ["Warning: No project session found with id 'x'; creating a new session with that id.", pzRule, "",
    " Trust project folder?", " /tmp/pz-withpi/work", "",
    " This allows pi to load .pi settings and resources, install missing project packages, and execute project extensions.", "",
    " → Trust", "   Trust parent folder", " (/tmp/pz-withpi)", "   Trust (this session only)", "   Do not trust",
    "   Do not trust (this session only)", "", " ↑↓ navigate  enter select  escape/ctrl+c cancel", "", pzRule,
    ...Array(24).fill("")].join("\n");
  const pzFooter = `/tmp/pz-nopi/work\n0.0%/1.0M (auto)${" ".repeat(104)}glm-5.3-flash • high`;
  const pzReadyFrame = [" Update Available", " New version 0.85.1 is available. Run pi update", pzRule, "", pzRule, pzFooter].join("\n");
  const pzQuotedFrame = [pzTrustFrame.split("\n").slice(3, 18).join("\n"), pzRule, "", pzRule, pzFooter].join("\n");
  pin("pi-zai's readiness seam separates the measured frames: trust tail blocks, footer accepts, a quoted dialog does not block",
    !!pzAccept && !!pzBlock
      && pzBlock.test(pzTrustFrame) && !pzAccept.test(pzTrustFrame)
      && pzAccept.test(pzReadyFrame) && !pzBlock.test(pzReadyFrame)
      && !pzBlock.test(pzQuotedFrame),
    JSON.stringify({ accept: pzAccept?.source ?? null, block: !!pzBlock,
      trust: pzBlock?.test(pzTrustFrame), ready: pzAccept?.test(pzReadyFrame), quoted: pzBlock?.test(pzQuotedFrame) }));
}


{
  const codeLines = server.split("\n").filter((l) => !l.trim().startsWith("//"));
  const settingsJson = codeLines.filter((l) => /settings\.json/.test(l));
  const providerReadAt = server.indexOf("function codexDefaultProviderBound(");
  const providerReadEnd = server.indexOf("\n}\n", providerReadAt);
  const providerRead = providerReadAt >= 0 && providerReadEnd > providerReadAt
    ? server.slice(providerReadAt, providerReadEnd + 3) : "";
  const configToml = server.replace(providerRead, "").split("\n")
    .filter((l) => !l.trim().startsWith("//") && /config\.toml/.test(l));
  pin("Codex provider config inspection is read-only and excludes credential files",
    providerRead.includes('Bun.TOML.parse(readFileSync(path, "utf8"))')
      && !/write|append|truncate|unlink|auth\.json|api_key|console|audit|json\(/i.test(providerRead),
    "bounded TOML reader only");
  pin("Fleet writes no global plugin settings: no code line names ~/.claude/settings.json",
    settingsJson.length === 0, settingsJson.map((l) => l.trim().slice(0, 80)).join(" | "));
  pin("Fleet writes no global Codex configuration: no code line names config.toml",
    configToml.length === 0, configToml.map((l) => l.trim().slice(0, 80)).join(" | ") || "no config.toml line");
  pin("Fleet writes no global plugin settings: enabledPlugins is never named in code",
    !codeLines.some((l) => /enabledPlugins/.test(l)), "");
}




// --- THE OWNER BOARD'S DURABLE FOUNDING MARKER -------------------------------------------------
// The server can answer bootstrap-main with a typed 503 after it has durably written Program.founding.
// This source boundary is the last guard against the Board erasing that fact back to `unbound` and
// offering a second bootstrap. The live suite proves the server transition; these rules execute the
// client's wire decoder/classifier and fasten the DOM/response wiring that no TypeScript type can see.
{
  const RULE_FOUNDING_BOARD = "the Board treats a public durable founding marker as pending recovery, never bootstrap room";
  // head and tail are DIFFERENT symbols, so the body is cut inside the module the function lives
  // in — never from a type in one module to a brace in the next.
  const stateFnSpan = clientU.span("\nexport function programFoundingState(", "\n}\n", 3);
  const stateMod = stateFnSpan ? clientU.module(stateFnSpan.file) : "";
  const stateHeadAt = stateMod.indexOf("type PublicProgramFoundingMode");
  const stateFnAt = stateMod.indexOf("\nexport function programFoundingState(");
  const stateTailAt = stateFnAt < 0 ? -1 : stateMod.indexOf("\n}\n", stateFnAt);
  const stateSource = stateHeadAt < 0 || stateFnAt < stateHeadAt || stateTailAt < stateFnAt ? ""
    : stateMod.slice(stateHeadAt, stateTailAt + 3);

  type FoundingView = { state: string; record?: { v?: number; mode?: string;
    attemptId?: string; target?: { slot?: number; openedAt?: number } } };
  let foundingState: ((value: unknown) => FoundingView) | null = null;
  let foundingStateErr = "";
  if (stateSource !== "") {
    try {
      foundingState = new Function(new Bun.Transpiler({ loader: "ts" }).transformSync(stateSource.replace(/^export /gm, ""))
        + "\nreturn programFoundingState;")() as (value: unknown) => FoundingView;
    } catch (e) { foundingStateErr = e instanceof Error ? e.message : String(e); }
  }

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

  const markSource = clientU.span("\nexport function programMark(p: ProgramInfo)", "\n}\n", 3)?.text ?? "";
  let mark: ((p: Record<string, unknown>) => { mark: string; why: string }) | null = null;
  let markErr = "";
  if (stateSource !== "" && markSource !== "") {
    try {
      const prelude = 'let programsRead = "ok"; let fleet = []; function fmtTs(ts) { return "TS:" + ts; }\n';
      mark = new Function(new Bun.Transpiler({ loader: "ts" }).transformSync(
        prelude + (stateSource + markSource).replace(/^export /gm, "")) + "\nreturn programMark;")();
    } catch (e) { markErr = e instanceof Error ? e.message : String(e); }
  }
  const marks = mark ? { pending: mark({ founding: V2 }), absent: mark({}), malformed: mark({ founding: null }) } : null;
  // Mutation caught: moving the main-absence branch above foundingState recreates the production bug:
  // the same no-main row changes from `founding` to `unbound` and regrows bootstrap controls.
  pin(`${RULE_FOUNDING_BOARD} — classification checks pending/unreadable founding before the no-main unbound branch`,
    !!marks && marks.pending.mark === "founding" && marks.absent.mark === "unbound"
      && marks.malformed.mark === "unknown" && /recovery pending/.test(marks.pending.why),
    markErr || JSON.stringify(marks));


  const failureFnSpan = clientU.span("\nexport function bootstrapFailureMessage(", "\n}\n", 3);
  const failureMod = failureFnSpan ? clientU.module(failureFnSpan.file) : "";
  const failureHeadAt = failureMod.indexOf("interface BootstrapUnavailable");
  const failureFnAt = failureMod.indexOf("\nexport function bootstrapFailureMessage(");
  const failureTailAt = failureFnAt < 0 ? -1 : failureMod.indexOf("\n}\n", failureFnAt);
  const failureSource = failureHeadAt < 0 || failureFnAt < failureHeadAt || failureTailAt < failureFnAt ? ""
    : failureMod.slice(failureHeadAt, failureTailAt + 3);
  let failureMessage: ((status: number, value: unknown) => string) | null = null;
  let failureErr = "";
  if (stateSource !== "" && failureSource !== "") {
    try {
      const prelude = 'function fmtTs(ts) { return "TS:" + ts; }\n';
      failureMessage = new Function(new Bun.Transpiler({ loader: "ts" }).transformSync(
        prelude + (stateSource + failureSource).replace(/^export /gm, "")) + "\nreturn bootstrapFailureMessage;")();
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
    // the shared bundle writer a server-local builder hands its tail to (half two, `delegated`)
    fleetEventBundleText: fleetEventBundleText([{ id: "e1", text: "[fleet] one" }, { id: "e2", text: "[fleet] two" }]),
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
  // THE SELF-TOKEN IS NAMED BARE, WHEREVER IT SITS. The tail rule above is positional on purpose
  // (measured 2026-09-05: a mid-text `$` outside the cursor path submits fine) — but Fleet's own
  // delivery templates name ONE env var, and a `$` before it is the picker's trigger the moment a
  // wrap puts the cursor beside it, so these DERIVED hints carry none at all. Retired form:
  // clarificationWatchMessage ended its reply instruction on `$FLEET_SELF_TOKEN` (note e9e22694).
  const sigiled = (t: string): boolean => t.includes("$FLEET_SELF_TOKEN");
  const badToken = Object.entries(rendered).filter(([, text]) => sigiled(text));
  pin(`${RULE_SIGIL} — rendered: no lane-signals hint sigils the self-token name ($ before FLEET_SELF_TOKEN is the Codex picker trigger)`,
    badToken.length === 0,
    badToken.length
      ? badToken.map(([n]) => n).join("; ")
      : `${Object.keys(rendered).length} rendered hint(s), token named bare`);

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
  // a builder whose LAST return hands the message to an export of src/delivery-format.ts has its
  // tail written there — importable, so it is RENDERED in half one, not read here (2026-10-03: the
  // bundle marks moved there so the chat view reads exactly what the server writes). Derived from
  // that module's export list; a delegate this file forgot to render is `unread`, never a pass.
  const FORMAT_EXPORTS = new Set([...read("src/delivery-format.ts").matchAll(/export function (\w+)\s*\(/g)].map((m) => m[1]!));
  const delegated: string[] = [];
  for (const name of serverLocal) {
    const body = new RegExp(`(?:async )?function ${name}\\([\\s\\S]*?\\n\\}`).exec(serverU.text)?.[0] ?? "";
    if (!body) { unread.push(name); continue; }
    const delegate = [...body.matchAll(/\breturn (\w+)\(/g)].at(-1)?.[1];
    if (delegate && FORMAT_EXPORTS.has(delegate)) {
      if (delegate in rendered) delegated.push(`${name}→${delegate}`); else unread.push(name);
      continue;
    }
    const r = judgeTails(body);
    if (!r.tails) { unread.push(name); continue; }
    for (const lit of r.flagged) badLit.push(`${name}: …${JSON.stringify(lit.slice(-48))}`);
    if (r.unjudgeable) unjudged.push(`${name}×${r.unjudgeable}`);
  }
  // fails as ITSELF: a builder with no readable message tail is NOT a measured builder
  pin(`${RULE_SIGIL} — every server-local derived builder has a readable message tail`,
    unread.length === 0 && serverLocal.length > 0,
    unread.length ? `no tail found: ${unread.join(", ")}`
      : `${serverLocal.length - delegated.length} read, ${delegated.length} rendered: [${serverLocal.join(", ")}] delegated=[${delegated.join(", ")}]`);
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
// ctl.sh — the controller's verb layer
// ================================================================================================
{
  const RULE_CTL = "ctl.sh's verb list, its usage block and docs/controller.md §Werkzeuge are one set";
  const ctl = read("ctl.sh");
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
  let settings: { hooks?: Record<string, HookGroup[]>; enabledPlugins?: Record<string, boolean>; claudeMdExcludes?: string[] } | null = null;
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
  // NO GRAPHIFY HOOK (2026-10-09, row 4be5f0fa): the Bash|Grep hint fired once in one main-checkout
  // session five times, asked for the free-text `query` at the moment the session already knew its
  // symbol, and changed nothing; in a lane it never fired at all. The graph now reaches a lane as the
  // card's NACHBARN line and as a read-only graphify-out/graph.json (server.ts#linkLaneGraph).
  const graphifyHook = cmds("PreToolUse").some((c) => /graphify/.test(c.command ?? ""));
  pin(`${RULE_HOOK} — no PreToolUse hook runs graphify (no search hint, no read guard, no host path)`,
    !graphifyHook && !exists(".claude/hooks/graphify-once.ts") && !read(".claude/settings.json").includes("/Users/"),
    `hook=${graphifyHook}`);
  const plugins = Object.values(settings?.enabledPlugins ?? {});
  pin(`${RULE_HOOK} — project settings disable the measured user plugins`,
    plugins.length > 0 && plugins.every((enabled) => enabled === false),
    `disabled=${plugins.filter((enabled) => enabled === false).length} total=${plugins.length}`);
  // THE GLOBAL RULES ARE CLAUDE'S (row c1c0, owner word 2026-10-09). Every Claude session here —
  // lane, MAIN, orchestrator — loads ~/.claude/CLAUDE.md, so no project exclude may match it: the
  // `**/.claude/CLAUDE.md` glob of 0ceacbca did, and the role sessions fell back to ~/AGENTS.md, the
  // Codex version. The role line (agentCmd) excludes ~/AGENTS.md by name and the checkout's own
  // gitignored .claude/CLAUDE.md by absolute path instead — and the checkout's AGENTS.md too: the
  // user file never closes the AGENTS.md fallback, so without that path MAIN and the orchestrator
  // load the repo's 21 kB natively beside their render. Glob test: a pattern matching
  // `<home>/.claude/CLAUDE.md` for any home — `**`, `*` and `?` widened, the rest literal.
  const userRules = "/Users/someone/.claude/CLAUDE.md";
  const globHits = (pat: string): boolean => new RegExp(`^${pat.split(/(\*\*\/|\*\*|\*|\?)/).map((part) =>
    part === "**/" ? "(?:.*/)?" : part === "**" ? ".*" : part === "*" ? "[^/]*" : part === "?" ? "[^/]"
      : part.replace(/[.+^${}()|[\]\\]/g, "\\$&")).join("")}$`).test(userRules);
  const hiding = (settings?.claudeMdExcludes ?? []).filter(globHits);
  const agentLine = read("server.ts").slice(read("server.ts").indexOf("function agentCmd("));
  pin(`${RULE_HOOK} — no project claudeMdExcludes hides ~/.claude/CLAUDE.md, and the role line excludes ~/AGENTS.md, the checkout's .claude/CLAUDE.md and its AGENTS.md instead`,
    hiding.length === 0
      && agentLine.slice(0, agentLine.indexOf("\n}\n")).includes("claudeMdExcludes: [root, `${import.meta.dir}/.claude/CLAUDE.md`, `${HOME}/AGENTS.md`, `${import.meta.dir}/AGENTS.md`]"),
    `hiding=[${hiding.join(",")}]`);

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
// HANDOFF.md rotation — the archive gets every byte the handoff loses, and nothing else
// ================================================================================================
// tools/handoff-rotate.ts slices HANDOFF.md as bytes: the top `#` section stays, the rest is appended to
// docs/attic/handoff-archiv-<date>.md. Its whole value is that nothing is lost or rewritten, so the
// rule is held on a FIXTURE through the file run, not on the live HANDOFF.md (a lane never touches
// it). The fixture carries the three ways a heading scan goes wrong: `#` inside a ``` fence, `#`
// inside a ~~~~ fence that a ``` line does not close, and `#hashtag` with no space — plus a
// preamble, umlauts (bytes != chars), a CRLF heading and a last line with no newline.
{
  const RULE_ROTATE = "tools/handoff-rotate.ts keeps the top # section and appends the rest byte-exact to the archive";
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
    const run = (...extra: string[]) => spawnSync("bun", [`${ROOT}/tools/handoff-rotate.ts`, "--root", dir, "--date", "2026-01-02", ...extra],
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

  pin("state.sh warns about HANDOFF.md above tools/handoff-rotate.ts#HANDOFF_WARN_KB",
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
// tools/land-log.ts is a view, so the only thing to hold is what it says. The formatter is pure and runs on
// a FIXTURE: two days of main, four lands (a three-commit land, a failed gate with no audit row, a
// no-gate land judged by a covers-less audit row, a note whose mainAfter left main), direct commits
// on both days and one commit before the window. The label that must never drift is the missing
// audit row: it is "laeuft" (queued or running), never a claim that the audit was lost or passed.
{
  const RULE_LANDLOG = "tools/land-log.ts prints one line per land and one direct-commit line per day";
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
  pin("tools/land-log.ts#VERIFY_SKIP_EXIT is server.ts#VERIFY_SKIP_EXIT",
    new RegExp(`^const VERIFY_SKIP_EXIT = ${LAND_LOG_SKIP_EXIT};`, "m").test(server), `land-log says ${LAND_LOG_SKIP_EXIT}`);
}


// ================================================================================================
// NO NUL BYTE IN A TRACKED SOURCE — grep and the context packer both read such a file as BINARY
// ================================================================================================
// Four files carried one raw NUL each (context-snippets.ts, e2e/attention.ts, e2e/helper-portal.ts,
// server.ts; removed 2026-09-18). The cost was silent: `grep` prints "Binary file … matches" or,
// with `-a` absent in a pipeline, NOTHING — a search over server.ts read as "no hit" — and
// context-snippets.ts#buildSourcePack omitted all four as `binary-source`, so no brief could quote
// them. The escape (`\u0000`) compiles to the same string; the raw byte buys nothing.
{
  const ls = spawnSync("git", ["-C", ROOT, "ls-files", "-z", "--", "*.ts"],
    { encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" }, maxBuffer: 16 * 1024 * 1024 });
  const files = ls.status === 0 ? ls.stdout.split("\u0000").filter(Boolean) : [];
  // an empty set would pass every file — the derivation fails as ITSELF
  pin("no tracked .ts file carries a NUL byte — the file set is derived from git, and the derivation ran",
    ls.status === 0 && files.length > 0,
    ls.status === 0 ? `${files.length} tracked .ts file(s)`
      : (ls.error?.message || ls.stderr || `git ls-files exited ${String(ls.status)}`).trim().slice(0, 160));
  const withNul = files.filter((f) => existsSync(`${ROOT}/${f}`) && readFileSync(`${ROOT}/${f}`).includes(0));
  pin("no tracked .ts file carries a NUL byte (write `\\u0000`, never the raw byte)",
    files.length > 0 && withNul.length === 0, withNul.length ? withNul.join(", ") : `${files.length} clean`);
}


// --- the composer sends to the slot its text was written for (seventeenth cut) -----------------
// The misdelivery, replayed: split 7|6, text typed with 7 focused, one click into pane 6, Enter →
// the box addressed slot 6 (POST /send {slot:6}, preview measurement). src/drafts.ts is the fix;
// the replay holds its behaviour; e2e/slots.ts#runComposerTargetDom drives the wiring in a browser.
{
  const book = new DraftBook<string>();
  const empty = { text: "", attached: [] as string[] };
  const on6 = book.swap(7, 100, { text: "for codex", attached: ["drop-7.png"] }, 6, 200);
  pin("drafts: text typed for slot 7 does NOT follow the focus to slot 6 (the box shows 6's own, empty, draft)",
    on6.text === "" && on6.attached.length === 0, JSON.stringify(on6));
  const back7 = book.swap(6, 200, empty, 7, 100);
  pin("drafts: back on slot 7 the parked text and its attachment return",
    back7.text === "for codex" && back7.attached.join() === "drop-7.png", JSON.stringify(back7));
  book.swap(7, 100, { text: "stale", attached: ["old.png"] }, 6, 200);
  const recycled = book.swap(6, 200, empty, 7, 101);
  pin("drafts: a recycled slot number (new openedAt) starts empty and releases the old attachments",
    recycled.text === "" && recycled.dropped.join() === "old.png", JSON.stringify(recycled));
  book.attach(6, 200, "late-6.png");
  const late = book.swap(7, 101, empty, 6, 200);
  pin("drafts: an upload that finishes after the focus moved joins ITS slot's draft, not the box",
    late.attached.join() === "late-6.png", JSON.stringify(late));
}

// --- the draft IN the box is bound to its session too (card "Ein Entwurf geht nie still an eine
// Session, fuer die er nicht geschrieben wurde") ---------------------------------------------------
// The rest of the misdelivery: the FOCUSED slot recycled (new openedAt) while the box held text —
// the target repainted to the new session (src/composer.ts#renderTarget) and Enter sent the text
// there. src/drafts.ts#BoxDraft is the fix; the replay holds its behaviour, and the wiring is
// measured in a browser with /send intercepted: e2e/slots.ts#runComposerTargetDom, section 8.
{
  const box = new BoxDraft();
  box.reset(1000);
  const typed = box.observe(1000, true);
  const recycled = box.observe(5000, true);
  pin("box draft: text typed for openedAt 1000 is the ended session's draft once the slot reads 5000 (send refuses on this answer)",
    typed === false && recycled === true && box.orphan && box.boundTo === 1000, JSON.stringify({ typed, recycled, bound: box.boundTo }));
  const unread = box.observe(undefined, true), again = box.observe(5000, true), back = box.observe(1000, true);
  pin("box draft: an unread row, another poll, even the old value coming back never free it",
    unread && again && back && box.boundTo === 1000, JSON.stringify({ unread, again, back }));
  const cleared = box.observe(5000, false), rebound = box.observe(5000, true);
  pin("box draft: an empty box frees it, and the next text binds to what runs now (5000)",
    !cleared && !rebound && box.boundTo === 5000, JSON.stringify({ cleared, rebound, bound: box.boundTo }));
  box.observe(6000, true);
  box.adopt(undefined);
  const stillHeld = box.orphan;
  box.adopt(6000);
  pin("box draft: übernehmen addresses it to the session running now (6000); an adopt without a read row changes nothing",
    stillHeld && !box.orphan && box.boundTo === 6000 && !box.observe(6000, true), JSON.stringify({ stillHeld, bound: box.boundTo }));
  const late = new BoxDraft();
  late.reset(undefined);
  const firstRead = late.observe(2000, true);
  const emptied = late.observe(0, true);
  pin("box draft: text typed before the row was read binds on the first read; the session ending (0, empty slot) makes it an orphan",
    !firstRead && emptied && late.boundTo === 2000, JSON.stringify({ firstRead, emptied, bound: late.boundTo }));
}

// --- the switches name what the session RUNS, not what its record says (eighteenth cut) ----------
// Measured on preview 8873: slot 1's record said effort "max", its transcript said "high", and the
// switch showed "max". The file's value wins; the record is the fallback; neither → "" ("default").
{
  pin("running: effort — stored max, file high → the switch shows high",
    runningEffort("max", "high") === "high", runningEffort("max", "high"));
  pin("running: effort — a file naming no level falls back to the record, and neither gives \"\" (never a guess)",
    runningEffort("max", null) === "max" && runningEffort(null, null) === "" && runningEffort(undefined, "low") === "low",
    JSON.stringify([runningEffort("max", null), runningEffort(null, null), runningEffort(undefined, "low")]));
  pin("running: model — a file naming ANOTHER model wins; the record's [1m] id stays when the file names the same model without it",
    runningModel("claude-opus-5", "claude-haiku-4-5-20251001") === "claude-haiku-4-5-20251001"
      && runningModel("claude-opus-5[1m]", "claude-opus-5") === "claude-opus-5[1m]"
      && runningModel(null, "gpt-5.5") === "gpt-5.5" && runningModel("glm-5.3", null) === "glm-5.3" && runningModel(null, null) === "",
    JSON.stringify([runningModel("claude-opus-5", "claude-haiku-4-5-20251001"), runningModel("claude-opus-5[1m]", "claude-opus-5")]));
}

// --- ONE precedence rule for "which model is running" (chat-lane finding, 2026-09-19) -------------
// The footer read-back (2a73889a) and the session-file reader (eighteenth cut) grew up as two
// unreconciled answers to the same question. The rule lives in ONE place, src/running.ts:
// session file (per request) > pane footer (30-s tick, push read-back) > slot record.
{
  pin("running: model — the file beats the footer, and the footer beats the record (a footer-first mutation reads \"glm-5.3-air\" here)",
    runningModel("glm-5.3", "glm-5.3-flash", "glm-5.3-air") === "glm-5.3-flash"
      && runningModel("glm-5.3", null, "glm-5.3-air") === "glm-5.3-air"
      && runningModel("glm-5.3", null, null) === "glm-5.3"
      && runningModel(null, null, "x-preview-f-free") === "x-preview-f-free",
    JSON.stringify([runningModel("glm-5.3", "glm-5.3-flash", "glm-5.3-air"), runningModel("glm-5.3", null, "glm-5.3-air")]));
  pin("running: model — the footer obeys the record's [suffix] rule like the file, and a footer-less call keeps the eighteenth-cut semantics",
    runningModel("claude-opus-5[1m]", null, "claude-opus-5") === "claude-opus-5[1m]"
      && runningModel("glm-5.3", "glm-5.3-flash") === "glm-5.3-flash"
      && runningModel("claude-opus-5[1m]", "claude-opus-5") === "claude-opus-5[1m]",
    JSON.stringify([runningModel("claude-opus-5[1m]", null, "claude-opus-5"), runningModel("glm-5.3", "glm-5.3-flash")]));
}

// owner 14.10.: the model choice showed „[Zitat entfernt]“ — „[Zitat entfernt]“, whose window is 1M
pin("model register: Haiku 5.5 is current at 1M, Haiku 4.5 is superseded by it, the card role and the short forms point at 5.5",
  modelEntry("claude", "claude-haiku-5-5")?.status === "current"
    && modelEntry("claude", "claude-haiku-4-5-20251001")?.status === "superseded"
    && modelEntry("claude", "claude-haiku-4-5-20251001")?.supersededBy === "claude-haiku-5-5"
    && MODEL_DEFAULTS.card.id === "claude-haiku-5-5"
    && ["haiku", "haiku 5.5", "claude haiku 5.5"].every((k) => MODEL_ALIASES[k] === "claude-haiku-5-5")
    && modelLabel("claude-haiku-5-5") === "Haiku 5.5 · 1M" && modelLabel("claude-haiku-4-5-20251001") === "Haiku 4.5 · 200K",
  JSON.stringify([modelEntry("claude", "claude-haiku-5-5"), modelEntry("claude", "claude-haiku-4-5-20251001"), MODEL_DEFAULTS.card,
    MODEL_ALIASES.haiku, modelLabel("claude-haiku-5-5"), modelLabel("claude-haiku-4-5-20251001")]));

// The register is the only current inventory. Sources prove implementation or observation;
// a native loader observation and an undelivered reader are not Fleet delivery claims.
{
  const roles = ["lane", "main", "orchestratorin", "nur-ordner"] as const;
  const escaped = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const scanner = new Bun.Transpiler({ loader: "ts" });
  const declares = (text: string, anchor: string): boolean => {
    let probe = "__fleet_session_source_probe__";
    while (text.includes(probe)) probe += "_";
    // Only a real module declaration becomes this export. Renaming text inside comments,
    // strings, templates or regex literals cannot make the parser report the probe as code.
    const candidate = text.replace(new RegExp(`(?:export\\s+)?(async\\s+)?(function|const|class)\\s+${escaped(anchor)}\\b`, "g"),
      (_match, async: string | undefined, kind: string) => `export ${async ?? ""}${kind} ${probe}`);
    try { return scanner.scan(candidate).exports.includes(probe); }
    catch { return false; }
  };
  const resolves = (ref: string): boolean => {
    const [path, anchor] = ref.split("#");
    if (!path || !anchor || !exists(path)) return false;
    const text = read(path);
    if (path.endsWith(".md")) return new RegExp(`^#{1,6} ${escaped(anchor)}\\s*$`, "m").test(text);
    return declares(text, anchor);
  };
  const problemsFor = (block: SessionBlock): string[] => {
    const problems: string[] = [];
    for (const key of ["id", "wort", "satz", "schicht", "breaksWithout"] as const)
      if (!block[key].trim()) problems.push(`${key} empty`);
    if (/[\n\r…]|\.{3}/.test(block.satz)) problems.push("satz abbreviated or multiline");
    if (block.funktion.length === 0 || block.funktion.some((value) =>
      !["vertrag", "auftrag", "rueckweg", "beweis", "orientierung", "gedaechtnis-zeiger"].includes(value)))
      problems.push("funktion invalid");
    if (block.grenze.art === "noetig" && !block.grenze.grund.trim()) problems.push("grenze lacks reason");
    if (block.harness.art === "eingeschraenkt"
      && (!block.harness.grund.trim() || block.harness.werte.length === 0)) problems.push("harness lacks scope/reason");
    if (block.autor.length === 0 || block.lieferart.length === 0) problems.push("autor/lieferart empty");
    if (Object.keys(block.rollenDefault).sort().join() !== [...roles].sort().join()) problems.push("role keys differ");
    for (const role of roles) {
      const value = block.rollenDefault[role];
      if (typeof value === "object" ? value.zustand !== "bedingt" || !value.grund.trim()
        : value !== "an" && value !== "aus") problems.push(`${role} default invalid`);
    }
    if (block.bytes !== "unknown" || block.fassung !== "unknown") problems.push("unmeasured delivery bytes/version");
    if (block.belege.length === 0 || block.belege.some((ref) => !resolves(ref))) problems.push("evidence unresolved");
    if (block.source !== "nicht zugestellt" && (!block.belege.includes(block.source) || !resolves(block.source)))
      problems.push("source unresolved or not evidenced");
    return problems;
  };
  const declared = SESSION_BLOCKS.map((block) => block.id);
  pin("S3 session blocks: the register names each block once",
    declared.length > 0 && new Set(declared).size === declared.length, declared.join(", "));
  for (const block of SESSION_BLOCKS) {
    const problems = problemsFor(block);
    pin(`S3 session blocks: ${block.id} has complete metadata and a source in this tree`,
      problems.length === 0, problems.join("; "));
  }
  const contract = SESSION_BLOCKS.find((block) => block.id === "portable-contract")!;
  pin("S3 session blocks: an unresolved source is rejected",
    !resolves("server.ts#session-blocks-does-not-exist")
      && problemsFor({ ...contract, source: "server.ts#session-blocks-does-not-exist" }).includes("source unresolved or not evidenced"));
  pin("S3 session blocks: a required boundary without a reason is rejected",
    problemsFor({ ...contract, grenze: { art: "noetig", grund: "" } }).includes("grenze lacks reason"));
  pin("S3 session blocks: abbreviated subtitles are rejected",
    problemsFor({ ...contract, satz: "Der Vertrag…" }).includes("satz abbreviated or multiline"));
  const state = (block: SessionBlock, role: typeof roles[number]): string => {
    const value = block.rollenDefault[role];
    return typeof value === "object" ? value.zustand : value;
  };
  const folder = SESSION_BLOCKS.filter((block) => state(block, "nur-ordner") !== "aus").map((block) => block.id).sort();
  pin("S3 session blocks: Nur Ordner receives only native agents and auto-memory",
    folder.join() === "auto-memory,native-agents", folder.join());
  const heft = SESSION_BLOCKS.find((block) => block.id === "owner-heft");
  pin("S3 session blocks: the required owner heft names its startup reader pointer",
    heft?.grenze.art === "noetig" && heft.source === "server.ts#ownerKorrekturenPointer"
      && heft.lieferart.includes("Prompt") && heft.lieferart.includes("Abruf")
      && heft.lieferart.includes("native Datei")
      && heft.rollenDefault["nur-ordner"] === "aus"
      && ["lane", "main", "orchestratorin"].every((role) => heft.rollenDefault[role as typeof roles[number]] === "an"));
  pin("S3 session blocks: concept is optional and source pointers/code are separate",
    SESSION_BLOCKS.find((block) => block.id === "konzept")?.grenze.art === "frei"
      && SESSION_BLOCKS.find((block) => block.id === "source-pointers")?.rollenDefault.lane === "an"
      && SESSION_BLOCKS.find((block) => block.id === "source-code")?.rollenDefault.lane === "aus"
      && !declared.includes("source-excerpts"));
  for (const [id, role] of [["task-brief", "lane"], ["main-rail", "main"], ["orchestrator-card", "orchestratorin"]] as const) {
    const block = SESSION_BLOCKS.find((entry) => entry.id === id);
    pin(`S3 session blocks: ${role} Auftrag has the matching role default`,
      !!block && block.funktion.includes("auftrag") && roles.every((other) => state(block, other) === (other === role ? "an" : "aus")));
  }
  const tracked = spawnSync("git", ["ls-files", "*.ts", "*.tsx"], { encoding: "utf8" });
  const readers = tracked.stdout.trim().split("\n").filter((path) => path !== "e2e/pins.ts" && exists(path)
    && /(?:from\s*|import\s*\(|require\s*\()\s*["'][^"']*session-blocks["']/.test(read(path)));
  // THE REGISTER IS READ through ONE answer (Owner-Ja F1, 07.10.; faafc637 09.10.): server.ts
  // resolves it in foundingPlanAnswer, which GET /api/founding-plan and the spawn doors' plan check
  // (acceptFoundingPlan) both call — so a start compares against the window's own answer, never a second.
  // The start check calls it twice: once with the caller's switches, once without them when they no
  // longer fit the moved plan (the 409 carries that plan) — still the one answer, never a second resolver.
  const serverSrc = read("server.ts");
  const routeAt = serverSrc.indexOf('url.pathname === "/api/founding-plan" && req.method === "GET"');
  const routeEnd = routeAt < 0 ? -1 : serverSrc.indexOf("\n    }\n", routeAt);
  const planCalls = [...serverSrc.matchAll(/\bfoundingSessionPlan\(/g)].map((m) => m.index!);
  const planDef = serverSrc.indexOf("async function foundingSessionPlan(");
  const answerDef = serverSrc.indexOf("async function foundingPlanAnswer(");
  const answerEnd = answerDef < 0 ? -1 : serverSrc.indexOf("\n}\n", answerDef);
  const acceptDef = serverSrc.indexOf("async function acceptFoundingPlan(");
  const acceptEnd = acceptDef < 0 ? -1 : serverSrc.indexOf("\n}\n", acceptDef);
  const answerCalls = [...serverSrc.matchAll(/\bfoundingPlanAnswer\(/g)].map((m) => m.index!)
    .filter((at) => at !== answerDef + "async function ".length);
  // Two more read it without resolving a plan (S14, the five questions): server/claude-code-anatomie.ts takes each
  // part's question (session-blocks.ts#anatomieFrage), and a unit test (*.test.ts) proves the register's behaviour.
  const ANATOMIE = "server/claude-code-anatomie.ts";
  const resolvers = readers.filter((path) => !path.endsWith(".test.ts") && path !== ANATOMIE);
  pin("S3 session blocks: server.ts is the only resolving reader, and only the one plan answer (route + start check) resolves the register",
    tracked.status === 0 && resolvers.join() === "server.ts" && !(exists(ANATOMIE) && read(ANATOMIE).includes("resolveSessionPlan"))
      && !serverSrc.includes("defaultOn")
      && [...serverSrc.matchAll(/\bresolveSessionPlan\(/g)].length === 1 && serverSrc.indexOf("resolveSessionPlan(") > planDef
      && planCalls.length === 2 && planCalls.includes(planDef + "async function ".length)
      && planCalls.every((at) => at === planDef + "async function ".length || (at > answerDef && at < answerEnd))
      && answerCalls.length === 3 && answerCalls.filter((at) => at > routeAt && at < routeEnd).length === 1
      && answerCalls.every((at) => (at > routeAt && at < routeEnd) || (at > acceptDef && at < acceptEnd)),
    `readers=${readers.join(", ")}; foundingSessionPlan sites=${planCalls.length}; foundingPlanAnswer calls=${answerCalls.length}; route=${routeAt}..${routeEnd}`);

  // WHAT CLAUDE CODE BRINGS ITSELF (session-blocks.ts#CLAUDE_CODE_ZEILEN, Charge 5): no Baustein, so no
  // plan row — but every row names code or a measurement that is in this tree, and a measured start
  // number belongs to exactly the tool list server.ts#SESSION_TOOLS gives its role today.
  pin("S3 claude code: every row and the byte ratio name a source in this tree, and no row is a plan Baustein",
    CLAUDE_CODE_ZEILEN.length > 0 && CLAUDE_CODE_ZEILEN.every((z) => z.wort.trim() && z.satz.trim() && !/[\n\r…]/.test(z.satz) && resolves(z.quelle))
      && resolves(FLEET_BYTES_JE_TOKEN.quelle) && FLEET_BYTES_JE_TOKEN.wert > 0
      && !CLAUDE_CODE_ZEILEN.some((z) => declared.includes(z.id)),
    CLAUDE_CODE_ZEILEN.filter((z) => !resolves(z.quelle)).map((z) => z.quelle).join(", "));
  const toolsBlock = /const SESSION_TOOLS[^=]*= \{([\s\S]*?)\n\};/.exec(serverSrc)?.[1] ?? "";
  const toolsOf = (role: string): string[] | null => {
    const m = new RegExp(`\\b${role}: \\[([^\\]]*)\\]`).exec(toolsBlock);
    return m ? [...m[1]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]!) : null;
  };
  const stale = (["lane", "main", "orchestrator", "generic"] as const).filter((role) =>
    (CLAUDE_CODE_MESSUNG[role].werkzeuge ?? []).join() !== (role === "generic" ? [] : toolsOf(role) ?? ["<missing>"]).join()
      || (role === "generic") !== (CLAUDE_CODE_MESSUNG[role].werkzeuge === null)
      || !(CLAUDE_CODE_MESSUNG[role].tokens > 0) || Number.isNaN(Date.parse(CLAUDE_CODE_MESSUNG[role].am)));
  pin("S3 claude code: each measured start ran with its role's SESSION_TOOLS list (generic: none) — re-measure when the list moves",
    toolsBlock !== "" && stale.length === 0, stale.join(", "));

  // THE PLAN RESOLVER, pure: the same inputs give the same plan-hash, a switch moves it, and every
  // refusal names its rule. Measured bytes come from the caller; unknown stays unknown.
  const planInput = (rolle: SessionRole, harness: string, schalter: Record<string, string> = {}): SessionPlanInput => ({
    rolle, ort: { art: rolle === "lane" ? "worktree" : rolle === "nur-ordner" ? "ordner" : "repo", pfad: "/repo", branch: "main", head: "a".repeat(40) },
    harness, modell: null, effort: "high",
    woerter: { harness: harness === "codex" ? "Codex" : "Claude", modell: null, effort: "hoch", ort: "neuer Worktree aus main" },
    packs: [
      { packId: "portable-core", vorlage: "founding-packs", ausgelassen: null, harnesses: null,
        ...(harness === "codex" ? { erzwungen: "traegt den Vertrag" } : {}) },
      { packId: "verify-e2e", vorlage: "founding-packs", ausgelassen: null, harnesses: null },
      { packId: "konzept-x", vorlage: "konzept", ausgelassen: harness === "codex" ? null : "harness-unsupported", harnesses: ["codex"] },
    ],
    bedingungen: { "auto-memory": true, "commit-expectation": true, "private-rulebook": true }, schalter,
  });
  const measure = (): SessionPlanMessung => ({ bytes: { "lane-footer": 100, "role-card": 50, "context-anchors": 400,
    "pack:portable-core": 300, "pack:verify-e2e": 80, "native-agents": 1000, "auto-memory": 2000, "commit-expectation": "unknown" },
    enthaltenIn: { "commit-expectation": "lane-footer", "pack:portable-core": "context-anchors", "pack:verify-e2e": "context-anchors" } });
  const planOf = (input: SessionPlanInput) => resolveSessionPlan(input, measure);
  const errorOf = (input: SessionPlanInput): string => { const r = planOf(input); return r.ok ? "" : r.error; };
  const lane = planOf(planInput("lane", "claude"));
  const laneAgain = planOf(planInput("lane", "claude"));
  const laneSwitched = planOf(planInput("lane", "claude", { "source-code": "an" }));
  const laneRow = (id: string) => lane.ok ? lane.plan.bausteine.find((b) => b.id === id) : undefined;
  pin("S3 plan: the same inputs give the same plan-hash, one switch gives another",
    lane.ok && laneAgain.ok && laneSwitched.ok && lane.plan.planHash === laneAgain.plan.planHash
      && /^[0-9a-f]{64}$/.test(lane.plan.planHash) && laneSwitched.plan.planHash !== lane.plan.planHash
      && laneSwitched.plan.bausteine.find((b) => b.id === "source-code")?.quelle === "schalter",
    lane.ok ? lane.plan.planHash : lane.error);
  pin("S3 plan: the sentence is one line from role, triple and place",
    lane.ok && lane.plan.planSatz === "Lane · Claude · hoch · neuer Worktree aus main", lane.ok ? lane.plan.planSatz : "");
  pin("S3 plan: every row carries word, sentence, boundary, state, role default, harness verdict, bytes and candidates",
    lane.ok && lane.plan.bausteine.every((b) => b.wort && b.satz && b.grenze && ["an", "aus"].includes(b.zustand)
      && b.rollenDefault !== undefined && typeof b.harness.gueltig === "boolean"
      && (typeof b.bytes === "number" || b.bytes === "unknown") && Array.isArray(b.ersatzKandidaten))
      && !lane.plan.bausteine.some((b) => b.id === "founding-packs" || b.id === "konzept"));
  pin("S3 plan: bytes before the task count measured rows once and NAME the unknown ones — never 0 for unknown",
    // auto-memory's 2000 are not counted: a lane starts without it (register default aus, agentCmd)
    lane.ok && lane.plan.bytesVorAuftrag.bytes === 100 + 50 + 400 + 1000 && laneRow("auto-memory")?.zustand === "aus"
      && lane.plan.bytesVorAuftrag.unknown.includes("source-pointers") && lane.plan.bytesVorAuftrag.unknown.includes("portable-contract")
      && !lane.plan.bytesVorAuftrag.unknown.includes("commit-expectation") && lane.plan.bytesVorAuftrag.auftrag.join() === "task-brief"
      && laneRow("task-brief")?.bytes === "unknown",
    lane.ok ? JSON.stringify(lane.plan.bytesVorAuftrag) : "");
  pin("S3 plan: a harness-limited row is off with its reason, and switching it on is refused",
    laneRow("pack:konzept-x")?.harness.gueltig === false && laneRow("pack:konzept-x")?.zustand === "aus"
      && errorOf(planInput("lane", "codex", { "private-rulebook": "an" })).includes("gilt nicht fuer codex"));
  pin("S3 plan: a required row cannot be switched off, a locked one cannot be replaced, a stranger cannot replace",
    errorOf(planInput("lane", "claude", { "lane-footer": "aus" })).includes("ist noetig")
      && errorOf(planInput("lane", "claude", { "owner-heft": "ersetzt:portable-contract" })).includes("ist gesperrt")
      && errorOf(planInput("lane", "claude", { "lane-footer": "ersetzt:memory-pointer" })).includes("traegt nicht die Funktion")
      && laneRow("lane-footer")?.ersatzKandidaten.includes("self-credential") === true
      && laneRow("owner-heft")?.ersatzKandidaten.length === 0);
  const replaced = planOf(planInput("lane", "claude", { "lane-footer": "ersetzt:self-credential" }));
  pin("S3 plan: an equal-function replacement is a state of its own and moves the hash",
    replaced.ok && lane.ok && replaced.plan.bausteine.find((b) => b.id === "lane-footer")?.zustand === "ersetzt:self-credential"
      && replaced.plan.planHash !== lane.plan.planHash, replaced.ok ? "" : replaced.error);
  pin("S3 plan: native rows are shown, not switched; a carried contract pack stays on",
    errorOf(planInput("main", "claude", { "auto-memory": "aus" })).includes("kein Schalter")
      && errorOf(planInput("lane", "codex", { "pack:portable-core": "aus" })).includes("traegt den Vertrag")
      && errorOf(planInput("lane", "claude", { "konzept": "an" })).includes("is a template"));
  const folderPlan = planOf(planInput("nur-ordner", "claude"));
  pin("S3 plan: Nur Ordner delivers only native-agents and auto-memory, with their bytes",
    folderPlan.ok && folderPlan.plan.bausteine.filter((b) => b.zustand !== "aus").map((b) => b.id).sort().join() === "auto-memory,native-agents"
      && folderPlan.plan.bytesVorAuftrag.bytes === 3000 && folderPlan.plan.bytesVorAuftrag.unknown.length === 0
      && errorOf(planInput("nur-ordner", "claude", { "memory-pointer": "an" })).includes("Nur Ordner liefert nur"),
    folderPlan.ok ? JSON.stringify(folderPlan.plan.bytesVorAuftrag) : folderPlan.error);
  const anchorsOff = planOf(planInput("lane", "claude", { "context-anchors": "aus" }));
  pin("S3 plan: packs deliver only through the reading pointers",
    anchorsOff.ok && anchorsOff.plan.bausteine.filter((b) => b.id.startsWith("pack:")).every((b) => b.zustand === "aus")
      && errorOf(planInput("lane", "claude", { "context-anchors": "aus", "pack:verify-e2e": "an" })).includes("context-anchors"));
}

console.log(rows.join("\n"));
if (sourceFailed) console.log(`\n${sourceFailed} SOURCE-CHECKOUT FINDING(S) — not this tree's, not counted (rows SRC-FAIL above)`);
console.log(failed ? `\n${failed} FAILURES` : "\nALL PASS");
process.exit(failed ? 1 : 0);
