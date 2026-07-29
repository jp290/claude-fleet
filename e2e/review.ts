// The 🔍 review agent (owner click) and auto-③ (the server running it itself on a done-looking
// lane) — every guard rail asserted as a fact via the stand-in's per-cwd spawn log.
import { spawnSync } from "node:child_process";
import { BASE, REPO, check, get, post, reviewRunsFor, lastReviewPromptFor } from "./harness";
import type { Ctx } from "./ctx";

export async function run(ctx: Ctx): Promise<void> {
  // --- 🔍 review agent (FLEET_REVIEW_CMD points at a stand-in). Owner-only, click-only,
  // cached on the exact git state. The stand-in appends one line to ./reviewruns per spawn,
  // so "served from the cache" is checked as a FACT (no second spawn), not inferred from the
  // payload. Its answer is deliberately worst-last and carries one uncited claim — the server
  // must rank by impact and drop the finding that cites no line. ---
  {
    interface RvFinding { title: string; file: string; line: number | null; impact: string; cost: string; basis: string }
    const rv = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
    // spawns are counted FOR THIS LANE (the stand-in logs its cwd): auto-③ reviews other
    // done-looking lanes on its own schedule, so a global count would race
    const reviewRuns = (): number => reviewRunsFor(rv.cwd);
    // a lane with BOTH a committed change (base...HEAD) and uncommitted work — the review's scope
    await Bun.write(`${rv.cwd}/review-target.txt`, "line one\n");
    spawnSync("git", ["-C", rv.cwd, "add", "review-target.txt"]);
    spawnSync("git", ["-C", rv.cwd, "commit", "-qm", "lane change to review"]);
    await Bun.write(`${rv.cwd}/review-dirty.txt`, "uncommitted\n");
    const runs0 = reviewRuns();
    const rv0 = (await (await get(`/api/slots/${rv.slot}/review`)).json()) as { cached: boolean; findings?: unknown };
    check("review GET before any run → cache miss", rv0.cached === false && rv0.findings === undefined, JSON.stringify(rv0));
    check("review GET never spawns the agent", reviewRuns() === runs0, `${reviewRuns()} vs ${runs0}`);
    const rv1res = await post(`/api/slots/${rv.slot}/review`, {});
    const rv1 = (await rv1res.json()) as { findings: RvFinding[]; notes: string; scope: string;
      cached: boolean; raw: boolean; head: string | null };
    check("review POST returns findings through the stand-in",
      rv1res.ok && rv1.raw === false && rv1.cached === false, JSON.stringify(rv1).slice(0, 160));
    check("review spawned the agent exactly once", reviewRuns() === runs0 + 1, `${reviewRuns()} vs ${runs0}`);
    check("review ranks findings by impact, worst first",
      rv1.findings.map((f) => f.impact).join(",") === "high,low", JSON.stringify(rv1.findings.map((f) => f.impact)));
    check("review drops a finding that cites no line",
      rv1.findings.length === 2 && !rv1.findings.some((f) => f.title === "uncited claim"), JSON.stringify(rv1.findings));
    check("every finding cites file:line and states cost + basis",
      rv1.findings.every((f) => !!f.file && typeof f.line === "number" && !!f.cost
        && (f.basis === "verified" || f.basis === "inferred")), JSON.stringify(rv1.findings));
    check("review reports its scope and what it could not check",
      rv1.scope.includes("lane") && rv1.notes === "diff truncated", `${rv1.scope} | ${rv1.notes}`);
    check("review pins the git state it ran on", /^[0-9a-f]{40}$/.test(rv1.head ?? ""), String(rv1.head));
    const rv2 = (await (await post(`/api/slots/${rv.slot}/review`, {})).json()) as { cached: boolean; findings: RvFinding[] };
    check("second review POST on an unchanged tree is a cache hit",
      rv2.cached === true && rv2.findings.length === 2, JSON.stringify(rv2).slice(0, 120));
    check("cache hit served without a second spawn", reviewRuns() === runs0 + 1, `${reviewRuns()} vs ${runs0}`);
    const rv3 = (await (await get(`/api/slots/${rv.slot}/review`)).json()) as { cached: boolean; stale: boolean };
    check("review GET now serves the cache", rv3.cached === true && rv3.stale === false, JSON.stringify(rv3));
    // an inactive slot — derived, not hardcoded: by this point in the suite the low slot ids
    // are held by lanes the earlier blocks opened
    const idle = ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
      .slots.find((x) => x.cwd === null);
    check("review rejects an inactive slot",
      !!idle && (await post(`/api/slots/${idle.id}/review`, {})).status === 400, JSON.stringify(idle));
    // owner-only: the guest share surface has no review endpoint at all
    const gRev = await fetch(BASE + `/s/${ctx.shIntId}/review`, { headers: { cookie: ctx.shICookie } });
    check("guest share has no review endpoint", !gRev.ok && gRev.status !== 200, String(gRev.status));
    const gRevPost = await fetch(BASE + `/s/${ctx.shIntId}/review`, { method: "POST", headers: { cookie: ctx.shICookie } });
    check("guest share cannot POST a review either", !gRevPost.ok && gRevPost.status !== 200, String(gRevPost.status));
    // a recycled slot must never serve the previous session's review (a leaked entry would come
    // back as cached:true/stale:true on the new lane's first GET)
    await post(`/api/slots/${rv.slot}/kill`, {});
    const rvNew = await post(`/api/slots/${rv.slot}/open-worktree`, { repo: REPO, branch: "e2e-review-recycle" });
    const rvNewBody = await rvNew.text();
    check("recycled slot re-opens a fresh lane", rvNew.ok, rvNewBody);
    let rvNewCwd = "";
    try { rvNewCwd = (JSON.parse(rvNewBody) as { cwd?: string }).cwd ?? ""; } catch { /* asserted above */ }
    const rvAfter = (await (await get(`/api/slots/${rv.slot}/review`)).json()) as { cached: boolean; findings?: unknown };
    check("recycled slot does not serve the previous session's review",
      rvAfter.cached === false && rvAfter.findings === undefined, JSON.stringify(rvAfter));
    // a lane with nothing changed answers without spending a model call at all
    const rvEmpty = (await (await post(`/api/slots/${rv.slot}/review`, {})).json()) as { findings: RvFinding[]; notes: string };
    check("empty diff answers with no findings and no spawn",
      rvEmpty.findings.length === 0 && reviewRunsFor(rvNewCwd) === 0,
      `${JSON.stringify(rvEmpty.notes)} runs=${reviewRunsFor(rvNewCwd)}`);
    await post(`/api/slots/${rv.slot}/kill`, {});
  }

  // --- context delivery ("deliver context, not tools", 2026-07-29): the most-changed files that
  // existed BEFORE the lane touched them ride the prompt in full; everything the server declines
  // to include is NAMED. Asserted against the prompt the stand-in actually received — the only
  // place the built prompt is observable. Four cases, each a distinct guard:
  //   M ride-along · A excluded · symlink skipped unread (the .env canary) · oversize named. ---
  {
    const cx = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
    // M: modify the LAST line region of a 24-line seed file — line 1 is outside any diff context
    // window, so finding it in the prompt proves the FULL file rode, not just the hunks
    spawnSync("sh", ["-c", `echo ctxmod-appended >> '${cx.cwd}/ctx-mod.txt'`]);
    // A: lane-authored file — its whole story is already in the diff; must NOT ride as context
    await Bun.write(`${cx.cwd}/ctx-added.txt`, "brand new lane file\n");
    // T: replace a tracked file with a symlink at the lane's own copied-in .env — the guard must
    // see the symlink via lstat and skip it UNREAD, or the canary leaks into a displayable prompt
    spawnSync("sh", ["-c", `rm '${cx.cwd}/ctx-linked.txt' && ln -s '${cx.cwd}/.env' '${cx.cwd}/ctx-linked.txt'`]);
    // M but oversized (~36KB seed > REVIEW_CONTEXT_FILE_CAP): named, content absent
    spawnSync("sh", ["-c", `echo ctxbig-appended >> '${cx.cwd}/ctx-big.txt'`]);
    spawnSync("git", ["-C", cx.cwd, "add", "-A"]);
    spawnSync("git", ["-C", cx.cwd, "commit", "-qm", "context-delivery fixtures"]);
    const cxRes = await post(`/api/slots/${cx.slot}/review`, {});
    check("context: review runs on the fixture lane", cxRes.ok, String(cxRes.status));
    const p = lastReviewPromptFor(cx.cwd);
    check("context: the stand-in captured this lane's prompt", p.length > 0, `len=${p.length}`);
    check("context: a modified pre-existing file rides IN FULL — a line no diff hunk carries is present",
      p.includes("## full current files") && p.includes("ctx-mod.txt (") && p.includes("ctxmod-1\nctxmod-2"),
      p.slice(p.indexOf("## full current files"), p.indexOf("## full current files") + 200));
    check("context: a lane-authored file is NOT re-delivered as context",
      !p.includes("--- ctx-added.txt ("), "found a context block for the A-status file");
    check("context: a symlink is skipped unread — named, and the .env canary is absent",
      p.includes("ctx-linked.txt — omitted (symlink") && !p.includes("SECRET=1"),
      p.includes("SECRET=1") ? "CANARY LEAKED" : "no symlink omission marker");
    check("context: an oversized file is named, its content absent",
      p.includes("ctx-big.txt — omitted (too large") && !p.includes("ctxbig-2000"),
      p.slice(0, 0) || "marker or absence failed");
    check("context: the basis contract admits full-file grounding",
      p.includes("the diff or a provided full file"), "contract line missing");
    await post(`/api/slots/${cx.slot}/kill`, {});
  }

  // --- auto-③ (docs/perception-layer.md §4): the server runs the reviewer ITSELF on a lane that
  // has gone done-looking, so findings exist before the owner looks. Advisory: nothing reads the
  // result to decide anything. The guard rails are the design, so each is asserted as a FACT via
  // the stand-in's per-cwd spawn log — lanes only, never ⚙ steward, at most one spawn per git
  // state. The harness shrinks the idle gate (FLEET_AUTO_REVIEW_IDLE_MS) and the tick
  // (FLEET_AUTO_REVIEW_MS) so this is observable inside the suite's budget. ---
  {
    // (A) the subject: a lane that commits, then goes quiet — clean tree, ahead of its base
    const ar = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${ar.cwd}/auto-review.txt`, "work the server should review by itself\n");
    spawnSync("git", ["-C", ar.cwd, "add", "auto-review.txt"]);
    spawnSync("git", ["-C", ar.cwd, "commit", "-qm", "auto-review lane work"]);
    // (B) an identical lane wearing the ⚙ steward label — a planning pane's diff is not lane work
    const as = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
    await Bun.write(`${as.cwd}/steward-side.txt`, "planning pane, not lane work\n");
    spawnSync("git", ["-C", as.cwd, "add", "steward-side.txt"]);
    spawnSync("git", ["-C", as.cwd, "commit", "-qm", "steward-labelled lane work"]);
    await post(`/api/slots/${as.slot}/rename`, { label: "⚙ steward" });
    // (C) a NON-lane slot that otherwise satisfies every clause: a clone with an upstream, one
    // commit ahead, clean tree. No worktree → no lane diff to review, so ③ must never fire.
    const plainRepo = `${REPO}.autoplain`;
    spawnSync("git", ["clone", "-q", REPO, plainRepo]);
    spawnSync("git", ["-C", plainRepo, "config", "user.email", "t@t"]);
    spawnSync("git", ["-C", plainRepo, "config", "user.name", "t"]);
    await Bun.write(`${plainRepo}/plain.txt`, "ahead of origin\n");
    spawnSync("git", ["-C", plainRepo, "add", "plain.txt"]);
    spawnSync("git", ["-C", plainRepo, "commit", "-qm", "plain slot work"]);
    const freeSlot = ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
      .slots.find((x) => x.cwd === null);
    const openPlain = freeSlot ? await post(`/api/slots/${freeSlot.id}/open`, { cwd: plainRepo }) : null;
    check("auto-③ setup: a non-lane slot sits on a clean repo one commit ahead of its upstream",
      !!openPlain?.ok, `${freeSlot?.id} ${openPlain?.status}`);

    // the git fact cache refreshes on the 10s tickGit, so the first auto-③ can only land after it
    let arCached = false;
    for (let i = 0; i < 40 && !arCached; i++) {
      await Bun.sleep(1000);
      arCached = ((await (await get(`/api/slots/${ar.slot}/review`)).json()) as { cached: boolean }).cached === true;
    }
    check("auto-③ reviewed the done-looking lane with no owner click at all", arCached,
      `runs=${reviewRunsFor(ar.cwd)}`);
    check("auto-③ spawned the reviewer exactly once for that git state", reviewRunsFor(ar.cwd) === 1,
      String(reviewRunsFor(ar.cwd)));
    // the served predicate agrees with what the trigger did — same function, one source.
    // doneLooking rides on the steward view, which is steward-token-scoped (owner token → 403).
    const svTok = ((await (await get("/api/steward/token")).json()) as { token: string }).token;
    const sv = (await (await fetch(BASE + "/api/steward/sessions",
      { headers: { authorization: `Bearer ${svTok}` } })).json()) as
      { slots: { id: number; doneLooking: boolean; doneLookingSince: number | null }[] };
    const dl = (id: number): boolean | undefined => sv.slots.find((x) => x.id === id)?.doneLooking;
    const dls = (id: number): number | null | undefined => sv.slots.find((x) => x.id === id)?.doneLookingSince;
    check("done-looking is served as a fact: true for the lane, false for ⚙ steward and the non-lane slot",
      dl(ar.slot) === true && dl(as.slot) === false && dl(freeSlot?.id ?? -1) === false,
      JSON.stringify({ lane: dl(ar.slot), steward: dl(as.slot), plain: dl(freeSlot?.id ?? -1) }));
    // tier 2 rides alongside: a timestamp in the past for the lane the trigger fired on, null for
    // the slots the predicate does not classify at all
    check("done-looking-since is served next to it: a past timestamp for the lane, null for ⚙ steward / non-lane",
      typeof dls(ar.slot) === "number" && (dls(ar.slot) as number) <= Date.now()
      && dls(as.slot) === null && dls(freeSlot?.id ?? -1) === null,
      JSON.stringify({ lane: dls(ar.slot), steward: dls(as.slot), plain: dls(freeSlot?.id ?? -1) }));
    // several more ticks on an UNCHANGED tree: the cache key, not a timer, decides
    await Bun.sleep(5000);
    check("auto-③ does not spawn again while the git state is unchanged", reviewRunsFor(ar.cwd) === 1,
      String(reviewRunsFor(ar.cwd)));
    check("auto-③ never runs on the ⚙ steward slot", reviewRunsFor(as.cwd) === 0, String(reviewRunsFor(as.cwd)));
    check("auto-③ never runs on a non-lane slot", reviewRunsFor(plainRepo) === 0, String(reviewRunsFor(plainRepo)));

    // (D) the terminal outcome row carries the review AND whether it described what ended up here:
    // killed straight away → the auto-review's key still matches the tree it ran on
    await post(`/api/slots/${ar.slot}/kill`, {});
    const arRec = ((await (await get("/api/lane-outcomes?limit=1000")).json()) as
      { outcomes: { branch: string | null; review?: { state?: string; findings?: unknown[]; head?: string | null } }[] })
      .outcomes.find((o) => o.branch === ar.branch);
    check("outcome row of an auto-reviewed lane carries the review with state:covered",
      arRec?.review?.state === "covered" && (arRec.review.findings?.length ?? 0) === 2
      && /^[0-9a-f]{40}$/.test(arRec.review.head ?? ""), JSON.stringify(arRec?.review ?? null).slice(0, 200));
    await post(`/api/slots/${as.slot}/kill`, {});
    if (freeSlot) await post(`/api/slots/${freeSlot.id}/kill`, {});

    // (E) IDENTITY: a review that finishes AFTER its slot was recycled must not be filed under the
    // lane that now holds the slot. killSlot clears the cache, but the write happens later — so the
    // job freezes {cwd, branch, key} at start and re-checks them before writing. Same bug class as
    // the mergeInflight identity check. Also asserts the honest terminal state for a lane that ends
    // WHILE a review runs: "inflight" — not awaited (a land must not block on an advisory agent),
    // not collapsed into "none".
    const ctl = REPO.replace(/\/[^/]+$/, "");
    await Bun.write(`${ctl}/reviewdelay`, "6"); // the stand-in stays in flight for 6s
    const idl = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${idl.cwd}/identity.txt`, "reviewed while the slot gets recycled\n");
    spawnSync("git", ["-C", idl.cwd, "add", "identity.txt"]);
    spawnSync("git", ["-C", idl.cwd, "commit", "-qm", "identity-case lane work"]);
    void post(`/api/slots/${idl.slot}/review`, {}); // deliberately NOT awaited — it is still running below
    await Bun.sleep(1500);
    await post(`/api/slots/${idl.slot}/kill`, {}); // recycle the slot out from under the running review
    const idlRec = ((await (await get("/api/lane-outcomes?limit=1000")).json()) as
      { outcomes: { branch: string | null; review?: { state: string } }[] })
      .outcomes.find((o) => o.branch === idl.branch);
    check("outcome: a lane that ends while a review is running records review.state \"inflight\"",
      idlRec?.review?.state === "inflight", JSON.stringify(idlRec?.review ?? null));
    const idlNew = (await (await post(`/api/slots/${idl.slot}/open-worktree`,
      { repo: REPO, branch: "e2e-review-identity" })).json()) as { cwd?: string };
    await Bun.sleep(8000); // the first review completes in here, against a slot that moved on
    const idlAfter = (await (await get(`/api/slots/${idl.slot}/review`)).json()) as { cached: boolean };
    check("a review completing after a slot recycle is NOT filed under the new lane",
      idlAfter.cached === false, `${JSON.stringify(idlAfter)} newCwd=${idlNew.cwd}`);
    await post(`/api/slots/${idl.slot}/kill`, {});
    await Bun.write(`${ctl}/reviewdelay`, "0");

    // (F) A FAILED review is a NON-EVENT: the predicate is level-triggered (a finished lane stays
    // idle+clean+ahead forever), so without a per-git-state attempt cap a broken reviewer would
    // spawn a fresh agent every tick, on every done-looking lane at once. Exactly one attempt.
    await Bun.write(`${ctl}/reviewfail`, "1");
    const fl = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
    await Bun.write(`${fl.cwd}/failing.txt`, "the reviewer will fail on this\n");
    spawnSync("git", ["-C", fl.cwd, "add", "failing.txt"]);
    spawnSync("git", ["-C", fl.cwd, "commit", "-qm", "failing-review lane work"]);
    for (let i = 0; i < 30 && reviewRunsFor(fl.cwd) === 0; i++) await Bun.sleep(1000);
    await Bun.sleep(6000); // several more auto ticks on the SAME unchanged git state
    check("auto-③ attempts a failing review exactly once per git state (no retry storm)",
      reviewRunsFor(fl.cwd) === 1, String(reviewRunsFor(fl.cwd)));
    const flGet = (await (await get(`/api/slots/${fl.slot}/review`)).json()) as { cached: boolean };
    check("a failed auto-③ caches nothing and changes no state", flGet.cached === false, JSON.stringify(flGet));
    await post(`/api/slots/${fl.slot}/kill`, {});
    spawnSync("rm", ["-f", `${ctl}/reviewfail`]);
  }

  // --- (G) AN UNKNOWN FACT IS NOT PERMISSION TO FIRE. The trigger reads CACHED facts
  // (laneSignalView: gitInfo/aliveInfo/gitOpInfo + lastOutput). killSlot leaves gitInfo behind for
  // tickGit's `if (!s.cwd)` branch to reap up to 10s later and resets lastOutput to 0, so a slot
  // recycled inside that window used to serve the PREVIOUS lane's {dirty:0, ahead:N} — and since
  // tickGit refreshes alive/gitOp BEFORE gitInfo within one pass, a brand-new EMPTY lane could
  // read done-looking mid-tick and get an auto-③ that reviewed a diff which does not exist yet
  // ("no code changes in scope"). That review then surfaced on the lane's outcome row as
  // state:"superseded" — the intermittent failure signature. openSlot now drops gitInfo too.
  // Asserted on the FACT, not on the rare mid-tick window: the recycled slot must never serve the
  // donor's git reading. Both post-fix answers are named exactly (absent, or the NEW lane's own
  // zero-ahead reading), so a tick landing between the open and the read cannot make it flap —
  // while the pre-fix answer (the donor's branch, one commit ahead) fails either way. ---
  {
    const svTok = ((await (await get("/api/steward/token")).json()) as { token: string }).token;
    type SvGit = { branch: string; dirty: number; ahead: number } | null;
    const svGit = async (slot: number): Promise<SvGit | undefined> =>
      ((await (await fetch(BASE + "/api/steward/sessions",
        { headers: { authorization: `Bearer ${svTok}` } })).json()) as { slots: { id: number; git: SvGit }[] })
        .slots.find((x) => x.id === slot)?.git;

    const donor = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${donor.cwd}/donor.txt`, "one commit, so the cached reading is distinguishable\n");
    spawnSync("git", ["-C", donor.cwd, "add", "donor.txt"]);
    spawnSync("git", ["-C", donor.cwd, "commit", "-qm", "recycle-guard donor work"]);
    // non-tautology guard: without a CACHED clean+ahead reading for this slot there would be
    // nothing for the recycled lane to inherit, and the assertion below would pass vacuously
    let donorGit: SvGit | undefined;
    for (let i = 0; i < 60; i++) {
      donorGit = await svGit(donor.slot);
      if (donorGit?.ahead === 1 && donorGit.dirty === 0) break;
      await Bun.sleep(500);
    }
    check("recycle guard setup: the donor lane's git facts are CACHED as clean + 1 ahead (non-tautology guard)",
      donorGit?.ahead === 1 && donorGit?.dirty === 0 && donorGit?.branch === donor.branch, JSON.stringify(donorGit));

    await post(`/api/slots/${donor.slot}/kill`, {}); // killSlot leaves gitInfo for the next tick to reap
    const rcBranch = "e2e-recycle-facts";
    const rcOpen = await post(`/api/slots/${donor.slot}/open-worktree`, { repo: REPO, branch: rcBranch });
    const rcCwd = ((await rcOpen.json()) as { cwd?: string }).cwd ?? "";
    const rcGit = await svGit(donor.slot);
    check("a recycled slot never serves the PREVIOUS lane's git facts (unknown, or the new lane's own — never inherited)",
      rcOpen.ok && rcGit?.branch !== donor.branch && (rcGit == null || (rcGit.branch === rcBranch && rcGit.ahead === 0)),
      `${JSON.stringify(rcGit)} donor=${donor.branch}`);
    // …and the harm that reading caused: an auto-③ filed against a lane with nothing in it yet
    await Bun.sleep(4000); // several auto-③ ticks (FLEET_AUTO_REVIEW_MS=1000 here)
    const rcRev = (await (await get(`/api/slots/${donor.slot}/review`)).json()) as { cached: boolean };
    check("auto-③ never reviews a freshly recycled, still-empty lane (no phantom 'no code changes' review)",
      reviewRunsFor(rcCwd) === 0 && rcRev.cached === false, `runs=${reviewRunsFor(rcCwd)} ${JSON.stringify(rcRev)}`);
    await post(`/api/slots/${donor.slot}/kill`, {});
  }

  // --- (H) A FAILED GIT READ IS NOT "NOTHING TO REVIEW". runReview reads the lane's diff with two
  // git calls; both used to collapse a NON-ZERO EXIT into the same value as a genuinely empty diff
  // (`committed`/`uncommitted` stay ""), and the empty-tree early return then answered a fully
  // successful, non-raw, EMPTY review — byte-identical to a real clean one. startReview caches it,
  // and outcomeReview files it on the lane's row as `superseded` coverage. So one transient git
  // failure permanently records "reviewed, nothing found" about a lane nobody reviewed.
  // That is this suite's known intermittent signature (section G's comment) reached by a SECOND
  // route: G fixed the phantom TRIGGER (a recycled slot's stale git facts); this is the phantom
  // PAYLOAD, and it needs no race at all — any failing read does it.
  // Made deterministic by breaking exactly the ref the lane recorded as its base, AFTER the lane
  // has committed real work: `git diff <base>...HEAD` then exits non-zero on a clean tree with a
  // real diff, which is the observed failure's fingerprint (fallback scope + dirty:0 + a resolvable
  // base at kill time). Own repo — renaming the shared REPO's branch would break later sections.
  {
    const hbRepo = `${REPO}.reviewbase`;
    spawnSync("git", ["init", "-q", "-b", "main", hbRepo]);
    spawnSync("git", ["-C", hbRepo, "config", "user.email", "t@t"]);
    spawnSync("git", ["-C", hbRepo, "config", "user.name", "t"]);
    spawnSync("git", ["-C", hbRepo, "config", "commit.gpgsign", "false"]);
    await Bun.write(`${hbRepo}/seed.txt`, "seed\n");
    spawnSync("git", ["-C", hbRepo, "add", "seed.txt"]);
    spawnSync("git", ["-C", hbRepo, "commit", "-qm", "seed"]);
    const hb = (await (await post("/api/lanes", { repo: hbRepo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${hb.cwd}/real-work.txt`, "real committed work the reviewer must not call empty\n");
    spawnSync("git", ["-C", hb.cwd, "add", "real-work.txt"]);
    for (let i = 0; i < 12; i++) {
      spawnSync("git", ["-C", hb.cwd, "commit", "-qm", "reviewbase lane work"]);
      if (spawnSync("git", ["-C", hb.cwd, "log", "--oneline", "-1"]).stdout.toString().includes("reviewbase lane work")) break;
      await Bun.sleep(300);
    }
    // the lane recorded base "main" at creation; rename it so that ONE read fails while the tree
    // itself stays clean and its diff stays real
    spawnSync("git", ["-C", hbRepo, "branch", "-m", "main", "gone-main"]);
    const hbRunsBefore = reviewRunsFor(hb.cwd);
    const hbPost = await post(`/api/slots/${hb.slot}/review`, {});
    const hbBody = (await hbPost.json()) as { error?: string; notes?: string; findings?: unknown[]; scope?: string };
    check("a review whose base diff FAILS is not answered as an empty clean review",
      hbPost.status === 500 && (hbBody.error ?? "").length > 0
      && hbBody.notes === undefined && hbBody.findings === undefined,
      `${hbPost.status} ${JSON.stringify(hbBody).slice(0, 240)}`);
    check("...and it spawns no reviewer either (a tree it could not read is not a subject)",
      reviewRunsFor(hb.cwd) === hbRunsBefore, `${hbRunsBefore} -> ${reviewRunsFor(hb.cwd)}`);
    const hbGet = (await (await get(`/api/slots/${hb.slot}/review`)).json()) as { cached: boolean; notes?: string };
    check("a failed read caches NOTHING — the next reader is told there is no review, not an empty one",
      hbGet.cached === false, JSON.stringify(hbGet).slice(0, 240));
    // the outcome row is where the phantom did its damage: it must say "nothing covered this",
    // never a `superseded` row carrying findings:[] that reads as a clean review
    spawnSync("git", ["-C", hbRepo, "branch", "-m", "gone-main", "main"]); // restore, so the row's own base reads work
    await post(`/api/slots/${hb.slot}/kill`, {});
    const hbRec = ((await (await get("/api/lane-outcomes?limit=1000")).json()) as
      { outcomes: { branch: string | null; review?: { state: string; notes?: string } }[] })
      .outcomes.find((o) => o.branch === hb.branch);
    check("a failed read never becomes coverage on the outcome row (state:none, no phantom superseded)",
      hbRec?.review?.state === "none", JSON.stringify(hbRec?.review ?? null).slice(0, 240));
  }
}
