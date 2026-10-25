// THE KONZEPT LEDGER (konzept-ledger.ts, /api/konzepte/:id/… and /api/self/konzepte/:id/…): versions and
// anmerkungen of a konzept, appended under FLEET_KONZEPT_ROOT with the writer's Principal as `actor` and a
// TraceRefs `kontext` the server builds from the credential and its binding.
//
// ITS OWN SCRATCH INSTANCE, the pattern of e2e/self-token.ts#memoryDoor: three slots are opened on it
// (a MAIN-to-be, a slot on a real git worktree, a plain session), the instance is stopped, an active
// Program bound to slot 1 and the lane's task/Program binding are planted as server facts, and it boots
// again with a konzept root this module owns. Nothing here touches the suite's srv.
//
// What each check turns red on, stated as the mutation:
//   forged provenance — read `actor` or `kontext` from the body (or ignore them silently instead of 400).
//   lane / main actor — record anything but the resolved Principal: owner as a default actor, a role
//                       other than the one resolvePrincipal names, or a kontext without the binding.
//   owner actor       — give the owner a session's kontext, or a session the owner's actor.
//   unknown version   — let an anmerkung hang on a version the ledger does not hold.
//   missing root      — write into a root that is gone, or answer it with anything but 503 + its env name.
//   konzept id        — accept an id outside ^k-[a-z0-9-]{1,64}$ (a path segment into the root).
//   verworfen         — accept one without grund, or record the status without the actor who set it.
//   arbeitetEin       — write the version without folding its named anmerkungen to eingearbeitet.
//   ebene / geltung   — widen the closed ebene list, drop the projekt default, or the 200-char/string rule.
//   concurrency       — drop the per-konzept serial chain: two POSTs read the same last N (duplicate N)
//                       or interleave a line.
//   file check        — assign N without checking v<N>.md exists and hashes to the body's sha256.
//   scope             — let a plain session read or write a konzept of a Program it is not bound to, or 401 it.
//   any session       — keep the door to lane and MAIN for an anmerkung (the Orchestratorin or a plain session
//                       409), or record its writer as anything but its resolved Principal and credential kontext.
//   any session versions stay — let a session that is neither lane nor MAIN past the door for a fassung or a
//                       verwerfen (konzeptKontextFor admitting every op), or drop the owner-only rule of the heft.
//   index             — list a directory that is no konzept id, read a fassung into the list, miscount the
//                       fold, or answer a request carrying a self token anything but 401 (alone) / 409
//                       (beside the owner's) — GET /api/konzepte, the board's list.
//   owner heft        — drop the owner-only rule of k-owner-korrekturen (lane or MAIN publish a fassung), or
//                       let a session learn more than the 403's door sentence.
//   erwartet          — skip the expected-predecessor compare under the lock (a stale or ahead erwartet
//                       appends), or make it required (k-claude-fleet's first-version body is 409).
//   ersetzt fold      — fold a replaced entry to anything but veraltet + abgeloestDurch, or rewrite v1.
//   ersetzt refusal   — one mutation per sentence, each dropping its own return in checkKorrekturHeft:
//                       self-replacement, unknown id, cycle, duplicate id, two successors, another geltung,
//                       a published entry changed, withdrawn and replaced at once; the prior fassung's hash
//                       compare (drift); the one-block rule of parseKorrekturHeft.
//   other konzepte    — narrow any other konzept's writers while guarding the owner's heft.
//   leseansicht       — GET /api/self/konzepte/k-owner-korrekturen/leseansicht (konzept-ledger.ts#konzeptLeseansicht,
//                       server.ts#korrekturLeserFor), one mutation per row:
//     harness parity  — resolve a harness to anything but harnessOf(slot.harness).id (codex or pi-zai lose ok-drei).
//     filter          — drop any one axis of geltungTrifft (projekt: ok-fremd reaches the Fleet lanes;
//                       rolle: ok-main/ok-orch reach a lane; harness: ok-container reaches everyone), or serve
//                       a veraltet/verworfen entry or its private quelle.
//     main / orch     — refuse the Orchestratorin (konzeptKontextFor in front of the read) or a bound MAIN.
//     free / recycled — serve role generic, or honor a rotated token (401 must stay 401).
//     request scope   — read projekt/rolle/harness from the query instead of refusing it.
//     refusals        — each named, never a 200 with []: hash drift, missing v<N>.md, a newest row not
//                       the owner's (fall back to an older one), no directory, no ledger row, missing root,
//                       the owner door (no binding), another konzept, a POST.
//     modus fold      — serve a moded entry whole in geltendeEintraege, drop one from both lists, build
//                       wann from anything but its modi and first clause (server.ts#korrekturFaltung), or
//                       let GET …/leseansicht/<id> serve an entry outside the binding or take a query.
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { check, IP, PORT, ROOT, SOCK } from "./harness";
import type { KonzeptAnmerkung, KonzeptVersion } from "../konzept-ledger";
import { CONTEXT_PACK_HARNESSES, CONTEXT_PACKS } from "../context-packs";

const FIX = `${process.env.TMPDIR ?? "/tmp"}/fleet-e2e-konzepte-${process.pid}`;
const TOKEN = `konzepte-${randomBytes(8).toString("hex")}`;
const OFF = 28; // PORT offsets 1, 23-27 are taken (restart.ts, state-snapshot.ts, self-token.ts, trace.ts)
// codex-home holds .tmp/plugins-clone-*/ — a Codex plugin sync's checkout with an unborn-HEAD .git;
// copying it makes the fixture's git add -A die with "does not have a commit checked out"
const SKIP = /^(\.git|node_modules|streams|e2e-trail|drops|codex-home|fleet\.json.*|fleet\.pid|.*\.jsonl(\.\d+|\.archive)?|.*\.log|post-land-audit-queue\.json.*|deploy-inflight\.json.*)$/;
const K = "k-e2e-konzept";
const PROGRAM = "c0ffee".repeat(4);
const TASK = "k0nz3pt7a5k0";
const BRANCH = "e2e-konzept-lane";
const LANE = 2; // opened as a plain session on the worktree (open is band-only), made a lane by the plant
// the reader slots of the leseansicht: two more Fleet lanes (same repo, same Program) planted with the codex
// and pi-zai adapters, a lane on ANOTHER repository, and an Orchestratorin on the Fleet repo
const CODEX_LANE = 4, PI_LANE = 5, FREMD_LANE = 6, ORCH = 7;

interface Instance { dir: string; base: string; sock: string; root: string; proc: ReturnType<typeof Bun.spawn> | null; log: string }
interface SlotRow { selfToken?: string; openedAt?: number; sessionId?: string | null; cwd?: string | null;
  worktree?: { repo?: string; branch?: string }; taskId?: string | null; programId?: string | null; harness?: string | null }
interface Answer { status: number; body: { error?: string; ok?: boolean; version?: KonzeptVersion; anmerkung?: KonzeptAnmerkung;
  versionen?: KonzeptVersion[]; anmerkungen?: KonzeptAnmerkung[]; letzte?: number | null; malformed?: number } }

async function boot(i: Instance, bin?: string): Promise<boolean> {
  i.proc = Bun.spawn(["bun", "server.ts"], {
    cwd: i.dir, stdout: "pipe", stderr: "pipe",
    env: { ...process.env, ...(bin ? { PATH: `${bin}:${process.env.PATH ?? ""}` } : {}), FLEET_HOST: IP, FLEET_PORT: i.base.split(":").pop()!, FLEET_SOCK: i.sock,
      FLEET_TOKEN: TOKEN, FLEET_CMD: "true", FLEET_AUTO_REVIEW_MS: "0", FLEET_STATE_SNAPSHOT_MS: "0",
      FLEET_POSTLAND_AUDIT_CMD: "true", FLEET_KONZEPT_ROOT: i.root },
  });
  const drain = async (s: ReadableStream<Uint8Array>) => { for await (const c of s) i.log += new TextDecoder().decode(c); };
  void drain(i.proc.stdout as ReadableStream<Uint8Array>);
  void drain(i.proc.stderr as ReadableStream<Uint8Array>);
  for (let n = 0; n < 150; n++) {
    if (await fetch(`${i.base}/api/sessions`, { headers: { authorization: `Bearer ${TOKEN}` } }).then((r) => r.ok, () => false)) return true;
    await Bun.sleep(100);
  }
  return false;
}
async function stop(i: Instance): Promise<void> {
  if (!i.proc) return;
  i.proc.kill("SIGTERM");
  await Promise.race([i.proc.exited, Bun.sleep(5000)]);
  i.proc.kill("SIGKILL");
  i.proc = null;
}
function gitRepo(dir: string): string {
  mkdirSync(dir, { recursive: true });
  const g = (...a: string[]) => spawnSync("git", ["-C", dir, ...a], { encoding: "utf8" });
  g("init", "-q", "-b", "main");
  g("config", "user.email", "e2e@fleet"); g("config", "user.name", "e2e");
  writeFileSync(`${dir}/README.md`, "# konzept fixture\n");
  g("add", "-A"); g("commit", "-q", "-m", "fixture");
  return realpathSync(dir);
}
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");
const jsonl = (path: string): Record<string, unknown>[] => existsSync(path)
  ? readFileSync(path, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as Record<string, unknown>) : [];

export async function run(): Promise<void> {
  await firstInputBoundary();
  await ledgerDoors();
  await privatePackHandover();
}

