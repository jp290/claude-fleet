// EIN PI-SITZ LIEST FLEETS START (Owner 2026-10-26, zweiter Fix vor dem Startfenster): pi 1.0.2 kennt
// `--append-system-prompt <Text oder Datei>`; Fleet legt Zweck und gewählte Packs in eine Datei, die pi im Zaun
// lesen darf, und hängt sie an. Der Test liest die Zeile, die tmux wirklich startete, und die Datei hinter ihr.
// Dazu die Tür: GET /api/self/context/fleet-doors liefert den Pack, den der Sitz gewählt hat.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Answer, branchTestkit, get, LIFE_DEADLINE_MS, persisted, post } from "./branches-testkit";

const { TMP, BIN, fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);
const ARGV = join(TMP, "argv");
mkdirSync(ARGV);
writeFileSync(join(BIN, "pi"), `#!/bin/sh\nf="${ARGV}/slot-$FLEET_SELF_SLOT"\npwd > "$f.tmp"\n`
  + `for a in "$@"; do printf '%s\\0' "$a" >> "$f.tmp"; done\nmv "$f.tmp" "$f"\nexec sleep 600\n`, { mode: 0o755 });
type SlotRecord = { selfToken?: string; openedAt?: number; agentMd?: { getippt?: boolean; text?: string };
  worktree?: unknown; boardBranch?: { repo: string; branch: string } | null };
const recordOf = (f: ReturnType<typeof fixture>, slot: number): SlotRecord =>
  (persisted(f).slots as Record<string, SlotRecord> | undefined)?.[String(slot)] ?? {};
const startOf = async (slot: number): Promise<{ cwd: string; args: string[] }> => {
  const file = join(ARGV, `slot-${slot}`);
  for (let i = 0; i < 200 && !existsSync(file); i++) await Bun.sleep(50);
  const [cwd, ...rest] = readFileSync(file, "utf8").split("\n");
  return { cwd: cwd!, args: rest.join("\n").split("\0") };
};
const ZWECK = "Du bist der Sitz, der Türen prüft, und antwortest aus dem Pack fleet-doors.";

