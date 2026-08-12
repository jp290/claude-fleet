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
} from "../context-packs";
import { validateContextPacks, type ContextPackRepoFacts } from "../context-pack-validator";

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

export async function run(externalCheck?: ContextPackCheck): Promise<void> {
  const rows: string[] = [];
  let failures = 0;
  const check: ContextPackCheck = externalCheck ?? ((name, ok, detail = "") => {
    rows.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
    if (!ok) failures++;
  });

  const fixture = collectRepoFacts();
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

  if (!externalCheck) {
    console.log(rows.join("\n"));
    console.log(failures ? `\n${failures} FAILURES` : "\nALL PASS");
    if (failures) process.exitCode = 1;
  }
}

if (import.meta.main) await run();
