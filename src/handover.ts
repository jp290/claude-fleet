// THE HANDOVER POPOVER (Neuaufbau K9 · S1, docs/neuaufbau/befunde/07-nachfolge.md). Owner 13.10.: „[Zitat entfernt]“
// , „[Zitat entfernt]“
// . Three controls, each with one sentence: the threshold as ONE click (a row of values
// instead of the ±5 stepper), the hint on or off, and „Neue Session jetzt“ on the owner door
// (POST /api/slots/:id/succeed, server.ts#handleOwnerSucceed) with what the successor gets — the door's
// own preview sentence (GET …/succeed → `says`, server/succession.ts#successorSentence).
// Every write redraws the line in place from what the client holds and then from the server's answer
// (HandoverView.repaint → board.ts#paintContextRow): no /brief and no column render per click.
// S2 (owner 13.10.: „[Zitat entfernt]“): the cache warm or
// cold with its minutes, Claude's compaction, the warm switch, and at a cold cache the button names
// what the successor continues from — the session's own handover or the raw transcript.
// S2b (owner 13.10.: „[Zitat entfernt]“
// ): while the switch is on, the minutes as one click
// and the text the warm turn types, with the fleet's own text as the way back.
// S3 (owner 13.10.: „[Zitat entfernt]“, „[Zitat entfernt]“
// ): the threshold row says where its base
// comes from and where the cap lies, a row „An der Schwelle“ picks what Fleet does then — the hint, Compact
// or a new session — and the Kontext line shows the threshold in force: the cap while the cache is warm.
import { api, el } from "./client";
import { serverClock } from "./composer";
import type { BriefSuccession } from "./board";

export interface HandoverView {
  slot: number; openedAt: number | undefined; sc: BriefSuccession;
  // redraws the Kontext line and this popover where they stand; false = the line is not on screen
  repaint: () => boolean;
  // a new session stands on the slot: the board closes the popover and reads the column anew
  succeeded: () => void;
}

// why a threshold cannot fire, in the owner's words — the switch's hover and the popover say the same
export const OFF_WHY: Record<NonNullable<BriefSuccession["thresholdOff"]>, string> = {
  fleet: "auf dieser Fleet nicht eingeschaltet",
  rail: "für diese Art Session auf 0 gestellt",
  harness: "dieser Agent hat kein Übergabeband",
  steward: "die Planungs-Session wird nicht erinnert",
  waiting: "sie wartet auf dich",
  unpinned: "kein festgehaltenes Gespräch zum Messen",
  session: "für diese Session ausgestellt, ohne Hinweis und ohne Übergabe",
};
// why no cache is kept warm here (server.ts#keepCacheExempt)
const WARM_OFF_WHY: Record<NonNullable<NonNullable<BriefSuccession["keepCache"]>["exempt"]>, string> = {
  steward: "die Planungs-Session wird nicht warm gehalten",
  lane: "eine Lane gibt mit ihrem Bericht weiter",
  harness: "dieser Agent hat keinen gemessenen Cache",
};
// the kind of session whose row of the threshold table applies (server/succession.ts#thresholdOf)
const KIND_WORDS: Record<NonNullable<BriefSuccession["kind"]>, string> = {
  orchestrator: "eine Orchestratorin", "program-main": "eine Program-MAIN", bau: "eine Bau-Session", lane: "eine Lane",
  session: "eine Session",
};
// what Fleet does at the threshold (server/succession.ts#choicesFor)
type Choice = NonNullable<BriefSuccession["atThreshold"]>;
const CHOICE_WORDS: Record<Choice, string> = { hint: "Hinweis", compact: "Compact", succeed: "Neue Session" };
// the values one click away, up to 70 (K9 S3c, owner 14.10.: „[Zitat entfernt]“
// , no 100); a value set elsewhere (5..95 in 5-steps, PATCH) joins the row where it falls
const THRESHOLDS = [25, 30, 35, 40, 45, 50, 55, 60, 65, 70];
// the warm turn's minutes the same way (5..55 in 5-steps, PATCH); eight values fit the popover's line
const MINUTES = [20, 25, 30, 35, 40, 45, 50, 55];
// the answer of the last write, shown at once while the brief is read again (the board's tick)
const FRESH_MS = 15_000;
// how old the door's preview may be while the popover stays open: it reads the transcript, so it is
// asked on opening and then at most this often — never on the board's 3 s tick
const PREVIEW_MS = 5_000;

