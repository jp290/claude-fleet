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
import { SNIPPET_BLOCK_MAX_BYTES, SNIPPET_CONTEXT_LINES, SNIPPET_OMISSION_MAX_BYTES, buildSnippetPackage, definitionLines,
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
  const privateOnly = planContext({ sourceTree: "fleet", harness: "claude", mode: "mutating",
    triggers: ["deployment"], capabilities: fullCapabilities() })
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
  const snipRows: SnippetRow[] = [{ id: "t1", files: ["alpha.ts"] }];
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

  // (6) THE DELIVERED EXCERPT IS THE SOURCE, exactly — and it names the version it was cut from.
  const exact = pack("lies alpha.ts#alphaOne", snipRows, paddedFile);
  // alphaOne's definition is line 42 of the padded file and its body ends on 44; the window is
  // exactly ±SNIPPET_CONTEXT_LINES around that span, and the text is the file's own bytes for it.
  check("snippets: the excerpt is the file's own bytes for the named span ±20, labelled with path, symbol, lines and blob",
    exact.built.shown.length === 1
    && exact.built.shown[0]!.from === 42 - SNIPPET_CONTEXT_LINES
    && exact.built.shown[0]!.to === 44 + SNIPPET_CONTEXT_LINES
    && exact.built.shown[0]!.text === paddedLines.slice(42 - SNIPPET_CONTEXT_LINES - 1, 44 + SNIPPET_CONTEXT_LINES).join("\n")
    && exact.built.shown[0]!.context === SNIPPET_CONTEXT_LINES
    && !exact.built.shown[0]!.incomplete
    && exact.block.includes(`- alpha.ts#alphaOne · Zeilen ${42 - SNIPPET_CONTEXT_LINES}-${44 + SNIPPET_CONTEXT_LINES} · blob ${"blob-alpha.ts".slice(0, 12)}`)
    && exact.block.includes("aus c0ffee0c0ffe"),
    JSON.stringify({ from: exact.built.shown[0]?.from, to: exact.built.shown[0]?.to,
      block: exact.block.slice(0, 180) }));

  // (7) A WAVE SHARES ONE CAP and says which row a source belongs to. The same symbol named by two
  // rows is ONE excerpt — delivering identical lines twice spends the budget on agreement.
  const wave = pack("lies alpha.ts#alphaOne und noch einmal alpha.ts#alphaOne",
    [{ id: "t1", files: ["alpha.ts"] }, { id: "t2", files: ["alpha.ts"] }], paddedFile);
  // counted on the LABEL lines only — the excerpt text naturally contains the symbol's own name, and
  // the first version of this probe counted those and called one excerpt two.
  const waveLabels = wave.block.split("\n").filter((line) => line.startsWith("- alpha.ts#"));
  check("snippets: a wave delivers a twice-named symbol once, carrying both rows",
    wave.built.shown.length === 1 && wave.built.shown[0]!.taskIds.join(",") === "t1,t2"
    && waveLabels.length === 1 && waveLabels[0]!.includes("zu t1, t2"),
    JSON.stringify({ shown: wave.built.shown.map((hit) => hit.symbols), labels: waveLabels }));
  check("snippets: a single-task lane carries no row attribution at all",
    !exact.block.includes("zu t1"), exact.block.slice(0, 160));

  // (8) THE BUDGET IS UTF-8 BYTES AND IT IS HARD. A two-byte character must count twice, or a block
  // of umlauts passes a character check and overruns the cap it claims to respect.
  const wideLines = ["export function wide(): string {",
    ...Array.from({ length: 200 }, (_, i) => `  // ${"ü".repeat(60)} ${i}`), "  return \"x\";", "}"];
  const wideFile: SnippetFile[] = [{ path: "alpha.ts", text: wideLines.join("\n"), blob: "blob-alpha.ts" }];
  const wide = pack("lies alpha.ts#wide", snipRows, wideFile);
  check("snippets: the block never exceeds the byte cap, and a 2-byte character costs 2 — not 1",
    new TextEncoder().encode(wide.block).byteLength <= SNIPPET_BLOCK_MAX_BYTES
    && wide.block.length < new TextEncoder().encode(wide.block).byteLength
    && wide.built.bytes === new TextEncoder().encode(wide.block).byteLength,
    `chars=${wide.block.length} bytes=${new TextEncoder().encode(wide.block).byteLength}`);
  check("snippets: a body cut to fit says it was cut and reports the lines it ACTUALLY shows",
    wide.built.shown.length === 1 && wide.built.shown[0]!.incomplete
    && wide.built.shown[0]!.to < wideLines.length
    && wide.block.includes("GEKUERZT")
    && wide.built.shown[0]!.text.split("\n").length === wide.built.shown[0]!.to - wide.built.shown[0]!.from + 1,
    JSON.stringify({ to: wide.built.shown[0]?.to, incomplete: wide.built.shown[0]?.incomplete }));

  // (9) NO SILENT DISPLACEMENT — and the module has TWO mechanisms for it, so this asserts both.
  // First: a hit too large for its half of the block is CUT, not dropped, and the small hit after it
  // still arrives. Second: when even the definition line cannot fit, the hit is omitted BY NAME and
  // the loop goes on. The first version of this probe asserted only the second and read as a defect
  // when the first one did its job.
  const bigThenSmall: SnippetFile[] = [{ path: "alpha.ts",
    text: [...wideLines, "", "export const tiny = 1;"].join("\n"), blob: "blob-alpha.ts" }];
  const crowded = pack("lies alpha.ts#wide und alpha.ts#tiny", snipRows, bigThenSmall, 700);
  check("snippets: an oversized hit is CUT rather than dropped, and the smaller later hit still arrives",
    crowded.built.shown.map((hit) => hit.symbols.join("+")).join(",") === "wide,tiny"
    && crowded.built.shown[0]!.incomplete
    && new TextEncoder().encode(crowded.block).byteLength <= 700,
    JSON.stringify({ shown: crowded.built.shown.map((h) => [h.symbols, h.from, h.to]),
      bytes: new TextEncoder().encode(crowded.block).byteLength }));
  // a definition line wider than the whole budget: nothing can be cut away, so it must be NAMED
  const unfittable: SnippetFile[] = [{ path: "alpha.ts",
    text: [`export function huge(${"a".repeat(400)}: string) {`, "  return 1;", "}", "",
      "export const tiny = 1;"].join("\n"), blob: "blob-alpha.ts" }];
  const named = pack("lies alpha.ts#huge und alpha.ts#tiny", snipRows, unfittable, 320);
  check("snippets: a hit that cannot fit even at one line is omitted BY NAME, and the later hit is delivered",
    named.built.shown.map((hit) => hit.symbols.join("+")).join(",") === "tiny"
    && named.built.omitted.some((entry) => entry.ref === "alpha.ts#huge" && entry.why === "budget-exhausted")
    && named.block.includes("budget-exhausted")
    && new TextEncoder().encode(named.block).byteLength <= 320,
    JSON.stringify({ shown: named.built.shown.map((h) => h.symbols), omitted: named.built.omitted,
      bytes: new TextEncoder().encode(named.block).byteLength }));

  // (10) OVERLAPS MERGE, and the merged label may only name symbols the excerpt really contains.
  const neighbours = pack("lies alpha.ts#alphaOne und alpha.ts#alphaTwo", snipRows, paddedFile);
  check("snippets: two symbols whose windows overlap become ONE excerpt naming both, spanning both definitions",
    neighbours.built.shown.length === 1
    && neighbours.built.shown[0]!.symbols.join("+") === "alphaOne+alphaTwo"
    && neighbours.built.shown[0]!.from === 42 - SNIPPET_CONTEXT_LINES
    && neighbours.built.shown[0]!.to === 46 + SNIPPET_CONTEXT_LINES
    && neighbours.built.shown[0]!.text.includes("export function alphaOne")
    && neighbours.built.shown[0]!.text.includes("export const alphaTwo"),
    JSON.stringify(neighbours.built.shown.map((hit) => [hit.symbols, hit.from, hit.to])));

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
  check("snippets: ±context is the declared constant, not a literal buried in the renderer",
    SNIPPET_CONTEXT_LINES === 20 && definitionLines(alpha.split("\n"), "alphaTwo").join(",") === "5",
    `${SNIPPET_CONTEXT_LINES} ${definitionLines(alpha.split("\n"), "alphaTwo")}`);

  if (!externalCheck) {
    console.log(rows.join("\n"));
    console.log(failures ? `\n${failures} FAILURES` : "\nALL PASS");
    if (failures) process.exitCode = 1;
  }
}

if (import.meta.main) await run();
