// EIN KIND IST NIE WEITER ALS SEINE ÖFFNERIN, AUCH IM MODUS, ABER ENGER DARF ES SEIN (Orchestratorin, Auftrag 20, Queue 96220964): eine Leitung in bypass,
// die einen Sitz für fremde Eingaben öffnet, will ihn unter dem Klassifizierer, in auto. Bisher gab die Selbst-Tür einem Kind nur den Modus der Öffnerin,
// manual oder plan, und antwortete auf auto mit 409. Jetzt gilt MODUS_RANG (server/sitz-reise.ts#modusNichtWeiter), an beiden Selbst-Türen:
// POST /api/self/seats/open und POST /api/self/branches/open. Gemessen an der Zeile, mit der tmux die Pane des Kindes startete.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { branchTestkit, LIFE_DEADLINE_MS, persisted, post, type Fixture } from "./branches-testkit";

const { TMP, BIN, fixture, life, cleanup } = branchTestkit();
const ARGV = join(TMP, "argv-modus");
mkdirSync(ARGV);
// das Ersatz-claude schreibt seine Argumente, je Slot eine Datei (wie server/branch-packs-erbe.test.ts)
writeFileSync(join(BIN, "claude"), `#!/bin/sh\nf="${ARGV}/slot-$FLEET_SELF_SLOT"\npwd > "$f.tmp"\n`
  + `for a in "$@"; do printf '%s\\0' "$a" >> "$f.tmp"; done\nmv "$f.tmp" "$f"\nexec sleep 600\n`, { mode: 0o755 });
afterAll(cleanup);

const tokenOf = (f: Fixture, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
  if (!t) throw new Error(`kein Self-Token für Slot ${slot}`);
  return t;
};
const als = (self: string, step: ReturnType<typeof post>) => ({ ...step, token: null, self });
// der Modus, mit dem die Pane des Slots wirklich startete
const modusOf = async (slot: number): Promise<string | null> => {
  const file = join(ARGV, `slot-${slot}`);
  for (let i = 0; i < 200 && !existsSync(file); i++) await Bun.sleep(50);
  const args = readFileSync(file, "utf8").split("\n").slice(1).join("\n").split("\0");
  if (args.includes("--dangerously-skip-permissions")) return "bypassPermissions";
  const at = args.indexOf("--permission-mode");
  return at >= 0 ? args[at + 1]! : null;
};
const ordner = (f: Fixture, name: string): string => { const d = join(dirname(f.repo), name); mkdirSync(d, { recursive: true }); return d; };

describe("der Modus eines Kindes an der Selbst-Tür", () => {
  test("eine Öffnerin in bypass öffnet ein Kind in auto, an beiden Türen; eine in auto gibt kein bypass, wohl aber acceptEdits", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: dirname(f.repo), FLEET_SELF_SEAT_CAP: "3" };
    const [bLeit, bAuto, oLeit, oAuto] = await life(f, [
      post("/api/branches", { repo: f.repo, name: "Kind der Leitung" }),
      post("/api/branches", { repo: f.repo, name: "Kind der Auto" }),
      post("/api/slots/1/open", { cwd: f.repo, label: "Leitung", permissionMode: "bypassPermissions" }),
      post("/api/slots/2/open", { cwd: f.repo, label: "Auto", permissionMode: "auto" }),
      "save"], env);
    expect([bLeit?.status, bAuto?.status, oLeit?.status, oAuto?.status]).toEqual([201, 201, 200, 200]);
    expect([await modusOf(1), await modusOf(2)]).toEqual(["bypassPermissions", "auto"]);
    const leitung = tokenOf(f, 1), auto = tokenOf(f, 2);
    const [sitzAuto, branchAuto, sitzBypass, branchBypass, sitzEnger] = await life(f, [
      als(leitung, post("/api/self/seats/open", { cwd: ordner(f, "fremd"), goal: "Lies das fremde Repo.", permissionMode: "auto" })),
      als(leitung, post("/api/self/branches/open", { branch: String(bLeit?.body.branch), goal: "Baue.", permissionMode: "auto" })),
      als(auto, post("/api/self/seats/open", { cwd: ordner(f, "weiter"), goal: "x", permissionMode: "bypassPermissions" })),
      als(auto, post("/api/self/branches/open", { branch: String(bAuto?.body.branch), goal: "x", permissionMode: "bypassPermissions" })),
      als(auto, post("/api/self/seats/open", { cwd: ordner(f, "enger"), goal: "Nur Bearbeitungen.", permissionMode: "acceptEdits" })),
      "save"], env);
    // ein Vergleich über alle Fälle, damit ein roter Lauf jeden einzeln zeigt
    expect([sitzAuto, branchAuto, sitzBypass, branchBypass, sitzEnger].map((a) => a?.status)).toEqual([200, 200, 409, 409, 200]);
    for (const a of [sitzBypass, branchBypass]) expect(String(a?.body.error)).toContain("permissionMode bypassPermissions is wider than the opener's own (auto)");
    // die Kinder starten wirklich so, und keines in bypass
    const kinder = [sitzAuto, branchAuto, sitzEnger].map((a) => Number(a?.body.slot));
    expect(await Promise.all(kinder.map(modusOf))).toEqual(["auto", "auto", "acceptEdits"]);
  }, LIFE_DEADLINE_MS * 4);
});
