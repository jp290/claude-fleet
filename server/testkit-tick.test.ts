// EIN TESTSERVER LIEST GIT-TATSACHEN OHNE ANSTOSS (W3 Auftrag 13): server.ts fährt den Git-Tick nur unter `if (import.meta.main)`, und ein Server aus
// server/branches-testkit.ts (serve → server/nachbar.drive.ts) importiert es als Modul — er tickte nie von selbst, und ein Test, der Branch und Kopf
// las, musste den Tick mit einer Mutation anstoßen. Hier: ein Commit nach dem Start, danach nur noch lesende Aufrufe — der Kopf kommt trotzdem an.
import { afterAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { branchTestkit, commitIn, type Fixture, LIFE_DEADLINE_MS, persisted, post, sh } from "./branches-testkit";

const { fixture, life, serve, cleanup } = branchTestkit();
afterAll(cleanup);
const tokenOf = (f: Fixture, slot: number): string => String((persisted(f).slots as Record<string, { selfToken?: string }>)[String(slot)]?.selfToken);

describe("der Git-Tick im Testserver", () => {
  test("ein Commit nach dem Start erscheint in der Übersicht, ohne dass ein Test den Tick anstößt", async () => {
    const f = fixture();
    const wt = join(f.state, "wt-tick");
    sh(f.repo, "worktree", "add", "-q", "-b", "feat-tick", wt);
    await life(f, [post("/api/slots/1/open", { cwd: wt })]);
    const srv = await serve(f, { FLEET_GIT_TICK_MS: "1000" });
    try {
      commitIn(wt, "tick.txt", "nach dem Start");
      const head = sh(wt, "rev-parse", "HEAD");
      let kopf: unknown = null;
      for (let i = 0; i < 60 && kopf !== head; i++) {
        await Bun.sleep(200);
        const bild = await srv.call("/api/self/overview", { self: tokenOf(f, 1) });
        kopf = (bild.body.me as { seat?: { branch?: { head?: string } | null } } | undefined)?.seat?.branch?.head ?? null;
      }
      expect(kopf).toBe(head);
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 4);
});
