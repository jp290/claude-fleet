// NEUE SESSION, EINE ORDNUNG (Runde 4 des Entwurfs, Owner 18.10. Z132 „[Zitat entfernt]“, docs/session-ui/entwurf.md): was eine Session beim Start
// bekommt, nach den fünf Fragen geordnet, die es für den Agenten beantwortet. Aus der Antwort des Gründungsplans (GET /api/founding-plan) wird
// eine Übersicht (Teile mit Frage, Herkunft, Stand und Tokens) und der Text, den der Agent liest (Blöcke mit Ort). Jede Frage kommt vom
// Server (Feld `frage` an Baustein und Anatomie-Teil, session-blocks.ts); dieses Modul ordnet nur. Kein DOM: src/sitzung.ts zeichnet.
import type { Answer, Baustein } from "./founding";
import { anatomieVon, jeToken, type AnatomieTeil } from "./k15-anatomie";
import { SESSION_FRAGEN, istFrage, type SessionFrage } from "../session-fragen";

export type Herkunft = "cc" | "du" | "ordner" | "fleet";
export const HERKUNFT_WORT: Readonly<Record<Herkunft, string>> = { cc: "Claude Code", du: "von dir", ordner: "Ordner", fleet: "Fleet" };
export type Ort = "system" | "werkzeuge" | "dateien" | "listen" | "erste" | "umgebung" | "aussen";
export const ORTE: readonly { id: Ort; wort: string; satz: string }[] = [
  { id: "system", wort: "Systemprompt", satz: "schreibt Claude Code; Fleet hängt hinten an" },
  { id: "werkzeuge", wort: "Werkzeuge", satz: "Beschreibung und Schema je Werkzeug" },
  { id: "dateien", wort: "Dateien", satz: "lädt Claude Code beim Start" },
  { id: "listen", wort: "Skills und Agenten", satz: "eine Zeile je Eintrag" },
  { id: "erste", wort: "Erste Nachricht", satz: "kommt nach dem Start in die Pane" },
  { id: "umgebung", wort: "Umgebung der Pane", satz: "kein Text, nur Variablen" },
  { id: "aussen", wort: "Von außen", satz: "wirkt, ohne dass der Agent es liest" },
];
// WO EIN BLOCK LANDET UND OB ER BLEIBT (Owner 19.10. 10:1x: „[Zitat entfernt]“, „[Zitat entfernt]“
// ). Die Agent.md sind die Dateien, die er als seine Anweisungen lädt: deine, die des Ordners und was Fleet dort
// hineinschreibt. „bleibt“ heißt: auch nach einem Neustart und bei einer Nachfolgerin, denn jeder Start setzt es neu
export type Platz = "agentmd" | "system" | "erste" | "jede" | "gedaechtnis" | "werkzeuge" | "listen" | "umgebung" | "aussen";
export type Dauer = "bleibt" | "jetzt" | "jede";
export const PLATZ: Readonly<Record<Platz, { wort: string; dauer: Dauer }>> = {
  agentmd: { wort: "in der Agent.md", dauer: "bleibt" }, system: { wort: "im Systemprompt", dauer: "bleibt" },
  erste: { wort: "als erste Nachricht", dauer: "jetzt" }, jede: { wort: "über jeder Nachricht", dauer: "jede" },
  gedaechtnis: { wort: "im Gedächtnis", dauer: "bleibt" }, werkzeuge: { wort: "bei den Werkzeugen", dauer: "bleibt" },
  listen: { wort: "in der Liste der Skills", dauer: "bleibt" }, umgebung: { wort: "in der Umgebung", dauer: "bleibt" },
  aussen: { wort: "in der Startzeile", dauer: "bleibt" },
};
export const DAUER: Readonly<Record<Dauer, { wort: string; satz: string }>> = {
  bleibt: { wort: "bleibt", satz: "Bekommt er bei jedem Start, auch nach einem Neustart und als Nachfolgerin." },
  jetzt: { wort: "nur jetzt", satz: "Bekommt er nur bei diesem Start; eine Nachfolgerin bekommt es nicht noch einmal." },
  jede: { wort: "jede Nachricht", satz: "Steht über jeder Nachricht, die Fleet ihm zustellt." },
};
export function platzVon(b: TextBlock): Platz {
  if (b.ort === "dateien") return b.herkunft === "cc" ? "gedaechtnis" : "agentmd";
  if (b.ort === "erste") return b.teil === "delivery-header" ? "jede" : "erste";
  return b.ort;
}

