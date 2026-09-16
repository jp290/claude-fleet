// The brief-quality reader (briefstats.ts): the two rates §4 of
// docs/attic/brief-kompilierung-verbesserung-2026-08-18.md names, computed off the two ledgers that have
// carried them since 735aa45 — empty-lane rate per brief origin, and zero-owner-prompt rate per
// landed lane per brief origin.
//
// PURE, like e2e/prompts.ts: the reader takes records as arguments, so every semantic check here
// feeds a synthetic pair of ledgers and asserts exact numbers with no server and no live ledger.
// Only the two file-level checks touch disk, and they do it in a throwaway fixture directory under
// TMPDIR which they remove again — the live lane-outcomes.jsonl and context-receipts.jsonl are
// never read by this module, on purpose.
//
// THE FIVE TRAPS, each with its own check, because each one turns a wrong answer into a
// confident-looking one:
//   · a receipt from before 735aa45 has no briefSource and is byte-identical to a raw delivery —
//     counting it as `raw` would put pre-field lanes into the number the compiler is judged by;
//   · a lane with no taskId names no delivery, and §4 says so explicitly: excluded and counted;
//   · a `founding` receipt describes a Program-MAIN, not a lane, and must reach no lane rate;
//   · `origin:"main-direct"` rows share the outcome file and are NOT lanes — validating fields
//     before scope books each of them as damage (slotstats.ts's measured 468-malformed lesson);
//   · appendEvent rotates, so a single-file reader answers from a truncated ledger with no error.
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { check, ROOT } from "./harness";
import { appendEvent, AUDIT_ROTATE_BYTES } from "../server/persist";
import { briefStats, readJsonl, type BriefStatsSummary, type OutcomeRecord, type ReceiptRecord } from "../briefstats";

const TMP = `${process.env.TMPDIR ?? "/tmp"}/fleet-briefstats-fixtures-${process.pid}`;

/** one receipt as the dispatch seam writes it; `source: null` is a row from before 735aa45 */
const receipt = (o: { task: string | null; branch: string; hash?: string | null; source?: string | null;
  selected?: unknown }): ReceiptRecord => ({
  at: 1_700_000_000_000, taskId: o.task, branch: o.branch,
  briefHash: o.hash === undefined ? `h-${o.branch}` : o.hash,
  ...(o.source ? { briefSource: o.source } : {}), // absent = a row from before 735aa45
  ...(o.selected === undefined ? {} : { selected: o.selected }), // absent = a row from before the plan rail
});

/** one lane outcome as buildLaneOutcome writes it */
const outcome = (o: { task?: string | null; branch?: string | null; disposition: string; prompts?: unknown;
  hash?: string | null; ts?: number }): OutcomeRecord => ({
  ts: o.ts ?? 1_700_000_100_000,
  branch: o.branch === undefined ? "b1" : o.branch,
  disposition: o.disposition,
  ...(o.task === undefined || o.task === null ? {} : { taskId: o.task }),
  briefHash: o.hash === undefined ? `h-${o.branch ?? "b1"}` : o.hash,
  ownerPrompts: o.prompts === undefined ? 0 : o.prompts,
});

const row = (s: BriefStatsSummary, source: string) => s.sources.find((r) => r.source === source);

/** every bucket a lane row can land in, summed — the funnel this reader promises is exhaustive */
const accounted = (s: BriefStatsSummary): number =>
  s.overall.lanes // a landed lane with an unreadable ownerPrompts is IN overall.lanes, not beside it
  + s.excluded.noTaskId + s.excluded.noBranch + s.excluded.supersededOutcomeRows
  + s.excluded.noReceipt + s.excluded.ambiguous + s.excluded.preP2 + s.excluded.unknownSource
  + s.excluded.founding + s.outOfScope.mainDirect + s.outOfScope.malformed;

