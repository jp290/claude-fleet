// The directory picker API and the pin list it surfaces.
import { check, get, post } from "./harness";

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
}
