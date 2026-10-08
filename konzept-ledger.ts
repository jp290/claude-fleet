// THE KONZEPT LEDGER (Program Konzeptgedaechtnis 31aa88ea, Karte 1 von 3; Entwurf
// docs/messungen/2026-09-26-s4-entwurf-konzept-versionen-anmerkungen.md). Two append-only records per
// konzept under a PRIVATE root the owner names (FLEET_KONZEPT_ROOT): `versionen.jsonl`, one line per
// published fassung, and `anmerkungen.jsonl`, one line per remark or status change. The fassung itself
// is `<root>/<konzept>/v<N>.md`, placed there by its writer; this module only checks it and records it.
//
// NO THIRD PROVENANCE VOCABULARY. `actor` is the server/auth.ts#Principal the request resolved to,
// `kontext` a trace-index.ts#TraceRefs built from the credential and its binding, `detailRef` a
// trace-index.ts#TraceDetailRef — imported, never restated. The caller hands both in; a body that names
// `actor` or `kontext` is refused, because a writer that could state its own provenance would make the
// whole record a claim (Entwurf §Schema, Regel 1).
//
// STATUS IS FOLDED, NOT WRITTEN TWICE. An Anmerkung is `offen` until a later event says otherwise: a
// version whose `arbeitetEin` names it (→ `{eingearbeitet: N}`) or a `verworfen` line in
// anmerkungen.jsonl. The newest event wins. A version therefore needs ONE append, never a second write
// into the other file that a crash between the two could tear.
import { createHash, randomBytes } from "node:crypto";
import { appendFile, readFile, readdir, stat } from "node:fs/promises";
import type { Principal } from "./server/auth";
import type { TraceDetailRef, TraceRefs } from "./trace-index";

export const KONZEPT_ID_RE = /^k-[a-z0-9-]{1,64}$/;
export const ANMERKUNG_ID_RE = /^[0-9a-f]{16}$/;
// the closed list of the owner's direction b04fd193 (note d7edfbea, 2026-09-28): ONE entry model with the
// level as a field. `team` is announced for the model only and deliberately absent here.
export const KONZEPT_EBENEN = ["arbeit", "strang", "projekt", "portfolio", "owner"] as const;
export type KonzeptEbene = typeof KONZEPT_EBENEN[number];
export const KONZEPT_EBENE_DEFAULT: KonzeptEbene = "projekt";
export const KONZEPT_MAX = { anlass: 500, geltung: 200, text: 4000, grund: 500, abschnitt: 200,
  arbeitetEin: 100, neu: 50, candidate: 100, source: 200, locator: 500 } as const;
export const KONZEPT_ROOT_ENV = "FLEET_KONZEPT_ROOT";

export type KonzeptZugriff = "fleet" | { program: string };
export interface KonzeptVersion {
  konzept: string; version: number; vorgaenger: number | null; sha256: string; at: number;
  actor: Principal; kontext: TraceRefs; anlass: string; detailRef?: TraceDetailRef;
  arbeitetEin: string[]; quellen: { korpus?: string; neu: string[] };
  ebene: KonzeptEbene; geltung: string; zugriff?: KonzeptZugriff;
}
export type AnmerkungStatus = "offen" | { eingearbeitet: number } | { verworfen: string; actor: Principal };
export interface KonzeptAnmerkung {
  id: string; konzept: string; version: number; anker?: { abschnitt: string; satzSha?: string };
  text: string; at: number; actor: Principal; kontext: TraceRefs; detailRef?: TraceDetailRef;
  status: AnmerkungStatus;
}
// the two line kinds of anmerkungen.jsonl; `art` tells them apart
type AnmerkungLine = Omit<KonzeptAnmerkung, "status"> & { art: "anmerkung" };
type VerworfenLine = { art: "verworfen"; anmerkung: string; konzept: string; grund: string; at: number;
  actor: Principal; kontext: TraceRefs };

// who is writing, resolved by the CALLER from the request — never from a body
export interface KonzeptWriter { actor: Principal; kontext: TraceRefs; programs?: readonly string[] }
export interface KonzeptAnswer { status: number; body: Record<string, unknown> }

// ONE WRITER AT A TIME PER KONZEPT: read-last-N, check and append run inside one link of this chain, so
// two concurrent POSTs can neither hand out the same N nor interleave a line. Per konzept, not global —
// two konzepte never wait on each other. The chain survives a rejected link (`.catch`).
const chains = new Map<string, Promise<unknown>>();
function serial<T>(konzept: string, run: () => Promise<T>): Promise<T> {
  const prior = chains.get(konzept) ?? Promise.resolve();
  const next = prior.catch(() => undefined).then(run);
  const tail = next.catch(() => undefined);
  chains.set(konzept, tail);
  void tail.then(() => { if (chains.get(konzept) === tail) chains.delete(konzept); });
  return next;
}

const refuse = (status: number, error: string): KonzeptAnswer => ({ status, body: { error } });
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const HEX64 = /^[0-9a-f]{64}$/;

// a string field: `optional` lets absence through as undefined, anything present must be a 1..max string
function str(body: Record<string, unknown>, field: string, max: number, optional = false): string | undefined | KonzeptAnswer {
  const v = body[field];
  if (v === undefined && optional) return undefined;
  if (typeof v !== "string") return refuse(400, `${field} must be a string of 1–${max} chars`);
  const t = v.trim();
  if (!t || t.length > max) return refuse(400, `${field} must be a string of 1–${max} chars (got ${t.length})`);
  return t;
}
const isAnswer = (v: unknown): v is KonzeptAnswer => isObj(v) && typeof v.status === "number" && isObj(v.body);

