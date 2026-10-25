// Ein Fremder arbeitet in seinem eigenen Repo durch Fleet (Brief fremdes-repo-rund, Owner 23.10. ~22:00: „[Zitat entfernt]“
// ). Am echten Route-Handler, mit Fixture-Repos ohne ci/merge-check.ts:
// 1. ein Prüfbefehl je Repo, im Board gesetzt, ist Merge-Check, Land-Gate und Audit; eine Session schlägt ihn nur vor;
// 2. ein gepinntes Repo ist ein Arbeitsort ohne laufende Session; abgeheftet ist es wieder fremd (server.ts#pinnedRepos);
// 3. das Ziel einer Branch-Session wartet, solange Claude Code nach Vertrauen fragt, und das Board zeigt die Frage.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import { basename, join } from "node:path";
import { type Answer, branchTestkit, commitIn, type Fixture, get, LIFE_DEADLINE_MS, persisted, post, rowsOf, sh } from "./branches-testkit";
import { LEERLAUF } from "./warte-hinweis.fixtures";
import { exportObjekt, pos, PROFILE0, type Konst, type Profil } from "../src/k15-entwurf-modell";
import { SPEICHER_DATEI } from "../src/k15-speicher";
import { eigenerModus } from "./fassung-umfeld";
import { envFileText, loginBase, paneVars, parseLoginEnv } from "./login-umgebung";

const { TMP, BIN, fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);
// der Ersatz-claude: zeichnet die Datei seines Ordners, sobald sie sich ändert, und schreibt, was in die Pane getippt wird, nach <datei>.in
const FRAMES = join(TMP, "frames");
mkdirSync(FRAMES);
// …und läuft unter bash über einen Link, dessen Name mit „claude“ beginnt: Fleet stellt nur einer Pane zu, deren Agent lebt
// (server.ts#paneAgentAt liest den Prozessnamen), ein Skript unter /bin/sh hieße „sh“, und eine Kopie von bash beendet macOS
symlinkSync("/bin/bash", join(BIN, "claude-bash"));
writeFileSync(join(BIN, "claude"), `#!${join(BIN, "claude-bash")}
f="${FRAMES}/$(basename "$PWD")"; last=x
env > "$f.env"
printf '%s\\n' "$@" > "$f.args"
exec 3<&0; cat <&3 >> "$f.in" &
while :; do cur=$(cat "$f" 2>/dev/null); if [ "$cur" != "$last" ]; then printf '\\033[H\\033[2J%s\\n' "$cur"; last=$cur; fi; sleep 0.2; done
`, { mode: 0o755 });

const tokenOf = (f: Fixture, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
  if (!t) throw new Error(`kein Self-Token für Slot ${slot} in fleet.json`);
  return t;
};
const slotOf = (a: Answer | undefined): number => {
  const n = Number(a?.body.slot);
  if (a?.status !== 200 || !Number.isInteger(n)) throw new Error(`Öffnen schlug fehl: ${JSON.stringify(a)}`);
  return n;
};
const as = (self: string, step: { method: string; path: string; body?: unknown }) => ({ ...step, token: null, self });
const ledger = (repo: string): string => join(sh(repo, "rev-parse", "--path-format=absolute", "--git-common-dir"), "merge-checks.jsonl");
type CheckCommand = { way: string; cmd: string | null; by?: string | null; at?: number | null; proposal: { cmd: string; by: string } | null };
const commandOf = (a: Answer | undefined, repo: string): CheckCommand =>
  ((a?.body.repos as { repo: string; checkCommand: CheckCommand }[]).find((r) => r.repo === repo))!.checkCommand;

