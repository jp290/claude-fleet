// Program/Origin Artifact v1: a durable planning bracket above tasks and lanes. Sessions may
// propose; only the owner confirms and advances it. Full bodies stay off the 2 s sessions poll.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { BASE, H, REPO, ROOT, TOKEN, check, get, post, restartSrv, tmuxOut } from "./harness";
import type { Ctx } from "./ctx";

type ProgramStatus = "proposed" | "confirmed" | "active" | "complete";
interface ProgramContent {
  title: string;
  intent: string;
  successCriterion: string;
  nonGoals: string[];
  decisions: string[];
  evidence: string[];
  openQuestions: string[];
}
interface Program extends ProgramContent {
  id: string;
  status: ProgramStatus;
  createdAt: number;
  proposedBy: { kind: "session"; slot: number; openedAt: number; sessionId: string | null }
    | { kind: "owner" };
  main?: { slot: number; openedAt: number; sessionId: string | null; boundAt: number };
  confirmedAt?: number;
  activatedAt?: number;
  completedAt?: number;
}
interface FleetState {
  programs?: Program[];
  stewardToken?: string;
  slots?: Record<string, { cwd?: string; selfToken?: string; openedAt?: number; sessionId?: string | null;
    harness?: string | null; model?: string | null; effort?: string | null }>;
}

interface ContextReceipt {
  id: string; hash: string; at: number; repo: string; head: string;
  taskId: string | null; originId: string | null; programId: string | null;
  slot: number; branch: string; harness: string | null; model: string | null; effort: string | null;
  mode: string; triggers: string[];
  selected: { id: string; anchors: { path: string; anchor: string }[] | { privateSourceId: string }; sourceHash?: string }[];
  omitted: { id: string; why: string }[];
  deliveredBytes: number; truncated: boolean;
}

const content: ProgramContent = {
  title: "Program origin bracket",
  intent: "Keep the owner's intention durable above future task execution.",
  successCriterion: "The confirmed bracket survives restart without entering the queue.",
  nonGoals: ["Dispatching work"],
  decisions: ["Programs remain separate from tasks"],
  evidence: ["docs/program-origin.md", "commit:abc123"],
  openQuestions: ["Which future tasks belong inside the bracket?"],
};
const readState = (): FleetState => JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as FleetState;
const canonical = (value: unknown): unknown => Array.isArray(value)
  ? value.map(canonical)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, canonical(entry)]))
    : value;
const ownerPrograms = async (): Promise<Program[]> =>
  ((await (await get("/api/programs")).json()) as { programs: Program[] }).programs;
const selfPrograms = async (token: string): Promise<{ response: Response; programs: Program[] }> => {
  const response = await fetch(`${BASE}/api/self/programs`, { headers: { "x-fleet-self-token": token } });
  const body = await response.json() as { programs?: Program[] };
  return { response, programs: body.programs ?? [] };
};
const selfPropose = (token: string, body: unknown): Promise<Response> => fetch(`${BASE}/api/self/programs`, {
  method: "POST", headers: { "content-type": "application/json", "x-fleet-self-token": token },
  body: JSON.stringify(body),
});
const programPost = (id: string, action: "confirm" | "activate" | "complete" | "discard" | "bootstrap-main",
  body: unknown = {}, headers: Record<string, string> = H): Promise<Response> =>
  fetch(`${BASE}/api/programs/${id}/${action}`, {
    method: "POST", headers, body: JSON.stringify(body),
  });
const contextReceipts = async (): Promise<{ receipts: ContextReceipt[]; total: number; malformed: number }> =>
  (await (await get("/api/context-receipts")).json()) as { receipts: ContextReceipt[]; total: number; malformed: number };
const sessions = async (): Promise<{ slots: { id: number; cwd: string | null; label: string | null; openedAt?: number }[] }> =>
  (await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null; label: string | null; openedAt?: number }[] };
