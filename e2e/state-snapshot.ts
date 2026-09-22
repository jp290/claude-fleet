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
const KEYS = '["att","clar","ev","lanes","programs","q","rep","ts"]';

type Row = Record<string, unknown> & { ts: number; q: Record<string, number>; lanes: { s: number }[] };
interface Instance { dir: string; port: number; sock: string; proc: ReturnType<typeof Bun.spawn>; log: () => string }

function stage(name: string): string {
  const dir = `${FIX}/${name}`;
  mkdirSync(dir, { recursive: true });
  for (const e of readdirSync(ROOT)) if (!SKIP.test(e)) cpSync(`${ROOT}/${e}`, `${dir}/${e}`, { recursive: true });
  symlinkSync(`${ROOT}/node_modules`, `${dir}/node_modules`);
  return dir;
}

async function boot(name: string, off: number, snapMs: string): Promise<Instance> {
  const dir = stage(name);
  const port = PORT + off;
  const sock = `${SOCK}snap${off}`;
  let out = "";
  const proc = Bun.spawn(["bun", "server.ts"], {
    cwd: dir, stdout: "pipe", stderr: "pipe",
    env: { ...process.env, FLEET_HOST: IP, FLEET_PORT: String(port), FLEET_SOCK: sock, FLEET_TOKEN: TOKEN,
      FLEET_CMD: "true", FLEET_AUTO_REVIEW_MS: "0", FLEET_STATE_SNAPSHOT_MS: snapMs,
      FLEET_AUDIT_ROTATE_BYTES: String(ROTATE_BYTES) },
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

async function reap(i: Instance): Promise<void> {
  i.proc.kill("SIGTERM");
  await Promise.race([i.proc.exited, Bun.sleep(5000)]);
  i.proc.kill("SIGKILL");
  spawnSync("tmux", ["-L", i.sock, "kill-server"]);
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
    rmSync(FIX, { recursive: true, force: true });
  }
}
