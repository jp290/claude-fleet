import { deepStrictEqual, strictEqual, match } from "node:assert";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanModels, makeModelScanTick, modelScanStateFrom, MODEL_SCAN_INTERVAL_MS } from "../model-scan";
import { type ModelEntry } from "../model-register";

const fixtureRegister: readonly ModelEntry[] = [
  { harness: "claude", id: "fixture-claude-present", status: "current" },
  { harness: "codex", id: "codex-present", status: "current" },
  { harness: "codex", id: "codex-absent", status: "current" },
  { harness: "codex", id: "codex-old", status: "superseded" },
  { harness: "pi-zai", id: "pi-present", status: "current" },
  { harness: "pi-zai", id: "pi-absent", status: "current" },
];

export async function run(check: (name: string, ok: boolean) => void = (name, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
}): Promise<void> {
  const home = await mkdtemp(join(tmpdir(), "fleet-model-scan-"));
  const registerBefore = await readFile(new URL("../model-register.ts", import.meta.url), "utf8");
  const codex = join(home, ".codex");
  const claude = join(home, ".claude/cache");
  const pi = join(home, ".config/claude-fleet/pi-zai-agent");
  await Promise.all([mkdir(codex, { recursive: true }), mkdir(claude, { recursive: true }), mkdir(pi, { recursive: true })]);
  const codexPath = join(codex, "models_cache.json");
  const piPath = join(pi, "models-store.json");
  let now = 100000000;
  const scan = () => scanModels({ home, env: {}, register: fixtureRegister, now });
  try {
    const cache = JSON.stringify({ fetched_at: "2026-10-03T10:00:00Z", identity: "SECRET-IDENTITY",
      models: [{ slug: "codex-present" }, { slug: "codex-new" }, { slug: "codex-new" }] });
    await writeFile(codexPath, cache);
    await writeFile(piPath, JSON.stringify({ zai: { checkedAt: 1234,
      models: [{ id: "pi-present", provider: "zai" }, { id: "pi-new" }] },
      other: { models: [{ id: "foreign" }] }, apiKey: "SECRET-KEY" }));
    const result = await scan();
    deepStrictEqual(result.harnesses.map((row) => row.harness), ["claude", "codex", "pi-zai"]);
    const [claudeResult, codexResult, piResult] = result.harnesses;
    strictEqual(claudeResult.status, "unknown");
    strictEqual(claudeResult.reason, "CLAUDE_CONFIG_DIR/cache/model-catalog/: missing or unreadable directory");
    deepStrictEqual([claudeResult.available, claudeResult.newlyAvailable, claudeResult.registeredButUnavailable], [null, null, null]);
    strictEqual(codexResult.status, "known");
    deepStrictEqual(codexResult.available, ["codex-new", "codex-present"]);
    deepStrictEqual(codexResult.newlyAvailable, ["codex-new"]);
    deepStrictEqual(codexResult.registeredButUnavailable, ["codex-absent", "codex-old"]);
    strictEqual(codexResult.cacheTime, "2026-10-03T10:00:00.000Z");
    deepStrictEqual(piResult.available, ["pi-new", "pi-present"]);
    deepStrictEqual(piResult.newlyAvailable, ["pi-new"]);
    deepStrictEqual(piResult.registeredButUnavailable, ["pi-absent"]);
    strictEqual(JSON.stringify(result).includes("SECRET"), false);
    strictEqual(await readFile(codexPath, "utf8"), cache);
    check("model-scan: exact fixture catalogue differences include superseded register entries", true);

    await rm(codexPath);
    await mkdir(codexPath);
    const unreadable = (await scan()).harnesses[1];
    strictEqual(unreadable.status, "unknown");
    strictEqual(unreadable.registeredButUnavailable, null);
    match(unreadable.reason ?? "", /read failed$/);
    check("model-scan: unreadable source stays unknown with null differences", true);
    await rm(codexPath, { recursive: true });
    for (const invalid of ["not json SECRET", "null", '{"models":[{"slug":"gpt-new"},{}]}', '{"models":[{"slug":"SECRET WITH SPACES"}]}']) {
      await writeFile(codexPath, invalid);
      const rejected = (await scan()).harnesses[1];
      strictEqual(rejected.status, "unknown");
      strictEqual(rejected.newlyAvailable, null);
      strictEqual((rejected.reason ?? "").includes("SECRET"), false);
    }
    await writeFile(codexPath, '{"models":[]}');
    const empty = (await scan()).harnesses[1];
    deepStrictEqual(empty.available, []);
    deepStrictEqual(empty.registeredButUnavailable, ["codex-absent", "codex-old", "codex-present"]);
    check("model-scan: malformed sources are unknown and a valid empty Codex cache is known", true);
    for (const invalid of [{ other: { models: [] } }, { zai: { models: [], checkedAt: 1234 } }, { zai: { models: [{ id: "glm-new" }] } }]) {
      await writeFile(piPath, JSON.stringify(invalid));
      const rejected = (await scan()).harnesses[2];
      strictEqual(rejected.status, "unknown");
      strictEqual(rejected.registeredButUnavailable, null);
    }
    check("model-scan: incomplete Pi cache never claims a known empty catalogue", true);

    await writeFile(join(claude, "model-access.json"), JSON.stringify({ version: 1,
      entries: { "SECRET-ACCOUNT": { "fixture-claude-new": { s: "ok", at: 1234 } } } }));
    const missingCapabilities = (await scan()).harnesses[0];
    strictEqual(missingCapabilities.status, "unknown");
    strictEqual(missingCapabilities.reason, claudeResult.reason);
    await writeFile(join(claude, "model-capabilities.json"), JSON.stringify({ timestamp: 1234,
      models: [{ id: "fixture-claude-new", max_input_tokens: 200000 }] }));
    const scoped = (await scan()).harnesses[0];
    strictEqual(scoped.status, "unknown");
    strictEqual(scoped.reason, claudeResult.reason);
    strictEqual(JSON.stringify(scoped).includes("SECRET"), false);
    await writeFile(join(claude, "model-access.json"), '{}');
    strictEqual((await scan()).harnesses[0].reason, claudeResult.reason);
    check("model-scan: scoped Claude caches stay unknown without exposing account fields", true);

    const catalogueDir = join(claude, "model-catalog");
    const cataloguePath = join(catalogueDir, "fixture-cc.json");
    await mkdir(catalogueDir);
    const catalogue = (models = ["fixture-claude-present", "fixture-claude-new", "fixture-claude-new"]) => ({
      version: 2, fetchedAt: now - 1000, staleAt: now + 1000,
      catalog: { surface: "cc", config: { id: "cc", models: models.map((id) => ({ id })) } },
    });
    await writeFile(join(catalogueDir, "published-other.json"), "not a local catalogue");
    await writeFile(join(catalogueDir, "fixture-chat.json"), "not cc");
    await writeFile(cataloguePath, JSON.stringify(catalogue()));
    const knownClaude = (await scan()).harnesses[0];
    strictEqual(knownClaude.status, "known");
    strictEqual(knownClaude.reason, null);
    strictEqual(knownClaude.cacheTime, now - 1000);
    deepStrictEqual(knownClaude.available, ["fixture-claude-new", "fixture-claude-present"]);
    deepStrictEqual(knownClaude.newlyAvailable, ["fixture-claude-new"]);
    deepStrictEqual(knownClaude.registeredButUnavailable, []);
    strictEqual(JSON.stringify(knownClaude).includes("fixture-cc.json"), false);
    check("model-scan: measured Claude v2 cc schema yields exact sorted model IDs", true);

    for (const invalid of ["broken", JSON.stringify({ ...catalogue(), version: 1 }),
      JSON.stringify(catalogue([])), JSON.stringify({ ...catalogue(), staleAt: now }),
      JSON.stringify({ ...catalogue(), fetchedAt: now + 500 }),
      JSON.stringify({ ...catalogue(), catalog: { surface: "chat", config: { id: "cc", models: [{ id: "foreign" }] } } })]) {
      await writeFile(cataloguePath, invalid);
      const rejected = (await scan()).harnesses[0];
      strictEqual(rejected.status, "unknown");
      deepStrictEqual([rejected.available, rejected.newlyAvailable, rejected.registeredButUnavailable], [null, null, null]);
    }
    await rm(cataloguePath);
    await mkdir(cataloguePath);
    strictEqual((await scan()).harnesses[0].status, "unknown");
    await rm(cataloguePath, { recursive: true });
    await writeFile(cataloguePath, JSON.stringify(catalogue()));
    const secondPath = join(catalogueDir, "second-cc.json");
    await writeFile(secondPath, JSON.stringify(catalogue(["fixture-claude-other"])));
    match((await scan()).harnesses[0].reason ?? "", /ambiguous cc catalogues$/);
    await rm(secondPath);
    check("model-scan: stale, malformed, unreadable and conflicting Claude catalogues remain unknown", true);

    const state = modelScanStateFrom(null);
    const sent: string[] = [];
    let scans = 0;
    let saves = 0;
    const tickOptions = { state, now: () => now,
      scan: async () => { scans++; return scan(); },
      send: async (message: string) => { sent.push(message); return true; },
      persist: async () => { saves++; },
    };
    const tick = makeModelScanTick(tickOptions);
    // t | event | exclusive owner: 0 first scan | tick; <24h reentry | none; 24h+ | next tick.
    await Promise.all([tick(), tick(), tick()]);
    strictEqual(scans, 1);
    strictEqual(sent.length, 1);
    strictEqual(sent[0].includes("\n"), false);
    match(sent[0], /claude newlyAvailable=\["fixture-claude-new"\]/);
    strictEqual(state.lastScanAt, now);
    deepStrictEqual(state.reported.claude, { newlyAvailable: ["fixture-claude-new"], registeredButUnavailable: [] });
    const restored = modelScanStateFrom(JSON.parse(JSON.stringify(state)) as unknown);
    const restart = makeModelScanTick({ ...tickOptions, state: restored });
    now += MODEL_SCAN_INTERVAL_MS - 1;
    await restart();
    strictEqual(scans, 1);
    now++;
    await writeFile(cataloguePath, JSON.stringify(catalogue()));
    await restart();
    strictEqual(scans, 2);
    strictEqual(sent.length, 1);
    check("model-scan tick: change -> exactly one line, unchanged -> zero, 24h bound survives restart", true);

    now += MODEL_SCAN_INTERVAL_MS;
    await rm(cataloguePath);
    await mkdir(cataloguePath);
    await restart();
    strictEqual(sent.length, 1);
    deepStrictEqual(restored.reported.claude, state.reported.claude);
    now += MODEL_SCAN_INTERVAL_MS;
    await rm(cataloguePath, { recursive: true });
    await writeFile(cataloguePath, JSON.stringify(catalogue()));
    await restart();
    strictEqual(sent.length, 1);
    now += MODEL_SCAN_INTERVAL_MS;
    await writeFile(cataloguePath, JSON.stringify(catalogue(["fixture-claude-present"])));
    await restart();
    strictEqual(sent.length, 2);
    strictEqual(sent[1], 'Modell-Vorschlag (lokaler Cache; Register unveraendert): claude newlyAvailable=[] registeredButUnavailable=[]');
    strictEqual(scans, 5);
    strictEqual(saves, 10);
    check("model-scan tick: unreadable -> no false message; recovery unchanged -> zero; resolved difference -> one", true);

    const undelivered = modelScanStateFrom(null);
    let attempts = 0;
    const refusal = makeModelScanTick({ ...tickOptions, state: undelivered,
      send: async () => { attempts++; return false; } });
    await refusal();
    strictEqual(attempts, 1);
    strictEqual(undelivered.reported.codex, undefined);
    await refusal();
    strictEqual(attempts, 1);
    now += MODEL_SCAN_INTERVAL_MS;
    await writeFile(cataloguePath, JSON.stringify(catalogue(["fixture-claude-present"])));
    await refusal();
    strictEqual(attempts, 2);
    const emptyState = modelScanStateFrom(null);
    const noDiff = makeModelScanTick({ ...tickOptions, state: emptyState,
      scan: async () => ({ harnesses: [{ ...knownClaude, newlyAvailable: [], registeredButUnavailable: [] }] }),
      send: async () => { throw new Error("clean initial scan must remain silent"); } });
    await noDiff();
    deepStrictEqual(emptyState.reported.claude, { newlyAvailable: [], registeredButUnavailable: [] });
    const rejectedState = modelScanStateFrom({ lastScanAt: "bad", reported: { claude: { newlyAvailable: ["bad id"], registeredButUnavailable: [] } } });
    deepStrictEqual(rejectedState, { lastScanAt: null, reported: {} });
    check("model-scan tick: refused delivery is not recorded, initial clean scan is silent, malformed state is rejected", true);

    const server = (await readFile(new URL("../server.ts", import.meta.url), "utf8"))
      .split("\n").filter((line) => !/^\s*\/\//.test(line)).join("\n");
    match(server, /async function tickAutos\(\): Promise<void> \{[\s\S]*?void tickModelScan\(\)/);
    match(server, /modelScan: modelScanState,/);
    match(server, /Object.assign\(modelScanState, modelScanStateFrom\(/);
    const wiring = server.slice(server.indexOf("const tickModelScan ="), server.indexOf("function stateSnapshot()"));
    match(wiring, /scan: \(\) => scanModels\(\), persist: saveStateNow/);
    match(wiring, /path: "fleet-event", address: \{ kind: "orchestrator" \}/);
    check("model-scan tick: existing server tick persists scan state and uses the orchestrator role delivery", true);

    const override = join(home, "override");
    await mkdir(override);
    await writeFile(join(override, "models_cache.json"), '{"models":[{"slug":"codex-present"}]}');
    await writeFile(piPath, '{"zai":{"models":[{"id":"pi-present"}],"checkedAt":1234}}');
    const redirected = await scanModels({ home: join(home, "unused"), env: {
      CODEX_HOME: override, CLAUDE_CONFIG_DIR: join(home, ".claude"), FLEET_PI_ZAI_AGENT_DIR: pi,
    } });
    deepStrictEqual(redirected.harnesses.map((row) => row.harness), ["claude", "codex", "pi-zai"]);
    deepStrictEqual(redirected.harnesses[1].available, ["codex-present"]);
    strictEqual(redirected.harnesses[0].status, "unknown");
    match(redirected.harnesses[0].reason ?? "", /stale cc catalogue$/);
    deepStrictEqual(redirected.harnesses[2].available, ["pi-present"]);
    const subset = await scanModels({ home, env: {}, register: fixtureRegister.filter((entry) => entry.harness === "codex") });
    deepStrictEqual(subset.harnesses.map((row) => row.harness), ["codex"]);
    const cliEnv = { ...process.env, CODEX_HOME: override, CLAUDE_CONFIG_DIR: join(home, ".claude"), FLEET_PI_ZAI_AGENT_DIR: pi };
    const cli = Bun.spawn([process.execPath, join(import.meta.dir, "../model-scan.ts"), "--json"],
      { env: cliEnv, stdout: "pipe", stderr: "pipe" });
    const cliOutput: unknown = await new Response(cli.stdout).json();
    strictEqual(await cli.exited, 0);
    deepStrictEqual(cliOutput, redirected);
    const rejectedCli = Bun.spawn([process.execPath, join(import.meta.dir, "../model-scan.ts"), "--update"],
      { env: cliEnv, stdout: "pipe", stderr: "pipe" });
    strictEqual(await rejectedCli.exited, 1);
    strictEqual(await new Response(rejectedCli.stdout).text(), "");
    strictEqual(await new Response(rejectedCli.stderr).text(), "Usage: bun model-scan.ts [--json]\n");
    strictEqual(await readFile(new URL("../model-register.ts", import.meta.url), "utf8"), registerBefore);
    check("model-scan: CLI uses fixture overrides, rejects updates and preserves the register", true);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  await run();
  console.log("ALL PASS");
}
