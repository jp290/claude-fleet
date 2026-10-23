// Fleets Bibliothek erreicht jeden Sitz (Branch „wissen-kommt-an“; Owner 22.10. über Slot 16: „[Zitat entfernt]“
// , und Ja zu Skills). Ein Sitz ohne stehende Rolle — Branch-Session, freie Session, auch in einem anderen
// Repo — hat, was er immer braucht, wörtlich im Start, und den Rest als Claude-Code-Skills über `--add-dir`; er leiht
// über GET /api/self/context/<id> aus, und seine Fassung nennt beides unter „[Zitat entfernt]“ statt „[Zitat entfernt]“.
//
// Jedes `life` ist ein Leben des Servers in einem eigenen Prozess (server/branches.drive.ts). Die Panes starten ein
// Ersatz-`claude`, das nur seinen Ordner und seine Argumente in eine Datei schreibt und dann wartet: so ist der Start,
// den der Test liest, die Zeile, die tmux wirklich ausgeführt hat. Fleets Register kommt vom HEAD dieses Checkouts.
import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sectionAt } from "../context-sections";
import { type Answer, branchTestkit, get, LIFE_DEADLINE_MS, persisted, post, sh } from "./branches-testkit";
import { SEAT_BOX, SEAT_START_HEAD, bibliothekBeimSpawn, bibliothekDerTuer, bibliothekNichtWirksam, seatContextFacts, seatFassungAbschnitte,
  seatPacks, seatSkillFiles, seatSkillsVerwaist, skillAufrufe, type SeatKnowledge } from "./sitz-wissen";

const ROOT = realpathSync(join(import.meta.dir, ".."));
const { TMP, BIN, fixture, life, cleanup } = branchTestkit();
const ARGV = join(TMP, "argv");
mkdirSync(ARGV);
// das Ersatz-claude: erste Zeile der Ordner, danach jedes Argument mit NUL dahinter, je Slot eine Datei
writeFileSync(join(BIN, "claude"), `#!/bin/sh\nf="${ARGV}/slot-$FLEET_SELF_SLOT"\npwd > "$f.tmp"\n`
  + `for a in "$@"; do printf '%s\\0' "$a" >> "$f.tmp"; done\nmv "$f.tmp" "$f"\nexec sleep 600\n`, { mode: 0o755 });

// eine Fleet-Session auf einem Branch sitzt in einem verknüpften Worktree von Fleet: einer, der nur für diesen Test
// existiert, auf einem eigenen Branch (der Gründungsplan braucht ihn als integration HEAD — ein frischer Klon im
// Merge-Check steht losgelöst), und den afterAll samt Branch wieder nimmt
const FLEET_WT = join(realpathSync(mkdtempSync(join(tmpdir(), "sitz-wissen-"))), "fleet-wt");
const FLEET_WT_BRANCH = `test/sitz-wissen-${process.pid}-${Date.now()}`;
sh(ROOT, "worktree", "add", "-q", "-b", FLEET_WT_BRANCH, FLEET_WT, "HEAD");
afterAll(() => {
  Bun.spawnSync(["git", "-C", ROOT, "worktree", "remove", "--force", FLEET_WT]);
  Bun.spawnSync(["git", "-C", ROOT, "branch", "-D", FLEET_WT_BRANCH]);
  rmSync(join(FLEET_WT, ".."), { recursive: true, force: true });
  cleanup();
});

interface RegisterPack { id: string; useWhen: string; triggers: string[]; sources: { path: string; anchor: string }[] }
const register = JSON.parse(sh(ROOT, "show", "HEAD:.fleet/context-packs.json")) as RegisterPack[];
const pack = (id: string): RegisterPack => register.find((p) => p.id === id)!;
// die Regel, wie sie der Auftrag beschreibt: überall `seat-start-any-repo`, im Fleet-Repo dazu `seat-start`
const erwartet = (fleet: boolean): string[] => register.filter((p) => p.triggers.includes("seat-start-any-repo")
  || (fleet && p.triggers.includes("seat-start"))).map((p) => p.id);