async function ledgerDoors(): Promise<void> {
  rmSync(FIX, { recursive: true, force: true });
  mkdirSync(`${FIX}/srv`, { recursive: true });
  const i: Instance = { dir: `${FIX}/srv`, base: `http://${IP}:${PORT + OFF}`, sock: `${SOCK}konzepte${OFF}`,
    root: `${FIX}/root`, proc: null, log: "" };
  for (const e of readdirSync(ROOT)) if (!SKIP.test(e)) cpSync(`${ROOT}/${e}`, `${i.dir}/${e}`, { recursive: true });
  if (!existsSync(`${i.dir}/node_modules`)) symlinkSync(`${ROOT}/node_modules`, `${i.dir}/node_modules`);
  mkdirSync(`${i.root}/${K}`, { recursive: true });
  const repo = gitRepo(`${FIX}/repo`);
  const plain = `${FIX}/plain`;
  mkdirSync(plain, { recursive: true });
  const OH = { "content-type": "application/json", authorization: `Bearer ${TOKEN}` };
  const readState = () => JSON.parse(readFileSync(`${i.dir}/fleet.json`, "utf8")) as { slots: Record<string, SlotRow>;
    programs?: Record<string, unknown>[]; tasks?: Record<string, unknown>[] };
  const call = async (path: string, method: "GET" | "POST", headers: Record<string, string>, body?: unknown): Promise<Answer> => {
    const r = await fetch(`${i.base}${path}`, { method, headers: { "content-type": "application/json", ...headers },
      ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}) });
    return { status: r.status, body: (await r.json().catch(() => ({}))) as Answer["body"] };
  };
  const owner = (rest: string, method: "GET" | "POST", body?: unknown, k = K) => call(`/api/konzepte/${k}/${rest}`, method, OH, body);
  const self = (tok: string, rest: string, method: "GET" | "POST", body?: unknown, k = K) =>
    call(`/api/self/konzepte/${k}/${rest}`, method, { "x-fleet-self-token": tok }, body);
  const place = (n: number, text: string): string => { writeFileSync(`${i.root}/${K}/v${n}.md`, text); return sha(text); };
  const versionLines = () => jsonl(`${i.root}/${K}/versionen.jsonl`);
  const anmerkungLines = () => jsonl(`${i.root}/${K}/anmerkungen.jsonl`);
  const version = (sha256: string, extra: Record<string, unknown> = {}) =>
    ({ sha256, anlass: "e2e fassung", geltung: "fuer den e2e-Beweis", ...extra });

  try {
    // ---- fixture: slot 1 (MAIN-to-be) and 3 (plain) on a plain cwd, slot LANE on a real git worktree whose
    // lane row is PLANTED below with the Program binding. Not via open-worktree: that door's refusals read
    // the runner's inherited env (model, harness, box, context), and on the helper it refused where it
    // passes here (previews f689da8d05aa, 8ebe0c95abcb). This module proves the ledger, not lane creation.
    const laneDir = `${FIX}/repo.worktrees/${BRANCH}`;
    const addWt = spawnSync("git", ["-C", repo, "worktree", "add", "-q", "-b", BRANCH, laneDir], { encoding: "utf8" });
    // the leseansicht's readers: same repo for codex and pi-zai, a second repository for the foreign lane
    const repo2 = gitRepo(`${FIX}/repo2`);
    const readerWt: [number, string, string][] = [[CODEX_LANE, repo, "e2e-konzept-codex"], [PI_LANE, repo, "e2e-konzept-pi"],
      [FREMD_LANE, repo2, "e2e-konzept-fremd"]];
    const readerAdds = readerWt.map(([, r, b]) => spawnSync("git", ["-C", r, "worktree", "add", "-q", "-b", b, `${r}.worktrees/${b}`], { encoding: "utf8" }).status);
    // a slot planted with the codex or a pi adapter may be (re)spawned by ensureSlot at boot: both names are
    // shadowed by a sleeper, so no real agent with a provider behind it ever starts here
    const bin = `${FIX}/bin`;
    mkdirSync(bin, { recursive: true });
    for (const name of ["codex", "pi"]) writeFileSync(`${bin}/${name}`, "#!/bin/sh\nexec sleep 3600\n", { mode: 0o755 });
    let up = await boot(i, bin);
    check("konzepte fixture: the scratch instance boots on its own port and socket", up, i.log.slice(-300));
    if (!up) return;
    // the MAIN sits on the Fleet repo's checkout: its project is that repository (korrekturLeserFor)
    await fetch(`${i.base}/api/slots/1/open`, { method: "POST", headers: OH, body: JSON.stringify({ cwd: repo, label: "konzept-main" }) });
    await fetch(`${i.base}/api/slots/3/open`, { method: "POST", headers: OH, body: JSON.stringify({ cwd: plain, label: "konzept-plain" }) });
    const wt = await fetch(`${i.base}/api/slots/${LANE}/open`, { method: "POST", headers: OH, body: JSON.stringify({ cwd: laneDir, label: "konzept-lane" }) });
    const wtBody = await wt.text();
    const readerOpens: number[] = [];
    for (const [k, r, b] of readerWt)
      readerOpens.push((await fetch(`${i.base}/api/slots/${k}/open`, { method: "POST", headers: OH,
        body: JSON.stringify({ cwd: `${r}.worktrees/${b}`, label: `konzept-leser-${k}` }) })).status);
    readerOpens.push((await fetch(`${i.base}/api/slots/${ORCH}/open`, { method: "POST", headers: OH,
      body: JSON.stringify({ cwd: repo, label: "konzept-orchestrator" }) })).status);
    // THREE setup rows, not one: a preview hands back only the NAMES of failed checks, so each conjunct
    // gets its own name. The wait is 30 s because the slot rows reach fleet.json through the pane spawn
    // and the coalesced save, and a helper running the whole suite is far busier than a lane's machine.
    const credentialed = (x: SlotRow) => /^[0-9a-f]{32}$/.test(x.selfToken ?? "") && typeof x.openedAt === "number";
    let rows: SlotRow[] = [];
    for (let n = 0; n < 300; n++) {
      rows = [1, LANE, 3].map((k) => readState().slots[String(k)] ?? {});
      if (rows.every(credentialed)) break;
      await Bun.sleep(100);
    }
    const seen = JSON.stringify(rows.map((x) => ({ cwd: x.cwd, token: credentialed(x), wt: x.worktree ?? null })));
    check("konzepte fixture: the lane's slot opens on a real git worktree", addWt.status === 0 && wt.ok,
      `worktree=${addWt.status} ${addWt.stderr.slice(0, 200)} open=${wt.status} ${wtBody.slice(0, 300)}`);
    check("konzepte fixture: the MAIN-to-be, the lane and the plain session each persist their own credential within 30 s",
      rows.every(credentialed), seen);
    let readerRows: SlotRow[] = [];
    for (let n = 0; n < 300; n++) {
      readerRows = [CODEX_LANE, PI_LANE, FREMD_LANE, ORCH].map((k) => readState().slots[String(k)] ?? {});
      if (readerRows.every(credentialed)) break;
      await Bun.sleep(100);
    }
    check("konzepte fixture: the codex, pi-zai, foreign-project and Orchestratorin reader slots open and persist their credential",
      readerAdds.every((x) => x === 0) && readerOpens.every((x) => x === 200) && readerRows.every(credentialed),
      `worktrees=${readerAdds.join(",")} opens=${readerOpens.join(",")} ${JSON.stringify(readerRows.map((x) => ({ cwd: x.cwd, token: credentialed(x) })))}`);
    const opened = addWt.status === 0 && wt.ok && rows.every(credentialed) && readerRows.every(credentialed);
    // a red SETUP row leaves everything below unmeasured, not violated — stop here rather than print it
    if (!opened) return;

    // THE BINDINGS ARE SERVER FACTS, planted as such: an active Program bound to slot 1's exact occupant,
    // and the lane's task row in that Program
    await stop(i);
    const now = Date.now();
    const planted = readState();
    planted.programs = [{ id: PROGRAM, title: "Konzept fixture", intent: "write konzepte", successCriterion: "ledger",
      nonGoals: [], decisions: [], evidence: [], openQuestions: [], status: "active", createdAt: now - 1000,
      proposedBy: { kind: "owner" }, confirmedAt: now - 900, activatedAt: now - 800,
      main: { slot: 1, openedAt: rows[0]!.openedAt, sessionId: rows[0]!.sessionId ?? null, boundAt: now - 700 } }];
    planted.tasks = [{ id: TASK, text: "konzept lane task", source: "owner", from: null, kind: "auftrag", repo,
      status: "sent", created: now - 600, slot: LANE, note: null, programId: PROGRAM }];
    planted.slots[String(LANE)] = { ...planted.slots[String(LANE)], taskId: TASK, programId: PROGRAM,
      worktree: { repo, branch: BRANCH } };
    // the same binding as LANE but the adapter (claude = harness null), and one lane on another repository
    for (const [k, r, b] of readerWt)
      planted.slots[String(k)] = { ...planted.slots[String(k)], programId: PROGRAM, worktree: { repo: r, branch: b },
        harness: k === CODEX_LANE ? "codex" : k === PI_LANE ? "pi-zai" : null };
    writeFileSync(`${i.dir}/fleet.json`, JSON.stringify(planted, null, 2), { mode: 0o600 });
    up = await boot(i, bin);
    check("konzepte fixture: the instance boots again over the planted Program binding", up, i.log.slice(-300));
    if (!up) return;
    const [mainTok, laneTok, plainTok] = rows.map((x) => x.selfToken ?? "");
    const pos = async (tok: string) => ((await call("/api/self", "GET", { "x-fleet-self-token": tok })).body as { position?: { role?: string } }).position?.role;
    const [mainRole, laneRole, plainRole] = [await pos(mainTok!), await pos(laneTok!), await pos(plainTok!)];
    const resolved = mainRole === "program-main" && laneRole === "lane" && plainRole === "generic";
    check("konzepte fixture: the three credentials resolve to program-main, lane and generic", resolved,
      `${mainRole} ${laneRole} ${plainRole}`);
    if (!resolved) return;

    // ---- forged provenance: a body naming actor or kontext is a 400 and writes nothing
    const v1 = place(1, "# Konzept v1\n");
    const forgedV = await self(laneTok!, "versionen", "POST", version(v1, { actor: { kind: "owner", via: "bearer" } }));
    const forgedA = await self(mainTok!, "anmerkungen", "POST", { version: 1, text: "x", kontext: { slot: 9 } });
    const forgedO = await owner("versionen", "POST", version(v1, { actor: { kind: "session", slot: 2 }, kontext: {} }));
    check("konzepte forged provenance: a body with actor or kontext is 400 on every door and appends nothing",
      forgedV.status === 400 && /actor/.test(forgedV.body.error ?? "") && forgedA.status === 400 && /kontext/.test(forgedA.body.error ?? "")
        && forgedO.status === 400 && versionLines().length === 0 && anmerkungLines().length === 0,
      `lane=${forgedV.status} ${forgedV.body.error} main=${forgedA.status} ${forgedA.body.error} owner=${forgedO.status} lines=${versionLines().length}/${anmerkungLines().length}`);

    // ---- the file check: N is last+1, and v<N>.md must exist and hash to the body's sha256
    const wrongSha = await self(laneTok!, "versionen", "POST", version(sha("something else")));
    // ---- lane actor: the lane writes version 1 as itself, with its binding as kontext
    const laneV = await self(laneTok!, "versionen", "POST", version(v1));
    const lv = laneV.body.version;
    const laneOpenedAt = rows[1]!.openedAt;
    const laneActor = JSON.stringify({ kind: "session", slot: LANE, openedAt: laneOpenedAt, role: "lane" });
    check("konzepte file check: a sha256 that v<N>.md does not hash to is 409 and writes nothing",
      wrongSha.status === 409 && /v1\.md hashes to/.test(wrongSha.body.error ?? ""), `${wrongSha.status} ${wrongSha.body.error}`);
    check("konzepte lane actor: the lane token writes as session/lane with slot, openedAt, branch, task and Program",
      laneV.status === 200 && lv?.version === 1 && lv.vorgaenger === null && lv.sha256 === v1
        && JSON.stringify(lv.actor) === laneActor
        && lv.kontext.slot === LANE && lv.kontext.openedAt === laneOpenedAt && lv.kontext.branch === BRANCH
        && lv.kontext.task === TASK && lv.kontext.program === PROGRAM
        && lv.zugriff !== "fleet" && lv.zugriff?.program === PROGRAM
        && JSON.stringify(versionLines()[0]?.actor) === JSON.stringify(lv.actor),
      `${laneV.status} ${JSON.stringify(laneV.body).slice(0, 500)}`);
    const missing = await self(laneTok!, "versionen", "POST", version(v1));
    check("konzepte file check: the next N without its v<N>.md is 409 naming the file",
      missing.status === 409 && (missing.body.error ?? "").includes(`${K}/v2.md does not exist`), `${missing.status} ${missing.body.error}`);

    // ---- main actor, owner actor
    const mainA = await self(mainTok!, "anmerkungen", "POST", { version: 1, text: "MAIN-Anmerkung", anker: { abschnitt: "Schema" } });
    const ma = mainA.body.anmerkung;
    check("konzepte main actor: the MAIN token writes as session/main with its Program as kontext and no lane keys",
      mainA.status === 200 && ma?.status === "offen" && /^[0-9a-f]{16}$/.test(ma.id)
        && JSON.stringify(ma.actor) === JSON.stringify({ kind: "session", slot: 1, openedAt: rows[0]!.openedAt, role: "main" })
        && ma.kontext.program === PROGRAM && ma.kontext.slot === 1 && ma.kontext.branch === undefined && ma.kontext.task === undefined,
      `${mainA.status} ${JSON.stringify(mainA.body).slice(0, 500)}`);
    const ownerA = await owner("anmerkungen", "POST", { version: 1, text: "Owner-Anmerkung" });
    const oa = ownerA.body.anmerkung;
    check("konzepte owner actor: the owner token writes as owner with an empty kontext",
      ownerA.status === 200 && JSON.stringify(oa?.actor) === JSON.stringify({ kind: "owner", via: "bearer" })
        && JSON.stringify(oa?.kontext) === "{}",
      `${ownerA.status} ${JSON.stringify(ownerA.body).slice(0, 400)}`);
    const laneA = await self(laneTok!, "anmerkungen", "POST", { version: 1, text: "Lane-Anmerkung" });

    // ---- unknown version
    const unknownV = await self(mainTok!, "anmerkungen", "POST", { version: 9, text: "haengt an nichts" });
    check("konzepte unknown version: an anmerkung on a version the ledger does not hold is 409",
      unknownV.status === 409 && /has no version 9/.test(unknownV.body.error ?? "") && anmerkungLines().length === 3,
      `${unknownV.status} ${unknownV.body.error} lines=${anmerkungLines().length}`);

    // ---- konzept id
    const badIds = ["K-upper", "x-abc", "k-", `k-${"a".repeat(65)}`, "k-a_b", "k-..%2Fx"];
    const idAnswers = await Promise.all(badIds.map((id) => owner("anmerkungen", "POST", { version: 1, text: "x" }, id)));
    const selfIdAnswers = await Promise.all(badIds.map((id) => self(laneTok!, "versionen", "GET", undefined, id)));
    check("konzepte konzept id: every id outside ^k-[a-z0-9-]{1,64}$ is 400 on both doors",
      [...idAnswers, ...selfIdAnswers].every((a) => a.status === 400),
      `owner=${idAnswers.map((a) => a.status).join(",")} self=${selfIdAnswers.map((a) => a.status).join(",")}`);

    // ---- verworfen needs grund and carries the actor who set it
    const noGrund = await self(laneTok!, `anmerkungen/${oa?.id}/verwerfen`, "POST", {});
    const verw = await self(laneTok!, `anmerkungen/${oa?.id}/verwerfen`, "POST", { grund: "doppelt" });
    const again = await owner(`anmerkungen/${oa?.id}/verwerfen`, "POST", { grund: "nochmal" });
    const folded = (await owner("anmerkungen", "GET")).body.anmerkungen ?? [];
    const vStatus = folded.find((a) => a.id === oa?.id)?.status;
    check("konzepte verworfen: without grund 400, with grund the status carries grund and the verwerfer's actor",
      noGrund.status === 400 && verw.status === 200 && again.status === 409
        && typeof vStatus === "object" && "verworfen" in vStatus && vStatus.verworfen === "doppelt"
        && JSON.stringify(vStatus.actor) === laneActor,
      `noGrund=${noGrund.status} verw=${verw.status} again=${again.status} status=${JSON.stringify(vStatus)}`);

    // ---- arbeitetEin folds each named anmerkung to eingearbeitet; ebene default projekt
    const v2 = place(2, "# Konzept v2\n");
    const ghost = await self(mainTok!, "versionen", "POST", version(v2, { arbeitetEin: ["0123456789abcdef"] }));
    const mainV = await self(mainTok!, "versionen", "POST", version(v2, { arbeitetEin: [ma?.id, laneA.body.anmerkung?.id] }));
    const after = (await self(mainTok!, "anmerkungen", "GET")).body.anmerkungen ?? [];
    const ein = (id: string | undefined) => JSON.stringify(after.find((a) => a.id === id)?.status);
    check("konzepte arbeitetEin: a version naming anmerkungen sets each of them to eingearbeitet at that version",
      ghost.status === 409 && mainV.status === 200 && mainV.body.version?.version === 2 && mainV.body.version.vorgaenger === 1
        && ein(ma?.id) === '{"eingearbeitet":2}' && ein(laneA.body.anmerkung?.id) === '{"eingearbeitet":2}'
        && typeof after.find((a) => a.id === oa?.id)?.status === "object",
      `ghost=${ghost.status} v2=${mainV.status} main=${ein(ma?.id)} lane=${ein(laneA.body.anmerkung?.id)}`);

    // ---- ebene and geltung
    const v3 = place(3, "# Konzept v3\n");
    const ebeneBad = await owner("versionen", "POST", version(v3, { ebene: "team" }));
    const geltungLong = await owner("versionen", "POST", version(v3, { geltung: "g".repeat(201) }));
    const geltungNum = await owner("versionen", "POST", version(v3, { geltung: 42 }));
    const ebeneOk = await owner("versionen", "POST", version(v3, { ebene: "strang", geltung: "g".repeat(200) }));
    check("konzepte ebene: outside arbeit|strang|projekt|portfolio|owner is 400, absent is projekt, a listed one is kept",
      ebeneBad.status === 400 && mainV.body.version?.ebene === "projekt" && ebeneOk.status === 200 && ebeneOk.body.version?.ebene === "strang",
      `bad=${ebeneBad.status} default=${mainV.body.version?.ebene} strang=${ebeneOk.status} ${ebeneOk.body.version?.ebene}`);
    check("konzepte geltung: longer than 200 chars or not a string is 400, 200 chars are kept",
      geltungLong.status === 400 && geltungNum.status === 400 && ebeneOk.body.version?.geltung.length === 200,
      `long=${geltungLong.status} num=${geltungNum.status} kept=${ebeneOk.body.version?.geltung.length}`);

    // ---- concurrency: eight version POSTs and eight anmerkung POSTs at once, over identical fassungen
    // v4..v11, so every order is valid and only a lost line or a doubled N can fail it
    const same = "# Konzept, gleiche Fassung\n";
    for (let n = 4; n <= 11; n++) place(n, same);
    const burst = await Promise.all([
      ...Array.from({ length: 8 }, (_, n) => (n % 2 ? self(laneTok!, "versionen", "POST", version(sha(same)))
        : self(mainTok!, "versionen", "POST", version(sha(same))))),
      ...Array.from({ length: 8 }, (_, n) => owner("anmerkungen", "POST", { version: 1, text: `burst ${n}` })),
    ]);
    const got = burst.slice(0, 8).map((a) => a.body.version?.version).sort((a, b) => (a ?? 0) - (b ?? 0));
    const vl = versionLines().map((r) => r.version as number);
    const al = anmerkungLines().filter((r) => r.art === "anmerkung");
    check("konzepte concurrency: simultaneous POSTs lose no line and never hand out an N twice",
      burst.every((a) => a.status === 200) && JSON.stringify(got) === "[4,5,6,7,8,9,10,11]"
        && JSON.stringify(vl) === "[1,2,3,4,5,6,7,8,9,10,11]"
        && versionLines().every((r, n) => r.vorgaenger === (n === 0 ? null : n))
        && al.length === 11 && new Set(al.map((r) => r.id)).size === 11,
      `statuses=${burst.map((a) => a.status).join(",")} got=${JSON.stringify(got)} lines=${JSON.stringify(vl)} anmerkungen=${al.length}`);

    // ---- read doors
    const ownerRead = await owner("versionen", "GET");
    const laneRead = await self(laneTok!, "versionen", "GET");
    check("konzepte read: owner and self doors serve the same versions, latest 11, nothing malformed",
      ownerRead.status === 200 && laneRead.status === 200 && ownerRead.body.letzte === 11 && ownerRead.body.malformed === 0
        && JSON.stringify(ownerRead.body.versionen) === JSON.stringify(laneRead.body.versionen),
      `${ownerRead.status}/${laneRead.status} letzte=${ownerRead.body.letzte} malformed=${ownerRead.body.malformed}`);

    // ---- index (the board's list): konzept dirs only, the latest version row and the fold's counts, no content
    mkdirSync(`${i.root}/k-e2e-leer`, { recursive: true });
    mkdirSync(`${i.root}/kein-konzept`, { recursive: true });
    const idx = await call("/api/konzepte", "GET", OH);
    const idxBody = idx.body as { konzepte?: { konzept: string; letzte: KonzeptVersion | null; versionen: number;
      anmerkungen: { offen: number; eingearbeitet: number; verworfen: number } }[] };
    const row = idxBody.konzepte?.find((k) => k.konzept === K);
    const idxSelf = await call("/api/konzepte", "GET", { "x-fleet-self-token": laneTok! });
    const idxBoth = await call("/api/konzepte", "GET", { ...OH, "x-fleet-self-token": laneTok! });
    check("konzepte index: GET /api/konzepte lists konzept dirs only, with the latest version and the folded counts, never a fassung",
      idx.status === 200 && JSON.stringify(idxBody.konzepte?.map((k) => k.konzept)) === JSON.stringify(["k-e2e-konzept", "k-e2e-leer"])
        && row?.letzte?.version === 11 && row.versionen === 11
        && JSON.stringify(row.anmerkungen) === '{"offen":8,"eingearbeitet":2,"verworfen":1}'
        && idxBody.konzepte?.find((k) => k.konzept === "k-e2e-leer")?.letzte === null
        && !JSON.stringify(idx.body).includes("# Konzept") && idxSelf.status === 401 && idxBoth.status === 200
        && JSON.stringify(idxBoth.body) === JSON.stringify(idx.body),
      `${idx.status} self=${idxSelf.status} both=${idxBoth.status} ${JSON.stringify(idx.body).slice(0, 500)}`);

    // ---- scope: a plain session passes the door but not the Program scope of K, no token 401
    const kAnmerkungen = anmerkungLines().length;
    const plainW = await self(plainTok!, "anmerkungen", "POST", { version: 1, text: "x" });
    const plainR = await self(plainTok!, "versionen", "GET");
    const anon = await call(`/api/self/konzepte/${K}/versionen`, "GET", {});
    const anonOwner = await call(`/api/konzepte/${K}/versionen`, "GET", {});
    check("konzepte scope: a plain session is 403 on another Program's konzept on both verbs, appends nothing, a missing credential 401 on both doors",
      plainW.status === 403 && plainR.status === 403 && /^konzept-program-forbidden:/.test(plainW.body.error ?? "")
        && anmerkungLines().length === kAnmerkungen && anon.status === 401 && anonOwner.status === 401,
      `plain=${plainW.status}/${plainR.status} ${plainW.body.error} anon=${anon.status}/${anonOwner.status}`);

    // ---- the owner's heft (k-owner-korrekturen): only the owner publishes, one fassung replaces entries of
    // an earlier one in ONE append. Synthetic entries only — ok-a, ok-b, … say nothing about anyone.
    const OK = "k-owner-korrekturen";
    mkdirSync(`${i.root}/${OK}`, { recursive: true });
    const ALL = { projekte: "*", rollen: "*", harnesses: "*", modi: "*" };
    const eintrag = (id: string, ersetzt: string[] = [], geltung: Record<string, unknown> = ALL) =>
      ({ id, aussage: `synthetische Aussage ${id}`, quelle: "fixture.md#abschnitt", geltung, ersetzt });
    const heftText = (heft: unknown): string => `# Owner-Korrekturen (Fixture)\n\n\`\`\`owner-korrekturen\n${JSON.stringify(heft, null, 2)}\n\`\`\`\n`;
    const placeOK = (n: number, heft: unknown): string => { const t = typeof heft === "string" ? heft : heftText(heft); writeFileSync(`${i.root}/${OK}/v${n}.md`, t); return sha(t); };
    const okLines = () => jsonl(`${i.root}/${OK}/versionen.jsonl`);
    const ownerOK = (body: unknown) => owner("versionen", "POST", body, OK);
    type Folded = { id: string; status: string; abgeloestDurch?: string; grund?: string };
    const foldOf = (a: Answer) => ((a.body as { eintraege?: Folded[] }).eintraege ?? []).map((e) =>
      `${e.id}:${e.status}${e.abgeloestDurch ? `>${e.abgeloestDurch}` : ""}${e.grund ? `!${e.grund}` : ""}`).join(" ");

    const ok1 = placeOK(1, { eintraege: [eintrag("ok-a")] });
    const laneOK = await self(laneTok!, "versionen", "POST", version(ok1), OK);
    const mainOK = await self(mainTok!, "versionen", "POST", version(ok1, { ebene: "owner" }), OK);
    check("konzepte owner heft: a fassung of k-owner-korrekturen from the lane or the bound MAIN is 403 naming the owner's door, nothing appended",
      laneOK.status === 403 && mainOK.status === 403 && /only from the owner/.test(laneOK.body.error ?? "")
        && /a lane proposes/.test(laneOK.body.error ?? "") && /a main proposes/.test(mainOK.body.error ?? "") && okLines().length === 0,
      `lane=${laneOK.status} ${laneOK.body.error} main=${mainOK.status} ${mainOK.body.error} lines=${okLines().length}`);

    const ebeneOK = await ownerOK(version(ok1, { ebene: "projekt" }));
    const erwBad = await ownerOK(version(ok1, { erwartet: "1" }));
    const erwAhead = await ownerOK(version(ok1, { erwartet: 1 }));
    const ownerV1 = await ownerOK(version(ok1, { erwartet: null }));
    const row1 = JSON.stringify(okLines()[0] ?? null);
    const erwStale = await ownerOK(version(ok1, { erwartet: null }));
    check("konzepte owner heft: the owner publishes v1 as ebene owner with its entries folded; another ebene is 400",
      ebeneOK.status === 400 && ownerV1.status === 200 && ownerV1.body.version?.ebene === "owner"
        && JSON.stringify(ownerV1.body.version?.actor) === JSON.stringify({ kind: "owner", via: "bearer" })
        && foldOf(ownerV1) === "ok-a:gilt" && okLines().length === 1,
      `ebene=${ebeneOK.status} v1=${ownerV1.status} ${JSON.stringify(ownerV1.body).slice(0, 400)}`);
    check("konzepte erwartet: a wrong expected predecessor is 409 under the lock, a malformed one 400, and neither appends",
      erwBad.status === 400 && erwAhead.status === 409 && /no version yet, the body expects version 1/.test(erwAhead.body.error ?? "")
        && erwStale.status === 409 && /is at version 1, the body expects none yet/.test(erwStale.body.error ?? "") && okLines().length === 1,
      `bad=${erwBad.status} ahead=${erwAhead.status} ${erwAhead.body.error} stale=${erwStale.status} ${erwStale.body.error} lines=${okLines().length}`);

    // ---- ersetzt: v2 carries ok-a unchanged and ok-b replacing it — ONE append, v1 untouched
    const v1Bytes = readFileSync(`${i.root}/${OK}/v1.md`, "utf8");
    const base = [eintrag("ok-a"), eintrag("ok-b", ["ok-a"])];
    const ok2 = placeOK(2, { eintraege: base });
    const ownerV2 = await ownerOK(version(ok2, { erwartet: 1 }));
    check("konzepte ersetzt: v2 with ok-b ersetzt [ok-a] folds ok-a to veraltet abgeloestDurch ok-b in one append",
      ownerV2.status === 200 && ownerV2.body.version?.vorgaenger === 1 && foldOf(ownerV2) === "ok-a:veraltet>ok-b ok-b:gilt"
        && okLines().length === 2,
      `${ownerV2.status} ${JSON.stringify(ownerV2.body).slice(0, 500)}`);
    check("konzepte ersetzt: the bytes of fassung 1 and its ledger row stay as they were",
      readFileSync(`${i.root}/${OK}/v1.md`, "utf8") === v1Bytes && sha(v1Bytes) === okLines()[0]?.sha256
        && JSON.stringify(okLines()[0]) === row1,
      `file=${readFileSync(`${i.root}/${OK}/v1.md`, "utf8") === v1Bytes} row=${JSON.stringify(okLines()[0]) === row1}`);

    // ---- each refusal of the graph: v3 is placed, the owner's POST is 409 with its own sentence, nothing appended
    const refusedV3 = async (heft: unknown): Promise<Answer> => ownerOK(version(placeOK(3, heft), { erwartet: 2 }));
    const refusals: [string, unknown, RegExp][] = [
      ["self-replacement", { eintraege: [...base, eintrag("ok-c", ["ok-c"])] }, /entry ok-c ersetzt itself/],
      ["unknown id", { eintraege: [...base, eintrag("ok-c", ["ok-x"])] }, /ersetzt unknown entry ok-x/],
      ["cycle", { eintraege: [...base, eintrag("ok-c", ["ok-d"]), eintrag("ok-d", ["ok-c"])] }, /ersetzt forms a cycle: ok-d → ok-c → ok-d/],
      ["duplicate id", { eintraege: [...base, eintrag("ok-c"), eintrag("ok-c")] }, /entry id ok-c appears twice/],
      ["two successors", { eintraege: [...base, eintrag("ok-c", ["ok-b"]), eintrag("ok-d", ["ok-b"])] }, /entry ok-b has two successors: ok-c and ok-d/],
      ["a second successor of a replaced entry", { eintraege: [...base, eintrag("ok-c", ["ok-a"])] }, /entry ok-a has two successors: ok-b and ok-c/],
      ["another geltung", { eintraege: [...base, eintrag("ok-c", ["ok-b"], { ...ALL, harnesses: ["codex"] })] }, /different geltung/],
      ["a published entry changed", { eintraege: [eintrag("ok-a"), { ...eintrag("ok-b", ["ok-a"]), aussage: "umgeschrieben" }] }, /entry ok-b of the previous fassung is missing or changed/],
      ["withdrawn and replaced at once", { eintraege: [...base, eintrag("ok-c", ["ok-b"])], zurueckgezogen: [{ id: "ok-b", grund: "synthetisch" }] },
        /entry ok-b is withdrawn and replaced by ok-c at once/],
      ["no heft block", "# ohne Block\n", /exactly one ```owner-korrekturen block \(found 0\)/],
    ];
    for (const [name, heft, re] of refusals) {
      const a = await refusedV3(heft);
      check(`konzepte ersetzt refusal: ${name} is 409 with its own sentence and appends nothing`,
        a.status === 409 && re.test(a.body.error ?? "") && okLines().length === 2, `${a.status} ${a.body.error} lines=${okLines().length}`);
    }
    // the fassung a new one follows must still be the published one
    const v2Path = `${i.root}/${OK}/v2.md`;
    const v2Bytes = readFileSync(v2Path, "utf8");
    writeFileSync(v2Path, `${v2Bytes}\nnachtraeglich\n`);
    const drift = await refusedV3({ eintraege: [...base, eintrag("ok-c")] });
    writeFileSync(v2Path, v2Bytes);
    check("konzepte ersetzt refusal: a previous fassung changed after its append is no basis — 409, nothing appended",
      drift.status === 409 && /v2\.md is missing or no longer hashes to its ledger row/.test(drift.body.error ?? "") && okLines().length === 2,
      `${drift.status} ${drift.body.error}`);
    const ownerV3 = await refusedV3({ eintraege: base, zurueckgezogen: [{ id: "ok-b", grund: "synthetisch zurueckgezogen" }] });
    check("konzepte zurueckgezogen: a withdrawal in v3 folds ok-b to verworfen with its grund, ok-a stays veraltet",
      ownerV3.status === 200 && foldOf(ownerV3) === "ok-a:veraltet>ok-b ok-b:verworfen!synthetisch zurueckgezogen" && okLines().length === 3,
      `${ownerV3.status} ${JSON.stringify(ownerV3.body).slice(0, 400)}`);

    // ================================================================================================
    // THE LESEANSICHT (Karte 2 von 3): one read door for every harness, scoped by the session's binding.
    // v4 adds synthetic entries along each geltung axis to the published v3; every reader's answer is
    // compared as ids, and every refusal must be named and carry no entry list and no entry text.
    async function leseansicht(): Promise<void> {
      const [codexTok, piTok, fremdTok, orchTok] = readerRows.map((x) => x.selfToken ?? "");
      type Lese = { konzept?: string; version?: number; sha256?: string; error?: string;
        geltendeEintraege?: { id: string; aussage: string; geltung: unknown; ersetzt: string[] }[];
        status?: { gilt: number; veraltet: { id: string; abgeloestDurch: string }[]; verworfen: { id: string; grund: string }[] };
        bindung?: { projekt: string; rolle: string; harness: string };
        ausloeser?: { id: string; modi: string[]; wann: string }[]; volllesen?: string; nichtGefiltert?: unknown;
        eintrag?: { id: string; aussage: string; geltung: unknown; ersetzt: string[] } };
      const lese = async (tok: string, q = "", k = OK): Promise<{ status: number; body: Lese; raw: string }> => {
        const r = await fetch(`${i.base}/api/self/konzepte/${k}/leseansicht${q}`, { headers: { "x-fleet-self-token": tok } });
        const raw = await r.text();
        let body: Lese = {};
        try { body = JSON.parse(raw) as Lese; } catch { /* raw kept for the detail */ }
        return { status: r.status, body, raw };
      };
      const ids = (a: { body: Lese }) => (a.body.geltendeEintraege ?? []).map((e) => e.id).join(" ");
      // a refusal carries a name and NOTHING of the heft: no list key, no entry text, no private quelle
      const empty = (a: { body: Lese; raw: string }) => !a.raw.includes("geltendeEintraege") && !a.raw.includes("synthetische Aussage")
        && !a.raw.includes("fixture.md") && typeof a.body.error === "string";

      const roles = await Promise.all([codexTok, piTok, fremdTok, orchTok].map((t) => pos(t)));
      check("konzepte leseansicht fixture: the reader slots resolve to lane, lane, lane and orchestrator",
        JSON.stringify(roles) === '["lane","lane","lane","orchestrator"]', JSON.stringify(roles));
      // the projects are the server's opaque projectKeys, read from v3's answer to one reader per repository
      const p1 = (await lese(laneTok!)).body.bindung?.projekt ?? "";
      const p2 = (await lese(fremdTok!)).body.bindung?.projekt ?? "";
      check("konzepte leseansicht fixture: the Fleet lane and the foreign lane read v3 with two different 16-hex projects",
        /^[0-9a-f]{16}$/.test(p1) && /^[0-9a-f]{16}$/.test(p2) && p1 !== p2, `${p1} ${p2}`);
      const ax = (over: Record<string, unknown>) => ({ ...ALL, ...over });
      const v4Heft = { eintraege: [...base, eintrag("ok-alle"), eintrag("ok-projekt", [], ax({ projekte: [p1] })),
        eintrag("ok-fremd", [], ax({ projekte: [p2] })), eintrag("ok-drei", [], ax({ harnesses: ["claude", "codex", "pi-zai"] })),
        eintrag("ok-container", [], ax({ harnesses: ["container"] })), eintrag("ok-lane", [], ax({ rollen: ["lane"] })),
        eintrag("ok-main", [], ax({ rollen: ["program-main"] })), eintrag("ok-orch", [], ax({ rollen: ["orchestrator"] })),
        eintrag("ok-alt"), eintrag("ok-neu", ["ok-alt"])],
        zurueckgezogen: [{ id: "ok-b", grund: "synthetisch zurueckgezogen" }] };
      const v4Sha = placeOK(4, v4Heft);
      const ownerV4 = await ownerOK(version(v4Sha, { erwartet: 3 }));
      check("konzepte leseansicht fixture: the owner publishes v4 with one synthetic entry per geltung axis",
        ownerV4.status === 200 && ownerV4.body.version?.version === 4, `${ownerV4.status} ${ownerV4.body.error ?? ""}`);
      if (ownerV4.status !== 200) return;

      // ---- harness parity: claude, codex and pi-zai lanes with the same binding read the same entries
      const [claudeL, codexL, piL] = [await lese(laneTok!), await lese(codexTok!), await lese(piTok!)];
      const sameView = (a: { body: Lese }) => JSON.stringify({ e: a.body.geltendeEintraege, s: a.body.status, v: a.body.version, h: a.body.sha256 });
      check("konzepte leseansicht harness parity: claude, codex and pi-zai lanes of one binding read the same v4 entries",
        claudeL.status === 200 && codexL.status === 200 && piL.status === 200 && claudeL.body.konzept === OK
          && claudeL.body.version === 4 && claudeL.body.sha256 === v4Sha && ids(claudeL) === "ok-alle ok-projekt ok-drei ok-lane ok-neu"
          && sameView(claudeL) === sameView(codexL) && sameView(claudeL) === sameView(piL)
          && JSON.stringify([claudeL, codexL, piL].map((a) => a.body.bindung?.harness)) === '["claude","codex","pi-zai"]',
        `${claudeL.status}/${codexL.status}/${piL.status} claude=[${ids(claudeL)}] codex=[${ids(codexL)}] pi=[${ids(piL)}] ${JSON.stringify([claudeL, codexL, piL].map((a) => a.body.bindung))}`);
      check("konzepte leseansicht filter: only gilt entries of the reader's geltung, never a veraltet one or a private quelle; status names the replaced ids",
        JSON.stringify(claudeL.body.status) === JSON.stringify({ gilt: 5, veraltet: [{ id: "ok-a", abgeloestDurch: "ok-b" }, { id: "ok-alt", abgeloestDurch: "ok-neu" }],
          verworfen: [{ id: "ok-b", grund: "synthetisch zurueckgezogen" }] })
          && !claudeL.raw.includes("fixture.md") && !claudeL.raw.includes("synthetische Aussage ok-fremd")
          && !claudeL.raw.includes("synthetische Aussage ok-container") && !claudeL.raw.includes("synthetische Aussage ok-alt\""),
        `${JSON.stringify(claudeL.body.status)} quelle=${claudeL.raw.includes("fixture.md")}`);

      // ---- the bound MAIN and the Orchestratorin read — their role's entries, nothing more
      const mainL = await lese(mainTok!);
      const orchL = await lese(orchTok!);
      check("konzepte leseansicht main / orch: the bound MAIN and the Orchestratorin read v4 with their own role's entries",
        mainL.status === 200 && ids(mainL) === "ok-alle ok-projekt ok-drei ok-main ok-neu" && mainL.body.bindung?.rolle === "program-main"
          && orchL.status === 200 && ids(orchL) === "ok-alle ok-projekt ok-drei ok-orch ok-neu" && orchL.body.bindung?.rolle === "orchestrator",
        `main=${mainL.status} [${ids(mainL)}] ${mainL.body.error ?? ""} orch=${orchL.status} [${ids(orchL)}] ${orchL.body.error ?? ""}`);
      // ---- any session annotates (direction step 3): the Orchestratorin and a plain session post an anmerkung
      // on the owner's heft, recorded as their own Principal with the credential's kontext and no binding keys
      const okAnmerkungen = () => jsonl(`${i.root}/${OK}/anmerkungen.jsonl`);
      const orchW = await self(orchTok!, "anmerkungen", "POST", { version: 4, text: "Orchestratorin-Anmerkung" }, OK);
      const plainA = await self(plainTok!, "anmerkungen", "POST", { version: 4, text: "freie Anmerkung" }, OK);
      const orchR = await self(orchTok!, "versionen", "GET", undefined, OK);
      const plainRA = await self(plainTok!, "anmerkungen", "GET", undefined, OK);
      const recorded = (a: Answer, slot: number, openedAt: number | undefined): boolean => {
        const row = okAnmerkungen().find((r) => r.id === a.body.anmerkung?.id) as KonzeptAnmerkung | undefined;
        return a.status === 200 && a.body.anmerkung?.status === "offen" && row !== undefined
          && JSON.stringify(row.actor) === JSON.stringify({ kind: "session", slot, openedAt, role: "generic" })
          && row.kontext.slot === slot && row.kontext.openedAt === openedAt
          && Object.keys(row.kontext).every((k) => ["slot", "openedAt", "session"].includes(k));
      };
      check("konzepte any session: the Orchestratorin and a plain session annotate the owner's heft as session/generic with the credential's kontext, and read it",
        recorded(orchW, ORCH, readerRows[3]!.openedAt) && recorded(plainA, 3, rows[2]!.openedAt)
          && orchR.status === 200 && orchR.body.letzte === 4 && plainRA.status === 200
          && [orchW, plainA].every((a) => plainRA.body.anmerkungen?.some((x) => x.id === a.body.anmerkung?.id)),
        `orch=${orchW.status} ${orchW.body.error ?? JSON.stringify(orchW.body.anmerkung)} plain=${plainA.status} ${plainA.body.error ?? ""} read=${orchR.status}/${plainRA.status}`);
      // ---- versions stay where they were: the owner's heft takes a fassung from the owner alone, and a
      // session that is neither lane nor MAIN publishes none and discards none
      const okBefore = okLines().length;
      const okAnmBefore = okAnmerkungen().length;
      const orchV = await self(orchTok!, "versionen", "POST", version(v4Sha), OK);
      const plainV = await self(plainTok!, "versionen", "POST", version(v4Sha), OK);
      const orchD = await self(orchTok!, `anmerkungen/${orchW.body.anmerkung?.id}/verwerfen`, "POST", { grund: "selbst" }, OK);
      const mainV = await self(mainTok!, "versionen", "POST", version(v4Sha), OK);
      check("konzepte any session versions stay: the Orchestratorin and a plain session are 409 on a fassung and on verwerfen, the MAIN still 403, nothing appended",
        orchV.status === 409 && plainV.status === 409 && orchD.status === 409 && /lane or by the bound MAIN/.test(orchV.body.error ?? "")
          && mainV.status === 403 && okLines().length === okBefore && okAnmerkungen().length === okAnmBefore,
        `orch=${orchV.status}/${orchD.status} ${orchV.body.error} plain=${plainV.status} main=${mainV.status} lines=${okLines().length - okBefore}/${okAnmerkungen().length - okAnmBefore}`);

      // ---- wrong project: the foreign lane reads its own project's entry and none of the Fleet project's bytes
      const fremdL = await lese(fremdTok!);
      check("konzepte leseansicht wrong project: a lane on another repository gets ok-fremd and not one byte of ok-projekt",
        fremdL.status === 200 && ids(fremdL) === "ok-alle ok-fremd ok-drei ok-lane ok-neu" && fremdL.body.bindung?.projekt === p2
          && !fremdL.raw.includes("synthetische Aussage ok-projekt") && !fremdL.raw.includes(p1),
        `${fremdL.status} [${ids(fremdL)}]`);
      const asked = await lese(laneTok!, `?projekt=${p2}`);
      const askedRolle = await lese(fremdTok!, "?rolle=orchestrator&harness=container");
      check("konzepte leseansicht request scope: a query naming projekt, rolle or harness is 400 and serves no bytes",
        asked.status === 400 && empty(asked) && /never from the request/.test(asked.body.error ?? "")
          && askedRolle.status === 400 && empty(askedRolle) && /rolle, harness/.test(askedRolle.body.error ?? ""),
        `${asked.status} ${asked.body.error} ${askedRolle.status} ${askedRolle.body.error}`);

      // ---- free and recycled sessions: no bytes
      const freeL = await lese(plainTok!);
      await fetch(`${i.base}/api/slots/3/kill`, { method: "POST", headers: OH, body: "{}" });
      await fetch(`${i.base}/api/slots/3/open`, { method: "POST", headers: OH, body: JSON.stringify({ cwd: repo, label: "konzept-recycelt" }) });
      let freshTok = "";
      for (let n = 0; n < 300 && !freshTok; n++) {
        const t = readState().slots["3"]?.selfToken ?? "";
        if (/^[0-9a-f]{32}$/.test(t) && t !== plainTok) freshTok = t;
        else await Bun.sleep(100);
      }
      const staleL = await lese(plainTok!);
      const freshL = await lese(freshTok);
      check("konzepte leseansicht free / recycled: a free session is 409, the recycled slot's old token 401, its new free occupant 409 — none gets bytes",
        freeL.status === 409 && empty(freeL) && /none of them/.test(freeL.body.error ?? "") && staleL.status === 401 && empty(staleL)
          && freshTok !== "" && freshL.status === 409 && empty(freshL),
        `free=${freeL.status} ${freeL.body.error} stale=${staleL.status} fresh=${freshTok ? freshL.status : "no token"} ${freshL.body.error ?? ""}`);

      // ---- named refusals: each a status and a sentence, never a 200 with an empty list
      const okDir = `${i.root}/${OK}`;
      const v4Path = `${okDir}/v4.md`;
      const v4Text = readFileSync(v4Path, "utf8");
      writeFileSync(v4Path, `${v4Text}\nnachtraeglich\n`);
      const drift = await lese(laneTok!);
      writeFileSync(v4Path, v4Text);
      renameSync(v4Path, `${v4Path}.away`);
      const noFile = await lese(codexTok!);
      renameSync(`${v4Path}.away`, v4Path);
      const ledger = readFileSync(`${okDir}/versionen.jsonl`, "utf8");
      writeFileSync(`${okDir}/versionen.jsonl`, `${ledger}${JSON.stringify({ ...okLines()[3], version: 5, vorgaenger: 4,
        actor: { kind: "session", slot: LANE, openedAt: 1, role: "lane" } })}\n`);
      const notOwner = await lese(piTok!);
      writeFileSync(`${okDir}/versionen.jsonl`, ledger);
      renameSync(`${okDir}/versionen.jsonl`, `${okDir}/versionen.jsonl.away`);
      const noRow = await lese(mainTok!);
      renameSync(`${okDir}/versionen.jsonl.away`, `${okDir}/versionen.jsonl`);
      renameSync(okDir, `${okDir}.away`);
      const noDir = await lese(orchTok!);
      renameSync(`${okDir}.away`, okDir);
      const ownerDoor = await call(`/api/konzepte/${OK}/leseansicht`, "GET", OH);
      const otherK = await lese(laneTok!, "", K);
      const posted = await call(`/api/self/konzepte/${OK}/leseansicht`, "POST", { "x-fleet-self-token": laneTok! }, {});
      const named: [string, { status: number; body: Lese; raw: string }, number, RegExp][] = [
        ["hash drift", drift, 409, /^hash drift: k-owner-korrekturen\/v4\.md hashes to/],
        ["a missing fassung file", noFile, 409, /v4\.md is missing/],
        ["a newest ledger row not the owner's", notOwner, 409, /v5 was not published by the owner \(actor session\)/],
        ["no ledger row", noRow, 404, /no published fassung yet — that is not an empty heft/],
        ["no directory", noDir, 404, /no owner fassung exists yet, which is not an empty heft/],
        ["the owner door, which holds no binding", { status: ownerDoor.status, body: { error: ownerDoor.body.error }, raw: JSON.stringify(ownerDoor.body) },
          409, /filters by a session's binding/],
        ["another konzept", otherK, 404, /reads k-owner-korrekturen only/],
      ];
      for (const [name, a, st, re] of named)
        check(`konzepte leseansicht refusal: ${name} is ${st} with its own sentence and no entry bytes`,
          a.status === st && re.test(a.body.error ?? "") && empty(a), `${a.status} ${a.body.error ?? a.raw.slice(0, 200)}`);
      check("konzepte leseansicht refusal: a POST to the leseansicht is 404 (a read door only)", posted.status === 404, `${posted.status}`);
      const after = await lese(laneTok!);
      check("konzepte leseansicht refusal: every probe restored, the lane reads v4 again unchanged",
        after.status === 200 && sameView(after) === sameView(claudeL), `${after.status} ${after.body.error ?? ""}`);

      // ---- the modus fold (Owner 2026-10-09): v5 adds entries of named modes. modi "*" stays whole, a
      // moded entry of the reader's geltung becomes one trigger line, and GET …/leseansicht/<id> reads it
      // whole — through the same binding filter, so a moded entry of another role stays out of both. ok-lang
      // holds both cuts of wann: its first clause ends at "; ", and that clause is cut to eight words.
      const lang = { id: "ok-lang", aussage: "Erster Teil der synthetischen Aussage mit genau zehn Woertern hier; zweiter Teil nur im Volltext",
        quelle: "fixture.md#abschnitt", geltung: ax({ modi: ["synthetik-ui"] }), ersetzt: [] };
      const v5Heft = { ...v4Heft, eintraege: [...v4Heft.eintraege, eintrag("ok-modus", [], ax({ modi: ["synthetik-ui"] })),
        eintrag("ok-zwei-modi", [], ax({ modi: ["entwurf", "umsetzung"] })), lang,
        eintrag("ok-modus-orch", [], ax({ rollen: ["orchestrator"], modi: ["synthetik-ui"] }))] };
      const ownerV5 = await ownerOK(version(placeOK(5, v5Heft), { erwartet: 4 }));
      const [laneM, codexM, orchM] = [await lese(laneTok!), await lese(codexTok!), await lese(orchTok!)];
      const trig = (a: { body: Lese }) => (a.body.ausloeser ?? []).map((t) => t.id).join(" ");
      check("konzepte leseansicht modus fold: modi \"*\" whole, each moded entry of the binding one trigger line {id, modi, wann}, none dropped",
        ownerV5.status === 200 && laneM.status === 200 && laneM.body.version === 5
          && ids(laneM) === "ok-alle ok-projekt ok-drei ok-lane ok-neu"
          && JSON.stringify(laneM.body.ausloeser) === JSON.stringify([
            { id: "ok-modus", modi: ["synthetik-ui"], wann: "Bei synthetik-ui: synthetische Aussage ok-modus" },
            { id: "ok-zwei-modi", modi: ["entwurf", "umsetzung"], wann: "Bei entwurf oder umsetzung: synthetische Aussage ok-zwei-modi" },
            { id: "ok-lang", modi: ["synthetik-ui"], wann: "Bei synthetik-ui: Erster Teil der synthetischen Aussage mit genau zehn …" }])
          && laneM.body.status?.gilt === 8 && laneM.body.volllesen === "GET /api/self/konzepte/k-owner-korrekturen/leseansicht/<id>"
          && !("nichtGefiltert" in laneM.body) && !laneM.raw.includes("zweiter Teil nur im Volltext")
          && !laneM.raw.includes("ok-modus-orch") && !laneM.raw.includes("fixture.md")
          && JSON.stringify({ e: laneM.body.geltendeEintraege, t: laneM.body.ausloeser }) === JSON.stringify({ e: codexM.body.geltendeEintraege, t: codexM.body.ausloeser })
          && orchM.status === 200 && trig(orchM) === "ok-modus ok-zwei-modi ok-lang ok-modus-orch" && orchM.body.status?.gilt === 9,
        `${ownerV5.status} ${ownerV5.body.error ?? ""} lane=${laneM.status} [${ids(laneM)}] <${trig(laneM)}> gilt=${laneM.body.status?.gilt} orch=[${trig(orchM)}] ${JSON.stringify(laneM.body.ausloeser)}`);
      const fullLang = await lese(laneTok!, "/ok-lang");
      const fullCodex = await lese(codexTok!, "/ok-lang");
      const fullAlle = await lese(laneTok!, "/ok-alle");
      const fullForeign = await lese(laneTok!, "/ok-modus-orch");
      const fullOrch = await lese(orchTok!, "/ok-modus-orch");
      const fullAsked = await lese(laneTok!, "/ok-lang?rolle=orchestrator");
      const fullPosted = await call(`/api/self/konzepte/${OK}/leseansicht/ok-lang`, "POST", { "x-fleet-self-token": laneTok! }, {});
      const { quelle: _q, ...langServed } = lang;
      check("konzepte leseansicht volllesen: GET …/leseansicht/<id> serves a trigger entry whole, quelle never, for every harness of the binding",
        fullLang.status === 200 && fullLang.body.version === 5 && JSON.stringify(fullLang.body.eintrag) === JSON.stringify(langServed)
          && fullLang.raw.includes("zweiter Teil nur im Volltext") && !fullLang.raw.includes("fixture.md")
          && JSON.stringify(fullCodex.body.eintrag) === JSON.stringify(fullLang.body.eintrag)
          && fullAlle.status === 200 && fullAlle.body.eintrag?.aussage === "synthetische Aussage ok-alle"
          && fullOrch.status === 200 && fullOrch.body.eintrag?.id === "ok-modus-orch",
        `lang=${fullLang.status} ${fullLang.raw.slice(0, 300)} codex=${fullCodex.status} alle=${fullAlle.status} orch=${fullOrch.status}`);
      check("konzepte leseansicht volllesen: an id outside the binding is 404 without its text, a query 400, a POST 404",
        fullForeign.status === 404 && !fullForeign.raw.includes("synthetische Aussage ok-modus-orch") && /no gilt entry of your binding/.test(fullForeign.body.error ?? "")
          && fullAsked.status === 400 && empty(fullAsked) && fullPosted.status === 404,
        `foreign=${fullForeign.status} ${fullForeign.raw.slice(0, 200)} asked=${fullAsked.status} posted=${fullPosted.status}`);
    }

    await leseansicht();

    // ---- every other konzept keeps its writers: k-claude-fleet with the body of its first version
    // (Program note fa9afdd2), written by the lane, then by the MAIN without erwartet
    const CF = "k-claude-fleet";
    mkdirSync(`${i.root}/${CF}`, { recursive: true });
    const cf1 = "# Konzept-Fixture, kein echter Inhalt\n";
    writeFileSync(`${i.root}/${CF}/v1.md`, cf1);
    writeFileSync(`${i.root}/${CF}/v2.md`, `${cf1}zweite Fassung\n`);
    const cfLane = await self(laneTok!, "versionen", "POST", { sha256: sha(cf1), anlass: "e2e erste Fassung", geltung: "fuer den e2e-Beweis",
      ebene: "projekt", arbeitetEin: [], quellen: { neu: [] } }, CF);
    const cfMain = await self(mainTok!, "versionen", "POST", version(sha(`${cf1}zweite Fassung\n`)), CF);
    const kStale = await self(mainTok!, "versionen", "POST", version(sha(same), { erwartet: 10 }));
    place(12, same);
    const kLane = await self(laneTok!, "versionen", "POST", version(sha(same), { erwartet: 11, ebene: "owner" }));
    check("konzepte other konzepte: k-claude-fleet and k-e2e-konzept stay writable by lane and MAIN, erwartet absent or right",
      cfLane.status === 200 && cfLane.body.version?.version === 1 && cfMain.status === 200 && cfMain.body.version?.version === 2
        && kStale.status === 409 && kLane.status === 200 && kLane.body.version?.version === 12 && kLane.body.version.ebene === "owner",
      `cfLane=${cfLane.status} ${cfLane.body.error ?? ""} cfMain=${cfMain.status} ${cfMain.body.error ?? ""} stale=${kStale.status} lane=${kLane.status} ${kLane.body.error ?? ""}`);
    // ---- and on a fleet-wide konzept that is not the owner's: the Orchestratorin annotates, but publishes no fassung
    const orchTok = readerRows[3]!.selfToken ?? "";
    writeFileSync(`${i.root}/${CF}/v3.md`, `${cf1}dritte Fassung\n`);
    const cfOrchA = await self(orchTok, "anmerkungen", "POST", { version: 2, text: "Orchestratorin zu k-claude-fleet" }, CF);
    const cfOrchV = await self(orchTok, "versionen", "POST", version(sha(`${cf1}dritte Fassung\n`)), CF);
    const cfVersionen = jsonl(`${i.root}/${CF}/versionen.jsonl`);
    check("konzepte any session versions stay: on k-claude-fleet the Orchestratorin annotates v2 and is 409 on a fassung, which appends nothing",
      cfOrchA.status === 200 && cfOrchA.body.anmerkung?.actor.kind === "session" && cfOrchV.status === 409
        && cfVersionen.length === 2 && cfVersionen.every((v) => (v.actor as { slot?: number }).slot !== ORCH),
      `anmerkung=${cfOrchA.status} ${cfOrchA.body.error ?? ""} fassung=${cfOrchV.status} ${cfOrchV.body.error ?? ""} versionen=${cfVersionen.length}`);

    await programScope();

    async function programScope(): Promise<void> {
      const foreignProgram = "badc0d".repeat(4);
      const foreignK = "k-e2e-private-project", sharedK = "k-e2e-shared", unknownK = "k-e2e-unassigned";
      const bytes = "# Synthetic access fixture\n";
      for (const k of [foreignK, sharedK, unknownK]) {
        mkdirSync(`${i.root}/${k}`, { recursive: true });
        writeFileSync(`${i.root}/${k}/v1.md`, bytes);
      }
      const published = await owner("versionen", "POST", version(sha(bytes), { zugriff: { program: foreignProgram } }), foreignK);
      const shared = await owner("versionen", "POST", version(sha(bytes), { zugriff: "fleet" }), sharedK);
      const unassigned = await owner("versionen", "POST", version(sha(bytes)), unknownK);
      const remarked = await owner("anmerkungen", "POST", { version: 1, text: "synthetic remark" }, foreignK);
      check("konzepte scope fixture: owner publishes Program-bound, fleet-wide and unassigned versions",
        published.status === 200 && published.body.version?.zugriff !== "fleet"
          && published.body.version?.zugriff?.program === foreignProgram && shared.status === 200
          && shared.body.version?.zugriff === "fleet" && unassigned.status === 200 && remarked.status === 200,
        `private=${published.status} shared=${shared.status} unassigned=${unassigned.status} remark=${remarked.status}`);

      const before = readFileSync(`${i.root}/${foreignK}/anmerkungen.jsonl`, "utf8");
      const denied = (a: Answer): boolean => a.status === 403 && /^konzept-program-forbidden:/.test(a.body.error ?? "")
        && a.body.versionen === undefined && a.body.anmerkungen === undefined && a.body.anmerkung === undefined;
      for (const [role, tok] of [["lane", laneTok!], ["bound MAIN", mainTok!]]) {
        for (const rest of ["versionen", "anmerkungen"]) {
          const a = await self(tok!, rest!, "GET", undefined, foreignK);
          check(`konzepte scope: ${role} cannot read a foreign project's ${rest}`, denied(a), `${a.status} ${a.body.error ?? ""}`);
        }
        const write = await self(tok!, "anmerkungen", "POST", { version: 1, text: "foreign attempt" }, foreignK);
        const discard = await self(tok!, `anmerkungen/${remarked.body.anmerkung?.id}/verwerfen`, "POST", { grund: "foreign attempt" }, foreignK);
        const publish = await self(tok!, "versionen", "POST", version(sha(bytes)), foreignK);
        check(`konzepte scope: ${role} cannot comment, discard or publish in a foreign project`,
          denied(write) && denied(discard) && denied(publish) && readFileSync(`${i.root}/${foreignK}/anmerkungen.jsonl`, "utf8") === before
            && jsonl(`${i.root}/${foreignK}/versionen.jsonl`).length === 1,
          `comment=${write.status} discard=${discard.status} publish=${publish.status}`);
        const own = await self(tok!, "versionen", "GET");
        const global = await self(tok!, "anmerkungen", "GET", undefined, sharedK);
        const globalWrite = await self(tok!, "anmerkungen", "POST", { version: 1, text: "shared attempt" }, sharedK);
        const unknown = await self(tok!, "versionen", "GET", undefined, unknownK);
        check(`konzepte scope: ${role} reads its own project, reads and comments fleet-wide, refuses unknown scope`,
          own.status === 200 && global.status === 200 && globalWrite.status === 200
            && unknown.status === 409 && /^konzept-scope-unknown:/.test(unknown.body.error ?? ""),
          `own=${own.status} global=${global.status}/${globalWrite.status} unknown=${unknown.status}`);
      }
      const forged = await self(laneTok!, "versionen", "POST", version(sha(bytes), { zugriff: "fleet" }), foreignK);
      const broaden = await owner("versionen", "POST", version(sha(bytes), { zugriff: "fleet" }), foreignK);
      const badScope = await owner("versionen", "POST", version(sha(bytes), { zugriff: { program: "wrong" } }), foreignK);
      const ownerRead = await owner("anmerkungen", "GET", undefined, foreignK);
      check("konzepte scope: sessions cannot grant fleet access, scope cannot widen in a new version, owner still reads",
        forged.status === 403 && /^konzept-scope-owner-only:/.test(forged.body.error ?? "")
          && broaden.status === 409 && /^konzept-scope-fixed:/.test(broaden.body.error ?? "")
          && badScope.status === 400 && ownerRead.status === 200,
        `forged=${forged.status} broaden=${broaden.status} invalid=${badScope.status} owner=${ownerRead.status}`);

      const ownLedger = `${i.root}/${K}/versionen.jsonl`;
      const saved = readFileSync(ownLedger, "utf8");
      const legacy = versionLines().map(({ zugriff: _zugriff, ...row }) => row);
      writeFileSync(ownLedger, legacy.map((row) => JSON.stringify(row)).join("\n") + "\n");
      const oldOwn = await self(laneTok!, "versionen", "GET");
      const conflicting = { ...legacy[0], version: 13, kontext: { program: foreignProgram } };
      writeFileSync(ownLedger, readFileSync(ownLedger, "utf8") + JSON.stringify(conflicting) + "\n");
      const oldConflict = await self(laneTok!, "versionen", "GET");
      const inconsistent = { ...versionLines()[0], version: 14, zugriff: { program: foreignProgram } };
      writeFileSync(ownLedger, saved + JSON.stringify(inconsistent) + "\n");
      const scopeConflict = await self(laneTok!, "versionen", "GET");
      writeFileSync(ownLedger, saved);
      check("konzepte scope legacy: a unique Program trace allows access, conflicting traces refuse 409",
        oldOwn.status === 200 && oldConflict.status === 409 && /^konzept-scope-unknown:/.test(oldConflict.body.error ?? "")
          && scopeConflict.status === 409 && /^konzept-scope-unknown:/.test(scopeConflict.body.error ?? ""),
        `unique=${oldOwn.status} legacyConflict=${oldConflict.status} scopeConflict=${scopeConflict.status}`);

      await stop(i);
      const planted = readState();
      const originalProgram = planted.programs![0]!;
      planted.programs!.push({ ...originalProgram, id: foreignProgram, title: "Second synthetic Program" });
      planted.slots[String(FREMD_LANE)]!.programId = foreignProgram;
      planted.slots[String(CODEX_LANE)]!.programId = null;
      writeFileSync(`${i.dir}/fleet.json`, JSON.stringify(planted), { mode: 0o600 });
      const reboot = await boot(i, bin);
      const position = reboot ? ((await call("/api/self", "GET", { "x-fleet-self-token": mainTok! })).body as {
        position?: { programIds?: string[] } }) : null;
      const boundPrograms = position?.position?.programIds ?? [];
      const bound = boundPrograms.length === 2 && boundPrograms.includes(PROGRAM) && boundPrograms.includes(foreignProgram);
      check("konzepte scope fixture: the MAIN binds two Programs and the foreign lane binds the second",
        reboot && bound && planted.slots[String(FREMD_LANE)]?.programId === foreignProgram,
        `boot=${reboot} Programs=${boundPrograms.join(",")} lane=${planted.slots[String(FREMD_LANE)]?.programId}`);
      if (!bound) return;
      const foreignTok = planted.slots[String(FREMD_LANE)]!.selfToken!;
      const multiMain = await self(mainTok!, "anmerkungen", "POST", { version: 1, text: "bound to second" }, foreignK);
      const ownForeign = await self(foreignTok, "versionen", "GET", undefined, foreignK);
      const rejectFirst = await self(foreignTok, "versionen", "GET");
      const globalCf = await self(foreignTok, "versionen", "GET", undefined, CF);
      const globalHeft = await self(foreignTok, "versionen", "GET", undefined, "k-owner-korrekturen");
      const ambiguous = await self(mainTok!, "versionen", "POST", version(sha(bytes)), "k-e2e-ambiguous");
      const noProgramTok = planted.slots[String(CODEX_LANE)]!.selfToken!;
      const noProgramPrivate = await self(noProgramTok, "versionen", "GET");
      const noProgramFleet = await self(noProgramTok, "versionen", "GET", undefined, CF);
      check("konzepte scope: MAIN of multiple Programs accesses each binding without inventing a trace Program",
        multiMain.status === 200 && multiMain.body.anmerkung?.kontext.program === undefined,
        `main=${multiMain.status} traceProgram=${multiMain.body.anmerkung?.kontext.program ?? "absent"}`);
      check("konzepte scope: a lane reads only its Program and the two existing fleet-wide concepts",
        ownForeign.status === 200 && denied(rejectFirst) && globalCf.status === 200 && globalHeft.status === 200,
        `own=${ownForeign.status} foreign=${rejectFirst.status} fleet=${globalCf.status} heft=${globalHeft.status}`);
      check("konzepte scope: ambiguous MAIN creation is refused and a Program-less lane reads only fleet-wide",
        ambiguous.status === 409 && /^konzept-scope-unknown:/.test(ambiguous.body.error ?? "")
          && denied(noProgramPrivate) && noProgramFleet.status === 200,
        `ambiguous=${ambiguous.status} private=${noProgramPrivate.status} fleet=${noProgramFleet.status}`);

      await stop(i);
      const path = `${i.dir}/konzept-ledger.ts`;
      const original = readFileSync(path, "utf8");
      const mutant = original.replace('if (bound !== "fleet" && !programs.includes(bound.program))', 'if (false)');
      check("konzepte scope mutation fixture: the scratch ledger loses only the foreign Program guard", mutant !== original);
      writeFileSync(path, mutant);
      const mutatedBoot = await boot(i, bin);
      const leaked = mutatedBoot ? await self(laneTok!, "anmerkungen", "GET", undefined, foreignK) : null;
      check("konzepte scope mutation: removing the Program guard turns the same foreign-read assertion red",
        leaked !== null && leaked.status === 200 && !denied(leaked) && leaked.body.anmerkungen?.length === 2,
        `boot=${mutatedBoot} status=${leaked?.status} rejectionClaim=${leaked ? denied(leaked) : "unknown"}`);
      await stop(i);
      writeFileSync(path, original);
      const restored = await boot(i, bin);
      const closed = restored ? await self(laneTok!, "anmerkungen", "GET", undefined, foreignK) : null;
      check("konzepte scope mutation: restoring the guard restores the same named refusal", closed !== null && denied(closed));
    }

    // ---- missing root: 503 naming FLEET_KONZEPT_ROOT, on read and write, and nothing is created
    renameSync(i.root, `${i.root}.away`);
    const goneW = await self(laneTok!, "anmerkungen", "POST", { version: 1, text: "ins Nichts" });
    const goneR = await owner("versionen", "GET");
    const goneIdx = await call("/api/konzepte", "GET", OH);
    const goneLese = await call("/api/self/konzepte/k-owner-korrekturen/leseansicht", "GET", { "x-fleet-self-token": laneTok! });
    const recreated = existsSync(i.root);
    renameSync(`${i.root}.away`, i.root);
    check("konzepte missing root: 503 naming FLEET_KONZEPT_ROOT on read and write, and no root is created",
      goneW.status === 503 && goneR.status === 503 && goneIdx.status === 503
        && (goneW.body.error ?? "").includes("FLEET_KONZEPT_ROOT") && !recreated,
      `write=${goneW.status} ${goneW.body.error} read=${goneR.status} index=${goneIdx.status} recreated=${recreated}`);
    check("konzepte leseansicht refusal: a missing root is 503 naming FLEET_KONZEPT_ROOT, never an empty heft",
      goneLese.status === 503 && (goneLese.body.error ?? "").includes("FLEET_KONZEPT_ROOT") && !("geltendeEintraege" in goneLese.body),
      `${goneLese.status} ${goneLese.body.error}`);
  } finally {
    await stop(i);
    spawnSync("tmux", ["-L", i.sock, "kill-server"]);
    rmSync(FIX, { recursive: true, force: true });
  }
}

