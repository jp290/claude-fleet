// e2e for the OPT-IN clean-path advisory reviewer (server.ts runCleanReview + the mergeJob clean+green
// hook). The MAIN suite runs with FLEET_CLEAN_REVIEW unset (default OFF) and thus proves the untouched
// auto-land; THIS harness boots with the flag ON + a stand-in reviewer and proves the ON behaviour:
// a "review" verdict downgrades a clean+green auto-land to a stop-and-review, "ok" lets it land, and a
// BROKEN reviewer fails CLOSED (stops, never lands). Run via ./e2e-clean-review.sh — never a live fleet.
// The same file runs a second time under FLEET_CR_PHASE=shadow against a server booted with
// FLEET_CLEAN_REVIEW=shadow: there the reviewer is POWERLESS — every verdict lands and is only
// RECORDED on the lane's outcome row (`cleanReviewShadow`).
import { spawnSync } from "node:child_process";
const IP = "127.0.0.1";
const PORT = Number(process.env.FLEET_PORT ?? 8790);
const SOCK = process.env.FLEET_SOCK ?? "fleetcrtest";
if (SOCK === "claudefleet") throw new Error("refusing to run against the live socket");
const BASE = `http://${IP}:${PORT}`;
const results: string[] = [];
let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
}

const stateFile = (await Bun.file(`${import.meta.dir}/fleet.json`).json()) as { token?: string };
const TOKEN = stateFile.token ?? "";
const H = { "content-type": "application/json", authorization: `Bearer ${TOKEN}` };
const post = (path: string, body: unknown): Promise<Response> =>
  fetch(BASE + path, { method: "POST", headers: H, body: JSON.stringify(body) });
const get = (path: string): Promise<Response> => fetch(BASE + path, { headers: H });

type MergeVerdict = { status: string; detail: string; landed: boolean; cleanReview?: { verdict: string; reason: string } };
const WAIT_MS = 60_000;
const STEP = 100;
const waitMerge = async (slot: number): Promise<{ gone: boolean; last: MergeVerdict | null }> => {
  for (let i = 0; i < Math.ceil(WAIT_MS / STEP); i++) {
    const r = await get(`/api/slots/${slot}/merge`);
    if (r.status === 400) return { gone: true, last: null }; // slot torn down = the lane LANDED
    const j = (await r.json()) as { running: boolean; last: MergeVerdict | null };
    // settle ONLY on a real verdict: !running with a null last means the job hasn't produced one yet
    // (started/recorded lag), not "done" — keep polling rather than returning a spurious null.
    if (!j.running && j.last !== null) return { gone: false, last: j.last };
    await Bun.sleep(STEP);
  }
  throw new Error(`waitMerge timed out for slot ${slot} — merge job never settled`);
};
const settleForMerge = async (slot: number): Promise<void> => {
  for (let i = 0; i < 80; i++) {
    const sx = (await (await get("/api/sessions")).json()) as { now: number; slots: { id: number; lastOutput: number }[] };
    const sl = sx.slots.find((x) => x.id === slot);
    if (sl && sx.now - sl.lastOutput >= 3000) return;
    await Bun.sleep(150);
  }
};
const setReviewMode = (m: string): Promise<number> => Bun.write(`${import.meta.dir}/cleanreviewmode`, m);
const mainLog = (): string => spawnSync("git", ["-C", REPO, "log", "--oneline", "-6"]).stdout.toString();

// throwaway repo the lanes fork from
const REPO = `${import.meta.dir}/testrepo`;
spawnSync("git", ["init", "-q", "-b", "main", REPO]);
spawnSync("git", ["-C", REPO, "config", "user.email", "t@t"]);
spawnSync("git", ["-C", REPO, "config", "user.name", "t"]);
spawnSync("git", ["-C", REPO, "config", "commit.gpgsign", "false"]);
await Bun.write(`${REPO}/seed.txt`, "seed\n");
spawnSync("git", ["-C", REPO, "add", "seed.txt"]);
spawnSync("git", ["-C", REPO, "commit", "-qm", "seed"]);

