// Der Warte-Hinweis am echten Server (server.ts#tickWarteHinweis): eine Sitz-Pane, die an Claude Codes Rechte-Frage steht,
// erreicht nach der Wartezeit genau einmal die Session, die den Sitz geöffnet hat, über deren Postfach. Eine Pane ohne Frage
// und eine Session ohne Öffner (vom Owner geöffnet, er sieht sie selbst) bekommen nichts; dieselbe Frage meldet sich nicht
// zweimal, eine neue Frage nach einer Antwort schon. Die Uhr des Takts ist gestellt (Schritt `warte` in branches.drive.ts),
// die Panes sind echte tmux-Panes, deren Ersatz-claude zeigt, was der Test in seine Datei schreibt.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { branchTestkit, get, LIFE_DEADLINE_MS, persisted, post, type Answer, type Fixture } from "./branches-testkit";
import { BASH_FRAGE, LEERLAUF } from "./warte-hinweis.fixtures";

const { TMP, BIN, fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);
const FRAMES = join(TMP, "frames");
mkdirSync(FRAMES);
// der Ersatz-claude: zeichnet die Datei seines Ordners neu, sobald sie sich ändert (sonst ein leerer Schirm)
writeFileSync(join(BIN, "claude"), `#!/bin/sh
f="${FRAMES}/$(basename "$PWD")"; last=x
while :; do cur=$(cat "$f" 2>/dev/null); if [ "$cur" != "$last" ]; then printf '\\033[H\\033[2J%s\\n' "$cur"; last=$cur; fi; sleep 0.2; done
`, { mode: 0o755 });

const W = 180_000; // FLEET_WARTE_HINWEIS_SEC ungesetzt: drei Minuten
type Msg = { from: { kind: string; slot?: number; openedAt?: number }; to: { kind: string; slot?: number; openedAt?: number; role?: string }; payload: { text: string } };
const tokenOf = (f: Fixture, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
  if (!t) throw new Error(`kein Self-Token für Slot ${slot} in fleet.json`);
  return t;
};
const opened = (a: Answer | undefined): { slot: number; openedAt: number; frame: string } => {
  if (a?.status !== 200) throw new Error(`Öffnen schlug fehl: ${JSON.stringify(a)}`);
  return { slot: Number(a.body.slot), openedAt: Number(a.body.openedAt), frame: join(FRAMES, basename(String(a.body.cwd))) };
};
const hinweise = (f: Fixture): Msg[] => ((persisted(f).messages as { entries?: Msg[] } | undefined)?.entries ?? [])
  .filter((m) => m.payload.text.startsWith("[fleet · waiting notice]"));
const geschrieben = (a: Answer | undefined): unknown[] => (a?.body.geschrieben as unknown[] | undefined) ?? ["kein warte-Schritt"];
const zeige = (datei: string, text: string, ms = 1500) => ({ datei, text, ms });

type Ereignis = { kind: string; receiverSlot: number | null; status: string; subjectSlot: number; payload: { messageId?: string; to?: { kind: string; role?: string } } };
const ereignisse = (f: Fixture): Ereignis[] => (persisted(f).events as Ereignis[] | undefined) ?? [];