// was du machen willst: jede Rolle ist eine Tür und ein Ausgangsstand (Entwurf Runde 3/4)
export type SitzungRolle = "einfach" | "branch";

export interface Teil {
  // `name` in Alltagswörtern (Owner 09:5x „[Zitat entfernt]“), `fach` der Fachbegriff, wenn es einen gibt
  id: string; frage: SessionFrage; name: string; fach: string | null; zusatz: string | null; herkunft: Herkunft;
  stand: "an" | "abruf" | "aus";
  // warum hier kein Schalter steht; null, wenn einer steht
  fest: string | null;
  schalter: { baustein: string; an: boolean } | null;
  tokens: number; unbekannt: boolean;
}
export interface TextBlock {
  id: string; teil: string; frage: SessionFrage; ort: Ort; herkunft: Herkunft; titel: string | null;
  // null: kommt nicht in den Start; `laden`: der Text steht in dieser Datei und wird gelesen
  text: string | null; laden: string | null; tokens: number; falte: number; leise: boolean;
}
export interface Summe { alle: number; fleet: number; je: Record<SessionFrage, number>; herkunft: Record<SessionFrage, Record<Herkunft, number>> }
export interface SitzungModell { teile: Teil[]; bloecke: TextBlock[]; summe: Summe }
export interface Eingaben {
  rolle: SitzungRolle; auftrag: string; slot: number | null;
  // was /api/file je Pfad las: Text, "laedt" oder ein Fehlersatz
  dateien: ReadonlyMap<string, string | "laedt" | { fehler: string }>;
}

const utf8 = new TextEncoder();
const bytesVon = (t: string): number => utf8.encode(t).length;
// Fleets eigener Text in Tokens (session-blocks.ts#FLEET_BYTES_JE_TOKEN, mit der Antwort geliefert)
const fleetJe = (a: Answer): number => a.startSumme?.bytesJeToken.wert ?? 2.1;
const frageVon = (v: object, sonst: SessionFrage): SessionFrage => "frage" in v && istFrage(v.frage) ? v.frage : sonst;

// WÖRTER OHNE FLEET-WISSEN je Teil (Baustein-id oder Name des Anhangs); der Fachbegriff bleibt im Hover
const ALLTAG: Readonly<Record<string, string>> = {
  "self-credential": "Ausweis für Fleet", "delivery-header": "Kopfzeile jeder Nachricht", "spawn-profile": "Agent, Modell, Effort",
  "portable-contract": "Grundregeln von Fleet", "context-anchors": "Lesehinweise auf Fleets Wissen", "memory-pointer": "Hinweis auf dein Gedächtnis",
  "auto-memory": "Notizen von Claude", "owner-heft": "Deine Korrekturen", "lane-notes": "Notizen zur Aufgabe", "commit-expectation": "Pflicht zu committen",
  "lane-footer": "Wie er zurückmeldet", "role-card": "Rolle", "private-rulebook": "Fleets Regelbuch",
  Listenschnitt: "Gekürzte Liste der Skills", "Auto-Mode": "Hinweis zum Auto-Mode", Gepflogenheiten: "Fleets Gepflogenheiten",
};
// der Weg, auf dem die Tür liefert (server.ts#PlanWeg), in Alltagswörtern
const WEG_WORT: Readonly<Record<string, string>> = { plan: "über die Startzeile", Zustellung: "im Kopf jeder Nachricht", "native Datei": "als Datei im Ordner",
  Prompt: "in der ersten Nachricht", "Session-Datei": "in seiner Startdatei" };
