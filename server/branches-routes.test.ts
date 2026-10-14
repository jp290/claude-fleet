// Neuaufbau K5 · Task = Branch, die Routen. Owner 11.10.: „[Zitat entfernt]“; Plan K5:
// „Owner oder Orchestratorin öffnen vom Board aus eine Session auf einem benannten Branch … Punkte je
// Branch überleben das Schließen der Session“; Bauleitung 13.10.: Punkte gehören zu (Repo, Branch), sie
// überleben das Entfernen des Worktrees; „passt“ steht am Branch mit Zeit und Commit. Entwurf K2: ein
// doppelter Name wird abgewiesen; K4: kein Punkt geht verloren.
//
// Jedes `life` ist ein Leben des Servers in einem eigenen Prozess (server/branches.drive.ts): Zustand
// laden, Boot-Umschlüsselung, Anfragen. Zwei Leben nacheinander sind ein Neustart dazwischen.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fragmentFileName, RULEBOOK_FRAGMENTS } from "../rulebook";
import { type Answer, branchTestkit, commitIn, type Fixture, get, LIFE_DEADLINE_MS, persisted, post, rowsOf, sh } from "./branches-testkit";

const { TMP, PROJECTS, fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

describe("Branch öffnen: Name und Punkte vom Board, der Name ist im Repo eindeutig", () => {
  test("ein neuer Branch bekommt Worktree, Namen und Punkte; ein zweiter mit demselben Namen legt nichts an", async () => {
    const f = fixture();
    const [made, twice, list] = await life(f, [
      post("/api/branches", { repo: f.repo, name: "Kritik Probe", points: ["Datei anlegen", "Readme ergänzen"] }),
      post("/api/branches", { repo: f.repo, name: "kritik  probe", points: ["Noch einer"] }),
      get("/api/branches")]);
    expect(made?.status).toBe(201);
    expect(made?.body).toMatchObject({ branch: "branch/kritik-probe", created: true, name: "Kritik Probe",
      text: "- [ ] Datei anlegen\n- [ ] Readme ergänzen", rev: 1 });
    expect(existsSync(String(made?.body.path))).toBe(true);
    expect(twice).toMatchObject({ status: 409, body: { existing: { branch: "branch/kritik-probe", name: "Kritik Probe" } } });
    expect(sh(f.repo, "branch", "--format=%(refname:short)").split("\n").sort()).toEqual(["branch/kritik-probe", "main"]);
    const row = rowsOf(list!, f.repo).branches;
    expect(row.map((r) => [r.name, r.text, r.path, r.distance])).toEqual([
      ["Kritik Probe", "- [ ] Datei anlegen\n- [ ] Readme ergänzen", String(made?.body.path), { ahead: 0, behind: 0 }]]);
  }, LIFE_DEADLINE_MS);

  test("die Linie des Repos (main) ist kein Branch zum Arbeiten; ohne Token kommt niemand herein", async () => {
    const f = fixture();
    const [onMain, noToken] = await life(f, [
      post("/api/branches", { repo: f.repo, branch: "main", name: "Hauptlinie" }),
      { ...post("/api/branches", { repo: f.repo, name: "Fremd" }), token: null }]);
    expect(onMain?.status).toBe(400);
    expect(noToken?.status).toBe(401);
    expect(sh(f.repo, "branch", "--format=%(refname:short)")).toBe("main");
  }, LIFE_DEADLINE_MS);
});

describe("Punkte gehören zum Branch: Worktree weg, Neustart, neu ausgecheckt — dieselben Punkte", () => {
  test("nach Entfernen des Worktrees und einem Neustart steht der Branch ohne Worktree da; Öffnen checkt ihn neu aus", async () => {
    const f = fixture();
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Probe", points: ["eins"] })]);
    const path = String(made?.body.path);
    commitIn(path, "datei.txt", "Datei anlegen");
    sh(f.repo, "worktree", "remove", path);
    const [before, reopened, after] = await life(f, [
      get("/api/branches"),
      post("/api/branches", { repo: f.repo, branch: "branch/probe", name: "Probe" }),
      get("/api/branches")]);
    expect(rowsOf(before!, f.repo).branches.map((r) => [r.name, r.text, r.path, r.distance?.ahead]))
      .toEqual([["Probe", "- [ ] eins", null, 1]]);
    expect(reopened).toMatchObject({ status: 200, body: { created: false, text: "- [ ] eins", rev: 1 } });
    expect(existsSync(join(String(reopened?.body.path), "datei.txt"))).toBe(true);
    expect(rowsOf(after!, f.repo).branches.map((r) => r.path)).toEqual([String(reopened?.body.path)]);
  }, LIFE_DEADLINE_MS);
});

describe("kein Punkt geht verloren: geschrieben wird gegen den gelesenen Stand", () => {
  test("ein Gerät auf altem Stand bekommt 409 und den Text des anderen; nach dem Neustart steht der Text des ersten", async () => {
    const f = fixture();
    const [, phone, desk] = await life(f, [
      post("/api/branches", { repo: f.repo, name: "Zwei Geräte", points: ["eins"] }),
      post("/api/branches/note", { repo: f.repo, branch: "branch/zwei-geraete", text: "- [ ] eins\n- [ ] vom Telefon", rev: 1 }),
      post("/api/branches/note", { repo: f.repo, branch: "branch/zwei-geraete", text: "- [x] eins", rev: 1 })]);
    expect(phone).toEqual({ status: 200, body: { ok: true, rev: 2, length: "- [ ] eins\n- [ ] vom Telefon".length } });
    expect(desk).toMatchObject({ status: 409, body: { current: { text: "- [ ] eins\n- [ ] vom Telefon", rev: 2 } } });
    const [list] = await life(f, [get("/api/branches")]);
    expect(rowsOf(list!, f.repo).branches.map((r) => [r.text, r.rev])).toEqual([["- [ ] eins\n- [ ] vom Telefon", 2]]);
  }, LIFE_DEADLINE_MS);
});

describe("Owner hat gesehen / passt: Zeit, Commit, Tür", () => {
  test("passt steht an der Spitze, über einen Neustart; ein Commit, der nicht auf dem Branch liegt, wird abgewiesen", async () => {
    const f = fixture();
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Gesehen" })]);
    const tip = commitIn(String(made?.body.path), "a.txt", "erste Arbeit");
    const onlyMain = commitIn(f.repo, "m.txt", "nur auf main");
    const [seen, foreign, short] = await life(f, [
      post("/api/branches/seen", { repo: f.repo, branch: "branch/gesehen", head: tip }),
      post("/api/branches/seen", { repo: f.repo, branch: "branch/gesehen", head: onlyMain }),
      post("/api/branches/seen", { repo: f.repo, branch: "branch/gesehen", head: tip.slice(0, 8) })]);
    expect(seen).toMatchObject({ status: 200, body: { seen: { head: tip, via: "bearer" } } });
    expect([foreign?.status, short?.status]).toEqual([409, 400]);
    const [list] = await life(f, [get("/api/branches")]);
    expect(rowsOf(list!, f.repo).branches.map((r) => [r.head, r.seen?.head, r.distance])).toEqual([[tip, tip, { ahead: 1, behind: 1 }]]);
  }, LIFE_DEADLINE_MS);
});

describe("Diff ohne Session", () => {
  test("Dateien, Commits und Diff des Branches gegen seine Basis, ohne dass eine Session läuft", async () => {
    const f = fixture();
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Mit Diff" })]);
    commitIn(String(made?.body.path), "neu.txt", "Datei neu");
    commitIn(f.repo, "m.txt", "main zieht weiter");
    const [diff] = await life(f, [get(`/api/branches/diff?repo=${encodeURIComponent(f.repo)}&branch=branch/mit-diff`)]);
    expect(diff?.status).toBe(200);
    expect(diff?.body).toMatchObject({ base: "main", files: ["neu.txt"], commits: [{ subject: "Datei neu" }], truncated: false });
    expect(String(diff?.body.diff)).toContain("+Datei neu");
    expect(String(diff?.body.diff)).not.toContain("main zieht weiter");
  }, LIFE_DEADLINE_MS);
});

describe("Altbestand: Notizblöcke je Pfad wandern auf ihren Branch, der alte Schlüssel bleibt", () => {
  test("die Übernahme läuft einmal: ein Branch, der später am alten Pfad steht, erbt den Notizblock nicht", async () => {
    const f = fixture();
    const path = join(`${f.repo}.worktrees`, "alt");
    sh(f.repo, "worktree", "add", "-q", "-b", "alt/notiz", path);
    writeFileSync(join(f.state, "fleet.json"), JSON.stringify({ worktreeNotes: { [path]: "- [ ] alt" } }));
    await life(f, ["save"]);
    expect(typeof persisted(f).branchNotesAdoptedAt).toBe("number");
    sh(path, "checkout", "-q", "-b", "alt/anders");
    const [fresh] = await life(f, [post("/api/branches/note", { repo: f.repo, branch: "alt/anders", text: "- [ ] neu", rev: 0 })]);
    expect(fresh).toEqual({ status: 200, body: { ok: true, rev: 1, length: "- [ ] neu".length } });
  }, LIFE_DEADLINE_MS);

  test("zwei Boots ergeben denselben Stand; worktreeNotes steht unverändert in fleet.json; ein discard beendet den Datensatz", async () => {
    const f = fixture();
    const path = join(`${f.repo}.worktrees`, "alt");
    sh(f.repo, "worktree", "add", "-q", "-b", "alt/notiz", path);
    const legacy = { [path]: "- [ ] alt", [join(TMP, "gibt-es-nicht")]: "verwaist" };
    writeFileSync(join(f.state, "fleet.json"), JSON.stringify({ worktreeNotes: legacy }));
    const stale = post("/api/branches/note", { repo: f.repo, branch: "alt/notiz", text: "überschrieben?", rev: 0 });
    const [first] = await life(f, [stale, "save"]);
    expect(first).toMatchObject({ status: 409, body: { current: { text: "- [ ] alt", rev: 1 } } });
    const once = persisted(f);
    const [second] = await life(f, [stale, "save"]);
    expect(second).toEqual(first!);
    expect(persisted(f).branches).toEqual(once.branches);
    expect(persisted(f).worktreeNotes).toEqual(legacy);
    const [gone, after] = await life(f, [
      post("/api/worktrees/discard", { repo: f.repo, path, branch: "alt/notiz" }),
      post("/api/branches/note", { repo: f.repo, branch: "alt/notiz", text: "", rev: 1 })]);
    expect(gone).toMatchObject({ status: 200, body: { branchDeleted: true } });
    expect(after?.status).toBe(404);
    expect(persisted(f).branches).toBeUndefined();
    expect(persisted(f).worktreeNotes).toEqual(legacy);
  }, LIFE_DEADLINE_MS);
});

// projDir in server.ts: der Transkript-Ordner einer Session ist ihr cwd mit „-“ statt jedes Sonderzeichens
const transcriptDir = (cwd: string): string => join(PROJECTS, cwd.replace(/[^a-zA-Z0-9]/g, "-"));

describe("Session auf dem Branch: ohne Rolle, im Worktree, mit dem Board-Namen", () => {
  test("die Session sitzt im Worktree und trägt den Namen; ein zweites Öffnen sagt, wo sie läuft; ihr Repo ist das des Branches", async () => {
    const f = fixture();
    const [made, opened, again, list, plain, known] = await life(f, [
      post("/api/branches", { repo: f.repo, name: "Session Probe", points: ["eins"] }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/session-probe" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/session-probe" }),
      get("/api/branches"),
      post("/api/branches/open", { repo: f.repo, branch: "main" }),
      get("/api/commits")]);
    expect(opened).toMatchObject({ status: 200, body: { cwd: made?.body.path, label: "Session Probe", resumed: null } });
    const slot = Number(opened?.body.slot);
    expect(again).toMatchObject({ status: 409, body: { session: { slot } } });
    expect(rowsOf(list!, f.repo).branches.map((r) => r.session?.slot)).toEqual([slot]);
    expect(plain?.status).toBe(404);
    // die Session im Worktree ist kein eigenes Projekt neben ihrem Repo (Info zeigte sie doppelt)
    expect(known?.body.repos).toEqual([f.repo]);
  }, LIFE_DEADLINE_MS);

  test("Fortsetzen nimmt das jüngste Gespräch des Worktrees, auch ohne Worktree vorher; fresh beginnt neu", async () => {
    const f = fixture();
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Fortsetzen" })]);
    const path = String(made?.body.path);
    const older = "11111111-1111-4111-8111-111111111111", newer = "22222222-2222-4222-8222-222222222222";
    mkdirSync(transcriptDir(path), { recursive: true });
    for (const [id, age] of [[older, 600], [newer, 60]] as const) {
      const file = join(transcriptDir(path), `${id}.jsonl`);
      writeFileSync(file, "{}\n");
      const at = new Date(Date.now() - age * 1000);
      utimesSync(file, at, at);
    }
    sh(f.repo, "worktree", "remove", path);
    const [resumed] = await life(f, [post("/api/branches/open", { repo: f.repo, branch: "branch/fortsetzen" })]);
    expect(resumed).toMatchObject({ status: 200, body: { cwd: path, resumed: newer } });

    const g = fixture();
    const [made2] = await life(g, [post("/api/branches", { repo: g.repo, name: "Frisch" })]);
    mkdirSync(transcriptDir(String(made2?.body.path)), { recursive: true });
    writeFileSync(join(transcriptDir(String(made2?.body.path)), `${older}.jsonl`), "{}\n");
    const [fresh] = await life(g, [post("/api/branches/open", { repo: g.repo, branch: "branch/frisch", fresh: true })]);
    expect(fresh).toMatchObject({ status: 200, body: { resumed: null } });
  }, LIFE_DEADLINE_MS * 2);
});

