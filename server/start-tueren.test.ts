// WAS EIN START AN DER TÜR WIRKLICH TRÄGT (Orchestratorin, Auftrag 7, Prüfung pruefung.md B3, B5, B6, D1): ein echter Server, ein Ersatz-`claude`, das seine Argumente
// aufschreibt; der Start, den der Test liest, ist die Zeile, die tmux wirklich ausgeführt hat.
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Answer, branchTestkit, LIFE_DEADLINE_MS, persisted, sh } from "./branches-testkit";
import { SPEICHER_DATEI } from "../src/k15-speicher";
import { nurBeiPfaden } from "../src/start-brief";
import { modusGrenzeGeladen, modusUnterOeffnerin } from "./sitz-reise";

for (const n of Object.keys(process.env)) if (/^(CLAUDE|ANTHROPIC)/.test(n)) delete process.env[n];
const k = branchTestkit();
afterAll(() => k.cleanup());
const REC = join(k.TMP, "rec");
mkdirSync(REC);
writeFileSync(join(k.BIN, "claude"), `#!/bin/sh\nd=${REC}/$$; mkdir -p $d; : > $d/args; for a in "$@"; do printf '%s\\0' "$a" >> $d/args; done; pwd > $d/cwd\nexec sleep 600\n`, { mode: 0o755 });

// jeder Test sein eigener Server: die Leiste hat 16 Plätze
let f = k.fixture();
let server: Awaited<ReturnType<typeof k.serve>> | null = null;
let platz = 0;
beforeEach(async () => { await server?.stop(); f = k.fixture(); server = await k.serve(f, { FLEET_SELF_SEAT_ROOT: k.TMP, FLEET_SELF_SEAT_CAP: "9" }); platz = 0; });
afterAll(() => server?.stop());
const call: Awaited<ReturnType<typeof k.serve>>["call"] = (path, init) => server!.call(path, init);
const ordner = (n: string): string => { const d = join(f.repo, n); mkdirSync(d, { recursive: true }); return d; };
const eintrag = (n: number) => (persisted(f).slots as Record<string, { selfToken: string; permissionMode?: string | null; spawn?: { startModus?: { modus: string } } }>)[String(n)]!;
const frei = (): number => ++platz;
// die Zeile des Sitzes in diesem Ordner: das Flag --permission-mode und sein Wert, null = keins
const modusAufZeile = async (cwd: string): Promise<string | null> => {
  for (let i = 0; i < 100; i++) {
    for (const p of readdirSync(REC)) {
      const d = join(REC, p);
      if (!existsSync(join(d, "cwd")) || readFileSync(join(d, "cwd"), "utf8").trim() !== cwd) continue;
      const args = readFileSync(join(d, "args"), "utf8").split("\0");
      const at = args.indexOf("--permission-mode");
      return at >= 0 ? args[at + 1]! : null;
    }
    await Bun.sleep(100);
  }
  throw new Error(`kein Start in ${cwd}`);
};
const oeffne = async (name: string, body: Record<string, unknown> = {}, vorher?: (d: string) => void): Promise<{ slot: number; token: string; cwd: string; a: Answer }> => {
  const cwd = ordner(name), slot = frei();
  vorher?.(cwd);
  const a = await call(`/api/slots/${slot}/open`, { body: { cwd, ...body } });
  expect([a.status, a.body.error]).toEqual([200, undefined]);
  await modusAufZeile(cwd);
  return { slot, token: eintrag(slot).selfToken, cwd, a };
};
const kind = async (token: string, name: string, body: Record<string, unknown> = {}): Promise<{ a: Answer; modus: string | null }> => {
  const cwd = ordner(name);
  const a = await call("/api/self/seats/open", { self: token, body: { cwd, ...body } });
  expect([a.status, a.body.error]).toEqual([200, undefined]);
  platz = Math.max(platz, Number(a.body.slot));
  return { a, modus: await modusAufZeile(cwd) };
};
const vorschau = async (cwd: string, q = ""): Promise<Record<string, any>> =>
  (await call(`/api/founding-plan?repo=${encodeURIComponent(cwd)}&role=nur-ordner&anlass=neu${q ? `&${q}` : ""}`)).body as Record<string, any>;
const abschnitt = (fassung: any, teil: string, id: string) => fassung.teile.find((t: any) => t.id === teil).abschnitte.find((a: any) => a.id === id);
const projekt = (d: string, o: unknown) => { mkdirSync(join(d, ".claude"), { recursive: true }); writeFileSync(join(d, ".claude/settings.json"), JSON.stringify(o)); };
const nutzer = (o: unknown | null) => { const p = join(k.TMP, "settings.json"); if (o) writeFileSync(p, JSON.stringify(o)); else rmSync(p, { force: true }); };
const importiere = async (name: string, wahlen: Record<string, unknown> = { effort: "low" }): Promise<string> => {
  const r = await call("/api/setups/import", { body: { datei: { format: "fleet-agent/1", name, abgeleitetVon: "b".repeat(64), wahlen }, schreiben: true } });
  expect([r.status, r.body.error]).toEqual([201, undefined]);
  return (r.body.agent as { id: string }).id;
};

const BYPASS = { permissions: { defaultMode: "bypassPermissions" } };
const mitNutzer = async (o: unknown, lauf: () => Promise<void>): Promise<void> => { nutzer(o); try { await lauf(); } finally { nutzer(null); } };
const projektModus = (m: string) => (d: string) => projekt(d, { permissions: { defaultMode: m } });

