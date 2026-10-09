import { laneExitLiveBauAct, renderSessionAgents, sessionExitFooter, SESSION_AGENTS_LIMIT } from "../session-agents";
import { sectionAt, sourceSection } from "../context-sections";
// Pure ContextPlan v1 family. Direct entry point: bun e2e/context-plan.ts
import {
  CONTEXT_PACK_CAPABILITIES,
  CONTEXT_PACK_HARNESSES,
  CONTEXT_PACKS,
  CONTEXT_PACK_TRIGGERS,
  type ContextPack,
  type ContextPackMcpServer,
  type ContextPackTrigger,
  type ContextPackCapability,
} from "../context-packs";
import { CONTEXT_PLAN_OMISSION_REASONS, PRIVATE_PACK_VERDICTS, PROGRAM_CONTEXT_PACKS_MAX, cardVariante, claudeMcpConfigFlag, packMcpAnschluss, planContext,
  planMcpServers, planProgramContext, resolvePackAnatomy, resolveVariante, type ContextPlan,
  programContextPacksFrom, renderPrivatePackLines, resolvePrivatePack, validateProgramContextPacks } from "../context-plan";
import { run as contextBorrowChecks } from "./context-borrow";
import { KONZEPT_ID_RE } from "../konzept-ledger";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { appendFileSync, chmodSync, existsSync, lstatSync, symlinkSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { codexPermissionsFrom } from "../server/types";
import { piZaiFenceProfile } from "../server/pi-zai-fence";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { CONTEXT_MANIFEST_MAX_BYTES, CONTEXT_MANIFEST_OMISSION_ID, CONTEXT_MANIFEST_PATH, observedSourceHash, packAnatomyIssues, planRepoContext,
  readContextManifest, splitPackAnatomy, stampObservedSourceHashes, taskContextTriggers } from "../context-manifest";
import { parseFormattedCard, validateCard } from "../card-extract";
import { RULEBOOK_BACKREF_HEADING, RULEBOOK_FRAGMENTS, ROLE_SECTION_CUT, fragmentSections, renderRoleRulebook, renderRulebook,
  type RulebookFragment } from "../rulebook";
import { packIdFassung, standSincePreview, type PackStandPreview, type PackStandReceipt } from "../src/protocol";
import { SNIPPET_BLOCK_MAX_BYTES, SNIPPET_HIT_MAX_LINES, SNIPPET_OMISSION_MAX_BYTES, buildSnippetPackage, definitionLines,
  planSnippets, renderSnippetBlock, snippetPathRefusal, symbolSpan,
  type SnippetFile, type SnippetRow } from "../context-snippets";

export type ContextPlanCheck = (name: string, ok: boolean, detail?: string) => void;

const fullCapabilities = (): ContextPackCapability[] => [...CONTEXT_PACK_CAPABILITIES];
const summary = (plan: ReturnType<typeof planContext>): string => JSON.stringify(plan);

export async function run(externalCheck?: ContextPlanCheck): Promise<void> {
  const rows: string[] = [];
  let failures = 0;
  const check: ContextPlanCheck = externalCheck ?? ((name, ok, detail = "") => {
    rows.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
    if (!ok) failures++;
  });

  const normal = planContext({ sourceTree: "fleet", harness: "claude", mode: "mutating", triggers: ["always", "verification"],
    capabilities: fullCapabilities() });
  check("context plan: every manifest is selected or omitted exactly once",
    normal.selected.length + normal.omitted.length === CONTEXT_PACKS.length
    && new Set([...normal.selected, ...normal.omitted].map((pack) => pack.id)).size === CONTEXT_PACKS.length,
    summary(normal));
  check("context plan: the delivery facts select the always + verification packs",
    normal.selected.map((pack) => pack.id).join(",") === "portable-core,verify-e2e,konzept-claude-fleet", summary(normal));
  check("context plan: each real omission names the first failed rule",
    normal.omitted.length === CONTEXT_PACKS.length - normal.selected.length
    && normal.omitted.every((pack) => pack.why === "trigger-not-matched"),
    summary(normal));

  // The plan is what the renderer sees, so PURPOSE must survive selection — a seed's mandatory
  // useWhen reaching the selection unchanged is the only reason the v2 block can state one.
  check("context plan: every selected Fleet seed carries its seed's purpose line verbatim",
    normal.selected.length === 3 && normal.selected.every((pack) =>
      pack.useWhen === CONTEXT_PACKS.find((seed) => seed.id === pack.id)?.useWhen
      && typeof pack.useWhen === "string" && pack.useWhen.length > 0),
    summary(normal));

  // THE MUTATING-WORKER PATH (runMerge/runRepair) — a SECOND assertion standing beside the session
  // one above, not a widening of it. The merge and repair resolvers rewrite a lane's history and
  // are the only consumers of the `landing` trigger; their facts are the literal harness "claude"
  // (WORKER_HARNESS.worker starts `claude` whatever FLEET_CMD is) and the six capabilities
  // DISPATCH_CONTEXT_CAPABILITIES names. Weakening either check is caught by the other: the session
  // path must NOT pick up land-mechanics, and the worker path must NOT pick up the session packs.
  const workerLanding = planContext({ sourceTree: "fleet", harness: "claude", mode: "mutating", triggers: ["landing"],
    capabilities: ["tracked-source-read", "pure-validator-run", "e2e-run", "git-inspect",
      "harness-adapter-read", "private-overlay-read"] });
  check("context plan: the merge/repair worker facts select exactly the land-mechanics pack",
    workerLanding.selected.map((pack) => pack.id).join(",") === "land-mechanics", summary(workerLanding));
  check("context plan: the worker path omits the session packs by trigger, never by capability",
    workerLanding.omitted.length === CONTEXT_PACKS.length - 1
    && workerLanding.omitted.every((pack) => pack.why === "trigger-not-matched")
    && ["portable-core", "verify-e2e"].every((id) =>
      workerLanding.omitted.some((pack) => pack.id === id && pack.why === "trigger-not-matched")),
    summary(workerLanding));

  const defaultHarness = planContext({ sourceTree: "fleet", harness: null, mode: "mutating", triggers: ["landing"],
    capabilities: fullCapabilities() });
  const unknownHarness = planContext({ sourceTree: "fleet", harness: "future-unknown-adapter", mode: "mutating", triggers: ["landing"],
    capabilities: fullCapabilities() });
  check("context plan: null and unknown harnesses both resolve to the Claude default adapter",
    JSON.stringify(defaultHarness) === JSON.stringify(unknownHarness)
    && defaultHarness.selected.some((pack) => pack.id === "land-mechanics"),
    summary(defaultHarness));

  const missingCapability = planContext({ sourceTree: "fleet", harness: "claude", mode: "mutating", triggers: ["always", "verification"],
    capabilities: fullCapabilities().filter((capability) => capability !== "pure-validator-run") });
  check("context plan: a missing capability omits its pack instead of silently selecting it",
    !missingCapability.selected.some((pack) => pack.id === "verify-e2e")
    && missingCapability.omitted.some((pack) => pack.id === "verify-e2e" && pack.why === "capability-missing"),
    summary(missingCapability));

  const unsupportedHarness = planContext({ sourceTree: "fleet", harness: "codex", mode: "mutating", triggers: ["landing"],
    capabilities: fullCapabilities() });
  check("context plan: harness incompatibility has its closed reason",
    unsupportedHarness.omitted.some((pack) => pack.id === "land-mechanics" && pack.why === "harness-unsupported"),
    summary(unsupportedHarness));
  const unsupportedMode = planContext({ sourceTree: "fleet", harness: "claude", mode: "monitoring", triggers: ["verification"],
    capabilities: fullCapabilities() });
  check("context plan: mode incompatibility precedes trigger and capability checks",
    unsupportedMode.omitted.some((pack) => pack.id === "verify-e2e" && pack.why === "mode-unsupported"),
    summary(unsupportedMode));

  const foreign = planContext({ sourceTree: "foreign", harness: "claude", mode: "mutating",
    triggers: ["always", "verification"], capabilities: fullCapabilities() });
  check("context plan: a foreign source tree omits every pack before all other rules",
    foreign.selected.length === 0 && foreign.omitted.length === CONTEXT_PACKS.length
      && foreign.omitted.every((pack) => pack.why === "source-unavailable"),
    summary(foreign));
  check("context plan: omission vocabulary is closed and complete",
    CONTEXT_PLAN_OMISSION_REASONS.join(",") ===
      "manifest-invalid,source-unavailable,status-not-active,harness-unsupported,mode-unsupported,trigger-not-matched,capability-missing,program-complete");

  // --- the repo-declared carrier. Pure half only: bytes in, plan out, no git and no filesystem.
  const repoFacts = {
    harness: "claude", mode: "mutating" as const, triggers: ["always", "verification"] as const,
    capabilities: ["tracked-source-read", "git-inspect"] as ContextPackCapability[],
  };
  const repoPack = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: "product-promise", scope: "product-quality", audience: "agent", triggers: ["always"],
    hardness: "guidance", sources: [{ path: "docs/promise.md", anchor: "## Product promise" }],
    requiredCapabilities: ["tracked-source-read"], harnesses: ["claude", "codex"],
    modes: ["read-only", "mutating"], estimatedBytes: 1200, evidence: "tree-anchor",
    owner: "owner", status: "active", ...over,
  });
  const privateOnly = planContext({ sourceTree: "fleet", harness: "claude", mode: "mutating",
    triggers: ["always"], capabilities: fullCapabilities() })
    .selected.filter((pack) => "privateSourceId" in pack.sources);
  const repoWorld = (packs: readonly unknown[], bytes = "## Product promise\nplay first.\n") => ({
    manifest: readContextManifest(JSON.stringify(packs)),
    repo: { trackedPaths: new Set(["docs/promise.md"]), sourceBytes: new Map([["docs/promise.md", bytes]]) },
    facts: repoFacts,
  });

  check("context manifest: an absent manifest plans nothing at all",
    JSON.stringify(planRepoContext({ ...repoWorld([]), manifest: readContextManifest(null) }))
      === JSON.stringify({ selected: [], omitted: [] }));
  const brokenJson = planRepoContext({ ...repoWorld([]), manifest: readContextManifest("{not json") });
  check("context manifest: broken JSON is one named omission, never a silent skip",
    brokenJson.selected.length === 0 && brokenJson.omitted.length === 1
      && brokenJson.omitted[0].id === CONTEXT_MANIFEST_OMISSION_ID
      && brokenJson.omitted[0].why === "manifest-invalid", JSON.stringify(brokenJson));
  check("context manifest: a non-array manifest is invalid rather than empty",
    readContextManifest('{"packs":[]}').kind === "invalid");
  check("context manifest: a manifest too large to read is invalid, never mistaken for an absent one",
    readContextManifest(`${" ".repeat(CONTEXT_MANIFEST_MAX_BYTES)}[]`).kind === "invalid");

  const valid = planRepoContext(repoWorld([repoPack()]));
  check("context manifest: a valid repo pack is selected with its own anchors",
    valid.omitted.length === 0 && valid.selected.length === 1 && valid.selected[0].id === "product-promise"
      && JSON.stringify(valid.selected[0].sources) === JSON.stringify([{ path: "docs/promise.md", anchor: "## Product promise" }]),
    JSON.stringify(valid));
  const repoUseWhen = "Wenn du das Produktversprechen dieses Repos pruefst.";
  // --- the observed source VERSION. A selection's sourceHash is git's own content address of the
  // sources at the planned commit, never a literal someone typed, so "version N vs N+1" is
  // computable — and it costs the tree listing the seam already makes, not a blob read.
  const blob = (n: number): string => String(n).repeat(40).slice(0, 40);
  const promiseShas = new Map([["docs/promise.md", blob(1)]]);
  const promiseSource = [{ path: "docs/promise.md", anchor: "## Product promise" }];
  const expectedHash = createHash("sha256").update("docs/promise.md").update("\0").update(blob(1)).update("\0").digest("hex");
  check("context plan: the observed source version is sha256 over `path\\0<blob sha>\\0`, in source order",
    observedSourceHash(promiseSource, promiseShas) === expectedHash, String(observedSourceHash(promiseSource, promiseShas)));
  check("context plan: the version follows the blob — a source edit is a new pack version, an unchanged tree is the same one",
    observedSourceHash(promiseSource, new Map([["docs/promise.md", blob(2)]])) !== expectedHash
      && observedSourceHash(promiseSource, new Map([["docs/promise.md", blob(1)]])) === expectedHash);
  check("context plan: a pack whose source has no blob at the commit gets NO version — never a partial one",
    observedSourceHash([...promiseSource, { path: "docs/absent.md", anchor: "## Nope" }], promiseShas) === undefined
      && observedSourceHash([], promiseShas) === undefined);
  // stamping: seeds and repo packs go through ONE function, so `sourceHash` means one thing
  const stamped = stampObservedSourceHashes([...valid.selected, ...normal.selected],
    new Map([["docs/promise.md", blob(1)], ["AGENTS.md", blob(3)]]));
  const stampedPromise = stamped.find((p) => p.id === "product-promise");
  const stampedCore = stamped.find((p) => p.id === "portable-core");
  const stampedVerify = stamped.find((p) => p.id === "verify-e2e");
  check("context plan: stamping versions a seed only when EVERY source has a blob — a partly-tracked seed stays unstamped",
    stampedCore?.sourceHash === observedSourceHash([{ path: "AGENTS.md", anchor: "## Portable operating contract" }],
      new Map([["AGENTS.md", blob(3)]]))
      && stampedVerify !== undefined && stampedVerify.sourceHash === undefined
      && normal.selected.every((p) => p.sourceHash === undefined),
    JSON.stringify(stamped.map((p) => [p.id, p.sourceHash ?? null])));
  check("context plan: seed and repo-declared rows are stamped by the same rule, so the receipt's sourceHash is one space",
    stampedPromise?.sourceHash === expectedHash, JSON.stringify(stampedPromise));
  const declaredLiteral = planRepoContext(repoWorld([repoPack({ sourceHash: "a".repeat(64), observedAt: "2026-01-01T00:00:00Z" })]));
  check("context plan: an OBSERVED version beats a manifest's declared literal — a measurement over a claim",
    declaredLiteral.selected[0]?.sourceHash === "a".repeat(64)
      && stampObservedSourceHashes(declaredLiteral.selected, promiseShas)[0]?.sourceHash === expectedHash,
    JSON.stringify(declaredLiteral.selected[0]));
  check("context plan: with nothing observable the declared literal survives, and a private overlay is never stamped",
    stampObservedSourceHashes(declaredLiteral.selected, new Map())[0]?.sourceHash === "a".repeat(64)
      && JSON.stringify(stampObservedSourceHashes(privateOnly, promiseShas)) === JSON.stringify(privateOnly),
    JSON.stringify(privateOnly));

  const withUseWhen = planRepoContext(repoWorld([repoPack({ useWhen: repoUseWhen })]));
  check("context manifest: a repo pack's own purpose line is carried through, never rewritten",
    withUseWhen.selected.length === 1 && withUseWhen.selected[0].useWhen === repoUseWhen,
    JSON.stringify(withUseWhen));
  check("context manifest: a repo pack without a purpose line is selected with the field absent, not empty",
    valid.selected.length === 1 && !("useWhen" in valid.selected[0]), JSON.stringify(valid.selected[0]));
  const badUseWhen = planRepoContext(repoWorld([repoPack({ useWhen: "one\ntwo" })]));
  check("context manifest: an unusable purpose line condemns the whole entry rather than being dropped silently",
    badUseWhen.selected.length === 0
      && JSON.stringify(badUseWhen.omitted) === JSON.stringify([{ id: "product-promise", why: "manifest-invalid" }]),
    JSON.stringify(badUseWhen));

  const untracked = planRepoContext(repoWorld([repoPack({ id: "untracked-pack",
    sources: [{ path: "docs/absent.md", anchor: "## Product promise" }] })]));
  check("context manifest: an entry naming an untracked path is omitted manifest-invalid by id",
    untracked.selected.length === 0
      && JSON.stringify(untracked.omitted) === JSON.stringify([{ id: "untracked-pack", why: "manifest-invalid" }]),
    JSON.stringify(untracked));
  const missingAnchor = planRepoContext(repoWorld([repoPack()], "## Something else\n"));
  check("context manifest: an anchor absent from the committed bytes never reaches the reader",
    missingAnchor.selected.length === 0 && missingAnchor.omitted[0]?.why === "manifest-invalid",
    JSON.stringify(missingAnchor));
  const collision = planRepoContext(repoWorld([repoPack({ id: "portable-core" })]));
  check("context manifest: a repo pack may not reuse a Fleet seed id",
    collision.selected.length === 0 && collision.omitted[0]?.id === "portable-core"
      && collision.omitted[0]?.why === "manifest-invalid", JSON.stringify(collision));
  const privatePack = planRepoContext(repoWorld([{ ...repoPack(), id: "repo-private",
    audience: "private-ops", sources: undefined, privateSourceId: "opaque-3f4c19d8a6e2b701",
    sourceHash: "0".repeat(64), observedAt: "2026-08-12T08:52:35Z", evidence: "private-content-hash" }]));
  check("context manifest: an unobservable private overlay is a manifest defect, not a delivery",
    privatePack.selected.length === 0 && privatePack.omitted[0]?.why === "manifest-invalid",
    JSON.stringify(privatePack));

  const mixed = planRepoContext(repoWorld([
    repoPack(),
    repoPack({ id: "retired-pack", status: "retired" }),
    repoPack({ id: "landing-pack", triggers: ["landing"] }),
    repoPack({ id: "e2e-pack", requiredCapabilities: ["tracked-source-read", "e2e-run"] }),
    repoPack({ id: "pi-pack", harnesses: ["pi"] }),
  ]));
  check("context manifest: valid repo packs run the SAME omission ladder as the Fleet seeds",
    mixed.selected.map((pack) => pack.id).join(",") === "product-promise"
      && JSON.stringify(mixed.omitted) === JSON.stringify([
        { id: "retired-pack", why: "status-not-active" },
        { id: "landing-pack", why: "trigger-not-matched" },
        { id: "e2e-pack", why: "capability-missing" },
        { id: "pi-pack", why: "harness-unsupported" },
      ]), JSON.stringify(mixed));
  const unnamed = planRepoContext(repoWorld([repoPack({ id: "" }), "not-a-pack"]));
  check("context manifest: an entry with an unusable id is named by position, never selected on an unaccepted shape",
    unnamed.selected.length === 0
      && JSON.stringify(unnamed.omitted) === JSON.stringify([
        { id: "#0", why: "manifest-invalid" }, { id: "#1", why: "manifest-invalid" }]),
    JSON.stringify(unnamed));
  const hardPack = planRepoContext(repoWorld([repoPack({ hardness: "hard" })]));
  check("context manifest: an unobserved capability snapshot does not condemn a hard repo pack",
    hardPack.selected.length === 1 && hardPack.omitted.length === 0, JSON.stringify(hardPack));


  // --- PROGRAM-SCOPED PACKS (Task b28b9d89). Pure half: the write validator, the load reader and the
  // per-lane planner. The server joins a lane to its Program by `slot.programId` and hands the
  // planner that Program (or null) plus the tree listing it already made; these checks pin the rest.
  const progTracked = new Set(["docs/messungen/grok-1.md", "AGENTS.md"]);
  const progBytes = new Map([["docs/messungen/grok-1.md", "# Grok-Antwort 1\n## §1 Delegation\nprose\n"],
    ["AGENTS.md", "## Verify\n"]]);
  const progRepo = { trackedPaths: progTracked, sourceBytes: progBytes };
  const progPack = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: "grok-antwort-1", useWhen: "Bevor du eine Delegations-Zeile baust",
    sources: [{ path: "docs/messungen/grok-1.md", anchor: "## §1 Delegation" }], ...over,
  });
  const codesOf = (raw: unknown, repo = progRepo): string => {
    const verdict = validateProgramContextPacks(raw, repo);
    return verdict.ok ? "ok" : [...new Set(verdict.issues.map((issue) => issue.code))].sort().join(",");
  };

  const accepted = validateProgramContextPacks([progPack({ useWhen: "  Bevor du eine Delegations-Zeile baust " })], progRepo);
  check("program packs: a pointer with a tracked path and a present anchor is accepted, purpose line trimmed",
    accepted.ok && JSON.stringify(accepted.packs) === JSON.stringify([{ id: "grok-antwort-1",
      useWhen: "Bevor du eine Delegations-Zeile baust", sources: [{ path: "docs/messungen/grok-1.md", anchor: "## §1 Delegation" }] }]),
    JSON.stringify(accepted));
  const cleared = validateProgramContextPacks([], progRepo);
  check("program packs: the empty list is a valid write (it clears the Program's packs)",
    cleared.ok && cleared.packs.length === 0, JSON.stringify(cleared));
  check("program packs: an untracked source path is refused by name at write",
    codesOf([progPack({ sources: [{ path: "docs/absent.md", anchor: "## §1 Delegation" }] })]) === "SOURCE_PATH_MISSING",
    codesOf([progPack({ sources: [{ path: "docs/absent.md", anchor: "## §1 Delegation" }] })]));
  check("program packs: an anchor absent from the bytes at HEAD is refused by name at write",
    codesOf([progPack({ sources: [{ path: "docs/messungen/grok-1.md", anchor: "## §9 Nirgends" }] })]) === "SOURCE_ANCHOR_MISSING",
    codesOf([progPack({ sources: [{ path: "docs/messungen/grok-1.md", anchor: "## §9 Nirgends" }] })]));
  check("program packs: a prose-shaped anchor is refused as SOURCE_ANCHOR_INVALID, even when the words are in the file",
    codesOf([progPack({ sources: [{ path: "docs/messungen/grok-1.md", anchor: "Delegation prose" }] })]) === "SOURCE_ANCHOR_INVALID",
    codesOf([progPack({ sources: [{ path: "docs/messungen/grok-1.md", anchor: "Delegation prose" }] })]));
  const sixPacks = Array.from({ length: PROGRAM_CONTEXT_PACKS_MAX + 1 }, (_, i) => progPack({ id: `pack-${i}` }));
  check("program packs: a sixth pack refuses the whole list, not just the sixth",
    PROGRAM_CONTEXT_PACKS_MAX === 5 && codesOf(sixPacks) === "PROGRAM_PACKS_TOO_MANY"
      && codesOf(sixPacks.slice(0, 5)) === "ok", codesOf(sixPacks));
  const fiveSources = Array.from({ length: 5 }, () => ({ path: "AGENTS.md", anchor: "## Verify" }));
  check("program packs: a fifth source in one pack is refused",
    codesOf([progPack({ sources: fiveSources })]) === "PROGRAM_PACK_SOURCES_TOO_MANY"
      && codesOf([progPack({ sources: fiveSources.slice(0, 4) })]) === "ok", codesOf([progPack({ sources: fiveSources })]));
  check("program packs: a Fleet seed id, a malformed id and a duplicate id are each refused by their own code",
    codesOf([progPack({ id: "portable-core" })]) === "PROGRAM_PACK_SEED_ID"
      && codesOf([progPack({ id: "Grok_1" })]) === "PROGRAM_PACK_ID_INVALID"
      && codesOf([progPack({ id: "x".repeat(41) })]) === "PROGRAM_PACK_ID_INVALID"
      && codesOf([progPack({ id: "1-digit-start" })]) === "ok"
      && codesOf([progPack(), progPack()]) === "ID_DUPLICATE",
    `${codesOf([progPack({ id: "portable-core" })])} ${codesOf([progPack({ id: "Grok_1" })])} ${codesOf([progPack(), progPack()])}`);
  check("program packs: content instead of a pointer is refused, on the pack and on a source",
    codesOf([progPack({ content: "the whole note" })]) === "PACK_CONTENT_FORBIDDEN"
      && codesOf([progPack({ sources: [{ path: "AGENTS.md", anchor: "## Verify", text: "copied" }] })]) === "SOURCE_CONTENT_FORBIDDEN"
      && codesOf([progPack({ expiresAt: 1 })]) === "PACK_UNKNOWN_KEY",
    codesOf([progPack({ content: "the whole note" })]));
  check("program packs: the purpose line is mandatory and one bounded line",
    codesOf([{ id: "no-purpose", sources: [{ path: "AGENTS.md", anchor: "## Verify" }] }]) === "PACK_REQUIRED_FIELD_MISSING"
      && codesOf([progPack({ useWhen: "a\nb" })]) === "USE_WHEN_INVALID"
      && codesOf([progPack({ useWhen: "x".repeat(121) })]) === "USE_WHEN_INVALID",
    codesOf([progPack({ useWhen: "a\nb" })]));
  check("program packs: a source Fleet could not read is refused — an unchecked anchor is never stored",
    codesOf([progPack()], { trackedPaths: progTracked, sourceBytes: new Map() }) === "SOURCE_BYTES_UNKNOWN",
    codesOf([progPack()], { trackedPaths: progTracked, sourceBytes: new Map() }));
  check("program packs: a body that is not a list is refused, never read as empty",
    codesOf(undefined) === "PACK_FIELD_INVALID" && codesOf({ packs: [] }) === "PACK_FIELD_INVALID", codesOf(undefined));

  const stored = accepted.ok ? accepted.packs : [];
  const roundTrip = programContextPacksFrom(JSON.parse(JSON.stringify(stored)));
  check("program packs: a persisted list loads back byte-identically",
    roundTrip !== null && JSON.stringify(roundTrip) === JSON.stringify(stored), JSON.stringify(roundTrip));
  check("program packs: an unreadable persisted list loads as absent (null), for every broken shape",
    [null, "x", [{ ...stored[0], text: "c" }], [{ ...stored[0], useWhen: "a\nb" }], [{ ...stored[0], sources: [] }],
      [stored[0], stored[0]], Array.from({ length: 6 }, (_, i) => ({ ...stored[0], id: `p-${i}` })),
      [{ ...stored[0], sources: [{ path: "AGENTS.md" }] }]]
      .every((broken) => programContextPacksFrom(broken) === null)
      && JSON.stringify(programContextPacksFrom([])) === "[]",
    "each broken shape must read as null");

  const laneFacts = { sourceTree: "fleet" as const, harness: "claude", mode: "mutating" as const,
    triggers: ["always", "verification"] as const, capabilities: fullCapabilities() };
  const seedsOnly = planContext(laneFacts);
  const ownLane = planProgramContext({ program: { status: "active", contextPacks: stored }, trackedPaths: progTracked });
  check("program packs: a lane of the Program gets its pack selected, marked origin program, pointers intact",
    ownLane.omitted.length === 0 && JSON.stringify(ownLane.selected) === JSON.stringify([{ id: "grok-antwort-1", hardness: "guidance",
      useWhen: "Bevor du eine Delegations-Zeile baust", sources: [{ path: "docs/messungen/grok-1.md", anchor: "## §1 Delegation" }],
      estimatedBytes: 0, origin: "program" }]), JSON.stringify(ownLane));
  const confirmedLane = planProgramContext({ program: { status: "confirmed", contextPacks: stored }, trackedPaths: progTracked });
  check("program packs: a confirmed Program delivers like an active one",
    confirmedLane.selected.length === 1 && confirmedLane.omitted.length === 0, JSON.stringify(confirmedLane));
  const merged = stampObservedSourceHashes([...seedsOnly.selected, ...ownLane.selected],
    new Map([["docs/messungen/grok-1.md", "b".repeat(40)]]));
  check("program packs: stamping keeps origin and versions the Program pack like any other row",
    JSON.stringify(merged.map((row) => "origin" in row ? row.origin : null)) === JSON.stringify([null, null, null, "program"])
      && merged.at(-1)?.sourceHash === observedSourceHash(stored[0].sources, new Map([["docs/messungen/grok-1.md", "b".repeat(40)]])),
    JSON.stringify(merged.at(-1)));
  const foreignProgramLane = planProgramContext({ program: { status: "active" }, trackedPaths: progTracked });
  const noProgramLane = planProgramContext({ program: null, trackedPaths: progTracked });
  check("program packs: a lane of another Program without packs, and a lane of no Program, get NO program rows at all",
    JSON.stringify(foreignProgramLane) === JSON.stringify({ selected: [], omitted: [] })
      && JSON.stringify(noProgramLane) === JSON.stringify({ selected: [], omitted: [] }),
    `${JSON.stringify(foreignProgramLane)} ${JSON.stringify(noProgramLane)}`);
  const completeLane = planProgramContext({ program: { status: "complete", contextPacks: stored }, trackedPaths: progTracked });
  check("program packs: after complete the next lane gets no pack, and the receipt says why",
    completeLane.selected.length === 0
      && JSON.stringify(completeLane.omitted) === JSON.stringify([{ id: "grok-antwort-1", why: "program-complete" }]),
    JSON.stringify(completeLane));
  const vanished = planProgramContext({ program: { status: "active", contextPacks: stored }, trackedPaths: new Set(["AGENTS.md"]) });
  check("program packs: a source path no longer tracked at the delivered commit is omitted, never delivered",
    vanished.selected.length === 0
      && JSON.stringify(vanished.omitted) === JSON.stringify([{ id: "grok-antwort-1", why: "source-unavailable" }]),
    JSON.stringify(vanished));
  const withoutProgram = { selected: [...seedsOnly.selected, ...noProgramLane.selected], omitted: [...seedsOnly.omitted, ...noProgramLane.omitted] };
  check("program packs: with no Program packs the merged plan is byte-identical to the plan before the carrier",
    JSON.stringify(withoutProgram) === JSON.stringify(seedsOnly), JSON.stringify(withoutProgram));

  // --- THE SOURCE PACKAGE (context-snippets.ts). Hermetic by construction: the tree listing and the
  // file bytes are fixtures, because `fleet-e2e.ts` runs from a staged copy that is not a git
  // worktree at all — a check reading the real tree here would measure the staging, not the module.
  // The real-tree exactness proof belongs to the delivery seam and lives with the dispatch check.
  const snipTracked = new Map<string, string>([
    ["alpha.ts", "100644"], ["beta.ts", "100644"], ["run.sh", "100755"], ["notes.md", "100644"],
    ["link.ts", "120000"], ["sub", "160000"], ["logo.png", "100644"], ["audit.jsonl", "100644"],
    ["CLAUDE.md", "100644"],
  ]);
  const alpha = [
    "// leading comment",                                   // 1
    "export function alphaOne(input: string): string {",     // 2
    "  return input.trim();",                                // 3
    "}",                                                     // 4
    "",                                                      // 5
    "export const alphaTwo = 7;",                            // 6
    "",                                                      // 7
    "export function alphaWide(a: string,",                   // 8
    "  b: string,",                                          // 9
    "): string {",                                           // 10
    "  return a + b;",                                       // 11
    "}",                                                     // 12
  ].join("\n");
  const beta = ["export function alphaOne(x: number): number {", "  return x;", "}"].join("\n");
  const snipFiles = (...paths: string[]): SnippetFile[] =>
    paths.map((path) => ({ path, text: path === "alpha.ts" ? alpha : path === "beta.ts" ? beta : "",
      blob: `blob-${path}` }));
  // 40 filler lines before and after, so a ±20 window is a WINDOW and not the whole file — the
  // three expectations that first read `to === 4` were measuring the fixture's shortness.
  const filler = (tag: string) => Array.from({ length: 40 }, (_, i) => `// ${tag} ${i}`);
  const paddedLines = [...filler("head"), ...alpha.split("\n"), ...filler("tail")];
  const padded = paddedLines.join("\n");
  const snipRows: SnippetRow[] = [{ id: "t1", files: ["alpha.ts"],
    symbols: ["alpha.ts#alphaOne", "alpha.ts#alphaTwo", "alpha.ts#alphaWide", "alpha.ts#wide", "alpha.ts#tiny", "alpha.ts#huge"] }];
  const paddedFile: SnippetFile[] = [{ path: "alpha.ts", text: padded, blob: "blob-alpha.ts" }];
  const pack = (brief: string, rows = snipRows, files = snipFiles("alpha.ts"), maxBytes?: number) => {
    const plan = planSnippets({ briefText: brief, rows, tracked: snipTracked });
    const built = buildSnippetPackage(plan, files, { rows, commit: "c0ffee0c0ffee", maxBytes });
    return { plan, built, block: renderSnippetBlock(built) };
  };

  // (1) THE SPAN IS THE CONSTRUCT, not the line the name is on. `alphaWide`'s signature spans three
  // lines and its `): string {` is a closing bracket that OPENS the body — the rule that read the
  // head line's last character delivered one line and called it a function.
  check("snippets: a multi-line signature's span runs to the body's closer, not to the first `)`",
    JSON.stringify(symbolSpan(alpha.split("\n"), 7)) === JSON.stringify({ to: 11, incomplete: false })
    && JSON.stringify(symbolSpan(alpha.split("\n"), 1)) === JSON.stringify({ to: 3, incomplete: false })
    && JSON.stringify(symbolSpan(alpha.split("\n"), 5)) === JSON.stringify({ to: 5, incomplete: false }),
    JSON.stringify([symbolSpan(alpha.split("\n"), 7), symbolSpan(alpha.split("\n"), 1),
      symbolSpan(alpha.split("\n"), 5)]));

  // (2) THE PATH LADDER. Each refusal is its OWN reason, and an unsupported source says so instead
  // of rendering as an empty success — the shape "no snippet" and "nothing snippable here" share.
  const refusals = [["/etc/passwd", "path-outside-repo"], ["../outside.ts", "path-outside-repo"],
    ["a/../../b.ts", "path-outside-repo"], ["ghost.ts", "not-tracked"], ["link.ts", "not-a-regular-file"],
    ["sub", "not-a-regular-file"], ["CLAUDE.md", "private-source"], ["audit.jsonl", "private-source"],
    ["notes.md", "unsupported-source"], ["logo.png", "unsupported-source"], ["run.sh", "unsupported-source"],
    ["alpha.ts", null]] as const;
  check("snippets: every path refusal is named by its own first-failed rule, symlink and gitlink included",
    refusals.every(([path, why]) => snippetPathRefusal(path, snipTracked) === why),
    JSON.stringify(refusals.map(([path]) => [path, snippetPathRefusal(path, snipTracked)])));
  const escaped = pack("siehe ../outside.ts#alphaOne und /etc/shadow.ts#alphaOne und link.ts#alphaOne");
  // …and the bare `alphaOne` those three lines also contain must NOT become a hit in alpha.ts: the
  // brief chose files, all three were refused, and a same-named symbol elsewhere is not the answer.
  // …and the refusals are IN the block although nothing was shown: a lane told nothing about a
  // source its brief named goes looking for exactly that source.
  check("snippets: a path escape, an absolute path and a symlink deliver NO excerpt, each with its reason — visibly",
    escaped.built.shown.length === 0 && !escaped.block.includes("```")
    && escaped.built.omitted.map((entry) => entry.why).join(",")
      === "path-outside-repo,path-outside-repo,not-a-regular-file"
    && escaped.block === "\n\nQuellpaket — kein Ausschnitt aus c0ffee0c0ffe; im Brief genannt, aber nicht geliefert:\n"
      + "ausgelassen: ../outside.ts#alphaOne (path-outside-repo) · /etc/shadow.ts#alphaOne (path-outside-repo)"
      + " · link.ts#alphaOne (not-a-regular-file)"
    && escaped.built.bytes === new TextEncoder().encode(escaped.block).byteLength,
    JSON.stringify({ omitted: escaped.built.omitted, block: escaped.block }));

  // (3) A SYMBOL THE TREE DOES NOT HAVE, and one it has TWICE. Neither may pick "some hit": the
  // brief named one thing, and choosing among candidates would be the module inventing the answer.
  const missing = pack("lies alpha.ts#alphaMissing");
  check("snippets: a qualified symbol with no definition is reported as symbol-not-found, not dropped",
    missing.built.shown.length === 0
    && JSON.stringify(missing.built.omitted) === JSON.stringify([{ ref: "alpha.ts#alphaMissing", why: "symbol-not-found" }]),
    JSON.stringify(missing.built.omitted));
  const twoRows: SnippetRow[] = [{ id: "t1", files: ["alpha.ts"] }, { id: "t2", files: ["beta.ts"] }];
  const ambiguous = pack("lies `alphaOne`", twoRows, snipFiles("alpha.ts", "beta.ts"));
  check("snippets: a bare symbol defined in two surface files is symbol-ambiguous, delivers no excerpt, and says so",
    ambiguous.built.shown.length === 0
    && JSON.stringify(ambiguous.built.omitted) === JSON.stringify([{ ref: "#alphaOne", why: "symbol-ambiguous" }])
    && !ambiguous.block.includes("```") && ambiguous.block.endsWith("\nausgelassen: #alphaOne (symbol-ambiguous)")
    && missing.block.endsWith("\nausgelassen: alpha.ts#alphaMissing (symbol-not-found)"),
    JSON.stringify({ omitted: ambiguous.built.omitted, block: ambiguous.block, missing: missing.block }));

  // (3b) THE PRIVATE OVERLAY AND OPERATIVE STATE: named, refused by name, and not one byte of content.
  // The tree listing omits them today only because they are gitignored — this is the rule without that.
  const privTracked = new Map([...snipTracked, [".env", "100644"], ["fleet.json", "100644"]]);
  const privPlan = planSnippets({ briefText: "lies CLAUDE.md#secret .env#TOKEN fleet.json#slots",
    rows: snipRows, tracked: privTracked });
  const privBuilt = buildSnippetPackage(privPlan, [], { rows: snipRows, commit: "c0ffee0c0ffee" });
  const privBlock = renderSnippetBlock(privBuilt);
  // `.env#TOKEN` is not even a reference (the path token needs an extension), so the path gate is
  // asserted on its own for it — a later widening of the pattern must still meet the refusal.
  check("snippets: CLAUDE.md, .env and fleet.json are private-source — planned for no read, listed in the block",
    privPlan.reads.length === 0 && privBuilt.shown.length === 0
    && snippetPathRefusal(".env", privTracked) === "private-source"
    && privBuilt.omitted.map((entry) => `${entry.ref}:${entry.why}`).join(",")
      === "CLAUDE.md#secret:private-source,fleet.json#slots:private-source"
    && privBlock.endsWith("ausgelassen: CLAUDE.md#secret (private-source) · fleet.json#slots (private-source)"),
    JSON.stringify({ reads: privPlan.reads, omitted: privBuilt.omitted, block: privBlock }));

  // (3c) ONLY PROSE MISSED: bare tokens with no surface to search are the brief's words, not sources.
  const prose = planSnippets({ briefText: "die Lane liest deliveredBytes und blobModes", rows: [], tracked: snipTracked });
  const proseBlock = renderSnippetBlock(buildSnippetPackage(prose, [], { commit: "c0ffee0c0ffee" }));
  check("snippets: a brief whose only misses are bare prose tokens renders nothing",
    prose.omitted.length === 2 && proseBlock === "", JSON.stringify({ omitted: prose.omitted, block: proseBlock }));

  // (3d) A LONG LIST OF MISSES is cut under its own ceiling and counts what it cut; the named ones
  // come before the prose tokens, and the whole block still honours the cap.
  const manyBrief = Array.from({ length: 120 }, (_, i) => `alpha.ts#missingSymbolNumber${i}`).join(" ")
    + " sowie proseTokenOne";
  const many = planSnippets({ briefText: manyBrief, rows: [], tracked: snipTracked });
  const manyBuilt = buildSnippetPackage(many, snipFiles("alpha.ts"), { commit: "c0ffee0c0ffee" });
  const manyBlock = renderSnippetBlock(manyBuilt);
  const manyLine = manyBlock.split("\n").find((line) => line.startsWith("ausgelassen: ")) ?? "";
  check("snippets: only omissions, 121 of them — the line is cut at its ceiling, names the cut count, named refs first",
    manyBuilt.shown.length === 0 && manyBuilt.omitted.length === 121
    && manyBuilt.listed > 0 && manyBuilt.listed < 121
    && new TextEncoder().encode(manyLine).byteLength <= SNIPPET_OMISSION_MAX_BYTES
    && manyLine.endsWith(` · … ${121 - manyBuilt.listed} weitere gekuerzt`)
    && manyLine.startsWith("ausgelassen: alpha.ts#missingSymbolNumber0 (symbol-not-found)")
    && !manyLine.includes("proseTokenOne")
    && manyBuilt.bytes === new TextEncoder().encode(manyBlock).byteLength
    && manyBuilt.bytes <= SNIPPET_BLOCK_MAX_BYTES,
    JSON.stringify({ listed: manyBuilt.listed, bytes: manyBuilt.bytes, line: manyLine.slice(-120) }));
  const tinyCap = buildSnippetPackage(many, snipFiles("alpha.ts"), { commit: "c0ffee0c0ffee", maxBytes: 200 });
  const belowHeader = buildSnippetPackage(many, snipFiles("alpha.ts"), { commit: "c0ffee0c0ffee", maxBytes: 40 });
  check("snippets: a small cap shortens an omission-only block until it fits; below the header it delivers nothing",
    tinyCap.listed >= 1 && tinyCap.listed < manyBuilt.listed
    && new TextEncoder().encode(renderSnippetBlock(tinyCap)).byteLength <= 200
    && tinyCap.bytes === new TextEncoder().encode(renderSnippetBlock(tinyCap)).byteLength
    && renderSnippetBlock(belowHeader) === "" && belowHeader.bytes === 0,
    JSON.stringify({ listed: tinyCap.listed, bytes: tinyCap.bytes, below: belowHeader.bytes }));

  // (4) WHAT COUNTS AS A MENTION. A qualified reference and a camelCase/backticked token, never an
  // ALL-CAPS heading — `AUFTRAG` and `DONE` are the brief's own furniture and resolve nothing.
  const mentions = planSnippets({ briefText: "AUFTRAG DONE MELDUNG alpha.ts#alphaTwo `alphaOne` alphaWide",
    rows: snipRows, tracked: snipTracked });
  check("snippets: only qualified, backticked and camelCase tokens become refs — a heading never does",
    mentions.refs.map((ref) => ref.symbol).join(",") === "alphaTwo,alphaOne,alphaWide"
    && mentions.refs[0]!.qualified && !mentions.refs[1]!.qualified
    && mentions.reads.join(",") === "alpha.ts",
    JSON.stringify(mentions.refs.map((ref) => [ref.symbol, ref.qualified])));

  // (5) THE EMPTY CASE IS BYTE-IDENTICAL, which is what makes this module invisible where it has
  // nothing to say — the same property the notes block is built on.
  const silent = pack("AUFTRAG: raeume auf. Kein Symbol, keine Datei.");
  check("snippets: a brief naming no symbol renders the empty string — no header, no omission list",
    silent.block === "" && silent.built.shown.length === 0 && silent.built.bytes === 0,
    JSON.stringify(silent.built));
  const clarified = planSnippets({ briefText: "lies alpha.ts#alphaOne", rows: snipRows,
    tracked: snipTracked, clarify: true });
  check("snippets: a CLARIFY lane plans nothing at all — no refs, no reads, no omissions",
    clarified.refs.length === 0 && clarified.reads.length === 0 && clarified.omitted.length === 0,
    JSON.stringify(clarified));

  const exact = pack("lies alpha.ts#alphaOne", snipRows, paddedFile);
  check("snippets: a karted short symbol carries its complete exact body, with a commit pointer and no context",
    exact.built.shown.length === 1 && exact.built.shown[0]!.from === 42
    && exact.built.shown[0]!.to === 44
    && exact.built.shown[0]!.text === paddedLines.slice(41, 44).join("\n")
    && exact.block.includes("- alpha.ts#alphaOne@c0ffee0c0ffe Z. 42-44")
    && !exact.block.includes("GEKUERZT"), exact.block);
  const unkarted = pack("lies alpha.ts#alphaOne und `alphaTwo`",
    [{ id: "t1", files: ["alpha.ts"] }], paddedFile);
  check("snippets: references in prose alone carry pointers, without code",
    unkarted.built.shown.length === 2 && unkarted.built.shown.every((hit) => hit.text === "")
    && !unkarted.block.includes("```"), unkarted.block);
  const cardElsewhere = pack("lies alpha.ts#alphaOne",
    [{ id: "t1", files: ["alpha.ts"], symbols: ["beta.ts#alphaOne"] }], paddedFile);
  check("snippets: a same-named symbol in another card file grants no code",
    cardElsewhere.built.shown[0]?.text === "", cardElsewhere.block);
  const wave = pack("lies alpha.ts#alphaOne und noch einmal alpha.ts#alphaOne",
    [{ id: "t1", files: ["alpha.ts"], symbols: ["alpha.ts#alphaOne"] },
      { id: "t2", files: ["alpha.ts"] }], paddedFile);
  const waveLabels = wave.block.split("\n").filter((line) => line.startsWith("- alpha.ts#"));
  check("snippets: a wave shares one pointer for a twice-named symbol and carries both rows",
    wave.built.shown.length === 1 && wave.built.shown[0]!.taskIds.join(",") === "t1,t2"
    && waveLabels.length === 1 && waveLabels[0]!.includes("zu t1, t2"), wave.block);
  check("snippets: a single-task lane carries no row attribution", !exact.block.includes("zu t1"), exact.block);

  const boundary = (count: number): SnippetFile[] => [{ path: "alpha.ts", blob: "blob-alpha.ts",
    text: ["export function wide(): string {", ...Array.from({ length: count - 3 }, () => "  // ü"),
      '  return "x";', "}"].join("\n") }];
  const sixty = pack("lies alpha.ts#wide", snipRows, boundary(60));
  const sixtyOne = pack("lies alpha.ts#wide", snipRows, boundary(61));
  check("snippets: 60 complete lines carry code; 61 carry only the full pointer span",
    sixty.built.shown[0]?.text.split("\n").length === 60
    && sixtyOne.built.shown[0]?.from === 1 && sixtyOne.built.shown[0]?.to === 61
    && sixtyOne.built.shown[0]?.text === "" && !sixtyOne.block.includes("```"),
    JSON.stringify([sixty.built.shown, sixtyOne.built.shown]));
  const unclosed = pack("lies alpha.ts#wide", snipRows,
    [{ path: "alpha.ts", text: "export function wide() {\n  return 1;", blob: "blob-alpha.ts" }]);
  check("snippets: an unclosed short declaration grants no partial code",
    unclosed.built.shown[0]?.text === "" && !unclosed.block.includes("```"), unclosed.block);
  const wideLines = ["export function wide(): string {",
    ...Array.from({ length: 200 }, (_, i) => `  // ${"ü".repeat(60)} ${i}`), '  return "x";', "}"];
  const wideFile: SnippetFile[] = [{ path: "alpha.ts", text: wideLines.join("\n"), blob: "blob-alpha.ts" }];
  const wide = pack("lies alpha.ts#wide", snipRows, wideFile);
  check("snippets: long bodies are never clipped; the pointer names the complete span without code",
    wide.built.shown.length === 1 && wide.built.shown[0]!.from === 1
    && wide.built.shown[0]!.to === wideLines.length && wide.built.shown[0]!.text === ""
    && !wide.block.includes("GEKUERZT") && !wide.block.includes("```"), wide.block);
  const multibyte = pack("lies alpha.ts#wide", snipRows, boundary(60));
  check("snippets: rendered accounting counts UTF-8 bytes including optional code",
    multibyte.built.bytes === new TextEncoder().encode(multibyte.block).byteLength
    && multibyte.built.bytes > multibyte.block.length && multibyte.built.bytes <= SNIPPET_BLOCK_MAX_BYTES,
    `bytes=${multibyte.built.bytes} chars=${multibyte.block.length}`);
  const bigThenSmall: SnippetFile[] = [{ path: "alpha.ts",
    text: [...wideLines, "", "export const tiny = 1;"].join("\n"), blob: "blob-alpha.ts" }];
  const crowded = pack("lies alpha.ts#wide und alpha.ts#tiny", snipRows, bigThenSmall, 700);
  check("snippets: a long body leaves room for every pointer and a later short body",
    crowded.built.shown.map((hit) => hit.symbols[0]).join(",") === "wide,tiny"
    && crowded.built.shown[0]!.text === "" && crowded.built.shown[1]!.text === "export const tiny = 1;"
    && crowded.built.bytes <= 700, crowded.block);
  const budgetBody: SnippetFile[] = [{ path: "alpha.ts", blob: "blob-alpha.ts",
    text: ['export function huge() {', `  return "${"ü".repeat(400)}";`, "}", "export const tiny = 1;"].join("\n") }];
  const named = pack("lies alpha.ts#huge und alpha.ts#tiny", snipRows, budgetBody, 320);
  check("snippets: optional code exceeding the budget is withheld whole, with both pointers retained",
    named.built.shown.map((hit) => hit.symbols[0]).join(",") === "huge,tiny"
    && named.built.shown[0]!.text === "" && named.built.shown[1]!.text === "export const tiny = 1;"
    && named.built.bytes <= 320, named.block);
  const neighbours = pack("lies alpha.ts#alphaOne und alpha.ts#alphaTwo", snipRows, paddedFile);
  check("snippets: neighbouring symbols each have an exact pointer and their own complete code",
    neighbours.built.shown.length === 2
    && neighbours.built.shown[0]!.from === 42 && neighbours.built.shown[0]!.to === 44
    && neighbours.built.shown[1]!.from === 46 && neighbours.built.shown[1]!.to === 46,
    neighbours.block);

  // (11) SAME INPUT, SAME BLOCK — the property a receipt asserting the delivered bytes stands on.
  const once = pack("lies alpha.ts#alphaWide und `alphaTwo` und alpha.ts#ghostSymbol");
  const twice = pack("lies alpha.ts#alphaWide und `alphaTwo` und alpha.ts#ghostSymbol");
  check("snippets: the selection, the order and the bytes are identical for identical inputs",
    once.block === twice.block && JSON.stringify(once.built) === JSON.stringify(twice.built)
    && once.built.shown.length > 0,
    `bytes=${once.built.bytes} shown=${once.built.shown.map((hit) => hit.symbols.join("+")).join(",")}`);

  // (12) A SOURCE THE CALLER COULD NOT READ, and one that is not text. Both are refused by name:
  // "the tree had no bytes for me" is not "this symbol does not exist".
  const unreadable = pack("lies alpha.ts#alphaOne", snipRows,
    [{ path: "alpha.ts", text: null, blob: "blob-alpha.ts" }]);
  check("snippets: an unreadable source is source-unreadable, never a missing symbol",
    JSON.stringify(unreadable.built.omitted) === JSON.stringify([{ ref: "alpha.ts#alphaOne", why: "source-unreadable" }]),
    JSON.stringify(unreadable.built.omitted));
  const binary = pack("lies alpha.ts#alphaOne", snipRows,
    [{ path: "alpha.ts", text: `export function alphaOne() {}\u0000`, blob: "blob-alpha.ts" }]);
  check("snippets: a source carrying NUL is binary-source and yields no excerpt",
    binary.built.shown.length === 0
    && binary.built.omitted.some((entry) => entry.why === "binary-source"),
    JSON.stringify(binary.built.omitted));

  // (13) PHASE ONE OPENS NOTHING IT WAS NOT ASKED FOR. The `reads` list is the whole permission
  // phase two has, and a brief that names no symbol in a file must not put it on that list.
  const scoped = planSnippets({ briefText: "lies beta.ts#alphaOne", rows:
    [{ id: "t1", files: ["alpha.ts", "notes.md", "logo.png"] }], tracked: snipTracked });
  check("snippets: only files a symbol was asked for are readable — no repo-wide load",
    scoped.reads.join(",") === "beta.ts", JSON.stringify(scoped.reads));
  check("snippets: the code ceiling is the declared 60 lines, and the index retains exact declaration positions",
    SNIPPET_HIT_MAX_LINES === 60 && definitionLines(alpha.split("\n"), "alphaTwo").join(",") === "5",
    `${SNIPPET_HIT_MAX_LINES} ${definitionLines(alpha.split("\n"), "alphaTwo")}`);

  sessionAgentsChecks(check);
  await laneSessionFilesChecks(check);
  await ownerSuccessionPermissionsChecks(check);
  taskCatalogChecks(check);
  privatePackChecks(check);
  await contextBorrowChecks(check);

  orchestrationTriggerChecks(check);
  foundingStandChecks(check);
  packAnatomyChecks(check);
  packMcpChecks(check);

  if (!externalCheck) {
    console.log(rows.join("\n"));
    console.log(failures ? `\n${failures} FAILURES` : "\nALL PASS");
    if (failures) process.exitCode = 1;
  }
}

