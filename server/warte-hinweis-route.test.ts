// Der Warte-Hinweis am echten Server (server.ts#tickWarteHinweis): eine Sitz-Pane, die an Claude Codes Rechte-Frage steht,
// erreicht nach der Wartezeit genau einmal die Session, die den Sitz geöffnet hat, über deren Postfach. Eine Pane ohne Frage
// und eine Session ohne Öffner (vom Owner geöffnet, er sieht sie selbst) bekommen nichts; dieselbe Frage meldet sich nicht
// zweimal, eine neue Frage nach einer Antwort schon. Die Uhr des Takts ist gestellt (Schritt `warte` in branches.drive.ts),
// die Panes sind echte tmux-Panes, deren Ersatz-claude zeigt, was der Test in seine Datei schreibt.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
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
type Msg = { from: { kind: string; slot?: number; openedAt?: number }; to: { kind: string; slot?: number; openedAt?: number }; payload: { text: string } };
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

describe("Warte-Hinweis: ein Sitz an der Rechte-Frage erreicht seinen Öffner", () => {
  test("einmal nach der Wartezeit, nicht für eine leere Pane, nicht ohne Öffner, und wieder bei einer neuen Frage", async () => {
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
    expect([2, 3, 4, 5, 7, 8, 10, 11, 12].map((i) => geschrieben(r[i]).length)).toEqual([0, 0, 1, 0, 0, 0, 0, 0, 1]);

    const all = hinweise(f);
    expect(all.length).toBe(2);
    for (const m of all) {
      expect(m.from).toEqual({ kind: "session", slot: S.slot, openedAt: S.openedAt });
      expect(m.to).toEqual({ kind: "session", slot: L.slot, openedAt: L.openedAt });
    }
    expect(all[0]?.payload.text).toContain(`Slot ${S.slot} (Sitz) has been waiting since `);
    expect(all[0]?.payload.text).toContain('(3 min) for an answer in its pane: "Bash command · Do you want to proceed?"');
    expect(all[1]?.payload.text).toContain('(3 min) for an answer in its pane: "Bash command · Do you want to proceed?"');
    expect(all.some((m) => m.payload.text.includes(`Slot ${F.slot} `))).toBe(false);
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
