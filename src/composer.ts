import { $, el, ta, send, panes, focused, fleet, isMobile, baseName, laneBandNames, laneLabel, stacksOf, parkedSendLine, heldDeliveriesLine, harnessEntry, canChatOn, defaultModel, modelNotice, setSlotSetting, switchesInPane, paneCommand, deliver, serverClockSkew, RECENT_MS, dropFile, dropBtn, chipsEl, togglePrefix, updateChips, boxOrphan, adoptBox, type HarnessInfo } from "./client";
import { icon, harnessMark, MASCOT_MOTIONS, type IconName } from "./icons";
import { renderWorkplaceField, sessionActive } from "./board";
import { modelLabel } from "./modelname";
import { prefBool, prefSetBool } from "./prefs";
import { popover } from "./popover";
import { runningEffort, runningModel } from "./running";
import { askRisk } from "./dialog";

// --- THE ONE COMPOSER ------------------------------------------------------------------------
// Owner 2026-09-19: the conversation view's input REPLACES the box under the terminal — there is
// one input component on this board, in two sizes. `bar` is the low form under a terminal pane;
// `tall` is the rounded surface of the reference shot, with the model/effort switch in its bottom
// row. Fifth cut (owner: „[Zitat entfernt]“): the
// composer has ONE place — #bar, centred at the transcript's column width — in both views. A view
// switch only toggles the size class; #bar is the last item of the main column, so the extra
// height pushes the panes up and the bottom edge stays where it is.
export let compEl: HTMLElement, compOpts: HTMLElement, compTray: HTMLElement, compFiles: HTMLElement;

export function setComposerSize(size: "bar" | "tall"): void {
  reshapeSurface(() => {
    compEl.classList.toggle("tall", size === "tall");
    compEl.classList.toggle("bar", size === "bar");
    ta.rows = 1;
    fitTextarea();
  });
}

export function fitTextarea(): void {
  ta.style.height = "auto";
  ta.style.height = `${Math.min(compEl.classList.contains("tall") ? 220 : 140, ta.scrollHeight)}px`;
}
export function growComposer(): void {
  reshapeSurface(fitTextarea);
}

// Owner (eighth cut): the surface's growth is ANIMATED — the jump between two heights (a line more
// or less, an attachment in or out, the size switch), never each keystroke: a change that leaves
// the height alone returns here without touching anything. Measure, apply, measure, then run from
// the old height to the new one with the composer's one duration (--t in index.html, 160 ms);
// clipping is on only during that run, because the model/effort popovers live inside the surface.
// A change arriving mid-run starts from the height on screen, so nothing snaps back.
let compSurface: HTMLElement;
const SURFACE_MS = 160; // = --t in index.html
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let surfaceTimer: ReturnType<typeof setTimeout> | undefined;
export function reshapeSurface(change: () => void): void {
  const from = compSurface.getBoundingClientRect().height;
  compSurface.style.height = "";
  change();
  const to = compSurface.getBoundingClientRect().height;
  if (Math.abs(to - from) < 1) {
    if (compSurface.classList.contains("reshaping")) compSurface.style.height = `${to}px`;
    return;
  }
  const settle = () => {
    compSurface.style.height = "";
    compSurface.classList.remove("reshaping");
    // the panes above gave up (or got back) the height — the terminal refits once, at the end
    // …but not a terminal the chat view hides (visibility, so it keeps its box): fit() reflows its
    // 10 000-line buffer, measured 1.0–2.7 s of main thread after a multi-line send
    // (docs/messungen/2026-09-22-chat-absenden-zeitleiste.md); setView("term") refits it on the way back
    requestAnimationFrame(() => { for (const p of panes) if (!p.isChat) p.refit(); });
  };
  clearTimeout(surfaceTimer);
  if (reduceMotion.matches) { settle(); return; }
  compSurface.style.height = `${from}px`;
  compSurface.classList.add("reshaping");
  void compSurface.offsetHeight; // commit the start height before the transition target
  compSurface.style.height = `${to}px`;
  surfaceTimer = setTimeout(settle, SURFACE_MS + 40);
}

// The composer follows the FOCUSED pane's view — the pane it has always addressed. It never moves;
// only its size changes (#bar is black under both views since the eleventh cut).
export function mountComposer(): void {
  const pane = panes[focused];
  // a past session on screen is read-only: the composer would address the RUNNING session
  const pastN = pane?.pastN ?? null;
  ta.disabled = pastN !== null;
  ta.placeholder = promptPlaceholder();
  setComposerSize(pane?.isChat ? "tall" : "bar");
  renderComposerOpts(false);
  renderParkHint();
  renderHeldHint();
  renderTarget();
  renderWorkplaceField();
}

// THE PLACEHOLDER no longer names the session (owner 2026-10-07: the name stood three times at the
// foot): the line under the field says it once (src/board.ts#renderWorkplaceField); here only what
// the field is for, and at the desk how to send. A past session on screen reads only, and says so.
// Rewritten on focus, mount and every poll (src/client.ts#updateTitle).
export function promptPlaceholder(): string {
  const pane = panes[focused];
  const slot = pane?.slot ?? 0;
  if (pane?.pastN != null) return `Session ${pane.pastN} liest nur — ↩ oder Esc auf der Zeile führt zur laufenden`;
  if (!slot) return "Diese Ansicht zeigt keine Session";
  const s = fleet.find((x) => x.id === slot);
  if (!s?.cwd) return "Hier läuft keine Session";
  return `Nachricht${isMobile() ? "" : " — Enter sendet"}`;
}