const fresh = new Map<number, { openedAt: number | undefined; sc: BriefSuccession; at: number }>();
const writing = new Set<number>();
const succeeding = new Set<number>();
const errs = new Map<number, { text: string; title: string }>();
const previews = new Map<number, { openedAt: number | undefined; at: number; ready: boolean; says: string;
  source: "handover" | "transcript" | null }>();
const previewLoading = new Set<number>();
// the warm text being written, per slot — it survives every repaint until it is saved
const drafts = new Map<number, { openedAt: number | undefined; text: string }>();
// the newest render's repaint per slot: an answer that arrives after the board rebuilt the column
// redraws the line that stands now, not the one its click was drawn on
const repaints = new Map<number, () => boolean>();
// never under the caret (renderBoard's rule for the board's textareas): an answer that arrives while
// the warm text is being written is drawn by the next repaint after it
const typing = (): boolean => document.activeElement instanceof HTMLTextAreaElement && !!document.activeElement.closest(".ubpop");
const repaint = (slot: number): void => { if (!typing()) repaints.get(slot)?.(); };

export function freshSuccession(slot: number, openedAt: number | undefined): BriefSuccession | null {
  const f = fresh.get(slot);
  return f && f.openedAt === openedAt && Date.now() - f.at < FRESH_MS ? f.sc : null;
}

type HandoverWrite = { thresholdPct?: number | null; nudge?: boolean; keepCache?: boolean | null; keepCacheIdleMin?: number;
  keepCacheText?: string | null; atThreshold?: Choice | null };
// what the server will answer, drawn before it answers: the threshold, the hint, the warm switch, and
// the gate a threshold of 0 turns on or off — the session's own 0 is its „Aus“, a rail's 0 the rail's;
// the PATCH answer replaces it a moment later
function expected(sc: BriefSuccession, body: HandoverWrite): BriefSuccession {
  if (body.nudge !== undefined) return { ...sc, nudgeOn: body.nudge };
  if (body.atThreshold !== undefined) return { ...sc, atThreshold: body.atThreshold ?? sc.fleetChoice ?? "hint" };
  if (body.keepCache !== undefined) return sc.keepCache ? { ...sc, keepCache: { ...sc.keepCache,
    on: body.keepCache ?? sc.keepCache.fleetOn, from: body.keepCache === null ? "fleet" : "session" } } : sc;
  if (body.keepCacheIdleMin !== undefined) return sc.keepCache ? { ...sc, keepCache: { ...sc.keepCache, idleMin: body.keepCacheIdleMin } } : sc;
  if (body.keepCacheText !== undefined) return sc.keepCache ? { ...sc, keepCache: { ...sc.keepCache, text: body.keepCacheText } } : sc;
  const own = body.thresholdPct ?? null;
  const eff = own ?? sc.defaultPct;
  const gate = sc.thresholdOff && sc.thresholdOff !== "rail" && sc.thresholdOff !== "session" ? sc.thresholdOff
    : eff > 0 ? null : own === 0 ? "session" : "rail";
  return { ...sc, sessionPct: own, pctFrom: own === null ? "fleet" : "session", thresholdOff: gate, thresholdPct: gate ? null : eff,
    capPct: gate ? null : eff + CAP_GAP_PCT, thresholdFrom: own === null ? "fleet" : "session" };
}

