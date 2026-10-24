// THE HANDOVER BLOCK (Neuaufbau K16, auftraege/uebergabe-b-englisch.md), drawn from src/handover-now.ts#flowSteps. Owner 16.10.
// 18:2x: „[Zitat entfernt]“ — so each control stands at the one line it
// changes, and only while the block is open: the threshold and Nudge · Off at the nudge, the warm switch at the cache, and
// „Now“ last. Once Fleet nudged, a new threshold is also told to the session (Z50); „[Zitat entfernt]“ nudges the session while
// its cache is warm, and once it is cold „New session from summary“ (the owner door, by force; Runde C, owner 16.10. 21:1x)
// starts a fresh one with the agent, model and effort picked here — the old session is not loaded again.
// Every write redraws the block in place from what the client holds and then from the server's answer
// (HandoverView.repaint → board.ts#paintHandover): no /brief and no column render per click.
import { agentHarnesses, api, el, fleet, harnesses, loadHarnesses, post } from "./client";
import { serverClock } from "./composer";
import type { BriefSuccession } from "./board";
import { CAP_GAP_PCT, OFF_WHY, PLAN_WORDS, cacheNow, choiceOf, clockText, flowSteps, handoverDoesNothing, laterText, lockedGate,
  nowText, planOf, planWrite, type Choice, type Plan, type Step } from "./handover-now";
export { OFF_WHY, handoverDoesNothing };

export interface HandoverView {
  slot: number; openedAt: number | undefined; sc: BriefSuccession; lane: boolean;
  // when this occupant last wrote its standing handover (the sessions row)
  handoverAt?: number;
  // the controls stand at their lines; false = the lines alone
  open: boolean;
  // redraws the Context line and this block where they stand; false = they are not on screen
  repaint: () => boolean;
  // a new session stands on the slot: the board closes the block and reads the column anew
  succeeded: () => void;
}

// the values one click away, up to 70 (K9 S3c, owner 14.10.); a value set elsewhere (5..95 in 5-steps, PATCH) joins the row
const THRESHOLDS = [25, 30, 35, 40, 45, 50, 55, 60, 65, 70];
// the warm turn's minutes the same way (5..55 in 5-steps, PATCH)
const MINUTES = [20, 25, 30, 35, 40, 45, 50, 55];
// the answer of the last write, shown at once while the brief is read again (the board's tick)
const FRESH_MS = 15_000;
// how old the owner door's preview may be while the block stays open: it reads the transcript, so it is asked on
// opening and then at most this often — never on the board's 3 s tick
const PREVIEW_MS = 5_000;

const fresh = new Map<number, { openedAt: number | undefined; sc: BriefSuccession; at: number }>();
const writing = new Set<number>();
const succeeding = new Set<number>();
// the last answer per slot, in a few words: an error, or what was typed into the session and when
const notes = new Map<number, { openedAt: number | undefined; text: string; title: string; err: boolean }>();
const previews = new Map<number, { openedAt: number | undefined; at: number; ready: boolean; says: string }>();
// the agent, model and effort picked for „New session from summary“, per occupant; absent = the session's own
type SpawnPick = { harness: string; model: string; effort: string };
const picks = new Map<number, { openedAt: number | undefined; pick: SpawnPick }>();
const previewLoading = new Set<number>();
// the newest render's repaint per slot: an answer that arrives after the board rebuilt the column redraws the block that
// stands now, not the one its click was drawn on
const repaints = new Map<number, () => boolean>();
const repaint = (slot: number): void => { repaints.get(slot)?.(); };
const note = (v: HandoverView, text: string, err = false, title = text): void => {
  notes.set(v.slot, { openedAt: v.openedAt, text, title, err });
};

export function freshSuccession(slot: number, openedAt: number | undefined): BriefSuccession | null {
  const f = fresh.get(slot);
  return f && f.openedAt === openedAt && Date.now() - f.at < FRESH_MS ? f.sc : null;
}

type HandoverWrite = { thresholdPct?: number | null; nudge?: boolean; keepCache?: boolean | null; keepCacheIdleMin?: number;
  atThreshold?: Choice | null };
