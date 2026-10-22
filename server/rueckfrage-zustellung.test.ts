// Keine automatische Eingabe beantwortet Claude Codes Rechte-Frage (server.ts#CLAUDE_PERMISSION_QUESTION). Gemessen am
// 22.10.2026 auf der Testinstanz :8997: eine Postfach-Zustellung an einen Sitz an „Do you want to create beweis2.txt?“
// wurde getippt, Enter wählte „1. Yes“, die Datei entstand. Hier: dieselbe Frage (ohne Eingabezeile auf dem Schirm, wie
// damals) in einer echten Pane; Postfach-Takt und Owner-Tür tippen nichts, und ist die Frage weg, kommt die Nachricht an.
// Der Ersatz-claude ist bun unter dem Namen claude-agent (so zählt er als lebender Agent, wie in testinstanz.sh): er zeigt,
// was in seiner Rahmen-Datei steht (benannt nach Fixture, Repo und Worktree, damit sich zwei Tests keine teilen), und schreibt jede Zeile, die in die Pane getippt und abgeschickt wird, in `.getippt`.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { branchTestkit, LIFE_DEADLINE_MS, persisted, post, type Answer, type Fixture } from "./branches-testkit";
import { BASH_FRAGE, SCHMAL_FRAGE, WRITE_FRAGE } from "./warte-hinweis.fixtures";
import { sendFailureMessage, sendFailureToastMs } from "../src/pendingsend";

const { TMP, BIN, SOCKETS, fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);
const FRAMES = join(TMP, "frames");
mkdirSync(FRAMES);
symlinkSync(process.execPath, join(BIN, "claude-agent"));
writeFileSync(join(TMP, "ersatz.js"), `const fs = require("node:fs"), path = require("node:path");
const f = path.join(${JSON.stringify(FRAMES)}, process.cwd().split("/").slice(-3).join("_"));
let last = null;
setInterval(() => { let c = ""; try { c = fs.readFileSync(f, "utf8").trimEnd(); } catch {}
  if (c !== last) { last = c; process.stdout.write("\\x1b[H\\x1b[2J" + c + "\\n"); } }, 200);
// roh, damit eine einzelne Taste (die „1“ oder Esc der Freigabe-Tür) ankommt und nicht auf ein Enter wartet
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.on("data", (d) => fs.appendFileSync(f + ".getippt", d));
`);
writeFileSync(join(BIN, "claude"), `#!/bin/sh\nexec "${join(BIN, "claude-agent")}" "${join(TMP, "ersatz.js")}"\n`, { mode: 0o755 });

const ENTWURF = "❯ ein Entwurf des Owners\n";
const FERTIG = "⏺ Die Frage ist beantwortet, die Session arbeitet weiter.\n";
const tokenOf = (f: Fixture, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
  if (!t) throw new Error(`kein Self-Token für Slot ${slot} in fleet.json`);
  return t;
};
const opened = (a: Answer | undefined): { slot: number; frame: string } => {
  if (a?.status !== 200) throw new Error(`Öffnen schlug fehl: ${JSON.stringify(a)}`);
  return { slot: Number(a.body.slot), frame: join(FRAMES, String(a.body.cwd).split("/").slice(-3).join("_")) };
};
const zeige = (datei: string, text: string) => ({ datei, text, ms: 1500 });
const pause = (ms: number) => ({ until: join(TMP, "gibt-es-nie"), ms });

