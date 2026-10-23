// Die Sicherheitsprüfung von Fleet selbst (docs/aufgaben/sicherheitspruefung.fleet.json, Lauf 2 und 3) bestätigte vier Befunde an den Türen.
// Jeder Test hier fährt die Tür, an der der Befund lag, in einem Leben des Servers (server/branches.drive.ts):
// - Lauf 3 F3: ein Sitz aus einer importierten Konstellation startet über die Owner-Tür nie als Orchestratorin (in bypassPermissions)
// - Lauf 3 F6: eine Freigabe der Rechte über den Deckel hinaus kommt nicht mit dem Speicher, nur über die Freigabe des Owners
// - Lauf 2 F6: das Owner-Token gilt in der Adresse nur für den Login, nicht an einer API-Route
// - Lauf 2 F7 und Lauf 3 F1: die Passwort-Sperre eines Shares zählt je Quelle, und vor dem Vergleich
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SPEICHER_DATEI } from "../src/k15-speicher";
import { type Answer, branchTestkit, get, persisted, post } from "./branches-testkit";

const { TMP, BIN, fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);
const ARGV = join(TMP, "argv");
// der Checkout, aus dem der Server dieses Tests läuft: Fleets eigenes Repo (server.ts#fleetBaumVon)
const FLEET_REPO = join(import.meta.dir, "..");
mkdirSync(ARGV);
writeFileSync(join(BIN, "claude"), `#!/bin/sh\nf="${ARGV}/slot-$FLEET_SELF_SLOT"\n`
  + `for a in "$@"; do printf '%s\\0' "$a" >> "$f.tmp"; done\nmv "$f.tmp" "$f"\nexec sleep 600\n`, { mode: 0o755 });
const argsOf = async (slot: number): Promise<string[]> => {
  const file = join(ARGV, `slot-${slot}`);
  for (let i = 0; i < 200 && !existsSync(file); i++) await Bun.sleep(50);
  return readFileSync(file, "utf8").split("\0");
};

const darf = (stufe: string, bestaetigt?: true) => ({ rechte: { stufe, an: [], aus: [] }, modus: null, ...(bestaetigt ? { bestaetigt } : {}) });
const konst = (d: ReturnType<typeof darf>) => ({ id: "k1", name: "Ein Sitz", fleet: "konstellation",
  positionen: [{ id: "bauer", name: "Bauer", sitz: { liest: [], persoenlich: [], darf: d, notizbuch: null } }] });
const speicher = (d: ReturnType<typeof darf>) => ({ fassungen: [], packs: [], profile: [], konstellationen: [konst(d)] });
const put = (body: unknown) => ({ method: "PUT", path: "/api/k15/eigenes", body });

describe("Lauf 3 F3: ein importierter Sitz startet über die Owner-Tür nie als Orchestratorin", () => {
  test("ein Branch mit Orchestrator-Namen öffnet den Sitz nicht; derselbe Sitz unter einem anderen Namen öffnet ohne bypass", async () => {
    const f = fixture();
    writeFileSync(join(f.state, SPEICHER_DATEI), JSON.stringify(speicher(darf("bauen"))));
    const a = await life(f, [
      post("/api/branches", { repo: f.repo, name: "Orchestrator probe" }),
      post("/api/branches/open", { repo: f.repo, branch: "$0.branch", sitz: "k1/bauer" }),
      post("/api/branches", { repo: f.repo, name: "Bauer" }),
      post("/api/branches/open", { repo: f.repo, branch: "$2.branch", sitz: "k1/bauer" }), "save"]);
    expect([a[0]?.status, a[2]?.status]).toEqual([201, 201]);
    expect([a[1]?.status, String(a[1]?.body.error)]).toEqual([400, expect.stringContaining("never starts as the orchestrator")]);
    expect(a[3]?.status).toBe(200);
    const args = await argsOf(Number(a[3]?.body.slot));
    expect(args[args.indexOf("--permission-mode") + 1]).not.toBe("bypassPermissions");
  }, 60_000);
});