describe("ein Kind ohne Modus ist nie weiter als seine Öffnerin", () => {
  // DIE GANZE REGEL (Orchestratorin, Auftrag 8, B5): was immer unter dem Kind steht, es startet nie weiter als die Öffnerin. Öffnerin (gewählt oder aus ihrem Ordner) · Ordner des Kindes · Zeile des Kindes
  const reihen = async (zeilen: readonly [string, Record<string, unknown>, ((d: string) => void) | null, ((d: string) => void) | null, string | null, Record<string, unknown>?][]) => {
    let i = 0;
    for (const [name, oeffnerin, ihrOrdner, kindOrdner, erwartet, koerper] of zeilen) {
      const o = await oeffne(`b5w-o${++i}`, oeffnerin, ihrOrdner ?? undefined);
      const cwd = ordner(`b5w-k${i}`);
      kindOrdner?.(cwd);
      const a = await call("/api/self/seats/open", { self: o.token, body: { cwd, ...koerper } });
      expect([name, a.status, a.body.error]).toEqual([name, 200, undefined]);
      platz = Math.max(platz, Number(a.body.slot));
      expect([name, await modusAufZeile(cwd)]).toEqual([name, erwartet]);
    }
  };
  test("eine Öffnerin in acceptEdits oder dontAsk, gewählt oder aus ihrem Ordner: das Kind trägt ihren Modus, auch an der Branch-Tür", async () => {
    await reihen([
      ["acceptEdits gewählt", { permissionMode: "acceptEdits" }, null, null, "acceptEdits"],
      ["acceptEdits aus dem Ordner", {}, projektModus("acceptEdits"), null, "acceptEdits"],
      ["dontAsk gewählt", { permissionMode: "dontAsk" }, null, null, "dontAsk"],
      ["dontAsk aus dem Ordner", {}, projektModus("dontAsk"), null, "dontAsk"],
    ]);
    const o = await oeffne("b5w-br", { permissionMode: "acceptEdits" });
    const branch = await call("/api/branches", { body: { repo: f.repo, name: "Kind der Bearbeitenden" } });
    expect(branch.status).toBe(201);
    const a = await call("/api/self/branches/open", { self: o.token, body: { branch: branch.body.branch, goal: "Baue." } });
    expect([a.status, a.body.error]).toEqual([200, undefined]);
    platz = Math.max(platz, Number(a.body.slot));
    expect(eintrag(Number(a.body.slot)).permissionMode).toBe("acceptEdits");
  }, LIFE_DEADLINE_MS);
  test("bypass in den Einstellungen des Nutzers: unter einer Öffnerin in auto, acceptEdits oder dontAsk startet das Kind in ihrem Modus; unter einer in bypass erbt es weiter, und auf einem Modell ohne auto in Manual", async () => {
    await mitNutzer(BYPASS, () => reihen([
      ["auto", { permissionMode: "auto" }, null, null, "auto"],
      ["acceptEdits", { permissionMode: "acceptEdits" }, null, null, "acceptEdits"],
      ["dontAsk", { permissionMode: "dontAsk" }, null, null, "dontAsk"],
      ["auto, Kind auf Haiku 4.5", { permissionMode: "auto" }, null, null, "manual", { model: "claude-haiku-4-5-20251001" }],
      ["bypass", {}, null, null, null],
    ]));
  }, LIFE_DEADLINE_MS);
  test("das erste einfache Kind eines importierten Sitzes startet in dessen auto, nicht im bypass der Einstellungen; bypass beim Namen genannt bleibt 409", async () => {
    await mitNutzer(BYPASS, async () => {
      const id = await importiere("Fremd Leitung"), lead = ordner("b5w-imp"), slot = frei();
      const o = await call(`/api/slots/${slot}/open`, { body: { cwd: lead, agent: id, label: "Fremd Leitung" } });
      expect([o.status, o.body.error]).toEqual([200, undefined]);
      expect(await modusAufZeile(lead)).toBe("auto");
      expect((await call(`/api/slots/${slot}/rechte`, { body: { grant: ["seat.open"] } })).status).toBe(200);
      expect((await kind(eintrag(slot).selfToken, "b5w-imp-k")).modus).toBe("auto");
      const nein = await call("/api/self/seats/open", { self: eintrag(slot).selfToken, body: { cwd: ordner("b5w-imp-k2"), permissionMode: "bypassPermissions" } });
      expect(nein.status).toBe(409);
    });
  }, LIFE_DEADLINE_MS);
  test("eine engere Einstellung im Ordner des Kindes wird dadurch nicht weiter: seine Zeile bleibt leer, eine weitere deckelt die Öffnerin", async () => {
    await reihen([
      ["auto, Kind-Ordner plan", { permissionMode: "auto" }, null, projektModus("plan"), null],
      ["acceptEdits, Kind-Ordner Manual", { permissionMode: "acceptEdits" }, null, projektModus("default"), null],
      ["manual, Kind-Ordner plan", { permissionMode: "manual" }, null, projektModus("plan"), null],
      ["dontAsk, Kind-Ordner acceptEdits", { permissionMode: "dontAsk" }, null, projektModus("acceptEdits"), "dontAsk"],
    ]);
  }, LIFE_DEADLINE_MS);
  test("ein Sitz aus einer Position behält seine eigene Regel: der Modus der Position, nie weiter als die Öffnerin", async () => {
    await mitNutzer(BYPASS, async () => {
      const v = await call("/api/setups/import", { body: { vorlage: "lead-with-builders", schreiben: true } });
      expect([v.status, v.body.error]).toEqual([201, undefined]);
      const konst = (v.body as { konstellation: { id: string } }).konstellation.id;
      const lead = ordner("b5w-pos"), slot = frei();
      const o = await call(`/api/slots/${slot}/open`, { body: { cwd: lead, sitz: `${konst}/lead`, permissionMode: "manual" } });
      expect([o.status, o.body.error]).toEqual([200, undefined]);
      await modusAufZeile(lead);
      const cwd = ordner("b5w-pos-k");
      const a = await call("/api/self/seats/open", { self: eintrag(slot).selfToken, body: { sitz: "builder", cwd, goal: "Baue." } });
      expect([a.status, a.body.error]).toEqual([200, undefined]);
      platz = Math.max(platz, Number(a.body.slot));
      expect(await modusAufZeile(cwd)).toBe("manual");
      // eine Position ohne eigenen Modus hat keine eigene Regel: auch sie ist nie weiter als die Öffnerin
      const datei = join(f.state, SPEICHER_DATEI), speicher = JSON.parse(readFileSync(datei, "utf8")) as { konstellationen: { id: string; positionen: { id: string; sitz: { darf: { modus: string | null } } }[] }[] };
      const bauer = speicher.konstellationen.find((x) => x.id === konst)!.positionen.find((x) => x.id === "builder")!;
      expect(bauer.sitz.darf.modus).toBe("auto");
      bauer.sitz.darf.modus = null;
      writeFileSync(datei, JSON.stringify(speicher));
      const k2 = konst;
      const l2 = ordner("b5w-pos2"), s2 = frei();
      const o2 = await call(`/api/slots/${s2}/open`, { body: { cwd: l2, sitz: `${k2}/lead`, permissionMode: "acceptEdits" } });
      expect([o2.status, o2.body.error]).toEqual([200, undefined]);
      await modusAufZeile(l2);
      const c2 = ordner("b5w-pos2-k");
      const a2 = await call("/api/self/seats/open", { self: eintrag(s2).selfToken, body: { sitz: "builder", cwd: c2, goal: "Baue." } });
      expect([a2.status, a2.body.error]).toEqual([200, undefined]);
      platz = Math.max(platz, Number(a2.body.slot));
      expect(await modusAufZeile(c2)).toBe("acceptEdits");
    });
  }, LIFE_DEADLINE_MS);
  test("eine Öffnerin in manual oder plan, gewählt oder aus den Einstellungen: das Kind trägt ihren Modus auf der Zeile; es wird nicht abgelehnt", async () => {
    const manuell = await oeffne("b5-gewaehlt", { permissionMode: "manual" });
    const ausDatei = await oeffne("b5-datei", {}, (d) => projekt(d, { permissions: { defaultMode: "default" } }));
    const plan = await oeffne("b5-plan", { permissionMode: "plan" });
    const planDatei = await oeffne("b5-plan-datei", {}, (d) => projekt(d, { permissions: { defaultMode: "plan" } }));
    expect((await kind(manuell.token, "b5-k1")).modus).toBe("manual");
    expect((await kind(ausDatei.token, "b5-k2")).modus).toBe("manual");
    expect((await kind(plan.token, "b5-k3")).modus).toBe("plan");
    expect((await kind(planDatei.token, "b5-k4")).modus).toBe("plan");
  }, LIFE_DEADLINE_MS);
  test("an der Branch-Tür ebenso; eine Öffnerin in auto gibt keinen Modus mit; ein genannter Modus gilt", async () => {
    const auto = await oeffne("b5-auto");
    expect((await kind(auto.token, "b5-k5")).modus).toBe(null);
    const manuell = await oeffne("b5-gewaehlt2", { permissionMode: "manual" });
    expect((await kind(manuell.token, "b5-k6", { permissionMode: "plan" })).modus).toBe("plan");
    const branch = await call("/api/branches", { body: { repo: f.repo, name: "Kind der Vorsichtigen" } });
    expect(branch.status).toBe(201);
    const a = await call("/api/self/branches/open", { self: manuell.token, body: { branch: branch.body.branch, goal: "Baue." } });
    expect([a.status, a.body.error]).toEqual([200, undefined]);
    platz = Math.max(platz, Number(a.body.slot));
    expect(eintrag(Number(a.body.slot)).permissionMode).toBe("manual");
  }, LIFE_DEADLINE_MS);
});

