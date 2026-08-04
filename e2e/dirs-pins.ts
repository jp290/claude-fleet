// The directory picker API and the pin list it surfaces.
import { mkdir, writeFile } from "node:fs/promises";
import { check, get, post, ROOT } from "./harness";

interface DirsResp { path: string; dirs: string[]; total: number; capped: boolean }
interface FindResp { path: string; find: string; visited: number; slow: number; truncated: boolean;
  hits: { path: string; name: string; repo: boolean; wt: boolean }[] }

// a tree of known shape to browse and search: one match three levels down, one dotfolder, and one
// folder with more children than a listing serves
async function pickerFixture(): Promise<string> {
  const base = `${ROOT}/pkfix`;
  await mkdir(`${base}/alpha/a1/needlehere`, { recursive: true });
  await mkdir(`${base}/alpha/a2`, { recursive: true });
  await mkdir(`${base}/beta`, { recursive: true });
  await mkdir(`${base}/.dotzone`, { recursive: true });
  // a .git DIRECTORY: the walk must classify its parent as a repo and never descend into it
  await mkdir(`${base}/alpha/.git/needlehere`, { recursive: true });
  await writeFile(`${base}/alpha/file.txt`, "");
  for (let i = 0; i < 205; i++) await mkdir(`${base}/wide/d${String(i).padStart(3, "0")}`, { recursive: true });
  return base;
}

export async function run(): Promise<void> {
  // --- directory picker API ---
  const dirs = (await (await get("/api/dirs?path=~")).json()) as { path: string; dirs: string[]; common: string[]; recents: string[] };
  check("/api/dirs lists home", Array.isArray(dirs.dirs) && dirs.dirs.includes("claude-fleet"), `${dirs.dirs.length} dirs`);
  check("/api/dirs common includes home", dirs.common.includes(dirs.path));
  const badDirs = await get("/api/dirs?path=/nonexistent-xyz");
  check("/api/dirs rejects bad path", badDirs.status === 400);
  const dirs2 = (await (await get("/api/dirs?path=~")).json()) as { pins: string[]; worktrees: string[]; repos: string[] };
  check("/api/dirs exposes pins + worktrees arrays", Array.isArray(dirs2.pins) && Array.isArray(dirs2.worktrees) && Array.isArray(dirs2.repos));

  // --- pins ---
  const pinPath = `${process.env.HOME}/claude-fleet`;
  const pinAdd = (await (await post("/api/pins", { path: pinPath, on: true })).json()) as { ok: boolean; pins: string[] };
  check("pin add returns updated list", pinAdd.ok === true && pinAdd.pins.includes(pinPath), JSON.stringify(pinAdd.pins));
  const dirsPinned = (await (await get("/api/dirs?path=~")).json()) as { pins: string[] };
  check("/api/dirs surfaces the pin", dirsPinned.pins.includes(pinPath));
  const pinDup = (await (await post("/api/pins", { path: pinPath, on: true })).json()) as { pins: string[] };
  check("re-pinning does not duplicate", pinDup.pins.filter((p) => p === pinPath).length === 1, JSON.stringify(pinDup.pins));
  const pinBad = await post("/api/pins", { path: "  " });
  check("pin rejects empty path", pinBad.status === 400);
  const pinDel = (await (await post("/api/pins", { path: pinPath, on: false })).json()) as { pins: string[] };
  check("unpin removes it", !pinDel.pins.includes(pinPath), JSON.stringify(pinDel.pins));

  // --- what the listing LEAVES OUT, and the search that reaches past one level ---
  // All three of these were silent before: a listing cut at 200 with no way to tell, dotfolders
  // filtered unconditionally, and a filter that could only ever match the rows already rendered.
  const fx = await pickerFixture();
  const small = (await (await get(`/api/dirs?path=${encodeURIComponent(fx)}`)).json()) as DirsResp;
  check("/api/dirs reports the full count, not just what it served",
    small.total === 3 && small.capped === false, JSON.stringify(small.dirs));
  const wide = (await (await get(`/api/dirs?path=${encodeURIComponent(`${fx}/wide`)}`)).json()) as DirsResp;
  check("/api/dirs says so when the 200-entry cap bit",
    wide.dirs.length === 200 && wide.total === 205 && wide.capped === true,
    `served ${wide.dirs.length} of ${wide.total}, capped ${wide.capped}`);

  check("/api/dirs hides dotfolders by default", !small.dirs.includes(".dotzone"), JSON.stringify(small.dirs));
  const dot = (await (await get(`/api/dirs?path=${encodeURIComponent(fx)}&hidden=1`)).json()) as DirsResp;
  check("/api/dirs?hidden=1 lists them", dot.dirs.includes(".dotzone"), JSON.stringify(dot.dirs));

  const found = (await (await get(`/api/dirs?path=${encodeURIComponent(fx)}&find=needle`)).json()) as FindResp;
  check("/api/dirs?find reaches a folder three levels down",
    found.hits.length === 1 && found.hits[0].path === `${fx}/alpha/a1/needlehere`,
    JSON.stringify(found.hits.map((h) => h.path)));
  check("a search that saw the whole tree does not claim it was cut short",
    found.truncated === false && found.slow === 0, JSON.stringify(found));
  // the same name sits inside alpha/.git — a search that walked git's plumbing would return two
  check("the search never descends into .git",
    !found.hits.some((h) => h.path.includes("/.git/")), JSON.stringify(found.hits.map((h) => h.path)));
  const findDot = (await (await get(`/api/dirs?path=${encodeURIComponent(fx)}&find=dotzone`)).json()) as FindResp;
  const findDotOn = (await (await get(`/api/dirs?path=${encodeURIComponent(fx)}&find=dotzone&hidden=1`)).json()) as FindResp;
  check("the search obeys the same dotfolder rule as the listing",
    findDot.hits.length === 0 && findDotOn.hits.length === 1,
    `off ${findDot.hits.length}, on ${findDotOn.hits.length}`);
  const miss = (await (await get(`/api/dirs?path=${encodeURIComponent(fx)}&find=zzzz`)).json()) as FindResp;
  check("a query that matches nothing is an empty answer, not an error",
    Array.isArray(miss.hits) && miss.hits.length === 0 && miss.truncated === false, JSON.stringify(miss));
  const findBad = await get("/api/dirs?path=/nonexistent-xyz&find=a");
  check("a search on a bad path is refused like a listing on one", findBad.status === 400);
  // the repo badge has to survive the walk: a hit is offered as a place to start a lane
  const repoHit = (await (await get(`/api/dirs?path=${encodeURIComponent(fx)}&find=alpha`)).json()) as FindResp;
  check("a hit carries whether it is a git repo",
    repoHit.hits.length === 1 && repoHit.hits[0].repo === true && repoHit.hits[0].wt === false,
    JSON.stringify(repoHit.hits));
}
