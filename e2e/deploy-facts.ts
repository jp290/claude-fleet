// The two deploy facts on the OWNER's poll: is the running server the committed code, and is the
// built bundle the committed client. Both existed before this family — but only on /api/steward/*,
// so the one principal who can act on them could not see them.
//
// Everything here is driven through FLEET_REPO_DIR, which is what deployGap() and bundleStale()
// both read. A fixture repo therefore lets the facts be MADE true rather than waited for: the
// checks below commit into it and re-time its files, instead of asserting whatever the real
// checkout happens to look like while the suite runs.
//
// The facts are cached on the 10 s git tick (see refreshDeployFacts), so every assertion polls for
// the value it expects rather than reading once and hoping the tick already fired.
import { mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { check, get, restartSrv } from "./harness";

const TMP = process.env.TMPDIR ?? "/tmp";
const FIX = `${TMP}/fleet-e2e-deploy-${process.pid}`;

interface Gap { bootHead: string | null; head: string | null; behindCount: number | null; codeBehind: boolean | null }
interface Bundle { appJsMtime: number | null; shareJsMtime: number | null; srcNewestMtime: number | null; stale: boolean | null }
interface Facts { deployGap?: Gap | null; bundleStale?: Bundle | null }

const facts = async (): Promise<Facts> => (await (await get("/api/sessions")).json()) as Facts;

// the tick is 10 s wide, so "not yet" and "wrong" are different answers. Poll for the expected
// shape and report the LAST reading on failure — a bare false would say nothing about which.
async function settle(want: (f: Facts) => boolean, ms = 14_000): Promise<Facts> {
  const until = Date.now() + ms;
  let last: Facts = {};
  for (;;) {
    last = await facts().catch(() => ({}) as Facts);
    if (want(last) || Date.now() > until) return last;
    await Bun.sleep(400);
  }
}

const git = (...args: string[]): void => {
  spawnSync("git", ["-C", FIX, ...args], { encoding: "utf8" });
};
const commit = (file: string, body: string): void => {
  writeFileSync(`${FIX}/${file}`, body);
  git("add", "-A");
  git("-c", "user.email=e2e@local", "-c", "user.name=e2e", "commit", "-m", `touch ${file}`);
};

export async function run(): Promise<void> {
  rmSync(FIX, { recursive: true, force: true });
  mkdirSync(`${FIX}/public`, { recursive: true });
  mkdirSync(`${FIX}/src`, { recursive: true });
  writeFileSync(`${FIX}/public/app.js`, "// bundle");
  writeFileSync(`${FIX}/public/share.js`, "// bundle");
  writeFileSync(`${FIX}/src/client.ts`, "// source");
  git("init", "-q");
  commit("server.ts", "// v1");

  // ===== §1 the facts reach the owner's own poll at all — the whole point of this family =====
  await restartSrv({ FLEET_REPO_DIR: FIX });
  {
    const f = await settle((x) => x.deployGap != null);
    check("§1 /api/sessions carries deployGap — not steward-only any more",
      f.deployGap != null, JSON.stringify(f.deployGap));
    check("§1 /api/sessions carries bundleStale — its twin, same reason",
      f.bundleStale != null, JSON.stringify(f.bundleStale));
    check("§1 a server booted from HEAD reports no gap, and says so as false, not as null",
      f.deployGap?.behindCount === 0 && f.deployGap.codeBehind === false, JSON.stringify(f.deployGap));
  }

  // ===== §2 a commit the server has not booted =====
  // DOC-ONLY FIRST, on purpose: once a server-code commit is in the range it stays in it, so the
  // "a doc commit is not a deploy" claim can only be made while the range holds nothing else.
  commit("notes.md", "# just docs");
  {
    const f = await settle((x) => x.deployGap?.behindCount === 1);
    check("§2 a commit after boot is counted",
      f.deployGap?.behindCount === 1, JSON.stringify(f.deployGap));
    check("§2 a docs-only commit is NOT a deploy — restarting srv would change nothing",
      f.deployGap?.codeBehind === false, JSON.stringify(f.deployGap));
  }
  commit("server.ts", "// v2");
  {
    const f = await settle((x) => x.deployGap?.codeBehind === true);
    check("§2 a server-code commit IS a deploy — this is the line the owner never saw",
      f.deployGap?.codeBehind === true && f.deployGap.behindCount === 2, JSON.stringify(f.deployGap));
    check("§2 the boot commit is still named, so the gap is attributable and not just a count",
      /^[0-9a-f]{40}$/.test(f.deployGap?.bootHead ?? ""), JSON.stringify(f.deployGap?.bootHead));
  }

  // ===== §3 the bundle half: mtimes, not commits =====
  // Re-timed rather than rewritten: the fact is a comparison of mtimes, so driving the mtimes IS
  // driving the fact, and it needs no sleep to make one side older than the other.
  {
    const old = new Date(Date.now() - 60 * 60_000);
    utimesSync(`${FIX}/public/app.js`, old, old);
    utimesSync(`${FIX}/public/share.js`, old, old);
    const f = await settle((x) => x.bundleStale?.stale === true);
    check("§3 a bundle older than src/ is stale — landed client code invisible in the browser",
      f.bundleStale?.stale === true, JSON.stringify(f.bundleStale));
    const now = new Date();
    utimesSync(`${FIX}/public/app.js`, now, now);
    utimesSync(`${FIX}/public/share.js`, now, now);
    const g = await settle((x) => x.bundleStale?.stale === false);
    check("§3 rebuilding clears it — the fact follows the filesystem, it is not sticky",
      g.bundleStale?.stale === false, JSON.stringify(g.bundleStale));
  }

  // ===== §4 what it does NOT know is null, never false =====
  // The honesty rule both facts are built on: an unmeasurable answer must not read as "all clear",
  // which is exactly what a `false` would read as on the owner's board.
  {
    const bare = `${FIX}-notarepo`;
    rmSync(bare, { recursive: true, force: true });
    mkdirSync(bare, { recursive: true });
    await restartSrv({ FLEET_REPO_DIR: bare });
    const f = await settle((x) => x.deployGap != null && x.deployGap.bootHead === null);
    check("§4 no git repo → the gap is UNKNOWN (null), never a reassuring false",
      f.deployGap?.bootHead === null && f.deployGap.codeBehind === null && f.deployGap.behindCount === null,
      JSON.stringify(f.deployGap));
    check("§4 no bundle on disk → staleness is UNKNOWN too, and the mtimes say why",
      f.bundleStale?.stale === null && f.bundleStale.appJsMtime === null, JSON.stringify(f.bundleStale));
    rmSync(bare, { recursive: true, force: true });
  }

  // back to the wrapper's own env for every module after this one
  await restartSrv();
  rmSync(FIX, { recursive: true, force: true });
  check("§4 the real checkout is measurable again after the fixture is gone",
    (await settle((x) => x.deployGap?.bootHead != null)).deployGap?.bootHead != null);
}