describe("ein späterer Start geht durch dieselbe Regel wie der erste (Auftrag 9)", () => {
  // die Zeile des jüngsten Starts in diesem Ordner, nachdem `n` Starts dort stehen; null = kein Modus auf der Zeile
  const letzteZeile = async (cwd: string, n: number): Promise<string | null> => {
    for (let i = 0; i < 100; i++) {
      const dort = readdirSync(REC).map((p) => join(REC, p)).filter((d) => existsSync(join(d, "cwd")) && readFileSync(join(d, "cwd"), "utf8").trim() === cwd);
      if (dort.length >= n) {
        const args = readFileSync(join(dort.sort((a, b) => statSync(join(a, "args")).mtimeMs - statSync(join(b, "args")).mtimeMs).at(-1)!, "args"), "utf8").split("\0");
        const at = args.indexOf("--permission-mode");
        return at >= 0 ? args[at + 1]! : null;
      }
      await Bun.sleep(100);
    }
    throw new Error(`keine ${n} Starts in ${cwd}`);
  };
  const nachfolge = async (slot: number, cwd: string, vorher = 1): Promise<{ zeile: string | null; fassung: string }> => {
    const token = eintrag(slot).selfToken;
    expect((await call(`/api/slots/${slot}/rechte`, { body: { grant: ["text.handover"] } })).status).toBe(200);
    // (der Ersatz antwortet nicht auf den Brief: Fleet hält ihn als Schuld; die Nachfolgerin steht)
    const n = await call("/api/self/succeed", { self: token, body: { intent: "weiter" } });
    expect(String(n.body.error ?? `successor stands on slot ${slot}`)).toContain(`successor stands on slot ${slot}`);
    const zeile = await letzteZeile(cwd, vorher + 1);
    return { zeile, fassung: abschnitt((await call(`/api/slots/${slot}/fassung?anlass=laufend`)).body, "darf", "modus").text };
  };
  const kindVon = async (token: string, name: string, vorher?: (d: string) => void): Promise<{ slot: number; cwd: string; modus: string | null }> => {
    const cwd = ordner(name);
    vorher?.(cwd);
    const a = await call("/api/self/seats/open", { self: token, body: { cwd } });
    expect([a.status, a.body.error]).toEqual([200, undefined]);
    const slot = Number(a.body.slot);
    platz = Math.max(platz, slot);
    return { slot, cwd, modus: await modusAufZeile(cwd) };
  };

  test("ein importierter Agent: Zeile leer beim ersten Start, bypass kommt später in die Einstellungen, seine Nachfolge startet in auto", async () => {
    const id = await importiere("Fremd Nachfolge");
    const o = await oeffne("a9-imp", { agent: id, label: "Fremd Nachfolge" });
    expect([await modusAufZeile(o.cwd), eintrag(o.slot).spawn?.startModus?.modus]).toEqual([null, "auto"]);
    await mitNutzer(BYPASS, async () => {
      const n = await nachfolge(o.slot, o.cwd);
      expect([n.zeile, eintrag(o.slot).permissionMode, n.fassung]).toEqual(["auto", "auto", "auto"]);
    });
  }, LIFE_DEADLINE_MS);

  test("eine Öffnerin in auto, die längst beendet ist: bypass kommt später in die Einstellungen, die Nachfolge des Kindes startet in ihrem auto", async () => {
    const o = await oeffne("a9-auto", { permissionMode: "auto" });
    const k = await kindVon(o.token, "a9-auto-k");
    expect(k.modus).toBe(null);
    expect((await call("/api/self/retire", { self: o.token, body: {} })).status).toBeLessThan(300);
    await mitNutzer(BYPASS, async () => {
      const n = await nachfolge(k.slot, k.cwd);
      expect([n.zeile, eintrag(k.slot).permissionMode, n.fassung]).toEqual(["auto", "auto", "auto"]);
    });
  }, LIFE_DEADLINE_MS * 2);

  test("eine Öffnerin in manual, der Ordner des Kindes sagt plan, sein plan fällt weg: die Nachfolge startet in manual, nicht in auto", async () => {
    const o = await oeffne("a9-manual", { permissionMode: "manual" });
    const k = await kindVon(o.token, "a9-manual-k", projektModus("plan"));
    expect([k.modus, eintrag(k.slot).spawn?.startModus?.modus]).toEqual([null, "plan"]);
    writeFileSync(join(k.cwd, ".claude/settings.json"), "{}");
    const n = await nachfolge(k.slot, k.cwd);
    expect([n.zeile, eintrag(k.slot).permissionMode, n.fassung]).toEqual(["manual", "manual", "manual"]);
  }, LIFE_DEADLINE_MS);

  test("Grenze und Einstellungen: eine engere Einstellung bleibt eng und die Zeile leer; was einmal auf der Zeile steht, bleibt; wer keine Grenze hat, erbt weiter", async () => {
    // enger als die Grenze: die Zeile bleibt leer, die Einstellung gilt
    const o = await oeffne("a9-eng", { permissionMode: "auto" });
    const k = await kindVon(o.token, "a9-eng-k");
    projektModus("plan")(k.cwd);
    const eng = await nachfolge(k.slot, k.cwd);
    expect([eng.zeile, eintrag(k.slot).permissionMode ?? null, eng.fassung]).toEqual([null, null, "plan"]);
    // die Tür des Owners, ein Agent des Owners: keine Grenze, kein Eintrag, die Nachfolge erbt, was die Einstellungen sagen
    const frei = await oeffne("a9-owner");
    expect((persisted(f).slots as Record<string, { modusGrenze?: unknown }>)[String(frei.slot)]!.modusGrenze).toBeUndefined();
    await mitNutzer(BYPASS, async () => { expect((await nachfolge(frei.slot, frei.cwd)).zeile).toBe(null); });
    // eine Zeile, die die Grenze einmal gab, überlebt die nächste Nachfolge, auch wenn die Einstellung inzwischen enger ist
    const o2 = await oeffne("a9-halt", { permissionMode: "manual" });
    const k2 = await kindVon(o2.token, "a9-halt-k");
    expect(k2.modus).toBe("manual");
    projektModus("plan")(k2.cwd);
    expect((await nachfolge(k2.slot, k2.cwd)).zeile).toBe("manual");
  }, LIFE_DEADLINE_MS * 2);

  test("die Grenze steht im gespeicherten Zustand, samt einer Öffnerin ohne vergleichbaren Modus", async () => {
    const o = await oeffne("a9-stand", { permissionMode: "manual" });
    const k = await kindVon(o.token, "a9-stand-k", projektModus("plan"));
    expect((persisted(f).slots as Record<string, { modusGrenze?: unknown }>)[String(k.slot)]!.modusGrenze).toEqual({ oeffnerin: "manual", fremd: false });
    expect([modusGrenzeGeladen({ oeffnerin: null, fremd: false }), modusGrenzeGeladen({ fremd: true }), modusGrenzeGeladen({ oeffnerin: 3, fremd: false }), modusGrenzeGeladen({ fremd: false }), modusGrenzeGeladen("x")])
      .toEqual([{ oeffnerin: null, fremd: false }, { fremd: true }, null, null, null]);
    // die zwei Zweige der Regel, die keine Tür erreicht: eine Öffnerin ohne vergleichbaren Modus gibt nie bypass, ein Wort, das der Rang nicht kennt, zählt als weiter
    expect([modusUnterOeffnerin(null, "bypassPermissions", "auto"), modusUnterOeffnerin(null, "plan", "auto"), modusUnterOeffnerin("manual", "unbekannt", "auto")]).toEqual(["auto", null, "manual"]);
  }, LIFE_DEADLINE_MS);
});

