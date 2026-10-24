// Die Pi-Attrappe der Suite (e2e-isolated.sh, fake-pi.c) nimmt einen Paste wie eine echte TUI an:
// Ein Bündel aus zwei Events mit Zeilenumbrüchen steht ganz im Composer und wird mit einem Enter
// ein Turn (Board-Zeile ebc59a6f). Vorher schickte sie jede Zeile einzeln ab, und jedes Bündel
// wartete das volle Ankunftsfenster ab. Der Test kompiliert die Attrappe aus dem Wrapper selbst und
// fügt so ein, wie server.ts#sendText es tut: tmux load-buffer, dann paste-buffer -p.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { composerArrival } from "../composer";

const dir = mkdtempSync(join(tmpdir(), "fake-pi-paste-"));
const sock = `fakepi${process.pid}`;
const state = join(dir, "state");
const turns = `${state}.turns`;
const tmux = (...args: string[]) => Bun.spawnSync(["tmux", "-L", sock, ...args], { stdin: "pipe" });
const payload = [
  "[fleet-ereignis 1/2 · ca2109541459a1f34854108e]",
  "[fleet] post-land audit [event ca2109541459a1f34854108e] reached terminal result=green.",
  "",
  "[fleet-ereignis 2/2 · 7368b438573e39d0056272fa]",
  "[fleet] post-land audit [event 7368b438573e39d0056272fa] reached terminal result=green.",
].join("\n");

const until = async (ok: () => boolean, ms = 5000): Promise<boolean> => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (ok()) return true; await Bun.sleep(50); }
  return ok();
};
const read = (f: string): string => existsSync(f) ? readFileSync(f, "utf8") : "";
// was die Attrappe als Turns abgeschickt hat, ohne die Zeilen ihrer Kopfzeilen
const sentTurns = (): string[] => read(turns).split(/\n===TURN \d+===\n/).slice(1);
// die Zeilen zwischen den letzten zwei Linien des Bildschirms: der Composer, wie der Server ihn liest
const composerRows = (): string[] => {
  const rows = new TextDecoder().decode(tmux("capture-pane", "-p", "-t", "pi").stdout).split("\n");
  const rules = rows.flatMap((r, i) => r.startsWith("────") ? [i] : []);
  return rules.length < 2 ? [] : rows.slice(rules.at(-2)! + 1, rules.at(-1)!);
};

beforeAll(async () => {
  const wrapper = readFileSync(join(import.meta.dir, "..", "e2e-isolated.sh"), "utf8");
  const source = /cat > "\$DIR\/fake-pi\.c" <<'EOF'\n([\s\S]*?)\nEOF\n/.exec(wrapper)![1]!;
  writeFileSync(join(dir, "fake-pi.c"), source);
  const cc = Bun.spawnSync([process.env.CC ?? "cc", "-o", join(dir, "pi"), join(dir, "fake-pi.c")]);
  if (cc.exitCode !== 0) throw new Error(`fake-pi.c compiles: ${cc.stderr.toString()}`);
  writeFileSync(join(dir, "mode"), "normal\n");
  tmux("new-session", "-d", "-s", "pi", "-x", "200", "-y", "50",
    "-e", `FLEET_E2E_COMPOSER_MODE=${join(dir, "mode")}`, "-e", `FLEET_E2E_COMPOSER_STATE=${state}`, join(dir, "pi"));
  if (!await until(() => read(state).startsWith("ready"))) throw new Error("the stand-in came up");
  const load = Bun.spawnSync(["tmux", "-L", sock, "load-buffer", "-b", "fleet", "-"], { stdin: new TextEncoder().encode(payload) });
  if (load.exitCode !== 0) throw new Error("load-buffer");
  tmux("paste-buffer", "-p", "-b", "fleet", "-t", "pi");
  await until(() => read(state).endsWith(payload), 3000);
  await Bun.sleep(200);
}, 20_000);

afterAll(() => {
  tmux("kill-server");
  rmSync(dir, { recursive: true, force: true });
});

describe("ein Bündel mit Zeilenumbrüchen", () => {
  test("steht nach dem Paste ganz im Composer, und nichts ist abgeschickt", () => {
    expect(read(state).endsWith(payload)).toBe(true);
    expect(sentTurns()).toEqual([]);
  });

  test("ist für den Leser des Servers vollständig angekommen", () => {
    expect(composerArrival(composerRows(), payload)).toBe("complete");
  });

  test("wird mit einem Enter genau ein Turn", async () => {
    tmux("send-keys", "-t", "pi", "Enter");
    expect(await until(() => sentTurns().length > 0)).toBe(true);
    await Bun.sleep(200);
    expect(sentTurns()).toEqual([payload]);
  });
});
