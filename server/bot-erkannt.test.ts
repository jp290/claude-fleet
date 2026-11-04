// DER EIGENE BOT WIRD ERKANNT: wer den Super FleetBot aus dem Menü startet, findet seine Seite, ohne etwas zu markieren. Alles an den echten Türen eines echten Servers.
import { afterAll, afterEach, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { branchTestkit, persisted } from "./branches-testkit";
import { RECHTE_NUR_DURCH_OWNER } from "./tuer-rechte";

for (const n of Object.keys(process.env)) if (/^(CLAUDE|ANTHROPIC)/.test(n)) delete process.env[n];
setDefaultTimeout(30_000);
const k = branchTestkit();
const REC = join(k.TMP, "rec");
mkdirSync(REC);
writeFileSync(join(k.BIN, "claude"), `#!/bin/sh\nd=${REC}/$$; mkdir -p $d; : > $d/args; for a in "$@"; do printf '%s\\0' "$a" >> $d/args; done; pwd > $d/cwd\nexec sleep 600\n`, { mode: 0o755 });
const f = k.fixture();
let server: Awaited<ReturnType<typeof k.serve>>;
beforeAll(async () => { server = await k.serve(f, { FLEET_SELF_SEAT_ROOT: k.TMP, FLEET_SELF_SEAT_CAP: "9" }); });
afterAll(async () => { await server?.stop(); k.cleanup(); });
const call: Awaited<ReturnType<typeof k.serve>>["call"] = (path, init) => server.call(path, init);
let platz = 0;
// die Leiste hat 16 Plätze: jeder Test räumt seine auf
afterEach(async () => { for (let n = 1; n <= platz; n++) await call(`/api/slots/${n}/kill`, { body: {} }); platz = 0; });
const ordner = (n: string): string => { const d = join(f.repo, n); mkdirSync(d, { recursive: true }); return d; };
const token = (slot: number): string => (persisted(f).slots as Record<string, { selfToken: string }>)[String(slot)]!.selfToken;
const zeilen = (cwd: string): string[][] => readdirSync(REC).map((p) => join(REC, p)).filter((d) => existsSync(join(d, "cwd")) && readFileSync(join(d, "cwd"), "utf8").trim() === cwd)
  .map((d) => readFileSync(join(d, "args"), "utf8").split("\0"));
const markiert = async (slot: number): Promise<boolean> => {
  const j = (await call("/api/sessions")).body as { slots: { id: number; ownBot?: true }[] };
  return j.slots.find((s) => s.id === slot)?.ownBot === true;
};
const ausVorlage = async (): Promise<string> => {
  const r = await call("/api/setups/import", { body: { vorlage: "super-fleetbot", schreiben: true } });
  expect([r.status, r.body.error]).toEqual([201, undefined]);
  return (r.body.agent as { id: string }).id;
};
const start = async (name: string, body: Record<string, unknown>): Promise<number> => {
  const slot = ++platz;
  const a = await call(`/api/slots/${slot}/open`, { body: { cwd: ordner(name), ...body } });
  expect([a.status, a.body.error]).toEqual([200, undefined]);
  return slot;
};
const kindVon = async (slot: number, name: string, body: Record<string, unknown> = {}) => {
  const a = await call("/api/self/seats/open", { self: token(slot), body: { cwd: ordner(name), ...body } });
  if (a.status === 200) platz = Math.max(platz, Number(a.body.slot));
  return a;
};
const vorlagenDatei = async () => (await call("/api/setups/vorlagen/super-fleetbot/datei")).body as Record<string, unknown>;
const nachfolge = async (slot: number): Promise<void> => {
  // der Stand-in tippt nichts zurück: der Nachfolger steht, sein Brief wartet als Schuld; um den geht es hier nicht
  const n = await call("/api/self/succeed", { self: token(slot), body: { intent: "weiter" } });
  expect(n.status === 200 || String(n.body.error).startsWith(`successor stands on slot ${slot}`)).toBe(true);
};

describe("aus dem Menü: Fleets Vorlage an der Tür des Owners", () => {
  test("der Start trägt die Marke sofort, und der Eintrag sagt, woher er kam", async () => {
    const id = await ausVorlage();
    const a = (await call(`/api/agenten/${id}`)).body.agent as { vorlage?: string; importiert?: true };
    expect(a.vorlage).toBe("super-fleetbot");
    expect(await markiert(await start("t-menue", { agent: id }))).toBe(true);
  });
  test("was ein importierter Agent darf, bleibt: er startet weiter nie in bypass", async () => {
    const id = await ausVorlage();
    const a = (await call(`/api/agenten/${id}`)).body.agent as { importiert?: true };
    expect(a.importiert).toBe(true);
    const nein = await call(`/api/slots/${++platz}/open`, { body: { cwd: ordner("t-bypass"), agent: id, permissionMode: "bypassPermissions" } });
    expect(nein.status).toBe(400);
  });
  test("die Marke überlebt das Umbenennen des Agenten und des Sitzes", async () => {
    const id = await ausVorlage();
    const put = await call(`/api/agenten/${id}`, { method: "PUT", body: { name: "Mein Bot" } });
    expect([put.status, put.body.error]).toEqual([200, undefined]);
    expect((put.body.agent as { vorlage?: string }).vorlage).toBe("super-fleetbot");
    const slot = await start("t-umbenannt", { agent: id });
    expect(await markiert(slot)).toBe(true);
    expect((await call(`/api/slots/${slot}/rename`, { body: { label: "Anders" } })).status).toBe(200);
    expect(await markiert(slot)).toBe(true);
  });
  test("im Fenster geändert und gestartet: auch das ist der Bot aus dem Menü", async () => {
    const id = await ausVorlage();
    expect(await markiert(await start("t-fenster", { ausAgent: id, effort: "low" }))).toBe(true);
  });
  test("die Marke überlebt die Nachfolge; wer sie wegnimmt, bei dem bleibt sie weg, auch über die Nachfolge", async () => {
    const id = await ausVorlage();
    const slot = await start("t-nachfolge", { agent: id });
    await nachfolge(slot);
    expect(await markiert(slot)).toBe(true);
    expect((await call(`/api/slots/${slot}/rechte`, { body: { revoke: ["owner.bot"] } })).status).toBe(200);
    expect(await markiert(slot)).toBe(false);
    await nachfolge(slot);
    expect(await markiert(slot)).toBe(false);
  });
  test("zwei Super FleetBots: beide markiert, jeder Knopf findet seinen Sitz", async () => {
    const id = await ausVorlage();
    const a = await start("t-zwei-a", { agent: id }), b = await start("t-zwei-b", { agent: id });
    expect([await markiert(a), await markiert(b)]).toEqual([true, true]);
  });
});

describe("was die Marke nicht bekommt", () => {
  test("eine Datei, auch mit demselben Namen und demselben Text und mit einer behaupteten Herkunft", async () => {
    const datei = await vorlagenDatei();
    for (const d of [datei, { ...datei, vorlage: "super-fleetbot" }]) {
      const r = await call("/api/setups/import", { body: { datei: d, schreiben: true } });
      expect([r.status, r.body.error]).toEqual([201, undefined]);
      const a = r.body.agent as { id: string; name: string; vorlage?: string };
      expect(a.name).toBe("Super FleetBot");
      expect(a.vorlage).toBeUndefined();
      expect(await markiert(await start(`t-datei-${a.id}`, { agent: a.id }))).toBe(false);
    }
  });
  test("die alte Agenten-Datei, die sich die Herkunft ins Feld schreibt, und ein Körper, der sie nennt", async () => {
    const r = await call("/api/agenten/import", { body: { vorlage: "super-fleetbot", datei: { format: "fleet-agent/1", name: "Super FleetBot", abgeleitetVon: "b".repeat(64), wahlen: {}, vorlage: "super-fleetbot" } } });
    expect([r.status, r.body.error]).toEqual([201, undefined]);
    expect((r.body.agent as { vorlage?: string }).vorlage).toBeUndefined();
    const n = await call("/api/agenten", { body: { name: "Super FleetBot", wahlen: {}, vorlage: "super-fleetbot" } });
    expect(n.status).toBe(201);
    expect((n.body.agent as { vorlage?: string }).vorlage).toBeUndefined();
  });
  test("eine Kopie einer Datei, und eine Kopie des echten Agenten", async () => {
    const datei = await vorlagenDatei();
    const r = await call("/api/setups/import", { body: { datei, schreiben: true } });
    const id = (r.body.agent as { id: string }).id;
    for (const von of [id, await ausVorlage()]) {
      const c = await call(`/api/agenten/${von}/kopie`, { body: { name: `Kopie ${von}` } });
      expect([c.status, c.body.error]).toEqual([201, undefined]);
      const a = c.body.agent as { id: string; vorlage?: string };
      expect(a.vorlage).toBeUndefined();
      expect(await markiert(await start(`t-kopie-${a.id}`, { agent: a.id }))).toBe(false);
    }
  });
  test("ein Sitz, den eine Session öffnet, mit jedem Körper, und das Kind eines markierten Sitzes", async () => {
    const id = await ausVorlage();
    const eltern = await start("t-eltern", { agent: id });
    expect(await markiert(eltern)).toBe(true);
    const frisch = await kindVon(eltern, "t-kind", {});
    expect([frisch.status, frisch.body.error]).toEqual([200, undefined]);
    expect(await markiert(Number(frisch.body.slot))).toBe(false);
    const ausAgent = await kindVon(eltern, "t-kind-agent", { agent: id });
    if (ausAgent.status === 200) expect(await markiert(Number(ausAgent.body.slot))).toBe(false);
    const ausFenster = await kindVon(eltern, "t-kind-aus", { ausAgent: id });
    if (ausFenster.status === 200) expect(await markiert(Number(ausFenster.body.slot))).toBe(false);
    const gefragt = await kindVon(eltern, "t-kind-recht", { rechte: { recht: ["owner.bot"] } });
    if (gefragt.status === 200) expect(await markiert(Number(gefragt.body.slot))).toBe(false);
  });
  test("eine Vorlage, die eine Session über die Self-Tür importiert: keine Herkunft", async () => {
    const eltern = await start("t-self-import", {});
    expect((await call(`/api/slots/${eltern}/rechte`, { body: { grant: ["setup.import"] } })).status).toBe(200);
    const r = await call("/api/self/setups/import", { self: token(eltern), body: { vorlage: "super-fleetbot", schreiben: true } });
    expect([r.status, r.body.error]).toEqual([201, undefined]);
    const a = r.body.agent as { id: string; vorlage?: string };
    expect(a.vorlage).toBeUndefined();
    expect(await markiert(await start("t-self-import-start", { agent: a.id }))).toBe(false);
  });
});

describe("was der Sitz liest", () => {
  const anhang = (args: string[]): string => args.flatMap((a, i) => args[i - 1] === "--append-system-prompt" ? [a] : []).join("\n");
  test("der erste Start und seine Nachfolge lesen dasselbe wie ein Start ohne Marke", async () => {
    const id = await ausVorlage();
    const cwd = ordner("t-liest");
    const slot = await start("t-liest", { agent: id });
    for (let i = 0; i < 50 && !zeilen(cwd).length; i++) await Bun.sleep(100);
    await nachfolge(slot);
    for (let i = 0; i < 80 && zeilen(cwd).length < 2; i++) await Bun.sleep(100);
    const l = zeilen(cwd);
    expect(l.length).toBeGreaterThanOrEqual(2);
    const sicht = (args: string[]) => { const s = args.flatMap((a, i) => args[i - 1] === "--settings" ? [a] : [])[0] ?? "{}";
      return { saetze: anhang(args).split("\n").filter((x) => x.includes("RIGHTS")).map((x) => x.slice(0, 400)), perms: (() => { try { return JSON.parse(s).permissions ?? null; } catch { return s.slice(0, 200); } })() }; };
    console.log("ERSTER", JSON.stringify(sicht(l[0]!))); console.log("LETZTER", JSON.stringify(sicht(l.at(-1)!)));
    expect(sicht(l.at(-1)!)).toEqual(sicht(l[0]!));
  });
});

describe("die Marke von Hand", () => {
  test("auf einem Sitz ohne Rechte ändert sie nicht, was seine Nachfolge liest und darf; weg ist sie wie nie gesetzt", async () => {
    const cwd = ordner("t-hand");
    const slot = await start("t-hand", {});
    expect((await call(`/api/slots/${slot}/rechte`, { body: { grant: ["owner.bot"] } })).status).toBe(200);
    await nachfolge(slot);
    for (let i = 0; i < 80 && zeilen(cwd).length < 2; i++) await Bun.sleep(100);
    const zweite = zeilen(cwd).at(-1)!;
    expect(zweite.join(" ")).not.toContain("FLEET RIGHTS (level");
    expect(zweite.join(" ")).not.toContain("./ctl.sh land *");
    expect(await markiert(slot)).toBe(true);
    const weg = await call(`/api/slots/${slot}/rechte`, { body: { revoke: ["owner.bot"] } });
    expect(weg.body.rechte).toBeNull();
    await nachfolge(slot);
    for (let i = 0; i < 80 && zeilen(cwd).length < 3; i++) await Bun.sleep(100);
    expect(zeilen(cwd).at(-1)!.join(" ")).not.toContain("FLEET RIGHTS (level");
  });
  test("auf einem Sitz mit einer Stufe bleibt die Stufe und ihre Regel", async () => {
    const cwd = ordner("t-stufe");
    const slot = await start("t-stufe", { rechte: { stufe: "bauen" } });
    expect((await call(`/api/slots/${slot}/rechte`, { body: { grant: ["owner.bot"] } })).status).toBe(200);
    await nachfolge(slot);
    for (let i = 0; i < 80 && zeilen(cwd).length < 2; i++) await Bun.sleep(100);
    expect(zeilen(cwd).at(-1)!.join(" ")).toContain("FLEET RIGHTS (level");
  });
  test("ein Körper oder eine Datei kann sich mit nurMarke keine Regel erlassen", async () => {
    const cwd = ordner("t-koerper");
    await start("t-koerper", { rechte: { stufe: "lesen", recht: ["owner.bot"], nurMarke: true } });
    for (let i = 0; i < 50 && !zeilen(cwd).length; i++) await Bun.sleep(100);
    expect(zeilen(cwd)[0]!.join(" ")).toContain("FLEET RIGHTS (level");
  });
});

describe("was die Datei sagt", () => {
  // setupRoute antwortet { datei }; hineingeht nur das Innere
  const teilen = async (slot: number) => {
    const s = await call("/api/agenten", { body: { name: `Aus Slot ${slot}`, vonSlot: slot } });
    expect([s.status, s.body.error]).toEqual([201, undefined]);
    const neu = s.body.agent as { id: string; vorlage?: string };
    expect(neu.vorlage).toBeUndefined();
    const datei = ((await call(`/api/setups/${neu.id}/datei`)).body as { datei: { seats: { may: { rechte: { recht?: string[] } | null } }[] } }).datei;
    const zurueck = await call("/api/setups/import", { body: { datei, schreiben: true } });
    expect([zurueck.status, zurueck.body.error]).toEqual([201, undefined]);
    return { may: datei.seats[0]!.may.rechte, text: JSON.stringify(datei), a: zurueck.body.agent as { id: string; wahlen: { rechte?: { recht?: string[] } } }, erbeten: zurueck.body.erbetenRechte };
  };
  test("der Super FleetBot, gespeichert und geteilt: die Datei nennt die Marke nicht, und seine Herkunft auch nicht", async () => {
    const r = await teilen(await start("t-export", { agent: await ausVorlage() }));
    expect(r.may).toBeNull();
    expect(r.text).not.toContain("owner.bot");
    expect(r.text).not.toContain("\"vorlage\"");
    expect(await markiert(await start("t-export-start", { agent: r.a.id }))).toBe(false);
  });
  test("ein markierter Sitz mit einer Stufe: die Datei erbittet das Recht, die nächste Fleet bekommt es erst, wenn ihr Owner es bestätigt", async () => {
    const slot = await start("t-export-stufe", { rechte: { stufe: "bauen" } });
    expect((await call(`/api/slots/${slot}/rechte`, { body: { grant: ["owner.bot"] } })).status).toBe(200);
    const r = await teilen(slot);
    expect(r.may?.recht).toEqual(["owner.bot"]);
    expect(r.a.wahlen.rechte?.recht ?? []).not.toContain("owner.bot");
    expect((r.erbeten as { recht?: string[] }).recht).toEqual(["owner.bot"]);
    expect(await markiert(await start("t-export-stufe-start", { agent: r.a.id }))).toBe(false);
  });
});

// ---- Auftrag 18: eine Marke gibt einem Kind nichts und nimmt ihm nichts; eine Self-Tür gibt sie nicht weiter; von Hand ändert sie nichts, was eine Nachfolge liest ----
const gespeichert = async (slot: number): Promise<unknown> => {
  for (let i = 0; i < 40; i++) { const r = (persisted(f).slots as Record<string, { rechte?: unknown }>)[String(slot)]; if (r) return r.rechte ?? null; await Bun.sleep(100); }
  return "kein Slot gespeichert";
};
const startZeile = async (cwd: string): Promise<string[]> => { for (let i = 0; i < 60 && !zeilen(cwd).length; i++) await Bun.sleep(100); return zeilen(cwd).at(-1) ?? []; };
// was ein Start dem Sitz an Rechten liest und darf: die Sätze mit RIGHTS (je Zeile), und die Regeln der --settings
const rechteSicht = (args: string[]) => {
  const anhang = args.flatMap((a, i) => args[i - 1] === "--append-system-prompt" ? [a] : []).join("\n");
  const settings = args.flatMap((a, i) => args[i - 1] === "--settings" ? [a] : [])[0] ?? "{}";
  let regeln: unknown = settings.slice(0, 200); try { regeln = (JSON.parse(settings) as { permissions?: unknown }).permissions ?? null; } catch { /* kein JSON */ }
  return { saetze: anhang.split("\n").filter((x) => x.includes("RIGHTS")).map((x) => x.slice(0, 120)), regeln };
};
const kopieStart = async (id: string, name: string): Promise<number> => {
  const c = await call(`/api/agenten/${id}/kopie`, { body: { name: `Kopie ${name}` } });
  expect([c.status, c.body.error]).toEqual([201, undefined]);
  return start(name, { agent: (c.body.agent as { id: string }).id });
};
const zweig = async (name: string): Promise<string> => {
  const b = await call("/api/branches", { body: { repo: f.repo, name } });
  expect([b.status, b.body.error]).toEqual([201, undefined]);
  return String(b.body.branch);
};

describe("das Kind einer Marke startet wie das Kind einer Kopie", () => {
  test("an beiden Türen, mit leerem Körper, und dessen eigenes Kind: kein gespeichertes Recht, keine Rechte-Zeile, keine Regel", async () => {
    const id = await ausVorlage();
    const bot = await start("k-bot", { agent: id });
    const ohne = await kopieStart(id, "k-ohne");
    expect(await markiert(bot)).toBe(true);
    expect(await markiert(ohne)).toBe(false);
    const kinder: Record<string, { seat: number; branch: number; enkel: number }> = {};
    for (const [wer, slot] of [["bot", bot], ["ohne", ohne]] as const) {
      const a = await kindVon(slot, `k-seat-${wer}`, {});
      expect([a.status, a.body.error]).toEqual([200, undefined]);
      const b = await call("/api/self/branches/open", { self: token(slot), body: { branch: await zweig(`K ${wer}`) } });
      expect([b.status, b.body.error]).toEqual([200, undefined]);
      platz = Math.max(platz, Number(b.body.slot));
      const e = await call("/api/self/seats/open", { self: token(Number(a.body.slot)), body: { cwd: ordner(`k-enkel-${wer}`) } });
      expect([e.status, e.body.error]).toEqual([200, undefined]);
      platz = Math.max(platz, Number(e.body.slot));
      kinder[wer] = { seat: Number(a.body.slot), branch: Number(b.body.slot), enkel: Number(e.body.slot) };
    }
    for (const art of ["seat", "branch", "enkel"] as const) {
      expect(await gespeichert(kinder.bot![art])).toEqual(await gespeichert(kinder.ohne![art]));
      expect(await gespeichert(kinder.bot![art])).toBeNull();
    }
    // die Zeile des Kindes: dieselbe Sicht wie die des Kindes der Kopie, und keine Stufe und keine Sperre
    for (const art of ["seat", "enkel"] as const) {
      const von = async (wer: string) => rechteSicht(await startZeile(ordner(art === "seat" ? `k-seat-${wer}` : `k-enkel-${wer}`)));
      const [b, o] = [await von("bot"), await von("ohne")];
      expect(b).toEqual(o);
      expect(b.saetze.join(" ")).not.toContain("FLEET RIGHTS (level");
      expect(JSON.stringify(b.regeln)).not.toContain("ctl.sh land");
    }
    const geerbt = await call("/api/self", { self: token(kinder.bot!.seat) });
    expect(JSON.stringify(geerbt.body)).not.toContain("owner.bot");
  });
  test("ein Sitz mit der Marke von Hand: sein Kind ist wie das eines schlichten Sitzes", async () => {
    const hand = await start("k-hand", {}), schlicht = await start("k-schlicht", {});
    expect((await call(`/api/slots/${hand}/rechte`, { body: { grant: ["owner.bot"] } })).status).toBe(200);
    const [a, c] = [await kindVon(hand, "k-hand-kind", {}), await kindVon(schlicht, "k-schlicht-kind", {})];
    expect([a.status, a.body.error, c.status, c.body.error]).toEqual([200, undefined, 200, undefined]);
    expect(await gespeichert(Number(a.body.slot))).toBeNull();
    const sicht = rechteSicht(await startZeile(ordner("k-hand-kind")));
    expect(sicht).toEqual(rechteSicht(await startZeile(ordner("k-schlicht-kind"))));
    expect(sicht.saetze.join(" ")).not.toContain("FLEET RIGHTS (level");
  });
  test("ein Sitz, der echte Rechte neben der Marke hält, deckelt sein Kind weiter damit, ohne die Marke und ohne das Recht, das nur der Owner gibt", async () => {
    const s16 = await start("k-16", { rechte: { stufe: "bauen", an: [], aus: [], recht: ["overview.fleet", "owner.bot"] } });
    const a = await kindVon(s16, "k-16-kind", {});
    expect([a.status, a.body.error]).toEqual([200, undefined]);
    const r = (await gespeichert(Number(a.body.slot))) as { stufe: string; recht?: string[] } | null;
    expect(r?.stufe).toBe("bauen");
    for (const id of RECHTE_NUR_DURCH_OWNER) expect(r?.recht ?? []).not.toContain(id);
    expect(rechteSicht(await startZeile(ordner("k-16-kind"))).saetze.join(" ")).toContain("FLEET RIGHTS (level");
    // und er selbst liest sein Recht und seine Regel wie zuvor
    expect(rechteSicht(await startZeile(ordner("k-16"))).saetze.join(" ")).toContain("FLEET RIGHTS (level");
  });
});

describe("die Self-Tür gibt die Marke und jedes Recht, das nur der Owner gibt, nicht weiter", () => {
  const sitzMit = async (name: string, recht: string[], vorlage: boolean) => {
    const slot = vorlage ? await start(name, { agent: await ausVorlage() }) : await start(name, {});
    expect((await call(`/api/slots/${slot}/rechte`, { body: { grant: ["setup.save", "setup.export", ...recht] } })).status).toBe(200);
    return slot;
  };
  const speichern = async (slot: number, korper: Record<string, unknown>) => {
    const r = await call("/api/self/agenten", { self: token(slot), body: korper });
    expect([r.status, r.body.error]).toEqual([201, undefined]);
    const a = r.body.agent as { id: string };
    const nach = (await call(`/api/agenten/${a.id}`)).body.agent as { wahlen: { rechte?: { recht?: string[] } } };
    return { gedeckelt: (r.body.gedeckelt ?? []) as string[], recht: nach.wahlen.rechte?.recht ?? [], start: await start(`s-${a.id}`, { agent: a.id }) };
  };
  test("owner.bot im Körper, und vonSlot für den eigenen Sitz: wie von einem Sitz ohne Marke, gedeckelt und ungemarkt", async () => {
    const mit = await sitzMit("s-mit", [], true);
    const ohne = await sitzMit("s-ohne", [], false);
    expect(await markiert(mit)).toBe(true);
    for (const [wer, slot] of [["mit", mit], ["ohne", ohne]] as const) {
      const a = await speichern(slot, { name: `Körper ${wer}`, wahlen: { rechte: { stufe: "bauen", recht: ["owner.bot"] } } });
      expect(a.gedeckelt).toContain("owner.bot");
      expect(a.recht).not.toContain("owner.bot");
      expect(await markiert(a.start)).toBe(false);
      const v = await speichern(slot, { name: `Slot ${wer}`, vonSlot: slot });
      expect(v.recht).not.toContain("owner.bot");
      expect(await markiert(v.start)).toBe(false);
    }
  });
  test("jedes Recht aus RECHTE_NUR_DURCH_OWNER, auch bei einem Sitz, dem der Owner es gab", async () => {
    for (const id of RECHTE_NUR_DURCH_OWNER) {
      const slot = await sitzMit(`s-${id}`, [id], false);
      const a = await speichern(slot, { name: `Recht ${id}`, wahlen: { rechte: { stufe: "bauen", recht: [id] } } });
      expect(a.gedeckelt).toContain(id);
      expect(a.recht).not.toContain(id);
      const v = await speichern(slot, { name: `Slot ${id}`, vonSlot: slot });
      expect(v.recht).not.toContain(id);
    }
  });
  test("die Konstellation, die ein Sitz speichert, nennt keins davon", async () => {
    const s16 = await sitzMit("s-konst", ["overview.fleet", "owner.bot"], false);
    const mit = await sitzMit("s-konst-marke", [], true);
    for (const slot of [s16, mit]) {
      const a = await kindVon(slot, `s-konst-kind-${slot}`, {});
      expect(a.status).toBe(200);
      const ks = await call("/api/self/konstellationen", { self: token(slot), body: { name: `Team ${slot}` } });
      expect([ks.status, ks.body.error]).toEqual([201, undefined]);
      const kid = (ks.body.konstellation as { id: string }).id;
      const d = await call(`/api/self/setups/${kid}/datei`, { self: token(slot) });
      expect(JSON.stringify(d.body)).not.toContain("owner.bot");
      const sitze = (d.body as { datei: { seats: { may: { rechte: unknown } }[] } }).datei.seats;
      expect(sitze.length).toBeGreaterThanOrEqual(2);
      for (const x of sitze) for (const id of RECHTE_NUR_DURCH_OWNER) expect(JSON.stringify(x.may.rechte ?? null)).not.toContain(id);
    }
  });
  test("die Tür des Owners bleibt: sein Schlüssel speichert den Sitz mit dem Recht", async () => {
    const s16 = await start("s-owner", { rechte: { stufe: "bauen", an: [], aus: [], recht: ["overview.fleet", "owner.bot"] } });
    const r = await call("/api/agenten", { body: { name: "Vom Owner", vonSlot: s16 } });
    expect([r.status, r.body.error]).toEqual([201, undefined]);
    expect(((r.body.agent as { wahlen: { rechte?: { recht?: string[] } } }).wahlen.rechte?.recht ?? [])).toContain("owner.bot");
  });
});

describe("die Marke von Hand ändert nichts, was eine Nachfolge liest", () => {
  test("ein schlichter Sitz mit Marke und seine Kontrolle lesen dasselbe, auch ohne den Block FLEET SERVER RIGHTS", async () => {
    const lese = async (name: string, markieren: boolean) => {
      const cwd = ordner(name);
      const slot = await start(name, {});
      if (markieren) expect((await call(`/api/slots/${slot}/rechte`, { body: { grant: ["owner.bot"] } })).status).toBe(200);
      await nachfolge(slot);
      for (let i = 0; i < 80 && zeilen(cwd).length < 2; i++) await Bun.sleep(100);
      const z = zeilen(cwd);
      expect(z.length).toBeGreaterThanOrEqual(2);
      return { erste: z[0]!, letzte: z.at(-1)! };
    };
    const mit = await lese("n-mit", true), ohne = await lese("n-ohne", false);
    const text = (a: string[]) => a.join(" ");
    for (const z of [mit.erste, mit.letzte, ohne.erste, ohne.letzte]) { expect(text(z)).not.toContain("FLEET SERVER RIGHTS"); expect(text(z)).not.toContain("owner.bot"); }
    // dieselben Schalter und derselbe Anhang, bis auf die Pfade und Plätze, die je Sitz anders sind
    const gerippe = (a: string[]) => a.map((x) => x.replace(/n-(mit|ohne)/g, "n-X").replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, "<id>").replace(/\d+/g, "#"));
    expect(gerippe(mit.letzte)).toEqual(gerippe(ohne.letzte));
  });
});

