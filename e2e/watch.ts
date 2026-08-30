// THE OUTBOUND CHANNEL for the two completion predicates (server.ts, Watch + tickWatches): the
// original clean+ahead `doneLooking`, and the distinct dirty+zero-ahead `hostCommitLooking` for a
// fenced harness whose host owns the commit. A watch is a subscription — one slot asks to be told,
// ONCE, when another slot reaches either shape.
//
// What these checks are really guarding is the difference between a notification and a verdict.
// The message must carry the facts it fired on (branch, ahead/dirty) AND say that "looks done" is a
// predicate, not a report from the lane — CLAUDE.md's four look-alike states are indistinguishable
// to it. A message that read as "it is finished" would turn a wait-remover into a land-trigger.
//
// Timing: the harness shrinks the idle gate (FLEET_AUTO_REVIEW_IDLE_MS=1500) and the delivery tick
// (FLEET_AUTOS_TICK_MS), but the git facts the predicate reads refresh on the 10s tickGit, so the
// first fire cannot happen sooner than that. Every wait here is a POLL with a loud bound, never a
// fixed sleep.
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { auditWatchMessage, laneHostCommitLooking, laneStalled, laneWatchEventKind, laneWatchMessage, laneWatchPayload, laneWatchSignal,
  type AuditWatchEventPayload, type AuditWatchEventView, type ClarificationEventPayload, type LaneSignalView,
  type LaneWatchEventPayload } from "../lane-signals";
import { composerHoldsExactly, composerResidue, composerRows } from "../composer";
import { FLEET_REPORT_STATUSES, type FleetReportEventPayload, type FleetReportStatus } from "../src/protocol";
import { AUTOS_TICK_MS, BASE, REPO, ROOT, TOKEN, check, get, paneEnv, plogRead, post, restartSrv, tmuxOut } from "./harness";

interface WatchRow {
  id: string; slot: number; target: number; targetBranch: string;
  slotOpenedAt?: number;
  // absent = the legacy pane transport; the server never backfills it (see WatchBase)
  delivery?: "pane" | "inbox";
  armed: boolean; firedAt: number | null; lastResult: string | null;
}
type FleetEventStatus = "pending" | "send-uncertain" | "delivered" | "acknowledged" | "receiver-gone"
  | "inbox";
interface FleetEventRow {
  id: string; watchId: string;
  receiverSlot: number; receiverOpenedAt: number; receiverSessionId: string | null; receiverIdleSec: number;
  subjectSlot: number; subjectBranch: string;
  kind: "lane-ready" | "host-commit-ready"; payload: LaneWatchEventPayload;
  createdAt: number; status: FleetEventStatus; attempts: number;
  deliveredAt: number | null; acknowledgedAt: number | null; delivery?: "pane" | "inbox";
}
const ACP26_AUDIT_FIXTURES: { repo: string; mainAfter: string; event: AuditWatchEventView }[] = [
  { repo: "/Users/owner/claude-fleet", mainAfter: "135ea83b91a27d2b348b40c6e65e9bd665f3cdf1",
    event: { id: "f426d94b8bb603d354c6e570", kind: "post-land-audit", payload: {
      result: "green", mainSha: "135ea83b91a27d2b348b40c6e65e9bd665f3cdf1",
      covers: [{ branch: "fleet/260822162835-53ca", mainAfter: "135ea83b91a27d2b348b40c6e65e9bd665f3cdf1" }],
      checks: { ran: 2847, failed: 0 },
    } } },
  { repo: "/Users/owner/claude-fleet", mainAfter: "d93ab4a19f72ba0e031290b25ba14591852cc541",
    event: { id: "df8ca5c5b526e30582e56249", kind: "post-land-audit", payload: {
      result: "green", mainSha: "d93ab4a19f72ba0e031290b25ba14591852cc541",
      covers: [{ branch: "fleet/260823182201-a33f", mainAfter: "d93ab4a19f72ba0e031290b25ba14591852cc541" }],
      checks: { ran: 2946, failed: 0 },
    } } },
];
interface DeployWatchRow {
  id: string; kind: "deploy"; slot: number; deployId: string;
  slotOpenedAt?: number; delivery?: "pane" | "inbox";
  armed: boolean; firedAt: number | null; lastResult: string | null;
}
interface DeployEventRow {
  id: string; watchId: string; receiverSlot: number; receiverOpenedAt: number;
  receiverSessionId: string | null; kind: "deploy-terminal"; subjectDeployId: string;
  payload: { ok: boolean | null; stage: "build" | "restart" | "boot"; target: string | null;
    bootHead: string | null; hitTarget: boolean | null; bundleStale: boolean | null; at: number; reason?: string };
  status: FleetEventStatus; attempts: number; acknowledgedAt: number | null;
  deliveredAt: number | null; delivery?: "pane" | "inbox";
}
interface ClarificationRow {
  id: string; askedAt: number; question: string;
  worker: { slot: number; openedAt: number; sessionId: string | null; cwd: string; branch: string };
  provenance: { taskId: string | null; originId: string | null; programId: string | null };
  receiver: { slot: number; openedAt: number; sessionId: string | null };
  basis: "program-main" | "lane-watch" | "program-main+lane-watch"; eventId: string;
  status: "open" | "send-uncertain" | "answered" | "refused";
  answer: { text: string; at: number; by: { slot: number; openedAt: number; sessionId: string | null } } | null;
  refusedReason: string | null; closedAt: number | null;
}
interface ClarificationEventRow {
  id: string; watchId: null; receiverSlot: number; receiverOpenedAt: number;
  receiverSessionId: string | null; receiverIdleSec: number; subjectSlot: number; subjectBranch: string;
  kind: "clarification-request"; payload: ClarificationEventPayload; createdAt: number;
  status: FleetEventStatus; attempts: number; deliveredAt: number | null; acknowledgedAt: number | null;
}
interface FleetReportRow {
  id: string; reportedAt: number; status: FleetReportStatus; text: string;
  worker: { slot: number; openedAt: number; sessionId: string | null; cwd: string; branch: string };
  provenance: { taskId: string | null; originId: string | null; programId: string | null };
  // null exactly when basis is "owner-inbox" — the owner is a principal, not an occupant
  receiver: { slot: number; openedAt: number; sessionId: string | null } | null;
  basis: "program-main" | "lane-watch" | "program-main+lane-watch" | "owner-inbox"; eventId: string;
}
interface FleetReportEventRow {
  id: string; watchId: null; receiverSlot: number | null; receiverOpenedAt: number | null;
  receiverSessionId: string | null; receiverIdleSec: number; subjectSlot: number; subjectBranch: string;
  kind: "fleet-report"; payload: FleetReportEventPayload; createdAt: number;
  status: FleetEventStatus; attempts: number; deliveredAt: number | null; acknowledgedAt: number | null;
  delivery?: "pane" | "inbox";
}
const watchRows = async (): Promise<WatchRow[]> =>
  ((await (await get("/api/sessions")).json()) as { watches: WatchRow[] }).watches;
const watchRow = async (id: string): Promise<WatchRow | undefined> =>
  (await watchRows()).find((w) => w.id === id);
const eventRows = async (): Promise<FleetEventRow[]> =>
  ((await (await get("/api/sessions")).json()) as { events: FleetEventRow[] }).events;
const eventForWatch = async (watchId: string): Promise<FleetEventRow | undefined> =>
  (await eventRows()).find((e) => e.watchId === watchId);
const deployWatchRows = async (): Promise<DeployWatchRow[]> =>
  (((await (await get("/api/sessions")).json()) as { watches: unknown[] }).watches as DeployWatchRow[])
    .filter((w) => w.kind === "deploy");
const deployEventRows = async (): Promise<DeployEventRow[]> =>
  (((await (await get("/api/sessions")).json()) as { events: unknown[] }).events as DeployEventRow[])
    .filter((e) => e.kind === "deploy-terminal");
const waitDeployEvent = async (watchId: string): Promise<DeployEventRow | undefined> => {
  let found: DeployEventRow | undefined;
  for (let i = 0; i < 120; i++) {
    found = (await deployEventRows()).find((e) => e.watchId === watchId);
    if (found?.status === "delivered" || found?.status === "acknowledged") return found;
    await Bun.sleep(100);
  }
  return found;
};
const freeSlot = async (): Promise<number> =>
  ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
    .slots.find((x) => x.cwd === null)?.id ?? 0;
const persistedOpenedAt = (slot: number): number | undefined =>
  (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
    { slots?: Record<string, { openedAt?: number }> }).slots?.[String(slot)]?.openedAt;
const selfWatch = (tok: string | null, body: unknown): Promise<Response> =>
  fetch(`${BASE}/api/self/watch`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(tok === null ? {} : { "x-fleet-self-token": tok }) },
    body: JSON.stringify(body),
  });
const selfGet = (tok: string): Promise<Response> =>
  fetch(`${BASE}/api/self`, { headers: { "x-fleet-self-token": tok } });
const ackEvent = (tok: string | null, id: string): Promise<Response> =>
  fetch(`${BASE}/api/self/events/${id}/ack`, {
    method: "POST",
    headers: tok === null ? {} : { "x-fleet-self-token": tok },
  });
const selfClarify = (tok: string | null, body: unknown, raw?: string, contentType = "application/json"): Promise<Response> =>
  fetch(`${BASE}/api/self/clarifications`, {
    method: "POST",
    headers: { "content-type": contentType, ...(tok === null ? {} : { "x-fleet-self-token": tok }) },
    body: raw ?? JSON.stringify(body),
  });
const selfClarifications = async (tok: string): Promise<{ response: Response; requests: ClarificationRow[] }> => {
  const response = await fetch(`${BASE}/api/self/clarifications`, {
    headers: { "x-fleet-self-token": tok },
  });
  const body = await response.json() as { requests?: ClarificationRow[] };
  return { response, requests: body.requests ?? [] };
};
const replyClarification = (tok: string, id: string, text: unknown): Promise<Response> =>
  fetch(`${BASE}/api/self/clarifications/${id}/reply`, {
    method: "POST", headers: { "content-type": "application/json", "x-fleet-self-token": tok },
    body: JSON.stringify({ text }),
  });
const clarificationEventRows = async (): Promise<ClarificationEventRow[]> =>
  (((await (await get("/api/sessions")).json()) as { events: unknown[] }).events as ClarificationEventRow[])
    .filter((e) => e.kind === "clarification-request");
const selfFleetReport = (tok: string | null, body: unknown): Promise<Response> =>
  fetch(`${BASE}/api/self/fleet-report`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(tok === null ? {} : { "x-fleet-self-token": tok }) },
    body: JSON.stringify(body),
  });
const selfFleetReports = async (tok: string): Promise<{ response: Response; reports: FleetReportRow[] }> => {
  const response = await fetch(`${BASE}/api/self/fleet-report`, {
    headers: { "x-fleet-self-token": tok },
  });
  const body = await response.json() as { reports?: FleetReportRow[] };
  return { response, reports: body.reports ?? [] };
};
const fleetReportEventRows = async (): Promise<FleetReportEventRow[]> =>
  (((await (await get("/api/sessions")).json()) as { events: unknown[] }).events as FleetReportEventRow[])
    .filter((e) => e.kind === "fleet-report");
// V1b — the return-path projection, read off the ROUTE. It is derived per request and persisted
// nowhere, so a fleet.json read would answer `undefined` for every program and look like a missing
// field rather than a reader asking the wrong source.
interface ProgramBudgetRow {
  id: string;
  deliveryBudget?: { state?: string; deliveryDebts?: number; armedReservations?: number;
    cap?: number; free?: number; reason?: string };
  deliveryBudgetNote?: string;
}
const programBudget = async (id: string): Promise<ProgramBudgetRow | undefined> =>
  (((await (await get("/api/programs")).json()) as { programs: ProgramBudgetRow[] }).programs)
    .find((p) => p.id === id);
interface AuditRow { event?: string; slot?: number; detail?: string }
let auditReadError = "";
const auditRows = (): AuditRow[] => [
  { file: `${ROOT}/audit.jsonl.1`, required: false },
  { file: `${ROOT}/audit.jsonl`, required: true },
].flatMap(({ file, required }) => {
  try {
    return readFileSync(file, "utf8").split("\n").filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line) as AuditRow]; }
      catch (error) {
        auditReadError = `${file}: ${error instanceof Error ? error.message : String(error)}`;
        return [];
      }
    });
  } catch (error) {
    if (required) auditReadError = `${file}: ${error instanceof Error ? error.message : String(error)}`;
    return [];
  }
});

