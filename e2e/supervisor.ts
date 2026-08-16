// SupervisorBinding v0: ONE owner-side cross-program identity, persisted beside `programs`,
// created only by an owner bootstrap, and transferred by succession rather than silently reborn.
// The binding grants nothing — every capability check below therefore has a reject twin, because
// "the owner can create it" and "nobody else can" are two different facts and only the pair is
// worth anything.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { BASE, H, ROOT, check, get, post, restartSrv, tmuxOut } from "./harness";

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
    label?: string | null }>;
  stewardToken?: string;
}
interface ContextReceipt {
  id: string; at: number; repo: string; head: string;
  taskId: string | null; originId: string | null; programId: string | null;
  slot: number; branch: string; harness: string | null; model: string | null; effort: string | null;
  selected: unknown[]; omitted: unknown[];
  deliveredBytes: number; truncated: boolean;
}

const SUPERVISOR_LABEL = "🧿 Supervisor";
// The founding body is restated here on purpose: this module is the SPEC side of the brief, so a
// silent edit to the server's wording must fail a check rather than travel with it.
const BRIEF_BODY = [
  "Your role: hold the cross-program portfolio together from typed facts, surface and ask, and NUDGE - every decision inside a program remains with its Program-MAIN or working circle, and every promotion remains with the owner.",
  "You structurally cannot confirm or activate programs, land, deploy, or write code; do not attempt any of these.",
  "Your channels today: GET /api/self (your own row), POST /api/self/programs (propose-only), POST /api/self/attention (reach the owner). Further capabilities arrive only through later owner-promoted cuts.",
  "Begin: run ./state.sh, then ./register.sh, then observe and report what you see to the owner via the attention channel only if something needs them.",
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
  check("supervisor founding brief: the delivered text is the minimal role/denial/channel/begin brief in order",
    foundingLines[0] === FOUNDING_FIRST
      && JSON.stringify(foundingLines.slice(1, 5)) === JSON.stringify(BRIEF_BODY)
      && foundingPrompt.includes("ContextPlan v1 anchors"),
    foundingPrompt.slice(0, 300));
  // The denial sentence and the channel list are the whole of v0's authority statement, so the set
  // of routes the brief names must be EXACTLY the three read/propose channels — a fourth would be
  // a capability granted in prose that no gate ever agreed to.
  const namedRoutes = [...new Set(foundingPrompt.match(/\/api\/[a-z/-]+/g) ?? [])].sort();
  check("supervisor founding brief: v0 names exactly its three channels and states the acts it cannot perform",
    JSON.stringify(namedRoutes) === JSON.stringify(["/api/self", "/api/self/attention", "/api/self/programs"])
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
  const succession = await succeed(supervisorToken, { label: successionLabel, carry });
  const successionBody = await succession.json() as { ok?: boolean; slot?: number; supervisor?: SupervisorBinding };
  const successorSlot = successionBody.slot ?? 0;
  const transferred = (await ownerRead()).supervisor;
  const successorState = readState().slots?.[String(successorSlot)];
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
      && JSON.stringify(successionLines.slice(1, 5)) === JSON.stringify(BRIEF_BODY)
      && successionPrompt.includes(carry) && successionPrompt.includes("ContextPlan v1 anchors"),
    successionPrompt.slice(0, 300));

  const successionReceipts = await receipts();
  const successionReceipt = successionReceipts.receipts.filter((r) => r.slot === successorSlot).at(-1);
  check("supervisor succession receipt: exactly one further cross-program receipt with programId null",
    successionReceipts.total === receiptsBeforeSuccession.total + 1 && !!successionReceipt
      && successionReceipt.programId === null && successionReceipt.taskId === null
      && successionReceipt.originId === null
      && successionReceipt.deliveredBytes === new TextEncoder().encode(successionPrompt).byteLength,
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

  // The predecessor retires on its own MIGRATE_GRACE timer; only the successor is this module's
  // to clean up, and it must be freed so later sections still find open slots.
  await post(`/api/slots/${successorSlot}/kill`, {});
}