describe("Warte-Hinweis: ein Sitz an der Rechte-Frage erreicht seinen Öffner", () => {
  // Orchestratorin 30.10.: lebt keine Orchestratorin, geht der Hinweis eines Sitzes ohne Öffner an den OWNER, über den Weg, den es
  // schon gibt: die Nachricht an die Rollen-Adresse „[Zitat entfernt]“ ohne Halterin eskaliert (resolveMessageAddress) und steht in
  // seinem Postfach (GET /api/messages) samt Zeile in seinem Eingang (message-Ereignis, receiverSlot null)
  test("einmal nach der Wartezeit, nicht für eine leere Pane, und wieder bei einer neuen Frage; ohne Öffner und ohne Orchestratorin erfährt es der Owner", async () => {
    const f = fixture();
    // die Leitung (vom Owner geöffnet) öffnet mit ihrem Self-Token den Sitz; die freie Session öffnet der Owner allein
    const [, lead] = await life(f, [post("/api/branches", { repo: f.repo, name: "Leitung" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/leitung" })]);
    const L = opened(lead);
    const [, seat, , free] = await life(f, [post("/api/branches", { repo: f.repo, name: "Sitz" }),
      { ...post("/api/branches/open", { repo: f.repo, branch: "branch/sitz" }), self: tokenOf(f, L.slot) },
      post("/api/branches", { repo: f.repo, name: "Frei" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/frei" })]);
    const S = opened(seat), F = opened(free);

    const r = await life(f, [
      zeige(S.frame, BASH_FRAGE, 0), zeige(F.frame, BASH_FRAGE),
      { warte: 0 }, { warte: W - 1000 }, { warte: W }, { warte: 2 * W },     // 2–5
      zeige(S.frame, LEERLAUF), { warte: 2 * W + 1000 }, { warte: 3 * W + 2000 }, // 6–8: beantwortet, dann länger als W leer
      zeige(S.frame, BASH_FRAGE), { warte: 4 * W }, { warte: 5 * W - 1 }, { warte: 5 * W }, // 9–12: dieselbe Frage noch einmal
    ]);
    expect([2, 3, 4, 5, 7, 8, 10, 11, 12].map((i) => geschrieben(r[i]).length)).toEqual([0, 0, 2, 0, 0, 0, 0, 0, 1]);

    const alle = hinweise(f);
    const all = alle.filter((m) => m.to.kind === "session");
    expect(all.length).toBe(2);
    for (const m of all) {
      expect(m.from).toEqual({ kind: "session", slot: S.slot, openedAt: S.openedAt });
      expect(m.to).toEqual({ kind: "session", slot: L.slot, openedAt: L.openedAt });
    }
    expect(all[0]?.payload.text).toContain(`Slot ${S.slot} (Sitz) has been waiting since `);
    expect(all[0]?.payload.text).toContain('(3 min) for an answer in its pane: "Bash command · Do you want to proceed?"');
    expect(all[1]?.payload.text).toContain('(3 min) for an answer in its pane: "Bash command · Do you want to proceed?"');
    expect(all.some((m) => m.payload.text.includes(`Slot ${F.slot} `))).toBe(false);
    // der freie Sitz: genau ein Hinweis, an die Rolle, nicht an die Leitung (kein Öffner) — und genau eine Zeile im Eingang des Owners
    const anOwner = alle.filter((m) => m.to.kind === "role");
    expect(anOwner.length).toBe(1);
    expect(anOwner[0]?.to).toEqual({ kind: "role", role: "orchestrator" });
    expect(anOwner[0]?.from).toMatchObject({ kind: "session", slot: F.slot, openedAt: F.openedAt });
    expect(anOwner[0]?.payload.text).toContain(`Slot ${F.slot} (Frei) has been waiting since `);
    expect(anOwner[0]?.payload.text).not.toContain("/api/self/rueckfrage");
    expect(anOwner[0]?.payload.text).toContain("No Orchestratorin is live, so this reaches you");
    const zeilen = ereignisse(f).filter((e) => e.kind === "message" && e.receiverSlot === null);
    expect(zeilen.map((e) => [e.status, e.subjectSlot, e.payload.to])).toEqual([["inbox", F.slot, { kind: "role", role: "orchestrator" }]]);
    const [gesehen] = await life(f, [get("/api/messages")]);
    const seine = (gesehen?.body.entries as Array<{ id: string; resolution: { escalatedTo: string | null } }>).filter((m) => m.id === zeilen[0]?.payload.messageId);
    expect(seine.map((m) => m.resolution.escalatedTo)).toEqual(["owner"]);
  }, LIFE_DEADLINE_MS * 3);

  // Owner 30.10.: „[Zitat entfernt]“ Ein Sitz ohne Öffnerin meldet
  // seine Frage der Orchestratorin unter ihrer Rolle; ein Sitz mit lebender Öffnerin meldet weiter nur ihr; steht die
  // Orchestratorin SELBST an einer Frage, geht ihr Hinweis an den Owner (Leitung 30.10.: sonst erfährt es niemand).
  test("ein Sitz ohne Öffner meldet der Orchestratorin, ein Sitz mit Öffner weiter nur seinem Öffner, und steht sie selbst, erfährt es der Owner", async () => {
    const f = fixture();
    const ORCH = 9;
    const [, lead, orch] = await life(f, [post("/api/branches", { repo: f.repo, name: "Leitung" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/leitung" }),
      post(`/api/slots/${ORCH}/open`, { cwd: f.repo, label: "🎛 Orchestratorin" })]);
    expect(orch?.status).toBe(200);
    const L = opened(lead), O = opened(orch);
    const [, seat, , free] = await life(f, [post("/api/branches", { repo: f.repo, name: "Sitz" }),
      { ...post("/api/branches/open", { repo: f.repo, branch: "branch/sitz" }), self: tokenOf(f, L.slot) },
      post("/api/branches", { repo: f.repo, name: "Frei" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/frei" })]);
    const S = opened(seat), F = opened(free);

    const r = await life(f, [
      zeige(S.frame, BASH_FRAGE, 0), zeige(F.frame, BASH_FRAGE, 0), zeige(O.frame, BASH_FRAGE),
      { warte: 0 }, { warte: W - 1000 }, { warte: W }, { warte: 2 * W },     // 3–6
    ]);
    expect([3, 4, 5, 6].map((i) => geschrieben(r[i]).length)).toEqual([0, 0, 3, 0]);

    const all = hinweise(f);
    expect(all.length).toBe(3);
    const vonFrei = all.find((m) => m.payload.text.includes(`Slot ${F.slot} (Frei) `));
    const vonSitz = all.find((m) => m.payload.text.includes(`Slot ${S.slot} (Sitz) `));
    expect(vonFrei?.from).toMatchObject({ kind: "session", slot: F.slot });
    expect(vonFrei?.to).toEqual({ kind: "role", role: "orchestrator" });
    expect(vonFrei?.payload.text).toContain(`GET /api/self/rueckfrage?slot=${F.slot}`);
    expect(vonSitz?.to).toEqual({ kind: "session", slot: L.slot, openedAt: L.openedAt });
    // ihre eigene Frage: ein Hinweis, von ihr, an ihre Rolle — als gelesen gebucht (er käme sonst in ihre eigene Pane zurück) —
    // und GENAU diese Zeile im Eingang des Owners; die Hinweise der beiden Sitze erreichen ihn nicht
    const vonOrch = all.find((m) => m.payload.text.includes(`Slot ${ORCH} `));
    expect(vonOrch?.from).toMatchObject({ kind: "role", role: "orchestrator" });
    expect(vonOrch?.to).toEqual({ kind: "role", role: "orchestrator" });
    const zeilen = ereignisse(f).filter((e) => e.kind === "message" && e.receiverSlot === null);
    expect(zeilen.map((e) => e.subjectSlot)).toEqual([ORCH]);
    const gelesen = ((persisted(f).messages as { entries?: Array<{ id: string; readBy: unknown }> } | undefined)?.entries ?? [])
      .find((m) => m.id === zeilen[0]?.payload.messageId);
    expect(gelesen?.readBy).toMatchObject({ slot: ORCH });
    // die Quittung läuft über dieselbe Stelle wie jede andere (stampMessageRead): sie steht im Audit, nicht von Hand am Eintrag
    expect(vonOrch?.payload.text).toContain("The Orchestratorin herself is waiting here, so this reaches you");
    const audit = readFileSync(join(f.state, "audit.jsonl"), "utf8").split("\n").filter(Boolean)
      .map((l) => JSON.parse(l) as { event: string; slot?: number; detail?: string });
    expect(audit.filter((x) => x.event === "message_read" && x.slot === ORCH && x.detail?.startsWith(String(zeilen[0]?.payload.messageId)))).toHaveLength(1);
  }, LIFE_DEADLINE_MS * 3);

  // Leitung 30.10.: ein Sitz, dessen Öffnerin nicht mehr lebt, ist wie einer ohne Öffnerin — Orchestratorin, sonst Owner
  test("ist die Öffnerin des Sitzes fort, erfährt es die Orchestratorin; gibt es sie nicht, der Owner", async () => {
    for (const mitOrchestratorin of [true, false]) {
      const f = fixture();
      const [, lead, orch] = await life(f, [post("/api/branches", { repo: f.repo, name: "Leitung" }),
        post("/api/branches/open", { repo: f.repo, branch: "branch/leitung" }),
        ...(mitOrchestratorin ? [post("/api/slots/9/open", { cwd: f.repo, label: "🎛 Orchestratorin" })] : [])]);
      const L = opened(lead);
      const [, seat] = await life(f, [post("/api/branches", { repo: f.repo, name: "Sitz" }),
        { ...post("/api/branches/open", { repo: f.repo, branch: "branch/sitz" }), self: tokenOf(f, L.slot) }]);
      const S = opened(seat);
      // die Pane der Orchestratorin steht im Ordner des Repos: ein Schirm aus einem früheren Test bleibt in der Datei liegen
      const r = await life(f, [post(`/api/slots/${L.slot}/kill`, {}), zeige(S.frame, BASH_FRAGE), zeige(join(FRAMES, basename(f.repo)), LEERLAUF),
        { warte: 0 }, { warte: W - 1000 }, { warte: W }, { warte: 2 * W }]);       // 3–6
      expect(r[0]?.status).toBe(200);
      expect([3, 4, 5, 6].map((i) => geschrieben(r[i]).length)).toEqual([0, 0, 1, 0]);
      const all = hinweise(f);
      expect(all.map((m) => [m.from.slot, m.to])).toEqual([[S.slot, { kind: "role", role: "orchestrator" }]]);
      const zeilen = ereignisse(f).filter((e) => e.kind === "message" && e.receiverSlot === null);
      expect(zeilen.length).toBe(mitOrchestratorin ? 0 : 1);
      if (mitOrchestratorin) expect(orch?.status).toBe(200);
    }
  }, LIFE_DEADLINE_MS * 6);

  // Folgestück 30.10. (R2, R5): zwei Halter der Rolle sprechen keine an; der Hinweis geht an den Owner, und der Satz sagt es so
  test("zwei Halter der Orchestratorin-Rolle: der Hinweis eines Sitzes geht an den Owner, ehrlich benannt", async () => {
    const f = fixture();
    const [, , o1, o2, , frei] = await life(f, [post("/api/branches", { repo: f.repo, name: "Leitung" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/leitung" }),
      post("/api/slots/8/open", { cwd: f.repo, label: "🎛 Orchestratorin" }), post("/api/slots/9/open", { cwd: f.repo, label: "🎛 Orchestratorin" }),
      post("/api/branches", { repo: f.repo, name: "Frei" }), post("/api/branches/open", { repo: f.repo, branch: "branch/frei" })]);
    expect([o1?.status, o2?.status]).toEqual([200, 200]);
    const F = opened(frei);
    const r = await life(f, [zeige(F.frame, BASH_FRAGE), { warte: 0 }, { warte: W }, { warte: 2 * W }]);
    expect([1, 2, 3].map((i) => geschrieben(r[i]).length)).toEqual([0, 1, 0]);
    const alle = hinweise(f);
    expect(alle.map((m) => m.to)).toEqual([{ kind: "role", role: "orchestrator" }]);
    expect(alle[0]?.payload.text).toContain("More than one session holds the Orchestratorin role");
    expect(ereignisse(f).filter((e) => e.kind === "message" && e.receiverSlot === null).map((e) => e.subjectSlot)).toEqual([F.slot]);
  }, LIFE_DEADLINE_MS * 3);

  // Folgestück 30.10. (R4): die Zeile im Eingang des Owners bleibt nur, solange die Frage steht (der Eingang fasst 25 und teilt
  // sich mit Berichten und Nachfolge-Schulden); eine neue Frage macht eine neue Zeile
  test("die Zeile des Owners fällt weg, sobald die Frage vom Schirm ist", async () => {
    const f = fixture();
    const [, frei] = await life(f, [post("/api/branches", { repo: f.repo, name: "Frei" }), post("/api/branches/open", { repo: f.repo, branch: "branch/frei" })]);
    const F = opened(frei);
    const r = await life(f, [zeige(F.frame, BASH_FRAGE), { warte: 0 }, { warte: W },       // 0–2
      zeige(F.frame, LEERLAUF), { warte: W + 1000 },                                       // 3–4: beantwortet
      zeige(F.frame, BASH_FRAGE), { warte: 2 * W }, { warte: 3 * W }]);                    // 5–7: dieselbe Frage noch einmal
    expect([2, 4, 6, 7].map((i) => geschrieben(r[i]).length)).toEqual([1, 0, 0, 1]);
    const zeilen = ereignisse(f).filter((e) => e.kind === "message" && e.receiverSlot === null);
    expect(zeilen.map((e) => e.status)).toEqual(["acknowledged", "inbox"]);
    // ein selbst geschlossene Zeile ist nachvollziehbar: das Audit nennt sie und den Grund
    const zu = readFileSync(join(f.state, "audit.jsonl"), "utf8").split("\n").filter(Boolean)
      .map((l) => JSON.parse(l) as { event: string; slot?: number; detail?: string }).filter((x) => x.event === "warte_zeile_zu");
    expect(zu.map((x) => [x.slot, x.detail?.slice(25)])).toEqual([[F.slot, "question off the screen"]]);
  }, LIFE_DEADLINE_MS * 3);

  // Prüfung 30.10.: die Frage ist nur „<Kopf> · <Frage>“ ohne Befehl, jede Bash-Frage eines Sitzes liest sich gleich, und die
  // Besetzung überlebt den Neustart. Eine Unterdrückung über Leben hinweg würde darum jeden späteren Hänger dieses Sitzes
  // verschweigen. Nach einem Neustart meldet eine NEUE Frage, nachdem die alte beantwortet war.
  test("nach einem Neustart meldet eine neue Frage desselben Sitzes, nachdem die alte beantwortet war", async () => {
    const f = fixture();
    const [, lead] = await life(f, [post("/api/branches", { repo: f.repo, name: "Leitung" }), post("/api/branches/open", { repo: f.repo, branch: "branch/leitung" })]);
    const L = opened(lead);
    const [, seat] = await life(f, [post("/api/branches", { repo: f.repo, name: "Sitz" }),
      { ...post("/api/branches/open", { repo: f.repo, branch: "branch/sitz" }), self: tokenOf(f, L.slot) }]);
    const S = opened(seat);
    const eins = await life(f, [zeige(S.frame, BASH_FRAGE), { warte: 0 }, { warte: W }]);
    expect(geschrieben(eins[2]).length).toBe(1);
    const zwei = await life(f, [zeige(S.frame, LEERLAUF), { warte: 0 }, zeige(S.frame, BASH_FRAGE), { warte: 1000 }, { warte: W + 1000 }]);
    expect([1, 3, 4].map((i) => geschrieben(zwei[i]).length)).toEqual([0, 0, 1]);
    expect(hinweise(f).length).toBe(2);
  }, LIFE_DEADLINE_MS * 4);

  // Folgestück 30.10. (R5): eine Lane meldet im Takt nichts (ihr Hook meldet an die MAIN) — auch nicht dem Owner. Die Lane
  // entsteht hier, indem der Slot im Zustand zwischen zwei Leben als Lane gezeichnet wird.
  test("eine Lane bleibt im Warte-Takt still", async () => {
    const f = fixture();
    const [, frei] = await life(f, [post("/api/branches", { repo: f.repo, name: "Frei" }), post("/api/branches/open", { repo: f.repo, branch: "branch/frei" })]);
    const F = opened(frei);
    const datei = join(f.state, "fleet.json");
    const zustand = JSON.parse(readFileSync(datei, "utf8")) as { slots: Record<string, { worktree: unknown }> };
    zustand.slots[String(F.slot)]!.worktree = { repo: f.repo, branch: "branch/frei" };
    writeFileSync(datei, JSON.stringify(zustand));
    const r = await life(f, [zeige(F.frame, BASH_FRAGE), { warte: 0 }, { warte: W }, { warte: 2 * W }]);
    expect((persisted(f).slots as Record<string, { worktree?: unknown }>)[String(F.slot)]?.worktree).toBeTruthy();
    expect([1, 2, 3].map((i) => geschrieben(r[i]).length)).toEqual([0, 0, 0]);
    expect(hinweise(f)).toEqual([]);
  }, LIFE_DEADLINE_MS * 3);

  // UI-Abnahme 22.10., Runde 2: das Board zeigt die Frage, BEVOR der Owner tippt — /api/sessions trägt sie je Session,
  // auch bei einer Session ohne Öffner (sie wartet auf den Owner), und nicht mehr, sobald sie weg ist
  test("/api/sessions trägt die Frage, solange sie steht, bei jeder Session", async () => {
    const f = fixture();
    const [, lead] = await life(f, [post("/api/branches", { repo: f.repo, name: "Leitung" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/leitung" })]);
    const L = opened(lead);
    const [, seat, , free] = await life(f, [post("/api/branches", { repo: f.repo, name: "Sitz" }),
      { ...post("/api/branches/open", { repo: f.repo, branch: "branch/sitz" }), self: tokenOf(f, L.slot) },
      post("/api/branches", { repo: f.repo, name: "Frei" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/frei" })]);
    const S = opened(seat), F = opened(free);
    type Row = { id: number; rueckfrage?: string };
    const r = await life(f, [
      zeige(S.frame, BASH_FRAGE, 0), zeige(F.frame, BASH_FRAGE), { warte: 0 }, get("/api/sessions"),   // 0–3
      zeige(S.frame, LEERLAUF), { warte: 1000 }, get("/api/sessions"),                                     // 4–6
    ]);
    const frage = (a: Answer | undefined, slot: number) => (a?.body.slots as Row[]).find((x) => x.id === slot)?.rueckfrage ?? null;
    expect([frage(r[3], S.slot), frage(r[3], F.slot), frage(r[3], L.slot)])
      .toEqual(["Bash command · Do you want to proceed?", "Bash command · Do you want to proceed?", null]);
    expect([frage(r[6], S.slot), frage(r[6], F.slot)]).toEqual([null, "Bash command · Do you want to proceed?"]);
  }, LIFE_DEADLINE_MS * 3);
});
