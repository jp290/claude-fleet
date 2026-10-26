// EIN SLOT AUS EINEM AGENTEN (server/agenten.ts an POST /api/slots/:id/open): anlegen, kopieren mit nur anderem Modell, aus der Kopie öffnen.
// Die Fassung zeigt den Agenten mit „copy of“ und dem Hash des Originals, ihr Hash ist der der beim Start abgelegten Fassung, und die Zeile,
// mit der tmux die Pane startete, trägt das Modell der Kopie. Ein Body mit einer Wahl neben dem Agenten startet nichts; ein Slot ohne Agent
// zeigt keinen. Die Fixture ist ein fremdes Repo, also eigenes Setup: Fleet legt nur auf die Zeile, was gewählt ist.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Answer, branchTestkit, get, LIFE_DEADLINE_MS, persisted, post } from "./branches-testkit";

const { SOCKETS, fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

const zeileMit = (sock: string, teil: string): string[] => Bun.spawnSync(["tmux", "-L", sock, "list-panes", "-a", "-F", "#{pane_start_command}"],
  { env: { ...process.env, TMUX_TMPDIR: SOCKETS } }).stdout.toString().split("\n").filter((z) => z.includes(teil));
const zwei = (f: { repo: string }): string => { const d = join(f.repo, "zwei"); mkdirSync(d, { recursive: true }); return d; };
const ok = (a: Answer | undefined): Record<string, any> => {
  if (!a || a.status >= 300) throw new Error(`erwartet 2xx: ${JSON.stringify(a)}`);
  return a.body as Record<string, any>;
};

describe("ein Slot öffnet aus einem Agenten", () => {
  test("die Kopie mit nur anderem Modell startet mit diesem Modell; ihre Fassung zeigt „copy of“ mit dem Hash des Originals und gleicht der abgelegten", async () => {
    const f = fixture();
    const [orig, kopie, offen, fassung, daneben, ohne, ohneFassung, liste] = await life(f, [
      post("/api/agenten", { id: "pruefer", name: "Prüfer", wahlen: { model: "claude-sonnet-5-5", effort: "low", permissionMode: "acceptEdits" },
        agentMd: { titel: "pruefer.md", text: "Du prüfst jeden Diff." } }),
      post("/api/agenten/pruefer/kopie", { id: "pruefer-haiku", wahlen: { model: "claude-haiku-5-5" } }),
      post("/api/slots/1/open", { cwd: f.repo, agent: "pruefer-haiku" }),
      get("/api/slots/1/fassung?anlass=laufend"),
      post("/api/slots/2/open", { cwd: f.repo, agent: "pruefer-haiku", effort: "high" }),
      post("/api/slots/3/open", { cwd: zwei(f) }),
      get("/api/slots/3/fassung?anlass=laufend"),
      get("/api/agenten"),
    ]);
    const o = ok(orig).agent, k = ok(kopie).agent;
    expect(k.kopieVon).toEqual({ id: "pruefer", name: "Prüfer", hash: o.hash });
    expect(k.wahlen).toEqual({ model: "claude-haiku-5-5", effort: "low", permissionMode: "acceptEdits" });
    ok(offen);
    const fa = ok(fassung);
    expect(fa.agent).toMatchObject({ id: "pruefer-haiku", name: "copy of Prüfer", hash: k.hash, kopieVon: { hash: o.hash } });
    expect(fa.agent.satz).toContain(`copy of Prüfer · ${o.hash.slice(0, 12)}`);
    const datei = readdirSync(join(f.state, "start-fassungen")).filter((n) => n.startsWith("1-"));
    expect(datei.length).toBe(1);
    const gehalten = JSON.parse(readFileSync(join(f.state, "start-fassungen", datei[0]!), "utf8"));
    expect(fa.hash).toBe(gehalten.fassung.hash);
    expect(gehalten.fassung.agent.kopieVon.hash).toBe(o.hash);
    // was die Fassung zeigt, steht auf der Zeile: das Modell der Kopie, ihr Modus und ihre Agent-MD
    const zeilen = zeileMit(f.sock, "--model 'claude-haiku-5-5'");
    expect(zeilen.length).toBe(1);
    expect(zeilen[0]).toContain("--permission-mode 'acceptEdits'");
    expect(zeilen[0]).toContain("Du prüfst jeden Diff.");
    expect(zeileMit(f.sock, "claude-sonnet-5-5").length).toBe(0);
    expect(daneben?.status).toBe(400);
    expect(String(daneben?.body.error)).toContain("effort beside it");
    ok(ohne);
    expect(ok(ohneFassung).agent).toBeUndefined();
    expect((ok(liste).agenten as { id: string }[]).map((a) => a.id)).toEqual(["repo", "orchestratorin", "pruefer", "pruefer-haiku"]);
  }, LIFE_DEADLINE_MS * 2);

  test("ein laufender Sitz wird gespeichert und startet als Agent wieder mit seinen Wahlen", async () => {
    const f = fixture();
    const [offen, gespeichert, wieder, fassung] = await life(f, [
      post("/api/slots/1/open", { cwd: f.repo, model: "claude-haiku-5-5", effort: "low", permissionMode: "plan" }),
      post("/api/agenten", { id: "sitz-eins", name: "Sitz eins", vonSlot: 1 }),
      post("/api/slots/2/open", { cwd: zwei(f), agent: "sitz-eins" }),
      get("/api/slots/2/fassung?anlass=laufend"),
    ]);
    ok(offen);
    expect(ok(gespeichert).agent.wahlen).toEqual({ model: "claude-haiku-5-5", effort: "low", permissionMode: "plan" });
    ok(wieder);
    expect(ok(fassung).agent.name).toBe("Sitz eins");
    expect(zeileMit(f.sock, "--permission-mode 'plan'").length).toBe(2);
  }, LIFE_DEADLINE_MS * 2);

  test("wechselt der Owner einem Slot aus einem Agenten das Modell, nennt der Slot den Agenten nicht mehr; ohne Wechsel bleibt er über einen Neustart", async () => {
    const f = fixture();
    const [a, b, c] = await life(f, [
      post("/api/agenten", { id: "a", name: "A", wahlen: { model: "claude-haiku-5-5" } }),
      post("/api/slots/1/open", { cwd: f.repo, agent: "a" }),
      post("/api/slots/2/open", { cwd: zwei(f), agent: "a" }),
      post("/api/slots/1/model", { model: "claude-sonnet-5-5" }),
    ]);
    ok(a); ok(b); ok(c);
    const slots = persisted(f).slots as Record<string, { agent?: { id: string } }>;
    expect(slots["1"]?.agent).toBeUndefined();
    expect(slots["2"]?.agent?.id).toBe("a");
    const [nachNeustart] = await life(f, [get("/api/slots/2/fassung?anlass=laufend")]);
    expect(ok(nachNeustart).agent?.id).toBe("a");
  }, LIFE_DEADLINE_MS * 3);
});

describe("die Branch-Tür ist der Hauptweg", () => {
  test("ein Agent mit Schwelle und Fernsteuerung startet an /api/branches/open mit beidem; einer mit Rolle bleibt dort abgelehnt", async () => {
    const f = fixture();
    const [, made, offen, fassung, rolle] = await life(f, [
      post("/api/agenten", { id: "lang", name: "Lang", wahlen: { model: "claude-haiku-5-5", schwelle: 50, remote: true } }),
      post("/api/branches", { repo: f.repo, name: "Agent Probe" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/agent-probe", agent: "lang" }),
      get("/api/slots/1/fassung?anlass=laufend"),
      post("/api/branches/open", { repo: f.repo, branch: "branch/agent-probe", agent: "orchestratorin" }),
    ]);
    const pfad = String(ok(made).path);
    expect(ok(offen).slot).toBe(1);
    const zeile = Bun.spawnSync(["tmux", "-L", f.sock, "list-panes", "-a", "-F", "#{pane_current_path}\t#{pane_start_command}"],
      { env: { ...process.env, TMUX_TMPDIR: SOCKETS } }).stdout.toString().split("\n").find((z) => z.startsWith(`${pfad}\t`)) ?? "";
    expect(zeile).toContain("--remote-control");
    expect(zeile).toContain("--model 'claude-haiku-5-5'");
    // die Schwelle steht am Slot, wie PATCH …/handover sie schriebe (die Fassung sagt hier „aus“: der Testserver hat keinen Übergabe-Takt)
    expect((persisted(f).slots as Record<string, { handover?: { thresholdPct?: number } }>)["1"]?.handover?.thresholdPct).toBe(50);
    expect(ok(fassung).agent.id).toBe("lang");
    expect(rolle?.status).toBe(400);
    expect(String(rolle?.body.error)).toContain("does not read rolle");
  }, LIFE_DEADLINE_MS * 2);
});

describe("was das Startfenster liest", () => {
  test("GET /api/agenten?cwd=<repo> nennt je Agent seinen letzten Start hier; ein Start ohne Agent zählt für den Agenten des Repos", async () => {
    const f = fixture();
    const [, nackt, mitAgent, liste, anderswo] = await life(f, [
      post("/api/agenten", { id: "a", name: "A", wahlen: { model: "claude-haiku-5-5" } }),
      post("/api/slots/1/open", { cwd: f.repo }),
      post("/api/slots/2/open", { cwd: zwei(f), agent: "a" }),
      get(`/api/agenten?cwd=${encodeURIComponent(f.repo)}`),
      get(`/api/agenten?cwd=${encodeURIComponent(f.state)}`),
    ]);
    ok(nackt); ok(mitAgent);
    const zuletzt = (a: Answer | undefined, id: string) => (ok(a).agenten as { id: string; zuletzt: number | null }[]).find((x) => x.id === id)?.zuletzt;
    expect(typeof zuletzt(liste, "a")).toBe("number");
    expect(typeof zuletzt(liste, "repo")).toBe("number");
    // ein fremdes Repo: die Orchestratorin fehlt ganz, statt mit „zuletzt: null“ dazustehen
    expect((ok(liste).agenten as { id: string }[]).map((x) => x.id)).not.toContain("orchestratorin");
    expect(zuletzt(anderswo, "a")).toBeNull();
  }, LIFE_DEADLINE_MS * 2);

  test("der eingebaute Agent des Repos startet genau wie ein Start ohne Wahl: dieselbe Fassung", async () => {
    const f = fixture();
    const drei = join(f.repo, "drei");
    mkdirSync(drei, { recursive: true });
    const [a, b, fa, fb, vorschau] = await life(f, [
      post("/api/slots/1/open", { cwd: zwei(f) }),
      post("/api/slots/2/open", { cwd: drei, agent: "repo" }),
      get("/api/slots/1/fassung?anlass=laufend"),
      get("/api/slots/2/fassung?anlass=laufend"),
      get(`/api/founding-plan?repo=${encodeURIComponent(f.repo)}&role=nur-ordner&anlass=neu&agent=repo`),
    ]);
    ok(a); ok(b);
    expect(ok(fb).hash).toBe(ok(fa).hash);
    expect(ok(fb).agent.id).toBe("repo");
    // ein fremdes Repo: eigenes Setup, der Ort gibt nichts dazu
    expect(ok(vorschau).ort).toMatchObject({ modus: "eigenes-setup", zugaben: [] });
  }, LIFE_DEADLINE_MS * 2);
});

describe("die Vorschau zeigt, was startet", () => {
  test("die Vorschau eines Agenten mit Fernsteuerung trägt den Hash, mit dem sein Slot startet", async () => {
    const f = fixture();
    const [, vorschau, offen, fassung] = await life(f, [
      post("/api/agenten", { id: "fern", name: "Fern", wahlen: { model: "claude-haiku-5-5", remote: true } }),
      get(`/api/founding-plan?repo=${encodeURIComponent(f.repo)}&role=nur-ordner&anlass=neu&agent=fern`),
      post("/api/slots/1/open", { cwd: f.repo, agent: "fern" }),
      get("/api/slots/1/fassung?anlass=laufend"),
    ]);
    ok(offen);
    expect(ok(vorschau).fassungsHash).toBe(ok(fassung).hash);
    expect(ok(vorschau).fassung.agent.id).toBe("fern");
  }, LIFE_DEADLINE_MS * 2);
});

describe("ein gespeicherter Sitz mit Schwelle über die Self-Tür", () => {
  test("eine Session speichert sich mit Schwelle 35 und Fernsteuerung und öffnet daraus über /api/self/branches/open einen Sitz mit beidem", async () => {
    const f = fixture();
    const [offen, gespeichert, made] = await life(f, [
      post("/api/slots/1/open", { cwd: f.repo, model: "claude-haiku-5-5", schwelle: 35, remote: true }),
      post("/api/agenten", { id: "linie", name: "Linie", vonSlot: 1 }),
      post("/api/branches", { repo: f.repo, name: "Linie Kind" }),
    ]);
    ok(offen); ok(made);
    expect(ok(gespeichert).agent.wahlen).toEqual({ model: "claude-haiku-5-5", schwelle: 35, remote: true });
    const token = (persisted(f).slots as Record<string, { selfToken: string }>)["1"]!.selfToken;
    const [kind] = await life(f, [{ ...post("/api/self/branches/open", { repo: f.repo, branch: "branch/linie-kind", agent: "linie" }), token: null, self: token }]);
    const slot = String(ok(kind).slot);
    const rec = (persisted(f).slots as Record<string, { handover?: { thresholdPct?: number }; remote?: boolean; agent?: { id: string } }>)[slot];
    expect(rec?.handover?.thresholdPct).toBe(35);
    expect(rec?.remote).toBe(true);
    expect(rec?.agent?.id).toBe("linie");
  }, LIFE_DEADLINE_MS * 3);
});

describe("die Slot-Tür nimmt eine erste Nachricht", () => {
  test("goal folgt als erste Nachricht und steht in der Historie; goal und aufgabe zugleich, und ein Ziel neben der Rollenkarte, werden abgelehnt", async () => {
    const f = fixture();
    const [mit, beide, rolle, ohne, h] = await life(f, [
      post("/api/slots/1/open", { cwd: f.repo, goal: "Lies die README und sag einen Satz." }),
      post("/api/slots/2/open", { cwd: zwei(f), goal: "x", aufgabe: { ziel: "y" } }),
      post("/api/slots/3/open", { cwd: zwei(f), label: "Orchestrator", goal: "x" }),
      post("/api/slots/4/open", { cwd: zwei(f) }),
      get("/api/k15/historie"),
    ]);
    expect(ok(mit).goal).toBe("follows");
    expect(ok(ohne).goal).toBeUndefined();
    expect([beide?.status, String(beide?.body.error)]).toEqual([400, "goal oder aufgabe, nicht beides"]);
    expect(rolle?.status).toBe(400);
    expect(String(rolle?.body.error)).toContain("two first messages");
    const starts = ok(h).starts as { slot: number; goal: string | null }[];
    expect(starts.find((s) => s.slot === 1)?.goal).toBe("Lies die README und sag einen Satz.");
    expect(starts.find((s) => s.slot === 4)?.goal).toBeNull();
  }, LIFE_DEADLINE_MS * 2);
});
