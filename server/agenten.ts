// EIN AGENT IST EIN GESPEICHERTES OBJEKT MIT NAMEN (docs/start/direction.md Schritt 3, „A setup travels whole“; Owner 24.10.: „[Zitat entfernt]“
// ). Er trägt die Wahlen, mit denen eine Tür einen Sitz öffnet, seine Agent-MD und, wenn er eine Kopie ist,
// `kopieVon` mit dem Hash des Originals. Aus ihm entsteht beim Start die Fassung (server/fassung.ts): sie zeigt ihn mit Namen und Hash.
//
// DIE WAHLEN STEHEN UNTER DEN NAMEN DER TÜRFELDER, nicht unter den fünf Überschriften der Fassung: `model`, `permissionMode`, `weglassen`
// … sind das Vokabular, das jede Tür schon liest. Welche Überschrift eine Wahl in der Ansicht bekommt, rechnet die Fassung; eine andere
// Gliederung der Ansicht braucht darum keine Migration dieser Datei. Eine Aufgabe gehört nicht zum Agenten: sie kommt an der Tür dazu.
//
// WOHER AGENTEN KOMMEN: eigene liegen in `<STATE_DIR>/agenten.json`; eingebaut sind der Agent des Repos und die Orchestratorin; die Profile
// und die Positionen der gespeicherten Konstellationen des Fensters „Neue Session“ (k15-eigenes.json) erscheinen als Agenten, die auf sie
// zeigen (`profil`, `sitz`), ohne dass dort etwas umgeschrieben wird: ein Start aus ihnen trägt genau die Felder, die die Tür schon kennt.
// Eingebaute und abgeleitete ändert man nicht, man kopiert sie; die Kopie ist ein eigener Agent mit allem, was sie trägt, ausgeschrieben.
//
// DER HASH deckt ab, was den Start formt: die Wahlen und die Agent-MD. Name, Kennung, Herkunft und Zeit sind Anzeige.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join, resolve } from "node:path";
import { rechteGedeckelt } from "../src/sitz";
import { rechteAus } from "../session-rechte";
import { agentMdText, MAX_AGENTMD_BYTES, type AgentMd } from "./agentmd";
import { kanon, type Fassung } from "./fassung";

export const AGENTEN_DATEI = "agenten.json";
export const AGENTEN_ROUTE = "/api/agenten";
export const AGENT_FORMAT = "fleet-agent/1";
export const MAX_AGENTEN = 100;

/** Die Wahlen, die jede Tür liest, mit ihrem Türnamen. */
export const WAHL_FELDER = ["harness", "model", "effort", "permissionMode", "rechte", "tools", "weglassen", "bibliothek", "notizbuch",
  "remote", "autoModeEnvironment", "schwelle"] as const;
/** Bezüge auf einen Ort dieser Fleet: ein Profil oder eine Position des Fensters, oder die Rolle (nur die Orchestratorin ist eingebaut). */
export const BEZUG_FELDER = ["profil", "sitz", "rolle"] as const;
export type WahlFeld = (typeof WAHL_FELDER)[number] | (typeof BEZUG_FELDER)[number];
export type Wahlen = Partial<Record<WahlFeld, unknown>>;
const ALLE_FELDER: readonly string[] = [...WAHL_FELDER, ...BEZUG_FELDER];
/** Die Felder, die nur auf einen Ort dieser Fleet zeigen: ein eigener Agent trägt sie nicht ausgeschrieben, ein Export nie. */
const NUR_HIER: readonly WahlFeld[] = ["profil", "sitz"];
export const ROLLEN: Readonly<Record<string, { label: string; name: string }>> = { orchestratorin: { label: "Orchestrator", name: "Orchestrator" } };

/** Die Agent-MD eines Agenten. `profil` ist der Name, unter dem sie im Systemprompt steht und dessen Notizbuch der Sitz bekommt. */
export interface AgentMdTeil { readonly titel: string; readonly text: string; readonly profil: string }
export interface KopieVon { readonly id: string; readonly name: string; readonly hash: string }
export type AgentArt = "eigen" | "eingebaut" | "profil" | "position";

export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly wahlen: Wahlen;
  readonly agentMd: AgentMdTeil | null;
  readonly kopieVon?: KopieVon;
  /** der Hash, den die Datei trug, aus der er importiert wurde („derived from“) */
  readonly abgeleitetVon?: string;
  /** aus einer Datei gekommen und seither nicht vom Owner geändert: startet nie in bypass */
  readonly importiert?: true;
  readonly am: number;
  readonly hash: string;
}
/** Was die Liste zeigt: der Agent, woher er kommt, und ob man ihn ändern kann. */
export interface AgentAnsicht extends Agent { readonly art: AgentArt; readonly aenderbar: boolean; readonly quelle: string }
/** Was ein Slot von seinem Agenten trägt und die Fassung zeigt. */
export interface AgentBezug { readonly id: string; readonly name: string; readonly hash: string; readonly kopieVon?: KopieVon; readonly abgeleitetVon?: string }