// what the server will answer, drawn before it answers — every field the write carries; the gate a threshold of 0 turns
// on or off: the session's own 0 is its „Off“, a rail's 0 the rail's. The PATCH answer replaces it a moment later
function expected(sc: BriefSuccession, body: HandoverWrite): BriefSuccession {
  let s = sc;
  if (body.nudge !== undefined) s = { ...s, nudgeOn: body.nudge };
  if (body.atThreshold !== undefined) s = { ...s, atThreshold: body.atThreshold ?? s.fleetChoice ?? "hint" };
  const kc = s.keepCache;
  if (kc && body.keepCache !== undefined) s = { ...s, keepCache: { ...kc, on: body.keepCache ?? kc.fleetOn, from: body.keepCache === null ? "fleet" : "session" } };
  if (s.keepCache && body.keepCacheIdleMin !== undefined) s = { ...s, keepCache: { ...s.keepCache, idleMin: body.keepCacheIdleMin } };
  if (body.thresholdPct !== undefined) {
    const own = body.thresholdPct;
    const eff = own ?? s.defaultPct;
    const gate = lockedGate(s) ? s.thresholdOff : eff > 0 ? null : own === 0 ? "session" : s.thresholdFrom === "setup" || s.thresholdOff === "setup" ? "setup" : "rail";
    s = { ...s, sessionPct: own, pctFrom: own === null ? "fleet" : "session", thresholdOff: gate, thresholdPct: gate ? null : eff,
      capPct: gate ? null : eff + CAP_GAP_PCT, thresholdFrom: own === null ? "fleet" : "session" };
  }
  return s;
}

// true = the server took it
async function write(v: HandoverView, body: HandoverWrite): Promise<boolean> {
  if (writing.has(v.slot)) return false;
  writing.add(v.slot);
  notes.delete(v.slot);
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
    note(v, "Not saved.", true, error instanceof Error ? error.message : String(error));
    return false;
  } finally {
    writing.delete(v.slot);
    repaint(v.slot);
  }
}

