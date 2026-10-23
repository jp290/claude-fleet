// Schritt 5, Lauf 2 (docs/aufgaben/sicherheitspruefung.fleet.json, Grenzen des Laufs): wer die Datei importiert, startet beide Sitze mit genau
// dem Setup, das sie trägt. Der Prover startet über die Tür des Fensters mit seiner eigenen Datei als Auftrag; er öffnet den Finder an der
// Self-Tür mit nichts als dessen Kennung, und der Finder bekommt Agent, Modell, Effort, seine Agent-MD und seinen Brief aus der Datei. Gezeigter
// Hash = laufender Hash, für beide. Dazu ein Gründungsplan auf losgelöstem HEAD (M1 der Notizen) und die Bibliothek einer Kopie ohne git.
//
// Jedes `life` ist ein Leben des Servers in einem eigenen Prozess (server/branches.drive.ts); das Ersatz-`claude` schreibt Ordner und Argumente
// seiner Zeile in eine Datei je Slot, so ist die Agent-MD, die der Test liest, die, die tmux wirklich startete.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PROFILE0, exportObjekt, type Profil } from "../src/k15-entwurf-modell";
import { importKonst } from "../src/k15-import";
import { SPEICHER_DATEI } from "../src/k15-speicher";
import { agentMdText } from "./agentmd";
import { type Answer, branchTestkit, get, persisted, post, sh } from "./branches-testkit";
import { bibliothekQuelle } from "./sitz-wissen";
import { merkeFassungen } from "./konst-fassungen";

const { TMP, BIN, PROJECTS, fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);
const ARGV = join(TMP, "argv");
mkdirSync(ARGV);
writeFileSync(join(BIN, "claude"), `#!/bin/sh\nf="${ARGV}/slot-$FLEET_SELF_SLOT"\npwd > "$f.tmp"\n`
  + `for a in "$@"; do printf '%s\\0' "$a" >> "$f.tmp"; done\nmv "$f.tmp" "$f"\nexec sleep 600\n`, { mode: 0o755 });
const startOf = async (slot: number): Promise<{ cwd: string; appended: string; args: string[] }> => {
  const file = join(ARGV, `slot-${slot}`);
  for (let i = 0; i < 200 && !existsSync(file); i++) await Bun.sleep(50);
  const [cwd, ...rest] = readFileSync(file, "utf8").split("\n");
  const args = rest.join("\n").split("\0");
  const at = args.indexOf("--append-system-prompt");
  return { cwd: cwd!, appended: at >= 0 ? args[at + 1]! : "", args };
};

// DIE DATEI, wie sie geteilt wurde, und wie das Fenster sie importiert und am Server ablegt (src/k15-zustand.ts#konstForm)
const DATEI = readFileSync(join(import.meta.dir, "..", "docs", "aufgaben", "sicherheitspruefung.fleet.json"), "utf8");
const ROH = JSON.parse(DATEI) as { positionen: { id: string; profil: { modell: string; effort: string; datei?: unknown }; eigeneDatei?: unknown }[] };
const roh = (id: string) => ROH.positionen.find((p) => p.id === id)!;
const KID = "imp1";
async function speicher(state: string): Promise<void> {
  const imp = importKonst(DATEI, PROFILE0, 1792000000000, KID);
  if (typeof imp === "string") throw new Error(imp);
  const profile: Profil[] = [...PROFILE0, ...imp.neueProfile];
  const form = { id: KID, ...exportObjekt({ ebene: "konst", voll: true, konst: [imp.k], k: imp.k, profile, q: null, p: profile[0]! }) };
  // die Profile ohne eigene Datei speichert das Fenster nicht (k15-agentmd.ts): hier steht deshalb keines, die Tür darf keines brauchen
  writeFileSync(join(state, SPEICHER_DATEI), JSON.stringify({ fassungen: [], packs: [], profile: [], konstellationen: [form] }));
  // wie das Speichern im Fenster (server/k15-speicher.ts): die Fassung, auf der ein Lauf steht
  await merkeFassungen([form], state);
}
const sha = (t: string): string => new Bun.CryptoHasher("sha256").update(t).digest("hex");
type Teil = { id: string; abschnitte: { id: string; text: string | null }[] };
const aufgabeVon = (a: Answer | undefined): string | null =>
  ((a?.body.teile as Teil[] | undefined) ?? []).find((t) => t.id === "aufgabe")?.abschnitte[0]?.text ?? null;