describe("die Branch-Tür liest den Ordner, in dem das Kind läuft (Auftrag 9)", () => {
  // eine Datei, die nur der Checkout hat: im neuen Branch steht sie nicht
  const nurImCheckout = (m: string) => { projekt(f.repo, { permissions: { defaultMode: m } }); writeFileSync(join(f.repo, ".git/info/exclude"), ".claude/\n"); };
  test("der Checkout sagt plan, der Branch nichts: das Kind startet in seiner Öffnerin, nicht in auto", async () => {
    nurImCheckout("plan");
    for (const m of ["manual", "dontAsk"]) {
      const o = await oeffne(`a9-br-${m}`, { permissionMode: m });
      const b = await call("/api/branches", { body: { repo: f.repo, name: `Zweig ${m}` } });
      const a = await call("/api/self/branches/open", { self: o.token, body: { branch: b.body.branch, goal: "Baue." } });
      expect([a.status, a.body.error]).toEqual([200, undefined]);
      const slot = Number(a.body.slot);
      platz = Math.max(platz, slot);
      expect([m, eintrag(slot).permissionMode]).toEqual([m, m]);
    }
  }, LIFE_DEADLINE_MS * 2);
  test("der Branch trägt plan, der Checkout nichts: die Datei des Branches gilt, das Kind bleibt ohne Zeile und startet in plan", async () => {
    sh(f.repo, "branch", "-q", "kind-traegt-plan");
    const baum = join(k.TMP, `kind-traegt-plan-${Date.now()}`);
    sh(f.repo, "worktree", "add", "-q", baum, "kind-traegt-plan");
    projekt(baum, { permissions: { defaultMode: "plan" } });
    sh(baum, "add", "-f", ".claude/settings.json");
    sh(baum, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "Einstellung");
    sh(f.repo, "worktree", "remove", "--force", baum);
    const o = await oeffne("a9-br-traegt", { permissionMode: "manual" });
    const b = await call("/api/branches", { body: { repo: f.repo, name: "Trägt Plan", branch: "kind-traegt-plan" } });
    const a = await call("/api/self/branches/open", { self: o.token, body: { branch: b.body.branch, goal: "Baue." } });
    expect([a.status, a.body.error]).toEqual([200, undefined]);
    const slot = Number(a.body.slot);
    platz = Math.max(platz, slot);
    expect(eintrag(slot).permissionMode ?? null).toBeNull();
    expect(eintrag(slot).spawn?.startModus?.modus).toBe("plan");
  }, LIFE_DEADLINE_MS);
  test("die Vorschau eines Branch-Starts nennt, was das Kind bekommt: den Baum des Branches, ohne Worktree wie mit, nicht die Datei des Checkouts", async () => {
    nurImCheckout("plan");
    const modus = async (q: string) => abschnitt((await vorschau(f.repo, q)).fassung, "darf", "modus").text;
    expect(await modus("")).toBe("plan");
    const b = await call("/api/branches", { body: { repo: f.repo, name: "Zweig Vorschau" } });
    const branch = String(b.body.branch);
    // noch kein Worktree: ein bestehender Branch, und der Start eines neuen von der Integration aus
    expect(await modus(`branch=${encodeURIComponent(branch)}`)).toBe("auto");
    expect(await modus("ab=")).toBe("auto");
    // eine Wahl verdeckt in der Fassung, was ohne sie gälte: das Feld sagt es dem Fenster weiter; ohne Branch-Start gibt es das Feld nicht
    const gewaehlt = await vorschau(f.repo, "ab=&permissionMode=manual");
    expect([abschnitt(gewaehlt.fassung, "darf", "modus").text, gewaehlt.modusImBranch]).toEqual(["manual", "auto"]);
    expect((await vorschau(f.repo)).modusImBranch).toBeUndefined();
    const a = await call("/api/branches/open", { body: { repo: f.repo, branch } });
    expect([a.status, a.body.error]).toEqual([200, undefined]);
    const slot = Number(a.body.slot);
    platz = Math.max(platz, slot);
    expect(eintrag(slot).spawn?.startModus?.modus).toBe("auto");
    // ein Worktree steht: er zählt, auch mit einer Datei, die sonst nirgends liegt
    const wt = String((persisted(f).slots as Record<string, { cwd?: string }>)[String(slot)]!.cwd);
    projekt(wt, { permissions: { defaultMode: "acceptEdits" } });
    expect(await modus(`branch=${encodeURIComponent(branch)}`)).toBe("acceptEdits");
    // ein Branch, der die Datei trägt
    sh(f.repo, "branch", "-q", "traegt-plan");
    expect(await modus("ab=traegt-plan")).toBe("auto");
    const baum = join(k.TMP, "traegt-plan-wt");
    sh(f.repo, "worktree", "add", "-q", baum, "traegt-plan");
    mkdirSync(join(baum, ".claude"), { recursive: true });
    writeFileSync(join(baum, ".claude/settings.json"), JSON.stringify({ permissions: { defaultMode: "dontAsk" } }));
    sh(baum, "add", "-f", ".claude/settings.json");
    sh(baum, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "Einstellung");
    sh(f.repo, "worktree", "remove", "--force", baum);
    expect(await modus("ab=traegt-plan")).toBe("dontAsk");
  }, LIFE_DEADLINE_MS * 2);
  test("ein importierter Agent: die Vorschau eines Branch-Starts nennt auto, wo der Branch das bypass des Nutzers nicht verengt, der Checkout es aber täte", async () => {
    nurImCheckout("plan");
    const id = await importiere("Fremd Zweig");
    await mitNutzer(BYPASS, async () => {
      const modus = async (q: string) => abschnitt((await vorschau(f.repo, q)).fassung, "darf", "modus").text;
      expect(await modus(`agent=${id}`)).toBe("plan");
      expect(await modus(`agent=${id}&ab=`)).toBe("auto");
    });
  }, LIFE_DEADLINE_MS);
});