// ================================================================================================
// THE PRIVATE PACK HANDOVER (card a5f4, owner disposition 804bc34a): the selected private konzept pack
// must reach something that can READ it. A selected id, a receipt row or a `match` verdict proves no
// read — so this section founds real sessions on a scratch instance and lets the process the harness
// adapter spawned read the bytes the delivered pointer names, from a konzept repo that is a separate
// git repository beside the product repo. No model turn anywhere: the pane runs a mechanical reader
// (the rule of e2e/context-plan.ts#readDelivered) behind the real claude and codex spawn lines.
//
//   PRODUCT REPO — the scratch instance's own checkout, git-initialised, so the server classifies a
//                  founding there as the Fleet tree (server.ts#dispatchSourceTree). Two scratch-copy
//                  edits, both named rows below: the konzept seed's pinned sourceHash is replaced by
//                  the fixture fassung's hash (the real Sicht v2 is private and is never a fixture),
//                  and the repo manifest declares one FOREIGN private pack.
//   KONZEPT REPO — FLEET_KONZEPT_ROOT, a separate git repository: k-claude-fleet v1 published through
//                  the owner's own versionen door (so the ledger layout is the writer's, not this
//                  test's), plus k-fremd-projekt, another konzept no Fleet seed declares.
//
// What each row turns red on, stated as the mutation:
//   claude / codex read  — the founding renders no readable path (root not handed to the resolver, the
//                          pack carried only as an opaque id, a path from the product tree), or the
//                          harness spawn line never reaches the pane that receives the paste.
//   receipt              — the row loses the verdict/version or gains the local path.
//   pi harnesses         — any pi-* back on the seed's harness list: its founding is not a 409.
//   foreign source       — a repo manifest's private pack is selected, or its konzept is read.
//   drift / missing file — a non-matching or absent fassung still hands the reader matching bytes.
//   root not passed      — the same read claim on an instance without FLEET_KONZEPT_ROOT stays green.
const HOFF = 29; // PORT offsets 1, 23-28 are taken (restart.ts, state-snapshot.ts, self-token.ts, trace.ts, above)
const SEED_ID = "konzept-claude-fleet";
const PK = "k-claude-fleet";
const FREMD_PACK = "fremd-konzept";
const FREMD = "k-fremd-projekt";
const SENTINEL = `# Konzept-Fixture\nSENTINEL-${randomBytes(6).toString("hex")} — kein echter Konzeptinhalt\n`;
const FREMD_SENTINEL = `# Fremdes Konzept\nFREMD-${randomBytes(6).toString("hex")}\n`;