const rec = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : null;
const sha = (t: string): string => createHash("sha256").update(t).digest("hex");
const ID_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;

/** Ohne leere Werte: ein Feld, das fehlt, und eines, das null ist, sind dieselbe Wahl. */
export function wahlenSauber(w: Wahlen): Wahlen {
  return Object.fromEntries(Object.entries(w).filter(([, v]) => v !== undefined && v !== null)) as Wahlen;
}
export const agentHash = (wahlen: Wahlen, agentMd: AgentMdTeil | null): string =>
  sha(JSON.stringify(kanon({ wahlen: wahlenSauber(wahlen), agentMd })));
export const bezugVon = (a: Agent): AgentBezug => ({ id: a.id, name: a.name, hash: a.hash,
  ...(a.kopieVon ? { kopieVon: a.kopieVon } : {}), ...(a.abgeleitetVon ? { abgeleitetVon: a.abgeleitetVon } : {}) });
/** Der Satz, mit dem die Fassung die Herkunft nennt. */
// Trägt die Kopie den Namen, den sie bei der Kopie bekam („copy of <Name>“), steht er nur einmal da.
export const herkunftSatz = (b: AgentBezug): string => [
  b.kopieVon && b.name === `copy of ${b.kopieVon.name}` ? `Agent ${b.hash.slice(0, 12)}` : `${b.name} · ${b.hash.slice(0, 12)}`,
  b.kopieVon ? `copy of ${b.kopieVon.name} · ${b.kopieVon.hash.slice(0, 12)}` : null,
  b.abgeleitetVon ? `derived from ${b.abgeleitetVon.slice(0, 12)}` : null].filter(Boolean).join(" — ");

export function agentBezugGeladen(raw: unknown): AgentBezug | null {
  const r = rec(raw);
  if (!r || typeof r.id !== "string" || typeof r.name !== "string" || typeof r.hash !== "string") return null;
  const k = rec(r.kopieVon);
  const kopieVon = k && typeof k.id === "string" && typeof k.name === "string" && typeof k.hash === "string" ? { id: k.id, name: k.name, hash: k.hash } : null;
  return { id: r.id, name: r.name, hash: r.hash, ...(kopieVon ? { kopieVon } : {}), ...(typeof r.abgeleitetVon === "string" ? { abgeleitetVon: r.abgeleitetVon } : {}) };
}

/** Prüft die Wahlen mit denselben Lesern wie die Tür (server.ts reicht sie herein); null = die Tür nähme sie an. */
export type WahlenPruefung = (w: Wahlen) => string | null;

function agentMdAus(v: unknown, profilStandard: string): AgentMdTeil | null | string {
  if (v === undefined || v === null) return null;
  const r = rec(v);
  if (!r || typeof r.titel !== "string" || typeof r.text !== "string" || !r.text.trim()) return "agentMd must be { titel, text } with a text";
  if (Buffer.byteLength(r.text) > MAX_AGENTMD_BYTES) return `agentMd is larger than ${MAX_AGENTMD_BYTES / 1000} KB`;
  const profil = typeof r.profil === "string" && ID_RE.test(r.profil) ? r.profil : profilStandard;
  return { titel: r.titel.slice(0, 120), text: r.text, profil };
}

/** Die Wahlen eines Eingangs: nur bekannte Felder, ohne leere. */
function wahlenAus(v: unknown): Wahlen | string {
  if (v === undefined || v === null) return {};
  const r = rec(v);
  if (!r) return "wahlen must be an object with door fields";
  const fremd = Object.keys(r).filter((k) => !ALLE_FELDER.includes(k));
  if (fremd.length) return `wahlen knows ${ALLE_FELDER.join(", ")} — not ${fremd.join(", ")}`;
  return wahlenSauber(r as Wahlen);
}

/** Ein eigener Agent aus einem Eingang { id?, name, wahlen, agentMd? } — die Tür prüft die Wahlen, bevor er gespeichert wird. */
export function eigenerAgent(eingang: unknown, pruefe: WahlenPruefung, vergeben: readonly string[], am = Date.now(),
  herkunft: { kopieVon?: KopieVon; abgeleitetVon?: string; importiert?: true } = {}): Agent | string {
  const r = rec(eingang);
  if (!r) return "expected { name, wahlen, agentMd? }";
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!name || name.length > 80) return "name must be 1 to 80 characters";
  const id = typeof r.id === "string" ? r.id : freieId(name, vergeben);
  if (!ID_RE.test(id)) return "id must be lowercase letters, digits and dashes";
  if (vergeben.includes(id)) return `an agent „${id}“ exists already`;
  const wahlen = wahlenAus(r.wahlen);
  if (typeof wahlen === "string") return wahlen;
  if (wahlen.profil !== undefined) return "a saved agent carries its Agent-MD itself (agentMd), not a profil reference";
  if (wahlen.rolle !== undefined && !(typeof wahlen.rolle === "string" && ROLLEN[wahlen.rolle])) return `rolle must be one of ${Object.keys(ROLLEN).join(", ")}`;
  const md = agentMdAus(r.agentMd, id);
  if (typeof md === "string") return md;
  if (md && wahlen.sitz !== undefined) return "a seat of a constellation brings its Agent-MD from the file — no agentMd beside sitz";
  const fehler = pruefe(wahlen);
  if (fehler) return fehler;
  // die Rechte in der Form, die die Tür daraus liest: dieselben Rechte ergeben denselben Hash, wie auch immer sie geschrieben waren
  const recht = wahlen.rechte === undefined ? null : rechteAus(wahlen.rechte);
  if (recht) wahlen.rechte = recht;
  return { id, name, wahlen, agentMd: md, ...herkunft, am, hash: agentHash(wahlen, md) };
}
function freieId(name: string, vergeben: readonly string[]): string {
  const basis = name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "agent";
  let id = basis, n = 2;
  while (vergeben.includes(id)) id = `${basis}-${n++}`;
  return id;
}