// the one refusal both writes share, named first: provenance is the server's, a body cannot carry it
function closedBody(body: Record<string, unknown> | null, allowed: readonly string[]): KonzeptAnswer | null {
  if (!body) return refuse(400, "the body must be a JSON object (content-type: application/json)");
  const forged = ["actor", "kontext"].filter((k) => k in body);
  if (forged.length)
    return refuse(400, `${forged.join(" and ")} ${forged.length > 1 ? "are" : "is"} set by the server from your credential and its binding — a body cannot name ${forged.length > 1 ? "them" : "it"}`);
  const extra = Object.keys(body).filter((k) => !allowed.includes(k));
  if (extra.length) return refuse(400, `this door reads only ${allowed.join(", ")} — [${extra.join(", ")}] is not read`);
  return null;
}

function detailRefOf(body: Record<string, unknown>): TraceDetailRef | undefined | KonzeptAnswer {
  const d = body.detailRef;
  if (d === undefined) return undefined;
  if (!isObj(d) || Object.keys(d).some((k) => !["source", "locator", "fp"].includes(k)))
    return refuse(400, "detailRef must be {source, locator, fp?} (trace-index.ts#TraceDetailRef)");
  const source = str(d, "source", KONZEPT_MAX.source);
  if (isAnswer(source)) return refuse(400, `detailRef.${String(source.body.error)}`);
  const locator = str(d, "locator", KONZEPT_MAX.locator);
  if (isAnswer(locator)) return refuse(400, `detailRef.${String(locator.body.error)}`);
  if (d.fp !== undefined && (typeof d.fp !== "string" || !/^[0-9a-f]{16}$/.test(d.fp)))
    return refuse(400, "detailRef.fp must be the first 16 hex of the line's sha256");
  return { source: source!, locator: locator!, ...(typeof d.fp === "string" ? { fp: d.fp } : {}) };
}

interface Ledgers { versionen: KonzeptVersion[]; anmerkungen: AnmerkungLine[]; verworfen: VerworfenLine[]; malformed: number }
function jsonlRows(raw: string): { rows: unknown[]; malformed: number } {
  const rows: unknown[] = [];
  let malformed = 0;
  for (const l of raw.split("\n")) {
    if (!l.trim()) continue;
    try { rows.push(JSON.parse(l)); } catch { malformed++; }
  }
  return { rows, malformed };
}
async function lines(path: string): Promise<{ rows: unknown[]; malformed: number }> {
  let raw: string;
  try { raw = await readFile(path, "utf8"); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return { rows: [], malformed: 0 }; throw e; }
  return jsonlRows(raw);
}
const isVersionRow = (r: unknown, konzept: string): boolean =>
  isObj(r) && r.konzept === konzept && Number.isInteger(r.version) && (r.version as number) >= 1;
async function readLedgers(dir: string, konzept: string): Promise<Ledgers> {
  const v = await lines(`${dir}/versionen.jsonl`);
  const a = await lines(`${dir}/anmerkungen.jsonl`);
  const out: Ledgers = { versionen: [], anmerkungen: [], verworfen: [], malformed: v.malformed + a.malformed };
  // a line that does not name THIS konzept, or lacks the key the fold reads, counts as malformed —
  // never silently dropped, never trusted
  for (const r of v.rows)
    if (isVersionRow(r, konzept)) out.versionen.push(r as unknown as KonzeptVersion);
    else out.malformed++;
  for (const r of a.rows)
    if (isObj(r) && r.konzept === konzept && r.art === "anmerkung" && typeof r.id === "string")
      out.anmerkungen.push(r as unknown as AnmerkungLine);
    else if (isObj(r) && r.konzept === konzept && r.art === "verworfen" && typeof r.anmerkung === "string")
      out.verworfen.push(r as unknown as VerworfenLine);
    else out.malformed++;
  return out;
}
const lastVersion = (l: Ledgers): number => l.versionen.reduce((m, v) => Math.max(m, v.version), 0);

// THE CURRENT FASSUNG from the raw bytes of versionen.jsonl — the same row rule and the same "highest
// N wins" as the ledger above, for a reader that holds the bytes already (the brief's private-pack
// resolver, context-plan.ts#resolvePrivatePack). `sha256` is the row's claim, not a hash of the file.
export function currentKonzeptVersion(raw: string, konzept: string): { version: number; sha256: string | null } | null {
  let best: Record<string, unknown> | null = null;
  for (const r of jsonlRows(raw).rows)
    if (isVersionRow(r, konzept) && (!best || (r as { version: number }).version > (best.version as number)))
      best = r as Record<string, unknown>;
  if (!best) return null;
  return { version: best.version as number, sha256: typeof best.sha256 === "string" && HEX64.test(best.sha256) ? best.sha256 : null };
}

// newest event wins; the two files share no order, so at the SAME millisecond a verwerfen outranks a
// version (read second) — the explicit act over the implied one
function folded(l: Ledgers): KonzeptAnmerkung[] {
  return l.anmerkungen.map(({ art: _art, ...a }) => {
    let status: AnmerkungStatus = "offen";
    let at = -Infinity;
    for (const v of l.versionen)
      if (Array.isArray(v.arbeitetEin) && v.arbeitetEin.includes(a.id) && v.at >= at) { status = { eingearbeitet: v.version }; at = v.at; }
    for (const w of l.verworfen)
      if (w.anmerkung === a.id && w.at >= at) { status = { verworfen: w.grund, actor: w.actor }; at = w.at; }
    return { ...a, status };
  });
}

