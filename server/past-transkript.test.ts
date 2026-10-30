// GET /api/slots/:id/succession/:n/transcript — der wahre Grund einer fehlenden Datei.
// Die Chat-Ansicht einer Vorgänger-Station sagte pauschal „no longer on disk", sobald eine
// zugeordnete Besetzung keine Datei hergab — auch wenn nichts gelöscht worden war: pi schreibt
// seine Sessiondatei erst, sobald die Session eine User- oder Assistant-Nachricht hat (pis
// SessionManager._persist: „opening and closing pi without chatting leaves no file behind"), also
// hinterlässt eine Besetzung, die vor ihrem ersten Turn stirbt (Heilung startet neu), gar keine.
// Dieser Test fährt eine pi-zai-Linie mit drei Vorgängerinnen auseinander: eine mit Datei auf
// Disk (das Transkript erscheint), eine deren Datei nach dem Lesen gelöscht wird (gelöscht —
// auch über einen Server-Neustart hinweg, denn das Journal transcripts-seen.jsonl im Zustands-
// ordner hält die gelesene Tatsache fest), und eine ohne jede Datei (nie geschrieben).
// Die Pauschalzeile darf dabei nirgends als Grund ohne Löschung auftauchen.
import { describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { branchTestkit } from "./branches-testkit";

const { TMP, fixture, life, cleanup } = branchTestkit();
const AGENT = join(TMP, "pi-zai-agent");
// jedes Leben derselbe Agent-Ordner: pi-zai liest Sessions ausschließlich daraus (PI_CODING_AGENT_DIR)
const extra = { FLEET_PI_ZAI_AGENT_DIR: AGENT };

// pis Dateiformat (docs des Anbieters, session-format): Kopfzeile mit id UND cwd, dann Baum-Einträge
const piZeilen = (sid: string, cwd: string): string[] => {
  const jetzt = new Date().toISOString();
  return [
    JSON.stringify({ type: "session", version: 3, id: sid, timestamp: jetzt, cwd }),
    JSON.stringify({ type: "message", id: "m1", parentId: null, timestamp: jetzt,
      message: { role: "user", content: "was hat die Vorgängerin gesagt?", timestamp: Date.now() } }),
    JSON.stringify({ type: "message", id: "m2", parentId: "m1", timestamp: jetzt,
      message: { role: "assistant", content: [{ type: "text", text: "die gepflanzte Antwort" }], timestamp: Date.now() } }),
  ];
};
const piDatei = (repo: string, sid: string): string => {
  const verzeichnis = join(AGENT, "sessions", `--${repo.replace(/^\/+/, "").replaceAll("/", "-")}--`);
  mkdirSync(verzeichnis, { recursive: true });
  const datei = join(verzeichnis, `${new Date().toISOString().replace(/[:.]/g, "-")}_${sid}.jsonl`);
  writeFileSync(datei, piZeilen(sid, repo).join("\n") + "\n");
  return datei;
};

// die Start-Historie hält je Besetzung den Harness, mit dem sie startete (server/start-historie.ts)
const startZeile = (slot: number, openedAt: number, cwd: string, harness: string): string =>
  `${JSON.stringify({ art: "start", slot, openedAt, at: openedAt, cwd, harness })}\n`;

describe("die Vorgänger-Station nennt den wahren Grund einer fehlenden Transkriptdatei", () => {
  test("pi-zai: vorhandene Datei zeigt das Transkript, gelöschte heißt gelöscht, nie geschriebene nie geschrieben", async () => {
    const f = fixture();
    // Leben 1: der Slot öffnet als pi-zai — nur dann liest die Route über den pi-Adapter
    const [open] = await life(f, [{ method: "POST", path: "/api/slots/1/open", body: { cwd: f.repo, harness: "pi-zai" } }], extra);
    expect(open.status).toBe(200);

    // die Linie pflanzen: drei Vorgängerinnen (A älteste … C jüngste) vor der laufenden Besetzung
    const staat = JSON.parse(readFileSync(join(f.state, "fleet.json"), "utf8")) as {
      slots: Record<string, Record<string, unknown>>; lineageHandovers?: unknown[] };
    expect(staat.slots["1"]?.harness).toBe("pi-zai");
    const t4 = staat.slots["1"]!.openedAt as number;
    const sidA = crypto.randomUUID(), sidB = crypto.randomUUID(), sidC = crypto.randomUUID(), sidD = crypto.randomUUID();
    const stunde = 3_600_000;
    const t0 = t4 - 4 * stunde, t1 = t4 - 3 * stunde, t2 = t4 - 2 * stunde, t3 = t4 - stunde;
    const linie = "7a1".padEnd(24, "0");
    staat.slots["1"]!.lineageId = linie;
    const satz = (von: { openedAt: number; sessionId: string }, zu: number) => ({
      v: 1, lineageId: linie, role: "generic", at: zu,
      from: { slot: 1, openedAt: von.openedAt, sessionId: von.sessionId, cwd: f.repo },
      to: { slot: 1, openedAt: zu }, obligations: [], intent: "past-transkript probe", pointer: null, supersededBy: null });
    staat.lineageHandovers = [...(staat.lineageHandovers ?? []),
      satz({ openedAt: t0, sessionId: sidD }, t1), satz({ openedAt: t1, sessionId: sidA }, t2), satz({ openedAt: t2, sessionId: sidB }, t3), satz({ openedAt: t3, sessionId: sidC }, t4)];
    writeFileSync(join(f.state, "fleet.json"), JSON.stringify(staat, null, 2), { mode: 0o600 });

    // Das Journal begann zwischen D und A: D ist älter als es (seine Datei konnte es nie sehen), A bis C jünger.
    writeFileSync(join(f.state, "transcripts-seen.jsonl"), `${JSON.stringify({ since: t0 + stunde / 2 })}\n`);

    writeFileSync(join(f.state, "start-historie.jsonl"),
      [t0, t1, t2, t3].map((t) => startZeile(1, t, f.repo, "pi-zai")).join(""));

    // Dateien: A und B liegen, C nie — C ist der Fall der ersten Besetzung vom 27.10.; D hat auch keine,
    // aber D lebte vor dem Journal: ob ihre Datei je da war, weiß niemand.
    piDatei(f.repo, sidA);
    const dateiB = piDatei(f.repo, sidB);

    type Past = { assigned?: boolean; source?: string | null; absent?: string; reason?: string;
      entries?: { role: string }[]; error?: string };
    const Vergangenheit = async (n: number, antworten: { status: number; body: Record<string, unknown> }[]) =>
      antworten[n - 1]?.body as Past;

    // Leben 2: A und B werden gelesen (das Journal merkt sich beide), C hat nie eine Datei; die Antworten stehen in der Reihenfolge A, B, C, D
    const leben2 = await life(f, [
      { method: "GET", path: "/api/slots/1/succession/2/transcript" },
      { method: "GET", path: "/api/slots/1/succession/3/transcript" },
      { method: "GET", path: "/api/slots/1/succession/4/transcript" },
      { method: "GET", path: "/api/slots/1/succession/1/transcript" },
    ], extra);
    // Stationen von alt nach jung: 1 = D, 2 = A, 3 = B, 4 = C (die Anfragen oben gehen A, B, C, D)
    const a = await Vergangenheit(1, leben2), b = await Vergangenheit(2, leben2), c = await Vergangenheit(3, leben2),
      d = await Vergangenheit(4, leben2);
    // A: die Datei da — das Transkript erscheint, ohne Grundzeile
    expect(leben2[0]!.status).toBe(200);
    expect(a.assigned).toBe(true);
    expect(a.source).toContain(sidA);
    expect((a.entries ?? []).map((e) => e.role)).toEqual(["user", "assistant"]);
    expect(a.absent).toBeUndefined();
    expect(a.reason).toBeUndefined();
    // B: noch da, gleichermaßen
    expect(b.assigned).toBe(true);
    expect(b.source).toContain(sidB);
    // C: nie eine Datei — der Grund heißt es, und er behauptet keine Löschung
    expect(c.assigned).toBe(true);
    expect(c.source).toBeNull();
    expect(c.absent).toBe("never-written");
    expect(c.reason).toContain("never wrote a session file");
    expect(c.reason ?? "").not.toContain("no longer on disk");

    // D: lebte vor dem Journal und hat keine Datei — der Grund sagt weder „gelöscht" noch „nie geschrieben"
    expect(d.assigned).toBe(true);
    expect(d.source).toBeNull();
    expect(d.absent).toBe("unknown");
    expect(d.reason ?? "").not.toContain("never wrote a session file");
    expect(d.reason ?? "").not.toContain("no longer on disk");

    // das Journal hält fest, was gelesen wurde — der Neustart eines Lebens darf die Aussage nicht kippen
    const journal = readFileSync(join(f.state, "transcripts-seen.jsonl"), "utf8");
    expect(journal).toContain(sidA);
    expect(journal).toContain(sidB);
    expect(journal).not.toContain(sidC);
    expect(journal).not.toContain(sidD);

    // zwischen den Leben: Bs Datei verschwindet (die Löschung, die die alte Zeile immer behauptete)
    rmSync(dateiB, { force: true });
    expect(existsSync(dateiB)).toBe(false);

    // Leben 3 — ein NEUER Serverprozess: B heißt gelöscht (Journal schlägt Nichtwissen), A bleibt
    // lesbar, C bleibt nie geschrieben
    const leben3 = await life(f, [
      { method: "GET", path: "/api/slots/1/succession/3/transcript" },
      { method: "GET", path: "/api/slots/1/succession/2/transcript" },
      { method: "GET", path: "/api/slots/1/succession/4/transcript" },
      { method: "GET", path: "/api/slots/1/succession/1/transcript" },
    ], extra);
    const b2 = await Vergangenheit(1, leben3), a2 = await Vergangenheit(2, leben3), c2 = await Vergangenheit(3, leben3),
      d2 = await Vergangenheit(4, leben3);
    expect(leben3[0]!.status).toBe(200);
    expect(b2.assigned).toBe(true);
    expect(b2.source).toBeNull();
    expect(b2.absent).toBe("deleted");
    expect(b2.reason).toContain("no longer on disk");
    expect(a2.source).toContain(sidA);
    expect((a2.entries ?? []).length).toBe(2);
    expect(c2.absent).toBe("never-written");
    expect(c2.reason).toContain("never wrote a session file");
    expect(d2.absent).toBe("unknown");
  }, 90_000);
  // Nur der Sessions-Poll liest die Datei einer laufenden pi-Besetzung (server.ts#contextReading); öffnet sie nie jemand im
  // Chat und verschwindet die Datei, hat Fleet sie trotzdem gesehen — „nie geschrieben" wäre dann gelogen.
  test("pi-zai: eine Datei, die nur der Sessions-Poll las und die dann verschwand, heißt gelöscht", async () => {
    const f = fixture();
    const [open] = await life(f, [{ method: "POST", path: "/api/slots/1/open", body: { cwd: f.repo, harness: "pi-zai" } }], extra);
    expect(open.status).toBe(200);
    const staat = JSON.parse(readFileSync(join(f.state, "fleet.json"), "utf8")) as {
      slots: Record<string, Record<string, unknown>>; lineageHandovers?: unknown[] };
    const t2 = staat.slots["1"]!.openedAt as number, t1 = t2 - 3_600_000;
    const sid = crypto.randomUUID();
    const linie = "7a2".padEnd(24, "0");
    // die laufende Besetzung trägt die Session; ihre Datei liegt
    staat.slots["1"]!.lineageId = linie;
    staat.slots["1"]!.sessionId = sid;
    staat.lineageHandovers = [...(staat.lineageHandovers ?? []), { v: 1, lineageId: linie, role: "generic", at: t2,
      from: { slot: 1, openedAt: t1, sessionId: sid, cwd: f.repo }, to: { slot: 1, openedAt: t2 }, obligations: [],
      intent: "poll-only probe", pointer: null, supersededBy: null }];
    writeFileSync(join(f.state, "fleet.json"), JSON.stringify(staat, null, 2), { mode: 0o600 });
    writeFileSync(join(f.state, "transcripts-seen.jsonl"), `${JSON.stringify({ since: t1 - 60_000 })}\n`);
    writeFileSync(join(f.state, "start-historie.jsonl"), startZeile(1, t1, f.repo, "pi-zai"));
    const datei = piDatei(f.repo, sid);

    // Leben 2: nur der Poll (GET /api/sessions) — kein Chat, keine Vergangenheit
    const [poll] = await life(f, [{ method: "GET", path: "/api/sessions" }], extra);
    expect(poll.status).toBe(200);
    expect(readFileSync(join(f.state, "transcripts-seen.jsonl"), "utf8")).toContain(sid);

    rmSync(datei, { force: true });
    const [vorher] = await life(f, [{ method: "GET", path: "/api/slots/1/succession/1/transcript" }], extra);
    const b = vorher!.body as { source?: string | null; absent?: string };
    expect(b.source).toBeNull();
    expect(b.absent).toBe("deleted");
  }, 90_000);
  // Die Nachfolge darf den Harness wechseln (die Linie speichert keinen); der Satz über die Vorgängerin richtet sich nach IHREM
  // Harness aus der Start-Historie, nicht nach dem der laufenden Besetzung.
  test("pi-zai: eine Claude-Vorgängerin heißt nicht „pi schreibt erst mit der ersten Nachricht“, eine ohne Start-Zeile auch nicht", async () => {
    const f = fixture();
    const [open] = await life(f, [{ method: "POST", path: "/api/slots/1/open", body: { cwd: f.repo, harness: "pi-zai" } }], extra);
    expect(open.status).toBe(200);
    const staat = JSON.parse(readFileSync(join(f.state, "fleet.json"), "utf8")) as {
      slots: Record<string, Record<string, unknown>>; lineageHandovers?: unknown[] };
    const t4 = staat.slots["1"]!.openedAt as number, stunde = 3_600_000;
    const [t1, t2, t3] = [t4 - 3 * stunde, t4 - 2 * stunde, t4 - stunde];
    const sidClaude = crypto.randomUUID(), sidOhne = crypto.randomUUID(), sidPi = crypto.randomUUID();
    const linie = "7a3".padEnd(24, "0");
    staat.slots["1"]!.lineageId = linie;
    const satz = (von: number, sessionId: string, zu: number) => ({ v: 1, lineageId: linie, role: "generic", at: zu,
      from: { slot: 1, openedAt: von, sessionId, cwd: f.repo }, to: { slot: 1, openedAt: zu }, obligations: [],
      intent: "harness probe", pointer: null, supersededBy: null });
    staat.lineageHandovers = [...(staat.lineageHandovers ?? []), satz(t1, sidClaude, t2), satz(t2, sidOhne, t3), satz(t3, sidPi, t4)];
    writeFileSync(join(f.state, "fleet.json"), JSON.stringify(staat, null, 2), { mode: 0o600 });
    writeFileSync(join(f.state, "transcripts-seen.jsonl"), `${JSON.stringify({ since: t1 - 60_000 })}\n`);
    // t1 startete als claude, t2 hat keine Zeile, t3 als pi-zai — keine hat eine Datei
    writeFileSync(join(f.state, "start-historie.jsonl"), startZeile(1, t1, f.repo, "claude") + startZeile(1, t3, f.repo, "pi-zai"));
    const antworten = await life(f, [1, 2, 3].map((n) => ({ method: "GET", path: `/api/slots/1/succession/${n}/transcript` })), extra);
    const [claude, ohne, pi] = antworten.map((a) => a.body as { source?: string | null; absent?: string; reason?: string });
    expect(claude!.source).toBeNull();
    expect(claude!.absent).toBe("unknown");
    expect(claude!.reason ?? "").not.toContain("pi writes");
    expect(ohne!.absent).toBe("unknown");
    expect(pi!.absent).toBe("never-written");
  }, 90_000);
  // Die Vorgänger-Ansicht hing vor dem Grund nicht an der Start-Historie: ein Lesefehler dort darf sie nicht zu einem 500 machen.
  test("pi-zai: eine unlesbare Start-Historie lässt die Ansicht antworten, der Grund heißt unknown", async () => {
    const f = fixture();
    const [open] = await life(f, [{ method: "POST", path: "/api/slots/1/open", body: { cwd: f.repo, harness: "pi-zai" } }], extra);
    expect(open.status).toBe(200);
    const staat = JSON.parse(readFileSync(join(f.state, "fleet.json"), "utf8")) as {
      slots: Record<string, Record<string, unknown>>; lineageHandovers?: unknown[] };
    const t2 = staat.slots["1"]!.openedAt as number, t1 = t2 - 3_600_000;
    const linie = "7a4".padEnd(24, "0");
    staat.slots["1"]!.lineageId = linie;
    staat.lineageHandovers = [...(staat.lineageHandovers ?? []), { v: 1, lineageId: linie, role: "generic", at: t2,
      from: { slot: 1, openedAt: t1, sessionId: crypto.randomUUID(), cwd: f.repo }, to: { slot: 1, openedAt: t2 }, obligations: [],
      intent: "unreadable history probe", pointer: null, supersededBy: null }];
    writeFileSync(join(f.state, "fleet.json"), JSON.stringify(staat, null, 2), { mode: 0o600 });
    writeFileSync(join(f.state, "transcripts-seen.jsonl"), `${JSON.stringify({ since: t1 - 60_000 })}\n`);
    // die Historie ist nicht lesbar (EACCES): Lesen scheitert mit etwas anderem als „fehlt"
    writeFileSync(join(f.state, "start-historie.jsonl"), "{}\n");
    chmodSync(join(f.state, "start-historie.jsonl"), 0o000);
    const [antwort] = await life(f, [{ method: "GET", path: "/api/slots/1/succession/1/transcript" }], extra);
    expect(antwort!.status).toBe(200);
    const b = antwort!.body as { source?: string | null; absent?: string };
    expect(b.source).toBeNull();
    expect(b.absent).toBe("unknown");
  }, 90_000);
});
