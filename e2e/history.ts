// Prompt history per slot, the global append-only prompt log and the /api/prompts directory
// served from it, plus the transcript and session-brief reads.
import { statSync } from "node:fs";
import { check, get, plogPath, plogRead } from "./harness";

export async function run(): Promise<void> {
  // --- prompt history: composed sends recorded, raw WS typing deliberately not ---
  const h2 = (await (await get("/api/slots/2/history")).json()) as { history: { text: string; ts: number }[] };
  check("history records composed send", h2.history.length === 1 && h2.history[0].text === "compose-box-to-slot-two", JSON.stringify(h2.history));
  check("history entry has timestamp", typeof h2.history[0]?.ts === "number" && h2.history[0].ts > 0);
  const h1 = (await (await get("/api/slots/1/history")).json()) as { history: unknown[] };
  check("raw typed input not recorded in history", h1.history.length === 0, `${h1.history.length} entries`);

  // --- global prompt log: every composed send from every surface, append-only,
  // survives slot close (slot 3 sent a prompt above and was then killed) ---
  const plog1 = await plogRead();
  check("prompt log records owner send with source 'owner'",
    plog1.some((e) => e.slot === 2 && e.source === "owner" && e.text === "compose-box-to-slot-two"), `${plog1.length} entries`);
  check("prompt log survives slot close", plog1.some((e) => e.slot === 3 && e.text.includes("__pwn=1")));
  check("prompt log ignores raw WS typing", !plog1.some((e) => e.text.includes("hello-fleet-typing")));
  check("prompt log entries carry ts + cwd", plog1.every((e) => typeof e.ts === "number" && typeof e.cwd === "string"));
  check("prompt log file is 600", (statSync(plogPath).mode & 0o777) === 0o600, (statSync(plogPath).mode & 0o777).toString(8));

  // --- /api/prompts: the global prompt directory served from that log, newest first ---
  const pd = (await (await get("/api/prompts")).json()) as { prompts: { ts: number; slot: number; text: string }[]; total: number };
  check("prompt directory returns all logged prompts", pd.prompts.length === plog1.length && pd.total === plog1.length,
    `${pd.prompts.length}/${plog1.length}`);
  check("prompt directory is newest-first", pd.prompts.every((e, i) => i === 0 || pd.prompts[i - 1].ts >= e.ts));
  check("prompt directory includes closed-slot prompts", pd.prompts.some((e) => e.slot === 3 && e.text.includes("__pwn=1")));
  const pdLim = (await (await get("/api/prompts?limit=1")).json()) as { prompts: unknown[]; total: number };
  check("prompt directory respects limit", pdLim.prompts.length === 1 && pdLim.total === pd.total);
  const pdQ = (await (await get("/api/prompts?q=compose-box")).json()) as
    { prompts: { text: string }[]; total: number; matched: number; malformed: number };
  check("prompt directory filters by q", pdQ.prompts.length >= 1 && pdQ.prompts.every((e) => e.text.includes("compose-box")));
  // `total` used to be the UNFILTERED line count reported next to a q-filtered list, so a search
  // that matched two rows still answered "total 4212" — indistinguishable from "capped at 300".
  // Three separate numbers now: the journal, the match set, and the returned window.
  check("prompt directory separates the journal total from the q match count",
    pdQ.total === pd.total && pdQ.matched === pdQ.prompts.length && pdQ.matched < pdQ.total,
    JSON.stringify({ total: pdQ.total, matched: pdQ.matched, rows: pdQ.prompts.length }));
  check("prompt directory reports malformed rows separately (0 on an intact journal)",
    pdQ.malformed === 0 && pd.total === plog1.length, `${pdQ.malformed} / ${pd.total} vs ${plog1.length}`);
  const pdNone = (await (await get("/api/prompts?q=zz-no-such-prompt-zz")).json()) as { prompts: unknown[] };
  check("prompt directory q with no hits is empty", pdNone.prompts.length === 0);

  // --- transcript view (slot 1 cwd is ~/claude-fleet, whose project dir has transcripts;
  // FLEET_CMD=true means no pinned session id, so this exercises the mtime fallback) ---
  const tr1 = await get("/api/slots/1/transcript");
  const tr1j = (await tr1.json()) as { entries: { role: string; blocks: unknown[] }[]; total: number; source: string | null };
  check("transcript endpoint returns entries", tr1.ok && tr1j.total > 0 && tr1j.entries.length > 0,
    `total=${tr1j.total} entries=${tr1j.entries.length} source=${tr1j.source}`);
  check("transcript entries are structured", tr1j.entries.every((e) => (e.role === "user" || e.role === "assistant") && e.blocks.length > 0));
  const tr2 = await get(`/api/slots/1/transcript?after=${tr1j.total}`);
  const tr2j = (await tr2.json()) as { entries: unknown[]; total: number };
  check("transcript incremental fetch returns nothing new", tr2.ok && tr2j.entries.length === 0 && tr2j.total >= tr1j.total, `total=${tr2j.total}`);
  check("transcript rejects inactive slot", (await get("/api/slots/4/transcript")).status === 400);

  // --- session brief (slot 1 cwd is ~/claude-fleet, a real git repo) ---
  const bf1 = await get("/api/slots/1/brief");
  const bf1j = (await bf1.json()) as { branch: string | null; worktree: unknown;
    files: string[]; shortstat: string; commits: { hash: string; ts: number; subject: string }[] };
  check("brief returns git facts for a repo slot", bf1.ok && typeof bf1j.branch === "string" && bf1j.branch.length > 0,
    `branch=${bf1j.branch}`);
  check("brief lists commits with hash+ts+subject", bf1j.commits.length > 0
    && bf1j.commits.every((c) => /^[0-9a-f]{7,}$/.test(c.hash) && c.ts > 0 && c.subject.length > 0),
    `commits=${bf1j.commits.length}`);
  check("brief caps commit list at 15", bf1j.commits.length <= 15);
  check("brief files is an array", Array.isArray(bf1j.files));
  check("brief rejects inactive slot", (await get("/api/slots/4/brief")).status === 400);
}