describe("eine Pane an der Rechte-Frage bekommt nichts getippt", () => {
  test("Postfach und Owner-Tür tippen nichts, solange die Frage steht; danach kommt die Nachricht an", async () => {
    const f = fixture();
    const [, lead] = await life(f, [post("/api/branches", { repo: f.repo, name: "Leitung" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/leitung" })]);
    const L = opened(lead);
    const [, seat] = await life(f, [post("/api/branches", { repo: f.repo, name: "Sitz" }),
      { ...post("/api/branches/open", { repo: f.repo, branch: "branch/sitz" }), self: tokenOf(f, L.slot) }]);
    const S = opened(seat);
    const getippt = `${S.frame}.getippt`;

    const r = await life(f, [
      zeige(S.frame, WRITE_FRAGE),                                                                             // 0
      { ...post("/api/self/messages", { to: { kind: "session", slot: S.slot },
        payload: { kind: "text", text: "Kurze Frage von der Leitung: wie weit bist du?" }, idempotencyKey: "k1" }),
        token: null, self: tokenOf(f, L.slot) },                                                               // 1
      post("/send", { slot: S.slot, text: "vom Owner, während die Frage steht" }),                              // 2
      { ausgabe: S.slot, vorMs: 10_000 },                                                                      // 3: die Pane ist still
      { postfach: true }, { until: getippt, ms: 5000 },                                                        // 4–5
      zeige(S.frame, FERTIG),                                                                                  // 6: beantwortet
      { postfach: true }, { until: getippt, ms: 10_000 },                                                      // 7–8
      post("/send", { slot: S.slot, text: "vom Owner, danach" }),                                               // 9
    ], { FLEET_POSTFACH_FENSTER_SEC: "0" });
    expect(r[1]?.status).toBe(200);
    expect(r[2]?.status).toBe(409);
    expect(String(r[2]?.body.error)).toContain("gate=blocked-screen: claude permission question — nothing typed");
    expect(r[5]?.status).toBe(408);
    expect(r[8]?.status).toBe(200);
    expect(r[9]?.status).toBe(200);
    const text = existsSync(getippt) ? readFileSync(getippt, "utf8") : "";
    expect(text).toContain("Kurze Frage von der Leitung: wie weit bist du?");
    expect(text).toContain("vom Owner, danach");
    expect(text).not.toContain("während die Frage steht");
  }, LIFE_DEADLINE_MS * 3);

  // Eine Nachricht, die hinter einem Entwurf geparkt wurde, fragt canDeliver nicht mehr (tickParkedSends): steht inzwischen
  // die Frage auf dem Schirm, darf auch sie nicht tippen (die Prüfung in sendText); ist die Frage beantwortet, kommt sie an.
  test("eine geparkte Nachricht tippt nicht in die Frage, die inzwischen steht, und kommt nach der Antwort an", async () => {
    const f = fixture();
    const [, lead] = await life(f, [post("/api/branches", { repo: f.repo, name: "Leitung" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/leitung" })]);
    const L = opened(lead);
    const [, seat] = await life(f, [post("/api/branches", { repo: f.repo, name: "Sitz" }),
      { ...post("/api/branches/open", { repo: f.repo, branch: "branch/sitz" }), self: tokenOf(f, L.slot) }]);
    const S = opened(seat);
    const getippt = `${S.frame}.getippt`;

    const r = await life(f, [
      zeige(S.frame, ENTWURF),                                                                                 // 0
      { ...post("/api/self/messages", { to: { kind: "session", slot: S.slot },
        payload: { kind: "text", text: "Geparkte Frage von der Leitung." }, idempotencyKey: "k2" }),
        token: null, self: tokenOf(f, L.slot) },                                                               // 1
      { ausgabe: S.slot, vorMs: 10_000 }, { postfach: true }, pause(2000),                                     // 2–4: geparkt hinter dem Entwurf
      zeige(S.frame, WRITE_FRAGE), { geparkt: true }, { until: getippt, ms: 3000 },                            // 5–7
      zeige(S.frame, FERTIG), { geparkt: true }, { until: getippt, ms: 8000 },                                 // 8–10
    ], { FLEET_POSTFACH_FENSTER_SEC: "0", FLEET_AUTOS_TICK_MS: "250" });
    expect(r[1]?.status).toBe(200);
    expect(r[7]?.status).toBe(408);
    expect(r[10]?.status).toBe(200);
    expect(readFileSync(getippt, "utf8")).toContain("Geparkte Frage von der Leitung.");
    // sie lief wirklich über den Parkweg: geparkt hinter dem Entwurf (die Zustellung danach belegt `.getippt`; die
    // Schlusszeile des Parkens schreibt das Audit erst nach dem Ende dieses Lebens)
    const rows = readFileSync(join(f.state, "audit.jsonl"), "utf8").split("\n").filter(Boolean)
      .map((l) => JSON.parse(l) as { event: string; slot?: number; phase?: string })
      .filter((x) => x.slot === S.slot && x.event === "send_parked");
    expect(rows.map((x) => x.phase)).toEqual(["entry"]);
  }, LIFE_DEADLINE_MS * 3);

  // Abnahme f4b37685e: am Handy stellt das Board das Fenster schmal, und Claude Code (Ink) bricht die Frage dann selbst um,
  // mit echtem Zeilenumbruch, den -J nicht zusammenfügt. Hier der GEMESSENE Schirm (40 Spalten, claude 2.1.308) in einer
  // 40 Spalten breiten Pane. Er trägt oben die eigene Auftragszeile mit ❯ in Spalte 0, die Fleet als Entwurf läse — darum
  // prüft der Test den GRUND: die Owner-Tür sagt blocked-screen (nicht „[Zitat entfernt]“), und der Postfach-Takt
  // versucht gar nichts (keine send-Zeile, nichts geparkt). Der Warte-Hinweis nennt die ganze Frage. Das Eingabefeld des
  // Boards zeigt für die abgewiesene Sendung den Satz aus src/pendingsend.ts.
  test("der gemessene, von Ink umbrochene Schirm in 40 Spalten: nichts getippt, der Hinweis nennt die ganze Frage", async () => {
    const f = fixture();
    const [, lead] = await life(f, [post("/api/branches", { repo: f.repo, name: "Leitung" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/leitung" })]);
    const L = opened(lead);
    const [, seat] = await life(f, [post("/api/branches", { repo: f.repo, name: "Sitz" }),
      { ...post("/api/branches/open", { repo: f.repo, branch: "branch/sitz" }), self: tokenOf(f, L.slot) }]);
    const S = opened(seat);
    const getippt = `${S.frame}.getippt`;
    const tmux = (...args: string[]) => Bun.spawnSync(["tmux", "-L", f.sock, ...args], { env: { ...process.env, TMUX_TMPDIR: SOCKETS } });
    expect(tmux("resize-window", "-t", `s${S.slot}`, "-x", "40", "-y", "40").exitCode).toBe(0);

    const r = await life(f, [
      zeige(S.frame, SCHMAL_FRAGE),                                                                            // 0
      post("/send", { slot: S.slot, text: "1" }),                                                              // 1: die „1“ im Eingabefeld
      { ...post("/api/self/messages", { to: { kind: "session", slot: S.slot },
        payload: { kind: "text", text: "Frage von der Leitung an die schmale Pane." }, idempotencyKey: "k3" }),
        token: null, self: tokenOf(f, L.slot) },                                                               // 2
      { ausgabe: S.slot, vorMs: 10_000 }, { postfach: true }, { until: getippt, ms: 5000 },                    // 3–5
      { warte: 0 }, { warte: 180_000 },                                                                        // 6–7
    ], { FLEET_POSTFACH_FENSTER_SEC: "0" });
    // die Frage stand wirklich auf zwei Zeilen: auch mit -J steht sie auf keiner ganz
    const schirm = tmux("capture-pane", "-p", "-J", "-t", `s${S.slot}`).stdout.toString();
    expect(schirm).toContain(" Do you want to create");
    expect(schirm).not.toContain("Do you want to create 2026-10-22-lang.md?");
    expect(r[1]?.status).toBe(409);
    expect(String(r[1]?.body.error)).toBe("gate=blocked-screen: claude permission question — nothing typed");
    // UI-Abnahme 22.10.: der Satz nennt die Tasten und steht 6 s; die übrigen Toasts behalten ihre Dauer
    const satz = sendFailureMessage(409, r[1]?.body);
    expect(satz).toBe("Die Session wartet an einer Rechte-Frage — im Terminal beantworten (1 oder Esc); nichts wurde getippt");
    expect(sendFailureToastMs(satz)).toBe(6000);
    expect(sendFailureToastMs(sendFailureMessage(409, { error: "gate=blocked-screen: claude trust dialog — nothing typed",
      receipt: { delivery: "refused" } }))).toBeUndefined();
    expect(r[2]?.status).toBe(200);
    expect(r[5]?.status).toBe(408);
    expect(existsSync(getippt)).toBe(false);
    const rows = readFileSync(join(f.state, "audit.jsonl"), "utf8").split("\n").filter(Boolean)
      .map((l) => JSON.parse(l) as { event: string; slot?: number; path?: string });
    expect(rows.filter((x) => x.slot === S.slot && (x.event === "send_parked" || (x.event === "send" && x.path === "postfach")))).toEqual([]);
    expect((r[7]?.body.geschrieben as unknown[] | undefined)?.length).toBe(1);
    const hinweis = ((persisted(f).messages as { entries?: { payload: { text: string } }[] } | undefined)?.entries ?? [])
      .find((m) => m.payload.text.startsWith("[fleet · warte-hinweis]"));
    expect(hinweis?.payload.text).toContain("„Create file · Do you want to create 2026-10-22-lang.md?“");
  }, LIFE_DEADLINE_MS * 3);

  // Owner 22.10. 08:30: der Öffner (oder die Orchestratorin) gibt eine wartende Frage BEWUSST frei oder lehnt ab. Bewusst
  // heißt (Abnahme 76c28e2a2): erst den ganzen Dialog lesen (GET, mit Befehl), dann mit dessen Kennung wählen; ein anderer
  // Dialog — dieselbe Frage mit anderem Befehl — bekommt nichts getippt. Die Orchestratorin nur bei Sitzen mit Öffner.
  test("die Freigabe-Tür: lesen, an den Dialog gebunden, nur Öffner oder Orchestratorin bei Sitzen mit Öffner", async () => {
    const f = fixture();
    const ORCH = 9;
    const [, lead, , fremd, orch] = await life(f, [post("/api/branches", { repo: f.repo, name: "Leitung" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/leitung" }),
      post("/api/branches", { repo: f.repo, name: "Fremd" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/fremd" }),
      post(`/api/slots/${ORCH}/open`, { cwd: f.repo, label: "🎛 Orchestratorin" })]);
    const L = opened(lead), F = opened(fremd);
    expect(orch?.status).toBe(200);
    const [, seat] = await life(f, [post("/api/branches", { repo: f.repo, name: "Sitz" }),
      { ...post("/api/branches/open", { repo: f.repo, branch: "branch/sitz" }), self: tokenOf(f, L.slot) }]);
    const S = opened(seat);
    const getippt = `${S.frame}.getippt`;
    const RM = BASH_FRAGE.replace(/^ mkdir -p sub && touch sub\/x\.txt$/m, " rm -rf ~/claude-fleet");
    const lies = (von: number, slot: number) => ({ method: "GET", path: `/api/self/rueckfrage?slot=${slot}`, token: null, self: tokenOf(f, von) });
    const tuer = (von: number, body: Record<string, unknown>) => ({ ...post("/api/self/rueckfrage", body), token: null, self: tokenOf(f, von) });

    const r = await life(f, [
      zeige(S.frame, BASH_FRAGE),                                                                              // 0
      lies(L.slot, S.slot),                                                                                    // 1: der Öffner liest
      lies(F.slot, S.slot),                                                                                    // 2: fremd
      tuer(F.slot, { slot: S.slot, kennung: "$1.kennung", wahl: "freigeben" }),                                // 3: fremd
      tuer(S.slot, { slot: S.slot, kennung: "$1.kennung", wahl: "freigeben" }),                                // 4: der Sitz selbst
      tuer(L.slot, { slot: S.slot, kennung: "$1.kennung", wahl: "vielleicht" }),                               // 5
      tuer(L.slot, { slot: S.slot, kennung: "$1.kennung", wahl: "freigeben" }),                                // 6: „1“
      zeige(S.frame, RM),                                                                                      // 7: die nächste Bash-Frage
      tuer(L.slot, { slot: S.slot, kennung: "$1.kennung", wahl: "freigeben" }),                                // 8: alte Kennung
      lies(ORCH, S.slot),                                                                                      // 9: Orchestratorin, Sitz mit Öffner
      tuer(ORCH, { slot: S.slot, kennung: "$9.kennung", wahl: "ablehnen" }),                                   // 10: Esc
      zeige(F.frame, BASH_FRAGE),                                                                              // 11: Sitz ohne Öffner
      lies(ORCH, F.slot), tuer(ORCH, { slot: F.slot, kennung: "$1.kennung", wahl: "freigeben" }),              // 12–13
      zeige(S.frame, FERTIG), tuer(L.slot, { slot: S.slot, kennung: "$9.kennung", wahl: "freigeben" }),        // 14–15
      pause(800),
    ]);
    expect(r[1]?.status).toBe(200);
    expect(r[1]?.body).toMatchObject({ slot: S.slot, frage: "Bash command · Do you want to proceed?" });
    expect(String(r[1]?.body.dialog)).toContain("mkdir -p sub && touch sub/x.txt");
    expect([2, 3, 4, 5, 6].map((k) => r[k]?.status)).toEqual([409, 409, 409, 400, 200]);
    expect(r[8]?.status).toBe(409);
    expect(String(r[8]?.body.error)).toBe("another dialog is on screen: „Bash command · Do you want to proceed?“ — read it again with GET (a resized pane redraws it too) — nothing typed");
    // Abnahme ca46648f5: keine 409-Antwort nennt eine Kennung — mit ihr ließe sich ohne Lesen freigeben
    for (const a of r.filter((x) => x.status === 409)) expect(JSON.stringify(a.body)).not.toMatch(/[0-9a-f]{16}/);
    expect(String(r[9]?.body.dialog)).toContain("rm -rf ~/claude-fleet");
    expect(r[9]?.body.kennung).not.toBe(r[1]?.body.kennung);
    expect(r[10]?.status).toBe(200);
    expect([r[12]?.status, r[13]?.status]).toEqual([409, 409]);
    expect(r[15]?.status).toBe(409);
    expect(String(r[15]?.body.error)).toBe("no permission question on screen — nothing typed");
    expect(readFileSync(getippt, "utf8")).toBe("1\x1b");
    expect(existsSync(`${F.frame}.getippt`)).toBe(false);
    const rows = readFileSync(join(f.state, "audit.jsonl"), "utf8").split("\n").filter(Boolean)
      .map((l) => JSON.parse(l) as { event: string; slot?: number; detail?: string })
      .filter((x) => x.event === "rueckfrage_antwort" && x.slot === S.slot).map((x) => x.detail);
    expect(rows).toContain(`freigeben by slot ${L.slot} (opener) kennung=${String(r[1]?.body.kennung)}: Bash command · Do you want to proceed?`);
    expect(rows).toContain(`ablehnen by slot ${ORCH} (orchestrator) kennung=${String(r[9]?.body.kennung)}: Bash command · Do you want to proceed?`);
  }, LIFE_DEADLINE_MS * 3);

  // Abnahme ca46648f5: ein Dialog, höher als die Pane (ein 40-Zeilen-Befehl in 30 Zeilen), verliert oben seinen Anfang;
  // dann gibt es nichts zu lesen und nichts zu binden, GET und POST antworten 409 mit dem Grund, nichts getippt
  test("ein Dialog, höher als die Pane, wird weder gezeigt noch freigegeben", async () => {
    const f = fixture();
    const [, lead] = await life(f, [post("/api/branches", { repo: f.repo, name: "Leitung" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/leitung" })]);
    const L = opened(lead);
    const [, seat] = await life(f, [post("/api/branches", { repo: f.repo, name: "Sitz" }),
      { ...post("/api/branches/open", { repo: f.repo, branch: "branch/sitz" }), self: tokenOf(f, L.slot) }]);
    const S = opened(seat);
    const tmux = (...args: string[]) => Bun.spawnSync(["tmux", "-L", f.sock, ...args], { env: { ...process.env, TMUX_TMPDIR: SOCKETS } });
    expect(tmux("resize-window", "-t", `s${S.slot}`, "-x", "100", "-y", "30").exitCode).toBe(0);
    const hoch = [`${"─".repeat(60)}`, " Bash command", " Run a long script", "╌".repeat(60), " rm -rf ~/claude-fleet",
      ...Array.from({ length: 40 }, (_, i) => ` echo zeile ${i}`), "╌".repeat(60), " Do you want to proceed?", " ❯ 1. Yes", "   2. No", "",
      " Esc to cancel · Tab to amend"].join("\n");
    const zuHoch = "the dialog is taller than the pane — its top is not on screen, so it cannot be read whole or bound; answer it in the terminal or widen the pane and read again";
    const r = await life(f, [
      zeige(S.frame, hoch),
      { method: "GET", path: `/api/self/rueckfrage?slot=${S.slot}`, token: null, self: tokenOf(f, L.slot) },
      { ...post("/api/self/rueckfrage", { slot: S.slot, kennung: "0123456789abcdef", wahl: "freigeben" }), token: null, self: tokenOf(f, L.slot) },
      pause(500),
    ]);
    expect(tmux("capture-pane", "-p", "-J", "-t", `s${S.slot}`).stdout.toString()).not.toContain("rm -rf");
    expect([r[1]?.status, r[1]?.body.error]).toEqual([409, zuHoch]);
    expect([r[2]?.status, r[2]?.body.error]).toEqual([409, `${zuHoch} — nothing typed`]);
    expect(existsSync(`${S.frame}.getippt`)).toBe(false);
  }, LIFE_DEADLINE_MS * 3);

  // Abnahme 9d7f7d588: in copy-mode schluckt tmux die Taste; die Tür sagt dann nicht ok, sondern 409 mit Grund
  test("eine Pane in copy-mode bekommt keine Taste, und die Tür sagt nicht ok", async () => {
    const f = fixture();
    const [, lead] = await life(f, [post("/api/branches", { repo: f.repo, name: "Leitung" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/leitung" })]);
    const L = opened(lead);
    const [, seat] = await life(f, [post("/api/branches", { repo: f.repo, name: "Sitz" }),
      { ...post("/api/branches/open", { repo: f.repo, branch: "branch/sitz" }), self: tokenOf(f, L.slot) }]);
    const S = opened(seat);
    const tmux = (...args: string[]) => Bun.spawnSync(["tmux", "-L", f.sock, ...args], { env: { ...process.env, TMUX_TMPDIR: SOCKETS } });
    const self = tokenOf(f, L.slot);
    const [, gelesen] = await life(f, [zeige(S.frame, BASH_FRAGE), { method: "GET", path: `/api/self/rueckfrage?slot=${S.slot}`, token: null, self }]);
    expect(gelesen?.status).toBe(200);
    expect(tmux("copy-mode", "-t", `s${S.slot}`).exitCode).toBe(0);
    const [antwort] = await life(f, [{ ...post("/api/self/rueckfrage", { slot: S.slot, kennung: gelesen?.body.kennung, wahl: "freigeben" }), token: null, self }, pause(500)]);
    expect(antwort?.status).toBe(409);
    expect(String(antwort?.body.error)).toBe("the pane is in copy mode (someone is scrolling it) — leave copy mode, then read again — nothing typed");
    expect(existsSync(`${S.frame}.getippt`)).toBe(false);
  }, LIFE_DEADLINE_MS * 3);
});
