// DIE DATENGRENZE AM TEXT (server/datengrenze.ts; Owner 29.10.: [Zitat entfernt] — keine Sperre zwischen
// Sitz-Paaren, sondern eine Grenze am Text). Ein als persönlich markierter Text geht an keiner Tür an einen Sitz, der nicht
// Anthropic ist: nicht als Nachricht, nicht im Start, nicht als Pack. Unmarkiertes fließt wie vorher. Die Türen sind die echten
// (ein Server je `life`, branches-testkit), die Packs liegen als Dateien im Zustandsordner, wie die Tür sie schreibt.
import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { branchTestkit, get, LIFE_DEADLINE_MS, persisted, post, type Answer, type Fixture } from "./branches-testkit";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import type { Sitz } from "../src/sitz";
import { sitzZumTeilen } from "../src/sitz";
import { fernpostAbgelehnt, istAnthropic, persoenlichAbgelehnt, weggelassenZeile, wissenFuerSitz } from "./datengrenze";
import { sitzWissen } from "./sitz-reise";
import { seatSkillFiles, type SeatKnowledge } from "./sitz-wissen";
import { schreibEigenenPack } from "./eigene-packs";
import { hashText, steineFuerAgentWahl } from "./setup-datei";

const { TMP, BIN, fixture, life, serve, cleanup } = branchTestkit();
afterAll(cleanup);
const ARGV = join(TMP, "argv");
mkdirSync(ARGV);
// die Ersatz-Agenten schreiben ihre Zeile (Ordner, dann jedes Argument mit NUL dahinter) je Slot in eine Datei und warten
for (const agent of ["claude", "pi"])
  writeFileSync(join(BIN, agent), `#!/bin/sh\nf="${ARGV}/slot-$FLEET_SELF_SLOT"\npwd > "$f.tmp"\n`
    + `for a in "$@"; do printf '%s\\0' "$a" >> "$f.tmp"; done\nmv "$f.tmp" "$f"\nexec sleep 600\n`, { mode: 0o755 });

// was der Sitz wirklich liest: der angehängte Systemprompt, inline (Claude Code) oder in der Datei, die die Zeile nennt
const startOf = async (slot: number): Promise<string> => {
  const file = join(ARGV, `slot-${slot}`);
  for (let i = 0; i < 200 && !existsSync(file); i++) await Bun.sleep(50);
  const [, ...rest] = readFileSync(file, "utf8").split("\n");
  const args = rest.join("\n").split("\0");
  const inline = args.indexOf("--append-system-prompt"), datei = args.indexOf("--append-system-prompt-file");
  const gelesen = (flag: number): string => {
    const wert = args[flag + 1] ?? "";
    return wert.startsWith("/") && existsSync(wert) ? readFileSync(wert, "utf8") : wert;
  };
  return [inline >= 0 ? gelesen(inline) : "", datei >= 0 ? gelesen(datei) : ""].filter(Boolean).join("\n\n");
};
const seat = (f: Fixture, slot: number): { openedAt: number; selfToken: string } => {
  const s = (persisted(f).slots as Record<string, { openedAt: number; selfToken: string }> | undefined)?.[String(slot)];
  if (!s?.selfToken) throw new Error(`Slot ${slot} ist in fleet.json nicht besetzt`);
  return s;
};
const as = (f: Fixture, slot: number, step: { method: string; path: string; body?: unknown }) => ({ ...step, token: null, self: seat(f, slot).selfToken });
const schreib = (f: Fixture, from: number, to: number, key: string, text: string, personal?: unknown) => as(f, from,
  post("/api/self/messages", { to: { kind: "session", slot: to }, payload: { kind: "text", text }, idempotencyKey: key,
    ...(personal === undefined ? {} : { personal }) }));
// die Sätze der Orchestratorin an die Enden einer Kante („You can write to slot …“) sind nicht, was die Probe sendet
const texte = (a: Answer | undefined): string[] =>
  ((a?.body.entries as { payload: { text: string } }[] | undefined) ?? []).map((m) => m.payload.text)
    .filter((text) => !text.startsWith("You can write to slot"));

