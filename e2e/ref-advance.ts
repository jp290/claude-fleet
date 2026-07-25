// Landing by advancing the integration ref (primary parked off-main, dirty on the lane's file),
// and the matching fork point for a new lane.
import { spawnSync } from "node:child_process";
import { REPO, check, post } from "./harness";
import { exists, setMergeMode, settleForMerge, waitMerge } from "./lane-helpers";

export async function run(): Promise<void> {
  // --- issue 3: ref-advance land. With the integration branch checked out NOWHERE (the
  // primary parked on a working branch), landing advances the ref via `git branch -f` and
  // touches no working tree — so a dirty primary on the SAME file the lane changed no longer
  // blocks the land, and the primary's uncommitted work survives untouched. This is the whole
  // point of the split: it makes the historic "primary-checkout land collision" impossible. ---
  {
    const raRepo = `${REPO}.refadvance`;
    spawnSync("git", ["init", "-q", raRepo]);
    spawnSync("git", ["-C", raRepo, "config", "user.email", "e2e@test"]);
    spawnSync("git", ["-C", raRepo, "config", "user.name", "e2e"]);
    await Bun.write(`${raRepo}/deck.html`, "base\n");
    spawnSync("git", ["-C", raRepo, "add", "deck.html"]);
    spawnSync("git", ["-C", raRepo, "commit", "-qm", "base"]);
    const integ = spawnSync("git", ["-C", raRepo, "rev-parse", "--abbrev-ref", "HEAD"]).stdout.toString().trim();
    const baseSha = spawnSync("git", ["-C", raRepo, "rev-parse", "HEAD"]).stdout.toString().trim();

    // a lane that edits deck.html and commits (clean descendant → server's clean-rebase path)
    const ra = (await (await post("/api/lanes", { repo: raRepo })).json()) as { slot: number; cwd: string };
    await Bun.write(`${ra.cwd}/deck.html`, "lane animation rebuild\n");
    spawnSync("git", ["-C", ra.cwd, "commit", "-aqm", "lane: animation rebuild"]);

    // park the primary OFF the integration branch, dirty on the SAME file the lane changed —
    // the exact collision that used to block the land — then declare the integration branch
    spawnSync("git", ["-C", raRepo, "checkout", "-q", "-b", "desk"]);
    await Bun.write(`${raRepo}/deck.html`, "owner's in-progress live edit — must survive\n");
    await post("/api/repo-base", { repo: raRepo, branch: integ });

    await settleForMerge(ra.slot);
    await setMergeMode("blocked"); // agent must NOT be consulted for a clean descendant
    await post(`/api/slots/${ra.slot}/merge`, {});
    const raV = await waitMerge(ra.slot);
    check("ref-advance: land succeeds with the primary parked off-main AND dirty on the lane's file",
      raV.gone && !exists(ra.cwd), JSON.stringify(raV));
    const integSha = spawnSync("git", ["-C", raRepo, "rev-parse", integ]).stdout.toString().trim();
    check("ref-advance: integration branch ref advanced to include the lane commit (branch -f)",
      integSha !== baseSha && spawnSync("git", ["-C", raRepo, "log", "--oneline", integ]).stdout.toString().includes("animation rebuild"),
      `integ=${integSha} base=${baseSha}`);
    const deskHead = spawnSync("git", ["-C", raRepo, "rev-parse", "--abbrev-ref", "HEAD"]).stdout.toString().trim();
    const deskFile = await Bun.file(`${raRepo}/deck.html`).text();
    check("ref-advance: primary stayed on desk with its dirty edit untouched by the land",
      deskHead === "desk" && deskFile.includes("owner's in-progress live edit"),
      `head=${deskHead} file=${JSON.stringify(deskFile)}`);
    await post("/api/repo-base", { repo: raRepo, branch: "" }); // clear config
  }

  // --- issue 5: fork point. A new lane forks from the integration branch, NOT the parked
  // primary HEAD — so lanes created while the primary sits on `desk` still branch from `main`
  // and don't inherit desk-only commits. ---
  {
    const fpRepo = `${REPO}.forkpoint`;
    spawnSync("git", ["init", "-q", fpRepo]);
    spawnSync("git", ["-C", fpRepo, "config", "user.email", "e2e@test"]);
    spawnSync("git", ["-C", fpRepo, "config", "user.name", "e2e"]);
    await Bun.write(`${fpRepo}/f.txt`, "base\n");
    spawnSync("git", ["-C", fpRepo, "add", "f.txt"]);
    spawnSync("git", ["-C", fpRepo, "commit", "-qm", "base"]);
    const fpInteg = spawnSync("git", ["-C", fpRepo, "rev-parse", "--abbrev-ref", "HEAD"]).stdout.toString().trim();
    // park the primary on desk and add a DESK-ONLY commit the integration branch never sees
    spawnSync("git", ["-C", fpRepo, "checkout", "-q", "-b", "desk"]);
    await Bun.write(`${fpRepo}/desk-only.txt`, "desk\n");
    spawnSync("git", ["-C", fpRepo, "add", "desk-only.txt"]);
    spawnSync("git", ["-C", fpRepo, "commit", "-qm", "desk-only commit"]);
    await post("/api/repo-base", { repo: fpRepo, branch: fpInteg });

    const fp = (await (await post("/api/lanes", { repo: fpRepo })).json()) as { slot: number; cwd: string };
    const laneLog = spawnSync("git", ["-C", fp.cwd, "log", "--oneline"]).stdout.toString();
    const laneHasDeskFile = exists(`${fp.cwd}/desk-only.txt`);
    check("issue5: lane forks from the integration branch, not the desk-only primary HEAD",
      !laneLog.includes("desk-only commit") && !laneHasDeskFile, `log=${JSON.stringify(laneLog.trim())} deskFile=${laneHasDeskFile}`);
    await post("/api/repo-base", { repo: fpRepo, branch: "" });
    await post(`/api/slots/${fp.slot}/kill`, {});
  }
}