// THE SEND TARGET (Grammatik G2.4, card 929fdbe7): where the composer writes, on screen while the
// field holds text — the placeholder that used to be the only place naming it vanishes with the
// first character. The address is the one the bar writes (the slot number, a lane's band name),
// the name the label or the folder. Both are read from the focused pane and its session's openedAt
// — the two values the draft is bound to (src/drafts.ts) — synchronously, on every focus, draft and
// poll change (mountComposer, src/client.ts#updateTitle), so no late await can paint an old target.
// Nothing is guessed: without a session object the slot reads "unbekannt". A draft written for the
// session that ran there before (src/drafts.ts#BoxDraft) is the one state that adds a control: the
// name gives way to "Entwurf für beendete Session" in --q-wait, and "übernehmen" beside it addresses
// the draft to what runs now — until then, or until the box is empty, Enter sends nothing (doSend).
let targetKey = "";
export function renderTarget(): void {
  const t = $("comptarget");
  const pane = panes[focused];
  const slot = pane?.slot ?? 0;
  const s = slot ? fleet.find((x) => x.id === slot) : undefined;
  const lane = s?.cwd && s.worktree ? laneBandNames(stacksOf()).get(slot) : undefined;
  const addr = !slot ? "—" : lane ?? String(slot);
  const where = lane ? `Lane ${lane} (Slot ${slot})` : `Slot ${slot}`;
  const [name, title] = !slot ? ["keine Session", "Diese Pane zeigt keine Session — eine Nachricht hat kein Ziel"]
    : !s ? ["unbekannt", `${where}: die Belegung ist noch nicht gelesen`]
    : !s.cwd ? ["leer", `${where} ist leer — keine laufende Session, die eine Nachricht annimmt`]
    : pane?.pastN != null ? [`${s.label ?? baseName(s.cwd)} · liest nur`, `${where} zeigt Session ${pane.pastN} — sie liest nur, gesendet wird an die laufende`]
    : [s.label ?? baseName(s.cwd), `Senden geht an ${where} · ${s.label ?? baseName(s.cwd)}`];
  const openedAt = s?.cwd ? String(s.openedAt ?? "") : "";
  const orphan = !!slot && boxOrphan();
  // what runs now and takes the draft once adopted; an empty slot or a past session takes nothing
  const heir = orphan && s?.cwd && pane?.pastN == null ? s.label ?? baseName(s.cwd) : "";
  const key = [slot, openedAt, addr, name, title, orphan, heir].join("|");
  if (key === targetKey) return;
  targetKey = key;
  t.dataset.slot = String(slot);
  t.dataset.openedAt = openedAt;
  t.dataset.orphan = String(orphan);
  t.classList.toggle("none", !s?.cwd || pane?.pastN != null);
  t.classList.toggle("orphan", orphan);
  if (!orphan) {
    t.title = title;
    // a running session's name is the foot line's (src/board.ts#renderWorkplaceField): the target
    // draws nothing then; it keeps its word where a send takes nothing ("leer", "liest nur")
    const takes = !!s?.cwd && pane?.pastN == null;
    if (takes) { t.removeAttribute("aria-label"); t.replaceChildren(); return; }
    t.setAttribute("aria-label", `Sendeziel: ${addr} ${name}`);
    t.replaceChildren(el("span", "ctaddr", addr), el("span", "ctname", name));
    return;
  }
  const word = "Entwurf für beendete Session";
  t.title = `Dieser Entwurf wurde für die Session geschrieben, die in ${where} lief — sie ist beendet. `
    + (heir ? `Enter sendet ihn nicht an ${heir}: „übernehmen" richtet ihn an ${heir}, ein leeres Feld gibt es frei.`
      : "Enter sendet ihn nicht; ein leeres Feld gibt es frei.");
  t.setAttribute("aria-label", `Sendeziel: ${addr} — ${word}`);
  const parts: HTMLElement[] = [el("span", "ctaddr", addr), el("span", "ctname", word)];
  if (heir) {
    const adopt = el("button", "ctadopt", "übernehmen") as HTMLButtonElement;
    adopt.type = "button";
    adopt.title = `Entwurf an ${heir} richten — danach sendet Enter an ${heir}`;
    adopt.onclick = () => adoptBox();
    parts.push(adopt);
  }
  t.replaceChildren(...parts);
}

// the focused pane's parked sends (server.ts, THE PARKED SEND), one quiet line above the composer
export function renderParkHint(): void {
  const hint = $("comppark");
  const ps = fleet.find((x) => x.id === panes[focused]?.slot)?.parkedSend;
  hint.hidden = !ps;
  const text = ps ? `⏳ ${parkedSendLine(ps)}` : "";
  if (hint.textContent !== text) hint.textContent = text;
}

// the focused session's held bundle (server.ts#heldDeliveriesView): an owner send takes it along
// (server.ts#sendText flushes the bundle with the send), so the composer says so. In the chat view
// the line above the box names what is held; under a terminal, which shows nothing of it, the hint
// names it itself. A past session on screen addresses nothing — no hint.
export function renderHeldHint(): void {
  const hint = $("compheld");
  const pane = panes[focused];
  const hd = pane?.pastN == null ? fleet.find((x) => x.id === pane?.slot)?.heldDeliveries : undefined;
  hint.hidden = !hd;
  const text = !hd ? "" : pane?.isChat ? "Senden nimmt sie mit" : `${heldDeliveriesLine(hd)} · Senden nimmt sie mit`;
  if (hint.textContent !== text) hint.textContent = text;
}

