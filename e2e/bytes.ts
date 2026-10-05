import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONVERSATION_ID, CONVERSATION_LINES, scratchInstance } from "../perf-probe";
import { perfRebuild, perfRebuilds, REBUILD_SURFACES } from "../src/perfmarks";

// Captured on 2026-10-05 at 256c7e5c; sessions recaptured on 2026-10-06 after path normalization,
// with unchanged server source. These literals are reviewed budgets, never re-derived from the
// tree under test. Bun.gzipSync is the compression used by server/transport.ts.
export const BYTE_BUDGETS = [
  { scenario: "app.js gzip", baseline: 360303, ceiling: 396334 },
  { scenario: "index.html raw", baseline: 342178, ceiling: 376396 },
  { scenario: "/api/sessions 16 slots, no events", baseline: 6190, ceiling: 6809 },
  { scenario: "transcript after=0, 24 fixed turns", baseline: 5921, ceiling: 6514 },
] as const;

export function enlargeBundle(file: string): { before: number; after: number } {
  const original = readFileSync(file);
  const before = Bun.gzipSync(original).length, target = Math.ceil(before * 1.15);
  let seed = 17;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const noise = Array.from({ length: before }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return alphabet[seed % alphabet.length];
  }).join("");
  const inflated = (n: number): Buffer => Buffer.concat([original, Buffer.from(`\n/*${noise.slice(0, n)}*/\n`)]);
  let lo = 0, hi = noise.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (Bun.gzipSync(new Uint8Array(inflated(mid))).length < target) lo = mid + 1; else hi = mid;
  }
  const mutated = inflated(lo); writeFileSync(file, mutated);
  return { before, after: Bun.gzipSync(new Uint8Array(mutated)).length };
}

type ByteCheck = (name: string, ok: boolean, detail?: string) => void;

export async function run(check: ByteCheck, inflateBundle = false): Promise<void> {
  const fx = await scratchInstance();
  try {
    const bundle = join(fx.dir, "public/app.js");
    if (inflateBundle) console.log("BUNDLE MUTATION", JSON.stringify(enlargeBundle(bundle)));
    const sessionsResponse = await fx.get("/api/sessions");
    const sessions = await sessionsResponse.json() as { slots: { cwd: string | null }[]; events?: unknown; tasks: unknown[] };
    const transcriptResponse = await fx.get("/api/slots/1/transcript?after=0");
    const transcriptRaw = await transcriptResponse.text();
    const transcript = JSON.parse(transcriptRaw) as { entries: { n: number; role: string; blocks: { t: string; text?: string }[] }[]; total: number; source: string | null };
    check("bytes: sessions fixture is exactly 16 slots, eight occupied, no tasks",
      sessionsResponse.ok && sessions.slots.length === 16 && sessions.slots.filter((s) => s.cwd).length === 8 && sessions.tasks.length === 0);
    check("bytes: after=0 reads all 24 fixed conversation turns from the pinned fixture",
      transcriptResponse.ok && transcript.total === 24 && transcript.entries.length === 24
      && transcript.source === `${CONVERSATION_ID}.jsonl`
      && transcript.entries.every((e, i) => e.n === i + 1 && e.role === (i % 2 ? "assistant" : "user")
        && e.blocks[0]?.text === (JSON.parse(CONVERSATION_LINES[i]!) as { message: { content: { text: string }[] } }).message.content[0]!.text));
    check("bytes: transcript contains no host scratch paths", !transcriptRaw.includes(fx.dir) && !transcriptRaw.includes(realpathSync(fx.dir)));
    delete sessions.events;
    // The scratch prefix has host-dependent length, including /private on macOS.
    let sessionsRaw = JSON.stringify(sessions);
    for (const prefix of [...new Set([fx.dir, realpathSync(fx.dir)])].sort((a, b) => b.length - a.length)) {
      sessionsRaw = sessionsRaw.replaceAll(prefix, "/fleet-byte-fixture");
    }
    const values = [Bun.gzipSync(readFileSync(bundle)).length, readFileSync(join(fx.dir, "public/index.html")).length,
      Buffer.byteLength(sessionsRaw), Buffer.byteLength(transcriptRaw)];
    const rows = BYTE_BUDGETS.map((b, i) => ({ ...b, value: values[i]!, difference: values[i]! - b.baseline }));
    const table = ["Sessions paths normalized: scratch prefixes → /fleet-byte-fixture; events excluded. Transcript source is the fixed filename.", "scenario | basis B | value B | difference B | ceiling B",
      ...rows.map((r) => `${r.scenario} | ${r.baseline} | ${r.value} | ${r.difference >= 0 ? "+" : ""}${r.difference} | ${r.ceiling}`)].join("\n");
    for (const row of rows) check(`bytes: ${row.scenario} stays under its fixed ceiling`, row.value <= row.ceiling, table);
    check("bytes: every ceiling is the captured baseline plus 10 percent rounded up",
      BYTE_BUDGETS.every((b) => b.ceiling === Math.ceil(b.baseline * 11 / 10)));
    for (const surface of REBUILD_SURFACES) {
      const before = perfRebuilds()[surface]; perfRebuild(surface);
      const single = perfRebuilds()[surface] - before;
      perfRebuild(surface); perfRebuild(surface);
      const doubled = perfRebuilds()[surface] - before - single;
      check(`perf rebuilds: ${surface} counts one and two calls exactly`, single === 1 && doubled === 2,
        `single=${single}, double=${doubled}`);
    }
    const expected = perfRebuilds().renderSlots;
    const copy = perfRebuilds(); copy.renderSlots = -1;
    check("perf rebuilds: a reader cannot mutate the counters", perfRebuilds().renderSlots === expected);
  } catch (error) { check("bytes: fixture measurement completed", false, String(error)); }
  finally { await fx.stop(); }
}

if (import.meta.main) {
  let failed = 0;
  await run((name, ok, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `\n${detail}` : ""}`);
    if (!ok) failed++;
  }, Bun.argv.includes("--inflate-bundle"));
  console.log(failed ? `${failed} FAILED` : "ALL PASS");
  if (failed) process.exitCode = 1;
}
