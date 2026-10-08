// THE ONE DATA FUNCTION OF THE SESSION TIMELINE (Program ae1f4279, part (5) — the operating draft).
//
// Everything the timeline view in src/client.ts shows comes through `loadTimeline` and nothing
// else: it asks ONE route, `GET /api/timeline`, for a window of sessions, and turns the answer into
// the view model below. The route is being built in parallel (lane 91040c44; its wire contract
// lands in docs/trace-timeline-contract.md), so the WIRE SHAPE this file expects — `TimelineWire` —
// is this draft's reading of the already-fixed event forms (NativeSnapshot / NativeEvent in
// trace-native.ts, TraceEvent in trace-index.ts) wrapped in a window. When the route's contract
// differs, the adaptation is this file and only this file: the view reads `TimelineModel` and never
// the wire.
//
// Until the route exists the live board gets `state: "unavailable"` with the route's answer named
// (status, reason) — never an empty timeline that reads as "nothing happened". What the draft shows
// WITH data is proven by e2e/timeline-ui.ts, which serves a synthetic wire body behind the same URL
// from the fixtures in e2e/trace-native-fixtures.ts; nothing of that enters the production bundle
// (the check asserts the bundle carries neither the fixture module nor its canary).
//
// HONESTY RULES the model carries, so the view cannot lose them:
//   - `atKnown: false` when a native event has no record timestamp: it sits at its observation time
//     and says so (`clock` names the observer, not the source).
//   - `duration: null` always — no source proves a tool's runtime. `separationMs` is the record
//     distance between a call and its result, and is labelled as that.
//   - clock uncertainty is `"unknown"` for every host pair; equal x means equal record time, never
//     causality.
//   - gaps are kept per session with their byte ranges; a pending call is a gap too
//     (`missing-result`), and a horizon that begins after the window says what lies before it is
//     UNMEASURED, not empty.
import type { NativeEvent, NativeSnapshot } from "../trace-native";
import type { SourceHorizon, TraceEvent } from "../trace-index";

// --- input: the query and the wire ----------------------------------------------------------------
export interface TimelineQuery {
  from: number;                 // ms, window start (inclusive)
  to: number;                   // ms, window end (inclusive)
  harness?: readonly string[];  // narrow to these harness names
  sessions?: readonly string[]; // narrow to these session keys
  page?: string | null;         // the `next` cursor of a previous answer
}
export interface TimelineWireDetail { locator: string; redacted: boolean; text: string }
export interface TimelineWireSession {
  key: string;                  // NativeSnapshot.identityKey — session + host + occupation, never the slot alone
  harness: string; host: string; label: string | null;
  slot: number | null; openedAt: number | null; project: string | null; program: string | null;
  snapshot: NativeSnapshot;     // fleet.trace-native/v1, this window's generation
  details?: TimelineWireDetail[]; // resolved, redacted detail texts by locator — optional, never raw bytes
}
export interface TimelineWire {
  schema: "fleet.timeline/v1";
  now: number;
  window: { from: number; to: number };
  sessions: TimelineWireSession[];
  ledger: TraceEvent[];         // the ledger projection's events inside the window (trace-index.ts)
  horizon: SourceHorizon[];     // per ledger source: how far back it reaches
  next: string | null;          // cursor for the next page, null when this is the last
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
  state: NativeSnapshot["state"];
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
  "pair-missing-in-snapshot": "Gegenstück nicht im Snapshot",
};
const gapOf = (session: string | null, code: string, offset?: number, bytes?: number): TimelineGap =>
  ({ session, code, offset: offset ?? null, bytes: bytes ?? null, text: GAP_TEXT[code] ?? code });

const toolLabel = (e: NativeEvent): string => e.kind === "tool.call" ? e.tool.name : `${e.tool.name === "unknown" ? "" : e.tool.name + " "}Resultat`.trim();

