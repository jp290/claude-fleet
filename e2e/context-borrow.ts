import { createHash, timingSafeEqual } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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
    g("init", "-q", "-b", "main"); g("config", "user.name", "e2e"); g("config", "user.email", "e2e@fleet");
    const content = "  # Borrow fixture\n## Section\nGrüße vom HEAD.\n## Portable operating contract\nFixture contract.\n\n";
    const hash = createHash("sha256").update(content).digest("hex");
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
      readPrivatePack, resolvePrivatePack, createHash, basename: (path: string) => path.split("/").pop(),
      repoRootOf: async (path: string) => path, integrationHead: async () => g("rev-parse", "HEAD"),
      dispatchSourceTree: async () => sourceTree, variantSourceOf: (row: unknown) => row,
      DISPATCH_CONTEXT_MODE: "mutating", DISPATCH_CONTEXT_TRIGGERS: ["always"], DISPATCH_CONTEXT_CAPABILITIES: [...CONTEXT_PACK_CAPABILITIES],
      CONTEXT_MANIFEST_PATH: ".fleet/context-packs.json", CONTEXT_MANIFEST_MAX_BYTES, CONTEXT_MANIFEST_MAX_SOURCE_BYTES: 4_194_304,
      gitRead: async (dir: string, ...args: string[]) => { const r = await gitRaw(dir, ...args); return { ...r, out: r.out.trim() }; },
      gitReadRaw: gitRaw, appendEventStrict, readLedger, CONTEXT_BORROW_FILE: borrowFile, CONTEXT_RECEIPT_FILE: receiptFile,
      MEMORY_RECEIPTS_MAX: 20, SERVER_BOOT_AT: 1, privatePackResolutions: new WeakMap(), KONZEPT_ROOT: null,
    };
    const functions = [fn("secretEq", auth), fn("resolveSelfPrincipal", auth), ...["sessionIdMatchOf", "boundProgramForMain", "waveRowsOf",
      "memoryScopeFor", "contextCatalogFor", "contextBorrowRoute", "memorySourcesView", "treeListingAt", "showAtHead", "repoManifestContextPlan",
      "declaredSourceHash", "privatePackResolutionOf", "contextReceiptSelections"].map((name) => fn(name))].join("\n");
    const refusal = source.slice(source.indexOf("const memoryRefusal ="), source.indexOf("async function memoryScopeFor"));
    const compiled = new Bun.Transpiler({ loader: "ts" }).transformSync(`${refusal}\n${functions}`);
    const api = new Function(...Object.keys(dependencies), `${compiled}\nreturn { contextBorrowRoute, memorySourcesView };`)(...Object.values(dependencies)) as {
      contextBorrowRoute: (req: Request, url: URL, id: string) => Promise<Response>;
      memorySourcesView: (s: unknown, scope: unknown) => Promise<{ declaredNow: { selected: { id: string; borrowedAt?: number }[] };
        deliveredThen: { receipts: { selected: { id: string; borrowedAt?: number }[] }[] }; readByAgent: string; borrowed: { total: number }; coverage: string }>;
    };
    type Answer = { status: number; body: { id?: string; refusal?: string; head?: string; borrowedAt?: number; sources?:
      { content: string; sha256: string; bytes: number }[] } };
    const borrow = async (id: string, query = "", token = slot.selfToken): Promise<Answer> => {
      const url = new URL(`http://fixture/api/self/context/${id}${query}`);
      const response = await api.contextBorrowRoute(new Request(url, { headers: { "x-fleet-self-token": token } }), url, id);
      return { status: response.status, body: await response.json() };
    };
    const first = await borrow("repo-borrow");
    check("context borrow: a repo ID serves exact UTF-8 bytes and SHA-256 at HEAD, never the dirty working tree",
      first.status === 200 && first.body.head === head && first.body.sources?.[0]?.content === content
      && first.body.sources[0].sha256 === hash && first.body.sources[0].bytes === Buffer.byteLength(content));
    const second = await borrow("repo-borrow");
    const ownRead = await borrow("own-borrow");
    const lines = (await readLedger<Record<string, unknown>>(borrowFile)).rows;
    check("context borrow: each successful request writes exactly one content-free line with exact occupant, task, Program, ID, hash and bytes",
      lines.length === 3 && lines.every((row) => row.slot === 1 && row.openedAt === 42 && row.taskId === "task" && row.programId === "own"
        && row.bytes === Buffer.byteLength(content) && row.status === 200 && typeof row.borrowedAt === "number"
        && JSON.stringify(row.sources).includes(hash) && !JSON.stringify(row).includes("Grüße"))
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
    check("context borrow: a Fleet seed ID uses the same HEAD content and ledger door",
      seedRead.status === 200 && seedRead.body.sources?.[0]?.content === content
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
  } finally { rmSync(root, { recursive: true, force: true }); }
}