const box = (fleet: boolean): string[] => erwartet(fleet).filter((id) => id in SEAT_BOX);
const skills = (fleet: boolean): string[] => erwartet(fleet).filter((id) => !(id in SEAT_BOX));
// der Text eines Packs, unabhängig vom Server gelesen: der Abschnitt jeder Quelle am HEAD
const atHead = (path: string): string => Bun.spawnSync(["git", "-C", ROOT, "show", `HEAD:${path}`]).stdout.toString();
const textOf = (id: string): string => pack(id).sources.map((s) => sectionAt(atHead(s.path), s.path, s.anchor) ?? "").join("\n");

const startOf = async (slot: number): Promise<{ cwd: string; appended: string; addDirs: string[] }> => {
  const file = join(ARGV, `slot-${slot}`);
  for (let i = 0; i < 200 && !existsSync(file); i++) await Bun.sleep(50);
  const [cwd, ...rest] = readFileSync(file, "utf8").split("\n");
  const args = rest.join("\n").split("\0");
  // die Rolle ohne Lane, Orchestratorin und gebundene MAIN trägt genau ein --append-system-prompt
  const at = args.indexOf("--append-system-prompt");
  return { cwd: cwd!, appended: at >= 0 ? args[at + 1]! : "",
    addDirs: args.flatMap((arg, i) => arg === "--add-dir" ? [args[i + 1]!] : []) };
};
// die Skills, die Claude aus den --add-dir-Ordnern lädt: <dir>/.claude/skills/<name>/SKILL.md
const skillsIn = (dirs: string[]): Map<string, string> => new Map(dirs.flatMap((dir) => {
  const root = join(dir, ".claude", "skills");
  return existsSync(root) ? readdirSync(root).map((name) => [name, readFileSync(join(root, name, "SKILL.md"), "utf8")] as const) : [];
}));
type SlotRecord = { selfToken?: string; openedAt?: number; bibliothek?: boolean };
const recordOf = (f: ReturnType<typeof fixture>, slot: number): SlotRecord =>
  (persisted(f).slots as Record<string, SlotRecord> | undefined)?.[String(slot)] ?? {};
const tokenOf = (f: ReturnType<typeof fixture>, slot: number): string => {
  const t = recordOf(f, slot).selfToken;
  if (!t) throw new Error(`kein Self-Token für Slot ${slot}`);
  return t;
};
// der Skill-Ordner einer Belegung (Abnahme 22.10., FIX): je Slot und Öffnungszeitpunkt einer, im State-Ordner
const ordnerOf = (f: ReturnType<typeof fixture>, slot: number): string => join(f.state, "sitz-skills", `${slot}-${recordOf(f, slot).openedAt}`);
const borrow = (self: string, id: string) => ({ ...get(`/api/self/context/${id}`), token: null, self });
type Abschnitt = { id: string; quelle: string | null; text: string | null; grund?: string };
const wissenOf = (a: Answer | undefined): Abschnitt[] =>
  ((a?.body.teile as { id: string; abschnitte: Abschnitt[] }[] | undefined) ?? [])
    .find((t) => t.id === "liest")?.abschnitte.filter((x) => x.id === "wissen") ?? [];

describe("Die Regel: welche Packs zu welchem Sitz kommen, und wie", () => {
  test("im anderen Repo nur, was überall gilt — auch beim Ausleihen; im Fleet-Repo dazu Fleets eigene Arbeit und das Systemkonzept", () => {
    for (const id of ["running-fleet", "testinstanz-abnahme", "setting-up-agents", "system-concept"]) expect(erwartet(false)).not.toContain(id);
    expect(erwartet(true)).toEqual(expect.arrayContaining([...erwartet(false), "running-fleet", "system-concept"]));
    // das Systemkonzept ist der ganze Text, als Wissen (runde4 §3)
    expect(pack("system-concept").sources).toEqual([expect.objectContaining({ path: "docs/start/system-concept.md", sorte: "wissen" })]);
    expect(textOf("system-concept")).toBe(atHead("docs/start/system-concept.md"));
    expect(seatContextFacts("foreign", "claude", true).triggers).toEqual(["seat-start-any-repo"]);
    expect(seatContextFacts("fleet", "claude").triggers).toEqual(["seat-start", "seat-start-any-repo"]);
  });
  test("was wörtlich im Start steht, erreicht jeden Sitz seines Baums und hat einen Grund: für wen, mit dem Owner, in wenigen Aufrufen", () => {
    expect(Object.keys(SEAT_BOX).sort()).toEqual(["who-it-is-for", "working-in-few-calls", "working-with-the-owner"]);
    // für wen und mit dem Owner gilt in jedem Repo; wie man hier sucht, nur in Fleets eigenem
    expect(erwartet(false)).toEqual(expect.arrayContaining(["who-it-is-for", "working-with-the-owner"]));
    expect(erwartet(false)).not.toContain("working-in-few-calls");
    for (const [id, grund] of Object.entries(SEAT_BOX)) {
      expect(erwartet(true)).toContain(id);
      expect(grund.length).toBeGreaterThan(40);
    }
  });
});

