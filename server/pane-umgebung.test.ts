// Mangel 135: eine Pane einer Testinstanz erbte FLEET_TOKEN und jede andere FLEET_* ihres Servers, weil der tmux-Server
// die Umgebung des Prozesses übernimmt, der ihn startet. Geprüft wie die Instanz es tut: ein Prozess mit der Umgebung
// eines Instanz-Servers startet über server/tmux.ts den ersten tmux-Server seines Sockets und eine Pane darin.
import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

// unter /tmp: der Socket-Pfad unter macOS' tmpdir() ist für tmux zu lang
const dir = mkdtempSync("/tmp/fpu-");
const SOCK = `pane-umgebung-${process.pid}`;
afterAll(() => {
  Bun.spawnSync(["tmux", "-L", SOCK, "kill-server"], { env: { ...process.env, TMUX_TMPDIR: dir } });
  rmSync(dir, { recursive: true, force: true });
});

test("eine Pane trägt kein FLEET_TOKEN und keine andere FLEET_* ihres Servers, aber was ihre Zeile selbst exportiert", async () => {
  const out = join(dir, "pane-env");
  const script = join(dir, "start.ts");
  await Bun.write(script, `import { tmux, tmuxNewSession } from ${JSON.stringify(join(import.meta.dir, "tmux.ts"))};
await tmux("start-server");
const r = await tmuxNewSession("-d", "-s", "s1", ${JSON.stringify(`export FLEET_SELF_SLOT='1'; env > '${out}'; sleep 30`)});
if (r.code !== 0) console.error(r.err);
process.exit(r.code ?? 1);
`);
  // cwd außerhalb des Checkouts: Bun lädt sonst dessen .env in den Prozess
  const p = Bun.spawnSync([process.execPath, script], {
    cwd: dir,
    env: {
      PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: dir, TMUX_TMPDIR: dir, LANG: "en_US.UTF-8",
      FLEET_SOCK: SOCK, FLEET_TOKEN: "instanz-ausweis", FLEET_PORT: "8999", FLEET_CMD: "true",
      FLEET_REAL_SEAT_REGISTRY: join(dir, "sitze"), FLEET_CLAUDE_HOME: dir,
    },
  });
  expect([p.exitCode, p.stderr.toString()]).toEqual([0, ""]);
  let text = "";
  for (let i = 0; i < 50 && !text.includes("FLEET_SELF_SLOT"); i++) {
    await Bun.sleep(100);
    try { text = readFileSync(out, "utf8"); } catch { /* die Pane hat noch nicht geschrieben */ }
  }
  const namen = text.split("\n").map((l) => l.split("=")[0]).filter(Boolean);
  expect(namen.filter((n) => n.startsWith("FLEET_"))).toEqual(["FLEET_SELF_SLOT"]);
  expect(namen).toContain("TMUX");
  expect(text).toContain(`HOME=${dir}\n`);
});
