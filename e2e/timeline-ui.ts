// THE SESSION TIMELINE, OPERATED (Program ae1f4279, part 5 — src/timeline.ts + the lens in src/client.ts).
//
// A real browser runs the real client bundle behind a fixture origin, exactly as e2e/drops.ts and
// e2e/slots.ts#runArbeitsorteDom do: Chromium over CDP, every request of http://fleet.fixture/*
// answered here. The one route the lens reads, GET /api/timeline, is served from the native
// fixtures of e2e/trace-native-fixtures.ts (five harness sessions, each tool call and result) plus
// a hand-written ledger (report with verdict, clarification, founding, commit, land, gate, audit,
// deploy) and three contract edge sessions (a record without a timestamp, a snapshot that stops
// before its identity record, a call without its result). The body is typed as the route's own
// `TimelinePage` (trace-timeline.ts) and laid out as `TimelineIndex.page` lays it out: session
// headers without events, one `entries` list in time order, ledger entries claimed only by an exact
// session + occupation match. NOTHING of that is in the bundle — a claim below asserts it.
//
// Every claim is a DOM fact at 1200×900 and at 390×844, and every claim has a MUTANT (owner card
// 2026-10-07: „[Zitat entfernt]“): `TIMELINE_MUTANTS` swaps one needle of
// src/timeline.ts or src/client.ts in the bundle the page runs — or of public/index.html in the
// page itself, for a claim about colour — and expects the named claim to go red. A needle that left the source throws, so a probe that could not apply its mutation fails as
// ITSELF, never as "caught".
//
// WHAT IS NOT PROVEN HERE: that the live route fills this shape with the same CONTENT — the
// fixture is typed as `TimelinePage`, so a change of the route's type breaks tsc here, but the body
// is built by hand, not by `TimelineIndex`. The prototype wire this check once served (sessions
// carrying their `snapshot`) is now the foreign-answer claim: the lens names the missing field and
// draws no track. Without the route at all the lens names the 404.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { NATIVE_CANARY, NATIVE_FIXTURES, loadNativeUiFixtures } from "./trace-native-fixtures";
import { normalizeNative, type NativeEvent, type NativeSnapshot } from "../trace-native";
import type { TraceEvent } from "../trace-index";
import { TIMELINE_BUDGET, type TimelineEntry, type TimelinePage, type TimelineSession } from "../trace-timeline";

export interface TimelineDomResult { width: number; height: number; claims: Record<string, boolean>; facts: Record<string, unknown> }
// `width`: the one viewport the mutant is judged at — 1200 unless the claim is a phone claim
export interface TimelineMutant { name: string; claim: string; file: "src/timeline.ts" | "src/client.ts" | "public/index.html"; needle: string; with: string; width?: 1200 | 390 }

// the claims, named once so the mutants can point at them
export const TL_CLAIM = {
  open: "the ⋯ panel's Zeitleiste entry opens the Activity window on the Zeitleiste lens, its switch pressed, the overview drawn",
  axis: "every session is its own track on ONE axis: marks across all tracks keep record-time order, and the axis carries ticks",
  kinds: "tool calls and the eight ledger kinds are told apart by kind and glyph, and a report carries its verdict",
  unknown: "what was not observed stays visible: the clock note, one gap chip per session gap, the pending call's open bar, the unmeasured horizon's hatch, the timeless mark",
  zoom: "Zoom narrows to the session (two crumbs, one track), Zoom Call to the pair (two marks), and back steps one level at a time",
  inspect: "a click opens the inspector with Argumente, Resultat, Fehler, Zeitpunkte, Dauer and Quelle; an error shows its text, a pending call says wartet",
  legend: "every glyph on the canvas has its word once in the legend at the axis head, and every mark's title begins with that word",
  phoneList: "on the phone the session zoom lists its marks in time order: no two overlap, no word is cut, the hatch keeps its word",
  apart: "in the session zoom no two chips share a pixel, however many events fall on one instant",
  keys: "keyboard: → walks the marks, Enter opens the inspector, Escape closes it and gives focus back to the mark",
  touch: "touch-sized: every control at least 40 px tall, no sideways page scroll, the inspector covers the screen, ‹ shows the session rail",
  bundle: "the production bundle carries neither the fixture module nor its canary",
  noRoute: "without the route the lens names the 404 of GET /api/timeline and draws no track",
  stale: "an answer that arrives after its window was closed paints nothing into the window opened since",
  // the UI-MAIN's follow-up points 5–9 (card 2026-10-08)
  headBtn: "in the overview each session's track head is the one button into it (name and chevron, touch-high on the phone), no track carries a Zoom button, and the session zoom has none",
  oneAmber: "amber means not observed and nothing else: the hatch, the gap chips, the rail's gap count and the legend's word are amber; no mark, bar or state word carries amber or the wait colour on text, fill or border — in the overview, the codex session's zoom (a list on the phone) and the claude zoom",
  emptyOne: "without the route the lens says it in one sentence that names GET /api/timeline exactly once, with the status and the server's error text",
  rawSource: "the inspector folds locator, fingerprint and record bytes behind a closed Rohwert summary; opening it shows Kopieren, which writes exactly the full raw value to the clipboard; the visible Quelle text carries none of it",
  toolbarRow: "the toolbar is one row on every zoom level: on the phone zoom, pan and the harness picker sit behind Mehr and appear on tap; on the desktop they stand in the row and there is no Mehr",
  // owner 2026-10-11: „[Zitat entfernt]“ — the lens read a prototype wire, the route serves TimelinePage
  wire: "the lens reads the route's own TimelinePage: every session header is a track, the error call and the report are marks, and the page raises no exception",
  foreign: "an answer of another form — the prototype wire, or a page whose session lacks its occupation — ends as state unavailable in one sentence naming the field, with no track and no exception",
} as const;