// THE OWNER'S CORRECTIONS (Program 31aa88ea, Karte 1 von 3; Entwurf
// docs/messungen/2026-10-02-owner-korrekturen-regal-entwurf.md §Empfehlung). ONE konzept whose fassungen
// only the owner publishes — `ebene: owner` names where an entry comes from, this id names who may make it
// current. Every other konzept keeps the write rules above unchanged.
//
// THE FORMAT LIVES IN THE FASSUNG, not in the body: v<N>.md carries exactly one fenced block
// ```owner-korrekturen with a JSON heft {eintraege: [{id, aussage, quelle, geltung, ersetzt}],
// zurueckgezogen?: [{id, grund}]}. The route already reads those bytes for the hash, so the checked
// entries are the hashed ones — a body could only ever restate them. Each fassung is the WHOLE heft,
// history included: an entry once published stays byte-equal in every later fassung (a change gets a new
// id), and replacing or withdrawing it is a new entry's `ersetzt` or a `zurueckgezogen` row of the same
// publication — ONE append, nothing rewritten (Entwurf §Ablösung in einem Veröffentlichungsakt).
export const OWNER_KORREKTUREN = "k-owner-korrekturen";
export const EINTRAG_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
// who an entry is for, axis by axis: "*" is ALL on purpose, a list names its members, and an empty list
// is refused — it would apply nowhere, and "nothing said" must never read as "everywhere"
export const GELTUNG_ACHSEN = ["projekte", "rollen", "harnesses", "modi"] as const;
export type KorrekturGeltung = Record<typeof GELTUNG_ACHSEN[number], "*" | string[]>;
export interface KorrekturEintrag { id: string; aussage: string; quelle: string | TraceDetailRef;
  geltung: KorrekturGeltung; ersetzt: string[] }
export interface KorrekturHeft { eintraege: KorrekturEintrag[]; zurueckgezogen: { id: string; grund: string }[] }
export type GefalteterEintrag = KorrekturEintrag & ({ status: "gilt" } | { status: "veraltet"; abgeloestDurch: string }
  | { status: "verworfen"; grund: string });
const HEFT_MAX = { eintraege: 500, ersetzt: 50, achse: 32, wert: 64 } as const;
const HEFT_FENCE = /^```owner-korrekturen[ \t]*\n([\s\S]*?)^```[ \t]*$/gm;

function geltungOf(v: unknown, at: string): KorrekturGeltung | string {
  if (!isObj(v) || Object.keys(v).length !== GELTUNG_ACHSEN.length || GELTUNG_ACHSEN.some((k) => !(k in v)))
    return `${at}.geltung must be {${GELTUNG_ACHSEN.join(", ")}}, each "*" or a list`;
  const out = {} as KorrekturGeltung;
  for (const k of GELTUNG_ACHSEN) {
    const a = v[k];
    if (a === "*") { out[k] = "*"; continue; }
    if (!Array.isArray(a) || !a.length || a.length > HEFT_MAX.achse
      || a.some((x) => typeof x !== "string" || !x.trim() || x.length > HEFT_MAX.wert || x.trim() === "*"))
      return `${at}.geltung.${k} must be "*" or a list of 1–${HEFT_MAX.achse} names (1–${HEFT_MAX.wert} chars) — an empty list applies nowhere`;
    out[k] = [...new Set((a as string[]).map((x) => x.trim()))].sort();
  }
  return out;
}

// the heft of one fassung's bytes, or the reason it is none — closed keys at every level
export function parseKorrekturHeft(text: string): KorrekturHeft | string {
  const blocks = [...text.matchAll(HEFT_FENCE)];
  if (blocks.length !== 1) return `the fassung must carry exactly one \`\`\`owner-korrekturen block (found ${blocks.length})`;
  let raw: unknown;
  try { raw = JSON.parse(blocks[0]![1]!); } catch { return "the ```owner-korrekturen block is not JSON"; }
  if (!isObj(raw) || Object.keys(raw).some((k) => k !== "eintraege" && k !== "zurueckgezogen"))
    return "the heft must be {eintraege, zurueckgezogen?}";
  if (!Array.isArray(raw.eintraege) || raw.eintraege.length > HEFT_MAX.eintraege)
    return `eintraege must be a list of at most ${HEFT_MAX.eintraege} entries`;
  const eintraege: KorrekturEintrag[] = [];
  for (const [n, e] of raw.eintraege.entries()) {
    const at = `eintraege[${n}]`;
    if (!isObj(e) || Object.keys(e).sort().join() !== "aussage,ersetzt,geltung,id,quelle")
      return `${at} must be exactly {id, aussage, quelle, geltung, ersetzt}`;
    if (typeof e.id !== "string" || !EINTRAG_ID_RE.test(e.id)) return `${at}.id must match ${EINTRAG_ID_RE.source}`;
    const aussage = str(e, "aussage", KONZEPT_MAX.text);
    if (isAnswer(aussage)) return `${at}.${String(aussage.body.error)}`;
    let quelle: string | TraceDetailRef;
    if (isObj(e.quelle)) {
      const d = detailRefOf({ detailRef: e.quelle });
      if (isAnswer(d)) return `${at}.quelle: ${String(d.body.error)}`;
      quelle = d!;
    } else {
      const q = str(e, "quelle", KONZEPT_MAX.locator);
      if (isAnswer(q)) return `${at}.${String(q.body.error)} or a detailRef`;
      quelle = q!;
    }
    const geltung = geltungOf(e.geltung, at);
    if (typeof geltung === "string") return geltung;
    if (!Array.isArray(e.ersetzt) || e.ersetzt.length > HEFT_MAX.ersetzt
      || e.ersetzt.some((x) => typeof x !== "string" || !EINTRAG_ID_RE.test(x)))
      return `${at}.ersetzt must be a list of at most ${HEFT_MAX.ersetzt} entry ids (empty when it replaces none)`;
    eintraege.push({ id: e.id, aussage: aussage!, quelle, geltung, ersetzt: [...new Set(e.ersetzt as string[])] });
  }
  const zr = raw.zurueckgezogen ?? [];
  if (!Array.isArray(zr) || zr.length > HEFT_MAX.eintraege) return "zurueckgezogen must be a list of {id, grund}";
  const zurueckgezogen: KorrekturHeft["zurueckgezogen"] = [];
  for (const [n, z] of zr.entries()) {
    if (!isObj(z) || Object.keys(z).sort().join() !== "grund,id" || typeof z.id !== "string" || !EINTRAG_ID_RE.test(z.id))
      return `zurueckgezogen[${n}] must be {id, grund} with an entry id`;
    const grund = str(z, "grund", KONZEPT_MAX.grund);
    if (isAnswer(grund)) return `zurueckgezogen[${n}].${String(grund.body.error)}`;
    zurueckgezogen.push({ id: z.id, grund: grund! });
  }
  return { eintraege, zurueckgezogen };
}

