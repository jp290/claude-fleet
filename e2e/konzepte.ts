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
        && !JSON.stringify(idx.body).includes("# Konzept") && idxSelf.status === 401 && idxBoth.status === 409,
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