function toolEvent(s: TimelineWireSession, e: NativeEvent, details: Map<string, TimelineWireDetail>, byId: Map<string, NativeEvent>): TimelineEvent {
  const own = e.detailRef ? details.get(e.detailRef.locator) ?? null : null;
  const pair = e.pair ? byId.get(e.pair) ?? null : null;
  const pairText = pair?.detailRef ? details.get(pair.detailRef.locator)?.text ?? null : null;
  const isCall = e.kind === "tool.call";
  const refs: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(e.refs)) if (typeof v === "string" || typeof v === "number") refs[k] = v;
  return {
    id: e.id, session: s.key, kind: isCall ? "tool.call" : "tool.result", family: "tool",
    label: toolLabel(e), sub: e.refs.call ?? "", at: e.at, atKnown: e.occurredAt !== null, clock: e.atClock,
    observedAt: e.observedAt, status: e.status, verdict: null, pair: e.pair,
    separationMs: e.separation?.ms ?? null, duration: null,
    args: isCall ? own?.text ?? null : pairText,
    result: isCall ? pairText : own?.text ?? null,
    error: e.outcome === "error" ? (isCall ? pairText : own?.text) ?? "Fehler laut Quelle, Text nicht geliefert" : null,
    source: { name: e.source, locator: e.detailRef?.locator ?? null, fp: e.detailRef?.fp ?? null,
      record: e.record, sidechain: e.record.sidechain,
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

function ledgerEvent(e: TraceEvent, i: number, session: string | null): TimelineEvent {
  const k = ledgerKind(e.kind);
  const refs: Record<string, string | number> = {};
  for (const [key, v] of Object.entries(e.refs)) if (typeof v === "string" || typeof v === "number") refs[key] = v;
  const sub = e.refs.sha?.slice(0, 7) ?? k.verdict ?? e.refs.task?.slice(0, 8) ?? e.refs.branch ?? "";
  return {
    id: `ledger:${e.source}:${e.at}:${e.kind}:${i}`, session, kind: k.kind, family: "ledger",
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

/**
 * Load one window of the fleet's session timeline. Input: `TimelineQuery` (ms window, optional
 * harness/session narrowing, page cursor). Output: `TimelineModel` — sessions, events sorted by
 * `at`, gaps, the data's span, and the route's own state when it could not answer. `fetchFn` is
 * injectable for a check; the view passes nothing.
 */
export async function loadTimeline(query: TimelineQuery, fetchFn: typeof fetch = fetch): Promise<TimelineModel> {
  const window = { from: Math.min(query.from, query.to), to: Math.max(query.from, query.to) };
  const params = new URLSearchParams({ from: String(window.from), to: String(window.to) });
  for (const h of query.harness ?? []) params.append("harness", h);
  for (const s of query.sessions ?? []) params.append("session", s);
  if (query.page) params.set("page", query.page);
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
  let wire: TimelineWire;
  try { wire = (await res.json()) as TimelineWire; }
  catch { return unavailable(Date.now(), window, res.status, `antwortet ${res.status}, aber kein JSON`); }
  if (wire?.schema !== "fleet.timeline/v1" || !Array.isArray(wire.sessions))
    return unavailable(Date.now(), window, res.status, `antwortet mit Schema ${JSON.stringify(wire?.schema ?? null)} statt fleet.timeline/v1`);

  const now = typeof wire.now === "number" ? wire.now : Date.now();
  const events: TimelineEvent[] = [];
  const gaps: TimelineGap[] = [];
  const sessions: TimelineSession[] = [];
  // ledger events are claimed by session key, then by slot+openedAt (the occupation proof), never by slot alone
  const byKey = new Map<string, TimelineWireSession>();
  const byOccupation = new Map<string, TimelineWireSession>();
  for (const s of wire.sessions) {
    byKey.set(s.key, s);
    const occ = s.snapshot.identity?.occupation;
    if (occ && occ !== "unknown") byOccupation.set(`${occ.slot}@${occ.openedAt}`, s);
    else if (s.slot !== null && s.openedAt !== null) byOccupation.set(`${s.slot}@${s.openedAt}`, s);
    if (s.snapshot.identity?.session) byKey.set(s.snapshot.identity.session, s);
  }
  const ledgerCount = new Map<string, number>();
  let ledgerUnassigned = 0;
  for (const [i, e] of (Array.isArray(wire.ledger) ? wire.ledger : []).entries()) {
    const owner = (e.refs.session ? byKey.get(e.refs.session) : undefined)
      ?? (typeof e.refs.slot === "number" && typeof e.refs.openedAt === "number" ? byOccupation.get(`${e.refs.slot}@${e.refs.openedAt}`) : undefined) ?? null;
    if (owner) ledgerCount.set(owner.key, (ledgerCount.get(owner.key) ?? 0) + 1); else ledgerUnassigned++;
    events.push(ledgerEvent(e, i, owner?.key ?? null));
  }
  for (const s of wire.sessions) {
    const snap = s.snapshot;
    const details = new Map((s.details ?? []).map((d) => [d.locator, d]));
    const byId = new Map(snap.events.map((e) => [e.id, e]));
    const own = snap.events.map((e) => toolEvent(s, e, details, byId));
    const pairMissing = own.filter((e) => e.pair && !byId.has(e.pair))
      .map((e) => gapOf(s.key, "pair-missing-in-snapshot", e.source.record?.offset));
    const sessionGaps = [...snap.gaps.map((g) => gapOf(s.key, g.code, g.offset, g.bytes)), ...pairMissing];
    const h = snap.horizon;
    sessions.push({
      key: s.key, label: s.label ?? snap.identity?.session.slice(0, 8) ?? s.key.slice(0, 8), harness: s.harness, host: s.host,
      version: snap.version, slot: s.slot, openedAt: s.openedAt, project: s.project, program: s.program, state: snap.state,
      occupation: snap.identity?.occupation && snap.identity.occupation !== "unknown"
        ? { slot: snap.identity.occupation.slot, openedAt: snap.identity.occupation.openedAt } : "unknown",
      parentSession: snap.identity?.parentSession ?? null,
      horizon: h.state === "read" ? { state: "read", oldestAt: h.oldestAt, newestAt: h.newestAt ?? null, reason: null }
        : { state: "unmeasured", oldestAt: null, newestAt: null, reason: h.reason },
      counts: { calls: own.filter((e) => e.kind === "tool.call").length, results: own.filter((e) => e.kind === "tool.result").length,
        errors: own.filter((e) => e.status === "error").length, pending: own.filter((e) => e.status === "pending").length,
        ledger: ledgerCount.get(s.key) ?? 0 },
      gaps: sessionGaps,
    });
    events.push(...own);
    gaps.push(...sessionGaps);
  }
  for (const h of Array.isArray(wire.horizon) ? wire.horizon : [])
    if (h.state === "unmeasured") gaps.push(gapOf(null, "ledger-unmeasured", undefined, undefined));
  events.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const ats = events.map((e) => e.at);
  return {
    state: events.length ? "read" : "empty", route: ROUTE, status: res.status, reason: null, now,
    window: wire.window ?? window,
    span: { from: ats.length ? Math.min(...ats) : null, to: ats.length ? Math.max(...ats) : null },
    sessions, events, gaps, clock: { uncertainty: "unknown", note: CLOCK_NOTE }, ledgerUnassigned,
    next: typeof wire.next === "string" ? wire.next : null,
  };
}
