// THE ONE DATA FUNCTION OF THE SESSION TIMELINE (Program ae1f4279, part (5) — the operating draft).
//
// Everything the timeline view in src/client.ts shows comes through `loadTimeline` and nothing
// else: it asks ONE route, `GET /api/timeline`, for a window of sessions, and turns the answer into
// the view model below. The wire is the route's own type, `TimelinePage` of trace-timeline.ts
// (contract: docs/trace-timeline-contract.md): session headers without events, one `entries` list
// that carries the native tool events and the ledger events side by side, a `nextCursor` bound to
// its window. When the route changes, the adaptation is this file and only this file: the view
// reads `TimelineModel` and never the wire.
//
// An answer that is not that page — another schema, a missing or mistyped field — becomes
// `state: "unavailable"` with one sentence naming the field, never an exception and never an empty
// timeline that reads as "nothing happened". What the lens shows WITH data is proven by
// e2e/timeline-ui.ts, which serves a synthetic `TimelinePage` behind the same URL from the fixtures
// in e2e/trace-native-fixtures.ts; nothing of that enters the production bundle (the check asserts
// the bundle carries neither the fixture module nor its canary).
//
// HONESTY RULES the model carries, so the view cannot lose them:
//   - `atKnown: false` when a native event has no record timestamp: it sits at its observation time
//     and says so (`clock` names the observer, not the source).
//   - `duration: null` always — no source proves a tool's runtime. `separationMs` is the record
//     distance between a call and its result, and is labelled as that.
//   - clock uncertainty is `"unknown"` for every host pair; equal x means equal record time, never
//     causality.
//   - gaps are kept per session with their byte ranges, and the page's fleet-wide gaps beside them;
//     a session without an indexed source is a track with its gaps, not a missing track.
//   - the page carries no detail texts: arguments and results stay `null` (not delivered) — the
//     detail door `GET /api/timeline/detail` is not read here.
import type { NativeEvent, NativeSnapshot } from "../trace-native";
import type { TraceEvent } from "../trace-index";
import type { TimelineEntry, TimelinePage, TimelineSession as TimelineWireSession } from "../trace-timeline";

// --- input: the query ------------------------------------------------------------------------------
export interface TimelineQuery {
  from: number;                 // ms, window start (inclusive)
  to: number;                   // ms, window end (inclusive)
  harness?: string;             // narrow to this harness name
  session?: string;             // narrow to this session id (a uuid, not a track key)
  page?: string | null;         // the `next` of a previous model; it carries its own window
}

// --- output: the view model ---------------------------------------------------------------------
export type TimelineKind = "tool.call" | "tool.result" | "report" | "clarification" | "founding"
  | "commit" | "land" | "gate" | "audit" | "deploy" | "other";
export type TimelineStatus = "ok" | "error" | "pending" | "late" | "unknown";
export interface TimelineGap { session: string | null; code: string; offset: number | null; bytes: number | null; text: string }
export interface TimelineSource {
  name: string; locator: string | null; fp: string | null;
  record: { id: string | null; parent: string | null; offset: number; bytes: number; block: number } | null;
  sidechain: boolean; edge: string | null;
  refs: Record<string, string | number>;
}
export interface TimelineEvent {
  id: string;
  session: string | null;       // session key; null = a fleet-wide ledger event no session claims
  kind: TimelineKind;
  family: "tool" | "ledger";
  label: string;                // "Edit", "Report", "Land" …
  sub: string;                  // "edit-1", "handoff", "a1b2c3d" …
  at: number;                   // ms on `clock`
  atKnown: boolean;             // false: `at` is the observation time, the record carried none
  clock: string;
  observedAt: number | null;
  status: TimelineStatus;
  verdict: string | null;       // a report's status, a land's result, an audit's result
  pair: string | null;          // the result of a call, the call of a result
  separationMs: number | null;  // record distance call→result, NOT runtime
  duration: null;               // no source proves a runtime
  args: string | null;          // delivered detail text, or null = not delivered (unknown)
  result: string | null;
  error: string | null;
  source: TimelineSource;
  files: string[];
}
export interface TimelineSession {
  key: string; label: string; harness: string; host: string; version: string;
  slot: number | null; openedAt: number | null; project: string | null; program: string | null;
  state: NativeSnapshot["state"] | "unmeasured";   // "unmeasured": no native source indexed for this session yet
  occupation: "unknown" | { slot: number; openedAt: number };
  parentSession: string | null;
  horizon: { state: "read" | "unmeasured"; oldestAt: number | null; newestAt: number | null; reason: string | null };
  counts: { calls: number; results: number; errors: number; pending: number; ledger: number };
  gaps: TimelineGap[];
}
export interface TimelineModel {
  state: "read" | "empty" | "unavailable";
  route: string; status: number | null; reason: string | null;   // reason: predicate of the route, without its name
  now: number;
  window: { from: number; to: number };
  span: { from: number | null; to: number | null };   // the data's own extent inside the window
  sessions: TimelineSession[];
  events: TimelineEvent[];      // every event, sorted by `at`
  gaps: TimelineGap[];          // every session's gaps plus the fleet-wide ones
  clock: { uncertainty: "unknown"; note: string };
  ledgerUnassigned: number;     // ledger events no session claimed
  next: string | null;
}