// Die Fixes schränken die echten Rollen nicht ein (Orchestratorin 23.10., Frage des Owners): die Orchestratorin startet und folgt sich nach in
// bypassPermissions, und was sie oder das Fenster ohne Sitz aus einer Datei öffnet, startet wie vorher. Das Fixture-Repo ist für den Server
// ein fremdes Repo: ein Sitz ohne Rolle dort startet im eigenen Setup (server/eigenes-setup.ts#eigenesSetup, Owner 23.10.) ohne Modus, wie
// `claude` von Hand. Derselbe Sitz in Fleets eigenem Repo startet wie vorher in auto.
describe("die echten Rollen starten wie heute", () => {
  const modus = (args: string[]): string | undefined => args[args.indexOf("--permission-mode") + 1];
  test("Orchestratorin: Start und Nachfolge in bypass; ihr Branch-Sitz und ein Sitz des Fensters ohne Datei wie bisher", async () => {
    const f = fixture();
    const [orch] = await life(f, [post("/api/slots/3/open", { cwd: f.repo, label: "Orchestrator" }), "save"]);
    expect(orch?.status).toBe(200);
    expect(modus(await argsOf(3))).toBe("bypassPermissions");
    const self = String((persisted(f).slots as Record<string, { selfToken?: string }>)["3"]?.selfToken);
    const kind = await life(f, [
      { ...post("/api/self/branches", { name: "Bauer" }), token: null, self },
      { ...post("/api/self/branches/open", { branch: "$0.branch" }), token: null, self },
      post("/api/slots/7/open", { cwd: f.repo }), post("/api/slots/8/open", { cwd: FLEET_REPO }), "save"]);
    expect([kind[0]?.status, kind[1]?.status, kind[2]?.status, kind[3]?.status]).toEqual([201, 200, 200, 200]);
    expect([await argsOf(Number(kind[1]?.body.slot)), await argsOf(7)].map((a) => a.includes("--permission-mode"))).toEqual([false, false]);
    expect(modus(await argsOf(8))).toBe("auto");
    // die Nachfolge startet dieselbe Rolle neu; der Ersatz-claude nimmt den Brief nicht an, also endet succeed als Schuld, der Start steht
    rmSync(join(ARGV, "slot-3"));
    await life(f, [{ ...post("/api/self/succeed", {}), token: null, self }], { FLEET_FOUNDING_BOOT_GRACE_MS: "250", FLEET_READY_WAIT_MS: "500" });
    const danach = (persisted(f).slots as Record<string, { selfToken?: string; label?: string }>)["3"];
    expect([danach?.label, danach?.selfToken === self]).toEqual(["Orchestrator", false]);
    expect(modus(await argsOf(3))).toBe("bypassPermissions");
  }, 120_000);
});

describe("Lauf 3 F6: die Freigabe über den Deckel gibt nur der Owner, nicht der Speicher", () => {
  test("ein Speicher mit bestaetigt öffnet gedeckelt; nach der Freigabe öffnet der Sitz mit dem, was die Datei trägt", async () => {
    const f = fixture();
    const a = await life(f, [
      put(speicher(darf("deployen", true))),
      get("/api/k15/eigenes"),
      post("/api/branches", { repo: f.repo, name: "Bauer" }),
      post("/api/branches/open", { repo: f.repo, branch: "$2.branch", sitz: "k1/bauer" }), "save"]);
    expect(a[0]?.status).toBe(200);
    // der Speicher behält, was die Datei erlaubt, aber nicht die Freigabe, die mit ihm kam
    const gespeichert = (a[1]?.body.eigenes as ReturnType<typeof speicher>).konstellationen[0]!.positionen[0]!.sitz.darf;
    expect(gespeichert).toEqual(darf("deployen"));
    expect([a[3]?.status, (a[3]?.body.rechte as { stufe?: string } | undefined)?.stufe]).toEqual([200, "bauen"]);
    const b = await life(f, [
      post(`/api/slots/${String(a[3]?.body.slot)}/kill`, {}),
      post("/api/k15/freigabe", { konst: "k1", pos: "bauer" }),
      // ein Fenster, das danach den ganzen Speicher schreibt, behält die Freigabe; ändert er die Rechte, fällt sie
      put(speicher(darf("deployen", true))),
      post("/api/branches/open", { repo: f.repo, branch: String(a[2]?.body.branch), sitz: "k1/bauer", fresh: true }), "save"]);
    expect([b[1]?.status, b[2]?.status]).toEqual([200, 200]);
    expect([b[3]?.status, (b[3]?.body.rechte as { stufe?: string } | undefined)?.stufe]).toEqual([200, "deployen"]);
    const c = await life(f, [put(speicher(darf("landen", true))), get("/api/k15/eigenes")]);
    expect((c[1]?.body.eigenes as ReturnType<typeof speicher>).konstellationen[0]!.positionen[0]!.sitz.darf).toEqual(darf("landen"));
  }, 90_000);
});

