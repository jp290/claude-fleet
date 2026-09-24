// Small pure P1-B family. The validator receives all facts; only this fixture reads the real tree.
// Direct entry point (no server, tmux, or network): bun e2e/context-packs.ts
// The SERVER-BACKED half at the bottom needs an isolated instance (FLEET_SOCK/FLEET_PORT, as the
// runner sets them) and skips itself, under its own name, in a direct run.
import { dirname, join, resolve } from "node:path";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import {
  CONTEXT_PACK_CAPABILITIES,
  CONTEXT_PACK_HARNESSES,
  CONTEXT_PACKS,
  type ContextPackCapability,
  type ContextPackHarness,
  type ContextPackMode,
  type ContextPackTrigger,
} from "../context-packs";
import { USE_WHEN_MAX, validateContextPacks, type ContextPackRepoFacts } from "../context-pack-validator";
import { CONTEXT_MANIFEST_PATH, planRepoContext, readContextManifest } from "../context-manifest";

export type ContextPackCheck = (name: string, ok: boolean, detail?: string) => void;

type MutablePack = Record<string, any>;
const clonePacks = (): MutablePack[] => JSON.parse(JSON.stringify(CONTEXT_PACKS)) as MutablePack[];
const hasCode = (result: ReturnType<typeof validateContextPacks>, code: string): boolean =>
  result.issues.some((issue) => issue.code === code);
const issueSummary = (result: ReturnType<typeof validateContextPacks>): string =>
  `${result.verdict}: ${result.issues.map((issue) => `${issue.code}:${issue.packId}`).join(",") || "no issues"}`;

function fullCapabilities(): Map<string, readonly ContextPackCapability[]> {
  return new Map(CONTEXT_PACK_HARNESSES.map((harness) => [harness, [...CONTEXT_PACK_CAPABILITIES]]));
}

function manifestSourcePaths(): string[] {
  const paths = new Set<string>();
  for (const pack of CONTEXT_PACKS) {
    if (!("sources" in pack) || !Array.isArray(pack.sources)) continue;
    for (const source of pack.sources) paths.add(source.path);
  }
  return [...paths].sort();
}