const ROUTE = "/api/timeline";
// the clock note is prose for the view's banner; the raw key (`uncertainty`) stays a field, so the
// view can print it once as an internal value and never as a sentence
const CLOCK_NOTE = "Hostuhren ungemessen — gleiche Position heißt gleiche Aufzeichnungszeit, keine Kausalität";
const GAP_TEXT: Record<string, string> = {
  "missing-result": "Aufruf ohne Resultat im Snapshot",
  "orphan-result": "Resultat ohne Aufruf",
  "ambiguous-result": "Resultat passt auf mehrere Aufrufe",
  "malformed-record": "Aufzeichnung nicht lesbar",
  "partial-record": "Aufzeichnung am Ende unvollständig",
  "missing-record-id": "Aufzeichnung ohne Id",
  "invalid-tool-metadata": "Tool-Metadaten ungültig",
  "unsupported-codex-item": "Codex-Eintrag nicht unterstützt",
  "source-rewritten": "Quelle wurde umgeschrieben",
  "source-generation-or-binding-changed": "Quelle oder Bindung gewechselt",
  "source-missing": "Quelldatei nicht gefunden",
  "source-indexing": "Quelle wird noch gelesen",
  "session-budget": "Quelle noch nicht im Index",
  "occupation-source-ambiguous": "Session hält mehrere Belegungen, Zuordnung offen",
  "additional-source-gaps": "weitere Lücken der Quelle",
};
const gapOf = (session: string | null, code: string, offset?: number, bytes?: number): TimelineGap =>
  ({ session, code, offset: offset ?? null, bytes: bytes ?? null, text: GAP_TEXT[code] ?? code });

const toolLabel = (e: NativeEvent): string => e.kind === "tool.call" ? e.tool.name : `${e.tool.name === "unknown" ? "" : e.tool.name + " "}Resultat`.trim();

function toolEvent(key: string | null, id: string, e: NativeEvent): TimelineEvent {
  const isCall = e.kind === "tool.call";
  const refs: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(e.refs)) if (typeof v === "string" || typeof v === "number") refs[k] = v;
  return {
    id, session: key, kind: isCall ? "tool.call" : "tool.result", family: "tool",
    label: toolLabel(e), sub: e.refs.call ?? "", at: e.at, atKnown: e.occurredAt !== null, clock: e.atClock,
    observedAt: e.observedAt, status: STATUSES.has(e.status) ? e.status : "unknown", verdict: null, pair: e.pair ?? null,
    separationMs: e.separation?.ms ?? null, duration: null,
    // the page carries no detail texts: what a call said is not delivered, which is not "said nothing"
    args: null, result: null,
    error: e.outcome === "error" ? "Fehler laut Quelle, Text nicht geliefert" : null,
    source: { name: e.source, locator: e.detailRef?.locator ?? null, fp: e.detailRef?.fp ?? null,
      record: e.record, sidechain: e.record.sidechain === true,
      edge: e.edge ? `${e.edge.from.session ?? e.edge.from.kind} → ${e.edge.to.session ?? e.edge.to.kind} · ${e.edge.channel}` : null, refs },
    files: e.files,
  };
}

