// THE OWNER-FACING EDGE (server.ts, ATTENTION-CHANNEL-V1): a bound Program-MAIN raises a decision,
// a block, or something review-ready FOR THE OWNER, durably, and gets back exactly one bound
// answer. It is the mirror of the clarification channel one section up — worker→MAIN there,
// MAIN→owner here — and the checks below are deliberately its twin, because the two share the one
// property worth proving: an answer is only "delivered" once tmux accepted it, and the state that
// says "this text may already be in the pane" survives the crash window either way.
//
// Every state assertion reads the instance's fleet.json. /api/sessions carries the open COUNT and
// nothing else about this channel, so casting a row field onto that payload would be the exact
// mistake two earlier probes died of (8e2b3e5).
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { BASE, REPO, ROOT, check, get, paneEnv, plantScreen, plogRead, post, restartSrv, tmuxOut } from "./harness";

interface AttentionRow {
  id: string; raisedAt: number; kind: "decision" | "blocked" | "review-ready"; text: string;
  requester: { slot: number; openedAt: number; sessionId: string | null };
  programId: string; programTitle?: string | null;
  provenance?: { taskId: string | null; originId: string | null; programId: string | null;
    branch: string | null; candidateSha: string | null };
  status: "open" | "send-uncertain" | "answered" | "refused";
  answer: { text: string; at: number; by: "owner" } | null;
  refusedReason: string | null; closedAt: number | null;
}
interface InboxEntry {
  id: string; kind: "attention-answer" | "fleet-report" | "audit-red"; at: number; ref: string;
  readBy: { slot: number; openedAt: number; sessionId: string | null } | null; readAt: number | null;
  subject: AttentionRow | null;
}
interface InboxView {
  program: string; unread: number; dropped: number; entries: InboxEntry[]; unknown: string[];
}
const statePath = `${ROOT}/fleet.json`;
const readRows = (): AttentionRow[] =>
  (JSON.parse(readFileSync(statePath, "utf8")) as { attentionRequests?: AttentionRow[] })
    .attentionRequests ?? [];
const readRow = (id: string | undefined): AttentionRow | undefined =>
  readRows().find((a) => a.id === id);
const selfRaise = (tok: string | null, body: unknown): Promise<Response> =>
  fetch(`${BASE}/api/self/attention`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(tok === null ? {} : { "x-fleet-self-token": tok }) },
    body: JSON.stringify(body),
  });
const selfAttention = async (tok: string): Promise<AttentionRow[]> => {
  const res = await fetch(`${BASE}/api/self/attention`, { headers: { "x-fleet-self-token": tok } });
  return ((await res.json()) as { requests?: AttentionRow[] }).requests ?? [];
};
const raised = async (r: Response): Promise<AttentionRow | undefined> =>
  ((await r.json()) as { request?: AttentionRow }).request;
const ownerRows = async (): Promise<AttentionRow[]> =>
  ((await (await get("/api/attention")).json()) as { requests?: AttentionRow[] }).requests ?? [];
const attentionOpenCount = async (): Promise<number | undefined> =>
  ((await (await get("/api/sessions")).json()) as { attentionOpen?: number }).attentionOpen;
const sessions = async (): Promise<{ slots: { id: number; cwd: string | null; label: string | null }[] }> =>
  (await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null; label: string | null }[] };
const selfInbox = async (tok: string): Promise<{ response: Response; view: InboxView | null }> => {
  const response = await fetch(`${BASE}/api/self/inbox`, { headers: { "x-fleet-self-token": tok } });
  return { response, view: response.ok ? await response.json() as InboxView : null };
};
const selfSucceed = (tok: string, body: unknown): Promise<Response> => fetch(`${BASE}/api/self/succeed`, {
  method: "POST", headers: { "content-type": "application/json", "x-fleet-self-token": tok },
  body: JSON.stringify(body),
});
const waitForLabel = async (label: string): Promise<number | null> => {
  let seen: number | undefined;
  for (let i = 0; i < 60; i++) {
    const slot = (await sessions()).slots.find((s) => s.cwd && s.label === label)?.id;
    if (slot) {
      seen = slot;
      if ((await tmuxOut("has-session", "-t", `s${slot}`)).code === 0) return slot;
    }
    await Bun.sleep(50);
  }
  check(`attention succession fixture: a slot labelled ${label} came up with a live pane`, false,
    seen === undefined ? "no slot ever carried the label" : `slot ${seen} never grew a pane`);
  return null;
};
const freeSlot = async (): Promise<number> =>
  ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
    .slots.find((x) => x.cwd === null)?.id ?? 0;