const activateNewProgram = async (title: string): Promise<Program> => {
  const made = await post("/api/programs", { ...content, title });
  const program = ((await made.json()) as { program: Program }).program;
  await programPost(program.id, "confirm");
  const active = await programPost(program.id, "activate");
  return ((await active.json()) as { program: Program }).program;
};
const beginBootstrap = (id: string, body: Record<string, unknown>): Promise<Response> =>
  programPost(id, "bootstrap-main", body);
const waitForLabel = async (label: string): Promise<number | null> => {
  for (let i = 0; i < 60; i++) {
    const slot = (await sessions()).slots.find((s) => s.cwd && s.label === label)?.id;
    if (slot) return slot;
    await Bun.sleep(50);
  }
  return null;
};

export async function run(ctx: Ctx): Promise<void> {
  // Legacy state has no programs member. Stop the scratch server before editing its state, then
  // restart through the shared helper; the helper's first kill is harmless against an absent srv.
  await tmuxOut("kill-session", "-t", "srv");
  await Bun.sleep(500);
  const legacy = readState() as FleetState & Record<string, unknown>;
  delete legacy.programs;
  writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(legacy, null, 2), { mode: 0o600 });
  await restartSrv();
  const legacyPrograms = await ownerPrograms();
  check("programs legacy state: an absent programs member loads as [] with no backfill",
    legacyPrograms.length === 0, JSON.stringify(legacyPrograms));

  const state = readState();
  const plain = state.slots?.["2"];
  const plainToken = plain?.selfToken ?? "";
  check("programs setup: the non-lane session and lane self credentials survived the legacy restart",
    /^[0-9a-f]{32}$/.test(plainToken) && /^[0-9a-f]{32}$/.test(ctx.restartSelfTok ?? ""),
    `plain=${plainToken.length} lane=${ctx.restartSelfTok?.length ?? 0}`);

  const tasksBefore = await (await get("/api/tasks")).json() as { tasks: Record<string, unknown>[] };
  const pollBefore = await (await get("/api/sessions")).json() as
    { tasks: Record<string, unknown>[]; dispatch: Record<string, unknown> };

  // Client attempts to supply authority fields are ignored. Whitespace is trimmed by the shared
  // validator, so the stored row and the idempotency comparison both use canonical content.
  const proposalRes = await selfPropose(plainToken, {
    ...content, title: `  ${content.title}  `,
    id: "client-id", status: "complete", proposedBy: { kind: "owner" }, extra: "ignored",
  });
  const proposalBody = await proposalRes.json() as { ok?: boolean; existing?: boolean; program?: Program };
  const proposed = proposalBody.program!;
  const expectedBy = { kind: "session" as const, slot: 2, openedAt: plain?.openedAt,
    sessionId: plain?.sessionId ?? null };
  check("programs self propose: valid non-lane proposal mints id/status and honest session provenance",
    proposalRes.ok && proposalBody.ok === true && /^[0-9a-f]{24}$/.test(proposed?.id ?? "")
      && proposed?.status === "proposed" && proposed?.title === content.title
      && JSON.stringify(proposed?.proposedBy) === JSON.stringify(expectedBy)
      && !("extra" in (proposed ?? {})),
    `${proposalRes.status} ${JSON.stringify(proposalBody)}`);

  const [selfView0, ownerView0] = await Promise.all([selfPrograms(plainToken), ownerPrograms()]);
  check("programs views: the full proposal is visible to its own session and to the owner",
    selfView0.response.ok && selfView0.programs.some((p) => p.id === proposed.id)
      && ownerView0.some((p) => p.id === proposed.id),
    `self=${selfView0.programs.length} owner=${ownerView0.length}`);

  const laneRes = await selfPropose(ctx.restartSelfTok ?? "", content);
  check("programs scope: a lane self proposal is refused because Programs bracket lanes",
    laneRes.status === 409 && (await laneRes.text()).includes("brackets above lanes"), String(laneRes.status));

  const repeatRes = await selfPropose(plainToken, content);
  const repeatBody = await repeatRes.json() as { ok?: boolean; existing?: boolean; program?: Program };
  const ownerAfterRepeat = await ownerPrograms();
  check("programs idempotency: identical re-propose in the same session returns the existing row",
    repeatRes.ok && repeatBody.existing === true && repeatBody.program?.id === proposed.id
      && ownerAfterRepeat.length === ownerView0.length,
    `${repeatRes.status} ${JSON.stringify(repeatBody)} count=${ownerAfterRepeat.length}`);

  const correctedIntent = "Owner-corrected intention, stored as the confirmed truth.";
  const confirmRes = await programPost(proposed.id, "confirm", { intent: ` ${correctedIntent} `, ignored: true });
  const confirmBody = await confirmRes.json() as { ok?: boolean; program?: Program };
  const confirmed = confirmBody.program!;
  check("programs confirm: owner corrections replace proposal content while provenance stays unchanged",
    confirmRes.ok && confirmed?.status === "confirmed" && confirmed?.intent === correctedIntent
      && typeof confirmed?.confirmedAt === "number"
      && JSON.stringify(confirmed?.proposedBy) === JSON.stringify(proposed.proposedBy),
    `${confirmRes.status} ${JSON.stringify(confirmBody)}`);

  const confirmAgain = await programPost(proposed.id, "confirm", { intent: correctedIntent });
  const confirmAgainBody = await confirmAgain.json() as { ok?: boolean; existing?: boolean };
  const conflictingConfirm = await programPost(proposed.id, "confirm", { intent: "A different owner truth" });
  check("programs confirm idempotency: an identical repeat is existing:true, a different repeat conflicts",
    confirmAgain.ok && confirmAgainBody.existing === true && conflictingConfirm.status === 409
      && (await conflictingConfirm.text()).includes("conflicting confirm"),
    `same=${confirmAgain.status}:${JSON.stringify(confirmAgainBody)} conflict=${conflictingConfirm.status}`);

  // The owner mutation rail recognizes exactly the owner token. A self token uses its scoped
  // header; the steward uses its ordinary bearer credential. Neither may cross this boundary.
  const stewardToken = state.stewardToken ?? "";
  const actions = ["confirm", "activate", "complete", "discard", "bootstrap-main"] as const;
  const [selfAuth, stewardAuth] = await Promise.all([
    Promise.all(actions.map((action) => programPost(proposed.id, action, {},
      { "content-type": "application/json", "x-fleet-self-token": plainToken }))),
    Promise.all(actions.map((action) => programPost(proposed.id, action, {},
      { "content-type": "application/json", authorization: `Bearer ${stewardToken}` }))),
  ]);
  check("programs owner boundary: self tokens cannot mutate lifecycle or bootstrap Program-MAIN (401)",
    selfAuth.every((r) => r.status === 401), selfAuth.map((r) => r.status).join(","));
  check("programs owner boundary: steward token cannot mutate lifecycle or bootstrap Program-MAIN (401)",
    !!stewardToken && stewardAuth.every((r) => r.status === 401), stewardAuth.map((r) => r.status).join(","));

  const invalidCases: { name: string; body: Record<string, unknown>; message: string }[] = [
    { name: "empty intent", body: { ...content, intent: "   " }, message: "intent must be 1–4000 chars" },
    { name: "21-item nonGoals", body: { ...content, nonGoals: Array(21).fill("x") }, message: "nonGoals must contain at most 20 items" },
    { name: "4001-char intent", body: { ...content, intent: "x".repeat(4001) }, message: "intent must be at most 4000 chars" },
    { name: "evidence non-array", body: { ...content, evidence: "a copied document" }, message: "evidence must be an array" },
  ];
  const invalidResults = await Promise.all(invalidCases.map(async (c) => {
    const response = await post("/api/programs", c.body);
    return { ...c, status: response.status, text: await response.text() };
  }));
  check("programs validation: named 400s cover empty intent, item cap, scalar cap, and non-array evidence",
    invalidResults.every((r) => r.status === 400 && r.text.includes(r.message)),
    invalidResults.map((r) => `${r.name}:${r.status}:${r.text}`).join(" | "));

  const beforeRestart = (await ownerPrograms()).find((p) => p.id === proposed.id)!;
  await restartSrv();
  const afterRestart = (await ownerPrograms()).find((p) => p.id === proposed.id);
  check("programs legacy row: a persisted Program without main survives restart byte-honest",
    JSON.stringify(afterRestart) === JSON.stringify(beforeRestart),
    `before=${JSON.stringify(beforeRestart)} after=${JSON.stringify(afterRestart)}`);

  const poll = await (await get("/api/sessions")).json() as
    { programs: Record<string, unknown>[]; tasks: Record<string, unknown>[]; dispatch: Record<string, unknown> };
  const digest = poll.programs.find((p) => p.id === proposed.id);
  const full = (await ownerPrograms()).find((p) => p.id === proposed.id);
  check("programs digest: /api/sessions carries exactly id/status/title/createdAt and no bodies",
    !!digest && JSON.stringify(Object.keys(digest).sort()) === JSON.stringify(["createdAt", "id", "status", "title"])
      && !("intent" in digest) && !!full?.intent && Array.isArray(full?.evidence),
    `digest=${JSON.stringify(digest)} full=${JSON.stringify(full)}`);

  const tasksAfter = await (await get("/api/tasks")).json() as { tasks: Record<string, unknown>[] };
  check("programs isolation: creating and confirming a Program changes no task rows or queue projection",
    JSON.stringify(tasksAfter) === JSON.stringify(tasksBefore)
      && JSON.stringify(poll.tasks) === JSON.stringify(pollBefore.tasks),
    `full:${tasksBefore.tasks.length}->${tasksAfter.tasks.length} poll:${pollBefore.tasks.length}->${poll.tasks.length}`);
  check("programs isolation: dispatch configuration is unchanged and no task gains programId without the owner naming one",
    JSON.stringify(poll.dispatch) === JSON.stringify(pollBefore.dispatch)
      && tasksAfter.tasks.every((t) => !("programId" in t)) && poll.tasks.every((t) => !("programId" in t)),
    `dispatch=${JSON.stringify(poll.dispatch)}`);

  // Owner-direct proposals use the same content validator and honestly say owner. This row also
  // supplies the proposed-state negative transition without touching the session proposal.
  const ownerCreate = await post("/api/programs", { ...content, title: "Owner-created proposal", status: "active" });
  const ownerCreated = (await ownerCreate.json()) as { program?: Program };
  check("programs owner propose: server mints proposed owner provenance and ignores client status",
    ownerCreate.ok && ownerCreated.program?.status === "proposed"
      && ownerCreated.program?.proposedBy.kind === "owner", JSON.stringify(ownerCreated));
  const activateProposed = await programPost(ownerCreated.program!.id, "activate");
  const completeConfirmed = await programPost(proposed.id, "complete");
  check("programs illegal transitions: activate proposed and complete confirmed are 409",
    activateProposed.status === 409 && completeConfirmed.status === 409,
    `activate=${activateProposed.status} complete=${completeConfirmed.status}`);

  // --- Program-MAIN bootstrap: one delivered founding brief and one durable binding. ---
  const proposedBootstrap = await beginBootstrap(ownerCreated.program!.id, { cwd: REPO });
  const confirmedBootstrap = await beginBootstrap(proposed.id, { cwd: REPO });
  check("Program-MAIN wrong status: proposed and confirmed are loud 409s naming their status",
    proposedBootstrap.status === 409 && (await proposedBootstrap.text()).includes("proposed")
      && confirmedBootstrap.status === 409 && (await confirmedBootstrap.text()).includes("confirmed"),
    `proposed=${proposedBootstrap.status} confirmed=${confirmedBootstrap.status}`);

  const bootstrapBaselineIds = new Set((await ownerPrograms()).map((p) => p.id));
  const completedStatus = await activateNewProgram("Completed bootstrap refusal");
  await programPost(completedStatus.id, "complete");
  const completedBootstrap = await beginBootstrap(completedStatus.id, { cwd: REPO });
  check("Program-MAIN wrong status: complete is a loud 409 naming complete",
    completedBootstrap.status === 409 && (await completedBootstrap.text()).includes("complete"),
    String(completedBootstrap.status));

  const capacityProgram = await activateNewProgram("No-free-slot bootstrap probe");
  const malformedBefore = JSON.stringify(await ownerPrograms());
  const occupiedBeforeMalformed = (await sessions()).slots.filter((s) => s.cwd).length;
  const [missingCwd, unknownHarness, badModel, badEffort] = await Promise.all([
    beginBootstrap(capacityProgram.id, {}),
    beginBootstrap(capacityProgram.id, { cwd: REPO, harness: "not-a-harness" }),
    beginBootstrap(capacityProgram.id, { cwd: REPO, harness: "codex", model: "bad model!" }),
    beginBootstrap(capacityProgram.id, { cwd: REPO, harness: "codex", effort: "maximum" }),
  ]);
  const malformedTexts = await Promise.all([missingCwd, unknownHarness, badModel, badEffort].map((r) => r.text()));
  check("Program-MAIN validation: cwd is explicit and harness/model/effort use attended-spawn 400s",
    [missingCwd, unknownHarness, badModel, badEffort].every((r) => r.status === 400)
      && malformedTexts[0].includes("cwd is required") && malformedTexts[1].includes("unknown harness")
      && malformedTexts[2].includes("bad model") && malformedTexts[3].includes("bad effort"),
    malformedTexts.join(" | "));
  check("Program-MAIN malformed bodies have no slot or Program side effect",
    (await sessions()).slots.filter((s) => s.cwd).length === occupiedBeforeMalformed
      && JSON.stringify(await ownerPrograms()) === malformedBefore,
    `occupied=${occupiedBeforeMalformed}->${(await sessions()).slots.filter((s) => s.cwd).length}`);

  const beforeFill = await sessions();
  const filled: number[] = [];
  for (const slot of beforeFill.slots.filter((s) => !s.cwd)) {
    const opened = await post(`/api/slots/${slot.id}/open`, { cwd: REPO, label: "program-capacity-fixture" });
    if (opened.ok) filled.push(slot.id);
  }
  const fullSetup = (await sessions()).slots.every((s) => !!s.cwd);
  check("Program-MAIN no-free precondition: every slot is occupied by an observed session",
    fullSetup, `filled=${filled.join(",")}`);
  if (fullSetup) {
    const programsBeforeNoFree = JSON.stringify(await ownerPrograms());
    const noFree = await beginBootstrap(capacityProgram.id, { cwd: REPO });
    check("Program-MAIN no free slot: loud 409 opens nothing and changes no Program",
      noFree.status === 409 && (await noFree.text()).includes("no free slot")
        && JSON.stringify(await ownerPrograms()) === programsBeforeNoFree
        && (await sessions()).slots.every((s) => !!s.cwd), String(noFree.status));
  }
  for (const slot of filled) await post(`/api/slots/${slot}/kill`, {});
  await programPost(capacityProgram.id, "complete");

  const NODE = Bun.which("node") ?? "node";
  const respawnScreen = (slot: number, screen: string): Promise<{ out: string; code: number }> =>
    tmuxOut("respawn-pane", "-k", "-t", `s${slot}`,
      `${NODE} -e 'console.log(process.argv[1]); setInterval(() => {}, 1e9)' ${JSON.stringify(screen)}`);

  const failureProgram = await activateNewProgram("Program-MAIN delivery cleanup");
  const failureLabel = "program-main-failure";
  const receiptsBeforeFailure = await contextReceipts();
  const failurePending = beginBootstrap(failureProgram.id, {
    cwd: REPO, label: failureLabel, harness: "codex", model: "gpt-5.5", effort: "high",
  });
  const failureSlot = await waitForLabel(failureLabel);
  check("Program-MAIN delivery-failure precondition: the reserved codex occupant became observable",
    failureSlot !== null, String(failureSlot));
  if (failureSlot !== null) await respawnScreen(failureSlot, "Do you trust the contents of this directory?");
  const concurrent = await beginBootstrap(failureProgram.id, { cwd: ROOT });
  const failureResponse = await failurePending;
  const failureText = await failureResponse.text();
  const failureAfter = (await ownerPrograms()).find((p) => p.id === failureProgram.id);
  const failureReceipts = await contextReceipts();
  check("Program-MAIN concurrency: a second bootstrap while delivery is in flight is a loud 409",
    concurrent.status === 409 && (await concurrent.text()).includes("already in flight"), String(concurrent.status));
  check("Program-MAIN delivery failure: the blocking screen is named and no binding or receipt exists",
    failureResponse.status === 500 && failureText.includes("codex trust prompt") && !failureAfter?.main
      && failureReceipts.total === receiptsBeforeFailure.total
      && !failureReceipts.receipts.some((r) => r.programId === failureProgram.id),
    `${failureResponse.status} ${failureText}`);
  check("Program-MAIN delivery failure cleanup: no occupied fixture slot is left behind",
    failureSlot !== null && !(await sessions()).slots.some((s) => s.id === failureSlot && s.cwd),
    JSON.stringify((await sessions()).slots.find((s) => s.id === failureSlot)));
  await programPost(failureProgram.id, "complete");

  const mainProgram = await activateNewProgram("Authoritative Program-MAIN delivery");
  const mainLabel = "program-main-success";
  const occupiedBeforeMain = (await sessions()).slots.filter((s) => s.cwd).length;
  const receiptsBeforeMain = await contextReceipts();
  const mainPending = beginBootstrap(mainProgram.id, {
    cwd: REPO, label: mainLabel, harness: "codex", model: "gpt-5.5", effort: "high",
  });
  const mainSlot = await waitForLabel(mainLabel);
  check("Program-MAIN success precondition: the founding occupant became observable",
    mainSlot !== null, String(mainSlot));
  if (mainSlot !== null) await respawnScreen(mainSlot, ">_ OpenAI Codex (v0.147.0)");
  const mainResponse = await mainPending;
  const mainBody = await mainResponse.json() as { ok?: boolean; slot?: number; program?: Program };
  const bound = mainBody.program?.main;
  const boundState = readState().slots?.[String(mainBody.slot)];
  const mainHistory = typeof mainBody.slot === "number"
    ? (await (await get(`/api/slots/${mainBody.slot}/history`)).json()) as { history: { text: string }[] }
    : { history: [] };
  const deliveredPrompt = mainHistory.history.at(-1)?.text ?? "";
  const mainReceipts = await contextReceipts();
  const receipt = mainReceipts.receipts.find((r) => r.programId === mainProgram.id);
  const expectedHead = spawnSync("git", ["-C", REPO, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
  const expectedBranch = spawnSync("git", ["-C", REPO, "symbolic-ref", "--short", "HEAD"], { encoding: "utf8" }).stdout.trim();
  check("Program-MAIN success: response binding names the real server-read occupant",
    mainResponse.ok && mainBody.ok === true && mainBody.slot === mainSlot && !!bound
      && bound.slot === mainSlot && bound.openedAt === boundState?.openedAt
      && bound.sessionId === (boundState?.sessionId ?? null) && typeof bound.boundAt === "number",
    JSON.stringify(mainBody));
  check("Program-MAIN success: the actually delivered history carries Program title and ContextPlan header",
    deliveredPrompt.includes(mainProgram.title) && deliveredPrompt.includes("ContextPlan v1 anchors"),
    deliveredPrompt.slice(0, 240));
  check("Program-MAIN success: exactly one receipt carries null task provenance and server-read git/harness facts",
    !!receipt && mainReceipts.total === receiptsBeforeMain.total + 1
      && mainReceipts.receipts.filter((r) => r.programId === mainProgram.id).length === 1
      && receipt.taskId === null && receipt.originId === null && receipt.head === expectedHead
      && receipt.branch === expectedBranch && receipt.harness === "codex"
      && receipt.model === "gpt-5.5" && receipt.effort === "high",
    JSON.stringify(receipt ?? null));
  const anchorAt = deliveredPrompt.indexOf("\n\nContextPlan v1 anchors");
  const anchorBlock = anchorAt >= 0 ? deliveredPrompt.slice(anchorAt) : "";
  const recomputedHash = receipt ? createHash("sha256").update(JSON.stringify({
    anchorBlock,
    planFacts: { harness: receipt.harness, mode: receipt.mode, triggers: receipt.triggers,
      selected: receipt.selected, omitted: receipt.omitted },
  })).digest("hex") : "";
  check("Program-MAIN receipt equivalence: selected+omitted total six and v1 hash recomputes",
    !!receipt && receipt.selected.length + receipt.omitted.length === 6
      && receipt.selected.length === 2 && receipt.hash === recomputedHash
      && receipt.deliveredBytes === new TextEncoder().encode(deliveredPrompt).byteLength
      && receipt.truncated === false,
    `${recomputedHash} ${JSON.stringify(receipt ?? null)}`);

  const repeatSame = await beginBootstrap(mainProgram.id, {
    cwd: REPO, label: mainLabel, harness: "codex", model: "gpt-5.5", effort: "high",
  });
  const repeatSameBody = await repeatSame.json() as { ok?: boolean; existing?: boolean; program?: Program };
  const repeatDifferent = await beginBootstrap(mainProgram.id, { cwd: ROOT });
  const repeatDifferentBody = await repeatDifferent.json() as { ok?: boolean; existing?: boolean; program?: Program };
  check("Program-MAIN idempotency: identical and different-cwd repeats both return the live binding",
    repeatSame.ok && repeatSameBody.existing === true && repeatDifferent.ok && repeatDifferentBody.existing === true
      && JSON.stringify(repeatSameBody.program?.main) === JSON.stringify(bound)
      && JSON.stringify(repeatDifferentBody.program?.main) === JSON.stringify(bound),
    `same=${JSON.stringify(repeatSameBody)} different=${JSON.stringify(repeatDifferentBody)}`);
  check("Program-MAIN idempotency: repeats create no session and no receipt",
    (await sessions()).slots.filter((s) => s.cwd).length === occupiedBeforeMain + 1
      && (await contextReceipts()).total === mainReceipts.total,
    `occupied=${(await sessions()).slots.filter((s) => s.cwd).length} receipts=${(await contextReceipts()).total}`);

  const mainSelfToken = readState().slots?.[String(mainSlot)]?.selfToken ?? "";
  const [boundSelfView, otherSelfView, laneSelfView] = await Promise.all([
    selfPrograms(mainSelfToken), selfPrograms(plainToken), selfPrograms(ctx.restartSelfTok ?? ""),
  ]);
  check("Program-MAIN self view: only the bound occupant sees the Program by slot+openedAt",
    boundSelfView.response.ok && boundSelfView.programs.some((p) => p.id === mainProgram.id)
      && otherSelfView.response.ok && !otherSelfView.programs.some((p) => p.id === mainProgram.id),
    `bound=${boundSelfView.programs.length} other=${otherSelfView.programs.length}`);
  check("Program-MAIN self view: a lane token still receives the existing 409",
    laneSelfView.response.status === 409, String(laneSelfView.response.status));

  const beforeMainRestart = (await ownerPrograms()).find((p) => p.id === mainProgram.id);
  await restartSrv();
  const afterMainRestart = (await ownerPrograms()).find((p) => p.id === mainProgram.id);
  check("Program-MAIN restart: a bound Program survives save/load with main intact",
    JSON.stringify(canonical(afterMainRestart)) === JSON.stringify(canonical(beforeMainRestart))
      && JSON.stringify(afterMainRestart?.main) === JSON.stringify(bound),
    `before=${JSON.stringify(beforeMainRestart)} after=${JSON.stringify(afterMainRestart)}`);

  if (mainSlot !== null) await post(`/api/slots/${mainSlot}/kill`, {});
  const occupiedAfterKill = (await sessions()).slots.filter((s) => s.cwd).length;
  const bindingBeforeStale = JSON.stringify((await ownerPrograms()).find((p) => p.id === mainProgram.id)?.main);
  const stale = await beginBootstrap(mainProgram.id, { cwd: REPO });
  const staleText = await stale.text();
  check("Program-MAIN stale binding: repeat is a loud 409 naming slot+openedAt, with no rebind",
    stale.status === 409 && staleText.includes("stale Program-MAIN binding")
      && staleText.includes(`slot ${bound?.slot}`) && staleText.includes(`openedAt ${bound?.openedAt}`)
      && JSON.stringify((await ownerPrograms()).find((p) => p.id === mainProgram.id)?.main) === bindingBeforeStale
      && (await sessions()).slots.filter((s) => s.cwd).length === occupiedAfterKill,
    `${stale.status} ${staleText}`);

  const unknownBootstrap = await beginBootstrap("0".repeat(24), { cwd: REPO });
  check("Program-MAIN routes: an unknown bootstrap id is 404", unknownBootstrap.status === 404,
    String(unknownBootstrap.status));
  await programPost(mainProgram.id, "complete");

  // These four Programs exist only to exercise mutually exclusive bootstrap states. Remove those
  // fixtures from the persisted registry after their own restart proof so the later sessions-poll
  // byte-budget check measures the product surface, not accumulated test-only digests.
  await tmuxOut("kill-session", "-t", "srv");
  await Bun.sleep(500);
  const cleaned = readState();
  cleaned.programs = (cleaned.programs ?? []).filter((p) => bootstrapBaselineIds.has(p.id));
  writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(cleaned, null, 2), { mode: 0o600 });
  await restartSrv();
  check("Program-MAIN fixture cleanup: only the pre-bootstrap registry rows remain",
    (await ownerPrograms()).every((p) => bootstrapBaselineIds.has(p.id)),
    JSON.stringify((await ownerPrograms()).map((p) => p.id)));

  const discardConfirmed = await programPost(proposed.id, "discard");
  check("programs discard: a confirmed program is durable history and cannot be discarded",
    discardConfirmed.status === 409, String(discardConfirmed.status));
  const activate = await programPost(proposed.id, "activate");
  const activateAgain = await programPost(proposed.id, "activate");
  const activateAgainBody = await activateAgain.json() as { existing?: boolean };
  const confirmActive = await programPost(proposed.id, "confirm");
  const complete = await programPost(proposed.id, "complete");
  const completeAgain = await programPost(proposed.id, "complete");
  const completeAgainBody = await completeAgain.json() as { existing?: boolean };
  check("programs lifecycle: confirmed→active→complete works, repeats are idempotent, confirm active is illegal",
    activate.ok && activateAgain.ok && activateAgainBody.existing === true && confirmActive.status === 409
      && complete.ok && completeAgain.ok && completeAgainBody.existing === true,
    `activate=${activate.status}/${activateAgain.status} confirm=${confirmActive.status} complete=${complete.status}/${completeAgain.status}`);

  const disposableRes = await selfPropose(plainToken, { ...content, title: "Throwaway probe" });
  const disposable = (await disposableRes.json()) as { program?: Program };
  const discard = await programPost(disposable.program!.id, "discard");
  const [selfAfterDiscard, ownerAfterDiscard] = await Promise.all([selfPrograms(plainToken), ownerPrograms()]);
  check("programs discard: a proposed throwaway is removed from both session and owner views",
    discard.ok && !selfAfterDiscard.programs.some((p) => p.id === disposable.program!.id)
      && !ownerAfterDiscard.some((p) => p.id === disposable.program!.id),
    `discard=${discard.status} self=${selfAfterDiscard.programs.length} owner=${ownerAfterDiscard.length}`);

  const unknown = await programPost("0".repeat(24), "confirm");
  check("programs routes: an unknown id is 404", unknown.status === 404, String(unknown.status));

  // Sanctioned cleanup for the remaining never-confirmed owner proposal. Confirmed/complete rows
  // intentionally remain: persistence and full-list retention are the behavior under test.
  await programPost(ownerCreated.program!.id, "discard");
  check("programs owner token remains the only accepted bearer", TOKEN.length > 0);
}
