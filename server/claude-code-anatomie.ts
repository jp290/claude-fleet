// K15 · WAS CLAUDE CODE SELBST IN DEN START LEGT, aufgeschlüsselt (Owner 16.10. 11:3x: „[Zitat entfernt]“
// ). Zwei Quellen, beide am 16.10. an Claude Code 2.1.301 belegt (docs/neuaufbau/befunde/k15-anforderungen.md, Stand 12:1x):
// das Transkript einer Session — die Anhänge vor ihrer ersten Antwort tragen den Systemprompt im Wortlaut (prompt_snapshot), die
// Listen der Skills, Agenten, aufgeschobenen Werkzeuge und MCP-Instruktionen und die geladenen Dateien; die Zeile api-request-shape
// trägt die erste Anfrage mit jedem Werkzeug samt Schema — und die init-Zeile von `claude -p --output-format stream-json --verbose`
// mit den aktiven Werkzeugen, MCP-Servern und Plugins samt Quelle.
// Für den Gründungsplan (Entscheid der Bauleitung 80917044, Quelle B): Claude Codes Teil aus dem Kopf des Transkripts einer Session in
// Fleets eigenem Repo (waehleQuelle), Fleets Teil aus Fleets Code (der Aufrufer reicht ihn als FleetTeil), was vom Repo abhängt aus
// dessen Dateien (claudeNamen). Die Auszüge sind rein; Dateien lesen nur transkriptKopf, kopfVon, claudeNamen und repoMcp.
import { closeSync, openSync, readFileSync, readSync, readdirSync, statSync } from "node:fs";
import type { AnatomieGruppe, AnatomieQuelle, AnatomieTeil, CcAnatomie } from "../src/k15-anatomie";
import { anatomieFrage, type SessionFrage } from "../session-blocks";

const BOUNDARY = "__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__";

export interface AnatomieText { readonly text: string; readonly bytes: number }
export interface Anatomie {
  readonly systemprompt: readonly AnatomieText[];
  readonly skills: readonly (AnatomieText & { readonly name: string })[];
  readonly agenten: readonly { readonly name: string; readonly text: string; readonly eingebaut: boolean }[];
  readonly aufgeschoben: readonly string[];
  readonly mcpWerkzeuge: readonly string[];
  readonly mcp: readonly { readonly name: string; readonly text: string }[];
  readonly dateien: readonly { readonly pfad: string; readonly bytes: number }[];
  /** Eingabe-Tokens der ersten Antwort (input + cache_creation + cache_read); null ohne Antwort */
  readonly tokens: number | null;
  /** der erste Block der ersten Anfrage („You are Claude Code …“), der vor dem Systemprompt-Abbild steht; null ohne api-request-shape */
  readonly identitaet: AnatomieText | null;
  /** die Werkzeuge der ersten Anfrage, je mit den Bytes ihrer Definition (Beschreibung und Schema); leer ohne api-request-shape */
  readonly werkzeuge: readonly { readonly name: string; readonly bytes: number; readonly text: string; readonly abruf: boolean; readonly server: boolean }[];
  /** Bytes der ersten Anfrage: Systemblöcke, Werkzeug-Definitionen und Nachrichten-Texte; null ohne api-request-shape */
  readonly anfrageBytes: number | null;
  readonly version: string | null;
  readonly modell: string | null;
  /** der erste Zeitstempel (ms), also der Start; null ohne */
  readonly seit: number | null;
}

const text = (t: string): AnatomieText => ({ text: t, bytes: Buffer.byteLength(t) });
const strs = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const obj = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
const zahl = (v: unknown): number => typeof v === "number" && Number.isFinite(v) ? v : 0;

function zeilen(jsonl: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const l of jsonl.split("\n")) {
    if (!l.trim()) continue;
    try { const j = obj(JSON.parse(l)); if (j) out.push(j); } catch { /* eine abgeschnittene Zeile am Ende eines laufenden Transkripts */ }
  }
  return out;
}

// eine Liste „- name: Beschreibung“ (auch über mehrere Zeilen) in Einträge, je Name der seine; ein Name ohne Eintrag bleibt leer stehen
function eintraege(inhalt: string, namen: readonly string[]): (AnatomieText & { name: string })[] {
  const teile = inhalt ? inhalt.split(/\n(?=- )/) : [];
  return namen.map((name) => {
    const t = teile.find((x) => x.startsWith(`- ${name}:`) || x === `- ${name}`) ?? "";
    return { name, ...text(t) };
  });
}

// eine Werkzeug-Definition der Anfrage: die Beschreibung und die Namen der Parameter als Text; ein Server-Werkzeug (mit `type`) hat keine
function werkzeugText(t: Record<string, unknown>): string {
  const props = Object.keys(obj(obj(t.input_schema)?.properties) ?? {});
  return [typeof t.description === "string" ? t.description : "", props.length ? `Parameter: ${props.join(", ")}` : ""].filter(Boolean).join("\n\n");
}

