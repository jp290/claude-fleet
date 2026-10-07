import { sectionAt, sourceSection } from "../context-sections";
import { renderSessionAgents } from "../session-agents";
import { createHash, timingSafeEqual } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { CONTEXT_PACK_CAPABILITIES, CONTEXT_PACKS, CONTEXT_PACK_TRIGGERS } from "../context-packs";
import { planContext, planProgramContext, readPrivatePack, resolvePrivatePack } from "../context-plan";
import { CONTEXT_MANIFEST_MAX_BYTES, planRepoContext, readContextManifest, stampObservedSourceHashes, taskContextTriggers } from "../context-manifest";
import { KONZEPT_ROOT_ENV } from "../konzept-ledger";
import { appendEventStrict, readLedger } from "../server/persist";
import type { ContextPlanCheck } from "./context-plan";

export async function run(check: ContextPlanCheck): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), "fleet-context-borrow-"));
  const sourceRoot = resolve(import.meta.dir, "..");
  const source = readFileSync(join(sourceRoot, "server.ts"), "utf8");
  const auth = readFileSync(join(sourceRoot, "server/auth.ts"), "utf8");
  const fn = (name: string, text = source): string => {
    const match = new RegExp(`^(?:export )?(?:async )?function ${name}\\b`, "m").exec(text);
    if (!match) throw new Error(`borrow probe: missing function ${name}`);
    const end = text.indexOf("\n}", match.index);
    if (end < 0) throw new Error(`borrow probe: missing end ${name}`);
    return text.slice(match.index, end + 2).replace(/^export /, "");
  };
  const gitRaw = async (dir: string, ...args: string[]) => {
    const result = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    return { code: result.status ?? 1, out: result.stdout };
  };
  const g = (...args: string[]) => {
    const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`borrow fixture git ${args[0]} failed: ${result.stderr}`);
    return result.stdout.trim();
  };
  try {
    const exactSection = "  ### Kern\r\nExact section.\r\n";
    const prefixSection = "### Kern — Extended heading\nUnique section.\n";
    const exactText = `### Kernel\r\nWrong section.\r\n${exactSection}### After\r\n`;
    const prefixText = `~~~md\n### Kern fake\n~~~\n    ### Kern indented\n${prefixSection}### After\n`;
    check("context borrow: an exact anchor wins over an earlier prefix and preserves section bytes",
      sectionAt(exactText, "exact.md", "### Kern") === exactSection);
    check("context borrow: one prefix outside code resolves a shortened anchor",
      sectionAt(prefixText, "prefix.md", "### Kern") === prefixSection);
    const ambiguousText = "### Kernel\nFirst section.\n### Kern — Extended heading\nSecond section.\n";
    for (const read of [sectionAt, sourceSection]) {
      let error: unknown;
      try { read(ambiguousText, "ambiguous.md", "### Kern"); } catch (caught) { error = caught; }
      check(`context borrow: ${read.name} rejects ambiguous prefixes with a named error`,
        error instanceof Error && error.name === "source-anchor-ambiguous"
        && error.message.includes("ambiguous.md") && error.message.includes("### Kern"));
    }
    const readClient = (roots: readonly string[]) => {
      const errors: string[] = [];
      for (const root of roots) try {
        const founding = readFileSync(join(root, "src/founding.ts"), "utf8");
        const validators = founding.slice(founding.indexOf("const strs ="), founding.indexOf("// THE FOUR GROUPS"));
        const fixed = founding.slice(founding.indexOf("const partFixed ="), founding.indexOf("// whether this start"));
        const client = new Function(new Bun.Transpiler({ loader: "ts" }).transformSync(
          `${validators}\n${fixed}\nreturn { validPlan, partFixed };`))() as {
          validPlan: (value: unknown) => boolean; partFixed: (value: unknown) => string | null;
        };
        return { client };
      } catch (error) { errors.push(`${root}: ${error instanceof Error ? error.message : String(error)}`); }
      return { error: errors.join("; ") };
    };
    const candidates = [sourceRoot];
    try { candidates.push(dirname(resolve(sourceRoot, readlinkSync(join(sourceRoot, "node_modules"))))); } catch {}
    const observed = readClient([...new Set(candidates)]);
    const client = observed.client;
    check("context borrow: PROBE: founding client validators are readable from the source tree", client !== undefined, observed.error);
    const missingClient = readClient([root]);
    check("context borrow: an unavailable founding source returns a setup error instead of throwing",
      missingClient.client === undefined && missingClient.error?.includes("src/founding.ts") === true, missingClient.error);
    for (const harness of ["claude", "codex"]) {
      const input = { role: { text: "Fixture role.", path: "server.ts", anchor: "role" }, position: "lane", harness,
        plan: { selected: [{ id: "renderer-anchor", hardness: "guidance", estimatedBytes: 0, sources: [
          { id: "ambiguous", path: "ambiguous.md", anchor: "### Kern" },
          { id: "exact", path: "exact.md", anchor: "### Kern" },
        ] }], omitted: [] }, selection: { "renderer-anchor.ambiguous": "box", "renderer-anchor.exact": "box" },
        sourceBytes: new Map([["ambiguous.md", ambiguousText], ["exact.md", exactText],
          ["AGENTS.md", "## Portable operating contract\nFixture contract.\n"]]), footer: "Keep footer." } as const;
      let rendered: ReturnType<typeof renderSessionAgents> | undefined;
      let error: unknown;
      try { rendered = renderSessionAgents(input); } catch (caught) { error = caught; }
      const part = rendered?.parts.find((item) => item.id === "renderer-anchor.ambiguous");
      check(`context borrow: ${harness} rendering refuses an ambiguous anchor without throwing or delivering bytes`,
        error === undefined && JSON.stringify(part) === JSON.stringify({ id: "renderer-anchor.ambiguous", packId: "renderer-anchor",
          path: "ambiguous.md", anchor: "### Kern", sorte: "wissen", ort: "ausleihe", sha256: null, bytes: null,
          content: null, refusal: "source-anchor-ambiguous" }), error instanceof Error ? `${error.name}: ${error.message}` : JSON.stringify(part));
      check(`context borrow: ${harness} rendering keeps other boxed sections and the named refusal pointer`,
        rendered?.parts.find((item) => item.id === "renderer-anchor.exact")?.content === exactSection
        && rendered.text.includes("ambiguous.md | ### Kern (source-anchor-ambiguous)")
        && !rendered.text.includes("First section.") && !rendered.text.includes("Second section."));
      if (client) {
        const clientPlan = { selected: [{ id: "renderer-anchor", bytes: 0, source: "repo-manifest", parts: [part] }],
          omitted: [], sessionAgents: rendered };
        check(`context borrow: the client accepts the ${harness} plan with an ambiguous refusal in pack and file parts`,
          part !== undefined && rendered !== undefined && client.validPlan(clientPlan));
        check(`context borrow: the client names the ${harness} ambiguous anchor as fixed outside the file`,
          part !== undefined && client.partFixed(part) === "Anker nicht eindeutig.");
        check(`context borrow: the client still rejects an unknown refusal in ${harness} plan parts`,
          part !== undefined && !client.validPlan({ ...clientPlan,
            selected: [{ ...clientPlan.selected[0]!, parts: [{ ...part, refusal: "unknown-refusal" }] }] }));
      }
      let unexpected: unknown;
      try { renderSessionAgents({ ...input, sourceBytes: new Map([["ambiguous.md", 123 as unknown as string]]) }); }
      catch (caught) { unexpected = caught; }
      check(`context borrow: ${harness} rendering still throws unrelated source parsing errors`,
        unexpected instanceof TypeError && unexpected.message.includes("matchAll"), String(unexpected));
    }
    g("init", "-q", "-b", "main"); g("config", "user.name", "e2e"); g("config", "user.email", "e2e@fleet");
    const section = "## Section\nGrüße vom HEAD.\n### Child\nKept child.\n````md\n## Fenced sibling\n```\n# Still fenced\n````\n~~~md\n# Tilde fenced\n~~~\n\n";
    const contract = "## Portable operating contract\nFixture contract.";
    const content = `  # Borrow fixture\n${section}${contract}`;
    const hash = createHash("sha256").update(content).digest("hex");
    const sectionHash = createHash("sha256").update(section).digest("hex");
    writeFileSync(join(root, "AGENTS.md"), content);
    mkdirSync(join(root, ".fleet"));
    const repoPack = { id: "repo-borrow", scope: "repo-contract", audience: "agent", triggers: ["always"], hardness: "guidance",
      sources: [{ path: "AGENTS.md", anchor: "## Section" }], requiredCapabilities: ["tracked-source-read"], harnesses: ["claude", "codex"],
      modes: ["mutating"], estimatedBytes: 0, evidence: "tree-anchor", owner: "owner", status: "active", useWhen: "Read the fixture" };
    writeFileSync(join(root, ".fleet/context-packs.json"), JSON.stringify([repoPack]));
    g("add", "-A"); g("commit", "-q", "-m", "fixture");
    const head = g("rev-parse", "HEAD");
    writeFileSync(join(root, "AGENTS.md"), "WORKTREE MUST NOT BE SERVED");
    const own = { id: "own", status: "active", contextPacks: [{ id: "own-borrow", useWhen: "Read own pack", sources: repoPack.sources }] };
    const programs = [own, { id: "foreign", status: "active", contextPacks: [{ ...own.contextPacks[0]!, id: "foreign-borrow" }] }];
    const slot = { id: 1, openedAt: 42, selfToken: "fixture-token", cwd: root, worktree: { repo: root, branch: "lane" },
      taskId: "task", programId: own.id, harness: "codex", sessionId: null };
    const tasks = [{ id: "task", programId: own.id, slot: 1, status: "sent", created: 1, text: "read fixture" }];
    const receiptFile = join(root, "context-receipts.jsonl");
    const borrowFile = join(root, "context-borrows.jsonl");
    let sourceTree = "foreign";
    const dependencies = {
      slots: [slot], tasks, programs, principalState: { slots: () => [slot], sessionRole: () => "lane" }, timingSafeEqual,
      json: (body: unknown, status = 200) => Response.json(body, { status }), STEWARD_LABEL: "steward",
      youngestArchivedTask: async () => null, planContext, planProgramContext, planRepoContext, readContextManifest,
      stampObservedSourceHashes, taskContextTriggers, CONTEXT_PACKS, CONTEXT_PACK_TRIGGERS, KONZEPT_ROOT_ENV,
      readPrivatePack, resolvePrivatePack, sectionAt, createHash, basename: (path: string) => path.split("/").pop(),
      repoRootOf: async (path: string) => path, integrationHead: async () => g("rev-parse", "HEAD"),
      dispatchSourceTree: async () => sourceTree, variantSourceOf: (row: unknown) => row,
      DISPATCH_CONTEXT_MODE: "mutating", DISPATCH_CONTEXT_TRIGGERS: ["always"], DISPATCH_CONTEXT_CAPABILITIES: [...CONTEXT_PACK_CAPABILITIES],
      CONTEXT_MANIFEST_PATH: ".fleet/context-packs.json", CONTEXT_MANIFEST_MAX_BYTES, CONTEXT_MANIFEST_MAX_SOURCE_BYTES: 4_194_304,
      gitRead: async (dir: string, ...args: string[]) => { const r = await gitRaw(dir, ...args); return { ...r, out: r.out.trim() }; },
      gitReadRaw: gitRaw, appendEventStrict, readLedger, CONTEXT_BORROW_FILE: borrowFile, CONTEXT_RECEIPT_FILE: receiptFile,
      MEMORY_RECEIPTS_MAX: 20, SERVER_BOOT_AT: 1, privatePackResolutions: new WeakMap(), KONZEPT_ROOT: null,
    };
    const functions = [fn("secretEq", auth), fn("resolveSelfPrincipal", auth), ...["sessionIdMatchOf", "mainUnboundError", "boundProgramsForMain", "mainBindingOf", "ownProgramsPhrase", "boundProgramForMain", "waveRowsOf",
      "memoryScopeFor", "contextCatalogFor", "contextBorrowRoute", "contextLedgersFor", "memorySourcesView", "treeListingAt", "showAtHead", "repoManifestContextPlan",
      "declaredSourceHash", "privatePackResolutionOf", "contextReceiptSelections"].map((name) => fn(name))].join("\n");
    const refusal = source.slice(source.indexOf("const memoryRefusal ="), source.indexOf("async function memoryScopeFor"));
    const compiled = new Bun.Transpiler({ loader: "ts" }).transformSync(`${refusal}\n${functions}`);
    const api = new Function(...Object.keys(dependencies), `${compiled}\nreturn { contextBorrowRoute, memorySourcesView };`)(...Object.values(dependencies)) as {
      contextBorrowRoute: (req: Request, url: URL, id: string) => Promise<Response>;
      memorySourcesView: (s: unknown, scope: unknown) => Promise<{ declaredNow: { selected: { id: string; borrowedAt?: number }[] };
        deliveredThen: { receipts: { selected: { id: string; borrowedAt?: number }[] }[] }; readByAgent: string; borrowed: { total: number }; coverage: string }>;
    };
    type Answer = { status: number; body: { id?: string; refusal?: string; head?: string; borrowedAt?: number; sources?:
      { content: string; sha256: string; bytes: number; anchor?: string; sorte?: string }[] } };
    const borrow = async (id: string, query = "", token = slot.selfToken): Promise<Answer> => {
      const url = new URL(`http://fixture/api/self/context/${id}${query}`);
      const response = await api.contextBorrowRoute(new Request(url, { headers: { "x-fleet-self-token": token } }), url, id);
      return { status: response.status, body: await response.json() };
    };
    const first = await borrow("repo-borrow");
    check("context borrow: a repo ID serves exact section UTF-8 bytes and SHA-256 at HEAD, never the dirty working tree",
      first.status === 200 && first.body.head === head && first.body.sources?.[0]?.content === section
      && first.body.sources[0].sha256 === sectionHash && first.body.sources[0].bytes === Buffer.byteLength(section));
    const second = await borrow("repo-borrow");
    const ownRead = await borrow("own-borrow");
    const lines = (await readLedger<Record<string, unknown>>(borrowFile)).rows;
    check("context borrow: each successful request writes exactly one content-free line with exact occupant, task, Program, ID, hash and bytes",
      lines.length === 3 && lines.every((row) => row.slot === 1 && row.openedAt === 42 && row.taskId === "task" && row.programId === "own"
        && row.bytes === Buffer.byteLength(section) && row.status === 200 && typeof row.borrowedAt === "number"
        && JSON.stringify(row.sources).includes(sectionHash) && !JSON.stringify(row).includes("Grüße"))
      && lines[0]?.id === "repo-borrow" && lines[2]?.id === "own-borrow" && ownRead.status === 200 && second.status === 200);
    const foreign = await borrow("foreign-borrow"), unknown = await borrow("unknown-borrow");
    const narrowed = await borrow("repo-borrow", "?program=foreign");
    check("context borrow: foreign Program ID and foreign scope are named 409, unknown ID is named 404, with no content",
      foreign.status === 409 && foreign.body.refusal === "foreign-program" && unknown.status === 404 && unknown.body.refusal === "unknown-id"
      && narrowed.status === 409 && narrowed.body.refusal === "foreign-program" && !foreign.body.sources && !unknown.body.sources);
    const denied = (await readLedger<Record<string, unknown>>(borrowFile)).rows.slice(3);
    check("context borrow: each named rejection appends exactly one zero-byte line and no borrowedAt",
      denied.length === 3 && denied.every((row) => row.bytes === 0 && row.borrowedAt === null && JSON.stringify(row.sources) === "[]"));
    const dead = await borrow("repo-borrow", "", "dead-token");
    check("context borrow: an invalid credential returns 401 and appends nothing",
      dead.status === 401 && (await readLedger<Record<string, unknown>>(borrowFile)).rows.length === 6);
    await appendEventStrict(receiptFile, { slot: 1, branch: "lane", taskId: "task", selected: [{ id: "repo-borrow" }], at: 1 });
    const scope = { ok: true, principal: "lane", taskIds: ["task"], programId: "own" };
    const view = await api.memorySourcesView(slot, scope);
    check("context borrow: sources marks declared and delivered IDs with the latest borrowedAt and keeps readByAgent unknown",
      view.declaredNow.selected.find((row) => row.id === "repo-borrow")?.borrowedAt === second.body.borrowedAt
      && view.deliveredThen.receipts[0]?.selected[0]?.borrowedAt === second.body.borrowedAt
      && view.borrowed.total === 3 && view.readByAgent === "unknown");
    slot.openedAt++;
    const recycled = await api.memorySourcesView(slot, scope);
    check("context borrow: a reused slot inherits no prior occupant's borrow claim",
      recycled.borrowed.total === 0 && recycled.declaredNow.selected.every((row) => row.borrowedAt === undefined));
    const originalWriter = dependencies.appendEventStrict;
    dependencies.appendEventStrict = async () => { throw new Error("fixture disk failure"); };
    const failApi = new Function(...Object.keys(dependencies), `${compiled}\nreturn contextBorrowRoute;`)(...Object.values(dependencies)) as typeof api.contextBorrowRoute;
    const failUrl = new URL("http://fixture/api/self/context/repo-borrow");
    const failure = await failApi(new Request(failUrl, { headers: { "x-fleet-self-token": slot.selfToken } }), failUrl, "repo-borrow");
    check("context borrow: a failed ledger append returns named 503 without source content", failure.status === 503
      && (await failure.json() as { refusal: string }).refusal === "borrow-ledger-unavailable");
    dependencies.appendEventStrict = originalWriter;
    sourceTree = "fleet";
    const seedRead = await borrow("portable-core");
    check("context borrow: a Fleet seed ID serves the final section through EOF without a trailing newline",
      seedRead.status === 200 && seedRead.body.sources?.[0]?.content === contract
      && seedRead.body.sources[0].bytes === Buffer.byteLength(contract)
      && (await readLedger<Record<string, unknown>>(borrowFile)).rows.at(-1)?.id === "portable-core");
    slot.harness = "pi-zai";
    const privateDenied = await borrow("konzept-claude-fleet");
    check("context borrow: the private seed's Harness boundary is enforced before resolving content",
      privateDenied.status === 409 && privateDenied.body.refusal === "harness-unsupported" && !privateDenied.body.sources);
    const privateId = "k-claude-fleet";
    mkdirSync(join(root, privateId));
    writeFileSync(join(root, privateId, "v2.md"), content);
    writeFileSync(join(root, privateId, "versionen.jsonl"), `${JSON.stringify({ konzept: privateId, version: 2, sha256: hash })}\n`);
    const matched = readPrivatePack(root, privateId, hash);
    check("context borrow: the private resolver serves only matching current-version content with exact hash and bytes",
      matched.ok && matched.version === 2 && matched.content === content && matched.sha256 === hash && matched.bytes === Buffer.byteLength(content));
    check("context borrow: private missing root and hash drift never expose content",
      !readPrivatePack(null, privateId, hash).ok && !readPrivatePack(root, privateId, "0".repeat(64)).ok);
    const beforeChange = (await readLedger<Record<string, unknown>>(borrowFile)).rows.length;
    const changeDependencies = { ...dependencies, gitReadRaw: async (dir: string, ...args: string[]) => {
      const result = await gitRaw(dir, ...args);
      slot.openedAt++;
      return result;
    } };
    const changeRoute = new Function(...Object.keys(changeDependencies), `${compiled}\nreturn contextBorrowRoute;`)(...Object.values(changeDependencies)) as typeof api.contextBorrowRoute;
    const changeUrl = new URL("http://fixture/api/self/context/repo-borrow");
    slot.harness = "codex";
    const changed = await changeRoute(new Request(changeUrl, { headers: { "x-fleet-self-token": slot.selfToken } }), changeUrl, "repo-borrow");
    check("context borrow: an occupant change during the external read refuses content and writes no borrow under the new occupant",
      changed.status === 409 && (await changed.json() as { refusal: string }).refusal === "occupant-changed"
      && (await readLedger<Record<string, unknown>>(borrowFile)).rows.length === beforeChange);
    const nested = "## Start\r\nGrüße.\r\n### Child\r\nKept.\r\n\r\n";
    const paragraph = "**Paragraph** starts here.\r\nKept paragraph.\r\n\r\n";
    const setext = "Setext title\r\n============\r\nKept title.\r\n## Child\r\nKept child.\r\n";
    writeFileSync(join(root, "sections.md"), `# Before\r\n${nested}# Higher\r\n\r\n${paragraph}#### Next\r\n\r\n${setext}# After\r\n\`\`\`md\r\n## Fake\r\n\`\`\`\r\nText mentions INLINE ONLY here.\r\n## End`);
    const codeTail = "const TARGET = [\n  1,\n];\nconst AFTER = 2;\n";
    writeFileSync(join(root, "symbols.ts"), `const BEFORE = 0;\n${codeTail}`);
    g("add", "sections.md", "symbols.ts"); g("commit", "-q", "-m", "section boundaries");
    const addPack = (id: string, sources: { path: string; anchor: string }[]) => own.contextPacks.push({ id, useWhen: "Read section fixture", sources });
    addPack("sections", [{ path: "sections.md", anchor: "## Start" }, { path: "sections.md", anchor: "**Paragraph**" },
      { path: "sections.md", anchor: "Setext title" }, { path: "sections.md", anchor: "## End" }]);
    addPack("fake-heading", [{ path: "sections.md", anchor: "## Fake" }]);
    addPack("inline-anchor", [{ path: "sections.md", anchor: "INLINE ONLY" }]);
    addPack("code-symbol", [{ path: "symbols.ts", anchor: "const TARGET =" }]);
    const boundaries = await borrow("sections");
    check("context borrow: heading sections retain children and stop before a higher heading with CRLF bytes intact",
      boundaries.status === 200 && boundaries.body.sources?.[0]?.content === nested);
    check("context borrow: a paragraph anchor stops before the next heading at any level",
      boundaries.body.sources?.[1]?.content === paragraph);
    check("context borrow: a Setext heading retains lower headings and stops before the next peer",
      boundaries.body.sources?.[2]?.content === setext);
    check("context borrow: an anchor on the last line yields that line without an invented newline",
      boundaries.body.sources?.[3]?.content === "## End");
    const boundaryLine = (await readLedger<Record<string, unknown>>(borrowFile)).rows.at(-1);
    const expectedSections = [nested, paragraph, setext, "## End"];
    check("context borrow: multiple anchors in one file record only the delivered bytes and each section hash",
      boundaryLine?.bytes === expectedSections.reduce((sum, value) => sum + Buffer.byteLength(value), 0)
      && JSON.stringify(boundaryLine.sources) === JSON.stringify(boundaries.body.sources?.map(({ content: _, ...rest }) => rest))
      && boundaries.body.sources?.every((item, index) => item.bytes === Buffer.byteLength(expectedSections[index]!)
        && item.sha256 === createHash("sha256").update(expectedSections[index]!).digest("hex")) === true);
    const fake = await borrow("fake-heading"), inline = await borrow("inline-anchor");
    check("context borrow: fenced and inline-only anchors are refused with no content or served bytes",
      [fake, inline].every((answer) => answer.status === 409 && answer.body.refusal === "source-anchor-missing" && !answer.body.sources)
      && (await readLedger<Record<string, unknown>>(borrowFile)).rows.slice(-2).every((row) => row.bytes === 0 && JSON.stringify(row.sources) === "[]"));
    const code = await borrow("code-symbol");
    check("context borrow: a non-Markdown symbol serves conservatively from its line to EOF, excluding earlier code",
      code.status === 200 && code.body.sources?.[0]?.content === codeTail);
    writeFileSync(join(root, "exact.md"), exactText);
    writeFileSync(join(root, "prefix.md"), prefixText);
    writeFileSync(join(root, "ambiguous.md"), ambiguousText);
    g("add", "exact.md", "prefix.md", "ambiguous.md"); g("commit", "-q", "-m", "anchor resolution");
    addPack("anchor-resolution", [{ path: "exact.md", anchor: "### Kern" }, { path: "prefix.md", anchor: "### Kern" }]);
    addPack("ambiguous-anchor", [{ path: "exact.md", anchor: "### Kern" }, { path: "ambiguous.md", anchor: "### Kern" }]);
    const anchors = await borrow("anchor-resolution");
    check("context borrow: exact and unique prefix anchors serve their selected sections at HEAD",
      anchors.status === 200 && anchors.body.sources?.[0]?.content === exactSection
      && anchors.body.sources?.[1]?.content === prefixSection);
    const ambiguous = await borrow("ambiguous-anchor");
    const ambiguousLine = (await readLedger<Record<string, unknown>>(borrowFile)).rows.at(-1);
    check("context borrow: ambiguous prefixes return named 409 without partial content or delivered bytes",
      ambiguous.status === 409 && ambiguous.body.refusal === "source-anchor-ambiguous" && !ambiguous.body.sources
      && ambiguousLine?.refusal === "source-anchor-ambiguous" && ambiguousLine.bytes === 0
      && ambiguousLine.borrowedAt === null && JSON.stringify(ambiguousLine.sources) === "[]");
    writeFileSync(join(root, "AGENTS.md"), readFileSync(join(sourceRoot, "AGENTS.md")));
    mkdirSync(join(root, "docs"));
    writeFileSync(join(root, "docs/verify-tiering.md"), readFileSync(join(sourceRoot, "docs/verify-tiering.md")));
    g("add", "AGENTS.md", "docs/verify-tiering.md"); g("commit", "-q", "-m", "real verify sources");
    const verify = await borrow("verify-e2e");
    const verifySources = verify.body.sources;
    const verifyLine = (await readLedger<Record<string, unknown>>(borrowFile)).rows.at(-1);
    check("context borrow: the real verify-e2e pack serves six named sections with their sorten below 40,000 bytes",
      verify.status === 200 && verifySources?.length === 6 && verifySources.reduce((sum, item) => sum + item.bytes, 0) < 40_000
      && JSON.stringify(verifySources.map(({ anchor, sorte }) => ({ anchor, sorte }))) === JSON.stringify([
        { anchor: "### Kern", sorte: "anleitung" }, { anchor: "### Lane", sorte: "anleitung" },
        { anchor: "### MAIN", sorte: "anleitung" }, { anchor: "### More", sorte: "anleitung" },
        { anchor: "### 6.0 gate-vs-audit — What each buys", sorte: "wissen" },
        { anchor: "### 6.0b proportion — Docs-only gate and audit", sorte: "wissen" },
      ]),
      `served bytes: ${verifySources?.reduce((sum, item) => sum + item.bytes, 0) ?? "unknown"}`);
    check("context borrow: verify-e2e's ledger contains exact section hashes and the sum of delivered bytes",
      verifyLine?.bytes === verifySources?.reduce((sum, item) => sum + item.bytes, 0)
      && verifySources?.every((item) => item.bytes === Buffer.byteLength(item.content)
        && item.sha256 === createHash("sha256").update(item.content).digest("hex")) === true
      && JSON.stringify(verifyLine?.sources) === JSON.stringify(verifySources?.map(({ content: _, ...rest }) => rest)));
  } finally { rmSync(root, { recursive: true, force: true }); }
}
