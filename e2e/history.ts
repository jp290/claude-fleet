// Prompt history per slot, the global append-only prompt log and the /api/prompts directory
// served from it, plus the transcript and session-brief reads.
import { appendFileSync, existsSync, statSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { check, get, post, plogPath, plogRead, ROOT, REPO, restartSrv, until, UntilTimeout } from "./harness";
import { WORKER_CONTRACTS } from "../src/protocol";

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

  // --- transcript view. FLEET_CMD=true means no pinned session id, so this exercises the mtime
  // fallback. It used to read slot 1 (cwd ~/claude-fleet) and therefore asserted over WHATEVER
  // conversations the person running the suite happened to have had in that checkout — an
  // unstated precondition of the machine, not a fixture. On a box where nobody has ever run
  // claude in ~/claude-fleet the endpoint correctly answers `total=0` and this read as a product
  // regression (measured 2026-08-30 on the Linux second-host). The rows below now plant the two
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

  // --- THE BRIEF'S NON-GIT HALF: what this session is MADE of (server.ts#sessionSetup). The board
  // shows profile and context packs, and neither could reach a client before: both hang on the
  // PROGRAM, and what a pane actually RECEIVED is only in the delivery receipt. The distinction
  // this family holds is that one: a receipt is delivery, a program's declaration is intent.
  {
    type Setup = { profile: string | null; packs: { id: string; useWhen: string | null }[];
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
      id: `${slot}-${id}`, at, slot, branch: br, harness: "claude",
      selected: [{ id, useWhen: `use ${id} when the lane touches it`, anchors: [] }],
      omitted: [{ id: "left-out-pack", why: "source-unavailable" }],
      deliveredBytes: 2048,
    })}\n`;
    appendFileSync(`${ROOT}/context-receipts.jsonl`,
      row(1, branch, "delivered-pack") + row(2, branch, "other-slot-pack") + row(1, "some/other-branch", "other-branch-pack"));
    const got = await setupOf(1);
    check("brief: the packs come from THIS slot's delivery receipt on THIS branch, with the omitted ones named",
      !!got && got.packsFrom === "receipt" && got.packs.length === 1 && got.packs[0].id === "delivered-pack"
      && got.packs[0].useWhen === "use delivered-pack when the lane touches it"
      && got.omitted.length === 1 && got.omitted[0].id === "left-out-pack"
      && got.omitted[0].why === "source-unavailable" && got.deliveredBytes === 2048 && got.deliveredAt === at,
      JSON.stringify(got));
    // …and the cache behind it is keyed on the ledger's own identity, not on a TTL: a receipt
    // appended a moment later is visible on the very next read, or the board would show a
    // session's packs from before its last founding.
    appendFileSync(`${ROOT}/context-receipts.jsonl`, row(1, branch, "refounded-pack"));
    const after = await setupOf(1);
    check("brief: a receipt appended after the first read is seen at once, and the LAST one wins",
      !!after && after.packs.length === 1 && after.packs[0].id === "refounded-pack",
      JSON.stringify(after?.packs));
  }

  await runForeignConversations();
}

// --- the conversation view for pi-zai and codex (sixteenth cut): each reads its OWN file format
// through Harness.conversation, found by the slot's session identity — never newest-by-mtime. One
// small fixture per format, each with its counter-probe: a FOREIGN session in the same cwd, written
// newer, is not what the slot shows.
interface ConvPayload { entries: { n: number; role: string; blocks: { t: string; text: string }[] }[];
  total: number; source: string | null; cache?: { at: number; provider: string } | null; model?: string | null;
  effort?: string | null }
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
      rmSync(foreign, { force: true });
    }
    await post(`/api/slots/${cxSlot}/kill`, {});
    rmSync(rollout, { force: true });
  } finally {
    await restartSrv(); // normal PATH back for the modules after this one
  }
}
