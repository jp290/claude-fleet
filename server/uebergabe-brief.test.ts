// DER BRIEF DER NACHFOLGERIN, auf einem echten Testserver (Auftrag 3 der frühen Übergabe, Punkte 1 bis 3). Jede Post geht durch die
// Zustellung (getippt in die Pane des Sitzes), nicht durch eine Lese-Tür: der erste Bau stempelte über `GET …?read=1` und verfehlte den
// häufigen Fall, in dem Fleet den Paste nicht beobachten kann (Acceptance „unobservable“, 1535 von 1880 Postfach-Sendungen im Ledger).
// Das Ende der Besetzung stempelt so eine Post als von der Vorgängerin gelesen; ohne weiteres stand sie dann in keiner Liste der Nachfolgerin.
import { afterAll, describe, expect, test } from "bun:test";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { contextWindowFor } from "../src/protocol";
import { branchTestkit, LIFE_DEADLINE_MS, persisted } from "./branches-testkit";

const { BIN, PROJECTS, fixture, serve, cleanup } = branchTestkit();
const SITZ_ORDNER: string[] = [];
afterAll(() => { for (const d of SITZ_ORDNER) rmSync(d, { recursive: true, force: true }); cleanup(); });
// der Ersatz-claude wartet unter dem Namen claude-wartet, sonst hält Fleets Lebensprobe die Pane nicht für einen Agenten (wie schwelle-hinweis.test.ts)
symlinkSync("/bin/sleep", join(BIN, "claude-wartet"));
// Mit der Marke tui.an im BIN malt die Pane ein Eingabefeld (uebergabe-brief-pane.py): Fleet sieht den Paste im Feld, die Zustellung ist „observed“.
// Ohne sie bleibt die Pane stumm, und die Zustellung ist „unobservable“ (der häufige Fall).
copyFileSync(join(import.meta.dir, "uebergabe-brief-pane.py"), join(BIN, "tui.py"));
writeFileSync(join(BIN, "claude"), `#!/bin/sh\necho bereit\nif [ -e "${join(BIN, "tui.an")}" ]; then "${Bun.which("python3")}" "${join(BIN, "tui.py")}" </dev/tty 2>>"${join(BIN, "tui.err")}" &\nfi\nexec "${join(BIN, "claude-wartet")}" 600\n`, { mode: 0o755 });
// ein git, das eine Marke verlangsamen kann: das Lesen des Briefs dauert dann, wie auf einer ausgelasteten Maschine, und zwischen Lesen und Kill ist Zeit
writeFileSync(join(BIN, "git"), `#!/bin/sh\nif [ -e "${join(BIN, "git.langsam")}" ]; then /bin/sleep "$(cat "${join(BIN, "git.langsam")}")"; fi\nexec "${Bun.which("git")}" "$@"\n`, { mode: 0o755 });
const tuiRunden = (slot: number): { datei: string; turns: string[] }[] => readdirSync(BIN).filter((n) => n.startsWith(`tui.${slot}.`) && n.endsWith(".log"))
  .map((datei) => ({ datei, turns: readFileSync(join(BIN, datei), "utf8").split("\n").filter(Boolean) }));

// kurze Takte: das Postfach tippt nach 250 ms, ohne Ruhefenster (die Sperre von 3 s Stille bleibt, sie ist der schmale Rand von Punkt 1)
const FAST = { FLEET_MIGRATE_PCT: "35", FLEET_INBOX_NUDGE_MS: "1000", FLEET_POSTFACH_FENSTER_SEC: "0", FLEET_POSTFACH_MS: "250" };
type Server = Awaited<ReturnType<typeof serve>>;
type Fix = ReturnType<typeof fixture>;
type Row = { cwd?: string; sessionId?: string; selfToken?: string; openedAt?: number };
async function warte<T>(lies: () => T | null | undefined, ms = 12_000): Promise<T | null> {
  for (const bis = Date.now() + ms; Date.now() < bis; await Bun.sleep(100)) { const v = lies(); if (v) return v; }
  return lies() ?? null;
}
async function sitz(srv: Server, f: Fix, slot: number, name: string) {
  const cwd = join(import.meta.dir, "..", `.uebergabe-brief-${process.pid}-${SITZ_ORDNER.length}-${name}`);
  mkdirSync(cwd, { recursive: true });
  SITZ_ORDNER.push(cwd);
  expect((await srv.call(`/api/slots/${slot}/open`, { body: { cwd, label: name } })).status).toBe(200);
  const row = await warte(() => {
    const r = ((persisted(f).slots ?? {}) as Record<string, Row>)[String(slot)];
    return r?.cwd === cwd && r.sessionId && r.selfToken ? { slot, cwd, token: r.selfToken, openedAt: r.openedAt! } : null;
  });
  if (!row) throw new Error(`Sitz ${name} hat keinen Self-Token`);
  return row;
}
const verlauf = (f: Fix, slot: number): string[] => {
  const p = join(f.state, "streams", `s${slot}.history.json`);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as { text: string; source?: string }[]).filter((h) => h.source === "fleet").map((h) => h.text) : [];
};
const slotRow = (f: Fix, slot: number) => ((persisted(f).slots ?? {}) as Record<string, Row>)[String(slot)]!;
const S = (n: number) => ({ kind: "session", slot: n });
const post = (srv: Server, token: string, to: unknown, key: string, text: string) =>
  srv.call("/api/self/messages", { self: token, body: { to, payload: { kind: "text", text }, idempotencyKey: key } });
