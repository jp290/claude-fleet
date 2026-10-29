// Owner 2026-10-29: ein Claude-Sitz darf über POST /api/self/branches/open einen GEZÄUNTEN pi-zai-Sitz öffnen (bwrap, nur sein Worktree
// beschreibbar). Gemessen an der Zeile, mit der tmux die Pane wirklich startete: das Ersatz-bwrap schreibt seine Argumente in eine
// Datei (ein Aufruf je Block: erst der Selbsttest des Zauns am /usr/bin/true, dann pi). Ein anderer Harness bleibt abgelehnt.
// Jedes `life` ist ein Leben des Servers in eigenem Prozess (branches.drive.ts).
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { branchTestkit, persisted, post } from "./branches-testkit";

const { TMP, BIN, fixture, life, cleanup } = branchTestkit();
const ARGV = join(TMP, "argv");
mkdirSync(ARGV);
// das Ersatz-bwrap: je Aufruf eine Zeile `---` und jedes Argument mit NUL dahinter; es führt nichts aus und endet mit 0
writeFileSync(join(BIN, "bwrap"), `#!/bin/sh\nf="${ARGV}/slot-$FLEET_SELF_SLOT"\nprintf '%s\\n' '---' >> "$f"\n`
  + `for a in "$@"; do printf '%s\\0' "$a" >> "$f"; done\nexit 0\n`, { mode: 0o755 });
afterAll(cleanup);

// der Zaun ist ohne Verbotswurzeln nicht zu bauen (server.ts#PI_ZAI_DENY_ROOTS); alles Private liegt im Temp-Ordner dieses Laufs
const ZAUN = { FLEET_PI_ZAI_BWRAP: join(BIN, "bwrap"), FLEET_PI_ZAI_DENY_ROOTS: join(TMP, "deny-test"),
  FLEET_PI_ZAI_AGENT_DIR: join(TMP, "pi-zai-agent"), FLEET_PI_ZAI_KEY_FILE: join(TMP, "pi-zai.key") };
// die Wache der Zeile verlangt eine nicht leere Schlüsseldatei; hier ein Platzhalter, nie ein echter Schlüssel
writeFileSync(ZAUN.FLEET_PI_ZAI_KEY_FILE, "platzhalter\n");
const tokenOf = (f: ReturnType<typeof fixture>, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
  if (!t) throw new Error(`kein Self-Token für Slot ${slot}`);
  return t;
};
const als = (self: string, step: ReturnType<typeof post>) => ({ ...step, token: null, self });
// die Aufrufe des Ersatz-bwrap in dieser Pane: je Aufruf seine Argumente
const aufrufe = async (slot: number): Promise<string[][]> => {
  const file = join(ARGV, `slot-${slot}`);
  for (let i = 0; i < 200 && !(existsSync(file) && readFileSync(file, "utf8").split("---\n").length > 2); i++) await Bun.sleep(50);
  return readFileSync(file, "utf8").split("---\n").slice(1).map((c) => c.split("\0").slice(0, -1));
};

describe("ein Claude-Sitz öffnet über die Self-Tür einen pi-zai-Sitz", () => {
  test("die Startzeile trägt den Zaun: Selbsttest, nur der Worktree beschreibbar, pi darin", async () => {
    const f = fixture();
    const [b, o] = await life(f, [post("/api/branches", { repo: f.repo, name: "Fremder Sitz" }),
      post("/api/slots/12/open", { cwd: f.repo, label: "Claude-Öffnerin" }), "save"], ZAUN);
    expect([b?.status, o?.status]).toEqual([201, 200]);
    const [c] = await life(f, [als(tokenOf(f, 12), post("/api/self/branches/open", { branch: String(b?.body.branch), harness: "pi-zai" })), "save"], ZAUN);
    expect(c?.status).toBe(200);
    const slot = Number(c?.body.slot);
    expect((persisted(f).slots as Record<string, { harness?: string }>)[String(slot)]?.harness).toBe("pi-zai");
    const [selbsttest, pi] = await aufrufe(slot);
    expect(selbsttest?.at(-1)).toBe("/usr/bin/true");
    expect(pi).toContain("--unshare-all");
    expect(pi?.slice(pi.indexOf("pi"), pi.indexOf("pi") + 3)).toEqual(["pi", "--provider", "zai"]);
    // den Worktree des Branches bindet der Zaun beschreibbar: `--bind <pfad> <pfad>`; das Repo daneben nicht
    const worktree = realpathSync(String(c?.body.path ?? c?.body.cwd));
    const binds = (pi ?? []).flatMap((a, i, all) => (a === "--bind" ? [all[i + 1]] : []));
    expect(binds).toContain(worktree);
    expect(binds).not.toContain(realpathSync(f.repo));
  }, 90_000);

  test("ein anderer Harness bleibt abgelehnt, mit dem heutigen Satz", async () => {
    const f = fixture();
    const [b, o] = await life(f, [post("/api/branches", { repo: f.repo, name: "Kein anderer" }),
      post("/api/slots/12/open", { cwd: f.repo, label: "Claude-Öffnerin" }), "save"], ZAUN);
    expect([b?.status, o?.status]).toEqual([201, 200]);
    const antworten = await life(f, [...["pi-zai-unfenced", "pi", "pi-deepseek", "codex"].map((harness) =>
      als(tokenOf(f, 12), post("/api/self/branches/open", { branch: String(b?.body.branch), harness }))), "save"], ZAUN);
    for (const [i, harness] of ["pi-zai-unfenced", "pi", "pi-deepseek", "codex"].entries()) {
      expect(antworten[i]?.status).toBe(409);
      expect(String(antworten[i]?.body.error)).toContain(`harness ${harness} is not yours (claude)`);
    }
  }, 90_000);
});