interface ReaderRecord { tag: string; slot: string; line: string | null; path: string | null; verdict: string | null; bytes: string | null }

// The pane reader. It is the RECEIVER: it holds only what the pane was pasted, finds the first private
// pack line, and reads the path that line names ONLY under `hash match`. One JSON record per pane.
const READER_TS = String.raw`import { readFileSync, renameSync, writeFileSync } from "node:fs";
const [outDir, tag] = process.argv.slice(2);
const slot = process.env.FLEET_SELF_SLOT ?? "unknown";
const RE = /^ {2}(?:(\/.+?) \| )?(k-[a-z0-9-]+)(?: v\d+)? · privat, lesen statt kopieren · hash (match|drift|missing)\b/;
process.stdout.write("\x1b[?2004h");
let firstPrompt = "";
let firstRecorded = false;
function firstInputText(input) {
  const paste = input.indexOf("\x1b[200~");
  const enter = input.indexOf("\n");
  const end = enter !== -1 && (paste === -1 || enter < paste) ? enter : input.indexOf("\x1b[201~");
  return end === -1 ? null : input.slice(0, end).replace(/\x1b\[200~/g, "");
}
process.stdin.on("data", (chunk) => {
  if (firstRecorded) return;
  firstPrompt += chunk.toString("utf8").replace(/\r\n?/g, "\n");
  const pasted = firstInputText(firstPrompt);
  if (pasted === null) return;
  void (async () => {
    firstRecorded = true;
    firstPrompt = "";
    // A FIRST PROMPT OVER THE PASTE LIMIT arrives stored whole, behind one line that names its file (server.ts#PASTE_MAX_BYTES):
    // a real agent reads that file before it acts, and so does this one — the Orchestratorin's start outside Claude is over it
    const stored = /Read the complete text from (\S+) before acting on it\./.exec(pasted)?.[1] ?? null;
    const text = stored ? readFileSync(stored, "utf8") : pasted;
    const nativePath = /^Session-Regeln: (\.\/AGENTS\.override\.md)$/m.exec(text)?.[1] ?? null;
    const native = nativePath ? readFileSync(nativePath, "utf8") : "";
    const pointer = /GET (http:\/\/[^\s]+\/api\/self\/konzepte\/k-owner-korrekturen\/leseansicht)/.exec(text + "\n" + native)?.[1] ?? null;
    // ONE read, the moment the first prompt arrives — no wait for the founding response: the pointer
    // says "vor deinem ersten Akt", so the first act is the only read that proves the position.
    let status = null, body = null, error = null, firstAt = null, answeredAt = null;
    if (pointer) {
      firstAt = Date.now();
      const response = await fetch(pointer, { headers: { "x-fleet-self-token": process.env.FLEET_SELF_TOKEN } });
      status = response.status;
      body = await response.json();
      error = typeof body?.error === "string" ? body.error : null;
      answeredAt = Date.now();
    }
    const out = outDir + "/heft-" + slot + ".json";
    writeFileSync(out + ".tmp", JSON.stringify({ tag, text, native, pointer, status, body, error, firstAt, answeredAt }));
    renameSync(out + ".tmp", out);
  })();
});
let buf = "";
let done = false;
process.stdin.on("data", (chunk) => {
  if (done) return;
  buf += chunk.toString("utf8").replace(/\r\n?/g, "\n");
  const lines = buf.split("\n");
  for (const raw of lines.slice(0, -1)) {
    const line = raw.replace(/^\x1b\[200~/, "");
    const m = RE.exec(line);
    if (!m) continue;
    const path = m[1] ?? null;
    let bytes = null;
    if (path !== null && m[3] === "match") { try { bytes = readFileSync(path, "utf8"); } catch { bytes = null; } }
    const out = outDir + "/read-" + slot + ".json";
    writeFileSync(out + ".tmp", JSON.stringify({ tag, slot, line, path, verdict: m[3], bytes }));
    renameSync(out + ".tmp", out);
    done = true;
    return;
  }
  if (buf.includes("\x1b[201~") && buf.includes("beratende Anker, kein Quelltext:")) {
    const out = outDir + "/read-" + slot + ".json";
    writeFileSync(out + ".tmp", JSON.stringify({ tag, slot, line: null, path: null, verdict: null, bytes: null }));
    renameSync(out + ".tmp", out);
    done = true;
  }
});
setInterval(() => {}, 1 << 30);
`;