export async function run(): Promise<void> {
  // === ATTENTION-CHANNEL-V1 ====================================================================
  // The production default is intentionally on; this isolated process carries the explicit opt-out
  // through every later restart except the one block that measures the timer itself.
  process.env.FLEET_INBOX_NUDGE_MS = "0";
  const mainA = await freeSlot();
  const openA = mainA ? await post(`/api/slots/${mainA}/open`, { cwd: REPO, label: "attention-main" }) : null;
  const mainB = await freeSlot();
  const openB = mainB ? await post(`/api/slots/${mainB}/open`, { cwd: REPO, label: "attention-unbound" }) : null;
  const mainC = await freeSlot();
  const openC = mainC ? await post(`/api/slots/${mainC}/open`, { cwd: REPO, label: "attention-capped" }) : null;
  const lane = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number };
  // FIXTURE PRECONDITION, its own check: everything below reads "the route refused me" as evidence,
  // and a probe that never had four distinct live participants would produce that evidence for free.
  check("attention fixtures: three distinct MAIN occupants and one lane exist",
    !!openA?.ok && !!openB?.ok && !!openC?.ok && !!lane.slot
      && new Set([mainA, mainB, mainC, lane.slot]).size === 4,
    JSON.stringify({ mainA, mainB, mainC, lane: lane.slot }));

  const tokA = await paneEnv(`s${mainA}`, "FLEET_SELF_TOKEN") ?? "";
  const tokB = await paneEnv(`s${mainB}`, "FLEET_SELF_TOKEN") ?? "";
  const tokC = await paneEnv(`s${mainC}`, "FLEET_SELF_TOKEN") ?? "";
  const laneTok = await paneEnv(`s${lane.slot}`, "FLEET_SELF_TOKEN") ?? "";
  check("attention fixtures: every participant has an exact, distinct scoped credential",
    [tokA, tokB, tokC, laneTok].every((t) => /^[0-9a-f]{32}$/.test(t))
      && new Set([tokA, tokB, tokC, laneTok]).size === 4);

  // The binding is a SERVER fact, so it is planted as one: two active programs, each bound to the
  // exact occupant triple of its own MAIN. Nothing the routes below send can nominate a program.
  await tmuxOut("kill-session", "-t", "srv");
  await Bun.sleep(500);
  const planted = JSON.parse(readFileSync(statePath, "utf8")) as {
    slots: Record<string, Record<string, unknown>>; programs?: Record<string, unknown>[];
    attentionRequests?: unknown[];
  };
  const programA = "a".repeat(24);
  const programC = "e".repeat(24);
  delete planted.attentionRequests; // legacy-state counterprobe: the field did not exist before v1
  const rowA = planted.slots[String(mainA)];
  const rowC = planted.slots[String(mainC)];
  planted.programs = [...(planted.programs ?? []),
    {
      id: programA, title: "Attention fixture A", intent: "Raise owner-only items",
      successCriterion: "The owner answers once", nonGoals: [], decisions: [], evidence: [], openQuestions: [],
      status: "active", createdAt: Date.now() - 1000, proposedBy: { kind: "owner" },
      confirmedAt: Date.now() - 900, activatedAt: Date.now() - 800,
      main: { slot: mainA, openedAt: rowA.openedAt, sessionId: rowA.sessionId, boundAt: Date.now() - 700 },
    },
    {
      id: programC, title: "Attention fixture C", intent: "Exercise the open cap",
      successCriterion: "The cap refuses the sixth", nonGoals: [], decisions: [], evidence: [], openQuestions: [],
      status: "active", createdAt: Date.now() - 1000, proposedBy: { kind: "owner" },
      confirmedAt: Date.now() - 900, activatedAt: Date.now() - 800,
      main: { slot: mainC, openedAt: rowC.openedAt, sessionId: rowC.sessionId, boundAt: Date.now() - 700 },
    }];
  writeFileSync(statePath, JSON.stringify(planted, null, 2), { mode: 0o600 });
  await restartSrv();
  // BREAKS IF: the loader requires the member instead of defaulting it — every pre-v1 state file
  // would then fail to load the array at all.
  check("attention legacy state: an absent attentionRequests member loads as []",
    Array.isArray(readRows()) && readRows().length === 0,
    JSON.stringify(readRows()));

  // --- 1. who may raise, and what the server derives rather than believes -----------------------
  // BREAKS IF: the route stops deriving programId from the binding and reads it from the body, or
  // the kind union is widened, or the non-lane/binding gates are dropped.
  const candidateSha = "b".repeat(40);
  const decision = await raised(await selfRaise(tokA, {
    kind: "decision", text: "Ship cut 2 now or after the audit?", programId: "spoofed",
    taskId: "task-declared-by-main", originId: "origin-declared-by-main",
    branch: "fleet/result-rail", candidateSha,
  }));
  const blocked = await raised(await selfRaise(tokA, { kind: "blocked", text: "The land gate needs an owner token I do not hold." }));
  const reviewReady = await raised(await selfRaise(tokA, { kind: "review-ready", text: "The inbox slice is ready for your eyes." }));
  check("attention: a bound MAIN raises all three kinds and programId is server-derived, never body-supplied",
    decision?.kind === "decision" && blocked?.kind === "blocked" && reviewReady?.kind === "review-ready"
      && [decision, blocked, reviewReady].every((a) => a?.programId === programA && a.status === "open"
        && a.answer === null && a.closedAt === null)
      && readRows().length === 3,
    JSON.stringify({ decision, rows: readRows().length }));
  check("attention object provenance: task, branch and candidate are fields while programId stays server-derived",
    decision?.provenance?.taskId === "task-declared-by-main"
      && decision.provenance.originId === "origin-declared-by-main"
      && decision.provenance.branch === "fleet/result-rail"
      && decision.provenance.candidateSha === candidateSha
      && decision.provenance.programId === programA
      && decision.programId === programA && !JSON.stringify(decision).includes("spoofed"),
    JSON.stringify(decision?.provenance));

  const laneRaise = await selfRaise(laneTok, { kind: "decision", text: "may a lane ask the owner?" });
  const laneRaiseText = await laneRaise.text();
  const unbound = await selfRaise(tokB, { kind: "decision", text: "unbound session asks" });
  const unboundText = await unbound.text();
  const noCred = await selfRaise(null, { kind: "decision", text: "no credential" });
  const ownerCred = await fetch(`${BASE}/api/self/attention`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "decision", text: "owner is not a self principal here" }),
  });
  check("attention scope: a lane is 409, an unbound non-lane is 409 by name, missing credentials are 401",
    laneRaise.status === 409 && laneRaiseText.includes("a lane may not raise attention")
      && unbound.status === 409 && unboundText.includes("bound MAIN of an active program")
      && noCred.status === 401 && ownerCred.status === 401 && readRows().length === 3,
    `${laneRaise.status} ${unbound.status} ${noCred.status} ${ownerCred.status}`);

  const badKind = await selfRaise(tokA, { kind: "question", text: "not a kind" });
  const emptyText = await selfRaise(tokA, { kind: "decision", text: "   " });
  const hugeText = await selfRaise(tokA, { kind: "decision", text: "x".repeat(2001) });
  const nonString = await selfRaise(tokA, { kind: "decision", text: 17 });
  const badBranch = await selfRaise(tokA, { kind: "decision", text: "bad branch", branch: "bad..branch" });
  const badSha = await selfRaise(tokA, { kind: "decision", text: "bad sha", candidateSha: "not-a-sha" });
  const longTask = await selfRaise(tokA, { kind: "decision", text: "long task", taskId: "t".repeat(201) });
  check("attention validation: text, branch, candidate SHA and provenance lengths all fail closed 400",
    [badKind, emptyText, hugeText, nonString, badBranch, badSha, longTask]
      .every((r) => r.status === 400) && readRows().length === 3,
    [badKind, emptyText, hugeText, nonString, badBranch, badSha, longTask]
      .map((r) => r.status).join(","));

  // --- 2. dedupe and the open cap ---------------------------------------------------------------
  // BREAKS IF: dedupe keys on binding+kind alone (the second decision below would vanish), or on
  // the text alone across kinds, or the cap counts terminal rows / is removed.
  const twin = await selfRaise(tokA, { kind: "decision", text: "Ship cut 2 now or after the audit?" });
  const twinBody = await twin.json() as { existing?: boolean; request?: AttentionRow };
  const secondDecision = await raised(await selfRaise(tokA, { kind: "decision", text: "A different decision entirely." }));
  check("attention dedupe: identical kind+text returns the same row as existing; different text mints a second",
    twin.ok && twinBody.existing === true && twinBody.request?.id === decision?.id
      && !!secondDecision && secondDecision.id !== decision?.id
      && readRows().filter((a) => a.requester.slot === mainA).length === 4,
    JSON.stringify({ existing: twinBody.existing, rows: readRows().length }));

  const capped: (AttentionRow | undefined)[] = [];
  for (let i = 0; i < 5; i++)
    capped.push(await raised(await selfRaise(tokC, { kind: "blocked", text: `capped item ${i}` })));
  const overCap = await selfRaise(tokC, { kind: "blocked", text: "one too many" });
  const overCapText = await overCap.text();
  check("attention open cap: five open rows per requester are accepted and the sixth is a named 409",
    capped.every((a) => a?.status === "open") && new Set(capped.map((a) => a?.id)).size === 5
      && overCap.status === 409 && overCapText.includes("not a queue")
      && readRows().filter((a) => a.requester.slot === mainC).length === 5,
    `${overCap.status} ${overCapText}`);

  // --- 3. role-scoped reads, and the owner's list -----------------------------------------------
  const seenByA = await selfAttention(tokA);
  const seenByB = await selfAttention(tokB);
  const seenByC = await selfAttention(tokC);
  check("attention GET is role-scoped: each MAIN sees exactly its own requester rows, an unbound session none",
    seenByA.length === 4 && seenByA.every((a) => a.requester.slot === mainA)
      && seenByB.length === 0 && seenByC.length === 5,
    JSON.stringify({ a: seenByA.length, b: seenByB.length, c: seenByC.length }));

  const owner = await ownerRows();
  check("owner GET /api/attention lists every row, open first, with the program title joined at read time",
    owner.length === 9 && owner.every((a) => a.status === "open")
      && owner.find((a) => a.id === decision?.id)?.programTitle === "Attention fixture A"
      && owner.find((a) => a.id === capped[0]?.id)?.programTitle === "Attention fixture C"
      && owner[0].raisedAt >= owner[owner.length - 1].raisedAt,
    JSON.stringify(owner.map((a) => [a.status, a.programTitle])));

  // BREAKS IF: attentionOpen counts terminal rows, or ships row bodies on the 2s poll.
  const openBefore = await attentionOpenCount();
  const pollRaw = await (await get("/api/sessions")).text();
  check("/api/sessions carries attentionOpen and it counts exactly the open + send-uncertain rows",
    openBefore === 9 && openBefore === readRows().filter((a) => a.status === "open").length
      && !pollRaw.includes(decision?.text ?? " ") && !pollRaw.includes("requester"),
    `${openBefore} ${pollRaw.length} B`);

  // --- 4. the owner answer becomes a Program pointer, never a pane paste -------------------------
  // BREAKS IF: sendText remains, the entry is missing, or one answer appends two pointers.
  const answerText = "Land it after the audit — I will hold the deploy.";
  const paneBeforeAnswer = (await tmuxOut("capture-pane", "-J", "-t", `s${mainA}`, "-p")).out;
  const answered = await post(`/api/attention/${decision?.id}/answer`, { text: answerText });
  const answeredBody = await answered.json() as { request?: AttentionRow; inbox?: string };
  const paneAfterAnswer = (await tmuxOut("capture-pane", "-J", "-t", `s${mainA}`, "-p")).out;
  const inboxAfterAnswer = await selfInbox(tokA);
  const answerEntries = inboxAfterAnswer.view?.entries.filter((e) => e.kind === "attention-answer"
    && e.ref === decision?.id) ?? [];
  check("attention answer: the owner's answer becomes exactly one program inbox entry, the row is answered, and the requester pane receives no paste",
    answered.ok && answeredBody.request?.status === "answered"
      && answeredBody.request.answer?.by === "owner" && answeredBody.request.closedAt !== null
      && inboxAfterAnswer.response.ok && answerEntries.length === 1
      && answerEntries[0]?.id === answeredBody.inbox && answerEntries[0]?.subject?.answer?.text === answerText
      && paneAfterAnswer === paneBeforeAnswer
      && !(await plogRead()).some((p) => p.slot === mainA && p.text.includes(answerText))
      && readRow(decision?.id)?.status === "answered"
      && readRow(decision?.id)?.answer?.text === answerText,
    `${answered.status} ${JSON.stringify(answeredBody)} entries=${answerEntries.length} pane=${paneAfterAnswer === paneBeforeAnswer}`);

  const sameAnswer = await post(`/api/attention/${decision?.id}/answer`, { text: answerText });
  const sameAnswerBody = await sameAnswer.json() as { existing?: boolean };
  const otherAnswer = await post(`/api/attention/${decision?.id}/answer`, { text: "no, ship it now" });
  const inboxAfterRetry = await selfInbox(tokA);
  // BREAKS IF: the existing:true path calls appendProgramInbox again.
  check("attention answer idempotency: identical text is existing:true and mints no second entry; different text is 409",
    sameAnswer.ok && sameAnswerBody.existing === true && otherAnswer.status === 409
      && readRow(decision?.id)?.answer?.text === answerText
      && inboxAfterRetry.view?.entries.filter((e) => e.ref === decision?.id).length === 1,
    `${sameAnswer.status} ${otherAnswer.status}`);

  // --- 5. refusal is the RECEIPT, and terminal is terminal ---------------------------------------
  // BREAKS IF: refuse stops requiring a reason (silent closure returns), or a terminal row can be
  // answered/refused again.
  const noReason = await post(`/api/attention/${blocked?.id}/refuse`, { reason: "  " });
  const refused = await post(`/api/attention/${blocked?.id}/refuse`, { reason: "I will unblock it myself in the shell." });
  const refuseAgain = await post(`/api/attention/${blocked?.id}/refuse`, { reason: "twice" });
  const answerRefused = await post(`/api/attention/${blocked?.id}/answer`, { text: "too late" });
  const refuseAnswered = await post(`/api/attention/${decision?.id}/refuse`, { reason: "too late" });
  check("attention refusal records a mandatory reason and both terminal states reject further owner action",
    noReason.status === 400 && refused.ok
      && readRow(blocked?.id)?.status === "refused"
      && readRow(blocked?.id)?.refusedReason === "I will unblock it myself in the shell."
      && readRow(blocked?.id)?.closedAt !== null && readRow(blocked?.id)?.answer === null
      && refuseAgain.status === 409 && answerRefused.status === 409 && refuseAnswered.status === 409,
    `${noReason.status} ${refused.status} ${refuseAgain.status} ${answerRefused.status} ${refuseAnswered.status}`);

  // --- 6. historical send-uncertain rows keep their one safe retry ------------------------------
  await tmuxOut("kill-session", "-t", "srv");
  await Bun.sleep(500);
  const legacyPending = JSON.parse(readFileSync(statePath, "utf8")) as { attentionRequests?: AttentionRow[] };
  const legacyPendingRow = legacyPending.attentionRequests?.find((a) => a.id === reviewReady?.id);
  if (legacyPendingRow) {
    legacyPendingRow.status = "send-uncertain";
    legacyPendingRow.answer = { text: "answer from the old transport", at: Date.now(), by: "owner" };
    legacyPendingRow.closedAt = null;
  }
  writeFileSync(statePath, JSON.stringify(legacyPending, null, 2), { mode: 0o600 });
  await restartSrv();
  const differentRetry = await post(`/api/attention/${reviewReady?.id}/answer`, { text: "a different answer entirely" });
  const differentRetryText = await differentRetry.text();
  const legacyRetry = await post(`/api/attention/${reviewReady?.id}/answer`, { text: "answer from the old transport" });
  const legacyRetryBody = await legacyRetry.json() as { request?: AttentionRow; inbox?: string };
  const legacyInbox = await selfInbox(tokA);
  // BREAKS IF: the legacy send-uncertain arm is removed or identical text no longer reaches appendProgramInbox.
  check("attention answer legacy send-uncertain row: identical text lands in the inbox, different text stays 409",
    differentRetry.status === 409 && differentRetryText.includes("different pending text")
      && legacyRetry.ok && legacyRetryBody.request?.status === "answered"
      && legacyInbox.view?.entries.filter((e) => e.ref === reviewReady?.id).length === 1
      && legacyInbox.view?.entries.find((e) => e.ref === reviewReady?.id)?.id === legacyRetryBody.inbox,
    `${differentRetry.status} ${legacyRetry.status} ${JSON.stringify(legacyRetryBody)}`);

  // --- 7. a Program question and its answer cross a real MAIN succession -------------------------
  const successorLabel = "attention-program-successor";
  const successionPending = selfSucceed(tokA, { label: successorLabel, carry: "Continue the attention fixture." });
  const successorSlot = await waitForLabel(successorLabel);
  if (successorSlot !== null)
    await plantScreen(successorSlot, ">_ OpenAI Codex (v0.147.0)", "attention succession fixture");
  const successionResponse = await successionPending;
  const successionResponseText = await successionResponse.clone().text();
  let predecessorGone = false;
  for (let i = 0; i < 40 && !predecessorGone; i++) {
    predecessorGone = !(await sessions()).slots.some((s) => s.id === mainA && s.cwd);
    if (!predecessorGone) await Bun.sleep(100);
  }
  const successorToken = successorSlot === null ? "" :
    (JSON.parse(readFileSync(statePath, "utf8")) as { slots?: Record<string, { selfToken?: string }> })
      .slots?.[String(successorSlot)]?.selfToken ?? "";
  const successorRows = successorToken ? await selfAttention(successorToken) : [];
  const survived = readRow(secondDecision?.id);
  const successionAnswer = await post(`/api/attention/${secondDecision?.id}/answer`, { text: "The successor can read this answer." });
  const successionInbox = successorToken ? await selfInbox(successorToken) : null;
  // BREAKS IF: reconcileAttention ignores why, or attentionFor filters only by requester triple.
  check("attention survives succession: after POST /api/self/succeed the open row is still open, the successor lists it, and the owner's answer reaches the successor's inbox",
    successionResponse.ok && predecessorGone && successorSlot !== null && successorSlot !== mainA
      && survived?.status === "open" && successorRows.some((a) => a.id === secondDecision?.id)
      && successionAnswer.ok
      && successionInbox?.view?.entries.some((e) => e.ref === secondDecision?.id
        && e.kind === "attention-answer" && e.subject?.answer?.text === "The successor can read this answer.") === true,
    JSON.stringify({ succession: successionResponse.status, predecessorGone, successorSlot,
      survived: survived?.status, listed: successorRows.some((a) => a.id === secondDecision?.id),
      response: successionResponseText }));

  // --- 8. one-line idle nudge, process-local dedupe, explicit opt-out -----------------------------
  const inboxLineCount = (text: string): number => text.split("\n").filter((line) => line.includes("[fleet inbox]")).length;
  const inboxStandInDir = mkdtempSync(`${tmpdir()}/fleet-inbox-standin-`);
  const inboxStandIn = `${inboxStandInDir}/codex`;
  const cat = Bun.which("cat");
  if (cat) symlinkSync(cat, inboxStandIn);
  const echoScreen = successorSlot === null || !cat ? { code: 1, out: "stand-in unavailable" }
    : await tmuxOut("respawn-pane", "-k", "-t", `s${successorSlot}`,
      `printf '%s\\n' '>_ OpenAI Codex (v0.147.0)'; stty -echo; exec '${inboxStandIn}'`);
  let echoScreenReady = false;
  for (let i = 0; i < 40 && !echoScreenReady; i++) {
    const captured = successorSlot === null ? { code: 1, out: "" }
      : await tmuxOut("capture-pane", "-J", "-t", `s${successorSlot}`, "-p");
    echoScreenReady = captured.code === 0 && captured.out.includes(">_ OpenAI Codex (v0.147.0)");
    if (!echoScreenReady) await Bun.sleep(50);
  }
  const lineReaderProbe = "inbox-nudge-line-reader-ready";
  if (successorSlot !== null && echoScreenReady) {
    await tmuxOut("send-keys", "-t", `s${successorSlot}`, "-l", "--", lineReaderProbe);
    await tmuxOut("send-keys", "-t", `s${successorSlot}`, "Enter");
  }
  let lineReaderReady = false;
  for (let i = 0; i < 40 && !lineReaderReady; i++) {
    const captured = successorSlot === null ? { code: 1, out: "" }
      : await tmuxOut("capture-pane", "-J", "-t", `s${successorSlot}`, "-p");
    lineReaderReady = captured.code === 0 && captured.out.includes(lineReaderProbe);
    if (!lineReaderReady) await Bun.sleep(50);
  }
  // BREAKS IF: the pane stand-in cannot both satisfy the codex liveness probe and render one accepted input line.
  check("inbox nudge fixture: the bound MAIN pane has a live codex-named line reader",
    echoScreen.code === 0 && echoScreenReady && lineReaderReady,
    `${echoScreen.code} marker=${echoScreenReady} reader=${lineReaderReady} ${echoScreen.out}`);
  const nudgeBefore = successorSlot === null ? "" :
    (await tmuxOut("capture-pane", "-J", "-t", `s${successorSlot}`, "-p")).out;
  await restartSrv({ FLEET_INBOX_NUDGE_MS: "100", FLEET_BACKLOG_NUDGE_IDLE_MS: "0" });
  let nudgeAfter = nudgeBefore;
  for (let i = 0; i < 40 && inboxLineCount(nudgeAfter) === inboxLineCount(nudgeBefore); i++) {
    await Bun.sleep(100);
    if (successorSlot !== null)
      nudgeAfter = (await tmuxOut("capture-pane", "-J", "-t", `s${successorSlot}`, "-p")).out;
  }
  await Bun.sleep(400);
  const nudgeStable = successorSlot === null ? "" :
    (await tmuxOut("capture-pane", "-J", "-t", `s${successorSlot}`, "-p")).out;
  const nudgedPrompts = (await plogRead()).filter((p) => p.slot === successorSlot && p.text.startsWith("[fleet inbox]"));
  await restartSrv({ FLEET_INBOX_NUDGE_MS: "0", FLEET_BACKLOG_NUDGE_IDLE_MS: "0" });
  const noNudgeRow = await raised(await selfRaise(successorToken, { kind: "decision", text: "No nudge while disabled." }));
  const noNudgeAnswer = await post(`/api/attention/${noNudgeRow?.id}/answer`, { text: "Recorded without a timer." });
  await Bun.sleep(400);
  const nudgeDisabled = successorSlot === null ? "" :
    (await tmuxOut("capture-pane", "-J", "-t", `s${successorSlot}`, "-p")).out;
  // BREAKS IF: a tick does not retain the unread-set key, emits a multiline payload, or registers when the interval is zero.
  check("inbox nudge: one line per unread set reaches the bound MAIN pane, a second tick repeats nothing, and the zero interval emits nothing",
    inboxLineCount(nudgeAfter) === inboxLineCount(nudgeBefore) + 1
      && inboxLineCount(nudgeStable) === inboxLineCount(nudgeAfter)
      && inboxLineCount(nudgeDisabled) === inboxLineCount(nudgeStable)
      && nudgedPrompts.length === 1 && !nudgedPrompts[0]?.text.includes("\n") && noNudgeAnswer.ok,
    JSON.stringify({ before: inboxLineCount(nudgeBefore), after: inboxLineCount(nudgeAfter),
      stable: inboxLineCount(nudgeStable), disabled: inboxLineCount(nudgeDisabled), prompts: nudgedPrompts.length }));
  rmSync(inboxStandInDir, { recursive: true, force: true });

  // --- 9. the writer cap drops the oldest read pointer before any unread pointer ------------------
  const capRow = await raised(await selfRaise(successorToken, { kind: "decision", text: "Append the 101st inbox pointer." }));
  await tmuxOut("kill-session", "-t", "srv");
  await Bun.sleep(500);
  const capState = JSON.parse(readFileSync(statePath, "utf8")) as {
    programs?: { id: string; inbox?: { v: 1; entries: Omit<InboxEntry, "subject">[]; dropped: number } }[];
    slots?: Record<string, { openedAt?: number; sessionId?: string | null }>;
  };
  const capProgram = capState.programs?.find((p) => p.id === programA);
  const capMain = successorSlot === null ? undefined : capState.slots?.[String(successorSlot)];
  const capOpenedAt = capMain?.openedAt;
  const readEntryId = (50).toString(16).padStart(24, "0");
  if (capProgram && successorSlot !== null && capOpenedAt) capProgram.inbox = {
    v: 1, dropped: 0, entries: Array.from({ length: 100 }, (_, i) => ({
      id: i.toString(16).padStart(24, "0"), kind: "audit-red" as const,
      at: Date.now() - 10_000 + i, ref: String(Date.now() - 10_000 + i),
      readBy: i === 50 ? { slot: successorSlot, openedAt: capOpenedAt, sessionId: capMain.sessionId ?? null } : null,
      readAt: i === 50 ? Date.now() - 5000 : null,
    })),
  };
  writeFileSync(statePath, JSON.stringify(capState, null, 2), { mode: 0o600 });
  await restartSrv();
  const capAnswer = await post(`/api/attention/${capRow?.id}/answer`, { text: "This is pointer 101." });
  const capAnswerText = await capAnswer.text();
  let capAnswerBody: { inbox?: string } = {};
  try { capAnswerBody = JSON.parse(capAnswerText) as { inbox?: string }; } catch { /* the check reports the route body */ }
  const cappedInbox = await selfInbox(successorToken);
  // BREAKS IF: appendProgramInbox slices the oldest row without preferring a read receipt.
  check("inbox append cap: the 101st entry drops the oldest READ entry first and dropped counts it",
    capAnswer.ok && cappedInbox.view?.entries.length === 100 && cappedInbox.view.dropped === 1
      && !cappedInbox.view.entries.some((e) => e.id === readEntryId)
      && cappedInbox.view.entries.some((e) => e.id === capAnswerBody.inbox && e.ref === capRow?.id)
      && cappedInbox.view.entries.filter((e) => e.readBy === null).length === 100,
    JSON.stringify({ status: capAnswer.status, length: cappedInbox.view?.entries.length,
      dropped: cappedInbox.view?.dropped, readEntry: cappedInbox.view?.entries.some((e) => e.id === readEntryId),
      body: capAnswerText }));

  // --- 10. completed Programs cannot receive another pointer -------------------------------------
  const inactiveRow = await raised(await selfRaise(successorToken, { kind: "blocked", text: "Complete before answering me." }));
  const inactiveBefore = await selfInbox(successorToken);
  const completeProgram = await post(`/api/programs/${programA}/complete`, {});
  const inactiveAnswer = await post(`/api/attention/${inactiveRow?.id}/answer`, { text: "Too late for this Program." });
  const inactiveText = await inactiveAnswer.text();
  const inactiveAfterState = JSON.parse(readFileSync(statePath, "utf8")) as {
    programs?: { id: string; inbox?: { entries: unknown[]; dropped: number } }[];
  };
  const inactiveAfter = inactiveAfterState.programs?.find((p) => p.id === programA)?.inbox;
  // BREAKS IF: answerAttention accepts any persisted Program regardless of active status.
  check("attention answer inactive program: 409 by name and nothing written",
    completeProgram.ok && inactiveAnswer.status === 409
      && inactiveText.includes("the Program of this attention is complete — no bound MAIN can read an answer to it")
      && inactiveAfter?.entries.length === inactiveBefore.view?.entries.length
      && inactiveAfter?.dropped === inactiveBefore.view?.dropped,
    `${completeProgram.status} ${inactiveAnswer.status} ${inactiveText}`);
  await post(`/api/attention/${inactiveRow?.id}/refuse`, { reason: "Program completed before the answer." });

  // --- 11. owner kill still refuses; a recycled slot does not inherit ----------------------------
  // BREAKS IF: survives does not require why === "handoff".
  const beforeKill = readRows().filter((a) => a.requester.slot === mainC && a.status === "open").length;
  await post(`/api/slots/${mainC}/kill`, {});
  const afterKill = readRows().filter((a) => a.requester.slot === mainC);
  const reopened = await post(`/api/slots/${mainC}/open`, { cwd: REPO, label: "attention-successor" });
  const successorTok = await paneEnv(`s${mainC}`, "FLEET_SELF_TOKEN") ?? "";
  const successorSees = await selfAttention(successorTok);
  const successorAnswer = await post(`/api/attention/${capped[0]?.id}/answer`, { text: "must not reach the successor" });
  const successorPane = (await tmuxOut("capture-pane", "-t", `s${mainC}`, "-p")).out;
  check("attention owner kill still refuses: a killed requester's open rows read requester session ended, and a recycled slot inherits nothing",
    beforeKill === 5 && afterKill.length === 5
      && afterKill.every((a) => a.status === "refused" && a.refusedReason === "requester session ended"
        && a.closedAt !== null && a.answer === null)
      && reopened.ok && successorSees.length === 0
      && successorAnswer.status === 409 && !successorPane.includes("must not reach the successor"),
    JSON.stringify({ beforeKill, statuses: afterKill.map((a) => a.status) }));

  for (const slot of [mainA, mainB, mainC, successorSlot, lane.slot])
    if (slot !== null) await post(`/api/slots/${slot}/kill`, {});

  // Pre-provenance rows are a distinct historical shape: absence means UNKNOWN and must stay
  // absent on both disk and the owner route. Normalizing it to a five-null object would invent an
  // observation about fields the old server never knew existed.
  await tmuxOut("kill-session", "-t", "srv");
  await Bun.sleep(500);
  const withLegacy = JSON.parse(readFileSync(statePath, "utf8")) as { attentionRequests?: AttentionRow[] };
  const legacyId = "d".repeat(24);
  withLegacy.attentionRequests = [...(withLegacy.attentionRequests ?? []), {
    id: legacyId, raisedAt: Date.now(), kind: "decision", text: "legacy row without object provenance",
    requester: { slot: mainA, openedAt: Number(rowA.openedAt),
      sessionId: typeof rowA.sessionId === "string" ? rowA.sessionId : null },
    programId: programA, status: "refused", answer: null,
    refusedReason: "legacy terminal fixture", closedAt: Date.now(),
  }];
  writeFileSync(statePath, JSON.stringify(withLegacy, null, 2), { mode: 0o600 });
  await restartSrv();
  const legacyDisk = readRow(legacyId);
  const legacyOwner = (await ownerRows()).find((a) => a.id === legacyId);
  check("attention legacy provenance: a row without the field survives as UNKNOWN, never five invented nulls",
    !!legacyDisk && !("provenance" in legacyDisk)
      && !!legacyOwner && !("provenance" in legacyOwner),
    JSON.stringify({ disk: legacyDisk, owner: legacyOwner }));

  // The zero case is ABSENT, not 0 — the field is omitted when nothing waits (server.ts: the 12 KiB
  // poll budget), and the client reads absent as zero. Asserted last, once every row above has
  // reached a terminal state, so this is the count going to zero rather than a fixture never made.
  // BREAKS IF: the field becomes unconditional again (the poll budget check in tasks.ts is the
  // other half of that), or terminal rows keep counting.
  check("attentionOpen is omitted entirely once no row wants the owner",
    (await attentionOpenCount()) === undefined
      && readRows().length > 0 && readRows().every((a) => a.status === "answered" || a.status === "refused"),
    JSON.stringify(readRows().map((a) => a.status)));
}