describe("ein Agent aus einer Datei erbt kein bypass", () => {
  test("mit bypass in den Einstellungen des Nutzers: die Vorschau nennt auto, die Tür nimmt den Hash, die Zeile trägt auto", async () => {
    nutzer({ permissions: { defaultMode: "bypassPermissions" } });
    try {
      const id = await importiere("Fremd"), cwd = ordner("b6");
      const p = await vorschau(cwd, `agent=${id}`);
      expect(abschnitt(p.fassung, "darf", "modus").text).toBe("auto");
      const slot = frei();
      const o = await call(`/api/slots/${slot}/open`, { body: { cwd, label: "Fremd", fassung: p.fassungsHash, agent: id } });
      expect([o.status, o.body.error]).toEqual([200, undefined]);
      expect(await modusAufZeile(cwd)).toBe("auto");
      expect(eintrag(slot).permissionMode).toBe("auto");
      // wo es auto nicht gibt: Manual, nie bypass
      const alt = await importiere("Fremd alt", { model: "claude-haiku-4-5-20251001" }), c2 = ordner("b6-alt");
      expect(abschnitt((await vorschau(c2, `agent=${alt}`)).fassung, "darf", "modus").text).toBe("manual");
    } finally { nutzer(null); }
  }, LIFE_DEADLINE_MS);
  test("ohne geerbtes bypass bleibt seine Zeile ohne Modus; ein Agent des Owners erbt weiter; No limits von Hand bleibt die Wahl des Menschen", async () => {
    const id = await importiere("Fremd zwei"), cwd = ordner("b6-ohne");
    expect((await oeffne("b6-ohne", { agent: id, label: "Fremd zwei" })).a.status).toBe(200);
    expect(await modusAufZeile(cwd)).toBe(null);
    nutzer({ permissions: { defaultMode: "bypassPermissions" } });
    try {
      const eigen = await call("/api/agenten", { body: { id: "mein", name: "Mein", wahlen: { effort: "low" } } });
      expect(eigen.status).toBeLessThan(300);
      const c2 = ordner("b6-eigen");
      const o = await call(`/api/slots/${frei()}/open`, { body: { cwd: c2, label: "Mein", agent: "mein" } });
      expect([o.status, o.body.error]).toEqual([200, undefined]);
      expect(await modusAufZeile(c2)).toBe(null);
      const c3 = ordner("b6-hand");
      const h = await call(`/api/slots/${frei()}/open`, { body: { cwd: c3, permissionMode: "bypassPermissions" } });
      expect([h.status, h.body.error]).toEqual([200, undefined]);
      expect(await modusAufZeile(c3)).toBe("bypassPermissions");
    } finally { nutzer(null); }
  }, LIFE_DEADLINE_MS);
});