async function firstInputBoundary(): Promise<void> {
  const dir = `${FIX}-first-input`;
  mkdirSync(dir, { recursive: true });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: (req) =>
    new URL(req.url).pathname === "/api/self/konzepte/k-owner-korrekturen/leseansicht"
      && req.headers.get("x-fleet-self-token") === "synthetic-reader-token"
      ? Response.json({ geltendeEintraege: [{ id: "first-input" }] }) : Response.json({ error: "fixture refusal" }, { status: 403 }) });
  const pointer = `GET http://127.0.0.1:${server.port}/api/self/konzepte/k-owner-korrekturen/leseansicht`;
  type InputRecord = { text: string; pointer: string | null; status: number | null;
    body: { geltendeEintraege?: { id: string }[] } | null };
  const read = async (tag: string, source: string, input: string): Promise<InputRecord | null> => {
    const path = `${dir}/${tag}.ts`;
    writeFileSync(path, source);
    const proc = Bun.spawn([process.execPath, path, dir, tag], { stdin: "pipe", stdout: "ignore", stderr: "ignore",
      env: { ...process.env, FLEET_SELF_SLOT: tag, FLEET_SELF_TOKEN: "synthetic-reader-token" } });
    try {
      proc.stdin.write(input);
      await proc.stdin.end();
      for (let n = 0; n < 200; n++) {
        try { return JSON.parse(readFileSync(`${dir}/heft-${tag}.json`, "utf8")) as InputRecord; }
        catch { await Bun.sleep(10); }
      }
      return null;
    } finally { proc.kill(); await proc.exited; }
  };
  const claim = (r: InputRecord | null): boolean => r?.pointer === pointer.slice(4) && r.status === 200
    && JSON.stringify(r.body?.geltendeEintraege) === '[{"id":"first-input"}]';
  const rejected = (r: InputRecord | null): boolean => r?.text === "unrecognized first input" && r.pointer === null && r.status === null && r.body === null;
  const late = `\x1b[200~unrecognized first input\x1b[201~\n\x1b[200~fleet second input: ${pointer}\x1b[201~\n`;
  try {
    const first = await read("first", READER_TS, `\x1b[200~${pointer}\x1b[201~\n`);
    check("konzepte first input: a reader pointer in the first input yields the synthetic reader bytes", claim(first), JSON.stringify(first));
    const second = await read("second", READER_TS, late);
    check("konzepte first input: a pointer only in the second input turns the startup delivery claim red", rejected(second) && !claim(second), JSON.stringify(second));
    const unframed = await read("unframed", READER_TS, `unrecognized first input\n\x1b[200~fleet second input: ${pointer}\x1b[201~\n`);
    check("konzepte first input: an unframed first Enter also closes the record before a later paste", rejected(unframed), JSON.stringify(unframed));
    const mutant = READER_TS.replace("input.slice(0, end)", "input");
    const concatenated = await read("mutation", mutant, late);
    check("konzepte first input mutation: concatenating the second input fails the same boundary assertion and falsely passes the startup claim",
      mutant !== READER_TS && concatenated !== null && !rejected(concatenated) && claim(concatenated), JSON.stringify(concatenated));
  } finally { server.stop(true); rmSync(dir, { recursive: true, force: true }); }
}