export async function run(): Promise<void> {
  // A real process kill cannot reliably land in the sub-millisecond gap between a local tmux
  // call and its return. Pin the ordering that creates that observable crash state, then exercise
  // its persisted image below: marker -> awaited state write -> send, and pending is the sole
  // transport input. Moving any one of those four facts makes this check red.
  const serverSource = readFileSync(`${ROOT}/server.ts`, "utf8");
  const tickStart = serverSource.indexOf("async function tickWatches()");
  const tickSource = tickStart < 0 ? "" : serverSource.slice(tickStart,
    serverSource.indexOf("// The one-line receiver text", tickStart));
  const uncertainAt = tickSource.indexOf('event.status = "send-uncertain";');
  const persistedAt = tickSource.indexOf("await saveStateNow();", uncertainAt);
  const sendAt = tickSource.indexOf("await sendText(s, text, true, { rollbackOwnPayload: true })", persistedAt);
  check("watch transport persists send-uncertain before sendText and retries pending only",
    tickSource.includes('if (event.status !== "pending") continue;')
    && uncertainAt >= 0 && persistedAt > uncertainAt && sendAt > persistedAt,
    `${uncertainAt}:${persistedAt}:${sendAt}`);

  // --- ACP-25: ACCEPTANCE IS OBSERVED, NOT ECHOED. `delivered` used to mean "tmux accepted
  // paste+Enter"; ACP-21 measured the Enter being lost after a collapsed paste (2/7) and the live
  // 2026-08-22 codex case left a whole event in the composer while the row said delivered. The
  // transport now reads the composer after Enter (server.ts sendText, composer.ts). The pure
  // reader is pinned here against the frames MEASURED on the real binaries on 2026-08-22 — byte
  // shapes from `capture-pane -p -e`, including the dim placeholder that separates "empty" from
  // "owner draft". The stand-in harness of this suite declares no composer, so the live half
  // below proves the not-applicable answer and the delivered-only-after-observation rail.
  {
    const E = "\x1b";
    const claude = { kind: "glyph" as const, re: /^❯/ };
    const codex = { kind: "glyph" as const, re: /^›/ };
    const pi = { kind: "rules" as const };
    const rule = "─".repeat(120);
    const footer = `${rule}\n  ctx [----------] --%  |  Opus 5 (1M context)\n  ⏵⏵ bypass permissions on`;
    // claude 2.1.240: idle composer with the dim placeholder (fresh pane, --prompt-suggestions false)
    const claudeIdle = `${rule}\n${E}[39m❯  ${E}[2mTry "fix lint errors"${E}[0m\n${footer}`;
    check("acceptance reader: claude's dim placeholder reads as an EMPTY composer",
      composerResidue(claude, claudeIdle) === "", JSON.stringify(composerResidue(claude, claudeIdle)));
    // the ACP-21 loss signature: the paste collapsed, Enter gone, 15 s later unchanged
    const claudeLost = `⏺ earlier turn\n${rule}\n${E}[39m❯  [Pasted text #1 +202 lines]\n${footer}`;
    check("acceptance reader: the ACP-21 loss signature is RESIDUE, not acceptance",
      composerResidue(claude, claudeLost) === "[Pasted text #1 +202 lines]",
      JSON.stringify(composerResidue(claude, claudeLost)));
    // the hint Claude paints while a queued message waits: dim, then a second SGR, then text —
    // the form that broke a span-based strip (measured on the real-TUI probe, 2026-08-22)
    const claudeQueued = `${E}[37m${E}[100m❯ ${E}[97mreply OK${E}[39m\n${rule}\n❯  ${E}[2m${E}[39mPress up to edit queued messages${E}[0m\n${footer}`;
    check("acceptance reader: claude's queued-messages hint (dim, then another SGR) reads as EMPTY",
      composerResidue(claude, claudeQueued) === "", JSON.stringify(composerResidue(claude, claudeQueued)));
    // a typed owner draft carries no dim span — that is what makes it distinguishable at all
    const claudeDraft = `${rule}\n${E}[39m❯  owner draft${E}[7m ${E}[0m\n${footer}`;
    check("acceptance reader: a typed claude draft is residue (occupied composer)",
      composerResidue(claude, claudeDraft) === "owner draft", JSON.stringify(composerResidue(claude, claudeDraft)));
    // codex-cli 0.147.0 after a submitted turn: the transcript ECHO uses the same `›` glyph above,
    // the composer below shows its dim rotating placeholder. Only the LAST `›` line is the composer.
    const codexAfter = [`${E}[1;2m› ${E}[0mACP25 probe one-liner, reply with the single word OK.`, "",
      "• Working (1s • esc to interrupt)", "", `${E}[1m›${E}[0m ${E}[2mSummarize recent commits${E}[0m`, "",
      "  gpt-5.6-sol high · /tmp/x"].join("\n");
    check("acceptance reader: codex's transcript echo above a placeholder composer reads EMPTY (last-glyph rule)",
      composerResidue(codex, codexAfter) === "", JSON.stringify(composerResidue(codex, codexAfter)));
    const codexHeld = [`${E}[1;2m› ${E}[0mearlier turn`, "", `${E}[1m›${E}[0m lane-ready event text still here`, ""].join("\n");
    check("acceptance reader: the 2026-08-22 codex symptom (event text in the composer) is residue",
      composerResidue(codex, codexHeld) === "lane-ready event text still here",
      JSON.stringify(composerResidue(codex, codexHeld)));
    // pi 0.84.0: no glyph; the composer is the region between the last two rules
    const piFrame = (body: string) => [" ACP25 echo", " ⠇ Working...", rule, body, rule, "/tmp/x", "$0.000 (sub)"].join("\n");
    check("acceptance reader: pi's empty rule-bounded composer reads EMPTY",
      composerResidue(pi, piFrame("")) === "", JSON.stringify(composerResidue(pi, piFrame(""))));
    check("acceptance reader: a typed pi draft between the rules is residue",
      composerResidue(pi, piFrame(`${E}[39mowner draft${E}[7m ${E}[0m`)) === "owner draft",
      JSON.stringify(composerResidue(pi, piFrame("owner draft"))));
    check("acceptance reader: a frame without the composer (dialog, stand-in binary) is null, never empty",
      composerResidue(claude, "Do you trust the files in this folder?\n  1. Yes\n  2. No") === null
      && composerResidue(pi, "just text\nno rules") === null, "null expected for both");

    // ACP-26: rollback compares the complete freshly rendered region with Fleet's own payload.
    // These are the TWO observed production post-land event shapes, copied without credentials:
    // explicit pane delivery / 60 s (f426…, one attempt) and legacy absent delivery / 15 s
    // (df8…, attempts accumulated while the occupied composer correctly refused another paste).
    const auditFixtures = ACP26_AUDIT_FIXTURES;
    const wrapPayload = (text: string, width = 106): string[] => {
      const rows: string[] = [];
      let rest = text;
      while (rest.length > width) {
        const at = rest.lastIndexOf(" ", width);
        if (at <= 0) throw new Error("rollback fixture has no wrap boundary");
        rows.push(rest.slice(0, at));
        rest = rest.slice(at + 1); // the measured visual wrap omits this one payload space
      }
      rows.push(rest);
      return rows;
    };
    const claudeWrapped = (rows: readonly string[]) => `${rule}\n${E}[39m❯\u00a0${rows[0]}\n`
      + `${rows.slice(1).map((r) => `  ${r}`).join("\n")}\n${footer}`;
    const codexWrapped = (rows: readonly string[]) => [`${E}[1;2m› ${E}[0mearlier turn`, "",
      `${E}[1m›${E}[0m ${rows[0]}`, ...rows.slice(1).map((r) => `  ${r}`), "",
      `  ${E}[2;3mno matches${E}[0m`, "", `  Press ${E}[2menter${E}[0m to insert or ${E}[2mesc${E}[0m to close`].join("\n");
    const piWrapped = (rows: readonly string[]) => piFrame(rows.join("\n"));
    const exact = (form: typeof claude | typeof pi, frame: string, payload: string): boolean => {
      const rows = composerRows(form, frame);
      return rows !== null && composerHoldsExactly(rows, payload);
    };
    for (const [i, fixture] of auditFixtures.entries()) {
      const payload = auditWatchMessage(fixture.repo, fixture.mainAfter, fixture.event);
      const rows = wrapPayload(payload);
      check(`rollback reader: observed post-land event shape ${i + 1} reconstructs exactly on Claude, Codex and Pi`,
        exact(claude, claudeWrapped(rows), payload) && exact(codex, codexWrapped(rows), payload)
          && exact(pi, piWrapped(rows), payload),
        JSON.stringify({ bytes: Buffer.byteLength(payload), rows: rows.length }));
    }
    const exactPayload = auditWatchMessage(auditFixtures[0].repo, auditFixtures[0].mainAfter,
      auditFixtures[0].event);
    const exactRows = wrapPayload(exactPayload);
    const ownerAppend = [...exactRows.slice(0, -1), `${exactRows.at(-1)} owner append`];
    const ownerPrepend = [`owner prepend ${exactRows[0]}`, ...exactRows.slice(1)];
    const ownerEdit = [...exactRows];
    ownerEdit[1] = ownerEdit[1].replace("reached", "REACHED");
    const boundaryEdit = [...exactRows];
    boundaryEdit[1] = boundaryEdit[1].slice(1);
    const hiddenAfterBlank = [`${E}[1m›${E}[0m ${exactRows[0]}`,
      ...exactRows.slice(1).map((r) => `  ${r}`), "", "  owner text after an input blank", "",
      "  gpt-5.6-sol high · ~/x"].join("\n");
    check("rollback falsifier: append, prepend, edit, wrap-boundary edit and text below a blank all survive as differences",
      !exact(codex, codexWrapped(ownerAppend), exactPayload)
      && !exact(claude, claudeWrapped(ownerPrepend), exactPayload)
      && !exact(pi, piWrapped(ownerEdit), exactPayload)
      && !exact(codex, codexWrapped(boundaryEdit), exactPayload)
      && composerRows(codex, hiddenAfterBlank) === null,
      "all five comparisons must be false/null");
    check("rollback falsifier: placeholder, unobservable composer and empty region never equal Fleet's payload",
      !composerHoldsExactly(composerRows(claude, claudeLost) ?? [], exactPayload)
      && composerRows(claude, "Do you trust the files in this folder?") === null
      && !composerHoldsExactly([""], exactPayload), "false / null / false expected");
    check("rollback reader: exact rows preserve owner whitespace and NBSP instead of normalizing or trimming it",
      composerRows(pi, piFrame(` ${exactPayload} `))?.[0] === ` ${exactPayload} `
      && !exact(pi, piFrame(` ${exactPayload} `), exactPayload)
      && !exact(pi, piFrame(exactPayload.replace(" ", "\u00a0")), exactPayload),
      JSON.stringify(composerRows(pi, piFrame(` ${exactPayload} `))?.[0]?.slice(0, 20)));

    // Source-order falsifiers pin the destructive boundary: only the event caller opts in; identity
    // and the fresh exact read precede BSpace; no broad clear or second Enter exists in rollback;
    // event truth reaches deliveredAt only after observed acceptance.
    const rollbackSource = serverSource.slice(serverSource.indexOf("async function rollbackOwnComposerPayload("),
      serverSource.indexOf("async function awaitComposer("));
    const eventSendAt = tickSource.indexOf("rollbackOwnPayload: true");
    const eventCatchAt = tickSource.indexOf("fleet_event_send_uncertain", eventSendAt);
    const eventDeliveredAt = tickSource.indexOf('event.status = "delivered";', eventCatchAt);
    const eraseAt = rollbackSource.indexOf('"BSpace"');
    const beforeErase = rollbackSource.slice(0, eraseAt);
    check("rollback boundary: event-only opt-in, fresh read + repeated exact identity checks precede exact-count BSpace",
      eventSendAt >= 0 && rollbackSource.includes("readExactComposer(s, bound)") && eraseAt > 0
      && beforeErase.indexOf("readExactComposer(s, bound)") < beforeErase.lastIndexOf("sameBoundPane(s, bound)")
      && (beforeErase.match(/sameBoundPane\(s, bound\)/g)?.length ?? 0) >= 3
      && beforeErase.includes('read.kind === "failed"') && beforeErase.includes('read.kind === "unobservable"')
      && serverSource.indexOf('if (after === null) return { acceptance: "unobservable" as const };')
        < serverSource.indexOf("rollbackOwnComposerPayload(s, bound, text)"),
      `${eventSendAt}:${rollbackSource.length}`);
    check("rollback boundary: no Ctrl-C/Ctrl-U/broad clear/second Enter, and uncertain events cannot acquire deliveredAt",
      !rollbackSource.includes("C-c") && !rollbackSource.includes("C-u") && !rollbackSource.includes("Enter")
      && rollbackSource.match(/send-keys/g)?.length === 1
      && eventCatchAt > eventSendAt && eventDeliveredAt > eventCatchAt
      && tickSource.slice(eventCatchAt, eventDeliveredAt).includes("continue;"),
      `${eventCatchAt}:${eventDeliveredAt}`);
    // the live contract on this suite's stand-in harness: not-applicable, never observed or submitted
    const naOpen = await post("/api/slots/12/open", { cwd: ROOT });
    check("acceptance live: a slot opens for the receipt-anatomy probe", naOpen.ok, String(naOpen.status));
    if (naOpen.ok) {
      const res = await post("/send", { slot: 12, text: "acp25 receipt anatomy probe", submit: true });
      const body = await res.json() as { ok?: boolean; receipt?: Record<string, unknown> };
      check("acceptance live: /send on a composer-less harness answers submitRequested:true + acceptance:not-applicable and no `submitted`",
        res.ok && body.ok === true && body.receipt?.submitRequested === true
        && body.receipt?.acceptance === "not-applicable" && !("submitted" in (body.receipt ?? {})),
        JSON.stringify(body).slice(0, 200));
      await post("/api/slots/12/kill", {});
    }
    // the transport rail, pinned at source: `delivered` is written only after the acceptance
    // read, and an unobservable send keeps the persisted send-uncertain marker.
    const acceptAt = tickSource.indexOf("({ acceptance } = await sendText(s, text, true, { rollbackOwnPayload: true }))");
    const unobsAt = tickSource.indexOf('acceptance === "unobservable"', acceptAt);
    const deliveredAt = tickSource.indexOf('event.status = "delivered";', unobsAt);
    check("watch transport: FleetEvent turns delivered only after the acceptance read, and unobservable stays send-uncertain",
      acceptAt >= 0 && sendAt > acceptAt && unobsAt > acceptAt && deliveredAt > unobsAt
      && tickSource.slice(unobsAt, deliveredAt).includes("continue;"),
      `${acceptAt}:${unobsAt}:${deliveredAt}`);
  }

  // --- THE HOST-COMMIT SIBLING. The isolated server deliberately runs with foreign-harness
  // automation OFF (a policy family later proves that refusal). The pure selector below isolates
  // the TARGET's fenced-host-commit completion shape; the runtime blocks below separately prove
  // delivery, including tickWatches' narrow receiver-policy waiver for a live pi-unfenced slot.
  {
    const h: LaneSignalView = { alive: true, idleMs: 5000, git: { dirty: 1, ahead: 0 }, gitOp: false,
      merge: null, observed: true, awaiting: null, hostCommits: true };
    const signal = laneWatchSignal(h, 1500);
    check("watch selector accepts the host-committed dirty+zero-ahead completion shape",
      signal === "host-commit-looking", String(signal));
    if (signal) {
      const text = laneWatchMessage(7, "host-branch", {
        id: "typedfixture", kind: laneWatchEventKind(signal), payload: laneWatchPayload(h),
      });
      check("host-commit watch text names the weaker fact and exact host action",
        text.includes("LOOKS ready for a host commit")
        && text.includes("The work is UNCOMMITTED, 0 ahead is expected for this harness, and the next step is a host commit via POST /api/slots/7/commit.")
        && text.includes("server's weaker predicate") && text.includes("NOT a report from that lane")
        && text.includes("[event typedfixture]")
        && text.includes("POST /api/self/events/typedfixture/ack"), text);
    }
  }

  // --- the original subject: a lane that commits and goes quiet (idle + clean + ahead>0) ---
  const tgt = (await (await post("/api/lanes", { repo: REPO })).json()) as
    { slot: number; cwd: string; branch: string };
  await Bun.write(`${tgt.cwd}/watch-target.txt`, "the work the watcher is waiting for\n");
  spawnSync("git", ["-C", tgt.cwd, "add", "watch-target.txt"]);
  spawnSync("git", ["-C", tgt.cwd, "commit", "-qm", "watch target lane work"]);

  // --- THE MEASURED RETURN-CHANNEL DEFECT. The wrapper's initial server alone has a scratch
  // executable named `pi` on PATH, while FLEET_HARNESS_AUTOMATION=0 stays closed. That makes a
  // pi-unfenced main slot mechanically alive without a provider call. This must be a runtime
  // counterprobe, not a selector unit check: tickWatches is the sole caller allowed to waive the
  // harness WORK-prompt policy for an explicit subscription's fixed completion notification.
  // It must run before this module's restartSrv() below, which deliberately restores normal PATH.
  {
    // Own target identity: the later owner-route check deliberately reuses `tgt` and may recycle
    // this receiver slot. Sharing both would make its exact-once log count include this fixture's
    // earlier delivery. A separate lane gives this probe a disjoint message prefix and is killed
    // with it, so neither family's evidence can satisfy or poison the other.
    const uTgt = (await (await post("/api/lanes", { repo: REPO })).json()) as
      { slot: number; cwd: string; branch: string };
    await Bun.write(`${uTgt.cwd}/watch-pi-unfenced-target.txt`, "isolated watch target\n");
    spawnSync("git", ["-C", uTgt.cwd, "add", "watch-pi-unfenced-target.txt"]);
    spawnSync("git", ["-C", uTgt.cwd, "commit", "-qm", "pi-unfenced watch target"]);
    check("watch pi-unfenced fixture: its controlled target is a distinct committed lane",
      uTgt.slot > 0 && uTgt.slot !== tgt.slot, JSON.stringify(uTgt));

    const uId = await freeSlot();
    const openU = uId ? await post(`/api/slots/${uId}/open`, { cwd: REPO, harness: "pi-unfenced" }) : null;
    check("watch pi-unfenced fixture: a plain main-only receiver opens on the scratch Pi stand-in",
      !!openU?.ok, `${uId} ${openU?.status}`);

    let uAgent: string | null | undefined;
    for (let i = 0; i < 80 && uAgent !== "alive"; i++) {
      const rows = ((await (await get("/api/sessions")).json()) as
        { slots: { id: number; agent: string | null }[] }).slots;
      uAgent = rows.find((x) => x.id === uId)?.agent;
      if (uAgent !== "alive") await Bun.sleep(250);
    }
    check("watch pi-unfenced fixture: the stand-in is genuinely live (agent=alive), not merely a pane",
      uAgent === "alive", String(uAgent));

    const uTok = await paneEnv(`s${uId}`, "FLEET_SELF_TOKEN") ?? "";
    check("watch pi-unfenced fixture: the live receiver answers with its pane-exported Self token",
      /^[0-9a-f]{32}$/.test(uTok), `[${uTok}]`);

    // ACP-26 LIVE: real FleetEvent transport, not a direct /send surrogate. The stand-in swallows
    // Enter under a suite-owned mode, keeps its internal input bytes in a side file, and implements
    // exact BSpace. The first two rows carry the production payload values above and cover both the
    // explicit delivery:"pane" and legacy absent-delivery forms. A successful rollback still
    // leaves send-uncertain + deliveredAt:null and is never retried.
    const composerMode = process.env.FLEET_E2E_COMPOSER_MODE ?? "";
    const composerState = process.env.FLEET_E2E_COMPOSER_STATE ?? "";
    const auditFile = `${ROOT}/post-land-audits.jsonl`;
    const auditFileExisted = existsSync(auditFile);
    const auditFileBefore = auditFileExisted ? readFileSync(auditFile, "utf8") : "";
    check("rollback live fixture: suite-owned mode/state paths and the raw-mode stand-in are observable",
      composerMode.length > 0 && composerState.length > 0 && existsSync(composerMode) && existsSync(composerState),
      JSON.stringify({ modePath: !!composerMode, statePath: !!composerState }));
    const stateBuffer = (): { phase: string; text: string } => {
      const raw = readFileSync(composerState, "utf8");
      const nl = raw.indexOf("\n");
      return { phase: nl < 0 ? raw : raw.slice(0, nl), text: nl < 0 ? "" : raw.slice(nl + 1) };
    };
    const waitComposerState = async (eventId: string,
      accepts: (s: { phase: string; text: string }) => boolean): Promise<{ phase: string; text: string }> => {
      let state = stateBuffer();
      for (let i = 0; i < 160 && !(state.phase.endsWith(`:${eventId}`) && accepts(state)); i++) {
        await Bun.sleep(50);
        state = stateBuffer();
      }
      return state;
    };
    const setComposerMode = (mode: string) => writeFileSync(composerMode, `${mode}\n`);
    const appendAudit = (mainAfter: string, mainSha: string, checks: { ran: number; failed: number }) => {
      const at = Date.now() + Number.parseInt(mainAfter.slice(0, 4), 16);
      appendFileSync(auditFile, `${JSON.stringify({ at, startedAt: at - 1, ms: 1, repo: REPO, main: "main",
        mainSha, result: "green", cmd: "acp26-fixture", exitCode: 0, out: "ALL PASS", checks,
        covers: [{ branch: `fleet/acp26-${mainAfter.slice(0, 8)}`, mainAfter, at: at - 2 }] })}\n`);
    };
    interface LiveAuditEvent {
      id: string; watchId: string; receiverSlot: number; receiverOpenedAt: number;
      receiverSessionId: string | null; receiverIdleSec: number; kind: "post-land-audit";
      subjectRepo: string; subjectMainAfter: string; payload: AuditWatchEventPayload;
      createdAt: number; status: FleetEventStatus; attempts: number; deliveredAt: number | null;
      acknowledgedAt: number | null; delivery?: "pane" | "inbox";
    }
    const waitAuditEvent = async (watchId: string): Promise<LiveAuditEvent | undefined> => {
      let event: LiveAuditEvent | undefined;
      for (let i = 0; i < 120 && event?.status !== "send-uncertain"; i++) {
        event = ((await eventRows()) as unknown as LiveAuditEvent[]).find((e) => e.watchId === watchId);
        if (event?.status !== "send-uncertain") await Bun.sleep(100);
      }
      return event;
    };
    const fireAudit = async (fixture: typeof ACP26_AUDIT_FIXTURES[number], delivery: "pane" | undefined,
      mode: string): Promise<{ event?: LiveAuditEvent; expected: string; watchStatus: number }> => {
      setComposerMode(mode);
      appendAudit(fixture.mainAfter, fixture.event.payload.mainSha, fixture.event.payload.checks!);
      const response = await post(`/api/slots/${uId}/watch`, {
        kind: "audit", repo: REPO, mainAfter: fixture.mainAfter, idleSec: 0,
        ...(delivery ? { delivery } : {}),
      });
      const body = await response.json() as { watch?: { id: string } };
      const event = body.watch?.id ? await waitAuditEvent(body.watch.id) : undefined;
      const expected = event ? auditWatchMessage(event.subjectRepo, event.subjectMainAfter, event) : "";
      return { event, expected, watchStatus: response.status };
    };

    for (const [i, fixture] of ACP26_AUDIT_FIXTURES.entries()) {
      const live = await fireAudit(fixture, i === 0 ? "pane" : undefined, "hold");
      const internal = live.event
        ? await waitComposerState(live.event.id, (s) => s.phase.startsWith("backspace:") && s.text === "")
        : stateBuffer();
      const frame = (await tmuxOut("capture-pane", "-p", "-e", "-t", `s${uId}`)).out;
      check(`rollback live: observed audit shape ${i + 1} cannot strand exact Fleet text`,
        live.watchStatus === 200 && live.event?.status === "send-uncertain"
        && live.event.attempts === 1 && live.event.deliveredAt === null
        && internal.text === "" && composerResidue({ kind: "rules" }, frame) === "",
        JSON.stringify({ status: live.watchStatus, event: live.event?.status, attempts: live.event?.attempts,
          deliveredAt: live.event?.deliveredAt, state: internal.phase, bytes: internal.text.length }));
      if (live.event) await fetch(`${BASE}/api/self/events/${live.event.id}/ack`, {
        method: "POST", headers: { "x-fleet-self-token": uTok },
      });
    }

    const ownerCases = [
      { mode: "append", suffix: " owner append" },
      { mode: "edit", suffix: null },
      { mode: "placeholder", suffix: null },
    ] as const;
    for (const [i, ownerCase] of ownerCases.entries()) {
      const mainAfter = `${(0xa110 + i).toString(16).padStart(4, "0")}${"0".repeat(36)}`;
      const fixture = { repo: REPO, mainAfter, event: { id: "0".repeat(24), kind: "post-land-audit" as const,
        payload: { result: "green" as const, mainSha: mainAfter,
          covers: [{ branch: `fleet/acp26-owner-${i}`, mainAfter }], checks: { ran: 1, failed: 0 } } } };
      const live = await fireAudit(fixture, undefined, ownerCase.mode);
      const internal = live.event
        ? await waitComposerState(live.event.id, (s) => s.phase.startsWith("entered:")) : stateBuffer();
      const expectedInternal = ownerCase.mode === "append" ? `${live.expected}${ownerCase.suffix}`
        : ownerCase.mode === "edit" ? `${live.expected[0]}${live.expected[1] === "f" ? "F" : "X"}${live.expected.slice(2)}`
        : live.expected;
      check(`rollback live falsifier: ${ownerCase.mode} leaves the complete internal composer byte-for-byte`,
        live.event?.status === "send-uncertain" && live.event.deliveredAt === null
        && internal.text === expectedInternal,
        JSON.stringify({ status: live.event?.status, deliveredAt: live.event?.deliveredAt,
          phase: internal.phase, gotBytes: internal.text.length, expectedBytes: expectedInternal.length }));
      if (live.event) await fetch(`${BASE}/api/self/events/${live.event.id}/ack`, {
        method: "POST", headers: { "x-fleet-self-token": uTok },
      });
      // The probe, acting as the owner, clears only its synthetic fixture between cases. Product
      // rollback never reaches this line and never uses a broad clear.
      await tmuxOut("send-keys", "-t", `s${uId}`, "-N", String([...internal.text].length), "BSpace");
      if (live.event) await waitComposerState(live.event.id, (s) => s.text === "");
      setComposerMode("hold");
    }
    // Later modules own the post-land ledger's zero-row and exact-count fixtures. Restore the byte
    // snapshot rather than making them measure ACP-26's synthetic transport rows.
    if (auditFileExisted) writeFileSync(auditFile, auditFileBefore);
    else rmSync(auditFile, { force: true });
    setComposerMode("normal");
    await tmuxOut("send-keys", "-t", `s${uId}`, "BSpace"); // repaint the now-empty normal composer
    await Bun.sleep(100);
    const catalog = (await (await get("/api/harnesses")).json()) as
      { harnesses: { id: string; automatable: boolean; allowsLanes: boolean; singleton: boolean }[] };
    const uHarness = catalog.harnesses.find((h) => h.id === "pi-unfenced");
    check("pi-unfenced's static adapter policy stays false/main-only/singleton; the Watch exception belongs to the subscribed act",
      uHarness?.automatable === false && uHarness.allowsLanes === false && uHarness.singleton === true,
      JSON.stringify(uHarness));

    check("watch pi-unfenced kill-switch fixture: owner pauses automation before subscribing",
      (await post("/api/autos/switch", { on: false })).ok);
    const subscribed = await selfWatch(uTok, { target: uTgt.slot, idleSec: 0 });
    const subscribedJ = (await subscribed.json()) as { watch?: WatchRow; error?: string };
    check("live pi-unfenced Self route explicitly subscribes to its controlled committed lane",
      subscribed.ok && subscribedJ.watch?.armed === true && subscribedJ.watch.target === uTgt.slot,
      `${subscribed.status} ${JSON.stringify(subscribedJ)}`);

    // Only structural prerequisites exposed by this poll: committed+clean target facts and the
    // armed subscription. `lastOutput>0` is not required by idleSec:0 and was a false fixture gate.
    let targetReady = false;
    for (let i = 0; i < 60 && !targetReady; i++) {
      const rows = ((await (await get("/api/sessions")).json()) as
        { slots: { id: number; git: { ahead?: number; dirty?: number } | null }[] }).slots;
      const row = rows.find((x) => x.id === uTgt.slot);
      targetReady = row?.git?.ahead === 1 && row.git.dirty === 0;
      if (!targetReady) await Bun.sleep(500);
    }
    check("watch pi-unfenced kill-switch fixture: target is measurably committed+clean",
      targetReady, String(targetReady));
    await Bun.sleep(AUTOS_TICK_MS * 4 + 500);
    const paused = subscribedJ.watch?.id ? await watchRow(subscribedJ.watch.id) : undefined;
    const pausedEvent = subscribedJ.watch?.id ? await eventForWatch(subscribedJ.watch.id) : undefined;
    check("signal capture spends the pi-unfenced Watch and persists exactly one event even while transport is paused",
      paused?.armed === false && pausedEvent?.status === "pending"
      && (await eventRows()).filter((e) => e.watchId === subscribedJ.watch?.id).length === 1
      && !(await plogRead()).some((e) => e.slot === uId
        && e.text.startsWith(`[fleet] slot ${uTgt.slot} (${uTgt.branch})`)),
      JSON.stringify({ watch: paused, event: pausedEvent }));
    check("watch pi-unfenced kill-switch fixture: owner releases automation",
      (await post("/api/autos/switch", { on: true })).ok);

    let delivered: FleetEventRow | undefined;
    for (let i = 0; i < 45 && delivered?.status !== "delivered"; i++) {
      await Bun.sleep(1000);
      delivered = subscribedJ.watch?.id ? await eventForWatch(subscribedJ.watch.id) : undefined;
    }
    const oldPolicySkip = "skipped — harness pi-unfenced is not automatable";
    check("after kill-switch release the pending event reaches live pi-unfenced once as delivered, never acked by tmux",
      delivered?.status === "delivered" && delivered.attempts === 1
      && delivered.acknowledgedAt === null, JSON.stringify(delivered));
    const uMessages = (await plogRead()).filter((e) => e.slot === uId
      && e.text.startsWith(`[fleet] slot ${uTgt.slot} (${uTgt.branch})`));
    check("the fixed completion notification has exactly one matching prompt-log row on pi-unfenced",
      uMessages.length === 1, `${uMessages.length}: ${uMessages.map((m) => m.text.slice(0, 80)).join(" | ")}`);
    await Bun.sleep(AUTOS_TICK_MS * 4 + 1500);
    const uAfter = subscribedJ.watch?.id ? await watchRow(subscribedJ.watch.id) : undefined;
    const uEventAfter = subscribedJ.watch?.id ? await eventForWatch(subscribedJ.watch.id) : undefined;
    check("the pi-unfenced event remains one-shot across later ticks and never records the old skip",
      uAfter?.armed === false && uAfter.lastResult === "sent" && uEventAfter?.status === "delivered"
      && (await plogRead()).filter((e) => e.slot === uId
        && e.text.startsWith(`[fleet] slot ${uTgt.slot} (${uTgt.branch})`)).length === 1
      && !(await watchRows()).some((w) => w.slot === uId && (w.lastResult ?? "").includes(oldPolicySkip)),
      JSON.stringify({ watch: uAfter, event: uEventAfter }));

    // Identity falsifier: recycle the numeric slot while an exact held payload is inside the
    // failure window, then type an owner draft into the successor. rollbackOwnComposerPayload must
    // compare the snapshotted slot+openedAt+sessionId before BSpace and leave the successor bytes.
    const identityMainAfter = `ac260000${"0".repeat(32)}`;
    setComposerMode("hold");
    appendAudit(identityMainAfter, identityMainAfter, { ran: 1, failed: 0 });
    const identityWatchRes = await post(`/api/slots/${uId}/watch`, {
      kind: "audit", repo: REPO, mainAfter: identityMainAfter, idleSec: 0,
    });
    const identityWatch = await identityWatchRes.json() as { watch?: { id: string } };
    const identityEvent = identityWatch.watch?.id ? await waitAuditEvent(identityWatch.watch.id) : undefined;
    const heldIdentity = identityEvent
      ? await waitComposerState(identityEvent.id, (s) => s.phase.startsWith("entered:") && s.text.includes(identityEvent.id))
      : stateBuffer();
    const oldOpenedAt = identityEvent?.receiverOpenedAt;
    await post(`/api/slots/${uId}/kill`, {});
    setComposerMode("normal");
    const successorOpen = await post(`/api/slots/${uId}/open`, { cwd: REPO, harness: "pi-unfenced" });
    let successorOpenedAt = 0;
    let successorAgent: string | null = null;
    for (let i = 0; i < 80 && successorAgent !== "alive"; i++) {
      const row = ((await (await get("/api/sessions")).json()) as
        { slots: { id: number; openedAt: number; agent: string | null }[] }).slots.find((s) => s.id === uId);
      successorOpenedAt = row?.openedAt ?? 0;
      successorAgent = row?.agent ?? null;
      if (successorAgent !== "alive") await Bun.sleep(50);
    }
    // Let the old inputChain settle through its identity refusal before composing on the successor.
    await Bun.sleep(Number(process.env.FLEET_ACCEPT_WAIT_MS ?? 800) + 200);
    const successorDraft = "owner successor draft survives slot reuse";
    const successorSend = await post("/send", { slot: uId, text: successorDraft, submit: false });
    let successorState = stateBuffer();
    for (let i = 0; i < 80 && successorState.text !== successorDraft; i++) {
      await Bun.sleep(50);
      successorState = stateBuffer();
    }
    check("rollback live falsifier: recycled slot identity leaves the successor owner's draft byte-for-byte",
      identityWatchRes.ok && heldIdentity.text.includes(identityEvent?.id ?? "not-an-event")
      && successorOpen.ok && successorAgent === "alive" && successorOpenedAt !== oldOpenedAt
      && successorSend.ok && successorState.text === successorDraft,
      JSON.stringify({ watch: identityWatchRes.status, heldBytes: heldIdentity.text.length,
        open: successorOpen.status, agent: successorAgent, identityChanged: successorOpenedAt !== oldOpenedAt,
        send: successorSend.status, draftBytes: successorState.text.length }));
    if (auditFileExisted) writeFileSync(auditFile, auditFileBefore);
    else rmSync(auditFile, { force: true });
    await post(`/api/slots/${uTgt.slot}/kill`, {});
    await post(`/api/slots/${uId}/kill`, {});
  }

  // === CLARIFICATION-CHANNEL-V1 ================================================================
  // All receiver identities below are established as server facts first. The only direct state
  // mutation is the persisted Program/task provenance fixture and one deliberately legacy Watch;
  // the request route then has no caller-supplied identity it could accidentally trust.
  {
    const main1 = await freeSlot();
    const main1Open = main1 ? await post(`/api/slots/${main1}/open`, { cwd: REPO, label: "clarification-main" }) : null;
    const main2 = await freeSlot();
    const main2Open = main2 ? await post(`/api/slots/${main2}/open`, { cwd: REPO, label: "clarification-other-main" }) : null;
    const makeLane = async () => (await (await post("/api/lanes", { repo: REPO })).json()) as
      { slot: number; cwd: string; branch: string };
    const prog = await makeLane();
    const watched = await makeLane();
    const agreed = await makeLane();
    const conflicted = await makeLane();
    const multi = await makeLane();
    const none = await makeLane();
    const legacy = await makeLane();
    const replacedMainWorker = await makeLane();
    const legacyOwner = await makeLane();
    check("clarification fixtures: two MAIN occupants and nine distinct worker lanes exist",
      !!main1Open?.ok && !!main2Open?.ok
        && new Set([prog, watched, agreed, conflicted, multi, none, legacy, replacedMainWorker, legacyOwner]
          .map((x) => x.slot)).size === 9,
      JSON.stringify({ main1, main2, lanes: [prog, watched, agreed, conflicted, multi, none, legacy, replacedMainWorker, legacyOwner].map((x) => x.slot) }));

    const main1Tok = await paneEnv(`s${main1}`, "FLEET_SELF_TOKEN") ?? "";
    const main2Tok = await paneEnv(`s${main2}`, "FLEET_SELF_TOKEN") ?? "";
    const laneTokens = new Map<number, string>();
    for (const lane of [prog, watched, agreed, conflicted, multi, none, legacy, replacedMainWorker])
      laneTokens.set(lane.slot, await paneEnv(`s${lane.slot}`, "FLEET_SELF_TOKEN") ?? "");
    check("clarification fixtures: every participant has an exact, distinct scoped credential",
      [main1Tok, main2Tok, ...laneTokens.values()].every((t) => /^[0-9a-f]{32}$/.test(t))
        && new Set([main1Tok, main2Tok, ...laneTokens.values()]).size === 10);

    const subscribe = async (receiver: number, worker: { slot: number }) => {
      const r = await post(`/api/slots/${receiver}/watch`, { target: worker.slot, idleSec: 3600 });
      return { response: r, body: await r.json() as { watch?: WatchRow } };
    };
    const watchedSub = await subscribe(main1, watched);
    const agreedSub = await subscribe(main1, agreed);
    const conflictSub = await subscribe(main2, conflicted);
    // `conflicted` is program-bound to main1 AND carries two distinct watch occupants (main1+main2).
    // Before the receiver reorder that combination was the WORST case a bound lane could be in: the
    // multi-watcher refusal fires before any program branch is reached, so the lane with the most
    // evidence about who coordinates it was the one that could not file at all.
    const conflictSub2 = await subscribe(main1, conflicted);
    const multiSub1 = await subscribe(main1, multi);
    const multiSub2 = await subscribe(main2, multi);
    const replacedMainSub = await subscribe(main2, replacedMainWorker);
    check("clarification lane-watch fixtures: fresh receiver-occupant Watches are persisted before derivation",
      [watchedSub, agreedSub, conflictSub, conflictSub2, multiSub1, multiSub2, replacedMainSub]
        .every((x) => x.response.ok && (x.body.watch?.slotOpenedAt ?? 0) > 0));

    await tmuxOut("kill-session", "-t", "srv");
    await Bun.sleep(500);
    const clarificationStatePath = `${ROOT}/fleet.json`;
    const planted = JSON.parse(readFileSync(clarificationStatePath, "utf8")) as {
      slots: Record<string, Record<string, unknown>>; programs?: Record<string, unknown>[];
      watches?: Record<string, unknown>[]; clarifications?: unknown[];
    };
    const programId = "c".repeat(24);
    const mainRow = planted.slots[String(main1)];
    delete planted.clarifications; // legacy-state counterprobe: the field did not exist before v1
    planted.slots[String(legacyOwner.slot)].awaiting = "owner";
    planted.programs = [...(planted.programs ?? []), {
      id: programId, title: "Clarification fixture", intent: "Route exact worker questions",
      successCriterion: "The bound MAIN replies once", nonGoals: [], decisions: [], evidence: [], openQuestions: [],
      status: "active", createdAt: Date.now() - 1000, proposedBy: { kind: "owner" },
      confirmedAt: Date.now() - 900, activatedAt: Date.now() - 800,
      main: { slot: main1, openedAt: mainRow.openedAt, sessionId: mainRow.sessionId, boundAt: Date.now() - 700 },
    }];
    for (const lane of [prog, agreed, conflicted]) planted.slots[String(lane.slot)].programId = programId;
    planted.slots[String(prog.slot)].taskId = "task-server-stamp";
    planted.slots[String(prog.slot)].originId = "origin-server-stamp";
    for (const watch of planted.watches ?? []) {
      if ([watched.slot, agreed.slot, conflicted.slot, multi.slot, replacedMainWorker.slot].includes(Number(watch.target))) {
        watch.armed = false;
        watch.firedAt = Date.now();
        watch.lastResult = "spent fixture still names coordinating occupant";
      }
    }
    planted.watches = [...(planted.watches ?? []), {
      id: "legacyclarificationwatch", slot: main1, idleSec: 0, armed: false,
      created: Date.now(), firedAt: Date.now(), lastResult: "sent", kind: "lane",
      target: legacy.slot, targetCwd: legacy.cwd, targetBranch: legacy.branch,
    }];
    writeFileSync(clarificationStatePath, JSON.stringify(planted, null, 2), { mode: 0o600 });
    await restartSrv();
    const legacyLoaded = JSON.parse(readFileSync(clarificationStatePath, "utf8")) as {
      clarifications?: unknown[]; slots?: Record<string, { awaiting?: string }>;
    };
    check("clarification legacy state: absent clarifications loads as [] while awaiting:'owner' stays valid",
      Array.isArray(legacyLoaded.clarifications) && legacyLoaded.clarifications.length === 0
        && legacyLoaded.slots?.[String(legacyOwner.slot)]?.awaiting === "owner",
      JSON.stringify({ clarifications: legacyLoaded.clarifications, awaiting: legacyLoaded.slots?.[String(legacyOwner.slot)]?.awaiting }));

    // EDGE B counter-probe. An "owner" wait waits for exactly the person now typing, so the owner's
    // own /send still clears it — the wait exists to hold AUTOMATION back, never its addressee.
    // BREAKS IF: /send stops clearing awaiting at all (the over-correction of only preserving
    // "main"), leaving a clarify lane parked against the owner who just answered it.
    const legacyOwnerTok = await paneEnv(`s${legacyOwner.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const ownerWaitBefore = ((await (await selfGet(legacyOwnerTok)).json()) as { awaiting?: string | null }).awaiting;
    await post("/send", { slot: legacyOwner.slot, text: "owner answers the clarify wait", submit: false });
    const ownerWaitAfter = ((await (await selfGet(legacyOwnerTok)).json()) as { awaiting?: string | null }).awaiting;
    check("owner /send still clears an 'owner' wait — the person it waits for has spoken",
      ownerWaitBefore === "owner" && (ownerWaitAfter ?? null) === null,
      `${ownerWaitBefore} -> ${ownerWaitAfter}`);
    await post(`/api/slots/${legacyOwner.slot}/kill`, {});

    const progTok = laneTokens.get(prog.slot) ?? "";
    const watchedTok = laneTokens.get(watched.slot) ?? "";
    const agreedTok = laneTokens.get(agreed.slot) ?? "";
    const beforeRejectEvents = (await clarificationEventRows()).length;
    const noEvidence = await selfClarify(laneTokens.get(none.slot) ?? "", { question: "Who coordinates me?" });
    const legacyOnly = await selfClarify(laneTokens.get(legacy.slot) ?? "", { question: "Who owns this legacy watch?" });
    const multiple = await selfClarify(laneTokens.get(multi.slot) ?? "", { question: "Which watcher?" });
    const [noEvidenceText, legacyOnlyText, multipleText] = await Promise.all([
      noEvidence.text(), legacyOnly.text(), multiple.text(),
    ]);
    const rejectedState = JSON.parse(readFileSync(clarificationStatePath, "utf8")) as {
      clarifications?: unknown[]; slots?: Record<string, { awaiting?: string | null }>;
    };
    check("clarification rejection: no exact evidence is a named 409 with no request/event/wait mutation",
      noEvidence.status === 409 && noEvidenceText.includes("no exact clarification receiver evidence")
        && (rejectedState.slots?.[String(none.slot)]?.awaiting ?? null) === null);
    check("clarification rejection: legacy Watch without slotOpenedAt has its own named 409",
      legacyOnly.status === 409 && legacyOnlyText.includes("only legacy lane-watch evidence exists without slotOpenedAt")
        && (rejectedState.slots?.[String(legacy.slot)]?.awaiting ?? null) === null);
    check("clarification rejection: two Watch occupants are a distinct 409 without request or event",
      multiple.status === 409 && multipleText.includes("lane-watch evidence names multiple receiver occupants")
        && (await clarificationEventRows()).length === beforeRejectEvents
        && (rejectedState.clarifications?.length ?? 0) === 0);

    const ownerAsSelf = await fetch(`${BASE}/api/self/clarifications`, {
      method: "POST", headers: { "content-type": "application/json", "x-fleet-self-token": TOKEN },
      body: JSON.stringify({ question: "owner cannot substitute" }),
    });
    const plainRequest = await selfClarify(main1Tok, { question: "plain cannot ask" });
    const missingRequest = await selfClarify(null, { question: "missing cannot ask" });
    check("clarification request scope: plain non-lane is 409; owner/missing credentials are 401",
      plainRequest.status === 409 && ownerAsSelf.status === 401 && missingRequest.status === 401,
      `${plainRequest.status}/${ownerAsSelf.status}/${missingRequest.status}`);

    const invalids = await Promise.all([
      selfClarify(progTok, { question: "" }),
      selfClarify(progTok, { question: "x".repeat(2001) }),
      selfClarify(progTok, { question: 7 }),
      selfClarify(progTok, {}, "{not-json"),
      selfClarify(progTok, {}, JSON.stringify({ question: "wrong media" }), "text/plain"),
    ]);
    check("clarification validation: empty, oversized, non-string, malformed JSON and wrong media fail closed 400",
      invalids.every((r) => r.status === 400), invalids.map((r) => r.status).join("/"));

    const spoof = await selfClarify(progTok, {
      question: "  Need the exact scope decision.  ", worker: { slot: 999 }, receiver: { slot: 999 },
      taskId: "spoof-task", originId: "spoof-origin", programId: "spoof-program", basis: "lane-watch",
      eventId: "f".repeat(24), askedAt: 1, status: "answered",
    });
    const spoofBody = await spoof.json() as { request?: ClarificationRow; existing?: boolean };
    const progRequest = spoofBody.request;
    const progEvent = (await clarificationEventRows()).find((e) => e.id === progRequest?.eventId);
    check("clarification program-main: exactly the active bound MAIN gets one server-stamped event",
      spoof.ok && progRequest?.basis === "program-main" && progRequest.receiver.slot === main1
        && progEvent?.receiverSlot === main1 && progEvent.watchId === null
        && (await clarificationEventRows()).filter((e) => e.payload.requestId === progRequest?.id).length === 1,
      JSON.stringify({ request: progRequest, event: progEvent }));
    check("clarification body spoofing cannot overwrite worker/receiver/task/origin/program provenance",
      progRequest?.worker.slot === prog.slot && progRequest.worker.cwd === prog.cwd && progRequest.worker.branch === prog.branch
        && progRequest.provenance.taskId === "task-server-stamp"
        && progRequest.provenance.originId === "origin-server-stamp"
        && progRequest.provenance.programId === programId && progRequest.question === "Need the exact scope decision."
        && !JSON.stringify(progRequest).includes("spoof-"), JSON.stringify(progRequest));
    const laneReplyAttempt = progRequest
      ? await replyClarification(laneTokens.get(none.slot) ?? "", progRequest.id, "lane cannot answer")
      : new Response(null, { status: 599 });
    check("clarification reply scope: a lane credential is recognized but refused 409 before receiver binding",
      laneReplyAttempt.status === 409 && (await laneReplyAttempt.text()).includes("a lane may not reply"));

    const watchOpen = await selfClarify(watchedTok, { question: "Watch-routed question" });
    const watchRequest = (await watchOpen.json() as { request?: ClarificationRow }).request;
    const watchEvent = (await clarificationEventRows()).find((e) => e.id === watchRequest?.eventId);
    check("clarification lane-watch: a non-program lane routes to its fresh exact Watch subscriber",
      watchOpen.ok && watchRequest?.basis === "lane-watch" && watchRequest.receiver.slot === main1
        && watchEvent?.receiverSlot === main1 && watchEvent.payload.basis === "lane-watch");

    const agreeOpen = await selfClarify(agreedTok, { question: "Both facts agree" });
    const agreeRequest = (await agreeOpen.json() as { request?: ClarificationRow }).request;
    check("clarification matching Program+Watch evidence resolves once to one occupant and one event",
      agreeOpen.ok && agreeRequest?.basis === "program-main" && agreeRequest.receiver.slot === main1
        && (await clarificationEventRows()).filter((e) => e.payload.requestId === agreeRequest.id).length === 1);

    // --- receiver: program binding first ---------------------------------------------------
    // clarificationReceiverFor answers "who coordinates this lane" for BOTH self-routes (the
    // clarification above and the fleet-report below it in server.ts), so the two directions are
    // one rule and are checked as a pair. Losing either is a distinct, opposite defect:
    //   (a) consulting watch evidence first refuses a BOUND lane for something it cannot fix —
    //       a stranger's stale subscription, invisible from inside the pane, and the worker's
    //       result then has nowhere to go at exactly the moment it has something to say;
    //   (b) dropping the program-LESS refusal would silently pick one of two watchers, which is
    //       a coin toss dressed as a routing decision.
    // BREAKS IF: the `basis: "program-main"` return moves back below `const watchReceivers`.
    const eventsBeforeDirections = (await clarificationEventRows()).length;
    const boundOpen = await selfClarify(laneTokens.get(conflicted.slot) ?? "", { question: "Which MAIN?" });
    const boundRequest = (await boundOpen.json() as { request?: ClarificationRow }).request;
    const boundEvent = (await clarificationEventRows()).find((e) => e.id === boundRequest?.eventId);
    check("receiver direction (a): a program-bound lane reaches its bound MAIN past two watchers naming different occupants",
      boundOpen.ok && boundRequest?.basis === "program-main" && boundRequest.receiver.slot === main1
        && boundRequest.provenance.programId === programId
        && boundEvent?.receiverSlot === main1 && boundEvent.watchId === null
        && boundEvent.payload.basis === "program-main",
      JSON.stringify({ status: boundOpen.status, basis: boundRequest?.basis,
        receiver: boundRequest?.receiver, event: boundEvent?.receiverSlot }));
    // …and the opposite direction, re-asked on the same fixture that was refused above: the
    // sentence is the contract, so it is matched verbatim rather than by status alone.
    const unboundAgain = await selfClarify(laneTokens.get(multi.slot) ?? "", { question: "Still which watcher?" });
    const unboundText = await unboundAgain.text();
    check("receiver direction (b): a program-LESS lane with two watchers keeps the exact refusal and mints nothing",
      unboundAgain.status === 409
        && unboundText.includes("lane-watch evidence names multiple receiver occupants")
        && (await clarificationEventRows()).length === eventsBeforeDirections + 1,
      `${unboundAgain.status} ${unboundText}`);
    const [workerScope, mainScope, foreignScope] = await Promise.all([
      selfClarifications(progTok), selfClarifications(main1Tok), selfClarifications(main2Tok),
    ]);
    check("clarification GET scope: worker sees only its occupant rows; MAIN sees only exact receiver rows",
      workerScope.requests.length === 1 && workerScope.requests[0]?.id === progRequest?.id
        && mainScope.requests.length === 4
        && mainScope.requests.every((c) => c.receiver.slot === main1)
        && foreignScope.requests.length === 0,
      JSON.stringify({ worker: workerScope.requests.map((c) => c.id), main: mainScope.requests.map((c) => c.id), foreign: foreignScope.requests }));

    const idem = await selfClarify(progTok, { question: "A different retry body cannot mint a twin" });
    const idemBody = await idem.json() as { existing?: boolean; request?: ClarificationRow };
    check("clarification open request is occupant-idempotent with no second request/event/prompt",
      idem.ok && idemBody.existing === true && idemBody.request?.id === progRequest?.id
        && (await clarificationEventRows()).filter((e) => e.payload.requestId === progRequest?.id).length === 1
        && (await plogRead()).filter((p) => p.text.includes(`request ${progRequest?.id}`)).length === 0);

    const pendingSelf = await selfClarifications(progTok);
    await Bun.sleep(AUTOS_TICK_MS * 4 + 500);
    const stillPending = (await clarificationEventRows()).find((e) => e.id === progRequest?.eventId);
    check("clarification transport: busy MAIN keeps the durable event pending while worker visibly awaits main",
      pendingSelf.requests[0]?.status === "open" && stillPending?.status === "pending" && stillPending.attempts === 0
        && ((await (await selfGet(progTok)).json()) as { awaiting?: string }).awaiting === "main",
      JSON.stringify(stillPending));

    // Restart across the open debt, then lower only the persisted receiver idle gate so FACT 2 can
    // deliver immediately without waiting a production minute in the suite.
    await tmuxOut("kill-session", "-t", "srv");
    await Bun.sleep(500);
    const restartImage = JSON.parse(readFileSync(clarificationStatePath, "utf8")) as {
      events?: Record<string, unknown>[]; clarifications?: Record<string, unknown>[];
    };
    for (const event of restartImage.events ?? [])
      if (event.kind === "clarification-request") event.receiverIdleSec = 0;
    restartImage.clarifications?.push({ id: "malformed", status: "open" });
    writeFileSync(clarificationStatePath, JSON.stringify(restartImage, null, 2), { mode: 0o600 });
    await restartSrv();
    const restoredRequests = (await selfClarifications(progTok)).requests;
    let deliveredProgram: ClarificationEventRow | undefined;
    for (let i = 0; i < 80 && deliveredProgram?.status !== "delivered"; i++) {
      await Bun.sleep(250);
      deliveredProgram = (await clarificationEventRows()).find((e) => e.id === progRequest?.eventId);
    }
    const clarificationPrompts = (await plogRead()).filter((p) => p.slot === main1
      && p.text.includes(`request ${progRequest?.id}`));
    check("clarification restart: request/event/bindings survive and deliver exactly once after MAIN becomes deliverable",
      restoredRequests.some((c) => c.id === progRequest?.id && c.receiver.openedAt === progRequest.receiver.openedAt)
        && deliveredProgram?.status === "delivered" && deliveredProgram.attempts === 1
        && clarificationPrompts.length === 1
        && !(JSON.parse(readFileSync(clarificationStatePath, "utf8")) as { clarifications?: { id?: string }[] })
          .clarifications?.some((c) => c.id === "malformed"),
      JSON.stringify({ restored: restoredRequests, event: deliveredProgram, prompts: clarificationPrompts.length }));
    const clarificationText = clarificationPrompts[0]?.text ?? "";
    check("clarification request text marks a question, forbids blind execution, names exact reply command and Ack distinction",
      clarificationText.includes("worker question, NOT an instruction to execute blindly")
        && clarificationText.includes(`POST /api/self/clarifications/${progRequest?.id}/reply`)
        && clarificationText.includes("x-fleet-self-token") && clarificationText.includes("does NOT answer this question"),
      clarificationText);

    const ackClarification = deliveredProgram ? await ackEvent(main1Tok, deliveredProgram.id)
      : new Response(null, { status: 599 });
    const afterAck = (await selfClarifications(progTok)).requests.find((c) => c.id === progRequest?.id);
    check("clarification Ack is read receipt only: event acknowledges but request stays open and awaiting main",
      ackClarification.ok && (await clarificationEventRows()).find((e) => e.id === deliveredProgram?.id)?.status === "acknowledged"
        && afterAck?.status === "open"
        && ((await (await selfGet(progTok)).json()) as { awaiting?: string }).awaiting === "main");

    // EDGE B. The owner typing into a worker's pane is NOT Program-MAIN's answer to that worker's
    // open clarification, so the "main" wait must survive it. Clearing it here would re-open the
    // steward nudge path past an unanswered question — the 409 checked a few lines below.
    // BREAKS IF: /send goes back to the unconditional `s.awaiting = null`.
    await post("/send", { slot: prog.slot, text: "owner speaks while MAIN has not answered", submit: false });
    const waitAfterOwnerSend = ((await (await selfGet(progTok)).json()) as { awaiting?: string | null }).awaiting;
    const clarificationAfterOwnerSend = (await selfClarifications(progTok)).requests
      .find((c) => c.id === progRequest?.id);
    check("owner /send into a worker pane preserves its awaiting:'main' clarification wait",
      waitAfterOwnerSend === "main" && clarificationAfterOwnerSend?.status === "open",
      `${waitAfterOwnerSend} ${clarificationAfterOwnerSend?.status}`);

    const waitingFacts: LaneSignalView = { alive: true, idleMs: 999_999, git: { dirty: 2, ahead: 0 },
      gitOp: false, merge: null, observed: true, awaiting: "main", hostCommits: true };
    check("awaiting:'main' lane is neither host-commit-looking nor stalled",
      !laneHostCommitLooking(waitingFacts, 1) && !laneStalled(waitingFacts, 1));
    const stewardToken = ((await (await get("/api/steward/token")).json()) as { token?: string }).token ?? "";
    const stewardBlocked = await fetch(`${BASE}/api/steward/send`, {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${stewardToken}` },
      body: JSON.stringify({ slot: prog.slot, kind: "continue_nudge", ref: "continue" }),
    });
    const stewardBlockedText = await stewardBlocked.text();
    check("handleStewardSend gives awaiting:'main' its new 409 while the pinned owner wording remains in source",
      stewardBlocked.status === 409 && stewardBlockedText.includes("waiting on Program-MAIN")
        && serverSource.includes("slot is waiting on the owner (clarify lane) — escalate, never nudge past it"),
      `${stewardBlocked.status} ${stewardBlockedText}`);

    const foreignReply = watchRequest ? await replyClarification(main2Tok, watchRequest.id, "foreign answer")
      : new Response(null, { status: 599 });
    check("clarification reply binding: foreign MAIN is 409 and leaves the request open",
      foreignReply.status === 409
        && (await selfClarifications(watchedTok)).requests.find((c) => c.id === watchRequest?.id)?.status === "open");

    const reply = progRequest ? await replyClarification(main1Tok, progRequest.id, "Keep the implementation inside the named files.")
      : new Response(null, { status: 599 });
    const replyBody = await reply.json() as { request?: ClarificationRow; existing?: boolean };
    // POLLED, not sampled once: the route answers when it has SENT, and the keystrokes still have
    // to reach the pane and be rendered before capture-pane can see them. A single capture read
    // that race as "the answer was never delivered" (measured red 2026-08-30 on the Linux
    // second-host, where every other conjunct of this row held).
    const answerMark = `CLARIFICATION ANSWER [request ${progRequest?.id}]`;
    let workerPane = { out: "", code: -1 };
    for (let i = 0; i < 60; i++) {
      workerPane = await tmuxOut("capture-pane", "-t", `s${prog.slot}`, "-p", "-J");
      if (workerPane.out.includes(answerMark)) break;
      await Bun.sleep(100);
    }
    check("clarification successful reply sends once before answered and only then clears awaiting",
      reply.ok && replyBody.request?.status === "answered" && replyBody.request.answer?.text.includes("named files") === true
        && workerPane.out.includes(answerMark)
        && ((await (await selfGet(progTok)).json()) as { awaiting?: string }).awaiting === null,
      `${reply.status} ${JSON.stringify(replyBody)}`);
    const sameReply = progRequest ? await replyClarification(main1Tok, progRequest.id, "Keep the implementation inside the named files.")
      : new Response(null, { status: 599 });
    const sameReplyBody = await sameReply.json() as { existing?: boolean };
    const differentReply = progRequest ? await replyClarification(main1Tok, progRequest.id, "Different answer")
      : new Response(null, { status: 599 });
    check("clarification duplicate reply is idempotent only for identical text; different text is 409 unchanged",
      sameReply.ok && sameReplyBody.existing === true && differentReply.status === 409
        && (await selfClarifications(progTok)).requests.find((c) => c.id === progRequest?.id)?.answer?.text
          === "Keep the implementation inside the named files.");

    // A pane death without occupant replacement must not become success. On the isolated default
    // adapter the process probe is intentionally waived; sendText itself therefore supplies the
    // deterministic paste failure, and the failure is now a PERSISTED transport state rather than a
    // request that silently stayed open. Read from the state file, never from /api/sessions: that
    // payload carries no `awaiting`, and casting it onto the poll response is the exact mistake two
    // earlier probes died of (8e2b3e5).
    // BREAKS IF: replyClarification assigns send-uncertain after sendText (nothing persisted on a
    // crash), or drops the pre-send saveStateNow, or clears the worker's wait before an answer.
    await tmuxOut("kill-session", "-t", `s${watched.slot}`);
    const deadReply = watchRequest ? await replyClarification(main1Tok, watchRequest.id, "answer to dead pane")
      : new Response(null, { status: 599 });
    const deadReplyText = await deadReply.text();
    const readClarification = (id: string | undefined) =>
      (JSON.parse(readFileSync(clarificationStatePath, "utf8")) as { clarifications?: ClarificationRow[] })
        .clarifications?.find((c) => c.id === id);
    const readAwaiting = (slot: number): string | null =>
      (JSON.parse(readFileSync(clarificationStatePath, "utf8")) as
        { slots?: Record<string, { awaiting?: string | null }> }).slots?.[String(slot)]?.awaiting ?? null;
    const uncertainRow = readClarification(watchRequest?.id);
    check("clarification unresolved send persists send-uncertain with the pending answer and keeps awaiting main",
      deadReply.status === 409 && /worker reply send failed and stays send-uncertain/.test(deadReplyText)
        && uncertainRow?.status === "send-uncertain" && uncertainRow.answer?.text === "answer to dead pane"
        && uncertainRow.closedAt === null && uncertainRow.refusedReason === null
        && readAwaiting(watched.slot) === "main"
        && (await selfClarifications(watchedTok)).requests.find((c) => c.id === watchRequest?.id)?.status === "send-uncertain",
      `${deadReply.status} ${deadReplyText} ${JSON.stringify(uncertainRow)} awaiting=${readAwaiting(watched.slot)}`);

    // The retry contract has two halves and both are load-bearing: identical text may be
    // re-attempted, different text may not — the pending text may already sit in the pane, so a
    // second, different answer would be half of a contradiction nobody could observe.
    // BREAKS IF: the send-uncertain branch stops comparing the pending text, or a different-text
    // retry is allowed to overwrite `answer` before its 409.
    const differentRetry = watchRequest
      ? await replyClarification(main1Tok, watchRequest.id, "a different answer entirely")
      : new Response(null, { status: 599 });
    const differentRetryText = await differentRetry.text();
    const afterDifferent = readClarification(watchRequest?.id);
    check("clarification send-uncertain retry with different text is 409 and never replaces the pending answer",
      differentRetry.status === 409 && differentRetryText.includes("different pending text")
        && afterDifferent?.status === "send-uncertain" && afterDifferent.answer?.text === "answer to dead pane",
      `${differentRetry.status} ${differentRetryText}`);

    // The identical retry is principal-driven and re-runs the real gates: once the self-heal has
    // put the pane back (same occupant — the stand-in harness pins no session id, so openedAt and
    // sessionId are untouched), the send is attempted again and only its success answers.
    // BREAKS IF: a send-uncertain request is treated as terminal/closed, or the retry short-circuits
    // to answered without re-running sendText (the pane text below would then be missing).
    let healed = 1;
    for (let i = 0; i < 60 && healed !== 0; i++) {
      await Bun.sleep(250);
      healed = (await tmuxOut("has-session", "-t", `s${watched.slot}`)).code;
    }
    const sameRetry = watchRequest ? await replyClarification(main1Tok, watchRequest.id, "answer to dead pane")
      : new Response(null, { status: 599 });
    const sameRetryBody = await sameRetry.json() as { request?: ClarificationRow };
    const healedPane = (await tmuxOut("capture-pane", "-t", `s${watched.slot}`, "-p")).out;
    check("clarification identical retry re-attempts the send and only a successful one answers and clears the wait",
      healed === 0 && sameRetry.ok && sameRetryBody.request?.status === "answered"
        && sameRetryBody.request.closedAt !== null
        && healedPane.includes(`CLARIFICATION ANSWER [request ${watchRequest?.id}]`)
        && readClarification(watchRequest?.id)?.status === "answered"
        && readAwaiting(watched.slot) === null,
      `healed=${healed} ${sameRetry.status} ${JSON.stringify(sameRetryBody.request)}`);
    const replySource = serverSource.slice(serverSource.indexOf("async function replyClarification("),
      serverSource.indexOf("async function acknowledgeFleetEvent("));
    check("clarification send-error branch returns 409 while answered assignment remains after sendText",
      replySource.includes("worker reply send failed")
        && replySource.indexOf('request.status = "answered";') > replySource.indexOf("await sendText(worker, text, true);"));

    // Worker replacement is terminal and must never address its numeric successor.
    const agreeSlot = agreed.slot;
    await post(`/api/slots/${agreeSlot}/kill`, {});
    const refusedAgree = (await selfClarifications(main1Tok)).requests.find((c) => c.id === agreeRequest?.id);
    const reopenAgree = await post(`/api/slots/${agreeSlot}/open`, { cwd: REPO, label: "clarification-successor" });
    const successorPaneBefore = (await tmuxOut("capture-pane", "-t", `s${agreeSlot}`, "-p")).out;
    const successorReply = agreeRequest ? await replyClarification(main1Tok, agreeRequest.id, "must not reach successor")
      : new Response(null, { status: 599 });
    const successorPaneAfter = (await tmuxOut("capture-pane", "-t", `s${agreeSlot}`, "-p")).out;
    check("clarification replaced worker is visibly refused and no reply reaches successor occupant",
      refusedAgree?.status === "refused" && refusedAgree.refusedReason?.includes("worker occupant") === true
        && reopenAgree.ok && successorReply.status === 409 && successorPaneAfter === successorPaneBefore
        && !successorPaneAfter.includes("must not reach successor"), JSON.stringify(refusedAgree));

    const replacedOpen = await selfClarify(laneTokens.get(replacedMainWorker.slot) ?? "", { question: "Receiver replacement" });
    const replacedRequest = (await replacedOpen.json() as { request?: ClarificationRow }).request;
    await post(`/api/slots/${main2}/kill`, {});
    const reopenMain2 = await post(`/api/slots/${main2}/open`, { cwd: REPO, label: "replacement-main" });
    const replacementMainTok = await paneEnv(`s${main2}`, "FLEET_SELF_TOKEN") ?? "";
    const replacedMainReply = replacedRequest
      ? await replyClarification(replacementMainTok, replacedRequest.id, "replacement must not answer")
      : new Response(null, { status: 599 });
    const refusedReceiver = (await selfClarifications(laneTokens.get(replacedMainWorker.slot) ?? ""))
      .requests.find((c) => c.id === replacedRequest?.id);
    check("clarification replaced MAIN is refused, replacement is binding-rejected, and no mutation reopens it",
      replacedOpen.ok && reopenMain2.ok && replacementMainTok !== main2Tok && replacedMainReply.status === 409
        && refusedReceiver?.status === "refused" && refusedReceiver.refusedReason?.includes("receiver occupant") === true,
      JSON.stringify(refusedReceiver));

    const execution = await fetch(`${BASE}/api/self/program-execution`, {
      headers: { "x-fleet-self-token": main1Tok },
    });
    const executionBody = await execution.json() as { programs?: { program: { id: string }; operations: {
      events: { rows: { id: string; kind: string; watchId: string | null }[]; openDebts: number } } }[] };
    const executionProgram = executionBody.programs?.find((p) => p.program.id === programId);
    check("ProgramExecutionView exposes clarification through existing event rows/watchId:null and openDebts facts",
      execution.ok && executionProgram?.operations.events.rows.some((e) => e.id === progRequest?.eventId
        && e.kind === "clarification-request" && e.watchId === null) === true
        && typeof executionProgram.operations.events.openDebts === "number",
      JSON.stringify(executionProgram?.operations.events));

    check("clarification regression: existing Watch kinds/Acks/retention stay present and clarification adds no Watch row",
      ["lane-ready", "host-commit-ready", "merge-terminal", "post-land-audit", "deploy-terminal"]
        .every((kind) => serverSource.includes(kind))
        && !((JSON.parse(readFileSync(clarificationStatePath, "utf8")) as { watches?: { id?: string }[] }).watches ?? [])
          .some((w) => w.id === progRequest?.id));

    // EDGE C. Scope follows ROLE, not worktree-ness: a receiver that happens to run in a worktree
    // (the ⚙ steward is exactly that shape) used to fall into the worker branch of clarificationsFor
    // and therefore saw nothing it was the receiver OF. Both bindings are exact and server-derived.
    // BREAKS IF: clarificationsFor reintroduces an `s.worktree` branch — this receiver HAS a
    // worktree, so the old predicate returned its own (empty) worker rows instead of the row below.
    // The nine fixture lanes above have finished their checks; free them FIRST so this pair is not
    // competing for the last of MAX_SLOTS (a /api/lanes that finds no free slot returns no `slot`,
    // and the probe would then fail as itself rather than as the scope predicate it measures).
    for (const lane of [prog, watched, conflicted, multi, none, legacy, replacedMainWorker])
      await post(`/api/slots/${lane.slot}/kill`, {});
    const receiverLane = await makeLane();
    const receiverWorker = await makeLane();
    const receiverLaneTok = await paneEnv(`s${receiverLane.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const receiverWorkerTok = await paneEnv(`s${receiverWorker.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const worktreeSub = await subscribe(receiverLane.slot, receiverWorker);
    const worktreeOpen = await selfClarify(receiverWorkerTok, { question: "Who answers a receiver that lives in a worktree?" });
    const worktreeRequest = (await worktreeOpen.json() as { request?: ClarificationRow }).request;
    const worktreeScope = await selfClarifications(receiverLaneTok);
    // The fixture gets its own check: a pair that could not be built must fail AS a fixture, never
    // as the scope predicate below (a probe that never ran must not read as the thing it measured).
    check("clarification worktree-receiver fixture: two fresh lanes, distinct tokens and a fresh Watch exist",
      !!receiverLane.slot && !!receiverWorker.slot && /^[0-9a-f]{32}$/.test(receiverLaneTok)
        && /^[0-9a-f]{32}$/.test(receiverWorkerTok) && receiverLaneTok !== receiverWorkerTok
        && worktreeSub.response.ok && (worktreeSub.body.watch?.slotOpenedAt ?? 0) > 0,
      JSON.stringify({ receiver: receiverLane.slot, worker: receiverWorker.slot,
        sub: worktreeSub.response.status, watch: worktreeSub.body.watch }));
    check("clarification GET scope follows role: a receiver WITH a worktree sees the rows it receives",
      worktreeOpen.ok && worktreeRequest?.receiver.slot === receiverLane.slot
        && worktreeScope.requests.length === 1 && worktreeScope.requests[0]?.id === worktreeRequest.id
        && (await selfClarifications(receiverWorkerTok)).requests.some((c) => c.id === worktreeRequest.id),
      JSON.stringify({ open: worktreeOpen.status, receiver: worktreeRequest?.receiver,
        seen: worktreeScope.requests.map((c) => c.id) }));

    for (const lane of [receiverLane, receiverWorker])
      await post(`/api/slots/${lane.slot}/kill`, {});
    await post(`/api/slots/${agreeSlot}/kill`, {});
    await post(`/api/slots/${main1}/kill`, {});
    await post(`/api/slots/${main2}/kill`, {});
    // These rows have already proved load, retention, delivery, Ack and terminal semantics. Remove
    // only this section's synthetic population while the server is stopped, so the later global
    // /api/sessions payload-budget check measures the product's bounded steady state rather than
    // test pollution from nine throwaway occupants.
    await tmuxOut("kill-session", "-t", "srv");
    await Bun.sleep(500);
    const cleaned = JSON.parse(readFileSync(clarificationStatePath, "utf8")) as {
      events?: { kind?: string }[]; clarifications?: unknown[]; programs?: { id?: string }[];
    };
    cleaned.events = (cleaned.events ?? []).filter((e) => e.kind !== "clarification-request");
    cleaned.clarifications = [];
    cleaned.programs = (cleaned.programs ?? []).filter((p) => p.id !== programId);
    writeFileSync(clarificationStatePath, JSON.stringify(cleaned, null, 2), { mode: 0o600 });
    await restartSrv();
  }

  // === RESULT-RAIL B-D ========================================================================
  // The report is an immutable sibling on the Clarification FleetEvent transport. Program binding
  // is planted as the one server fact used by clarificationReceiverFor; no report body below can
  // name a receiver, task, program, slot or branch.
  {
    const main = await freeSlot();
    const mainOpen = main ? await post(`/api/slots/${main}/open`, { cwd: REPO, label: "report-main" }) : null;
    const foreignMain = await freeSlot();
    const foreignOpen = foreignMain
      ? await post(`/api/slots/${foreignMain}/open`, { cwd: REPO, label: "report-foreign-main" }) : null;
    const makeLane = async () => (await (await post("/api/lanes", { repo: REPO })).json()) as
      { slot: number; cwd: string; branch: string };
    const completeLane = await makeLane();
    const needsLane = await makeLane();
    const failedLane = await makeLane();
    const noReceiverLane = await makeLane();
    const stewardLane = await makeLane();
    check("fleet-report fixtures: two MAIN occupants and five distinct lanes exist",
      !!mainOpen?.ok && !!foreignOpen?.ok
        && new Set([main, foreignMain, completeLane.slot, needsLane.slot, failedLane.slot,
          noReceiverLane.slot, stewardLane.slot]).size === 7,
      JSON.stringify({ main, foreignMain, lanes: [completeLane.slot, needsLane.slot, failedLane.slot,
        noReceiverLane.slot, stewardLane.slot] }));

    const mainTok = await paneEnv(`s${main}`, "FLEET_SELF_TOKEN") ?? "";
    const foreignTok = await paneEnv(`s${foreignMain}`, "FLEET_SELF_TOKEN") ?? "";
    const completeTok = await paneEnv(`s${completeLane.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const needsTok = await paneEnv(`s${needsLane.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const failedTok = await paneEnv(`s${failedLane.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const noReceiverTok = await paneEnv(`s${noReceiverLane.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const stewardTok = await paneEnv(`s${stewardLane.slot}`, "FLEET_SELF_TOKEN") ?? "";
    check("fleet-report fixtures: every participant has an exact, distinct scoped credential",
      [mainTok, foreignTok, completeTok, needsTok, failedTok, noReceiverTok, stewardTok]
        .every((t) => /^[0-9a-f]{32}$/.test(t))
        && new Set([mainTok, foreignTok, completeTok, needsTok, failedTok, noReceiverTok, stewardTok]).size === 7);

    await tmuxOut("kill-session", "-t", "srv");
    await Bun.sleep(500);
    const reportStatePath = `${ROOT}/fleet.json`;
    const planted = JSON.parse(readFileSync(reportStatePath, "utf8")) as {
      slots: Record<string, Record<string, unknown>>; programs?: Record<string, unknown>[];
      fleetReports?: unknown[];
    };
    const programId = "f".repeat(24);
    const mainRow = planted.slots[String(main)];
    delete planted.fleetReports;
    planted.programs = [...(planted.programs ?? []), {
      id: programId, title: "Result rail fixture", intent: "Receive typed worker results",
      successCriterion: "All three statuses survive transport", nonGoals: [], decisions: [], evidence: [], openQuestions: [],
      status: "active", createdAt: Date.now() - 1000, proposedBy: { kind: "owner" },
      confirmedAt: Date.now() - 900, activatedAt: Date.now() - 800,
      main: { slot: main, openedAt: mainRow.openedAt, sessionId: mainRow.sessionId, boundAt: Date.now() - 700 },
    }];
    for (const lane of [completeLane, needsLane, failedLane])
      planted.slots[String(lane.slot)].programId = programId;
    planted.slots[String(completeLane.slot)].taskId = "task-server-report";
    planted.slots[String(completeLane.slot)].originId = "origin-server-report";
    planted.slots[String(stewardLane.slot)].label = "⚙ steward";
    writeFileSync(reportStatePath, JSON.stringify(planted, null, 2), { mode: 0o600 });
    await restartSrv();
    const legacyLoaded = JSON.parse(readFileSync(reportStatePath, "utf8")) as { fleetReports?: unknown[] };
    check("fleet-report legacy state: an absent fleetReports member loads as [] in the shared state document",
      Array.isArray(legacyLoaded.fleetReports) && legacyLoaded.fleetReports.length === 0,
      JSON.stringify(legacyLoaded.fleetReports));
    const reportAuditStart = auditRows().length;
    check("fleet-report audit fixture: the rotation-aware audit ledger is readable before baselining",
      auditReadError === "", auditReadError);

    const nonLane = await selfFleetReport(mainTok, { status: "complete", text: "MAIN cannot report" });
    const nonLaneText = await nonLane.text();
    const steward = await selfFleetReport(stewardTok, { status: "complete", text: "steward cannot report" });
    const stewardText = await steward.text();
    check("Q1 fleet-report lane-only: MAIN and steward receive named 409 refusals",
      nonLane.status === 409 && nonLaneText.includes("not a worker lane")
        && steward.status === 409 && stewardText.includes("steward cannot file"),
      `${nonLane.status} ${nonLaneText} / ${steward.status} ${stewardText}`);

    const noReceiver = await selfFleetReport(noReceiverTok, { status: "needs-main", text: "Who receives this?" });
    const noReceiverText = await noReceiver.text();
    check("Q2 fleet-report receiver: a lane without exact evidence is honestly refused by name",
      noReceiver.status === 409 && noReceiverText.includes("no exact clarification receiver evidence")
        && (await fleetReportEventRows()).length === 0,
      `${noReceiver.status} ${noReceiverText}`);

    const invalids = await Promise.all([
      selfFleetReport(completeTok, { status: "unknown", text: "not closed" }),
      selfFleetReport(completeTok, { status: "complete", text: " " }),
      selfFleetReport(completeTok, { status: "complete", text: "x".repeat(4001) }),
      selfFleetReport(completeTok, { status: "complete", text: "spoof", receiver: { slot: foreignMain } }),
    ]);
    check("fleet-report validation: the exported three-value status is closed and the body is exactly status+text",
      JSON.stringify(FLEET_REPORT_STATUSES) === JSON.stringify(["complete", "needs-main", "failed"])
        && invalids.every((r) => r.status === 400) && (await fleetReportEventRows()).length === 0,
      invalids.map((r) => r.status).join("/"));

    const completeRes = await selfFleetReport(completeTok,
      { status: "complete", text: "All requested B-D checks are green." });
    const completeReport = (await completeRes.json() as { report?: FleetReportRow }).report;
    const needsRes = await selfFleetReport(needsTok,
      { status: "needs-main", text: "MAIN must decide the promotion boundary." });
    const needsReport = (await needsRes.json() as { report?: FleetReportRow }).report;
    const failedRes = await selfFleetReport(failedTok,
      { status: "failed", text: "The named verification failed." });
    const failedReport = (await failedRes.json() as { report?: FleetReportRow }).report;
    const completeEvent = (await fleetReportEventRows()).find((e) => e.id === completeReport?.eventId);
    check("fleet-report rows and FleetEvents derive receiver and provenance only from the lane and binding",
      completeRes.ok && needsRes.ok && failedRes.ok
        && completeReport?.worker.slot === completeLane.slot && completeReport.worker.branch === completeLane.branch
        && completeReport.provenance.taskId === "task-server-report"
        && completeReport.provenance.originId === "origin-server-report"
        && completeReport.provenance.programId === programId && completeReport.receiver?.slot === main
        && completeEvent?.watchId === null && completeEvent.receiverSlot === main
        && completeEvent.payload.reportId === completeReport.id,
      JSON.stringify({ completeReport, completeEvent }));
    await Bun.sleep(300);
    const openAudits = auditRows().slice(reportAuditStart).filter((row) => row.event === "fleet_report_open");
    const expectedOpenAudits = [
      { id: completeReport?.id, slot: completeLane.slot },
      { id: needsReport?.id, slot: needsLane.slot },
      { id: failedReport?.id, slot: failedLane.slot },
    ].filter((entry): entry is { id: string; slot: number } => !!entry.id);
    check("fleet-report audit: every accepted open records its id and slot without copying report text",
      openAudits.length === 3 && expectedOpenAudits.every(({ id, slot }) => openAudits.some((row) =>
        row.slot === slot && row.detail?.startsWith(`${id} receiver=${main} status=`)))
        && openAudits.every((row) => !row.detail?.includes("All requested B-D checks are green.")
          && !row.detail?.includes("MAIN must decide the promotion boundary.")
          && !row.detail?.includes("The named verification failed.")),
      JSON.stringify(openAudits));

    const [workerScope, mainScope, foreignScope, mainInbox, foreignInbox] = await Promise.all([
      selfFleetReports(completeTok), selfFleetReports(mainTok), selfFleetReports(foreignTok),
      selfGet(mainTok).then((r) => r.json() as Promise<{ events?: FleetReportEventRow[] }>),
      selfGet(foreignTok).then((r) => r.json() as Promise<{ events?: FleetReportEventRow[] }>),
    ]);
    check("Q3 fleet-report scope: the bound MAIN inbox gets all events, the worker gets its row, and a foreign MAIN gets neither",
      workerScope.reports.length === 1 && workerScope.reports[0]?.id === completeReport?.id
        && mainScope.reports.length === 3 && mainScope.reports.every((r) => r.receiver?.slot === main)
        && foreignScope.reports.length === 0
        && (mainInbox.events ?? []).filter((e) => e.kind === "fleet-report").length === 3
        && !(foreignInbox.events ?? []).some((e) => e.kind === "fleet-report"),
      JSON.stringify({ worker: workerScope.reports.map((r) => r.id), main: mainScope.reports.map((r) => r.id),
        foreign: foreignScope.reports, mainEvents: (mainInbox.events ?? []).map((e) => e.id),
        foreignEvents: (foreignInbox.events ?? []).map((e) => e.id) }));

    // Restart from an image where report delivery is immediately eligible. This proves the row and
    // all three status values survive independently of transport, then lets the existing Ack route
    // close one delivered report event without any report-specific acknowledgement path.
    await tmuxOut("kill-session", "-t", "srv");
    await Bun.sleep(500);
    const restartImage = JSON.parse(readFileSync(reportStatePath, "utf8")) as {
      events?: { kind?: string; receiverIdleSec?: number }[]; fleetReports?: unknown[];
    };
    for (const event of restartImage.events ?? [])
      if (event.kind === "fleet-report") event.receiverIdleSec = 0;
    restartImage.fleetReports?.push({ id: "malformed", status: "complete" });
    writeFileSync(reportStatePath, JSON.stringify(restartImage, null, 2), { mode: 0o600 });
    await restartSrv();
    const afterRestart = (await selfFleetReports(mainTok)).reports;
    check("Q4 fleet-report durability: complete, needs-main and failed remain distinct after server restart",
      afterRestart.find((r) => r.id === completeReport?.id)?.status === "complete"
        && afterRestart.find((r) => r.id === needsReport?.id)?.status === "needs-main"
        && afterRestart.find((r) => r.id === failedReport?.id)?.status === "failed"
        && !(JSON.parse(readFileSync(reportStatePath, "utf8")) as { fleetReports?: { id?: string }[] })
          .fleetReports?.some((r) => r.id === "malformed"),
      JSON.stringify(afterRestart.map((r) => [r.id, r.status])));

    let delivered: FleetReportEventRow | undefined;
    for (let i = 0; i < 80 && delivered?.status !== "delivered"; i++) {
      await Bun.sleep(250);
      delivered = (await fleetReportEventRows()).find((e) => e.id === completeReport?.eventId);
    }
    const reportPrompts = (await plogRead()).filter((p) => p.slot === main
      && p.text.includes(`report ${completeReport?.id}`));
    const ack = delivered ? await ackEvent(mainTok, delivered.id) : new Response(null, { status: 599 });
    const acknowledged = (await fleetReportEventRows()).find((e) => e.id === delivered?.id);
    check("Q3 fleet-report transport and Ack: the persisted event delivers once and existing self Ack acknowledges it",
      delivered?.status === "delivered" && delivered.attempts === 1 && reportPrompts.length === 1
        && ack.ok && acknowledged?.status === "acknowledged" && acknowledged.acknowledgedAt !== null,
      JSON.stringify({ delivered, prompts: reportPrompts.length, ack: ack.status, acknowledged }));

    // Cross the report retention threshold with valid old rows whose events are already absent.
    // This is deliberately a separate fixture check: if the planted rows cannot hydrate, the
    // audit assertion below must not masquerade as a missing-prune defect.
    await tmuxOut("kill-session", "-t", "srv");
    await Bun.sleep(500);
    const pruneImage = JSON.parse(readFileSync(reportStatePath, "utf8")) as {
      fleetReports?: FleetReportRow[];
    };
    const oldReports: FleetReportRow[] = completeReport ? Array.from({ length: 21 }, (_, index) => ({
      ...completeReport,
      id: (0xa000 + index).toString(16).padStart(24, "0"),
      eventId: (0xb000 + index).toString(16).padStart(24, "0"),
      reportedAt: Math.max(1, completeReport.reportedAt - 100_000 + index),
      text: `old terminal report ${index}`,
    })) : [];
    pruneImage.fleetReports?.push(...oldReports);
    writeFileSync(reportStatePath, JSON.stringify(pruneImage, null, 2), { mode: 0o600 });
    const pruneAuditStart = auditRows().length;
    await restartSrv();
    const hydratedOld = (await selfFleetReports(mainTok)).reports.filter((r) =>
      oldReports.some((old) => old.id === r.id));
    check("fleet-report prune audit fixture: 21 valid terminal rows hydrate before pruning",
      oldReports.length === 21 && hydratedOld.length === 21,
      `${oldReports.length}/${hydratedOld.length}`);
    const pruneTrigger = await selfFleetReport(completeTok,
      { status: "complete", text: "Trigger the bounded report retention pass." });
    await Bun.sleep(300);
    const expectedPruned = oldReports.slice(0, 2).map((r) => r.id);
    const pruneAudits = auditRows().slice(pruneAuditStart).filter((row) => row.event === "fleet_report_prune");
    const afterPruneIds = (await selfFleetReports(mainTok)).reports.map((r) => r.id);
    check("fleet-report audit: retention records every removed report id and keeps those ids out of state",
      pruneTrigger.ok && expectedPruned.length === 2
        && expectedPruned.every((id) => pruneAudits.some((row) => row.detail === id)
          && !afterPruneIds.includes(id)),
      JSON.stringify({ trigger: pruneTrigger.status, expectedPruned, pruneAudits }));

    for (const slot of [completeLane.slot, needsLane.slot, failedLane.slot, noReceiverLane.slot,
      stewardLane.slot, main, foreignMain]) await post(`/api/slots/${slot}/kill`, {});
    await tmuxOut("kill-session", "-t", "srv");
    await Bun.sleep(500);
    const cleaned = JSON.parse(readFileSync(reportStatePath, "utf8")) as {
      events?: { kind?: string }[]; fleetReports?: unknown[]; programs?: { id?: string }[];
    };
    cleaned.events = (cleaned.events ?? []).filter((e) => e.kind !== "fleet-report");
    cleaned.fleetReports = [];
    cleaned.programs = (cleaned.programs ?? []).filter((p) => p.id !== programId);
    writeFileSync(reportStatePath, JSON.stringify(cleaned, null, 2), { mode: 0o600 });
    await restartSrv();
  }

  // === RESULT-RAIL B4 · THE OWNER-INBOX FALLBACK ==============================================
  // A report is a TERMINAL fact and needs somewhere to LAND; a clarification is a question and
  // needs someone to ANSWER. The two doors shared one receiver rule, so an owner-dispatched task
  // lane with no Program binding and no exact lane watch could not file the report its own
  // founding brief obliges it to file — measured twice live (slot 7 / probe task 3e744cb3, slot 3
  // / task 2b2e380f). This block proves the fallback and, just as importantly, its four edges:
  // the report lands in the OWNER's operations inbox and nowhere else, the same lane's
  // clarification still gets the identical 409, contradictory evidence is still refused, and the
  // row survives the death of the worker that filed it.
  {
    const inboxMain = await freeSlot();
    const inboxMainOpen = inboxMain ? await post(`/api/slots/${inboxMain}/open`, { cwd: REPO, label: "inbox-main" }) : null;
    const inboxMain2 = await freeSlot();
    const inboxMain2Open = inboxMain2 ? await post(`/api/slots/${inboxMain2}/open`, { cwd: REPO, label: "inbox-main2" }) : null;
    const newLane = async () => (await (await post("/api/lanes", { repo: REPO })).json()) as
      { slot: number; cwd: string; branch: string };
    const taskLane = await newLane();       // owner-dispatched: taskId, no program, no watch
    const noTaskLane = await newLane();     // nothing dispatched it — the boundary that stays 409
    const twoWatchLane = await newLane();   // a task AND two contradictory watchers
    const legacyLane = await newLane();     // a task AND legacy-only watch evidence
    const capLane = await newLane();        // drives the owner inbox ceiling
    check("B4 fixtures: two MAIN occupants and five distinct lanes exist",
      !!inboxMainOpen?.ok && !!inboxMain2Open?.ok
        && new Set([inboxMain, inboxMain2, taskLane.slot, noTaskLane.slot, twoWatchLane.slot,
          legacyLane.slot, capLane.slot]).size === 7,
      JSON.stringify({ inboxMain, inboxMain2, lanes: [taskLane.slot, noTaskLane.slot,
        twoWatchLane.slot, legacyLane.slot, capLane.slot] }));

    const b4Tok = new Map<number, string>();
    for (const slot of [taskLane.slot, noTaskLane.slot, twoWatchLane.slot, legacyLane.slot, capLane.slot])
      b4Tok.set(slot, await paneEnv(`s${slot}`, "FLEET_SELF_TOKEN") ?? "");
    check("B4 fixtures: every lane has an exact, distinct scoped credential",
      [...b4Tok.values()].every((t) => /^[0-9a-f]{32}$/.test(t)) && new Set(b4Tok.values()).size === 5,
      `${b4Tok.size} credentials`);

    const w1 = await post(`/api/slots/${inboxMain}/watch`, { target: twoWatchLane.slot, idleSec: 3600 });
    const w2 = await post(`/api/slots/${inboxMain2}/watch`, { target: twoWatchLane.slot, idleSec: 3600 });
    check("B4 fixtures: two distinct receiver occupants watch the same lane", w1.ok && w2.ok,
      `${w1.status}/${w2.status}`);

    await tmuxOut("kill-session", "-t", "srv");
    await Bun.sleep(500);
    const b4Path = `${ROOT}/fleet.json`;
    const b4Planted = JSON.parse(readFileSync(b4Path, "utf8")) as {
      slots: Record<string, Record<string, unknown>>; watches?: Record<string, unknown>[];
    };
    // A dispatched task stamps taskId/originId on the SLOT (server.ts, the dispatcher). Planting
    // exactly those two fields is the whole difference between "the owner sent this lane out" and
    // "someone opened a lane by hand" — the fallback reads no other signal.
    for (const lane of [taskLane, twoWatchLane, legacyLane, capLane]) {
      b4Planted.slots[String(lane.slot)].taskId = `task-${lane.slot}`;
      b4Planted.slots[String(lane.slot)].originId = `origin-${lane.slot}`;
    }
    b4Planted.watches = [...(b4Planted.watches ?? []), {
      id: "b4legacywatch", slot: inboxMain, idleSec: 0, armed: false,
      created: Date.now(), firedAt: Date.now(), lastResult: "sent", kind: "lane",
      target: legacyLane.slot, targetCwd: legacyLane.cwd, targetBranch: legacyLane.branch,
    }];
    writeFileSync(b4Path, JSON.stringify(b4Planted, null, 2), { mode: 0o600 });
    await restartSrv();

    const b4AuditStart = auditRows().length;
    const plogBefore = (await plogRead()).length;
    const eventsBefore = (await fleetReportEventRows()).length;

    // --- the fallback itself -----------------------------------------------------------------
    const inboxText = "Owner-inbox slice complete; ALL PASS quoted in the commit body.";
    const inboxRes = await selfFleetReport(b4Tok.get(taskLane.slot) ?? "",
      { status: "complete", text: inboxText });
    const inboxReport = (await inboxRes.json() as { report?: FleetReportRow }).report;
    const inboxRows = (await fleetReportEventRows()).filter((e) => e.subjectSlot === taskLane.slot);
    const inboxEvent = inboxRows[0];
    check("B4 owner-inbox: a dispatched task lane with no program and no watch files exactly one inbox row",
      inboxRes.ok && inboxRows.length === 1 && inboxReport?.basis === "owner-inbox"
        && inboxReport.receiver === null
        && inboxReport.provenance.taskId === `task-${taskLane.slot}`
        && inboxReport.provenance.programId === null
        && inboxEvent?.receiverSlot === null && inboxEvent.receiverOpenedAt === null
        && inboxEvent.receiverSessionId === null && inboxEvent.watchId === null
        && inboxEvent.status === "inbox" && inboxEvent.delivery === "inbox"
        && inboxEvent.payload.basis === "owner-inbox" && inboxEvent.payload.text === inboxText,
      JSON.stringify({ status: inboxRes.status, report: inboxReport, event: inboxEvent }));

    // The owner's sight of it is the SAME payload the board already polls — the panel reads
    // /api/sessions `events`, which is where fleetReportEventRows() just read it from. What must
    // also hold is that no SESSION sees it: fleetReportsFor binds worker OR receiver, and an
    // owner row has no receiver at all.
    const inboxScope = await selfFleetReports(b4Tok.get(taskLane.slot) ?? "");
    const strangerScope = await selfFleetReports(b4Tok.get(noTaskLane.slot) ?? "");
    const mainInboxScope = await selfGet(await paneEnv(`s${inboxMain}`, "FLEET_SELF_TOKEN") ?? "")
      .then((r) => r.json() as Promise<{ events?: FleetReportEventRow[] }>);
    check("B4 owner-inbox scope: the filing lane reads its own row back, and no other session sees it",
      inboxScope.reports.length === 1 && inboxScope.reports[0]?.id === inboxReport?.id
        && strangerScope.reports.length === 0
        && !(mainInboxScope.events ?? []).some((e) => e.id === inboxEvent?.id),
      JSON.stringify({ worker: inboxScope.reports.map((r) => r.id),
        stranger: strangerScope.reports.length, main: (mainInboxScope.events ?? []).map((e) => e.id) }));

    // --- it is filed, never typed ------------------------------------------------------------
    // `inbox` is not a pending state, so FACT 2 never selects the row. That is a property of the
    // state machine and is asserted as one: no transport clock, no attempt, and neither the audit
    // trail nor the prompt journal records a send for this event id.
    await Bun.sleep(Math.max(600, AUTOS_TICK_MS * 3));
    const stillFiled = (await fleetReportEventRows()).find((e) => e.id === inboxEvent?.id);
    const sendAudits = auditRows().slice(b4AuditStart).filter((row) =>
      row.detail?.includes(inboxEvent?.id ?? "no-event")
      && ["fleet_event_delivered", "fleet_event_send_uncertain", "fleet_event_held",
        "fleet_event_receiver_gone"].includes(row.event ?? ""));
    const plogAfter = await plogRead();
    check("B4 owner-inbox: an inbox row is filed, never typed — no attempt, no clock, no journal entry",
      stillFiled?.status === "inbox" && stillFiled.attempts === 0 && stillFiled.deliveredAt === null
        && stillFiled.acknowledgedAt === null && sendAudits.length === 0
        && plogAfter.length === plogBefore
        && !plogAfter.some((entry) => JSON.stringify(entry).includes(inboxEvent?.id ?? "no-event")),
      JSON.stringify({ status: stillFiled?.status, attempts: stillFiled?.attempts,
        audits: sendAudits.map((r) => r.event), plog: `${plogBefore}->${plogAfter.length}` }));

    const openAudit = auditRows().slice(b4AuditStart).filter((row) => row.event === "fleet_report_open");
    check("B4 audit: the accepted open names the owner inbox as receiver and copies no report text",
      openAudit.length === 1 && openAudit[0]?.slot === taskLane.slot
        && openAudit[0]?.detail === `${inboxReport?.id} receiver=owner-inbox status=complete basis=owner-inbox`,
      JSON.stringify(openAudit));

    // --- the same lane's QUESTION is still refused -------------------------------------------
    // The divergence is the whole abstraction judgment: an inbox cannot answer, so routing a
    // clarification here would replace a visible 409 with an invisible forever-wait.
    const sameLaneQuestion = await selfClarify(b4Tok.get(taskLane.slot) ?? "",
      { question: "Same lane, same absent receiver — who answers?" });
    const sameLaneText = await sameLaneQuestion.text();
    check("B4 divergence: the lane that just filed a report keeps the identical clarification 409",
      sameLaneQuestion.status === 409
        && sameLaneText.includes("no exact clarification receiver evidence")
        && (await clarificationEventRows()).filter((e) => e.subjectSlot === taskLane.slot).length === 0,
      `${sameLaneQuestion.status} ${sameLaneText}`);

    // --- the three refusals that must NOT have been widened ----------------------------------
    const noTask = await selfFleetReport(b4Tok.get(noTaskLane.slot) ?? "",
      { status: "complete", text: "nothing dispatched me" });
    const noTaskText = await noTask.text();
    const twoWatch = await selfFleetReport(b4Tok.get(twoWatchLane.slot) ?? "",
      { status: "complete", text: "two watchers name two occupants" });
    const twoWatchText = await twoWatch.text();
    const legacyOnly = await selfFleetReport(b4Tok.get(legacyLane.slot) ?? "",
      { status: "complete", text: "legacy evidence only" });
    const legacyOnlyText = await legacyOnly.text();
    check("B4 boundary: no task, contradictory watchers and legacy-only evidence all keep their exact 409",
      noTask.status === 409 && noTaskText.includes("no exact clarification receiver evidence")
        && twoWatch.status === 409 && twoWatchText.includes("lane-watch evidence names multiple receiver occupants")
        && legacyOnly.status === 409 && legacyOnlyText.includes("only legacy lane-watch evidence exists without slotOpenedAt")
        && (await fleetReportEventRows()).length === eventsBefore + 1,
      `${noTask.status}:${noTaskText} / ${twoWatch.status}:${twoWatchText} / ${legacyOnly.status}:${legacyOnlyText}`);

    // --- acknowledgement belongs to exactly one principal -------------------------------------
    const selfAck = await ackEvent(b4Tok.get(taskLane.slot) ?? "", inboxEvent?.id ?? "x");
    const selfAckText = await selfAck.text();
    const strangerAck = await ackEvent(b4Tok.get(noTaskLane.slot) ?? "", inboxEvent?.id ?? "x");
    const strangerAckText = await strangerAck.text();
    check("B4 ack split: neither the filing lane nor a stranger can self-ack an inbox row, and both hear why",
      selfAck.status === 409 && selfAckText.includes("acknowledgement belongs to the owner")
        && strangerAck.status === 409 && strangerAckText.includes("acknowledgement belongs to the owner")
        && (await fleetReportEventRows()).find((e) => e.id === inboxEvent?.id)?.status === "inbox",
      `${selfAck.status}:${selfAckText} / ${strangerAck.status}:${strangerAckText}`);

    // --- the row outlives the worker that filed it --------------------------------------------
    // THE POINT OF A NULL RECEIVER, stated as a test. Had the row been bound to the worker's own
    // slot, dropWatchesFor -> markFleetEventReceiverGone would turn it terminal the moment the
    // lane is killed or recycled — and the owner's unread result would read as "receiver-gone"
    // while nobody had read anything. BREAKS IF the mint stamps `?? s.id` instead of `?? null`.
    await post(`/api/slots/${taskLane.slot}/kill`, {});
    await Bun.sleep(500);
    const afterKill = (await fleetReportEventRows()).find((e) => e.id === inboxEvent?.id);
    await restartSrv();
    const afterRestart = (await fleetReportEventRows()).find((e) => e.id === inboxEvent?.id);
    const reportAfterRestart = (JSON.parse(readFileSync(b4Path, "utf8")) as
      { fleetReports?: FleetReportRow[] }).fleetReports?.find((r) => r.id === inboxReport?.id);
    check("B4 survival: killing the worker occupant and restarting leaves the inbox row untouched",
      afterKill?.status === "inbox" && afterKill.receiverSlot === null
        && afterRestart?.status === "inbox" && afterRestart.delivery === "inbox"
        && afterRestart.receiverSlot === null && afterRestart.receiverOpenedAt === null
        && reportAfterRestart?.basis === "owner-inbox" && reportAfterRestart.receiver === null
        && reportAfterRestart.text === inboxText,
      JSON.stringify({ afterKill: afterKill?.status, afterRestart: afterRestart?.status,
        report: reportAfterRestart?.basis }));

    const ownerAck = await post(`/api/events/${inboxEvent?.id}/ack`, {});
    const ownerAckBody = await ownerAck.json() as { ok?: boolean; existing?: boolean;
      event?: { status?: string; acknowledgedAt?: number | null } };
    const ownerReAck = await post(`/api/events/${inboxEvent?.id}/ack`, {});
    const ownerReAckBody = await ownerReAck.json() as { existing?: boolean };
    const ackAudit = auditRows().filter((row) => row.event === "fleet_event_owner_ack"
      && row.detail === inboxEvent?.id);
    check("B4 owner ack: the owner closes the row he was filed to, idempotently, and it is his receipt alone",
      ownerAck.ok && ownerAckBody.event?.status === "acknowledged"
        && (ownerAckBody.event?.acknowledgedAt ?? 0) > 0 && ownerAckBody.existing === false
        && ownerReAck.ok && ownerReAckBody.existing === true
        && ackAudit.length === 1 && ackAudit[0]?.slot === undefined,
      JSON.stringify({ ack: ownerAck.status, body: ownerAckBody, reAck: ownerReAckBody, audit: ackAudit }));

    // --- the ceiling is hard, and refuses loudly ---------------------------------------------
    // The owner inbox has no session death to turn its rows terminal — only his own ack. Without
    // a ceiling this array is the unbounded fleet.json the whole delivery budget exists to stop.
    await tmuxOut("kill-session", "-t", "srv");
    await Bun.sleep(500);
    const capState = JSON.parse(readFileSync(b4Path, "utf8")) as { events?: Record<string, unknown>[] };
    const filler = Array.from({ length: 25 }, (_, i) => ({
      id: `b4cap${String(i).padStart(8, "0")}`, watchId: null,
      receiverSlot: null, receiverOpenedAt: null, receiverSessionId: null, receiverIdleSec: 0,
      subjectSlot: capLane.slot, subjectBranch: capLane.branch, kind: "fleet-report",
      payload: { reportId: `${"a".repeat(16)}${String(i).padStart(8, "0")}`, status: "complete",
        text: `filler ${i}`, taskId: null, originId: null, programId: null, basis: "owner-inbox" },
      createdAt: Date.now() - 1000 + i, status: "inbox", delivery: "inbox",
      attempts: 0, deliveredAt: null, acknowledgedAt: null,
    }));
    // ADVERSARIAL ROWS, planted in the SAME restart as the legitimate filler so one hydration
    // proves both directions at once: the loader must accept exactly the 25 real owner rows and
    // drop all three of these. A probe that only planted valid rows could not tell "fail-closed"
    // from "accepts anything", and a probe that only planted invalid ones could not tell it from
    // "drops everything".
    const adversarial = [
      // (a) THE OWNER PRINCIPAL BELONGS TO ONE KIND. A Watch completion with a null triple names
      // nobody: undeliverable, un-gone-able, un-ackable by its own subscriber — yet it would
      // count as an owner debt and squat a place at the ceiling forever.
      { id: "b4advforeignkind", watchId: "b4advwatch",
        receiverSlot: null, receiverOpenedAt: null, receiverSessionId: null, receiverIdleSec: 0,
        subjectSlot: capLane.slot, subjectBranch: capLane.branch, kind: "lane-ready",
        payload: { ahead: 1, dirty: 0, idleMs: 1000, observed: true, gitOp: false,
          awaiting: null, hostCommits: false },
        createdAt: Date.now(), status: "inbox", delivery: "inbox",
        attempts: 0, deliveredAt: null, acknowledgedAt: null },
      // (b) an owner receiver without inbox transport — a report addressed to a pane that does
      // not exist. FACT 2 would select it the moment it were `pending`.
      { id: "b4advownerpane", watchId: null,
        receiverSlot: null, receiverOpenedAt: null, receiverSessionId: null, receiverIdleSec: 0,
        subjectSlot: capLane.slot, subjectBranch: capLane.branch, kind: "fleet-report",
        payload: { reportId: `${"b".repeat(16)}00000001`, status: "complete", text: "owner without inbox",
          taskId: null, originId: null, programId: null, basis: "owner-inbox" },
        createdAt: Date.now(), status: "inbox",
        attempts: 0, deliveredAt: null, acknowledgedAt: null },
      // (c) the opposite half: inbox transport bound to a SESSION — a row filed at the owner that
      // a slot recycle could turn `receiver-gone` under him while it was still unread.
      { id: "b4advslotinbox", watchId: null,
        receiverSlot: capLane.slot, receiverOpenedAt: Date.now() - 1000, receiverSessionId: null,
        receiverIdleSec: 0, subjectSlot: capLane.slot, subjectBranch: capLane.branch,
        kind: "fleet-report",
        payload: { reportId: `${"c".repeat(16)}00000001`, status: "complete", text: "inbox at a session",
          taskId: null, originId: null, programId: null, basis: "owner-inbox" },
        createdAt: Date.now(), status: "inbox", delivery: "inbox",
        attempts: 0, deliveredAt: null, acknowledgedAt: null },
      // (d) and (e) mutate the THIRD carrier — the event payload's own `basis`, which is what the
      // board and the Supervisor projection read. Both rows are consistent in `delivery` and in
      // the receiver triple, so only the payload↔receiver equivalence can catch them.
      // (d) filed to NOBODY while claiming a bound Program-MAIN: the owner would read a report
      // addressed to a MAIN that was never told it existed.
      { id: "b4advbasisprogram", watchId: null,
        receiverSlot: null, receiverOpenedAt: null, receiverSessionId: null, receiverIdleSec: 0,
        subjectSlot: capLane.slot, subjectBranch: capLane.branch, kind: "fleet-report",
        payload: { reportId: `${"d".repeat(16)}00000001`, status: "complete", text: "null receiver, program basis",
          taskId: null, originId: null, programId: null, basis: "program-main" },
        createdAt: Date.now(), status: "inbox", delivery: "inbox",
        attempts: 0, deliveredAt: null, acknowledgedAt: null },
      // (e) the reverse: a pane row at a real session that claims it was filed to the owner.
      { id: "b4advbasisowner", watchId: null,
        receiverSlot: capLane.slot, receiverOpenedAt: Date.now() - 1000, receiverSessionId: null,
        receiverIdleSec: 60, subjectSlot: capLane.slot, subjectBranch: capLane.branch,
        kind: "fleet-report",
        payload: { reportId: `${"e".repeat(16)}00000001`, status: "complete", text: "session receiver, owner basis",
          taskId: null, originId: null, programId: null, basis: "owner-inbox" },
        createdAt: Date.now(), status: "pending",
        attempts: 0, deliveredAt: null, acknowledgedAt: null },
    ];
    capState.events = [...(capState.events ?? []), ...filler, ...adversarial];
    writeFileSync(b4Path, JSON.stringify(capState, null, 2), { mode: 0o600 });
    await restartSrv();
    const allAfterHydration = ((await (await get("/api/sessions")).json()) as
      { events: { id: string }[] }).events;
    const survivedAdversarial = adversarial.filter((row) =>
      allAfterHydration.some((e) => e.id === row.id)).map((row) => row.id);
    const loadedFiller = (await fleetReportEventRows()).filter((e) => e.id.startsWith("b4cap"));
    // STATUS, not merely presence. Hydrating a row and then turning it terminal on the same boot
    // is indistinguishable from "it survived" if the probe only counts ids — and that is exactly
    // how the boot reconciliation loop slipped past this check once: 25 rows loaded, all 25 were
    // flipped to `receiver-gone`, ownerInboxDebts() read 0, and the ceiling silently opened.
    const openFiller = loadedFiller.filter((e) => e.status === "inbox");
    check("B4 reverse-state is fail-closed: foreign kind, pane-owner, session-inbox and both payload-basis lies are refused",
      survivedAdversarial.length === 0 && loadedFiller.length === 25 && openFiller.length === 25,
      `survived=[${survivedAdversarial.join(",")}] legitimateFiller=${loadedFiller.length}`
        + ` stillOpen=${openFiller.length} statuses=${[...new Set(loadedFiller.map((e) => e.status))].join("/")}`);
    const capRefused = await selfFleetReport(b4Tok.get(capLane.slot) ?? "",
      { status: "complete", text: "the inbox is full" });
    const capRefusedText = await capRefused.text();
    check("B4 ceiling: 25 unacknowledged owner rows survive reverse-state and refuse the 26th by name",
      loadedFiller.length === 25 && capRefused.status === 409
        && capRefusedText.includes("owner operations inbox has no FleetEvent delivery budget")
        && (await fleetReportEventRows()).filter((e) => e.subjectSlot === capLane.slot
          && !e.id.startsWith("b4cap")).length === 0,
      `${loadedFiller.length} filler / ${capRefused.status} ${capRefusedText}`);

    // …and the ceiling is a BUDGET, not a wall: one owner ack returns exactly one place.
    const freed = await post(`/api/events/${filler[0]?.id}/ack`, {});
    const capAccepted = await selfFleetReport(b4Tok.get(capLane.slot) ?? "",
      { status: "needs-main", text: "one place came back" });
    check("B4 ceiling: acknowledging one row returns exactly one place to the next report",
      freed.ok && capAccepted.ok
        && (await fleetReportEventRows()).filter((e) => e.subjectSlot === capLane.slot
          && !e.id.startsWith("b4cap")).length === 1,
      `${freed.status}/${capAccepted.status}`);

    for (const slot of [noTaskLane.slot, twoWatchLane.slot, legacyLane.slot, capLane.slot,
      inboxMain, inboxMain2]) await post(`/api/slots/${slot}/kill`, {});
    await tmuxOut("kill-session", "-t", "srv");
    await Bun.sleep(500);
    const b4Cleaned = JSON.parse(readFileSync(b4Path, "utf8")) as {
      events?: { kind?: string }[]; fleetReports?: unknown[];
    };
    b4Cleaned.events = (b4Cleaned.events ?? []).filter((e) => e.kind !== "fleet-report");
    b4Cleaned.fleetReports = [];
    writeFileSync(b4Path, JSON.stringify(b4Cleaned, null, 2), { mode: 0o600 });
    await restartSrv();
  }

  // === V1b · THE RETURN PATH, DRIVEN ==========================================================
  // The projection GET /api/programs and the Supervisor senses show is only worth something if its
  // numbers are the ones the DOORS spend. So this block builds the exact shape the slice was cut
  // for — four armed watches plus one delivery debt on one bound MAIN — and then walks a lane into
  // it. What must come back is the refusal that already existed and was invisible from outside:
  // `fleet-report receiver has no FleetEvent delivery budget`, measured five times on 2026-08-25.
  //
  // Reservations and debts are counted by the SAME sum (slotDeliveryBudget), which is why both are
  // present here: a cut that read only one of them would still pass a probe built from the other.
  {
    const bMain = await freeSlot();
    const bOpen = bMain ? await post(`/api/slots/${bMain}/open`, { cwd: REPO, label: "return-path-main" }) : null;
    const budgetLanes: { slot: number; cwd: string; branch: string }[] = [];
    for (let i = 0; i < 4; i++)
      budgetLanes.push((await (await post("/api/lanes", { repo: REPO })).json()) as
        { slot: number; cwd: string; branch: string });
    check("V1b fixture: one plain MAIN occupant and four distinct lanes exist",
      !!bOpen?.ok && new Set([bMain, ...budgetLanes.map((l) => l.slot)]).size === 5,
      JSON.stringify({ bMain, lanes: budgetLanes.map((l) => l.slot) }));
    const bMainTok = await paneEnv(`s${bMain}`, "FLEET_SELF_TOKEN") ?? "";
    const laneToks: string[] = [];
    for (const l of budgetLanes) laneToks.push(await paneEnv(`s${l.slot}`, "FLEET_SELF_TOKEN") ?? "");
    check("V1b fixture: every participant carries its own exact scoped credential",
      [bMainTok, ...laneToks].every((t) => /^[0-9a-f]{32}$/.test(t))
        && new Set([bMainTok, ...laneToks]).size === 5,
      `lengths=${[bMainTok, ...laneToks].map((t) => t.length).join("/")}`);

    // The binding is the ONE server fact clarificationReceiverFor reads to name the receiver, and
    // it is planted with srv down — the technique every binding fixture in this file uses. No body
    // below names a receiver, a program or a slot.
    await tmuxOut("kill-session", "-t", "srv");
    await Bun.sleep(500);
    const budgetStatePath = `${ROOT}/fleet.json`;
    const budgetPlant = JSON.parse(readFileSync(budgetStatePath, "utf8")) as {
      slots: Record<string, Record<string, unknown>>; programs?: Record<string, unknown>[];
    };
    const budgetProgramId = "e".repeat(24);
    const bMainRow = budgetPlant.slots[String(bMain)];
    budgetPlant.programs = [...(budgetPlant.programs ?? []), {
      id: budgetProgramId, title: "Return path fixture",
      intent: "Receive the typed results of its own lanes",
      successCriterion: "The budget the doors spend is the budget the sights show",
      nonGoals: [], decisions: [], evidence: [], openQuestions: [],
      status: "active", createdAt: Date.now() - 1000, proposedBy: { kind: "owner" },
      confirmedAt: Date.now() - 900, activatedAt: Date.now() - 800,
      main: { slot: bMain, openedAt: bMainRow.openedAt, sessionId: bMainRow.sessionId,
        boundAt: Date.now() - 700 },
    }];
    for (const l of budgetLanes) budgetPlant.slots[String(l.slot)].programId = budgetProgramId;
    writeFileSync(budgetStatePath, JSON.stringify(budgetPlant, null, 2), { mode: 0o600 });
    await restartSrv();

    const openBudget = await programBudget(budgetProgramId);
    check("V1b: a fresh live binding projects the FULL return path — five of five places, and the sentence says open",
      openBudget?.deliveryBudget?.state === "known" && openBudget.deliveryBudget.cap === 5
        && openBudget.deliveryBudget.deliveryDebts === 0
        && openBudget.deliveryBudget.armedReservations === 0
        && openBudget.deliveryBudget.free === 5
        && (openBudget.deliveryBudgetNote ?? "").startsWith(`return path open at slot ${bMain}: 5 of 5`),
      JSON.stringify({ budget: openBudget?.deliveryBudget, note: openBudget?.deliveryBudgetNote }));

    // FOUR RESERVATIONS. Every target is a fresh lane with no commits, so the done-looking
    // predicate never classifies it and none of these can fire — a fire would DISARM, quietly
    // turning the four the doors count into three with no check noticing.
    for (const l of budgetLanes) {
      const armed = await post(`/api/slots/${bMain}/watch`, { target: l.slot, idleSec: 3600 });
      check(`V1b: the MAIN subscribes to lane ${l.slot} — one armed reservation`,
        armed.ok, `${armed.status} ${await armed.text()}`);
    }
    // …AND ONE DEBT. An accepted report is exactly the act the fifth place pays for, so this call
    // must still succeed: four reservations leave one.
    const firstReport = await selfFleetReport(laneToks[0],
      { status: "complete", text: "the fifth delivery place is now spent" });
    check("V1b: with four reservations one place is left, and a report spends it",
      firstReport.ok, `${firstReport.status} ${await firstReport.text()}`);
    const closedBudget = await programBudget(budgetProgramId);
    check("V1b: four armed watches plus one delivery debt read as a CLOSED return path — before any lane hits it",
      closedBudget?.deliveryBudget?.state === "known"
        && closedBudget.deliveryBudget.deliveryDebts === 1
        && closedBudget.deliveryBudget.armedReservations === 4
        && closedBudget.deliveryBudget.cap === 5 && closedBudget.deliveryBudget.free === 0
        && (closedBudget.deliveryBudgetNote ?? "").includes(`return path CLOSED at slot ${bMain}`),
      JSON.stringify({ budget: closedBudget?.deliveryBudget, note: closedBudget?.deliveryBudgetNote }));

    // THE COUNTERPROBE ITSELF: the same 4+1 the sight just described is what the doors refuse on,
    // each in its own words. Two doors, one sum — a later cut that gave either door its own
    // arithmetic would pass one of these and fail the other.
    const refusedReport = await selfFleetReport(laneToks[1],
      { status: "complete", text: "there is no place left for me" });
    const refusedReportText = await refusedReport.text();
    const refusedClarify = await selfClarify(laneToks[1], { question: "and no place for a question either?" });
    const refusedClarifyText = await refusedClarify.text();
    check("V1b counterprobe: at zero free places BOTH minting doors refuse, in the words the sight quoted",
      refusedReport.status === 409
        && refusedReportText.includes("fleet-report receiver has no FleetEvent delivery budget")
        && refusedClarify.status === 409
        && refusedClarifyText.includes("clarification receiver has no FleetEvent delivery budget"),
      `${refusedReport.status} ${refusedReportText} / ${refusedClarify.status} ${refusedClarifyText}`);
    const afterRefusal = (await fleetReportEventRows()).filter((e) => e.receiverSlot === bMain);
    const armedAfterRefusal = (await watchRows()).filter((w) => w.slot === bMain && w.armed).length;
    check("V1b: the refusals minted nothing, and reading the sight again acknowledges nothing and disarms nothing",
      afterRefusal.length === 1 && afterRefusal.every((e) => e.status !== "acknowledged")
        && armedAfterRefusal === 4
        && JSON.stringify((await programBudget(budgetProgramId))?.deliveryBudget)
          === JSON.stringify(closedBudget?.deliveryBudget),
      JSON.stringify({ events: afterRefusal.map((e) => [e.id, e.status]), armedAfterRefusal }));

    // A RELEASED PLACE IS A PLACE. `free` has to track both directions, or it is a counter that
    // only grows and every closed return path would look permanent: killing one watched lane
    // disarms its reservation, and the next report goes through on the place that came back.
    await post(`/api/slots/${budgetLanes[3].slot}/kill`, {});
    const releasedBudget = await programBudget(budgetProgramId);
    const secondReport = await selfFleetReport(laneToks[2],
      { status: "needs-main", text: "the place a disarmed watch gave back" });
    check("V1b: a disarmed reservation gives its place back — the sight sees it and the door honours it",
      releasedBudget?.deliveryBudget?.state === "known"
        && releasedBudget.deliveryBudget.armedReservations === 3
        && releasedBudget.deliveryBudget.free === 1
        && (releasedBudget.deliveryBudgetNote ?? "").startsWith(`return path open at slot ${bMain}: 1 of 5`)
        && secondReport.ok,
      JSON.stringify({ budget: releasedBudget?.deliveryBudget, second: secondReport.status }));

    for (const slot of [bMain, ...budgetLanes.map((l) => l.slot)])
      await post(`/api/slots/${slot}/kill`, {});
    await tmuxOut("kill-session", "-t", "srv");
    await Bun.sleep(500);
    const budgetCleanup = JSON.parse(readFileSync(budgetStatePath, "utf8")) as {
      events?: { kind?: string }[]; fleetReports?: unknown[]; programs?: { id?: string }[];
    };
    budgetCleanup.events = (budgetCleanup.events ?? []).filter((e) => e.kind !== "fleet-report");
    budgetCleanup.fleetReports = [];
    budgetCleanup.programs = (budgetCleanup.programs ?? []).filter((p) => p.id !== budgetProgramId);
    writeFileSync(budgetStatePath, JSON.stringify(budgetCleanup, null, 2), { mode: 0o600 });
    await restartSrv();
  }

  // --- the receivers, both PLAIN slots: the session this feature exists for is a driving main
  // checkout, and that is also the shape the SELF route below is scoped to. Everything down to the
  // teardown drives the OWNER route; the self twin gets its own block, on its own slot, so neither
  // principal's pins can be satisfied by the other's. `rcvA` is left quiet and gets idleSec:0;
  // `rcvB` is deliberately kept busy. ---
  const aId = await freeSlot();
  const openA = aId ? await post(`/api/slots/${aId}/open`, { cwd: REPO }) : null;
  check("watch setup: a plain receiver slot is open", !!openA?.ok, `${aId} ${openA?.status}`);
  const bId = await freeSlot();
  const openB = bId ? await post(`/api/slots/${bId}/open`, { cwd: REPO }) : null;
  check("watch setup: a second plain receiver slot is open", !!openB?.ok, `${bId} ${openB?.status}`);
  // Read both credentials before any Watch can inject into either pane. paneEnv is itself a
  // pane exchange; racing it with the transport under test can consume its unique marker.
  const aTok = await paneEnv(`s${aId}`, "FLEET_SELF_TOKEN") ?? "";
  const bTok = await paneEnv(`s${bId}`, "FLEET_SELF_TOKEN") ?? "";
  check("event ack setup: both receiver panes carry distinct scoped tokens before subscription",
    /^[0-9a-f]{32}$/.test(aTok) && /^[0-9a-f]{32}$/.test(bTok) && aTok !== bTok,
    `${aTok}:${bTok}`);
  // Slots are recyclable, while the prompt ledger is append-only. Count only rows written after
  // these two receiver identities were opened; an earlier occupant's Watch is not this fixture's.
  const ownerWatchLogStart = (await plogRead()).length;
  const ownerWatchMessages = async (slot: number) => (await plogRead()).slice(ownerWatchLogStart)
    .filter((e) => e.slot === slot && e.text.startsWith("[fleet] slot "));

  // --- REJECTIONS. Every one answers the same question — can this watch ever fire? A watch that
  // cannot is worse than none, because it is a silent forever-wait, which is the failure the whole
  // surface removes. So a target the predicate never classifies is refused at CREATE time. ---
  const rNonLane = await post(`/api/slots/${aId}/watch`, { target: bId });
  check("watch on a NON-LANE slot is refused (done-looking only classifies lanes)",
    rNonLane.status === 409, `${rNonLane.status} ${await rNonLane.text()}`);
  const rSelf = await post(`/api/slots/${aId}/watch`, { target: aId });
  check("a session cannot watch itself", rSelf.status === 400, String(rSelf.status));
  const rIdle = await post(`/api/slots/${aId}/watch`, { target: await freeSlot() });
  check("watch on an INACTIVE slot is refused", rIdle.status === 400, String(rIdle.status));
  const rBogus = await post(`/api/slots/${aId}/watch`, { target: 999 });
  check("watch on a nonexistent slot is refused", rBogus.status === 400, String(rBogus.status));
  {
    // the ⚙ steward is a lane by every mechanical test and is still excluded by name — a planning
    // pane's diff is not lane work, so the predicate never fires for it and neither may a watch
    const st = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number };
    await post(`/api/slots/${st.slot}/rename`, { label: "⚙ steward" });
    const rStew = await post(`/api/slots/${aId}/watch`, { target: st.slot });
    check("watch on the ⚙ steward is refused even though it is a worktree lane",
      rStew.status === 409, `${rStew.status} ${await rStew.text()}`);
    await post(`/api/slots/${st.slot}/kill`, {});
  }

  // --- a lane on a harness the automation policy declines can NEVER be classified done-looking:
  // aliveInfo folds harnessAutomatable into `alive`, and both looking predicates require
  // alive === true. Measured live 2026-08-29 on pi-zai (adapter declines); this suite fleet runs
  // FLEET_HARNESS_AUTOMATION=0, so here the FLAG half of harnessAutomatableFor refuses `pi` —
  // adapter-side automatable:true — through the same never-fires physics. `naTgt` stays open for
  // the self-path row in the twin below and is killed there. ---
  const naTgt = (await (await post("/api/lanes", { repo: REPO, harness: "pi" })).json()) as
    { slot: number; cwd: string; branch: string };
  check("watch non-automatable fixture: a pi-harness lane exists as a target",
    naTgt.slot > 0, JSON.stringify(naTgt));
  const rNa = await post(`/api/slots/${aId}/watch`, { target: naTgt.slot });
  const rNaText = await rNa.text();
  check("watch on a lane whose harness the policy declines is refused 409 — it could never fire",
    rNa.status === 409 && rNaText.includes("harness pi is not automatable")
      && rNaText.includes("its slot never reads as alive to the done-looking predicate, so this watch could never fire")
      && rNaText.includes("FLEET_HARNESS_AUTOMATION is off; no named harness is automatable without it"),
    `${rNa.status} ${rNaText}`);
  // the merge twin on the SAME target must be refused for the MERGE reason only — the tick reads
  // the merge terminal factor for merge, not laneSignalView, and such a lane demonstrably fires a
  // merge watch. A harness 409 here would forbid a watch that works.
  const rNaMerge = await post(`/api/slots/${aId}/watch`, { kind: "merge", target: naTgt.slot });
  const rNaMergeText = await rNaMerge.text();
  check("the same target as {kind:\"merge\"} is refused for the merge reason only — the harness clause is lane-scoped",
    rNaMerge.status === 409 && rNaMergeText.includes("no running or persisted terminal merge exists")
      && !rNaMergeText.includes("not automatable"),
    `${rNaMerge.status} ${rNaMergeText}`);
  // GEGENPROBE: same receiver, same shape, DEFAULT adapter — accepted and armed. Without it the
  // 409s above could be any regression that broke the route. Watch deleted and lane killed right
  // after, so neither can answer a later duplicate subscription with existing:true.
  const okTgt = (await (await post("/api/lanes", { repo: REPO })).json()) as
    { slot: number; cwd: string; branch: string };
  const rOk = await post(`/api/slots/${aId}/watch`, { target: okTgt.slot, idleSec: 3600 });
  const rOkJ = (await rOk.json()) as { ok?: boolean; watch?: WatchRow };
  check("GEGENPROBE: the same watch on a default-adapter lane is accepted and armed",
    rOk.status === 200 && rOkJ.ok === true && rOkJ.watch?.armed === true
      && rOkJ.watch?.target === okTgt.slot,
    `${rOk.status} ${JSON.stringify(rOkJ.watch ?? null)}`);
  if (rOkJ.watch?.id) await post(`/api/watches/${rOkJ.watch.id}/delete`, {});
  await post(`/api/slots/${okTgt.slot}/kill`, {});

  // === THE SELF TWIN: POST /api/self/watch =====================================================
  // Same mint (createWatchForSlot), different principal: `s` comes from the token instead of the
  // URL. The delivery machinery is therefore already proven by the owner half above and is not
  // re-run here — what is NOT shared, and is the whole subject of this block, is the auth binding
  // and the refusals. Its subscriber rule runs the OPPOSITE way to the four lane-only self routes
  // (drift/gate/criterion/verify-intent refuse a plain session 409; this one refuses a LANE 409),
  // and that asymmetry is exactly the kind of thing a later reader "simplifies" into a copy.
  {
    const cId = await freeSlot();
    const openC = cId ? await post(`/api/slots/${cId}/open`, { cwd: REPO }) : null;
    check("self-watch setup: a third plain slot is open to subscribe from", !!openC?.ok, `${cId} ${openC?.status}`);
    // The credential is read out of the PANE, not out of fleet.json, because "a session that was
    // actually handed the token" is the thing being tested — a state read would pass even if the
    // export never reached the pane. paneEnv is the deterministic probe (unique marker, anchored
    // match, send-keys retried); a hand-rolled send-keys + sleep + capture-pane is the flake shape
    // that harness function exists to have removed. null means the pane never answered, which is a
    // harness failure and fails here rather than being mistaken for an absent variable.
    const cTok = await paneEnv(`s${cId}`, "FLEET_SELF_TOKEN") ?? "";
    check("self-watch setup: the plain subscriber's pane carries FLEET_SELF_TOKEN",
      /^[0-9a-f]{32}$/.test(cTok), `[${cTok}]`);
    const laneTok = await paneEnv(`s${tgt.slot}`, "FLEET_SELF_TOKEN") ?? "";
    check("self-watch setup: the target lane's pane carries its own, different FLEET_SELF_TOKEN",
      /^[0-9a-f]{32}$/.test(laneTok) && laneTok !== cTok, `[${laneTok}]`);
    // peer lanes: peers[0] is a VALID target, so the LANE refusal below can only be about the
    // SUBSCRIBER — aimed at a non-lane it would 409 for the other reason and prove nothing. All
    // five together are what fills WATCH_MAX_PER_SLOT at the end of this block.
    const peers: { slot: number; branch: string }[] = [];
    for (let i = 0; i < 5; i++)
      peers.push((await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; branch: string });
    check("self-watch setup: five peer lanes exist (a valid target, and the cap's population)",
      peers.every((p) => p.slot > 0) && new Set(peers.map((p) => p.slot)).size === 5,
      JSON.stringify(peers.map((p) => p.slot)));

    // --- auth: the same three refusals every route in the self family carries. 401 and not 403,
    // because none of these is a recognized credential in the wrong scope — they are not this
    // route's credential at all. ---
    check("self-watch: the owner token does not substitute for a selfToken",
      (await fetch(`${BASE}/api/self/watch`, {
        method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ target: peers[0].slot }),
      })).status === 401);
    check("self-watch: an unknown selfToken is rejected",
      (await selfWatch("0".repeat(32), { target: peers[0].slot })).status === 401);
    check("self-watch: a missing selfToken header is rejected",
      (await selfWatch(null, { target: peers[0].slot })).status === 401);

    // --- THE NEW RIEGEL, and the reason this block exists. A lane's credential is RECOGNIZED and
    // the target is valid: the only thing that can refuse it is the subscriber rule. 409, never
    // 401 — same convention as the four routes that refuse in the other direction, because a 401
    // would send a session hunting for a token it already holds. ---
    const swLane = await selfWatch(laneTok, { target: peers[0].slot });
    const swLaneText = await swLane.text();
    check("a LANE calling /api/self/watch is refused 409 with its own reason — the mirror of the four lane-only routes",
      swLane.status === 409 && swLaneText.includes("a lane may not subscribe"),
      `${swLane.status} ${swLaneText}`);

    // --- the target refusals, re-asserted THROUGH the self path with their exact wording. Sharing
    // createWatchForSlot is what makes them identical today; pinning the strings is what stops a
    // future self-path-only branch from quietly answering something else. ---
    const idle = await freeSlot();
    check("self-watch setup: a genuinely inactive slot is available as a target", idle > 0, String(idle));
    // the ⚙ steward case borrows peers[4] rather than minting a seventh lane: the label is what the
    // check is about, and it is renamed back before the cap block uses that lane as a real target.
    check("self-watch setup: peers[4] is temporarily labelled ⚙ steward",
      (await post(`/api/slots/${peers[4].slot}/rename`, { label: "⚙ steward" })).ok);
    const targetRejects: [string, unknown, number, string][] = [
      ["a nonexistent slot", { target: 999 }, 400, "bad target"],
      ["itself", { target: cId }, 400, "a session cannot watch itself"],
      ["an inactive slot", { target: idle }, 400, "target slot not active"],
      ["a non-lane slot", { target: aId }, 409, "target is not a lane — done-looking only classifies lanes"],
      ["a lane on a non-automatable harness", { target: naTgt.slot }, 409, "is not automatable"],
      ["the ⚙ steward", { target: peers[4].slot }, 409, "the ⚙ steward is never classified done-looking"],
    ];
    for (const [what, body, status, reason] of targetRejects) {
      const r = await selfWatch(cTok, body);
      const text = await r.text();
      check(`self-watch on ${what}: refused ${status} with the owner path's wording, verbatim`,
        r.status === status && text.includes(reason), `${r.status} ${text}`);
    }
    check("self-watch setup: peers[4]'s label is restored, so the cap block targets a real lane",
      (await post(`/api/slots/${peers[4].slot}/rename`, { label: "watch-peer" })).ok);
    await post(`/api/slots/${naTgt.slot}/kill`, {});

    // --- the binding, and the reason a pane-typing route can be handed to a session at all: the
    // RECEIVER is the token's slot. A `slot` field naming a different one is not validated and
    // rejected, it is structurally never read — createWatchForSlot takes `s` and never the body.
    //
    // EVERY subscription in this block points at a PEER lane, never at `tgt`, and that is not
    // arbitrary: `tgt` carries a commit, so it is on its way to done-looking and a watch on it
    // fires by itself within a tick or two. Firing disarms — which would silently turn the armed
    // count the cap checks below into 4, and the cap's refusal into a pass for the wrong reason.
    // The peers have no commits (ahead 0), so the predicate never classifies them and an armed
    // watch on one stays armed for as long as this block needs it to. ---
    const sw = await selfWatch(cTok, { target: peers[0].slot, idleSec: 3600, slot: aId });
    const swJ = (await sw.json()) as { ok?: boolean; watch?: WatchRow; existing?: boolean };
    check("POST /api/self/watch: a plain session subscribes with its OWN pane-exported token",
      sw.ok && swJ.watch?.armed === true && swJ.watch.target === peers[0].slot
      && swJ.watch.targetBranch === peers[0].branch, `${sw.status} ${JSON.stringify(swJ)}`);
    check("new Self-route Watches persist the receiver occupant openedAt at the shared creation seam",
      swJ.watch?.slotOpenedAt === persistedOpenedAt(cId) && (swJ.watch?.slotOpenedAt ?? 0) > 0,
      `${swJ.watch?.slotOpenedAt} vs ${persistedOpenedAt(cId)}`);
    check("a spoofed `slot` field is ignored — the watch lands on the TOKEN's slot, not the named one",
      swJ.watch?.slot === cId, `landed on ${swJ.watch?.slot}; token slot ${cId}, spoofed ${aId}`);
    const swDup = (await (await selfWatch(cTok, { target: peers[0].slot })).json()) as
      { watch?: WatchRow; existing?: boolean };
    check("self-watch is idempotent too — re-subscribing returns the SAME watch, not a second",
      swDup.existing === true && swDup.watch?.id === swJ.watch?.id
      && (await watchRows()).filter((w) => w.slot === cId && w.armed).length === 1,
      `${swDup.watch?.id} vs ${swJ.watch?.id}`);

    // --- GET /api/self names them next to the autos: the read half of the same credential. Spent
    // rows are served too, and that is load-bearing — a watch disarmed because its target died
    // delivers NOTHING into the pane, so armed-only would make "still waiting" and "will never
    // come" indistinguishable from inside the session, the one belief this surface exists to make
    // impossible. Proven at the end of this block, after the peers are killed. ---
    const selfRow = await (await fetch(`${BASE}/api/self`, { headers: { "x-fleet-self-token": cTok } })).json() as
      { slot: number; watches?: WatchRow[]; autos?: unknown[]; events?: FleetEventRow[] };
    check("GET /api/self serves the session its OWN watches and typed events beside its autos",
      Array.isArray(selfRow.watches) && Array.isArray(selfRow.autos) && Array.isArray(selfRow.events)
      && selfRow.watches.some((w) => w.id === swJ.watch?.id)
      && selfRow.watches.every((w) => w.slot === cId)
      && selfRow.events.every((e) => e.receiverSlot === cId),
      JSON.stringify(selfRow.watches?.map((w) => `${w.slot}:${w.id}`)));

    // --- the cap. WATCH_MAX_PER_SLOT is shared, not re-implemented per principal, and this is what
    // proves the self path did not route around it: peers[0] is already armed, peers[1..4] fill it
    // to five, and a SIXTH distinct valid target — `tgt`, a real lane — is refused. The cap is the
    // LAST check createWatchForSlot makes, so every earlier reason has to be excluded for the
    // refusal to mean anything; that is why these are five live lanes and not five cheap bad ids. ---
    for (const p of peers.slice(1)) {
      const r = await selfWatch(cTok, { target: p.slot, idleSec: 3600 });
      check(`self-watch fills the cap: subscribing to peer lane ${p.slot}`, r.ok, `${r.status} ${await r.text()}`);
    }
    const capped = await selfWatch(cTok, { target: tgt.slot, idleSec: 3600 });
    const cappedText = await capped.text();
    check("WATCH_MAX_PER_SLOT applies on the self path exactly as on the owner's — the sixth is refused",
      capped.status === 400 && cappedText.includes("max 5 active watches per slot"),
      `${capped.status} ${cappedText}`);
    check("the cap counted armed watches, and the refusal minted nothing",
      (await watchRows()).filter((w) => w.slot === cId && w.armed).length === 5,
      JSON.stringify((await watchRows()).filter((w) => w.slot === cId).map((w) => `${w.target}:${w.armed}`)));

    // the peers go away while all five watches are armed: each disarms WITH its reason, and the
    // self row is where the subscribing session can still read that — the check the comment above
    // promised. Nothing was typed into its pane about any of them.
    for (const p of peers) await post(`/api/slots/${p.slot}/kill`, {});
    const after = await (await fetch(`${BASE}/api/self`, { headers: { "x-fleet-self-token": cTok } })).json() as
      { watches?: WatchRow[] };
    const dead = (after.watches ?? []).filter((w) => !w.armed);
    check("a session reads its own DISARMED watches too — 'will never come' is legible, not a silent gap",
      dead.length === 5 && dead.every((w) => (w.lastResult ?? "").includes("target session ended")),
      JSON.stringify(dead.map((w) => `${w.target}:${w.lastResult}`)));
    check("and nothing was ever typed into the subscriber's pane — no watch here ever fired",
      !(await plogRead()).some((e) => e.slot === cId && e.text.startsWith("[fleet] slot ")));
    await post(`/api/slots/${cId}/kill`, {});
  }

  // --- the subscription itself ---
  const wA = await post(`/api/slots/${aId}/watch`, { target: tgt.slot, idleSec: 0 });
  const wAJ = (await wA.json()) as { watch: WatchRow };
  check("subscribe: a plain slot may watch a lane", wA.ok && !!wAJ.watch?.id && wAJ.watch.armed === true,
    JSON.stringify(wAJ).slice(0, 160));
  check("new owner-route Watches persist the receiver occupant openedAt at the shared creation seam",
    wAJ.watch?.slotOpenedAt === persistedOpenedAt(aId) && (wAJ.watch?.slotOpenedAt ?? 0) > 0,
    `${wAJ.watch?.slotOpenedAt} vs ${persistedOpenedAt(aId)}`);
  check("the watch pins the target's BRANCH, not just its recycled slot id",
    wAJ.watch?.targetBranch === tgt.branch, `${wAJ.watch?.targetBranch} vs ${tgt.branch}`);
  // a second subscribe is the same subscription, not a second one: two armed watches would deliver
  // the same news twice into one pane
  const wDup = (await (await post(`/api/slots/${aId}/watch`, { target: tgt.slot })).json()) as
    { watch: WatchRow; existing?: boolean };
  check("re-subscribing to the same target returns the SAME watch, never a second",
    wDup.existing === true && wDup.watch?.id === wAJ.watch.id
    && (await watchRows()).filter((w) => w.slot === aId && w.armed).length === 1,
    `${wDup.watch?.id} vs ${wAJ.watch.id}`);

  // the busy receiver: same target, but its pane is loud and the gate is two seconds. The wait for
  // lastOutput>0 is what makes this a test of the BUSY gate rather than a race with it: until
  // poll() has seen a first byte the field is 0, and `now - 0` is ~1.79e12 ms — the arithmetic
  // that made this very check fail on the first run by handing the message to a pane that had
  // produced nothing yet (server.ts, THE UNOBSERVED-PANE HOLE).
  let observed = 0;
  for (let i = 0; i < 60 && !observed; i++) {
    // the probe is RE-FIRED each round, not merely re-read, and that is the load-bearing half.
    // The `open` above restarted this pane's pipe, and ensureSlot sets quietUntil = now + 1500
    // when it does; poll() streams anything inside that window WITHOUT stamping lastOutput. One
    // send therefore renders on the pane and still leaves the field at 0 — after which a
    // read-only loop spins for its full 15 s against a pane that never prints again. Measured
    // that way twice on the same tree, deterministically, not as a flake: this slot is recycled
    // out of the stalled block just above, so the send always lands inside a fresh window.
    // Same mechanism as docs/verify-tiering.md §11.2c, which is where the family is recorded.
    await tmuxOut("send-keys", "-t", `s${bId}`, "echo watch-busy-marker", "Enter");
    await Bun.sleep(250);
    observed = ((await (await get("/api/sessions")).json()) as { slots: { id: number; lastOutput: number }[] })
      .slots.find((x) => x.id === bId)?.lastOutput ?? 0;
  }
  check("watch setup: the busy receiver's pane has actually been observed (lastOutput>0)",
    observed > 0, String(observed));
  const wB = (await (await post(`/api/slots/${bId}/watch`, { target: tgt.slot, idleSec: 2 })).json()) as
    { watch: WatchRow };
  check("subscribe: a busy receiver may also watch the same lane", !!wB.watch?.id, JSON.stringify(wB).slice(0, 120));

  // --- signal -> event. Keep B loud until BOTH events exist. Event creation is independent of
  // receiver availability, so A may be delivered while B must remain pending. ---
  let eventA: FleetEventRow | undefined;
  let eventB: FleetEventRow | undefined;
  for (let i = 0; i < 180 && !(eventA?.status === "delivered" && eventB?.status === "pending"); i++) {
    await tmuxOut("send-keys", "-t", `s${bId}`, "echo watch-still-busy", "Enter");
    await Bun.sleep(250);
    eventA = await eventForWatch(wAJ.watch.id);
    eventB = await eventForWatch(wB.watch.id);
  }
  check("one signal creates exactly one durable event even for a busy receiver",
    eventB?.status === "pending" && eventB.attempts === 0
    && (await eventRows()).filter((e) => e.watchId === wB.watch.id).length === 1,
    JSON.stringify(eventB));
  const fired = await watchRow(wAJ.watch.id);
  const busySpent = await watchRow(wB.watch.id);
  check("signal capture spends both Watches before transport; the free receiver's event is delivered, not acked",
    fired?.armed === false && busySpent?.armed === false
    && eventA?.status === "delivered" && eventA.attempts === 1 && eventA.acknowledgedAt === null,
    JSON.stringify({ fired, busySpent, eventA }));
  check("owner visibility exposes the typed event array independently of the Watch rows",
    (await eventRows()).some((e) => e.id === eventA?.id)
    && (await eventRows()).some((e) => e.id === eventB?.id));

  // --- WHAT IT SAID. Asserted against the prompt log, which stores the text verbatim, not against
  // capture-pane (a ~450-char line wraps at the pane width and would make the assertion a test of
  // tmux's reflow). The pane itself is checked separately, on a substring that starts a line. ---
  const msgs = await ownerWatchMessages(aId);
  check("the notification reached the pane exactly once", msgs.length === 1,
    `${msgs.length}: ${msgs.map((m) => m.text.slice(0, 40)).join(" | ")}`);
  const msg = msgs[0]?.text ?? "";
  check("the message names the target slot AND its branch",
    msg.includes(`slot ${tgt.slot} (${tgt.branch})`), msg.slice(0, 120));
  check("the message carries the facts the predicate fired on (ahead/dirty)",
    msg.includes("1 ahead / 0 dirty"), msg.slice(0, 200));
  check("the message says LOOKS done, and says why that is not 'is done'",
    msg.includes("LOOKS done") && !/\bis done\b/.test(msg)
    && msg.includes("NOT a report from that lane") && msg.includes("never land on this message alone")
    && msg.includes(`[event ${eventA?.id}]`)
    && msg.includes(`POST /api/self/events/${eventA?.id}/ack`),
    msg.slice(0, 260));
  const capA = await tmuxOut("capture-pane", "-t", `s${aId}`, "-p");
  check("the notification is really in the receiving pane, not just the log",
    capA.out.includes("[fleet] slot "), capA.out.slice(-200));

  check("busy transport owes the already-created event without typing or minting another",
    eventB?.status === "pending" && (await ownerWatchMessages(bId)).length === 0
    && (await eventRows()).filter((e) => e.watchId === wB.watch.id).length === 1,
    JSON.stringify(eventB));

  // --- Ack is a session-bound act. Foreign slot and unknown id fail before the right principal
  // acknowledges; the identical second Ack returns the same terminal fact. ---
  const foreignAck = eventA ? await ackEvent(bTok, eventA.id) : new Response(null, { status: 599 });
  check("a foreign Self principal cannot acknowledge another slot's event",
    foreignAck.status === 409 && (await eventForWatch(wAJ.watch.id))?.status === "delivered",
    `${foreignAck.status} ${await foreignAck.text()}`);
  const falseAck = await ackEvent(aTok, "doesnotexist");
  check("an unknown event id is 4xx and changes no real event", falseAck.status === 404
    && (await eventForWatch(wAJ.watch.id))?.status === "delivered", String(falseAck.status));
  const ackA = eventA ? await ackEvent(aTok, eventA.id) : new Response(null, { status: 599 });
  const ackAJ = await ackA.json() as { ok?: boolean; existing?: boolean; event?: FleetEventRow };
  const ackA2 = eventA ? await ackEvent(aTok, eventA.id) : new Response(null, { status: 599 });
  const ackA2J = await ackA2.json() as { ok?: boolean; existing?: boolean; event?: FleetEventRow };
  check("the bound Self principal acknowledges delivered -> acknowledged, idempotently",
    ackA.ok && ackAJ.existing === false && ackAJ.event?.status === "acknowledged"
    && ackA2.ok && ackA2J.existing === true && ackA2J.event?.acknowledgedAt === ackAJ.event.acknowledgedAt,
    JSON.stringify({ ackAJ, ackA2J }));

  // --- DEPLOY OUTCOME: same subscription/event/transport/ack rail, joined only by deploy id. ---
  const deployLedger = `${ROOT}/deploys.jsonl`;
  const appendDeploy = (row: Record<string, unknown>): void =>
    appendFileSync(deployLedger, `${JSON.stringify(row)}\n`, { mode: 0o600 });
  const deployRow = (id: string, ok: boolean | null, stage: "build" | "restart" | "boot",
    extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    at: Date.now(), id, by: "owner", stage, ok,
    target: "1".repeat(40), bootHead: ok === null ? null : "1".repeat(40), head: "1".repeat(40),
    hitTarget: ok === null ? null : ok, bundleStale: ok === null ? null : !ok, ...extra,
  });
  const malformedDeployId = await selfWatch(aTok, { kind: "deploy", deployId: "NOT-HEX" });
  check("deploy watch: malformed deployId is refused 400 with a named field error",
    malformedDeployId.status === 400 && (await malformedDeployId.text()).includes("deployId must be exactly 8"));
  const unknownDeployId = await selfWatch(aTok, { kind: "deploy", deployId: "deadbeef" });
  const unknownDeployText = await unknownDeployId.text();
  check("deploy watch: an unknown id is refused loudly because it could never fire",
    unknownDeployId.status === 409
      && unknownDeployText.includes("no in-flight or persisted deploy exists with that id — this watch could never fire"),
    `${unknownDeployId.status} ${unknownDeployText}`);

  const successId = "d0000001";
  appendDeploy(deployRow(successId, true, "boot", { hitTarget: true, bundleStale: false }));
  const successSubR = await selfWatch(aTok, { kind: "deploy", deployId: successId, idleSec: 0 });
  const successSub = await successSubR.json() as { watch?: DeployWatchRow };
  const successEvent = successSub.watch ? await waitDeployEvent(successSub.watch.id) : undefined;
  check("deploy watch: subscribing after a green row fires in the subscribe call with typed hitTarget",
    successSubR.ok && successSub.watch?.armed === false && successEvent?.payload.ok === true
      && successEvent.payload.hitTarget === true && successEvent.subjectDeployId === successId,
    JSON.stringify({ successSub, successEvent }));
  check("new non-lane-kind Watches also inherit slotOpenedAt from the one common creation seam",
    successSub.watch?.kind === "deploy" && successSub.watch.slotOpenedAt === persistedOpenedAt(aId)
      && (successSub.watch.slotOpenedAt ?? 0) > 0,
    `${successSub.watch?.slotOpenedAt} vs ${persistedOpenedAt(aId)}`);
  const successText = (await plogRead()).find((p) => p.slot === aId
    && p.text.includes(`[event ${successEvent?.id}]`))?.text ?? "";
  check("deploy watch: success rendering says ok=YES and names notification versus verdict",
    successText.includes("ok=YES") && successText.includes("not a claim that the deploy succeeded"), successText);
  const deployForeignAck = successEvent ? await ackEvent(bTok, successEvent.id) : new Response(null, { status: 599 });
  check("deploy event: a foreign receiver slot cannot acknowledge it",
    deployForeignAck.status === 409, `${deployForeignAck.status} ${await deployForeignAck.text()}`);
  const deployAck1 = successEvent ? await ackEvent(aTok, successEvent.id) : new Response(null, { status: 599 });
  const deployAck2 = successEvent ? await ackEvent(aTok, successEvent.id) : new Response(null, { status: 599 });
  const deployAck2J = await deployAck2.json() as { existing?: boolean };
  check("deploy event: acknowledgement is idempotent in the bound receiver session",
    deployAck1.ok && deployAck2.ok && deployAck2J.existing === true,
    `${deployAck1.status}/${deployAck2.status} ${JSON.stringify(deployAck2J)}`);

  const failureId = "d0000002";
  appendDeploy(deployRow(failureId, false, "build", {
    bootHead: "0".repeat(40), hitTarget: false, bundleStale: true, reason: "build failed deterministically",
  }));
  const failureSub = await (await selfWatch(bTok,
    { kind: "deploy", deployId: failureId, idleSec: 0 })).json() as { watch?: DeployWatchRow };
  const failureEvent = failureSub.watch ? await waitDeployEvent(failureSub.watch.id) : undefined;
  const failureText = (await plogRead()).find((p) => p.slot === bId
    && p.text.includes(`[event ${failureEvent?.id}]`))?.text ?? "";
  check("deploy watch: failed row stays ok=false with bounded reason and never renders as success",
    failureEvent?.payload.ok === false && failureEvent.payload.reason === "build failed deterministically"
      && failureText.includes("ok=NO") && failureText.includes("Reason: build failed deterministically")
      && !failureText.includes("ok=YES"), JSON.stringify({ event: failureEvent, text: failureText }));
  if (failureEvent) await ackEvent(bTok, failureEvent.id);

  const unknownId = "d0000003";
  appendDeploy(deployRow(unknownId, null, "boot", { reason: "the boot head could not be measured" }));
  const unknownSub = await (await selfWatch(bTok,
    { kind: "deploy", deployId: unknownId, idleSec: 0 })).json() as { watch?: DeployWatchRow };
  const unknownEvent = unknownSub.watch ? await waitDeployEvent(unknownSub.watch.id) : undefined;
  const unknownText = (await plogRead()).find((p) => p.slot === bId
    && p.text.includes(`[event ${unknownEvent?.id}]`))?.text ?? "";
  check("deploy watch: unmeasured row stays ok=null and renders UNVERIFIED, never pass",
    unknownEvent?.payload.ok === null && unknownText.includes("ok=UNVERIFIED")
      && !unknownText.includes("ok=YES"), JSON.stringify({ event: unknownEvent, text: unknownText }));
  if (unknownEvent) await ackEvent(bTok, unknownEvent.id);

  const inflightId = "d0000004";
  writeFileSync(`${ROOT}/deploy-inflight.json`, JSON.stringify({
    id: inflightId, at: Date.now(), by: "owner", target: "2".repeat(40), bootHeadBefore: "1".repeat(40),
    buildMs: 1, buildCmd: "true", restartCmd: "true",
  }), { mode: 0o600 });
  const inflightSubR = await selfWatch(aTok, { kind: "deploy", deployId: inflightId, idleSec: 0 });
  const inflightSub = await inflightSubR.json() as { watch?: DeployWatchRow };
  const inflightDup = await (await selfWatch(aTok,
    { kind: "deploy", deployId: inflightId, idleSec: 0 })).json() as { watch?: DeployWatchRow; existing?: boolean };
  check("deploy watch: an in-flight marker admits one armed subscription and duplicate returns existing",
    inflightSubR.ok && inflightSub.watch?.armed === true && inflightDup.existing === true
      && inflightDup.watch?.id === inflightSub.watch?.id
      && (await deployWatchRows()).filter((w) => w.slot === aId && w.deployId === inflightId).length === 1,
    JSON.stringify({ inflightSub, inflightDup }));
  appendDeploy(deployRow(inflightId, false, "restart", {
    bootHead: "1".repeat(40), hitTarget: false, bundleStale: false, reason: "restart failed",
  }));
  rmSync(`${ROOT}/deploy-inflight.json`, { force: true });
  const inflightEvent = inflightSub.watch ? await waitDeployEvent(inflightSub.watch.id) : undefined;
  check("deploy watch: a row appearing after subscribe is level-minted exactly once by the tick",
    inflightEvent?.payload.ok === false && inflightEvent.payload.stage === "restart"
      && (await deployEventRows()).filter((e) => e.watchId === inflightSub.watch?.id).length === 1,
    JSON.stringify(inflightEvent));
  if (inflightEvent) await ackEvent(aTok, inflightEvent.id);

  const laneDeployToken = await paneEnv(`s${tgt.slot}`, "FLEET_SELF_TOKEN") ?? "";
  const laneDeployWatch = await selfWatch(laneDeployToken, { kind: "deploy", deployId: successId });
  check("deploy watch: a lane remains refused 409 on the existing self-watch route",
    laneDeployWatch.status === 409 && (await laneDeployWatch.text()).includes("a lane may not subscribe"));

  // --- Restart boundary. Stop before editing state: a live save chain may replace fleet.json.
  // Plant the exact durable image a crash after the pre-send marker leaves, plus a legacy spent
  // Watch and malicious extra payload keys. Load must preserve uncertainty, invent no legacy event,
  // and rebuild the payload whitelist rather than retaining free text. ---
  await tmuxOut("kill-session", "-t", "srv");
  await Bun.sleep(500);
  const statePath = `${ROOT}/fleet.json`;
  type EventState = { events?: unknown[]; watches?: unknown[] };
  let eventState: EventState | null = null;
  let eventStateError = "";
  try { eventState = JSON.parse(readFileSync(statePath, "utf8")) as EventState; }
  catch (e) { eventStateError = e instanceof Error ? e.message : String(e); }
  check("event restart fixture: fleet state is readable only after srv stopped", eventState !== null, eventStateError);
  const crashId = "crashboundaryfixture";
  const crashWatchId = "crashboundarywatch";
  const legacyWatchId = "legacywatchfixture";
  const malformedOpenedAtWatchId = "malformedopenedatwatch";
  const malformedMergeId = "malformedmergefixture";
  const malformedDeployEventId = "malformeddeployfixture";
  const crashRaw = eventA ? {
    ...eventA, id: crashId, watchId: crashWatchId, status: "send-uncertain", attempts: 1,
    deliveredAt: null, acknowledgedAt: null,
    payload: { ...eventA.payload, text: "$(touch /tmp/must-not-run)", command: "echo unsafe" },
  } : null;
  eventState?.events?.push(crashRaw);
  if (eventA) eventState?.events?.push({
    ...eventA, id: malformedMergeId, watchId: "malformedmergewatch", kind: "merge-terminal",
    subjectCwd: tgt.cwd, payload: {
      status: "resolved", landed: false, branch: tgt.branch, at: Date.now(), verify: null,
    },
  });
  if (eventA) eventState?.events?.push({
    ...eventA, id: malformedDeployEventId, watchId: "malformeddeploywatch", kind: "deploy-terminal",
    subjectDeployId: successId, payload: {
      ok: null, stage: "boot", target: null, bootHead: null, hitTarget: null, bundleStale: null,
      at: Date.now(), reason: "x".repeat(201),
    },
  });
  eventState?.watches?.push({
    id: legacyWatchId, slot: aId, target: tgt.slot, targetCwd: tgt.cwd,
    targetBranch: tgt.branch, idleSec: 0, armed: false, created: Date.now(),
    firedAt: Date.now(), lastResult: "sent",
  });
  eventState?.watches?.push({
    id: malformedOpenedAtWatchId, slot: aId, slotOpenedAt: "nope", target: tgt.slot, targetCwd: tgt.cwd,
    targetBranch: tgt.branch, idleSec: 0, armed: false, created: Date.now(),
    firedAt: Date.now(), lastResult: "malformed",
  });
  if (eventState) writeFileSync(statePath, JSON.stringify(eventState, null, 2), { mode: 0o600 });
  await restartSrv();

  const afterRestartEvents = await eventRows();
  const restartedA = afterRestartEvents.find((e) => e.id === eventA?.id);
  const restartedB = afterRestartEvents.find((e) => e.id === eventB?.id);
  const uncertain = afterRestartEvents.find((e) => e.id === crashId);
  check("restart keeps an acknowledged event terminal and never re-injects it",
    restartedA?.status === "acknowledged" && (await ownerWatchMessages(aId)).length === 1,
    JSON.stringify(restartedA));
  check("restart keeps the busy pending event with the same id and no invented attempt",
    restartedB?.status === "pending" && restartedB.id === eventB?.id && restartedB.attempts === 0
    && (await ownerWatchMessages(bId)).length === 0, JSON.stringify(restartedB));
  await Bun.sleep(AUTOS_TICK_MS * 4 + 500);
  const uncertainAfterTicks = (await eventRows()).find((e) => e.id === crashId);
  check("the send/crash boundary stays visibly uncertain across restart and is never replayed or called acked",
    uncertainAfterTicks?.status === "send-uncertain" && uncertainAfterTicks.attempts === 1
    && uncertainAfterTicks.deliveredAt === null && uncertainAfterTicks.acknowledgedAt === null
    && (await ownerWatchMessages(aId)).length === 1, JSON.stringify(uncertainAfterTicks));
  // the legacy half of the transport split: every row written before `delivery` existed — watch and
  // event alike — loads with the field ABSENT and keeps the exact pane path the checks above prove.
  // The inbox half is asserted across its own restart further down, once such a row exists.
  check("legacy round trip: rows written before the split load with delivery absent, not coerced to a default",
    (await watchRows()).some((w) => w.id === legacyWatchId && w.delivery === undefined)
      && afterRestartEvents.some((e) => e.id === eventA?.id && e.delivery === undefined)
      && uncertain?.delivery === undefined,
    JSON.stringify({ legacyWatch: (await watchRows()).find((w) => w.id === legacyWatchId)?.delivery,
      legacyEvent: restartedA?.delivery, crash: uncertain?.delivery }));
  check("legacy spent Watch loads unchanged without an invented FleetEvent",
    (await watchRows()).some((w) => w.id === legacyWatchId && w.lastResult === "sent"
      && w.slotOpenedAt === undefined)
    && !(await eventRows()).some((e) => e.watchId === legacyWatchId));
  check("Watch reload keeps missing slotOpenedAt as legacy but rejects a present malformed value fail-closed",
    !(await watchRows()).some((w) => w.id === malformedOpenedAtWatchId)
      && (await watchRows()).some((w) => w.id === legacyWatchId && w.slotOpenedAt === undefined),
    JSON.stringify((await watchRows()).filter((w) => w.id === legacyWatchId || w.id === malformedOpenedAtWatchId)));
  check("per-kind event loading rejects a malformed merge payload without breaking legacy event restore",
    !afterRestartEvents.some((e) => e.id === malformedMergeId) && restartedA?.id === eventA?.id,
    JSON.stringify(afterRestartEvents.filter((e) => e.id === malformedMergeId || e.id === eventA?.id)));
  check("per-kind event loading rejects a malformed deploy-terminal payload",
    !(await deployEventRows()).some((e) => e.id === malformedDeployEventId));
  const payloadKeys = Object.keys(uncertainAfterTicks?.payload ?? {}).sort();
  check("persisted FleetEvent payload is a closed typed fact set and cannot carry free shell/text content",
    JSON.stringify(payloadKeys) === JSON.stringify([
      "ahead", "awaiting", "dirty", "gitOp", "hostCommits", "idleMs", "observed",
    ]) && !JSON.stringify(uncertainAfterTicks?.payload).includes("must-not-run")
      && !JSON.stringify(uncertainAfterTicks?.payload).includes("command"), JSON.stringify(uncertainAfterTicks?.payload));
  const selfA = await (await selfGet(aTok)).json() as { events?: FleetEventRow[] };
  check("GET /api/self exposes only this exact receiver session's events, including uncertainty",
    selfA.events?.some((e) => e.id === crashId) === true
    && selfA.events.every((e) => e.receiverSlot === aId && e.receiverOpenedAt === uncertain?.receiverOpenedAt),
    JSON.stringify(selfA.events?.map((e) => `${e.id}:${e.status}`)));
  const resolveUncertain = await ackEvent(aTok, crashId);
  check("the bound session may explicitly resolve a possibly-seen send-uncertain event",
    resolveUncertain.ok && (await eventRows()).find((e) => e.id === crashId)?.status === "acknowledged",
    `${resolveUncertain.status} ${await resolveUncertain.text()}`);

  // --- The pending event survived. Re-observe B after restart, then let its two-second idle gate
  // elapse. The same event is delivered once; repeated ticks neither mint nor inject a twin. ---
  observed = 0;
  for (let i = 0; i < 60 && !observed; i++) {
    await tmuxOut("send-keys", "-t", `s${bId}`, "echo watch-after-restart", "Enter");
    await Bun.sleep(250);
    observed = ((await (await get("/api/sessions")).json()) as { slots: { id: number; lastOutput: number }[] })
      .slots.find((x) => x.id === bId)?.lastOutput ?? 0;
  }
  check("pending restart fixture: receiver output is observed before its idle gate is tested", observed > 0, String(observed));
  let deliveredB: FleetEventRow | undefined;
  for (let i = 0; i < 40 && deliveredB?.status !== "delivered"; i++) {
    await Bun.sleep(250);
    deliveredB = await eventForWatch(wB.watch.id);
  }
  check("busy -> later idle delivers the SAME pending event exactly once",
    deliveredB?.status === "delivered" && deliveredB.id === eventB?.id && deliveredB.attempts === 1
    && (await ownerWatchMessages(bId)).length === 1
    && (await eventRows()).filter((e) => e.watchId === wB.watch.id).length === 1,
    JSON.stringify(deliveredB));
  await Bun.sleep(AUTOS_TICK_MS * 4 + 500);
  check("repeated ticks produce no duplicate event and no second pane injection",
    (await eventRows()).filter((e) => e.watchId === wB.watch.id).length === 1
    && (await ownerWatchMessages(bId)).length === 1);

  // A dead/replaced receiver makes the unacked event terminal for the owner. Neither the old
  // credential nor the replacement occupant can acknowledge it, and the replacement's /self
  // view cannot inherit it merely because the numeric slot was reused.
  await post(`/api/slots/${bId}/kill`, {});
  const gone = await eventForWatch(wB.watch.id);
  check("a dead receiver leaves its event inspectable as receiver-gone in the owner view",
    gone?.status === "receiver-gone" && gone.deliveredAt !== null && gone.acknowledgedAt === null,
    JSON.stringify(gone));
  check("the replaced session's old token is rejected and cannot Ack the gone event",
    (await ackEvent(bTok, gone?.id ?? "missing")).status === 401);
  const reopenB = await post(`/api/slots/${bId}/open`, { cwd: REPO });
  const newBTok = await paneEnv(`s${bId}`, "FLEET_SELF_TOKEN") ?? "";
  const replacementAck = await ackEvent(newBTok, gone?.id ?? "missing");
  const replacementSelf = await (await selfGet(newBTok)).json() as { events?: FleetEventRow[] };
  check("a replacement occupant is session-bound away from the old event",
    reopenB.ok && newBTok !== bTok && replacementAck.status === 409
    && !replacementSelf.events?.some((e) => e.id === gone?.id),
    `${replacementAck.status} ${await replacementAck.text()}`);

  // Watch deletion and subject teardown do not erase the durable completion object.
  check("delete the spent transport Watch", (await post(`/api/watches/${wAJ.watch.id}/delete`, {})).ok);
  check("deleting a Watch does not delete its acknowledged event",
    !(await watchRow(wAJ.watch.id)) && (await eventRows()).some((e) => e.id === eventA?.id));
  await post(`/api/slots/${tgt.slot}/kill`, {});
  check("subject teardown after event creation leaves the event trail intact",
    (await eventRows()).some((e) => e.id === eventA?.id && e.status === "acknowledged"));
  await post(`/api/slots/${bId}/kill`, {});
  await post(`/api/slots/${aId}/kill`, {});
  const reopenA = await post(`/api/slots/${aId}/open`, { cwd: REPO });
  const replacementATok = await paneEnv(`s${aId}`, "FLEET_SELF_TOKEN") ?? "";
  const replacedDeployAck = successEvent ? await ackEvent(replacementATok, successEvent.id)
    : new Response(null, { status: 599 });
  check("deploy event: a replacement receiver session cannot acknowledge the prior session's event",
    reopenA.ok && replacementATok !== aTok && replacedDeployAck.status === 409,
    `${replacedDeployAck.status} ${await replacedDeployAck.text()}`);

  // --- SUPERVISOR OPERATIONS INBOX: the transport split. `delivery` is a SUBSCRIPTION fact, named
  // by the subscriber and validated at CREATE time. An inbox event is minted straight to the status
  // word "inbox", which the transport loop never selects — so what is proven below is not "no
  // message arrived this time" but "no transport step exists": no pane bytes, no history row, no
  // prompt-journal row, deliveredAt null forever. Visibility and consumption stay separate facts —
  // the receiver session may SEE such a row and may never acknowledge it, and the owner may close
  // only those. Every pane-delivery check above is the untouched baseline for the legacy path.
  //
  // It runs HERE, LAST, on purpose: the pane fixtures above depend on a receiver pane
  // staying busy for a bounded window and on their own retained rows, and work inserted earlier
  // spends both. This family therefore reuses the slot the fixture has just recycled.
  const inboxBadDelivery = await selfWatch(replacementATok, { kind: "deploy", deployId: successId, delivery: "garbage" });
  const inboxBadDeliveryText = await inboxBadDelivery.text();
  check("inbox: an unknown delivery word is refused 400 by name, never defaulted to a transport",
    inboxBadDelivery.status === 400 && inboxBadDeliveryText.includes("delivery must be 'pane' or 'inbox'"),
    `${inboxBadDelivery.status} ${inboxBadDeliveryText}`);

  const paneRowBefore = JSON.stringify((await eventRows()).find((e) => e.id === successEvent?.id) ?? null);
  const paneOwnerAck = successEvent ? await post(`/api/events/${successEvent.id}/ack`, {})
    : new Response(null, { status: 599 });
  const paneOwnerAckText = await paneOwnerAck.text();
  check("inbox: the owner route refuses a PANE-delivered event — the split cuts both ways",
    paneOwnerAck.status === 409 && paneOwnerAckText.includes("acknowledgement belongs to the receiver session"),
    `${paneOwnerAck.status} ${paneOwnerAckText}`);
  // …and the refusal is INERT. The owner's new visibility into unacknowledged pane transport
  // (src/client.ts opsUnacked) shows him exactly these rows, so the one thing that must not happen
  // is looking at one becoming closing one — the refused call may not move a single field.
  check("owner ack on a pane row leaves it byte-identical — seeing is not consuming",
    paneRowBefore !== "null"
      && JSON.stringify((await eventRows()).find((e) => e.id === successEvent?.id) ?? null) === paneRowBefore,
    paneRowBefore.slice(0, 200));
  const unknownOwnerAck = await post("/api/events/deadbeefdeadbeefdeadbeef/ack", {});
  check("inbox: the owner route 404s an unknown event id", unknownOwnerAck.status === 404,
    `${unknownOwnerAck.status} ${await unknownOwnerAck.text()}`);

  const inboxId = "d0000005";
  appendDeploy(deployRow(inboxId, true, "boot", { hitTarget: true, bundleStale: false }));
  const paneBefore = await tmuxOut("capture-pane", "-p", "-t", `s${aId}`);
  const plogBefore = (await plogRead()).length;
  const historyOf = async (slot: number): Promise<{ text: string }[]> =>
    ((await (await get(`/api/slots/${slot}/history`)).json()) as { history?: { text: string }[] }).history ?? [];
  const historyBefore = (await historyOf(aId)).length;
  const inboxSubR = await selfWatch(replacementATok, { kind: "deploy", deployId: inboxId, idleSec: 0, delivery: "inbox" });
  const inboxSub = await inboxSubR.json() as { watch?: DeployWatchRow };
  await Bun.sleep(AUTOS_TICK_MS * 4 + 500); // give every tick its chance to deliver it, and prove it cannot
  const inboxEvent = (await deployEventRows()).find((e) => e.watchId === inboxSub.watch?.id);
  check("inbox: a delivery:'inbox' subscription rides back on the watch and mints status inbox, never pending",
    inboxSubR.ok && inboxSub.watch?.delivery === "inbox" && inboxSub.watch.armed === false
      && inboxEvent?.status === "inbox" && inboxEvent.delivery === "inbox"
      && inboxEvent.deliveredAt === null && inboxEvent.attempts === 0,
    JSON.stringify({ watch: inboxSub.watch, event: inboxEvent }));
  const paneAfter = await tmuxOut("capture-pane", "-p", "-t", `s${aId}`);
  const plogAfterRows = (await plogRead()).slice(plogBefore);
  const historyAfter = await historyOf(aId);
  check("inbox: the receiver pane is byte-unchanged and no history or prompt-journal row was written",
    paneAfter.out === paneBefore.out && historyAfter.length === historyBefore
      && !plogAfterRows.some((p) => p.slot === aId && p.text.includes(`[event ${inboxEvent?.id}]`))
      && !historyAfter.some((h) => h.text.includes(`[event ${inboxEvent?.id}]`)),
    JSON.stringify({ paneChanged: paneAfter.out !== paneBefore.out, historyBefore,
      historyAfter: historyAfter.length, newPlog: plogAfterRows.length }));

  // hand the spent transport Watch back at once. A Watch is retained per slot and the fixtures
  // around this family own theirs; the event is durable independently of it, which the checks
  // further down assert in their own right.
  if (inboxSub.watch) await post(`/api/watches/${inboxSub.watch.id}/delete`, {});
  const inboxSelfAck = inboxEvent ? await ackEvent(replacementATok, inboxEvent.id) : new Response(null, { status: 599 });
  const inboxSelfAckText = await inboxSelfAck.text();
  check("inbox: the bound receiver session cannot self-acknowledge — it was never offered the row",
    inboxSelfAck.status === 409 && inboxSelfAckText.includes("acknowledgement belongs to the owner"),
    `${inboxSelfAck.status} ${inboxSelfAckText}`);

  // a SECOND row for the happy path, so the first one stays open across the restart below — an
  // already-acknowledged row would prove nothing about loading the new status word.
  const inboxAckId = "d0000006";
  appendDeploy(deployRow(inboxAckId, false, "build", { hitTarget: false, bundleStale: true, reason: "build failed" }));
  const inboxAckSub = await (await selfWatch(replacementATok,
    { kind: "deploy", deployId: inboxAckId, idleSec: 0, delivery: "inbox" })).json() as { watch?: DeployWatchRow };
  const inboxAckEvent = (await deployEventRows()).find((e) => e.watchId === inboxAckSub.watch?.id);
  if (inboxAckSub.watch) await post(`/api/watches/${inboxAckSub.watch.id}/delete`, {});
  const ownerAck1 = inboxAckEvent ? await post(`/api/events/${inboxAckEvent.id}/ack`, {})
    : new Response(null, { status: 599 });
  const ownerAck1J = await ownerAck1.json() as
    { existing?: boolean; event?: { status?: string; deliveredAt?: number | null; acknowledgedAt?: number | null } };
  const ownerAck2 = inboxAckEvent ? await post(`/api/events/${inboxAckEvent.id}/ack`, {})
    : new Response(null, { status: 599 });
  const ownerAck2J = await ownerAck2.json() as { existing?: boolean; event?: { acknowledgedAt?: number | null } };
  check("inbox: the owner acknowledges an inbox event once, idempotently, and it stays never-delivered",
    ownerAck1.ok && ownerAck1J.existing === false && ownerAck1J.event?.status === "acknowledged"
      && ownerAck1J.event.deliveredAt === null
      && ownerAck2.ok && ownerAck2J.existing === true
      && ownerAck2J.event?.acknowledgedAt === ownerAck1J.event.acknowledgedAt,
    JSON.stringify({ ownerAck1J, ownerAck2J }));
  check("inbox: an unacknowledged inbox row is open delivery debt, exactly like an undelivered pane row",
    (await eventRows()).filter((e) => e.receiverSlot === aId
      && !["acknowledged", "receiver-gone"].includes(e.status)).some((e) => e.id === inboxEvent?.id),
    JSON.stringify((await eventRows()).filter((e) => e.receiverSlot === aId).map((e) => `${e.id}:${e.status}`)));

  // durability: the new status word must survive fleetEventFrom, and must still be undeliverable
  // on the other side of a restart — a fresh process re-arms every tick this row must not attract.
  await restartSrv();
  await Bun.sleep(AUTOS_TICK_MS * 4 + 500);
  const inboxAfterRestart = (await deployEventRows()).find((e) => e.id === inboxEvent?.id);
  check("inbox: a persisted inbox row survives restart as inbox/never-delivered and is still typed nowhere",
    inboxAfterRestart?.status === "inbox" && inboxAfterRestart.delivery === "inbox"
      && inboxAfterRestart.deliveredAt === null && inboxAfterRestart.attempts === 0
      && !(await plogRead()).some((p) => p.text.includes(`[event ${inboxEvent?.id}]`)),
    JSON.stringify(inboxAfterRestart));
  const closeInbox = inboxEvent ? await post(`/api/events/${inboxEvent.id}/ack`, {})
    : new Response(null, { status: 599 });
  check("inbox: the owner closes the restored row through the same route, from the loaded status",
    closeInbox.ok && (await deployEventRows()).find((e) => e.id === inboxEvent?.id)?.status === "acknowledged",
    `${closeInbox.status} ${await closeInbox.text()}`);

  // fail closed on IDENTITY, on the teardown this fixture performs anyway: an inbox row is not
  // exempt from the recycled-receiver rule. It turns terminal with its receiver's occupant and is
  // never re-targeted at whoever moves into the slot number next.
  const goneInboxId = "d0000007";
  appendDeploy(deployRow(goneInboxId, true, "boot", { hitTarget: true, bundleStale: false }));
  const goneInboxSub = await (await selfWatch(replacementATok,
    { kind: "deploy", deployId: goneInboxId, idleSec: 0, delivery: "inbox" })).json() as { watch?: DeployWatchRow };
  const goneInboxEvent = (await deployEventRows()).find((e) => e.watchId === goneInboxSub.watch?.id);
  if (goneInboxSub.watch) await post(`/api/watches/${goneInboxSub.watch.id}/delete`, {});
  check("inbox receiver-gone setup: the receiver holds one open inbox row before its teardown",
    goneInboxEvent?.status === "inbox" && goneInboxEvent.receiverSlot === aId,
    JSON.stringify(goneInboxEvent));
  await post(`/api/slots/${aId}/kill`, {});
  const goneInboxAfter = (await deployEventRows()).find((e) => e.id === goneInboxEvent?.id);
  const goneInboxOwnerAck = goneInboxEvent ? await post(`/api/events/${goneInboxEvent.id}/ack`, {})
    : new Response(null, { status: 599 });
  check("inbox: teardown makes an inbox row terminal, and the owner ack is then refused, never re-targeted",
    goneInboxAfter?.status === "receiver-gone" && goneInboxAfter.acknowledgedAt === null
      && goneInboxOwnerAck.status === 409,
    `${JSON.stringify(goneInboxAfter)} ${goneInboxOwnerAck.status} ${await goneInboxOwnerAck.text()}`);

  // --- STN-1 · THE TRANSITION WATCH, registration side. A Controller registers a question in its
  // own words; ONLY the bound Supervisor can answer it (e2e/supervisor.ts proves that door); the
  // answer rides the same transport every other Watch kind rides. Proved here: the refusals at
  // registration (lane, closed body, bounds, no Supervisor, the Supervisor itself), that the cap is
  // the SHARED one, that the parser is fail-closed for the new kind, that a deadline disarms with
  // no pane text, and that a receiver gone during transport ends the event as receiver-gone. ---
  {
    interface TransitionWatchRow {
      id: string; kind: string; slot: number; slotOpenedAt?: number; idleSec: number; armed: boolean;
      created: number; firedAt: number | null; lastResult: string | null; awaiting: string; deadlineAt: number;
    }
    interface TransitionEventRow {
      id: string; watchId: string | null; kind: string; status: string; receiverSlot: number; attempts: number;
    }
    const stateToken = (slot: number): string => (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
      { slots?: Record<string, { selfToken?: string; openedAt?: number; sessionId?: string | null }> })
      .slots?.[String(slot)]?.selfToken ?? "";
    const stateSlot = (slot: number): { openedAt: number; sessionId: string | null } => {
      const row = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
        { slots?: Record<string, { openedAt?: number; sessionId?: string | null }> }).slots?.[String(slot)];
      return { openedAt: row?.openedAt ?? 0, sessionId: row?.sessionId ?? null };
    };
    const allWatches = async (): Promise<TransitionWatchRow[]> =>
      ((await (await get("/api/sessions")).json()) as { watches: TransitionWatchRow[] }).watches;
    const allEvents = async (): Promise<TransitionEventRow[]> =>
      ((await (await get("/api/sessions")).json()) as { events: TransitionEventRow[] }).events;
    const transitionTexts = async (slot: number): Promise<number> =>
      (await plogRead()).filter((e) => e.slot === slot && e.text.startsWith("[fleet Supervisor transition ")).length;
    const complete = (tok: string, id: string, text: string): Promise<Response> =>
      fetch(`${BASE}/api/self/supervisor-watch/${id}/complete`, { method: "POST",
        headers: { "content-type": "application/json", "x-fleet-self-token": tok }, body: JSON.stringify({ text }) });

    const ctl = await freeSlot();
    const ctlOpen = await post(`/api/slots/${ctl}/open`, { cwd: REPO, label: "stn1-controller" });
    const sv = await freeSlot();
    const svOpen = await post(`/api/slots/${sv}/open`, { cwd: REPO, label: "stn1-supervisor-fixture" });
    const ctlTok = stateToken(ctl);
    const svTok = stateToken(sv);
    const lane = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; branch: string };
    const laneTok = stateToken(lane.slot);
    check("stn1 registration fixtures: a Controller, a Supervisor-to-be and a lane, each with a distinct credential",
      ctlOpen.ok && svOpen.ok && lane.slot > 0 && new Set([ctlTok, svTok, laneTok]).size === 3
        && [ctlTok, svTok, laneTok].every((t) => /^[0-9a-f]{32}$/.test(t)),
      `${ctl}/${sv}/${lane.slot}`);

    const body = (over: Record<string, unknown> = {}): Record<string, unknown> =>
      ({ kind: "transition", idleSec: 3600, deadlineSec: 600, awaiting: "the portfolio moves", ...over });
    const noSv = await selfWatch(ctlTok, body());
    const noSvText = await noSv.text();
    check("stn1 registration: with no bound Supervisor the watch is refused 409 — it could never be completed",
      noSv.status === 409 && noSvText.includes("no bound Supervisor"), `${noSv.status} ${noSvText}`);

    // the binding, installed the way every occupant fixture in this suite is: through the state
    // file, because a real bootstrap would prove the bootstrap (e2e/supervisor.ts does) and
    // nothing about registration. The supervisor module's baseline asserts a null binding, so
    // this block removes it again on its way out.
    const bindSupervisor = async (binding: Record<string, unknown> | null): Promise<void> => {
      await tmuxOut("kill-session", "-t", "srv");
      await Bun.sleep(500);
      const st = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as Record<string, unknown>;
      st.supervisor = binding;
      writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(st, null, 2), { mode: 0o600 });
      await restartSrv();
    };
    const svOccupant = stateSlot(sv);
    await bindSupervisor({ slot: sv, openedAt: svOccupant.openedAt, sessionId: svOccupant.sessionId, boundAt: Date.now() });

    const watchesBefore = (await allWatches()).length;
    const [rLane, rTarget, rSlot, rProgram, rDelivery, rNoAwait, rEmptyAwait, rLongAwait, rLowDl, rHighDl, rStrDl, rSelf]
      = await Promise.all([
        selfWatch(laneTok, body()),
        selfWatch(ctlTok, body({ target: lane.slot })),
        selfWatch(ctlTok, body({ slot: sv })),
        selfWatch(ctlTok, body({ programId: "p".repeat(24) })),
        selfWatch(ctlTok, body({ delivery: "inbox" })),
        selfWatch(ctlTok, { kind: "transition", idleSec: 0 }),
        selfWatch(ctlTok, body({ awaiting: "   " })),
        selfWatch(ctlTok, body({ awaiting: "x".repeat(501) })),
        selfWatch(ctlTok, body({ deadlineSec: 59 })),
        selfWatch(ctlTok, body({ deadlineSec: 86_401 })),
        selfWatch(ctlTok, body({ deadlineSec: "600" })),
        selfWatch(svTok, body()),
      ]);
    const rTexts = await Promise.all([rLane, rTarget, rSlot, rProgram, rDelivery, rNoAwait, rEmptyAwait, rLongAwait,
      rLowDl, rHighDl, rStrDl, rSelf].map((r) => r.text()));
    check("stn1 registration: a lane may not register a transition watch — the route's 409, unchanged",
      rLane.status === 409 && rTexts[0]!.includes("a lane may not subscribe"), `${rLane.status} ${rTexts[0]}`);
    // STN-2: the owner door feeds the same createWatchForSlot — without this refusal the owner
    // could register a transition watch on a LANE and the self route's 409 above would be moot.
    const rOwnerLane = await post(`/api/slots/${lane.slot}/watch`, body());
    const rOwnerCtl = await post(`/api/slots/${ctl}/watch`, body());
    const [rOwnerLaneText, rOwnerCtlText] = await Promise.all([rOwnerLane.text(), rOwnerCtl.text()]);
    check("stn1 registration: the owner route refuses kind transition by name (409) — for a lane and a plain session alike; only the receiving session registers its own question",
      rOwnerLane.status === 409 && rOwnerLaneText.includes("registered by the receiving session itself")
        && rOwnerCtl.status === 409 && rOwnerCtlText.includes("registered by the receiving session itself"),
      `${rOwnerLane.status} ${rOwnerLaneText} / ${rOwnerCtl.status}`);
    check("stn1 registration: the body is a CLOSED set — target, slot, programId and delivery are refused BY NAME (400)",
      rTarget.status === 400 && rTexts[1]!.includes("[target] is not read")
        && rSlot.status === 400 && rTexts[2]!.includes("[slot] is not read")
        && rProgram.status === 400 && rTexts[3]!.includes("[programId] is not read")
        && rDelivery.status === 400 && rTexts[4]!.includes("[delivery] is not read") && rTexts[4]!.includes("pane-only"),
      `${rTarget.status}:${rTexts[1]} | ${rSlot.status} | ${rProgram.status} | ${rDelivery.status}:${rTexts[4]}`);
    check("stn1 registration: awaiting is required, non-blank and at most 500 chars (400 each)",
      rNoAwait.status === 400 && rTexts[5]!.includes("awaiting must be")
        && rEmptyAwait.status === 400 && rLongAwait.status === 400 && rTexts[7]!.includes("at most 500"),
      `${rNoAwait.status}:${rTexts[5]} ${rEmptyAwait.status} ${rLongAwait.status}:${rTexts[7]}`);
    check("stn1 registration: deadlineSec is structurally bounded to [60, 86400] and must be a number (400 each)",
      rLowDl.status === 400 && rTexts[8]!.includes("[60, 86400]") && rHighDl.status === 400 && rStrDl.status === 400,
      `${rLowDl.status}:${rTexts[8]} ${rHighDl.status} ${rStrDl.status}`);
    check("stn1 registration: the bound Supervisor cannot register one on itself — it is the completer (409)",
      rSelf.status === 409 && rTexts[11]!.includes("cannot register a transition watch on itself"),
      `${rSelf.status} ${rTexts[11]}`);
    check("stn1 registration: not one refusal persisted a watch",
      (await allWatches()).length === watchesBefore, `${watchesBefore} -> ${(await allWatches()).length}`);

    // --- the cap is the SHARED one. Five armed transition watches fill it, and the SIXTH of a
    // DIFFERENT kind (a lane watch on a real lane) is refused with the one shared number. ---
    const minted: TransitionWatchRow[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await (await selfWatch(ctlTok, body({ awaiting: `question ${i}` }))).json() as
        { watch?: TransitionWatchRow; existing?: boolean };
      if (r.watch) minted.push(r.watch);
    }
    const first = minted[0];
    check("stn1 registration: five distinct questions mint five armed watches with default-free explicit deadlines",
      minted.length === 5 && minted.every((w) => w.kind === "transition" && w.armed && w.slot === ctl
        && w.slotOpenedAt === stateSlot(ctl).openedAt && w.deadlineAt === w.created + 600_000)
        && new Set(minted.map((w) => w.id)).size === 5,
      JSON.stringify(minted.map((w) => [w.id, w.awaiting, w.armed])));
    const dup = await (await selfWatch(ctlTok, body({ awaiting: "question 0" }))).json() as
      { watch?: TransitionWatchRow; existing?: boolean };
    check("stn1 registration: the same armed question is returned as existing, never minted twice",
      dup.existing === true && dup.watch?.id === first?.id, JSON.stringify(dup));
    const sixthLane = await post(`/api/slots/${ctl}/watch`, { target: lane.slot, idleSec: 3600 });
    const sixthText = await sixthLane.text();
    const sixthTransition = await selfWatch(ctlTok, body({ awaiting: "question 5" }));
    check("stn1 cap: the shared per-slot budget refuses the sixth watch of ANY kind with the one shared number",
      sixthLane.status === 400 && sixthText.includes("max 5 active watches per slot") && sixthTransition.status === 400
        && (await allWatches()).filter((w) => w.slot === ctl && w.armed).length === 5,
      `${sixthLane.status} ${sixthText} | ${sixthTransition.status}`);

    // --- expiry and the fail-closed parser, across one restart. The first watch's deadline is
    // moved into the past; two malformed transition rows (an inbox one, an awaiting-less one) are
    // planted beside it and must not load. ---
    await tmuxOut("kill-session", "-t", "srv");
    await Bun.sleep(500);
    {
      const st = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as { watches?: Record<string, unknown>[] };
      const row = (st.watches ?? []).find((w) => w.id === first?.id);
      if (row) row.deadlineAt = Date.now() - 1;
      st.watches?.push({ ...(row ?? {}), id: "stn1inboxfixture", awaiting: "planted", delivery: "inbox",
        deadlineAt: Date.now() + 600_000 });
      st.watches?.push({ ...(row ?? {}), id: "stn1noawaitfixture", awaiting: undefined, deadlineAt: Date.now() + 600_000 });
      writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(st, null, 2), { mode: 0o600 });
    }
    await restartSrv();
    let expired: TransitionWatchRow | undefined;
    for (let i = 0; i < 40 && expired?.armed !== false; i++) {
      expired = (await allWatches()).find((w) => w.id === first?.id);
      if (expired?.armed !== false) await Bun.sleep(250);
    }
    check("stn1 expiry: the tick disarms a watch past its deadline with lastResult 'expired' and no event",
      expired?.armed === false && (expired.lastResult ?? "").startsWith("expired")
        && !(await allEvents()).some((e) => e.watchId === first?.id),
      JSON.stringify(expired ?? null));
    check("stn1 expiry: no pane text accompanies an expiry — the rail carries transitions, not a second stream",
      (await transitionTexts(ctl)) === 0, String(await transitionTexts(ctl)));
    const lateComplete = await complete(svTok, first?.id ?? "x", "too late");
    const lateText = await lateComplete.text();
    check("stn1 expiry: completing an expired watch is 409 'no longer armed' and mints nothing",
      lateComplete.status === 409 && lateText.includes("no longer armed") && lateText.includes("expired")
        && !(await allEvents()).some((e) => e.watchId === first?.id),
      `${lateComplete.status} ${lateText}`);
    check("stn1 parser: a persisted transition row claiming inbox delivery or lacking awaiting is dropped fail-closed",
      !(await allWatches()).some((w) => w.id === "stn1inboxfixture" || w.id === "stn1noawaitfixture")
        && (await allWatches()).filter((w) => w.slot === ctl && w.kind === "transition").length === 5,
      JSON.stringify((await allWatches()).filter((w) => w.slot === ctl).map((w) => [w.id, w.armed])));
    const expiredAudit = ((await (await get("/api/audit")).json()) as { rows?: { event: string; detail?: string }[];
      events?: { event: string; detail?: string }[] });
    const auditRows = expiredAudit.rows ?? expiredAudit.events ?? [];
    check("stn1 expiry: the audit trail carries one watch_expire row naming the watch",
      auditRows.some((r) => r.event === "watch_expire" && (r.detail ?? "").includes(first?.id ?? "?")),
      JSON.stringify(auditRows.filter((r) => r.event === "watch_expire").slice(-2)));

    // --- the transport end: a completed watch whose receiver dies while the event is still
    // pending. idleSec 3600 keeps the Controller's event pending (it is never that idle), so the
    // teardown is what ends it — as receiver-gone, never as delivered, with no pane text. ---
    const second = minted[1];
    const doneRes = await complete(svTok, second?.id ?? "x", "the portfolio moved");
    const done = await doneRes.json() as { ok?: boolean; event?: TransitionEventRow };
    check("stn1 transport: completion mints one pending event for a not-yet-idle receiver",
      doneRes.ok && done.event?.status === "pending" && done.event.receiverSlot === ctl && done.event.attempts === 0,
      `${doneRes.status} ${JSON.stringify(done)}`);
    await Bun.sleep(AUTOS_TICK_MS * 3 + 200);
    const stillPending = (await allEvents()).find((e) => e.id === done.event?.id);
    await post(`/api/slots/${ctl}/kill`, {});
    const gone = (await allEvents()).find((e) => e.id === done.event?.id);
    check("stn1 transport: teardown of the registrant turns the pending event receiver-gone and types nothing",
      stillPending?.status === "pending" && gone?.status === "receiver-gone" && (await transitionTexts(ctl)) === 0,
      JSON.stringify({ stillPending, gone }));
    check("stn1 transport: the dead registrant's remaining armed watches are dropped with it — nothing to complete",
      !(await allWatches()).some((w) => w.slot === ctl),
      JSON.stringify((await allWatches()).filter((w) => w.slot === ctl).map((w) => w.id)));
    const ghost = await complete(svTok, minted[2]?.id ?? "x", "to nobody");
    check("stn1 transport: completing a dropped watch is 409 'unknown watch'",
      ghost.status === 409 && (await ghost.text()).includes("unknown watch"), String(ghost.status));

    // the transport honesty for this kind is the SAME code path, pinned at source: the new
    // message branch sits between the persisted send-uncertain marker and the sendText call of
    // the one FACT 2 loop, so every ACP-25 rule proved above for lane events binds it too.
    const transitionBranchAt = tickSource.indexOf('event.kind === "supervisor-transition"');
    check("stn1 transport: the supervisor-transition message is composed inside FACT 2 after send-uncertain is persisted and before sendText",
      transitionBranchAt > persistedAt && transitionBranchAt < sendAt, `${persistedAt}:${transitionBranchAt}:${sendAt}`);

    await bindSupervisor(null);
    check("stn1 cleanup: the fixture binding is gone again and the Supervisor module's null baseline holds",
      ((await (await get("/api/programs")).json()) as { supervisor: unknown }).supervisor === null);
    await post(`/api/slots/${sv}/kill`, {});
    await post(`/api/slots/${lane.slot}/kill`, {});
  }

  // --- PANE TRANSPORT WITHOUT A SESSION ACKNOWLEDGEMENT, CLIENT HALF. `delivered` means tmux
  // accepted paste+Enter and nothing else; the conversation on the other side never said it read
  // the text. Measured gap: delivered +3s, acknowledged +368s, and only because the owner happened
  // to see the text sitting in the composer. The server writes `delivered` once and otherwise reads
  // it only as the receiver-ack precondition, so an unacknowledged row is invisible debt.
  //
  // The classification rules ARE the feature, so the real `opsOpen`/`opsUnacked` are cut out of
  // src/client.ts and RUN — the same method as e2e/outcomes.ts (9f). What stays unproved and is
  // named: the rendering around them (this suite has no DOM harness), asserted by regex right
  // after. Nothing here mutates anything; the derivation is read-only by construction.
  {
    let cliSrc: string | null = null;
    let cliSrcError = "";
    try {
      cliSrc = readFileSync(`${dirname(realpathSync(`${ROOT}/node_modules`))}/src/client.ts`, "utf8");
    } catch (e) { cliSrcError = e instanceof Error ? e.message : String(e); }
    check("precondition: node_modules exposes src/client.ts for the pane-ack visibility checks",
      cliSrc !== null, cliSrcError);
    if (cliSrc !== null) {
      const opsSrc = cliSrc.slice(cliSrc.indexOf("const opsOpen ="), cliSrc.indexOf("function renderOpsBtn"));
      check("client: the two event classes are extractable as pure functions (no DOM in either)",
        opsSrc.includes("const opsUnacked") && opsSrc.includes("PANE_ACK_STALE_MS")
          && !/document|el\(|opsbtn|opspanel/.test(opsSrc), opsSrc.slice(0, 80));
      const ops = new Function(new Bun.Transpiler({ loader: "ts" }).transformSync(opsSrc)
        + "\nreturn { opsOpen, opsUnacked, PANE_ACK_STALE_MS };")() as {
          opsOpen: (rows: unknown[]) => unknown[];
          opsUnacked: (rows: unknown[], now: number) => { id: string }[];
          PANE_ACK_STALE_MS: number;
        };
      const NOW = 1_000_000_000;
      const STALE = ops.PANE_ACK_STALE_MS;
      const evt = (o: Record<string, unknown>): Record<string, unknown> =>
        ({ id: "x", receiverSlot: 1, createdAt: NOW - STALE - 1000, kind: "lane-ready",
          status: "delivered", deliveredAt: NOW - STALE - 1000, acknowledgedAt: null, ...o });
      const ids = (rows: { id: string }[]): string => rows.map((r) => r.id).sort().join(",");
      check("client: a named threshold, small and in seconds — not a timeout and not a retry budget",
        STALE >= 30_000 && STALE <= 600_000, String(STALE));

      // (1) the row this cut exists for becomes visible, and the boundary is the threshold itself
      const justUnder = evt({ id: "fresh", deliveredAt: NOW - STALE + 1000 });
      const justOver = evt({ id: "stale", deliveredAt: NOW - STALE - 1 });
      check("client: a pane row delivered but unacknowledged past the threshold becomes visible",
        ids(ops.opsUnacked([justOver], NOW)) === "stale", JSON.stringify(ops.opsUnacked([justOver], NOW)));
      check("client: a pane row still inside the threshold is NOT surfaced — a fresh send is not debt",
        ops.opsUnacked([justUnder], NOW).length === 0, JSON.stringify(ops.opsUnacked([justUnder], NOW)));

      // (2) every state that must NOT appear, each for its own reason: an ack arrived (promptly or
      // at all), the receiver is gone so no ack can ever come, or transport never even ran.
      const excluded = [
        evt({ id: "acked", status: "acknowledged", acknowledgedAt: NOW - STALE - 500 }),
        evt({ id: "prompt-acked", status: "acknowledged", deliveredAt: NOW - 3000,
          createdAt: NOW - 4000, acknowledgedAt: NOW - 2000 }),
        evt({ id: "gone", status: "receiver-gone" }),
        evt({ id: "never-sent", status: "pending", deliveredAt: null }),
        evt({ id: "filed", status: "inbox", delivery: "inbox", deliveredAt: null }),
      ];
      check("client: acknowledged, receiver-gone, never-attempted and filed rows are all absent",
        ops.opsUnacked(excluded, NOW).length === 0, ids(ops.opsUnacked(excluded, NOW)));

      // (3) send-uncertain is the one status with no delivery clock at all (it is persisted BEFORE
      // tmux is touched), so it must age from createdAt rather than fall out of the class entirely.
      check("client: send-uncertain ages from createdAt — a missing delivery clock is not a missing row",
        ids(ops.opsUnacked([evt({ id: "unc", status: "send-uncertain", deliveredAt: null })], NOW)) === "unc"
          && ops.opsUnacked([evt({ id: "unc-fresh", status: "send-uncertain", deliveredAt: null,
            createdAt: NOW - 1000 })], NOW).length === 0);

      // (4) THE TWO COUNTS ARE NEVER THE SAME NUMBER OVER THE SAME ROW. Filed operations want the
      // owner to close them; unacknowledged pane transport wants nobody. A row in both classes, or
      // one count computed as a sum, would make one badge mean two different things.
      const mixed = [...excluded, justOver, justUnder,
        evt({ id: "filed2", status: "inbox", delivery: "inbox", deliveredAt: null })];
      const filed = ops.opsOpen(mixed) as { id: string }[];
      const unacked = ops.opsUnacked(mixed, NOW);
      check("client: the filed-operations and unacknowledged-pane classes are disjoint over one ledger",
        ids(filed) === "filed,filed2" && ids(unacked) === "stale"
          && !filed.some((f) => unacked.some((u) => u.id === f.id)),
        `filed=[${ids(filed)}] unacked=[${ids(unacked)}]`);

      // (5) the rendering, by regex over the source and weaker than a render test on purpose. Two
      // things must hold: the words are the ones the data supports, and the row offers NO ack — the
      // owner is not the principal who could have read the pane, and the server refuses him (above).
      // COMMENT LINES ARE STRIPPED FIRST: these are checks about the words the OWNER reads. A
      // comment is free to name the phrasing it forbids — the row's own does — and a probe that
      // counted those mentions would fail on its own documentation.
      const unackedRow = cliSrc.slice(cliSrc.indexOf("function opsUnackedRow"),
        cliSrc.indexOf("function renderOpsDlg"))
        .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
      check("client: the unacknowledged-pane row says transport reported sent, no session acknowledgement",
        /transport reported sent; no session acknowledgement/.test(unackedRow)
          && /transport outcome uncertain; no session acknowledgement/.test(unackedRow),
        unackedRow.slice(0, 80));
      check("client: it never calls the send undelivered or failed, and every 'accept' is about tmux only",
        !/undelivered|failed/i.test(unackedRow)
          && [...unackedRow.matchAll(/accept\w*/gi)]
            .every((m) => /tmux/.test(unackedRow.slice(Math.max(0, (m.index ?? 0) - 40), m.index))),
        unackedRow.slice(0, 200));
      // THE ONE FALSE STATEMENT THIS ROW COULD MAKE. `send-uncertain` is persisted BEFORE tmux is
      // touched, so "tmux took the keystrokes" is unknowable on it — and that phrase sat in a SHARED
      // detail line until review caught it. Both lines must branch, the phrase may exist exactly
      // once, and it must live in the ELSE arm (the uncertain arm of `cond ? a : b` comes first).
      const took = (unackedRow.match(/tmux took the keystrokes/g) ?? []).length;
      const uncertainArmAt = unackedRow.indexOf("before Fleet could prove whether tmux accepted anything");
      check("client: BOTH lines branch on status — a send-uncertain row never claims tmux took the keystrokes",
        (unackedRow.match(/\buncertain\s*\?/g) ?? []).length === 2 && took === 1
          // a NEGATED condition would keep both counts and swap what each state is told, so the
          // positive form is part of the rule rather than a coincidence of how it is written
          && !/!\s*uncertain/.test(unackedRow)
          && uncertainArmAt > 0 && unackedRow.indexOf("tmux took the keystrokes") > uncertainArmAt
          && /may or may not be in the pane/.test(unackedRow) && /Nothing here retries it/.test(unackedRow),
        `branches=${(unackedRow.match(/\buncertain\s*\?/g) ?? []).length} took=${took} uncertainArmAt=${uncertainArmAt}`);
      check("client: the row carries no acknowledge affordance and posts nothing at all",
        !/\/ack\b/.test(unackedRow) && !/\bpost\(/.test(unackedRow) && !/onclick/.test(unackedRow),
        unackedRow.slice(0, 200));
      const btn = cliSrc.slice(cliSrc.indexOf("function renderOpsBtn"), cliSrc.indexOf("function setOpsEvents"));
      check("client: the badge prints the two counts side by side and never adds them",
        /opsUnacked\(opsRows, Date\.now\(\)\)\.length/.test(btn) && !/n \+ m|m \+ n/.test(btn),
        btn.slice(0, 200));
    }
  }

  // === MAIN-SESSION EXIT: tickMigrate ==========================================================
  // The isolated wrapper explicitly arms the otherwise-default-off tick at 44%. FLEET_CMD=true
  // pins no session id, so this fixture plants identities exactly as the restart/context tests do;
  // that is what makes three above-threshold controls distinguishable from ctx:null.
  {
    const openPlain = async (label?: string): Promise<number> => {
      const id = await freeSlot();
      if (!id) return 0;
      const r = await post(`/api/slots/${id}/open`, { cwd: REPO, ...(label ? { label } : {}) });
      return r.ok ? id : 0;
    };
    const mainId = await openPlain("migrate-main");
    const lane = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
    const stewardId = await openPlain("⚙ steward");
    const unknownId = await openPlain("migrate-unknown");
    check("migration tick setup: main, lane, steward and ctx-unknown controls are all active",
      mainId > 0 && lane.slot > 0 && stewardId > 0 && unknownId > 0,
      JSON.stringify({ mainId, lane: lane.slot, stewardId, unknownId }));

    // Stop before editing fleet.json: a live saveState chain is allowed to replace the file, so an
    // edit made while srv runs would be a probe racing its subject. restartSrv starts it again with
    // the same FLEET_* env after the identities and usage files are in place.
    await tmuxOut("kill-session", "-t", "srv");
    await Bun.sleep(500);
    const statePath = `${ROOT}/fleet.json`;
    let state: { slots?: Record<string, { cwd?: string; sessionId?: string; model?: string }> } | null = null;
    let stateError = "";
    try { state = JSON.parse(readFileSync(statePath, "utf8")) as
      { slots?: Record<string, { cwd?: string; sessionId?: string; model?: string }> }; }
    catch (e) { stateError = e instanceof Error ? e.message : String(e); }
    check("migration tick setup precondition: fleet state is readable before context mutation",
      state !== null, stateError);
    const ids = new Map<number, string>([
      [mainId, "e2e0feed-0000-4000-8000-000000000101"],
      [lane.slot, "e2e0feed-0000-4000-8000-000000000102"],
      [stewardId, "e2e0feed-0000-4000-8000-000000000103"],
    ]);
    for (const [id, sid] of ids) if (state?.slots?.[String(id)]) state.slots[String(id)]!.sessionId = sid;
    if (state) writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });

    const usageFiles: string[] = [];
    if (state) for (const [id, sid] of ids) {
      const cwd = state.slots?.[String(id)]?.cwd ?? "";
      const dir = `${process.env.HOME}/.claude/projects/${cwd.replace(/[^a-zA-Z0-9]/g, "-")}`;
      mkdirSync(dir, { recursive: true });
      const file = `${dir}/${sid}.jsonl`;
      writeFileSync(file, `${JSON.stringify({ message: { usage: {
        input_tokens: 100_000, cache_creation_input_tokens: 100_000,
        cache_read_input_tokens: 300_000, output_tokens: 9_000_000,
      } } })}\n`);
      usageFiles.push(file);
    }
    await restartSrv();

    type CtxRow = { id: number; ctx: { pct: number; windowTokens: number } | null };
    const ctxRows = ((await (await get("/api/sessions")).json()) as { slots: CtxRow[] }).slots;
    const ctxOf = (id: number) => ctxRows.find((x) => x.id === id)?.ctx;
    check("migration tick setup: main/lane/steward are measurably above 44%, while the unpinned control is ctx:null",
      ctxOf(mainId)?.pct === 50 && ctxOf(lane.slot)?.pct === 50 && ctxOf(stewardId)?.pct === 50
        && ctxOf(unknownId) === null,
      JSON.stringify({ main: ctxOf(mainId), lane: ctxOf(lane.slot), steward: ctxOf(stewardId), unknown: ctxOf(unknownId) }));

    const migratePrompts = async (slot: number) => (await plogRead())
      .filter((e) => e.slot === slot && e.text.startsWith("[fleet] Dein Kontext ist bei "));
    let nudges = await migratePrompts(mainId);
    for (let i = 0; i < 80 && nudges.length === 0; i++) {
      await Bun.sleep(100);
      nudges = await migratePrompts(mainId);
    }
    check("tickMigrate sends exactly one prompt to an above-threshold NON-LANE main session",
      nudges.length === 1, `${nudges.length} prompt(s)`);
    const nudge = nudges[0]?.text ?? "";
    check("the migration prompt names measured pct+window, says server predicate, then HANDOFF commit before self/succeed",
      nudge.includes("50%") && nudge.includes("1000000 Tokens im Fenster")
        && nudge.includes("Server-Prädikat, keine Meldung von dir")
        && nudge.indexOf("HANDOFF.md schreiben UND committen") < nudge.indexOf("POST /api/self/succeed")
        && nudge.includes("x-fleet-self-token aus $FLEET_SELF_TOKEN"), nudge);
    check("tickMigrate never nudges a lane, the ⚙ steward, or a ctx:null slot",
      (await migratePrompts(lane.slot)).length === 0
        && (await migratePrompts(stewardId)).length === 0
        && (await migratePrompts(unknownId)).length === 0,
      JSON.stringify({ lane: (await migratePrompts(lane.slot)).length,
        steward: (await migratePrompts(stewardId)).length, unknown: (await migratePrompts(unknownId)).length }));

    const tickMs = Number(process.env.FLEET_MIGRATE_TICK_MS ?? 60_000) | 0;
    await Bun.sleep(tickMs * 4 + 500);
    check("a second migration tick inside MIGRATE_COOLDOWN_MS sends no second prompt",
      (await migratePrompts(mainId)).length === 1, `${(await migratePrompts(mainId)).length} prompt(s)`);

    // Restart resets the process-local marker. With the threshold still armed this same 50% slot
    // would be nudged again; overriding it to zero proves the stronger default-off contract: no
    // timer is registered, rather than a timer that merely decides not to send.
    await restartSrv({ FLEET_MIGRATE_PCT: "0" });
    await Bun.sleep(tickMs * 4 + 500);
    check("FLEET_MIGRATE_PCT=0 registers no migration tick — an eligible fresh process sends nothing",
      (await migratePrompts(mainId)).length === 1, `${(await migratePrompts(mainId)).length} total prompt(s)`);

    for (const id of [mainId, lane.slot, stewardId, unknownId]) if (id) await post(`/api/slots/${id}/kill`, {});
    for (const file of usageFiles) rmSync(file, { force: true });
  }
}
