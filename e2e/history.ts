// Prompt history per slot, the global append-only prompt log and the /api/prompts directory
// served from it, plus the transcript and session-brief reads.
import { appendFileSync, existsSync, statSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { BASE, check, get, post, plogPath, plogRead, ROOT, REPO, restartSrv, stopSrv, until, UntilTimeout } from "./harness";
import { WORKER_CONTRACTS } from "../src/protocol";
import { entityMatches, mdInto, type MdEntityKind } from "../src/md";
import { ASK_MAX, askTerminal, transcriptBinding, type NativeTranscript, type ReadSeat } from "../server/conversation-read";

// Runs under the claude-gate harness, not run() below: the main history suite deliberately uses
// FLEET_CMD=true and therefore has no pinned session identity. Keeping the probe in this family
// still matters — this is a transcript-selection regression, while the claude harness supplies
// the one prerequisite the ordinary suite structurally cannot: a real --session-id pin.
export async function runFreshPinnedTranscriptIsolation(slot: number): Promise<void> {
  const cwd = `${tmpdir()}/fleet-e2e-fresh-transcript-${process.pid}`;
  const dir = `${process.env.HOME}/.claude/projects/${cwd.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const foreign = "ended-foreign-session.jsonl";
  const line = `${JSON.stringify({
    type: "assistant", cwd, timestamp: new Date(0).toISOString(),
    message: { content: [{ type: "text", text: "content from the ENDED foreign session" }] },
  })}\n`;
  let fixtureReady = false;
  let fixtureDetail = `dir=${dir}`;
  let foreignMtime = 0;
  try {
    mkdirSync(cwd, { recursive: true });
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${foreign}`, line);
    foreignMtime = statSync(`${dir}/${foreign}`).mtimeMs;
    fixtureReady = readdirSync(dir).includes(foreign);
  } catch (e) {
    fixtureDetail = e instanceof Error ? e.message : String(e);
  }
  if (fixtureReady) await Bun.sleep(20); // make "older than this pane" an observed ordering
  const openAt = Date.now();
  const fixtureValid = fixtureReady && foreignMtime < openAt;
  check("fresh-transcript fixture: an older foreign .jsonl exists in this cwd before the pane opens",
    fixtureValid, `${fixtureDetail} mtime=${foreignMtime} openAt=${openAt}`);
  if (!fixtureValid) {
    rmSync(dir, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
    return;
  }

  let opened = false;
  try {
    const res = await post(`/api/slots/${slot}/open`, { cwd });
    opened = res.ok;
    check("fresh-transcript fixture: a fresh claude pane opens on the contaminated cwd",
      opened, `${res.status} ${JSON.stringify(await res.clone().json().catch(() => null))}`);
    if (!opened) return;

    let pin: string | null = null;
    for (let i = 0; i < 40; i++) {
      try {
        const state = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
          { slots?: Record<string, { sessionId?: string | null }> };
        pin = state.slots?.[String(slot)]?.sessionId ?? null;
      } catch { pin = null; }
      if (pin) break;
      await Bun.sleep(100);
    }
    check("fresh-transcript fixture: the new pane has its own pinned session identity",
      !!pin, `slot=${slot} pin=${pin}`);

    if (opened && pin) {
      const payload = (await (await get(`/api/slots/${slot}/transcript`)).json()) as
        { source: string | null; total: number };
      // Before the new claude has written <pin>.jsonl, absence is the only identity-preserving
      // answer. Its own file is also valid if the real agent wins the race; the ended file never is.
      check("a fresh pinned pane never receives an older ended session's conversation",
        payload.source === null || payload.source === `${pin}.jsonl`,
        `source=${payload.source} pin=${pin} total=${payload.total}`);
    }
  } finally {
    if (opened) await post(`/api/slots/${slot}/kill`, {});
    rmSync(dir, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
}

export async function runHistoryProvenance(root = ROOT, clientRoot = dirname(realpathSync(`${ROOT}/node_modules`))): Promise<void> {
  const server = readFileSync(`${root}/server.ts`, "utf8").replace(/^\s*\/\/.*$/gm, "");
  const writes = [...server.matchAll(/(\w+)\.history = \[\.\.\.\1\.history, (\{[^\n]+\})\]\.slice\(-MAX_HISTORY\);/g)];
  const count = [...server.matchAll(/\.history\s*=\s*\[\s*\.\.\./g)].length;
  const errors: string[] = [];
  for (const [index, write] of writes.entries()) {
    const entryCode = new Bun.Transpiler({ loader: "ts" }).transformSync(`const entry = ${write[2]};`);
    const make = new Function("fixture", `with (fixture) { ${entryCode} return entry; }`) as
      (fixture: Record<string, unknown>) => { text: string; ts: number; source?: string };
    for (const text of ["owner input", "[fleet-zustellung · test] routed text"]) {
      const entry = make({ text, t: text, p: { text }, body: { text }, debt: { brief: text }, a: { text },
        brief: text, line: text, message: text, prompt: text, deliveredBrief: text, delivered: text,
        rendered: { text }, ts: 1, sentAt: 1, at: 1, now: 1, deliveredAt: 1, Date: { now: () => 1 } });
      const ownerInput = /text: (t|p\.text|body\.text),/.test(write[2]);
      const expected = ownerInput && !text.startsWith("[fleet") ? "owner" : "fleet";
      if (entry.source !== expected) errors.push(`write ${index + 1}: ${entry.source ?? "missing"} != ${expected}`);
    }
  }
  check("history provenance: every append assigns owner/fleet by text origin, including routed /send",
    count > 0 && writes.length === count && errors.length === 0,
    `${writes.length}/${count} writers; ${errors.join("; ") || "all origins match"}`);

  const client = readFileSync(`${clientRoot}/src/client.ts`, "utf8");
  const drafts = readFileSync(`${clientRoot}/src/drafts.ts`, "utf8");
  const cycle = /async function cycleHist\(dir: number\) \{[\s\S]*?\n\}/.exec(client)?.[0];
  const row = /function histRow\([^\n]*\)[:\w ]* \{[\s\S]*?\n\}/.exec(client)?.[0];
  const source = /export function historySource\([^\n]*\)[:"\w |]* \{[\s\S]*?\n\}/.exec(drafts)?.[0];
  const box = { value: "", selectionStart: 0, selectionEnd: 0, focus() {} };
  type Node = { textContent: string; title: string; children: Node[]; onclick?: () => void;
    append(...nodes: Node[]): void; appendChild(node: Node): void };
  const el = (_tag: string, _cls: string, text = ""): Node => ({ textContent: text, title: "", children: [],
    append(...nodes) { this.children.push(...nodes); }, appendChild(node) { this.children.push(node); } });
  const entries = [{ text: "first owner", ts: 1, source: "owner" }, { text: "fleet body", ts: 2, source: "fleet" },
    { text: "unattributed legacy", ts: 3 }, { text: "[fleet] old delivery", ts: 4 },
    { text: "latest owner", ts: 5, source: "owner" }];
  let issue = "", recalled: string[] = [], protectedRows = false, legacy = false;
  try {
    if (!cycle || !row) throw new Error("cycleHist/histRow source missing");
    const code = new Bun.Transpiler({ loader: "ts" }).transformSync(
      `${source?.replace("export ", "") ?? ""}\nlet focused=0; const panes=[{slot:2}]; let cyc=null;\n${cycle}\n${row}`);
    const f = new Function("ta", "fetchHistory", "el", "updateChips", "closeHist", "copyText",
      `${code}\nreturn { cycleHist, histRow, origin: typeof historySource === 'function' ? historySource : null };`)(
      box, async () => entries, el, () => {}, () => {}, () => {}) as {
        cycleHist(dir: number): Promise<void>; histRow(text: string, meta: string, source?: string): Node;
        origin: ((entry: { text: string; source?: string }) => string) | null };
    for (const dir of [-1, -1, -1, 1, 1]) { await f.cycleHist(dir); recalled.push(box.value); }
    box.value = "saved draft";
    protectedRows = true;
    for (const entry of entries.slice(1, 4)) {
      const row = f.histRow(entry.text, "timestamp", entry.source);
      row.onclick?.();
      protectedRows &&= box.value === "saved draft" && row.children[1].textContent.includes(
        entry.text === "unattributed legacy" ? "unknown" : "fleet");
    }
    f.histRow("clicked owner", "timestamp", "owner").onclick?.();
    protectedRows &&= box.value === "clicked owner";
    legacy = f.origin?.({ text: "old owner-like text" }) === "unknown"
      && f.origin?.({ text: "[fleet] old delivery" }) === "fleet";
  } catch (e) { issue = e instanceof Error ? e.message : String(e); }
  check("history recall: ArrowUp and list load owner only; fleet/unknown stay labelled and out of composer",
    recalled.join("|") === "latest owner|first owner|first owner|latest owner|" && protectedRows && legacy,
    issue || `recall=${JSON.stringify(recalled)} protectedRows=${protectedRows} legacy=${legacy}`);
}

export async function run(): Promise<void> {
  await runHistoryProvenance();
  // --- prompt history: composed sends recorded, raw WS typing deliberately not ---
  const h2 = (await (await get("/api/slots/2/history")).json()) as { history: { text: string; ts: number; source?: string }[] };
  check("history records composed send", h2.history.length === 1 && h2.history[0].text === "compose-box-to-slot-two", JSON.stringify(h2.history));
  check("history API identifies a composed owner send", h2.history[0]?.source === "owner", JSON.stringify(h2.history));
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
  {
    const fixtureDir = mkdtempSync(`${tmpdir()}/fleet-e2e-plog-`);
    const fixture = `${fixtureDir}/prompts.jsonl`;
    const row = (ts: number, text: string) => JSON.stringify({ ts, slot: 1, cwd: null, label: null, source: "owner", text });
    let tailRows: Awaited<ReturnType<typeof plogRead>> = [];
    let tailError = "";
    let middleThrew = false;
    try {
      writeFileSync(fixture, `${row(1, "first")}\n${row(2, "second")}\n{"ts":3,"text":"unterminated`);
      try { tailRows = await plogRead(fixture); }
      catch (e) { tailError = e instanceof Error ? e.message : String(e); }
      writeFileSync(fixture, `${row(1, "first")}\n{"ts":\n${row(2, "second")}\n`);
      try { await plogRead(fixture); }
      catch { middleThrew = true; }
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
    const tailOk = tailError === "" && tailRows.map((entry) => entry.text).join(",") === "first,second";
    check("prompt log reader ignores only a torn final line",
      tailOk && middleThrew,
      !tailOk ? `torn tail: ${tailError || tailRows.map((entry) => entry.text).join(",")}`
        : !middleThrew ? "middle corruption did not throw" : "");
  }

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

  // --- transcript view. FLEET_CMD=true means no pinned session id, so this exercises the mtime
  // fallback. It used to read slot 1 (cwd ~/claude-fleet) and therefore asserted over WHATEVER
  // conversations the person running the suite happened to have had in that checkout — an
  // unstated precondition of the machine, not a fixture. On a box where nobody has ever run
  // claude in ~/claude-fleet the endpoint correctly answers `total=0` and this read as a product
  // regression (measured 2026-08-30 on the Linux workhorse). The rows below now plant the two
  // entries they assert on, in a throwaway cwd of this run's own, and clean up after themselves —
  // the same shape as the background-mark fixture below, and for the same reason. ---
  {
    const trCwd = `${tmpdir()}/fleet-e2e-transcript-${process.pid}`;
    const trProj = `${process.env.HOME}/.claude/projects/${trCwd.replace(/[^a-zA-Z0-9]/g, "-")}`;
    mkdirSync(trCwd, { recursive: true });
    mkdirSync(trProj, { recursive: true });
    // `cwd` is what proves the file belongs to this slot — transcriptFile's fallback refuses a
    // file that cannot show it (see the slug-collision block below)
    const trLine = (role: "user" | "assistant", text: string) =>
      `${JSON.stringify({ type: role, cwd: trCwd, timestamp: new Date(0).toISOString(), message: { content: [{ type: "text", text }] } })}\n`;
    writeFileSync(`${trProj}/own.jsonl`, `${trLine("user", "what does this slot say")}${trLine("assistant", "a planted answer")}`);
    const trFree = ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
      .slots.filter((s) => s.cwd === null).map((s) => s.id).pop();
    const trOpened = trFree !== undefined && (await post(`/api/slots/${trFree}/open`, { cwd: trCwd })).ok;
    check("transcript fixture: a free slot opens on a throwaway cwd carrying two planted entries",
      trOpened, `slot=${trFree}`);
    if (trOpened) {
      const tr1 = await get(`/api/slots/${trFree}/transcript`);
      const tr1j = (await tr1.json()) as { entries: { role: string; blocks: unknown[] }[]; total: number; source: string | null };
      check("transcript endpoint returns entries", tr1.ok && tr1j.total > 0 && tr1j.entries.length > 0,
        `total=${tr1j.total} entries=${tr1j.entries.length} source=${tr1j.source}`);
      check("transcript entries are structured", tr1j.entries.every((e) => (e.role === "user" || e.role === "assistant") && e.blocks.length > 0));
      const tr2 = await get(`/api/slots/${trFree}/transcript?after=${tr1j.total}`);
      const tr2j = (await tr2.json()) as { entries: unknown[]; total: number };
      // `total` EQUAL, not `>=`: nothing was appended, so a total that grew with empty entries is
      // the frozen-reader shape (lines counted, never delivered) and must not pass
      check("transcript incremental fetch returns nothing new", tr2.ok && tr2j.entries.length === 0 && tr2j.total === tr1j.total,
        `total=${tr2j.total} vs ${tr1j.total} entries=${tr2j.entries.length}`);
      // the other half: an incremental fetch after a real append must deliver exactly the appended
      // lines, numbered absolutely — the only fetch above had nothing to deliver, so a reader that
      // stopped after its first poll passed it
      appendFileSync(`${trProj}/own.jsonl`, `${trLine("user", "a follow-up question")}${trLine("assistant", "a follow-up answer")}`);
      const tr3 = await get(`/api/slots/${trFree}/transcript?after=${tr1j.total}`);
      const tr3j = (await tr3.json()) as { entries: { n: number; role: string; blocks: { text: string }[] }[]; total: number };
      check("transcript incremental fetch after an append returns exactly the appended entries",
        tr3.ok && tr3j.total === tr1j.total + 2
          && JSON.stringify(tr3j.entries.map((e) => [e.n, e.role, e.blocks.map((b) => b.text).join("")]))
            === JSON.stringify([[tr1j.total + 1, "user", "a follow-up question"], [tr1j.total + 2, "assistant", "a follow-up answer"]]),
        `total=${tr3j.total} vs ${tr1j.total}+2 entries=${JSON.stringify(tr3j.entries).slice(0, 300)}`);
      // the composer's effort switch reads the level the newest request ran at from the same line
      // as its model (Claude Code writes `effort` beside message.model); a model that takes no
      // effort (Haiku 4.5 writes none) must come back null — "default", never a guessed level
      const trModelLine = (model: string, effort?: string) => `${JSON.stringify({ type: "assistant", cwd: trCwd,
        timestamp: new Date(0).toISOString(), ...(effort ? { effort } : {}), message: { model, content: [{ type: "text", text: "x" }] } })}\n`;
      appendFileSync(`${trProj}/own.jsonl`, trModelLine("claude-opus-5", "xhigh"));
      const tr4j = (await (await get(`/api/slots/${trFree}/transcript?after=${tr3j.total}`)).json()) as { model?: string | null; effort?: string | null };
      appendFileSync(`${trProj}/own.jsonl`, trModelLine("claude-haiku-4-5-20251001"));
      const tr5j = (await (await get(`/api/slots/${trFree}/transcript?after=${tr3j.total}`)).json()) as { model?: string | null; effort?: string | null };
      check("transcript payload: model and effort come from the newest assistant line; a line without effort gives null, not the previous level",
        tr4j.model === "claude-opus-5" && tr4j.effort === "xhigh" && tr5j.model === "claude-haiku-4-5-20251001" && tr5j.effort === null,
        JSON.stringify([tr4j.model, tr4j.effort, tr5j.model, tr5j.effort]));
      // --- a message typed WHILE a turn runs: claude code does not write a user line for it — it
      // queues an attachment/queued_command row (measured on the live orchestrator transcript
      // daccbb0e, 2026-09-21: outer row type "attachment", commandMode "prompt", the text in
      // .attachment.prompt, timestamp on the row AND inside the attachment, no isMeta). viewEntry
      // let that fall out silently, so the owner's own words vanished from the chat view. The
      // fixture holds BOTH shapes the transcript can carry — the queued attachment and, per the
      // same source_uuid, the type:user turn the consumed queue can additionally record — plus
      // the two attachment kinds that must stay folded (a task-notification queue and a
      // hook_success, both measured shapes). ---
      const trQBase = ((await (await get(`/api/slots/${trFree}/transcript`)).json()) as { total: number }).total;
      const TQ = "2026-09-21T17:00:35.396Z";
      // the paste envelope the chat-view composer puts around every send (client.ts#PASTED_RE) —
      // a queued chat-view prompt carries it too (measured, orchestrator note on daccbb0e), and
      // the queued path must hand it to the client byte-for-byte like a type:user turn does
      const PASTED = `<pasted_content id="p-1">\npasted from the chat view mid-turn\n</pasted_content id="p-1">`;
      const attLine = (att: Record<string, unknown>) => `${JSON.stringify({
        isSidechain: false, cwd: trCwd, userType: "external", type: "attachment", timestamp: TQ,
        attachment: att })}\n`;
      const queuedDupLine = `${JSON.stringify({ isSidechain: false, cwd: trCwd, type: "user",
        timestamp: "2026-09-21T17:02:00.000Z", source_uuid: "q-src-dup-1",
        message: { role: "user", content: [{ type: "text", text: "typed during the turn" }] } })}\n`;
      const pastedUserLine = `${JSON.stringify({ isSidechain: false, cwd: trCwd, type: "user",
        timestamp: "2026-09-21T17:02:01.000Z",
        message: { role: "user", content: [{ type: "text", text: PASTED }] } })}\n`;
      appendFileSync(`${trProj}/own.jsonl`,
        trLine("assistant", "before the queue")
        + attLine({ type: "queued_command", prompt: "typed during the turn", source_uuid: "q-src-dup-1",
          commandMode: "prompt", origin: { kind: "human" }, humanTurn: true, timestamp: TQ })
        + attLine({ type: "queued_command", prompt: PASTED, source_uuid: "q-src-paste",
          commandMode: "prompt", origin: { kind: "human" }, humanTurn: true, timestamp: TQ })
        + attLine({ type: "queued_command", prompt: "<task-notification>\n<task-id>t</task-id>\n</task-notification>",
          source_uuid: "q-src-tn", commandMode: "task-notification", timestamp: TQ })
        + attLine({ type: "hook_success", hookName: "PreToolUse:Bash", toolUseID: "t1", hookEvent: "PreToolUse",
          command: "ls", stdout: "a.txt", stderr: "", exitCode: 0, durationMs: 3 })
        + trLine("assistant", "the turn continued")
        + queuedDupLine + pastedUserLine);
      const trQ = (await (await get(`/api/slots/${trFree}/transcript?after=${trQBase}`)).json()) as
        { entries: { n: number; role: string; ts: string | null; blocks: { t: string; text: string }[] }[]; total: number };
      check("transcript: a message typed DURING a turn (queued_command attachment) renders as the owner's message at its place",
        JSON.stringify(trQ.entries.map((e) => [e.role, ...e.blocks.map((b) => b.text)]))
          === JSON.stringify([["assistant", "before the queue"], ["user", "typed during the turn"],
            ["user", PASTED], ["assistant", "the turn continued"], ["user", PASTED]]),
        JSON.stringify(trQ.entries));
      check("transcript: the queued owner message is stamped with the moment it was queued, not left undated",
        trQ.entries.find((e) => e.blocks[0]?.text === "typed during the turn")?.ts === TQ,
        JSON.stringify(trQ.entries.map((e) => e.ts)));
      check("transcript: a queued chat-view paste arrives byte-for-byte like the same envelope on a type:user turn (one code path, client unwraps)",
        JSON.stringify(trQ.entries.filter((e) => e.blocks[0]?.text === PASTED).map((e) => e.blocks))
          === JSON.stringify([[{ t: "text", text: PASTED }], [{ t: "text", text: PASTED }]]),
        JSON.stringify(trQ.entries.filter((e) => e.blocks[0]?.text.includes("pasted_content"))));
      check("transcript: the same queued text also recorded as its own type:user turn (same source_uuid) shows once, not twice",
        trQ.entries.filter((e) => e.blocks.some((b) => b.text.includes("typed during the turn"))).length === 1,
        JSON.stringify(trQ.entries.map((e) => e.blocks.map((b) => b.text))));
      await post(`/api/slots/${trFree}/kill`, {});
    }
    rmSync(trProj, { recursive: true, force: true }); // it lives outside the repo — do not leave it
    rmSync(trCwd, { recursive: true, force: true });
  }
  check("transcript rejects inactive slot", (await get("/api/slots/4/transcript")).status === 400);

  // --- the CLASSIFICATION: a background worker's transcript is never served as a slot's own
  // conversation. Every throwaway claude this fleet spawns writes its JSONL into the SAME
  // ~/.claude/projects/<cwd> directory as the slot it ran for, so the mtime fallback above would
  // hand the board a resolver's or a digest's prompt as "your conversation". The live-sid set that
  // would otherwise catch it is process memory and is empty after any restart; the mark in the
  // prompt text is then the only handle left. Six of the eight workers had no mark at all until
  // WORKER_CONTRACTS existed, so this runs ONCE PER CONTRACT, driven off that table: a worker added
  // without a mark cannot pass here, and neither can a mark that has fallen out of its prompt.
  // Deliberately through the ROUTE, on a throwaway cwd of this run's own — asserting on `source`
  // (the filename the server chose) rather than on content, because that is the classification
  // itself and not a proxy for it.
  {
    const markCwd = `${tmpdir()}/fleet-e2e-marks-${process.pid}`;
    const markProj = `${process.env.HOME}/.claude/projects/${markCwd.replace(/[^a-zA-Z0-9]/g, "-")}`;
    mkdirSync(markCwd, { recursive: true });
    mkdirSync(markProj, { recursive: true });
    const free = ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
      .slots.filter((s) => s.cwd === null).map((s) => s.id).pop();
    const opened = free !== undefined && (await post(`/api/slots/${free}/open`, { cwd: markCwd })).ok;
    check("background-mark fixture: a free slot opens on a throwaway cwd", opened, `slot=${free}`);
    if (opened) {
      // `cwd` is not decoration: a real claude transcript records the cwd it ran in, and
      // transcriptFile's fallback now REQUIRES it to prove a file belongs to this slot (the
      // project-dir slug is lossy — see the slug-collision block below). A fixture without it
      // would be a file the server is right to refuse, and would test nothing.
      const line = (text: string, cwd: string = markCwd) =>
        `${JSON.stringify({ type: "assistant", cwd, timestamp: new Date(0).toISOString(), message: { content: [{ type: "text", text }] } })}\n`;
      for (const [name, contract] of Object.entries(WORKER_CONTRACTS)) {
        for (const f of readdirSync(markProj)) rmSync(`${markProj}/${f}`);
        // the slot's own conversation first, the worker's strictly newer — so the fallback prefers
        // the worker's file on mtime and only the sniff can reject it
        writeFileSync(`${markProj}/own.jsonl`, line("a real conversation this slot had"));
        await Bun.sleep(15);
        writeFileSync(`${markProj}/bg-${name}.jsonl`, line(`${contract.mark} — the worker's own prompt`));
        const tj = (await (await get(`/api/slots/${free}/transcript`)).json()) as { source: string | null };
        check(`the ${name} worker's transcript is not served as the slot's conversation`,
          tj.source === "own.jsonl", `source=${tj.source}`);
      }
      // and the control: without a mark the same file IS the slot's conversation, so the row above
      // is measuring the mark and not some blanket refusal to serve anything
      for (const f of readdirSync(markProj)) rmSync(`${markProj}/${f}`);
      writeFileSync(`${markProj}/own.jsonl`, line("a real conversation this slot had"));
      await Bun.sleep(15);
      writeFileSync(`${markProj}/unmarked.jsonl`, line("an ordinary session with no worker mark"));
      const ctl = (await (await get(`/api/slots/${free}/transcript`)).json()) as { source: string | null };
      check("control: an UNMARKED newer transcript is served (the rows above measure the mark)",
        ctl.source === "unmarked.jsonl", `source=${ctl.source}`);

      // --- the SLUG COLLISION (same-user info disclosure, open since 2026-07-18). projDir maps
      // every non-alphanumeric to "-", so `<tmp>/fleet-e2e-marks-N` and `<tmp>/fleet-e2e/marks-N`
      // are TWO cwds that share ONE project dir. The fallback used to trust that dir name alone,
      // so a slot without a pinned session id could be served a conversation from a different
      // checkout. Both spellings are constructed from the same pid here, so the collision is
      // demonstrated rather than asserted — if projDir ever stopped being lossy, `sameDir` below
      // fails first and says so, instead of this block quietly testing nothing. ---
      const foreignCwd = `${tmpdir()}/fleet-e2e/marks-${process.pid}`;
      const slug = (p: string) => p.replace(/[^a-zA-Z0-9]/g, "-");
      check("slug-collision fixture: two different cwds really do share one project dir",
        slug(foreignCwd) === slug(markCwd) && foreignCwd !== markCwd, `${slug(foreignCwd)} vs ${slug(markCwd)}`);
      for (const f of readdirSync(markProj)) rmSync(`${markProj}/${f}`);
      writeFileSync(`${markProj}/own.jsonl`, line("this slot's own conversation"));
      await Bun.sleep(15);
      // strictly newer AND unmarked: on mtime alone this is the one the fallback would pick
      writeFileSync(`${markProj}/foreign.jsonl`, line("the OTHER checkout's conversation", foreignCwd));
      const coll = (await (await get(`/api/slots/${free}/transcript`)).json()) as { source: string | null };
      check("a newer transcript from a slug-colliding cwd is NOT served as this slot's conversation",
        coll.source === "own.jsonl", `source=${coll.source}`);
      // and with nothing of its own left, the answer is ABSENCE — never the stranger's file
      rmSync(`${markProj}/own.jsonl`);
      const collOnly = (await (await get(`/api/slots/${free}/transcript`)).json()) as { source: string | null; total: number };
      check("with only a foreign transcript present the slot has NO transcript (absence, not a stranger's)",
        collOnly.source === null, `source=${collOnly.source} total=${collOnly.total}`);
      // a cwd-LESS file is the same refusal for the same reason: nothing proves it is ours. On this
      // machine every such file was an aborted stub ≤685 bytes (529 files measured 2026-08-07),
      // so refusing it also stops a fresh empty stub from winning the fallback on mtime.
      rmSync(`${markProj}/foreign.jsonl`);
      writeFileSync(`${markProj}/nocwd.jsonl`,
        `${JSON.stringify({ type: "assistant", timestamp: new Date(0).toISOString(), message: { content: [{ type: "text", text: "no cwd recorded" }] } })}\n`);
      const noCwd = (await (await get(`/api/slots/${free}/transcript`)).json()) as { source: string | null };
      check("a transcript that names no cwd is not served either (unprovable ≠ ours)",
        noCwd.source === null, `source=${noCwd.source}`);
      await post(`/api/slots/${free}/kill`, {});
    }
    rmSync(markProj, { recursive: true, force: true }); // it lives outside the repo — do not leave it
    rmSync(markCwd, { recursive: true, force: true });
  }

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

  // --- THE COUNTS VS THE LISTS. The brief caps every list at 200 lines; the counts beside them
  // must stay TRUE, or the column states a number it invented. Measured against a repo built for
  // it: 205 changed files, so every cap is crossed by exactly five.
  {
    const cwd = `${tmpdir()}/fleet-e2e-brief-caps-${process.pid}`;
    rmSync(cwd, { recursive: true, force: true });
    mkdirSync(cwd, { recursive: true });
    const git = (...a: string[]) => Bun.spawnSync(["git", ...a], { cwd });
    git("init", "-q");
    git("config", "user.email", "e2e@fleet");
    git("config", "user.name", "e2e");
    writeFileSync(`${cwd}/seed.txt`, "seed\n");
    git("add", "-A"); git("commit", "-qm", "seed");
    for (let i = 0; i < 205; i++) writeFileSync(`${cwd}/f${i}.txt`, `${i}\n`);
    const slot = await freeSlotId();
    if (slot === undefined) check("brief caps: a free slot exists for the fixture", false, "no free slot");
    else {
      const opened = await post(`/api/slots/${slot}/open`, { cwd });
      check("brief caps fixture: a session opens on a repo with 205 changed files", opened.ok, `${opened.status}`);
      const b = (await (await get(`/api/slots/${slot}/brief`)).json()) as
        { uncommitted: number; uncommittedFiles: string[]; files: string[]; filesTotal: number; commitsCap: number };
      check("brief: the uncommitted COUNT is the true one while its list stays capped at 200",
        b.uncommitted === 205 && b.uncommittedFiles.length === 200,
        `count=${b.uncommitted} listed=${b.uncommittedFiles.length}`);
      // the board subtracts these two to say "… N more"; when they are derived from one another
      // the sentence can never appear, which is exactly the dead code this replaced
      check("brief: count minus listed is the number the column can report, not zero",
        b.uncommitted - b.uncommittedFiles.length === 5, `${b.uncommitted - b.uncommittedFiles.length}`);
      check("brief: the changed-file list carries its own true total",
        b.filesTotal === 205 && b.files.length === 200, `total=${b.filesTotal} listed=${b.files.length}`);
      check("brief: the commit cap is named, so a list that stops can say which cap it hit",
        b.commitsCap === 15, `commitsCap=${b.commitsCap}`);
      await post(`/api/slots/${slot}/kill`, {});
    }
    rmSync(cwd, { recursive: true, force: true });
  }

  // --- THE BRIEF'S NON-GIT HALF: what this session is MADE of (server.ts#sessionSetup). The board
  // shows profile and context packs, and neither could reach a client before: both hang on the
  // PROGRAM, and what a pane actually RECEIVED is only in the delivery receipt. The distinction
  // this family holds is that one: a receipt is delivery, a program's declaration is intent.
  {
    type Setup = { profile: string | null; repo: string | null; head: string | null;
      packs: { id: string; useWhen: string | null; sources: { path: string; anchor: string }[] | null;
        privateSourceId: string | null }[];
      omitted: { id: string; why: string }[]; deliveredAt: number | null;
      deliveredBytes: number | null; packsFrom: string | null };
    const setupOf = async (slot: number): Promise<Setup | undefined> =>
      ((await (await get(`/api/slots/${slot}/brief`)).json()) as { setup?: Setup }).setup;
    const bare = await setupOf(1);
    check("brief: a session with no program and no receipt answers the setup question, and answers it EMPTY",
      !!bare && bare.profile === null && bare.packs.length === 0 && bare.omitted.length === 0
      && bare.packsFrom === null && bare.deliveredAt === null,
      JSON.stringify(bare));
    // the receipt this slot's founding brief would have written, on ITS branch — the join is
    // slot+branch, so a row for another slot or another branch must not be picked up
    const branch = bf1j.branch!;
    const at = Date.now();
    const row = (slot: number, br: string, id: string) => `${JSON.stringify({
      id: `${slot}-${id}`, at, slot, branch: br, harness: "claude", repo: "/tmp/some-repo", head: "abc1234",
      selected: [
        { id, useWhen: `use ${id} when the lane touches it`,
          anchors: [{ path: "docs/verify-tiering.md", anchor: "## 11.7 A red check is yours" }] },
        // a PRIVATE pack: its anchors are the opaque id, never a path — the seam must keep the
        // two apart, because one can be opened and the other provably cannot
        { id: "private-overlay", anchors: { privateSourceId: "opaque-3f4c19d8a6e2b701" } },
      ],
      omitted: [{ id: "left-out-pack", why: "source-unavailable" }],
      deliveredBytes: 2048,
    })}\n`;
    appendFileSync(`${ROOT}/context-receipts.jsonl`,
      row(1, branch, "delivered-pack") + row(2, branch, "other-slot-pack") + row(1, "some/other-branch", "other-branch-pack"));
    const got = await setupOf(1);
    check("brief: the packs come from THIS slot's delivery receipt on THIS branch, with the omitted ones named",
      !!got && got.packsFrom === "receipt" && got.packs.length === 2 && got.packs[0].id === "delivered-pack"
      && got.packs[0].useWhen === "use delivered-pack when the lane touches it"
      && got.omitted.length === 1 && got.omitted[0].id === "left-out-pack"
      && got.omitted[0].why === "source-unavailable" && got.deliveredBytes === 2048 && got.deliveredAt === at,
      JSON.stringify(got));
    // the POINTERS ride along — without them a pack chip has nothing to open — and the repo+commit
    // they are read at come from the receipt, not from wherever the session happens to stand now
    check("brief: a pack carries its source pointers, read at the commit the receipt names",
      !!got && got.repo === "/tmp/some-repo" && got.head === "abc1234"
      && got.packs[0].sources?.length === 1
      && got.packs[0].sources[0].path === "docs/verify-tiering.md"
      && got.packs[0].sources[0].anchor === "## 11.7 A red check is yours"
      && got.packs[0].privateSourceId === null,
      JSON.stringify(got?.packs[0]));
    // a private pack is the case that must NOT be made openable: no path, no anchor, just the
    // opaque id — its content is outside the repo and the server cannot read it
    check("brief: a private pack hands over its opaque id and NO source path",
      !!got && got.packs[1].id === "private-overlay" && got.packs[1].sources === null
      && got.packs[1].privateSourceId === "opaque-3f4c19d8a6e2b701",
      JSON.stringify(got?.packs[1]));
    // …and the cache behind it is keyed on the ledger's own identity, not on a TTL: a receipt
    // appended a moment later is visible on the very next read, or the board would show a
    // session's packs from before its last founding.
    appendFileSync(`${ROOT}/context-receipts.jsonl`, row(1, branch, "refounded-pack"));
    const after = await setupOf(1);
    check("brief: a receipt appended after the first read is seen at once, and the LAST one wins",
      !!after && after.packs.length === 2 && after.packs[0].id === "refounded-pack",
      JSON.stringify(after?.packs));
  }

  await runNativeQuestions();
  await runForeignConversations();
  runLinks();
}

// --- links in both views (owner 2026-09-21: „[Zitat entfernt]“) ---
// The chat half renders the REAL src/md.ts into a stub document: mdInto only ever calls
// createElement/createTextNode/appendChild/setAttribute/textContent/className/style, so a stub
// that records exactly those is the whole DOM it can see. The terminal half is client-only
// (xterm needs a browser), so it is pinned at the source and at the installed package.
interface StubNode { tag: string; attrs: Record<string, string>; kids: StubNode[]; data?: string }
const stubText = (n: StubNode): string => n.data ?? n.kids.map(stubText).join("");
const stubAll = (n: StubNode, tag: string): StubNode[] =>
  [...(n.tag === tag ? [n] : []), ...n.kids.flatMap((k) => stubAll(k, tag))];
function renderStub(src: string, entity?: (kind: MdEntityKind, id: string) => boolean): StubNode {
  const make = (tag: string): StubNode & Record<string, unknown> => {
    const n: StubNode & Record<string, unknown> = { tag, attrs: {}, kids: [], style: {} };
    n.appendChild = (k: StubNode) => { n.kids.push(k); return k; };
    n.setAttribute = (k: string, v: string) => { n.attrs[k] = v; };
    Object.defineProperty(n, "textContent", { set: (v: string) => { n.kids = [{ tag: "#text", attrs: {}, kids: [], data: v }]; } });
    Object.defineProperty(n, "className", { set: (v: string) => { n.attrs.class = v; } });
    return n;
  };
  const g = globalThis as { document?: unknown };
  const had = g.document;
  g.document = { createElement: make, createTextNode: (data: string) => ({ tag: "#text", attrs: {}, kids: [], data }) };
  try {
    const root = make("div");
    mdInto(root as unknown as HTMLElement, src, { entity });
    return root;
  } finally {
    g.document = had;
  }
}

function runLinks(): void {
  const known = (kind: MdEntityKind, id: string) =>
    kind === "task" && id === "d5a399ff" || kind === "slot" && id === "12"
    || kind === "file" && (id === "src/client.ts:680" || id === "src/md.ts#entityMatches");
  const refs = stubAll(renderStub("d5a399ff slot 12 src/client.ts:680 src/md.ts#entityMatches", known), "span")
    .filter((n) => n.attrs["data-ent"]);
  check("chat: known references are keyboard-focusable", refs.length === 4 && refs.every((n) => n.attrs.tabindex === "0"),
    refs.map((n) => `${n.attrs["data-ent"]}:${n.attrs.tabindex}`).join(","));
  check("chat: without the hover option no entity span is rendered",
    stubAll(renderStub("d5a399ff src/client.ts:680"), "span").every((n) => !n.attrs["data-ent"]));
  const rejected = entityMatches("host:8790 14:52 src/client.ts:680", known);
  check("references: ports and clock times are never file references",
    rejected.length === 1 && rejected[0]?.kind === "file" && rejected[0]?.id === "src/client.ts:680",
    JSON.stringify(rejected));
  const ids: [MdEntityKind, string, string][] = [
    ["attention", "aaaaaaaaaaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbbbbbbbbbb"],
    ["report", "cccccccccccccccccccccccc", "dddddddddddddddddddddddd"],
    ["event", "eeeeeeeeeeeeeeeeeeeeeeee", "ffffffffffffffffffffffff"],
    ["lane", "3A", "3B"],
    ["program", "0d51b4d4", "0d51b4d5"],
  ];
  for (const [kind, yes, no] of ids) {
    const accepts = (k: MdEntityKind, id: string) => k === kind && id === yes;
    check(`references: known ${kind} gets one card marker`,
      entityMatches(`see ${yes}`, accepts).some((m) => m.kind === kind && m.id === yes));
    check(`references: unknown ${kind} stays plain text`,
      entityMatches(`see ${no}`, accepts).length === 0);
  }
  const url = "https://example.com/a_b/c?x=1&y=2#frag";
  const bare = stubAll(renderStub(`see ${url}. then`), "a");
  check("chat view: a bare https url in running text becomes exactly one link",
    bare.length === 1, `${bare.length} <a>`);
  check("chat view: the bare url's href is the full url, the sentence's trailing '.' left outside",
    bare[0]?.attrs.href === url, bare[0]?.attrs.href ?? "no <a>");
  check("chat view: the bare url's link text is the full url, so selecting it copies the url",
    bare[0] !== undefined && stubText(bare[0]) === url, bare[0] ? stubText(bare[0]) : "no <a>");
  check("chat view: a bare url opens in a new tab with rel=noopener noreferrer",
    bare[0]?.attrs.target === "_blank" && bare[0]?.attrs.rel === "noopener noreferrer", JSON.stringify(bare[0]?.attrs));
  const md = stubAll(renderStub(`[docs](${url})`), "a");
  check("chat view: a markdown link and a bare url get the same href, target and rel",
    md.length === 1 && JSON.stringify({ ...md[0]!.attrs, class: "" }) === JSON.stringify({ ...bare[0]?.attrs, class: "" }),
    JSON.stringify(md[0]?.attrs));

  // safeHref's refusals stay refusals, by either road into the link path. Payloads carry no parens:
  // `[x](javascript:alert(1))` never even matches the link grammar, so it would not reach safeHref.
  const hostile = ["javascript:alert%281%29", "JaVaScRiPt:void0", "data:text/html,<b>x</b>", "vbscript:x", "//evil.example/x"];
  const linked = hostile.filter((h) => stubAll(renderStub(`[x](${h}) and ${h}`), "a").length > 0);
  check("chat view: javascript:, data:, vbscript: and protocol-relative urls never become a link",
    linked.length === 0, linked.join(" | "));
  const shown = renderStub("[x](javascript:void0)");
  check("chat view: a refused markdown link is shown as its own source text, not dropped",
    stubText(shown) === "[x](javascript:void0)", stubText(shown));

  // the terminal: the official addon, in the version that pairs with the installed xterm
  const pkg = JSON.parse(readFileSync(`${ROOT}/package.json`, "utf8")) as { dependencies: Record<string, string> };
  const addonPkg = `${ROOT}/node_modules/@xterm/addon-web-links/package.json`;
  const peer = existsSync(addonPkg)
    ? (JSON.parse(readFileSync(addonPkg, "utf8")) as { peerDependencies?: Record<string, string> }).peerDependencies?.["@xterm/xterm"]
    : undefined;
  check("terminal: @xterm/addon-web-links is a dependency pinned to an exact version",
    /^\d+\.\d+\.\d+$/.test(pkg.dependencies["@xterm/addon-web-links"] ?? ""), pkg.dependencies["@xterm/addon-web-links"] ?? "absent");
  check("terminal: the installed addon's @xterm/xterm peer range admits the pinned xterm",
    peer !== undefined && Bun.semver.satisfies(pkg.dependencies["@xterm/xterm"] ?? "", peer),
    `peer ${peer ?? "(addon not installed)"} vs xterm ${pkg.dependencies["@xterm/xterm"]}`);
  // the staged instance carries no src/client.ts: the source is the node_modules symlink's parent
  // (the same resolution as e2e/slots.ts), and a probe that cannot read it fails as itself
  let client = "", clientError = "";
  try {
    client = readFileSync(`${dirname(realpathSync(`${ROOT}/node_modules`))}/src/client.ts`, "utf8");
  } catch (e) { clientError = e instanceof Error ? e.message : String(e); }
  check("precondition: node_modules exposes src/client.ts for the terminal link checks",
    client.length > 0, clientError);
  if (!client) return;
  check("terminal: bare urls are linkified by WebLinksAddon, through the same handler as OSC 8 links",
    /loadAddon\(new WebLinksAddon\(openTermLink\)\)/.test(client) && /linkHandler: \{ activate: openTermLink \}/.test(client));
  const reconnect = /  reconnect\(\) \{[\s\S]*?\n  \}/.exec(client)?.[0] ?? "";
  check("terminal: explicit reload retries WebGL after a context loss and marks canvas visibly",
    reconnect.includes("this.loadRenderer();")
      && client.includes('this.reloadBtn.classList.toggle("degraded", this.renderer !== "webgl")')
      && client.includes("private loadRenderer(): void"));
  // T1 of the 2026-09-26 walk-through: the seed pin ran INSIDE the wheel smoothing and parked the
  // viewport a line above the tail (18 of 24 runs). The glide stays on for the user; the one door for
  // programmatic tail jumps zeroes it around its two calls, and no bare scrollToBottom remains.
  const snap = /  snapToBottom\(nudge = false\) \{[\s\S]*?\n  \}/.exec(client)?.[0] ?? "";
  const pin = /  private pinToBottom\(\) \{[\s\S]*?\n  \}/.exec(client)?.[0] ?? "";
  check("terminal: pinToBottom reaches the tail past the wheel smoothing, which stays on for the user",
    /o\.smoothScrollDuration = 0;[\s\S]*?scrollToBottom\(\);\s*o\.smoothScrollDuration = glide;/.test(snap)
      && pin.includes("this.snapToBottom(") && /smoothScrollDuration: [1-9]\d*,/.test(client)
      && !/\.term\.scrollToBottom\(\);|\.term\.scrollLines\(/.test(client.replace(snap, "")),
    `snap ${snap.length} chars, pin ${pin.length} chars`);
  // T3 of the same walk-through: a dropped socket was a 6-px dot and sendRaw threw keystrokes away
  // without a trace. The drop is said in the pane, and (K6 follow-up, owner 2026-09-27) what was
  // typed meanwhile waits for the next seed of the same slot instead of being discarded.
  const sendRaw = /  sendRaw\(s: string\) \{[\s\S]*?\n  \}/.exec(client)?.[0] ?? "";
  const flushHeld = /  private flushHeld\(\) \{[\s\S]*?\n  \}/.exec(client)?.[0] ?? "";
  const holdSource = /const HELD_MAX_BYTES = [\s\S]*?\nfunction holdKeys[\s\S]*?\n\}/.exec(client)?.[0] ?? "";
  check("terminal: a closed socket shows in the pane, which counts down to the next try",
    /const wait = reconnectDelay\(this\.retries\+\+\);\s*this\.showDown\(wait\);/.test(client)
      && /setConn\(true\);\s*this\.hideDown\(\);/.test(client) && client.includes("this.reconnect(); };\n    this.downBar.append("),
    `sendRaw ${sendRaw.length} chars`);
  check("terminal: held keys are sent after the seed write of the current socket, and a slot change discards them",
    /^([ \t]+)this\.term\.write\(new Uint8Array\(e\.data as ArrayBuffer\), pin \|\| action\.reset \? \(\) => \{\n(?:\1[ \t]+[^\n]*\n)*\1\} : undefined\);\s*if \(action\.reset\) this\.flushHeld\(\);/m.test(client.replace(/^[ \t]*\/\/.*$/gm, ""))
      && /this\.slot = slot;[\s\S]*?this\.held = "";[\s\S]*?this\.connect\(\)/.test(client)
      && (client.match(/this\.flushHeld\(\)/g) ?? []).length === 1,
    `flushHeld ${flushHeld.length} chars`);
  // the buffer itself, run: the real holdKeys/sendRaw/flushHeld lifted from the source into a stub
  // pane whose socket is a list of sent frames. A lift that cannot run fails this check, not the module.
  const sent: string[] = [];
  const toasts: string[] = [];
  let holdResult = "";
  try {
    const OPEN = 1;
    const factory = new Function("WebSocket", "MAX_CHUNK", "toast", new Bun.Transpiler({ loader: "ts" }).transformSync(
      `${holdSource}\nclass P { held = ""; dropped = 0; slot = 7; ws: any = null; paints = 0;\n  paintDown() { this.paints++; }\n${sendRaw}\n${flushHeld.replace("private ", "")}\n}\nreturn { holdKeys, P, HELD_MAX_BYTES };`,
    ));
    const lifted = factory({ OPEN }, 1 << 16, (m: string) => toasts.push(m)) as {
      holdKeys: (h: string, l: number, s: string) => { held: string; lost: number }; HELD_MAX_BYTES: number;
      P: new () => { held: string; dropped: number; slot: number; paints: number;
        ws: { readyState: number; send: (b: Uint8Array) => void } | null; sendRaw: (s: string) => void; flushHeld: () => void };
    };
    const { holdKeys, P, HELD_MAX_BYTES } = lifted;
    const kb = "x".repeat(1024);
    const cases = [
      HELD_MAX_BYTES === 1024,
      JSON.stringify(holdKeys("", 0, "")) === JSON.stringify({ held: "", lost: 0 }),
      holdKeys("", 0, kb).held === kb, // exactly 1024 B fits
      JSON.stringify(holdKeys(kb, 0, "y")) === JSON.stringify({ held: kb, lost: 1 }), // byte 1025 is refused
      holdKeys("x".repeat(1022), 0, "ä").held.length === 1023, // 2 B: lands on 1024
      JSON.stringify(holdKeys("x".repeat(1023), 0, "ä")) === JSON.stringify({ held: "x".repeat(1023), lost: 1 }), // counted as ONE character
      JSON.stringify(holdKeys("ab", 0, "\x1b[A".repeat(400))) === JSON.stringify({ held: "ab", lost: 1200 }), // whole write or none
      JSON.stringify(holdKeys("ab", 3, "c")) === JSON.stringify({ held: "ab", lost: 4 }), // after a refusal, nothing more is held
    ];
    const pane = new P();
    pane.ws = null; // socket closed
    pane.sendRaw("ls -la");
    pane.sendRaw("\r");
    const heldWhileDown = pane.held === "ls -la\r" && sent.length === 0 && pane.paints === 2;
    pane.ws = { readyState: OPEN, send: (b: Uint8Array) => sent.push(new TextDecoder().decode(b)) };
    pane.flushHeld(); // the seed arrived
    pane.flushHeld(); // a second seed (reload) must not repeat it
    const once = sent.join("|") === "ls -la\r" && pane.held === "" && pane.dropped === 0 && toasts.length === 0;
    // over the cap: the prefix is sent, the refused rest is counted and said once, then forgotten
    const over = new P();
    over.sendRaw("ab"); over.sendRaw("y".repeat(1023)); over.sendRaw("c");
    const overDown = over.held === "ab" && over.dropped === 1024;
    over.ws = pane.ws;
    over.flushHeld(); over.flushHeld();
    const overSaid = sent.join("|") === "ls -la\r|ab" && over.dropped === 0 && toasts.length === 1
      && toasts[0]!.includes("2 Zeichen nach dem Verbinden gesendet, 1024 verworfen");
    const none = new P(); none.slot = 0; none.sendRaw("x"); // an unassigned pane holds nothing
    holdResult = JSON.stringify({ cases, heldWhileDown, once, overDown, overSaid, unassigned: none.held === "" && none.paints === 0, sent: sent.map((t) => t.length), toasts });
    check("terminal: keys typed while disconnected wait (at most 1024 B, whole writes, a prefix) and are sent exactly once after the seed",
      cases.every(Boolean) && heldWhileDown && once && overDown && overSaid && none.held === "" && none.paints === 0, holdResult);
  } catch (e) {
    check("terminal: keys typed while disconnected wait (at most 1024 B, whole writes, a prefix) and are sent exactly once after the seed",
      false, `lift failed: ${e instanceof Error ? e.message : String(e)} (holdKeys ${holdSource.length}, sendRaw ${sendRaw.length}, flushHeld ${flushHeld.length} chars)`);
  }
  check("terminal: every socket gates stale frames and resets before its first seed write",
    client.includes("seedFramePlan(g, this.gen, firstFrame)")
      && /if \(action\.reset\) \{[\s\S]*?this\.term\.reset\(\)/.test(client));
  check("terminal: reference links reuse the entity card and disappear with the loupe off",
    client.includes("registerLinkProvider") && client.includes("entityMatches(line")
      && client.includes("if (!this.hoverOn || !this.term) return") && client.includes("showEntityCard(m.kind"));
  const index = readFileSync(`${ROOT}/public/index.html`, "utf8");
  check("hover: exactly one card style and a touch pointerdown path",
    (index.match(/\.entcard \{/g) ?? []).length === 1
      && readFileSync(`${dirname(realpathSync(`${ROOT}/node_modules`))}/src/entcard.ts`, "utf8").includes('e.pointerType !== "touch"'));
  // T2/T4/T5 of the 2026-09-26 walk-through, the phone terminal: a long press copies through
  // copyText, ^C leads the key row (never behind a sideways swipe), and the portrait corner group
  // sits in a strip above the terminal instead of on its text.
  const keyRow = /<div id="keys">([\s\S]*?)<\/div>/.exec(index)?.[1] ?? "";
  check("terminal (phone): long press copies the line through copyText, ^C leads the key row, the corner group sits above the text",
    client.includes("copyText(this.pressText)") && client.includes("this.term.selectLines(start, end)")
      && /^\s*<button data-k="cc">/.test(keyRow)
      && /\.paneterm \{ top: 48px; \}\s*\.pane:not\(\.chat\) \.panetools \{ flex-direction: row-reverse;/.test(index),
    `key row starts ${JSON.stringify(keyRow.trim().slice(0, 30))}`);
  const opener = /function openTermLink\([\s\S]*?\n\}/.exec(client)?.[0] ?? "";
  check("terminal: a link opens only as http(s), in a new tab, without an opener",
    /proto !== "http:" && proto !== "https:"/.test(opener) && opener.includes(`window.open(uri, "_blank", "noopener,noreferrer")`),
    opener ? `${opener.length} chars` : "openTermLink not found");
}

// --- the conversation view for pi-zai and codex (sixteenth cut): each reads its OWN file format
// through Harness.conversation, found by the slot's session identity — never newest-by-mtime. One
// small fixture per format, each with its counter-probe: a FOREIGN session in the same cwd, written
// newer, is not what the slot shows.
interface ConvPayload { entries: { n: number; role: string; blocks: { t: string; text: string }[] }[];
  total: number; source: string | null; cache?: { at: number; provider: string } | null; model?: string | null;
  effort?: string | null; native?: NativeTranscript }
// codex and pi name no measured question form (row 1e01b4f3): their file is found by identity, so the
// origin names it — and the binding is never current, and no block is typed as a Claude question
const foreignNative = (p: ConvPayload, sid: string | null): boolean => p.native?.questions === "unsupported"
  && p.native.origin.sessionId === sid && p.native.origin.via === (sid ? "harness-file" : null)
  && p.native.binding.state === "none" && JSON.stringify(p.entries).match(/"(ask|answer|terminal)":/) === null;
const persistedSlot = (slot: number): { sessionId?: string | null } | undefined =>
  (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
    { slots?: Record<string, { sessionId?: string | null }> }).slots?.[String(slot)];
const freeSlotId = async (): Promise<number | undefined> =>
  ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
    .slots.filter((s) => s.cwd === null).map((s) => s.id).pop();
const flat = (p: ConvPayload): string[][] => p.entries.map((e) => [e.role, ...e.blocks.map((b) => `${b.t}:${b.text}`)]);

async function runForeignConversations(): Promise<void> {
  // the catalogue publishes the view per harness: pi-zai and codex have a reader, pi-ox has none
  const hs = ((await (await get("/api/harnesses")).json()) as { harnesses: { id: string; supports: { transcript: boolean; chat?: boolean } }[] }).harnesses;
  const sup = (id: string) => hs.find((h) => h.id === id)?.supports;
  check("harness catalogue: supports.chat is true for claude, pi, pi-zai and codex, false for pi-ox and the container",
    sup("claude")?.chat === true && sup("pi")?.chat === true && sup("pi-zai")?.chat === true && sup("codex")?.chat === true
      && sup("pi-ox")?.chat === false && sup("container")?.chat === false,
    JSON.stringify(hs.map((h) => [h.id, h.supports.chat])));
  check("harness catalogue: supports.transcript stays false for pi, pi-zai and codex (the chat view does not widen it)",
    sup("pi")?.transcript === false && sup("pi-zai")?.transcript === false && sup("codex")?.transcript === false);

  // --- pi-zai: a session TREE. Path A → B → E → F is the conversation; C → D is an abandoned branch.
  const zaiRoot = process.env.FLEET_PI_ZAI_AGENT_DIR ?? "";
  const piCwd = `${tmpdir()}/fleet-e2e-piconv-${process.pid}`;
  mkdirSync(piCwd, { recursive: true });
  const piSlot = await freeSlotId();
  const piOpen = zaiRoot && piSlot !== undefined ? await post(`/api/slots/${piSlot}/open`, { cwd: piCwd, harness: "pi-zai" }) : null;
  const sid = piSlot !== undefined ? persistedSlot(piSlot)?.sessionId ?? "" : "";
  check("pi conversation fixture: a pi-zai slot opens with a pinned session id",
    !!piOpen?.ok && /^[0-9a-f-]{36}$/.test(sid), JSON.stringify({ zaiRoot, piSlot, status: piOpen?.status, sid }));
  if (piOpen?.ok && sid && piSlot !== undefined) {
    const real = realpathSync(piCwd);
    const dir = `${zaiRoot}/sessions/--${real.replace(/^\/+/, "").replaceAll("/", "-")}--`;
    mkdirSync(dir, { recursive: true });
    const T0 = Date.parse("2026-09-19T10:00:00.000Z");
    const msg = (id: string, parentId: string | null, role: string, content: unknown[], extra: Record<string, unknown> = {}) =>
      `${JSON.stringify({ type: "message", id, parentId, timestamp: new Date(T0).toISOString(),
        message: { role, content, timestamp: T0, ...extra } })}\n`;
    // pi's thinking level is a tree entry too: "low" at the root is on the path, "max" sits on the
    // abandoned branch and must count only once the leaf moves there
    const lvl = (id: string, parentId: string | null, thinkingLevel: string) =>
      `${JSON.stringify({ type: "thinking_level_change", id, parentId, timestamp: new Date(T0).toISOString(), thinkingLevel })}\n`;
    const own = `${dir}/2026-09-19T10-00-00-000Z_${sid}.jsonl`;
    writeFileSync(own, `${JSON.stringify({ type: "session", version: 3, id: sid, timestamp: new Date(T0).toISOString(), cwd: real })}\n`
      + lvl("t0", null, "low")
      + msg("a", "t0", "user", [{ type: "text", text: "question A" }])
      + msg("b", "a", "assistant", [{ type: "toolCall", id: "c1", name: "read", arguments: { path: "x" } }], { provider: "zai", timestamp: T0 + 1000 })
      + msg("r", "b", "toolResult", [{ type: "text", text: "file body" }])
      + msg("c", "r", "user", [{ type: "text", text: "ABANDONED branch" }])
      + lvl("tx", "c", "max")
      + msg("d", "tx", "assistant", [{ type: "text", text: "ABANDONED answer" }], { provider: "zai", timestamp: T0 + 2000 })
      + msg("e", "r", "user", [{ type: "text", text: "question E" }])
      + msg("f", "e", "assistant", [{ type: "thinking", thinking: "hmm" }, { type: "text", text: "answer F" }], { provider: "zai", model: "glm-5.3-flash", timestamp: T0 + 3000 }));
    // the counter-probe: a newer foreign session, same cwd, same directory, another id
    const foreignSid = "30000000-0000-4000-8000-00000000000f";
    writeFileSync(`${dir}/2026-09-19T11-00-00-000Z_${foreignSid}.jsonl`,
      `${JSON.stringify({ type: "session", version: 3, id: foreignSid, timestamp: new Date(T0).toISOString(), cwd: real })}\n`
      + msg("z", null, "user", [{ type: "text", text: "FOREIGN pi session" }]));
    const p1 = (await (await get(`/api/slots/${piSlot}/transcript`)).json()) as ConvPayload;
    check("pi conversation: the view shows the path from the newest leaf to the root, abandoned branch left out",
      JSON.stringify(flat(p1)) === JSON.stringify([["user", "text:question A"], ["assistant", `tool:{"path":"x"}`],
        ["assistant", "tool_result:file body"], ["user", "text:question E"], ["assistant", "thinking:hmm", "text:answer F"]]),
      JSON.stringify(flat(p1)));
    check("pi conversation: the slot's OWN file is served — the newer foreign session in the same cwd is not",
      (p1.source ?? "").startsWith(`2026-09-19T10-00-00-000Z_${sid}.jsonl`) && !JSON.stringify(p1).includes("FOREIGN"), `source=${p1.source}`);
    check("pi conversation: the cache reference is the newest path assistant's request start, provider zai, and its model",
      p1.cache?.at === T0 + 3000 && p1.cache?.provider === "zai" && p1.model === "glm-5.3-flash", JSON.stringify([p1.cache, p1.model]));
    check("pi conversation: the effort is the newest thinking_level_change ON the path — the abandoned branch's level is not",
      p1.effort === "low", `effort=${p1.effort}`);
    check("pi conversation: the native origin names the slot's session, the question form stays unsupported, nothing is bound",
      foreignNative(p1, sid), JSON.stringify(p1.native));
    const p2 = (await (await get(`/api/slots/${piSlot}/transcript?after=${p1.total}`)).json()) as ConvPayload;
    check("pi conversation: an incremental fetch with nothing appended is empty and keeps the source",
      p2.entries.length === 0 && p2.total === p1.total && p2.source === p1.source, JSON.stringify(p2).slice(0, 200));
    // back onto the abandoned branch: the served lines stop being the conversation, and source says so
    appendFileSync(own, msg("g", "d", "user", [{ type: "text", text: "back on branch D" }]));
    const p3 = (await (await get(`/api/slots/${piSlot}/transcript`)).json()) as ConvPayload;
    check("pi conversation: a branch switch changes the source, and the new path is served",
      p3.source !== p1.source && flat(p3).map((e) => e[1]).join("|")
        === "text:question A|tool:{\"path\":\"x\"}|tool_result:file body|text:ABANDONED branch|text:ABANDONED answer|text:back on branch D",
      `${p3.source} ${JSON.stringify(flat(p3))}`);
    check("pi conversation: after the branch switch the effort is the level set on the new path",
      p3.effort === "max", `effort=${p3.effort}`);
    await post(`/api/slots/${piSlot}/kill`, {});
    rmSync(dir, { recursive: true, force: true });
  }
  rmSync(piCwd, { recursive: true, force: true });

  // --- codex: the rollout bound to the slot by the server's own codex_bind tick (e2e/watch.ts
  // runLearnedSessionAck, the same technique: stand-in binary on PATH, one user rollout in the window)
  const codexRoot = process.env.FLEET_CODEX_SESSIONS_DIR ?? "";
  const codexCwd = REPO ? resolve(REPO) : "";
  const codexPath = `${ROOT}/codex-bin:${process.env.PATH ?? ""}`;
  check("codex conversation fixture: a scratch sessions root, the stand-in binary and a cwd exist",
    !!codexRoot && !!codexCwd && existsSync(`${ROOT}/codex-bin/codex`), `${codexRoot} / ${codexCwd}`);
  if (!codexRoot || !codexCwd) return;
  await restartSrv({ PATH: codexPath });
  try {
    const cxSlot = await freeSlotId();
    const cxOpen = cxSlot !== undefined ? await post(`/api/slots/${cxSlot}/open`, { cwd: codexCwd, harness: "codex" }) : null;
    check("codex conversation fixture: a codex slot opens with no session id yet", !!cxOpen?.ok
      && cxSlot !== undefined && persistedSlot(cxSlot)?.sessionId === null, `slot=${cxSlot} status=${cxOpen?.status}`);
    if (!cxOpen?.ok || cxSlot === undefined) return;
    const unbound = (await (await get(`/api/slots/${cxSlot}/transcript`)).json()) as ConvPayload;
    check("codex conversation: an unbound slot shows nothing (no id → no file, never the newest rollout)",
      unbound.source === null && unbound.entries.length === 0, JSON.stringify(unbound));
    check("codex conversation: an unbound slot's native origin names no session and binds nothing",
      foreignNative(unbound, null), JSON.stringify(unbound.native));
    const ID = "30000000-0000-4000-8000-00000000000c";
    const d = new Date();
    const dayDir = `${codexRoot}/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    mkdirSync(dayDir, { recursive: true });
    const rollout = `${dayDir}/rollout-${Date.now()}-${ID}.jsonl`;
    const TU = "2026-09-19T12:00:05.000Z";
    const item = (payload: Record<string, unknown>) => `${JSON.stringify({ timestamp: "2026-09-19T12:00:00.000Z", type: "response_item", payload })}\n`;
    writeFileSync(rollout, `${JSON.stringify({ type: "session_meta", payload: {
      id: ID, cwd: codexCwd, timestamp: new Date().toISOString(), thread_source: "user", originator: "codex-tui" } })}\n`
      + `${JSON.stringify({ timestamp: "2026-09-19T12:00:00.000Z", type: "turn_context", payload: { model: "gpt-5.5", effort: "xhigh" } })}\n`
      + item({ type: "message", role: "developer", content: [{ type: "input_text", text: "<permissions>DEVELOPER</permissions>" }] })
      + item({ type: "message", role: "user", content: [{ type: "input_text", text: "# AGENTS.md instructions\nINJECTED" }] })
      + item({ type: "message", role: "user", content: [{ type: "input_text", text: "hello codex" }] })
      + item({ type: "message", role: "assistant", content: [{ type: "output_text", text: "hi there" }], phase: "commentary" })
      + item({ type: "function_call", name: "exec_command", arguments: "{\"cmd\":\"ls\"}", call_id: "k1" })
      + item({ type: "function_call_output", call_id: "k1", output: "a.txt" })
      + `${JSON.stringify({ timestamp: TU, type: "token_usage_record", payload: { usage: { input_tokens: 10, cached_input_tokens: 8 } } })}\n`);
    let bound: string | null | undefined = null;
    try {
      bound = await until(() => (persistedSlot(cxSlot)?.sessionId === ID ? ID : null),
        { timeoutMs: 25_000, stepMs: 250, what: `slot ${cxSlot} to bind codex session ${ID}` });
    } catch (e) { if (!(e instanceof UntilTimeout)) throw e; }
    check("codex conversation fixture: the server's codex_bind tick binds the slot to the planted rollout", bound === ID, `bound=${bound}`);
    if (bound === ID) {
      // the counter-probe: a newer rollout of ANOTHER session in the same cwd, written after the bind
      const foreign = `${dayDir}/rollout-${Date.now() + 1}-30000000-0000-4000-8000-0000000000ff.jsonl`;
      writeFileSync(foreign, `${JSON.stringify({ type: "session_meta", payload: { id: "30000000-0000-4000-8000-0000000000ff",
        cwd: codexCwd, timestamp: new Date().toISOString(), thread_source: "user", originator: "codex-tui" } })}\n`
        + item({ type: "message", role: "user", content: [{ type: "input_text", text: "FOREIGN codex session" }] }));
      const c1 = (await (await get(`/api/slots/${cxSlot}/transcript`)).json()) as ConvPayload;
      check("codex conversation: user/assistant messages and tool calls, developer rows and injected AGENTS.md dropped",
        JSON.stringify(flat(c1)) === JSON.stringify([["user", "text:hello codex"], ["assistant", "text:hi there"],
          ["assistant", `tool:{"cmd":"ls"}`], ["assistant", "tool_result:a.txt"]]), JSON.stringify(flat(c1)));
      check("codex conversation: the bound rollout is served — the newer foreign one in the same cwd is not",
        c1.source === rollout.split("/").pop() && !JSON.stringify(c1).includes("FOREIGN"), `source=${c1.source}`);
      check("codex conversation: the cache reference is the newest token_usage_record, provider openai; model from turn_context",
        c1.cache?.at === Date.parse(TU) && c1.cache?.provider === "openai" && c1.model === "gpt-5.5", JSON.stringify([c1.cache, c1.model]));
      check("codex conversation: the effort is the turn_context's own", c1.effort === "xhigh", `effort=${c1.effort}`);
      check("codex conversation: the native origin names the bound session, the question form stays unsupported, nothing is bound",
        foreignNative(c1, ID), JSON.stringify(c1.native));
      rmSync(foreign, { force: true });
    }
    await post(`/api/slots/${cxSlot}/kill`, {});
    rmSync(rollout, { force: true });
  } finally {
    await restartSrv(); // normal PATH back for the modules after this one
  }
}

// --- NATIVE QUESTIONS AND WHERE THEY CAME FROM (row 1e01b4f3): the owner's transcript routes type a
// Claude Code AskUserQuestion call from its ORIGINAL input and its answer from the result line's
// toolUseResult, paired by tool_use id, and say which session/occupant the conversation is and
// whether it is the current terminal's. The fixture replays the FIELD STRUCTURE of the one measured
// original (Claude Code 2.1.286, single-select, answered) with anonymous sentinels — no original text.
// Each check names the violation that turns it red: a 600-char cut, a positional answer guess, an
// invented form, a binding on an unpinned or past session, the live occupant stamped on history.
type NqBlock = { t: string; text: string; id?: string; ref?: string; ask?: Record<string, unknown>;
  answer?: Record<string, unknown>; terminal?: { state: string; reason?: string } };
type NqPayload = { entries: { n: number; blocks: NqBlock[] }[]; total: number; source: string | null; native?: NativeTranscript;
  assigned?: boolean };
async function runNativeQuestions(): Promise<void> {
  // the pure decisions first — the races (a recycle DURING the read) cannot be timed on the wire
  const seat: ReadSeat = { slot: 7, openedAt: 1000, sessionId: "nq-session" };
  const bind = (o: Partial<Parameters<typeof transcriptBinding>[0]>) => transcriptBinding({ history: false, questions: true,
    pinned: true, fileSession: "nq-session", before: seat, after: seat, ...o });
  const why = (b: ReturnType<typeof bind>) => (b.state === "none" ? b.reason : "current");
  check("native binding: only a live read of the slot's own pinned session, unchanged across the read, is current",
    bind({}).state === "current"
      && why(bind({ history: true })).startsWith("history") && why(bind({ questions: false })).startsWith("harness")
      && why(bind({ pinned: false })).startsWith("unbound") && why(bind({ before: { ...seat, sessionId: null } })).startsWith("unbound")
      && why(bind({ fileSession: "other-session" })).startsWith("session mismatch")
      && why(bind({ after: null })).startsWith("occupant gone")
      && why(bind({ after: { ...seat, openedAt: 2000 } })).startsWith("occupant changed")
      && why(bind({ after: { ...seat, slot: 8 } })).startsWith("occupant changed")
      && why(bind({ after: { ...seat, sessionId: "resumed-elsewhere" } })).startsWith("session changed"),
    JSON.stringify([bind({}), bind({ after: { ...seat, openedAt: 2000 } })]));
  const formQ = { question: "q", header: "h", multiSelect: false, options: [{ label: "a", description: "d" }] };
  const cur = { state: "current" } as const;
  check("native binding: a call is bound only unanswered, complete and single-select — answered, clipped, multi-select are not",
    askTerminal(cur, { state: "complete", questions: [formQ] }, false).state === "current"
      && why(askTerminal(cur, { state: "complete", questions: [formQ] }, true)).startsWith("answered")
      && why(askTerminal(cur, { state: "clipped", chars: 1, limit: 1 }, false)) === "form clipped"
      && why(askTerminal(cur, { state: "complete", questions: [{ ...formQ, multiSelect: true }] }, false)).includes("multi-select")
      && why(askTerminal({ state: "none", reason: "history: x" }, { state: "complete", questions: [formQ] }, false)) === "history: x");

  const cwd = `${tmpdir()}/fleet-e2e-nativeq-${process.pid}`;
  const proj = `${process.env.HOME}/.claude/projects/${cwd.replace(/[^a-zA-Z0-9]/g, "-")}`;
  mkdirSync(cwd, { recursive: true });
  mkdirSync(proj, { recursive: true });
  const sid = crypto.randomUUID();
  const at = new Date(0).toISOString();
  const opt = (k: string) => ({ label: `NQ-LABEL-${k}`, description: `NQ-DESC-${k} ${"d".repeat(140)}` });
  const q = (k: string, multiSelect = false) =>
    ({ question: `NQ-QUESTION-${k} ${"q".repeat(420)}`, header: `NQ-H-${k}`, multiSelect, options: ["a", "b", "c"].map((x) => opt(`${k}${x}`)) });
  type Q = ReturnType<typeof q>;
  // the measured result repeats the questions with `options` BEFORE `multiSelect` — the pairing must
  // compare forms, not key order
  const echo = (qs: Q[]) => qs.map(({ question, header, multiSelect, options }) => ({ question, header, options, multiSelect }));
  const line = (o: Record<string, unknown>) => JSON.stringify({ cwd, sessionId: sid, timestamp: at, isSidechain: false, ...o });
  const call = (id: string, input: unknown, extra: Record<string, unknown> = {}, name = "AskUserQuestion") =>
    line({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id, name, input, caller: { type: "direct" } }] }, ...extra });
  const result = (id: string, toolUseResult?: unknown, extra: Record<string, unknown> = {}) =>
    line({ type: "user", message: { role: "user", content: [{ type: "tool_result", content: `NQ-RESULT ${id}`, tool_use_id: id }] },
      ...(toolUseResult === undefined ? {} : { toolUseResult }), ...extra });
  const answered = (qs: Q[], answers: Record<string, string>) => ({ questions: echo(qs), answers, annotations: {} });
  const QS = { single: [q("s")], open: [q("o")], two: [q("t1"), q("t2")], multi: [q("m", true)], free: [q("f")],
    huge: [{ ...q("h"), question: `NQ-HUGE ${"h".repeat(ASK_MAX)}` }], mismatch: [q("x")], refused: [q("r")] };
  const preview = [{ ...q("p"), options: [{ ...opt("pa"), preview: "NQ-PREVIEW" }, opt("pb")] }];
  const lines = [
    line({ type: "user", message: { role: "user", content: "NQ start" } }),
    // three calls in a row, their results back in REVERSED order: pairing is by id, never by position
    call("toolu_nq_single", { questions: QS.single }),
    call("toolu_nq_open", { questions: QS.open }),
    call("toolu_nq_two", { questions: QS.two }),
    // two questions answered in the OPPOSITE key order of the questions: by text, not by position
    result("toolu_nq_two", answered(QS.two, { [QS.two[1]!.question]: "NQ-LABEL-t2a", [QS.two[0]!.question]: "NQ-LABEL-t1c" })),
    result("toolu_nq_single", answered(QS.single, { [QS.single[0]!.question]: "NQ-LABEL-sb" })),
    call("toolu_nq_multi", { questions: QS.multi }),
    result("toolu_nq_multi", answered(QS.multi, { [QS.multi[0]!.question]: "NQ-LABEL-ma, NQ-LABEL-mb" })),
    call("toolu_nq_free", { questions: QS.free }),
    result("toolu_nq_free", answered(QS.free, { [QS.free[0]!.question]: "NQ-FREE-TEXT" })),
    call("toolu_nq_huge", { questions: QS.huge }),
    call("toolu_nq_preview", { questions: preview }),
    call("toolu_nq_bad", { questions: "NQ-NOT-AN-ARRAY" }),
    call("toolu_nq_mismatch", { questions: QS.mismatch }),
    result("toolu_nq_mismatch", answered([q("x-other")], { [q("x-other").question]: "NQ-LABEL-x-othera" })),
    // a result whose call is NOT in this file (another conversation's id): no answer is typed
    result("toolu_nq_elsewhere", answered([q("e")], { [q("e").question]: "NQ-LABEL-ea" })),
    call("toolu_nq_refused", { questions: QS.refused }),
    result("toolu_nq_refused", undefined, { message: { role: "user", content: [{ type: "tool_result", content: "NQ-REFUSED", is_error: true, tool_use_id: "toolu_nq_refused" }] } }),
    // a subagent's question is not this conversation's; another tool with the same input shape is not a question
    call("toolu_nq_side", { questions: [q("side")] }, { isSidechain: true }),
    call("toolu_nq_bash", { questions: [q("b")] }, {}, "Bash"),
    result("toolu_nq_bash", answered([q("b")], { [q("b").question]: "NQ-LABEL-ba" })),
  ];
  writeFileSync(`${proj}/${sid}.jsonl`, lines.join("\n") + "\n");
  const slot = await freeSlotId();
  const opened = slot !== undefined && (await post(`/api/slots/${slot}/open`, { cwd })).ok;
  check("native-question fixture: a free slot opens on a throwaway cwd whose one transcript carries the planted calls",
    opened && (persistedSlot(slot)?.sessionId ?? null) === null, `slot=${slot} sid=${slot !== undefined ? persistedSlot(slot)?.sessionId : "-"}`);
  const lineageId = "1e01".padEnd(24, "0");
  try {
    if (!opened || slot === undefined) return;
    const read = async (path: string): Promise<NqPayload> => (await (await get(path)).json()) as NqPayload;
    const blocks = (p: NqPayload) => p.entries.flatMap((e) => e.blocks);
    const callOf = (p: NqPayload, id: string) => blocks(p).find((b) => b.t === "tool" && b.id === id);
    const resultOf = (p: NqPayload, id: string) => blocks(p).find((b) => b.t === "tool_result" && b.ref === id);
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

    // (A) FLEET_CMD=true pins no session: the file is the cwd's newest — typed, but bound to nobody
    const a = await read(`/api/slots/${slot}/transcript`);
    check("native-question fixture: the owner route serves the planted file, every line counted",
      a.source === `${sid}.jsonl` && a.total === lines.length, `source=${a.source} total=${a.total}`);
    const single = callOf(a, "toolu_nq_single");
    check("native question: a call longer than the 600-char view arrives typed WHOLE — question, header, multiSelect, every option",
      JSON.stringify(QS.single).length > 600 && same(single?.ask, { state: "complete", questions: QS.single })
        && /… \[\+\d+ chars\]$/.test(single?.text ?? ""),
      `chars=${JSON.stringify(QS.single).length} ask=${JSON.stringify(single?.ask).slice(0, 160)} text=${single?.text.slice(-24)}`);
    check("native question: tool_use.id and tool_result.tool_use_id both survive on every planted pair",
      ["toolu_nq_single", "toolu_nq_two", "toolu_nq_multi", "toolu_nq_free", "toolu_nq_mismatch", "toolu_nq_refused"]
        .every((id) => callOf(a, id) && resultOf(a, id)) && !!resultOf(a, "toolu_nq_elsewhere"),
      JSON.stringify(blocks(a).map((b) => [b.t, b.id ?? b.ref ?? ""])));
    check("native answer: a single-select answer is the chosen option, found by its label, on the call it answers by id",
      same(resultOf(a, "toolu_nq_single")?.answer, { state: "answered", answers: [{ question: 0, form: "single", option: 1, label: "NQ-LABEL-sb" }] }),
      JSON.stringify(resultOf(a, "toolu_nq_single")?.answer));
    check("native answer: interleaved calls, results in reversed order, two answers keyed in reversed order — paired by id and question text, never position",
      same(resultOf(a, "toolu_nq_two")?.answer, { state: "answered", answers: [
        { question: 0, form: "single", option: 2, label: "NQ-LABEL-t1c" }, { question: 1, form: "single", option: 0, label: "NQ-LABEL-t2a" }] })
        && blocks(a).findIndex((b) => b.ref === "toolu_nq_two") < blocks(a).findIndex((b) => b.ref === "toolu_nq_single"),
      JSON.stringify(resultOf(a, "toolu_nq_two")?.answer));
    const st = (b: NqBlock | undefined, k: "ask" | "answer") => `${b?.[k]?.state}:${String(b?.[k]?.reason ?? "")}`;
    check("native answer: the UNMEASURED forms stay unsupported — multi-select, free text, a refusal without structured result",
      st(resultOf(a, "toolu_nq_multi"), "answer").startsWith("unsupported:the multi-select")
        && st(resultOf(a, "toolu_nq_free"), "answer").startsWith("unsupported:a free-text")
        && st(resultOf(a, "toolu_nq_refused"), "answer").startsWith("unsupported:no structured result"),
      [st(resultOf(a, "toolu_nq_multi"), "answer"), st(resultOf(a, "toolu_nq_free"), "answer"), st(resultOf(a, "toolu_nq_refused"), "answer")].join(" | "));
    const huge = callOf(a, "toolu_nq_huge");
    check("native question: past the limit the form is CLIPPED with its size — no question, no option is served cut",
      huge?.ask?.state === "clipped" && (huge.ask.chars as number) > ASK_MAX && huge.ask.limit === ASK_MAX && !("questions" in huge.ask),
      JSON.stringify(huge?.ask));
    check("native question: an unmeasured field is unsupported, a malformed input invalid, a result that repeats other questions invalid",
      st(callOf(a, "toolu_nq_preview"), "ask") === "unsupported:question 0 option 0: unmeasured field preview"
        && st(callOf(a, "toolu_nq_bad"), "ask").startsWith("invalid:")
        && st(resultOf(a, "toolu_nq_mismatch"), "answer") === "invalid:the result's questions differ from the call's",
      [st(callOf(a, "toolu_nq_preview"), "ask"), st(callOf(a, "toolu_nq_bad"), "ask"), st(resultOf(a, "toolu_nq_mismatch"), "answer")].join(" | "));
    check("native question: nothing is classified that is not this file's own AskUserQuestion — a foreign id, another tool, a subagent",
      !("answer" in (resultOf(a, "toolu_nq_elsewhere") ?? {})) && !("ask" in (callOf(a, "toolu_nq_bash") ?? {}))
        && !("answer" in (resultOf(a, "toolu_nq_bash") ?? { answer: 1 })) && !callOf(a, "toolu_nq_side"),
      JSON.stringify([resultOf(a, "toolu_nq_elsewhere"), callOf(a, "toolu_nq_bash")?.ask, !!callOf(a, "toolu_nq_side")]).slice(0, 200));
    check("native origin: an UNPINNED pane's newest file names its session but no occupant, and binds nothing — not even an open call",
      a.native?.questions === "claude-code" && a.native.origin.via === "newest-file" && a.native.origin.sessionId === sid
        && a.native.origin.occupant === null && a.native.binding.state === "none" && a.native.binding.reason.startsWith("unbound")
        && blocks(a).filter((b) => b.ask).every((b) => b.terminal?.state === "none"),
      JSON.stringify(a.native));
    const inc = await read(`/api/slots/${slot}/transcript?after=4`);
    check("native answer: an incremental read whose calls lie BEFORE `after` still types the answers (calls read over the whole file)",
      !callOf(inc, "toolu_nq_single") && same(resultOf(inc, "toolu_nq_single")?.answer, resultOf(a, "toolu_nq_single")?.answer),
      JSON.stringify(resultOf(inc, "toolu_nq_single")?.answer));

    // the guest reader is the owner payload cut down — it gains NOTHING from this row
    const share = (await (await post(`/api/slots/${slot}/share`, { mode: "view", password: "nativeq-pass" })).json()) as { id?: string };
    const auth = share.id ? await post(`/s/${share.id}/auth`, { password: "nativeq-pass" }) : null;
    const cookie = (auth?.headers.get("set-cookie") ?? "").split(";")[0];
    const guest = share.id ? (await (await fetch(`${BASE}/s/${share.id}/transcript`, { headers: { cookie } })).json()) as NqPayload : null;
    check("native question: the share reader carries no native field, no typed form, no answer, no binding — and the same 600-char tool text",
      !!guest && guest.total === lines.length && !("native" in guest)
        && blocks(guest).every((b) => !("ask" in b) && !("answer" in b) && !("terminal" in b))
        && callOf(guest, "toolu_nq_single")?.text === single?.text,
      guest ? JSON.stringify({ total: guest.total, keys: Object.keys(guest) }) : `share=${JSON.stringify(share)} auth=${auth?.status}`);

    // (B) the slot PINNED to that session, and its line planted: one old record that names no session,
    // one whose `from` names the SAME session id — a resumed UUID is still a past occupant's history
    const opened0 = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as { slots: Record<string, { openedAt: number }> }).slots[String(slot)]!.openedAt;
    await stopSrv();
    const plant = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as { slots: Record<string, Record<string, unknown>>;
      lineageHandovers?: { lineageId: string }[] };
    plant.slots[String(slot)]!.sessionId = sid;
    plant.slots[String(slot)]!.lineageId = lineageId;
    const old1 = opened0 - 7_200_000, old2 = opened0 - 3_600_000;
    const rec = (from: Record<string, unknown>, to: number, atMs: number) => ({ v: 1, lineageId, role: "generic", at: atMs,
      from, to: { slot, openedAt: to }, obligations: [], intent: "native question probe", pointer: null, supersededBy: null });
    plant.lineageHandovers = [...(plant.lineageHandovers ?? []),
      rec({ slot, openedAt: old1 }, old2, old2), rec({ slot, openedAt: old2, sessionId: sid, cwd }, opened0, opened0)];
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(plant, null, 2), { mode: 0o600 });
    await restartSrv();
    const now = persistedSlot(slot) as { sessionId?: string | null; openedAt?: number } | undefined;
    check("native-question fixture: after the restart the slot is pinned to the planted session, same occupant",
      now?.sessionId === sid && now.openedAt === opened0, JSON.stringify({ sid: now?.sessionId, openedAt: now?.openedAt, opened0 }));
    const b = await read(`/api/slots/${slot}/transcript`);
    check("native origin: the pinned session's live read names that session and the occupant, and is the current binding",
      b.native?.origin.via === "pinned" && b.native.origin.sessionId === sid
        && same(b.native.origin.occupant, { slot, openedAt: opened0 }) && b.native.binding.state === "current",
      JSON.stringify(b.native));
    check("native binding: on the current read only the unanswered complete single-select call is bound — answered, multi-select, clipped are not",
      callOf(b, "toolu_nq_open")?.terminal?.state === "current"
        && (callOf(b, "toolu_nq_single")?.terminal?.reason ?? "").startsWith("answered")
        && (callOf(b, "toolu_nq_refused")?.terminal?.reason ?? "").startsWith("answered")
        && (callOf(b, "toolu_nq_multi")?.terminal?.reason ?? "").startsWith("answered")
        && callOf(b, "toolu_nq_huge")?.terminal?.reason === "form clipped",
      JSON.stringify(["open", "single", "refused", "multi", "huge"].map((k) => callOf(b, `toolu_nq_${k}`)?.terminal)));
    const past = await read(`/api/slots/${slot}/succession/2/transcript`);
    check("native origin: a past session read through its record names the RECORD's occupant, never the live occupant's openedAt, and stays history",
      past.assigned === true && past.source === `${sid}.jsonl` && past.native?.origin.via === "succession-record"
        && past.native.origin.sessionId === sid && same(past.native.origin.occupant, { slot, openedAt: old2 })
        && past.native.binding.state === "none" && past.native.binding.reason.startsWith("history")
        && callOf(past, "toolu_nq_open")?.terminal?.state === "none" && same(callOf(past, "toolu_nq_single")?.ask, single?.ask),
      JSON.stringify(past.native));
    const unassigned = await read(`/api/slots/${slot}/succession/1/transcript`);
    check("native origin: a past session whose record names no session has no session id, its recorded occupant, and no binding",
      unassigned.assigned === false && unassigned.entries.length === 0 && unassigned.native?.origin.sessionId === null
        && same(unassigned.native.origin.occupant, { slot, openedAt: old1 }) && unassigned.native.binding.state === "none",
      JSON.stringify(unassigned.native));
  } finally {
    if (opened && slot !== undefined) await post(`/api/slots/${slot}/kill`, {});
    await stopSrv();
    const unplant = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as { lineageHandovers?: { lineageId: string }[] };
    unplant.lineageHandovers = (unplant.lineageHandovers ?? []).filter((r) => r.lineageId !== lineageId);
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(unplant, null, 2), { mode: 0o600 });
    await restartSrv();
    rmSync(proj, { recursive: true, force: true }); // outside the repo — never leave it
    rmSync(cwd, { recursive: true, force: true });
  }
}
