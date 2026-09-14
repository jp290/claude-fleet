// The verify GATE made visible (briefs/verify-queue-2026-08-04.md): the machine-wide suite mutex
// projected onto /api/sessions, and the phase reports lanes volunteer through
// POST /api/self/verify-intent.
//
// Two halves, tested as two different KINDS of claim:
//
//  · The LOCK is a measurement. §1 checks it against the mutex this very suite is holding — the
//    wrapper's own /tmp/fleet-e2e.lock, read independently by this harness, so the assertion is
//    "server and filesystem agree", not "the server said something plausible". §2 then points the
//    server at a PRIVATE lock directory (FLEET_SUITE_LOCK, one srv restart) to drive the three
//    states the real lock cannot be made to have on demand without breaking serialization for
//    every other suite on this box: a dead holder, a hand-parked dir, and no lock at all. Touching
//    the real lock to test them would be the one thing this feature must never do. §2b turns the
//    same three states around and tests the WRITER — what e2e-stage.sh says out loud while it
//    blocks, which is the half the land gate's silent 255 s wait went missing in.
//  · The REPORTS carry TWO kinds of row, and the checks keep them apart the way the wire does.
//    §3–§6 test the HEARSAY half (`origin: "lane"`): that the server binds a report to the
//    TOKEN'S slot (never a `slot` field in the body), that a phase CHANGE reaches audit.jsonl
//    while an identical re-post does not, and that a report dies with its lane.
//    §7 tests the MEASURED half (`origin: "server"`, added 2026-08-19): fleet's own two suite
//    runs — the land gate and the tier-2 post-land audit — saying so themselves while they hold
//    the mutex. That half is the one thing this file could NOT say before: on 2026-08-17 a land
//    gate and an audit ran back to back and the surface carried a pid and an empty report list,
//    so "which slot is having which tree verified" needed `ps -o ppid` plus `lsof`.
//
// §1–§6 assert nothing about a suite having run. §7 does the opposite: it MAKES fleet run two
// (against sleeping stand-ins, never a real suite) and reads the surface while they are in flight,
// which is why its preconditions — did the stand-in actually start? — are checks of their own.
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { BASE, REPO, ROOT, TOKEN, check, get, post, readText, restartSrv } from "./harness";
import { exists, openLane, settleForMerge, waitMerge, type MergeVerdict } from "./lane-helpers";

const TMP = process.env.TMPDIR ?? "/tmp";
const REAL_LOCK = process.env.FLEET_SUITE_LOCK ?? "/tmp/fleet-e2e.lock"; // what e2e-stage.sh took
const OWN_LOCK = `${TMP}/fleet-e2e-gatelock-${process.pid}`; // never the real one — see the header

interface GateLock {
  pid: number | null; alive: boolean | null; heldMs: number; ageMs?: number; acquiredAt?: number | null;
  identityProven?: boolean | null; birth?: { stored: string | null; current: string | null; state: string };
  nextAction?: string; reason?: string; effect?: string; state: string;
}
interface GateReport { slot: number | null; label: string | null; phase: string; suite: string;
  exitCode: number | null; at: number; origin?: string; branch?: string | null }
interface Gate { lock: GateLock | null; reports: GateReport[] }

const gateOf = async (): Promise<Gate | null | undefined> =>
  ((await (await get("/api/sessions")).json()) as { gate?: Gate | null }).gate;

// audit.jsonl, both rotation generations, torn lines dropped rather than thrown on (a mid-append
// row would otherwise fail an unrelated check with a JSON parse error)
const auditRows = async (): Promise<{ event?: string; slot?: number; detail?: string }[]> =>
  ((await readText(`${ROOT}/audit.jsonl.1`)) + (await readText(`${ROOT}/audit.jsonl`)))
    .split("\n").filter(Boolean)
    .flatMap((l) => { try { return [JSON.parse(l) as { event?: string }]; } catch { return []; } });
const intentRows = async (slot: number): Promise<string[]> =>
  (await auditRows()).filter((r) => r.event === "verify_intent" && r.slot === slot).map((r) => r.detail ?? "");
// the audit write is fire-and-forget through the server's serializing chain, so the route can
// answer before the line is on disk. Poll for the count we expect; a timeout returns what it last
// saw, so a genuinely missing line fails its own check instead of hiding behind the retry.
async function intentRowsAtLeast(slot: number, n: number): Promise<string[]> {
  let rows = await intentRows(slot);
  for (let i = 0; i < 60 && rows.length < n; i++) {
    await Bun.sleep(50);
    rows = await intentRows(slot);
  }
  return rows;
}

const selfPost = (token: string | undefined, body: unknown): Promise<Response> =>
  fetch(`${BASE}/api/self/verify-intent`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token !== undefined ? { "x-fleet-self-token": token } : {}) },
    body: JSON.stringify(body),
  });
// LC_ALL=C: `ps -o lstart=` is locale-formatted, and every consumer of this string — the fixture
// regex below, e2e-stage.sh#_st_valid_birth, server.ts#PROCESS_BIRTH_RE — requires English
// month/day names. Without it the Debian/de_DE helper yields "Di Sep  1 ...", the fixture fails as
// itself and the family behind it falls closed (measured 2026-09-01;
// docs/messungen/second-host-baseline-2026-08-29.md §Plattform-Signatur).
const processBirthOf = (pid: number): string => {
  const p = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)],
    { encoding: "utf8", env: { ...process.env, LC_ALL: "C" } });
  return p.status === 0 ? p.stdout.trim().replace(/\s+/g, " ") : "";
};
const differentValidBirth = (actual: string): string =>
  actual === "Mon Jan 1 00:00:00 2001" ? "Tue Jan 2 00:00:00 2001" : "Mon Jan 1 00:00:00 2001";

// same race as security.ts's selfTokenOf: openSlot mints the credential and queues saveState
// BEFORE it awaits the pane spawn, so the route can answer a hair before the file carries it
async function selfTokenOf(slot: number): Promise<string> {
  let seen = "";
  for (let i = 0; i < 60; i++) {
    const st = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
      { slots?: Record<string, { selfToken?: string }> };
    seen = st.slots?.[String(slot)]?.selfToken ?? "";
    if (/^[0-9a-f]{32}$/.test(seen)) return seen;
    await Bun.sleep(50);
  }
  return seen;
}

