// ACP-25 real-TUI acceptance probe (driver: acceptance-probe.sh). Every check below is against the
// installed claude/codex binaries in a scratch Fleet instance. The probe MUST fail when it cannot
// observe acceptance: "observed" is asserted together with an independent second witness (the
// Claude transcript's "type":"user" line, the emptied Codex composer), never alone.
import { existsSync, readFileSync } from "node:fs";
import { BASE, ROOT, check, failures, get, post, results, tmuxOut } from "./e2e/harness";
// the hint the SERVER will compose, computed here from the same pure builder the delivery seam
// uses — an expectation re-spelled by hand would only pin this file's copy of it.
import { auditWatchMessage, type AuditWatchEventPayload } from "./lane-signals";
import { appendFileSync } from "node:fs";

const CWD = process.env.PROBE_CWD ?? "";
const projDir = `${process.env.HOME}/.claude/projects/${CWD.replace(/[/.]/g, "-")}`;
type Receipt = { sendId?: string; submitRequested?: boolean; acceptance?: string; delivery?: string;
  receiver?: { sessionId?: string | null } };
type SlotRow = { id: number; agent?: string | null };
const slotRow = async (id: number): Promise<SlotRow | undefined> =>
  ((await (await get("/api/sessions")).json()) as { slots: SlotRow[] }).slots.find((s) => s.id === id);
const awaitAlive = async (id: number, ms: number): Promise<boolean> => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if ((await slotRow(id))?.agent === "alive") return true;
    await Bun.sleep(250);
  }
  return false;
};
const pane = (id: number) => `s${id}`;
const awaitFrame = async (id: number, re: RegExp, ms: number): Promise<string> => {
  const t0 = Date.now();
  let out = "";
  while (Date.now() - t0 < ms) {
    out = (await tmuxOut("capture-pane", "-p", "-t", pane(id))).out;
    if (re.test(out)) return out;
    await Bun.sleep(250);
  }
  return out;
};
const userTurns = (sessionId: string): number => {
  const f = `${projDir}/${sessionId}.jsonl`;
  if (!existsSync(f)) return 0;
  return readFileSync(f, "utf8").split("\n").filter((l) => l.includes('"type":"user"')).length;
};
const awaitTurns = async (sessionId: string, atLeast: number, ms: number): Promise<number> => {
  const t0 = Date.now();
  let n = userTurns(sessionId);
  while (n < atLeast && Date.now() - t0 < ms) { await Bun.sleep(250); n = userTurns(sessionId); }
  return n;
};
const awaitIdle = async (id: number): Promise<void> => {
  const t0 = Date.now();
  while (Date.now() - t0 < 90_000) {
    if (!(await tmuxOut("capture-pane", "-p", "-t", pane(id))).out.includes("esc to interrupt")) return;
    await Bun.sleep(250);
  }
};
const send = async (slot: number, text: string) => {
  const res = await post("/send", { slot, text, submit: true });
  const body = (await res.json()) as { ok?: boolean; error?: string; receipt?: Receipt };
  return { status: res.status, ...body };
};
const longPaste = (marker: string) => [
  `probe ${marker} — a long brief, do NOT read it.`,
  ...Array.from({ length: 200 }, (_, i) => `Zeile ${i + 1}: Fuellwort Fuellwort Fuellwort abcdefghij.`),
  "Ende. Reply with exactly the word OK and nothing else.",
].join("\n");