describe("ein pi-Sitz bekommt Zweck und gewählte Packs als Start-Datei", () => {
  test("die Startzeile hängt eine Datei an, die den Zweck und fleet-doors wörtlich trägt", async () => {
    const f = fixture();
    const [opened, laufend] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, harness: "pi", label: "Türen", purpose: ZWECK,
      bibliothek: ["fleet-doors"] }), get("/api/slots/1/fassung?anlass=laufend"), "save"]);
    expect(opened?.status).toBe(200);
    // die Fassung, aus der der Startbrief seine + Zeilen liest: kein „bekommt keine“, sondern Zweck und Pack
    type Teil = { id: string; abschnitte: { id: string; text: string | null; grund?: string }[] };
    const teile = (laufend?.body.teile as Teil[] | undefined) ?? [];
    const abschnitte = (teil: string) => teile.find((t) => t.id === teil)?.abschnitte ?? [];
    const zusatz = abschnitte("liest").find((a) => a.id === "systemzusatz")?.text ?? "";
    const eigenes = abschnitte("liest").find((a) => a.id === "eigenes")?.text ?? "";
    const wissen = abschnitte("liest").filter((a) => a.id === "wissen").map((a) => a.text ?? "").join("\n");
    expect(zusatz).toContain("--append-system-prompt");
    expect(zusatz).not.toContain("bekommt keine");
    expect(eigenes).toContain(ZWECK);
    expect(wissen).toContain("--- fleet-doors (");
    // der Zweck ist angenommen und liegt am Slot (persistiert), statt an der Tür abgelehnt zu werden
    expect(recordOf(f, 1).agentMd).toMatchObject({ getippt: true, text: ZWECK });
    const start = await startOf(1);
    const at = start.args.indexOf("--append-system-prompt");
    expect(at).toBeGreaterThanOrEqual(0);
    const datei = start.args[at + 1]!;
    expect(datei).toContain("sitz-start");
    const text = readFileSync(datei, "utf8");
    expect(text).toContain(`PURPOSE (written by the owner at start):\n${ZWECK}`);
    expect(text).toContain("FLEET LIBRARY (server/sitz-wissen.ts)");
    expect(text).toContain("--- fleet-doors (");
    expect(text).toContain("# Fleet's doors");
    // der Schlüssel steht nie in der Start-Datei (er kommt auf keiner pi-Zeile dieser Sitzart vor)
    expect(text).not.toContain("DEEPSEEK_API_KEY");
    expect(text).not.toContain("ZAI_API_KEY");
    expect(text).not.toContain("api-key");
  }, LIFE_DEADLINE_MS * 2);

  test("ein pi-Sitz auf einem Board-Branch hält seinen Branch am Slot, nicht im worktree-Feld", async () => {
    const f = fixture();
    const [made, opened] = await life(f, [post("/api/branches", { repo: f.repo, name: "Board Pi" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/board-pi", harness: "pi" }), "save"]);
    expect([made?.status, opened?.status]).toEqual([201, 200]);
    const branch = String(made?.body.branch);
    const slot = Number(opened?.body.slot);
    const rec = recordOf(f, slot);
    expect(rec.worktree ?? null).toBeNull();
    expect(rec.boardBranch).toEqual({ repo: f.repo, branch });
    // der Branch überlebt einen Neustart: der Slot liest ihn aus fleet.json, nicht aus HEAD
    await life(f, ["save"]);
    expect(recordOf(f, slot).boardBranch).toEqual({ repo: f.repo, branch });
  }, LIFE_DEADLINE_MS * 2);

  test("die Vorschau des Startfensters zeigt für pi Zweck und fleet-doors als Wissen", async () => {
    const f = fixture();
    const q = new URLSearchParams({ repo: f.repo, role: "nur-ordner", harness: "pi", anlass: "neu", purpose: ZWECK, bibliothek: "fleet-doors" });
    const [vor] = await life(f, [get(`/api/founding-plan?${q.toString()}`)]);
    expect(vor?.status).toBe(200);
    type Teil = { id: string; abschnitte: { id: string; text: string | null }[] };
    const teile = (vor?.body.fassung as { teile?: Teil[] } | undefined)?.teile ?? [];
    const liest = teile.find((t) => t.id === "liest")?.abschnitte ?? [];
    expect(liest.find((a) => a.id === "systemzusatz")?.text ?? "").not.toContain("bekommt keine");
    expect(liest.find((a) => a.id === "eigenes")?.text ?? "").toContain(ZWECK);
    expect(liest.filter((a) => a.id === "wissen").map((a) => a.text ?? "").join("\n")).toContain("--- fleet-doors (");
  }, LIFE_DEADLINE_MS * 2);

  test("der Plan verspricht Skills nur einem pi-Adapter, der ein Agent-Verzeichnis hat", async () => {
    const f = fixture();
    const plan = (harness: string) => get(`/api/founding-plan?${new URLSearchParams({ repo: f.repo, role: "nur-ordner", harness, anlass: "neu" })}`);
    const [ohne, mit] = await life(f, [plan("pi"), plan("pi-zai")]);
    type Zeile = { id: string; zustand: string; details?: { packs?: string[] } };
    const skills = (a: Answer | undefined) => ((a?.body.plan as { bausteine: Zeile[] } | undefined)?.bausteine ?? []).find((z) => z.id === "bibliothek-skills");
    expect([ohne?.status, mit?.status]).toEqual([200, 200]);
    expect(skills(ohne)?.details?.packs ?? []).toEqual([]);
    expect(skills(ohne)?.zustand).not.toBe("an");
    expect(skills(mit)?.details?.packs?.length).toBeGreaterThan(0);
    expect(skills(mit)?.zustand).toBe("an");
  }, LIFE_DEADLINE_MS * 2);

  test("GET /api/self/context/fleet-doors holt den Pack für diesen Sitz", async () => {
    const f = fixture();
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, harness: "pi", label: "Türen",
      bibliothek: ["fleet-doors"] }), "save"]);
    expect(opened?.status).toBe(200);
    const self = String(recordOf(f, 1).selfToken);
    expect(self).toBeTruthy();
    const [borrow] = await life(f, [{ ...get("/api/self/context/fleet-doors"), token: null, self } as unknown as never]);
    const body = borrow?.body as { id?: string; sources?: { content?: string }[]; refusal?: string } | undefined;
    expect({ status: borrow?.status, refusal: body?.refusal }).toEqual({ status: 200, refusal: undefined });
    expect(body?.id).toBe("fleet-doors");
    expect(body?.sources?.[0]?.content).toContain("# Fleet's doors");
    expect(body?.sources?.[0]?.content).toContain("GET /api/self/context/<id>");
  }, LIFE_DEADLINE_MS * 2);
});