describe("ein importierter Agent bleibt importiert, was immer das Fenster an ihm ändert (Auftrag 8, B6)", () => {
  const startGeaendert = async (name: string, adresse: string, koerper: Record<string, unknown>, erwartet: string) => {
    const cwd = ordner(name), p = await vorschau(cwd, adresse);
    expect([name, abschnitt(p.fassung, "darf", "modus")?.text]).toEqual([name, erwartet]);
    const slot = frei();
    const o = await call(`/api/slots/${slot}/open`, { body: { cwd, fassung: p.fassungsHash, ...koerper } });
    expect([name, o.status, o.body.error]).toEqual([name, 200, undefined]);
    return { line: await modusAufZeile(cwd), slot };
  };
  test("seine Wahlen ohne seine Kennung, aber mit seiner Herkunft: die Vorschau nennt auto, die Tür nimmt den Hash, die Zeile trägt auto; No limits von Hand bleibt, ein Modell ohne auto gibt Manual", async () => {
    await mitNutzer(BYPASS, async () => {
      const id = await importiere("Fremd drei");
      const q = `ausAgent=${id}`;
      for (const [name, adresse, koerper] of [
        ["b6a-mem", "notizbuch=aus", { notizbuch: "aus" }], ["b6a-eff", "effort=high", { effort: "high" }],
        ["b6a-bib", "bibliothek=false", { bibliothek: false }], ["b6a-mod", "model=claude-sonnet-5-5", { model: "claude-sonnet-5-5" }],
      ] as const) {
        const r = await startGeaendert(name, `${adresse}&${q}`, { ...koerper, ausAgent: id }, "auto");
        expect([name, r.line, eintrag(r.slot).permissionMode]).toEqual([name, "auto", "auto"]);
      }
      expect((await startGeaendert("b6a-alt", `model=claude-haiku-4-5-20251001&${q}`, { model: "claude-haiku-4-5-20251001", ausAgent: id }, "manual")).line).toBe("manual");
      expect((await startGeaendert("b6a-hand", `permissionMode=bypassPermissions&${q}`, { permissionMode: "bypassPermissions", ausAgent: id }, "bypassPermissions")).line).toBe("bypassPermissions");
    });
  }, LIFE_DEADLINE_MS);
  test("an der Branch-Tür ebenso, mit der Kennung und mit der Herkunft; disableAutoMode gibt Manual statt auto", async () => {
    await mitNutzer(BYPASS, async () => {
      const id = await importiere("Fremd Zweig");
      for (const [name, koerper] of [["Fremd mit Kennung", { agent: id }], ["Fremd mit Herkunft", { effort: "high", ausAgent: id }]] as const) {
        const br = await call("/api/branches", { body: { repo: f.repo, name } });
        expect(br.status).toBe(201);
        const a = await call("/api/branches/open", { body: { repo: f.repo, branch: br.body.branch, ...koerper } });
        expect([name, a.status, a.body.error]).toEqual([name, 200, undefined]);
        platz = Math.max(platz, Number(a.body.slot));
        expect([name, eintrag(Number(a.body.slot)).permissionMode]).toEqual([name, "auto"]);
      }
    });
    await mitNutzer({ ...BYPASS, disableAutoMode: "disable" }, async () => {
      const id = await importiere("Fremd ohne auto");
      const cwd = ordner("b6b-ohne"), p = await vorschau(cwd, `agent=${id}`);
      expect(abschnitt(p.fassung, "darf", "modus").text).toBe("manual");
      const slot = frei();
      const o = await call(`/api/slots/${slot}/open`, { body: { cwd, label: "Fremd ohne auto", fassung: p.fassungsHash, agent: id } });
      expect([o.status, o.body.error]).toEqual([200, undefined]);
      expect(await modusAufZeile(cwd)).toBe("manual");
    });
  }, LIFE_DEADLINE_MS);
  test("die Herkunft nimmt nur einem fremden Agenten das Erbe: ein Agent des Owners und eine unbekannte Kennung erben weiter", async () => {
    await mitNutzer(BYPASS, async () => {
      expect((await call("/api/agenten", { body: { id: "mein-b6", name: "Mein", wahlen: { effort: "low" } } })).status).toBeLessThan(300);
      for (const [name, von] of [["b6c-mein", "mein-b6"], ["b6c-keiner", "gibt-es-nicht"]] as const) {
        const cwd = ordner(name), slot = frei();
        const o = await call(`/api/slots/${slot}/open`, { body: { cwd, effort: "high", ausAgent: von } });
        expect([name, o.status, o.body.error]).toEqual([name, 200, undefined]);
        expect([name, await modusAufZeile(cwd)]).toEqual([name, null]);
      }
    });
  }, LIFE_DEADLINE_MS);
});

