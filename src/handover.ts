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
};
// why no cache is kept warm here (server.ts#keepCacheExempt)
const WARM_OFF_WHY: Record<NonNullable<NonNullable<BriefSuccession["keepCache"]>["exempt"]>, string> = {
  steward: "die Planungs-Session wird nicht warm gehalten",
  lane: "eine Lane gibt mit ihrem Bericht weiter",
  harness: "dieser Agent hat keinen gemessenen Cache",
};
// the values one click away; a value set elsewhere (5..95 in 5-steps, PATCH) joins the row where it falls
const THRESHOLDS = [25, 30, 35, 40, 45, 50, 55, 60];
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
// the newest render's repaint per slot: an answer that arrives after the board rebuilt the column
// redraws the line that stands now, not the one its click was drawn on
const repaints = new Map<number, () => boolean>();
const repaint = (slot: number): void => { repaints.get(slot)?.(); };

export function freshSuccession(slot: number, openedAt: number | undefined): BriefSuccession | null {
  const f = fresh.get(slot);
  return f && f.openedAt === openedAt && Date.now() - f.at < FRESH_MS ? f.sc : null;
}

type HandoverWrite = { thresholdPct?: number | null; nudge?: boolean; keepCache?: boolean | null };
// what the server will answer, drawn before it answers: the threshold, the hint, the warm switch, and
// the gate a threshold of 0 turns on or off; the PATCH answer replaces it a moment later
function expected(sc: BriefSuccession, body: HandoverWrite): BriefSuccession {
  if (body.nudge !== undefined) return { ...sc, nudgeOn: body.nudge };
  if (body.keepCache !== undefined) return sc.keepCache ? { ...sc, keepCache: { ...sc.keepCache,
    on: body.keepCache ?? sc.keepCache.fleetOn, from: body.keepCache === null ? "fleet" : "session" } } : sc;
  const own = body.thresholdPct ?? null;
  const eff = own ?? sc.defaultPct;
  const gate = sc.thresholdOff && sc.thresholdOff !== "rail" ? sc.thresholdOff : eff > 0 ? null : "rail";
  return { ...sc, sessionPct: own, pctFrom: own === null ? "fleet" : "session", thresholdOff: gate, thresholdPct: gate ? null : eff };
}

async function write(v: HandoverView, body: HandoverWrite): Promise<void> {
  if (writing.has(v.slot)) return;
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
  } catch (error) {
    if (before) fresh.set(v.slot, before);
    else fresh.delete(v.slot);
    const why = error instanceof Error ? error.message : String(error);
    errs.set(v.slot, { text: `Nicht gespeichert — ${why}`, title: why });
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
  rows.push(row("Übergabe bei", [pcts, el("span", "unit", "%")],
    sc.thresholdOff && sc.thresholdOff !== "rail" ? `Aus: ${OFF_WHY[sc.thresholdOff]}.`
      : sc.defaultPct <= 0 && sc.pctFrom === "fleet" ? "Für diese Art Session steht keine Schwelle. Eine Wahl gilt nur hier."
      : `${sc.pctFrom === "session" ? "Eigener Wert dieser Session" : "Ab hier gibt sie an eine frische Session weiter"}${sc.defaultPct > 0 ? `; die Fleet steht auf ${sc.defaultPct} %` : ""}.`,
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
