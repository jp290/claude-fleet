// EIN AGENT ALS EIN OBJEKT (server/agenten.ts): gespeichert mit Namen, kopiert mit „copy of“ und dem Hash des Originals, an der Tür ganz
// genommen, geteilt mit „derived from“ und importiert nie in bypass. Rein bis auf den Speicher in einem Temp-Ordner.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  abgeleitete, agentAnDerTuer, agentAusDatei, agentDatei, agentenRoute, agentHash, EINGEBAUTE, eigeneAnsicht, eigenerAgent, herkunftSatz, katalog,
  kopie, liesAgenten, ortZugaben, schreibAgenten, wahlenAusSlot, zuletztHier, type AgentAnsicht, type AgentenServer, type WahlFeld,
} from "./agenten";

const ordner: string[] = [];
afterAll(() => { for (const o of ordner) rmSync(o, { recursive: true, force: true }); });
const frisch = (): string => { const o = mkdtempSync(join(tmpdir(), "agenten-")); ordner.push(o); return o; };
const gut = () => null;
const ALLE: readonly WahlFeld[] = ["harness", "model", "effort", "permissionMode", "rechte", "tools", "weglassen", "bibliothek", "notizbuch",
  "remote", "autoModeEnvironment", "schwelle", "profil", "sitz", "rolle"];
const ansicht = (eingang: unknown): AgentAnsicht => {
  const a = eigenerAgent(eingang, gut, []);
  if (typeof a === "string") throw new Error(a);
  return eigeneAnsicht(a);
};
const pruefer: AgentenServer["pruefe"] = (w) => w.model !== undefined && !/^claude-/.test(String(w.model)) ? "model must be a claude model" : null;
const server = (dir: string, k15: unknown = null): AgentenServer => ({ dir, k15: async () => k15, pruefe: pruefer, slotWahlen: () => null,
  historie: async () => [], ort: (p) => p });
