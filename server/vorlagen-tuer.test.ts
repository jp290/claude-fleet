// DIE VORLAGE „LEAD WITH BUILDERS“ AN DEN TÜREN (W3a): der Owner importiert sie mit einem Schritt und öffnet die Leitung; die Leitung öffnet
// Bauer und Prüfer über POST /api/self/seats/open {sitz}, GET /api/self/constellation zeigt den Baum, der Bericht eines Kindes liegt in ihrem
// Postfach. Eine Leitung in einem Projekt mit eigenem Register liest dessen Pack unter „Liest“, wie eine Lane. Die vier Rechte, die nur je Sitz
// vergeben werden, erbittet die Leitung; eine Freigabe des Owners gibt sie alle. Die Panes starten keinen Agenten (server/branches-testkit.ts).
import { afterAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { branchTestkit, get, LIFE_DEADLINE_MS, persisted, post, type Fixture } from "./branches-testkit";
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

describe("die Vorlage lead-with-builders", () => {
  test("ein Import, eine Öffnung: die Leitung öffnet Bauer und Prüfer, sieht den Baum, und der Bericht des Bauers liegt in ihrem Postfach", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: dirname(f.repo) };
    const [liste, imp] = await life(f, [get("/api/setups/vorlagen"), post("/api/setups/import", { vorlage: LEAD_WITH_BUILDERS, schreiben: true })], env);
    expect((liste?.body.vorlagen as { id: string }[]).map((v) => v.id)).toContain(LEAD_WITH_BUILDERS);
    expect(imp?.status).toBe(201);
    const konst = (imp?.body.konstellation as { id: string }).id;
    const [lead] = await life(f, [post("/api/slots/1/open", { sitz: `${konst}/lead`, cwd: ordner(f, "lead") })], env);
    expect(lead?.status).toBe(200);
    const leadTok = tokenOf(f, 1);
    const [bauer, pruefer] = await life(f, [
      as(leadTok, post(OPEN, { sitz: "builder", cwd: ordner(f, "bau"), goal: "Build the parser; bun test green." })),
      as(leadTok, post(OPEN, { sitz: "checker", cwd: ordner(f, "pruef"), goal: "Check the parser claim." }))], env);
    expect([bauer?.status, pruefer?.status]).toEqual([200, 200]);
    const bauSlot = Number(bauer?.body.slot), pruefSlot = Number(pruefer?.body.slot);
    const bauTok = tokenOf(f, bauSlot);

    const [baum, vonUnten] = await life(f, [as(leadTok, get("/api/self/constellation")), as(bauTok, get("/api/self/constellation"))], env);
    const me = baum?.body.me as { role: { id: string } | null; position: { pos: string; name: string } | null };
    expect(me.role?.id).toBe("leitung");
    expect(me.position?.pos).toBe("lead");
    const seats = baum?.body.seats as { slot: number | null; position: string | null; relations: string[]; role: { id: string } | null; state: string }[];
    const kind = (slot: number) => seats.find((s) => s.slot === slot);
    expect([kind(bauSlot)?.position, kind(bauSlot)?.role?.id, kind(bauSlot)?.state]).toEqual(["builder", "bauer", "live"]);
    expect([kind(pruefSlot)?.position, kind(pruefSlot)?.role?.id, kind(pruefSlot)?.state]).toEqual(["checker", "pruefer", "live"]);
    expect(kind(bauSlot)?.relations).toEqual(["child", "position"]);
    expect((vonUnten?.body.me as { reportsTo: { slot: number } | null }).reportsTo?.slot).toBe(1);

    const bericht = "Parser built in 3 commits; bun test: 12 pass, 0 fail.";
    const [gesendet] = await life(f, [as(bauTok, post("/api/self/messages", { to: { kind: "session", slot: 1 }, payload: { kind: "text", text: bericht }, idempotencyKey: "w3a-bericht" }))], env);
    expect(gesendet?.status).toBeLessThan(300);
    const [post_] = await life(f, [as(leadTok, get("/api/self/messages?unread=1"))], env);
    expect(JSON.stringify(post_?.body)).toContain(bericht);
  }, LIFE_DEADLINE_MS * 12);

  test("ein Sitz liest mit seinem Self-Token denselben Harness-Katalog wie die Owner-Tür; ohne Token bleibt die Tür zu", async () => {
    const f = fixture();
    await life(f, [post("/api/slots/1/open", { cwd: ordner(f, "frei") })]);
    const [owner, selbst, ohne] = await life(f, [get("/api/harnesses"), as(tokenOf(f, 1), get("/api/self/harnesses")),
      { method: "GET", path: "/api/self/harnesses", token: null }]);
    expect(selbst?.status).toBe(200);
    expect(selbst?.body).toEqual(owner?.body as Record<string, unknown>);
    expect((selbst?.body.harnesses as { id: string }[]).map((h) => h.id)).toContain("claude");
    expect(ohne?.status).toBe(401);
  }, LIFE_DEADLINE_MS * 4);

  test("die Leitung erbittet die vier Rechte je Sitz: ohne Freigabe trägt sie keins, nach der einen Freigabe des Owners alle", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: dirname(f.repo) };
    const [imp] = await life(f, [post("/api/setups/import", { vorlage: LEAD_WITH_BUILDERS, schreiben: true })], env);
    const konst = (imp?.body.konstellation as { id: string }).id;
    await life(f, [post("/api/slots/1/open", { sitz: `${konst}/lead`, cwd: ordner(f, "lead") })], env);
    const effektiv = async (): Promise<string[]> => {
      const [selbst] = await life(f, [as(tokenOf(f, 1), get("/api/self"))], env);
      return ((selbst?.body.rechte as { effective?: string[] } | undefined)?.effective ?? []);
    };
    const vorher = await effektiv();
    expect(vorher).toContain("seat.open");
    for (const id of LEITUNG_ERBITTET) expect(vorher).not.toContain(id);
    const [frei] = await life(f, [post("/api/k15/freigabe", { konst, pos: "lead" })], env);
    expect(frei?.status).toBe(200);
    // die Freigabe gilt dem nächsten Start der Position: der Owner öffnet sie neu (die Owner-Tür belegt den Platz neu)
    const [neu] = await life(f, [post("/api/slots/1/open", { sitz: `${konst}/lead`, cwd: ordner(f, "lead") })], env);
    expect(neu?.status).toBe(200);
    const nachher = await effektiv();
    for (const id of LEITUNG_ERBITTET) expect(nachher).toContain(id);
  }, LIFE_DEADLINE_MS * 10);

  test("eine Leitung in einem Projekt mit eigenem Register liest dessen Pack unter „Liest“, wie eine Lane", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: dirname(f.repo) };
    mkdirSync(join(f.repo, ".fleet"), { recursive: true });
    mkdirSync(join(f.repo, "docs"), { recursive: true });
    const regel = "# Project rules\n\nEvery level loads in under two seconds.\n";
    writeFileSync(join(f.repo, "docs/rules.md"), regel);
    writeFileSync(join(f.repo, ".fleet/context-packs.json"), JSON.stringify([{ id: "projekt-regeln", scope: "product-quality", audience: "agent",
      triggers: ["always"], hardness: "hard", sources: [{ path: "docs/rules.md", anchor: "# Project rules" }], requiredCapabilities: ["tracked-source-read"],
      harnesses: ["claude", "codex"], modes: ["read-only", "mutating"], estimatedBytes: Buffer.byteLength(regel), evidence: "tree-anchor", owner: "owner", status: "active" }], null, 2));
    const git = (...a: string[]) => execFileSync("git", ["-C", f.repo, ...a], { env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
    git("add", "-A"); git("commit", "-qm", "register");
    const [imp] = await life(f, [post("/api/setups/import", { vorlage: LEAD_WITH_BUILDERS, schreiben: true })], env);
    const konst = (imp?.body.konstellation as { id: string }).id;
    const [lead] = await life(f, [post("/api/slots/1/open", { sitz: `${konst}/lead`, cwd: f.repo })], env);
    expect(lead?.status).toBe(200);
    const [fassung] = await life(f, [get("/api/slots/1/fassung?anlass=laufend")], env);
    const teile = fassung?.body.teile as { id: string; abschnitte: { quelle: string | null; text: string | null; grund?: string | null }[] }[];
    const liest = teile.filter((t) => t.id === "liest").flatMap((t) => t.abschnitte);
    const regelAbschnitt = liest.find((a) => a.text?.includes("Every level loads in under two seconds."));
    expect(regelAbschnitt?.quelle).toBe(`${f.repo}/docs/rules.md · # Project rules`);
    // ...und der Pack ihrer Rolle (leiten) steht daneben, einmal: der Rollenblock trägt Starttext und Rechte, der Pack steht als Pack des Sitzes
    const leiten = liest.filter((a) => a.text?.includes("\n# Leading builders\n"));
    expect(leiten.length).toBe(1);
    expect(liest.find((a) => a.quelle?.includes("gebildete Rolle"))?.text).toContain("FLEET ROLE (leitung");
  }, LIFE_DEADLINE_MS * 8);
});