// the model/effort switches: conversation view only, and only what the SLOT'S ADAPTER carries
// (GET /api/harnesses). Same rule as the second cut — what a harness has no concept of is absent,
// not greyed — and the same two-half write (setSlotSetting). Seventh cut (owner: „[Zitat entfernt]“
// ):
// TWO controls in the surface's bottom row, each with its own small popover, and a pick is STAGED,
// never run — only the popover's Apply writes the record and types into the pane. Closing without
// Apply discards. State lives here, outside the DOM, because the poll repaints the row whenever the
// slot's values move (measured in the second cut: a verdict held in a replaced node reads as silence).
type OptField = "model" | "effort" | "cmds";
let optsKey = "";
let optOpen: OptField | null = null;
let optStaged: Partial<Record<OptField, string>> = {};
let optMsg: Partial<Record<OptField, string>> = {};
let optsSlot = 0;
// Twelfth cut: Apply on the MODEL switch first asks (owner: a model switch costs the session its
// prompt cache). The ask is state, not DOM, for the reason optOpen is — the poll repaints the row.
let optConfirm = false;
function modelWarnOff(): boolean {
  return !prefBool("fleet.modelSwitchWarn"); // asking is the default — the key stores only "off"
}
function setModelWarnOff(): void {
  prefSetBool("fleet.modelSwitchWarn", false); // private window: it simply asks again next time
}

