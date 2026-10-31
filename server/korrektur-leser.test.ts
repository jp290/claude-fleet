// Ein Sitz ohne Rolle in Fleets Repo liest die Owner-Korrekturen (Orchestratorin 24.10.): Bau-Sitze auf einem Board-Branch und freie
// Sitze im Checkout bauen Fleet, und das Heft gilt für sie mit der Geltung einer Lane (server.ts#korrekturLeserFor). Ein Sitz in einem
// fremden Repo bleibt bei 409, denn das Heft ist persönlich und reist nicht. Der Server dieses Tests läuft aus diesem Checkout, einem
// Worktree von Fleets Repo: ein Sitz dort steht wie ein Bau-Sitz auf einem Board-Branch. Sein Start trägt die Einträge als eigenen Stein
// (Plan 31.10. W4a, server/korrektur-stein.ts): eine + Zeile mit dem Owner als Autor, je Eintrag eine Zeile mit Id — die ganze Aussage, wo
// er in jeder Arbeit gilt, sonst Modus und Thema; auch einer, der für jeden Sitz gilt (rollen "*") — im angehängten Systemprompt, und „[Zitat entfernt]“ zeigt denselben Text.
import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Answer, branchTestkit, type Fixture, get, persisted, post } from "./branches-testkit";

const { TMP, SOCKETS, fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);
const FLEET_REPO = join(import.meta.dir, "..");
// EIN BAUM VON FLEETS REPO AUF EINEM BRANCH: eine Program-MAIN gründet nur dort (server.ts#preflightProgramMain liest den Branch von HEAD).
// Steht dieser Checkout losgelöst (der Kandidat des Merge-Checks, ein abgelöster Prüf-Worktree), gründen die beiden MAIN-Tests in einem
// verknüpften Worktree desselben Repos auf einem eigenen Test-Branch: derselbe Objektspeicher, also für den Server Fleets Repo
// (server.ts#fleetBaumVon). Auf einem Branch schreibt der Test nichts ins Repo; den Worktree und seinen Branch nimmt afterAll wieder weg.
const git = (...args: string[]) => Bun.spawnSync(["git", "-C", FLEET_REPO, ...args]);
let fleetAufBranch: string | null = null, testBranch: string | null = null;
function fleetBaumAufBranch(): string {
  if (fleetAufBranch) return fleetAufBranch;
  if (git("symbolic-ref", "-q", "HEAD").exitCode === 0) return fleetAufBranch = FLEET_REPO;
  testBranch = `fleet-test/korrektur-leser-${process.pid}`;
  const baum = join(TMP, "fleet-auf-branch");
  const r = git("worktree", "add", "-q", "-b", testBranch, baum, "HEAD");
  if (r.exitCode !== 0) throw new Error(`kein Worktree auf einem Branch: ${r.stderr.toString()}`);
  return fleetAufBranch = baum;
}
afterAll(() => {
  if (!testBranch) return;
  if (fleetAufBranch) git("worktree", "remove", "--force", fleetAufBranch);
  git("worktree", "prune");
  git("branch", "-D", testBranch);
});
const DOOR = "/api/self/konzepte/k-owner-korrekturen/leseansicht";

const ALLE = { projekte: "*", harnesses: "*", modi: "*" } as const;
const eintrag = (id: string, rollen: string[]) => ({ id, aussage: `Aussage ${id}`, quelle: "fixture", geltung: { ...ALLE, rollen }, ersetzt: [] });
const HEFT = { eintraege: [eintrag("fuer-bauer", ["lane", "orchestrator", "program-main"]), eintrag("nur-orchestratorin", ["orchestrator"]),
  eintrag("nur-main", ["orchestrator", "program-main"]), { ...eintrag("fuer-jeden-sitz", []), geltung: { ...ALLE, rollen: "*" } }], zurueckgezogen: [] };

