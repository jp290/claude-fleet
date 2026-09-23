// THE STATE SNAPSHOT TRAIL (server.ts#buildStateSnapshot): one row of counts per
// FLEET_STATE_SNAPSHOT_MS in state-snapshots.jsonl, written through server/persist.ts#appendEvent.
//
// ITS OWN SCRATCH INSTANCE, not the suite's srv: the rotation half needs a tiny
// FLEET_AUDIT_ROTATE_BYTES, and that knob is process-wide — on the suite's server it would rotate
// audit.jsonl under every later family that reads it. So this family copies the staged tree into a
// fixture directory (no state files), boots it on its own port and socket, and reaps both after.
//
// What each section can turn red, stated as the mutation:
//   §a cadence + one key set — drop a key on one branch of buildStateSnapshot, or never arm the tick.
//   §b growth — take `q` or `lanes` out of the row, or count tasks/lanes from anything but the live state.
//   §c no text — put Task.text or a slot's cwd into the row; the planted LEAK marker is grepped.
//   §d rotation — write the row with anything but appendEvent (no .1 ever appears).
//   §e off — register the setInterval unconditionally; the file then grows at 0.
//   §f observations — see observations() below.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { check, IP, PORT, ROOT, SOCK } from "./harness";

const TMP = process.env.TMPDIR ?? "/tmp";
const FIX = `${TMP}/fleet-e2e-snapshot-${process.pid}`;
const TOKEN = `snap-${randomBytes(8).toString("hex")}`;
const SNAP_MS = 200;
// ~170 B a row: a rotation every ~20 rows, i.e. every ~4 s at SNAP_MS
const ROTATE_BYTES = 3500;
const LEDGER = "state-snapshots.jsonl";
// the state a staged tree carries next to its code; a fixture instance must boot empty
const SKIP = /^(\.git|node_modules|streams|e2e|e2e-trail|drops|fleet\.json.*|fleet\.pid|.*\.jsonl(\.\d+|\.archive)?|.*\.log|post-land-audit-queue\.json.*|deploy-inflight\.json.*)$/;
const KEYS = '["att","bootEpoch","clar","ev","lanes","programs","q","rep","ts"]';
// one lane element since the identity cut (memory M3, task 91b039eb)
const LANE_KEYS = '["ahead","alive","branch","dirty","idleS","merge","obs","openedAt","programId","projectKey","s","sessionId","taskId"]';

interface LaneEl { s: number; openedAt?: number; taskId?: string | null; obs?: string; idleS?: number | null; sessionId?: string | null }
type Row = Record<string, unknown> & { ts: number; bootEpoch?: number; q: Record<string, number>; lanes: LaneEl[] };
interface Instance { dir: string; port: number; sock: string; proc: ReturnType<typeof Bun.spawn>; log: () => string }

function stage(name: string): string {
  const dir = `${FIX}/${name}`;
  mkdirSync(dir, { recursive: true });
  for (const e of readdirSync(ROOT)) if (!SKIP.test(e)) cpSync(`${ROOT}/${e}`, `${dir}/${e}`, { recursive: true });
  symlinkSync(`${ROOT}/node_modules`, `${dir}/node_modules`);
  return dir;
}

// `dir` given = a REBOOT of an instance already staged there (its state and ledgers stay)
async function boot(name: string, off: number, snapMs: string, rotateBytes = ROTATE_BYTES, dir = stage(name)): Promise<Instance> {
  const port = PORT + off;
  const sock = `${SOCK}snap${off}`;
  let out = "";
  const proc = Bun.spawn(["bun", "server.ts"], {
    cwd: dir, stdout: "pipe", stderr: "pipe",
    env: { ...process.env, FLEET_HOST: IP, FLEET_PORT: String(port), FLEET_SOCK: sock, FLEET_TOKEN: TOKEN,
      FLEET_CMD: "true", FLEET_AUTO_REVIEW_MS: "0", FLEET_STATE_SNAPSHOT_MS: snapMs,
      FLEET_AUDIT_ROTATE_BYTES: String(rotateBytes) },
  });
  const drain = async (s: ReadableStream<Uint8Array>) => { for await (const c of s) out += new TextDecoder().decode(c); };
  void drain(proc.stdout as ReadableStream<Uint8Array>);
  void drain(proc.stderr as ReadableStream<Uint8Array>);
  for (let i = 0; i < 150; i++) {
    const ok = await fetch(`http://${IP}:${port}/api/sessions`, { headers: { authorization: `Bearer ${TOKEN}` } })
      .then((r) => r.ok, () => false);
    if (ok) break;
    await Bun.sleep(100);
  }
  return { dir, port, sock, proc, log: () => out };
}

