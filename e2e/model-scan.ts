import { deepStrictEqual, strictEqual, match } from "node:assert";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanModels } from "../model-scan";
import { MODEL_REGISTER } from "../model-register";

export async function run(): Promise<void> {
  const home = await mkdtemp(join(tmpdir(), "fleet-model-scan-"));
  const registerBefore = await readFile(new URL("../model-register.ts", import.meta.url), "utf8");
  const codex = join(home, ".codex");
  const claude = join(home, ".claude/cache");
  const pi = join(home, ".config/claude-fleet/pi-zai-agent");
  await Promise.all([mkdir(codex, { recursive: true }), mkdir(claude, { recursive: true }), mkdir(pi, { recursive: true })]);
  const codexPath = join(codex, "models_cache.json");
  const piPath = join(pi, "models-store.json");
  const scan = () => scanModels({ home, env: {} });
  try {
    const cache = JSON.stringify({ fetched_at: "2026-10-03T10:00:00Z", identity: "SECRET-IDENTITY",
      models: [{ slug: "gpt-6.1-sol" }, { slug: "gpt-new" }, { slug: "gpt-new" }] });
    await writeFile(codexPath, cache);
    await writeFile(piPath, JSON.stringify({ zai: { checkedAt: 1234,
      models: [{ id: "glm-5.3", provider: "zai" }, { id: "glm-new" }] },
      other: { models: [{ id: "foreign" }] }, apiKey: "SECRET-KEY" }));
    const result = await scan();
    deepStrictEqual(result.harnesses.map((row) => row.harness), ["claude", "codex", "pi-zai"]);
    const [claudeResult, codexResult, piResult] = result.harnesses;
    strictEqual(claudeResult.status, "unknown");
    match(claudeResult.reason ?? "", /model-access.json: missing;/);
    match(claudeResult.reason ?? "", /model-capabilities.json: missing$/);
    deepStrictEqual([claudeResult.available, claudeResult.newlyAvailable, claudeResult.registeredButUnavailable], [null, null, null]);
    strictEqual(codexResult.status, "known");
    deepStrictEqual(codexResult.available, ["gpt-6.1-sol", "gpt-new"]);
    deepStrictEqual(codexResult.newlyAvailable, ["gpt-new"]);
    deepStrictEqual(codexResult.registeredButUnavailable, ["gpt-5.3-codex-spark", "gpt-5.5", "gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-6-astra", "gpt-6-luna", "gpt-6-sol"]);
    strictEqual(codexResult.cacheTime, "2026-10-03T10:00:00.000Z");
    deepStrictEqual(piResult.available, ["glm-5.3", "glm-new"]);
    deepStrictEqual(piResult.newlyAvailable, ["glm-new"]);
    deepStrictEqual(piResult.registeredButUnavailable, ["glm-5.3-flash"]);
    strictEqual(JSON.stringify(result).includes("SECRET"), false);
    strictEqual(await readFile(codexPath, "utf8"), cache);

    await rm(codexPath);
    await mkdir(codexPath);
    const unreadable = (await scan()).harnesses[1];
    strictEqual(unreadable.status, "unknown");
    strictEqual(unreadable.registeredButUnavailable, null);
    match(unreadable.reason ?? "", /read failed$/);
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
    strictEqual(empty.registeredButUnavailable?.length, 9);
    for (const invalid of [{ other: { models: [] } }, { zai: { models: [], checkedAt: 1234 } }, { zai: { models: [{ id: "glm-new" }] } }]) {
      await writeFile(piPath, JSON.stringify(invalid));
      const rejected = (await scan()).harnesses[2];
      strictEqual(rejected.status, "unknown");
      strictEqual(rejected.registeredButUnavailable, null);
    }

    await writeFile(join(claude, "model-access.json"), JSON.stringify({ version: 1,
      entries: { "SECRET-ACCOUNT": { "claude-new": { s: "ok", at: 1234 } } } }));
    const missingCapabilities = (await scan()).harnesses[0];
    strictEqual(missingCapabilities.status, "unknown");
    match(missingCapabilities.reason ?? "", /model-capabilities.json: missing$/);
    await writeFile(join(claude, "model-capabilities.json"), JSON.stringify({ timestamp: 1234,
      models: [{ id: "claude-new", max_input_tokens: 200000 }] }));
    const scoped = (await scan()).harnesses[0];
    strictEqual(scoped.status, "unknown");
    match(scoped.reason ?? "", /not a complete harness availability catalogue$/);
    strictEqual(JSON.stringify(scoped).includes("SECRET"), false);
    await writeFile(join(claude, "model-access.json"), '{}');
    strictEqual((await scan()).harnesses[0].reason, "Claude caches: unknown schema");

    const override = join(home, "override");
    await mkdir(override);
    await writeFile(join(override, "models_cache.json"), '{"models":[{"slug":"gpt-6.1-sol"}]}');
    await writeFile(piPath, '{"zai":{"models":[{"id":"glm-5.3"}],"checkedAt":1234}}');
    const redirected = await scanModels({ home: join(home, "unused"), env: {
      CODEX_HOME: override, CLAUDE_CONFIG_DIR: join(home, ".claude"), FLEET_PI_ZAI_AGENT_DIR: pi,
    } });
    deepStrictEqual(redirected.harnesses.map((row) => row.harness), ["claude", "codex", "pi-zai"]);
    deepStrictEqual(redirected.harnesses[1].available, ["gpt-6.1-sol"]);
    strictEqual(redirected.harnesses[0].reason, "Claude caches: unknown schema");
    deepStrictEqual(redirected.harnesses[2].available, ["glm-5.3"]);
    const subset = await scanModels({ home, env: {}, register: MODEL_REGISTER.filter((entry) => entry.harness === "codex") });
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
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  await run();
  console.log("ALL PASS");
}
