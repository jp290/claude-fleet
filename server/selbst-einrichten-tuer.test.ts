// EINE SESSION RICHTET IHRE NACHFOLGERIN EIN (server/selbst-einrichten.ts, server/eigene-packs.ts): sie schreibt einen Pack, setzt ihn und
// einen Zweck für ihren nächsten Start und übergibt; die Nachfolgerin hat beides im Systemzusatz, das Board zählt die Steine, und Info → Setup
// zeigt jede neue Zeile als + gegenüber der Vorgängerin (src/start-brief.ts#gegenVorgaengerin). Gemessen an der Zeile, mit der tmux die Pane
// startete, an GET /api/sessions und an der Fassung derselben Session. Die Fixture ist ein fremdes Repo, also eigenes Setup (Bibliothek aus).
import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gegenVorgaengerin, type Fassung } from "../src/start-brief";
import { type Answer, branchTestkit, type Fixture, get, LIFE_DEADLINE_MS, persisted, post } from "./branches-testkit";

const { SOCKETS, fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

function startzeile(f: Fixture, cwd: string): string {
  const r = Bun.spawnSync(["tmux", "-L", f.sock, "list-panes", "-a", "-F", "#{pane_current_path}\t#{pane_start_command}"],
    { env: { ...process.env, TMUX_TMPDIR: SOCKETS } });
  const zeile = r.stdout.toString().split("\n").find((z) => z.startsWith(`${cwd}\t`));
  if (!zeile) throw new Error(`keine Pane in ${cwd}: ${r.stdout.toString()}${r.stderr.toString()}`);
  const z = zeile.slice(cwd.length + 1).replace(/^"|"$/g, "").replace(/\\(.)/g, "$1").replaceAll("'\\''", "'");
  // ...and the seat's start file the line names (server.ts#seatStartDatei): library and purpose stand there
  const datei = /--append-system-prompt-file '([^']+)'/.exec(z)?.[1];
  return datei ? `${z}\n${readFileSync(datei, "utf8")}` : z;
}
const selfToken = (f: Fixture, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }>)[String(slot)]?.selfToken;
  if (!t) throw new Error("kein Self-Token");
  return t;
};
const als = (self: string, step: ReturnType<typeof post> | ReturnType<typeof get>) => ({ ...step, token: null, self });
const offen = (a: Answer | undefined): void => {
  if (a?.status !== 200 && a?.status !== 201) throw new Error(`Öffnen schlug fehl: ${JSON.stringify(a)}`);
};
const PACK = { id: "mein-agent", useWhen: "Wenn du mit deinem Nutzer an seinen Anfrageen arbeitest.",
  text: "# Mein Agent\n\nDu hilfst bei Anfrageen.\nJede Anfrage bekommt eine eigene Datei." };
const ZWECK = "Du bist der Anfrages-Agent deines Nutzers.\nDu schreibst kurz und auf Deutsch.";
const kurz = { FLEET_FOUNDING_BOOT_GRACE_MS: "250", FLEET_READY_WAIT_MS: "500" };