type SlotRecord = { selfToken?: string; model?: string; effort?: string; sessionId?: string; cwd?: string; sitz?: { konst: string; pos: string } };
const recordOf = (f: ReturnType<typeof fixture>, slot: number): SlotRecord =>
  (persisted(f).slots as Record<string, SlotRecord> | undefined)?.[String(slot)] ?? {};
const plan = (repo: string, sitz: string) => get(`/api/founding-plan?${new URLSearchParams({ repo, role: "nur-ordner", anlass: "neu", sitz })}`);

describe("ein Fremder importiert die Datei, und beide Sitze starten mit dem Setup, das sie trägt", () => {
  const f = fixture();
  const bereit = speicher(f.state);
  const brief = (id: string) => agentMdText(roh(id).eigeneDatei)!.text;
  let a: Answer[] = [], b: Answer[] = [], c: Answer[] = [];
  let finderSlot = 0, finderCwd = "", laufId = "";
  test("der Prover startet über die Tür des Fensters mit seiner eigenen Datei; gezeigt = laufend", async () => {
    await bereit;
    a = await life(f, [plan(f.repo, `${KID}/beweiser`), "save"]);
    expect(a[0]?.status).toBe(200);
    const gezeigt = String(a[0]?.body.fassungsHash);
    // so schickt das Fenster den Start: die Werte, mit denen es den Plan las, den Sitz und den gezeigten Hash (k15-start.ts#auftrag)
    const [offen, laufend] = await life(f, [post("/api/slots/3/open", { cwd: f.repo, sitz: `${KID}/beweiser`, fassung: gezeigt }),
      get("/api/slots/3/fassung?anlass=laufend"), "save"]);
    expect([offen?.status, offen?.body.auftrag, laufend?.body.hash]).toEqual([200, "follows", gezeigt]);
    // seine Aufgabe ist sein Brief aus der Datei, Wort für Wort, dazu die Bitte seines Profils (werte.subagenten, ein Satz im Brief), und Modell
    // und Effort sind die der Datei
    const auftrag = `${brief("beweiser")}\n\nSubagenten: nur lesende.`;
    expect(aufgabeVon(laufend)).toBe(auftrag);
    expect(aufgabeVon(a[0]?.body.fassung ? { status: 200, body: a[0].body.fassung as Record<string, unknown> } : undefined)).toBe(auftrag);
    expect([recordOf(f, 3).model, recordOf(f, 3).effort, recordOf(f, 3).sitz?.pos]).toEqual([roh("beweiser").profil.modell, roh("beweiser").profil.effort, "beweiser"]);
  }, 90_000);

  test("er öffnet den Finder mit nichts als dessen Kennung: Agent-MD, Modell, Effort und Brief kommen aus der Datei", async () => {
    const self = String(recordOf(f, 3).selfToken);
    b = await life(f, [
      // das Fenster bindet den gestarteten Prover an einen neuen Lauf (k15-lauf.ts#bindeLauf)
      post("/api/k15/laeufe", { konst: KID, pos: "beweiser", slot: 3 }),
      { ...post("/api/self/branches", { name: "Finder" }), token: null, self },
      { ...post("/api/self/branches", { name: "Finder ohne Sitz" }), token: null, self }, "save"]);
    b = b.slice(1);
    expect([b[0]?.status, b[1]?.status]).toEqual([201, 201]);
    c = await life(f, [
      // sein Brief als Ziel, ohne den Sitz: so kam der Finder in Lauf 2 ohne seine Agent-MD; jetzt sagt die Tür, wie es richtig geht
      { ...post("/api/self/branches/open", { branch: String(b[1]?.body.branch), goal: brief("finder") }), token: null, self },
      // ein anderes Ziel neben dem Sitz gäbe ihm ein Setup, das nicht in der Datei steht
      { ...post("/api/self/branches/open", { branch: String(b[0]?.body.branch), sitz: "finder", goal: "Finde etwas anderes." }), token: null, self },
      // ein Sitz einer anderen Konstellation ist nicht seiner: die Self-Tür öffnet nur die eigene
      { ...post("/api/self/branches/open", { branch: String(b[0]?.body.branch), sitz: "fremd/finder" }), token: null, self },
      { ...post("/api/self/branches/open", { branch: String(b[0]?.body.branch), sitz: "finder" }), token: null, self }, "save"]);
    expect([c[0]?.status, String(c[0]?.body.error)]).toEqual([400, expect.stringContaining(`"sitz": "finder"`)]);
    expect(c[1]?.status).toBe(400);
    expect([c[2]?.status, String(c[2]?.body.error)]).toEqual([400, expect.stringContaining("its own imported constellation")]);
    expect([c[3]?.status, c[3]?.body.goal]).toEqual([200, "follows"]);
    // ...und sitzt im Lauf des Provers (Mängel 117)
    laufId = String((c[3]?.body.lauf as { id?: string } | undefined)?.id);
    expect(c[3]?.body.lauf).toEqual({ id: expect.stringMatching(/^l[0-9a-f]{12}$/), pos: "finder" });
    finderSlot = Number(c[3]?.body.slot);
    finderCwd = String(c[3]?.body.cwd);
    const md = agentMdText(roh("finder").profil.datei)!;
    expect((c[3]?.body.agentMd as { sha256?: string } | undefined)?.sha256).toBe(sha(md.text));
    expect([recordOf(f, finderSlot).model, recordOf(f, finderSlot).effort, recordOf(f, finderSlot).sitz?.pos])
      .toEqual([roh("finder").profil.modell, roh("finder").profil.effort, "finder"]);
    // die Zeile, die tmux startete, trägt die Agent-MD aus der Datei
    const start = await startOf(finderSlot);
    expect(start.appended).toContain(`AGENT-MD (Profil „finder-reviewer“, Datei „${md.titel}“`);
    expect(start.appended).toContain(md.text);
    expect(start.args[start.args.indexOf("--model") + 1]).toBe(roh("finder").profil.modell);
  }, 90_000);

  test("der Finder läuft mit dem Hash, den die Vorschau desselben Sitzes zeigt, und seine Aufgabe ist sein Brief", async () => {
    const [laufend, gezeigt] = await life(f, [get(`/api/slots/${finderSlot}/fassung?anlass=laufend`), plan(finderCwd, `${KID}/finder`)]);
    expect([laufend?.status, gezeigt?.status]).toEqual([200, 200]);
    expect(laufend?.body.hash).toBe(gezeigt?.body.fassungsHash);
    expect(aufgabeVon(laufend)).toBe(brief("finder"));
  }, 60_000);
});

