// EIN SETUP, EINE DATEI (docs/start/direction.md Schritt 3; docs/start/system-concept.md, „The base system“).
// Diese Datei ist die eine reisende Form: `fleet-setup/1` mit Sitzen, Kanten und Bausteinen (Packs, Konzepten, Rollen).
// Sie baut auf den vorhandenen Speichern auf (server/agenten.ts, server/k15-speicher.ts, server/sitz-reise.ts):
// Agent, Profil und Konstellation werden beim Export zu einem Objekt, beim Import wieder in die vorhandenen Formen
// geschrieben. Kein neuer Startpfad, keine Migration. Die Bausteine liegen in einem Regal im Zustandsverzeichnis;
// das Regal hält nur Blöcke, nie Sitze oder Kanten.
//
// DIE MARKE „personal“ STEHT AM WISSEN: ein persönlicher Pack, ein persönliches Konzept oder eine persönliche Notiz
// reist als leerer Platz (`text: null, hash: null, personal: true`), nie als Text. Die alten Listen (src/sitz.ts
// #PERSOENLICH, NOTIZ_TEILBAR) sind nur noch der Leseschim für alte Bestände.
//
// DIE KETTE IST REIN (Runde 3): Import und Kopie legen den Ursprung ab (`server/agenten.ts#herkunftAusDatei`), ein Export
// rechnet `derivedFrom`/`derivedFromLine` aus Ursprung und aktuellem Körper (`ketteFuerExport`), ein Speichern schreibt
// keinen Link. Der Setup-Hash dieses Schritts ist der kanonische Hash des Setup-Körpers; die zwei finalen Hashes sind
// Schritt 4, und diese Datei lässt ihnen den Körper und die Felder bereit.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { CONTEXT_PACKS } from "../context-packs";
import { PROFILE0, exportObjekt, type Konst, type Profil, type Quelle } from "../src/k15-entwurf-modell";
import { importKonst } from "../src/k15-import";
import { SPEICHER_DATEI } from "../src/k15-speicher";
import { frontMatterFlag, istPersoenlich, notizIstPersoenlich, persoenlichIn, rechteGedeckelt } from "../src/sitz";
import { istRechtId, rechteAus, type RechtId } from "../session-rechte";
import { AGENT_FORMAT, agentAusDatei, eigenerAgent, eigeneAnsicht, herkunftAusDatei, herkunftLinie, ketteFuerExport,
  liesAgenten, schreibAgenten, type Agent, type AgentAnsicht, type Herkunft, type Wahlen } from "./agenten";
import { agentMdText } from "./agentmd";
import type { EigenerPack } from "./eigene-packs";
import { merkeFassungen } from "./konst-fassungen";
import { ORCHESTRATOR_PACK_PATHS, ORCHESTRATOR_ROLE_PATH, ORCHESTRATOR_START_PATH } from "./orchestrator-start";
import { LANE_ROLE_CARD, MAIN_ROLE_CARD } from "./rollenkarten";
import { RECHT_WAS, ROLLEN_BUENDEL } from "./tuer-rechte";
import type { SeatKnowledge, SeatPack } from "./sitz-wissen";

export const SETUP_FORMAT = "fleet-setup/1";
export const SETUP_ROUTE = "/api/setups";
export const SETUP_SHELF_DATEI = "setup-bausteine.json";
export const MAX_SETUP_SEATS = 24;
const HEX64 = /^[0-9a-f]{64}$/;
const PACK_ID = /^[a-z0-9][a-z0-9._-]{0,79}(?:@[0-9a-f]{8})?$/;
const CONCEPT_ID = /^k-[a-z0-9-]{1,64}$/;

const rec = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v)) : null;
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");
export const hashText = (text: string): string => sha(text);

// kanonisch: Schlüssel sortiert, Arrays in ihrer Reihenfolge. Dieselbe Form hat schon server/konst-fassungen.ts.
const kanon = (v: unknown): unknown => Array.isArray(v) ? v.map(kanon)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => [k, kanon(x)])) : v;

export interface SetupQuelle { path: string; anchor: string }
export interface SetupKnowledgeRef { kind: "pack" | "concept"; id: string; hash: string | null }
export interface SetupPack {
  kind: "pack"; id: string; hash: string | null; text: string | null; personal?: true;
  useWhen: string | null; sources: SetupQuelle[]; author?: string; way?: "start" | "skill";
}
export interface SetupConcept {
  kind: "concept"; id: string; version: number | null; hash: string | null; text: string | null; personal?: true;
  author?: string; purpose?: string; validity?: string;
}
export interface SetupNote { id: string; hash: string | null; text: string | null; personal?: true }
export interface SetupNotebook { index: string; notes: SetupNote[]; home: number }
/** Der leere Platz der Richtung: sie gehört der Person, nicht dem geteilten Setup. */
export interface SetupDirection { text: null; personal: true }
/** EIN ROLLENSTEIN: Starttext, Bundel der Server-Rechte (Schritt 2), die Packs, die die Rolle liest, und sein Hash. */
export interface SetupRole {
  id: string; name: string; hash: string;
  start: { titel: string; text: string };
  rights: RechtId[];
  packs: SetupKnowledgeRef[];
}
export interface SetupSeat {
  id: string; name: string;
  who: { harness: string | null; model: string | null; effort: string | null };
  start: { purpose?: { titel: string; text: string }; role?: string; direction?: SetupDirection; ownFile?: { titel: string; text: string } };
  reads: SetupKnowledgeRef[];
  may: { rechte: unknown; permissionMode: string | null; plan?: Record<string, unknown> };
  worksWith: { reportsTo?: string };
  notebook: SetupNotebook | null;
}
export interface SetupEdge { from: string; to: string; kind: "reports-to" }
export interface SetupDatei {
  format: typeof SETUP_FORMAT;
  name: string;
  setupHash: string;
  derivedFrom: string | null;
  derivedFromLine: string[];
  seats: SetupSeat[];
  edges: SetupEdge[];
  packs: SetupPack[];
  concepts: SetupConcept[];
  roles: SetupRole[];
  task?: unknown;
  runs?: unknown[];
}
export interface SetupShelf { version: 1; packs: SetupPack[]; concepts: SetupConcept[]; roles?: SetupRole[] }
export interface RoleStein { role: SetupRole; packs: SetupPack[] }

const str = (v: unknown, max: number): string | null => typeof v === "string" && v.length <= max ? v : null;
const hashOrNull = (v: unknown): string | null | undefined => v === null || v === undefined ? null : typeof v === "string" && HEX64.test(v) ? v : undefined;
const noteId = (v: unknown): string | null => typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.md$/.test(v) && v !== "MEMORY.md" ? v : null;

function quellenAus(v: unknown): SetupQuelle[] | null {
  if (!Array.isArray(v) || v.length > 8) return null;
  const out: SetupQuelle[] = [];
  for (const x of v) {
    const r = rec(x); const path = str(r?.path, 300), anchor = str(r?.anchor, 300);
    if (!r || path === null || anchor === null) return null;
    out.push({ path, anchor });
  }
  return out;
}

/** Der Setup-Körper, wie ihn Schritt 4 hashen wird: Bausteine durch ihren eigenen Hash, kein Lauf, keine eigene Herkunft. */
export function setupKoerper(d: SetupDatei): Record<string, unknown> {
  return {
    name: d.name,
    seats: d.seats,
    edges: d.edges,
    packs: d.packs.map((p) => ({ kind: "pack", id: p.id, hash: p.hash, personal: p.personal === true })),
    concepts: d.concepts.map((c) => ({ kind: "concept", id: c.id, version: c.version, hash: c.hash, personal: c.personal === true })),
    roles: d.roles,
    ...(d.task !== undefined ? { task: d.task } : {}),
  };
}
export function setupHashVon(d: SetupDatei): string {
  return sha(JSON.stringify(kanon(setupKoerper(d))));
}
export function mitSetupHash(d: Omit<SetupDatei, "setupHash"> & { setupHash?: string }): SetupDatei {
  const ohne = { ...d, setupHash: "" } as SetupDatei;
  return { ...ohne, setupHash: setupHashVon(ohne) };
}
/** Der Hash eines Rollensteins: Starttext, Rechte und die Pack-Verweise (jeder Pack durch seinen Hash). */
export function roleHash(r: Omit<SetupRole, "hash">): string {
  return sha(JSON.stringify(kanon({ id: r.id, name: r.name, start: r.start, rights: r.rights, packs: r.packs })));
}

