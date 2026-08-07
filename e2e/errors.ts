// THE ERROR CHANNEL: what the server has thrown since it booted, on the owner's poll.
//
// The contract under test has three halves, and the middle one is the reason the module exists:
//   (1) an untroubled server says NOTHING — `errors` is null, not an empty shape.
//   (2) a real failure appears, names its site, and COUNTS repeats instead of listing them.
//   (3) it does not survive a restart. The buffer is in memory by design (server.ts, THE ERROR
//       CHANNEL) — a revived list would be an invented fact about a process that no longer exists.
//
// The forced failure is a genuine one, not a test hook: `streams/sN.history.json` is replaced by a
// DIRECTORY, so saveHistory's Bun.write fails EISDIR on every prompt sent to that slot — exactly
// what a corrupted streams dir does in production. Nothing in server.ts knows this suite exists.
//
// Every assertion about counts is written as a DELTA against a reading taken first. The absolute
// numbers are not ours to predict: this module runs late in a suite that has been restarting srv
// and killing panes for twenty minutes, and any ambient failure the channel legitimately caught
// belongs in `total` too. A delta is deterministic where an absolute is a guess.
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { ROOT, check, get, post, restartSrv, tmuxOut } from "./harness";

interface ErrRow { where: string; msg: string; first: number; last: number; n: number }
interface ErrList { since: number; total: number; kept: number; errors: ErrRow[] }
interface Poll { errors?: { total: number; distinct: number; since: number;
  last: { at: number; where: string; msg: string; n: number } } | null }

const SENDS = 3; // one write each; enough to prove `n` counts rather than lists

const pollErrors = async (): Promise<Poll["errors"]> =>
  ((await (await get("/api/sessions")).json()) as Poll).errors ?? null;
const listErrors = async (): Promise<ErrList> => (await (await get("/api/errors")).json()) as ErrList;

