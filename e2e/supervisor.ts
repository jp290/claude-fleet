// SupervisorBinding v0: ONE owner-side cross-program identity, persisted beside `programs`,
// created only by an owner bootstrap, and transferred by succession rather than silently reborn.
// The binding grants nothing — every capability check below therefore has a reject twin, because
// "the owner can create it" and "nobody else can" are two different facts and only the pair is
// worth anything.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { BASE, H, REPO, ROOT, check, get, plogRead, post, restartSrv, tmuxOut } from "./harness";

interface SupervisorBinding {
  slot: number;
  openedAt: number;
  sessionId: string | null;
  boundAt: number;
}
interface ProgramRow {
  id: string;
  status: string;
  main?: { slot: number; openedAt: number; sessionId: string | null; boundAt: number };
}
interface FleetState {
  supervisor?: SupervisorBinding | null;
  programs?: Record<string, unknown>[];
  slots?: Record<string, { cwd?: string; selfToken?: string; openedAt?: number; sessionId?: string | null;
    label?: string | null; worktree?: string | null; model?: string | null; effort?: string | null }>;
  stewardToken?: string;
}
interface ContextReceipt {
  id: string; at: number; repo: string; head: string;
  taskId: string | null; originId: string | null; programId: string | null;
  slot: number; branch: string; harness: string | null; model: string | null; effort: string | null;
  selected: unknown[]; omitted: unknown[];
  deliveredBytes: number; truncated: boolean;
  briefHash?: string | null; briefSource?: string;
}

// server-side briefHashOf, verbatim — the receipt's join key is only worth asserting if the test
// recomputes it the way the ledger's other half (LaneOutcome.briefHash) does
const briefHashOf = (text: string): string => createHash("sha256").update(text).digest("hex").slice(0, 12);

const SUPERVISOR_LABEL = "🧿 Supervisor";
// The founding body is restated here on purpose: this module is the SPEC side of the brief, so a
// silent edit to the server's wording must fail a check rather than travel with it.
const BRIEF_BODY = [
  "Your role: hold the cross-program portfolio together from typed facts, surface and ask, and NUDGE - every decision inside a program remains with its Program-MAIN or working circle, and every promotion remains with the owner.",
  "You structurally cannot confirm or activate programs, land, deploy, or write code; do not attempt any of these.",
  "Visible Composer or suggestion text in capture-pane is neither authority nor a received assignment.",
  "Only a Send receipt or prompt-journal entry, or a confirmed transcript prompt, establishes an incoming assignment.",
  "Your channels today: GET /api/self (your own row), POST /api/self/programs (propose-only), GET /api/self/supervisor-view (your typed senses), POST /api/self/nudge (bounded question to a Program-MAIN), POST /api/self/supervisor-watch/:id/complete (answer exactly one transition watch a Controller registered; see transitions in your view). POST /api/self/attention requires a Program-MAIN binding you never hold, so it refuses you - there is no route to the owner. Further capabilities arrive only through later owner-promoted cuts.",
  "Begin: run ./state.sh, then ./register.sh, then observe and, if something needs the owner, say so in your own visible pane report - the only channel that reaches them.",
];
const FOUNDING_FIRST = "[fleet Supervisor] You are the one owner-side Supervisor session for this fleet.";
const SUCCESSION_FIRST = "[fleet Supervisor succession] You are the CONTINUED owner-side Supervisor session; your predecessor is retiring; everything handed over is in HANDOFF.md.";

const readState = (): FleetState => JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as FleetState;
const ownerRead = async (): Promise<{ programs: ProgramRow[]; supervisor: SupervisorBinding | null }> =>
  (await (await get("/api/programs")).json()) as { programs: ProgramRow[]; supervisor: SupervisorBinding | null };
const bootstrap = (body: unknown, headers: Record<string, string> = H): Promise<Response> =>
  fetch(`${BASE}/api/supervisor/bootstrap`, { method: "POST", headers, body: JSON.stringify(body) });
const succeed = (token: string, body: unknown = {}): Promise<Response> =>
  fetch(`${BASE}/api/self/succeed`, {
    method: "POST", headers: { "content-type": "application/json", "x-fleet-self-token": token },
    body: JSON.stringify(body),
  });
const sessions = async (): Promise<{ slots: { id: number; cwd: string | null; label: string | null }[] }> =>
  (await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null; label: string | null }[] };
const occupied = async (): Promise<number> => (await sessions()).slots.filter((s) => s.cwd).length;
const receipts = async (): Promise<{ receipts: ContextReceipt[]; total: number }> =>
  (await (await get("/api/context-receipts")).json()) as { receipts: ContextReceipt[]; total: number };
const historyOf = async (slot: number): Promise<string> => {
  const body = await (await get(`/api/slots/${slot}/history`)).json() as { history: { text: string }[] };
  return body.history.at(-1)?.text ?? "";
};
const sameBinding = (a: SupervisorBinding | null, b: SupervisorBinding | null): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

// A HANDOFF commit is compared against the session's openedAt in whole seconds on the git side and
// in milliseconds on the slot side; waiting past the next full second is what makes "newer" true.
const commitHandoff = async (openedAt: number, body: string): Promise<number> => {
  await Bun.sleep(Math.max(0, (Math.floor(openedAt / 1000) + 2) * 1000 - Date.now()));
  writeFileSync(`${ROOT}/HANDOFF.md`, body);
  spawnSync("git", ["-C", ROOT, "add", "HANDOFF.md"]);
  return spawnSync("git", ["-C", ROOT, "commit", "-qm", "supervisor succession handoff"]).status ?? 1;
};