export function anatomieAusTranskript(jsonl: string): Anatomie | string {
  const vorher: Record<string, unknown>[] = [];
  let antwort: Record<string, unknown> | null = null;
  let form: Record<string, unknown> | null = null, version: string | null = null, seit: number | null = null, nachrichtenBytes = 0;
  for (const j of zeilen(jsonl)) {
    if (version === null && typeof j.version === "string") version = j.version;
    if (seit === null && typeof j.timestamp === "string" && Number.isFinite(Date.parse(j.timestamp))) seit = Date.parse(j.timestamp);
    if (j.type === "assistant") { antwort = j; break; }
    const a = obj(j.attachment);
    if (j.type === "attachment" && a) vorher.push(a);
    if (j.type === "api-request-shape" && !form) form = obj(j.shape);
    const inhalt = j.type === "api-request-blob" ? obj(j.message)?.content : undefined;
    if (Array.isArray(inhalt)) for (const c of inhalt) { const t = obj(c)?.text; if (typeof t === "string") nachrichtenBytes += Buffer.byteLength(t); }
  }
  const von = (typ: string) => vorher.filter((a) => a.type === typ);
  const snap = von("prompt_snapshot").at(-1);
  if (!snap) return "kein prompt_snapshot vor der ersten Antwort";
  const skills = von("skill_listing").flatMap((a) => eintraege(typeof a.content === "string" ? a.content : "", strs(a.names)));
  const agenten = von("agent_listing_delta").flatMap((a) => {
    const linien = strs(a.addedLines), eingebaut = new Set(strs(a.builtInTypes));
    return strs(a.addedTypes).map((name) => ({ name, text: linien.find((l) => l.startsWith(`- ${name}:`)) ?? "", eingebaut: eingebaut.has(name) }));
  });
  const aufgeschoben = von("deferred_tools_delta").flatMap((a) => strs(a.addedNames));
  const mcp = von("mcp_instructions_delta").flatMap((a) => { const b = strs(a.addedBlocks); return strs(a.addedNames).map((name, i) => ({ name, text: b[i] ?? "" })); });
  const dateien = von("instructions").flatMap((a) => (Array.isArray(a.files) ? a.files : []).map(obj).filter((f) => f !== null && typeof f.path === "string")
    .map((f) => ({ pfad: f!.path as string, bytes: typeof f!.content === "string" ? Buffer.byteLength(f!.content) : 0 })));
  const usage = obj(obj(antwort?.message)?.usage);
  const bloecke = (Array.isArray(form?.system) ? form.system : []).map(obj).flatMap((b) => typeof b?.text === "string" ? [b.text] : []);
  const werkzeuge = (Array.isArray(form?.tools) ? form.tools : []).map(obj).flatMap((t) => t && typeof t.name === "string"
    ? [{ name: t.name, bytes: Buffer.byteLength(JSON.stringify(t)), text: werkzeugText(t), abruf: t.defer_loading === true, server: typeof t.type === "string" }] : []);
  const modell = obj(antwort?.message)?.model, erster = bloecke[0];
  return {
    systemprompt: strs(snap.systemPrompt).filter((t) => t !== BOUNDARY).map(text),
    skills, agenten,
    aufgeschoben: aufgeschoben.filter((n) => !n.startsWith("mcp__")),
    mcpWerkzeuge: aufgeschoben.filter((n) => n.startsWith("mcp__")),
    mcp, dateien,
    tokens: usage ? zahl(usage.input_tokens) + zahl(usage.cache_creation_input_tokens) + zahl(usage.cache_read_input_tokens) : null,
    // der erste Systemblock steht nicht im Abbild, wenn das Abbild mit dem zweiten beginnt
    identitaet: erster !== undefined && bloecke.length > 1 && !strs(snap.systemPrompt).includes(erster) ? text(erster) : null,
    werkzeuge,
    anfrageBytes: form ? bloecke.reduce((n, b) => n + Buffer.byteLength(b), 0) + werkzeuge.reduce((n, w) => n + w.bytes, 0) + nachrichtenBytes : null,
    version, modell: typeof modell === "string" ? modell : null, seit,
  };
}

export interface InitTeile {
  readonly claude: string | null;
  readonly werkzeuge: readonly string[];
  readonly mcpServer: readonly { readonly name: string; readonly status: string }[];
  readonly agenten: readonly string[];
  readonly skills: readonly string[];
  readonly befehle: readonly string[];
  readonly plugins: readonly { readonly name: string; readonly quelle: string | null; readonly pfad: string | null }[];
}

export function anatomieAusInit(jsonl: string): InitTeile | string {
  const init = zeilen(jsonl).find((j) => j.type === "system" && j.subtype === "init");
  if (!init) return "keine init-Zeile";
  for (const k of ["tools", "mcp_servers", "agents", "skills", "slash_commands", "plugins"])
    if (init[k] !== undefined && !Array.isArray(init[k])) return `init-Zeile schief: ${k}`;
  const liste = (k: string) => (Array.isArray(init[k]) ? init[k] as unknown[] : []).map(obj).filter((x) => x !== null) as Record<string, unknown>[];
  return {
    claude: typeof init.claude_code_version === "string" ? init.claude_code_version : null,
    werkzeuge: strs(init.tools),
    mcpServer: liste("mcp_servers").filter((m) => typeof m.name === "string").map((m) => ({ name: m.name as string, status: typeof m.status === "string" ? m.status : "unbekannt" })),
    agenten: strs(init.agents), skills: strs(init.skills), befehle: strs(init.slash_commands),
    plugins: liste("plugins").filter((p) => typeof p.name === "string")
      .map((p) => ({ name: p.name as string, quelle: typeof p.source === "string" ? p.source : null, pfad: typeof p.path === "string" ? p.path : null })),
  };
}