describe("welcher Sitz Anthropic ist", () => {
  test("Claude mit Claude-Modell oder Voreinstellung ja; jedes andere Modell, jeder andere Harness und jedes Unbekannte nein", () => {
    expect(istAnthropic(null, null)).toBe(true);
    expect(istAnthropic("claude", "claude-opus-5-5[1m]")).toBe(true);
    expect(istAnthropic(null, "sonnet")).toBe(true);
    expect(istAnthropic("pi-zai", "glm-5.3")).toBe(false);
    expect(istAnthropic("pi-deepseek", null)).toBe(false);
    expect(istAnthropic("pi", "claude-opus-5-5")).toBe(false);
    expect(istAnthropic("codex", "gpt-6.1-sol")).toBe(false);
    expect(istAnthropic("claude", "glm-5.3")).toBe(false);
    expect(istAnthropic("ein-neuer-harness", null)).toBe(false);
    // die Ablehnung und die Fassungszeile nennen Stein, Marke und Modell
    expect(persoenlichAbgelehnt("pack x", "pi-zai", "glm-5.3")).toBe("personal pack x is not delivered to a non-Anthropic seat: pi-zai/glm-5.3");
    expect(weggelassenZeile("pack x", "pi-zai", "glm-5.3")).toBe("− pack x: personal, not delivered to pi-zai/glm-5.3");
  });
});

