// JEDER KOMMT REIN (Richtung Schritt 5): ein Sitz ohne Rolle startet in jedem Ordner, auch in einem ohne Git und in einem Git-Repo ohne ersten
// Commit. Die Vorschau des Startfensters (GET /api/founding-plan) las bisher den Kopf des Repos und lehnte beide ab; ohne Vorschau startet das
// Fenster nichts. Am echten Routen-Handler: Vorschau, Start mit dem gezeigten Hash, und die Rollen, die ein Repo mit Commit brauchen, bleiben zu.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { type Answer, branchTestkit, get, LIFE_DEADLINE_MS, post, sh } from "./branches-testkit";

const { fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

const ok = (a: Answer | undefined): Record<string, any> => {
  if (!a || a.status >= 300) throw new Error(`erwartet 2xx: ${JSON.stringify(a)}`);
  return a.body as Record<string, any>;
};
const vorschau = (ordner: string, rolle = "nur-ordner"): ReturnType<typeof get> =>
  get(`/api/founding-plan?repo=${encodeURIComponent(ordner)}&role=${rolle}&anlass=neu`);

// neben dem Repo der Fixture, also in keinem Git-Repo: ein leerer Ordner, und ein frisch initialisiertes Repo ohne Commit
function ordner(f: { repo: string }): { leer: string; ohneCommit: string } {
  const leer = join(dirname(f.repo), "leer"), ohneCommit = join(dirname(f.repo), "ohne-commit");
  mkdirSync(leer);
  mkdirSync(ohneCommit);
  sh(ohneCommit, "init", "-q", "-b", "main");
  return { leer, ohneCommit };
}

describe("ein Sitz ohne Rolle startet in jedem Ordner", () => {
  test("ein leerer Ordner ohne Git und ein Repo ohne ersten Commit haben eine Vorschau, und der Start mit ihrem Hash läuft", async () => {
    const f = fixture();
    const { leer, ohneCommit } = ordner(f);
    const [vl, vo] = await life(f, [vorschau(leer), vorschau(ohneCommit)]);
    expect(typeof ok(vl).fassungsHash).toBe("string");
    expect(typeof ok(vo).fassungsHash).toBe("string");
    const [a, b] = await life(f, [post("/api/slots/1/open", { cwd: leer, fassung: ok(vl).fassungsHash }),
      post("/api/slots/2/open", { cwd: ohneCommit, fassung: ok(vo).fassungsHash })]);
    expect(ok(a).cwd).toBe(leer);
    expect(ok(b).cwd).toBe(ohneCommit);
  }, LIFE_DEADLINE_MS * 2);

  test("eine Rolle, die ein Repo mit Commit braucht (Lane, MAIN, Orchestratorin), bleibt in beiden Ordnern abgelehnt", async () => {
    const f = fixture();
    const { leer, ohneCommit } = ordner(f);
    const antworten = await life(f, ["lane", "main", "orchestratorin"].flatMap((rolle) => [vorschau(leer, rolle), vorschau(ohneCommit, rolle)]));
    expect(antworten.map((x) => x.status)).toEqual([400, 400, 400, 400, 400, 400]);
  }, LIFE_DEADLINE_MS);
});