// --- DER KOPF EINES TRANSKRIPTS: alles bis einschließlich der ersten Antwort -----------------------------------------------------
// Am 16.10. lagen die Köpfe der jüngsten 30 Fleet-Transkripte bei höchstens 366 KB; 512 KiB lassen Raum für längere Regeldateien.
// `ganz` heißt: die erste Antwort steht darin. Ein Kopf ohne sie (die Session hat noch nicht geantwortet, oder er ist größer als das
// Budget) trägt noch Version und Start, aber keine Messung.
const KOPF_BUDGET = 512 * 1024;
export function transkriptKopf(pfad: string, budget = KOPF_BUDGET): { text: string; ganz: boolean } | null {
  let fd: number;
  try { fd = openSync(pfad, "r"); } catch { return null; }
  try {
    const buf = Buffer.alloc(budget);
    const t = buf.toString("utf8", 0, readSync(fd, buf, 0, budget, 0));
    let at = 0;
    for (let nl = t.indexOf("\n"); nl >= 0; at = nl + 1, nl = t.indexOf("\n", at)) {
      const zeile = t.slice(at, nl);
      if (!zeile.includes('"type":"assistant"')) continue;
      // ein Nutzertext kann die Zeichenfolge enthalten: es zählt nur eine Zeile, die selbst die Antwort ist
      try { if (obj(JSON.parse(zeile))?.type === "assistant") return { text: t.slice(0, nl), ganz: true }; } catch { /* abgeschnitten */ }
    }
    return { text: t.slice(0, at), ganz: false };
  } catch { return null; } finally { closeSync(fd); }
}