// Owner 13.10. auf der Testinstanz: „[Zitat entfernt]“
// . Ein Commit öffnet sich mit Betreff, Text und Änderung — aus der
// Branch-Karte auch dann, wenn er noch nicht auf main liegt.
describe("Einen Commit öffnen: Betreff, Text und Änderung, auch auf einem Branch", () => {
  function measured(path: string): void {
    writeFileSync(join(path, "messung.txt"), "Vorher: 1.8 s\n");
    sh(path, "add", "messung.txt");
    sh(path, "commit", "-q", "-m", "Vorher-Messung festgehalten", "-m", "Info-Spalte am Telefon: 1.8 s bis voll, drei Läufe.");
  }
  test("die Commit-Ansicht liest die Geschichte des Branches und gibt den Text mit; ohne Branch fehlt der Commit", async () => {
    const f = fixture();
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Messen" })]);
    measured(String(made?.body.path));
    const short = sh(f.repo, "rev-parse", "--short", "branch/messen");
    const q = (route: string, extra: string) => `/api/${route}?repo=${encodeURIComponent(f.repo)}${extra}`;
    const [list, onHead, diff, offBranch, noSuch] = await life(f, [
      get(q("commits", "&branch=branch/messen")),
      get(q("commits", "")),
      get(q("commit-diff", `&hash=${short}&branch=branch/messen`)),
      get(q("commit-diff", `&hash=${short}`)),
      get(q("commit-diff", `&hash=${short}&branch=branch/gibt-es-nicht`))]);
    expect(list?.body).toMatchObject({ repo: f.repo, branch: "branch/messen",
      commits: [{ hash: short, subject: "Vorher-Messung festgehalten" }, { subject: "start" }] });
    expect((onHead?.body.commits as { hash: string }[]).map((c) => c.hash)).not.toContain(short);
    expect(diff).toMatchObject({ status: 200,
      body: { hash: short, body: "Info-Spalte am Telefon: 1.8 s bis voll, drei Läufe.", files: ["A\tmessung.txt"] } });
    expect(String(diff?.body.diff)).toContain("+Vorher: 1.8 s");
    expect(offBranch).toEqual({ status: 404, body: { error: "not a commit this repo listed" } });
    expect(noSuch).toEqual({ status: 404, body: { error: "no such branch: branch/gibt-es-nicht" } });
  }, LIFE_DEADLINE_MS);

  test("das Review-Fenster einer Session bekommt den Text des Commits mit", async () => {
    const f = fixture();
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Bericht" })]);
    measured(String(made?.body.path));
    const short = sh(f.repo, "rev-parse", "--short", "branch/bericht");
    const [opened] = await life(f, [post("/api/branches/open", { repo: f.repo, branch: "branch/bericht" })]);
    const [cd] = await life(f, [get(`/api/slots/${Number(opened?.body.slot)}/commit-diff?hash=${short}`)]);
    expect(cd).toMatchObject({ status: 200, body: { hash: short, body: "Info-Spalte am Telefon: 1.8 s bis voll, drei Läufe.", files: ["messung.txt"] } });
  }, LIFE_DEADLINE_MS);
});