// der Grund des Registers, warum „Nur Ordner“ einen Baustein nicht schaltet (session-blocks.ts#foundingSessionPlan), in den Worten des Fensters
const NUR_ORDNER = /^Nur Ordner liefert nur /;
const MIT_ROLLE = "Kommt nur mit einer Rolle (Lane, MAIN, Orchestratorin): „Mit anderen Sessions arbeiten“.";
// was die Tür trotz „aus“ im Plan liefert (server.ts#planDoorRow), je Baustein der Weg
function trotzdem(a: Answer): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of a.start.refusals) {
    const x = /^([a-z0-9:._-]+) ist im Plan aus, diese Tuer liefert es trotzdem \(([^)]+)\)/i.exec(r);
    if (x?.[1] && x[2]) m.set(x[1], x[2]);
  }
  return m;
}

export function sitzungModell(a: Answer, e: Eingaben, bausteinName: (b: Baustein) => string, omit: Readonly<Record<string, string>>): SitzungModell {
  const teile: Teil[] = [], bloecke: TextBlock[] = [];
  const an = anatomieVon(a.claudeCode);
  const cc = an ? jeToken(an) : 2.1, fl = fleetJe(a);
  const teil = (t: Omit<Teil, "zusatz" | "schalter" | "unbekannt" | "fest" | "fach"> & Partial<Pick<Teil, "zusatz" | "schalter" | "unbekannt" | "fest">>): Teil => {
    const alltag = ALLTAG[t.id] ?? ALLTAG[t.name];
    const x: Teil = { zusatz: null, schalter: null, unbekannt: false, fest: null, ...t, name: alltag ?? t.name, fach: alltag ? t.name : null };
    teile.push(x);
    return x;
  };
  const block = (b: Omit<TextBlock, "falte" | "leise" | "laden" | "titel"> & Partial<Pick<TextBlock, "falte" | "leise" | "laden" | "titel">>): void => {
    bloecke.push({ falte: 6, leise: false, laden: null, titel: null, ...b });
  };
  const gruppe = (id: string): readonly AnatomieTeil[] => an?.gruppen.find((g) => g.id === id)?.teile ?? [];
  const da = (t: AnatomieTeil): boolean => t.stand !== "aus";
  const tok = (t: AnatomieTeil, je: number): number => da(t) && t.bytes !== null ? t.bytes / je : 0;

  // CLAUDE CODES SYSTEMPROMPT: je Frage eine Zeile, je Abschnitt ein Block
  const SYS_WORT: Record<SessionFrage, string> = { auftrag: "Auftrag von Claude Code", umstaende: "Umgebung", hintergrund: "Gedächtnis",
    howto: "Grundregeln von Claude Code", konzepte: "Begriffe von Claude Code" };
  const sys = gruppe("systemprompt");
  for (const f of SESSION_FRAGEN) {
    const ab = sys.filter((t) => frageVon(t, "howto") === f.id);
    if (!ab.length) continue;
    const id = `sys-${f.id}`;
    teil({ id, frage: f.id, name: SYS_WORT[f.id], herkunft: "cc", stand: ab.some(da) ? "an" : "aus", tokens: ab.reduce((n, t) => n + tok(t, cc), 0),
      fest: "schreibt Claude Code selbst" });
    ab.forEach((t, i) => block({ id: `${id}-${i}`, teil: id, frage: f.id, ort: "system", herkunft: "cc", titel: null,
      text: da(t) ? t.text ?? null : null, tokens: tok(t, cc), falte: f.id === "howto" ? 6 : 8 }));
  }
  // WAS FLEET AN DEN SYSTEMPROMPT HÄNGT: je Anhang eine Zeile
  for (const [i, t] of gruppe("fleet").entries()) {
    const id = `fleet-${i}`;
    teil({ id, frage: frageVon(t, "howto"), name: t.name, herkunft: "fleet", stand: da(t) ? "an" : "aus", tokens: tok(t, fl),
      fest: da(t) ? "hängt Fleet an jeden Start mit Rolle; einzeln abschalten geht noch nicht" : t.satz });
    block({ id, teil: id, frage: frageVon(t, "howto"), ort: "system", herkunft: "fleet", text: da(t) ? t.text ?? null : null, tokens: tok(t, fl), falte: 4 });
  }
  // WERKZEUGE UND MCP: eine Zeile je Gruppe, der Text in einem Block
  const werkzeuge = gruppe("werkzeuge");
  if (werkzeuge.length) {
    const sofort = werkzeuge.filter((t) => t.stand === "an"), abruf = werkzeuge.filter((t) => t.stand === "abruf");
    const tk = werkzeuge.reduce((n, t) => n + tok(t, cc), 0);
    teil({ id: "werkzeuge", frage: frageVon(werkzeuge[0], "umstaende"), name: "Werkzeuge", zusatz: `${sofort.length} + ${abruf.length} auf Abruf`,
      herkunft: "cc", stand: "an", tokens: tk, fest: "bringt Claude Code mit; eine Rolle kann die Liste kürzen" });
    block({ id: "werkzeuge", teil: "werkzeuge", frage: frageVon(werkzeuge[0], "umstaende"), ort: "werkzeuge", herkunft: "cc", tokens: tk, falte: 8,
      text: [...sofort.map((t) => `## ${t.name}\n${t.text ?? ""}`.trim()), abruf.length ? `auf Abruf (nur der Name): ${abruf.map((t) => t.name).join(", ")}` : ""]
        .filter(Boolean).join("\n\n") });
  }
  const mcp = gruppe("mcp");
  if (mcp.length) {
    const tk = mcp.reduce((n, t) => n + tok(t, cc), 0), alle = mcp.every((t) => t.stand === "aus");
    teil({ id: "mcp", frage: frageVon(mcp[0], "umstaende"), name: "MCP-Server", zusatz: String(mcp.length), herkunft: "du", stand: alle ? "aus" : "an",
      tokens: tk, fest: alle ? mcp[0].satz : "aus deiner Konfiguration und deinem claude.ai-Konto" });
    block({ id: "mcp", teil: "mcp", frage: frageVon(mcp[0], "umstaende"), ort: "werkzeuge", herkunft: "du", tokens: tk, falte: 6,
      text: alle ? null : mcp.filter(da).map((t) => `## ${t.name} (${t.stand === "an" ? "an" : "auf Abruf"})\n${t.text ?? ""}`.trim()).join("\n\n") });
  }
  // SKILLS UND AGENTEN: was Claude Code mitbringt und was von dir kommt, je eine Zeile
  const listen = [...gruppe("skills"), ...gruppe("agenten")];
  for (const [id, wem, name] of [["listen-cc", "cc", "Skills und Agenten von Claude Code"], ["listen-du", "du", "Deine Skills und Agenten"]] as const) {
    const ts = listen.filter((t) => (t.weg === "mitgeliefert") === (wem === "cc"));
    if (!ts.length) continue;
    const aus = ts.filter((t) => t.stand === "aus").length, tk = ts.reduce((n, t) => n + tok(t, cc), 0);
    teil({ id, frage: frageVon(ts[0], "howto"), name, zusatz: aus ? `${ts.length - aus} von ${ts.length}` : String(ts.length), herkunft: wem, stand: "an",
      tokens: tk, unbekannt: ts.some((t) => da(t) && t.bytes === null), fest: "Fleet kürzt die Liste je Rolle; die Kürzung steht im Listenschnitt" });
    block({ id, teil: id, frage: frageVon(ts[0], "howto"), ort: "listen", herkunft: wem, tokens: tk, falte: 8,
      text: ts.filter(da).map((t) => t.stand === "name" || !t.text ? `- ${t.name}` : `- ${t.name}: ${t.text}`).join("\n") });
  }

  // FLEETS BAUSTEINE AUS DEM PLAN
  const wege = trotzdem(a), repo = a.plan.ort.pfad.replace(/\/+$/, "");
  for (const b of a.plan.bausteine) {
    const frage = frageVon(b, "umstaende");
    const kommt = b.zustand === "an" || wege.has(b.id);
    const bytes = typeof b.bytes === "number" ? b.bytes : null;
    if (b.id === "native-agents") { regeln(b, frage); continue; }
    if (b.id === "auto-memory") {
      const pfad = pfadVon(b.details);
      teil({ id: b.id, frage, name: "Notizen von Claude", zusatz: "MEMORY.md", herkunft: "cc", stand: kommt ? "an" : "aus", tokens: kommt && bytes ? bytes / cc : 0,
        fest: b.schaltbar.ja ? null : b.schaltbar.grund });
      block({ id: b.id, teil: b.id, frage, ort: "dateien", herkunft: "cc", titel: pfad ? kurz(pfad) : "MEMORY.md", text: null, laden: kommt ? pfad : null,
        tokens: kommt && bytes ? bytes / cc : 0 });
      continue;
    }
    const name = bausteinName(b);
    const nein = b.schaltbar.ja ? null : NUR_ORDNER.test(b.schaltbar.grund) ? MIT_ROLLE : b.schaltbar.grund;
    const grund = wege.has(b.id) ? `Kommt bei jedem Start mit, ${WEG_WORT[wege.get(b.id) ?? ""] ?? wege.get(b.id)}; abschalten geht noch nicht.`
      : b.id.startsWith("pack:") && b.zustand !== "an" ? omit[a.omitted.find((o) => `pack:${o.id}` === b.id)?.reason ?? ""] ?? nein
      : nein;
    const wort = kommt ? bausteinText(b.id, e.slot) : null;
    const tk = !kommt ? 0 : wort !== null ? bytesVon(wort) / fl : bytes ? bytes / fl : 0;
    // was in den Start kommt, steht im Text, auch wenn der Server dem Fenster seinen Wortlaut nicht gibt (luecken.md S11)
    const text = !kommt ? null : wort ?? `${ALLTAG[b.id] ?? name}: kommt in den Start${bytes ? ` (${bytes.toLocaleString("de-DE")} Byte)` : ""}; den Wortlaut zeigt das Fenster noch nicht.`;
    teil({ id: b.id, frage, name, herkunft: "fleet", stand: kommt ? "an" : "aus", tokens: tk, unbekannt: kommt && wort === null && bytes === null,
      fest: grund, schalter: b.schaltbar.ja && !wege.has(b.id) ? { baustein: b.id, an: b.zustand === "an" } : null });
    // wo er landet, sagt der Weg, auf dem die Tür ihn liefert, wo sie ihn nennt (ein Prompt ist die erste Nachricht)
    block({ id: b.id, teil: b.id, frage, ort: wege.get(b.id) === "Prompt" ? "erste" : ortVon(b), herkunft: "fleet", text, tokens: tk, falte: 4,
      leise: b.id === "spawn-profile" || b.id === "self-credential" || wort === null });
  }

  // DER AUFTRAG: bei einem Branch das Ziel als erste Nachricht; ohne Branch nimmt die Tür heute keinen
  const ziel = e.auftrag.trim();
  const kopf = `[fleet-zustellung · Ziel eines Branches (vom Öffner, POST /api/branches/open) · path=branch-goal${e.slot !== null ? ` · Slot ${e.slot}` : ""} · naechster Schritt: arbeite am Ziel dieses Branches · Grenze: sein Worktree und Branch]`;
  const auftragText = e.rolle === "branch" && ziel ? `${kopf} ${ziel}` : null;
  teil({ id: "auftrag", frage: "auftrag", name: e.rolle === "branch" ? "Ziel des Branches" : "Dein Auftrag", herkunft: "du",
    stand: auftragText ? "an" : "aus", tokens: auftragText ? bytesVon(auftragText) / fl : 0,
    fest: e.rolle === "branch" ? null : "Ohne Branch nimmt die Tür heute keinen Auftrag; du schreibst ihm nach dem Start." });
  block({ id: "auftrag", teil: "auftrag", frage: "auftrag", ort: "erste", herkunft: "du", text: auftragText, tokens: auftragText ? bytesVon(auftragText) / fl : 0, falte: 10 });

  // die Dateien, die Claude Code selbst lädt: deine (Konfig-Ordner, Home) und die des Ordners, je eine Zeile, je Datei ein Block
  function regeln(b: Baustein, frage: SessionFrage): void {
    const d = detailsVon(b.details);
    const datei = d.dateien.map((x) => ({ ...x, wem: x.pfad.startsWith(`${repo}/`) ? "ordner" as const : "du" as const }));
    for (const x of d.nachgeladen) if (!datei.some((y) => y.pfad === x)) datei.push({ pfad: x, bytes: null, wem: x.startsWith(`${repo}/`) ? "ordner" : "du" });
    for (const [wem, id, name] of [["du", "regeln-du", "Deine Regeln"], ["ordner", "regeln-ordner", "Regeln des Ordners"]] as const) {
      const meine = datei.filter((x) => x.wem === wem);
      const tk = meine.reduce((n, x) => n + (x.bytes ?? geladenBytes(x.pfad)) / cc, 0);
      teil({ id, frage, name, zusatz: meine.length ? String(meine.length) : null, herkunft: wem, stand: meine.length ? "an" : "aus", tokens: tk,
        fest: meine.length ? "lädt Claude Code selbst; ändern in der Datei" : "Der Ordner hat keine AGENTS.md und keine CLAUDE.md." });
      if (!meine.length) block({ id, teil: id, frage, ort: "dateien", herkunft: wem, text: null, tokens: 0 });
      meine.forEach((x, i) => block({ id: `${id}-${i}`, teil: id, frage, ort: "dateien", herkunft: wem, titel: kurz(x.pfad), text: null, laden: x.pfad,
        tokens: (x.bytes ?? geladenBytes(x.pfad)) / cc, falte: 8 }));
    }
  }
  function geladenBytes(pfad: string): number {
    const t = e.dateien.get(pfad);
    return typeof t === "string" ? bytesVon(t) : 0;
  }

  // Texte aus Dateien: was gelesen ist, steht im Block; die Tokens bleiben die gemessenen
  for (const b of bloecke) if (b.laden) {
    const t = e.dateien.get(b.laden);
    if (typeof t === "string") b.text = t;
  }
  return { teile, bloecke, summe: summeVon(teile) };
}