/** EINE KOPIE: derselbe Agent, mit dem, was `aenderung` anders macht (ein Feld auf null nimmt die Wahl weg), und „copy of“ mit dem Hash des
 *  Originals. Ein abgeleiteter Agent wird dabei ausgeschrieben: seine Agent-MD steht danach in der Kopie, nicht mehr im Profil. */
export function kopie(original: AgentAnsicht, aenderung: unknown, pruefe: WahlenPruefung, vergeben: readonly string[], am = Date.now()): Agent | string {
  const r = rec(aenderung) ?? {};
  const patch = rec(r.wahlen) ?? {};
  const fremd = Object.keys(patch).filter((k) => !ALLE_FELDER.includes(k));
  if (fremd.length) return `wahlen knows ${ALLE_FELDER.join(", ")} — not ${fremd.join(", ")}`;
  const { profil: _p, ...ohneProfil } = original.wahlen;
  const wahlen = { ...ohneProfil, ...patch };
  const agentMd = r.agentMd === undefined ? original.agentMd : r.agentMd;
  return eigenerAgent({ id: r.id, name: typeof r.name === "string" ? r.name : `copy of ${original.name}`, wahlen, agentMd }, pruefe, vergeben, am,
    { kopieVon: { id: original.id, name: original.name, hash: original.hash } });
}

// DER SPEICHER: eine Datei, atomar geschrieben; eine unlesbare Datei ist eine leere Liste, nie ein Fehler beim Start
export function liesAgenten(dir: string): Agent[] {
  let roh: unknown;
  try { roh = JSON.parse(readFileSync(join(dir, AGENTEN_DATEI), "utf8")); } catch { return []; }
  const liste = rec(roh)?.agenten;
  if (!Array.isArray(liste)) return [];
  return liste.flatMap((x): Agent[] => {
    const a = rec(x);
    if (!a || typeof a.id !== "string" || typeof a.name !== "string" || typeof a.am !== "number") return [];
    const wahlen = wahlenAus(a.wahlen);
    const md = agentMdAus(a.agentMd, a.id);
    if (typeof wahlen === "string" || typeof md === "string") return [];
    const b = agentBezugGeladen({ ...a, hash: "" });
    return [{ id: a.id, name: a.name, wahlen, agentMd: md, ...(b?.kopieVon ? { kopieVon: b.kopieVon } : {}),
      ...(typeof a.abgeleitetVon === "string" ? { abgeleitetVon: a.abgeleitetVon } : {}), ...(a.importiert === true ? { importiert: true as const } : {}),
      am: a.am, hash: agentHash(wahlen, md) }];
  });
}
export function schreibAgenten(dir: string, agenten: readonly Agent[]): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const ziel = join(dir, AGENTEN_DATEI);
  const roh = `${ziel}.${process.pid}.tmp`;
  writeFileSync(roh, JSON.stringify({ agenten }, null, 1), { mode: 0o600 });
  renameSync(roh, ziel);
}

// DIE EINGEBAUTEN: der Agent des Repos (ohne Rolle; er liest die AGENTS.md des Ordners, in dem er startet) und die Orchestratorin
const eingebaut = (id: string, name: string, wahlen: Wahlen, quelle: string): AgentAnsicht =>
  ({ id, name, wahlen, agentMd: null, am: 0, hash: agentHash(wahlen, null), art: "eingebaut", aenderbar: false, quelle });
export const EINGEBAUTE: readonly AgentAnsicht[] = [
  eingebaut("repo", "Repo agent", {}, "no role: reads the AGENTS.md of the repo it starts in"),
  eingebaut("orchestratorin", "Orchestrator", { rolle: "orchestratorin" }, "the Orchestrator role (role card from Fleet's repo)"),
];