describe("eine Regeldatei mit paths: ist eine Regeldatei", () => {
  const regel = "---\npaths: [\"**/*.ts\"]\n---\n# Nur für TypeScript\n";
  test("ein Ordner, in dem nur sie liegt, nennt sie, und sein Hash bleibt der eines Ordners ohne Regeln", async () => {
    const leer = ordner("b3-leer"), nur = ordner("b3-nur");
    mkdirSync(join(nur, ".claude/rules"), { recursive: true });
    writeFileSync(join(nur, ".claude/rules/x.md"), regel);
    const pl = await vorschau(leer), pn = await vorschau(nur);
    expect(abschnitt(pl.fassung, "liest", "projektregeln").nachgeladen).toBeUndefined();
    const a = abschnitt(pn.fassung, "liest", "projektregeln");
    expect(a.nachgeladen.map((x: { pfad: string; text: string }) => [x.pfad, x.text])).toEqual([[join(nur, ".claude/rules/x.md"), regel]]);
    expect([a.bytes, a.dateien]).toEqual([0, undefined]);
    expect(pn.fassungsHash).toBe(pl.fassungsHash);
    // die Tür und der laufende Sitz rechnen dasselbe
    const slot = frei();
    const o = await call(`/api/slots/${slot}/open`, { body: { cwd: nur, fassung: pn.fassungsHash } });
    expect([o.status, o.body.error]).toEqual([200, undefined]);
    const lauf = (await call(`/api/slots/${slot}/fassung?anlass=laufend`)).body as any;
    expect(abschnitt(lauf, "liest", "projektregeln").nachgeladen).toEqual(a.nachgeladen);
  }, LIFE_DEADLINE_MS);
  test("neben einer gewöhnlichen Regeldatei bleibt der Abschnitt, wie er war", async () => {
    const mit = ordner("b3-mit"), ohne = ordner("b3-ohne");
    for (const d of [mit, ohne]) writeFileSync(join(d, "CLAUDE.md"), "# Regeln\n");
    mkdirSync(join(mit, ".claude/rules"), { recursive: true });
    writeFileSync(join(mit, ".claude/rules/x.md"), regel);
    const pm = await vorschau(mit), po = await vorschau(ohne);
    expect(abschnitt(pm.fassung, "liest", "projektregeln").nachgeladen).toBeUndefined();
    expect(abschnitt(pm.fassung, "liest", "projektregeln").text).toBe(abschnitt(po.fassung, "liest", "projektregeln").text.replaceAll(ohne, mit));
    expect(pm.fassungsHash).toBe(po.fassungsHash);
  }, LIFE_DEADLINE_MS);
});

describe("was das Fenster über eine Regeldatei sagt, sagt der Server (Auftrag 8, B3)", () => {
  const regel = "---\npaths: [\"**/*.ts\"]\n---\n# Nur für TypeScript\n";
  test("Server und Fenster lesen paths: gleich: CRLF, `paths :`, und `---` erst nach dem Anfang der Datei zählt nicht", async () => {
    for (const [name, text, spaeter] of [
      ["lf", regel, true], ["crlf", "---\r\npaths: [\"**/*.ts\"]\r\n---\r\n# Regel\r\n", true], ["leerzeichen", "---\npaths : [\"**/*.ts\"]\n---\n# Regel\n", true],
      ["titel-zuerst", "# Titel\n---\npaths: x\n---\n", false], ["ohne", "# Regel\n", false],
      // gemessen an echtem Claude Code (claude -p, Auftrag 9): lädt es sie am Start oder erst mit einer passenden Datei
      ["leere-liste", "---\npaths: []\n---\n# Regel\n", false], ["leere-liste-raum", "---\npaths: [ ]\n---\n# Regel\n", false], ["ohne-wert", "---\npaths:\n---\n# Regel\n", false],
      ["kommentar-wert", "---\npaths: # x\n---\n# Regel\n", false], ["tilde", "---\npaths: ~\n---\n# Regel\n", false], ["null", "---\npaths: null\n---\n# Regel\n", false],
      ["leerer-text", "---\npaths: \"\"\n---\n# Regel\n", false], ["leerer-eintrag", "---\npaths:\n  -\n---\n# Regel\n", false], ["alles", "---\npaths: \"**\"\n---\n# Regel\n", false],
      ["alles-liste", "---\npaths: [\"**\"]\n---\n# Regel\n", false], ["zweiter-block", "---\n---\npaths: x\n---\n# Regel\n", false], ["geschachtelt", "---\nfoo:\n  paths: x\n---\n# Regel\n", false],
      ["kommentar", "---\n# paths: x\n---\n# Regel\n", false],
      ["anderer-schluessel", "---\nmypaths: x\n---\n# Regel\n", false],
      ["bom", "\uFEFF---\npaths: [\"**/*.ts\"]\n---\n# Regel\n", true], ["eingerueckt", "---\n  paths: [\"**/*.ts\"]\n---\n# Regel\n", true], ["block-liste", "---\npaths:\n  - \"**/*.ts\"\n---\n# Regel\n", true],
      ["neben-anderem", "---\ndescription: y\npaths: \"**/*.ts\"\n---\n# Regel\n", true], ["ein-wort", "---\npaths: x\n---\n# Regel\n", true], ["strich-im-wert", "---\npaths: a---b\n---\n# Regel\n", true],
    ] as const) {
      const d = ordner(`b3r-${name}`);
      mkdirSync(join(d, ".claude/rules"), { recursive: true });
      writeFileSync(join(d, ".claude/rules/x.md"), text);
      const a = abschnitt((await vorschau(d)).fassung, "liest", "projektregeln");
      expect([name, a.nachgeladen?.length ?? 0, a.bytes > 0]).toEqual([name, spaeter ? 1 : 0, !spaeter]);
      expect([name, nurBeiPfaden(text)]).toEqual([name, spaeter]);
    }
  }, LIFE_DEADLINE_MS);
  test("eine Kopie der Rolle in einem Ordner, in dem nur eine solche Datei liegt: dieselbe Datei wie der einfache Start, nichts „left out“", async () => {
    const kopie = await call("/api/agenten/orchestratorin/kopie", { body: { name: "copy of Orchestrator" } });
    const id = (kopie.body as { agent: { id: string } }).agent.id;
    const d = ordner("b3r-rolle");
    mkdirSync(join(d, ".claude/rules"), { recursive: true });
    writeFileSync(join(d, ".claude/rules/x.md"), regel);
    const einfach = abschnitt((await vorschau(d)).fassung, "liest", "projektregeln"), rolle = abschnitt((await vorschau(d, `agent=${id}`)).fassung, "liest", "projektregeln");
    expect(rolle.nachgeladen).toEqual(einfach.nachgeladen);
    expect(rolle.nachgeladen.length).toBe(1);
  }, LIFE_DEADLINE_MS);
  test("„Only this repo's“ nimmt auch eine Regeldatei des Nutzers mit paths: heraus, die des Repos bleibt", async () => {
    const eigen = join(k.TMP, "rules");
    mkdirSync(eigen, { recursive: true });
    writeFileSync(join(eigen, "u.md"), regel);
    try {
      const d = ordner("b3r-nur"), weg = encodeURIComponent(JSON.stringify({ claudeMd: true, rules: true }));
      mkdirSync(join(d, ".claude/rules"), { recursive: true });
      writeFileSync(join(d, ".claude/rules/x.md"), regel);
      const namen = (x: Record<string, any>) => abschnitt(x.fassung, "liest", "projektregeln").nachgeladen.map((n: { pfad: string }) => n.pfad);
      expect(namen(await vorschau(d))).toEqual([join(eigen, "u.md"), join(d, ".claude/rules/x.md")]);
      expect(namen(await vorschau(d, `weglassen=${weg}`))).toEqual([join(d, ".claude/rules/x.md")]);
    } finally { rmSync(eigen, { recursive: true, force: true }); }
  }, LIFE_DEADLINE_MS);
});

