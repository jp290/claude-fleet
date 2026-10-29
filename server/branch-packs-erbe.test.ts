// EIN SITZ, DEN EINE SESSION AUF EINEM BRANCH ÖFFNET, BEKOMMT IHR WISSEN MIT (Owner 28.10.: „[Zitat entfernt]“): bisher startete er nur mit der AGENTS.md des Repos und dem Auftrag, ohne Packs und ohne Zweck,
// und entdeckte die Welt jedes Mal neu. Jetzt erbt er die Bibliothekswahl seiner Öffnerin und die Packs, die sie sich selbst gab —
// als Text. Rechte, Modell, Effort, Sandbox und Harness bleiben die des Kindes und werden davon nicht breiter.
//
// Gemessen an der Zeile, mit der tmux die Pane wirklich startete: der Ersatz-claude schreibt seine Argumente und die Datei hinter
// `--append-system-prompt-file` in den Temp-Ordner. Jedes `life` ist ein Leben des Servers in eigenem Prozess (branches.drive.ts).
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { branchTestkit, persisted, post } from "./branches-testkit";
import { SEAT_START_HEAD } from "./sitz-wissen";

const { TMP, BIN, fixture, life, cleanup } = branchTestkit();
const ARGV = join(TMP, "argv");
mkdirSync(ARGV);
// das Ersatz-claude: erste Zeile der Ordner, danach jedes Argument mit NUL dahinter, je Slot eine Datei
writeFileSync(join(BIN, "claude"), `#!/bin/sh\nf="${ARGV}/slot-$FLEET_SELF_SLOT"\npwd > "$f.tmp"\n`
  + `for a in "$@"; do printf '%s\\0' "$a" >> "$f.tmp"; done\nmv "$f.tmp" "$f"\nexec sleep 600\n`, { mode: 0o755 });
afterAll(cleanup);

// was der Sitz wirklich liest: der angehängte Systemprompt und die Datei, die er nennt (server.ts#seatStartDatei, #piStartDatei)
const startOf = async (slot: number): Promise<string> => {
  const file = join(ARGV, `slot-${slot}`);
  for (let i = 0; i < 200 && !existsSync(file); i++) await Bun.sleep(50);
  const [, ...rest] = readFileSync(file, "utf8").split("\n");
  const args = rest.join("\n").split("\0");
  const at = args.indexOf("--append-system-prompt");
  const datei = args.indexOf("--append-system-prompt-file");
  return [at >= 0 ? args[at + 1]! : "", datei >= 0 ? readFileSync(args[datei + 1]!, "utf8") : ""].filter(Boolean).join("\n\n");
};
const tokenOf = (f: ReturnType<typeof fixture>, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
  if (!t) throw new Error(`kein Self-Token für Slot ${slot}`);
  return t;
};
const als = (self: string, step: ReturnType<typeof post>) => ({ ...step, token: null, self });

// zwei Wahlen, die sich nicht überschneiden: P steht wörtlich im Start, Q kommt als Skill-Zeile
const P = ["who-it-is-for", "building-an-agent"] as const;
const Q = ["sharpen3", "advanced-features"] as const;

describe("ein Sitz, den eine Session öffnet, erbt ihre Packs", () => {
  test("Wahl P kommt mit, eine fremde Wahl Q nicht, und ohne Wahl bleibt es beim heutigen Start", async () => {
    const f = fixture();
    const [bP, bQ, bN] = await life(f, [
      post("/api/branches", { repo: f.repo, name: "Packs P" }),
      post("/api/branches", { repo: f.repo, name: "Packs Q" }),
      post("/api/branches", { repo: f.repo, name: "Packs ohne" }),
      "save"]);
    expect([bP?.status, bQ?.status, bN?.status]).toEqual([201, 201, 201]);
    // drei Öffnerinnen in diesem Repo (ein fremdes Repo, also eigenes Setup): P, Q und eine ohne Wahl
    const [oP, oQ, oN] = await life(f, [
      post("/api/slots/12/open", { cwd: f.repo, label: "Öffnerin P", bibliothek: [...P] }),
      post("/api/slots/13/open", { cwd: f.repo, label: "Öffnerin Q", bibliothek: [...Q] }),
      post("/api/slots/14/open", { cwd: f.repo, label: "Öffnerin ohne Wahl" }),
      "save"]);
    expect([oP?.status, oQ?.status, oN?.status]).toEqual([200, 200, 200]);
    // ...und jede öffnet ein Kind über ihre Self-Tür, ohne eigene Wahl im Body
    const [cP, cQ, cN] = await life(f, [
      als(tokenOf(f, 12), post("/api/self/branches/open", { branch: String(bP?.body.branch) })),
      als(tokenOf(f, 13), post("/api/self/branches/open", { branch: String(bQ?.body.branch) })),
      als(tokenOf(f, 14), post("/api/self/branches/open", { branch: String(bN?.body.branch) })),
      "save"]);
    expect([cP?.status, cQ?.status, cN?.status]).toEqual([200, 200, 200]);
    const [sP, sQ, sN] = [await startOf(Number(cP?.body.slot)), await startOf(Number(cQ?.body.slot)), await startOf(Number(cN?.body.slot))];

    // das Kind von P liest den Start-Block und P wörtlich, Q nicht
    expect(sP).toContain(SEAT_START_HEAD);
    for (const id of P) expect(sP).toContain(`--- ${id} `);
    for (const id of Q) expect(sP).not.toContain(id);
    // das Kind von Q liest Q (als Skill-Zeile), P nicht
    expect(sQ).toContain(SEAT_START_HEAD);
    for (const id of Q) expect(sQ).toContain(id);
    for (const id of P) expect(sQ).not.toContain(id);
    // ohne Wahl der Öffnerin: wie heute kein Start-Block (dieses Repo ist ein eigenes Setup, die Bibliothek ist dort aus)
    expect(sN).not.toContain(SEAT_START_HEAD);
  }, 90_000);

  test("die Packs, die die Öffnerin sich selbst gab, gehen als Text mit — ihr Zweck nicht", async () => {
    const f = fixture();
    const [b] = await life(f, [post("/api/branches", { repo: f.repo, name: "Mit eigenen Steinen" }), "save"]);
    const [o] = await life(f, [post("/api/slots/12/open", { cwd: f.repo, label: "Öffnerin mit Stein", bibliothek: [...P] }), "save"]);
    expect([b?.status, o?.status]).toEqual([201, 200]);
    // was eine Session sich selbst gab (Slot.selbst): hier der Stand einer Nachfolgerin, die einen Pack trägt
    const st = persisted(f);
    (st.slots as Record<string, Record<string, unknown>>)["12"]!.selbst =
      { jetzt: { packs: ["working-with-the-owner"], zweck: "Ein Zweck, der nur der Öffnerin gehört." }, naechster: null, neu: [] };
    writeFileSync(join(f.state, "fleet.json"), JSON.stringify(st));
    const [c] = await life(f, [als(tokenOf(f, 12), post("/api/self/branches/open", { branch: String(b?.body.branch) })), "save"]);
    expect(c?.status).toBe(200);
    const s = await startOf(Number(c?.body.slot));
    expect(s).toContain("--- working-with-the-owner ");
    // der Zweck der Öffnerin steht nicht im Start des Kindes: er ist ihrer, nicht seines
    expect(s).not.toContain("Ein Zweck, der nur der Öffnerin gehört.");
  }, 90_000);
});