// DIE ORCHESTRATORIN GEHÖRT FLEETS REPO: ihre Rolle, Richtung und Packs liegen in Fleets Baum. Ein fremdes Repo böte einen Sitz ohne ihre Texte an.
// Erkannt wird das wie an den anderen Türen am Objektspeicher (`git rev-parse --git-common-dir`), nicht am Pfad: ein Worktree von Fleet ist Fleet,
// eine Kopie ohne git ist es nicht. `fleetCommonDir` ist der Wert, den server.ts für sein eigenes Repo schon kennt.
async function istFleetsRepo(cwd: string, fleetCommonDir: string | null): Promise<boolean> {
  if (fleetCommonDir === null) return false;
  const p = Bun.spawn(["git", "-C", cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"], { stdout: "pipe", stderr: "ignore" });
  const out = (await new Response(p.stdout).text()).trim();
  if (await p.exited !== 0 || !out) return false;
  const kanon = (pfad: string): string => { try { return realpathSync(pfad); } catch { return resolve(pfad); } };
  return kanon(out) === kanon(fleetCommonDir);
}

// DIE ABGELEITETEN aus dem Speicher des Fensters: je Profil mit Agent-MD und je Position einer gespeicherten Konstellation ein Agent, der auf sie
// zeigt. Was er trägt, sind die Felder, die das Fenster für ihn an die Tür schickt; seine Agent-MD liest die Tür wie bisher aus dem Profil.
export function abgeleitete(k15: unknown): AgentAnsicht[] {
  const r = rec(k15);
  const profile = Array.isArray(r?.profile) ? r.profile.map(rec) : [];
  const konst = Array.isArray(r?.konstellationen) ? r.konstellationen.map(rec) : [];
  const ausProfil = profile.flatMap((p): AgentAnsicht[] => {
    if (!p || typeof p.id !== "string") return [];
    const md = agentMdText(p.datei);
    if (!md) return [];
    const wert = (k: string): string | number | undefined => typeof p[k] === "string" && p[k] ? p[k] as string : typeof p[k] === "number" ? p[k] as number : undefined;
    const wahlen = wahlenSauber({ profil: p.id, harness: wert("agent"), model: wert("modell"), effort: wert("effort"), schwelle: wert("schwelle") });
    const agentMd = { titel: md.titel, text: md.text, profil: p.id };
    return [{ id: `profil:${p.id}`, name: typeof p.name === "string" ? p.name : p.id, wahlen, agentMd, am: 0, hash: agentHash(wahlen, agentMd),
      art: "profil", aenderbar: false, quelle: `Profil „${p.id}“ im Speicher des Fensters (k15-eigenes.json)` }];
  });
  const ausPosition = konst.flatMap((k): AgentAnsicht[] => {
    if (!k || typeof k.id !== "string" || !Array.isArray(k.positionen)) return [];
    return k.positionen.map(rec).flatMap((p): AgentAnsicht[] => {
      if (!p || typeof p.id !== "string") return [];
      const wahlen: Wahlen = { sitz: `${k.id}/${p.id}` };
      return [{ id: `sitz:${k.id}/${p.id}`, name: `${typeof k.name === "string" ? k.name : k.id} · ${typeof p.name === "string" ? p.name : p.id}`,
        wahlen, agentMd: null, ...(typeof k.abgeleitetVon === "string" ? { abgeleitetVon: k.abgeleitetVon } : {}), am: 0, hash: agentHash(wahlen, null),
        art: "position", aenderbar: false, quelle: `Position „${p.id}“ der gespeicherten Konstellation „${k.id}“` }];
    });
  });
  return [...ausProfil, ...ausPosition];
}
export const eigeneAnsicht = (a: Agent): AgentAnsicht => ({ ...a, art: "eigen", aenderbar: true,
  quelle: a.importiert ? "importiert, noch nicht vom Owner geändert" : a.kopieVon ? `Kopie von „${a.kopieVon.name}“` : "eigener Agent" });

/** Alle Agenten: eingebaut, eigen, abgeleitet. */
export function katalog(dir: string, k15: unknown): AgentAnsicht[] {
  return [...EINGEBAUTE, ...liesAgenten(dir).map(eigeneAnsicht), ...abgeleitete(k15)];
}

// DIE TÜR: `agent: "<id>"` an POST /api/slots/:id/open und /api/branches/open. Die Wahlen des Agenten kommen ganz in den Body; ein Body, der daneben
// selbst eine Wahl setzt, wird abgelehnt — sonst startete etwas anderes, als die Fassung des Agenten zeigt. Was die Tür nicht liest, auch.
export interface AgentAnDerTuer { body: Record<string, unknown>; agent: AgentBezug | null; agentMd: AgentMd | null }
export function agentAnDerTuer(body: Record<string, unknown>, liste: readonly AgentAnsicht[], tuerLiest: readonly WahlFeld[]):
  { ok: true; tuer: AgentAnDerTuer } | { ok: false; error: string } {
  const v = body.agent;
  if (v === undefined || v === null) return { ok: true, tuer: { body, agent: null, agentMd: null } };
  if (typeof v !== "string") return { ok: false, error: "agent must be the id of an agent (GET /api/agenten)" };
  const a = liste.find((x) => x.id === v);
  if (!a) return { ok: false, error: `no agent „${v}“ (GET /api/agenten)` };
  const daneben = ALLE_FELDER.filter((k) => body[k] !== undefined && body[k] !== null);
  if (daneben.length) return { ok: false, error: `agent „${a.id}“ carries its choices whole — ${daneben.join(", ")} beside it would start another setup than its Fassung shows; copy it (POST ${AGENTEN_ROUTE}/${encodeURIComponent(a.id)}/kopie) to change one` };
  const nichtGelesen = (Object.keys(a.wahlen) as WahlFeld[]).filter((k) => !tuerLiest.includes(k));
  if (nichtGelesen.length) return { ok: false, error: `this door does not read ${nichtGelesen.join(", ")} of agent „${a.id}“ — open it at POST /api/slots/:id/open` };
  if (a.importiert && a.wahlen.permissionMode === "bypassPermissions") return { ok: false, error: `agent „${a.id}“ came from a file and never starts in bypass` };
  if (a.importiert && a.wahlen.rolle !== undefined) return { ok: false, error: `agent „${a.id}“ came from a file and never starts in a role` };
  const { rolle, ...wahlen } = a.wahlen;
  const rolleLabel = typeof rolle === "string" ? ROLLEN[rolle]?.label : undefined;
  if (rolleLabel && body.label !== undefined && body.label !== null && body.label !== rolleLabel)
    return { ok: false, error: `agent „${a.id}“ is the role ${rolle}; its label is „${rolleLabel}“` };
  // die Agent-MD eines Profils liest die Tür weiter aus dem Profil (`profil`); die eines eigenen Agenten kommt von hier
  const agentMd: AgentMd | null = a.agentMd && wahlen.profil === undefined
    ? { profil: a.agentMd.profil, titel: a.agentMd.titel, text: a.agentMd.text, sha256: sha(a.agentMd.text), name: a.name } : null;
  const { agent: _a, ...rest } = body;
  return { ok: true, tuer: { body: { ...rest, ...wahlen, ...(rolleLabel ? { label: rolleLabel } : {}) }, agent: bezugVon(a), agentMd } };
}

// EINEN LAUFENDEN SITZ SPEICHERN: die Wahlen, mit denen sein Slot gestartet ist, unter den Türnamen; `nichtGetragen` nennt, was der Slot trägt
// und ein Agent nicht (es wäre sonst still verloren)
export interface SlotWahlen {
  readonly harness: string | null; readonly model: string | null; readonly effort: string | null; readonly permissionMode: string | null;
  readonly rechte: unknown; readonly tools: readonly string[] | null; readonly weglassen: unknown; readonly bibliothek: boolean | readonly string[] | null;
  readonly notizbuchWahl: string | null; readonly remote: boolean; readonly autoModeEnvironment: boolean | null; readonly schwelle: number | null;
  readonly agentMd: AgentMd | null; readonly sitz: { konst: string; pos: string } | null; readonly rolle: string | null;
  readonly packMcp: readonly string[]; readonly worktree: boolean;
}
export function wahlenAusSlot(s: SlotWahlen): { wahlen: Wahlen; agentMd: { titel: string; text: string; profil: string } | null; nichtGetragen: string[] } {
  const wahlen = wahlenSauber({ harness: s.harness, model: s.model, effort: s.effort, permissionMode: s.permissionMode, rechte: s.rechte,
    tools: s.tools, weglassen: s.weglassen, bibliothek: s.bibliothek, notizbuch: s.notizbuchWahl, remote: s.remote || null,
    autoModeEnvironment: s.autoModeEnvironment, schwelle: s.schwelle, sitz: s.sitz ? `${s.sitz.konst}/${s.sitz.pos}` : null, rolle: s.rolle });
  const agentMd = s.agentMd && !s.sitz ? { titel: s.agentMd.titel, text: s.agentMd.text, profil: s.agentMd.profil } : null;
  return { wahlen, agentMd, nichtGetragen: [...(s.packMcp.length ? [`die MCP-Server der Packs (${s.packMcp.join(", ")})`] : []),
    ...(s.worktree ? ["der Lane-Worktree"] : [])] };
}

// TEILEN: die Datei trägt den Agenten ganz (Wahlen und Agent-MD) und „derived from“ = seinen Hash hier. Bezüge auf diese Fleet gehen nie hinaus.
export function agentDatei(a: AgentAnsicht): { datei: Record<string, unknown>; hinweise: string[] } | string {
  if (a.wahlen.sitz !== undefined) return `agent „${a.id}“ is a seat of a constellation — share it with its constellation (GET /api/k15/konst/<id>/datei)`;
  if (a.wahlen.rolle !== undefined) return `agent „${a.id}“ is a role of this Fleet — a file never carries a role`;
  const { profil: _p, ...wahlen } = a.wahlen;
  const datei: Record<string, unknown> = { format: AGENT_FORMAT, name: a.name, wahlen,
    // der Name der Agent-MD reist mit: er steht im Systemprompt, also im Hash; ein Import behält ihn, wo er frei ist
    ...(a.agentMd ? { agentMd: { titel: a.agentMd.titel, text: a.agentMd.text, profil: a.agentMd.profil } } : {}),
    ...(a.kopieVon ? { kopieVon: { name: a.kopieVon.name, hash: a.kopieVon.hash } } : {}), abgeleitetVon: a.hash };
  // was nicht in eine geteilte Datei gehört, sagt die Antwort; entscheiden tut der Owner (wie server/sitz-reise.ts#dateiFuer)
  const text = JSON.stringify(datei);
  const name = hostname().split(".")[0]?.toLowerCase();
  const muster: [string, RegExp][] = [["ein Pfad auf einem Rechner", /\/Users\/|\/home\/|\/private\//], ["eine IP-Adresse", /\b(?:\d{1,3}\.){3}\d{1,3}\b/],
    ["ein Token", /Bearer\s+\S|x-fleet-self-token:\s*[0-9a-f]|FLEET_[A-Z_]*TOKEN=/i],
    ...(name && name.length >= 4 ? [["der Name dieses Rechners", new RegExp(`\\b${name.replace(/[^a-z0-9-]/g, "")}\\b`, "i")] as [string, RegExp]] : [])];
  const hinweise = muster.flatMap(([was, re]) => { const m = re.exec(text); return m ? [`Vor dem Teilen ansehen: ${was} steht darin („${m[0].slice(0, 40)}“)`] : []; });
  return { datei, hinweise };
}

/** EIN IMPORT: ein eigener Agent mit „derived from“ und der Marke `importiert`. Er startet nie in bypass und nie in einer Rolle; seine Rechte
 *  kommen gedeckelt an (src/sitz.ts#rechteGedeckelt), bis der Owner ihn ändert. */
// `profileHier`: die Namen, unter denen hier schon eine Agent-MD steht (Agenten und Profile); ein solcher Name bekäme das Notizbuch eines anderen,
// darum nimmt der Import dann seine eigene Kennung
export function agentAusDatei(datei: unknown, ueber: unknown, pruefe: WahlenPruefung, vergeben: readonly string[], am = Date.now(),
  profileHier: readonly string[] = []):
  { agent: Agent; gedeckelt: string[] } | string {
  const d = rec(datei);
  if (!d || d.format !== AGENT_FORMAT) return `expected a file of format ${AGENT_FORMAT}`;
  if (typeof d.abgeleitetVon !== "string" || !/^[0-9a-f]{64}$/.test(d.abgeleitetVon)) return "the file carries no abgeleitetVon hash";
  const wahlen = wahlenAus(d.wahlen);
  if (typeof wahlen === "string") return wahlen;
  const hier = NUR_HIER.filter((k) => wahlen[k] !== undefined);
  if (hier.length) return `the file names ${hier.join(", ")} — places of another Fleet travel only with their constellation`;
  if (wahlen.rolle !== undefined) return "an imported agent never starts in a role";
  if (wahlen.permissionMode === "bypassPermissions") return "an imported agent never starts in bypass — the file asks for bypassPermissions";
  const md = rec(d.agentMd);
  const recht = wahlen.rechte === undefined ? null : rechteAus(wahlen.rechte);
  if (wahlen.rechte !== undefined && !recht) return "the rechte of the file are not readable";
  const deckel = recht ? rechteGedeckelt(recht) : null;
  const u = rec(ueber) ?? {};
  // „copy of“ der Datei nennt ein Original der anderen Fleet; hier zählt, wovon der Import abgeleitet ist
  const a = eigenerAgent({ id: u.id, name: typeof u.name === "string" ? u.name : d.name, wahlen: { ...wahlen, ...(deckel ? { rechte: deckel.rechte } : {}) },
    agentMd: md ? { titel: md.titel, text: md.text, ...(typeof md.profil === "string" && !profileHier.includes(md.profil) ? { profil: md.profil } : {}) } : null },
  pruefe, vergeben, am, { abgeleitetVon: d.abgeleitetVon, importiert: true });
  return typeof a === "string" ? a : { agent: a, gedeckelt: deckel?.gedeckelt ?? [] };
}

// WAS DER ORT DAZUGIBT (für das Startfenster: „hier dazu · Fleets Repo“): derselbe Agent startet in Fleets Repo mit mehr als in einem fremden.
// Abgelesen aus der Fassung, die die Vorschau für genau diesen Start gerechnet hat, nicht nachgerechnet: je Zugabe das Feld, was sie ist und
// warum. Im eigenen Setup gibt der Ort nichts dazu; was der Agent selbst wählt, ist keine Zugabe.
export type OrtModus = "fleet-sitz" | "eigenes-setup";
export interface OrtZugabe { readonly feld: string; readonly wert: string; readonly warum: string }
export interface Ort { readonly modus: OrtModus; readonly satz: string; readonly zugaben: readonly OrtZugabe[] }
export function ortZugaben(f: Fassung, wahlen: Wahlen, modus: OrtModus): Ort {
  if (modus === "eigenes-setup")
    return { modus, satz: "eigenes Setup: Fleet gibt nur mit, was der Agent wählt", zugaben: [] };
  const warum = "Fleets Repo: ein Sitz ohne Rolle bekommt das vom Ort";
  const abschnitt = (teil: string, id: string) => f.teile.find((t) => t.id === teil)?.abschnitte.find((a) => a.id === id);
  const text = (teil: string, id: string): string | null => abschnitt(teil, id)?.text ?? null;
  let einst: Record<string, unknown> = {};
  try { einst = rec(JSON.parse(text("darf", "einstellungen") ?? "{}")) ?? {}; } catch { /* keine lesbaren Einstellungen: keine Zugabe daraus */ }
  const zugaben: OrtZugabe[] = [];
  const modusText = text("darf", "modus");
  if (wahlen.permissionMode === undefined && modusText) zugaben.push({ feld: "permissionMode", wert: modusText, warum });
  const zusatz = text("liest", "systemzusatz");
  if (zusatz) zugaben.push({ feld: "systemzusatz", wert: `${Buffer.byteLength(zusatz)} B (Listenschnitt, AUTO-MODE-Zeile)`, warum });
  if (wahlen.bibliothek === undefined && f.teile.find((t) => t.id === "liest")?.abschnitte.some((a) => a.id === "wissen" && a.text))
    zugaben.push({ feld: "bibliothek", wert: "an", warum });
  if (wahlen.autoModeEnvironment === undefined && rec(einst.autoMode)?.environment !== undefined)
    zugaben.push({ feld: "autoModeEnvironment", wert: "an", warum });
  if (Array.isArray(einst.claudeMdExcludes) && einst.claudeMdExcludes.length)
    zugaben.push({ feld: "claudeMdExcludes", wert: einst.claudeMdExcludes.join(", "), warum: "Fleets Repo: die eigenen Regeln des Owners bleiben hier weg" });
  return { modus, satz: zugaben.length ? `Fleets Repo: ${zugaben.map((z) => z.feld).join(", ")} kommen vom Ort dazu` : "Fleets Repo: der Ort gibt nichts dazu", zugaben };
}

// WO ER SCHON LIEF (für „used here“ im Startfenster): je Agent der letzte Start in diesem Repo, aus der Start-Historie (server/start-historie.ts).
// Ein Start mit Agent zählt für ihn. Ein Start von vor den Agenten oder ohne Agent zählt für den, den er heute wäre: mit Profil für den
// Profil-Agenten, mit dem Label der Orchestratorin für sie, sonst für den Agenten des Repos. `ort` macht aus einem Pfad seine eine Form (realpath).
export interface HistorieZeile { readonly at: number; readonly cwd: string; readonly repo: string | null; readonly label: string | null;
  readonly profil: { readonly id: string } | null; readonly agent: { readonly id: string } | null }
export function zuletztHier(liste: readonly AgentAnsicht[], zeilen: readonly HistorieZeile[], repo: string, ort: (p: string) => string): Map<string, number> {
  const r = ort(repo);
  const hier = (z: HistorieZeile): boolean => (z.repo !== null && ort(z.repo) === r) || ort(z.cwd) === r || ort(z.cwd).startsWith(`${r}/`);
  const fuer = (z: HistorieZeile): string | null => z.agent ? z.agent.id : z.profil ? `profil:${z.profil.id}`
    : z.label === ROLLEN.orchestratorin!.label ? "orchestratorin" : "repo";
  const bekannt = new Set(liste.map((a) => a.id));
  const out = new Map<string, number>();
  for (const z of zeilen) {
    const id = fuer(z);
    if (id && bekannt.has(id) && hier(z) && z.at > (out.get(id) ?? -1)) out.set(id, z.at);
  }
  return out;
}

// DIE ROUTE: GET Liste · POST neu (oder `vonSlot` = einen laufenden Sitz speichern) · GET/PUT/DELETE …/:id · POST …/:id/kopie ·
// GET …/:id/datei · POST …/import. server.ts reicht, was nur es kennt, herein.
export interface AgentenServer {
  dir: string;
  k15: () => Promise<unknown>;
  pruefe: WahlenPruefung;
  slotWahlen: (slot: number) => SlotWahlen | null;
  /** die Start-Historie und die eine Form eines Pfades, für `GET …?cwd=<repo>` */
  historie: () => Promise<readonly HistorieZeile[]>;
  ort: (p: string) => string;
  /** der Objektspeicher von Fleets eigenem Repo (`git rev-parse --git-common-dir`); null ohne git. Eine Funktion, gelesen erst beim
   *  Aufruf: e2e/lanes-lifecycle.ts übersetzt das Objekt in server.ts ohne die Konstante, an der es hängt. */
  fleetCommonDir: () => string | null;
}
const antwort = (body: unknown, status = 200): Response => Response.json(body, { status });
export async function agentenRoute(req: Request, url: URL, q: AgentenServer, jetzt = Date.now): Promise<Response> {
  const rest = url.pathname.slice(AGENTEN_ROUTE.length).split("/").filter(Boolean).map(decodeURIComponent);
  const liste = katalog(q.dir, await q.k15());
  const eigene = liesAgenten(q.dir);
  const vergeben = liste.map((a) => a.id);
  const lies = async (): Promise<Record<string, unknown> | null> => rec(await req.json().catch(() => null));
  const voll = (): Response | null => eigene.length >= MAX_AGENTEN ? antwort({ error: `${MAX_AGENTEN} agents are the cap` }, 409) : null;
  if (!rest.length && req.method === "GET") {
    const cwd = url.searchParams.get("cwd");
    if (!cwd) return antwort({ agenten: liste });
    const hier = await istFleetsRepo(q.ort(cwd), q.fleetCommonDir());
    const sichtbar = hier ? liste : liste.filter((a) => a.id !== "orchestratorin");
    const je = zuletztHier(sichtbar, await q.historie(), cwd, q.ort);
    return antwort({ agenten: sichtbar.map((a) => ({ ...a, zuletzt: je.get(a.id) ?? null })) });
  }
  if (!rest.length && req.method === "POST") {
    const body = await lies();
    if (!body) return antwort({ error: "expected { name, wahlen, agentMd? } or { name, vonSlot }" }, 400);
    const zuViel = voll();
    if (zuViel) return zuViel;
    let eingang: Record<string, unknown> = body, nichtGetragen: string[] = [];
    if (body.vonSlot !== undefined) {
      const s = typeof body.vonSlot === "number" ? q.slotWahlen(body.vonSlot) : null;
      if (!s) return antwort({ error: "vonSlot must be the number of an active slot" }, 400);
      const aus = wahlenAusSlot(s);
      eingang = { id: body.id, name: body.name, wahlen: aus.wahlen, agentMd: aus.agentMd };
      nichtGetragen = aus.nichtGetragen;
    }
    const a = eigenerAgent(eingang, q.pruefe, vergeben, jetzt());
    if (typeof a === "string") return antwort({ error: a }, 400);
    schreibAgenten(q.dir, [...eigene, a]);
    return antwort({ agent: eigeneAnsicht(a), ...(nichtGetragen.length ? { nichtGetragen } : {}) }, 201);
  }
  if (rest.length === 1 && rest[0] === "import" && req.method === "POST") {
    const body = await lies();
    const zuViel = voll();
    if (zuViel) return zuViel;
    const profileHier = [...liste.flatMap((x) => x.agentMd ? [x.agentMd.profil] : []), ...liste.flatMap((x) => typeof x.wahlen.profil === "string" ? [x.wahlen.profil] : [])];
    const r = agentAusDatei(body?.datei, body, q.pruefe, vergeben, jetzt(), profileHier);
    if (typeof r === "string") return antwort({ error: r }, 400);
    schreibAgenten(q.dir, [...eigene, r.agent]);
    return antwort({ agent: eigeneAnsicht(r.agent), ...(r.gedeckelt.length ? { gedeckelt: r.gedeckelt } : {}) }, 201);
  }
  const a = liste.find((x) => x.id === rest[0]);
  if (!a) return antwort({ error: `no agent „${rest[0] ?? ""}“` }, 404);
  if (rest.length === 1 && req.method === "GET") return antwort({ agent: a });
  if (rest.length === 1 && (req.method === "PUT" || req.method === "DELETE")) {
    if (!a.aenderbar) return antwort({ error: `agent „${a.id}“ is ${a.art === "eingebaut" ? "built in" : `read from its ${a.art}`} — copy it (POST ${AGENTEN_ROUTE}/${encodeURIComponent(a.id)}/kopie)` }, 409);
    if (req.method === "DELETE") { schreibAgenten(q.dir, eigene.filter((x) => x.id !== a.id)); return antwort({ ok: true }); }
    const body = await lies();
    // eine Änderung durch den Owner ist sein Blick auf einen importierten Agenten: danach trägt er die Marke nicht mehr
    const neu = eigenerAgent({ name: body?.name ?? a.name, wahlen: body?.wahlen ?? a.wahlen, agentMd: body?.agentMd === undefined ? a.agentMd : body.agentMd, id: a.id },
      q.pruefe, vergeben.filter((x) => x !== a.id), a.am, { ...(a.kopieVon ? { kopieVon: a.kopieVon } : {}), ...(a.abgeleitetVon ? { abgeleitetVon: a.abgeleitetVon } : {}) });
    if (typeof neu === "string") return antwort({ error: neu }, 400);
    schreibAgenten(q.dir, eigene.map((x) => x.id === a.id ? neu : x));
    return antwort({ agent: eigeneAnsicht(neu) });
  }
  if (rest.length === 2 && rest[1] === "kopie" && req.method === "POST") {
    const zuViel = voll();
    if (zuViel) return zuViel;
    const k = kopie(a, await lies(), q.pruefe, vergeben, jetzt());
    if (typeof k === "string") return antwort({ error: k }, 400);
    schreibAgenten(q.dir, [...eigene, k]);
    return antwort({ agent: eigeneAnsicht(k) }, 201);
  }
  if (rest.length === 2 && rest[1] === "datei" && req.method === "GET") {
    const d = agentDatei(a);
    return typeof d === "string" ? antwort({ error: d }, 409) : antwort(d);
  }
  return antwort({ error: "not found" }, 404);
}
