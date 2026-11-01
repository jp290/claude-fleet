// MAIN'S OWN MESSAGE LOADER, as it stood at the commit a rollback of W1 lands on (491bcd016): the five files server/types.ts needs
// at run time, taken from git into a temporary folder and imported from there. A test that hands this loader what the current
// server writes proves that a rollback reads the mailbox instead of booting it empty (Prüfung W1, Befund 4a).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const ROLLBACK_COMMIT = "491bcd016";
export type MainLoad = (v: unknown) => { ok: boolean; error?: string; messages?: { entries: unknown[]; dropped: number } };

export async function mainLoadMessages(): Promise<{ load: MainLoad; cleanup: () => void }> {
  const dir = mkdtempSync(join(tmpdir(), "w1-main-lader-"));
  const files = ["server/types.ts", "lane-signals.ts", "src/protocol.ts", "server/postfach-befund.ts", "model-register.ts"];
  const tar = join(dir, "main.tar");
  const arch = Bun.spawnSync(["git", "archive", "-o", tar, ROLLBACK_COMMIT, ...files], { cwd: join(import.meta.dir, "..") });
  if (arch.exitCode !== 0)
    throw new Error(`git archive ${ROLLBACK_COMMIT}: ${arch.stderr.toString()} — the test needs the commit a rollback lands on`);
  if (Bun.spawnSync(["tar", "-xf", tar, "-C", dir]).exitCode !== 0) throw new Error("tar -xf failed");
  const mod = await import(join(dir, "server/types.ts")) as { loadMessages: MainLoad };
  return { load: mod.loadMessages, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