const ungelesen = async (srv: Server, token: string): Promise<string[]> =>
  ((await srv.call("/api/self/messages?unread=1", { self: token })).body.entries as { id: string }[]).map((e) => e.id);
// der Brief der Nachfolge, wie ihn die Nachfolgerin liest: gelesen aus den Schulden der Nachfolge (GET /api/succession-debts). Der Ersatz-claude der Testpane
// zeigt kein Bereit-Zeichen, die Antwort ist darum 500 mit einer Schuld; der Brief der Schuld ist der, den die Pane bekäme (die Seite von Punkt 2 vorher: dieselbe Rampe)
async function nachfolge(srv: Server, token: string, body: unknown = {}) {
  const n = await srv.call("/api/self/succeed", { self: token, body });
  const d = await srv.call("/api/succession-debts");
  const brief = ((d.body.debts ?? []) as { id: string; brief?: string }[]).find((x) => x.id === n.body.debt)?.brief ?? "";
  expect(n.body.debt).toBeDefined();
  return { status: n.status, brief };
}
const mailZeilen = (brief: string): string[] => brief.split("\n").filter((l) => /^- [0-9a-f]{24} /.test(l));

describe("Post, die spät in die Pane kam, geht der Nachfolgerin nicht verloren", () => {
  // Punkt 1: getippte Post nach der Übergabe, Paste nicht beobachtet; dann die Nachfolge
  test("eine nach der Übergabe getippte, unbeobachtete Post steht im Brief der Nachfolgerin und danach in ihrer Liste", async () => {
    const f = fixture();
    const srv = await serve(f, FAST);
    try {
      const a = await sitz(srv, f, 1, "a"), b = await sitz(srv, f, 2, "b");
      expect((await srv.call("/api/self/handover", { self: a.token, body: { intent: "Nichts offen" } })).status).toBe(200);
      const m = await post(srv, b.token, S(1), "spaet-1", "SPAETER-AUFTRAG stoppe den Lauf");
      const id = (m.body.message as { id: string }).id;
      expect(await warte(() => verlauf(f, 1).find((t) => t.includes("SPAETER-AUFTRAG")))).not.toBeNull();
      // getippt, aber nicht quittiert: in der Liste der Vorgängerin steht sie noch
      expect(await ungelesen(srv, a.token)).toContain(id);
      const r = await nachfolge(srv, a.token);
      expect(mailZeilen(r.brief).find((l) => l.startsWith(`- ${id}`))).toContain("SPAETER-AUFTRAG");
      // …und die Nachfolgerin findet sie auch ohne den Brief, gelesen von der beendeten Besetzung
      const tok2 = await warte(() => { const t = slotRow(f, 1).selfToken; return t && t !== a.token ? t : null; });
      const alle = ((await srv.call("/api/self/messages", { self: tok2! })).body.entries as { id: string }[]).map((e) => e.id);
      expect(alle).toContain(id);
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 3);

  // Punkt 1, zweiter Satz: getippt zwischen dem Lesen des Briefs und dem Kill. Die Besitzer-Tür parkt vor dem Kill (kill:<slot>), der Brief ist da gelesen.
  test("eine Post, die zwischen dem Lesen des Briefs und dem Kill in die Pane kommt, bleibt ungelesen und kommt zur Nachfolgerin", async () => {
    const f = fixture();
    const riegel = join(f.state, "riegel");
    const srv = await serve(f, { ...FAST, FLEET_TEST_KEEP_CACHE_LATCH: riegel });
    try {
      const a = await sitz(srv, f, 1, "a"), b = await sitz(srv, f, 2, "b");
      expect((await srv.call("/api/self/handover", { self: a.token, body: { intent: "Nichts offen" } })).status).toBe(200);
      writeFileSync(riegel, "kill:1");
      const nachfolgeP = srv.call("/api/slots/1/succeed", { body: { expectedOpenedAt: a.openedAt } });
      expect(await warte(() => existsSync(`${riegel}.reached`) ? true : null)).toBe(true);
      const m = await post(srv, b.token, S(1), "zwischen-1", "ZWISCHEN-AUFTRAG nach dem Brief");
      const id = (m.body.message as { id: string }).id;
      expect(await warte(() => verlauf(f, 1).find((t) => t.includes("ZWISCHEN-AUFTRAG")))).not.toBeNull();
      writeFileSync(`${riegel}.release`, "");
      await nachfolgeP;
      const tok2 = await warte(() => { const t = slotRow(f, 1).selfToken; return t && t !== a.token ? t : null; });
      expect(await ungelesen(srv, tok2!)).toContain(id);
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 3);

  // Punkt 1, Gegenprobe: was VOR der stehenden Übergabe getippt wurde, hat die Vorgängerin gesehen; es bleibt wie bisher von ihr gelesen
  test("eine vor der Übergabe getippte Post wird der Nachfolgerin nicht noch einmal vorgelegt", async () => {
    const f = fixture();
    const srv = await serve(f, FAST);
    try {
      const a = await sitz(srv, f, 1, "a"), b = await sitz(srv, f, 2, "b");
      const m = await post(srv, b.token, S(1), "frueh-1", "FRUEHER-AUFTRAG");
      const id = (m.body.message as { id: string }).id;
      expect(await warte(() => verlauf(f, 1).find((t) => t.includes("FRUEHER-AUFTRAG")))).not.toBeNull();
      await Bun.sleep(50);
      expect((await srv.call("/api/self/handover", { self: a.token, body: { intent: "Nichts offen" } })).status).toBe(200);
      const r = await nachfolge(srv, a.token);
      expect(r.brief).not.toContain(id);
      const tok2 = await warte(() => { const t = slotRow(f, 1).selfToken; return t && t !== a.token ? t : null; });
      await Bun.sleep(1500);
      expect(await ungelesen(srv, tok2!)).not.toContain(id);
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 3);
});

// Auftrag 4, Punkte 1 bis 3: die drei Nähte der dritten Prüfung. Jede Post geht durch die Zustellung in die Pane.
describe("Post in der Lücke zwischen Brief und Kill, das Fenster und die abgelehnte Besitzer-Nachfolge", () => {
  const alsMarke = (an: boolean) => { const p = join(BIN, "tui.an"); if (an) writeFileSync(p, ""); else rmSync(p, { force: true }); };
  const stand = (f: Fix) => { const p = persisted(f) as { messages?: { entries?: { id: string; readBy: { slot: number; openedAt: number } | null }[] } | { id: string; readBy: { slot: number; openedAt: number } | null }[] };
    return (Array.isArray(p.messages) ? p.messages : p.messages?.entries ?? []); };
  const eintrag = (f: Fix, id: string) => stand(f).find((e) => e.id === id);

  // Punkt 1: der Paste wurde beobachtet (das Eingabefeld zeigt ihn), das Lesen des Briefs war schon vorbei. Die Quittung stempelte ihn als von der Vorgängerin gelesen,
  // und er stand in keiner Zeile des Briefs und in keiner Liste der Nachfolgerin. Mutant: `holdReceiptDuringBrief` gibt false zurück → rot (0 Mal getippt, gelesen von der Vorgängerin).
  test("eine beobachtete Post, die nach dem Lesen des Briefs in die Pane kommt, bekommt die Nachfolgerin, einmal", async () => {
    alsMarke(true);
    for (const n of tuiRunden(1)) rmSync(join(BIN, n.datei), { force: true });
    const f = fixture();
    const srv = await serve(f, FAST);
    try {
      const a = await sitz(srv, f, 1, "a"), b = await sitz(srv, f, 2, "b");
      expect((await srv.call("/api/self/handover", { self: a.token, body: { intent: "Nichts offen" } })).status).toBe(200);
      await Bun.sleep(4_000); // die Pane war drei Sekunden still: das Postfach darf tippen
      writeFileSync(join(BIN, "git.langsam"), "4");
      const nachfolgeP = srv.call("/api/self/succeed", { self: a.token, body: {} });
      await Bun.sleep(300);
      const id = ((await post(srv, b.token, S(1), "luecke-1", "LUECKEN-AUFTRAG beobachtet")).body.message as { id: string }).id;
      const erste = await warte(() => tuiRunden(1).flatMap((r) => r.turns).find((t) => t.includes("LUECKEN-AUFTRAG")) ?? null, 8_000);
      rmSync(join(BIN, "git.langsam"), { force: true });
      expect(erste).not.toBeNull(); // in die Pane der Vorgängerin getippt, mitten in der Lücke
      const vorgaengerinnen = tuiRunden(1).map((r) => r.datei);
      await nachfolgeP;
      const tok2 = await warte(() => { const t = slotRow(f, 1).selfToken; return t && t !== a.token ? t : null; });
      expect(tok2).not.toBeNull();
      const nachfolgerin = () => tuiRunden(1).filter((r) => !vorgaengerinnen.includes(r.datei)).flatMap((r) => r.turns);
      // sie bekommt die Post: getippt in ihre Pane, einmal. Die Vorgängerin hatte sie schon (dieselbe Post, zweiter Ort)
      expect(await warte(() => nachfolgerin().filter((t) => t.includes("LUECKEN-AUFTRAG")).length || null, 20_000)).toBe(1);
      await Bun.sleep(3_000);
      expect(nachfolgerin().filter((t) => t.includes("LUECKEN-AUFTRAG")).length).toBe(1);
      expect(tuiRunden(1).filter((r) => vorgaengerinnen.includes(r.datei)).flatMap((r) => r.turns).filter((t) => t.includes("LUECKEN-AUFTRAG")).length).toBe(1);
      expect(eintrag(f, id)?.readBy?.openedAt).not.toBe(a.openedAt); // gelesen von ihr, nicht von der Vorgängerin
    } finally { rmSync(join(BIN, "git.langsam"), { force: true }); alsMarke(false); await srv.stop(); }
  }, LIFE_DEADLINE_MS * 4);

  // Punkt 1, Gegenseite: lehnt die Besitzer-Tür vor dem Kill ab, bleibt die Vorgängerin stehen. Was ihre Pane in der Zwischenzeit annahm, ist dann gelesen wie ohne Marke.
  test("lehnt die Besitzer-Tür vor dem Kill ab, ist die in der Lücke beobachtete Post gelesen, nicht liegen geblieben", async () => {
    alsMarke(true);
    const f = fixture();
    const riegel = join(f.state, "riegel");
    const srv = await serve(f, { ...FAST, FLEET_TEST_KEEP_CACHE_LATCH: riegel });
    try {
      const a = await sitz(srv, f, 1, "a"), b = await sitz(srv, f, 2, "b");
      expect((await srv.call("/api/self/handover", { self: a.token, body: { intent: "Nichts offen" } })).status).toBe(200);
      await Bun.sleep(4_000);
      writeFileSync(riegel, "kill:1");
      const nachfolgeP = srv.call("/api/slots/1/succeed", { body: { expectedOpenedAt: a.openedAt } });
      expect(await warte(() => existsSync(`${riegel}.reached`) ? true : null)).toBe(true);
      const id = ((await post(srv, b.token, S(1), "luecke-2", "ABGELEHNT-AUFTRAG beobachtet")).body.message as { id: string }).id;
      expect(await warte(() => tuiRunden(1).flatMap((r) => r.turns).find((t) => t.includes("ABGELEHNT-AUFTRAG")) ?? null, 15_000)).not.toBeNull();
      await srv.call("/api/self/handover", { self: a.token, body: { intent: "geändert, während gebaut wurde" } }); // die letzte Frage der Tür sieht es und lehnt ab
      writeFileSync(`${riegel}.release`, "");
      expect((await nachfolgeP).status).toBe(409);
      expect(await warte(() => eintrag(f, id)?.readBy ?? null, 8_000)).toMatchObject({ slot: 1, openedAt: a.openedAt });
    } finally { alsMarke(false); await srv.stop(); }
  }, LIFE_DEADLINE_MS * 4);

  // Punkt 3: die Marke bleibt nach der Ablehnung fünf Minuten stehen; die Post, die danach in die Pane kam, blieb ungelesen, obwohl die Pane sie hatte und niemand sie las.
  // Mutant: `dropBriefMark` vor dem Rückgabewert von beforeKill weg → rot (readBy bleibt null).
  test("eine abgelehnte Besitzer-Nachfolge lässt keine Marke: Post danach gilt am Ende der Besetzung als von ihr gelesen", async () => {
    alsMarke(false);
    const f = fixture();
    const riegel = join(f.state, "riegel");
    const srv = await serve(f, { ...FAST, FLEET_TEST_KEEP_CACHE_LATCH: riegel });
    try {
      const a = await sitz(srv, f, 1, "a"), b = await sitz(srv, f, 2, "b");
      expect((await srv.call("/api/self/handover", { self: a.token, body: { intent: "Nichts offen" } })).status).toBe(200);
      writeFileSync(riegel, "kill:1");
      const nachfolgeP = srv.call("/api/slots/1/succeed", { body: { expectedOpenedAt: a.openedAt } });
      expect(await warte(() => existsSync(`${riegel}.reached`) ? true : null)).toBe(true);
      await srv.call("/api/self/handover", { self: a.token, body: { intent: "geändert, während gebaut wurde" } });
      writeFileSync(`${riegel}.release`, "");
      expect((await nachfolgeP).status).toBe(409);
      const id = ((await post(srv, b.token, S(1), "stale-1", "NACH-ABLEHNUNG-AUFTRAG")).body.message as { id: string }).id;
      expect(await warte(() => verlauf(f, 1).find((t) => t.includes("NACH-ABLEHNUNG-AUFTRAG")))).not.toBeNull();
      expect((await srv.call("/api/slots/1/kill", { body: {} })).status).toBe(200);
      expect(await warte(() => eintrag(f, id)?.readBy ?? null, 8_000)).toMatchObject({ slot: 1, openedAt: a.openedAt });
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 4);

  // Punkt 2: die stehende Übergabe ist älter als die Post, die Post älter als das Fenster, und der Body nennt einen Kanal. Das Fenster ist für den Test auf 2 s gekürzt.
  // Mutant: `standingAt` wieder `standing?.at` (null, sobald der Body einen Kanal nennt) → rot für `intent` und für `carry`.
  for (const [wie, body] of [["intent", { intent: "Nichts offen, neue Worte im Body" }], ["carry", { carry: "Nichts offen, ein Satz für die Nachfolgerin" }]] as const) {
    test(`die stehende Übergabe bleibt der Bezug der Post, auch wenn der Body einen Kanal nennt (${wie}), und die Post außerhalb des Fensters hat ihre Zeile`, async () => {
      alsMarke(false);
      const f = fixture();
      const srv = await serve(f, { ...FAST, FLEET_TEST_BRIEF_MAIL_WINDOW_MS: "2000" });
      try {
        const a = await sitz(srv, f, 1, "a"), b = await sitz(srv, f, 2, "b");
        expect((await srv.call("/api/self/handover", { self: a.token, body: { intent: "alter Stand" } })).status).toBe(200);
        const id = ((await post(srv, b.token, S(1), `fenster-${wie}`, `AELTERER-AUFTRAG-${wie}`)).body.message as { id: string }).id;
        expect(await warte(() => verlauf(f, 1).find((t) => t.includes(`AELTERER-AUFTRAG-${wie}`)))).not.toBeNull();
        await Bun.sleep(3_000); // die Post ist jetzt älter als das Fenster von 2 s, aber jünger als die stehende Übergabe: nur diese Übergabe als Bezug führt sie auf
        const r = await nachfolge(srv, a.token, body);
        expect(mailZeilen(r.brief).find((l) => l.startsWith(`- ${id}`))).toContain(`AELTERER-AUFTRAG-${wie}`);
        expect(r.brief).toContain("Nach ihrer stehenden Übergabe von");
      } finally { await srv.stop(); }
    }, LIFE_DEADLINE_MS * 3);
  }
});

describe("der Brief sagt, was er weiß, und lässt nichts aus, was die Übergabe nannte", () => {
  // Punkt 2: eine alte stehende Übergabe; die Post danach hat die Vorgängerin gelesen und vielleicht erledigt
  test("Post, die die Vorgängerin nach einer alten stehenden Übergabe las, steht als gelesen mit offenem Ausgang, nicht als „nach der Übergabe angekommen“", async () => {
    const f = fixture();
    const srv = await serve(f, FAST);
    try {
      const a = await sitz(srv, f, 1, "a"), b = await sitz(srv, f, 2, "b");
      await srv.call("/api/self/handover", { self: a.token, body: { intent: "alter Stand" } });
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        ids.push(((await post(srv, b.token, S(1), `alt-${i}`, `ERLEDIGT-${i}`)).body.message as { id: string }).id);
        await srv.call("/api/self/messages?unread=1&read=1", { self: a.token });
      }
      const r = await nachfolge(srv, a.token);
      expect(r.brief).not.toContain("kam noch an");
      expect(r.brief).toContain("Ob sie erledigt ist, ist nicht bekannt");
      expect(r.brief).toContain("prüfe am Stand, bevor du etwas wiederholst");
      expect(mailZeilen(r.brief).map((l) => l.slice(2, 26)).sort()).toEqual([...ids].sort());
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 3);

  // Punkt 2: der Deckel lässt eine genannte Kennung nie fallen und sagt, wie viel er ausließ und wo es steht
  test("eine Kennung, die die Übergabe nennt, hat immer eine Zeile, und der Deckel sagt, wie viele er ausließ und wo sie stehen", async () => {
    const f = fixture();
    const srv = await serve(f, FAST);
    try {
      const a = await sitz(srv, f, 1, "a"), b = await sitz(srv, f, 2, "b");
      const genannt = ((await post(srv, b.token, S(1), "genannt", "GENANNTER-AUFTRAG")).body.message as { id: string }).id;
      await srv.call("/api/self/messages?unread=1&read=1", { self: a.token });
      await Bun.sleep(20);
      await srv.call("/api/self/handover", { self: a.token, body: { intent: `siehe ${genannt}` } });
      for (let i = 0; i < 8; i++) {
        await post(srv, b.token, S(1), `rauschen-${i}`, `RAUSCHEN-${i}`);
        await srv.call("/api/self/messages?unread=1&read=1", { self: a.token });
        await Bun.sleep(20);
      }
      const r = await nachfolge(srv, a.token);
      expect(mailZeilen(r.brief).some((l) => l.startsWith(`- ${genannt} `))).toBe(true);
      // 8 später gelesene: fünf Zeilen, drei ausgelassen, mit dem Ort
      expect(mailZeilen(r.brief).filter((l) => l.includes("RAUSCHEN"))).toHaveLength(5);
      expect(r.brief).toContain("… und 3 weitere ließ ich hier aus");
      expect(r.brief).toContain("GET $FLEET_SELF_URL/api/self/messages");
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 3);

  // Punkt 2, letzter Satz: `succeed` mit `intent` im Body hat keine stehende Übergabe und bekommt dieselbe Behandlung
  test("das Succeed mit `intent` im Body nennt die kurz zuvor gelesene Post ebenso, mit dem Zeitfenster statt der stehenden Übergabe", async () => {
    const f = fixture();
    const srv = await serve(f, FAST);
    try {
      const a = await sitz(srv, f, 1, "a"), b = await sitz(srv, f, 2, "b");
      const id = ((await post(srv, b.token, S(1), "einstufig", "EINSTUFIGER-AUFTRAG")).body.message as { id: string }).id;
      await srv.call("/api/self/messages?unread=1&read=1", { self: a.token });
      const r = await nachfolge(srv, a.token, { intent: "Nichts offen" });
      expect(mailZeilen(r.brief).find((l) => l.startsWith(`- ${id}`))).toContain("EINSTUFIGER-AUFTRAG");
      expect(r.brief).toContain("In den letzten 10 Minuten vor ihrer Übergabe hat sie diese Post gelesen oder in ihre Pane getippt bekommen");
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 3);
});

describe("der erste Schritt der Nachfolgerin hat eine Adresse", () => {
  // Punkt 3: ein echter Brief ohne jede Post-Zeile gibt trotzdem die Tür
  test("jeder Brief gibt $FLEET_SELF_URL und den Header, auch ohne Post-Zeilen", async () => {
    const f = fixture();
    const srv = await serve(f, FAST);
    try {
      const a = await sitz(srv, f, 1, "a");
      await srv.call("/api/self/handover", { self: a.token, body: { intent: "Nichts offen" } });
      const r = await nachfolge(srv, a.token);
      expect(mailZeilen(r.brief)).toEqual([]);
      expect(r.brief).toContain("$FLEET_SELF_URL");
      expect(r.brief).toContain("x-fleet-self-token: $FLEET_SELF_TOKEN");
      // der Schritt 1 nennt die Adresse selbst, nicht nur die Tür oben
      expect(r.brief).toMatch(/1\. Lies GET \$FLEET_SELF_URL\/api\/self/);
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 3);
});

// Auftrag 3, Punkt 4: ein Bauer auf Basis 30 konnte bei 25 %, 30 % und 35 % gefragt werden. Wer die Zeile bekam, bekommt den Hinweis an der Basis nicht
// zusätzlich; der Hinweis am fälligen Schritt (Obergrenze) bleibt.
const MODELL = "claude-opus-5-5";
function gespraech(cwd: string, sessionId: string, anteil: number): void {
  const fenster = contextWindowFor(MODELL)!;
  const dir = join(PROJECTS, cwd.replace(/[^a-zA-Z0-9]/g, "-"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${sessionId}.jsonl`), `${JSON.stringify({ type: "assistant", timestamp: new Date(Date.now() - 60_000).toISOString(),
    message: { model: MODELL, content: [{ type: "text", text: "Schritt fertig." }], usage: { input_tokens: Math.round(fenster * anteil),
      cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: { ephemeral_1h_input_tokens: 1 } } } })}\n`);
}
const auditZeilen = (f: Fix, slot: number, event: string): string[] => {
  const p = join(f.state, "audit.jsonl");
  return existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as { event: string; slot?: number; detail?: string })
    .filter((x) => x.event === event && x.slot === slot).map((x) => String(x.detail)) : [];
};
describe("wer die Zeile bekam, wird an der Basis nicht noch einmal gefragt", () => {
  test("Basis 30: Zeile bei 27 %, kein Hinweis bei 31 %, der Hinweis am fälligen Schritt (36 %, Obergrenze 35) kommt", async () => {
    const f = fixture();
    const srv = await serve(f, { ...FAST, FLEET_MIGRATE_PCT: "30", FLEET_TEST_MIGRATE_TICK_MS: "300" });
    try {
      const a = await sitz(srv, f, 1, "a"), b = await sitz(srv, f, 2, "b");
      const sessionId = slotRow(f, 1).sessionId!;
      gespraech(a.cwd, sessionId, 0.27);
      await post(srv, b.token, S(1), "grenze-1", "ein Auftrag von einem Sitz");
      // die Zeile steht im Kopf der Zustellung; gebucht wird sie im Audit (server.ts#zwischenZeileBuchen)
      expect(await warte(() => auditZeilen(f, 1, "between_orders_line")[0] ?? null, 15_000)).toContain(`session=${sessionId} path=postfach`);
      expect(auditZeilen(f, 1, "between_orders_line")).toHaveLength(1);
      // 31 %: über der Basis 30, unter der Obergrenze 35. Der Takt läuft alle 300 ms; vier Sekunden ohne Hinweis
      gespraech(a.cwd, sessionId, 0.31);
      await Bun.sleep(4_000);
      expect(auditZeilen(f, 1, "migrate_gave_up")).toEqual([]);
      // 36 %: der fällige Schritt. Hier kommt der Hinweis, einmal
      gespraech(a.cwd, sessionId, 0.36);
      expect(await warte(() => auditZeilen(f, 1, "migrate_gave_up")[0] ?? null, 15_000)).toBe(`gave up session=${sessionId} after 1 delivered nudges`);
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 4);
  test("Gegenprobe: ohne die Zeile (Post vom Owner) kommt der Hinweis an der Basis wie bisher", async () => {
    const f = fixture();
    const srv = await serve(f, { ...FAST, FLEET_MIGRATE_PCT: "30", FLEET_TEST_MIGRATE_TICK_MS: "300" });
    try {
      const a = await sitz(srv, f, 1, "a");
      const sessionId = slotRow(f, 1).sessionId!;
      gespraech(a.cwd, sessionId, 0.31);
      expect(await warte(() => auditZeilen(f, 1, "migrate_gave_up")[0] ?? null, 15_000)).toBe(`gave up session=${sessionId} after 1 delivered nudges`);
    } finally { await srv.stop(); }
  }, LIFE_DEADLINE_MS * 3);
});