// ---- validate a setup read from someone else ----------------------------------------------------
function pruefeBlock(raw: unknown, kind: "pack" | "concept"): SetupPack | SetupConcept | string {
  const r = rec(raw);
  const id = str(r?.id, 86);
  if (!r || !id || (kind === "pack" ? !PACK_ID.test(id) : !CONCEPT_ID.test(id)))
    return `${kind} needs an id of lowercase letters, digits, . _ -${kind === "concept" ? " (k-…)" : ""}`;
  const personal = r.personal === true;
  const hash = hashOrNull(r.hash);
  if (hash === undefined) return `${kind} ${id}: hash must be a sha256 or null`;
  const text = r.text === null || r.text === undefined ? null : str(r.text, 200_000);
  if (r.text !== null && r.text !== undefined && text === null) return `${kind} ${id}: text is too long`;
  if (personal) {
    if (text !== null || hash !== null) return `${kind} ${id}: a personal place carries no text and no hash — private text never travels`;
    if (kind === "pack" && (r.useWhen !== null && r.useWhen !== undefined && str(r.useWhen, 400) === null)) return `pack ${id}: useWhen is one line`;
  } else {
    if (text === null) return `${kind} ${id}: a shared block carries its text`;
    if (hash === null || hashText(text) !== hash) return `${kind} ${id}: its hash does not match its text`;
  }
  if (kind === "pack") {
    const sources = quellenAus(r.sources);
    if (!sources) return `pack ${id}: sources is a list of { path, anchor }`;
    const useWhen = r.useWhen === null || r.useWhen === undefined ? null : str(r.useWhen, 400);
    if (useWhen === null && r.useWhen !== null && r.useWhen !== undefined) return `pack ${id}: useWhen is one line`;
    const way = r.way === "start" || r.way === "skill" ? r.way : undefined;
    return { kind, id, hash, text, useWhen, sources, ...(personal ? { personal: true as const } : {}),
      ...(typeof r.author === "string" ? { author: r.author.slice(0, 120) } : {}), ...(way ? { way } : {}) };
  }
  const version = r.version === null || r.version === undefined ? null : Number.isSafeInteger(r.version) && Number(r.version) >= 1 ? Number(r.version) : undefined;
  if (version === undefined) return `concept ${id}: version is a whole number from 1 or null`;
  return { kind, id, version, hash, text, ...(personal ? { personal: true as const } : {}),
    ...(typeof r.author === "string" ? { author: r.author.slice(0, 120) } : {}),
    ...(typeof r.purpose === "string" ? { purpose: r.purpose.slice(0, 500) } : {}),
    ...(typeof r.validity === "string" ? { validity: r.validity.slice(0, 200) } : {}) };
}

function pruefeRolle(raw: unknown, packs: Map<string, SetupPack>): SetupRole | string {
  const r = rec(raw);
  const id = str(r?.id, 80);
  if (!r || !id || !/^[a-z][a-z0-9-]{0,79}$/.test(id)) return "a role needs an id of lowercase letters, digits and dashes";
  const name = str(r?.name, 120);
  if (!name) return `role ${id}: name is one line`;
  const start = rec(r?.start);
  if (!start || typeof start.titel !== "string" || typeof start.text !== "string" || !start.text.trim())
    return `role ${id}: start is { titel, text } with a text`;
  if (!Array.isArray(r?.rights) || r.rights.length > 32 || r.rights.some((x) => !istRechtId(x)))
    return `role ${id}: rights is a list of step 2 right ids`;
  const rights = [...new Set(r.rights as RechtId[])];
  if (!Array.isArray(r?.packs) || r.packs.length > 80) return `role ${id}: packs is a list of pack refs`;
  const rolePacks: SetupKnowledgeRef[] = [];
  for (const x of r.packs) {
    const k = rec(x), rid = str(k?.id, 86), hash = hashOrNull(k?.hash);
    if (!k || k.kind !== "pack" || !rid || hash === undefined) return `role ${id}: a pack ref is { kind: "pack", id, hash }`;
    const block = packs.get(rid);
    if (!block) return `role ${id}: reads pack „${rid}“, which the file does not carry`;
    if (block.hash !== hash) return `role ${id}: reads pack „${rid}“ with another hash than its block`;
    if (hash === null && block.personal !== true) return `role ${id}: a null hash needs a personal pack`;
    rolePacks.push({ kind: "pack", id: rid, hash });
  }
  const hash = typeof r.hash === "string" && HEX64.test(r.hash) ? r.hash : null;
  if (!hash) return `role ${id}: hash is a sha256`;
  const role: SetupRole = { id, name, hash, start: { titel: start.titel.slice(0, 120), text: start.text.slice(0, 200_000) }, rights, packs: rolePacks };
  if (roleHash(role) !== hash) return `role ${id}: hash does not match its block`;
  return role;
}

function pruefeSeat(raw: unknown, packs: Map<string, SetupPack>, concepts: Map<string, SetupConcept>): SetupSeat | string {
  const r = rec(raw), id = str(r?.id, 80), name = str(r?.name, 120);
  if (!r || !id || !/^[a-z0-9][a-z0-9._-]{0,79}$/.test(id)) return "seat needs an id of lowercase letters, digits, . _ -";
  if (!name) return `seat ${id}: name is one line`;
  const who = rec(r.who) ?? {};
  const start = rec(r.start) ?? {};
  const may = rec(r.may) ?? {};
  const works = rec(r.worksWith) ?? {};
  const readsRaw = Array.isArray(r.reads) ? r.reads : null;
  if (!readsRaw) return `seat ${id}: reads must be a list of { kind, id, hash }`;
  const reads: SetupKnowledgeRef[] = [];
  for (const x of readsRaw) {
    const k = rec(x), kind = k?.kind, rid = str(k?.id, 86), hash = hashOrNull(k?.hash);
    if (!k || (kind !== "pack" && kind !== "concept") || !rid || hash === undefined) return `seat ${id}: reads needs { kind, id, hash }`;
    const block = kind === "pack" ? packs.get(rid) : concepts.get(rid);
    if (!block) return `seat ${id}: reads names ${kind} „${rid}“, which the file does not carry`;
    if (block.hash !== hash) return `seat ${id}: reads names ${kind} „${rid}“ with another hash than its block`;
    reads.push({ kind, id: rid, hash });
  }
  const purposeRaw = rec(start.purpose);
  let purpose: SetupSeat["start"]["purpose"];
  if (start.purpose !== undefined && start.purpose !== null) {
    if (!purposeRaw || typeof purposeRaw.titel !== "string" || typeof purposeRaw.text !== "string" || !purposeRaw.text.trim())
      return `seat ${id}: purpose is { titel, text } with a text`;
    purpose = { titel: purposeRaw.titel.slice(0, 120), text: purposeRaw.text.slice(0, 64_000) };
  }
  let direction: SetupDirection | undefined;
  if (start.direction !== undefined && start.direction !== null) {
    const d = rec(start.direction);
    if (!d || d.personal !== true || d.text !== null) return `seat ${id}: direction is an empty personal place ({ text: null, personal: true })`;
    direction = { text: null, personal: true };
  }
  const ownRaw = rec(start.ownFile);
  let ownFile: SetupSeat["start"]["ownFile"];
  if (start.ownFile !== undefined && start.ownFile !== null) {
    if (!ownRaw || typeof ownRaw.titel !== "string" || typeof ownRaw.text !== "string" || !ownRaw.text.trim())
      return `seat ${id}: ownFile is { titel, text } with a text`;
    ownFile = { titel: ownRaw.titel.slice(0, 120), text: ownRaw.text.slice(0, 64_000) };
  }
  const permissionMode = may.permissionMode === null || may.permissionMode === undefined ? null : str(may.permissionMode, 40);
  if (permissionMode === "bypassPermissions") return `seat ${id}: an imported setup never starts in bypass`;
  if (may.permissionMode !== null && may.permissionMode !== undefined && permissionMode === null) return `seat ${id}: permissionMode is one word`;
  const rechteRoh = may.rechte === undefined ? null : may.rechte;
  const rechte = rechteRoh === null ? null : rechteAus(rechteRoh);
  if (rechteRoh !== null && !rechte) return `seat ${id}: may.rechte is not readable`;
  const writes = Object.keys(works).filter((k) => k !== "reportsTo");
  if (writes.length) return `seat ${id}: worksWith knows reportsTo, not ${writes.join(", ")} (edges wait for round 3)`;
  const notebookRaw = r.notebook;
  let notebook: SetupNotebook | null = null;
  if (notebookRaw !== null && notebookRaw !== undefined) {
    const n = rec(notebookRaw), index = str(n?.index, 100_000);
    if (!n || index === null || !Array.isArray(n.notes) || n.notes.length > 200) return `seat ${id}: notebook is { index, notes, home }`;
    const notes: SetupNote[] = [];
    for (const x of n.notes) {
      const note = rec(x), nid = noteId(note?.id), nh = hashOrNull(note?.hash), personal = note?.personal === true;
      const nt = note?.text === null || note?.text === undefined ? null : str(note.text, 100_000);
      if (!note || !nid) return `seat ${id}: a note is { id: <name>.md, hash, text }`;
      if (note.text !== null && note.text !== undefined && nt === null) return `seat ${id}: note ${nid} is too long`;
      if (personal) { if (nt !== null || nh !== null) return `seat ${id}: personal note ${nid} carries text`; }
      else if (nt === null || nh === null || hashText(nt) !== nh) return `seat ${id}: note ${nid} has no matching text and hash`;
      notes.push({ id: nid, hash: nh, text: nt, ...(personal ? { personal: true as const } : {}) });
    }
    const home = Number.isSafeInteger(n.home) && Number(n.home) >= 0 ? Number(n.home) : null;
    if (home === null) return `seat ${id}: notebook.home is a number from 0`;
    notebook = { index, notes, home };
  }
  return { id, name, who: { harness: str(who.harness, 80) ?? null, model: str(who.model, 120) ?? null, effort: str(who.effort, 40) ?? null },
    start: { ...(purpose ? { purpose } : {}), ...(start.role !== undefined ? { role: str(start.role, 80) ?? "" } : {}),
      ...(direction ? { direction } : {}), ...(ownFile ? { ownFile } : {}) },
    reads, may: { rechte: rechte ?? null, permissionMode, ...(rec(may.plan) ? { plan: rec(may.plan)! } : {}) },
    worksWith: { ...(typeof works.reportsTo === "string" && works.reportsTo ? { reportsTo: works.reportsTo } : {}) }, notebook };
}