// the graph rules of ONE publication, against the fassung it follows (null for the first). Each refusal
// is named by its own sentence, in this order — a test reads the first one that applies.
export function checkKorrekturHeft(heft: KorrekturHeft, prior: KorrekturHeft | null): string | null {
  const byId = new Map<string, KorrekturEintrag>();
  for (const e of heft.eintraege) {
    if (byId.has(e.id)) return `entry id ${e.id} appears twice — an id names one entry for good`;
    byId.set(e.id, e);
  }
  const withdrawn = new Map<string, string>();
  for (const z of heft.zurueckgezogen) {
    if (!byId.has(z.id)) return `zurueckgezogen names unknown entry ${z.id}`;
    if (withdrawn.has(z.id)) return `entry ${z.id} is withdrawn twice`;
    withdrawn.set(z.id, z.grund);
  }
  const successor = new Map<string, string>();
  for (const e of heft.eintraege)
    for (const old of e.ersetzt) {
      if (old === e.id) return `entry ${e.id} ersetzt itself`;
      const target = byId.get(old);
      if (!target) return `entry ${e.id} ersetzt unknown entry ${old} — the fassung carries the whole heft, the replaced entry included`;
      if (successor.has(old)) return `entry ${old} has two successors: ${successor.get(old)} and ${e.id}`;
      if (withdrawn.has(old)) return `entry ${old} is withdrawn and replaced by ${e.id} at once — one end per entry`;
      if (JSON.stringify(target.geltung) !== JSON.stringify(e.geltung))
        return `entry ${e.id} ersetzt ${old} with a different geltung — in this cut only an identical geltung replaces an entry; split it into entries first`;
      successor.set(old, e.id);
    }
  for (const start of successor.keys()) {
    const path = [start];
    for (let at = successor.get(start); at !== undefined; at = successor.get(at)) {
      path.push(at);
      if (at === start) return `ersetzt forms a cycle: ${path.join(" → ")}`;
      if (path.length > byId.size + 1) break;
    }
  }
  if (prior) {
    for (const p of prior.eintraege)
      if (JSON.stringify(byId.get(p.id)) !== JSON.stringify(p))
        return `entry ${p.id} of the previous fassung is missing or changed — a published entry stays as it was, a change is a new id that ersetzt it`;
    for (const z of prior.zurueckgezogen)
      if (withdrawn.get(z.id) !== z.grund) return `the withdrawal of ${z.id} in the previous fassung is missing or changed`;
  }
  return null;
}

// the fold the reader serves: gilt, veraltet with abgeloestDurch, or verworfen with its grund — from ONE
// fassung's heft, nothing written twice
export function foldKorrekturHeft(heft: KorrekturHeft): GefalteterEintrag[] {
  const successor = new Map<string, string>();
  for (const e of heft.eintraege) for (const old of e.ersetzt) successor.set(old, e.id);
  const withdrawn = new Map(heft.zurueckgezogen.map((z) => [z.id, z.grund]));
  return heft.eintraege.map((e) => successor.has(e.id) ? { ...e, status: "veraltet" as const, abgeloestDurch: successor.get(e.id)! }
    : withdrawn.has(e.id) ? { ...e, status: "verworfen" as const, grund: withdrawn.get(e.id)! }
    : { ...e, status: "gilt" as const });
}

// THE READ VIEW (Karte 2 von 3, Entwurf §Dieselbe Lesetür für Claude, Codex und pi-zai): the entries of the
// LAST fassung that apply to ONE reader, whose three coordinates the server derives from the session's
// current binding — never from the request. `projekt` is the opaque projectKey of the bound repository,
// `rolle` the server's positionRole (lane · program-main · orchestrator), `harness` the slot's adapter id.
// A list axis holds when it names the reader's value, "*" holds for everyone; `modi` is NOT filtered — no
// binding names a working mode — and each served entry carries its geltung, so the reader sees that axis.
export interface KorrekturLeser { projekt: string; rolle: string; harness: string }
const gilt = (achse: "*" | string[], wert: string): boolean => achse === "*" || achse.includes(wert);
export const geltungTrifft = (g: KorrekturGeltung, l: KorrekturLeser): boolean =>
  gilt(g.projekte, l.projekt) && gilt(g.rollen, l.rolle) && gilt(g.harnesses, l.harness);