// create a lane that rebases CLEANLY (its own file → no conflict, the merge agent is never consulted),
// commit its work, drive its merge, return the settled verdict. This is exactly the clean+green
// auto-land path the reviewer guards.
type Lane = { slot: number; cwd: string; branch: string };
// open a lane, optionally give it an owner BRIEF (logged to the prompt journal — what ② is told the
// lane was asked to do), and commit one file so it has real in-flight work.
const openLane = async (name: string, brief?: string): Promise<Lane> => {
  const ln = (await (await post("/api/lanes", { repo: REPO })).json()) as Lane;
  // the brief is logged as an OWNER prompt regardless of pane readiness (same route e2e/outcomes.ts
  // uses) — reported as its own check rather than thrown, so a send failure names itself instead of
  // taking the rest of the suite down with an unhandled rejection
  if (brief) {
    const sent = await post("/send", { slot: ln.slot, text: brief });
    check(`the owner brief for lane ${name} is accepted (and journalled)`, sent.ok, `${sent.status} ${await sent.text()}`);
  }
  await Bun.write(`${ln.cwd}/${name}.txt`, `${name} work\n`);
  spawnSync("git", ["-C", ln.cwd, "add", `${name}.txt`]);
  // a freshly-created lane worktree can briefly hold a git index lock (fleet's tickGit polls it right
  // after `git worktree add`), so the FIRST commit can silently fail. Retry until it is actually in the
  // log — otherwise the lane has no commit and the merge handler treats it as already-at-main.
  for (let i = 0; i < 12; i++) {
    spawnSync("git", ["-C", ln.cwd, "commit", "-qm", `${name} lane work`]);
    if (spawnSync("git", ["-C", ln.cwd, "log", "--oneline", "-1"]).stdout.toString().includes(`${name} lane work`)) break;
    await Bun.sleep(300);
  }
  return ln;
};
const driveMerge = async (ln: Lane, name: string): Promise<{ gone: boolean; last: MergeVerdict | null; branch: string }> => {
  // the idle gate can refuse the FIRST merge attempt on a freshly-spawned pane — retry until the job
  // actually starts (running) or the slot is gone (landed) or a verdict appears, so waitMerge never
  // reads a never-started merge as a null verdict.
  for (let attempt = 0; attempt < 8; attempt++) {
    await settleForMerge(ln.slot);
    const m = await post(`/api/slots/${ln.slot}/merge`, {});
    if (!m.ok) console.error(`[${name}] merge POST attempt ${attempt}: ${m.status} ${(await m.clone().text()).slice(0, 200)}`);
    const r = await get(`/api/slots/${ln.slot}/merge`);
    if (r.status === 400) break; // already landed
    const j = (await r.json()) as { running: boolean; last: MergeVerdict | null };
    if (j.running || j.last !== null) break; // job started (or already settled)
    await Bun.sleep(800);
  }
  return { ...(await waitMerge(ln.slot)), branch: ln.branch };
};
const cleanLaneMerge = async (name: string): Promise<{ gone: boolean; last: MergeVerdict | null; branch: string }> =>
  driveMerge(await openLane(name), name);

// the lane's outcome row (lane-outcomes.jsonl via the owner-only read endpoint), looked up by the
// lane's branch — the shadow verdict's only home.
type ShadowRow = { verdict: string | null; at: number; model: string; notes: string; raw: boolean;
  rawAnswer?: string };
// mirrors server.ts SHADOW_RAW_ANSWER_MAX — the cap on the persisted copy of a contract-missing answer
const RAW_ANSWER_MAX = 2000;
type OutcomeRow = { branch: string | null; disposition: string; cleanReviewShadow?: ShadowRow };
const outcomeFor = async (branch: string): Promise<OutcomeRow | null> => {
  const j = (await (await get("/api/lane-outcomes?limit=300")).json()) as { outcomes: OutcomeRow[] };
  return j.outcomes.find((o) => o.branch === branch) ?? null;
};