export async function run(): Promise<void> {
  const baseline = await ownerRead();
  check("supervisor baseline: the owner proof read carries the binding as an additive key that starts null",
    baseline.supervisor === null && Array.isArray(baseline.programs),
    JSON.stringify({ supervisor: baseline.supervisor, programs: baseline.programs.length }));

  const stateBefore = readState();
  const someSelfToken = Object.values(stateBefore.slots ?? {}).map((v) => v.selfToken)
    .find((t): t is string => /^[0-9a-f]{32}$/.test(t ?? ""));
  const stewardToken = stateBefore.stewardToken ?? "";
  check("supervisor setup: a live session self credential and the steward credential are both observable",
    !!someSelfToken && !!stewardToken, `self=${someSelfToken?.length ?? 0} steward=${stewardToken.length}`);

  const occupiedBeforeRejects = await occupied();
  const [selfAuth, stewardAuth, noCwd, badHarness] = await Promise.all([
    bootstrap({ cwd: ROOT }, { "content-type": "application/json", "x-fleet-self-token": someSelfToken ?? "" }),
    bootstrap({ cwd: ROOT }, { "content-type": "application/json", authorization: `Bearer ${stewardToken}` }),
    bootstrap({}),
    bootstrap({ cwd: ROOT, harness: "not-a-harness" }),
  ]);
  const noCwdText = await noCwd.text();
  const badHarnessText = await badHarness.text();
  check("supervisor owner boundary: a self token and a steward token both fail the owner gate with 401",
    selfAuth.status === 401 && stewardAuth.status === 401,
    `self=${selfAuth.status} steward=${stewardAuth.status}`);
  check("supervisor validation: an absent cwd and an unknown harness are named 400s",
    noCwd.status === 400 && noCwdText.includes("cwd is required")
      && badHarness.status === 400 && badHarnessText.includes("unknown harness"),
    `${noCwd.status}:${noCwdText} | ${badHarness.status}:${badHarnessText}`);
  check("supervisor refusals: no rejected bootstrap opened a session or minted a binding",
    (await occupied()) === occupiedBeforeRejects && (await ownerRead()).supervisor === null,
    `occupied=${occupiedBeforeRejects}->${await occupied()}`);

  const receiptsBeforeBootstrap = await receipts();
  const created = await bootstrap({ cwd: ROOT });
  const createdBody = await created.json() as { ok?: boolean; existing?: boolean; slot?: number; supervisor?: SupervisorBinding };
  const bound = createdBody.supervisor ?? null;
  const boundSlot = createdBody.slot ?? 0;
  const boundState = readState().slots?.[String(boundSlot)];
  check("supervisor bootstrap: the owner mints exactly one binding naming the real server-read occupant",
    created.ok && createdBody.ok === true && !createdBody.existing && !!bound
      && bound.slot === boundSlot && bound.openedAt === boundState?.openedAt
      && bound.sessionId === (boundState?.sessionId ?? null) && typeof bound.boundAt === "number",
    `${created.status} ${JSON.stringify(createdBody)} state=${JSON.stringify(boundState)}`);
  check("supervisor bootstrap: an unnamed label defaults to the reserved Supervisor label",
    boundState?.label === SUPERVISOR_LABEL,
    `${boundState?.label ?? "none"}`);

  const foundingPrompt = await historyOf(boundSlot);
  const foundingLines = foundingPrompt.split("\n");
  check("supervisor founding brief: the delivered text is the role/denial/authority/channel/begin brief in order",
    foundingLines[0] === FOUNDING_FIRST
      && JSON.stringify(foundingLines.slice(1, 1 + BRIEF_BODY.length)) === JSON.stringify(BRIEF_BODY)
      && foundingPrompt.includes("ContextPlan v2 anchors"),
    foundingPrompt.slice(0, 300));
  // The denial sentence and the channel list are the whole of v0's CAPABILITY statement; the
  // provenance rule above grants no route. The set of routes the brief names must be EXACTLY the
  // channels an owner-promoted cut has actually built — a sixth would be a capability granted in
  // prose that no gate ever agreed to. Cut 2 adds the two it built and not one word more.
  // STN-1 added the sixth: the transition completion door (its `:id` segment ends the match, so
  // the trailing slash is trimmed before comparing).
  const namedRoutes = [...new Set((foundingPrompt.match(/\/api\/[a-z/-]+/g) ?? []).map((r) => r.replace(/\/$/, "")))].sort();
  check("supervisor founding brief: v0 names exactly its six channels and states the acts it cannot perform",
    JSON.stringify(namedRoutes) === JSON.stringify(["/api/self", "/api/self/attention", "/api/self/nudge",
      "/api/self/programs", "/api/self/supervisor-view", "/api/self/supervisor-watch"])
      && foundingPrompt.includes("structurally cannot confirm or activate programs, land, deploy, or write code"),
    namedRoutes.join(","));

  const afterBootstrapReceipts = await receipts();
  const foundingReceipt = afterBootstrapReceipts.receipts.filter((r) => r.slot === boundSlot).at(-1);
  check("supervisor receipt: bootstrap appends exactly one cross-program receipt with programId null",
    afterBootstrapReceipts.total === receiptsBeforeBootstrap.total + 1 && !!foundingReceipt
      && foundingReceipt.programId === null && foundingReceipt.taskId === null
      && foundingReceipt.originId === null && foundingReceipt.repo === ROOT
      && foundingReceipt.deliveredBytes === new TextEncoder().encode(foundingPrompt).byteLength,
    JSON.stringify(foundingReceipt ?? null));
  // A Supervisor brief is a SERVER-BUILT template with no Task in the call, so neither "raw" (a
  // draft text that does not exist) nor "compiled" (a model that never ran) would be true. The
  // hash is the same kind of fact as everywhere else — the bytes that crossed the seam — so a
  // reader has one rule for the whole ledger; it simply joins no lane outcome, because a
  // Supervisor is not a lane.
  check("supervisor receipt: the founding template is receipted as founding, hashed over the delivered bytes",
    foundingReceipt?.briefSource === "founding"
      && foundingReceipt?.briefHash === briefHashOf(foundingPrompt),
    JSON.stringify(foundingReceipt ?? null));

  const occupiedAfterBootstrap = await occupied();
  const repeat = await bootstrap({ cwd: ROOT, label: "a different label" });
  const repeatBody = await repeat.json() as { ok?: boolean; existing?: boolean; supervisor?: SupervisorBinding };
  check("supervisor idempotency: a second bootstrap on the live occupant returns the same binding, unchanged",
    repeat.ok && repeatBody.existing === true && sameBinding(repeatBody.supervisor ?? null, bound)
      && (await occupied()) === occupiedAfterBootstrap
      && (await receipts()).total === afterBootstrapReceipts.total,
    `${repeat.status} ${JSON.stringify(repeatBody)}`);

  check("supervisor persistence: the binding is on disk before any restart proves it survives one",
    sameBinding(readState().supervisor ?? null, bound), JSON.stringify(readState().supervisor ?? null));
  await restartSrv();
  const afterRestart = await ownerRead();
  check("supervisor persistence: the binding survives a server restart byte-for-byte",
    sameBinding(afterRestart.supervisor, bound), JSON.stringify(afterRestart.supervisor));

  const supervisorToken = readState().slots?.[String(boundSlot)]?.selfToken ?? "";
  check("supervisor succession prerequisite: the bound occupant still carries its own self credential",
    /^[0-9a-f]{32}$/.test(supervisorToken), `${supervisorToken.length} chars`);

  const noHandoff = await succeed(supervisorToken, {});
  const noHandoffText = await noHandoff.text();
  check("supervisor succession gate: without a fresh committed HANDOFF.md the transfer is a 409 and nothing moves",
    noHandoff.status === 409 && noHandoffText.includes("HANDOFF.md")
      && sameBinding((await ownerRead()).supervisor, bound),
    `${noHandoff.status} ${noHandoffText}`);

  const handoffStatus = await commitHandoff(bound?.openedAt ?? Date.now(),
    `## Supervisor succession\nthe cross-program portfolio continues\n`);
  check("supervisor succession prerequisite: HANDOFF.md is committed newer than the bound session",
    handoffStatus === 0, String(handoffStatus));

  // --- ambiguity: one session holding two authorities has no defined transfer order. ---
  await tmuxOut("kill-session", "-t", "srv");
  await Bun.sleep(500);
  const ambiguousId = `${"a".repeat(20)}beef`;
  const fixtureState = readState() as FleetState & Record<string, unknown>;
  const now = Date.now();
  fixtureState.programs = [...(fixtureState.programs ?? []), {
    id: ambiguousId, title: "Ambiguous authority fixture",
    intent: "Hold a second authority on the very session that is also the Supervisor.",
    successCriterion: "Succession refuses instead of picking a winner.",
    nonGoals: ["Inventing a priority"], decisions: [], evidence: [], openQuestions: [],
    status: "active", createdAt: now, proposedBy: { kind: "owner" },
    main: { slot: bound?.slot, openedAt: bound?.openedAt, sessionId: bound?.sessionId ?? null, boundAt: now },
    confirmedAt: now, activatedAt: now,
  }];
  writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(fixtureState, null, 2), { mode: 0o600 });
  await restartSrv();
  const loadedAmbiguous = (await ownerRead()).programs.find((p) => p.id === ambiguousId);
  check("supervisor ambiguity prerequisite: the fixture Program loaded and binds the very Supervisor session",
    loadedAmbiguous?.status === "active" && loadedAmbiguous.main?.slot === bound?.slot
      && loadedAmbiguous.main?.openedAt === bound?.openedAt,
    JSON.stringify(loadedAmbiguous ?? null));
  const occupiedBeforeAmbiguous = await occupied();
  const ambiguous = await succeed(supervisorToken, {});
  const ambiguousText = await ambiguous.text();
  const afterAmbiguous = await ownerRead();
  check("supervisor ambiguity: a session that is both Supervisor and active Program-MAIN gets 409 and mutates nothing",
    ambiguous.status === 409 && ambiguousText.includes("ambiguous succession")
      && ambiguousText.includes("Supervisor")
      && sameBinding(afterAmbiguous.supervisor, bound)
      && JSON.stringify(afterAmbiguous.programs.find((p) => p.id === ambiguousId)) === JSON.stringify(loadedAmbiguous)
      && (await occupied()) === occupiedBeforeAmbiguous,
    `${ambiguous.status} ${ambiguousText}`);
  const cleared = await post(`/api/programs/${ambiguousId}/complete`, {});
  check("supervisor ambiguity cleanup: completing the fixture Program removes the second authority",
    cleared.ok && (await ownerRead()).programs.find((p) => p.id === ambiguousId)?.status === "complete",
    String(cleared.status));

  // --- no free slot: the transfer refuses rather than retiring into nothing. ---
  const filled: number[] = [];
  for (const slot of (await sessions()).slots.filter((s) => !s.cwd)) {
    const opened = await post(`/api/slots/${slot.id}/open`, { cwd: ROOT, label: "supervisor-capacity-fixture" });
    if (opened.ok) filled.push(slot.id);
  }
  const fullSetup = (await sessions()).slots.every((s) => !!s.cwd);
  check("supervisor no-free precondition: every slot is occupied by an observed session",
    fullSetup, `filled=${filled.join(",")}`);
  if (fullSetup) {
    const noFree = await succeed(supervisorToken, {});
    const noFreeText = await noFree.text();
    check("supervisor succession: with no free slot the transfer is a loud 409 and the binding is unchanged",
      noFree.status === 409 && noFreeText.includes("no free slot")
        && sameBinding((await ownerRead()).supervisor, bound),
      `${noFree.status} ${noFreeText}`);
  }
  for (const slot of filled) await post(`/api/slots/${slot}/kill`, {});

  // --- the transfer itself. ---
  const receiptsBeforeSuccession = await receipts();
  const carry = "Continue the cross-program portfolio read.";
  const successionLabel = "supervisor-successor";
  // the succession carries a model/effort OVERRIDE on purpose: the Supervisor path has its own
  // openSlot call, and "absent = inherit" proven on the generic path (e2e/self-token.ts) says
  // nothing about whether THIS path reads the resolved pair or still the predecessor's record.
  const predecessorState = readState().slots?.[String(bound?.slot ?? 0)];
  const successionSpawn = { model: "claude-opus-5[1m]", effort: "max" };
  const succession = await succeed(supervisorToken, { label: successionLabel, carry, ...successionSpawn });
  const successionBody = await succession.json() as { ok?: boolean; slot?: number; supervisor?: SupervisorBinding };
  const successorSlot = successionBody.slot ?? 0;
  const transferred = (await ownerRead()).supervisor;
  const successorState = readState().slots?.[String(successorSlot)];
  check("supervisor succession: the successor's record carries the {model, effort} override, not the predecessor's pair",
    successorState?.model === successionSpawn.model && successorState.effort === successionSpawn.effort
      && (predecessorState?.model ?? null) !== successionSpawn.model,
    `pred=${JSON.stringify({ model: predecessorState?.model, effort: predecessorState?.effort })} succ=${JSON.stringify({ model: successorState?.model, effort: successorState?.effort })}`);
  check("supervisor succession: the binding moves to the successor and names its persisted identity exactly",
    succession.ok && successorSlot > 0 && successorSlot !== bound?.slot && !!transferred
      && transferred.slot === successorSlot && transferred.openedAt === successorState?.openedAt
      && transferred.sessionId === (successorState?.sessionId ?? null)
      && sameBinding(successionBody.supervisor ?? null, transferred),
    `${succession.status} ${JSON.stringify(successionBody)}`);
  check("supervisor succession: the predecessor is no longer the binding — a Supervisor is never silently reborn",
    !!transferred && !(transferred.slot === bound?.slot && transferred.openedAt === bound?.openedAt)
      && (transferred.boundAt ?? 0) > (bound?.boundAt ?? 0),
    `before=${JSON.stringify(bound)} after=${JSON.stringify(transferred)}`);

  const successionPrompt = await historyOf(successorSlot);
  const successionLines = successionPrompt.split("\n");
  check("supervisor succession brief: the founding body is delivered under the succession preamble with the carry",
    successionLines[0] === SUCCESSION_FIRST
      && JSON.stringify(successionLines.slice(1, 1 + BRIEF_BODY.length)) === JSON.stringify(BRIEF_BODY)
      && successionPrompt.includes(carry) && successionPrompt.includes("ContextPlan v2 anchors"),
    successionPrompt.slice(0, 300));

  const successionReceipts = await receipts();
  const successionReceipt = successionReceipts.receipts.filter((r) => r.slot === successorSlot).at(-1);
  check("supervisor succession receipt: exactly one further cross-program receipt with programId null",
    successionReceipts.total === receiptsBeforeSuccession.total + 1 && !!successionReceipt
      && successionReceipt.programId === null && successionReceipt.taskId === null
      && successionReceipt.originId === null
      && successionReceipt.deliveredBytes === new TextEncoder().encode(successionPrompt).byteLength,
    JSON.stringify(successionReceipt ?? null));
  check("supervisor succession receipt: the succession template is receipted as founding, hashed over the delivered bytes",
    successionReceipt?.briefSource === "founding"
      && successionReceipt?.briefHash === briefHashOf(successionPrompt),
    JSON.stringify(successionReceipt ?? null));

  // The ambiguity fixture leaves the run through the same door it came in — a Program row of this
  // module's making would otherwise ride the owner poll for every later section, and that payload
  // is size-bounded by a check downstream.
  await tmuxOut("kill-session", "-t", "srv");
  await Bun.sleep(500);
  const finalState = readState() as FleetState & Record<string, unknown>;
  finalState.programs = (finalState.programs ?? []).filter((p) => p.id !== ambiguousId);
  writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(finalState, null, 2), { mode: 0o600 });
  await restartSrv();
  const finalRead = await ownerRead();
  check("supervisor succession: the transferred binding is the one that survives the next restart",
    sameBinding(finalRead.supervisor, transferred)
      && !finalRead.programs.some((p) => p.id === ambiguousId),
    JSON.stringify(finalRead.supervisor));

  // ============================================================================================
  // Cut 2 — the senses and the voice. Both answer the BOUND occupant and nobody else, so every
  // capability below is checked together with the twin that proves the refusal.
  // ============================================================================================
  const svToken = readState().slots?.[String(successorSlot)]?.selfToken ?? "";
  const otherEntry = Object.entries(readState().slots ?? {})
    .filter(([id, v]) => Number(id) !== successorSlot && /^[0-9a-f]{32}$/.test(v.selfToken ?? ""))[0];
  const otherToken = otherEntry?.[1].selfToken ?? "";
  const otherSlot = Number(otherEntry?.[0] ?? 0);
  check("cut2 setup: the bound Supervisor and one ordinary session each carry a distinct self credential",
    /^[0-9a-f]{32}$/.test(svToken) && /^[0-9a-f]{32}$/.test(otherToken) && svToken !== otherToken,
    `sv=${svToken.length} other=${otherToken.length}`);

  // The receiver of every nudge below: an ordinary session, opened here so the fixture Program can
  // bind a REAL occupant rather than a remembered one.
  const freeForReceiver = (await sessions()).slots.find((x) => !x.cwd)?.id ?? 0;
  const receiverOpen = await post(`/api/slots/${freeForReceiver}/open`, { cwd: ROOT, label: "supervisor-nudge-receiver" });
  const receiverSlot = receiverOpen.ok ? freeForReceiver : 0;
  const receiverState = readState().slots?.[String(receiverSlot)];
  check("cut2 setup: a plain session is open to stand as the fixture program's bound Program-MAIN",
    receiverSlot > 0 && !!receiverState?.cwd && typeof receiverState.openedAt === "number",
    `slot=${receiverSlot} ${JSON.stringify(receiverState ?? null)}`);
  const receiverOccupant = { slot: receiverSlot, openedAt: receiverState?.openedAt ?? 0,
    sessionId: receiverState?.sessionId ?? null, boundAt: Date.now() };

  // Four Programs, one per branch of the receiver derivation. Installed through fleet.json for the
  // same reason the ambiguity fixture is: bootstrapping four real MAIN sessions would prove the
  // bootstrap, which Cut 1 already proves, and nothing about the derivation being measured here.
  const programFixture = (id: string, status: string, main: unknown, title: string): Record<string, unknown> => ({
    id, title, intent: "Stand as a fixture for the Supervisor nudge receiver derivation.",
    successCriterion: "The nudge derives this program's receiver, or refuses by naming why.",
    nonGoals: ["Proving the bootstrap"], decisions: [], evidence: [], openQuestions: [],
    status, createdAt: Date.now(), proposedBy: { kind: "owner" },
    ...(main ? { main } : {}), confirmedAt: Date.now(),
    ...(status === "active" ? { activatedAt: Date.now() } : {}),
  });
  const activeId = `${"c".repeat(20)}0001`;
  const proposedId = `${"c".repeat(20)}0002`;
  const staleId = `${"c".repeat(20)}0003`;
  const unboundId = `${"c".repeat(20)}0004`;
  const fixtureIds = [activeId, proposedId, staleId, unboundId];
  const installPrograms = async (rows: Record<string, unknown>[], awaitingOwner: boolean): Promise<void> => {
    await tmuxOut("kill-session", "-t", "srv");
    await Bun.sleep(500);
    const st = readState() as FleetState & Record<string, unknown>;
    st.programs = [...(st.programs ?? []).filter((p) => !fixtureIds.includes(String(p.id))), ...rows];
    const slotRow = (st.slots ?? {})[String(receiverSlot)];
    if (slotRow) (slotRow as Record<string, unknown>).awaiting = awaitingOwner ? "owner" : null;
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(st, null, 2), { mode: 0o600 });
    await restartSrv();
  };
  // V1a — ONE of the four fixtures carries an owner promotion, planted as the stored record the
  // server's own loader accepts (v:1, a rung in the closed set, a positive stamp). It is here so
  // the portfolio's promotion field has a NON-null arm to be proved on: a projection asserted only
  // against `null` would pass just as happily if it always answered null.
  const promoStamp = 1750000000000;
  await installPrograms([
    { ...programFixture(activeId, "active", receiverOccupant, "Active with a live bound MAIN"),
      promotion: { v: 1, selfLand: "green-only", confirmedAt: promoStamp } },
    programFixture(proposedId, "proposed", receiverOccupant, "Proposed, never activated"),
    programFixture(staleId, "active", { ...receiverOccupant, openedAt: receiverOccupant.openedAt + 1 },
      "Active, but its binding names a replaced occupant"),
    programFixture(unboundId, "active", null, "Active with no bound MAIN at all"),
  ], false);
  const loaded = (await ownerRead()).programs;
  check("cut2 fixture: all four receiver-derivation Programs loaded with the statuses they were written with",
    fixtureIds.every((id) => !!loaded.find((p) => p.id === id))
      && loaded.find((p) => p.id === activeId)?.status === "active"
      && loaded.find((p) => p.id === activeId)?.main?.openedAt === receiverOccupant.openedAt
      && loaded.find((p) => p.id === proposedId)?.status === "proposed"
      && loaded.find((p) => p.id === unboundId)?.main === undefined,
    JSON.stringify(loaded.filter((p) => fixtureIds.includes(p.id)).map((p) => [p.id.slice(-4), p.status])));

  // --- the view -------------------------------------------------------------------------------
  const selfGet = (path: string, token: string): Promise<Response> =>
    fetch(`${BASE}${path}`, { headers: { "x-fleet-self-token": token } });
  const selfPost = (path: string, token: string, body: unknown): Promise<Response> =>
    fetch(`${BASE}${path}`, { method: "POST",
      headers: { "content-type": "application/json", "x-fleet-self-token": token },
      body: JSON.stringify(body) });

  // One REAL row in the attention group, raised the only way one can be: by the bound MAIN of an
  // active program, through its own credential. A group asserted only as "shaped and empty" would
  // pass just as happily if its join were wrong. The row closes itself when the receiver slot is
  // killed at the end of this section (reconcileAttention refuses a requester that is gone).
  const receiverToken = readState().slots?.[String(receiverSlot)]?.selfToken ?? "";
  const raisedText = "Does the portfolio still want this program running?";
  const raised = await selfPost("/api/self/attention", receiverToken, { kind: "decision", text: raisedText });
  const raisedBody = await raised.json() as { request?: { id: string; programId: string } };
  check("cut2 fixture: the fixture program's bound MAIN raises one real attention request for the view to carry",
    raised.ok && !!raisedBody.request && raisedBody.request.programId === activeId,
    `${raised.status} ${JSON.stringify(raisedBody.request ?? null)}`);

  // The state subset the view could plausibly disturb, compared around the read. A whole-file
  // byte compare would be measuring the git tick, not this handler.
  const mutableFacts = (): string => {
    const st = readState() as FleetState & Record<string, unknown>;
    return JSON.stringify({ supervisor: st.supervisor ?? null, programs: st.programs ?? [],
      attention: st.attentionRequests ?? [], events: st.events ?? [],
      slots: Object.keys(st.slots ?? {}).sort() });
  };
  const factsBefore = mutableFacts();
  const viewRes = await selfGet("/api/self/supervisor-view", svToken);
  const view = await viewRes.json() as {
    at?: number;
    portfolio?: (Record<string, unknown> & { program: { id: string; status: string; title: string; completedAt: number | null };
      main: { slot: number } | null; health?: { occupancy?: string; sessionIdMatch?: string };
      promotion?: { v?: number; selfLand?: string; confirmedAt?: number } | null;
      tasks: { total: number; byStatus: Record<string, number> } })[];
    operations?: { outcomes: { rows: unknown[]; total: number; malformed: number };
      debts: { rows: { id: string; kind: string; receiverSlot: number; delivery: string; attempts: number }[];
        total: number; ownerAckOnly: number } };
    integration?: { deploys: { rows: unknown[]; total: number }; audits: { rows: unknown[]; total: number; redUnadjudicated: number };
      deployGap: unknown; bundle: unknown };
    attention?: { rows: { id: string; kind: string; slot: number; text: string }[]; total: number };
    provenance?: { rows: { id: string | null; at: number; programId: string | null; slot: number; deliveredBytes: number }[];
      total: number; malformed: number };
    unknown?: string[];
  };
  check("supervisor view: the bound occupant gets all five fact groups plus an explicit unknown list",
    viewRes.ok && !!view.portfolio && !!view.operations && !!view.integration && !!view.attention
      && !!view.provenance && Array.isArray(view.unknown) && view.unknown.length > 0
      && typeof view.at === "number",
    `${viewRes.status} groups=${Object.keys(view).join(",")}`);
  const rowOf = (id: string) => view.portfolio?.find((p) => p.program.id === id);
  check("supervisor view: the portfolio carries every fixture program with its derived occupancy",
    rowOf(activeId)?.health?.occupancy === "live"
      && rowOf(staleId)?.health?.occupancy === "stale"
      && rowOf(unboundId)?.health?.occupancy === "unbound"
      && rowOf(activeId)?.main?.slot === receiverSlot
      && typeof rowOf(activeId)?.tasks.total === "number",
    JSON.stringify(view.portfolio?.filter((p) => fixtureIds.includes(p.program.id))
      .map((p) => [p.program.id.slice(-4), p.health?.occupancy]) ?? []));
  // V1a · THE IDENTITY HALF, and the fixture that makes it worth having. `staleId` binds the SAME
  // slot as `activeId` at `openedAt + 1` — so the slot is HELD, by a living session, and it is
  // simply not the occupation that was bound. That is the one shape in which a naive comparison
  // would have something to compare and would be answering the wrong question; the rule is
  // `unknown` outside a live occupation, and this is where it earns its keep.
  //
  // The top-level `occupancy` is asserted GONE on the same rows: this projection and the owner's
  // route share one helper, and a leftover copy on either would be a second answer waiting to drift.
  // The live arm's `unknown` is claimed TOGETHER with its cause — this harness pins no session id,
  // so both sides are null. If that ever changed, `exact` would be the right answer and this check
  // must fail as ITSELF rather than go on asserting a comparison nobody made.
  check("V1a: the Supervisor's portfolio carries both health halves, and a HELD-but-not-bound slot still reports an unknown identity",
    receiverOccupant.sessionId === null
      && rowOf(activeId)?.health?.sessionIdMatch === "unknown"
      && rowOf(staleId)?.health?.sessionIdMatch === "unknown"
      && rowOf(unboundId)?.health?.sessionIdMatch === "unknown"
      && readState().slots?.[String(receiverSlot)]?.cwd !== undefined
      && (view.portfolio ?? []).every((p) => !("occupancy" in p)),
    JSON.stringify({ boundSession: receiverOccupant.sessionId,
      rows: view.portfolio?.filter((p) => fixtureIds.includes(p.program.id))
        .map((p) => [p.program.id.slice(-4), p.health]) ?? [] }));
  // V1a · THE OWNER'S RECORD, RAW. Until this cut the portfolio carried NO promotion at all, so
  // "the owner said no", "the owner never said" and "the owner granted a rung" were one silence to
  // the Supervisor while the owner's own board keeps all three apart. It is shipped as the stored
  // record and nothing else — no rung is translated here, because the five displayed states are the
  // client helper `promotionState`'s vocabulary and a second translator would be a second one.
  //
  // And `promotion: null` claims NOTHING about the owner waiting: `waitingOn` is asserted absent on
  // every row, because the owner's policy of 2026-08-23 reserves that door for a REVIEWABLE row
  // with no usable policy — a fact this projection never looks at.
  const promoRow = rowOf(activeId)?.promotion;
  check("V1a: the portfolio ships the owner's promotion record verbatim, an explicit null where there is none, and never a waitingOn",
    !!promoRow && promoRow.v === 1 && promoRow.selfLand === "green-only"
      && promoRow.confirmedAt === promoStamp
      && rowOf(staleId)?.promotion === null && rowOf(unboundId)?.promotion === null
      && (view.portfolio ?? []).every((p) => "promotion" in p && !("waitingOn" in p)),
    JSON.stringify(view.portfolio?.filter((p) => fixtureIds.includes(p.program.id))
      .map((p) => [p.program.id.slice(-4), p.promotion, "waitingOn" in p]) ?? []));
  check("supervisor view: the ledger-backed groups are shaped and bounded even when a ledger is empty",
    Array.isArray(view.operations?.outcomes.rows) && view.operations!.outcomes.rows.length <= 20
      && typeof view.operations?.debts.ownerAckOnly === "number"
      && Array.isArray(view.integration?.deploys.rows) && view.integration!.deploys.rows.length <= 5
      && Array.isArray(view.integration?.audits.rows) && view.integration!.audits.rows.length <= 5
      && typeof view.integration?.audits.redUnadjudicated === "number"
      && Array.isArray(view.provenance?.rows)
      && view.provenance!.rows.length <= 20,
    JSON.stringify({ outcomes: view.operations?.outcomes.total, debts: view.operations?.debts.total,
      deploys: view.integration?.deploys.total, audits: view.integration?.audits.total,
      attention: view.attention?.total, provenance: view.provenance?.total }));
  // The Supervisor's own founding receipts are cross-program rows — programId:null is a SCOPE, and
  // the provenance group is where it has to remain readable.
  const attentionRow = view.attention?.rows.find((a) => a.id === raisedBody.request?.id);
  check("supervisor view: the attention group carries the row its bound MAIN just raised, sliced and attributed",
    !!attentionRow && attentionRow.kind === "decision" && attentionRow.slot === receiverSlot
      && attentionRow.text === raisedText && (view.attention?.total ?? 0) >= 1,
    JSON.stringify(attentionRow ?? view.attention?.rows.slice(0, 2) ?? null));
  check("supervisor view: provenance carries the Supervisor's own cross-program receipts",
    (view.provenance?.rows ?? []).some((r) => r.slot === successorSlot && r.programId === null
      && r.deliveredBytes > 0),
    JSON.stringify(view.provenance?.rows.slice(0, 3) ?? []));
  check("supervisor view: the read mutated nothing an owner-visible fact is made of",
    mutableFacts() === factsBefore, "state subset unchanged");

  const [viewOther, viewAnon] = await Promise.all([
    selfGet("/api/self/supervisor-view", otherToken),
    fetch(`${BASE}/api/self/supervisor-view`),
  ]);
  const viewOtherText = await viewOther.text();
  check("supervisor view twin: an ordinary session's own credential is refused 409, and no credential at all is 401",
    viewOther.status === 409 && viewOtherText.includes("not the bound Supervisor")
      && viewAnon.status === 401,
    `other=${viewOther.status}:${viewOtherText} anon=${viewAnon.status}`);

  // A lane can never BE the Supervisor, so the occupancy gate is the whole lane story — proven
  // rather than argued, because "a lane is covered by the same check" is exactly the kind of claim
  // that stops being true when someone adds a second way to write the binding.
  if (REPO) {
    const lane = await (await post("/api/lanes", { repo: REPO })).json() as { slot?: number };
    const laneToken = lane.slot ? readState().slots?.[String(lane.slot)]?.selfToken ?? "" : "";
    const [laneView, laneNudge] = await Promise.all([
      selfGet("/api/self/supervisor-view", laneToken),
      selfPost("/api/self/nudge", laneToken, { programId: activeId, text: "from a lane" }),
    ]);
    check("supervisor cut2 twin: a lane's own credential is refused by the occupancy gate on both routes",
      /^[0-9a-f]{32}$/.test(laneToken) && laneView.status === 409 && laneNudge.status === 409,
      `token=${laneToken.length} view=${laneView.status} nudge=${laneNudge.status}`);
    if (lane.slot) await post(`/api/slots/${lane.slot}/kill`, {});
  }

  // --- program CONTENT: the portfolio read ------------------------------------------------------
  // The Supervisor sees every Program's content through the SAME occupancy predicate its other
  // senses use. The fixtures make that the only possible source of the reach: they are proposed by
  // the owner and bound to the receiver session, so neither pre-existing disjunct of the filter
  // (proposer identity, bound Program-MAIN) can be what lets the Supervisor read them.
  interface ProgramContentRow {
    id: string; title: string; intent: string; successCriterion: string;
    nonGoals: string[]; decisions: unknown[]; evidence: unknown[]; openQuestions: unknown[];
    status: string; createdAt: number; proposedBy?: { kind?: string; slot?: number };
    main?: { slot: number; openedAt: number };
  }
  const selfPrograms = async (token: string): Promise<{ status: number; raw: string; rows: ProgramContentRow[] }> => {
    const res = await selfGet("/api/self/programs", token);
    const raw = await res.text();
    let rows: ProgramContentRow[] = [];
    try { rows = (JSON.parse(raw) as { programs?: ProgramContentRow[] }).programs ?? []; } catch { rows = []; }
    return { status: res.status, raw, rows };
  };
  const FIXTURE_INTENT = "Stand as a fixture for the Supervisor nudge receiver derivation.";
  const FIXTURE_CRITERION = "The nudge derives this program's receiver, or refuses by naming why.";

  const loadedForContent = (await ownerRead()).programs;
  check("cut2 programs precondition: no fixture Program was proposed by the Supervisor session or bound to it",
    fixtureIds.every((id) => {
      const p = loadedForContent.find((x) => x.id === id) as (ProgramRow & ProgramContentRow) | undefined;
      return !!p && p.proposedBy?.kind === "owner" && p.main?.slot !== successorSlot;
    }),
    JSON.stringify(loadedForContent.filter((p) => fixtureIds.includes(p.id))
      .map((p) => [p.id.slice(-4), (p as ProgramRow & ProgramContentRow).proposedBy?.kind, p.main?.slot ?? null])));

  const factsBeforeContentRead = mutableFacts();
  const svPrograms = await selfPrograms(svToken);
  const svActive = svPrograms.rows.find((p) => p.id === activeId);
  const svUnbound = svPrograms.rows.find((p) => p.id === unboundId);
  check("supervisor programs: the bound occupant reads every fixture Program ACROSS proposer identity",
    svPrograms.status === 200 && fixtureIds.every((id) => svPrograms.rows.some((p) => p.id === id))
      && svActive?.status === "active" && svPrograms.rows.find((p) => p.id === proposedId)?.status === "proposed",
    `${svPrograms.status} ${JSON.stringify(svPrograms.rows.map((p) => [p.id.slice(-4), p.status]))}`);
  check("supervisor programs: the rows carry real CONTENT — intent, criterion, non-goals, the three lists",
    svActive?.intent === FIXTURE_INTENT && svActive.successCriterion === FIXTURE_CRITERION
      && JSON.stringify(svActive.nonGoals) === JSON.stringify(["Proving the bootstrap"])
      && svActive.title === "Active with a live bound MAIN"
      && svUnbound?.title === "Active with no bound MAIN at all"
      && svUnbound.intent === FIXTURE_INTENT
      && JSON.stringify(svActive.decisions) === "[]" && JSON.stringify(svActive.evidence) === "[]"
      && JSON.stringify(svActive.openQuestions) === "[]",
    JSON.stringify({ intent: svActive?.intent, criterion: svActive?.successCriterion,
      nonGoals: svActive?.nonGoals, title: svActive?.title, unboundTitle: svUnbound?.title }));
  check("supervisor programs: the content read mutated nothing an owner-visible fact is made of",
    mutableFacts() === factsBeforeContentRead, "state subset unchanged");

  const otherState = readState().slots?.[String(otherSlot)];
  const otherIsPlain = otherSlot > 0 && !otherState?.worktree
    && !loadedForContent.some((p) => p.main?.slot === otherSlot
      || (p as ProgramRow & ProgramContentRow).proposedBy?.slot === otherSlot);
  check("cut2 programs twin precondition: the ordinary session is a non-lane that neither proposed nor is bound MAIN",
    otherIsPlain, `slot=${otherSlot} worktree=${otherState?.worktree ?? null}`);
  const otherPrograms = await selfPrograms(otherToken);
  check("supervisor programs twin: an ordinary session's list is still the exact empty shape, unchanged",
    otherIsPlain && otherPrograms.status === 200 && otherPrograms.raw === '{"programs":[]}',
    `${otherPrograms.status} ${otherPrograms.raw.slice(0, 200)}`);

  // The POST branch is untouched by this cut: a Supervisor proposal is still a PROPOSAL.
  const proposedBySv = await selfPost("/api/self/programs", svToken, {
    title: "Supervisor-proposed portfolio note", intent: "Prove the POST branch stayed propose-only.",
    successCriterion: "The minted row is status proposed and nothing else moved.",
    nonGoals: ["Confirming anything"], decisions: [], evidence: [], openQuestions: [] });
  const mintedBody = await proposedBySv.json() as { ok?: boolean; program?: ProgramContentRow };
  const mintedId = mintedBody.program?.id ?? "";
  if (mintedId) fixtureIds.push(mintedId);
  const repeatPropose = await selfPost("/api/self/programs", svToken, {
    title: "Supervisor-proposed portfolio note", intent: "Prove the POST branch stayed propose-only.",
    successCriterion: "The minted row is status proposed and nothing else moved.",
    nonGoals: ["Confirming anything"], decisions: [], evidence: [], openQuestions: [] });
  const repeatBody2 = await repeatPropose.json() as { existing?: boolean; program?: { id?: string } };
  check("supervisor programs: the POST branch is unchanged — a Supervisor proposal is proposed, attributed, idempotent",
    proposedBySv.ok && mintedBody.program?.status === "proposed"
      && mintedBody.program.proposedBy?.kind === "session" && mintedBody.program.proposedBy.slot === successorSlot
      && repeatBody2.existing === true && repeatBody2.program?.id === mintedId,
    `${proposedBySv.status} ${JSON.stringify({ status: mintedBody.program?.status,
      by: mintedBody.program?.proposedBy, existing: repeatBody2.existing })}`);

  // Succession: the reach follows the BINDING, never the slot or the credential that once held it.
  // The predicate is occupancy-derived, so that is structural — and a structural claim without a
  // probe is prose. Two probes, because the predecessor can be in either of two states by the time
  // this runs: its credential is already recycled with the slot, or it is still answerable.
  const predecessorSelf = await selfGet("/api/self", supervisorToken);
  const predecessorPrograms = predecessorSelf.status === 200
    ? await selfPrograms(supervisorToken) : null;
  check("supervisor programs: the retired predecessor's credential reaches no program content — recycled (401), or answerable and empty",
    predecessorSelf.status === 401
      || (predecessorPrograms?.status === 200 && predecessorPrograms.raw === '{"programs":[]}'),
    `slot=${bound?.slot ?? 0} self=${predecessorSelf.status} programs=${predecessorPrograms?.raw.slice(0, 120) ?? "n/a"}`);
  // The other half, and the one a recycled slot makes sharpest: a live ORDINARY occupant reads only
  // through the pre-existing disjuncts. The receiver is bound MAIN of two fixtures and nothing else,
  // so it must see exactly those two while the Supervisor sees all four.
  const receiverPrograms = await selfPrograms(receiverToken);
  const receiverIds = receiverPrograms.rows.map((p) => p.id).sort().join(",");
  check("supervisor programs: succession — an ordinary occupant inherits no Supervisor reach, it sees only what it is bound MAIN of",
    receiverPrograms.status === 200
      && receiverIds === [activeId, proposedId].sort().join(",")
      && svPrograms.rows.some((p) => p.id === staleId) && svPrograms.rows.some((p) => p.id === unboundId),
    `receiver=${receiverPrograms.rows.map((p) => p.id.slice(-4)).join(",")} supervisor=${svPrograms.rows.map((p) => p.id.slice(-4)).join(",")}`);

  // --- the nudge ------------------------------------------------------------------------------
  const plogBeforeNudge = (await plogRead()).length;
  const historyLen = async (slot: number): Promise<number> =>
    ((await (await get(`/api/slots/${slot}/history`)).json()) as { history: unknown[] }).history.length;
  const historyBefore = await historyLen(receiverSlot);
  const decoySlot = receiverSlot === 1 ? 2 : 1;
  const nudgeText = "Two lanes have been done-looking for an hour — is that the shape you intended?";
  const nudgeRes = await selfPost("/api/self/nudge", svToken,
    { programId: activeId, text: nudgeText, slot: decoySlot });
  const nudge = await nudgeRes.json() as { ok?: boolean;
    receipt?: { sendId: string; at: number; submitRequested: boolean; acceptance: string;
      receiver: { slot: number; openedAt: number; sessionId: string | null } } };
  check("supervisor nudge: the happy path answers the owner-send receipt anatomy exactly",
    nudgeRes.ok && nudge.ok === true && /^[0-9a-f]{24}$/.test(nudge.receipt?.sendId ?? "")
      && nudge.receipt?.submitRequested === true && nudge.receipt.acceptance === "not-applicable"
      && typeof nudge.receipt.at === "number"
      && nudge.receipt.receiver.openedAt === receiverOccupant.openedAt,
    `${nudgeRes.status} ${JSON.stringify(nudge)}`);
  // The body carried `slot` and it changed NOTHING: the receiver is the binding's occupant.
  check("supervisor nudge: a body slot field is ignored — the receiver stays the program's bound MAIN",
    nudge.receipt?.receiver.slot === receiverSlot && receiverSlot !== decoySlot,
    `receipt=${nudge.receipt?.receiver.slot} body=${decoySlot} binding=${receiverSlot}`);

  const plogAfterNudge = await plogRead();
  const journaled = plogAfterNudge.find((p) => p.sendId === nudge.receipt?.sendId);
  check("supervisor nudge: exactly one journal line, attributed to the supervisor source and joinable by sendId",
    !!journaled && journaled.source === "supervisor" && journaled.delivery === "sent"
      && journaled.slot === receiverSlot
      && plogAfterNudge.filter((p) => p.sendId === nudge.receipt?.sendId).length === 1
      && journaled.text.startsWith(`[fleet Supervisor nudge ${nudge.receipt?.sendId}] from the owner-side Supervisor (slot ${successorSlot}).`)
      && journaled.text.endsWith(`\n\n${nudgeText}`),
    JSON.stringify({ source: journaled?.source, delivery: journaled?.delivery, slot: journaled?.slot,
      head: journaled?.text.slice(0, 120) }));
  check("supervisor nudge: the receiver's own history grew by the delivered text",
    (await historyLen(receiverSlot)) === historyBefore + 1
      && (await historyOf(receiverSlot)).includes(nudgeText),
    `${historyBefore} -> ${await historyLen(receiverSlot)}`);
  check("supervisor nudge: the delivered header states that the decision stays with Program-MAIN",
    (await historyOf(receiverSlot)).includes("A nudge is information plus a question — the decision remains with you as Program-MAIN."),
    (await historyOf(receiverSlot)).split("\n")[0] ?? "");

  const plogBeforeRejects = (await plogRead()).length;
  const [byOther, unknownProgram, notActive, staleMain, unboundMain, tooLong, emptyText] = await Promise.all([
    selfPost("/api/self/nudge", otherToken, { programId: activeId, text: "not mine to send" }),
    selfPost("/api/self/nudge", svToken, { programId: `${"f".repeat(24)}`, text: "into the void" }),
    selfPost("/api/self/nudge", svToken, { programId: proposedId, text: "too early" }),
    selfPost("/api/self/nudge", svToken, { programId: staleId, text: "to a replaced occupant" }),
    selfPost("/api/self/nudge", svToken, { programId: unboundId, text: "to nobody" }),
    selfPost("/api/self/nudge", svToken, { programId: activeId, text: "x".repeat(2001) }),
    selfPost("/api/self/nudge", svToken, { programId: activeId, text: "   " }),
  ]);
  const texts = await Promise.all([byOther, unknownProgram, notActive, staleMain, unboundMain, tooLong, emptyText]
    .map((r) => r.text()));
  check("supervisor nudge twin: only the bound Supervisor may speak — an ordinary session is 409",
    byOther.status === 409 && texts[0]!.includes("not the bound Supervisor"), `${byOther.status} ${texts[0]}`);
  check("supervisor nudge twin: each failing branch of the receiver derivation names what failed, as a 409",
    unknownProgram.status === 409 && texts[1]!.includes("unknown program")
      && notActive.status === 409 && texts[2]!.includes("not active")
      && staleMain.status === 409 && texts[3]!.includes("gone or was replaced")
      && unboundMain.status === 409 && texts[4]!.includes("no bound Program-MAIN"),
    `${unknownProgram.status}|${notActive.status}|${staleMain.status}|${unboundMain.status}`);
  check("supervisor nudge twin: an over-long and an empty text are invalid REQUESTS (400), not policy states",
    tooLong.status === 400 && texts[5]!.includes("at most 2000")
      && emptyText.status === 400 && texts[6]!.includes("must not be empty"),
    `${tooLong.status}:${texts[5]} ${emptyText.status}:${texts[6]}`);
  check("supervisor nudge twin: not one refused nudge reached a pane or the journal",
    (await plogRead()).length === plogBeforeRejects
      && (await historyLen(receiverSlot)) === historyBefore + 1,
    `plog ${plogBeforeRejects} -> ${(await plogRead()).length}`);

  // --- the owner debt: a nudge never talks past a wait that belongs to the owner. ---
  await installPrograms([
    programFixture(activeId, "active", receiverOccupant, "Active with a live bound MAIN"),
  ], true);
  const awaitingLoaded = (await get("/api/sessions")).ok;
  const plogBeforeAwaiting = (await plogRead()).length;
  const awaitingRes = await selfPost("/api/self/nudge", svToken, { programId: activeId, text: "are you still on it?" });
  const awaitingText = await awaitingRes.text();
  check("supervisor nudge twin: a Program-MAIN waiting on the owner is 409 and nothing is journaled",
    awaitingLoaded && awaitingRes.status === 409 && awaitingText.includes("waiting on the owner")
      && (await plogRead()).length === plogBeforeAwaiting,
    `${awaitingRes.status} ${awaitingText}`);

  // ============================================================================================
  // STN-1 — the transition rail. A Controller REGISTERS a question, the bound Supervisor ANSWERS
  // it exactly once, and the existing FleetEvent transport carries the answer into the
  // registrant's pane when it comes to rest. Authorization, once-only, envelope honesty and the
  // view are proved here; the registration-side refusals and the transport states live in
  // e2e/watch.ts, the perimeter in e2e/security.ts.
  // ============================================================================================
  const ctlId = (await sessions()).slots.find((x) => !x.cwd)?.id ?? 0;
  const ctlOpen = await post(`/api/slots/${ctlId}/open`, { cwd: ROOT, label: "stn1-controller" });
  const ctlTok = readState().slots?.[String(ctlId)]?.selfToken ?? "";
  const ctlOpenedAt = readState().slots?.[String(ctlId)]?.openedAt ?? 0;
  check("stn1 setup: a plain Controller session is open with its own self credential",
    ctlOpen.ok && ctlId > 0 && /^[0-9a-f]{32}$/.test(ctlTok) && ctlOpenedAt > 0,
    `slot=${ctlId} ${ctlOpen.status}`);
  interface TransitionWatchRow {
    id: string; kind: string; slot: number; slotOpenedAt?: number; idleSec: number; armed: boolean;
    created: number; firedAt: number | null; lastResult: string | null; awaiting: string; deadlineAt: number;
    delivery?: string;
  }
  interface TransitionEventRow {
    id: string; watchId: string | null; kind: string; status: string; receiverSlot: number;
    subjectSlot?: number; subjectOpenedAt?: number; attempts: number; deliveredAt: number | null;
    acknowledgedAt: number | null; delivery?: string;
    payload?: { watchId: string; awaiting: string; text: string; completedAt: number };
  }
  const ctlSelf = async (): Promise<{ watches: TransitionWatchRow[]; events: TransitionEventRow[] }> =>
    (await (await selfGet("/api/self", ctlTok)).json()) as { watches: TransitionWatchRow[]; events: TransitionEventRow[] };
  const viewTransitions = async (): Promise<{ rows: { id: string; slot: number; awaiting: string; created: number;
    deadlineAt: number; receiver: string }[]; total: number } | undefined> =>
    ((await (await selfGet("/api/self/supervisor-view", svToken)).json()) as
      { transitions?: { rows: { id: string; slot: number; awaiting: string; created: number; deadlineAt: number;
        receiver: string }[]; total: number } }).transitions;

  const expectedTransition = "the fixture program reaches active and its MAIN has reported once";
  const regRes = await selfPost("/api/self/watch", ctlTok,
    { kind: "transition", idleSec: 0, deadlineSec: 120, awaiting: expectedTransition });
  const reg = await regRes.json() as { ok?: boolean; existing?: boolean; watch?: TransitionWatchRow };
  const tw = reg.watch;
  check("stn1 register: a plain Controller registers one armed transition watch bound to its own occupant",
    regRes.ok && reg.ok === true && !reg.existing && tw?.kind === "transition" && tw.armed === true
      && tw.slot === ctlId && tw.slotOpenedAt === ctlOpenedAt && tw.awaiting === expectedTransition
      && tw.idleSec === 0 && tw.deadlineAt === tw.created + 120_000 && tw.delivery === undefined,
    `${regRes.status} ${JSON.stringify(reg)}`);
  const viewBefore = await viewTransitions();
  const viewRow = viewBefore?.rows.find((r) => r.id === tw?.id);
  check("stn1 view: the Supervisor sees the armed watch — awaiting, created, deadline, receiver occupancy — in its existing view",
    !!viewRow && viewRow.slot === ctlId && viewRow.awaiting === expectedTransition && viewRow.created === tw?.created
      && viewRow.deadlineAt === tw?.deadlineAt && viewRow.receiver === "live" && (viewBefore?.total ?? 0) >= 1,
    JSON.stringify(viewRow ?? viewBefore ?? null));

  // --- the refusals FIRST, so the happy path below cannot have been what they observed. ---
  const completePath = (id: string): string => `/api/self/supervisor-watch/${id}/complete`;
  const plogBeforeComplete = (await plogRead()).length;
  const ctlHistoryBefore = await historyLen(ctlId);
  const [cOther, cAnon, cOwner, cUnknown, cExtra, cEmpty, cLong, cNoBody] = await Promise.all([
    selfPost(completePath(tw?.id ?? "x"), otherToken, { text: "not mine to answer" }),
    fetch(`${BASE}${completePath(tw?.id ?? "x")}`, { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "anon" }) }),
    fetch(`${BASE}${completePath(tw?.id ?? "x")}`, { method: "POST",
      headers: { ...H, "content-type": "application/json" }, body: JSON.stringify({ text: "owner token" }) }),
    selfPost(completePath("doesnotexist"), svToken, { text: "into the void" }),
    selfPost(completePath(tw?.id ?? "x"), svToken, { text: "with a nominated receiver", slot: receiverSlot }),
    selfPost(completePath(tw?.id ?? "x"), svToken, { text: "   " }),
    selfPost(completePath(tw?.id ?? "x"), svToken, { text: "x".repeat(2001) }),
    fetch(`${BASE}${completePath(tw?.id ?? "x")}`, { method: "POST",
      headers: { "x-fleet-self-token": svToken } }),
  ]);
  const cTexts = await Promise.all([cOther, cAnon, cOwner, cUnknown, cExtra, cEmpty, cLong, cNoBody].map((r) => r.text()));
  check("stn1 complete twin: only the bound Supervisor may complete — an ordinary session is 409, no/owner credential 401",
    cOther.status === 409 && cTexts[0]!.includes("not the bound Supervisor")
      && cAnon.status === 401 && cOwner.status === 401,
    `${cOther.status}|${cAnon.status}|${cOwner.status} ${cTexts[0]}`);
  check("stn1 complete twin: an unknown watch id is a named 409",
    cUnknown.status === 409 && cTexts[3]!.includes("unknown watch"), `${cUnknown.status} ${cTexts[3]}`);
  check("stn1 complete twin: the body is a closed set — a nominated slot, empty, over-long and absent text are 400s",
    cExtra.status === 400 && cTexts[4]!.includes("[slot] is not read")
      && cEmpty.status === 400 && cTexts[5]!.includes("must not be empty")
      && cLong.status === 400 && cTexts[6]!.includes("at most 2000")
      && cNoBody.status === 400,
    `${cExtra.status}:${cTexts[4]} ${cEmpty.status} ${cLong.status} ${cNoBody.status}:${cTexts[7]}`);
  const stillArmed = (await ctlSelf()).watches.find((w) => w.id === tw?.id);
  check("stn1 complete twin: not one refusal spent the watch, minted an event, or reached a pane",
    stillArmed?.armed === true && (await ctlSelf()).events.length === 0
      && (await plogRead()).length === plogBeforeComplete && (await historyLen(ctlId)) === ctlHistoryBefore,
    JSON.stringify({ armed: stillArmed?.armed, events: (await ctlSelf()).events.length }));

  // --- the completion, exactly once. ---
  const transitionText = "Program reached active at the owner's activation; its MAIN filed one fleet-report (complete).";
  const doneRes = await selfPost(completePath(tw?.id ?? "x"), svToken, { text: transitionText, });
  const done = await doneRes.json() as { ok?: boolean; watch?: TransitionWatchRow; event?: TransitionEventRow };
  check("stn1 complete: the bound Supervisor spends the watch and mints exactly one typed supervisor-transition event",
    doneRes.ok && done.ok === true && done.watch?.id === tw?.id && done.watch?.armed === false
      && typeof done.watch?.firedAt === "number" && done.watch?.lastResult === `event ${done.event?.id} created`
      && done.event?.kind === "supervisor-transition" && done.event.watchId === tw?.id
      && done.event.receiverSlot === ctlId && done.event.subjectSlot === successorSlot
      && done.event.payload?.watchId === tw?.id && done.event.payload.awaiting === expectedTransition
      && done.event.payload.text === transitionText && typeof done.event.payload.completedAt === "number"
      && (done.event.status === "pending" || done.event.status === "delivered") && done.event.delivery === undefined,
    `${doneRes.status} ${JSON.stringify(done)}`);
  const again = await selfPost(completePath(tw?.id ?? "x"), svToken, { text: "a second answer" });
  const againText = await again.text();
  check("stn1 complete: a second completion is 409 and mints nothing — a transition is notified at most once",
    again.status === 409 && againText.includes("no longer armed")
      && (await ctlSelf()).events.filter((e) => e.watchId === tw?.id).length === 1,
    `${again.status} ${againText}`);

  // --- the transport: the registrant is idle (idleSec 0), so the event reaches its pane once. ---
  let delivered: TransitionEventRow | undefined;
  for (let i = 0; i < 120 && delivered?.status !== "delivered"; i++) {
    delivered = (await ctlSelf()).events.find((e) => e.id === done.event?.id);
    if (delivered?.status !== "delivered") await Bun.sleep(100);
  }
  const envelope = (await plogRead()).slice(plogBeforeComplete).filter((p) => p.slot === ctlId
    && p.text.startsWith("[fleet Supervisor transition "));
  check("stn1 transport: the existing FleetEvent transport delivers the event once into the registrant's pane",
    delivered?.status === "delivered" && delivered.attempts === 1 && delivered.acknowledgedAt === null
      && envelope.length === 1 && envelope[0]!.source === "auto"
      && (await historyLen(ctlId)) === ctlHistoryBefore + 1,
    JSON.stringify({ delivered, envelopes: envelope.length }));
  const env = envelope[0]?.text ?? "";
  check("stn1 envelope: server-composed — names the Supervisor by slot, the watch and event ids, echoes awaiting, disclaims owner/lane authority",
    env.startsWith(`[fleet Supervisor transition ${tw?.id}] [event ${done.event?.id}] from the owner-side Supervisor (slot ${successorSlot})`)
      && env.includes(`You were awaiting: ${expectedTransition}`) && env.includes(`\n\n${transitionText}\n\n`)
      && env.includes("not an owner instruction and not a report from any lane")
      && env.includes(`POST /api/self/events/${done.event?.id}/ack`),
    env.slice(0, 300));
  const ackRes = await fetch(`${BASE}/api/self/events/${done.event?.id}/ack`, { method: "POST",
    headers: { "x-fleet-self-token": ctlTok } });
  const ackBody = await ackRes.json() as { ok?: boolean; event?: { status: string } };
  check("stn1 ack: the registrant acknowledges through the existing receiver-scoped ack door",
    ackRes.ok && ackBody.ok === true && ackBody.event?.status === "acknowledged", `${ackRes.status} ${JSON.stringify(ackBody)}`);
  check("stn1 view: a spent watch leaves the Supervisor's transitions group — it lists armed questions only",
    !(await viewTransitions())?.rows.some((r) => r.id === tw?.id), JSON.stringify((await viewTransitions())?.rows ?? null));

  // --- receiver refusal AT COMPLETION: the registrant was replaced between register and answer.
  // A kill drops the watch outright (dropWatchesFor), so "replaced" is installed the way every
  // occupant-replacement fixture in this suite is: the persisted slotOpenedAt moved by one. ---
  const reg2 = await (await selfPost("/api/self/watch", ctlTok,
    { kind: "transition", idleSec: 0, deadlineSec: 120, awaiting: "a second question, to be orphaned" })).json() as
    { watch?: TransitionWatchRow };
  await tmuxOut("kill-session", "-t", "srv");
  await Bun.sleep(500);
  {
    const st = readState() as FleetState & { watches?: TransitionWatchRow[] };
    const row = (st.watches ?? []).find((w) => w.id === reg2.watch?.id);
    if (row && typeof row.slotOpenedAt === "number") row.slotOpenedAt += 1;
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(st, null, 2), { mode: 0o600 });
  }
  await restartSrv();
  const orphanView = (await viewTransitions())?.rows.find((r) => r.id === reg2.watch?.id);
  check("stn1 view: a watch whose registrant was replaced is listed as gone-or-replaced before anyone completes it",
    orphanView?.receiver === "gone-or-replaced", JSON.stringify(orphanView ?? null));
  const plogBeforeOrphan = (await plogRead()).length;
  const orphanRes = await selfPost(completePath(reg2.watch?.id ?? "x"), svToken, { text: "answering a ghost" });
  const orphanText = await orphanRes.text();
  const orphanRow = ((await (await get("/api/sessions")).json()) as { watches: TransitionWatchRow[] })
    .watches.find((w) => w.id === reg2.watch?.id);
  check("stn1 complete twin: a replaced registrant is refused 409, the watch is disarmed with its reason, and no event exists",
    orphanRes.status === 409 && orphanText.includes("gone or was replaced")
      && orphanRow?.armed === false && (orphanRow.lastResult ?? "").includes("gone or replaced")
      && !((await (await get("/api/sessions")).json()) as { events: TransitionEventRow[] }).events
        .some((e) => e.watchId === reg2.watch?.id)
      && (await plogRead()).length === plogBeforeOrphan,
    `${orphanRes.status} ${orphanText} ${JSON.stringify(orphanRow ?? null)}`);
  await post(`/api/slots/${ctlId}/kill`, {});

  // --- freshness: a second read is a fresh derivation, not a cached one. ---
  const completed = await post(`/api/programs/${activeId}/complete`, {});
  const refreshed = await (await selfGet("/api/self/supervisor-view", svToken)).json() as {
    portfolio?: { program: { id: string; status: string; completedAt: number | null } }[] };
  const refreshedRow = refreshed.portfolio?.find((p) => p.program.id === activeId);
  check("supervisor view: a second read reflects a state change made between the two — it is derived, never cached",
    completed.ok && refreshedRow?.program.status === "complete"
      && typeof refreshedRow.program.completedAt === "number",
    JSON.stringify(refreshedRow ?? null));

  // The fixtures leave through the door they came in: a Program row of this module's making would
  // otherwise ride the owner poll for every later section, whose payload is size-bounded downstream.
  await installPrograms([], false);
  const cleaned = await ownerRead();
  check("supervisor cut2 cleanup: every fixture Program is gone and the binding is untouched by all of it",
    !cleaned.programs.some((p) => fixtureIds.includes(p.id)) && sameBinding(cleaned.supervisor, transferred),
    JSON.stringify(cleaned.supervisor));
  await post(`/api/slots/${receiverSlot}/kill`, {});

  // The predecessor retires on its own MIGRATE_GRACE timer; only the successor is this module's
  // to clean up, and it must be freed so later sections still find open slots.
  await post(`/api/slots/${successorSlot}/kill`, {});

  // ============================================================================================
  // Cut 3 — BOOTSTRAP OVER A DEAD BINDING. Deliberately last: it MOVES the binding, so every
  // section above would have to re-anchor its `bound`/`transferred` reads around it.
  //
  // The kill one line up left `supervisor` naming a slot that no longer carries that occupation —
  // exactly the live state of 2026-09-03, when the only route that can appoint a Supervisor
  // answered `stale Supervisor binding: slot 5 openedAt 1787497726285` (a record from 21.08.) and
  // refused. The record outlives every restart, so the refusal was permanent: the fleet could not
  // appoint a Supervisor again by any door. Program-MAIN bootstrap has answered this the other way
  // since its own rebind seam, and this is the same rule on the same terms — overwrite, and NAME
  // what was replaced, in the response and in one trail row. The twin (a LIVE binding is still
  // `existing:true`, never overwritten) is the idempotency check in Cut 1 and is not repeated.
  // ============================================================================================
  const staleBinding = (await ownerRead()).supervisor;
  const occupiedBeforeRebind = await occupied();
  check("supervisor rebind precondition: the binding survives its occupant's death and now names an empty slot",
    sameBinding(staleBinding, transferred)
      && (await sessions()).slots.find((s) => s.id === staleBinding?.slot)?.cwd === null,
    `${JSON.stringify(staleBinding)} slots=${JSON.stringify((await sessions()).slots.find((s) => s.id === staleBinding?.slot) ?? null)}`);
  const auditBeforeRebind = readFileSync(`${ROOT}/audit.jsonl`, "utf8").split("\n").filter(Boolean).length;
  const receiptsBeforeRebind = await receipts();
  const rebind = await bootstrap({ cwd: ROOT, label: "supervisor-rebind" });
  const rebindBody = await rebind.json() as { ok?: boolean; existing?: boolean; slot?: number;
    supervisor?: SupervisorBinding; replaced?: SupervisorBinding };
  const rebindSlot = rebindBody.slot ?? 0;
  const rebindState = readState().slots?.[String(rebindSlot)];
  check("supervisor rebind: a DEAD binding is overwritten instead of refused, and the response names what it replaced",
    rebind.ok && rebindBody.ok === true && rebindBody.existing !== true
      && rebindSlot > 0 && rebindSlot !== staleBinding?.slot
      && sameBinding(rebindBody.replaced ?? null, staleBinding)
      && rebindBody.supervisor?.slot === rebindSlot
      && rebindBody.supervisor?.openedAt === rebindState?.openedAt
      && sameBinding((await ownerRead()).supervisor, rebindBody.supervisor ?? null)
      && (await occupied()) === occupiedBeforeRebind + 1,
    `${rebind.status} ${JSON.stringify(rebindBody)} state=${JSON.stringify(rebindState ?? null)}`);
  const rebindTrail = readFileSync(`${ROOT}/audit.jsonl`, "utf8").split("\n").filter(Boolean)
    .slice(auditBeforeRebind)
    .map((line) => JSON.parse(line) as { event?: string; slot?: number; detail?: string })
    .filter((row) => row.event === "supervisor_rebound");
  check("supervisor rebind leaves ONE trail row naming the replaced occupation and no brief text",
    rebindTrail.length === 1 && rebindTrail[0]?.slot === rebindSlot
      && rebindTrail[0]?.detail === `replaced slot:${staleBinding?.slot} openedAt:${staleBinding?.openedAt}`,
    JSON.stringify(rebindTrail));
  // the rebind ran the WHOLE founding path, so it delivered a founding brief and receipted it —
  // an overwrite that skipped either would have appointed a Supervisor that was never told anything
  const rebindPrompt = await historyOf(rebindSlot);
  const rebindReceipt = (await receipts()).receipts.filter((r) => r.slot === rebindSlot).at(-1);
  check("supervisor rebind: the replacement is FOUNDED — the brief is delivered and receipted like a first bootstrap",
    rebindPrompt.split("\n")[0] === FOUNDING_FIRST
      && (await receipts()).total === receiptsBeforeRebind.total + 1
      && rebindReceipt?.briefSource === "founding"
      && rebindReceipt?.briefHash === briefHashOf(rebindPrompt),
    `${rebindPrompt.slice(0, 120)} | ${JSON.stringify(rebindReceipt ?? null)}`);
  await post(`/api/slots/${rebindSlot}/kill`, {});
}