// Every way this view can fail is a NAMED refusal with no entry list in it: an unreadable heft must never
// look like an empty one (Entwurf: „nie als leeres Korrektur-Regal"). Only a 200 carries geltendeEintraege,
// and a 200 with [] means the current owner fassung has no gilt entry for THIS binding — nothing else.
// The private `quelle` of an entry is never served; neither is any entry outside the reader's geltung.
export async function konzeptLeseansicht(root: string | null, konzept: string, leser: KorrekturLeser): Promise<KonzeptAnswer> {
  if (!KONZEPT_ID_RE.test(konzept)) return refuse(400, `konzept id must match ${KONZEPT_ID_RE.source}`);
  if (konzept !== OWNER_KORREKTUREN)
    return refuse(404, `the leseansicht reads ${OWNER_KORREKTUREN} only — ${konzept} is read through /versionen and /anmerkungen`);
  const dir = await rootDir(root);
  if (isAnswer(dir)) return dir;
  const kdir = `${dir}/${konzept}`;
  try { if (!(await stat(kdir)).isDirectory()) throw new Error("not a directory"); }
  catch { return refuse(404, `${konzept} has no directory under the root — no owner fassung exists yet, which is not an empty heft`); }
  const l = await readLedgers(kdir, konzept);
  const n = lastVersion(l);
  const row = l.versionen.find((v) => v.version === n);
  if (!row) return refuse(404, `${konzept} has no published fassung yet — that is not an empty heft`);
  // the reader checks the owner actor itself: the write door's 403 is one guard, a ledger line is another
  // claim, and a newest row from anyone else is no current owner fassung — never fall back to an older one
  if (!isObj(row.actor) || row.actor.kind !== "owner")
    return refuse(409, `${konzept} v${n} was not published by the owner (actor ${isObj(row.actor) ? String(row.actor.kind) : "missing"}) — there is no current owner fassung to read`);
  let bytes: Buffer;
  try { bytes = await readFile(`${kdir}/v${n}.md`); }
  catch { return refuse(409, `${konzept}/v${n}.md is missing — the ledger names a fassung the root does not hold`); }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== row.sha256)
    return refuse(409, `hash drift: ${konzept}/v${n}.md hashes to ${sha256}, its ledger row names ${String(row.sha256)} — the file changed after the owner published it`);
  const heft = parseKorrekturHeft(bytes.toString("utf8"));
  if (typeof heft === "string") return refuse(409, `${konzept}/v${n}.md: ${heft}`);
  const mine = foldKorrekturHeft(heft).filter((e) => geltungTrifft(e.geltung, leser));
  const geltendeEintraege = mine.filter((e) => e.status === "gilt")
    .map(({ id, aussage, geltung, ersetzt }) => ({ id, aussage, geltung, ersetzt }));
  const status = {
    gilt: geltendeEintraege.length,
    veraltet: mine.flatMap((e) => e.status === "veraltet" ? [{ id: e.id, abgeloestDurch: e.abgeloestDurch }] : []),
    verworfen: mine.flatMap((e) => e.status === "verworfen" ? [{ id: e.id, grund: e.grund }] : []),
  };
  return { status: 200, body: { konzept, version: n, sha256, geltendeEintraege, status, bindung: leser, nichtGefiltert: ["modi"] } };
}

async function append(path: string, row: unknown): Promise<void> {
  await appendFile(path, `${JSON.stringify(row)}\n`, { mode: 0o600 });
}

// the root is read per request: a root that vanished answers 503 by NAME, never a write into nowhere
async function rootDir(root: string | null): Promise<string | KonzeptAnswer> {
  if (!root) return refuse(503, `${KONZEPT_ROOT_ENV} is not set — the konzept store has no root on this server`);
  try { if ((await stat(root)).isDirectory()) return root; } catch { /* named below */ }
  return refuse(503, `${KONZEPT_ROOT_ENV} does not name an existing directory — the konzept store is unavailable`);
}

// THE INDEX (Karte 2, the board's list): every konzept directory under the root with its LATEST version
// row and the fold's counts. Metadata only — the fassung v<N>.md is never read here, so the list cannot
// carry konzept content. A directory whose name is not a konzept id is skipped, never an error: the
// root is the owner's, and a stray folder in it is not a konzept.
export interface KonzeptIndexRow { konzept: string; letzte: KonzeptVersion | null; versionen: number;
  anmerkungen: { offen: number; eingearbeitet: number; verworfen: number }; malformed: number }
export async function konzeptIndex(root: string | null): Promise<KonzeptAnswer> {
  const dir = await rootDir(root);
  if (isAnswer(dir)) return dir;
  const names = (await readdir(dir, { withFileTypes: true }))
    .filter((e) => e.isDirectory() && KONZEPT_ID_RE.test(e.name)).map((e) => e.name).sort();
  const konzepte: KonzeptIndexRow[] = [];
  for (const konzept of names) {
    const l = await readLedgers(`${dir}/${konzept}`, konzept);
    const n = lastVersion(l);
    const counts = { offen: 0, eingearbeitet: 0, verworfen: 0 };
    for (const a of folded(l))
      counts[a.status === "offen" ? "offen" : "eingearbeitet" in a.status ? "eingearbeitet" : "verworfen"]++;
    konzepte.push({ konzept, letzte: l.versionen.find((v) => v.version === n) ?? null,
      versionen: l.versionen.length, anmerkungen: counts, malformed: l.malformed });
  }
  return { status: 200, body: { konzepte } };
}