export interface Kopf {
  readonly version: string | null;
  readonly seit: number | null;
  readonly cwd: string | null;
  /** eine interaktive Session (entrypoint "cli"); `claude -p` schreibt einen anderen Systemprompt */
  readonly interaktiv: boolean;
  /** die Rolle, deren Listenschnitt Fleet beim Start anhängte (FLEET-LISTENSCHNITT (<rolle>, …)); null = nicht von Fleet gestartet */
  readonly fleetRolle: string | null;
  readonly anatomie: Anatomie | null;
}
function kopfDaten(text: string): Omit<Kopf, "anatomie" | "fleetRolle"> {
  let version: string | null = null, seit: number | null = null, cwd: string | null = null, interaktiv = false;
  for (const j of zeilen(text)) {
    if (version === null && typeof j.version === "string") version = j.version;
    if (seit === null && typeof j.timestamp === "string" && Number.isFinite(Date.parse(j.timestamp))) seit = Date.parse(j.timestamp);
    if (cwd === null && typeof j.cwd === "string") { cwd = j.cwd; interaktiv = j.entrypoint === "cli"; }
    if (version !== null && seit !== null && cwd !== null) break;
  }
  return { version, seit, cwd, interaktiv };
}
// der gelesene Kopf je Datei: ein ganzer Kopf ändert sich nicht mehr und bleibt im Speicher; einer ohne Antwort wird jedes Mal neu gelesen
const koepfe = new Map<string, Kopf>();
const KOEPFE_MAX = 64;
export function kopfVon(pfad: string): Kopf | null {
  const da = koepfe.get(pfad);
  if (da) return da;
  const k = transkriptKopf(pfad);
  if (!k) return null;
  const a = k.ganz ? anatomieAusTranskript(k.text) : null;
  const anatomie = a && typeof a !== "string" ? a : null;
  const schnitt = anatomie?.systemprompt.find((x) => x.text.startsWith("FLEET-LISTENSCHNITT ("));
  const kopf: Kopf = { ...kopfDaten(k.text), fleetRolle: schnitt ? /^FLEET-LISTENSCHNITT \(([a-z]+)/.exec(schnitt.text)?.[1] ?? null : null, anatomie };
  if (k.ganz) {
    if (koepfe.size >= KOEPFE_MAX) koepfe.delete(koepfe.keys().next().value ?? "");
    koepfe.set(pfad, kopf);
  }
  return kopf;
}

// DIE KANDIDATEN: die jüngsten Transkripte in Fleets eigenem Repo — dem Hauptordner und seinen Worktrees (<root>.worktrees/…), geprüft am
// cwd, das Claude Code selbst ins Transkript schreibt; der Ordnername allein ist mehrdeutig. Eine Session in einem anderen Repo ist nie
// Kandidat, und ihr Transkript wird nicht gelesen: eine laufende fällt schon an ihrem Slot-Ordner heraus. `live` sagt je Datei Slot,
// Rolle und Ordner einer laufenden Session; eine beendete trägt die Rolle ihres Listenschnitts.
export interface Kandidat { readonly slot: number | null; readonly rolle: string; readonly ort: string; readonly kopf: Kopf }
const ROLLE_WORT: Record<string, string> = { lane: "Lane", orchestrator: "Orchestratorin", main: "MAIN oder Session ohne Rolle" };
const ORDNER_MAX = 8, DATEIEN_JE_ORDNER = 3, KANDIDATEN_MS = 30_000;
let kandidatenStand: { schluessel: string; am: number; liste: Kandidat[] } | null = null;
export function kandidatenAus(projekte: string, root: string, live: ReadonlyMap<string, { slot: number; rolle: string; cwd: string }>, jetzt = Date.now()): Kandidat[] {
  const schluessel = `${projekte}\n${root}\n${[...live].map(([d, x]) => `${d}:${x.slot}:${x.rolle}`).join(",")}`;
  if (kandidatenStand && kandidatenStand.schluessel === schluessel && jetzt - kandidatenStand.am < KANDIDATEN_MS) return kandidatenStand.liste;
  const slug = root.replace(/[^a-zA-Z0-9]/g, "-");
  const mtime = (p: string): number => { try { return statSync(p).mtimeMs; } catch { return 0; } };
  const imRepo = (cwd: string | null): cwd is string => cwd !== null && (cwd === root || cwd.startsWith(`${root}/`) || cwd.startsWith(`${root}.worktrees/`));
  let ordner: string[] = [];
  try { ordner = readdirSync(projekte).filter((d) => d === slug || d.startsWith(`${slug}-`)); } catch { /* kein Projektordner: keine Kandidaten */ }
  const jsonl = (d: string): string[] => { try { return readdirSync(d).filter((f) => f.endsWith(".jsonl")).map((f) => `${d}/${f}`); } catch { return []; } };
  const dateien = ordner.map((d) => `${projekte}/${d}`).map((d) => ({ d, m: mtime(d) })).sort((a, b) => b.m - a.m).slice(0, ORDNER_MAX)
    .flatMap(({ d }) => jsonl(d).map((f) => ({ f, m: mtime(f) })).sort((a, b) => b.m - a.m).slice(0, DATEIEN_JE_ORDNER).map((x) => x.f));
  const laufend = [...live].filter(([, x]) => imRepo(x.cwd)).map(([f]) => f);
  const liste = [...new Set([...laufend, ...dateien])].flatMap((f) => {
    const kopf = kopfVon(f);
    if (!kopf || !kopf.interaktiv || !imRepo(kopf.cwd)) return [];
    const l = live.get(f);
    const ort = kopf.cwd.slice(kopf.cwd.lastIndexOf("/") + 1);
    return [{ slot: l?.slot ?? null, rolle: l?.rolle ?? (kopf.fleetRolle ? ROLLE_WORT[kopf.fleetRolle] ?? kopf.fleetRolle : "ohne Fleet gestartet"), ort, kopf }];
  });
  kandidatenStand = { schluessel, am: jetzt, liste };
  return liste;
}

// --- DIE QUELLE: welche Session für Claude Codes Teil steht ---------------------------------------------------------------------
// Die installierte Version kennt der Server nicht (kein `claude --version` im Code); die Version der zuletzt gestarteten Session steht
// für sie. Gemessen wird nur an einer Session dieser Version mit ganzem Kopf; dasselbe Modell geht vor, dann die jüngste.
const ohneKlammer = (m: string): string => m.replace(/\[[^\]]*\]$/, "");
export function waehleQuelle(kandidaten: readonly Kandidat[], modell: string): { quelle: Kandidat & { kopf: { anatomie: Anatomie } } } | { grund: string } {
  const mitStart = kandidaten.filter((k) => k.kopf.version !== null && k.kopf.seit !== null);
  const juengste = [...mitStart].sort((a, b) => (b.kopf.seit ?? 0) - (a.kopf.seit ?? 0))[0];
  if (!juengste) return { grund: "noch nicht gemessen — erscheint, sobald eine Claude-Session in Fleets Repo gelaufen ist" };
  const version = juengste.kopf.version;
  const pool = mitStart.filter((k): k is Kandidat & { kopf: { anatomie: Anatomie } } => k.kopf.version === version && k.kopf.anatomie !== null);
  const gleich = (k: Kandidat & { kopf: { anatomie: Anatomie } }) => k.kopf.anatomie.modell !== null && ohneKlammer(k.kopf.anatomie.modell) === ohneKlammer(modell);
  const quelle = [...pool].sort((a, b) => Number(gleich(b)) - Number(gleich(a)) || (b.kopf.seit ?? 0) - (a.kopf.seit ?? 0))[0];
  return quelle ? { quelle } : { grund: `noch nicht gemessen — erscheint, sobald eine Session mit Claude Code ${version} geantwortet hat` };
}