// THE ANATOMY OF A PACK (dd549bce): Kern, Zusaetze with their condition, Fassung, Varianten per
// position — declared in the manifest, resolved by the plan per position, and invisible for a pack
// that declares none of it. Pure: bytes in, plan out.
function packAnatomyChecks(check: ContextPlanCheck): void {
  const files: Record<string, string> = {
    "docs/kern.md": "## Kern\nimmer.\n", "docs/main.md": "## Main\nfuer die MAIN.\n",
    "docs/verify.md": "## Verify\nnur beim Pruefen.\n", "docs/lane.md": "## Lane extra\nnur fuer Lanes.\n",
  };
  const base = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: "anatomie", useWhen: "Ein Pack mit Anatomie.", scope: "repo-contract", audience: "agent", triggers: ["always"],
    hardness: "guidance", sources: [{ path: "docs/kern.md", anchor: "## Kern" }],
    requiredCapabilities: ["tracked-source-read"], harnesses: ["claude", "codex"], modes: ["read-only", "mutating"],
    estimatedBytes: 100, evidence: "tree-anchor", owner: "owner", status: "active", ...over,
  });
  const anatomy = {
    fassung: "vorgeschlagen",
    zusaetze: [
      { id: "beim-pruefen", bedingung: { triggers: ["verification"] }, sources: [{ path: "docs/verify.md", anchor: "## Verify" }] },
      { id: "nur-lane", bedingung: { positions: ["lane"] }, sources: [{ path: "docs/lane.md", anchor: "## Lane extra" }] },
    ],
    varianten: { main: { sources: [{ id: "anatomie.main", path: "docs/main.md", anchor: "## Main" }], useWhen: "Die MAIN-Fassung des Packs." } },
  };
  const world = (packs: readonly unknown[], position?: "lane" | "main" | "orchestratorin", triggers: ContextPackTrigger[] = ["always"]) =>
    planRepoContext({ manifest: readContextManifest(JSON.stringify(packs)),
      repo: { trackedPaths: new Set(Object.keys(files)), sourceBytes: new Map(Object.entries(files)) },
      facts: { harness: "claude", mode: "mutating", triggers, capabilities: ["tracked-source-read"], ...(position ? { position } : {}) } });
  const read = readContextManifest(JSON.stringify([base(anatomy)]));
  check("pack anatomy: the manifest reader collects the Zusaetze' and Varianten' source paths for the anchor check",
    read.kind === "packs" && ["docs/kern.md", "docs/lane.md", "docs/main.md", "docs/verify.md"].every((path) => read.referencedPaths.includes(path)),
    JSON.stringify(read.kind === "packs" ? read.referencedPaths : read));
  const lane = world([base(anatomy)], "lane", ["always", "verification"]).selected[0];
  check("pack anatomy: a lane founding takes the standard Kern and every Zusatz whose condition holds, in order",
    !!lane && JSON.stringify(lane.sources) === JSON.stringify([{ path: "docs/kern.md", anchor: "## Kern" },
      { path: "docs/verify.md", anchor: "## Verify", id: "beim-pruefen-1" }, { path: "docs/lane.md", anchor: "## Lane extra", id: "nur-lane-1" }])
      && JSON.stringify(lane.anatomie) === JSON.stringify({ kern: ["anatomie.source-1"], variante: "standard", zusaetze: [
        { id: "beim-pruefen", bedingung: { triggers: ["verification"] }, an: true, teile: ["anatomie.beim-pruefen-1"] },
        { id: "nur-lane", bedingung: { positions: ["lane"] }, an: true, teile: ["anatomie.nur-lane-1"] }], fassung: "vorgeschlagen" })
      && lane.useWhen === "Ein Pack mit Anatomie.",
    JSON.stringify(lane));
  const main = world([base(anatomy)], "main").selected[0];
  check("pack anatomy: a MAIN founding takes its Variante as Kern with its purpose line, and names the conditions that failed",
    !!main && JSON.stringify(main.sources) === JSON.stringify([{ id: "anatomie.main", path: "docs/main.md", anchor: "## Main" }])
      && main.useWhen === "Die MAIN-Fassung des Packs." && main.anatomie?.variante === "main"
      && JSON.stringify(main.anatomie?.kern) === JSON.stringify(["anatomie.main"])
      && main.anatomie?.zusaetze.every((z) => !z.an) && JSON.stringify(main.anatomie?.zusaetze.map((z) => z.verfehlt)) === JSON.stringify([["triggers"], ["positions"]]),
    JSON.stringify(main));
  const unknown = world([base(anatomy)]).selected[0];
  check("pack anatomy: without a known position the standard Kern holds and a positional Zusatz stays off",
    !!unknown && unknown.anatomie?.variante === "standard" && unknown.anatomie.zusaetze.find((z) => z.id === "nur-lane")?.an === false,
    JSON.stringify(unknown?.anatomie));
  // the same manifest twice, once with anatomy beside a plain pack: the plain one is byte for byte
  const plain = base({ id: "schlicht" });
  const alone = world([plain], "lane");
  const beside = world([plain, base(anatomy)], "lane");
  check("pack anatomy: a pack without anatomy plans byte for byte as before — no anatomie key, the same sources",
    JSON.stringify(alone.selected[0]) === JSON.stringify(beside.selected.find((p) => p.id === "schlicht"))
      && !("anatomie" in (alone.selected[0] ?? {})) && JSON.stringify(alone.selected[0]?.sources) === JSON.stringify(plain.sources),
    JSON.stringify(alone.selected[0]));
  const seeds = planContext({ sourceTree: "fleet", harness: "claude", mode: "mutating", triggers: ["always", "verification"],
    capabilities: fullCapabilities(), position: "lane" });
  const seedsNoPosition = planContext({ sourceTree: "fleet", harness: "claude", mode: "mutating", triggers: ["always", "verification"],
    capabilities: fullCapabilities() });
  check("pack anatomy: the Fleet seeds declare none, so a position changes nothing in their plan",
    JSON.stringify(seeds) === JSON.stringify(seedsNoPosition) && seeds.selected.every((pack) => !("anatomie" in pack)));
  const broken: [string, Record<string, unknown>][] = [
    ["an unknown fassung", { fassung: "gueltig" }],
    ["a Zusatz without a condition", { zusaetze: [{ id: "leer", bedingung: {}, sources: [{ path: "docs/kern.md", anchor: "## Kern" }] }] }],
    ["an unknown condition key", { zusaetze: [{ id: "x", bedingung: { modell: ["opus"] }, sources: [{ path: "docs/kern.md", anchor: "## Kern" }] }] }],
    ["a Zusatz anchor the tree does not have", { zusaetze: [{ id: "x", bedingung: { triggers: ["always"] }, sources: [{ path: "docs/kern.md", anchor: "## Nirgends" }] }] }],
    ["a Variante for no position", { varianten: { worker: { sources: [{ path: "docs/kern.md", anchor: "## Kern" }] } } }],
    ["a Variante path that is not tracked", { varianten: { lane: { sources: [{ path: "docs/fehlt.md", anchor: "## Kern" }] } } }],
    ["a Zusatz that names a Kern part again", { zusaetze: [{ id: "x", bedingung: { triggers: ["always"] }, sources: [{ id: "source-1", path: "docs/kern.md", anchor: "## Kern" }] }] }],
  ];
  for (const [what, over] of broken) {
    const plan = world([base(over)], "lane");
    check(`pack anatomy: ${what} makes the pack manifest-invalid, never a silent half delivery`,
      plan.selected.length === 0 && plan.omitted.length === 1 && plan.omitted[0]?.why === "manifest-invalid", JSON.stringify(plan));
  }
}