// a sentence typed into this occupant once it is free (POST /send whenFree, bound to its openedAt)
async function tell(v: HandoverView, text: string, said: string): Promise<void> {
  try {
    const r = await post("/send", { slot: v.slot, text, whenFree: true, ...(v.openedAt ? { openedAt: v.openedAt } : {}) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
    note(v, `${said} ${clockText(serverClock(), serverClock())}.`, false, text);
  } catch (error) {
    note(v, "Not sent to the session.", true, error instanceof Error ? error.message : String(error));
  }
  repaint(v.slot);
}

async function loadPreview(slot: number, openedAt: number | undefined): Promise<void> {
  previewLoading.add(slot);
  try {
    const r = await api(`/api/slots/${slot}/succeed`);
    const j = (await r.json().catch(() => null)) as { ready?: boolean; says?: string; error?: string } | null;
    previews.set(slot, { openedAt, at: Date.now(), ready: r.ok && j?.ready === true, says: j?.says ?? j?.error ?? `HTTP ${r.status}` });
  } catch (error) {
    previews.set(slot, { openedAt, at: Date.now(), ready: false, says: error instanceof Error ? error.message : String(error) });
  } finally {
    previewLoading.delete(slot);
    repaint(slot);
  }
}
function previewOf(v: HandoverView): { ready: boolean; says: string } | null {
  const p = previews.get(v.slot);
  const mine = p && p.openedAt === v.openedAt ? p : null;
  if ((!mine || Date.now() - mine.at > PREVIEW_MS) && !previewLoading.has(v.slot) && !succeeding.has(v.slot))
    void loadPreview(v.slot, v.openedAt);
  return mine;
}

async function succeed(v: HandoverView, pick: SpawnPick): Promise<void> {
  if (succeeding.has(v.slot)) return;
  succeeding.add(v.slot);
  notes.delete(v.slot);
  repaint(v.slot);
  let ok = false;
  try {
    // "" is the agent's own default (server/succession.ts#successorSpawnOf)
    const r = await post(`/api/slots/${v.slot}/succeed`, { expectedOpenedAt: v.openedAt, harness: pick.harness,
      model: pick.model || null, effort: pick.effort || null });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
    ok = true;
  } catch (error) {
    note(v, "No new session; this one keeps running.", true, error instanceof Error ? error.message : String(error));
  } finally {
    succeeding.delete(v.slot);
    previews.delete(v.slot);
    fresh.delete(v.slot);
    if (ok) picks.delete(v.slot);
  }
  if (ok) v.succeeded();
  else repaint(v.slot);
}

// the session's own agent, model and effort, then what the owner picked here for this occupant
function pickOf(v: HandoverView): SpawnPick {
  const own = picks.get(v.slot);
  if (own && own.openedAt === v.openedAt) return own.pick;
  const s = fleet.find((x) => x.id === v.slot);
  return { harness: s?.harness ?? harnesses.find((h) => h.default)?.id ?? "claude", model: s?.model ?? "", effort: s?.effort ?? "" };
}
function choose(label: string, uk: string, options: { value: string; text: string }[], value: string, run: (v: string) => void): HTMLElement {
  const sel = el("select", "pick") as HTMLSelectElement;
  sel.dataset.uk = uk;
  sel.setAttribute("aria-label", label);
  const list = options.some((o) => o.value === value) ? options : [...options, { value, text: value }];
  for (const o of list) {
    const opt = el("option", "", o.text) as HTMLOptionElement;
    opt.value = o.value;
    opt.selected = o.value === value;
    sel.appendChild(opt);
  }
  sel.onchange = () => run(sel.value);
  const w = el("label", "pickw");
  w.append(el("span", "unit", label), sel);
  return w;
}
// „New session from summary“: agent, model and effort — a model or an effort the agent does not list is still offered as it
// stands, „default“ is the agent's own; switching the agent starts from its defaults (server/succession.ts#successorSpawnOf)
function spawnPicker(v: HandoverView): HTMLElement {
  if (!harnesses.length) void loadHarnesses().then(() => repaint(v.slot));
  const pick = pickOf(v);
  const set = (next: SpawnPick): void => { picks.set(v.slot, { openedAt: v.openedAt, pick: next }); repaint(v.slot); };
  const agents = agentHarnesses();
  const h = harnesses.find((x) => x.id === pick.harness);
  const line = el("span", "picks");
  line.append(choose("Agent", "new-agent", (agents.length ? agents : [{ id: pick.harness }]).map((a) => ({ value: a.id, text: a.id })),
    pick.harness, (id) => set({ harness: id, model: "", effort: "" })));
  if (!h || h.supports.model)
    line.append(choose("Model", "new-model", [{ value: "", text: "default" }, ...(h?.models ?? []).map((m) => ({ value: m, text: m }))],
      pick.model, (m) => set({ ...pick, model: m })));
  if (!h || h.supports.effort)
    line.append(choose("Effort", "new-effort", [{ value: "", text: "default" }, ...(h?.effortLevels ?? []).map((e) => ({ value: e, text: e }))],
      pick.effort, (e) => set({ ...pick, effort: e })));
  return line;
}

// THE THRESHOLD AS CLICKED, AND HOW FAR IT REACHES NOW (Mangel 76): `pct` is where Fleet nudges; while the cache is warm the
// session has up to the cap; once it is cold Fleet types nothing and acts itself only at the cap (Runde C,
// server/succession.ts#actDecision „cold-offer“), so the cap stays where Fleet acts there and is gone where it does not
// (a lane); without a cache reading, or from a server that sends no cap, the base alone. null = no handover comes: no
// threshold, or the nudge off with nothing at the cap (Mangel 76b)
export function handoverAt(sc: BriefSuccession): { pct: number; cache: "warm" | "kalt" | null; cap: number | null } | null {
  if (sc.thresholdPct === null || handoverDoesNothing(sc)) return null;
  const cache = sc.cache ? cacheNow(sc.cache, serverClock()).state : null;
  if (cache === "warm" && sc.capPct != null) return { pct: sc.thresholdPct, cache: "warm", cap: sc.capPct };
  if (cache === "kalt" && sc.capPct != null && choiceOf(sc) !== "hint") return { pct: sc.thresholdPct, cache: "kalt", cap: sc.capPct };
  return { pct: sc.thresholdPct, cache: cache === "kalt" ? "kalt" : null, cap: null };
}
function button(text: string, cls: string, uk: string, title: string, run: () => void): HTMLButtonElement {
  const b = el("button", cls, text) as HTMLButtonElement;
  b.type = "button";
  b.dataset.uk = uk;
  b.title = title;
  b.onclick = run;
  return b;
}
// a row of buttons, one of them on; disabled ones still show which is set
function seg(cls: string, items: { text: string; uk: string; on: boolean; dflt: boolean; title: string; run: () => void; label?: string; d?: boolean }[],
  disabled: boolean): HTMLElement {
  const s = el("span", `seg${cls ? ` ${cls}` : ""}`);
  for (const it of items) {
    const b = button(it.text, `${it.on ? "on" : ""}${it.dflt ? " dflt" : ""}`.trim(), it.uk, it.title, it.run);
    b.setAttribute("aria-pressed", String(it.on));
    if (it.label) b.setAttribute("aria-label", it.label);
    b.disabled = disabled || !!it.d;
    s.appendChild(b);
  }
  return s;
}
// ONE LINE: when · what (and where the fill stands), the grey note under it, the explanation behind ⓘ and on hover
function stepEl(st: Step): HTMLElement {
  const r = el("div", `st${st.grey ? " grey" : ""}`);
  r.dataset.st = st.id;
  r.title = st.tip;
  const what = el("span", "pv", st.what);
  if (st.status) what.appendChild(el("span", "stat", st.status));
  r.append(el("span", "k", st.when), what);
  if (st.why) r.appendChild(el("span", "why", st.why));
  r.appendChild(el("span", "x", st.tip));
  return r;
}
function controls(...kids: (Node | string)[]): HTMLElement {
  const c = el("div", "c");
  c.append(...kids);
  return c;
}
function noteEl(n: { text: string; title: string; err: boolean }): HTMLElement {
  const e = el("div", n.err ? "perr" : "pnote", n.text);
  e.title = n.title;
  return e;
}

export function handoverFlow(v: HandoverView): HTMLElement[] {
  repaints.set(v.slot, v.repaint);
  const { sc } = v;
  const now = serverClock();
  const steps = flowSteps(sc, { now, lane: v.lane, handoverAt: v.handoverAt });
  const out = steps.map(stepEl);
  const at = (id: Step["id"]): HTMLElement | undefined => out[steps.findIndex((s) => s.id === id)];
  const mine = notes.get(v.slot);
  const shown = mine && mine.openedAt === v.openedAt ? mine : null;
  if (!v.open) {
    if (shown) out.push(noteEl(shown));
    return out;
  }

  // THE THRESHOLD: where Fleet nudges, and Nudge · Off. Once Fleet nudged and the fill passed the threshold, a later value is
  // also typed into the session (owner Z50); a value at or under the fill is no longer one to pick then
  const locked = lockedGate(sc);
  const thStep = at("nudge") ?? at("off");
  if (thStep && sc.thresholdOff !== "harness") {
    const plan = planOf(sc);
    const cur = plan === "off" ? null : sc.thresholdPct ?? sc.sessionPct ?? (sc.defaultPct > 0 ? sc.defaultPct : null);
    const fill = sc.fill?.pct ?? null;
    const later = !!sc.nudges && fill !== null && cur !== null && fill >= cur;
    const values = cur !== null && !THRESHOLDS.includes(cur) ? [...THRESHOLDS, cur].sort((a, b) => a - b) : THRESHOLDS;
    const pcts = seg("pcts", values.map((pct) => {
      const on = pct === cur;
      const own = on && sc.pctFrom === "session";
      return { text: String(pct), uk: `pct-${pct}`, on, dflt: pct === sc.defaultPct, label: `${pct} %`,
        d: later && fill !== null && pct <= fill,
        title: locked ? "Nothing to set here, the reason is on the line"
          : later ? `Nudge at ${pct} % instead — the session is told`
          : own && pct !== sc.defaultPct ? `This session's own value — click again for the Fleet value (${sc.defaultPct} %)`
          : pct === sc.defaultPct ? `${pct} % — the Fleet value` : `Nudge at ${pct} % — this session only`,
        run: () => {
          // the fleet's own value, or this session's own value pressed again, follows the fleet again
          const next = pct === sc.defaultPct || own ? null : pct;
          if (next === null ? sc.pctFrom === "fleet" && sc.sessionPct !== 0 : on) return;
          void write(v, { thresholdPct: next }).then((ok) => {
            if (ok && later) void tell(v, laterText(pct, choiceOf(sc), v.lane), `Told the session: ${pct} %, at`);
          });
        } };
    }), locked);
    const plans = seg("plans", (["nudge", "off"] as Plan[]).map((p) => ({ text: PLAN_WORDS[p], uk: `plan-${p}`, on: p === plan, dflt: p === "nudge",
      title: p === "nudge" ? "Fleet nudges the session once to succeed (the Fleet value)" : "Fleet won't nudge or step in — this session only",
      run: () => { if (p !== plan) void write(v, planWrite(sc, p)); } })), locked);
    const line = el("div", "cl");
    line.append(pcts, el("span", "unit", "%"), plans);
    thStep.appendChild(controls(line));
  }

  // THE CACHE: keep it warm or not, and after how many idle minutes
  const kc = sc.keepCache;
  const cacheStep = at("cache");
  if (kc && !kc.exempt && cacheStep) {
    const line = el("div", "cl");
    line.append(el("span", "unit", "Keep warm"), seg("warm", ([[true, "On"], [false, "Off"]] as const).map(([on, word]) => ({
      text: word, uk: `warm-${on ? "on" : "off"}`, on: kc.on === on, dflt: kc.fleetOn === on,
      title: kc.fleetOn === on ? `${word} — the Fleet value for this kind of session` : `${word} — this session only`,
      // the fleet's value takes the session back to the fleet: no own record is kept
      run: () => { if (kc.on !== on) void write(v, { keepCache: kc.fleetOn === on ? null : on }); } })), false));
    if (kc.on) {
      const fleetMin = kc.fleetIdleMin ?? 50;
      const values = MINUTES.includes(kc.idleMin) ? MINUTES : [...MINUTES, kc.idleMin].sort((a, b) => a - b);
      // „after … min“ wraps as one piece: the word never ends a line apart from its minutes
      const after = el("span", "clafter");
      after.append(el("span", "unit", "after"), seg("mins", values.map((m) => ({ text: String(m), uk: `idle-${m}`, on: m === kc.idleMin,
        dflt: m === fleetMin, label: `${m} min`, title: m === fleetMin ? `${m} min — the Fleet value` : `After ${m} min idle — this session only`,
        run: () => { if (m !== kc.idleMin) void write(v, { keepCacheIdleMin: m }); } })), false), el("span", "unit", "min"));
      line.appendChild(after);
    }
    cacheStep.appendChild(controls(line));
  }

  // NOW, BY HAND: while the cache is warm, nudge the session to hand over at once; once it is cold, a new session from a
  // summary (the owner door, server.ts#handleOwnerSucceed: the old session gets no turn and is not loaded again). A lane
  // hands over with its report, never by force, so it keeps the nudge
  const cold = sc.cache ? cacheNow(sc.cache, now).state === "kalt" : false;
  const hand = el("div", "st");
  hand.dataset.st = "now";
  const pv = el("span", "pv cl");
  if (cold && !v.lane) {
    const p = previewOf(v);
    const going = succeeding.has(v.slot);
    const pick = pickOf(v);
    pv.appendChild(spawnPicker(v));
    const go = button(going ? "Opening …" : "New session from summary", "bbtn", "new",
      `The cache is cold, so this session is not loaded again: a fresh one starts in this slot. ${p?.says ?? ""}`.trim(),
      () => void succeed(v, pick));
    go.disabled = going || !p?.ready;
    pv.appendChild(go);
  } else {
    pv.appendChild(button("Succeed now", "bbtn", "now", "Nudges the session now: write the handover and start the successor itself",
      () => void tell(v, nowText(v.lane), "Nudged to succeed at")));
  }
  hand.append(el("span", "k", "Now"), pv);
  out.push(hand);
  if (shown) out.push(noteEl(shown));
  return out;
}
