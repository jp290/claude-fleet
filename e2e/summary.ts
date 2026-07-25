// The ✨ summary agent behind its FLEET_SUMMARY_CMD stand-in: gather → spawn → parse → cache.
import { check, get, post } from "./harness";

export async function run(): Promise<void> {
  // --- ✨ summary agent (FLEET_SUMMARY_CMD points at a stand-in that answers in
  // claude -p's json envelope — tests the real gather→spawn→parse→cache pipeline) ---
  const sm0 = (await (await get("/api/slots/1/summary")).json()) as { cached: boolean; summary?: string };
  check("summary GET before any run → cache miss, no spawn", sm0.cached === false && sm0.summary === undefined);
  const sm1res = await post("/api/slots/1/summary", {});
  const sm1 = (await sm1res.json()) as { summary: string; openThreads: string[]; verification: string;
    cached: boolean; raw: boolean; head: string | null };
  check("summary POST runs the agent and parses strict JSON",
    sm1res.ok && sm1.summary === "fake summary of the session" && sm1.raw === false,
    JSON.stringify(sm1).slice(0, 140));
  check("summary carries openThreads + verification",
    sm1.openThreads.length === 1 && sm1.openThreads[0] === "thread-a" && sm1.verification === "none seen");
  check("summary pins the git state it ran on", typeof sm1.head === "string" && /^[0-9a-f]{40}$/.test(sm1.head ?? ""));
  check("summary first run is uncached", sm1.cached === false);
  const sm2 = (await (await post("/api/slots/1/summary", {})).json()) as { cached: boolean; summary: string };
  check("summary cache hit on unchanged git state", sm2.cached === true && sm2.summary === sm1.summary);
  const sm3 = (await (await get("/api/slots/1/summary")).json()) as { cached: boolean; stale: boolean };
  check("summary GET now serves the cache", sm3.cached === true && sm3.stale === false);
  check("summary rejects inactive slot", (await post("/api/slots/4/summary", {})).status === 400);
}