export async function run(): Promise<void> {
  const thisBirth = processBirthOf(process.pid);
  check("fixture: the host exposes a process-birth fingerprint for this harness",
    /^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2} \d{2}:\d{2}:\d{2} \d{4}$/.test(thisBirth), thisBirth);
  // ===== §1 the REAL mutex: does the projection agree with the disk? =====
  // This suite is holding it right now — e2e-stage.sh takes the lock when a wrapper sources it,
  // and records the wrapper's pid. The wrapper is this process's parent (the harness is launched
  // from it with `eval`, which does not fork), so the holder's identity is independently known
  // here and does not have to be taken from the answer under test.
  {
    const g = await gateOf();
    const diskPid = ((): number | null => {
      try {
        const raw = readFileSync(`${REAL_LOCK}/pid`, "utf8").trim();
        return /^\d+$/.test(raw) ? Number(raw) : null;
      } catch { return null; }
    })();
    check("§1 /api/sessions names the same suite-mutex holder the filesystem does",
      !!g && !!g.lock && g.lock.pid === diskPid && diskPid !== null,
      `server=${JSON.stringify(g?.lock)} disk=${diskPid}`);
    check("§1 that holder is this run's own wrapper, and it is reported alive",
      g?.lock?.pid === process.ppid && g.lock.alive === true,
      `lock=${JSON.stringify(g?.lock)} ppid=${process.ppid}`);
    check("§1 the hold duration is a real elapsed time, not a placeholder",
      (g?.lock?.heldMs ?? -1) > 0, String(g?.lock?.heldMs));
    // NARROWED to the lane half on purpose (2026-08-19). The claim this check was written to make
    // is "nobody has volunteered a phase yet"; `reports.length === 0` stopped being that sentence
    // the moment fleet's own runs joined the same list, because a land gate or an audit in flight
    // anywhere on this box would now put a row here — a fact about the machine, not a defect this
    // module can assert away. `origin !== "server"` also covers a pre-2026-08-19 server, which
    // sends no origin at all and whose every row is a lane's.
    check("§1 no lane has volunteered a phase yet, so the gate carries no hearsay row",
      Array.isArray(g?.reports) && g.reports.filter((r) => r.origin !== "server").length === 0,
      JSON.stringify(g?.reports));
  }

  // ===== §2 the lock states, against a PRIVATE lock dir =====
  rmSync(OWN_LOCK, { recursive: true, force: true });
  await restartSrv({ FLEET_SUITE_LOCK: OWN_LOCK });
  {
    check("§2 no lock dir at all → the gate is absent entirely (no shape on the 2s poll)",
      (await gateOf()) == null, JSON.stringify(await gateOf()));

    // a holder that is unquestionably alive: this harness
    mkdirSync(OWN_LOCK, { recursive: true });
    writeFileSync(`${OWN_LOCK}/pid`, `${process.pid}\n`);
    writeFileSync(`${OWN_LOCK}/birth`, `${thisBirth}\n`);
    await Bun.sleep(1100); // so the held-duration assertion below measures something real
    const live = (await gateOf())?.lock;
    check("§2 a live holder is named and reported alive",
      live?.pid === process.pid && live.alive === true, JSON.stringify(live));
    check("§2 a live holder is held only when PID and process-birth identity match",
      live?.identityProven === true && live.birth?.state === "matched" && live.nextAction === "wait"
        && live.reason === `recorded pid ${process.pid} is alive and its process-birth fingerprint matches`
        && live.effect === "a suite is holding the mutex",
      JSON.stringify(live));
    check("§2 the hold duration is measured from the claim, not from the request",
      (live?.heldMs ?? 0) >= 1000, String(live?.heldMs));
    check("§2 acquisition age names its semantics and stays tied to the claim timestamp",
      live?.acquiredAt !== null && live?.acquiredAt !== undefined && (live.ageMs ?? 0) >= 1000
        && Math.abs((live.ageMs ?? -1) - live.heldMs) < 100,
      JSON.stringify(live));
    check("§2 a live holder inside the normal window is `held` — a suite is running",
      live?.state === "held", JSON.stringify(live));

    // OVERDUE: the same live holder, backdated past SUITE_HOLD_OVERDUE_MS. The server reads the
    // claim time off the pid file's mtime, so moving that mtime IS the passage of time here — no
    // sleep, and no threshold constant duplicated into the test. 25 min is past the 20 min cap.
    const backdated = new Date(Date.now() - 25 * 60_000);
    utimesSync(`${OWN_LOCK}/pid`, backdated, backdated);
    const over = (await gateOf())?.lock;
    check("§2 a live holder past the overdue cap is `overdue` — still alive, no longer normal",
      over?.state === "overdue" && over.alive === true && over.pid === process.pid, JSON.stringify(over));
    check("§2 overdue still requires proven PID+birth identity, and its next act is inspection",
      over?.identityProven === true && over.nextAction === "inspect holder"
        && over.reason === `recorded pid ${process.pid} is alive and its process-birth fingerprint matches`,
      JSON.stringify(over));
    check("§2 overdue is the ONLY warning state: it is reached by TIME, on a holder that is alive",
      over?.heldMs !== undefined && over.heldMs > 20 * 60_000, String(over?.heldMs));
    // and back, so the checks below start from an unaged claim
    const nowStamp = new Date();
    utimesSync(`${OWN_LOCK}/pid`, nowStamp, nowStamp);

    writeFileSync(`${OWN_LOCK}/birth`, `${differentValidBirth(thisBirth)}\n`);
    const recycled = (await gateOf())?.lock;
    check("§2 a live recycled PID mismatch is NOT a holder: it is stale and reapable",
      recycled?.pid === process.pid && recycled.alive === true && recycled.identityProven === false
        && recycled.birth?.state === "mismatched" && recycled.state === "stale"
        && recycled.nextAction === "reap on next contender"
        && recycled.reason === `recorded pid ${process.pid} is alive but its process-birth fingerprint differs`
        && recycled.effect === "the live process is not the recorded holder; the next contender may safely reap this lock",
      JSON.stringify(recycled));
    check("§2 recycled-PID classification is read-only on the server: the lock is not reaped by the projection",
      readFileSync(`${OWN_LOCK}/pid`, "utf8").trim() === String(process.pid)
        && readFileSync(`${OWN_LOCK}/birth`, "utf8").trim() === differentValidBirth(thisBirth),
      `${readFileSync(`${OWN_LOCK}/pid`, "utf8").trim()} ${readFileSync(`${OWN_LOCK}/birth`, "utf8").trim()}`);

    rmSync(`${OWN_LOCK}/birth`, { force: true });
    const missingBirth = (await gateOf())?.lock;
    check("§2 a live legacy holder with missing birth identity is UNKNOWN, not held or stale",
      missingBirth?.pid === process.pid && missingBirth.alive === true && missingBirth.identityProven === null
        && missingBirth.birth?.state === "missing" && missingBirth.state === "unknown"
        && missingBirth.nextAction === "inspect or wait"
        && missingBirth.effect === "a possibly live legacy holder is preserved; contenders must not auto-reap it",
      JSON.stringify(missingBirth));
    writeFileSync(`${OWN_LOCK}/birth`, "\n");
    const emptyBirth = (await gateOf())?.lock;
    check("§2 a live holder with empty birth identity is UNKNOWN and is not auto-reapable",
      emptyBirth?.pid === process.pid && emptyBirth.identityProven === null && emptyBirth.birth?.state === "empty"
        && emptyBirth.state === "unknown" && emptyBirth.nextAction === "inspect or wait",
      JSON.stringify(emptyBirth));
    writeFileSync(`${OWN_LOCK}/birth`, "not-a-birth\n");
    const malformedBirth = (await gateOf())?.lock;
    check("§2 a live holder with malformed birth identity is UNKNOWN and is not auto-reapable",
      malformedBirth?.pid === process.pid && malformedBirth.identityProven === null
        && malformedBirth.birth?.state === "malformed" && malformedBirth.state === "unknown"
        && malformedBirth.reason === `recorded pid ${process.pid} is alive, but holder identity is malformed`,
      JSON.stringify(malformedBirth));
    writeFileSync(`${OWN_LOCK}/birth`, `${thisBirth}\n`);

    // a holder that is gone. spawnSync has already reaped this child, so the pid is dead by the
    // time it is written — asserted here rather than assumed, because a recycled pid would turn
    // this into a check about a live process without saying so.
    const gone = spawnSync("/bin/sh", ["-c", "exit 0"]).pid ?? 0;
    let goneIsDead = false;
    try { process.kill(gone, 0); } catch { goneIsDead = true; }
    check("§2 fixture: a pid that is genuinely no longer running", goneIsDead && gone > 0, String(gone));
    writeFileSync(`${OWN_LOCK}/pid`, `${gone}\n`);
    writeFileSync(`${OWN_LOCK}/birth`, `${differentValidBirth(thisBirth)}\n`);
    const dead = (await gateOf())?.lock;
    check("§2 a dead holder is named AND flagged dead — the next suite reaps this dir",
      dead?.pid === gone && dead.alive === false, JSON.stringify(dead));
    // THE RESTING STATE OF AN IDLE MACHINE, and the reason this state exists: release is implicit
    // (e2e-stage.sh:38), so every finished suite leaves this behind. Measured 2026-08-04: 18 min
    // of it on a quiet machine. It must never be the same class as `overdue`, which is a fault.
    check("§2 a dead holder is `stale`, NOT a warning — nothing is running and nothing is wrong",
      dead?.state === "stale" && dead.nextAction === "reap on next contender"
        && dead.reason === `recorded pid ${gone} is gone`
        && dead.effect === "the next contender removes this stale lock before acquiring",
      JSON.stringify(dead));

    // pid 0 addresses the caller's own process group, so a naive liveness probe answers "alive"
    // about the server itself and reports a lock nobody holds as held
    writeFileSync(`${OWN_LOCK}/pid`, "0\n");
    rmSync(`${OWN_LOCK}/birth`, { force: true });
    const zero = (await gateOf())?.lock;
    check("§2 a pid file containing 0 is unreadable content, never a live holder",
      zero?.pid === null && zero.alive === false, JSON.stringify(zero));
    writeFileSync(`${OWN_LOCK}/pid`, "not-a-pid\n");
    const junk = (await gateOf())?.lock;
    check("§2 a garbage pid file reads as a lost holder, not as a hand-parked lock",
      junk?.pid === null && junk.alive === false, JSON.stringify(junk));
    check("§2 an unreadable pid file is `stale` too — same meaning, and never a park",
      zero?.state === "stale" && junk?.state === "stale",
      `zero=${JSON.stringify(zero)} junk=${JSON.stringify(junk)}`);

    rmSync(`${OWN_LOCK}/pid`, { force: true });
    writeFileSync(`${OWN_LOCK}/birth`, `${thisBirth}\n`);
    const torn = (await gateOf())?.lock;
    check("§2 a birth-only lock is a torn acquisition: stale and reapable, not a manual park",
      torn?.pid === null && torn.alive === false && torn.identityProven === false
        && torn.birth?.state === "matched" && torn.state === "stale"
        && torn.nextAction === "reap on next contender"
        && torn.reason === "the lock dir carries a process-birth fingerprint but no pid"
        && torn.effect === "the next contender removes this torn acquisition before acquiring",
      JSON.stringify(torn));

    // a pid-LESS dir is a human parking the machine, and e2e-stage.sh never reaps one — it must
    // therefore never be reported with the same `alive: false` that means "reapable"
    rmSync(`${OWN_LOCK}/pid`, { force: true });
    rmSync(`${OWN_LOCK}/birth`, { force: true });
    const parked = (await gateOf())?.lock;
    check("§2 a pid-less lock dir is a manual park: no pid, and liveness is UNKNOWN, not false",
      parked?.pid === null && parked.alive === null, JSON.stringify(parked));
    check("§2 a hand-parked lock is `parked`, told apart from `stale` — nothing ever reaps it",
      parked?.state === "parked", JSON.stringify(parked));

    // THE REPORTING PATH only ever READS. Since M5 (2026-09-07) the server does reap — but in
    // exactly one function, `holdSuiteLock`, i.e. only while a land gate is asking for the machine,
    // and by e2e-stage.sh's own triage (docs/suite-contention.md §7c). Nothing on the
    // /api/sessions path may touch this dir: a poll that reaped would remove a lock while nobody
    // was contending for it, which is neither the wrapper's contract nor the server's.
    // Every state above was left in place by a REPORT, and the deliberately stale ones survived it.
    check("§2 the reporting path never removed the lock it was reporting on — the reap lives in holdSuiteLock alone",
      ((): boolean => { try { return statSync(OWN_LOCK).isDirectory(); } catch { return false; } })());

    rmSync(OWN_LOCK, { recursive: true, force: true });
    check("§2 the lock going away is visible on the next poll",
      (await gateOf()) == null, JSON.stringify(await gateOf()));
  }

  // ===== §2b the WRITER's side: what e2e-stage.sh says while it blocks =====
  // §2 tests the server READING the lock. This tests the wrapper TAKING it, because the silence
  // on that side is what the land gate paid for on 2026-08-06: FLEET_VERIFY_TIMEOUT_MS is a
  // wall-clock budget, several steps of the gate chain must take this mutex first, and the loop
  // that waits printed nothing at all. The expired `verify.out` therefore ended after somebody
  // else's ALL PASS with no hint that ~255 s of its 300 s went into queueing.
  // Driven against a PRIVATE lock dir and by sourcing the script directly — the real mutex is held
  // by this very run, so contending for it here would deadlock the suite against itself.
  // The three states must be told apart in WORDS, not merely reported: `held` resolves on its own,
  // `stale` resolves this instant, and `parked` never resolves at all, and a waiter that cannot
  // tell them apart cannot decide whether to keep waiting.
  {
    const SRC = ((): string => {
      try { return dirname(readlinkSync(`${ROOT}/node_modules`)); } catch { return ROOT; }
    })();
    const STAGE = `${SRC}/e2e-stage.sh`;
    const PROBE = `${TMP}/fleet-e2e-stagelock-${process.pid}`;
    // sourcing the stage script IS taking the lock (that is the whole design), so a probe that
    // must block is killed rather than waited out: the first line is printed before the loop's
    // first `sleep 15`, which is precisely the property under test.
    // Captured into FILES, read once the shell has exited. With pipes the read waited for EOF, and
    // the killed shell's `sleep $FLEET_SUITE_POLL_SEC` child — orphaned, still holding the write
    // end — kept it open for the rest of its 15 s: every blocking probe cost ~15.2 s for a line
    // printed in milliseconds (trail isolated-20260913T155454Z-52907). The poll stays at its real
    // 15 s on purpose; the kill still lands long before the first sleep ends, so "speaks before
    // the first sleep" is measured exactly as before.
    let sayN = 0;
    const stageSay = async (killAfterMs: number, extra: Record<string, string> = {}): Promise<string> => {
      const base = `${PROBE}.say${sayN++}`;
      const p = Bun.spawn(["sh", "-c", `. "${STAGE}"`],
        { cwd: SRC, env: { ...process.env, FLEET_SUITE_LOCK: PROBE, ...extra },
          stdout: Bun.file(`${base}.out`), stderr: Bun.file(`${base}.err`) });
      const t = killAfterMs > 0 ? setTimeout(() => { try { p.kill(); } catch { /* already gone */ } }, killAfterMs) : null;
      await p.exited;
      if (t) clearTimeout(t);
      const read = (f: string): string => { try { return readFileSync(f, "utf8"); } catch { return ""; } };
      const out = `${read(`${base}.out`)}${read(`${base}.err`)}`;
      rmSync(`${base}.out`, { force: true });
      rmSync(`${base}.err`, { force: true });
      return out;
    };
    check("§2b fixture: the stage script is reachable from inside the instance (node_modules → source tree)",
      existsSync(STAGE), STAGE);

    // FREE: nothing to wait for. The acquire line is emitted ANYWAY, and that is load-bearing —
    // runVerify's SUITE_LOCK_RE counts these lines, so "no line" has to mean "this command does
    // not report its waits" and never "it waited zero".
    rmSync(PROBE, { recursive: true, force: true });
    const free = await stageSay(0);
    // `[01]s`, not `0s`: the script times itself with `date +%s`, so a one-second granularity can
    // report 1 for a millisecond of work whenever the two reads straddle a boundary. Asserting the
    // exact 0 would buy nothing and cost a rare, unreproducible red.
    check("§2b an uncontended lock still announces itself — an acquire line even at ~0s, so absence means 'does not report'",
      /^\[suite-lock\][^\n]* acquired after [01]s \(pid \d+\)$/m.test(free), JSON.stringify(free.slice(0, 400)));
    check("§2b an uncontended acquire says nothing about waiting",
      !free.includes("waiting"), JSON.stringify(free.slice(0, 400)));

    // HELD: a live holder. The line must name it, so "which suite is in front of me" is answered
    // by the log rather than by a `ps` nobody runs after the fact.
    rmSync(PROBE, { recursive: true, force: true });
    mkdirSync(PROBE, { recursive: true });
    writeFileSync(`${PROBE}/pid`, `${process.pid}\n`);
    writeFileSync(`${PROBE}/birth`, `${thisBirth}\n`);
    const held = await stageSay(2500);
    check("§2b blocking on a LIVE holder speaks immediately, naming the pid it is waiting for",
      /^\[suite-lock\][^\n]* waiting [01]s for [^\n]* — held by live pid \d+ with proven identity \(up /m.test(held)
        && held.includes(`held by live pid ${process.pid} with proven identity `), JSON.stringify(held.slice(0, 400)));
    check("§2b it never claims to have acquired a lock it is still waiting for",
      !/ acquired after /.test(held), JSON.stringify(held.slice(0, 400)));
    check("§2b the blocked probe left the holder's pid file untouched",
      readFileSync(`${PROBE}/pid`, "utf8").trim() === String(process.pid), readFileSync(`${PROBE}/pid`, "utf8").trim());
    check("§2b the blocked probe left the holder's birth fingerprint untouched",
      readFileSync(`${PROBE}/birth`, "utf8").trim() === thisBirth, readFileSync(`${PROBE}/birth`, "utf8").trim());

    // HELD BY THE FLEET SERVER (2026-09-14): a lane killed the pid it read from this lock and it
    // was the live server. With server.ts#suiteLockTryTake's marker naming the holder, the line
    // says so verbatim — and still names the proven identity, and still does not reap.
    writeFileSync(`${PROBE}/held-by-fleet-server`, `${process.pid}\n`);
    const serverSay = await stageSay(2500);
    check("§2b a live holder the server marker names is called the fleet server, verbatim, with its pid",
      serverSay.includes(`— held by the fleet server itself — never kill this pid ${process.pid};`)
        && serverSay.includes(`held by live pid ${process.pid} with proven identity `)
        && !/ acquired after /.test(serverSay), JSON.stringify(serverSay.slice(0, 500)));
    check("§2b the blocked probe left the server's hold untouched — pid, birth and marker",
      readFileSync(`${PROBE}/pid`, "utf8").trim() === String(process.pid)
        && readFileSync(`${PROBE}/birth`, "utf8").trim() === thisBirth
        && readFileSync(`${PROBE}/held-by-fleet-server`, "utf8").trim() === String(process.pid),
      readdirSync(PROBE).join(","));

    // the marker stays for the recycled case: the birth changed, so the live process is NOT the
    // server that wrote it — no server wording, and the reap must still get through a dir that
    // holds three files, not two
    writeFileSync(`${PROBE}/birth`, `${differentValidBirth(thisBirth)}\n`);
    const recycledSay = await stageSay(5000);
    check("§2b a recycled pid under a stale server marker is not called the fleet server, and the marker is reaped with the lock",
      !recycledSay.includes("held by the fleet server itself") && !existsSync(`${PROBE}/held-by-fleet-server`),
      JSON.stringify(recycledSay.slice(0, 400)));
    check("§2b a live recycled PID is called stale because its birth fingerprint changed",
      new RegExp(`waiting [01]s for [^\\n]* — stale — recorded pid ${process.pid} is alive but its process-birth fingerprint changed`).test(recycledSay)
        && !recycledSay.includes("held by live pid"), JSON.stringify(recycledSay.slice(0, 400)));
    check("§2b the recycled-PID lock is reaped and acquired without touching the live process",
      / acquired after \d+s \(pid \d+\)$/m.test(recycledSay)
        && readFileSync(`${PROBE}/pid`, "utf8").trim() !== String(process.pid)
        && processBirthOf(process.pid) === thisBirth,
      JSON.stringify(recycledSay.slice(0, 400)));

    writeFileSync(`${PROBE}/birth`, `${thisBirth}\n`);
    rmSync(`${PROBE}/pid`, { force: true });
    const tornSay = await stageSay(5000);
    check("§2b a birth-only torn acquisition is called stale, not parked",
      /waiting [01]s for [^\n]* — stale — lock has a process-birth fingerprint but NO pid/.test(tornSay)
        && !tornSay.includes("parked") && !tornSay.includes("held by live pid"),
      JSON.stringify(tornSay.slice(0, 400)));
    check("§2b the torn acquisition is reaped and the lock actually taken",
      / acquired after \d+s \(pid \d+\)$/m.test(tornSay) && readFileSync(`${PROBE}/pid`, "utf8").trim() !== "",
      JSON.stringify(tornSay.slice(0, 400)));

    // PARKED: a pid-LESS dir. Nothing reaps it, ever — the one state where "keep waiting" is the
    // wrong answer, so the line has to say so instead of looking like a busy machine.
    rmSync(`${PROBE}/pid`, { force: true });
    rmSync(`${PROBE}/birth`, { force: true });
    const parkedSay = await stageSay(2500);
    check("§2b a hand-parked (pid-less) dir is called parked, and says nothing will ever reap it",
      /waiting [01]s for [^\n]* — parked — the dir carries NO pid file/.test(parkedSay)
        && parkedSay.includes("rmdir it to release"), JSON.stringify(parkedSay.slice(0, 400)));
    check("§2b parked is NOT reported as a live holder — a waiter must not read it as 'soon'",
      !parkedSay.includes("held by live pid"), JSON.stringify(parkedSay.slice(0, 400)));

    // STALE: a dead holder. Distinct words again, and it must actually reap and take the lock —
    // the vocabulary is worthless if the third state is only ever described and never resolved.
    rmSync(PROBE, { recursive: true, force: true });
    mkdirSync(PROBE, { recursive: true });
    writeFileSync(`${PROBE}/pid`, `${process.pid}\n`);
    const missingSay = await stageSay(2500);
    check("§2b a live legacy holder with missing birth identity is called unknown and is not reaped",
      /waiting [01]s for [^\n]* — unknown — recorded pid \d+ is alive, but the lock has no process-birth fingerprint/.test(missingSay)
        && !/ acquired after /.test(missingSay)
        && readFileSync(`${PROBE}/pid`, "utf8").trim() === String(process.pid),
      JSON.stringify(missingSay.slice(0, 400)));

    rmSync(PROBE, { recursive: true, force: true });
    mkdirSync(PROBE, { recursive: true });
    const goneP = spawnSync("/bin/sh", ["-c", "exit 0"]).pid ?? 0;
    let deadNow = false;
    try { process.kill(goneP, 0); } catch { deadNow = true; }
    check("§2b fixture: a pid that is genuinely no longer running", deadNow && goneP > 0, String(goneP));
    writeFileSync(`${PROBE}/pid`, `${goneP}\n`);
    writeFileSync(`${PROBE}/birth`, `${differentValidBirth(thisBirth)}\n`);
    const stale = await stageSay(5000);
    check("§2b a dead holder is called stale, distinctly from parked and from held",
      new RegExp(`waiting [01]s for [^\\n]* — stale — recorded pid ${goneP} is gone`).test(stale)
        && !stale.includes("parked") && !stale.includes("held by live pid"), JSON.stringify(stale.slice(0, 400)));
    check("§2b the stale holder is reaped and the lock actually taken (the state resolves, it is not just named)",
      / acquired after \d+s \(pid \d+\)$/m.test(stale) && readFileSync(`${PROBE}/pid`, "utf8").trim() !== String(goneP),
      JSON.stringify(stale.slice(0, 400)));
    // ===== §2c AN INHERITED HOLD: running INSIDE somebody else's lock =====
    // The land gate's ff retry chain runs the gate several times in a row, and between rounds the
    // machine must not be given away — so since 2026-09-04 server.ts takes this mutex ITSELF and
    // tells the gate child it already holds it (FLEET_SUITE_LOCK_HELD_BY). The step then does not
    // queue, does not write pid/birth, and releases nothing.
    // The variable ALONE may never be enough, and that is what the two controls are for: a stale
    // export, or one naming a holder that has died, must put the step straight back in the queue.
    // Otherwise a leftover environment entry would silently let two suites run at once on a box
    // whose whole serialization rests on this dir.
    rmSync(PROBE, { recursive: true, force: true });
    mkdirSync(PROBE, { recursive: true });
    writeFileSync(`${PROBE}/pid`, `${process.pid}\n`);
    writeFileSync(`${PROBE}/birth`, `${thisBirth}\n`);
    const inherited = await stageSay(5000, { FLEET_SUITE_LOCK_HELD_BY: String(process.pid) });
    check("§2c a step told it runs inside a LIVE holder's lock does not queue at all — it reports the existing hold in the one acquire format, naming the holder",
      new RegExp(`^\\[suite-lock\\][^\\n]* acquired after [01]s \\(pid ${process.pid}\\)$`, "m").test(inherited)
        && !inherited.includes("waiting"), JSON.stringify(inherited.slice(0, 400)));
    check("§2c the inherited step takes nothing over: the holder's own pid and birth files are untouched",
      readFileSync(`${PROBE}/pid`, "utf8").trim() === String(process.pid)
        && readFileSync(`${PROBE}/birth`, "utf8").trim() === thisBirth,
      JSON.stringify({ pid: readFileSync(`${PROBE}/pid`, "utf8").trim(),
        birth: readFileSync(`${PROBE}/birth`, "utf8").trim() }));

    // CONTROL A: the variable names somebody, but not the process this lock records. The lock file
    // has the last word, so this is an ordinary contender and must block.
    const strangerSay = await stageSay(2500, { FLEET_SUITE_LOCK_HELD_BY: String(process.ppid) });
    check("§2c an inheritance claim that does NOT match the lock's own pid file grants nothing — the step queues like any other",
      /waiting [01]s for [^\n]* — held by live pid \d+ with proven identity \(up /.test(strangerSay)
        && !/ acquired after /.test(strangerSay)
        && readFileSync(`${PROBE}/pid`, "utf8").trim() === String(process.pid),
      JSON.stringify(strangerSay.slice(0, 400)));

    // CONTROL B: the variable matches the recorded pid — but that process is gone. An inherited
    // hold from a dead holder is no hold, so this must fall through to the ordinary reap and take
    // the lock for itself. This is also the shape a crashed land-gate holder leaves behind.
    rmSync(PROBE, { recursive: true, force: true });
    mkdirSync(PROBE, { recursive: true });
    const goneHolder = spawnSync("/bin/sh", ["-c", "exit 0"]).pid ?? 0;
    let holderDead = false;
    try { process.kill(goneHolder, 0); } catch { holderDead = true; }
    writeFileSync(`${PROBE}/pid`, `${goneHolder}\n`);
    writeFileSync(`${PROBE}/birth`, `${differentValidBirth(thisBirth)}\n`);
    const deadHolderSay = await stageSay(5000, { FLEET_SUITE_LOCK_HELD_BY: String(goneHolder) });
    check("§2c an inheritance claim naming a DEAD holder is no hold: the step reaps the lock and takes it under its own pid",
      holderDead && goneHolder > 0
        && new RegExp(`stale — recorded pid ${goneHolder} is gone`).test(deadHolderSay)
        && / acquired after \d+s \(pid \d+\)$/m.test(deadHolderSay)
        && readFileSync(`${PROBE}/pid`, "utf8").trim() !== String(goneHolder),
      JSON.stringify({ gone: goneHolder, dead: holderDead, say: deadHolderSay.slice(0, 400) }));

    rmSync(PROBE, { recursive: true, force: true });
  }

  // ===== §2c the ORDER of the wait: a QUEUE, not a race =====
  // §2b proved the waiter SAYS the right thing. This proves it gets its turn in the right ORDER,
  // which until 2026-09-05 it did not: the loop was `sleep 15` + retry `mkdir`, so waiting longer
  // bought nothing at all. Measured on the live box 2026-09-04/05 — slot 7's
  // ./e2e-postland-audit.sh waited 2h45m and lost THREE races to contenders that arrived after it,
  // one of them 56 minutes old. The cost lands on the wrong side: runVerify moves a LAND's clock
  // between two budgets on exactly this stdout, so a land gate pays for a preview run's luck.
  //
  // THE DISCRIMINATOR, and the reason this is a proof rather than a coin flip: the three contenders
  // are given DELIBERATELY INVERTED poll intervals — the FIRST to arrive polls slowest (6s) and the
  // LAST polls fastest (1s). Under the old free-for-all the fastest poller reliably wins the moment
  // the lock frees, so a race produces c·b·a. Only an arrival-ordered handover produces a·b·c, and
  // a single green run therefore means something. (Without that inversion, three contenders passing
  // once is 1-in-6 luck.)
  {
    const SRC = ((): string => {
      try { return dirname(readlinkSync(`${ROOT}/node_modules`)); } catch { return ROOT; }
    })();
    const STAGE = `${SRC}/e2e-stage.sh`;
    const LOCK = `${TMP}/fleet-e2e-fifo-${process.pid}`;      // never the real mutex — see the header
    const QUEUE = `${LOCK}.q`;                                 // derived BY THE SCRIPT from the lock path
    const ORDER = `${TMP}/fleet-e2e-fifo-order-${process.pid}`;
    const alive: { kill: () => void }[] = [];
    const tickets = (): string[] => {
      try { return readdirSync(QUEUE).filter((x) => /^t\d+\.\d+$/.test(x)).sort(); } catch { return []; }
    };
    // A contender: source the stage script (which IS taking the lock) and, on acquisition, record
    // its own name. It then exits, and that exit is the release — implicit, exactly as in production.
    const contend = (name: string, pollSec: number, extra: Record<string, string> = {}): { proc: ReturnType<typeof Bun.spawn>; out: () => Promise<string> } => {
      const p = Bun.spawn(["sh", "-c", `. "${STAGE}"; printf '%s\\n' "$FIFO_NAME" >> "${ORDER}"`], {
        cwd: SRC,
        env: { ...process.env, FLEET_SUITE_LOCK: LOCK, FLEET_SUITE_POLL_SEC: String(pollSec), FIFO_NAME: name, ...extra },
        stdout: "pipe", stderr: "pipe",
      });
      alive.push({ kill: () => { try { p.kill(9); } catch { /* already gone */ } } });
      return { proc: p, out: async () => `${await new Response(p.stdout).text()}${await new Response(p.stderr).text()}` };
    };
    // arrival is recorded when the TICKET appears, so the order the test sets up is a fact on disk
    // rather than a sleep somebody tuned. A contender that never takes one fails its own check below.
    const awaitTickets = async (n: number, ms: number): Promise<number> => {
      for (let i = 0; i < ms / 50 && tickets().length < n; i++) await Bun.sleep(50);
      return tickets().length;
    };
    const orderLines = (): string[] => {
      try { return readFileSync(ORDER, "utf8").split("\n").filter(Boolean); } catch { return []; }
    };
    const awaitOrder = async (n: number, ms: number): Promise<string[]> => {
      for (let i = 0; i < ms / 100 && orderLines().length < n; i++) await Bun.sleep(100);
      return orderLines();
    };

    rmSync(LOCK, { recursive: true, force: true });
    rmSync(QUEUE, { recursive: true, force: true });
    rmSync(ORDER, { force: true });
    // a LIVE holder with proven identity: nothing may be reaped, so every contender must queue
    mkdirSync(LOCK, { recursive: true });
    writeFileSync(`${LOCK}/pid`, `${process.pid}\n`);
    writeFileSync(`${LOCK}/birth`, `${thisBirth}\n`);

    const a = contend("a", 6), aT = await awaitTickets(1, 15_000);
    const b = contend("b", 3), bT = await awaitTickets(2, 15_000);
    const c = contend("c", 1), cT = await awaitTickets(3, 15_000);
    check("§2c fixture: three contenders arrive in a known order and each takes a queue ticket",
      aT === 1 && bT === 2 && cT === 3, `tickets after each arrival: ${aT}/${bT}/${cT} — ${JSON.stringify(tickets())}`);
    check("§2c ticket numbers are issued in arrival order, and reset to 1 on an empty queue",
      tickets().map((t) => t.split(".")[0]).join(",") === "t1,t2,t3", JSON.stringify(tickets()));
    check("§2c a queued contender does not touch the lock it is not the front of",
      readFileSync(`${LOCK}/pid`, "utf8").trim() === String(process.pid)
        && readFileSync(`${LOCK}/birth`, "utf8").trim() === thisBirth,
      readFileSync(`${LOCK}/pid`, "utf8").trim());

    // RELEASE. The holder here is this very process, which cannot die, so the release is the dir
    // going away — the same fact the reap produces for a dead holder.
    rmSync(LOCK, { recursive: true, force: true });
    // 6s+3s+1s of polling plus slack; a race would finish this far sooner and in the wrong order
    const order = await awaitOrder(3, 60_000);
    check("§2c the mutex is handed over in ARRIVAL order, not to whoever polls fastest",
      order.join(",") === "a,b,c",
      `${JSON.stringify(order)} (a race hands it to the 1s poller first: c,b,a)`);
    check("§2c waiting time no longer depends on arrival position: the FIRST to arrive is served first, though it polls slowest",
      order[0] === "a", JSON.stringify(order));

    const [aOut, bOut, cOut] = await Promise.all([a.out(), b.out(), c.out()]);
    await Promise.all([a.proc.exited, b.proc.exited, c.proc.exited]);
    // The position is the half of the wait line a later wrapper-budget cut has to build on: elapsed
    // seconds alone cannot say whether waiting more is worth anything.
    check("§2c each waiter names its OWN position in the queue, alongside the elapsed seconds",
      /waiting \d+s for [^\n]* — position 1 of 1 — /.test(aOut)
        && /waiting \d+s for [^\n]* — position 2 of 2 — /.test(bOut)
        && /waiting \d+s for [^\n]* — position 3 of 3 — /.test(cOut),
      JSON.stringify([aOut.split("\n")[0], bOut.split("\n")[0], cOut.split("\n")[0]]));
    check("§2c every contender still ends with the acquire line runVerify sums, and none claimed it early",
      [aOut, bOut, cOut].every((o) => / acquired after \d+s \(pid \d+\)$/m.test(o)),
      JSON.stringify([aOut.slice(-120), bOut.slice(-120), cOut.slice(-120)]));
    check("§2c the queue empties itself: every ticket is gone once the last contender has been served",
      tickets().length === 0, JSON.stringify(tickets()));

    // --- THE MUTEX-FREE WINDOW has its own sentence, and it needs its own fixture. The run above
    // passes through it in well under a second, and the 60s heartbeat throttle means no waiter gets
    // to print inside it — so the branch is staged directly: a LIVE ticket ahead, and NO lock at
    // all. It is the case where waiting is least intuitive (the mutex is free and I still may not
    // take it) and the one where reading the absent dir would classify it `parked` — the single
    // state that never resolves, which a waiter reasonably reads as "stop expecting a turn".
    rmSync(LOCK, { recursive: true, force: true });
    rmSync(ORDER, { force: true });
    const ahead = Bun.spawn(["sleep", "30"], { stdout: "ignore", stderr: "ignore" });
    alive.push({ kill: () => { try { ahead.kill(9); } catch { /* already gone */ } } });
    mkdirSync(`${QUEUE}/t1.${ahead.pid}`, { recursive: true });
    writeFileSync(`${QUEUE}/t1.${ahead.pid}/birth`, `${processBirthOf(ahead.pid)}\n`);
    const q = contend("q", 1);
    const qT = await awaitTickets(2, 15_000);
    check("§2c fixture: a live ticket is ahead of the contender, and the mutex itself is free",
      qT === 2 && !existsSync(LOCK), `${qT} ticket(s), lock exists=${existsSync(LOCK)}`);
    await Bun.sleep(2000);
    q.proc.kill(9);
    const qOut = await q.out();
    await q.proc.exited;
    check("§2c a free mutex is NOT taken out of turn: an older live ticket holds the contender back",
      !/ acquired after /.test(qOut) && !existsSync(LOCK) && orderLines().length === 0,
      JSON.stringify([qOut.split("\n")[0], `lock=${existsSync(LOCK)}`, orderLines().join(",")]));
    check("§2c and it says so in its own words, instead of misreading the absent dir as a manual park",
      /position 2 of 2 — queued — the mutex is FREE/.test(qOut) && !qOut.includes("parked"),
      JSON.stringify(qOut.split("\n").filter(Boolean).slice(0, 2)));
    ahead.kill(9);
    await ahead.exited;
    rmSync(QUEUE, { recursive: true, force: true });

    // --- AND A WAITER THAT DIES BLOCKS NOBODY. The ticket inherits the lock's own orphan rule
    // (property (2) of the mutex: a dead holder is reaped, a hand-parked one never is), because a
    // fairness queue whose corpses hold places is a worse starvation than the race it replaced.
    rmSync(ORDER, { force: true });
    mkdirSync(LOCK, { recursive: true });
    writeFileSync(`${LOCK}/pid`, `${process.pid}\n`);
    writeFileSync(`${LOCK}/birth`, `${thisBirth}\n`);
    const d = contend("d", 1), dT = await awaitTickets(1, 15_000);
    const e = contend("e", 1), eT = await awaitTickets(2, 15_000);
    check("§2c fixture: a front waiter and one behind it, in that order",
      dT === 1 && eT === 2, `${dT}/${eT} — ${JSON.stringify(tickets())}`);
    const dTicket = tickets()[0] ?? "";
    d.proc.kill(9);
    await d.proc.exited;
    rmSync(LOCK, { recursive: true, force: true });
    const after = await awaitOrder(1, 30_000);
    check("§2c a waiter killed mid-queue does not block the contenders behind it",
      after.join(",") === "e", `${JSON.stringify(after)} (front waiter ${dTicket} was killed while holding position 1)`);
    check("§2c the dead waiter's ticket is reaped, exactly as a dead lock holder is",
      dTicket !== "" && !tickets().includes(dTicket), `${dTicket} vs ${JSON.stringify(tickets())}`);
    await e.proc.exited;

    // --- AND AN INHERITED STEP IS NEVER ENQUEUED. This is where the two 2026-09 changes meet, and
    // getting it wrong is a SILENT deadlock rather than a red check: server.ts's ff retry chain
    // holds this mutex itself and hands its name to the gate child, so a step that queued would
    // wait in line behind the very lock it is already running inside — forever, printing positions.
    // The lock on disk still has the last word (a stale export grants nothing), which is why the
    // fixture puts a REAL live pid in the pid file and names that same pid in the variable.
    rmSync(ORDER, { force: true });
    rmSync(QUEUE, { recursive: true, force: true });
    const holder = Bun.spawn(["sleep", "30"], { stdout: "ignore", stderr: "ignore" });
    alive.push({ kill: () => { try { holder.kill(9); } catch { /* already gone */ } } });
    mkdirSync(LOCK, { recursive: true });
    writeFileSync(`${LOCK}/pid`, `${holder.pid}\n`);
    writeFileSync(`${LOCK}/birth`, `${processBirthOf(holder.pid)}\n`);
    const inh = contend("inherited", 1, { FLEET_SUITE_LOCK_HELD_BY: String(holder.pid) });
    await inh.proc.exited;
    const inhOut = await inh.out();
    check("§2c a step inside an inherited hold takes NO ticket — it would otherwise queue behind the lock it already holds",
      tickets().length === 0 && !/position \d+ of \d+/.test(inhOut),
      JSON.stringify([tickets(), inhOut.split("\n")[0]]));
    check("§2c it proceeds at once and reports in the ONE acquire format, naming the pid that actually holds the lock",
      inhOut.includes(`acquired after 0s (pid ${holder.pid})`)
        && /^\[suite-lock\] [^\n]* acquired after 0s \(pid \d+\)$/m.test(inhOut)
        && orderLines().join(",") === "inherited",
      JSON.stringify([inhOut.split("\n").filter(Boolean).slice(-1)[0], orderLines()]));
    check("§2c and it released nothing: the hold it ran inside is still recorded, untouched",
      readFileSync(`${LOCK}/pid`, "utf8").trim() === String(holder.pid),
      readFileSync(`${LOCK}/pid`, "utf8").trim());
    holder.kill(9);
    await holder.exited;

    for (const p of alive) p.kill();
    rmSync(LOCK, { recursive: true, force: true });
    rmSync(QUEUE, { recursive: true, force: true });
    rmSync(ORDER, { force: true });
  }
  // back to the real lock for everything below — and back to the env every later module expects
  await restartSrv();
  check("§2 the default lock path is restored: the real mutex is visible again",
    (await gateOf())?.lock?.pid === process.ppid, JSON.stringify((await gateOf())?.lock));

  // ===== §3 POST /api/self/verify-intent: who may report =====
  if (!REPO) {
    check("§3 SKIPPED: no FLEET_E2E_REPO, so no lane exists to report from", false, "run via ./e2e-isolated.sh");
    return;
  }
  const lane = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  const laneTok = await selfTokenOf(lane.slot);
  check("§3 fixture: a lane with a readable self token", /^[0-9a-f]{32}$/.test(laneTok), `slot ${lane.slot}`);

  check("§3 a missing self-token header is rejected",
    (await selfPost(undefined, { phase: "running", suite: "isolated" })).status === 401);
  check("§3 an unknown self token is rejected",
    (await selfPost("0".repeat(32), { phase: "running", suite: "isolated" })).status === 401);
  check("§3 the owner token does not substitute for a self token on this route",
    (await selfPost(TOKEN, { phase: "running", suite: "isolated" })).status === 401);

  // a plain session's credential is a valid credential with the wrong scope — the same 409 the
  // drift route draws, and for the same reason: this family answers FOR A LANE
  const free = ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
    .slots.find((s) => !s.cwd)?.id ?? 0;
  check("§3 fixture: an idle slot is available to open a non-lane session in", free > 0, String(free));
  await post(`/api/slots/${free}/open`, { cwd: "~" });
  const plainTok = await selfTokenOf(free);
  const plain = await selfPost(plainTok, { phase: "running", suite: "isolated" });
  check("§3 a non-lane session's self token is recognized but out of scope (409, not a generic 401)",
    plain.status === 409, `${plain.status} ${await plain.text()}`);

  // ===== §4 what a report must look like =====
  for (const [why, body] of [
    ["an unknown phase", { phase: "nearly-done", suite: "isolated" }],
    ["a missing phase", { suite: "isolated" }],
    ["a missing suite", { phase: "running" }],
    ["an empty suite label", { phase: "running", suite: "   " }],
    ["a suite label with a newline in it", { phase: "running", suite: "isolated\nrm -rf" }],
    ["a suite label past the length cap", { phase: "running", suite: "s".repeat(61) }],
    // the exitCode guard had no check: `Number("abc") | 0` is 0, so a coerced answer would report
    // "exit 0" — SUCCESS — for a code it could not read. Refusing is the only safe direction on a
    // surface whose whole job is to say what a dead run was doing.
    ["a non-numeric exitCode", { phase: "failed", suite: "isolated", exitCode: "abc" }],
    ["a fractional exitCode", { phase: "failed", suite: "isolated", exitCode: 1.5 }],
  ] as [string, unknown][])
    check(`§4 ${why} is rejected at the boundary (400)`, (await selfPost(laneTok, body)).status === 400, why);

  // ===== §5 the report reaches the board, bound to the TOKEN's slot =====
  const r1 = await selfPost(laneTok, { phase: "waiting", suite: "isolated", slot: free });
  const j1 = (await r1.json()) as { ok?: boolean; logged?: boolean };
  check("§5 a well-formed report is accepted and logged as a change", r1.ok && j1.logged === true, JSON.stringify(j1));
  {
    const g = await gateOf();
    const row = g?.reports.find((x) => x.slot === lane.slot);
    check("§5 the report is projected on /api/sessions for the token's own slot",
      row?.phase === "waiting" && row.suite === "isolated", JSON.stringify(g?.reports));
    check("§5 a spoofed `slot` field in the body is ignored — no report lands on the named slot",
      !g?.reports.some((x) => x.slot === free), JSON.stringify(g?.reports));
    check("§5 the phase change is on audit.jsonl, naming the suite and the phase",
      (await intentRowsAtLeast(lane.slot, 1)).includes("isolated:waiting"),
      JSON.stringify(await intentRows(lane.slot)));
  }

  // an identical re-post is a heartbeat, not an event: it must not push real events out of the
  // log's rotation window
  const rDup = await selfPost(laneTok, { phase: "waiting", suite: "isolated" });
  check("§5 an identical re-post is accepted but writes NO second audit line",
    ((await rDup.json()) as { logged?: boolean }).logged === false
      && (await intentRows(lane.slot)).filter((d) => d === "isolated:waiting").length === 1,
    JSON.stringify(await intentRows(lane.slot)));

  const rRun = await selfPost(laneTok, { phase: "running", suite: "isolated" });
  check("§5 a phase change is logged again", ((await rRun.json()) as { logged?: boolean }).logged === true);
  await selfPost(laneTok, { phase: "failed", suite: "isolated", exitCode: 144 });
  {
    const row = (await gateOf())?.reports.find((x) => x.slot === lane.slot);
    check("§5 the newest phase wins, and a failure carries its exit code",
      row?.phase === "failed" && row.exitCode === 144, JSON.stringify(row));
    const rows = await intentRowsAtLeast(lane.slot, 3);
    check("§5 the audit log holds the whole phase trail, in order — the context an exit 144 lacked",
      rows.join(" | ") === "isolated:waiting | isolated:running | isolated:failed exit 144", rows.join(" | "));
  }

  // ===== §6 a report never outlives its reporter =====
  await post(`/api/slots/${lane.slot}/kill`, {});
  check("§6 killing the lane drops its report — a dead session's `failed` is not a live fact",
    !(await gateOf())?.reports.some((x) => x.slot === lane.slot), JSON.stringify((await gateOf())?.reports));
  await post(`/api/slots/${free}/kill`, {}); // leave the slot inventory as this module found it

  // ===== §7 the MEASURED half: fleet's own two suite runs report themselves =====
  // Both of them take the same machine-wide mutex the lock half reports, both hold it for minutes,
  // and until 2026-08-19 neither said a word: `gate.lock` named a pid and `gate.reports` was empty,
  // so the two-lane episode of 2026-08-17 was reconstructed with `ps -o ppid` and `lsof -a -d cwd`.
  //
  // Driven against SLEEPING STAND-INS, never a real suite: FLEET_VERIFY_CMD and
  // FLEET_POSTLAND_AUDIT_CMD are pointed at two scripts that announce themselves, sleep ~2s, and
  // exit. The sleep is the whole fixture — it is what makes "in flight" an observable state rather
  // than a moment between two polls.
  //
  // The stand-ins ANNOUNCE BEFORE THEY SLEEP, and that ordering is the reason the preconditions
  // below can be checks of their own: the marker file appearing means "the run this section is
  // about has genuinely started", so a missing gate row after that is a product regress, while a
  // marker that never appears is this section failing to set itself up — two different sentences,
  // never wearing each other's words. A probe that could not run must fail as ITSELF; failing in
  // the place of the thing it was going to measure is how a green box gets read as a red product.
  {
    // THE LEDGER THIS SECTION IS ABOUT TO WRITE INTO, snapshotted. §7 is the only place in the whole
    // isolated suite that makes tier 2 genuinely run, so it is the only place that appends a REAL
    // row to post-land-audits.jsonl — and later modules count that file (e2e/steward-core.ts asserts
    // an exact `audits.length`). A real row left behind is this section rewriting another module's
    // fixture, which is a defect in this section, not in that one. Restored before the final restart.
    const LEDGER = `${ROOT}/post-land-audits.jsonl`;
    const ledgerBefore = existsSync(LEDGER) ? readFileSync(LEDGER, "utf8") : null;
    const MARK_V = `${TMP}/fleet-e2e-gaterun-verify-${process.pid}`;
    const MARK_A = `${TMP}/fleet-e2e-gaterun-audit-${process.pid}`;
    const FAILFLAG = `${TMP}/fleet-e2e-gaterun-fail-${process.pid}`;
    const SLOW_V = `${TMP}/fleet-e2e-slowverify-${process.pid}`;
    const SLOW_A = `${TMP}/fleet-e2e-slowaudit-${process.pid}`;
    for (const f of [MARK_V, MARK_A, FAILFLAG]) rmSync(f, { force: true });
    // exit 1 on demand (the flag file) so ONE stand-in can drive both a kept lane and a landing
    // one. Read AFTER the sleep, so the flag can be flipped while a run is already in flight.
    writeFileSync(SLOW_V, `#!/bin/sh\necho "$PWD" >> '${MARK_V}'\nsleep 2\n`
      + `if [ -f '${FAILFLAG}' ]; then echo "slowverify FAIL"; exit 1; fi\necho "slowverify PASS"\n`, { mode: 0o755 });
    writeFileSync(SLOW_A, `#!/bin/sh\necho "$PWD" >> '${MARK_A}'\nsleep 2\necho "PASS slowaudit"\necho "ALL PASS"\n`, { mode: 0o755 });
    chmodSync(SLOW_V, 0o755);
    chmodSync(SLOW_A, 0o755);
    // a fixture for an EXECUTABLE artefact has to establish that it EXECUTES, not that it exists
    check("§7 fixture: the sleeping verify stand-in runs and exits green",
      spawnSync("/bin/sh", ["-c", `'${SLOW_V}'`], { cwd: TMP }).status === 0, SLOW_V);
    rmSync(MARK_V, { force: true }); // …and that trial run's mark must not be mistaken for a gate's

    // FLEET_POSTLAND_AUDIT_CMD is deliberately unset for the whole isolated suite (tier 2 off, see
    // e2e/land-provenance.ts), and POSTLAND_AUDIT_CMD is read once at boot — so this needs the
    // restart, and the restart at the end of the block puts the suite back the way it found it.
    await restartSrv({ FLEET_VERIFY_CMD: SLOW_V, FLEET_POSTLAND_AUDIT_CMD: SLOW_A,
      FLEET_POSTLAND_AUDIT_TIMEOUT_MS: "30000", FLEET_AUDIT_PING_MS: "0" });

    const marks = (f: string): number => { try { return readFileSync(f, "utf8").split("\n").filter(Boolean).length; } catch { return 0; } };
    // the whole snapshot comes back, not just the hit: some of the claims below are about what
    // else was on the surface AT THE SAME INSTANT, and a second poll for that would be a second
    // moment — by then the run may have ended and the question would answer itself trivially.
    const pollGate = async (want: (r: GateReport) => boolean, ms = 25_000): Promise<{ row: GateReport | null; all: GateReport[] }> => {
      let all: GateReport[] = [];
      for (let i = 0; i < Math.ceil(ms / 120); i++) {
        all = (await gateOf())?.reports ?? [];
        const hit = all.find(want);
        if (hit) return { row: hit, all };
        await Bun.sleep(120);
      }
      return { row: null, all };
    };
    const pollGateGone = async (want: (r: GateReport) => boolean, ms = 40_000): Promise<boolean> => {
      for (let i = 0; i < Math.ceil(ms / 120); i++) {
        if (!(await gateOf())?.reports.some(want)) return true;
        await Bun.sleep(120);
      }
      return false;
    };
    const isServer = (r: GateReport): boolean => r.origin === "server";

    // --- DRIVING A MERGE UNTIL ITS PRECONDITION HOLDS, not until something happened -------------
    // The two loops this replaces stopped at `running || last !== null` — at the first sign of ANY
    // outcome — and everything below then spoke about a gate run, or a land, the fixture had never
    // established. Every no-measurement exit from the merge job wears exactly that shape: an author
    // hand-off records `awaiting-author` and never spawns the gate, a halted pre-pass records
    // `error` before it, a ⏸ hold answers with a verdict this run did not write, and a red verify
    // records `resolved` — at `last !== null` all four are the same fact. That is how §7 read
    // `lines=0` as a broken land gate three times (2026-08-25/26, twice as a post-land audit) when
    // the true sentence was "this section never got a gate run to look at".
    //
    // So the goal itself is polled, and a verdict that did NOT reach it is a reason to fire the
    // merge again rather than a reason to stop — which is also the cure for the transient half of
    // the race (an index.lock-halted pre-pass writes `error` and the next attempt rebases fine).
    // Bounded, because a lane that structurally cannot reach the goal (a conflict the author path
    // keeps handing back) must end as a FAILING PRECONDITION and not as a hang. Every attempt that
    // settled short is kept in `log` and quoted by the check that gives up: a probe that could not
    // run has to say what it saw, or the next reader is back to inferring a mechanism from a zero.
    type MergeState = { gone: boolean; running: boolean; last: MergeVerdict | null };
    const driveMergeUntil = async (slot: number, reached: (s: MergeState | null) => boolean,
        tries = 4, perTryMs = 30_000): Promise<{ ok: boolean; log: string[] }> => {
      const log: string[] = [];
      let seen: MergeState | null = null;
      for (let attempt = 1; attempt <= tries; attempt++) {
        if (reached(seen)) return { ok: true, log };
        await settleForMerge(slot);
        const m = await post(`/api/slots/${slot}/merge`, {});
        if (!m.ok) log.push(`try ${attempt}: merge POST refused ${m.status} ${(await m.text()).slice(0, 120)}`);
        const deadline = Date.now() + perTryMs;
        let why = `the merge job was still running after ${perTryMs}ms`;
        while (Date.now() < deadline) {
          const r = await get(`/api/slots/${slot}/merge`);
          seen = r.status === 400
            ? { gone: true, running: false, last: null }
            : { gone: false, ...((await r.json()) as { running: boolean; last: MergeVerdict | null }) };
          if (reached(seen)) return { ok: true, log };
          if (seen.gone) { why = "the slot is gone, and that was not the goal"; break; }
          if (!seen.running) {
            why = seen.last === null
              ? "no job ran (the merge was refused and left no verdict)"
              : `settled as ${seen.last.status}/landed=${seen.last.landed} without reaching the goal`
                + ` — ${seen.last.detail.slice(0, 160)}`;
            break;
          }
          await Bun.sleep(120);
        }
        log.push(`try ${attempt}: ${why}`);
      }
      return { ok: reached(seen), log };
    };

    // --- (a) the LAND GATE, on a lane that is KEPT ---------------------------------------------
    // The verify is made to FAIL on purpose, which is not about the verdict: a lane that lands is
    // torn down, and a row that vanishes because its slot did cannot tell "the entry was removed"
    // from "the entry is being hidden by the recycle rule". A kept lane keeps its slot and its
    // cwd, so the disappearance below is the removal itself.
    writeFileSync(FAILFLAG, "fail\n");
    const lnA = await openLane(REPO, "gaterun-kept");
    // THE PRECONDITION, DRIVEN rather than hoped for: fire the merge until the stand-in has
    // announced itself on THIS lane's tree. It announces BEFORE it sleeps, so this hands back
    // INSIDE the gate run — the in-flight row every assertion below is about is still up, with
    // the whole of the stand-in's sleep left to observe it in.
    const droveA = await driveMergeUntil(lnA.slot, () => marks(MARK_V) > 0);
    const { row: gateRow, all: gateSnap } = await pollGate((r) => isServer(r) && r.slot === lnA.slot);
    // …and as its own check. If the stand-in never ran there was no land gate to see, and every
    // assertion under it would be about a run that does not exist — so this failing says "§7 could
    // not set itself up", never "the land gate is broken", and the drive log names which exit out
    // of the merge job took the run away.
    const gateRan = marks(MARK_V) > 0;
    check("§7 fixture: the land gate actually ran on this lane's tree (the stand-in announced itself)",
      gateRan, `${MARK_V} lines=${marks(MARK_V)}${droveA.log.length ? ` · ${droveA.log.join(" | ")}` : ""}`);
    if (gateRan) {
      check("§7 a server-side land gate names ITSELF on /api/sessions while it runs — no ps, no lsof",
        !!gateRow && gateRow.origin === "server" && gateRow.slot === lnA.slot
          && gateRow.branch === lnA.branch && gateRow.phase === "running" && gateRow.suite === "land gate",
        JSON.stringify(gateRow));
      // Design question (1) as an assertion: hearsay and measurement do not share a key. This lane
      // never posted a verify-intent, so exactly ONE row may name its slot — and if the two halves
      // shared `verifyIntents`' slot-id key, a lane reporting on itself mid-gate would have
      // silently replaced this row instead of standing beside it.
      check("§7 the land-gate row does not occupy the lane's own report key — one slot, one server row, no collision",
        gateSnap.filter((r) => r.slot === lnA.slot).length === 1
          && gateSnap.filter((r) => r.slot === lnA.slot && r.origin === "lane").length === 0,
        JSON.stringify(gateSnap));
    }
    const vA = await waitMerge(lnA.slot, { requireVerdict: true });
    check("§7 fixture: the failing gate kept the lane, so its slot is still alive to be asserted about",
      !vA.gone && vA.last?.landed === false && exists(lnA.cwd), JSON.stringify(vA.last?.status));
    if (gateRan && !vA.gone) {
      check("§7 the row is gone the moment the run goes terminal — on a slot that is still there, so this is removal, not the recycle rule hiding it",
        await pollGateGone((r) => isServer(r) && r.slot === lnA.slot),
        JSON.stringify((await gateOf())?.reports));
    }

    // --- (b) the POST-LAND AUDIT, which has no slot at all ---------------------------------------
    rmSync(FAILFLAG, { force: true }); // this lane's gate passes, so it lands, so tier 2 fires
    const lnB = await openLane(REPO, "gaterun-landed");
    // Same shape, different goal: this section's precondition here is the LAND (see below), so the
    // LAND is what gets driven — a merge that settles short of it buys another attempt instead of
    // handing the assertions a run that was never scheduled. The audit row is deliberately NOT the
    // goal; deriving the precondition from it is the circularity the comment below refuses.
    const droveB = await driveMergeUntil(lnB.slot, (s) => !!s && (s.gone || s.last?.landed === true));
    const { row: auditRow } = await pollGate((r) => isServer(r) && r.slot === null);
    const vB = await waitMerge(lnB.slot);
    check("§7 fixture: lane B landed, so a tier-2 audit was actually scheduled",
      vB.gone || vB.last?.landed === true,
      `${JSON.stringify(vB.last?.status ?? "gone")}${droveB.log.length ? ` · ${droveB.log.join(" | ")}` : ""}`);
    // the precondition here is the LAND, not the row: with tier 2 configured, a land that moves main
    // schedules an audit by construction. Deriving it from `auditRow` instead would be circular —
    // the row's own existence cannot be the evidence that there was something for it to report.
    const auditRan = vB.gone || vB.last?.landed === true;
    if (auditRan) {
      // `slot: null` is the fact, not a placeholder: the audit is fleet's own work, owned by no
      // pane. It names the tree it is measuring instead, which is the half `lock.pid` never had.
      check("§7 a running post-land audit names itself with NO slot, and says which tree it is measuring",
        !!auditRow && auditRow.slot === null && auditRow.origin === "server"
          && auditRow.suite === "post-land audit" && auditRow.branch === "main"
          && auditRow.label === REPO.split("/").filter(Boolean).slice(-1)[0],
        JSON.stringify(auditRow));
      check("§7 the audit row is gone once the audit is terminal — the surface is in-flight-only",
        await pollGateGone((r) => isServer(r) && r.slot === null),
        JSON.stringify((await gateOf())?.reports));
      // …and only NOW, non-circularly: the run the row stood for had a real payload. Asserted after
      // terminality on purpose — before it, a stand-in that has not been spawned yet and one that
      // will never be spawned look identical, so this same line read earlier would be a coin flip.
      check("§7 the audit row stood for a real run — its stand-in did execute, so the row was no phantom",
        marks(MARK_A) > 0, `${MARK_A} lines=${marks(MARK_A)}`);
    }

    // leave the machine exactly as this block found it: no lane, no stand-ins, tier 2 off again.
    await post(`/api/slots/${lnA.slot}/kill`, {});
    for (const f of [MARK_V, MARK_A, FAILFLAG, SLOW_V, SLOW_A]) rmSync(f, { force: true });
    if (ledgerBefore === null) rmSync(LEDGER, { force: true });
    else writeFileSync(LEDGER, ledgerBefore);
    await restartSrv();
    // Asserted, not assumed: this block reconfigured the LAND GATE of a server every later module
    // shares, and a restore that silently failed would leave the rest of the suite verifying
    // against a deleted sleeper. `/api/self/gate` reads the running server's own env, so it is the
    // one answer that cannot be a guess about it.
    const probe = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number };
    const probeTok = await selfTokenOf(probe.slot);
    const gateCfg = (await (await fetch(`${BASE}/api/self/gate`, { headers: { "x-fleet-self-token": probeTok } }))
      .json()) as { verify?: { cmd?: string } | null };
    check("§7 the suite's env is restored: the land gate is back on the suite's own verify stand-in, not this block's sleeper",
      gateCfg.verify?.cmd?.endsWith("fakeverify") === true, JSON.stringify(gateCfg.verify));
    await post(`/api/slots/${probe.slot}/kill`, {});
  }
}