export async function run(): Promise<void> {
  // --- (1) the quiet case. Measured on a server restarted a breath ago, which is the only state
  // in which "nothing has failed" is a claim this suite is entitled to make. ---
  await restartSrv();
  const atBoot = await pollErrors();
  check("a server that has not thrown reports errors:null, not an empty shape",
    atBoot === null, JSON.stringify(atBoot));
  const bootList = await listErrors();
  check("the detail route agrees the list is empty and still names the window",
    bootList.errors.length === 0 && typeof bootList.since === "number" && bootList.total === 0,
    JSON.stringify(bootList));

  // --- (2) a real failure. ---
  // ORDER IS LOAD-BEARING, and getting it wrong is what the first run of this module proved:
  // openSlot AND killSlot both `rm` the history path (server.ts, grep `historyPath`), so a
  // directory sitting there fails the OPEN with EFAULT instead of failing the write. The fixture
  // is therefore broken strictly BETWEEN the two, and repaired before the kill.
  const sess = (await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] };
  const free = sess.slots.find((s) => !s.cwd);
  if (!free) { check("errors: a free slot to break", false, "every slot is active"); return; }
  const histPath = `${ROOT}/streams/s${free.id}.history.json`;
  const opened = await post(`/api/slots/${free.id}/open`, { cwd: "~" });
  check("errors: the fixture slot opened", opened.ok, JSON.stringify(await opened.json()));
  // and WARM: a send to a slot whose pane is not up yet throws inside the route ("tmux
  // paste-buffer failed"), which the channel duly records — as an `http` row that would then be
  // mistaken for the write failure this section is about.
  for (let i = 0; i < 60; i++) {
    if ((await tmuxOut("has-session", "-t", `s${free.id}`)).code === 0) break;
    await Bun.sleep(100);
  }
  let warm = false;
  for (let i = 0; i < 40 && !warm; i++) {
    warm = (await post("/send", { slot: free.id, text: "warm-up\n" })).ok;
    if (!warm) await Bun.sleep(200);
  }
  check("errors: the fixture slot takes a prompt before anything is broken", warm);

  // the baseline: everything above is prior state, and every assertion below is a DELTA on it
  const base = await pollErrors();
  rmSync(histPath, { force: true, recursive: true });
  mkdirSync(histPath); // saveHistory's Bun.write now fails EISDIR, every time, for this slot only
  for (let i = 0; i < SENDS; i++) await post("/send", { slot: free.id, text: `error-channel probe ${i}\n` });

  // saveHistory is fire-and-forget through a promise chain, so poll for the record rather than
  // sleep at it — the write is queued behind whatever else is on that chain.
  let seen: Poll["errors"] = null;
  for (let i = 0; i < 80; i++) {
    seen = await pollErrors();
    if (seen && seen.last.where === "saveHistory" && seen.last.n >= SENDS) break;
    await Bun.sleep(100);
  }
  check("a failed state write reaches the owner's poll, naming its site",
    seen?.last.where === "saveHistory", JSON.stringify(seen));
  check("the message is the real errno, not a paraphrase",
    !!seen?.last.msg.includes("EISDIR"), seen?.last.msg ?? "");
  // the claim: N new failures produced ONE new row, and every one of them landed in it. `>=` on
  // the count rather than `===` because the harvest tick writes this slot's history too and its
  // failures carry the same signature — a fourth occurrence is the feature working, not a fault.
  check(`identical failures are ONE row counted n×, not n rows`,
    seen?.distinct === (base?.distinct ?? 0) + 1
      && (seen?.last.n ?? 0) >= SENDS
      && seen?.total === (base?.total ?? 0) + (seen?.last.n ?? 0),
    JSON.stringify({ base, seen }));
  check("the counted window starts at boot, not at the first failure",
    !!seen && seen.since < seen.last.at, JSON.stringify(seen));

  // the detail route carries what the summary cannot: the first sighting, so a repeating failure
  // can be told from a burst
  const list = await listErrors();
  const row = list.errors.find((r) => r.where === "saveHistory");
  check("the detail route carries the row with both ends of its lifetime",
    !!row && row.n >= SENDS && row.first <= row.last && row.msg.includes("EISDIR"),
    JSON.stringify(list.errors.map((r) => `${r.where}×${r.n}`)));
  check("the detail route says how deep the buffer goes, and agrees with the poll's total",
    list.kept > 0 && list.total === (seen?.total ?? -1),
    JSON.stringify({ kept: list.kept, total: list.total, poll: seen?.total }));

  // a DIFFERENT site must open its own row rather than fold into the first. The prompt journal is
  // the second one, and it is SAVED AND PUT BACK: later modules read it, and the only thing that
  // would have appended to it during this window is the write being deliberately broken.
  const before = await pollErrors();
  const plogPath = `${ROOT}/streams/prompts.jsonl`;
  // never let the borrow itself throw: an unreadable journal must fail the check below, not kill
  // the run and take every module after this one with it
  const plogSaved = existsSync(plogPath) ? readFileSync(plogPath) : Buffer.alloc(0);
  rmSync(plogPath, { force: true, recursive: true });
  mkdirSync(plogPath); // now logPrompt fails too — same errno, different site
  await post("/send", { slot: free.id, text: "second site\n" });
  let two: Poll["errors"] = null;
  for (let i = 0; i < 80; i++) {
    two = await pollErrors();
    if (two && two.distinct >= 2) break;
    await Bun.sleep(100);
  }
  check("a second failing site opens its own row instead of folding into the first",
    two?.distinct === (before?.distinct ?? 0) + 1 && (two?.total ?? 0) > (before?.total ?? 0),
    JSON.stringify({ before, two }));
  const twoList = await listErrors();
  const [newest, older] = twoList.errors;
  check("the rows come back newest first, one per site",
    !!newest && !!older && newest.last >= older.last
      && new Set(twoList.errors.map((r) => r.where)).size === twoList.errors.length,
    JSON.stringify(twoList.errors.map((r) => `${r.where}×${r.n}`)));

  // --- (3) it must not survive a restart. Repair the fixtures FIRST: a restart that inherits a
  // broken streams dir would prove nothing about memory and would poison every module after this.
  // repair BEFORE the kill, not after: killSlot removes the history path too, and would hit the
  // same EFAULT the open did — leaving a half-killed slot for every module downstream.
  rmSync(histPath, { force: true, recursive: true });
  rmSync(plogPath, { force: true, recursive: true });
  writeFileSync(plogPath, plogSaved, { mode: 0o600 }); // byte-for-byte, and the mode security.ts pins
  await post(`/api/slots/${free.id}/kill`, {});
  await restartSrv();
  const after = await pollErrors();
  check("the error list does not survive a restart — it is memory, never a revived ledger",
    after === null, JSON.stringify(after));
  const afterList = await listErrors();
  check("and the restarted server's window starts later than the one that recorded them",
    afterList.since > bootList.since && afterList.errors.length === 0,
    JSON.stringify({ before: bootList.since, after: afterList.since, rows: afterList.errors.length }));

  // the repaired paths must be writable again, or the modules after this one inherit a broken
  // server — checked as a fact rather than assumed from the rmSync above. Same pane warm-up as
  // before: a send that arrives ahead of the tmux session throws, and that throw is an `http` row
  // that would read here as "the repair did not take".
  const reopened = await post(`/api/slots/${free.id}/open`, { cwd: "~" });
  for (let i = 0; i < 60; i++) {
    if ((await tmuxOut("has-session", "-t", `s${free.id}`)).code === 0) break;
    await Bun.sleep(100);
  }
  let sent = false;
  for (let i = 0; i < 40 && !sent; i++) {
    sent = (await post("/send", { slot: free.id, text: "after repair\n" })).ok;
    if (!sent) await Bun.sleep(200);
  }
  // give the write chain a beat to fail if it were still going to, then assert it did not
  let quiet: Poll["errors"] = null;
  for (let i = 0; i < 20; i++) { quiet = await pollErrors(); if (quiet) break; await Bun.sleep(100); }
  check("the repaired state writes are silent again",
    reopened.ok && sent && quiet === null, JSON.stringify(quiet));
  // the prompt journal this module borrowed is handed back whole — later modules read it, and a
  // suite that silently truncated it would fail somewhere else entirely
  const plogNow = statSync(plogPath);
  check("the borrowed prompt journal was restored, contents and mode",
    plogNow.size >= plogSaved.length && (plogNow.mode & 0o777) === 0o600,
    `${plogNow.size} >= ${plogSaved.length}, mode ${(plogNow.mode & 0o777).toString(8)}`);
  await post(`/api/slots/${free.id}/kill`, {});
}