// THE CACHE COUNTER (owner, twelfth cut: „[Zitat entfernt]“
// , threshold 5 min; fifteenth cut: „[Zitat entfernt]“). Reference = the newest
// transcript entry that STARTS a request — a prompt or a tool result — by its own timestamp (Pane.lastTurnAt,
// from the transcript poll the conversation view already runs, or the owner's own send, whichever
// is newer) — not lastOutput, which moves with any byte the pane paints. Both are read on the
// SERVER's clock (serverClock): the timestamps are written there, the viewer may be a phone. What the TTL of a given session IS stays unmeasured: Claude Code's own
// rule (2.1.278) is 1 h for the main conversation on a subscription within its limits and 5 min on
// an API key or in overage, and nothing on this board says which applies — hence "probably". The
// owner runs on the 5 min TTL (thirteenth cut) and wants the turn to cold 20 s BEFORE it, so the
// expiry never arrives as a surprise.
export const CACHE_TTL_MS = 5 * 60_000;
// The same 20 s lead before every TTL, so the turn to cold never arrives as a surprise.
const CACHE_COLD_LEAD_MS = 20_000;
// CLAUDE, Tranche 2 of the chat view: the server names the tier (transcript payload `ttlSec`, from
// server.ts#deliveryCacheState — measured docs/messungen/2026-09-29-claude-cache-ttl.md: the main
// conversations hold 1 h), and the warning comes min(300, ttlSec/5) s before the edge — the same edge
// the delivery path calls "kalt". null = no tier named by the server (codex, pi, before the first
// read): the 20 s lead as before.
export function cacheLeadMs(ttlSec: number | null): number {
  return ttlSec === null ? CACHE_COLD_LEAD_MS : Math.min(300, ttlSec / 5) * 1000;
}
// codex and pi (sixteenth cut): MEASURED, not documented — docs/messungen/2026-09-19-codex-pi-
// composer-anbindung.md §Cache-Treffer. z.ai: ≥ 76 % hits up to 15 min pause, 60 % at 15–30, 20 % at
// 30–60 → 15 min. codex (ChatGPT backend): 84–85 % up to 60 min, 73 % at 1–2 h, 20 % beyond → 1 h.
// No provider documentation was read for either; hence "probably" in the title, as for Claude.
const ZAI_CACHE_TTL_MS = 15 * 60_000;
const CODEX_CACHE_TTL_MS = 60 * 60_000;
// a provider this board has no measurement for gets no counter — a guessed TTL would be a claim
export function cacheTtlFor(provider: string): number | null {
  if (provider === "zai") return ZAI_CACHE_TTL_MS;
  if (provider === "openai" || provider === "openai-codex") return CODEX_CACHE_TTL_MS;
  return null;
}
// WORKING vs IDLE (seventeenth cut). While the agent works, every tool result starts a new request,
// so a counter "since the last request" fell back to 0:00 several times a turn (owner, slot 5:
// 0:10 → 0:01) — read as broken. The counter now shows only while the session is IDLE. Idle is the
// pane's own paint: every harness repaints its spinner while it works — measured at slot 5 over a
// three-tool turn, lastOutput was never older than 0.4 s until "done", then aged 1 s per second
// (idle panes 5/6/7: 56–590 s without a byte). 4 s leaves room for the 2 s poll that carries it.
const CACHE_BUSY_MS = 4000;
const fmtTtl = (ms: number): string => (ms >= 3_600_000 ? `${ms / 3_600_000} h` : `${ms / 60_000} min`);
let ageEl: HTMLElement | null = null;
let mascotEl: HTMLElement | null = null;
let mascotTimer: ReturnType<typeof setTimeout> | undefined;
let ringTimer: ReturnType<typeof setTimeout> | undefined;
let mascotAnimation: Animation | null = null;
let mascotWorking = false;
function stopMascot(): void {
  clearTimeout(mascotTimer);
  mascotTimer = undefined;
  mascotAnimation?.cancel();
  mascotAnimation = null;
}
function queueMascot(): void {
  if (!mascotWorking || !mascotEl?.isConnected || document.hidden || reduceMotion.matches
    || mascotTimer !== undefined || mascotAnimation) return;
  mascotTimer = setTimeout(() => {
    mascotTimer = undefined;
    if (!mascotWorking || !mascotEl?.isConnected || document.hidden || reduceMotion.matches) return;
    const mark = mascotEl.firstElementChild;
    if (!mark) return;
    mascotAnimation = mark.animate(MASCOT_MOTIONS[Math.floor(Math.random() * MASCOT_MOTIONS.length)]!,
      { duration: 750, easing: "ease-in-out" });
    mascotAnimation.onfinish = () => { mascotAnimation = null; queueMascot(); };
  }, 15_000 + Math.random() * 45_000);
}
export function cacheRingState(ageMs: number, ttlMs: number): { fill: number; phase: "warm" | "blink" | "cold"; dim: boolean } {
  const fullAt = Math.max(1, ttlMs - 10_000);
  const sinceFull = ageMs - fullAt;
  return {
    fill: Math.min(1, Math.max(0, ageMs / fullAt)),
    phase: sinceFull < 0 ? "warm" : sinceFull < 800 ? "blink" : "cold",
    dim: sinceFull >= 0 && sinceFull < 800 && Math.floor(sinceFull / 200) % 2 === 0,
  };
}
const fmtAge = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
// the server's clock now — transcript timestamps and a send stamped here are both in its frame
export const serverClock = (): number => Date.now() + serverClockSkew;
export function cacheAge(): number | null {
  const p = panes[focused];
  // no conversation this board reads, or a provider with no measured TTL: no reference, no counter
  if (!p?.slot || !canChatOn(harnessEntry(p.slot)?.supports) || p.cacheTtl === null) return null;
  // a request that just started counts as work too: the pane's first spinner frame reaches this
  // board one poll later, and in that gap the counter showed 0:00, 0:01 and then vanished
  const lastOutput = fleet.find((x) => x.id === p.slot)?.lastOutput ?? 0;
  if (serverClock() - Math.max(lastOutput, p.lastTurnAt) < CACHE_BUSY_MS) return null; // working
  const at = p.lastTurnAt;
  return at ? Math.max(0, serverClock() - at) : null;
}
export function tickCacheAge(): void {
  clearTimeout(ringTimer);
  const pane = panes[focused];
  const active = !!pane?.slot && pane.isChat && pane.pastN === null && sessionActive(pane.slot)
    && serverClock() - (fleet.find((s) => s.id === pane.slot)?.lastOutput ?? 0) < RECENT_MS;
  mascotWorking = active;
  if (mascotEl) mascotEl.hidden = !active;
  if (!active || document.hidden || reduceMotion.matches) stopMascot();
  else queueMascot();
  if (!ageEl?.isConnected) return;
  const ms = pane?.pastN === null && !active ? cacheAge() : null;
  ageEl.hidden = ms === null;
  if (ms === null) return;
  const ttl = pane?.cacheTtl ?? CACHE_TTL_MS;
  const state = cacheRingState(ms, ttl);
  const cold = ms >= ttl - cacheLeadMs(pane?.cacheTtlSec ?? null);
  ageEl.style.setProperty("--cache-fill", String(state.fill));
  ageEl.classList.toggle("cold", state.phase === "cold");
  ageEl.classList.toggle("blink", state.phase === "blink" && state.dim && !reduceMotion.matches && !document.hidden);
  ageEl.title = cold
    ? `last request ${fmtAge(ms)} ago — ${ms >= ttl ? "the prompt cache is probably cold" : "the prompt cache expires shortly"} (${fmtTtl(ttl)} TTL)`
    : `last request ${fmtAge(ms)} ago — the prompt cache is probably still warm (${fmtTtl(ttl)} TTL)`;
  ageEl.setAttribute("aria-label", ageEl.title);
  if (!document.hidden && !reduceMotion.matches && state.phase !== "cold") {
    const untilFull = Math.max(1, ttl - 10_000) - ms;
    ringTimer = setTimeout(tickCacheAge, state.phase === "blink" ? 100 : Math.min(1000, Math.max(1, untilFull)));
  }
}
setInterval(() => { if (!document.hidden) tickCacheAge(); }, 1000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { stopMascot(); clearTimeout(ringTimer); }
  else tickCacheAge();
});
reduceMotion.addEventListener("change", tickCacheAge);

// the slot the switches address: the conversation view — or, for a harness that HAS none (pi-ox, the
// container; since the sixteenth cut pi and codex have one), the terminal view, its only one
function optSlot(): number {
  const pane = panes[focused];
  const sup = pane?.slot ? harnessEntry(pane.slot)?.supports : undefined;
  return pane?.slot && (pane.isChat || optsAnywhere || (sup && !canChatOn(sup))) ? pane.slot : 0;
}
// the phone island's Modell und Effort (src/client.ts#setDirect) opens over either view: while it
// is open the switches are drawn for the terminal view too, since its Übernehmen presses theirs —
// and they stay drawn while the switch popover that press opened is open (closeOpts ends it)
let optsAnywhere = false;
export function setOptsAnywhere(on: boolean): void {
  const next = on || optOpen !== null;
  if (optsAnywhere === next) return;
  optsAnywhere = next;
  renderComposerOpts(true);
}
// one entry per NAME: claude-opus-5 and claude-opus-5[1m] read the same ("Opus 5 · 1M") and
// resolve the same in Claude Code 2.1.278 (both native_1m), so two identical rows would only
// ask the owner to pick between twins. The kept id is the slot's own if it is one of them,
// else the adapter's first; the other stays reachable through the free-text field.
// Only what one should pick today is offered: an id the register marks superseded
// (model-register.ts#MODEL_REGISTER, read here through modelNotice) is left out — unless the slot
// runs on it, because hiding it would hide what is running; it then stands with its notice. The
// switch at the field and the phone's tools sheet (optChoices) both read this list.
function modelChoices(h: HarnessInfo, current: string): string[] {
  const byName = new Map<string, string>();
  for (const m of h.models ?? []) {
    if (m !== current && modelNotice(h.id, m).startsWith("superseded")) continue;
    const name = modelLabel(m);
    if (!byName.has(name) || m === current) byName.set(name, m);
  }
  return [...byName.values()];
}