function summeVon(teile: readonly Teil[]): Summe {
  const leer = (): Record<Herkunft, number> => ({ cc: 0, du: 0, ordner: 0, fleet: 0 });
  const je = Object.fromEntries(SESSION_FRAGEN.map((f) => [f.id, 0])) as Record<SessionFrage, number>;
  const herkunft = Object.fromEntries(SESSION_FRAGEN.map((f) => [f.id, leer()])) as Record<SessionFrage, Record<Herkunft, number>>;
  for (const t of teile) { je[t.frage] += t.tokens; herkunft[t.frage][t.herkunft] += t.tokens; }
  const alle = Object.values(je).reduce((n, x) => n + x, 0);
  return { alle, fleet: teile.filter((t) => t.herkunft === "fleet").reduce((n, t) => n + t.tokens, 0), je, herkunft };
}

// was Fleet für einen Baustein wörtlich schreibt, wo der Wortlaut fest ist; null = der Server liefert ihn nicht mit
function bausteinText(id: string, slot: number | null): string | null {
  if (id === "delivery-header") return `[fleet-zustellung · Owner-Credential${slot !== null ? ` · Slot ${slot}` : ""}]`;
  if (id === "self-credential") return "FLEET_SELF_TOKEN=••••••••   FLEET_SLOT   FLEET_URL   (sein Ausweis; der Wert steht nie im Text)";
  if (id === "spawn-profile") return "Agent, Modell und Effort stehen in der Startzeile.";
  return null;
}
function ortVon(b: Baustein): Ort {
  if (b.id === "self-credential") return "umgebung";
  if (b.id === "spawn-profile") return "aussen";
  if (b.id === "delivery-header" || b.id === "task-brief" || b.id === "main-rail" || b.id === "orchestrator-card" || b.id.startsWith("pack:")) return "erste";
  return "dateien";
}
const kurz = (p: string): string => p.replace(/^\/Users\/[^/]+/, "~").replace(/^\/home\/[^/]+/, "~");
const rec = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
function pfadVon(v: unknown): string | null {
  const p = rec(v)?.pfad;
  return typeof p === "string" ? p : null;
}
function detailsVon(v: unknown): { dateien: { pfad: string; bytes: number | null }[]; nachgeladen: string[] } {
  const r = rec(v);
  const dateien = Array.isArray(r?.dateien) ? r.dateien.flatMap((x: unknown) => {
    const y = rec(x);
    return y && typeof y.pfad === "string" ? [{ pfad: y.pfad, bytes: typeof y.bytes === "number" ? y.bytes : null }] : [];
  }) : [];
  const nachgeladen = Array.isArray(r?.nachgeladen) ? r.nachgeladen.filter((x: unknown): x is string => typeof x === "string") : [];
  return { dateien, nachgeladen };
}