// --- CLAUDE: fresh pane, collapsed multi-line paste — the ACP-21 loss cell (2/7 before the cut) ---
const openC = await post("/api/slots/1/open", { cwd: CWD });
check("claude fixture: slot 1 opens on the real claude binary", openC.ok, String(openC.status));
const aliveC = await awaitAlive(1, 30_000);
check("claude fixture: the agent process is alive", aliveC);
const composerC = await awaitFrame(1, /^❯/m, 30_000);
check("claude fixture: the composer is painted before the first send", /^❯/m.test(composerC), composerC.slice(-200));
// the pinned session id rides every receipt's receiver triple — the transcript is the second witness
let sidC = "";
if (openC.ok && aliveC) {
  let turns = 0;
  const CELLS = 5;
  let observed = 0, witnessed = 0;
  for (let i = 0; i < CELLS; i++) {
    const r = await send(1, longPaste(`ACP25-C${i}`));
    if (i === 0) {
      sidC = r.receipt?.receiver?.sessionId ?? "";
      check("claude fixture: the receipt names the pinned session id (transcript witness)", /^[0-9a-f-]{36}$/.test(sidC), sidC);
    }
    if (r.receipt?.acceptance === "observed") observed++;
    const n = await awaitTurns(sidC, turns + 1, 15_000);
    if (n >= turns + 1) witnessed++;
    turns = n;
    check(`claude cell ${i + 1}/${CELLS}: a collapsed 200-line paste is reported exactly as the transcript shows it`,
      r.status === 200 && r.receipt?.acceptance === "observed" && n >= 1 && witnessed === observed,
      `status=${r.status} acceptance=${r.receipt?.acceptance} userTurns=${n} err=${r.error ?? ""}`);
    await awaitIdle(1);
  }
  check("claude: every observed receipt had a transcript witness and vice versa", observed === witnessed && observed === CELLS,
    `observed=${observed} witnessed=${witnessed}`);
  // --- short one-liner on the established pane ---
  const one = await send(1, "probe ACP25-one-liner: reply with exactly the word OK.");
  const oneTurns = await awaitTurns(sidC, turns + 1, 15_000);
  check("claude: a short one-liner is observed accepted and witnessed", one.receipt?.acceptance === "observed" && oneTurns === turns + 1,
    `acceptance=${one.receipt?.acceptance} turns=${oneTurns}`);
  turns = oneTurns;
  await awaitIdle(1);
  // --- OCCUPIED COMPOSER: an owner draft must refuse before anything is typed ---
  await tmuxOut("send-keys", "-t", pane(1), "-l", "owner draft do not send");
  await Bun.sleep(500);
  const refused = await send(1, "probe ACP25-must-not-append");
  await Bun.sleep(1500);
  const frame = (await tmuxOut("capture-pane", "-p", "-t", pane(1))).out;
  const draftLine = frame.split("\n").filter((l) => /^❯/.test(l)).pop() ?? "";
  check("claude: an owner draft in the composer refuses the send (409, delivery:refused) and types nothing",
    refused.status === 409 && refused.receipt?.delivery === "refused" && draftLine.includes("owner draft do not send")
    && !draftLine.includes("must-not-append") && userTurns(sidC) === turns,
    `status=${refused.status} delivery=${refused.receipt?.delivery} line=${JSON.stringify(draftLine)} turns=${userTurns(sidC)}`);
  await tmuxOut("send-keys", "-t", pane(1), "C-u");
  await Bun.sleep(300);
  // --- WORKING PANE: a send while the agent works is queued by the TUI — composer drains, observed ---
  const slow = await send(1, "probe ACP25-slow: count from 1 to 30, one number per line, then say OK.");
  await awaitFrame(1, /esc to interrupt/, 10_000);
  const queued = await send(1, "probe ACP25-queued: reply with exactly the word OK.");
  const qTurns = await awaitTurns(sidC, turns + 2, 60_000);
  check("claude: a send into a working pane is accepted (queued by the TUI) and both turns are witnessed",
    slow.receipt?.acceptance === "observed" && queued.receipt?.acceptance === "observed" && qTurns === turns + 2,
    `slow=${slow.receipt?.acceptance} queued=${queued.receipt?.acceptance} turns=${qTurns}`);
  turns = qTurns;
  await awaitIdle(1);
  // --- DEAD AGENT PANE: the stale last frame must not pass as acceptance ---
  const panePid = (await tmuxOut("list-panes", "-t", pane(1), "-F", "#{pane_pid}")).out.trim();
  const kids = Bun.spawnSync(["pgrep", "-P", panePid]).stdout.toString().split("\n").filter(Boolean);
  for (const k of kids) Bun.spawnSync(["kill", "-KILL", k]);
  await Bun.sleep(2000);
  await awaitFrame(1, /\$ ?$|% ?$/m, 10_000); // the pane fell through to its shell
  let deadAgent = "alive";
  for (let i = 0; i < 40 && deadAgent === "alive"; i++) { await Bun.sleep(250); deadAgent = (await slotRow(1))?.agent ?? "?"; }
  const dead = await send(1, ": acp25-dead-pane-probe");
  // Two honest answers, never "observed": the stale last frame may keep a 1-char residue (zsh's
  // partial-line marker lands on the old composer line) → refused, nothing typed; or it reads
  // empty → the liveness probe turns it into "unobservable". Either way no submit is claimed.
  const honest = (dead.status === 409 && dead.receipt?.delivery === "refused")
    || (dead.status === 200 && dead.receipt?.acceptance === "unobservable");
  check("claude: after the agent died, the stale composer is never observed acceptance (refused or unobservable)",
    deadAgent !== "alive" && honest,
    `agent=${deadAgent} status=${dead.status} delivery=${dead.receipt?.delivery} acceptance=${dead.receipt?.acceptance} err=${dead.error ?? ""}`);
  await post("/api/slots/1/kill", {});
}