// was die Pane wirklich liest: die Startzeile, mit der tmux sie öffnete, und die Startdatei, die sie nennt (server.ts#seatStartDatei)
function startText(f: Fixture, cwd: string): string {
  const r = Bun.spawnSync(["tmux", "-L", f.sock, "list-panes", "-a", "-F", "#{pane_current_path}\t#{pane_start_command}"],
    { env: { ...process.env, TMUX_TMPDIR: SOCKETS } });
  const zeile = r.stdout.toString().split("\n").find((z) => z.startsWith(`${cwd}\t`));
  if (!zeile) throw new Error(`keine Pane in ${cwd}: ${r.stdout.toString()}${r.stderr.toString()}`);
  const z = zeile.slice(cwd.length + 1).replace(/^"|"$/g, "").replace(/\\(.)/g, "$1").replaceAll("'\\''", "'");
  const datei = /--append-system-prompt-file '([^']+)'/.exec(z)?.[1];
  return datei ? `${z}\n${readFileSync(datei, "utf8")}` : z;
}

function konzeptWurzel(): string {
  const root = join(TMP, `konzepte-${Date.now()}`);
  mkdirSync(join(root, "k-owner-korrekturen"), { recursive: true });
  return root;
}
const ids = (a: Answer | undefined): string[] => ((a?.body.geltendeEintraege ?? []) as { id: string }[]).map((e) => e.id);