describe("Lauf 2 F6: das Owner-Token aus der Adresse gilt nur für den Login", () => {
  test("eine API-Route mit ?token= antwortet 401; / mit ?token= setzt das Cookie und leitet weiter", async () => {
    const f = fixture();
    const q = `?token=${encodeURIComponent(f.token)}`;
    const a = await life(f, [
      { ...get(`/api/sessions${q}`), token: null },
      { ...get(`/api/k15/eigenes${q}`), token: null },
      { ...get(`/${q}`), token: null },
      { ...get("/api/sessions"), cookie: true }]);
    expect([a[0]?.status, a[1]?.status]).toEqual([401, 401]);
    expect([a[2]?.status, a[2]?.body]).toEqual([302, { location: "/", setCookie: expect.stringMatching(/^fleet_\d+$/) }]);
    expect(a[3]?.status).toBe(200);
  }, 60_000);
});

describe("die Passwort-Sperre eines Shares", () => {
  const raten = (id: string, ip: string, password: string) =>
    ({ ...post(`/s/${id}/auth`, { password }), token: null, ip });
  async function geteilt(f: ReturnType<typeof fixture>): Promise<{ id: string; password: string }> {
    const [offen, share] = await life(f, [post("/api/slots/3/open", { cwd: f.repo }), post("/api/slots/3/share", { password: "richtig-1234" }), "save"]);
    expect([offen?.status, share?.status]).toEqual([200, 200]);
    return { id: String(share?.body.id), password: "richtig-1234" };
  }

  test("Lauf 2 F7: 51 falsche Versuche einer Quelle sperren sie, ein Gast von woanders meldet sich an", async () => {
    const f = fixture();
    const { id, password } = await geteilt(f);
    const a = await life(f, [
      ...Array.from({ length: 51 }, () => ({ background: raten(id, "198.51.100.7", "falsch-0000") })), "abwarten",
      raten(id, "198.51.100.7", password),
      raten(id, "203.0.113.9", password),
      // hinter dem Tunnel ist der Peer immer derselbe; die Quelle ist die, die Cloudflare nennt
      { ...raten(id, "127.0.0.1", "falsch-0000"), headers: { "cf-connecting-ip": "198.51.100.7" } },
      { ...raten(id, "127.0.0.1", password), headers: { "cf-connecting-ip": "203.0.113.10" } }]);
    const falsch = a.slice(0, 51).map((x) => x.status);
    expect(falsch.filter((s) => s === 401).length).toBe(50);
    expect(falsch.filter((s) => s === 429).length).toBe(1);
    expect(a.slice(52).map((x) => x.status)).toEqual([429, 200, 429, 200]);
  }, 60_000);

  test("Lauf 3 F1: ein Schub gleichzeitiger Versuche kommt nicht an der Sperre vorbei — der 51. wird nie verglichen", async () => {
    const f = fixture();
    const { id, password } = await geteilt(f);
    const a: Answer[] = await life(f, [
      ...Array.from({ length: 50 }, () => ({ background: raten(id, "198.51.100.8", "falsch-0000") })),
      { background: raten(id, "198.51.100.8", password) }, "abwarten"]);
    expect(a[50]?.status).toBe(429);
    expect(a.slice(0, 50).every((x) => x.status === 401)).toBe(true);
  }, 60_000);
});