/** Ganz geprüft; null heisst: so darf die Datei in eine fremde Fleet. */
export function pruefeSetupDatei(raw: unknown): SetupDatei | string {
  const r = rec(raw);
  if (!r || r.format !== SETUP_FORMAT) return `expected a file of format ${SETUP_FORMAT}`;
  if (typeof r.name !== "string" || !r.name.trim() || r.name.length > 120) return "name must be 1 to 120 characters";
  const setupHash = typeof r.setupHash === "string" && HEX64.test(r.setupHash) ? r.setupHash : null;
  if (!setupHash) return "setupHash is a sha256";
  const derivedFrom = hashOrNull(r.derivedFrom);
  if (derivedFrom === undefined) return "derivedFrom is a sha256 or null";
  const lineRaw = r.derivedFromLine === undefined ? [] : r.derivedFromLine;
  if (!Array.isArray(lineRaw) || lineRaw.length > 64 || lineRaw.some((x) => typeof x !== "string" || !HEX64.test(x)))
    return "derivedFromLine is a list of sha256 values";
  if (!Array.isArray(r.packs) || r.packs.length > 80) return "packs must be a list of at most 80 blocks";
  if (!Array.isArray(r.concepts) || r.concepts.length > 80) return "concepts must be a list of at most 80 blocks";
  if (!Array.isArray(r.roles) || r.roles.length > 32) return "roles must be a list of at most 32 role blocks";
  const packs = new Map<string, SetupPack>(), concepts = new Map<string, SetupConcept>();
  for (const x of r.packs) {
    const b = pruefeBlock(x, "pack");
    if (typeof b === "string") return b;
    if (packs.has(b.id)) return `pack ${b.id} stands twice in the file`;
    packs.set(b.id, b as SetupPack);
  }
  for (const x of r.concepts) {
    const b = pruefeBlock(x, "concept");
    if (typeof b === "string") return b;
    if (concepts.has(b.id)) return `concept ${b.id} stands twice in the file`;
    concepts.set(b.id, b as SetupConcept);
  }
  const roles = new Map<string, SetupRole>();
  for (const x of r.roles) {
    const b = pruefeRolle(x, packs);
    if (typeof b === "string") return b;
    if (roles.has(b.id)) return `role ${b.id} stands twice in the file`;
    roles.set(b.id, b);
  }
  if (!Array.isArray(r.seats) || !r.seats.length || r.seats.length > MAX_SETUP_SEATS) return `seats must hold 1..${MAX_SETUP_SEATS}`;
  const seats: SetupSeat[] = [];
  for (const x of r.seats) {
    const s = pruefeSeat(x, packs, concepts);
    if (typeof s === "string") return s;
    if (seats.some((y) => y.id === s.id)) return `seat ${s.id} stands twice in the file`;
    seats.push(s);
  }
  const edgesRaw = r.edges === undefined ? [] : r.edges;
  if (!Array.isArray(edgesRaw) || edgesRaw.length > MAX_SETUP_SEATS * 4) return "edges must be a list";
  const ids = new Set(seats.map((s) => s.id));
  const edges: SetupEdge[] = [];
  for (const x of edgesRaw) {
    const e = rec(x);
    if (!e || typeof e.from !== "string" || typeof e.to !== "string" || e.kind !== "reports-to") return "an edge is { from, to, kind: \"reports-to\" }";
    if (!ids.has(e.from) || !ids.has(e.to)) return `edge ${e.from} → ${e.to} names a seat outside the file`;
    if (e.from === e.to) return `edge ${e.from} → ${e.to} reports to itself`;
    edges.push({ from: e.from, to: e.to, kind: "reports-to" });
  }
  for (const s of seats) {
    if (s.worksWith.reportsTo && !ids.has(s.worksWith.reportsTo)) return `seat ${s.id} reports to a seat outside the file`;
    if (s.start.role && !roles.has(s.start.role)) return `seat ${s.id}: role „${s.start.role}“ is not in the file`;
  }
  const ohne = { format: SETUP_FORMAT, name: r.name.trim(), setupHash, derivedFrom, derivedFromLine: lineRaw as string[],
    seats, edges, packs: [...packs.values()], concepts: [...concepts.values()], roles: [...roles.values()],
    ...(r.task !== undefined ? { task: r.task } : {}), ...(Array.isArray(r.runs) ? { runs: r.runs } : {}) } as SetupDatei;
  if (setupHashVon(ohne) !== setupHash) return "setupHash does not match the setup body";
  return ohne;
}

// ---- local shelf ---------------------------------------------------------------------------------
export const setupShelfPfad = (dir: string): string => join(dir, SETUP_SHELF_DATEI);
export function liesShelf(dir: string): SetupShelf {
  try {
    const raw: unknown = JSON.parse(readFileSync(setupShelfPfad(dir), "utf8"));
    const r = rec(raw);
    const packs = Array.isArray(r?.packs) ? r.packs.map((x) => pruefeBlock(x, "pack")).filter((x): x is SetupPack => typeof x !== "string") : [];
    const concepts = Array.isArray(r?.concepts) ? r.concepts.map((x) => pruefeBlock(x, "concept")).filter((x): x is SetupConcept => typeof x !== "string") : [];
    const byId = new Map(packs.map((p) => [p.id, p]));
    const roles = Array.isArray(r?.roles) ? r.roles.map((x) => pruefeRolle(x, byId)).filter((x): x is SetupRole => typeof x !== "string") : [];
    return { version: 1, packs, concepts, roles };
  } catch { return { version: 1, packs: [], concepts: [], roles: [] }; }
}
export function schreibShelf(dir: string, shelf: SetupShelf): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const ziel = setupShelfPfad(dir);
  const tmp = `${ziel}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify({ version: 1, packs: shelf.packs, concepts: shelf.concepts, roles: shelf.roles ?? [] }, null, 1), { mode: 0o600 });
  renameSync(tmp, ziel);
}

// ---- role stones ----------------------------------------------------------------------------------
const FLEET_ROOT = join(import.meta.dir, "..");
const ROLE_ID = /^[a-z][a-z0-9-]{0,79}$/;
const seedFuerPfad = (path: string): { id: string; useWhen: string; personal: boolean; source: { path: string; anchor: string } } | null => {
  for (const pack of CONTEXT_PACKS) {
    if (!("sources" in pack) || !Array.isArray(pack.sources)) continue;
    const source = pack.sources.find((s) => s.path === path);
    if (source) return { id: pack.id, useWhen: pack.useWhen, personal: (pack as { personal?: true }).personal === true,
      source: { path: source.path, anchor: source.anchor } };
  }
  return null;
};
function packBlockAusFleet(root: string, path: string): SetupPack | null {
  let text: string;
  try { text = readFileSync(join(root, path), "utf8"); } catch { return null; }
  const seed = seedFuerPfad(path);
  const id = seed?.id ?? basename(path, ".md");
  // the mark lives on the knowledge: the register (.fleet/context-packs.json) or the legacy reading shim for old stock
  const personal = seed?.personal === true || istPersoenlich(id);
  return { kind: "pack", id, hash: personal ? null : hashText(text), text: personal ? null : text,
    ...(personal ? { personal: true as const } : {}), useWhen: seed?.useWhen ?? null,
    sources: [seed?.source ?? { path, anchor: `# ${basename(path, ".md")}` }], way: "start" };
}
function builtinRolle(id: string, root: string): RoleStein | null {
  const rolle = id === "orchestratorin" || id === "orchestrator" ? "orchestratorin" : id;
  if (rolle === "orchestratorin") {
    let text: string;
    try { text = readFileSync(join(root, ORCHESTRATOR_ROLE_PATH), "utf8"); } catch { return null; }
    const packs = [ORCHESTRATOR_START_PATH, ...ORCHESTRATOR_PACK_PATHS].map((p) => packBlockAusFleet(root, p));
    if (packs.some((p) => p === null)) return null;
    const blocks = packs as SetupPack[];
    const refs = blocks.map((p) => ({ kind: "pack" as const, id: p.id, hash: p.hash }));
    const role: SetupRole = { id: "orchestratorin", name: "Orchestrator", hash: roleHash({ id: "orchestratorin", name: "Orchestrator",
      start: { titel: "Orchestrator", text }, rights: [...ROLLEN_BUENDEL.orchestrator], packs: refs }),
      start: { titel: "Orchestrator", text }, rights: [...ROLLEN_BUENDEL.orchestrator], packs: refs };
    return { role, packs: blocks };
  }
  if (rolle === "lane" || rolle === "main") {
    const text = rolle === "lane" ? LANE_ROLE_CARD : MAIN_ROLE_CARD;
    const name = rolle === "lane" ? "Lane" : "MAIN";
    const rights = [...(rolle === "lane" ? ROLLEN_BUENDEL.lane : ROLLEN_BUENDEL["program-main"])];
    const role: SetupRole = { id: rolle, name, hash: roleHash({ id: rolle, name, start: { titel: name, text }, rights, packs: [] }),
      start: { titel: name, text }, rights, packs: [] };
    return { role, packs: [] };
  }
  return null;
}
/** Ein Rollenstein, den ein Sitz hier wählen darf: erst das importierte Regal, dann Fleet's eigene Rollen. */
export function roleStein(id: string, dir: string | null | undefined, root = FLEET_ROOT): RoleStein | null {
  if (!ROLE_ID.test(id)) return null;
  if (dir) {
    const shelf = liesShelf(dir);
    const role = shelf.roles?.find((r) => r.id === id);
    if (role) {
      const packs = role.packs.flatMap((ref) => shelf.packs.filter((p) => p.id === ref.id && p.hash === ref.hash));
      return { role, packs };
    }
  }
  return builtinRolle(id, root);
}