export type KonzeptOp =
  | { op: "read-versionen" } | { op: "read-anmerkungen" } | { op: "read-leseansicht" }
  | { op: "write-version" } | { op: "write-anmerkung" } | { op: "verwerfen"; anmerkung: string };

// `/versionen`, `/anmerkungen`, `/anmerkungen/<id>/verwerfen` or (GET only) `/leseansicht` after the
// konzept id, with its method — null for anything else, so the caller answers its own 404
export function konzeptOpOf(method: string, rest: string): KonzeptOp | null {
  if (rest === "leseansicht") return method === "GET" ? { op: "read-leseansicht" } : null;
  if (rest === "versionen") return method === "GET" ? { op: "read-versionen" } : method === "POST" ? { op: "write-version" } : null;
  if (rest === "anmerkungen") return method === "GET" ? { op: "read-anmerkungen" } : method === "POST" ? { op: "write-anmerkung" } : null;
  const m = /^anmerkungen\/([^/]+)\/verwerfen$/.exec(rest);
  return m && method === "POST" ? { op: "verwerfen", anmerkung: m[1]! } : null;
}

function isZugriff(v: unknown): v is KonzeptZugriff {
  return v === "fleet" || (isObj(v) && Object.keys(v).length === 1
    && typeof v.program === "string" && /^[0-9a-f]{1,64}$/.test(v.program));
}

function konzeptZugriff(l: Ledgers, konzept: string): KonzeptZugriff | null | KonzeptAnswer {
  if (konzept === "k-claude-fleet" || konzept === OWNER_KORREKTUREN) return "fleet";
  const declared = l.versionen.filter((v) => v.zugriff !== undefined).map((v) => v.zugriff);
  if (declared.some((v) => !isZugriff(v))) return refuse(409, `konzept-scope-unknown: ${konzept} has an invalid access binding`);
  const keys = new Set(declared.map((v) => v === "fleet" ? "fleet" : v!.program));
  if (keys.size > 1) return refuse(409, `konzept-scope-unknown: ${konzept} has conflicting access bindings`);
  if (declared.length) return declared[0]!;
  const programs = [...new Set(l.versionen.flatMap((v) => v.kontext?.program ? [v.kontext.program] : []))];
  if (programs.length > 1) return refuse(409, `konzept-scope-unknown: ${konzept} has conflicting legacy Program traces`);
  return programs.length === 1 ? { program: programs[0]! } : null;
}

function konzeptAccess(l: Ledgers, konzept: string, writer: KonzeptWriter, create = false,
  requested?: KonzeptZugriff): KonzeptZugriff | null | KonzeptAnswer {
  const scope = konzeptZugriff(l, konzept);
  if (writer.actor.kind === "owner") {
    if (!create) return null;
    if (isAnswer(scope)) return scope;
    if (requested !== undefined && scope !== null && JSON.stringify(requested) !== JSON.stringify(scope))
      return refuse(409, `konzept-scope-fixed: ${konzept} already has an access binding — a new version cannot change it`);
    return scope ?? requested ?? null;
  }
  if (isAnswer(scope)) return scope;
  const programs = writer.programs ?? [];
  const bound = scope ?? (create && !l.versionen.length && programs.length === 1 ? { program: programs[0]! } : null);
  if (bound === null) return refuse(409, `konzept-scope-unknown: ${konzept} has no unambiguous Program or fleet access binding`);
  if (bound !== "fleet" && !programs.includes(bound.program))
    return refuse(403, `konzept-program-forbidden: ${konzept} belongs to another Program — this session is not bound to it`);
  return bound;
}