// Neuaufbau K13 · Owner 14.10.: „[Zitat entfernt]“
//  Die Session, die einen Branch öffnet, und die Session darauf
// schreiben sich im Postfach: senden, lesen, quittieren, antworten. Wer nicht zu ihnen gehört, bekommt 409,
// auch eine neue Session im Slot des Öffners, die in einem anderen Ordner sitzt.
describe("Postfach: Öffner und Branch-Session schreiben sich, sonst niemand", () => {
  type Msg = { id: string; from: { kind: string; slot?: number }; to: { kind: string; slot?: number; openedAt?: number };
    payload: { text: string }; replyTo: string | null; readBy: { slot: number } | null };
  const tokenOf = (f: Fixture, slot: number): string => {
    const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
    if (!t) throw new Error(`kein Self-Token für Slot ${slot} in fleet.json`);
    return t;
  };
  const slotOf = (a: Answer | undefined): number => {
    const n = Number(a?.body.slot);
    if (a?.status !== 200 || !Number.isInteger(n)) throw new Error(`Öffnen schlug fehl: ${JSON.stringify(a)}`);
    return n;
  };
  const as = (self: string, step: { method: string; path: string; body?: unknown }) => ({ ...step, token: null, self });
  const send = (self: string, slot: number, text: string, key: string, replyTo: string | null = null) =>
    as(self, post("/api/self/messages", { to: { kind: "session", slot }, payload: { kind: "text", text }, idempotencyKey: key, replyTo }));
  const box = (self: string) => as(self, get("/api/self/messages"));
  const messageOf = (a: Answer | undefined): Msg => a?.body.message as Msg;
  const entriesOf = (a: Answer | undefined): Msg[] => (a?.body.entries as Msg[] | undefined) ?? [];
  const stored = (f: Fixture): Msg[] => ((persisted(f).messages as { entries?: Msg[] } | undefined)?.entries ?? []);
  const openerOf = (f: Fixture, branch: string): unknown =>
    (persisted(f).branches as { branch: string; opener?: unknown }[]).find((b) => b.branch === branch)?.opener;

  test("wer mit Self-Token öffnet, steht als Öffner am Branch, auch nach einem Neustart; ohne Self-Token niemand", async () => {
    const f = fixture();
    const [, lead] = await life(f, [post("/api/branches", { repo: f.repo, name: "Leitung" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/leitung" })]);
    const L = slotOf(lead);
    const [, strand, , foreign] = await life(f, [post("/api/branches", { repo: f.repo, name: "Strang" }),
      { ...post("/api/branches/open", { repo: f.repo, branch: "branch/strang" }), self: tokenOf(f, L) },
      post("/api/branches", { repo: f.repo, name: "Fremd" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/fremd" })]);
    expect([strand?.status, foreign?.status]).toEqual([200, 200]);
    expect(openerOf(f, "branch/strang")).toMatchObject({ slot: L, cwd: String(lead?.body.cwd) });
    expect(openerOf(f, "branch/fremd")).toBeUndefined();
    expect(openerOf(f, "branch/leitung")).toBeUndefined();
    await life(f, ["save"]);
    expect(openerOf(f, "branch/strang")).toMatchObject({ slot: L, cwd: String(lead?.body.cwd) });
  }, LIFE_DEADLINE_MS * 3);

  test("Bauleitung → Branch-Session und zurück, mit Quittung; eine fremde Session bekommt 409", async () => {
    const f = fixture();
    // die Bauleitung: eine Session ohne Rolle (hier selbst auf einem Branch, vom Owner geöffnet)
    const [, lead] = await life(f, [post("/api/branches", { repo: f.repo, name: "Leitung" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/leitung" })]);
    const L = slotOf(lead);
    const leadTok = tokenOf(f, L);
    // sie öffnet den Strang mit ihrem Self-Token neben dem Owner-Bearer; den fremden öffnet der Owner allein
    const [, strand, , foreign] = await life(f, [post("/api/branches", { repo: f.repo, name: "Strang" }),
      { ...post("/api/branches/open", { repo: f.repo, branch: "branch/strang" }), self: leadTok },
      post("/api/branches", { repo: f.repo, name: "Fremd" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/fremd" })]);
    const S = slotOf(strand), F = slotOf(foreign);
    const strandTok = tokenOf(f, S), foreignTok = tokenOf(f, F);

    const [sent, strandBox, strandSelf] = await life(f, [
      send(leadTok, S, "Bitte S1 bauen.", "auftrag-1"), box(strandTok), as(strandTok, get("/api/self"))]);
    expect(sent?.status).toBe(200);
    const question = messageOf(sent);
    expect(question.to).toEqual({ kind: "session", slot: S, openedAt: Number(strand?.body.openedAt) });
    expect(sent?.body.holder).toEqual({ slot: S, openedAt: Number(strand?.body.openedAt) });
    expect(strandBox?.body.unread).toBe(1);
    expect(entriesOf(strandBox).map((m) => m.payload.text)).toEqual(["Bitte S1 bauen."]);
    // genau das liest der Hinweis in die Pane (server.ts#tickMessageNudge): ungelesener Eingang dieser Session
    expect((strandSelf?.body.position as { messages?: { unread?: number } } | undefined)?.messages?.unread).toBe(1);

    const [receipt, answer, leadBox, afterRead] = await life(f, [
      as(strandTok, post(`/api/self/messages/${question.id}/read`, {})),
      send(strandTok, L, "S1 steht, Spitze abc.", "antwort-1", question.id),
      box(leadTok), box(strandTok)]);
    expect(receipt?.status).toBe(200);
    expect(messageOf(receipt).readBy?.slot).toBe(S);
    expect(answer?.status).toBe(200);
    expect(messageOf(answer).replyTo).toBe(question.id);
    expect(leadBox?.body.unread).toBe(1);
    expect(entriesOf(leadBox).map((m) => [m.payload.text, m.replyTo])).toEqual([["S1 steht, Spitze abc.", question.id],
      ["Bitte S1 bauen.", null]]);
    expect(afterRead?.body.unread).toBe(0);

    const before = stored(f).length;
    const refused = await life(f, [send(foreignTok, L, "fremd an Leitung", "f1"), send(foreignTok, S, "fremd an Strang", "f2"),
      send(leadTok, F, "Leitung an fremd", "f3"), send(strandTok, F, "Strang an fremd", "f4")]);
    expect(refused.map((a) => a.status)).toEqual([409, 409, 409, 409]);
    expect(stored(f).length).toBe(before);
  }, LIFE_DEADLINE_MS * 6);

  test("ein neu besetzter Slot des Öffners in einem anderen Ordner ist nicht mehr Öffner; im selben Ordner (Nachfolge) schon", async () => {
    const f = fixture();
    const [, lead] = await life(f, [post("/api/branches", { repo: f.repo, name: "Leitung" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/leitung" })]);
    const L = slotOf(lead);
    const [, strand] = await life(f, [post("/api/branches", { repo: f.repo, name: "Strang" }),
      { ...post("/api/branches/open", { repo: f.repo, branch: "branch/strang" }), self: tokenOf(f, L) }]);
    const S = slotOf(strand), strandTok = tokenOf(f, S);
    const oldLead = { kind: "session", slot: L, openedAt: Number(lead?.body.openedAt) };

    // Slot L wird frei und neu besetzt, in einem anderen Ordner
    const [killed, , other] = await life(f, [post(`/api/slots/${L}/kill`, {}), post("/api/branches", { repo: f.repo, name: "Anderswo" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/anderswo" })]);
    expect(killed?.status).toBe(200);
    expect(slotOf(other)).toBe(L);
    const otherTok = tokenOf(f, L);
    const before = stored(f).length;
    const [toNew, toOld, fromNew] = await life(f, [send(strandTok, L, "an den Slot der Leitung", "r1"),
      as(strandTok, post("/api/self/messages", { to: oldLead, payload: { kind: "text", text: "an die alte Leitung" }, idempotencyKey: "r2" })),
      send(otherTok, S, "von der neuen Besetzung", "r3")]);
    expect([toNew?.status, toOld?.status, fromNew?.status]).toEqual([409, 409, 409]);
    expect(stored(f).length).toBe(before);

    // dieselbe Leitung kommt im selben Ordner wieder, wie nach einer Nachfolge: das Paar steht
    const [, again] = await life(f, [post(`/api/slots/${L}/kill`, {}),
      post("/api/branches/open", { repo: f.repo, branch: "branch/leitung" })]);
    expect(slotOf(again)).toBe(L);
    expect(Number(again?.body.openedAt)).not.toBe(oldLead.openedAt);
    const [back, forth] = await life(f, [send(strandTok, L, "Bericht an die Nachfolgerin", "n1"),
      send(tokenOf(f, L), S, "Nachfolgerin an den Strang", "n2")]);
    expect([back?.status, forth?.status]).toEqual([200, 200]);
    expect(messageOf(back).to).toEqual({ kind: "session", slot: L, openedAt: Number(again?.body.openedAt) });
  }, LIFE_DEADLINE_MS * 6);
});

// Neuaufbau K13 S8 · Mangel 67, Owner 14.10.: „[Zitat entfernt]“
//  Owner-Satz: „[Zitat entfernt]“
//  Eine Branch-Session hat keinen Lane-Bezug (worktree null); die
// Slot-Route (der Weg von „Öffnen“, src/board.ts#tiRoute) nahm dann den Worktree selbst als Repo. Die
// testinstanz.sh im Worktree ist ein Ersatz, der nur `status` beantwortet und nichts startet.
describe("Testinstanz einer Branch-Session: die Slot-Route findet Repo und Worktree", () => {
  const stub = (path: string, port: number) => writeFileSync(join(path, "testinstanz.sh"), `#!/bin/sh
case "$1" in
status)
  if [ "$2" = --json ]; then printf '%s' '{"state":"up","port":${port},"expiresAt":${Date.now() + 3_600_000},"procStatus":"alive","httpStatus":"healthy","identity":"matched"}'
  else echo "up pid 1 http://127.0.0.1:${port}/ expiresAt=${Math.floor(Date.now() / 1000) + 3600}"; fi ;;
*) exit 1 ;;
esac
`, { mode: 0o755 });
  type SlotView = { id: number; workplace: { path: string; mainCheckout: boolean } | null };

  test("Status und Öffnen über /api/slots/:id/testinstanz, danach nennt /api/sessions den Ort der Session", async () => {
    const f = fixture();
    const [made, opened] = await life(f, [post("/api/branches", { repo: f.repo, name: "Strang" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/strang" })]);
    const path = String(made?.body.path), S = Number(opened?.body.slot);
    expect(opened?.status).toBe(200);
    stub(path, 8968);
    const [status, open, sessions] = await life(f, [get(`/api/slots/${S}/testinstanz`),
      post(`/api/slots/${S}/testinstanz`, { action: "open" }), get("/api/sessions")]);
    expect(status).toMatchObject({ status: 200, body: { state: "up", port: 8968, worktree: path, mainCheckout: false } });
    expect(open).toMatchObject({ status: 200, body: { ok: true, worktree: path, port: 8968, url: "http://127.0.0.1:8968/" } });
    const row = (sessions?.body.slots as SlotView[] | undefined)?.find((s) => s.id === S);
    expect(row?.workplace).toMatchObject({ path, mainCheckout: false });
  }, LIFE_DEADLINE_MS * 2);

  test("eine Session in einem Ordner ohne Git bekommt weiter 409 unknown-worktree, es läuft nichts", async () => {
    const f = fixture();
    const plain = join(TMP, `ohne-git-${Date.now()}`);
    mkdirSync(plain);
    stub(plain, 8969);
    const [opened, status] = await life(f, [post("/api/slots/3/open", { cwd: plain }), get("/api/slots/3/testinstanz")]);
    expect(opened?.status).toBe(200);
    expect(status).toMatchObject({ status: 409, body: { refusal: "unknown-worktree", nullSpawn: true } });
  }, LIFE_DEADLINE_MS);
});

// Neuaufbau K11 R1 (docs/neuaufbau/befunde/15-pruefpraxis.md): Ein Branch-Worktree trägt kein CLAUDE.md,
// weder die Lane-Fassung des Regelbuchs noch die Kopie des Monolithen. Liegt dort eines, lädt Claude Code
// die AGENTS.md des Branches nicht, und die Bau-Session startet mit dem alten Lane-Vertrag. Owner-Satz: „[Zitat entfernt]“
// 
//  Ein Worktree über POST /api/worktrees (Standardwert, wie jede Lane) bekommt es weiter.
describe("Branch-Worktree ohne Regelbuch: die Session lädt die AGENTS.md ihres Branches", () => {
  // das Haupt-Checkout wie das echte: Regelbuch-Fragmente, Monolith und .env, alle drei gitignored
  function withRulebook(repo: string): void {
    writeFileSync(join(repo, ".gitignore"), "CLAUDE.md\n.env\nrulebook/\n");
    writeFileSync(join(repo, "AGENTS.md"), "# Regeln dieses Branches\n");
    sh(repo, "add", ".gitignore", "AGENTS.md");
    sh(repo, "commit", "-q", "-m", "Regeln");
    writeFileSync(join(repo, "CLAUDE.md"), "# Monolith\n");
    writeFileSync(join(repo, ".env"), "PROBE=1\n");
    mkdirSync(join(repo, "rulebook"));
    for (const fragment of RULEBOOK_FRAGMENTS) writeFileSync(join(repo, "rulebook", fragmentFileName(fragment)), `## ${fragment}\n\n- Regel.\n`);
  }
  const scaffold = (path: string) => ({ claudeMd: existsSync(join(path, "CLAUDE.md")), env: existsSync(join(path, ".env")),
    agentsMd: existsSync(join(path, "AGENTS.md")) });

  test("neu angelegt, neu ausgecheckt und beim Öffnen ausgecheckt: .env kommt mit, CLAUDE.md nicht; ein Lane-Worktree trägt es weiter", async () => {
    const f = fixture();
    withRulebook(f.repo);
    const [made, lane] = await life(f, [
      post("/api/branches", { repo: f.repo, name: "Ohne Regelbuch" }),
      post("/api/worktrees", { repo: f.repo, branch: "lane/probe" })]);
    const path = String(made?.body.path);
    expect(made?.status).toBe(201);
    expect(scaffold(path)).toEqual({ claudeMd: false, env: true, agentsMd: true });
    // die Gegenprobe: dasselbe Haupt-Checkout gibt einem Worktree mit Standardwert die Lane-Fassung
    expect(lane?.status).toBe(201);
    expect(scaffold(String(lane?.body.path))).toEqual({ claudeMd: true, env: true, agentsMd: true });
    expect(readFileSync(join(String(lane?.body.path), "CLAUDE.md"), "utf8")).not.toBe("# Monolith\n");

    sh(f.repo, "worktree", "remove", "--force", path);
    const [reopened] = await life(f, [post("/api/branches", { repo: f.repo, branch: "branch/ohne-regelbuch", name: "Ohne Regelbuch" })]);
    expect(reopened).toMatchObject({ status: 200, body: { path, created: false } });
    expect(scaffold(path)).toEqual({ claudeMd: false, env: true, agentsMd: true });

    sh(f.repo, "worktree", "remove", "--force", path);
    const [opened] = await life(f, [post("/api/branches/open", { repo: f.repo, branch: "branch/ohne-regelbuch" })]);
    expect(opened).toMatchObject({ status: 200, body: { cwd: path } });
    expect(scaffold(path)).toEqual({ claudeMd: false, env: true, agentsMd: true });
  }, LIFE_DEADLINE_MS * 3);
});
