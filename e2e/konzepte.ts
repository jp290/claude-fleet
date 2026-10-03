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
//   scope             — let a plain session (neither lane nor bound MAIN) read or write, or 401 it.
//   index             — list a directory that is no konzept id, read a fassung into the list, miscount the
//                       fold, or answer a request carrying a self token anything but 401 (alone) / 409
//                       (beside the owner's) — GET /api/konzepte, the board's list.
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

interface Instance { dir: string; base: string; sock: string; root: string; proc: ReturnType<typeof Bun.spawn> | null; log: string }
interface SlotRow { selfToken?: string; openedAt?: number; sessionId?: string | null; cwd?: string | null;
  worktree?: { repo?: string; branch?: string }; taskId?: string | null; programId?: string | null }
interface Answer { status: number; body: { error?: string; ok?: boolean; version?: KonzeptVersion; anmerkung?: KonzeptAnmerkung;
  versionen?: KonzeptVersion[]; anmerkungen?: KonzeptAnmerkung[]; letzte?: number | null; malformed?: number } }

async function boot(i: Instance): Promise<boolean> {
  i.proc = Bun.spawn(["bun", "server.ts"], {
    cwd: i.dir, stdout: "pipe", stderr: "pipe",
    env: { ...process.env, FLEET_HOST: IP, FLEET_PORT: i.base.split(":").pop()!, FLEET_SOCK: i.sock,
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
    let up = await boot(i);
    check("konzepte fixture: the scratch instance boots on its own port and socket", up, i.log.slice(-300));
    if (!up) return;
    await fetch(`${i.base}/api/slots/1/open`, { method: "POST", headers: OH, body: JSON.stringify({ cwd: plain, label: "konzept-main" }) });
    await fetch(`${i.base}/api/slots/3/open`, { method: "POST", headers: OH, body: JSON.stringify({ cwd: plain, label: "konzept-plain" }) });
    const wt = await fetch(`${i.base}/api/slots/${LANE}/open`, { method: "POST", headers: OH, body: JSON.stringify({ cwd: laneDir, label: "konzept-lane" }) });
    const wtBody = await wt.text();
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
    const opened = addWt.status === 0 && wt.ok && rows.every(credentialed);
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
    writeFileSync(`${i.dir}/fleet.json`, JSON.stringify(planted, null, 2), { mode: 0o600 });
    up = await boot(i);
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

    // ---- scope: a plain session is 409 on read and write, no token 401
    const plainW = await self(plainTok!, "anmerkungen", "POST", { version: 1, text: "x" });
    const plainR = await self(plainTok!, "versionen", "GET");
    const anon = await call(`/api/self/konzepte/${K}/versionen`, "GET", {});
    const anonOwner = await call(`/api/konzepte/${K}/versionen`, "GET", {});
    check("konzepte scope: a plain session is 409 on both verbs, a missing credential 401 on both doors",
      plainW.status === 409 && plainR.status === 409 && /neither/.test(plainW.body.error ?? "") && anon.status === 401 && anonOwner.status === 401,
      `plain=${plainW.status}/${plainR.status} ${plainW.body.error} anon=${anon.status}/${anonOwner.status}`);

    // ---- missing root: 503 naming FLEET_KONZEPT_ROOT, on read and write, and nothing is created
    renameSync(i.root, `${i.root}.away`);
    const goneW = await self(laneTok!, "anmerkungen", "POST", { version: 1, text: "ins Nichts" });
    const goneR = await owner("versionen", "GET");
    const goneIdx = await call("/api/konzepte", "GET", OH);
    const recreated = existsSync(i.root);
    renameSync(`${i.root}.away`, i.root);
    check("konzepte missing root: 503 naming FLEET_KONZEPT_ROOT on read and write, and no root is created",
      goneW.status === 503 && goneR.status === 503 && goneIdx.status === 503
        && (goneW.body.error ?? "").includes("FLEET_KONZEPT_ROOT") && !recreated,
      `write=${goneW.status} ${goneW.body.error} read=${goneR.status} index=${goneIdx.status} recreated=${recreated}`);
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
    const launcher = (tag: string) => `#!/bin/sh\nprintf '%s\\n' '>_ OpenAI Codex (v0.0.0-e2e-reader)'\n`
      + `stty -icanon -echo 2>/dev/null\nexec '${FIXH}/runner/codex' '${FIXH}/reader.ts' '${reads}' '${tag}'\n`;
    writeFileSync(`${bin}/fleet-reader`, launcher("claude"), { mode: 0o755 });
    writeFileSync(`${bin}/codex`, launcher("codex"), { mode: 0o755 });
    // every Pi adapter spawns `pi` by name: shadowed here too, so a regression that lets a Pi founding
    // through reaches this reader and never a real agent with a provider behind it (measured in this
    // lane's own mutation run: without the shadow, the host's `pi` was spawned and handed the brief)
    writeFileSync(`${bin}/pi`, launcher("pi"), { mode: 0o755 });
    mkdirSync(`${FIXH}/codex-home`, { recursive: true });
    const bootH = async (root: string): Promise<boolean> => {
      i.proc = Bun.spawn(["bun", "server.ts"], {
        cwd: i.dir, stdout: "pipe", stderr: "pipe",
        env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}`, CODEX_HOME: `${FIXH}/codex-home`,
          FLEET_HOST: IP, FLEET_PORT: String(PORT + HOFF), FLEET_SOCK: i.sock, FLEET_TOKEN: TOKEN,
          FLEET_CMD: `${bin}/fleet-reader`, FLEET_HARNESS_COMMS: "", FLEET_AUTO_REVIEW_MS: "0", FLEET_STATE_SNAPSHOT_MS: "0",
          FLEET_POSTLAND_AUDIT_CMD: "true", FLEET_KONZEPT_ROOT: root, FLEET_FOUNDING_BOOT_GRACE_MS: "300",
          FLEET_ACCEPT_WAIT_MS: "800", FLEET_PI_ZAI_AGENT_DIR: `${FIXH}/pi-zai-agent`,
          FLEET_PI_OX_AGENT_DIR: `${FIXH}/pi-ox-agent`, FLEET_PI_ZAI_KEY_FILE: `${FIXH}/no-such-key` },
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
      record: ReaderRecord | null; receipt: Awaited<ReturnType<typeof receiptFor>> }> => {
      const slot = await freeSlot();
      if (slot === null) return { slot, open: null, record: null, receipt: null };
      rmSync(`${reads}/read-${slot}.json`, { force: true });
      const open = await call(`/api/slots/${slot}/open`, "POST", { cwd: product, harness, label: `privat-${harness}`, packs: [SEED_ID] });
      let record: ReaderRecord | null = null;
      for (let n = 0; n < 100 && record === null && open.status === 200; n++) {
        try { record = JSON.parse(readFileSync(`${reads}/read-${slot}.json`, "utf8")) as ReaderRecord; } catch { await Bun.sleep(100); }
      }
      const receipt = await receiptFor(slot);
      await call(`/api/slots/${slot}/kill`, "POST", {});
      return { slot, open, record, receipt };
    };
    const readClaim = (r: ReaderRecord | null): boolean => r?.bytes === SENTINEL;
    const outsideProduct = (path: string | null): boolean =>
      path !== null && path.startsWith(`${konzeptRoot}/${PK}/`) && !path.startsWith(`${product}/`);

    // ---- POSITIVE, both released harnesses: the spawned process reads the sentinel bytes
    for (const harness of ["claude", "codex"]) {
      const f = await found(harness);
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
    check("konzepte handover (pi harnesses): pi, pi-zai, pi-ox and pi-unfenced are each refused 409 harness-unsupported before the spawn, no path anywhere",
      piHarnesses.length === 4 && piRead.length === 0 && piRows.every((r) => r.reason === "harness-unsupported" && r.open === 409
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
