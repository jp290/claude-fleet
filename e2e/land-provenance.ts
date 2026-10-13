// One-gesture land, V2 git-note provenance, the G1 guarantees that
// provenance survives a failed teardown or a stale verify, and the resolver↔verify repair loop.
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { BASE, REPO, REPO2, ROOT, check, get, post, restartSrv } from "./harness";
import { VerifyField, exists, landedAsOne, setMergeMode, settleForMerge, waitMerge } from "./lane-helpers";
import { DAEMON_FEATURES } from "../helper-daemon/daemon";

// a slot's own scoped credential, out of the persisted state — polled for the shape, because
// openSlot queues saveState before it awaits the pane spawn (the same reader e2e/lane-suite.ts uses)
async function selfTokenOf(slot: number): Promise<string> {
  let seen = "";
  for (let i = 0; i < 60; i++) {
    try {
      seen = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
        { slots?: Record<string, { selfToken?: string }> }).slots?.[String(slot)]?.selfToken ?? "";
    } catch { /* mid-write */ }
    if (/^[0-9a-f]{32}$/.test(seen)) return seen;
    await Bun.sleep(50);
  }
  return seen;
}

export async function run(): Promise<void> {
  // === Lane A: one-gesture land (commit-if-dirty → land) ===
  // Isolated fresh repos so main-mutation never touches the shared REPO later tests use.
  {
    const madeRepos: string[] = [];
    const freshRepo = async (suffix: string): Promise<{ repo: string; main: string; sha: string }> => {
      const repo = `${REPO}.${suffix}`;
      madeRepos.push(repo);
      spawnSync("git", ["init", "-q", "-b", "main", repo]); // fakemerge hardcodes `git rebase main`
      spawnSync("git", ["-C", repo, "config", "user.email", "e2e@test"]);
      spawnSync("git", ["-C", repo, "config", "user.name", "e2e"]);
      spawnSync("git", ["-C", repo, "config", "commit.gpgsign", "false"]);
      await Bun.write(`${repo}/base.txt`, "base\n");
      spawnSync("git", ["-C", repo, "add", "base.txt"]);
      spawnSync("git", ["-C", repo, "commit", "-qm", "base"]);
      return { repo, main: "main", sha: spawnSync("git", ["-C", repo, "rev-parse", "HEAD"]).stdout.toString().trim() };
    };
    const headOf = (repo: string, ref = "HEAD"): string => spawnSync("git", ["-C", repo, "rev-parse", ref]).stdout.toString().trim();
    // land a lane with committed work via the clean script path (no conflict → agent never consulted)
    const landClean = async (slot: number, body: Record<string, unknown> = {}): Promise<void> => {
      await setMergeMode("blocked"); // a clean rebase must NOT consult the agent
      await settleForMerge(slot);
      await post(`/api/slots/${slot}/merge`, body);
      await waitMerge(slot);
    };

    // --- one-gesture land: a lane with ONLY uncommitted work lands in one flow (commit → land),
    // the owner never pre-commits. Mirrors doLand: commit (agent message) then /land→/merge. ---
    const og = await freshRepo("onegesture");
    const lane = (await (await post("/api/lanes", { repo: og.repo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${lane.cwd}/feature.txt`, "feature work\n"); // uncommitted — the friction one-gesture removes
    const ogCommit = (await (await post(`/api/slots/${lane.slot}/commit`, { mode: "agent", confirm: true })).json()) as { committed?: boolean; subject?: string };
    check("one-gesture land: the dirty tree is committed first (agent message)",
      ogCommit.committed === true && ogCommit.subject === "feat: stand-in commit message", JSON.stringify(ogCommit));
    check("one-gesture land: direct /land refuses the committed-but-unmerged lane (→ /merge fallback)",
      (await post(`/api/slots/${lane.slot}/land`, {})).status === 409);
    const ogBefore = headOf(og.repo, og.main);
    await landClean(lane.slot);
    check("one-gesture land: committed work then landed (landed slot torn down)",
      (await get(`/api/slots/${lane.slot}/merge`)).status === 400);
    const ogAfter = headOf(og.repo, og.main);
    check("one-gesture land: main advanced past its pre-land SHA", ogAfter !== ogBefore, `${ogBefore} -> ${ogAfter}`);
    // 261011: one commit on the old main with the gated tree; the agent's message is the lane's, under lane-history
    const ogOne = landedAsOne(og.repo, og.main);
    check("one-gesture land: the committed work reached main with the expected message",
      ogOne.ok && ogOne.subjects.includes("feat: stand-in commit message"), JSON.stringify(ogOne));

    // --- REGRESSION GUARD: a CONFLICTING one-gesture land still PAUSES for review (human gate) ---
    const cf = await freshRepo("conflict");
    const cfLane = (await (await post("/api/lanes", { repo: cf.repo })).json()) as { slot: number; cwd: string };
    await Bun.write(`${cfLane.cwd}/base.txt`, "base\nlane-side\n"); // uncommitted — one-gesture commits it
    check("regression guard: one-gesture commits the dirty conflicting lane",
      ((await (await post(`/api/slots/${cfLane.slot}/commit`, { mode: "quick", confirm: true })).json()) as { committed?: boolean }).committed === true);
    await Bun.write(`${cf.repo}/base.txt`, "base\nmain-side\n"); // same line → rebase conflict → agent path
    spawnSync("git", ["-C", cf.repo, "commit", "-aqm", "main conflict"]);
    const cfMainBefore = headOf(cf.repo, cf.main);
    await setMergeMode("do"); // agent resolves the conflict, then the server PAUSES for review
    await settleForMerge(cfLane.slot);
    await post(`/api/slots/${cfLane.slot}/merge`, {});
    const cfV = await waitMerge(cfLane.slot);
    check("regression guard: a conflicting land PAUSES (resolved, NOT landed, lane kept)",
      !cfV.gone && cfV.last?.status === "resolved" && cfV.last.landed === false && exists(cfLane.cwd), JSON.stringify(cfV.last));
    check("regression guard: the human gate held — nothing reached main",
      headOf(cf.repo, cf.main) === cfMainBefore,
      `main=${headOf(cf.repo, cf.main)} before=${cfMainBefore}`);
    await post(`/api/slots/${cfLane.slot}/kill`, {});

    // --- V2: server-written git-note provenance at land ("own your work", design note §4).
    // On every land that MOVES main, the SERVER attaches the review story to the landed tip
    // as a note under refs/notes/fleet/land — server-authored (never the agent), best-effort
    // (a note-write failure never fails the land), never deleted. ---
    const readNote = (repo: string, sha: string): { ok: boolean; json: Record<string, unknown> | null } => {
      const r = spawnSync("git", ["-C", repo, "notes", "--ref=fleet/land", "show", sha]);
      if (r.status !== 0) return { ok: false, json: null };
      try { return { ok: true, json: JSON.parse(r.stdout.toString().trim()) as Record<string, unknown> }; }
      catch { return { ok: false, json: null }; }
    };

    // --- DOCS-PROPORTIONAL LAND GATE -----------------------------------------------------------
    // The test server gives the two-step docs chain and the full chain different executables. A
    // command-selection regression therefore changes the observable command/output, not merely a
    // label. All three candidates are clean rebases and green, so each also leaves the authoritative
    // server-written note behind for the chain provenance check.
    // `class` is the gate's own word for the chain it ran (verify-proportion.ts#GateClass)
    type ClassedVerify = VerifyField & { class?: string };
    const landProportionCase = async (name: string, files: Record<string, string>) => {
      const l = (await (await post("/api/lanes", { repo: REPO })).json()) as
        { slot: number; cwd: string; branch: string };
      for (const [file, content] of Object.entries(files)) {
        mkdirSync(`${l.cwd}/${file.split("/").slice(0, -1).join("/")}`, { recursive: true });
        await Bun.write(`${l.cwd}/${file}`, content);
      }
      spawnSync("git", ["-C", l.cwd, "add", "-A"]);
      const committed = spawnSync("git", ["-C", l.cwd, "commit",
        ...(Object.keys(files).length === 0 ? ["--allow-empty"] : []), "-qm", `${name} proportional gate fixture`]);
      if (committed.status !== 0)
        throw new Error(`${name} proportional-gate fixture did not commit: ${committed.stderr.toString().slice(0, 200)}`);
      const before = headOf(REPO, "main");
      await landClean(l.slot);
      const after = headOf(REPO, "main");
      const note = readNote(REPO, after);
      return { landed: before !== after && (await get(`/api/slots/${l.slot}/merge`)).status === 400,
        verify: note.json?.verify as ClassedVerify | undefined, note };
    };
    const docsGate = await landProportionCase("docs-only", {
      "docs/proportional-only.md": "measurement note\n",
    });
    check("docs-proportional gate: a docs-only lane runs the short chain and lands",
      docsGate.landed && docsGate.verify?.ok === true
      && docsGate.verify.cmd.includes("bun install --frozen-lockfile")
      && docsGate.verify.cmd.endsWith("bun e2e/pins.ts")
      && docsGate.verify.out.includes("proportional fixture pins PASS"), JSON.stringify(docsGate));

    const fullSteps = ["install", "pins", "tsc", "build", "clean-review", "security", "claude-gate"];
    // The code halves sit OUTSIDE src/ and public/ on purpose: since 2026-10-08 a src/ file is the
    // source class, whose chain is cut to the suites its footprint owes (the SOURCE-CLASS block
    // below). `server/` is SERVER_RULE and `tools/` matches no rule at all (DEFAULT_RULE) — both
    // full for their own reason, which is what these two have always claimed.
    const mixedGate = await landProportionCase("mixed", {
      "docs/proportional-mixed.md": "measurement note\n",
      "server/proportional-mixed.ts": "export const measured = true;\n",
    });
    check("docs-proportional gate: a mixed docs+code lane runs the full chain",
      mixedGate.landed && mixedGate.verify?.ok === true
      && mixedGate.verify.cmd === process.env.FLEET_VERIFY_CMD
      && mixedGate.verify.proportional === false && mixedGate.verify.class === "full"
      && JSON.stringify(mixedGate.verify.steps) === JSON.stringify(fullSteps), JSON.stringify(mixedGate));

    const codeGate = await landProportionCase("one-code-file", {
      "tools/proportional-code.ts": "export const oneCodeFile = true;\n",
    });
    check("docs-proportional gate: even one code file runs the full chain",
      codeGate.landed && codeGate.verify?.ok === true
      && codeGate.verify.cmd === process.env.FLEET_VERIFY_CMD
      && codeGate.verify.proportional === false && codeGate.verify.class === "full"
      && JSON.stringify(codeGate.verify.steps) === JSON.stringify(fullSteps), JSON.stringify(codeGate));

    const emptyGate = await landProportionCase("empty-diff", {});
    check("docs-proportional gate: an empty diff never counts as harmless and runs the full chain",
      emptyGate.landed && emptyGate.verify?.ok === true
      && emptyGate.verify.cmd === process.env.FLEET_VERIFY_CMD
      && emptyGate.verify.proportional === false && emptyGate.verify.class === "full"
      && JSON.stringify(emptyGate.verify.steps) === JSON.stringify(fullSteps), JSON.stringify(emptyGate));

    check("docs-proportional gate: the land note marks a short green with its exact steps",
      docsGate.note.ok && docsGate.verify?.proportional === true && docsGate.verify.class === "docs-or-prose"
      && JSON.stringify(docsGate.verify.steps) === JSON.stringify(["install", "pins"]),
      JSON.stringify(docsGate.note.json?.verify));
    check("docs-proportional gate: the short chain is repo-guarded and the guard passed in THIS repo",
      docsGate.verify?.cmd.startsWith('[ -f fleet-e2e.ts ] || { echo "verify skipped: not the fleet repo"; exit 42; }; ') === true
      && docsGate.verify.ok === true && !docsGate.verify.out.includes("verify skipped:"),
      JSON.stringify(docsGate.verify));

    // --- SOURCE-CLASS LAND GATE (owner 2026-10-08: „[Zitat entfernt]“) ----------------
    // A candidate of only src/ (and docs) runs install, pins, tsc, build plus exactly the gate
    // suites whose STAGED footprint holds a changed path (suite-modules.ts#gateSuitesForPaths); the
    // configured command is cut, never replaced. The suite's own repos cannot show it — their gate
    // is one fake executable with no ` && ./e2e-*.sh` links to cut — so this fixture repo carries
    // the shape the cut reads: a chain-shaped FLEET_VERIFY_CMD_REPOS entry and three stand-in
    // wrappers that announce themselves and stop BEFORE their stage_instance line (which only the
    // footprint derivation reads). The footprint is planted so the three suites differ:
    //   server.ts imports src/shared.ts          → every suite boots it
    //   e2e-security.sh stages STAGE_EXTRA=src   → security sees all of src/
    //   fleet-e2e-claude-gate.ts imports src/client-only.ts → claude-gate sees it, clean-review not
    // so a change to src/client-only.ts owes security and claude-gate and leaves clean-review out.
    // Mutation guard: hand verifyPlanFor's source class back to the full chain (narrowed = null) and
    // the first check goes red on cmd, steps, class and the clean-review line together.
    {
      const sg = await freshRepo("srcgate");
      const plant = async (file: string, content: string, mode?: number): Promise<void> => {
        if (file.includes("/")) mkdirSync(`${sg.repo}/${file.split("/").slice(0, -1).join("/")}`, { recursive: true });
        await Bun.write(`${sg.repo}/${file}`, content);
        if (mode) chmodSync(`${sg.repo}/${file}`, mode);
      };
      const standIn = (step: string, entry: string, extra = ""): string =>
        `#!/bin/sh\necho "srcgate-suite ${step} ran"\nexit 0\n${extra}stage_instance "$SRC" "$DIR" server.ts ${entry} || exit 1\n`;
      // the specifier is spliced, never written whole: e2e-stage.sh#_stage_closure greps every line
      // of THIS file for a quoted relative specifier after from/import, and would try to stage the
      // fixture's own imports into the suite instance (FATAL, measured on the first preview)
      const from = (spec: string): string => `from ${'"'}./${spec}${'"'}`;
      await plant("fleet-e2e.ts", "// source-class gate fixture sentinel\n");
      await plant("server.ts", `import { shared } ${from("src/shared")};\nexport const boot = shared;\n`);
      await plant("src/shared.ts", "export const shared = 1;\n");
      await plant("src/client-only.ts", "export const clientOnly = 1;\n");
      await plant("fleet-e2e-clean-review.ts", "export const cleanReview = 1;\n");
      await plant("fleet-e2e-security.ts", "export const security = 1;\n");
      await plant("fleet-e2e-claude-gate.ts", `import { clientOnly } ${from("src/client-only")};\nexport const gate = clientOnly;\n`);
      await plant("e2e-clean-review.sh", standIn("clean-review", "fleet-e2e-clean-review.ts"), 0o755);
      await plant("e2e-security.sh", standIn("security", "fleet-e2e-security.ts", "STAGE_EXTRA=src\n"), 0o755);
      await plant("e2e-claude-gate.sh", standIn("claude-gate", "fleet-e2e-claude-gate.ts"), 0o755);
      spawnSync("git", ["-C", sg.repo, "add", "-A"]);
      const sgSeeded = spawnSync("git", ["-C", sg.repo, "commit", "-qm", "source-class gate fixture"]).status === 0;
      const sgCmd = '[ -f fleet-e2e.ts ] || { echo "verify skipped: not the fleet repo"; exit 42; }; '
        + 'echo "srcgate-install ran" && echo "srcgate-pins ran" && echo "srcgate-tsc ran" && echo "srcgate-build ran"'
        + " && ./e2e-clean-review.sh && ./e2e-security.sh && ./e2e-claude-gate.sh";
      let sgRepos: Record<string, string> = {};
      try { sgRepos = JSON.parse(process.env.FLEET_VERIFY_CMD_REPOS ?? "{}") as Record<string, string>; } catch { /* the suite's own map is optional here */ }
      await restartSrv({ FLEET_VERIFY_CMD_REPOS: JSON.stringify({ ...sgRepos, [sg.repo]: sgCmd }) });
      try {
        const landSg = async (name: string, files: Record<string, string>) => {
          const l = (await (await post("/api/lanes", { repo: sg.repo })).json()) as { slot: number; cwd: string };
          for (const [file, content] of Object.entries(files)) {
            mkdirSync(`${l.cwd}/${file.split("/").slice(0, -1).join("/")}`, { recursive: true });
            await Bun.write(`${l.cwd}/${file}`, content);
          }
          spawnSync("git", ["-C", l.cwd, "add", "-A"]);
          let committed = false;
          for (let i = 0; i < 20 && !committed; i++) {
            committed = spawnSync("git", ["-C", l.cwd, "commit", "-qm", `${name} source-class fixture`]).status === 0;
            if (!committed) await Bun.sleep(150);
          }
          const before = headOf(sg.repo, "main");
          await landClean(l.slot);
          const after = headOf(sg.repo, "main");
          const note = readNote(sg.repo, after);
          return { committed, landed: before !== after, verify: note.json?.verify as ClassedVerify | undefined };
        };
        check("source-class gate setup: the fixture repo seeded and its lane candidate committed (an empty diff takes the full chain for another reason)",
          sgSeeded, `seeded=${sgSeeded}`);
        const srcOnly = await landSg("src-only", { "src/client-only.ts": "export const clientOnly = 2;\n" });
        const cutCmd = sgCmd.replace(" && ./e2e-clean-review.sh", "");
        check("source-class gate: a src/-only land runs install, pins, tsc, build and ONLY the suites its footprint owes — clean-review is cut from the configured chain and the note stamps the class",
          srcOnly.committed && srcOnly.landed && srcOnly.verify?.ok === true
          && srcOnly.verify.cmd === cutCmd
          && srcOnly.verify.class === "source-or-public" && srcOnly.verify.proportional === false
          && JSON.stringify(srcOnly.verify.steps) === JSON.stringify(["install", "pins", "tsc", "build", "security", "claude-gate"])
          && srcOnly.verify.out.includes("srcgate-suite security ran")
          && srcOnly.verify.out.includes("srcgate-suite claude-gate ran")
          && !srcOnly.verify.out.includes("srcgate-suite clean-review ran")
          && srcOnly.verify.out.includes("left out clean-review"), JSON.stringify(srcOnly));
        // …and the same footprint plus ONE e2e/ file is full again: the cut is for src/+public/ alone
        const withE2e = await landSg("src-and-e2e", {
          "src/client-only.ts": "export const clientOnly = 3;\n",
          "e2e/source-class.ts": "export const touched = true;\n",
        });
        check("source-class gate: src/ plus one e2e/ file runs the whole configured chain, class full",
          withE2e.committed && withE2e.landed && withE2e.verify?.ok === true
          && withE2e.verify.cmd === sgCmd && withE2e.verify.class === "full"
          && JSON.stringify(withE2e.verify.steps) === JSON.stringify(fullSteps)
          && ["clean-review", "security", "claude-gate"].every((s) => withE2e.verify!.out.includes(`srcgate-suite ${s} ran`)),
          JSON.stringify(withE2e));

        // --- A GREEN HELPER RECEIPT ON THE CANDIDATE TREE REPLACES ITS SUITE ------------------------
        // Owner 2026-10-08: a lane's three gate suites ran green as command jobs on the helper, and
        // the land ran all three again here. The land now adopts a reported GREEN command job whose
        // tree is the rebased candidate's `HEAD^{tree}`, and stamps jobId, treeSha and device into
        // the note. Four receipts sit beside the candidate and only one may count:
        //   security    — green, on the candidate tree               → ADOPTED, not run here
        //   claude-gate — green, but on the tree BEFORE the change   → runs here (another tree)
        //   claude-gate — red, on the candidate tree                  → runs here (red is no proof)
        //   claude-gate — still open, never claimed                   → runs here (no verdict yet)
        // The proven tree is the lane's UNCOMMITTED work (the bundle's `git stash create`), committed
        // only afterwards: same tree, different commit, the shape a rebase also produces. Mutation
        // guard: compare the receipt by commit (`j.commitSha` against HEAD) instead of by tree in
        // server.ts#adoptedGateSteps and nothing is adopted — the check goes red on `adopted`, on
        // `steps` and on the security line together.
        const helperToken = (await (await get("/api/helper/token")).json() as { token?: string }).token ?? "";
        const hpost = (path: string, body: unknown): Promise<Response> =>
          post(path, body, { "x-fleet-helper-token": helperToken, "content-type": "application/json" });
        const DEVICE = "landadopt0001", DEVICE_NAME = "land adoption box";
        const beat = (): Promise<Response> => hpost("/api/helper/device", { deviceId: DEVICE, name: DEVICE_NAME,
          features: [...DAEMON_FEATURES], daemonSha: spawnSync("git", ["-C", ROOT, "rev-parse", "HEAD"]).stdout.toString().trim() });
        const ad = (await (await post("/api/lanes", { repo: sg.repo })).json()) as { slot: number; cwd: string };
        const adTok = await selfTokenOf(ad.slot);
        const offerJob = async (cmd: string): Promise<string> => {
          const r = await fetch(`${BASE}/api/self/jobs`, { method: "POST",
            headers: { "content-type": "application/json", "x-fleet-self-token": adTok }, body: JSON.stringify({ cmd }) });
          return ((await r.json()) as { jobId?: string }).jobId ?? "";
        };
        // offer, claim and report one command job; `null` leaves it open
        const settle = async (cmd: string, exitCode: number | null): Promise<{ id: string; claimed: boolean; reported: boolean; tree: string }> => {
          const id = await offerJob(cmd);
          if (exitCode === null) return { id, claimed: false, reported: false, tree: "" };
          await beat();
          const claim = await hpost("/api/helper/claim", { jobId: id, deviceId: DEVICE });
          const tree = ((await claim.clone().json().catch(() => ({}))) as { job?: { treeSha?: string } }).job?.treeSha ?? "";
          const rep = await hpost("/api/helper/result", { jobId: id, exitCode, artifacts: [],
            tail: exitCode === 0 ? "ALL PASS" : "FAIL  adoption fixture\n1 FAILURES" });
          return { id, claimed: claim.ok, reported: rep.ok, tree };
        };
        const before = await settle("./e2e-claude-gate.sh", 0);
        await Bun.write(`${ad.cwd}/src/client-only.ts`, "export const clientOnly = 4;\n");
        const proven = await settle("./e2e-security.sh", 0);
        const red = await settle("./e2e-claude-gate.sh", 1);
        const open = await settle("./e2e-claude-gate.sh", null);
        // the one tracked file the receipts proved, and nothing else the lane's cwd may carry
        spawnSync("git", ["-C", ad.cwd, "add", "src/client-only.ts"]);
        let adCommitted = false;
        for (let i = 0; i < 20 && !adCommitted; i++) {
          adCommitted = spawnSync("git", ["-C", ad.cwd, "commit", "-qm", "adoption fixture"]).status === 0;
          if (!adCommitted) await Bun.sleep(150);
        }
        const candTree = headOf(ad.cwd, "HEAD^{tree}");
        // THE DEVICE LEAVES BEFORE THIS BLOCK DOES. Its last beat would otherwise still sit inside the
        // short online window (FLEET_DEVICE_ONLINE_MS) when e2e/lane-suite.ts measures its LS.0
        // precondition "no helper online" — measured: run together, all five LS.0 rows went red on
        // `land adoption box`. Read through the same presence the gate serves, never slept out; the
        // land itself needs no device.
        let adOnline: boolean | undefined = true;
        for (let i = 0; i < 120 && adOnline !== false; i++) {
          adOnline = ((await (await fetch(`${BASE}/api/self/gate`, { headers: { "x-fleet-self-token": adTok } }))
            .json().catch(() => ({}))) as { helper?: { online?: boolean } }).helper?.online;
          if (adOnline !== false) await Bun.sleep(250);
        }
        check("helper adoption setup: four receipts beside one committed candidate — green on the old tree, green and red on the candidate tree, one still open — and the reporting device out of the online window again",
          adCommitted && before.reported && proven.reported && red.reported && !!open.id && !open.claimed
          && before.tree !== candTree && proven.tree === candTree && red.tree === candTree
          && headOf(ad.cwd) !== headOf(sg.repo, "main") && adOnline === false,
          JSON.stringify({ adCommitted, before, proven, red, open, candTree, adOnline }));
        const adBefore = headOf(sg.repo, "main");
        await landClean(ad.slot);
        const adAfter = headOf(sg.repo, "main");
        const adVerify = readNote(sg.repo, adAfter).json?.verify as (ClassedVerify & {
          adopted?: { step: string; jobId: string; treeSha: string; device: string; waitMs?: number }[];
          macFallback?: string }) | undefined;
        const adWait = adVerify?.adopted?.[0]?.waitMs;
        check("helper adoption: the land adopts ONLY the green receipt on its exact candidate tree — security does not run here and the note names jobId, treeSha, device, ms and waitMs; the other-tree green, the red and the open job adopt nothing",
          adBefore !== adAfter && adVerify?.ok === true && adVerify.class === "source-or-public"
          && typeof adWait === "number" && adWait >= 0
          && JSON.stringify(adVerify.adopted) === JSON.stringify([{ step: "security", jobId: proven.id, treeSha: candTree,
            device: DEVICE_NAME, reportedAt: (adVerify.adopted?.[0] as { reportedAt?: number } | undefined)?.reportedAt,
            ms: (adVerify.adopted?.[0] as { ms?: number } | undefined)?.ms, waitMs: adWait }])
          && JSON.stringify(adVerify.steps) === JSON.stringify(["install", "pins", "tsc", "build", "claude-gate"])
          && adVerify.cmd === cutCmd.replace(" && ./e2e-security.sh", "")
          && !adVerify.out.includes("srcgate-suite security ran")
          && adVerify.out.includes("srcgate-suite claude-gate ran")
          && adVerify.out.includes(`security NOT RUN HERE — adopted from helper command job ${proven.id}`)
          && adVerify.out.includes("left out clean-review") && !adVerify.out.includes("left out clean-review, security"),
          JSON.stringify({ landed: adBefore !== adAfter, verify: adVerify }));
        // …and the suite it ran HERE says why it did not go to a helper: none was online (the
        // device left the window above). The fallback is never silent.
        check("land helper route, no helper: the claude-gate that ran on this machine names its reason in the note — no helper online",
          (adVerify?.macFallback ?? "").startsWith("no helper online")
          && (adVerify?.out ?? "").includes("[gate suites ran on THIS machine (claude-gate), not on a helper: no helper online"),
          JSON.stringify({ macFallback: adVerify?.macFallback }));

        // --- THE LAND PROVES ITS OWN CANDIDATE ON THE HELPER (2026-10-09, server.ts#runLandGate) ---
        // docs/entwurf-land-dynamik.md §6: with a helper online the land itself offers each gate
        // suite its class owes as a command job, after its rebase, so the job's tree IS the
        // candidate; it runs install/pins/tsc/build here meanwhile and adopts the receipts through
        // adoptedGateSteps. This module plays the helper: it beats, reads the portal list as the
        // device, claims the land's jobs and reports what each scenario needs. Four lands, each a
        // src/client-only.ts change (owes security + claude-gate, clean-review cut):
        //   H1 both green           → landed, both suites adopted from LAND jobs, none ran here
        //   H2 security red         → NOT landed, ok:false, the red named; nothing re-rolled here
        //   H3 security green, claude-gate unknown → landed, security adopted, claude-gate ran
        //                             here and the note says why
        //   H4 nobody claims        → both withdrawn after FLEET_LAND_JOB_UNCLAIMED_MS, both ran
        //                             here, the reason in the note
        // Mutation guards: drop the red branch in runLandGate and H2 lands (red on `landed`);
        // make landHelperWhyNot always answer a reason and H1 goes red on `landJobs`/`adopted`.
        await restartSrv({ FLEET_VERIFY_CMD_REPOS: JSON.stringify({ ...sgRepos, [sg.repo]: sgCmd }),
          FLEET_LAND_JOB_UNCLAIMED_MS: "3000", FLEET_LAND_JOB_POLL_MS: "200" });
        const hToken = (await (await get("/api/helper/token")).json() as { token?: string }).token ?? "";
        const hp = (path: string, body: unknown): Promise<Response> =>
          post(path, body, { "x-fleet-helper-token": hToken, "content-type": "application/json" });
        const hbeat = (): Promise<Response> => hp("/api/helper/device", { deviceId: DEVICE, name: DEVICE_NAME,
          features: [...DAEMON_FEATURES], daemonSha: spawnSync("git", ["-C", ROOT, "rev-parse", "HEAD"]).stdout.toString().trim() });
        // a lane that stays open, so the presence read at the end has a self principal to ask with
        // (the adoption block's lane landed and is gone)
        const hProbe = (await (await post("/api/lanes", { repo: sg.repo })).json()) as { slot: number };
        const hProbeTok = await selfTokenOf(hProbe.slot);
        type LandJobRow = { step: string; jobId: string; outcome: string; device: string | null; treeSha: string | null;
          ms: number | null; waitMs: number; reason?: string };
        type HelperVerify = ClassedVerify & { adopted?: { step: string; jobId: string; treeSha: string; device: string;
          ms: number; waitMs: number; land?: boolean }[]; landJobs?: LandJobRow[]; macFallback?: string;
          waitMs?: number; ms?: number };
        // `policy` maps a wrapper to the helper's answer: an exit code, "unknown" (a report without
        // one), or null (never claimed)
        const landViaHelper = async (name: string, policy: Record<string, number | "unknown" | null>) => {
          const l = (await (await post("/api/lanes", { repo: sg.repo })).json()) as { slot: number; cwd: string };
          await Bun.write(`${l.cwd}/src/client-only.ts`, `export const clientOnly = "${name}";\n`);
          spawnSync("git", ["-C", l.cwd, "add", "-A"]);
          let committed = false;
          for (let i = 0; i < 20 && !committed; i++) {
            committed = spawnSync("git", ["-C", l.cwd, "commit", "-qm", `${name} land helper fixture`]).status === 0;
            if (!committed) await Bun.sleep(150);
          }
          const before = headOf(sg.repo, "main");
          await setMergeMode("blocked");
          await settleForMerge(l.slot);
          await hbeat();
          await post(`/api/slots/${l.slot}/merge`, {});
          const handled = new Map<string, { cmd: string; tree: string; claimed: boolean; reported: boolean }>();
          for (let i = 0; i < 500; i++) {
            await hbeat();
            const list = (await (await get(`/api/helper/jobs?deviceId=${DEVICE}`)).json()) as
              { jobs?: { id: string; kind: string; cmd?: string; land?: boolean; claim: unknown }[] };
            for (const j of list.jobs ?? []) {
              if (j.kind !== "command" || !j.land || j.claim || handled.has(j.id)) continue;
              const answer = policy[j.cmd ?? ""];
              if (answer === null || answer === undefined) { handled.set(j.id, { cmd: j.cmd ?? "", tree: "", claimed: false, reported: false }); continue; }
              const claim = await hp("/api/helper/claim", { jobId: j.id, deviceId: DEVICE });
              const tree = ((await claim.clone().json().catch(() => ({}))) as { job?: { treeSha?: string } }).job?.treeSha ?? "";
              const rep = await hp("/api/helper/result", { jobId: j.id, artifacts: [],
                ...(answer === "unknown" ? {} : { exitCode: answer }),
                tail: answer === 0 ? "ALL PASS" : answer === "unknown" ? "(runner died)" : "FAIL  land helper fixture\n1 FAILURES" });
              handled.set(j.id, { cmd: j.cmd ?? "", tree, claimed: claim.ok, reported: rep.ok });
            }
            const m = (await (await get(`/api/slots/${l.slot}/merge`)).json().catch(() => ({}))) as { running?: boolean };
            if (m.running === false) break;
            await Bun.sleep(100);
          }
          const { last } = await waitMerge(l.slot);
          const after = headOf(sg.repo, "main");
          const landed = before !== after;
          const verify = (landed ? readNote(sg.repo, after).json?.verify : (last as { verify?: unknown } | null)?.verify) as HelperVerify | undefined;
          return { committed, landed, before, after, tree: landed ? headOf(sg.repo, "main^{tree}") : headOf(l.cwd, "HEAD^{tree}"),
            jobs: [...handled.entries()].map(([id, h]) => ({ id, ...h })), status: (last as { status?: string } | null)?.status, verify };
        };
        const h1 = await landViaHelper("h1", { "./e2e-security.sh": 0, "./e2e-claude-gate.sh": 0 });
        const h1Ids = h1.jobs.map((j) => j.id).sort();
        check("land helper route H1: with a helper online the land offers security and claude-gate as its OWN command jobs on the rebased candidate tree, adopts both green receipts and runs neither here — the note names job id, tree, device, ms and waitMs",
          h1.committed && h1.landed && h1.verify?.ok === true && h1.verify.class === "source-or-public"
          && h1.jobs.length === 2 && h1.jobs.every((j) => j.claimed && j.reported && j.tree === h1.tree)
          && JSON.stringify(h1.jobs.map((j) => j.cmd).sort()) === JSON.stringify(["./e2e-claude-gate.sh", "./e2e-security.sh"])
          && JSON.stringify(h1.verify.steps) === JSON.stringify(["install", "pins", "tsc", "build"])
          && h1.verify.cmd === cutCmd.replace(" && ./e2e-security.sh", "").replace(" && ./e2e-claude-gate.sh", "")
          && JSON.stringify((h1.verify.adopted ?? []).map((a) => a.jobId).sort()) === JSON.stringify(h1Ids)
          && (h1.verify.adopted ?? []).every((a) => a.land === true && a.treeSha === h1.tree && a.device === DEVICE_NAME
            && typeof a.ms === "number" && typeof a.waitMs === "number")
          && (h1.verify.landJobs ?? []).length === 2 && (h1.verify.landJobs ?? []).every((r) => r.outcome === "green")
          && h1.verify.macFallback === undefined && typeof h1.verify.waitMs === "number" && typeof h1.verify.ms === "number"
          && !h1.verify.out.includes("srcgate-suite security ran") && !h1.verify.out.includes("srcgate-suite claude-gate ran")
          && h1.verify.out.includes("NOT RUN HERE — adopted from land command job")
          && h1.verify.out.includes("left out clean-review") && !h1.verify.out.includes("left out clean-review, security"),
          JSON.stringify(h1));
        const h2 = await landViaHelper("h2", { "./e2e-security.sh": 1, "./e2e-claude-gate.sh": 0 });
        const h2Red = (h2.verify?.landJobs ?? []).find((r) => r.step === "security");
        check("land helper route H2: a RED land job on the candidate tree refuses the land — main does not move, verify ok:false names the red job, and the suite is not rolled again here",
          h2.committed && !h2.landed && h2.status === "resolved" && h2.verify?.ok === false
          && h2Red?.outcome === "red" && h2Red.treeSha === h2.tree
          && h2.verify.out.includes(`security RED on ${DEVICE_NAME} — land command job ${h2Red.jobId}`)
          && !h2.verify.out.includes("srcgate-suite security ran") && h2.verify.macFallback === undefined,
          JSON.stringify(h2));
        const h3 = await landViaHelper("h3", { "./e2e-security.sh": 0, "./e2e-claude-gate.sh": "unknown" });
        check("land helper route H3: an `unknown` receipt is no proof — security is adopted from its green land job, claude-gate runs on this machine and the note says why",
          h3.committed && h3.landed && h3.verify?.ok === true
          && JSON.stringify((h3.verify.adopted ?? []).map((a) => a.step)) === JSON.stringify(["security"])
          && (h3.verify.landJobs ?? []).some((r) => r.step === "claude-gate" && r.outcome === "unknown")
          && JSON.stringify(h3.verify.steps) === JSON.stringify(["install", "pins", "tsc", "build", "claude-gate"])
          && h3.verify.out.includes("srcgate-suite claude-gate ran") && !h3.verify.out.includes("srcgate-suite security ran")
          && (h3.verify.macFallback ?? "").includes("the helper did not measure claude-gate")
          && h3.verify.out.includes("claude-gate NOT MEASURED by a helper"),
          JSON.stringify(h3));
        const h4 = await landViaHelper("h4", { "./e2e-security.sh": null, "./e2e-claude-gate.sh": null });
        check("land helper route H4: land jobs nobody claims are withdrawn after FLEET_LAND_JOB_UNCLAIMED_MS and both suites run on this machine — the fallback names the unclaimed jobs",
          h4.committed && h4.landed && h4.verify?.ok === true && h4.jobs.length === 2 && h4.jobs.every((j) => !j.claimed)
          && (h4.verify.landJobs ?? []).length === 2 && (h4.verify.landJobs ?? []).every((r) => r.outcome === "withdrawn"
            && (r.reason ?? "").includes("no helper claimed it within 3000ms"))
          && (h4.verify.adopted ?? []).length === 0
          && h4.verify.out.includes("srcgate-suite security ran") && h4.verify.out.includes("srcgate-suite claude-gate ran")
          && (h4.verify.macFallback ?? "").includes("withdrawn"),
          JSON.stringify(h4));
        // the device leaves the online window again before this block ends, for the same reason the
        // adoption block's does (e2e/lane-suite.ts LS.0 measures "no helper online")
        let hOnline: boolean | undefined = true;
        for (let i = 0; i < 160 && hOnline !== false; i++) {
          hOnline = ((await (await fetch(`${BASE}/api/self/gate`, { headers: { "x-fleet-self-token": hProbeTok } }))
            .json().catch(() => ({}))) as { helper?: { online?: boolean } }).helper?.online;
          if (hOnline !== false) await Bun.sleep(250);
        }
        check("land helper route teardown: the fixture device is out of the online window again", hOnline === false, String(hOnline));
      } finally {
        await restartSrv(); // back to the suite's own verify map for everything after this block
      }
    }

    // --- W3 · A WAVE LANDS ONCE ----------------------------------------------------------------
    // The hard half of the ▸ start wave done-sentence (docs/queue-wellen-2026-09-06.md §5 S3): n
    // queue rows founded into ONE lane must leave exactly ONE fleet/land note and
    // ONE audit cover behind, and all n rows must go to `done` together. Every one of those is a
    // property of the LAND, so this is where it is measured — the door's own refusals, the N:1
    // binding and the self-split are checked in e2e/tasks.ts, where the queue lives.
    //
    // The cover is measured through the note's `verify.proportional`: `recordLand` passes exactly
    // `prov.verify?.proportional === true` to schedulePostLandAudit, and `entryRunsShortChain`
    // reads that same field back off `covers[]`. Tier 2 is OFF in this suite by design (see the
    // block at the end of this module), so the note is the field's authoritative reading here, and
    // e2e/pins.ts holds the two source ends of that pass-through together.
    //
    // AND THE SURFACE IS NOT THE DIFF, deliberately: both rows declare AGENTS.md, the lane writes
    // two OTHER docs files. If the gate ever classified the declared surface instead of the actual
    // rebased diff, this land would still read docs — so the negative half lives in the mixed case
    // above, and what this proves is that a wave changes nothing about which command is chosen.
    {
      // CONFIRMED is enough and `activate` is deliberately not called: the sensor's second
      // bundling criterion is that the rows carry the SAME programId, and it reads no status —
      // activating one here would add a moving part this check has no opinion about.
      const wvProposed = (await (await post("/api/programs", {
        title: "Wave land provenance program",
        intent: "Two rows of one program that land together in one lane.",
        successCriterion: "One land leaves one note and both rows done.",
        nonGoals: [], decisions: [], evidence: [], openQuestions: [],
      })).json()) as { program?: { id?: string } };
      const wvProg = wvProposed.program?.id ?? "";
      if (wvProg) await post(`/api/programs/${wvProg}/confirm`, {});
      const wvMint = async (text: string): Promise<string> => {
        const r = (await (await post("/api/tasks", { text, queue: false, repo: REPO, programId: wvProg })).json()) as
          { task?: { id?: string } };
        return r.task?.id ?? "";
      };
      // Both rows name AGENTS.md — tracked in the fixture repo and docs-or-prose, so the sensor
      // classes the wave `docs`; a gate-changing path would be refused by R2 and this would then
      // be measuring R2.
      const wvA = await wvMint("wave land one: the first half of AGENTS.md");
      const wvB = await wvMint("wave land two: the second half of AGENTS.md");
      for (const id of [wvA, wvB]) await post(`/api/tasks/${id}/files`, { files: ["AGENTS.md"] });
      check("(w3) fixture: two rows of one Program, both with an owner-CONFIRMED surface",
        !!wvProg && !!wvA && !!wvB, JSON.stringify({ program: wvProg, a: wvA, b: wvB }));

      const wvSess = async (): Promise<{ slots: { id: number; cwd: string | null }[];
        tasks: { id: string; status: string; note?: string | null }[] }> =>
        (await (await get("/api/sessions")).json()) as {
          slots: { id: number; cwd: string | null }[];
          tasks: { id: string; status: string; note?: string | null }[] };
      const wvNotes = (): number => spawnSync("git", ["-C", REPO, "notes", "--ref=fleet/land", "list"])
        .stdout.toString().split("\n").filter(Boolean).length;
      const wvNotesBefore = wvNotes();

      const wvSince1 = Date.now();
      const wvRes = await post("/api/wave/dispatch", { ids: [wvA, wvB] });
      const wvBody = (await wvRes.json()) as { ok?: boolean; slot?: number; branch?: string; error?: string;
        wave?: { ids: string[]; klasse: string } };
      check("(w3) the wave started as ONE docs lane on both rows",
        wvRes.ok && wvBody.wave?.klasse === "docs" && wvBody.wave.ids.length === 2
        && typeof wvBody.slot === "number",
        `${wvRes.status} ${JSON.stringify(wvBody)}`);
      const wvSlot = wvBody.slot ?? 0;
      const wvCwd = wvSlot ? ((await wvSess()).slots.find((x) => x.id === wvSlot)?.cwd ?? "") : "";
      // WAIT FOR THE BRIEF, not for a clock: until it is delivered the dispatch tail can still
      // requeue the whole wave, and a land raced against that would be measuring the race. Scoped
      // by `since` for the reason e2e/programs.ts states — slot ids are recycled and this run
      // delivers more than one wave brief, so an unscoped poll returns on the PREVIOUS wave's
      // prompt and the wait it was supposed to perform never happens.
      const wvWaitBrief = async (slot: number, since: number): Promise<boolean> => {
        for (let i = 0; i < 120 && slot; i++) {
          const j = (await (await get("/api/prompts?limit=50&q=WELLE")).json()) as
            { prompts: { ts?: number; slot?: number; text?: string }[] };
          if (j.prompts.some((x) => x.slot === slot && typeof x.ts === "number" && x.ts >= since
            && (x.text ?? "").includes("EIN LAND"))) return true;
          await Bun.sleep(250);
        }
        return false;
      };
      const wvBriefed = await wvWaitBrief(wvSlot, wvSince1);
      check("(w3) fixture: the wave brief reached the lane before anything was committed into it",
        wvBriefed && !!wvCwd, `briefed=${wvBriefed} cwd=${wvCwd || "none"}`);

      if (wvCwd && wvBriefed) {
        // ONE COMMIT PER ROW — the brief's own first rule, and the thing that buys a red audit its
        // bisect back. Two DOCS files, neither of them the declared surface.
        for (const [n, id] of (wvBody.wave?.ids ?? []).entries()) {
          await Bun.write(`${wvCwd}/docs/wave-land-${n + 1}.md`, `wave row ${id}\n`);
          spawnSync("git", ["-C", wvCwd, "add", `docs/wave-land-${n + 1}.md`]);
          spawnSync("git", ["-C", wvCwd, "commit", "-qm", `docs(wave): ${id}`]);
        }
        const wvMainBefore = headOf(REPO, "main");
        await landClean(wvSlot);
        const wvMainAfter = headOf(REPO, "main");
        const wvNote = readNote(REPO, wvMainAfter);
        const wvVerify = wvNote.json?.verify as VerifyField | undefined;
        check("(w3) LAND: the wave lane landed — main moved to the lane tip",
          wvMainBefore !== wvMainAfter && (await get(`/api/slots/${wvSlot}/merge`)).status === 400,
          `${wvMainBefore.slice(0, 8)} → ${wvMainAfter.slice(0, 8)}`);
        check("(w3) ONE fleet/land note for the whole wave — not one per row",
          wvNotes() === wvNotesBefore + 1 && wvNote.ok,
          `${wvNotesBefore} → ${wvNotes()} note(s), note readable=${wvNote.ok}`);
        // …and the field the audit cover is built from. `proportional` is true because the ACTUAL
        // diff is docs-only, which is also true of every row in this wave — the two coincide here,
        // and the mixed/code cases above are what prove the gate reads the diff and not the class.
        check("(w3) the land note's verify is the SHORT chain — an all-docs wave buys the audit cover its proportional",
          wvVerify?.proportional === true && wvVerify.ok === true
          && JSON.stringify(wvVerify.steps) === JSON.stringify(["install", "pins"]),
          JSON.stringify(wvVerify ?? null));
        const wvRows = (await wvSess()).tasks;
        const wvDoneA = wvRows.find((t) => t.id === wvA);
        const wvDoneB = wvRows.find((t) => t.id === wvB);
        check("(w3) ALL n rows go to `done` on the one land, both naming the branch that landed them",
          wvDoneA?.status === "done" && wvDoneB?.status === "done"
          && (wvDoneA.note ?? "").includes(wvBody.branch ?? "\u0000")
          && (wvDoneB.note ?? "").includes(wvBody.branch ?? "\u0000"),
          JSON.stringify({ a: wvDoneA, b: wvDoneB, branch: wvBody.branch }));
      }
      for (const id of [wvA, wvB]) await post(`/api/tasks/${id}/delete`, {});

      // ...AND THE OTHER HALF OF "genau dann wenn". The done sentence says the cover's
      // `proportional` is true EXACTLY when all n rows were docs — so a wave that DECLARES docs and
      // whose lane then touches a code file has to come out false, or the field would be a
      // statement about the declaration instead of about the tree. This is the owner's case (ii)
      // of 2026-09-07 („[Zitat entfernt]“): the gate stays correct, and the price is the
      // bisect, which is exactly why the split door exists beside it.
      const wvC = await wvMint("wave land three: AGENTS.md again, but the work reaches further");
      const wvD = await wvMint("wave land four: AGENTS.md once more");
      for (const id of [wvC, wvD]) await post(`/api/tasks/${id}/files`, { files: ["AGENTS.md"] });
      const wvSince2 = Date.now();
      const wvRes2 = await post("/api/wave/dispatch", { ids: [wvC, wvD] });
      const wvBody2 = (await wvRes2.json()) as { ok?: boolean; slot?: number; error?: string;
        wave?: { ids: string[]; klasse: string } };
      const wvSlot2 = wvBody2.slot ?? 0;
      const wvCwd2 = wvSlot2 ? ((await wvSess()).slots.find((x) => x.id === wvSlot2)?.cwd ?? "") : "";
      check("(w3) fixture: a second wave, declared `docs` by the sensor exactly like the first",
        wvRes2.ok && wvBody2.wave?.klasse === "docs" && !!wvCwd2,
        `${wvRes2.status} ${JSON.stringify(wvBody2)} cwd=${wvCwd2 || "none"}`);
      const wvBriefed2 = await wvWaitBrief(wvSlot2, wvSince2);
      check("(w3) fixture: the second wave's brief reached its lane before anything was committed",
        wvBriefed2, `slot=${wvSlot2} since=${wvSince2}`);
      if (wvCwd2 && wvBriefed2) {
        await Bun.write(`${wvCwd2}/docs/wave-land-3.md`, `wave row ${wvC}\n`);
        spawnSync("git", ["-C", wvCwd2, "add", "docs/wave-land-3.md"]);
        spawnSync("git", ["-C", wvCwd2, "commit", "-qm", `docs(wave): ${wvC}`]);
        await Bun.write(`${wvCwd2}/src/wave-land-4.ts`, "export const surfaceWasTooSmall = true;\n");
        spawnSync("git", ["-C", wvCwd2, "add", "src/wave-land-4.ts"]);
        spawnSync("git", ["-C", wvCwd2, "commit", "-qm", `feat(wave): ${wvD}`]);
        await landClean(wvSlot2);
        const wvVerify2 = readNote(REPO, headOf(REPO, "main")).json?.verify as VerifyField | undefined;
        check("(w3) a wave that DECLARED docs but touched code runs the FULL chain — the gate reads the diff, never the declaration",
          wvVerify2?.proportional === false && wvVerify2.ok === true
          && wvVerify2.cmd === process.env.FLEET_VERIFY_CMD,
          JSON.stringify(wvVerify2 ?? null));
        const wvRows2 = (await wvSess()).tasks;
        check("(w3) …and both rows of that wave still go to `done` on the one land",
          wvRows2.find((t) => t.id === wvC)?.status === "done"
          && wvRows2.find((t) => t.id === wvD)?.status === "done",
          JSON.stringify(wvRows2.filter((t) => t.id === wvC || t.id === wvD)));
      }
      for (const id of [wvC, wvD]) await post(`/api/tasks/${id}/delete`, {});
    }

    // --- A DOCS-ONLY CANDIDATE IN A REPO THAT IS NOT THIS ONE -----------------------------------
    // Docs-only is a property of the DIFF; being verifiable by `bun e2e/pins.ts` is a property of
    // the REPO, and until 2026-08-26 `proportional` asked only the first. So any repo whose
    // candidate happened to be docs-only had its OWN configured command replaced by the fleet's
    // short chain, which then hit its own `[ -f fleet-e2e.ts ]` guard and exited 42: SKIPPED,
    // ok:null, no auto-land — and nothing measured, in a repo that has a real gate configured for
    // it. Twice live on 2026-08-26 (example-game lands 5ddfcea and 6d9a1cd, both noted
    // `proportional:true, steps:["install","pins"], exitCode:42`).
    // These two assert the repo half of the question, on the fixture with NO map entry: the global
    // FLEET_VERIFY_CMD runs, it measures the tree, and the note stamps the full chain it ran.
    // Mutation guard: drop `&& repoRunsShortChain(repo)` from verifyPlanFor and the fleet-shaped
    // command is chosen again — cmd stops being fakeverify, out says "verify skipped: not the
    // fleet repo", ok goes null and the land never happens.
    // The guard inside VERIFY_PROPORTIONAL_CMD stays the second line of defense (it is what still
    // catches a FLEET lane that moved the sentinel); that it is still IN the string is pinned
    // statically by e2e/pins.ts, which is where that half is now asserted from.
    const foreign = await freshRepo("proportional-foreign");
    const fgLane = (await (await post("/api/lanes", { repo: foreign.repo })).json()) as
      { slot: number; cwd: string; branch: string };
    mkdirSync(`${fgLane.cwd}/docs`, { recursive: true });
    await Bun.write(`${fgLane.cwd}/docs/foreign-note.md`, "a docs-only change in a foreign repo\n");
    spawnSync("git", ["-C", fgLane.cwd, "add", "-A"]);
    // retried like the skip family in e2e/merge.ts: the server polls lane git state on a timer, and
    // a poll holding index.lock makes a one-shot commit fail — an empty candidate would take the
    // conservative FULL chain and report this case's own failure for the wrong reason
    let fgCommitted = false;
    for (let i = 0; i < 20 && !fgCommitted; i++) {
      fgCommitted = spawnSync("git", ["-C", fgLane.cwd, "commit", "-qm", "foreign docs-only candidate"]).status === 0;
      if (!fgCommitted) await Bun.sleep(150);
    }
    check("foreign-repo docs-only setup: the candidate committed (precondition — an empty diff takes the full chain for another reason)",
      fgCommitted, spawnSync("git", ["-C", fgLane.cwd, "status", "--porcelain"]).stdout.toString().trim());
    const fgBefore = headOf(foreign.repo, foreign.main);
    await landClean(fgLane.slot);
    const fgAfter = headOf(foreign.repo, foreign.main);
    const fgVerify = readNote(foreign.repo, fgAfter).json?.verify as VerifyField | undefined;
    check("docs-proportional gate: a docs-only candidate in a foreign repo runs THAT REPO'S configured chain, not the fleet short chain",
      fgVerify?.ok === true && fgVerify.cmd === process.env.FLEET_VERIFY_CMD
      && !fgVerify.out.includes("verify skipped: not the fleet repo")
      && fgVerify.out.includes("verify OK: no sabotage marker in the tree"), JSON.stringify(fgVerify));
    // …and it stamps NO step names. `steps` names lines of THIS repo's chain, and this land ran
    // $FLEET_VERIFY_CMD in a repo where `bun e2e/pins.ts` does not exist — so all seven (the shape
    // this note carried until 2026-09-16) was a list of commands nothing ran. Empty, not absent:
    // absent is the old-verdict shape that cannot reconstruct any of this, and `cmd` above is
    // asserted in the same block as the record of what DID run.
    check("docs-proportional gate: the foreign-repo note stamps NO fleet step names — not install+pins, and not the full seven either",
      fgVerify?.proportional === false
      && Array.isArray(fgVerify.steps) && fgVerify.steps.length === 0, JSON.stringify(fgVerify));
    check("docs-proportional gate: measured green, the foreign docs-only lane LANDS (the skip used to stop it here)",
      fgAfter !== fgBefore && (await get(`/api/slots/${fgLane.slot}/merge`)).status === 400,
      JSON.stringify({ before: fgBefore, after: fgAfter }));

    // --- THE SAME CASE WHERE THE REPO HAS ITS OWN ENTRY, AND THE GATE HAS SOMETHING TO SAY --------
    // testrepo2 is the one fixture repo with its own FLEET_VERIFY_CMD_REPOS command ($DIR/
    // fakeverify2) — the production shape of the incident: a product repo for which a real verify
    // IS configured. The docs-only candidate carries fakeverify2's own sabotage marker, so the
    // check is not "a different string was recorded" but "that command READ THIS TREE": only
    // fakeverify2 knows VERIFY2BAD, and the short chain would never have looked. This is the half
    // the note's own words cannot fake — under the old behaviour the whole tree went unmeasured.
    // Mutation guard: drop `&& repoRunsShortChain(repo)` from verifyPlanFor and this lane's
    // sabotage is never seen — ok:null with "verify skipped: not the fleet repo" instead of red.
    if (REPO2 && exists(REPO2)) {
      const r2Lane = (await (await post("/api/lanes", { repo: REPO2 })).json()) as
        { slot: number; cwd: string; branch: string };
      mkdirSync(`${r2Lane.cwd}/docs`, { recursive: true });
      await Bun.write(`${r2Lane.cwd}/docs/proportional-sabotage.md`,
        "a docs-only change carrying a VERIFY2BAD marker only fakeverify2 knows\n");
      spawnSync("git", ["-C", r2Lane.cwd, "add", "-A"]);
      let r2Committed = false;
      for (let i = 0; i < 20 && !r2Committed; i++) {
        r2Committed = spawnSync("git", ["-C", r2Lane.cwd, "commit", "-qm", "repo2 docs-only sabotage candidate"]).status === 0;
        if (!r2Committed) await Bun.sleep(150);
      }
      check("per-repo docs-only setup: the sabotage candidate committed (an uncommitted marker verifies GREEN and lands)",
        r2Committed, spawnSync("git", ["-C", r2Lane.cwd, "status", "--porcelain"]).stdout.toString().trim());
      const r2Before = headOf(REPO2, "main");
      await setMergeMode("blocked"); // clean rebase — the agent is never consulted
      await settleForMerge(r2Lane.slot);
      await post(`/api/slots/${r2Lane.slot}/merge`, {});
      const r2V = await waitMerge(r2Lane.slot);
      const r2Verify = r2V.last?.verify;
      check("docs-proportional gate: a docs-only candidate in a repo WITH its own FLEET_VERIFY_CMD_REPOS entry runs that entry",
        r2Verify?.cmd?.endsWith("fakeverify2") === true
        && !(r2Verify.out ?? "").includes("verify skipped: not the fleet repo"),
        JSON.stringify(r2Verify?.cmd));
      check("docs-proportional gate: that command READ the docs-only tree — it names the marker only it knows",
        (r2Verify?.out ?? "").includes("verify2 FAIL") && (r2Verify?.out ?? "").includes("VERIFY2BAD"),
        JSON.stringify((r2Verify?.out ?? "").slice(0, 200)));
      check("docs-proportional gate: the red verdict keeps the lane and holds main — a docs diff buys no exemption",
        r2Verify?.ok === false && r2Verify.proportional === false
        && Array.isArray(r2Verify.steps) && r2Verify.steps.length === 0
        && !r2V.gone && r2V.last?.status === "resolved" && r2V.last.landed === false
        && headOf(REPO2, "main") === r2Before,
        JSON.stringify({ ok: r2Verify?.ok, proportional: r2Verify?.proportional, steps: r2Verify?.steps,
          gone: r2V.gone, landed: r2V.last?.landed, main: headOf(REPO2, "main"), before: r2Before }));
      await post(`/api/slots/${r2Lane.slot}/kill`, {});
      await post("/api/worktrees/discard", { repo: REPO2, path: r2Lane.cwd, branch: r2Lane.branch });
    } else {
      check("per-repo docs-only setup: testrepo2 exists (precondition — this check is about WHICH command ran)",
        false, JSON.stringify({ REPO2 }));
    }

    // (1) clean-path land → a note that PARSES and carries the land's own before/after +
    //     the server verify result (green). Mutation guard: drop writeLandNote → this fails.
    const pn = await freshRepo("provnote");
    const pnLane = (await (await post("/api/lanes", { repo: pn.repo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${pnLane.cwd}/prov.txt`, "clean lane work, no marker\n");
    spawnSync("git", ["-C", pnLane.cwd, "add", "prov.txt"]);
    spawnSync("git", ["-C", pnLane.cwd, "commit", "-qm", "prov lane work"]);
    const pnBefore = headOf(pn.repo, pn.main);
    await landClean(pnLane.slot);
    const pnAfter = headOf(pn.repo, pn.main);
    const pnNote = readNote(pn.repo, pnAfter);
    check("V2: a clean-path land writes a fleet/land git note on the landed tip that parses", pnNote.ok, JSON.stringify(pnNote));
    check("V2: the note records this land's own mainBefore→mainAfter, branch, and confirmedByHuman:false",
      pnNote.json?.mainBefore === pnBefore && pnNote.json?.mainAfter === pnAfter
      && pnNote.json?.branch === pnLane.branch && pnNote.json?.confirmedByHuman === false,
      `before=${pnBefore} after=${pnAfter} ${JSON.stringify(pnNote.json)}`);
    check("V2: the note carries the SERVER verify fact (green), not an agent self-claim",
      (pnNote.json?.verify as { ok?: boolean; mainSha?: string } | undefined)?.ok === true
      && typeof (pnNote.json?.verify as { mainSha?: string } | undefined)?.mainSha === "string",
      JSON.stringify(pnNote.json?.verify));

    // (3) confirm-land → confirmedByHuman:true, carrying the reviewed conflicted files + resolver detail.
    const pc = await freshRepo("provconfirm");
    const pcLane = (await (await post("/api/lanes", { repo: pc.repo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${pcLane.cwd}/base.txt`, "base\nlane-side\n"); // conflict on base.txt
    spawnSync("git", ["-C", pcLane.cwd, "commit", "-aqm", "prov confirm lane work"]);
    await Bun.write(`${pc.repo}/base.txt`, "base\nmain-side\n");    // same line on main → agent resolves
    spawnSync("git", ["-C", pc.repo, "commit", "-aqm", "prov confirm main work"]);
    await setMergeMode("do");
    await settleForMerge(pcLane.slot);
    await post(`/api/slots/${pcLane.slot}/merge`, {});
    const pcV = await waitMerge(pcLane.slot);
    check("V2 setup: conflicting lane resolved + paused for review", !pcV.gone && pcV.last?.status === "resolved", JSON.stringify(pcV.last));
    const pcBefore = headOf(pc.repo, pc.main);
    await settleForMerge(pcLane.slot);
    const pcConf = (await (await post(`/api/slots/${pcLane.slot}/merge`, { confirm: true })).json()) as { status?: string; landed?: boolean };
    check("V2 setup: the owner confirm-lands the reviewed resolution", pcConf.status === "merged" && pcConf.landed === true, JSON.stringify(pcConf));
    const pcAfter = headOf(pc.repo, pc.main);
    const pcNote = readNote(pc.repo, pcAfter);
    check("V2: the confirm-land note records confirmedByHuman:true (the human owned this land)",
      pcNote.ok && pcNote.json?.confirmedByHuman === true, JSON.stringify(pcNote.json));
    check("V2: the confirm-land note carries the reviewed conflicted files + the resolver detail",
      Array.isArray(pcNote.json?.conflicted) && (pcNote.json?.conflicted as string[]).includes("base.txt")
      && typeof pcNote.json?.resolverDetail === "string" && (pcNote.json?.resolverDetail as string).length > 0,
      JSON.stringify(pcNote.json));
    check("G1 control: an un-moved confirm-land note carries a FRESH verify (green, no stale marker)",
      (pcNote.json?.verify as VerifyField | undefined)?.ok === true
      && (pcNote.json?.verify as VerifyField | undefined)?.stale === undefined,
      JSON.stringify(pcNote.json?.verify));

    // (4) a land whose NOTE-WRITE FAILS still lands (best-effort provenance, landing is the job).
    //     Sabotage: refs/notes/fleet as a FILE → `git notes add refs/notes/fleet/land` hits a
    //     D/F lock error, while refs/heads/main (the land's own ff) is untouched.
    const pf = await freshRepo("provfail");
    const pfLane = (await (await post("/api/lanes", { repo: pf.repo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${pfLane.cwd}/pf.txt`, "clean lane work\n");
    spawnSync("git", ["-C", pfLane.cwd, "add", "pf.txt"]);
    spawnSync("git", ["-C", pfLane.cwd, "commit", "-qm", "provfail lane work"]);
    await Bun.write(`${pf.repo}/.git/refs/notes/fleet`, "block\n"); // non-directory in the notes-ref path
    const pfBefore = headOf(pf.repo, pf.main);
    await landClean(pfLane.slot);
    const pfAfter = headOf(pf.repo, pf.main);
    check("V2: a land whose note-write FAILS still lands (main advanced, lane torn down)",
      pfAfter !== pfBefore && (await get(`/api/slots/${pfLane.slot}/merge`)).status === 400,
      `before=${pfBefore} after=${pfAfter}`);
    check("V2: the failed note-write left no note and did not wedge the land", readNote(pf.repo, pfAfter).ok === false);

    // --- G1: land provenance survives teardown failure. recordLand must couple to the
    // MAIN-MOVE (advanceIntegration), not the teardown: a landLane failure after a
    // successful advance previously left main ff'd with NO note while
    // the owner read „[Zitat entfernt]“ — a silent provenance hole on the human-gated action.
    // Lever: chmod the lane worktree dir read-only — every pre-land step is a read
    // (status/rebase-up-to-date/verify/advance-in-repo) and passes, but `git worktree
    // remove` cannot unlink the entries and fails deterministically.

    // (a1) CLEAN path (mergeJob): advance ok, landLane fails → verdict carries a distinct
    // landError, and the note exists anyway.
    const tf = await freshRepo("teardownfail");
    const tfLane = (await (await post("/api/lanes", { repo: tf.repo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${tfLane.cwd}/tf.txt`, "teardown-fail lane work\n");
    spawnSync("git", ["-C", tfLane.cwd, "add", "tf.txt"]);
    spawnSync("git", ["-C", tfLane.cwd, "commit", "-qm", "teardown-fail lane work"]);
    const tfBefore = headOf(tf.repo, tf.main);
    spawnSync("chmod", ["555", tfLane.cwd]); // the teardown obstacle
    await setMergeMode("blocked"); // clean rebase — agent must not be consulted
    await settleForMerge(tfLane.slot);
    await post(`/api/slots/${tfLane.slot}/merge`, {});
    const tfV = await waitMerge(tfLane.slot);
    spawnSync("chmod", ["755", tfLane.cwd]); // restore before asserting, whatever happened
    const tfAfter = headOf(tf.repo, tf.main);
    check("G1a setup: the obstacle held — main advanced but the lane survived on disk",
      tfAfter !== tfBefore && exists(tfLane.cwd), `before=${tfBefore} after=${tfAfter} exists=${exists(tfLane.cwd)}`);
    check("G1a: clean-path verdict reports the teardown failure as its own landError field (merged, landed:false)",
      !tfV.gone && tfV.last?.status === "merged" && tfV.last.landed === false
      && (tfV.last.landError ?? "").includes("worktree remove failed"),
      JSON.stringify(tfV.last));
    const tfNote = readNote(tf.repo, tfAfter);
    check("G1a: the moved main carries its fleet/land note despite the failed teardown",
      tfNote.ok && tfNote.json?.mainBefore === tfBefore && tfNote.json?.mainAfter === tfAfter
      && tfNote.json?.branch === tfLane.branch && tfNote.json?.confirmedByHuman === false,
      JSON.stringify(tfNote.json));
    await post(`/api/slots/${tfLane.slot}/kill`, {});

    // (a2) CONFIRM-land path: same invariant on the human-gated route — the response
    // reports the teardown failure distinctly instead of a bare "not landed" error.
    const tc = await freshRepo("teardownconfirm");
    const tcLane = (await (await post("/api/lanes", { repo: tc.repo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${tcLane.cwd}/base.txt`, "base\ntc-lane\n"); // conflict on base.txt → agent path
    spawnSync("git", ["-C", tcLane.cwd, "commit", "-aqm", "tc lane work"]);
    await Bun.write(`${tc.repo}/base.txt`, "base\ntc-main\n");
    spawnSync("git", ["-C", tc.repo, "commit", "-aqm", "tc main work"]);
    await setMergeMode("do");
    await settleForMerge(tcLane.slot);
    await post(`/api/slots/${tcLane.slot}/merge`, {});
    const tcV = await waitMerge(tcLane.slot);
    check("G1b setup: conflicting lane resolved + paused for review", !tcV.gone && tcV.last?.status === "resolved", JSON.stringify(tcV.last));
    const tcBefore = headOf(tc.repo, tc.main);
    spawnSync("chmod", ["555", tcLane.cwd]);
    const tcConfRes = await post(`/api/slots/${tcLane.slot}/merge`, { confirm: true });
    const tcConf = (await tcConfRes.json()) as { status?: string; landed?: boolean; landError?: string; error?: string };
    spawnSync("chmod", ["755", tcLane.cwd]);
    const tcAfter = headOf(tc.repo, tc.main);
    check("G1b setup: confirm-land advanced main, lane survived on disk",
      tcAfter !== tcBefore && exists(tcLane.cwd), `before=${tcBefore} after=${tcAfter} exists=${exists(tcLane.cwd)}`);
    check("G1b: confirm-land reports the teardown failure as its own landError field (merged, landed:false)",
      tcConf.status === "merged" && tcConf.landed === false
      && (tcConf.landError ?? "").includes("worktree remove failed"),
      `http=${tcConfRes.status} ${JSON.stringify(tcConf)}`);
    const tcNote = readNote(tc.repo, tcAfter);
    check("G1b: the confirm-land note exists despite the failed teardown, owned by the human",
      tcNote.ok && tcNote.json?.mainBefore === tcBefore && tcNote.json?.mainAfter === tcAfter
      && tcNote.json?.confirmedByHuman === true, JSON.stringify(tcNote.json));
    await post(`/api/slots/${tcLane.slot}/kill`, {});

    // (b) STALE-VERIFY guard: main moves between the verify (at resolve time) and the
    // owner's confirm; the replay lands cleanly — but the recorded verify never saw the
    // landed state („[Zitat entfernt]“). The note must mark it
    // stale, never carry a silently stale green.
    const sv = await freshRepo("staleverify");
    const svLane = (await (await post("/api/lanes", { repo: sv.repo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${svLane.cwd}/base.txt`, "base\nsv-lane\n"); // conflict → agent resolves, verify runs
    spawnSync("git", ["-C", svLane.cwd, "commit", "-aqm", "sv lane work"]);
    await Bun.write(`${sv.repo}/base.txt`, "base\nsv-main\n");
    spawnSync("git", ["-C", sv.repo, "commit", "-aqm", "sv main work"]);
    await setMergeMode("do");
    await settleForMerge(svLane.slot);
    await post(`/api/slots/${svLane.slot}/merge`, {});
    const svV = await waitMerge(svLane.slot);
    check("G1c setup: lane resolved with a green verify bound to the pre-move main",
      !svV.gone && svV.last?.status === "resolved" && svV.last.verify?.ok === true
      && typeof svV.last.verify.mainSha === "string", JSON.stringify(svV.last?.verify));
    const svVerifiedSha = svV.last?.verify?.mainSha ?? "";
    await Bun.write(`${sv.repo}/moved.txt`, "moved after verify\n"); // unrelated move → replay lands
    spawnSync("git", ["-C", sv.repo, "add", "moved.txt"]);
    spawnSync("git", ["-C", sv.repo, "commit", "-qm", "sv main moved after verify"]);
    const svConf = (await (await post(`/api/slots/${svLane.slot}/merge`, { confirm: true })).json()) as { status?: string; landed?: boolean };
    check("G1c setup: the replayed confirm-land landed", svConf.status === "merged" && svConf.landed === true, JSON.stringify(svConf));
    const svAfter = headOf(sv.repo, sv.main);
    const svNote = readNote(sv.repo, svAfter);
    const svNoteVerify = svNote.json?.verify as VerifyField | undefined;
    check("G1c: the landed note marks the outdated verify STALE (never a silently stale green)",
      svNote.ok && svNoteVerify?.ok === true && svNoteVerify.stale === true,
      JSON.stringify(svNoteVerify));
    check("G1c: the stale verify still names the main it actually verified (≠ the landed mainBefore)",
      svNoteVerify?.mainSha === svVerifiedSha && svNote.json?.mainBefore !== svVerifiedSha,
      `verified=${svVerifiedSha} mainBefore=${String(svNote.json?.mainBefore)}`);

    // --- REPAIR LOOP: a conflict resolution that rebases clean but FAILS verify is repaired
    // in-loop (the resolver is fed the exact failure and fixes it), so the human reviews a
    // GREEN resolution instead of a dead-ended red one. Still human-gated — never auto-landed.
    // Non-tautology: with MERGE_REPAIR_ROUNDS=0 the verdict would be verify.ok:false, repairRounds
    // absent; the assertions below require the flip false→true AND repairRounds>=1. ---
    const rl = await freshRepo("repairloop");
    const rlLane = (await (await post("/api/lanes", { repo: rl.repo })).json()) as { slot: number; cwd: string; branch: string };
    // the lane's conflicting line carries the VERIFYBAD sabotage marker; -X theirs (fakemerge "do")
    // keeps the lane side, so the resolution rebases clean but verify is RED — the loop's trigger.
    await Bun.write(`${rlLane.cwd}/base.txt`, "base\nrl-lane VERIFYBAD\n");
    spawnSync("git", ["-C", rlLane.cwd, "commit", "-aqm", "rl lane work (sabotaged)"]);
    await Bun.write(`${rl.repo}/base.txt`, "base\nrl-main\n"); // same line on main → conflict → agent
    spawnSync("git", ["-C", rl.repo, "commit", "-aqm", "rl main work"]);
    await setMergeMode("do");
    await settleForMerge(rlLane.slot);
    await post(`/api/slots/${rlLane.slot}/merge`, {});
    const rlV = await waitMerge(rlLane.slot);
    check("repair loop: a resolution that fails verify is repaired to GREEN, still paused for review (not landed)",
      !rlV.gone && rlV.last?.status === "resolved" && rlV.last?.landed === false
      && rlV.last?.verify?.ok === true && (rlV.last?.repairRounds ?? 0) >= 1, JSON.stringify(rlV.last));
    // assert the FACT, not just the verdict: the marker is actually gone from the repaired tree
    check("repair loop: the VERIFYBAD marker is actually scrubbed from the repaired lane tree",
      !spawnSync("git", ["-C", rlLane.cwd, "grep", "-I", "VERIFYBAD"]).stdout.toString().includes("VERIFYBAD"),
      spawnSync("git", ["-C", rlLane.cwd, "log", "--oneline", "-3"]).stdout.toString());
    // and it never reached main — the human still gates the land
    check("repair loop: the repaired resolution has NOT auto-landed onto main",
      !spawnSync("git", ["-C", rl.repo, "log", "--oneline", "-5"]).stdout.toString().includes("rl lane work"),
      spawnSync("git", ["-C", rl.repo, "log", "--oneline", "-5"]).stdout.toString());

    // --- VERIFICATION TIER 2, DEFAULT OFF: the post-land audit is configured by a command
    // (FLEET_POSTLAND_AUDIT_CMD), and this suite sets none. Every land above — clean-path,
    // confirm-land, teardown-failure, stale-verify — therefore has to leave the land path exactly
    // as it was: no audit spawned, no trail, nothing on the board. The ON behaviour lives in its
    // own harness (./e2e-postland-audit.sh), which is also why an accidental nested suite run is
    // structurally impossible here: with no command set there is nothing to spawn.
    // tolerate a non-JSON body (a server without the route answers 404/HTML): this must fail as
    // ONE check, not abort the suite at the parse — the checks after it are unrelated
    const pla = (await (await get("/api/post-land-audits")).json().catch(() => ({}))) as
      { audits?: unknown[]; total?: number; configured?: boolean };
    check("tier 2 default OFF: no command configured, so none of this suite's lands audited anything",
      pla.configured === false && pla.total === 0 && pla.audits?.length === 0, JSON.stringify(pla));
    check("tier 2 default OFF: the board's poll payload carries no audit result",
      (((await (await get("/api/sessions")).json()) as { postLandAudit: unknown }).postLandAudit ?? null) === null);

    // A TORN row must read as a hole, not as a cap. Every ledger route used to answer
    // `total: lines.length` while the array excluded whatever it could not parse, so one
    // half-written mid-append line arrived at the client as the benign "latest 1 of 2" message —
    // a lost row rendered as a display limit. This trail is the one ledger nothing in this suite
    // writes (tier 2 is OFF here), so it can be planted deterministically and removed again.
    const plaFile = `${ROOT}/post-land-audits.jsonl`;
    await Bun.write(plaFile, `${JSON.stringify({ at: 1, result: "green", covers: [] })}\n`
      + `{"at":2,"result":"red","cove\n`  // a mid-append tear: the writer died between bytes
      + `${JSON.stringify({ at: 3, result: "green", covers: [] })}\n`);
    const plaTorn = (await (await get("/api/post-land-audits")).json().catch(() => ({}))) as
      { audits?: unknown[]; total?: number; malformed?: number };
    check("ledger read: a torn row is COUNTED as malformed, never folded into the total",
      plaTorn.malformed === 1 && plaTorn.total === 2 && plaTorn.audits?.length === 2, JSON.stringify(plaTorn));
    rmSync(plaFile, { force: true });
    check("ledger read: the planted trail is gone again (tier 2 stays OFF for the rest of the suite)",
      (((await (await get("/api/post-land-audits")).json()) as { total?: number; malformed?: number }).total === 0)
      && ((await (await get("/api/post-land-audits")).json()) as { malformed?: number }).malformed === 0);

    await setMergeMode("blocked"); // restore the suite default for later tests in this scope

    // NO LANE OF THIS MODULE OUTLIVES IT. The repair-loop lane is human-gated by design and never
    // lands, so it stayed open — on a repo of its own whose primary branch is `main` too, and
    // server.ts#laneFacts keys each lane repo's primary checkout by its branch: a later module's
    // rundgang map could then carry THIS repo under `main` (steward-core "lane map includes the
    // primary checkout keyed by its branch", shard 2/3 of preview f1a1dadc4f1e, 2026-10-10, the
    // first plan to put `lanes` and `core` into one shard). Every slot still open on a repo this
    // module made is killed here.
    const mine = new Set(madeRepos.map((r) => { try { return realpathSync(r); } catch { return r; } }));
    const open = ((await (await get("/api/sessions")).json()) as { slots: { id: number; worktree?: { repo: string } | null }[] }).slots
      .filter((x) => { const r = x.worktree?.repo; if (!r) return false; try { return mine.has(realpathSync(r)); } catch { return mine.has(r); } });
    for (const x of open) await post(`/api/slots/${x.id}/kill`, {});
  }
}