/** Rolle und Konzepte, die ein eigener Agent als Steine wählt: aus dem Regal oder aus Fleet's Rollen, die Konzepte aus Regal oder Ledger. */
export function steineFuerAgentWahl(wahlen: Wahlen | null | undefined, dir: string | null | undefined, root = FLEET_ROOT, konzeptRoot: string | null = null):
  { role: SetupRole | null; concepts: SetupConcept[]; block: string | null } {
  const role = typeof wahlen?.rolle === "string" ? roleStein(wahlen.rolle, dir, root)?.role ?? null : null;
  const ids = Array.isArray(wahlen?.konzepte) ? wahlen.konzepte.filter((x): x is string => typeof x === "string") : [];
  const shelf = ids.length && dir ? liesShelf(dir) : null;
  const concepts = ids.flatMap((id): SetupConcept[] => {
    const ausShelf = shelf?.concepts.find((c) => c.id === id && c.text !== null);
    if (ausShelf) return [ausShelf];
    const c = liesKonzept(konzeptRoot, id);
    return c ? [{ kind: "concept", id: c.id, version: c.version, hash: c.hash, text: c.text, ...(c.personal ? { personal: true as const } : {}),
      ...(c.author ? { author: c.author } : {}), ...(c.purpose ? { purpose: c.purpose } : {}), ...(c.validity ? { validity: c.validity } : {}) }] : [];
  });
  return { role, concepts, block: role || concepts.length ? startBlockAusSteinen(role, concepts) : null };
}

/** Der leere Platz der Richtung, wie ein Sitz ihn in seinem Start liest: die Person füllt ihn, oder der Sitz startet ohne. */
export const RICHTUNG_PLATZ = "DIRECTION — empty place: the direction is the person's own. Fill it with yours, or start without one.";
/** EIN ROLLENSTEIN IM START eines eigenen Agenten: Starttext, Rechte und die gewählten Konzepte als + Zeilen mit Autor. */
export function startBlockAusSteinen(role: SetupRole | null, concepts: readonly SetupConcept[] = []): string {
  const rechte = role ? role.rights.length ? role.rights.map((id) => `${id} — ${RECHT_WAS[id]}`).join("; ") : "none" : null;
  return [
    ...(role ? [`FLEET ROLE (${role.id}, author: ${role.name})`, role.start.text,
      `ROLE RIGHTS (step 2 bundle, granted to this seat): ${rechte}`] : []),
    ...concepts.filter((c) => (c.text ?? "").trim()).flatMap((c) => [`+ concept ${c.id} (author: ${c.author ?? "unknown"})`, c.text ?? ""]),
  ].join("\n\n");
}