describe("Der Messweg: Skill-Aufrufe am Transkript", () => {
  const zeile = (v: unknown): string => JSON.stringify(v);
  const angebot = zeile({ type: "attachment", attachment: { type: "skill_listing",
    content: "- graphify: Use for any question\n- running-fleet: Bevor du landest: was gilt.\n- who-it-is-for: Bevor du baust." } });
  const aufruf = (skill: string) => zeile({ type: "assistant", message: { content: [{ type: "text", text: "x" },
    { type: "tool_use", name: "Skill", input: { skill } }] } });
  test("angeboten sind die Bibliotheks-Namen der Skill-Liste, aufgerufen die Skill-Werkzeugaufrufe in ihrer Reihenfolge", () => {
    expect(skillAufrufe([angebot, aufruf("running-fleet"), aufruf("graphify"), aufruf("running-fleet")].join("\n"),
      ["running-fleet", "who-it-is-for", "pruefpraxis"]))
      .toEqual({ angeboten: ["running-fleet", "who-it-is-for"], aufgerufen: ["running-fleet", "running-fleet"], kaputt: 0 });
  });
  test("ohne Angebot, leer oder kaputt: nichts geraten, kaputte Zeilen gezählt", () => {
    expect(skillAufrufe("", ["running-fleet"])).toEqual({ angeboten: [], aufgerufen: [], kaputt: 0 });
    expect(skillAufrufe(`{kaputt\n${zeile({ type: "assistant", message: { content: [{ type: "tool_use", name: "Read",
      input: { skill: "running-fleet" } }] } })}\nnull`, ["running-fleet"])).toEqual({ angeboten: [], aufgerufen: [], kaputt: 1 });
  });
});