const rufe = async (dir: string, method: string, pfad: string, body?: unknown, k15: unknown = null) => {
  const r = await agentenRoute(new Request(`http://x${pfad}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }),
    new URL(`http://x${pfad}`), server(dir, k15));
  return { status: r.status, body: await r.json() as Record<string, any> };
};

describe("der Hash deckt ab, was den Start formt", () => {
  test("dieselben Wahlen in anderer Reihenfolge und ein Feld auf null ergeben denselben Hash; Name und Kennung zählen nicht", () => {
    const a = ansicht({ id: "a", name: "A", wahlen: { model: "claude-haiku-5-5", effort: "low" } });
    const b = ansicht({ id: "b", name: "B", wahlen: { effort: "low", model: "claude-haiku-5-5", permissionMode: null } });
    expect(a.hash).toBe(b.hash);
  });
  test("ein anderes Modell oder eine andere Agent-MD ist ein anderer Hash", () => {
    const basis = agentHash({ model: "claude-haiku-5-5" }, null);
    expect(agentHash({ model: "claude-sonnet-5-5" }, null)).not.toBe(basis);
    expect(agentHash({ model: "claude-haiku-5-5" }, { titel: "t", text: "x", profil: "p" })).not.toBe(basis);
  });
});

describe("speichern", () => {
  test("ein Agent mit Namen bekommt eine freie Kennung, und eine fremde Wahl wird abgelehnt", () => {
    const a = eigenerAgent({ name: "Prüfer Eins", wahlen: { model: "claude-haiku-5-5" } }, gut, ["prufer-eins"]);
    expect(typeof a === "string" ? a : a.id).toBe("prufer-eins-2");
    expect(eigenerAgent({ name: "x", wahlen: { modell: "y" } }, gut, [])).toContain("not modell");
  });
  test("die Prüfung der Tür entscheidet: was die Tür ablehnte, wird nicht gespeichert", () => {
    expect(eigenerAgent({ name: "x", wahlen: { model: "gpt-9" } }, pruefer, [])).toBe("model must be a claude model");
  });
  test("ein eigener Agent trägt seine Agent-MD selbst, nicht als Verweis auf ein Profil", () => {
    expect(eigenerAgent({ name: "x", wahlen: { profil: "p" } }, gut, [])).toContain("not a profil reference");
  });
  test("die Datei übersteht Schreiben und Lesen, der Hash wird beim Lesen neu gerechnet", () => {
    const dir = frisch();
    const a = ansicht({ id: "a", name: "A", wahlen: { model: "claude-haiku-5-5" }, agentMd: { titel: "A.md", text: "Du prüfst." } });
    schreibAgenten(dir, [{ ...a, hash: "falsch" }]);
    expect(liesAgenten(dir)[0]?.hash).toBe(a.hash);
  });
});

describe("kopieren", () => {
  test("die Kopie ändert nur das Modell und trägt „copy of“ mit dem Hash des Originals", () => {
    const orig = ansicht({ id: "pruefer", name: "Prüfer", wahlen: { model: "claude-sonnet-5-5", effort: "low", permissionMode: "auto" },
      agentMd: { titel: "P.md", text: "Du prüfst." } });
    const k = kopie(orig, { wahlen: { model: "claude-haiku-5-5" } }, gut, ["pruefer"]);
    if (typeof k === "string") throw new Error(k);
    expect(k.name).toBe("copy of Prüfer");
    expect(k.kopieVon).toEqual({ id: "pruefer", name: "Prüfer", hash: orig.hash });
    expect(k.wahlen).toEqual({ model: "claude-haiku-5-5", effort: "low", permissionMode: "auto" });
    expect(k.agentMd).toEqual(orig.agentMd);
    expect(herkunftSatz(k)).toContain(`copy of Prüfer · ${orig.hash.slice(0, 12)}`);
  });
  test("eine Wahl auf null nimmt sie in der Kopie weg", () => {
    const orig = ansicht({ id: "o", name: "O", wahlen: { model: "claude-sonnet-5-5", effort: "low" } });
    const k = kopie(orig, { wahlen: { effort: null } }, gut, ["o"]);
    expect(typeof k === "string" ? k : k.wahlen).toEqual({ model: "claude-sonnet-5-5" });
  });
  test("die Kopie eines Profils schreibt seine Agent-MD aus und zeigt nicht mehr auf das Profil", () => {
    const [p] = abgeleitete({ profile: [{ id: "rev", name: "Review", modell: "claude-sonnet-5-5", datei: { titel: "r.md", abschnitte: [{ titel: "# R", text: "lies" }] } }] });
    const k = kopie(p!, { wahlen: { model: "claude-haiku-5-5" } }, gut, [p!.id]);
    if (typeof k === "string") throw new Error(k);
    expect(k.wahlen.profil).toBeUndefined();
    expect(k.agentMd).toEqual({ titel: "r.md", text: "# R\nlies", profil: "rev" });
  });
});

describe("der Bestand wird zu Agenten, ohne dass sich ein Start ändert", () => {
  const k15 = {
    profile: [{ id: "rev", name: "Review", agent: null, modell: "claude-sonnet-5-5", effort: null, schwelle: null,
      datei: { titel: "r.md", abschnitte: [{ titel: "# R", text: "lies" }] } }, { id: "ohne-md", name: "Ohne" }],
    konstellationen: [{ id: "k", name: "Prüfung", abgeleitetVon: "f".repeat(64), positionen: [{ id: "finder", name: "Finder" }] }],
  };
  test("ein Profil mit Agent-MD zeigt auf sich (profil) und trägt, was das Fenster an die Tür schickt; eines ohne erscheint nicht", () => {
    const liste = abgeleitete(k15);
    expect(liste.map((a) => a.id)).toEqual(["profil:rev", "sitz:k/finder"]);
    expect(liste[0]!.wahlen).toEqual({ profil: "rev", model: "claude-sonnet-5-5" });
  });
  test("an der Tür wird aus dem Profil-Agenten genau der Body, mit dem das Profil heute startet; die Agent-MD liest die Tür weiter aus dem Profil", () => {
    const r = agentAnDerTuer({ cwd: "/r", agent: "profil:rev" }, abgeleitete(k15), ALLE);
    if (!r.ok) throw new Error(r.error);
    expect(r.tuer.body).toEqual({ cwd: "/r", profil: "rev", model: "claude-sonnet-5-5" });
    expect(r.tuer.agentMd).toBeNull();
  });
  test("eine Position wird zum Body mit ihrem sitz", () => {
    const r = agentAnDerTuer({ cwd: "/r", agent: "sitz:k/finder" }, abgeleitete(k15), ALLE);
    expect(r.ok && r.tuer.body).toEqual({ cwd: "/r", sitz: "k/finder" });
  });
  test("eingebaut sind der Agent des Repos (ohne Wahl) und die Orchestratorin (Rolle → ihr Label)", () => {
    expect(EINGEBAUTE.map((a) => [a.id, a.wahlen])).toEqual([["repo", {}], ["orchestratorin", { rolle: "orchestratorin" }]]);
    const r = agentAnDerTuer({ cwd: "/r", agent: "orchestratorin" }, EINGEBAUTE, ALLE);
    expect(r.ok && r.tuer.body).toEqual({ cwd: "/r", label: "Orchestrator" });
  });
});

describe("die Tür nimmt den Agenten ganz", () => {
  const a = ansicht({ id: "a", name: "A", wahlen: { model: "claude-haiku-5-5", remote: true }, agentMd: { titel: "A.md", text: "Du prüfst." } });
  test("seine Wahlen und seine Agent-MD kommen in den Start, der Bezug trägt Name und Hash", () => {
    const r = agentAnDerTuer({ cwd: "/r", agent: "a", goal: "tu es" }, [a], ALLE);
    if (!r.ok) throw new Error(r.error);
    expect(r.tuer.body).toEqual({ cwd: "/r", goal: "tu es", model: "claude-haiku-5-5", remote: true });
    expect(r.tuer.agentMd?.text).toBe("Du prüfst.");
    expect(r.tuer.agent).toEqual({ id: "a", name: "A", hash: a.hash });
  });
  test("eine Wahl daneben wird abgelehnt — sonst startete etwas anderes, als die Fassung des Agenten zeigt", () => {
    const r = agentAnDerTuer({ cwd: "/r", agent: "a", effort: "high" }, [a], ALLE);
    expect(r.ok ? "" : r.error).toContain("effort beside it");
  });
  test("eine Tür, die eine seiner Wahlen nicht liest, lehnt ab, statt sie still fallen zu lassen", () => {
    const r = agentAnDerTuer({ agent: "a" }, [a], ALLE.filter((k) => k !== "remote"));
    expect(r.ok ? "" : r.error).toContain("does not read remote");
  });
  test("ohne agent bleibt der Body, wie er ist", () => {
    const body = { cwd: "/r", model: "claude-sonnet-5-5" };
    const r = agentAnDerTuer(body, [a], ALLE);
    expect(r.ok && r.tuer.body).toBe(body);
  });
});

describe("einen laufenden Sitz speichern", () => {
  test("die Wahlen des Slots unter den Türnamen; was ein Agent nicht trägt, wird genannt", () => {
    const w = wahlenAusSlot({ harness: null, model: "claude-haiku-5-5", effort: "low", permissionMode: "auto", rechte: null, tools: null, weglassen: { hooks: true },
      bibliothek: false, notizbuchWahl: null, remote: false, autoModeEnvironment: null, schwelle: null, agentMd: { profil: "p", titel: "t", text: "x", sha256: "" },
      sitz: null, rolle: null, packMcp: ["pw"], worktree: false });
    expect(w.wahlen).toEqual({ model: "claude-haiku-5-5", effort: "low", permissionMode: "auto", weglassen: { hooks: true }, bibliothek: false });
    expect(w.agentMd).toEqual({ titel: "t", text: "x", profil: "p" });
    expect(w.nichtGetragen.join()).toContain("pw");
  });
});

describe("teilen", () => {
  const orig = ansicht({ id: "pruefer", name: "Prüfer", wahlen: { model: "claude-sonnet-5-5", permissionMode: "auto", rechte: { stufe: "bauen" } },
    agentMd: { titel: "P.md", text: "Du prüfst." } });
  test("die Datei trägt Wahlen, Agent-MD und „derived from“ = den Hash hier; ein Import trägt ihn als abgeleitetVon", () => {
    const d = agentDatei(orig);
    if (typeof d === "string") throw new Error(d);
    expect(d.datei.abgeleitetVon).toBe(orig.hash);
    const imp = agentAusDatei(JSON.parse(JSON.stringify(d.datei)), {}, gut, []);
    if (typeof imp === "string") throw new Error(imp);
    expect(imp.agent.abgeleitetVon).toBe(orig.hash);
    // dieselbe Datei ist derselbe Agent: der Hash des Imports ist der, von dem er abgeleitet ist
    expect(imp.agent.hash).toBe(orig.hash);
    expect(imp.agent.importiert).toBe(true);
    expect(imp.agent.agentMd?.text).toBe("Du prüfst.");
    expect(imp.agent.wahlen.model).toBe("claude-sonnet-5-5");
  });
  test("ist der Name der Agent-MD hier schon vergeben, nimmt der Import seine eigene Kennung — kein fremdes Notizbuch", () => {
    const d = agentDatei(orig);
    if (typeof d === "string") throw new Error(d);
    const imp = agentAusDatei(d.datei, { id: "neu" }, gut, [], 1, ["pruefer"]);
    expect(typeof imp === "string" ? imp : imp.agent.agentMd?.profil).toBe("neu");
  });
  test("ein Import startet nie in bypass: die Datei, die es verlangt, wird abgelehnt, und die Tür lehnt einen importierten bypass-Agenten ab", () => {
    expect(agentAusDatei({ format: "fleet-agent/1", name: "x", wahlen: { permissionMode: "bypassPermissions" }, abgeleitetVon: "a".repeat(64) }, {}, gut, []))
      .toContain("never starts in bypass");
    const gefaelscht = { ...orig, wahlen: { permissionMode: "bypassPermissions" }, importiert: true as const };
    const r = agentAnDerTuer({ agent: "pruefer" }, [gefaelscht], ALLE);
    expect(r.ok ? "" : r.error).toContain("never starts in bypass");
  });
  test("eine Position oder eine Rolle reist nicht als Agent", () => {
    expect(agentDatei(EINGEBAUTE[1]!)).toContain("never carries a role");
    expect(agentDatei(abgeleitete({ konstellationen: [{ id: "k", positionen: [{ id: "p" }] }] })[0]!)).toContain("with its constellation");
  });
});

describe("die Route", () => {
  test("anlegen, kopieren mit nur anderem Modell, exportieren, in einen zweiten Speicher importieren", async () => {
    const hier = frisch(), dort = frisch();
    const neu = await rufe(hier, "POST", "/api/agenten", { name: "Prüfer", wahlen: { model: "claude-sonnet-5-5", effort: "low" } });
    expect(neu.status).toBe(201);
    const k = await rufe(hier, "POST", "/api/agenten/prufer/kopie", { wahlen: { model: "claude-haiku-5-5" } });
    expect(k.status).toBe(201);
    expect(k.body.agent.kopieVon.hash).toBe(neu.body.agent.hash);
    const d = await rufe(hier, "GET", `/api/agenten/${k.body.agent.id}/datei`);
    const imp = await rufe(dort, "POST", "/api/agenten/import", { datei: d.body.datei });
    expect(imp.status).toBe(201);
    expect(imp.body.agent.abgeleitetVon).toBe(k.body.agent.hash);
    expect(imp.body.agent.wahlen).toEqual({ model: "claude-haiku-5-5", effort: "low" });
    expect(katalog(dort, null).filter((a) => a.art === "eigen").length).toBe(1);
  });
  test("ein eingebauter Agent wird nicht geändert, sondern kopiert", async () => {
    const r = await rufe(frisch(), "PUT", "/api/agenten/repo", { name: "x" });
    expect(r.status).toBe(409);
    expect(r.body.error).toContain("copy it");
  });
  test("eine Änderung durch den Owner nimmt die Marke „importiert“", async () => {
    const dir = frisch();
    const imp = await rufe(dir, "POST", "/api/agenten/import", { datei: { format: "fleet-agent/1", name: "X", wahlen: {}, abgeleitetVon: "b".repeat(64) } });
    expect(imp.body.agent.importiert).toBe(true);
    const put = await rufe(dir, "PUT", `/api/agenten/${imp.body.agent.id}`, { wahlen: { effort: "low" } });
    expect(put.body.agent.importiert).toBeUndefined();
    expect(put.body.agent.abgeleitetVon).toBe("b".repeat(64));
  });
});

describe("was das Startfenster liest", () => {
  const liste = [...EINGEBAUTE, ...abgeleitete({ profile: [{ id: "rev", datei: { titel: "r", abschnitte: [{ titel: "# R", text: "x" }] } }] }), ansicht({ id: "a", name: "A" })];
  const z = (at: number, cwd: string, o: Partial<{ repo: string; label: string; profil: { id: string }; agent: { id: string } }> = {}) =>
    ({ at, cwd, repo: o.repo ?? null, label: o.label ?? null, profil: o.profil ?? null, agent: o.agent ?? null });
  test("je Agent der letzte Start in diesem Repo: mit Agent für ihn, mit Profil für den Profil-Agenten, mit ihrem Label für die Orchestratorin, sonst für den des Repos", () => {
    const je = zuletztHier(liste, [z(1, "/r", { agent: { id: "a" } }), z(5, "/r/sub", { agent: { id: "a" } }), z(2, "/wt/x", { repo: "/r", profil: { id: "rev" } }),
      z(3, "/r", { label: "Orchestrator" }), z(4, "/r"), z(9, "/anders", { agent: { id: "a" } }), z(8, "/r2")], "/r", (p) => p);
    expect(Object.fromEntries(je)).toEqual({ a: 5, "profil:rev": 2, orchestratorin: 3, repo: 4 });
  });
  const fassung = (teile: Record<string, Record<string, string | null>>) => ({ slot: 1, anlass: "neu" as const, hash: "h", claudeCode: null, hashUmfasst: "fuenf-teile" as const,
    teile: Object.entries(teile).map(([id, ab]) => ({ id: id as "liest", abschnitte: Object.entries(ab).map(([aid, text]) => ({ id: aid, quelle: null, aenderbar: true, bytes: 0, text })) })) });
  test("in Fleets Repo nennt die Vorschau, was der Ort über die Wahlen hinaus gibt, mit Grund; was der Agent selbst wählt, ist keine Zugabe", () => {
    const f = fassung({ liest: { systemzusatz: "FLEET-LISTENSCHNITT …", wissen: "BIBLIOTHEK …" },
      darf: { modus: "auto", einstellungen: JSON.stringify({ claudeMdExcludes: ["~/.claude/CLAUDE.md"], autoMode: { environment: ["x"] } }) } });
    const o = ortZugaben(f, {}, "fleet-sitz");
    expect(o.zugaben.map((x) => x.feld)).toEqual(["permissionMode", "systemzusatz", "bibliothek", "autoModeEnvironment", "claudeMdExcludes"]);
    expect(o.zugaben[0]!.warum).toContain("Fleets Repo");
    expect(ortZugaben(f, { permissionMode: "plan", bibliothek: false }, "fleet-sitz").zugaben.map((x) => x.feld)).toEqual(["systemzusatz", "autoModeEnvironment", "claudeMdExcludes"]);
    expect(ortZugaben(f, {}, "eigenes-setup").zugaben).toEqual([]);
  });
});
