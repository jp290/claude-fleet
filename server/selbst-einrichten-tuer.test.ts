// EINE SESSION RICHTET IHRE NACHFOLGERIN EIN (server/selbst-einrichten.ts, server/eigene-packs.ts): sie schreibt einen Pack, setzt ihn und
// einen Zweck für ihren nächsten Start und übergibt; die Nachfolgerin hat beides im Systemzusatz, das Board zählt die Steine, und Info → Setup
// zeigt jede neue Zeile als + gegenüber der Vorgängerin (src/start-brief.ts#gegenVorgaengerin). Gemessen an der Zeile, mit der tmux die Pane
// startete, an GET /api/sessions und an der Fassung derselben Session. Die Fixture ist ein fremdes Repo, also eigenes Setup (Bibliothek aus).
import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gegenVorgaengerin, type Fassung } from "../src/start-brief";
import { type Answer, branchTestkit, type Fixture, get, LIFE_DEADLINE_MS, persisted, post } from "./branches-testkit";

const { SOCKETS, BIN, fixture, life, cleanup } = branchTestkit();
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
const PACK = { id: "mein-agent", useWhen: "Wenn du mit deinem Nutzer an seiner Rezeptsammlung arbeitest.",
  text: "# Mein Agent\n\nDu hilfst bei einer Rezeptsammlung.\nJedes Rezept bekommt eine eigene Datei." };
const ZWECK = "Du bist der Rezept-Agent deines Nutzers.\nDu schreibst kurz und auf Deutsch.";
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
    expect(gesetzt?.body.zeilen).toEqual([`+ Pack ${PACK.id}`, "+ Zweck: Du bist der Rezept-Agent deines Nutzers."]);
    expect(fremd?.status).toBe(400);
    expect(String(fremd?.body.error)).toContain("only adds text");
    expect(unbekannt?.status).toBe(400);
    expect(ansicht?.body.naechster).toEqual({ purpose: ZWECK, packs: [PACK.id] });
    // ein Neustart behält den Start dieser Belegung: nichts davon auf der Zeile
    expect(neustart?.status).toBeLessThan(300);
    expect(startzeile(f, f.repo)).not.toContain("PURPOSE (written for you by your predecessor");
    expect(startzeile(f, f.repo)).not.toContain("Du hilfst bei einer Rezeptsammlung.");

    const [nachfolge] = await life(f, [als(self, post("/api/self/succeed", {}))], kurz);
    expect(nachfolge?.status).toBeLessThan(600);
    const zeile = startzeile(f, f.repo);
    // Zeile und Startdatei, Zeile für Zeile
    for (const teil of ["PURPOSE (written for you by your predecessor in this slot):", ...ZWECK.split("\n"), `--- ${PACK.id} (`,
      "Du hilfst bei einer Rezeptsammlung.", "Jedes Rezept bekommt eine eigene Datei."]) expect(zeile).toContain(teil);

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
    expect(pz?.diff?.map((z) => z.t)).toContain("Jedes Rezept bekommt eine eigene Datei.");
    expect(zz?.diff?.map((z) => z.t)).toEqual(["PURPOSE (written for you by your predecessor in this slot):", ...ZWECK.split("\n")]);
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

// EIN HARNESS OHNE FLEETS SYSTEMPROMPT (Owner 26.10.: „[Zitat entfernt]“):
// der Zweck und der Pack der Vorgängerin erreichen die Nachfolgerin im Übergabebrief, je Stein eine + Zeile mit Autor.
describe("einrichten auf einem Harness ohne Fleets Systemprompt", () => {
  test("eine pi-Sitz richtet sich ein; die Nachfolgerin liest Zweck und Pack als + Zeilen mit Autor im Brief", async () => {
    const f = fixture();
    // Der Ersatz-pi muss auf beiden Plattformen als „pi“ gelesen werden (server.ts#paneAgentAt): Linux nimmt den
    // Skriptnamen, macOS den Namen des Interpreter-Links. Ein Link namens pi-bash gibt beiden den Anfang „pi“.
    symlinkSync("/bin/bash", join(BIN, "pi-bash"));
    writeFileSync(join(BIN, "pi"), `#!${join(BIN, "pi-bash")}\nwhile :; do sleep 1; done\n`, { mode: 0o755 });
    const PACK = { id: "mein-pi-agent", useWhen: "Wenn du für mich arbeitest.", text: "# Mein Pi Agent\n\nLies die README vor dem ersten Schritt." };
    const ZWECK = "Du arbeitest für mich, nicht für Fleet.";
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, harness: "pi" })]);
    offen(opened);
    const self = selfToken(f, 1);
    const [pack, gesetzt] = await life(f, [als(self, post("/api/self/packs", PACK)),
      als(self, post("/api/self/einrichten", { purpose: ZWECK, packs: [PACK.id, "fleet-doors"] }))]);
    expect(pack?.status).toBe(200);
    expect(gesetzt?.status).toBe(200);
    expect(gesetzt?.body.zeilen).toEqual([`+ Pack ${PACK.id}`, "+ Pack fleet-doors", "+ Zweck: Du arbeitest für mich, nicht für Fleet."]);
    const [nachfolge, hist] = await life(f, [als(self, post("/api/self/succeed", {})), get("/api/slots/1/history")], kurz);
    expect(nachfolge?.status).toBeLessThan(300);
    const brief = (hist?.body.history as { text: string }[] | undefined)?.at(-1)?.text ?? "";
    for (const teil of ["YOUR PREDECESSOR'S STONES", `+ purpose (author: your predecessor in this slot)`, ZWECK,
      `+ context pack ${PACK.id} (author: your predecessor in this slot)`, PACK.text,
      "+ context pack fleet-doors (author: your predecessor in this slot)", "# Fleet's doors", "POST /api/self/einrichten"]) expect(brief).toContain(teil);
    // ...und die Fassung zeigt denselben Stein mit Autor, damit Info → Setup die + Zeile hat
    const [fassung] = await life(f, [get("/api/slots/1/fassung?anlass=laufend")]);
    const wissen = ((fassung?.body.teile as { id: string; abschnitte: { id: string; text: string | null }[] }[] | undefined) ?? [])
      .find((t) => t.id === "liest")?.abschnitte.filter((a) => a.id === "wissen") ?? [];
    expect(wissen.some((a) => a.text?.includes(`author: your predecessor in this slot`))).toBe(true);
    expect(wissen.some((a) => a.text?.includes(PACK.text))).toBe(true);
    expect(wissen.some((a) => a.text?.includes("# Fleet's doors"))).toBe(true);
  }, LIFE_DEADLINE_MS * 4);
});