// DER LAUF SCHREIBT JE SITZ AUF, WELCHES MODELL WIRKLICH ANTWORTETE (Orchestratorin 23.10., Schritt 5 Lauf 2: Claude Code stellte den Beweiser nach
// einer Meldung seiner Sicherung auf Opus 4.8 um, die Datei sagte Opus 5.5): beim Schließen jeder Belegung aus ihrem Transkript (src/modell-verlauf.ts)
const zeile = (o: Record<string, unknown>): string => JSON.stringify(o);
const antwort = (model: string, at: string, requestId: string) => zeile({ type: "assistant", timestamp: at, requestId, message: { model, content: [] } });
const MIT_WECHSEL = [antwort("claude-opus-5-5", "2026-10-23T02:03:54.938Z", "r1"), antwort("claude-opus-5-5", "2026-10-23T02:10:00.000Z", "r2"),
  zeile({ type: "system", subtype: "model_refusal_fallback", timestamp: "2026-10-23T02:14:42.416Z", originalModel: "claude-opus-5-5[1m]",
    fallbackModel: "claude-opus-4-8", apiRefusalCategory: "cyber" }),
  antwort("claude-opus-4-8", "2026-10-23T02:15:05.336Z", "r3")].join("\n");
const OHNE_WECHSEL = antwort("claude-sonnet-5-5", "2026-10-23T02:20:00.000Z", "f1");