// THE ONE HANDLER both doors call. Order is part of the contract: the konzept id (400), the body (400),
// the root (503), then under the konzept's lock the state (404/409). A body is validated BEFORE the
// root is looked at, so a malformed request never learns whether a store exists.
export async function konzeptRequest(input: {
  root: string | null; konzept: string; op: KonzeptOp; body: Record<string, unknown> | null;
  writer: KonzeptWriter; now?: () => number;
}): Promise<KonzeptAnswer> {
  const { konzept, op, body, writer } = input;
  const now = input.now ?? Date.now;
  if (!KONZEPT_ID_RE.test(konzept)) return refuse(400, `konzept id must match ${KONZEPT_ID_RE.source}`);

  // the read view filters by a SESSION's binding (konzeptLeseansicht, called by the self door); this
  // handler holds no binding — the owner door reads the whole heft through /versionen
  if (op.op === "read-leseansicht")
    return refuse(409, `the leseansicht filters by a session's binding — the owner reads ${konzept} through /versionen and its fassung files`);

  if (op.op === "read-versionen" || op.op === "read-anmerkungen") {
    const root = await rootDir(input.root);
    if (isAnswer(root)) return root;
    const dir = `${root}/${konzept}`;
    try { if (!(await stat(dir)).isDirectory()) throw new Error("not a directory"); }
    catch { return refuse(404, `unknown konzept ${konzept} — no directory for it under the root`); }
    const l = await readLedgers(dir, konzept);
    const access = konzeptAccess(l, konzept, writer);
    if (isAnswer(access)) return access;
    return { status: 200, body: op.op === "read-versionen"
      ? { konzept, versionen: l.versionen, letzte: lastVersion(l) || null, malformed: l.malformed }
      : { konzept, anmerkungen: folded(l), malformed: l.malformed } };
  }

  if (op.op === "write-version") {
    // the owner's heft takes a fassung from the owner ALONE — named before the body is read, so a session
    // learns the door, never the shape of a fassung it may not publish (anmerkungen stay open to it)
    const owners = konzept === OWNER_KORREKTUREN;
    if (owners && writer.actor.kind !== "owner")
      return refuse(403, `${konzept} takes a fassung only from the owner (POST /api/konzepte/${konzept}/versionen) — a ${writer.actor.kind === "session" ? writer.actor.role : writer.actor.kind} proposes through an anmerkung or the clarification chain`);
    const closed = closedBody(body, ["sha256", "anlass", "detailRef", "arbeitetEin", "quellen", "ebene", "geltung", "erwartet", "zugriff"]);
    if (closed) return closed;
    const b = body!;
    if (b.zugriff !== undefined && writer.actor.kind !== "owner")
      return refuse(403, "konzept-scope-owner-only: only the owner may declare a Program or fleet access binding");
    if (b.zugriff !== undefined && !isZugriff(b.zugriff))
      return refuse(400, 'zugriff must be "fleet" or {program: <Program id>}');
    // optional compare-and-append: the version the writer read as latest (null = none yet). Absent, the
    // write behaves as before — N is simply last+1.
    if (b.erwartet !== undefined && b.erwartet !== null && (!Number.isInteger(b.erwartet) || (b.erwartet as number) < 1))
      return refuse(400, "erwartet must be the version you read as latest (integer ≥ 1), or null for none yet");
    if (typeof b.sha256 !== "string" || !HEX64.test(b.sha256))
      return refuse(400, "sha256 must be the 64 lowercase hex of v<N>.md");
    const anlass = str(b, "anlass", KONZEPT_MAX.anlass);
    if (isAnswer(anlass)) return anlass;
    const geltung = str(b, "geltung", KONZEPT_MAX.geltung);
    if (isAnswer(geltung)) return geltung;
    if (b.ebene !== undefined && !KONZEPT_EBENEN.includes(b.ebene as KonzeptEbene))
      return refuse(400, `ebene must be one of ${KONZEPT_EBENEN.join("|")} (absent = ${KONZEPT_EBENE_DEFAULT})`);
    if (owners && b.ebene !== undefined && b.ebene !== "owner")
      return refuse(400, `${konzept} is the owner's heft — its ebene is owner (absent = owner)`);
    const ebene = (b.ebene as KonzeptEbene | undefined) ?? (owners ? "owner" : KONZEPT_EBENE_DEFAULT);
    const detailRef = detailRefOf(b);
    if (isAnswer(detailRef)) return detailRef;
    const ein = b.arbeitetEin ?? [];
    if (!Array.isArray(ein) || ein.length > KONZEPT_MAX.arbeitetEin
      || ein.some((x) => typeof x !== "string" || !ANMERKUNG_ID_RE.test(x)))
      return refuse(400, `arbeitetEin must be an array of at most ${KONZEPT_MAX.arbeitetEin} anmerkung ids (16 hex)`);
    const q = b.quellen ?? { neu: [] };
    if (!isObj(q) || Object.keys(q).some((k) => k !== "korpus" && k !== "neu")
      || (q.korpus !== undefined && (typeof q.korpus !== "string" || !HEX64.test(q.korpus)))
      || !Array.isArray(q.neu ?? []) || ((q.neu ?? []) as unknown[]).length > KONZEPT_MAX.neu
      || ((q.neu ?? []) as unknown[]).some((x) => typeof x !== "string" || !x || x.length > KONZEPT_MAX.candidate))
      return refuse(400, `quellen must be {korpus?: <64 hex>, neu: [<candidate id ≤${KONZEPT_MAX.candidate}>, ≤${KONZEPT_MAX.neu}]}`);
    const quellen = { ...(typeof q.korpus === "string" ? { korpus: q.korpus } : {}), neu: [...((q.neu ?? []) as string[])] };
    const root = await rootDir(input.root);
    if (isAnswer(root)) return root;
    const dir = `${root}/${konzept}`;
    return serial(konzept, async () => {
      const l = await readLedgers(dir, konzept);
      const access = konzeptAccess(l, konzept, writer, true, b.zugriff as KonzeptZugriff | undefined);
      if (isAnswer(access)) return access;
      const last = lastVersion(l);
      // checked under the same lock that hands out N, so "nobody published since I read" holds at the append
      if (b.erwartet !== undefined && (last || null) !== b.erwartet)
        return refuse(409, `${konzept} is at ${last ? `version ${last}` : "no version yet"}, the body expects ${b.erwartet === null ? "none yet" : `version ${String(b.erwartet)}`} — re-read and decide again`);
      const n = last + 1;
      let bytes: Buffer;
      try { bytes = await readFile(`${dir}/v${n}.md`); }
      catch { return refuse(409, `${konzept}/v${n}.md does not exist — the next version is ${n}; place the file under the root first`); }
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      if (sha256 !== b.sha256)
        return refuse(409, `${konzept}/v${n}.md hashes to ${sha256}, the body names ${b.sha256} — the file changed or the wrong one was named`);
      let heft: KorrekturHeft | null = null;
      if (owners) {
        const parsed = parseKorrekturHeft(bytes.toString("utf8"));
        if (typeof parsed === "string") return refuse(409, `${konzept}/v${n}.md: ${parsed}`);
        let prior: KorrekturHeft | null = null;
        if (last) {
          // the fassung this one follows, as PUBLISHED: a file changed after its append is no basis
          const row = l.versionen.find((v) => v.version === last);
          let priorBytes: Buffer | null = null;
          try { priorBytes = await readFile(`${dir}/v${last}.md`); } catch { /* named below */ }
          if (!row || !priorBytes || createHash("sha256").update(priorBytes).digest("hex") !== row.sha256)
            return refuse(409, `${konzept}/v${last}.md is missing or no longer hashes to its ledger row — the previous fassung is no basis for v${n}`);
          const p = parseKorrekturHeft(priorBytes.toString("utf8"));
          if (typeof p === "string") return refuse(409, `${konzept}/v${last}.md: ${p}`);
          prior = p;
        }
        const graph = checkKorrekturHeft(parsed, prior);
        if (graph) return refuse(409, `${konzept}/v${n}.md: ${graph}`);
        heft = parsed;
      }
      const known = new Set(l.anmerkungen.map((a) => a.id));
      const unknown = [...new Set(ein as string[])].filter((id) => !known.has(id));
      if (unknown.length) return refuse(409, `arbeitetEin names anmerkungen ${konzept} does not have: ${unknown.join(", ")}`);
      const row: KonzeptVersion = { konzept, version: n, vorgaenger: last || null, sha256, at: now(),
        actor: writer.actor, kontext: writer.kontext, anlass: anlass!, ...(detailRef ? { detailRef } : {}),
        arbeitetEin: [...new Set(ein as string[])], quellen, ebene, geltung: geltung!, ...(access ? { zugriff: access } : {}) };
      await append(`${dir}/versionen.jsonl`, row);
      return { status: 200, body: { ok: true, version: row, ...(heft ? { eintraege: foldKorrekturHeft(heft) } : {}) } };
    });
  }

  if (op.op === "write-anmerkung") {
    const closed = closedBody(body, ["version", "anker", "text", "detailRef"]);
    if (closed) return closed;
    const b = body!;
    if (!Number.isInteger(b.version) || (b.version as number) < 1) return refuse(400, "version must be an integer ≥ 1");
    const text = str(b, "text", KONZEPT_MAX.text);
    if (isAnswer(text)) return text;
    let anker: KonzeptAnmerkung["anker"];
    if (b.anker !== undefined) {
      if (!isObj(b.anker) || Object.keys(b.anker).some((k) => k !== "abschnitt" && k !== "satzSha"))
        return refuse(400, "anker must be {abschnitt, satzSha?}");
      const abschnitt = str(b.anker, "abschnitt", KONZEPT_MAX.abschnitt);
      if (isAnswer(abschnitt)) return refuse(400, `anker.${String(abschnitt.body.error)}`);
      const satzSha = b.anker.satzSha;
      if (satzSha !== undefined && (typeof satzSha !== "string" || !HEX64.test(satzSha)))
        return refuse(400, "anker.satzSha must be 64 lowercase hex");
      anker = { abschnitt: abschnitt!, ...(typeof satzSha === "string" ? { satzSha } : {}) };
    }
    const detailRef = detailRefOf(b);
    if (isAnswer(detailRef)) return detailRef;
    const root = await rootDir(input.root);
    if (isAnswer(root)) return root;
    const dir = `${root}/${konzept}`;
    return serial(konzept, async () => {
      const l = await readLedgers(dir, konzept);
      const access = konzeptAccess(l, konzept, writer);
      if (isAnswer(access)) return access;
      if (!l.versionen.some((v) => v.version === b.version))
        return refuse(409, `${konzept} has no version ${String(b.version)} — an anmerkung hangs on a published version (latest: ${lastVersion(l) || "none"})`);
      const row: AnmerkungLine = { art: "anmerkung", id: randomBytes(8).toString("hex"), konzept,
        version: b.version as number, ...(anker ? { anker } : {}), text: text!, at: now(),
        actor: writer.actor, kontext: writer.kontext, ...(detailRef ? { detailRef } : {}) };
      await append(`${dir}/anmerkungen.jsonl`, row);
      const { art: _art, ...a } = row;
      return { status: 200, body: { ok: true, anmerkung: { ...a, status: "offen" } } };
    });
  }

  // verwerfen
  const closed = closedBody(body, ["grund"]);
  if (closed) return closed;
  if (!ANMERKUNG_ID_RE.test(op.anmerkung)) return refuse(400, `anmerkung id must match ${ANMERKUNG_ID_RE.source}`);
  const grund = str(body!, "grund", KONZEPT_MAX.grund);
  if (isAnswer(grund)) return grund;
  const root = await rootDir(input.root);
  if (isAnswer(root)) return root;
  const dir = `${root}/${konzept}`;
  return serial(konzept, async () => {
    const l = await readLedgers(dir, konzept);
    const access = konzeptAccess(l, konzept, writer);
    if (isAnswer(access)) return access;
    const current = folded(l).find((a) => a.id === op.anmerkung);
    if (!current) return refuse(404, `${konzept} has no anmerkung ${op.anmerkung}`);
    if (typeof current.status === "object" && "verworfen" in current.status)
      return refuse(409, `anmerkung ${op.anmerkung} is already verworfen`);
    const row: VerworfenLine = { art: "verworfen", anmerkung: op.anmerkung, konzept, grund: grund!, at: now(),
      actor: writer.actor, kontext: writer.kontext };
    await append(`${dir}/anmerkungen.jsonl`, row);
    return { status: 200, body: { ok: true, anmerkung: { ...current, status: { verworfen: grund!, actor: writer.actor } } } };
  });
}