// --- CODEX: established pane, a long single-line event-like text (the 2026-08-22 live symptom) ---
const openX = await post("/api/slots/2/open", { cwd: CWD, harness: "codex" });
check("codex fixture: slot 2 opens on the real codex binary", openX.ok, String(openX.status));
if (openX.ok) {
  const aliveX = await awaitAlive(2, 30_000);
  // codex-cli 0.147.0 greets with an update prompt on this box ("Update available … Press enter")
  // — a third paste-eating screen readiness.blocks does not know (reported, not fixed here).
  // Skipping it is fixture setup: answer "2. Skip" so the composer appears at all.
  const greet = await awaitFrame(2, /Update available|>_ OpenAI Codex \(v/, 30_000);
  if (/Update available/.test(greet)) {
    await tmuxOut("send-keys", "-t", pane(2), "2"); await tmuxOut("send-keys", "-t", pane(2), "Enter");
  }
  const ready = await awaitFrame(2, />_ OpenAI Codex \(v/, 30_000);
  const blocked = /1\. Update now|Do you trust|Sign in with ChatGPT/.test(ready);
  check("codex fixture: header painted, no blocking screen (update prompt, trust, sign-in)", aliveX && !blocked,
    ready.split("\n").filter((l) => l.trim()).slice(0, 8).join(" | ").slice(0, 300));
  if (aliveX && !blocked) {
    await Bun.sleep(3000); // established, not fresh: outside SEND_BOOT_FRESH_MS's settle branch is fine either way
    const eventLike = `[fleet watch] lane-ready: slot 7 fleet/260822-probe looks done (idle 120s, clean, ahead 3) — this is a server predicate, not a report from the lane; read the pane before landing. ${"x".repeat(400)} Reply with exactly the word OK.`;
    const r = await send(2, eventLike);
    await Bun.sleep(1500);
    const after = (await tmuxOut("capture-pane", "-p", "-t", pane(2))).out;
    const lastGlyph = after.split("\n").filter((l) => /^›/.test(l)).pop() ?? "";
    check("codex: a long event-like line is observed accepted and the composer no longer holds it",
      r.status === 200 && r.receipt?.acceptance === "observed" && !lastGlyph.includes("lane-ready"),
      `status=${r.status} acceptance=${r.receipt?.acceptance} composer=${JSON.stringify(lastGlyph.slice(0, 80))} err=${r.error ?? ""}`);
    await awaitIdle(2);
    await tmuxOut("send-keys", "-t", pane(2), "-l", "owner draft");
    await Bun.sleep(500);
    const refusedX = await send(2, "must-not-append");
    const frameX = (await tmuxOut("capture-pane", "-p", "-t", pane(2))).out;
    const lineX = frameX.split("\n").filter((l) => /^›/.test(l)).pop() ?? "";
    check("codex: an owner draft refuses the send and is left untouched",
      refusedX.status === 409 && refusedX.receipt?.delivery === "refused" && lineX.includes("owner draft") && !lineX.includes("must-not-append"),
      `status=${refusedX.status} line=${JSON.stringify(lineX)}`);
    await tmuxOut("send-keys", "-t", pane(2), "C-u");
    await Bun.sleep(500);

    // --- THE REAL FLEET CHAIN, END TO END: stored event -> observed Codex acceptance -> ACK of
    //     exactly that event id, by the receiver's own credential. --------------------------------
    //
    // WHY THIS CELL EXISTS, and why the two codex cells above did not catch what it catches. On
    // 2026-09-05 nine of nine Fleet events to a Codex MAIN were never delivered (report/merge/audit
    // alike): every hint Fleet composes ended `… from $FLEET_SELF_TOKEN.`, and in the Codex TUI a
    // `$`-token AT THE CURSOR — after a paste, the last one — opens the mention overlay, which eats
    // the Enter. Fleet read that honestly (composer still full, payload rolled back, send-uncertain)
    // and replayed the identical paste to its cap. The cells above send HAND-WRITTEN text ending in
    // "Reply with exactly the word OK." and were green throughout: they never carried the one
    // property of the real message. So this cell sends nothing of its own. It makes the SERVER
    // compose and type a real event, and then asks the two questions a frame cannot answer — did
    // the transport record delivery, and can the receiver acknowledge THAT id.
    //
    // The trigger is POSITIONAL (a control run with the same token mid-text submitted fine), so the
    // reason line below deliberately carries a harmless `$HOME` IN THE MIDDLE: user text keeps its
    // dollars, only the generated tail may not end on one. Both halves are asserted.
    // THE CELL MUST NOT RACE THE BOOT, and this is not caution — it is the difference between a
    // regression and a green that means nothing. Measured 2026-09-05 on this machine: the exact
    // old-form text whose mention overlay eats the Enter on a settled pane was SUBMITTED, cleanly,
    // on a pane still painting `model: loading`. The trigger needs the initialised TUI. So the
    // event may only be minted once the header has resolved a model — and the wait is asserted as
    // ITSELF, because a cell that measured an unsettled pane measured nothing.
    const settled = await awaitFrame(2, /model:\s+(?!loading)\S/, 60_000);
    check("codex chain: the TUI is settled before the event is minted (an unsettled pane submits either form)",
      /model:\s+(?!loading)\S/.test(settled),
      settled.split("\n").filter((l) => /model:/.test(l)).join(" | ").slice(0, 120) || "no model line in frame");

    const mainAfter = `d1${"0".repeat(38)}`;
    const reason = "INERT PROBE: do nothing, run nothing, reply nothing. Notes mention $HOME in passing";
    appendFileSync(`${ROOT}/post-land-audits.jsonl`, `${JSON.stringify({
      at: Date.now(), startedAt: Date.now() - 1, ms: 1, repo: CWD, main: "main", mainSha: mainAfter,
      result: "green", reason, cmd: "d1-acceptance-fixture", exitCode: 0, out: "ALL PASS",
      checks: { ran: 1, failed: 0 }, covers: [{ branch: "fleet/d1-probe", mainAfter, at: Date.now() - 2 }],
    })}\n`);
    const wRes = await post("/api/slots/2/watch", { kind: "audit", repo: CWD, mainAfter, idleSec: 0, delivery: "pane" });
    const wId = ((await wRes.json()) as { watch?: { id: string } }).watch?.id ?? "";
    check("codex chain: the audit watch registers against the persisted fixture row", wRes.status === 200 && wId !== "",
      `status=${wRes.status} watch=${wId}`);

    type EventRow = { id: string; watchId?: string; kind?: string; status?: string; attempts?: number;
      deliveredAt?: number | null; acknowledgedAt?: number | null; subjectRepo?: string;
      subjectMainAfter?: string; payload: AuditWatchEventPayload };
    const eventFor = async (watchId: string): Promise<EventRow | undefined> =>
      (((await (await get("/api/events")).json()) as { events?: EventRow[] }).events ?? [])
        .find((e) => e.watchId === watchId);
    // ESTABLISH, don't assert: poll until the transport reaches a terminal answer, and keep the last
    // reading either way so a failure reports the state it really saw rather than "undefined".
    const awaitEvent = async (watchId: string, done: (e: EventRow) => boolean, ms: number): Promise<EventRow | undefined> => {
      const t0 = Date.now();
      let seen = await eventFor(watchId);
      while (Date.now() - t0 < ms && !(seen && done(seen))) {
        await Bun.sleep(250);
        seen = await eventFor(watchId);
      }
      return seen;
    };
    const delivered = wId ? await awaitEvent(wId, (e) => e.deliveredAt != null || e.status === "receiver-gone", 120_000) : undefined;
    // the text the server typed, from the SAME builder the seam calls
    const hint = delivered ? auditWatchMessage(delivered.subjectRepo ?? "", delivered.subjectMainAfter ?? "",
      { id: delivered.id, kind: "post-land-audit", payload: delivered.payload }) : "";
    const frameD = (await tmuxOut("capture-pane", "-p", "-t", pane(2))).out;
    const glyphD = frameD.split("\n").filter((l) => /^›/.test(l)).pop() ?? "";
    // TWO WITNESSES, never one: the transport's own acceptance read (deliveredAt) AND the pane. The
    // 2026-09-05 failure had deliveredAt null with the composer full — this asserts both directions.
    check("codex chain: a real Fleet event is delivered on the first attempt and the composer does not hold it",
      delivered?.deliveredAt != null && delivered.status === "delivered" && delivered.attempts === 1
        && !glyphD.includes("post-land audit") && !glyphD.includes("Press enter to insert"),
      `status=${delivered?.status} attempts=${delivered?.attempts} deliveredAt=${delivered?.deliveredAt ?? "null"} composer=${JSON.stringify(glyphD.slice(0, 90))}`);
    // the property under repair, read off the message the server actually composed
    check("codex chain: the composed hint keeps a mid-text $ token and does not END on one",
      hint.includes("$HOME") && !/\$[A-Za-z_][A-Za-z0-9_]*[\s.,;:!?)\]"'`]*$/.test(hint),
      `tail=${JSON.stringify(hint.slice(-56))} midDollar=${hint.includes("$HOME")}`);

    // --- THE ACK: by the RECEIVER's own credential, naming exactly this event id. A stored
    //     acknowledgedAt is the only proof that survives the pane; a model saying "OK" is not one.
    //
    // The credential is read from the PERSISTED slot row, not with paneEnv(): that helper types
    // `printf ... "$FLEET_SELF_TOKEN"` into the pane and waits for a shell to answer. A Codex pane
    // has no shell in it — the line would land in the composer, and it ends on exactly the `$NAME`
    // token this whole cell is about. The value never leaves this scope; only its presence is
    // reported (ensureSlot bakes the self-credentials into every pane, so a raw line is a leak).
    const selfTok = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
      { slots?: Record<string, { selfToken?: string }> }).slots?.["2"]?.selfToken ?? "";
    // whether the pane's own agent got there first: a Codex that read the hint and acknowledged by
    // itself is a STRONGER result, not a failure — but the two must not be confused in the receipt.
    const preAck = delivered ? (await eventFor(wId))?.acknowledgedAt ?? null : null;
    const ackRes = delivered && selfTok
      ? await fetch(`${BASE}/api/self/events/${delivered.id}/ack`, { method: "POST", headers: { "x-fleet-self-token": selfTok } })
      : null;
    // the refusal must NAME itself: `acknowledgeFleetEvent` has four distinct 409s and they are four
    // different defects. A bare status code sends the next reader guessing.
    const ackWhy = ackRes && ackRes.status !== 200
      ? ((await ackRes.clone().json().catch(() => ({}))) as { error?: string }).error ?? "" : "";
    const acked = wId ? await awaitEvent(wId, (e) => e.acknowledgedAt != null, 10_000) : undefined;
    check("codex chain: the receiver acknowledges exactly that event id and the ACK is stored",
      selfTok !== "" && ackRes?.status === 200 && acked?.acknowledgedAt != null
        && acked.status === "acknowledged" && acked.id === delivered?.id,
      `tokenPresent=${selfTok !== ""} ack=${ackRes?.status ?? "not sent"} stored=${acked?.acknowledgedAt ?? "null"} status=${acked?.status} ackedByPaneFirst=${preAck !== null} why=${JSON.stringify(ackWhy)}`);
  }
  await post("/api/slots/2/kill", {});
}

console.log(results.join("\n"));
console.log(failures() ? `\n${failures()} FAILURES` : "\nALL PASS");
process.exit(failures() ? 1 : 0);