describe("eine persönliche Nachricht erreicht keinen Sitz, der nicht Anthropic ist", () => {
  test("an einen pi-Sitz 409 und nirgends im Postfach, an einen Claude-Sitz zugestellt, Unmarkiertes fließt an beide", async () => {
    const ORCH = 1, A = 2, B = 3, C = 4;
    const f = fixture();
    for (const d of ["a", "b", "c"]) mkdirSync(join(f.repo, d));
    const opened = await life(f, [post(`/api/slots/${ORCH}/open`, { cwd: f.repo, label: "🎛 Orchestratorin" }),
      post(`/api/slots/${A}/open`, { cwd: join(f.repo, "a"), label: "Claude A" }),
      post(`/api/slots/${B}/open`, { cwd: join(f.repo, "b"), label: "pi B", harness: "pi" }),
      post(`/api/slots/${C}/open`, { cwd: join(f.repo, "c"), label: "Claude C" })]);
    expect(opened.map((o) => o.status)).toEqual([200, 200, 200, 200]);
    const edges = await life(f, [as(f, ORCH, post("/api/self/kanten", { between: [A, B], why: "Probe der Datengrenze", minutes: 30 })),
      as(f, ORCH, post("/api/self/kanten", { between: [A, C], why: "Probe der Datengrenze", minutes: 30 }))]);
    expect(edges.map((e) => e.status)).toEqual([201, 201]);

    const GEHEIM = "Die Steuernummer des Owners lautet 12/345/67890.";
    const [anPi, anClaude, offen, ohneMarke, falsch, wiederholt, bPostfach, cPostfach, kante] = await life(f, [
      schreib(f, A, B, "p1", GEHEIM, true),
      schreib(f, A, C, "p2", GEHEIM, true),
      as(f, B, get("/api/self/messages")),
      schreib(f, A, B, "p3", "Nichts Persönliches, nur der Stand des Builds."),
      schreib(f, A, B, "p4", "Text", "ja"),
      // derselbe Schlüssel, dieselbe Marke: eine Wiederholung bleibt eine Wiederholung
      schreib(f, A, C, "p2", GEHEIM, true),
      as(f, B, get("/api/self/messages?unread=1")),
      as(f, C, get("/api/self/messages?unread=1")),
      as(f, ORCH, get("/api/self/kanten"))]);
    // an den pi-Sitz: 409 mit dem Grund, den die Tür nennt
    expect(anPi?.status).toBe(409);
    expect([anPi?.body.error, anPi?.body.refusal]).toEqual([persoenlichAbgelehnt("message p1", "pi", null), "personal-text"]);
    // der Text steht nirgends im Postfach des Empfängers, auch nicht in seiner Ansicht beider Enden
    expect(JSON.stringify(offen?.body)).not.toContain("12/345/67890");
    expect(texte(bPostfach)).toEqual(["Nichts Persönliches, nur der Stand des Builds."]);
    // an den Claude-Sitz: zugestellt
    expect([anClaude?.status, (anClaude?.body.holder as { slot: number } | null)?.slot]).toEqual([200, C]);
    expect(texte(cPostfach)).toEqual([GEHEIM]);
    expect([wiederholt?.status, wiederholt?.body.existing]).toEqual([200, true]);
    // alles Unmarkierte fließt wie heute, und eine falsche Marke ist ein Fehler des Aufrufs
    expect(ohneMarke?.status).toBe(200);
    expect(falsch?.status).toBe(400);
    // die Orchestratorin liest an der Kante mit, was dem Claude-Sitz ging
    const ks = kante?.body.kanten as { between: number[]; messages: { text: string }[] }[];
    expect(ks.find((k) => k.between.includes(C))?.messages.map((m) => m.text)).toEqual([GEHEIM]);
    expect(JSON.stringify(ks.find((k) => k.between.includes(B)))).not.toContain("12/345/67890");
  }, LIFE_DEADLINE_MS * 5);

  test("der Wechsel des Platzes nach dem Senden bringt den Text nicht zu einem Sitz, der nicht Anthropic ist", async () => {
    const ORCH = 1, A = 2, B = 3;
    const f = fixture();
    for (const d of ["a", "b"]) mkdirSync(join(f.repo, d));
    await life(f, [post(`/api/slots/${ORCH}/open`, { cwd: f.repo, label: "🎛 Orchestratorin" }),
      post(`/api/slots/${A}/open`, { cwd: join(f.repo, "a"), label: "Claude A" }),
      post(`/api/slots/${B}/open`, { cwd: join(f.repo, "b"), label: "Claude B" }), "save"]);
    await life(f, [as(f, ORCH, post("/api/self/kanten", { between: [A, B], why: "Probe", minutes: 30 }))]);
    const [gesendet] = await life(f, [schreib(f, A, B, "w1", "Ein persönlicher Satz.", true), "save"]);
    expect(gesendet?.status).toBe(200);
    // der Platz B wird danach von einem pi-Sitz geführt (derselbe Besitzer, ein anderer Harness): die Nachricht ist für ihn nie eingegangen
    const st = persisted(f);
    (st.slots as Record<string, Record<string, unknown>>)[String(B)]!.harness = "pi-zai";
    writeFileSync(join(f.state, "fleet.json"), JSON.stringify(st));
    const [ansicht] = await life(f, [as(f, B, get("/api/self/messages?unread=1"))]);
    expect(texte(ansicht)).toEqual([]);
  }, LIFE_DEADLINE_MS * 4);
});

