import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { CONVERSATION_ID, CONVERSATION_LINES, scratchInstance } from "../perf-probe";
import { perfRebuild, perfRebuilds, REBUILD_SURFACES } from "../src/perfmarks";

// Captured on 2026-10-05 at 256c7e5c; sessions recaptured on 2026-10-06 after path normalization,
// with unchanged server source. The two client rows were recaptured on 2026-10-10 at fd62bab1,
// after the lands of 15e946f3 (live lane view in src/board.ts) and b60f83c2 (composer drafts)
// outgrew the 2026-10-05 ceilings on main itself. The table is a report, not a gate: a value past
// its ceiling prints, it does not turn red. Bun.gzipSync is the compression used by server/transport.ts.
export const BYTE_BUDGETS = [
  { scenario: "app.js gzip", baseline: 396941, ceiling: 436636 },
  { scenario: "index.html raw", baseline: 376719, ceiling: 414391 },
  { scenario: "/api/sessions 16 slots, no events", baseline: 6190, ceiling: 6809 },
  { scenario: "transcript after=0, 24 fixed turns", baseline: 5921, ceiling: 6514 },
] as const;

type ByteCheck = (name: string, ok: boolean, detail?: string) => void;

export async function run(check: ByteCheck): Promise<void> {
  const fx = await scratchInstance();
  try {
    const bundle = join(fx.dir, "public/app.js");
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
    console.log(table);
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
  });
  console.log(failed ? `${failed} FAILED` : "ALL PASS");
  if (failed) process.exitCode = 1;
}