const PHASE = process.env.FLEET_CR_PHASE ?? "gate";
if (PHASE === "shadow") {
  // ---- SHADOW PHASE (server booted with FLEET_CLEAN_REVIEW=shadow) ----
  // (D) the assertion that matters most: a "would_stop" verdict must NOT gate. The land happens
  // exactly as if ② were off, and the verdict is recorded on the outcome row instead.
  await setReviewMode("review");
  const D = await cleanLaneMerge("delta");
  const dRow = await outcomeFor(D.branch);
  check("shadow: a would_stop verdict does NOT gate — the clean lane still auto-lands", D.gone, JSON.stringify(D));
  check("shadow: the would_stop lane's commit DID reach main", mainLog().includes("delta lane work"), mainLog());
  check("shadow: the would_stop verdict is recorded on the outcome row",
    dRow?.disposition === "landed" && dRow.cleanReviewShadow?.verdict === "would_stop"
      && dRow.cleanReviewShadow.raw === false && dRow.cleanReviewShadow.notes.length > 0
      && dRow.cleanReviewShadow.at > 0 && typeof dRow.cleanReviewShadow.model === "string",
    JSON.stringify(dRow?.cleanReviewShadow));

  // (E) an "ok" verdict lands (as it would anyway) and is recorded as a pass.
  await setReviewMode("ok");
  const E = await cleanLaneMerge("echo");
  const eRow = await outcomeFor(E.branch);
  check("shadow: an ok verdict lands", E.gone && mainLog().includes("echo lane work"), JSON.stringify(E));
  check("shadow: the ok verdict is recorded as verdict:'pass', raw:false",
    eRow?.cleanReviewShadow?.verdict === "pass" && eRow.cleanReviewShadow.raw === false,
    JSON.stringify(eRow?.cleanReviewShadow));
  // a healthy row keeps its old shape exactly — the raw-answer copy is failure bookkeeping, not bloat
  check("shadow: a raw:false row carries NO rawAnswer field at all",
    eRow?.cleanReviewShadow !== undefined && !("rawAnswer" in eRow.cleanReviewShadow),
    JSON.stringify(eRow?.cleanReviewShadow));

  // (F) fail direction INVERTED vs gate mode: nothing is gated, so a broken reviewer is a FAILED
  // MEASUREMENT (verdict null, raw true) — never a fabricated pass, and never a stop either.
  await setReviewMode("garbage");
  const F = await cleanLaneMerge("foxtrot");
  const fRow = await outcomeFor(F.branch);
  check("shadow: a broken reviewer still lands (shadow gates nothing)",
    F.gone && mainLog().includes("foxtrot lane work"), JSON.stringify(F));
  check("shadow: a broken reviewer records verdict:null + raw:true, NOT a pass",
    fRow?.cleanReviewShadow !== undefined && fRow.cleanReviewShadow.verdict === null
      && fRow.cleanReviewShadow.raw === true,
    JSON.stringify(fRow?.cleanReviewShadow));
  // …and the answer it failed on is persisted, so the contract-miss is diagnosable from the journal
  // alone (both real production shadow verdicts were raw:true and left only a generic note behind).
  check("shadow: a broken reviewer persists the raw answer text it failed to parse",
    fRow?.cleanReviewShadow?.rawAnswer === "not json at all — exercises the server fail-closed path",
    JSON.stringify(fRow?.cleanReviewShadow?.rawAnswer));

  // (G) an over-long non-JSON answer is persisted TRUNCATED — one bad run can't bloat the journal.
  await setReviewMode("flood");
  const G = await cleanLaneMerge("golf");
  const gRow = await outcomeFor(G.branch);
  check("shadow: an over-long raw answer is truncated at the cap",
    gRow?.cleanReviewShadow?.rawAnswer?.length === RAW_ANSWER_MAX
      && /^X+$/.test(gRow.cleanReviewShadow.rawAnswer ?? ""),
    `${gRow?.cleanReviewShadow?.rawAnswer?.length}`);

  // (H) NO answer at all (spawn failure / timeout): the field is PRESENT and EMPTY. "the reviewer
  // said nothing" and "the reviewer said the wrong thing" must stay distinguishable in the journal.
  await setReviewMode("silent");
  const H = await cleanLaneMerge("hotel");
  const hRow = await outcomeFor(H.branch);
  check("shadow: a reviewer that answers nothing still lands and records a failed measurement",
    H.gone && mainLog().includes("hotel lane work") && hRow?.cleanReviewShadow?.verdict === null
      && hRow.cleanReviewShadow.raw === true, JSON.stringify(hRow?.cleanReviewShadow));
  check("shadow: an empty answer records rawAnswer PRESENT and empty — not absent",
    hRow?.cleanReviewShadow !== undefined && "rawAnswer" in hRow.cleanReviewShadow
      && hRow.cleanReviewShadow.rawAnswer === "",
    JSON.stringify(hRow?.cleanReviewShadow));

  // (I)+(J) the production shape: a valid verdict object wrapped in a prose preamble. The parser
  // extracts it, so the run is a REAL measurement (raw:false) with the model's own verdict — the
  // 5-of-6 `raw: true` production rows were a parser giving up, not a model missing the contract.
  await setReviewMode("proseok");
  const I = await cleanLaneMerge("kilo");
  const iRow = await outcomeFor(I.branch);
  check("shadow: a prose-wrapped ok is rescued — verdict:'pass', raw:false, no rawAnswer",
    iRow?.cleanReviewShadow?.verdict === "pass" && iRow.cleanReviewShadow.raw === false
      && !("rawAnswer" in iRow.cleanReviewShadow)
      && iRow.cleanReviewShadow.notes === "no second side to collide with",
    JSON.stringify(iRow?.cleanReviewShadow));

  await setReviewMode("prosereview");
  const J = await cleanLaneMerge("lima");
  const jRow = await outcomeFor(J.branch);
  check("shadow: a prose-wrapped review is rescued — verdict:'would_stop', raw:false",
    jRow?.cleanReviewShadow?.verdict === "would_stop" && jRow.cleanReviewShadow.raw === false
      && jRow.cleanReviewShadow.notes === "lane deletes a helper main still calls",
    JSON.stringify(jRow?.cleanReviewShadow));

  // (K) extraction rescues a WELL-FORMED answer only: an object that carries a verdict value outside
  // the contract stays a failed measurement, exactly as before — the fail-closed floor is unmoved.
  await setReviewMode("prosejunk");
  const K = await cleanLaneMerge("mike");
  const kRow = await outcomeFor(K.branch);
  check("shadow: a prose-wrapped object with a junk verdict is still verdict:null + raw:true",
    kRow?.cleanReviewShadow?.verdict === null && kRow.cleanReviewShadow.raw === true
      && (kRow.cleanReviewShadow.rawAnswer ?? "").includes('"maybe"'),
    JSON.stringify(kRow?.cleanReviewShadow));

  console.log(results.join("\n"));
  console.log(failed ? `\n${failed} FAILURES` : "\nALL PASS");
  process.exit(failed ? 1 : 0);
}