describe("ein persönlicher Pack steht nicht im Start eines Sitzes, der nicht Anthropic ist", () => {
  const PACK = "datengrenze-probe";
  const TEXT = "# Datengrenze-Probe\n\nDas Konto des Owners endet auf 4711.";
  const mitPack = (): Fixture => {
    const f = fixture();
    schreibEigenenPack(f.state, { id: PACK, useWhen: "Wenn die Datengrenze geprüft wird.", text: TEXT, personal: true }, "test");
    return f;
  };

  test("der eigene persönliche Pack fehlt im Start des pi-Sitzes und steht im Start des Claude-Sitzes", async () => {
    const f = mitPack();
    const [claude, pi] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, label: "Claude", bibliothek: [PACK, "fleet-doors"] }),
      post("/api/slots/2/open", { cwd: f.repo, label: "pi", harness: "pi", bibliothek: [PACK, "fleet-doors"] }), "save"]);
    expect([claude?.status, pi?.status]).toEqual([200, 200]);
    const [fClaude, fPi] = await life(f, [get("/api/slots/1/fassung?anlass=laufend"), get("/api/slots/2/fassung?anlass=laufend")]);
    const wissen = (a: Answer | undefined): string => ((a?.body.teile as { id: string; abschnitte: { id: string; text: string | null }[] }[] | undefined) ?? [])
      .filter((teil) => teil.id === "liest").flatMap((teil) => teil.abschnitte).filter((x) => x.id === "wissen").map((x) => x.text ?? "").join("\n");
    // der Pack fehlt nicht still: die Fassung des pi-Sitzes nennt ihn mit Marke und Modell, die des Claude-Sitzes hat keine solche Zeile
    expect(wissen(fPi)).toContain(weggelassenZeile(`pack ${PACK}`, "pi", null));
    expect(wissen(fClaude)).not.toContain("not delivered");
    const [sClaude, sPi] = [await startOf(1), await startOf(2)];
    expect(sClaude).toContain(`--- ${PACK} `);
    expect(sClaude).toContain("endet auf 4711");
    expect(sPi).not.toContain("endet auf 4711");
    expect(sPi).not.toContain(PACK);
    // der Rest der Wahl kommt an: die Grenze nimmt nur den persönlichen Pack
    expect(sPi).toContain("--- fleet-doors (");
  }, LIFE_DEADLINE_MS * 2);

  // DER ECHTE WEG (ensureSlot → seatStartFor → seatSkillsWrite → piSeatSpawnCmd): die Zeile von pi und pi-unfenced nennt den Ordner der
  // Belegung, er liegt unter <state>/sitz-skills/<slot>-<openedAt>/ und trägt eine SKILL.md je Skill-Pack, ohne den persönlichen
  test("pi und pi-unfenced: der Ordner der Belegung trägt die Skill-Packs, die Zeile nennt ihn", async () => {
    const f = fixture();
    await life(f, [post("/api/slots/1/open", { cwd: f.repo, label: "pi", harness: "pi" }),
      post("/api/slots/2/open", { cwd: f.repo, label: "pi unfenced", harness: "pi-unfenced" }), "save"]);
    for (const slot of [1, 2]) {
      await startOf(slot);
      const args = readFileSync(join(ARGV, `slot-${slot}`), "utf8").split("\0");
      const dir = join(f.state, "sitz-skills", `${slot}-${seat(f, slot).openedAt}`);
      expect([slot, args[args.indexOf("--skill") + 1]]).toEqual([slot, dir]);
      expect(args.indexOf("--skill")).toBeLessThan(args.indexOf("--tui-mode"));
      const ids = readdirSync(dir).sort();
      expect([slot, ids.length > 0]).toEqual([slot, true]);
      // Skill-Packs der Bibliothek liegen da, der persönlich markierte (proaktiv-arbeiten, im Register ein Skill) fehlt
      expect(ids).toEqual(expect.arrayContaining(["fleet-doors", "setting-up-agents", "your-seat-in-fleet"]));
      expect(ids).not.toContain("proaktiv-arbeiten");
      for (const id of ids) expect(readFileSync(join(dir, id, "SKILL.md"), "utf8")).toMatch(new RegExp(`^---\\nname: ${id}\\n`));
    }
  }, LIFE_DEADLINE_MS * 2);

  // schlägt das Schreiben des Ordners fehl, verliert der pi-Sitz nur die Flagge, nicht seinen Start
  test("pi: ein Fehler beim Schreiben des Skill-Ordners lässt nur --skill weg, der Start bleibt", async () => {
    const f = fixture();
    mkdirSync(join(f.state, "sitz-skills"), { mode: 0o555 }); // die Wurzel ist nicht beschreibbar: der Ordner der Belegung entsteht nicht
    await life(f, [post("/api/slots/1/open", { cwd: f.repo, label: "pi", harness: "pi" }), "save"]);
    const start = await startOf(1);
    expect(start).toContain("--- who-it-is-for (");
    expect(readFileSync(join(ARGV, "slot-1"), "utf8").split("\0")).not.toContain("--skill");
  }, LIFE_DEADLINE_MS * 2);

  test("der persönliche Pack des Registers (working-with-the-owner) kommt nur in den Start des Claude-Sitzes", async () => {
    const f = fixture();
    const ID = "working-with-the-owner";
    await life(f, [post("/api/slots/1/open", { cwd: f.repo, label: "Claude", bibliothek: [ID, "fleet-doors"] }),
      post("/api/slots/2/open", { cwd: f.repo, label: "pi", harness: "pi", bibliothek: [ID, "fleet-doors"] }), "save"]);
    expect(await startOf(1)).toContain(`--- ${ID} `);
    const sPi = await startOf(2);
    expect(sPi).toContain("--- fleet-doors (");
    expect(sPi).not.toContain(ID);
  }, LIFE_DEADLINE_MS * 2);

  test("das Kind einer pi-Öffnerin erbt den persönlichen Pack nicht, das Kind einer Claude-Öffnerin erbt ihn", async () => {
    const f = mitPack();
    const [bPi, bClaude] = await life(f, [post("/api/branches", { repo: f.repo, name: "Erbe pi" }),
      post("/api/branches", { repo: f.repo, name: "Erbe claude" }), "save"]);
    expect([bPi?.status, bClaude?.status]).toEqual([201, 201]);
    await life(f, [post("/api/slots/12/open", { cwd: f.repo, label: "Öffnerin Claude", bibliothek: [PACK, "fleet-doors"] }),
      post("/api/slots/13/open", { cwd: f.repo, label: "Öffnerin pi", harness: "pi", bibliothek: [PACK, "fleet-doors"] }), "save"]);
    const [kPi, kClaude] = await life(f, [
      as(f, 13, post("/api/self/branches/open", { branch: String(bPi?.body.branch) })),
      as(f, 12, post("/api/self/branches/open", { branch: String(bClaude?.body.branch) })), "save"]);
    expect([kPi?.status, kClaude?.status, kPi?.body.error]).toEqual([200, 200, undefined]);
    expect(await startOf(Number(kClaude?.body.slot))).toContain("endet auf 4711");
    const sPi = await startOf(Number(kPi?.body.slot));
    expect(sPi).toContain("--- fleet-doors (");
    expect(sPi).not.toContain("endet auf 4711");
  }, LIFE_DEADLINE_MS * 3);
});