describe("der Lauf schreibt je Sitz auf, welches Modell wirklich antwortete", () => {
  test("beide Sitze schließen: der Lauf trägt je Belegung ihre Modelle, beim Beweiser den Wechsel mit Zeitpunkt und Grund; der Export trägt sie je Sitz", async () => {
    const f = fixture();
    await speicher(f.state);
    const [, bind] = await life(f, [post("/api/slots/3/open", { cwd: f.repo, sitz: `${KID}/beweiser` }), post("/api/k15/laeufe", { konst: KID, pos: "beweiser", slot: 3 }), "save"]);
    expect(bind?.status).toBe(201);
    const id = String((bind?.body.lauf as { id: string }).id);
    const self = String(recordOf(f, 3).selfToken);
    const [zweig] = await life(f, [{ ...post("/api/self/branches", { name: "Finder" }), token: null, self }]);
    const [finder] = await life(f, [{ ...post("/api/self/branches/open", { branch: String(zweig?.body.branch), sitz: "finder" }), token: null, self }, "save"]);
    const fs = Number(finder?.body.slot);
    // Claude Code schreibt sein Transkript nach <projects>/<cwd mit „-“>/<sessionId>.jsonl (server.ts#projDir); der Ersatz-claude schreibt keins
    for (const [slot, text] of [[3, MIT_WECHSEL], [fs, OHNE_WECHSEL]] as const) {
      const r = recordOf(f, slot);
      const ordner = join(PROJECTS, String(r.cwd).replace(/[^a-zA-Z0-9]/g, "-"));
      mkdirSync(ordner, { recursive: true });
      writeFileSync(join(ordner, `${r.sessionId}.jsonl`), text);
    }
    const [, , lauf, datei] = await life(f, [post(`/api/slots/${fs}/kill`, {}), post("/api/slots/3/kill", {}), get(`/api/k15/laeufe/${id}`),
      get(`/api/k15/konst/${KID}/datei?repo=${encodeURIComponent(f.repo)}`)]);
    const pos = (lauf?.body.lauf as { positionen: { pos: string; modelle?: unknown }[] }).positionen;
    expect(pos.map((p) => [p.pos, p.modelle])).toEqual([
      ["beweiser", [{ modell: "claude-opus-5-5", ab: "2026-10-23T02:03:54.938Z", aufrufe: 2, grund: null },
        { modell: "claude-opus-4-8", ab: "2026-10-23T02:14:42.416Z", aufrufe: 1,
          grund: "Claude Code stellte nach einer Meldung seiner Sicherung („cyber“) von claude-opus-5-5[1m] auf claude-opus-4-8 um (model_refusal_fallback)" }]],
      ["finder", [{ modell: "claude-sonnet-5-5", ab: "2026-10-23T02:20:00.000Z", aufrufe: 1, grund: null }]]]);
    expect(datei?.status).toBe(200);
    const sitze = ((datei?.body.datei as { laeufe: { sitze: { pos: string; modelle: { modell: string }[] | null }[] }[] }).laeufe[0]!).sitze;
    expect(sitze.map((x) => [x.pos, x.modelle?.map((m) => m.modell)])).toEqual([["beweiser", ["claude-opus-5-5", "claude-opus-4-8"]], ["finder", ["claude-sonnet-5-5"]]]);
  }, 120_000);
});

describe("die kleineren Lücken", () => {
  test("M1: ein Gründungsplan auf losgelöstem HEAD (git worktree add --detach) plant am Commit, statt 400", async () => {
    const f = fixture();
    const los = join(TMP, "losgeloest");
    sh(f.repo, "worktree", "add", "-q", "--detach", los, "HEAD");
    const [p] = await life(f, [get(`/api/founding-plan?${new URLSearchParams({ repo: los, role: "nur-ordner", anlass: "neu" })}`)]);
    expect([p?.status, p?.body.error]).toEqual([200, undefined]);
  }, 60_000);
  test("die Bibliothek einer Kopie ohne git: das Repo, aus dem sie kam, an seinem Commit; Fleets eigener Ordner geht vor", () => {
    const head = "a".repeat(40);
    expect(bibliothekQuelle(null, { repo: "/w/fleet", head })).toEqual({ root: "/w/fleet", head });
    expect(bibliothekQuelle("/hier", { repo: "/w/fleet", head })).toEqual({ root: "/hier", head: null });
    expect(bibliothekQuelle(null, {})).toBeNull();
    expect(bibliothekQuelle(null, { repo: "/w/fleet", head: "main" })).toBeNull();
  });
});
