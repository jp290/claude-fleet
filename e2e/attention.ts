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
import { readFileSync, writeFileSync } from "node:fs";
import { BASE, REPO, ROOT, check, get, paneEnv, plogRead, post, restartSrv, tmuxOut } from "./harness";

interface AttentionRow {
  id: string; raisedAt: number; kind: "decision" | "blocked" | "review-ready"; text: string;
  requester: { slot: number; openedAt: number; sessionId: string | null };
  programId: string; programTitle?: string | null;
  status: "open" | "send-uncertain" | "answered" | "refused";
  answer: { text: string; at: number; by: "owner" } | null;
  refusedReason: string | null; closedAt: number | null;
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
const freeSlot = async (): Promise<number> =>
  ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
    .slots.find((x) => x.cwd === null)?.id ?? 0;

export async function run(): Promise<void> {
  // === ATTENTION-CHANNEL-V1 ====================================================================
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
  const decision = await raised(await selfRaise(tokA, { kind: "decision", text: "Ship cut 2 now or after the audit?", programId: "spoofed" }));
  const blocked = await raised(await selfRaise(tokA, { kind: "blocked", text: "The land gate needs an owner token I do not hold." }));
  const reviewReady = await raised(await selfRaise(tokA, { kind: "review-ready", text: "The inbox slice is ready for your eyes." }));
  check("attention: a bound MAIN raises all three kinds and programId is server-derived, never body-supplied",
    decision?.kind === "decision" && blocked?.kind === "blocked" && reviewReady?.kind === "review-ready"
      && [decision, blocked, reviewReady].every((a) => a?.programId === programA && a.status === "open"
        && a.answer === null && a.closedAt === null)
      && readRows().length === 3,
    JSON.stringify({ decision, rows: readRows().length }));

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
  check("attention validation: unknown kind, empty, oversized and non-string text all fail closed 400",
    [badKind, emptyText, hugeText, nonString].every((r) => r.status === 400) && readRows().length === 3,
    [badKind, emptyText, hugeText, nonString].map((r) => r.status).join(","));

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

  // --- 4. the owner answer, full circle ---------------------------------------------------------
  // BREAKS IF: the typed message stops naming the request id (the receipt stops being exact), or
  // answered is assigned without a successful sendText.
  const answerText = "Land it after the audit — I will hold the deploy.";
  const answered = await post(`/api/attention/${decision?.id}/answer`, { text: answerText });
  const answeredBody = await answered.json() as { request?: AttentionRow };
  const pane = (await tmuxOut("capture-pane", "-t", `s${mainA}`, "-p")).out;
  const prompts = (await plogRead()).filter((p) => p.slot === mainA
    && p.text.includes(`[fleet] OWNER ANSWER [attention ${decision?.id}]`));
  check("attention answer full circle: the requester pane receives the id-bearing message and the row is answered",
    answered.ok && answeredBody.request?.status === "answered"
      && answeredBody.request.answer?.by === "owner" && answeredBody.request.closedAt !== null
      && pane.includes(`OWNER ANSWER [attention ${decision?.id}]`) && pane.includes("hold the deploy")
      && prompts.length === 1
      && readRow(decision?.id)?.status === "answered"
      && readRow(decision?.id)?.answer?.text === answerText,
    `${answered.status} ${JSON.stringify(answeredBody.request)} prompts=${prompts.length}`);

  const sameAnswer = await post(`/api/attention/${decision?.id}/answer`, { text: answerText });
  const sameAnswerBody = await sameAnswer.json() as { existing?: boolean };
  const otherAnswer = await post(`/api/attention/${decision?.id}/answer`, { text: "no, ship it now" });
  check("attention answered idempotency: identical text is existing:true, different text is 409 unchanged",
    sameAnswer.ok && sameAnswerBody.existing === true && otherAnswer.status === 409
      && readRow(decision?.id)?.answer?.text === answerText
      && (await plogRead()).filter((p) => p.slot === mainA
        && p.text.includes(`[attention ${decision?.id}]`)).length === 1,
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

  // --- 6. the crash boundary: an unresolved send is a PERSISTED state --------------------------
  // A pane death without occupant replacement must not become success. sendText supplies the
  // deterministic failure; the marker must already be on disk when it does.
  // BREAKS IF: answerAttention assigns send-uncertain after sendText, or drops the pre-send
  // saveStateNow, or treats send-uncertain as terminal.
  await tmuxOut("kill-session", "-t", `s${mainA}`);
  const deadAnswer = await post(`/api/attention/${reviewReady?.id}/answer`, { text: "answer to a dead pane" });
  const deadAnswerText = await deadAnswer.text();
  const uncertain = readRow(reviewReady?.id);
  check("attention unresolved send persists send-uncertain with the pending answer and is not closed",
    deadAnswer.status === 409 && /stays send-uncertain/.test(deadAnswerText)
      && uncertain?.status === "send-uncertain" && uncertain.answer?.text === "answer to a dead pane"
      && uncertain.answer?.by === "owner" && uncertain.closedAt === null && uncertain.refusedReason === null,
    `${deadAnswer.status} ${deadAnswerText} ${JSON.stringify(uncertain)}`);

  const uncertainCount = await attentionOpenCount();
  check("attentionOpen counts a send-uncertain row as still wanting the owner",
    uncertainCount === readRows().filter((a) => a.status === "open" || a.status === "send-uncertain").length
      && readRows().some((a) => a.status === "send-uncertain"),
    `${uncertainCount}`);

  const differentRetry = await post(`/api/attention/${reviewReady?.id}/answer`, { text: "a different answer entirely" });
  const differentRetryText = await differentRetry.text();
  check("attention send-uncertain retry with different text is 409 and never replaces the pending answer",
    differentRetry.status === 409 && differentRetryText.includes("different pending text")
      && readRow(reviewReady?.id)?.status === "send-uncertain"
      && readRow(reviewReady?.id)?.answer?.text === "answer to a dead pane",
    `${differentRetry.status} ${differentRetryText}`);

  // BREAKS IF: the identical retry short-circuits to answered without re-running sendText — the
  // healed pane below would then never contain the message.
  let healed = 1;
  for (let i = 0; i < 60 && healed !== 0; i++) {
    await Bun.sleep(250);
    healed = (await tmuxOut("has-session", "-t", `s${mainA}`)).code;
  }
  const sameRetry = await post(`/api/attention/${reviewReady?.id}/answer`, { text: "answer to a dead pane" });
  const sameRetryBody = await sameRetry.json() as { request?: AttentionRow };
  const healedPane = (await tmuxOut("capture-pane", "-t", `s${mainA}`, "-p")).out;
  check("attention identical retry re-attempts the send and only a successful one answers",
    healed === 0 && sameRetry.ok && sameRetryBody.request?.status === "answered"
      && sameRetryBody.request.closedAt !== null
      && healedPane.includes(`OWNER ANSWER [attention ${reviewReady?.id}]`)
      && readRow(reviewReady?.id)?.status === "answered",
    `healed=${healed} ${sameRetry.status} ${JSON.stringify(sameRetryBody.request)}`);

  // --- 7. reconcile: a row never reroutes to a recycled slot -------------------------------------
  // BREAKS IF: reconcileAttention stops running on slot teardown, or binds by slot id alone — the
  // successor below would then see, and be able to answer, a question it never asked.
  const beforeKill = readRows().filter((a) => a.requester.slot === mainC && a.status === "open").length;
  await post(`/api/slots/${mainC}/kill`, {});
  const afterKill = readRows().filter((a) => a.requester.slot === mainC);
  const reopened = await post(`/api/slots/${mainC}/open`, { cwd: REPO, label: "attention-successor" });
  const successorTok = await paneEnv(`s${mainC}`, "FLEET_SELF_TOKEN") ?? "";
  const successorSees = await selfAttention(successorTok);
  const successorAnswer = await post(`/api/attention/${capped[0]?.id}/answer`, { text: "must not reach the successor" });
  const successorPane = (await tmuxOut("capture-pane", "-t", `s${mainC}`, "-p")).out;
  check("attention reconcile: a dead requester's open rows are refused by name and no successor inherits them",
    beforeKill === 5 && afterKill.length === 5
      && afterKill.every((a) => a.status === "refused" && a.refusedReason === "requester session ended"
        && a.closedAt !== null && a.answer === null)
      && reopened.ok && successorSees.length === 0
      && successorAnswer.status === 409 && !successorPane.includes("must not reach the successor"),
    JSON.stringify({ beforeKill, statuses: afterKill.map((a) => a.status) }));

  for (const slot of [mainA, mainB, mainC, lane.slot]) await post(`/api/slots/${slot}/kill`, {});

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