describe("die übrigen Türen", () => {
  test("Start, Konzepte: ein persönliches Konzept eines eigenen Agenten kommt nicht in den Start eines Sitzes, der nicht Anthropic ist", () => {
    const root = join(mkdtempSync(join(tmpdir(), "datengrenze-")), "konzepte");
    const lege = (id: string, text: string) => {
      mkdirSync(join(root, id), { recursive: true });
      writeFileSync(join(root, id, "versionen.jsonl"), JSON.stringify({ konzept: id, version: 1, sha256: hashText(text) }) + "\n");
      writeFileSync(join(root, id, "v1.md"), text);
    };
    lege("k-privat", "---\npersonal: true\n---\n# Privat\n\nDie Adresse des Owners steht hier.");
    lege("k-offen", "# Offen\n\nWas jeder lesen darf.");
    const wahl = { konzepte: ["k-privat", "k-offen"] };
    const claude = steineFuerAgentWahl(wahl, null, undefined, root, !istAnthropic(null, null));
    const pi = steineFuerAgentWahl(wahl, null, undefined, root, !istAnthropic("pi-zai", "glm-5.3"));
    expect(claude.block).toContain("Die Adresse des Owners");
    expect(pi.block).not.toContain("Die Adresse des Owners");
    expect(pi.block).toContain("Was jeder lesen darf.");
    expect(pi.weggelassen).toEqual(["k-privat"]);
  });

  const wissenMit = (...packs: SeatKnowledge["packs"][number][]): SeatKnowledge => ({ tree: "fleet", repoRoot: "/", head: "0123456789ab", packs });
  const PRIVAT = { id: "privat-probe", useWhen: "Wenn die Probe läuft.", sources: [], text: "# Privat\n\nDie Adresse des Owners.", personal: true as const };

  test("Skills: ein persönlicher Pack wird keine Skill-Datei für einen Sitz, der nicht Anthropic ist", () => {
    const k = wissenMit({ ...PRIVAT, weg: "skill" }, { ...PRIVAT, id: "offen-probe", text: "# Offen\n\nFür alle.", personal: undefined, weg: "skill" });
    const pfade = (harness: string | null, model: string | null) => seatSkillFiles(wissenFuerSitz(k, harness, model)).map((d) => d.pfad);
    expect(pfade(null, null)).toEqual([".claude/skills/privat-probe/SKILL.md", ".claude/skills/offen-probe/SKILL.md"]);
    expect(pfade("pi-zai", "glm-5.3")).toEqual([".claude/skills/offen-probe/SKILL.md"]);
    // ...auch nicht in den Belegungsordner von pi und pi-unfenced
    const piPfade = (harness: string) => seatSkillFiles(wissenFuerSitz(k, harness, "deepseek-flash"), { art: "pi", agentDir: null, ordner: "/s/1-2" }).map((d) => d.pfad);
    expect(piPfade("pi")).toEqual(["/s/1-2/offen-probe/SKILL.md"]);
    expect(piPfade("pi-unfenced")).toEqual(["/s/1-2/offen-probe/SKILL.md"]);
  });

  test("setup-datei-Import: ein mitgereister persönlicher Platz trägt die Marke in den Start und fällt für einen Nicht-Anthropic-Sitz weg", () => {
    const sitz = { konst: "k", pos: "p", herkunft: null, liest: [], block: true, auftrag: null, richtung: null, konzepte: [],
      persoenlich: [{ id: "mein-wissen", weg: "start", quellen: [], wofuer: "mein Platz", text: "Hier schrieb die Person ihren Text hinein." }] } as unknown as Parameters<typeof sitzWissen>[0];
    const k = sitzWissen(sitz, null);
    expect(k.packs.map((p) => [p.id, p.personal])).toEqual([["mein-wissen", true]]);
    expect(wissenFuerSitz(k, null, null).packs.length).toBe(1);
    expect(wissenFuerSitz(k, "pi-deepseek", "deepseek-flash").packs).toEqual([]);
  });

  test("Steine der Vorgängerin: ein persönlicher Pack, den sich die Öffnerin gab, geht nicht in den Start des pi-Kindes, in den des Claude-Kindes schon", async () => {
    const f = fixture();
    schreibEigenenPack(f.state, { id: "privat-probe", useWhen: "Wenn die Probe läuft.", text: "# Privat\n\nDas Konto des Owners endet auf 4711.", personal: true }, "test");
    const [bPi, bClaude] = await life(f, [post("/api/branches", { repo: f.repo, name: "Stein pi" }), post("/api/branches", { repo: f.repo, name: "Stein claude" }), "save"]);
    await life(f, [post("/api/slots/12/open", { cwd: f.repo, label: "Öffnerin Claude", bibliothek: ["fleet-doors"] }),
      post("/api/slots/13/open", { cwd: f.repo, label: "Öffnerin pi", harness: "pi", bibliothek: ["fleet-doors"] }), "save"]);
    const st = persisted(f);
    for (const slot of ["12", "13"])
      (st.slots as Record<string, Record<string, unknown>>)[slot]!.selbst = { jetzt: { packs: ["privat-probe"], zweck: null }, naechster: null, neu: [] };
    writeFileSync(join(f.state, "fleet.json"), JSON.stringify(st));
    const [kPi, kClaude] = await life(f, [
      as(f, 13, post("/api/self/branches/open", { branch: String(bPi?.body.branch) })),
      as(f, 12, post("/api/self/branches/open", { branch: String(bClaude?.body.branch) })), "save"]);
    expect([kPi?.status, kClaude?.status]).toEqual([200, 200]);
    expect(await startOf(Number(kClaude?.body.slot))).toContain("endet auf 4711");
    const sPi = await startOf(Number(kPi?.body.slot));
    expect(sPi).toContain("--- fleet-doors (");
    expect(sPi).not.toContain("endet auf 4711");
    // ...und die Fassung des pi-Kindes nennt den Stein als Zeile statt als Text
    const [fassung] = await life(f, [get(`/api/slots/${Number(kPi?.body.slot)}/fassung?anlass=laufend`)]);
    const wissen = ((fassung?.body.teile as { id: string; abschnitte: { id: string; text: string | null }[] }[] | undefined) ?? [])
      .filter((teil) => teil.id === "liest").flatMap((teil) => teil.abschnitte).filter((x) => x.id === "wissen").map((x) => x.text ?? "").join("\n");
    expect(wissen).toContain(weggelassenZeile("pack privat-probe", "pi", null));
  }, LIFE_DEADLINE_MS * 4);

  test("Richtung: sie reist nur als leerer Platz, nie mit Text", () => {
    const sitz = { liest: [], persoenlich: [], darf: { rechte: [], modus: "ask" }, notizbuch: null,
      richtung: { text: "Die Richtung des Owners, wörtlich.", personal: true } } as unknown as Sitz;
    expect(sitzZumTeilen(sitz).richtung).toEqual({ text: null, personal: true });
  });

  test("Ausleihe: ein pi-Sitz leiht einen persönlichen Pack nicht aus (409, Stein und Modell genannt), ein Claude-Sitz schon", async () => {
    const f = fixture();
    await life(f, [post("/api/slots/1/open", { cwd: f.repo, label: "Claude" }), post("/api/slots/2/open", { cwd: f.repo, label: "pi", harness: "pi" }), "save"]);
    const ID = "working-with-the-owner";
    const leihe = (slot: number, id: string) => as(f, slot, get(`/api/self/context/${id}`));
    const [claude, pi, offen] = await life(f, [leihe(1, ID), leihe(2, ID), leihe(2, "fleet-doors")]);
    expect(claude?.status).toBe(200);
    expect(JSON.stringify(claude?.body)).toContain("Working with the owner");
    expect([pi?.status, pi?.body.refusal, pi?.body.error]).toEqual([409, "personal-text", persoenlichAbgelehnt(`pack ${ID}`, "pi", null)]);
    expect(JSON.stringify(pi?.body)).not.toContain("Working with the owner");
    // der unmarkierte Pack bleibt ausleihbar
    expect(offen?.status).toBe(200);
  }, LIFE_DEADLINE_MS * 2);

  test("Ausleihe eines eigenen Packs: ein Claude-Sitz leiht ihn aus, auch ohne ihn gewählt zu haben; ein pi-Sitz nur den unmarkierten, den persönlichen 409", async () => {
    const f = fixture();
    schreibEigenenPack(f.state, { id: "deutsche-briefe", useWhen: "Wenn ein Brief geschrieben wird.", text: "# Deutsche Briefe\n\nDie Kontonummer endet auf 4711.", personal: true }, "test");
    schreibEigenenPack(f.state, { id: "offene-notiz", useWhen: "Wenn jemand fragt.", text: "# Offene Notiz\n\nFür alle Sitze." }, "test");
    // ein Pack mit der Id eines Registerpacks, von Hand abgelegt: das Register behält seinen Platz
    schreibEigenenPack(f.state, { id: "fleet-doors", useWhen: "Falsch.", text: "# Falsch\n\nSchattenpack." }, "test");
    await life(f, [post("/api/slots/1/open", { cwd: f.repo, label: "Claude" }), post("/api/slots/2/open", { cwd: f.repo, label: "pi", harness: "pi" }), "save"]);
    const leihe = (slot: number, id: string) => as(f, slot, get(`/api/self/context/${id}`));
    const [claude, claudeOffen, pi, piOffen, register, unbekannt] = await life(f, [leihe(1, "deutsche-briefe"), leihe(1, "offene-notiz"),
      leihe(2, "deutsche-briefe"), leihe(2, "offene-notiz"), leihe(1, "fleet-doors"), leihe(1, "gibt-es-nicht")]);
    expect(claude?.status).toBe(200);
    expect(JSON.stringify(claude?.body)).toContain("endet auf 4711");
    expect(claude?.body.origin).toBe("own-pack");
    expect([claudeOffen?.status, pi?.status, pi?.body.refusal, pi?.body.error, piOffen?.status])
      .toEqual([200, 409, "personal-text", persoenlichAbgelehnt("pack deutsche-briefe", "pi", null), 200]);
    expect(JSON.stringify(pi?.body)).not.toContain("4711");
    expect(JSON.stringify(register?.body)).not.toContain("Schattenpack");
    expect(register?.body.origin).toBe("fleet-manifest");
    expect(unbekannt?.status).toBe(404);
  }, LIFE_DEADLINE_MS * 2);

  // Fernpost (Tür 12, strenge Lesart: server/datengrenze.ts#fernpostAbgelehnt). Der Nachbar ist ein Ersatz in diesem Prozess, der
  // aufschreibt, was bei ihm ankommt: so zeigt der Test, dass vor dem Versand abgewiesen wird und nicht erst drüben.
  test("Fernpost: ein markierter Text verlässt diese Fleet nicht, an keinen Sitz der anderen Maschine (409 vor dem Versand), Unmarkiertes geht wie vorher", async () => {
    const SITZ = 2, DRUEBEN = 5;
    const angekommen: Record<string, unknown>[] = [];
    const nachbar = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (req) => {
      angekommen.push(await req.json() as Record<string, unknown>);
      return Response.json({ ok: true, existing: false, holder: DRUEBEN });
    } });
    const f = fixture();
    const dir = join(f.state, "bindung");
    mkdirSync(join(dir, "secrets"), { recursive: true });
    writeFileSync(join(dir, "secrets", "an-drueben.token"), "ausweis-an-drueben-0123456789abcdef0123\n");
    chmodSync(join(dir, "secrets", "an-drueben.token"), 0o600);
    writeFileSync(join(dir, "nachbarn.json"), JSON.stringify({ nachbarn: [{ name: "drueben", url: `http://127.0.0.1:${nachbar.port}`,
      ausweisAus: "an-drueben.token", erlaubt: [] }] }));
    const fl = await serve(f);
    try {
      expect((await fl.call(`/api/slots/${SITZ}/open`, { body: { cwd: f.repo, label: "Claude A" } })).status).toBe(200);
      let tok = "";
      for (let i = 0; i < 200 && !tok; i++) {
        tok = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(SITZ)]?.selfToken ?? "";
        if (!tok) await Bun.sleep(50);
      }
      const an = (key: string, text: string, personal?: boolean) => fl.call("/api/self/messages", { self: tok, body: {
        to: { kind: "remote", fleet: "drueben", slot: DRUEBEN }, payload: { kind: "text", text }, idempotencyKey: key,
        ...(personal === undefined ? {} : { personal }) } });
      // markiert, an einen Claude-Sitz (die sendende Seite weiß nicht, wer drüben sitzt): 409 mit dem Grund, nichts beim Nachbarn
      const markiert = await an("p1", "Persönliches für drüben", true);
      expect([markiert.status, markiert.body.refusal, markiert.body.error])
        .toEqual([409, "personal-text", fernpostAbgelehnt(true, "message p1", "drueben")]);
      expect(angekommen).toEqual([]);
      const box = (await fl.call("/api/self/messages", { self: tok })).body.entries as { payload: { text: string } }[];
      expect(box.map((m) => m.payload.text)).not.toContain("Persönliches für drüben");
      // unmarkiert und `personal: false` fließen wie vorher, und auf dem Draht steht kein neues Feld
      expect((await an("u1", "Unmarkiert für drüben")).status).toBe(200);
      expect((await an("u2", "Ausdrücklich nicht persönlich", false)).status).toBe(200);
      expect(angekommen.map((m) => (m.payload as { text: string }).text)).toEqual(["Unmarkiert für drüben", "Ausdrücklich nicht persönlich"]);
      expect(angekommen.map((m) => Object.keys(m).sort())).toEqual([["from", "idempotencyKey", "payload", "to"], ["from", "idempotencyKey", "payload", "to"]]);
    } finally {
      void nachbar.stop(true);
      await fl.stop();
    }
  }, LIFE_DEADLINE_MS * 2);
  // Plan-Packs einer Lane oder MAIN (Tür 9): die Marke kommt dort noch nicht an
  test.todo("Plan-Packs einer Lane oder MAIN: ein persönlicher Pack erreicht den Start eines Nicht-Anthropic-Sitzes nicht", () => {});
});