// `keepPanes`: stop the server only, as a deploy does — the lanes' panes survive for the reboot
async function reap(i: Instance, keepPanes = false): Promise<void> {
  i.proc.kill("SIGTERM");
  await Promise.race([i.proc.exited, Bun.sleep(5000)]);
  i.proc.kill("SIGKILL");
  if (!keepPanes) spawnSync("tmux", ["-L", i.sock, "kill-server"]);
}

// both generations, oldest first; a torn last line is not a row
function rows(dir: string): Row[] {
  const out: Row[] = [];
  for (const f of [`${dir}/${LEDGER}.archive`, `${dir}/${LEDGER}.1`, `${dir}/${LEDGER}`]) {
    if (!existsSync(f)) continue;
    for (const l of readFileSync(f, "utf8").split("\n")) {
      try { out.push(JSON.parse(l) as Row); } catch { /* torn or empty */ }
    }
  }
  return out;
}
const ledgerBytes = (dir: string): string =>
  [`${dir}/${LEDGER}`, `${dir}/${LEDGER}.1`, `${dir}/${LEDGER}.archive`].filter(existsSync).map((f) => readFileSync(f, "utf8")).join("");

function strings(v: unknown, acc: string[] = []): string[] {
  if (typeof v === "string") acc.push(v);
  else if (Array.isArray(v)) for (const x of v) strings(x, acc);
  else if (v && typeof v === "object") for (const x of Object.values(v)) strings(x, acc);
  return acc;
}

async function until<T>(pred: () => T | undefined | false, ms: number): Promise<T | undefined> {
  const end = Date.now() + ms;
  for (;;) {
    const v = pred();
    if (v) return v;
    if (Date.now() > end) return undefined;
    await Bun.sleep(50);
  }
}