export function renderComposerOpts(force: boolean): void {
  const pane = panes[focused];
  const slot = optSlot();
  const h = slot ? harnessEntry(slot) : null;
  const s = fleet.find((x) => x.id === slot);
  const key = [slot, h?.id ?? "", s?.model ?? "", s?.effort ?? "", defaultModel ?? "", pane?.observedModel ?? "", pane?.observedEffort ?? ""].join("|");
  if (!force && key === optsKey) { tickCacheAge(); return; }
  optsKey = key;
  // a pick staged for one session must never be applied to the next one the focus lands on
  if (slot !== optsSlot) { optsSlot = slot; optOpen = null; optStaged = {}; optMsg = {}; optConfirm = false; }
  stopMascot();
  compOpts.replaceChildren();
  ageEl = mascotEl = null;
  if (!h || !slot) return;
  const activity = el("span", "compactivity");
  mascotEl = el("span", "compmascot");
  mascotEl.title = "working …";
  mascotEl.setAttribute("role", "status");
  mascotEl.setAttribute("aria-label", "working …");
  const mascot = harnessMark(h.id);
  if (mascot) mascotEl.appendChild(mascot);
  ageEl = el("span", "optage");
  ageEl.setAttribute("role", "img");
  activity.append(mascotEl, ageEl);
  compOpts.appendChild(activity);
  tickCacheAge();
  if (h.supports.model) {
    // the model the transcript's newest turn actually ran on wins over the record
    // (src/running.ts#runningModel — a /model typed in the pane never reaches the record); an
    // unpinned slot with no file yet runs the fleet default only where the server bakes it in (the
    // default harness, server.ts#DEFAULT_MODEL); elsewhere the harness picks, and the client cannot know
    const current = runningModel(s?.model, pane?.observedModel);
    const shown = current || (h.default && defaultModel ? defaultModel : "—");
    compOpts.appendChild(optSwitch("model", slot, current, shown, [], (stage) => {
      const input = document.createElement("input");
      input.className = "cmdinput";
      input.value = optStaged.model ?? current;
      input.placeholder = shown;
      input.spellcheck = false;
      // the adapter's list, clickable; a click STAGES like typing does — Apply stays the only send.
      // Free text stays beside it because modelRe admits more than any list names.
      const list = el("div", "cmdlist");
      // each entry reads as the model's name (modelLabel); the raw id is its value and its tooltip
      const markStaged = (v: string) => {
        for (const o of list.children) o.classList.toggle("staged", (o as HTMLElement).dataset.id === v && v !== current);
      };
      for (const m of modelChoices(h, current)) {
        const notice = modelNotice(h.id, m);
        const b = el("button", "cmdmodel", `${modelLabel(m)}${notice ? ` · ${notice}` : ""}`) as HTMLButtonElement;
        b.dataset.id = m;
        b.title = `${m}${notice ? ` · ${notice}` : ""}`;
        b.classList.toggle("cur", m === current);
        b.classList.toggle("staged", m === optStaged.model && m !== current);
        b.onclick = () => { input.value = m; stage(m); markStaged(m); };
        list.appendChild(b);
      }
      input.addEventListener("input", () => { stage(input.value.trim()); markStaged(input.value.trim()); });
      // Enter moves to Apply rather than applying: the explicit press stays the only way out
      input.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        input.closest(".optpop")?.querySelector<HTMLButtonElement>(".cmdapply")?.focus();
      });
      return { list: list.childElementCount ? list : undefined, row: [input] };
    // on a phone the switch carries the name alone — with the counter, the mark and the effort
    // beside it, "GPT-5.5 · 272K" ellipsized to "GP…" at 390px (seventeenth cut); the popover
    // list keeps the window
    }, null, (v) => {
      const name = isMobile() ? modelLabel(v).split(" · ")[0] : modelLabel(v);
      const notice = modelNotice(h.id, v);
      return notice ? `${name} · ${notice}` : name;
    }));
  }
  if (h.supports.effort && h.effortLevels.length) {
    // the level the session's own file shows it running at, the record only as the fallback
    // (src/running.ts#runningEffort, eighteenth cut); only when neither names one does "default"
    // stand — never a level guessed from a config. Apply compares against THIS value, so picking
    // the level a stale record already names still types it into the pane.
    const running = runningEffort(s?.effort, pane?.observedEffort);
    compOpts.appendChild(optSwitch("effort", slot, running, running || "Standard", [], (stage) => {
      const levels = el("div", "cmdlevels");
      for (const lv of h.effortLevels) {
        const b = el("button", "cmdlevel", lv) as HTMLButtonElement;
        b.classList.toggle("cur", lv === running);
        b.classList.toggle("staged", lv === optStaged.effort && lv !== running);
        b.onclick = () => {
          stage(lv);
          for (const o of levels.children) o.classList.toggle("staged", o === b && lv !== running);
        };
        levels.appendChild(b);
      }
      return { row: [levels] };
    }, null));
  }
  // the slot's harness knows sendable slash commands: a third switch — but one that SENDS instead
  // of staging. What the catalogue carries is everything this shows; an empty or absent list
  // renders nothing at all (no button), and no command name exists anywhere in this file.
  if (h.commands?.length) compOpts.appendChild(commandSwitch(slot, h));
}