// ---- GATE PHASE (server booted with FLEET_CLEAN_REVIEW=1) ----
// (A) reviewer "review" → the clean+green auto-land is DOWNGRADED to a stop-and-review, NOT landed.
await setReviewMode("review");
const A = await cleanLaneMerge("alpha");
check("reviewer 'review' downgrades a clean+green auto-land to a stop (resolved, not landed)",
  !A.gone && A.last?.status === "resolved" && A.last?.landed === false && A.last?.cleanReview?.verdict === "review",
  JSON.stringify(A.last));
check("the downgraded lane's commit did NOT reach main", !mainLog().includes("alpha lane work"), mainLog());

// (B) reviewer "ok" → the clean+green lane AUTO-LANDS (slot torn down, commit on main).
await setReviewMode("ok");
const B = await cleanLaneMerge("bravo");
check("reviewer 'ok' lets a clean+green lane auto-land (slot torn down)", B.gone, JSON.stringify(B));
check("the ok'd lane's commit reached main", mainLog().includes("bravo lane work"), mainLog());
// gate mode records no shadow verdict — the two modes' records must not blur into each other
const bRow = await outcomeFor(B.branch);
check("gate mode writes NO cleanReviewShadow on the landed row",
  bRow?.disposition === "landed" && bRow.cleanReviewShadow === undefined, JSON.stringify(bRow));

// (B2) the production answer shape — a valid {"verdict":"ok"} behind a prose preamble — reaches the
// GATE's land decision too: it is an explicit ok, so it lands, instead of being discarded as garbage.
await setReviewMode("proseok");
const B2 = await cleanLaneMerge("india");
check("gate: a prose-wrapped ok verdict is rescued and lets the lane auto-land",
  B2.gone && mainLog().includes("india lane work"), JSON.stringify(B2));

