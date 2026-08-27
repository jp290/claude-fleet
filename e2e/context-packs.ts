// Small pure P1-B family. The validator receives all facts; only this fixture reads the real tree.
// Direct entry point (no server, tmux, or network): bun e2e/context-packs.ts
import { dirname, resolve } from "node:path";
import { readFileSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
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

  if (!externalCheck) {
    console.log(rows.join("\n"));
    console.log(failures ? `\n${failures} FAILURES` : "\nALL PASS");
    if (failures) process.exitCode = 1;
  }
}

if (import.meta.main) await run();
