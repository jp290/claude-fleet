// DIE BEFUNDE DER PRÜFUNG VON W3a, RUNDE 1 (~/local-notes/w3-konstellation/pruefung/pruefung.md), je Nummer ein Fall an den Türen: das Register eines fremden
// Repos hält die Datengrenze (1), Fleets Kennungen (8) und die Länge, die ein Dateisystem trägt (2); ein Sitz aus einer Position bekommt deren Rechte, nicht die
// Zusagen der Leitung (3), und deren Modus (5); eine zweite Datei tauscht die Rolle eines laufenden Sitzes nicht (4); der Pack einer gebildeten Rolle steht einmal
// im Start (6); ein `datei`-Text bleibt die 400 von vorher (7). Die Panes starten keinen Agenten (server/branches-testkit.ts).
import { afterAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { branchTestkit, get, LIFE_DEADLINE_MS, persisted, post, type Answer, type Fixture } from "./branches-testkit";
import { liesShelf, mitSetupHash } from "./setup-datei";
import { LEAD_WITH_BUILDERS, LEITUNG_ERBITTET } from "./vorlagen";

const { fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

const tokenOf = (f: Fixture, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
  if (!t) throw new Error(`no self token for slot ${slot}`);
  return t;
};
const as = (self: string, step: { method: string; path: string; body?: unknown }) => ({ ...step, token: null, self });
const ordner = (f: Fixture, name: string): string => { const d = join(dirname(f.repo), name); mkdirSync(d, { recursive: true }); return d; };
const OPEN = "/api/self/seats/open";

interface RegPack { id: string; datei: string; text: string; hardness?: "hard" | "guidance"; useWhen?: string; personal?: true }
/** Ein Register im Repo der Fixture, committet: je Pack eine Datei mit dem Text unter ihrem Titel. */
function register(f: Fixture, packs: readonly RegPack[]): void {
  mkdirSync(join(f.repo, ".fleet"), { recursive: true });
  for (const p of packs) { mkdirSync(dirname(join(f.repo, p.datei)), { recursive: true }); writeFileSync(join(f.repo, p.datei), p.text); }
  writeFileSync(join(f.repo, ".fleet/context-packs.json"), JSON.stringify(packs.map((p) => ({ id: p.id, scope: "product-quality", audience: "agent",
    triggers: ["always"], hardness: p.hardness ?? "hard", sources: [{ path: p.datei, anchor: p.text.split("\n")[0] }], requiredCapabilities: ["tracked-source-read"],
    harnesses: ["claude", "codex", "pi"], modes: ["read-only", "mutating"], estimatedBytes: Buffer.byteLength(p.text), evidence: "tree-anchor", owner: "owner", status: "active",
    ...(p.useWhen ? { useWhen: p.useWhen } : {}), ...(p.personal ? { personal: true } : {}) })), null, 2));
  const git = (...a: string[]) => execFileSync("git", ["-C", f.repo, ...a], { env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
  git("add", "-A"); git("commit", "-qm", "register");
}
type Teil = { id: string; abschnitte: { quelle: string | null; text: string | null; grund?: string | null }[] };
const liestVon = (a: Answer | undefined) => ((a?.body.teile as Teil[] | undefined) ?? []).filter((t) => t.id === "liest").flatMap((t) => t.abschnitte);
async function vorlageMitLeitung(f: Fixture, env: Record<string, string>, cwd: string, freigabe = false, dazu: Record<string, unknown> = {}): Promise<string> {
  const [imp] = await life(f, [post("/api/setups/import", { vorlage: LEAD_WITH_BUILDERS, schreiben: true })], env);
  const konst = (imp?.body.konstellation as { id: string }).id;
  if (freigabe) await life(f, [post("/api/k15/freigabe", { konst, pos: "lead" })], env);
  const [lead] = await life(f, [post("/api/slots/1/open", { sitz: `${konst}/lead`, cwd, ...dazu })], env);
  expect(lead?.status).toBe(200);
  return konst;
}

describe("W3a, Befunde der Prüfung Runde 1", () => {
  test("1 · ein persönlicher Pack eines fremden Registers erreicht keinen Sitz, der nicht Anthropic ist; ein Claude-Sitz bekommt ihn", async () => {
    const f = fixture();
    register(f, [{ id: "proj-geheim", datei: "docs/geheim.md", text: "# Geheim\n\nPERSOENLICH-9182\n", personal: true },
      { id: "proj-offen", datei: "docs/offen.md", text: "# Offen\n\nOFFEN-4410\n" }]);
    const plan = (h: string) => get(`/api/founding-plan?repo=${encodeURIComponent(f.repo)}&role=nur-ordner&harness=${h}&anlass=neu`);
    const [pi, claude] = await life(f, [plan("pi"), plan("claude")]);
    expect(pi?.status).toBe(200);
    expect(JSON.stringify(pi?.body)).toContain("OFFEN-4410");
    expect(JSON.stringify(pi?.body)).not.toContain("PERSOENLICH-9182");
    expect(JSON.stringify(claude?.body)).toContain("PERSOENLICH-9182");
  }, LIFE_DEADLINE_MS * 4);

  test("2 · eine Kennung, die kein Dateisystem trägt, nimmt der Start nicht; die übrigen Packs kommen, Fleets Türen erst wenn angeschaltet, nichts bleibt liegen", async () => {
    const f = fixture();
    const lang = "a".repeat(300);
    register(f, [{ id: lang, datei: "docs/lang.md", text: "# Lang\n\nLANG-3001\n", hardness: "guidance", useWhen: "When it is long." },
      { id: "proj-gut", datei: "docs/gut.md", text: "# Gut\n\nGUT-5150\n", hardness: "guidance", useWhen: "When it is good." }]);
    const [open] = await life(f, [post("/api/slots/1/open", { cwd: f.repo })]);
    expect(open?.status).toBe(200);
    // der Ordner der Belegung trägt die Skills, kein .tmp daneben
    const skills = join(f.state, "sitz-skills");
    const ordnerListe = existsSync(skills) ? readdirSync(skills) : [];
    expect(ordnerListe.filter((n) => n.includes(".tmp"))).toEqual([]);
    const belegung = ordnerListe.find((n) => n.startsWith("1-"));
    expect(belegung && existsSync(join(skills, belegung, ".claude/skills/proj-gut/SKILL.md"))).toBe(true);
    expect(belegung && existsSync(join(skills, belegung, ".claude/skills/fleet-doors/SKILL.md"))).toBe(false);
    const [fassung] = await life(f, [get("/api/slots/1/fassung?anlass=laufend")]);
    const text = JSON.stringify(liestVon(fassung));
    expect(text).not.toContain("When it is long.");
    expect(text).toContain("When it is good.");
    expect(text).toContain(`− pack ${lang.slice(0, 40)}`);
  }, LIFE_DEADLINE_MS * 4);

  test("8 · eine Kennung Fleets nimmt ein fremdes Register nicht, auch wenn der Sitz den Pack nicht gewählt hat", async () => {
    const f = fixture();
    register(f, [{ id: "leiten", datei: "docs/leiten.md", text: "# Fremd\n\nHART-TEXT-7731\n" }, { id: "proj-gut", datei: "docs/gut.md", text: "# Gut\n\nGUT-5150\n" }]);
    const [open] = await life(f, [post("/api/slots/1/open", { cwd: f.repo })]);
    expect(open?.status).toBe(200);
    const [fassung] = await life(f, [get("/api/slots/1/fassung?anlass=laufend")]);
    const text = JSON.stringify(liestVon(fassung));
    expect(text).toContain("GUT-5150");
    expect(text).not.toContain("HART-TEXT-7731");
    expect(text).toContain("− pack leiten");
  }, LIFE_DEADLINE_MS * 4);

  test("3 · Bauer und Prüfer aus ihren Positionen tragen die Zusagen nicht, die der Owner nur der Leitung bestätigte; ein Kind ohne Position erbt wie bisher", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: dirname(f.repo) };
    await vorlageMitLeitung(f, env, ordner(f, "lead"), true);
    const leadTok = tokenOf(f, 1);
    const [bauer, frei] = await life(f, [as(leadTok, post(OPEN, { sitz: "builder", cwd: ordner(f, "bau"), goal: "Build." })),
      as(leadTok, post(OPEN, { cwd: ordner(f, "frei"), goal: "A bare seat." }))], env);
    expect([bauer?.status, frei?.status]).toEqual([200, 200]);
    const wirksam = async (slot: number): Promise<string[]> => {
      const [s] = await life(f, [as(tokenOf(f, slot), get("/api/self"))], env);
      return (s?.body.rechte as { effective: string[] }).effective;
    };
    const lead = await wirksam(1), b = await wirksam(Number(bauer?.body.slot)), k = await wirksam(Number(frei?.body.slot));
    for (const id of LEITUNG_ERBITTET) { expect(lead).toContain(id); expect(b).not.toContain(id); expect(k).toContain(id); }
    expect(b).toContain("seat.open");
  }, LIFE_DEADLINE_MS * 10);

  test("4 · eine zweite Datei mit derselben Rollen-Kennung ist in der Vorschau eine Kollision und tauscht die Rolle der laufenden Leitung nicht", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: dirname(f.repo) };
    await vorlageMitLeitung(f, env, ordner(f, "lead"));
    const [vorher] = await life(f, [get("/api/slots/1/fassung?anlass=nachfolge")], env);
    const [datei] = await life(f, [get(`/api/setups/vorlagen/${LEAD_WITH_BUILDERS}/datei`)], env);
    const d = datei!.body as { roles: { id: string; name: string; start: { titel: string; text: string }; rights: string[]; packs: unknown[]; hash: string }[] } & Record<string, unknown>;
    const { roleHash, mitSetupHash } = await import("./setup-datei");
    const fremd = { ...d.roles[0]!, start: { titel: "Lead", text: "STRANGER-ROLE-5521 takes over." } };
    const fremdeRolle = { ...fremd, hash: roleHash({ id: fremd.id, name: fremd.name, start: fremd.start, rights: fremd.rights as never, packs: fremd.packs as never }) };
    const zweite = mitSetupHash({ ...(d as Record<string, unknown>), name: "Stranger team", roles: [fremdeRolle, ...d.roles.slice(1)] } as never);
    const [vorschau, geschrieben] = await life(f, [post("/api/setups/import", { datei: zweite }), post("/api/setups/import", { datei: zweite, schreiben: true })], env);
    expect((vorschau?.body.vorschau as { collisions: { kind: string; id: string }[] }).collisions.some((c) => c.kind === "role" && c.id === "leitung")).toBe(true);
    expect(geschrieben?.status).toBe(201);
    const [nachher] = await life(f, [get("/api/slots/1/fassung?anlass=nachfolge")], env);
    expect(JSON.stringify(nachher?.body)).not.toContain("STRANGER-ROLE-5521");
    expect(nachher?.body.hash).toBe(vorher?.body.hash);
  }, LIFE_DEADLINE_MS * 8);

  test("5 · eine Leitung in einem fremden Repo startet im Modus ihrer Position (auto), nicht im Standard des Nutzers", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: dirname(f.repo) };
    await vorlageMitLeitung(f, env, f.repo);
    expect((persisted(f).slots as Record<string, { permissionMode?: string | null }>)["1"]?.permissionMode).toBe("auto");
    const leadTok = tokenOf(f, 1);
    const [bauer] = await life(f, [as(leadTok, post(OPEN, { sitz: "builder", cwd: ordner(f, "bau"), goal: "Build." }))], env);
    expect(bauer?.status).toBe(200);
    expect((persisted(f).slots as Record<string, { permissionMode?: string | null }>)[String(bauer?.body.slot)]?.permissionMode).toBe("auto");
  }, LIFE_DEADLINE_MS * 6);

  test("6 · der Pack einer gebildeten Rolle steht einmal im Start ihres Sitzes", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: dirname(f.repo) };
    await life(f, [post("/api/slots/1/open", { cwd: ordner(f, "lead"), bibliothek: true })], env);
    await life(f, [post("/api/slots/1/rechte", { grant: ["role.form"] })], env);
    const leadTok = tokenOf(f, 1);
    const [rolle, kind] = await life(f, [as(leadTok, post("/api/self/roles", { name: "Probe", text: "probe role", packs: ["who-it-is-for"] })),
      as(leadTok, post(OPEN, { role: "probe", cwd: ordner(f, "probe"), goal: "Probe.", bibliothek: ["who-it-is-for"] }))], env);
    expect([rolle?.status, kind?.status]).toEqual([201, 200]);
    const [fassung] = await life(f, [get(`/api/slots/${Number(kind?.body.slot)}/fassung?anlass=laufend`)], env);
    const mal = liestVon(fassung).filter((a) => a.text?.includes("\n# Who it is for\n")).length;
    expect(mal).toBe(1);
  }, LIFE_DEADLINE_MS * 6);

  test("7 · ein Text unter `datei` bleibt die 400 von vorher, ohne den Text zurückzugeben", async () => {
    const f = fixture();
    const [a] = await life(f, [post("/api/setups/import", { datei: "hello <script>" })]);
    expect(a?.status).toBe(400);
    expect(String(a?.body.error)).not.toContain("<script>");
  }, LIFE_DEADLINE_MS * 2);

  // RUNDE 2 der Prüfung: R2-1 (der Modus ist das Engere aus Position und Öffnerin, nie bypass aus einer Position), R2-2 (ein zweiter Import derselben Datei
  // legt keine zweite Kopie einer umbenannten Rolle an), der Worktree eines fremden Repos liest am Integrationskopf
  const modusVon = (f: Fixture, slot: unknown) => (persisted(f).slots as Record<string, { permissionMode?: string | null }>)[String(slot)]?.permissionMode;
  test("R2-1 A · eine Leitung in bypass öffnet einen Bauer aus seiner Position: er startet in auto, nicht in bypass", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: dirname(f.repo) };
    await vorlageMitLeitung(f, env, ordner(f, "lead"), false, { permissionMode: "bypassPermissions" });
    expect(modusVon(f, 1)).toBe("bypassPermissions");
    const [bauer] = await life(f, [as(tokenOf(f, 1), post(OPEN, { sitz: "builder", cwd: ordner(f, "bau"), goal: "Build." }))], env);
    expect(bauer?.status).toBe(200);
    expect(modusVon(f, bauer?.body.slot)).toBe("auto");
  }, LIFE_DEADLINE_MS * 6);

  test("R2-1 B · eine Position mit dontAsk unter einer Leitung in auto startet in dontAsk", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: dirname(f.repo) };
    const [datei] = await life(f, [get(`/api/setups/vorlagen/${LEAD_WITH_BUILDERS}/datei`)], env);
    const d = datei!.body as { seats: { id: string; may: Record<string, unknown> }[] } & Record<string, unknown>;
    const eng = mitSetupHash({ ...d, name: "Narrow builder", seats: d.seats.map((x) => x.id === "builder" ? { ...x, may: { ...x.may, permissionMode: "dontAsk" } } : x) } as never);
    const [imp] = await life(f, [post("/api/setups/import", { datei: eng, schreiben: true })], env);
    expect(imp?.status).toBe(201);
    const konst = (imp?.body.konstellation as { id: string }).id;
    const [lead] = await life(f, [post("/api/slots/1/open", { sitz: `${konst}/lead`, cwd: ordner(f, "lead") })], env);
    expect(lead?.status).toBe(200);
    expect(modusVon(f, 1)).toBe("auto");
    const [bauer] = await life(f, [as(tokenOf(f, 1), post(OPEN, { sitz: "builder", cwd: ordner(f, "bau"), goal: "Build." }))], env);
    expect(bauer?.status).toBe(200);
    expect(modusVon(f, bauer?.body.slot)).toBe("dontAsk");
  }, LIFE_DEADLINE_MS * 6);

  test("R2-2 · dieselbe fremde Datei zweimal importiert legt die umbenannte Rolle einmal aufs Regal", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: dirname(f.repo) };
    const [datei] = await life(f, [get(`/api/setups/vorlagen/${LEAD_WITH_BUILDERS}/datei`)], env);
    const d = datei!.body as { roles: { id: string; name: string; start: { titel: string; text: string }; rights: string[]; packs: unknown[]; hash: string }[] } & Record<string, unknown>;
    const { roleHash } = await import("./setup-datei");
    const fremd = { ...d.roles[0]!, start: { titel: "Lead", text: "STRANGER-ROLE-5521 takes over." } };
    const fremdeRolle = { ...fremd, hash: roleHash({ id: fremd.id, name: fremd.name, start: fremd.start, rights: fremd.rights as never, packs: fremd.packs as never }) };
    const zweite = mitSetupHash({ ...(d as Record<string, unknown>), name: "Stranger team", roles: [fremdeRolle, ...d.roles.slice(1)] } as never);
    const schritte = await life(f, [post("/api/setups/import", { vorlage: LEAD_WITH_BUILDERS, schreiben: true }),
      post("/api/setups/import", { datei: zweite, schreiben: true }), post("/api/setups/import", { datei: zweite, schreiben: true })], env);
    expect(schritte.map((a) => a?.status)).toEqual([201, 201, 201]);
    const ids = (liesShelf(f.state).roles ?? []).map((r) => r.id).filter((id) => id.startsWith("leitung"));
    expect(ids.length).toBe(2);
    expect(ids).toContain("leitung");
  }, LIFE_DEADLINE_MS * 6);

  test("WORKTREE · ein Sitz im Worktree eines fremden Repos liest Register und Texte am Integrationskopf, nicht am Zweig des Worktrees", async () => {
    const f = fixture();
    register(f, [{ id: "proj-hart", datei: "docs/hart.md", text: "# Hart\n\nHART-TEXT-7731\n" }]);
    const wt = join(dirname(f.repo), "fremd-wt");
    const git = (dir: string, ...a: string[]) => execFileSync("git", ["-C", dir, ...a], { env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
    git(f.repo, "worktree", "add", "-q", "-b", "feat", wt);
    writeFileSync(join(wt, "docs/hart.md"), "# Hart\n\nWT-BRANCH-TEXT-3141\n");
    git(wt, "commit", "-qam", "branch text");
    const [open] = await life(f, [post("/api/slots/1/open", { cwd: wt })]);
    expect(open?.status).toBe(200);
    const [laufend, vorschau] = await life(f, [get("/api/slots/1/fassung?anlass=laufend"),
      get(`/api/founding-plan?repo=${encodeURIComponent(wt)}&role=nur-ordner&harness=claude&anlass=neu`)]);
    const text = JSON.stringify(liestVon(laufend));
    expect(text).toContain("HART-TEXT-7731");
    expect(text).not.toContain("WT-BRANCH-TEXT-3141");
    expect(JSON.stringify(vorschau?.body)).not.toContain("WT-BRANCH-TEXT-3141");
  }, LIFE_DEADLINE_MS * 4);

  // RUNDE 3 der Prüfung: R3-1 (der Worktree eines nackten Repos liest am Integrationskopf), O-1 (an den Selbst-Türen nie bypass für einen Sitz aus einer Position,
  // auch nicht mit einem Modus im Body; die Owner-Tür bleibt seine Wahl)
  test("R3-1 · ein Sitz im Worktree eines nackten Repos liest am Integrationskopf, nicht am Zweig des Worktrees", async () => {
    const f = fixture();
    register(f, [{ id: "proj-hart", datei: "docs/hart.md", text: "# Hart\n\nHART-TEXT-7731\n" }]);
    const wurzel = dirname(f.repo), nackt = join(wurzel, "bare.git"), wt = join(wurzel, "bare-feat");
    const git = (dir: string, ...a: string[]) => execFileSync("git", ["-C", dir, ...a], { env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
    execFileSync("git", ["clone", "-q", "--bare", f.repo, nackt]);
    git(nackt, "worktree", "add", "-q", join(wurzel, "bare-main"), String(git(f.repo, "rev-parse", "--abbrev-ref", "HEAD")).trim());
    git(nackt, "worktree", "add", "-q", "-b", "feat", wt);
    writeFileSync(join(wt, "docs/hart.md"), "# Hart\n\nBARE-BRANCH-TEXT-2718\n");
    git(wt, "commit", "-qam", "branch text");
    const [open] = await life(f, [post("/api/slots/1/open", { cwd: wt })]);
    expect(open?.status).toBe(200);
    const [laufend, vorschau] = await life(f, [get("/api/slots/1/fassung?anlass=laufend"),
      get(`/api/founding-plan?repo=${encodeURIComponent(wt)}&role=nur-ordner&harness=claude&anlass=neu`)]);
    const text = JSON.stringify(liestVon(laufend));
    expect(text).toContain("HART-TEXT-7731");
    expect(text).not.toContain("BARE-BRANCH-TEXT-2718");
    expect(JSON.stringify(vorschau?.body)).not.toContain("BARE-BRANCH-TEXT-2718");
  }, LIFE_DEADLINE_MS * 4);

  test("O-1 · eine Leitung in bypass öffnet eine Position mit bypass im Body: 409 an beiden Selbst-Türen; ohne `sitz` wie bisher", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: dirname(f.repo) };
    await vorlageMitLeitung(f, env, f.repo, false, { permissionMode: "bypassPermissions" });
    expect(modusVon(f, 1)).toBe("bypassPermissions");
    const lead = tokenOf(f, 1);
    const [b] = await life(f, [post("/api/branches", { repo: f.repo, name: "Checker branch" })], env);
    expect(b?.status).toBe(201);
    const [ordnerTuer, branchTuer, frei] = await life(f, [
      as(lead, post(OPEN, { sitz: "checker", cwd: ordner(f, "pruef"), goal: "Check.", permissionMode: "bypassPermissions" })),
      as(lead, post("/api/self/branches/open", { branch: String(b?.body.branch), sitz: "checker", goal: "Check.", permissionMode: "bypassPermissions" })),
      as(lead, post(OPEN, { cwd: ordner(f, "frei"), goal: "A bare seat.", permissionMode: "bypassPermissions" }))], env);
    expect([ordnerTuer?.status, branchTuer?.status]).toEqual([409, 409]);
    expect(String(ordnerTuer?.body.error)).toContain("bypass");
    expect(String(branchTuer?.body.error)).toContain("bypass");
    expect(frei?.status).toBe(200);
  }, LIFE_DEADLINE_MS * 8);
});