// (B3) THE ENRICHED PROMPT, END-TO-END (docs/mining-2026-07-26.md findings 3+4). e2e/prompts.ts proves
// the builder RENDERS the three sections; only the server can prove it FILLS them from reality. Set up
// so the non-degenerate case is the one under test: the reviewed lane forks FIRST, another lane lands
// after it (so main genuinely moved since the fork), and a sibling lane stays open with work in flight.
{
  await setReviewMode("ok");
  const BRIEF = "brief for the reviewed lane: keep the change inside sierra.txt";
  const reviewed = await openLane("sierra", BRIEF);          // forks from main HERE
  const sibling = await openLane("tango");                   // stays OPEN — the concurrent-lane picture
  const moved = await cleanLaneMerge("uniform");             // lands → main moves PAST sierra's fork
  check("enrichment setup: a second lane landed, so main really moved since the reviewed lane forked",
    moved.gone && mainLog().includes("uniform lane work"), mainLog());
  const R = await driveMerge(reviewed, "sierra");
  check("enrichment setup: the reviewed lane still auto-lands (the prompt change gates nothing)",
    R.gone, JSON.stringify(R.last));
  const p = await Bun.file(`${import.meta.dir}/lastcleanreviewprompt`).text();
  const ds = p.indexOf("<<<DATA"), de = p.indexOf("DATA>>>");
  // 1. the fork fact is COMPUTED and TRUE. Before this change the server asked git for `base..main`
  //    with `base` a branch NAME equal to `main` — literally `main..main`, empty for every lane ever,
  //    which is why every recorded shadow verdict argued "main gained zero commits since the fork".
  //    Here main demonstrably gained one, so a "0 commits / SETTLED" prompt is a regression, not a pass.
  check("enrichment: the prompt states main's REAL commit count since the fork (1), not a hard-wired 0",
    p.includes("GIT-COMPUTED FACT: main gained 1 commit since this lane forked")
    && !p.includes("SETTLED BY CONSTRUCTION"),
    p.split("\n").find((l) => l.startsWith("GIT-COMPUTED FACT")) ?? "(no fact line)");
  check("enrichment: main's new commit is carried in the DATA block (the second side is visible at all)",
    p.indexOf("uniform lane work") > ds && p.indexOf("uniform lane work") < de,
    `data[${ds},${de}] idx=${p.indexOf("uniform lane work")}`);
  // 2. the lane's brief travels from the prompt journal into the DATA block
  check("enrichment: the lane's owner brief reaches the prompt, inside the injection-safe DATA block",
    p.indexOf(BRIEF) > ds && p.indexOf(BRIEF) < de && p.includes("what this lane was ASKED to do"),
    `data[${ds},${de}] idx=${p.indexOf(BRIEF)}`);
  // 3. the concurrent-lane picture is real (branch + in-flight file) and EXCLUDES the reviewed lane
  const sect = p.slice(p.indexOf("other lanes currently open on this repo"), de);
  check("enrichment: the sibling lane's branch + in-flight files are listed, and the reviewed lane is not",
    sect.includes(sibling.branch) && sect.includes("tango.txt") && !sect.includes(reviewed.branch),
    sect.slice(0, 300));
  await post(`/api/slots/${sibling.slot}/kill`, {}); // leave the fleet as this section found it
}

// (C) a BROKEN reviewer (non-JSON) → FAIL CLOSED: the auto-land is stopped, never landed. This is the
// safety property under reviewer failure — a bug can only ever cost a click, never land something unseen.
await setReviewMode("garbage");
const C = await cleanLaneMerge("charlie");
check("a broken reviewer FAILS CLOSED — clean+green land is stopped, not landed",
  !C.gone && C.last?.status === "resolved" && C.last?.landed === false && C.last?.cleanReview?.verdict === "review",
  JSON.stringify(C.last));
check("the fail-closed lane's commit did NOT reach main", !mainLog().includes("charlie lane work"), mainLog());

// (C2) the fail-closed floor under extraction: an extracted object whose verdict is outside the
// contract is NOT an explicit ok, so the gate still stops. `landed: true` stays reachable from
// {"verdict":"ok"} alone — extraction rescues well-formed answers, it never manufactures one.
await setReviewMode("prosejunk");
const C2 = await cleanLaneMerge("juliett");
check("gate: an extracted object with a junk verdict still FAILS CLOSED (not landed)",
  !C2.gone && C2.last?.status === "resolved" && C2.last?.landed === false
    && C2.last?.cleanReview?.verdict === "review", JSON.stringify(C2.last));
check("the junk-verdict lane's commit did NOT reach main", !mainLog().includes("juliett lane work"), mainLog());

console.log(results.join("\n"));
console.log(failed ? `\n${failed} FAILURES` : "\nALL PASS");
process.exit(failed ? 1 : 0);