// A ZUSATZ THAT BRINGS AN MCP SERVER (tranche 3 of the anatomy): the plan names per harness what the
// spawn WOULD carry — claude the exact `--mcp-config` argument behind --strict-mcp-config, every other
// harness its evidenced state — and no seed may carry one while ensureSlot hands nothing over.
function packMcpChecks(check: ContextPlanCheck): void {
  const server: ContextPackMcpServer = { name: "computer-use", command: "npx", args: ["-y", "@example/computer-use-mcp@1.2.3"] };
  const pack = { id: "mcp-probe", useWhen: "Ein Pack mit MCP-Zusatz.", sources: [{ path: "docs/kern.md", anchor: "## Kern" }],
    zusaetze: [{ id: "mcp-server", bedingung: { positions: ["lane"] as const }, sources: [], mcp: server }] };
  const at = (harness: string, position: "lane" | "main" = "lane") =>
    resolvePackAnatomy(pack, { position, harness, triggers: new Set<ContextPackTrigger>(["always"]) });
  const zusatzOf = (harness: string, position: "lane" | "main" = "lane") => at(harness, position).anatomie?.zusaetze[0];
  const json = '{"mcpServers":{"computer-use":{"command":"npx","args":["-y","@example/computer-use-mcp@1.2.3"]}}}';
  const flag = `--mcp-config '${json}'`;

  const claude = zusatzOf("claude");
  check("pack mcp: claude — the Zusatz is on, apply, and the spawn would gain exactly --mcp-config '<json>'",
    claude?.an === true && claude.mcp?.zustand === "apply" && claude.mcp.mitgaebe === flag && claudeMcpConfigFlag([server]) === flag,
    JSON.stringify(claude?.mcp));
  check("pack mcp: claude — the exact text-lane MCP tail is --strict-mcp-config then the pack's --mcp-config",
    ` --strict-mcp-config ${claude?.mcp?.mitgaebe ?? ""}` === ` --strict-mcp-config --mcp-config '${json}'`, claude?.mcp?.mitgaebe ?? "none");
  check("pack mcp: claude — the reason cites the installed CLI help and says WOULD, never delivered",
    !!claude?.mcp && claude.mcp.beleg.includes("claude --help (2.1.295)") && claude.mcp.beleg.includes("wuerde")
      && claude.mcp.beleg.includes("--strict-mcp-config") && !/\b(?:delivered|arrived|geliefert|angekommen|wird mitgegeben)\b/.test(JSON.stringify(claude.mcp)),
    claude?.mcp?.beleg ?? "none");
  check("pack mcp: the receipt entry names server, harness, zustand, beleg, mitgaebe — no delivery field",
    JSON.stringify(Object.keys(claude?.mcp ?? {})) === JSON.stringify(["server", "harness", "zustand", "beleg", "mitgaebe"]),
    JSON.stringify(Object.keys(claude?.mcp ?? {})));
  // the shell yields the JSON byte for byte, also for an argument with a single quote in it
  const quoted = { ...server, args: ["--name", "it's"] };
  const said = spawnSync("/bin/sh", ["-c", `printf '%s' ${claudeMcpConfigFlag([quoted]).slice("--mcp-config ".length)}`], { encoding: "utf8" });
  check("pack mcp: claude — the single-quoted JSON survives the shell byte for byte, a quote in an argument included",
    said.status === 0 && said.stdout === JSON.stringify({ mcpServers: { "computer-use": { command: "npx", args: ["--name", "it's"] } } }),
    `${said.status} ${said.stdout}`);

  const evidenced: [string, string][] = [["codex", "codex --help (codex-cli 0.160.0)"], ["pi", "pi mcp --help (pi 1.0.2)"], ["pi-zai", "pi mcp --help (pi 1.0.2)"]];
  for (const [harness, source] of evidenced) {
    const z = zusatzOf(harness);
    check(`pack mcp: ${harness} — unsupported with its CLI evidence, and nothing the spawn would carry`,
      z?.an === true && z.mcp?.zustand === "unsupported" && z.mcp.beleg.startsWith(source) && !("mitgaebe" in z.mcp) && z.mcp.harness === harness,
      JSON.stringify(z?.mcp));
  }
  for (const harness of CONTEXT_PACK_HARNESSES.filter((h) => !["claude", "codex", "pi", "pi-zai"].includes(h))) {
    const z = zusatzOf(harness);
    check(`pack mcp: ${harness} — not evidenced, so unsupported`,
      z?.mcp?.zustand === "unsupported" && z.mcp.beleg.startsWith("nicht belegt") && !("mitgaebe" in z.mcp), JSON.stringify(z?.mcp));
  }
  const byModel = packMcpAnschluss(server, "claude-opus-5-5", true);
  check("pack mcp: no compatibility from a model name — a model id as harness is not evidenced",
    byModel.zustand === "unsupported" && byModel.beleg.startsWith("nicht belegt") && !("mitgaebe" in byModel), JSON.stringify(byModel));
  const off = zusatzOf("claude", "main");
  check("pack mcp: a Zusatz that is off still names its state, but nothing the spawn would carry",
    off?.an === false && off.mcp?.zustand === "apply" && !("mitgaebe" in off.mcp), JSON.stringify(off));
  const later = packMcpAnschluss(server, "claude", true, "vor-dem-land");
  check("pack mcp: a Zusatz with a zeitpunkt is borrowed later, so its server is unsupported — it only arrives at a start",
    later.zustand === "unsupported" && !("mitgaebe" in later), JSON.stringify(later));
  const planOf = (harness: string, position: "lane" | "main") => {
    const resolved = at(harness, position);
    return { selected: [{ id: pack.id, hardness: "guidance" as const, sources: resolved.sources, estimatedBytes: 0,
      ...(resolved.anatomie ? { anatomie: resolved.anatomie } : {}) }] };
  };
  check("pack mcp: planMcpServers takes exactly the applying servers that are on",
    JSON.stringify(planMcpServers(planOf("claude", "lane"))) === JSON.stringify([server])
      && planMcpServers(planOf("claude", "main")).length === 0 && planMcpServers(planOf("pi", "lane")).length === 0,
    JSON.stringify(planMcpServers(planOf("claude", "lane"))));
  const plainZusatz = resolvePackAnatomy({ ...pack, zusaetze: [{ id: "ohne", bedingung: { positions: ["lane"] }, sources: [] }] },
    { position: "lane", harness: "claude", triggers: new Set<ContextPackTrigger>(["always"]) }).anatomie?.zusaetze[0];
  check("pack mcp: a Zusatz without mcp carries no mcp key — its receipt keeps its bytes",
    !!plainZusatz && !("mcp" in plainZusatz), JSON.stringify(plainZusatz));

  // THE SPAWN SIDE (server.ts#agentCmd): the pack's flag follows the strict flag, on the claude branch only
  const source = readFileSync(join(import.meta.dir, "../server.ts"), "utf8");
  const acStart = source.indexOf("function agentCmd(");
  const acCode = source.slice(acStart, source.indexOf("\n}\n", acStart)).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  const claudeBranch = acCode.slice(acCode.indexOf("if (claude) {"), acCode.indexOf("else if (HARNESS_MODEL_FLAG"));
  check("pack mcp: agentCmd appends claudeMcpConfigFlag right after --strict-mcp-config, once, on the claude branch",
    claudeBranch.includes('if (!browserMcp) cmd += " --strict-mcp-config";\n    if (packMcp.length) cmd += ` ${claudeMcpConfigFlag(packMcp)}`;')
      && (acCode.match(/claudeMcpConfigFlag/g) ?? []).length === 1, `branch=${claudeBranch.length}b`);
  check("pack mcp: only the claude adapter reads o.packMcp — the one harness the evidence table says apply to",
    (source.match(/o\.packMcp/g) ?? []).length === 1
      && /spawnCmd: \(o\) => slotCmd\(o\.sessionId, o\.resume, o\.model, o\.effort, o\.browserMcp, o\.rulebookRole, o\.packMcp \?\? \[\], o\.remoteName\)/.test(source),
    `${(source.match(/o\.packMcp/g) ?? []).length} reads`);

  // THE CUT (clarification 51c72127): ensureSlot hands no pack server to spawnCmd, so no seed may carry
  // an MCP Zusatz — a receipt would otherwise say "apply" for a founding whose pane never gets it. The
  // follow-up card that wires the hand-over on every spawn (open/heal/restart/wake) lifts THIS check.
  const esStart = source.indexOf("async function ensureSlot(");
  const esCall = source.slice(source.indexOf("h.spawnCmd({", esStart), source.indexOf("})}`);", esStart));
  const handsOver = /\bpackMcp\b/.test(esCall);
  const seeds: readonly ContextPack[] = CONTEXT_PACKS;
  const withMcp = seeds.filter((seed) => "zusaetze" in seed && (seed.zusaetze ?? []).some((zusatz) => zusatz.mcp !== undefined)).map((seed) => seed.id);
  check("pack mcp: no Fleet seed carries an MCP Zusatz while ensureSlot hands none to spawnCmd (the hand-over is its own card)",
    esCall.length > 0 && (handsOver || withMcp.length === 0),
    `handsOver=${handsOver} seedsWithMcp=${withMcp.join(",") || "none"} — lift only together with the ensureSlot hand-over`);

  // THE MANIFEST SIDE stays closed: context-manifest.ts knows no `mcp` key, so a repo pack naming one
  // is refused whole, never half delivered without its server
  const files = { "docs/kern.md": "## Kern\nimmer.\n" };
  const manifestPack = { id: "repo-mcp", useWhen: "Ein Repo-Pack mit MCP.", scope: "repo-contract", audience: "agent", triggers: ["always"],
    hardness: "guidance", sources: [{ path: "docs/kern.md", anchor: "## Kern" }], requiredCapabilities: ["tracked-source-read"],
    harnesses: ["claude"], modes: ["mutating"], estimatedBytes: 1, evidence: "tree-anchor", owner: "owner", status: "active",
    zusaetze: [{ id: "mcp-server", bedingung: { positions: ["lane"] }, sources: [{ path: "docs/kern.md", anchor: "## Kern" }], mcp: server }] };
  const refused = planRepoContext({ manifest: readContextManifest(JSON.stringify([manifestPack])),
    repo: { trackedPaths: new Set(Object.keys(files)), sourceBytes: new Map(Object.entries(files)) },
    facts: { harness: "claude", mode: "mutating", triggers: ["always"], capabilities: ["tracked-source-read"], position: "lane" } });
  check("pack mcp: a repo manifest Zusatz with mcp is manifest-invalid — the manifest door stays closed",
    refused.selected.length === 0 && refused.omitted[0]?.why === "manifest-invalid", JSON.stringify(refused));
}