describe("die Owner-Korrekturen für einen Sitz ohne Rolle", () => {
  test("in Fleets Repo liest er die Einträge einer Lane mit 200, im fremden Repo bekommt er 409 ohne einen Eintrag", async () => {
    const f = fixture();
    const root = konzeptWurzel();
    const text = `# Owner-Korrekturen\n\n\`\`\`owner-korrekturen\n${JSON.stringify(HEFT, null, 2)}\n\`\`\`\n`;
    writeFileSync(join(root, "k-owner-korrekturen", "v1.md"), text);
    const env = { FLEET_KONZEPT_ROOT: root };
    const [veroeffentlicht, bau, fremd] = await life(f, [
      post("/api/konzepte/k-owner-korrekturen/versionen", { sha256: createHash("sha256").update(text).digest("hex"),
        anlass: "Test", geltung: "Test", erwartet: null }),
      post("/api/slots/8/open", { cwd: FLEET_REPO }), post("/api/slots/7/open", { cwd: f.repo }), "save"], env);
    expect([veroeffentlicht?.status, bau?.status, fremd?.status]).toEqual([200, 200, 200]);
    const tok = (n: number) => String((persisted(f).slots as Record<string, { selfToken?: string }>)[String(n)]?.selfToken);
    const [liest, voll, fremdes, fremdVoll, fassung, fremdFassung] = await life(f, [
      { ...get(DOOR), token: null, self: tok(8) }, { ...get(`${DOOR}/nur-orchestratorin`), token: null, self: tok(8) },
      { ...get(DOOR), token: null, self: tok(7) }, { ...get(`${DOOR}/fuer-bauer`), token: null, self: tok(7) },
      get("/api/slots/8/fassung?anlass=laufend"), get("/api/slots/7/fassung?anlass=laufend")], env);
    expect([liest?.status, ids(liest), (liest?.body.bindung as { rolle?: string } | undefined)?.rolle]).toEqual([200, ["fuer-bauer", "fuer-jeden-sitz"], "lane"]);
    expect(voll?.status).toBe(404);
    expect([fremdes?.status, fremdes?.body.geltendeEintraege, String(fremdes?.body.error)])
      .toEqual([409, undefined, expect.stringContaining("does not travel")]);
    expect(fremdVoll?.status).toBe(409);
    // seine Fassung trägt das Heft unter „Liest“ als Stein: die + Zeile mit dem Owner als Autor, dann je Eintrag, der für ihn gilt, ein Satz
    // mit seiner Id; was nur Orchestratorin oder MAIN gilt, steht nicht darin. Die Fassung des Sitzes im fremden Repo nennt das Heft nicht.
    const korrekturen = (a: Answer | undefined) => ((a?.body.teile ?? []) as { id: string; abschnitte: { id: string; text: string | null }[] }[])
      .find((t) => t.id === "liest")?.abschnitte.filter((x) => x.id === "korrekturen").map((x) => x.text) ?? null;
    const [stein] = korrekturen(fassung) ?? [];
    const zeilen = String(stein).split("\n");
    expect(zeilen[0]).toBe("+ corrections k-owner-korrekturen v1 (author: owner)");
    expect(zeilen[1]).toContain(`${DOOR}/<id>`);
    expect(zeilen.slice(2)).toEqual(["- Aussage fuer-bauer [fuer-bauer]", "- Aussage fuer-jeden-sitz [fuer-jeden-sitz]"]);
    expect(korrekturen(fremdFassung)).toEqual([]);
    // ...und der Start, mit dem die Pane lief, trägt denselben Stein; der Start im fremden Repo trägt kein Heft
    expect(startText(f, FLEET_REPO)).toContain(String(stein));
    expect(startText(f, f.repo)).not.toContain("+ corrections ");
  }, 90_000);
  // EINE PROGRAM-MAIN, DIE IN FLEETS REPO GEGRÜNDET WIRD, ist bei ihrem ersten Spawn noch nicht gebunden (die Bindung kommt erst vor dem
  // Brief, server.ts#bootstrapProgramMainReserved). Ihr Heft kommt im Brief, mit der Faltung einer MAIN; der Stein eines freien Sitzes
  // gehört nicht zusätzlich in ihren Start, sonst stünde das Heft zweimal und verschieden gefaltet darin.
  test("eine in Fleets Repo gegründete Program-MAIN trägt den Stein eines freien Sitzes nicht in ihrem Start", async () => {
    const f = fixture();
    const root = konzeptWurzel();
    const text = `# Owner-Korrekturen\n\n\`\`\`owner-korrekturen\n${JSON.stringify(HEFT, null, 2)}\n\`\`\`\n`;
    writeFileSync(join(root, "k-owner-korrekturen", "v1.md"), text);
    const env = { FLEET_KONZEPT_ROOT: root, FLEET_FOUNDING_BOOT_GRACE_MS: "250", FLEET_READY_WAIT_MS: "500" };
    const PROGRAM = { title: "Heft-Probe", intent: "die MAIN liest ihr Heft einmal", successCriterion: "kein Stein im Start",
      nonGoals: [], decisions: [], evidence: [], openQuestions: [] };
    const [veroeffentlicht, angelegt] = await life(f, [
      post("/api/konzepte/k-owner-korrekturen/versionen", { sha256: createHash("sha256").update(text).digest("hex"),
        anlass: "Test", geltung: "Test", erwartet: null }),
      post("/api/programs", PROGRAM), "save"], env);
    expect([veroeffentlicht?.status, angelegt?.status]).toEqual([200, 200]);
    const id = String((angelegt?.body.program as { id: string }).id);
    const state = persisted(f);
    const jetzt = Date.now();
    state.programs = (state.programs as { id: string }[]).map((p) => p.id === id ? { ...p, status: "active", confirmedAt: jetzt, activatedAt: jetzt } : p);
    writeFileSync(join(f.state, "fleet.json"), JSON.stringify(state, null, 2));
    const [gegruendet] = await life(f, [post(`/api/programs/${id}/bootstrap-main`, { cwd: fleetBaumAufBranch() })], env);
    // die Gründung selbst darf hier scheitern (der Platzhalter-Agent gilt nicht als lebendig, dann rollt sie zurück und die Pane ist weg);
    // geprüft wird, was ihr erster Spawn als Start geschrieben hat: die Startdateien unter sitz-start/ (server.ts#seatStartDatei)
    expect(gegruendet?.status).toBeDefined();
    const ordner = join(f.state, "sitz-start");
    const starts = existsSync(ordner) ? readdirSync(ordner).map((n) => readFileSync(join(ordner, n), "utf8")) : [];
    expect(starts.length).toBeGreaterThan(0);
    expect(starts.filter((t) => t.includes("+ corrections "))).toEqual([]);
    // ...und die Fassung, die der Start festhielt (server/start-fassung.ts), nennt ihn auch nicht: Info → Setup zeigt, was der Start trug
    const gehalten = join(f.state, "start-fassungen");
    const fassungen = existsSync(gehalten) ? readdirSync(gehalten).filter((n) => n.endsWith(".json")).map((n) => readFileSync(join(gehalten, n), "utf8")) : [];
    expect(fassungen.length).toBeGreaterThan(0);
    expect(fassungen.filter((t) => t.includes("+ corrections "))).toEqual([]);
  }, 90_000);
  // ...und ihre Nachfolgerin ebenso: die Nachfolge einer MAIN öffnet den Slot über dieselbe Gründungsmarke (founding.target), bevor sie bindet
  test("die Nachfolgerin einer Program-MAIN in Fleets Repo trägt den Stein weder im Start noch in ihrer festgehaltenen Fassung", async () => {
    const f = fixture();
    const root = konzeptWurzel();
    const text = `# Owner-Korrekturen\n\n\`\`\`owner-korrekturen\n${JSON.stringify(HEFT, null, 2)}\n\`\`\`\n`;
    writeFileSync(join(root, "k-owner-korrekturen", "v1.md"), text);
    const env = { FLEET_KONZEPT_ROOT: root, FLEET_FOUNDING_BOOT_GRACE_MS: "250", FLEET_READY_WAIT_MS: "500" };
    const PROGRAM = { title: "Heft-Nachfolge", intent: "die Nachfolgerin liest ihr Heft einmal", successCriterion: "kein Stein im Start",
      nonGoals: [], decisions: [], evidence: [], openQuestions: [] };
    const [veroeffentlicht, angelegt, offen] = await life(f, [
      post("/api/konzepte/k-owner-korrekturen/versionen", { sha256: createHash("sha256").update(text).digest("hex"),
        anlass: "Test", geltung: "Test", erwartet: null }),
      post("/api/programs", PROGRAM), post("/api/slots/3/open", { cwd: fleetBaumAufBranch() }), "save"], env);
    expect([veroeffentlicht?.status, angelegt?.status, offen?.status]).toEqual([200, 200, 200]);
    const id = String((angelegt?.body.program as { id: string }).id);
    const state = persisted(f);
    const sitz = (state.slots as Record<string, { openedAt: number; selfToken: string }>)["3"]!;
    const jetzt = Date.now();
    state.programs = (state.programs as { id: string }[]).map((p) => p.id === id ? { ...p, status: "active", confirmedAt: jetzt, activatedAt: jetzt,
      main: { slot: 3, openedAt: sitz.openedAt, sessionId: null, boundAt: jetzt } } : p);
    writeFileSync(join(f.state, "fleet.json"), JSON.stringify(state, null, 2));
    const ab = Date.now();
    const [nachfolge] = await life(f, [{ ...post("/api/self/succeed", {}), token: null, self: sitz.selfToken }], env);
    // die Nachfolgerin steht und ist gebunden; ihr Brief bleibt hier liegen (der Platzhalter-Agent gilt nicht als lebendig, 500 mit „succession debt“)
    expect(String(nachfolge?.body.error ?? "")).toContain("successor stands on slot 3 and is bound");
    // was der Spawn der Nachfolgerin schrieb: Startdateien nach `ab` und die festgehaltene Fassung ihrer Belegung (eine je Slot)
    const ordner = join(f.state, "sitz-start");
    const neu = existsSync(ordner) ? readdirSync(ordner).map((n) => join(ordner, n)).filter((d) => statSync(d).mtimeMs >= ab) : [];
    expect(neu.length).toBeGreaterThan(0);
    expect(neu.filter((d) => readFileSync(d, "utf8").includes("+ corrections "))).toEqual([]);
    const gehalten = join(f.state, "start-fassungen");
    const fassung = readdirSync(gehalten).filter((n) => n.startsWith("3-") && n.endsWith(".json") && n !== `3-${sitz.openedAt}.json`);
    expect(fassung.length).toBe(1);
    expect(readFileSync(join(gehalten, fassung[0]!), "utf8")).not.toContain("+ corrections ");
  }, 90_000);
});