export async function run(): Promise<void> {
  rmSync(FIX, { recursive: true, force: true });
  mkdirSync(FIX, { recursive: true });
  // the lane's own repo, so the fixture never adds a worktree to the suite's FLEET_E2E_REPO
  const repo = `${FIX}/repo`;
  mkdirSync(repo);
  writeFileSync(`${repo}/a.txt`, "a\n");
  spawnSync("sh", ["-c", "git init -q -b main && git add a.txt && git -c user.email=e2e@x -c user.name=e2e commit -qm init"], { cwd: repo });

  const on = await boot("on", 23, String(SNAP_MS));
  try {
    const H = { "content-type": "application/json", authorization: `Bearer ${TOKEN}` };
    const base = `http://${IP}:${on.port}`;
    const postTo = (path: string, body: unknown) => fetch(base + path, { method: "POST", headers: H, body: JSON.stringify(body) });

    check("state snapshot: the boot line says the tick is armed at the configured cadence",
      on.log().includes(`[fleet] state snapshot armed: FLEET_STATE_SNAPSHOT_MS=${SNAP_MS}`), on.log().slice(-400));

    // §a — cadence and one key set
    const t0 = Date.now();
    const three = await until(() => rows(on.dir).length >= 3, 2000);
    check("state snapshot: FLEET_STATE_SNAPSHOT_MS=200 writes at least 3 rows within 2 s",
      !!three, `${rows(on.dir).length} rows after ${Date.now() - t0} ms`);
    const keySets = new Set(rows(on.dir).map((r) => JSON.stringify(Object.keys(r).sort())));
    check("state snapshot: every row carries exactly one key set",
      keySets.size === 1 && keySets.has(KEYS), [...keySets].join(" | "));

    // §b — growth after a task and a lane
    const before = rows(on.dir).at(-1);
    const marker = `LEAK-${randomBytes(6).toString("hex")}`;
    const tRes = await postTo("/api/tasks", { text: `snapshot probe ${marker} must never reach the ledger`, queue: false });
    const lRes = await postTo("/api/lanes", { repo });
    const lane = (await lRes.json().catch(() => ({}))) as { slot?: number };
    check("state snapshot setup: a task and a lane were created on the fixture instance",
      tRes.ok && lRes.ok && typeof lane.slot === "number", `task ${tRes.status} lane ${lRes.status} ${JSON.stringify(lane)}`);
    const mark = Date.now();
    const after = await until(() => rows(on.dir).find((r) => r.ts > mark), 3000);
    check("state snapshot: q.pending grows by exactly 1 with the new task",
      !!before && !!after && after.q.pending === before.q.pending + 1,
      `before ${JSON.stringify(before?.q)} after ${JSON.stringify(after?.q)}`);
    check("state snapshot: lanes grows by one entry carrying the new lane's slot",
      !!before && !!after && after.lanes.length === before.lanes.length + 1 && after.lanes.some((l) => l.s === lane.slot),
      `before ${JSON.stringify(before?.lanes)} after ${JSON.stringify(after?.lanes)}`);
    const el = after?.lanes.find((l) => l.s === lane.slot);
    check("state snapshot: the lane element carries exactly the identity key set — a hand-opened lane's taskId is null, not absent",
      !!el && JSON.stringify(Object.keys(el).sort()) === LANE_KEYS && el.taskId === null
        && typeof el.openedAt === "number" && after?.bootEpoch !== undefined && typeof after.bootEpoch === "number",
      JSON.stringify(el ?? null));

    // §d — rotation through appendEvent (also gives §c more rows to look at)
    const rotated = await until(() => existsSync(`${on.dir}/${LEDGER}.1`), 15_000);
    check("state snapshot: the ledger rotates to state-snapshots.jsonl.1 at FLEET_AUDIT_ROTATE_BYTES",
      !!rotated, `live ${existsSync(`${on.dir}/${LEDGER}`) ? statSync(`${on.dir}/${LEDGER}`).size : -1} B`);
    const mode = existsSync(`${on.dir}/${LEDGER}.1`) ? statSync(`${on.dir}/${LEDGER}.1`).mode & 0o777 : -1;
    check("state snapshot: the rotated generation is 600, like every appendEvent trail", mode === 0o600, mode.toString(8));
    const allKeys = new Set(rows(on.dir).map((r) => JSON.stringify(Object.keys(r).sort())));
    check("state snapshot: one key set across both generations", allKeys.size === 1, [...allKeys].join(" | "));

    // §c — no text
    const raw = ledgerBytes(on.dir);
    const long = rows(on.dir).flatMap((r) => strings(r)).filter((s) => s.length > 40);
    check("state snapshot: the planted task marker appears nowhere in the ledger",
      raw.length > 0 && !raw.includes(marker), `${raw.length} B scanned`);
    check("state snapshot: no string in any row is longer than 40 characters",
      rows(on.dir).length > 0 && long.length === 0, long.slice(0, 2).join(" | "));
    check("state snapshot: no row names the lane's repo path", raw.length > 0 && !raw.includes(FIX));
  } finally {
    await reap(on);
  }

  // §e — 0 registers no tick
  const off = await boot("off", 24, "0");
  try {
    check("state snapshot: FLEET_STATE_SNAPSHOT_MS=0 boots with the 'off' line",
      off.log().includes("[fleet] state snapshot off (FLEET_STATE_SNAPSHOT_MS=0) — no tick registered"), off.log().slice(-400));
    const answered = await fetch(`http://${IP}:${off.port}/api/sessions`, { headers: { authorization: `Bearer ${TOKEN}` } })
      .then((r) => r.ok, () => false);
    await Bun.sleep(SNAP_MS * 5);
    check("state snapshot: FLEET_STATE_SNAPSHOT_MS=0 writes no ledger at all",
      answered && !existsSync(`${off.dir}/${LEDGER}`), `answered=${answered}`);
  } finally {
    await reap(off);
  }
  try {
    await observations(repo);
  } finally {
    rmSync(FIX, { recursive: true, force: true });
  }
}