describe("eine Session baut ihre Nachfolgerin", () => {
  test("Pack schreiben, mit Zweck setzen, übergeben: die Nachfolgerin trägt beides, das Board zählt zwei Steine, Setup zeigt + Zeilen", async () => {
    const f = fixture();
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo })]);
    offen(opened);
    const self = selfToken(f, 1);
    const [pack, register, gesetzt, fremd, unbekannt, ansicht, neustart] = await life(f, [
      als(self, post("/api/self/packs", PACK)),
      als(self, post("/api/self/packs", { ...PACK, id: "made-with-love" })),
      als(self, post("/api/self/einrichten", { purpose: ZWECK, packs: [PACK.id] })),
      als(self, post("/api/self/einrichten", { model: "claude-opus-5-5" })),
      als(self, post("/api/self/einrichten", { packs: ["gibt-es-nicht"] })),
      als(self, get("/api/self/einrichten")),
      post("/api/slots/1/restart", {})]);
    expect(pack?.status).toBe(200);
    expect(pack?.body.pack).toMatchObject({ id: PACK.id, titel: "Mein Agent" });
    expect(register?.status).toBe(400);
    expect(gesetzt?.status).toBe(200);
    expect(gesetzt?.body.zeilen).toEqual([`+ Pack ${PACK.id}`, "+ Zweck: Du bist der Anfrages-Agent deines Nutzers."]);
    expect(fremd?.status).toBe(400);
    expect(String(fremd?.body.error)).toContain("only adds text");
    expect(unbekannt?.status).toBe(400);
    expect(ansicht?.body.naechster).toEqual({ purpose: ZWECK, packs: [PACK.id] });
    // ein Neustart behält den Start dieser Belegung: nichts davon auf der Zeile
    expect(neustart?.status).toBeLessThan(300);
    expect(startzeile(f, f.repo)).not.toContain("ZWECK (von deiner Vorgängerin");
    expect(startzeile(f, f.repo)).not.toContain("Du hilfst bei Anfrageen.");

    const [nachfolge] = await life(f, [als(self, post("/api/self/succeed", {}))], kurz);
    expect(nachfolge?.status).toBeLessThan(600);
    const zeile = startzeile(f, f.repo);
    // Zeile und Startdatei, Zeile für Zeile
    for (const teil of ["ZWECK (von deiner Vorgängerin auf diesem Slot für dich geschrieben):", ...ZWECK.split("\n"), `--- ${PACK.id} (`,
      "Du hilfst bei Anfrageen.", "Jede Anfrage bekommt eine eigene Datei."]) expect(zeile).toContain(teil);

    const [sessions, fassung, wieder] = await life(f, [get("/api/sessions"), get("/api/slots/1/fassung?anlass=laufend"),
      als(selfToken(f, 1), get("/api/self/einrichten"))]);
    const reihe = (sessions?.body.slots as { id: number; gaveItself?: string[] }[]).find((s) => s.id === 1);
    expect(reihe?.gaveItself).toEqual([PACK.id, "purpose"]);
    expect(wieder?.body.jetzt).toEqual({ purpose: ZWECK, packs: [PACK.id] });
    // Info → Setup: dieselbe Vergleichsfunktion wie das Startfenster, die Vorgängerin an der Stelle von „normal“
    const vorher = fassung?.body.vorgaengerin as Fassung | undefined;
    expect(vorher).toBeTruthy();
    const neu = gegenVorgaengerin(fassung!.body as unknown as Fassung, vorher!, f.repo);
    const pz = neu.find((b) => b.key === `pack:${PACK.id}`), zz = neu.find((b) => b.key === "zweck");
    expect(pz?.zeichen).toBe("+");
    expect(zz?.zeichen).toBe("+");
    expect(pz?.diff?.every((z) => z.z === "+")).toBe(true);
    expect(pz?.diff?.map((z) => z.t)).toContain("Jede Anfrage bekommt eine eigene Datei.");
    expect(zz?.diff?.map((z) => z.t)).toEqual(["ZWECK (von deiner Vorgängerin auf diesem Slot für dich geschrieben):", ...ZWECK.split("\n")]);
  }, LIFE_DEADLINE_MS * 4);

  test("eine Lane richtet sich nicht selbst ein: ihre Karte bestimmt ihren Start", async () => {
    const f = fixture();
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo })]);
    offen(opened);
    const self = selfToken(f, 1);
    const stand = persisted(f);
    (stand.slots as Record<string, Record<string, unknown>>)["1"]!.worktree = { repo: f.repo, branch: "fleet/lane-probe" };
    await Bun.write(`${f.state}/fleet.json`, JSON.stringify(stand));
    const [lane] = await life(f, [als(self, post("/api/self/einrichten", { purpose: ZWECK }))]);
    expect(lane?.status).toBe(409);
  }, LIFE_DEADLINE_MS * 2);
});