// Wartet das Audit nach dem Land auf eine Datei, die nie kommt (408), sagt der Fehler, was das Audit gerade tut und ob die Suite-Sperre
// des Rechners im Spiel ist: der Audit-Stand aus Schritt 10 und 12, was im Zustandsordner liegt, die Sperre und ihr Halter.
function auditDiagnosis(f: Fixture, r: (Answer | undefined)[]): string {
  const lockPath = process.env.FLEET_SUITE_LOCK ?? "/tmp/fleet-e2e.lock";
  const lock = existsSync(lockPath) ? `${lockPath} held: ${readFileSync(lockPath, "utf8").slice(0, 300).replace(/\s+/g, " ")}` : `${lockPath} absent`;
  const look = (a: Answer | undefined) => JSON.stringify({ status: a?.status, body: a?.body }).slice(0, 1200);
  return `Audit nach dem Land: Schritt 11 endete mit ${r[11]?.status}. Schritt 10 ${look(r[10])}. Schritt 12 ${look(r[12])}. `
    + `Zustandsordner: ${readdirSync(f.state).join(", ")}. Suite-Sperre: ${lock}. Last: ${loadavg().map((n) => n.toFixed(1)).join(" ")}.`;
}

describe("1 · der Prüfbefehl je Repo", () => {
  test("eine Session schlägt vor, nichts läuft; der Owner setzt ihn, der Check läuft ihn gegen den Kandidaten, grün landet die Session selbst", async () => {
    const f = fixture();
    const [made, opened] = await life(f, [post("/api/branches", { repo: f.repo, name: "Prüfung" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/pruefung" })]);
    const self = tokenOf(f, slotOf(opened));
    const tip = commitIn(String(made?.body.path), "a.txt", "gut");
    const CMD = "grep -q gut a.txt && test ! -e .fleet-check.tar";
    const r = await life(f, [
      post("/api/branches/seen", { repo: f.repo, branch: "branch/pruefung", head: tip }),
      as(self, post("/api/self/branches/land", { subject: "Prüfung" })),            // 1: ohne Prüfbefehl landet die Session nicht
      as(self, post("/api/self/repo-check", { cmd: CMD })),                       // 2: Vorschlag
      as(self, post("/api/self/branches/check", {})),                             // 3: ein Vorschlag läuft nicht
      get("/api/branches"),                                                       // 4
      post("/api/repo-check", { repo: f.repo, cmd: CMD }),                        // 5: der Owner nimmt ihn
      as(self, post("/api/self/branches/check", {})),                             // 6
      { until: ledger(f.repo), ms: 15_000 },                                      // 7
      as(self, get("/api/self/branch")),                                          // 8
      as(self, post("/api/self/branches/land", { subject: "Prüfung: grün" })),     // 9
      get("/api/post-land-audits"),                                               // 10
      { until: join(f.state, "post-land-audits.jsonl"), ms: 20_000 },             // 11
      get("/api/post-land-audits")]);                                             // 12
    expect(r[1]?.status).toBe(409);
    expect(String(r[1]?.body.error)).toContain("POST /api/self/repo-check");
    expect(r[2]).toMatchObject({ status: 200, body: { check: { way: "none", cmd: null, proposal: { cmd: CMD, by: `slot ${slotOf(opened)}` } } } });
    expect(r[3]?.status).toBe(400);
    expect(String(r[3]?.body.error)).toContain("waits for the owner");
    expect(commandOf(r[4], f.repo)).toMatchObject({ way: "none", proposal: { cmd: CMD } });
    expect(r[5]).toMatchObject({ status: 200, body: { check: { way: "command", cmd: CMD, proposal: null } } });
    expect(r[6]).toMatchObject({ status: 202, body: { ok: true, tip, base: "main", cmd: CMD } });
    expect(r[7]?.status).toBe(200);
    const row = JSON.parse(readFileSync(ledger(f.repo), "utf8").trim().split("\n").at(-1)!) as Record<string, unknown>;
    expect(row).toMatchObject({ branch: "branch/pruefung", tip, verdict: "green", mergeable: true, exit: 0, cmd: CMD });
    expect(r[8]).toMatchObject({ status: 200, body: { branch: "branch/pruefung", check: { state: "green" }, checkCommand: { way: "command", cmd: CMD } } });
    expect(r[9]).toMatchObject({ status: 200, body: { ok: true, checked: true } });
    expect(sh(f.repo, "log", "-1", "--format=%s", "main")).toBe("Prüfung: grün");
    // 6 · der main eines fremden Repos liest englisch
    expect(sh(f.repo, "log", "-1", "--format=%b", "main")).toBe(`Batch from branch/pruefung up to ${tip.slice(0, 8)}:\n- ${tip.slice(0, 8)} gut\n\n`
      + `Looked at and marked “looks good” at ${tip.slice(0, 8)}.`);
    // der Prüfbefehl ist auch das Audit nach dem Land: ohne jeden Audit-Befehl in der Umgebung wartet eins auf den neuen Tip
    expect(r[10]?.body.pending).toEqual([expect.objectContaining({ repo: basename(f.repo), main: "main", covers: 1 })]);
    // …und sein Exit-Code ist das Urteil: grün, nicht „unknown, weil keine Fleet-Checks gezählt wurden“
    if (r[11]?.status !== 200) throw new Error(auditDiagnosis(f, r));
    expect(r[11]?.status).toBe(200);
    expect((r[12]?.body.audits as Record<string, unknown>[])[0]).toMatchObject({ result: "green", exitCode: 0, checks: null, cmdSource: "check-command" });
    expect(persisted(f).repoChecks).toEqual({ [f.repo]: { cmd: CMD, by: "owner", at: expect.any(Number), proposal: null } });
  }, LIFE_DEADLINE_MS * 2);

  test("rot: der Exit-Code zählt, die Session landet nicht, der Owner ohne Prüfung schon", async () => {
    const f = fixture();
    const [made, opened] = await life(f, [post("/api/branches", { repo: f.repo, name: "Rot" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/rot" }), post("/api/repo-check", { repo: f.repo, cmd: "grep -q gut a.txt" })]);
    const self = tokenOf(f, slotOf(opened));
    const tip = commitIn(String(made?.body.path), "a.txt", "schlecht");
    const r = await life(f, [post("/api/branches/seen", { repo: f.repo, branch: "branch/rot", head: tip }),
      post("/api/branches/check", { repo: f.repo, branch: "branch/rot" }), { until: ledger(f.repo), ms: 15_000 }, get("/api/branches"),
      as(self, post("/api/self/branches/land", { subject: "Rot" }))]);
    expect(r[1]?.status).toBe(202);
    const b = rowsOf(r[3]!, f.repo).branches.find((x) => x.branch === "branch/rot");
    expect(b?.check).toMatchObject({ state: "red" });
    expect(String(b?.check?.why)).toContain("exit 1");
    expect(r[4]?.status).toBe(409);
    expect(String(r[4]?.body.error)).toContain("nicht mergebar");
  }, LIFE_DEADLINE_MS * 2);

  test("Fleets Weg bleibt: ein Repo mit ci/merge-check.ts nimmt keinen Prüfbefehl, an keiner Tür", async () => {
    const f = fixture();
    mkdirSync(join(f.repo, "ci"));
    writeFileSync(join(f.repo, "ci/merge-check.ts"), "// Attrappe\n");
    sh(f.repo, "add", "ci");
    sh(f.repo, "commit", "-q", "-m", "merge-check");
    const [, opened] = await life(f, [post("/api/branches", { repo: f.repo, name: "Fleet" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/fleet" })]);
    const r = await life(f, [post("/api/repo-check", { repo: f.repo, cmd: "true" }),
      as(tokenOf(f, slotOf(opened)), post("/api/self/repo-check", { cmd: "true" })), get("/api/branches")]);
    expect([r[0]?.status, r[1]?.status]).toEqual([409, 409]);
    expect(String(r[0]?.body.error)).toContain("ci/merge-check.ts");
    expect(commandOf(r[2], f.repo)).toEqual({ way: "merge-check", cmd: null, by: null, at: null, proposal: null });
    expect(persisted(f).repoChecks).toBeUndefined();
  }, LIFE_DEADLINE_MS);

  test("ein mehrzeiliger oder leerer Befehl wird abgewiesen und ändert nichts", async () => {
    const f = fixture();
    const r = await life(f, [post("/api/repo-check", { repo: f.repo, cmd: "true" }), post("/api/repo-check", { repo: f.repo, cmd: "true\nrm -rf x" }),
      get("/api/branches")]);
    expect([r[0]?.status, r[1]?.status]).toEqual([200, 400]);
    expect(commandOf(r[2], f.repo).cmd).toBe("true");
  }, LIFE_DEADLINE_MS);
});

describe("2 · ein gepinntes Repo ist ein Arbeitsort", () => {
  function fremdesRepo(f: Fixture, name: string): string {
    const repo = join(f.repo, "..", name);
    mkdirSync(repo);
    sh(repo, "init", "-q", "-b", "main");
    writeFileSync(join(repo, "README"), `${name}\n`);
    sh(repo, "add", "README");
    sh(repo, "commit", "-q", "-m", "start");
    return repo;
  }
  test("gepinnt ohne Session: Branch anlegen geht und er steht auf dem Board", async () => {
    const f = fixture();
    const repo = fremdesRepo(f, "fremd");
    const r = await life(f, [post("/api/branches", { repo, name: "Vor dem Pin" }),
      post("/api/pins", { path: repo }), post("/api/branches", { repo, name: "Erster Branch" }), get("/api/branches"), get("/api/worktrees"),
      post("/api/branches", { repo, name: "???" })]);
    // 6 · ein Branch ohne lesbaren Namen heißt englisch
    expect(r[5]).toMatchObject({ status: 201, body: { branch: "branch/unnamed" } });
    expect(r[0]?.status).toBe(400);
    expect(String(r[0]?.body.error)).toContain("is not a workplace repo");
    expect(r[2]).toMatchObject({ status: 201, body: { branch: "branch/erster-branch" } });
    expect(rowsOf(r[3]!, repo).branches.map((b) => b.name)).toEqual(["Erster Branch"]);
    expect((r[4]?.body.repos as { repo: string }[]).map((x) => x.repo)).toContain(repo);
  }, LIFE_DEADLINE_MS);
});

// eine Ersatz-Login-Shell: mit -l setzt sie, was eine ~/.zshrc setzen würde (auch ein FLEET_*, das nie in die Pane darf); sonst ein sh
const LOGIN_SHELL = join(BIN, "login-shell");
writeFileSync(LOGIN_SHELL, `#!/bin/sh
case "$1" in -l) export LOGIN_PROBE="aus der Login-Shell 'mit' Zeichen" FLEET_LEAK=1; shift; [ "$1" = -i ] && shift;; esac
[ "$1" = -c ] && { shift; exec /bin/sh -c "$1"; }
exec /bin/sh "$@"
`, { mode: 0o755 });

describe("3 · die Vertrauensfrage", () => {
  // gemessen (e2e/tasks.ts#CLAUDE_TRUST_SCREEN): Claude Codes Frage in einem Ordner, dem es noch nie vertraut hat
  const VERTRAUEN = ["─".repeat(60), " Accessing workspace:", "", " /tmp/never-trusted-repo", "",
    " Claude Code'll be able to read, edit, and execute files here.", "", " ❯ No, exit", "   Yes, I trust this folder", "",
    " Enter to confirm · Esc to cancel", ""].join("\n");
  // nach der Antwort: derselbe Leerlauf, das Eingabefeld leer (der Platzhalter läse sich ohne Farben als Entwurf)
  const BEREIT = LEERLAUF.replace('❯ Try "fix lint errors"', "❯ ");
  test("das Board zeigt die Frage; das Ziel wartet, bis sie beantwortet ist, und kommt dann an", async () => {
    const f = fixture();
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Vertrauen" })]);
    const frame = join(FRAMES, basename(String(made?.body.path)));
    const ZIEL = "Lies die README und sag, was drin steht.";
    const r = await life(f, [{ datei: frame, text: VERTRAUEN, ms: 0 },
      post("/api/branches/open", { repo: f.repo, branch: "branch/vertrauen", goal: ZIEL }),  // 1
      { datei: frame, text: VERTRAUEN, ms: 4000 },                                            // 2: länger als Gnade und Bereitschaftsfrist
      { ausgabe: 1, vorMs: 60_000 }, { warte: 0 }, get("/api/sessions"),                     // 3–5: still seit einer Minute
      { datei: frame, text: BEREIT, ms: 4000 },                                               // 6: beantwortet
      { ausgabe: 1, vorMs: 60_000 }, { warte: 1000 }, get("/api/sessions"), get("/api/errors")], // 7–10
      { FLEET_FOUNDING_BOOT_GRACE_MS: "1500", FLEET_READY_WAIT_MS: "1500", SHELL: LOGIN_SHELL });
    const slot = slotOf(r[1]);
    expect([slot, r[1]?.body.goal]).toEqual([1, "follows"]);
    const row = (a: Answer | undefined) => (a?.body.slots as { id: number; vertrauen?: boolean }[]).find((x) => x.id === slot);
    expect([row(r[5])?.vertrauen, row(r[9])?.vertrauen]).toEqual([true, undefined]);
    expect(r[10]?.body.errors).toEqual([]);
    const typed = existsSync(`${frame}.in`) ? readFileSync(`${frame}.in`, "utf8") : "";
    expect(typed).toContain(ZIEL);
    // 4 · die Pane hatte die Umgebung der Login-Shell (die Ersatz-Shell setzt LOGIN_PROBE nur mit -l), ihre Datei ist wieder weg
    const env = readFileSync(`${frame}.env`, "utf8");
    expect(env).toContain("LOGIN_PROBE=aus der Login-Shell 'mit' Zeichen");
    expect(env).toContain("FLEET_SELF_TOKEN=");
    expect(env).not.toContain("FLEET_LEAK");
    expect(env.split("\n").find((l) => l.startsWith("PATH="))?.split("=")[1]?.split(":")[0]).toBe(BIN);
    expect(existsSync(join(f.state, "pane-env")) ? readdirSync(join(f.state, "pane-env")) : []).toEqual([]);
  }, LIFE_DEADLINE_MS);
});

describe("Testinstanz mit echten Sitzen: das Modell der Instanz gilt auch im eigenen Setup", () => {
  // sonst startet ein Sitz im fremden Repo mit dem Modell aus den Einstellungen des Owners, dem 1M-Opus, das die Instanz fernhält
  const argsOf = async (gate: Record<string, string>): Promise<string[]> => {
    const f = fixture();
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Modell" })]);
    const frame = join(FRAMES, basename(String(made?.body.path)));
    const r = await life(f, [post("/api/branches/open", { repo: f.repo, branch: "branch/modell" }), { warte: 1500 }],
      { FLEET_MODEL: "claude-haiku-5-5", SHELL: LOGIN_SHELL, ...gate });
    slotOf(r[0]);
    return existsSync(`${frame}.args`) ? readFileSync(`${frame}.args`, "utf8").split("\n") : [];
  };
  test("mit echten Sitzen startet er mit --model der Instanz, ohne sie mit dem eigenen Modell", async () => {
    const registry = join(TMP, "echte-sitze");
    mkdirSync(registry);
    const echt = await argsOf({ FLEET_REAL_SEAT_REGISTRY: registry, FLEET_REAL_SEAT_CAP: "2", FLEET_REAL_SEAT_ARMED: join(TMP, "nicht-scharf") });
    expect(echt[echt.indexOf("--model") + 1]).toBe("claude-haiku-5-5");
    expect(await argsOf({})).not.toContain("--model");
  }, LIFE_DEADLINE_MS);
});

describe("5 · der Export sagt, was der Sitz im eigenen Setup wirklich hatte", () => {
  const BAUER: Profil = { ...PROFILE0.find((p) => p.id === "eigen")!, id: "bauer", name: "Bauer", autor: "du", agent: "claude" };
  const K: Konst = { id: "k1", name: "Bauer", v: 1, satz: "ein Sitz", eigen: true, wurzeln: [pos("bauer", "Bauer", "bauer")] };
  const form = { id: K.id, ...exportObjekt({ ebene: "konst", voll: true, konst: [K], k: K, profile: [...PROFILE0, BAUER], q: null, p: PROFILE0[0]! }) };
  type SitzBlock = { liest: { id: string }[]; darf: { modus: string | null } };
  const sitzOf = (a: Answer | undefined): SitzBlock => ((a?.body.datei as { positionen: { sitz?: SitzBlock }[] }).positionen[0]!).sitz!;

  test("im fremden Repo: kein Fleet-Pack und der Modus aus den Claude-Einstellungen; in Fleets Repo wie bisher auto und Fleets Packs", async () => {
    const f = fixture();
    writeFileSync(join(f.state, SPEICHER_DATEI), JSON.stringify({ fassungen: [], packs: [], profile: [], konstellationen: [form] }));
    const claudeDir = join(f.state, "claude-home");
    mkdirSync(claudeDir);
    writeFileSync(join(claudeDir, "settings.json"), JSON.stringify({ permissions: { defaultMode: "acceptEdits" } }));
    const r = await life(f, [get(`/api/k15/konst/k1/datei?repo=${encodeURIComponent(f.repo)}`), get("/api/k15/konst/k1/datei")],
      { CLAUDE_CONFIG_DIR: claudeDir });
    expect([r[0]?.status, r[1]?.status]).toEqual([200, 200]);
    expect(sitzOf(r[0])).toMatchObject({ liest: [], darf: { modus: "acceptEdits" } });
    expect((r[0]?.body.hinweise as string[]).some((h) => h.includes("eigenen Setup"))).toBe(true);
    expect(sitzOf(r[1]).darf.modus).toBe("auto");
    expect(sitzOf(r[1]).liest.length).toBeGreaterThan(0);
  }, LIFE_DEADLINE_MS);

  test("der Modus des eigenen Setups: local vor project vor user, sonst default", () => {
    const dir = join(TMP, "modus"), home = join(dir, "home"), repo = join(dir, "repo");
    mkdirSync(join(repo, ".claude"), { recursive: true });
    mkdirSync(home, { recursive: true });
    expect(eigenerModus(repo, home)).toBe("default");
    writeFileSync(join(home, "settings.json"), JSON.stringify({ permissions: { defaultMode: "plan" } }));
    expect(eigenerModus(repo, home)).toBe("plan");
    writeFileSync(join(repo, ".claude/settings.json"), JSON.stringify({ permissions: { defaultMode: "acceptEdits" } }));
    expect(eigenerModus(repo, home)).toBe("acceptEdits");
    writeFileSync(join(repo, ".claude/settings.local.json"), "{ kaputt");
    expect(eigenerModus(repo, home)).toBe("acceptEdits");
    writeFileSync(join(repo, ".claude/settings.local.json"), JSON.stringify({ permissions: { defaultMode: "dontAsk" } }));
    expect(eigenerModus(repo, home)).toBe("dontAsk");
  });
});

describe("4 · die Umgebung der Login-Shell", () => {
  test("gelesen wird nur nach der Marke; FLEET_* und was das Terminal selbst setzt, bleiben draußen; claude vorn im PATH", () => {
    expect(parseLoginEnv("Willkommen!\n")).toBeNull();
    const vars = parseLoginEnv("Willkommen!\n\0FLEET-LOGIN-ENV\0A=1\0PATH=/x:/y:/z\0FLEET_TOKEN=geheim\0TMUX=/t\0PS1=%\0B=a=b\0")!;
    expect(vars).toEqual({ A: "1", PATH: "/x:/y:/z", FLEET_TOKEN: "geheim", TMUX: "/t", PS1: "%", B: "a=b" });
    expect(paneVars(vars, "/y")).toEqual({ A: "1", B: "a=b", PATH: "/y:/x:/z" });
  });
  test("die Login-Shell bekommt LANG nur als UTF-8-Locale; ein Server in C oder POSIX gibt ihr keins", () => {
    const env = { HOME: "/h", SHELL: "/bin/bash", FLEET_SOCK: "x", LC_ALL: "C" };
    for (const lang of ["de_DE.UTF-8", "en_US.utf8", "sr_RS.UTF-8@latin"]) expect(loginBase({ ...env, LANG: lang }).LANG).toBe(lang);
    for (const lang of ["C", "POSIX", "C.ISO-8859-1", "de_DE", ""]) expect(loginBase({ ...env, LANG: lang })).toEqual({ PATH: "/usr/bin:/bin:/usr/sbin:/sbin", HOME: "/h", SHELL: "/bin/bash" });
  });
  test("die Datei gibt jeden Wert zurück, wie er war", () => {
    const wert = "a 'b' \"c\" $HOME `x`\nzwei";
    const file = join(TMP, "probe.env");
    writeFileSync(file, envFileText({ WERT: wert }));
    const r = Bun.spawnSync(["/bin/sh", "-c", `. '${file}'; printf %s "$WERT"`]);
    expect(r.stdout.toString()).toBe(wert);
  });
});