// --- WAS VOM ORDNER ABHÄNGT: Befehle, Skills und Agenten eines .claude-Ordners (oder des Konfig-Ordners), MCP-Server eines Repos -----
export interface Namen { readonly befehle: readonly string[]; readonly skills: readonly string[]; readonly agenten: readonly string[] }
const eintraegeIn = (ordner: string, md: boolean): string[] => {
  try {
    return readdirSync(ordner).flatMap((n) => md ? (n.endsWith(".md") ? [n.slice(0, -3)] : [])
      : (() => { try { return statSync(`${ordner}/${n}/SKILL.md`).isFile() ? [n] : []; } catch { return []; } })());
  } catch { return []; }
};
export const claudeNamen = (ordner: string): Namen =>
  ({ befehle: eintraegeIn(`${ordner}/commands`, true), skills: eintraegeIn(`${ordner}/skills`, false), agenten: eintraegeIn(`${ordner}/agents`, true) });
export function repoMcp(repo: string): string[] {
  try { return Object.keys(obj(obj(JSON.parse(readFileSync(`${repo}/.mcp.json`, "utf8")))?.mcpServers) ?? {}); } catch { return []; }
}

// --- FÜR DIE GEWÄHLTE ROLLE: Claude Codes Teil aus der Quelle, Fleets Teil aus dem Code, der Ordner-Teil aus den Dateien -----------
export interface FleetTeil {
  /** was Fleet an den Systemprompt hängt, in der Reihenfolge der Startzeile; text null = bei dieser Rolle aus */
  readonly anhang: readonly { readonly name: string; readonly weg: string; readonly text: string | null; readonly satz: string }[];
  /** `--tools`; null = keine Liste, alle eingebauten */
  readonly werkzeuge: readonly string[] | null;
  /** jeder Eintrag des Listenschnitts, `aus` für diese Rolle, und wie er zurückkommt */
  readonly schnitt: readonly { readonly name: string; readonly von: "user-command" | "fleet-command" | "synced-skill" | "bundled" | "user-agent"; readonly aus: boolean; readonly zurueck: string }[];
  readonly ohneMemory: boolean;
  readonly ohneMcp: boolean;
}
export interface Orte { readonly konfig: Namen; readonly repo: Namen; readonly quelleRepo: Namen | null; readonly repoMcp: readonly string[]; readonly quelleMcp: readonly string[] }
// every part carries the question it answers (S14), set from the register (session-blocks.ts#anatomieFrage)
export type FrageTeil = AnatomieTeil & { readonly frage: SessionFrage };
export type FrageAnatomie = Omit<CcAnatomie, "gruppen"> & { readonly gruppen: readonly (Omit<AnatomieGruppe, "teile"> & { readonly teile: readonly FrageTeil[] })[] };

