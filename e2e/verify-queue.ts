// The suite mutex from the WRITER's side: what e2e-stage.sh says while it blocks (§2b), how a step
// inside an inherited hold behaves and that waiters are served in arrival order (§2c), and that every
// wrapper's boot probe ends within its own deadline (§2d). §2b and §2c source the real script against
// a PRIVATE lock dir, because the real mutex is held by this very run; §2d runs each wrapper's own
// probe line against a local port that accepts and never answers.
import { existsSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, check } from "./harness";

const TMP = process.env.TMPDIR ?? "/tmp";

// LC_ALL=C: `ps -o lstart=` is locale-formatted, and every consumer of this string — the fixture
// regex below, e2e-stage.sh#_st_valid_birth, server.ts#PROCESS_BIRTH_RE — requires English
// month/day names. Without it the Debian/de_DE helper yields "Di Sep  1 ...", the fixture fails as
// itself and the family behind it falls closed (measured 2026-09-01;
// docs/messungen/workhorse-baseline-2026-08-29.md §Plattform-Signatur).
const processBirthOf = (pid: number): string => {
  const p = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)],
    { encoding: "utf8", env: { ...process.env, LC_ALL: "C" } });
  return p.status === 0 ? p.stdout.trim().replace(/\s+/g, " ") : "";
};
const differentValidBirth = (actual: string): string =>
  actual === "Mon Jan 1 00:00:00 2001" ? "Tue Jan 2 00:00:00 2001" : "Mon Jan 1 00:00:00 2001";

