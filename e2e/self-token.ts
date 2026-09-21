// The scoped self-scheduling credential: FLEET_SELF_TOKEN / FLEET_SELF_SLOT in EVERY session's
// spawn env (lane or not, since 2026-08-07), and what the /api/self routes will and will not
// accept it for — including both opposite scope rules (lane-only questions vs main-only exit).
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { BASE, REPO, REPO2, REPO3, ROOT, TOKEN, check, get, paneEnv, plantScreen, plogRead, post, restartSrv, stopSrv } from "./harness";
import type { Ctx } from "./ctx";
import { LOCAL_PROOF_STEPS, localProofFor, verificationProportionFor } from "../verify-proportion";
// the same table the runner reads, so this family measures the advice AND the closure it implies
import { modulePlanFor } from "../suite-modules";
import {
  FRAGMENTS_FOR, FRAGMENT_TITLES, RULEBOOK_BACKREF_HEADING, RULEBOOK_DIR, RULEBOOK_FRAGMENTS,
  fragmentFileName, renderRulebook, rulebookBody, type RulebookFragment,
} from "../rulebook";

export async function run(ctx: Ctx): Promise<void> {
  // --- Part C: scoped self-scheduling token (FLEET_SELF_TOKEN / FLEET_SELF_SLOT) ---
  const lnTok = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  // Both probes read the pane through paneEnv (harness.ts): a unique marker per probe, matched
  // line-anchored, with the send-keys retried until the marked OUTPUT line renders. That is what
  // makes them deterministic — a fixed sleep raced the shell's readiness AND the render, and a
  // bare poll could still settle on an earlier probe's line. A null answer means the pane never
  // replied at all (a harness failure), which is not the same as an empty variable.
  const laneTok = await paneEnv(`s${lnTok.slot}`, "FLEET_SELF_TOKEN");
  const laneSlot = await paneEnv(`s${lnTok.slot}`, "FLEET_SELF_SLOT");
  check("FLEET_SELF_TOKEN + FLEET_SELF_SLOT present in a lane slot's spawn env",
    /^[0-9a-f]{32}$/.test(laneTok ?? "") && Number(laneSlot) === lnTok.slot, `tok=[${laneTok}] slot=[${laneSlot}]`);
  const selfTok = laneTok ?? "";
  // The other half — and the decision this file records. A PLAIN (non-lane) slot's pane carries
  // the credential TOO. This check asserted the opposite until 2026-08-07, when the export stopped
  // being keyed on `s.worktree`: that carve-out was never a security boundary, only a withheld
  // capability. `selfToken` was already minted and persisted for every slot, and the server already
  // authenticated a plain slot's token — it answered it 409 "not a lane" where an unknown one gets
  // 401 (both pinned below). Flipping the export handed the pane a credential the routes already
  // knew. Same probe rules as the lane pair above: null (pane never answered) is a harness failure
  // and fails, so a silent probe can never be mistaken for a present token.
  const plainTok = await paneEnv("s2", "FLEET_SELF_TOKEN");
  const plainSlotVar = await paneEnv("s2", "FLEET_SELF_SLOT");
  // ...and it must be slot 2's OWN credential, not merely a well-shaped one: read the persisted row
  // and compare. openSlot mints the token and queues saveState BEFORE it awaits the pane spawn, so
  // the file can lag the route by a hair — poll for the shape, then assert the equality (a timeout
  // still yields the last value read, so a genuine mismatch fails here instead of hiding in a retry).
  let plainSelf = "";
  for (let i = 0; i < 40 && !/^[0-9a-f]{32}$/.test(plainSelf); i++) {
    try { plainSelf = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
      { slots?: Record<string, { selfToken?: string }> }).slots?.["2"]?.selfToken ?? ""; } catch { /* mid-write */ }
    if (!/^[0-9a-f]{32}$/.test(plainSelf)) await Bun.sleep(100);
  }
  check("FLEET_SELF_TOKEN + FLEET_SELF_SLOT present in a PLAIN (non-lane) slot's spawn env too",
    /^[0-9a-f]{32}$/.test(plainTok ?? "") && Number(plainSlotVar) === 2, `tok=[${plainTok}] slot=[${plainSlotVar}]`);
  check("the plain slot's exported token is that slot's OWN persisted credential, not just 32 hex",
    plainTok === plainSelf && plainSelf !== selfTok,
    `pane=[${(plainTok ?? "").slice(0, 8)}…] state=[${plainSelf.slice(0, 8)}…] lane=[${selfTok.slice(0, 8)}…]`);

  const selfAuto = (opts: { token?: string; body?: unknown }) => fetch(BASE + "/api/self/autos", {
    method: "POST",
    headers: { "content-type": "application/json", ...(opts.token !== undefined ? { "x-fleet-self-token": opts.token } : {}) },
    body: JSON.stringify(opts.body ?? { text: "x", inSec: 60 }),
  });
  const okRes = await selfAuto({ token: selfTok, body: { text: "self-scheduled check-in", inSec: 3600, slot: 2 } });
  const okJ = (await okRes.json()) as { ok?: boolean; auto?: { id: string; slot: number } };
  check("POST /api/self/autos succeeds with a valid selfToken", okRes.ok && !!okJ.auto, JSON.stringify(okJ));
  check("a spoofed `slot` field in the body is ignored — the auto lands on the token's OWN slot",
    okJ.auto?.slot === lnTok.slot, JSON.stringify(okJ.auto));
  const ownerOnSelf = await selfAuto({ token: TOKEN });
  check("the owner token does not substitute for a selfToken on this route", ownerOnSelf.status === 401);
  const wrongSelf = await selfAuto({ token: "0".repeat(32) });
  check("an unknown selfToken is rejected", wrongSelf.status === 401);
  const noSelf = await selfAuto({});
  check("a missing selfToken header is rejected", noSelf.status === 401);
  if (okJ.auto) check("delete self-scheduled auto (cleanup)", (await post(`/api/autos/${okJ.auto.id}/delete`, {})).ok);
  const selfPerp = await selfAuto({ token: selfTok, body: { text: "self immortal", inSec: 5, everySec: 10, perpetual: true } });
  check("a self-token lane cannot mint a perpetual auto (owner-only, 403)", selfPerp.status === 403, String(selfPerp.status));

  // --- THE CAPABILITY THE WIDENED EXPORT EXISTS FOR, driven end-to-end from the plain session's
  // OWN pane-exported token (not a state read): a non-lane session schedules its own check-in.
  // /api/self/autos never had a lane check — createAutoForSlot asks only for `s.cwd` — so this
  // pins that the whole feature really is one export line, and that the slot binding survives the
  // widening: the spoofed `slot` in the body must still be ignored in favour of the token's own. ---
  const plainOk = await selfAuto({ token: plainTok ?? "", body: { text: "plain session self check-in", inSec: 3600, slot: lnTok.slot } });
  const plainOkJ = (await plainOk.json()) as { ok?: boolean; auto?: { id: string; slot: number; text: string } };
  check("POST /api/self/autos succeeds for a PLAIN session with its own exported token",
    plainOk.ok && !!plainOkJ.auto, `${plainOk.status} ${JSON.stringify(plainOkJ)}`);
  check("a plain session's auto lands on ITS OWN slot — a spoofed `slot` field is still ignored",
    plainOkJ.auto?.slot === 2, JSON.stringify(plainOkJ.auto));
  const plainPerp = await selfAuto({ token: plainTok ?? "", body: { text: "plain immortal", inSec: 5, everySec: 10, perpetual: true } });
  check("a plain session cannot mint a perpetual auto either (the widening moved no guard rail)",
    plainPerp.status === 403, String(plainPerp.status));

  // --- GET /api/self: the session's own row, the read half of the family and the one route here
  // that is not about a lane. Pinned for BOTH principals — a plain session (where `lane` is null)
  // and the lane (where it names the branch), because that field is what makes the four 409s below
  // predictable instead of surprising. ---
  const selfState = (token?: string) => fetch(BASE + "/api/self", {
    headers: token !== undefined ? { "x-fleet-self-token": token } : {},
  });
  type Self = { slot: number; label: string | null; cwd: string; mission: string | null;
    awaiting: "owner" | "main" | null; lane: { repo: string; branch: string } | null;
    idleMs: number; observed: boolean; autos: { id: string; slot: number; text: string }[] };
  const pRes = await selfState(plainTok ?? "");
  const pSelf = (await pRes.json()) as Self;
  check("GET /api/self: a plain session reads its own row — its slot, its cwd, lane:null",
    pRes.ok && pSelf.slot === 2 && pSelf.cwd === process.env.HOME && pSelf.lane === null
      && typeof pSelf.idleMs === "number" && pSelf.idleMs >= 0 && typeof pSelf.observed === "boolean",
    JSON.stringify({ slot: pSelf.slot, cwd: pSelf.cwd, lane: pSelf.lane, idleMs: pSelf.idleMs, observed: pSelf.observed }));
  check("GET /api/self serves the session its OWN autos and only those",
    pSelf.autos.some((a) => a.id === plainOkJ.auto?.id) && pSelf.autos.every((a) => a.slot === 2),
    JSON.stringify(pSelf.autos.map((a) => `${a.slot}:${a.id}`)));
  const lRes = await selfState(selfTok);
  const lSelf = (await lRes.json()) as Self;
  check("GET /api/self: a lane reads the same row shape, with `lane` naming its own branch",
    lRes.ok && lSelf.slot === lnTok.slot && lSelf.cwd === lnTok.cwd && lSelf.lane?.branch === lnTok.branch,
    JSON.stringify({ slot: lSelf.slot, lane: lSelf.lane }));
  check("GET /api/self: the owner token does not substitute for a selfToken", (await selfState(TOKEN)).status === 401);
  check("GET /api/self: a missing selfToken header is rejected", (await selfState(undefined)).status === 401);
  check("GET /api/self: an unknown selfToken is rejected", (await selfState("0".repeat(32))).status === 401);
  if (plainOkJ.auto) check("delete the plain session's auto (cleanup)", (await post(`/api/autos/${plainOkJ.auto.id}/delete`, {})).ok);

  // --- THE REFUSALS ARE THE FEATURE. Widening the export handed the credential to sessions that
  // can never land, so the lane-only routes have to keep saying so — and say it as 409
  // ("recognized credential, unanswerable question"), never as 401, which would read as "not a
  // credential at all" and send a session hunting for a token it already holds. Driven with the
  // plain pane's OWN token. drift and gate are additionally pinned inside their own sections
  // below, where their fixtures live; this covers the family in one place, including the two POSTs
  // that have no section of their own. ---
  const laneOnly: [string, RequestInit][] = [
    ["/api/self/drift", { method: "GET" }],
    ["/api/self/gate", { method: "GET" }],
    ["/api/self/criterion", { method: "POST", body: JSON.stringify({ text: "a plain session has no founding task" }) }],
    ["/api/self/verify-intent", { method: "POST", body: JSON.stringify({ phase: "start" }) }],
    ["/api/self/clarifications", { method: "POST", body: JSON.stringify({ question: "a plain session is not a worker lane" }) }],
    ["/api/self/fleet-report", { method: "POST", body: JSON.stringify({ status: "complete", text: "a plain session is not a worker lane" }) }],
    ["/api/self/harness-block", { method: "POST", body: JSON.stringify({ signal: "denied", tool: "Bash", detail: "a plain session's hook asks" }) }],
  ];
  const refusals = await Promise.all(laneOnly.map(async ([path, init]) => {
    const r = await fetch(BASE + path, {
      ...init, headers: { "content-type": "application/json", "x-fleet-self-token": plainTok ?? "" },
    });
    return `${path}:${r.status}`;
  }));
  check("the lane-only self routes answer a PLAIN session 409 not-a-lane — never 401, never 200",
    refusals.every((r) => r.endsWith(":409")), refusals.join(" "));

  // --- THE HARNESS-BLOCK RAIL (.claude/hooks/lane-permission.ts → POST /api/self/harness-block). The
  // hook decides locally from two pane facts the server bakes, and reports here; these checks pin
  // both facts on a real pane and the door's three promises — one event at the receiver, a repeat
  // deduplicated into it, the third identical call escalated — plus the refusals. The lane has no
  // Program, so its receiver is the owner inbox. ---
  const laneFlag = await paneEnv(`s${lnTok.slot}`, "FLEET_SELF_LANE");
  const plainFlag = await paneEnv("s2", "FLEET_SELF_LANE");
  const laneUrl = await paneEnv(`s${lnTok.slot}`, "FLEET_SELF_URL");
  // null is "the pane never answered" and fails as itself; "" is the unset variable the plain pane must show
  check("harness-block: FLEET_SELF_LANE=1 is baked into a LANE pane and absent from a PLAIN pane (the hook's lane criterion)",
    laneFlag === "1" && plainFlag === "", `lane=[${laneFlag}] plain=[${plainFlag}]`);
  check("harness-block: FLEET_SELF_URL in a lane pane is this server's own base URL (the hook's only host source)",
    laneUrl === BASE, `pane=[${laneUrl}] base=[${BASE}]`);
  const hb = (token: string, body: unknown) => fetch(`${BASE}/api/self/harness-block`, {
    method: "POST", headers: { "content-type": "application/json", "x-fleet-self-token": token },
    body: JSON.stringify(body),
  });
  type HbEvent = { id: string; kind: string; status: string; receiverSlot: number | null; subjectSlot?: number;
    payload?: { signal?: string; detail?: string; count?: number; escalated?: boolean; key?: string } };
  const hbDetail = `for v in probe-${Date.now()}; do rm -rf $SP/$v; done`;
  const hbRows = async (): Promise<HbEvent[]> =>
    ((await (await get("/api/events")).json()) as { events?: HbEvent[] }).events
      ?.filter((e) => e.kind === "harness-block" && e.subjectSlot === lnTok.slot && e.payload?.detail === hbDetail) ?? [];
  const hbAudit = (key: string): number => {
    try {
      return readFileSync(`${ROOT}/audit.jsonl`, "utf8").split("\n")
        .filter((l) => l.includes('"event":"harness_block"') && l.includes(`key=${key}`)).length;
    } catch { return -1; }
  };
  check("harness-block precondition: no row for this probe's request exists yet", (await hbRows()).length === 0);
  const hb1 = await hb(selfTok, { signal: "denied", tool: "Bash", detail: hbDetail });
  const hb1J = (await hb1.json()) as { ok?: boolean; event?: string; deduped?: boolean; count?: number; escalated?: boolean };
  const after1 = await hbRows();
  check("harness-block: a lane's first report mints EXACTLY ONE owner-inbox event naming the lane and the request",
    hb1.status === 200 && hb1J.deduped === false && hb1J.count === 1 && after1.length === 1
      && after1[0]?.id === hb1J.event && after1[0]?.receiverSlot === null && after1[0]?.status === "inbox"
      && after1[0]?.payload?.signal === "denied" && after1[0]?.payload?.escalated === false,
    `${hb1.status} ${JSON.stringify(hb1J)} rows=${JSON.stringify(after1)}`);
  const hb2 = await hb(selfTok, { signal: "denied", tool: "Bash", detail: hbDetail });
  const hb2J = (await hb2.json()) as typeof hb1J;
  const after2 = await hbRows();
  // THE COUNTER-PROBE for the dedupe: remove it and this reads rows=2
  check("harness-block: the SAME report again is deduplicated into the open row — no second event, its count raised to 2",
    hb2.status === 200 && hb2J.deduped === true && hb2J.event === hb1J.event && after2.length === 1
      && after2[0]?.payload?.count === 2,
    `${hb2.status} ${JSON.stringify(hb2J)} rows=${after2.length} count=${after2[0]?.payload?.count}`);
  const hb3 = await hb(selfTok, { signal: "denied", tool: "Bash", detail: hbDetail });
  const hb3J = (await hb3.json()) as typeof hb1J;
  const after3 = await hbRows();
  check("harness-block: the THIRD identical report escalates — one new row flagged escalated beside the unread first",
    hb3.status === 200 && hb3J.deduped === false && hb3J.escalated === true && after3.length === 2
      && after3.filter((e) => e.payload?.escalated === true).length === 1,
    `${hb3.status} ${JSON.stringify(hb3J)} rows=${JSON.stringify(after3.map((e) => e.payload))}`);
  const hbKey = after1[0]?.payload?.key ?? "";
  check("harness-block: every report writes one harness_block audit line — three calls, three lines, none carrying the token",
    /^[0-9a-f]{16}$/.test(hbKey) && hbAudit(hbKey) === 3
      && !readFileSync(`${ROOT}/audit.jsonl`, "utf8").split("\n").some((l) => l.includes('"event":"harness_block"') && l.includes(selfTok)),
    `key=${hbKey} lines=${hbAudit(hbKey)}`);
  const hbBad = await Promise.all([
    hb("0".repeat(32), { signal: "denied", tool: "Bash", detail: hbDetail }),
    hb(selfTok, { signal: "denied", tool: "Bash", detail: hbDetail, slot: 2 }),
    hb(selfTok, { signal: "approved", tool: "Bash", detail: hbDetail }),
  ]);
  check("harness-block refuses: an unknown token 401, a foreign body field 400, an unknown signal 400 — and mints nothing",
    hbBad.map((r) => r.status).join(",") === "401,400,400" && (await hbRows()).length === 2,
    hbBad.map((r) => r.status).join(","));
  for (const e of after3) await post(`/api/events/${e.id}/ack`, {});
  check("harness-block cleanup: the owner acknowledges both rows, freeing the inbox for later sections",
    (await hbRows()).every((e) => e.status === "acknowledged"), JSON.stringify((await hbRows()).map((e) => e.status)));

  // --- THE OPPOSITE SCOPE: /retire belongs only to a plain main session, and the steward gets
  // neither door. A lane retiring would end its session and leave committed work as an orphan
  // worktree, so it keeps exactly one exit there; the steward is a standing role. Both refusals are
  // 409 with their own reason — 401 would falsely tell either caller to hunt for another credential.
  //
  // /succeed IS NO LONGER IN THAT SENTENCE. Since 2026-09-12 a lane has its own succession rail
  // (server.ts#succeedLane, proved end to end in e2e/lanes-lifecycle.ts), so what is checked here is
  // that the lane REACHES it: the refusal it gets for a `carry` is its own rail's — the handoff
  // report is the one handover channel — and no longer "a lane lands". Driven with `carry` on
  // purpose: it is the one shape of this call that proves the rail was entered while spawning
  // nothing, so the lane this file goes on using below is still the session it was. ---
  const successionPost = (path: "succeed" | "retire", token: string, body: unknown = {}) =>
    fetch(`${BASE}/api/self/${path}`, {
      method: "POST", headers: { "content-type": "application/json", "x-fleet-self-token": token },
      body: JSON.stringify(body),
    });
  const laneSuccession = await Promise.all([
    successionPost("succeed", selfTok, { carry: "a lane has no second handover channel" }),
    successionPost("retire", selfTok),
  ]);
  const laneSuccessionText = await Promise.all(laneSuccession.map((r) => r.text()));
  check("a LANE is refused 409 by both doors — /retire because it lands, /succeed only because its own rail takes no carry",
    laneSuccession.every((r) => r.status === 409)
      && (laneSuccessionText[0] ?? "").includes("takes no carry")
      && (laneSuccessionText[1] ?? "").includes("a lane lands"),
    laneSuccession.map((r, i) => `${r.status}:${laneSuccessionText[i]}`).join(" | "));

  const oldPlainLabel = pSelf.label ?? "";
  check("succession scope setup: the plain slot can be labelled as the ⚙ steward",
    (await post("/api/slots/2/rename", { label: "⚙ steward" })).ok);
  const stewardSuccession = await Promise.all([
    successionPost("succeed", plainTok ?? ""), successionPost("retire", plainTok ?? ""),
  ]);
  const stewardSuccessionText = await Promise.all(stewardSuccession.map((r) => r.text()));
  check("the ⚙ steward is refused 409 by both /api/self/succeed and /retire — the standing role never migrates",
    stewardSuccession.every((r) => r.status === 409)
      && stewardSuccessionText.every((t) => t.includes("standing role")),
    stewardSuccession.map((r, i) => `${r.status}:${stewardSuccessionText[i]}`).join(" | "));
  check("succession scope cleanup: the plain slot's prior label is restored",
    (await post("/api/slots/2/rename", { label: oldPlainLabel })).ok);

  // --- THE LANE BATON TELLS THE TRUTH (bc1d7866 + MAIN verdict 2026-09-18, comment 7df98db9). ---
  // One codex-harness lane, planted with its row, its Program and a succession counter at 4 of 5,
  // proves in ONE real succession what the brief says now: the reason from the handoff report, the
  // MAIN's verdict on the row verbatim, no succeed hint to a codex pane — and then the deckel the
  // NEXT session hits. The report-ticket refusals ride the same lane BEFORE any succession and
  // cost no pane at all: no report yet → 409; a newest `complete` report → 409 (the 89-loop's own
  // shape, by verdict (a)); only a `handoff` report opens the door.
  {
    const stateFile = ():
      { slots?: Record<string, { selfToken?: string; openedAt?: number; taskId?: string | null;
        originId?: string | null; programId?: string | null; harness?: string | null;
        laneSuccessions?: number; worktree?: { branch?: string } | null }>;
        tasks?: { id: string; status: string; slot: number | null; note?: string | null }[];
        programs?: { id: string }[];
        fleetReports?: { id: string }[];
        attentionRequests?: { id: string }[];
        laneSucceedCounts?: Record<string, number> } =>
      JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8"));
    const laneSelfPost = (token: string, path: string, body: unknown): Promise<Response> =>
      fetch(BASE + path, { method: "POST",
        headers: { "content-type": "application/json", "x-fleet-self-token": token },
        body: JSON.stringify(body) });

    const truthLn = (await (await post("/api/lanes", { repo: REPO })).json()) as
      { ok?: boolean; slot?: number; cwd?: string; branch?: string };
    const truthSlot = truthLn.slot ?? 0;
    const truthCwd = truthLn.cwd ?? "";
    const truthBranch = truthLn.branch ?? "";
    const truthRowText = "BATON-TRUTH FIXTURE: the founding row a successor must read verbatim";
    const truthTask = (await (await post("/api/tasks", { text: truthRowText, queue: false })).json()) as
      { task?: { id?: string } };
    const truthTaskId = truthTask.task?.id ?? "";
    const truthReject = "BATON VERDICT: cut one rejected — the parser must read the spec, not the old diff.";
    const truthHandoffText = "BATON TRUTH HANDOFF: verdict named above; open is the parser, next step is its spec.";
    check("baton truth setup: a codex lane and its founding row exist",
      truthLn.ok === true && truthSlot > 0 && truthCwd !== "" && truthTaskId !== "", JSON.stringify(truthLn));
    writeFileSync(`${truthCwd}/baton-truth.txt`, "cut one\n");
    spawnSync("git", ["-C", truthCwd, "add", "baton-truth.txt"]);
    spawnSync("git", ["-C", truthCwd, "commit", "-qm", "baton-truth: cut one"]);
    // planted exactly as the baton fixture plants its row: no owner route binds an EXISTING lane
    // to a row, and this block's subject is the handover, not the dispatch that would precede it.
    // The counter rides the same cut at 4 of 5, so the ONE live succession below lands the row on
    // its cap and the heir's attempt is the 409.
    await stopSrv();
    const truthProgramId = "ba7018".padEnd(24, "0");
    const truthPlant = stateFile();
    const truthPlantedAt = Date.now();
    // the SAME full row the baton fixture plants: an active Program is a shaped record, and a
    // minimal one would load as absent — the reports below would silently fall to owner-inbox.
    truthPlant.programs = [...(truthPlant.programs ?? []), {
      id: truthProgramId, title: "Baton truth fixture", intent: "Prove the succession brief tells the truth",
      successCriterion: "The successor brief names reason, verdict and no codex succeed hint",
      nonGoals: [], decisions: [], evidence: [], openQuestions: [], status: "active",
      createdAt: truthPlantedAt - 1000, proposedBy: { kind: "owner" },
      confirmedAt: truthPlantedAt - 900, activatedAt: truthPlantedAt - 800,
    } as unknown as { id: string }];
    const truthSlotRow = truthPlant.slots?.[String(truthSlot)];
    if (truthSlotRow) { truthSlotRow.taskId = truthTaskId; truthSlotRow.originId = truthTaskId;
      truthSlotRow.programId = truthProgramId; truthSlotRow.harness = "codex"; }
    const truthRow = truthPlant.tasks?.find((t) => t.id === truthTaskId);
    if (truthRow) { truthRow.status = "sent"; truthRow.slot = truthSlot; }
    truthPlant.laneSucceedCounts = { ...(truthPlant.laneSucceedCounts ?? {}), [truthTaskId]: 4 };
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(truthPlant, null, 2), { mode: 0o600 });
    // the lid is OFF by default since 2026-09-21 (owner: soft signal only) — this block proves the
    // emergency brake still holds when an operator sets it, so it boots with the brake at 5; the
    // unplant restart below boots without it again
    await restartSrv({ FLEET_LANE_SUCCEED_MAX: "5" });
    const truthTok = stateFile().slots?.[String(truthSlot)]?.selfToken ?? "";
    check("baton truth setup: the lane carries row, Program, codex harness and a succession counter at 4",
      /^[0-9a-f]{32}$/.test(truthTok)
        && stateFile().slots?.[String(truthSlot)]?.originId === truthTaskId
        && stateFile().slots?.[String(truthSlot)]?.harness === "codex"
        && stateFile().laneSucceedCounts?.[truthTaskId] === 4,
      JSON.stringify(stateFile().slots?.[String(truthSlot)] ?? {}).slice(0, 200));

    // THE TICKET GATE, both halves (verdict (a)): no report yet, then a newest `complete`.
    const noReportYet = await laneSelfPost(truthTok, "/api/self/succeed", {});
    check("baton truth: a clean lane with no report is refused 409 — the handoff report is the ticket",
      noReportYet.status === 409 && (await noReportYet.text()).includes("filed no fleet report"),
      String(noReportYet.status));
    const completeRes = await laneSelfPost(truthTok, "/api/self/fleet-report",
      { status: "complete", text: "BATON TRUTH: cut one done (this verdict will be rejected)." });
    const completeId = ((await completeRes.clone().json().catch(() => ({}))) as
      { report?: { id?: string } }).report?.id ?? "";
    check("baton truth setup: the complete report is filed and the owner rejects it with a named reason",
      completeRes.ok && completeId !== ""
        && (await post(`/api/fleet-report/${completeId}/reject`, { reason: truthReject })).ok,
      `${completeRes.status} report=${completeId}`);
    const completeSucceed = await laneSelfPost(truthTok, "/api/self/succeed", {});
    const completeSucceedText = await completeSucceed.text();
    check("baton truth: the 89-loop's own shape — succeed after a newest `complete` — is a 409 naming the status",
      completeSucceed.status === 409 && completeSucceedText.includes("status complete, not handoff"),
      `${completeSucceed.status} ${completeSucceedText.slice(0, 200)}`);

    // THE RULEBOOK ORDER, then the baton passes: handoff report, succeed. The codex successor's
    // pane cannot pass readiness until its harness screen is planted — the same dance the
    // Program-MAIN fixtures run: start the succeed, watch for the new occupant, plant, await.
    const truthHandoffRes = await laneSelfPost(truthTok, "/api/self/fleet-report",
      { status: "handoff", text: truthHandoffText });
    const promptsBefore = (await plogRead()).filter((e) => e.slot === truthSlot).length;
    const plantedOpenedAt = stateFile().slots?.[String(truthSlot)]?.openedAt ?? 0;
    const truthSucceedPending = laneSelfPost(truthTok, "/api/self/succeed", {});
    let heirSeen = false;
    for (let i = 0; i < 60 && !heirSeen; i++) {
      await Bun.sleep(150);
      const nowAt = stateFile().slots?.[String(truthSlot)]?.openedAt ?? 0;
      if (nowAt !== plantedOpenedAt && nowAt > 0) heirSeen = true;
    }
    if (heirSeen) { await Bun.sleep(250); await plantScreen(truthSlot, ">_ OpenAI Codex (v0.147.0)", "baton truth fixture"); }
    const truthSucceed = await truthSucceedPending;
    const truthSucceedBody = (await truthSucceed.json().catch(() => ({}))) as
      { ok?: boolean; successions?: number; session?: number; delivered?: boolean; error?: string };
    check("baton truth: handoff report then succeed — the baton passes and counts the succession",
      truthHandoffRes.ok && truthSucceed.ok && truthSucceedBody.successions === 1
        && truthSucceedBody.session === 2 && truthSucceedBody.delivered === true,
      `${truthSucceed.status} ${JSON.stringify(truthSucceedBody)}`);
    const counterAfter = stateFile().laneSucceedCounts?.[truthTaskId];
    const heirTok = stateFile().slots?.[String(truthSlot)]?.selfToken ?? "";
    const heirPrompts = (await plogRead()).filter((e) => e.slot === truthSlot);
    const heirBrief = heirPrompts.length > promptsBefore ? heirPrompts[heirPrompts.length - 1]!.text : "";
    check("baton truth: the live succession incremented the row's counter to the cap",
      counterAfter === 5, String(counterAfter));
    check("baton truth: the successor's brief carries the row verbatim, the MAIN verdict VERBATIM, and no fixed truth about context or order",
      heirBrief.includes(truthRowText) && heirBrief.includes(truthReject)
        && heirBrief.includes("Die letzte Entscheidung zu dieser Zeile")
        && heirBrief.includes("Deine Vorgängerin hat übergeben — Grund laut handoff-Report")
        && !heirBrief.includes("weil ihr Kontext voll lief") && !heirBrief.includes("Der Auftrag ist unverändert"),
      heirBrief.slice(0, 500));
    check("baton truth: the codex successor's footer keeps the lane-exit frame and carries NO succeed hint",
      heirBrief.includes("HOW THIS LANE ENDS") && !heirBrief.includes("POST /api/self/succeed"),
      `succeed-mentions=${(heirBrief.match(/succeed/g) ?? []).length}`);

    // THE DECKEL (verdict (b)): the counter is at 5, so the heir's baton is refused even though a
    // fresh handoff report makes it ticket-clean — the cap precedes the ticket by design — and
    // EXACTLY ONE owner attention is minted, however often the lane knocks.
    const heirHandoff = await laneSelfPost(heirTok, "/api/self/fleet-report",
      { status: "handoff", text: "BATON TRUTH: the heir is done; the row is at its cap." });
    const heirSucceed = await laneSelfPost(heirTok, "/api/self/succeed", {});
    const heirSucceedText = await heirSucceed.text();
    check("baton truth: at the cap the heir's succeed is a 409 naming the origin, the cap and the needs-main way out",
      heirHandoff.ok && heirSucceed.status === 409 && heirSucceedText.includes(truthTaskId)
        && heirSucceedText.includes("FLEET_LANE_SUCCEED_MAX") && heirSucceedText.includes("needs-main"),
      `${heirSucceed.status} ${heirSucceedText.slice(0, 240)}`);
    const openCapAttention = async (): Promise<{ status?: string; text?: string }[]> =>
      ((await (await get("/api/attention")).json()) as
        { requests?: { status?: string; text?: string }[] }).requests ?? [];
    const capAttentionCount = (await openCapAttention())
      .filter((a) => a.status === "open" && (a.text ?? "").includes("succession cap")).length;
    const heirSucceedAgain = await laneSelfPost(heirTok, "/api/self/succeed", {});
    check("baton truth: repeated attempts over the cap mint EXACTLY ONE owner attention",
      capAttentionCount === 1 && heirSucceedAgain.status === 409
        && (await openCapAttention()).filter((a) => a.status === "open"
          && (a.text ?? "").includes("succession cap")).length === 1,
      `first=${capAttentionCount} again=${heirSucceedAgain.status}`);

    // THE COUNTER OUTLIVES A REQUEUE (verdict (b)): killing the slot detaches the row back to
    // `pending` through the real requeue path — and the per-row count must still be 5.
    await post(`/api/slots/${truthSlot}/kill`, {});
    const requeuedRow = stateFile().tasks?.find((t) => t.id === truthTaskId);
    check("baton truth: a requeue does not reset the counter — the row is pending again, the count stands",
      requeuedRow?.status === "pending" && stateFile().laneSucceedCounts?.[truthTaskId] === 5,
      `row=${requeuedRow?.status} count=${stateFile().laneSucceedCounts?.[truthTaskId]}`);

    // …AND THE PLANTED RECORDS GO BACK OUT THE WAY THEY CAME IN: Program, the lane's reports, the
    // cap attention and the counter key. A fixture that makes a later section's budget check fail
    // is a fixture that has to be un-planted, not a budget that has to be raised.
    spawnSync("git", ["-C", REPO, "worktree", "remove", "--force", truthCwd]);
    await post(`/api/tasks/${truthTaskId}/delete`, {});
    await stopSrv();
    const unplant = stateFile();
    unplant.programs = (unplant.programs ?? []).filter((p) => p.id !== truthProgramId);
    unplant.fleetReports = (unplant.fleetReports ?? []).filter((r) =>
      (r as { provenance?: { taskId?: string | null } }).provenance?.taskId !== truthTaskId);
    unplant.attentionRequests = (unplant.attentionRequests ?? [])
      .filter((a) => !((a as { text?: string }).text ?? "").includes("succession cap"));
    if (unplant.laneSucceedCounts) delete unplant.laneSucceedCounts[truthTaskId];
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(unplant, null, 2), { mode: 0o600 });
    await restartSrv();
  }

  // --- GET /api/self/drift: the lane-facing read of "how far has the integration branch moved
  // past me". Committed state only — the probe (`git merge-tree`) simulates a merge, and `dirty`
  // is the flag that says uncommitted work was not assessed. ---
  const selfDrift = (token?: string) => fetch(BASE + "/api/self/drift", {
    headers: token !== undefined ? { "x-fleet-self-token": token } : {},
  });
  type Drift = { branch: string; main: string; behind: number; dirty: boolean; wouldConflict: boolean | null;
    conflictFiles: string[]; overlap: string[]; otherLanes: { branch: string; files: string[] }[] };
  const d0Res = await selfDrift(selfTok);
  const d0 = (await d0Res.json()) as Drift;
  check("GET /api/self/drift: a fresh lane is current — behind 0, no conflict, clean tree",
    d0Res.ok && d0.branch === lnTok.branch && d0.behind === 0 && d0.wouldConflict === false
      && d0.dirty === false && d0.conflictFiles.length === 0 && d0.overlap.length === 0,
    JSON.stringify(d0));
  check("drift: the owner token does not substitute for a selfToken", (await selfDrift(TOKEN)).status === 401);
  check("drift: a missing selfToken header is rejected", (await selfDrift(undefined)).status === 401);
  // a plain session's selfToken is a RECOGNIZED credential asking an unanswerable question — the
  // route must say so (409, "not a lane"), never collapse it into 401's "not a credential at all".
  // `plainSelf` is slot 2's persisted credential, read and proved equal to its pane's export above.
  const plainRes = await selfDrift(plainSelf);
  check("drift: a plain (non-lane) slot's selfToken answers 409 not-a-lane, never a generic 401",
    plainRes.status === 409, String(plainRes.status));
  // main moves harmlessly: behind counts it, nothing conflicts, nothing overlaps
  writeFileSync(`${REPO}/drift-main.txt`, "main moved\n");
  spawnSync("git", ["-C", REPO, "add", "drift-main.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "drift: main gains a harmless file"]);
  const d1 = (await (await selfDrift(selfTok)).json()) as Drift;
  check("drift: a harmless commit on main reads behind:1, wouldConflict:false, no overlap",
    d1.behind === 1 && d1.wouldConflict === false && d1.overlap.length === 0,
    JSON.stringify({ behind: d1.behind, wc: d1.wouldConflict, overlap: d1.overlap }));
  // both sides now add the SAME file with different content (add/add conflict): the probe must
  // flip to wouldConflict:true and NAME the file, and the overlap list must carry it too
  writeFileSync(`${lnTok.cwd}/drift-clash.txt`, "lane version\n");
  spawnSync("git", ["-C", lnTok.cwd, "add", "drift-clash.txt"]);
  spawnSync("git", ["-C", lnTok.cwd, "commit", "-qm", "drift: lane side of the clash"]);
  writeFileSync(`${REPO}/drift-clash.txt`, "main version\n");
  spawnSync("git", ["-C", REPO, "add", "drift-clash.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "drift: main side of the clash"]);
  const d2 = (await (await selfDrift(selfTok)).json()) as Drift;
  check("drift: both sides touching the same file reads wouldConflict:true and names it",
    d2.behind === 2 && d2.wouldConflict === true && d2.conflictFiles.includes("drift-clash.txt")
      && d2.overlap.includes("drift-clash.txt"),
    JSON.stringify({ behind: d2.behind, wc: d2.wouldConflict, cf: d2.conflictFiles, overlap: d2.overlap }));
  // uncommitted work is outside the probe's reach — `dirty` is the flag that says so
  writeFileSync(`${lnTok.cwd}/drift-dirty.txt`, "uncommitted\n");
  const d3 = (await (await selfDrift(selfTok)).json()) as Drift;
  check("drift: uncommitted lane work reads dirty:true (the probe assesses committed work only)",
    d3.dirty === true, JSON.stringify({ dirty: d3.dirty }));
  rmSync(`${lnTok.cwd}/drift-dirty.txt`);
  // the cross-lane half: another open lane's committed in-flight files are visible — the one part
  // of the payload the session could not read more conveniently than the server
  const lnOther = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  writeFileSync(`${lnOther.cwd}/drift-other.txt`, "other lane work\n");
  spawnSync("git", ["-C", lnOther.cwd, "add", "drift-other.txt"]);
  spawnSync("git", ["-C", lnOther.cwd, "commit", "-qm", "drift: other lane in-flight work"]);
  const d4 = (await (await selfDrift(selfTok)).json()) as Drift;
  const otherEntry = d4.otherLanes.find((l) => l.branch === lnOther.branch);
  check("drift: another open lane's committed in-flight files are listed under otherLanes",
    !!otherEntry && otherEntry.files.includes("drift-other.txt"), JSON.stringify(d4.otherLanes));

  // --- the drift AUDIT TRAIL (autonomy map §11.3 step A). The route used to write nothing, so
  // "does a lane ever check its drift, and how early in its life?" had no answer anywhere. What is
  // pinned here is what makes that question computable: one event per FRESH answer, the branch in
  // the detail as the join key to lane-outcomes (slot ids are recycled, branches are not), and the
  // dedupe — a re-ask with no ref moved must stay silent, or a polling lane would rotate this log's
  // own history off the end. The six reads above are the fixture: d0/d1/d2 each moved a ref (three
  // events), d3 only dirtied the tree and d4 only moved ANOTHER lane's branch (no event), and the
  // 409/401 attempts have no lane answer to book at all.
  type Ev = { ts: number; event: string; slot?: number; detail?: string };
  // /api/audit serves NEWEST FIRST (it ts-sorts descending, server.ts) — these assertions and the
  // §11.2 metric both read forwards in time, so sort back to chronological here rather than let a
  // positional check quietly encode the route's display order.
  const driftEvents = async (): Promise<Ev[]> =>
    ((await (await get("/api/audit?limit=1000")).json()) as { events: Ev[] }).events
      .filter((e) => e.event === "self_drift" && (e.detail ?? "").startsWith(`${lnTok.branch} `))
      .sort((a, b) => a.ts - b.ts);
  // audit() is fire-and-forget on a shared chain: poll up to the expected count, THEN settle and
  // re-read, so "exactly three" cannot pass on a fourth event that is merely still in flight.
  let evs = await driftEvents();
  for (let i = 0; i < 40 && evs.length < 3; i++) { await Bun.sleep(100); evs = await driftEvents(); }
  await Bun.sleep(300);
  evs = await driftEvents();
  check("drift audit: exactly one event per FRESH answer — the three ref-moving reads, no more",
    evs.length === 3, JSON.stringify(evs.map((e) => e.detail)));
  check("drift audit: a re-ask with no ref moved books nothing (dirty-only and other-lane reads)",
    evs.filter((e) => (e.detail ?? "").includes("dirty:true")).length === 0, JSON.stringify(evs.map((e) => e.detail)));
  check("drift audit: the detail carries branch + the verdict fields the §11.2 metric joins on",
    evs[0]?.detail === `${lnTok.branch} behind:0 conflict:false dirty:false`
      && evs[1]?.detail === `${lnTok.branch} behind:1 conflict:false dirty:false`
      && evs[2]?.detail === `${lnTok.branch} behind:2 conflict:true dirty:false`,
    JSON.stringify(evs.map((e) => e.detail)));
  check("drift audit: the event is attributed to the asking lane's own slot",
    evs.every((e) => e.slot === lnTok.slot), JSON.stringify(evs.map((e) => e.slot)));

  // A REBASED lane reports its OWN contribution — never the history main gained underneath it.
  // The surface used to be anchored on `worktree.baseSha`, the immutable FORK commit, which is
  // PROVENANCE and not an operative comparison base: once a lane is rebased onto a moved
  // integration branch, everything main gained since the fork sits inside the lane's own history
  // and got reported as that lane's in-flight work. Three-dot does not heal it — the old fork
  // stays an ancestor of the rebased tip, so `base...HEAD` degenerates to `base..HEAD` (measured
  // on the lane this was found on: both forms returned the same 37 files, against a true
  // contribution of one). Not a display wart: on 2026-08-06 two lanes read a phantom 37-file
  // surface off this very payload and routed their work around files nobody was holding.
  // Deliberately placed AFTER the audit-trail section: this fixture moves a ref, so the drift read
  // below books a fourth event and the "exactly three" count above is about the d0..d4 fixture.
  const intBr = spawnSync("git", ["-C", REPO, "rev-parse", "--abbrev-ref", "HEAD"]).stdout.toString().trim();
  writeFileSync(`${REPO}/drift-rebase-main.txt`, "main gained this after the other lane forked\n");
  spawnSync("git", ["-C", REPO, "add", "drift-rebase-main.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "drift: main moves under the other lane"]);
  const reb = spawnSync("git", ["-C", lnOther.cwd, "rebase", intBr]);
  check("drift fixture: the other lane rebases cleanly onto the moved integration branch",
    reb.status === 0, `${reb.status} ${reb.stderr.toString().slice(0, 200)}`);
  const d5 = (await (await selfDrift(selfTok)).json()) as Drift;
  const rebEntry = d5.otherLanes.find((l) => l.branch === lnOther.branch);
  check("drift: a REBASED lane reports only its own contribution, not what main gained under it",
    !!rebEntry && rebEntry.files.length === 1 && rebEntry.files[0] === "drift-other.txt",
    JSON.stringify(rebEntry ?? null));
  check("drift cleanup: the second lane is torn down", (await post(`/api/slots/${lnOther.slot}/kill`, {})).ok);

  // --- GET /api/self/gate: the live land-gate facts, served from the server's own process env.
  // The env pass-throughs (verify/cleanReview/…) are pinned by their own suites; what is tested
  // HARD here is this route's own logic — auth, the one-scope rule, and the rulebook compare. ---
  check("local proof: docs-only asks for exactly install,pins and no isolated preview",
    JSON.stringify(localProofFor(["docs/guide.md"]))
      === JSON.stringify({ steps: ["install", "pins"], isolatedPreview: false,
        classifiedAs: { "docs/guide.md": "docs-or-prose" } }));
  check("local proof: src-only asks for install,pins,tsc,build",
    JSON.stringify(localProofFor(["src/client.ts"]).steps) === JSON.stringify(["install", "pins", "tsc", "build"]));
  check("local proof: e2e work asks for the full chain and isolated preview",
    JSON.stringify(localProofFor(["e2e/self-token.ts"]).steps) === JSON.stringify(LOCAL_PROOF_STEPS)
      && localProofFor(["e2e/self-token.ts"]).isolatedPreview === true);
  check("local proof: server.ts asks for the full chain and merge/land self-assessment",
    JSON.stringify(localProofFor(["server.ts"]).steps) === JSON.stringify(LOCAL_PROOF_STEPS)
      && localProofFor(["server.ts"]).isolatedPreview === "self-assess");
  check("local proof: an empty diff fails closed to the full chain",
    JSON.stringify(localProofFor([])) === JSON.stringify({
      steps: LOCAL_PROOF_STEPS, isolatedPreview: "self-assess", classifiedAs: {},
    }));
  // `server/` is classified BEFORE the first module moves there (plan-2026-08-31 §P2). Without the
  // prefix a P4 module falls to DEFAULT_RULE: the same seven steps, but labelled
  // "conservative-default" — "we have never seen this path" said about a file the plan named, and
  // the lane's proof would be right for the wrong reason. The docs path rides in the SAME call as
  // the counter-probe: this must be a new branch, not a widened one, and one server/ file must
  // still take `proportional` off an otherwise docs-only diff.
  const serverModuleProof = verificationProportionFor(["server/persist.ts", "docs/x.md"]);
  check("local proof: a server/ module is server-or-host-runtime — and the docs path beside it is untouched",
    serverModuleProof.classifiedAs["server/persist.ts"] === "server-or-host-runtime"
      && serverModuleProof.classifiedAs["docs/x.md"] === "docs-or-prose"
      && serverModuleProof.proportional === false
      && serverModuleProof.isolatedPreview === "self-assess"
      && JSON.stringify(serverModuleProof.steps) === JSON.stringify(LOCAL_PROOF_STEPS),
    JSON.stringify(serverModuleProof));
  // WHICH MODULES the footprint is about — the narrowing a lane may give FLEET_E2E_MODULES. Three
  // arms in one call each, because the rule is a CONJUNCTION and the interesting half is the
  // silence: a footprint the map cannot place entirely narrows to nothing, and the field is then
  // ABSENT rather than an empty list (an empty list reads as "no modules are involved").
  const modProof = localProofFor(["e2e/tasks.ts", "e2e/slots.ts"]);
  const mixedProof = localProofFor(["e2e/tasks.ts", "server.ts"]);
  const plumbingProof = localProofFor(["e2e/harness.ts"]);
  check("local proof: an all-check-module footprint names its modules, and one unplaceable file names none",
    JSON.stringify(modProof.modules) === JSON.stringify(["slots", "tasks"])
      && mixedProof.modules === undefined && plumbingProof.modules === undefined
      && localProofFor(["docs/guide.md"]).modules === undefined,
    JSON.stringify({ e2eOnly: modProof.modules, mixed: mixedProof.modules, plumbing: plumbingProof.modules }));
  // …and the closure the RUNNER will take from that advice, from the same table the runner reads:
  // a lane handed ["tasks"] runs four modules, not one, and is told which and why.
  const tasksPlan = modulePlanFor(["tasks"]);
  check("local proof: the module advice closes over its fixtures — tasks pulls self-token and outcomes, with a reason each",
    JSON.stringify(tasksPlan.run) === JSON.stringify(["self-token", "outcomes", "tasks"])
      && tasksPlan.pulled.length === 2 && tasksPlan.pulled.every((p) => p.why.includes("reads"))
      && tasksPlan.skipped.every((sk) => sk.why.length > 20) && tasksPlan.unresolved.length === 0,
    JSON.stringify({ run: tasksPlan.run, pulled: tasksPlan.pulled }));
  const conservativeProof = localProofFor(["docs/guide.md", "new-top-level.unknown"]);
  check("local proof: one unknown file flips an otherwise docs-only diff to the conservative full default",
    JSON.stringify(conservativeProof.steps) === JSON.stringify(LOCAL_PROOF_STEPS)
      && conservativeProof.isolatedPreview === "self-assess"
      && conservativeProof.classifiedAs["new-top-level.unknown"] === "conservative-default",
    JSON.stringify(conservativeProof));

  const selfGate = (token?: string) => fetch(BASE + "/api/self/gate", {
    headers: token !== undefined ? { "x-fleet-self-token": token } : {},
  });
  type Gate = { verify: { cmd: string; timeoutMs: number; waitMs: number; skipExit: number } | null; cleanReview: string;
    autoReview: { tickMs: number; idleMs: number } | null; postlandAudit: boolean;
    mergeRepairRounds: number; rulebookDrifted: boolean | null;
    suiteLock: { pid: number | null; alive: boolean | null; heldMs: number; state: string } | null;
    localProof: ReturnType<typeof localProofFor> | null };
  const g0Res = await selfGate(selfTok);
  const g0 = (await g0Res.json()) as Gate;
  const proofBase = spawnSync("git", ["-C", lnTok.cwd, "merge-base", intBr, "HEAD"]).stdout.toString().trim();
  const proofFiles = spawnSync("git", ["-C", lnTok.cwd, "diff", "--name-only", `${proofBase}...HEAD`])
    .stdout.toString().trim().split("\n").filter(Boolean).sort();
  check("GET /api/self/gate: a real lane receives localProof classifying every file in its committed footprint",
    g0Res.ok && g0.localProof !== null
      && JSON.stringify(Object.keys(g0.localProof.classifiedAs).sort()) === JSON.stringify(proofFiles)
      && proofFiles.every((file) => typeof g0.localProof?.classifiedAs[file] === "string"),
    JSON.stringify({ files: proofFiles, localProof: g0.localProof }));
  // …and the SERVED module advice is the same function's answer over the same footprint. Asserted as
  // agreement rather than as a literal: this lane's footprint is the fixture repo's own files, so
  // the honest answer here is the absent field — and a route that invented one would fail this.
  check("GET /api/self/gate: the served localProof.modules is what the classifier answers for that same footprint",
    g0Res.ok && g0.localProof !== null
      && JSON.stringify(g0.localProof.modules) === JSON.stringify(localProofFor(proofFiles).modules),
    JSON.stringify({ served: g0.localProof?.modules, pure: localProofFor(proofFiles).modules, files: proofFiles }));
  // --- suiteLock, the machine-busy fact (autonomy verbs, Verb 1): the one wait a lane's verify
  // actually hangs on, now named by the route that names the judge. Pinned against DISK truth
  // rather than an assumed harness shape: under a wrapper run the stage mutex is held by our own
  // wrapper for the whole run, a standalone `bun fleet-e2e.ts` sees it free — the assertion is
  // AGREEMENT with the lock dir, so it is deterministic in both forms instead of correct in one.
  const lockDir = process.env.FLEET_SUITE_LOCK ?? "/tmp/fleet-e2e.lock";
  let lockDirExists = false; let diskPid: number | null = null;
  try { lockDirExists = statSync(lockDir).isDirectory(); } catch { lockDirExists = false; }
  if (lockDirExists) {
    try {
      const raw = readFileSync(`${lockDir}/pid`, "utf8").trim();
      diskPid = /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
    } catch { diskPid = null; }
  }
  check("gate: suiteLock agrees with the lock dir on disk (held by our wrapper, parked, or free)",
    !lockDirExists ? g0.suiteLock === null
      : diskPid === null ? g0.suiteLock?.state === "parked"
      : g0.suiteLock?.pid === diskPid && g0.suiteLock.alive === true
        && (g0.suiteLock.state === "held" || g0.suiteLock.state === "overdue"),
    JSON.stringify({ disk: { exists: lockDirExists, pid: diskPid }, route: g0.suiteLock }));
  // BOTH budgets, because one of them is what a lane's verify actually hangs on: `timeoutMs` is
  // the work budget and `waitMs` the queueing one, and a route that named only the first would
  // still be telling a lane that a 300s gate is a 300s gate when 255s of it can be somebody else's
  // suite (VERIFY_WAIT_MS in server.ts, the 2026-08-06 incident).
  check("GET /api/self/gate: full shape, skipExit pinned to 42, no rulebook on either side reads null",
    g0Res.ok && (g0.verify === null || (typeof g0.verify.cmd === "string" && g0.verify.skipExit === 42
      && g0.verify.timeoutMs > 0 && g0.verify.waitMs > 0))
      && ["off", "gate", "shadow"].includes(g0.cleanReview)
      && (g0.autoReview === null || g0.autoReview.tickMs > 0)
      && typeof g0.postlandAudit === "boolean"
      && g0.mergeRepairRounds >= 0 && g0.mergeRepairRounds <= 3
      && g0.rulebookDrifted === null,
    JSON.stringify(g0));
  check("gate: the owner token does not substitute for a selfToken", (await selfGate(TOKEN)).status === 401);
  check("gate: a missing selfToken header is rejected", (await selfGate(undefined)).status === 401);
  check("gate: a plain (non-lane) slot's selfToken answers 409 not-a-lane, never a generic 401",
    (await selfGate(plainSelf)).status === 409, "reuses the drift fixture's plain-slot token");

  // A pre-baseSha lane with an unresolvable recorded base is an honest null, not `steps: []`.
  // Build that old-state shape without patching fleet.json: an orphan worktree has no merge-base,
  // so attach records no baseSha; renaming the primary branch then breaks its recorded base ref.
  const brokenRepo = `${ROOT}/local-proof-broken-repo`;
  const brokenTree = `${ROOT}/local-proof-broken-tree`;
  rmSync(brokenRepo, { recursive: true, force: true });
  rmSync(brokenTree, { recursive: true, force: true });
  mkdirSync(brokenRepo, { recursive: true });
  spawnSync("git", ["-C", brokenRepo, "init", "-q", "-b", "main"]);
  spawnSync("git", ["-C", brokenRepo, "config", "user.email", "e2e@example.invalid"]);
  spawnSync("git", ["-C", brokenRepo, "config", "user.name", "Fleet E2E"]);
  writeFileSync(`${brokenRepo}/seed.txt`, "seed\n");
  // The sentinel is what keeps this fixture ABOUT the unanswerable diff. Since 2026-09-16 the repo
  // lock is asked FIRST (laneLocalProof), so without `fleet-e2e.ts` this lane would take the
  // foreign-repo branch and answer `steps: []` + note — never reaching the git read whose failure
  // is the thing under test. A fleet-shaped repo with a broken base is the only shape that proves
  // null is still null, and the two answers must stay distinguishable: `[]` says "this chain does
  // not run here", `null` says "it does, and Fleet could not work out how much of it you need".
  writeFileSync(`${brokenRepo}/fleet-e2e.ts`, "// fleet-shaped: the unanswerable-diff fixture is about the DIFF, not the repo\n");
  spawnSync("git", ["-C", brokenRepo, "add", "seed.txt", "fleet-e2e.ts"]);
  spawnSync("git", ["-C", brokenRepo, "commit", "-qm", "seed"]);
  const orphan = spawnSync("git", ["-C", brokenRepo, "worktree", "add", "--orphan", "-b", "proof-orphan", brokenTree]);
  check("localProof null fixture: an orphan worktree with no merge-base is created",
    orphan.status === 0, orphan.stderr.toString().slice(0, 300));
  writeFileSync(`${brokenTree}/orphan.txt`, "orphan\n");
  spawnSync("git", ["-C", brokenTree, "add", "orphan.txt"]);
  spawnSync("git", ["-C", brokenTree, "commit", "-qm", "orphan"]);
  const brokenLane = (await (await post("/api/lanes", { repo: brokenRepo, attach: brokenTree })).json()) as
    { ok?: boolean; slot?: number; error?: string };
  check("localProof null fixture: the no-baseSha orphan lane attaches",
    brokenLane.ok === true && typeof brokenLane.slot === "number", JSON.stringify(brokenLane));
  const brokenToken = typeof brokenLane.slot === "number" ? await paneEnv(`s${brokenLane.slot}`, "FLEET_SELF_TOKEN") : null;
  const renamed = spawnSync("git", ["-C", brokenRepo, "branch", "-m", "main", "moved-main"]);
  check("localProof null fixture: its recorded base ref is made unresolvable",
    renamed.status === 0, renamed.stderr.toString().slice(0, 300));
  const brokenGateRes = await selfGate(brokenToken ?? "");
  const brokenGate = (await brokenGateRes.json()) as Gate;
  check("GET /api/self/gate: an unanswerable git diff returns 200 with localProof:null (not steps:[]) and the other gate fields",
    brokenGateRes.ok && brokenGate.localProof === null && "verify" in brokenGate
      && typeof brokenGate.postlandAudit === "boolean" && "suiteLock" in brokenGate,
    `${brokenGateRes.status} ${JSON.stringify(brokenGate)}`);
  if (typeof brokenLane.slot === "number")
    check("localProof null fixture: the lane slot is torn down", (await post(`/api/slots/${brokenLane.slot}/kill`, {})).ok);
  spawnSync("git", ["-C", brokenRepo, "worktree", "remove", "--force", brokenTree]);
  rmSync(brokenTree, { recursive: true, force: true });
  rmSync(brokenRepo, { recursive: true, force: true });

  // --- WHICH VERIFY COMMAND a lane is told about is a property of its REPOSITORY, not of the path
  // its checkout happens to sit at. A checkout that is ITSELF a linked worktree has a toplevel of
  // its own, and that toplevel is what a MAIN founded there reports and what every lane it spawns
  // records as its repo — so until 2026-08-29 an owner entry configured under the repository's
  // primary path was simply missed: the gate named the global command and self-land step 7 refused
  // with "repo has no owner-configured verify entry" for a repository that has one (measured live
  // on a Game-Maker program rooted in `…/private-repo-o.worktrees/…-fresh`).
  // Three arms, because the fix must widen IDENTITY and not POLICY: the configured repo itself, a
  // linked worktree OF it (must resolve to the same entry), and a linked worktree of the repo the
  // owner deliberately left unconfigured (must still get the global, i.e. no entry — which is the
  // same `verifyEntryFor` answer step 7 refuses on). The two fixture repos differ in exactly the
  // configured-ness that makes the pair separable (harness.ts: REPO2 has an entry, REPO3 has none).
  const vwTrees: [string, string][] = [];
  // One lane at a time, torn down before the next arm opens: three simultaneous probe lanes would
  // race the suite's free-slot budget and report "no free slot" as if it were a resolution answer.
  // `proof` rides along because it is the SAME question asked one field down: these fixture repos
  // are the only ones on this server that carry no `fleet-e2e.ts`, and re-spawning a lane in them
  // for the localProof arms would race the suite's free-slot budget for an answer already in hand.
  const vwCmdFor = async (repo: string): Promise<{ cmd: string | null; proof: Gate["localProof"]; err: string }> => {
    const res = await post("/api/lanes", { repo });
    const lane = (await res.json()) as { ok?: boolean; slot?: number; error?: string };
    if (lane.ok !== true || typeof lane.slot !== "number") return { cmd: null, proof: null, err: `lane: ${JSON.stringify(lane)}` };
    try {
      const tok = await paneEnv(`s${lane.slot}`, "FLEET_SELF_TOKEN");
      if (!/^[0-9a-f]{32}$/.test(tok ?? "")) return { cmd: null, proof: null, err: "the probe lane's pane never answered with a token" };
      const gRes = await selfGate(tok ?? "");
      const g = (await gRes.json()) as Gate;
      return { cmd: g.verify?.cmd ?? null, proof: g.localProof, err: `${gRes.status} ${JSON.stringify({ verify: g.verify, localProof: g.localProof })}` };
    } finally { await post(`/api/slots/${lane.slot}/kill`, {}); }
  };
  // The worktrees are built HERE rather than in the wrapper so this slice stays inside its own
  // write set; both are removed below so REPO2/REPO3 are handed on with the worktree list they had.
  const mkWorktree = (repo: string, dir: string, branch: string): string => {
    rmSync(dir, { recursive: true, force: true });
    const add = spawnSync("git", ["-C", repo, "worktree", "add", "-q", "-b", branch, dir]);
    if (add.status === 0) vwTrees.push([repo, dir]);
    return add.status === 0 ? "" : add.stderr.toString().slice(0, 200);
  };
  const vwTree2 = `${ROOT}/verify-key-wt2`;
  const vwTree3 = `${ROOT}/verify-key-wt3`;
  const vwErr2 = REPO2 ? mkWorktree(REPO2, vwTree2, "verify-key-probe2") : "REPO2 unset";
  const vwErr3 = REPO3 ? mkWorktree(REPO3, vwTree3, "verify-key-probe3") : "REPO3 unset";
  check("verify-key fixture: a linked worktree of the configured repo and one of the unconfigured repo both exist",
    vwErr2 === "" && vwErr3 === "", JSON.stringify({ REPO2, REPO3, vwErr2, vwErr3 }));
  const vwPrimary = vwErr2 === "" ? await vwCmdFor(REPO2) : { cmd: null, proof: null, err: vwErr2 };
  const vwLinked = vwErr2 === "" ? await vwCmdFor(vwTree2) : { cmd: null, proof: null, err: vwErr2 };
  const vwForeign = vwErr3 === "" ? await vwCmdFor(vwTree3) : { cmd: null, proof: null, err: vwErr3 };
  check("gate: a lane in a LINKED WORKTREE of a configured repo is told that repo's own verify entry, not the global",
    vwPrimary.cmd !== null && vwPrimary.cmd.endsWith("/fakeverify2")
      && vwLinked.cmd === vwPrimary.cmd,
    JSON.stringify({ primary: vwPrimary, linked: vwLinked }));
  check("gate: the worktree fallback widens identity and NOT policy — a worktree of the UNCONFIGURED repo still gets the global command",
    vwForeign.cmd !== null && vwForeign.cmd.endsWith("/fakeverify")
      && !vwForeign.cmd.endsWith("/fakeverify2") && vwForeign.cmd !== vwPrimary.cmd,
    JSON.stringify({ foreign: vwForeign, primary: vwPrimary.cmd }));

  // --- …AND THE SAME REPO LOCK ON THE ADVISORY HALF (localProof) --------------------------------
  // `repoRunsShortChain` already decided which COMMAND the gate runs (verifyPlanFor, 2026-08-26).
  // The recommendation two fields down was still repo-blind: testrepo2/testrepo3 carry no
  // `fleet-e2e.ts`, and a lane in either was handed `install, pins, tsc, build, …` — the lines of
  // THIS repo's chain, named at a tree where `bun e2e/pins.ts` does not exist and `bun run build`
  // has no script. Empty steps is the only honest answer there, and it must carry the note, or a
  // lane reads "no steps" as "nothing to prove". Mutation guard: drop the `repoRunsShortChain`
  // branch from laneLocalProof and `steps` fills with all seven while `note` disappears.
  // BOTH arms, because the note must name the command THIS lane will meet and the two differ:
  // testrepo2 has its own FLEET_VERIFY_CMD_REPOS entry (fakeverify2), testrepo3's worktree falls
  // back to the global (fakeverify) — a note built from the global would pass the second and be
  // wrong on the first.
  for (const [label, arm] of [["configured (fakeverify2)", vwPrimary], ["unconfigured, global (fakeverify)", vwForeign]] as const) {
    check(`gate: a lane in a repo with no fleet-e2e.ts gets localProof.steps [] — ${label}`,
      arm.proof !== null && Array.isArray(arm.proof.steps) && arm.proof.steps.length === 0
        && arm.proof.isolatedPreview === false
        && JSON.stringify(arm.proof.classifiedAs) === "{}",
      JSON.stringify(arm.proof));
    check(`gate: …and the note names THAT repo's verify command, the one its own gate will run — ${label}`,
      typeof arm.proof?.note === "string" && arm.cmd !== null
        && arm.proof.note.includes("no fleet-e2e.ts")
        && arm.proof.note.includes(`verify = ${arm.cmd}`),
      JSON.stringify({ note: arm.proof?.note, cmd: arm.cmd }));
  }
  // The counter-probe in the same breath: the fleet lane opened at the top of this module is in
  // REPO, which HAS the sentinel, and nothing above may have changed what it is told.
  const gFleet = (await (await selfGate(selfTok)).json()) as Gate;
  check("gate: a lane in a repo that DOES run this chain is unchanged — real steps, no note",
    gFleet.localProof !== null && gFleet.localProof.steps.length > 0
      && gFleet.localProof.steps.every((step) => (LOCAL_PROOF_STEPS as readonly string[]).includes(step))
      && gFleet.localProof.note === undefined,
    JSON.stringify(gFleet.localProof));
  for (const [repo, dir] of vwTrees) {
    spawnSync("git", ["-C", repo, "worktree", "remove", "--force", dir]);
    rmSync(dir, { recursive: true, force: true });
    rmSync(`${dir}.worktrees`, { recursive: true, force: true });
    spawnSync("git", ["-C", repo, "worktree", "prune"]);
  }

  // rulebook compare: identical copy reads false, a moved source reads true. Fixtures are
  // UNTRACKED files in REPO and the lane — removed right after, an untracked file in either
  // tree would poison later modules' clean-tree assumptions (and a lane's landability).
  writeFileSync(`${REPO}/CLAUDE.md`, "rules v1\n");
  writeFileSync(`${lnTok.cwd}/CLAUDE.md`, "rules v1\n");
  const g1 = (await (await selfGate(selfTok)).json()) as Gate;
  check("gate: an identical rulebook copy reads rulebookDrifted:false", g1.rulebookDrifted === false,
    JSON.stringify({ rb: g1.rulebookDrifted }));
  writeFileSync(`${REPO}/CLAUDE.md`, "rules v1\nrules v2\n");
  const g2 = (await (await selfGate(selfTok)).json()) as Gate;
  check("gate: a source rulebook that moved past the copy reads rulebookDrifted:true", g2.rulebookDrifted === true,
    JSON.stringify({ rb: g2.rulebookDrifted }));
  rmSync(`${REPO}/CLAUDE.md`);
  rmSync(`${lnTok.cwd}/CLAUDE.md`);

  // --- THE SPLIT ITSELF: a lane of a repo that HAS a `rulebook/` is WRITTEN the lane rendering (a
  // strict subset of the fragments) instead of being handed the monolith, and the gate still reads
  // false on it. Both halves in one fixture on purpose: the seam without the probe fix is the
  // self-cancelling state — a permanent `rulebookDrifted: true` ordering every lane to load the
  // very bytes the split saved. Own repo, so REPO's clean-tree assumptions stay untouched.
  {
    const rbRepo = `${ROOT}/rulebook-split-repo`;
    rmSync(rbRepo, { recursive: true, force: true });
    mkdirSync(`${rbRepo}/${RULEBOOK_DIR}`, { recursive: true });
    spawnSync("git", ["-C", rbRepo, "init", "-q", "-b", "main"]);
    spawnSync("git", ["-C", rbRepo, "config", "user.email", "e2e@example.invalid"]);
    spawnSync("git", ["-C", rbRepo, "config", "user.name", "Fleet E2E"]);
    // gitignored on BOTH counts, exactly as in the real checkout: an untracked copy would leave
    // every lane permanently dirty and block `land`, which is why the seam checks check-ignore.
    writeFileSync(`${rbRepo}/.gitignore`, `CLAUDE.md\n${RULEBOOK_DIR}/\n`);
    spawnSync("git", ["-C", rbRepo, "add", ".gitignore"]);
    spawnSync("git", ["-C", rbRepo, "commit", "-qm", "seed"]);
    const frag = new Map<RulebookFragment, string>(
      RULEBOOK_FRAGMENTS.map((f) => [f, `## ${f}\n\nrule text of ${f}\n`]),
    );
    for (const [f, body] of frag) writeFileSync(`${rbRepo}/${RULEBOOK_DIR}/${fragmentFileName(f)}`, body);
    writeFileSync(`${rbRepo}/CLAUDE.md`, renderRulebook("main", frag));

    const rbLane = (await (await post("/api/lanes", { repo: rbRepo })).json()) as
      { ok?: boolean; slot?: number; cwd?: string; error?: string };
    check("rulebook split: a lane of a repo with rulebook/ spawns",
      typeof rbLane.slot === "number" && typeof rbLane.cwd === "string", JSON.stringify(rbLane));
    const written = ((): string | null => {
      try { return readFileSync(`${rbLane.cwd}/CLAUDE.md`, "utf8"); } catch { return null; }
    })();
    const expectBody = renderRulebook("lane", frag);
    const omitted = RULEBOOK_FRAGMENTS.filter((f) => !FRAGMENTS_FOR.lane.includes(f));
    // the SUBSET claim is about the rules, so it is measured on the body: the back-reference block
    // is a fixed ~1 KB and outweighs a synthetic monolith, which says nothing about the real one.
    check("rulebook split: the lane is WRITTEN the lane rendering, not handed the monolith",
      written !== null && rulebookBody(written) === expectBody
        && Buffer.byteLength(expectBody) < Buffer.byteLength(renderRulebook("main", frag))
        && omitted.every((f) => !rulebookBody(written).includes(`rule text of ${f}`))
        && FRAGMENTS_FOR.lane.every((f) => rulebookBody(written).includes(`rule text of ${f}`)),
      `written=${written === null ? "absent" : Buffer.byteLength(written)} B (body ${written === null ? "-" : Buffer.byteLength(rulebookBody(written))} B), lane body=${Buffer.byteLength(expectBody)} B, main=${Buffer.byteLength(renderRulebook("main", frag))} B`);
    check("rulebook split: its back-reference block names every omitted fragment and an absolute path into the SOURCE checkout",
      written !== null && written.includes(RULEBOOK_BACKREF_HEADING)
        && omitted.every((f) => written.includes(FRAGMENT_TITLES[f]))
        && omitted.every((f) => written.includes(`${rbRepo}/${RULEBOOK_DIR}/${fragmentFileName(f)}`)),
      `omitted=${omitted.join(",")}`);
    // the lane must still be landable: a copy that git sees would block it
    const rbStatus = spawnSync("git", ["-C", rbLane.cwd ?? rbRepo, "status", "--porcelain"]).stdout.toString().trim();
    check("rulebook split: the written rulebook leaves the lane clean (gitignored, so `land` is not blocked)",
      rbStatus === "", `status=[${rbStatus.slice(0, 200)}]`);
    const rbTok = typeof rbLane.slot === "number" ? await paneEnv(`s${rbLane.slot}`, "FLEET_SELF_TOKEN") : null;
    const rbGate = (await (await selfGate(rbTok ?? "")).json()) as Gate;
    check("rulebook split: the gate reads rulebookDrifted:false on a subset it wrote itself",
      rbGate.rulebookDrifted === false, JSON.stringify({ rb: rbGate.rulebookDrifted }));
    // and it still SEES a source that moved — including a move in a fragment the lane does not hold
    writeFileSync(`${rbRepo}/${RULEBOOK_DIR}/${fragmentFileName("lane-discipline")}`, "## lane-discipline\n\nmoved\n");
    const rbGate2 = (await (await selfGate(rbTok ?? "")).json()) as Gate;
    check("rulebook split: a moved source fragment still reads rulebookDrifted:true",
      rbGate2.rulebookDrifted === true, JSON.stringify({ rb: rbGate2.rulebookDrifted }));
    // …and a rulebook/ that cannot be read is null — never true, and never a quiet false
    rmSync(`${rbRepo}/${RULEBOOK_DIR}/${fragmentFileName("deploy")}`);
    rmSync(`${rbRepo}/CLAUDE.md`);
    const rbGate3 = (await (await selfGate(rbTok ?? "")).json()) as Gate;
    check("rulebook split: an unreadable source rulebook is null (not comparable), never true",
      rbGate3.rulebookDrifted === null, JSON.stringify({ rb: rbGate3.rulebookDrifted }));
    if (typeof rbLane.slot === "number")
      check("rulebook split: the lane slot is torn down", (await post(`/api/slots/${rbLane.slot}/kill`, {})).ok);
    spawnSync("git", ["-C", rbRepo, "worktree", "remove", "--force", rbLane.cwd ?? ""]);
    rmSync(`${rbRepo}.worktrees`, { recursive: true, force: true });
    rmSync(rbRepo, { recursive: true, force: true });
  }

  // --- THE SUCCESS PATH, without a HANDOFF.md (e3e5084a): an unbound session hands its line on as
  // a role-lineage record the successor reads at GET /api/self — obligations by id, an optional
  // `intent` OR `pointer`. One successor receives the server-built founding ritual, and the caller
  // disappears even if it never remembers to call /retire. A private repo keeps the pointer commit
  // below from moving the shared REPO under the drift fixture. ---
  {
    const sr = `${ROOT}/succession-repo`;
    rmSync(sr, { recursive: true, force: true });
    mkdirSync(sr, { recursive: true });
    spawnSync("git", ["-C", sr, "init", "-q", "-b", "main"]);
    spawnSync("git", ["-C", sr, "config", "user.email", "t@t"]);
    spawnSync("git", ["-C", sr, "config", "user.name", "t"]);
    writeFileSync(`${sr}/README.md`, "a checkout with no HANDOFF.md at all\n");
    spawnSync("git", ["-C", sr, "add", "README.md"]);
    spawnSync("git", ["-C", sr, "commit", "-qm", "init"]);

    type LineageRecord = { v?: number; lineageId?: string; role?: string; from?: { slot: number; openedAt: number };
      to?: { slot: number; openedAt: number }; obligations?: Record<string, unknown>[]; intent?: string | null;
      pointer?: string | null; supersededBy?: { slot: number; openedAt: number } | null };
    type LineageView = { lineageId?: string; state?: string; record?: LineageRecord | null;
      handoverLost?: { error?: string } | null } | null;
    const selfLineage = async (tok: string): Promise<LineageView | undefined> =>
      ((await (await fetch(`${BASE}/api/self`, { headers: { "x-fleet-self-token": tok } })).json()) as { lineage?: LineageView }).lineage;
    type SuccRow = { id: number; cwd: string | null; label: string | null; model: string | null; effort?: string; harness?: string; openedAt?: number };
    const succRows = async (): Promise<SuccRow[]> =>
      ((await (await get("/api/sessions")).json()) as { slots: SuccRow[] }).slots;
    const persistedLine = (): LineageRecord[] =>
      (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as { lineageHandovers?: LineageRecord[] }).lineageHandovers ?? [];

    const free = (await succRows()).find((x) => x.cwd === null)?.id ?? 0;
    const opened = free ? await post(`/api/slots/${free}/open`,
      { cwd: sr, label: "main-before", model: "claude-sonnet-5" }) : null;
    check("self-succeed setup: a private plain main session is open in a checkout WITHOUT HANDOFF.md",
      !!opened?.ok && !spawnSync("git", ["-C", sr, "ls-files", "HANDOFF.md"], { encoding: "utf8" }).stdout.trim()
        && !readFileSync(`${sr}/README.md`, "utf8").includes("## "), `${free}:${opened?.status}`);
    const oldTok = free ? await paneEnv(`s${free}`, "FLEET_SELF_TOKEN") ?? "" : "";
    check("self-succeed setup: the caller's pane carries its own token", /^[0-9a-f]{32}$/.test(oldTok), oldTok);
    const oldOpenedAt = (await succRows()).find((x) => x.id === free)?.openedAt ?? 0;
    // ONE obligation that dies with the predecessor, so the record has something to name by id — and a
    // body the record must NOT copy
    const AUTO_BODY = "lineage-body-marker: this check-in text must never appear inside a handover record";
    const armed = await fetch(`${BASE}/api/self/autos`, { method: "POST",
      headers: { "content-type": "application/json", "x-fleet-self-token": oldTok },
      body: JSON.stringify({ text: AUTO_BODY, inSec: 3600 }) });
    const autoId = ((await armed.json()) as { auto?: { id?: string } }).auto?.id ?? "";
    check("self-succeed setup: the predecessor holds one scheduled check-in", armed.ok && autoId !== "", autoId);

    // --- the channel refusals, each of which opens NOTHING ---
    const occupied = async (): Promise<number> => (await succRows()).filter((x) => x.cwd).length;
    const occupiedBefore = await occupied();
    const overCap = await successionPost("succeed", oldTok, { intent: "I".repeat(2001) });
    const overCapText = await overCap.text();
    const twoChannels = await successionPost("succeed", oldTok, { intent: "resume the queue",
      pointer: "docs/handoff-2026-09-14.md#next" });
    const twoChannelsText = await twoChannels.text();
    const carryAndIntent = await successionPost("succeed", oldTok, { intent: "resume", carry: "also this" });
    const carryAndIntentText = await carryAndIntent.text();
    const undated = await successionPost("succeed", oldTok, { pointer: "docs/handoff.md#next" });
    const undatedText = await undated.text();
    writeFileSync(`${sr}/handoff-2026-09-14.md`, "## next\nnot committed yet\n");
    const uncommitted = await successionPost("succeed", oldTok, { pointer: "handoff-2026-09-14.md#next" });
    const uncommittedText = await uncommitted.text();
    rmSync(`${sr}/handoff-2026-09-14.md`, { force: true });
    check("POST /api/self/succeed: intent over its cap is 400 NAMING the cap, and no successor opens",
      overCap.status === 400 && overCapText.includes("at most 2000 characters") && (await occupied()) === occupiedBefore,
      `${overCap.status} ${overCapText}`);
    check("POST /api/self/succeed: intent AND pointer is 409 with the one-channel sentence, and so is carry beside intent",
      twoChannels.status === 409 && twoChannelsText.includes("exactly one handover channel")
        && carryAndIntent.status === 409 && carryAndIntentText.includes("exactly one handover channel")
        && (await occupied()) === occupiedBefore,
      `${twoChannels.status} ${twoChannelsText} | ${carryAndIntent.status} ${carryAndIntentText}`);
    check("POST /api/self/succeed: an undated pointer is 400 and a pointer at an uncommitted file is 409",
      undated.status === 400 && undatedText.includes("DATED section")
        && uncommitted.status === 409 && uncommittedText.includes("committed and clean")
        && (await occupied()) === occupiedBefore,
      `${undated.status} ${undatedText} | ${uncommitted.status} ${uncommittedText}`);

    // --- A → B: no HANDOFF commit, a capped label, the intent ---
    const INTENT = "Absicht: erst die offene Welle landen, dann den Audit lesen.\nKorrektur: Slot 3 ist NICHT frei.";
    const longLabel = `next-${"x".repeat(60)}`;
    const succeeded = await successionPost("succeed", oldTok, { label: longLabel, intent: INTENT });
    const sj = (await succeeded.json()) as { ok?: boolean; slot?: number; label?: string | null;
      lineage?: { lineageId?: string; obligations?: number } };
    check("POST /api/self/succeed: an UNBOUND session succeeds with no HANDOFF.md commit, one labelled successor, label capped at MAX_LABEL",
      succeeded.ok && sj.ok === true && !!sj.slot && sj.slot !== free
        && sj.label === longLabel.slice(0, 40) && /^[0-9a-f]{24}$/.test(sj.lineage?.lineageId ?? ""),
      `${succeeded.status} ${JSON.stringify(sj)}`);
    const successor = (await succRows()).find((x) => x.id === sj.slot);
    check("the successor inherits cwd, model and default harness from the caller",
      successor?.cwd === sr && successor.model === "claude-sonnet-5" && successor.harness === undefined,
      JSON.stringify(successor));

    // bound to the OCCUPANT, not the slot number: a retired successor's slot is recycled within this
    // block, and the first "[fleet succession]" line on that number is the previous occupant's brief
    const successionBriefOf = async (slot: number | undefined): Promise<string> => {
      const openedAt = (await succRows()).find((x) => x.id === slot)?.openedAt;
      return (await plogRead()).findLast((e) => e.slot === slot && e.openedAt === openedAt
        && e.text.startsWith("[fleet succession]"))?.text ?? "";
    };
    let founding = "";
    for (let i = 0; i < 40 && !founding; i++) {
      founding = await successionBriefOf(sj.slot);
      if (!founding) await Bun.sleep(100);
    }
    // (b) a repo WITHOUT .fleet/init.md: the neutral entry — lineage.record, HANDOFF.md, README/AGENTS —
    // and not one of claude-fleet's own entry points (2026-09-13: slot 14 in ~/private-repo-a went
    // searching ~/.claude for ./state.sh)
    const neutral = ["lineage.record", "HANDOFF.md", "README.md bzw. AGENTS.md"].map((x) => founding.indexOf(x));
    check("the founding brief names the LINE RECORD; a repo without .fleet/init.md gets the neutral entry: lineage.record · HANDOFF.md · README/AGENTS",
      neutral.every((x) => x >= 0) && neutral.every((x, i) => i === 0 || neutral[i - 1]! < x)
        && founding.includes("Die Vorgängerin zieht sich gerade zurück")
        && founding.includes(`Linien-Record ${sj.lineage?.lineageId}`) && founding.includes("1 Pflichten per ID")
        && !founding.includes("alles Übergebene steht in HANDOFF.md") && !founding.includes("Absicht: erst"),
      founding.slice(0, 600));
    check("...and it names none of claude-fleet's entry points: no state.sh, no register.sh, no Fleet-Board",
      founding !== "" && ["state.sh", "register.sh", "Fleet-Board"].every((x) => !founding.includes(x)),
      founding.slice(0, 600));

    const successorTok = sj.slot ? await paneEnv(`s${sj.slot}`, "FLEET_SELF_TOKEN") ?? "" : "";
    const lineB = await selfLineage(successorTok);
    const recB = lineB?.record;
    check("the successor reads its line record at GET /api/self: from/to as the two occupations, lineageId, intent verbatim",
      lineB?.state === "present" && lineB.lineageId === sj.lineage?.lineageId && recB?.lineageId === lineB.lineageId
        && recB?.role === "generic" && recB.from?.slot === free && recB.from.openedAt === oldOpenedAt
        && recB.to?.slot === sj.slot && recB?.to?.openedAt === successor?.openedAt
        && recB.intent === INTENT && recB.pointer === null && recB.supersededBy === null,
      JSON.stringify(lineB));
    check("the record's obligations are ids only — the auto by id, owedBy the predecessor occupation, its re-arm door, and NO body",
      recB?.obligations?.length === 1
        && JSON.stringify(Object.keys(recB.obligations[0] ?? {}).sort()) === JSON.stringify(["id", "kind", "owedBy", "reArm"])
        && recB.obligations[0]?.kind === "auto" && recB.obligations[0]?.id === autoId
        && recB.obligations[0]?.owedBy === `slot ${free}@${oldOpenedAt}` && recB.obligations[0]?.reArm === "POST /api/self/autos"
        && !JSON.stringify(lineB).includes("lineage-body-marker"),
      JSON.stringify(recB?.obligations));

    let oldGone = false;
    for (let i = 0; i < 50 && !oldGone; i++) {
      oldGone = (await succRows()).find((x) => x.id === free)?.cwd === null;
      if (!oldGone) await Bun.sleep(100);
    }
    check("the grace deadline retires the predecessor and clears its label even without /retire",
      oldGone, JSON.stringify((await succRows()).find((x) => x.id === free)));

    // --- A WATCH ON THE LINE names its TARGET (2026-09-15: two audit watches reached the successor
    // only because their shas happened to sit in `intent`). B arms an audit watch here and hands the
    // line to C below with NO intent. The land is a PARKED queue entry — this instance runs no audit
    // command — so the watch stays armed: a ledger row would fire it at once, and a spent watch is no
    // obligation. The queue file is restored where the loader plants stop the server again. ---
    const auditQueueFile = `${ROOT}/post-land-audit-queue.json`;
    const auditQueueBefore = existsSync(auditQueueFile) ? readFileSync(auditQueueFile, "utf8") : null;
    const srCanon = realpathSync(sr);
    const auditMainAfter = spawnSync("git", ["-C", sr, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
    await stopSrv();
    writeFileSync(auditQueueFile, JSON.stringify({ ...(auditQueueBefore ? JSON.parse(auditQueueBefore) as object : {}),
      [srCanon]: { main: "main", covers: [{ branch: "fleet/lineage-target", mainAfter: auditMainAfter, at: Date.now() }] } }),
      { mode: 0o600 });
    await restartSrv();
    const WATCH_BODY = { kind: "audit", repo: srCanon, mainAfter: auditMainAfter };
    const watched = await fetch(`${BASE}/api/self/watch`, { method: "POST",
      headers: { "content-type": "application/json", "x-fleet-self-token": successorTok }, body: JSON.stringify(WATCH_BODY) });
    const watchedJ = (await watched.json()) as { watch?: { id?: string; armed?: boolean; slotOpenedAt?: number } };
    check("lineage target setup: B holds one ARMED audit watch on a parked land",
      watched.ok && watchedJ.watch?.armed === true && /^[0-9a-f]{8}$/.test(watchedJ.watch.id ?? "")
        && /^[0-9a-f]{40}$/.test(auditMainAfter),
      `status=${watched.status} armed=${watchedJ.watch?.armed} id=${watchedJ.watch?.id} mainAfter=${auditMainAfter}`);

    // --- the OVERRIDE: a MAIN that moved to another model in its pane (/model) hands the successor
    // the record it actually wants, instead of the spawn-time one it inherited (2026-09-02: four
    // slots on the record's claude-opus-5[1m], Fable in the pane, every successor born on the
    // record). Absent = inherit, proven above. Present = validated exactly as open would validate
    // it, and a rejected pair opens NOTHING — the predecessor stays, the slot count does not move.
    // The carry cap rides here: `carry` alone is still the tiny unpersisted bridge it always was. ---
    const occupiedBeforeOverride = await occupied();
    const badModel = await successionPost("succeed", successorTok, { model: "no spaces allowed" });
    const badModelText = await badModel.text();
    const badEffort = await successionPost("succeed", successorTok, { effort: "turbo" });
    const badEffortText = await badEffort.text();
    check("POST /api/self/succeed with an invalid model is 400 (the open route's own wording) and opens no successor",
      badModel.status === 400 && badModelText.includes("bad model")
        && (await occupied()) === occupiedBeforeOverride, `${badModel.status} ${badModelText}`);
    check("POST /api/self/succeed with an unknown effort is 400 naming the adapter's levels, and opens no successor",
      badEffort.status === 400 && badEffortText.includes("bad effort (one of: low, medium, high, xhigh, max)")
        && (await occupied()) === occupiedBeforeOverride, `${badEffort.status} ${badEffortText}`);
    // (a) the repo now carries a tracked .fleet/init.md: B → C quotes its lines verbatim as the steps
    const INIT = "1. Lies docs/einstieg-marker.md.\n2. Fahre make ground-marker.";
    mkdirSync(`${sr}/.fleet`, { recursive: true });
    writeFileSync(`${sr}/.fleet/init.md`, `${INIT}\n`);
    spawnSync("git", ["-C", sr, "add", ".fleet/init.md"]);
    spawnSync("git", ["-C", sr, "commit", "-qm", "repo entry"]);
    const carry = "C".repeat(600);
    const overridden = await successionPost("succeed", successorTok, { model: "claude-opus-5[1m]", effort: "max", carry });
    const oj = (await overridden.json()) as { ok?: boolean; slot?: number };
    const overrideRow = (await succRows()).find((x) => x.id === oj.slot);
    check("POST /api/self/succeed {model, effort} opens the successor ON THE OVERRIDE — the record it will heal and restart from",
      overridden.ok && !!oj.slot && oj.slot !== sj.slot && overrideRow?.cwd === sr
        && overrideRow.model === "claude-opus-5[1m]" && overrideRow.effort === "max",
      `${overridden.status} ${JSON.stringify(oj)} ${JSON.stringify(overrideRow)}`);
    check("...while the predecessor's own record is untouched by the override (it retires on the grace deadline as before)",
      (await succRows()).find((x) => x.id === sj.slot)?.model === "claude-sonnet-5",
      JSON.stringify((await succRows()).find((x) => x.id === sj.slot)));
    let overrideBrief = "";
    for (let i = 0; i < 40 && !overrideBrief; i++) {
      overrideBrief = await successionBriefOf(oj.slot);
      if (!overrideBrief) await Bun.sleep(100);
    }
    check("the optional inter-session carry is capped at 500 characters",
      overrideBrief.includes("C".repeat(500)) && !overrideBrief.includes("C".repeat(501)), `brief=${overrideBrief.length} chars`);
    check("a repo with a tracked .fleet/init.md: the brief carries its lines verbatim right after the order line, and no neutral entry",
      overrideBrief.includes(`Beginne exakt in dieser Reihenfolge:\n${INIT}\n`)
        && !overrideBrief.includes("README.md bzw. AGENTS.md") && !overrideBrief.includes("abgeschnitten"),
      overrideBrief.slice(0, 600));

    // --- B → C on the SAME line: B's record now says who superseded it, so two slots carrying the same
    // label are told apart by record ---
    const overrideTok = oj.slot ? await paneEnv(`s${oj.slot}`, "FLEET_SELF_TOKEN") ?? "" : "";
    const lineC = await selfLineage(overrideTok);
    const onDisk = persistedLine().filter((r) => r.lineageId === sj.lineage?.lineageId);
    const recordToB = onDisk.find((r) => r.to?.slot === sj.slot);
    check("the line survives a second succession: C inherits the lineageId, and B's record carries supersededBy = C's occupation",
      lineC?.state === "present" && lineC.lineageId === sj.lineage?.lineageId && lineC.record?.from?.slot === sj.slot
        && lineC?.record?.intent === null && lineC?.record?.pointer === null && onDisk.length === 2
        && recordToB?.supersededBy?.slot === oj.slot && recordToB?.supersededBy?.openedAt === overrideRow?.openedAt,
      JSON.stringify({ lineC, onDisk }));

    // THE REBUILD READS THE RECORD AND NOTHING ELSE: kind + target fields -> the door's body
    const watchOb = lineC?.record?.obligations?.find((o) => o.kind === "watch" && o.id === watchedJ.watch?.id);
    const watchTarget = (watchOb?.target ?? null) as Record<string, unknown> | null;
    const rebuiltBody = watchTarget?.kind === "audit" ? { kind: watchTarget.kind, repo: watchTarget.repo, mainAfter: watchTarget.mainAfter }
      : watchTarget?.kind === "lane" || watchTarget?.kind === "merge" ? { kind: watchTarget.kind, target: watchTarget.target } : null;
    const recordCText = JSON.stringify(lineC?.record ?? null);
    check("B's armed watch reaches C's record by id, owed by B, with its re-arm door",
      watchOb?.owedBy === `slot ${sj.slot}@${watchedJ.watch?.slotOpenedAt}` && watchOb.reArm === "POST /api/self/watch",
      `obligation=${JSON.stringify(watchOb ?? null)}`);
    check("...and carries a typed target of exactly {kind, repo, mainAfter}",
      JSON.stringify(Object.keys(watchTarget ?? {}).sort()) === JSON.stringify(["kind", "mainAfter", "repo"]),
      `target=${JSON.stringify(watchTarget)}`);
    check("the record is C's only source for the sha: intent is null and the sha occurs once in the record",
      lineC?.record?.intent === null && recordCText.split(auditMainAfter).length - 1 === 1,
      `intent=${JSON.stringify(lineC?.record?.intent)} occurrences=${recordCText.split(auditMainAfter).length - 1}`);
    check("the exact POST /api/self/watch body rebuilds from the record alone and equals the request B sent",
      JSON.stringify(rebuiltBody) === JSON.stringify(WATCH_BODY),
      `rebuilt=${JSON.stringify(rebuiltBody)} sent=${JSON.stringify(WATCH_BODY)}`);

    const retired = await successionPost("retire", successorTok);
    const retiredRow = (await succRows()).find((x) => x.id === sj.slot);
    check("POST /api/self/retire immediately removes the reporting successor and clears its label",
      retired.ok && retiredRow?.cwd === null && retiredRow.label === null,
      `${retired.status} ${JSON.stringify(retiredRow)}`);
    const landWatches = ((await (await get("/api/sessions")).json()) as { watches: { slot: number; mainAfter?: string }[] })
      .watches.filter((w) => w.mainAfter === auditMainAfter);
    check("nothing was re-armed: once B retires, no watch on that land exists on any slot, C's included",
      landWatches.length === 0, `watches=${JSON.stringify(landWatches.map((w) => w.slot))}`);

    // --- C → D with a POINTER at a committed, dated section ---
    writeFileSync(`${sr}/handoff-2026-09-14.md`, "## next\nthe committed, dated section\n");
    spawnSync("git", ["-C", sr, "add", "handoff-2026-09-14.md"]);
    spawnSync("git", ["-C", sr, "commit", "-qm", "dated handoff section"]);
    // (c) an init.md over the 2000-character cap is cut, and the cut says so
    const HEAD_LINE = "1. Kopf-Marker bleibt sichtbar.";
    const longInit = `${HEAD_LINE}\n${"2. ".padEnd(2400, "L")}TAIL-MARKER`;
    writeFileSync(`${sr}/.fleet/init.md`, `${longInit}\n`);
    spawnSync("git", ["-C", sr, "commit", "-qam", "long repo entry"]);
    const pointed = await successionPost("succeed", overrideTok, { pointer: "handoff-2026-09-14.md#next" });
    const pj = (await pointed.json()) as { ok?: boolean; slot?: number };
    let longBrief = "";
    for (let i = 0; i < 40 && !longBrief; i++) {
      longBrief = await successionBriefOf(pj.slot);
      if (!longBrief) await Bun.sleep(100);
    }
    check("an init.md over the cap is cut at 2000 characters with a visible note naming the cap and the full length — never silently",
      longBrief.includes(`Beginne exakt in dieser Reihenfolge:\n${longInit.slice(0, 2000)}\n`)
        && !longBrief.includes("TAIL-MARKER") && !longBrief.includes(longInit.slice(0, 2001))
        && longBrief.includes(`.fleet/init.md abgeschnitten: 2000 von ${longInit.length} Zeichen gezeigt`),
      longBrief.slice(-400));
    const pointerTok = pj.slot ? await paneEnv(`s${pj.slot}`, "FLEET_SELF_TOKEN") ?? "" : "";
    const lineD = await selfLineage(pointerTok);
    check("a pointer at a committed, dated section is carried as the record's one channel (intent null)",
      pointed.ok && lineD?.state === "present" && lineD.record?.pointer === "handoff-2026-09-14.md#next"
        && lineD.record.intent === null && lineD.lineageId === sj.lineage?.lineageId,
      `${pointed.status} ${JSON.stringify(lineD)}`);
    await successionPost("retire", overrideTok);

    // --- DURABLE, and a record that cannot be read back is LOST, never "nothing owed" ---
    await restartSrv();
    const lineDAfterBoot = await selfLineage(pointerTok);
    check("the line record survives a server restart byte-for-byte on the successor's own reader",
      lineDAfterBoot?.state === "present" && JSON.stringify(lineDAfterBoot.record) === JSON.stringify(lineD?.record),
      JSON.stringify(lineDAfterBoot));
    // ONE BOOT PER PLANTED SHAPE on D's record: a refused record is gone from the next save, so every
    // plant starts from the record as the server wrote it. Matched on the OCCUPANT: D's slot number is
    // recycled within this block, so an earlier record on the line can carry the same `to.slot`
    const isRecordD = (r: Record<string, unknown>): boolean => {
      const to = r.to as { slot?: number; openedAt?: number } | undefined;
      return to !== undefined && to.slot === pj.slot && to.openedAt === lineD?.record?.to?.openedAt;
    };
    let recordD: Record<string, unknown> | undefined;
    const plantD = async (obligations: Record<string, unknown>[]): Promise<LineageView | undefined> => {
      await stopSrv();
      // the parked land has served its purpose; restored while the server is down, so no save rewrites it
      if (auditQueueBefore === null) rmSync(auditQueueFile, { force: true });
      else writeFileSync(auditQueueFile, auditQueueBefore, { mode: 0o600 });
      const state = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as { lineageHandovers?: Record<string, unknown>[] };
      recordD ??= (state.lineageHandovers ?? []).find(isRecordD);
      state.lineageHandovers = [...(state.lineageHandovers ?? []).filter((r) => !isRecordD(r)), { ...recordD, obligations }];
      writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(state, null, 2), { mode: 0o600 });
      await restartSrv();
      return selfLineage(pointerTok);
    };
    const legacyWatch = { kind: "watch", id: "deadbeef", owedBy: "slot 1@1", reArm: "POST /api/self/watch" };
    const lineDLegacy = await plantD([legacyWatch]);
    check("a record in the old four-field format stays readable: its watch obligation is served as written, with no target key",
      lineDLegacy?.state === "present" && recordD !== undefined
        && JSON.stringify(lineDLegacy.record?.obligations) === JSON.stringify([legacyWatch]),
      `state=${lineDLegacy?.state} planted=${recordD !== undefined} obligations=${JSON.stringify(lineDLegacy?.record?.obligations)}`);
    // a body smuggled into an obligation: the closed loader refuses the whole record
    const lineDLost = await plantD([{ kind: "auto", id: "deadbeef", owedBy: "slot 1@1", reArm: null, text: "a copied body" }]);
    check("a record carrying a body is refused by the loader and read as handoverLost — never as a record with nothing owed",
      lineDLost?.state === "lost" && lineDLost.record === null
        && (lineDLost.handoverLost?.error ?? "").includes("ids only, never a body"),
      JSON.stringify(lineDLost));
    const lineDNote = await plantD([{ ...legacyWatch,
      target: { kind: "audit", repo: srCanon, mainAfter: auditMainAfter, note: "das Audit zu diesem Land war rot" } }]);
    check("a target carrying an unknown field is refused as a whole record, never read with the field dropped",
      lineDNote?.state === "lost" && (lineDNote.handoverLost?.error ?? "").includes("target must be null, exactly"),
      `state=${lineDNote?.state} error=${lineDNote?.handoverLost?.error}`);
    const lineDProse = await plantD([{ ...legacyWatch,
      target: { kind: "audit", repo: srCanon, mainAfter: "das rote Audit von heute Mittag" } }]);
    check("free text in a typed target field is refused as a whole record",
      lineDProse?.state === "lost" && (lineDProse.handoverLost?.error ?? "").includes("target.mainAfter must be a full git object id"),
      `state=${lineDProse?.state} error=${lineDProse?.handoverLost?.error}`);
    await successionPost("retire", pointerTok);
    rmSync(sr, { recursive: true, force: true });
  }

  // KEEP this lane alive across the server restart (below) to prove its selfToken persists —
  // the restart section (guards fix A) uses this token, then tears the lane down.
  ctx.restartSelfTok = selfTok;
  ctx.restartSelfSlot = lnTok.slot;
}