function collectRepoFacts(): { facts: ContextPackRepoFacts | null; error: string | null } {
  try {
    // A direct run starts in the checkout. e2e-isolated starts in a non-git staged copy whose
    // node_modules symlink is its sole pointer to that checkout; use it only when the local probe
    // says this is the staged shape.
    let root = resolve(import.meta.dir, "..");
    const gitAt = (candidate: string) => spawnSync("git", ["-C", candidate, "ls-files", "-z"], {
      encoding: "utf8",
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
      maxBuffer: 16 * 1024 * 1024,
    });
    let git = gitAt(root);
    if (git.status !== 0) {
      const modules = realpathSync(resolve(root, "node_modules"));
      root = dirname(modules);
      git = gitAt(root);
    }
    if (git.status !== 0)
      return { facts: null, error: (git.stderr || `git ls-files exited ${String(git.status)}`).trim() };
    const trackedPaths = new Set(git.stdout.split("\0").filter(Boolean));
    const sourceBytes = new Map<string, string>();
    for (const path of manifestSourcePaths()) {
      try { sourceBytes.set(path, readFileSync(resolve(root, path), "utf8")); }
      catch (error) {
        return { facts: null, error: `could not read fixture source ${path}: ${error instanceof Error ? error.message : String(error)}` };
      }
    }
    return { facts: { trackedPaths, sourceBytes }, error: null };
  } catch (error) {
    return { facts: null, error: `could not locate fixture tree: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// THE SOURCE CHECKOUT, WHICH IS NOT ALWAYS THE TREE THIS RUN STANDS IN. Measured 2026-08-27 in
// e2e-isolated: the staged instance `git init`s a repository of its own, so "is there a git repo
// here" answers YES in the staged shape and never reaches the checkout — and the staged copy carries
// no `.fleet/` at all. The node_modules symlink is the instance's one pointer home. So both
// candidates are TRIED, and the one that actually holds a readable manifest wins; a run that finds
// the manifest in neither says so under its own name rather than reporting an undelivered pack.
type SourceCheckout = { readonly root: string; readonly manifest: string; readonly trackedPaths: ReadonlySet<string> };
function sourceCheckout(): { checkout: SourceCheckout | null; error: string | null } {
  const here = resolve(import.meta.dir, "..");
  const candidates = [here];
  try { candidates.push(dirname(realpathSync(resolve(here, "node_modules")))); } catch { /* no pointer home */ }
  const why: string[] = [];
  for (const root of candidates) {
    let manifest: string;
    try { manifest = readFileSync(resolve(root, CONTEXT_MANIFEST_PATH), "utf8"); }
    catch { why.push(`${root}: no ${CONTEXT_MANIFEST_PATH}`); continue; }
    const git = spawnSync("git", ["-C", root, "ls-files", "-z"], {
      encoding: "utf8",
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
      maxBuffer: 16 * 1024 * 1024,
    });
    if (git.status !== 0) { why.push(`${root}: git ls-files exited ${String(git.status)}`); continue; }
    return { checkout: { root, manifest, trackedPaths: new Set(git.stdout.split("\0").filter(Boolean)) }, error: null };
  }
  return { checkout: null, error: why.join("; ") || "no candidate tree" };
}

export async function run(externalCheck?: ContextPackCheck): Promise<void> {
  const rows: string[] = [];
  let failures = 0;
  const check: ContextPackCheck = externalCheck ?? ((name, ok, detail = "") => {
    rows.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
    if (!ok) failures++;
  });

  const fixture = collectRepoFacts();
  check("context packs: the closed harness vocabulary includes the pi-zai adapter",
    (CONTEXT_PACK_HARNESSES as readonly string[]).includes("pi-zai"), CONTEXT_PACK_HARNESSES.join(","));
  check("context packs: the closed harness vocabulary includes the pi-ox adapter",
    (CONTEXT_PACK_HARNESSES as readonly string[]).includes("pi-ox"), CONTEXT_PACK_HARNESSES.join(","));
  check("context packs fixture: tracked paths and source bytes were explicitly collected",
    fixture.facts !== null, fixture.error ?? `${fixture.facts?.trackedPaths.size ?? 0} tracked paths`);
  if (fixture.facts) {
    const capabilities = fullCapabilities();
    const real = validateContextPacks({ packs: CONTEXT_PACKS, repo: fixture.facts, capabilities });
    check("context packs: real six-pack manifest resolves", real.verdict === "pass" && real.issues.length === 0,
      issueSummary(real));

    const missingPath = clonePacks();
    missingPath[0].sources[0].path = "docs/not-a-tracked-context-source.md";
    const missingPathResult = validateContextPacks({ packs: missingPath, repo: fixture.facts, capabilities });
    check("context packs: missing tracked path has a concrete code",
      missingPathResult.verdict === "fail" && hasCode(missingPathResult, "SOURCE_PATH_MISSING"),
      issueSummary(missingPathResult));

    const missingAnchor = clonePacks();
    missingAnchor[0].sources[0].anchor = "## Anchor that is deliberately absent";
    const missingAnchorResult = validateContextPacks({ packs: missingAnchor, repo: fixture.facts, capabilities });
    check("context packs: missing anchor has a concrete code",
      missingAnchorResult.verdict === "fail" && hasCode(missingAnchorResult, "SOURCE_ANCHOR_MISSING"),
      issueSummary(missingAnchorResult));

    const duplicate = clonePacks();
    duplicate.push(JSON.parse(JSON.stringify(duplicate[0])) as MutablePack);
    const duplicateResult = validateContextPacks({ packs: duplicate, repo: fixture.facts, capabilities });
    check("context packs: duplicate id has a concrete code",
      duplicateResult.verdict === "fail" && hasCode(duplicateResult, "ID_DUPLICATE"),
      issueSummary(duplicateResult));

    const cycle = clonePacks();
    cycle[0].supersedes = cycle[1].id;
    cycle[1].supersedes = cycle[0].id;
    const cycleResult = validateContextPacks({ packs: cycle, repo: fixture.facts, capabilities });
    check("context packs: supersedes cycle has a concrete code",
      cycleResult.verdict === "fail" && hasCode(cycleResult, "SUPERSEDES_CYCLE"),
      issueSummary(cycleResult));

    const missingCapabilities = fullCapabilities();
    const codexCapabilities = missingCapabilities.get("codex")!.filter((capability) => capability !== "tracked-source-read");
    missingCapabilities.set("codex", codexCapabilities);
    const missingCapabilityResult = validateContextPacks({
      packs: CONTEXT_PACKS, repo: fixture.facts, capabilities: missingCapabilities,
    });
    check("context packs: hard-pack missing capability names pack, harness, and capability",
      missingCapabilityResult.verdict === "fail"
      && missingCapabilityResult.issues.some((issue) => issue.code === "REQUIRED_CAPABILITY_MISSING"
        && issue.packId === "portable-core" && issue.harness === "codex" && issue.capability === "tracked-source-read"),
      issueSummary(missingCapabilityResult));

    const privateLeak = clonePacks();
    const privatePack = privateLeak.find((pack) => pack.audience === "private-ops")!;
    privatePack.sources = [{ path: "private-location", anchor: "private-symbol" }];
    privatePack.privatePath = "private-location";
    privatePack.sourceHash = "not-a-sha256";
    const privateLeakResult = validateContextPacks({ packs: privateLeak, repo: fixture.facts, capabilities });
    check("context packs: private source leak and malformed hash fail their own shape codes",
      privateLeakResult.verdict === "fail" && hasCode(privateLeakResult, "PRIVATE_SOURCE_LEAK")
        && hasCode(privateLeakResult, "PRIVATE_SOURCE_HASH_INVALID"),
      issueSummary(privateLeakResult));

    // useWhen is PURPOSE, one line, and it is delivered verbatim into a brief — so the seeds are
    // held to the same bound the validator enforces, and the field's ABSENCE stays legal because
    // repo manifests written before it exist and must keep validating.
    check("context packs: every seed states one bounded line of purpose",
      CONTEXT_PACKS.every((pack) => typeof pack.useWhen === "string" && !/[\r\n]/.test(pack.useWhen)
        && pack.useWhen.trim().length >= 1 && pack.useWhen.trim().length <= USE_WHEN_MAX),
      CONTEXT_PACKS.map((pack) => `${pack.id}:${pack.useWhen.length}`).join(","));

    const noUseWhen = clonePacks();
    for (const pack of noUseWhen) delete pack.useWhen;
    const noUseWhenResult = validateContextPacks({ packs: noUseWhen, repo: fixture.facts, capabilities });
    check("context packs: a manifest that states no useWhen at all still validates (absence is a date, not a defect)",
      noUseWhenResult.verdict === "pass" && noUseWhenResult.issues.length === 0,
      issueSummary(noUseWhenResult));

    for (const [label, value] of [
      ["over the length bound", "x".repeat(USE_WHEN_MAX + 1)],
      ["multi-line", "purpose line one\nline two"],
      ["blank after trimming", "   "],
      ["not a string", 42],
    ] as const) {
      const bad = clonePacks();
      bad[0].useWhen = value;
      const badResult = validateContextPacks({ packs: bad, repo: fixture.facts, capabilities });
      check(`context packs: a useWhen ${label} fails as USE_WHEN_INVALID on its own pack`,
        badResult.verdict === "fail" && badResult.issues.some((issue) =>
          issue.code === "USE_WHEN_INVALID" && issue.packId === "portable-core"),
        issueSummary(badResult));
    }

    const openVocabulary = clonePacks();
    openVocabulary[0].triggers = ["free-form-trigger"];
    const openVocabularyResult = validateContextPacks({ packs: openVocabulary, repo: fixture.facts, capabilities });
    check("context packs: closed vocabulary rejects a free trigger string",
      openVocabularyResult.verdict === "fail" && hasCode(openVocabularyResult, "TRIGGER_UNKNOWN"),
      issueSummary(openVocabularyResult));

    const copiedProse = clonePacks();
    copiedProse[0].sources[0].content = "copied source prose is forbidden";
    copiedProse[0].sources[0].anchor = "This sentence is copied prose rather than an identifier";
    const copiedProseResult = validateContextPacks({ packs: copiedProse, repo: fixture.facts, capabilities });
    check("context packs: strict source shape rejects content fields and prose-shaped anchors",
      copiedProseResult.verdict === "fail" && hasCode(copiedProseResult, "SOURCE_CONTENT_FORBIDDEN")
        && hasCode(copiedProseResult, "SOURCE_ANCHOR_INVALID"),
      issueSummary(copiedProseResult));

    const missingBytes = new Map(fixture.facts.sourceBytes);
    missingBytes.delete("AGENTS.md");
    const unknownResult = validateContextPacks({
      packs: CONTEXT_PACKS,
      repo: { trackedPaths: fixture.facts.trackedPaths, sourceBytes: missingBytes },
      capabilities,
    });
    check("context packs: absent injected bytes are explicit unknown, never pass or false",
      unknownResult.verdict === "unknown" && hasCode(unknownResult, "SOURCE_BYTES_UNKNOWN"),
      issueSummary(unknownResult));

    const repeatA = validateContextPacks({ packs: cycle, repo: fixture.facts, capabilities });
    const repeatB = validateContextPacks({ packs: cycle, repo: fixture.facts, capabilities });
    check("context packs: repeated validation is byte-deterministic",
      JSON.stringify(repeatA) === JSON.stringify(repeatB), JSON.stringify(repeatA.issues));
  }

  // ================================================================================================
  // FLEET'S OWN TRACKED MANIFEST, PLANNED WITH THE REAL DISPATCH FACTS
  // ================================================================================================
  // e2e/pins.ts already proves the tracked manifest VALIDATES. Valid is not delivered: a pack can be
  // impeccable and still be omitted by every rule of the ladder, and the omission row is invisible
  // unless somebody reads a receipt. This block asserts the other half for the one pointer whose
  // whole purpose is that a lane sees it before it starts measuring — the measurement-note index.
  //
  // THE DELIVERY FACTS ARE READ OUT OF server.ts, NEVER RESTATED HERE. Restating them would make
  // this check pass against a seam that has since stopped passing `always` or stopped granting
  // `tracked-source-read` — it would assert its own fixture. The three constants are the entire
  // supply of dispatch facts (e2e/pins.ts RULE_REACH pins that same call site), so a probe that
  // cannot find them fails UNDER ITS OWN NAME rather than as "the pack is not delivered".
  const RULE_INDEX = "context manifest: the measurement-note index is delivered to a dispatched lane";
  const INDEX_PACK = "messnotiz-index";
  const INDEX_SOURCE = { path: "docs/messungen/INDEX.md", anchor: "# Index der Messnotizen" };
  const source = sourceCheckout();
  if (source.checkout === null) {
    check(`${RULE_INDEX} — PROBE: a checkout carrying the tracked manifest was located`, false, source.error ?? "");
  } else {
    const { root, trackedPaths } = source.checkout;
    const readAt = (path: string): string | null => {
      try { return readFileSync(resolve(root, path), "utf8"); } catch { return null; }
    };
    const server = readAt("server.ts");
    const listOf = (name: string, kind: string): string[] | null => {
      if (server === null) return null;
      const match = new RegExp(`const ${name}: readonly ${kind}\\[\\] = \\[([^\\]]*)\\]`).exec(server);
      // `[a-z0-9-]` and not `[a-z-]`: `e2e-run` carries a digit, and the narrower class dropped it
      // silently — a capability set short by one reads exactly like a capability the seam withholds.
      return match ? [...match[1].matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]) : null;
    };
    const modeMatch = server === null ? null : /const DISPATCH_CONTEXT_MODE: ContextPackMode = "([a-z-]+)";/.exec(server);
    const triggers = listOf("DISPATCH_CONTEXT_TRIGGERS", "ContextPackTrigger");
    const capabilities = listOf("DISPATCH_CONTEXT_CAPABILITIES", "ContextPackCapability");
    const manifest = readContextManifest(source.checkout.manifest);

    if (server === null || !modeMatch || !triggers || !capabilities || manifest.kind !== "packs")
      check(`${RULE_INDEX} — PROBE: the manifest parsed and the three dispatch constants were read`, false,
        `root=${root} server=${server === null ? "unreadable" : "ok"} manifest=${manifest.kind}`
          + ` mode=${modeMatch?.[1] ?? "not found"} triggers=${triggers ?? "not found"} capabilities=${capabilities ?? "not found"}`);
    else {
      // Only tracked, readable sources reach the validator — exactly what repoManifestContextPlan
      // hands it at the seam. A source this probe could not read must stay OUT, so an unchecked
      // anchor is reported as unchecked instead of hopefully delivered.
      const sourceBytes = new Map<string, string>();
      for (const path of manifest.referencedPaths) {
        if (!trackedPaths.has(path)) continue;
        const bytes = readAt(path);
        if (bytes !== null) sourceBytes.set(path, bytes);
      }
      const plan = planRepoContext({
        manifest,
        repo: { trackedPaths, sourceBytes },
        facts: {
          harness: "claude",
          mode: modeMatch[1] as ContextPackMode,
          triggers: triggers as ContextPackTrigger[],
          capabilities: capabilities as ContextPackCapability[],
        },
      });
      const selection = plan.selected.find((pack) => pack.id === INDEX_PACK);
      const omission = plan.omitted.find((pack) => pack.id === INDEX_PACK);
      check(`${RULE_INDEX}, with its own anchor`,
        selection !== undefined && omission === undefined
          && JSON.stringify(selection.sources) === JSON.stringify([INDEX_SOURCE]),
        `selected=[${plan.selected.map((pack) => pack.id).join(",")}]`
          + ` omitted=[${plan.omitted.map((pack) => `${pack.id}:${pack.why}`).join(",")}]`
          + ` sources=${JSON.stringify(selection?.sources ?? null)}`);
    }
  }

  // ================================================================================================
  // SERVER-BACKED HALF: the founding-window plan route and the `packs` field (Gruendungsfenster B2a)
  // ================================================================================================
  await foundingPacksServerHalf(check);

  if (!externalCheck) {
    console.log(rows.join("\n"));
    console.log(failures ? `\n${failures} FAILURES` : "\nALL PASS");
    if (failures) process.exitCode = 1;
  }
}

// One receipt as the founding seam writes it; only the fields the checks below read are typed.
interface FoundingReceiptRow {
  id: string; at: number; repo: string; head: string; branch: string;
  slot: number; harness: string | null; mode: string; triggers: string[];
  selected: { id: string; anchors: unknown; sourceHash?: string }[];
  omitted: { id: string; why: string }[];
  deliveredBytes: number; renderer: string;
  briefHash?: string | null; briefSource?: string;
}

// server-side receipt hash, verbatim — the join is only worth asserting if the test recomputes it
// the way the ledger's writer does (the supervisor family's promptHash, over this seam's brief).
const foundingReceiptHash = (prompt: string, receipt: FoundingReceiptRow): string => {
  const anchorAt = prompt.indexOf("\n\nContextPlan v2 anchors");
  const anchorBlock = anchorAt >= 0 ? prompt.slice(anchorAt) : "";
  return createHash("sha256").update(JSON.stringify({
    anchorBlock,
    planFacts: { harness: receipt.harness, mode: receipt.mode, triggers: receipt.triggers,
      selected: receipt.selected, omitted: receipt.omitted },
  })).digest("hex");
};

async function foundingPacksServerHalf(check: ContextPackCheck): Promise<void> {
  // The runner environment is the one pair of variables both halves of the isolated suite share;
  // a direct `bun e2e/context-packs.ts` has neither and gets this half's skip line instead.
  if (!process.env.FLEET_SOCK || !process.env.FLEET_PORT) {
    console.log("SKIP  founding packs server half: no isolated instance env (FLEET_SOCK/FLEET_PORT)");
    return;
  }
  const { BASE, ROOT, get, post } = await import("./harness");

  // --- the fixture: a target repo whose committed manifest declares one deliverable pack and one
  // broken pointer. Built in tmpdir (the stand-in precedent: outside the tree the server reads
  // head facts from), committed, so the plan route and the doors read it AT a commit.
  const fixture = mkdtempSync(join(tmpdir(), "fleet-e2e-founding-packs-"));
  const gitIn = (...args: string[]) =>
    spawnSync("git", ["-C", fixture, ...args], { encoding: "utf8" });
  const packEntry = (over: Record<string, unknown>): Record<string, unknown> => ({
    scope: "product-quality", audience: "agent", triggers: ["always"], hardness: "guidance",
    requiredCapabilities: ["tracked-source-read"], harnesses: ["claude", "codex", "pi"],
    modes: ["read-only", "mutating"], estimatedBytes: 900, evidence: "tree-anchor",
    owner: "owner", status: "active", ...over,
  });
  mkdirSync(join(fixture, "docs"), { recursive: true });
  mkdirSync(join(fixture, ".fleet"), { recursive: true });
  writeFileSync(join(fixture, "AGENTS.md"), "# Target contract\n\n## Repo contract\nProve with the repo's own chain.\n");
  writeFileSync(join(fixture, "docs", "promise.md"), "# Promise\n\n## Product promise\nThe first minute must feel good.\n");
  writeFileSync(join(fixture, ".fleet", "context-packs.json"), JSON.stringify([
    packEntry({ id: "promise-anchor", useWhen: "The repo's own contract, before the first act.", sources: [
      { path: "AGENTS.md", anchor: "## Repo contract" },
      { path: "docs/promise.md", anchor: "## Product promise" }] }),
    packEntry({ id: "broken-pointer", scope: "repo-contract",
      sources: [{ path: "docs/absent.md", anchor: "## Never tracked" }] }),
  ], null, 2));
  gitIn("init", "-q", "-b", "main");
  gitIn("config", "user.email", "t@t");
  gitIn("config", "user.name", "t");
  gitIn("config", "commit.gpgsign", "false");
  gitIn("add", "-A");
  const fixtureReady = gitIn("commit", "-qm", "declare context packs").status === 0;
  check("founding packs: the fixture repo carries the manifest and its sources at a real commit",
    fixtureReady && gitIn("ls-files", "--error-unmatch", ".fleet/context-packs.json").status === 0,
    fixture);

  const planRoute = async (query: string): Promise<{ status: number; body: Record<string, unknown> }> => {
    const res = await get(`/api/founding-plan${query}`);
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  const receipts = async (): Promise<{ receipts: FoundingReceiptRow[]; total: number }> =>
    (await (await get("/api/context-receipts")).json()) as { receipts: FoundingReceiptRow[]; total: number };
  const sessions = async (): Promise<{ slots: { id: number; cwd: string | null }[] }> =>
    (await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] };
  const freeSlot = async (): Promise<number | null> =>
    (await sessions()).slots.find((s) => !s.cwd)?.id ?? null;
  const worktreeCount = (): number =>
    gitIn("worktree", "list").stdout.split("\n").filter((line) => line.startsWith("worktree ")).length;
  const opened: number[] = [];
  const kill = async (slot: number): Promise<void> => { await post(`/api/slots/${slot}/kill`, {}); };

  if (fixtureReady) {
    // --- (a) the plan route, and its refusals ---
    const [noRepo, badMode, badHarness] = await Promise.all([
      planRoute("?mode=main"), planRoute(`?repo=${encodeURIComponent(fixture)}&mode=bogus`),
      planRoute(`?repo=${encodeURIComponent(fixture)}&mode=main&harness=not-a-harness`),
    ]);
    const noRepoText = JSON.stringify(noRepo.body);
    const badModeText = JSON.stringify(badMode.body);
    const badHarnessText = JSON.stringify(badHarness.body);
    check("founding plan: the route refuses a missing repo, an unknown mode, and an unknown harness by name",
      noRepo.status === 400 && noRepoText.includes("repo is required")
        && badMode.status === 400 && badModeText.includes("mode must be 'main' or 'lane'")
        && badHarness.status === 400 && badHarnessText.includes("unknown harness"),
      `${noRepo.status}:${noRepoText} | ${badMode.status}:${badModeText} | ${badHarness.status}:${badHarnessText}`);

    const plan = await planRoute(`?repo=${encodeURIComponent(fixture)}&mode=main&harness=claude`);
    const selected = Array.isArray(plan.body.selected) ? plan.body.selected as { id: string; bytes?: number; source?: string }[] : [];
    const omitted = Array.isArray(plan.body.omitted) ? plan.body.omitted as { id: string; reason?: string }[] : [];
    const promiseRow = selected.find((pack) => pack.id === "promise-anchor");
    check("founding plan: the repo pack is selected with its declared bytes and its source named",
      plan.status === 200 && !!promiseRow && promiseRow.bytes === 900 && promiseRow.source === "repo-manifest",
      JSON.stringify(plan.body).slice(0, 300));
    const manifestIds = ["promise-anchor", "broken-pointer"];
    const namedOnce = manifestIds.every((id) =>
      selected.filter((pack) => pack.id === id).length + omitted.filter((pack) => pack.id === id).length === 1);
    check("founding plan: every manifest pack id appears exactly once across selected and omitted",
      plan.status === 200 && namedOnce,
      `selected=[${selected.map((p) => p.id).join(",")}] omitted=[${omitted.map((p) => p.id).join(",")}]`);
    const brokenRow = omitted.find((pack) => pack.id === "broken-pointer");
    check("founding plan: the broken pointer is an omitted row naming its own reason",
      !!brokenRow && brokenRow.reason === "manifest-invalid",
      JSON.stringify(brokenRow ?? null));
    const seedOmissions = ["portable-core", "verify-e2e"].map((id) =>
      omitted.find((pack) => pack.id === id));
    check("founding plan: the Fleet seeds stay named omissions on a foreign target repo",
      seedOmissions.every((row) => !!row && row.reason === "source-unavailable"),
      JSON.stringify(seedOmissions));

    const lanePlan = await planRoute(`?repo=${encodeURIComponent(fixture)}&mode=lane`);
    const laneSelected = Array.isArray(lanePlan.body.selected) ? lanePlan.body.selected as { id: string }[] : [];
    check("founding plan: the lane mode plans the same repo pack through the dispatch facts",
      lanePlan.status === 200 && laneSelected.some((pack) => pack.id === "promise-anchor"),
      JSON.stringify(lanePlan.body).slice(0, 300));

    // THE SAME LOGIC OVER FLEET'S OWN CHECKOUT: the plan route and the machine seams must agree on
    // the seeds. Membership, never exact sets — the checkout's own manifest rides along by design.
    const rootGit = spawnSync("git", ["-C", ROOT, "rev-parse", "HEAD"], { encoding: "utf8" });
    if (rootGit.status !== 0) {
      check("founding packs — PROBE: the instance checkout is a git repository", false, rootGit.stderr.trim());
    } else {
      const fleetPlan = await planRoute(`?repo=${encodeURIComponent(ROOT)}&mode=main`);
      const fleetSelected = Array.isArray(fleetPlan.body.selected) ? fleetPlan.body.selected as { id: string; source?: string }[] : [];
      const seedsAsFleet = ["portable-core", "verify-e2e"].every((id) =>
        fleetSelected.some((pack) => pack.id === id && pack.source === "fleet-seed"));
      check("founding plan: the fleet checkout's plan names the seed packs as fleet-seed selections",
        fleetPlan.status === 200 && seedsAsFleet,
        `status=${fleetPlan.status} selected=[${fleetSelected.map((p) => `${p.id}:${p.source}`).join(",")}]`);
    }

    // --- (d) the doors refuse BEFORE any spawn ---
    const rejectSlot = await freeSlot();
    if (rejectSlot === null) {
      check("founding packs — PROBE: a free slot exists for the founding doors", false,
        JSON.stringify((await sessions()).slots));
    } else {
      const unknownId = await post(`/api/slots/${rejectSlot}/open`, { cwd: fixture, packs: ["no-such-pack"] });
      const unknownText = await unknownId.text();
      const stillFree = (await freeSlot()) === rejectSlot;
      check("founding packs: an unknown pack id is a 400 that names it, and the slot stays free",
        unknownId.status === 400 && unknownText.includes("unknown pack id for this founding: no-such-pack") && stillFree,
        `${unknownId.status} ${unknownText} free=${stillFree}`);
      const omittedId = await post(`/api/slots/${rejectSlot}/open`, { cwd: fixture, packs: ["broken-pointer"] });
      const omittedText = await omittedId.text();
      const stillFreeAfter = (await freeSlot()) === rejectSlot;
      check("founding packs: an omitted pack id is a 409 naming the omission, and the slot stays free",
        omittedId.status === 409 && omittedText.includes("omitted for this founding: manifest-invalid") && stillFreeAfter,
        `${omittedId.status} ${omittedText} free=${stillFreeAfter}`);
    }
    const worktreesBefore = worktreeCount();
    const laneUnknown = await post("/api/lanes", { repo: fixture, packs: ["no-such-pack"] });
    const laneUnknownText = await laneUnknown.text();
    check("founding packs: the lane door refuses an unknown pack id before any worktree exists",
      laneUnknown.status === 400 && laneUnknownText.includes("unknown pack id for this founding: no-such-pack")
        && worktreeCount() === worktreesBefore,
      `${laneUnknown.status} ${laneUnknownText} worktrees=${worktreesBefore}->${worktreeCount()}`);
    const attachPacks = await post("/api/lanes", { repo: fixture, attach: "/nonexistent-path", packs: ["promise-anchor"] });
    const attachText = await attachPacks.text();
    check("founding packs: attach refuses a packs list by name",
      attachPacks.status === 400 && attachText.includes("predates this founding"),
      `${attachPacks.status} ${attachText}`);

    // --- (b) /open with a chosen pack: delivery, exactly one receipt line, joined to the text ---
    const beforeOpen = await receipts();
    const openSlot = await freeSlot();
    if (openSlot === null) {
      check("founding packs — PROBE: a free slot exists for the /open founding", false,
        JSON.stringify((await sessions()).slots));
    } else {
      opened.push(openSlot);
      const founding = await post(`/api/slots/${openSlot}/open`, { cwd: fixture, packs: ["promise-anchor"] });
      const foundingBody = await founding.json() as { ok?: boolean; packsDelivered?: boolean; reason?: string };
      const afterOpen = await receipts();
      const rows = afterOpen.receipts.filter((row) => row.slot === openSlot);
      check("founding packs: /open with a chosen pack answers packsDelivered and appends exactly one receipt line naming it",
        founding.ok && foundingBody.packsDelivered === true && afterOpen.total === beforeOpen.total + 1
          && rows.length === 1 && rows[0]!.selected.length === 1 && rows[0]!.selected[0]!.id === "promise-anchor"
          && /^[a-f0-9]{64}$/.test(rows[0]!.selected[0]!.sourceHash ?? "") && rows[0]!.briefSource === "founding",
        `${founding.status} ${JSON.stringify(foundingBody)} rows=${JSON.stringify(rows)}`);
      const historyBody = await (await get(`/api/slots/${openSlot}/history`)).json() as { history: { text: string }[] };
      const delivered = historyBody.history.at(-1)?.text ?? "";
      const row = rows[0];
      check("founding packs: the receipt joins the delivered founding text by hash and byte count",
        !!row && row.briefHash === foundingReceiptHash(delivered, row)
          && row.deliveredBytes === new TextEncoder().encode(delivered).byteLength
          && row.repo === realpathSync(fixture) && row.renderer === "v2",
        JSON.stringify(row ?? null));
      check("founding packs: the delivered founding text carries the anchor block and the chosen pack id",
        delivered.includes("ContextPlan v2 anchors") && delivered.includes("promise-anchor")
          && delivered.includes("AGENTS.md | ## Repo contract"),
        delivered.slice(-200));
      await kill(openSlot);
      opened.splice(opened.indexOf(openSlot), 1);

      // --- (c) without packs, today's founding: no receipt line, promised nothing ---
      const beforeBare = await receipts();
      const bareSlot = await freeSlot();
      if (bareSlot === null) {
        check("founding packs — PROBE: a free slot exists for the bare /open founding", false,
          JSON.stringify((await sessions()).slots));
      } else {
        opened.push(bareSlot);
        const bare = await post(`/api/slots/${bareSlot}/open`, { cwd: fixture });
        const afterBare = await receipts();
        check("founding packs: an open without packs stays unreceipted",
          bare.ok && afterBare.total === beforeBare.total
            && afterBare.receipts.every((row) => row.slot !== bareSlot),
          `${bare.status} total=${beforeBare.total}->${afterBare.total}`);
        await kill(bareSlot);
        opened.splice(opened.indexOf(bareSlot), 1);
      }
      const beforeEmpty = await receipts();
      const emptySlot = await freeSlot();
      if (emptySlot === null) {
        check("founding packs — PROBE: a free slot exists for the empty-list founding", false,
          JSON.stringify((await sessions()).slots));
      } else {
        opened.push(emptySlot);
        const empty = await post(`/api/slots/${emptySlot}/open`, { cwd: fixture, packs: [] });
        const emptyBody = await empty.json() as { ok?: boolean; packsDelivered?: boolean };
        const afterEmpty = await receipts();
        check("founding packs: an empty packs list is a kept no-pack promise, not a delivery",
          empty.ok && emptyBody.packsDelivered === true && afterEmpty.total === beforeEmpty.total
            && afterEmpty.receipts.every((row) => row.slot !== emptySlot),
          `${empty.status} ${JSON.stringify(emptyBody)} total=${beforeEmpty.total}->${afterEmpty.total}`);
        await kill(emptySlot);
        opened.splice(opened.indexOf(emptySlot), 1);
      }
    }

    // --- the lane doors deliver and receipt on the lane's own branch ---
    const beforeLane = await receipts();
    const lane = await post("/api/lanes", { repo: fixture, packs: ["promise-anchor"] });
    const laneBody = await lane.json() as { ok?: boolean; slot?: number; branch?: string; cwd?: string; packsDelivered?: boolean; reason?: string };
    const laneSlot = laneBody.slot ?? null;
    if (laneSlot !== null) opened.push(laneSlot);
    const afterLane = await receipts();
    const laneRow = laneSlot === null ? null : afterLane.receipts.filter((row) => row.slot === laneSlot).at(-1) ?? null;
    check("founding packs: the lane door delivers the chosen pack and receipts it on the lane's own branch",
      lane.ok && laneBody.packsDelivered === true && afterLane.total === beforeLane.total + 1
        && !!laneRow && laneRow.selected.length === 1 && laneRow.selected[0]!.id === "promise-anchor"
        && laneRow.branch === laneBody.branch,
      `${lane.status} ${JSON.stringify(laneBody)} row=${JSON.stringify(laneRow)}`);
    if (laneSlot !== null) {
      // the same place, refounded through the SECOND lane door — its slot choice is already proven
      // lane-eligible, so this founding needs no slot logic of its own
      const beforeWt = await receipts();
      const wt = await post(`/api/slots/${laneSlot}/open-worktree`, { repo: fixture, packs: ["promise-anchor"] });
      const wtBody = await wt.json() as { ok?: boolean; branch?: string; packsDelivered?: boolean; reason?: string };
      const afterWt = await receipts();
      const wtRow = afterWt.receipts.filter((row) => row.slot === laneSlot).at(-1) ?? null;
      check("founding packs: open-worktree delivers the chosen pack through the second lane door",
        wt.ok && wtBody.packsDelivered === true && afterWt.total === beforeWt.total + 1
          && !!wtRow && wtRow.selected.length === 1 && wtRow.selected[0]!.id === "promise-anchor"
          && wtRow.branch === wtBody.branch,
        `${wt.status} ${JSON.stringify(wtBody)} row=${JSON.stringify(wtRow)}`);
    }
  }

  for (const slot of opened) await kill(slot).catch(() => {});
  rmSync(fixture, { recursive: true, force: true });
}

if (import.meta.main) await run();