// the ledger's open `<family>.<verb>[.<qualifier>]` set, read into the eight kinds the view tells apart
function ledgerKind(kind: string): { kind: TimelineKind; label: string; verdict: string | null } {
  const [fam = "", verb = "", ...rest] = kind.split(".");
  const qual = rest.join(".");
  if (fam === "report") return { kind: "report", label: "Report", verdict: qual || verb || null };
  if (/clarif|rueckfrage|question/.test(kind)) return { kind: "clarification", label: "Rückfrage", verdict: null };
  if (fam === "task" && /^(created|founded|founding|filed)$/.test(verb) || fam === "lane" && /^(founded|opened|spawned)$/.test(verb))
    return { kind: "founding", label: "Gründung", verdict: null };
  if (fam === "commit") return { kind: "commit", label: "Commit", verdict: null };
  if (fam === "land" && verb === "gate") return { kind: "gate", label: "Gate", verdict: qual || null };
  if (fam === "land") return { kind: "land", label: "Land", verdict: qual || (verb === "main" ? null : verb) || null };
  if (fam === "audit") return { kind: "audit", label: "Audit", verdict: verb || null };
  if (fam === "deploy" || verb === "deploy" || verb === "deployed") return { kind: "deploy", label: "Deploy", verdict: qual || null };
  if (fam === "lane") return { kind: verb === "landed" ? "land" : "other", label: `Lane ${verb}`, verdict: null };
  return { kind: "other", label: kind, verdict: null };
}

function ledgerEvent(id: string, e: TraceEvent, session: string | null): TimelineEvent {
  const k = ledgerKind(e.kind);
  const refs: Record<string, string | number> = {};
  for (const [key, v] of Object.entries(e.refs)) if (typeof v === "string" || typeof v === "number") refs[key] = v;
  const sub = e.refs.sha?.slice(0, 7) ?? k.verdict ?? e.refs.task?.slice(0, 8) ?? e.refs.branch ?? "";
  return {
    id, session, kind: k.kind, family: "ledger",
    label: k.label, sub, at: e.at, atKnown: true, clock: "fleet server wallclock", observedAt: null,
    status: k.kind === "report" || k.kind === "land" || k.kind === "gate" || k.kind === "audit"
      ? (/fail|red|rejected|error|refused/.test(k.verdict ?? "") ? "error" : /unknown|not-measured|waited/.test(k.verdict ?? "") ? "unknown" : "ok")
      : "ok",
    verdict: k.verdict, pair: null, separationMs: null, duration: null,
    args: null, result: null, error: null,
    source: { name: e.source, locator: e.detailRef?.locator ?? null, fp: e.detailRef?.fp ?? null, record: null, sidechain: false,
      edge: e.edge ? `${e.edge.from.kind}${e.edge.from.via ? ` (${e.edge.from.via})` : ""} → ${e.edge.to.kind} · ${e.edge.channel}` : null, refs },
    files: e.files,
  };
}

function unavailable(now: number, window: TimelineModel["window"], status: number | null, reason: string): TimelineModel {
  return { state: "unavailable", route: ROUTE, status, reason, now, window, span: { from: null, to: null }, sessions: [], events: [],
    gaps: [], clock: { uncertainty: "unknown", note: CLOCK_NOTE }, ledgerUnassigned: 0, next: null };
}

