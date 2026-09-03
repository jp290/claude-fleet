// Pure ContextPlan v1 family. Direct entry point: bun e2e/context-plan.ts
import {
  CONTEXT_PACK_CAPABILITIES,
  CONTEXT_PACKS,
  type ContextPackCapability,
} from "../context-packs";
import { CONTEXT_PLAN_OMISSION_REASONS, planContext } from "../context-plan";
import { createHash } from "node:crypto";
import { CONTEXT_MANIFEST_MAX_BYTES, CONTEXT_MANIFEST_OMISSION_ID, observedSourceHash, planRepoContext,
  readContextManifest, stampObservedSourceHashes } from "../context-manifest";

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
    normal.selected.map((pack) => pack.id).join(",") === "portable-core,verify-e2e", summary(normal));
  check("context plan: each real omission names the first failed rule",
    normal.omitted.length === 4 && normal.omitted.every((pack) => pack.why === "trigger-not-matched"),
    summary(normal));

  // The plan is what the renderer sees, so PURPOSE must survive selection — a seed's mandatory
  // useWhen reaching the selection unchanged is the only reason the v2 block can state one.
  check("context plan: every selected Fleet seed carries its seed's purpose line verbatim",
    normal.selected.length === 2 && normal.selected.every((pack) =>
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
      "manifest-invalid,source-unavailable,status-not-active,harness-unsupported,mode-unsupported,trigger-not-matched,capability-missing");

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
  // --- the observed source version. A pack's sourceHash is a MEASUREMENT over the bytes the
  // validator proved, never a literal someone typed, so "version N vs N+1" is computable.
  const promiseBytes = "## Product promise\nplay first.\n";
  const expectedHash = createHash("sha256").update("docs/promise.md").update("\0").update(promiseBytes).update("\0").digest("hex");
  check("context manifest: a validated repo pack carries the OBSERVED sha256 of the bytes the validator proved, framed path\\0bytes\\0",
    valid.selected[0]?.sourceHash === expectedHash, JSON.stringify(valid.selected[0]));
  const edited = planRepoContext(repoWorld([repoPack()], "## Product promise\nplay second.\n"));
  check("context manifest: the observed hash follows the bytes — a source edit is a new pack version",
    typeof edited.selected[0]?.sourceHash === "string" && edited.selected[0].sourceHash !== expectedHash,
    JSON.stringify(edited.selected[0]));
  const declared = planRepoContext(repoWorld([repoPack({ sourceHash: "a".repeat(64), observedAt: "2026-01-01T00:00:00Z" })]));
  check("context manifest: an observed hash beats a declared literal — a measurement over a claim",
    declared.selected[0]?.sourceHash === expectedHash, JSON.stringify(declared.selected[0]));
  const seedBytes = new Map([["AGENTS.md", "## Portable operating contract\n## Verify\n"]]);
  const stamped = stampObservedSourceHashes(normal.selected, seedBytes);
  const stampedCore = stamped.find((p) => p.id === "portable-core");
  const stampedVerify = stamped.find((p) => p.id === "verify-e2e");
  check("context plan: stampObservedSourceHashes hashes a seed only when EVERY source was read — a half-read seed stays unstamped, never half-hashed",
    typeof stampedCore?.sourceHash === "string" && stampedVerify !== undefined && stampedVerify.sourceHash === undefined
      && normal.selected.every((p) => p.sourceHash === undefined),
    JSON.stringify(stamped.map((p) => [p.id, p.sourceHash ?? null])));
  check("context plan: a stamped seed hash equals the observed hash over the same bytes, so seed and repo rows are one unit",
    stampedCore?.sourceHash === observedSourceHash([{ path: "AGENTS.md", anchor: "## Portable operating contract" }], seedBytes));

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

  if (!externalCheck) {
    console.log(rows.join("\n"));
    console.log(failures ? `\n${failures} FAILURES` : "\nALL PASS");
    if (failures) process.exitCode = 1;
  }
}

if (import.meta.main) await run();
