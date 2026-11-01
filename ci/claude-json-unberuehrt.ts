// THE UNIT SUITE LEAVES THE CALLER'S ~/.claude.json AS IT FOUND IT. Preloaded by bunfig.toml, so these two hooks run once around the whole
// `bun test` run. Fleet writes a folder's trust into Claude Code's config before a seat starts (server/claude-vertrauen.ts); a test that starts
// a server under the caller's HOME therefore wrote trust entries for its temp fixtures into the owner's real file (two were found there on
// 31.10., from server/branches-testkit.ts). The owner's live sessions rewrite that file all the time, so the guard can't ask for byte equality.
// It asks what only a test leaves: a project key ADDED during the run, for a folder under a temp root that is GONE when the run ends (a
// test removes its fixtures; a live session's folder still stands). Such a key turns the run red and is named. A test that starts a
// server gives it a HOME of its own (server/branches-testkit.ts#KIT_HOME). Cleanup: bun tools/vertrauen-vergessen.ts <temp folder>.
import { afterAll, beforeAll } from "bun:test";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { claudeJsonPfad } from "../server/claude-vertrauen";

const DATEI = claudeJsonPfad(homedir());

/** The project keys of Claude Code's config; null when there is no readable file (nothing to compare). */
export function projektSchluessel(datei: string): string[] | null {
  try {
    const o = JSON.parse(readFileSync(datei, "utf8")) as { projects?: unknown };
    return o.projects && typeof o.projects === "object" && !Array.isArray(o.projects) ? Object.keys(o.projects) : [];
  } catch { return null; }
}

const tempWurzeln = (): string[] => {
  const t = tmpdir();
  let echt = t;
  try { echt = realpathSync(t); } catch { /* as named */ }
  return [...new Set([t, echt, "/tmp", "/private/tmp", "/var/folders", "/private/var/folders"].map((p) => p.replace(/\/+$/, "")))];
};

/** Keys a test left: added since `vorher`, under a temp root, and their folder no longer exists. */
export function testSpuren(vorher: string[], nachher: string[], wurzeln = tempWurzeln(), gibt: (pfad: string) => boolean = existsSync): string[] {
  const alt = new Set(vorher);
  return nachher.filter((k) => !alt.has(k) && wurzeln.some((w) => k.startsWith(`${w}/`)) && !gibt(k));
}

let vorher: string[] | null = null;
beforeAll(() => { vorher = projektSchluessel(DATEI); });
afterAll(() => {
  const nachher = projektSchluessel(DATEI);
  if (!vorher || !nachher) return;
  const spuren = testSpuren(vorher, nachher);
  if (spuren.length > 0)
    throw new Error(`the unit suite left ${spuren.length} trust entr${spuren.length === 1 ? "y" : "ies"} in ${DATEI}: ${spuren.join(", ")} — a test that starts a server gives it a HOME of its own (ci/claude-json-unberuehrt.ts)`);
});
