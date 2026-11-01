// DIE + ZEILE „FOLDER TRUST“ ÜBER DIE ECHTE TÜR (Paket W2, Prüfung Punkt 4 und 5): ein Sitz, den Fleet in einem frischen Repo öffnet, trägt den
// Eintrag in der .claude.json seines HOME (hier das eigene HOME des Testbaukastens, nie das des Aufrufers), sein laufender Start verliert die
// Zeile, sobald der Eintrag nicht mehr in der Datei steht, und ein Sitz, den eine Session durch ihre Tür öffnete, nennt sie.
import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Answer, branchTestkit, get, LIFE_DEADLINE_MS, persisted, post } from "./branches-testkit";

const { KIT_HOME, fixture, life, serve, cleanup } = branchTestkit();
afterAll(cleanup);
const DATEI = join(KIT_HOME, ".claude.json");
const projekte = (): Record<string, { hasTrustDialogAccepted?: boolean }> => JSON.parse(readFileSync(DATEI, "utf8")).projects;
type Teil = { id: string; abschnitte: { id: string; text?: string }[] };
const vertrauen = (a: Answer | undefined): string | null =>
  ((a?.body.teile as Teil[] | undefined) ?? []).find((t) => t.id === "darf")?.abschnitte.find((x) => x.id === "vertrauen")?.text ?? null;

describe("ein Sitz in einem frischen Repo", () => {
  test("Fleet setzt das Vertrauen und nennt es; ohne den Eintrag geht die Zeile; ein Kind, das eine Session öffnete, trägt die Zeile ohne Slot-Nummer", async () => {
    const f = fixture();
    const repo = realpathSync(f.repo);
    const [offen, laufend] = await life(f, [post("/api/slots/1/open", { cwd: f.repo }), get("/api/slots/1/fassung?anlass=laufend"),
      post("/api/branches", { repo: f.repo, name: "Kind" }), "save"]);
    expect(offen?.status).toBe(200);
    expect(projekte()[repo]?.hasTrustDialogAccepted).toBe(true);
    expect(vertrauen(laufend)?.split("\n")[0]).toBe(`Fleet trusts the whole repository ${repo} for Claude Code, every folder and worktree of it, because this seat was opened in it; the entry stays in ${DATEI} after this seat and holds for Claude Code outside Fleet too`);

    // der Eintrag ist weg (von Hand zurückgenommen, oder ein Exit-Schreiben, das Fleet nicht mehr sah): die Zeile des laufenden Starts geht mit
    const o = JSON.parse(readFileSync(DATEI, "utf8"));
    delete o.projects[repo];
    writeFileSync(DATEI, JSON.stringify(o, null, 2));
    const [ohne] = await life(f, [get("/api/slots/1/fassung?anlass=laufend")]);
    expect(vertrauen(ohne)).toBeNull();
    expect((ohne?.body.festgehalten as { nachgefuehrt?: string[] } | null)?.nachgefuehrt).toContain("vertrauen");

    // die Session in Slot 1 öffnet durch ihre Tür ein Kind im selben Repo: Fleet setzt den Eintrag neu, und die Zeile des Kindes steht — ohne Öffner und
    // ohne Slot-Nummer, denn ein Wert der Belegung steht nicht im gehashten Start (Orchestratorin 31.10.)
    const token = (persisted(f).slots as Record<string, { selfToken: string }>)["1"]!.selfToken;
    const [kind] = await life(f, [{ ...post("/api/self/branches/open", { repo: f.repo, branch: "branch/kind" }), token: null, self: token }, "save"]);
    expect([kind?.status, kind?.body.error]).toEqual([200, undefined]);
    expect(projekte()[repo]?.hasTrustDialogAccepted).toBe(true);
    const [kindStart, einsWieder] = await life(f, [get(`/api/slots/${String(kind?.body.slot)}/fassung?anlass=laufend`), get("/api/slots/1/fassung?anlass=laufend")]);
    expect(vertrauen(kindStart)?.split("\n")[0]).toContain(`the whole repository ${repo} for Claude Code`);
    expect(vertrauen(kindStart)?.split("\n")[0]).toContain("because this seat was opened in it;");
    expect(vertrauen(kindStart)?.split("\n")[0]).not.toMatch(/\bslot\b/i);
    // der Eintrag steht wieder: Slot 1, dessen Start die Zeile trug, zeigt sie wieder
    expect(vertrauen(einsWieder)).not.toBeNull();
  }, LIFE_DEADLINE_MS * 4);

  // gefunden auf der Testinstanz (31.10.): derselbe Server, der den Eintrag schon einmal setzte, sah ihn verschwinden und versprach dem
  // nächsten Start im Repo nichts mehr — obwohl er ihn für diesen Start wieder setzte
  test("derselbe Server setzt einen verschwundenen Eintrag für den nächsten Sitz neu, und dessen Start sagt es", async () => {
    const f = fixture();
    const repo = realpathSync(f.repo);
    const srv = await serve(f);
    try {
      expect((await srv.call("/api/slots/1/open", { body: { cwd: f.repo } })).status).toBe(200);
      expect((await srv.call("/api/branches", { body: { repo: f.repo, name: "Zweit" } })).status).toBe(201);
      for (let i = 0; i < 100 && !projekte()[repo]; i++) await Bun.sleep(50);
      const o = JSON.parse(readFileSync(DATEI, "utf8"));
      delete o.projects[repo];
      writeFileSync(DATEI, JSON.stringify(o, null, 2));
      const token = (persisted(f).slots as Record<string, { selfToken: string }>)["1"]!.selfToken;
      const kind = await srv.call("/api/self/branches/open", { body: { repo: f.repo, branch: "branch/zweit" }, self: token });
      expect([kind.status, kind.body.error]).toEqual([200, undefined]);
      expect(projekte()[repo]?.hasTrustDialogAccepted).toBe(true);
      const start = await srv.call(`/api/slots/${String(kind.body.slot)}/fassung?anlass=laufend`);
      expect(vertrauen(start)?.split("\n")[0]).toContain("because this seat was opened in it;");
      expect(vertrauen(start)?.split("\n")[0]).not.toMatch(/\bslot\b/i);
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 2);
});