// THE PHONE'S TOOLS SHEET (src/client.ts#renderSheet) shows the same two switches as segments: the
// same values, the same staging, the same Apply. Nothing here writes on its own — stageOpt only marks
// a pick (optStaged, which the switch then shows too) and applyOpt presses the switch's own Apply
// inside its own popover, so the question, the restart warning and the verdict are today's.
export interface OptChoice { field: "model" | "effort"; current: string; staged: string | null; values: { v: string; label: string; title: string }[] }
export function optChoices(): OptChoice[] {
  const slot = optSlot();
  const h = slot ? harnessEntry(slot) : null;
  if (!h) return [];
  const pane = panes[focused], s = fleet.find((x) => x.id === slot);
  const out: OptChoice[] = [];
  if (h.supports.model) {
    const current = runningModel(s?.model, pane?.observedModel);
    const values = modelChoices(h, current).map((m) => {
      const notice = modelNotice(h.id, m);
      return { v: m, label: `${modelLabel(m).split(" · ")[0]}${notice ? ` · ${notice}` : ""}`, title: `${m}${notice ? ` · ${notice}` : ""}` };
    });
    if (values.length) out.push({ field: "model", current, staged: optStaged.model ?? null, values });
  }
  if (h.supports.effort && h.effortLevels.length) {
    const current = runningEffort(s?.effort, pane?.observedEffort);
    out.push({ field: "effort", current, staged: optStaged.effort ?? null, values: h.effortLevels.map((lv) => ({ v: lv, label: lv, title: `effort ${lv}` })) });
  }
  return out;
}
export function stageOpt(field: "model" | "effort", v: string): void {
  optStaged = { ...optStaged, [field]: v };
  optMsg = {};
  renderComposerOpts(true);
}
// takes a pick back, so the switch shows its running value again — "" is a value here (effort
// Standard), never "no pick"
export function unstageOpt(field: "model" | "effort"): void {
  const { [field]: _gone, ...rest } = optStaged;
  optStaged = rest;
  optMsg = {};
  renderComposerOpts(true);
}
export function applyOpt(field: "model" | "effort"): void {
  optOpen = field;
  optMsg = {};
  optConfirm = false;
  renderComposerOpts(true);
  compOpts.querySelector<HTMLButtonElement>(`.optswrap.${field} .cmdapply`)?.click();
}

// The ⌘ switch: one row per documented command (name + the evidence line), click = deliver() —
// the ONE delivery path every composer on this board uses, 409 reading included. Entries flagged
// `confirm` (session-ending or context-discarding) ask first, and the ask states what the command
// does — it never fires on the click that opened the list.
function commandSwitch(slot: number, h: HarnessInfo): HTMLElement {
  const wrap = el("div", "optswrap cmds");
  const btn = el("button", "optsw") as HTMLButtonElement;
  btn.append(el("span", "optval", `⌘ ${h.commands!.length}`));
  btn.appendChild(el("span", "optchev")).appendChild(icon("chevron"));
  btn.title = `commands ${h.id} accepts — clicking one sends it to the slot`;
  const pop = el("div", "optpop cmds");
  const list = el("div", "cmdlist");
  for (const c of h.commands ?? []) {
    const row = el("button", "cmdline") as HTMLButtonElement;
    row.append(el("span", "cmdname", c.name), el("span", "cmdpurpose", c.purpose));
    if (c.confirm) row.appendChild(el("span", "cmdwarn", "⚠"));
    row.title = c.confirm ? `${c.purpose} — asks first` : c.purpose;
    row.onclick = async () => {
      if (c.confirm && !(await confirmCommand(slot, c.name, c.purpose))) return;
      if (await deliver(slot, c.name)) { optOpen = null; renderComposerOpts(true); }
    };
    list.appendChild(row);
  }
  pop.appendChild(list);
  btn.onclick = (e) => {
    e.stopPropagation();
    optOpen = optOpen === "cmds" ? null : "cmds";
    optStaged = {};
    optMsg = {};
    optConfirm = false;
    renderComposerOpts(true);
    if (optOpen === "cmds") compOpts.querySelector<HTMLElement>(".optswrap.cmds .cmdline")?.focus();
  };
  if (optOpen === "cmds") { pop.classList.add("open"); btn.classList.add("on"); }
  wrap.append(btn, pop);
  return wrap;
}

// the ask a `confirm` command owes (VERBOTEN half of the commands card): a dialog that names the
// command and what it does to this slot's context, with the send behind one more press.
function confirmCommand(slot: number, name: string, purpose: string): Promise<boolean> {
  return askRisk({
    title: `Send ${name} to slot ${slot}?`,
    body: [el("div", "bmidrun",
      `${purpose}. This discards or rewrites the session's live context — the conversation it has read so far does not come back.`)],
    buttons: [
      { label: "cancel", value: false },
      { label: `send ${name}`, danger: true, value: true },
    ],
  });
}