export const TIMELINE_MUTANTS: readonly TimelineMutant[] = [
  { name: "marks placed by a per-event remainder instead of the shared axis", claim: TL_CLAIM.axis, file: "src/client.ts",
    needle: "100 * (at - axis.from) / (axis.to - axis.from)", with: "100 * ((at - axis.from) % 700) / (axis.to - axis.from)" },
  { name: "a report read as 'other'", claim: TL_CLAIM.kinds, file: "src/timeline.ts",
    needle: `if (fam === "report") return { kind: "report", label: "Report", verdict: qual || verb || null };`,
    with: `if (fam === "report") return { kind: "other", label: "Report", verdict: null };` },
  { name: "a session's gaps dropped from the model", claim: TL_CLAIM.unknown, file: "src/timeline.ts",
    needle: "const sessionGaps = s.gaps.map((g) => gapOf(s.key, g.code, g.offset, g.bytes));",
    with: "const sessionGaps: TimelineGap[] = [];" },
  { name: "the lens reads sessions[].snapshot again (the prototype wire)", claim: TL_CLAIM.wire, file: "src/timeline.ts",
    needle: "const h = s.source.horizon;", with: "const h = (s as unknown as { snapshot: { horizon: typeof s.source.horizon } }).snapshot.horizon;" },
  { name: "the page read without checking its fields", claim: TL_CLAIM.foreign, file: "src/timeline.ts",
    needle: "const bad = malformed(body);", with: "const bad = null as string | null;" },
  { name: "a timeless record claims a known time", claim: TL_CLAIM.unknown, file: "src/timeline.ts",
    needle: "atKnown: e.occurredAt !== null,", with: "atKnown: true," },
  { name: "back from call zoom jumps to the overview", claim: TL_CLAIM.zoom, file: "src/client.ts",
    needle: `if (tlZoom === "call") { tlSetZoom("session", tlScope, null); return true; }`,
    with: `if (tlZoom === "call") { tlSetZoom("overview", null, null); return true; }` },
  { name: "the inspector drops the source", claim: TL_CLAIM.inspect, file: "src/client.ts",
    needle: `field("Quelle", src);`, with: "void src;" },
  { name: "the route's error status ignored", claim: TL_CLAIM.noRoute, file: "src/timeline.ts",
    needle: "if (!res.ok) {", with: "if (res.status === 599) {" },
  { name: "a closed window's late answer is kept", claim: TL_CLAIM.stale, file: "src/client.ts",
    needle: "if (gen !== tlGen) return; // an older window's answer: not ours to paint", with: "void gen;" },
  { name: "the legend built from no kinds", claim: TL_CLAIM.legend, file: "src/client.ts",
    needle: "for (const k of legendKinds) {", with: "for (const k of [] as TimelineKind[]) {" },
  { name: "the phone keeps the axis in session zoom", claim: TL_CLAIM.phoneList, file: "src/client.ts", width: 390,
    needle: `const listMode = mobile && tlZoom !== "overview";`, with: "const listMode = false;" },
  { name: "the packing forgets how wide a chip is", claim: TL_CLAIM.apart, file: "src/client.ts",
    needle: "half = markWidthPx(e) / 2;", with: "half = 0;" },
  { name: "the track head is a div, not a button", claim: TL_CLAIM.headBtn, file: "src/client.ts",
    needle: `const headBtn = el("button", "tlheadbtn") as HTMLButtonElement;`, with: `const headBtn = el("div", "tlheadbtn") as HTMLButtonElement;` },
  { name: "an unknown mark's glyph painted amber again", claim: TL_CLAIM.oneAmber, file: "public/index.html",
    needle: `.tlev[data-status="unknown"] .tlst, .tlev[data-status="late"] .tlst { color: var(--chat-mute); }`,
    with: `.tlev[data-status="unknown"] .tlglyph { color: var(--amber); }` },
  { name: "the empty state names the route a second time", claim: TL_CLAIM.emptyOne, file: "src/client.ts",
    needle: `" Bis dahin zeigt sie nichts und behauptet nichts."`, with: `" Bis GET /api/timeline antwortet, zeigt sie nichts und behauptet nichts."` },
  { name: "the raw value stands open as flowing text", claim: TL_CLAIM.rawSource, file: "src/client.ts",
    needle: `const raw = el("details", "tlraw");`, with: `const raw = el("div", "tlraw");` },
  { name: "Kopieren copies only the first raw line", claim: TL_CLAIM.rawSource, file: "src/client.ts",
    needle: `copyText(rawLines.join("\\n"));`, with: `copyText(rawLines[0] ?? "");` },
  { name: "a codex call's bar filled amber", claim: TL_CLAIM.oneAmber, file: "public/index.html",
    needle: `.tlbar.error { background: var(--danger); }`, with: `.tlbar.error { background: var(--danger); } .tltrack[data-harness="codex"] .tlbar { background: var(--amber); }` },
  { name: "the phone keeps zoom, pan and picker in the toolbar", claim: TL_CLAIM.toolbarRow, file: "src/client.ts", width: 390,
    needle: "const fold = mobile && !listMode;", with: "const fold = false;" },
];

const T = Date.parse("2026-01-01T00:00:00.000Z");
const encode = (rows: readonly unknown[]): Uint8Array => new TextEncoder().encode(rows.map((r) => JSON.stringify(r) + "\n").join(""));

// the page GET /api/timeline answers for this window, laid out as trace-timeline.ts#TimelineIndex.page lays it
// out: five fixture sessions and three edge sessions as headers, their native events and a ledger as entries
const HOST = "synthetic-host";
const sha = (v: unknown): string => createHash("sha256").update(JSON.stringify(v)).digest("hex");
export async function timelineWireFixture(): Promise<TimelinePage> {
  const window = { from: T - 3600_000, to: T + 3000 };
  const sources: { snapshot: NativeSnapshot; uuid: string | null; slot: number; openedAt: number; program: string | null; task: string | null }[] = [];
  const ui = await loadNativeUiFixtures();
  ui.forEach((f, i) => sources.push({ snapshot: f.snapshot, uuid: null, slot: i + 1, openedAt: T - 60_000 * (i + 1),
    program: i < 2 ? "ae1f4279" : null, task: i === 0 ? "3b2698ac" : null }));
  // a Codex record without a timestamp: the event sits at its observation time and says so
  const codex = NATIVE_FIXTURES[1];
  if (!codex) throw new Error("timeline wire fixture: the codex native fixture is missing");
  const rows = JSON.parse(JSON.stringify(codex.rows)) as Record<string, unknown>[];
  const timeless = rows.map((r, i) => i === 1 ? { ...r, timestamp: undefined } : r);
  const codexTimeless = await normalizeNative({ ...codex.input, sourceId: "codex-ohne-zeit", bytes: encode(timeless), observedAt: T + 2500 });
  sources.push({ snapshot: codexTimeless, uuid: "00000000-0000-4000-8000-000000000006", slot: 6, openedAt: T - 7000, program: null, task: null });
  // a snapshot that stops before its identity record: no events, horizon unmeasured, two gaps
  const claude = NATIVE_FIXTURES[0];
  if (!claude) throw new Error("timeline wire fixture: the claude native fixture is missing");
  const torn = await normalizeNative({ ...claude.input, sourceId: "claude-abgerissen", bytes: new TextEncoder().encode('{"type":'), observedAt: T + 2600 });
  sources.push({ snapshot: torn, uuid: "00000000-0000-4000-8000-000000000007", slot: 7, openedAt: T - 8000, program: null, task: null });
  // a call whose result the snapshot does not hold yet: pending, with its own `missing-result` gap
  const open = await normalizeNative({ ...claude.input, sourceId: "claude-offen", bytes: encode(claude.rows.slice(0, 1)), observedAt: T + 2700 });
  sources.push({ snapshot: open, uuid: "00000000-0000-4000-8000-000000000008", slot: 8, openedAt: T - 9000, program: null, task: null });
  const sessions: TimelineSession[] = [];
  const entries: TimelineEntry[] = [];
  for (const f of sources) {
    const s = f.snapshot, session = f.uuid ?? s.identity?.session;
    if (!session) throw new Error(`timeline wire fixture: ${s.source} has no session id`);
    // the route's key: host, session and occupation — never the native identityKey the events carry
    const key = sha([HOST, session, f.slot, f.openedAt]);
    sessions.push({ key, session, host: HOST, occupation: { slot: f.slot, openedAt: f.openedAt, proofHash: sha(["receipt", key]) },
      harness: s.harness, project: "synthetic0project", program: f.program, task: f.task, branch: null,
      source: { id: s.source, version: s.version, state: s.state, completeBytes: s.completeBytes, indexedBytes: s.inputBytes,
        availableBytes: s.inputBytes, horizon: s.horizon }, gaps: s.gaps, observedAt: f.openedAt, clockUncertainty: "unknown" });
    entries.push({ id: `session:${key}`, at: Math.max(window.from, f.openedAt), sessionKey: key, event: null });
    for (const e of s.events) if (e.at >= window.from && e.at <= window.to) entries.push({ id: e.id, at: e.at, sessionKey: key, event: e });
  }
  const first = sessions[0];
  if (!first) throw new Error("timeline wire fixture: no session");
  const bound = { session: first.session, slot: first.occupation.slot, openedAt: first.occupation.openedAt };
  const ledger: TraceEvent[] = [
    { source: "fleet.json", kind: "task.created", at: T + 400, refs: { task: "3b2698ac", ...bound }, files: [] },
    { source: "fleet-reports.jsonl", kind: "report.filed.handoff", at: T + 2300, refs: { task: "3b2698ac", ...bound }, files: [],
      detailRef: { source: "fleet-reports.jsonl", locator: "fleet-reports.jsonl@120+300", fp: "ab12cd34ef56ab12" } },
    { source: "fleet-clarifications.jsonl", kind: "send.clarification.asked", at: T + 1500, refs: { task: "3b2698ac", ...bound }, files: [] },
    { source: "prompts.jsonl", kind: "commit.lane", at: T + 1800, refs: { task: "3b2698ac", branch: "fleet/261007-x", sha: "c0ffee1234567", ...bound }, files: ["src/a.ts"] },
    { source: "fleet/land note", kind: "land.gate.green", at: T + 2400, refs: { task: "3b2698ac", branch: "fleet/261007-x", ...bound }, files: [] },
    { source: "lane-outcomes.jsonl", kind: "land.main-direct.landed", at: T + 2450, refs: { task: "3b2698ac", branch: "fleet/261007-x", sha: "deadbeef00000", ...bound }, files: [] },
    { source: "post-land-audits.jsonl", kind: "audit.red", at: T + 2550, refs: { task: "3b2698ac", branch: "fleet/261007-x", sha: "deadbeef00000" }, files: [] },
    { source: "audit.jsonl", kind: "deploy.done", at: T + 2700, refs: { task: "3b2698ac", sha: "deadbeef00000" }, files: [] },
  ];
  // claimed by an exact session + occupation match, as the route claims it; the audit and the deploy name none
  for (const e of ledger) entries.push({ id: sha([e.source, e.kind, e.at, e.detailRef, e.refs]), at: e.at, event: e,
    sessionKey: e.refs.session === first.session && e.refs.slot === first.occupation.slot && e.refs.openedAt === first.occupation.openedAt ? first.key : null });
  entries.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  return { schema: "fleet.timeline/v1", host: HOST, revision: "1", window, sessions, entries, nextCursor: null, pending: false,
    coverage: "incomplete", gaps: ["history-before-retained-sources-unknown"],
    ledger: [{ task: "3b2698ac", horizon: [{ source: "audit.jsonl", state: "unmeasured", reason: "ledger not readable in this fixture", clock: "fleet server wallclock (Date.now at write)" }] }],
    budget: TIMELINE_BUDGET,
    work: { readBytes: 0, sourceReads: 0 } };
}
// the native event of an entry: the page types `event` as TraceEvent, a tool entry carries the NativeEvent
const nativeOf = (e: TimelineEntry | undefined): NativeEvent | null =>
  e?.event && (e.event.kind === "tool.call" || e.event.kind === "tool.result") ? e.event as NativeEvent : null;

