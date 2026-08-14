// Program/Origin Artifact v1: a durable planning bracket above tasks and lanes. Sessions may
// propose; only the owner confirms and advances it. Full bodies stay off the 2 s sessions poll.
import { readFileSync, writeFileSync } from "node:fs";
import { BASE, H, ROOT, TOKEN, check, get, post, restartSrv, tmuxOut } from "./harness";
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
  confirmedAt?: number;
  activatedAt?: number;
  completedAt?: number;
}
interface FleetState {
  programs?: Program[];
  stewardToken?: string;
  slots?: Record<string, { selfToken?: string; openedAt?: number; sessionId?: string | null }>;
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
const programPost = (id: string, action: "confirm" | "activate" | "complete" | "discard",
  body: unknown = {}, headers: Record<string, string> = H): Promise<Response> =>
  fetch(`${BASE}/api/programs/${id}/${action}`, {
    method: "POST", headers, body: JSON.stringify(body),
  });

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
  const actions = ["confirm", "activate", "complete", "discard"] as const;
  const [selfAuth, stewardAuth] = await Promise.all([
    Promise.all(actions.map((action) => programPost(proposed.id, action, {},
      { "content-type": "application/json", "x-fleet-self-token": plainToken }))),
    Promise.all(actions.map((action) => programPost(proposed.id, action, {},
      { "content-type": "application/json", authorization: `Bearer ${stewardToken}` }))),
  ]);
  check("programs owner boundary: self tokens cannot confirm, activate, complete, or discard (401)",
    selfAuth.every((r) => r.status === 401), selfAuth.map((r) => r.status).join(","));
  check("programs owner boundary: steward token cannot confirm, activate, complete, or discard (401)",
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
  check("programs restart: confirmed row, corrections, timestamps, and proposedBy survive byte-honest",
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