// Close whatever is open and forget what was staged in it — closing without Apply discards.
function closeOpts(focusField?: OptField): void {
  optOpen = null;
  optsAnywhere = false;
  optStaged = {};
  optMsg = {};
  optConfirm = false;
  renderComposerOpts(true);
  if (focusField) compOpts.querySelector<HTMLElement>(`.optswrap.${focusField} .optsw`)?.focus();
}

// staged or current) value with a chevron, and a small popover: the field's own control(s), then
// Apply. The verdict line appears only after an Apply, never as an empty row. (The ⌘ switch is not
// one of these — it sends instead of staging — but its field still lives in OptField's union.)
function optSwitch(field: "model" | "effort", slot: number, current: string, shown: string, lead: HTMLElement[],
  body: (stage: (v: string) => void) => { list?: HTMLElement; row: HTMLElement[] }, mark: Element | null,
  label: (v: string) => string = (v) => v): HTMLElement {
  const wrap = el("div", `optswrap ${field}`);
  const btn = el("button", "optsw") as HTMLButtonElement;
  const inPane = switchesInPane(harnessEntry(slot));
  const what = inPane
    ? `Stellt die Session um und tippt ${paneCommand(harnessEntry(slot), field, "")?.trim() ?? `/${field}`} in sie — erst mit Übernehmen`
    : `Stellt die Session um und STARTET sie damit neu (dieser Harness kennt kein /${field} in der Session) — erst mit Übernehmen`;
  const tip = (v: string) => `${mark ? `${harnessEntry(slot)?.id ?? ""} · ` : ""}${field} ${v} — ${what}`;
  if (mark) lead[0]?.appendChild(mark);
  const val = el("span", `optval${field === "effort" ? " dim" : ""}`, label(optStaged[field] ?? shown));
  btn.append(...lead, val);
  btn.appendChild(el("span", "optchev")).appendChild(icon("chevron"));
  const pop = el("div", `optpop ${field}`);
  const apply = el("button", "cmdapply", "Übernehmen") as HTMLButtonElement;
  apply.title = what;
  const status = el("div", "cmdstatus", optMsg[field] ?? "");
  status.hidden = !optMsg[field];
  const sync = () => {
    const v = optStaged[field];
    const pending = !!v && v !== current;
    apply.disabled = !pending;
    wrap.classList.toggle("staged", pending);
    val.textContent = label(pending && v ? v : shown);
    btn.title = tip(pending && v ? v : shown); // the raw id lives here, the name on the button
  };
  const stage = (v: string) => { optStaged = { ...optStaged, [field]: v }; sync(); };
  const run = async () => {
    const v = optStaged[field];
    if (!v || v === current) return;
    apply.disabled = true;
    apply.textContent = "Wird umgestellt …";
    const verdict = await setSlotSetting(slot, field, v);
    optStaged = { ...optStaged, [field]: undefined };
    optMsg = { ...optMsg, [field]: verdict };
    renderComposerOpts(true); // the popover stays open (optOpen) and shows the verdict
  };
  apply.onclick = () => {
    // a restart always asks (it stops whatever runs); the cache question can be switched off
    if (!inPane || (field === "model" && !modelWarnOff())) {
      optConfirm = true;
      renderComposerOpts(true);
      compOpts.querySelector<HTMLElement>(".optconfirm .cmdcancel")?.focus();
      return;
    }
    void run();
  };
  if (optConfirm && optOpen === field) {
    // the popover's body gives way to the question; the staged pick stays staged behind it
    const box = el("div", "optconfirm");
    box.setAttribute("role", "alertdialog");
    const ms = cacheAge();
    box.appendChild(el("div", "cfmsg", inPane
      ? "Ein Modellwechsel verwirft den Zwischenspeicher dieser Session — die nächste Antwort liest das ganze Gespräch neu."
      : `${harnessEntry(slot)?.id ?? "Dieser Harness"} kennt kein /${field} in der Session: Umstellen startet sie neu und setzt das Gespräch fort. Was sie gerade tut, bricht ab.`));
    const ttl = panes[focused]?.cacheTtl ?? CACHE_TTL_MS;
    if (ms !== null) box.appendChild(el("div", "cfage", `Letzte Anfrage vor ${fmtAge(ms)}${ms >= ttl ? " — der Zwischenspeicher ist wohl schon kalt" : ms >= ttl - cacheLeadMs(panes[focused]?.cacheTtlSec ?? null) ? " — der Zwischenspeicher läuft gleich ab" : ""}.`));
    const opt = el("label", "cfskip");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    opt.append(cb, document.createTextNode("Nicht mehr fragen"));
    opt.hidden = !inPane; // a restart is asked every time
    const cancel = el("button", "cmdcancel", "Abbrechen") as HTMLButtonElement;
    cancel.onclick = () => cancelConfirm();
    const go = el("button", "cmdapply", "Umstellen") as HTMLButtonElement;
    go.onclick = () => {
      if (inPane && cb.checked) setModelWarnOff();
      optConfirm = false;
      void run();
    };
    const acts = el("div", "cfacts");
    acts.append(opt, cancel, go);
    box.appendChild(acts);
    pop.append(box);
  } else {
    const row = el("div", "cmdrow");
    const parts = body(stage);
    row.append(...parts.row, apply);
    if (parts.list) pop.appendChild(parts.list);
    pop.append(row, status);
  }
  sync();
  if (optOpen === field) { pop.classList.add("open"); btn.classList.add("on"); }
  btn.onclick = (e) => {
    e.stopPropagation();
    const opening = optOpen !== field;
    optStaged = {};
    optMsg = {};
    optConfirm = false;
    optOpen = opening ? field : null;
    renderComposerOpts(true);
    const again = compOpts.querySelector<HTMLElement>(`.optswrap.${field}`);
    if (opening) again?.querySelector<HTMLElement>(".cmdmodel.cur, .cmdmodel, .cmdinput, .cmdlevel.cur, .cmdlevel")?.focus();
    else again?.querySelector<HTMLElement>(".optsw")?.focus();
  };
  wrap.append(btn, pop);
  return wrap;
}
// the composer popovers' outside-click and Escape also live in src/popover.ts (G4.1/K5), scoped
// to compOpts so a handled Escape never reaches the shell windows' window-level handler