export async function runTimelineDom(sourceRoot: string, artifacts?: string,
  only: { widths?: readonly number[]; mutate?: TimelineMutant } = {}): Promise<TimelineDomResult[]> {
  const scratch = resolve(tmpdir(), `fleet-timeline-dom-${process.pid}-${crypto.randomUUID()}`);
  mkdirSync(scratch, { recursive: true });
  if (artifacts) mkdirSync(artifacts, { recursive: true });
  const mutant = only.mutate;
  const htmlMutant = mutant?.file === "public/index.html" ? mutant : null;
  const mutantPath = mutant && !htmlMutant ? resolve(sourceRoot, mutant.file) : null;
  let mutationApplied = !mutant;
  const built = await Bun.build({ entrypoints: [resolve(sourceRoot, "src/client.ts")], target: "browser",
    plugins: mutant && mutantPath ? [{ name: "timeline-mutant", setup(build) {
      build.onLoad({ filter: /\.ts$/ }, ({ path }) => {
        if (path !== mutantPath) return;
        const source = readFileSync(path, "utf8");
        mutationApplied = source.includes(mutant.needle);
        return { contents: source.replace(mutant.needle, mutant.with), loader: "ts" };
      });
    } }] : [] });
  if (!built.success) { rmSync(scratch, { recursive: true, force: true }); throw new Error(built.logs.join("\n")); }
  const appJs = await built.outputs[0].text();
  let indexHtml = readFileSync(resolve(sourceRoot, "public/index.html"), "utf8");
  if (htmlMutant) { mutationApplied = indexHtml.includes(htmlMutant.needle); indexHtml = indexHtml.replace(htmlMutant.needle, htmlMutant.with); }
  if (!mutationApplied) { rmSync(scratch, { recursive: true, force: true }); throw new Error(`timeline mutant: needle not in ${mutant?.file}: ${mutant?.needle.slice(0, 80)}`); }
  const wire = await timelineWireFixture();
  // `delayMs` holds the next answer back, `narrow` makes it a one-session variant — together they
  // stage the late answer of a window that has been closed meanwhile
  const fx = { route404: false, timelineHits: 0, delayMs: 0, narrow: false, foreign: null as unknown, exceptions: [] as string[] };
  const executable = process.env.FLEET_E2E_BROWSER ?? Bun.which("chromium") ?? Bun.which("chromium-browser") ?? Bun.which("google-chrome") ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (!Bun.file(executable).size) { rmSync(scratch, { recursive: true, force: true }); throw new Error("timeline DOM probe needs Chromium (FLEET_E2E_BROWSER): " + executable); }
  const browser = Bun.spawn([executable, "--headless", "--no-sandbox", "--disable-gpu", "--no-first-run", "--disable-background-networking", "--remote-debugging-port=0", `--user-data-dir=${scratch}/profile`, "about:blank"], { stdout: "ignore", stderr: "pipe" });
  let socket: WebSocket | undefined;
  try {
    let startupTimer: ReturnType<typeof setTimeout> | undefined;
    let startupLog = "";
    const endpoint = await Promise.race([
      (async () => { for await (const chunk of browser.stderr) { startupLog += new TextDecoder().decode(chunk); const m = /DevTools listening on (ws:\/\/[^\s]+)/.exec(startupLog); if (m) return m[1]; } throw new Error("browser exited before CDP endpoint: " + startupLog); })(),
      new Promise<never>((_, reject) => { startupTimer = setTimeout(() => reject(new Error("browser CDP startup timeout: " + startupLog)), 45000); }),
    ]).finally(() => clearTimeout(startupTimer));
    socket = new WebSocket(endpoint);
    await new Promise<void>((ok, bad) => { socket!.onopen = () => ok(); socket!.onerror = () => bad(new Error("CDP connection failed")); });
    let serial = 0, sessionId: string | undefined;
    let loaded: (() => void) | null = null;
    const pending = new Map<number, { ok: (v: Record<string, unknown>) => void; bad: (e: Error) => void }>();
    const send = (method: string, params: Record<string, unknown> = {}) => new Promise<Record<string, unknown>>((ok, bad) => {
      const id = ++serial;
      const timeout = setTimeout(() => { pending.delete(id); bad(new Error("CDP timeout: " + method)); }, 30000);
      pending.set(id, { ok: (v) => { clearTimeout(timeout); ok(v); }, bad: (e) => { clearTimeout(timeout); bad(e); } });
      socket!.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    const reply = (requestId: string, status: number, body: string | Uint8Array, type = "application/json") =>
      send("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: [{ name: "content-type", value: type }],
        body: Buffer.from(body).toString("base64") }).catch(() => undefined);
    const json = (requestId: string, value: unknown, status = 200) => reply(requestId, status, JSON.stringify(value));
    socket.onmessage = (event) => {
      const msg = JSON.parse(String(event.data)) as { id?: number; error?: unknown; result?: Record<string, unknown>; method?: string; params?: Record<string, unknown> };
      if (msg.id !== undefined) {
        const waiting = pending.get(msg.id); if (!waiting) return;
        pending.delete(msg.id);
        if (msg.error) waiting.bad(new Error(JSON.stringify(msg.error))); else waiting.ok(msg.result ?? {});
        return;
      }
      if (msg.method === "Page.loadEventFired") { const fire = loaded; loaded = null; fire?.(); return; }
      // every uncaught exception and console error of the page — the owner's 11.10. symptom was a TypeError here
      if (msg.method === "Runtime.exceptionThrown") { const d = (msg.params as { exceptionDetails?: { text?: string; exception?: { description?: string } } }).exceptionDetails;
        fx.exceptions.push(String(d?.exception?.description ?? d?.text ?? "exception").slice(0, 200)); return; }
      if (msg.method === "Runtime.consoleAPICalled" && (msg.params as { type?: string }).type === "error") {
        fx.exceptions.push("console.error: " + JSON.stringify((msg.params as { args?: unknown[] }).args ?? []).slice(0, 200)); return; }
      if (msg.method === "Page.javascriptDialogOpening") { void send("Page.handleJavaScriptDialog", { accept: false }).catch(() => undefined); return; }
      if (msg.method !== "Fetch.requestPaused" || !msg.params) return;
      const { requestId, request } = msg.params as { requestId: string; request: { url: string; method: string } };
      const url = new URL(request.url), p = url.pathname;
      if (request.method === "POST") return void json(requestId, { ok: true });
      if (p === "/" || p === "/blank") return void reply(requestId, 200, p === "/" ? indexHtml : "<!doctype html><title>blank</title>", "text/html");
      if (p === "/app.js") return void reply(requestId, 200, appJs, "text/javascript");
      if (p === "/api/sessions") return void json(requestId, { now: T + 3000, chips: [], tasks: [],
        slots: [{ id: 1, cwd: "/synthetic/repo", label: "Orchestratorin", openedAt: 1000, harness: "claude" }, ...Array.from({ length: 15 }, (_, i) => ({ id: i + 2, cwd: null }))] });
      if (p === "/api/slots/1/transcript") return void json(requestId, { entries: [], total: 0, source: "/fixture/orch.jsonl", ttlSec: 300 });
      if (p === "/api/timeline") {
        fx.timelineHits++;
        if (fx.route404) return void json(requestId, { error: "no such route" }, 404);
        if (fx.foreign !== null) return void json(requestId, fx.foreign);
        const one = wire.sessions[0]?.key;
        const body = fx.narrow ? { ...wire, sessions: wire.sessions.slice(0, 1), entries: wire.entries.filter((e) => e.sessionKey === one), ledger: [] } : wire;
        if (fx.delayMs > 0) { setTimeout(() => void json(requestId, body), fx.delayMs); return; }
        return void json(requestId, body);
      }
      return void json(requestId, { error: "fixture: not served" }, 404);
    };
    const evaluate = async <V>(expression: string): Promise<V> => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error("timeline DOM probe: evaluate failed: " + JSON.stringify(r.exceptionDetails).slice(0, 300) + " in " + expression.replace(/\s+/g, " ").slice(0, 160));
      return (r.result as { value: V }).value;
    };
    const settle = (ms = 60) => evaluate(`new Promise(r => setTimeout(r, ${ms}))`);
    const navigate = async (to: string) => {
      const done = new Promise<void>((ok) => { loaded = ok; });
      await send("Page.navigate", { url: to });
      await Promise.race([done, Bun.sleep(15000)]);
    };
    const wait = async (condition: string, ms = 8000) => evaluate<boolean>(`new Promise((ok) => { const until = Date.now() + ${ms};
      const tick = () => { let v = false; try { v = !!(${condition}); } catch {} if (v) return ok(true); if (Date.now() > until) return ok(false); setTimeout(tick, 20); }; tick(); })`);
    const shot = async (name: string) => {
      if (!artifacts) return;
      const png = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(resolve(artifacts, `${name}.png`), Buffer.from(String(png.data), "base64"));
    };
    const key = async (k: "Enter" | "Escape" | "ArrowRight" | "ArrowLeft" | "Tab") => {
      const codes = { Enter: 13, Escape: 27, ArrowRight: 39, ArrowLeft: 37, Tab: 9 } as const;
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: k, windowsVirtualKeyCode: codes[k], ...(k === "Enter" ? { text: "\r" } : {}) });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: k, windowsVirtualKeyCode: codes[k] });
      await settle(80);
    };
    // `tryClick` is for a control a MUTANT may have removed: its absence is the claim's red, never
    // the probe's; `click` is for the fixture's own way through the lens, where nothing to click is
    // the probe failing as itself
    const tryClick = async (selector: string): Promise<boolean> => {
      const ok = await evaluate<boolean>(`(() => { const n = document.querySelector(${JSON.stringify(selector)}); if (!n) return false; n.click(); return true; })()`);
      await settle(80);
      return ok;
    };
    const click = async (selector: string) => {
      if (!await tryClick(selector)) throw new Error("timeline DOM probe: nothing to click at " + selector);
    };
    const openLens = async () => {
      const entry = await wait(`document.querySelector('#morepanel [data-lens="timeline"]')`, 15000);
      if (!entry) throw new Error("timeline DOM probe: the ⋯ panel has no Zeitleiste entry: " + await evaluate<string>("document.body.innerText.slice(0, 300)"));
      await click('#morepanel [data-lens="timeline"]');
      await wait(`document.querySelector('#shell-outcomes .tlcanvas, #shell-outcomes .tlstate')`, 8000);
      await settle(150);
    };
    // what the lens shows, read the way the owner reads it
    const READ = `(() => { const sh = document.querySelector('#shell-outcomes'); if (!sh) return null;
      const canvas = sh.querySelector('.tlcanvas');
      const marks = [...sh.querySelectorAll('.tlev')].map((b) => { const r = b.getBoundingClientRect(); return { id: b.dataset.id, kind: b.dataset.kind, family: b.dataset.family,
        status: b.dataset.status, atKnown: b.dataset.atKnown, verdict: b.dataset.verdict ?? null, at: Number(b.dataset.at), left: parseFloat(b.style.left),
        glyph: b.querySelector('.tlglyph')?.textContent ?? '', h: Math.round(r.height), w: Math.round(r.width), track: b.closest('.tltrack')?.dataset.session ?? 'fleet',
        title: b.title, rect: { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right) },
        cut: [...b.querySelectorAll('span')].some((s) => s.scrollWidth > s.clientWidth + 1) }; });
      const legend = [...sh.querySelectorAll('.tllegend [data-kind]')].map((s) => ({ kind: s.dataset.kind, glyph: s.querySelector('.tlglyph')?.textContent ?? '', text: s.textContent.trim() }));
      const hatchCut = [...sh.querySelectorAll('.tlunmeasured span')].some((s) => s.scrollWidth > s.clientWidth + 1 || s.getBoundingClientRect().right > (s.closest('.tlplot, .tllist')?.getBoundingClientRect().right ?? Infinity) + 1);
      const hatchWords = [...sh.querySelectorAll('.tlunmeasured span')].map((s) => s.textContent);
      const inspect = sh.querySelector('.tlinspect');
      const fields = {}; for (const dd of sh.querySelectorAll('.tlinspect dd[data-field]')) fields[dd.dataset.field] = dd.innerText.trim();
      const ir = inspect && !inspect.hidden ? inspect.getBoundingClientRect() : null;
      // colours as the page computes them: the token's hex read into rgb() once
      const rgbOf = (token) => { const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim(); const m = /^#([0-9a-f]{6})$/i.exec(v);
        return m ? 'rgb(' + [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).join(', ') + ')' : v; };
      const amber = rgbOf('--amber'), waitc = rgbOf('--q-wait');
      const colorOf = (n) => getComputedStyle(n).color;
      // a colour can sit on the text, the fill or any border side — all of them count (Kern-MAIN review of 2a4fee39)
      const tinted = (c) => [...sh.querySelectorAll('.tlev, .tlev *, .tlbar, .tlihead .tlchip')].filter((n) => { const cs = getComputedStyle(n);
        return [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor].includes(c); }).length;
      const legUnk = sh.querySelector('.tllegend [data-meaning="unmeasured"]');
      const colours = { amberMarks: tinted(amber), waitMarks: tinted(waitc),
        hatch: [...sh.querySelectorAll('.tlunmeasured span')].every((n) => colorOf(n) === amber), hatches: sh.querySelectorAll('.tlunmeasured span').length,
        gaps: [...sh.querySelectorAll('.tlgap')].every((n) => colorOf(n) === amber), gapN: sh.querySelectorAll('.tlgap').length,
        railGaps: [...sh.querySelectorAll('.tlrow .tlcount .unk')].every((n) => colorOf(n) === amber), railGapN: sh.querySelectorAll('.tlrow .tlcount .unk').length,
        legend: legUnk ? { amber: colorOf(legUnk) === amber, text: legUnk.textContent.trim() } : null };
      const heads = [...sh.querySelectorAll('.tltrack[data-session]')].map((t) => { const b = t.querySelector('button.tlheadbtn'); const r = b ? b.getBoundingClientRect() : null;
        return { btn: !!b, text: (b?.textContent ?? '').trim().slice(0, 40), chev: !!b?.querySelector('.tlchev'), h: r ? Math.round(r.height) : 0,
          zoomBtns: [...t.querySelectorAll('.tlhead button')].filter((x) => /^Zoom/.test(x.textContent)).length }; });
      // the lens's own toolbar (.tltools) — the shell's lens tabs above it are not the timeline's row
      const tb = document.querySelector('#shell-outcomes .shelltools .tltools');
      const vis = tb ? [...tb.querySelectorAll('button, select')].filter((n) => n.getBoundingClientRect().width > 0) : [];
      const mid = (n) => { const r = n.getBoundingClientRect(); return Math.round((r.top + r.height / 2) / 20); };
      const shown = (sel) => { const n = tb?.querySelector(sel); return !!n && n.getBoundingClientRect().width > 0; };
      const moreBtn = tb?.querySelector('.tlmorebtn');
      const tools = tb ? { rows: new Set(vis.map(mid)).size, controls: vis.length, zoomVisible: shown('.tlzoom'), selVisible: shown('select'),
        more: moreBtn ? { text: moreBtn.textContent, expanded: moreBtn.getAttribute('aria-expanded'), h: Math.round(moreBtn.getBoundingClientRect().height) } : null,
        overflow: Math.max(0, ...vis.map((n) => Math.round(n.getBoundingClientRect().right))) - Math.round(tb.closest('.shelltools').getBoundingClientRect().right) } : null;
      const rawEl = sh.querySelector('.tlinspect dd[data-field="Quelle"] .tlraw');
      const raw = rawEl ? { details: rawEl.tagName === 'DETAILS', open: rawEl.open === true, summary: rawEl.querySelector('summary')?.textContent ?? '',
        code: [...rawEl.querySelectorAll('code')].map((c) => c.textContent).join('\\n'), copy: rawEl.querySelector('.tlcopy')?.textContent ?? null,
        // a closed details keeps its content's boxes (content-visibility), so the rect alone lies: checkVisibility() tells
        copyVisible: (() => { const b = rawEl.querySelector('.tlcopy'); if (!b) return false; const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && b.checkVisibility(); })() } : null;
      return { colours, heads, tools, raw, lens: sh.querySelector('.actlens button[aria-pressed="true"]')?.textContent ?? null, zoom: canvas?.dataset.zoom ?? null,
        tracks: [...sh.querySelectorAll('.tltrack[data-session]')].map((t) => t.dataset.session), fleetTracks: sh.querySelectorAll('.tltrack.fleet').length,
        ticks: sh.querySelectorAll('.tltick').length, crumbs: [...sh.querySelectorAll('.tlcrumb')].map((b) => b.textContent),
        note: sh.querySelector('.tlnote')?.innerText ?? '', gapChips: [...sh.querySelectorAll('.tlgap')].map((g) => g.textContent),
        pendingBars: sh.querySelectorAll('.tlbar.pending').length, hatches: [...sh.querySelectorAll('.tlunmeasured')].map((h) => h.dataset.horizon),
        marks, legend, hatchCut, hatchWords, inspectOpen: !!ir, inspectRect: ir ? { top: Math.round(ir.top), left: Math.round(ir.left), w: Math.round(ir.width), h: Math.round(ir.height) } : null,
        fields, inspectTitle: sh.querySelector('.tlihead h3')?.textContent ?? null, state: sh.querySelector('.tlstate')?.dataset.state ?? null,
        stateText: sh.querySelector('.tlstate')?.innerText ?? '', detailmode: sh.classList.contains('detailmode'),
        railRows: sh.querySelectorAll('.tlrow').length, railVisible: !!sh.querySelector('.shelllist') && sh.querySelector('.shelllist').getBoundingClientRect().width > 0,
        focusId: document.activeElement?.dataset?.id ?? null, focusClass: document.activeElement?.className ?? null,
        shortControls: [...sh.querySelectorAll('button:not(.shellclose):not(.shellback), select')].filter((b) => b.getBoundingClientRect().width > 0 && b.getBoundingClientRect().height < 40).map((b) => b.className + ':' + b.textContent.slice(0, 16)),
        pageScroll: document.documentElement.scrollWidth - innerWidth, canvasScroll: canvas ? canvas.scrollWidth - canvas.clientWidth : 0 }; })()`;
    type Mark = { id: string; kind: string; family: string; status: string; atKnown: string; verdict: string | null; at: number; left: number; glyph: string; h: number; w: number; track: string;
      title: string; rect: { t: number; b: number; l: number; r: number }; cut: boolean };
    type Colours = { amberMarks: number; waitMarks: number; hatch: boolean; hatches: number; gaps: boolean; gapN: number; railGaps: boolean; railGapN: number; legend: { amber: boolean; text: string } | null };
    type Head = { btn: boolean; text: string; chev: boolean; h: number; zoomBtns: number };
    type Tools = { rows: number; controls: number; zoomVisible: boolean; selVisible: boolean; more: { text: string; expanded: string | null; h: number } | null; overflow: number } | null;
    type Raw = { details: boolean; open: boolean; summary: string; code: string; copy: string | null; copyVisible: boolean } | null;
    type Read = { colours: Colours; heads: Head[]; tools: Tools; raw: Raw; lens: string | null; zoom: string | null; tracks: string[]; fleetTracks: number; ticks: number; crumbs: string[]; note: string; gapChips: string[];
      pendingBars: number; hatches: string[]; marks: Mark[]; legend: { kind: string; glyph: string; text: string }[]; hatchCut: boolean; hatchWords: string[];
      inspectOpen: boolean; inspectRect: { top: number; left: number; w: number; h: number } | null;
      fields: Record<string, string>; inspectTitle: string | null; state: string | null; stateText: string; detailmode: boolean; railRows: number; railVisible: boolean;
      focusId: string | null; focusClass: string | null; shortControls: string[]; pageScroll: number; canvasScroll: number } | null;
    const read = async (): Promise<NonNullable<Read>> => {
      const r = await evaluate<Read>(READ);
      if (!r) throw new Error("timeline DOM probe: the Activity window is not open");
      return r;
    };
    const results: TimelineDomResult[] = [];
    let targetId = "";
    const expectedGaps = wire.sessions.reduce((n, s) => n + s.gaps.length, 0);
    const claudeKey = wire.sessions[0]?.key ?? "";
    const codexKey = wire.sessions.find((s) => s.harness === "codex")?.key ?? null;
    const errorCall = nativeOf(wire.entries.find((e) => e.sessionKey === claudeKey && nativeOf(e)?.kind === "tool.call" && nativeOf(e)?.status === "error")) ?? undefined;
    const reportId = wire.entries.find((e) => e.event?.kind.startsWith("report."))?.id ?? "";
    const pendingCallAt = T + 1000;
    for (const [width, height] of ([[1200, 900], [390, 844]] as const).filter(([w]) => !only.widths || only.widths.includes(w))) {
      const claims: Record<string, boolean> = {};
      const facts: Record<string, unknown> = {};
      const mobile = width <= 700;
      fx.route404 = false; fx.timelineHits = 0; fx.foreign = null; fx.exceptions = [];
      if (targetId) { const old = targetId; sessionId = undefined; await send("Target.closeTarget", { targetId: old }).catch(() => undefined); }
      targetId = String((await send("Target.createTarget", { url: "about:blank" })).targetId);
      sessionId = String((await send("Target.attachToTarget", { targetId, flatten: true })).sessionId);
      await send("Fetch.enable", { patterns: [{ urlPattern: "http://fleet.fixture/*" }] });
      await send("Page.enable"); await send("Runtime.enable");
      await send("Page.addScriptToEvaluateOnNewDocument", { source: `window.WebSocket = class { constructor() { this.readyState = 0; } send() {} close() {} };` });
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
      await navigate("http://fleet.fixture/blank");
      await evaluate(`(() => { localStorage.clear(); localStorage.setItem('fleet.view', JSON.stringify({ layout: 1, panes: [1], focused: 0, chats: [true] })); localStorage.setItem('fleet.board', '0'); })()`);
      await navigate("http://fleet.fixture/");
      await openLens();

      // --- 1. open on the lens, the overview drawn
      const r1 = await read();
      facts.open = { lens: r1.lens, zoom: r1.zoom, tracks: r1.tracks.length, marks: r1.marks.length, hits: fx.timelineHits };
      claims[TL_CLAIM.open] = r1.lens === "Zeitleiste" && r1.zoom === "overview" && r1.tracks.length === wire.sessions.length && fx.timelineHits === 1;
      await shot(`${width}-1-ueberblick`);
      // --- 1b. the route's own page read as such: headers are tracks, entries are marks, nothing thrown
      facts.wire = { state: r1.state, stateText: r1.stateText.slice(0, 160), tracks: r1.tracks.length, sessions: wire.sessions.length,
        errorCall: r1.marks.some((m) => m.id === errorCall?.id), report: r1.marks.some((m) => m.id === reportId), exceptions: fx.exceptions.slice(0, 3) };
      claims[TL_CLAIM.wire] = r1.state === null && r1.tracks.length === wire.sessions.length && wire.sessions.every((s) => r1.tracks.includes(s.key))
        && !!errorCall && r1.marks.some((m) => m.id === errorCall.id) && r1.marks.some((m) => m.id === reportId) && fx.exceptions.length === 0;
      // a lens that drew no track has nothing to walk through: the claims below are unmeasured, not
      // red, and `open` and `wire` above already carry the red
      if (!r1.tracks.length) { facts.unmeasured = "no track drawn: every later claim of this width is unmeasured"; results.push({ width, height, claims, facts }); continue; }

      // --- 2. one axis for all tracks: record-time order holds across tracks
      const byAt = [...r1.marks].sort((a, b) => a.at - b.at);
      const ordered = byAt.every((m, i) => i === 0 || m.left >= byAt[i - 1]!.left - 0.01);
      facts.axis = { ticks: r1.ticks, ordered, sample: byAt.slice(0, 6).map((m) => [m.track.slice(0, 6), m.at - T, Math.round(m.left * 10) / 10]) };
      claims[TL_CLAIM.axis] = r1.tracks.length === wire.sessions.length && r1.ticks >= 2 && ordered && r1.marks.length >= 20;

      // --- 3. kinds and glyphs; the report carries its verdict
      const ledger = r1.marks.filter((m) => m.family === "ledger");
      const kinds = new Set(ledger.map((m) => m.kind));
      const glyphs = new Map<string, string>();
      let glyphClash = false;
      for (const m of r1.marks) { const g = glyphs.get(m.kind); if (g !== undefined && g !== m.glyph) glyphClash = true; glyphs.set(m.kind, m.glyph); }
      const distinctGlyphs = new Set(glyphs.values()).size === glyphs.size;
      facts.kinds = { kinds: [...kinds].sort(), glyphs: [...glyphs], report: ledger.find((m) => m.kind === "report")?.verdict ?? null };
      claims[TL_CLAIM.kinds] = ["report", "clarification", "founding", "commit", "land", "gate", "audit", "deploy"].every((k) => kinds.has(k))
        && r1.marks.some((m) => m.kind === "tool.call") && r1.marks.some((m) => m.kind === "tool.result")
        && !glyphClash && distinctGlyphs && ledger.find((m) => m.kind === "report")?.verdict === "handoff" && r1.fleetTracks === 1;

      // --- 4. the unknown stays visible
      const chipGaps = r1.gapChips.reduce((n, c) => n + (Number(/^(\d+)/.exec(c)?.[1]) || 0), 0);
      facts.unknown = { note: r1.note.slice(0, 80), chipGaps, expectedGaps, pendingBars: r1.pendingBars, hatches: r1.hatches,
        timeless: r1.marks.filter((m) => m.atKnown === "false").length };
      claims[TL_CLAIM.unknown] = r1.note.includes("Uhrunsicherheit: unbekannt") && chipGaps === expectedGaps && expectedGaps > 0
        && r1.pendingBars >= 1 && r1.hatches.includes("unmeasured") && r1.marks.some((m) => m.atKnown === "false");

      // --- 4b. the legend: one word per glyph on the canvas, the same word first on every mark's title
      const wordOf = new Map(r1.legend.map((l) => [l.kind, l.text.replace(l.glyph, "").trim()]));
      const legendCovers = [...new Set(r1.marks.map((m) => m.kind))].every((k) => (wordOf.get(k) ?? "").length > 1);
      const titled = r1.marks.every((m) => m.title.startsWith(wordOf.get(m.kind) ?? "\u0000"));
      const legendGlyphs = r1.legend.every((l) => l.glyph === r1.marks.find((m) => m.kind === l.kind)?.glyph);
      facts.legend = { legend: r1.legend.map((l) => l.text), covers: legendCovers, titled, sample: r1.marks.slice(0, 2).map((m) => m.title.slice(0, 40)) };
      claims[TL_CLAIM.legend] = r1.legend.length >= 10 && legendCovers && titled && legendGlyphs
        && !!wordOf.get("tool.call")?.startsWith("Aufruf") && (!wordOf.has("other") || !!wordOf.get("other")?.startsWith("Ereignis"));

      // --- 4c. the head is the button into a session (point 5)
      facts.headBtn = { heads: r1.heads.length, btn: r1.heads.filter((h) => h.btn).length, chev: r1.heads.filter((h) => h.chev).length, minH: Math.min(...r1.heads.map((h) => h.h)),
        zoomBtns: r1.heads.reduce((n, h) => n + h.zoomBtns, 0), sample: r1.heads[0]?.text };
      let headOk = r1.heads.length === wire.sessions.length && r1.heads.every((h) => h.btn && h.chev && h.text.length > 2 && h.zoomBtns === 0 && (!mobile || h.h >= 40));
      // --- 4d. one colour, one meaning (point 6): amber is "not observed", and only that
      // read in the overview, then in the codex session's zoom — on the phone a list, where the unknown
      // marks stand alone and large (Kern-MAIN review of 9c96d400) — and once more in the claude zoom below
      const c = r1.colours;
      let amberOk = c.amberMarks === 0 && c.waitMarks === 0 && c.hatch && c.hatches >= 1 && c.gaps && c.gapN >= 1 && c.railGaps && c.railGapN >= 1
        && !!c.legend && c.legend.amber && /ungemessen/.test(c.legend.text) && /Lücke/.test(c.legend.text);
      if (!codexKey) throw new Error("timeline DOM probe: the wire fixture has no codex session");
      await click(`.tltrack[data-session="${codexKey}"] .tlheadbtn`);
      const rc = await read();
      const unknownMarks = rc.marks.filter((m) => m.status === "unknown").length;
      amberOk = amberOk && rc.zoom === "session" && unknownMarks >= 2 && rc.colours.amberMarks === 0 && rc.colours.waitMarks === 0;
      facts.oneAmber = { overview: c, codexZoom: { zoom: rc.zoom, list: mobile, unknownMarks, amberMarks: rc.colours.amberMarks, waitMarks: rc.colours.waitMarks } };
      await click('.tlcrumb[data-zoom="overview"]');
      // --- 4e. the toolbar is one row (point 9): on the phone the rest sits behind Mehr
      const t0 = r1.tools;
      let toolbarOk = !!t0 && t0.rows === 1 && t0.overflow <= 0;
      if (mobile) {
        toolbarOk = toolbarOk && !!t0?.more && t0.more.h >= 40 && t0.more.expanded === "false" && !t0.zoomVisible && !t0.selVisible;
        const tapped = await tryClick(".tlmorebtn");
        const t1 = (await read()).tools;
        toolbarOk = toolbarOk && tapped && !!t1 && t1.zoomVisible && t1.selVisible && t1.more?.expanded === "true" && t1.overflow <= 0;
        facts.toolbarRow = { closed: t0, open: t1 };
        if (tapped) await tryClick(".tlmorebtn");
      } else {
        toolbarOk = toolbarOk && !!t0 && t0.more === null && t0.zoomVisible && t0.selVisible;
        facts.toolbarRow = { overview: t0 };
      }
      await shot(`${width}-1b-toolbar`);

      // --- 5. zoom in two steps, back one level at a time
      await click(`.tltrack[data-session="${claudeKey}"] .tlheadbtn`);
      const r5a = await read();
      headOk = headOk && r5a.heads.length === 1 && r5a.heads.every((h) => !h.btn && h.zoomBtns === 0);
      claims[TL_CLAIM.headBtn] = headOk;
      facts.oneAmber = { ...(facts.oneAmber as Record<string, unknown>), claudeZoom: { amberMarks: r5a.colours.amberMarks, waitMarks: r5a.colours.waitMarks } };
      claims[TL_CLAIM.oneAmber] = amberOk && r5a.colours.amberMarks === 0 && r5a.colours.waitMarks === 0;
      toolbarOk = toolbarOk && r5a.tools?.rows === 1 && (r5a.tools?.overflow ?? 1) <= 0;
      await shot(`${width}-2-session`);
      // --- 5b. no two chips share a pixel in the session zoom — the claude fixture puts eight
      // ledger events and two results on one instant, more than the old six rows could hold
      const rects = r5a.marks.map((m) => m.rect);
      const overlap = rects.some((a, i) => rects.some((b, j) => j > i && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b));
      facts.apart = { marks: r5a.marks.length, overlap, rows: new Set(rects.map((r) => r.t)).size };
      claims[TL_CLAIM.apart] = r5a.marks.length >= 8 && !overlap;
      // --- 5c. the phone's session zoom is a list in time order, no word cut, the hatch keeps its word
      if (mobile) {
        const ordered = r5a.marks.every((m, i) => i === 0 || m.at >= r5a.marks[i - 1]!.at);
        // a list row spans the width (an axis chip is as wide as its words); the rows read in time order
        const minW = Math.min(...r5a.marks.map((m) => m.w));
        facts.phoneList = { marks: r5a.marks.length, overlap, cut: r5a.marks.filter((m) => m.cut).length, ordered, hatchCut: r5a.hatchCut, hatchWords: r5a.hatchWords,
          minH: Math.min(...r5a.marks.map((m) => m.h)), minW, zoomTools: r5a.shortControls.length };
        claims[TL_CLAIM.phoneList] = r5a.marks.length >= 8 && !overlap && ordered && !r5a.marks.some((m) => m.cut) && !r5a.hatchCut
          && r5a.hatchWords.some((w) => /ungemessen/.test(w ?? "")) && Math.min(...r5a.marks.map((m) => m.h)) >= 40 && minW >= width * 0.6;
      }
      const call = r5a.marks.find((m) => m.kind === "tool.call" && m.status === "ok");
      if (call) await click(`.tlev[data-id="${call.id}"]`);
      await click(".tliacts .shrbtn");  // Zoom Call
      const r5b = await read();
      await shot(`${width}-3-call`);
      toolbarOk = toolbarOk && r5b.tools?.rows === 1 && (r5b.tools?.overflow ?? 1) <= 0;
      facts.toolbarRow = { ...(facts.toolbarRow as Record<string, unknown>), session: r5a.tools, call: r5b.tools };
      claims[TL_CLAIM.toolbarRow] = toolbarOk;
      // back: on the desktop Escape steps (inspector, then one level); on a phone the crumb does the same
      let r5c: NonNullable<Read>, r5d: NonNullable<Read>;
      if (!mobile) { await key("Escape"); r5c = await read(); await key("Escape"); r5d = await read(); }
      else { await click(".tliclose"); r5c = await read(); await click('.tlcrumb[data-zoom="session"]'); r5d = await read(); }
      facts.zoom = { session: { zoom: r5a.zoom, tracks: r5a.tracks, crumbs: r5a.crumbs }, call: { zoom: r5b.zoom, marks: r5b.marks.map((m) => m.kind), crumbs: r5b.crumbs.length },
        afterClose: { zoom: r5c.zoom, inspect: r5c.inspectOpen }, afterBack: { zoom: r5d.zoom, tracks: r5d.tracks.length } };
      claims[TL_CLAIM.zoom] = r5a.zoom === "session" && r5a.tracks.length === 1 && r5a.tracks[0] === claudeKey && r5a.crumbs.length === 2
        && r5b.zoom === "call" && r5b.marks.length === 2 && r5b.marks.some((m) => m.kind === "tool.call") && r5b.marks.some((m) => m.kind === "tool.result") && r5b.crumbs.length === 3
        && r5c.zoom === "call" && !r5c.inspectOpen && r5d.zoom === "session" && r5d.tracks.length === 1;
      if (!mobile) { await key("Escape"); }
      else await click('.tlcrumb[data-zoom="overview"]');
      // a back that skipped a level has closed the window by now — that is the red, not a probe error
      const r5e = await evaluate<Read>(READ);
      claims[TL_CLAIM.zoom] = claims[TL_CLAIM.zoom]! && !!r5e && r5e.zoom === "overview" && r5e.tracks.length === wire.sessions.length;
      if (!r5e) { facts.zoom = { ...(facts.zoom as Record<string, unknown>), windowClosedEarly: true }; await openLens(); }

      // --- 6. the inspector on an error call, then on the pending call
      if (!errorCall) throw new Error("timeline DOM probe: the claude fixture has no error call");
      await click(`.tlev[data-id="${errorCall.id}"]`);
      const r6 = await read();
      await shot(`${width}-4-inspektor`);
      const f = r6.fields;
      const pendingMark = r6.marks.find((m) => m.status === "pending" && m.kind === "tool.call" && m.at === pendingCallAt && m.track !== claudeKey);
      let pendingResult = "";
      if (pendingMark) { await click(`.tlev[data-id="${pendingMark.id}"]`); pendingResult = (await read()).fields.Resultat ?? ""; }
      facts.inspect = { title: r6.inspectTitle, fields: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.slice(0, 60)])), pendingResult: pendingResult.slice(0, 60) };
      // --- 6b. the raw value folded, copyable (point 8): read on the error call's inspector
      await click(`.tlev[data-id="${errorCall.id}"]`);
      const r6b = await read();
      // the page runs on a plain-http origin where navigator.clipboard is undefined — plant one that
      // keeps its argument, so the claim reads WHAT was copied, not only that the button answered
      await evaluate(`Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__fleetCopied = String(t); return Promise.resolve(); } } })`);
      // the way a person takes it: the button is hidden while the fold is closed, the summary opens
      // it, only then is there a visible button to press (Kern-MAIN review of 9c96d400)
      const hiddenBefore = r6b.raw ? !r6b.raw.copyVisible : false;
      await tryClick(".tlraw summary");
      const opened = (await read()).raw;
      const copyVisible = !!opened?.open && !!opened.copyVisible;
      if (copyVisible) await tryClick(".tlraw .tlcopy");
      const copied = (await read()).raw?.copy ?? null;
      const copiedText = await evaluate<string | null>("window.__fleetCopied ?? null");
      const rec = errorCall.record, ref = errorCall.detailRef;
      const expectedRaw = [ref ? `${ref.locator} fp ${ref.fp}` : null,
        `Aufzeichnung ${rec.id ?? "?"}${rec.parent ? ` ← ${rec.parent}` : ""} · Bytes ${rec.offset} + ${rec.bytes} #${rec.block}`].filter((l) => l !== null).join("\n");
      facts.rawSource = { raw: r6b.raw ? { ...r6b.raw, code: r6b.raw.code.slice(0, 80) } : null, quelle: (r6b.fields.Quelle ?? "").slice(0, 80), hiddenBefore, copyVisible, copied,
        copiedText: (copiedText ?? "").slice(0, 80), expectedRaw: expectedRaw.slice(0, 80), copiedMatches: copiedText === expectedRaw };
      claims[TL_CLAIM.rawSource] = !!r6b.raw && r6b.raw.details && !r6b.raw.open && r6b.raw.summary.startsWith("Rohwert") && r6b.raw.code.includes("native:")
        && r6b.raw.code.includes(" fp ") && r6b.raw.code.includes("Bytes ") && r6b.raw.copy === "Kopieren" && hiddenBefore && copyVisible && copied === "Kopiert"
        && expectedRaw.includes("native:") && copiedText === expectedRaw
        && !(r6b.fields.Quelle ?? "").includes("native:") && !(r6b.fields.Quelle ?? "").includes("Bytes ") && (r6b.fields.Quelle ?? "").includes("Sidechain");
      claims[TL_CLAIM.inspect] = r6.inspectOpen && !!r6.inspectTitle?.startsWith("Aufruf") && ["Argumente", "Resultat", "Fehler", "Zeitpunkte", "Dauer", "Quelle"].every((k) => k in f)
        // the page carries no detail texts (the detail door is not read): not delivered, and said so
        && (f.Argumente ?? "").startsWith("nicht geliefert") && (f.Resultat ?? "").startsWith("nicht geliefert")
        && (f.Fehler ?? "").startsWith("Fehler laut Quelle, Text nicht geliefert") && (f.Zeitpunkte ?? "").includes("Aufzeichnung:") && (f.Zeitpunkte ?? "").includes("2026-01-01T00:00:02.000Z")
        && (f.Dauer ?? "").includes("Abstand der Aufzeichnungen") && (f.Dauer ?? "").includes("keine Laufzeit") && (f.Quelle ?? "").startsWith("claude") && (f.Quelle ?? "").includes("Sidechain")
        && pendingResult.startsWith("wartet");
      await click(".tliclose");

      // --- 7. keyboard: → walks the marks, Enter opens, Escape closes and returns focus
      if (!mobile) {
        await evaluate(`document.querySelector('.tlev')?.focus()`);
        const k0 = await read();
        await key("ArrowRight");
        const k1 = await read();
        await key("Enter");
        const k2 = await read();
        await key("Escape");
        const k3 = await read();
        facts.keys = { first: k0.focusId, next: k1.focusId, opened: k2.inspectOpen, focusAfterOpen: k2.focusClass, back: k3.focusId, closed: !k3.inspectOpen };
        claims[TL_CLAIM.keys] = !!k0.focusId && !!k1.focusId && k1.focusId !== k0.focusId && k2.inspectOpen && (k2.focusClass ?? "").includes("tliclose")
          && !k3.inspectOpen && k3.focusId === k1.focusId;
      } else {
        // the phone's keyboard path: Enter on a focused mark opens, the close button returns focus
        await evaluate(`document.querySelector('.tlev')?.focus()`);
        const k0 = await read();
        await key("Enter");
        const k2 = await read();
        await click(".tliclose");
        const k3 = await read();
        facts.keys = { first: k0.focusId, opened: k2.inspectOpen, back: k3.focusId };
        claims[TL_CLAIM.keys] = !!k0.focusId && k2.inspectOpen && !k3.inspectOpen && k3.focusId === k0.focusId;
      }

      // --- 8. touch-sized on the phone
      if (mobile) {
        const first = r1.marks[0];
        if (first) await click(`.tlev[data-id="${first.id}"]`);
        const t1 = await read();
        await click(".tliclose");
        await click("#shell-outcomes .shellback");
        const t2 = await read();
        facts.touch = { short: t1.shortControls.slice(0, 8), pageScroll: t1.pageScroll, canvasScroll: t1.canvasScroll, inspect: t1.inspectRect, detailmode: t1.detailmode, railAfterBack: t2.railVisible, railRows: t2.railRows };
        claims[TL_CLAIM.touch] = t1.shortControls.length === 0 && t1.pageScroll <= 0 && t1.canvasScroll <= 0 && !!t1.inspectRect
          && t1.inspectRect.w >= width - 2 && t1.inspectRect.h >= height * 0.6 && t1.detailmode && t2.railVisible && t2.railRows === wire.sessions.length;
        await click('#shell-outcomes .tlrow');
      }

      // --- 9. the bundle carries no fixture
      facts.bundle = { bytes: appJs.length };
      claims[TL_CLAIM.bundle] = !appJs.includes(NATIVE_CANARY) && !appJs.includes("trace-native-fixtures") && !appJs.includes("synthetic-host") && !appJs.includes("codex-ohne-zeit");

      // --- 10. without the route: the 404 named, no track
      await click("#shell-outcomes .shellclose");
      fx.route404 = true;
      await openLens();
      const r10 = await read();
      await shot(`${width}-5-keine-quelle`);
      facts.noRoute = { state: r10.state, text: r10.stateText.slice(0, 120), tracks: r10.tracks.length };
      claims[TL_CLAIM.noRoute] = r10.state === "unavailable" && r10.stateText.includes("404") && r10.stateText.includes("/api/timeline") && r10.tracks.length === 0 && r10.marks.length === 0;
      const routeNamed = (r10.stateText.match(/\/api\/timeline/g) ?? []).length;
      facts.emptyOne = { routeNamed, text: r10.stateText.slice(0, 160) };
      claims[TL_CLAIM.emptyOne] = routeNamed === 1 && r10.stateText.startsWith("Die Zeitleiste hat noch keine Quelle: GET /api/timeline antwortet 404 (no such route).");
      await click("#shell-outcomes .shellclose");

      // --- 10b. an answer of another form: the prototype wire this lens once read, then a page whose
      // first session lacks its occupation — each one sentence naming the field, no track, nothing thrown
      fx.route404 = false;
      const before = fx.exceptions.length;
      const proto = { schema: "fleet.timeline/v1", now: T + 3000, window: wire.window, ledger: [], horizon: [], next: null,
        sessions: [{ key: claudeKey, harness: "claude", host: HOST, label: "claude", slot: 1, openedAt: T, project: null, program: null, snapshot: { events: [] } }] };
      const { occupation: _gone, ...headless } = wire.sessions[0]!;
      const foreign: { name: string; field: string; read?: NonNullable<Read> }[] = [];
      for (const [name, body, field] of [["prototype", proto, "sessions[0].session"], ["missing", { ...wire, sessions: [headless, ...wire.sessions.slice(1)] }, "sessions[0].occupation"]] as const) {
        fx.foreign = body;
        await openLens();
        foreign.push({ name, field, read: await read() });
        await click("#shell-outcomes .shellclose");
      }
      fx.foreign = null;
      facts.foreign = { cases: foreign.map((c) => ({ name: c.name, state: c.read?.state, text: c.read?.stateText.slice(0, 200), tracks: c.read?.tracks.length })),
        exceptions: fx.exceptions.slice(before, before + 3) };
      claims[TL_CLAIM.foreign] = foreign.every((c) => !!c.read && c.read.state === "unavailable" && c.read.tracks.length === 0 && c.read.marks.length === 0
        && c.read.stateText.includes(`das Feld ${c.field} fehlt`) && (c.read.stateText.match(/\/api\/timeline/g) ?? []).length === 1)
        && fx.exceptions.length === before;

      // --- 11. a late answer of a closed window: open (answer held back, one session), close, open
      // again (answer at once, every session), let the late answer land, repaint — still every session
      fx.route404 = false; fx.delayMs = 1500; fx.narrow = true; fx.timelineHits = 0;
      await click('#morepanel [data-lens="timeline"]');
      await wait(`document.querySelector('#shell-outcomes .tlstate')`, 4000);
      fx.delayMs = 0; fx.narrow = false;
      await click("#shell-outcomes .shellclose");
      await openLens();
      await settle(2000);
      await click('.tlcrumb[data-zoom="overview"]');
      const r11 = await read();
      facts.stale = { hits: fx.timelineHits, tracks: r11.tracks.length, subtitle: r11.lens };
      claims[TL_CLAIM.stale] = fx.timelineHits === 2 && r11.tracks.length === wire.sessions.length && r11.marks.length >= 20;
      await click("#shell-outcomes .shellclose");
      results.push({ width, height, claims, facts });
    }
    return results;
  } finally {
    socket?.close();
    browser.kill();
    await browser.exited.catch(() => undefined);
    rmSync(scratch, { recursive: true, force: true });
  }
}