// true = the server took it
async function write(v: HandoverView, body: HandoverWrite): Promise<boolean> {
  if (writing.has(v.slot)) return false;
  writing.add(v.slot);
  errs.delete(v.slot);
  const before = fresh.get(v.slot);
  fresh.set(v.slot, { openedAt: v.openedAt, sc: expected(v.sc, body), at: Date.now() });
  repaint(v.slot);
  try {
    const r = await api(`/api/slots/${v.slot}/handover`, { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedOpenedAt: v.openedAt, ...body }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string; succession?: BriefSuccession | null };
    if (!r.ok || !j.succession) throw new Error(j.error ?? `HTTP ${r.status}`);
    fresh.set(v.slot, { openedAt: v.openedAt, sc: j.succession, at: Date.now() });
    return true;
  } catch (error) {
    if (before) fresh.set(v.slot, before);
    else fresh.delete(v.slot);
    const why = error instanceof Error ? error.message : String(error);
    errs.set(v.slot, { text: `Nicht gespeichert — ${why}`, title: why });
    return false;
  } finally {
    writing.delete(v.slot);
    repaint(v.slot);
  }
}

async function loadPreview(slot: number, openedAt: number | undefined): Promise<void> {
  previewLoading.add(slot);
  try {
    const r = await api(`/api/slots/${slot}/succeed`);
    const j = (await r.json().catch(() => null)) as { ready?: boolean; says?: string; error?: string;
      source?: "handover" | "transcript" | null } | null;
    previews.set(slot, { openedAt, at: Date.now(), ready: r.ok && j?.ready === true,
      says: j?.says ?? `Fleet konnte nicht prüfen, ob sie gerade ruht (${j?.error ?? `HTTP ${r.status}`}).`, source: j?.source ?? null });
  } catch (error) {
    previews.set(slot, { openedAt, at: Date.now(), ready: false,
      says: `Fleet konnte nicht prüfen, ob sie gerade ruht (${error instanceof Error ? error.message : String(error)}).`, source: null });
  } finally {
    previewLoading.delete(slot);
    repaint(slot);
  }
}
function previewOf(v: HandoverView): { ready: boolean; says: string; source: "handover" | "transcript" | null } | null {
  const p = previews.get(v.slot);
  const mine = p && p.openedAt === v.openedAt ? p : null;
  if ((!mine || Date.now() - mine.at > PREVIEW_MS) && !previewLoading.has(v.slot) && !succeeding.has(v.slot))
    void loadPreview(v.slot, v.openedAt);
  return mine;
}

async function succeed(v: HandoverView): Promise<void> {
  if (succeeding.has(v.slot)) return;
  succeeding.add(v.slot);
  errs.delete(v.slot);
  repaint(v.slot);
  let ok = false;
  try {
    const r = await api(`/api/slots/${v.slot}/succeed`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedOpenedAt: v.openedAt }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
    ok = true;
  } catch (error) {
    // the door's preview says why in words once it is read again; the raw answer stays on hover
    errs.set(v.slot, { text: "Nicht weitergegeben, die laufende Session bleibt.", title: error instanceof Error ? error.message : String(error) });
  } finally {
    succeeding.delete(v.slot);
    previews.delete(v.slot);
    fresh.delete(v.slot);
  }
  if (ok) v.succeeded();
  else repaint(v.slot);
}