async function privatePackHandover(): Promise<void> {
  const FIXH = `${FIX}-handover`;
  rmSync(FIXH, { recursive: true, force: true });
  mkdirSync(`${FIXH}/srv`, { recursive: true });
  const i: Instance = { dir: `${FIXH}/srv`, base: `http://${IP}:${PORT + HOFF}`, sock: `${SOCK}konzepte${HOFF}`,
    root: `${FIXH}/konzept-repo`, proc: null, log: "" };
  const reads = `${FIXH}/reads`;
  const bin = `${FIXH}/bin`;
  const OH = { "content-type": "application/json", authorization: `Bearer ${TOKEN}` };
  const call = async (path: string, method: "GET" | "POST", body?: unknown): Promise<{ status: number; text: string; json: Record<string, unknown> }> => {
    const r = await fetch(`${i.base}${path}`, { method, headers: OH, ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}) });
    const text = await r.text();
    let json: Record<string, unknown> = {};
    try { json = JSON.parse(text) as Record<string, unknown>; } catch { /* the raw text is kept for the detail */ }
    return { status: r.status, text, json };
  };
  const g = (dir: string, ...a: string[]) => spawnSync("git", ["-C", dir, ...a], { encoding: "utf8" });
  const commitAll = (dir: string, msg: string, exclude = ""): boolean => {
    g(dir, "init", "-q", "-b", "main");
    if (exclude) writeFileSync(`${dir}/.git/info/exclude`, exclude);
    g(dir, "config", "user.email", "e2e@fleet"); g(dir, "config", "user.name", "e2e"); g(dir, "config", "commit.gpgsign", "false");
    g(dir, "add", "-A");
    return g(dir, "commit", "-q", "-m", msg).status === 0;
  };
  try {
    // ---- the product repo: the instance's own checkout, with the two named scratch-copy edits
    for (const e of readdirSync(ROOT)) if (!SKIP.test(e)) cpSync(`${ROOT}/${e}`, `${i.dir}/${e}`, { recursive: true });
    if (!existsSync(`${i.dir}/node_modules`)) symlinkSync(`${ROOT}/node_modules`, `${i.dir}/node_modules`);
    const seed = CONTEXT_PACKS.find((pack) => pack.id === SEED_ID);
    const pinned = seed && "sourceHash" in seed ? seed.sourceHash : "";
    const packsSrc = readFileSync(`${i.dir}/context-packs.ts`, "utf8");
    const pinCount = pinned ? packsSrc.split(`sourceHash: "${pinned}"`).length - 1 : 0;
    writeFileSync(`${i.dir}/context-packs.ts`, packsSrc.replace(`sourceHash: "${pinned}"`, `sourceHash: "${sha(SENTINEL)}"`));
    const manifestPath = `${i.dir}/.fleet/context-packs.json`;
    const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>[] : [];
    mkdirSync(`${i.dir}/.fleet`, { recursive: true });
    writeFileSync(manifestPath, JSON.stringify([...manifest, {
      id: FREMD_PACK, useWhen: "Ein fremdes privates Konzept, vom Repo-Manifest erklaert.", scope: "konzept", audience: "private-ops",
      triggers: ["always"], hardness: "guidance", privateSourceId: FREMD, sourceHash: sha(FREMD_SENTINEL),
      observedAt: "2026-10-02T00:00:00Z", requiredCapabilities: ["private-overlay-read"], harnesses: ["claude", "codex"],
      modes: ["read-only", "mutating", "monitoring"], estimatedBytes: 64, evidence: "private-content-hash", owner: "owner", status: "active",
    }], null, 2));
    const productOk = commitAll(i.dir, "product fixture", "node_modules\n");
    const product = realpathSync(i.dir);
    check("konzepte handover fixture: the product repo is a git checkout whose konzept seed pin was replaced exactly once by the fixture hash",
      productOk && pinCount === 1 && readFileSync(`${i.dir}/context-packs.ts`, "utf8").includes(`sourceHash: "${sha(SENTINEL)}"`),
      `commit=${productOk} pins=${pinCount}`);

    // ---- the konzept repo: a separate git repository, the fassungen placed, nothing published yet
    mkdirSync(`${i.root}/${PK}`, { recursive: true });
    mkdirSync(`${i.root}/${FREMD}`, { recursive: true });
    writeFileSync(`${i.root}/${PK}/v1.md`, SENTINEL);
    writeFileSync(`${i.root}/${FREMD}/v1.md`, FREMD_SENTINEL);
    const konzeptOk = commitAll(i.root, "konzept fixture");
    const konzeptRoot = realpathSync(i.root);
    check("konzepte handover fixture: the konzept root is its own git repository, outside the product repo",
      konzeptOk && !konzeptRoot.startsWith(`${product}/`) && g(konzeptRoot, "rev-parse", "--show-toplevel").stdout.trim() === konzeptRoot
        && g(product, "rev-parse", "--show-toplevel").stdout.trim() === product,
      `${konzeptRoot} vs ${product}`);
    if (!productOk || pinCount !== 1 || !konzeptOk) return;

    // ---- the receiver behind both spawn lines: FLEET_CMD for claude, `codex` on PATH for codex. The
    // runner is bun reached through a symlink NAMED codex, so the codex adapter's comms probe finds its
    // own name (the e2e/harness.ts#standInBin rule); the banner is the codex readiness marker.
    mkdirSync(bin, { recursive: true });
    mkdirSync(`${FIXH}/runner`, { recursive: true });
    mkdirSync(reads, { recursive: true });
    writeFileSync(`${FIXH}/reader.ts`, READER_TS);
    symlinkSync(process.execPath, `${FIXH}/runner/codex`);
    symlinkSync(process.execPath, `${FIXH}/runner/pi`);
    const launcher = (tag: string) => `#!/bin/sh\nprintf '%s\\n' '>_ OpenAI Codex (v0.0.0-e2e-reader)' '0.0%/1.0M (auto)  glm-5.3 • high'\n`
      + `stty -icanon -echo 2>/dev/null\nexec '${FIXH}/runner/${tag === "pi" ? "pi" : "codex"}' '${FIXH}/reader.ts' '${reads}' '${tag}'\n`;
    writeFileSync(`${bin}/fleet-reader`, launcher("claude"), { mode: 0o755 });
    writeFileSync(`${bin}/codex`, launcher("codex"), { mode: 0o755 });
    // every Pi adapter spawns `pi` by name: shadowed here too, so a regression that lets a Pi founding
    // through reaches this reader and never a real agent with a provider behind it (measured in this
    // lane's own mutation run: without the shadow, the host's `pi` was spawned and handed the brief)
    writeFileSync(`${bin}/pi`, launcher("pi"), { mode: 0o755 });
    writeFileSync(`${FIXH}/zai-fixture.key`, "synthetic-not-a-provider-key\n", { mode: 0o600 });
    writeFileSync(`${bin}/sandbox-fixture`, '#!/bin/sh\n[ "$1" = -p ] && shift 2\nexec "$@"\n', { mode: 0o755 });
    mkdirSync(`${FIXH}/codex-home`, { recursive: true });
    const bootH = async (root: string): Promise<boolean> => {
      i.proc = Bun.spawn(["bun", "server.ts"], {
        cwd: i.dir, stdout: "pipe", stderr: "pipe",
        env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}`, CODEX_HOME: `${FIXH}/codex-home`,
          FLEET_HOST: IP, FLEET_PORT: String(PORT + HOFF), FLEET_SOCK: i.sock, FLEET_TOKEN: TOKEN,
          FLEET_CMD: `${bin}/fleet-reader`, FLEET_HARNESS_COMMS: "", FLEET_AUTO_REVIEW_MS: "0", FLEET_STATE_SNAPSHOT_MS: "0",
          FLEET_POSTLAND_AUDIT_CMD: "true", FLEET_KONZEPT_ROOT: root, FLEET_FOUNDING_BOOT_GRACE_MS: "2000",
          FLEET_TEST_SEND_BEFORE_PASTE_LATCH: `${FIXH}/heft-before-paste-latch`,
          FLEET_ACCEPT_WAIT_MS: "800", FLEET_PI_ZAI_AGENT_DIR: `${FIXH}/pi-zai-agent`,
          FLEET_PI_ZAI_KEY_FILE: `${FIXH}/zai-fixture.key`,
          FLEET_PI_ZAI_SANDBOX_EXEC: `${bin}/sandbox-fixture`, FLEET_PI_ZAI_DENY_ROOTS: `${FIXH}/deny` },
      });
      i.log = "";
      const drain = async (st: ReadableStream<Uint8Array>) => { for await (const c of st) i.log += new TextDecoder().decode(c); };
      void drain(i.proc.stdout as ReadableStream<Uint8Array>);
      void drain(i.proc.stderr as ReadableStream<Uint8Array>);
      for (let n = 0; n < 150; n++) {
        if (await fetch(`${i.base}/api/sessions`, { headers: { authorization: `Bearer ${TOKEN}` } }).then((r) => r.ok, () => false)) return true;
        await Bun.sleep(100);
      }
      return false;
    };
    let up = await bootH(konzeptRoot);
    check("konzepte handover fixture: the scratch instance boots with the konzept repo as FLEET_KONZEPT_ROOT", up, i.log.slice(-300));
    if (!up) return;

    // publish v1 through the owner's own door: the ledger row is the writer's format, not this test's
    const pub = await call(`/api/konzepte/${PK}/versionen`, "POST", { sha256: sha(SENTINEL), anlass: "e2e fassung", geltung: "fuer den Uebergabebeweis" });
    const pubFremd = await call(`/api/konzepte/${FREMD}/versionen`, "POST", { sha256: sha(FREMD_SENTINEL), anlass: "e2e fremd", geltung: "fremd" });
    check("konzepte handover fixture: v1 of both konzepte is published through the owner's versionen door",
      pub.status === 200 && pubFremd.status === 200 && existsSync(`${konzeptRoot}/${PK}/versionen.jsonl`),
      `${pub.status} ${pub.text.slice(0, 200)} / ${pubFremd.status}`);
    if (pub.status !== 200) return;

    const freeSlot = async (): Promise<number | null> => {
      const body = (await call("/api/sessions", "GET")).json as { slots?: { id: number; cwd: string | null }[] };
      return body.slots?.find((x) => !x.cwd)?.id ?? null;
    };
    const receiptFor = async (slot: number) => {
      const body = (await call("/api/context-receipts", "GET")).json as { receipts?: { slot: number; harness: string | null;
        selected: { id: string; anchors: unknown; private?: { verdict: string; version: number | null } }[];
        omitted: { id: string; why: string; reason?: string | null }[] }[] };
      return body.receipts?.filter((row) => row.slot === slot).at(-1) ?? null;
    };
    // ONE founding with the pack chosen, and the reader's record of what the pane received. The record
    // is null when the pane never produced one — UNOBSERVED, which no row below accepts as a refusal.
    const found = async (harness: string): Promise<{ slot: number | null; open: { status: number; text: string; json: Record<string, unknown> } | null;
      record: ReaderRecord | null; ownerPointer: string | null | undefined; receipt: Awaited<ReturnType<typeof receiptFor>> }> => {
      const slot = await freeSlot();
      if (slot === null) return { slot, open: null, record: null, ownerPointer: undefined, receipt: null };
      rmSync(`${reads}/read-${slot}.json`, { force: true });
      rmSync(`${reads}/heft-${slot}.json`, { force: true });
      const open = await call(`/api/slots/${slot}/open`, "POST", { cwd: product, harness, label: `privat-${harness}`, packs: [SEED_ID] });
      let record: ReaderRecord | null = null;
      for (let n = 0; n < 100 && record === null && open.status === 200; n++) {
        try { record = JSON.parse(readFileSync(`${reads}/read-${slot}.json`, "utf8")) as ReaderRecord; } catch { await Bun.sleep(100); }
      }
      let ownerPointer: string | null | undefined;
      for (let n = 0; n < 100 && ownerPointer === undefined && open.status === 200; n++) {
        try { ownerPointer = (JSON.parse(readFileSync(`${reads}/heft-${slot}.json`, "utf8")) as { pointer: string | null }).pointer; }
        catch { await Bun.sleep(100); }
      }
      const receipt = await receiptFor(slot);
      await call(`/api/slots/${slot}/kill`, "POST", {});
      return { slot, open, record, ownerPointer, receipt };
    };
    const readClaim = (r: ReaderRecord | null): boolean => r?.bytes === SENTINEL;
    const outsideProduct = (path: string | null): boolean =>
      path !== null && path.startsWith(`${konzeptRoot}/${PK}/`) && !path.startsWith(`${product}/`);

    // ---- POSITIVE, both released harnesses: the spawned process reads the sentinel bytes
    for (const harness of ["claude", "codex"]) {
      const f = await found(harness);
      check(`konzepte owner delivery (${harness}/nur-ordner): an observed generic founding receives no Owner-Heft pointer`,
        f.open?.status === 200 && f.ownerPointer === null, `open=${f.open?.status} pointer=${f.ownerPointer}`);
      check(`konzepte handover (${harness}): the founding delivers the chosen konzept pack, and the process the ${harness} adapter spawned reads the sentinel bytes from the konzept repo`,
        f.open?.status === 200 && f.open.json.packsDelivered === true && f.record?.tag === (harness === "claude" ? "claude" : "codex")
          && f.record.verdict === "match" && outsideProduct(f.record.path) && readClaim(f.record),
        `slot=${f.slot} open=${f.open?.status} ${f.open?.text.slice(0, 200)} record=${JSON.stringify(f.record)}`);
      const row = f.receipt?.selected.find((sel) => sel.id === SEED_ID);
      check(`konzepte handover (${harness}): the receipt names the pack's verdict match on v1 by id, never the local path`,
        !!row && JSON.stringify(row.anchors) === JSON.stringify({ privateSourceId: PK })
          // a claude slot stores harness null — the legacy default adapter (context-plan.ts#resolveContextHarness)
          && row.private?.verdict === "match" && row.private.version === 1 && (f.receipt?.harness ?? "claude") === harness
          && !JSON.stringify(f.receipt).includes(konzeptRoot),
        JSON.stringify(f.receipt));
    }

    // ---- UNSUITABLE HARNESS: every Pi harness is refused before any spawn, path or verdict
    const piHarnesses = CONTEXT_PACK_HARNESSES.filter((h) => h.startsWith("pi"));
    const piRows: Record<string, unknown>[] = [];
    for (const harness of piHarnesses) {
      const plan = await call(`/api/founding-plan?repo=${encodeURIComponent(product)}&mode=main&harness=${harness}`, "GET");
      const reason = (plan.json.omitted as { id: string; reason: string }[] | undefined)?.find((o) => o.id === SEED_ID)?.reason ?? null;
      const slot = await freeSlot();
      const open = slot === null ? null : await call(`/api/slots/${slot}/open`, "POST", { cwd: product, harness, packs: [SEED_ID] });
      const stillFree = slot !== null && (await freeSlot()) === slot;
      if (slot !== null && !stillFree) await call(`/api/slots/${slot}/kill`, "POST", {});
      piRows.push({ harness, reason, open: open?.status ?? null, error: (open?.json.error as string | undefined) ?? open?.text.slice(0, 160) ?? null,
        stillFree, leaked: !!open && (open.text.includes(konzeptRoot) || plan.text.includes(konzeptRoot)) });
    }
    await Bun.sleep(500); // a Pi pane that was (wrongly) founded gets the time to hand its reader the paste
    const piRead = readdirSync(reads).filter((f) => readFileSync(`${reads}/${f}`, "utf8").includes('"tag":"pi"'));
    check("konzepte handover (pi harnesses): pi, pi-zai and pi-unfenced are each refused 409 harness-unsupported before the spawn, no path anywhere",
      piHarnesses.length === 3 && piRead.length === 0 && piRows.every((r) => r.reason === "harness-unsupported" && r.open === 409
        && String(r.error).includes(`pack ${SEED_ID} is omitted for this founding: harness-unsupported`) && r.stillFree && !r.leaked),
      `${JSON.stringify(piRows)} piReads=${piRead.length}`);

    // ---- FOREIGN SOURCE: a repo manifest's private pack is never selected, its konzept never read
    const fremdPlan = await call(`/api/founding-plan?repo=${encodeURIComponent(product)}&mode=main&harness=claude`, "GET");
    const fremdReason = (fremdPlan.json.omitted as { id: string; reason: string }[] | undefined)?.find((o) => o.id === FREMD_PACK)?.reason ?? null;
    const fremdSlot = await freeSlot();
    const fremdOpen = fremdSlot === null ? null : await call(`/api/slots/${fremdSlot}/open`, "POST", { cwd: product, harness: "claude", packs: [FREMD_PACK] });
    const fremdFree = fremdSlot !== null && (await freeSlot()) === fremdSlot;
    const anyFremd = readdirSync(reads).some((f) => readFileSync(`${reads}/${f}`, "utf8").includes(FREMD_SENTINEL.trim().split("\n")[1]!));
    check("konzepte handover (foreign source): a private pack the repo manifest declares is manifest-invalid, refused 409 before the spawn, and its konzept is never read",
      fremdReason === "manifest-invalid" && fremdOpen?.status === 409
        && String(fremdOpen.json.error).includes(`pack ${FREMD_PACK} is omitted for this founding: manifest-invalid`) && fremdFree && !anyFremd,
      `reason=${fremdReason} open=${fremdOpen?.status} ${fremdOpen?.text.slice(0, 200)} free=${fremdFree} read=${anyFremd}`);

    // ---- WRONG HASH: the published fassung edited afterwards — drift by name, no matching bytes handed over
    writeFileSync(`${konzeptRoot}/${PK}/v1.md`, `${SENTINEL}nachtraeglich geaendert\n`);
    const drifted = await found("claude");
    writeFileSync(`${konzeptRoot}/${PK}/v1.md`, SENTINEL);
    const driftRow = drifted.receipt?.selected.find((sel) => sel.id === SEED_ID);
    check("konzepte handover (hash drift): an edited v1.md is delivered as hash drift with its reason, the receipt says drift, and the read claim is red",
      drifted.open?.status === 200 && drifted.record !== null && drifted.record.verdict === "drift"
        && drifted.record.line?.includes("v1.md no longer hashes to its versionen.jsonl row") === true && !readClaim(drifted.record)
        && driftRow?.private?.verdict === "drift",
      `record=${JSON.stringify(drifted.record)} receipt=${JSON.stringify(driftRow ?? null)}`);

    // ---- MISSING FILE: the fassung moved away — missing by name, no path at all
    renameSync(`${konzeptRoot}/${PK}/v1.md`, `${konzeptRoot}/${PK}/v1.md.away`);
    const noFile = await found("claude");
    renameSync(`${konzeptRoot}/${PK}/v1.md.away`, `${konzeptRoot}/${PK}/v1.md`);
    check("konzepte handover (missing file): no anchor reaches the pane, and the receipt omits the pack with the absent-file reason",
      noFile.open?.status === 200 && noFile.record !== null && noFile.record.verdict === null && noFile.record.path === null
        && !readClaim(noFile.record) && !noFile.receipt?.selected.some((sel) => sel.id === SEED_ID)
        && noFile.receipt?.omitted.some((sel) => sel.id === SEED_ID && sel.why === "source-unavailable"
          && sel.reason?.includes("v1.md is absent under the root")) === true,
      `record=${JSON.stringify(noFile.record)} receipt=${JSON.stringify(noFile.receipt)}`);

    await ownerHeftDelivery();

    async function ownerHeftDelivery(): Promise<void> {
      const door = "/api/self/konzepte/k-owner-korrekturen/leseansicht";
      const roles = ["lane", "program-main", "orchestrator"] as const;
      const entries = roles.map((rolle) => ({ id: `start-${rolle}`, aussage: `synthetische Startkorrektur ${rolle}`,
        quelle: "private-fixture.md#start", geltung: { projekte: "*", rollen: [rolle], harnesses: ["claude", "codex", "pi-zai"], modi: "*" }, ersetzt: [] }));
      const heft = `# Fixture\n\n\`\`\`owner-korrekturen\n${JSON.stringify({ eintraege: entries })}\n\`\`\`\n`;
      mkdirSync(`${konzeptRoot}/k-owner-korrekturen`, { recursive: true });
      writeFileSync(`${konzeptRoot}/k-owner-korrekturen/v1.md`, heft);
      const published = await call("/api/konzepte/k-owner-korrekturen/versionen", "POST",
        { sha256: sha(heft), ebene: "owner", anlass: "e2e startup", geltung: "synthetische Startprobe" });
      check("konzepte owner delivery fixture: the owner publishes one synthetic correction per position",
        published.status === 200, `${published.status} ${published.text.slice(0, 250)}`);
      if (published.status !== 200) return;
      const fremdOrdner = gitRepo(`${FIXH}/fremd-ordner`);
      type Received = { tag: string; text: string; native: string; pointer: string | null; status: number | null;
        error: string | null; firstAt: number | null; answeredAt: number | null;
        body: { bindung?: { rolle: string; harness: string }; geltendeEintraege?: { id: string }[] } | null };
      const receive = async (slot: number): Promise<Received | null> => {
        for (let n = 0; n < 200; n++) {
          try { return JSON.parse(readFileSync(`${reads}/heft-${slot}.json`, "utf8")) as Received; }
          catch { await Bun.sleep(100); }
        }
        return null;
      };
      const tokenFor = (slot: number): string => {
        const state = JSON.parse(readFileSync(`${i.dir}/fleet.json`, "utf8")) as { slots: Record<string, SlotRow> };
        return state.slots[String(slot)]?.selfToken ?? "";
      };
      const selfCall = async (slot: number, path: string, body: unknown) => {
        const r = await fetch(`${i.base}${path}`, { method: "POST", headers: { "content-type": "application/json",
          "x-fleet-self-token": tokenFor(slot) }, body: JSON.stringify(body) });
        return { status: r.status, text: await r.text() };
      };
      // A CLAUDE LANE OR PROGRAM-MAIN gets the fold (server.ts#ownerKorrekturenText, Charge 4): its own
      // position's entry verbatim, no other position's, no quelle, and the view as live source instead
      // of the "vor deinem ersten Akt" order. Codex, Pi and the Orchestratorin keep the pointer alone.
      const folds = (role: typeof roles[number], harness: string): boolean => harness === "claude" && role !== "orchestrator";
      const delivered = (r: Received | null, role: typeof roles[number], harness: string): boolean =>
        r?.pointer === `${i.base}${door}` && r.status === 200 && r.tag === (harness === "pi-zai" ? "pi" : harness)
        && r.body?.bindung?.rolle === role && r.body.bindung.harness === harness
        && JSON.stringify(r.body.geltendeEintraege?.map((entry) => entry.id)) === JSON.stringify([`start-${role}`])
        && (r.text + r.native).includes('"x-fleet-self-token: $FLEET_SELF_TOKEN"')
        && (folds(role, harness)
          ? (r.text + r.native).includes(`- synthetische Startkorrektur ${role} [start-${role}]`)
            && roles.every((other) => other === role || !(r.text + r.native).includes(`synthetische Startkorrektur ${other}`))
            && (r.text + r.native).includes(`gefaltet fuer ${role}/${harness}`) && !(r.text + r.native).includes("vor deinem ersten Akt")
          : (r.text + r.native).includes("vor deinem ersten Akt") && !(r.text + r.native).includes("synthetische Startkorrektur"))
        && !(r.text + r.native).includes("private-fixture.md")
        && !(r.text + r.native).includes(`${konzeptRoot}/k-owner-korrekturen`);
      for (const harness of ["claude", "codex", "pi-zai"]) {
        const spawn = { harness, model: harness === "pi-zai" ? "glm-5.3" : harness === "codex" ? "gpt-6.1-sol" : "opus", effort: "high" };
        for (const role of roles) {
          let programId: string | null = null;
          let slot: number | null = null;
          let opened: Awaited<ReturnType<typeof call>>;
          for (const file of readdirSync(reads).filter((file) => /^heft-/.test(file))) rmSync(`${reads}/${file}`);
          const foundedAfter = Date.now();
          if (role === "lane") {
            const made = await call("/api/tasks", "POST", { text: "Owner-Heft Startprobe", repo: product, queue: false });
            const taskId = (made.json.task as { id?: string } | undefined)?.id;
            opened = await call(`/api/tasks/${taskId}/dispatch`, "POST", spawn);
            slot = typeof opened.json.slot === "number" ? opened.json.slot : null;
          } else if (role === "program-main") {
            const made = await call("/api/programs", "POST", { title: `heft-${harness}`, intent: "synthetic startup",
              successCriterion: "reader pointer", nonGoals: [], decisions: [], evidence: [], openQuestions: [] });
            programId = (made.json.program as { id?: string } | undefined)?.id ?? null;
            await call(`/api/programs/${programId}/confirm`, "POST", {});
            await call(`/api/programs/${programId}/activate`, "POST", {});
            opened = await call(`/api/programs/${programId}/bootstrap-main`, "POST", { cwd: product, ...spawn });
            slot = typeof opened.json.slot === "number" ? opened.json.slot : null;
          } else {
            slot = await freeSlot();
            opened = await call(`/api/slots/${slot}/open`, "POST", { cwd: product, label: "Orchestrator (heft-fixture)", packs: [], ...spawn });
          }
          const first = slot !== null && opened.status === 200 ? await receive(slot) : null;
          check(`konzepte owner delivery (${harness}/${role}): the first prompt delivers ${folds(role, harness) ? "its position's correction folded" : "only the reader pointer"} and the receiver reads its position's correction`,
            opened.status === 200 && delivered(first, role, harness),
            `open=${opened.status} ${opened.text.slice(0, 200)} received=${JSON.stringify(first)}`);
          // a Program-MAIN is bound in memory before its brief is pasted (bootstrapProgramMainReserved):
          // the read its first prompt triggers, before the founding response even returns, is 200
          check(`konzepte owner delivery (${harness}/${role}): the immediate reader is already position-bound`,
            first?.status === 200 && first.error === null,
            JSON.stringify({ status: first?.status, error: first?.error, firstAt: first?.firstAt, answeredAt: first?.answeredAt }));
          if (slot === null || opened.status !== 200) continue;
          const foreign = await fetch(`${i.base}${door}?rolle=${role === "lane" ? "program-main" : "lane"}`,
            { headers: { "x-fleet-self-token": tokenFor(slot) } });
          const foreignBody = await foreign.text();
          check(`konzepte owner delivery (${harness}/${role}): asking for a foreign position is refused without correction bytes`,
            foreign.status === 400 && foreignBody.includes("never from the request")
              && !foreignBody.includes("geltendeEintraege") && !foreignBody.includes("synthetische Startkorrektur"),
            `${foreign.status} ${foreignBody}`);
          if (role === "lane") {
            // Dispatch returns before briefAndSend's tail. Recycle only after that tail logged its prompt.
            let dispatchComplete = false;
            for (let n = 0; n < 200; n++) {
              const prompts = (await call("/api/prompts?limit=100", "GET")).json.prompts as { slot: number; text: string; ts: number }[] | undefined;
              if (prompts?.some((prompt) => prompt.slot === slot && prompt.ts >= foundedAfter && prompt.text.includes("Owner-Heft Startprobe"))) {
                dispatchComplete = true;
                break;
              }
              await Bun.sleep(100);
            }
            check(`konzepte owner delivery (${harness}/lane): dispatch finished before the fixture recycles its receiver`, dispatchComplete);
            const state = JSON.parse(readFileSync(`${i.dir}/fleet.json`, "utf8")) as { slots: Record<string, SlotRow> };
            const cwd = state.slots[String(slot)]?.cwd;
            if (cwd) { g(cwd, "add", "-A"); g(cwd, "commit", "-q", "-m", "fixture work"); }
            await selfCall(slot, "/api/self/fleet-report", { status: "handoff", text: "synthetic handover; reader still owed" });
          }
          rmSync(`${reads}/heft-${slot}.json`, { force: true });
          const succession = await selfCall(slot, "/api/self/succeed", { model: spawn.model, effort: "high" });
          const second = succession.status === 200 ? await receive(slot) : null;
          check(`konzepte owner delivery (${harness}/${role}): succession delivers ${folds(role, harness) ? "the fold" : "the reader pointer"} under the successor's current position`,
            succession.status === 200 && delivered(second, role, harness),
            `succession=${succession.status} ${succession.text.slice(0, 250)} received=${JSON.stringify(second)}`);
          check(`konzepte owner delivery (${harness}/${role}): the successor's immediate reader is position-bound`, second?.status === 200);
          await call(`/api/slots/${slot}/kill`, "POST", {});
          if (programId) await call(`/api/programs/${programId}/complete`, "POST", { force: true });
        }
        const genericSlot = await freeSlot();
        if (genericSlot !== null) {
          rmSync(`${reads}/heft-${genericSlot}.json`, { force: true });
          const opened = await call(`/api/slots/${genericSlot}/open`, "POST", { cwd: product, label: "Nur Ordner", packs: [], ...spawn });
          await call("/send", "POST", { slot: genericSlot, text: "fleet generic fixture prompt", submit: true });
          const received = opened.status === 200 ? await receive(genericSlot) : null;
          // a seat without a role in Fleet's repo (the product checkout IS this server's repo) reads with the lane's geltung
          // (server.ts#korrekturLeserFor, Orchestratorin 24.10.); its start carries no pointer, its Fassung names the door
          const read = await fetch(`${i.base}${door}`, { headers: { "x-fleet-self-token": tokenFor(genericSlot) } });
          const readBody = await read.text();
          const readJson = (() => { try { return JSON.parse(readBody) as Received["body"]; } catch { return null; } })();
          check(`konzepte owner delivery (${harness}/nur-ordner): the first prompt has no pointer, and in Fleet's repo the reader serves the lane's correction only`,
            opened.status === 200 && received !== null && received.pointer === null && read.status === 200
              && readJson?.bindung?.rolle === "lane" && JSON.stringify(readJson.geltendeEintraege?.map((e) => e.id)) === '["start-lane"]',
            `open=${opened.status} pointer=${received?.pointer} reader=${read.status} ${readBody.slice(0, 300)}`);
          await call(`/api/slots/${genericSlot}/kill`, "POST", {});
        } else check(`konzepte owner delivery (${harness}/nur-ordner): the fixture has a free slot`, false);
        // the same seat in another repository: the heft is personal and does not travel there
        const fremdSlot = await freeSlot();
        if (fremdSlot !== null) {
          rmSync(`${reads}/heft-${fremdSlot}.json`, { force: true });
          const opened = await call(`/api/slots/${fremdSlot}/open`, "POST", { cwd: fremdOrdner, label: "Nur Ordner fremd", packs: [], ...spawn });
          await call("/send", "POST", { slot: fremdSlot, text: "fleet generic fixture prompt", submit: true });
          const received = opened.status === 200 ? await receive(fremdSlot) : null;
          const denied = await fetch(`${i.base}${door}`, { headers: { "x-fleet-self-token": tokenFor(fremdSlot) } });
          const deniedBody = await denied.text();
          check(`konzepte owner delivery (${harness}/nur-ordner fremd): in another repository the first prompt has no pointer and the reader refuses without correction bytes`,
            opened.status === 200 && received !== null && received.pointer === null && denied.status === 409
              && !deniedBody.includes("geltendeEintraege") && !deniedBody.includes("synthetische Startkorrektur"),
            `open=${opened.status} pointer=${received?.pointer} reader=${denied.status} ${deniedBody}`);
          await call(`/api/slots/${fremdSlot}/kill`, "POST", {});
        } else check(`konzepte owner delivery (${harness}/nur-ordner fremd): the fixture has a free slot`, false);
      }

      // ---- THE FAILURE WAY of binding before the brief: a first delivery that fails takes the binding
      // back. The latch holds the founding send before its paste — the candidate is already bound
      // there, which the probe reads with the candidate's own token — then the candidate's pane dies
      // and the paste fails. Nothing may remain: no binding in memory or on disk, no marker, no
      // lineage entry for the candidate, no receipt.
      {
        const latch = `${FIXH}/heft-before-paste-latch`;
        const title = `heft-fault-${randomBytes(4).toString("hex")}`;
        const made = await call("/api/programs", "POST", { title, intent: "synthetic delivery fault",
          successCriterion: "no half MAIN", nonGoals: [], decisions: [], evidence: [], openQuestions: [] });
        const programId = (made.json.program as { id?: string } | undefined)?.id ?? "";
        await call(`/api/programs/${programId}/confirm`, "POST", {});
        await call(`/api/programs/${programId}/activate`, "POST", {});
        const receiptsOf = async (): Promise<number> => ((await call("/api/context-receipts", "GET")).json as
          { receipts?: { programId?: string | null }[] }).receipts?.filter((row) => row.programId === programId).length ?? -1;
        const receiptsBefore = await receiptsOf();
        writeFileSync(latch, title, { mode: 0o600 });
        const pending = call(`/api/programs/${programId}/bootstrap-main`, "POST",
          { cwd: product, harness: "claude", model: "opus", effort: "high" });
        let reached: { slot?: number } | null = null;
        for (let n = 0; n < 300 && reached === null; n++) {
          try { reached = JSON.parse(readFileSync(`${latch}.reached`, "utf8")) as { slot?: number }; }
          catch { await Bun.sleep(100); }
        }
        const faultSlot = typeof reached?.slot === "number" ? reached.slot : null;
        const held = faultSlot === null ? null
          : await fetch(`${i.base}${door}`, { headers: { "x-fleet-self-token": tokenFor(faultSlot) } });
        const heldStatus = held?.status ?? null;
        await held?.text();
        const killed = faultSlot === null ? null : spawnSync("tmux", ["-L", i.sock, "kill-session", "-t", `s${faultSlot}`]).status;
        writeFileSync(`${latch}.release`, "release\n");
        const answer = await pending;
        type ProgramRow = { id: string; main?: unknown; founding?: unknown; lineage?: { entries: { slot: number }[] } };
        const after = ((await call("/api/programs", "GET")).json.programs as ProgramRow[] | undefined)?.find((p) => p.id === programId);
        const onDisk = (JSON.parse(readFileSync(`${i.dir}/fleet.json`, "utf8")) as { programs?: ProgramRow[] })
          .programs?.find((p) => p.id === programId);
        const receiptsAfter = await receiptsOf();
        check("konzepte owner delivery (failed first delivery): the candidate is bound before the paste, and a paste that fails leaves no binding, marker, lineage entry or receipt",
          faultSlot !== null && heldStatus === 200 && killed === 0 && answer.status >= 400
            && /founding brief failed|slot changed/.test(answer.text)
            && after !== undefined && after.main === undefined && after.founding === undefined
            && !after.lineage?.entries.some((entry) => entry.slot === faultSlot)
            && onDisk !== undefined && onDisk.main === undefined && onDisk.founding === undefined
            && receiptsBefore >= 0 && receiptsAfter === receiptsBefore,
          JSON.stringify({ slot: faultSlot, heldStatus, killed, answer: [answer.status, answer.text.slice(0, 200)],
            after: after ? { main: after.main, founding: after.founding, lineage: after.lineage } : null,
            onDisk: onDisk ? { main: onDisk.main, founding: onDisk.founding } : null, receipts: [receiptsBefore, receiptsAfter] }));
        for (const suffix of ["", ".reached", ".release"]) rmSync(`${latch}${suffix}`, { force: true });
        if (programId) await call(`/api/programs/${programId}/complete`, "POST", { force: true });
      }

      const sourcePath = `${i.dir}/server.ts`;
      const original = readFileSync(sourcePath, "utf8");
      const mutant = original.replace(/function ownerKorrekturenPointer\(\): string \{[\s\S]*?\n\}/, 'function ownerKorrekturenPointer(): string { return ""; }');
      check("konzepte owner delivery mutation fixture: the scratch server loses only its reader pointer", mutant !== original);
      await stop(i);
      spawnSync("tmux", ["-L", i.sock, "kill-server"]);
      writeFileSync(sourcePath, mutant);
      try {
        const mutatedBoot = await bootH(konzeptRoot);
        const slot = await freeSlot();
        if (slot !== null) rmSync(`${reads}/heft-${slot}.json`, { force: true });
        const opened = slot === null ? null : await call(`/api/slots/${slot}/open`, "POST",
          { cwd: product, label: "Orchestrator (mutation)", harness: "codex", model: "gpt-6.1-sol", effort: "high", packs: [] });
        const received = slot !== null && opened?.status === 200 ? await receive(slot) : null;
        check("konzepte owner delivery mutation: removing the startup pointer turns the same receiver claim red despite a successful founding",
          mutatedBoot && opened?.status === 200 && received !== null && received.pointer === null && received.status === null
            && !delivered(received, "orchestrator", "codex"), `open=${opened?.status} received=${JSON.stringify(received)}`);
      } finally {
        await stop(i);
        spawnSync("tmux", ["-L", i.sock, "kill-server"]);
        writeFileSync(sourcePath, original);
      }
    }

    // ---- MISSING ROOT, and the mutation "root not handed over": the same founding on an instance
    // without FLEET_KONZEPT_ROOT turns the same read claim red, by name
    await stop(i);
    spawnSync("tmux", ["-L", i.sock, "kill-server"]);
    up = await bootH("");
    check("konzepte handover fixture: the instance boots again WITHOUT a konzept root", up, i.log.slice(-300));
    if (!up) return;
    const noRoot = await found("claude");
    check("konzepte handover (missing root): no anchor reaches the pane, and the receipt omits the pack naming the unset env",
      noRoot.open?.status === 200 && noRoot.record !== null && noRoot.record.verdict === null && noRoot.record.path === null
        && !readClaim(noRoot.record) && !noRoot.receipt?.selected.some((sel) => sel.id === SEED_ID)
        && noRoot.receipt?.omitted.some((sel) => sel.id === SEED_ID && sel.why === "source-unavailable"
          && sel.reason?.includes("FLEET_KONZEPT_ROOT is not set on this server")) === true,
      `record=${JSON.stringify(noRoot.record)} receipt=${JSON.stringify(noRoot.receipt)}`);
  } finally {
    await stop(i);
    spawnSync("tmux", ["-L", i.sock, "kill-server"]);
    rmSync(FIXH, { recursive: true, force: true });
  }
}