function taskCatalogChecks(check: ContextPlanCheck): void {
  const here = resolve(import.meta.dir, "..");
  const candidates = [here];
  try { candidates.push(dirname(realpathSync(join(here, "node_modules")))); } catch { /* no source pointer */ }
  const root = candidates.find((path) => {
    try { readFileSync(join(path, ".fleet/context-packs.json")); return true; } catch { return false; }
  });
  if (!root) { check("task catalog: PROBE finds the real manifest", false, candidates.join(",")); return; }
  const manifest = readContextManifest(readFileSync(join(root, ".fleet/context-packs.json"), "utf8"));
  const tracked = spawnSync("git", ["-C", root, "ls-files", "-z"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (manifest.kind !== "packs" || tracked.status !== 0) {
    check("task catalog: PROBE reads the manifest and tracked paths", false, `manifest=${manifest.kind} git=${tracked.status}`); return;
  }
  const repo = { trackedPaths: new Set(tracked.stdout.split("\0").filter(Boolean)), sourceBytes: new Map<string, string>() };
  for (const path of manifest.referencedPaths) {
    try { repo.sourceBytes.set(path, readFileSync(join(root, path), "utf8")); } catch { /* validator reports missing sources */ }
  }
  const baseline: ContextPackTrigger[] = ["always", "verification", "jev-use"];
  const catalog = (texts: readonly string[], harness = "claude", capabilities = fullCapabilities()) => {
    const facts = { harness, mode: "mutating" as const, capabilities, triggers: taskContextTriggers(texts, baseline) };
    const seeds = planContext({ sourceTree: "fleet", ...facts });
    const own = planRepoContext({ manifest, repo, facts });
    return { selected: [...seeds.selected, ...own.selected].map((p) => p.id), omitted: [...seeds.omitted, ...own.omitted] };
  };
  const code = catalog(["ZIEL: Queue-Ansicht korrigieren", "FLAECHE: src/client.ts"]);
  const measurement = catalog(["ZIEL: Zustellungsdauer messen", "FLAECHE: docs/messungen/latenz.md"]);
  const rulebook = catalog(["ZIEL: Regelbuch aendern", "FLAECHE: rulebook/einstieg.md"]);
  // `src/` in the FLAECHE makes it visible work: the testinstanz acceptance rides along (trigger visible-surface)
  check("task catalog: an ordinary code task gets exactly the core and proof seeds plus the repo's always packs",
    code.selected.join(",") === "portable-core,verify-e2e,konzept-claude-fleet,haltung-worker,nachfolge-klug,testinstanz-abnahme", JSON.stringify(code));
  check("task catalog: a measurement task adds only the measurement index",
    measurement.selected.join(",") === "portable-core,verify-e2e,konzept-claude-fleet,haltung-worker,messnotiz-index,nachfolge-klug", JSON.stringify(measurement));
  check("task catalog: a rulebook edit adds only the generator guidance",
    rulebook.selected.join(",") === "portable-core,verify-e2e,konzept-claude-fleet,haltung-worker,rulebook-generat,nachfolge-klug", JSON.stringify(rulebook));
  check("task catalog: code, measurement and rulebook catalogs are pairwise different",
    new Set([code, measurement, rulebook].map((row) => row.selected.join(","))).size === 3);
  check("task catalog: unrelated work omits both act-specific packs by trigger",
    ["rulebook-generat", "messnotiz-index"].every((id) => code.omitted.some((p) => p.id === id && p.why === "trigger-not-matched")),
    JSON.stringify(code.omitted));
  check("task catalog: reading the rulebook alone does not select editing guidance",
    ["Lies CLAUDE.md", "Lies CLAUDE.md und aendere src/client.ts"].every((text) =>
      !catalog([text]).selected.includes("rulebook-generat")));
  check("task catalog: surfaces alone can name rulebook and measurement work",
    catalog(["rulebook.ts"]).selected.includes("rulebook-generat")
      && catalog(["docs/messungen/latenz.md"]).selected.includes("messnotiz-index"));
  check("task catalog: rulebook editing matches umlauts and their ASCII spelling",
    ["Regelbuch ändern", "Ändere CLAUDE.md", "Regelbuch aendern"].every((text) =>
      catalog([text]).selected.includes("rulebook-generat")));
  const harness = catalog(["ZIEL: Harness-Adapter pruefen", "FLAECHE: server.ts#HARNESSES"]);
  check("task catalog: a harness task selects the adapter pack through the text path",
    harness.selected.includes("harness-adapter"), JSON.stringify(harness));
  check("task catalog: the text path preserves the capability boundary",
    catalog(["Harness auswaehlen"], "claude", fullCapabilities().filter((c) => c !== "harness-adapter-read"))
      .omitted.some((p) => p.id === "harness-adapter" && p.why === "capability-missing"));
  check("task catalog: a monitoring role omits act packs by mode even with matching text",
    ["rulebook-generat", "messnotiz-index"].every((id) => planRepoContext({ manifest, repo, facts: { harness: "claude", mode: "monitoring", capabilities: fullCapabilities(),
      triggers: taskContextTriggers(["Regelbuch aendern und messen"], baseline) } })
      .omitted.some((p) => p.id === id && p.why === "mode-unsupported")));
  // `orchestration` is a caller-supplied trigger (server.ts#BOOTSTRAP_CONTEXT_TRIGGERS), never read from task text.
  check("task catalog: an empty task keeps only baseline triggers even if all candidates are offered",
    taskContextTriggers([], CONTEXT_PACK_TRIGGERS).join(",") === "always,verification,landing,orchestration");
  check("task catalog: removed queue and deployment triggers and packs stay absent",
    !(CONTEXT_PACK_TRIGGERS as readonly string[]).some((t) => ["task-queue", "deployment"].includes(t))
      && !(CONTEXT_PACKS as readonly { id: string }[]).some((p) => ["task-queue", "private-deploy-overlay"].includes(p.id)));
}

// THE MECHANICAL RECEIVER of a private pack line (renderPrivatePackLines' format): null when no line
// names the id at all (UNOBSERVED — never a refusal), else the path the line names, its verdict and the
// bytes, which it reads ONLY under `hash match`. Exported for e2e/konzepte.ts, whose pane reader applies
// this same rule to the bytes a founding pasted.
export function readDelivered(lines: readonly string[], id: string):
  { path: string | null; verdict: string | null; bytes: string | null } | null {
  for (const line of lines) {
    const m = /^ {2}(?:(\/.+?) \| )?(k-[a-z0-9-]+)(?: v\d+)? · privat, lesen statt kopieren · hash (match|drift|missing)\b/.exec(line);
    if (!m || m[2] !== id) continue;
    const path = m[1] ?? null;
    const verdict = m[3]!;
    let bytes: string | null = null;
    if (path !== null && verdict === "match") { try { bytes = readFileSync(path, "utf8"); } catch { bytes = null; } }
    return { path, verdict, bytes };
  }
  return null;
}

function contextDeliverySeam(konzeptRoot: string | null) {
  const server = readFileSync(join(import.meta.dir, "..", "server.ts"), "utf8");
  const functions = ["declaredSourceHash", "privatePackResolutionOf", "availableContextPlan",
    "renderContextAnchorBlock", "contextReceiptSelections"].map((name) => {
    const from = server.indexOf(`function ${name}(`);
    return server.slice(from, server.indexOf("\n}", from) + 2);
  }).join("\n");
  return new Function("KONZEPT_ROOT", "CONTEXT_PACKS",
    "resolvePrivatePack", "renderPrivatePackLines", new Bun.Transpiler({ loader: "ts" }).transformSync(
      `const privatePackResolutions = new WeakMap();\n${functions}\n`
      + "return { availableContextPlan, renderContextAnchorBlock, contextReceiptSelections };"))(
    konzeptRoot, CONTEXT_PACKS, resolvePrivatePack, renderPrivatePackLines) as {
      availableContextPlan: (plan: ReturnType<typeof planContext>) => ReturnType<typeof planContext> & {
        omitted: readonly { id: string; why: string; reason?: string | null }[] };
      renderContextAnchorBlock: (plan: ReturnType<typeof planContext>) => string;
      contextReceiptSelections: (selected: ReturnType<typeof planContext>["selected"]) => { id: string; hardness: string }[];
    };
}

// --- PRIVATE PACKS (Program Konzeptgedaechtnis 31aa88ea, Schnitt 4). The konzept seed is selected for
// claude and codex lanes and MAINs of this tree (never a Pi harness), and its id resolves under a FIXTURE private root to the
// current fassung's path plus one of three hash verdicts. Each verdict is produced by a NAMED mutation
// of the fixture and undone again, so a green verdict is shown to be caused, not merely observed.
function privatePackChecks(check: ContextPlanCheck): void {
  const seed = CONTEXT_PACKS.find((pack) => pack.id === "konzept-claude-fleet");
  const V2_SHA = "a085430ef83f317157cfc613561c99a72317cf6e129d8276843d11a956ea00dc";
  check("private pack: konzept-claude-fleet is a private-ops seed whose id is a konzept id and whose hash pins Sicht v2",
    !!seed && seed.audience === "private-ops" && "privateSourceId" in seed && KONZEPT_ID_RE.test(seed.privateSourceId)
      && seed.sourceHash === V2_SHA && !("sources" in seed && seed.sources !== undefined),
    JSON.stringify(seed ?? null));
  check("private pack: the verdict vocabulary is closed", PRIVATE_PACK_VERDICTS.join(",") === "match,drift,missing");

  // The facts of a lane dispatch (server.ts#DISPATCH_CONTEXT_*) and of a Program-MAIN founding in the
  // Fleet frame (server.ts#BOOTSTRAP_CONTEXT_TRIGGERS, FLEET_CONTROL_CONTEXT_CAPABILITIES), per harness.
  const laneCaps = ["tracked-source-read", "pure-validator-run", "e2e-run", "git-inspect",
    "harness-adapter-read", "private-overlay-read"] as ContextPackCapability[];
  const mainCaps = [...laneCaps, "task-queue-read", "deploy-observe"] as ContextPackCapability[];
  const selectedFor = (harness: string, triggers: readonly ("always" | "verification" | "jev-use" | "landing")[],
    capabilities: ContextPackCapability[], sourceTree: "fleet" | "foreign" = "fleet") =>
    planContext({ sourceTree, harness, mode: "mutating", triggers: [...triggers], capabilities });
  const harnessRows = ["claude", "codex"].map((harness) => ({ harness,
    lane: selectedFor(harness, ["always", "verification", "jev-use"], laneCaps).selected.some((p) => p.id === "konzept-claude-fleet"),
    main: selectedFor(harness, ["always", "verification"], mainCaps).selected.some((p) => p.id === "konzept-claude-fleet") }));
  check("private pack: a claude and a codex lane AND MAIN of this tree each get konzept-claude-fleet selected",
    harnessRows.every((row) => row.lane && row.main), JSON.stringify(harnessRows));
  // OWNER DISPOSITION 804bc34a: the konzept release holds for claude and codex, NOT for GLM or any
  // other Pi harness. Mutation: put any pi-* back on the seed → that harness turns this row red.
  const piHarnesses = CONTEXT_PACK_HARNESSES.filter((harness) => harness.startsWith("pi"));
  const piRows = piHarnesses.map((harness) => ({ harness,
    lane: selectedFor(harness, ["always", "verification"], laneCaps).omitted.find((p) => p.id === "konzept-claude-fleet")?.why ?? null,
    main: selectedFor(harness, ["always", "verification"], mainCaps).omitted.find((p) => p.id === "konzept-claude-fleet")?.why ?? null }));
  check("private pack: every Pi harness (pi, pi-zai, pi-ox, pi-unfenced) omits konzept-claude-fleet as harness-unsupported, lane and MAIN",
    piHarnesses.length === 4 && piRows.every((row) => row.lane === "harness-unsupported" && row.main === "harness-unsupported")
      && JSON.stringify(seed?.harnesses) === JSON.stringify(["claude", "codex"]), JSON.stringify(piRows));
  const boxed = selectedFor("container", ["always"], laneCaps).omitted.find((p) => p.id === "konzept-claude-fleet");
  const worker = selectedFor("claude", ["landing"], laneCaps).omitted.find((p) => p.id === "konzept-claude-fleet");
  const foreignTree = selectedFor("claude", ["always"], laneCaps, "foreign").omitted.find((p) => p.id === "konzept-claude-fleet");
  check("private pack: a container session, the merge/repair worker and a foreign tree omit it by their own named rule",
    boxed?.why === "harness-unsupported" && worker?.why === "trigger-not-matched" && foreignTree?.why === "source-unavailable",
    JSON.stringify({ boxed, worker, foreignTree }));
  check("private pack: the plan hands the renderer the bare id, never a path or a hash of its own",
    JSON.stringify(selectedFor("claude", ["always"], laneCaps).selected.find((p) => p.id === "konzept-claude-fleet")?.sources)
      === JSON.stringify({ privateSourceId: "k-claude-fleet" }));

  // --- the fixture private root: two published fassungen, v2 current, a content marker in each
  const root = mkdtempSync(join(tmpdir(), "fleet-e2e-private-root-"));
  try {
    const K = "k-claude-fleet";
    const dir = join(root, K);
    mkdirSync(dir);
    const MARKER = "KONZEPT-FIXTURE-CONTENT-7f3e";
    const sha = (text: string): string => createHash("sha256").update(text).digest("hex");
    const v1 = `# v1\n${MARKER} eins\n`;
    const v2 = `# v2\n${MARKER} zwei\n`;
    writeFileSync(join(dir, "v1.md"), v1);
    writeFileSync(join(dir, "v2.md"), v2);
    const row = (version: number, text: string): string =>
      `${JSON.stringify({ konzept: K, version, vorgaenger: version > 1 ? version - 1 : null, sha256: sha(text), at: version })}\n`;
    writeFileSync(join(dir, "versionen.jsonl"), row(1, v1) + row(2, v2));
    const declared = sha(v2);
    const resolve = (r: string | null = root) => resolvePrivatePack(r, K, declared);
    const block = (r: ReturnType<typeof resolve>): string => renderPrivatePackLines(r).join("\n");

    const deliveredPlan = (konzeptRoot: string | null) => {
      const seam = contextDeliverySeam(konzeptRoot);
      const plan = seam.availableContextPlan({ selected: [{ id: "konzept-claude-fleet", hardness: "guidance",
        sources: { privateSourceId: K }, sourceHash: declared, estimatedBytes: 0 }], omitted: [] });
      return { plan, block: seam.renderContextAnchorBlock(plan), receipt: seam.contextReceiptSelections(plan.selected) };
    };
    const unavailable = deliveredPlan(null);
    check("private delivery: unset root omits the anchor and receipt selection, naming source-unavailable and env",
      unavailable.block === "" && unavailable.receipt.length === 0
      && unavailable.plan.omitted[0]?.why === "source-unavailable"
      && unavailable.plan.omitted[0]?.reason?.includes("FLEET_KONZEPT_ROOT") === true, JSON.stringify(unavailable));
    writeFileSync(join(dir, "versionen.jsonl"), "");
    const noVersion = deliveredPlan(root);
    writeFileSync(join(dir, "versionen.jsonl"), row(1, v1) + row(2, v2));
    check("private delivery: no published version omits the anchor with its reason; publishing restores it automatically",
      noVersion.block === "" && noVersion.receipt.length === 0
      && noVersion.plan.omitted[0]?.why === "source-unavailable"
      && noVersion.plan.omitted[0]?.reason?.includes("no published version") === true
      && deliveredPlan(root).block.includes("hash match") && deliveredPlan(root).receipt[0]?.id === "konzept-claude-fleet",
      JSON.stringify(noVersion));
    appendFileSync(join(dir, "v2.md"), "drift\n");
    const driftDelivery = deliveredPlan(root);
    writeFileSync(join(dir, "v2.md"), v2);
    check("private delivery: drift remains visible and selected",
      driftDelivery.block.includes("hash drift") && driftDelivery.receipt[0]?.id === "konzept-claude-fleet"
      && driftDelivery.plan.omitted.length === 0, JSON.stringify(driftDelivery));

    check("private delivery: the brief and receipt both retain the private pack's guidance degree",
      driftDelivery.block.includes("- konzept-claude-fleet [guidance]")
        && driftDelivery.receipt[0]?.hardness === "guidance", JSON.stringify(driftDelivery));

    const matched = resolve();
    const matchBlock = block(matched);
    check("private pack (match): the current fassung v2 resolves to its readable local path with verdict match",
      matched.verdict === "match" && matched.why === null && matched.version === 2 && matched.path === join(dir, "v2.md")
        && readFileSync(matched.path, "utf8") === v2, JSON.stringify(matched));
    check("private pack (match): the rendered lines carry path, id, version, verdict and the Anmerkung door for v2",
      matchBlock.includes(`  ${join(dir, "v2.md")} | ${K} v2 `) && matchBlock.includes("hash match")
        && matchBlock.includes(`POST /api/self/konzepte/${K}/anmerkungen {"version":2,`), matchBlock);
    check("private pack: the content is never copied — no fixture byte of any fassung reaches the rendered lines",
      !matchBlock.includes(MARKER), matchBlock);

    // MUTATION 1 — the file is edited after it was published: drift, and back to match on undo
    appendFileSync(join(dir, "v2.md"), "nachtraeglich\n");
    const edited = resolve();
    writeFileSync(join(dir, "v2.md"), v2);
    const editedUndone = resolve();
    check("private pack (drift, mutation 'v2.md edited after publication'): drift naming the versionen.jsonl row, match after undo",
      edited.verdict === "drift" && edited.version === 2 && edited.path === join(dir, "v2.md")
        && (edited.why ?? "").includes("versionen.jsonl") && block(edited).includes("hash drift")
        && editedUndone.verdict === "match", JSON.stringify({ edited, editedUndone }));

    // MUTATION 2 — a newer fassung v3 is published: the path follows the CURRENT version, the verdict
    // says the pack pins another one; removing v3 restores the match
    const v3 = `# v3\n${MARKER} drei\n`;
    writeFileSync(join(dir, "v3.md"), v3);
    appendFileSync(join(dir, "versionen.jsonl"), row(3, v3));
    const newer = resolve();
    unlinkSync(join(dir, "v3.md"));
    writeFileSync(join(dir, "versionen.jsonl"), row(1, v1) + row(2, v2));
    const newerUndone = resolve();
    check("private pack (drift, mutation 'v3 published, pack still pins v2'): path to v3, drift, Anmerkung door on v3, match after undo",
      newer.verdict === "drift" && newer.version === 3 && newer.path === join(dir, "v3.md")
        && (newer.why ?? "").includes("declares") && block(newer).includes(`{"version":3,`)
        && newerUndone.verdict === "match" && newerUndone.version === 2, JSON.stringify({ newer, newerUndone }));

    // MUTATION 3 — the root is not set on the server: missing, by name, the id still delivered
    const unset = resolve(null);
    check("private pack (missing, mutation 'FLEET_KONZEPT_ROOT unset'): missing naming the env, no path, the id still in the lines",
      unset.verdict === "missing" && unset.path === null && (unset.why ?? "").includes("FLEET_KONZEPT_ROOT")
        && block(unset).includes(K) && block(unset).includes("hash missing") && !block(unset).includes("Anmerkung"),
      JSON.stringify(unset));

    // MUTATION 4 — the current file is gone: missing, the version still named so an Anmerkung can hang on it
    unlinkSync(join(dir, "v2.md"));
    const noFile = resolve();
    writeFileSync(join(dir, "v2.md"), v2);
    check("private pack (missing, mutation 'v2.md removed'): missing with version 2 and no path; match after restore",
      noFile.verdict === "missing" && noFile.version === 2 && noFile.path === null && (noFile.why ?? "").includes("v2.md")
        && resolve().verdict === "match", JSON.stringify(noFile));

    // MUTATION 5 — no ledger line at all, and an opaque id: both missing, neither silently dropped
    writeFileSync(join(dir, "versionen.jsonl"), "");
    const unpublished = resolve();
    writeFileSync(join(dir, "versionen.jsonl"), row(1, v1) + row(2, v2));
    const opaque = resolvePrivatePack(root, "opaque-3f4c19d8a6e2b701", declared);
    check("private pack (missing): an empty versionen.jsonl and an opaque id each render missing with their own reason",
      unpublished.verdict === "missing" && (unpublished.why ?? "").includes("no published version")
        && opaque.verdict === "missing" && (opaque.why ?? "").includes("opaque")
        && block(opaque).includes("opaque-3f4c19d8a6e2b701") && resolve().verdict === "match",
      JSON.stringify({ unpublished, opaque }));

    // THE RECEIVER'S HALF: a selected id, a receipt row or a `match` verdict says nothing about whether
    // anything can be READ. readDelivered is a mechanical receiver over the delivered lines alone — it
    // finds the pack's line, takes the path the line names, trusts it only under `hash match`, and reads
    // the file. The server-backed twin (e2e/konzepte.ts#privatePackHandover) runs the same rule inside
    // the pane the harness spawned. The claim checked is the BYTES, never a status.
    const readClaim = (lines: string[]): boolean => readDelivered(lines, K)?.bytes === v2;
    const delivered = readDelivered(renderPrivatePackLines(resolve()), K);
    check("private pack (receiver): the delivered lines alone lead a mechanical reader to the fixture's v2 bytes, outside this checkout",
      delivered !== null && delivered.verdict === "match" && delivered.bytes === v2 && delivered.bytes.includes(MARKER)
        && delivered.path === join(dir, "v2.md") && !delivered.path.startsWith(`${join(import.meta.dir, "..")}/`),
      JSON.stringify(delivered));
    // the same claim under each named mutation must turn RED — and each mutation is observed (the
    // reader saw the pack's line), so a reader that saw nothing can never pass as a refusal
    const fremdDir = join(root, "k-fremd-projekt");
    mkdirSync(fremdDir);
    const fremdText = "# fremd\nFREMD-FIXTURE-CONTENT-91c2\n";
    writeFileSync(join(fremdDir, "v1.md"), fremdText);
    writeFileSync(join(fremdDir, "versionen.jsonl"),
      `${JSON.stringify({ konzept: "k-fremd-projekt", version: 1, vorgaenger: null, sha256: sha(fremdText), at: 1 })}\n`);
    const foreign = resolvePrivatePack(root, "k-fremd-projekt", sha(fremdText));
    const foreignRead = readDelivered(renderPrivatePackLines(foreign), "k-fremd-projekt");
    check("private pack (missing, foreign source): a konzept under the same root that no Fleet seed declares is never read, by name",
      foreign.verdict === "missing" && foreign.path === null && (foreign.why ?? "").includes("no Fleet seed declares")
        && foreignRead !== null && foreignRead.path === null && foreignRead.bytes === null
        && !renderPrivatePackLines(foreign).join("\n").includes("FREMD-FIXTURE"),
      JSON.stringify({ foreign, foreignRead }));
    const mutations: Record<string, string[]> = {
      "root not passed (FLEET_KONZEPT_ROOT unset)": renderPrivatePackLines(resolve(null)),
      "privateSource only as an opaque id": renderPrivatePackLines(resolvePrivatePack(root, "opaque-3f4c19d8a6e2b701", declared))
        .map((line) => line.replace("opaque-3f4c19d8a6e2b701", K)),
      "pack pins another hash": renderPrivatePackLines(resolvePrivatePack(root, K, sha("eine andere Fassung"))),
    };
    unlinkSync(join(dir, "v2.md"));
    mutations["v2.md removed"] = renderPrivatePackLines(resolve());
    writeFileSync(join(dir, "v2.md"), v2);
    const mutationRows = Object.entries(mutations).map(([name, lines]) =>
      ({ name, observed: readDelivered(lines, K) !== null, claim: readClaim(lines) }));
    check("private pack (receiver, mutations): root not passed, an opaque id, a pinned other hash and a removed file each turn the read claim red",
      readClaim(renderPrivatePackLines(resolve())) && mutationRows.every((row) => row.observed && !row.claim),
      JSON.stringify(mutationRows));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// --- THE ORCHESTRATION TRIGGER (owner decision 2026-10-02 after MAIN clarification). A new trigger
// name exists so the Fleet manifest's orchestrator-eigenarten reaches founding sessions through
// server.ts#BOOTSTRAP_CONTEXT_TRIGGERS without putting the hard seed pack task-queue on the same
// brief (since 636c3e01 that seed pack and its trigger are removed outright; the probe below now
// demands their absence instead of a dormant omission). These probes plan the REAL tracked manifest, not a synthetic pack: a synthetic one would
// stay green while the manifest regressed to a dormant trigger, and the DORMANT pin would not
// notice (a pack whose triggers are all dormant is never stranded). Facts mirror server.ts
// (#BOOTSTRAP_CONTEXT_TRIGGERS + FLEET_CONTROL_CONTEXT_CAPABILITIES vs #DISPATCH_CONTEXT_*).
//
// WHERE THE REAL MANIFEST IS. A staged instance (e2e-stage.sh) carries no `.fleet/context-packs.json`
// and none of the documents it points at — and must not: the staged server reads that manifest at its
// own HEAD for the fleet-control frame, so staging it would change every founding brief in the suite.
// So both trees are tried, the run's own and the node_modules pointer home (the tree e2e-stage.sh
// staged FROM: a worktree, the helper's clone, or the post-land audit's git archive extract), and the first that yields the manifest AND every
// source it references wins. Neither does → one SETUP row fails under its own name; the probes below
// it are then unmeasured, never silently green, and the module no longer throws ENOENT out of its shard.
function realManifestTree(): { root: string; manifest: ReturnType<typeof readContextManifest>;
  sourceBytes: Map<string, string> } | { error: string } {
  const here = resolve(import.meta.dir, "..");
  const candidates = [here];
  // ONE hop, not realpath: in the post-land audit the extract's own node_modules links on to the main
  // checkout's, and a full realpath would read THAT tree's manifest instead of the landed one.
  try { candidates.push(dirname(resolve(here, readlinkSync(join(here, "node_modules"))))); } catch { /* no pointer home */ }
  const why: string[] = [];
  for (const root of new Set(candidates)) {
    let manifest: ReturnType<typeof readContextManifest>;
    try { manifest = readContextManifest(readFileSync(join(root, CONTEXT_MANIFEST_PATH), "utf8")); }
    catch { why.push(`${root}: no ${CONTEXT_MANIFEST_PATH}`); continue; }
    if (manifest.kind !== "packs") { why.push(`${root}: ${CONTEXT_MANIFEST_PATH} is ${manifest.kind}`); continue; }
    const sourceBytes = new Map<string, string>();
    const unread = [...manifest.referencedPaths].filter((path) => {
      try { sourceBytes.set(path, readFileSync(join(root, path), "utf8")); return false; } catch { return true; }
    });
    if (unread.length) { why.push(`${root}: unreadable source(s) ${unread.join(",")}`); continue; }
    return { root, manifest, sourceBytes };
  }
  return { error: why.join("; ") };
}

function orchestrationTriggerChecks(check: ContextPlanCheck): void {
  const tree = realManifestTree();
  check("orchestration trigger SETUP: the real tracked manifest and every source it references are read",
    !("error" in tree),
    "error" in tree ? tree.error
      : `${tree.root} · ${[...tree.sourceBytes.keys()].join(",")}`);
  if ("error" in tree) return;
  const { manifest } = tree;
  const repo = { trackedPaths: new Set(tree.sourceBytes.keys()), sourceBytes: tree.sourceBytes };
  const bootstrapFacts = {
    harness: "claude", mode: "mutating" as const,
    triggers: ["always", "verification", "orchestration"] as const,
    capabilities: ["tracked-source-read", "pure-validator-run", "e2e-run", "git-inspect", "task-queue-read",
      "harness-adapter-read", "private-overlay-read", "deploy-observe"] as ContextPackCapability[],
  };
  const laneFacts = { ...bootstrapFacts,
    triggers: ["always", "verification", "jev-use"] as const,
    capabilities: ["tracked-source-read", "pure-validator-run", "e2e-run", "git-inspect",
      "harness-adapter-read", "private-overlay-read"] as ContextPackCapability[] };
  const lanePlan = planRepoContext({ manifest, repo, facts: laneFacts });
  const orchestrationPackIds = ["orchestrator-eigenarten", "haltung-auftraggeber"];
  check("orchestration trigger: the lane/dispatch plan does NOT carry orchestrator-eigenarten or haltung-auftraggeber",
    orchestrationPackIds.every((id) => !lanePlan.selected.some((pack) => pack.id === id)
      && lanePlan.omitted.some((pack) => pack.id === id && pack.why === "trigger-not-matched")),
    JSON.stringify({ selected: lanePlan.selected.map((pack) => pack.id),
      why: orchestrationPackIds.map((id) => lanePlan.omitted.find((pack) => pack.id === id)) }));
  const mainPlan = planRepoContext({ manifest, repo, facts: bootstrapFacts });
  check("orchestration trigger: the bootstrap plan of a MAIN or Orchestratorin founding carries orchestrator-eigenarten and haltung-auftraggeber",
    orchestrationPackIds.every((id) => mainPlan.selected.some((pack) => pack.id === id)),
    `${manifest.kind} ${JSON.stringify(mainPlan.selected.map((pack) => pack.id))}`);
  // THE WORKER HALTUNG (owner decision 2026-10-06): the repo pack with trigger `always` rides every
  // start — a lane's dispatch facts and a MAIN's bootstrap facts alike select it from the REAL
  // manifest, and the pointer is exact so a moved heading turns red here, not in a delivered brief.
  check("haltung-worker: a lane dispatch plan and a MAIN founding plan both carry the always repo pack",
    lanePlan.selected.some((pack) => pack.id === "haltung-worker")
      && mainPlan.selected.some((pack) => pack.id === "haltung-worker"),
    JSON.stringify({ lane: lanePlan.selected.map((pack) => pack.id), main: mainPlan.selected.map((pack) => pack.id) }));
  const workerPack = mainPlan.selected.find((pack) => pack.id === "haltung-worker");
  check("haltung-worker: the pointer is exactly docs/haltung-worker.md, ## Was wir bevorzugen, und warum",
    !!workerPack && JSON.stringify(workerPack.sources)
      === JSON.stringify([{ path: "docs/haltung-worker.md", anchor: "## Was wir bevorzugen, und warum" }]),
    JSON.stringify(workerPack ?? null));
  check("haltung-worker: every harness of the closed vocabulary selects the pack on the lane dispatch facts",
    CONTEXT_PACK_HARNESSES.every((harness) =>
      planRepoContext({ manifest, repo, facts: { ...laneFacts, harness } }).selected.some((pack) => pack.id === "haltung-worker")),
    JSON.stringify(CONTEXT_PACK_HARNESSES));
  // THE CODEX PACK IS SUPERSEDED, NOT DELETED (L16, MAIN answer 96d8a3f0, 2026-10-08): its one anchor
  // lies inside AGENTS.md ## Portable operating contract, which session-agents.ts#renderSessionAgents
  // boxes whole for every codex session, so the pointer told no session anything new. Omission: every
  // harness, lane and founding alike, omits it as status-not-active — and the same manifest with only
  // the status flipped back selects it for codex, so the reason is the status and nothing else.
  // Delivery: the section it pointed at still reaches a codex lane, boxed in portable-core.
  const CODEX_PACK = "codex-native-context-v1";
  const codexOmissions = CONTEXT_PACK_HARNESSES.flatMap((harness) => [laneFacts, bootstrapFacts].map((facts) =>
    ({ harness, why: planRepoContext({ manifest, repo, facts: { ...facts, harness } }).omitted.find((pack) => pack.id === CODEX_PACK)?.why ?? null })));
  check("codex-native-context-v1: every harness omits the superseded pack as status-not-active, on lane and founding facts",
    codexOmissions.every((row) => row.why === "status-not-active"), JSON.stringify(codexOmissions));
  const isRecord = (pack: unknown): pack is Record<string, unknown> => !!pack && typeof pack === "object";
  const activeAgain = manifest.kind === "packs" ? { ...manifest, packs: manifest.packs.map((pack) =>
    isRecord(pack) && pack.id === CODEX_PACK ? { ...pack, status: "active" } : pack) } : manifest;
  check("codex-native-context-v1: flipping only its status back to active selects it for codex — the omission is the status alone",
    planRepoContext({ manifest: activeAgain, repo, facts: { ...laneFacts, harness: "codex" } }).selected.some((pack) => pack.id === CODEX_PACK));
  const codexAgents = renderSessionAgents({ role: { text: "role", path: "server.ts", anchor: "LANE_ROLE_CARD" }, position: "lane",
    harness: "codex", plan: planContext({ sourceTree: "fleet", ...laneFacts, harness: "codex" }),
    sourceBytes: tree.sourceBytes, footer: "" });
  const codexSection = sourceSection(tree.sourceBytes.get("AGENTS.md") ?? "", "AGENTS.md", "### Context self-management (§6, §8)");
  const coreBox = codexAgents.parts.find((part) => part.id === "portable-core.contract");
  check("codex-native-context-v1: its section still reaches a codex lane, boxed inside portable-core, with no pointer to the pack",
    !!codexSection && coreBox?.ort === "box" && !!coreBox.content?.includes(codexSection.content)
      && codexAgents.text.includes(codexSection.content) && !codexAgents.text.includes(CODEX_PACK),
    JSON.stringify({ section: codexSection?.bytes ?? null, core: coreBox ? { ort: coreBox.ort, bytes: coreBox.bytes } : null }));
  const seedPlan = planContext({ sourceTree: "fleet", harness: "claude", mode: "mutating",
    triggers: [...bootstrapFacts.triggers], capabilities: bootstrapFacts.capabilities });
  const laneSeeds = planContext({ sourceTree: "fleet", ...laneFacts });
  const deliveryPlan = { selected: [...laneSeeds.selected, ...lanePlan.selected],
    omitted: [...laneSeeds.omitted, ...lanePlan.omitted] };
  const seam = contextDeliverySeam(null);
  const delivered = seam.availableContextPlan(deliveryPlan);
  const block = seam.renderContextAnchorBlock(delivered);
  const receipt = seam.contextReceiptSelections(delivered.selected);
  const binding = block.split("Bindend (hard):\n")[1]?.split("Hinweise (guidance):\n")[0] ?? "";
  const guidance = block.split("Hinweise (guidance):\n")[1] ?? "";
  check("context hardness: real manifest and seeds retain portable-core hard and haltung-worker guidance",
    laneSeeds.selected.find((pack) => pack.id === "portable-core")?.hardness === "hard"
      && lanePlan.selected.find((pack) => pack.id === "haltung-worker")?.hardness === "guidance",
    summary(deliveryPlan));
  check("context hardness: the real brief binds portable-core and presents haltung-worker as a hint",
    binding.includes("- portable-core [hard] — ") && guidance.includes("- haltung-worker [guidance] — ")
      && !binding.includes("haltung-worker") && !guidance.includes("portable-core") && !block.includes("advisory"), block);
  check("context hardness: every delivered pack shows its degree and receipt records that same degree",
    delivered.selected.length > 0 && delivered.selected.every((pack) =>
      block.includes(`- ${pack.id} [${pack.hardness}]`)
        && receipt.find((row) => row.id === pack.id)?.hardness === pack.hardness), JSON.stringify(receipt));
  check("context hardness: an empty plan emits no block or group heading",
    seam.renderContextAnchorBlock({ selected: [], omitted: [] }) === "");
  for (const hardness of ["hard", "guidance"] as const) {
    const selected = delivered.selected.filter((pack) => pack.hardness === hardness);
    const only = seam.renderContextAnchorBlock({ selected, omitted: [] });
    check(`context hardness: a ${hardness}-only plan omits the other group's heading`,
      selected.length > 0 && only.includes(hardness === "hard" ? "Bindend (hard):" : "Hinweise (guidance):")
        && !only.includes(hardness === "hard" ? "Hinweise (guidance):" : "Bindend (hard):"), only);
  }
  check("orchestration trigger: the bootstrap plan does NOT select the seed pack task-queue — the pack is absent",
    !seedPlan.selected.some((pack) => pack.id === "task-queue")
      && !(CONTEXT_PACKS as readonly { id: string }[]).some((pack) => pack.id === "task-queue"),
    JSON.stringify({ selected: seedPlan.selected.map((pack) => pack.id),
      taskQueue: seedPlan.omitted.find((pack) => pack.id === "task-queue") }));
}



// --- THE FOUNDING WINDOW'S PREVIEW AGAINST THE RECEIPT (card 91b52b3a). src/protocol.ts#standSincePreview
// is the one rule the window applies after a start; each fixture is one receipt shape the ledger can
// hold, and every row a missing fact touches must come out `unknown` — never `same`. The server-backed
// half (e2e/context-packs.ts) feeds it a real preview and a real receipt; this half pins the rule.
function foundingStandChecks(check: ContextPlanCheck): void {
  const H1 = "a".repeat(64), H2 = "b".repeat(64), HEAD1 = "1".repeat(40), HEAD2 = "2".repeat(40);
  const anchors = [{ path: "AGENTS.md", anchor: "## Repo contract" }];
  const preview: PackStandPreview = { head: HEAD1, packs: [
    { id: "promise-anchor", anchors, sourceHash: H1 },
    { id: "konzept-claude-fleet", anchors: { privateSourceId: "k-claude-fleet" }, sourceHash: H2 },
  ] };
  const receipt = (over: Partial<PackStandReceipt> = {}): PackStandReceipt => ({
    head: HEAD1, selected: [{ id: "promise-anchor", anchors, sourceHash: H1 }], omitted: [], ...over });
  const row = (r: ReturnType<typeof standSincePreview>, id: string) => r.packs.find((p) => p.id === id);

  const same = standSincePreview(preview, receipt(), ["promise-anchor"]);
  check("founding stand: an unchanged source is `same`, and so is the HEAD",
    same.head === "same" && row(same, "promise-anchor")?.stand === "same" && same.packs.length === 1, JSON.stringify(same));

  const moved = standSincePreview(preview, receipt({ head: HEAD2, selected: [{ id: "promise-anchor", anchors, sourceHash: H2 }] }), ["promise-anchor"]);
  check("founding stand: a source changed between preview and start is `changed`, the receipt's hash is the delivered one",
    moved.head === "changed" && row(moved, "promise-anchor")?.stand === "changed"
      && row(moved, "promise-anchor")?.preview === H1 && row(moved, "promise-anchor")?.delivered === H2, JSON.stringify(moved));

  const headOnly = standSincePreview(preview, receipt({ head: HEAD2 }), ["promise-anchor"]);
  check("founding stand: a HEAD that moved without touching the pack's source keeps the pack `same` and the HEAD `changed`",
    headOnly.head === "changed" && row(headOnly, "promise-anchor")?.stand === "same", JSON.stringify(headOnly));

  const reanchored = standSincePreview(preview, receipt({ selected: [{ id: "promise-anchor",
    anchors: [{ path: "AGENTS.md", anchor: "## Other" }], sourceHash: H1 }] }), ["promise-anchor"]);
  check("founding stand: a moved anchor with the same blob is `changed`, named as anchors",
    row(reanchored, "promise-anchor")?.stand === "changed" && row(reanchored, "promise-anchor")?.why === "anchors", JSON.stringify(reanchored));

  // AN OLD RECEIPT without head and sourceHash, and an old server's preview without them: unknown on
  // every row they touch. Mutation: let a missing hash fall through to the comparison → `same` here.
  const old = standSincePreview(preview, { selected: [{ id: "promise-anchor", anchors }] }, ["promise-anchor"]);
  const oldPreview = standSincePreview({ head: null, packs: [{ id: "promise-anchor" }] }, receipt(), ["promise-anchor"]);
  const noPreview = standSincePreview(null, receipt(), ["promise-anchor"]);
  check("founding stand: an old receipt, an old preview and no preview at all are `unknown` — never `same`",
    old.head === "unknown" && row(old, "promise-anchor")?.stand === "unknown"
      && oldPreview.head === "unknown" && row(oldPreview, "promise-anchor")?.stand === "unknown"
      && noPreview.head === "unknown" && row(noPreview, "promise-anchor")?.stand === "unknown",
    JSON.stringify({ old, oldPreview, noPreview }));

  const privateRow = (verdict: unknown) => row(standSincePreview(preview, receipt({ selected: [{ id: "konzept-claude-fleet",
    anchors: { privateSourceId: "k-claude-fleet" }, sourceHash: H2, private: { verdict, version: 1 } }] }), ["konzept-claude-fleet"]),
    "konzept-claude-fleet")?.stand;
  check("founding stand: a private pack follows its delivery verdict — match same, drift drift, an unreadable verdict unknown",
    privateRow("match") === "same" && privateRow("drift") === "drift" && privateRow(undefined) === "unknown",
    `${privateRow("match")} ${privateRow("drift")} ${privateRow(undefined)}`);

  const missing = standSincePreview(preview, receipt({ selected: [], omitted: [{ id: "konzept-claude-fleet",
    why: "source-unavailable", reason: "FLEET_KONZEPT_ROOT is not set on this server" }] }), ["konzept-claude-fleet"]);
  const silent = standSincePreview(preview, receipt({ selected: [], omitted: [] }), ["promise-anchor"]);
  check("founding stand: a requested pack the delivery omitted is `not-delivered` with the receipt's own reason, or with none",
    row(missing, "konzept-claude-fleet")?.stand === "not-delivered"
      && row(missing, "konzept-claude-fleet")?.why === "source-unavailable: FLEET_KONZEPT_ROOT is not set on this server"
      && row(silent, "promise-anchor")?.stand === "not-delivered" && row(silent, "promise-anchor")?.why === null,
    JSON.stringify({ missing, silent }));

  const extra = standSincePreview(preview, receipt({ selected: [{ id: "promise-anchor", anchors, sourceHash: H1 },
    { id: "uninvited", anchors, sourceHash: H1 }] }), ["promise-anchor"]);
  check("founding stand: a receipt pack nobody requested is `extra`",
    row(extra, "uninvited")?.stand === "extra" && row(extra, "promise-anchor")?.stand === "same", JSON.stringify(extra));

  // A FASSUNG IS DECLARED BY THE ID, or there is none — never read off a hash, a harness or a ledger.
  const fassungen = ["codex-native-context-v1", "x-v12", "portable-core", "konzept-claude-fleet", "x-v0", "x-v1x", "v1"]
    .map((id) => packIdFassung(id));
  check("founding stand: the fassung comes from an explicit -v<N> id suffix only",
    JSON.stringify(fassungen) === JSON.stringify([1, 12, null, null, null, null, null]), JSON.stringify(fassungen));
}

if (import.meta.main) await run();

function sessionAgentsChecks(check: ContextPlanCheck): void {
  const tree = realManifestTree();
  if ("error" in tree) { check("session agents: source tree is readable", false, tree.error); return; }
  const server = readFileSync(join(tree.root, "server.ts"), "utf8");
  const constant = (name: string): string => {
    const match = new RegExp("const " + name + " = (`(?:\\\\.|[^`])*`);", "s").exec(server);
    if (!match) throw new Error(`session agents probe: missing ${name}`);
    return match[0];
  };
  const fn = (name: string): string => {
    const start = server.indexOf(`function ${name}(`);
    const end = server.indexOf("\n}", start);
    if (start < 0 || end < 0) throw new Error(`session agents probe: missing ${name}`);
    return server.slice(start, end + 2);
  };
  const compiled = new Bun.Transpiler({ loader: "ts" }).transformSync([
    ...["LANE_ROLE_CARD", "MAIN_ROLE_CARD", "ORCHESTRATOR_ROLE_CARD", "LANE_EXIT_HANDOFF", "LANE_EXIT_HANDOFF_CODEX", "RAIL_HEAD", "RAIL_TAIL", "ORCHESTRATOR_CONTEXT_LINE_CODEX"].map(constant),
    fn("memoryPointer"), fn("laneExitFooter"),
    'return { roles: [LANE_ROLE_CARD, MAIN_ROLE_CARD, ORCHESTRATOR_ROLE_CARD + "\\n" + ORCHESTRATOR_CONTEXT_LINE_CODEX], laneExitFooter, mainFooter: RAIL_HEAD + RAIL_TAIL };',
  ].join("\n"));
  const deps = { HOST: "127.0.0.1", PORT: 8790, MAX_FLEET_REPORT_TEXT: 4000,
    FLEET_REPORT_STATUSES: ["complete", "needs-main", "failed", "handoff"], nativeCompaction: (h: string) => h === "codex", laneExitLiveBauAct };
  const templates = new Function(...Object.keys(deps), compiled)(...Object.values(deps)) as {
    roles: string[]; laneExitFooter: (harness: string, receiver: { role: string; slot: number } | null) => string; mainFooter: string;
  };
  const sourceBytes = new Map(tree.sourceBytes);
  for (const pack of CONTEXT_PACKS) if ("sources" in pack) for (const source of pack.sources)
    sourceBytes.set(source.path, readFileSync(join(tree.root, source.path), "utf8"));
  const plan = planContext({ sourceTree: "fleet", harness: "codex", mode: "mutating", triggers: ["always", "verification"], capabilities: fullCapabilities() });
  const verify = plan.selected.find((pack) => pack.id === "verify-e2e")!;
  const expected = [808, 4029, 403, 321, 3959, 11403];
  const expectedHashes = [
    "57ed82f7c9fe990c4f58245f148357423d5847d0ae6cf33c0b069401c93bac46",
    "d29f493a7a8a1c82151af873fb03b546b11260b87e22c2769bbf907df773fd15",
    "21c8f4b8b45f9d496f81d6ca46a362e79740463801af03a425e3dd8ba04fa5a0",
    "7c2fa80e6536a552cb555ae86fd38c8bcecd92b576d7384b8a0814ca01cab3e1",
    "704a7016daf73017b58e8d7450976c82f32af229a53982cd92bac154f9801fc0",
    "40208c1b60f15310a71d061797dd67eab1d4a457e50f2446b8d11f8638bd9303",
  ];
  const measured = "privateSourceId" in verify.sources ? [] : verify.sources.map((source) => sourceSection(sourceBytes.get(source.path)!, source.path, source.anchor)?.bytes);
  check("session agents: six verify parts carry the approved tree bytes (fixture 808/4029/403/321/3959/11403)",
    JSON.stringify(measured) === JSON.stringify(expected), JSON.stringify(measured));
  const hashes = "privateSourceId" in verify.sources ? [] : verify.sources.map((source) => sourceSection(sourceBytes.get(source.path)!, source.path, source.anchor)?.sha256);
  check("session agents: six verify parts carry the exact approved source hashes",
    JSON.stringify(hashes) === JSON.stringify(expectedHashes), JSON.stringify(hashes));
  const sums: string[] = [];
  for (const [index, position] of (["lane", "main", "orchestratorin"] as const).entries()) {
    const footer = position === "lane" ? templates.laneExitFooter("codex", { role: "program-main", slot: 10 }) : position === "main" ? templates.mainFooter : "";
    const input = { role: { text: templates.roles[index]!, path: "server.ts", anchor: `${position}-role` }, position, harness: "codex", plan, sourceBytes, footer };
    const rendered = renderSessionAgents(input);
    const carried = rendered.parts.filter((part) => part.ort === "box");
    check(`session agents: ${position} is deterministic, measures the exact file and stays below 32 KiB`,
      JSON.stringify(renderSessionAgents(input)) === JSON.stringify(rendered) && rendered.bytes === Buffer.byteLength(rendered.text)
        && rendered.bytes < SESSION_AGENTS_LIMIT && rendered.projectDocMaxBytes === undefined,
      `${rendered.bytes} bytes; box=${carried.map((part) => `${part.id}:${part.bytes}`).join(",")}`);
    sums.push(`${position}=${rendered.bytes}`);
    check(`session agents: ${position} box receipts hash the delivered source bytes`, carried.every((part) =>
      part.content !== null && part.bytes === Buffer.byteLength(part.content)
      && part.sha256 === createHash("sha256").update(part.content).digest("hex")));
    const deliveredFooter = rendered.parts.find((part) => part.id === "footer")?.content;
    if (deliveredFooter) check(`session agents: ${position} footer retains no sentence-equal carried instruction`,
      sessionExitFooter(deliveredFooter, rendered.text.slice(0, rendered.text.indexOf(position === "lane" ? "## Lane-Ende" : "## Program-Schiene"))) === deliveredFooter);
    const headings = ["## Rolle", "## Anleitung", "## Wissen", "## Packs auf Abruf"];
    check(`session agents: ${position} keeps role, instruction, knowledge, pointers and footer in order`,
      headings.every((heading, i) => rendered.text.indexOf(heading) >= 0 && (i === 0 || rendered.text.indexOf(heading) > rendered.text.indexOf(headings[i - 1]!)))
      && (!footer || rendered.text.indexOf(position === "lane" ? "## Lane-Ende" : "## Program-Schiene") > rendered.text.indexOf("## Packs auf Abruf")));
    const gate = rendered.parts.find((part) => part.id === "verify-e2e.gate-vs-audit");
    check(`session agents: ${position} carries the portable contract once and gate knowledge only for MAIN`,
      rendered.text.split("## Portable operating contract").length === 2
      && gate?.ort === (position === "main" ? "box" : "ausleihe") && (gate?.content !== null) === (position === "main"));
  }
  check("session agents: position sums are observed", sums.length === 3, sums.join("; "));
  const base = { role: { text: templates.roles[0]!, path: "server.ts", anchor: "LANE_ROLE_CARD" }, position: "lane" as const, harness: "codex", plan, sourceBytes, footer: "" };
  for (const harness of ["claude", "codex", "pi", "pi-zai"]) {
    const footer = templates.laneExitFooter(harness, { role: "program-main", slot: 10 });
    const rendered = renderSessionAgents({ role: { text: templates.roles[0]!, path: "server.ts", anchor: "LANE_ROLE_CARD" },
      position: "lane", harness, plan, sourceBytes, footer });
    check(`native lane render: ${harness} carries one role and measured source parts`,
      rendered.text.split(templates.roles[0]!).length === 2 && rendered.parts[0]?.anchor === "LANE_ROLE_CARD"
        && rendered.parts[0].bytes === Buffer.byteLength(templates.roles[0]!)
        && rendered.parts.filter((part) => part.content !== null).every((part) => part.sha256 === createHash("sha256").update(part.content!).digest("hex")),
      `${rendered.bytes} bytes`);
    const lanePart = rendered.parts.find((part) => part.id === "verify-e2e.lane");
    check(`native lane render: ${harness} carries the restored jobs and local-withdraw contract in the exact Lane part`,
      lanePart?.ort === "box" && lanePart.bytes === expected[1] && lanePart.sha256 === expectedHashes[1]
        && lanePart.content !== null && lanePart.content.includes("**Gate suites, and a MAIN's preview, go through the jobs door.**")
        && lanePart.content.includes("only the 200 with `mayRunLocally: true` permits the local run."),
      JSON.stringify({ ort: lanePart?.ort, bytes: lanePart?.bytes, sha256: lanePart?.sha256 }));
  }
  const missingBytes = new Map(sourceBytes);
  missingBytes.set("docs/verify-tiering.md", "# Missing anchors\n");
  const missing = renderSessionAgents({ ...base, sourceBytes: missingBytes, selection: { "verify-e2e.gate-vs-audit": "box" } });
  check("session agents: a missing anchor falls back only its own part, leaving instructions in the box",
    missing.parts.find((part) => part.id === "verify-e2e.gate-vs-audit")?.refusal === "source-anchor-missing"
    && missing.parts.find((part) => part.id === "verify-e2e.kern")?.ort === "box"
    && missing.text.includes("source-anchor-missing"));
  const chosen = renderSessionAgents({ ...base, selection: { "verify-e2e.more": "box", "verify-e2e.lane": "ausleihe" } });
  check("session agents: choices operate on parts without switching the rest of their pack",
    chosen.parts.find((part) => part.id === "verify-e2e.more")?.ort === "box"
    && chosen.parts.find((part) => part.id === "verify-e2e.lane")?.ort === "ausleihe"
    && chosen.parts.find((part) => part.id === "verify-e2e.kern")?.ort === "box");
  for (const harness of ["codex", "pi", "pi-zai", "pi-ox", "pi-unfenced"]) {
    const empty = renderSessionAgents({ ...base, harness, plan: { selected: [], omitted: [] } });
    check(`session agents: ${harness} keeps its mandatory portable contract even with optional packs off`,
      empty.parts.find((part) => part.id === "portable-core.contract")?.bytes === 10335
      && empty.text.split("## Portable operating contract").length === 2 && empty.bytes < SESSION_AGENTS_LIMIT);
  }
  const privateBytes = "Private knowledge supplied at the boundary.\n";
  const privateBox = renderSessionAgents({ ...base, selection: { "konzept-claude-fleet.private": "box" },
    privateSources: new Map([["k-claude-fleet", { path: "/fixture/k-claude-fleet/v1.md", content: privateBytes }]]) });
  const privatePart = privateBox.parts.find((part) => part.id === "konzept-claude-fleet.private");
  check("session agents: injected private knowledge measures exact bytes; missing private bytes stay unknown",
    privatePart?.ort === "box" && privatePart.bytes === Buffer.byteLength(privateBytes)
    && privatePart.sha256 === createHash("sha256").update(privateBytes).digest("hex")
    && renderSessionAgents(base).parts.find((part) => part.id === "konzept-claude-fleet.private")?.bytes === null);
  const huge = renderSessionAgents({ ...base, role: { ...base.role, text: "x".repeat(SESSION_AGENTS_LIMIT) } });
  check("session agents: exceeding 32 KiB exposes the precise project document switch",
    huge.bytes > SESSION_AGENTS_LIMIT && huge.projectDocMaxBytes === huge.bytes);
  const duplicate = "Read the exact output. Preserve this footer sentence.";
  check("session agents: sentence-equal instructions disappear from the footer only",
    sessionExitFooter(duplicate, "--- DER LOOP --- Read the exact output.") === "Preserve this footer sentence.");
  const legacy = { id: "legacy", hardness: "guidance" as const, useWhen: "Read on demand", estimatedBytes: 0, sources: [{ path: "old.md", anchor: "## Old" }] };
  const legacyRender = renderSessionAgents({ ...base, harness: "claude", plan: { selected: [legacy], omitted: [] }, sourceBytes: new Map([["old.md", "## Old\nold bytes\n"]]) });
  check("session agents: an unsplit pack retains its exact existing pointer bytes",
    legacyRender.text.includes("- legacy [guidance] — Read on demand\n  old.md | ## Old") && !legacyRender.text.includes("old bytes"));
  for (const hardness of ["hard", "guidance"] as const) for (const useWhen of [undefined, "Read on demand"]) {
    const pack = { ...legacy, hardness, useWhen };
    const rendered = renderSessionAgents({ ...base, harness: "claude", plan: { selected: [pack], omitted: [] },
      sourceBytes: new Map([["old.md", "## Old\nold bytes\n"]]) });
    const pointer = `- legacy [${hardness}]${useWhen ? ` — ${useWhen}` : ""}\n  old.md | ## Old`;
    const otherHardness = hardness === "hard" ? "guidance" : "hard";
    check(`session agents: ${hardness} pointer preserves its exact label ${useWhen ? "with" : "without"} purpose`,
      rendered.text.split("## Packs auf Abruf\n\n")[1] === `${pointer}\n`
        && !rendered.text.includes(`- legacy [${otherHardness}]`) && !rendered.text.includes("old bytes"),
      JSON.stringify({ expected: `${pointer}\n`, pointers: rendered.text.split("## Packs auf Abruf\n\n")[1] }));
  }
  const section = "### Part\nGrüße.\n```md\n### False sibling\n```\n";
  check("session agents: the shared cut preserves UTF-8 and fenced headings and refuses an absent anchor",
    sectionAt(`${section}### Next\nother\n`, "x.md", "### Part") === section
    && sectionAt(section, "x.md", "### Missing") === null);
  const codeSection = [
    "export const PACK = {",
    "  nested: (() => {",
    "const inner = 1;",
    "    return inner;",
    "  })(),",
    '  text: "Grüße }",',
    "  template: `",
    "export const fake = 2;",
    "  `,",
    "  pattern: /[{}]/,",
    "};",
    "/*",
    "export const commented = 3;",
    "*/",
    "",
  ].join("\n") + "\n";
  const codePrefix = "const before = 0;\n\n";
  const codeTail = "export function after() { return 4; }\n";
  const codeSource = codePrefix + codeSection + codeTail;
  check("source sections: a TS anchor stops at the next top-level declaration, ignoring nested code and literals",
    sectionAt(codeSource, "fixture.ts", "export const PACK =") === codeSection);
  const codeReceipt = sourceSection(codeSource, "fixture.ts", "export const PACK =");
  check("source sections: receipt offsets, UTF-8 bytes and hash describe exactly the bounded TS section",
    codeReceipt?.start === codePrefix.length && codeReceipt.end === codePrefix.length + codeSection.length
      && codeReceipt.bytes === Buffer.byteLength(codeSection)
      && codeReceipt.sha256 === createHash("sha256").update(codeSection).digest("hex"), JSON.stringify(codeReceipt));
  check("source sections: a final TS declaration and CRLF retain their exact source bytes",
    sectionAt(codePrefix + codeTail, "fixture.ts", "export function after") === codeTail
      && sectionAt(codeSource.replaceAll("\n", "\r\n"), "fixture.ts", "export const PACK =") === codeSection.replaceAll("\n", "\r\n"));
  const nestedTemplate = "const TARGET = `outer ${`inner\nexport const fake = 1;\n`}`;\n";
  check("source sections: nested template interpolation cannot manufacture a sibling declaration",
    sectionAt(nestedTemplate + codeTail, "fixture.ts", "const TARGET =") === nestedTemplate);
  const division = "const TARGET = (9 / 3 / 1);\n";
  check("source sections: division is code and leaves the next declaration at top level",
    sectionAt(division + codeTail, "fixture.ts", "const TARGET =") === division);
  check("source sections: an absent TS anchor returns null",
    sourceSection(codeSource, "fixture.ts", "const absent =") === null);
  let ambiguousCode = "";
  try { sectionAt(codeSource + codeSection, "fixture.ts", "export const PACK ="); }
  catch (error) { ambiguousCode = error instanceof Error ? error.name : "unknown"; }
  check("source sections: duplicate TS anchors are refused as ambiguous", ambiguousCode === "source-anchor-ambiguous", ambiguousCode);
  const harnessPack = CONTEXT_PACKS.find((pack) => pack.id === "harness-adapter")!;
  const harnessSections = "sources" in harnessPack ? harnessPack.sources.map((source) =>
    sourceSection(sourceBytes.get(source.path)!, source.path, source.anchor)) : [];
  const harnessBytes = harnessSections.reduce((sum, part) => sum + (part?.bytes ?? 0), 0);
  // An order-of-magnitude bound allows the unchanged Markdown part to exceed the estimate.
  check("source sections: the real harness-adapter pack stays within one order of magnitude of its estimate",
    harnessSections.length === 2 && harnessSections.every((part) => part !== null)
      && harnessBytes >= harnessPack.estimatedBytes / 10 && harnessBytes <= harnessPack.estimatedBytes * 10,
    JSON.stringify({ bytes: harnessBytes, estimatedBytes: harnessPack.estimatedBytes, parts: harnessSections.map((part) => part?.bytes) }));
  const harnessCode = harnessSections.find((part) => part?.path === "server.ts");
  check("source sections: the harness registry excludes the following harnessOf declaration",
    harnessCode?.content.includes("CODEX_HARNESS") === true && !harnessCode.content.includes("const harnessOf ="),
    JSON.stringify(harnessCode?.content));
  const harnessRender = renderSessionAgents({ ...base, harness: "claude",
    plan: { selected: [harnessPack], omitted: [] }, sourceBytes });
  const harnessParts = harnessRender.parts.filter((part) => part.packId === "harness-adapter");
  check("session agents: harness-adapter receipts carry the bounded source bytes and hashes",
    harnessParts.length === 2 && harnessParts.every((part, index) =>
      part.bytes === harnessSections[index]?.bytes && part.sha256 === harnessSections[index]?.sha256),
    JSON.stringify(harnessParts.map((part) => ({ path: part.path, bytes: part.bytes, refusal: part.refusal }))));
  liveBauChecks(check, { tree, server, fn, roles: templates.roles, laneExitFooter: templates.laneExitFooter, sourceBytes });
}

// THE LIVE-BAU VARIANT (card 1f9834a9, docs/design/live-bau-profil-2026-10.md §2). One card, read
// once without and once with the line `VARIANTE: live-bau`: the plan, the receipt's parts, the
// session file, its lane end, the baton and the rulebook cut each say the same thing — and without
// the line every one of them is the plain lane's, byte for byte.
function liveBauChecks(check: ContextPlanCheck, probe: {
  tree: { root: string; manifest: ReturnType<typeof readContextManifest>; sourceBytes: Map<string, string> };
  server: string; fn: (name: string) => string; roles: string[]; sourceBytes: Map<string, string>;
  laneExitFooter: (harness: string, receiver: { role: string; slot: number } | null, variante?: "live-bau" | null) => string;
}): void {
  const { tree, server, sourceBytes } = probe;
  // --- the card: an INTERIM line after the goal paragraph (Program-MAIN, clarification 17398332)
  const head = ["ROLLE: claude/claude-opus-5-5[1m]/high", "GROESSE: klein", "FLAECHE: docs/testinstanz.md",
    "VERIFY: install, pins, tsc, build laut GET /api/self/gate localProof.steps", "DONE: die Testinstanz zeigt den neuen Knopf"].join("\n");
  const goal = "Der Knopf wird live mit dem Owner gebaut.";
  const plainText = `${head}\n${goal}\n`;
  const liveText = `${head}\n${goal}\n\nVARIANTE: live-bau\n`;
  const ctx = (sourceText: string) => ({ sourceText, trackedPaths: new Set(["docs/testinstanz.md"]), symbolIndex: null,
    harnessKnown: (v: string) => v === "claude", modelKnown: () => true, effortKnown: () => true,
    declares: () => false, rowKnown: () => false });
  const plainRaw = parseFormattedCard(plainText);
  const liveRaw = parseFormattedCard(liveText);
  const plainCard = plainRaw && validateCard(plainRaw, ctx(plainText));
  const liveCard = liveRaw && validateCard(liveRaw, ctx(liveText));
  check("live-bau card: the VARIANTE line after the goal paragraph leaves the card valid, unchanged and without a stray header gap",
    !!plainCard && !!liveCard && liveCard.valid && plainCard.valid && JSON.stringify(liveRaw) === JSON.stringify(plainRaw)
      && JSON.stringify(liveCard) === JSON.stringify(plainCard) && !("strayHeaderLines" in (liveRaw ?? {})),
    JSON.stringify({ gaps: liveCard?.gaps, ziel: liveRaw?.ziel }));
  check("live-bau card: the one reader takes live-bau from the line, nothing from a card without it",
    cardVariante([liveText]) === "live-bau" && cardVariante([plainText]) === null
      && resolveVariante(cardVariante([liveText]), "lane").variante === "live-bau",
    JSON.stringify([cardVariante([liveText]), cardVariante([plainText])]));
  const refusals = [resolveVariante("live-bau-2", "lane"), resolveVariante("live-bau", "main"),
    resolveVariante(cardVariante([liveText, "VARIANTE: andere\n"]), "lane")];
  check("live-bau card: an unknown value, another position and two different lines are variant none WITH a reason",
    refusals.every((r) => r.variante === undefined && typeof r.verworfen === "string" && r.verworfen.endsWith("Variante keine")),
    JSON.stringify(refusals));

  // --- the plan: seeds and the real manifest, lane facts, once plain and once live-bau
  const facts = { sourceTree: "fleet" as const, harness: "claude", mode: "mutating" as const, triggers: ["always", "verification"] as ContextPackTrigger[],
    capabilities: fullCapabilities(), position: "lane" as const };
  const plain = planContext(facts);
  const live = planContext({ ...facts, variante: cardVariante([liveText]) });
  const unknown = planContext({ ...facts, variante: "live-bau-2" });
  check("live-bau plan: without the variant the plan is byte for byte the plain lane's — no variante, no anatomie on verify-e2e",
    JSON.stringify(plain) === JSON.stringify(planContext({ ...facts, variante: null }))
      && !("variante" in plain) && !("anatomie" in (plain.selected.find((p) => p.id === "verify-e2e") ?? {})),
    JSON.stringify(plain.selected.map((p) => p.id)));
  check("live-bau plan: an unknown variant plans the plain lane and names why",
    JSON.stringify(unknown.selected) === JSON.stringify(plain.selected) && JSON.stringify(unknown.omitted) === JSON.stringify(plain.omitted)
      && !("variante" in unknown) && /unbekannte Variante "live-bau-2"/.test(unknown.varianteVerworfen ?? ""),
    unknown.varianteVerworfen);
  const verify = live.selected.find((p) => p.id === "verify-e2e");
  const wantAnatomie = { kern: ["verify-e2e.main", "verify-e2e.more", "verify-e2e.gate-vs-audit", "verify-e2e.proportion"], variante: "live-bau",
    zusaetze: [{ id: "vor-dem-land", bedingung: { varianten: ["live-bau"], zeitpunkt: ["vor-dem-land"] }, an: true, ort: "ausleihe",
      teile: ["verify-e2e.kern", "verify-e2e.lane"] }] };
  const borrowed = verify && !("privateSourceId" in verify.sources) ? verify.sources.filter((source) => source.zeitpunkt) : [];
  check("live-bau plan: verify-e2e Kern and Lane are the Zusatz vor-dem-land — named, ausleihe, never boxed",
    live.variante === "live-bau" && JSON.stringify(verify?.anatomie) === JSON.stringify(wantAnatomie)
      && borrowed.map((source) => source.id).join(",") === "verify-e2e.kern,verify-e2e.lane"
      && borrowed.every((source) => source.zeitpunkt === "vor-dem-land" && source.positions?.lane === "ausleihe"),
    JSON.stringify(verify?.anatomie));
  const mainLive = planContext({ ...facts, position: "main", variante: "live-bau" });
  check("live-bau plan: under a MAIN founding the lane's variant is refused by name and changes nothing",
    !("variante" in mainLive) && /gehoert zur Position lane/.test(mainLive.varianteVerworfen ?? "")
      && JSON.stringify(mainLive.selected) === JSON.stringify(planContext({ ...facts, position: "main" }).selected),
    mainLive.varianteVerworfen);
  const repo = { trackedPaths: new Set([...tree.sourceBytes.keys(), ...sourceBytes.keys()]), sourceBytes: new Map([...tree.sourceBytes, ...sourceBytes]) };
  const repoPlain = planRepoContext({ manifest: tree.manifest, repo, facts });
  const repoLive = planRepoContext({ manifest: tree.manifest, repo, facts: { ...facts, variante: "live-bau" } });
  const ti = repoLive.selected.find((p) => p.id === "testinstanz-abnahme");
  check("live-bau plan: the real manifest's testinstanz-abnahme rides the variant with its live-bau Kern; the plain lane omits it as before",
    repoPlain.omitted.some((p) => p.id === "testinstanz-abnahme" && p.why === "trigger-not-matched")
      && JSON.stringify(repoPlain) === JSON.stringify(planRepoContext({ manifest: tree.manifest, repo, facts: { ...facts, variante: null } }))
      && ti?.anatomie?.variante === "live-bau"
      && JSON.stringify(ti.anatomie.kern) === JSON.stringify(["testinstanz-abnahme.live-bau", "testinstanz-abnahme.ablauf"]),
    JSON.stringify({ plain: repoPlain.omitted.find((p) => p.id === "testinstanz-abnahme"), live: ti?.anatomie }));
  // the seed's anatomy is judged by the manifest's own judge, and that judge still reds the real mistake
  const seed = CONTEXT_PACKS.find((pack) => pack.id === "verify-e2e")!;
  const split = splitPackAnatomy(JSON.parse(JSON.stringify(seed)) as Record<string, unknown>);
  const seedIssues = packAnatomyIssues(split.core, split.anatomy, repo);
  const unlimited = JSON.parse(JSON.stringify(split.anatomy)) as { zusaetze: { bedingung: Record<string, unknown> }[] };
  delete unlimited.zusaetze[0]!.bedingung.varianten;
  const mutantIssues = packAnatomyIssues(split.core, unlimited as Record<string, unknown>, repo);
  check("live-bau plan: the seed's anatomy passes the manifest judge; the same Zusatz NOT limited to live-bau names a part twice",
    seedIssues.length === 0 && mutantIssues.includes("a Kern and its Zusaetze name the same part id twice"),
    JSON.stringify({ seedIssues, mutantIssues }));

  // --- the session file (AGENTS.override.md) and the receipt's part rows
  const receiver = { role: "program-main", slot: 3 };
  const render = (plan: ContextPlan, variante: "live-bau" | null) => renderSessionAgents({
    role: { text: probe.roles[0]!, path: "server.ts", anchor: "LANE_ROLE_CARD" }, position: "lane", harness: "claude",
    plan, sourceBytes: repo.sourceBytes, footer: probe.laneExitFooter("claude", receiver, variante) });
  const merged = (a: ContextPlan, b: ContextPlan): ContextPlan => ({ selected: [...a.selected, ...b.selected], omitted: [...a.omitted, ...b.omitted] });
  const filePlain = render(merged(plain, repoPlain), null);
  const fileLive = render(merged(live, repoLive), "live-bau");
  const part = (file: typeof filePlain, id: string) => file.parts.find((p) => p.id === id);
  const kernText = sourceSection(repo.sourceBytes.get("AGENTS.md")!, "AGENTS.md", "### Kern")!.content;
  const liveBauText = sourceSection(repo.sourceBytes.get("docs/testinstanz.md")!, "docs/testinstanz.md",
    "## Live-Bau mit dem Owner — bauen, während er in der Instanz klickt")!.content;
  check("live-bau file: verify-e2e Kern and Lane are receipt rows ausleihe with zeitpunkt vor-dem-land, the pointer says so, the text is out",
    ["verify-e2e.kern", "verify-e2e.lane"].every((id) => part(fileLive, id)?.ort === "ausleihe" && part(fileLive, id)?.zeitpunkt === "vor-dem-land"
      && part(fileLive, id)?.content === null && part(fileLive, id)?.sha256 !== null)
      && fileLive.text.includes("  AGENTS.md | ### Kern — vor dem Land ausleihen\n  AGENTS.md | ### Lane — vor dem Land ausleihen")
      && !fileLive.text.includes(kernText) && filePlain.text.includes(kernText),
    JSON.stringify(["verify-e2e.kern", "verify-e2e.lane"].map((id) => part(fileLive, id))));
  check("live-bau file: the Testinstanz instruction is boxed — its exact bytes in the file and on the receipt row",
    part(fileLive, "testinstanz-abnahme.live-bau")?.ort === "box" && fileLive.text.includes(liveBauText)
      && part(fileLive, "testinstanz-abnahme.live-bau")?.bytes === Buffer.byteLength(liveBauText)
      && liveBauText.includes("./testinstanz.sh refresh"),
    JSON.stringify(part(fileLive, "testinstanz-abnahme.live-bau") && { ...part(fileLive, "testinstanz-abnahme.live-bau"), content: undefined }));
  const laneEnd = (file: typeof filePlain) => file.text.slice(file.text.indexOf("## Lane-Ende"));
  check("live-bau file: the lane end keeps its three acts and the role card, runs no verify, and names the borrow before the land",
    ["HOW THIS LANE ENDS", "1. COMMIT.", "2. FILE ONE TYPED FLEET-REPORT", "3. THEN GO IDLE.", "/api/self/context/verify-e2e", "GET /api/self/gate"]
      .every((needle) => laneEnd(fileLive).includes(needle))
      && !laneEnd(fileLive).includes("suite-offer") && !laneEnd(fileLive).includes("OWN verify runs")
      && laneEnd(filePlain).includes("OWN verify runs") && part(fileLive, "role")?.sha256 === part(filePlain, "role")?.sha256,
    `plain ${filePlain.bytes} B, live-bau ${fileLive.bytes} B`);
  check("live-bau file: without the variant no part carries a zeitpunkt and the lane end is the plain footer, byte for byte",
    filePlain.parts.every((p) => !("zeitpunkt" in p))
      && probe.laneExitFooter("claude", receiver, null) === probe.laneExitFooter("claude", receiver),
    `${filePlain.bytes} B`);

  // --- the baton: a live-bau successor reads HOW THIS LANE ENDS once, in its rewritten session file
  const baton = new Function(new Bun.Transpiler({ loader: "ts" }).transformSync(`${probe.fn("laneBatonFooter")}\nreturn laneBatonFooter;`))() as
    (variante: "live-bau" | null, footer: string) => string;
  const footer = probe.laneExitFooter("claude", receiver);
  check("live-bau baton: the brief points to AGENTS.override.md instead of a second HOW THIS LANE ENDS; a plain baton keeps its footer",
    !baton("live-bau", footer).includes("HOW THIS LANE ENDS") && baton("live-bau", footer).includes("./AGENTS.override.md")
      && baton(null, footer) === footer && server.includes("footer: laneBatonFooter(context.variante, laneExitFooter(s.harness, selfPosition(s).receiver))"),
    JSON.stringify(baton("live-bau", footer)));

  // --- the rulebook: the lane render minus the 15 sections, each an anchor (fixture fragments: the
  // real ones are gitignored and live in the source checkout only)
  const ohne = (ROLE_SECTION_CUT["live-bau"]["lane-discipline"] as { ohne: readonly string[] }).ohne;
  const fixture = new Map<RulebookFragment, string>(RULEBOOK_FRAGMENTS.map((f) => [f, [`## ${f}\n\nprose before the first bullet of ${f}\n`,
    ...(f === "lane-discipline" ? ohne : []).map((slug) => `- **${slug.split("-").join(" ")}** rule text of ${f}/${slug}\n  wrapped line\n`),
    `- **kept rule of ${f}**\n`].join("")]));
  const lane = renderRulebook("lane", fixture);
  const cut = renderRoleRulebook("live-bau", fixture, { repoRoot: "/fixture/repo", anchorDir: "/fixture/abschnitte", sourceHash: "0123456789abcdef" });
  const omittedSections = fragmentSections("lane-discipline", fixture.get("lane-discipline")!).sections.filter((sec) => ohne.includes(sec.slug));
  const body = cut.text.slice(0, cut.text.indexOf(`\n${RULEBOOK_BACKREF_HEADING}\n`));
  check("live-bau rulebook: the variant's CLAUDE.md is the lane render minus exactly the 15 sections, each named with its file",
    ohne.length === 15 && omittedSections.length === 15 && cut.staleOmissions.length === 0
      && body === omittedSections.reduce((text, sec) => text.replace(sec.text, ""), lane)
      && omittedSections.every((sec) => cut.text.includes(`\`${sec.anchor}\``) && cut.files.get(`${sec.anchor}.md`) === sec.text),
    `lane ${Buffer.byteLength(lane)} B, live-bau body ${Buffer.byteLength(body)} B`);
}

async function ownerSuccessionPermissionsChecks(check: ContextPlanCheck): Promise<void> {
  const source = readFileSync(join(import.meta.dir, "../server.ts"), "utf8");
  const cut = (start: string, end: string): string => {
    const at = source.indexOf(start), until = source.indexOf(end, at);
    if (at < 0 || until < 0) throw new Error(`owner succession probe: missing source ${start}`);
    return source.slice(at, until);
  };
  const code = [cut("const harnessOf =", "\n\n"), cut("function permissionsOf(", "\n// The lane's browser profile"),
    cut("const sameSuccessionOccupant =", "\n\n"), cut("function boundProgramsForMain(", "\nfunction mainBindingOf("),
    cut("const isGameMaker =", "\n"), cut("type OwnerSucceedRefusal =", "\n// THE SESSION'S HALF:")].join("\n");
  const js = new Bun.Transpiler({ loader: "ts" }).transformSync(code);
  const profiles = ["read-only", "workspace-write", "danger-full-access"].flatMap((sandbox) =>
    ["on-request", "never"].map((approval) => ({ sandbox, approval })));
  const cases = [
    ...profiles.map((permissions) => ({ name: `${permissions.sandbox}/${permissions.approval}`, harness: "codex", permissions, late: null })),
    { name: "invalid", harness: "codex", permissions: { state: "invalid" }, late: null },
    { name: "unsupported", harness: "claude", permissions: profiles[0]!, late: null },
    { name: "late invalid", harness: "codex", permissions: profiles[0]!, late: { state: "invalid" } },
    { name: "late changed", harness: "codex", permissions: profiles[0]!, late: profiles[5]! },
  ];
  for (const fixture of cases) {
    let effects = 0, spawn: unknown = null;
    const slot: Record<string, unknown> = { id: 1, openedAt: 123, cwd: "/fixture/owner-succession", selfToken: "fixture-token",
      label: "Fixture", harness: fixture.harness, model: "fixture-model", effort: "high", permissions: fixture.permissions };
    const claude = { id: "claude", supports: { transcript: false } };
    const deps = { codexPermissionsFrom, CLAUDE_HARNESS: claude,
      HARNESSES: [claude, { id: "codex", supports: { transcript: false },
        permissions: { default: { sandbox: "danger-full-access", approval: "never" } } }],
      programs: [], STEWARD_LABEL: "steward", MERGE_IDLE_MS: 1000,
      slotWakeInflight: new Set(), slotTeardownInflight: new Set(), restarting: new Set(), slotSpawnInflight: new Set(),
      laneSpawn: new Set(), mergeInflight: new Set(), successionStarted: new Map(), successionInflight: new Set(),
      json: (body: unknown, status = 200) => Response.json(body, { status }),
      canDeliver: async () => ({ ok: true }), transcriptPayload: async () => ({ source: null, entries: [] }),
      lineagePointerCommitted: async () => true, audit: () => {},
      // the keepCache latch is a test hook that stands still without FLEET_TEST_KEEP_CACHE_LATCH — so here
      waitForKeepCacheTestLatch: async () => {},
      succeedGeneric: async (_slot: unknown, options: { spawn: unknown; beforeKill: () => Promise<Response | null> }) => {
        spawn = options.spawn;
        if (fixture.late) slot.permissions = fixture.late;
        const refused = await options.beforeKill();
        if (refused) return refused;
        effects++;
        return Response.json({ ok: true });
      } };
    const succeed = new Function(...Object.keys(deps), `${js}; return handleOwnerSucceed;`)(...Object.values(deps)) as
      (s: Record<string, unknown>) => Promise<Response>;
    const response = await succeed(slot);
    const positive = fixture.name.includes("/");
    const expectedStatus = positive ? 200 : fixture.name === "late changed" ? 409 : 400;
    check(`owner succession permissions: ${fixture.name} ${positive ? "preserved exactly" : "refused before destruction"}`,
      response.status === expectedStatus && effects === (positive ? 1 : 0)
        && (positive ? JSON.stringify(spawn) === JSON.stringify({ model: slot.model, effort: slot.effort, permissions: fixture.permissions })
          : fixture.late !== null || spawn === null),
      `status=${response.status}, effects=${effects}, spawn=${JSON.stringify(spawn)}`);
  }
}

async function laneSessionFilesChecks(check: ContextPlanCheck): Promise<void> {
  const source = readFileSync(join(import.meta.dir, "../server.ts"), "utf8");
  const start = source.indexOf("async function writeLaneSessionAgents(");
  const end = source.indexOf("\n}", start);
  const js = new Bun.Transpiler({ loader: "ts" }).transformSync(source.slice(start, end + 2));
  const git = async (repo: string, ...args: string[]) => {
    const r = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
    return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() };
  };
  const deps = { git, existsSync, readFileSync, mkdirSync, dirname, appendFileSync, lstatSync, writeFileSync, chmodSync };
  const write = new Function(...Object.keys(deps), `${js}; return writeLaneSessionAgents;`)(...Object.values(deps)) as
    (path: string, agents: { text: string }) => Promise<void>;
  const codexStart = source.indexOf("  spawnCmd: (o) => {", source.indexOf("const CODEX_HARNESS: Harness"));
  const codexEnd = source.indexOf("\n  },", codexStart);
  const arrow = source.slice(codexStart + "  spawnCmd: ".length, codexEnd + 4);
  const codexDeps = { codexPermissionsFrom, realpathSync, shellSingleQuote: (s: string) => `'${s.replaceAll("'", "'\\''")}'`,
    CODEX_TEXT_LANE_MCP: "text-mcp", PATH_EXPORT: "", SHELL: "/bin/sh" };
  const spawnCodex = new Function(...Object.keys(codexDeps), `return (${arrow});`)(...Object.values(codexDeps)) as
    (opts: Record<string, unknown>) => string;
  const repo = realpathSync(mkdtempSync(join(tmpdir(), "lane-agents-files-")));
  try {
    for (const resume of [false, true]) {
      const options = { cwd: repo, permissions: { sandbox: "danger-full-access", approval: "never" }, browserMcp: true,
        sessionId: "11111111-1111-1111-1111-111111111111", resume };
      const normal = spawnCodex(options), large = spawnCodex({ ...options, projectDocMaxBytes: 41980 });
      check(`native Codex ${resume ? "resume" : "fresh"}: only oversized project docs get the exact byte budget`,
        !normal.includes("project_doc_max_bytes") && large.includes(" -c project_doc_max_bytes=41980")
          && large.replace(" -c project_doc_max_bytes=41980", "") === normal);
    }
    await git(repo, "init", "-q");
    const text = "## Rolle\n\nEin Satz aus der Lane-Rolle.\n";
    await write(repo, { text });
    const exclude = (await git(repo, "rev-parse", "--path-format=absolute", "--git-path", "info/exclude")).out;
    const first = readFileSync(exclude, "utf8");
    await write(repo, { text });
    check("lane files: exact render and native Claude import are excluded with a clean tree",
      readFileSync(join(repo, "AGENTS.override.md"), "utf8") === text
        && readFileSync(join(repo, "CLAUDE.local.md"), "utf8") === "@AGENTS.override.md\n"
        && (await git(repo, "check-ignore", "AGENTS.override.md", "CLAUDE.local.md")).out === "AGENTS.override.md\nCLAUDE.local.md"
        && (await git(repo, "status", "--porcelain")).out === "");
    check("lane files: repeated preparation does not duplicate exclusions", readFileSync(exclude, "utf8") === first);
    await git(repo, "add", "-f", "AGENTS.override.md");
    let refused = "";
    try { await write(repo, { text: "overwrite" }); } catch (err) { refused = String(err); }
    check("lane files: tracked native rules refuse overwrite", refused.includes("session rule paths must be untracked")
      && readFileSync(join(repo, "AGENTS.override.md"), "utf8") === text);
    await git(repo, "rm", "--cached", "-f", "AGENTS.override.md");
    unlinkSync(join(repo, "CLAUDE.local.md"));
    writeFileSync(join(repo, "target"), "keep");
    symlinkSync(join(repo, "target"), join(repo, "CLAUDE.local.md"));
    refused = "";
    try { await write(repo, { text }); } catch (err) { refused = String(err); }
    check("lane files: symlink import refuses writing outside its file", refused.includes("session rule path is a symlink")
      && readFileSync(join(repo, "target"), "utf8") === "keep");
    mkdirSync(join(repo, "denied"));
    writeFileSync(join(repo, "denied/canary"), "blocked");
    // the fence grants pi its startup read of auth.json only for an empty store and otherwise ends
    // in a named (error) — without this file the real seatbelt below refuses to apply at all
    mkdirSync(join(repo, "agent"));
    writeFileSync(join(repo, "agent/auth.json"), "{}");
    const profile = piZaiFenceProfile({ home: repo, fleetDir: repo, agentDir: join(repo, "agent"),
      keyFile: join(repo, "key"), cwd: repo, tmuxDir: join(repo, "tmux"), sockets: [], denyRoots: [join(repo, "denied")],
      tmpRoots: [join(repo, "tmp")], ownTmp: join(repo, "tmp/own"), suiteLock: join(repo, "tmp/suite-lock"),
      toolRoots: [join(repo, "tools")], git: null });
    check("lane files: pi-zai fence builds with a local native rule file", profile !== null);
    if (process.platform === "darwin" && profile) {
      const allowed = spawnSync("/usr/bin/sandbox-exec", ["-p", profile, "/bin/cat", join(repo, "AGENTS.override.md")], { encoding: "utf8" });
      const denied = spawnSync("/usr/bin/sandbox-exec", ["-p", profile, "/bin/cat", join(repo, "denied/canary")], { encoding: "utf8" });
      check("lane files: real pi-zai seatbelt reads session rules and refuses private roots", allowed.status === 0
        && allowed.stdout === text && denied.status !== 0 && denied.stdout === "");
    }
  } finally { rmSync(repo, { recursive: true, force: true }); }
}