const bytesVon = (t: string): number => Buffer.byteLength(t);
const titelVon = (t: string): string => {
  const z = (t.trim().split("\n")[0] ?? "").replace(/^#+\s*/, "").replace(/<\/?[a-z_]+>/g, "").trim();
  return z.length > 60 ? `${z.slice(0, 57)}…` : z || "(leer)";
};
const plugin = (name: string): string | null => /^([^:]+):/.exec(name)?.[1] ?? null;
const mcpSchluessel = (n: string): string => n.replace(/[^A-Za-z0-9]/g, "_");
const NICHT_GEMESSEN_REPO = "nicht gemessen: kommt aus dem Repo, die Quell-Session lief in einem anderen Ordner";
const NICHT_GEMESSEN_AUS = "nicht gemessen: die Quell-Session hatte es nicht in ihrer Liste";

export function anatomieFuerRolle(quelle: { kandidat: Kandidat; a: Anatomie } | null, grund: string | null, fleet: FleetTeil, orte: Orte): FrageAnatomie {
  const a = quelle?.a ?? null;
  const fleetTexte = new Set(fleet.anhang.flatMap((x) => x.text ? [x.text.trim()] : []));
  const inRepo = (n: string, art: "befehle" | "skills" | "agenten") => orte.repo[art].includes(n);
  const inKonfig = (n: string, art: "befehle" | "skills" | "agenten") => orte.konfig[art].includes(n);
  // was die Quell-Session aus ihrem eigenen Repo hatte, das gewählte aber nicht hat (und kein Konfig-Ordner bringt), fehlt hier
  const nurQuelle = (n: string, arten: readonly ("befehle" | "skills" | "agenten")[]) =>
    arten.some((x) => orte.quelleRepo?.[x].includes(n)) && !arten.some((x) => inRepo(n, x) || inKonfig(n, x));
  const schnittVon = (n: string) => fleet.schnitt.find((e) => e.name === n);

  // SYSTEMPROMPT · was Claude Code selbst schreibt: ohne Fleets Anhang (den der Quelle; der dieser Rolle steht in „fleet“)
  const abschnitte = (a?.systemprompt ?? []).filter((x) => !x.text.startsWith("FLEET-LISTENSCHNITT") && !fleetTexte.has(x.text.trim()));
  const identitaet: AnatomieTeil | null = a?.identitaet ? { name: titelVon(a.identitaet.text), bytes: a.identitaet.bytes, stand: "an", weg: "mitgeliefert",
    satz: "der erste Satz jeder Anfrage, vor dem Systemprompt", text: a.identitaet.text } : null;
  const system: AnatomieTeil[] = [
    ...(identitaet ? [identitaet] : []),
    ...abschnitte.map((x): AnatomieTeil => x.text.startsWith("# Memory") && fleet.ohneMemory
      ? { name: titelVon(x.text), bytes: x.bytes, stand: "aus", weg: "--settings autoMemoryEnabled", satz: "Eine Lane startet ohne Auto-Memory; ihren Stand liest sie über den Zeiger in der Session-Datei.", text: x.text }
      : { name: titelVon(x.text), bytes: x.bytes, stand: "an", weg: "mitgeliefert", satz: "schreibt Claude Code selbst in den Systemprompt", text: x.text }),
    ...(a && !fleet.ohneMemory && !abschnitte.some((x) => x.text.startsWith("# Memory"))
      ? [{ name: "Memory", bytes: null, stand: "an" as const, weg: "mitgeliefert", satz: "nicht gemessen: die Quell-Session startete ohne Auto-Memory" }] : []),
  ];

  // FLEETS ANHANG · wörtlich, aus Fleets Code für diese Rolle
  const anhang: AnatomieTeil[] = fleet.anhang.map((x) => x.text === null
    ? { name: x.name, bytes: null, stand: "aus", weg: x.weg, satz: x.satz }
    : { name: x.name, bytes: bytesVon(x.text), stand: "an", weg: x.weg, satz: x.satz, text: x.text });

  // WERKZEUGE · aus der ersten Anfrage der Quelle (sofort geladen) und ihrer Abruf-Liste; an oder aus nach Fleets --tools
  const liste = fleet.werkzeuge;
  const gesehen = new Set<string>();
  const werkzeug = (name: string, bytes: number | null, abruf: boolean, server: boolean, t?: string): AnatomieTeil => {
    gesehen.add(name);
    if (server) return { name, bytes, stand: abruf ? "abruf" : "an", weg: "mitgeliefert", satz: "Server-Werkzeug von Claude Code; ob Fleets Werkzeugliste es abschaltet, ist nicht gemessen", ...(t ? { text: t } : {}) };
    if (liste && !liste.includes(name)) return { name, bytes, stand: "aus", weg: "--tools", satz: "nicht auf Fleets Werkzeugliste dieser Rolle", ...(t ? { text: t } : {}) };
    // mit einer Liste wählt Fleet auch, was an ist; ohne Liste bringt Claude Code alle eingebauten
    const weg = liste ? "--tools" : "mitgeliefert", vorn = liste ? "auf Fleets Werkzeugliste dieser Rolle; " : "";
    return abruf ? { name, bytes, stand: "abruf", weg, satz: `${vorn}auf Abruf: im Start steht nur der Name, das Schema lädt ToolSearch bei Bedarf`, ...(t ? { text: t } : {}) }
      : { name, bytes, stand: "an", weg, satz: `${vorn}mit Beschreibung und Eingabe-Schema im Start`, ...(t ? { text: t } : {}) };
  };
  const werkzeuge: AnatomieTeil[] = a ? [
    ...a.werkzeuge.map((w) => werkzeug(w.name, w.bytes, w.abruf, w.server, w.text)),
    ...a.aufgeschoben.filter((n) => !gesehen.has(n)).map((n) => werkzeug(n, bytesVon(n), true, false)),
    ...(liste ?? []).filter((n) => !gesehen.has(n)).map((n): AnatomieTeil => ({ name: n, bytes: null, stand: "an", weg: "--tools", satz: `auf Fleets Werkzeugliste dieser Rolle; ${NICHT_GEMESSEN_AUS}` })),
  ] : (liste ?? []).map((n) => ({ name: n, bytes: null, stand: "an", weg: "--tools", satz: "auf Fleets Werkzeugliste dieser Rolle; Größe noch nicht gemessen" }));

  // SKILLS · die Liste der Quelle, ohne was nur ihr Repo hatte; Fleets Schnitt für diese Rolle; was das gewählte Repo dazubringt
  const skillWeg = (n: string): string => plugin(n) ? `Plugin ${plugin(n)}` : inRepo(n, "befehle") || inRepo(n, "skills") ? "Repo"
    : inKonfig(n, "befehle") || inKonfig(n, "skills") ? "Konfig-Ordner" : "mitgeliefert";
  const skillSatz: Record<string, string> = { Repo: "steht im .claude-Ordner des Repos", "Konfig-Ordner": "steht in deinem Konfig-Ordner (~/.claude)", mitgeliefert: "bringt Claude Code mit" };
  const geschnitten = (n: string, bytes: number | null, t?: string): AnatomieTeil | null => {
    const e = schnittVon(n);
    if (!e?.aus) return null;
    return e.von === "bundled"
      ? { name: n, bytes: bytesVon(`- ${n}`), stand: "name", weg: "--settings skillOverrides", satz: `Fleet lässt bei dieser Rolle nur den Namen in der Liste; zurück: ${e.zurueck}` }
      : { name: n, bytes, stand: "aus", weg: "--settings skillOverrides", satz: `Fleet nimmt es bei dieser Rolle aus der Liste; zurück: ${e.zurueck}`, ...(t ? { text: t } : {}) };
  };
  const skillNamen = new Set<string>();
  const skills: AnatomieTeil[] = [];
  for (const x of a?.skills ?? []) {
    if (nurQuelle(x.name, ["befehle", "skills"])) continue;
    skillNamen.add(x.name);
    const w = skillWeg(x.name);
    skills.push(geschnitten(x.name, x.bytes, x.text) ?? { name: x.name, bytes: x.bytes, stand: "an", weg: w, satz: skillSatz[w] ?? `kommt mit dem ${w}`, text: x.text });
  }
  for (const e of fleet.schnitt) {
    if (e.von === "user-agent" || skillNamen.has(e.name) || (e.von === "fleet-command" && !inRepo(e.name, "befehle"))
      || (e.von === "user-command" && !inKonfig(e.name, "befehle"))) continue;
    skillNamen.add(e.name);
    skills.push(geschnitten(e.name, null) ?? (a ? { name: e.name, bytes: null, stand: "an", weg: skillWeg(e.name), satz: NICHT_GEMESSEN_AUS } : null)
      ?? { name: e.name, bytes: null, stand: "an", weg: skillWeg(e.name), satz: "noch nicht gemessen" });
  }
  for (const n of [...orte.repo.befehle, ...orte.repo.skills]) if (!skillNamen.has(n)) {
    skillNamen.add(n);
    skills.push({ name: n, bytes: null, stand: "an", weg: "Repo", satz: a ? NICHT_GEMESSEN_REPO : "noch nicht gemessen" });
  }

  // AGENTEN · ebenso; Fleet sperrt einige je Rolle mit --disallowedTools
  const agentWeg = (n: string, eingebaut: boolean): string => eingebaut ? "mitgeliefert" : plugin(n) ? `Plugin ${plugin(n)}`
    : inRepo(n, "agenten") ? "Repo" : inKonfig(n, "agenten") ? "Konfig-Ordner" : "mitgeliefert";
  const agentNamen = new Set<string>();
  const agenten: AnatomieTeil[] = [];
  const agentAus = (n: string, bytes: number | null, t?: string): AnatomieTeil | null => {
    const e = schnittVon(n);
    return e?.aus && e.von === "user-agent" ? { name: n, bytes, stand: "aus", weg: "--disallowedTools", satz: `Fleet sperrt ihn bei dieser Rolle; zurück: ${e.zurueck}`, ...(t ? { text: t } : {}) } : null;
  };
  for (const x of a?.agenten ?? []) {
    if (!x.eingebaut && nurQuelle(x.name, ["agenten"])) continue;
    agentNamen.add(x.name);
    const w = agentWeg(x.name, x.eingebaut);
    agenten.push(agentAus(x.name, bytesVon(x.text), x.text) ?? { name: x.name, bytes: bytesVon(x.text), stand: "an", weg: w,
      satz: x.eingebaut ? "eingebaut in Claude Code" : skillSatz[w] ?? `kommt mit dem ${w}`, text: x.text });
  }
  for (const e of fleet.schnitt) if (e.von === "user-agent" && !agentNamen.has(e.name) && inKonfig(e.name, "agenten")) {
    agentNamen.add(e.name);
    agenten.push(agentAus(e.name, null) ?? { name: e.name, bytes: null, stand: "an", weg: "Konfig-Ordner", satz: a ? NICHT_GEMESSEN_AUS : "noch nicht gemessen" });
  }
  for (const n of orte.repo.agenten) if (!agentNamen.has(n)) {
    agentNamen.add(n);
    agenten.push({ name: n, bytes: null, stand: "an", weg: "Repo", satz: a ? NICHT_GEMESSEN_REPO : "noch nicht gemessen" });
  }

  // MCP · Server aus den Werkzeugnamen (mcp__<server>__…) und den Instruktionen; eine Text-Lane startet ohne
  const server = new Map<string, { name: string; werkzeuge: string[]; text: string }>();
  for (const n of a?.mcpWerkzeuge ?? []) {
    const m = /^mcp__(.+?)__(.+)$/.exec(n);
    if (!m?.[1] || !m[2]) continue;
    const s = server.get(m[1]) ?? { name: m[1], werkzeuge: [], text: "" };
    server.set(m[1], { ...s, werkzeuge: [...s.werkzeuge, m[2]] });
  }
  for (const x of a?.mcp ?? []) {
    const k = mcpSchluessel(x.name), s = server.get(k);
    server.set(k, { name: x.name, werkzeuge: s?.werkzeuge ?? [], text: x.text });
  }
  const mcpWeg = (k: string): string => k.startsWith("claude_ai_") ? "claude.ai-Anbindung" : /^plugin_([^_]+)_/.test(k) ? `Plugin ${/^plugin_([^_]+)_/.exec(k)?.[1]}`
    : orte.repoMcp.some((n) => mcpSchluessel(n) === k) ? "Repo" : "Konfiguration";
  const mcpName = (k: string, s: { name: string }): string => s.name !== k ? s.name
    : k.startsWith("claude_ai_") ? `claude.ai ${k.slice(10).replace(/_/g, " ")}` : (/^plugin_[^_]+_(.+)$/.exec(k)?.[1] ?? k);
  const mcp: AnatomieTeil[] = [];
  for (const [k, s] of server) {
    if (orte.quelleMcp.some((n) => mcpSchluessel(n) === k) && !orte.repoMcp.some((n) => mcpSchluessel(n) === k)) continue;
    const t = [s.text, s.werkzeuge.length ? `Werkzeuge (auf Abruf): ${s.werkzeuge.join(", ")}` : ""].filter(Boolean).join("\n\n");
    const bytes = bytesVon(s.text) + s.werkzeuge.reduce((n, w) => n + bytesVon(`mcp__${k}__${w}`), 0);
    const w = mcpWeg(k);
    mcp.push(fleet.ohneMcp ? { name: mcpName(k, s), bytes, stand: "aus", weg: "--strict-mcp-config", satz: "Eine Text-Lane startet ohne MCP-Server.", text: t }
      : { name: mcpName(k, s), bytes, stand: s.text ? "an" : "abruf", weg: w,
        satz: `${w === "claude.ai-Anbindung" ? "kommt aus deinem claude.ai-Konto" : w === "Repo" ? "steht in .mcp.json des Repos" : w.startsWith("Plugin") ? `kommt mit dem ${w}` : "steht in deiner Claude-Konfiguration"}${s.werkzeuge.length ? `; ${s.werkzeuge.length} Werkzeuge auf Abruf` : ""}`, text: t });
  }
  for (const n of orte.repoMcp) if (![...server.keys()].includes(mcpSchluessel(n)))
    mcp.push({ name: n, bytes: null, stand: fleet.ohneMcp ? "aus" : "an", weg: fleet.ohneMcp ? "--strict-mcp-config" : "Repo", satz: fleet.ohneMcp ? "Eine Text-Lane startet ohne MCP-Server." : a ? NICHT_GEMESSEN_REPO : "noch nicht gemessen" });

  // PLUGINS · eine Zuordnung: was die Präfixe der Skills, Agenten und MCP-Server nennen
  const plugins = new Map<string, { teile: string[]; an: boolean }>();
  for (const [art, teile] of [["Skill", skills], ["Agent", agenten], ["MCP-Server", mcp]] as const) for (const t of teile) {
    const p = /^Plugin (.+)$/.exec(t.weg)?.[1] ?? (t.weg.startsWith("--") ? plugin(t.name) : null);
    if (!p) continue;
    const x = plugins.get(p) ?? { teile: [], an: false };
    plugins.set(p, { teile: [...x.teile, `${art} ${t.name}`], an: x.an || t.stand !== "aus" });
  }

  const gruppe = (id: AnatomieGruppe["id"], wort: string, satz: string, teile: AnatomieTeil[]): FrageAnatomie["gruppen"][number] =>
    ({ id, wort, satz, teile: teile.map((t): FrageTeil => ({ ...t, frage: anatomieFrage(id, t, t === identitaet) })) });
  return {
    quelle: quelle ? quelleVon(quelle.kandidat, quelle.a) : null,
    grund: quelle ? null : grund,
    gruppen: [
      gruppe("systemprompt", "Systemprompt von Claude Code", "schreibt Claude Code selbst: wer es ist, Regeln, Umgebung, Gedächtnis", system),
      gruppe("fleet", "Was Fleet anhängt", "hängt Fleet wörtlich an den Systemprompt", anhang),
      gruppe("werkzeuge", "Werkzeuge", liste ? "an oder aus nach Fleets Werkzeugliste dieser Rolle; auf Abruf heißt: im Start steht nur der Name"
        : "Fleet gibt dieser Rolle keine Liste, sie bekommt alle eingebauten; auf Abruf heißt: im Start steht nur der Name", werkzeuge),
      gruppe("skills", "Skills", "listet Claude Code mit einer Zeile je Skill; Fleet nimmt je Rolle einige heraus", skills),
      gruppe("agenten", "Agenten", "listet Claude Code mit einer Zeile je Agent; Fleet sperrt je Rolle einige", agenten),
      gruppe("plugins", "Plugins", "abgeleitet aus den Namen der Skills, Agenten und MCP-Server; eine laufende Session schreibt keine Liste der Plugins",
        [...plugins].map(([name, x]) => ({ name, bytes: null, stand: x.an ? "an" : "aus", weg: `Plugin ${name}`, satz: `bringt ${x.teile.join(", ")}` }))),
      gruppe("mcp", "MCP-Server", fleet.ohneMcp ? "eine Text-Lane startet ohne MCP-Server" : "aus deiner Konfiguration, dem claude.ai-Konto, Plugins und dem Repo; ihre Werkzeuge stehen auf Abruf", mcp),
    ],
  };
}

function quelleVon(k: Kandidat, a: Anatomie): AnatomieQuelle {
  return { slot: k.slot, rolle: k.rolle, ort: k.ort, claude: a.version ?? "unbekannt", modell: a.modell, seit: a.seit ?? 0, tokens: a.tokens,
    bytesJeToken: a.tokens && a.anfrageBytes ? Math.round((a.anfrageBytes / a.tokens) * 100) / 100 : null };
}