// WAS DIE SETUP-ANSICHT „MITGEGEBEN“ NENNT: eine Zeile „rechte: <Stufe>“ gäbe es nur, wenn der Sitz eine Stufe hat. Die Marke allein ist keine.
describe("ein Sitz, der nur die Marke hält, zeigt nirgends eine Stufe", () => {
  const rechteZeilen = (body: unknown): string[] => {
    const aus: string[] = [];
    const geh = (x: unknown): void => {
      if (typeof x === "string") { for (const z of x.split("\n")) if (/^rechte: /.test(z.trim())) aus.push(z.trim()); }
      else if (Array.isArray(x)) x.forEach(geh);
      else if (x && typeof x === "object") Object.values(x).forEach(geh);
    };
    geh(body);
    return aus;
  };
  // 400 ohne anlass wäre ein leerer Vergleich: jede Antwort muss 200 sein und die Fassung wirklich tragen
  const fassung = async (slot: number, anlass: "laufend" | "nachfolge"): Promise<string[]> => {
    const r = await call(`/api/slots/${slot}/fassung?anlass=${anlass}`);
    expect([r.status, r.body.error]).toEqual([200, undefined]);
    expect(Array.isArray((r.body as { teile?: unknown[] }).teile)).toBe(true);
    return rechteZeilen(r.body);
  };
  const alleAnlaesse = async (slot: number): Promise<string[]> => {
    const aus = [`vor/laufend ${(await fassung(slot, "laufend")).join("|")}`, `vor/nachfolge ${(await fassung(slot, "nachfolge")).join("|")}`];
    const cwd = (persisted(f).slots as Record<string, { cwd: string }>)[String(slot)]!.cwd;
    await nachfolge(slot);
    for (let i = 0; i < 80 && zeilen(cwd).length < 2; i++) await Bun.sleep(100);
    await Bun.sleep(500);
    aus.push(`nach/laufend ${(await fassung(slot, "laufend")).join("|")}`, `nach/nachfolge ${(await fassung(slot, "nachfolge")).join("|")}`);
    return aus;
  };
  test("der Bot aus dem Menü und ein Sitz mit Marke von Hand lesen wie ihre Kontrolle, vor und nach der Nachfolge", async () => {
    const id = await ausVorlage();
    const kopie = (await call(`/api/agenten/${id}/kopie`, { body: { name: "Kopie" } })).body.agent as { id: string };
    const menue = await start("f-menue", { agent: id });
    const kontrolleKopie = await start("f-kopie", { agent: kopie.id });
    const hand = await start("f-hand", {});
    expect((await call(`/api/slots/${hand}/rechte`, { body: { grant: ["owner.bot"] } })).status).toBe(200);
    const schlicht = await start("f-schlicht", {});
    expect(await markiert(menue)).toBe(true);
    expect(await markiert(hand)).toBe(true);
    const sicht = { menue: await alleAnlaesse(menue), kopie: await alleAnlaesse(kontrolleKopie), hand: await alleAnlaesse(hand), schlicht: await alleAnlaesse(schlicht) };
    for (const [wer, zeilen] of Object.entries(sicht)) for (const z of zeilen) expect([wer, z.replace(/^\S+ /, "")]).toEqual([wer, ""]);
  });
  test("ein Sitz mit echter Stufe nennt sie weiter, neben der Marke (der Fühler beißt)", async () => {
    const slot = await start("f-stufe", { rechte: { stufe: "bauen", recht: ["owner.bot"] } });
    expect(await markiert(slot)).toBe(true);
    for (const anlass of ["laufend", "nachfolge"] as const) expect((await fassung(slot, anlass)).join("|")).toContain("rechte: bauen");
  });
});