// ---- concepts from the private ledger ------------------------------------------------------------
export interface KonzeptQuelle { id: string; version: number; hash: string; text: string; personal: boolean; author?: string; purpose?: string; validity?: string }
export function liesKonzept(root: string | null, id: string): KonzeptQuelle | null {
  if (!root || !CONCEPT_ID.test(id)) return null;
  const dir = join(root, id);
  let rows: unknown[];
  try { rows = readFileSync(join(dir, "versionen.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); }
  catch { return null; }
  const versions = rows.map(rec).filter((x): x is Record<string, unknown> => !!x && x.konzept === id && Number.isSafeInteger(x.version))
    .sort((a, b) => Number(b.version) - Number(a.version));
  const row = versions[0];
  if (!row || typeof row.sha256 !== "string" || !HEX64.test(row.sha256)) return null;
  let text: string;
  try { text = readFileSync(join(dir, `v${String(row.version)}.md`), "utf8"); } catch { return null; }
  if (hashText(text) !== row.sha256) return null;
  const actor = rec(row.actor);
  return { id, version: Number(row.version), hash: row.sha256, text, personal: frontMatterFlag(text, "personal") === true,
    ...(typeof actor?.kind === "string" ? { author: actor.kind } : {}), ...(typeof row.anlass === "string" ? { purpose: row.anlass } : {}),
    ...(typeof row.geltung === "string" ? { validity: row.geltung } : {}) };
}

// ---- builders ------------------------------------------------------------------------------------
export interface SetupQuellen {
  /** das Zustandsverzeichnis (für importierte Rollensteine im Regal) und Fleet's Baum (für eigene Rollen) */
  dir?: string;
  repoRoot?: string;
  bibliothek?: () => Promise<SeatKnowledge> | SeatKnowledge;
  eigenePacks?: () => Promise<EigenerPack[]> | EigenerPack[];
  notizbuch?: (profil: string) => Promise<{ index: string; dateien: { datei: string; text: string }[] } | null> | { index: string; dateien: { datei: string; text: string }[] } | null;
  konzept?: (id: string) => Promise<KonzeptQuelle | null> | KonzeptQuelle | null;
  /** persönliche Texte, die der Aufrufer schon kennt; die Probe sucht sie in der fertigen Datei */
  privateTexte?: readonly string[];
  jetzt?: () => number;
}
export interface SetupExport { datei: SetupDatei; hinweise: string[] }

const quelle = (q: { path: string; anchor: string }): SetupQuelle => ({ path: q.path, anchor: q.anchor });
const alsPack = (p: SeatPack): SetupPack => {
  const personal = istPersoenlich(p.id, p.personal === true) || p.privat === true;
  const text = p.text ?? "";
  const hash = personal ? null : hashText(text);
  return { kind: "pack", id: p.id, hash, text: personal ? null : text, ...(personal ? { personal: true as const } : {}),
    useWhen: p.useWhen, sources: p.sources.map(quelle), ...(p.autor ? { author: p.autor } : {}), ...(p.weg ? { way: p.weg } : {}) };
};
const alsKonzept = (c: KonzeptQuelle): SetupConcept => ({
  kind: "concept", id: c.id, version: c.version, hash: c.personal ? null : c.hash, text: c.personal ? null : c.text,
  ...(c.personal ? { personal: true as const } : {}), ...(c.author ? { author: c.author } : {}), ...(c.purpose ? { purpose: c.purpose } : {}),
  ...(c.validity ? { validity: c.validity } : {}) });

function notebookAus(index: string, dateien: readonly { datei: string; text: string }[]): SetupNotebook {
  const notes = dateien.filter((d) => noteId(d.datei)).map((d) => {
    const personal = notizIstPersoenlich(d.text);
    return { id: d.datei, hash: personal ? null : hashText(d.text), text: personal ? null : d.text,
      ...(personal ? { personal: true as const } : {}) };
  });
  const daheim = notes.filter((n) => n.personal).map((n) => n.id);
  const zeigtAuf = (z: string, id: string) => z.includes(`](${id})`) || z.includes(`](./${id})`);
  return { index: index.split("\n").filter((z) => !daheim.some((id) => zeigtAuf(z, id))).join("\n"), notes, home: daheim.length };
}

function privateTexteAusWissen(k: SeatKnowledge): string[] {
  return k.packs.filter((p) => (istPersoenlich(p.id, p.personal === true) || p.privat === true) && p.text !== null).map((p) => p.text as string);
}
function privateTexteAusNotizen(n: SetupNotebook | null): string[] {
  return n ? n.notes.filter((x) => x.personal && x.text !== null).map((x) => x.text as string) : [];
}
/** Die Probe nach der Konstruktion: kein persönlicher Text steht irgendwo in der Datei. */
export function persoenlicherTextInDatei(datei: SetupDatei, texte: readonly string[]): string | null {
  const text = JSON.stringify(datei);
  return persoenlichIn(text, texte) ?? texte.find((t) => t.trim().length > 0
    && (text.includes(t) || text.includes(JSON.stringify(t).slice(1, -1))))?.slice(0, 80) ?? null;
}

function wissenAusEigenen(packs: readonly EigenerPack[]): SeatKnowledge {
  return { tree: "fleet", repoRoot: "", head: "", packs: packs.map((p) => ({ id: p.id, useWhen: p.useWhen,
    sources: [{ path: p.pfad, anchor: `# ${p.titel}` }], text: p.text, weg: "start" as const, privat: true, ...(p.personal ? { personal: true as const } : {}) })) };
}

/** EIN AGENT ALS EIN-SITZ-SETUP. Seine Pack-Ids werden zu Blöcken mit Text und Hash; persönliche Blöcke bleiben leer. */
export async function setupAusAgent(a: Agent, q: SetupQuellen = {}): Promise<SetupExport | string> {
  const hinweise: string[] = [];
  let k: SeatKnowledge;
  try { k = await (q.bibliothek?.() ?? wissenAusEigenen(await (q.eigenePacks?.() ?? []))); }
  catch (e) { k = { tree: "fleet", repoRoot: "", head: "", packs: [] }; hinweise.push(`Fleets Bibliothek ist hier nicht lesbar (${e instanceof Error ? e.message : String(e)}); der Agent reist ohne Packs`); }
  const wahl = a.wahlen.bibliothek;
  const gewaehlt = Array.isArray(wahl) ? new Set(wahl.filter((x): x is string => typeof x === "string")) : null;
  const packs: SetupPack[] = [], concepts: SetupConcept[] = [];
  const refs: SetupKnowledgeRef[] = [];
  const addPack = (p: SetupPack): SetupKnowledgeRef => {
    let id = p.id;
    if (packs.some((x) => x.id === id && x.hash !== p.hash)) id = `${p.id}@${(p.hash ?? "personal").slice(0, 8)}`;
    const da = packs.find((x) => x.id === id);
    if (da) return { kind: "pack", id, hash: da.hash };
    const block = { ...p, id };
    packs.push(block);
    return { kind: "pack", id, hash: block.hash };
  };
  const addConcept = (c: SetupConcept): SetupKnowledgeRef => {
    let id = c.id;
    if (concepts.some((x) => x.id === id && x.hash !== c.hash)) id = `${c.id}@${(c.hash ?? "personal").slice(0, 8)}`;
    const da = concepts.find((x) => x.id === id);
    if (da) return { kind: "concept", id, hash: da.hash };
    const block = { ...c, id };
    concepts.push(block);
    return { kind: "concept", id, hash: block.hash };
  };
  for (const p of k.packs) {
    if (p.text === null) continue;
    if (gewaehlt ? !gewaehlt.has(p.id) : (wahl === false || p.privat || p.zurWahl)) continue;
    refs.push(addPack(alsPack(p)));
  }
  if (Array.isArray(wahl)) for (const id of gewaehlt ?? []) if (!k.packs.some((p) => p.id === id))
    hinweise.push(`der Pack ${id} steht nicht in Fleets Bibliothek und reist nicht mit`);
  const konzepte = Array.isArray(a.wahlen.konzepte) ? a.wahlen.konzepte.filter((x): x is string => typeof x === "string") : [];
  const privateKonzepte: string[] = [];
  for (const id of konzepte) {
    const c = await (q.konzept?.(id) ?? null);
    if (!c) hinweise.push(`das Konzept ${id} ist hier nicht lesbar und reist nicht mit`);
    else { if (c.personal) privateKonzepte.push(c.text); refs.push(addConcept(alsKonzept(c))); }
  }
  let notebook: SetupNotebook | null = null;
  const nb = a.agentMd?.profil ? await (q.notizbuch?.(a.agentMd.profil) ?? null) : null;
  if (nb) notebook = notebookAus(nb.index, nb.dateien);
  // EINE ROLLE IST EIN STEIN: ihr Starttext, ihr Rechtebundel und die Packs, die sie liest, reisen mit. Die Richtung ist
  // nicht Teil davon; sie steht am Sitz als leerer persönlicher Platz.
  const roles: SetupRole[] = [];
  let roleId: string | null = null;
  if (typeof a.wahlen.rolle === "string") {
    const stein = roleStein(a.wahlen.rolle, q.dir, q.repoRoot ?? FLEET_ROOT);
    if (!stein) return `die Rolle „${a.wahlen.rolle}“ ist hier nicht lesbar und reist nicht mit`;
    const roleRefs = stein.packs.map((p) => addPack(p));
    const role: SetupRole = { ...stein.role, packs: roleRefs };
    roles.push(role);
    roleId = role.id;
    for (const ref of roleRefs) if (!refs.some((x) => x.kind === ref.kind && x.id === ref.id && x.hash === ref.hash)) refs.push(ref);
  }
  const seat: SetupSeat = { id: a.id, name: a.name,
    who: { harness: typeof a.wahlen.harness === "string" ? a.wahlen.harness : null, model: typeof a.wahlen.model === "string" ? a.wahlen.model : null,
      effort: typeof a.wahlen.effort === "string" ? a.wahlen.effort : null },
    start: { ...(a.agentMd ? { purpose: { titel: a.agentMd.titel, text: a.agentMd.text } } : {}),
      ...(roleId ? { role: roleId, direction: { text: null, personal: true as const } } : {}) },
    reads: refs, may: { rechte: a.wahlen.rechte ?? null, permissionMode: typeof a.wahlen.permissionMode === "string" ? a.wahlen.permissionMode : null },
    worksWith: {}, notebook };
  const roh: SetupDatei = { format: SETUP_FORMAT, name: a.name, setupHash: "",
    derivedFrom: null, derivedFromLine: [], seats: [seat], edges: [] as SetupEdge[], packs, concepts, roles };
  const datei = mitSetupHash(roh);
  // Die Herkunft kommt aus dem abgelegten Ursprung und dem Körper, der hier steht; der Export selbst schreibt nichts.
  const kette = ketteFuerExport(a, datei.setupHash);
  datei.derivedFrom = kette.derivedFrom;
  datei.derivedFromLine = kette.derivedFromLine;
  const texte = [...privateTexteAusWissen(k), ...privateTexteAusNotizen(notebook), ...privateKonzepte, ...(q.privateTexte ?? [])];
  const fund = persoenlicherTextInDatei(datei, texte);
  if (fund) return `die Datei enthielte persönlichen Text („${fund}…“) und geht so nicht hinaus`;
  return { datei, hinweise };
}

/** EINE GESPEICHERTE KONSTELLATION (die alte dateiFuer-Form) ALS SETUP. */
export function setupAusKonstellation(datei: Record<string, unknown>, form: Record<string, unknown>, hinweise: string[] = [],
  q: Pick<SetupQuellen, "dir" | "repoRoot"> = {}): SetupExport | string {
  const positionen = Array.isArray(datei.positionen) ? datei.positionen.map(rec).filter((x): x is Record<string, unknown> => !!x) : [];
  if (!positionen.length) return "die gespeicherte Konstellation hat keine lesbaren Positionen";
  const packs: SetupPack[] = [], concepts: SetupConcept[] = [], roles: SetupRole[] = [];
  const addPack = (p: SetupPack): SetupKnowledgeRef => {
    let id = p.id;
    if (packs.some((x) => x.id === id && x.hash !== p.hash)) id = `${p.id}@${(p.hash ?? "personal").slice(0, 8)}`;
    const da = packs.find((x) => x.id === id);
    if (da) return { kind: "pack", id, hash: da.hash };
    const block = { ...p, id };
    packs.push(block);
    return { kind: "pack", id, hash: block.hash };
  };
  const addConcept = (c: SetupConcept): SetupKnowledgeRef => {
    let id = c.id;
    if (concepts.some((x) => x.id === id && x.hash !== c.hash)) id = `${c.id}@${(c.hash ?? "personal").slice(0, 8)}`;
    const da = concepts.find((x) => x.id === id);
    if (da) return { kind: "concept", id, hash: da.hash };
    const block = { ...c, id };
    concepts.push(block);
    return { kind: "concept", id, hash: block.hash };
  };
  const seats: SetupSeat[] = [], edges: SetupEdge[] = [];
  for (const p of positionen) {
    const id = typeof p.id === "string" ? p.id : null;
    if (!id) return "eine Position hat keine lesbare Kennung";
    const name = typeof p.name === "string" ? p.name : id;
    const profil = rec(p.profil) ?? {};
    const abw = rec(p.abweichend) ?? {};
    const sitz = rec(p.sitz) ?? {};
    const darf = rec(sitz.darf) ?? {};
    const md = agentMdText(profil.datei);
    const own = agentMdText(p.eigeneDatei);
    const refs: SetupKnowledgeRef[] = [];
    const liest = Array.isArray(sitz.liest) ? sitz.liest.map(rec).filter((x): x is Record<string, unknown> => !!x) : [];
    // Ein Konzept reist als Konzeptblock, nicht zusätzlich als Pack aus der Kopie, die der Sitz unter `liest` liest:
    // sonst stünde sein Text nach einem zweiten Import zweimal im Start.
    const konzeptIds = new Set((Array.isArray(sitz.konzepte) ? sitz.konzepte : []).flatMap((x) => {
      const id = rec(x)?.id;
      return typeof id === "string" ? [id] : [];
    }));
    for (const x of liest) {
      const pid = typeof x.id === "string" ? x.id : null;
      const text = typeof x.text === "string" ? x.text : null;
      if (!pid || text === null || konzeptIds.has(pid)) continue;
      const quellen = Array.isArray(x.quellen) ? x.quellen.map(rec).filter((y): y is Record<string, unknown> => !!y)
        .map((y) => ({ path: typeof y.pfad === "string" ? y.pfad : "", anchor: typeof y.anker === "string" ? y.anker : "" })) : [];
      refs.push(addPack({ kind: "pack", id: pid, hash: hashText(text), text,
        useWhen: typeof x.wofuer === "string" ? x.wofuer : null, sources: quellen,
        ...(typeof x.author === "string" ? { author: x.author } : {}),
        ...(x.weg === "start" || x.weg === "skill" ? { way: x.weg } : {}) }));
    }
    const persoenlich = Array.isArray(sitz.persoenlich) ? sitz.persoenlich.map(rec).filter((x): x is Record<string, unknown> => !!x) : [];
    for (const x of persoenlich) {
      const pid = typeof x.id === "string" ? x.id : null;
      if (!pid) continue;
      const quellen = Array.isArray(x.quellen) ? x.quellen.map(rec).filter((y): y is Record<string, unknown> => !!y)
        .map((y) => ({ path: typeof y.pfad === "string" ? y.pfad : "", anchor: typeof y.anker === "string" ? y.anker : "" })) : [];
      refs.push(addPack({ kind: "pack", id: pid, hash: null, text: null, personal: true,
        useWhen: typeof x.wofuer === "string" ? x.wofuer : null, sources: quellen,
        ...(typeof x.author === "string" ? { author: x.author } : {}),
        ...(x.weg === "start" || x.weg === "skill" ? { way: x.weg } : {}) }));
    }
    const konzepte = Array.isArray(sitz.konzepte) ? sitz.konzepte.map(rec).filter((x): x is Record<string, unknown> => !!x) : [];
    for (const x of konzepte) {
      const cid = typeof x.id === "string" ? x.id : null;
      if (!cid) continue;
      const personal = x.personal === true, text = typeof x.text === "string" ? x.text : null;
      if (!personal && text === null) continue;
      refs.push(addConcept({ kind: "concept", id: cid, version: typeof x.version === "number" ? x.version : null,
        hash: personal ? null : hashText(text as string), text: personal ? null : text,
        ...(personal ? { personal: true as const } : {}),
        ...(typeof x.author === "string" ? { author: x.author } : {}),
        ...(typeof x.purpose === "string" ? { purpose: x.purpose } : {}) }));
    }
    // EIN ROLLENSITZ TRÄGT SEINEN ROLLENSTEIN: Starttext, Rechtebundel und die Packs, die die Rolle liest. Die Richtung
    // bleibt ihr eigener leerer Platz und steht nicht im Rollenstein.
    const roleId = typeof sitz.rolle === "string" && sitz.rolle
      ? sitz.rolle : typeof profil.rolle === "string" && profil.rolle !== "nur-ordner" ? profil.rolle : null;
    let role: SetupRole | null = null;
    if (roleId) {
      const stein = roleStein(roleId, q.dir, q.repoRoot ?? FLEET_ROOT);
      if (!stein) hinweise.push(`${name}: die Rolle „${roleId}“ ist hier nicht lesbar und reist ohne Rollenstein`);
      else {
        const roleRefs = stein.packs.map((p) => addPack(p));
        role = { ...stein.role, packs: roleRefs };
        for (const ref of roleRefs) if (!refs.some((x) => x.kind === ref.kind && x.id === ref.id && x.hash === ref.hash)) refs.push(ref);
        const schon = roles.find((r) => r.id === role!.id);
        if (!schon) roles.push(role);
        else role = schon;
      }
    }
    const nb = rec(sitz.notizbuch);
    let notebook: SetupNotebook | null = null;
    if (nb) {
      const notizen = Array.isArray(nb.notizen) ? nb.notizen.map(rec).filter((x): x is Record<string, unknown> => !!x) : [];
      const notes: SetupNote[] = notizen.flatMap((x): SetupNote[] => typeof x.datei === "string" && typeof x.text === "string"
        ? [{ id: x.datei, hash: hashText(x.text), text: x.text }] : []);
      const daheim = Array.isArray(sitz.persoenlicheNotizen) ? sitz.persoenlicheNotizen.filter((x): x is string => typeof x === "string") : [];
      for (const id of daheim) if (!notes.some((n) => n.id === id)) notes.push({ id, hash: null, text: null, personal: true });
      notebook = { index: typeof nb.index === "string" ? nb.index : "", notes,
        home: Number.isSafeInteger(nb.daheim) && Number(nb.daheim) >= 0 ? Number(nb.daheim) : daheim.length };
    }
    const wert = (k: "agent" | "modell" | "effort"): string | null => {
      const v = abw[k] ?? profil[k];
      return typeof v === "string" ? v : null;
    };
    const seat: SetupSeat = { id, name,
      who: { harness: wert("agent"), model: wert("modell"), effort: wert("effort") },
      start: { ...(md ? { purpose: { titel: md.titel, text: md.text } } : {}),
        ...(role ? { role: role.id, direction: { text: null, personal: true as const } } : {}),
        ...(own ? { ownFile: { titel: own.titel, text: own.text } } : {}) },
      reads: refs,
      may: { rechte: darf.rechte ?? p.rechte ?? null, permissionMode: typeof darf.modus === "string" ? darf.modus : null,
        ...(profil.schiene !== undefined || profil.werte !== undefined ? { plan: { schiene: profil.schiene, werte: profil.werte ?? {},
          schalter: profil.schalter ?? {}, autonomie: profil.autonomie ?? null, einV: profil.einV ?? 1, rechteV: profil.rechteV ?? 1 } } : {}) },
      worksWith: typeof p.meldetAn === "string" ? { reportsTo: p.meldetAn } : {}, notebook };
    seats.push(seat);
    if (typeof p.meldetAn === "string") edges.push({ from: id, to: p.meldetAn, kind: "reports-to" });
  }
  const roh: SetupDatei = { format: SETUP_FORMAT,
    name: typeof form.name === "string" ? form.name : typeof datei.name === "string" ? datei.name : "Imported",
    setupHash: "", derivedFrom: null, derivedFromLine: [],
    seats, edges, packs, concepts, roles, ...(form.aufgabe ?? datei.aufgabe ? { task: form.aufgabe ?? datei.aufgabe } : {}),
    ...(Array.isArray(datei.laeufe) ? { runs: datei.laeufe } : {}) };
  const fertig = mitSetupHash(roh);
  // die Herkunft: der in der gespeicherten Konstellation abgelegte Ursprung, nicht ihr letzter Fassungs-Hash
  const herkunft: Herkunft = typeof form.setupHash === "string" && HEX64.test(form.setupHash)
    ? herkunftAusDatei({ setupHash: form.setupHash, derivedFrom: typeof form.abgeleitetVon === "string" ? form.abgeleitetVon : null,
      derivedFromLine: Array.isArray(form.derivedFromLine) ? form.derivedFromLine.filter((x): x is string => typeof x === "string") : [] })
    : typeof form.abgeleitetVon === "string" && HEX64.test(form.abgeleitetVon) ? { setupHash: form.abgeleitetVon } : {};
  const kette = ketteFuerExport(herkunft, fertig.setupHash);
  fertig.derivedFrom = kette.derivedFrom;
  fertig.derivedFromLine = kette.derivedFromLine;
  return { datei: fertig, hinweise };
}

/** ALTE DATEIEN: fleet-agent/1 und fleet: "konstellation" werden durch dieselbe Tür gelesen. */
export async function setupAusDatei(raw: unknown, q: SetupQuellen = {}): Promise<{ datei: SetupDatei; hinweise: string[]; legacy: boolean } | string> {
  const r = rec(raw);
  if (!r) return "expected a JSON object";
  if (r.format === SETUP_FORMAT) {
    const d = pruefeSetupDatei(r);
    return typeof d === "string" ? d : { datei: d, hinweise: [], legacy: false };
  }
  if (r.format === AGENT_FORMAT) {
    const a = agentAusDatei(r, {}, () => null, []);
    if (typeof a === "string") return a;
    const d = await setupAusAgent(a.agent, q);
    return typeof d === "string" ? d : { datei: d.datei, hinweise: ["alte Agent-Datei fleet-agent/1 als Ein-Sitz-Setup gelesen", ...d.hinweise], legacy: true };
  }
  if (r.fleet === "konstellation") {
    const d = setupAusKonstellation(r, r, ["alte Konstellationsdatei fleet: \"konstellation\" als Setup gelesen"], q);
    return typeof d === "string" ? d : { datei: d.datei, hinweise: d.hinweise, legacy: true };
  }
  return `expected ${SETUP_FORMAT}, ${AGENT_FORMAT} or a fleet: "konstellation" file`;
}

// ---- import: preview, then write -----------------------------------------------------------------
export interface SetupVorschau {
  format: typeof SETUP_FORMAT; name: string; seats: number;
  packs: { id: string; hash: string | null; source: "local" | "carried" | "collision" | "personal" }[];
  concepts: { id: string; hash: string | null; source: "local" | "carried" | "collision" | "personal" }[];
  personalPlaces: string[]; emptyPlaces: string[];
  collisions: { kind: "pack" | "concept"; id: string; neu: string }[];
  /** die Rechte, die der Import erbittet: die des Sitzes und je Rolle ihr Bundel */
  requestedRights: unknown[];
  requestedRoles: { id: string; name: string; rights: RechtId[] }[];
  hinweise: string[];
}
export interface Loesung { datei: SetupDatei; vorschau: SetupVorschau; zuSpeichern: SetupShelf }
export interface SetupImportAntwort { status: number; body: Record<string, unknown> }

const alsShelfPack = (p: SeatPack): SetupPack => alsPack(p);

async function lokalePacks(dir: string, q: SetupQuellen): Promise<SetupPack[]> {
  const shelf = liesShelf(dir).packs;
  let k: SeatKnowledge | null = null;
  try { k = await (q.bibliothek?.() ?? null); } catch { /* shelf remains */ }
  const ausWissen = k ? k.packs.filter((p) => p.text !== null).map(alsShelfPack) : [];
  return [...shelf, ...ausWissen];
}

/** Der Importtisch: gleicher Hash = lokale Kopie; neuer Id = mitgereister Text; gleicher Id, anderer Hash = id@hash8. */
export async function loeseBausteine(d: SetupDatei, q: SetupQuellen, dir: string): Promise<Loesung | string> {
  const lokal = await lokalePacks(dir, q);
  const shelf = liesShelf(dir);
  const neuPacks: SetupPack[] = [], neuConcepts: SetupConcept[] = [];
  const map = new Map<string, string>();
  const vorschau: SetupVorschau = { format: SETUP_FORMAT, name: d.name, seats: d.seats.length, packs: [], concepts: [], personalPlaces: [], emptyPlaces: [],
    collisions: [], requestedRights: [...d.seats.flatMap((s) => s.may.rechte ? [s.may.rechte] : []), ...d.roles.map((r) => r.rights)],
    requestedRoles: d.roles.map((r) => ({ id: r.id, name: r.name, rights: [...r.rights] })), hinweise: [] };
  const packKey = (id: string, hash: string | null): string => `pack|${id}|${hash ?? "personal"}`;
  const frei = (basis: string, vorhanden: ReadonlySet<string>): string => {
    if (!vorhanden.has(basis)) return basis;
    for (let n = 2; n < 100; n++) if (!vorhanden.has(`${basis}-${n}`)) return `${basis}-${n}`;
    return `${basis}-${Date.now()}`;
  };
  const idsPack = new Set([...lokal.map((p) => p.id), ...neuPacks.map((p) => p.id)]);
  for (const p of d.packs) {
    const k = packKey(p.id, p.hash);
    if (p.personal) {
      vorschau.personalPlaces.push(`pack:${p.id}`);
      const eigen = lokal.find((x) => x.id === p.id && x.personal === true && x.text !== null);
      if (!eigen) vorschau.emptyPlaces.push(`pack:${p.id}`);
      map.set(k, p.id);
      vorschau.packs.push({ id: p.id, hash: null, source: "personal" });
      continue;
    }
    const gleich = lokal.find((x) => x.id === p.id && x.hash === p.hash);
    if (gleich) {
      map.set(k, gleich.id);
      vorschau.packs.push({ id: gleich.id, hash: gleich.hash, source: "local" });
      continue;
    }
    const anders = lokal.find((x) => x.id === p.id && x.hash !== p.hash);
    if (anders) {
      const id = frei(`${p.id}@${(p.hash ?? "personal").slice(0, 8)}`, idsPack);
      idsPack.add(id);
      const block = { ...p, id };
      neuPacks.push(block);
      map.set(k, id);
      vorschau.collisions.push({ kind: "pack", id: p.id, neu: id });
      vorschau.packs.push({ id, hash: block.hash, source: "collision" });
      continue;
    }
    const block = { ...p };
    neuPacks.push(block);
    idsPack.add(block.id);
    map.set(k, block.id);
    vorschau.packs.push({ id: block.id, hash: block.hash, source: "carried" });
  }
  const lokalKonzepte: SetupConcept[] = [...shelf.concepts];
  for (const c of d.concepts) {
    const ausLedger = await (q.konzept?.(c.id) ?? null);
    const da = lokalKonzepte.find((x) => x.id === c.id)
      ?? (ausLedger ? { kind: "concept" as const, id: ausLedger.id, version: ausLedger.version,
        hash: ausLedger.personal ? null : ausLedger.hash, text: ausLedger.personal ? null : ausLedger.text,
        ...(ausLedger.personal ? { personal: true as const } : {}),
        ...(ausLedger.author ? { author: ausLedger.author } : {}), ...(ausLedger.purpose ? { purpose: ausLedger.purpose } : {}),
        ...(ausLedger.validity ? { validity: ausLedger.validity } : {}) } : null);
    const k = `concept|${c.id}|${c.hash ?? "personal"}`;
    if (c.personal) {
      vorschau.personalPlaces.push(`concept:${c.id}`);
      if (!da || da.personal !== true || da.text === null) vorschau.emptyPlaces.push(`concept:${c.id}`);
      map.set(k, c.id);
      vorschau.concepts.push({ id: c.id, hash: null, source: "personal" });
      continue;
    }
    if (da && da.hash === c.hash) {
      map.set(k, da.id);
      vorschau.concepts.push({ id: da.id, hash: da.hash, source: "local" });
      continue;
    }
    if (da && da.id === c.id && da.hash !== c.hash) {
      const id = frei(`${c.id}@${(c.hash ?? "personal").slice(0, 8)}`, new Set([...lokalKonzepte.map((x) => x.id), ...neuConcepts.map((x) => x.id)]));
      const block = { ...c, id };
      neuConcepts.push(block);
      map.set(k, id);
      vorschau.collisions.push({ kind: "concept", id: c.id, neu: id });
      vorschau.concepts.push({ id, hash: block.hash, source: "collision" });
      continue;
    }
    const block = { ...c };
    neuConcepts.push(block);
    map.set(k, block.id);
    vorschau.concepts.push({ id: block.id, hash: block.hash, source: "carried" });
  }
  const um = (refs: readonly SetupKnowledgeRef[]): SetupKnowledgeRef[] => refs.map((ref) => {
    const id = map.get(`${ref.kind}|${ref.id}|${ref.hash ?? "personal"}`);
    if (!id) return ref;
    const block = ref.kind === "pack" ? [...d.packs, ...neuPacks].find((x) => x.id === id) : [...d.concepts, ...neuConcepts].find((x) => x.id === id);
    return { kind: ref.kind, id, hash: block?.hash ?? null };
  });
  const seats = d.seats.map((s) => ({ ...s, reads: um(s.reads) }));
  // DIE LEEREN PERSÖNLICHEN PLÄTZE BLEIBEN IN DER DATEI, die der Import weitergibt: sie werden nicht gespeichert (nur der
  // mitgereiste Text landet im Regal), aber sitzAusSetup braucht den Block, um den Platz am Sitz leer anzulegen.
  const persoenlichePacks = d.packs.filter((p) => p.personal === true);
  const persoenlicheKonzepte = d.concepts.filter((c) => c.personal === true);
  const datei: SetupDatei = { ...d, seats, packs: [...persoenlichePacks, ...neuPacks,
    ...lokal.filter((p) => vorschau.packs.some((v) => v.source === "local" && v.id === p.id))],
    concepts: [...persoenlicheKonzepte, ...neuConcepts, ...lokalKonzepte.filter((c) => vorschau.concepts.some((v) => v.source === "local" && v.id === c.id))] };
  return { datei, vorschau, zuSpeichern: { version: 1, packs: neuPacks, concepts: neuConcepts, roles: d.roles } };
}

async function k15Lesen(dir: string): Promise<Record<string, unknown>> {
  try {
    const r = rec(JSON.parse(readFileSync(join(dir, SPEICHER_DATEI), "utf8")));
    return r ?? { fassungen: [], packs: [], profile: [], konstellationen: [] };
  } catch { return { fassungen: [], packs: [], profile: [], konstellationen: [] }; }
}
function schreibeAtomar(ziel: string, text: string): void {
  mkdirSync(join(ziel, ".."), { recursive: true, mode: 0o700 });
  const tmp = `${ziel}.${process.pid}.tmp`;
  writeFileSync(tmp, text, { mode: 0o600 });
  renameSync(tmp, ziel);
}

async function schreibeEinSitz(d: SetupDatei, original: SetupDatei, dir: string, hinweise: string[]): Promise<Record<string, unknown>> {
  const seat = d.seats[0]!;
  // EINE ROLLE REIST ALS BLOCK IN EINER KONSTELLATION, NIE ALS DER EINGEBAUTE ROLLENNAME EINES EIN-SITZ-AGENTEN.
  // importiereSetup schickt einen Rollensitz ohnehin durch schreibeMehrSitz; dieser Riegel hält den Weg auch für einen
  // künftigen Aufrufer zu (die Starttür liest eine Rolle nur als Block, sitz.darf.rolle).
  if (seat.start.role) throw new Error("a seat with a role travels as a constellation with its role block, never as a one-seat agent");
  const packIds = seat.reads.filter((r) => r.kind === "pack").map((r) => r.id);
  const conceptIds = seat.reads.filter((r) => r.kind === "concept").map((r) => r.id);
  const recht = rechteAus(seat.may.rechte);
  const deckel = recht ? rechteGedeckelt(recht) : null;
  if (deckel?.gedeckelt.length) hinweise.push(`die Rechte aus der Datei über „bauen“ (${deckel.gedeckelt.join(", ")}) kommen gedeckelt an`);
  const wahlen: Wahlen = {
    ...(seat.who.harness ? { harness: seat.who.harness } : {}), ...(seat.who.model ? { model: seat.who.model } : {}),
    ...(seat.who.effort ? { effort: seat.who.effort } : {}), ...(seat.may.permissionMode ? { permissionMode: seat.may.permissionMode } : {}),
    ...(deckel ? { rechte: deckel.rechte } : {}),
    ...(packIds.length ? { bibliothek: packIds } : {}), ...(conceptIds.length ? { konzepte: conceptIds } : {}),
  };
  const eigene = liesAgenten(dir);
  const vergeben = ["repo", "orchestratorin", ...eigene.map((a) => a.id)];
  const herkunft = herkunftAusDatei(original);
  const a = eigenerAgent({ name: d.name, wahlen,
    ...(seat.start.purpose ? { agentMd: { titel: seat.start.purpose.titel, text: seat.start.purpose.text } } : {}) },
    () => null, vergeben, Date.now(), { ...herkunft, importiert: true });
  if (typeof a === "string") throw new Error(a);
  schreibAgenten(dir, [...eigene, a]);
  return { agent: eigeneAnsicht(a) };
}

function quelleAusText(titel: string, text: string): Quelle {
  const t = titel.trim() || "Purpose";
  return { titel: t, v: 1, pfad: "setup", abschnitte: [{ titel: "", text }] };
}
function sitzAusSetup(seat: SetupSeat, d: SetupDatei): Record<string, unknown> {
  const pack = (id: string) => d.packs.find((p) => p.id === id);
  const concept = (id: string) => d.concepts.find((c) => c.id === id);
  const role = seat.start.role ? d.roles.find((r) => r.id === seat.start.role) : null;
  const reads = [...seat.reads, ...(role?.packs ?? [])].filter((r, i, a) => a.findIndex((x) => x.kind === r.kind && x.id === r.id && x.hash === r.hash) === i);
  const liest = reads.filter((r) => r.kind === "pack").flatMap((r) => {
    const p = pack(r.id);
    const personal = !!p && (p.personal === true || istPersoenlich(p.id));
    return p && p.text !== null && !personal ? [{ id: p.id, weg: p.way ?? "start",
      quellen: p.sources.map((s) => ({ pfad: s.path, anker: s.anchor })), wofuer: p.useWhen, text: p.text,
      ...(p.author ? { author: p.author } : {}) }] : [];
  });
  const persoenlich = reads.filter((r) => r.kind === "pack").flatMap((r) => {
    const p = pack(r.id);
    const personal = !!p && (p.personal === true || istPersoenlich(p.id));
    return p && personal ? [{ id: p.id, weg: p.way ?? "start", quellen: p.sources.map((s) => ({ pfad: s.path, anker: s.anchor })),
      wofuer: p.useWhen, text: null, ...(p.author ? { author: p.author } : {}) }] : [];
  });
  // Konzepte laufen in dieser Runde als Text unter liest mit; ihr eigener Baustein steht im Regal.
  for (const r of reads.filter((x) => x.kind === "concept")) {
    const c = concept(r.id);
    if (c && c.text !== null && !c.personal) liest.push({ id: c.id, weg: "start", quellen: [], wofuer: c.purpose ?? null, text: c.text,
      ...(c.author ? { author: c.author } : {}) });
  }
  const nb = seat.notebook ? { index: seat.notebook.index,
    notizen: seat.notebook.notes.filter((n) => !n.personal && n.text !== null).map((n) => ({ datei: n.id, text: n.text as string })), daheim: seat.notebook.home } : null;
  const persoenlicheNotizen = seat.notebook?.notes.filter((n) => n.personal).map((n) => n.id) ?? [];
  const konzepte = reads.filter((r) => r.kind === "concept").flatMap((r) => {
    const c = concept(r.id);
    return c ? [{ id: c.id, version: c.version, hash: c.hash, text: c.text, ...(c.personal ? { personal: true as const } : {}),
      ...(c.author ? { author: c.author } : {}), ...(c.purpose ? { purpose: c.purpose } : {}) }] : [];
  });
  return { liest, persoenlich, darf: { rechte: seat.may.rechte ?? null, modus: seat.may.permissionMode ?? "auto",
      ...(role ? { rolle: [...role.rights] } : {}) }, notizbuch: nb,
    ...(role ? { rolle: role.id } : {}),
    ...(seat.start.direction || role ? { richtung: { text: null, personal: true as const } } : {}),
    ...(konzepte.length ? { konzepte } : {}), ...(persoenlicheNotizen.length ? { persoenlicheNotizen } : {}) };
}

const PLAN_ROLES: ReadonlySet<string> = new Set(["lane", "main", "orchestratorin", "nur-ordner"]);
async function schreibeMehrSitz(d: SetupDatei, original: SetupDatei, dir: string, jetzt: number): Promise<Record<string, unknown>> {
  const roleOf = (s: SetupSeat): SetupRole | null => s.start.role ? d.roles.find((r) => r.id === s.start.role) ?? null : null;
  // A ROLE STAYS A BLOCK: its start text and sitz.darf.rolle travel; the profile never takes the built-in Orchestratorin name,
  // because the start door maps `rolle` alone to Fleet's bypass track. Other plan roles (lane/main) keep their id only so a
  // re-export can find the same role block; the role's rights still come from sitz.darf.rolle after the owner's confirmation.
  const profilRolle = (role: SetupRole | null): Profil["rolle"] =>
    role && role.id !== "orchestratorin" && PLAN_ROLES.has(role.id) ? role.id as Profil["rolle"] : "nur-ordner";
  const profile = d.seats.map((s): Profil => {
    const role = roleOf(s);
    return { id: `setup-${s.id}`, name: s.name, glyph: "file", v: 1, kurz: "", satz: "", autor: "setup",
      rolle: profilRolle(role), schiene: "session",
      agent: s.who.harness ?? null, modell: s.who.model ?? null, effort: s.who.effort ?? null,
      schwelle: null, schalter: {}, nativ: null, einV: 1, rechteV: 1, werte: {}, autonomie: null,
      ...(role ? { datei: quelleAusText(role.name, role.start.text) }
        : s.start.purpose ? { datei: quelleAusText(s.start.purpose.titel, s.start.purpose.text) } : {}) };
  });
  const positionen = d.seats.map((s) => {
    const role = roleOf(s);
    const own = s.start.ownFile ?? (role && s.start.purpose ? s.start.purpose : null);
    return { id: s.id, name: s.name, profil: profile.find((p) => p.id === `setup-${s.id}`)!,
      ...(s.worksWith.reportsTo ? { meldetAn: s.worksWith.reportsTo } : {}), sitz: sitzAusSetup(s, d),
      ...(own ? { eigeneDatei: quelleAusText(own.titel, own.text) } : {}) };
  });
  const herkunft = herkunftAusDatei(original);
  const roh = { fleet: "konstellation", format: 1, name: d.name, version: 1, satz: "imported", autor: "setup", positionen,
    ...herkunft, ...(d.task !== undefined ? { aufgabe: d.task } : {}),
    ...(Array.isArray(d.runs) ? { laeufe: d.runs } : {}) };
  const imp = importKonst(JSON.stringify(roh), PROFILE0, jetzt);
  if (typeof imp === "string") throw new Error(imp);
  const k = imp.k as Konst & { setupHash?: string; derivedFromLine?: string[] };
  k.setupHash = herkunft.setupHash;
  k.abgeleitetVon = herkunft.abgeleitetVon;
  k.derivedFromLine = [...(herkunft.derivedFromLine ?? [])];
  const alt = await k15Lesen(dir);
  const altProfile = Array.isArray(alt.profile) ? alt.profile.map(rec).filter((x): x is Record<string, unknown> => !!x) : [];
  const neue = imp.neueProfile.filter((p) => !altProfile.some((x) => x.id === p.id));
  const alleProfile = [...PROFILE0, ...altProfile as unknown as Profil[], ...neue];
  const form = { id: k.id, ...exportObjekt({ ebene: "konst", voll: true, konst: [k], k, profile: alleProfile, q: null, p: alleProfile[0]! }),
    ...herkunft };
  const konstellationen = [...(Array.isArray(alt.konstellationen) ? alt.konstellationen : []), form]
    .filter((x, i, a) => a.findIndex((y) => rec(y)?.id === rec(x)?.id) === i);
  schreibeAtomar(join(dir, SPEICHER_DATEI), JSON.stringify({ ...alt, profile: [...altProfile, ...neue], konstellationen }));
  await merkeFassungen([form], dir, jetzt);
  return { konstellation: { id: k.id, name: d.name, seats: d.seats.length } };
}

/** EIN IMPORT: erst die Vorschau (kein Schreiben), dann `schreiben: true`. */
export async function importiereSetup(raw: unknown, q: SetupQuellen & { dir: string }, opts: { schreiben?: boolean; jetzt?: number } = {}): Promise<SetupImportAntwort> {
  const gel = await setupAusDatei(raw, q);
  if (typeof gel === "string") return { status: 400, body: { error: gel } };
  const loes = await loeseBausteine(gel.datei, q, q.dir);
  if (typeof loes === "string") return { status: 400, body: { error: loes } };
  const vorschau = { ...loes.vorschau, hinweise: [...gel.hinweise, ...loes.vorschau.hinweise] };
  if (!opts.schreiben) return { status: 200, body: { geschrieben: false, vorschau } };
  const shelf = liesShelf(q.dir);
  schreibShelf(q.dir, { version: 1, packs: [...shelf.packs.filter((p) => !loes.zuSpeichern.packs.some((n) => n.id === p.id)), ...loes.zuSpeichern.packs],
    concepts: [...shelf.concepts.filter((c) => !loes.zuSpeichern.concepts.some((n) => n.id === c.id)), ...loes.zuSpeichern.concepts],
    roles: [...(shelf.roles ?? []).filter((r) => !loes.zuSpeichern.roles?.some((n) => n.id === r.id)), ...(loes.zuSpeichern.roles ?? [])] });
  const hinweise = [...vorschau.hinweise];
  try {
    // A role seat travels as a seat of a constellation, even when it is the only seat: the owner confirms its rights at
    // POST /api/k15/freigabe on that position, and an imported role never starts in bypass.
    const mitRolle = loes.datei.seats.some((s) => !!s.start.role);
    const geschrieben = loes.datei.seats.length === 1 && !mitRolle
      ? await schreibeEinSitz(loes.datei, gel.datei, q.dir, hinweise)
      : await schreibeMehrSitz(loes.datei, gel.datei, q.dir, opts.jetzt ?? Date.now());
    return { status: 201, body: { geschrieben: true, vorschau: { ...vorschau, hinweise }, ...geschrieben } };
  } catch (e) { return { status: 500, body: { error: e instanceof Error ? e.message : String(e) } }; }
}

// ---- doors ---------------------------------------------------------------------------------------
export interface SetupServer extends SetupQuellen {
  dir: string;
  /** die alte dateiFuer-Form einer gespeicherten Konstellation, mit ihren Sitz-Blöcken */
  konstellationDatei: (id: string, repo: string | null) => Promise<{ datei: Record<string, unknown>; hinweise: string[] } | string>;
  konstellation: (id: string) => Promise<Record<string, unknown> | null>;
  agenten: () => Promise<readonly AgentAnsicht[]>;
}
const antwort = (body: unknown, status = 200): Response => Response.json(body, { status });

export async function setupRoute(req: Request, url: URL, q: SetupServer): Promise<Response> {
  const rest = url.pathname.slice(SETUP_ROUTE.length).split("/").filter(Boolean).map(decodeURIComponent);
  if (rest.length === 2 && rest[1] === "datei" && req.method === "GET") {
    const id = rest[0]!;
    const agent = (await q.agenten()).find((a) => a.id === id && a.art === "eigen");
    if (agent) {
      const d = await setupAusAgent(agent, q);
      return typeof d === "string" ? antwort({ error: d }, 409) : antwort(d);
    }
    const form = await q.konstellation(id);
    if (!form) return antwort({ error: `no own agent and no saved constellation „${id}“` }, 404);
    const alte = await q.konstellationDatei(id, url.searchParams.get("repo"));
    if (typeof alte === "string") return antwort({ error: alte }, 409);
    const d = setupAusKonstellation(alte.datei, form, alte.hinweise, q);
    return typeof d === "string" ? antwort({ error: d }, 409) : antwort(d);
  }
  if (rest.length === 1 && rest[0] === "import" && req.method === "POST") {
    const body = rec(await req.json().catch(() => null));
    if (!body || !("datei" in body)) return antwort({ error: "expected { datei, schreiben? }" }, 400);
    const r = await importiereSetup(body.datei, q, { schreiben: body.schreiben === true });
    return antwort(r.body, r.status);
  }
  return antwort({ error: "not found" }, 404);
}

