// ctl.sh — the controller's mechanical verbs, measured against a live isolated instance.
//
// WHAT THIS MODULE IS FOR. ctl.sh adds no capability: every verb rides a route that already exists.
// What it does add is a LAYER THAT CAN BE WRONG about a route it did not change — a body field named
// `slot` where the route reads `target`, a short sha where the route wants a full object id, a
// rejection paraphrased into something that reads like success. Those are exactly the mistakes the
// script was written to stop a session from making, so they are what is asserted here: every check
// compares the script's own `--json` against the API or the state file it claims to be reporting,
// and every WRITE verb also has a check that its refusal is a refusal (non-zero exit AND the reason).
//
// WHERE THE SCRIPT COMES FROM. The instance CARRIES the script it exercises: e2e-isolated.sh names
// ctl.sh in $STAGE_EXTRA, the one staging channel for an asset that is read by PATH and that no
// import scan can see. The pointer home (`node_modules` → SRC), which is how this probe used to
// reach it, is only the FALLBACK now — it resolves through `rev-parse --is-inside-work-tree`, and
// the post-land audit's source is a `git archive` extract with NO `.git`
// (server.ts#snapshotIntegrationTree builds a git context only for the proportional short chain).
// So the setup check below read `src=unresolved` and failed in every LOCALLY run full audit while
// passing on the helper, whose source is a real clone. Measured 2026-09-08 in the tree:null trail
// ($TMPDIR/fleet-e2e-trail, where a local audit's rows land precisely BECAUSE no tree resolves):
// both runs since this module landed carry exactly ONE failing row out of 3973 and 3945, and it is
// this line, `detail: "src=unresolved ctl=-"`. The four rows in the repo-side trail — lanes, where
// the pointer home is a work tree — are all green. That the helper's run of the same tip passes it
// is REPORTED, not measured here: post-land-audits.jsonl truncates `out` at ~4 KB, so its row for
// mainSha 51565db4 proves only remote=second-host and 2 failures, neither named in the kept text.
// It is the same trap that had e2e/land-durability.ts §F red in every full audit from b224ef8 on,
// and the same fix.
// Wherever it is found, the script is pointed at this instance through FLEET_CTL_URL /
// FLEET_CTL_TOKEN / FLEET_CTL_HOME. Those three env overrides exist for exactly this, and their
// absence is what a real controller runs with.
import { spawnSync } from "node:child_process";
import { accessSync, constants, existsSync, mkdirSync, readFileSync, readlinkSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { BASE, REPO, ROOT, TOKEN, check, get, post, results } from "./harness";
import { openLane, setMergeMode, settleForMerge, waitMerge } from "./lane-helpers";
import { gitWorkTreeVerdict, probeSourceTree, type SourceTreeProbe } from "./trail-emit";

interface CtlRun { code: number; out: string; err: string; json: unknown }

const gitOut = (dir: string, ...a: string[]): string =>
  (spawnSync("git", ["-C", dir, ...a], { encoding: "utf8" }).stdout ?? "").trim();

const sourceTree = (): SourceTreeProbe => {
  let linked: string | null = null;
  try { linked = readlinkSync(`${ROOT}/node_modules`); } catch { /* direct checkout */ }
  // the same probe the trail resolves its own tree with, and for the same reason it grew a third
  // answer: "this is not a work tree" (the audit's `git archive` snapshot, correctly described)
  // and "git could not be asked" are different facts, and only the second accuses the environment.
  return probeSourceTree(ROOT, linked, gitWorkTreeVerdict);
};

// THE SKIP MUST BE COUNTED. This module returns early after a failed setup line, and until now
// that left every check below neither green nor red but ABSENT: the post-land audits at
// 1788843000681 and 1788821143810 each reported exactly ONE failure while running 3973 checks
// against a neighbouring green run's 4018 — a 45-check hole nothing on the ledger named. The count
// is read from this module's OWN source rather than kept as a constant, because a constant rots on
// the next check added and the number is the entire point of the line. Call SITES, said as such:
// every check here is straight-line today, so sites equal calls, and a check placed inside a loop
// would make this a floor rather than an equality.
const CHECK_SITES = ((): number => {
  try { return (readFileSync(import.meta.path, "utf8").match(/^\s*(?:await\s+)?check\(/gm) ?? []).length; }
  catch { return 0; }
})();

const unreached = (from: number, why: string): void => {
  // `results.length` is read BEFORE this check pushes its own row, and the line below is itself one
  // of the counted sites — hence the -1. An unreadable source says so instead of guessing a number.
  const emitted = results.length - from;
  const missing = CHECK_SITES > 0 ? `${CHECK_SITES - emitted - 1} of ${CHECK_SITES}` : "an unknown number of";
  check("ctl: the verb checks below this module's setup were reached", false,
    `${missing} check() call sites in e2e/ctl.ts did NOT run — ${why}`);
};

// …and the script itself, in the order the two answers are actually reliable: the instance's own
// staged copy first (true in a direct checkout too, where ROOT *is* the tree under test), the
// pointer home second, so an instance staged by something that predates $STAGE_EXTRA still
// resolves instead of accusing the script. `X_OK`, not mere existence: the check below says
// "executable", and a copy that lost its mode bit must fail as the SETUP it is, not forty lines
// later as an EACCES inside a verb nobody broke.
const executable = (p: string): boolean => {
  try { accessSync(p, constants.X_OK); return true; } catch { return false; }
};

export interface CtlHome {
  /** every path that could hold the script, in preference order */
  candidates: string[];
  /** those that exist */
  present: string[];
  /** the first present one that is also executable — what the verbs below actually run */
  ctl: string | null;
}

// The resolution, split off the filesystem so its three failure cases can be asserted without
// building three instances. `present.find(executable)` and not `candidates.find(…)`: an instance
// copy that exists but lost its mode bit must not silently shadow a good copy in the source tree,
// and it must still be NAMED — which is why `present` is carried rather than folded into `ctl`.
export const resolveCtl = (
  root: string,
  sourceTree: string | null,
  exists: (p: string) => boolean,
  isExecutable: (p: string) => boolean,
): CtlHome => {
  const candidates = [`${root}/ctl.sh`, sourceTree === null ? null : `${sourceTree}/ctl.sh`]
    .filter((p): p is string => p !== null);
  const present = candidates.filter(exists);
  return { candidates, present, ctl: present.find(isExecutable) ?? null };
};

const stateFile = (): Record<string, unknown> =>
  JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as Record<string, unknown>;

// a slot's own scoped credential, out of the persisted state — polled for the shape, because
// openSlot queues the save before it awaits the pane spawn (the idiom land-durability.ts states).
const selfTokenOf = async (slot: number): Promise<string> => {
  let seen = "";
  for (let i = 0; i < 60; i++) {
    try {
      seen = (stateFile().slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken ?? "";
    } catch { /* mid-write */ }
    if (/^[0-9a-f]{32}$/.test(seen)) return seen;
    await Bun.sleep(50);
  }
  return seen;
};

export async function run(): Promise<void> {
  const entered = results.length;
  const src = sourceTree();
  const srcNote = src.tree ?? `unresolved (via=${src.via} candidate=${src.candidate} why=${src.why})`;
  const instanceCopy = `${ROOT}/ctl.sh`;
  const home = resolveCtl(ROOT, src.tree, existsSync, executable);
  const CTL = home.ctl;

  // the resolution itself, on the pure function and BEFORE the three environment lines below, so
  // the cases those lines report are proven reachable on every run rather than only on the run
  // that happens to be broken.
  const noHome = resolveCtl("/inst", null, () => false, () => false);
  const srcOnly = resolveCtl("/inst", "/src", (p) => p === "/src/ctl.sh", () => true);
  const modeBitLost = resolveCtl("/inst", "/src", () => true, (p) => p === "/src/ctl.sh");
  check("ctl setup: the resolution keeps 'no file', 'only the source tree has it' and 'present but not executable' apart",
    noHome.present.length === 0 && noHome.ctl === null && noHome.candidates.length === 1
      && srcOnly.present.join() === "/src/ctl.sh" && srcOnly.ctl === "/src/ctl.sh"
      && modeBitLost.present.join() === "/inst/ctl.sh,/src/ctl.sh" && modeBitLost.ctl === "/src/ctl.sh",
    `noHome=${JSON.stringify(noHome)} srcOnly=${JSON.stringify(srcOnly)} modeBitLost=${JSON.stringify(modeBitLost)}`);

  // THE PROBE FAILS AS ITSELF, AND IN THREE PIECES. A missing script must not be reported as a
  // broken verb — every check below would then accuse ctl.sh of behaviour nobody measured
  // (CLAUDE.md, "eine Sonde, die nicht laufen konnte, muss als SIE SELBST scheitern"). One line for
  // all of it was not enough: `src=unresolved ctl=-` and `ctl.sh lost its mode bit` are different
  // repairs by different people, and the FIRST of them is not even a defect — since STAGE_EXTRA the
  // instance carries its own copy, so an unresolved source tree only matters when that copy is
  // absent. Each case therefore gets the line it needs, and each can fail on its own.
  check("ctl setup: a home for ctl.sh is reachable — the instance's own copy, else a resolved source tree",
    existsSync(instanceCopy) || src.tree !== null,
    `instance=${instanceCopy} exists=${existsSync(instanceCopy)} sourceTree=${srcNote}`);
  check("ctl setup: one of those homes contains ctl.sh",
    home.present.length > 0, `present=[${home.present.join(", ")}] looked=[${home.candidates.join(", ")}]`);
  check("ctl setup: the ctl.sh that answers is executable",
    CTL !== null,
    home.present.length === 0
      ? `NOT MEASURED — no ctl.sh exists at any candidate path (sourceTree=${srcNote})`
      : `ctl=${CTL ?? `${home.present.join(", ")} — present, but no execute bit`}`);
  if (CTL === null) { unreached(entered, `no executable ctl.sh (sourceTree=${srcNote})`); return; }

  // the receiver: an ordinary non-lane session, which is what a controller IS. It owns the self
  // token every self verb below runs with.
  const free = ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
    .slots.find((s) => s.cwd === null)?.id ?? 0;
  const opened = free ? await post(`/api/slots/${free}/open`, { cwd: REPO }) : null;
  check("ctl setup: a non-lane receiver session is open", !!opened?.ok, `slot ${free} ${opened?.status}`);
  if (!free || !opened?.ok) { unreached(entered, `no receiver session (slot ${free}, ${opened?.status})`); return; }
  const selfTok = await selfTokenOf(free);
  check("ctl setup: the receiver's self token is persisted", /^[0-9a-f]{32}$/.test(selfTok),
    `${selfTok.length} chars`);
  if (!/^[0-9a-f]{32}$/.test(selfTok)) { unreached(entered, "the receiver's self token never appeared"); return; }

  const LOCK = `${ROOT}/ctl-lock-probe`;   // NEVER /tmp/fleet-e2e.lock — a probe owns its own lock
  const env = {
    FLEET_CTL_URL: BASE,
    FLEET_CTL_TOKEN: TOKEN,
    FLEET_CTL_HOME: ROOT,
    FLEET_SELF_TOKEN: selfTok,
    FLEET_SELF_SLOT: String(free),
    FLEET_CTL_POLL_SEC: "1",
    FLEET_CTL_WAIT_MAX_SEC: "120",
    FLEET_SUITE_LOCK: LOCK,
  };
  const ctl = async (args: string[], extra: Record<string, string> = {}): Promise<CtlRun> => {
    const p = Bun.spawn([CTL, ...args], {
      // run it where it lives, whichever of the two answers resolved it. ctl.sh reads nothing
      // relative to cwd (it locates its home through FLEET_CTL_HOME, set below), so this is
      // orientation, not a dependency.
      cwd: dirname(CTL), stdout: "pipe", stderr: "pipe",
      env: { ...process.env, ...env, ...extra } as Record<string, string>,
    });
    const out = await new Response(p.stdout).text();
    const err = await new Response(p.stderr).text();
    const code = await p.exited;
    let json: unknown = null;
    if (args.includes("--json")) { try { json = JSON.parse(out); } catch { json = null; } }
    return { code, out, err, json };
  };

  // …and the same invocation left RUNNING. The two wait verbs answer only when they stop, so the
  // state they are supposed to notice has to be produced while they are still inside the poll loop.
  // Pipes are read to completion before `exited` is awaited, so a verb that prints before it exits
  // cannot deadlock this.
  const ctlBg = (args: string[], extra: Record<string, string> = {}): Promise<CtlRun> => {
    const p = Bun.spawn([CTL, ...args], {
      cwd: dirname(CTL), stdout: "pipe", stderr: "pipe",
      env: { ...process.env, ...env, ...extra } as Record<string, string>,
    });
    return (async (): Promise<CtlRun> => {
      const out = await new Response(p.stdout).text();
      const err = await new Response(p.stderr).text();
      const code = await p.exited;
      let json: unknown = null;
      if (args.includes("--json")) { try { json = JSON.parse(out); } catch { json = null; } }
      return { code, out, err, json };
    })();
  };

  // === usage ====================================================================================
  // The verb list is what e2e/pins.ts holds against docs/controller.md, so the usage block has to
  // actually carry it — a pin over a list nothing prints would guard a doc against nothing.
  const usage = await ctl([]);
  const VERBS = ["get", "merges", "lock", "ctx", "report", "audits", "watch", "events", "land", "dispatch",
    "wait merge", "wait change", "send", "commit main"];
  const missing = VERBS.filter((v) => !usage.out.includes(`  ${v}`));
  check("ctl usage: a bare ./ctl.sh prints all fourteen verbs and exits 0",
    usage.code === 0 && missing.length === 0, `exit ${usage.code} missing=[${missing.join(", ")}]`);
  const bogus = await ctl(["nosuchverb"]);
  check("ctl usage: an unknown verb exits 2 and names itself",
    bogus.code === 2 && bogus.err.includes('unknown verb "nosuchverb"'), `exit ${bogus.code}`);

  // === get ======================================================================================
  // The one verb that renders nothing: it turns the CREDENTIAL into a door. So what is asserted is
  // the credential split (both directions), the two named refusals, and that no output of any run
  // carries a token — the last one being the whole reason a passthrough is allowed to exist here at
  // all (ctl.sh's header, CLAUDE.md §Self-scheduling).
  const apiSessions = (await (await get("/api/sessions")).json()) as { slots: { id: number }[] };
  const gotOwner = await ctl(["get", "/api/sessions", "--json"]);
  const gotSlots = (gotOwner.json as { slots?: { id: number }[] })?.slots ?? [];
  // `json !== null` is load-bearing and not decoration: ctl() only reaches it by PARSING what the
  // script printed, so a body cut short on its way to the pipe cannot satisfy this line. That is
  // the check for a real defect this verb had while being written — `process.stdout.write` of a
  // 745 KB suite.log followed by `process.exit(0)` handed a pipe exactly 65 536 bytes, silently
  // (ctl.sh, the comment above the output branch). This instance serves no body that large, so
  // what is held here is completeness, and the 64 KB case was measured by hand against the live
  // artefact route.
  check("ctl get: an owner route answers with the complete body that route serves",
    gotOwner.code === 0 && gotOwner.json !== null
      && gotSlots.map((s) => s.id).join() === apiSessions.slots.map((s) => s.id).join()
      && gotSlots.length > 0,
    `exit ${gotOwner.code} parsed=${gotOwner.json !== null} ctl=${gotSlots.length} api=${apiSessions.slots.length}`);

  // THE SPLIT IS THE PATH, not a flag — and it is proven from both sides, because a verb that
  // simply sent BOTH headers would pass a one-sided check while quietly widening what a caller
  // with one credential can reach.
  const selfOnly = await ctl(["get", "/api/self", "--json"], { FLEET_CTL_TOKEN: "not-the-owner-token" });
  check("ctl get: /api/self is opened with the SELF token — a wrong owner token does not reach it",
    selfOnly.code === 0 && (selfOnly.json as { slot?: number })?.slot === free,
    `exit ${selfOnly.code} slot=${JSON.stringify((selfOnly.json as { slot?: number })?.slot)} want ${free}`);
  const ownerOnly = await ctl(["get", "/api/sessions", "--json"], { FLEET_SELF_TOKEN: "0".repeat(32) });
  check("ctl get: an owner route is opened with the OWNER token — a wrong self token does not reach it",
    ownerOnly.code === 0 && ((ownerOnly.json as { slots?: unknown[] })?.slots ?? []).length > 0,
    `exit ${ownerOnly.code}`);

  // 401, and the shape of the sentence: the source a token was resolved FROM is the answer the 79
  // hand-built token lookups were after; the token itself is never part of it.
  const un401 = await ctl(["get", "/api/sessions"], { FLEET_CTL_TOKEN: "not-the-owner-token" });
  check("ctl get: a refused owner credential exits 1 and names the 401 plus the source it resolved from",
    un401.code === 1 && un401.err.includes("401") && un401.err.includes("FLEET_CTL_TOKEN") && un401.out === "",
    `exit ${un401.code} err=${JSON.stringify(un401.err.slice(0, 160))}`);
  const unSelf401 = await ctl(["get", "/api/self"], { FLEET_SELF_TOKEN: "0".repeat(32) });
  check("ctl get: a refused self credential exits 1 and names the 401 plus FLEET_SELF_TOKEN",
    unSelf401.code === 1 && unSelf401.err.includes("401") && unSelf401.err.includes("FLEET_SELF_TOKEN")
      && unSelf401.out === "",
    `exit ${unSelf401.code} err=${JSON.stringify(unSelf401.err.slice(0, 160))}`);

  // REFUSAL 1 — a method or a body. Refused BY NAME and with nothing on stdout: a silent downgrade
  // to a GET would answer a question the caller did not ask and look like it worked.
  const methFlag = await ctl(["get", "-X", "POST", "/api/sessions"]);
  const methWord = await ctl(["get", "POST", "/api/sessions"]);
  const methBody = await ctl(["get", "--data", "{}", "/api/sessions"]);
  check("ctl get: a method or a body is refused by name, exit 2, and never downgraded to a GET",
    methFlag.code === 2 && methFlag.err.includes('"-X"') && methFlag.out === ""
      && methWord.code === 2 && methWord.err.includes('"POST"') && methWord.out === ""
      && methBody.code === 2 && methBody.err.includes('"--data"') && methBody.out === "",
    `-X=${methFlag.code} POST=${methWord.code} --data=${methBody.code}`);

  // REFUSAL 2 — a path that is not a route of this fleet. The whole-URL case is its own sentence
  // because the repair is different: the caller has the right route and the wrong shape.
  const outside = await ctl(["get", "/etc/passwd"]);
  const wholeUrl = await ctl(["get", `${BASE}/api/sessions`]);
  check("ctl get: a path outside /api/ is refused by name, and a whole URL is told where the base comes from",
    outside.code === 2 && outside.err.includes("/etc/passwd") && outside.err.includes("/api/") && outside.out === ""
      && wholeUrl.code === 2 && wholeUrl.err.includes("whole URL") && wholeUrl.out === "",
    `outside=${outside.code} url=${wholeUrl.code} err=${JSON.stringify(outside.err.slice(0, 120))}`);

  // --keys: the SHAPE of the top two levels instead of the body. The second level of an array is
  // read off element 0 and must SAY so — and the output has to be dramatically smaller than the
  // body, or the flag bought nothing (the artefact route serves a 700 KB suite.log through here).
  const shape = await ctl(["get", "/api/sessions", "--keys", "--json"]);
  const shapeKeys = (shape.json as { keys?: { key: string; shape: string; inner: string }[] })?.keys ?? [];
  const slotsKey = shapeKeys.find((k) => k.key === "slots");
  check("ctl get --keys: two levels — top-level keys with their shapes, the second read off element 0",
    shape.code === 0 && shapeKeys.length > 0 && !!slotsKey
      && slotsKey.shape.startsWith("array[")
      && slotsKey.inner.replace("[0] = ", "").split(", ").includes("id"),
    `keys=${shapeKeys.length} slots=${JSON.stringify(slotsKey)}`);
  // …and that it is the shape INSTEAD of the body, asserted EXACTLY rather than as a byte ratio: a
  // ratio reads as a strong check and is a flake, because this instance's sixteen empty slots make
  // the body a fraction of the live fleet's (154 KB there against a 14 KiB budget here, e2e/tasks.ts).
  // One line per top-level key plus the header is the actual contract, and it cannot drift quietly.
  const shapeText = await ctl(["get", "/api/sessions", "--keys"]);
  const shapeLines = shapeText.out.trimEnd().split("\n");
  check("ctl get --keys: it prints the shape INSTEAD of the body — a header and one line per top-level key",
    shapeText.code === 0 && shapeKeys.length > 0 && shapeLines.length === shapeKeys.length + 1
      && shapeLines[0]!.startsWith("/api/sessions  200  object{")
      && shapeText.out.length < gotOwner.out.length,
    `lines=${shapeLines.length} keys=${shapeKeys.length} shape=${shapeText.out.length} B body=${gotOwner.out.length} B`);
  // …and the case that has no shape to read: an empty array is said as such rather than answered
  // with the shape of an element that does not exist.
  //
  // THIS CHECK FIRST ASKED /api/lane-outcomes AND ASSUMED IT WAS EMPTY, and the preview run caught
  // it: modules before this one land lanes into this instance, so the ledger has rows by the time
  // ctl runs. That is the same mistake as the byte ratio above — measuring the INSTANCE instead of
  // the verb — and it is why the subject here is the receiver's own row, whose arrays this module
  // opened seconds ago. Both branches are asserted over whatever /api/self actually holds, and an
  // instance that offers no empty array at all fails as a NON-MEASUREMENT rather than passing on
  // an `every()` over nothing.
  const emptyShape = await ctl(["get", "/api/self", "--keys", "--json"]);
  const selfKeys = (emptyShape.json as { keys?: { key: string; shape: string; inner: string }[] })?.keys ?? [];
  const arrays = selfKeys.filter((k) => k.shape.startsWith("array["));
  const empties = arrays.filter((k) => k.shape === "array[0]");
  const filled = arrays.filter((k) => k.shape !== "array[0]");
  check("ctl get --keys: an empty array says it has no element to read a shape from, a filled one reads element 0",
    emptyShape.code === 0 && empties.length > 0
      && empties.every((k) => k.inner === "(empty — no element to read a shape from)")
      && filled.every((k) => k.inner.startsWith("[0] = ")),
    empties.length === 0
      ? `NOT MEASURED — /api/self offered no empty array: ${arrays.map((k) => `${k.key}=${k.shape}`).join(", ")}`
      : `empty=[${empties.map((k) => k.key).join(", ")}] filled=[${filled.map((k) => k.key).join(", ")}]`);

  // TOKEN HYGIENE, over every run above at once — success, refusal and 401 alike. ctl.sh carries
  // the credential in the environment into a request header; if any of it ever reached stdout or
  // stderr, this is the line that says so.
  const getRuns = [gotOwner, selfOnly, ownerOnly, un401, unSelf401, methFlag, methWord, methBody,
    outside, wholeUrl, shape, shapeText, emptyShape];
  const leaked = getRuns.filter((r) => r.out.includes(TOKEN) || r.err.includes(TOKEN)
    || r.out.includes(selfTok) || r.err.includes(selfTok));
  check("ctl get: no output of any of those runs contains the owner token or the self token",
    leaked.length === 0, `${getRuns.length} runs, ${leaked.length} carrying a token`);

  // === merges (before any land of ours) =========================================================
  const mergesBefore = await ctl(["merges", "--json"]);
  const stBefore = stateFile().merges as Record<string, { status: string; landed: boolean; verify?: unknown }> ?? {};
  const rowsBefore = (mergesBefore.json as { rows?: { slot: number; status: string | null; hasVerify: boolean }[] })?.rows ?? [];
  // BOTH DIRECTIONS over the persisted half: every fleet.json verdict is a row with that status and
  // that hasVerify, and every row claiming a status has a fleet.json verdict behind it. Rows with a
  // null status are the OPEN LANES the union adds — they are counted separately, below.
  const verdictRows = rowsBefore.filter((r) => r.status !== null);
  const agreeBefore = Object.keys(stBefore).every((k) =>
      verdictRows.some((r) => String(r.slot) === k && r.status === stBefore[k]!.status
        && r.hasVerify === !!stBefore[k]!.verify))
    && verdictRows.every((r) => stBefore[String(r.slot)]?.status === r.status);
  check("ctl merges: the persisted verdicts and its rows are the same set, status and hasVerify",
    agreeBefore, `verdictRows=${verdictRows.length} state=${Object.keys(stBefore).length} exit=${mergesBefore.code}`);
  // …and the union half: a lane whose FIRST land is running has no persisted verdict yet, so an
  // open lane must be a row on its own or the sensor would answer "nothing is running" about
  // exactly the case it exists for.
  const openLanes = ((await (await get("/api/sessions")).json()) as
    { slots: { id: number; worktree: unknown | null }[] }).slots.filter((s) => s.worktree).map((s) => s.id);
  check("ctl merges: every OPEN LANE is a row, verdict or not — the first land of a lane has none",
    openLanes.every((id) => rowsBefore.some((r) => r.slot === id)),
    `lanes=${JSON.stringify(openLanes)} rows=${JSON.stringify(rowsBefore.map((r) => r.slot))}`);
  check("ctl merges: the live half is asked, not inferred (liveKnown with an owner token)",
    (mergesBefore.json as { liveKnown?: boolean })?.liveKnown === true
      && rowsBefore.every((r) => (r as { running?: boolean | null }).running !== null),
    JSON.stringify((mergesBefore.json as { liveKnown?: boolean })?.liveKnown));

  // === ctx ======================================================================================
  // `null` is an ANSWER ("Fleet cannot tell"), never 0 — so the assertion is AGREEMENT with the
  // route, in whichever of the two states this instance's harness leaves the slot.
  const ctxRun = await ctl(["ctx", String(free), "--json"]);
  const apiCtx = ((await (await get("/api/sessions")).json()) as
    { slots: { id: number; ctx: { pct: number; usedTokens: number; windowTokens: number } | null }[] })
    .slots.find((s) => s.id === free)?.ctx ?? null;
  const ctlCtx = (ctxRun.json as { ctx?: unknown })?.ctx ?? null;
  check("ctl ctx: the fill it reports is the fill /api/sessions serves for that slot",
    JSON.stringify(ctlCtx) === JSON.stringify(apiCtx),
    `ctl=${JSON.stringify(ctlCtx)} api=${JSON.stringify(apiCtx)}`);
  check("ctl ctx: an unmeasurable fill exits 1 and a measured one exits 0 — never a silent 0%",
    ctxRun.code === (apiCtx === null ? 1 : 0), `exit ${ctxRun.code} ctx=${JSON.stringify(apiCtx)}`);
  const ctxGone = await ctl(["ctx", "999", "--json"]);
  check("ctl ctx: a slot this fleet does not have is refused, not answered",
    ctxGone.code === 1 && ctxGone.err.includes("no slot 999"), `exit ${ctxGone.code}`);

  // === audits ===================================================================================
  // The verb reads the ROUTE, so the fixture is planted where the route reads: the instance's own
  // post-land-audits.jsonl and audit-adjudications.jsonl (server.ts#POSTLAND_AUDIT_FILE, read fresh
  // on every GET). Other modules write those files too, so whatever is there is moved aside and put
  // back — `.1` included, because readLedger reads the older generation first. The `at` values sit
  // in 2001, where no real row and no other module's fixture can collide with them.
  const ledgers = ["post-land-audits.jsonl", "audit-adjudications.jsonl"]
    .flatMap((f) => [`${ROOT}/${f}`, `${ROOT}/${f}.1`]);
  const stash = ledgers.filter(existsSync).map((p) => { renameSync(p, `${p}.ctlstash`); return p; });
  try {
    const T = 1_000_000_000_000;
    const hex = (h: string): string => h.repeat(20);
    const row = (at: number, result: string, sha: string, branch: string, extra: Record<string, unknown>) => ({
      at, startedAt: at - 1000, ms: 1000, repo: REPO, main: "main", mainSha: hex(sha), result, cmd: "fixture",
      exitCode: result === "unknown" ? null : result === "green" ? 0 : 1, out: "",
      covers: [{ branch, mainAfter: hex(sha === "a1" ? "b2" : sha), at: at - 2000 }], checks: null, ...extra,
    });
    const fixture = [
      row(T + 1, "red", "d4", "fleet/ctl-fix-c", { checks: { ran: 90, failed: 1 }, fails: ["ctlfixture alpha"] }),
      row(T + 3, "red", "a1", "fleet/ctl-fix-a", { checks: { ran: 100, failed: 2 }, fails: ["ctlfixture alpha", "ctlfixture beta"] }),
      row(T, "unknown", "e5", "fleet/ctl-fix-d", { reason: "fixture: never measured" }),
      row(T + 2, "green", "c3", "fleet/ctl-fix-b", { checks: { ran: 100, failed: 0 }, fails: [] }),
    ];
    writeFileSync(`${ROOT}/post-land-audits.jsonl`, fixture.map((r) => JSON.stringify(r)).join("\n") + "\n");
    writeFileSync(`${ROOT}/audit-adjudications.jsonl`,
      JSON.stringify({ at: T + 10, auditAt: T + 3, verdict: "flake", by: "owner", note: "ctl fixture" }) + "\n");

    type AuditsJson = {
      live: unknown; total: number; delivered: number;
      fail: { text: string; count: number; of: number; withFails: number } | null;
      sha: { query: string; matched: number; of: number } | null;
      audits: { at: number; result: string; mainSha: string; covers: string[]; checks: unknown;
        fails: string[] | null; adjudication: { verdict: string } | null; reason?: string }[];
    };
    const liveApi = ((await (await get("/api/sessions")).json()) as { postLandAuditLive?: unknown }).postLandAuditLive;

    // (1) the rows: newest first, every field the brief names, the adjudication JOINED on the row it judges
    const plain = await ctl(["audits"]);
    const js = await ctl(["audits", "--json"]);
    const a = js.json as AuditsJson | null;
    const order = a?.audits.map((r) => r.at).join(",");
    check("ctl audits: the live line comes FIRST and says what /api/sessions says — null is idle, never unknown",
      liveApi === null
        ? plain.out.split("\n")[0] === "live: idle — no audit running, none waiting"
        : plain.out.startsWith("live: ") && !plain.out.startsWith("live: idle") && !plain.out.startsWith("live: UNKNOWN"),
      `api=${JSON.stringify(liveApi)} first=${JSON.stringify(plain.out.split("\n")[0])}`);
    check("ctl audits: the rows are the route's, newest first, with result/mainSha/covers/checks/fails as the ledger holds them",
      js.code === 0 && a?.total === 4 && order === [T + 3, T + 2, T + 1, T].join(",")
        && a.audits[0]!.mainSha === hex("a1") && a.audits[0]!.covers.join() === "fleet/ctl-fix-a"
        && JSON.stringify(a.audits[0]!.checks) === JSON.stringify({ ran: 100, failed: 2 })
        && a.audits[0]!.fails?.join("|") === "ctlfixture alpha|ctlfixture beta"
        && a.audits[1]!.fails?.length === 0 && a.audits[3]!.fails === null && a.audits[3]!.checks === null
        && a.audits[3]!.reason === "fixture: never measured",
      `exit ${js.code} total=${a?.total} order=${order} first=${JSON.stringify(a?.audits[0])}`);
    const plainRows = plain.out.split("\n").filter((l) => l.startsWith("2001-"));
    check("ctl audits: the adjudication is the rail's — a judged red reads `adj flake`, an unjudged one `adj none`",
      a?.audits[0]!.adjudication?.verdict === "flake" && a?.audits[2]!.adjudication === null
        && plainRows.length === 4 && plainRows[0]!.includes("adj flake (owner)") && plainRows[2]!.includes("adj none")
        && plainRows[0]!.includes("checks 100 ran/2 failed") && plainRows[3]!.includes("checks unmeasured"),
      `rows=${JSON.stringify(plainRows)}`);

    // (2) --fail counts over EVERY delivered row and names the denominator
    const failRun = await ctl(["audits", "--fail", "ctlfixture alpha", "--json"]);
    const f = failRun.json as AuditsJson | null;
    const failPlain = await ctl(["audits", "--fail", "ctlfixture alpha"]);
    check("ctl audits --fail: it counts over all delivered rows, names the denominator and how many carried a fails list",
      failRun.code === 0 && f?.fail?.count === 2 && f.fail.of === 4 && f.fail.withFails === 3
        && f.audits.map((r) => r.at).join(",") === [T + 3, T + 1].join(",")
        && failPlain.out.includes(`fail "ctlfixture alpha": in 2 of 4 row(s) delivered`),
      `exit ${failRun.code} fail=${JSON.stringify(f?.fail)} out=${failPlain.out.split("\n").slice(0, 3).join(" / ")}`);

    // (3) --sha: a tip or a covered land's mainAfter is found; a sha the trail does not know is a NAMED exit 1
    const shaHit = await ctl(["audits", "--sha", "b2b2b2b2", "--json"]);
    const unknownSha = await ctl(["audits", "--sha", "0123abcd"]);
    const badSha = await ctl(["audits", "--sha", "not-a-sha"]);
    check("ctl audits --sha: a covered land's mainAfter finds the row that answered for it",
      shaHit.code === 0 && (shaHit.json as AuditsJson | null)?.audits.map((r) => r.at).join(",") === String(T + 3),
      `exit ${shaHit.code} ${JSON.stringify((shaHit.json as AuditsJson | null)?.sha)}`);
    check("ctl audits --sha: an unknown sha exits 1 and says UNKNOWN with the denominator; a malformed one exits 2",
      unknownSha.code === 1 && unknownSha.out.includes("sha 0123abcd: UNKNOWN to the trail")
        && unknownSha.out.includes("among 4 delivered") && badSha.code === 2 && badSha.err.includes("--sha wants"),
      `unknown exit ${unknownSha.code} out=${JSON.stringify(unknownSha.out.slice(0, 300))} bad exit ${badSha.code}`);

    // (4) an EMPTY ledger is its own sentence, not a blank screen and not an error
    for (const p of ledgers) rmSync(p, { force: true });
    const empty = await ctl(["audits"]);
    const emptyJs = await ctl(["audits", "--json"]);
    check("ctl audits: an empty ledger is a named result — exit 0, `ledger empty`, total 0",
      empty.code === 0 && empty.out.split("\n")[1]?.startsWith("ledger empty — no post-land audit row is recorded")
        && (emptyJs.json as AuditsJson | null)?.total === 0,
      `exit ${empty.code} out=${JSON.stringify(empty.out.slice(0, 300))}`);
  } finally {
    for (const p of ledgers) rmSync(p, { force: true });
    for (const p of stash) renameSync(`${p}.ctlstash`, p);
  }

  // === land --wait ==============================================================================
  // A clean lane (its own file) never consults the merge agent, so this is the ordinary green land.
  // The idle gate can still refuse the FIRST attempt on a freshly-spawned pane (`status: "blocked"`
  // — the pane's own shell prompt is output), which is a FIXTURE fact, not a ctl.sh fact: retry the
  // way lane-helpers#driveMerge does, so a refused first try never reads as a broken verb.
  // `as` is what ctl.sh is handed for that slot — the number, or the lane's name (S5)
  const landRetry = async (slot: number, args: string[], as: string = String(slot)): Promise<CtlRun> => {
    let r = await ctl(["land", as, ...args]);
    // only the IDLE-GATE refusal is retried; a conflict verdict is a result, not a flaky start
    for (let i = 0; i < 8 && r.code !== 0 && r.out.includes("actively working right now"); i++) {
      await settleForMerge(slot);
      await Bun.sleep(800);
      r = await ctl(["land", as, ...args]);
    }
    return r;
  };
  // a lane's name as the poll serves it (server.ts#laneNameOf) — the one source ctl.sh resolves from
  const nameOf = async (slot: number): Promise<string | null> =>
    ((await (await get("/api/sessions")).json()) as { slots: { id: number; name?: string }[] })
      .slots.find((s) => s.id === slot)?.name ?? null;
  const la = await openLane(REPO, "ctlland");
  await settleForMerge(la.slot);
  const laName = await nameOf(la.slot);
  const mainBefore = gitOut(REPO, "rev-parse", "main");
  const landed = await landRetry(la.slot, ["--wait", "--json"]);
  const lj = landed.json as {
    gone?: boolean; last?: { status: string; landed: boolean; verify?: { ok: boolean | null; ms?: number } } | null;
    mainAfter?: string | null; mainAfterFrom?: string | null;
    auditWatch?: { id?: string; error?: string | null } | null;
  } | null;
  const mainAfter = gitOut(REPO, "rev-parse", "main");
  check("ctl land --wait: it lands the lane and main actually moved",
    landed.code === 0 && mainAfter !== mainBefore && mainAfter.length === 40,
    `exit ${landed.code} ${mainBefore.slice(0, 8)} -> ${mainAfter.slice(0, 8)}`);
  check("ctl land --wait: the mainAfter it reports is the sha main now carries, and it names its source",
    lj?.mainAfter === mainAfter && typeof lj?.mainAfterFrom === "string",
    `ctl=${lj?.mainAfter?.slice(0, 12) ?? "null"} git=${mainAfter.slice(0, 12)} from=${lj?.mainAfterFrom ?? "-"}`);
  // …and WHAT THE STATE FILE KEEPS, established by measurement rather than assumed. Two red runs
  // were spent on the assumption that a green land leaves no row: it does. The land path deletes
  // the verdict, but the merge job's final write runs AFTER the teardown under the guard
  // `if (!s.cwd || s.cwd === cwd)` — a torn-down slot has no cwd, the first disjunct passes, and
  // `{status:"merged", landed:true}` is written back for a slot that no longer exists (cleared only
  // when that slot is next opened). So the honest pair is: ctl named the terminal fact, and any row
  // left behind AGREES with it rather than contradicting it.
  const persistedAfter = (stateFile().merges as Record<string, { status?: string; landed?: boolean }>)?.[String(la.slot)] ?? null;
  check("ctl land --wait: it names the terminal fact, and any row the state file keeps agrees with it",
    (lj?.gone === true || lj?.last?.landed === true)
      && (persistedAfter === null || (persistedAfter.status === "merged" && persistedAfter.landed === true)),
    `gone=${lj?.gone} landed=${lj?.last?.landed} row=${persistedAfter ? `${persistedAfter.status}/landed=${persistedAfter.landed}` : "(none)"}`);
  // …and that such a row is NOT read as work in flight: a landed lane's leftover verdict must never
  // make `merges` say "wait". This is the whole reason `busy` keys on `running` and `interrupted`
  // rather than on "a row exists".
  const mergesPostLand = await ctl(["merges", "--json"]);
  const leftover = (mergesPostLand.json as { rows?: { slot: number; landed: boolean }[]; busy?: number[] })
    ?.rows?.find((r) => r.slot === la.slot) ?? null;
  check("ctl merges: a landed lane's leftover verdict is history, not in flight — exit 0, not busy",
    mergesPostLand.code === 0
      && !((mergesPostLand.json as { busy?: number[] })?.busy ?? []).includes(la.slot),
    `exit=${mergesPostLand.code} leftover=${JSON.stringify(leftover)} busy=${JSON.stringify((mergesPostLand.json as { busy?: number[] })?.busy ?? [])}`);
  // TIER 2 IS OFF IN THIS INSTANCE (FLEET_POSTLAND_AUDIT_CMD unset — server.ts, "DEFAULT OFF"), so
  // the audit watch CANNOT be armed. What is asserted is that the script says so instead of
  // reporting a watch it does not hold: a claimed-but-absent return path is the failure mode.
  check("ctl land --wait: with tier 2 off it reports the audit watch as REFUSED, never as armed",
    !!lj?.auditWatch && typeof lj.auditWatch.error === "string"
      && lj.auditWatch.error.includes("no persisted, queued, or running audit exists")
      && lj.auditWatch.id === undefined,
    JSON.stringify(lj?.auditWatch ?? null).slice(0, 200));

  // === a lane NAME where a slot number goes (S5) ================================================
  // The land above freed its lane's name, and nothing has taken the letter again yet (the next
  // openLane below would). A freed name and a never-given one must each be refused by EVERY verb
  // that takes a slot, with the name in the message — never resolved to the number of its band.
  const NEVER = "99Z";
  const freeNames = laName === null ? [] : [laName, NEVER];
  const refusals: string[] = [];
  for (const n of freeNames) {
    for (const args of [["ctx", n], ["land", n], ["watch", "lane", n], ["watch", "merge", n], ["wait", "merge", n]]) {
      const r = await ctl(args);
      if (!(r.code === 1 && r.err.includes(`no lane named ${n}`))) refusals.push(`${args.join(" ")} → exit ${r.code} ${r.err.trim().slice(0, 100)}`);
    }
  }
  check("ctl <slot verbs>: a freed lane name and a never-given one are refused by ctx, land, watch lane|merge and wait merge — exit 1, the name in the message",
    laName !== null && refusals.length === 0,
    laName === null ? "UNMEASURED — the landed lane carried no name in /api/sessions" : `names=${freeNames.join(",")} wrong=[${refusals.join(" | ")}]`);
  const malformed = await ctl(["land", "4a"]);
  check("ctl <slot verbs>: an argument that is neither a number nor a lane name is refused before any request (exit 2)",
    malformed.code === 2 && malformed.err.includes('"4a" is neither a slot number nor a lane name'),
    `exit ${malformed.code} ${malformed.err.trim().slice(0, 120)}`);

  // === merges, over a land that did NOT finish ==================================================
  // The sensor is only worth anything on an UNFINISHED land, so one is produced deliberately: a
  // lane whose rebase conflicts reaches the fake merge agent, whose default mode answers `blocked`
  // (e2e-isolated.sh). That verdict IS persisted and the lane stays alive — the exact shape a
  // controller must see before starting another land.
  // the mode file is SHARED with every other lane module, so it is restored below rather than left
  // on this probe's setting — "blocked" happens to be the fake agent's own default, and relying on
  // that instead of saying it is how a fixture becomes load-bearing without anyone noticing.
  const modeFile = `${REPO.replace(/\/[^/]+$/, "")}/mergemode`;
  let modeBefore: string | null = null;
  try { modeBefore = readFileSync(modeFile, "utf8"); } catch { modeBefore = null; }
  await setMergeMode("blocked");
  // ORDER IS THE FIXTURE. The lane must branch FIRST and main must move AFTERWARDS, or the rebase
  // is a fast-forward and no agent is ever consulted — openLane already commits `ctlconflict.txt`
  // on the lane side, so main adding the same path with different content is the conflict.
  const lc = await openLane(REPO, "ctlconflict");
  await Bun.write(`${REPO}/ctlconflict.txt`, "main side\n");
  spawnSync("git", ["-C", REPO, "add", "ctlconflict.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "ctl conflict seed on main"]);
  check("ctl setup: the lane and main both carry a conflicting ctlconflict.txt",
    gitOut(REPO, "log", "--oneline", "-1").includes("ctl conflict seed on main")
      && gitOut(lc.cwd, "log", "--oneline", "-1").includes("ctlconflict lane work"),
    `main=${gitOut(REPO, "log", "--oneline", "-1")} lane=${gitOut(lc.cwd, "log", "--oneline", "-1")}`);
  await settleForMerge(lc.slot);
  const blockedLand = await landRetry(lc.slot, ["--wait", "--json"]);
  const bj = blockedLand.json as { last?: { status: string; landed: boolean } | null } | null;
  check("ctl setup: the conflicting lane produced a persisted, NOT-landed verdict",
    bj?.last?.landed === false && typeof bj.last.status === "string",
    `exit ${blockedLand.code} ${JSON.stringify(bj?.last ?? null).slice(0, 200)}`);
  const mergesAfter = await ctl(["merges", "--json"]);
  const rowsAfter = (mergesAfter.json as
    { rows?: { slot: number; status: string; landed: boolean; hasVerify: boolean; verify: string; running: boolean | null }[] })?.rows ?? [];
  const stAfter = stateFile().merges as Record<string, { status: string; landed: boolean; verify?: unknown }> ?? {};
  const stuck = rowsAfter.find((r) => r.slot === lc.slot);
  check("ctl merges: the unfinished land is a row, with the state file's own status and landed=no",
    !!stuck && stuck.status === stAfter[String(lc.slot)]?.status && stuck.landed === false
      && stuck.hasVerify === !!stAfter[String(lc.slot)]?.verify
      && ["ok", "FAILED", "skipped", "timedOut", "waitedOut", "none"].includes(stuck.verify),
    `ctl=${JSON.stringify(stuck ?? null)} state=${JSON.stringify(stAfter[String(lc.slot)] ?? null).slice(0, 160)}`);
  check("ctl merges: a settled-but-unlanded verdict is NOT counted as in flight — exit 0, running=no",
    mergesAfter.code === 0 && stuck?.running === false,
    `exit ${mergesAfter.code} running=${stuck?.running}`);
  // THE NAME IS THE LANE, NOT ITS BAND: `ctx <name>` answers for the lane's own place, and `wait
  // merge <name>` returns the verdict that place holds — the same answer the number gets.
  const lcName = await nameOf(lc.slot);
  const ctxByName = await ctl(["ctx", lcName ?? "-", "--json"]);
  const cbn = ctxByName.json as { slot?: number; name?: string | null } | null;
  const waitByName = await ctl(["wait", "merge", lcName ?? "-", "--json"]);
  const waitByNum = await ctl(["wait", "merge", String(lc.slot), "--json"]);
  const wbn = waitByName.json as { last?: { status: string; landed: boolean } | null } | null;
  check("ctl ctx / wait merge: a lane name resolves to that lane's own slot and gets the answer its number gets",
    lcName !== null && /^\d+[A-Z]+$/.test(lcName) && cbn?.slot === lc.slot && cbn?.name === lcName
      && waitByName.code === 0 && wbn?.last?.landed === false
      && JSON.stringify(wbn?.last) === JSON.stringify((waitByNum.json as { last?: unknown } | null)?.last),
    `name=${lcName} ctx=${JSON.stringify(cbn)} wait=${waitByName.code}/${JSON.stringify(wbn?.last ?? null).slice(0, 120)} byNum=${waitByNum.code}`);

  // === state.sh prints the name next to the slot (S5) ===========================================
  // state.sh reads the MAIN checkout's fleet.json, so it runs in a fixture repo holding a copy of
  // THIS instance's state — plus one lane from before the letter field, which must say it has no
  // name rather than borrow one. Each name it prints is held against the poll's `name` for the slot.
  // The script comes through the node_modules pointer home, as e2e/outcomes.ts takes it: it is not
  // staged, and the pointer resolves in the audit's `git archive` source too.
  {
    const stRepo = `${REPO}.ctl-state-fixture`;
    rmSync(stRepo, { recursive: true, force: true });
    mkdirSync(stRepo, { recursive: true });
    spawnSync("git", ["init", "-q", "-b", "main", stRepo]);
    writeFileSync(`${stRepo}/state.sh`, readFileSync(`${dirname(realpathSync(`${ROOT}/node_modules`))}/state.sh`, "utf8"));
    writeFileSync(`${stRepo}/server.ts`, "// fixture\n");
    const st = stateFile() as { slots?: Record<string, unknown> };
    const PRE = "31";
    writeFileSync(`${stRepo}/fleet.json`, JSON.stringify({ ...st,
      slots: { ...st.slots, [PRE]: { cwd: `${stRepo}/pre`, worktree: { repo: REPO, branch: "e2e-ctl-preletter" } } } }, null, 2));
    spawnSync("git", ["-C", stRepo, "add", "state.sh", "server.ts"]);
    spawnSync("git", ["-C", stRepo, "-c", "user.email=e2e@test", "-c", "user.name=e2e", "commit", "-qm", "fixture"]);
    const polled = ((await (await get("/api/sessions")).json()) as { slots: { id: number; name?: string; worktree?: unknown }[] })
      .slots.filter((x) => x.worktree && x.name && (st.slots ?? {})[String(x.id)]);
    const stOut = spawnSync("sh", ["state.sh"], { cwd: stRepo, encoding: "utf8" }).stdout ?? "";
    const slotLines = stOut.split("\n").filter((l) => /^  slot \d+  /.test(l));
    const missing = polled.filter((x) => !slotLines.some((l) => l.startsWith(`  slot ${x.id}  ${x.name}  `)));
    check("state.sh: every lane's slot line carries the name the poll serves for it (4A), and a pre-letter lane says it has none",
      polled.length > 0 && missing.length === 0
        && slotLines.some((l) => l.startsWith(`  slot ${PRE}  (no name`) && l.includes("e2e-ctl-preletter")),
      `polled=${polled.map((x) => `${x.id}:${x.name}`).join(",")} missing=${missing.map((x) => x.id).join(",")} lines=${JSON.stringify(slotLines).slice(0, 300)}`);
    rmSync(stRepo, { recursive: true, force: true });
  }
  await post(`/api/slots/${lc.slot}/kill`, {});
  if (modeBefore !== null) await Bun.write(modeFile, modeBefore);

  // === watch merge + wait merge =================================================================
  // …addressed BY NAME: the land is posted as the name (pinned to the occupant it read), and the
  // watch resolves the name to the subject slot the route's `target` wants.
  const lb = await openLane(REPO, "ctlwatch");
  await settleForMerge(lb.slot);
  const lbName = await nameOf(lb.slot);
  const started = await landRetry(lb.slot, ["--json"], lbName ?? "-");
  const sj = started.json as { slot?: number; name?: string | null } | null;
  check("ctl land <name> (no --wait): the POST is made for the named lane and reported without blocking",
    started.code === 0 && lbName !== null && sj?.slot === lb.slot && sj?.name === lbName,
    `exit ${started.code} name=${lbName} ${started.out.slice(0, 200)}`);
  const wMerge = await ctl(["watch", "merge", lbName ?? "-", "--json"]);
  const wj = wMerge.json as { ok?: boolean; watch?: { id: string; kind?: string; idleSec: number; armed: boolean } } | null;
  const mine = ((await (await fetch(`${BASE}/api/self`, { headers: { "x-fleet-self-token": selfTok } })).json()) as
    { watches: { id: string; target?: number; idleSec: number }[] }).watches;
  check("ctl watch merge: the watch it reports exists on the receiver, on the SUBJECT SLOT (`target`, not `slot`)",
    wMerge.code === 0 && !!wj?.watch?.id && mine.some((w) => w.id === wj.watch!.id && w.target === lb.slot),
    `${wMerge.code} ${JSON.stringify(wj?.watch ?? null)} mine=${JSON.stringify(mine.map((w) => [w.id, w.target]))}`);
  check("ctl watch: idleSec defaults to 0 — the value that actually delivers to a working session",
    wj?.watch?.idleSec === 0 && mine.find((w) => w.id === wj?.watch?.id)?.idleSec === 0,
    `ctl=${wj?.watch?.idleSec} server=${mine.find((w) => w.id === wj?.watch?.id)?.idleSec}`);
  const waited = await ctl(["wait", "merge", String(lb.slot), "--json"]);
  const waitJson = waited.json as { gone?: boolean; last?: { landed: boolean } | null } | null;
  check("ctl wait merge: it returns only on the terminal fact, and names it",
    waited.code === 0 && (waitJson?.gone === true || typeof waitJson?.last?.landed === "boolean"),
    `exit ${waited.code} ${JSON.stringify(waitJson).slice(0, 200)}`);

  // === the merge surface a poller has, and the seat that changes hands under it =================
  // TWO FINDINGS, ONE OBJECT (controller brief, 2026-09-08). `GET /api/slots/:id/merge` is the only
  // place where "a land is in flight" and "a land died mid-run" are both answerable, and it used to
  // answer neither on its own:
  //   · the durable-intent row mergeJob writes about itself says `interrupted` for the whole life of
  //     a HEALTHY run, and a neighbouring session read one of them that night as a server crash that
  //     had not happened;
  //   · the answer never said WHICH lane it was about, so a poller whose slot had been re-filled by
  //     the tick — the normal case the moment a seat frees up — polled on to FLEET_CTL_WAIT_MAX_SEC
  //     (3600 s in production) instead of ending. Measured 2026-09-08 02:22 at the land of 7539985d:
  //     no verdict, no armed audit watch, one process blocked for an hour.
  // The fixture is `hang`: fakemerge sleeps, so the land stays in flight for as long as the probe
  // needs and the recycle below happens UNDER a running land — the shape the incident had.
  // THE OTHER HALF OF `lastIs` IS NOT HERE. `interrupted` can only be asserted against a real
  // corpse, and the only fixture that makes one is the srv kill in e2e/land-durability.ts §A, where
  // that check lives. Neither probe proves the field on its own.
  let modeBeforeRecycle: string | null = null;
  try { modeBeforeRecycle = readFileSync(modeFile, "utf8"); } catch { modeBeforeRecycle = null; }
  await setMergeMode("hang");
  const lr = await openLane(REPO, "ctlrecycle");
  // ORDER IS THE FIXTURE, as in the conflict section above: the lane branches first, main adds the
  // same path afterwards, and only then is the rebase a conflict that reaches the (hanging) agent.
  await Bun.write(`${REPO}/ctlrecycle.txt`, "main side\n");
  spawnSync("git", ["-C", REPO, "add", "ctlrecycle.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "ctl recycle seed on main"]);
  // The land is started HERE rather than by the background ctl below, and only the idle gate is
  // retried: a refused first attempt on a freshly-spawned pane is a fixture fact, and a background
  // process cannot be retried. ctl's own POST then meets a job already in flight, answers
  // `{running:true}`, and goes straight to the poll — which is the part under test.
  let inflightStart: { running?: boolean; status?: string } | null = null;
  for (let i = 0; i < 8; i++) {
    await settleForMerge(lr.slot);
    inflightStart = (await (await post(`/api/slots/${lr.slot}/merge`, {})).json()) as { running?: boolean; status?: string };
    if (inflightStart.running === true) break;
    await Bun.sleep(600);
  }
  check("(setup) a land is in flight on the lane the recycle probe will pull out from under it",
    inflightStart?.running === true, JSON.stringify(inflightStart));
  const inflight = (await (await get(`/api/slots/${lr.slot}/merge`)).json()) as
    { running?: boolean; lastIs?: string; lane?: { repo: string; branch: string };
      last?: { status?: string; detail?: string } | null };
  check("merge GET: a healthy run's durable-intent row is on record as status `interrupted`",
    inflight.last?.status === "interrupted", `status=${inflight.last?.status} running=${inflight.running}`);
  check("merge GET: …and the SAME read names it `intent` — a run in flight, not a server that died",
    inflight.running === true && inflight.lastIs === "intent",
    `running=${inflight.running} lastIs=${inflight.lastIs}`);
  check("merge GET: the row's own prose carries the condition, instead of asserting the crash flat",
    /has not produced a verdict yet/.test(inflight.last?.detail ?? "")
      && /only once nothing is running/.test(inflight.last?.detail ?? ""),
    (inflight.last?.detail ?? "").slice(0, 240));
  // …compared against /api/sessions' own answer for this slot, NOT against the harness's `REPO`
  // string: the server stores the realpath, and on macOS `/var` is a symlink to `/private/var`, so
  // the two spellings of one directory differ as strings while naming the same tree. Asserting the
  // route against the API is what this module does everywhere else, and it is immune to that.
  const laneRow = ((await (await get("/api/sessions")).json()) as
    { slots: { id: number; worktree?: { repo: string; branch: string } | null }[] })
    .slots.find((x) => x.id === lr.slot)?.worktree ?? null;
  check("merge GET: one read also says WHICH lane it is answering for",
    !!laneRow && inflight.lane?.branch === laneRow.branch && inflight.lane?.repo === laneRow.repo,
    `merge=${JSON.stringify(inflight.lane)} sessions=${JSON.stringify(laneRow)}`);

  // …and now the seat changes hands under a poller that is inside its loop.
  // POLL PERIOD 15 s (the production default), and it is load-bearing in BOTH directions. Freeing a
  // seat and re-filling it are two requests, and BETWEEN them the route answers 400 — which is the
  // `gone` exit, not the recycled one. At this module's ordinary FLEET_CTL_POLL_SEC=1 a poll would
  // sooner or later land in that gap and the probe would measure the wrong branch; at 15 s the kill
  // and the re-fill both fit inside one gap, and the first poll (t≈0) still binds to the lane the
  // wait was started for. The budget stays this module's 120 s, so the old behaviour — silence to
  // the budget — remains a clearly separated ~115 s away from what is asserted below.
  const bgLand = ctlBg(["land", String(lr.slot), "--wait", "--json"], { FLEET_CTL_POLL_SEC: "15" });
  // …and this is the deterministic wait for "it has already seen the lane it was started for",
  // without which the recycle below is not a recycle at all.
  await Bun.sleep(2500);
  await post(`/api/slots/${lr.slot}/kill`, {});
  const refill = await post(`/api/slots/${lr.slot}/open-worktree`, { repo: REPO, branch: "e2e-ctl-recycled" });
  check("(setup) the freed seat is re-filled with a DIFFERENT lane, as the tick would fill it",
    refill.ok, `${refill.status} ${(await refill.text()).slice(0, 200)}`);
  const sinceRefill = Date.now();
  const landOut = await bgLand;
  const landWaitMs = Date.now() - sinceRefill;
  const lrj = landOut.json as { recycled?: { branch: string; repo: string } | null; ledgerSaid?: string | null;
    waitedOut?: boolean; mainAfter?: string | null; auditWatch?: unknown } | null;
  check("ctl land --wait: a seat that changed hands ENDS the wait — it does not poll to the budget",
    landWaitMs < 30_000 && lrj?.waitedOut === false,
    `${landWaitMs}ms after the re-fill (poll 15s), waitedOut=${lrj?.waitedOut}, budget=${env.FLEET_CTL_WAIT_MAX_SEC}s`);
  check("ctl land --wait: it names the lane that took the seat",
    lrj?.recycled?.branch === "e2e-ctl-recycled", `recycled=${JSON.stringify(lrj?.recycled)}`);
  // …and the answer itself comes from the branch-keyed ledger, which is the only thing that
  // outlives the slot. The lane here was KILLED, so what a correct read finds is a killed
  // disposition — a "landed" one would be the wrong answer, not a better one.
  check("ctl land --wait: the recycled path answers out of the branch-keyed ledger, which outlives the slot",
    typeof lrj?.ledgerSaid === "string" && lrj.ledgerSaid.startsWith("killed"),
    `ledgerSaid=${JSON.stringify(lrj?.ledgerSaid)} (the lane was killed out from under the wait)`);
  // the lane was KILLED, not landed — so no land exists to audit, and the git fallback that would
  // have handed main's current tip over as "what my land moved it to" is fenced off on this path.
  check("ctl land --wait: a recycled seat invents no mainAfter and arms no audit watch",
    (lrj?.mainAfter ?? null) === null && (lrj?.auditWatch ?? null) === null,
    `mainAfter=${JSON.stringify(lrj?.mainAfter)} auditWatch=${JSON.stringify(lrj?.auditWatch)}`);
  check("ctl land --wait: a lane that merely LEFT is not a land — exit is non-zero, and not the spent budget",
    landOut.code === 1 && lrj?.waitedOut === false, `exit ${landOut.code} waitedOut=${lrj?.waitedOut}`);
  await post(`/api/slots/${lr.slot}/kill`, {});

  // === the incident's own shape: a SUCCESSFUL land, then the seat re-filled =====================
  // Driven on `wait merge` rather than on `land --wait` because this verb can be started
  // independently of the land it waits for — which is what makes the ordering deterministic instead
  // of a race against how long a land happens to take. The poll period is raised to the production
  // default (15 s) for the same reason: the tear-down AND the re-fill both happen inside ONE gap, so
  // the waiter never sees the 400 in between. That gap is exactly the window the incident fell into.
  await setMergeMode("blocked"); // a conflict-free lane never consults the agent; this proves it did not
  const lw = await openLane(REPO, "ctlrefill");
  await settleForMerge(lw.slot);
  const bgWait = ctlBg(["wait", "merge", String(lw.slot)], { FLEET_CTL_POLL_SEC: "15" });
  await Bun.sleep(2500); // its first poll binds to lw, a whole poll period before anything moves
  let refillLand: { running?: boolean; status?: string } | null = null;
  for (let i = 0; i < 4; i++) {
    refillLand = (await (await post(`/api/slots/${lw.slot}/merge`, {})).json()) as { running?: boolean; status?: string };
    if (refillLand.running === true || refillLand.status === "merged") break;
    await settleForMerge(lw.slot);
  }
  // waitMerge is LOUD by design (it throws rather than return a null verdict as if it were one).
  // Caught here because this module accounts for every check it does not reach: a fixture that could
  // not be built must fail as ITSELF and let the verbs below still run.
  let landedAway: { gone: boolean } | null = null;
  let settleThrew = "";
  try { landedAway = await waitMerge(lw.slot); } catch (e) { settleThrew = ` threw: ${String(e).slice(0, 160)}`; }
  check("(setup) the watched lane really landed and gave its seat up",
    landedAway?.gone === true,
    `${JSON.stringify(landedAway)} start=${JSON.stringify(refillLand)}${settleThrew}`);
  const refill2 = await post(`/api/slots/${lw.slot}/open-worktree`, { repo: REPO, branch: "e2e-ctl-refilled" });
  check("(setup) a new lane takes the freed seat before the waiter looks again",
    refill2.ok, `${refill2.status} ${(await refill2.text()).slice(0, 200)}`);
  const sinceRefill2 = Date.now();
  const waitOut = await bgWait;
  const waitMs = Date.now() - sinceRefill2;
  // …and the two exit-3 shapes are told apart by the LINE, not by the code: a spent budget says
  // "STILL RUNNING after", a recycled seat names both lanes. Asserting the code alone would pass on
  // the very outcome this change exists to stop.
  check("ctl wait merge: a re-filled seat ends the wait within one poll period, not at the budget",
    waitMs < 30_000 && !waitOut.out.includes("STILL RUNNING"),
    `${waitMs}ms after the re-fill (poll 15s, budget ${env.FLEET_CTL_WAIT_MAX_SEC}s) out=${waitOut.out.slice(0, 160)}`);
  check("ctl wait merge: the line it prints names both lanes — the one it was watching and the one holding the seat",
    waitOut.out.includes("RECYCLED onto e2e-ctl-refilled") && waitOut.out.includes(lw.branch),
    `out=${waitOut.out.slice(0, 300)} watched=${lw.branch}`);
  check("ctl wait merge: the recycled answer is a NAMED non-answer with its own exit code, never a verdict",
    waitOut.code === 3 && waitOut.out.includes("a NON-ANSWER, not a verdict"),
    `exit ${waitOut.code} out=${waitOut.out.slice(0, 300)}`);
  await post(`/api/slots/${lw.slot}/kill`, {});
  if (modeBeforeRecycle !== null) await Bun.write(modeFile, modeBeforeRecycle);

  // === watch audit — both refusals ==============================================================
  const badSha = await ctl(["watch", "audit", "deadbeefdeadbeef", "--repo", REPO, "--json"]);
  check("ctl watch audit: a sha that names no commit is stopped HERE, before a request is built",
    badSha.code === 2 && badSha.err.includes("names no commit in"), `exit ${badSha.code} ${badSha.err.slice(0, 160)}`);
  const realSha = gitOut(REPO, "rev-parse", "main");
  const noAudit = await ctl(["watch", "audit", realSha, "--repo", REPO, "--json"]);
  check("ctl watch audit: the route's own refusal is passed through VERBATIM, and exits non-zero",
    noAudit.code === 1 && noAudit.err.includes("no persisted, queued, or running audit exists for that concrete land"),
    `exit ${noAudit.code} ${noAudit.err.slice(0, 200)}`);

  // === dispatch + report + events ===============================================================
  // PENDING, not queued, and that is the point of the verb: the unattended tick only ever takes a
  // QUEUED row, so a pending one can be started through this door alone — and no tick can race the
  // check by starting the fixture out from under it.
  const mkTask = async (text: string): Promise<string> => {
    const r = await post("/api/tasks", { text, kind: "auftrag", repo: REPO });
    return ((await r.json()) as { task?: { id: string } }).task?.id ?? "";
  };
  const taskId = await mkTask("ctl.sh probe row — dispatched by hand");
  const capRow = await mkTask("ctl.sh probe row — never started, only refused");
  check("ctl setup: two pending auftrag rows exist (one to start, one to be refused)",
    !!taskId && !!capRow, `${taskId} ${capRow}`);
  if (taskId && capRow) {
    const disp = await ctl(["dispatch", taskId, "--json"]);
    const dj = disp.json as { ok?: boolean; response?: { slot?: number }; openLanes?: number; cap?: number } | null;
    check("ctl dispatch: the row is started and the response carries the slot it opened",
      disp.code === 0 && dj?.ok === true && typeof dj.response?.slot === "number",
      `exit ${disp.code} ${JSON.stringify(dj).slice(0, 220)}`);
    const laneSlot = dj?.response?.slot ?? 0;

    // …and now one row IS `sent`, so a cap of 1 must stop the second row before any POST is made.
    const overCap = await ctl(["dispatch", capRow, "--json"], { FLEET_DISPATCH_MAX_LANES: "1" });
    const oj = overCap.json as { ok?: boolean; refused?: string; openLanes?: number; cap?: number } | null;
    // the DECIDING fields by name, not the whole object: the trail caps a detail at 2000 chars and
    // the row's own `task` payload ate the budget on the first red — the answer was truncated away
    // exactly where it was needed (helper + local run, 2026-09-07).
    check("ctl dispatch: over FLEET_DISPATCH_MAX_LANES it refuses before the POST, with the count and the cap",
      overCap.code === 1 && oj?.refused === "lane cap" && oj.cap === 1 && (oj.openLanes ?? 0) >= 1,
      `exit=${overCap.code} refused=${oj?.refused} cap=${oj?.cap} openLanes=${oj?.openLanes} ok=${oj?.ok}`);
    // `--json` prints the machine form and NOTHING else, so the human sentence is a second call —
    // and it has to be asked for, not assumed: a refusal that does not name the way out is a
    // refusal a session cannot act on. Safe to repeat: the cap is checked before any POST.
    const overCapText = await ctl(["dispatch", capRow], { FLEET_DISPATCH_MAX_LANES: "1" });
    check("ctl dispatch: the plain refusal names the cap, the count and --force",
      overCapText.code === 1 && overCapText.out.includes("REFUSED")
        && overCapText.out.includes("FLEET_DISPATCH_MAX_LANES") && overCapText.out.includes("--force"),
      overCapText.out.slice(0, 240));

    if (laneSlot) {
      // receiver evidence for the report: a watch on that exact lane occupant (server.ts,
      // clarificationReceiverFor — a program-less lane's only evidence is a lane watch).
      const wLane = await ctl(["watch", "lane", String(laneSlot), "--json"]);
      check("ctl watch lane: the subscription that makes this receiver the lane's coordinator is armed",
        wLane.code === 0 && (wLane.json as { watch?: { armed: boolean } })?.watch?.armed === true,
        `exit ${wLane.code} ${wLane.err.slice(0, 200)}`);
      const laneTok = await selfTokenOf(laneSlot);
      const filed = await fetch(`${BASE}/api/self/fleet-report`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-fleet-self-token": laneTok },
        body: JSON.stringify({ status: "complete", text: "ctl.sh probe report\nline two\n" }),
      });
      const fj = (await filed.json()) as { ok?: boolean; report?: { id: string; status: string } };
      check("ctl setup: the task lane files a fleet-report to this receiver",
        filed.ok && !!fj.report?.id, `${filed.status} ${JSON.stringify(fj).slice(0, 200)}`);

      if (fj.report?.id) {
        const rep = await ctl(["report", taskId, "--json"]);
        const rj = rep.json as { report?: { id: string; status: string; provenance: { taskId: string }; worker: { slot: number } } } | null;
        check("ctl report: it finds the newest report for THAT task and reports its id, status and worker",
          rep.code === 0 && rj?.report?.id === fj.report.id && rj.report.status === "complete"
            && rj.report.provenance.taskId === taskId && rj.report.worker.slot === laneSlot,
          `exit ${rep.code} ${JSON.stringify(rj?.report ?? null).slice(0, 220)}`);
        const repText = await ctl(["report", taskId]);
        check("ctl report: the plain rendering names the undecided verdict rather than omitting it",
          repText.code === 0 && repText.out.includes("decision UNDECIDED") && repText.out.includes("ctl.sh probe report"),
          repText.out.slice(0, 240));
        const repMissing = await ctl(["report", "0000000000000000"]);
        check("ctl report: a task with no visible report exits 1 and says how many it did see",
          repMissing.code === 1 && repMissing.err.includes("report(s) in total"),
          `exit ${repMissing.code} ${repMissing.err.slice(0, 160)}`);

        // === task — the dossier by task id, rendered ===========================================
        // A LIVE dispatched row: the route resolves it through its slot, and the verb prints one
        // line per source with the source named. Mutation caught: dropping any of the six lines,
        // or rendering the report's text instead of its head without --full.
        const branchNow = ((await (await get("/api/sessions")).json()) as
          { slots: { id: number; worktree?: { branch: string } | null }[] }).slots.find((s) => s.id === laneSlot)?.worktree?.branch ?? "";
        const tk = await ctl(["task", taskId]);
        const tkLines = tk.out.split("\n");
        const lineOf = (label: string): string => tkLines.find((l) => l.trimStart().startsWith(label)) ?? "";
        check("ctl task: a live row resolves to its lane via the slot, and each of the six facts is ONE line naming its source",
          tk.code === 0 && !!branchNow && tkLines[0] === `task ${taskId}: lane ${branchNow} (via live-slot)`
            && lineOf("status").includes("sent") && lineOf("status").endsWith("[fleet.json]")
            && lineOf("card").endsWith("[fleet.json card]")
            && lineOf("startplan").includes("not waiting (sent)")
            && lineOf("report").includes(fj.report.id) && lineOf("report").includes("UNDECIDED: ctl.sh probe report")
            && lineOf("report").endsWith("[fleet-reports]")
            && lineOf("outcome").includes("none — the lane has not ended") && lineOf("outcome").endsWith("[lane-outcomes.jsonl]")
            && lineOf("audit").endsWith("[post-land-audits.jsonl]")
            && !tk.out.includes("line two"),
          tk.out.slice(0, 900));
        const tkFull = await ctl(["task", taskId, "--full"]);
        check("ctl task --full: the row text and the report's full text are appended, and only then",
          tkFull.code === 0 && tkFull.out.includes("--- row text") && tkFull.out.includes("ctl.sh probe row — dispatched by hand")
            && tkFull.out.includes(`--- report ${fj.report.id}`) && tkFull.out.includes("line two"),
          tkFull.out.slice(-400));
        // a row that never started: no lane is an ANSWER (exit 0) with the start-plan reason on its line
        const tkPending = await ctl(["task", capRow]);
        check("ctl task: a pending row with no lane exits 0, says NO LANE, and prints its start-plan verdict instead of 'not waiting'",
          tkPending.code === 0 && tkPending.out.startsWith(`task ${capRow}: NO LANE — `)
            && /startplan (not released|released by)/.test(tkPending.out) && !tkPending.out.includes("not waiting")
            && tkPending.out.includes("none — no lane on record   [lane-outcomes.jsonl]"),
          tkPending.out.slice(0, 600));
        const tkGhost = await ctl(["task", "zz00notarow"]);
        check("ctl task: an id no source knows exits 1 and names the three sources it searched",
          tkGhost.code === 1 && tkGhost.out.includes("UNKNOWN") && tkGhost.out.includes("tasks-archive.jsonl"),
          `exit ${tkGhost.code} ${tkGhost.out.slice(0, 200)} ${tkGhost.err.slice(0, 200)}`);
        const tkBad = await ctl(["task", "../etc"]);
        check("ctl task: a malformed id is refused before any request (exit 2)",
          tkBad.code === 2 && tkBad.err.includes("not a queue row id"), `exit ${tkBad.code} ${tkBad.err.slice(0, 160)}`);

        // === events ============================================================================
        const ev = await ctl(["events", "--json"]);
        const evJson = ev.json as { events?: { id: string; kind: string; status: string }[] } | null;
        const apiSelf = (await (await fetch(`${BASE}/api/self`, { headers: { "x-fleet-self-token": selfTok } })).json()) as
          { events: { id: string; kind: string; status: string }[] };
        // ids and kinds, NOT status: a status moves on the server's own tick (pending → delivered)
        // and comparing it across two reads would be a race dressed as an assertion. The status is
        // checked as a VALUE instead — it must be one the state machine actually has.
        const STATUSES = ["pending", "send-uncertain", "delivered", "acknowledged", "receiver-gone",
          "subject-gone", "inbox", "blocked"];
        check("ctl events: the list is exactly the receiver's own events, by id and kind",
          ev.code === 0
            && JSON.stringify((evJson?.events ?? []).map((e) => [e.id, e.kind]))
              === JSON.stringify(apiSelf.events.map((e) => [e.id, e.kind]))
            && (evJson?.events ?? []).length > 0
            && (evJson?.events ?? []).every((e) => STATUSES.includes(e.status)),
          `ctl=${JSON.stringify((evJson?.events ?? []).map((e) => [e.id, e.kind, e.status]))} api=${JSON.stringify(apiSelf.events.map((e) => [e.id, e.kind]))}`);

        // Ack is only accepted on `delivered` / `send-uncertain`; a pending row was never offered.
        // So the precondition is polled and checked AS ITS OWN ROW — an ack check that ran with
        // nothing ackable would be green over nothing.
        let ackable = 0;
        for (let i = 0; i < 120; i++) {
          const s = (await (await fetch(`${BASE}/api/self`, { headers: { "x-fleet-self-token": selfTok } })).json()) as
            { events: { status: string }[] };
          ackable = s.events.filter((e) => e.status === "delivered" || e.status === "send-uncertain").length;
          if (ackable > 0) break;
          await Bun.sleep(250);
        }
        check("ctl events setup: at least one event reached an acknowledgeable state",
          ackable > 0, `${ackable} ackable`);
        if (ackable > 0) {
          const acked = await ctl(["events", "--ack", "--json"]);
          const aj = acked.json as { acked?: { id: string; ok: boolean }[] } | null;
          const after = (await (await fetch(`${BASE}/api/self`, { headers: { "x-fleet-self-token": selfTok } })).json()) as
            { events: { id: string; status: string }[] };
          const leftOpen = after.events.filter((e) => e.status === "delivered" || e.status === "send-uncertain");
          // the INVARIANT, not the count: whatever was ackable when the verb ran is closed, every
          // ack succeeded, and nothing acknowledgeable is left holding delivery budget. A `===
          // ackable` comparison would race the tick that can make one more event ackable meanwhile.
          check("ctl events --ack: every acknowledgeable event is closed, and none is left holding budget",
            acked.code === 0 && (aj?.acked ?? []).length >= 1
              && (aj?.acked ?? []).every((a) => a.ok) && leftOpen.length === 0,
            `acked=${JSON.stringify(aj?.acked ?? [])} left=${leftOpen.length}`);
        }
      }
      await post(`/api/slots/${laneSlot}/kill`, {});
    }
    // A PROBE MUST LEAVE THE QUEUE AS IT FOUND IT. Two later families read the WHOLE task list as
    // their own precondition — e2e/tasks.ts's backlog-nudge setup asserts "the only open row is a
    // pending kind:notiz", and the task-spawn tick fixture wants free slots and room under the lane
    // cap. Two rows left behind here took both of those down and, with them, 13 checks that were
    // never measured (helper run 2026-09-07: 17 red, 15 of them downstream of this). The delete
    // door refuses a `sent` row, so the row is polled off `sent` first — and the cleanup is its own
    // CHECK, because a tidy-up that silently did not happen is exactly the failure being removed.
    for (let i = 0; i < 80; i++) {
      const st = ((await (await get("/api/tasks")).json()) as { tasks: { id: string; status: string }[] })
        .tasks.find((t) => t.id === taskId)?.status;
      if (st !== "sent") break;
      await Bun.sleep(100);
    }
    for (const id of [taskId, capRow]) await post(`/api/tasks/${id}/delete`, {});
    const left = ((await (await get("/api/tasks")).json()) as { tasks: { id: string }[] })
      .tasks.filter((t) => t.id === taskId || t.id === capRow);
    check("ctl teardown: both probe rows are gone from the queue this module borrowed",
      left.length === 0, `still present: ${JSON.stringify(left.map((t) => t.id))}`);
  }

  // === lock =====================================================================================
  // A PRIVATE lock path, never the machine-wide one: this suite is itself holding /tmp/fleet-e2e.lock
  // through e2e-stage.sh, and a probe that reaped its own harness's mutex would be the worst
  // possible test. Three states are exercised, and the reap is refused in two of them.
  const dead = Bun.spawn(["true"]);
  const deadPid = dead.pid;
  await dead.exited;
  const writeLock = (pid: string | null, birth: string | null): void => {
    rmSync(LOCK, { recursive: true, force: true });
    mkdirSync(LOCK, { recursive: true });
    if (pid !== null) writeFileSync(`${LOCK}/pid`, `${pid}\n`);
    if (birth !== null) writeFileSync(`${LOCK}/birth`, `${birth}\n`);
  };

  rmSync(LOCK, { recursive: true, force: true });
  const lFree = await ctl(["lock", "--json"]);
  check("ctl lock: no directory is FREE and exits 0",
    lFree.code === 0 && (lFree.json as { state?: string })?.state === "free",
    `exit ${lFree.code} ${JSON.stringify(lFree.json).slice(0, 160)}`);

  writeLock(null, null);
  const lParked = await ctl(["lock", "--reap", "--json"]);
  const pj = lParked.json as { state?: string; reaped?: boolean; reapRefused?: string | null } | null;
  check("ctl lock --reap: a pid-LESS dir is PARKED and is never reaped, however long it sits",
    lParked.code === 1 && pj?.state === "parked" && pj.reaped === false
      && (pj.reapRefused ?? "").includes("not stale") && existsSync(LOCK),
    JSON.stringify(pj).slice(0, 220));

  const myBirth = (spawnSync("ps", ["-o", "lstart=", "-p", String(process.pid)],
    { encoding: "utf8", env: { ...process.env, LC_ALL: "C" } }).stdout ?? "").trim().replace(/\s+/g, " ");
  writeLock(String(process.pid), myBirth);
  const lHeld = await ctl(["lock", "--reap", "--json"]);
  const hj = lHeld.json as { state?: string; reaped?: boolean; birthState?: string } | null;
  check("ctl lock --reap: a live holder whose birth fingerprint MATCHES is HELD and survives the reap",
    lHeld.code === 1 && hj?.state === "held" && hj.birthState === "matched" && hj.reaped === false
      && existsSync(LOCK),
    `${JSON.stringify(hj).slice(0, 200)} birth=${myBirth ? "measured" : "UNMEASURABLE"}`);

  writeLock(String(deadPid), myBirth);
  const lStale = await ctl(["lock", "--json"]);
  check("ctl lock: a recorded pid that is gone reads STALE, and says nothing is running",
    (lStale.json as { state?: string })?.state === "stale"
      && (lStale.json as { holderAlive?: boolean })?.holderAlive === false,
    JSON.stringify(lStale.json).slice(0, 200));
  const lReap = await ctl(["lock", "--reap", "--json"]);
  const rj2 = lReap.json as { reaped?: boolean } | null;
  check("ctl lock --reap: the stale lock is removed and the verb then reports the machine as free",
    lReap.code === 0 && rj2?.reaped === true && !existsSync(LOCK),
    `exit ${lReap.code} ${JSON.stringify(rj2)} exists=${existsSync(LOCK)}`);
  rmSync(LOCK, { recursive: true, force: true });

  // === send --main ==============================================================================
  // The refusal matrix needs Programs BOUND to occupants in five different wrong states, and this
  // instance has none: binding one is a founding flow or a planted state behind a server restart,
  // and neither belongs in a module that shares its instance with every lane family after it. So
  // the matrix runs against a STUB of the two read routes and the /send door, which is the one
  // boundary the verb talks across — and the stub's two premises are measured against the REAL
  // routes first, so a stub that drifted from the server fails as the fixture it is.
  const msgFile = `${ROOT}/ctl-send-text.txt`;
  writeFileSync(msgFile, "ctl send probe text\n");
  const realSessions = (await (await get("/api/sessions")).json()) as { slots: Record<string, unknown>[] };
  const realPrograms = (await (await get("/api/programs")).json()) as { programs?: unknown };
  const realRow = realSessions.slots.find((s) => s.id === free) ?? {};
  check("ctl send setup: the real routes serve what the stub serves — `programs` is a list, and a session row carries openedAt, worktree and agent",
    Array.isArray(realPrograms.programs) && ["openedAt", "worktree", "agent"].every((k) => k in realRow),
    `programs=${Array.isArray(realPrograms.programs)} rowKeys=[${Object.keys(realRow).join(",")}]`);
  const unknownProgram = await ctl(["send", "--main", "0000feedfacefeedface0000", msgFile]);
  check("ctl send --main: a program this fleet does not have is refused against the REAL route, with its id, exit 1",
    unknownProgram.code === 1 && unknownProgram.err.includes("no program 0000feedfacefeedface0000")
      && unknownProgram.err.includes("nothing sent"),
    `exit ${unknownProgram.code} ${unknownProgram.err.slice(0, 200)}`);

  const sendPosts: { body: { slot?: number; text?: string; openedAt?: number }; auth: string | null }[] = [];
  const bound = (id: string, slot: number | null, openedAt: number, occupancy: string) =>
    ({ id, title: id, main: slot === null ? null : { slot, openedAt, sessionId: null, boundAt: 1 }, health: { occupancy } });
  const stub = Bun.serve({
    port: 0, hostname: "127.0.0.1",
    async fetch(req) {
      const path = new URL(req.url).pathname;
      if (path === "/api/programs") return Response.json({ programs: [
        bound("p-ok", 4, 1000, "live"), bound("p-lane", 5, 2000, "live"), bound("p-stale", 6, 3000, "stale"),
        bound("p-noagent", 7, 4000, "live"), bound("p-recycled", 8, 5000, "live"), bound("p-unbound", null, 0, "unbound"),
      ] });
      if (path === "/api/sessions") return Response.json({ slots: [
        { id: 4, cwd: "/main", openedAt: 1000, worktree: null, agent: "alive" },
        { id: 5, cwd: "/lane", openedAt: 2000, worktree: { repo: "/r", branch: "fleet/spawning" }, agent: "alive" },
        { id: 6, cwd: "/lane", openedAt: 3001, worktree: null, agent: "alive" },
        { id: 7, cwd: "/main", openedAt: 4000, worktree: null, agent: "no-agent" },
        { id: 8, cwd: "/main", openedAt: 5001, worktree: null, agent: "alive" },
      ] });
      if (path === "/send" && req.method === "POST") {
        const body = (await req.json()) as { slot?: number; text?: string; openedAt?: number };
        sendPosts.push({ body, auth: req.headers.get("authorization") });
        return Response.json({ ok: true, receipt: { sendId: "stub", at: 1, submitRequested: true, acceptance: "accepted",
          receiver: { slot: body.slot, openedAt: 1000, sessionId: null } } });
      }
      return new Response("not found", { status: 404 });
    },
  });
  const stubEnv = { FLEET_CTL_URL: `http://127.0.0.1:${stub.port}` };
  const sendLane = await ctl(["send", "--main", "p-lane", msgFile], stubEnv);
  check("ctl send --main: a MAIN slot that carries a LANE is refused, named, and nothing is POSTed",
    sendLane.code === 1 && sendLane.err.includes("slot 5 is a LANE (fleet/spawning)") && sendPosts.length === 0,
    `exit ${sendLane.code} posts=${sendPosts.length} ${sendLane.err.slice(0, 200)}`);
  const sendRecycled = await ctl(["send", "--main", "p-recycled", msgFile], stubEnv);
  check("ctl send --main: a slot whose occupant is not the bound one (openedAt differs) is refused as recycled, no POST",
    sendRecycled.code === 1 && sendRecycled.err.includes("a recycled slot") && sendPosts.length === 0,
    `exit ${sendRecycled.code} posts=${sendPosts.length} ${sendRecycled.err.slice(0, 200)}`);
  const sendStale = await ctl(["send", "--main", "p-stale", msgFile], stubEnv);
  check("ctl send --main: a binding the server calls stale is refused, no POST",
    sendStale.code === 1 && sendStale.err.includes("MAIN binding is stale") && sendPosts.length === 0,
    `exit ${sendStale.code} posts=${sendPosts.length} ${sendStale.err.slice(0, 200)}`);
  const sendNoAgent = await ctl(["send", "--main", "p-noagent", msgFile], stubEnv);
  check("ctl send --main: a MAIN slot with no agent alive is refused, naming the probe's answer, no POST",
    sendNoAgent.code === 1 && sendNoAgent.err.includes("no agent alive in slot 7 (agent=no-agent)") && sendPosts.length === 0,
    `exit ${sendNoAgent.code} posts=${sendPosts.length} ${sendNoAgent.err.slice(0, 200)}`);
  const sendUnbound = await ctl(["send", "--main", "p-unbound", msgFile, "--json"], stubEnv);
  check("ctl send --main: a Program with no bound MAIN is refused, its --json says sent:false, no POST",
    sendUnbound.code === 1 && sendUnbound.err.includes("has no bound MAIN")
      && (sendUnbound.json as { sent?: boolean })?.sent === false && sendPosts.length === 0,
    `exit ${sendUnbound.code} posts=${sendPosts.length} json=${JSON.stringify(sendUnbound.json)}`);
  const sendBare = await ctl(["send", "4", msgFile], stubEnv);
  check("ctl send: a bare slot number is refused with exit 2 and points at --main, no POST",
    sendBare.code === 2 && sendBare.err.includes("send --main") && sendPosts.length === 0,
    `exit ${sendBare.code} posts=${sendPosts.length} ${sendBare.err.slice(0, 160)}`);
  // the positive control LAST, so every "no POST" above is a count the stub could have raised
  const sendOk = await ctl(["send", "--main", "p-ok", msgFile, "--json"], stubEnv);
  check("ctl send --main: a live, non-lane MAIN with an agent gets exactly one POST — its slot, the bound openedAt pin, the file's text, the owner bearer",
    sendOk.code === 0 && (sendOk.json as { sent?: boolean; slot?: number })?.sent === true && sendPosts.length === 1
      && sendPosts[0]?.body.slot === 4 && sendPosts[0]?.body.openedAt === 1000
      && sendPosts[0]?.body.text === "ctl send probe text\n"
      && sendPosts[0]?.auth === `Bearer ${TOKEN}`,
    `exit ${sendOk.code} posts=${JSON.stringify(sendPosts.map((p) => p.body))} ${sendOk.err.slice(0, 160)}`);
  stub.stop(true);

  // === commit-main ==============================================================================
  // A throwaway HOME: its own git repo and its own fleet.json, so the commit lands in neither this
  // instance's tree nor anyone's checkout. The live half of the sensor still asks the REAL instance
  // (FLEET_CTL_URL stays BASE) — slot 999 is no lane there, so `busy` below comes from the persisted
  // `interrupted` verdict alone, which is the state the fixture controls.
  const CH = `${ROOT}/ctl-commit-home`;
  rmSync(CH, { recursive: true, force: true });
  mkdirSync(`${CH}/hooks-none`, { recursive: true });
  const cg = (...a: string[]): string => gitOut(CH, ...a);
  cg("init", "-q"); cg("config", "user.name", "ctl probe"); cg("config", "user.email", "ctl@probe");
  cg("config", "core.hooksPath", `${CH}/hooks-none`); cg("config", "commit.gpgsign", "false");
  writeFileSync(`${CH}/seed.txt`, "seed\n"); cg("add", "seed.txt"); cg("commit", "-qm", "seed");
  const commitMsg = `${ROOT}/ctl-commit-msg.txt`;
  writeFileSync(commitMsg, "chore: ctl commit-main probe\n");
  const busyState = JSON.stringify({ merges: { "999": { status: "interrupted", landed: false, at: 1 } }, slots: {} });
  writeFileSync(`${CH}/fleet.json`, busyState);
  writeFileSync(`${CH}/staged.txt`, "staged\n"); cg("add", "staged.txt");
  // FLEET_HUB_REMOTE is pinned EMPTY for the block below rather than left to whatever the process
  // inherited: "no hub configured" is a behaviour under test here (nothing pushed, nothing
  // claimed), and a suite that happened to run with the variable set would silently test the other
  // one. The hub checks further down set it explicitly, per run.
  const homeEnv = { FLEET_CTL_HOME: CH, FLEET_HUB_REMOTE: "" };
  const commitsBefore = cg("rev-list", "--count", "HEAD");

  const t0 = Date.now();
  const cmBusy = await ctl(["commit-main", "-m", commitMsg, "--budget", "2"], homeEnv);
  const busyMs = Date.now() - t0;
  check("ctl commit-main: while merges says busy it waits out the budget and refuses by name — nothing committed",
    cmBusy.code === 1 && cmBusy.err.includes("a land is running (slot 999) — nothing committed")
      && busyMs >= 1800 && cg("rev-list", "--count", "HEAD") === commitsBefore,
    `exit ${cmBusy.code} ${busyMs}ms commits ${commitsBefore}->${cg("rev-list", "--count", "HEAD")} ${cmBusy.err.slice(0, 200)}`);

  // the busy verdict clears WHILE the verb waits: it must commit, and only after the clear
  const t1 = Date.now();
  // tmp + rename, so the sensor never reads a half-written state file (the server's own save shape)
  const clearer = setTimeout(() => {
    writeFileSync(`${CH}/fleet.json.tmp`, JSON.stringify({ merges: {}, slots: {} }));
    renameSync(`${CH}/fleet.json.tmp`, `${CH}/fleet.json`);
  }, 2500);
  const cmWaited = await ctl(["commit", "main", "-m", commitMsg, "--budget", "60", "--json"], homeEnv);
  clearTimeout(clearer);
  const waitedMs = Date.now() - t1;
  check("ctl commit main: it waits for merges exit 0, then commits the staged index with the message file",
    cmWaited.code === 0 && (cmWaited.json as { committed?: boolean; sha?: string })?.committed === true
      && (cmWaited.json as { sha?: string })?.sha === cg("rev-parse", "HEAD") && waitedMs >= 2400
      && cg("log", "-1", "--format=%s") === "chore: ctl commit-main probe"
      && cg("show", "--name-only", "--format=", "HEAD") === "staged.txt",
    `exit ${cmWaited.code} ${waitedMs}ms head="${cg("log", "-1", "--format=%s")}" files=${cg("show", "--name-only", "--format=", "HEAD")} ${cmWaited.err.slice(0, 160)}`);

  const commitsMid = cg("rev-list", "--count", "HEAD");
  const cmNothing = await ctl(["commit-main", "-m", commitMsg], homeEnv);
  check("ctl commit-main: with nothing staged git's own refusal comes back, exit 1 — the verb stages nothing",
    cmNothing.code === 1 && cmNothing.err.includes("git commit in") && cmNothing.err.includes("nothing committed")
      && cg("rev-list", "--count", "HEAD") === commitsMid,
    `exit ${cmNothing.code} ${cmNothing.err.slice(0, 200)}`);

  writeFileSync(`${CH}/later.txt`, "later\n"); cg("add", "later.txt");
  const cmUnknown = await ctl(["commit-main", "-m", commitMsg], { ...homeEnv, FLEET_CTL_TOKEN: "", FLEET_TOKEN: "" });
  check("ctl commit-main: an unasked live half (no owner token) is UNKNOWN and refuses — never read as 'no land running'",
    cmUnknown.code === 1 && cmUnknown.err.includes("UNKNOWN") && cmUnknown.err.includes("nothing committed")
      && cg("rev-list", "--count", "HEAD") === commitsMid,
    `exit ${cmUnknown.code} ${cmUnknown.err.slice(0, 200)}`);
  const cmNoMsg = await ctl(["commit-main"], homeEnv);
  check("ctl commit-main: no -m is refused with exit 2 before the sensor is asked",
    cmNoMsg.code === 2 && cmNoMsg.err.includes("-m <msgfile>"), `exit ${cmNoMsg.code} ${cmNoMsg.err.slice(0, 160)}`);
  // NOT read off the human line: `--json` prints the object INSTEAD of those lines, so asserting
  // the sentence here would be asserting the output mode, not the behaviour. The JSON carries the
  // whole claim — `pushed: null` is "not attempted", distinct from the `false` a refusal writes,
  // and no `hub` key at all is the "nothing is claimed" half.
  check("ctl commit-main: with no FLEET_HUB_REMOTE nothing is pushed and nothing is claimed about one",
    (cmWaited.json as { pushed?: unknown })?.pushed === null
      && !("hub" in ((cmWaited.json ?? {}) as Record<string, unknown>)),
    `json=${JSON.stringify(cmWaited.json)}`);

  // --- W5d: THE PUSH HALF. A direct commit that stays on one host is the window that strands the
  // NEXT land here, so the commit and its push are one move — and a refused push is a named state
  // of its own, never a silent success and never a rewritten commit.
  const HUBD = `${ROOT}/ctl-commit-hub.git`;
  const OTHER = `${ROOT}/ctl-commit-other`;
  for (const p of [HUBD, OTHER]) rmSync(p, { recursive: true, force: true });
  const hubInit = spawnSync("git", ["init", "-q", "--bare", "-b", "main", HUBD], { encoding: "utf8" });
  cg("branch", "-M", "main");
  cg("remote", "add", "hub", HUBD);
  const seeded = cg("push", "-q", "hub", "main");
  const hubEnv = { FLEET_CTL_HOME: CH, FLEET_HUB_REMOTE: "hub" };
  const hubHead = (): string => gitOut(HUBD, "rev-parse", "main");
  check("(setup) a bare hub exists and the throwaway home can reach it as remote `hub`",
    hubInit.status === 0 && hubHead() === cg("rev-parse", "HEAD"),
    `init=${hubInit.status} hub=${hubHead().slice(0, 8)} home=${cg("rev-parse", "HEAD").slice(0, 8)} push=${seeded}`);

  writeFileSync(`${CH}/pushed.txt`, "pushed\n"); cg("add", "pushed.txt");
  const cmPush = await ctl(["commit-main", "-m", commitMsg, "--json"], hubEnv);
  check("ctl commit-main: with a hub configured the commit is pushed ff-only in the same move",
    cmPush.code === 0 && (cmPush.json as { pushed?: boolean })?.pushed === true
      && (cmPush.json as { sha?: string })?.sha === cg("rev-parse", "HEAD")
      && hubHead() === cg("rev-parse", "HEAD"),
    `exit=${cmPush.code} json=${JSON.stringify(cmPush.json)} hub=${hubHead().slice(0, 8)} home=${cg("rev-parse", "HEAD").slice(0, 8)}`);

  // the hub moves on under us, exactly as the other landing host would move it
  const cloned2 = spawnSync("git", ["clone", "-q", HUBD, OTHER], { encoding: "utf8" });
  for (const kv of [["user.email", "ctl@probe"], ["user.name", "ctl probe"], ["commit.gpgsign", "false"]])
    gitOut(OTHER, "config", kv[0] as string, kv[1] as string);
  writeFileSync(`${OTHER}/foreign.txt`, "the other host\n");
  gitOut(OTHER, "add", "foreign.txt"); gitOut(OTHER, "commit", "-qm", "foreign");
  gitOut(OTHER, "push", "-q", "origin", "main");
  const hubAhead = hubHead();
  writeFileSync(`${CH}/stranded.txt`, "stranded\n"); cg("add", "stranded.txt");
  const headBeforeRefusal = cg("rev-parse", "HEAD");
  const cmRefused = await ctl(["commit-main", "-m", commitMsg, "--json"], hubEnv);
  check("ctl commit-main: a hub that moved on is exit 3 — the commit STANDS here and the refusal says so",
    cmRefused.code === 3 && (cmRefused.json as { committed?: boolean })?.committed === true
      && (cmRefused.json as { pushed?: boolean })?.pushed === false
      // the commit really happened: HEAD moved and carries the staged file
      && cg("rev-parse", "HEAD") !== headBeforeRefusal
      && cg("show", "--name-only", "--format=", "HEAD") === "stranded.txt"
      && cmRefused.err.includes("IS COMMITTED"),
    `exit=${cmRefused.code} committed=${JSON.stringify((cmRefused.json as { committed?: unknown })?.committed)} head=${headBeforeRefusal.slice(0, 8)}->${cg("rev-parse", "HEAD").slice(0, 8)} err=${cmRefused.err.slice(0, 200)}`);
  check("…and the refusal names the repair rather than describing the problem — fetch, rebase, push, none of them run for you",
    typeof (cmRefused.json as { fix?: unknown })?.fix === "string"
      && /fetch hub/.test((cmRefused.json as { fix: string }).fix)
      && /rebase hub\/main/.test((cmRefused.json as { fix: string }).fix)
      && /push hub HEAD:refs\/heads\/main/.test((cmRefused.json as { fix: string }).fix)
      // and it did NOT quietly run any of them: the hub is untouched and HEAD was not rewritten
      && hubHead() === hubAhead,
    `fix=${JSON.stringify((cmRefused.json as { fix?: unknown })?.fix)} hub=${hubHead().slice(0, 8)} want=${hubAhead.slice(0, 8)}`);
  for (const p of [HUBD, OTHER]) rmSync(p, { recursive: true, force: true });
  for (const p of [CH, msgFile, commitMsg]) rmSync(p, { recursive: true, force: true });

  // === credentials ==============================================================================
  // Every verb must name the credential it is missing rather than failing as the route.
  const noToken = await ctl(["ctx", String(free)], { FLEET_CTL_TOKEN: "", FLEET_TOKEN: "", FLEET_CTL_HOME: "/nonexistent-ctl-home" });
  check("ctl credentials: a verb with no owner token exits 2 and names FLEET_CTL_TOKEN",
    noToken.code === 2 && noToken.err.includes("FLEET_CTL_TOKEN"), `exit ${noToken.code} ${noToken.err.slice(0, 160)}`);
  const noSelf = await ctl(["events"], { FLEET_SELF_TOKEN: "" });
  check("ctl credentials: a self verb with no self token exits 2 and names FLEET_SELF_TOKEN",
    noSelf.code === 2 && noSelf.err.includes("FLEET_SELF_TOKEN"), `exit ${noSelf.code} ${noSelf.err.slice(0, 160)}`);

  await post(`/api/slots/${free}/kill`, {});
}
