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
import { appendFile, readFile, stat } from "node:fs/promises";
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

export interface KonzeptVersion {
  konzept: string; version: number; vorgaenger: number | null; sha256: string; at: number;
  actor: Principal; kontext: TraceRefs; anlass: string; detailRef?: TraceDetailRef;
  arbeitetEin: string[]; quellen: { korpus?: string; neu: string[] };
  ebene: KonzeptEbene; geltung: string;
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
export interface KonzeptWriter { actor: Principal; kontext: TraceRefs }
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
async function lines(path: string): Promise<{ rows: unknown[]; malformed: number }> {
  let raw: string;
  try { raw = await readFile(path, "utf8"); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return { rows: [], malformed: 0 }; throw e; }
  const rows: unknown[] = [];
  let malformed = 0;
  for (const l of raw.split("\n")) {
    if (!l.trim()) continue;
    try { rows.push(JSON.parse(l)); } catch { malformed++; }
  }
  return { rows, malformed };
}
async function readLedgers(dir: string, konzept: string): Promise<Ledgers> {
  const v = await lines(`${dir}/versionen.jsonl`);
  const a = await lines(`${dir}/anmerkungen.jsonl`);
  const out: Ledgers = { versionen: [], anmerkungen: [], verworfen: [], malformed: v.malformed + a.malformed };
  // a line that does not name THIS konzept, or lacks the key the fold reads, counts as malformed —
  // never silently dropped, never trusted
  for (const r of v.rows)
    if (isObj(r) && r.konzept === konzept && Number.isInteger(r.version) && (r.version as number) >= 1)
      out.versionen.push(r as unknown as KonzeptVersion);
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

async function append(path: string, row: unknown): Promise<void> {
  await appendFile(path, `${JSON.stringify(row)}\n`, { mode: 0o600 });
}

// the root is read per request: a root that vanished answers 503 by NAME, never a write into nowhere
async function rootDir(root: string | null): Promise<string | KonzeptAnswer> {
  if (!root) return refuse(503, `${KONZEPT_ROOT_ENV} is not set — the konzept store has no root on this server`);
  try { if ((await stat(root)).isDirectory()) return root; } catch { /* named below */ }
  return refuse(503, `${KONZEPT_ROOT_ENV} does not name an existing directory — the konzept store is unavailable`);
}

export type KonzeptOp =
  | { op: "read-versionen" } | { op: "read-anmerkungen" }
  | { op: "write-version" } | { op: "write-anmerkung" } | { op: "verwerfen"; anmerkung: string };

// `/versionen`, `/anmerkungen` or `/anmerkungen/<id>/verwerfen` after the konzept id, with its method —
// null for anything else, so the caller answers its own 404
export function konzeptOpOf(method: string, rest: string): KonzeptOp | null {
  if (rest === "versionen") return method === "GET" ? { op: "read-versionen" } : method === "POST" ? { op: "write-version" } : null;
  if (rest === "anmerkungen") return method === "GET" ? { op: "read-anmerkungen" } : method === "POST" ? { op: "write-anmerkung" } : null;
  const m = /^anmerkungen\/([^/]+)\/verwerfen$/.exec(rest);
  return m && method === "POST" ? { op: "verwerfen", anmerkung: m[1]! } : null;
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

  if (op.op === "read-versionen" || op.op === "read-anmerkungen") {
    const root = await rootDir(input.root);
    if (isAnswer(root)) return root;
    const dir = `${root}/${konzept}`;
    try { if (!(await stat(dir)).isDirectory()) throw new Error("not a directory"); }
    catch { return refuse(404, `unknown konzept ${konzept} — no directory for it under the root`); }
    const l = await readLedgers(dir, konzept);
    return { status: 200, body: op.op === "read-versionen"
      ? { konzept, versionen: l.versionen, letzte: lastVersion(l) || null, malformed: l.malformed }
      : { konzept, anmerkungen: folded(l), malformed: l.malformed } };
  }

  if (op.op === "write-version") {
    const closed = closedBody(body, ["sha256", "anlass", "detailRef", "arbeitetEin", "quellen", "ebene", "geltung"]);
    if (closed) return closed;
    const b = body!;
    if (typeof b.sha256 !== "string" || !HEX64.test(b.sha256))
      return refuse(400, "sha256 must be the 64 lowercase hex of v<N>.md");
    const anlass = str(b, "anlass", KONZEPT_MAX.anlass);
    if (isAnswer(anlass)) return anlass;
    const geltung = str(b, "geltung", KONZEPT_MAX.geltung);
    if (isAnswer(geltung)) return geltung;
    if (b.ebene !== undefined && !KONZEPT_EBENEN.includes(b.ebene as KonzeptEbene))
      return refuse(400, `ebene must be one of ${KONZEPT_EBENEN.join("|")} (absent = ${KONZEPT_EBENE_DEFAULT})`);
    const ebene = (b.ebene as KonzeptEbene | undefined) ?? KONZEPT_EBENE_DEFAULT;
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
      const last = lastVersion(l);
      const n = last + 1;
      let bytes: Buffer;
      try { bytes = await readFile(`${dir}/v${n}.md`); }
      catch { return refuse(409, `${konzept}/v${n}.md does not exist — the next version is ${n}; place the file under the root first`); }
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      if (sha256 !== b.sha256)
        return refuse(409, `${konzept}/v${n}.md hashes to ${sha256}, the body names ${b.sha256} — the file changed or the wrong one was named`);
      const known = new Set(l.anmerkungen.map((a) => a.id));
      const unknown = [...new Set(ein as string[])].filter((id) => !known.has(id));
      if (unknown.length) return refuse(409, `arbeitetEin names anmerkungen ${konzept} does not have: ${unknown.join(", ")}`);
      const row: KonzeptVersion = { konzept, version: n, vorgaenger: last || null, sha256, at: now(),
        actor: writer.actor, kontext: writer.kontext, anlass: anlass!, ...(detailRef ? { detailRef } : {}),
        arbeitetEin: [...new Set(ein as string[])], quellen, ebene, geltung: geltung! };
      await append(`${dir}/versionen.jsonl`, row);
      return { status: 200, body: { ok: true, version: row } };
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