// the cache now, on the server's clock: the brief says warm or cold when it was read, the minutes run on
type CacheNow = { state: NonNullable<BriefSuccession["cache"]>["state"]; min: number | null };
function cacheNow(c: NonNullable<BriefSuccession["cache"]>): CacheNow {
  if ((c.state !== "warm" && c.state !== "kalt") || c.coldAt === null) return { state: c.state, min: null };
  const left = c.coldAt - serverClock();
  return left > 0 ? { state: "warm", min: Math.ceil(left / 60_000) } : { state: "kalt", min: Math.floor(-left / 60_000) };
}
// THE THRESHOLD IN FORCE NOW (§4: „52 % · Übergabe bei 50 % (warm)“): the cap while the cache is warm, the
// base once it is cold; without a cache reading, or from a server that sends no cap, the base alone
const CAP_GAP_PCT = 5;
export function handoverAt(sc: BriefSuccession): { pct: number; cache: "warm" | "kalt" | null } | null {
  if (sc.thresholdPct === null) return null;
  const cache = sc.cache ? cacheNow(sc.cache).state : null;
  if (cache === "warm" && sc.capPct != null) return { pct: sc.capPct, cache: "warm" };
  return { pct: sc.thresholdPct, cache: cache === "kalt" ? "kalt" : null };
}
const minText = (min: number): string => min < 1 ? "eben" : min < 90 ? `${min} min` : `${Math.round(min / 60)} h`;
const kTokens = (n: number): string => `${Math.round(n / 1000)}k`;
function compactionText(c: NonNullable<BriefSuccession["compaction"]>): string {
  const at = new Date(c.at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return `Von Claude kompaktiert ${at}${c.preTokens !== null && c.postTokens !== null ? `, ${kTokens(c.preTokens)} → ${kTokens(c.postTokens)}` : ""}.`;
}

function row(k: string, v: (Node | string)[], h: string, cls = ""): HTMLElement {
  const r = el("div", `pr${cls ? ` ${cls}` : ""}`);
  r.appendChild(el("span", "k", k));
  const vv = el("span", "pv");
  vv.append(...v);
  r.appendChild(vv);
  if (h) r.appendChild(el("span", "h", h));
  return r;
}
function button(text: string, cls: string, uk: string, title: string, run: () => void): HTMLButtonElement {
  const b = el("button", cls, text) as HTMLButtonElement;
  b.type = "button";
  b.dataset.uk = uk;
  b.title = title;
  b.onclick = run;
  return b;
}

export function handoverRows(v: HandoverView): HTMLElement[] {
  repaints.set(v.slot, v.repaint);
  const { sc } = v;
  // a gate that cannot fire takes no setting: the band is claude's, and without the fleet's master
  // switch no tick runs at all — the reason says which, the controls stay visible but quiet
  const locked = sc.thresholdOff === "fleet" || sc.thresholdOff === "harness" || sc.thresholdOff === "steward";
  const rows: HTMLElement[] = [];

  // the effective threshold; while a gate keeps it null, the owner's own value, else the rail's
  const cur = sc.thresholdPct ?? sc.sessionPct ?? sc.defaultPct;
  const values = cur > 0 && !THRESHOLDS.includes(cur) ? [...THRESHOLDS, cur].sort((a, b) => a - b) : THRESHOLDS;
  const pcts = el("span", "seg pcts");
  for (const pct of values) {
    const on = !locked && pct === cur;
    const own = on && sc.pctFrom === "session";
    const b = button(String(pct), `${on ? "on" : ""}${pct === sc.defaultPct ? " dflt" : ""}`.trim(), `pct-${pct}`,
      locked ? "Hier wirkt keine Schwelle, der Grund steht darunter"
        : own && pct !== sc.defaultPct ? `Eigene Schwelle dieser Session — noch einmal klicken: zurück auf ${sc.defaultPct > 0 ? `${sc.defaultPct} %` : "den Fleet-Wert"}`
        : pct === sc.defaultPct ? `${pct} % — der Wert der Fleet für diese Art Session`
        : `Bei ${pct} % weitergeben — nur diese Session`,
      () => {
        // the fleet's own value, or this session's own value pressed again, follows the fleet again
        const next = pct === sc.defaultPct || own ? null : pct;
        if (next === null ? sc.pctFrom === "fleet" : on) return;
        void write(v, { thresholdPct: next });
      });
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", `${pct} %`);
    b.disabled = locked;
    pcts.appendChild(b);
  }
  // „AUS“ (K9 S3c, owner 14.10.: „[Zitat entfernt]“): this session's own 0 — no hint, no act;
  // pressed again it follows the fleet again. Read from the value as set, so a gate above it does not hide it
  const off = sc.sessionPct === 0;
  const offSeg = el("span", "seg pctoff");
  const ob = button("Aus", off && !locked ? "on" : "", "pct-aus",
    locked ? "Hier wirkt keine Schwelle, der Grund steht darunter"
      : off ? `Die Übergabe ist für diese Session aus — noch einmal klicken: zurück auf ${sc.defaultPct > 0 ? `${sc.defaultPct} %` : "den Fleet-Wert"}`
      : "Die Übergabe für diese Session ausstellen: kein Hinweis, keine neue Session — nur diese Session",
    () => void write(v, { thresholdPct: off ? null : 0 }));
  ob.setAttribute("aria-pressed", String(off && !locked));
  ob.disabled = locked;
  offSeg.appendChild(ob);
  // the base and the cap in one sentence, and whose value it is (§4: „Fleet-Wert für eine Orchestratorin: 45 %,
  // solange der Cache warm ist 50 %“)
  const band = sc.thresholdPct !== null && sc.capPct != null
    ? `Hinweis ab ${sc.thresholdPct} %, Übergabe bei ${sc.capPct} %, solange der Cache warm ist` : null;
  rows.push(row("Schwelle", [pcts, el("span", "unit", "%"), offSeg],
    sc.thresholdOff && sc.thresholdOff !== "rail" ? `Aus: ${OFF_WHY[sc.thresholdOff]}.`
      : sc.defaultPct <= 0 && sc.pctFrom === "fleet" ? "Für diese Art Session steht keine Schwelle. Eine Wahl gilt nur hier."
      : sc.pctFrom === "session" ? `Eigener Wert dieser Session${band ? `: ${band}` : ""}${sc.defaultPct > 0 ? `; die Fleet steht auf ${sc.defaultPct} %` : ""}.`
      : band ? `Fleet-Wert für ${sc.kind ? KIND_WORDS[sc.kind] : "diese Art Session"}: ${band}.`
      : `Ab hier gibt sie an eine frische Session weiter; die Fleet steht auf ${sc.defaultPct} %.`,
    "wide"));

  const seg = el("span", "seg");
  for (const [on, word] of [[true, "An"], [false, "Aus"]] as const) {
    const b = button(word, sc.nudgeOn === on ? "on" : "", `nudge-${on ? "an" : "aus"}`,
      on ? "Fleet schreibt dieser Session an der Schwelle einen Hinweis" : "Fleet schreibt dieser Session keinen Hinweis — sie gibt nur weiter, wenn sie selbst entscheidet",
      () => { if (sc.nudgeOn !== on) void write(v, { nudge: on }); });
    b.setAttribute("aria-pressed", String(sc.nudgeOn === on));
    b.disabled = locked;
    seg.appendChild(b);
  }
  const given = sc.gaveUp ? `Aufgehört nach ${sc.nudges}.` : sc.nudges ? `Bisher ${sc.nudges}.` : "Bisher keiner.";
  rows.push(row("Hinweis", [seg], `An der Schwelle, höchstens ${sc.maxNudges}-mal. ${given}`));

  const cache = sc.cache ? cacheNow(sc.cache) : null;
  if (cache) {
    const word = (w: string): HTMLElement => el("b", "", w);
    rows.push(row("Cache",
      cache.state === "warm" ? [word("warm"), ` · noch ${minText(cache.min ?? 0)}`]
        : cache.state === "kalt" ? [word("kalt"), ` seit ${minText(cache.min ?? 0)}`]
        : cache.state === "kompaktiert" ? [word("kompaktiert")] : ["unbekannt"],
      sc.compaction ? compactionText(sc.compaction)
        : cache.state === "kalt" ? "Der nächste Turn schreibt den ganzen Kontext neu."
        : cache.state === "unbekannt" ? "Fleet hat noch keinen Modellaufruf gelesen." : ""));
  }

  const kc = sc.keepCache;
  if (kc) {
    const warmSeg = el("span", "seg");
    for (const [on, word] of [[true, "An"], [false, "Aus"]] as const) {
      const shown = !kc.exempt && kc.on === on;
      const b = button(word, `${shown ? "on" : ""}${!kc.exempt && kc.fleetOn === on ? " dflt" : ""}`.trim(), `warm-${on ? "an" : "aus"}`,
        kc.exempt ? "Hier wird kein Cache warm gehalten, der Grund steht darunter"
          : kc.fleetOn === on ? `${word} — der Wert der Fleet für diese Art Session`
          : on ? "Den Cache dieser Session warm halten — nur diese Session" : "Diese Session nicht warm halten — nur diese Session",
        // the fleet's value takes the session back to the fleet: no own record is kept
        () => { if (kc.on !== on) void write(v, { keepCache: kc.fleetOn === on ? null : on }); });
      b.setAttribute("aria-pressed", String(shown));
      b.disabled = !!kc.exempt;
      warmSeg.appendChild(b);
    }
    rows.push(row("Warmhalten", [warmSeg], kc.exempt ? `Aus: ${WARM_OFF_WHY[kc.exempt]}.`
      : kc.on ? `Nach ${kc.idleMin} min Ruhe ein kurzer Turn, höchstens ${kc.hourCap}-mal pro Stunde. ${kc.warmTurns ? `Bisher ${kc.warmTurns}.` : "Bisher keiner."}`
      : `Der Cache verfällt ${kc.lifetimeMin} min nach dem letzten Modellaufruf.`));
    if (kc.on && !kc.exempt) rows.push(...warmRows(v, kc));
  }

  // AN DER SCHWELLE (S3b): what Fleet does once the cap is reached or the cache is about to go cold — the hint
  // only, Compact, or a new session, the fleet's value marked; a lane has no new session
  const choices = sc.choices ?? [];
  if (choices.length > 1) {
    // the fleet's value is marked and written as null (S3b-2: a new session, a lane the hint; an older server: the hint)
    const fleet = sc.fleetChoice ?? "hint";
    const now = sc.atThreshold ?? fleet;
    const cseg = el("span", "seg choices");
    for (const c of choices) {
      const b = button(CHOICE_WORDS[c], `${c === now && !locked ? "on" : ""}${c === fleet ? " dflt" : ""}`.trim(), `at-${c}`,
        c === fleet ? `${CHOICE_WORDS[c]} — der Wert der Fleet` : `${CHOICE_WORDS[c]} an der Schwelle — nur diese Session`,
        () => { if (c !== now) void write(v, { atThreshold: c === fleet ? null : c }); });
      b.setAttribute("aria-pressed", String(c === now && !locked));
      b.disabled = locked;
      cseg.appendChild(b);
    }
    const when = sc.capPct != null ? `Ab ${sc.capPct} % oder kurz vor kaltem Cache` : "Wenn es so weit ist";
    const what = now === "compact" ? `${when} tippt Fleet /compact, sobald sie ruht.`
      : now === "succeed" ? `${when} öffnet Fleet eine neue Session, sobald sie ruht.`
      : "Nur der Hinweis; die Session wählt den Punkt selbst.";
    const last = sc.act ? ` Zuletzt ${new Date(sc.act.at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}: ${CHOICE_WORDS[sc.act.act]}, ${sc.act.outcome}.` : "";
    rows.push(row("An der Schwelle", [cseg], locked ? "Hier wirkt keine Schwelle."
      : sc.thresholdOff === "session" ? `Die Übergabe ist für diese Session aus.${last}` : `${what}${last}`, "wide"));
  }

  const p = previewOf(v);
  const going = succeeding.has(v.slot);
  // AT A COLD CACHE the button continues the work in a fresh session and names its source; the old
  // session gets no turn either way (server.ts#handleOwnerSucceed)
  const cold = cache?.state === "kalt";
  const go = button(going ? "Wird geöffnet …" : cold ? "In neuer Session fortsetzen" : "Neue Session jetzt", "bbtn", "succeed",
    `${cold ? "Der Cache ist kalt. " : ""}Eine frische Session im selben Slot. Die laufende bekommt keinen Turn mehr; ihr Gespräch bleibt lesbar.`,
    () => void succeed(v));
  go.disabled = going || !p?.ready;
  const source = cold && p?.ready && p.source ? `Quelle: ${p.source === "handover" ? "Fleet-Übergabe" : "rohes Transkript"}. ` : "";
  rows.push(row("Nachfolge", [go], going ? "Die laufende Session endet, die neue startet mit ihrem Brief."
    : p ? `${source}${p.says}` : "Fleet prüft, ob sie gerade ruht …", "wide"));

  const err = errs.get(v.slot);
  if (err) {
    const e = el("div", "perr", err.text);
    e.title = err.title;
    rows.push(e);
  }
  return rows;
}

// THE WARM TURN'S MINUTES AND TEXT (S2b): the minutes one click away like the threshold, the fleet's
// value marked; the text in a field whose draft outlives every repaint, „Sichern“ while it differs
// from the saved one, „Fleet-Standard“ while the session has its own
function warmRows(v: HandoverView, kc: NonNullable<BriefSuccession["keepCache"]>): HTMLElement[] {
  const fleetMin = kc.fleetIdleMin ?? 50;
  const values = MINUTES.includes(kc.idleMin) ? MINUTES : [...MINUTES, kc.idleMin].sort((a, b) => a - b);
  const mins = el("span", "seg mins");
  for (const m of values) {
    const on = m === kc.idleMin;
    const b = button(String(m), `${on ? "on" : ""}${m === fleetMin ? " dflt" : ""}`.trim(), `idle-${m}`,
      m === fleetMin ? `${m} min — der Wert der Fleet` : `Nach ${m} min Ruhe warm halten — nur diese Session`,
      () => { if (!on) void write(v, { keepCacheIdleMin: m }); });
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", `${m} min`);
    mins.appendChild(b);
  }
  const minRow = row("Nach", [mins, el("span", "unit", "min")],
    kc.idleMin === fleetMin ? "" : `Eigener Wert dieser Session; die Fleet steht auf ${fleetMin} min.`, "wide");

  const saved = kc.text ?? "";
  const d = drafts.get(v.slot);
  const ta = document.createElement("textarea");
  ta.className = "pta";
  ta.dataset.uk = "wtext";
  ta.rows = 3;
  ta.maxLength = kc.textMax ?? 500;
  ta.placeholder = kc.fleetText ?? "";
  ta.value = d && d.openedAt === v.openedAt ? d.text : saved;
  ta.setAttribute("aria-label", "Text des Warm-Turns");
  const save = button("Sichern", "bbtn quiet", "wtext-save", "Diesen Text tippt Fleet bei jedem Warm-Turn dieser Session", () => {
    const text = ta.value;
    drafts.delete(v.slot);
    void write(v, { keepCacheText: text.trim() || null }).then((ok) => {
      if (!ok) { drafts.set(v.slot, { openedAt: v.openedAt, text }); repaint(v.slot); }
    });
  });
  const fleet = button("Fleet-Standard", "bbtn quiet", "wtext-fleet", "Zurück auf den Text der Fleet", () => {
    drafts.delete(v.slot);
    void write(v, { keepCacheText: null });
  });
  fleet.hidden = !saved;
  const sync = (): void => { save.hidden = ta.value.trim() === saved; };
  ta.addEventListener("input", () => { drafts.set(v.slot, { openedAt: v.openedAt, text: ta.value }); sync(); });
  sync();
  const textRow = row("Text", [ta, save, fleet],
    saved ? "Eigener Text dieser Session, bei jedem Warm-Turn." : "Leer: der Text der Fleet, die Session antwortet nur „ok“.", "wide");
  return [minRow, textRow];
}