// §f — THE OBSERVATION HISTORY (memory M3, task 91b039eb): the identity the writer stamps and the
// reader that attributes by it. Two occupations of ONE slot (two tasks, one after the other), each
// read through its own lane's self credential and checked against the windows this test observed
// from outside (open → kill); planted legacy rows on that slot; a reboot with the second lane still
// standing; a foreign task; and the planted secrets and prose grepped out of the whole ledger.
// What each check can turn red, stated as the mutation: attribute by slot number (lane 2 sees lane
// 1's samples, or a legacy element); drop openedAt/taskId from the element; read the boot stamp as
// an observed idle phase; serve another lane's task; write task text, a credential or pane text.
async function observations(repo: string): Promise<void> {
  const dir = `${FIX}/obs`;
  stage("obs");
  // two LEGACY rows in the pre-M3 shape, naming slots 1–3 by number only
  const legacy = [0, 1].map((k) => JSON.stringify({ ts: Date.now() - 60_000 + k, q: { pending: 0, queued: 0, sent: 0, done: 0 },
    lanes: [1, 2, 3].map((n) => ({ s: n, alive: true, idleS: 5, ahead: 0, dirty: false, merge: null })),
    rep: { open: 0 }, att: { open: 0 }, clar: { open: 0 }, ev: { held: 0, undelivered: 0 }, programs: { active: 0 } })).join("\n") + "\n";
  writeFileSync(`${dir}/${LEDGER}`, legacy, { mode: 0o600 });
  let inst = await boot("obs", 26, String(SNAP_MS), 50_000_000, dir);
  const base = () => `http://${IP}:${inst.port}`;
  const H = { "content-type": "application/json", authorization: `Bearer ${TOKEN}` };
  const post = (path: string, body: unknown) => fetch(base() + path, { method: "POST", headers: H, body: JSON.stringify(body) });
  const state = () => JSON.parse(readFileSync(`${dir}/fleet.json`, "utf8")) as {
    slots: Record<string, { selfToken?: string; openedAt?: number; taskId?: string | null; worktree?: unknown }> };
  type ObsRow = { ts: number; bootEpoch: number | null; slot: number; openedAt: number; activity: { basis: string; state?: string } };
  type ObsBody = { refusal?: string; rows?: ObsRow[]; occupancies?: { slot: number; openedAt: number; samples: number }[];
    unattributed?: { legacyRows: number; legacyElementsOnTaskSlots: number }; coverage?: string; nextCursor?: string | null;
    unknown?: string[] };
  const read = async (tok: string, q = ""): Promise<{ status: number; body: ObsBody; all: ObsRow[] }> => {
    const pages: ObsBody[] = [];
    let status = 0;
    let cursor: string | null | undefined = "";
    while (pages.length < 50 && cursor !== null && cursor !== undefined) {
      const r = await fetch(`${base()}/api/self/memory?view=observations${q}${cursor ? `&cursor=${cursor}` : ""}`,
        { headers: { "x-fleet-self-token": tok } });
      status = r.status;
      const b = (await r.json().catch(() => ({}))) as ObsBody;
      pages.push(b);
      if (r.status !== 200) break;
      cursor = b.nextCursor;
    }
    return { status, body: pages.at(-1) ?? {}, all: pages.flatMap((p) => p.rows ?? []) };
  };
  // the ledger's own samples of one task: [ts, slot, openedAt]
  const samplesOf = (taskId: string): { ts: number; s: number; openedAt?: number }[] =>
    rows(dir).flatMap((r) => r.lanes.filter((l) => l.taskId === taskId).map((l) => ({ ts: r.ts, s: l.s, openedAt: l.openedAt })));
  const dispatchLane = async (taskId: string): Promise<{ slot: number; tok: string; openedAt: number }> => {
    const d = (await (await post(`/api/tasks/${taskId}/dispatch`, {})).json().catch(() => ({}))) as { slot?: number };
    for (let k = 0; k < 80 && typeof d.slot === "number"; k++) {
      const sl = state().slots[String(d.slot)];
      if (sl?.worktree && sl.taskId === taskId && /^[0-9a-f]{32}$/.test(sl.selfToken ?? "") && typeof sl.openedAt === "number")
        return { slot: d.slot, tok: sl.selfToken!, openedAt: sl.openedAt };
      await Bun.sleep(100);
    }
    return { slot: -1, tok: "", openedAt: -1 };
  };
  const marker = `LEAK-${randomBytes(6).toString("hex")}`;
  const prose = `PANE-${randomBytes(6).toString("hex")}`;
  try {
    const made = await Promise.all([1, 2].map((n) =>
      post("/api/tasks", { text: `observation probe ${n} ${marker} must never reach the ledger`, repo, queue: false })
        .then((r) => r.json()).catch(() => ({})) as Promise<{ id?: string; task?: { id?: string } }>));
    const [T1, T2] = made.map((m) => m.task?.id ?? m.id ?? "");
    const L1 = await dispatchLane(T1!);
    const open1 = Date.now();
    check("observations setup: two tasks exist and the first is a dispatched lane with its own credential",
      !!T1 && !!T2 && L1.slot > 0, JSON.stringify({ T1, T2, L1: { slot: L1.slot, openedAt: L1.openedAt } }));
    // pane prose: typed into lane 1's pane, which also gives that pane OBSERVED output
    spawnSync("tmux", ["-L", inst.sock, "send-keys", "-t", `s${L1.slot}`, "-l", `echo ${prose}`]);
    await until(() => samplesOf(T1!).length >= 5, 5000);
    const before1 = samplesOf(T1!);
    const r1 = await read(L1.tok);
    const after1 = samplesOf(T1!);
    await post(`/api/slots/${L1.slot}/kill`, {});
    const kill1 = Date.now();
    const L2 = await dispatchLane(T2!);
    check("observations setup: the second task's lane is a NEW occupation of the SAME slot",
      L2.slot === L1.slot && L2.openedAt !== L1.openedAt && L2.openedAt >= kill1, JSON.stringify({ L1: { slot: L1.slot, openedAt: L1.openedAt }, L2: { slot: L2.slot, openedAt: L2.openedAt } }));
    await until(() => samplesOf(T2!).length >= 5, 5000);
    const before2 = samplesOf(T2!);
    const r2 = await read(L2.tok);
    const after2 = samplesOf(T2!);
    const inWindow = (rs: ObsRow[], from: number, to: number) => rs.every((x) => x.ts >= from - 1000 && x.ts <= to);
    check("observations: lane 1 reads every sample of its occupation written before the read, each naming its own openedAt, all inside its open→kill window",
      r1.status === 200 && r1.all.length >= 5 && r1.all.every((x) => x.slot === L1.slot && x.openedAt === L1.openedAt)
        && before1.every((b) => r1.all.some((x) => x.ts === b.ts)) && r1.all.every((x) => after1.some((a) => a.ts === x.ts))
        && inWindow(r1.all, open1, kill1) && r1.body.occupancies?.length === 1,
      `${r1.status} rows=${r1.all.length} before=${before1.length} occ=${JSON.stringify(r1.body.occupancies)}`);
    check("observations: lane 2 on the recycled slot reads only its own occupation — none of lane 1's samples, all after the kill",
      r2.status === 200 && r2.all.length >= 5 && r2.all.every((x) => x.slot === L2.slot && x.openedAt === L2.openedAt)
        && before2.every((b) => r2.all.some((x) => x.ts === b.ts)) && r2.all.every((x) => after2.some((a) => a.ts === x.ts))
        && !r2.all.some((x) => before1.some((b) => b.ts === x.ts)) && r2.all.every((x) => x.ts >= kill1)
        && r2.body.occupancies?.length === 1 && r2.body.coverage === "complete",
      `${r2.status} rows=${r2.all.length} occ=${JSON.stringify(r2.body.occupancies)} cov=${r2.body.coverage}`);
    check("observations (legacy row): rows without identity are counted as unattributed, never read as this slot's lane",
      r2.body.unattributed?.legacyRows === 2 && r2.body.unattributed.legacyElementsOnTaskSlots === 2
        && (r2.body.unknown ?? []).some((u) => u.includes("predate the identity keys"))
        && !r2.all.some((x) => x.ts < open1 - 1000),
      JSON.stringify({ un: r2.body.unattributed, u: r2.body.unknown }));
    check("observations: lane 1's samples after the typed prose carry observed output as their basis",
      r1.all.some((x) => x.activity.basis === "output"), JSON.stringify(r1.all.slice(0, 3).map((x) => x.activity)));
    const foreign = await read(L2.tok, `&task=${T1}`);
    check("observations refusal (foreign task): lane 2 asking for the first task's samples is a named 409, with no sample",
      foreign.status === 409 && foreign.body.refusal === "foreign-task" && foreign.all.length === 0, JSON.stringify(foreign.body));

    // a reboot with lane 2 still standing: its idle clock restarts at the boot stamp, which is no
    // observed quiet phase — the samples say so, and the reader turns them into activity unknown
    const boot1 = rows(dir).at(-1)?.bootEpoch;
    await reap(inst, true);
    inst = await boot("obs", 26, String(SNAP_MS), 50_000_000, dir);
    const rebooted = await until(() => rows(dir).some((r) => r.bootEpoch !== boot1 && r.lanes.some((l) => l.taskId === T2)), 5000);
    const r3 = await read(L2.tok);
    const post3 = r3.all.filter((x) => x.bootEpoch !== boot1);
    check("observations (boot without observed activity): samples after the reboot carry the new bootEpoch and activity unknown on the boot basis",
      !!rebooted && r3.status === 200 && post3.length > 0 && post3.every((x) => x.openedAt === L2.openedAt)
        && post3.some((x) => x.activity.basis === "boot" && x.activity.state === "unknown")
        && post3.every((x) => x.activity.basis !== "boot" || x.activity.state === "unknown")
        && (r3.body.unknown ?? []).some((u) => u.includes("idle clock is a stamp")),
      JSON.stringify({ boot1, post: post3.slice(0, 3) }));

    const raw = ledgerBytes(dir);
    const secrets = [marker, prose, TOKEN, L1.tok, L2.tok, FIX];
    check("observations: task text, pane prose, the owner token, both lane credentials and the repo path appear in 0 snapshot fields",
      raw.length > 0 && secrets.every((x) => x !== "" && !raw.includes(x)),
      secrets.filter((x) => raw.includes(x)).map((x) => x.slice(0, 12)).join(","));
  } finally {
    await reap(inst);
  }
}