describe("eine Konstellation aus Sitzen: ein Kind mit der Marke von Hand wird gespeichert wie sein Geschwister", () => {
  test("seine Stelle trägt keine Stufe, wie die des Geschwisters", async () => {
    const lead = await start("k-lead", {});
    // erst die Kinder (ohne Rechte), dann bekommt der Lead sein Recht zu speichern: so liegt in beiden nichts als Null
    const a = await kindVon(lead, "k-kind-a"), b = await kindVon(lead, "k-kind-b");
    expect([a.status, b.status]).toEqual([200, 200]);
    expect((await call(`/api/slots/${lead}/rechte`, { body: { grant: ["setup.save", "setup.export"] } })).status).toBe(200);
    expect((await call(`/api/slots/${a.body.slot}/rechte`, { body: { grant: ["owner.bot"] } })).status).toBe(200);
    expect(await markiert(Number(a.body.slot))).toBe(true);
    const ks = await call("/api/self/konstellationen", { self: token(lead), body: { name: "Team von Hand" } });
    expect([ks.status, ks.body.error]).toEqual([201, undefined]);
    const d = await call(`/api/self/setups/${(ks.body.konstellation as { id: string }).id}/datei`, { self: token(lead) });
    const sitze = (d.body as { datei: { seats: { may: { rechte: unknown } }[] } }).datei.seats;
    expect(sitze.length).toBe(3);
    // die Stelle des Leads trägt sein Recht; die beiden Kinder tragen keins: das mit der Marke wie das ohne
    expect(JSON.stringify(sitze[0]!.may.rechte)).toContain("setup.save");
    expect(sitze.slice(1).map((x) => x.may.rechte ?? null)).toEqual([null, null]);
    expect(JSON.stringify(d.body)).not.toContain("owner.bot");
  });
});