export async function run(): Promise<void> {
  // --- (a) THE TWO RATES over a mixed population, with their denominators asserted as fractions
  // and not as percentages: 1/2 and 50/100 are the same number and a very different claim.
  const receipts: ReceiptRecord[] = [
    receipt({ task: "t1", branch: "b1", source: "compiled" }),
    receipt({ task: "t2", branch: "b2", source: "compiled" }),
    receipt({ task: "t3", branch: "b3", source: "raw" }),
    receipt({ task: "t4", branch: "b4", source: "raw" }),
    receipt({ task: "t5", branch: "b5", source: "owner" }),
    receipt({ task: "t6", branch: "b6", source: "clarify" }),
    receipt({ task: null, branch: "bF", source: "founding" }),
  ];
  const outcomes: OutcomeRecord[] = [
    outcome({ task: "t1", branch: "b1", disposition: "landed", prompts: 0 }),
    outcome({ task: "t2", branch: "b2", disposition: "killed-empty" }),
    outcome({ task: "t3", branch: "b3", disposition: "landed", prompts: 3 }),
    outcome({ task: "t4", branch: "b4", disposition: "killed-empty" }),
    outcome({ task: "t5", branch: "b5", disposition: "landed", prompts: 0 }),
    outcome({ task: "t6", branch: "b6", disposition: "killed-empty" }),
  ];
  const mixed = briefStats(outcomes, receipts);
  check("briefstats: the empty rate is killed-empty over ALL joined lanes of that origin, not over survivors",
    row(mixed, "compiled")?.lanes === 2 && row(mixed, "compiled")?.killedEmpty === 1
      && row(mixed, "compiled")?.emptyRate === 0.5
      && row(mixed, "raw")?.lanes === 2 && row(mixed, "raw")?.killedEmpty === 1
      && row(mixed, "owner")?.lanes === 1 && row(mixed, "owner")?.killedEmpty === 0
      && row(mixed, "owner")?.emptyRate === 0,
    JSON.stringify(mixed.sources.map((r) => [r.source, r.lanes, r.killedEmpty, r.emptyRate])));
  check("briefstats: the zero-owner-prompt rate is per origin and its denominator is LANDED lanes only",
    row(mixed, "compiled")?.landed === 1 && row(mixed, "compiled")?.zeroPrompt === 1
      && row(mixed, "compiled")?.zeroPromptRate === 1
      && row(mixed, "raw")?.landed === 1 && row(mixed, "raw")?.zeroPrompt === 0
      && row(mixed, "raw")?.zeroPromptRate === 0
      && mixed.overall.landed === 3 && mixed.overall.zeroPrompt === 2,
    JSON.stringify(mixed.sources.map((r) => [r.source, r.landed, r.zeroPrompt, r.zeroPromptRate])));
  check("briefstats: every terminal shape is reported per origin, so no lane hides behind the two rates",
    JSON.stringify(row(mixed, "compiled")?.dispositions) === JSON.stringify({ landed: 1, "killed-empty": 1 })
      && JSON.stringify(row(mixed, "owner")?.dispositions) === JSON.stringify({ landed: 1 }),
    JSON.stringify(mixed.sources.map((r) => [r.source, r.dispositions])));

  // --- clarify: its own row, never folded into raw, and the headline says so beside itself. A
  // contract-conformant clarify lane cannot commit, so its killed-empty is the contract kept.
  check("briefstats: clarify is its own origin and is NOT mixed into the raw empty rate",
    row(mixed, "clarify")?.lanes === 1 && row(mixed, "clarify")?.killedEmpty === 1
      && row(mixed, "clarify")?.emptyIsContract === true
      && row(mixed, "raw")?.emptyIsContract === false
      && row(mixed, "raw")?.killedEmpty === 1,
    JSON.stringify([row(mixed, "clarify"), row(mixed, "raw")?.killedEmpty]));
  check("briefstats: the headline empty rate is published twice — with clarify and without it",
    mixed.overall.lanes === 6 && mixed.overall.killedEmpty === 3 && mixed.overall.emptyRate === 0.5
      && mixed.overall.excludingClarify.lanes === 5 && mixed.overall.excludingClarify.killedEmpty === 2
      && mixed.overall.excludingClarify.emptyRate === 0.4,
    JSON.stringify(mixed.overall));

  // --- (e) FOUNDING reaches no lane rate. Two halves, because they fail differently: the natural
  // shape (taskId null → indexable by nothing) and the hostile one (a founding receipt that DOES
  // carry a lane key). Only the second could ever contaminate a rate, and only it proves the guard.
  check("briefstats: a founding receipt names no task, so it is counted as un-keyable, not as a lane",
    mixed.receipts.noLaneKey === 1 && mixed.receipts.bySource.founding === 1
      && !mixed.sources.some((r) => (r.source as string) === "founding"),
    JSON.stringify({ noLaneKey: mixed.receipts.noLaneKey, bySource: mixed.receipts.bySource }));
  const foundingKeyed = briefStats(
    [outcome({ task: "tF", branch: "bF", disposition: "landed", prompts: 0 })],
    [receipt({ task: "tF", branch: "bF", source: "founding" })]);
  check("briefstats: even a founding receipt that CAN be keyed enters no lane rate — excluded and counted",
    foundingKeyed.excluded.founding === 1 && foundingKeyed.overall.lanes === 0
      && foundingKeyed.overall.emptyRate === null && foundingKeyed.sources.length === 0,
    JSON.stringify(foundingKeyed.excluded));

  // --- (b) PRE-P2: a receipt written before briefSource existed. It is byte-identical to a raw
  // delivery on the wire, which is exactly why it must never be counted as one.
  const preP2 = briefStats(
    [outcome({ task: "t9", branch: "b9", disposition: "killed-empty" }),
      outcome({ task: "t3", branch: "b3", disposition: "landed", prompts: 0 })],
    [receipt({ task: "t9", branch: "b9", source: null }), receipt({ task: "t3", branch: "b3", source: "raw" })]);
  check("briefstats: a receipt with no briefSource is EXCLUDED and counted as pre-P2, never booked as raw",
    preP2.excluded.preP2 === 1 && preP2.receipts.preP2 === 1
      && row(preP2, "raw")?.lanes === 1 && row(preP2, "raw")?.killedEmpty === 0
      && preP2.overall.lanes === 1,
    JSON.stringify({ excluded: preP2.excluded.preP2, raw: row(preP2, "raw") }));
  const sixth = briefStats(
    [outcome({ task: "t9", branch: "b9", disposition: "killed-empty" })],
    [receipt({ task: "t9", branch: "b9", source: "distilled" })]);
  check("briefstats: a briefSource literal this reader does not know is named as such, not silently dropped",
    sixth.excluded.unknownSource === 1 && sixth.receipts.unknownSource === 1 && sixth.overall.lanes === 0,
    JSON.stringify(sixth.excluded));

  // --- (c) a lane with no taskId cannot name the delivery that founded it (§4's own instruction)
  const noTask = briefStats(
    [outcome({ branch: "bx", disposition: "killed-empty" }),
      outcome({ task: "t1", branch: "b1", disposition: "killed-empty" })],
    [receipt({ task: "t1", branch: "b1", source: "compiled" })]);
  check("briefstats: a lane without taskId is EXCLUDED and counted, never attributed to an origin",
    noTask.excluded.noTaskId === 1 && noTask.overall.lanes === 1
      && row(noTask, "compiled")?.lanes === 1,
    JSON.stringify(noTask.excluded));
  const noBranch = briefStats([outcome({ task: "t1", branch: null, disposition: "landed" })], receipts);
  check("briefstats: half a join key is not a join key — a lane with no branch is its own exclusion",
    noBranch.excluded.noBranch === 1 && noBranch.overall.lanes === 0, JSON.stringify(noBranch.excluded));
  const noReceipt = briefStats([outcome({ task: "tZ", branch: "bZ", disposition: "landed" })], receipts);
  check("briefstats: a lane whose delivery left no receipt is its own bucket, not a raw brief",
    noReceipt.excluded.noReceipt === 1 && noReceipt.overall.lanes === 0, JSON.stringify(noReceipt.excluded));

  // --- SCOPE BEFORE VALIDITY: main-direct rows share this file and have neither disposition nor
  // branch. Booking them as malformed would report a hole in a file that has none.
  const mainDirect = briefStats([
    { origin: "main-direct", ts: 1, taskId: "t1", result: "landed" } as OutcomeRecord,
    outcome({ task: "t1", branch: "b1", disposition: "landed", prompts: 0 }),
    { ts: 2 } as OutcomeRecord, // OUR row, unreadable — that one IS damage
  ], receipts);
  check("briefstats: a main-direct row is OUT OF SCOPE, never counted as a malformed lane row",
    mainDirect.outOfScope.mainDirect === 1 && mainDirect.outOfScope.malformed === 1
      && mainDirect.overall.lanes === 1,
    JSON.stringify(mainDirect.outOfScope));

  // --- one lane, one outcome: a reverted lane has a landed row AND a reverted row (they join by
  // branch), and counting both would put one lane in the denominator twice.
  const reverted = briefStats([
    outcome({ task: "t1", branch: "b1", disposition: "landed", prompts: 0, ts: 100 }),
    outcome({ task: "t1", branch: "b1", disposition: "reverted", prompts: 0, ts: 200 }),
  ], receipts);
  check("briefstats: a landed→reverted lane counts ONCE, at its newest row, and the fold is counted",
    reverted.overall.lanes === 1 && reverted.excluded.supersededOutcomeRows === 1
      && reverted.overall.landed === 0
      && JSON.stringify(row(reverted, "compiled")?.dispositions) === JSON.stringify({ reverted: 1 }),
    JSON.stringify({ lanes: reverted.overall.lanes, superseded: reverted.excluded.supersededOutcomeRows }));

  // --- an unreadable ownerPrompts is not zero attention. Flooring it would manufacture exactly the
  // number this reader exists to report.
  const unreadable = briefStats([
    outcome({ task: "t1", branch: "b1", disposition: "landed", prompts: null }),
    outcome({ task: "t2", branch: "b2", disposition: "landed", prompts: 0 }),
  ], receipts);
  check("briefstats: a landed lane with no readable ownerPrompts leaves BOTH sides of the rate, and is counted",
    row(unreadable, "compiled")?.landed === 1 && row(unreadable, "compiled")?.zeroPrompt === 1
      && row(unreadable, "compiled")?.zeroPromptRate === 1
      && row(unreadable, "compiled")?.promptsUnreadable === 1
      && row(unreadable, "compiled")?.lanes === 2,
    JSON.stringify(row(unreadable, "compiled")));

  // --- a rate with no denominator is null, never 0. An origin with lanes but no land has an
  // unknown zero-prompt rate, and "0%" there would read as "it always costs attention".
  const noLand = briefStats([outcome({ task: "t1", branch: "b1", disposition: "shelved" })], receipts);
  check("briefstats: an origin that never landed has a NULL zero-prompt rate, not 0",
    row(noLand, "compiled")?.landed === 0 && row(noLand, "compiled")?.zeroPromptRate === null
      && row(noLand, "compiled")?.emptyRate === 0,
    JSON.stringify(row(noLand, "compiled")));
  const empty = briefStats([], []);
  check("briefstats: empty ledgers produce null rates and zero rows, never a 0% claim",
    empty.overall.emptyRate === null && empty.overall.zeroPromptRate === null
      && empty.overall.excludingClarify.emptyRate === null && empty.sources.length === 0,
    JSON.stringify(empty.overall));

  // --- the join, and what the two briefHashes say about it. Same task, same branch name, twice:
  // briefHash is the exact second key (both sides hash the delivered bytes through one function).
  const twice = briefStats(
    [outcome({ task: "t1", branch: "b1", disposition: "landed", prompts: 0, hash: "hh-2" })],
    [receipt({ task: "t1", branch: "b1", hash: "hh-1", source: "raw" }),
      receipt({ task: "t1", branch: "b1", hash: "hh-2", source: "compiled" })]);
  check("briefstats: two receipts on one key are disambiguated by briefHash, and the join says so",
    twice.join.disambiguatedByHash === 1 && twice.join.byTaskBranch === 0
      && twice.join.hashConfirmed === 1 && row(twice, "compiled")?.lanes === 1,
    JSON.stringify(twice.join));
  const ambiguous = briefStats(
    [outcome({ task: "t1", branch: "b1", disposition: "landed", prompts: 0, hash: "hh-9" })],
    [receipt({ task: "t1", branch: "b1", hash: "hh-1", source: "raw" }),
      receipt({ task: "t1", branch: "b1", hash: "hh-2", source: "compiled" })]);
  check("briefstats: when briefHash picks neither, the lane is EXCLUDED — a guess here would be a finding",
    ambiguous.excluded.ambiguous === 1 && ambiguous.overall.lanes === 0, JSON.stringify(ambiguous.excluded));
  const mismatch = briefStats(
    [outcome({ task: "t1", branch: "b1", disposition: "landed", prompts: 0, hash: "hh-other" })], receipts);
  check("briefstats: a single-candidate join with disagreeing hashes is kept AND the disagreement reported",
    mismatch.join.byTaskBranch === 1 && mismatch.join.hashMismatch === 1
      && mismatch.join.hashConfirmed === 0 && mismatch.overall.lanes === 1,
    JSON.stringify(mismatch.join));

  // --- THE FUNNEL IS EXHAUSTIVE: every row of the outcome file lands in exactly one bucket. This
  // is the check that makes every exclusion above trustworthy — a bucket that silently ate a row
  // would leave the sum short, and a row counted twice would leave it long.
  const funnel: OutcomeRecord[] = [
    outcome({ task: "t1", branch: "b1", disposition: "landed", prompts: 0 }),        // counted
    outcome({ task: "t6", branch: "b6", disposition: "killed-empty" }),              // counted (clarify)
    outcome({ branch: "bx", disposition: "landed" }),                                // noTaskId
    outcome({ task: "t1", branch: null, disposition: "landed" }),                    // noBranch
    outcome({ task: "tZ", branch: "bZ", disposition: "landed" }),                    // noReceipt
    outcome({ task: "t1", branch: "b1", disposition: "reverted", ts: 999 }),         // supersedes the first
    { origin: "main-direct", ts: 1 } as OutcomeRecord,                               // out of scope
    { ts: 5, disposition: "not-a-disposition" } as OutcomeRecord,                    // malformed
  ];
  const f = briefStats(funnel, receipts, { outcomesMalformed: 2 });
  check("briefstats: every outcome row lands in exactly one bucket — the funnel sums back to the row count",
    accounted(f) === funnel.length + 2, // +2 = the caller's own unparseable lines, carried through
    JSON.stringify({ accounted: accounted(f), rows: funnel.length, s: f }));

  // --- (d) ROTATION. appendEvent renames the file at AUDIT_ROTATE_BYTES and starts a fresh one, so
  // a single-file reader answers from a truncated ledger with NO error — the ledger looks young
  // rather than cut in half. `.1` is the OLDER generation, so that order is chronological.
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  const outFile = `${TMP}/lane-outcomes.jsonl`;
  const recFile = `${TMP}/context-receipts.jsonl`;
  writeFileSync(`${outFile}.1`, `${JSON.stringify(outcome({ task: "t1", branch: "b1", disposition: "killed-empty" }))}\n`
    + "{torn mid-append line\n");
  writeFileSync(outFile, `${JSON.stringify(outcome({ task: "t2", branch: "b2", disposition: "landed", prompts: 0 }))}\n`);
  writeFileSync(recFile, receipts.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const read = await readJsonl<OutcomeRecord>(outFile);
  check("briefstats: the file reader is rotation-aware — the .1 generation is read FIRST and a torn line is a hole",
    read.rows.length === 2 && read.malformed === 1 && read.rows[0]?.taskId === "t1" && read.rows[1]?.taskId === "t2",
    JSON.stringify({ rows: read.rows.length, malformed: read.malformed, first: read.rows[0]?.taskId }));
  const rotated = briefStats(read.rows, receipts, { outcomesMalformed: read.malformed });
  check("briefstats: the rotated-away generation is IN the rates — dropping it would halve the denominator",
    rotated.overall.lanes === 2 && rotated.overall.killedEmpty === 1 && rotated.outOfScope.malformed === 1,
    JSON.stringify(rotated.overall));

  // --- (d2) THE ARCHIVE STEP. Rotation appends the OUTGOING .1 to x.jsonl.archive BEFORE the
  // rename, so no generation is ever overwritten out of existence (S1, 2026-09-15: audit.jsonl.1
  // held 2026-07-21..09-07 and the next rotation was ~1.4 days from destroying it). The threshold
  // here is the module's own AUDIT_ROTATE_BYTES, and EVERY event line carries a threshold-sized
  // pad, so each append finds the file already over threshold and the check stays valid whatever
  // env the runner was given. The three rotations below, as a table:
  //   t | event                           | exclusive owner of the bytes after it
  //   0 | seed SA (≥ threshold) planted   | x=SA
  //   1 | E1 appended → size ≥ threshold  | .1=SA            x=E1  (1st rotation: no .1, nothing archived)
  //   2 | E2 appended → rotate            | archive=SA   .1=E1   x=E2
  //   3 | E3 appended → rotate            | archive=SA,E1  .1=E2   x=E3
  const big = (tag: string) => `${tag}${"x".repeat(AUDIT_ROTATE_BYTES)}\n`;
  // ONE builder for the event shape — the same ev(n) goes into appendEvent and into the expected
  // bytes, so the expectation cannot drift from what was actually written.
  const ev = (n: number) => ({ n, p: "x".repeat(AUDIT_ROTATE_BYTES) });
  const lineOf = (n: number) => `${JSON.stringify(ev(n))}\n`;
  // a subdirectory of TMP, never TMP itself: the CLI checks at the tail of this module still read
  // the (d) fixtures, so wiping TMP here would turn those green checks red.
  const rotDir = `${TMP}/rot`;
  rmSync(rotDir, { recursive: true, force: true });
  mkdirSync(rotDir, { recursive: true });
  const archFile = `${rotDir}/rot-archived.jsonl`;
  const seedA = big("seedA-");
  writeFileSync(archFile, seedA);
  await appendEvent(archFile, ev(1));
  await appendEvent(archFile, ev(2));
  await appendEvent(archFile, ev(3));
  // an ABSENT archive is a FAIL with a name, never a crash: the mutation probe (rotation without
  // the archive step) must kill exactly these checks, not the rest of the shard's run().
  const archivePath = `${archFile}.archive`;
  const gens = (existsSync(archivePath) ? readFileSync(archivePath, "utf8") : "<archive absent>")
    + readFileSync(`${archFile}.1`, "utf8") + readFileSync(archFile, "utf8");
  const wantA = seedA + lineOf(1) + lineOf(2) + lineOf(3);
  check("briefstats: after three rotations archive + .1 + live file hold every written line exactly once, in order",
    gens === wantA, JSON.stringify({ got: gens.length, want: wantA.length, archiveAbsent: !existsSync(archivePath) }));
  check("briefstats: the archive is written 0600 like the ledgers it extends",
    existsSync(archivePath) && (statSync(archivePath).mode & 0o777) === 0o600,
    `mode=${existsSync(archivePath) ? (statSync(archivePath).mode & 0o777).toString(8) : "absent"}`);

  // The failure half: an archive path that cannot take appends (here: a directory, EISDIR) must
  // abort the ROTATION, never lose the event — the .1 is the last copy of that generation until
  // the archive has taken it.
  const failFile = `${rotDir}/arch-unwritable.jsonl`;
  const seedB = big("seedB-");
  const wantB = `${JSON.stringify({ n: 9 })}\n`; // small line: after the aborted rotation no second one is attempted
  writeFileSync(failFile, seedB);
  writeFileSync(`${failFile}.1`, "old-generation\n");
  mkdirSync(`${failFile}.archive`);
  await appendEvent(failFile, { n: 9 });
  check("briefstats: an unwritable archive aborts the rotation — the .1 generation is untouched",
    readFileSync(`${failFile}.1`, "utf8") === "old-generation\n",
    JSON.stringify({ one: readFileSync(`${failFile}.1`, "utf8").slice(0, 40) }));
  check("briefstats: with the rotation aborted the event still lands in the live file",
    readFileSync(failFile, "utf8") === seedB + wantB,
    JSON.stringify({ live: readFileSync(failFile, "utf8").length, want: (seedB + wantB).length }));

  // --- (p) THE PACK × VERSION ROWS: the unit a pack-quality question is asked in. One lane books
  // each delivered pack once; two versions of one pack are two rows; a receipt that names no packs
  // is counted beside the rows, never folded into an "unversioned" bucket — "not stated" and
  // "delivered without a hash" are different facts.
  const packReceipts: ReceiptRecord[] = [
    receipt({ task: "p1", branch: "pb1", source: "compiled",
      selected: [{ id: "verify-e2e", sourceHash: "v1" }, { id: "portable-core", sourceHash: "c1" }] }),
    receipt({ task: "p2", branch: "pb2", source: "compiled",
      selected: [{ id: "verify-e2e", sourceHash: "v1" }, { id: "verify-e2e", sourceHash: "v1" }] }),
    receipt({ task: "p3", branch: "pb3", source: "raw",
      selected: [{ id: "verify-e2e", sourceHash: "v2" }, { id: "rulebook-generat" }, { notAnId: 1 }] }),
    receipt({ task: "p4", branch: "pb4", source: "raw" }),
  ];
  const packOutcomes: OutcomeRecord[] = [
    outcome({ task: "p1", branch: "pb1", disposition: "landed", prompts: 0 }),
    outcome({ task: "p2", branch: "pb2", disposition: "killed-empty" }),
    outcome({ task: "p3", branch: "pb3", disposition: "landed", prompts: 2 }),
    outcome({ task: "p4", branch: "pb4", disposition: "landed", prompts: 0 }),
  ];
  const packs = briefStats(packOutcomes, packReceipts);
  const packRow = (id: string, hash: string | null) => packs.packs.find((p) => p.id === id && p.sourceHash === hash);
  const v1 = packRow("verify-e2e", "v1"), v2 = packRow("verify-e2e", "v2");
  const core = packRow("portable-core", "c1"), unversioned = packRow("rulebook-generat", null);
  check("briefstats: a pack is booked per SOURCE VERSION — two hashes of one id are two rows with their own denominators",
    v1?.lanes === 2 && v1.killedEmpty === 1 && v1.emptyRate === 0.5 && v1.landed === 1 && v1.zeroPrompt === 1
      && v2?.lanes === 1 && v2.killedEmpty === 0 && v2.landed === 1 && v2.zeroPrompt === 0 && v2.zeroPromptRate === 0,
    JSON.stringify(packs.packs));
  check("briefstats: one lane books one pack once, however often the receipt repeats the row, and an entry without an id books nothing",
    v1?.lanes === 2 && core?.lanes === 1 && packs.packs.length === 4, JSON.stringify(packs.packs));
  check("briefstats: a pack delivered without a hash is its own `unversioned` row; a receipt naming no packs is counted beside the rows",
    unversioned?.lanes === 1 && unversioned.sourceHash === null
      && packs.packJoin.lanes === 3 && packs.packJoin.lanesWithoutSelected === 1
      && packs.receipts.noSelected === 1 && packs.overall.lanes === 4,
    JSON.stringify({ packJoin: packs.packJoin, receipts: packs.receipts }));
  check("briefstats: the pack rows sit beside the brief-origin rates and change none of them",
    packs.overall.lanes === 4 && row(packs, "compiled")?.lanes === 2 && row(packs, "raw")?.lanes === 2
      && packs.overall.killedEmpty === 1 && packs.overall.zeroPrompt === 2,
    JSON.stringify(packs.sources));

  // --- the CLI half, spawned as the operator runs it: argv → the rotation-aware read → the reader.
  const cli = Bun.spawnSync(["bun", `${ROOT}/briefstats.ts`, outFile, recFile, "--json"], { cwd: ROOT });
  let parsed: BriefStatsSummary | null = null;
  try { parsed = JSON.parse(cli.stdout.toString()) as BriefStatsSummary; } catch { /* reported below */ }
  check("bun briefstats.ts <outcomes> <receipts> --json prints the same summary the reader computed",
    cli.exitCode === 0 && parsed?.overall.lanes === 2 && parsed.overall.killedEmpty === 1
      && parsed.outOfScope.malformed === 1,
    `exit=${cli.exitCode} ${cli.stdout.toString().slice(0, 200)}${cli.stderr.toString().slice(0, 200)}`);
  const table = Bun.spawnSync(["bun", `${ROOT}/briefstats.ts`, outFile, recFile], { cwd: ROOT });
  check("bun briefstats.ts prints every rate as numerator/denominator, never as a bare percentage",
    table.exitCode === 0 && /1\/2 = 50%/.test(table.stdout.toString())
      && /1\/1 = 100%/.test(table.stdout.toString()),
    table.stdout.toString().slice(0, 400));
  // an absent ledger is UNKNOWN, not empty — a zero-lane table off a path that does not exist is
  // the exact shape of a wrong all-clear (state.sh: "absent (not the same as none)").
  const missing = Bun.spawnSync(["bun", `${ROOT}/briefstats.ts`, `${TMP}/nope.jsonl`, recFile], { cwd: ROOT });
  check("bun briefstats.ts refuses an absent ledger as UNKNOWN instead of printing an empty table",
    missing.exitCode === 2 && /does not exist/.test(missing.stderr.toString())
      && missing.stdout.toString().trim() === "",
    `exit=${missing.exitCode} ${missing.stderr.toString().slice(0, 200)}`);
  rmSync(TMP, { recursive: true, force: true }); // the fixture leaves nothing behind
}