// --- reading the page: every field the model takes is checked before it is read ---------------------
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => v !== null && typeof v === "object" && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const STATUSES = new Set<string>(["ok", "error", "pending", "late", "unknown"]);
const SOURCE_STATES = new Set<string>(["read", "pending", "rejected", "unsupported", "unmeasured"]);
const isToolKind = (kind: unknown): boolean => kind === "tool.call" || kind === "tool.result";
// the first field of the page that is missing or has another form, as its path ("sessions[2].occupation"), or null
function malformed(p: Obj): string | null {
  if (!isObj(p.window) || !isNum(p.window.from) || !isNum(p.window.to)) return "window";
  if (!Array.isArray(p.sessions)) return "sessions";
  for (const [i, s] of p.sessions.entries()) {
    const at = `sessions[${i}]`;
    if (!isObj(s)) return at;
    for (const k of ["key", "session", "harness", "host"]) if (!isStr(s[k])) return `${at}.${k}`;
    if (!isObj(s.occupation) || !isNum(s.occupation.slot) || !isNum(s.occupation.openedAt)) return `${at}.occupation`;
    if (!isObj(s.source) || !isStr(s.source.state)) return `${at}.source`;
    const h = s.source.horizon;
    if (h !== null && h !== undefined && (!isObj(h) || !isStr(h.state))) return `${at}.source.horizon`;
    if (!Array.isArray(s.gaps) || s.gaps.some((g) => !isObj(g) || !isStr(g.code))) return `${at}.gaps`;
  }
  if (!Array.isArray(p.entries)) return "entries";
  for (const [i, e] of p.entries.entries()) {
    const at = `entries[${i}]`;
    if (!isObj(e) || !isStr(e.id) || !isNum(e.at)) return at;
    if (e.sessionKey !== null && !isStr(e.sessionKey)) return `${at}.sessionKey`;
    const v = e.event;
    if (v === null) continue;
    if (!isObj(v) || !isStr(v.source) || !isStr(v.kind) || !isNum(v.at) || !isObj(v.refs) || !Array.isArray(v.files)) return `${at}.event`;
    if (isToolKind(v.kind) && (!isObj(v.record) || !isNum(v.record.offset) || !isNum(v.record.bytes) || !isObj(v.tool)
      || !isStr(v.tool.name) || !isStr(v.status) || !isStr(v.outcome) || !isNum(v.observedAt) || !isStr(v.atClock))) return `${at}.event`;
  }
  if (p.nextCursor !== null && !isStr(p.nextCursor)) return "nextCursor";
  if (!Array.isArray(p.gaps) || p.gaps.some((g) => !isStr(g))) return "gaps";
  if (!Array.isArray(p.ledger) || p.ledger.some((l) => !isObj(l) || !Array.isArray(l.horizon))) return "ledger";
  return null;
}
// the route binds a cursor to the window that asked (409 cursor-stale otherwise), so the model's
// `next` carries that window with it and a later page asks the same window again
const nextOf = (cursor: string | null, window: { from: number; to: number }): string | null =>
  cursor === null ? null : JSON.stringify({ cursor, from: window.from, to: window.to });
function cursorOf(page: string): { cursor: string; from: number; to: number } | null {
  try { const c = JSON.parse(page) as unknown; return isObj(c) && isStr(c.cursor) && isNum(c.from) && isNum(c.to) ? { cursor: c.cursor, from: c.from, to: c.to } : null; }
  catch { return null; }
}

function modelOf(page: TimelinePage, status: number, continued: boolean): TimelineModel {
  const events: TimelineEvent[] = [];
  const sessions: TimelineSession[] = [];
  const gaps: TimelineGap[] = [];
  const own = new Map<string, TimelineEvent[]>();
  let ledgerUnassigned = 0;
  for (const entry of page.entries as TimelineEntry[]) {
    const e = entry.event;
    if (!e) continue;   // `session:<key>`: the session's own place in the order, its header carries it
    const ev = isToolKind(e.kind) ? toolEvent(entry.sessionKey, entry.id, e as NativeEvent) : ledgerEvent(entry.id, e, entry.sessionKey);
    if (entry.sessionKey) own.set(entry.sessionKey, [...own.get(entry.sessionKey) ?? [], ev]);
    else if (ev.family === "ledger") ledgerUnassigned++;
    events.push(ev);
  }
  for (const s of page.sessions as TimelineWireSession[]) {
    const mine = own.get(s.key) ?? [];
    const sessionGaps = s.gaps.map((g) => gapOf(s.key, g.code, g.offset, g.bytes));
    const h = s.source.horizon;
    sessions.push({
      key: s.key, label: s.session.slice(0, 8), harness: s.harness, host: s.host,
      version: s.source.version ?? "unbekannt", slot: s.occupation.slot, openedAt: s.occupation.openedAt,
      project: s.project, program: s.program,
      state: SOURCE_STATES.has(s.source.state) ? s.source.state as TimelineSession["state"] : "unmeasured",
      occupation: { slot: s.occupation.slot, openedAt: s.occupation.openedAt },
      parentSession: null,
      horizon: h?.state === "read" ? { state: "read", oldestAt: h.oldestAt, newestAt: h.newestAt ?? null, reason: null }
        : { state: "unmeasured", oldestAt: null, newestAt: null, reason: h?.state === "unmeasured" ? h.reason : "keine native Quelle im Index" },
      counts: { calls: mine.filter((e) => e.kind === "tool.call").length, results: mine.filter((e) => e.kind === "tool.result").length,
        errors: mine.filter((e) => e.status === "error").length, pending: mine.filter((e) => e.status === "pending").length,
        ledger: mine.filter((e) => e.family === "ledger").length },
      gaps: sessionGaps,
    });
    gaps.push(...sessionGaps);
  }
  // the page's own gaps are fleet-wide and the same on every page of a window: said once, on the first
  if (!continued) for (const code of page.gaps) gaps.push(gapOf(null, code));
  for (const l of page.ledger) for (const h of l.horizon)
    if (h.state === "unmeasured") gaps.push(gapOf(null, "ledger-unmeasured"));
  events.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const ats = events.map((e) => e.at);
  return {
    state: events.length || sessions.length ? "read" : "empty", route: ROUTE, status, reason: null, now: Date.now(),
    window: page.window,
    span: { from: ats.length ? Math.min(...ats) : null, to: ats.length ? Math.max(...ats) : null },
    sessions, events, gaps, clock: { uncertainty: "unknown", note: CLOCK_NOTE }, ledgerUnassigned,
    next: nextOf(page.nextCursor, page.window),
  };
}