// Cancel on the model-switch question: back to the list, the pick still staged, nothing sent
function cancelConfirm(): void {
  optConfirm = false;
  renderComposerOpts(true);
  compOpts.querySelector<HTMLElement>(".optswrap.model .cmdapply")?.focus();
}

// --- the tray under the surface. ENTRIES ARE DATA: a later one is a row here, not a rebuild.
// Every entry is an existing function of this board that used to own an icon button of its own.
const TRAY: { id: string; label: string; icon: IconName; run?: () => void }[] = [
  { id: "files", label: "Files", icon: "folder", run: () => dropFile.click() },
  { id: "histbtn", label: "History", icon: "history" },
  { id: "autobtn", label: "Schedule", icon: "clock" },
  { id: "live", label: "Live", icon: "keys" },
];
export function buildTray(): void {
  for (const entry of TRAY) {
    if (entry.run) {
      const b = el("button", "") as HTMLButtonElement;
      b.title = "Dateien an diese Session anhängen.";
      b.append(el("span", "tricon"), el("span", "trlabel", entry.label));
      b.onclick = entry.run;
      compTray.appendChild(b);
    } else {
      compTray.appendChild($(entry.id)); // the element keeps its id, its title and its wiring
    }
    // one icon language: the emoji the markup carries are replaced by the board's SVG grammar
    compTray.lastElementChild?.querySelector(".tricon")?.replaceChildren(icon(entry.icon));
  }
  dropBtn.querySelector(".tricon")?.replaceChildren(icon("plus"));
  send.replaceChildren(icon("send"));
}

// --- live typing mode (mobile): a real visible input relays every keystroke to the
// focused pane, same approach as claude-deck — xterm's hidden helper textarea is
// unreliable on iOS (keyboard often won't open, autocorrect swallows input)
export let live: HTMLElement;
let livebar: HTMLElement, livein: HTMLInputElement;
export let liveOn = false;
export function setLive(on: boolean) {
  liveOn = on;
  live.classList.toggle("on", on);
  livebar.style.display = on ? "flex" : "none";
  // reveal the field but don't focus it — tapping it is what should open the keyboard
  if (!on) livein.blur();
}
const LIVE_KEYS: Record<string, string> = {
  Enter: "\r", Escape: "\x1b", Backspace: "\x7f", Tab: "\t",
  ArrowUp: "\x1b[A", ArrowDown: "\x1b[B", ArrowRight: "\x1b[C", ArrowLeft: "\x1b[D",
};
export function renderChips(chips: string[]) {
  if (chipsEl.childElementCount === chips.length) return;
  chipsEl.replaceChildren();
  for (const c of chips) {
    const b = el("button", "chip", c.replace(/^\//, "")) as HTMLButtonElement;
    b.dataset.cmd = c;
    b.onclick = () => togglePrefix(c);
    chipsEl.appendChild(b);
  }
  updateChips();
}


export function initComposer(): void {
  compEl = $("comp"); compOpts = $("compopts"); compTray = $("comptray"); compFiles = $("compfiles");
  compSurface = $("compsurface");
  live = $("live"); livebar = $("livebar"); livein = $("livein") as HTMLInputElement;
  popover({
    panel: () => compOpts.querySelector<HTMLElement>(".optpop.open"),
    trigger: () => compOpts.querySelector<HTMLElement>(".optsw.on"),
    isOpen: () => optOpen !== null,
    scope: compOpts,
    close: (refocus) => {
      if (optConfirm && refocus) { cancelConfirm(); return; }
      closeOpts(refocus ? (optOpen ?? undefined) : undefined);
    },
    rows: () => [...compOpts.querySelectorAll<HTMLButtonElement>(".optpop.open .cmdmodel, .optpop.open .cmdlevel, .optpop.open .cmdline")],
  });
  live.onclick = () => setLive(!liveOn);
  livein.addEventListener("keydown", (e) => {
    if (e.isComposing) return;
    const seq = LIVE_KEYS[e.key];
    if (seq) {
      e.preventDefault();
      panes[focused]?.sendRaw(seq);
    }
  });
  livein.addEventListener("beforeinput", (e) => {
    if (e.inputType === "insertCompositionText") return; // not cancelable; handled on compositionend
    if (e.inputType === "insertText" || e.inputType === "insertFromPaste") {
      e.preventDefault();
      if (e.data) panes[focused]?.sendRaw(e.data);
    }
  });
  livein.addEventListener("compositionend", (e) => {
    if (e.data) panes[focused]?.sendRaw(e.data);
    livein.value = "";
  });
  livein.addEventListener("input", () => {
    // sweeper: the field must stay empty so autocorrect has nothing to rewrite
    if (livein.value) livein.value = "";
  });
  
}