export async function run(): Promise<void> {
  const thisBirth = processBirthOf(process.pid);
  check("fixture: the host exposes a process-birth fingerprint for this harness",
    /^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2} \d{2}:\d{2}:\d{2} \d{4}$/.test(thisBirth), thisBirth);

  // ===== §2b the WRITER's side: what e2e-stage.sh says while it blocks =====
  // This tests the wrapper TAKING the lock, because the silence
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

    // CONTROL C: the variable matches a LIVE recorded pid — but the birth on disk is not that
    // process's (Astra-Befund 2, 2026-09-15). That is a recycled pid, so the claim grants nothing:
    // the whole script must take the ordinary path, reap the recycled lock and hold it itself.
    rmSync(PROBE, { recursive: true, force: true });
    mkdirSync(PROBE, { recursive: true });
    writeFileSync(`${PROBE}/pid`, `${process.pid}\n`);
    writeFileSync(`${PROBE}/birth`, `${differentValidBirth(thisBirth)}\n`);
    const recycledClaimSay = await stageSay(5000, { FLEET_SUITE_LOCK_HELD_BY: String(process.pid) });
    check("§2c an inheritance claim over a live pid whose birth CHANGED is no hold: the step reaps the recycled lock and takes it under its own pid",
      new RegExp(`stale — recorded pid ${process.pid} is alive but its process-birth fingerprint changed`).test(recycledClaimSay)
        && !recycledClaimSay.includes(`acquired after 0s (pid ${process.pid})`)
        && / acquired after \d+s \(pid \d+\)$/m.test(recycledClaimSay)
        && readFileSync(`${PROBE}/pid`, "utf8").trim() !== String(process.pid),
      JSON.stringify(recycledClaimSay.slice(0, 400)));

    // CONTROL D: same live pid, NO birth on disk. Unproven identity is `unknown` to a waiter and is
    // kept — so a claim over it grants nothing either: the step waits instead of running inside it.
    rmSync(PROBE, { recursive: true, force: true });
    mkdirSync(PROBE, { recursive: true });
    writeFileSync(`${PROBE}/pid`, `${process.pid}\n`);
    const unprovenClaimSay = await stageSay(2500, { FLEET_SUITE_LOCK_HELD_BY: String(process.pid) });
    check("§2c an inheritance claim over a live pid with NO recorded birth grants nothing: the step waits as for any unknown holder and does not reap it",
      /waiting [01]s for [^\n]* — unknown — recorded pid \d+ is alive, but the lock has no process-birth fingerprint/.test(unprovenClaimSay)
        && !/ acquired after /.test(unprovenClaimSay)
        && readFileSync(`${PROBE}/pid`, "utf8").trim() === String(process.pid),
      JSON.stringify(unprovenClaimSay.slice(0, 400)));

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
    // `after 0s` vs `after 1s` is a second-boundary coin flip, not a wait: the printf subtracts
    // date +%s at acquire from the contender's t0, so a crossing prints 1s with nothing waited —
    // the sibling check on the free path (:415) already accepts [01]s for the same at-once acquire.
    check("§2c it proceeds at once and reports in the ONE acquire format, naming the pid that actually holds the lock",
      (inhOut.includes(`acquired after 0s (pid ${holder.pid})`) || inhOut.includes(`acquired after 1s (pid ${holder.pid})`))
        && /^\[suite-lock\] [^\n]* acquired after [01]s \(pid \d+\)$/m.test(inhOut)
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

  // ===== §2d a wrapper's BOOT PROBE cannot hold the mutex on a port that never answers =====
  // Every wrapper waits for its server with a curl loop, and it waits WHILE HOLDING the suite
  // mutex. The loop bounds its attempts (60 × 0.5 s), not the attempt: a curl with no deadline
  // against a port that accepts and never answers blocks until the gate's OUTER timeout, and every
  // suite on the box queues behind it (Astra-Befund 6, 2026-09-15). e2e/pins.ts holds the source
  // rule (every such curl names --max-time); this runs each wrapper's OWN probe line, cut out of the
  // wrapper, against a local responder that accepts and never writes a byte.
  {
    const SRC = ((): string => {
      try { return dirname(readlinkSync(`${ROOT}/node_modules`)); } catch { return ROOT; }
    })();
    const probes = readdirSync(SRC).filter((f) => /^e2e-.*\.sh$/.test(f)).sort().flatMap((f) =>
      readFileSync(`${SRC}/${f}`, "utf8").split("\n").flatMap((l, i) => {
        const m = /\$\((curl [^)]*http:\/\/127\.0\.0\.1:\$PORT\/[^)]*)\)/.exec(l);
        return m ? [{ at: `${f}:${i + 1}`, cmd: m[1]!,
          deadline: Number(/(?:--max-time|\s-m)\s+([0-9.]+)/.exec(m[1]!)?.[1] ?? NaN) }] : [];
      }));
    const accepted: { end(): void }[] = [];
    const silent = Bun.listen({ hostname: "127.0.0.1", port: 0,
      socket: { open(s) { accepted.push(s); }, data() { /* never answers */ } } });
    try {
      check("§2d fixture: wrapper boot probes found in the source tree",
        probes.length > 0, `${probes.length} probes under ${SRC}`);
      const runs = await Promise.all(probes.map(async (p) => {
        const t0 = Date.now();
        const sh = Bun.spawn(["sh", "-c", `PORT=${silent.port}; code=$(${p.cmd}); printf '%s' "$code"`],
          { stdout: "pipe", stderr: "ignore" });
        // the probe's own deadline is what is under test; this kill only keeps a missing one from
        // hanging THIS suite — it fires well after any sane deadline and is reported as such
        const guard = setTimeout(() => { try { sh.kill(9); } catch { /* already gone */ } }, 20_000);
        const out = await new Response(sh.stdout).text();
        await sh.exited;
        clearTimeout(guard);
        return { ...p, ms: Date.now() - t0, out };
      }));
      const bad = runs.filter((r) => !(r.deadline > 0) || r.out !== "000" || r.ms > r.deadline * 1000 + 1500);
      check("§2d every wrapper boot probe against a port that accepts and never answers ends within its own deadline, reading as not-up (000)",
        runs.length > 0 && accepted.length > 0 && bad.length === 0,
        JSON.stringify({ accepted: accepted.length, bad: bad.map((r) => ({ at: r.at, deadline: r.deadline, ms: r.ms, out: r.out })) }));
    } finally {
      for (const s of accepted) try { s.end(); } catch { /* gone */ }
      silent.stop(true);
    }
  }
}