describe("ein Recht an der Tür steht in der Vorschau", () => {
  test("die Zeile FLEET SERVER RIGHTS steht in der Vorschau eines einfachen Starts mit einem Recht, die Tür nimmt ihren Hash, und der laufende Sitz trägt ihn", async () => {
    const d = ordner("b1r-recht"), recht = { recht: ["role.form"] };
    const ohne = await vorschau(d), mit = await vorschau(d, `rechte=${encodeURIComponent(JSON.stringify(recht))}`);
    // die Fassung nennt die Rechte immer unter „darf“; im Start steht die Zeile nur mit einem Recht an der Tür (server.ts#rechtAnDerTuer)
    const zusatz = (x: Record<string, any>): string => abschnitt(x.fassung, "liest", "systemzusatz")?.text ?? "";
    expect(zusatz(ohne)).not.toContain("FLEET SERVER RIGHTS");
    expect(zusatz(mit)).toContain("FLEET SERVER RIGHTS");
    const slot = frei();
    const o = await call(`/api/slots/${slot}/open`, { body: { cwd: d, rechte: recht, fassung: mit.fassungsHash } });
    expect([o.status, o.body.error]).toEqual([200, undefined]);
    await modusAufZeile(d);
    expect((await call(`/api/slots/${slot}/fassung?anlass=laufend`)).body.hash).toBe(mit.fassungsHash);
  }, LIFE_DEADLINE_MS);
});

describe("eine Rolle hat einen Träger", () => {
  test("derselbe Platz noch einmal durch den Agenten: der Träger ist er selbst, die Tür lässt ihn durch, und er behält seine Rechte", async () => {
    const kopie = await call("/api/agenten/orchestratorin/kopie", { body: { name: "copy of Orchestrator" } });
    const id = (kopie.body as { agent: { id: string } }).agent.id, cwd = ordner("d1-selbst"), slot = frei();
    expect((await call(`/api/slots/${slot}/open`, { body: { cwd, agent: id } })).status).toBe(200);
    await modusAufZeile(cwd);
    const wieder = await call(`/api/slots/${slot}/open`, { body: { cwd, agent: id } });
    expect([wieder.status, wieder.body.error]).toEqual([200, undefined]);
    const ich = (await call("/api/self", { self: eintrag(slot).selfToken })).body as { rechte?: { effective?: string[] } };
    expect(ich.rechte?.effective).toContain("edge.grant");
  }, LIFE_DEADLINE_MS);
  test("ein zweiter Start durch den Agenten oder seine Kopie: 409 mit einem Satz, der Träger behält seine Rechte; Nachfolge und die Tür mit dem Label allein bleiben", async () => {
    const kopie = await call("/api/agenten/orchestratorin/kopie", { body: { name: "copy of Orchestrator" } });
    expect(kopie.status).toBeLessThan(300);
    const copyId = (kopie.body.agent as { id: string }).id;
    const erst = await oeffne("d1-erst", { agent: copyId });
    const rechte = async () => ((await call("/api/self", { self: erst.token })).body as any).rechte?.effective as string[];
    const vorher = await rechte();
    expect(vorher).toContain("edge.grant");
    for (const agent of [copyId, "orchestratorin"]) {
      const c = ordner(`d1-${agent}`);
      const a = await call(`/api/slots/${frei()}/open`, { body: { cwd: c, agent } });
      expect(a.status).toBe(409);
      expect(a.body.error).toBe(`The role Orchestrator is held by the seat in slot ${erst.slot}; end that seat first.`);
      expect(existsSync(join(c, ".claude"))).toBe(false);
    }
    expect(await rechte()).toEqual(vorher);
    // die Nachfolge geht nicht durch diese Tür: der Platz bleibt die Rolle
    const n = await call("/api/self/succeed", { self: erst.token, body: { intent: "weiter" } });
    // (der Ersatz antwortet nicht auf den Brief: Fleet hält ihn als Schuld; die Nachfolgerin steht)
    expect(String(n.body.error ?? `successor stands on slot ${erst.slot}`)).toContain(`successor stands on slot ${erst.slot}`);
    for (let i = 0; i < 100 && eintrag(erst.slot).selfToken === erst.token; i++) await Bun.sleep(100);
    const nachfolgerin = eintrag(erst.slot).selfToken;
    expect(nachfolgerin).not.toBe(erst.token);
    // sie trägt die Rolle weiter, und beendet ist die Rolle wieder frei
    const zweite = await call(`/api/slots/${frei()}/open`, { body: { cwd: ordner("d1-nach"), agent: copyId } });
    expect(zweite.status).toBe(409);
    const ende = await call("/api/self/retire", { self: nachfolgerin, body: {} });
    expect(ende.status).toBeLessThan(300);
    const wieder = await call(`/api/slots/${frei()}/open`, { body: { cwd: ordner("d1-wieder"), agent: copyId } });
    expect([wieder.status, wieder.body.error]).toEqual([200, undefined]);
    // die Owner-Tür mit dem Label allein bleibt, wie sie ist: sie nennt den Konflikt
    const label = await call(`/api/slots/${frei()}/open`, { body: { cwd: ordner("d1-label"), label: "Orchestrator" } });
    expect(label.status).toBe(200);
    expect(label.body.roleConflict).toBeDefined();
  }, LIFE_DEADLINE_MS * 2);
});