describe("Fleets Bibliothek erreicht Sitze ohne stehende Rolle", () => {
  test("Branch-Session, freie Sessions in einem anderen Repo und in einem Fleet-Worktree: Start, Skills je Belegung, Ausleihe, Fassung, Plan", async () => {
    const f = fixture();
    const other = join(TMP, "anderes-repo");
    mkdirSync(other);
    sh(other, "init", "-q", "-b", "main");
    writeFileSync(join(other, "README"), "anderes Repo\n");
    sh(other, "add", "README");
    sh(other, "commit", "-q", "-m", "start");

    // in Fleets Repo als Voreinstellung an (Owner 22.10.: „[Zitat entfernt]“; runde4 §3); in einem fremden Repo startet ein Sitz ohne Rolle im eigenen
    // Setup (Owner 23.10. ~22:00, server/eigenes-setup.ts): dort kommt sie nur, wenn sie beim Öffnen gewählt ist
    const plan = (repo: string, harness = "claude", bausteine = "") => get(`/api/founding-plan?repo=${encodeURIComponent(repo)}&role=nur-ordner`
      + `&harness=${harness}${bausteine ? `&bausteine=${bausteine}` : ""}`);
    // je Leben eine Frist (LIFE_DEADLINE_MS): Öffnen und Planen getrennt, ein frischer Klon übersetzt server.ts erst
    const [made, branch, frei, fleet, ohne, falsch] = await life(f, [
      post("/api/branches", { repo: f.repo, name: "Wissen Probe" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/wissen-probe", bibliothek: true }),
      post("/api/slots/12/open", { cwd: other, label: "Frei angeschaltet", bibliothek: true }),
      post("/api/slots/13/open", { cwd: FLEET_WT, label: "Frei im Fleet" }),
      post("/api/slots/14/open", { cwd: other, label: "Frei ohne Wahl" }),
      post("/api/slots/15/open", { cwd: other, label: "Falsch", bibliothek: "ja" }),
      "save"]);
    const [planVor, planAus] = await life(f, [plan(other), plan(other, "claude", "bibliothek=aus")]);
    expect(made?.status).toBe(201);
    expect([branch?.status, frei?.status, fleet?.status, ohne?.status]).toEqual([200, 200, 200, 200]);
    expect(falsch).toMatchObject({ status: 400, body: { error: "bibliothek must be true or false" } });
    const b = Number(branch?.body.slot);

    // DER START: was jeder Sitz immer braucht, wörtlich; der Rest als Skills aus dem Ordner, den --add-dir nennt —
    // mit der useWhen-Zeile als Beschreibung und dem Text am HEAD als Inhalt
    const starts = [[await startOf(b), false, b], [await startOf(12), false, 12], [await startOf(13), true, 13]] as const;
    // im fremden Repo ohne Wahl: kein Start-Block, kein Ordner
    const ohneWahl = await startOf(14);
    expect([ohneWahl.appended.includes(SEAT_START_HEAD), ohneWahl.addDirs, existsSync(ordnerOf(f, 14))]).toEqual([false, [], false]);
    // ...und das Fenster zeigt den Schalter an, ausgeschaltet beide aus
    type PlanZeile = { id: string; zustand: string; schaltbar: { ja: boolean } };
    const zeileIn = (a: Answer | undefined, id: string) => (a?.body.plan as { bausteine: PlanZeile[] } | undefined)?.bausteine.find((z) => z.id === id);
    expect(zeileIn(planVor, "bibliothek")).toMatchObject({ zustand: "aus", schaltbar: { ja: true } });
    // im anderen Repo bleibt seit runde4 §6 keine Skill: die Zeile ist aus, weil nichts für sie da ist
    expect(zeileIn(planVor, "bibliothek-skills")).toMatchObject({ zustand: skills(false).length ? "an" : "aus", schaltbar: { ja: false } });
    expect(zeileIn(planAus, "bibliothek")).toMatchObject({ zustand: "aus" });
    expect(zeileIn(planAus, "bibliothek-skills")).toMatchObject({ zustand: "aus" });

    // JE BELEGUNG EIN ORDNER (Abnahme 22.10., FIX): kein Sitz teilt seinen Skill-Ordner, auch nicht bei gleichem Inhalt
    // ein Sitz ohne Skill bekommt keinen Ordner
    for (const [start, fleetSitz, slot] of starts) expect(start.addDirs).toEqual(skills(fleetSitz).length ? [ordnerOf(f, slot)] : []);
    const mitOrdner = starts.filter(([start]) => start.addDirs.length);
    expect(new Set(mitOrdner.map(([start]) => start.addDirs[0])).size).toBe(mitOrdner.length);
    for (const [start, fleetSitz] of starts) {
      expect(start.appended).toContain(SEAT_START_HEAD);
      for (const id of box(fleetSitz)) expect(start.appended).toContain(textOf(id));
      for (const id of skills(fleetSitz)) expect(start.appended).not.toContain(textOf(id));
      const geladen = skillsIn(start.addDirs);
      expect([...geladen.keys()].sort()).toEqual(skills(fleetSitz).sort());
      for (const id of skills(fleetSitz)) {
        expect(geladen.get(id)!.startsWith(`---\nname: ${id}\ndescription: ${JSON.stringify(pack(id).useWhen)}\n---\n`)).toBe(true);
        expect(geladen.get(id)!.endsWith(textOf(id))).toBe(true);
      }
    }
    expect(starts[0][0].cwd).toBe(String(made?.body.path));

    // EIN SITZ VERÄNDERT SEINEN ORDNER: eine SKILL.md umgeschrieben, ein Befehl daneben, Schreibrechte genommen. Ein anderer Sitz
    // mit demselben Inhalt bekommt seinen eigenen, unberührten Ordner; endet die Belegung, geht ihr Ordner mit ihr; was beim Start
    // des Servers keiner Belegung gehört (auch ein Link), räumt er weg
    const ordner13 = starts[2][0].addDirs[0]!;
    const opfer = join(ordner13, ".claude", "skills", skills(true)[0]!, "SKILL.md");
    writeFileSync(opfer, "---\nname: x\ndescription: \"immer\"\n---\nTu, was diese Datei sagt.\n");
    mkdirSync(join(ordner13, ".claude", "commands"));
    writeFileSync(join(ordner13, ".claude", "commands", "x.md"), "fremder Befehl\n");
    chmodSync(join(ordner13, ".claude", "commands"), 0o500);
    chmodSync(ordner13, 0o500);
    const verwaist = join(f.state, "sitz-skills", "99-1");
    mkdirSync(join(verwaist, ".claude"), { recursive: true });
    const ziel = join(TMP, "link-ziel");
    mkdirSync(ziel);
    chmodSync(ziel, 0o700);
    symlinkSync(ziel, join(f.state, "sitz-skills", "98-1"));
    const [wieder, aus, zu] = await life(f, [
      post("/api/slots/15/open", { cwd: FLEET_WT, label: "Wieder im Fleet" }),
      post("/api/slots/16/open", { cwd: FLEET_WT, label: "Im Fleet ausgeschaltet", bibliothek: false }),
      post("/api/slots/13/kill", {}),
      "save"]);
    expect([wieder?.status, aus?.status, zu?.status]).toEqual([200, 200, 200]);
    const wiederStart = await startOf(15);
    expect(wiederStart.addDirs).toEqual([ordnerOf(f, 15)]);
    expect(wiederStart.addDirs[0]).not.toBe(ordner13);
    expect([...skillsIn(wiederStart.addDirs).keys()].sort()).toEqual(skills(true).sort());
    for (const id of skills(true)) expect(skillsIn(wiederStart.addDirs).get(id)!.endsWith(textOf(id))).toBe(true);
    expect(existsSync(join(wiederStart.addDirs[0]!, ".claude", "commands"))).toBe(false);
    expect([existsSync(ordner13), existsSync(verwaist), existsSync(join(f.state, "sitz-skills", "98-1"))]).toEqual([false, false, false]);
    // der Link ist weg, sein Ziel steht unverändert: nichts folgt ihm
    expect([existsSync(ziel), (await Bun.file(ziel).stat()).mode & 0o777]).toEqual([true, 0o700]);
    // im Fleet-Repo beim Öffnen ausgeschaltet: nichts, und kein Ordner
    const ausStart = await startOf(16);
    expect([ausStart.appended.includes(SEAT_START_HEAD), ausStart.addDirs, existsSync(ordnerOf(f, 16))]).toEqual([false, [], false]);

    // DIE SELBST-TÜR (Abnahme 22.10. 2/2): eine Session öffnet Branches in ihrem Repo; `bibliothek: true` gibt nichts über die
    // Voreinstellung hinaus — der Slot hält keine Wahl —, `false` schaltet ab. Im fremden Repo ist die Voreinstellung aus: keine Session
    // drängt einem Sitz im eigenen Setup Fleets Bibliothek auf
    const [zwei, drei] = await life(f, [
      post("/api/branches", { repo: f.repo, name: "Selbst an" }),
      post("/api/branches", { repo: f.repo, name: "Selbst aus" })]);
    expect([zwei?.status, drei?.status]).toEqual([201, 201]);
    const [selbstAn, selbstAus] = await life(f, [
      { ...post("/api/self/branches/open", { branch: String(zwei?.body.branch), bibliothek: true }), token: null, self: tokenOf(f, b) },
      { ...post("/api/self/branches/open", { branch: String(drei?.body.branch), bibliothek: false }), token: null, self: tokenOf(f, b) },
      "save"]);
    expect([selbstAn?.status, selbstAus?.status]).toEqual([200, 200]);
    // EIN NEUES LEBEN RÄUMT NUR, WAS KEINER GELADENEN BELEGUNG GEHÖRT (Abnahme 22.10.): Slot 15 öffnete zwei Leben zuvor und läuft
    // weiter — vor dem Laden geräumt, hätte jeder Slot noch kein cwd und sein Ordner wäre weg
    expect(existsSync(ordnerOf(f, 15))).toBe(true);
    const [sa, sx] = [Number(selbstAn?.body.slot), Number(selbstAus?.body.slot)];
    expect(["bibliothek" in recordOf(f, sa), recordOf(f, sx).bibliothek]).toEqual([false, false]);
    expect([(await startOf(sa)).appended.includes(SEAT_START_HEAD), (await startOf(sx)).appended.includes(SEAT_START_HEAD)]).toEqual([false, false]);

    // zwei Leben statt einem: jedes hat seine Frist (LIFE_DEADLINE_MS), und im vollen Lauf ist die Maschine voll
    const [fassungB, fassung12, fassung15, leiheB, verwehrtB, leihe12, leihe15] = await life(f, [
      get(`/api/slots/${b}/fassung?anlass=laufend`),
      get("/api/slots/12/fassung?anlass=laufend"),
      get("/api/slots/15/fassung?anlass=laufend"),
      borrow(tokenOf(f, b), "who-it-is-for"),
      borrow(tokenOf(f, b), "running-fleet"),
      borrow(tokenOf(f, 12), "who-it-is-for"),
      borrow(tokenOf(f, 15), "system-concept")]);
    const [planB, plan12, plan15, planCodex, fassung16] = await life(f, [
      plan(f.repo, "claude", "bibliothek=an"), plan(other, "claude", "bibliothek=an"), plan(FLEET_WT), plan(FLEET_WT, "codex"),
      get("/api/slots/16/fassung?anlass=laufend")]);
    // die Fassung sagt, dass sie aus ist
    expect(wissenOf(fassung16)).toEqual([expect.objectContaining({ text: null,
      grund: expect.stringContaining("Fleets Bibliothek ist für diese Session ausgeschaltet") })]);

    // DIE AUSLEIHE: der Abschnitt aus Fleets Baum am HEAD; im anderen Repo bleibt Fleets Land-Wissen verwehrt
    expect(leiheB).toMatchObject({ status: 200, body: { id: "who-it-is-for", origin: "fleet-manifest", repo: ROOT,
      head: sh(ROOT, "rev-parse", "HEAD") } });
    expect((leiheB?.body.sources as { content: string }[]).map((s) => s.content).join("\n")).toBe(textOf("who-it-is-for"));
    expect(verwehrtB).toMatchObject({ status: 409, body: { refusal: "trigger-not-matched" } });
    expect(leihe12).toMatchObject({ status: 200, body: { id: "who-it-is-for", origin: "fleet-manifest" } });
    expect(leihe15).toMatchObject({ status: 200, body: { id: "system-concept", origin: "fleet-manifest" } });

    // DIE FASSUNG: unter „Wissen“ der Kopf, je Box-Pack sein Text, je Skill die Zeile aus Claudes Skill-Liste mit dem
    // Ordner seiner Belegung — kein „keine stehende Rolle“
    for (const [fassung, start, fleetSitz] of [[fassungB, starts[0][0], false], [fassung12, starts[1][0], false], [fassung15, wiederStart, true]] as const) {
      expect(fassung?.status).toBe(200);
      const wissen = wissenOf(fassung);
      expect(wissen.length).toBe(1 + erwartet(fleetSitz).length);
      for (const id of box(fleetSitz)) expect(wissen.some((a) => a.text?.endsWith(textOf(id)))).toBe(true);
      for (const id of skills(fleetSitz)) {
        const a = wissen.find((x) => x.text === `- ${id}: ${pack(id).useWhen}`);
        expect(a?.quelle?.split("\n")[0]).toBe(`${start.addDirs[0]}/.claude/skills/${id}/SKILL.md`);
        expect(a?.grund).toContain("Skill");
      }
      expect(JSON.stringify(wissen)).not.toContain("keine stehende Rolle");
    }

    // DER GRÜNDUNGSPLAN, DEN DAS FENSTER „NEUE SESSION“ LIEST, IST DERSELBE START (Fachblick 22.10.: „[Zitat entfernt]“
    // ): unter Hintergrund der Start-Block, byteweise der, den der Spawn anhängt; unter How-to die
    // Skill-Zeilen der Skills, die er aus dem --add-dir-Ordner lädt; die Tür liefert beide; kein Pack der Bibliothek steht mehr
    // als „passt nicht zu diesem Start“ da
    type Zeile = { id: string; zustand: string; frage: string; bytes: number | "unknown"; details?: { text?: string; packs?: string[] } };
    const zeilen = (a: Answer | undefined): Zeile[] => (a?.body.plan as { bausteine: Zeile[] } | undefined)?.bausteine ?? [];
    for (const [antwort, start, fleetSitz] of [[planB, starts[0][0], false], [plan12, starts[1][0], false], [plan15, wiederStart, true]] as const) {
      expect([antwort?.status, antwort?.body.error]).toEqual([200, undefined]);
      const bib = zeilen(antwort).find((z) => z.id === "bibliothek"), sk = zeilen(antwort).find((z) => z.id === "bibliothek-skills");
      expect(bib).toMatchObject({ zustand: "an", frage: "hintergrund", details: { packs: box(fleetSitz) } });
      expect(start.appended.slice(start.appended.indexOf(SEAT_START_HEAD))).toBe(bib!.details!.text!);
      expect(bib!.bytes).toBe(Buffer.byteLength(bib!.details!.text!));
      if (!skills(fleetSitz).length) {
        expect(sk).toMatchObject({ zustand: "aus", frage: "howto", details: { packs: [] } });
        expect((antwort?.body.lieferung as { geliefert: { id: string; weg: string }[] }).geliefert)
          .toEqual(expect.arrayContaining([{ id: "bibliothek", weg: "Systemprompt" }]));
      } else {
        expect(sk).toMatchObject({ zustand: "an", frage: "howto", details: { packs: skills(fleetSitz) } });
        const gelistet = [...skillsIn(start.addDirs).values()].map((datei) => {
          const kopf = /^---\nname: (.+)\ndescription: (.+)\n---\n/.exec(datei)!;
          return `- ${kopf[1]}: ${JSON.parse(kopf[2]!) as string}`;
        });
        expect(sk!.details!.text!.split("\n").sort()).toEqual(gelistet.sort());
        expect(sk!.bytes).toBe(Buffer.byteLength(sk!.details!.text!));
        expect((antwort?.body.lieferung as { geliefert: { id: string; weg: string }[] }).geliefert)
          .toEqual(expect.arrayContaining([{ id: "bibliothek", weg: "Systemprompt" }, { id: "bibliothek-skills", weg: "Skill" }]));
      }
      for (const id of erwartet(fleetSitz)) {
        expect(zeilen(antwort).some((z) => z.id === `pack:${id}`)).toBe(false);
        expect((antwort?.body.omitted as { id: string }[]).some((o) => o.id === id)).toBe(false);
      }
    }
    // ein anderer Agent liest weder Start-Block noch Skills: beide aus, und die Packs stehen, wie die Leiter sie sieht
    expect([planCodex?.status, planCodex?.body.error]).toEqual([200, undefined]);
    for (const id of ["bibliothek", "bibliothek-skills"]) expect(zeilen(planCodex).find((z) => z.id === id)?.zustand).toBe("aus");
    expect(zeilen(planCodex).some((z) => z.id === "pack:who-it-is-for")).toBe(true);
  }, LIFE_DEADLINE_MS * 8);
});

// NACH --resume (Abnahme 22.10. (a); code.claude.com/docs/en/cli-reference, „System prompt flags in resumed conversations“): die
// Unterhaltung liest den Systemprompt ihres ersten Starts, bis sie kompaktiert wird — die Fassung sagt dann nicht „wörtlich im Start“
describe("Welchen Start-Block die Unterhaltung liest", () => {
  const A = "a".repeat(64), B = "b".repeat(64);
  test("ein frischer Start liest seinen Block; ein fortgesetzter den des ersten Starts, nach einer Kompaktierung den zuletzt angehängten", () => {
    expect(bibliothekBeimSpawn(null, false, A, null, 10)).toEqual({ wirksam: A, zuletzt: A, am: 10 });
    expect(bibliothekBeimSpawn({ wirksam: A, zuletzt: A, am: 10 }, true, B, null, 20)).toEqual({ wirksam: A, zuletzt: B, am: 20 });
    expect(bibliothekBeimSpawn({ wirksam: A, zuletzt: B, am: 20 }, true, B, 25, 30)).toEqual({ wirksam: B, zuletzt: B, am: 30 });
    // eine Kompaktierung vor dem letzten Spawn zählt nicht; ohne früheren Beleg ist nichts bekannt
    expect(bibliothekBeimSpawn({ wirksam: A, zuletzt: B, am: 20 }, true, B, 15, 30).wirksam).toBe(A);
    expect(bibliothekBeimSpawn(null, true, A, null, 10).wirksam).toBeNull();
  });
  test("wirksam heißt: der Block der Unterhaltung ist der heutige; sonst nennt die Fassung den Grund", () => {
    expect(bibliothekNichtWirksam({ wirksam: A, zuletzt: A, am: 10 }, A, null)).toBeUndefined();
    expect(bibliothekNichtWirksam({ wirksam: null, zuletzt: A, am: 10 }, A, null)).toContain("--resume");
    expect(bibliothekNichtWirksam({ wirksam: null, zuletzt: A, am: 10 }, A, 11)).toBeUndefined();
    expect(bibliothekNichtWirksam({ wirksam: null, zuletzt: A, am: 10 }, A, 9)).toContain("--resume");
    expect(bibliothekNichtWirksam({ wirksam: A, zuletzt: A, am: 10 }, B, null)).toContain("Register hat sich");
    expect(bibliothekNichtWirksam(null, A, null)).toContain("nächsten frischen Start");
  });
  test("nicht wirksam: kein Abschnitt sagt „wörtlich im Start“, die Skills bleiben", () => {
    const k: SeatKnowledge = { tree: "fleet", repoRoot: "/f", head: "c".repeat(40), packs: [
      { id: "who-it-is-for", useWhen: "immer", sources: [{ path: "p.md", anchor: "A" }], text: "Für wen" },
      { id: "running-fleet", useWhen: "Bevor du landest.", sources: [{ path: "r.md", anchor: "R" }], text: "Landen" }] };
    const gilt = seatFassungAbschnitte(k, true, "/s"), nicht = seatFassungAbschnitte(k, true, "/s", "angehängt beim Fortsetzen");
    expect(gilt.some((a) => a.grund?.startsWith("wörtlich im Start"))).toBe(true);
    expect(nicht.some((a) => a.grund?.includes("wörtlich im Start"))).toBe(false);
    expect(nicht.filter((a) => a.grund?.startsWith("nicht wirksam: angehängt beim Fortsetzen")).length).toBe(2);
    expect(nicht.find((a) => a.text === "- running-fleet: Bevor du landest.")?.grund).toContain("Skill");
  });
});

describe("Die Wahl an der Tür und verwaiste Ordner", () => {
  const plan = (zustand?: string) => zustand ? [{ id: "native-agents", zustand: "an" }, { id: "bibliothek", zustand }] : [{ id: "native-agents", zustand: "an" }];
  test("ohne Wahl gilt die Voreinstellung; das Fenster und der Owner wählen an oder aus", () => {
    expect(bibliothekDerTuer({}, null, "owner")).toEqual({ ok: true, wahl: null });
    expect(bibliothekDerTuer({ bibliothek: false }, null, "owner")).toEqual({ ok: true, wahl: false });
    expect(bibliothekDerTuer({ bibliothek: true }, null, "owner")).toEqual({ ok: true, wahl: true });
    expect(bibliothekDerTuer({}, plan("aus"), "owner")).toEqual({ ok: true, wahl: false });
    expect(bibliothekDerTuer({}, plan("an"), "owner")).toEqual({ ok: true, wahl: true });
  });
  // Abnahme 22.10. 2/2 (c): ein angenommener Plan ohne die Zeile schaltete die Bibliothek aus, auch im Fleet-Repo
  test("ein Plan ohne die Zeile wählt nichts", () => {
    expect(bibliothekDerTuer({}, plan(), "owner")).toEqual({ ok: true, wahl: null });
  });
  // Abnahme 22.10. 2/2, Pflicht: eine Session gibt einer anderen nichts über die Voreinstellung hinaus
  test("an der Selbst-Tür nur ausschalten; anschalten heißt dort: die Voreinstellung", () => {
    expect(bibliothekDerTuer({ bibliothek: true }, null, "self")).toEqual({ ok: true, wahl: null });
    expect(bibliothekDerTuer({ bibliothek: false }, null, "self")).toEqual({ ok: true, wahl: false });
  });
  test("verweigert: kein Wahrheitswert, oder Plan und Feld zugleich", () => {
    expect(bibliothekDerTuer({ bibliothek: "ja" }, null, "owner")).toEqual({ ok: false, error: "bibliothek must be true or false" });
    expect(bibliothekDerTuer({ bibliothek: false }, plan("an"), "owner").ok).toBe(false);
  });
  test("verwaist ist, was keiner laufenden Belegung gehört — auch ein Ordner vom alten Schnitt nach Inhalt", () => {
    expect(seatSkillsVerwaist(["3-100", "3-99", "4-100", "0123456789abcdef"], [{ slot: 3, openedAt: 100 }, { slot: 5, openedAt: 1 }]))
      .toEqual(["3-99", "4-100", "0123456789abcdef"]);
    expect(seatSkillsVerwaist([], [{ slot: 1, openedAt: 1 }])).toEqual([]);
    expect(seatSkillsVerwaist(["1-1"], [])).toEqual(["1-1"]);
  });
});