/**
 * Load one window of the fleet's session timeline. Input: `TimelineQuery` (ms window, optional
 * harness/session narrowing, the `next` of a previous model). Output: `TimelineModel` — sessions,
 * events sorted by `at`, gaps, the data's span, and the route's own state when it could not answer.
 * `fetchFn` is injectable for a check; the view passes nothing.
 */
export async function loadTimeline(query: TimelineQuery, fetchFn: typeof fetch = fetch): Promise<TimelineModel> {
  const cursor = query.page ? cursorOf(query.page) : null;
  const window = cursor ? { from: cursor.from, to: cursor.to } : { from: Math.min(query.from, query.to), to: Math.max(query.from, query.to) };
  if (query.page && !cursor) return unavailable(Date.now(), window, null, "bekam einen Seitenzeiger, den diese Linse nicht ausgegeben hat");
  const params = new URLSearchParams({ from: String(window.from), to: String(window.to) });
  if (query.harness) params.set("harness", query.harness);
  if (query.session) params.set("session", query.session);
  if (cursor) params.set("cursor", cursor.cursor);
  let res: Response;
  try { res = await fetchFn(`${ROUTE}?${params}`); }
  // `reason` is a predicate of the route ("antwortet 404 (no such route)") — the view names the
  // route ONCE in front of it, so the sentence never carries it twice (UI-MAIN review point 7)
  catch (e) { return unavailable(Date.now(), window, null, `ist nicht erreichbar (${e instanceof Error ? e.message : String(e)})`); }
  if (!res.ok) {
    let reason = `antwortet ${res.status}`;
    try { const body = (await res.json()) as { error?: unknown }; if (typeof body?.error === "string") reason += ` (${body.error})`; }
    catch { reason += " (ohne lesbaren Fehlertext)"; }
    return unavailable(Date.now(), window, res.status, reason);
  }
  let body: unknown;
  try { body = await res.json(); }
  catch { return unavailable(Date.now(), window, res.status, `antwortet ${res.status}, aber kein JSON`); }
  if (!isObj(body) || body.schema !== "fleet.timeline/v1")
    return unavailable(Date.now(), window, res.status, `antwortet mit Schema ${JSON.stringify(isObj(body) ? body.schema ?? null : null)} statt fleet.timeline/v1`);
  const bad = malformed(body);
  if (bad) return unavailable(Date.now(), window, res.status, `antwortet ${res.status}, aber das Feld ${bad} fehlt oder hat nicht die Form von fleet.timeline/v1`);
  // the checks above cover every field the model reads; a form they missed still ends as a sentence, never a throw
  try { return modelOf(body as unknown as TimelinePage, res.status, !!cursor); }
  catch (e) { return unavailable(Date.now(), window, res.status, `antwortet ${res.status}, aber die Seite ist nicht lesbar (${e instanceof Error ? e.message : String(e)})`); }
}
