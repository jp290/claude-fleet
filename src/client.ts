import type { CodexFirstTurn } from "../server/conversation-read";
import type { ModelSwitch } from "../server/model-switch";
import { PERF_BATCH_MAX, type PerfRecord, type PerfJourney, type PerfAttrs } from "./protocol";
import { perfRebuild } from "./perfmarks";
import { initQueue, taskText, briefByMain, taskTextBusy, taskTextWaiters, qShell, qPick, qView, qDetailKey, taskCardFull, loadTaskTexts, ProgramDigest, programsPoll, programsList, programsStale, loadPrograms, programMark, qGroupOf, qFirstLine, taskSourceLabel, qWaveProjectionKey, qLaneKey, qLaneJoinOf, renderQueueDetail, qSelect, renderQueue, openQueue, setQueueTreeOn, invalidateQueueList, setProgramsPoll, setProgramsStale, setQueueDetailKey } from "./queue";
import { initFieldPerf } from "./fieldperf";
import { pasteText } from "./paste";
import { initBoard, machineSigns, agoDe, nameWithoutModel, renderWorkplaceField, reloadRankePrefs, reloadGsView, setInstanceSource, BriefInfo, BriefSetup, boardBody, boardOpen, termLimitOn, setTermLimit, boardFolds, outline, ReviewFinding, mergeWatch, mergePending, showRiskPreview, fetchSlotRisk, doLand, doMergeLand, doShelve, doCommit, sessionActive, boardShell, applyBoard, setBoard, GateInfo, gateInfo, postLandLive, meterSuites, renderSuiteMeter, DeployGapInfo, BundleStaleInfo, deployGapInfo, bundleStaleInfo, ErrorsInfo, errorsInfo, renderBoard, postLandAudit, renderPostLandAudit, setPostLandAudit, setGateInfo, setPostLandLive, setErrorsInfo, setMeterSuites, setDeployGapInfo, setBundleStaleInfo, takeFxAfterPaint } from "./board";
import { initComposer, compEl, compOpts, compTray, compFiles, live, liveOn, setComposerSize, growComposer, reshapeSurface, mountComposer, renderParkHint, renderHeldHint, renderFrageHint, renderTarget, cacheTtlFor, tickCacheAge, renderComposerOpts, buildTray, setLive, renderChips, serverClock, cacheAge, CACHE_TTL_MS, promptPlaceholder, optChoices, stageOpt, unstageOpt, applyOpt, setOptsAnywhere } from "./composer";
import { initDevices, devdlg, devbtn, closeDevDlg, devIsOpen, renderDevBtn, renderDevDlg, devicesSection, helperDevicesInfo, deviceOnlineMs, type HelperDeviceInfo, setDeviceSnapshot } from "./devices";
import { initAttention, attndlg, opsdlg, attnRows, ownerReportRows, opsRows, loadAttention, loadOwnerReports, setAttentionOpen, setOpsEvents, setReportsAwaitingOwner, closeAttnDlg, closeOpsDlg } from "./attention";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { CanvasAddon } from "@xterm/addon-canvas";
import { WebglAddon } from "@xterm/addon-webgl";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import qrcode from "qrcode-generator";
import { entityMatches, mdInto, type MdEntityKind } from "./md";
import { selectionMarkdown } from "./mdcopy";
import { Flakes } from "./flakes";
import { MarkStage, markFacts, placeMarks, projectHue, type MarkItem } from "./marks";
import { harnessMark, icon, type IconName } from "./icons";
import { modelLabel } from "./modelname";
import type { ModelEntry, ModelAvailability } from "../model-register";
import { BoxDraft, DraftBook, historySource, keepDrafts, readKeptDrafts, type HistoryEntry } from "./drafts";
import { attachEntityCards, type EntFacts } from "./entcard";
import { closeEntityCard, entityCardOpen, hideEntityCard, showEntityCard } from "./entcard";
import { loadChatSizes, onChatSize, onTermSize, setTermDefault, sizePanel, stepChatSizes, stepTermSize, termFontSize } from "./chatsize";
import { PREFS, prefBool, prefJSON, prefNumber, prefRaw, prefSet, prefSetBool, prefText, type PrefDef } from "./prefs";
import { popover } from "./popover";
import { RECONNECT_SETTLED_MS, reconnectDelay } from "./backoff";
import { pollPlan } from "./pollplan";
import { liveLine, liveWord, paintLiveLine, type LiveState } from "./livestate";
import { recallButton, recallNotice, recalledBodies, recalledText, sendNowButton, type RecallKind, type RecallResult } from "./recall";
import { isInterruptMark, otherSender, pendingSettledBy, splitDeliveryHeader, unwrapPasted } from "./pendingsend";
import { deliveryParts, type DeliveryPart } from "./delivery-format";
import { RUECKFRAGE_SATZ, sendFailureMessage, sendFailureToastMs, VERTRAUEN_SATZ } from "./pendingsend";
import { isSlashLine, slashCommand, slashOutput, slashSentence, type SlashCommand, type SlashOutput } from "./slashcommand";
import { askRisk, onDialogWillOpen } from "./dialog";
import { openKonstellation, renderKonstellation } from "./konstellation";
import { gitUnquote, porcelainPath } from "./gitpath";
import { matchTree, treeOf, type TreeNode } from "./filetree";
import { PLA_ACK_KEY, postLandAlarm } from "./plaudit";
import { METER_STATIONS, laneDisplayName, laneTail, laneTitleOf, meterKind, meterLine, mmss, shortTitle, suiteMeter, type MeterBall, type MeterStation } from "./suitemeter";
import { PANE_ACK_STALE_MS, opsOpen, opsUnacked, opsSubject, opsSummary, type OpsPollRow } from "./opsevents";
import {
  projectTaskWaves,
  type ProjectedWaveTask, type TaskCardSize, type TaskWaveProjection, type TaskWaveUnresolved,
} from "../task-waves";
import { projectLandWaves, LAND_WAVE_COSTS_2026_09, LAND_WAVE_ROWS_MAX,
  type BundleProposal, type LandWave, type LandWaveCosts, type LandWaveProjection } from "../task-land-waves";
// the same first-sentence reduction the dispatched notes block renders with — imported rather than
// re-spelled so the wave evidence and the brief's note lines cut a row at the same place
import { noteFirstSentence } from "../task-notes";
import type { Task as ServerTask } from "../server/types";
import type { StartPlan, StartPlanNext } from "../start-plan";
import type { WaitRow } from "../waits";
// everything this file and server.ts must say identically — see src/protocol.ts. Importing rather
// than re-declaring is what makes tsc, which gates every land, the thing that notices a drift.
import {
  WS_INPUT_MAX_BYTES, INSTANCE_NAME_RE, INSTANCE_URL_RE, normalizeLaneAnchor,
  codexCliSnapshotFrom, codexCliUnknown, compareCodexCli, type CodexCliSnapshot,
  instanceSourceFrom, instanceBandText, type InstanceSource,
  type GitInfo, type InstanceLink, type LaneAnchor, type PostLandAuditInfo, type PostLandAuditLiveInfo,
  type SuiteOfferRow, type SubscriptionUsage, type SubscriptionWindow,
} from "./protocol";
// the list-on-the-left / thing-in-full-on-the-right window shared by review, picker, queue and
// the outcome feed. Chrome only — every renderer below still owns its own rows and data.
import { openShell, type Shell, type ShellRow } from "./shell";
import { GRUPPE, type SetupDatei } from "./fassung-umfeld-zeilen";
import { loadTimeline, type TimelineEvent, type TimelineKind, type TimelineModel, type TimelineSession } from "./timeline";
import { flotteNeu, openK15Entwurf } from "./k15-lader";
import { runningEffort, runningModel } from "./running";

if (/Chrome\/|Chromium\//.test(navigator.userAgent) && !/CriOS\//.test(navigator.userAgent)) {
  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (viewport && !viewport.content.includes("interactive-widget="))
    viewport.content = `${viewport.content}, interactive-widget=resizes-content`;
}

export const $ = (id: string) => document.getElementById(id)!;
export const slotsEl = $("slots"), dot = $("dot"),
  ta = $("input") as HTMLTextAreaElement, send = $("send") as HTMLButtonElement,
  gate = $("gate"), gateIn = $("gatein") as HTMLInputElement,
  chipsEl = $("chips"), panesEl = $("panes");

export const RECENT_MS = 5000;
const MAX_CHUNK = WS_INPUT_MAX_BYTES; // the server drops a larger frame in silence — one number, both ends
const LAYOUTS: Record<string, number> = { "1": 1, "2": 2, "3": 3, "4": 4 };

// must match the mobile media query in index.html
export const MOBILE_MQ = matchMedia("(max-width: 700px), ((pointer: coarse) and (max-height: 500px))");
export const isMobile = () => MOBILE_MQ.matches;
// MOBILE_MQ's second arm, held to a wide page — the phone on its side (index.html's reading-mode
// block), no width limit of its own. The 8/5 tells it from the phone UPRIGHT with the keyboard up in
// a browser whose keyboard shrinks the layout viewport (a phone browser, the owner's: 414 x ~385, 1.1):
// that page is under 500 px too, and the reading mode hid #comp under the focused field — the focus
// went, the keyboard flashed and closed. On its side a phone is ~2 or wider, with the keyboard more.
const LANDSCAPE_MQ = matchMedia("(pointer: coarse) and (max-height: 500px) and (min-aspect-ratio: 8/5)");

// Terminal links (bare urls via WebLinksAddon, OSC 8 via the linkHandler option) open on
// Cmd/Ctrl-click, not a plain click: xterm activates a link on mouseup whenever the mousedown hit
// the same link (Linkifier._handleMouseUp), so a drag that selects the url to copy it would also
// open it. A touch screen has no modifier and xterm there does no drag-selection, so a tap opens.
// http(s) only — the same bar xterm's own OSC 8 path applies — in a new tab without an opener.
// No event = the link card's Öffnen, itself the click.
function openTermLink(e: MouseEvent | null, uri: string): void {
  if (e && !(e.metaKey || e.ctrlKey || isMobile())) return;
  let proto = "";
  try { proto = new URL(uri).protocol; } catch { return; }
  if (proto !== "http:" && proto !== "https:") return;
  window.open(uri, "_blank", "noopener,noreferrer");
}

// Mangel 63 (owner 15.10.: „[Zitat entfernt]“): the plain
// click on a url stays a selection gesture (above), so at the desk the hover card carries the click — Öffnen opens
// the whole address, Kopieren copies it in one piece. Claude Code writes a wrapped url row by row, each row an
// OSC 8 link to the full address, so whichever row the pointer is on hands over all of it.
let linkCardTimer: ReturnType<typeof setTimeout> | undefined;
function linkFacts(uri: string): EntFacts | null {
  let url: URL;
  try { url = new URL(uri); } catch { return null; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return { title: url.host, meta: `Link · ${uri.length} Zeichen · ${APPLE ? "⌘" : "Strg"}-Klick öffnet direkt`,
    lines: [uri.length > 160 ? `${uri.slice(0, 160)}…` : uri],
    openLabel: "Öffnen", open: () => openTermLink(null, uri), copy: () => copyText(uri) };
}
function termLinkHover(e: MouseEvent, uri: string): void {
  clearTimeout(linkCardTimer);
  if (isMobile()) return;
  const { clientX: x, clientY: y } = e;
  // from one row of a wrapped url to the next the card follows at once, as entcard's own enter does
  linkCardTimer = setTimeout(() => showEntityCard("link", uri, x, y + 8, (_kind, id) => linkFacts(id)), entityCardOpen() ? 0 : 350);
}
function termLinkLeave(): void {
  clearTimeout(linkCardTimer);
  hideEntityCard();
}

let dataSaver = prefBool("fleet.datasaver");
const plan = () => pollPlan(document.hidden, dataSaver);

const mdot = $("mdot"), mtitle = $("mtitle"), mreadTitle = $("mreadtitle");
function setConn(on: boolean) {
  for (const d of [dot, mdot]) d.className = `dot ${on ? "on" : "off"}`;
}

export function setDrawer(open: boolean) {
  document.body.classList.toggle("drawer", open);
}
// a dialog opened while the drawer is out would land UNDER it (#side z 30 > .overlay z 20) — the
// dialog helper closes it first, through this one handover, so the mechanism stays setDrawer's.
// The phone's sheets (closeSheet, the island block) sit at the same height and go the same way.
onDialogWillOpen(() => { setDrawer(false); closeSheet(); });
$("menu").onclick = () => setDrawer(true);
$("shade").onclick = () => setDrawer(false);
// mobile's settings gear (#mset, on the place the duplicate #refresh freed — the reconnect lives
// on the pane's own ↻ now, which the phone shows in the corner group). Desktop's gear sits in each
// pane's group; both open the same window. The phone upright has no #mhead: there the gear is the
// row "Einstellungen" of the tools sheet behind the top island's ⋯ (renderSheet), still one gear.
$("mset").appendChild(icon("gear"));
$("mset").onclick = () => openSettings($("mset"));

// --- desktop sidebar collapse (persisted). The .collapsed class is desktop-only:
// on mobile #side is the slide-in drawer, so applyCollapsed strips it there ---
const sideEl = $("side"), collapseBtn = $("collapse");
let sideCollapsed = false;
function applyCollapsed() {
  sideEl.classList.toggle("collapsed", sideCollapsed && !isMobile());
  collapseBtn.textContent = sideCollapsed ? "›" : "‹"; // › when collapsed, ‹ when open
  collapseBtn.title = sideCollapsed ? "expand sidebar" : "collapse sidebar";
}
function setCollapsed(on: boolean) {
  sideCollapsed = on;
  prefSetBool("fleet.sidecollapsed", on);
  applyCollapsed();
  // the sidebar's width changed → terminals must refit to the freed/returned space
  requestAnimationFrame(() => { for (const p of panes) p.refit(); });
}
collapseBtn.onclick = () => setCollapsed(!sideCollapsed);

// --- the instance chip and its switcher (dual-host S3) -------------------------------------------
// WHAT THIS IS: the board's answer to "which fleet am I looking at", plus the owner's one-click way
// to look at the other one. Topology A federates BY HAND — two standalone servers, no proxy, no
// shared token, no request between them — so switching here is nothing but the browser navigating
// to another origin. Each instance keeps its own login because a cookie IS per origin; that is not
// a policy this code enforces, it is the reason the feature could be this small.
//
// THE ONE RULE THAT MATTERS: the destination is the projected url and NOTHING is appended to it. No
// token, no query, no path. The charset the server validated against (src/protocol.ts#INSTANCE_URL_RE)
// is re-applied to the WIRE value here, at the boundary, so the board can never be talked into
// navigating somewhere that charset forbids even by its own server.
const instWrap = $("instwrap"), instBtn = $("instbtn") as HTMLButtonElement, instMenu = $("instmenu");
export let instanceName: string | null = null;
export let instanceLinks: InstanceLink[] = [];
// THE UMSCHALTER half of the same wire list (server.ts#instanceChipLinks): on the live board the
// running test instances of this machine, on a test instance the way back to live. Kept apart from
// `instanceLinks` because a test instance is not another computer — the "1/2" and the board's
// "zählt hier nicht" line (src/board.ts) stay about computers.
type SwitchLink = InstanceLink & { kind: "testinstanz" | "live" };
export let switchLinks: SwitchLink[] = [];
let instRendered = "";
let instanceCodexCli: CodexCliSnapshot | null = null;
let instanceObservedNow = 0;
function codexCliLabel(snapshot: CodexCliSnapshot | null, now: number): string {
  const reason = codexCliUnknown(snapshot, now);
  const age = snapshot?.observedAt === null || !snapshot ? "nicht beobachtet"
    : `${Math.max(0, Math.floor((now - snapshot.observedAt) / 60_000))} min alt · ${new Date(snapshot.observedAt).toISOString()}`;
  return `Codex ${reason ? `unknown (${reason})` : snapshot!.version} · ${age}`
    + (snapshot ? ` · ${snapshot.source} · Binary ${snapshot.binary ?? "unknown"} · Boot ${new Date(snapshot.bootAt).toISOString()}` : "");
}

const instMenuOpen = () => instMenu.classList.contains("open");
function setInstMenu(open: boolean) {
  instMenu.classList.toggle("open", open);
}
// the origin a link actually resolves to — `new URL` folds the default port away, so a list that
// spells this instance `http://host:80` still marks itself as "here" instead of offering a switch
// to the page you are already on. Safe without a guard: every survivor passed INSTANCE_URL_RE.
const instOriginOf = (url: string): string => new URL(url).origin;

// THE DEVICE DISPLAY (owner round 9, 2026-09-21: „[Zitat entfernt]“
// 
// ; round 10 chose Fassung B).
// The chip in the title row: a two-screens sign and "1/2" when a list names several computers, one
// screen and a "+" on a single host — the "+" is the hint, its title says what it means (there is
// no setup path in the board yet, so it is not a button of its own). The menu adds one sentence.
const MORE_HOSTS = "Claude Fleet kann mehrere Computer zugleich führen — jeder mit eigenen Sessions. "
  + "Verbunden werden sie über FLEET_INSTANCES.";
const DEV_SIGNS_MAX = 5;
function hostSign(name: IconName, text: string): HTMLElement[] {
  const ic = el("span", "tricon");
  ic.appendChild(icon(name));
  return [ic, el("span", "devname", text)];
}

// THE TESTINSTANZ BAND (ranke-notiz R11, grammatik G2.3): one quiet line above everything, on a
// TEST INSTANCE only — which branch and stand this copy shows and what of it is not on its target
// yet. Fed by `instance.source` of the existing sessions poll, which only an instance started by
// testinstanz.sh carries (server.ts#INSTANCE_SOURCE); the live fleet never sends it, so there the
// element stays hidden and <html> never gets the class that makes room for it. The wire value is
// re-folded through the server's own parser at this boundary, and the words come from one pure
// function (src/protocol.ts#instanceBandText) that e2e/lanes-lifecycle.ts runs without a browser.
const tiBand = $("tiband");
let tiBandRendered = "";
function renderInstanceBand(source: InstanceSource | null) {
  const key = source ? JSON.stringify(source) : "";
  if (key === tiBandRendered) return;
  tiBandRendered = key;
  document.documentElement.classList.toggle("tiband", !!source);
  tiBand.hidden = !source;
  // the browser tab names the copy (owner 14.10.: „[Zitat entfernt]“
  // ): „[Zitat entfernt]“; the live fleet keeps its name
  document.title = source ? `${source.round ? `Runde ${source.round.name}` : source.branch ?? "Testinstanz"}${location.port ? ` · :${location.port}` : ""}` : "Claude Fleet";
  if (!source) { tiBand.replaceChildren(); tiBand.removeAttribute("title"); return; }
  const band = instanceBandText(source, (ms) => new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
  const parts: Node[] = [];
  band.segments.forEach((seg, i) => {
    const span = el("span", "tiseg");
    // the glyph rides inside the first segment and each separator closes its segment, so a wrapped
    // line never starts with a lone glyph or a "·"
    if (i === 0) span.append(icon("ranke"));
    for (const run of seg) span.append(run.mono ? el("span", "timono", run.t) : document.createTextNode(run.t));
    if (i < band.segments.length - 1) span.append(el("span", "tisep", " · "));
    parts.push(span);
  });
  tiBand.replaceChildren(...parts);
  tiBand.title = band.title;
}

// `switches` is the Umschalter half, handed in rather than read from module state: the renderer's
// free names are a contract with the extracted-source fixture in e2e/tasks.ts (R3c), and an
// omitted argument is the board without test instances it has always rendered
function renderInstanceHead(switches: readonly SwitchLink[] = []) {
  const signs = machineSigns();
  const key = JSON.stringify([signs, instanceName, instanceLinks, switches, instanceCodexCli,
    Math.floor(instanceObservedNow / 60_000), codexCliUnknown(instanceCodexCli, instanceObservedNow),
    instanceLinks.map((link) => codexCliUnknown(link.codexCli, instanceObservedNow))]);
  if (key === instRendered) return; // an open menu must survive the 2 s poll
  instRendered = key;
  // the ONE navigation of this client (e2e/pins.ts): the link's own url, nothing appended
  const go = (link: InstanceLink) => () => {
    setInstMenu(false);
    if (instOriginOf(link.url) !== location.origin) location.assign(link.url);
  };
  instWrap.classList.add("on");
  const n = Math.max(instanceLinks.length, 1);
  const at = instanceLinks.findIndex((l) => instOriginOf(l.url) === location.origin);
  // an unnamed single host shows only the screen and its "+": the title row has no room for a word
  const back = switches.some((l) => l.kind === "live");
  const tis = switches.filter((l) => l.kind === "testinstanz").length;
  // THE DEVICES AS INFO DRAWS THEM (owner 2026-10-08: „[Zitat entfernt]“
  // ): one glyph per machine in
  // its state's colour (src/board.ts#machineSigns), so the count of green ones IS the count of what
  // answers. Until the Arbeitsorte were read once the chip keeps its screens and "1/2".
  if (signs) {
    const box = el("span", "devsigns");
    for (const sg of signs.slice(0, DEV_SIGNS_MAX)) {
      const d = el("span", "devsign");
      d.dataset.tone = sg.tone;
      d.appendChild(icon(sg.glyph));
      box.appendChild(d);
    }
    if (signs.length > DEV_SIGNS_MAX) box.appendChild(el("span", "devcount", `+${signs.length - DEV_SIGNS_MAX}`));
    instBtn.replaceChildren(box, ...(switches.length ? [el("span", "devcount", "⇄")] : []));
  } else instBtn.replaceChildren(...hostSign(n > 1 ? "screens" : "screen", instanceName ?? ""),
    el("span", "devcount", n > 1 ? `${at >= 0 ? at + 1 : "?"}/${n}` : "+"),
    ...(switches.length ? [el("span", "devcount", back ? "⇄ live" : `⇄ ${tis}`)] : []));
  const answering = signs ? signs.filter((sg) => sg.tone === "live" || sg.tone === "wait").length : 0;
  instBtn.title = (signs ? `${answering} von ${signs.length} ${signs.length === 1 ? "Gerät antwortet" : "Geräten antworten"}: `
      + `${signs.map((sg) => `${sg.name} ${sg.word}`).join(", ")}. ` : "")
    + (n > 1 ? `Computer ${at >= 0 ? at + 1 : "?"} von ${n} — ${instanceName ?? "unbenannt"}. Klick zeigt die anderen.` : MORE_HOSTS);
  instBtn.setAttribute("aria-label", instBtn.title);
  if (switches.length) instBtn.title += back ? " · Umschalter: zurück zum Live-Fleet"
    : ` · Umschalter: ${tis} ${tis === 1 ? "Testinstanz" : "Testinstanzen"} dieser Maschine`;
  instBtn.title += ` · ${codexCliLabel(instanceCodexCli, instanceObservedNow)}`;
  instBtn.classList.add("pick");
  instBtn.onclick = () => setInstMenu(!instMenuOpen());
  instMenu.replaceChildren(...instanceLinks.map((link) => {
    const here = instOriginOf(link.url) === location.origin;
    const row = el("button", `instrow${here ? " here" : ""}`);
    row.append(el("span", "instname", link.name), el("span", "insturl", here ? "you are here" : link.url));
    const snapshot = here ? instanceCodexCli : codexCliSnapshotFrom(link.codexCli);
    const comparison = compareCodexCli(instanceCodexCli, snapshot, instanceObservedNow);
    const drift = here ? "lokal" : comparison.state === "drift" ? "CLI-Drift"
      : comparison.state === "same" ? "gleiche CLI-Version" : `unknown (${comparison.reason})`;
    row.style.flexWrap = "wrap";
    const detail = el("span", "insturl", `${drift} · ${codexCliLabel(snapshot, instanceObservedNow)}`);
    Object.assign(detail.style, { flexBasis: "100%", whiteSpace: "normal", overflowWrap: "anywhere", textAlign: "left" });
    row.appendChild(detail);
    row.title = here ? `${link.name} — dieses Board` : `${link.name} öffnen · expliziter Snapshot · ${link.url}`;
    row.onclick = go(link);
    return row;
  }));
  if (switches.length) {
    // the Umschalter: same tab, same `go`, a bare origin — on the live board each running
    // test instance, on a test instance the way back
    instMenu.appendChild(el("div", "hint instnote", back ? "Umschalter · zurück" : "Umschalter · Testinstanzen dieser Maschine"));
    for (const link of switches) {
      const row = el("button", "instrow");
      row.style.flexWrap = "wrap";
      // name and origin each on their own line: a worktree name is long, and a phone that cut the
      // origin off would hide the one fact that says where the tap goes
      const name = el("span", "instname", link.kind === "live" ? "Live-Fleet" : link.name);
      const origin = el("span", "insturl", link.url);
      for (const part of [name, origin])
        Object.assign(part.style, { flexBasis: "100%", minWidth: "0", whiteSpace: "normal", overflowWrap: "anywhere", textAlign: "left" });
      row.append(name, origin);
      row.title = link.kind === "live" ? `zurück zum Live-Fleet · ${link.url}` : `Testinstanz ${link.name} · ${link.url}`;
      row.onclick = go(link);
      instMenu.appendChild(row);
    }
    if (!back) instMenu.appendChild(el("div", "hint instnote",
      "Erster Besuch je Gerät: „öffnen“ in der Karte Testinstanzen, danach schaltet der Chip direkt um."));
  }
  instMenu.appendChild(el("div", "hint instnote", `Lokal: ${codexCliLabel(instanceCodexCli, instanceObservedNow)}`));
  instMenu.appendChild(el("div", "hint instnote", MORE_HOSTS));
}

// the instance menu's outside-click and Escape live in src/popover.ts (G4.1/K5) — like every
// popover on this page, one helper owns closing, focus return and the arrow-key row walk
popover({
  panel: () => instMenu,
  trigger: () => instBtn,
  isOpen: instMenuOpen,
  close: (refocus) => { setInstMenu(false); if (refocus) instBtn.focus(); },
  rows: () => [...instMenu.querySelectorAll<HTMLButtonElement>(".instrow")],
});

// navigator.clipboard only exists in a secure context (HTTPS or localhost) — this
// dashboard is normally reached over plain HTTP via a Tailscale IP, so it's undefined
// there and this falls back to the legacy execCommand copy path
export function copyText(text: string) {
  if (navigator.clipboard) {
    void navigator.clipboard.writeText(text);
    return;
  }
  const tmp = document.createElement("textarea");
  tmp.value = text;
  tmp.style.position = "fixed";
  tmp.style.opacity = "0";
  document.body.appendChild(tmp);
  tmp.select();
  document.execCommand("copy");
  document.body.removeChild(tmp);
}

// all dynamic text goes through textContent — cwd/dir names are untrusted for the DOM
export function el(tag: string, className: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

// --- auth gate: cookie is set by /?token=… or pasted here ---
function showGate() {
  gate.style.display = "flex";
  gateIn.focus();
}
// route the pasted token through the server's own /?token=… login endpoint instead of
// setting document.cookie directly — JS can never set an HttpOnly cookie, so a client-side
// set here would silently downgrade the auth cookie below what the URL-based login flow gets
async function submitToken(t: string) {
  const res = await fetch(`/?token=${encodeURIComponent(t)}`);
  if (res.ok) { location.reload(); return; }
  gateIn.classList.add("bad");
  setTimeout(() => gateIn.classList.remove("bad"), 1200);
}
gateIn.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const t = gateIn.value.trim();
  if (!t) return;
  void submitToken(t);
});

interface PerfSpan {
  j: PerfJourney; start: number; done: boolean;
  context: Pick<PerfRecord, "dev" | "saver" | "v" | "slots">;
  attrs: PerfAttrs;
}
const perfBuffer: PerfRecord[] = [];
const perfActive = new Set<PerfSpan>();
const perfRequests = new WeakMap<Response, { url: string; start: number }>();
const perfDeliveries = new WeakMap<Promise<boolean>, { response?: Response }>();
let perfSendClickAt: number | undefined;
const perfPending = new WeakMap<HTMLElement, { span: PerfSpan }>();
let perfBoardStarted = false;
function perfStart(j: PerfJourney, at = performance.now(), attrs: PerfAttrs = {}): PerfSpan {
  const span: PerfSpan = { j, start: at > performance.timeOrigin ? at - performance.timeOrigin : at, done: false,
    context: { dev: isMobile() ? "mobile" : "desktop", saver: dataSaver, v: bundleV, slots: fleet.filter((s) => !!s.cwd).length }, attrs };
  if (document.hidden) span.attrs.hidden = true;
  perfActive.add(span);
  return span;
}
function perfPaint(fn: () => void): void {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}
function perfFinish(span: PerfSpan | null, ok: boolean, res?: Response, painted = false): void {
  if (!span || span.done) return;
  span.done = true;
  const finish = (): void => {
    perfActive.delete(span);
    const ms = span.j === "J3" && span.attrs.responseMs !== null && span.attrs.responseMs !== undefined
      ? span.attrs.responseMs : Math.max(0, performance.now() - span.start);
    const request = res && perfRequests.get(res);
    const req = request && request.start >= span.start ? request : undefined;
    const resource = req ? (performance.getEntriesByName(req.url, "resource") as PerformanceResourceTiming[])
      .filter((e) => e.startTime >= req.start - 1).at(-1) : undefined;
    const total = resource?.serverTiming?.find((t) => t.name === "total")?.duration
      ?? (req && res?.headers.get("server-timing")?.match(/(?:^|,\s*)total;dur=([\d.]+)/)?.[1]);
    const serverMs = total === undefined ? null : Number(total);
    const netMs = resource && serverMs !== null ? Math.max(0, resource.responseEnd - resource.startTime - serverMs) : null;
    if (resource) span.attrs.bytes ??= resource.encodedBodySize;
    if (request && serverMs === null) span.attrs.serverMs = "timing-unavailable";
    if (span.j === "J1") {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const bundle = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).find((e) => new URL(e.name).pathname === "/app.js");
      span.attrs.htmlBytes = nav?.encodedBodySize ?? 0;
      span.attrs.bundleBytes = bundle?.encodedBodySize ?? 0;
      span.attrs.cold = (bundle?.transferSize ?? 0) > 0;
      span.context.v = bundleV;
      span.context.slots = fleet.filter((s) => !!s.cwd).length;
    }
    const record: PerfRecord = { ...span.context, j: span.j, ok, ms: ok ? ms : null,
      clientMs: ok ? Math.max(0, ms - (serverMs ?? 0) - (netMs ?? 0)) : null,
      serverMs: ok ? serverMs : null, netMs: ok ? netMs : null, attrs: span.attrs };
    if (perfBuffer.length < PERF_BATCH_MAX * 2) perfBuffer.push(record);
  };
  if (ok && !painted) perfPaint(finish); else {
    if (!ok && span.j === "J3") span.attrs.responseMs = null;
    finish();
  }
}
function perfBoardReady(span: PerfSpan, res: Response, input = ta): void {
  const observer = new MutationObserver(() => { if (!input.disabled) perfPaint(ready); });
  const cleanup = (): void => { observer.disconnect(); clearTimeout(timeout); };
  const ready = (): void => {
    if (span.done) { cleanup(); return; }
    if (input.disabled) { observer.observe(input, { attributes: true, attributeFilter: ["disabled"] }); return; }
    cleanup();
    perfFinish(span, true, res, true);
  };
  const timeout = setTimeout(() => {
    cleanup();
    if (span.done) return;
    span.attrs.reason = "composer-timeout";
    perfFinish(span, false);
  }, 30_000);
  perfPaint(ready);
}
function perfVisibility(): void {
  if (!document.hidden) return;
  for (const span of perfActive) span.attrs.hidden = true;
  flushPerf();
}
function flushPerf(): void {
  while (perfBuffer.length) {
    const batch = perfBuffer.slice(0, PERF_BATCH_MAX);
    if (!navigator.sendBeacon("/api/perf", new Blob([JSON.stringify(batch)], { type: "application/json" }))) return;
    perfBuffer.splice(0, batch.length);
  }
}
setInterval(flushPerf, 60_000);
// the board's own field rows (src/fieldperf.ts): its build and the server's boot head with every row
initFieldPerf({ v: () => bundleV, sha: () => deployGapInfo?.bootHead ?? null }, ta);
document.addEventListener("visibilitychange", perfVisibility);

export async function api(path: string, init?: RequestInit): Promise<Response> {
  const timed = path === "/api/sessions" || path === "/send" || /^\/api\/slots\/\d+\/(transcript|brief)(?:\?|$)/.test(path);
  const start = timed ? performance.now() : 0;
  const res = await fetch(path, init);
  if (timed) perfRequests.set(res, { url: new URL(path, location.href).href, start });
  if (res.status === 401) showGate();
  return res;
}
export const post = (path: string, body: unknown) =>
  api(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// --- fleet state ---
interface ShareInfo { id: string; password: string; created: number; guests: number; comments: number }
interface AutoInfo {
  id: string; slot: number; text: string; everySec: number | null; nextAt: number;
  runsLeft: number; idleSec: number; enabled: boolean; lastRun: number; lastResult: string | null;
}
export interface WorktreeInfo { repo: string; branch: string; anchor?: LaneAnchor; letter?: string; resumedFrom?: LaneResumeInfo }
// server/types.ts#LaneResume — present only on a lane reopened from a review candidate
interface LaneResumeInfo { candidate: string; head: string; reportId: string; parkedAt: number; resumedAt: number; verify: "stale" }
export interface SlotInfo {
  id: number; cwd: string | null; label: string | null; lastOutput: number;
  // Both are optional for compatibility with an older server. `repo` is the canonical toplevel;
  // cwd can be a subdirectory and therefore cannot substitute for it in an ownership join.
  openedAt?: number; repo?: string | null;
  share?: ShareInfo | null; git?: GitInfo | null; worktree?: WorktreeInfo | null; mergePending?: boolean;
  // WHAT THIS PANE WAS STARTED WITH — the founding choices, all on the poll since the row was
  // widened, none of them read by the board before. `model` is the spawn-time model the server
  // already puts on the row; `browser`/`context` are omitted unless chosen.
  model?: string | null; browser?: true; context?: { window: number; compactAt: number };
  // the pane FOOTER's model (rank 2 of src/running.ts#runningModel), omitted until the capture tick read one
  paneModel?: string;
  // the occupant's measured workplace (server.ts /api/sessions), omitted while there is none; read by the
  // constellation window (src/konstellation.ts)
  workplace?: { path: string; mainCheckout: boolean; measuredAt: number } | null;
  // the role of its last claude spawn and the built-in tools on that line (null = no --tools, all of them);
  // absent for another harness and for a session started before the server recorded it (server.ts#ensureSlot)
  spawn?: { role: "lane" | "main" | "orchestrator" | "generic"; tools: number | null };
  modelSuperseded?: { id: string; supersededBy?: string };
  // the permission mode Claude Code wrote last into this session's transcript (auto, bypassPermissions, …);
  // absent = not a claude session, or no such line in the tail yet
  permissionMode?: string;
  // "no-agent" is the one value that matters: a typeable pane with nothing behind it. null/absent
  // = the slow tick has not reached this slot, which is not an answer and must not paint one.
  agent?: "alive" | "no-agent" | "no-pane" | "unprobed" | null;
  codexFirstTurn?: { openedAt: number; sessionId: string; source: "codex-rollout";
    observedAt: number; turn: CodexFirstTurn } | null;
  // omitted unless true / unless armed — see the server's slot row. `autoCloseRefusal: null` on a
  // lane is an ANSWER ("nothing refuses this lane"), absent is "the question does not apply".
  stalled?: true; stalledSince?: number; autoCloseRefusal?: string | null;
  // which session of its line this row is, and what the lane cap has spent (server.ts#
  // successionRowView). ABSENT = no succession recorded for this occupant, which is an answer and
  // is NOT the same claim as "session 1" — the server cannot tell a founding main apart from one
  // whose lineage was never recorded, so nothing is printed for an absent key.
  succession?: { session: number; taken: number | null; cap: number | null };
  // which agent this session runs. ABSENT means the default harness — the server omits the field
  // when it is null (it is the 2 s poll), so absent and "claude" are the same state here too.
  permissions?: { sandbox: "read-only" | "workspace-write" | "danger-full-access"; approval: "on-request" | "never" } | { state: "invalid" };
  harness?: string; effort?: string;
  // what the session is for (server.ts, the /api/sessions slot row) — absent means none set
  mission?: string; awaiting?: "owner" | "main"; taskId?: string; taskHead?: string; programId?: string;
  // the session that opened this one with its self token (server/opener.ts); matched by slot + cwd
  openedBy?: { slot: number; openedAt: number; cwd: string };
  // the run of a constellation it sits in, on which position (server/laeufe.ts)
  lauf?: { id: string; pos: string };
  // the role the server gives this session (server.ts#positionRole), separate from the label the
  // owner typed. ABSENT = no role a label could claim: a lane (see `worktree`) or a plain session.
  role?: "program-main" | "orchestrator";
  // how this session's Postfach arrives (Slot.zustellung, server/zustellung.ts). ABSENT = not set,
  // and the role default applies: a slot with a worktree (a lane) bundles, every other comes direct.
  zustellung?: "direkt" | "gebuendelt";
  // what this session started with on top of its predecessor, one word per stone: the pack ids, then „purpose“
  // (Slot.selbst.neu, POST /api/self/einrichten). ABSENT = nothing new at its start.
  gaveItself?: string[];
  // the addresses this occupant reads its Postfach under (server.ts#messageAddressesFor, the same list
  // GET /api/self/messages answers as `addresses`): a role or a Program beside or instead of its own.
  // ABSENT = only its own session or lane address, which the board knows from id and openedAt.
  addresses?: { kind: string; slot?: number; openedAt?: number; id?: string; role?: string }[];
  // a task lane's full title, derived by the server from its founding card on every poll
  // (src/suitemeter.ts#laneTitleOf) — absent when there was nothing to derive it from
  taskTitle?: string;
  // WHICH BOX and WHICH DAEMON this session's agent runs in. Present — RESOLVED, never null —
  // exactly when the slot's harness has a container concept, absent otherwise; that is the one
  // question the fleet-wide env could not answer per session.
  container?: string; containerContext?: string;
  // how full this session's context is (server.ts, contextFill). null is an ANSWER — Fleet cannot
  // tell for this slot (no pinned transcript, no usage line yet, a harness that writes none, or a
  // model whose window it cannot name) — and must never be painted as an empty/fresh context.
  ctx?: { usedTokens: number; windowTokens: number; pct: number } | null;
  // B3 · what Fleet TYPED into this pane today (server.ts, the send ledger's own counter). ABSENT
  // means nothing was delivered today — the server omits the key on the 2 s poll — and absent is
  // therefore an answer, not a gap: a session nobody has written to since midnight.
  inbound?: { sends: number; bytes: number };
  // owner /sends parked behind an occupied composer (server.ts, THE PARKED SEND): how many wait,
  // the size of the draft that blocks them, since when. ABSENT = nothing waits.
  parkedSend?: { count: number; draftChars: number; since: number };
  // Fleet deliveries a bundle holds for this session (server.ts#heldDeliveriesView): how many, when
  // the bundle is due (null = until the next send), which paths. ABSENT = nothing held.
  heldDeliveries?: HeldDeliveries;
  // Claude Code's permission question on this session's screen (server.ts#rueckfrageView): its header and question,
  // never the command. ABSENT = none. The session waits on a person: nothing sent from here answers it.
  rueckfrage?: string;
  // Claude Code's trust question on this session's screen (server.ts#vertrauenView). ABSENT = none. Answered in the terminal
  vertrauen?: boolean;
  // the board's last model/effort switch and what Claude Code made of it (server.ts#startModelSwitch). ABSENT = none
  modelSwitch?: ModelSwitch;
  // Codex rollout discovery is lazy and can terminally refuse ambiguity/loss. This is a typed
  // claim about the server poll, not inferred from harness/session recency in the client.
  codexRecovery?: { state: "pending" | "bound" | "ambiguous" | "lost";
    sessionId: string | null; disconnectSeenAt: number | null };
  // when this occupant last wrote its standing handover (server.ts sessions row); omitted when none
  standingHandover?: { at: number } }
interface CodexCandidateInfo { id: string; timestamp: number }
interface CodexCandidatesView {
  state: "pending" | "bound" | "ambiguous" | "lost";
  sessionId: string | null;
  sessionsRoot: boolean;
  candidates: CodexCandidateInfo[];
  boundElsewhere: (CodexCandidateInfo & { slot: number })[];
  total: number | null;
  truncated: boolean;
}
// the static harness catalogue (GET /api/harnesses, fetched once). `supports` is the server's,
// never a second copy maintained here: a feature this client hides must be hidden because the
// registry says the harness cannot do it, not because someone wrote the same list twice.
export interface HarnessInfo { id: string; permissions?: { status: "unsupported" } | { status: "supported";
  sandbox: ("read-only" | "workspace-write" | "danger-full-access")[]; approval: ("on-request" | "never")[];
  default: { sandbox: "read-only" | "workspace-write" | "danger-full-access"; approval: "on-request" | "never" } }; supports: { resume: boolean; transcript: boolean; model: boolean;
  effort: boolean; selfSchedule: boolean; container: boolean;
  // the conversation view has something to read: a Claude transcript OR the adapter's own reader
  // (codex rollout, pi session — server.ts#Harness.conversation). Optional for an older server,
  // which then answers with `transcript` alone.
  chat?: boolean }; effortLevels: string[]; note: string | null; default: boolean;
  // the adapter's pick list for the composer's model switch (server.ts#Harness.models) — a menu,
  // not a gate; optional for an older server, which then gets the free-text field alone
  models?: string[];
  // the TUI's safely-sendable slash commands (server.ts#HarnessCommand), same one-shot catalogue.
  // Optional for an older server, which then simply offers none; the ⌘-overlay renders exactly
  // this list — never a second, client-side copy of any harness's commands.
  commands?: { name: string; purpose: string; confirm?: boolean }[];
  // Optional for an older server. False is a hard server policy too; this copy only prevents a
  // picker gesture whose answer is already known. Singleton is shown through the adapter note.
  allowsLanes?: boolean; singleton?: boolean;
  // "agent" = a harness you pick; "place" = an execution hull (the container entry). Two axes that
  // shared one field until 2026-08-10, which is why `container` stood in the harness dropdown as if
  // it were a peer of claude. OPTIONAL because it is a claim about a foreign surface: an older
  // server does not send it, and `agentHarnesses()` treats a missing role as "agent" so the picker
  // degrades to the previous behaviour instead of rendering an empty dropdown.
  role?: "agent" | "place" }
// the harnesses a human PICKS. `container` is deliberately not among them: it answers "where does
// this run", not "what am I working with", and offering it as an agent also silently chose one
// (whatever FLEET_CMD is inside the image). The adapter still exists and the API still accepts it.
export const agentHarnesses = (): HarnessInfo[] => harnesses.filter((h) => (h.role ?? "agent") === "agent");
// what the 2 s poll carries per task — mirrors server.ts's TaskDigest. No `text`: the prompt
// bodies are fetched once from /api/tasks when the queue overlay opens (see loadTaskTexts).
// The optional fields are absent, not null, when unset.
// `source` is the SERVER's own union, imported rather than mirrored: the mirror said
// owner|intake|steward after ACP-23 added „[Zitat entfernt]“, and the `as` cast in refresh hid it, so every
// MAIN-filed row rendered as "owner". A new producer now fails tsc in taskSourceLabel's switch.
export interface TaskInfo { id: string; source: ServerTask["source"];
  modelSuperseded?: { id: string; supersededBy?: string };
  // MIRRORS server.ts's TASK_KINDS — and it is a claim about a foreign surface, not a type the
  // server hands us. It said `"lane" | "note"` for the whole life of the four-kind rename
  // (dd0c9a8): every `kind === "note"` below still compiled and was simply false forever, so the
  // observation grouping, its chip and its guards went dead without one compiler word. Widen this
  // FIRST when the server's set changes — tsc then names every site that has to follow.
  kind?: "auftrag" | "richtung" | "notiz" | "betrieb"; status: "pending" | "queued" | "sent" | "done" | "archived"; created: number; slot?: number; note?: string; repo?: string; programId?: string;
  // Task.review: "advisory" = ③ reviews this row's lane once it looks done and files the verdict
  // (server.ts#fileLaneReview). Absent = not asked for; the server never sends "none".
  review?: "advisory";
  // E4 · the variant group (server/types.ts#Task.variants): a GROUP row carries the filed choices and,
  // once decided, which variant lands; a VARIANT row names its group and its 1-based place in it.
  variants?: { harness: string | null; model: string | null; effort: string | null }[];
  variantOf?: string; variantIndex?: number;
  variantDecision?: { winner: string; by: string; at: number; shelved: string[] };
  variantCompareArmedAt?: number;
  variantCompare?: { at: number; winner: string; stage: string };
  // Bounded generation/presence only; the brief text remains on GET /api/tasks.
  briefAt?: number;
  // deterministic file/cluster facts from taskDigest. Absence is UNKNOWN, never an empty surface.
  files?: string[]; filesOrigin?: "confirmed" | "card" | "derived";
  // the row's card size (a valid card only) — the land fold's weight; absent = mittel there
  size?: TaskCardSize;
  // the PROPOSED surface (W2), carried WHOLE on the poll rather than as a shape digest: `files`
  // above already rides it, and a proposal reduced to a count would be the one list on this row a
  // reader could not hold against the one it is meant to replace — which is the entire act the
  // confirm button ends. `unknownPaths` keeps its three states: absent = the tracked tree could not
  // be read, [] = checked and all tracked, a list = these paths this repo does not track.
  filesProposal?: { files: string[]; at: number; by: string; unknownPaths?: string[] };
  cluster?: { projekt: string; prozess: string; unterprozess?: string };
  // the poll carries only the timestamps; the text rides the queue overlay's /api/tasks fetch
  criterion?: { text?: string; proposedAt: number; confirmedAt: number | null };
  // comments: the poll carries only how many and how recent — enough for the row chip and to
  // notice a new one; the texts ride /api/tasks like every other body on this row
  comments?: { n: number; at: number };
  // N3: how many SOURCES this row pins (auftrag) and how many task-scoped verdicts stand on this
  // note (notiz). Counts only, like `comments` and for its reason — the pins and the verdicts
  // themselves ride /api/tasks. Absent means none, which is the same fact on both fields.
  notes?: { n: number; at: number };
  verdicts?: { n: number; at: number };
  // N2: the lands that moved a file this row's surface names, newest first, capped at five by the
  // server. Advisory — it changes no action and no status. ABSENT is "nothing recorded", never
  // "untouched": the two owner ⏏ paths land already-integrated work and measure nothing.
  touched?: { sha: string; branch: string; at: number }[];
  hold?: { by: "main"; slot: number; at: number; grund: string | null } }
// `waveBudget` is the server's live FLEET_LAND_WAVE_BUDGET: the board's land fold must cut with the
// number the wave door checks, or it offers waves the door refuses. Absent on an older server.
// `lanes` (busy lanes in the dispatch repo) and `quiet` (the machine's quiet window is open NOW, by
// the server's clock) let the queue foot name the gate that holds; absent on an older server.
interface DispatchInfo { available: boolean; on: boolean; maxLanes: number; repo: string; waveBudget?: number;
  lanes?: number; quiet?: boolean }
export let fleet: SlotInfo[] = [];
// the harness catalogue, fetched ONCE (it is a server constant) the first time a reader needs it.
// Empty until then, and every reader treats empty as "only the default exists" — so a failed or
// pending fetch degrades to exactly the pre-harness UI rather than to a broken one.
export let harnesses: HarnessInfo[] = [];
let harnessesLoaded = false;
// what a null model launches on the DEFAULT adapter, from the same fetch. Shown as the model
// field's placeholder so "leave it empty" is a visible choice rather than a guess. Claude-only by
// construction (the server says so): a foreign adapter keeps its own implicit default, and the
// placeholder says "default" there rather than claiming this value applies to it.
export let defaultModel: string | null = null;
let modelRegistry: (ModelEntry & { availability: ModelAvailability })[] = [];
export function modelNotice(harness: string, id: string): string {
  const entry = modelRegistry.find((row) => row.harness === harness && row.id === id);
  if (!entry) return "";
  const parts = [entry.status === "superseded"
    ? `superseded${entry.supersededBy ? ` → ${entry.supersededBy}` : ""}` : ""];
  if (harness === "codex" && entry.availability !== "available") parts.push(entry.availability);
  return parts.filter(Boolean).join(" · ");
}
export async function loadHarnesses(): Promise<void> {
  if (harnessesLoaded) return;
  try {
    const res = await api("/api/harnesses");
    if (!res.ok) return;
    const cat = (await res.json()) as { harnesses: HarnessInfo[]; defaultModel?: string;
      modelRegistry?: (ModelEntry & { availability: ModelAvailability })[] };
    defaultModel = typeof cat.defaultModel === "string" ? cat.defaultModel : null;
    modelRegistry = cat.modelRegistry ?? [];
    harnesses = cat.harnesses;
    harnessesLoaded = true;
  } catch { /* leave it empty: the picker then offers the default only, which always works */ }
}
// what a SLOT's harness can do. Absent id → the registry's default; unknown id (an old client
// against a newer server, or vice versa) → assume the default's capabilities rather than hide
// working features. Empty catalogue → every capability true, i.e. today's behaviour.
function supportsOf(h: string | undefined): HarnessInfo["supports"] {
  const found = harnesses.find((x) => x.id === h) ?? harnesses.find((x) => x.default);
  // `container` is the one that falls back FALSE rather than true: every other field's optimistic
  // default means "do not hide a working feature", but an optimistic container would offer a box
  // control on a harness that has none — inventing a capability instead of degrading to today's UI.
  return found?.supports ?? { resume: true, transcript: true, model: true, effort: true, selfSchedule: true, container: false };
}
export const canChatOn = (sup: HarnessInfo["supports"] | undefined): boolean => !!(sup?.chat ?? sup?.transcript);
// THE SLOT'S OWN ADAPTER ENTRY, for the surfaces that must show a control only where the harness
// carries it. Deliberately stricter than supportsOf(): that one answers "assume today's behaviour"
// for an unloaded catalogue, which is right for hiding a feature and wrong for OFFERING one — an
// optimistic default here would paint a model button on a pi slot. null therefore means "not
// answerable yet", and the caller renders nothing until loadHarnesses() has run.
export function harnessEntry(slot: number): HarnessInfo | null {
  if (!harnesses.length) return null;
  const s = fleet.find((x) => x.id === slot);
  if (!s?.cwd) return null;
  return harnesses.find((h) => h.id === s.harness) ?? (s.harness ? null : harnesses.find((h) => h.default) ?? null);
}

export function paneCommand(h: HarnessInfo | null, field: "model" | "effort", value: string): string | null {
  if (h?.id === "claude") return `/${field} ${value}`;
  if (h?.id === "pi-zai") return field === "model" ? `/model zai/${value}` : `/thinking ${value}`;
  return null;
}
export const switchesInPane = (h: HarnessInfo | null): boolean => paneCommand(h, "model", "") !== null;
// `switched`: the switch the server started for exactly this value — the sentence then follows its row state
export async function setSlotSetting(slot: number, field: "model" | "effort", value: string): Promise<{ text: string; switched?: ModelSwitch }> {
  const what = field === "model" ? "Modell" : "Effort";
  if (switchesInPane(harnessEntry(slot))) {
    // one request: the server records the value, types the command and answers Claude Code's question for exactly
    // this value (server/model-switch.ts, Mangel 53); what follows rides the slot row as `modelSwitch` (switchText)
    const res = await post(`/api/slots/${slot}/model`, { [field]: value, push: true });
    const j = (await res.json().catch(() => null)) as { error?: string; modelSwitch?: ModelSwitch } | null;
    if (res.status === 400) return { text: `Nicht umgestellt: ${j?.error ?? "HTTP 400"} — die Session läuft unverändert` };
    if (!res.ok) return { text: `Vermerkt, aber nicht getippt: ${j?.error ?? `HTTP ${res.status}`}` };
    return j?.modelSwitch ? { text: switchText(j.modelSwitch), switched: j.modelSwitch } : { text: `${what} ${value} — getippt` };
  }
  const rec = await post(`/api/slots/${slot}/model`, { [field]: value });
  if (!rec.ok) {
    const why = ((await rec.json().catch(() => null)) as { error?: string } | null)?.error ?? `HTTP ${rec.status}`;
    return { text: `Nicht umgestellt: ${why} — die Session läuft unverändert` };
  }
  const r = await post(`/api/slots/${slot}/restart`, {});
  const j = (await r.json().catch(() => null)) as { resumed?: boolean; error?: string } | null;
  if (!r.ok) return { text: `Vermerkt, aber der Neustart ging nicht: ${j?.error ?? `HTTP ${r.status}`} — sie läuft noch mit dem alten ${what}` };
  return { text: `${what} ${value} — neu gestartet${j?.resumed ? ", das Gespräch geht weiter" : ", FRISCH (das Gespräch ließ sich nicht fortsetzen)"}` };
}
// the sentence under the switch for what Claude Code made of it
export function switchText(sw: ModelSwitch): string {
  const what = sw.field === "model" ? modelLabel(sw.want) : `Effort ${sw.want}`;
  switch (sw.state) {
    case "typed": return `${what} — getippt, die Session stellt um, wenn der laufende Schritt endet`;
    case "set": return `${what} — umgestellt`;
    case "kept": return sw.field === "model" ? "Claude Code hat das alte Modell behalten" : "Claude Code hat die alte Stufe behalten";
    case "asks": return "Claude Code fragt im Terminal — dort beantworten";
    case "not-set": return `${what} — nicht umgestellt`;
  }
}

export let autosList: AutoInfo[] = [];
export let tasksList: TaskInfo[] = [];
export let dispatch: DispatchInfo = { available: false, on: false, maxLanes: 0, repo: "" };
// the automation kill-switch and quiet hours, as the owner poll carries them. Read by the settings
// window's "Fleet" rows only; null until the first poll (and on a server that predates the fields).
export let autosOnSrv: boolean | null = null;
export let quietHoursSrv: { start: number; end: number } | null = null;
// Whether THIS fleet writes the integration branch (server.ts, FLEET_LANDS). A follower instance
// fast-forwards main from the canonical host and refuses both land doors with a 409; offering ⏏
// there would be a button whose only possible outcome is an alert. Defaults to TRUE and is set from
// `data.lands !== false`, so a server that predates the field — and every ordinary canonical
// instance, which never sets the flag — keeps every land affordance exactly as it was.
export let landsEnabled = true;
// the slots that make the role address "orchestrator" resolve to nobody (server.ts#
// orchestratorAddressConflict) — null while zero or one slot carries an Orchestrator label
let roleConflict: { address: "orchestrator"; slots: number[] } | null = null;
export let serverNow = 0;
// the server's clock minus this device's, from the same poll that carries serverNow. Transcript
// timestamps are written on the server machine; a phone whose clock runs 3 min ahead would
// otherwise read every fresh turn as 3 min old (the cache counter, owner's fourteenth cut).
export let serverClockSkew = 0;
let shareBase = ""; // public URL prefix for share links (FLEET_SHARE_URL server-side)

// --- transcript view model (mirrors server.ts's TEntry/TBlock) ---
interface TBlock { t: "text" | "thinking" | "tool" | "tool_result"; text: string; name?: string;
  id?: string; ref?: string }
// meta = a harness-injected user turn (task-notification): shown folded, not as a "you" bubble
export interface TEntry { n: number; role: "user" | "assistant"; ts: string | null; blocks: TBlock[]; meta?: boolean }

// markdown rendering shared with the guest reader — see src/md.ts


const fmtClock = (ts: string | null) =>
  ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

// --- conversation view chrome: copy buttons, code-block heads, hoverable ids, text size ---
loadChatSizes();
// a column-width change pulls a LIMITED terminal along: the CSS width follows the var, the pane's
// own fit path picks the new box up and tmux gets the new column count (no second resize way)
onChatSize(() => { for (const p of panes) if (p.termIsLimited()) p.refit(); });
// the terminal's font size (card K8): unset, a pane keeps the size it has always started with;
// a change sets every pane and refits it, so tmux gets the new column count the usual way
setTermDefault(() => (isMobile() ? 11 : 12));
onTermSize(() => { for (const p of panes) p.setFontSize(termFontSize()); });

const COPIED_MS = 1200;
function copyButton(label: string, title: string, source: () => string): HTMLButtonElement {
  const btn = el("button", "copybtn", label) as HTMLButtonElement;
  btn.title = title;
  btn.onclick = (e) => {
    e.stopPropagation();
    copyText(source());
    btn.textContent = "copied ✓";
    btn.classList.add("done");
    setTimeout(() => { btn.textContent = label; btn.classList.remove("done"); }, COPIED_MS);
  };
  return btn;
}

// src/md.ts builds the block; the owner view gives it a head with the language, a wrap toggle and
// a copy of the code itself (what you paste into a shell — a fence around it would be in the way)
function decorateCode(code: HTMLElement): void {
  const pre = code.querySelector("pre");
  if (!pre) return;
  code.querySelector(".codelang")?.remove();
  const head = el("div", "cbhead");
  head.appendChild(el("span", "cblang", code.getAttribute("data-lang") || "text"));
  const wrap = el("button", "cbbtn", "wrap") as HTMLButtonElement;
  wrap.title = "toggle line wrap";
  wrap.onclick = (e) => {
    e.stopPropagation();
    const on = code.getAttribute("data-wrap") !== "1";
    code.setAttribute("data-wrap", on ? "1" : "0");
    wrap.classList.toggle("on", on);
  };
  const copy = copyButton("copy", "copy the code", () => pre.textContent ?? "");
  copy.className = "cbbtn";
  head.append(wrap, copy);
  code.insertBefore(head, code.firstChild);
}

// which ids in transcript text become hoverable: only ones this board already knows
function fileReference(id: string): { path: string; line?: number; symbol?: string } | null {
  const m = /^(.+?)(?::(\d+)(?:-\d+)?|#([A-Za-z_$][\w.$-]*))$/.exec(id);
  if (!m || !m[1] || m[1].includes("..")) return null;
  return { path: m[1], line: m[2] ? Number(m[2]) : undefined, symbol: m[3] };
}

export function entityKnown(kind: MdEntityKind, id: string, slot = 0): boolean {
  if (kind === "file") {
    const ref = fileReference(id), cwd = fleet.find((s) => s.id === slot)?.cwd;
    const tree = cwd ? fxTree.get(cwd) : null;
    return !!ref && !!tree && !("error" in tree) && tree.files.includes(ref.path);
  }
  if (kind === "task") return tasksList.some((t) => t.id === id);
  if (kind === "program" && id.length === 8)
    return programsPoll.filter((p) => p.id.startsWith(id)).length === 1;
  if (kind === "program") return programsPoll.some((p) => p.id === id);
  if (kind === "attention") return attnRows.some((a) => a.id === id);
  if (kind === "report") return ownerReportRows.some((r) => r.id === id);
  if (kind === "event") return entityEvents.some((e) => e.id === id) || opsRows.some((e) => e.id === id);
  if (kind === "lane") return fleet.some((sl) => `${sl.id}${sl.worktree?.letter ?? ""}` === id);
  if (kind === "sha") return knownSha(id);
  return kind === "slot" && fleet.some((sl) => sl.id === Number(id));
}

type EntityEvent = { id: string; kind: string; status: string; createdAt: number;
  receiverSlot: number | null; subjectSlot?: number; subjectBranch?: string;
  payload?: Record<string, unknown> };
const entityEvents: EntityEvent[] = [];
const entityDossiers = new Map<string, { value?: Dossier & { resolved?: { result: string; row?: { report?: { status: string; reportedAt: number } } } }; later?: Promise<void> }>();
let entityOutcomes: OutcomeRow[] = [];
let entityDetailsAt = 0;
let entityDetailsBusy = false;
async function loadEntityDetails(): Promise<void> {
  if (entityDetailsBusy || Date.now() - entityDetailsAt < 60_000) return;
  entityDetailsBusy = true;
  await Promise.allSettled([
    loadPrograms(), loadTaskTexts(), loadAttention(), loadOwnerReports(),
    api("/api/events").then(async (r) => {
      if (r.ok) entityEvents.splice(0, entityEvents.length,
        ...(((await r.json()) as { events?: EntityEvent[] }).events ?? []));
    }),
    api("/api/lane-outcomes?limit=1000").then(async (r) => {
      if (r.ok) entityOutcomes = ((await r.json()) as { outcomes?: OutcomeRow[] }).outcomes ?? [];
    }),
  ]);
  entityDetailsAt = Date.now();
  entityDetailsBusy = false;
  for (const pane of panes) if (pane.savedHover) pane.refreshEntities();
}

function entityDossier(id: string): { value?: Dossier & { resolved?: { result: string; row?: { report?: { status: string; reportedAt: number } } } }; later?: Promise<void> } {
  let row = entityDossiers.get(id);
  if (row) return row;
  row = {};
  entityDossiers.set(id, row);
  const target = row;
  target.later = api(`/api/lane?task=${encodeURIComponent(id)}`).then(async (r) => {
    if (r.ok) target.value = await r.json() as typeof target.value;
  }).finally(() => { target.later = undefined; });
  return row;
}

// COMMIT SHAS THE BOARD HAS SEEN. Transcripts cite shas as 7-12 char prefixes; the match is
// prefix-of-a-known-sha, so `abc1234` resolves to the commit the board showed as `abc1234def…`.
// Two sources, both already in memory: every lane's taskHead rides the 2 s poll and is checked
// live; the brief's head and commit lists are remembered as their boards render them. A sha the
// board never saw stays plain text — the negative case, and the honest one.
const shasSeen = new Set<string>();
export function rememberShas(...candidates: (string | null | undefined)[]): void {
  for (const c of candidates) if (c && /^[0-9a-f]{7,40}$/.test(c)) shasSeen.add(c);
}
function knownSha(id: string): boolean {
  if (shasSeen.has(id)) return true;
  for (const s of fleet) if (s.taskHead && s.taskHead.startsWith(id)) return true;
  for (const o of entityOutcomes) if (o.headSha?.startsWith(id) || o.mainAfter?.startsWith(id)) return true;
  for (const s of shasSeen) if (s.startsWith(id)) return true;
  return false;
}

const entTextAsked = new Set<string>();
const fileCardCache = new Map<string, { text?: string; error?: string; later?: Promise<void> }>();
export function describeEntity(kind: string, id: string, slot = 0): EntFacts | null {
  if (kind === "file") {
    if (!entityKnown("file", id, slot)) return null;
    const ref = fileReference(id)!;
    const cwd = fleet.find((s) => s.id === slot)!.cwd!;
    const key = `${cwd}/${ref.path}`;
    let cached = fileCardCache.get(key);
    if (!cached) {
      cached = {};
      fileCardCache.set(key, cached);
      const row = cached;
      row.later = loadFile({ path: key }).then((r) => {
        row.text = r?.text;
        row.error = r?.error ?? (!r?.text ? "Datei konnte nicht gelesen werden" : undefined);
        row.later = undefined;
      });
    }
    const lines = cached.text?.split("\n") ?? [];
    const line = ref.line ?? (ref.symbol ? lines.findIndex((s) => s.includes(ref.symbol!)) + 1 : 0);
    const from = Math.max(1, line - 5), to = Math.min(lines.length, line + 6);
    const excerpt = line > 0 && line <= lines.length
      ? lines.slice(from - 1, to).map((s, i) => `${from + i}: ${s}`) : [];
    return {
      meta: `${ref.path}${line ? `:${line}` : `#${ref.symbol ?? ""}`}`,
      title: ref.path.split("/").pop() ?? ref.path,
      lines: cached.error ? [cached.error] : cached.later ? ["…"] : excerpt.length ? excerpt : ["Stelle nicht gefunden"],
      later: cached.later,
      open: () => { openExplorer(slot, cwd, ref.path, line || undefined); closeEntityCard(); },
    };
  }
  const now = Date.now();
  if (kind === "task") {
    const t = tasksList.find((x) => x.id === id);
    if (!t) return null;
    const text = taskText.get(id);
    // the prompt text is not on the 2 s poll; ask the queue's own loader ONCE per id, then repaint
    const later = text !== undefined ? undefined : taskTextBusy
      ? new Promise<void>((resolve) => taskTextWaiters.push(resolve))
      : !entTextAsked.has(id) ? (entTextAsked.add(id), loadTaskTexts()) : undefined;
    const worker = t.slot ? fleet.find((sl) => sl.id === t.slot) : undefined;
    const workerLine = t.slot
      ? `worker: slot ${t.slot}${worker?.label ? ` · ${worker.label}` : ""}${worker?.model ? ` · ${worker.model}` : ""}`
      : "worker: —";
    const card = taskCardFull.get(id);
    const dossier = entityDossier(id);
    const resolved = dossier.value?.resolved;
    const outcomes = dossier.value?.outcomes;
    const last = outcomes?.state === "read" ? outcomes.value.rows.find((o) => o.disposition === "landed") : undefined;
    return {
      meta: [`task ${t.id}`, t.status, t.kind].filter(Boolean).join(" · "),
      title: text ? qFirstLine(text) : taskTextBusy || later ? "…" : "(no text on this board)",
      lines: [
        workerLine,
        `${taskSourceLabel(t)} · filed ${fmtDur(Math.max(0, now - t.created))} ago`,
        ...(t.cluster ? [[t.cluster.projekt, t.cluster.prozess, t.cluster.unterprozess].filter(Boolean).join(" / ")] : []),
        ...(t.size ? [`size ${t.size}`] : []),
        ...(card ? [`goal: ${card.ziel ?? "—"}`, `done: ${card.done ?? "—"}`,
          `card: ${card.valid ? "valid" : `INVALID · ${card.gaps?.[0] ?? "gap not named"}`}`] : ["card: not recorded"]),
        ...(t.hold ? [`hold: ${t.hold.grund ?? `by MAIN slot ${t.hold.slot}`}`] : []),
        ...(resolved?.row?.report ? [`last report: ${resolved.row.report.status} · ${fmtTs(resolved.row.report.reportedAt)}`] : []),
        ...(last ? [`land: ${typeof last.mainAfter === "string" ? last.mainAfter.slice(0, 8) : "sha unknown"} · ${typeof last.ts === "number" ? fmtTs(last.ts) : "time unknown"}`] : []),
        ...(resolved?.result === "no-lane" ? ["lane: none on record"] : []),
      ],
      later: later ?? dossier.later,
    };
  }
  if (kind === "program") {
    const matching = programsPoll.filter((x) => x.id === id || x.id.startsWith(id));
    const p = matching.length === 1 ? matching[0] : undefined;
    if (!p) return null;
    const full = programsList.find((x) => x.id === p.id);
    const main = full?.main?.slot ? fleet.find((s) => s.id === full.main?.slot) : undefined;
    const rows = tasksList.filter((t) => t.programId === p.id);
    const landed = entityOutcomes.filter((o) => o.disposition === "landed" && (o.programId === p.id
      || !!o.taskId && rows.some((t) => t.id === o.taskId))).sort((a, b) => b.ts - a.ts)[0];
    return {
      meta: `program ${p.id} · ${p.status}`,
      title: p.title,
      lines: [`founded ${fmtDur(Math.max(0, now - p.createdAt))} ago`,
        full?.main?.slot ? `MAIN: slot ${full.main.slot} · ${main?.model ?? "model unknown"} · ${main?.cwd && main.openedAt === full.main.openedAt ? "live" : "not occupying bound session"}`
          : "MAIN: unbound or not loaded",
        `tasks: ${rows.filter((t) => t.status === "sent").length} running · ${rows.filter((t) => t.status === "pending" || t.status === "queued").length} waiting · ${rows.filter((t) => t.status === "done" || t.status === "archived").length} finished`,
        landed ? `last land: ${landed.mainAfter?.slice(0, 8) ?? "sha unknown"} · ${fmtTs(landed.ts)}` : "last land: not in loaded outcomes"],
    };
  }
  if (kind === "attention") {
    const a = attnRows.find((x) => x.id === id);
    return a ? { meta: `attention ${a.id} · ${a.kind}`, title: a.status,
      lines: [`raised ${fmtTs(a.raisedAt)}`, `program ${a.programId}`, `requester slot ${a.requester.slot}`,
        ...(a.closedAt ? [`closed ${fmtTs(a.closedAt)}`] : [])] } : null;
  }
  if (kind === "report") {
    const r = ownerReportRows.find((x) => x.id === id);
    return r ? { meta: `report ${r.id}`, title: r.status,
      lines: [`filed ${fmtTs(r.reportedAt)}`, `slot ${r.worker.slot} · ${r.worker.branch}`,
        ...(r.provenance.programId ? [`program ${r.provenance.programId}`] : []),
        ...(r.provenance.taskId ? [`task ${r.provenance.taskId}`] : []),
        `decision: ${r.decision?.disposition ?? "open"}`] } : null;
  }
  if (kind === "event") {
    const e = entityEvents.find((x) => x.id === id) ?? opsRows.find((x) => x.id === id);
    return e ? { meta: `event ${e.id} · ${e.kind}`, title: e.status,
      lines: [`created ${fmtTs(e.createdAt)}`, `receiver: ${e.receiverSlot === null ? "owner" : `slot ${e.receiverSlot}`}`,
        ...(e.subjectSlot ? [`subject: slot ${e.subjectSlot}${e.subjectBranch ? ` · ${e.subjectBranch}` : ""}`] : []),
        ...(typeof e.payload?.taskId === "string" ? [`task ${e.payload.taskId}`] : []),
        ...(typeof e.payload?.programId === "string" ? [`program ${e.payload.programId}`] : [])] } : null;
  }
  if (kind === "lane") {
    const s = fleet.find((x) => `${x.id}${x.worktree?.letter ?? ""}` === id);
    const band = s ? laneBandNames(stacksOf()).get(s.id) : undefined;
    return s ? { meta: band ? `Lane ${band} · Slot ${s.id}` : `lane ${id} · slot ${s.id}`, title: s.worktree?.branch ?? "lane",
      lines: [s.cwd ? "running" : "not occupying slot", ...(s.programId ? [`program ${s.programId}`] : []),
        ...(s.taskId ? [`task ${s.taskId}`] : []), ...(s.awaiting ? [`awaiting ${s.awaiting}`] : [])] } : null;
  }
  if (kind === "sha") {
    if (!knownSha(id)) return null;
    const lanes = fleet.filter((s) => s.taskHead && s.taskHead.startsWith(id))
      .map((s) => `slot ${s.id}${s.label ? ` · ${s.label}` : ""}${s.worktree ? ` · ⎇ ${s.worktree.branch}` : ""}`);
    const lands = entityOutcomes.filter((o) => o.disposition === "landed"
      && (o.headSha?.startsWith(id) || o.mainAfter?.startsWith(id))).sort((a, b) => b.ts - a.ts);
    const land = lands[0];
    const check = land && postLandAudit?.mainSha === land.mainAfter
      && postLandAudit?.covers?.includes(land.branch ?? "") ? postLandAudit : null;
    return {
      meta: `commit ${id}`,
      title: lanes.length ? "head of a lane on this board" : "seen on this board (brief/head)",
      lines: [...(lanes.length ? lanes : ["no lane sits on this commit right now"]),
        ...(land ? [`land: ${land.branch ?? "lane unknown"} · ${fmtTs(land.ts)}`] : []),
        ...(check ? [`check: ${check.result} · ${fmtTs(check.at)}`] : [])],
    };
  }
  const sl = fleet.find((x) => x.id === Number(id));
  if (!sl) return null;
  if (!sl.cwd) return { meta: `slot ${sl.id} · free`, title: "no session in this slot", lines: [] };
  const task = tasksList.find((t) => t.slot === sl.id && t.status === "sent");
  const taskLine = task ? `task ${task.id}${taskText.has(task.id) ? ` · ${qFirstLine(taskText.get(task.id) ?? "")}` : ""}` : "";
  // THE BOARD'S NAME FIRST (owner 2026-10-08: „[Zitat entfernt]“ was a name the board never shows — it calls
  // a lane by its band, "4A", and slot numbers above 16 by that band): "Lane 4A · Slot 26"
  const band = sl.worktree ? laneBandNames(stacksOf()).get(sl.id) : undefined;
  return {
    meta: [band ? `Lane ${band}` : "", band ? `Slot ${sl.id}` : `slot ${sl.id}`, band ? "" : sl.worktree ? "lane" : "session",
      sl.ctx ? `ctx ${Math.round(sl.ctx.pct)}%` : ""].filter(Boolean).join(" · "),
    title: sl.label || sl.cwd.split("/").filter(Boolean).pop() || sl.cwd,
    lines: [
      [sl.harness ?? "claude", sl.model, sl.effort].filter(Boolean).join(" · "),
      sl.worktree ? `branch ${sl.worktree.branch}` : sl.cwd,
      ...(sl.programId ? [`program ${sl.programId}`] : []),
      ...(sl.awaiting ? [`awaiting ${sl.awaiting}`] : []),
      ...(taskLine ? [taskLine] : []),
      ...(sl.lastOutput ? [`last output ${fmtDur(Math.max(0, now - sl.lastOutput))} ago`] : []),
      "Slot-Belegung kann sich seit dieser Nachricht geändert haben.",
    ],
  };
}

// THE TERMINAL'S OWN SHORTCUTS (card K8): + / − / 0 size the terminal font, F opens the scrollback
// search. The modifier is the platform's command key — ⌘ on Apple, Ctrl elsewhere, as a terminal in
// the browser does it — because on a Mac Ctrl+F and Ctrl+− are keys the shell in the pane owns.
const APPLE = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
type TermShortcut = 1 | -1 | 0 | "find";
// the search's marks in the chat material (Grammatik G0.1/G0.2: ink, no blue, no signal colour):
// every hit on --chat-faint, the current one with an --chat-ink edge. xterm wants #RRGGBB, so the
// tokens are read off :root (index.html) instead of being copied here as literals.
function findMarks() {
  const tok = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  return {
    matchBackground: tok("--chat-faint"), activeMatchBackground: tok("--chat-faint"), activeMatchBorder: tok("--chat-ink"),
    matchOverviewRuler: tok("--chat-mute"), activeMatchColorOverviewRuler: tok("--chat-ink"),
  };
}
function termShortcut(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean },
  apple: boolean): TermShortcut | null {
  if (e.altKey || (apple ? !e.metaKey || e.ctrlKey : !e.ctrlKey || e.metaKey)) return null;
  if (e.key === "+" || e.key === "=") return 1;
  if (e.key === "-") return -1;
  if (e.key === "0") return 0;
  return !e.shiftKey && e.key.toLowerCase() === "f" ? "find" : null;
}
// with the focused pane on its terminal; the xterm key handler lets these through (Pane), so this
// one listener serves a focused terminal and a focused page alike. The search opens only from the
// pane itself or the bare page — a dialog's own field keeps its keys.
window.addEventListener("keydown", (e) => {
  const p = panes[focused];
  if (!p || p.isChat) return;
  const k = termShortcut(e, APPLE);
  if (k === null) return;
  if (k === "find") {
    const t = e.target as Node | null;
    if (!p.slot || !(t === document.body || (t && p.root.contains(t)))) return;
    e.preventDefault();
    p.openSearch();
    return;
  }
  e.preventDefault();
  stepTermSize(k);
});

// Ctrl/Cmd +/−/0 resize the conversation text — only while the focused pane shows it, so the
// browser's own page zoom keeps working everywhere else
window.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || !panes[focused]?.isChat) return;
  const dir = e.key === "+" || e.key === "=" ? 1 : e.key === "-" ? -1 : e.key === "0" ? 0 : null;
  if (dir === null) return;
  e.preventDefault();
  stepChatSizes(dir);
});

// --- panes: each visible terminal owns its Terminal, WS, and resize state ---
function seedFramePlan(socketGeneration: number, currentGeneration: number, firstFrame: boolean):
  { reset: boolean; pin: boolean } | null {
  if (socketGeneration !== currentGeneration) return null;
  return { reset: firstFrame, pin: firstFrame };
}

// keys typed while a pane's socket is closed wait for the next seed of the same slot (Pane#sendRaw).
// A whole write fits or is refused — a paste or an escape sequence is never cut in half — and after
// the first refusal everything after it is refused too, so what arrives is always a prefix of what
// was typed. `lost` counts characters, as the owner typed them.
const HELD_MAX_BYTES = 1024;
function holdKeys(held: string, lost: number, s: string): { held: string; lost: number } {
  const size = (t: string) => new TextEncoder().encode(t).length;
  if (lost || size(held) + size(s) > HELD_MAX_BYTES) return { held, lost: lost + [...s].length };
  return { held: held + s, lost };
}

// long-press copy in the terminal (Pane#selectLineAt): how long a finger stays, how far it may drift
const PRESS_MS = 450;
const PRESS_SLOP_PX = 10;

// THE CHAT VIEW'S READING POSITION (Tranche 1, owner 2026-09-29: „[Zitat entfernt]“
// ). A position is kept as an ANCHOR — the
// topmost visible top-level child and how far its top sits from the viewport's top — not as a
// scrollTop: a pane of another width reflows every message above it, and the anchor survives that
// where a pixel offset does not. "end" = the view was following.
// Tranche 2 (owner, same day: „[Zitat entfernt]“): following is a STATE, Pane's
// chatStuck — scrolling up releases it, reaching the end sets it again. CHAT_FOLLOW_PX is only how
// close to the bottom counts as "at the end" (sub-pixel scroll positions, a trackpad's last nudge);
// it was 120 px while the geometry alone decided, and then a short scroll up never let go.
const CHAT_FOLLOW_PX = 8;
// the fly-in of a new message or tool call (public/index.html .fresh, ≤ 250 ms, off under
// prefers-reduced-motion) — and the same switch decides whether following glides or jumps
const chatStill = matchMedia("(prefers-reduced-motion: reduce)");
// A SEND'S STATE under YOUR bubble (Tranche 2, owner: „[Zitat entfernt]“
// ): the state as a word, the dot in the state colour (G2.3).
// "wartet" = the session's own queue holds it (server.ts#sessionQueue — whoever sent it, and after a
// reload too), or this board just sent it and neither the queue nor the transcript has it yet;
// "durch" = the transcript has it (the entry that retired the bubble). Nothing more is claimed: not
// read, not answered.
type SendState = "sending" | "wait" | "done";
const SEND_WORD: Record<SendState, string> = { sending: "wird gesendet …", wait: "wartet", done: "durch" };
const SEND_TITLE: Record<SendState, string> = {
  sending: "Geht gerade an die Session.",
  wait: "Gesendet, aber noch nicht im Verlauf der Session — läuft dort gerade ein Schritt, nimmt sie die Nachricht danach.",
  done: "Im Verlauf der Session angekommen — sie arbeitet damit.",
};
function sendState(kind: SendState): HTMLElement {
  const s = el("div", `msend ${kind}`);
  s.append(el("span", "msenddot"), SEND_WORD[kind]);
  s.title = SEND_TITLE[kind];
  return s;
}
// THE CLICK INTO THE COMPOSER (Tranche 2, owner: „[Zitat entfernt]“
// ). A plain click lands in the
// composer when it hits the free space under the last message, or anywhere in the view's bottom
// third — unless it made a selection, was a double click, or hit something that has its own click
// (a link, a button, a fold, an entity reference, an image, a field).
const CHAT_CLICK_OWN = "a, button, summary, input, textarea, select, label, img, [data-ent], [contenteditable]";
function chatClickToComposer(e: { detail: number; clientY: number; target: EventTarget | null },
  view: { top: number; height: number }, lastBottom: number, selected: boolean): boolean {
  if (selected || e.detail > 1) return false;
  const t = e.target as Element | null;
  if (t && typeof t.closest === "function" && t.closest(CHAT_CLICK_OWN)) return false;
  return e.clientY >= lastBottom || e.clientY >= view.top + (view.height * 2) / 3;
}
type ChatAnchor = "end" | { node: ChatKid; off: number };
type ChatBox = { scrollTop: number; readonly clientHeight: number; readonly scrollHeight: number };
type ChatKid = { offsetTop: number; offsetHeight: number };
function chatAnchor(chat: ChatBox, kids: ArrayLike<ChatKid>): ChatAnchor | null {
  if (!chat.clientHeight) return null; // not laid out (terminal view): there is no position to read
  if (chat.scrollTop + chat.clientHeight >= chat.scrollHeight - CHAT_FOLLOW_PX) return "end";
  for (const k of Array.from(kids))
    if (k.offsetHeight && k.offsetTop + k.offsetHeight > chat.scrollTop) return { node: k, off: k.offsetTop - chat.scrollTop };
  return null;
}
function restoreChatAnchor(chat: ChatBox, kids: ArrayLike<ChatKid>, a: ChatAnchor): void {
  if (a === "end") chat.scrollTop = chat.scrollHeight;
  else if (Array.from(kids).includes(a.node)) chat.scrollTop = a.node.offsetTop - a.off;
}
// the chat view of a slot a pane left: its message nodes, what the delta poll needs to go on from
// there, and the anchor. One shelf for the page (a slot is shown in at most one pane at a time, so
// a slot moved to another pane — or through a layout rebuild — comes back where it was), the last
// CHAT_SHELF_MAX slots, for the life of the page.
const CHAT_SHELF_MAX = 8;
type ChatToolGroup = { det: HTMLElement; sum: HTMLElement; body: HTMLElement; count: number; lastStep: HTMLElement | null };
type ChatNotifGroup = { sum: HTMLElement; body: HTMLElement; count: number };
type ChatShelfRow = { nodes: Node[]; total: number; source: string | null; lastTurnAt: number; cacheTtl: number | null; cacheTtlSec: number | null;
  model: string | null; effort: string | null; toolGroup: ChatToolGroup | null; notifGroup: ChatNotifGroup | null;
  pending: PendingBubble[]; openAgents: Map<string, { step: HTMLElement; run: HTMLElement }>;
  hover: boolean; anchor: ChatAnchor | null };
const chatShelf = new Map<number, ChatShelfRow>();
// A "wartet" bubble: the composer's own at Enter (no `key`), or one the session's queue names
// (`key` = the queue entry; GET /api/slots/:id/transcript → `queued`). A composer bubble the queue
// names becomes that entry's bubble — one bubble per send. `leftAt`: when its entry left the queue
// without the transcript bringing it in the same read.
type PendingBubble = { text: string; el: HTMLElement; key?: string; leftAt?: number };
// the transcript turn follows its dequeue within milliseconds (measured 2026-10-03, ~10 ms); a read
// between the two lines keeps the bubble, one the transcript never brings goes after this long
const QUEUE_LEFT_MS = 5000;
// the Markdown each rendered message body came from — what relinkChat re-renders in place
const bodySource = new WeakMap<HTMLElement, string>();

// A SENT DROP, SHOWN AS THE PICTURE IT IS (card 7d9c5394; owner 2026-09-30: „[Zitat entfernt]“
//  — the bubble showed only the attached path). The prompt that
// left the board is unchanged: the composer still appends server.ts#dropMention's line, the agent
// still reads the path, the copy button still copies that text. Only the BUBBLE reads the line back:
// a line of exactly that form, naming a raster in a drops/ folder, becomes a thumbnail; every other
// line — a foreign path, a HEIC, a pasted look-alike — stays text. The bytes come from the slot's
// own drop route (server.ts, GET /api/slots/:id/drop), which serves nothing but this slot's own
// drops, so a look-alike line that names someone else's file fails there and falls back to its
// text. Plain same-origin URLs on the owner cookie: no token in a URL, no object URL to revoke.
const DROP_LINE_RE = /^attached: (\/.*\/drops\/(\d{13}-[A-Za-z0-9._-]{1,80}\.(?:png|jpe?g|gif|webp))) — read it$/i;
const DROP_PREVIEW_MAX = 12; // per message; a longer list keeps the rest as text lines
type DropImage = { path: string; name: string; line: string };
function splitDropImages(text: string): { rest: string; images: DropImage[] } {
  const images: DropImage[] = [];
  const keep: string[] = [];
  for (const line of text.split("\n")) {
    const m = images.length < DROP_PREVIEW_MAX ? DROP_LINE_RE.exec(line.trim()) : null;
    if (m) images.push({ path: m[1], name: m[2].replace(/^\d{13}-/, ""), line: line.trim() });
    else keep.push(line);
  }
  return images.length ? { rest: keep.join("\n").trim(), images } : { rest: text, images };
}
// One button per picture (Enter/Space open it like a click), the lightbox the composer's thumbnails
// already use, Escape back to this button. A picture that does not come (gone with its worktree,
// not a raster, not this slot's) turns back into its own line — readable, never a broken image.
function dropStrip(slot: number, images: DropImage[]): HTMLElement {
  const strip = el("div", "mimgs");
  for (const d of images) {
    const url = `/api/slots/${slot}/drop?path=${encodeURIComponent(d.path)}`;
    const open = el("button", "mimg") as HTMLButtonElement;
    open.type = "button";
    open.title = `${d.name} — groß öffnen`;
    const img = document.createElement("img");
    img.alt = d.name;
    img.decoding = "async";
    img.onerror = () => open.replaceWith(el("div", "mimgline", d.line));
    img.src = url;
    open.appendChild(img);
    open.onclick = () => openLightbox(url, d.name, open);
    strip.appendChild(open);
  }
  return strip;
}

class Pane {
  private perfSwitch: PerfSpan | null = null;
  private perfChat: PerfSpan | null = null;
  private perfChatLoaded = false;
  private perfSeedReady = false;
  visibleExistingSwitch(): void {
    if (this.view === "chat" ? this.perfChatLoaded : this.perfSeedReady) this.visibleSwitch(true);
  }
  beginSwitch(at: number): void {
    perfFinish(this.perfSwitch, false);
    this.perfSwitch = perfStart("J2", at, { view: this.view });
  }
  visibleSwitch(shelf: boolean, res?: Response): void {
    if (this.perfSwitch) {
      this.perfSwitch.attrs.view = this.view;
      this.perfSwitch.attrs.shelf = this.view === "chat" && shelf;
      if (this.view === "term") this.perfSwitch.attrs.serverMs = "ws-seed-unmeasured";
      perfFinish(this.perfSwitch, true, res);
      this.perfSwitch = null;
    }
  }
  slot = 0; // 0 = unassigned
  private gen = 0; // bump to suppress a stale socket's reconnect loop
  private pinPending = false; // pin the viewport to the bottom once the next seed lands
  // which renderer this pane actually ended up on — see the block in the constructor.
  // Reported in the ⟳ tooltip because a silent one-way downgrade is otherwise invisible.
  private renderer = "dom";
  private rendererAddon: WebglAddon | CanvasAddon | null = null;
  private retries = 0; // consecutive failed/flapping reconnects — indexes reconnectDelay()
  private ws: WebSocket | null = null;
  private lastCols = 0;
  private lastRows = 0;
  private resizeTimer: ReturnType<typeof setTimeout> | undefined;
  private bottomTimer: ReturnType<typeof setTimeout> | undefined;
  // THE CHAT VIEW HAFTET AM ENDE (Tranche 2): true = the view follows new messages, gliding;
  // scrolling up releases it, reaching the end or the end button sets it again. What arrives while
  // it is released is counted (chatUnseen) and shown on the end button.
  private chatStuck = true;
  private chatUnseen = 0;
  private chatLastTop = 0;
  private followTimer: ReturnType<typeof setTimeout> | undefined;
  // set while a poll appends a DELTA: what goes into the view then flies in (.fresh); a first fill,
  // a refill and a slot coming off the shelf do not
  private chatFresh = false;
  private readonly endBtn: HTMLButtonElement;
  private readonly endCount: HTMLElement;
  private readonly sizeObserver: ResizeObserver;
  private observedRefit: ReturnType<typeof setTimeout> | undefined;
  readonly root: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly jump: HTMLElement;
  readonly term: Terminal;
  private readonly fit: FitAddon;
  // conversation view: renders the claude transcript as structured messages —
  // reflows at any width, which the fixed-width pty stream can't
  private readonly chatEl: HTMLElement;
  private readonly flakes = new Flakes();
  private readonly sizeBtn: HTMLButtonElement;
  private readonly viewBtn: HTMLButtonElement;
  private readonly boardBtn: HTMLButtonElement;
  private readonly reloadBtn: HTMLButtonElement;
  private readonly widthBtn: HTMLButtonElement;
  private readonly gearBtn: HTMLButtonElement;
  private readonly hoverBtn: HTMLButtonElement;
  private hoverOn = false;
  private linkProvider: ReturnType<Terminal["registerLinkProvider"]> | null = null;
  private readonly toolsBox: HTMLElement;
  private view: "term" | "chat" = "term";
  // what the session is doing, read from its pane (null = not read yet; "unknown" = no Claude input on screen)
  get liveTurn(): LiveState["turn"] | null { return this.live?.turn ?? null; }
  private chatTotal = 0;
  // when the newest transcript entry this pane has loaded was written (its `ts`, any role — a tool
  // result or a harness-injected turn is an API round trip too), 0 until one with a time arrived.
  // The composer's cache counter reads it; nothing else does.
  lastTurnAt = 0;
  // the TTL the counter measures against, named by the conversation source: Claude's 5 min, or
  // the provider a codex/pi file names (cacheTtlFor). null = a provider nobody measured → no counter.
  cacheTtl: number | null = CACHE_TTL_MS;
  // claude: the tier the server named (transcript payload `ttlSec`); cacheTtl follows it and the
  // warning lead comes from it (composer.ts#cacheLeadMs). null = not named — codex/pi, or no read yet
  cacheTtlSec: number | null = null;
  // the model the conversation's newest request ran on, as its file names it (transcript payload
  // `model`); null until the chat view has read one
  observedModel: string | null = null;
  // ...and the effort it ran at (payload `effort`); null = the file names none → "default"
  observedEffort: string | null = null;
  private chatSource: string | null = null;
  private chatTimer: ReturnType<typeof setTimeout> | undefined;
  private chatBusy = false;
  // THE PUSH (server/transcript-push.ts, Neuaufbau K10 S2): the transcript's complete-line count as the pane
  // socket last said it. Set = the server tells this socket when the file grew, and the running session's
  // chat reads then instead of every chatMs; null = no word on this socket yet, or it dropped → the timer
  private pushLines: number | null = null;
  // a push came while a read was running (or the read found a new file): read again right after it
  private chatAgain = false;
  // THE LIVE STATE (GET /api/slots/:id/live, server/live-state.ts, Neuaufbau K10 S1): the status line at
  // the end of the view and Claude Code's own queue, every liveMs while the chat shows the running session
  private live: LiveState | null = null;
  private liveTimer: ReturnType<typeof setTimeout> | undefined;
  private liveBusy = false;
  // when the newest transcript read that brought entries was ASKED: a live answer asked before it may
  // still list a prompt that read already showed as arrived, so its queue is not applied
  private entriesAskedAt = 0;
  // bumped by every resetChat: a poll that started under an older one delivers nothing (a slot can
  // leave and come back while its fetch is in flight, so the slot id alone does not tell)
  private chatGen = 0;
  // a position to restore once the chat is laid out again (it was read in the terminal view, or
  // came off the shelf) — applied by applyChatMemo
  private chatMemo: ChatAnchor | null = null;
  // THE BAND'S PAST SESSION (bandify): the session number of this slot's line the pane is showing
  // instead of the running one, read-only, or null. The sidebar reads its band position from here.
  pastN: number | null = null;
  private viewBeforePast: "term" | "chat" = "term";
  private readonly pastBar: HTMLElement;
  // THE DROPPED SOCKET, said in the pane (T3 of the 2026-09-26 walk-through): until this pane's
  // socket is open again a strip at its foot counts down to the next try, offers "jetzt verbinden",
  // and counts the keystrokes waiting for it. They are sent once the next socket to the SAME slot
  // has delivered its seed (flushHeld); a slot change discards them (assign).
  private readonly downBar: HTMLElement;
  private readonly downMsg: HTMLElement;
  private downTimer: ReturnType<typeof setInterval> | undefined;
  private retryAt = 0;
  private held = "";
  private dropped = 0;
  // LONG PRESS COPIES (T2 of the same walk-through): on a phone the terminal refuses text selection
  // (.paneterm user-select:none, so a drag scrolls the scrollback) and nothing could be copied out.
  private readonly copyPop: HTMLButtonElement;
  // the scrollback search (openSearch): the addon, its bar, the field and the hit count
  private readonly search = new SearchAddon();
  private readonly findBar: HTMLElement;
  private readonly findInput: HTMLInputElement;
  private readonly findCount: HTMLElement;
  // the conversation's own search (card "Insel C": Suchen in beiden Ansichten): the hits as DOM
  // ranges over the chat's text, the current one, painted through the CSS highlight registry where
  // the engine has one and as the selection where it does not
  private chatHits: Range[] = [];
  private chatHit = -1;
  private pressTimer: ReturnType<typeof setTimeout> | undefined;
  private pressAt: { x: number; y: number } | null = null;
  private pressFired = false;
  private pressText = "";
  // the link xterm last reported under the pointer (its hover), until its leave — what a long press asks for
  private pointedLink: string | null = null;
  private readonly linkHover = (e: MouseEvent, uri: string) => { this.pointedLink = uri; termLinkHover(e, uri); };
  private readonly linkLeave = () => { this.pointedLink = null; termLinkLeave(); };

  constructor(readonly index: number) {
    this.hoverOn = prefJSON<{ hovers?: boolean[] }>("fleet.view").hovers?.[index] ?? false;
    this.root = el("div", "pane");
    const termEl = el("div", "paneterm");
    this.hint = el("div", "panehint", "no session — click a slot");
    this.jump = el("button", "jump", "▼");
    this.chatEl = el("div", "panechat");
    attachEntityCards(this.chatEl, (kind, id) => this.hoverOn ? describeEntity(kind, id, this.slot) : null);
    // a selection copies as the Markdown it was rendered from (src/mdcopy.ts); a selection the
    // serializer declines (nothing of ours in it) keeps the browser's own copy
    this.chatEl.addEventListener("copy", (e) => {
      const md = selectionMarkdown(this.chatEl, window.getSelection());
      if (!md || !e.clipboardData) return;
      e.clipboardData.setData("text/plain", md);
      e.preventDefault();
    });
    this.chatEl.addEventListener("scroll", () => this.chatScrolled(), { passive: true });
    // a glide can stop short when a message it passed was laid out late (content-visibility):
    // the rest is a snap of a few pixels
    this.chatEl.addEventListener("scrollend", () => this.settleEnd());
    this.chatEl.addEventListener("animationend", (e) => { (e.target as Element).classList?.remove("fresh"); });
    this.chatEl.addEventListener("click", (e) => {
      if (!this.slot || this.pastN !== null || ta.disabled) return;
      const box = this.chatEl.getBoundingClientRect();
      const kids = this.chatKids();
      let last: HTMLElement | null = null;
      for (let i = kids.length - 1; i >= 0 && !last; i--) if (kids[i].offsetHeight) last = kids[i];
      const lastBottom = last ? last.getBoundingClientRect().bottom : box.top;
      const sel = window.getSelection();
      if (chatClickToComposer(e, { top: box.top, height: box.height }, lastBottom, !!sel && !sel.isCollapsed)) ta.focus();
    });
    // THE PANE'S CORNER GROUP (Grammatik K4): one container, one base rule in index.html — no
    // per-button absolute top/right arithmetic. TWO ROWS (owner 2026-09-22: „[Zitat entfernt]“
    // ): the top row
    // carries only what holds in BOTH views — ⚙ 💬 ℹ, ℹ RIGHTMOST, exactly on the pane corner —
    // so the info toggle never moves, and the column's close box (see #boardhead's padding) can
    // sit precisely on its spot: "[Zitat entfernt]" — one spot, click opens, click
    // again closes. That corner seat for ℹ is WHY the gear gives up its rightmost place here (G5
    // Zuhause was written for the single row this round replaces). The view row carries the
    // active view's own buttons (terminal: ↻ ⇔ — chat: ↑ ↓ Aa; the mapping is read from the
    // display rules in index.html and pinned in e2e/slots.ts). Glyphs from src/icons.ts (G0.6),
    // tooltips in owner words (G0.5), toggle states as aria-pressed with "on" in ink (G1.3,
    // CSS side). The onclick paths are untouched.
    this.reloadBtn = el("button", "panereload") as HTMLButtonElement;
    this.reloadBtn.appendChild(icon("reload"));
    this.reloadBtn.title = "Neu verbinden — holt den Verlauf dieser Session neu vom Server";
    this.reloadBtn.style.display = "none";
    this.reloadBtn.onclick = (e) => { e.stopPropagation(); this.reconnect(); };
    this.boardBtn = el("button", "boardtoggle") as HTMLButtonElement;
    this.boardBtn.appendChild(icon("info"));
    this.boardBtn.title = "Info-Spalte öffnen — Brief, Änderungen, Checks, Verlauf";
    this.boardBtn.style.display = "none";
    this.boardBtn.classList.toggle("active", boardOpen);
    // board toggle describes the FOCUSED session, and clicking a pane focuses it first (root mousedown)
    // opening moves the focus onto the ℹ in the column's head (it stands back here while open)
    this.boardBtn.onclick = (e) => {
      e.stopPropagation();
      focusPane(this.index);
      // the phone's Info is a window: open is whether it stands, not the remembered fleet.board — after
      // a reload with Info open that still says 1, and the first tap closed nothing (rechts-7)
      setBoard(isMobile() ? !boardShell?.isOpen() : !boardOpen);
      if (boardOpen && !isMobile()) document.getElementById("boardclose")?.focus({ preventScroll: true });
    };
    this.viewBtn = el("button", "viewtoggle") as HTMLButtonElement;
    this.viewBtn.appendChild(icon("chat"));
    this.viewBtn.title = "Konversation anzeigen";
    this.viewBtn.style.display = "none";
    this.viewBtn.setAttribute("aria-pressed", "false");
    this.viewBtn.onclick = (e) => {
      e.stopPropagation();
      this.setView(this.view === "term" ? "chat" : "term", e.timeStamp);
    };
    // terminal on the chat column's width — one pane, terminal view, never a phone (VERBOTEN mobil);
    // the phone never sees this button (mobile CSS hides it outright)
    this.widthBtn = el("button", "termwidth") as HTMLButtonElement;
    this.widthBtn.appendChild(icon("width"));
    this.widthBtn.title = "Terminal auf Chat-Breite begrenzen";
    this.widthBtn.style.display = "none";
    this.widthBtn.setAttribute("aria-pressed", "false");
    this.widthBtn.onclick = (e) => { e.stopPropagation(); setTermLimit(!termLimitOn); this.refit(); };
    const navUp = el("button", "promptnav up") as HTMLButtonElement;
    navUp.appendChild(icon("up"));
    navUp.title = "Dein vorheriger Prompt";
    navUp.onclick = (e) => { e.stopPropagation(); this.jumpPrompt(-1); };
    const navDn = el("button", "promptnav dn") as HTMLButtonElement;
    navDn.appendChild(icon("down"));
    navDn.title = "Dein nächster Prompt";
    navDn.onclick = (e) => { e.stopPropagation(); this.jumpPrompt(1); };
    // THE END BUTTON (Tranche 2) replaces Tranche 1's "zum Anfang" — owner: „[Zitat entfernt]“
    // 
    // . Home: the pane's corner row, chat half, after the prompt jumps (Grammatik §1). It is a
    // toggle (G1.3): pressed = the view haftet am Ende; released with news = the count in words.
    this.endBtn = el("button", "promptnav end") as HTMLButtonElement;
    this.endBtn.appendChild(icon("down"));
    this.endCount = el("span", "endcount");
    this.endBtn.appendChild(this.endCount);
    this.endBtn.onclick = (e) => { e.stopPropagation(); this.followEnd(true); };
    const navEnd = this.endBtn;
    this.sizeBtn = el("button", "chatsizebtn", "Aa") as HTMLButtonElement;
    this.sizeBtn.title = "Schrift und Spalte — in den Einstellungen (Strg/⌘ + / − / 0)";
    // the Aa panel's ONE home is the settings window's "Schrift" section (G5.3, kein zweites
    // Zuhause); the button is the shortcut that opens the window right there
    this.sizeBtn.onclick = (e) => { e.stopPropagation(); openSettings(this.sizeBtn, "schrift"); };
    // the gear opens the settings window — empty for now (Grammatik K8/D1 fills it); the phone
    // hides this one and keeps its gear in #mhead instead (G5), so exactly one gear is ever visible —
    // upright #mhead is gone and this one comes back behind the top island's ⋯ (index.html)
    this.gearBtn = el("button", "panegear") as HTMLButtonElement;
    this.gearBtn.appendChild(icon("gear"));
    this.gearBtn.title = "Einstellungen öffnen";
    this.gearBtn.onclick = (e) => { e.stopPropagation(); openSettings(this.gearBtn); };
    this.hoverBtn = el("button", "panehover") as HTMLButtonElement;
    this.hoverBtn.appendChild(el("span", "loupe"));
    this.hoverBtn.title = "Referenzen erklären";
    this.hoverBtn.setAttribute("aria-pressed", String(this.hoverOn));
    this.hoverBtn.onclick = (e) => {
      e.stopPropagation();
      this.hoverOn = !this.hoverOn;
      saveView();
      this.hoverBtn.setAttribute("aria-pressed", String(this.hoverOn));
      closeEntityCard();
      this.syncEntityLinks();
      const cwd = fleet.find((sl) => sl.id === this.slot)?.cwd;
      if (this.hoverOn && cwd && !fxTree.has(cwd)) {
        void loadTree(this.slot, cwd).then(() => this.refreshEntities());
      } else this.refreshEntities();
      if (this.hoverOn) void loadEntityDetails();
    };
    const toolsTop = el("div", "ptrow ptboth");
    toolsTop.append(this.gearBtn, this.hoverBtn, this.viewBtn, this.boardBtn);
    const toolsView = el("div", "ptrow ptview");
    toolsView.append(this.reloadBtn, this.widthBtn, navUp, navDn, navEnd, this.sizeBtn);
    this.toolsBox = el("div", "panetools");
    this.toolsBox.append(toolsTop, toolsView);
    this.pastBar = el("div", "pastbar");
    this.downBar = el("div", "panedown");
    this.downMsg = el("span", "downmsg");
    const downNow = el("button", "downnow", "jetzt verbinden") as HTMLButtonElement;
    downNow.title = "Nicht auf den nächsten Versuch warten — sofort neu verbinden";
    downNow.onclick = (e) => { e.stopPropagation(); this.reconnect(); };
    this.downBar.append(this.downMsg, downNow);
    this.copyPop = el("button", "termcopy", "Kopieren") as HTMLButtonElement;
    this.copyPop.onclick = (e) => {
      e.stopPropagation();
      copyText(this.pressText);
      this.copyPop.textContent = "Kopiert";
      setTimeout(() => this.hideCopy(), 700);
    };
    // THE SCROLLBACK SEARCH (card K8, T7): the canvas and WebGL renderers paint pixels, so the
    // browser's own find never sees terminal text. ⌘F/Ctrl+F opens this bar over the focused pane;
    // typing searches upward from the end (the newest hit first) and marks every hit, Enter goes to
    // the older hit, Shift+Enter to the newer, Esc closes and gives the keys back to the terminal.
    this.findBar = el("div", "termfind");
    this.findBar.setAttribute("role", "search");
    this.findInput = el("input", "termfindin") as HTMLInputElement;
    this.findInput.type = "text";
    this.findInput.placeholder = "Im Verlauf suchen";
    this.findInput.setAttribute("aria-label", "Im Terminalverlauf suchen");
    this.findInput.spellcheck = false;
    this.findCount = el("span", "termfindn");
    this.findCount.setAttribute("aria-live", "polite");
    const findBtn = (name: IconName, title: string, run: () => void): HTMLButtonElement => {
      const b = el("button", "termfindbtn") as HTMLButtonElement;
      b.appendChild(icon(name));
      b.title = title;
      b.setAttribute("aria-label", title);
      b.onmousedown = (e) => e.preventDefault(); // the field keeps the keyboard
      b.onclick = (e) => { e.stopPropagation(); run(); };
      return b;
    };
    this.findInput.addEventListener("input", () => this.findStep(-1));
    this.findInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); this.closeSearch(); }
      else if (e.key === "Enter") { e.preventDefault(); this.findStep(e.shiftKey ? 1 : -1); }
    });
    this.findBar.append(this.findInput, this.findCount,
      findBtn("up", "Älterer Treffer (Enter)", () => this.findStep(-1)),
      findBtn("down", "Neuerer Treffer (Shift+Enter)", () => this.findStep(1)),
      findBtn("x", "Suche schließen (Esc)", () => this.closeSearch()));
    this.root.append(termEl, this.flakes.canvas, this.chatEl, this.pastBar, this.hint, this.jump, this.downBar, this.copyPop, this.findBar, this.toolsBox);
    this.sizeObserver = new ResizeObserver(() => {
      clearTimeout(this.observedRefit);
      this.observedRefit = setTimeout(() => {
        if (this.root.isConnected && this.root.clientWidth && this.root.clientHeight) {
          this.refit();
          // a composer that grew, a wider pane: a view that haftet stays on its end
          if (this.view === "chat" && this.chatStuck) this.chatEl.scrollTop = this.chatEl.scrollHeight;
        }
      }, 60);
    });
    this.sizeObserver.observe(this.root);
    this.sizeObserver.observe(this.chatEl);
    this.syncCornerButtons();
    this.term = new Terminal({
      // 10k, not the 50k this carried from the first commit (f43e3fb1) without ever being
      // revisited. The number is a PER-PANE cost and the board shows several at once, so a
      // six-pane layout was holding 300 000 lines of buffer in one tab — memory xterm walks
      // on every viewport calculation, which is what scrolling one of them costs. Nothing is
      // actually lost: the server only ever seeds SEED_LINES (3000) on connect, tmux keeps the
      // real history, and ⟳ reload re-seeds from it. 10k is still three seeds deep.
      scrollback: 10000,
      // Owner-Meldung 2026-09-11: „[Zitat entfernt]“. Das war keine
      // Renderer-Last, sondern die Scroll-GRANULARITAET: xterms Default ist 0, und 0 heisst
      // laut seiner eigenen API "disable smooth scrolling and scroll instantly" — jeder
      // Radschritt springt hart eine ganze Zeile weit, ohne Zwischenbild. Genau das fuehlt
      // sich pro Zeile an. 100 ms interpoliert zwischen Ausgangs- und Zielzeile; hoehere
      // Werte fuehlen sich nicht weicher an, sondern traege, weil die Animation dann hinter
      // dem Finger herlaeuft. Reines Bedienungsgefuehl, kein Datenpfad: wer es zurueckdrehen
      // will, setzt 0 und hat exakt das Verhalten aller Versionen davor.
      smoothScrollDuration: 100,
      fontSize: termFontSize(),
      fontFamily: "ui-monospace, Menlo, Consolas, monospace",
      allowProposedApi: true, // the search addon marks its hits with decorations (a proposed API)
      theme: { background: "#000000", foreground: "#d8d8d8" }, // the chat view's black (index.html #main)
      linkHandler: { activate: openTermLink, hover: this.linkHover, leave: this.linkLeave },
    });
    this.fit = new FitAddon();
    this.term.loadAddon(this.fit);
    this.term.loadAddon(new WebLinksAddon(openTermLink, { hover: this.linkHover, leave: this.linkLeave }));
    this.term.loadAddon(this.search);
    this.search.onDidChangeResults(({ resultIndex, resultCount }) => this.paintFindCount(resultIndex, resultCount));
    this.term.open(termEl);
    // a finger held still for PRESS_MS selects the logical line under it (wrapped rows joined) and
    // offers "Kopieren" above it, through copyText like every other copy button. Moving first is a
    // scroll and cancels; the release after a press must not also be a tap (a tap on a URL opens it).
    termEl.addEventListener("touchstart", (e) => this.pressStart(e), { passive: true });
    termEl.addEventListener("touchmove", (e) => {
      const t = e.touches[0];
      if (this.pressAt && t && Math.hypot(t.clientX - this.pressAt.x, t.clientY - this.pressAt.y) > PRESS_SLOP_PX)
        clearTimeout(this.pressTimer);
    }, { passive: true });
    termEl.addEventListener("touchend", (e) => {
      clearTimeout(this.pressTimer);
      if (this.pressFired && e.cancelable) e.preventDefault();
    });
    termEl.addEventListener("touchcancel", () => clearTimeout(this.pressTimer), { passive: true });
    termEl.addEventListener("contextmenu", (e) => { if (this.pressFired) e.preventDefault(); });
    this.syncEntityLinks();
    this.loadRenderer();
    // on touch devices all input goes through the compose bar + key row; inputMode=none
    // lets xterm keep focus for scrolling without popping the on-screen keyboard
    if (isMobile() && this.term.textarea) this.term.textarea.inputMode = "none";
    this.term.onData((d) => this.sendRaw(d));
    this.term.attachCustomKeyEventHandler((e) => {
      if (e.type === "keydown" && e.key === "Escape") closeEntityCard();
      // the terminal's own shortcuts go to the page's listener (termShortcut), not to the shell
      if (termShortcut(e, APPLE) !== null) return false;
      // the canvas renderer paints cells as pixels, not DOM text, so a drag-selection has
      // nothing for the browser's native ⌘C to copy (no real Selection exists) — copy the
      // selection text directly instead. Guard e.type: xterm invokes this handler from both
      // _keyDown and _keyPress, and would otherwise fire the clipboard write twice.
      if (e.type === "keydown" && e.metaKey && e.key.toLowerCase() === "c" && this.term.hasSelection()) {
        this.copySelection();
        return false;
      }
      return !e.metaKey; // other ⌘ combos stay with the browser (paste, reload, ...)
    });
    const updateJump = () => {
      const b = this.term.buffer.active;
      this.jump.style.display = b.viewportY < b.baseY - 1 ? "flex" : "none";
    };
    this.term.onScroll(updateJump);
    this.term.onWriteParsed(updateJump);
    // touch momentum scroll drives the native viewport directly and doesn't emit
    // xterm's onScroll — listen to the DOM scroll so the jump pill stays in sync
    termEl.querySelector(".xterm-viewport")?.addEventListener("scroll", updateJump, { passive: true });
    this.jump.onclick = () => { this.snapToBottom(); this.focus(); };
    this.root.addEventListener("mousedown", () => focusPane(this.index));
    this.root.addEventListener("animationend", () => this.root.classList.remove("flash"));
    this.paintEndBtn();
  }

  get savedHover(): boolean { return this.hoverOn; }

  // What the board knows changed (the entity details, a file tree) or the loupe was flipped: which
  // ids are hoverable is decided at render time, so the bodies re-render — IN PLACE. This used to be
  // resetChat() + a refetch from 0, driven by loadEntityDetails every 60 s while the loupe was on:
  // every message node replaced, the view emptied for a frame (the flicker) and landing at the end
  // (the jump) — measured 2026-09-29 (Tranche 1).
  refreshEntities(): void {
    if (this.view !== "chat") return;
    this.relinkChat();
  }

  // Re-render each message body from its Markdown and swap its children only where the set of
  // hoverable ids actually differs; the message nodes, their heights and the scroll position stay.
  // Compared on the entity marks alone, so a code block's wrap toggle does not count as a change.
  private relinkChat(): void {
    const entity = this.hoverOn ? (kind: MdEntityKind, id: string) => entityKnown(kind, id, this.slot) : undefined;
    const marks = (b: HTMLElement) => [...b.querySelectorAll("[data-ent]")]
      .map((m) => `${m.getAttribute("data-ent")}:${m.getAttribute("data-id")}`).join(" ");
    for (const body of this.chatEl.querySelectorAll<HTMLElement>(".msg .mbody")) {
      const src = bodySource.get(body);
      if (src === undefined) continue;
      const fresh = el("div", "mbody");
      mdInto(fresh, src, { entity });
      if (marks(fresh) === marks(body)) continue;
      for (const code of fresh.querySelectorAll<HTMLElement>(".code")) decorateCode(code);
      body.replaceChildren(...fresh.childNodes);
    }
  }

  private syncEntityLinks(): void {
    this.linkProvider?.dispose();
    this.linkProvider = null;
    if (!this.hoverOn || !this.term) return;
    this.linkProvider = this.term.registerLinkProvider({
      provideLinks: (row, done) => {
        const line = this.term.buffer.active.getLine(row - 1)?.translateToString(true) ?? "";
        const matches = entityMatches(line, (kind, id) => entityKnown(kind, id, this.slot));
        done(matches.map((m) => ({
          text: m.id,
          range: { start: { x: m.start + 1, y: row }, end: { x: m.end, y: row } },
          activate: (event: MouseEvent) => {
            if (m.kind === "file") {
              const ref = fileReference(m.id)!;
              const cwd = fleet.find((sl) => sl.id === this.slot)?.cwd;
              if (cwd) openExplorer(this.slot, cwd, ref.path, ref.line);
            } else showEntityCard(m.kind, m.id, event.clientX, event.clientY,
              (kind, id) => describeEntity(kind, id, this.slot));
          },
          hover: (event: MouseEvent) => showEntityCard(m.kind, m.id, event.clientX, event.clientY,
            (kind, id) => describeEntity(kind, id, this.slot)),
          leave: () => hideEntityCard(),
        })));
      },
    });
  }

  // briefly rings the pane in the focus-blue accent — desktop only (mobile only ever
  // shows one pane, so there's no "which one changed" ambiguity to clear up)
  flash() {
    if (isMobile()) return;
    this.root.classList.remove("flash");
    void this.root.offsetWidth; // force reflow so re-adding the class retriggers the CSS animation
    this.root.classList.add("flash");
  }

  private loadRenderer(): void {
    this.rendererAddon?.dispose();
    this.rendererAddon = null;
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => {
        if (this.rendererAddon !== webgl) return;
        webgl.dispose();
        this.rendererAddon = null;
        this.loadCanvasRenderer("canvas (WebGL-Kontext verloren)");
      });
      this.term.loadAddon(webgl);
      this.rendererAddon = webgl;
      this.renderer = "webgl";
    } catch {
      this.loadCanvasRenderer("canvas (kein WebGL)");
    }
    this.markRenderer();
  }

  private loadCanvasRenderer(reason: string): void {
    const canvas = new CanvasAddon();
    this.term.loadAddon(canvas);
    this.rendererAddon = canvas;
    this.renderer = reason;
    this.markRenderer();
  }

  private copySelection() {
    copyText(this.term.getSelection());
  }

  // NOTE: in-terminal sent-prompt markers (xterm decorations anchored at the send line)
  // were built and tested against a real claude TUI — its full-repaint behavior plus our
  // own resize jiggle relocates content, so line-anchored marks drift and were dropped.
  // "What did I send" lives in the 🕘 prompt history and the conversation view instead.

  setView(v: "term" | "chat", at = performance.now()) {
    if (v !== this.view) { perfFinish(this.perfSwitch, false); this.perfSwitch = null; }
    if (v === "chat" && this.view !== "chat" && this.slot && this.pastN === null) {
      perfFinish(this.perfChat, false);
      this.perfChat = perfStart("J4", at, { view: "chat", shelf: this.perfChatLoaded });
      if (this.perfChatLoaded) { perfFinish(this.perfChat, true); this.perfChat = null; }
    }
    if (v === "term") { perfFinish(this.perfChat, false); this.perfChat = null; }
    if (v !== this.view) this.closeSearch();
    // the terminal view hides the chat (display:none) and a hidden element has no scroll position:
    // read it on the way out, restore it on the way back (applyChatMemo below)
    if (this.view === "chat" && v !== "chat") this.chatMemo ??= this.chatPosition();
    this.view = v;
    this.root.classList.toggle("chat", v === "chat");
    // the view toggle's two faces: the conversation bubble and, on the way back, the terminal
    // (G0.6 glyphs; "an" state as aria-pressed, CSS paints it in ink — G1.3, not blue)
    this.viewBtn.replaceChildren(icon(this.view === "chat" ? "keys" : "chat"));
    this.viewBtn.title = this.view === "chat" ? "Zum Terminal zurück" : "Konversation anzeigen";
    this.viewBtn.setAttribute("aria-pressed", this.view === "chat" ? "true" : "false");
    this.syncCornerButtons();
    this.flakes.setActive(v === "chat");
    saveView();
    this.syncHarnessAffordances();
    mountComposer(); // the one composer takes the size of the focused pane's view
    if (focused === this.index) renderIsland(); // the island's view word follows
    clearTimeout(this.chatTimer);
    if (v === "chat") { this.applyChatMemo(); void this.pollChat(); this.ensureLive(); }
    else { this.refit(); if (!booting) this.term.focus(); }
  }

  // 💬 only where a conversation can actually be read. A harness that writes no claude transcript
  // has nothing behind this button, and the honest move is to not offer it — the alternative is a
  // toggle that always lands on "no transcript yet", which reads as "nothing has been said yet"
  // and is a different, and false, statement. Idempotent: called on assignment AND on every poll.
  syncHarnessAffordances(): void {
    // The catalogue decides BOTH affordances below, so fetch it as soon as a pane holds a session —
    // not only when the chat view or the picker opens. supportsOf() is optimistic by design (never
    // hide a working feature), which means an unfetched catalogue offers 💬 on a harness that
    // writes no transcript; measured in the preview on a pi slot, and it re-decides when it lands.
    // …and the guard is `harnessesLoaded`, not the fetch's own early return: re-syncing after an
    // already-resolved load would schedule the next sync from inside the last one, forever.
    if (this.slot && !harnessesLoaded) void loadHarnesses().then(() => this.syncHarnessAffordances());
    const canChat = !this.slot || canChatOn(supportsOf(fleet.find((x) => x.id === this.slot)?.harness));
    this.viewBtn.style.display = this.slot && canChat ? "flex" : "none";
    this.syncCornerButtons();
    if (focused === this.index) renderComposerOpts(false);
    // a pane already sitting in the chat view must not be stranded there when its slot turns out
    // to have no transcript behind it
    if (this.slot && !canChat && this.view === "chat") this.setView("term");
  }

  // THE WIDTH TOGGLE'S TWO STATES. "Limited" = the pane's terminal runs on the chat column's
  // width — only where the toggle may exist at all: ONE pane, terminal view, not a phone (the
  // phone never sees the button, and its layout is always 1). At layout > 1 the button goes AND a
  // set limit lifts with it (the class is only ever painted under these same conditions).
  termIsLimited(): boolean {
    return termLimitOn && layout === 1 && this.view === "term" && !isMobile();
  }

  // visibility + pressed state of the group's conditional member; called from the constructor,
  // setView, and syncHarnessAffordances (assignment and every poll), so an isMobile() flip or a
  // layout rebuild always lands on a consistent group. The SEAT exists whenever the button can
  // exist at all (a session, one pane, desktop) — the chat view hides it by visibility (CSS), so
  // the right-anchored group keeps every button at the same x across view switches.
  syncCornerButtons(): void {
    const lim = this.termIsLimited();
    this.root.classList.toggle("tcolim", lim);
    this.widthBtn.style.display = this.slot && layout === 1 && !isMobile() ? "flex" : "none";
    this.widthBtn.setAttribute("aria-pressed", lim ? "true" : "false");
    this.widthBtn.title = lim ? "Volle Breite wiederherstellen" : "Terminal auf Chat-Breite begrenzen";
  }

  private resetChat() {
    this.perfChatLoaded = false;
    clearTimeout(this.chatTimer);
    this.chatGen++;
    this.chatMemo = null;
    this.chatEl.replaceChildren();
    this.chatTotal = 0;
    this.lastTurnAt = 0;
    this.cacheTtl = CACHE_TTL_MS;
    this.cacheTtlSec = null;
    this.observedModel = null;
    this.observedEffort = null;
    this.chatSource = null;
    this.toolGroup = null;
    this.notifGroup = null;
    this.pending = [];
    // a rebuilt view starts at its end, following, with nothing unread
    this.chatStuck = true;
    this.chatUnseen = 0;
    this.paintEndBtn();
    // a rebuilt view has no open agent calls: whatever ran in the old DOM is gone with it. A NEW
    // map, not clear(): the old one may be riding on the shelf with the nodes it points into.
    this.openAgents = new Map();
    // un-stick the busy flag so the reassigned pane's next pollChat() isn't blocked; the
    // old slot's in-flight fetch bails on the chatGen guard in pollChat.
    this.chatBusy = false;
    this.chatAgain = false;
    clearTimeout(this.liveTimer);
    this.liveTimer = undefined;
    this.liveBusy = false;
    this.live = null;
    this.entriesAskedAt = 0;
  }

  // Put this slot's running chat on the shelf and leave the pane empty (resetChat). A past session
  // is not shelved — it is read-only and cheap to read again; nor is a chat that never loaded.
  private shelveChat(): void {
    if (!this.slot || this.pastN !== null || (!this.chatTotal && this.chatSource === null)) { this.resetChat(); return; }
    const anchor = this.chatMemo ?? (this.view === "chat" ? this.chatPosition() : null);
    chatShelf.delete(this.slot);
    chatShelf.set(this.slot, { nodes: [...this.chatEl.childNodes],
      total: this.chatTotal, source: this.chatSource, lastTurnAt: this.lastTurnAt, cacheTtl: this.cacheTtl, cacheTtlSec: this.cacheTtlSec,
      model: this.observedModel, effort: this.observedEffort, toolGroup: this.toolGroup, notifGroup: this.notifGroup,
      pending: this.pending, openAgents: this.openAgents, hover: this.hoverOn, anchor });
    for (const old of chatShelf.keys()) { if (chatShelf.size <= CHAT_SHELF_MAX) break; chatShelf.delete(old); }
    this.resetChat();
  }

  // Take `slot`'s chat off the shelf into this pane — the same nodes, so nothing is rebuilt and the
  // delta poll goes on from where it stopped. false = nothing shelved for it (the caller resets).
  private unshelveChat(slot: number): boolean {
    const row = chatShelf.get(slot);
    if (!row) return false;
    chatShelf.delete(slot);
    this.resetChat();
    this.chatEl.replaceChildren(...row.nodes);
    this.chatTotal = row.total;
    this.chatSource = row.source;
    this.lastTurnAt = row.lastTurnAt;
    this.cacheTtl = row.cacheTtl;
    this.cacheTtlSec = row.cacheTtlSec;
    this.observedModel = row.model;
    this.observedEffort = row.effort;
    this.toolGroup = row.toolGroup;
    this.notifGroup = row.notifGroup;
    this.pending = row.pending;
    this.openAgents = row.openAgents;
    if (row.hover !== this.hoverOn) this.relinkChat();
    this.chatMemo = row.anchor;
    this.chatStuck = row.anchor === null || row.anchor === "end";
    this.paintEndBtn();
    if (this.view === "chat") this.applyChatMemo();
    return true;
  }

  private chatKids(): NodeListOf<HTMLElement> {
    return this.chatEl.querySelectorAll<HTMLElement>(":scope > *");
  }

  private applyChatMemo(): void {
    if (!this.chatMemo || !this.chatEl.clientHeight) return; // not laid out yet — setView tries again
    restoreChatAnchor(this.chatEl, this.chatKids(), this.chatMemo);
    this.chatStuck = this.chatMemo === "end";
    this.chatLastTop = this.chatEl.scrollTop;
    this.chatMemo = null;
    this.paintEndBtn();
  }
  // where the view stands, for the shelf and the terminal view: a view that haftet is "end" even
  // when a glide towards it has not arrived yet
  private chatPosition(): ChatAnchor | null {
    return this.chatStuck ? "end" : chatAnchor(this.chatEl, this.chatKids());
  }

  // The focused session paints its working state in the composer; the expiry stays a one-shot.
  private workTimer: ReturnType<typeof setTimeout> | undefined;
  private chatAdd(node: Node): void {
    if (this.chatFresh && node instanceof HTMLElement) node.classList.add("fresh");
    this.chatEl.appendChild(node);
  }

  private updateWork(): void {
    clearTimeout(this.workTimer);
    const slot = this.slot;
    const active = !!slot && this.pastN === null && this.view === "chat" && sessionActive(slot)
      && serverClock() - (fleet[slot - 1]?.lastOutput ?? 0) < RECENT_MS;
    if (panes[focused] === this) tickCacheAge();
    if (active) {
      const s = fleet[slot - 1]!;
      const left = RECENT_MS - (serverClock() - s.lastOutput);
      this.workTimer = setTimeout(() => { if (this.slot === slot) this.updateWork(); }, Math.max(left, 0));
    }
  }

  // --- conversation rendering: the view exists so YOUR messages are findable.
  // They render as prominent anchors; everything the agent did between two texts
  // collapses into one expandable "⚙ n steps" line instead of a wall of rows. ---
  // prompts sent from the composer that the transcript has not brought back yet (src/pendingsend.ts)
  private pending: PendingBubble[] = [];
  private toolGroup: { det: HTMLElement; sum: HTMLElement; body: HTMLElement; count: number;
    lastStep: HTMLElement | null } | null = null;
  // task-notifications between two of your messages fold into one collapsed accordion —
  // hidden by default, expandable to read — instead of masquerading as your bubbles
  private notifGroup: { sum: HTMLElement; body: HTMLElement; count: number } | null = null;

  private ensureToolGroup() {
    if (this.toolGroup) return this.toolGroup;
    const det = document.createElement("details");
    det.className = "toolgroup";
    const sum = document.createElement("summary");
    const body = el("div", "tgbody");
    det.append(sum, body);
    this.chatAdd(det);
    this.toolGroup = { det, sum, body, count: 0, lastStep: null };
    return this.toolGroup;
  }

  private addStep(b: TBlock) {
    const g = this.ensureToolGroup();
    if (b.t === "tool_result" && b.ref && this.openAgents.has(b.ref)) {
      // the id pairs the result to its call even when other tool calls came in between — the
      // marker goes, the result takes its place under the SAME step
      const hit = this.openAgents.get(b.ref)!;
      hit.run.remove();
      hit.step.appendChild(el("pre", "tres", b.text));
      this.openAgents.delete(b.ref);
    } else if (b.t === "tool_result" && g.lastStep) {
      // attach the result to the call it answers instead of its own row (positional fallback for
      // blocks without ids — old transcripts, codex/pi)
      g.lastStep.appendChild(el("pre", "tres", b.text));
      g.lastStep = null;
    } else {
      const step = document.createElement("details");
      step.className = "tstep";
      const sum = document.createElement("summary");
      sum.textContent = b.t === "thinking" ? "💭 thinking"
        : b.t === "tool" ? `${b.name ?? "tool"} ${b.text.slice(0, 90)}`
        : "result";
      step.append(sum, el("pre", "", b.text));
      if (this.chatFresh) step.classList.add("fresh");
      g.body.appendChild(step);
      g.count++;
      if (b.t === "tool") this.addAgentStep(b, step, sum);
      g.lastStep = b.t === "tool" ? step : null;
    }
    g.sum.textContent = `⚙ ${g.count} step${g.count === 1 ? "" : "s"}`;
  }

  // SUBAGENT CALLS RUN UNTIL THEIR RESULT LANDS. A tool_use named Agent/Task whose result has not
  // arrived yet carries a "läuft" marker (G2.3: the state as a word, the dot in the state colour);
  // the id the server now passes through pairs the result to the call even when other tool calls
  // came in between. The result REPLACES the marker; nothing else about the step changes.
  private openAgents = new Map<string, { step: HTMLElement; run: HTMLElement }>();
  private static readonly AGENT_TOOL = /^(agent|task)$/i;
  private addAgentStep(b: TBlock, step: HTMLElement, sum: HTMLElement): void {
    if (!b.id || !b.name || !Pane.AGENT_TOOL.test(b.name)) return;
    const run = el("span", "trun");
    run.append(el("span", "trundot"), "running …");
    sum.appendChild(run);
    this.openAgents.set(b.id, { step, run });
  }

  // harness task-notifications: collapsed by default under "🔔 n task notification(s)".
  // Consecutive ones share a group; any real message/step below closes the run.
  private addNotif(e: TEntry) {
    this.toolGroup = null;
    if (!this.notifGroup) {
      const det = document.createElement("details");
      det.className = "notifgroup";
      const sum = document.createElement("summary");
      const body = el("div", "ngbody");
      det.append(sum, body);
      this.chatAdd(det);
      this.notifGroup = { sum, body, count: 0 };
    }
    const g = this.notifGroup;
    const text = e.blocks.map((b) => b.text).join("\n");
    const item = el("div", "nitem");
    const status = /<status>([^<]*)<\/status>/.exec(text)?.[1] ?? "update";
    item.appendChild(el("div", "nihead", `${status}${e.ts ? ` · ${fmtClock(e.ts)}` : ""}`));
    item.appendChild(el("pre", "nibody", text));
    g.body.appendChild(item);
    g.count++;
    g.sum.textContent = `🔔 ${g.count} task notification${g.count === 1 ? "" : "s"}`;
  }

  get isChat(): boolean {
    return this.view === "chat";
  }
  // what a reload should come back to: the view the RUNNING session had, never a past one
  get savedChat(): boolean {
    return this.pastN !== null ? this.viewBeforePast === "chat" : this.view === "chat";
  }

  // Show session `n` of this slot's line, read-only, in the conversation view — or, with null, the
  // running session again in the view it had. The composer goes quiet while a past is shown
  // (mountComposer): a prompt typed there would reach the RUNNING session, not the one on screen.
  // `fromBand`: the band already shows where it rests — rebuilding the sidebar under it would drop
  // its snap and the keyboard focus (measured: two ← moved one step)
  showPast(n: number | null, fromBand = false) {
    if (n === this.pastN) return;
    if (n === null) { this.leavePast(); mountComposer(); if (!fromBand) renderSlots(); return; }
    if (this.pastN === null) { this.viewBeforePast = this.view; this.shelveChat(); }
    this.pastN = n;
    this.root.classList.add("past");
    this.pastBar.replaceChildren(el("span", "pastwho", `Session ${n}`), el("span", "pastmeta", "lädt…"));
    this.resetChat();
    if (this.view !== "chat") this.setView("chat");
    else void this.pollChat();
    mountComposer();
  }
  private leavePast() {
    if (this.pastN === null) return;
    this.pastN = null;
    this.root.classList.remove("past");
    this.pastBar.replaceChildren();
    if (!this.unshelveChat(this.slot)) this.resetChat();
    if (this.view !== this.viewBeforePast) this.setView(this.viewBeforePast);
    else if (this.view === "chat") { void this.pollChat(); this.ensureLive(); }
  }
  private paintPastBar(d: { session: number; startedAt: number | null; handedAt: number | null;
    ctx: { usedTokens: number; windowTokens: number; pct: number } | null }) {
    const back = el("button", "pastback", "↩ laufende Session") as HTMLButtonElement;
    back.title = "zurück zur laufenden Session dieses Slots (Esc auf der Zeile)";
    back.onclick = (e) => { e.stopPropagation(); this.showPast(null); };
    const bits = [`begann ${whenLong(d.startedAt)}`, `übergab ${whenLong(d.handedAt)}`];
    if (d.ctx) bits.push(`ctx ${Math.round(d.ctx.pct)}% beim Übergeben`);
    const meta = el("span", "pastmeta", bits.join(" · "));
    if (d.ctx) meta.title = `Kontext beim Übergeben — ${ctxLine(d.ctx)}`;
    this.pastBar.replaceChildren(el("span", "pastwho", `Session ${d.session} · nur lesend`), meta, back);
  }

  // One message: the rendered body (a bubble for you, free prose for the agent — t3code's layout
  // grammar) and a meta row that appears on hover with the time and a copy of the SOURCE text.
  private appendEntry(e: TEntry) {
    if (e.meta && e.blocks.length && e.blocks.every((b) => b.t === "text" && isInterruptMark(b.text))) { this.addInterrupt(e); return; }
    // a message another session sent reaches a RESTING session as meta (server.ts#crossSessionEntry): its quiet line, not
    // a task notification
    const said = e.meta && e.blocks.length === 1 && e.blocks[0]!.t === "text" ? otherSender(e.blocks[0]!.text) : null;
    if (said) { this.toolGroup = null; this.notifGroup = null; this.addFleetLine({ owner: false, mark: null, text: said.text }, null, said.who, e.ts); return; }
    if (e.meta) { this.addNotif(e); return; }
    this.notifGroup = null; // a real entry ends the notification run
    for (const b of e.blocks) {
      if (b.t === "text") {
        this.toolGroup = null; // a message ends the current work block
        if (e.role !== "user") { this.addMessage(e, b.text, null, null, false); continue; }
        const raw = unwrapPasted(b.text);
        // a slash command Claude Code ran, and its output: one quiet line, not two bubbles of yours (src/slashcommand.ts)
        const cmd = slashCommand(raw), out = cmd ? null : slashOutput(raw);
        if (cmd || out) { this.settlePending(raw); this.addSlashLine(e, cmd, out); continue; }
        // Fleet's typed delivery head is transport provenance, not something the owner wrote: it rides
        // in the meta row beside the bubble, and the bubble and its copy carry only the body.
        const { header, body } = splitDeliveryHeader(raw);
        // A BUNDLE (src/delivery-format.ts) is several deliveries in one turn: each owner part is
        // its own bubble and retires its own pending send, every other part is a quiet Fleet line
        const parts = deliveryParts(body);
        // Esc took this prompt back before any answer (server/live-state.ts#foldLine): the terminal shows
        // no such turn, so neither does this view — a bubble of ours waiting for it retires with it
        if (this.live?.withdrawn.includes(e.n)) { this.settlePending(raw); continue; }
        if (!parts) {
          // one delivery: a bubble only for YOUR words — every other path, and another session's message, is a quiet
          // line (Mangel 78) that retires no pending bubble of yours
          const other = otherSender(raw);
          if (other) this.addFleetLine({ owner: false, mark: null, text: other.text }, header, other.who, e.ts);
          else this.addMessage(e, body, header, null, this.settlePending(raw));
          continue;
        }
        for (const part of parts) {
          if (part.owner) this.addMessage(e, part.text, header, part.mark, this.settlePending(part.text));
          else this.addFleetLine(part, header, "fleet", e.ts);
        }
      } else {
        this.addStep(b);
      }
    }
  }
  private addMessage(e: TEntry, text: string, header: string | null, mark: string | null, arrived: boolean): HTMLElement {
    const msg = el("div", `msg ${e.role}`);
    if (e.role === "user" && e.n > 0) msg.dataset.n = String(e.n); // the line dropWithdrawn finds a prompt Esc took back by
    // only YOUR prompt names drops (the composer appends them); an agent quoting the line stays text
    const drops = e.role === "user" ? splitDropImages(text) : { rest: text, images: [] };
    const body = el("div", "mbody");
    mdInto(body, drops.rest, { entity: this.hoverOn ? (kind, id) => entityKnown(kind, id, this.slot) : undefined });
    bodySource.set(body, drops.rest);
    for (const code of body.querySelectorAll<HTMLElement>(".code")) decorateCode(code);
    if (drops.images.length) msg.appendChild(dropStrip(this.slot, drops.images));
    const meta = el("div", "mmeta");
    const who = e.role === "user" ? "you" : "claude";
    meta.appendChild(el("span", "mwho", e.ts ? `${who} · ${fmtClock(e.ts)}` : who));
    if (header || mark) {
      // a bundled owner part shows its own mark; the bundle's head stays in the tooltip
      const head = el("span", "mhead", mark ?? header ?? "");
      head.title = [header && `fleet-zustellung · ${header}`, mark].filter(Boolean).join("\n");
      head.style.cssText = "min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
      meta.appendChild(head);
    }
    meta.appendChild(copyButton("copy", "copy this message as Markdown", () => text));
    msg.append(body, ...(arrived ? [sendState("done")] : []), meta);
    this.chatAdd(msg);
    return msg;
  }
  // A message you did not write (a bundle part, a single Fleet delivery, another session's message — Mangel 78): one
  // quiet line, not a bubble — ↑/↓ and the outline jump between YOUR messages. `who` labels it: Fleet, or the session by
  // its name. Its first line shows; a click opens the rest. Time, mark and head ride in the tooltip.
  private addFleetLine(part: DeliveryPart, header: string | null, who: string, ts: string | null) {
    const line = document.createElement("details");
    line.className = "msys";
    const sum = document.createElement("summary");
    const [lead = "", ...rest] = part.text.replace(/^\s*\n/, "").split("\n");
    // ONE label: Fleet's text that opens with its own "[fleet]" / "[fleet message]" / "[fleet report orphan]" shows that
    // as the label instead of "fleet [fleet] …" (Abnahme 6936ed0b, owner picture nachher-1200-3-ereignisse)
    const own = who === "fleet" ? /^\[(fleet(?: [A-Za-z][\w-]*){0,3})\] /.exec(lead) : null;
    const first = own ? lead.slice(own[0].length) : lead;
    sum.append(el("span", "msyswho", own?.[1] ?? who), el("span", "msystext", first));
    sum.title = [ts && fmtClock(ts), who === "fleet" ? null : `Nachricht der Claude-Session „${who}“`,
      header && `fleet-zustellung · ${header}`, part.mark].filter(Boolean).join("\n");
    line.appendChild(sum);
    const more = rest.join("\n").trim();
    if (more) line.appendChild(el("div", "msysbody", more));
    this.chatAdd(line);
  }

  // A slash command Claude Code ran (src/slashcommand.ts): ONE quiet line, as the terminal shows "❯ /model …" with its
  // "⎿ Set model to …" under it. The command opens the line with what was typed, its output makes it the sentence. The
  // line still waiting is the last one the transcript drew, read off the DOM so a shelved chat carries it along; a
  // click opens Claude Code's own words.
  private addSlashLine(e: TEntry, cmd: SlashCommand | null, out: SlashOutput | null) {
    let last = this.chatEl.lastElementChild;
    while (last?.matches(".mlive, .mheld, .msg.pending")) last = last.previousElementSibling;
    const waiting = out && last instanceof HTMLElement && last.matches(".mcmd[data-wait]") ? last : null;
    const line = waiting ?? document.createElement("details");
    if (!waiting) {
      line.className = "msys mcmd";
      const sum = document.createElement("summary");
      sum.append(el("span", "msyswho", cmd?.name ?? "befehl"), el("span", "msystext", ""));
      line.append(sum, el("div", "msysbody", ""));
      this.chatAdd(line);
    }
    if (cmd) { line.dataset.wait = ""; line.dataset.name = cmd.name; line.dataset.args = cmd.args; }
    if (out) delete line.dataset.wait;
    const ran = line.dataset.name !== undefined ? { name: line.dataset.name, args: line.dataset.args ?? "" } : null;
    const [sum, text, body] = [line.querySelector("summary"), line.querySelector(".msystext"), line.querySelector(".msysbody")];
    if (sum) sum.title = `Claude Code hat diesen Befehl selbst ausgeführt${e.ts ? ` · ${fmtClock(e.ts)}` : ""}`;
    if (text) text.textContent = slashSentence(ran, out);
    if (body) body.textContent = [ran && `${ran.name} ${ran.args}`.trim(), out?.text].filter(Boolean).join("\n");
  }

  // Esc mid-turn (src/pendingsend.ts#isInterruptMark): the terminal shows "Interrupted" as a line under
  // the answer, so the chat view does too — a quiet line in the same ink as a Fleet part, never a bubble
  // of yours (docs/messungen/2026-10-03-terminal-vs-chat-warten.md §6). The marker rides in the tooltip.
  private addInterrupt(e: TEntry) {
    this.toolGroup = null;
    this.notifGroup = null;
    const line = document.createElement("details");
    line.className = "msys mstop";
    const sum = document.createElement("summary");
    sum.append(el("span", "msyswho", "esc"), el("span", "msystext", `interrupted${e.ts ? ` · ${fmtClock(e.ts)}` : ""}`));
    sum.title = `Die Session wurde mitten im Schritt unterbrochen — Claude Code schreibt das selbst, nicht du.\n${e.blocks.map((b) => b.text).join("\n")}`;
    line.appendChild(sum);
    this.chatAdd(line);
  }

  // THE SENT PROMPT, BEFORE THE TRANSCRIPT HAS IT. Measured 2026-09-22
  // (docs/messungen/2026-09-22-chat-absenden-zeitleiste.md): the bubble waited for POST /send (~350–500 ms) AND the next chat
  // poll (up to chatMs, 1 s / 3 s with the data saver) — mid-turn until the agent wrote the queued
  // prompt, 6.4 s. The local bubble shows at Enter; the transcript entry replaces it.
  addPending(text: string): HTMLElement | null {
    if (this.view !== "chat" || this.pastN !== null) return null;
    const msg = el("div", "msg user pending fresh");
    // the same picture strip the transcript entry will carry, so the swap in settlePending changes
    // the state line and nothing else (one preview before, one after)
    const drops = splitDropImages(text);
    if (drops.images.length) msg.appendChild(dropStrip(this.slot, drops.images));
    const body = el("div", "mbody");
    mdInto(body, drops.rest, { entity: this.hoverOn ? (kind, id) => entityKnown(kind, id, this.slot) : undefined });
    bodySource.set(body, drops.rest);
    const meta = el("div", "mmeta");
    meta.appendChild(el("span", "mwho", "you · wird gesendet…"));
    msg.append(body, sendState("sending"), meta);
    this.chatAdd(msg);
    this.pending = [...this.pending, { text, el: msg }];
    this.followEnd(true);
    return msg;
  }
  dropPending(msg: HTMLElement): void {
    msg.remove();
    this.pending = this.pending.filter((p) => p.el !== msg);
  }
  // THE SESSION'S QUEUE, READ BACK (server.ts#sessionQueue): every owner text the session still holds
  // stands as a "wartet" bubble at the end of the view — whoever sent it, and after a reload. The
  // composer's own bubble for the same send becomes the queue's; the transcript turn retires either
  // through settlePending ("durch"). A bundle in the queue waits as its owner parts; a single delivery you did not write
  // waits as nothing and arrives as its quiet line (Mangel 78).
  private syncQueue(queued: readonly { text: string; at: string | null }[]): void {
    const now = Date.now();
    const listed = new Set<string>();
    for (const q of queued) {
      const raw = unwrapPasted(q.text);
      const { header, body } = splitDeliveryHeader(raw);
      const parts = deliveryParts(body)?.filter((p) => p.owner) ?? (otherSender(raw) ? [] : [{ owner: true, mark: null, text: body }]);
      parts.forEach((part, i) => {
        const key = `${q.at ?? ""}#${i}\n${part.text}`;
        listed.add(key);
        if (this.pending.some((p) => p.key === key)) return;
        const mine = this.pending.find((p) => p.key === undefined && pendingSettledBy(p.text, part.text));
        if (mine) {
          mine.el.querySelector(".msend")?.replaceWith(this.queueState());
          this.pending = this.pending.map((p) => (p === mine ? { ...p, key } : p));
          return;
        }
        const msg = this.addMessage({ n: 0, role: "user", ts: q.at, blocks: [] }, part.text, header, part.mark, false);
        msg.classList.add("pending");
        msg.insertBefore(this.queueState(), msg.querySelector(".mmeta"));
        this.pending = [...this.pending, { text: part.text, el: msg, key }];
      });
    }
    for (const p of this.pending) if (p.key !== undefined && !listed.has(p.key) && now - (p.leftAt ?? now) > QUEUE_LEFT_MS) this.dropPending(p.el);
    this.pending = this.pending.map((p) => (p.key === undefined ? p
      : { ...p, leftAt: listed.has(p.key) ? undefined : p.leftAt ?? now }));
  }
  // THE HELD BUNDLE (server.ts#heldDeliveriesView): Fleet holds deliveries for this session and types
  // them when the bundle is due — until then neither the terminal nor this view showed anything for
  // up to FLEET_DELIVERY_BUNDLE_SEC (docs/messungen/2026-10-03-terminal-vs-chat-warten.md, Szenario 4).
  // One quiet line at the very end, below every "wartet" bubble, read from the 2 s owner poll and
  // gone with the flush; the composer adds „[Zitat entfernt]“ (src/composer.ts#renderHeldHint).
  // Not a message: it never counts as new and never moves a released view.
  syncHeld(): void {
    const hd = this.slot && this.pastN === null && this.view === "chat"
      ? fleet.find((x) => x.id === this.slot)?.heldDeliveries : undefined;
    let line = this.chatEl.querySelector<HTMLElement>(":scope > .mheld");
    if (!hd) { line?.remove(); return; }
    const text = heldDeliveriesLine(hd);
    const title = `Fleet hält ${hd.count === 1 ? "diese Zustellung" : "diese Zustellungen"} gebündelt zurück und tippt `
      + `sie ${hd.dueAt === null ? "mit dem nächsten Senden" : "zur genannten Zeit"} in die Session — `
      + `Senden nimmt sie früher mit. Wege: ${hd.paths.join(", ")}`;
    if (!line) {
      line = document.createElement("details");
      line.className = "msys mheld";
      const sum = document.createElement("summary");
      sum.append(el("span", "msyswho", "fleet"), el("span", "msystext", text));
      line.appendChild(sum);
    }
    const sum = line.querySelector("summary")!;
    const shown = sum.querySelector(".msystext")!;
    if (shown.textContent !== text) shown.textContent = text;
    if (sum.title !== title) sum.title = title;
    const end = this.chatEl.querySelector<HTMLElement>(":scope > .mlive");
    if (line.parentNode !== this.chatEl || line.nextSibling !== end) {
      this.chatEl.insertBefore(line, end);
      if (this.chatStuck) this.followEnd(false);
    }
  }
  // nothing below this node but the quiet end lines and other waiting bubbles
  private atEnd(node: Element): boolean {
    for (let n = node.nextElementSibling; n; n = n.nextElementSibling) if (!n.matches(".mheld, .mlive, .msg.pending")) return false;
    return true;
  }
  // the waiting bubbles, in their order, below every arrived entry and above the quiet end lines —
  // moved only when one of them is out of place
  private settleTail(): void {
    const end = this.chatEl.querySelector(":scope > .mheld, :scope > .mlive");
    const here = this.pending.filter((p) => p.el.parentNode === this.chatEl);
    const below = (n: Element) => end !== null && !!(end.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (here.some((p) => !this.atEnd(p.el) || below(p.el))) for (const p of here) this.chatEl.insertBefore(p.el, end);
  }
  // THE STATUS LINE (src/livestate.ts): the very last thing in the view, where the terminal paints its
  // spinner. Not a message: it never counts as new and never moves a released view.
  private syncLive(): void {
    let line = this.chatEl.querySelector<HTMLElement>(":scope > .mlive");
    const w = this.live && this.pastN === null && this.view === "chat" ? liveWord(this.live) : null;
    if (!w) { line?.remove(); return; }
    line ??= liveLine();
    paintLiveLine(line, w);
    const esc = line.querySelector(".mliveesc");
    if (w.kind === "work" && isMobile()) { if (!esc) line.appendChild(recallButton(() => void this.recall("esc"))); }
    else esc?.remove();
    if (line.parentNode !== this.chatEl || line.nextSibling !== null) {
      this.chatEl.appendChild(line);
      if (this.chatStuck) this.followEnd(false);
    }
  }
  // a waiting bubble's state and, beside it, "jetzt senden" (src/recall.ts); .msend itself still reads "wartet"
  private queueState(): HTMLElement {
    const row = el("div", "msendrow");
    row.append(sendState("wait"), sendNowButton(() => void this.recall("send-now")));
    return row;
  }
  // ESC AND ↑ AS IN THE TERMINAL (src/recall.ts, server/recall.ts): true = the key is this pane's now
  escKey(): boolean {
    if (this.view !== "chat" || this.pastN !== null || this.live?.turn !== "working") return false;
    void this.recall("esc");
    return true;
  }
  upKey(): boolean {
    if (this.view !== "chat" || this.pastN !== null || !this.live?.queued.length) return false;
    void this.recall("queued");
    return true;
  }
  private recalling = false;
  async recall(kind: RecallKind): Promise<void> {
    const slot = this.slot;
    if (!slot || this.recalling) return;
    this.recalling = true;
    try {
      const res = await post(`/api/slots/${slot}/recall`, { kind });
      const r = res.ok ? ((await res.json()) as RecallResult) : null;
      if (!r) { toast(`Zurückholen ging nicht (${res.status}).`); return; }
      const texts = r.result === "recalled" ? r.texts : r.result === "kept" ? r.texts ?? [] : [];
      if (texts.length && this.slot === slot) {
        // the bubbles of what came back go: a withdrawn line, a composer bubble, a "wartet" bubble — the
        // interrupted prompt keeps its "durch" bubble, it stays in the conversation
        if (r.result === "recalled") this.dropWithdrawn(r.lines);
        const bodies = recalledBodies(texts);
        for (const p of [...this.pending]) if (bodies.some((b) => pendingSettledBy(p.text, b))) this.dropPending(p.el);
        if (panes[focused] !== this) focusPane(this.index);
        ta.value = recalledText(texts, ta.value);
        ta.dispatchEvent(new Event("input"));
        ta.focus();
        ta.selectionStart = ta.selectionEnd = ta.value.length;
      }
      const note = recallNotice(r);
      if (note) toast(note);
    } catch {
      toast("Zurückholen ging nicht — keine Verbindung.");
    } finally {
      this.recalling = false;
    }
  }
  // a prompt Esc took back: its bubble goes, wherever it stands
  private dropWithdrawn(lines: readonly number[]): void {
    for (const n of lines) for (const m of this.chatEl.querySelectorAll<HTMLElement>(`:scope > .msg.user[data-n="${n}"]`)) m.remove();
  }
  // started where the chat chain is started (view, slot, pump); it stops itself when the view leaves the
  // running session, the tab hides, or the pane is reset
  private ensureLive(): void {
    if (this.liveTimer === undefined && !this.liveBusy && this.pastN === null && plan().liveMs) void this.pollLive();
  }
  private async pollLive(): Promise<void> {
    this.liveTimer = undefined;
    if (!this.slot || this.view !== "chat" || this.pastN !== null || this.liveBusy) return;
    const slot = this.slot, gen = this.chatGen, askedAt = Date.now();
    const owns = () => this.slot === slot && this.chatGen === gen && this.pastN === null;
    this.liveBusy = true;
    try {
      const res = await api(`/api/slots/${slot}/live`);
      if (!owns() || !res.ok) return;
      const s = (await res.json()) as LiveState;
      if (!owns()) return;
      const was = this.live?.turn;
      this.live = s;
      // every owner text the session holds stands as „[Zitat entfernt]“ — whoever sent it, after a reload too
      const had = this.chatEl.childElementCount, first = this.chatTotal === 0;
      this.chatFresh = !first;
      if (askedAt >= this.entriesAskedAt) this.syncQueue(s.queued);
      this.chatFresh = false;
      this.settleTail();
      if (this.chatEl.childElementCount > had) {
        this.chatEl.querySelector(".chatempty")?.remove();
        this.chatGrew(this.chatEl.childElementCount - had, first);
      }
      this.dropWithdrawn(s.withdrawn);
      this.syncHeld();
      this.syncLive();
      if (was !== s.turn && focused === this.index) tickCacheAge();
    } catch {
      // transient fetch error — next tick retries
    } finally {
      if (this.slot === slot && this.chatGen === gen) {
        this.liveBusy = false;
        const ms = plan().liveMs;
        if (this.view === "chat" && this.pastN === null && ms) this.liveTimer = setTimeout(() => void this.pollLive(), ms);
      }
    }
  }
  // true = the entry retired a bubble this board put up: it is the same send, now DURCH
  private settlePending(text: string): boolean {
    const hit = this.pending.find((p) => pendingSettledBy(p.text, text));
    if (hit) {
      const measured = perfPending.get(hit.el);
      if (measured) measured.span.attrs.transcriptMs = Math.max(0, performance.now() - measured.span.start);
      this.dropPending(hit.el);
    }
    return !!hit;
  }

  // jump between YOUR messages — the reason this view exists
  private jumpPrompt(dir: -1 | 1) {
    const users = [...this.chatEl.querySelectorAll<HTMLElement>(".msg.user")];
    if (!users.length) return;
    const y = this.chatEl.scrollTop;
    const target = dir === -1
      ? [...users].reverse().find((u) => u.offsetTop < y - 8)
      : users.find((u) => u.offsetTop > y + 8);
    (target ?? (dir === -1 ? users[0] : users[users.length - 1]))
      .scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // sideboard outline → open the conversation view and bring prompt #i into view.
  // The chat may still be loading right after the view switch — retry until the
  // marker exists (same .msg.user anchors jumpPrompt navigates)
  showPromptAt(i: number, attempts = 15) {
    if (!this.slot) return;
    if (this.view !== "chat") this.setView("chat");
    const users = this.chatEl.querySelectorAll<HTMLElement>(".msg.user");
    if (users.length > i) {
      users[i].scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (attempts > 0) setTimeout(() => this.showPromptAt(i, attempts - 1), 400);
  }

  private async pollChat() {
    if (!this.slot || this.view !== "chat" || this.chatBusy) return;
    // capture the slot this fetch belongs to: assign()→resetChat() can reassign the pane
    // mid-fetch, and the old slot's entries must NOT append under the new slot's header.
    const slot = this.slot, past = this.pastN, gen = this.chatGen, askedAt = Date.now();
    const chatPerf = this.perfChat, switchPerf = this.perfSwitch;
    const failPerf = (reason: "fetch-error" | "http-error"): void => {
      const owns = this.slot === slot && this.pastN === past && this.chatGen === gen;
      for (const span of [chatPerf, switchPerf, ...(owns ? [this.perfChat, this.perfSwitch] : [])]) {
        if (span && !span.done) span.attrs.reason = reason;
        perfFinish(span, false);
      }
      if (owns) { this.perfChat = null; this.perfSwitch = null; }
    };
    const initial = this.chatTotal === 0;
    this.chatBusy = true;
    this.chatAgain = false;
    let grew = false;
    try {
      const res = await api(past === null ? `/api/slots/${slot}/transcript?after=${this.chatTotal}`
        : `/api/slots/${slot}/succession/${past}/transcript?after=${this.chatTotal}`);
      if (this.slot !== slot || this.pastN !== past || this.chatGen !== gen) return; // reassigned during the fetch — stale
      if (!res.ok) {
        failPerf("http-error");
        return;
      }
      const data = (await res.json()) as { entries: TEntry[]; total: number; source: string | null;
        cache?: { at: number; provider: string } | null; model?: string | null; ttlSec?: number;
        effort?: string | null;
        // the band's past session (GET /api/slots/:id/succession/:n/transcript)
        session?: number; startedAt?: number | null; handedAt?: number | null; assigned?: boolean;
        reason?: string; ctx?: { usedTokens: number; windowTokens: number; pct: number } | null };
      if (this.slot !== slot || this.pastN !== past || this.chatGen !== gen) return; // reassigned during json() — still stale
      grew = data.entries.length > 0;
      if (past !== null) {
        this.paintPastBar({ session: past, startedAt: data.startedAt ?? null, handedAt: data.handedAt ?? null,
          ctx: data.ctx ?? null });
        if (data.assigned !== true) {
          this.chatEl.replaceChildren(el("div", "chatempty", data.reason ?? "Transkript nicht zugeordnet"));
          return;
        }
        // a past file does not grow: what it names about model, effort and cache is not the
        // composer's business, so only the entries are read below
        data.cache = undefined; data.model = undefined; data.effort = undefined; data.ttlSec = undefined;
      }
      // the slot's active transcript changed (fresh claude after a self-heal, or a better
      // pinned file appeared) — start over from the top of the new file
      if (this.chatSource !== null && data.source !== this.chatSource) {
        this.chatEl.replaceChildren();
        this.pending = [];
        this.openAgents.clear();
        this.chatTotal = 0;
        this.chatSource = data.source;
        this.chatAgain = true;
        return; // the next read refills from 0
      }
      this.chatSource = data.source;
      if (data.source === null && !this.chatEl.childElementCount) {
        this.chatEl.replaceChildren(el("div", "chatempty", past !== null
          ? "Die Transkript-Datei dieser Session liegt nicht mehr auf der Platte"
          : "no transcript yet — say something in the terminal"));
      }
      if (data.entries.length) {
        const empty = this.chatEl.querySelector(".chatempty");
        if (empty) empty.remove();
        // a delta flies in; a first fill (and a refill after a source change) does not
        const first = this.chatTotal === 0, before = this.chatEl.childElementCount;
        this.chatFresh = !first;
        for (const e of data.entries) {
          this.appendEntry(e);
          // the cache counter's reference is the last API REQUEST, and a request starts right
          // after a prompt (a user entry) or a tool result — the agent's own text and tool calls
          // are the response to it, not a new read of the cache (fifteenth cut, measured: counting
          // every entry reset the counter up to 3× per tool turn)
          // (codex/pi name their reference themselves, below — `cache` in the payload)
          if (data.cache !== undefined) continue;
          // (a slash command and its output run locally in Claude Code — no request)
          const startsRequest = (e.role === "user" && !e.blocks.every((b) => b.t === "text" && isSlashLine(b.text)))
            || e.blocks.some((b) => b.t === "tool_result");
          const at = startsRequest && e.ts ? Date.parse(e.ts) : NaN;
          if (at > this.lastTurnAt) this.lastTurnAt = at;
        }
        // what has not arrived yet stays below what has, above the quiet end lines (held bundle, status)
        // (a pending bubble already there stays put — no remove + re-add)
        this.chatFresh = false;
        this.settleTail();
        this.entriesAskedAt = Math.max(this.entriesAskedAt, askedAt);
        tickCacheAge();
        this.chatGrew(this.chatEl.childElementCount - before, first);
      }
      // the session's own queue comes with the live state (pollLive), every liveMs, not with this read
      // the held line and the status line stay the last things in the view, below what this read appended
      if (past === null) { this.syncHeld(); this.syncLive(); }
      // codex / pi: the file's own newest request record (server/conversation-read.ts) — codex its
      // newest token_usage_record, pi its newest assistant message's request start — and the
      // provider that sets the TTL. Read on every poll, not only when new entries arrived.
      // claude: the server names the cache tier — the counter measures against it (codex/pi above
      // and below are untouched: they carry `cache`, never `ttlSec`)
      if (data.cache === undefined && typeof data.ttlSec === "number" && data.ttlSec > 0 && data.ttlSec !== this.cacheTtlSec) {
        this.cacheTtlSec = data.ttlSec;
        this.cacheTtl = data.ttlSec * 1000;
        tickCacheAge();
      }
      if (data.cache !== undefined) {
        if (data.cache && data.cache.at > this.lastTurnAt) this.lastTurnAt = data.cache.at;
        this.cacheTtl = data.cache ? cacheTtlFor(data.cache.provider) : this.cacheTtl;
        tickCacheAge();
      }
      if (data.model !== undefined && data.model !== this.observedModel) {
        this.observedModel = data.model;
        if (focused === this.index) renderComposerOpts(false);
      }
      if (data.effort !== undefined && data.effort !== this.observedEffort) {
        this.observedEffort = data.effort;
        if (focused === this.index) renderComposerOpts(false);
      }
      this.chatTotal = data.total;
      if (initial && past === null) {
        this.perfChatLoaded = true;
        if (this.view === "chat") {
          const visibleChat = this.perfChat;
          if (visibleChat) visibleChat.attrs.entries = data.entries.length;
          perfFinish(visibleChat, true, res);
          this.perfChat = null;
          this.visibleSwitch(false, res);
        }
      }
      // every poll re-reads the working fact and re-arms the RECENT_MS hide timer (the timer
      // alone makes the bound, the poll only refreshes the fact when new output moved it)
      if (past === null) this.updateWork();
    } catch {
      failPerf("fetch-error");
      // transient fetch error — next tick retries
    } finally {
      if (this.chatGen === gen) this.chatFresh = false; // an entry that threw must not leave the flag up
      // only the poll that still owns the current slot manages busy/timer state; a stale
      // (reassigned) poll must not reset the new slot's chatBusy or reschedule its timer.
      if (this.slot === slot && this.chatGen === gen) {
        this.chatBusy = false;
        // chatMs === 0 means the tab went hidden mid-fetch: stop the chain rather than
        // re-arm it. chatPump() (driven by the poll pump on the way back) restarts it.
        const ms = plan().chatMs;
        // the running session's chat is told by its pane socket when the transcript grew (onPush): it reads
        // again only when that happened during this read. Without a push (no word yet, the socket dropped,
        // codex/pi) the chatMs chain runs as before. A past session's file is finished: once a read brings
        // nothing new there is nothing to poll
        const pushed = past === null && this.pushLines !== null;
        if (this.view === "chat" && ms && pushed) {
          clearTimeout(this.chatTimer);
          if (this.chatAgain) void this.pollChat();
        } else if (this.view === "chat" && ms && (past === null || grew)) {
          clearTimeout(this.chatTimer);
          this.chatTimer = setTimeout(() => void this.pollChat(), ms);
        }
      }
    }
  }

  // the pane socket said how many complete lines the transcript has (server/transcript-push.ts): the running
  // session's chat reads now if it has not got them. A hidden tab (chatMs 0) catches up through chatPump
  private onPush(raw: string): void {
    let m: { t?: unknown; lines?: unknown };
    try { m = JSON.parse(raw) as typeof m; } catch { return; } // not a message this client knows
    if (m.t !== "transcript" || typeof m.lines !== "number") return;
    this.pushLines = m.lines;
    if (this.view !== "chat" || this.pastN !== null || !plan().chatMs || m.lines === this.chatTotal) return;
    if (this.chatBusy) { this.chatAgain = true; return; }
    clearTimeout(this.chatTimer);
    void this.pollChat();
  }

  // the poll pump drives this on every visibility flip and every flip of the switch: drop
  // the pending tick first (pollChat() only declines to RE-arm, so one already-scheduled
  // poll would still fire into a hidden tab), then restart the chain if the plan still
  // wants one. Restarting costs a single request, not a backlog — the fetch is a delta
  // (after=chatTotal), so an hour spent hidden is still one catch-up.
  chatPump() {
    clearTimeout(this.chatTimer);
    if (this.view === "chat" && plan().chatMs) void this.pollChat();
    clearTimeout(this.liveTimer);
    this.liveTimer = undefined;
    this.ensureLive();
  }

  sendRaw(s: string) {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      // held for the next seed of this slot, as it was before the strip (the owner, 2026-09-27:
      // „[Zitat entfernt]“). A late Enter could meet a prompt the session shows by
      // then; fleet sessions skip permission prompts, and the slot binding is the one boundary.
      if (this.slot) { ({ held: this.held, lost: this.dropped } = holdKeys(this.held, this.dropped, s)); this.paintDown(); }
      return;
    }
    const bytes = new TextEncoder().encode(s);
    // splitting mid-codepoint is safe: tmux relays raw bytes to the pty, which
    // reassembles UTF-8 the same way it would from fast individual keystrokes
    for (let i = 0; i < bytes.length; i += MAX_CHUNK) this.ws.send(bytes.slice(i, i + MAX_CHUNK));
  }

  private connect(force = false) {
    if (!this.slot) return;
    this.perfSeedReady = false;
    this.gen++;
    const g = this.gen;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    // cols/rows tell the server our real size synchronously at connect time, so it can
    // seed correctly-wrapped scrollback instead of racing the separate /resize POST.
    // force (set only by reconnect(), i.e. the reload/refresh button) skips the server's
    // width-mismatch check — otherwise "reload" is a silent no-op whenever this client's
    // width already happens to match the pane's, which is the common case
    // seed = how many lines of scrollback we're willing to be handed on connect. Sent only
    // in data-saver mode; absent means the server's own SEED_LINES, i.e. today's behaviour.
    // Read at connect time, so flipping the switch takes effect on the NEXT reconnect.
    const seed = plan().seed;
    this.pushLines = null;
    const ws = new WebSocket(
      `${proto}://${location.host}/ws/${this.slot}?cols=${this.term.cols}&rows=${this.term.rows}${force ? "&force=1" : ""}${seed ? `&seed=${seed}` : ""}&push=1`,
    );
    this.ws = ws;
    ws.binaryType = "arraybuffer";
    let openedAt = 0;
    let firstFrame = true;
    ws.onopen = () => {
      if (g !== this.gen) { ws.close(); return; }
      openedAt = Date.now();
      if (focused === this.index) setConn(true);
      this.hideDown();
      this.sendResize(true);
    };
    ws.onmessage = (e) => {
      // a text frame is the server talking to the chat (server/transcript-push.ts), never terminal bytes
      if (typeof e.data === "string") { if (g === this.gen) this.onPush(e.data); return; }
      const action = seedFramePlan(g, this.gen, firstFrame);
      if (!action) return;
      if (action.reset) {
        this.term.reset();
        this.pinPending = action.pin;
        firstFrame = false;
      }
      // the seed (a scrollback capture, on every path) is always the first frame the
      // server sends on open. Once it's parsed, the buffer sits at ydisp===ybase, but
      // xterm's DOM viewport can be parked at row 0 — its Viewport refresh multiplies
      // ydisp by a rowHeight that is 0 until the pane element is measured/visible, so a
      // refresh that lands a frame too early leaves scrollTop=0 ("stuck at the top").
      // Re-pin once the seed is written; the write callback runs after the buffer settles.
      const pin = this.pinPending;
      this.pinPending = false;
      this.term.write(new Uint8Array(e.data as ArrayBuffer), pin || action.reset ? () => {
        if (pin) this.pinToBottom();
        if (action.reset && g === this.gen) this.perfSeedReady = true;
        if (action.reset && g === this.gen && this.view === "term") this.visibleSwitch(false);
      } : undefined);
      if (action.reset) this.flushHeld();
    };
    ws.onclose = () => {
      if (g !== this.gen) return;
      // no socket, no push: the running session's chat goes back to its chatMs chain until the next one
      this.pushLines = null;
      if (this.view === "chat" && this.pastN === null && plan().chatMs) void this.pollChat();
      perfFinish(this.perfSwitch, false); this.perfSwitch = null;
      if (focused === this.index) setConn(false);
      // every successful open costs a scrollback seed, so a socket that keeps opening and
      // dropping is as expensive as one that never opens — only a socket that STAYED up
      // earns the fast first retry back (see src/backoff.ts)
      if (openedAt && Date.now() - openedAt >= RECONNECT_SETTLED_MS) this.retries = 0;
      const wait = reconnectDelay(this.retries++);
      this.showDown(wait);
      setTimeout(() => {
        if (g === this.gen && fleet[this.slot - 1]?.cwd) this.connect();
      }, wait);
    };
  }

  assign(slot: number) {
    if (slot === this.slot) { this.focus(); this.scrollToEnd(); this.visibleExistingSwitch(); return; }
    this.leavePast();
    this.closeSearch(); // the hits were the old slot's text
    // the slot this pane leaves keeps its chat and its reading position (owner 2026-09-29: „[Zitat entfernt]“
    // ) — this replaced the older wish in note
    // 37439a62 to land every switch at the end
    this.shelveChat();
    this.slot = slot;
    if (this.hoverOn) {
      void loadEntityDetails();
      const cwd = fleet.find((sl) => sl.id === slot)?.cwd;
      if (cwd && !fxTree.has(cwd)) void loadTree(slot, cwd).then(() => this.refreshEntities());
    }
    this.retries = 0; // a different pane: the old one's backoff says nothing about this one
    this.gen++; // orphan the old socket before close so its onclose can't reconnect
    this.ws?.close();
    this.held = ""; // keys typed for the previous slot never reach this one
    this.dropped = 0;
    this.hideDown();
    this.hideCopy();
    this.term.reset();
    const restored = !!slot && this.unshelveChat(slot);
    this.perfChatLoaded = restored;
    perfFinish(this.perfChat, false);
    this.perfChat = null;
    if (slot && this.view === "chat") {
      if (restored) this.visibleSwitch(true);
      else this.perfChat = perfStart("J4", this.perfSwitch?.start, { view: "chat", shelf: false });
    }
    if (!restored) this.resetChat();
    this.boardBtn.style.display = slot ? "flex" : "none";
    this.reloadBtn.style.display = slot ? "flex" : "none";
    this.syncHarnessAffordances();
    if (slot && this.view === "chat") { void this.pollChat(); this.ensureLive(); }
    this.hint.style.display = slot ? "none" : "flex";
    // size the terminal to its container before connecting — the WS URL carries
    // this size, and connecting at a stale default (e.g. 80x24) would seed scrollback
    // at the wrong width and force an immediate second reseed once refit() catches up
    if (slot) { this.fit.fit(); this.pinPending = true; this.connect(); }
    if (!booting) this.focus();
    // the terminal always lands on its end (it was re-seeded); the chat only on a first open
    this.scrollToEnd(!restored);
    renderSlots(); // focusPane skips no-op renders, but an assignment always changes the sidebar
    saveView();
  }

  focus() {
    focusPane(this.index);
    if (isMobile()) return; // focusing would be pointless without a hardware keyboard
    // the chat view's input is the composer: the terminal sits visibility:hidden under it and takes
    // no focus, so a switch left the keyboard on <body> (measured 2026-09-29, every frame of A->B->A)
    if (this.view === "chat" && this.pastN === null) ta.focus();
    else this.term.focus();
  }

  // the terminal font (card K8): set and refit — the refit sends tmux the new column count, and the
  // next socket connects with it
  setFontSize(px: number): void {
    if (this.term.options.fontSize === px) return;
    this.term.options.fontSize = px;
    this.refit();
  }

  // the same bar in both views: over the terminal it searches the scrollback (the addon), over the
  // conversation the transcript as it stands in the page (findChat)
  openSearch(): void {
    if (this.view !== "term" && this.view !== "chat") return;
    const chat = this.view === "chat";
    this.findInput.placeholder = chat ? "Im Gespräch suchen" : "Im Verlauf suchen";
    this.findInput.setAttribute("aria-label", chat ? "Im Gespräch suchen" : "Im Terminalverlauf suchen");
    this.findBar.classList.add("open");
    this.findInput.focus();
    this.findInput.select();
    if (this.findInput.value) this.findStep(-1);
  }

  closeSearch(): void {
    if (!this.findBar.classList.contains("open")) return;
    this.findBar.classList.remove("open");
    this.search.clearDecorations();
    this.term.clearSelection();
    this.clearChatHits();
    this.findCount.textContent = "";
    if (this.view === "term" && !isMobile()) this.term.focus();
  }

  // -1 = the older hit (upward, where the search starts from the end), 1 = the newer one
  private findStep(dir: -1 | 1): void {
    const q = this.findInput.value;
    if (this.view === "chat") { this.findChat(q, dir); return; }
    if (!q) { this.search.clearDecorations(); this.term.clearSelection(); this.findCount.textContent = ""; return; }
    if (dir < 0) this.search.findPrevious(q, { decorations: findMarks() });
    else this.search.findNext(q, { decorations: findMarks() });
  }

  // THE CONVERSATION'S SEARCH: every hit of `q` (case folded) in the chat's text nodes, newest
  // last; a new query starts at the newest hit, as the terminal's does, and Enter walks older
  private findChat(q: string, dir: -1 | 1): void {
    // a conversation drawn again since the last search left its ranges on detached nodes: that is a
    // new search too, or Enter walks the rects of nothing (review 2026-10-08)
    const fresh = q !== this.chatQuery || this.chatHits.some((r) => !r.startContainer.isConnected);
    this.chatQuery = q;
    if (fresh) {
      this.clearChatHits();
      if (!q) { this.findCount.textContent = ""; return; }
      const needle = q.toLocaleLowerCase();
      const walk = document.createTreeWalker(this.chatEl, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const text = (n.textContent ?? "").toLocaleLowerCase();
        for (let i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + needle.length)) {
          const r = document.createRange();
          r.setStart(n, i);
          r.setEnd(n, i + needle.length);
          this.chatHits.push(r);
        }
      }
      this.chatHit = this.chatHits.length;
    }
    const n = this.chatHits.length;
    if (!n) { this.paintFindCount(-1, 0); return; }
    this.chatHit = ((fresh ? this.chatHit - 1 : this.chatHit + dir) + n) % n;
    const cur = this.chatHits[this.chatHit];
    const reg = "highlights" in CSS ? CSS.highlights : undefined;
    if (reg && typeof Highlight === "function") {
      // one add() per hit, never a spread: a one-letter query in a long conversation has more hits
      // than an engine takes arguments (JSC ~65k), and the input handler would throw
      const all = new Highlight();
      for (const r of this.chatHits) all.add(r);
      reg.set("fleetfind", all);
      reg.set("fleetfindcur", new Highlight(cur));
    } else {
      const sel = getSelection();
      sel?.removeAllRanges();
      sel?.addRange(cur);
    }
    const box = cur.getBoundingClientRect(), view = this.chatEl.getBoundingClientRect();
    if (box.top < view.top + view.height * 0.2 || box.bottom > view.bottom - view.height * 0.2) {
      this.chatStuck = false;
      this.chatEl.scrollTop += box.top - view.top - view.height / 3;
    }
    this.paintFindCount(this.chatHit, n);
  }
  private chatQuery = "";
  private clearChatHits(): void {
    this.chatHits = [];
    this.chatHit = -1;
    this.chatQuery = "";
    const reg = "highlights" in CSS ? CSS.highlights : undefined;
    reg?.delete("fleetfind");
    reg?.delete("fleetfindcur");
  }

  private paintFindCount(index: number, count: number): void {
    if (!this.findInput.value) { this.findCount.textContent = ""; return; }
    this.findCount.textContent = count === 0 ? "keine Treffer"
      : index < 0 ? `über ${count}` : `${index + 1} von ${count}`;
  }

  scrollToEnd(chat = true) {
    this.snapToBottom();
    this.pinToBottom();
    if (!chat) return;
    this.chatStuck = true;
    this.chatUnseen = 0;
    this.paintEndBtn();
    requestAnimationFrame(() => {
      this.chatEl.scrollTop = this.chatEl.scrollHeight;
      requestAnimationFrame(() => { this.chatEl.scrollTop = this.chatEl.scrollHeight; });
    });
    clearTimeout(this.bottomTimer);
    this.bottomTimer = setTimeout(() => { if (this.chatStuck) this.chatEl.scrollTop = this.chatEl.scrollHeight; }, 500);
  }

  // --- HAFTEN AM ENDE (Tranche 2). The one reader of the view's scroll: at the end (within
  // CHAT_FOLLOW_PX) the view haftet and the count is cleared; a scroll UP from anywhere else lets go.
  // A glide down, a view that grew under a still scrollTop, content that shrank at the end — none of
  // them scrolls up away from the end, so only the reader's own hand releases it.
  private chatScrolled(): void {
    const c = this.chatEl;
    const top = c.scrollTop;
    if (top + c.clientHeight >= c.scrollHeight - CHAT_FOLLOW_PX) {
      if (!this.chatStuck || this.chatUnseen) { this.chatStuck = true; this.chatUnseen = 0; this.paintEndBtn(); }
    } else if (top < this.chatLastTop - 1 && this.chatStuck) {
      this.chatStuck = false;
      this.paintEndBtn();
    }
    this.chatLastTop = top;
  }
  // the end button, a send, and every delta while the view haftet: glide to the newest message
  // (a jump under prefers-reduced-motion, and for a first fill — `smooth` false)
  private followEnd(smooth: boolean): void {
    this.chatStuck = true;
    this.chatUnseen = 0;
    this.paintEndBtn();
    const c = this.chatEl;
    if (smooth && !chatStill.matches) c.scrollTo({ top: c.scrollHeight, behavior: "smooth" });
    else c.scrollTop = c.scrollHeight;
    // the fallback for an engine without scrollend
    clearTimeout(this.followTimer);
    this.followTimer = setTimeout(() => this.settleEnd(), 900);
  }
  private settleEnd(): void {
    const c = this.chatEl;
    if (this.chatStuck && c.scrollTop + c.clientHeight < c.scrollHeight - 1) c.scrollTop = c.scrollHeight;
  }
  // after a poll appended: `added` new top-level nodes (messages, a new tool block). Following → to
  // the end; released → nothing moves, the count grows.
  private chatGrew(added: number, first: boolean): void {
    if (this.chatStuck) this.followEnd(!first);
    else if (added > 0) { this.chatUnseen += added; this.paintEndBtn(); }
  }
  private paintEndBtn(): void {
    const b = this.endBtn, n = this.chatStuck ? 0 : this.chatUnseen;
    b.setAttribute("aria-pressed", String(this.chatStuck));
    b.classList.toggle("news", n > 0);
    this.endCount.textContent = n ? `${n} neu` : "";
    b.title = this.chatStuck
      ? "Haftet an der neuesten Nachricht — neue Nachrichten erscheinen hier live. Hochscrollen löst das."
      : n ? `${n} neue Nachricht${n === 1 ? "" : "en"} unten — klicken führt hin, die Ansicht haftet dann dort`
      : "Zur neuesten Nachricht — die Ansicht haftet dann dort und folgt neuen Nachrichten";
    b.setAttribute("aria-label", n ? `${n} neue Nachrichten unten` : this.chatStuck ? "Haftet am Ende" : "Zur neuesten Nachricht");
  }

  // the reload/refresh button: forces a fresh WS connection that always re-seeds from a
  // resize+capture-pane, even if this client's width already matches the pane's — a plain
  // reconnect skips reseeding in that case, which would make "reload" a no-op whenever
  // nothing about the size changed, i.e. the exact case this button exists to fix
  reconnect() {
    if (!this.slot) return;
    this.retries = 0; // an explicit ask: honour it now, don't serve it out of the backoff
    this.gen++; // orphan the old socket before close so its onclose can't reconnect
    this.ws?.close();
    this.retryAt = 0; // a strip already up now reads "verbinde…" until this socket opens or drops
    this.paintDown();
    this.term.reset();
    this.fit.fit();
    this.pinPending = true;
    this.loadRenderer();
    this.connect(true);
  }

  private pressStart(e: TouchEvent) {
    clearTimeout(this.pressTimer);
    this.hideCopy();
    const t = e.touches[0];
    if (e.touches.length !== 1 || !t) { this.pressAt = null; return; }
    const at = { x: t.clientX, y: t.clientY };
    this.pressAt = at;
    this.pointNear(at.x, at.y);
    this.pressTimer = setTimeout(() => this.selectLineAt(at.x, at.y), PRESS_MS);
  }

  // xterm asks its link providers only when the pointer enters another cell (Linkifier), and a finger lands on
  // its cell without a move — after a redraw, a tap on the cell of the last tap found no link and opened
  // nothing. Showing xterm the neighbouring row first makes the tap's own move, and a press's, always ask
  private pointNear(x: number, y: number): void {
    const screen = this.term.element?.querySelector(".xterm-screen");
    if (!screen) return;
    const r = screen.getBoundingClientRect();
    const rowHeight = r.height / this.term.rows;
    screen.dispatchEvent(new MouseEvent("mousemove", { clientX: x, clientY: y - r.top >= rowHeight ? y - rowHeight : y + rowHeight, bubbles: true }));
  }

  private selectLineAt(x: number, y: number) {
    const screen = this.term.element?.querySelector(".xterm-screen");
    if (!screen) return;
    const r = screen.getBoundingClientRect();
    const row = Math.floor((y - r.top) / (r.height / this.term.rows));
    if (row < 0 || row >= this.term.rows) return;
    // a link under the finger is copied whole (Mangel 63) — the rows of a wrapped url are no logical line. xterm
    // finds links only for a pointer, so the press shows it one, from the neighbouring row onto the pressed cell;
    // the hover that answers names the address. No leave after it: xterm keeps that link as a tap leaves it
    this.pointNear(x, y);
    this.pointedLink = null;
    screen.dispatchEvent(new MouseEvent("mousemove", { clientX: x, clientY: y, bubbles: true }));
    const link = this.pointedLink;
    let text = link ?? "";
    if (!link) {
      const b = this.term.buffer.active;
      let start = b.viewportY + row, end = start;
      while (start > 0 && b.getLine(start)?.isWrapped) start--;
      while (b.getLine(end + 1)?.isWrapped) end++;
      this.term.selectLines(start, end);
      text = this.term.getSelection().trimEnd();
      if (!text) { this.term.clearSelection(); return; }
    }
    this.pressText = text;
    this.pressFired = true;
    const box = this.root.getBoundingClientRect();
    this.copyPop.textContent = link ? "Link kopieren" : "Kopieren";
    this.copyPop.style.display = "block";
    const w = this.copyPop.offsetWidth;
    this.copyPop.style.left = `${Math.max(4, Math.min(box.width - w - 4, x - box.left - w / 2))}px`;
    this.copyPop.style.top = `${Math.max(4, y - box.top - 56)}px`;
  }

  private hideCopy() {
    this.pressFired = false;
    if (this.copyPop.style.display !== "block") return;
    this.copyPop.style.display = "none";
    this.term.clearSelection();
  }

  private showDown(wait: number) {
    this.retryAt = Date.now() + wait;
    this.root.classList.add("down");
    this.paintDown();
    clearInterval(this.downTimer);
    this.downTimer = setInterval(() => this.paintDown(), 1000);
  }

  private paintDown() {
    if (!this.root.classList.contains("down")) return;
    const s = Math.ceil((this.retryAt - Date.now()) / 1000);
    const n = [...this.held].length;
    const wait = n ? ` · ${n} Zeichen warten, werden nach dem Verbinden gesendet` : "";
    const lost = this.dropped ? ` · ${this.dropped} Zeichen verworfen (über ${HELD_MAX_BYTES} B)` : "";
    this.downMsg.textContent = `${s > 0 ? `getrennt — neuer Versuch in ${s} s` : "getrennt — verbinde…"}${wait}${lost}`;
  }

  private hideDown() {
    clearInterval(this.downTimer);
    this.root.classList.remove("down");
  }

  // the seed of a socket to this pane's slot has arrived: send what was typed meanwhile, once —
  // emptied before the send, so a second seed or a drop mid-send cannot repeat it
  private flushHeld() {
    const held = this.held;
    const lost = this.dropped;
    if (!held && !lost) return;
    this.held = "";
    this.dropped = 0;
    if (held) this.sendRaw(held);
    // what arrived shows in the terminal itself; only a loss needs saying (toast is the error colour)
    if (lost) toast(`Slot ${this.slot}: ${[...held].length} Zeichen nach dem Verbinden gesendet, ${lost} verworfen (über ${HELD_MAX_BYTES} B)`);
  }

  // called from the seed's write callback (see connect()). The buffer is already at
  // ydisp===ybase, so term.scrollToBottom() would early-return without re-syncing the
  // DOM viewport (scrollLines(0) fires no scroll event). Nudge one line off the bottom
  // and back on the next frame — by then the pane is laid out, so the second scroll's
  // refresh computes a correct rowHeight and parks scrollTop at the real bottom.
  private pinToBottom() {
    requestAnimationFrame(() => {
      const b = this.term.buffer.active;
      if (b.baseY === 0) return; // single screen, nothing above to be stuck on
      this.snapToBottom(b.viewportY === b.baseY);
    });
  }

  // every programmatic jump to the tail goes through here, past the wheel smoothing (74486e20).
  // With smoothScrollDuration > 0, xterm's scrollLines only STARTS an animation of the DOM
  // scrollTop, and ydisp catches up one scroll event later — so the nudge's scrollToBottom(),
  // issued in the same frame, still read ybase-ydisp = 0, did nothing, and the animation parked
  // the viewport one line above the tail, where xterm stops following output (T1, 18 of 24 runs:
  // docs/messungen/2026-09-26-rundlauf-einstellungen-terminal.md). At 0 both calls move ydisp
  // synchronously; the duration is restored before anything else runs, so wheel and trackpad
  // keep their glide. A smoothed programmatic jump left anywhere else would also still be
  // animating when this snap lands and pull the viewport back up — hence one door for all.
  snapToBottom(nudge = false) {
    const o = this.term.options;
    const glide = o.smoothScrollDuration;
    o.smoothScrollDuration = 0;
    if (nudge) this.term.scrollLines(-1);
    this.term.scrollToBottom();
    o.smoothScrollDuration = glide;
  }

  refit() {
    // preserve bottom-lock across the fit. xterm only auto-follows streaming output while
    // the viewport sits exactly at the tail (ydisp===ybase); fit() reflows the buffer and
    // can leave it a line or two above the bottom, at which point new output lands off
    // screen (the "stutter") and the jump pill appears — even though the user never scrolled
    // up. If we were following before the resize, re-pin after it with the same rAF nudge
    // connect() uses for the seed. Guarded on wasFollowing so a deliberately scrolled-up
    // pane (reading scrollback) is left where it is. Uses the jump pill's own threshold so
    // "following" here means exactly what "no pill" means everywhere else.
    const b = this.term.buffer.active;
    const wasFollowing = b.viewportY >= b.baseY - 1;
    this.fit.fit();
    if (wasFollowing) this.pinToBottom();
    clearTimeout(this.resizeTimer);
    clearTimeout(this.bottomTimer);
    this.resizeTimer = setTimeout(() => this.sendResize(), 500);
  }

  private sendResize(force = false) {
    if (!this.slot) return;
    if (!force && this.term.cols === this.lastCols && this.term.rows === this.lastRows) return;
    this.lastCols = this.term.cols;
    this.lastRows = this.term.rows;
    void post("/resize", { slot: this.slot, cols: this.term.cols, rows: this.term.rows });
  }

  // A canvas fallback stays visible until ⟳ retries WebGL through loadRenderer().
  private markRenderer() {
    this.reloadBtn.classList.toggle("degraded", this.renderer !== "webgl");
    this.reloadBtn.title = `Neu verbinden — Verlauf neu laden\nRenderer: ${this.renderer}`;
  }

  dispose() {
    // a layout rebuild disposes every pane and assigns the slots to new ones: through the shelf
    // each chat comes back where it was
    this.shelveChat();
    this.gen++;
    this.ws?.close();
    clearInterval(this.downTimer);
    this.linkProvider?.dispose();
    clearTimeout(this.resizeTimer);
    clearTimeout(this.observedRefit);
    this.sizeObserver.disconnect();
    clearTimeout(this.chatTimer);
    clearTimeout(this.liveTimer);
    // an in-flight pollChat() fetch resolving after dispose would otherwise re-arm its
    // own setTimeout forever (its finally-block re-checks view/slot, both still truthy) —
    // clearing them makes that guard fire and end the loop on a disposed instance
    this.slot = 0;
    this.view = "term";
    this.flakes.dispose();
    this.term.dispose();
    this.root.remove();
  }
}

export let panes: Pane[] = [];
export let focused = 0;
let layout = 1;

// THE SETTINGS WINDOW (Grammatik G5, cards K2+K8+D-5+3e6342e2+038d2694): one gear top right, one
// window, five sections. "Dieses Gerät" renders the registry (src/prefs.ts): every key with a row shows its
// label, its control and a way back (G5.1). "Schrift" is the size panel's ONE home (G5.3) — the Aa
// corner button opens the window right there. "Fleet" holds the five server switches whose routes
// already exist (G5.2, card D-3, fleetSection) and, beside them, what the parallelism really is right
// now. "Diese Maschine" reads the fixed class-2 allowlist and renders no control (card D-5).
// "Verbrauch" shows the subscription usage and its explicit refresh (card 038d2694, usageSection).
// The five section targets stand at the top of the window at every width: on the phone each shows
// its one section (G3.1), on the desktop all five stack and a target scrolls to its section. Esc,
// backdrop and ✕ come from openShell (G6.3); the focus enters the window on open, Tab and Shift-Tab
// stay among its visible controls, and the focus returns to the button that opened it (G4).
// Every control is NAMED BY ITS VISIBLE LABEL through aria-labelledby (G5.3, UI-MAIN 30.09.): a
// renamed label renames the control, nobody keeps a copied string in sync.
let settingsShell: Shell | null = null;
let settingsTab = "device";
const SET_TABS: [string, string][] = [["device", "Dieses Gerät"], ["schrift", "Schrift"], ["fleet", "Fleet"], ["machine", "Diese Maschine"], ["usage", "Verbrauch"]];
const SET_CHOICE_WORDS: Record<string, string> = { tree: "Baum", line: "Zeile", all: "alle" };
const setOnOff = (on: boolean): string => on ? "an" : "aus";
// one DOM id per label of the window — the window exists once, a key's dots become dashes
const setId = (part: string): string => `set-${part.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
// what a keyboard can reach inside an element right now: enabled, rendered, not under [hidden] — and
// of a radio group with a choice only the chosen radio, the one stop Tab makes in it
function visibleFocusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("button, input, select, textarea, summary, a[href], [tabindex]:not([tabindex='-1'])")]
    .filter((e) => !(e as HTMLButtonElement).disabled && e.getClientRects().length > 0 && !e.closest("[hidden]")
      && getComputedStyle(e).visibility !== "hidden"
      && !(e instanceof HTMLInputElement && e.type === "radio" && !e.checked && !!e.name
        && !!root.querySelector(`input[type="radio"][name="${CSS.escape(e.name)}"]:checked`)));
}

// The live effect of a row beyond the write itself — the SAME setters the original surfaces
// call, so a settings toggle can never mean something else than its own button (K2: Bedeutung
// unverändert). Absent = the write IS the whole effect, the value is read at use.
const PREF_APPLY: Record<string, () => void> = {
  "fleet.datasaver": () => setSaver(prefBool("fleet.datasaver")),
  "fleet.board": () => setBoard(prefBool("fleet.board")),
  "fleet.sidecollapsed": () => setCollapsed(prefBool("fleet.sidecollapsed")),
  "fleet.termlimit": () => setTermLimit(prefBool("fleet.termlimit")),
  "fleet.more": () => { moreOpen = prefBool("fleet.more"); applyMore(); },
  "fleet.histall": () => { histAll = prefBool("fleet.histall"); if (hist.style.display === "flex") void renderHist(); },
  "fleet.bandDepth": () => renderSlots(),
  "fleet.queue.scope": () => { setQueueTreeOn(prefText("fleet.queue.scope") !== "line"); if (qShell?.isOpen()) { invalidateQueueList(); renderQueue(); } },
  "fleet.board.folds": () => { boardFolds.clear(); void renderBoard(); },
  "fleet.ranke.repos": () => reloadRankePrefs(),
  "fleet.gs.view": () => reloadGsView(),
  "fleet.stacks.closed": () => { stackClosed.clear(); renderSlots(); },
  "fleet.plaudit.ack": () => renderPostLandAudit(),
  "fleet.view": () => setLayout(1, [panes[focused]?.slot ?? 0]),
};

// what a value row shows right now (mono, G5.3)
const SET_VALUE: Record<string, () => string> = {
  "fleet.board.folds": () => `${boardFolds.size} zugeklappt`,
  "fleet.stacks.closed": () => `${stackClosed.size} zugeklappt`,
  "fleet.view": () => `${layout} ${layout === 1 ? "Pane" : "Panes"}`,
  "fleet.plaudit.ack": () => { const at = prefNumber(PLA_ACK_KEY); return at ? fmtTs(at) : "keine"; },
};

function openSettings(trigger?: HTMLElement | null, at?: "schrift" | "fleet"): void {
  if (settingsShell?.isOpen()) {
    settingsShell.root.querySelector<HTMLButtonElement>(at ? `[data-settings-tab="${at}"]` : ".shellclose")?.click();
    return;
  }
  settingsTab = at ?? "device";
  const shell = openShell({
    id: "settings", title: "Einstellungen",
    onClose: () => { settingsShell = null; trigger?.focus(); },
  });
  settingsShell = shell;
  shell.root.classList.add("solo");
  // the window is a modal dialog named by its own title; ✕ is named in words, not by its glyph
  const win = shell.root.querySelector<HTMLElement>(".shellwin");
  const title = shell.root.querySelector<HTMLElement>(".shelltitles h2");
  if (win && title) {
    title.id = setId("title");
    win.setAttribute("role", "dialog");
    win.setAttribute("aria-modal", "true");
    win.setAttribute("aria-labelledby", title.id);
  }
  const closeBtn = shell.root.querySelector<HTMLButtonElement>(".shellclose");
  if (closeBtn) { closeBtn.title = "Schließen (Esc)"; closeBtn.setAttribute("aria-label", "Einstellungen schließen"); }

  const tabs = el("nav", "settabs");
  tabs.setAttribute("aria-label", "Abschnitte");
  const tabBtns = SET_TABS.map(([id, word]) => {
    const b = el("button", "settab", word) as HTMLButtonElement;
    b.type = "button";
    b.id = setId(`tab-${id}`);
    b.dataset.settingsTab = id;
    b.setAttribute("aria-controls", setId(`sec-${id}`));
    b.onclick = () => { settingsTab = id; syncTabs(true); };
    tabs.appendChild(b);
    return b;
  });
  // ONE NAME PER SECTION HEAD. The Fleet section opens with its own sub-heads (Parallelität,
  // Automatik …), so a head "Fleet" right under the pressed target "Fleet" said the word twice
  // (owner 02.10.); it is named by its target instead. The other sections keep their head.
  const section = (id: string, head = true): HTMLElement => {
    const sec = el("section", "setsec");
    sec.id = setId(`sec-${id}`);
    sec.dataset.sec = id;
    if (!head) { sec.setAttribute("aria-labelledby", setId(`tab-${id}`)); return sec; }
    const h = el("h3", "", SET_TABS.find(([x]) => x === id)?.[1] ?? id);
    h.id = setId(`sec-${id}-h`);
    sec.setAttribute("aria-labelledby", h.id);
    sec.appendChild(h);
    return sec;
  };

  const device = section("device");
  for (const d of PREFS) {
    if (!d.row || (d.desktopOnly && MOBILE_MQ.matches)) continue;
    device.appendChild(settingsRow(d));
  }
  const schrift = section("schrift");
  schrift.appendChild(sizePanel()); // the ONE panel moves in here (G5.3, kein zweites Zuhause)
  const fleetsec = section("fleet", false);
  const fleetState = fleetSection(fleetsec);
  const machine = section("machine");
  machineSection(machine);
  const usagesec = section("usage");
  usageSection(usagesec);
  const sections: [string, HTMLElement][] = [["device", device], ["schrift", schrift], ["fleet", fleetsec], ["machine", machine], ["usage", usagesec]];

  shell.detail.append(tabs, device, schrift, fleetsec, machine, usagesec);
  let discard: HTMLElement | null = null;
  let discardFocus: HTMLElement | null = null;
  shell.setCloseGuard(() => {
    const n = fleetState.staged();
    if (!n) { discard?.remove(); discard = null; return false; }
    if (!discard) {
      discardFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      discard = el("div", "setdiscard");
      discard.setAttribute("role", "alertdialog");
      discard.setAttribute("aria-labelledby", "settings-discard-question");
      const question = el("div", "", `${n} Änderungen verwerfen?`);
      question.id = "settings-discard-question";
      const buttons = el("div", "riskbtns");
      const keep = el("button", "riskbtn", "Weiter bearbeiten") as HTMLButtonElement;
      // back to the control the staged value lives in: the one the reader was on, if it is one of
      // the Fleet section's; after ✕ or a backdrop click the first staged control
      keep.onclick = () => {
        discard?.remove(); discard = null;
        const back = discardFocus?.isConnected && fleetsec.contains(discardFocus) ? discardFocus : fleetState.firstStaged();
        settingsTab = "fleet"; syncTabs(false);
        back?.focus();
      };
      const drop = el("button", "riskbtn danger", "Verwerfen") as HTMLButtonElement;
      drop.onclick = () => { shell.setCloseGuard(null); shell.close(); };
      buttons.append(keep, drop);
      discard.append(question, buttons);
      shell.detail.prepend(discard);
      keep.focus();
    }
    discard.querySelector("#settings-discard-question")!.textContent = `${n} Änderungen verwerfen?`;
    shell.detail.scrollTop = 0;
    return true;
  });

  // THE FOCUS TRAP, scoped to this window's own root: Tab after the last visible control goes to
  // the first, Shift-Tab before the first to the last; every step in between is the browser's own.
  // No document handler — a key typed anywhere else is none of this window's business.
  shell.root.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;
    const ring = visibleFocusables(shell.root);
    if (!ring.length) return;
    const i = ring.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey ? (i === 0 ? ring[ring.length - 1] : null) : (i === ring.length - 1 ? ring[0] : null);
    if (next) { e.preventDefault(); next.focus(); }
  });
  // on the desktop all five sections stack: the target of the section under the target row reads
  // pressed while the reader scrolls (one frame per scroll burst, no timer)
  let spy = 0;
  shell.detail.addEventListener("scroll", () => {
    if (MOBILE_MQ.matches || spy) return;
    spy = requestAnimationFrame(() => {
      spy = 0;
      const top = tabs.getBoundingClientRect().bottom + 8;
      const d = shell.detail;
      const cur = sections.find(([id]) => id === settingsTab)?.[1];
      // at the end of the scroll a short last section can never reach the top: a section the reader
      // chose stays chosen while it is on screen
      if (d.scrollTop + d.clientHeight >= d.scrollHeight - 2 && cur
        && cur.getBoundingClientRect().top < d.getBoundingClientRect().bottom) return;
      let pick = sections[0][0];
      for (const [id, sec] of sections) if (sec.getBoundingClientRect().top <= top) pick = id;
      if (pick !== settingsTab) { settingsTab = pick; syncTabs(false); }
    });
  }, { passive: true });
  syncTabs(true);
  tabBtns[Math.max(0, SET_TABS.findIndex(([id]) => id === settingsTab))].focus();

  function syncTabs(scroll: boolean) {
    SET_TABS.forEach(([id], i) => {
      tabBtns[i].classList.toggle("on", settingsTab === id);
      tabBtns[i].setAttribute("aria-pressed", settingsTab === id ? "true" : "false");
    });
    for (const [id, sec] of sections) sec.classList.toggle("on", settingsTab === id);
    if (!scroll) return;
    const sec = sections.find(([id]) => id === settingsTab)?.[1] ?? device;
    shell.detail.scrollTop = MOBILE_MQ.matches ? 0
      : shell.detail.scrollTop + sec.getBoundingClientRect().top - tabs.getBoundingClientRect().bottom - 2;
  }
}

// one registry row (G5.3): label left, control right, the value in mono, a hint under the row —
// and the way back: "Standard" forgets the key, so the next read falls back to the default. The
// control is named by the label element and described by the hint (aria-labelledby/-describedby);
// a toggle carries its state as aria-pressed, a choice is one named group whose chosen option
// alone reads pressed. "Standard" shows only while the row deviates, so the default needs no
// second line beside a state that already says it.
function settingsRow(d: PrefDef): HTMLElement {
  const row = el("div", "setrow");
  const main = el("div", "setmain");
  const label = el("div", "setlabel", d.label);
  label.id = setId(`l-${d.key}`);
  const hint = el("div", "hint setnote", d.hint ?? "");
  hint.id = setId(`h-${d.key}`);
  main.append(label, hint);
  row.appendChild(main);
  const std = d.kind === "bool" ? setOnOff(d.def === "1")
    : d.kind === "choice" ? SET_CHOICE_WORDS[d.def] ?? d.def : null;
  const named = (c: HTMLElement) => { c.setAttribute("aria-labelledby", label.id); c.setAttribute("aria-describedby", hint.id); };

  const sync: (() => void)[] = [];
  let control: HTMLElement;
  // where the focus goes when "Standard" hides itself under the reader's keyboard
  let home: () => HTMLElement | null = () => null;
  if (d.row === "toggle") {
    const b = el("button", "settoggle") as HTMLButtonElement;
    b.type = "button";
    named(b);
    b.onclick = () => { prefSetBool(d.key, !prefBool(d.key)); PREF_APPLY[d.key]?.(); syncAll(); };
    sync.push(() => {
      const on = prefBool(d.key);
      b.textContent = setOnOff(on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    control = b;
    home = () => b;
  } else if (d.row === "choice") {
    const wrap = el("div", "setchoice");
    wrap.setAttribute("role", "group");
    named(wrap);
    for (const v of d.values ?? []) {
      const b = el("button", "settab", SET_CHOICE_WORDS[v] ?? v) as HTMLButtonElement;
      b.type = "button";
      b.onclick = () => { prefSet(d.key, v); PREF_APPLY[d.key]?.(); syncAll(); };
      sync.push(() => {
        const on = prefText(d.key) === v;
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      wrap.appendChild(b);
    }
    control = wrap;
    home = () => wrap.querySelector<HTMLElement>('button[aria-pressed="true"]');
  } else {
    const val = el("span", "setval");
    sync.push(() => { val.textContent = SET_VALUE[d.key]?.() ?? prefText(d.key); });
    control = val;
  }
  const reset = el("button", "setreset", "Standard") as HTMLButtonElement;
  reset.type = "button";
  reset.id = setId(`r-${d.key}`);
  reset.setAttribute("aria-labelledby", `${reset.id} ${label.id}`);
  reset.title = std !== null ? `${d.label}: zurück auf den Standard (${std})` : `${d.label}: zurück auf den Standard`;
  reset.onclick = () => {
    const ring = visibleFocusables(row.closest<HTMLElement>(".shellwin") ?? document.body);
    const at = ring.indexOf(reset);
    prefSet(d.key, null); PREF_APPLY[d.key]?.(); syncAll();
    (home() ?? ring[at + 1] ?? ring[at - 1])?.focus();
  };
  row.append(control, reset);
  function syncAll() {
    for (const f of sync) f();
    const raw = prefRaw(d.key);
    reset.hidden = raw === null || raw === d.def;
  }
  syncAll();
  return row;
}

// THE "VERBRAUCH" SECTION (card 038d2694 over the wire of 7f458ab0, docs/self-api.md §subscription
// usage): what the Codex subscription has used, from GET /api/subscription-usage read ONCE when the
// window opens and again only by the explicit "Neu lesen" — no timer, no repaint read, and no GET
// starts a refresh. The target is chosen apart: "lokal" re-reads the rollout files this machine has
// already stored (a new READ, not a new measurement — the answer says whether the measurement event
// moved); "Anbieter" is the active account read, which the wire names unsupported: its button stays
// aria-disabled (focusable, so its reason stays reachable) and sends nothing. Three times stay
// apart: when the event was measured (measuredAt), when the server read it (fetchedAt), and its age
// by the server's clock (ageMs). A window the wire does not carry reads "unbekannt", never 0; a read
// that fails keeps the last windows this page saw measured, dated and stale. An answer belongs to
// the request that asked it: a newer answer on screen, a switched target or a closed window drops
// it. The model block keeps four facts apart — the owner's preference, the register default, the
// slot's selection and the model a turn really ran — and none of them follows from free quota: a
// model is switched at its session, as before. The words are the owner's, not the wire's (card
// e433): no event checksum, no reader vocabulary, and every "unbekannt" carries one short sentence
// saying what is missing.
type UsageTarget = "local" | "provider";
// the last windows this page saw MEASURED, across window opens: a later failed or unknown read shows
// them dated and stale instead of blank or 0. Page memory only — nothing of it is stored.
let usageSeen: { primary: SubscriptionWindow | null; secondary: SubscriptionWindow | null;
  measuredAt: number; provenance: string | null } | null = null;
const USAGE_STATUS: Record<string, string> = { measured: "aktuell", stale: "veraltet", unknown: "unbekannt", error: "Fehler" };
// the reader's reason codes (codex-quota.ts) as one short sentence each; an unknown code shows as it came
const USAGE_REASON: Record<string, string> = {
  "not-observed": "Die Sitzungsdateien wurden noch nicht gelesen.",
  "missing-windows": "Codex hat keine Limits mitgeschickt.",
  "event-older-than-15-minutes": "Der letzte Stand ist älter als 15 Minuten.",
  "event-time-ahead-of-server": "Die Zeitangabe des Stands liegt in der Zukunft.",
  "invalid-json-line": "Eine Zeile in den Sitzungsdateien ist beschädigt.",
  "invalid-rate-limits": "Die Verbrauchsangaben in den Sitzungsdateien sind ungültig.",
  "invalid-window": "Ein Zeitfenster in den Sitzungsdateien ist ungültig.",
  "missing-or-invalid-event-time": "Dem Stand fehlt eine gültige Uhrzeit.",
  "no-codex-rate-limits": "In den Sitzungsdateien steht kein Codex-Verbrauch.",
  "no-codex-rate-limits-in-observed-tails": "In den neuesten Sitzungsdateien steht kein Codex-Verbrauch.",
  "source-identity-changed": "Die Dateien haben sich beim Lesen geändert.",
  "missing-source": "Auf dieser Maschine liegt kein Codex-Sitzungsordner.",
  "unreadable-source": "Die Sitzungsdateien lassen sich nicht lesen.",
  "read-timeout": "Das Lesen hat länger als 5 s gedauert und wurde abgebrochen.",
  "read-failed": "Das Lesen ist fehlgeschlagen.",
};
// the wire's three prose reasons (server.ts#subscriptionUsage, codex-quota.ts#PROVIDER_UNSUPPORTED)
// as the sentence the owner reads; a changed sentence shows as the server wrote it
const USAGE_PROSE: Record<string, string> = {
  "installed schema proves account/rateLimits/read, but no account-bound reader or authorized account connection is evidenced":
    "Die Fleet hat keinen Zugang, um das Konto beim Anbieter abzufragen.",
  "no measured subscription sensor; dated owner availability messages have no machine-readable source or validity contract":
    "Für andere Abos erfasst die Fleet noch keinen Verbrauch.",
  "no dated owner preference source with scope and validity":
    "Von dir ist keine Modell-Vorgabe hinterlegt.",
};
// what a refresh did, as the server line names it
const USAGE_REFRESH: Record<string, string> = { refreshing: "läuft", ok: "erledigt", error: "fehlgeschlagen", timeout: "abgebrochen", unsupported: "nicht möglich" };
const usageReason = (r: string | null): string => r === null ? "" : USAGE_REASON[r] ?? r;
const usageProse = (r: string): string => USAGE_PROSE[r] ?? r;
const usageClock = (ms: number): string => {
  const d = new Date(ms);
  const time = d.toLocaleTimeString("de-DE");
  return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString("de-DE", { day: "numeric", month: "short" })} ${time}`;
};
function usageSpan(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "unter 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
  return h % 24 ? `${Math.floor(h / 24)} Tage ${h % 24} h` : `${Math.floor(h / 24)} Tage`;
}
const usageLength = (m: number): string => m % 1440 === 0 ? `${m / 1440} ${m === 1440 ? "Tag" : "Tage"}` : m % 60 === 0 ? `${m / 60} h` : `${m} min`;
const usagePct = (p: number): string => `${p.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
// a served answer is used only in the shape the wire promises; anything else is "nicht lesbar"
function usageOf(raw: unknown): SubscriptionUsage | null {
  const obj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
  const num = (x: unknown): boolean => typeof x === "number" && Number.isFinite(x);
  const numOrNull = (x: unknown): boolean => x === null || num(x);
  const win = (x: unknown): boolean => x === null || (obj(x) && num(x.used_percent) && num(x.window_minutes) && num(x.resets_at));
  if (!obj(raw) || raw.schema !== "fleet.subscription-usage/v1" || !num(raw.generatedAt)) return null;
  const c = raw.codex, m = raw.model;
  if (!obj(c) || typeof c.status !== "string" || !(c.status in USAGE_STATUS) || !win(c.primary) || !win(c.secondary)) return null;
  const s = c.source, r = c.refresh, p = c.provider;
  if (!obj(s) || !numOrNull(s.measuredAt) || !numOrNull(s.fetchedAt) || !numOrNull(s.ageMs) || !num(s.staleAfterMs)
    || !obj(s.selection) || !obj(r) || typeof r.status !== "string" || !numOrNull(r.startedAt) || !numOrNull(r.finishedAt)
    || !obj(p) || typeof p.status !== "string" || typeof p.reason !== "string") return null;
  if (!obj(raw.otherSubscriptions) || typeof raw.otherSubscriptions.reason !== "string" || !obj(m) || !obj(m.ownerPreference)
    || typeof m.ownerPreference.reason !== "string" || !obj(m.registerDefaults) || !Array.isArray(m.selected)) return null;
  return raw as unknown as SubscriptionUsage;
}
function usageSection(sec: HTMLElement): void {
  let usage: SubscriptionUsage | null = null;
  let openFailed = "";
  let target: UsageTarget = "local";
  // the newest request, the request whose answer is on screen, the refresh this window waits for
  let asked = 0, shown = 0, pending = 0;
  let pendingTarget: UsageTarget | null = null;
  let outcome = "";
  let failed = false;

  const stat = (key: string, word: string) => {
    const row = el("div", "setstat");
    row.dataset.use = key;
    const v = el("span", "setstatv");
    const more = el("div", "setstatl");
    row.append(el("span", "setstatk", word), v, more);
    sec.appendChild(row);
    return { row, v, more };
  };
  sec.appendChild(el("h4", "setsub", "Codex-Abo"));
  const state = stat("state", "Zustand");
  const wins = { primary: stat("primary", "Erstes Fenster"), secondary: stat("secondary", "Zweites Fenster") };
  const source = stat("source", "Quelle");
  const measured = stat("measured", "Gemessen");
  const age = stat("age", "Alter");
  const fetched = stat("fetched", "Gelesen");

  // the refresh: a native radio group picks the target, one button reads, one status line answers
  const box = el("fieldset", "usetarget");
  const legend = el("legend", "", "Neu lesen aus");
  legend.id = setId("use-target");
  const radios = el("div", "useradios");
  const radio = (value: UsageTarget, word: string): HTMLInputElement => {
    const label = el("label", "useradio");
    const input = el("input", "") as HTMLInputElement;
    input.type = "radio"; input.name = "set-usage-target"; input.value = value;
    input.checked = value === target;
    input.onchange = () => { if (input.checked) pick(value); };
    label.append(input, el("span", "", word));
    radios.appendChild(label);
    return input;
  };
  radio("local", "Gespeicherter Stand");
  radio("provider", "Konto beim Anbieter");
  const hint = el("div", "hint setnote");
  hint.id = setId("use-hint");
  const btn = el("button", "setreset usebtn", "Neu lesen") as HTMLButtonElement;
  btn.type = "button";
  btn.setAttribute("aria-describedby", hint.id);
  btn.onclick = () => { if (btn.getAttribute("aria-disabled") !== "true") void read(target); };
  const ctl = el("div", "usectl");
  const status = el("div", "hint setnote usestatus");
  status.setAttribute("role", "status");
  const server = el("div", "hint setnote");
  ctl.append(btn, status);
  box.append(legend, radios, hint, ctl, server);
  sec.appendChild(box);

  sec.appendChild(el("h4", "setsub", "Andere Abos"));
  const others = stat("others", "Zustand");

  sec.appendChild(el("h4", "setsub", "Modell"));
  const pref = stat("preference", "Deine Vorgabe");
  const defaults = stat("defaults", "Standard");
  const selected = stat("selected", "An Sessions gewählt");
  const turn = stat("turn", "Wirklich benutzt");
  sec.appendChild(el("div", "hint setnote", "Freies Kontingent wählt kein Modell. Ein Modell wechselst du wie bisher an seiner Session."));

  function pick(value: UsageTarget) {
    target = value;
    // a target switch ends the wait: the answer of the other target no longer belongs on screen
    if (pending && pendingTarget !== value) { pending = 0; pendingTarget = null; outcome = "Antwort verworfen, weil du die Quelle gewechselt hast."; failed = false; }
    paint();
  }
  async function read(kind: "open" | UsageTarget) {
    const mine = ++asked;
    if (kind !== "open") { pending = mine; pendingTarget = kind; outcome = ""; failed = false; }
    paint();
    let res: Response | null = null;
    let body: unknown = null;
    try {
      res = kind === "open" ? await api("/api/subscription-usage") : await post("/api/subscription-usage/refresh", { target: kind });
      body = await res.json().catch(() => null);
    } catch { res = null; }
    if (!sec.isConnected || mine < shown || (kind !== "open" && mine !== pending)) return;
    if (kind !== "open") { pending = 0; pendingTarget = null; }
    const got = res?.ok ? usageOf(body) : null;
    if (got) {
      const seenBefore = usageSeen;
      usage = got; shown = mine;
      const c = got.codex;
      if ((c.status === "measured" || c.status === "stale") && (c.primary || c.secondary) && c.source.measuredAt !== null)
        usageSeen = { primary: c.primary, secondary: c.secondary, measuredAt: c.source.measuredAt, provenance: c.source.provenance };
      if (kind !== "open") outcome = refreshWords(got, seenBefore);
    } else {
      const why = !res ? "Der Server ist nicht erreichbar." : res.status === 409 ? "Der Server liest gerade schon. Versuch es gleich noch einmal."
        : res.ok ? "Die Antwort des Servers ist nicht lesbar." : `Der Server antwortet mit Fehler ${res.status}.`;
      if (kind === "open") openFailed = why;
      else { failed = true; outcome = `Neu lesen fehlgeschlagen. ${why}`; }
    }
    paint();
  }
  // what one refresh answer says about itself — a local read is a READ: same event, same measurement
  function refreshWords(u: SubscriptionUsage, before: typeof usageSeen): string {
    const r = u.codex.refresh, src = u.codex.source;
    const at = r.finishedAt !== null ? ` um ${usageClock(r.finishedAt)}` : "";
    if (r.status === "unsupported") return `Noch nicht möglich. ${usageProse(r.reason ?? u.codex.provider.reason)}`;
    if (r.status === "error" || r.status === "timeout") { failed = true; return `Neu lesen${at} fehlgeschlagen. ${usageReason(r.reason) || "Der Grund ist nicht bekannt."}`; }
    if (r.status !== "ok") return `Der Server meldet „${USAGE_REFRESH[r.status] ?? r.status}“.`;
    if (src.measuredAt === null) return `Neu gelesen${at} — kein Stand gefunden.`;
    return before && before.provenance !== null && before.provenance === src.provenance
      ? `Neu gelesen${at} — nichts Neues, der Stand von ${usageClock(src.measuredAt)} gilt weiter.`
      : `Neu gelesen${at} — Stand von ${usageClock(src.measuredAt)}.`;
  }
  function paintWindow(x: ReturnType<typeof stat>, w: SubscriptionWindow | null, at: number | null, stale: boolean, why: string) {
    x.v.replaceChildren(); x.more.textContent = "";
    x.row.classList.toggle("stale", stale && w !== null);
    if (!w) { x.v.textContent = "unbekannt"; x.more.textContent = why; return; }
    const bar = el("span", "usebar");
    bar.setAttribute("aria-hidden", "true");
    const fill = el("i", "");
    fill.style.width = `${Math.max(0, Math.min(100, w.used_percent))}%`;
    bar.appendChild(fill);
    x.v.append(`${usagePct(w.used_percent)} verbraucht`, bar);
    const reset = w.resets_at * 1000;
    // the reset against the server's clock at the read, never this device's
    const left = at !== null ? reset - at : null;
    const when = left === null ? "" : left > 0 ? ` (in ${usageSpan(left)})` : " (schon vorbei, der Wert ist vielleicht schon zurückgesetzt)";
    x.more.textContent = `Fenster ${usageLength(w.window_minutes)} · beginnt neu um ${usageClock(reset)}${when}${stale ? ` · ${why}` : ""}`;
  }
  function paint() {
    const c = usage?.codex ?? null;
    if (!c) {
      state.v.textContent = openFailed ? "unbekannt" : "wird gelesen …"; state.more.textContent = openFailed;
      const seen = usageSeen;
      const missing = "Es fehlt eine lesbare Antwort des Servers.";
      for (const k of ["primary", "secondary"] as const)
        paintWindow(wins[k], seen?.[k] ?? null, null, !!seen, seen ? `Stand von ${usageClock(seen.measuredAt)}, veraltet` : missing);
      // the first read still running and nothing seen: the windows wait like every other row
      if (!openFailed && !seen) for (const k of ["primary", "secondary"] as const) { wins[k].v.textContent = "wird gelesen …"; wins[k].more.textContent = ""; }
      for (const x of [source, measured, age, fetched, others, pref, defaults, selected, turn]) {
        x.v.textContent = openFailed ? "unbekannt" : "wird gelesen …"; x.more.replaceChildren(openFailed ? missing : "");
      }
    } else {
      const s = c.source;
      state.v.textContent = USAGE_STATUS[c.status] ?? c.status;
      state.more.textContent = usageReason(s.reason);
      const now = usage!.generatedAt;
      if (c.primary || c.secondary) {
        const stale = c.status === "stale";
        for (const k of ["primary", "secondary"] as const)
          paintWindow(wins[k], c[k], now, stale, c[k] ? "veraltet" : "Codex hat für dieses Fenster nichts mitgeschickt.");
      } else {
        // nothing measured in this answer: the last windows this page saw, dated and stale — or unknown
        const seen = usageSeen;
        for (const k of ["primary", "secondary"] as const)
          paintWindow(wins[k], seen?.[k] ?? null, null, !!seen,
            seen ? `Stand von ${usageClock(seen.measuredAt)}, veraltet` : usageReason(s.reason) || "Beim letzten Lesen wurde kein Stand gefunden.");
      }
      const sel = s.selection;
      source.v.textContent = "Codex-Sitzungsdateien dieser Maschine";
      source.more.textContent = `Nicht direkt vom Konto: die ${sel.maxFiles} neuesten Dateien, jeweils die letzten ${Math.round(sel.maxBytesPerFile / 1024)} KiB`
        + `${sel.historyComplete ? "." : ". Ältere Einträge bleiben ungelesen."}`;
      measured.v.textContent = s.measuredAt !== null ? usageClock(s.measuredAt) : "unbekannt";
      measured.more.textContent = s.measuredAt !== null ? "Wann Codex diesen Stand gemeldet hat." : "Beim letzten Lesen wurde kein Stand gefunden.";
      age.v.textContent = s.ageMs !== null ? usageSpan(s.ageMs) : "unbekannt";
      age.more.textContent = s.ageMs !== null ? `Gilt nach ${usageSpan(s.staleAfterMs)} als veraltet.` : "Ohne gefundenen Stand gibt es kein Alter.";
      fetched.v.textContent = s.fetchedAt !== null ? usageClock(s.fetchedAt) : "noch nicht gelesen";
      fetched.more.textContent = s.fetchedAt !== null ? "Wann die Fleet die Dateien gelesen hat." : "Die Fleet hat die Dateien noch nicht gelesen.";
      const o = usage!.otherSubscriptions;
      others.v.textContent = USAGE_STATUS[o.status] ?? o.status;
      others.more.textContent = usageProse(o.reason);
      const m = usage!.model;
      pref.v.textContent = USAGE_STATUS[m.ownerPreference.status] ?? m.ownerPreference.status;
      pref.more.textContent = usageProse(m.ownerPreference.reason);
      const d = m.registerDefaults;
      defaults.v.textContent = `Worker ${modelLabel(d.worker.id)} · MAIN ${modelLabel(d.main.id)}`;
      defaults.more.replaceChildren();
      const dDet = el("details", "setwhy");
      dDet.appendChild(el("summary", "", `alle ${Object.keys(d).length} Rollen`));
      for (const [role, x] of Object.entries(d)) {
        const line = el("div", "setwait");
        line.append(el("span", "setids", role), ` ${x.harness} · ${modelLabel(x.id)}${x.effort ? ` · ${x.effort}` : ""}`);
        line.title = x.id;
        dDet.appendChild(line);
      }
      defaults.more.appendChild(dDet);
      selected.v.textContent = `${m.selected.length} ${m.selected.length === 1 ? "Session" : "Sessions"}`;
      selected.more.replaceChildren();
      if (m.selected.length) {
        const sDet = el("details", "setwhy");
        sDet.appendChild(el("summary", "", "je Session"));
        for (const row of m.selected) {
          const slot = fleet.find((x) => x.id === row.slot && x.cwd);
          const line = el("div", "setwait");
          line.append(slot ? laneLabel(slot) : `Slot ${row.slot}`,
            ` — ${row.harness ?? "Programm unbekannt"} · ${row.model ? modelLabel(row.model) : "Modell unbekannt"}`);
          line.title = row.model ?? "";
          sDet.appendChild(line);
        }
        selected.more.appendChild(sDet);
      }
      const why = [...new Set(m.selected.map((r) => r.decisionSource))];
      selected.more.append(why.length === 1 && why[0] === "unknown" ? "Ob du diese Modelle bewusst gewählt hast, ist nicht erfasst." : `Gewählt von: ${why.join(" · ") || "—"}`);
      const used = m.selected.filter((r) => r.usedTurnModel !== null).length;
      turn.v.textContent = used ? `bei ${used} ${used === 1 ? "Session" : "Sessions"} erfasst` : "unbekannt";
      turn.more.textContent = used ? "Die Wahl an einer Session sagt nicht, welches Modell wirklich geantwortet hat."
        : "Welches Modell wirklich geantwortet hat, ist nicht erfasst.";
      const r = c.refresh;
      server.textContent = r.status === "not-requested" ? "Noch nicht neu gelesen."
        : `Zuletzt neu gelesen: ${r.target === "provider" ? "Konto beim Anbieter" : r.target === "local" ? "gespeicherter Stand" : "—"} · ${USAGE_REFRESH[r.status] ?? r.status}`
          + `${r.finishedAt !== null ? ` · ${usageClock(r.finishedAt)}` : r.startedAt !== null ? ` · seit ${usageClock(r.startedAt)}` : ""}`;
    }
    // the button: reading, unsupported, retry — aria-disabled keeps the focus on it while it reads
    const unsupported = target === "provider" && (!c || c.provider.status === "unsupported");
    const busy = pending !== 0;
    btn.textContent = busy ? "Liest …" : failed && target === "local" ? "Erneut lesen" : "Neu lesen";
    btn.setAttribute("aria-disabled", busy || unsupported ? "true" : "false");
    btn.setAttribute("aria-busy", busy ? "true" : "false");
    hint.textContent = target === "local"
      ? "Liest die gespeicherten Sitzungsdateien noch einmal, ohne beim Anbieter nachzufragen. Neues gibt es nur, wenn Codex inzwischen etwas gemeldet hat."
      : c ? (c.provider.status === "unsupported" ? `Noch nicht möglich. ${usageProse(c.provider.reason)}` : "Fragt das Konto beim Anbieter ab.")
      : "Ob das Konto abgefragt werden kann, sagt erst die Antwort des Servers.";
    status.textContent = busy ? (pendingTarget === "local" ? "Liest den gespeicherten Stand …" : "Fragt den Anbieter …") : outcome;
  }
  paint();
  void read("open");
}

interface MachineSetting {
  name: string;
  value: string | number;
  default: string | number;
  how: ".env + Neustart" | "watchdog.sh + kickstart";
}

// THE "DIESE MASCHINE" SECTION (G5.3, card D-5): server-start values are observations, not form
// state. Each row therefore has only the label, effective mono value and explanatory hint — no
// input, toggle, Reset or Apply path. The route itself owns the security allowlist. A row is a
// group named by its label element, so the later rename of these labels renames it with them.
function machineSection(sec: HTMLElement): void {
  const status = el("div", "hint setnote", "Lädt die Startwerte dieser Maschine …");
  status.setAttribute("role", "status");
  status.title = "Lädt die wirksamen Startwerte dieses Servers.";
  sec.appendChild(status);
  void (async () => {
    const res = await api("/api/machine-settings").catch(() => null);
    const body = res?.ok ? await res.json().catch(() => null) as { settings?: unknown } | null : null;
    const settings = Array.isArray(body?.settings) ? body.settings.filter((raw): raw is MachineSetting => {
      if (!raw || typeof raw !== "object") return false;
      const x = raw as Partial<MachineSetting>;
      return typeof x.name === "string" && (typeof x.value === "string" || typeof x.value === "number")
        && (typeof x.default === "string" || typeof x.default === "number")
        && (x.how === ".env + Neustart" || x.how === "watchdog.sh + kickstart");
    }) : [];
    if (!res?.ok || !body || settings.length === 0) {
      status.textContent = "Startwerte nicht lesbar.";
      status.title = "Die Startwerte konnten nicht vom Server gelesen werden.";
      return;
    }
    status.remove();
    for (const setting of settings) {
      const row = el("div", "setrow machrow");
      row.title = "Zeigt den wirksamen Startwert dieses Servers und den Weg zu seiner Änderung.";
      const main = el("div", "setmain");
      const label = el("div", "setlabel", setting.name);
      label.id = setId(`m-${setting.name}`);
      const hint = el("div", "hint setnote", `ändern: ${setting.how}; Standard: ${setting.default}`);
      hint.id = setId(`m-${setting.name}-h`);
      row.setAttribute("role", "group");
      row.setAttribute("aria-labelledby", label.id);
      row.setAttribute("aria-describedby", hint.id);
      main.append(label, hint);
      row.append(main, el("span", "setval", String(setting.value)));
      sec.appendChild(row);
    }
  })();
}

// THE "FLEET" SECTION (G5.2 + G4.4, cards D-3 + 3e6342e2): five server switches over routes that
// already exist — nothing here is a value of this browser, every row changes the fleet for all
// devices and sessions. A changed control is only STAGED (ink edge on the row); the one primary
// "Übernehmen" writes each staged row through its route, and the row then shows the value the
// SERVER answers with — the poll for dispatcher/autos/quiet, GET /api/repo-lane-caps for the cap and
// the stored bases, the route's own answer for the branch — never the typed one. A refusal (4xx)
// stays at its row as a hint and the staged value stays. The dispatcher row reads the same
// `dispatch` the queue foot reads: no second state lives in this window. Not here, on purpose:
// repoWorkers (a stored command), .env/watchdog.sh values, and slot/program switches (they live
// at their thing). e2e/tasks.ts pins the route set of this block — a sixth route is a new card.
//
// PARALLELISM IN ONE BLOCK (owner 30.09.): the master, the chosen repo's EFFECTIVE cap with its
// source (machine default vs repo override, both numbers apart), the lanes busy there, the rows the
// start plan would start now and why the others wait. Occupancy, startable rows and wait reasons
// come from GET /api/start-plan — the same read the queue's Waves view makes on open — read ONCE
// when the window opens and again after Übernehmen; no timer, no repaint reads it. A plan that
// cannot be read says "unbekannt", never zero. "Startbar" is the PLAN's verdict: the master, the
// kill switch and the quiet window still hold at the tick, and the row says which of them holds.
interface FleetSetRow {
  row: HTMLElement; val: HTMLElement; err: HTMLElement;
  // the control a staged value lives in — where "Weiter bearbeiten" and a refusal send the focus
  focus: HTMLElement;
  staged(): boolean; write(): Promise<Response>; paint(): void; done(answer: unknown): void;
}
interface FleetSection { staged(): number; firstStaged(): HTMLElement | null }
type SetPlan = StartPlan & { waits?: WaitRow[] };
type SetPlanWait = Exclude<StartPlanNext, "now">;
// the wait kinds in the owner's words, one per step of start-plan.ts#projectStartPlan
function setWaitKind(n: SetPlanWait): string {
  if ("cap" in n) return /\bin program\b/.test(n.cap) ? "Program-Deckel voll" : "Repo-Deckel voll";
  if ("after" in n) return n.missing ? "Reihenfolge, Ziel fehlt" : "Reihenfolge";
  if ("unreleased" in n) return "nicht freigegeben";
  if ("collides" in n) return "Überschneidung mit laufender Arbeit";
  return "ungeprüft";
}
function fleetSection(sec: HTMLElement): FleetSection {
  let caps: Record<string, number> = {};
  let capDefault: number | null = null;
  let capMax = 99;
  let capsRead: "unread" | "ok" | "fail" = "unread";
  // a repo's stored branch: filled from GET /api/repo-lane-caps (`bases`) and from each write's answer
  const bases = new Map<string, string | null>();
  let plan: SetPlan | null = null;
  let planRead: "unread" | "ok" | "fail" = "unread";
  let planAt = 0;
  const repos = [...new Set([dispatch.repo, ...fleet.map((s) => s.cwd ? s.repo ?? s.worktree?.repo ?? "" : "")]
    .filter((r): r is string => !!r))].sort();
  const onOff = (v: boolean | null) => v === null ? "unbekannt" : setOnOff(v);
  const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
  const rows: FleetSetRow[] = [];
  let seq = 0;

  function sub(word: string): void { sec.appendChild(el("h4", "setsub", word)); }
  function shell(label: string, hint: string, tip: string, par?: string) {
    const row = el("div", "setrow fleetrow");
    row.title = tip;
    if (par) row.dataset.par = par;
    const main = el("div", "setmain");
    const lab = el("div", "setlabel", label);
    lab.id = setId(`f-${++seq}`);
    const note = el("div", "hint setnote", hint);
    note.id = setId(`f-${seq}-h`);
    const err = el("div", "hint setnote seterr");
    err.setAttribute("role", "status");
    err.hidden = true;
    main.append(lab, note, err);
    const val = el("span", "setval");
    val.title = "Wert, wie ihn der Server zuletzt gemeldet hat";
    const ctl = el("div", "setctl");
    row.append(main, val, ctl);
    sec.appendChild(row);
    const name = (c: HTMLElement, ...extra: string[]) => {
      c.setAttribute("aria-labelledby", [...extra, lab.id].join(" "));
      c.setAttribute("aria-describedby", note.id);
    };
    return { row, val, err, ctl, lab, note, name };
  }
  function toggle(): HTMLButtonElement {
    const b = el("button", "settoggle") as HTMLButtonElement;
    b.type = "button";
    return b;
  }
  // ONE VALUE PER ROW: the control shows the value; the mono value beside it speaks only when it
  // says something the control cannot — the server's word while a wish is staged ("Server: an"),
  // or a state no control shows (unbekannt, nicht verfügbar, nicht gesetzt)
  // a toggle that shows the staged wish, or the server's word — and "unbekannt" without a pressed
  // state when the server never said, so an unknown can never read as a chosen "an"
  function paintToggle(b: HTMLButtonElement, on: boolean | null, staged: boolean) {
    b.textContent = onOff(on);
    if (on === null) b.removeAttribute("aria-pressed"); else b.setAttribute("aria-pressed", on ? "true" : "false");
    b.classList.toggle("staged", staged);
  }
  // a small visible word in front of a control — what names it beside the row's label
  function caption(word: string): HTMLElement {
    const c = el("span", "setdash", word);
    c.id = setId(`f-${++seq}-c`);
    return c;
  }

  sub("Parallelität");
  // 1 · dispatcher — the master
  {
    const s = shell("Master",
      "An: freigegebene Zeilen dürfen ohne dich als Lane starten — für alle Repos und Sessions dieser Fleet. Startet nichts sofort: Reihenfolge, Freigabe, Karte, Deckel, Ruhezeit und Gate gelten weiter; Programs mit „darf starten: an“ starten auch bei aus.",
      "Schaltet den Dispatcher der ganzen Fleet — derselbe Schalter wie am Fuß der Queue. intern: tickDispatch", "master");
    let want: boolean | null = null;
    const b = toggle();
    s.name(b);
    b.disabled = !dispatch.available;
    b.onclick = () => { const cur = want ?? dispatch.on; want = !cur === dispatch.on ? null : !cur; sync(); };
    s.ctl.appendChild(b);
    const r: FleetSetRow = { ...s, focus: b,
      staged: () => want !== null,
      write: () => post("/api/dispatch", { on: want }),
      paint: () => {},
      done: () => { want = null; },
    };
    function sync() {
      const on = want ?? dispatch.on;
      paintToggle(b, on, want !== null);
      s.val.textContent = !dispatch.available ? "nicht verfügbar" : want !== null ? `Server: ${onOff(dispatch.on)}` : "";
      syncStaged();
    }
    rows.push({ ...r, paint: () => { r.paint(); sync(); } });
  }
  // the repo every row below the picker speaks about — one picker for cap, occupancy, waits, branch
  const repoRow = shell("Repo", "Deckel, Belegung, Wartegründe und Branch darunter gelten für dieses Repo.",
    "Wählt das Repo, über das die Zeilen darunter sprechen; schreibt nichts.", "repo");
  const pick = el("select", "setin") as HTMLSelectElement;
  repoRow.name(pick);
  for (const r of repos) {
    const o = el("option", "", baseName(r)) as HTMLOptionElement;
    o.value = r; o.title = r;
    pick.appendChild(o);
  }
  pick.value = dispatch.repo && repos.includes(dispatch.repo) ? dispatch.repo : repos[0] ?? "";
  repoRow.ctl.appendChild(pick);
  repoRow.val.title = "Pfad des gewählten Repos";
  // two lists on purpose: a REPAINT keeps what the reader staged, a CHANGE of repo drops the staged
  // cap and branch typed for the old repo (they would be written to the wrong one)
  const repoPaints: (() => void)[] = [];
  const repoChanged: (() => void)[] = [];
  pick.onchange = () => { for (const f of repoChanged) f(); for (const f of repoPaints) f(); };
  repoPaints.push(() => { repoRow.val.textContent = pick.value || "kein Repo"; });

  // 2 · lane cap of the chosen repo: effective value, its source, the staged wish — three facts apart
  const effectiveCap = (): { n: number; src: "repo" | "default" } | null => {
    if (capsRead !== "ok" || !pick.value) return null;
    const stored = caps[pick.value];
    if (typeof stored === "number") return { n: stored, src: "repo" };
    return capDefault !== null ? { n: capDefault, src: "default" } : null;
  };
  {
    const s = shell("Lane-Deckel",
      "Höchstens so viele Lanes startet die Fleet in diesem Repo ohne dich. Ein Deckel ist eine Obergrenze, keine Zusage; leer oder „Standard“ heißt Maschinen-Standard.",
      "Setzt den Deckel für unbeaufsichtigte Lanes in einem Repo, für alle Sessions.", "cap");
    const facts = el("div", "hint setnote setfacts");
    facts.id = setId(`f-${++seq}-facts`);
    s.note.after(facts);
    const n = el("input", "setin setnum") as HTMLInputElement;
    n.type = "number"; n.min = "0"; n.step = "1"; n.inputMode = "numeric";
    s.name(n);
    n.setAttribute("aria-describedby", `${facts.id} ${s.note.id}`);
    let typed: string | null = null;
    n.oninput = () => { typed = n.value.trim(); sync(); };
    const std = el("button", "setreset", "Standard") as HTMLButtonElement;
    std.type = "button";
    std.id = setId(`f-${++seq}-std`);
    std.setAttribute("aria-labelledby", `${std.id} ${s.lab.id}`);
    std.title = "Repo-Override löschen (vormerken) — danach gilt der Maschinen-Standard";
    std.onclick = () => { typed = ""; n.value = ""; sync(); n.focus(); };
    s.ctl.append(n, std);
    const stored = () => caps[pick.value] ?? null;
    const staged = () => typed !== null && typed !== String(stored() ?? "");
    function sync() {
      n.classList.toggle("staged", staged());
      const eff = effectiveCap();
      const machineWord = capDefault !== null ? `Maschinen-Standard ${capDefault}` : "Maschinen-Standard unbekannt";
      const parts = eff?.src === "repo" ? [`wirksam ${eff.n} — Repo-Override`, machineWord]
        : eff ? [`wirksam ${eff.n} — Maschinen-Standard, kein Repo-Override`]
        : [capsRead === "fail" ? "wirksam unbekannt — Deckel nicht lesbar" : !pick.value ? "kein Repo" : "wirksam unbekannt", machineWord];
      if (staged()) parts.push(`vorgemerkt ${typed === "" ? "Maschinen-Standard" : typed}, gilt erst nach Übernehmen`);
      facts.textContent = parts.join(" · ");
      std.hidden = stored() === null || typed === "";
      syncStaged();
    }
    function paintRow() {
      n.max = String(capMax);
      n.placeholder = capDefault !== null ? String(capDefault) : "";
      if (!staged()) { typed = null; n.value = stored() !== null ? String(stored()) : ""; }
      n.disabled = !pick.value;
      sync();
    }
    repoChanged.push(() => { typed = null; paintRow(); });
    rows.push({ ...s, focus: n, staged,
      // empty → null (clear to the machine default); anything else goes as typed and the server judges it
      write: () => post("/api/repo-lane-cap", { repo: pick.value, maxLanes: typed === "" ? null : Number(typed) }),
      paint: paintRow,
      done: () => { typed = null; },
    });
  }
  // 3 · what the plan says about the chosen repo: occupancy, startable rows, wait reasons
  const stat = (par: string, word: string) => {
    const row = el("div", "setstat");
    row.dataset.par = par;
    const k = el("span", "setstatk", word);
    const v = el("span", "setstatv");
    const more = el("div", "setstatl");
    row.append(k, v, more);
    sec.appendChild(row);
    return { v, more };
  };
  const load = stat("load", "Belegung");
  const start = stat("start", "Startbar jetzt");
  const waits = stat("wait", "Wartet");
  // A ROW BY ITS KURZTITEL (owner 02.10.: „[Zitat entfernt]“ named row ids): the derivation the lane names
  // use — src/suitemeter.ts#laneTitleOf over the row's card goal or its own [TITEL], cut by
  // shortTitle — read on every paint, never stored; the id rides in the tooltip. A row nothing can
  // be derived from (or whose text this window has not read) keeps its id.
  const rowName = (id: string): HTMLElement => {
    const title = laneTitleOf(taskCardFull.get(id)?.ziel, taskText.get(id));
    const e = el("span", title ? "setname" : "setids", title ? shortTitle(title) : id);
    e.title = title ? `${id} — ${title}` : id;
    return e;
  };
  const ids = (list: string[]): HTMLElement => {
    const box = el("span", "setnames");
    list.forEach((id, i) => box.append(...(i ? [" · "] : []), rowName(id)));
    return box;
  };
  function paintPlan() {
    for (const x of [load, start, waits]) { x.v.textContent = ""; x.more.replaceChildren(); }
    if (!pick.value) { for (const x of [load, start, waits]) x.v.textContent = "kein Repo"; return; }
    if (planRead !== "ok" || !plan) {
      const why = planRead === "fail" ? "unbekannt — Startplan nicht lesbar" : "wird gelesen …";
      for (const x of [load, start, waits]) x.v.textContent = why;
      return;
    }
    const at = `Startplan gelesen ${new Date(planAt).toLocaleTimeString("de-DE")}`;
    // the plan keys a repo by the rows' own repo string; a picker path with another spelling of the
    // same repo is matched by its unique base name, never guessed beyond that
    const exact = plan.repos.find((r) => r.repo === pick.value);
    const byName = plan.repos.filter((r) => baseName(r.repo) === baseName(pick.value));
    const pr = exact ?? (byName.length === 1 ? byName[0] : null);
    const eff = effectiveCap();
    if (!pr) {
      load.v.textContent = "unbekannt — der Startplan führt dieses Repo nicht (keine offene Zeile)";
      start.v.textContent = "0";
      start.more.textContent = "keine offene Zeile in diesem Repo";
      waits.v.textContent = "0";
      return;
    }
    load.v.textContent = `${pr.lanes} von ${eff?.n ?? pr.cap?.max ?? "?"} Lanes belegt`;
    load.more.textContent = at;
    const now = pr.waves.filter((w) => w.next === "now").flatMap((w) => w.ids);
    start.v.textContent = String(now.length);
    const holds = [!dispatch.on ? "Master aus" : "", autosOnSrv === false ? "Not-Aus" : "", dispatch.quiet ? "Ruhezeit" : ""].filter(Boolean);
    if (now.length) start.more.append(ids(now), holds.length ? ` — hält gerade: ${holds.join(" · ")}` : " — der nächste Takt darf sie starten");
    const waiting = pr.waves.filter((w): w is typeof w & { next: SetPlanWait } => w.next !== "now");
    waits.v.textContent = String(waiting.reduce((n, w) => n + w.ids.length, 0));
    // one line per wait kind, one name per row; the order target is named the same way
    const groups = new Map<string, (string | HTMLElement)[]>();
    for (const w of waiting) {
      const kind = setWaitKind(w.next);
      const tail = (): (string | HTMLElement)[] => "after" in w.next ? [" nach ", rowName(w.next.after)]
        : "collides" in w.next ? [` · ${w.next.collides.file}`] : [];
      const list = groups.get(kind) ?? [];
      for (const id of w.ids) list.push(...(list.length ? [" · "] : []), rowName(id), ...tail());
      groups.set(kind, list);
    }
    for (const [kind, list] of groups) {
      const line = el("div", "setwait");
      line.append(`${kind}: `, ...list);
      waits.more.appendChild(line);
    }
    const why = (plan.waits ?? []).filter((w) => w.repo === pr.repo);
    if (why.length) {
      const det = el("details", "setwhy");
      det.appendChild(el("summary", "", "Gründe je Zeile"));
      for (const w of why) {
        const line = el("div", "setwait");
        line.append(rowName(w.id), ` ${w.grund} — wartet auf ${w.adressat}`);
        det.appendChild(line);
      }
      waits.more.appendChild(det);
    }
    waits.more.appendChild(el("div", "hint setnote",
      "Ein Program kann eine eigene, kleinere Grenze haben; sie steht am Program und erscheint hier als „Program-Deckel voll“."));
  }
  repoPaints.push(paintPlan);

  sub("Automatik");
  // 4 · automatic prompts (the kill-switch)
  {
    const s = shell("Automatik",
      "Aus ist der Not-Aus: hält jeden geplanten Prompt in jeder Session an und startet keine Lane mehr, bis du sie wieder einschaltest; einmalige Handlungen von dir bleiben möglich.",
      "Not-Aus für alle geplanten Prompts und Lane-Starts der Fleet — auch Programs mit „darf starten: an“ halten.");
    let want: boolean | null = null;
    const b = toggle();
    s.name(b);
    b.onclick = () => { const cur = want ?? autosOnSrv ?? true; want = !cur === autosOnSrv ? null : !cur; sync(); };
    s.ctl.appendChild(b);
    const r: FleetSetRow = { ...s, focus: b,
      staged: () => want !== null,
      write: () => post("/api/autos/switch", { on: want }),
      paint: () => {},
      done: () => { want = null; },
    };
    function sync() {
      paintToggle(b, want ?? autosOnSrv, want !== null);
      s.val.textContent = want !== null ? `Server: ${onOff(autosOnSrv)}` : "";
      syncStaged();
    }
    rows.push({ ...r, paint: () => { r.paint(); sync(); } });
  }
  // 5 · quiet hours
  {
    const s = shell("Ruhezeit",
      "In diesem Fenster (Uhrzeit dieses Rechners) schickt die Fleet keiner Session wiederkehrende Prompts und startet keine Lane; einmalige Prompts bleiben.",
      "Setzt das Ruhefenster für wiederkehrende Prompts und Lane-Starts aller Sessions; ein Program mit „darf starten: an“ startet darin nur, was die Fleet selbst freigegeben hat.");
    const from = el("select", "setin") as HTMLSelectElement;
    const to = el("select", "setin") as HTMLSelectElement;
    const fromWord = caption("von");
    const dash = caption("bis");
    s.name(from, fromWord.id);
    s.name(to, dash.id);
    const off = el("option", "", "aus") as HTMLOptionElement;
    off.value = "";
    from.appendChild(off);
    for (let h = 0; h < 24; h++) {
      const a = el("option", "", hh(h)) as HTMLOptionElement; a.value = String(h); from.appendChild(a);
      const z = el("option", "", hh(h)) as HTMLOptionElement; z.value = String(h); to.appendChild(z);
    }
    s.ctl.append(fromWord, from, dash, to);
    const cur = () => from.value === "" ? null : { start: Number(from.value), end: Number(to.value) };
    const same = (a: { start: number; end: number } | null, b: { start: number; end: number } | null) =>
      a === b || (!!a && !!b && a.start === b.start && a.end === b.end);
    let touched = false;
    from.onchange = to.onchange = () => { touched = true; sync(); };
    const staged = () => touched && !same(cur(), quietHoursSrv);
    function sync() {
      to.disabled = from.value === "";
      dash.hidden = to.hidden = from.value === "";
      from.classList.toggle("staged", staged());
      to.classList.toggle("staged", staged());
      s.val.textContent = staged() ? `Server: ${quietHoursSrv ? `${hh(quietHoursSrv.start)}–${hh(quietHoursSrv.end)}` : "aus"}` : "";
      syncStaged();
    }
    rows.push({ ...s, focus: from, staged,
      write: () => post("/api/autos/quiet", cur() ?? { start: null }),
      paint: () => {
        if (!staged()) {
          touched = false;
          from.value = quietHoursSrv ? String(quietHoursSrv.start) : "";
          to.value = String(quietHoursSrv?.end ?? 7);
        }
        sync();
      },
      done: () => { touched = false; },
    });
  }
  // 6 · integration branch of the chosen repo
  sub("Integration");
  {
    const s = shell("Integrations-Branch",
      "In diesen Branch landen alle Lanes des oben gewählten Repos; leer heißt: der Branch, auf dem der Haupt-Checkout steht.",
      "Setzt den Integrations-Branch eines Repos, für alle Sessions.", "branch");
    const t = el("input", "setin setbranch") as HTMLInputElement;
    t.type = "text"; t.spellcheck = false; t.autocapitalize = "off"; t.placeholder = "Branch";
    s.name(t);
    let typed: string | null = null;
    t.oninput = () => { typed = t.value.trim(); sync(); };
    s.ctl.append(t);
    const staged = () => typed !== null && (!bases.has(pick.value) || typed !== (bases.get(pick.value) ?? ""));
    function sync() {
      t.classList.toggle("staged", staged());
      const known = bases.has(pick.value);
      const v = bases.get(pick.value) ?? null;
      s.val.textContent = !pick.value ? "kein Repo" : !known ? "unbekannt"
        : staged() ? `Server: ${v ?? "nicht gesetzt"}` : v === null ? "nicht gesetzt" : "";
      syncStaged();
    }
    function paintRow() {
      const v = bases.get(pick.value) ?? null;
      if (!staged()) { typed = null; t.value = v ?? ""; }
      t.disabled = !pick.value;
      sync();
    }
    repoChanged.push(() => { typed = null; paintRow(); });
    rows.push({ ...s, focus: t, staged,
      write: () => post("/api/repo-base", { repo: pick.value, branch: typed ?? "" }),
      paint: paintRow,
      done: (answer) => {
        const a = answer as { base?: string | null } | null;
        bases.set(pick.value, typeof a?.base === "string" ? a.base : null);
        typed = null;
      },
    });
  }

  const foot = el("div", "setfoot");
  const note = el("span", "hint setnote", "");
  note.setAttribute("role", "status");
  const apply = el("button", "cmdapply", "Übernehmen") as HTMLButtonElement;
  apply.type = "button";
  apply.title = "Schreibt alle vorgemerkten Werte an den Server und zeigt danach, was er gespeichert hat.";
  foot.append(note, apply);
  sec.appendChild(foot);
  function syncStaged() {
    const n = rows.filter((r) => r.staged()).length;
    for (const r of rows) r.row.classList.toggle("staged", r.staged());
    apply.disabled = n === 0;
    note.textContent = n ? `${n} vorgemerkt — gilt erst nach Übernehmen` : "";
  }
  async function readCaps() {
    const r = await api("/api/repo-lane-caps").catch(() => null);
    const j = r?.ok ? (await r.json().catch(() => null)) as { default?: number; max?: number; caps?: Record<string, number>; bases?: Record<string, string> } | null : null;
    if (!j) { capsRead = "fail"; return; }
    capsRead = "ok";
    caps = j.caps ?? {};
    // only a server that answers WITH the map may speak about branches: absence of the FIELD is an
    // old server (live is codeBehind), and an old answer must read as "?" — never as "not set" for
    // every repo — so bases stays unchanged and no repo is marked known here
    if (j.bases && typeof j.bases === "object") {
      bases.clear();
      for (const [repo, branch] of Object.entries(j.bases)) if (branch) bases.set(repo, branch);
      // absence IN the answer is an answer too: after one successful read every picker repo is
      // known, so the branch row shows the stored value or "not set" — "?" stays reserved for a
      // server that cannot be reached, or one that predates the field
      for (const repo of repos) if (!bases.has(repo)) bases.set(repo, null);
    }
    capDefault = typeof j.default === "number" ? j.default : null;
    if (typeof j.max === "number") capMax = j.max;
  }
  async function readPlan() {
    const r = await api("/api/start-plan").catch(() => null);
    const j = r?.ok ? (await r.json().catch(() => null)) as SetPlan | null : null;
    if (j && Array.isArray(j.repos)) { plan = j; planRead = "ok"; planAt = Date.now(); } else planRead = "fail";
  }
  // the rows' texts and cards the names derive from: the queue's own cache (GET /api/tasks), read
  // when it is stale and waited for when a read is already under way
  async function readTexts() {
    await loadTaskTexts();
    if (taskTextBusy) await new Promise<void>((resolve) => taskTextWaiters.push(resolve));
  }
  const paintAll = () => { for (const r of rows) r.paint(); for (const f of repoPaints) f(); };
  apply.onclick = async () => {
    const written = rows.filter((x) => x.staged());
    apply.disabled = true;
    let refused: FleetSetRow | null = null;
    for (const r of written) {
      const res = await r.write().catch(() => null);
      const j = res ? await res.json().catch(() => null) as { error?: string } | null : null;
      if (res?.ok) {
        r.err.hidden = true;
        r.done(j);
      } else {
        r.err.hidden = false;
        r.err.textContent = `Server lehnt ab: ${j?.error ?? (res ? `HTTP ${res.status}` : "keine Verbindung")}`;
        refused ??= r;
      }
    }
    await refresh();
    await readCaps();
    await Promise.all([readPlan(), readTexts()]);
    paintAll();
    // the button the reader pressed is disabled now: the focus goes to the first refused control,
    // else to the first control that was written — never to the page behind the window
    (refused ?? written[0])?.focus.focus();
  };
  paintAll();
  void Promise.all([readCaps(), readPlan(), readTexts()]).then(paintAll);
  return { staged: () => rows.filter((r) => r.staged()).length, firstStaged: () => rows.find((r) => r.staged())?.focus ?? null };
}

// --- the file explorer (§F5) --------------------------------------------------------------
//
// The tree is `git ls-files` — see the /api/tree comment in server.ts for why, and for the one
// thing that route therefore cannot list: untracked files. Those come from the OTHER read the board
// already makes, the brief's `git status --porcelain` (fxGit below), and join the tree while the
// Untracked switch is on. `-z` means the tree's list is the ONE git path shape that is never
// quoted; the status lines are porcelain and go through GITPATH's decoder (fxStatusOf).
//
// Two rules this cache exists to keep, both of them about the 3s board repaint:
//   · it is fetched ONCE per working directory, never from the repaint loop. /api/sessions at 2s
//     is what data-saver.md had to shrink; a subprocess per board render would put it back.
//   · what the reader has OPENED is module state, not DOM state, so a repaint cannot fold the
//     tree shut under their hands. Same reason the board's folds are.
//
// Everything the reader has DONE to this card is keyed BY CWD, and that is the third rule. The
// open-folder set used to be one global Set of `"a/b"` prefixes: two repos that both have a `src/`
// shared its state, so opening `src` in one pane silently opened it in the other — a repaint then
// presented one repo's shape as the other's. Search text, scroll offset and the picked file are
// per-cwd for the same reason.
interface TreeInfo { root: string; files: string[]; total: number; capped: boolean }
export const fxTree = new Map<string, TreeInfo | { error: string }>(); // keyed by the slot's cwd
export const fxAsked = new Set<string>();  // the latch: one fetch per cwd, retried only by ⟳
const fxOpen = new Map<string, Set<string>>();   // cwd → directories expanded, as "a/b" prefixes
export const fxQuery = new Map<string, string>();       // cwd → the card's search text
export const fxScroll = new Map<string, number>();      // cwd → the card tree's scroll offset
const fxTreeAt = new Map<string, number>();      // cwd → when the tree was read (the window's footer)
// The git state both homes paint: the brief's porcelain lines, written by the board on every render
// of that slot and by the window on open and ↻ — never a request of its own (X1: no new route).
type FxGit = { lines: string[]; total: number; branch: string | null } | { error: string };
export const fxGit = new Map<string, FxGit>();
const fxUntracked = new Map<string, boolean>();  // cwd → the Untracked switch; absent = ON (owner 2026-09-24)
const fxChanged = new Map<string, boolean>();    // cwd → the window's Changed filter
const fxContents = new Map<string, boolean>();   // cwd → Paths false, Contents true
const fxContentQuery = new Map<string, string>();
let fxShell: Shell | null = null;
export let fxMenu: { panel: HTMLElement; trigger: HTMLButtonElement } | null = null;
export function closeFxMenu(refocus: boolean): void {
  const open = fxMenu;
  fxMenu = null;
  open?.panel.remove();
  open?.trigger.classList.remove("on");
  if (refocus) open?.trigger.focus();
}
function fxActions(slot: number, rel: string, writes?: (menu: HTMLElement) => void): HTMLElement {
  const actions = el("div", "fxacts");
  const more = el("button", "fxmore") as HTMLButtonElement;
  more.appendChild(icon("dots"));
  more.title = `Handlungen für ${rel}`;
  more.setAttribute("aria-label", more.title);
  more.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (fxMenu?.trigger === more) { closeFxMenu(true); return; }
    closeFxMenu(false);
    const menu = el("div", "fxmenu");
    menu.setAttribute("role", "menu");
    const item = (label: string, title: string, run: (b: HTMLButtonElement) => void) => {
      const b = el("button", "fxmenuitem", label) as HTMLButtonElement;
      b.title = title;
      b.setAttribute("role", "menuitem");
      b.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); run(b); };
      menu.appendChild(b);
    };
    item("Mention", `Fügt ${rel} in den Entwurf von Slot ${slot} ein — schreibt keine Datei`, () => {
      mentionExplorerPath(slot, rel);
      closeFxMenu(false);
    });
    item("Copy path", `Kopiert den relativen Pfad ${rel}`, (b) => { copyText(rel); b.textContent = "Copied"; });
    writes?.(menu);
    actions.appendChild(menu);
    more.classList.add("on");
    fxMenu = { panel: menu, trigger: more };
    requestAnimationFrame(() => menu.querySelector<HTMLButtonElement>(".fxmenuitem")?.focus());
  };
  actions.appendChild(more);
  return actions;
}
// The card's search box is REBUILT by every 3s repaint (renderBoard replaceChildren's the whole
// board), so surviving the refresh cannot mean "keep the element" — the element is gone. It means
// restoring what the reader could lose: the text, the caret, and the focus.
//
// Whether it WAS focused is asked of the document, at build time, against the node the previous
// pass left behind — deliberately not tracked with a focus/blur flag. Removing a focused element
// fires blur, and engines are not agreed on whether that lands before or after the restore below;
// a blur arriving late would clear a flag the restore had just re-set, and the box would then lose
// focus on the SECOND refresh rather than the first — the worst kind of intermittent.
export const fxInputEl = new Map<string, HTMLInputElement>();
// Restoring focus and scroll has to happen AFTER the board has committed its new nodes: until
// `boardBody.replaceChildren(...)` runs, the card this built is not in the document, and .focus()
// on a detached node is a silent no-op. A microtask is not good enough — renderBoard is async, so
// one can land between the build and the commit. renderBoard calls this at the commit point.
export function fxRestoreAfterPaint(): void {
  const fn = takeFxAfterPaint();
  fn?.();
}
export const fxOpenSet = (cwd: string): Set<string> => {
  let set = fxOpen.get(cwd);
  if (!set) { set = new Set(); fxOpen.set(cwd, set); }
  return set;
};

// One renderer, two homes: the board card and the explorer window's list pane. `onPick` is what a
// FILE row does — the only thing the two callers disagree about. Folding a directory repaints
// THIS container from the root and nothing else: re-rendering the board would re-run its fetches,
// and a fold is not new information.
//
// Rows are <button>s. A div with an onclick is reachable by mouse only; the tag is what makes the
// tree tabbable, Enter/Space-activatable and focus-ringed without a keydown handler that could
// drift from the click handler. `onRows` hands the flat visual order back to a caller that has a
// window shell to drive with it (↑↓ + Enter) — the card has no shell and passes none.
//
// The GIT STATE rides on the same rows (X1, owner's pick 2026-09-24): `status` is the brief's own
// `git status --porcelain` read — the lines the Info tab's "uncommitted" card already shows — keyed
// by path, so this renderer asks nothing new of the server. A file row carries its letter, a folder
// a dot when anything below it is changed or new, an untracked row is dimmed with "?".
// `changedOnly` is the Changed filter: the same flat list a search gives, of what git status names.
interface PaintOpts {
  open: Set<string>;
  onPick: (rel: string) => void;
  picked: () => string | null;
  query?: string;
  all?: string[];               // the unfiltered list, so a filtered paint can still count the whole
  onRows?: (rows: ShellRow[]) => void;
  capped?: boolean;
  shown?: number;               // how many paths the server actually delivered
  total?: number;               // how many it says exist
  status?: Map<string, string>; // path → porcelain XY, from fxStatusOf
  statusMore?: number;          // status lines the server read but did not send (its 200-line cap)
  changedOnly?: boolean;
  actions?: (rel: string) => HTMLElement;
  onDrag?: (rel: string, e: DragEvent) => void;
  onDrop?: (folder: string, e: DragEvent) => void;
}
const FX_PATH_MIME = "application/x-fleet-explorer-path";
interface FxPathDrop { slot: number; path: string }
function fxPathDrop(raw: string): FxPathDrop | null {
  try {
    const d = JSON.parse(raw) as Partial<FxPathDrop>;
    return Number.isInteger(d.slot) && (d.slot ?? 0) > 0 && typeof d.path === "string" && !!d.path
      && !/[\0\r\n]/.test(d.path) ? { slot: d.slot as number, path: d.path } : null;
  } catch { return null; }
}
function fxAppendPath(text: string, path: string): string {
  if (!text) return path;
  return `${text}${/[\s]$/.test(text) ? "" : "\n"}${path}`;
}
export function fxStartDrag(slot: number, path: string, e: DragEvent): void {
  if (!e.dataTransfer) return;
  e.dataTransfer.setData(FX_PATH_MIME, JSON.stringify({ slot, path } satisfies FxPathDrop));
  e.dataTransfer.effectAllowed = "copyMove";
  const source = e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
  const explorer = source?.closest<HTMLElement>("#shell-files");
  if (explorer && source) {
    explorer.classList.add("fxdragging");
    source.addEventListener("dragend", () => explorer.classList.remove("fxdragging"), { once: true });
  }
}
export function paintTree(into: HTMLElement, root: TreeNode, o: PaintOpts): void {
  // Folding repaints this container, which DETACHES the row that was just activated — so a reader
  // who opened a folder with Enter lost the keyboard entirely, and the next Tab started from the
  // top of the page. The row is rebuilt with the same `rel`, so focus is handed back to it.
  let wantFocus: string | null = null;
  const takeFocus = (rel: string, row: HTMLElement) => {
    if (wantFocus !== rel) return;
    wantFocus = null;
    row.focus();
  };
  const status = o.status ?? new Map<string, string>();
  // every folder that holds a change somewhere below it, as "a/b" prefixes — computed once per
  // paint, so a folder row asks a Set instead of walking the status list
  const dirty = new Set<string>();
  for (const p of status.keys()) {
    const parts = p.replace(/\/$/, "").split("/");
    for (let i = 1; i < parts.length; i++) dirty.add(parts.slice(0, i).join("/"));
  }
  const counts = new Map<TreeNode, number>();
  const countOf = (n: TreeNode): number => {
    let c = counts.get(n);
    if (c === undefined) {
      c = n.files.length;
      for (const kid of n.dirs.values()) c += countOf(kid);
      counts.set(n, c);
    }
    return c;
  };
  // the letter git itself prints, and a German sentence for it (G0.5: tooltips say what it means)
  const mark = (row: HTMLElement, rel: string) => {
    const xy = status.get(rel);
    if (!xy) return;
    const untracked = xy === "??";
    if (untracked) row.className += " fxuntr";
    const letter = untracked ? "?" : (xy[1] !== " " ? xy[1] : xy[0]) ?? "M";
    const b = el("span", `fxst ${untracked ? "fxnew" : "fxmod"}`, letter);
    const what: Record<string, string> = { M: "geändert", A: "neu hinzugefügt", D: "gelöscht",
      R: "umbenannt", C: "kopiert", T: "Typ geändert", U: "Konflikt" };
    b.title = untracked ? "ungetrackt — git kennt diese Datei noch nicht; committet ist sie erst nach git add"
      : `${what[letter] ?? "verändert"}, nicht committet (git status: ${xy.replace(/ /g, "·")})`;
    row.appendChild(b);
    row.title = `${rel} — ${b.title}`;
  };
  const redraw = () => { into.replaceChildren(); const rows: ShellRow[] = []; walk(rows); o.onRows?.(rows); };
  const appendRow = (row: HTMLButtonElement, rel: string, rows: ShellRow[], act: () => void) => {
    if (o.onDrag) {
      row.draggable = true;
      row.ondragstart = (e) => o.onDrag?.(rel, e);
    }
    if (o.actions) {
      const line = el("div", "fxline");
      line.append(row, o.actions(rel));
      into.appendChild(line);
    } else into.appendChild(row);
    rows.push({ el: row, open: act });
  };
  const fileRow = (rel: string, name: string, depth: number, rows: ShellRow[]) => {
    const row = el("button", `fxrow fxfile${o.picked() === rel ? " fxpicked" : ""}`) as HTMLButtonElement;
    row.style.paddingLeft = `${depth * 14 + 26}px`;
    row.appendChild(el("span", "fxname", name));
    row.title = rel;
    mark(row, rel);
    const act = () => { o.onPick(rel); redraw(); };
    row.onclick = act;
    appendRow(row, rel, rows, act);
  };
  // a search hit or a Changed row: a PATH, whose directory half is context, not the answer
  const flatRow = (rel: string, rows: ShellRow[]) => {
    const row = el("button", `fxrow fxfile fxhit${o.picked() === rel ? " fxpicked" : ""}`) as HTMLButtonElement;
    const bare = rel.replace(/\/$/, "");
    const cut = bare.lastIndexOf("/");
    if (cut >= 0) row.appendChild(el("span", "fxdim", `${rel.slice(0, cut)}/`));
    row.appendChild(el("span", "fxname", cut >= 0 ? rel.slice(cut + 1) : rel));
    row.title = rel;
    mark(row, rel);
    const act = () => { o.onPick(rel); redraw(); };
    row.onclick = act;
    appendRow(row, rel, rows, act);
  };
  const walkTree = (node: TreeNode, prefix: string, depth: number, rows: ShellRow[]): void => {
    for (const [name, kid] of Array.from(node.dirs.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const rel = prefix ? `${prefix}/${name}` : name;
      const open = o.open.has(rel);
      const row = el("button", `fxrow fxdir${open ? " fxopen" : ""}`) as HTMLButtonElement;
      row.style.paddingLeft = `${depth * 14 + 8}px`;
      const twist = el("span", open ? "fxtwist" : "fxtwist shut");
      twist.appendChild(icon("chevron"));
      row.appendChild(twist);
      row.appendChild(el("span", "fxname", name));
      if (dirty.has(rel)) {
        const dot = el("span", "fxdot");
        dot.title = "enthält Änderungen, die noch nicht committet sind";
        row.appendChild(dot);
      }
      row.appendChild(el("span", "fxcount", String(countOf(kid))));
      row.title = `${rel}/ — ${open ? "zuklappen" : "aufklappen"}`;
      row.setAttribute("aria-expanded", open ? "true" : "false");
      const act = () => { if (open) o.open.delete(rel); else o.open.add(rel); wantFocus = rel; redraw(); };
      row.onclick = act;
      if (o.onDrop) {
        row.ondragover = (e) => {
          e.preventDefault(); e.stopPropagation();
          if (e.dataTransfer) e.dataTransfer.dropEffect = e.dataTransfer.types.includes(FX_PATH_MIME)
            && !e.dataTransfer.types.includes("Files") ? "move" : "none";
        };
        row.ondrop = (e) => { e.preventDefault(); e.stopPropagation(); o.onDrop?.(rel, e); };
      }
      appendRow(row, `${rel}/`, rows, act);
      takeFocus(rel, row);
      if (open) walkTree(kid, rel, depth + 1, rows);
    }
    for (const name of node.files.slice().sort((a, b) => a.localeCompare(b))) {
      fileRow(prefix ? `${prefix}/${name}` : name, name, depth, rows);
    }
  };
  const walk = (rows: ShellRow[]): void => {
    const q = (o.query ?? "").trim();
    if (o.changedOnly) {
      // what git status names, in path order — a DELETED file is here too, though the tree has no
      // row for it any more: the filter answers "what changed", not "what is on disk"
      const changed = Array.from(status.keys()).sort((a, b) => a.localeCompare(b));
      const hits = q ? matchTree(changed, q) : changed;
      if (!hits.length) {
        into.appendChild(el("div", "bempty", !changed.length
          ? "nothing changed — git status is clean for what this list shows"
          : `${changed.length} changed, none of them matches “${q}”`));
      }
      for (const rel of hits) flatRow(rel, rows);
      if (o.statusMore) into.appendChild(el("div", "bempty",
        `… ${o.statusMore} more — the server reads at most 200 status lines`));
      return;
    }
    if (!q) { walkTree(root, "", 0, rows); return; }
    const hits = matchTree(o.all ?? [], q);
    if (!hits.length) {
      // The two empty answers are DIFFERENT facts and the reader has to be able to act on which
      // one this is: nothing matches, or the server never sent the part that might. TREE_CAP is
      // not a rendering detail — a capped tree makes "no match" an unfinished sentence.
      into.appendChild(el("div", "bempty", o.capped
        ? `nothing here matches “${q}” — but the server sent only the first ${o.shown ?? 0} of `
          + `${o.total ?? 0} tracked files, so a match may exist outside what was delivered`
        : `nothing matches “${q}” among the ${o.total ?? o.shown ?? 0} tracked files in this repo`));
      return;
    }
    for (const rel of hits) flatRow(rel, rows);
    if (o.capped) into.appendChild(el("div", "bempty",
      `${hits.length} match${hits.length === 1 ? "" : "es"} — searched only the first ${o.shown ?? 0}`
      + ` of ${o.total ?? 0} tracked files the server delivered`));
  };
  redraw();
}
// porcelain lines → path → XY. With `untracked` off the "??" lines are dropped here, and with them
// every trace of an untracked file: its row, its "?", and the dot it would put on its folder.
// Ignored files never arrive — `git status --porcelain` without --ignored does not list them.
function fxStatusOf(lines: string[], untracked: boolean): Map<string, string> {
  const m = new Map<string, string>();
  for (const l of lines) {
    if (l.length < 4 || (l.startsWith("??") && !untracked)) continue;
    m.set(porcelainPath(l), l.slice(0, 2));
  }
  return m;
}
// treeOf, plus the one shape git status adds: an untracked NEW folder is a single line `dir/`
// (git folds it and so does this list), which becomes one leaf row named `dir/` under its parent
// rather than an empty folder that would open onto nothing.
export function fxTreeOf(paths: string[]): TreeNode {
  const root = treeOf(paths.filter((p) => !p.endsWith("/")));
  for (const p of paths) {
    if (!p.endsWith("/")) continue;
    const parts = p.slice(0, -1).split("/");
    let node = root;
    for (const seg of parts.slice(0, -1)) {
      let next = node.dirs.get(seg);
      if (!next) { next = { dirs: new Map(), files: [] }; node.dirs.set(seg, next); }
      node = next;
    }
    node.files.push(`${parts[parts.length - 1]}/`);
  }
  return root;
}
type FxWriteKind = "New file" | "Rename" | "Move" | "Delete";
// the write DIALOG speaks German, one language per surface (card 1685d265 in 3e6342e2); the kind
// stays the internal word that picks the route
const FX_WRITE_WORD: Record<FxWriteKind, string> = { "New file": "Neue Datei", Rename: "Umbenennen", Move: "Verschieben", Delete: "Löschen" };
interface FxWriteReply { ran?: string; afterwards?: string; sessionActive?: boolean; error?: string }
function fxMoveDrop(slot: number, tracked: string[], folder: string, e: DragEvent): FxPathDrop | null {
  if (!e.dataTransfer || e.dataTransfer.types.includes("Files")) return null;
  const source = fxPathDrop(e.dataTransfer.getData(FX_PATH_MIME));
  return source?.slot === slot && tracked.includes(source.path) && !source.path.endsWith("/")
    && `${folder}/${source.path.split("/").pop()}` !== source.path ? source : null;
}
async function fxWrite(slot: number, root: string, kind: FxWriteKind, path: string, to = ""):
  Promise<FxWriteReply | null> {
  const create = kind === "New file";
  const remove = kind === "Delete";
  const rename = kind === "Rename";
  const parent = path.slice(0, path.lastIndexOf("/") + 1);
  const body = el("div", "fxwritebody");
  if (sessionActive(slot)) body.appendChild(el("div", "ocwarn",
    "Diese Session arbeitet gerade — " + (create
      ? "sie kann denselben Pfad anlegen; eine bestehende Datei wird nicht überschrieben"
      : remove ? "sie kann die Datei weiter lesen oder schreiben; Löschen hält die Session nicht an"
      : "sie kann den alten Pfad weiter lesen oder schreiben; Importe und Verweise folgen nicht")));
  let input: HTMLInputElement | null = null;
  if (!remove) {
    const label = el("label", "fxwritelabel", rename ? "Neuer Name" : "Pfad");
    input = el("input", "fxwriteinput") as HTMLInputElement;
    input.type = "text"; input.spellcheck = false; input.autocomplete = "off";
    input.dataset.ownEnter = "1";
    input.value = create ? to : rename ? path.slice(parent.length) : to || path;
    input.title = rename ? "Neuer Dateiname im selben Ordner" : "Relativer Dateipfad in dieser Session";
    label.appendChild(input); body.appendChild(label);
  }
  // a row's value is prose (Sans) unless it IS a command or a place (mono); a path or a command
  // inside prose rides as its own mono span (G0.3)
  const row = (label: string, mono = false) => {
    const r = el("div", "fxwriterow");
    const value = el("span", mono ? "fxwritevalue mono" : "fxwritevalue");
    r.append(el("span", "fxwritekey", label), value); body.appendChild(r);
    return value;
  };
  const code = (text: string) => el("span", "fxcode", text);
  const runs = row("Führt aus", true);
  row("Wo", true).textContent = `${root} · Slot ${slot}`;
  const afterwards = row("Danach");
  row("Bleibt").textContent = create ? "Bestehende Dateien bleiben unverändert; kein git add und kein Commit."
    : remove ? "Verweise bleiben unverändert; die Session läuft weiter; kein Commit."
    : "Importe und Verweise bleiben am alten Pfad; die Session läuft weiter; kein Commit.";
  const back = row("Rückweg");
  if (create) back.textContent = "Die neue Datei löschen; ungetrackte Dateien blockieren das Land.";
  else back.append(code(remove ? "git restore --staged --worktree" : "git mv"),
    remove ? " — eine vorgemerkte Löschung braucht einen Commit." : " zurück — eine vorgemerkte Umbenennung braucht einen Commit.");
  const quote = (arg: string) => "'" + arg.replaceAll("'", "'\\''") + "'";
  let target = "";
  let valid = remove;
  const update = () => {
    const value = input?.value ?? "";
    target = rename ? parent + value : value;
    valid = remove || !!target.trim() && !target.startsWith("/") && !/[\0\r\n]/.test(target)
      && target.split("/").every((p) => !!p && p !== "." && p !== "..")
      && (!rename || !value.includes("/")) && (create || target !== path);
    const args = create ? ["-C", root, "rev-parse", "--is-inside-work-tree"]
      : ["-C", root, "--literal-pathspecs", remove ? "rm" : "mv", "--", path, ...(!remove ? [target] : [])];
    runs.textContent = `git ${args.map(quote).join(" ")}`;
    afterwards.replaceChildren(...(create ? ["leere Datei unter ", code(target || "…"), "; nicht in git aufgenommen"]
      : remove ? [code(path), " aus dem Arbeitsbaum entfernt; Löschung in git vorgemerkt"]
      : [code(path), " liegt danach unter ", code(target), "; Umbenennung in git vorgemerkt"]));
    input?.setAttribute("aria-invalid", String(!valid));
    const button = body.closest(".panel")?.querySelector<HTMLButtonElement>(".riskbtn.primary, .riskbtn.danger");
    if (button) button.disabled = !valid;
  };
  update();
  if (input) input.oninput = update;
  const answer = askRisk({ title: `${FX_WRITE_WORD[kind]}${create ? "" : ` — ${path}`}`, body: [body],
    panelClass: "riskpanel fxwritepanel",
    buttons: [{ label: "Abbrechen", value: false },
      { label: FX_WRITE_WORD[kind], value: true, primary: !remove, danger: remove, disabled: !valid }] });
  const shield = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Escape") body.closest(".panel")?.querySelector<HTMLButtonElement>(".riskbtn")?.click();
  };
  window.addEventListener("keydown", shield, true);
  input?.focus();
  const accepted = await answer.finally(() => window.removeEventListener("keydown", shield, true));
  if (!accepted || !valid) return null;
  try {
    const res = await post(`/api/file/${create ? "create" : remove ? "delete" : "move"}`,
      { slot, path: create ? target : path, ...(!create && !remove ? { to: target } : {}) });
    const reply = await res.json().catch(() => null) as FxWriteReply | null;
    return res.ok && reply?.ran && reply.afterwards ? reply
      : { error: reply?.error ?? `Der Server lehnt die Änderung ab (${res.status})` };
  } catch { return { error: "Die Änderung ist nicht bestätigt — erst den Baum neu lesen, dann erneut versuchen" }; }
}
export async function loadTree(slot: number, cwd: string): Promise<void> {
  const res = await api(`/api/tree?slot=${slot}`).catch(() => null);
  if (res?.ok) {
    const d = (await res.json().catch(() => null)) as TreeInfo | null;
    fxTree.set(cwd, d ?? { error: "the server's answer was not readable JSON" });
  } else {
    const e = res ? ((await res.json().catch(() => null)) as { error?: string } | null) : null;
    fxTree.set(cwd, { error: e?.error ?? "the file tree could not be read" });
  }
  fxTreeAt.set(cwd, Date.now());
  void renderBoard();
}
// the window's read of the git state: the SAME brief route the board already polls for the focused
// slot — the window may be open on a slot the board is not showing, so it asks once itself
async function loadGit(slot: number, cwd: string): Promise<void> {
  const res = await api(`/api/slots/${slot}/brief`).catch(() => null);
  const b = res?.ok ? ((await res.json().catch(() => null)) as BriefInfo | null) : null;
  if (b) {
    fxGit.set(cwd, { lines: b.uncommittedFiles, total: b.uncommitted, branch: b.branch });
    return;
  }
  // the 400 body names WHY (server.ts#cwdGitBody): git:"none" is a plain folder — the normal
  // absence, not a failed read — drawn as calmly as the board's noGit card, in its very sentence;
  // gone/unreadable/error keep the server's named sentence, the generic only when even the body
  // never parsed.
  const e = res ? ((await res.json().catch(() => null)) as { error?: string; git?: string } | null) : null;
  fxGit.set(cwd, { error: e?.git === "none"
    ? "No git in this folder — changes, history and lanes exist only in a repository."
    : e?.error ?? "git status could not be read" });
}
// What both homes paint, derived in ONE place so the card and the window cannot disagree about
// which rows exist: the tracked list, plus — with Untracked on — the untracked lines of git status.
export function fxView(cwd: string, t: TreeInfo) {
  const g = fxGit.get(cwd);
  const lines = g && !("error" in g) ? g.lines : [];
  const untrackedOn = fxUntracked.get(cwd) ?? true;
  const status = fxStatusOf(lines, untrackedOn);
  const untracked = lines.filter((l) => l.startsWith("??")).map(porcelainPath);
  const paths = untrackedOn ? [...t.files, ...untracked] : t.files;
  return {
    g, status, paths, untrackedOn,
    untrackedN: untracked.length,
    changedN: lines.length - untracked.length,
    statusMore: g && !("error" in g) ? Math.max(0, g.total - g.lines.length) : 0,
  };
}

// The search box, built the same way for the card and for the window. It is one function because
// the two must agree about what a query IS — a filter that means different things in the two
// places would make the window's answer an unreliable check on the card's.
export function fxSearchInput(cwd: string, onInput: () => void, wide: boolean): HTMLInputElement {
  const inp = el("input", wide ? "pkfilterin" : "fxfilterin") as HTMLInputElement;
  inp.type = "text";
  inp.spellcheck = false;
  inp.autocomplete = "off";
  // the shell consumes Enter in the CAPTURE phase to open the selected row; this field wants that
  // (type, then Enter on the best match), so it does NOT opt out via data-ownEnter.
  inp.placeholder = "search paths";
  inp.value = fxQuery.get(cwd) ?? "";
  inp.oninput = () => { fxQuery.set(cwd, inp.value); onInput(); };
  return inp;
}

// The card. Compact by design — it lists the repo root and lets the reader walk down; the WINDOW
// (⤢) is where a file is actually read, because a 6-line-wide sideboard is not a place to read code.
export function openExplorer(slot: number, cwd: string, startAt?: string, line?: number) {
  const t0 = fxTree.get(cwd);
  if (!t0 || "error" in t0) return;
  fxShell?.close();
  let picked: string | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let searchSeq = 0;
  type ContentResult = { query: string; matches: { path: string; line: number; text: string }[];
    capped: boolean; timedOut: boolean; limit: number; error?: string };
  let contentResult: ContentResult | null = null;
  let contentLoading = false;
  const shell = openShell({
    id: "files",
    title: "Files",
    detailHint: "Pick a file on the left. New file and the file menu preview each change before writing.",
    listWidth: 300,
    onClose: () => { fxShell = null; closeFxMenu(false); clearInterval(timer); clearTimeout(searchTimer); searchSeq++; },
  });
  fxShell = shell;
  // a ↻ that failed leaves the error in fxTree; the window keeps painting the last tree it had
  const tree = (): TreeInfo => { const t = fxTree.get(cwd); return t && !("error" in t) ? t : t0; };
  let writeBusy = false;
  const writeState = el("div", "fxwritestate");
  writeState.setAttribute("role", "status");
  shell.tools.after(writeState);
  const write = async (kind: FxWriteKind, path = "", to = "") => {
    if (writeBusy || !shell.isOpen()) return;
    if (shell.detail.querySelector(".fvedit-ta")) {
      writeState.textContent = "Finish editing this file before changing paths.";
      return;
    }
    if (kind !== "New file" && !tree().files.includes(path)) return;
    writeBusy = true;
    closeFxMenu(false);
    shell.setCloseGuard(() => true);
    const reply = await fxWrite(slot, tree().root, kind, path, to);
    shell.setCloseGuard(null);
    if (reply) {
      writeState.classList.toggle("err", !!reply.error);
      writeState.textContent = reply.error ?? `Afterwards: ${reply.afterwards}`;
      writeState.title = reply.ran ?? "";
      if (!reply.error) {
        fxUntracked.set(cwd, true);
        if (kind === "Delete" && picked === path) {
          picked = null; head = null; facts = null;
          shell.detail.replaceChildren(el("div", "shellhint", reply.afterwards));
        } else if ((kind === "Move" || kind === "Rename") && picked === path) {
          picked = null; head = null; facts = null;
          shell.detail.replaceChildren(el("div", "shellhint", "Pick the file at its new path to read it."));
        }
        await reread();
        if (fxContents.get(cwd)) scheduleContents();
      }
    }
    writeBusy = false;
  };
  const actions = (rel: string) => fxActions(slot, rel, (menu) => {
    if (rel.endsWith("/") || !tree().files.includes(rel)) return;
    for (const [kind, title] of [
      ["Rename", "Datei im selben Ordner umbenennen — erst nach Bestätigung"],
      ["Move", "Datei an einen anderen relativen Pfad verschieben — erst nach Bestätigung"],
      ["Delete", "Getrackte Datei mit git rm löschen — erst nach Bestätigung"],
    ] as const) {
      const b = el("button", "fxmenuitem", kind) as HTMLButtonElement;
      b.title = title; b.setAttribute("role", "menuitem");
      b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); void write(kind, rel); };
      menu.appendChild(b);
    }
  });

  // ↻ in the window's own head, beside ✕ (G1.1). Before this the window showed a tree it had read
  // once, and a file the agent had just written stayed missing until the CARD's ↻.
  const again = el("button", "fxreload") as HTMLButtonElement;
  again.appendChild(icon("reload"));
  again.title = "Baum und Git-Zustand neu lesen — eine neue Datei erscheint erst danach";
  again.setAttribute("aria-label", again.title);
  shell.root.querySelector(".shellclose")?.before(again);

  // the subtitle: repo and branch are ADDRESSES (mono, G0.3), the counts are the reader's
  const sub = shell.root.querySelector<HTMLElement>(".shellsub");
  const paintHead = () => {
    const t = tree();
    const v = fxView(cwd, t);
    const parts: (string | HTMLElement)[] = [el("span", "fxmono", baseName(cwd))];
    if (v.g && !("error" in v.g) && v.g.branch) parts.push(" · ", el("span", "fxmono", v.g.branch));
    const counts = [`${t.total} tracked`];
    if (v.g && "error" in v.g) counts.push(v.g.error);
    else if (v.g) counts.push(`${v.changedN}${v.statusMore ? "+" : ""} changed`, `${v.untrackedN} untracked`);
    if (t.capped) counts.push(`only the first ${t.files.length} were sent`);
    const tr = fxTree.get(cwd);
    if (tr && "error" in tr) counts.push(`re-read failed: ${tr.error}`);
    parts.push(" · ", el("span", "fxnum", counts.join(" · ")));
    sub?.replaceChildren(...parts);
  };

  const search = el("input", "pkfilterin") as HTMLInputElement;
  search.type = "text";
  search.spellcheck = false;
  search.autocomplete = "off";
  search.oninput = () => {
    if (fxContents.get(cwd)) { fxContentQuery.set(cwd, search.value); scheduleContents(); }
    else { fxQuery.set(cwd, search.value); repaint(); }
  };
  const mode = el("div", "fxseg fxmode");
  mode.setAttribute("role", "group");
  const pathsB = el("button", "", "Paths") as HTMLButtonElement;
  pathsB.title = "Dateinamen und Ordner im geladenen Baum durchsuchen";
  const contentsB = el("button", "", "Contents") as HTMLButtonElement;
  contentsB.title = "Dateiinhalte in diesem Slot mit git grep durchsuchen — nur lesend";
  mode.append(pathsB, contentsB);
  const seg = el("div", "fxseg");
  seg.setAttribute("role", "group");
  const allB = el("button", "") as HTMLButtonElement;
  allB.title = "Den ganzen Baum zeigen";
  const chB = el("button", "") as HTMLButtonElement;
  chB.title = "Nur zeigen, was git status als geändert oder neu nennt — als flache Pfadliste";
  allB.onclick = () => { fxChanged.set(cwd, false); repaint(); };
  chB.onclick = () => { fxChanged.set(cwd, true); repaint(); };
  seg.append(allB, chB);
  const untr = el("button", "fxtog", "Untracked") as HTMLButtonElement;
  untr.title = "Ungetrackte Dateien zeigen, gedimmt mit „?“ — gitignorte nie";
  untr.onclick = () => { fxUntracked.set(cwd, !(fxUntracked.get(cwd) ?? true)); paintHead(); repaint(); };
  const setMode = (contents: boolean) => {
    fxContents.set(cwd, contents);
    search.value = contents ? fxContentQuery.get(cwd) ?? "" : fxQuery.get(cwd) ?? "";
    search.placeholder = contents ? "search contents" : "search paths";
    searchSeq++;
    clearTimeout(searchTimer);
    if (contents) scheduleContents(); else repaint();
  };
  pathsB.onclick = () => setMode(false);
  contentsB.onclick = () => setMode(true);
  const newFile = el("button", "fxtog", "New file") as HTMLButtonElement;
  newFile.title = "Eine leere Datei anlegen — Pfad und Folgen vor dem Schreiben bestätigen";
  newFile.onclick = () => void write("New file");
  shell.tools.append(search, mode, seg, untr, newFile);
  const paintTools = () => {
    const v = fxView(cwd, tree());
    const changed = fxChanged.get(cwd) ?? false;
    const contents = fxContents.get(cwd) ?? false;
    allB.replaceChildren("All", el("span", "fxn", String(v.paths.length)));
    chB.replaceChildren("Changed", el("span", "fxn", `${v.status.size}${v.statusMore ? "+" : ""}`));
    for (const [b, on] of [[allB, !changed], [chB, changed], [untr, v.untrackedOn]] as const) {
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    }
    pathsB.classList.toggle("on", !contents);
    contentsB.classList.toggle("on", contents);
    pathsB.setAttribute("aria-pressed", String(!contents));
    contentsB.setAttribute("aria-pressed", String(contents));
    seg.hidden = contents;
    untr.hidden = contents;
  };

  // the footer (G2.3): whether the session is writing in this tree right now, and how old the tree is
  const live = el("span", "fxlive");
  const age = el("span", "fxage");
  const keys = el("span", "fxkeys", "↑↓ walk · Enter open · Esc close");
  shell.foot.append(live, age, keys);
  const paintFoot = () => {
    const on = sessionActive(slot);
    live.classList.toggle("on", on);
    live.textContent = on ? `Session ${slot} is working right now` : `Session ${slot} is idle`;
    live.title = on
      ? "Die Session hat in den letzten Sekunden Ausgabe erzeugt — sie kann gerade Dateien in diesem Baum schreiben"
      : "Die Session erzeugt gerade keine Ausgabe";
    const at = fxTreeAt.get(cwd);
    age.textContent = at ? `tree read ${fmtSince(at)}` : "";
  };
  timer = setInterval(() => { if (shell.isOpen()) paintFoot(); }, 2000);

  // the file head: the path as a crumb, which version this is, and — for a file git calls changed —
  // the jump to the review window on exactly this file. A JUMP, not a second window on top: two
  // stacked shells would both close on one Escape (see openReview).
  let head: HTMLElement | null = null;
  let facts: HTMLElement | null = null;
  const fileHead = (rel: string): HTMLElement => {
    const xy = fxView(cwd, tree()).status.get(rel);
    const h = el("div", "fxfhead");
    const crumb = el("div", "fxcrumb");
    const bare = rel.replace(/\/$/, "");
    const cut = bare.lastIndexOf("/");
    if (cut >= 0) crumb.appendChild(el("span", "", rel.slice(0, cut + 1)));
    crumb.appendChild(el("b", "", rel.slice(cut + 1)));
    crumb.title = `${cwd}/${rel}`;
    const top = el("div", "fxftop");
    const mention = el("button", "fxmention", "Mention") as HTMLButtonElement;
    mention.title = `Fügt ${rel} in den Entwurf von Slot ${slot} ein — schreibt keine Datei`;
    mention.onclick = () => mentionExplorerPath(slot, rel);
    top.append(crumb, mention, actions(rel));
    h.appendChild(top);
    const meta = el("div", "fxfmeta");
    meta.appendChild(el("span", "", xy === "??"
      ? "untracked — as it is on disk; git has never seen it, so there is no diff"
      : "as it is on disk right now"));
    if (facts) meta.appendChild(facts);
    if (xy && xy !== "??") {
      const b = el("button", "fxjump", "What changed") as HTMLButtonElement;
      b.title = "Öffnet das Review-Fenster auf genau dieser Datei: was sich seit dem letzten Commit geändert hat (der Explorer schließt dabei)";
      b.onclick = () => { shell.close(); void openReview(slot, "working", { k: "file", path: rel }); };
      meta.appendChild(b);
    }
    h.appendChild(meta);
    return h;
  };
  const open = (rel: string, at?: number) => {
    closeFxMenu(false);
    picked = rel;
    facts = el("span", "fxfacts");
    head = fileHead(rel);
    if (rel.endsWith("/")) {
      shell.setCloseGuard(null);
      shell.detail.replaceChildren(head, el("div", "hint shellhint",
        "a new folder git has not seen yet — git status folds it into this one line, so its files"
        + " are not listed one by one. They appear here once they are added to git."));
      if (isMobile()) shell.showDetail(true);
    } else {
      showFileView(shell, {
        path: `${cwd}/${rel}`, label: rel.split("/").pop() ?? rel,
        source: "as it is on disk right now", edit: { slot }, line: at,
        head, facts, numbered: true,
      });
    }
    repaint();
  };

  const paintContentResults = () => {
    shell.list.replaceChildren();
    const query = (fxContentQuery.get(cwd) ?? "").trim();
    if (!query) {
      shell.list.appendChild(el("div", "bempty fxcontentempty", "type text to search tracked file contents"));
      shell.setRows([]);
      return;
    }
    if (contentLoading || contentResult?.query !== query) {
      shell.list.appendChild(el("div", "bempty fxcontentempty", `searching contents for “${query}”…`));
      shell.setRows([]);
      return;
    }
    if (contentResult.error) {
      shell.list.appendChild(el("div", "hint fxcontentempty", contentResult.error));
      shell.setRows([]);
      return;
    }
    const rows: ShellRow[] = [];
    for (const hit of contentResult.matches) {
      const row = el("button", `fxrow fxcontent${picked === hit.path ? " fxpicked" : ""}`) as HTMLButtonElement;
      const path = el("span", "fxcontentpath", hit.path.split("/").pop());
      const parent = hit.path.slice(0, hit.path.lastIndexOf("/"));
      if (hit.path.includes("/")) path.appendChild(el("span", "fxcontentdir", ` · ${parent}/`));
      row.append(path, el("span", "fxcontentline", String(hit.line)),
        el("span", "fxcontenttext", hit.text.trim()));
      row.title = `${hit.path}:${hit.line}`;
      const act = () => open(hit.path, hit.line);
      row.onclick = act;
      row.draggable = true;
      row.ondragstart = (e) => fxStartDrag(slot, hit.path, e);
      const line = el("div", "fxline");
      line.append(row, actions(hit.path));
      shell.list.appendChild(line);
      rows.push({ el: row, open: act });
    }
    if (!contentResult.matches.length)
      shell.list.appendChild(el("div", "bempty fxcontentempty", `nothing matches “${query}” in tracked file contents`));
    if (contentResult.capped) shell.list.appendChild(el("div", "bempty fxcontentempty",
      `showing the first ${contentResult.limit} matches — narrow the search to see beyond the cap`));
    if (contentResult.timedOut) shell.list.appendChild(el("div", "hint fxcontentempty",
      "the search reached its time limit — these are only the matches read before it stopped"));
    shell.setRows(rows);
    for (const [i, r] of rows.entries()) r.el.onfocus = () => shell.select(i, false, false);
  };
  const runContents = async (query: string, seq: number) => {
    const res = await api(`/api/contents?slot=${slot}&q=${encodeURIComponent(query)}`).catch(() => null);
    const body = res ? await res.json().catch(() => null) as ContentResult | { error?: string } | null : null;
    if (seq !== searchSeq || !shell.isOpen()) return;
    contentLoading = false;
    const found = res?.ok && body && "matches" in body && Array.isArray(body.matches)
      ? body as ContentResult : null;
    contentResult = found ? { ...found, query }
      : { query, matches: [], capped: false, timedOut: false, limit: 0,
        error: body?.error ?? "contents search could not be read" };
    repaint();
  };
  const scheduleContents = () => {
    const query = (fxContentQuery.get(cwd) ?? "").trim();
    const seq = ++searchSeq;
    clearTimeout(searchTimer);
    contentResult = null;
    contentLoading = !!query;
    repaint();
    if (query) searchTimer = setTimeout(() => void runContents(query, seq), 180);
  };

  let scrollToPicked = false;
  const repaint = () => {
    closeFxMenu(false);
    const t = tree();
    const v = fxView(cwd, t);
    paintTools();
    if (fxContents.get(cwd)) { paintContentResults(); return; }
    paintTree(shell.list, fxTreeOf(v.paths), {
      open: fxOpenSet(cwd),
      onPick: (rel) => open(rel),
      picked: () => picked,
      query: fxQuery.get(cwd) ?? "",
      all: v.paths, capped: t.capped, shown: t.files.length, total: t.total,
      status: v.status, statusMore: v.statusMore, changedOnly: fxChanged.get(cwd) ?? false,
      actions, onDrag: (rel, e) => fxStartDrag(slot, rel, e),
      onDrop: (folder, e) => {
        const source = fxMoveDrop(slot, t.files, folder, e);
        if (source) void write("Move", source.path, `${folder}/${source.path.split("/").pop()}`);
      },
      // ↑↓ walk the rows and Enter opens the selected one — the same keyboard contract every other
      // window here has. Without it this list was mouse-only, alone among the four.
      onRows: (rows) => {
        shell.setRows(rows);
        // clicking a row also moves the shell's cursor there, so Enter afterwards means "this row"
        for (const [i, r] of rows.entries()) r.el.onfocus = () => shell.select(i, false, false);
        if (scrollToPicked) {
          scrollToPicked = false;
          rows.find((r) => r.el.classList.contains("fxpicked"))?.el.scrollIntoView({ block: "center" });
        }
      },
    });
  };

  const reread = async () => {
    again.disabled = true;
    await Promise.all([loadTree(slot, cwd), loadGit(slot, cwd)]);
    again.disabled = false;
    if (!shell.isOpen()) return;
    paintHead(); paintFoot(); repaint();
    if (picked && head) { const h = fileHead(picked); head.replaceWith(h); head = h; }
  };
  again.onclick = () => void reread();

  // a path opened from outside (terminal link, hover card, the card's row) unfolds its folders,
  // so the row it names is visible and marked rather than hidden under a shut `src`
  if (startAt) {
    const segs = startAt.replace(/\/$/, "").split("/");
    for (let i = 1; i < segs.length; i++) fxOpenSet(cwd).add(segs.slice(0, i).join("/"));
    scrollToPicked = true;
  }
  paintHead(); paintFoot();
  search.value = fxContents.get(cwd) ? fxContentQuery.get(cwd) ?? "" : fxQuery.get(cwd) ?? "";
  search.placeholder = fxContents.get(cwd) ? "search contents" : "search paths";
  if (fxContents.get(cwd)) scheduleContents(); else repaint();
  if (startAt) open(startAt, line);
  // the git state is read fresh for THIS window — the board holds it only for the slot it shows
  void loadGit(slot, cwd).then(() => {
    if (fxShell !== shell) return;
    paintHead(); repaint();
    if (picked && head) { const h = fileHead(picked); head.replaceWith(h); head = h; }
  });
}

// THE CONTEXT PACKS OF ONE SESSION, opened from a chip in the board's setup block. What a pack
// holds is a POINTER LIST, not text: one anchor string per source, with no end (the validator
// takes a heading or an identifier, and nothing in this tree cuts a section out of one). So this
// window shows the pointers in full and then hands over the FILE, read at the commit the receipt
// names — the reader finds the anchor in it. A window that showed "the pack's content" would be
// inventing a span that the packs never defined.
let packsShell: Shell | null = null;
export function openPacks(setup: BriefSetup, want?: string): void {
  packsShell?.close();
  const shell = openShell({
    id: "packs",
    title: "Context packs",
    subtitle: setup.packsFrom === "receipt"
      ? `delivered with the founding brief${setup.head ? ` · read at ${setup.head}` : ""}`
      : "declared by this session's program — not proof that this session received them",
    detailHint: "Pick a pack on the left.",
    listWidth: 300,
    onClose: () => { packsShell = null; },
  });
  packsShell = shell;
  const showPack = (p: BriefSetup["packs"][number]) => {
    shell.detail.replaceChildren();
    shell.detail.appendChild(el("div", "rvhead", p.id));
    if (p.useWhen) shell.detail.appendChild(el("div", "cpkwhen", p.useWhen));
    if (p.privateSourceId) {
      shell.detail.appendChild(el("div", "hint shellhint",
        "a private pack: its source lives outside this repo, so the server cannot read it. What the "
        + "receipt proves is that this opaque source was pointed at — nothing more."));
      shell.detail.appendChild(el("div", "cpkpath", p.privateSourceId));
      return;
    }
    const sources = p.sources ?? [];
    if (!sources.length) { shell.detail.appendChild(el("div", "hint shellhint", "this pack names no source.")); return; }
    shell.detail.appendChild(el("div", "cpksub",
      `${sources.length} source${sources.length === 1 ? "" : "s"} — an anchor is where to start reading, not a span`));
    for (const src of sources) {
      const row = el("button", "cpksrc") as HTMLButtonElement;
      row.appendChild(el("div", "cpkpath", src.path));
      row.appendChild(el("div", "cpkanchor", src.anchor));
      row.title = `${src.path} — open it${setup.head ? ` as it was at ${setup.head}` : ""} and find: ${src.anchor}`;
      row.onclick = () => showFileView(shell, {
        // with a receipt the file is read AT the commit it names; a declared pack names no
        // commit, so its pointer is read against the checkout as it stands
        ...(setup.repo && setup.head ? { path: src.path, repo: setup.repo, rev: setup.head }
          : { path: setup.repo ? `${setup.repo}/${src.path}` : src.path }),
        label: src.path.split("/").pop() ?? src.path,
        source: setup.head ? `as it was at ${setup.head} — the commit this pack was delivered against`
          : "as it is on disk right now",
        back: { label: p.id, go: () => showPack(p) },
      });
      shell.detail.appendChild(row);
    }
  };
  const rows: ShellRow[] = [];
  for (const p of setup.packs) {
    const r = el("button", "cpkrow") as HTMLButtonElement;
    r.appendChild(el("span", "cpkid", p.id));
    const n = p.privateSourceId ? "private" : `${(p.sources ?? []).length}`;
    r.appendChild(el("span", "cpkn", n));
    r.onclick = () => { showPack(p); shell.showDetail(true); };
    shell.list.appendChild(r);
    rows.push({ el: r, open: () => showPack(p) });
  }
  // the ones the plan LEFT OUT ride along with their reason: "which packs does this session have"
  // is only half an answer without "and which did it not get, and why"
  if (setup.omitted.length) {
    shell.list.appendChild(el("div", "cpkhead", "omitted"));
    for (const o of setup.omitted) {
      const r = el("div", "cpkrow off");
      r.appendChild(el("span", "cpkid", o.id));
      r.appendChild(el("span", "cpkn", o.why));
      shell.list.appendChild(r);
    }
  }
  shell.setRows(rows);
  const i = want ? setup.packs.findIndex((p) => p.id === want) : -1;
  if (setup.packs.length) {
    const pick = i >= 0 ? i : 0;
    shell.select(pick, false, false);
    showPack(setup.packs[pick]);
  }
}

// THE SETUP WINDOW (owner 2026-10-23: each point of the setup leads to where it is set): the Claude Code files a session reads
// besides Fleet's start line, the repo's and the owner's own, grouped as the Setup block groups them (src/fassung-umfeld-zeilen.ts).
// A file opens as itself, at the line that sets the point; a repo file is editable with the session's slot, the owner's own are read
// here and changed where the entry says. Plugins and MCP servers have no file of their own to show: their text stands instead.
let setupShell: Shell | null = null;
export function openSetupFiles(slot: number, eintraege: readonly SetupDatei[], want?: string, finde?: string): void {
  setupShell?.close();
  const shell = openShell({ id: "setup", title: "Setup files", listWidth: 280,
    subtitle: "what Claude Code reads for this session, besides Fleet's start line",
    detailHint: "Pick a file on the left.", onClose: () => { setupShell = null; },
    onSelect: (_r, i) => { const d = eintraege[i]; if (d) show(d); } });
  setupShell = shell;
  const show = (d: SetupDatei, find?: string) => {
    if (d.pfad) {
      showFileView(shell, { path: d.pfad, label: d.name, source: d.aendern, find: find ?? d.finde,
        ...(d.gruppe === "repo" ? { edit: { slot } } : {}) });
      return;
    }
    shell.detail.replaceChildren();
    shell.detail.appendChild(el("div", "rvhead", d.name));
    shell.detail.appendChild(el("div", "fvsource", d.aendern));
    if (d.text) shell.detail.appendChild(el("div", "fvtext", d.text));
    const auch = d.auch;
    if (auch) {
      const b = el("button", "rgbtn link", `Open ${auch.label}`) as HTMLButtonElement;
      b.onclick = () => showFileView(shell, { path: auch.pfad, label: auch.pfad.split("/").pop() ?? auch.pfad, source: d.aendern,
        find: auch.finde, back: { label: d.name, go: () => show(d) } });
      shell.detail.appendChild(b);
    }
    if (isMobile()) shell.showDetail(true);
  };
  const rows: ShellRow[] = [];
  let kopf = "";
  for (const d of eintraege) {
    if (d.gruppe !== kopf) { kopf = d.gruppe; shell.list.appendChild(el("div", "cpkhead", GRUPPE[d.gruppe].kopf)); }
    const r = el("button", "cpkrow") as HTMLButtonElement;
    r.appendChild(el("span", "cpkid", d.name));
    r.appendChild(el("span", "cpkn", d.art));
    r.title = d.pfad ?? d.aendern;
    r.onclick = () => { shell.select(rows.findIndex((x) => x.el === r), false, false); show(d); shell.showDetail(true); };
    shell.list.appendChild(r);
    rows.push({ el: r, open: () => show(d) });
  }
  shell.setRows(rows);
  if (!eintraege.length) { shell.detail.replaceChildren(el("div", "hint shellhint", "This session reads no Claude Code files besides Fleet's start line.")); return; }
  const i = Math.max(0, want ? eintraege.findIndex((d) => d.key === want) : 0);
  shell.select(i, true, false);
  show(eintraege[i]!, finde);
}

function focusPane(index: number) {
  const changed = focused !== index;
  focused = index;
  for (const p of panes) p.root.classList.toggle("focused", p.index === focused);
  const slot = panes[focused]?.slot;
  switchDraft(slot ?? 0);
  ta.placeholder = promptPlaceholder();
  updateTitle();
  mountComposer(); // the composer addresses the focused pane, so its size follows the focus
  // a no-op focus must not rebuild the sidebar: the first click of a double-click on a
  // slot label lands here, and rebuilding would replace the element mid-double-click
  if (changed) {
    renderSlots();
    saveView();
    void renderBoard(); // the board describes the FOCUSED session — follow the focus
    renderSuiteMeter(); // …and the meter marks that session's balls
  }
}

function setLayout(n: number, assignments?: number[]) {
  layout = n;
  for (const p of panes) p.dispose();
  panes = [];
  panesEl.className = `l${n}`;
  for (let i = 0; i < n; i++) {
    const p = new Pane(i);
    panes.push(p);
    panesEl.appendChild(p.root);
  }
  const want = assignments ?? [];
  const seen = new Set<number>();
  for (let i = 0; i < n; i++) {
    const s = want[i] ?? 0;
    if (s && fleet[s - 1]?.cwd && !seen.has(s)) {
      seen.add(s);
      panes[i].assign(s);
    }
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>("#layouts button"))
    b.classList.toggle("on", b.dataset.l === String(n));
  for (const b of document.querySelectorAll<HTMLButtonElement>("#layouts button"))
    b.setAttribute("aria-pressed", String(b.dataset.l === String(n)));
  requestAnimationFrame(() => { for (const p of panes) p.refit(); });
  focusPane(Math.min(focused, n - 1));
}

// sidebar click: assign to the focused pane — unless the slot is already
// visible in another pane (same slot twice = two sessions fighting over resize)
export function showSlot(id: number, at = performance.now()): boolean {
  const s = fleet.find((slot) => slot.id === id);
  if (!s?.cwd) return false;
  // §F3 edge 2 — focus beats fold. Whatever route got here (a ⏸ badge, an adopt, a merge job
  // finishing, the board), the session you are now looking at must have a visible row: a pane
  // showing a lane while the sidebar pretends it isn't there is worse than no folding at all.
  if (s.worktree) {
    const stack = stacksOf().find((g) => g.lanes.some((lane) => lane.id === s.id));
    if (stack && !stackIsOpen(stack.foldKey)) setStackOpen(stack, true);
  }
  setDrawer(false);
  const existing = panes.find((p) => p.slot === id);
  existing?.beginSwitch(at);
  if (existing) { existing.focus(); existing.scrollToEnd(); existing.visibleExistingSwitch(); existing.flash(); return true; }
  const target = panes[focused];
  target.beginSwitch(at);
  target.assign(id);
  target.flash();
  return true;
}

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    // the picker and the review window are src/shell.ts windows — they swallow their own Escape
    if (hist.style.display === "flex") closeHist();
    if (sharedlg.style.display === "flex") closeShareDlg();
    if (autodlg.style.display === "flex") closeAutoDlg();
    // the four legacy overlay dialogs used to close only per outside click or their own button
    if (attndlg.style.display === "flex") closeAttnDlg();
    if (opsdlg.style.display === "flex") closeOpsDlg();
    if (devdlg.style.display === "flex") closeDevDlg();
    if (codexdlg.style.display === "flex") closeCodexDlg();
    setDrawer(false);
    setIsland(false);
    closeSheet(true);
  }
});
window.addEventListener("resize", () => { for (const p of panes) p.refit(); });

// crossing the mobile breakpoint (rotation, window resize) rebuilds the panes so
// per-pane mobile settings (font size, inputMode, forced single layout) re-apply
MOBILE_MQ.addEventListener("change", () => {
  setDrawer(false);
  setIsland(false);
  closeSheet();
  setLive(false); // the live bar is a mobile-only surface
  if (!isMobile() && boardShell?.isOpen()) setBoard(false); // the info WINDOW is the phone's surface
  applyCollapsed(); // strip the rail on mobile, restore it on desktop
  applyBoard(); // same for the right sideboard — a desktop-only surface
  renderPostLandAudit(); // the alarm card follows Info: the board column on the desktop, the window on a phone
  setLayout(isMobile() ? 1 : layout, panes.map((p) => p.slot));
});

// iOS Safari: the on-screen keyboard shrinks the visual viewport but not the layout
// viewport — track it so the compose bar stays visible above the keyboard
const vv = window.visualViewport;
let keyboardWasOpen = false;
const mobileMore = $("mobmore") as HTMLButtonElement;
mobileMore.appendChild(icon("dots"));
mobileMore.onclick = () => {
  const open = !document.body.classList.contains("keyboard-options");
  document.body.classList.toggle("keyboard-options", open);
  mobileMore.setAttribute("aria-expanded", String(open));
  mobileMore.title = open ? "Eingabeoptionen einklappen" : "Weitere Eingabeoptionen öffnen";
  // quer the tray row takes its height from the pane's 69 px, and no viewport event reports that
  if (LANDSCAPE_MQ.matches) requestAnimationFrame(() => { for (const p of panes) p.refit(); });
};
// the phone on its side (MOBILE_MQ's second arm, index.html's reading-mode block): #mread's three
// buttons. ☰ is #menu's own drawer. ⌨ lays the key row out as a band at the foot — a height change
// no viewport event reports, so the terminal refits here. ✎ brings the composer up and focuses it
// inside the tap (iOS opens the keyboard only for a focus the gesture made); body.landwrite holds
// it until the field loses focus (sync below), and body.keyboard-open takes over from there.
const mreadKeys = $("mreadkeys"), mreadWrite = $("mreadwrite");
$("mreadmenu").appendChild(icon("menu"));
$("mreadmenu").onclick = () => $("menu").click();
mreadKeys.appendChild(icon("keys"));
mreadKeys.onclick = () => {
  const on = document.body.classList.toggle("landkeys");
  mreadKeys.setAttribute("aria-pressed", String(on));
  mreadKeys.title = on ? "Tastenreihe ausblenden" : "Tastenreihe einblenden";
  requestAnimationFrame(() => { for (const p of panes) p.refit(); });
};
mreadWrite.appendChild(icon("pencil"));
mreadWrite.onclick = () => {
  document.body.classList.add("landwrite");
  ta.focus();
};
// THE PHONE UPRIGHT: two islands instead of #mhead and the fixed foot (index.html, the island
// block; docs/design/mobil-insel-notiz.md §1b/§1c). The TOP island is glass (card "Die Insel auf
// dem Telefon wird nach dem freigegebenen Entwurf gebaut", docs/design/insel-glas-notiz.md): closed
// a 28-px pill with the state shape and the name — a band that runs when the name overflows —,
// open the strip C of Konzept 2 (owner's pick 2026-10-07): dot and name left, four symbols right
// with no word under them — the view it switches to, Suchen (in both views), Modell und Effort as a
// popover at its button, Mehr (the sheet) —, under it the word buttons Sessions and Info and one
// small card: what the session does now, and where it works when that is known. A symbol's word is
// its aria-label and shows while a finger holds it (holdWord). A tap on the pill or its 44-px rim
// opens it; a tap on the name, on its free glass or anywhere outside closes it, and so does every
// action in it but Modell und Effort, whose popover stays until Übernehmen. A swipe on it opens a
// SIDE — to the right Sessions from the left, to the left Info from the right — and never another
// session (islandRelease); ← / → on the focused island do the same, Escape closes. It invents no way
// of its own: each button hands over to the control the board already has — the focused pane's ℹ,
// view toggle and search, the composer's model and effort switches — and Sessions and Mehr open the
// two sheets below (openSheet). Body classes only; the CSS decides that they mean anything (portrait).
const portrait = () => isMobile() && !LANDSCAPE_MQ.matches;
const mTop = $("mtop"), mPill = $("mpill") as HTMLButtonElement, mName = $("mname") as HTMLButtonElement;
const mSlot = $("mslot") as HTMLButtonElement, mInfo = $("minfo") as HTMLButtonElement, mView = $("mview") as HTMLButtonElement;
const mMore = $("mmore") as HTMLButtonElement, mGrip = $("mgrip") as HTMLButtonElement;
const mFind = $("mfind") as HTMLButtonElement, mDirect = $("mdirect") as HTMLButtonElement;
const mDirPop = $("mdirpop"), mHold = $("mhold"), mNowLine = $("mnowl");
mFind.appendChild(icon("search"));
mDirect.appendChild(icon("regler"));
mMore.appendChild(icon("dots"));
mSlot.append(icon("chevron"), el("span", "", "Sessions"));
mInfo.append(el("span", "", "Info"), icon("chevron"));
// the pill's name sits in a band track; a second copy joins it only while it runs (fitPill)
const mBand = el("span", "mband"), mSpur = el("span", "mspur");
mBand.setAttribute("aria-hidden", "true");
mBand.appendChild(mSpur);
const paneControl = (cls: string): HTMLButtonElement | null => {
  const b = panes[focused]?.root.querySelector<HTMLButtonElement>(`.panetools .${cls}`) ?? null;
  return b && b.style.display !== "none" ? b : null;
};

// THE SPRING (Grammatik G0.4 addendum, docs/design/liquid-glass.md §3): one spring in two settings,
// given as in SwiftUI — response (s) and dampingFraction ζ; mass 1, so stiffness k = (2π/response)²
// and damping c = 4π·ζ/response. "snap" moves a state (open, spring in, the island back to the
// middle), "swipe" carries a released finger on with its velocity. springCurve samples the same
// spring as a CSS linear() curve, so CSS and JS have one source. Still (prefers-reduced-motion,
// chatStill): nothing springs, every state lands at once.
type Spring = { response: number; zeta: number };
const SPRING = { snap: { response: 0.38, zeta: 0.72 }, swipe: { response: 0.42, zeta: 0.86 } } satisfies Record<string, Spring>;
const springKC = (f: Spring) => ({ k: (2 * Math.PI / f.response) ** 2, c: 4 * Math.PI * f.zeta / f.response });
function springCurve(f: Spring, n = 24): { css: string; ms: number } {
  const { k, c } = springKC(f);
  let x = 0, v = 0, t = 0;
  const xs = [0];
  while (t < 3) {
    v += (-k * (x - 1) - c * v) / 1000; x += v / 1000; t += 1 / 1000; xs.push(x);
    if (Math.abs(1 - x) < 1e-3 && Math.abs(v) < 1e-2) break;
  }
  const ms = Math.round(t * 1000), pts: number[] = [];
  for (let i = 0; i <= n; i++) pts.push(i === n ? 1 : +xs[Math.round(ms * i / n)].toFixed(3));
  return { css: `linear(${pts.join(", ")})`, ms };
}
if (CSS.supports("transition-timing-function", "linear(0, 1)")) {
  const snap = springCurve(SPRING.snap);
  document.documentElement.style.setProperty("--feder", snap.css);
  document.documentElement.style.setProperty("--feder-ms", `${snap.ms}ms`);
}
// the spring in JS, for what a finger hands over: integrated per frame in 1-ms steps from `v0`
// (units per second), written only through `write`. The returned stop cancels it, so a new grip
// starts from wherever it stands.
function springTo(f: Spring, from: number, to: number, v0: number, write: (x: number) => void, done?: () => void): () => void {
  if (chatStill.matches) { write(to); done?.(); return () => {}; }
  const { k, c } = springKC(f);
  let x = from, v = v0, last = performance.now(), id = 0;
  const tick = (now: number) => {
    let dt = Math.min(0.064, (now - last) / 1000);
    last = now;
    while (dt > 0) { const h = Math.min(dt, 0.001); v += (-k * (x - to) - c * v) * h; x += v * h; dt -= h; }
    if (Math.abs(x - to) < 1e-3 * Math.max(1, Math.abs(to - from)) && Math.abs(v) < 1e-2) { write(to); done?.(); return; }
    write(x);
    id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(id);
}

// the pill as wide as the name, 96–168 px; a name that does not fit runs as a band — a second copy
// behind it, 40 px/s (the CSS starts it after 1.2 s, holds it while open or hidden) — never while
// still, where it stands cut with a soft edge (liquid-glass.md §5)
const PILL_PAD = 11 + 12, PILL_DOT = 6 + 6;
function fitPill(): void {
  for (const copy of [...mSpur.children].slice(1)) copy.remove();
  mBand.classList.remove("mover");
  mTop.classList.remove("mlong");
  mSpur.classList.remove("mrun");
  const nm = mSpur.firstElementChild as HTMLElement | null;
  const nat = nm && portrait() ? nm.scrollWidth : 0;
  if (!nm || !nat) return; // not drawn here (desktop, the phone on its side)
  const chrome = PILL_PAD + (mPill.querySelector(".act") ? PILL_DOT : 0);
  const width = Math.max(96, Math.min(168, nat + chrome));
  mTop.style.setProperty("--mpw", `${width}px`);
  if (nat <= width - chrome) return;
  mBand.classList.add("mover");
  mTop.classList.add("mlong");
  const copy = nm.cloneNode(true) as HTMLElement;
  mSpur.appendChild(copy);
  mTop.style.setProperty("--mtick", `${(nm.getBoundingClientRect().width / 40).toFixed(2)}s`);
  if (!chatStill.matches) mSpur.classList.add("mrun");
}
chatStill.addEventListener("change", () => { islandKey = ""; renderIsland(); });
document.addEventListener("visibilitychange", () => document.body.classList.toggle("mhidden", document.hidden));

function setIsland(open: boolean): void {
  const body = document.body;
  body.classList.toggle("mopen", open);
  mPill.setAttribute("aria-expanded", String(open));
  if (!open) { body.classList.remove("mda"); setDirect(false); holdEnd(); return; }
  renderIsland();
  // the contents spring in from the next frame on — in the frame that opens they have no start
  if (chatStill.matches) body.classList.add("mda");
  else requestAnimationFrame(() => requestAnimationFrame(() => { if (body.classList.contains("mopen")) body.classList.add("mda"); }));
}
// WHAT THE SESSION DOES NOW, as the open island says it in one line (Konzept 1 §2, "Jetzt"): from the
// states the board already reads — the drawer's (slotState) and the row's awaiting —, nothing
// guessed. A session the pane does not show yet has no line.
export function nowSentence(s: SlotInfo | undefined): { text: string; owner: boolean } | null {
  if (!s?.cwd) return null;
  if (s.rueckfrage) return { text: RUECKFRAGE_SATZ, owner: true };
  if (s.vertrauen) return { text: VERTRAUEN_SATZ, owner: true };
  if (s.awaiting === "owner") return { text: "Wartet auf dich", owner: true };
  if (s.stalled || s.agent === "no-agent" || s.agent === "no-pane") return { text: "Hängt — die Session antwortet nicht", owner: false };
  if (s.awaiting === "main") return { text: "Wartet auf ihre MAIN", owner: false };
  if (sessionActive(s.id)) return { text: "Arbeitet gerade", owner: false };
  const quiet = s.lastOutput > 0 ? Date.now() - s.lastOutput : 0;
  if (quiet >= 60_000) return { text: `Still seit ${agoDe(quiet).replace(/^vor /, "")}`, owner: false };
  return { text: "Still", owner: false };
}
let islandKey = "";
function renderIsland(): void {
  const pane = panes[focused];
  const slot = pane?.slot ?? 0;
  const s = slot ? fleet.find((x) => x.id === slot) : undefined;
  const name = s?.cwd ? nameWithoutModel(s) : mtitle.textContent ?? "";
  // the drawer's own reading of the row (slotState: the shape, STATE_WORD: its word)
  const state = s?.cwd ? slotState(s, serverNow, panes.some((p) => p.slot === s.id)) : null;
  const now = nowSentence(s);
  const view = paneControl("viewtoggle"), info = paneControl("boardtoggle");
  const chat = !!pane?.isChat;
  // the pill's type follows Aa up to 15 px, so its measured width does too
  const fs = portrait() ? getComputedStyle(mPill).fontSize : "";
  const key = [name, state, now?.text ?? "", now?.owner ?? "", !!view, chat, !!info, slot, fs].join("|");
  if (key === islandKey) return;
  islandKey = key;
  const dot = () => { const d = el("span", `act ${state}`); d.title = state ? STATE_WORD[state] : ""; return d; };
  mSpur.replaceChildren(el("span", "mnm", name));
  mPill.replaceChildren(...(state ? [dot()] : []), mBand);
  mPill.setAttribute("aria-label", `${name}${state ? ` · ${STATE_WORD[state]}` : ""} — Insel aufklappen`);
  mTop.setAttribute("aria-label", `Session ${name}`);
  const line1 = el("span", "ml1");
  line1.append(...(state ? [dot()] : []), el("span", "mnm", name));
  mName.replaceChildren(line1);
  // the view button shows where it goes: the terminal glyph to the terminal, the bubble to the
  // conversation — and so does its word
  mView.hidden = !view;
  mView.replaceChildren(icon(chat ? "terminal" : "chat"));
  const viewWord = chat ? "Terminal" : "Gespräch";
  mView.setAttribute("aria-label", viewWord);
  mView.title = viewWord;
  mFind.hidden = !slot || !view;
  mDirect.hidden = !slot || !s?.cwd;
  mSlot.setAttribute("aria-label", "Sessions");
  mSlot.title = "Sessions";
  mInfo.setAttribute("aria-label", "Info");
  mInfo.title = "Info";
  mInfo.hidden = !info;
  mNowLine.textContent = now?.text ?? "";
  mNowLine.classList.toggle("owner", !!now?.owner);
  // the stagger counts what is drawn, so the springs follow each other with no gap
  let i = 0;
  for (const e of [mName, mView, mFind, mDirect, mMore, ...$("mbelow").children] as HTMLElement[]) if (!e.hidden) e.style.setProperty("--i", String(i++));
  if (directOpen) renderDirect();
  fitPill();
}
MOBILE_MQ.addEventListener("change", () => { islandKey = ""; renderIsland(); });
// switching the step is no action: like the keys, it never takes the field's focus (keyboard stays),
// and neither does the island's rim. Nor does ⋯: its options are for the field, and a keyboard
// leaving would fold them away again (sync)
mTop.addEventListener("pointerdown", (e) => {
  const b = (e.target as Element).closest("button");
  if (!b || b === mPill || b === mName || b.classList.contains("mib")) e.preventDefault();
});
mName.onclick = () => setIsland(false);
mTop.addEventListener("click", (e) => {
  // a target the action itself replaced (the view button's glyph) is no free glass: it decides nothing
  if (!(e.target as Element).isConnected) return;
  const b = (e.target as Element).closest("button");
  if (!document.body.classList.contains("mopen")) { if (!b || b === mPill) setIsland(true); return; }
  if (mDirPop.contains(e.target as Node)) return; // the popover's own glass decides nothing
  if (!b) setIsland(false); // the free glass, the rim
});
const islandAction = (run: () => void) => () => { setIsland(false); run(); };
mSlot.onclick = islandAction(() => sideTo("sessions", 1));
mInfo.onclick = islandAction(() => sideTo("info", 1));
mView.onclick = islandAction(() => paneControl("viewtoggle")?.click());
mFind.onclick = islandAction(() => panes[focused]?.openSearch());
mMore.onclick = islandAction(() => openSheet("tools"));
mDirect.onclick = () => setDirect(!directOpen);

// MODELL UND EFFORT (the owner's „[Zitat entfernt]“, 2026-10-07): the composer's two switches
// as segments in a popover at the button, ONE Übernehmen. It is the switches' own mechanism
// (src/composer.ts#optChoices, #stageOpt, #applyOpt) — a press only marks a pick, Übernehmen hands
// the ONE marked pick to the switch's own Apply, which asks and answers as it does at the desk.
// One pick at a time: marking a model forgets a marked effort and the other way round, so the one
// button never has to say which of two changes it would make. The switches are drawn in either
// view while the popover is open (setOptsAnywhere): Apply lives in them.
let directOpen = false;
// the effort levels in words; a level this client does not know stands as the harness names it
const EFFORT_WORD: Record<string, string> = { minimal: "minimal", low: "niedrig", medium: "mittel", high: "hoch", xhigh: "sehr hoch", max: "maximal" };
function setDirect(open: boolean): void {
  if (open === directOpen) return;
  directOpen = open;
  mDirect.setAttribute("aria-expanded", String(open));
  mDirPop.hidden = !open;
  setOptsAnywhere(open);
  if (open) renderDirect();
  else mDirPop.replaceChildren();
}
function renderDirect(): void {
  const choices = optChoices();
  const parts: HTMLElement[] = [];
  for (const c of choices) {
    const word = c.field === "model" ? "Modell" : "Effort";
    parts.push(el("div", "mdsec", word));
    const segs = el("div", "mshsegs");
    segs.setAttribute("role", "group");
    segs.setAttribute("aria-label", word);
    segs.dataset.field = c.field;
    for (const o of c.values) {
      const b = el("button", "", c.field === "effort" ? EFFORT_WORD[o.v] ?? o.label : o.label) as HTMLButtonElement;
      b.type = "button";
      b.title = o.title;
      b.dataset.v = o.v;
      b.setAttribute("aria-pressed", String(o.v === c.current));
      b.classList.toggle("staged", o.v === c.staged && o.v !== c.current);
      b.onclick = () => {
        const other = c.field === "model" ? "effort" : "model";
        if (choices.some((x) => x.field === other && x.staged !== null)) unstageOpt(other);
        stageOpt(c.field, o.v);
        renderDirect();
      };
      segs.appendChild(b);
    }
    parts.push(segs);
  }
  const staged = choices.find((c) => c.staged && c.staged !== c.current);
  if (choices.length) {
    const apply = el("button", "mdapply", "Übernehmen") as HTMLButtonElement;
    apply.type = "button";
    apply.disabled = !staged;
    apply.title = staged ? `${staged.field === "model" ? "Modell" : "Effort"} dieser Session umstellen — fragt wie der Schalter am Feld` : "Erst eine andere Wahl antippen";
    apply.onclick = () => {
      if (!staged) return;
      applyOpt(staged.field); // first: the switch's popover it opens keeps the switches drawn
      setIsland(false);
    };
    parts.push(apply);
  } else parts.push(el("div", "mdnone", "Diese Session lässt Modell und Effort hier nicht umstellen."));
  mDirPop.replaceChildren(...parts);
}

// THE HELD WORD (Konzept 2 §1, Blatt 17): a finger that rests 300 ms on a symbol of the strip sees
// its word in a capsule under it; letting go there presses it, moving away cancels (the swipe's
// own axis lock decides "away" — islandRelease). A mouse or VoiceOver reads the same word from
// title and aria-label.
const HOLD_MS = 300;
let holdTimer: ReturnType<typeof setTimeout> | undefined, holdOn: HTMLButtonElement | null = null;
function holdStart(b: HTMLButtonElement): void {
  holdEnd();
  holdTimer = setTimeout(() => {
    const word = b.getAttribute("aria-label") ?? "";
    if (!word || !b.isConnected) return;
    holdOn = b;
    const r = b.getBoundingClientRect(), t = mTop.getBoundingClientRect();
    mHold.textContent = word;
    mTop.style.setProperty("--mhx", `${Math.round(r.left + r.width / 2 - t.left)}px`);
    mTop.classList.add("mholding");
  }, HOLD_MS);
}
function holdEnd(): void {
  clearTimeout(holdTimer);
  holdTimer = undefined;
  holdOn = null;
  mTop.classList.remove("mholding");
}
mTop.addEventListener("pointerdown", (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>("#mtools .mib");
  if (b && e.button <= 0 && document.body.classList.contains("mopen")) holdStart(b);
});

// a tap outside closes the open island (upright only)
document.addEventListener("pointerdown", (e) => {
  const t = e.target as Element | null;
  if (!t || !portrait()) return;
  if (document.body.classList.contains("mopen") && !mTop.contains(t)) setIsland(false);
}, true);

// THE TWO SIDES the island opens (insel-glas-notiz.md §1, §3): Sessions from the left — the
// Sessions sheet in its side form (#msheetwrap.mside) — and Info from the right — the board's
// window (#shell-board). --mside-p on the side's own root is its opening, 0 shut … 1 open: the
// finger moves it while it drags, the swipe spring carries it on with the finger's velocity, a
// button or an arrow key opens it with the same spring. Back at 0 the side closes for real.
type Side = "sessions" | "info";
const sideHost = (side: Side): HTMLElement | null => side === "sessions"
  ? (sheetOpen === "sessions" ? mSheetWrap : null) : (boardShell?.isOpen() ? boardShell.root : null);
const sideP: Record<Side, number> = { sessions: 0, info: 0 };
const sideStop: Partial<Record<Side, () => void>> = {};
function sideWrite(side: Side, p: number): void {
  sideP[side] = p;
  sideHost(side)?.style.setProperty("--mside-p", String(Math.max(0, Math.min(1.04, p))));
}
// open the side's own surface (the sheet, the board's ℹ); false when there is none — a pane with no
// session has no Info
function sideOpen(side: Side): boolean {
  if (side === "sessions") { if (sheetOpen !== "sessions") openSheet("sessions"); }
  else if (!boardShell?.isOpen()) paneControl("boardtoggle")?.click();
  return !!sideHost(side);
}
function sideShut(side: Side): void {
  sideStop[side]?.();
  sideStop[side] = undefined;
  sideP[side] = 0;
  if (side === "sessions") closeSheet();
  else if (boardShell?.isOpen()) setBoard(false);
}
function sideTo(side: Side, to: 0 | 1, v0 = 0): void {
  sideStop[side]?.();
  const host = sideHost(side);
  // a side opened some other way stands open (no inline opening): it starts from there
  if (host && !host.style.getPropertyValue("--mside-p")) sideP[side] = 1;
  if (!host) {
    sideP[side] = 0;
    if (to === 0 || !sideOpen(side)) return;
    sideWrite(side, 0);
  }
  sideStop[side] = springTo(SPRING.swipe, sideP[side], to, v0, (p) => sideWrite(side, p), () => {
    sideStop[side] = undefined;
    if (to === 1) sideHost(side)?.style.removeProperty("--mside-p");
    else sideShut(side);
  });
}

// THE SWIPE (insel-glas-notiz.md §3, liquid-glass.md §4): pointer events on the island, which takes
// every horizontal move itself (touch-action: pan-y). The axis locks after 8 px, the larger one
// wins; a horizontal drag moves the side with the finger (1:1, a drawer) and the island gives 35 %
// of it, at most 24 px. Released, the side opens past 28 px unless flicked back faster than
// 0.4 px/ms, or at more than 0.4 px/ms its way; otherwise it springs back — so does a
// pointercancel (the system took the gesture; its coordinates are not to be trusted, the last move
// counts). The velocity is read off the last 8 moves. A start in the outer 20 px belongs to iOS's
// edge swipe. A finger's TAP (under 10 px and 250 ms; a mouse keeps its own click) is decided here, at pointerup, and pressed on what the
// finger went down on — the engine's own click after it is swallowed (any trusted click for 400 ms
// on the island, or anywhere within 10 px of where the finger left it: Sessions, ℹ and ⋯ open a
// surface under the finger, and the click WebKit's tap sends after its touchend hit that surface's
// shade and closed it again, measured with Playwright's WebKit tap; the press this code makes is
// untrusted and passes — Chromium's tap click carries detail 0, so
// detail cannot tell them apart, measured), and so is the click after a long press or a drag. Deciding it here keeps the
// thresholds the note names, and a touch stream that synthesises no click (Playwright's WebKit on
// macOS, measured) still taps. While a finger drags, the side and its shade take no pointer
// (body.mdrag): an engine that hit-tests every move would otherwise cancel the touch the moment the
// shade slides under it (measured in that WebKit: pointercancel, then pointerup on the shade).
const SWIPE = { lock: 8, tapPx: 10, tapMs: 250, firePx: 28, fireV: 0.4, edge: 20, give: 0.35, giveMax: 24 } as const;
type Drag = { id: number; at: Element; x0: number; y0: number; x: number; y: number; t0: number; axis: "x" | "y" | null; side: Side | null; none: Side | null; track: [number, number][] };
let drag: Drag | null = null, swallowUntil = 0, swallowAt = { x: 0, y: 0 }, giveStop: (() => void) | null = null;
const setGive = (px: number) => mTop.style.setProperty("--mdx", `${px.toFixed(2)}px`);
const sideWidth = (side: Side): number =>
  sideHost(side)?.querySelector<HTMLElement>(side === "sessions" ? "#msheet" : ".shellwin")?.getBoundingClientRect().width || innerWidth * 0.86;
document.addEventListener("click", (e) => {
  if (performance.now() >= swallowUntil || !e.isTrusted) return;
  if (!mTop.contains(e.target as Node) && Math.hypot(e.clientX - swallowAt.x, e.clientY - swallowAt.y) >= SWIPE.tapPx) return;
  e.stopImmediatePropagation(); e.preventDefault();
}, true);
mTop.addEventListener("pointerdown", (e) => {
  if (!portrait() || e.button > 0) return;
  if (drag) islandRelease(e, true, drag.id); // a finger whose end never came (the system kept it) lets go
  if (e.clientX < SWIPE.edge || innerWidth - e.clientX < SWIPE.edge) return;
  giveStop?.();
  giveStop = null;
  drag = { id: e.pointerId, at: e.target as Element, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: e.timeStamp,
    axis: null, side: null, none: null, track: [[e.timeStamp, e.clientX]] };
  mTop.classList.add("mpress");
});
mTop.addEventListener("pointermove", (e) => {
  const d = drag;
  if (!d || e.pointerId !== d.id) return;
  d.track.push([e.timeStamp, e.clientX]);
  if (d.track.length > 8) d.track.shift();
  d.x = e.clientX; d.y = e.clientY;
  const dx = d.x - d.x0, dy = d.y - d.y0;
  if (!d.axis && Math.hypot(dx, dy) >= SWIPE.lock) {
    d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    mTop.classList.remove("mpress");
    holdEnd(); // moving away from a held symbol cancels it
    if (d.axis === "x") {
      document.body.classList.add("mdrag");
      try { mTop.setPointerCapture(e.pointerId); } catch { /* the pointer is gone already */ }
    }
  }
  if (d.axis !== "x") return;
  e.preventDefault();
  setGive(Math.sign(dx) * Math.min(SWIPE.giveMax, Math.abs(dx) * SWIPE.give));
  const side: Side = dx > 0 ? "sessions" : "info";
  if (d.side && d.side !== side) { sideShut(d.side); d.side = null; }
  if (d.none === side) return;
  if (d.side !== side) {
    sideStop[side]?.();
    if (!sideHost(side)) { sideP[side] = 0; if (!sideOpen(side)) { d.none = side; return; } }
    d.side = side;
  }
  sideWrite(side, Math.min(1, Math.abs(dx) / sideWidth(side)));
});
// `last`: the release happened where the finger last moved (the event's own coordinates are not to
// be trusted — a cancel, or a cancel that turned out to be a release)
function islandRelease(e: PointerEvent, cancelled: boolean, id = e.pointerId, last = cancelled): void {
  const d = drag;
  if (!d || id !== d.id) return;
  drag = null;
  clearTimeout(cancelTimer);
  pendingCancel = null;
  mTop.classList.remove("mpress");
  const held = holdOn; // a symbol whose word showed: letting go on it presses it
  holdEnd();
  document.body.classList.remove("mdrag");
  const x = last ? d.x : e.clientX, y = last ? d.y : e.clientY;
  const dx = x - d.x0, dy = y - d.y0, ms = e.timeStamp - d.t0;
  const a = d.track[0], b = d.track[d.track.length - 1];
  const v = b[0] > a[0] ? (b[1] - a[1]) / (b[0] - a[0]) : 0; // px/ms
  // what the island measured, for a reader of the page (the probe checks a fast swipe arrived fast)
  mTop.dataset.swipe = JSON.stringify({ axis: d.axis, dx: Math.round(dx), v: +v.toFixed(2), ms: Math.round(ms), side: d.side, cancelled });
  // a mouse that did not drag keeps its own click, held however long: the 250 ms bound is a finger's
  // tap, and a slow press of a button is no long press (a loaded CDP click swallowed, measured)
  if (!d.axis && e.pointerType === "mouse") return;
  if (d.axis !== "x") {
    // no drag: the engine's click that follows is swallowed either way; a tap presses what the finger
    // went down on — its button, else the island itself (the pill's rim opens, free glass closes)
    swallowUntil = performance.now() + 400;
    swallowAt = { x, y };
    if (!cancelled && !d.axis && Math.hypot(dx, dy) < SWIPE.tapPx && held?.isConnected) held.click();
    else if (!cancelled && !d.axis && Math.hypot(dx, dy) < SWIPE.tapPx && ms < SWIPE.tapMs && d.at.isConnected)
      (d.at.closest<HTMLButtonElement>("#mtop button") ?? mTop).click();
    return;
  }
  swallowUntil = performance.now() + 400;
  swallowAt = { x, y };
  const give = parseFloat(mTop.style.getPropertyValue("--mdx")) || 0;
  giveStop = springTo(SPRING.snap, give, 0, v * 1000 * SWIPE.give, setGive, () => { giveStop = null; });
  const side = d.side;
  if (!side) return;
  const vIn = v * Math.sign(dx); // the velocity in the swipe's own direction
  const fire = !cancelled && ((Math.abs(dx) > SWIPE.firePx && vIn > -SWIPE.fireV) || vIn > SWIPE.fireV);
  const w = sideWidth(side);
  if (fire) { setIsland(false); sideTo(side, 1, Math.max(0, vIn) * 1000 / w); }
  else sideTo(side, 0, Math.min(0, vIn) * 1000 / w);
}
mTop.addEventListener("pointerup", (e) => islandRelease(e, false));
// A touch's pointercancel is not always the system taking it: WebKit (Playwright's macOS build,
// measured) cancels a touch that ENDS outside the element it began on and then delivers that touch's
// touchend — a drag that carried the finger off the pill would never open its side. The touch event
// after the cancel decides: touchend is a release where the finger last was, touchcancel (or nothing
// within 80 ms) is the cancel.
let pendingCancel: PointerEvent | null = null, cancelTimer: ReturnType<typeof setTimeout> | undefined;
mTop.addEventListener("pointercancel", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (e.pointerType !== "touch") { islandRelease(e, true); return; }
  pendingCancel = e;
  clearTimeout(cancelTimer);
  cancelTimer = setTimeout(() => { if (pendingCancel) islandRelease(pendingCancel, true); }, 80);
});
mTop.addEventListener("touchend", () => { if (pendingCancel) islandRelease(pendingCancel, false, pendingCancel.pointerId, true); }, { passive: true });
mTop.addEventListener("touchcancel", () => {
  const e = pendingCancel;
  if (e) islandRelease(e, true);
  else if (drag) islandRelease(new PointerEvent("pointercancel", { pointerId: drag.id }), true, drag.id);
}, { passive: true });
// ← and → on the focused island are the swipe's keys: they follow the SIDE (← opens the left one),
// since a key pulls nothing; Escape closes (the window's handler above, the board's own)
mTop.addEventListener("keydown", (e) => {
  if (!portrait() || e.altKey || e.ctrlKey || e.metaKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
  e.preventDefault();
  e.stopPropagation();
  setIsland(false);
  sideTo(e.key === "ArrowLeft" ? "sessions" : "info", 1);
});
// the grip folds the chips and the nine keys in and out of the bottom island; like the keys, it
// never takes the field's focus, so the on-screen keyboard stays up
mGrip.addEventListener("pointerdown", (e) => e.preventDefault());
mGrip.onclick = () => {
  const on = document.body.classList.toggle("mkeys");
  mGrip.setAttribute("aria-expanded", String(on));
  mGrip.title = on ? "Eigene Tasten einklappen" : "Eigene Tasten aufklappen — deine Befehls-Chips und ^C, esc, tab, Pfeile, Enter";
};
// turning the phone (MOBILE_MQ holds, its arm changes) leaves no island and no sheet open behind
// the reading mode — and upright, ⋯ is the sheet: the side's ⋯ options do not ride along
LANDSCAPE_MQ.addEventListener("change", () => {
  setIsland(false);
  closeSheet();
  islandKey = ""; // the pill is measured again once it is drawn
  renderIsland();
  if (portrait()) { document.body.classList.remove("keyboard-options"); mobileMore.setAttribute("aria-expanded", "false"); }
});

// THE TWO SHEETS OF THE TOP ISLAND (card "Auf dem Telefon öffnen Sessions und Werkzeuge als eigene
// Blätter"; docs/design/mobil-insel-notiz.md §1 and §3, sketch mobil-insel-skizze.html?v=oben&blatt=…).
// Sessions opens Sessions, ⋯ opens Werkzeuge, each over a shade. Werkzeuge is a sheet, full width
// at the foot of the VISIBLE screen (G4.1 mobil; #msheetwrap is --vvh tall, so a keyboard that has
// not left yet never covers it); Sessions is the glass island's LEFT SIDE since its build — from
// the left edge, 86 % wide, the visible screen tall (insel-glas-notiz.md §7: the form changed, not
// the content), opened by the button, ← or a swipe (sideTo). Like the island it invents no way of its own — every row hands over
// to what the board already has: the drawer's head buttons, showSlot, openK15Entwurf, the instance
// menu's own rows, the tray, the pane's corner group, the composer's switches, openSettings. A
// conditional control stays conditional: its row shows exactly when its source does. Every row
// closes the sheet before it acts (the island's rule); only a model/effort press stays, because it
// only marks a pick — Übernehmen then presses the switch's own Apply, which asks as it does today.
// The sheet takes the focus like any modal surface (on a phone the keyboard goes with it); Escape and
// the shade close it and give the focus to the pill, the island's one control that is always drawn.
type Sheet = "sessions" | "tools";
const mSheetWrap = $("msheetwrap"), mSheet = $("msheet");
let sheetOpen: Sheet | null = null;
let sheetInst = false; // Sessions: the instance list folded out under its chip
let sheetKey = "";
function openSheet(which: Sheet): void {
  if (!portrait()) return;
  sheetOpen = which;
  sheetInst = false;
  sheetKey = "";
  // Sessions is the island's left side (index.html, THE TWO SIDES); Werkzeuge stays at the foot
  mSheetWrap.classList.toggle("mside", which === "sessions");
  document.body.classList.add("msheet");
  mSheetWrap.setAttribute("aria-hidden", "false");
  renderSheet();
  mSheet.focus({ preventScroll: true });
}
function closeSheet(refocus = false): void {
  if (!sheetOpen) return;
  sheetOpen = null;
  sheetKey = "";
  sideStop.sessions?.();
  sideStop.sessions = undefined;
  sideP.sessions = 0;
  mSheetWrap.classList.remove("mside");
  mSheetWrap.style.removeProperty("--mside-p");
  document.body.classList.remove("msheet");
  mSheetWrap.setAttribute("aria-hidden", "true");
  mSheet.replaceChildren();
  if (refocus) mPill.focus({ preventScroll: true });
}
$("msheetshade").onclick = () => closeSheet(true);
// one row of a sheet: an icon, the word, a quiet value; the click closes the sheet, then acts
function sheetRow(cls: string, ico: IconName | null, word: string, run: (event: MouseEvent) => void, value?: string): HTMLButtonElement {
  const b = el("button", cls) as HTMLButtonElement;
  b.type = "button";
  if (ico) b.appendChild(icon(ico));
  b.appendChild(el("span", "mshw", word));
  if (value) b.appendChild(el("span", "mshval", value));
  b.onclick = (e) => { closeSheet(); run(e); };
  return b;
}
// the sessions in the drawer's order — a stack's anchor, then its lanes — none folded away: the
// sheet is the phone's whole list
function sheetSessions(): ActiveSlot[] {
  const stacks = stacksOf();
  const at = new Map(stacks.map((g) => [g.at, g]));
  const stacked = new Set(stacks.flatMap((g) => g.lanes.map((lane) => lane.id)));
  const out: ActiveSlot[] = [], seen = new Set<number>();
  const add = (s: ActiveSlot) => { if (!seen.has(s.id)) { seen.add(s.id); out.push(s); } };
  for (const s of fleet) {
    if (!isActive(s)) continue;
    const g = at.get(s.id);
    if (g) { if (g.anchor) add(g.anchor); for (const lane of g.lanes) add(lane); continue; }
    if (!stacked.has(s.id)) add(s);
  }
  return out;
}
// the drawer's head row in words (#sidetools; HEAD_BTNS holds the same buttons as glyphs)
const SHEET_TOOLS: ReadonlyArray<{ id: string; icon: IconName; word: string }> = [
  { id: "queuebtn", icon: "list", word: "Aufträge" },
  { id: "attnbtn", icon: "megaphone", word: "Für dich" },
  { id: "opsbtn", icon: "inbox", word: "Eingang" },
  { id: "outcomebtn", icon: "receipt", word: "Lands" },
  { id: "auditbtn", icon: "shield", word: "Protokoll" },
  { id: "konstbtn", icon: "tree", word: "Konstellation" },
  { id: "devbtn", icon: "laptop", word: "Geräte" },
  { id: "saverbtn", icon: "saver", word: "Datensparen" },
];
function sessionsSheet(): HTMLElement[] {
  const refs = laneBandNames(stacksOf());
  const rows = sheetSessions();
  const head = el("div", "mshhead");
  const title = el("b", "", "Sessions");
  title.id = "msheettitle";
  // no waiting count: each row that waits says so itself, on the same sheet
  head.append(title, el("span", "mshsub", `${rows.length} offen`));
  // the head row's buttons in words, breaking into a second line on a narrow phone (never scrolling
  // a word off the edge); each one shows when its source shows
  const tray = el("div", "mshtray");
  tray.setAttribute("role", "group");
  tray.setAttribute("aria-label", "Werkzeuge der Fleet");
  for (const t of SHEET_TOOLS) {
    const src = $(t.id) as HTMLButtonElement;
    if (src.style.display === "none") continue;
    const b = sheetRow("", t.icon, t.word, () => src.click());
    b.dataset.tool = t.id;
    b.title = src.title;
    const n = headBadge(src);
    if (n) b.appendChild(el("span", "mshn", n));
    if (t.id === "saverbtn") b.setAttribute("aria-pressed", String(dataSaver));
    tray.appendChild(b);
  }
  // the instance chip: with a list it folds the list's own rows out (each forwards to its #instmenu
  // row — the one navigation of this client); a single host has nothing to pick, so it is a word
  const instRows = [...instMenu.querySelectorAll<HTMLButtonElement>(".instrow")];
  if (instRows.length) {
    const b = el("button", "mshinst") as HTMLButtonElement;
    b.type = "button";
    b.dataset.tool = "instbtn";
    b.append(el("span", "mshw", instanceName ?? "Computer"));
    // the Umschalter rows ride in the same fold; the head says they are there, as the chip does
    if (switchLinks.length) b.append(el("span", "mshval", switchLinks.some((l) => l.kind === "live") ? "⇄ live"
      : `⇄ ${switchLinks.length} ${switchLinks.length === 1 ? "Testinstanz" : "Testinstanzen"}`));
    b.append(icon("chevron"));
    b.title = instBtn.title;
    b.setAttribute("aria-expanded", String(sheetInst));
    b.onclick = () => { sheetInst = !sheetInst; renderSheet(); };
    tray.appendChild(b);
  } else if (instanceName) {
    const w = el("span", "mshinst", instanceName);
    w.title = instBtn.title;
    tray.appendChild(w);
  }
  const list = el("div", "mshbody");
  if (sheetInst) for (const r of instRows) {
    const b = sheetRow("mshrow mshinstrow", null, r.querySelector(".instname")?.textContent ?? "", () => r.click(),
      r.querySelector(".insturl")?.textContent ?? "");
    b.title = r.title;
    list.appendChild(b);
  }
  const cur = panes[focused]?.slot ?? 0;
  for (const s of rows) {
    const addr = s.worktree ? refs.get(s.id) ?? String(s.id) : String(s.id);
    const state = slotState(s, serverNow, panes.some((p) => p.slot === s.id));
    const r = sheetRow(`mshrow${s.worktree ? " lane" : ""}${s.id === cur ? " current" : ""}`, null, "", (e) => showSlot(s.id, e.timeStamp));
    r.dataset.slot = String(s.id);
    const nm = el("span", "mshnm");
    nm.appendChild(el("span", "mshname", laneLabel(s)));
    if (s.awaiting === "owner") nm.appendChild(el("span", "mshwhy", "wartet auf dich"));
    // what it gave itself at its start (SlotInfo.gaveItself): on the phone in words, there is no hover for the bar's +N
    if (s.gaveItself?.length) nm.appendChild(el("span", "mshwhy mshgave", `gave itself ${s.gaveItself.length} stone${s.gaveItself.length === 1 ? "" : "s"}`));
    const act = el("span", `act ${state}`);
    act.title = STATE_WORD[state];
    r.replaceChildren(el("span", "maddr", addr), nm, act);
    r.setAttribute("aria-label", `${addr} ${laneLabel(s)} — ${STATE_WORD[state]}`);
    if (s.id === cur) r.setAttribute("aria-current", "true");
    list.appendChild(r);
  }
  // a new session starts in the first free place — the same window „Neue Session“ an empty drawer row opens (src/k15-entwurf.ts)
  const free = fleet.find((s) => s.id <= 16 && !isActive(s));
  const neu = sheetRow("mshrow mshnew", "plus", "Neue Session", () => { if (free) openK15Entwurf({ slot: free.id }); });
  neu.dataset.tool = "new";
  neu.disabled = !free;
  neu.title = free ? `Eine Session in Slot ${free.id} gründen` : "Alle 16 Plätze sind belegt";
  list.appendChild(neu);
  return [head, tray, list];
}
// MEHR (Konzept 2 §3): what this session and this device have beyond the strip's four — the
// Wecker among them (owner 2026-10-07: not in the menu); Modell und Effort live at their own
// button on the strip, so they are not here a second time
function toolsSheet(): HTMLElement[] {
  const pane = panes[focused];
  const slot = pane?.slot ?? 0;
  const s = slot ? fleet.find((x) => x.id === slot) : undefined;
  const head = el("div", "mshhead");
  const title = el("b", "", s?.cwd ? nameWithoutModel(s) : mtitle.textContent ?? "");
  title.id = "msheettitle";
  head.append(title);
  const body = el("div", "mshbody");
  const sec = (word: string) => body.appendChild(el("div", "mshsec", word));
  const corner = (sel: string) => pane?.root.querySelector<HTMLButtonElement>(`.panetools ${sel}`) ?? null;
  sec("Diese Session");
  body.appendChild(sheetRow("mshrow", "clock", "Wecker", () => $("autobtn").click()));
  body.appendChild(sheetRow("mshrow", "history", "Frühere Nachrichten", () => $("histbtn").click()));
  // Live is a touch affordance (index.html: #comptray > #live under any-pointer: coarse only)
  if (getComputedStyle(live).display !== "none") body.appendChild(sheetRow("mshrow", "keys", "Direkt ins Terminal tippen", () => live.click(), liveOn ? "an" : "aus"));
  const up = corner(".promptnav.up"), dn = corner(".promptnav.dn");
  if (pane?.isChat && up && dn) {
    const pair = el("div", "mshpair");
    pair.append(sheetRow("mshrow", "up", "Vorige Nachricht", () => up.click()), sheetRow("mshrow", "down", "Nächste Nachricht", () => dn.click()));
    body.appendChild(pair);
  }
  const hover = corner(".panehover");
  if (slot && hover) body.appendChild(sheetRow("mshrow", "search", "Verweise erklären", () => hover.click(), hover.getAttribute("aria-pressed") === "true" ? "an" : "aus"));
  const reload = corner(".panereload");
  if (pane && !pane.isChat && reload && reload.style.display !== "none") body.appendChild(sheetRow("mshrow", "reload", "Neu verbinden", () => reload.click()));
  // the harness's sendable commands (the composer's ⌘ switch) — today's ⋯ reached them too
  const cmds = compOpts.querySelector<HTMLButtonElement>(".optswrap.cmds .optsw");
  if (cmds) body.appendChild(sheetRow("mshrow", "list", "Befehle", () => cmds.click()));
  sec("Dieses Gerät");
  body.appendChild(sheetRow("mshrow", "width", "Schrift und Spalte", () => openSettings(mPill, "schrift")));
  const gear = sheetRow("mshrow", "gear", "Einstellungen", () => openSettings(mPill));
  gear.dataset.tool = "settings";
  body.appendChild(gear);
  return [head, body];
}
// what a built sheet shows, as one string: tags, attributes and text, read off the nodes (no HTML
// serialiser — the client has no HTML sink, fleet-e2e-security.ts §7)
const nodeSig = (n: Node): string => n instanceof Element
  ? `<${n.tagName}${[...n.attributes].map((a) => ` ${a.name}=${a.value}`).join("")}>${[...n.childNodes].map(nodeSig).join("")}</>`
  : n.textContent ?? "";
// painted on open, after every press that stays, and on each poll (updateTitle) — but only when
// what it shows moved, so a list under the finger is never rebuilt for nothing
function renderSheet(): void {
  if (!sheetOpen) return;
  const parts = sheetOpen === "sessions" ? sessionsSheet() : toolsSheet();
  const key = sheetOpen + parts.map(nodeSig).join("");
  if (key === sheetKey) return;
  sheetKey = key;
  const scroll = mSheet.querySelector(".mshbody")?.scrollTop ?? 0;
  mSheet.dataset.sheet = sheetOpen;
  mSheet.setAttribute("aria-labelledby", "msheettitle");
  mSheet.replaceChildren(...parts);
  const body = mSheet.querySelector(".mshbody");
  if (body) body.scrollTop = scroll;
}
if (vv) {
  let vvRefitTimer: ReturnType<typeof setTimeout> | undefined;
  let lastUnfocusedHeight = window.innerHeight;
  let lastViewportWidth = window.innerWidth;
  const sync = () => {
    if (isMobile()) document.documentElement.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
    else document.documentElement.style.removeProperty("--vvh");
    const focusedInput = document.activeElement === ta || document.activeElement === $("livein");
    const widthChanged = Math.abs(window.innerWidth - lastViewportWidth) > 2;
    if (!focusedInput || widthChanged) lastUnfocusedHeight = window.innerHeight;
    if (widthChanged) lastViewportWidth = window.innerWidth;
    const keyboardOpen = isMobile() && focusedInput
      && (window.innerHeight - vv.height > 120 || lastUnfocusedHeight - window.innerHeight > 120);
    if (!focusedInput) document.body.classList.remove("landwrite");
    document.body.classList.toggle("keyboard-open", keyboardOpen);
    // ⋯'s options (the phone on its side) fold away as the keyboard goes — only the keyboard's own
    // leaving closes them, not every sync without it
    if (!keyboardOpen && keyboardWasOpen) {
      document.body.classList.remove("keyboard-options");
      mobileMore.setAttribute("aria-expanded", "false");
    }
    keyboardWasOpen = keyboardOpen;
    window.scrollTo(0, 0);
    // the keyboard opening/closing and its predictive-text bar toggling fire several of
    // these in a burst while typing; settle before refitting so a mid-transition height
    // reading doesn't trigger a spurious /resize (and the server's redraw jiggle) on
    // every micro-wobble — this was blanking the active input line while composing
    clearTimeout(vvRefitTimer);
    vvRefitTimer = setTimeout(() => { for (const p of panes) p.refit(); }, 200);
  };
  vv.addEventListener("resize", sync);
  window.addEventListener("resize", sync);
  document.addEventListener("focusin", sync);
  document.addEventListener("focusout", () => requestAnimationFrame(sync));
  sync();
}

// mobile key row: terminal keys a virtual keyboard doesn't have (raw bytes over the WS)
const KEYS: Record<string, string> = {
  esc: "\x1b", tab: "\t", stab: "\x1b[Z", up: "\x1b[A", down: "\x1b[B",
  left: "\x1b[D", right: "\x1b[C", enter: "\r", cc: "\x03",
};
for (const b of document.querySelectorAll<HTMLButtonElement>("#keys button")) {
  b.addEventListener("pointerdown", (e) => e.preventDefault()); // don't steal focus / close the keyboard
  b.onclick = () => {
    const k = KEYS[b.dataset.k ?? ""];
    if (k) panes[focused]?.sendRaw(k);
  };
}

for (const b of document.querySelectorAll<HTMLButtonElement>("#layouts button"))
  b.onclick = () => {
    setLayout(LAYOUTS[b.dataset.l ?? "1"] ?? 1, panes.map((p) => p.slot));
    saveView();
  };

function saveView() {
  // `chats`: which panes show the conversation view — a reload used to land every pane back on the
  // terminal, and with it the composer's switches and cache counter were gone (seventeenth cut)
  prefSet("fleet.view", JSON.stringify({ layout, panes: panes.map((p) => p.slot), focused,
    chats: panes.map((p) => p.savedChat), hovers: panes.map((p) => p.savedHover) }));
}

// --- what the highlighted folder actually is (GET /api/dirinfo) ---
// The old picker could say "this is a git repo" and nothing more, so telling two similarly-named
// checkouts apart meant opening a session in one to find out.
interface DirCommit { hash: string; ts: number; subject: string }
export interface DirInfoResp {
  path: string; exists: boolean; git: boolean; worktree?: boolean; branch?: string | null;
  dirty?: number; ahead?: number | null; behind?: number | null;
  files?: { st: string; pfad: string }[];
  // its primary checkout has ci/merge-check.ts: a session on its own branch can land it (server/branch-land.ts)
  mergeCheck?: boolean;
  // the branch doors take this repo (server.ts#branchDoorTakes: a workplace repo, one a session works in)
  branches?: boolean;
  last?: DirCommit | null; recent?: DirCommit[];
  entries?: { name: string; dir: boolean }[]; entryTotal?: number; hidden?: number;
  lanes?: number; error?: string;
  // Gruendungsfenster B3, served for a git dir: the pack ids `.fleet/context-packs.json` declares
  // at this path's HEAD ([] = none — a manifest that cannot be read or parsed is the error shape,
  // never an empty list), and this repo's worktrees no slot holds — what the repo card shows and
  // the "vorhandener Worktree" role seats. Optional for a pre-B3 server.
  packs?: string[] | { error: string };
  orphans?: { path: string; branch: string }[];
}

// A 404 on a route this page KNOWS about means one specific thing in Fleet, and it is worth saying
// out loud rather than spinning: `bun run build` publishes the client instantly (the server serves
// public/app.js off disk), while new server ROUTES only exist after srv restarts. So a freshly built
// dashboard talks to a pre-change server until someone kills the srv session — and every call to a
// route added in the same change 404s. That is exactly what an indefinite "reading…" was.
export const SKEW_NOTE = "this page is newer than the server it is talking to — that route does not exist"
  + " there yet. Restart Fleet's srv session to pick up the new routes (the sessions survive it).";

export function labelled(text: string, control: HTMLElement): HTMLElement {
  const wrap = el("label", "pkdopt");
  wrap.appendChild(el("span", "pkdoptl", text));
  wrap.appendChild(control);
  return wrap;
}

// --- the file view: one renderer for every file list in the app ---------------------------------
//
// Four surfaces listed files and none of them could open one: the old picker's Contents, a commit's
// files, a land's footprint, and the board's changed-files card (whose rows all opened the WHOLE
// working diff, whichever row you clicked). They are the same gesture — "show me that file" — so
// they share this one function, and each caller supplies the two things only it knows: WHICH
// revision of the file it means, and what going back should return to.
//
// The honesty rule this window keeps: a file has more than one version, and the pane always says
// which one it is showing. A commit's file list is a statement about that commit; rendering
// today's bytes under it would answer a question nobody asked.
interface FileViewOpts {
  path: string;              // what to ask the server for (absolute, or repo-relative with rev)
  label: string;             // what to call it in the header
  repo?: string;             // required with rev
  rev?: string;              // absent = the file as it is on disk now
  source: string;            // one line naming WHICH version this is. Always shown.
  diff?: string;             // this file's hunk, when the caller already has it — adds the Change tab
  // WHICH session's working directory this file lives in. Opt-in, and absent means read-only:
  // the ✎ button exists only where a caller can name the slot whose cwd contains the file, which
  // is exactly the containment the write route enforces on its side. A commit's file view never
  // passes it — there is no editing a revision — so the gesture cannot appear where it is a lie.
  edit?: { slot: number };
  line?: number;
  // without a line: scroll to the first line that contains this text (the setup window opens settings.json at "hooks")
  find?: string;
  back?: { label: string; go: () => void };
  // a caller that draws its OWN head passes it here, and the default block (‹ back, label, path,
  // source) is not drawn: the explorer's tree stays beside the file, so ‹ back has nowhere to go
  head?: HTMLElement;
  facts?: HTMLElement;       // where "N lines · KB" goes; absent = under the text
  numbered?: boolean;        // a line-number gutter beside the text
}
type FileResp = { path?: string; rev?: string | null; size?: number; text?: string;
  binary?: boolean; truncated?: boolean; error?: string;
  // present iff the server is willing to be written back to (see editability(), server.ts) —
  // `hash` doubles as the conflict token, `noEdit` as the reason there is none
  hash?: string; noEdit?: string };

let fileSeq = 0; // latest-wins, like every other pane that follows a moving cursor

function showFileView(shell: Shell, o: FileViewOpts) {
  const seq = ++fileSeq;
  // whatever the previous file left armed goes with it — a guard belongs to a textarea that is
  // about to be replaced, and an orphaned one would make the window refuse to close for nothing
  shell.setCloseGuard(null);
  shell.detail.replaceChildren();
  if (o.head) shell.detail.appendChild(o.head);
  else {
    const goBack = o.back;
    if (goBack) {
      const back = el("button", "fvback", `‹ ${goBack.label}`);
      back.onclick = () => goBack.go();
      shell.detail.appendChild(back);
    }
    shell.detail.appendChild(el("div", "rvhead", o.label));
    shell.detail.appendChild(el("div", "pkdpath", o.path.replace(/^\/Users\/[^/]+/, "~")));
    shell.detail.appendChild(el("div", "fvsource", o.source));
  }
  const body = el("div", "fvbody");

  // the "view option": where a change EXISTS, it is the default — a file in a commit is interesting
  // for what the commit did to it. The whole file is one click away, never the other way round.
  let tab: "change" | "file" = o.diff ? "change" : "file";
  const tabs = el("div", "tabrow actlens");
  const paint = () => {
    for (const b of Array.from(tabs.children)) {
      const selected = (b as HTMLElement).dataset.tab === tab;
      b.classList.toggle("on", selected);
      b.setAttribute("aria-pressed", String(selected));
    }
    body.replaceChildren();
    if (tab === "change" && o.diff) {
      const box = el("div", "difftxt");
      renderDiffInto(box, o.diff);
      body.appendChild(box);
      return;
    }
    body.appendChild(el("div", "hint shellhint", "reading the file…"));
    void loadFile(o).then((r) => {
      if (!shell.isOpen() || seq !== fileSeq) return;
      body.replaceChildren();
      renderFileBody(shell, body, o, r, paint);
    });
  };
  if (o.diff) {
    for (const [k, text] of [["change", "What this changed"], ["file", "The whole file"]] as const) {
      const b = el("button", "shrbtn", text) as HTMLButtonElement;
      b.dataset.tab = k;
      b.onclick = () => { if (tab !== k) { tab = k; paint(); } };
      tabs.appendChild(b);
    }
    shell.detail.appendChild(tabs);
  }
  shell.detail.appendChild(body);
  paint();
  if (isMobile()) shell.showDetail(true);
}

async function loadFile(o: Pick<FileViewOpts, "path" | "repo" | "rev">): Promise<FileResp | null> {
  const q = new URLSearchParams({ path: o.path });
  if (o.rev && o.repo) { q.set("rev", o.rev); q.set("repo", o.repo); }
  const res = await api(`/api/file?${q.toString()}`).catch(() => null);
  if (!res) return { error: "couldn't reach the server" };
  if (res.status === 404 && !res.headers.get("content-type")?.includes("json")) return { error: SKEW_NOTE };
  return (await res.json().catch(() => null)) as FileResp | null;
}

function renderFileBody(shell: Shell, body: HTMLElement, o: FileViewOpts, r: FileResp | null, repaint: () => void) {
  shell.setCloseGuard(null); // the read view holds nothing unsaved; only the editor below arms it
  if (!r) { body.appendChild(el("div", "diffstat err", "the server's answer was not readable JSON")); return; }
  if (r.error) { body.appendChild(el("div", "diffstat err", r.error)); return; }
  if (r.binary) {
    body.appendChild(el("div", "hint shellhint",
      "this is a binary file — there is nothing to read as text, and showing the decode would be"
      + " noise, not content"));
    return;
  }
  const text = r.text ?? "";
  if (!text && !r.hash) { body.appendChild(el("div", "hint shellhint", "this file is empty")); return; }
  // EVERY file is shown as its own text, .md included. The tempting move is to run mdInto over
  // markdown — it has rendered real structure since 2026-09-11 and would look good here — and it
  // would still be wrong: a viewer is for reading what the file SAYS, and a rendered heading hides
  // the `##` that is the actual byte on disk. The chat view renders because a transcript is a
  // conversation; this one does not because a file is a source.
  const pre = el("div", "fvtext");
  pre.textContent = text || "(this file is empty)";
  // a final newline ends the last line, it does not start one — the count wc -l and an editor give
  const lineCount = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
  if (o.numbered && text) {
    // ONE text node for the whole gutter, not a row per line: a 512 KB file is ten thousand
    // lines, and the numbers only have to sit level with the text, which the shared line-height does
    const gut = el("div", "fvgut", Array.from({ length: lineCount }, (_, i) => String(i + 1)).join("\n"));
    gut.setAttribute("aria-hidden", "true");
    const box = el("div", "fvnum");
    box.append(gut, pre);
    body.appendChild(box);
  } else body.appendChild(pre);
  const found = o.find ? text.split("\n").findIndex((z) => z.includes(o.find!)) + 1 : 0;
  const line = o.line ?? (found || undefined);
  if (line) requestAnimationFrame(() => {
    const height = parseFloat(getComputedStyle(pre).lineHeight);
    if (Number.isFinite(height)) shell.detail.scrollTop = pre.offsetTop + (line - 1) * height - shell.detail.clientHeight / 3;
  });
  const facts: string[] = [];
  if (typeof r.size === "number") facts.push(`${(r.size / 1024).toFixed(1)} KB`);
  facts.push(`${lineCount} line${lineCount === 1 ? "" : "s"}`);
  if (o.facts) o.facts.textContent = facts.join(" · ");
  else body.appendChild(el("div", "diffstat", facts.join(" · ")));
  if (r.truncated) body.appendChild(el("div", "ocwarn",
    "this file is longer than the viewer serves — what is above is the beginning of it, not all of it"));
  // ── the third step of the stair: read → understand → change ────────────────────────────────
  // Editing is a SEPARATE click and always was the requirement ("Bearbeiten erst nach extra
  // Klick"). Nothing above changes when this button is absent, which is the normal case: a commit's
  // revision, a file the server declined to hand an editable hash for, a caller that named no slot.
  if (!o.edit) return;
  if (!r.hash) {
    if (r.noEdit) body.appendChild(el("div", "hint shellhint", `not editable here — ${r.noEdit}`));
    return;
  }
  const slot = o.edit.slot;
  const hash = r.hash;
  const editBtn = el("button", "shrbtn fvedit", "✎ edit this file") as HTMLButtonElement;
  editBtn.onclick = () => openFileEditor(shell, body, { slot, path: o.path, text, hash }, repaint);
  body.appendChild(editBtn);
}

// The editor. A textarea, a save, and a cancel — deliberately not a code editor: "simpel aber
// robust" was the brief, and 6,700 lines of client.ts do not need a CodeMirror to change one line
// of a config file. What it DOES take seriously is the two ways an edit here can destroy work:
//   · the window closing on top of it (setCloseGuard, armed while there is anything unsaved)
//   · an agent in the same lane having written the file since it was read — the server refuses on
//     the hash, and this pane keeps your text so the refusal costs a re-read, not the edit
function openFileEditor(shell: Shell, body: HTMLElement,
  f: { slot: number; path: string; text: string; hash: string }, repaint: () => void) {
  body.replaceChildren();
  // an edit lands in a directory an agent may be building in RIGHT NOW. The board knows whether
  // that session is working, so it says so instead of letting the reader find out from a conflict.
  if (sessionActive(f.slot)) body.appendChild(el("div", "ocwarn",
    "this session is working right now — it may write this same file while you type, and the save"
    + " will then be refused rather than overwrite it"));
  const ta = el("textarea", "fvedit-ta") as HTMLTextAreaElement;
  ta.value = f.text;
  ta.spellcheck = false;
  const foot = el("div", "fveditfoot");
  const state = el("span", "diffstat", "");
  const save = el("button", "shrbtn primary", "Save") as HTMLButtonElement;
  const cancel = el("button", "shrbtn", "Cancel") as HTMLButtonElement;
  const err = el("div", "diffstat err", "");
  err.style.display = "none";
  const dirty = () => ta.value !== f.text;
  const paintState = () => {
    state.textContent = `${ta.value.split("\n").length} lines${dirty() ? " · unsaved changes" : ""}`;
    save.disabled = !dirty();
  };
  const leave = () => { shell.setCloseGuard(null); repaint(); };
  const tryLeave = () => {
    if (dirty() && !confirm("Discard your changes to this file?")) return;
    leave();
  };
  // Armed for as long as the editor is open. It always CONSUMES the gesture — Escape/✕/backdrop
  // step out of the EDITOR, back to reading the same file, which is one step back rather than
  // two; a second Escape then closes the window for real. This is also the ONLY Escape handling
  // the editor has: the shell listens in the capture phase on `document`, so it runs before the
  // textarea either way, and a second handler down there would ask "discard?" twice.
  shell.setCloseGuard(() => { tryLeave(); return true; });
  const doSave = async () => {
    save.disabled = true;
    err.style.display = "none";
    const res = await post("/api/file/write", { slot: f.slot, path: f.path, text: ta.value, baseHash: f.hash });
    const d = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      err.textContent = d?.error ?? `the server refused this save (${res.status})`;
      err.style.display = "";
      paintState(); // your text stays in the box — a refused save must never also lose the edit
      return;
    }
    // re-read rather than trust the echo: the file view's whole contract is that it shows what is
    // on disk, and after a write the freshest statement about that is a fresh read
    leave();
  };
  ta.oninput = paintState;
  ta.onkeydown = (e) => {
    if (e.key === "s" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.stopPropagation(); if (dirty()) void doSave(); }
  };
  save.onclick = () => void doSave();
  cancel.onclick = () => { tryLeave(); };
  foot.append(state, save, cancel);
  body.append(ta, foot, err);
  paintState();
  ta.focus();
}

export async function revealStartedSlot(slot: number): Promise<boolean> {
  const deadline = Date.now() + 4500;
  do {
    await refresh();
    if (showSlot(slot)) return true;
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  return false;
}

// --- sidebar ---
export function baseName(p: string) {
  const parts = p.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || "/";
}

// "this slot holds a session" as a type, so the row builders below never have to assert it
type ActiveSlot = SlotInfo & { cwd: string };
const isActive = (s: SlotInfo): s is ActiveSlot => !!s.cwd;

// A LANE'S ONE ADDRESS. The owner-confirmed model (docs/messungen/2026-09-18-slot-system-und-linke-leiste.md
// §3.1, "ok" 2026-09-19): a band is a slot number, a lane hangs on the band of the main it came
// from, and it is CALLED after that band — 3A, 3B, 16B. That name is its only name in the bar, so
// the branch suffix that used to stand here is gone from the row and lives in the tooltip with the
// rest of the git facts. A lane with no band at all (no live anchor: recycled, wrong-repo, born
// parentless) collects on band 0 as 0A, 0B — derived from the same model rather than inventing a
// second address form (docs/messungen/2026-09-20-session-marke-entwurf.md §6).
//
// Unique by construction, which is the property the old suffix rule had to iterate for: the band is
// a slot number and the letter counts within that one band. Pure and DOM-free so the rule can be
// exercised directly; both orderings are by id, so the map is deterministic.
const bandLetter = (i: number): string => i < 26
  ? String.fromCharCode(65 + i)
  : bandLetter(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
export function laneBandNames(
  stacks: readonly { anchor: { id: number } | null; lanes: readonly { id: number; worktree?: { letter?: string } | null }[] }[],
): Map<number, string> {
  const out = new Map<number, string>();
  const bandless: { id: number; worktree?: { letter?: string } | null }[] = [];
  for (const g of [...stacks].sort((a, b) => (a.anchor?.id ?? 0) - (b.anchor?.id ?? 0))) {
    if (!g.anchor) { bandless.push(...g.lanes); continue; }
    const band = g.anchor.id;
    [...g.lanes].sort((a, b) => a.id - b.id).forEach((l, i) => {
      // THE STORED LETTER IS THE NAME: server.ts assigned it once at open, so a neighbour's land or
      // a srv restart cannot shift it. The positional run survives only for lanes that predate the
      // field — an older state row, or an older loader that never copied the field across a boot.
      const stored = l.worktree?.letter;
      out.set(l.id, `${band}${typeof stored === "string" && stored ? stored : bandLetter(i)}`);
    });
  }
  bandless.sort((a, b) => a.id - b.id).forEach((l, i) => {
    const stored = l.worktree?.letter;
    out.set(l.id, `0${typeof stored === "string" && stored ? stored : bandLetter(i)}`);
  });
  return out;
}

// WHAT A LANE IS CALLED IN WORDS. A task lane the server could derive a title for is called by that
// title, cut to ~32 characters — in place of the label the dispatcher wrote from its branch
// ("⎇ task <slug>-<hex>", "⎇ <repo> <hex>"), which the owner could not read (37439a62, cdf43028).
// A label someone gave it by hand starts with no ⎇ and stays; a lane with no title stays as it was.
export function laneLabel(s: SlotInfo): string {
  const label = s.label ?? baseName(s.cwd ?? "");
  return s.worktree && s.taskTitle && (!s.label || s.label.startsWith("⎇ ")) ? shortTitle(s.taskTitle) : label;
}
// a lane named from its BRANCH (a land, an undo): "<Lane-Referenz> · <Kurztitel>" while a slot still
// holds that branch and has a title, otherwise the four hex as before
export function laneNameOfBranch(branch: string): string {
  const s = fleet.find((x) => x.cwd && x.worktree?.branch === branch);
  const ref = s ? laneBandNames(stacksOf()).get(s.id) : undefined;
  return ref && s?.taskTitle ? laneDisplayName(ref, s.taskTitle) : laneTail(branch);
}

// THE FOUR STATES A ROW MUST TELL APART WITHOUT COLOUR (owner, the left-bar card: working, resting,
// asleep, broken). The shapes are in the CSS; what is decided here is which one a row is in, and the
// order matters — a broken session that happens to be on screen is broken first. Resting and asleep
// are one fact read at two distances: a session that produced nothing for half an hour is not the
// same thing as one that paused between two answers, and the bar had no way to say so.
const SLEEP_MS = 30 * 60_000;
type OutputState = "work" | "rest" | "sleep" | "bad";
function codexTurnOf(s: SlotInfo): SlotInfo["codexFirstTurn"] {
  const hit = s.codexFirstTurn;
  return hit && hit.openedAt === s.openedAt && hit.sessionId === s.codexRecovery?.sessionId ? hit : null;
}
function codexTurnLine(s: SlotInfo): string {
  const hit = codexTurnOf(s);
  if (!hit) return "Erster Modellturn unbekannt — kein passender strukturierter Turn-Beleg";
  const t = hit.turn;
  const word = { running: "angenommen, läuft", succeeded: "erfolgreich", failed: "fehlgeschlagen", unknown: "Ergebnis unbekannt" }[t.state];
  return `Erster Modellturn ${word}${t.error ? `: ${t.error.code ? t.error.code + " · " : ""}${t.error.message}` : ""}`
    + (t.unknownReason ? `\nGrund: ${t.unknownReason}` : "")
    + `\nQuelle: ${hit.source} · Ereignis ${new Date(t.completedAt ?? t.acceptedAt ?? hit.observedAt).toLocaleString()}`
    + ` · beobachtet ${new Date(hit.observedAt).toLocaleString()}`;
}
function outputState(s: SlotInfo, now: number, awake: boolean): OutputState {
  if (s.stalled || s.agent === "no-agent" || s.agent === "no-pane" || codexTurnOf(s)?.turn.state === "failed"
    || codexTurnOf(s)?.turn.error) return "bad";
  if (awake || now - s.lastOutput < RECENT_MS) return "work";
  return now - s.lastOutput >= SLEEP_MS ? "sleep" : "rest";
}
// THE FIFTH READING: a session that waits on someone (`awaiting`, a server fact — an open
// clarification sets "main", a clarify lane "owner") says so on its row, not only in the hover card
// (the Theo threads measurement of 2026-10-02, K5). It ranks after broken and before the
// output's freshness: a waiting session on screen still waits. The value is the glyph's class list —
// the owner's case is the same shape plus the one colour that means „[Zitat entfernt]“ (grammatik
// G0.2), so every reader of slotState/STATE_WORD gets both without a second branch.
export type SlotState = OutputState | "wait" | "wait owner";
export function slotState(s: SlotInfo, now: number, awake: boolean): SlotState {
  const out = outputState(s, now, awake);
  if (out === "bad") return out;
  // a permission question waits on a person, whatever the output's freshness says (UI-Abnahme 22.10.: the board said
  // „arbeitet“ and showed a green dot while the session stood on it)
  if (s.rueckfrage || s.vertrauen) return "wait owner";
  if (!s.awaiting) return out;
  return s.awaiting === "owner" ? "wait owner" : "wait";
}
// The shape is the reading; this is the same reading in words, for the tooltip and for anyone who
// has to name the state out loud. Not decoration: a shape nobody can name is a shape nobody learns.
export const STATE_WORD: Record<SlotState, string> = {
  work: "arbeitet", rest: "ruht", sleep: "schläft — seit einer halben Stunde oder länger nichts",
  bad: "kaputt — hängt, oder eine Pane ohne Agent dahinter",
  wait: "wartet auf MAIN", "wait owner": "wartet auf dich" };

// "how long since this session last said anything", short enough for a 250px line. Takes the AGE,
// not a timestamp: the caller has the server's clock and the client's is allowed to disagree with
// it. Whole minutes, so the string is stable between two polls — the sidebar's render key is keyed
// on what is PAINTED, and a seconds-resolution age here would rebuild the bar on every tick.
function sinceShort(ageMs: number): string {
  const min = Math.max(0, Math.round(ageMs / 60000));
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

// --- project colour: one hue per checkout, derived, never stored ---------------------------------
// "which project is this" was only answerable by reading a path. Now every session and lane of the
// same checkout carries the same pastel hue. Derived from the canonical repo path — a lane inherits
// its main repo's colour through worktree.repo — so it survives reload, restart and re-slotting with
// no state that could go stale or need migrating. The hue is the ONLY thing computed here;
// saturation and lightness live in one place in the CSS (--proj-s/--proj-l), which is the whole
// knob if this app ever grows a second palette. It has ONE today: there is no light theme, no
// prefers-color-scheme block and no theme toggle anywhere in the client (verified 2026-08-06).
//
// The owner poll carries the canonical toplevel from its slow git cache, so a main opened in a
// subdirectory is still the same project. Optional fallback preserves the older-server display:
// before `repo` existed, cwd was the only honest key available.
function projectOf(s: SlotInfo): string | null {
  if (!s.cwd) return null;
  return s.repo ?? s.worktree?.repo ?? s.cwd;
}
// Eight hues, not a continuum, and this is the one place §F2's recommendation was overruled — by
// looking at it. A hash spread over all 360° is uniform, which is NOT the same as far apart: the
// first two-repo fixture drew 260° and 236°, and rendered they were the same pale lavender twice.
// §F2 says collisions are acceptable ("kollisionsfrei muss es nicht sein"); it does not say
// near-misses are, and a near-miss is the worse of the two — two colours that are the same shade
// but not the same colour tell you nothing while looking like they mean something. So: quantize.
// Distinct projects are now 45° apart minimum and unmistakable; two projects CAN share a colour,
// which reads as "same project" and is the failure §F2 already accepted. The wheel positions skip
// the muddy yellow-brown band that turns grey against #141414. The function itself lives in
// src/marks.ts#projectHue since the session mark's species IS this hue's index — one identity.
function tintProject(node: HTMLElement, key: string | null) {
  if (!key) return;
  node.style.setProperty("--proj-h", String(projectHue(key)));
  node.classList.add("proj");
}

// --- slot stacks (F3): lanes fold under their persisted main-session identity -------------------
// Creation persists the one owner relationship; rendering only joins it. No cwd, label or output
// can re-parent a lane later. A missing/dead/recycled/cross-repo anchor is not repaired here — those
// lanes share the truthful repo-header stack until their own lifecycle ends.
interface Stack {
  key: string;                // canonical repo path — also the project-colour key
  foldKey: string;            // distinct only when one repo has multiple simultaneous stacks
  anchor: ActiveSlot | null;  // exact {slot, openedAt} match; null = truthful orphan stack
  lanes: ActiveSlot[];
  at: number;                 // the fixed slot position the whole stack renders at
}
// Open/closed per device, on purpose (§F3): a phone and a desktop are allowed to disagree about
// what is unfolded. DEFAULT IS OPEN, and the store holds the DEVIATION — the stacks this device
// was told to fold — not the permission to show. The old store held the opposite (the open ones,
// default closed), which made every fresh browser hide every lane until someone clicked: "[Zitat entfernt]" (owner, 2026-09-20). A new key rather than a migration,
// because the old list cannot be read as the new one: a stack missing from it meant CLOSED there
// and means OPEN here. The legacy key is dropped on the first write so it cannot rot in place.
const stackClosed = new Set<string>(((): string[] => {
  const v: unknown = prefJSON<unknown>("fleet.stacks.closed");
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
})());
const stackIsOpen = (foldKey: string): boolean => !stackClosed.has(foldKey);
function setStackOpen(g: Stack, on: boolean) {
  if (on) stackClosed.delete(g.foldKey);
  else stackClosed.add(g.foldKey);
  prefSet("fleet.stacks.closed", JSON.stringify([...stackClosed]));
  prefSet("fleet.stacks", null); // the legacy key dies on the first write so it cannot rot in place
  renderSlots();
}

// THE BAND — a row you pull back through its own past (owner 2026-09-21: „[Zitat entfernt]“
// 
// ; rounds 4–10 chose every value below, each
// driven over CDP in docs/design/sidebar/leiste-mess/band-zieh.js before it came here).
//
// A row whose line has handed over at least once (`s.succession.session > 1`) is a track of cells:
// its past sessions to the left, the running one — the ordinary line 1 — at the right end. Pulling
// the row to the RIGHT goes back in time; the session it rests on opens in the pane that shows this
// slot, read-only, from GET /api/slots/:id/succession/:n/transcript. Back on the running session,
// the pane is the terminal (or chat) it was.
//  · THE HINT is one 2px sliver on the row's edge (Fassung A, "Kante"): left while the present
//    shows — a past lies under it — right while a past session shows. Nothing else is permanent.
//  · ONE STROKE, ONE SESSION (owner 18.10.: „[Zitat entfernt]“):
//    press to release goes at most one session, and nothing moves without a pressed button.
//  · THE MOUSE ("weich") never carries the row: it leans, damped and capped at 28 % of the row, and
//    past 40 px of pull the next session snaps in with a soft overshoot; after that the stroke is
//    spent and the row rests until the button comes up.
//  · TRACKPAD AND FINGER (round 5): a 7 px dead zone, then horizontal or vertical is decided once;
//    the row follows 1:1 up to one cell; release switches by distance OR speed; a swipe commits a
//    third across and swallows the rest of its momentum; a press grabs the row where the eye sees
//    it; no click fires after a drag. ← → Home End Esc Enter on focus.
//  · THE HOLD is the pointer capture: it starts when the row takes the capture and ends exactly once,
//    when the browser takes it away (after pointerup, pointercancel or anything else). A second
//    finger while one holds is ignored — it used to replace the first, whose release was then
//    dropped, and the sidebar never rebuilt again (Mangel 126: the highlight stood on a slot the
//    owner had long left).
//  · THE DOTS show only on hover, focus, while pulling and for a moment after a step; past eight
//    sessions they are a window of seven with a small end dot.
//  · DEPTH is how far back a row reaches, read in ONE place (bandReach) — the device setting
//    fleet.bandDepth (alle / 3 / 5, owner 2026-09-21: „[Zitat entfernt]“); the route
//    still sends the whole line. The row and the dots count the capped depth, the pane the real number.
// WHICH past session is shown lives in ONE place, the pane (Pane#pastN): the sidebar is rebuilt on
// the poll, and a row built fresh reads its position from the pane that shows its slot — through a
// percentage transform, so no width has to be measured to draw it. While a gesture runs the
// sidebar is not rebuilt at all (renderSlots, bandGesture), or the row would vanish under the hand.
const bandDepth = (): number => { const v = Number(prefText("fleet.bandDepth")); return v > 0 ? v : Infinity; };
const bandReach = (session: number): number => Math.min(session - 1, bandDepth());
const BAND_SLOP = 7, BAND_COMMIT = 0.2, BAND_FLICK = 0.35, BAND_SWIPE_COMMIT = 0.33;
const BAND_WHEEL_IDLE = 90, BAND_MOMENTUM_GAP = 180, BAND_SNAP_MS = 340;
const BAND_MOUSE = { T: 40, k: 0.8, cap: 0.28, ms: 380 };
const BAND_DOTS = 7, BAND_STEPPED_MS = 1200;
const bandStill = matchMedia("(prefers-reduced-motion: reduce)");
let bandGesture = 0; // > 0 while a pointer or a swipe holds a band; renderSlots waits for it
let slotsDirty = false;

// The line's past, from its own route (never the 2 s poll: its budget is rationed), asked once per
// (slot, occupant, session) and kept. A failed read is remembered as failed, not retried per poll.
interface SuccessionPast { session: number; startedAt: number | null; handedAt: number | null;
  report: string | null; ctx: { usedTokens: number; windowTokens: number; pct: number } | null }
const successionPast = new Map<string, SuccessionPast[] | "pending" | "failed">();
function successionPastFor(s: ActiveSlot, session: number): SuccessionPast[] | "pending" | "failed" {
  const key = `${s.id}:${s.openedAt ?? 0}:${session}`;
  const have = successionPast.get(key);
  if (have) return have;
  successionPast.set(key, "pending");
  api(`/api/slots/${s.id}/succession`)
    .then((r) => r.ok ? r.json() as Promise<{ past?: SuccessionPast[] }> : null)
    .then((j) => { successionPast.set(key, j?.past ?? "failed"); renderSlots(); })
    .catch(() => { successionPast.set(key, "failed"); renderSlots(); });
  return "pending";
}
const whenLong = (t: number | null): string => t === null ? "nicht aufgezeichnet" : new Date(t).toLocaleString();
// a past cell's time: the clock alone when it is from today, the date alone otherwise — the full
// stamp took the width the session's name needs
const whenCell = (t: number): string => new Date(t).toDateString() === new Date().toDateString()
  ? new Date(t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
  : new Date(t).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
const ctxLine = (c: { usedTokens: number; windowTokens: number; pct: number }): string =>
  `${c.usedTokens.toLocaleString()} von ${c.windowTokens.toLocaleString()} Tokens (${c.pct} %)`;

// open session `n` of slot `id` in the pane that shows it — or the running one when n is null
function openBandSession(id: number, n: number | null) {
  let pane = panes.find((p) => p.slot === id);
  if (!pane && n === null) return;
  if (!pane) { showSlot(id); pane = panes.find((p) => p.slot === id); }
  pane?.showPast(n, true);
}

// Turn a finished line 1 into the band's right end. `row` keeps line 1's place; everything else
// the row carries (the Codex line, the hover strip) stays where it was, outside the track.
function bandify(row: HTMLElement, r1: HTMLElement, s: ActiveSlot, session: number) {
  const reach = bandReach(session);
  if (reach < 1) return;
  const first = session - reach; // the session number of the leftmost cell
  const n = reach + 1;
  const shownPast = panes.find((p) => p.slot === s.id)?.pastN ?? null;
  let idx = shownPast !== null && shownPast >= first && shownPast < session ? shownPast - first : n - 1;
  row.classList.add("pull");
  const view = el("div", "bandview");
  view.tabIndex = 0;
  const track = el("div", "bandtrack");
  const past = successionPastFor(s, session);
  const addr = r1.querySelector(".n, .laneref");
  for (let k = 0; k < reach; k++) {
    const num = first + k;
    const p = typeof past === "string" ? null : past.find((x) => x.session === num) ?? null;
    // the same order as line 1: the mark's place, the address, the name
    const c = el("div", "r1 pastcell");
    c.appendChild(el("span", "mark"));
    if (addr) c.appendChild(addr.cloneNode(true));
    c.appendChild(el("span", "lbl", `Session ${num}`));
    if (p?.startedAt) c.appendChild(el("span", "when", whenCell(p.startedAt)));
    if (p?.ctx) {
      const cx = el("span", "ctxfill", `${Math.round(p.ctx.pct)}%`);
      cx.title = `Kontext beim Übergeben — ${ctxLine(p.ctx)}`;
      c.appendChild(cx);
    }
    c.title = `Session ${num} von ${session}\nbegann ${whenLong(p?.startedAt ?? null)}\nübergab ${whenLong(p?.handedAt ?? null)}`
      + (p?.report ? `\nÜbergabe-Report ${p.report}` : "")
      + (past === "failed" ? "\ndie Linie konnte nicht gelesen werden" : past === "pending" ? "\nlädt…" : "")
      + "\nKlick oder loslassen zeigt ihr Transkript — nur lesend";
    track.appendChild(c);
  }
  r1.replaceWith(view);
  track.appendChild(r1);
  view.appendChild(track);
  const depth = el("div", "depth");
  row.appendChild(depth);

  let W = 0, frame = 0, want = 0, snapEnd = 0;
  const put = (dx: number, spring: boolean, mouse = false) => {
    track.classList.toggle("snap", spring);
    track.classList.toggle("mouse", spring && mouse);
    want = dx;
    if (spring) snapEnd = performance.now() + (bandStill.matches ? 0 : mouse ? BAND_MOUSE.ms : BAND_SNAP_MS);
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      track.style.transform = `translate3d(calc(${-idx * 100}% + ${want}px), 0, 0)`;
    });
  };
  // where the eye sees the band right now, relative to the resting cell — a press mid-spring grabs
  // it THERE, not at the target
  const seen = (): number => new DOMMatrix(getComputedStyle(track).transform).m41 + idx * W;
  // past either end, and past one cell anywhere, the band gives, but less and less
  const resist = (d: number): number => {
    const free = (idx === n - 1 && d < 0) || (idx === 0 && d > 0) ? 0 : W;
    return Math.abs(d) <= free ? d
      : Math.sign(d) * (free + W * 0.18 * (1 - Math.exp(-(Math.abs(d) - free) / (W * 0.5))));
  };
  const paintDepth = () => {
    depth.replaceChildren();
    const from = n <= BAND_DOTS ? 0 : Math.max(0, Math.min(n - BAND_DOTS, idx - (BAND_DOTS >> 1)));
    const to = Math.min(n, from + BAND_DOTS);
    for (let k = from; k < to; k++) {
      const more = (k === from && from > 0) || (k === to - 1 && to < n);
      depth.appendChild(el("i", k === idx ? "on" : more ? "more" : ""));
    }
  };
  let stepT: ReturnType<typeof setTimeout> | undefined;
  const paint = (stepped: boolean) => {
    row.classList.toggle("back", idx < n - 1);
    paintDepth();
    if (!stepped) return;
    row.classList.add("stepped");
    clearTimeout(stepT);
    stepT = setTimeout(() => row.classList.remove("stepped"), BAND_STEPPED_MS);
  };
  const go = (i: number, mouse = false) => {
    const to = Math.max(0, Math.min(n - 1, i)), moved = to !== idx;
    idx = to;
    put(0, true, mouse);
    paint(moved);
    if (moved) openBandSession(s.id, idx === n - 1 ? null : first + idx);
  };
  // distance OR speed: a fifth of a row or a flick of BAND_FLICK px/ms goes one step in the direction
  // of travel — one step, however far the stroke went
  const decide = (d: number, v: number): number =>
    Math.abs(d) > W * BAND_COMMIT || (Math.abs(v) > BAND_FLICK && Math.sign(v) === Math.sign(d)) ? (d > 0 ? -1 : 1) : 0;
  const speed = (smp: [number, number][]): number => {
    const now = smp[smp.length - 1], old = smp.find((x) => now[0] - x[0] <= 80) ?? smp[0];
    return now[0] > old[0] ? (now[1] - old[1]) / (now[0] - old[0]) : 0;
  };
  const release = () => {
    bandGesture = Math.max(0, bandGesture - 1);
    if (!bandGesture && slotsDirty) setTimeout(() => { if (!bandGesture) renderSlots(); }, bandStill.matches ? 0 : BAND_MOUSE.ms);
  };

  let g: { id: number; x0: number; y0: number; from: number; dir: "x" | "y" | null; mouse: boolean;
    s: [number, number][]; stepped?: boolean } | null = null;
  let held = false;
  let swallowClick = false;
  view.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || held) return;
    W = view.clientWidth;
    const mouse = e.pointerType === "mouse";
    // a finger grabs the band where the eye sees it; the mouse lets a running snap land first
    const from = mouse ? 0 : seen();
    if (!mouse) put(from, false);
    g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, from, dir: null, mouse, s: [[e.timeStamp, e.clientX]] };
  });
  // the mouse leans the row, it never carries it: past T px the next session snaps in, and the stroke
  // is spent. A press during a running snap counts its pull from where that snap lands.
  const lean = (cx: number) => {
    if (!g || g.stepped) return;
    if (performance.now() < snapEnd) { g.x0 = cx; return; }
    const raw = cx - g.x0, can = raw > 0 ? idx > 0 : idx < n - 1;
    if (can && Math.abs(raw) >= BAND_MOUSE.T) { g.stepped = true; go(idx + (raw > 0 ? -1 : 1), true); return; }
    const cap = W * BAND_MOUSE.cap * (can ? 1 : 0.35);
    put(Math.sign(raw) * cap * (1 - Math.exp(-BAND_MOUSE.k * Math.abs(raw) / cap)), false);
  };
  view.addEventListener("pointermove", (e) => {
    if (!g || e.pointerId !== g.id) return;
    // a release the band never heard of (outside the window, a menu that ate it) ends the stroke here
    if (g.mouse && e.buttons === 0) {
      end(e, true);
      if (view.hasPointerCapture(e.pointerId)) view.releasePointerCapture(e.pointerId);
      return;
    }
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.dir) {
      if (Math.hypot(dx, dy) < BAND_SLOP) return;
      g.dir = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (g.dir === "y") { put(0, true); g = null; return; }
      if (!g.mouse) g.x0 += Math.sign(dx) * BAND_SLOP; // the mouse counts its pull from the press
      view.setPointerCapture(e.pointerId);
      if (!view.hasPointerCapture(e.pointerId)) { put(0, true); g = null; return; }
      held = true;
      row.classList.add("dragging");
      bandGesture++;
    }
    g.s.push([e.timeStamp, e.clientX]);
    if (g.s.length > 12) g.s.shift();
    if (g.mouse) { lean(e.clientX); return; }
    put(resist(g.from + e.clientX - g.x0), false);
  });
  const end = (e: PointerEvent, cancelled: boolean) => {
    if (!g || e.pointerId !== g.id) return;
    const was = g;
    g = null;
    if (!was.dir) { put(0, true); return; } // a plain click: the row's own onclick handles it
    swallowClick = true;
    setTimeout(() => { swallowClick = false; }, 0);
    if (cancelled) put(0, true, was.mouse);
    else if (was.mouse) {
      // a stroke that stepped is spent; under the threshold only a flick still switches, otherwise
      // the lean springs back
      const v = speed(was.s), raw = e.clientX - was.x0;
      const flick = !was.stepped && Math.abs(v) > BAND_FLICK && Math.sign(v) === Math.sign(raw);
      if (flick || (!was.stepped && performance.now() >= snapEnd)) go(idx + (flick ? (raw > 0 ? -1 : 1) : 0), true);
    } else go(idx + decide(was.from + e.clientX - was.x0, speed(was.s)));
  };
  view.addEventListener("pointerup", (e) => end(e, false));
  view.addEventListener("pointercancel", (e) => end(e, true));
  view.addEventListener("lostpointercapture", (e) => {
    // a finger's implicit capture sits on the cell under it and is lost the moment the view takes it
    if (e.target !== view) return;
    if (g && e.pointerId === g.id) end(e, true);
    if (!held) return;
    held = false;
    row.classList.remove("dragging");
    release();
  });
  view.addEventListener("click", (e) => { if (swallowClick) { e.stopPropagation(); e.preventDefault(); } }, true);

  // a sideways trackpad swipe: the row follows the fingers; it commits the moment it is a third
  // across, and whatever momentum the swipe still carries is swallowed until the events pause
  let w: { d: number; s: [number, number][]; t?: ReturnType<typeof setTimeout> } | null = null;
  let lockUntil = 0;
  const wheelEnd = () => {
    if (!w) return;
    const d = w.d, v = speed(w.s.length ? w.s : [[0, 0]]);
    w = null;
    lockUntil = performance.now() + BAND_MOMENTUM_GAP;
    try { go(idx + decide(d, v)); } finally { release(); }
  };
  view.addEventListener("wheel", (e) => {
    const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.5 && Math.abs(e.deltaX) >= 1;
    if (e.timeStamp < lockUntil) {
      if (sideways || w) { e.preventDefault(); lockUntil = e.timeStamp + BAND_MOMENTUM_GAP; }
      return;
    }
    if (!w) {
      if (!sideways) return;
      W = view.clientWidth;
      w = { d: seen(), s: [] };
      bandGesture++;
    }
    e.preventDefault();
    w.d -= e.deltaX;
    w.s.push([e.timeStamp, w.d]);
    if (w.s.length > 12) w.s.shift();
    put(resist(w.d), false);
    clearTimeout(w.t);
    if (Math.abs(w.d) > W * BAND_SWIPE_COMMIT) { wheelEnd(); return; }
    w.t = setTimeout(wheelEnd, BAND_WHEEL_IDLE);
  }, { passive: false });
  view.addEventListener("keydown", (e) => {
    const to = ({ ArrowLeft: idx - 1, ArrowRight: idx + 1, Home: 0, End: n - 1, Escape: n - 1 } as Record<string, number>)[e.key];
    if (e.key === "Enter") { e.preventDefault(); showSlot(s.id, e.timeStamp); return; }
    if (to === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    go(to, true);
  });
  track.style.transform = `translate3d(${-idx * 100}%, 0, 0)`;
  paint(false);
}

// Which stacks exist right now. A repo with no lanes is NOT a stack — a lone session stays the
// plain row it always was, and nothing gets a fold arrow that has nothing to fold. More than one
// main in a repo can each own lanes, so the result is a list rather than one repo-keyed bucket.
export function stacksOf(): Stack[] {
  const mains = new Map<string, ActiveSlot>();
  for (const s of fleet) {
    if (!isActive(s) || s.worktree || !Number.isFinite(s.openedAt) || (s.openedAt ?? 0) <= 0) continue;
    mains.set(`${s.id}:${s.openedAt}`, s);
  }

  const anchored = new Map<string, Stack>();
  const orphans = new Map<string, Stack>();
  for (const lane of fleet) {
    if (!isActive(lane) || !lane.worktree) continue;
    const key = lane.worktree.repo;
    const identity = normalizeLaneAnchor(lane.worktree.anchor);
    const main = identity ? mains.get(`${identity.slot}:${identity.openedAt}`) : undefined;
    // Identity alone is necessary but not sufficient: malformed/legacy state can point across
    // repositories. `repo` is canonical; cwd is only the older-server fallback for a root main.
    const sameRepo = !!main && projectOf(main) === key;
    if (sameRepo) {
      const groupKey = `${key}\n${identity!.slot}:${identity!.openedAt}`;
      let g = anchored.get(groupKey);
      if (!g) {
        g = { key, foldKey: key, anchor: main, lanes: [], at: main.id };
        anchored.set(groupKey, g);
      }
      g.lanes.push(lane);
    } else {
      let g = orphans.get(key);
      if (!g) {
        g = { key, foldKey: key, anchor: null, lanes: [], at: lane.id };
        orphans.set(key, g);
      }
      g.lanes.push(lane);
    }
  }

  const out = [...anchored.values(), ...orphans.values()];
  for (const g of out) {
    g.lanes.sort((a, b) => a.id - b.id);
    if (!g.anchor) g.at = g.lanes[0]!.id;
  }
  const byRepo = new Map<string, Stack[]>();
  for (const g of out) {
    const groups = byRepo.get(g.key) ?? [];
    groups.push(g);
    byRepo.set(g.key, groups);
  }
  for (const [key, groups] of byRepo) {
    groups.sort((a, b) => a.at - b.at);
    // Preserve the old per-repo fold key in the normal one-stack case. Only simultaneous stacks
    // need generation-qualified local UI state; ownership itself remains the persisted anchor.
    if (groups.length > 1) {
      for (const g of groups) g.foldKey = g.anchor
        ? `${key}\n${g.anchor.id}:${g.anchor.openedAt}`
        : `${key}\norphan`;
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

// LABEL AND ROLE, SEPARATELY (Befund Portfolio-Koordination, 2026-10-05): the label is what the
// owner typed, the role is what the server makes of it (server.ts#positionRole) — an "Orchestrator"
// label on a bound Program-MAIN is a MAIN, and on a lane it is a lane.
const ROLE_WORD: Record<NonNullable<SlotInfo["role"]> | "lane" | "generic", string> = {
  "program-main": "Program-MAIN", orchestrator: "Orchestratorin", lane: "Lane", generic: "keine (Session)",
};
function roleLine(s: SlotInfo): string {
  const role = s.role ?? (s.worktree ? "lane" : "generic");
  return `Label: ${s.label ? `„${s.label}“` : "— (Ordnername)"} · Rolle: ${ROLE_WORD[role]}`;
}

export function startRename(row: HTMLElement, s: SlotInfo) {
  // dblclick on a not-yet-focused slot: the first click's assign() rebuilds the sidebar,
  // so the dblclick lands on the detached old row — a rename input there would be invisible.
  // Re-target the live row for this slot instead of silently doing nothing.
  if (!row.isConnected) {
    // rows are keyed by slot id, not index — the sidebar only lists ACTIVE slots now
    const live = slotsEl.querySelector(`[data-slot="${s.id}"]`);
    if (!(live instanceof HTMLElement)) return;
    row = live;
  }
  // the RUNNING session's line 1: on a band row the past cells come first in the track, and the
  // first .lbl was one of them — off-screen, so the input opened where nobody could see it
  const lbl = row.querySelector(".r1:not(.pastcell) .lbl");
  if (!lbl || row.querySelector(".renamein")) return;
  const input = document.createElement("input");
  input.className = "renamein";
  input.value = s.label ?? "";
  input.placeholder = baseName(s.cwd!);
  input.maxLength = 40;
  lbl.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = async (save: boolean) => {
    if (done) return;
    done = true;
    // restore the label BEFORE refreshing — renderSlots skips any rebuild while a
    // .renamein exists, so a leftover input would wedge the sidebar forever
    input.replaceWith(lbl);
    if (save && input.value.trim() !== (s.label ?? "")) await post(`/api/slots/${s.id}/rename`, { label: input.value });
    lastRender = ""; // force the sidebar rebuild even if nothing else changed
    await refresh();
  };
  input.onclick = (e) => e.stopPropagation();
  input.onkeydown = (e) => {
    e.stopPropagation(); // keep the global Escape handler away while editing
    if (e.key === "Enter") void finish(true);
    if (e.key === "Escape") void finish(false);
  };
  input.onblur = () => void finish(true);
}

function updateTitle() {
  const slot = panes[focused]?.slot ?? 0;
  const s = slot ? fleet[slot - 1] : undefined;
  mtitle.textContent = s?.cwd ? (s.label ?? baseName(s.cwd)) : "Claude Fleet";
  mreadTitle.textContent = mtitle.textContent;
  syncBox(); // a new session in the focused slot turns a held draft into the ended one's (G2.4)
  renderTarget(); // the composer's send target reads the same focused slot (G2.4)
  const ph = promptPlaceholder(); // …the placeholder names it (a rename, the first poll)…
  if (ta.placeholder !== ph) ta.placeholder = ph;
  renderIsland(); // …and so does the phone's top island
  renderSheet(); // …and an open sheet
}

// --- attended Codex bind ---------------------------------------------------------------
// This is intentionally a one-shot inventory opened from the cx chip. It never polls rollout
// storage and it renders identity metadata only; the exact UUID chosen here is the exact string
// sent back to the owner-only bind route.
const codexdlg = $("codexdlg"), codexpanel = $("codexpanel");
let codexDlgSlot = 0;
let codexCandidateData: CodexCandidatesView | null = null;
let codexCandidateError: string | null = null;
let codexChoice: string | null = null;
let codexCandidateLoading = false;

function closeCodexDlg() {
  codexdlg.style.display = "none";
  codexDlgSlot = 0;
  codexCandidateData = null;
  codexCandidateError = null;
  codexChoice = null;
}
codexdlg.addEventListener("click", (e) => { if (e.target === codexdlg) closeCodexDlg(); });

function renderCodexDlg() {
  const s = fleet[codexDlgSlot - 1];
  if (!s?.cwd || !s.codexRecovery) { closeCodexDlg(); return; }
  codexpanel.replaceChildren();
  codexpanel.appendChild(el("h2", "", `Bind Codex conversation — ${s.label ?? baseName(s.cwd)}`));
  const current = s.codexRecovery;
  codexpanel.appendChild(el("div", "cxstate", `Recovery state: ${current.state}`
    + (current.sessionId ? ` · bound ${current.sessionId}` : " · no conversation bound")));
  if (codexCandidateLoading) {
    codexpanel.appendChild(el("div", "hint shrhint", "Reading Codex conversation identities…"));
  } else if (codexCandidateError) {
    // Server refusals are owner decisions and therefore stay verbatim — no client paraphrase.
    codexpanel.appendChild(el("div", "cxerr", codexCandidateError));
  } else if (codexCandidateData) {
    const data = codexCandidateData;
    if (!data.sessionsRoot) {
      codexpanel.appendChild(el("div", "cxerr",
        "Candidate inventory unknown — the Codex sessions root is not configured or readable."));
    } else {
      const count = data.total ?? 0;
      codexpanel.appendChild(el("div", "hint shrhint", count === 0
        ? "0 eligible conversations for this exact working directory."
        : `${count} eligible conversation${count === 1 ? "" : "s"}; choose one exact UUID.`));
      const list = el("div", "cxlist");
      for (const c of data.candidates) {
        const row = el("label", "cxrow");
        const radio = document.createElement("input");
        radio.type = "radio"; radio.name = "codex-candidate"; radio.value = c.id;
        radio.checked = codexChoice === c.id;
        radio.onchange = () => { codexChoice = c.id; renderCodexDlg(); };
        const id = el("code", "", c.id); id.title = c.id;
        const when = el("span", "cxwhen", fmtSince(c.timestamp));
        when.title = new Date(c.timestamp).toLocaleString();
        row.append(radio, id, when);
        list.appendChild(row);
      }
      codexpanel.appendChild(list);
      if (data.truncated)
        codexpanel.appendChild(el("div", "hint shrhint", `Showing the newest ${data.candidates.length} of ${count}.`));
      if (data.boundElsewhere.length) {
        codexpanel.appendChild(el("div", "cxstate", "Bound to another active slot (not selectable)"));
        const blocked = el("div", "cxlist");
        for (const c of data.boundElsewhere) {
          const row = el("div", "cxrow blocked");
          const radio = document.createElement("input"); radio.type = "radio"; radio.disabled = true;
          const id = el("code", "", c.id); id.title = c.id;
          const where = el("span", "cxwhen", `slot ${c.slot} · ${fmtSince(c.timestamp)}`);
          where.title = new Date(c.timestamp).toLocaleString();
          row.append(radio, id, where);
          blocked.appendChild(row);
        }
        codexpanel.appendChild(blocked);
      }
    }
  }
  const btns = el("div", "shrbtns");
  const bind = el("button", "shrbtn primary", "bind exact conversation") as HTMLButtonElement;
  bind.disabled = !codexChoice || codexCandidateLoading;
  bind.onclick = async () => {
    const chosen = codexChoice;
    const slot = codexDlgSlot;
    if (!chosen || bind.disabled) return;
    bind.disabled = true;
    const res = await post(`/api/slots/${slot}/codex-bind`, { sessionId: chosen });
    const answer = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      codexCandidateError = answer.error ?? String(res.status);
      renderCodexDlg();
      return;
    }
    await refresh();
    if (codexDlgSlot === slot) await loadCodexCandidates(slot);
  };
  const close = el("button", "shrbtn", "close") as HTMLButtonElement;
  close.onclick = closeCodexDlg;
  btns.append(bind, close);
  codexpanel.appendChild(btns);
}

async function loadCodexCandidates(slot: number) {
  codexDlgSlot = slot;
  codexCandidateLoading = true;
  codexCandidateData = null;
  codexCandidateError = null;
  codexChoice = null;
  renderCodexDlg();
  const res = await api(`/api/slots/${slot}/codex-candidates`).catch(() => null);
  if (!res) codexCandidateError = "Candidate inventory unknown — the server could not be reached.";
  else {
    const answer = (await res.json().catch(() => null)) as CodexCandidatesView | { error?: string } | null;
    if (!res.ok) codexCandidateError = answer && "error" in answer && answer.error
      ? answer.error : String(res.status);
    else codexCandidateData = answer as CodexCandidatesView;
  }
  codexCandidateLoading = false;
  renderCodexDlg();
}

function openCodexDlg(slot: number) {
  setDrawer(false);
  codexdlg.style.display = "flex";
  void loadCodexCandidates(slot);
}

// the bar's one mark canvas and the boxes it draws into, re-measured when the list changes size
// (collapsed rail, a wrapped phone row) — the rows themselves only change in renderSlots
const marks = new MarkStage();
let markItems: MarkItem[] = [];
new ResizeObserver(() => placeMarks(marks, slotsEl, markItems)).observe(slotsEl);

export function renderSlots() {
  updateTitle();
  // harness-dependent pane affordances follow the POLL, not just pane assignment: a session
  // started from another device (or another tab) changes what its slot can do, and a 💬 that
  // only re-decides on click would keep offering a conversation view that has nothing behind it.
  for (const p of panes) p.syncHarnessAffordances();
  if (slotsEl.querySelector(".renamein")) return; // never destroy an in-progress rename
  // …nor a band under the hand: the rebuild waits for the gesture's end (bandify's release)
  if (bandGesture > 0) { slotsDirty = true; return; }
  slotsDirty = false;
  // a band that had the keyboard gets it back on the rebuilt row (← → Esc keep working)
  const bandFocus = document.activeElement instanceof HTMLElement && document.activeElement.classList.contains("bandview")
    ? document.activeElement.closest<HTMLElement>(".slot")?.dataset.slot ?? null : null;
  perfRebuild("renderSlots");
  slotsEl.replaceChildren();
  markItems = [];
  // Every slot still gets a row and empty slots still hold their place — but a lane whose project
  // has a home in this list now renders under it instead of at its own number. The "slots are fixed
  // places" principle is bent HERE and only here, deliberately (§F3 edge 3): four sessions plus
  // twelve empty rows overflowed a phone screen, and folding the lanes is what buys that back.
  // Empty rows do not move, so "start a session in slot 7" still means the same place.
  const stacks = stacksOf();
  const refs = laneBandNames(stacks);
  const stackAt = new Map(stacks.map((g) => [g.at, g]));
  const stackedLanes = new Set(stacks.flatMap((g) => g.lanes.map((lane) => lane.id)));
  // A QUIET STROKE AFTER EVERY FOURTH PLACE (owner 2026-09-21: „[Zitat entfernt]“).
  // Counted by the place's NUMBER, never by the visible row: a stack's lanes ride inside their
  // anchor's group, so unfolding them moves no stroke to another number. Drawn only BETWEEN two
  // groups that both render — never a trailing stroke under the axis.
  let group = 0;
  const sepBefore = (id: number) => {
    const g = Math.ceil(id / 4);
    if (group && g !== group) slotsEl.appendChild(el("div", "slotsep"));
    group = g;
  };
  for (const s of fleet) {
    if (s.id > 16 && !isActive(s)) continue;
    if (!isActive(s)) { sepBefore(s.id); slotsEl.appendChild(emptyRow(s)); continue; }
    const g = stackAt.get(s.id);
    if (g) { sepBefore(s.id); renderStack(g, refs); continue; }
    if (stackedLanes.has(s.id)) continue; // folded (or drawn) under its persisted anchor/header
    sepBefore(s.id);
    slotsEl.appendChild(slotRow(s, undefined, refs)); // plain session, including another main with no lanes
  }
  if (bandFocus) slotsEl.querySelector<HTMLElement>(`.slot[data-slot="${bandFocus}"] .bandview`)?.focus();
  placeMarks(marks, slotsEl, markItems);
}

// A FREE PLACE IS STILL A PLACE (owner: „[Zitat entfernt]“
// ). It keeps its number, it stays visible in the axis rather than thinning to a
// hairline, and the whole row is the click target — so the numbers run 1..16 unbroken whether or not
// anything lives at them, and choosing the number IS the ordering.
function emptyRow(s: SlotInfo): HTMLElement {
  const row = el("div", "slot empty");
  row.dataset.slot = String(s.id);
  const r1 = el("div", "r1");
  const mk = el("span", "mark");
  markItems.push({ el: mk, facts: null }); // bare soil: the place holds the column's axis
  r1.append(mk, el("span", "n", String(s.id)), el("span", "lbl dim", "free · start a session"));
  row.appendChild(r1);
  row.onclick = () => openK15Entwurf({ slot: s.id });
  // The ⎇+ quick-lane chip used to hang here, on EVERY empty row — twelve identical chips the
  // moment a repo session had focus, none of them saying which repo they meant. It lives on the
  // stack anchor now (see slotRow), where the repo is named right next to it.
  return row;
}

// The whole stack: its anchor row and, when unfolded, its active lane rows.
function renderStack(g: Stack, refs: ReadonlyMap<number, string>) {
  const open = stackIsOpen(g.foldKey);
  slotsEl.appendChild(g.anchor ? slotRow(g.anchor, g, refs) : repoHeaderRow(g, open));
  if (!open) return;
  for (const l of g.lanes) {
    const r = slotRow(l, undefined, refs);
    r.classList.add("stacked");
    slotsEl.appendChild(r);
  }
}

// Edge 1: lanes with no matching main occupant (missing, recycled, wrong-repo, or born parentless).
// They would otherwise have nothing truthful to fold under, so the project itself becomes the
// header. Never invisible, never silently migrated to whichever main happens to be open now.
function repoHeaderRow(g: Stack, open: boolean): HTMLElement {
  const row = el("div", "slot repohead");
  tintProject(row, g.key);
  const r1 = el("div", "r1");
  r1.appendChild(el("span", "mark"));
  const lbl = el("span", "lbl dim", baseName(g.key));
  lbl.title = `${g.key}\nno matching anchored main session — orphan/parentless lanes`;
  r1.appendChild(lbl);
  r1.appendChild(laneCountChip(g, open));
  r1.appendChild(quickLaneChip(g.key));
  row.appendChild(r1);
  row.onclick = () => setStackOpen(g, !open);
  return row;
}

// ⎇+ opens the window „Neue Session“ for a lane under this session (owner 2026-10-01; since K15 Runde 5 the new window): the repo
// and a lane are chosen, agent, model and what she gets are still the owner's — the one-click lane had none of them
function quickLaneChip(repo: string, parent?: LaneAnchor): HTMLElement {
  const q = el("span", "quicklane", "⎇+");
  q.title = `Neue Lane in ${baseName(repo)} — Agent, Modell und was sie bekommt im Fenster „Neue Session“`;
  q.onclick = (e) => { e.stopPropagation(); openK15Entwurf({ repo, ...(parent ? { parent } : {}) }); };
  return q;
}

// THE NUMBER OF LANES, and the fold. The owner's list has „[Zitat entfernt]“ and no fold
// arrow, so the count IS the fold control: one click shows or hides the lanes it counts. What the
// folded chips (⏸ unreviewed resolutions, 💬 guest messages in hidden lanes) used to say at rest is
// in the tooltip now, and on each lane's own hover row once unfolded; a hidden lane that is working
// still lights the anchor's state indicator (hidHot in slotRow).
function laneCountChip(g: Stack, open: boolean): HTMLElement {
  const n = el("span", "stackn" + (open ? "" : " folded"), `⎇${g.lanes.length}`);
  const lines = [`${g.lanes.length} lane${g.lanes.length === 1 ? "" : "s"} in ${baseName(g.key)}`
    + ` — click to ${open ? "hide" : "show"} them`];
  if (!open) {
    const pending = g.lanes.filter((l) => l.mergePending).length;
    if (pending) lines.push(`${pending} hidden lane(s) with agent conflict resolutions nobody has reviewed`);
    const comments = g.lanes.reduce((a, l) => a + (l.share?.comments ?? 0), 0);
    if (comments) lines.push(`${comments} guest message(s) in hidden lanes`);
  }
  n.title = lines.join("\n");
  n.onclick = (e) => { e.stopPropagation(); setStackOpen(g, !open); };
  return n;
}

// One occupied slot. `stack` is set only when this row is the anchor of a fold — it carries the
// ⎇N chip, which is also the fold.
// B3 · the inbound chip's PAINTED text, in one place because two readers need exactly it: the row
// that draws the chip and the sidebar's render key, which must be keyed on what is painted and not
// on the raw byte count (the rule `behind` and the ctx chip above both document).
// ONE sentence for a parked send, shared by the slot chip's tooltip and the pane view's hint
export type HeldDeliveries = { count: number; dueAt: number | null; paths: string[] };
// THE HELD BUNDLE in owner words (docs/messungen/2026-10-03-terminal-vs-chat-warten.md, Szenario 4):
// the chat view's quiet line and the composer's terminal-view hint say the same thing. HH:MM on the
// viewer's clock — dueAt is an instant, not a server-clock age.
export const heldDeliveriesLine = (hd: HeldDeliveries): string =>
  `${hd.count} Fleet-Zustellung${hd.count === 1 ? "" : "en"} gehalten ${hd.dueAt === null ? "bis zum nächsten Senden"
    : `bis ${new Date(hd.dueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}`}`;
export const parkedSendLine = (ps: { count: number; draftChars: number }): string =>
  `${ps.count} message${ps.count === 1 ? "" : "s"} wait${ps.count === 1 ? "s" : ""} for an empty input — `
  + `a draft of ${ps.draftChars} char${ps.draftChars === 1 ? "" : "s"} holds the composer; send or clear it`;
const inboundChipLabel = (inb: { sends: number; bytes: number }): string =>
  `in ${inb.bytes < 1024 ? `${inb.bytes} B` : `${Math.round(inb.bytes / 1024)} KB`}`;
function slotRow(s: ActiveSlot, stack: Stack | undefined, refs: ReadonlyMap<number, string>): HTMLElement {
  const open = stack ? stackIsOpen(stack.foldKey) : false;
  const visible = panes.some((p) => p.slot === s.id);
  const isFocused = panes[focused]?.slot === s.id;
  const row = el("div", "slot" + (isFocused ? " current" : visible ? " shown" : "") + (s.worktree ? " lane" : ""));
  row.dataset.slot = String(s.id);
  tintProject(row, projectOf(s));
  // THE RESTING ROW IS FIVE THINGS, and the list is the owner's, verbatim (2026-09-21): „[Zitat entfernt]“
  // 
  // . Plus the ⎇+ chip he named as the one button that is right as it is. It is ONE
  // line now. Everything else the row used to carry has no sentence of his and left it — but no
  // function left with it; each one says below where it went (the label's tooltip, the state's
  // tooltip, the hover row, the lane-count chip, or the board). `.slotact` stays a child of the
  // ROW: it overlays the row's right edge on hover, and on a phone it shares line 1's flex line.
  const r1 = el("div", "r1");
  {
      const displayLabel = laneLabel(s);
      const lbl = el("span", "lbl", displayLabel);
      // THE SESSION MARK — Fassung B "Zweig", the owner's choice (src/marks.ts). The span only
      // reserves the geometry; the bar's one canvas draws into it (placeMarks, end of renderSlots),
      // from facts registered below once the row's state glyph is known.
      const mk = el("span", "mark");
      r1.appendChild(mk);
      // WHAT THE ROW NO LONGER SAYS, the label says on hover: which checkout, a lane's branch and
      // git state (the lifecycle dot's three words), today's inbound bytes, a parked send. These
      // were line 2 and two chips; the board says all of them again, with actions.
      const facts: string[] = [];
      if (s.worktree) {
        facts.push(`${refs.get(s.id) ?? "lane"} · ${s.taskTitle ?? displayLabel}`, s.worktree.branch);
        if (s.git) {
          // lifecycle: editing (uncommitted) → ready (clean but commits to land) → clean — it was a
          // dot beside the state dot, a SECOND dot the resting row has no place for
          const lc = s.git.dirty > 0 ? "editing" : s.git.ahead > 0 ? "ready to land" : "clean";
          facts.push(`${lc} — ${s.git.dirty} uncommitted, ${s.git.ahead} to land, ${s.git.behind} behind`);
        }
        facts.push(`slot ${s.id} · ${s.cwd}`);
        const rf = s.worktree.resumedFrom;
        if (rf) facts.push(`resumed from review candidate ${rf.candidate} — verify evidence from before the park (head ${rf.head.slice(0, 10)}) is stale`);
      } else {
        facts.push(s.cwd ?? "");
      }
      if (s.inbound) {
        const { sends, bytes } = s.inbound;
        facts.push(`Fleet typed ${bytes.toLocaleString()} bytes into this pane today, in ${sends} send${sends === 1 ? "" : "s"}`);
      }
      if (s.parkedSend) facts.push(parkedSendLine(s.parkedSend));
      if (s.codexRecovery) facts.push(codexTurnLine(s));
      facts.unshift(roleLine(s));
      facts.push("open the board for the diff, the files and the actions · double-click to rename");
      lbl.title = facts.join("\n");
      if (s.worktree) {
        // A LANE'S NAME IS ITS BAND'S (3A, 16B) AND IT IS THE ONLY ONE the bar shows.
        const ref = el("span", "laneref", refs.get(s.id) ?? String(s.id));
        ref.title = lbl.title;
        r1.append(ref, lbl);
      } else {
        r1.append(el("span", "n", String(s.id)), lbl);
      }
      lbl.ondblclick = (e) => {
        e.stopPropagation();
        startRename(row, s);
      };
      // THE NUMBER OF LANES — his third item — and, since the fold arrow left the row, the fold
      // itself: clicking the count shows or hides the lanes it counts. While folded, what the hidden
      // lanes are waiting for is in its tooltip, and a hidden lane that works still lights the
      // state below (hidHot).
      if (stack) r1.appendChild(laneCountChip(stack, open));
      // WHAT IT GAVE ITSELF (POST /api/self/einrichten): the stones its predecessor set for this start, counted; Info → Setup shows them line by line
      if (s.gaveItself?.length) {
        const n = s.gaveItself.length;
        const g = el("span", "gave", `+${n}`);
        g.title = `gave itself ${n} stone${n === 1 ? "" : "s"} at its start: ${s.gaveItself.map((w) => w === "purpose" ? "its purpose" : `context pack ${w}`).join(", ")}`
          + " — the board's Info → Setup shows every new line";
        r1.appendChild(g);
      }
      // ⎇+ — the one button the owner calls right as it is. Not on lanes: a lane off a lane would
      // nest .worktrees inside a worktree.
      if (s.git && !s.worktree) {
        const parent = normalizeLaneAnchor({ slot: s.id, openedAt: s.openedAt });
        r1.appendChild(quickLaneChip(s.repo ?? s.cwd, parent ?? undefined));
      }
      // THE READINGS, "Reihe" (owner rounds 8/9, 2026-09-21: „[Zitat entfernt]“
      // ): a lane's lifecycle dot,
      // the ctx as a number, the state glyph — in that order, on the row's vertical centre.
      // The lifecycle dot: editing (uncommitted) a filled amber disc, ready (commits to land) a
      // green ring, clean nothing. Its three words stay in the label's tooltip.
      if (s.worktree && s.git && (s.git.dirty > 0 || s.git.ahead > 0)) {
        const life = s.git.dirty > 0 ? "editing" : "ready";
        const d = el("span", `lc ${life}`);
        d.title = `Lane: ${life === "editing" ? "in Arbeit — nicht committet" : "bereit — Commits warten aufs Landen"}`
          + ` · ${s.git.dirty} uncommitted, ${s.git.ahead} to land`;
        r1.appendChild(d);
      }
      // context fill — a SENSOR and nothing else: no threshold, no colour state, no action. The
      // unknown case is drawn as "?", never as 0% and never as an empty bar: a blank meter reads
      // as "fresh session", which is the one wrong answer this fact must not be able to give.
      {
        const c = s.ctx ?? null;
        const cx = el("span", "ctxfill" + (c ? "" : " unknown"), c ? `${Math.round(c.pct)}%` : "?");
        cx.title = c
          ? `context fill — ${c.usedTokens.toLocaleString()} of ${c.windowTokens.toLocaleString()} input tokens (${c.pct}%)`
          : "context fill unknown — this slot has no pinned claude transcript with a usage record yet"
            + " (or runs a harness/model Fleet cannot measure). Not an empty context.";
        r1.appendChild(cx);
      }
      // The state, in one glyph and FIVE readings. Each has its own SHAPE (the CSS), so the five
      // survive a greyscale screenshot; how long ago the session last spoke — line 2's other reading
      // — is in the tooltip beside the word.
      const hidHot = !!stack && !open && stack.lanes.some(
        (l) => serverNow - l.lastOutput < RECENT_MS || panes.some((p) => p.slot === l.id));
      const state = slotState(s, serverNow, visible || hidHot);
      // the mark reads the output's freshness and `awaiting` itself (src/marks.ts#markFacts)
      markItems.push({ el: mk, facts: markFacts(s, projectOf(s) ?? "", outputState(s, serverNow, visible || hidHot)) });
      // the permission question as a word beside the glyph, in the colour that means "waits for you"
      if (s.rueckfrage || s.vertrauen) {
        const frage = el("span", "frage", "Frage");
        frage.title = s.rueckfrage ? `${RUECKFRAGE_SATZ}\n${s.rueckfrage}` : VERTRAUEN_SATZ;
        r1.appendChild(frage);
      }
      const live = el("span", `act ${state}`);
      live.title = STATE_WORD[state] + (s.rueckfrage ? ` — Rechte-Frage: ${s.rueckfrage}` : "")
        + (hidHot && !visible && serverNow - s.lastOutput >= RECENT_MS ? " — a folded lane is active" : "")
        + `\nlast output ${sinceShort(serverNow - s.lastOutput) === "now" ? "just now" : `${sinceShort(serverNow - s.lastOutput)} ago`} · ${new Date(s.lastOutput).toLocaleString()}`;
      if (s.codexRecovery) live.title += `\n${codexTurnLine(s)}`;
      r1.appendChild(live);
      row.appendChild(r1);
      const firstTurn = codexTurnOf(s);
      if (firstTurn && (firstTurn.turn.state === "failed" || firstTurn.turn.error)) {
        const failure = el("div", "needline", `Erster Modellturn: Fehler beobachtet · ${firstTurn.turn.error?.code ?? "Fehler"}`
          + (firstTurn.turn.unknownReason ? " · Ergebnis unbekannt" : "")
          + ` · ${firstTurn.source} · ${new Date(firstTurn.turn.completedAt ?? firstTurn.turn.acceptedAt ?? firstTurn.observedAt).toLocaleString()}`);
        failure.title = codexTurnLine(s);
        row.appendChild(failure);
      }
      // CODEX RECOVERY — only when the OWNER has to act, and then as a SENTENCE on a line of its own.
      // "cx bound" / "cx pending" were the healthy states and the owner never knew what they meant
      // („[Zitat entfernt]“): healthy says nothing now. The two states Fleet will not
      // guess its way out of get words that say what to do — and a line, not a chip, because the
      // resting row is the owner's five things and a 250px bar has no width left for a sixth: as a
      // chip in line 1 it pushed the NAME to zero and the row past the bar's edge (measured
      // 2026-09-21, slot 5 of the demo). A row that needs a hand is allowed to be taller; that is
      // the signal, too. The click opens the dialog that settles it.
      if (s.codexRecovery && (s.codexRecovery.state === "ambiguous" || s.codexRecovery.state === "lost")) {
        const cr = s.codexRecovery;
        // WHAT HAPPENED, THEN WHAT TO DO (owner 2026-09-21, „[Zitat entfernt]“):
        // the first wording named only the action, and the reader could not tell why it was asked.
        const need = el("div", "needline", cr.state === "ambiguous"
          ? "Codex lost track of its conversation — click to pick it"
          : "Codex's conversation is gone — click to bind another");
        need.title = (cr.state === "ambiguous"
          ? "Codex: several conversations could belong to this pane, and Fleet will not guess which."
          : "Codex: the conversation this pane was bound to is gone.")
          + (cr.sessionId ? `\nlast bound: ${cr.sessionId}` : "")
          + "\nclick to see the candidates and bind one exact conversation";
        need.onclick = (e) => { e.stopPropagation(); openCodexDlg(s.id); };
        row.appendChild(need);
      }
      // THE ROLE ADDRESS RESOLVES TO NOBODY — a line on EVERY slot that carries an Orchestrator label,
      // because none of them is "the" one: the server picks no winner, so neither does the board.
      // The click renames this one; which to rename is the owner's call (server.ts#roleConflictFor).
      if (roleConflict?.slots.includes(s.id)) {
        const others = roleConflict.slots.filter((id) => id !== s.id);
        const need = el("div", "needline",
          `Adresse „orchestrator“ unauflösbar — auch Slot ${others.join(", ")} trägt ein Orchestrator-Label · klick zum Umbenennen`);
        need.title = `Slots ${roleConflict.slots.join(", ")} tragen ein Orchestrator-Label. Die Rollenadresse „orchestrator“ `
          + "löst nur bei genau einem Treffer auf — bis dahin erreicht keine Nachricht an die Orchestratorin ihr Ziel, "
          + "und Fleet wählt keine Gewinnerin.\n" + roleLine(s)
          + "\nklick: diesen Slot umbenennen — alle bis auf einen umbenennen löst die Adresse wieder auf";
        need.onclick = (e) => { e.stopPropagation(); startRename(row, s); };
        row.appendChild(need);
      }
      // THE BAND: a line that has handed over becomes a track you pull back through (bandify)
      if (s.succession && s.succession.session > 1) bandify(row, r1, s, s.succession.session);
      // THE HOVER ROW carries what asks for a hand: the guest chat (with its count — the 💬 badge
      // that used to sit on the resting row), an unreviewed conflict resolution (the ⏸ badge), the
      // scheduled-prompt mark, and kill. The ± diff that stood here and inline on lanes is gone
      // (owner: „[Zitat entfernt]“): the board's file rows, commit rows and „[Zitat entfernt]“ open
      // the same review window, on the exact file or commit instead of the whole tree.
      const act = el("div", "slotact");
      if (autosList.some((a) => a.slot === s.id && a.enabled)) {
        const b = el("span", "autobadge", "⏱");
        b.title = "Diese Session hat geplante Prompts — das Schedule-Fach unter dem Composer listet sie (intern: autos).";
        act.appendChild(b);
      }
      if (s.mergePending) {
        const rb = el("span", "revb", "⏸");
        rb.title = "Konflikte, die der Agent aufgelöst hat, ohne dass jemand sie prüfte — Klick öffnet das Board zum Prüfen und Landen (intern: merge review).";
        rb.onclick = (e) => { e.stopPropagation(); showSlot(s.id, e.timeStamp); setBoard(true); };
        act.appendChild(rb);
      }
      if (s.share) {
        const n = s.share.comments;
        const ca = el("span", "cmtact" + (n > 0 ? " hot" : ""), n > 0 ? `💬${n}` : "💬");
        ca.title = n > 0 ? `Gäste-Chat — ${n} Nachricht${n === 1 ? "" : "en"}` : "Gäste-Chat";
        ca.onclick = (e) => { e.stopPropagation(); openShareDlg(s.id); };
        act.appendChild(ca);
      }
      const kill = el("span", "kill", "✕");
      kill.title = "Diese Session beenden — was sie gerade tut, geht verloren (intern: kill).";
      kill.onclick = (e) => { e.stopPropagation(); void killSlot(s); };
      act.appendChild(kill);
      // ⋯ — THE PHONE'S ONE DOOR to the row's actions (row 69bdf591). They used to be a strip of
      // their own under every row (⤴ ⇩ ✎ ✔ ⏏ ⇲, plus ✕ on a line of its own) and a phone showed three
      // and a half sessions. CSS-hidden on the desktop, where the hover strip and the board carry them.
      const more = el("button", "rowmore") as HTMLButtonElement;
      more.appendChild(icon("dots"));
      more.title = "Aktionen dieser Session — umbenennen, teilen, exportieren, beenden";
      more.setAttribute("aria-haspopup", "menu");
      more.onclick = (e) => { e.stopPropagation(); toggleRowMenu(s); };
      act.appendChild(more);
      row.appendChild(act);
      // §F3 click semantics, in the owner's words („[Zitat entfernt]“
      // ): clicking a FOLDED stack only unfolds it — it does not steal the
      // pane. Once open the anchor is an ordinary row again and focuses its session. Folding back is
      // the arrow's job alone, or focusing the main session would always cost you the open fold.
      row.onclick = stack && !open ? () => setStackOpen(stack, true) : (e) => showSlot(s.id, e.timeStamp);
  }
  return row;
}

// THE EXPORT MENU (row 11e541e0; owner 2026-09-22: „[Zitat entfernt]“
// ). More than one list, so a
// window, not a popover (G4 Zuhause) — the askRisk window with the chat material. What to export
// (the conversation, or the screen as before), which parts of the conversation, which format. The
// choices travel as query switches and act on the SERVER (server.ts#conversationPick): nothing that
// is switched off ever reaches the file. A slot without a readable conversation offers the screen
// only and says why — the server's own sentence from ?probe=1.
type ExportPart = "user" | "assistant" | "tools" | "results" | "thinking" | "time";
const EXPORT_PARTS: [ExportPart, string, string][] = [
  ["user", "Your messages", "Was du geschrieben hast."],
  ["assistant", "Assistant text", "Was die Session geantwortet hat."],
  ["tools", "Tool calls", "Welche Werkzeuge die Session aufgerufen hat, mit ihren Argumenten (intern: tool_use)."],
  ["results", "Tool results", "Was die Werkzeuge zurückgegeben haben (intern: tool_result)."],
  ["thinking", "Reasoning", "Die Denk-Spuren der Session, wo das Protokoll sie enthält (intern: thinking)."],
  ["time", "Timestamps", "Die Uhrzeit jeder Nachricht."],
];
export async function openExportDlg(slot: number, name: string) {
  let probe: { available?: boolean; why?: string | null } | null = null;
  try {
    const r = await api(`/api/slots/${slot}/export/conversation?probe=1`);
    if (r.ok) probe = (await r.json()) as { available?: boolean; why?: string | null };
  } catch { /* probe stays null: the menu then offers the screen and says it could not look */ }
  const canConv = probe?.available === true;
  const st: { content: "conversation" | "screen"; convFmt: "md" | "html" | "jsonl"; screenFmt: "html" | "txt" } =
    { content: canConv ? "conversation" : "screen", convFmt: "md", screenFmt: "html" };
  const on: Record<ExportPart, boolean> = { user: true, assistant: true, tools: false, results: false, thinking: false, time: true };
  const body = el("div", "expbody");
  const seg = <T extends string>(label: string, opts: [T, string, string, boolean?][], cur: T, pick: (v: T) => void) => {
    const g = el("div", "expgroup");
    g.appendChild(el("div", "explabel", label));
    const row = el("div", "expseg");
    for (const [v, text, title, disabled] of opts) {
      const b = el("button", v === cur ? "on" : "", text) as HTMLButtonElement;
      b.title = title;
      b.disabled = !!disabled;
      b.setAttribute("aria-pressed", String(v === cur));
      b.onclick = () => { pick(v); paint(); };
      row.appendChild(b);
    }
    g.appendChild(row);
    return g;
  };
  const paint = () => {
    body.replaceChildren(seg("Content", [
      ["conversation", "Conversation", "Das Gespräch aus dem Protokoll der Session — du wählst unten, was hinein soll.", !canConv],
      ["screen", "Screen", "Der Bildschirm der Pane, wie er heute exportiert wird (intern: tmux scrollback)."],
    ], st.content, (v) => { st.content = v; }));
    if (!canConv) body.appendChild(el("div", "hint", probe?.why ?? "Ob diese Session ein Gesprächsprotokoll hat, ließ sich nicht prüfen — exportierbar ist der Bildschirm."));
    if (st.content === "conversation") {
      const g = el("div", "expgroup");
      g.appendChild(el("div", "explabel", "Includes"));
      const row = el("div", "expopts");
      for (const [k, text, title] of EXPORT_PARTS) {
        const b = el("button", "expopt" + (on[k] ? " on" : ""), text) as HTMLButtonElement;
        b.title = title;
        b.setAttribute("aria-pressed", String(on[k]));
        b.onclick = () => { on[k] = !on[k]; paint(); };
        row.appendChild(b);
      }
      g.appendChild(row);
      body.appendChild(g);
      body.appendChild(seg("Format", [
        ["md", "Markdown", "Eine .md-Datei zum Weitergeben oder Weiterverarbeiten."],
        ["html", "HTML", "Eine Seite zum Drucken oder als PDF sichern."],
        ["jsonl", "JSONL", "Ein Eintrag je Zeile, maschinenlesbar, mit den Blocknamen des Protokolls."],
      ], st.convFmt, (v) => { st.convFmt = v; }));
      body.appendChild(el("div", "hint", "Zugangsschlüssel, die Adresse dieses Rechners und dein Home-Pfad werden im Export geschwärzt."));
    } else {
      body.appendChild(seg("Format", [
        ["html", "HTML", "Eine Seite zum Drucken oder als PDF sichern."],
        ["txt", "Text", "Der Bildschirminhalt als .txt-Datei."],
      ], st.screenFmt, (v) => { st.screenFmt = v; }));
    }
  };
  paint();
  const ok = await askRisk({
    title: `Export — ${name}`,
    body: [body],
    buttons: [{ label: "cancel", value: false }, { label: "Export", primary: true, value: true }],
    panelClass: "riskpanel exportpanel",
  });
  if (!ok) return;
  if (st.content === "screen") {
    window.open(`/api/slots/${slot}/export${st.screenFmt === "txt" ? "?format=txt" : ""}`, "_blank");
    return;
  }
  const q = new URLSearchParams({ format: st.convFmt });
  for (const [k] of EXPORT_PARTS) q.set(k, on[k] ? "1" : "0");
  window.open(`/api/slots/${slot}/export/conversation?${q}`, "_blank");
}

async function killSlot(s: ActiveSlot) {
  if (s.worktree) {
    // a lane-holding slot never had real git-state context on kill before — fetch it,
    // same risk preview the board's land action uses (kill leaves the worktree on disk;
    // land/remove it from the board)
    const risk = await fetchSlotRisk(s.id);
    const ok = await showRiskPreview(
      `Kill session ${s.id} (${baseName(s.cwd)})? The worktree is left on disk (open the board to land or remove it).`, risk, "kill");
    if (!ok) return;
  } else if (!confirm(`Kill session ${s.id} (${baseName(s.cwd)})? The claude session and its history are gone.`)) {
    return;
  }
  await post(`/api/slots/${s.id}/kill`, {});
  for (const p of panes) if (p.slot === s.id) p.assign(0);
  await refresh();
}

// THE ROW MENU behind ⋯ (phone only): a G4.2 context menu in the G4.1 material, full width at the
// foot of the drawer (G4.1 mobil). It lives in #side, not in #slots, because the bar rebuilds its
// rows on every changed poll and must not shut an open menu; the trigger is looked up by slot.
// Every action the old strip carried is here, each one tap after ⋯, with unchanged behaviour —
// kill last and in --danger.
const rowMenu = el("div", "rowmenu");
rowMenu.setAttribute("role", "menu");
$("side").appendChild(rowMenu);
let rowMenuSlot: number | null = null;
const rowMenuTrigger = () => rowMenuSlot === null ? null
  : slotsEl.querySelector<HTMLElement>(`.slot[data-slot="${rowMenuSlot}"] .rowmore`);
function closeRowMenu() {
  rowMenuSlot = null;
  rowMenu.classList.remove("open");
  rowMenu.replaceChildren();
}
function toggleRowMenu(s: ActiveSlot) {
  if (rowMenuSlot === s.id) { closeRowMenu(); return; }
  rowMenu.replaceChildren(el("div", "rowmenuhead", s.label ?? baseName(s.cwd)));
  const item = (label: string, title: string, run: () => void, danger = false) => {
    const b = el("button", "rowmenuitem" + (danger ? " danger" : ""), label) as HTMLButtonElement;
    b.title = title;
    b.setAttribute("role", "menuitem");
    b.onclick = (e) => { e.stopPropagation(); closeRowMenu(); run(); };
    rowMenu.appendChild(b);
  };
  item("Rename", "Diese Session umbenennen — der Name steht dann in der Leiste.", () => {
    const row = slotsEl.querySelector(`.slot[data-slot="${s.id}"]`);
    if (row instanceof HTMLElement) startRename(row, s);
  });
  item(s.share ? "Shared — view only…" : "Share…", "Diese Session nur lesend teilen — ein Link mit Passwort.", () => openShareDlg(s.id));
  item("Export…", "Die Session exportieren — Gespräch oder Bildschirm, du wählst Teile und Format.", () => { void openExportDlg(s.id, s.label ?? baseName(s.cwd)); });
  // save = quick-commit this lane's uncommitted work — lets a phone user save outside the
  // conversation (land/merge refuse a dirty tree; a kill would otherwise lose it)
  if (s.worktree) item("Save", "Die offene Arbeit dieser Lane committen (intern: quick commit).", () => { void doCommit(s.id, "quick"); });
  if (s.worktree && landsEnabled) item("Land", "Diese Lane in main einbauen.", () => { void doLand(s.id); });
  if (s.worktree) item("Shelve", "Diese Lane beiseitelegen, mit Notiz.", () => { void doShelve(s.id); });
  item("Kill session", "Diese Session beenden — was sie gerade tut, geht verloren (intern: kill).", () => { void killSlot(s); }, true);
  rowMenuSlot = s.id;
  rowMenu.classList.add("open");
}
popover({
  panel: () => rowMenu,
  trigger: rowMenuTrigger,
  isOpen: () => rowMenuSlot !== null,
  close: (refocus) => {
    const t = rowMenuTrigger();
    closeRowMenu();
    if (refocus) t?.focus();
  },
  rows: () => [...rowMenu.querySelectorAll<HTMLElement>(".rowmenuitem")],
});

// --- stale-bundle self-heal: the server reports its current app.js version with every
// poll. A tab left open across a deploy keeps running OLD code (missing buttons read as
// "regression") — when the version moves, reload as soon as the tab is hidden so we never
// yank the page out from under active typing.
//
// …and SAY SO in the meantime, because "as soon as the tab is hidden" never arrives for the one
// window the owner keeps in front of them. That is not a hypothetical: a deploy landed, the
// dashboard was checked, and the new work was simply absent — the page had been in the foreground
// the whole time, the self-heal was armed and waiting, and nothing on screen said a newer client
// existed. The comment above already predicted "missing buttons read as regression"; it did not
// predict that the reader would be the owner. Deliberately NOT the post-land check card — that
// channel is an ALARM, and „[Zitat entfernt]“ is not an alarm.
let bundleV = 0;
let reloadArmed = false;
function armReload() {
  if (reloadArmed) return;
  reloadArmed = true;
  if (document.hidden) { location.reload(); return; }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) location.reload();
  });
  if (document.getElementById("newver")) return;
  const b = el("button", "", "a newer version is ready — reload");
  b.id = "newver";
  b.title = "the server is serving a newer client than this page is running";
  b.onclick = () => location.reload();
  document.body.appendChild(b);
}

let chipCmds: string[] = [];
let lastRender = "";
export async function refresh() {
  const boardPerf = !perfBoardStarted ? perfStart("J1", 0) : null;
  if (boardPerf) perfBoardStarted = true;
  try {
    const res = await api("/api/sessions");
    if (!res.ok) {
      if (boardPerf) { boardPerf.attrs.reason = "http-error"; perfFinish(boardPerf, false); }
      return;
    }
    const data = (await res.json()) as { now: number; chips: string[]; shareBase?: string;
      v?: number; autos?: AutoInfo[]; slots: SlotInfo[]; tasks?: TaskInfo[]; dispatch?: DispatchInfo;
      // WHICH FLEET ANSWERED — always sent since the dual-host cut, `{name:null}` when unnamed
      instance?: { name?: string | null; source?: InstanceSource };
      codexCli?: CodexCliSnapshot;
      // absent on a server that predates the flag → treated as "this fleet lands", the old behaviour
      lands?: boolean;
      // omitted by the server when nothing is configured — absent and empty are the same answer
      // here ("this board offers no switcher"), unlike `lands` above where absence had to mean YES
      instances?: InstanceLink[];
      // digest only (id/status/title/createdAt) — the binding lives on GET /api/programs
      programs?: ProgramDigest[];
      postLandAudit?: PostLandAuditInfo | null; postLandAuditLive?: PostLandAuditLiveInfo | null;
      gate?: GateInfo | null; suiteOffers?: SuiteOfferRow[]; errors?: ErrorsInfo | null;
      // omitted by the server when the register is empty — absent means "no device has ever
      // registered", never "the server does not know about devices"
      helperDevices?: HelperDeviceInfo[];
      // the window those rows are judged against, and it rides with them — see deviceOnlineMs
      helperOnlineMs?: number;
      attentionOpen?: number;
      programsStale?: number;
      reportsAwaitingOwner?: number;
      // the owner poll's CUT and PROJECTION of the trail (src/opsevents.ts#opsPollRow); full rows: GET /api/events
      events?: OpsPollRow[];
      deployGap?: DeployGapInfo | null; bundleStale?: BundleStaleInfo | null;
      // omitted while the role address resolves (one holder) or nobody holds it — absent is no conflict
      roleConflict?: { address: "orchestrator"; slots: number[] };
      autosOn?: boolean; quietHours?: { start: number; end: number } | null };
    if (data.v) {
      if (!bundleV) bundleV = data.v;
      else if (data.v !== bundleV) armReload();
    }
    fleet = data.slots;
    flotteNeu();
    restoreDrafts(); // the first read of the slot rows: a kept draft returns to its own occupation
    // a merge job that landed its lane leaves the slot inactive — release its panes
    // exactly like a manual ⏏ land click does
    for (const sl of [...mergeWatch]) {
      const st = fleet[sl - 1];
      if (!st || !st.worktree) mergeWatch.delete(sl);
      if (st && !st.cwd) for (const p of panes) if (p.slot === sl) p.assign(0);
    }
    autosList = data.autos ?? [];
    tasksList = data.tasks ?? [];
    setProgramsPoll(data.programs ?? []);
    dispatch = data.dispatch ?? { available: false, on: false, maxLanes: 0, repo: "" };
    landsEnabled = data.lands !== false;
    roleConflict = data.roleConflict ?? null;
    instanceName = data.instance?.name ?? null;
    // THE BOUNDARY CHECK, and it is not paranoia about our own server: this list is the only wire
    // value the board turns into a NAVIGATION. Re-applying the server's own charset here means the
    // set of places a click can reach is decided by one regex that both ends import, so widening it
    // on one side alone widens nothing.
    const wireLinks = (data.instances ?? []).filter((l) =>
      typeof l?.name === "string" && INSTANCE_NAME_RE.test(l.name)
      && typeof l.url === "string" && INSTANCE_URL_RE.test(l.url));
    const kindOf = (l: InstanceLink): unknown => (l as { kind?: unknown }).kind;
    instanceLinks = wireLinks.filter((l) => kindOf(l) === undefined);
    switchLinks = wireLinks.flatMap((l) => {
      const kind = kindOf(l);
      return kind === "testinstanz" || kind === "live" ? [{ name: l.name, url: l.url, kind }] : [];
    });
    instanceCodexCli = codexCliSnapshotFrom(data.codexCli);
    instanceObservedNow = data.now;
    renderInstanceHead(switchLinks);
    const tiSource = data.instance?.source === undefined ? null : instanceSourceFrom(JSON.stringify(data.instance.source));
    renderInstanceBand(tiSource);
    setInstanceSource(tiSource);
    autosOnSrv = typeof data.autosOn === "boolean" ? data.autosOn : null;
    quietHoursSrv = data.quietHours ?? null;
    renderAutoStatus();
    // tier 2's only reader. Rendered on every poll rather than behind the render-key diff below:
    // that key is about the slot tiles, and an alarm must not wait on an unrelated change to appear.
    setPostLandAudit(data.postLandAudit ?? null);
    renderPostLandAudit();
    // read here, painted by the board's own timer — the gate line lives inside a panel that is
    // closed most of the time, so there is nothing to repaint from this hot path
    setGateInfo(data.gate ?? null);
    // same rail, same timer: the running audit is drawn inside the gate section, which the board's
    // own repaint owns. The elapsed clock does not wait on this poll — it ticks off the client.
    setPostLandLive(data.postLandAuditLive ?? null);
    setErrorsInfo(data.errors ?? null);
    // same rail as the gate line: read on the 2 s poll, painted by the board's own timer, because
    // the panel lives inside a board that is closed most of the time. The 💻 button and an OPEN
    // device dialog are painted from here instead — they have no timer of their own, and a badge
    // that only moved when the board happened to repaint would be a stale count.
    setDeviceSnapshot(data.helperDevices ?? [], data.helperOnlineMs ?? null);
    // the window travels WITH the rows (server.ts, the /api/sessions projection). Absent rows means
    // absent window, and the reset to null is the honest state — not the last window we happened to see.
    setMeterSuites(data.suiteOffers ?? []);
    // the meter is the one gate surface that is always on screen, so it paints from the poll itself
    renderSuiteMeter();
    renderDevBtn();
    if (devIsOpen()) renderDevDlg();
    // the attention inbox's whole share of the 2s poll: one number. It paints the badge, and while
    // the panel is open a CHANGE in it is what re-fetches the rows — the panel never polls itself.
    setAttentionOpen(data.attentionOpen ?? 0);
    setProgramsStale(typeof data.programsStale === "number"
      && Number.isInteger(data.programsStale) && data.programsStale > 0 ? data.programsStale : 0);
    setReportsAwaitingOwner(data.reportsAwaitingOwner ?? 0);
    // the operations inbox reads the events the poll already carries — no extra request, and the
    // 📥 badge counts only rows that were minted FOR it (delivery inbox, still awaiting the owner)
    setOpsEvents(data.events ?? []);
    if (panes.some((pane) => pane.savedHover)) void loadEntityDetails();
    setDeployGapInfo(data.deployGap ?? null);
    setBundleStaleInfo(data.bundleStale ?? null);
    serverNow = data.now;
    serverClockSkew = data.now - Date.now();
    shareBase = data.shareBase ?? "";
    chipCmds = data.chips;
    renderChips(data.chips);
    renderParkHint();
    renderHeldHint();
    renderFrageHint();
    renderWorkplaceField();
    for (const p of panes) p.syncHeld();
    // hot also for a PROPOSED done-criterion (2026-08-05): a clarify lane that filed its
    // proposal sits parked on the owner — before this, nothing on the board said so and the
    // lane waited invisibly until the owner happened to reselect the task
    // one source for „[Zitat entfernt]“: the SAME grouping the overlay draws, so the
    // badge and the list can never disagree about what needs the owner. (It used to be its own
    // hand-rolled predicate over source+criterion, which is how the two drifted.)
    $("queuebtn").classList.toggle("hot", tasksList.some((t) => qGroupOf(t) === "needs"));
    // skip the DOM rebuild when nothing visible changed — a full re-render kills hover state
    const key = JSON.stringify([focused, panes.map((p) => p.slot),
      autosList.filter((a) => a.enabled).map((a) => a.slot),
      data.slots.map((s) => [s.cwd, s.label, s.taskTitle, s.share?.id, s.share?.comments, s.mergePending,
        // the STATE GLYPH and the age beside it, both at the resolution the row paints them. The
        // glyph was a boolean here while it had two readings; it has four now, and `stalled`/`agent`
        // reach the row through nothing else — leaving them out would freeze a session at "resting"
        // for as long as no other field moved (the `behind` bug this list documents).
        slotState(s, serverNow, panes.some((p) => p.slot === s.id)),
        sinceShort(serverNow - s.lastOutput),
        // every git field renderSlots actually paints, or the skip-the-rebuild shortcut below
        // silently freezes it: `behind` was missing here while the lane dot's tooltip has shown
        // it since the dot existed, so a lane falling behind main kept the old count until some
        // OTHER field moved. Adding a rendered field here is not optional.
        // worktree.repo, not just !!worktree: it is the stack's grouping key AND its colour key, so
        // a row painted from it belongs in this list by the same rule that put `behind` here
        s.git?.branch, s.git?.dirty, s.git?.ahead, s.git?.behind,
        s.worktree?.branch, s.worktree?.repo ?? !!s.worktree,
        // Stable ownership and the canonical main repo both alter stack membership. In particular,
        // repo moves null → toplevel after the slow git tick; omitting it freezes a subdirectory
        // main's lanes under the orphan header even after the poll has learned the truthful join.
        s.openedAt, s.repo, s.worktree?.anchor?.slot, s.worktree?.anchor?.openedAt,
        s.codexRecovery?.state, s.codexRecovery?.sessionId, s.codexRecovery?.disconnectSeenAt,
        JSON.stringify(s.codexFirstTurn ?? null),
        // the context chip, at the SAME resolution the row paints it (whole percent). The raw pct
        // moves on nearly every poll; keying on it would rebuild the sidebar continuously, and
        // leaving it out entirely would freeze the chip until some other field moved — the exact
        // bug `behind` above documents.
        s.ctx ? Math.round(s.ctx.pct) : null,
        // …and the inbound chip, through the SAME function that paints it — keying on the raw byte
        // count would rebuild the sidebar for a change the chip does not show, and leaving it out
        // would freeze the chip until another field moved (the `behind` bug this list documents).
        s.inbound ? inboundChipLabel(s.inbound) : null,
        s.parkedSend?.count, s.parkedSend?.draftChars,
        // the band: a new session on the line adds a cell (bandify)
        s.succession?.session,
        // the session mark's facts beyond the ones above (src/marks.ts#markFacts): role reads the
        // model (astra), the waiting frame reads awaiting, the bud reads the harness
        s.harness, s.model, s.awaiting,
        // the label tooltip's role line and the role-address needline (roleLine, slotRow)
        s.role, roleConflict?.slots.includes(s.id) ? roleConflict.slots.join(",") : null])]);
    if (key !== lastRender) {
      lastRender = key;
      renderSlots();
    }
    renderQueue(); // no-op unless the queue overlay is open; keeps it live
    renderKonstellation(); // the same for the constellation window
    // keep an open task DETAIL honest the same way (2026-08-05): a clarify lane's criterion
    // proposal arrived on this poll, but the detail only ever repainted on reselect — the
    // owner sat in front of a stale pane while the lane waited on them. Keyed on the fields
    // the detail actually paints, so hover and an in-progress criterion edit survive quiet polls.
    if (qShell?.isOpen() && qPick !== null && (qPick.startsWith("repo:") || qPick.startsWith("konz:"))) {
      // THE REPO SHEET IS ON DEMAND (K2): the pane fetches GET /api/repos/:canon/view itself and
      // carries no poll field, so there is deliberately NO detail key here — repainting it on
      // every poll would turn "Ledger auf Abruf" into a 2-s ledger poll through the client's
      // back door. It repaints only when reopened or on its own "read again" button. A konzept pane
      // (queue.ts#renderKonzeptDetail) is the same: its ledgers are not on the poll.
    } else if (qShell?.isOpen() && qPick !== null && qPick.startsWith("prog:")) {
      // the same rule for a program pane: its MARK moves with the SLOTS, not with the program,
      // so a pane keyed on the program alone would keep claiming a MAIN that just died
      const p = programsList.find((x) => `prog:${x.id}` === qPick);
      // the return-path note belongs in the key for the same reason the mark does: it moves with
      // the transport, not with the program, so a pane keyed without it would keep showing room
      // that a report has since spent.
      const dk = p ? JSON.stringify(["prog", p.id, p.status, p.title, programMark(p).mark,
        p.main?.slot ?? null, p.main?.openedAt ?? null, p.deliveryBudgetNote ?? null,
        // the identity half moves with the OCCUPANT, not with the program: a pane keyed without it
        // would keep painting `identity exact` over a session that has since been re-minted.
        p.health?.sessionIdMatch ?? null, p.health?.occupancy ?? null,
        p.executionStatus ?? null]) : "prog-gone";
      if (dk !== qDetailKey) { setQueueDetailKey(dk); renderQueueDetail(); }
    } else if (qShell?.isOpen() && qPick !== null) {
      const t = tasksList.find((x) => x.id === qPick);
      const dk = t ? JSON.stringify([t.id, t.status, t.kind, t.note, t.repo,
        t.files?.join("\n"), t.filesOrigin, t.cluster, t.briefAt,
        t.criterion?.proposedAt, t.criterion?.confirmedAt,
        // a parked file-surface proposal arrives on a poll exactly as the criterion does, and the
        // confirm button removes it — without this the pane would keep offering a spent click
        t.filesProposal?.at, t.filesProposal?.files.join("\n"),
        // In Waves, another row or active branch can move this row's advisory placement too.
        t.comments?.n, t.comments?.at, t.touched?.length, t.touched?.[0]?.sha,
        // N3: attaching or detaching a source, and every verdict a lane writes, arrive on a poll
        // exactly as a comment does — without them the sources section would keep showing a spent
        // detach button and a verdict list that is one report behind.
        t.notes?.n, t.notes?.at, t.verdicts?.n, t.verdicts?.at,
        // the ③ haken is set from another tab or by a MAIN's brief door just as a comment is
        t.review,
        // E4 · a variant decision arrives on a poll like a comment does, on the group row
        t.variantDecision?.winner, tasksList.find((x) => x.id === t.variantOf)?.variantDecision?.winner,
        // the lane line moves with the SLOTS (state, dirty, a recycled pointer), not with the row
        qLaneKey(new Map([[t.id, qLaneJoinOf(t.id)]])),
        qView === "waves" ? qWaveProjectionKey() : null]) : "gone";
      if (dk !== qDetailKey) { setQueueDetailKey(dk); renderQueueDetail(); }
    }
    if (boardPerf) perfBoardReady(boardPerf, res);
    // keep an open share dialog honest (guest count, mode changed elsewhere) without
    // rebuilding it on every poll — rebuilds kill hover state and button focus
    if (dlgSlot && sharedlg.style.display === "flex") {
      const sh = fleet[dlgSlot - 1]?.share;
      const dk = sh ? `${sh.id}|${sh.guests}|${sh.comments}` : "none";
      if (dk !== dlgKey) {
        dlgKey = dk;
        renderShareDlg();
      }
    }
  } catch {
    if (boardPerf) { boardPerf.attrs.reason = "fetch-error"; perfFinish(boardPerf, false); }
    // server briefly unreachable — WS dot already shows disconnect
  }
}
// --- the poll pump: every recurring fetch this page makes is armed HERE, so there is
// exactly one place that knows about document.hidden and one place the data-saver switch
// has to reach. A hidden tab polls nothing at all — it has no viewer, and on a phone
// "hidden" is the normal state (screen off, app switched away) while the socket lives on.
// Coming back fires one immediate catch-up round, never a backlog of missed ticks:
// refresh() is a full-state read (the last one wins) and pollChat() is a delta read.
let pollTimer: ReturnType<typeof setInterval> | undefined;
let boardTimer: ReturnType<typeof setInterval> | undefined;
function armPolls() {
  clearInterval(pollTimer); pollTimer = undefined;
  clearInterval(boardTimer); boardTimer = undefined;
  const p = plan();
  if (p.pollMs) pollTimer = setInterval(() => void refresh(), p.pollMs);
  if (p.boardMs) boardTimer = setInterval(() => void renderBoard(), p.boardMs);
}
document.addEventListener("visibilitychange", () => {
  armPolls();
  for (const p of panes) p.chatPump(); // stops the chat chain on the way out, restarts it on the way back
  if (document.hidden) return;
  void refresh(); // the sidebar is stale by exactly the time we spent hidden — fix it now
  void renderBoard();
});

// --- the data-saver switch itself (persisted per device, like the board/histall toggles) ---
const saverBtn = $("saverbtn") as HTMLButtonElement;
const SAVER_TITLE = "data saver — slower polls (sidebar/chat/brief lag a few seconds) and a"
  + " shorter scrollback seed on reconnect. The terminal itself is unaffected.";
function applySaver() {
  saverBtn.classList.toggle("active", dataSaver);
  saverBtn.title = `${SAVER_TITLE}\ncurrently: ${dataSaver ? "ON" : "off"}`;
  armPolls();
  for (const p of panes) p.chatPump(); // pick up the new chat interval without waiting out the old one
}
function setSaver(on: boolean) {
  dataSaver = on;
  prefSetBool("fleet.datasaver", on);
  applySaver();
}
saverBtn.onclick = () => setSaver(!dataSaver);
applySaver(); // also the initial arm of the pump

// --- share dialog: create/inspect/revoke the one share a slot can have ---
const sharedlg = $("sharedlg"), sharepanel = $("sharepanel");
let dlgSlot = 0;
let dlgKey = ""; // last-rendered share state — refresh() only re-renders the open dialog on change
let dlgQr = false; // QR block open? module-level so refresh()'s re-render keeps it visible

function closeShareDlg() {
  sharedlg.style.display = "none";
  dlgSlot = 0;
  dlgQr = false; // next share starts collapsed — a QR is per-link, never sticky across slots
}
sharedlg.addEventListener("click", (e) => {
  if (e.target === sharedlg) closeShareDlg();
});

// --- the review window: what changed, file by file, and the commits that made it ---
//
// Replaces two single-column overlays. Both dumped a whole `git diff` into one 900px box with no
// way to reach a particular file, and neither could show a commit at all — the commit LIST had no
// route until this window needed one (server.ts, slotCommits). The two entry points survive as
// wrappers because six call sites in the board and sidebar use them by name.
export function renderDiffInto(target: HTMLElement, diff: string) {
  // colorize by line prefix — each line is its own textContent node, never innerHTML
  for (const line of diff.split("\n")) {
    const cls = line.startsWith("+") ? "add" : line.startsWith("-") ? "del"
      : (line.startsWith("@@") || line.startsWith("diff ")) ? "hdr" : "";
    const span = el("span", cls, line + "\n");
    target.appendChild(span);
  }
}

// A unified diff's content lines always carry a ' ', '+' or '-' prefix, so `diff --git` at column
// zero is always a file header — the split needs no state machine and file CONTENT cannot spoof it.
// `path` is what the row SAYS (a rename says both sides); `newPath` is what still exists on disk
// and is therefore the only one a file pick or a "read the whole file" can be resolved against.
// They differ for exactly one shape — a rename — and conflating them is why a rename row clicked
// from the board's changed-files card answered "that file is no longer in this diff": the board
// sends the new path (server.ts sessionFiles already reduces `--name-status` to its last field)
// and the diff header had been rendered as "old → new".
interface DiffFile { path: string; newPath: string; text: string; add: number; del: number }
function diffPath(header: string): { path: string; newPath: string } {
  const rest = header.slice("diff --git ".length);
  // A QUOTED header quotes each side WHOLE, `a/`/`b/` prefix inside the quotes — so it matches
  // none of the unquoted patterns below and used to fall through to the raw header as a "path".
  if (rest.startsWith('"')) {
    const q = /^("(?:[^"\\]|\\.)*") ("(?:[^"\\]|\\.)*")$/.exec(rest);
    if (q) {
      const a = gitUnquote(q[1]).slice(2), b = gitUnquote(q[2]).slice(2);
      return { path: a === b ? a : `${a} → ${b}`, newPath: b };
    }
    return { path: rest, newPath: rest };
  }
  // `a/x b/x` for an edit; a rename has two different paths and is shown as such. Matching the
  // same path on both sides first is what keeps filenames containing spaces intact.
  const same = /^a\/(.+) b\/\1$/.exec(rest);
  if (same) return { path: same[1], newPath: same[1] };
  const two = /^a\/(.+?) b\/(.+)$/.exec(rest);
  return two ? { path: two[1] === two[2] ? two[1] : `${two[1]} → ${two[2]}`, newPath: two[2] }
    : { path: rest, newPath: rest };
}
function splitDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = [];
  let cur: DiffFile | undefined;
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      cur = { ...diffPath(line), text: line, add: 0, del: 0 };
      files.push(cur);
      continue;
    }
    if (!cur) continue; // git emits nothing before the first header; a truncation marker lands here
    cur.text += `\n${line}`;
    if (line.startsWith("+") && !line.startsWith("+++")) cur.add++;
    else if (line.startsWith("-") && !line.startsWith("---")) cur.del++;
  }
  return files;
}

type RvSource = "working" | "land";
interface RvDiff {
  heading: string;
  stat: string;
  files: DiffFile[];
  diff: string;
  truncated: boolean;
  // exactly one of these when there is no diff to show. `error` is a refusal from the server;
  // `loadFailed` is a dropped fetch and must never be worded as "nothing changed"; `empty` is a
  // real, measured absence of changes.
  error?: string;
  loadFailed?: boolean;
  empty?: string;
}
interface RvCommit { hash: string; ts: number; subject: string; stat: string }
interface RvCommits { scope: "lane" | "upstream" | "recent"; base: string | null; branch: string | null;
  commits: RvCommit[]; capped: boolean }
// what the commit section is a list OF. "recent" is not a claim about this session's work and is
// worded so — the server can offer no better answer for a branch with no upstream.
const RV_SCOPE: Record<RvCommits["scope"], { head: string; note: string }> = {
  lane: { head: "Commits on this lane", note: "this lane's own commits, since it forked" },
  upstream: { head: "Commits not yet pushed", note: "commits here that the upstream branch does not have" },
  recent: { head: "Recent commits in this repo", note: "this branch has no upstream, so there is no"
    + " \"commits made here\" to compute — this is recent history, NOT a statement about this session" },
};

async function fetchWorkingDiff(slotId: number): Promise<RvDiff> {
  const res = await api(`/api/slots/${slotId}/diff`).catch(() => null);
  if (!res || !res.ok) return { heading: "Working diff", stat: "", files: [], diff: "", truncated: false, loadFailed: true };
  const d = (await res.json().catch(() => ({}))) as
    { branch?: string | null; status?: string[]; diff?: string; truncated?: boolean;
      sessionScoped?: boolean; error?: string };
  const heading = d.sessionScoped
    ? "Session diff — everything this session changed" : "Working diff (uncommitted)";
  if (d.error) return { heading, stat: "", files: [], diff: "", truncated: false, error: d.error };
  const n = d.status?.length ?? 0;
  const diff = d.diff ?? "";
  return {
    heading,
    stat: `${d.branch ?? "?"} · ${n} file${n === 1 ? "" : "s"} changed${d.truncated ? " · diff truncated" : ""}`,
    files: splitDiff(diff), diff, truncated: !!d.truncated,
    empty: diff ? undefined : n
      ? "(changes are untracked — no tracked diff)"
      : d.sessionScoped ? "this session hasn't changed anything yet"
        : "clean working tree — everything is committed",
  };
}

async function fetchLandDiff(slotId: number): Promise<RvDiff> {
  const res = await api(`/api/slots/${slotId}/merge-diff`).catch(() => null);
  const heading = "What will land on main (main…HEAD)";
  // fail closed, as the land confirm does: a dropped fetch must not read as "no changes to land"
  if (!res || !res.ok) return { heading, stat: "", files: [], diff: "", truncated: false, loadFailed: true };
  const d = (await res.json().catch(() => ({ loadFailed: true }))) as
    { main?: string; branch?: string; files?: string[]; diff?: string; truncated?: boolean;
      error?: string; loadFailed?: boolean };
  if (d.loadFailed) return { heading, stat: "", files: [], diff: "", truncated: false, loadFailed: true };
  if (d.error) return { heading, stat: "", files: [], diff: "", truncated: false, error: d.error };
  const n = d.files?.length ?? 0;
  const diff = d.diff ?? "";
  return {
    heading,
    stat: `${d.branch ?? "?"} → ${d.main ?? "main"} · ${n} file${n === 1 ? "" : "s"}${d.truncated ? " · diff truncated" : ""}`,
    files: splitDiff(diff), diff, truncated: !!d.truncated,
    empty: diff ? undefined : "no committed changes to land",
  };
}

function rvDelta(add: number, del: number): HTMLElement {
  const w = el("span", "shrdelta");
  w.appendChild(el("span", "a", `+${add}`));
  w.appendChild(el("span", "d", `−${del}`));
  return w;
}

// what the detail pane is currently showing. A commit is keyed by hash, not by index, so a
// re-render that reorders the list can never swap which commit is on screen. A file carries the
// hash it belongs to (absent = a file of the whole-range diff), because the same path means two
// different diffs depending on whether you reached it through a commit or through the range.
// `untracked` is its own kind because an untracked file HAS no diff — it is not in `git diff` at
// all. Treating it as a file pick would render "that file is no longer in this diff", which is
// true and useless; the file itself is the whole of what is new about it.
type RvPick = { k: "all" } | { k: "file"; path: string; hash?: string } | { k: "commit"; hash: string }
  | { k: "untracked"; path: string };
const samePick = (a: RvPick, b: RvPick): boolean =>
  a.k === b.k
  && (a.k !== "file" || (a.path === (b as { path: string }).path && a.hash === (b as { hash?: string }).hash))
  && (a.k !== "untracked" || a.path === (b as { path: string }).path)
  && (a.k !== "commit" || a.hash === (b as { hash: string }).hash);
// the commit whose content is on screen, whether it was reached directly or through one of its files
const pickCommit = (p: RvPick): string | undefined => p.k === "commit" ? p.hash : p.k === "file" ? p.hash : undefined;

let rvShell: Shell | null = null;

// `startAt` lets a caller open the window ON a file — the board's changed-files card does, because
// clicking one of its rows used to open the whole working diff whichever row you clicked.
export async function openReview(slotId: number, initial: RvSource, startAt?: RvPick) {
  setDrawer(false);
  // the other three windows already do this. Without it a double-click on ± stacks two review
  // windows: openShell() runs synchronously before any fetch, so both exist, both fetch, and one
  // Escape closes both (capture-phase listeners on the same node are not stopped by
  // stopPropagation). One window per surface, closed by whoever opens the next.
  rvShell?.close();
  const isLane = !!fleet.find((s) => s.id === slotId)?.worktree;
  let source: RvSource = isLane ? initial : "working";
  let pick: RvPick = startAt ?? { k: "all" };
  const diffs = new Map<RvSource, RvDiff>();
  let commits: RvCommits | null = null;
  let commitsErr: string | null = null;
  // one entry per commit whose diff has been fetched — a commit is immutable, so this never goes stale
  const commitDiffs = new Map<string, { files: DiffFile[]; diff: string; body: string; truncated: boolean; failed?: boolean }>();

  const shell = openShell({
    id: "review",
    title: "Review",
    subtitle: "loading…",
    detailHint: "Pick a file or a commit on the left — “All changes” shows the whole diff.",
    listWidth: 370,
    onClose: () => { rvShell = null; },
  });
  rvShell = shell;

  const showDiffText = (target: HTMLElement, text: string) => {
    const box = el("div", "difftxt");
    renderDiffInto(box, text);
    target.appendChild(box);
  };

  // The window HEADER carries what the current source is; the detail carries what the current
  // PICK is. Repeating the heading in both (the first cut did) reads as two different statements
  // about the same thing, so "all changes" deliberately renders no heading of its own.
  // the diff answers "what changed"; this answers "what does the file SAY". Same viewer as the
  // picker's Contents and the Commits lens, and it names its revision: on a commit's file that is
  // the commit, on a working-tree file it is the disk. A diff alone cannot tell you whether the
  // three lines above the hunk make sense.
  const rvWholeFile = (path: string, text: string, hash: string | null) => {
    const cwd = fleet.find((s) => s.id === slotId)?.cwd;
    if (!cwd) return;
    const b = el("button", "shrbtn fvopen", "read the whole file") as HTMLButtonElement;
    b.onclick = () => showFileView(shell, {
      path: hash ? path : `${cwd}/${path}`, label: path.split("/").pop() ?? path,
      repo: hash ? cwd : undefined, rev: hash ?? undefined,
      source: hash ? `as commit ${hash} left it — not the file as it is today`
        : "as it is on disk right now, which may already be newer than this diff",
      // the stair's third step is reachable from here too, but only for the file ON DISK: a
      // commit's revision has no editable present, and the server declines to hash one anyway
      edit: hash ? undefined : { slot: slotId },
      // deliberately NO diff here, though the caller has one: the pane this button sits on IS the
      // diff. Opening the viewer on a "what changed" tab would show what the reader just clicked
      // away from. ‹ back is the way to the diff, and it is one click.
      back: { label: "the diff", go: renderDetail },
    });
    shell.detail.appendChild(b);
  };

  const renderDetail = () => {
    shell.detail.replaceChildren();
    if (pick.k === "untracked") {
      const cwd = fleet.find((s) => s.id === slotId)?.cwd;
      const path = pick.path;
      if (!cwd) { shell.detail.appendChild(el("div", "hint shellhint", "this slot has no working directory")); return; }
      showFileView(shell, {
        path: `${cwd}/${path}`, label: path.split("/").pop() ?? path,
        source: "untracked — git has never seen this file, so there is no diff to show. This is all"
          + " of it, as it is on disk.",
        edit: { slot: slotId },
        back: { label: "all changes", go: () => open({ k: "all" }) },
      });
      return;
    }
    const d = diffs.get(source);
    if (!d) { shell.detail.appendChild(el("div", "hint shellhint", "loading…")); return; }
    const hash = pickCommit(pick);
    if (hash) {
      const c = commits?.commits.find((x) => x.hash === hash);
      const cd = commitDiffs.get(hash);
      shell.detail.appendChild(el("div", "rvhead", c?.subject ?? "commit"));
      shell.detail.appendChild(el("div", "diffstat",
        c ? `${c.hash} · ${fmtTs(c.ts)}${c.stat ? ` · ${c.stat}` : ""}` : hash));
      if (!cd) { shell.detail.appendChild(el("div", "hint shellhint", "loading…")); return; }
      if (cd.failed) {
        shell.detail.appendChild(el("div", "diffstat err",
          "couldn't load this commit's diff — pick it again to retry"));
        return;
      }
      // what the commit REPORTS stands above what it changed, as in the Commits lens
      if (pick.k === "commit" && cd.body) shell.detail.appendChild(el("div", "cmbody", cd.body));
      if (pick.k === "file") {
        // into a const first: `pick` is a mutable binding another closure writes, so TS drops its
        // narrowing inside the callback below
        const path = pick.path;
        // `newPath` too: a rename ROW reads "old → new", while every caller that sends a path
        // (the board's changed-files card) sends the side that still exists.
        const f = cd.files.find((x) => x.path === path || x.newPath === path);
        if (!f) { shell.detail.appendChild(el("div", "hint shellhint", "that file is not in this commit")); return; }
        shell.detail.appendChild(el("div", "rvsub", `${f.path} · +${f.add} −${f.del}`));
        rvWholeFile(f.newPath, f.text, hash);
        showDiffText(shell.detail, f.text);
        return;
      }
      if (!cd.diff) {
        shell.detail.appendChild(el("div", "hint shellhint",
          "no textual diff — a merge commit shows none here, and neither does an empty commit"));
        return;
      }
      if (cd.truncated) shell.detail.appendChild(el("div", "diffstat", "diff truncated"));
      showDiffText(shell.detail, cd.diff);
      return;
    }
    if (d.loadFailed) {
      shell.detail.appendChild(el("div", "diffstat err",
        "couldn't load this diff — retry. This is a failed fetch, not an empty diff."));
      return;
    }
    if (d.error) { shell.detail.appendChild(el("div", "diffstat", d.error)); return; }
    if (pick.k === "file") {
      const path = pick.path;
      const f = d.files.find((x) => x.path === path || x.newPath === path);
      if (!f) { shell.detail.appendChild(el("div", "hint shellhint", "that file is no longer in this diff")); return; }
      shell.detail.appendChild(el("div", "rvhead", f.path));
      shell.detail.appendChild(el("div", "diffstat", `+${f.add} −${f.del}`));
      rvWholeFile(f.newPath, f.text, null);
      showDiffText(shell.detail, f.text);
      return;
    }
    if (d.empty) { shell.detail.appendChild(el("div", "hint shellhint", d.empty)); return; }
    showDiffText(shell.detail, d.diff);
  };

  const open = (p: RvPick) => {
    pick = p;
    if (p.k === "commit" && !commitDiffs.has(p.hash)) {
      const hash = p.hash;
      void api(`/api/slots/${slotId}/commit-diff?hash=${encodeURIComponent(hash)}`)
        .then(async (r) => (r.ok
          ? (await r.json()) as { diff?: string; body?: string; truncated?: boolean }
          : { failed: true } as const))
        .catch(() => ({ failed: true } as const))
        .then((j) => {
          const diff = "failed" in j ? "" : j.diff ?? "";
          commitDiffs.set(hash, {
            diff, files: splitDiff(diff), body: "failed" in j ? "" : j.body ?? "",
            truncated: "failed" in j ? false : !!j.truncated,
            failed: "failed" in j,
          });
          if (shell.isOpen() && pick.k === "commit" && pick.hash === hash) renderDetail();
        });
    }
    renderList();
    renderDetail();
    shell.showDetail(true);
  };

  function renderList() {
    shell.list.replaceChildren();
    const rows: ShellRow[] = [];
    let selIdx = -1;
    const sec = (text: string, n?: number, title?: string) => {
      const h = el("div", "shellsec");
      h.appendChild(el("span", "shellsect", text));
      if (n !== undefined) h.appendChild(el("span", "shellsecn", String(n)));
      if (title) h.title = title;
      shell.list.appendChild(h);
    };
    const row = (o: { name: string; sub?: string; right?: HTMLElement; on: RvPick; title?: string;
        ctx?: boolean }) => {
      const r = el("div", `shellrow${o.ctx ? " ctx" : ""}`);
      if (o.title) r.title = o.title;
      const m = el("div", "shrmain");
      m.appendChild(el("div", "shrname", o.name));
      if (o.sub) m.appendChild(el("div", "shrsub", o.sub));
      r.appendChild(m);
      if (o.right) r.appendChild(o.right);
      const act = () => open(o.on);
      r.onclick = act;
      shell.list.appendChild(r);
      if (samePick(o.on, pick)) { r.classList.add("sel"); selIdx = rows.length; }
      rows.push({ el: r, open: act });
    };

    const d = diffs.get(source);
    row({ name: "All changes", sub: d?.stat || undefined, on: { k: "all" } });
    // the file section follows the SELECTION: with a commit open it lists that commit's files, so
    // the list and the diff on screen are never statements about two different sets of changes
    const hash = pickCommit(pick);
    const cd = hash ? commitDiffs.get(hash) : undefined;
    const files = cd ? cd.files : d?.files ?? [];
    if (files.length) {
      sec(cd ? "Files in this commit" : "Changed files", files.length);
      for (const f of files) row({ name: f.path.split("/").pop() ?? f.path, sub: f.path,
        right: rvDelta(f.add, f.del), on: { k: "file", path: f.path, hash }, title: f.path });
    }
    if (commits?.commits.length) {
      const sc = RV_SCOPE[commits.scope];
      sec(sc.head, commits.commits.length, sc.note);
      for (const c of commits.commits)
        row({ name: c.subject || "(no subject)", on: { k: "commit", hash: c.hash },
          // a file of this commit is selected → mark the commit as the context that file sits in
          ctx: c.hash === hash && pick.k === "file",
          sub: `${c.hash} · ${fmtTs(c.ts)}${c.stat ? ` · ${c.stat}` : ""}` });
      if (commits.capped) shell.list.appendChild(el("div", "hint shellhint", "…older commits not listed"));
    }
    if (commitsErr) {
      sec("Commits");
      shell.list.appendChild(el("div", "diffstat err", commitsErr));
    }
    shell.setRows(rows);
    if (selIdx >= 0) shell.select(selIdx, false, false);
  }

  const renderTools = () => {
    shell.tools.replaceChildren();
    if (isLane) {
      for (const [s, label, title] of [
        ["land", "to land", "the resolved diff against main — exactly what a land would fast-forward"],
        ["working", "uncommitted", "what is changed in the lane's tree right now, not yet committed"],
      ] as [RvSource, string, string][]) {
        const b = el("button", `shrbtn${source === s ? " active" : ""}`, label) as HTMLButtonElement;
        b.title = title;
        b.onclick = () => { if (source !== s) { source = s; pick = { k: "all" }; void load(); } };
        shell.tools.appendChild(b);
      }
    }
    const d = diffs.get(source);
    // the ⏏ button appears only on a land diff that actually loaded and has content — the same
    // fail-closed posture as the land confirm, which is where the real gate still lives
    if (isLane && landsEnabled && source === "land" && d && !d.loadFailed && !d.error && !d.empty) {
      const land = el("button", "shrbtn primary", "⏏ land") as HTMLButtonElement;
      land.style.marginLeft = "auto";
      land.onclick = () => { shell.close(); void doMergeLand(slotId); };
      shell.tools.appendChild(land);
    }
  };

  const load = async () => {
    renderTools();
    renderList();
    renderDetail();
    if (!diffs.has(source)) {
      diffs.set(source, source === "land" ? await fetchLandDiff(slotId) : await fetchWorkingDiff(slotId));
      if (!shell.isOpen()) return;
    }
    const d = diffs.get(source);
    shell.setTitle(d?.heading ?? "Review");
    shell.setSubtitle(d?.stat ?? "");
    renderTools();
    renderList();
    renderDetail();
  };

  void load();
  // a window opened ON a commit (a History row of the board) reads it as a click inside does: the pick
  // alone left its detail on "loading…" with no request ever sent (owner 13.10. on the Testinstanz)
  if (startAt?.k === "commit") open(startAt);
  // same failure class as the picker's detail pane: a commit list that cannot load must SAY so.
  // Left silent, a 404 from a server older than this page renders as "this lane has no commits" —
  // a positive claim about the repo, produced from a failed request.
  void api(`/api/slots/${slotId}/commits`)
    .then(async (r) => (r.ok
      ? { c: (await r.json()) as RvCommits }
      : { err: r.status === 404 ? SKEW_NOTE : `couldn't load the commits (${r.status})` }))
    .catch(() => ({ err: "couldn't load the commits — the request failed" }))
    .then((res) => {
      if (!shell.isOpen()) return;
      if ("c" in res && res.c) commits = res.c;
      else if ("err" in res && res.err) commitsErr = res.err;
      renderList();
      if (pickCommit(pick)) renderDetail(); // the open commit's head names its subject from this list
    });
}

// the board and the sidebar reach the land review through this name
export async function openMergeDiff(slotId: number) { await openReview(slotId, "land"); }

// --- audit trail overlay (Backlog #9): owner-only read-only lens over /api/audit ---
// A GLOBAL log, not gated behind a live slot, because the headline question is about a slot
// that has VANISHED — its lifecycle events are unreachable from a per-slot entry point.
// One fetch, then all narrowing (slot filter, lifecycle-only) happens client-side.
interface AuditEntry { ts: number; event: string; slot?: number; detail?: string }
// event kind → category, mirroring how the server groups them (server.ts audit() call sites).
// Category drives the row colour and the lifecycle-only toggle. Unlisted kinds fall to "other".
const AUDIT_CAT: Record<string, string> = {
  slot_open: "lifecycle", slot_kill: "lifecycle", slot_shelve: "lifecycle", self_heal_recreate: "lifecycle",
  slot_restart: "lifecycle",
  auto_fire: "automation", auto_skip: "automation", autos_quiet: "automation", autos_switch: "automation",
  steward_send: "steward", steward_journal: "steward",
  steward_send_capped: "steward", steward_journal_capped: "steward",
  owner_auth_fail: "security", share_auth_ok: "security", share_create: "security", share_revoke: "security",
  guest_ws_connect: "security", guest_ws_disconnect: "security",
  land_note_fail: "repo",
};
const LIFECYCLE_KINDS = new Set(["slot_open", "slot_kill", "slot_shelve", "self_heal_recreate", "slot_restart"]);
// Generic decode = show the raw detail. A per-kind formatter for the kinds whose raw string is
// cryptic and load-bearing — the ones that answer "what was DONE to slot N". Every kind listed here
// is one the live trail actually carries; nothing is written for kinds that have never occurred.
function decodeAudit(event: string, detail?: string): string {
  switch (event) {
    case "slot_open": return detail ? `opened in ${baseName(detail)}` : "opened";
    // the kill reason is recorded and was thrown away here: "landed" and "owner" are different
    // endings, and which one a vanished session had is exactly what this trail is consulted for
    case "slot_kill":
      return detail === "landed" ? "closed after landing"
        : detail === "owner" ? "closed by the owner"
        : `closed${detail ? ` (${detail})` : ""}`;
    case "slot_shelve": {
      const m = detail?.match(/^note:(\d+)(?: review:([0-9a-f]{12}))?$/);
      return m ? `${m[2] ? `parked for review · candidate ${m[2]}` : "shelved"} · ${m[1]}-char note` : "shelved";
    }
    // `created:no-session` / `created:no-transcript` — the reason is the whole point of the field:
    // no-session is the harmless open race, no-transcript is a slot that lost its conversation
    case "self_heal_recreate": {
      const [how, why] = (detail ?? "").split(":");
      const act = how === "resumed" ? "re-attached to its pane" : how === "created" ? "restarted fresh" : "self-healed";
      return why === "no-session" ? `${act} (its tmux session was gone)`
        : why === "no-transcript" ? `${act} (its transcript was gone)`
        : why ? `${act} (${why})` : act;
    }
    // the owner's ↻ — same detail vocabulary as a heal, deliberately a different event: a rebuild
    // nobody asked for and one the owner asked for answer different questions (server/audit-log.ts,
    // the slot_restart comment on the AuditEvent union)
    case "slot_restart": {
      const [how, why] = (detail ?? "").split(":");
      if (how === "resumed") return "restarted by the owner — its conversation came back";
      return why === "no-transcript" ? "restarted by the owner — fresh session (its transcript was gone)"
        : why === "no-session" ? "restarted by the owner — fresh session (nothing was pinned)"
        : "restarted by the owner — fresh session";
    }
    case "auto_fire": return detail ? `scheduled prompt fired · ${detail}` : "scheduled prompt fired";
    case "auto_skip": return detail ? `scheduled prompt skipped · ${detail}` : "scheduled prompt skipped";
    case "postland_audit": return detail ? `post-land audit · ${detail}` : "post-land audit";
    case "dispatch_switch": return detail === "on" ? "dispatcher switched ON" : "dispatcher switched OFF";
    case "owner_auth_fail": return "a request arrived without a valid owner token";
    // an undecoded kind keeps its NAME in front of its raw detail. Returning the bare detail (what
    // this did before) was survivable while the row carried the kind on its sub-line; now that the
    // sub-line carries the project instead, a line reading `d:0 c:true` would name nothing at all.
    default: return detail ? `${event} · ${detail}` : event;
  }
}
// WHICH PROJECT an event happened in. Not recorded per event — only `slot_open` carries a cwd — so
// it is DERIVED: an event belongs to the folder its slot was last opened in before it. Walking the
// trail is the only way to answer it, and it is the question the lens is usually being asked
// ("what did slot 7 do, and where"). A slot whose opening scrolled off the loaded window has no
// answer, and gets none — never the folder from a later open, which would date the event wrongly.
function auditProjects(rows: AuditEntry[]): Map<AuditEntry, string> {
  const out = new Map<AuditEntry, string>();
  const at = new Map<number, string>();
  // the ledger arrives newest-first; cwd propagates forward in TIME, so walk it oldest-first
  for (const e of [...rows].sort((a, b) => a.ts - b.ts)) {
    if (typeof e.slot !== "number") continue;
    if (e.event === "slot_open" && e.detail) at.set(e.slot, e.detail);
    const cwd = at.get(e.slot);
    if (cwd) out.set(e, cwd);
    // a kill ends the slot's tenancy in that folder: the next event there belongs to no project
    // until something opens one again
    if (e.event === "slot_kill") at.delete(e.slot);
  }
  return out;
}
let auditData: AuditEntry[] = [];
let auditTotal = 0; // server-reported PARSED rows on disk; > auditData.length means the load was capped
let auditMalformed = 0;
let auditSlot: number | "all" = "all";
let auditLife = false;
let auditProject = new Map<AuditEntry, string>(); // derived per render — see auditProjects()
// A ledger route now reports the rows it could not parse SEPARATELY from the total, so a torn
// mid-append row cannot masquerade as the benign "capped" message (the total used to count lines
// the response had already dropped). Absent/zero → the count line reads exactly as before.
const tornNote = (malformed: number): string =>
  malformed > 0 ? ` · ⚠ ${malformed} unreadable row${malformed === 1 ? "" : "s"} on disk` : "";

// The AUDIT lens. Same data and same two filters as the overlay it replaces; what is new is that
// selecting an event shows the rest of THAT SLOT's story around it. The trail exists to answer
// "what happened to the session that vanished", and answering it used to mean setting the slot
// filter, finding your event again in the narrowed list, and reading up and down by eye.
function renderAudit() {
  const shell = ocShell;
  if (!shell) return;
  const ctl = el("div", "auditctl");
  // slot filter (the primary axis): "all" + every slot id present in the trail, ascending
  const slots = [...new Set(auditData.map((e) => e.slot).filter((s): s is number => typeof s === "number"))]
    .sort((a, b) => a - b);
  const sel = el("select", "") as HTMLSelectElement;
  const optAll = el("option", "", "all slots") as HTMLOptionElement;
  optAll.value = "all";
  sel.appendChild(optAll);
  for (const s of slots) {
    const o = el("option", "", `slot ${s}`) as HTMLOptionElement;
    o.value = String(s);
    sel.appendChild(o);
  }
  sel.value = auditSlot === "all" ? "all" : String(auditSlot);
  sel.onchange = () => { auditSlot = sel.value === "all" ? "all" : Number(sel.value); renderActivity(); };
  ctl.appendChild(sel);
  const lifeBtn = el("button", `shrbtn${auditLife ? " active" : ""}`, "lifecycle only") as HTMLButtonElement;
  lifeBtn.title = "show only slot_open / slot_kill / slot_shelve / self_heal_recreate / slot_restart";
  lifeBtn.onclick = () => { auditLife = !auditLife; renderActivity(); };
  ctl.appendChild(lifeBtn);

  const rows = auditData.filter((e) =>
    (auditSlot === "all" || e.slot === auditSlot) && (!auditLife || LIFECYCLE_KINDS.has(e.event)));
  const loaded = auditData.length;
  const capped = auditTotal > loaded;
  const count = (rows.length === loaded
    ? capped ? `latest ${loaded} of ${auditTotal} events` : `${loaded} event${loaded === 1 ? "" : "s"}`
    : `${rows.length} of ${capped ? `${loaded} loaded (${auditTotal} total)` : loaded}`) + tornNote(auditMalformed);
  ctl.appendChild(el("span", "auditcount", count));
  shell.tools.appendChild(ctl);
  shell.setSubtitle(count);

  shell.list.replaceChildren();
  auditRowOf = new Map();
  auditProject = auditProjects(auditData);
  const shRows: ShellRow[] = [];
  let selIdx = -1;
  if (!actLoaded.has("audit")) shell.list.appendChild(actLoading("histnone", "loading…"));
  else if (!rows.length) shell.list.appendChild(el("div", "histnone", "no events match this filter"));
  for (const e of rows) {
    const cat = AUDIT_CAT[e.event] ?? "other";
    const r = el("div", `shellrow auditrow cat-${cat}`);
    r.title = `${e.event}${e.detail ? ` · ${e.detail}` : ""}`; // the raw record, kept reachable
    auditRowOf.set(r, e);
    r.appendChild(el("span", "aud-slot" + (typeof e.slot === "number" ? "" : " none"),
      typeof e.slot === "number" ? String(e.slot) : "—"));
    const m = el("div", "shrmain");
    m.appendChild(el("div", "shrname", decodeAudit(e.event, e.detail) || e.event));
    // the project comes SECOND on the sub-line: an event without one is a real state (Fleet-wide
    // events have no slot at all), and an em dash there is quieter than an absent column
    const where = auditProject.get(e);
    m.appendChild(actMeta("shrsub", [[fmtTs(e.ts), true], [where ? baseName(where) : "no project", !!where]]));
    r.appendChild(m);
    const key = `${e.ts}|${e.event}`;
    const act = () => { auditPick = key; renderActivity(); renderAuditDetail(e); shell.showDetail(true); };
    r.onclick = act;
    shell.list.appendChild(r);
    if (key === auditPick) { r.classList.add("sel"); selIdx = shRows.length; }
    shRows.push({ el: r, open: act });
  }
  shell.setRows(shRows);
  if (selIdx >= 0) shell.select(selIdx, false, false);
}

// the selected event, then the same slot's events around it — the timeline the trail is usually
// consulted for, without re-filtering and re-finding your place.
function renderAuditDetail(e: AuditEntry) {
  const shell = ocShell;
  if (!shell) return;
  shell.detail.replaceChildren();
  shell.detail.appendChild(el("div", "rvhead", decodeAudit(e.event, e.detail) || e.event));
  shell.detail.appendChild(actMeta("diffstat", [[fmtTs(e.ts), true], [e.event, true],
    ...typeof e.slot === "number" ? [[`slot ${e.slot}`, false] as const] : [], [AUDIT_CAT[e.event] ?? "other", false]]));
  // where it happened, said in full — the row can only show a folder's basename, and two checkouts
  // of one repo differ in the part it has to cut
  const where = auditProject.get(e);
  if (where) shell.detail.appendChild(el("div", "pkdpath", where.replace(/^\/Users\/[^/]+/, "~")));
  else if (typeof e.slot === "number") shell.detail.appendChild(el("div", "hint shellhint",
    "no project on record for this event — the slot's opening is older than the loaded window,"
    + " or the slot had been closed. Deliberately not filled in from a LATER opening: that folder"
    + " is where the slot went next, not where this happened."));
  if (e.detail) shell.detail.appendChild(el("div", "qdtext", e.detail));

  if (typeof e.slot !== "number") {
    shell.detail.appendChild(el("div", "hint shellhint",
      "this event is not attached to a slot, so there is no per-slot timeline to show"));
    return;
  }
  const sec = el("div", "shellsec");
  sec.appendChild(el("span", "shellsect", `Slot ${e.slot} around this moment`));
  shell.detail.appendChild(sec);
  // ±8 of the slot's own events, in time order (the ledger arrives newest-first). Bounded on
  // purpose: this is context for one event, not a second copy of the list on the left.
  const own = auditData.filter((x) => x.slot === e.slot);
  const at = own.findIndex((x) => x.ts === e.ts && x.event === e.event);
  const near = at < 0 ? own.slice(0, 17) : own.slice(Math.max(0, at - 8), at + 9);
  const tl = el("div", "audtl");
  for (const x of [...near].reverse()) {
    const line = el("div", `audtlrow${x.ts === e.ts && x.event === e.event ? " here" : ""}`);
    line.title = `${x.event}${x.detail ? ` · ${x.detail}` : ""}`;
    line.appendChild(el("span", "aud-ts", fmtTs(x.ts)));
    // the timeline reads as prose now: the raw kind was the wide column and said the least. It
    // stays on the row's tooltip, and the folder is shown where it CHANGES, so a slot that moved
    // between projects is visible as a move instead of as a uniform column repeated per line.
    const w = auditProject.get(x);
    line.appendChild(el("span", "aud-detail", decodeAudit(x.event, x.detail) || x.event));
    if (x.event === "slot_open" && w) line.appendChild(el("span", "aud-kind", baseName(w)));
    tl.appendChild(line);
  }
  shell.detail.appendChild(tl);
  if (own.length > near.length)
    shell.detail.appendChild(el("div", "hint shellhint",
      `showing ${near.length} of this slot's ${own.length} loaded events — filter the list to slot`
      + ` ${e.slot} to read them all`));
}

$("auditbtn").onclick = () => void openActivity("audit");

// an outcome row's key, branch@ts: ts is the only field EVERY outcome row carries, so a row whose
// branch was never recorded still has one.
const landRef = (o: { branch?: string | null; ts: number }) => `${o.branch ?? "(branch not recorded)"}@${o.ts}`;

// --- outcome feed (docs/attic/perception-layer.md §6): the lane-outcome ledger rendered — what landed,
// how, and what ③ said about it. A read-only lens over GET /api/lane-outcomes, same access model as
// the audit trail above (owner-token gated, structurally 404 on share hosts).
// The point is MEASUREMENT, not UI: `knowledge-layers.md` §5 gap 3 argues a prompt land structurally
// beats auto-③ (60s idle + ≤15s tick + ≤180s agent), so the modal row may permanently carry no
// review — and nothing reveals that without a reader. Hence the coverage tally in the header.
// Every honesty constraint lives HERE, in the renderer, because the ledger is append-only and its
// older rows cannot be repaired:
//   · a row with NO `review` key (rows 1–3, written before the field existed) is "not measured" —
//     never "no findings", never clean. A missing measurement and a measured zero are not the same
//     fact, and only the renderer still knows which one it has.
//   · `raw: true` means the reviewer's answer did not PARSE. Its empty findings say nothing about
//     the code, so the row renders as not-a-review. Rows written before `raw` was persisted
//     (discrepancy-audit F5) cannot be told apart retroactively → rendered as ambiguous, not resolved.
//   · zero findings on a parsed review is "the diff-bounded reviewer found nothing in the diff it was
//     given", with its scope — ③ never saw code outside that diff (DP1 proved defects live there).
//   · `verified: false` also fires when the gate could not RUN at all (F9: a lane without installed
//     deps), so the wording is "verify red", never "unsound".
//   · `sessionMs` is the lane's LIFETIME, not work time — labelled as such, never as effort.
//   · `↩ undo` walks the newest lands back one press at a time (a capped stack, 3 deep), so it is
//     still deliberately NOT offered per row — a row is not addressable, only the top of the stack
//     is; the board's single undo button stays the only affordance.
let ocShell: Shell | null = null;
let ocPick: string | null = null;              // landRef() of the selected outcome
let ocRowOf = new Map<HTMLElement, OutcomeRow>(); // which outcome a list row stands for
let auditPick: string | null = null;
let auditRowOf = new Map<HTMLElement, AuditEntry>();
let cmPick: string | null = null;
let cmRowOf = new Map<HTMLElement, RvCommit>();

// --- the COMMITS lens (GET /api/commits) ---
interface CommitsResp { repos: string[]; repo: string | null; branch?: string | null;
  commits: RvCommit[]; capped?: boolean; error?: string }
let cmData: CommitsResp | null = null;
let cmErr: string | null = null;
// The board's SECOND commit list opens this lens on one hash. Held as a want, not as a selection:
// until the list has actually loaded there is no way to know whether that commit is in it, and a
// selection that turns out not to exist must render as a stated miss, never as a blank pane.
let cmWant: { repo: string | null; hash: string; branch?: string | null } | null = null;
// set when the wanted repo is not one Fleet has open at all — a different sentence from
// "that commit is not in this repo's recent history", and the reader needs to know which.
let cmRepoMiss: string | null = null;

async function loadCommitsLens(repo: string | null, branch: string | null = null) {
  const q = repo ? `?repo=${encodeURIComponent(repo)}${branch ? `&branch=${encodeURIComponent(branch)}` : ""}` : "";
  const res = await api(`/api/commits${q}`).catch(() => null);
  if (!res) { cmErr = "couldn't reach the server"; return; }
  if (res.status === 404) { cmErr = SKEW_NOTE; return; }
  if (!res.ok) { cmErr = `the server answered ${res.status}`; return; }
  const d = (await res.json().catch(() => null)) as CommitsResp | null;
  if (!d) { cmErr = "the server's answer was not readable JSON"; return; }
  cmErr = null;
  cmData = d;
}

function renderCommits() {
  const shell = ocShell;
  if (!shell) return;
  shell.list.replaceChildren();
  cmRowOf = new Map();
  if (cmErr) { shell.list.appendChild(el("div", "diffstat err", cmErr)); shell.setRows([]); return; }
  if (!cmData) { shell.list.appendChild(actLoading("hint shellhint", "loading…")); shell.setRows([]); return; }
  if (cmData.error) { shell.list.appendChild(el("div", "hint shellhint", cmData.error)); shell.setRows([]); return; }

  // repo chooser — only when Fleet actually has more than one open, so the common case is quiet
  const ctl = el("div", "auditctl");
  if (cmData.repos.length > 1) {
    const sel = el("select", "") as HTMLSelectElement;
    for (const r of cmData.repos) {
      const o = el("option", "", baseName(r)) as HTMLOptionElement;
      o.value = r;
      o.title = r;
      sel.appendChild(o);
    }
    sel.value = cmData.repo ?? cmData.repos[0];
    sel.onchange = async () => {
      cmData = null; cmPick = null;
      renderActivity();
      await loadCommitsLens(sel.value);
      renderActivity();
    };
    ctl.appendChild(sel);
  } else if (cmData.repo) {
    ctl.appendChild(el("span", "auditcount", baseName(cmData.repo)));
  }
  ctl.appendChild(el("span", "auditcount",
    `${cmData.branch ?? "detached"} · ${cmData.commits.length} commit${cmData.commits.length === 1 ? "" : "s"}`
    + (cmData.capped ? " (latest only)" : "")));
  shell.tools.appendChild(ctl);
  shell.setSubtitle(cmData.repo ? `${baseName(cmData.repo)} · ${cmData.branch ?? "detached HEAD"}` : "");

  const rows: ShellRow[] = [];
  let selIdx = -1;
  if (!cmData.commits.length) shell.list.appendChild(el("div", "histnone", "no commits in this repo"));
  // The board sent us here ON a commit. Resolve it against the list that actually loaded, once:
  // found → select it and paint its change; not found → say which of the two misses it was. A
  // silent no-op would leave the reader on "Pick a row on the left" after clicking a named commit,
  // which reads as "that click does nothing" rather than as the measured fact it is.
  const want = cmWant;
  // the list holds abbreviated hashes; a branch card hands the full one
  const hit = want ? cmData.commits.find((c) => want.hash.startsWith(c.hash)) : undefined;
  if (want) {
    cmWant = null;
    if (hit) cmPick = hit.hash;
    else {
      shell.detail.replaceChildren();
      shell.detail.appendChild(el("div", "rvhead", want.hash));
      shell.detail.appendChild(el("div", "diffstat err", cmRepoMiss
        ? `Fleet has no open session in ${cmRepoMiss}, so this lens cannot read that repository —`
          + " the commit exists, this window just has no route to it."
        : `commit ${want.hash} is not in the recent history this lens lists for `
          + `${cmData.repo ? baseName(cmData.repo) : "this repo"}`
          + (cmData.capped ? " — and the list is capped, so it may sit below the cut."
            : ". It may be on a branch this repo does not currently have checked out.")));
      shell.showDetail(true);
    }
  }
  for (const c of cmData.commits) {
    const r = el("div", "shellrow");
    cmRowOf.set(r, c);
    const m = el("div", "shrmain");
    m.appendChild(el("div", "shrname", c.subject || "(no subject)"));
    m.appendChild(actMeta("shrsub", [[c.hash, true], [fmtTs(c.ts), true], ...c.stat ? [[c.stat, false] as const] : []]));
    r.appendChild(m);
    const act = () => { cmPick = c.hash; renderActivity(); renderCommitDetail(c); shell.showDetail(true); };
    r.onclick = act;
    shell.list.appendChild(r);
    if (c.hash === cmPick) { r.classList.add("sel"); selIdx = rows.length; }
    rows.push({ el: r, open: act });
  }
  shell.setRows(rows);
  if (selIdx >= 0) shell.select(selIdx, false, false);
  if (hit) { renderCommitDetail(hit); shell.showDetail(true); }
}

let cmDiffSeq = 0; // latest-wins: arrow-keying down the commit list outruns the fetches it starts

function renderCommitDetail(c: RvCommit) {
  const shell = ocShell;
  if (!shell) return;
  shell.detail.replaceChildren();
  shell.detail.appendChild(el("div", "rvhead", c.subject || "(no subject)"));
  shell.detail.appendChild(actMeta("diffstat", [[c.hash, true], [fmtTs(c.ts), true], ...c.stat ? [[c.stat, false] as const] : []]));

  // THE CHANGE ITSELF, which is what a commit row is asking about. It used to be absent entirely:
  // the pane showed a provenance note and nothing about the code, so the lens could tell you a
  // commit existed and never what it did.
  const body = el("div", "cmdiff");
  body.appendChild(actLoading("hint shellhint", "reading the change…"));
  shell.detail.appendChild(body);
  const seq = ++cmDiffSeq;
  void (async () => {
    const repo = cmData?.repo, branch = cmData?.branch;
    const res = repo
      ? await api(`/api/commit-diff?repo=${encodeURIComponent(repo)}&hash=${encodeURIComponent(c.hash)}${branch ? `&branch=${encodeURIComponent(branch)}` : ""}`)
        .catch(() => null)
      : null;
    // a superseded fetch must not paint over the commit the cursor has since moved to
    if (!shell.isOpen() || seq !== cmDiffSeq) return;
    body.replaceChildren();
    if (!repo) { body.appendChild(el("div", "hint shellhint", "no repo selected")); return; }
    if (!res) { body.appendChild(el("div", "diffstat err", "couldn't reach the server")); return; }
    if (res.status === 404) { body.appendChild(el("div", "diffstat err", SKEW_NOTE)); return; }
    const d = (await res.json().catch(() => null)) as
      { body?: string; files?: string[]; diff?: string; truncated?: boolean; error?: string } | null;
    if (!d || d.error) {
      body.appendChild(el("div", "diffstat err", d?.error ?? "the server's answer was not readable JSON"));
      return;
    }
    // what the commit REPORTS (a measurement, the commits of a charge) stands above what it changed
    if (d.body) body.appendChild(el("div", "cmbody", d.body));
    const files = d.files ?? [];
    if (files.length) {
      const fsec = el("div", "shellsec");
      fsec.appendChild(el("span", "shellsect", "Files"));
      fsec.appendChild(el("span", "shellsecn", String(files.length)));
      body.appendChild(fsec);
      const list = el("div", "cmfiles");
      // `--name-status` rows are "M\tpath" (and "R100\told\tnew" for a rename) — the path is the
      // LAST field, which is also the one that exists at this revision
      const byPath = new Map(splitDiff(d.diff ?? "").map((x) => [x.newPath, x.text]));
      for (const f of files) {
        // `--name-status` quotes a path holding a space or a non-ASCII byte exactly as porcelain
        // does — undecoded it asks the server for a filename that begins with a quote (GITPATH)
        const path = gitUnquote(f.split("\t").pop() ?? f);
        const rowEl = el("div", "cmfile open", f);
        rowEl.title = `read ${path} as this commit left it`;
        rowEl.onclick = () => showFileView(shell, {
          path, label: path.split("/").pop() ?? path, repo, rev: c.hash,
          source: `as commit ${c.hash} left it — not the file as it is today`,
          diff: byPath.get(path),
          back: { label: "the commit", go: () => renderCommitDetail(c) },
        });
        list.appendChild(rowEl);
      }
      body.appendChild(list);
    }
    if (!d.diff) {
      // a merge commit legitimately has no textual diff against its first parent. Saying "no
      // changes" there would be false; saying nothing at all is what the pane did before.
      body.appendChild(el("div", "hint shellhint",
        "no textual diff — a merge commit shows none against its first parent, and a commit that"
        + " only moves metadata (a mode or an empty tree) has none either"));
      return;
    }
    const box = el("div", "difftxt");
    renderDiffInto(box, d.diff);
    body.appendChild(box);
    if (d.truncated) body.appendChild(el("div", "hint shellhint", "diff truncated — open the commit in a terminal for the rest"));
  })();

  // the JOIN the two lenses exist to make: did this commit arrive through a Fleet land, or not.
  // An outcome row records the branch and the time, so an exact commit-to-outcome identity is not
  // available — this reports the candidates and says plainly that it is a time match, not proof.
  const near = outcomeData.filter((o) => o.disposition === "landed" && Math.abs(o.ts - c.ts) < 3_600_000);
  const sec = el("div", "shellsec");
  sec.appendChild(el("span", "shellsect", "Fleet lands near this commit"));
  shell.detail.appendChild(sec);
  if (!actLoaded.has("lands")) {
    // the ledger is not loaded YET — that is this window's bookkeeping, not a fact about the commit,
    // so it is fetched rather than reported. Re-renders this pane once, if it is still the one shown.
    const note = actLoading("hint shellhint", "checking the land ledger…");
    shell.detail.appendChild(note);
    void loadLens("lands").then(() => {
      if (shell.isOpen() && cmPick === c.hash && actLens === "commits") renderCommitDetail(c);
    });
  } else if (!near.length) {
    shell.detail.appendChild(el("div", "hint shellhint",
      "no land recorded within an hour of this commit — it was probably committed by hand"));
  } else {
    for (const o of near) {
      shell.detail.appendChild(actMeta("shrsub", [[fmtTs(o.ts), true],
        [(o.branch ?? "(branch not recorded)").replace(/^fleet\//, ""), !!o.branch], ...o.shortstat ? [[o.shortstat, false] as const] : []]));
    }
    shell.detail.appendChild(el("div", "hint shellhint",
      "matched by TIME (±1h), not identity — the ledger records a branch and a moment, not the"
      + " commit that resulted. Treat this as a lead, never as provenance."));
  }
}
// Every field optional: this parses ROWS ON DISK, written by older server builds. The renderer
// distinguishes absent from present-and-empty everywhere it matters, so nothing may be defaulted in.
interface OutcomeReviewRow { state?: string; at?: number; model?: string; head?: string | null;
  dirty?: number; patchId?: string | null; landedPatchId?: string | null;
  scope?: string; notes?: string; raw?: boolean; findings?: ReviewFinding[] }
interface OutcomeRow { ts: number; branch?: string | null; base?: string | null; headSha?: string | null;
  disposition?: string; model?: string | null; briefHash?: string | null; shortstat?: string;
  taskId?: string | null; programId?: string | null;
  // HOW the row reached that model (server.ts#resolvedModel, rows since 2026-09-17): „[Zitat entfernt]“ the
  // lane pinned it · "default" it did not and the harness's spawn line passed its own · "ambient"
  // neither, so `model` is null. Absent on every older row, where a null model says only "no pin".
  modelOrigin?: string;
  commitCount?: number; filesTouched?: string[]; e2eTouched?: boolean; verified?: boolean | null;
  sessionMs?: number | null; ownerPrompts?: number; resolvedConflict?: boolean; repairRounds?: number;
  confirmedByHuman?: boolean; review?: OutcomeReviewRow;
  // where the work ended up — the two things that turn `filesTouched` from names into files.
  // Absent on rows written before the server recorded them, and on lanes that never landed.
  repo?: string; mainAfter?: string;
  // FLEET_CLEAN_REVIEW=shadow only. `verdict: null` = the reviewer produced no explicit verdict
  // (the measurement failed) — it is NOT a recorded verdict and must not count toward criterion 2.
  cleanReviewShadow?: { verdict?: "pass" | "would_stop" | null; at?: number; model?: string;
    notes?: string; raw?: boolean } }

// the coverage relation as the RENDERER sees it — the server's four states plus the one the server
// cannot express: a row from before the field existed. "unmeasured" is not a server state and must
// never be collapsed into "none" ("we know nothing covered this" is a measurement; this is not).
type RvRel = "covered" | "superseded" | "inflight" | "none" | "unmeasured";
function reviewRel(o: OutcomeRow): RvRel {
  const s = o.review?.state;
  return s === "covered" || s === "superseded" || s === "inflight" || s === "none" ? s : "unmeasured";
}
const REL_WORD: Record<RvRel, string> = {
  covered: "③ reviewed this exact content",
  superseded: "③ reviewed different content — not coverage of what ended up here",
  inflight: "③ was still running when the lane ended — not captured",
  none: "no ③ review on record for this lane",
  unmeasured: "review not measured — this row predates the review field",
};
const OC_FILE_ROWS = 40; // a land's file list is bounded in the pane, and says so when it is cut
const DISPO_WORD: Record<string, string> = {
  landed: "landed", reverted: "reverted", shelved: "shelved",
  "killed-dirty": "killed with work", "killed-empty": "killed empty",
};

export function fmtDur(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h}h ${min % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}
export function chip(text: string, cls = "", title = ""): HTMLElement {
  const c = el("span", `occhip${cls ? ` ${cls}` : ""}`, text);
  if (title) c.title = title;
  return c;
}

// what ③ actually said, under the constraints above. Returns the body rows for one outcome.
export function reviewBody(r: OutcomeReviewRow): HTMLElement[] {
  const out: HTMLElement[] = [];
  const findings = r.findings ?? [];
  if (r.raw === true) {
    out.push(el("div", "ocwarn", "the reviewer's answer did not parse — this is NOT a review."
      + " Its empty findings say nothing about the code; the raw answer is below."));
    if (r.notes) out.push(el("div", "ocraw", r.notes));
    return out;
  }
  if (r.raw === undefined)
    out.push(el("div", "ocwarn", "written before scope/notes/raw were persisted — whether the"
      + " reviewer's answer parsed at all cannot be told from this row."));
  if (!findings.length)
    out.push(el("div", "ocnote", r.raw === false
      ? "the diff-bounded reviewer found nothing in the diff it was given — not a clean bill of"
        + " health: it never saw code outside that diff."
      : "zero findings here are ambiguous, not clean."));
  else {
    out.push(el("div", "ocsub", `findings — ${findings.length}, worst first`));
    for (const f of findings) {
      const row = el("div", `bfind ${f.impact}`);
      const hd = el("div", "bfindhd");
      hd.appendChild(el("span", "bfindimp", f.impact));
      hd.appendChild(el("span", "bfindt", f.title || "(untitled)"));
      row.appendChild(hd);
      row.appendChild(el("div", "bfindcite", `${f.file}:${f.line} · ${f.basis}`));
      if (f.detail) row.appendChild(el("div", "bfinddet", f.detail));
      if (f.cost) row.appendChild(el("div", "bfindcost", `cost: ${f.cost}`));
      out.push(row);
    }
  }
  if (r.scope) out.push(el("div", "ocmeta", `scope: ${r.scope}`));
  if (r.notes && r.raw === false) out.push(el("div", "ocmeta", `not checked: ${r.notes}`));
  if (r.model && r.at) out.push(el("div", "ocmeta", `${r.model} · ${fmtTs(r.at)}`));
  return out;
}

// --- graduation-criteria progress (docs/attic/graduation-criteria.md §1 + §2) -------------------------
// The criteria are pre-registered numbers; this counts PROGRESS toward them and evaluates nothing.
// Whether a criterion has been satisfied stays the owner's call, made by reading these numbers —
// never a verdict the client draws.
//
// JUDGMENT CALL, made visible on purpose: criterion 1 counts lands recorded "after the F9 fix is
// deployed", and the ledger carries no deploy timestamp — a row cannot say which server build wrote
// it. The closest fact ON the ledger is the F9 fix's own land, so that row is the anchor and counting
// starts at the row AFTER it. This slightly UNDER-counts (the deploy followed its land by minutes,
// during which no land happened) and never over-counts. It also excludes the four pre-review-field
// legacy rows for free, since they precede this anchor.
const K1_ANCHOR_BRANCH = "f9-verify-deps";
// `noConfirmStep`, not `clean`: the field it counts (`confirmedByHuman:false`) records that the land
// needed no second confirm click. It does NOT record that nobody was attending — mergeJob has exactly
// one caller and it is an owner route — and §1 is about UNATTENDED lands. The name says what is
// counted so the criterion's word cannot creep back in through the identifier.
type KProgress = { anchored: boolean; k1: number; noConfirmStep: number; unknown: number; undos: number; k2: number };
// rows arrive newest-first; the streak is a chronological walk, so sort ascending here rather than
// relying on the feed's display order.
function kProgress(rows: OutcomeRow[]): KProgress {
  const asc = [...rows].sort((a, b) => a.ts - b.ts);
  // §2 counts recorded shadow verdicts and asks for NO anchor — K1's anchor is about the F9 verify
  // fix's deploy boundary and says nothing about ②. So K2 is walked over the whole ledger, before
  // and independently of the anchor lookup below; an unanchorable ledger still reports it.
  let k2 = 0;
  for (const o of asc)
    if (o.cleanReviewShadow && (o.cleanReviewShadow.verdict === "pass" || o.cleanReviewShadow.verdict === "would_stop")) k2++;
  const anchor = asc.findIndex((o) => o.branch === K1_ANCHOR_BRANCH);
  if (anchor < 0) return { anchored: false, k1: 0, noConfirmStep: 0, unknown: 0, undos: 0, k2 };
  const after = asc.slice(anchor + 1);
  let k1 = 0, noConfirmStep = 0, unknown = 0, undos = 0;
  for (const o of after) {
    // an undo is `disposition:"reverted"`. It breaks the CONSECUTIVE streak the criterion asks for, and is also
    // reported on its own, so a reset streak never silently reads as "no undo ever happened".
    if (o.disposition === "reverted") { undos++; k1 = 0; noConfirmStep = 0; unknown = 0; }
    else if (o.disposition === "landed") {
      k1++;
      // `confirmedByHuman` is OPTIONAL on the row: absent (or null) means the writer recorded
      // nothing, not that no confirm step happened. Only an explicit `false` says the land needed
      // no confirm click; anything else is counted as unknown and reported, never folded in here.
      if (o.confirmedByHuman === false) noConfirmStep++;
      else if (typeof o.confirmedByHuman !== "boolean") unknown++;
    }
    // shelved / killed-* are not lands at all — they neither count nor break the streak.
  }
  return { anchored: true, k1, noConfirmStep, unknown, undos, k2 };
}

let outcomeData: OutcomeRow[] = [];
let outcomeTotal = 0;
let outcomeMalformed = 0; // rows the server could not parse — a HOLE in the trail, never folded into the total
let outcomeDispo: string | "all" = "all";
let outcomeUncovered = false; // the gap-3 question: which rows landed without ③ having covered them

// The LANDS lens. renderActivity() owns clearing the toolbar and painting the lens switch, so this
// appends rather than replaces — otherwise each filter change would wipe the switch above it.
function renderOutcomes() {
  const shell = ocShell;
  if (!shell) return;
  const ctl = el("div", "auditctl");
  const dispos = [...new Set(outcomeData.map((o) => o.disposition).filter((d): d is string => !!d))].sort();
  const sel = el("select", "") as HTMLSelectElement;
  const optAll = el("option", "", "all outcomes") as HTMLOptionElement;
  optAll.value = "all";
  sel.appendChild(optAll);
  for (const d of dispos) {
    const o = el("option", "", DISPO_WORD[d] ?? d) as HTMLOptionElement;
    o.value = d;
    sel.appendChild(o);
  }
  sel.value = outcomeDispo;
  sel.onchange = () => { outcomeDispo = sel.value; renderActivity(); };
  ctl.appendChild(sel);
  const unc = el("button", `shrbtn${outcomeUncovered ? " active" : ""}`, "not covered by ③") as HTMLButtonElement;
  unc.title = "rows whose review did not describe what ended up here — superseded / inflight / none / not measured";
  unc.onclick = () => { outcomeUncovered = !outcomeUncovered; renderActivity(); };
  ctl.appendChild(unc);
  const capped = outcomeTotal > outcomeData.length;
  ctl.appendChild(el("span", "auditcount",
    (capped ? `latest ${outcomeData.length} of ${outcomeTotal} rows` : `${outcomeData.length} rows`)
    + tornNote(outcomeMalformed)));
  shell.tools.appendChild(ctl);

  // the coverage tally — the whole reason the feed exists. Counted over ALL loaded rows, not the
  // filtered view, so narrowing the list never changes the number the tally reports.
  const tally = { covered: 0, superseded: 0, inflight: 0, none: 0, unmeasured: 0 };
  for (const o of outcomeData) tally[reviewRel(o)]++;
  const tal = el("div", "octally");
  tal.appendChild(el("span", "", "③ coverage:"));
  for (const k of ["covered", "superseded", "inflight", "none", "unmeasured"] as RvRel[])
    tal.appendChild(chip(`${tally[k]} ${k}`, `rel-${k}`, REL_WORD[k]));
  shell.tools.appendChild(tal);

  // criteria progress — counted over ALL loaded rows like the tally above, never the filtered view.
  // No rows at all ⇒ no header: an empty ledger has nothing to say, and "0/20" would state a
  // measurement that was never made.
  if (outcomeData.length) {
    const k = kProgress(outcomeData);
    const kel = el("div", "octally ockrit");
    kel.id = "ockrit";
    if (!k.anchored) {
      kel.appendChild(chip(`criteria progress: no '${K1_ANCHOR_BRANCH}' row in this ledger`, "warn",
        `§1 counting starts after the F9 fix's own land (branch ${K1_ANCHOR_BRANCH}); without that`
        + " row the deploy boundary cannot be placed, so §1 counts nothing rather than counting"
        + " wrong. §2 asks for no anchor and is counted regardless."));
    } else {
      kel.appendChild(el("span", "", "criteria:"));
      kel.appendChild(chip(`K1 ${k.k1}/20`, k.k1 >= 20 ? "ok" : "",
        "graduation-criteria §1 — consecutive Fleet-routed lands recorded after the F9 fix"
        + ` (counted from the row after the '${K1_ANCHOR_BRANCH}' land; an undo resets the streak).`
        + " Counting only — the graduation decision is the owner's, made by reading this number."));
      kel.appendChild(chip(`davon ${k.noConfirmStep}/10 ohne Confirm-Schritt`, k.noConfirmStep >= 10 ? "ok" : "",
        "of that streak, the lands whose row explicitly records confirmedByHuman:false — they needed"
        + " no second confirm click. This is NOT evidence of an unattended land: mergeJob has exactly"
        + " one caller (POST /api/slots/:id/merge), so an owner request started every land on this"
        + " ledger. §1 asks for unattended landing, and this number cannot supply it — it measures"
        + " confirmation depth. Rows that record nothing are excluded and reported as unknown."));
      // the unknown count is shown only when there is one, but it is never silently dropped: an
      // "N/10" read as N-of-the-streak would otherwise be a claim about rows the ledger never made
      // a statement about.
      if (k.unknown) kel.appendChild(chip(`${k.unknown} unknown`, "warn",
        "lands in the streak whose row carries no confirmedByHuman value at all. Unknown is not"
        + " zero: they are excluded from the sub-count rather than counted as needing no confirm."));
      kel.appendChild(chip(`Undos ${k.undos}`, k.undos ? "warn" : "ok",
        "owner undos since the anchor, counted as disposition:\"reverted\" rows."
        + " §1 requires 0 across the 20."));
    }
    // OUTSIDE the anchored branch on purpose: §2 has no anchor requirement, so a shadow verdict
    // counts whether or not §1's deploy boundary can be placed.
    kel.appendChild(chip(`K2 ${k.k2}/25`, k.k2 >= 25 ? "ok" : "",
      "graduation-criteria §2 — recorded ② shadow verdicts, counted across the whole ledger. A row"
      + " whose shadow verdict is null (the reviewer produced no explicit verdict) is a failed"
      + " measurement and does not count."));
    shell.tools.appendChild(kel);
  }

  const rows = outcomeData.filter((o) =>
    (outcomeDispo === "all" || o.disposition === outcomeDispo)
    && (!outcomeUncovered || reviewRel(o) !== "covered"));
  // the LIST is the index: when, what happened, to which branch, and whether ③ described it. Every
  // fact the row used to carry is still rendered in full — in the detail pane, one outcome at a
  // time, which is what the density of these rows was always fighting.
  shell.list.replaceChildren();
  const shRows: ShellRow[] = [];
  let selIdx = -1;
  if (!actLoaded.has("lands")) shell.list.appendChild(actLoading("histnone", "loading…"));
  else if (!rows.length) shell.list.appendChild(el("div", "histnone", "no outcomes match this filter"));
  for (const o of rows) {
    const ref = landRef(o);
    const dispo = o.disposition ?? "unknown";
    const r = el("div", `shellrow dis-${dispo}`);
    const m = el("div", "shrmain");
    const nm = el("div", "shrname");
    nm.appendChild(el("span", "ocdispo", DISPO_WORD[dispo] ?? dispo));
    nm.appendChild(el("span", "ocbranch", (o.branch ?? "(branch not recorded)").replace(/^fleet\//, "")));
    m.appendChild(nm);
    m.appendChild(actMeta("shrsub", [[fmtTs(o.ts), true], ...o.shortstat ? [[o.shortstat, false] as const] : []]));
    r.appendChild(m);
    // the coverage relation is the one fact worth carrying in the index — it is what the feed is for
    r.appendChild(chip(reviewRel(o) === "covered" ? "③" : "·", `rel-${reviewRel(o)}`, REL_WORD[reviewRel(o)]));
    const act = () => { ocPick = ref; renderActivity(); renderOutcomeDetail(o); shell.showDetail(true); };
    r.onclick = act;
    shell.list.appendChild(r);
    if (ref === ocPick) { r.classList.add("sel"); selIdx = shRows.length; }
    ocRowOf.set(r, o);
    shRows.push({ el: r, open: act });
  }
  shell.setRows(shRows);
  if (selIdx >= 0) shell.select(selIdx, false, false);
}

// Everything the feed knows about ONE outcome. Moved here verbatim from the row renderer: every
// honesty constraint below is asserted by e2e/outcomes.ts as SOURCE TEXT — absent ≠ false for
// confirmedByHuman / resolvedConflict / repairRounds, an absent briefHash never rendering as an
// identity two rows share, an unlabeled row never defaulting to a verdict. Those checks work by
// slicing this file between two landmark statements in the landed-chips block below, so the WORDING
// here is a contract, and this comment must not restate those landmarks literally: an earlier draft
// did, indexOf() matched the comment instead of the code, and four checks silently went vacuous.
function renderOutcomeDetail(o: OutcomeRow) {
  const shell = ocShell;
  if (!shell) return;
  shell.detail.replaceChildren();
  {
    const rel = reviewRel(o);
    const dispo = o.disposition ?? "unknown";
    const row = shell.detail;
    const hd = el("div", "ochd");
    hd.appendChild(el("span", "aud-ts", fmtTs(o.ts)));
    hd.appendChild(el("span", "ocdispo", DISPO_WORD[dispo] ?? dispo));
    hd.appendChild(el("span", "ocbranch", (o.branch ?? "(branch not recorded)").replace(/^fleet\//, "")));
    row.appendChild(hd);

    const facts = el("div", "ocfacts");
    // a footprint of exactly nothing is NOT rendered as "0 files changed": rows 1–2 of the ledger
    // are rows of zeros the recorder never measured, and an owner ⏏ land of already-integrated work
    // is legitimately empty. The row cannot tell those apart, so neither does the wording.
    const noFootprint = !o.shortstat && !o.commitCount && !(o.filesTouched?.length);
    if (noFootprint) {
      facts.appendChild(chip("footprint not recorded", "warn",
        "no commits, files or shortstat on this row — either nothing was there to land"
        + " (an already-integrated ⏏ land) or the recorder never measured it. The row cannot say which."));
    } else {
      if (o.shortstat) facts.appendChild(chip(o.shortstat));
      facts.appendChild(chip(`${o.commitCount ?? 0} commit${o.commitCount === 1 ? "" : "s"}`));
      facts.appendChild(chip(`${o.filesTouched?.length ?? 0} file${o.filesTouched?.length === 1 ? "" : "s"}`,
        "", (o.filesTouched ?? []).join("\n")));
      if (o.e2eTouched) facts.appendChild(chip("touched the safety net", "ok"));
    }
    facts.appendChild(o.verified === true ? chip("verify green", "ok")
      : o.verified === false ? chip("verify red", "warn",
          "the merge verify did not pass. It also reports red when the gate could not RUN"
          + " at all (a lane with no installed deps) — this is not by itself a claim the change is unsound.")
      : chip("no verify ran", "dim", "no deterministic verify verdict is on record for this outcome —"
          + " either no verify command was configured, or one ran and DECLINED to verify this tree"
          + " (skipped). The row cannot say which; the lane's merge verdict can."));
    if (dispo === "landed") {
      // ABSENT ≠ FALSE, and the label must describe the field it has. Two separate defects lived
      // here: the missing case rendered a positive "landed clean and green" claim — the strongest
      // statement in the feed, produced from no data — and `false` was worded as if nobody was present.
      // It does not: `mergeJob` has exactly one caller (POST /api/slots/:id/merge, an owner route),
      // so every land on this ledger was started by an owner request. What the field records is the
      // CONFIRM STEP: did the land need a second confirm click, or not.
      facts.appendChild(o.confirmedByHuman === true
        ? chip("owner confirmed this land", "", "the owner confirmed a reviewed resolution, or ⏏-landed"
            + " already-integrated work — this land carries an explicit second confirmation.")
        : o.confirmedByHuman === false
          ? chip("no confirm step", "", "this land needed no second confirm click (clean rebase + green"
              + " verify). NOT evidence that it was unattended: mergeJob has exactly one caller"
              + " (POST /api/slots/:id/merge), so an owner request started this land too.")
          : chip("confirm step not recorded", "dim", "this row carries no confirmedByHuman value at all."
              + " Whether a confirm step happened is unknown — never assumed either way."));
      if (o.resolvedConflict === true) facts.appendChild(chip("agent resolved conflicts", "warn"));
      else if (typeof o.resolvedConflict !== "boolean")
        facts.appendChild(chip("conflict resolution not recorded", "dim",
          "no resolvedConflict value on this row — whether an agent chose the resolutions is unknown, not \"no\"."));
      if (typeof o.repairRounds !== "number")
        facts.appendChild(chip("repair rounds not recorded", "dim",
          "no repairRounds value on this row — \"zero repair rounds ran\" and \"nobody counted\" are different facts."));
      else if (o.repairRounds)
        facts.appendChild(chip(`${o.repairRounds} repair round${o.repairRounds === 1 ? "" : "s"}`, "warn"));
    }
    facts.appendChild(typeof o.sessionMs === "number"
      ? chip(`lane lifetime ${fmtDur(o.sessionMs)}`, "dim",
          "wall-clock from session start to this terminal event — NOT time spent working, and not an effort measure")
      : chip("lifetime not recorded", "dim"));
    facts.appendChild(typeof o.ownerPrompts === "number"
      ? chip(`${o.ownerPrompts} owner prompt${o.ownerPrompts === 1 ? "" : "s"}`, "dim")
      : chip("owner prompts not recorded", "dim",
          "no ownerPrompts value on this row — \"nobody prompted this lane\" and \"nobody counted\" are"
          + " different facts, and a row without the field states only the second."));
    // The model is shown WITH its origin, because since 2026-09-17 a present model no longer means
    // the lane pinned one: a lane founded without a pin records the model its spawn line passed, and
    // rendering that as a bare id would read as a decision nobody made. The two null cases stay
    // apart for the same reason — a row that says "the harness chose" measured something, a row from
    // before the field says only that nothing was pinned.
    facts.appendChild(o.model
      ? o.modelOrigin === "default"
        ? chip(`${o.model} (fleet default)`, "dim",
            "this lane pinned NO model — the harness's spawn line passed the fleet default, resolved"
            + " into the ledger at write time. It is what ran, not what anybody chose for this lane.")
        : chip(o.model, "dim", o.modelOrigin === "spawn" ? "this lane was founded on this model" : "")
      : o.modelOrigin === "ambient"
        ? chip("model chosen by the harness", "dim",
            "this lane pinned no model and its harness names no default Fleet can read, so the id is"
            + " not recoverable — the row says so rather than borrowing one.")
        : chip("model not pinned", "dim"));
    // model and briefHash are an ENTANGLED pair (server.ts, the LaneOutcome header): a strong brief
    // lets a weak model succeed, so the model is never the whole story. And the null case is a trap:
    // 14 rows on the live ledger carry `briefHash: null` (a dispatcher- or terminal-briefed lane logs
    // no owner prompt), and all 14 nulls compare EQUAL — so absence must never render as a value that
    // could read as „[Zitat entfernt]“.
    facts.appendChild(o.briefHash
      ? chip(`brief ${o.briefHash}`, "dim", "stable hash of this lane's FIRST owner prompt — two rows"
          + " carrying the same hash were briefed with the same text.")
      : chip("no brief on record", "dim", "this row has no briefHash — the lane was briefed by a route"
          + " that logs no owner prompt (dispatcher/terminal), or nothing was recorded. An ABSENT value,"
          + " never a hash: rows showing this were NOT briefed alike, they are simply uncounted."));
    row.appendChild(facts);

    // WHAT THIS LAND PUT IN THE TREE. The row has carried the file list all along and showed it
    // only as a chip tooltip, so a land whose review is absent — most of them — rendered as a line
    // saying nothing was recorded and nothing else. The files are recorded, and they are the answer
    // to "what was this". Shown before the review block for that reason: the change is the subject,
    // the review is a comment on it.
    const touched = o.filesTouched ?? [];
    if (touched.length) {
      const fsec = el("div", "shellsec");
      // "land" only where one happened: this feed also carries shelved and killed lanes, whose
      // files were touched and never landed. Calling those a land would be the row lying.
      fsec.appendChild(el("span", "shellsect",
        dispo === "landed" ? "Files this land touched" : "Files this lane touched"));
      fsec.appendChild(el("span", "shellsecn", String(touched.length)));
      row.appendChild(fsec);
      const list = el("div", "cmfiles");
      // A PATH IS NOT A FILE YOU CAN OPEN. It needs a repository to read from and a revision to
      // read AT, and this was the one file list of the four that had neither — so it was the one
      // that stayed dead while the other three became clickable. A landed row now carries both.
      // Rows written before the server recorded them, and lanes that never landed, have no
      // revision to offer and say that instead of dangling a click that cannot work.
      const at = o.repo && o.mainAfter ? { repo: o.repo, rev: o.mainAfter } : null;
      for (const f of touched.slice(0, OC_FILE_ROWS)) {
        const fr = el("div", `cmfile${at ? " open" : ""}`, f);
        if (at) {
          fr.title = `read ${f} at ${at.rev.slice(0, 8)}`;
          fr.onclick = () => showFileView(shell, {
            path: f, label: f.split("/").pop() ?? f, repo: at.repo, rev: at.rev,
            source: `as this ${dispo === "reverted" ? "land left it before it was reverted" : "land left it"} — ${at.rev.slice(0, 8)}`,
            back: { label: "the outcome", go: () => renderOutcomeDetail(o) },
          });
        }
        list.appendChild(fr);
      }
      row.appendChild(list);
      if (touched.length > OC_FILE_ROWS)
        row.appendChild(el("div", "hint shellhint", `${OC_FILE_ROWS} of ${touched.length} shown`));
      if (!at)
        row.appendChild(el("div", "hint shellhint", dispo === "landed" || dispo === "reverted"
          ? "these names cannot be opened — this row was recorded before it carried its repository"
          : "this lane never landed, so there is no revision to read these files at"));
    }

    const rv = el("div", `ocrev rel-${rel}`);
    rv.appendChild(el("div", "ocrel", REL_WORD[rel]));
    // what that RELATION means for reading this row. The bare phrase is accurate and was the whole
    // block for every row without a review, which reads as a dead end rather than as a fact about
    // coverage — and the coverage gap is the thing the feed exists to make visible.
    const REL_WHY: Record<RvRel, string> = {
      covered: "the findings below describe the content that actually landed.",
      superseded: "③ ran, then the lane moved on. Read the findings as being about an EARLIER state"
        + " of this branch — not about what is now in the tree.",
      inflight: "the lane ended while ③ was still running, so its answer was never captured."
        + " Nothing was reviewed away; nothing was reviewed either.",
      none: "no reviewer output was recorded for it. That is a gap in COVERAGE, not a verdict on the"
        + " change: a prompt land structurally beats auto-③ (60s idle + a ≤15s tick + the agent's own"
        + " run), so a fast land routinely lands before any review could exist. The files above and"
        + " the commit in the repo are what this row can be judged by.",
      unmeasured: "this row predates the review field, so the ledger cannot say whether one ran.",
    };
    rv.appendChild(el("div", "ocrelwhy", REL_WHY[rel]));
    if ((rel === "covered" || rel === "superseded") && o.review)
      for (const n of reviewBody(o.review)) rv.appendChild(n);
    row.appendChild(rv);
  }
}

// --- THE DOSSIER LENS: one lane read as one story ----------------------------------------------
//
// The three lenses below answer "what has been happening" across ALL lanes, each from its own
// ledger. This one turns the question ninety degrees: everything about ONE lane, in the order it
// happened. The join is the server's (GET /api/lane — see the dossier region in server.ts); this is
// the reader, and its whole job is to render a tri-state source honestly.
//
// THE RULE, and the only rule that makes this window worth having: a source that could not be
// consulted renders as NOT MEASURED, with the reason, and never as an empty section. An empty
// section reads as "nothing happened in this lane", which is a claim — and the wrong one. Same
// bargain the outcome feed makes with "empty findings ≠ clean".
type LaneIndexRow = { branch: string; repo: string | null; ts: number; disposition: string | null; live: number | null };
type Measured<T> = { state: "read"; value: T } | { state: "unknown"; why: string };
type Capped<T> = { rows: T[]; total: number };
type LandNoteRead = { state: "read" | "absent" | "unreadable"; sha: string;
  note?: Record<string, unknown>; why?: string };
type DossierTask = { id: string; text: string; kind: string; source: string; status: string;
  releasedBy?: string; note: string | null; files?: string[];
  brief?: { text: string; at: number; model: string; edited: boolean; by?: "owner" | "main" };
  criterion?: { text: string; proposedAt: number; confirmedAt: number | null };
  match: string };
type DossierAudit = { at: number; result: string; mainSha: string; covers: string[]; reason?: string;
  exitCode: number | null; out: string; cmd: string; fails?: string[];
  adjudication?: { verdict: string; at: number; by: string | { rule: string } | { role: "orchestrator"; slot: number; openedAt: number }; note?: string } };
interface Dossier {
  branch: string; repo: string | null; worktree: string | null;
  slot: number | null; liveSlot: number | null;
  task: Measured<DossierTask | null>;
  prompts: Measured<Capped<{ ts?: number; text?: string; source?: string; label?: string }>>;
  events: Measured<Capped<{ ts?: number; event?: string; slot?: number; detail?: string }>>;
  commits: Measured<Capped<{ sha: string; at: number; author: string; subject: string }>>;
  outcomes: Measured<Capped<Record<string, unknown>>>;
  landNotes: Measured<LandNoteRead[]>;
  audits: Measured<Capped<DossierAudit>>;
  context?: DossierContext;
}
// chosen / delivered / borrowed, each with its own third state: `absent` is a ledger that was read
// and holds no row for this lane — a named fact, drawn as one, never as an empty column
type ContextColumn<T> = { state: "read"; rows: T[]; total: number }
  | { state: "absent"; why: string } | { state: "unknown"; why: string };
type DossierContext = {
  chosen: ContextColumn<{ receipt: string; at: number; head: string | null;
    selected: { id: string; origin: string | null; privateVerdict: string | null }[]; omitted: { id: string; why: string }[] }>;
  delivered: ContextColumn<{ receipt: string; at: number; packs: string[]; bytes: number | null; notes: string[]; source: string | null }>;
  borrowed: ContextColumn<{ at: number; id: string; bytes: number | null; origin: string | null; head: string | null }>;
  read: "unknown";
  unknown: string[];
};
let akteData: LaneIndexRow[] = [];
let akteTotal = 0;
let aktePick: string | null = null;
let akteDoc: Dossier | null = null;
let akteBusy = false;

// The one piece of rendering this lens is FOR. Everything else here is layout; this is the contract:
// `unknown` prints the reason under a "not measured" heading and returns false, so the caller draws
// no rows and no reassuring emptiness. `read` returns true and the caller renders what is there —
// including nothing, which at that point is a measurement and says so in its own words.
function akteSource<T>(host: HTMLElement, title: string, src: Measured<T>, emptyWord: string): T | null {
  host.appendChild(el("div", "aktehead", title));
  if (src.state === "unknown") {
    const box = el("div", "akteunknown");
    box.appendChild(el("div", "akteunknownw", "not measured"));
    box.appendChild(el("div", "shrsub", src.why));
    host.appendChild(box);
    return null;
  }
  const v = src.value as unknown as { rows?: unknown[] } | unknown[] | null;
  const n = Array.isArray(v) ? v.length : Array.isArray(v?.rows) ? v.rows.length : v === null ? 0 : 1;
  if (n === 0) { host.appendChild(el("div", "hint shellhint", emptyWord)); return null; }
  return src.value;
}

// one entry on the trail: when, which source it came from, what it says
// `subMono`: the sub is a record one copies (a slot event's raw detail, a sha) rather than words
function akteStep(host: HTMLElement, kind: string, ts: number, title: string, sub?: string, subMono = false): HTMLElement {
  const r = el("div", `aktestep step-${kind}`);
  r.appendChild(el("span", "aktekind", kind));
  const m = el("div", "shrmain");
  m.appendChild(el("div", "shrname", title));
  m.appendChild(actMeta("shrsub", [[ts ? fmtTs(ts) : "—", !!ts], ...sub ? [[sub, subMono] as const] : []]));
  r.appendChild(m);
  host.appendChild(r);
  return r;
}

function renderAkte() {
  const shell = ocShell;
  if (!shell) return;
  const ctl = el("div", "auditctl");
  const loaded = akteData.length;
  const count = akteTotal > loaded ? `latest ${loaded} of ${akteTotal} lanes` : `${loaded} lane${loaded === 1 ? "" : "s"}`;
  ctl.appendChild(el("span", "auditcount", count));
  shell.tools.appendChild(ctl);
  shell.setSubtitle(count);

  shell.list.replaceChildren();
  const shRows: ShellRow[] = [];
  let selIdx = -1;
  if (!actLoaded.has("akte")) shell.list.appendChild(actLoading("histnone", "loading…"));
  else if (!loaded) shell.list.appendChild(el("div", "histnone", "no lanes on record"));
  for (const l of akteData) {
    const r = el("div", "shellrow akterow");
    r.title = l.repo ? `${l.branch} · ${l.repo}` : l.branch;
    const m = el("div", "shrmain");
    m.appendChild(el("div", "shrname mono", l.branch));
    // a live lane has no disposition yet and saying "landed"/"—" for it would be a claim; "open"
    // is the honest word for a lane whose story is still being written
    const state = l.live !== null ? `open · slot ${l.live}` : l.disposition ?? "no outcome recorded";
    // ts 0 means the server could not read a time for this lane (a live pane with no transcript
    // yet) — printing the epoch there would be a fabricated date, so the field simply says nothing
    m.appendChild(actMeta("shrsub", [...l.ts ? [[fmtTs(l.ts), true] as const] : [], [state, false], ...l.repo ? [[baseName(l.repo), true] as const] : []]));
    r.appendChild(m);
    // the busy flag is set BEFORE the re-render, not inside the loader: renderActivity runs
    // synchronously here, so a flag the loader sets afterwards would arrive one frame too late and
    // the detail pane would keep showing the PREVIOUS lane while this one is being fetched
    const act = () => {
      aktePick = l.branch;
      akteDoc = null;
      akteBusy = true;
      renderActivity();
      void loadAkteDoc(l.branch);
      shell.showDetail(true);
    };
    r.onclick = act;
    shell.list.appendChild(r);
    if (l.branch === aktePick) { r.classList.add("sel"); selIdx = shRows.length; }
    shRows.push({ el: r, open: act });
  }
  shell.setRows(shRows);
  if (selIdx >= 0) shell.select(selIdx, false, false);
  if (akteDoc && akteDoc.branch === aktePick) renderAkteDetail(akteDoc);
  else if (akteBusy) { shell.detail.replaceChildren(); shell.detail.appendChild(actLoading("hint shellhint", "reading…")); }
}

async function loadAkteDoc(branch: string) {
  const res = await api(`/api/lane?branch=${encodeURIComponent(branch)}`);
  akteBusy = false;
  // the selection moved on while this was in flight — that answer is about a different lane now
  if (aktePick !== branch) return;
  const shell = ocShell;
  if (!res.ok) {
    // the route itself failing is its own state, and it must not be left looking like a lane with
    // nothing in it — the same rule the sources inside the dossier follow
    if (shell && actLens === "akte") {
      shell.detail.replaceChildren();
      shell.detail.appendChild(el("div", "akteunknown", `the dossier could not be read (HTTP ${res.status})`));
    }
    return;
  }
  akteDoc = (await res.json()) as Dossier;
  if (shell?.isOpen() && actLens === "akte") renderAkteDetail(akteDoc);
}

// ② THE CONTEXT, three narrow columns that are never merged: what the founding receipt CHOSE, what
// it says reached the pane, and what the lane fetched through the borrow door later. A fourth
// fact — whether anything was read — is not on any ledger, and the movement says so in words.
const AKTE_CTX_ID = "font-size:12px;color:#ddd";
const AKTE_CTX_META = "font-size:10.5px;color:#6f6f6f";
// one pack per line: the id, and beside it the fact that belongs to it (bytes, time, why left out);
// `word` for a line that holds a sentence where an id would stand — it reads in sans, not as an id
function akteCtxLine(col: HTMLElement, id: string, meta = "", dim = false, word = false) {
  const row = el("div", "aktectxrow");
  row.style.cssText = "display:flex;flex-wrap:wrap;gap:0 8px;align-items:baseline;line-height:1.5";
  row.appendChild(el("span", word ? "" : "mono", id)).style.cssText = dim ? AKTE_CTX_META : AKTE_CTX_ID;
  if (meta) row.appendChild(el("span", "", meta)).style.cssText = AKTE_CTX_META;
  col.appendChild(row);
}
function akteCtxNote(col: HTMLElement, text: string) {
  col.appendChild(el("div", "", text)).style.cssText = `${AKTE_CTX_META};margin-top:2px`;
}

function akteContextColumn<T>(col: HTMLElement, title: string, src: ContextColumn<T>,
  rows: (rows: T[]) => void) {
  col.appendChild(el("div", "aktectxhead", title)).style.cssText =
    "font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--dim);margin-bottom:4px";
  if (src.state === "unknown") {
    const box = el("div", "akteunknown");
    box.appendChild(el("div", "akteunknownw", "not measured"));
    box.appendChild(el("div", "shrsub", src.why));
    col.appendChild(box);
    return;
  }
  if (src.state === "absent") {
    akteCtxLine(col, "none on record", "", false, true);
    akteCtxNote(col, src.why);
    return;
  }
  rows(src.rows);
  if (src.total > src.rows.length) akteCtxNote(col, `${src.total - src.rows.length} older not shown`);
}

function renderAkteContext(host: HTMLElement, c: DossierContext | undefined) {
  host.appendChild(el("div", "aktehead", "② the context it was given"));
  if (!c) {
    const box = el("div", "akteunknown");
    box.appendChild(el("div", "akteunknownw", "not measured"));
    box.appendChild(el("div", "shrsub", "this server sends no context section with the dossier"));
    host.appendChild(box);
    return;
  }
  host.appendChild(el("div", "hint shellhint",
    "Read is not measured: these ledgers record what was chosen, sent and fetched — never whether the lane read it."));
  const grid = el("div", "aktectx");
  grid.style.cssText = "display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:8px 0 4px;padding:0 3px";
  const column = () => {
    const col = el("div", "aktectxcol");
    col.style.cssText = "min-width:0;word-break:break-word";
    grid.appendChild(col);
    return col;
  };
  // a lane re-founded on its worktree has more than one receipt; the time keeps them apart
  const when = (at: number) => (at ? fmtTs(at) : "—");

  const chosen = column();
  akteContextColumn(chosen, "chosen", c.chosen, (rows) => {
    for (const r of rows) {
      if (rows.length > 1) akteCtxNote(chosen, when(r.at));
      for (const p of r.selected)
        akteCtxLine(chosen, p.id, [p.origin === "program" ? "program" : "", p.privateVerdict ? `private · ${p.privateVerdict}` : ""]
          .filter(Boolean).join(" · "));
      for (const p of r.omitted) akteCtxLine(chosen, p.id, `left out · ${p.why}`, true);
      if (!r.selected.length && !r.omitted.length) akteCtxNote(chosen, "the receipt lists no pack");
    }
  });
  const delivered = column();
  akteContextColumn(delivered, "delivered", c.delivered, (rows) => {
    for (const r of rows) {
      akteCtxNote(delivered, `${when(r.at)}${r.bytes !== null ? ` · ${fmtSize(r.bytes)} into the pane` : ""}`
        + `${r.notes.length ? ` · ${r.notes.length} note${r.notes.length === 1 ? "" : "s"}` : ""}`);
      for (const id of r.packs) akteCtxLine(delivered, id);
      if (!r.packs.length) akteCtxNote(delivered, "no pack crossed");
    }
  });
  const borrowed = column();
  akteContextColumn(borrowed, "borrowed", c.borrowed, (rows) => {
    for (const r of rows) akteCtxLine(borrowed, r.id, `${when(r.at)}${r.bytes !== null ? ` · ${fmtSize(r.bytes)}` : ""}`);
  });
  host.appendChild(grid);
  for (const u of c.unknown) host.appendChild(el("div", "hint shellhint", u));
}

// The trail itself, in the five movements a lane actually has: what it was asked to do, the context
// it was given, what it did, how it landed, and what was measured afterwards.
function renderAkteDetail(d: Dossier) {
  const shell = ocShell;
  if (!shell) return;
  const host = shell.detail;
  host.replaceChildren();
  host.appendChild(el("div", "rvhead mono", d.branch));
  host.appendChild(actMeta("diffstat", [[d.repo ? baseName(d.repo) : "repository unknown", !!d.repo],
    [d.liveSlot !== null ? `open in slot ${d.liveSlot}` : d.slot !== null ? `ran in slot ${d.slot}` : "slot unknown", false]]));

  // ① THE ORDER
  const task = akteSource(host, "① the order", d.task,
    "no queue row matches this lane — it was opened by hand, or its row aged out of the queue (capped at 200)");
  if (task) {
    const t = task as DossierTask;
    host.appendChild(el("div", "aktetext", t.text));
    // HOW the row was tied to this lane, because the three joins are not equally strong and a
    // hash match on a torn-down lane is an inference, not a binding
    host.appendChild(el("div", "shrsub", `${t.source} · ${t.kind} · ${t.status}`
      + `${t.releasedBy ? ` · released by ${t.releasedBy}` : ""}`
      + ` · matched by ${t.match === "slot" ? "live slot binding" : `${t.match} (inferred from the lane's first prompt)`}`));
    if (t.criterion) {
      host.appendChild(el("div", "aktehead", "done-criterion"));
      host.appendChild(el("div", "aktetext", t.criterion.text));
      const crit = el("div", "shrsub", t.criterion.confirmedAt ? "confirmed by the owner "
        : "PROPOSED — never confirmed by the owner, so nothing was measured against it");
      if (t.criterion.confirmedAt) crit.appendChild(el("span", "mono", fmtTs(t.criterion.confirmedAt)));
      host.appendChild(crit);
    }
    if (t.brief) {
      host.appendChild(el("div", "aktehead", "the brief it was sent"));
      host.appendChild(el("div", "aktepre aktebrief", t.brief.text));
      const meta = actMeta("shrsub", [[t.brief.model, true], [fmtTs(t.brief.at), true]]);
      if (t.brief.edited) meta.append(briefByMain(t.brief) ? " · sharpened by its Program-MAIN" : " · edited by the owner");
      host.appendChild(meta);
    }
  }

  renderAkteContext(host, d.context);

  // ③ WHAT IT DID — prompts, slot events and commits merged into one chronological stream, which
  // is the whole point: they are three files today and one story in fact.
  const prompts = akteSource(host, "③ what it did", d.prompts, "no prompt was ever sent to this lane");
  const events = d.events.state === "read" ? d.events.value : null;
  const commits = d.commits.state === "read" ? d.commits.value : null;
  type Step = { ts: number; kind: string; title: string; sub?: string; subMono?: boolean };
  const steps: Step[] = [];
  for (const p of prompts?.rows ?? [])
    steps.push({ ts: p.ts ?? 0, kind: "prompt", title: (p.text ?? "").slice(0, 400), sub: p.source ?? "" });
  for (const e of events?.rows ?? [])
    steps.push({ ts: e.ts ?? 0, kind: "slot", title: e.event ?? "", sub: e.detail ?? "", subMono: true });
  for (const c of commits?.rows ?? [])
    steps.push({ ts: c.at, kind: "commit", title: c.subject, sub: `${c.sha.slice(0, 8)} · ${c.author}`, subMono: true });
  steps.sort((a, b) => a.ts - b.ts);
  // a cut list must say so. Silently showing 200 of 900 prompts is the same failure as rendering an
  // unread source as empty: the reader believes they have seen the lane.
  const cut = [
    prompts && prompts.total > prompts.rows.length ? `${prompts.total - prompts.rows.length} older prompt(s)` : "",
    events && events.total > events.rows.length ? `${events.total - events.rows.length} older slot event(s)` : "",
    commits && commits.total > commits.rows.length ? `${commits.total - commits.rows.length} older commit(s)` : "",
  ].filter(Boolean);
  if (cut.length) host.appendChild(el("div", "hint shellhint", `not shown: ${cut.join(", ")} — this trail is capped at its most recent entries`));
  for (const s of steps) akteStep(host, s.kind, s.ts, s.title, s.sub, s.subMono);
  // the two sources that ride inside ③ still get their own verdict line when they could not be read
  if (d.events.state === "unknown") akteSource(host, "slot events", d.events, "");
  if (d.commits.state === "unknown") akteSource(host, "commits", d.commits, "");

  // ④ HOW IT LANDED — the outcome row, and the git note that says WHY it was allowed to. The note
  // is the reason this window exists: it carries the verbatim verify command and its output, and
  // before this reader nothing in the product could show it.
  const outcomes = akteSource(host, "④ how it ended", d.outcomes, "this lane has not ended yet — no outcome row");
  for (const o of (outcomes as Capped<Record<string, unknown>> | null)?.rows ?? []) {
    const dispo = typeof o.disposition === "string" ? o.disposition : "?";
    const r = akteStep(host, "outcome", typeof o.ts === "number" ? o.ts : 0, dispo,
      `${o.commitCount ?? 0} commit(s) · ${o.shortstat || "no diffstat"}`
      + ` · verify ${o.verified === true ? "green" : o.verified === false ? "RED" : "not run"}`
      + ` · ${o.confirmedByHuman ? "confirm-landed by the owner" : "unattended"}`);
    r.title = JSON.stringify(o, null, 1);
  }
  const notes = akteSource(host, "the land note (refs/notes/fleet/land)", d.landNotes,
    "no land in this lane moved the integration branch, so no note was written");
  for (const n of (notes as LandNoteRead[] | null) ?? []) {
    if (n.state === "absent") {
      akteStep(host, "note", 0, `no note on ${n.sha.slice(0, 8)}`,
        "main moved for this land but no note is attached — the note write is best-effort and never fails a land");
      continue;
    }
    if (n.state === "unreadable") { akteStep(host, "note", 0, `note on ${n.sha.slice(0, 8)} is unreadable`, n.why); continue; }
    const note = n.note ?? {};
    const v = note.verify as { cmd?: string; ok?: boolean | null; out?: string; ms?: number;
      timedOut?: true; waitedOut?: true; serverDown?: true } | undefined;
    akteStep(host, "note", typeof note.at === "number" ? note.at : 0, `landed onto ${n.sha.slice(0, 8)}`,
      `${note.confirmedByHuman ? "confirmed by the owner" : "unattended"}`
      + `${Array.isArray(note.conflicted) && note.conflicted.length ? ` · resolved ${note.conflicted.length} conflict(s)` : ""}`);
    if (!v) {
      host.appendChild(el("div", "hint shellhint", "no verify is recorded on this note — the land ran none"));
      continue;
    }
    // the six verify states the merge verdict names, kept apart here for the same reason they are
    // kept apart there: a skip and a timeout are not a pass, and neither is a failure
    const word = v.ok === true ? "passed" : v.ok === false ? "FAILED"
      : v.timedOut ? "was killed at the timeout — nothing was measured"
        : v.waitedOut ? "never started (queued behind the suite mutex) — nothing was measured"
          : v.serverDown ? "never measured (a suite server did not come up) — nothing was measured"
          : "declined to verify (skipped) — nothing was measured";
    host.appendChild(el("div", "aktehead", `verify ${word}`));
    host.appendChild(el("div", "aktepre", v.cmd ?? "(no command recorded)"));
    if (v.out) host.appendChild(el("div", "aktepre akteout", v.out));
  }

  // ⑤ WHAT IT COST AFTERWARDS — tier 2, which gates nothing and is therefore only ever as useful
  // as its reader. This is that reader, per lane.
  const audits = akteSource(host, "⑤ what was measured after it landed", d.audits,
    "no post-land audit run names this lane");
  for (const a of (audits as Capped<DossierAudit> | null)?.rows ?? []) {
    const r = akteStep(host, `audit-${a.result}`, a.at, `tier-2 audit: ${a.result.toUpperCase()}`,
      `${a.mainSha.slice(0, 8)} · covers ${a.covers.join(", ")}`
      + `${a.reason ? ` · ${a.reason}` : ""}${a.exitCode !== null ? ` · exit ${a.exitCode}` : ""}`);
    r.title = a.cmd;
    const fails = Array.isArray(a.fails)
      ? a.fails.filter((name): name is string => typeof name === "string").slice(0, 50)
        .map((name) => [...name].slice(0, 300).join(""))
      : [];
    if (fails.length) host.appendChild(el("div", "aktepre akteout", fails.map((name) => `FAIL  ${name}`).join("\n")));
    // an un-adjudicated red is the state the whole adjudication rail exists to make visible:
    // "nobody has looked at this yet" is different from "someone looked and called it noise"
    if (a.adjudication) {
      const by = a.adjudication.by;
      const ruled = el("div", "shrsub", `${typeof by !== "object" ? "owner ruled"
        : "rule" in by ? `rule ${by.rule} carried` : `Orchestratorin (slot ${by.slot}) ruled`} "${a.adjudication.verdict}" `);
      ruled.append(el("span", "mono", fmtTs(a.adjudication.at)), a.adjudication.note ? ` — ${a.adjudication.note}` : "");
      host.appendChild(ruled);
    }
    else if (a.result === "red")
      host.appendChild(el("div", "akteunknownw", "un-adjudicated — nobody has ruled on this red yet"));
    if (a.out) host.appendChild(el("div", "aktepre akteout", a.out));
  }
}

// --- the activity window: four lenses on "what has been happening" ---
//
// They were three separate overlays answering one question from three angles, and the gaps between
// them were the problem. The outcome ledger is what FLEET landed — it cannot see a commit made by
// hand in a terminal session, so a repo can move without the feed showing anything. The audit trail
// records what Fleet DID to a slot, and its headline question ("what happened to the session that
// vanished") was two clicks and a different overlay away from the outcome that explains it.
//
// One window, one switch. The lands lens is unchanged — its renderer carries contract wording that
// e2e/outcomes.ts asserts over the source — and the other three are new views on existing data.
// The fourth, Akte, is the same argument one level up: the first three each read ONE ledger across
// all lanes, and no ledger alone can answer "why did this land, and what did it cost afterwards".
type ActLens = "lands" | "commits" | "audit" | "akte" | "timeline";
let actLens: ActLens = "lands";
const ACT_LENS: { k: ActLens; label: string; title: string }[] = [
  { k: "timeline", label: "Zeitleiste", title: "alle Sessions auf einer Zeitachse, bis zum einzelnen Werkzeugaufruf —"
    + " Reports, Rückfragen, Gründung, Commit, Land, Gate, Audit und Deploy daneben; Lücken bleiben Lücken" },
  { k: "lands", label: "Lands", title: "the lane-outcome ledger — what Fleet landed, and what ③ review said" },
  { k: "commits", label: "Commits", title: "recent commits in a repo Fleet has open — including ones no ledger recorded" },
  { k: "audit", label: "Audit", title: "what Fleet did to each slot, and in which project — opened,"
    + " closed, shelved, self-healed, scheduled prompts fired" },
  { k: "akte", label: "Akte", title: "one lane end to end — its order, its prompts and commits, the land"
    + " note that says why it was allowed to land, and what tier 2 measured afterwards" },
];

function renderActivity() {
  const shell = ocShell;
  if (!shell) return;
  shell.tools.replaceChildren();
  shell.root.classList.toggle("tl", actLens === "timeline"); // the timeline lens lays its own detail pane out
  const sw = el("div", "tabrow actlens");
  for (const l of ACT_LENS) {
    const b = el("button", `shrbtn${actLens === l.k ? " on" : ""}`, l.label) as HTMLButtonElement;
    b.title = l.title;
    b.setAttribute("aria-pressed", String(actLens === l.k));
    b.onclick = () => { if (actLens !== l.k) void switchLens(l.k); };
    sw.appendChild(b);
  }
  shell.tools.appendChild(sw);
  if (actLens === "lands") renderOutcomes();
  else if (actLens === "commits") renderCommits();
  else if (actLens === "akte") renderAkte();
  else if (actLens === "timeline") renderTimeline();
  else renderAudit();
}

async function switchLens(k: ActLens) {
  const shell = ocShell;
  if (!shell) return;
  actLens = k;
  shell.detail.replaceChildren();
  shell.setTitle(k === "lands" ? "Outcome feed — what landed, and what review said"
    : k === "commits" ? "Commits — what is actually in the repo"
      : k === "akte" ? "Akte — one lane, end to end"
        : k === "timeline" ? "Zeitleiste — alle Sessions, bis zum Werkzeugaufruf"
          : "Audit trail — what Fleet did to each slot, and where");
  shell.setSubtitle("");
  if (k === "timeline") {
    shell.foot.textContent = "";
    // the load starts BEFORE the first paint: it sets tlBusy before its first await, so the lens
    // opens on "wird geladen" instead of "noch nichts geladen" while the route has not answered
    const loading = loadLens(k);
    renderActivity();
    await loading;
    // the overview IS the landing: on a phone the canvas is the pushed screen, the rail one ‹ away
    if (shell.isOpen()) { if (tlMobile()) shell.showDetail(true); renderActivity(); }
    return;
  }
  if (k === "akte") {
    shell.foot.textContent = "Six append-only files, joined by branch name and read in the order things"
      + " happened. Nothing here is new data and nothing is written: the order that started the lane,"
      + " the prompts and commits it produced, the git note that records WHY it was allowed to land"
      + " (with the verbatim verify command and its output), and what the post-land suite measured"
      + " afterwards. A source that could not be consulted says \"not measured\" and why — never an"
      + " empty section, which would read as \"nothing happened\".";
    renderActivity();
    await loadLens(k);
    if (shell.isOpen()) renderActivity();
    return;
  }
  shell.foot.textContent = k === "lands"
    ? ""
    : k === "commits"
      ? "The ledger records what FLEET landed. This records what is in the repo — a commit made by"
        + " hand in a terminal session appears here and in no ledger. Pick one to read its change."
      : "Fleet's own actions on its slots — opening, closing, healing, firing a scheduled prompt —"
        + " each with the project its slot was working in. NOT the agent's tool calls: what a session"
        + " did inside its pane is in the transcript, not here. A GLOBAL log, not gated behind a live"
        + " slot, because the headline question is usually about a slot that has since vanished.";
  renderActivity();
  await loadLens(k);
  if (shell.isOpen()) renderActivity();
}

// each lens loads once per window; switching back is instant and re-fetches nothing
const actLoaded = new Set<ActLens>();
// every loading state of the window says itself to a screen reader too, politely: it never interrupts
function actLoading(cls: string, text: string): HTMLElement {
  const n = el("div", cls, text);
  n.setAttribute("aria-live", "polite");
  return n;
}
// a meta line of the window, its parts joined by " · ": what one copies (a time, a sha, a path, an
// id) in mono, the words in sans (G0.3) — the text reads exactly as the one string it replaces
function actMeta(cls: string, parts: readonly (readonly [string, boolean])[]): HTMLElement {
  const n = el("div", cls);
  parts.forEach(([text, mono], i) => {
    if (i) n.append(" · ");
    n.appendChild(el("span", mono ? "mono" : "", text));
  });
  return n;
}
async function loadLens(k: ActLens) {
  if (actLoaded.has(k)) return;
  if (k === "lands") {
    const res = await api("/api/lane-outcomes?limit=1000");
    if (res.ok) {
      const data = (await res.json()) as { outcomes?: OutcomeRow[]; total?: number; malformed?: number };
      outcomeData = (data.outcomes ?? []).filter((o): o is OutcomeRow => typeof o?.ts === "number");
      outcomeTotal = typeof data.total === "number" ? data.total : outcomeData.length;
      outcomeMalformed = typeof data.malformed === "number" ? data.malformed : 0;
    }
  } else if (k === "commits") {
    // Always the default listing FIRST: it is the only thing that reports which repos Fleet has
    // open, and asking for an unknown one directly answers 400 — a refusal this window would then
    // have to render as if the repo were broken. Two cheap GETs buy an honest sentence.
    await loadCommitsLens(null);
    const want = cmWant?.repo, branch = cmWant?.branch ?? null;
    // a branch card opens a commit on ITS branch: that history, in a repo GET /api/branches shows
    if (want && cmData && (cmData.repo !== want || branch)) {
      if (cmData.repos.includes(want) || branch) await loadCommitsLens(want, branch);
      else cmRepoMiss = want;
    }
  } else if (k === "akte") {
    const res = await api("/api/lane");
    if (res.ok) {
      const data = (await res.json()) as { lanes?: LaneIndexRow[]; total?: number };
      akteData = (data.lanes ?? []).filter((l): l is LaneIndexRow => typeof l?.branch === "string");
      akteTotal = typeof data.total === "number" ? data.total : akteData.length;
    }
  } else if (k === "timeline") {
    await loadTimelineModel();
  } else {
    const res = await api("/api/audit?limit=1000");
    if (res.ok) {
      const data = (await res.json()) as { events?: AuditEntry[]; total?: number; malformed?: number };
      auditData = (data.events ?? []).filter((e): e is AuditEntry =>
        typeof e?.ts === "number" && typeof e?.event === "string");
      auditTotal = typeof data.total === "number" ? data.total : auditData.length;
      auditMalformed = typeof data.malformed === "number" ? data.malformed : 0;
    }
  }
  actLoaded.add(k);
}

export async function openActivity(lens: ActLens, at?: { repo: string | null; hash: string; branch?: string | null }) {
  setDrawer(false);
  ocShell?.close();
  outcomeDispo = "all";
  outcomeUncovered = false;
  outcomeData = [];
  auditData = [];
  auditSlot = "all";
  auditLife = false;
  cmData = null;
  cmErr = null;
  cmPick = null;
  cmWant = at ?? null;
  cmRepoMiss = null;
  ocPick = null;
  auditPick = null;
  akteData = [];
  aktePick = null;
  akteDoc = null;
  akteBusy = false;
  ocRowOf = new Map();
  resetTimeline();
  actLens = lens;
  actLoaded.clear();
  const shell = openShell({
    id: "outcomes",
    title: "Activity",
    listWidth: 340,
    detailHint: "Pick a row on the left.",
    onSelect: (row) => {
      const o = ocRowOf.get(row.el);
      if (o) { ocPick = landRef(o); renderOutcomeDetail(o); return; }
      const e = auditRowOf.get(row.el);
      if (e) { auditPick = `${e.ts}|${e.event}`; renderAuditDetail(e); return; }
      const c = cmRowOf.get(row.el);
      if (c) { cmPick = c.hash; renderCommitDetail(c); return; }
      // a timeline session row only HIGHLIGHTS under the cursor; Enter (its `open`) zooms into it —
      // following the cursor with a zoom would move the whole canvas on every arrow key
      if (tlRowOf.has(row.el)) return;
    },
    onClose: () => { ocShell = null; ocRowOf = new Map(); auditRowOf = new Map(); cmRowOf = new Map(); },
  });
  ocShell = shell;
  await switchLens(lens);
}
// the board's head opens the Akte ON its own lane: the lens, then the dossier of that branch —
// the same two steps a click on the lane's row in the lens takes
export async function openAkte(branch: string) {
  await openActivity("akte");
  aktePick = branch;
  akteBusy = true;
  renderActivity();
  void loadAkteDoc(branch);
  ocShell?.showDetail(true);
}
$("outcomebtn").onclick = () => void openActivity("lands");
$("konstbtn").onclick = () => openKonstellation();

// --- the session timeline lens (Program ae1f4279, part 5 — the operating draft) ---------------------
//
// One common time axis for every session in the window, down to the single tool call, with the
// ledger's own events (report with its verdict, clarification, founding, commit, land, gate, audit,
// deploy) beside them as a second family of marks. Three zoom levels — Überblick (every session, one
// track each), Session (one track, labelled marks packed into rows), Call (one call and its result)
// — and one inspector for the picked event: arguments, result, error, times, duration, source.
//
// Everything shown comes from src/timeline.ts#loadTimeline; this block never reads the wire. What
// the data cannot prove stays visibly unknown: a mark without a record timestamp is hollow and says
// "Beobachtung", a pending call's bar runs open to the edge, a horizon that begins inside the view
// hatches what lies before it, and the foot carries the clock note on every zoom level.
//
// Its CSS sits with the board's in public/index.html ("the session timeline lens"); the MAIN's call
// 2026-10-07 — no src module injects styles.
type TlZoom = "overview" | "session" | "call";
let tlModel: TimelineModel | null = null;
let tlBusy = false;
let tlZoom: TlZoom = "overview";
let tlScope: string | null = null;      // session key in session/call zoom
let tlCall: string | null = null;       // the call anchoring call zoom
let tlPick: string | null = null;       // the inspected event, or `gaps:<session>` for a session's gaps
let tlHarness = "all";
let tlView: { from: number; to: number } | null = null;   // axis window set by zoom/pan; null = fit to data
let tlRowOf = new Map<HTMLElement, TimelineSession>();
let tlReturnFocus: string | null = null;
let tlMore = false;                     // phone: the fold behind "Mehr" (zoom, pan, harness) is open
// THE WINDOW GENERATION (Kern-MAIN review of e8894ef7): every data answer belongs to the window that
// asked for it. Closing the Activity window and opening it again bumps the generation, and an
// answer that arrives for an older one is dropped — it would otherwise paint a closed window's
// sessions into the new one.
let tlGen = 0;
const TL_WINDOW_MS = 24 * 3600_000;
const TL_MOBILE_MQ = "(max-width: 700px), ((pointer: coarse) and (max-height: 500px))";
const tlMobile = (): boolean => matchMedia(TL_MOBILE_MQ).matches;
// ONE vocabulary, German (UI-MAIN review 2026-10-07): a tool call is an "Aufruf", a ledger row an
// "Ereignis", a source row an "Aufzeichnung"; the state words follow STATE_WORD's register (wartet,
// Fehler), and a verdict is said in German ("Gate grün", "Land gelandet") while the raw word stays
// on the mark's data attribute for a check to read.
const TL_KIND_LABEL: Record<TimelineKind, string> = {
  "tool.call": "Aufruf", "tool.result": "Resultat", report: "Report", clarification: "Rückfrage", founding: "Gründung",
  commit: "Commit", land: "Land", gate: "Gate", audit: "Audit", deploy: "Deploy", other: "Ereignis",
};
const TL_GLYPH: Record<TimelineKind, string> = {
  "tool.call": "●", "tool.result": "○", report: "▣", clarification: "?", founding: "◆",
  commit: "⌑", land: "▲", gate: "▮", audit: "☑", deploy: "⇧", other: "·",
};
const TL_STATUS_WORD: Record<TimelineEvent["status"], string> = { ok: "ok", error: "Fehler", pending: "wartet", late: "spät", unknown: "unbekannt" };
const TL_SOURCE_STATE: Record<TimelineSession["state"], string> = { read: "gelesen", pending: "wartet", rejected: "abgewiesen", unsupported: "nicht unterstützt", unmeasured: "ungemessen" };
const TL_VERDICT_WORD: Record<string, string> = {
  green: "grün", red: "rot", landed: "gelandet", failed: "fehlgeschlagen", unknown: "unbekannt", complete: "fertig",
  handoff: "Übergabe", "needs-main": "braucht MAIN", rejected: "abgelehnt", accepted: "angenommen", resolved: "aufgelöst",
};
const tlVerdict = (v: string | null): string => (v ? TL_VERDICT_WORD[v] ?? v : "");
const tlN = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const tlCallWords = (c: TimelineSession["counts"]): string =>
  `${tlN(c.calls, "Aufruf", "Aufrufe")}${c.errors ? ` · ${c.errors} Fehler` : ""}${c.pending ? ` · ${tlN(c.pending, "wartet", "warten")}` : ""}`;
const tlIntern = (m: TimelineModel): string => `intern: clockUncertainty: ${m.clock.uncertainty}`;
// the row packing measures the canvas, so a resize is a repaint
window.addEventListener("resize", () => { if (ocShell && actLens === "timeline") renderActivity(); });
function resetTimeline() {
  tlGen++;
  tlModel = null; tlBusy = false; tlZoom = "overview"; tlScope = null; tlCall = null; tlPick = null;
  tlHarness = "all"; tlView = null; tlRowOf = new Map(); tlReturnFocus = null; tlMore = false;
}
const tlQuery = () => { const to = Date.now(); return { from: to - TL_WINDOW_MS, to }; };
async function loadTimelineModel() {
  const gen = tlGen;
  tlBusy = true;
  try {
    const m = await loadTimeline(tlQuery());
    if (gen !== tlGen) return; // an older window's answer: not ours to paint
    tlModel = m;
  } finally { if (gen === tlGen) tlBusy = false; }
}
async function tlLoadMore() {
  const m = tlModel;
  if (!m?.next || tlBusy) return;
  const gen = tlGen;
  tlBusy = true;
  try {
    const page = await loadTimeline({ ...tlQuery(), page: m.next });
    if (gen !== tlGen || tlModel !== m) return; // the window that asked is gone
    if (page.state === "unavailable") { m.next = null; m.reason = page.reason; }
    else {
      const known = new Set(m.sessions.map((s) => s.key));
      m.sessions.push(...page.sessions.filter((s) => !known.has(s.key)));
      m.events.push(...page.events); m.events.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
      m.gaps.push(...page.gaps); m.next = page.next;
      const ats = m.events.map((e) => e.at);
      m.span = { from: ats.length ? Math.min(...ats) : null, to: ats.length ? Math.max(...ats) : null };
      if (m.state === "empty" && m.events.length) m.state = "read";
    }
  } finally { if (gen === tlGen) tlBusy = false; }
  if (gen === tlGen) renderActivity();
}
const tlSessionOf = (key: string | null): TimelineSession | null => tlModel?.sessions.find((s) => s.key === key) ?? null;
const tlEventOf = (id: string | null): TimelineEvent | null => tlModel?.events.find((e) => e.id === id) ?? null;
// the events a zoom level shows, before the axis window cuts them
function tlScopedEvents(): TimelineEvent[] {
  const m = tlModel;
  if (!m) return [];
  if (tlZoom === "overview") return m.events.filter((e) => tlHarness === "all" || (tlSessionOf(e.session)?.harness ?? "fleet") === tlHarness);
  if (tlZoom === "session") return m.events.filter((e) => e.session === tlScope);
  const c = tlEventOf(tlCall);
  return c ? m.events.filter((e) => e.id === c.id || e.id === c.pair) : [];
}
// the axis window: the user's zoom/pan, else the scoped events' span with a tenth of padding each side
function tlAxis(events: TimelineEvent[]): { from: number; to: number } {
  if (tlView) return tlView;
  const m = tlModel;
  const ats = events.map((e) => e.at);
  const lo = ats.length ? Math.min(...ats) : m?.window.from ?? 0, hi = ats.length ? Math.max(...ats) : m?.window.to ?? 1;
  const pad = Math.max(500, (hi - lo) * 0.1);
  return { from: lo - pad, to: hi + pad };
}
function tlSetZoom(zoom: TlZoom, scope: string | null, call: string | null) {
  tlZoom = zoom; tlScope = scope; tlCall = call; tlView = null;
  if (zoom === "overview") tlPick = null;
  // the detail pane first (on a phone the canvas is the pushed screen), then the paint that measures it
  ocShell?.showDetail(true);
  renderActivity();
  document.querySelector<HTMLElement>(".tlcanvas")?.focus({ preventScroll: true });
}
function tlZoomSession(s: TimelineSession) { tlSetZoom("session", s.key, null); }
// Escape and the shell's close gestures: step back one level before the window may close
function tlBack(): boolean {
  if (actLens !== "timeline") return false;
  if (tlPick) { tlClosePick(); return true; }
  if (tlZoom === "call") { tlSetZoom("session", tlScope, null); return true; }
  if (tlZoom === "session") { tlSetZoom("overview", null, null); return true; }
  return false;
}
function tlClosePick() {
  const back = tlReturnFocus;
  tlPick = null;
  renderActivity();
  const target = back ? document.querySelector<HTMLElement>(`.tlev[data-id="${CSS.escape(back)}"]`) : null;
  (target ?? document.querySelector<HTMLElement>(".tlcanvas"))?.focus({ preventScroll: !target });
}
function tlOpenPick(id: string) {
  if (!tlPick) tlReturnFocus = document.activeElement instanceof HTMLElement && document.activeElement.dataset.id ? document.activeElement.dataset.id : id;
  tlPick = id;
  renderActivity();
  document.querySelector<HTMLElement>(".tlinspect .tliclose")?.focus();
}
const tlFmtClock = (ms: number, step: number): string => {
  const d = new Date(ms);
  const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const ss = String(d.getSeconds()).padStart(2, "0");
  if (step < 1000) return `${ss}.${String(d.getMilliseconds()).padStart(3, "0")}`;
  if (step < 60_000) return `${hhmm}:${ss}`;
  if (step < 86_400_000) return hhmm;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${hhmm}`;
};
const tlIso = (ms: number): string => new Date(ms).toISOString();
const TL_STEPS = [100, 250, 500, 1000, 2000, 5000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000, 600_000, 900_000, 1_800_000, 3_600_000, 7_200_000, 21_600_000, 43_200_000, 86_400_000];
function tlTicks(axis: { from: number; to: number }, want: number): { at: number; step: number }[] {
  const span = Math.max(1, axis.to - axis.from);
  const step = TL_STEPS.find((s) => span / s <= want) ?? TL_STEPS[TL_STEPS.length - 1] * Math.ceil(span / TL_STEPS[TL_STEPS.length - 1] / want);
  const out: { at: number; step: number }[] = [];
  for (let at = Math.ceil(axis.from / step) * step; at <= axis.to; at += step) out.push({ at, step });
  return out;
}

function renderTimeline() {
  const shell = ocShell;
  if (!shell) return;
  shell.setCloseGuard(tlBack);
  const m = tlModel;
  const mobile = tlMobile();

  // --- tools: breadcrumb (also the way back), zoom and pan, harness filter
  const tools = el("div", "tltools");
  const crumbs = el("nav", "tlcrumbs");
  crumbs.setAttribute("aria-label", "Zoomstufe");
  const crumb = (label: string, zoom: TlZoom, on: () => void) => {
    const b = el("button", "shrbtn tlcrumb", label) as HTMLButtonElement;
    b.dataset.zoom = zoom;
    if (tlZoom === zoom) b.setAttribute("aria-current", "step");
    b.title = tlZoom === zoom ? `${label} — diese Zoomstufe` : `zurück auf ${label}`;
    b.onclick = on;
    return b;
  };
  crumbs.appendChild(crumb("Überblick", "overview", () => tlSetZoom("overview", null, null)));
  const scoped = tlSessionOf(tlScope);
  if (tlZoom !== "overview" && scoped) {
    crumbs.appendChild(el("span", "tlsep", "›"));
    crumbs.appendChild(crumb(`Session ${scoped.label}`, "session", () => tlSetZoom("session", scoped.key, null)));
  }
  const callEv = tlEventOf(tlCall);
  if (tlZoom === "call" && callEv) {
    crumbs.appendChild(el("span", "tlsep", "›"));
    crumbs.appendChild(crumb(`Aufruf ${callEv.sub || callEv.label}`, "call", () => undefined));
  }
  const top = el("div", "tltop");
  top.appendChild(crumbs);
  tools.appendChild(top);
  // THE PHONE LISTS (UI-MAIN review 2026-10-07): at phone width the session and call zoom show their
  // events as a list in time order instead of a ~190 px axis — chips never overlap, words never cut.
  // The overview keeps the axis (glyph-only marks); the axis window's zoom and pan have no list meaning.
  const listMode = mobile && tlZoom !== "overview";
  // ONE ROW on the phone (UI-MAIN review point 9): the crumbs stay in the row; zoom, pan and the
  // harness picker fold behind "Mehr" — on the desktop they stand in the row as before
  const fold = mobile && !listMode;
  if (m && m.state === "read" && !listMode) {
    const into = fold ? el("div", "tlfold") : tools;
    if (fold) {
      const more = el("button", "shrbtn tlmorebtn", tlMore ? "Weniger" : "Mehr") as HTMLButtonElement;
      more.type = "button";
      more.title = tlMore ? "Zeitachse und Harness-Wahl einklappen" : "Zeitachse und Harness-Wahl";
      more.setAttribute("aria-expanded", String(tlMore));
      more.onclick = () => { tlMore = !tlMore; renderActivity(); };
      top.appendChild(more);
      into.hidden = !tlMore;
    }
    const zoom = el("div", "tlzoom");
    const zb = (label: string, title: string, on: () => void) => {
      const b = el("button", "shrbtn", label) as HTMLButtonElement;
      b.title = title; b.onclick = on; zoom.appendChild(b);
    };
    const axisNow = tlAxis(tlScopedEvents());
    const span = axisNow.to - axisNow.from, mid = axisNow.from + span / 2;
    zb("−", "Zeitachse weiter fassen", () => { tlView = { from: mid - span, to: mid + span }; renderActivity(); });
    zb("+", "Zeitachse enger fassen", () => { tlView = { from: mid - span / 4, to: mid + span / 4 }; renderActivity(); });
    zb("◀", "früher", () => { tlView = { from: axisNow.from - span / 4, to: axisNow.to - span / 4 }; renderActivity(); });
    zb("▶", "später", () => { tlView = { from: axisNow.from + span / 4, to: axisNow.to + span / 4 }; renderActivity(); });
    if (tlView) zb("Alles", "Zeitachse auf die Daten dieser Zoomstufe", () => { tlView = null; renderActivity(); });
    into.appendChild(zoom);
    const harnesses = [...new Set(m.sessions.map((s) => s.harness))].sort();
    if (tlZoom === "overview" && harnesses.length > 1) {
      const sel = el("select", "") as HTMLSelectElement;
      sel.title = "nur Sessions dieses Harness";
      for (const h of ["all", ...harnesses]) {
        const o = el("option", "", h === "all" ? "alle Harnesses" : h) as HTMLOptionElement;
        o.value = h; sel.appendChild(o);
      }
      sel.value = tlHarness;
      sel.onchange = () => { tlHarness = sel.value; renderActivity(); };
      into.appendChild(sel);
    }
    if (fold) tools.appendChild(into);
  }
  shell.tools.appendChild(tools);

  // --- the session rail: one row per session; Enter or a tap zooms into it
  shell.list.replaceChildren();
  tlRowOf = new Map();
  const shRows: ShellRow[] = [];
  let selIdx = -1;
  if (m && m.sessions.length) {
    for (const s of m.sessions) {
      if (tlZoom === "overview" && tlHarness !== "all" && s.harness !== tlHarness) continue;
      const r = el("div", "shellrow tlrow");
      r.dataset.session = s.key;
      tlRowOf.set(r, s);
      const main = el("div", "shrmain");
      main.appendChild(el("div", "shrname", s.label));
      // a list row carries what is known; what is unknown about a session (its occupation, the
      // clocks) is said once in the banner and in the gaps inspector, never per row
      main.appendChild(el("div", "shrsub", `${s.harness}${s.slot !== null ? ` · Slot ${s.slot}` : ""}${s.project ? ` · ${baseName(s.project)}` : ""}${s.state !== "read" ? ` · ${TL_SOURCE_STATE[s.state]}` : ""}`));
      const c = el("div", "tlcount");
      c.appendChild(el("span", "", tlN(s.counts.calls, "Aufruf", "Aufrufe")));
      if (s.counts.errors) c.appendChild(el("span", "err", `${s.counts.errors} Fehler`));
      if (s.counts.pending) c.appendChild(el("span", "", tlN(s.counts.pending, "wartet", "warten")));
      if (s.counts.ledger) c.appendChild(el("span", "", tlN(s.counts.ledger, "Ereignis", "Ereignisse")));
      if (s.gaps.length) c.appendChild(el("span", "unk", `${s.gaps.length} ${s.gaps.length === 1 ? "Lücke" : "Lücken"}`));
      main.appendChild(c);
      r.appendChild(main);
      r.title = `Session ${s.label} vergrößern`;
      const act = () => tlZoomSession(s);
      r.onclick = act;
      shell.list.appendChild(r);
      if (s.key === tlScope) { r.classList.add("sel"); selIdx = shRows.length; }
      shRows.push({ el: r, open: act });
    }
  } else shell.list.appendChild(tlBusy ? actLoading("histnone", "Sessions werden geladen …")
    : el("div", "histnone", m?.state === "unavailable" ? "keine Quelle" : "keine Session im Fenster"));
  shell.setRows(shRows);
  if (selIdx >= 0) shell.select(selIdx, false, false);
  shell.setSubtitle(m ? m.state === "read"
    ? `${tlN(m.sessions.length, "Session", "Sessions")} · ${tlN(m.events.filter((e) => e.kind === "tool.call").length, "Aufruf", "Aufrufe")} · ${tlN(m.events.filter((e) => e.family === "ledger").length, "Ereignis", "Ereignisse")} · ${tlN(m.gaps.length, "Lücke", "Lücken")}`
    : m.state === "empty" ? "keine Ereignisse im Fenster" : "Quelle antwortet nicht" : "");

  // --- the canvas, inside one pane of its own: the shell's detail keeps its display rules (hidden on
  // a phone until pushed), the pane does the column layout and anchors the inspector
  shell.detail.replaceChildren();
  const pane = el("div", "tlpane");
  shell.detail.appendChild(pane);
  if (!m) { pane.appendChild(tlBusy ? actLoading("tlstate", "Zeitleiste wird geladen …") : el("div", "tlstate", "noch nichts geladen")); shell.foot.textContent = ""; return; }
  if (m.state === "unavailable") {
    const box = el("div", "tlstate");
    box.dataset.state = "unavailable";
    // one sentence, the route named once (UI-MAIN review point 7); the second sentence is the
    // principle the review kept: the lens shows nothing and claims nothing until the route answers
    box.appendChild(el("b", "", "Die Zeitleiste hat noch keine Quelle:"));
    box.appendChild(document.createTextNode(" "));
    box.appendChild(el("code", "", `GET ${m.route}`));
    box.appendChild(document.createTextNode(` ${m.reason ?? "antwortet nicht"}.`));
    box.appendChild(document.createTextNode(" Bis dahin zeigt sie nichts und behauptet nichts."));
    pane.appendChild(box);
    shell.foot.textContent = tlIntern(m);
    return;
  }
  // the unknown is said ONCE, here, in words; the foot carries the raw key as an internal value
  const note = el("div", "tlnote");
  note.appendChild(el("b", "", "Uhrunsicherheit: unbekannt."));
  note.appendChild(document.createTextNode(` ${m.clock.note} · Dauer: keine Laufzeit belegt, nur Abstände der Aufzeichnungen.`
    + `${m.ledgerUnassigned ? ` · ${tlN(m.ledgerUnassigned, "Ereignis", "Ereignisse")} ohne Session.` : ""}`));
  pane.appendChild(note);
  if (m.state === "empty") {
    pane.appendChild(el("div", "tlstate", `Keine Ereignisse zwischen ${tlIso(m.window.from)} und ${tlIso(m.window.to)}. Was die Quellen vor dem Fenster halten, ist hier ungemessen, nicht leer.`));
    shell.foot.textContent = tlIntern(m);
    return;
  }
  const events = tlScopedEvents();
  const axis = tlAxis(events);
  const x = (at: number): number => Math.max(0, Math.min(100, 100 * (at - axis.from) / (axis.to - axis.from)));
  const inside = (e: TimelineEvent): boolean => e.at >= axis.from && e.at <= axis.to;
  const canvas = el("div", "tlcanvas");
  canvas.tabIndex = 0;
  canvas.dataset.zoom = tlZoom;
  canvas.setAttribute("aria-label", "Gemeinsame Zeitachse");
  // ← → walk the marks of one track in time order; Enter/Space on a mark is the button's own
  canvas.onkeydown = (ev) => {
    if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
    const cur = document.activeElement;
    const marks = [...canvas.querySelectorAll<HTMLButtonElement>(".tlev")];
    if (!marks.length) return;
    const i = cur instanceof HTMLButtonElement ? marks.indexOf(cur) : -1;
    const next = marks[i < 0 ? 0 : Math.max(0, Math.min(marks.length - 1, i + (ev.key === "ArrowRight" ? 1 : -1)))];
    ev.preventDefault(); ev.stopPropagation();
    next?.focus();
  };
  const railPx = mobile ? 84 + 6 : 150 + 8, padPx = mobile ? 20 : 56;
  const plotPx = Math.max(120, shell.detail.clientWidth - 28 - railPx - padPx * 2);
  if (!listMode) {
    const axisRow = el("div", "tlaxis");
    axisRow.appendChild(el("span", "", "Zeit laut Quelle"));
    const plotAxis = el("div", "tlaxisplot");
    for (const t of tlTicks(axis, Math.max(2, Math.floor(plotPx / (mobile ? 76 : 92))))) {
      const tick = el("time", "tltick", tlFmtClock(t.at, t.step));
      const tx = x(t.at);
      tick.style.left = `${tx}%`;
      // a label at either end stays inside the plot: the canvas never scrolls sideways for a tick
      if (tx > 88) tick.style.transform = "translateX(-100%)"; else if (tx < 12) tick.style.transform = "none";
      tick.setAttribute("datetime", tlIso(t.at));
      plotAxis.appendChild(tick);
    }
    axisRow.appendChild(plotAxis);
    canvas.appendChild(axisRow);
  }
  // THE LEGEND (UI-MAIN review 2026-10-07): every glyph on the canvas has its word here, once, at the
  // axis head — and again on each mark's title, so hover, hold and a screen reader all get the word
  const legend = el("div", "tllegend");
  legend.setAttribute("aria-label", "Legende");
  const legendKinds = [...new Set(events.map((e) => e.kind))].sort((a, b) => TL_KIND_LABEL[a].localeCompare(TL_KIND_LABEL[b]));
  for (const k of legendKinds) {
    const item = el("span", "tllegit");
    item.dataset.kind = k;
    item.appendChild(el("span", "tlglyph", TL_GLYPH[k]));
    item.appendChild(document.createTextNode(TL_KIND_LABEL[k]));
    legend.appendChild(item);
  }
  if (events.some((e) => e.status === "pending")) legend.appendChild(el("span", "tllegit", "┄ wartet auf Resultat"));
  if (events.some((e) => !e.atKnown)) legend.appendChild(el("span", "tllegit", "⋯ ohne Zeitstempel"));
  // ONE colour, one meaning (UI-MAIN review point 6): amber is "nicht beobachtet" — the hatch, a
  // gap, an unknown field — and nothing else; a mark's state is a word, an error the one red
  const unmeasured = el("span", "tllegit tlunk");
  unmeasured.dataset.meaning = "unmeasured";
  unmeasured.appendChild(el("span", "tlswatch", ""));
  unmeasured.appendChild(document.createTextNode("ungemessen · Lücke · unbekannt"));
  legend.appendChild(unmeasured);
  canvas.appendChild(legend);
  // one mark, the same button on the axis and in a phone list
  const markButton = (e: TimelineEvent): HTMLButtonElement => {
    const b = el("button", `tlev${tlPick === e.id ? " sel" : ""}`) as HTMLButtonElement;
    b.type = "button";
    b.dataset.id = e.id; b.dataset.kind = e.kind; b.dataset.family = e.family; b.dataset.status = e.status; b.dataset.atKnown = String(e.atKnown);
    b.dataset.at = String(e.at);
    if (e.verdict) b.dataset.verdict = e.verdict;
    const verdict = tlVerdict(e.verdict);
    b.title = `${TL_KIND_LABEL[e.kind]} ${e.label}${e.sub ? ` ${e.sub}` : ""} · ${TL_STATUS_WORD[e.status]}${verdict ? ` · ${verdict}` : ""} · ${tlIso(e.at)}${e.atKnown ? "" : " (Beobachtung, Aufzeichnung ohne Zeit)"} — öffnen`;
    b.setAttribute("aria-label", b.title);
    b.appendChild(el("span", "tlglyph", TL_GLYPH[e.kind]));
    b.appendChild(el("span", "tlname", e.family === "tool" ? e.label : `${e.label}${verdict ? ` ${verdict}` : ""}`));
    b.appendChild(el("span", "tlsub", tlSubOf(e)));
    b.appendChild(el("span", "tlst", e.family === "tool" ? TL_STATUS_WORD[e.status] : ""));
    b.onclick = () => tlOpenPick(e.id);
    return b;
  };
  // a ledger mark whose sub IS its verdict says the verdict once, in German, in its name
  const tlSubOf = (e: TimelineEvent): string => (e.family === "ledger" && e.sub === e.verdict ? "" : e.sub);
  // the width a mark takes on the axis, estimated from its text — the packing below keeps marks
  // apart by THAT, so a long name costs a row and never a neighbour (UI-MAIN review 2026-10-07)
  const markWidthPx = (e: TimelineEvent): number => {
    if (tlZoom === "overview") return mobile ? 24 : 14;
    const name = e.family === "tool" ? e.label : `${e.label} ${tlVerdict(e.verdict)}`;
    const text = `${name} ${tlZoom === "call" ? tlSubOf(e) : ""} ${e.family === "tool" ? TL_STATUS_WORD[e.status] : ""}`.trim();
    return 8 + 11 + 8 + text.length * 6.6;
  };

  // the gap two neighbouring marks keep between their edges (their widths come from markWidthPx)
  const clearancePx = tlZoom === "overview" ? 2 : 6;
  const stepPx = tlZoom === "overview" ? (mobile ? 42 : 22) : (mobile ? 44 : 26);
  const tracks: { key: string | null; title: string; sub: string; session: TimelineSession | null }[] = [];
  const visibleSessions = m.sessions.filter((s) => tlZoom === "overview" ? tlHarness === "all" || s.harness === tlHarness : s.key === tlScope);
  for (const s of visibleSessions) tracks.push({ key: s.key, title: s.label, sub: `${s.harness}${s.slot !== null ? ` · Slot ${s.slot}` : ""}`, session: s });
  const fleetEvents = events.filter((e) => e.session === null);
  if (tlZoom === "overview" && fleetEvents.length) tracks.push({ key: null, title: "Fleet", sub: "Ereignisse ohne Session", session: null });
  for (const t of tracks) {
    const lane = events.filter((e) => e.session === t.key);
    const shown = lane.filter(inside);
    const track = el("section", `tltrack${t.key === null ? " fleet" : ""}`);
    if (t.key !== null) track.dataset.session = t.key;
    if (t.session) track.dataset.harness = t.session.harness;
    const head = el("div", "tlhead");
    // THE HEAD IS THE WAY IN (UI-MAIN review point 5): in the overview a session's name and chevron
    // are one button that zooms into the track — no "Zoom" button per track
    if (t.session && tlZoom === "overview") {
      const s = t.session;
      const headBtn = el("button", "tlheadbtn") as HTMLButtonElement;
      headBtn.type = "button";
      headBtn.title = `Session ${s.label} vergrößern`;
      headBtn.appendChild(el("strong", "", t.title));
      headBtn.appendChild(el("span", "tlchev", "›"));
      headBtn.appendChild(el("span", "tlheadsub", t.sub));
      headBtn.onclick = () => tlZoomSession(s);
      head.appendChild(headBtn);
    } else {
      head.appendChild(el("strong", "", t.title));
      head.appendChild(el("span", "", t.sub));
    }
    if (t.session) {
      const s = t.session;
      head.appendChild(el("span", "tlcounts", tlCallWords(s.counts)));
      if (s.gaps.length || s.horizon.state === "unmeasured") {
        const gaps = el("div", "tlgaps");
        const g = el("button", "tlgap", `${s.gaps.length} ${s.gaps.length === 1 ? "Lücke" : "Lücken"}${s.horizon.state === "unmeasured" ? " · Horizont ungemessen" : ""}`) as HTMLButtonElement;
        g.type = "button";
        g.title = "was in dieser Session nicht beobachtet wurde";
        g.onclick = () => tlOpenPick(`gaps:${s.key}`);
        gaps.appendChild(g);
        head.appendChild(gaps);
      }
    }
    track.appendChild(head);
    const body = el("div", "");
    // horizon: what lies before a source's first record is unmeasured, never empty. The hatch says
    // one word that wraps and never cuts; the reason stands in the gaps inspector.
    const h = t.session?.horizon ?? null;
    const later = !!h && h.oldestAt !== null && m.span.from !== null && h.oldestAt > m.span.from && (listMode || h.oldestAt > axis.from);
    const horizonWord = h && (h.state === "unmeasured" || later) ? (h.state === "unmeasured" ? "ungemessen" : "davor ungemessen") : null;
    if (listMode) {
      const list = el("ol", "tllist");
      if (h && horizonWord) {
        const un = el("li", "tlunmeasured");
        un.dataset.horizon = h.state;
        un.appendChild(el("span", "", horizonWord));
        list.appendChild(un);
      }
      for (const e of lane) {
        const li = el("li", "");
        const b = markButton(e);
        b.appendChild(el("time", "tltime", tlFmtClock(e.at, 1000)));
        li.appendChild(b);
        list.appendChild(li);
      }
      body.appendChild(list);
      track.appendChild(body);
      canvas.appendChild(track);
      continue;
    }
    const plot = el("div", "tlplot");
    if (h && horizonWord) {
      const un = el("div", "tlunmeasured");
      un.dataset.horizon = h.state;
      un.style.left = "0";
      un.style.width = h.state === "unmeasured" ? "100%" : `${x(h.oldestAt ?? axis.from)}%`;
      un.appendChild(el("span", "", horizonWord));
      plot.appendChild(un);
      plot.style.setProperty("--tl-foot", mobile ? "26px" : "14px");
    }
    // row packing: a mark takes the first row whose last mark's right edge ends before its own left
    // edge (marks are centred on their time); no row cap — the plot grows, a chip never covers another
    const rowsEnd: number[] = [];
    const pos = new Map<string, { x: number; row: number }>();
    for (const e of shown) {
      const px = x(e.at) * plotPx / 100, half = markWidthPx(e) / 2;
      let row = rowsEnd.findIndex((end) => px - half - clearancePx >= end);
      if (row < 0) { row = rowsEnd.length; rowsEnd.push(px + half); } else rowsEnd[row] = px + half;
      pos.set(e.id, { x: x(e.at), row });
    }
    plot.style.setProperty("--tl-rows", String(Math.max(1, rowsEnd.length)));
    plot.style.setProperty("--tl-step", `${stepPx}px`);
    // call→result bars, and an open bar for a call still waiting
    for (const e of shown) {
      if (e.kind !== "tool.call") continue;
      const p = pos.get(e.id);
      if (!p) continue;
      const pair = e.pair ? lane.find((r) => r.id === e.pair) : null;
      const bar = el("div", `tlbar${e.status === "error" ? " error" : ""}${e.status === "pending" ? " pending" : ""}`);
      bar.dataset.call = e.id;
      bar.style.left = `${p.x}%`;
      bar.style.top = `${p.row * stepPx + 4}px`;
      bar.style.width = `${Math.max(0, (pair ? Math.min(100, x(pair.at)) : 100) - p.x)}%`;
      bar.title = pair ? `Abstand der Aufzeichnungen ${e.separationMs ?? "?"} ms — keine Laufzeit` : "Resultat nicht im Snapshot — wartet";
      plot.appendChild(bar);
    }
    for (const e of shown) {
      const p = pos.get(e.id);
      if (!p) continue;
      const b = markButton(e);
      b.style.left = `${p.x}%`;
      b.style.top = `${p.row * stepPx}px`;
      plot.appendChild(b);
    }
    body.appendChild(plot);
    if (shown.length < lane.length) body.appendChild(el("div", "tloutside", `${lane.length - shown.length} außerhalb der Zeitachse`));
    track.appendChild(body);
    canvas.appendChild(track);
  }
  if (!tracks.length) canvas.appendChild(el("div", "tlstate", "keine Session für diesen Filter"));
  pane.appendChild(canvas);
  if (m.next) {
    const more = el("button", "shrbtn", tlBusy ? "lädt …" : "weitere Seite laden") as HTMLButtonElement;
    more.disabled = tlBusy; more.style.margin = "0 14px 12px";
    more.onclick = () => void tlLoadMore();
    pane.appendChild(more);
  }
  pane.appendChild(tlInspector());
  shell.foot.textContent = mobile ? tlIntern(m)
    : `Esc schließt den Inspektor, dann eine Zoomstufe, dann das Fenster · ← → gehen die Marken entlang · ${tlIntern(m)}`;
}

// the picked event in full, or a session's gaps; a card under the canvas, the whole screen on a phone
function tlInspector(): HTMLElement {
  const box = el("aside", "tlinspect");
  box.setAttribute("aria-label", "Inspektor");
  if (!tlPick) { box.hidden = true; return box; }
  const head = el("div", "tlihead");
  const close = el("button", "shrbtn tliclose", "Schließen") as HTMLButtonElement;
  close.title = "Inspektor schließen (Esc)";
  close.onclick = tlClosePick;
  const dl = el("dl", "tlidl");
  const field = (name: string, value: string | HTMLElement | null, unknownText = "unbekannt"): void => {
    dl.appendChild(el("dt", "", name));
    const dd = el("dd", value === null ? "unk" : "");
    dd.dataset.field = name;
    if (value === null) dd.textContent = unknownText; else if (typeof value === "string") dd.textContent = value; else dd.appendChild(value);
    dl.appendChild(dd);
  };
  const code = (s: string): HTMLElement => el("code", "", s);
  const pre = (s: string): HTMLElement => el("pre", "", s);
  if (tlPick.startsWith("gaps:")) {
    const s = tlSessionOf(tlPick.slice(5));
    head.appendChild(el("h3", "", `Lücken · ${s?.label ?? "?"}`));
    head.appendChild(close);
    box.appendChild(head);
    if (s) {
      field("Horizont", s.horizon.state === "read" ? `ab ${tlIso(s.horizon.oldestAt ?? 0)} gelesen${s.horizon.newestAt ? ` bis ${tlIso(s.horizon.newestAt)}` : ""}` : null, `ungemessen · ${s.horizon.reason ?? ""}`);
      field("Quellstand", `${TL_SOURCE_STATE[s.state]} · Generation ${s.version}`);
      field("Belegung", s.occupation === "unknown" ? null : `Slot ${s.occupation.slot} seit ${tlIso(s.occupation.openedAt)}`, "unbekannt · die Quelle nennt keine Belegung");
      for (const g of s.gaps) field(g.code, `${g.text}${g.offset !== null ? ` · Bytes ${g.offset}${g.bytes !== null ? ` + ${g.bytes}` : ""}` : ""}`);
      if (!s.gaps.length) field("Lücken", "keine in diesem Snapshot; frühere Vollständigkeit unbekannt");
    }
    box.appendChild(dl);
    return box;
  }
  const e = tlEventOf(tlPick);
  if (!e) { box.hidden = true; return box; }
  const pair = e.pair ? tlEventOf(e.pair) : null;
  head.appendChild(el("h3", "", `${TL_KIND_LABEL[e.kind]} · ${e.label}${e.sub ? ` ${e.sub}` : ""}`));
  const verdict = tlVerdict(e.verdict);
  const chip = el("span", "tlchip", `${TL_STATUS_WORD[e.status]}${verdict ? ` · ${verdict}` : ""}`);
  chip.dataset.status = e.status;
  head.appendChild(chip);
  head.appendChild(close);
  box.appendChild(head);
  if (e.family === "tool") {
    field("Argumente", e.args !== null ? pre(e.args) : null, "nicht geliefert · die Quelle hält sie unter dem Locator");
    field("Resultat", e.result !== null ? pre(e.result) : null, e.status === "pending" ? "wartet · kein Resultat im Snapshot" : "nicht geliefert");
    field("Fehler", e.error !== null ? pre(e.error) : e.status === "unknown" ? null : "keiner laut Quelle", "unbekannt · Quelle sagt nichts");
  } else {
    field("Urteil", e.verdict ? `${verdict}${verdict !== e.verdict ? ` (${e.verdict})` : ""}` : null, "ohne Urteil");
    field("Bezüge", Object.keys(e.source.refs).length ? code(Object.entries(e.source.refs).map(([k, v]) => `${k}=${v}`).join(" · ")) : null, "keine");
  }
  const times = el("div", "");
  times.appendChild(el("div", "", `${e.atKnown ? "Aufzeichnung" : "Beobachtung (Aufzeichnung ohne Zeitstempel)"}: ${tlIso(e.at)} · ${e.clock}`));
  if (e.observedAt !== null) times.appendChild(el("div", "", `beobachtet: ${tlIso(e.observedAt)}`));
  if (pair) times.appendChild(el("div", "", `${TL_KIND_LABEL[pair.kind]}: ${tlIso(pair.at)}`));
  field("Zeitpunkte", times);
  field("Dauer", e.separationMs !== null ? `keine Laufzeit belegt · Abstand der Aufzeichnungen Aufruf→Resultat ${e.separationMs} ms` : null, "keine Laufzeit belegt");
  const src = el("div", "");
  src.appendChild(el("div", "", `${e.source.name}${e.source.sidechain ? " · Sidechain derselben Session" : ""}`));
  if (e.source.edge) src.appendChild(el("div", "", `Kante: ${e.source.edge}`));
  // THE RAW VALUE (UI-MAIN review point 8): locator, fingerprint and record bytes are a machine
  // address, not prose — folded behind a summary, with one button that copies them as one line
  const rawLines = [
    e.source.locator ? `${e.source.locator}${e.source.fp ? ` fp ${e.source.fp}` : ""}` : null,
    e.source.record ? `Aufzeichnung ${e.source.record.id ?? "?"}${e.source.record.parent ? ` ← ${e.source.record.parent}` : ""} · Bytes ${e.source.record.offset} + ${e.source.record.bytes} #${e.source.record.block}` : null,
  ].filter((l): l is string => l !== null);
  if (rawLines.length) {
    const raw = el("details", "tlraw");
    raw.appendChild(el("summary", "", `Rohwert · ${e.source.locator ? "Lokator" : "Aufzeichnung"}`));
    for (const line of rawLines) raw.appendChild(code(line));
    const copy = el("button", "shrbtn tlcopy", "Kopieren") as HTMLButtonElement;
    copy.type = "button";
    copy.title = "Rohwert in die Zwischenablage";
    copy.onclick = () => { copyText(rawLines.join("\n")); copy.textContent = "Kopiert"; setTimeout(() => { copy.textContent = "Kopieren"; }, 1200); };
    raw.appendChild(copy);
    src.appendChild(raw);
  }
  field("Quelle", src);
  if (e.files.length) field("Dateien", e.files.join(", "));
  box.appendChild(dl);
  const acts = el("div", "tliacts");
  if (e.family === "tool" && tlZoom !== "call") {
    const z = el("button", "shrbtn", "Zoom Aufruf") as HTMLButtonElement;
    z.onclick = () => tlSetZoom("call", e.session, e.kind === "tool.call" ? e.id : e.pair ?? e.id);
    acts.appendChild(z);
  }
  if (pair) {
    const p = el("button", "shrbtn", `${TL_KIND_LABEL[pair.kind]} öffnen`) as HTMLButtonElement;
    p.onclick = () => tlOpenPick(pair.id);
    acts.appendChild(p);
  }
  if (e.session && tlZoom === "overview") {
    const s = tlSessionOf(e.session);
    if (s) { const z = el("button", "shrbtn", "Zoom Session") as HTMLButtonElement; z.onclick = () => tlZoomSession(s); acts.appendChild(z); }
  }
  if (acts.childElementCount) box.appendChild(acts);
  return box;
}

// ⋯ mehr — the board-wide fold under the header row: every NEW or secondary board action goes
// in here first, never into the row above; promoting one to the row is its own owner call.
let moreOpen = prefBool("fleet.more");
const moreBtn = el("button", "", "⋯") as HTMLButtonElement;
moreBtn.id = "morebtn";
const morePanel = el("div", "");
morePanel.id = "morepanel";
function applyMore() {
  moreBtn.classList.toggle("active", moreOpen);
  moreBtn.title = moreOpen ? "mehr — close the panel of further board actions"
    : "mehr — open the panel of further board actions";
  moreBtn.setAttribute("aria-expanded", moreOpen ? "true" : "false");
  morePanel.hidden = !moreOpen;
}
function moreAction(label: string, title: string, run: () => void): HTMLButtonElement {
  const b = el("button", "bbtn", label) as HTMLButtonElement;
  b.title = title;
  b.onclick = run;
  return b;
}
const tlMoreBtn = moreAction("⏱ Zeitleiste", ACT_LENS.find((l) => l.k === "timeline")?.title ?? "",
  () => void openActivity("timeline"));
tlMoreBtn.dataset.lens = "timeline";
morePanel.append(
  el("div", "morehead", "⋯ mehr"),
  tlMoreBtn,
  moreAction("⎇ Commits", ACT_LENS.find((l) => l.k === "commits")?.title ?? "",
    () => void openActivity("commits")),
  moreAction("📂 Akte", ACT_LENS.find((l) => l.k === "akte")?.title ?? "",
    () => void openActivity("akte")),
);
moreBtn.onclick = () => {
  moreOpen = !moreOpen;
  prefSetBool("fleet.more", moreOpen);
  applyMore();
};
$("toolrow2").appendChild(moreBtn);
$("sidetools").after(morePanel);
applyMore();

// + — EINE IDEE WIRD EINE QUEUE-ZEILE, NIE EIN KOMMANDO (owner 2026-09-22, Kommentar an der
// Queue-Zeile, Program 0d51b4d4). The window files the typed idea as a PENDING row that every
// device sees (fleet.json is the memory — no localStorage); it never dispatches, never releases
// and never types into a pane. What is unclear the dispatcher sharpens (the card sweep reads the
// row on its own, and a release needs a valid card anyway); the button-builder stays the idea's
// own later row. The block markers are load-bearing: e2e/tasks.ts slices exactly this block and
// pins that it files a row instead of sending text anywhere.
// --- IDEE VOM +-KNOPF ---
const plusBtn = el("button", "", "+") as HTMLButtonElement;
plusBtn.id = "headplus";
plusBtn.title = "Eigene Idee — als Aufgabe filen";
$("toolrow2").appendChild(plusBtn);
const IDEE_MIN_CHARS = 20; // after trim — the form asks for a direction, not a brief
const ideeDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
let ideeShell: Shell | null = null;
function openIdee(): void {
  ideeShell?.close();
  const shell = openShell({ id: "idee", title: "New idea" });
  ideeShell = shell;
  const pane = el("div", "ideepane");
  const ta = el("textarea", "ideeta") as HTMLTextAreaElement;
  const hint = el("div", "hint shellhint", "");
  const filen = el("button", "shrbtn primary", "File as task") as HTMLButtonElement;
  filen.type = "button";
  const paint = () => {
    const left = IDEE_MIN_CHARS - ta.value.trim().length;
    filen.disabled = left > 0;
    hint.textContent = left > 0 ? `${left} more characters` : "";
  };
  ta.addEventListener("input", paint);
  ta.onkeydown = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); filen.click(); }
  };
  filen.onclick = async () => {
    const text = ta.value.trim();
    if (text.length < IDEE_MIN_CHARS) return;
    filen.disabled = true;
    const r = await post("/api/tasks", {
      text: `[IDEE VOM +-KNOPF · ${ideeDate()}] ${text}`, kind: "auftrag", queue: false });
    const j = (await r.json().catch(() => null)) as { task?: { id: string }; error?: string } | null;
    if (!r.ok || !j?.task) {
      paint(); // the text stays in the box — a refused filing must not lose the idea
      hint.textContent = j?.error ?? `the server refused this filing (${r.status})`;
      return;
    }
    const id = j.task.id;
    const openq = el("button", "shrbtn", "Open in queue") as HTMLButtonElement;
    openq.type = "button";
    openq.onclick = async () => {
      shell.close();
      await refresh();
      openQueue();
      qSelect(id);
    };
    pane.replaceChildren(
      el("div", "ideeid", `Queue row ${id}`),
      el("div", "hint shellhint",
        "The row starts once its card is valid (goal, surface, DONE, VERIFY) - the dispatcher sharpens anything unclear, no lane asks back."),
      openq,
    );
    openq.focus();
  };
  const acts = el("div", "ideeacts");
  acts.append(filen);
  pane.append(
    el("div", "ideelabel", "What should the button do?"),
    ta, hint, acts,
  );
  shell.detail.replaceChildren(pane);
  ta.focus();
  paint();
}
plusBtn.onclick = () => openIdee();
// --- end IDEE VOM +-KNOPF ---

// THE HEAD ROW — one icon grammar (owner 2026-09-21: „[Zitat entfernt]“
// ). Round 12 sorted the buttons
// (the order and its reason are in the #sidetools css); the sign is the same: the raw emoji, whose
// meaning lived only in a title, are the tray's SVG grammar now, and the word is the aria-label. This is the #head=b Fassung made the
// standing state; a (icon + word, wrapped to three lines) and c (fold under ⋯) left with the switch.
// THE THREE CONDITIONAL BUTTONS (attn · ops · dev) keep their count: those writers rewrite
// `textContent` on every poll, which would wipe an icon painted once, so the paint is re-applied
// from a MutationObserver and the badge is read back out of the text the writer left.
const HEAD_BTNS: ReadonlyArray<{ id: string; icon: IconName; word: string }> = [
  { id: "attnbtn", icon: "megaphone", word: "Attention" },
  { id: "opsbtn", icon: "inbox", word: "Inbox" },
  { id: "queuebtn", icon: "list", word: "Queue" },
  { id: "auditbtn", icon: "shield", word: "Audit" },
  { id: "outcomebtn", icon: "receipt", word: "Lands" },
  { id: "konstbtn", icon: "tree", word: "Konstellation" },
  { id: "devbtn", icon: "laptop", word: "Devices" },
  { id: "saverbtn", icon: "saver", word: "Saver" },
  { id: "morebtn", icon: "dots", word: "Mehr" },
  { id: "headplus", icon: "plus", word: "Eigener Knopf" },
];
// What a writer added to the glyph: "📣3" -> "3", "💻2 ⚠1" -> "2 ⚠1", "🗒" -> "".
// TWO RULES, both paid for by a measurement:
// (1) READ THE BUTTON'S OWN TEXT NODES, never `textContent` — once the icon is painted,
//     `textContent` would include the previous badge's span and count it twice.
// (2) A BADGE IS A NUMBER, not "whatever is not an emoji" — else the ⋯ button's own "⋯" stands
//     as its badge (measured: it came back as "⋯⋯").
// When the button carries no text node at all, the paint before this one is holding the count in
// its .hbadge; when it carries text, that text is the whole truth, including "the count is gone".
const headBadge = (b: HTMLElement): string => {
  const own = [...b.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent ?? "").join("");
  if (own.trim() !== "") return own.match(/\d+(?:\s*⚠\s*\d+)?/)?.[0] ?? "";
  return b.querySelector(".hbadge")?.textContent ?? "";
};

function paintHeadBtn(b: HTMLElement, ico: IconName, word: string) {
  const badge = headBadge(b);
  const ic = el("span", "tricon");
  ic.appendChild(icon(ico));
  b.replaceChildren(ic);
  if (badge) b.appendChild(el("span", "hbadge", badge));
  b.setAttribute("aria-label", word);
}

const headObs = new MutationObserver(() => paintHead());
function paintHead() {
  for (const spec of HEAD_BTNS) paintHeadBtn($(spec.id), spec.icon, spec.word);
  headObs.takeRecords(); // never react to this function's own writes
}
for (const spec of HEAD_BTNS)
  headObs.observe($(spec.id), { childList: true, characterData: true, subtree: true });
paintHead();
// the views: each button draws the arrangement it makes (src/icons.ts view1…view4)
for (const b of document.querySelectorAll<HTMLButtonElement>("#layouts button")) {
  const ic = el("span", "tricon");
  ic.appendChild(icon(`view${b.dataset.l ?? "1"}` as IconName));
  b.replaceChildren(ic);
  b.setAttribute("aria-label", b.title);
}

function copyLine(label: string, value: string): HTMLElement {
  const row = el("div", "shrline");
  row.appendChild(el("span", "k", label));
  const code = el("code", "", value);
  code.title = value;
  row.appendChild(code);
  const btn = el("button", "shrbtn", "copy") as HTMLButtonElement;
  btn.onclick = () => {
    copyText(value);
    btn.textContent = "✓";
    setTimeout(() => { btn.textContent = "copy"; }, 800);
  };
  row.appendChild(btn);
  return row;
}

export function fmtSince(ts: number): string {
  const min = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h}h ${min % 60}m ago` : `${Math.floor(h / 24)}d ago`;
}

function renderShareDlg() {
  const s = fleet[dlgSlot - 1];
  if (!s?.cwd) { closeShareDlg(); return; }
  dlgKey = s.share ? `${s.share.id}|${s.share.guests}|${s.share.comments}` : "none";
  sharepanel.replaceChildren();
  sharepanel.appendChild(el("h2", "", `Share session — ${s.label ?? baseName(s.cwd)}`));
  const sh = s.share;
  if (sh) {
    const status = el("div", "shrline");
    status.appendChild(el("span", "k", "status"));
    const live = el("span", "shrlive" + (sh.guests > 0 ? " on" : ""),
      sh.guests > 0 ? `● ${sh.guests} guest${sh.guests === 1 ? "" : "s"} connected` : "○ no guest connected");
    status.appendChild(live);
    status.appendChild(el("span", "shrsince", `shared ${fmtSince(sh.created)}`));
    sharepanel.appendChild(status);
    const shareUrl = `${shareBase || location.origin}/s/${sh.id}`;
    const linkRow = copyLine("link", shareUrl);
    // QR encodes the LINK only — password travels separately by design (see the hint below)
    const qrBtn = el("button", `shrbtn${dlgQr ? " active" : ""}`, "QR") as HTMLButtonElement;
    qrBtn.onclick = () => { dlgQr = !dlgQr; renderShareDlg(); };
    linkRow.appendChild(qrBtn);
    sharepanel.appendChild(linkRow);
    if (dlgQr) {
      const box = el("div", "shrqr");
      const qr = qrcode(0, "M"); // type 0 = auto-size to the payload
      qr.addData(shareUrl);
      qr.make();
      const img = el("img", "") as HTMLImageElement;
      img.src = qr.createDataURL(6, 3); // self-contained GIF data URI — no innerHTML, no network
      img.alt = shareUrl;
      box.appendChild(img);
      box.appendChild(el("div", "hint shrqrhint", "scan to open the share link — password still needed"));
      sharepanel.appendChild(box);
    }
    sharepanel.appendChild(copyLine("password", sh.password));
    // A share is view-only, always — there is no switch here because there is no mode to
    // switch. The guest's channel back is the comment thread below, which you read and act on.
    const accessRow = el("div", "shrline");
    accessRow.appendChild(el("span", "k", "access"));
    accessRow.appendChild(el("span", "v", "view only"));
    sharepanel.appendChild(accessRow);
    sharepanel.appendChild(el("div", "hint shrhint",
      "Guests watch — nothing they type reaches the terminal. Give link and password separately."));
    const cmts = el("div", "shrcmts");
    cmts.appendChild(el("div", "shrcmthead",
      sh.comments > 0 ? `💬 guest chat · ${sh.comments}` : "💬 guest chat"));
    const list = el("div", "shrcmtlist");
    cmts.appendChild(list);
    if (sh.comments > 0) void loadShareComments(s.id, list);
    // owner reply lands in the same thread, highlighted on the guest page
    const rrow = el("div", "shrreply");
    const rin = el("input", "shrreplyin") as HTMLInputElement;
    rin.placeholder = "reply to guests…";
    const rbtn = el("button", "shrbtn", "reply") as HTMLButtonElement;
    const sendReply = async () => {
      const text = rin.value.trim();
      if (!text || rbtn.disabled) return;
      rbtn.disabled = true;
      try {
        const res = await post(`/api/slots/${s.id}/comments`, { text });
        if (res.ok) {
          rin.value = "";
          await loadShareComments(s.id, list);
          await refresh();
        }
      } finally {
        rbtn.disabled = false;
      }
    };
    rbtn.onclick = () => void sendReply();
    rin.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); void sendReply(); }
    });
    rrow.append(rin, rbtn);
    cmts.appendChild(rrow);
    sharepanel.appendChild(cmts);
    const btns = el("div", "shrbtns");
    const rotate = el("button", "shrbtn", "new link + password") as HTMLButtonElement;
    rotate.onclick = async () => {
      if (!confirm("Replace this share? The old link and password stop working and connected guests are kicked.")) return;
      const r = await post(`/api/slots/${s.id}/share`, {});
      if (!r.ok) toast("couldn't rotate the share link");
      await refresh();
      renderShareDlg();
    };
    const revoke = el("button", "shrbtn danger", "end live share") as HTMLButtonElement;
    revoke.onclick = async () => {
      if (!confirm("End this share? The link stops working and connected guests are kicked immediately.")) return;
      const r = await post(`/api/slots/${s.id}/unshare`, {});
      if (!r.ok) toast("couldn't end the share");
      await refresh();
      renderShareDlg();
    };
    const close = el("button", "shrbtn", "close") as HTMLButtonElement;
    close.onclick = closeShareDlg;
    btns.append(rotate, revoke, close);
    sharepanel.appendChild(btns);
  } else {
    const accessRow = el("div", "shrline");
    accessRow.appendChild(el("span", "k", "access"));
    accessRow.appendChild(el("span", "v", "view only"));
    sharepanel.appendChild(accessRow);
    sharepanel.appendChild(el("div", "hint shrhint",
      "Guests see the live terminal but can't type or send anything."));
    const btns = el("div", "shrbtns");
    const create = el("button", "shrbtn primary", "create share link") as HTMLButtonElement;
    create.onclick = async () => {
      const res = await post(`/api/slots/${s.id}/share`, {});
      if (!res.ok) return;
      await refresh();
      renderShareDlg(); // now renders the link + generated password
    };
    const close = el("button", "shrbtn", "cancel") as HTMLButtonElement;
    close.onclick = closeShareDlg;
    btns.append(create, close);
    sharepanel.appendChild(btns);
  }
}

interface ShareCommentInfo { id: string; ts: number; name: string; text: string; from?: string }
async function loadShareComments(slotId: number, target: HTMLElement) {
  const res = await api(`/api/slots/${slotId}/comments`);
  if (!res.ok) return;
  const data = (await res.json().catch(() => ({}))) as { comments?: ShareCommentInfo[] };
  target.replaceChildren();
  for (const c of data.comments ?? []) {
    const row = el("div", c.from === "owner" ? "shrcmt own" : "shrcmt");
    const head = el("div", "shrcmtmeta");
    head.appendChild(el("b", "", c.from === "owner" ? "owner" : c.name));
    head.appendChild(el("span", "", fmtSince(c.ts)));
    const del = el("button", "shrcmtdel", "✕") as HTMLButtonElement;
    del.title = "delete this comment";
    del.onclick = async () => {
      const r = await post(`/api/slots/${slotId}/comments/${c.id}/delete`, {});
      if (!r.ok) toast("couldn't delete the comment");
      await refresh();
      renderShareDlg();
    };
    head.appendChild(del);
    row.appendChild(head);
    row.appendChild(el("div", "shrcmttext", c.text));
    target.appendChild(row);
  }
}

export function openShareDlg(slotId: number) {
  setDrawer(false);
  dlgSlot = slotId;
  renderShareDlg();
  sharedlg.style.display = "flex";
}

// --- scheduled prompts (⏱): compose text + "once in N min" or "every N min × K runs".
// Guard rails live server-side (idle gate, claude-alive gate, mandatory runs cap) —
// this dialog is just the window onto them.
const autodlg = $("autodlg"), autopanel = $("autopanel");
let autoSlot = 0;
let autoMode: "once" | "every" = "once";

function closeAutoDlg() {
  autodlg.style.display = "none";
  autoSlot = 0;
}
autodlg.addEventListener("click", (e) => {
  if (e.target === autodlg) closeAutoDlg();
});

function autoDesc(a: AutoInfo): string {
  if (a.everySec) return `every ${Math.round(a.everySec / 60)}m · ${a.runsLeft} left`;
  const dueIn = Math.max(0, Math.round((a.nextAt - Date.now()) / 60000));
  return a.enabled ? `once, in ~${dueIn}m` : "once";
}

function renderAutoStatus() {
  const stopped = autosOnSrv === false;
  const button = $("autobtn");
  button.classList.toggle("autos-stopped", stopped);
  button.title = stopped ? "Geplante Prompts für diese Session — automatische Prompts sind aus"
    : "Geplante Prompts für diese Session";
  const label = button.querySelector(".trlabel");
  if (label) label.textContent = stopped ? "Schedule · aus" : "Schedule";
  const status = document.getElementById("auto-status");
  if (!status) return;
  const state = `${autosOnSrv}:${quietHoursSrv?.start ?? ""}:${quietHoursSrv?.end ?? ""}`;
  if (status.dataset.state === state) return;
  status.dataset.state = state;
  status.replaceChildren();
  if (stopped) {
    const warning = el("div", "autostatusline");
    warning.appendChild(el("div", "", "Automatische Prompts sind aus — geplante Prompts werden nicht gesendet"));
    const settings = el("button", "shrbtn", "Fleet-Einstellungen") as HTMLButtonElement;
    settings.onclick = () => { closeAutoDlg(); openSettings(button, "fleet"); };
    warning.appendChild(settings);
    status.appendChild(warning);
  }
  if (quietHoursSrv) {
    const hh = (h: number) => String(h).padStart(2, "0");
    status.appendChild(el("div", "autostatusline", `Ruhezeit ${hh(quietHoursSrv.start)}–${hh(quietHoursSrv.end)}: wiederkehrende Prompts pausieren`));
  }
}

function renderAutoDlg() {
  const s = fleet[autoSlot - 1];
  if (!s?.cwd) { closeAutoDlg(); return; }
  autopanel.replaceChildren();
  autopanel.appendChild(el("h2", "", `Scheduled prompts — ${s.label ?? baseName(s.cwd)}`));
  const status = el("div", "autostatus");
  status.id = "auto-status";
  autopanel.appendChild(status);
  renderAutoStatus();
  const mine = autosList.filter((a) => a.slot === autoSlot);
  if (!mine.length) autopanel.appendChild(el("div", "hint shrhint", "No schedules for this session."));
  for (const a of mine) {
    const row = el("div", `autorow${a.enabled ? "" : " off"}`);
    const txt = el("span", "autotext", a.text);
    txt.title = a.text;
    row.appendChild(txt);
    row.appendChild(el("span", "autometa", autoDesc(a)));
    if (a.lastResult) row.appendChild(el("span", `autometa${a.lastResult.startsWith("skipped") ? " err" : ""}`, a.lastResult));
    const tog = el("span", "autobtnx", a.enabled ? "⏸" : "▶");
    tog.title = a.enabled ? "pause" : "resume";
    tog.onclick = async () => { const r = await post(`/api/autos/${a.id}/toggle`, {}); if (!r.ok) toast("couldn't toggle the schedule"); await refresh(); renderAutoDlg(); };
    const del = el("span", "autobtnx", "✕");
    del.title = "delete schedule";
    del.onclick = async () => { const r = await post(`/api/autos/${a.id}/delete`, {}); if (!r.ok) toast("couldn't delete the schedule"); await refresh(); renderAutoDlg(); };
    row.append(tog, del);
    autopanel.appendChild(row);
  }
  const form = el("div", "autoform");
  const preview = el("div", `autopreview${ta.value.trim() ? "" : " empty"}`,
    ta.value.trim() || "Type the prompt into the compose box first — it becomes the scheduled text.");
  form.appendChild(preview);
  const modeRow = el("div", "frow");
  const bOnce = el("button", `shrbtn${autoMode === "once" ? " active" : ""}`, "once") as HTMLButtonElement;
  const bEvery = el("button", `shrbtn${autoMode === "every" ? " active" : ""}`, "recurring") as HTMLButtonElement;
  bOnce.onclick = () => { autoMode = "once"; renderAutoDlg(); };
  bEvery.onclick = () => { autoMode = "every"; renderAutoDlg(); };
  modeRow.append(bOnce, bEvery);
  form.appendChild(modeRow);
  const numRow = el("div", "frow");
  const mins = document.createElement("input");
  mins.type = "number"; mins.min = "1"; mins.max = "1440"; mins.value = autoMode === "once" ? "5" : "30";
  numRow.append(el("span", "", autoMode === "once" ? "in" : "every"), mins, el("span", "", "min"));
  const runs = document.createElement("input");
  runs.type = "number"; runs.min = "1"; runs.max = "100"; runs.value = "5";
  if (autoMode === "every") numRow.append(el("span", "", "· max"), runs, el("span", "", "runs"));
  form.appendChild(numRow);
  const idleRow = el("div", "frow");
  const idle = document.createElement("input");
  idle.type = "checkbox"; idle.checked = true;
  const idleLabel = document.createElement("label");
  idleLabel.append(idle, el("span", "", "only send when the session has been quiet for 60s"));
  idleRow.appendChild(idleLabel);
  form.appendChild(idleRow);
  const btns = el("div", "shrbtns");
  const create = el("button", "shrbtn primary", "schedule") as HTMLButtonElement;
  create.onclick = async () => {
    const text = ta.value.trim();
    if (!text) { renderAutoDlg(); return; }
    const m = Math.max(1, Number(mins.value) | 0);
    const body = autoMode === "once"
      ? { text, inSec: m * 60, idleSec: idle.checked ? 60 : 0 }
      : { text, everySec: m * 60, runs: Math.max(1, Number(runs.value) | 0), idleSec: idle.checked ? 60 : 0 };
    const res = await post(`/api/slots/${autoSlot}/autos`, body);
    if (res.ok) {
      ta.value = "";
      updateChips();
      await refresh();
      renderAutoDlg();
    }
  };
  const close = el("button", "shrbtn", "close") as HTMLButtonElement;
  close.onclick = closeAutoDlg;
  btns.append(create, close);
  form.appendChild(btns);
  autopanel.appendChild(form);
}

$("autobtn").onclick = () => {
  const slot = panes[focused]?.slot;
  if (!slot) return;
  setDrawer(false);
  autoSlot = slot;
  renderAutoDlg();
  autodlg.style.display = "flex";
};

// --- prompt history: composed sends recorded server-side per slot; recalled via the
// 🕘 popover or ArrowUp/ArrowDown cycling in an (empty) compose box ---
const hist = $("hist"), histList = $("histlist"), histTitle = $("histtitle");
type HistEntry = HistoryEntry;

async function fetchHistory(slot: number): Promise<HistEntry[]> {
  const res = await api(`/api/slots/${slot}/history`);
  if (!res.ok) return [];
  const data = (await res.json()) as { history?: HistEntry[] };
  return data.history ?? [];
}

export function fmtTs(ts: number): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString()
    ? time
    : `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

function closeHist() {
  hist.style.display = "none";
}
hist.addEventListener("click", (e) => {
  if (e.target === hist) closeHist();
});

// the directory view: every composed send ever, across all slots and slot lifetimes
interface PromptDirEntry { ts: number; slot: number; cwd: string | null; label: string | null; source: string; text: string }
let histAll = prefBool("fleet.histall");

// one row per prompt; meta = timestamp, plus origin session in the directory view.
// click loads the prompt into the compose box for editing — it never auto-sends
function histRow(text: string, meta: string, source: string | undefined): HTMLElement {
  const origin = historySource({ text, source });
  const row = el("div", "histrow");
  row.append(el("div", "histtext", text), el("span", "histts", `${origin} · ${meta}`));
  const copy = el("span", "histcopy", "⧉");
  copy.title = "copy prompt";
  copy.onclick = (e) => {
    e.stopPropagation();
    copyText(text);
    copy.textContent = "✓";
    setTimeout(() => { copy.textContent = "⧉"; }, 800);
  };
  row.appendChild(copy);
  row.title = origin === "owner" ? "Eigene Nachricht zum Bearbeiten laden"
    : origin === "fleet" ? "Fleet-Zustellung; nur Kopieren, nicht ins Eingabefeld laden"
    : "Herkunft unbekannt; nur Kopieren, nicht ins Eingabefeld laden";
  row.onclick = () => {
    if (origin !== "owner") return;
    cyc = null;
    ta.value = text;
    updateChips();
    growComposer();
    closeHist();
    ta.focus();
  };
  return row;
}

async function renderHist() {
  const slot = panes[focused]?.slot ?? 0;
  const all = histAll || !slot; // no focused session → the directory is all there is
  histTitle.textContent = all ? "Prompt directory — all sessions" : `Prompt history — slot ${slot}`;
  const tabs = el("div", "shrbtns");
  const bThis = el("button", `shrbtn${all ? "" : " active"}`, "this session") as HTMLButtonElement;
  bThis.disabled = !slot;
  const bAll = el("button", `shrbtn${all ? " active" : ""}`, "all sessions") as HTMLButtonElement;
  const setAll = (on: boolean) => {
    histAll = on;
    prefSetBool("fleet.histall", on);
    void renderHist();
  };
  bThis.onclick = () => setAll(false);
  bAll.onclick = () => setAll(true);
  tabs.append(bThis, bAll);
  if (all) {
    const res = await api("/api/prompts?limit=300");
    const data = res.ok ? ((await res.json()) as { prompts: PromptDirEntry[] }) : { prompts: [] };
    histList.replaceChildren(tabs);
    if (!data.prompts.length) histList.appendChild(el("div", "histnone", "no prompts recorded yet"));
    for (const p of data.prompts) {
      const origin = p.label ?? (p.cwd ? baseName(p.cwd) : `slot ${p.slot}`);
      histList.appendChild(histRow(p.text, `${origin} · ${fmtTs(p.ts)}`,
        p.text.startsWith("[fleet") ? "fleet" : p.source === "terminal" ? "owner"
          : ["auto", "steward"].includes(p.source) ? "fleet" : p.source));
    }
  } else {
    const items = await fetchHistory(slot);
    histList.replaceChildren(tabs);
    if (!items.length) histList.appendChild(el("div", "histnone", "nothing sent to this session yet"));
    for (const h of [...items].reverse()) histList.appendChild(histRow(h.text, fmtTs(h.ts), h.source));
  }
}

async function openHist() {
  await renderHist();
  hist.style.display = "flex";
}
$("histbtn").onclick = () => void openHist();

// ArrowUp in an empty box starts cycling (newest first); ArrowDown walks back toward
// the draft. Typing anything ends the cycle so an edit can't be clobbered.
let cyc: { slot: number; items: string[]; idx: number; draft: string } | null = null;
async function cycleHist(dir: number) {
  const slot = panes[focused]?.slot;
  if (!slot) return;
  if (!cyc || cyc.slot !== slot) {
    const draft = ta.value;
    const items = (await fetchHistory(slot)).filter((h) => historySource(h) === "owner").map((h) => h.text);
    if (!items.length || panes[focused]?.slot !== slot || ta.value !== draft) return;
    cyc = { slot, items, idx: items.length, draft };
  }
  const next = cyc.idx + dir;
  if (next < 0 || next > cyc.items.length) return;
  cyc.idx = next;
  ta.value = next === cyc.items.length ? cyc.draft : cyc.items[next];
  ta.selectionStart = ta.selectionEnd = ta.value.length;
  updateChips();
  // the field takes the text's own height at once, every paragraph in view (owner 14.10., Mangel 61) — not an
  // input event: that would end the cycle
  growComposer();
}
// ↑/↓ inside a recalled message move the caret a row, the field's own way (owner 14.10., Mangel 69: „[Zitat entfernt]“
// ); they fetch the next message only from its edge — ↑ from the first row or from the end,
// where a recall leaves the caret, ↓ from the last row. Rows as the field wraps them, so a long dictated
// paragraph counts as many: the text up to the caret, with the rest of its word that wraps along, measured in
// the field itself (its scrollbar kept, so the rows wrap at the same width) is as high as one row, or as the
// whole text. Nothing was typed since the recall (typing ends the cycle), so swapping the value for the
// measurement costs no undo step.
function caretOnEdgeRow(dir: number): boolean {
  const { value, selectionStart: at, selectionEnd, scrollTop } = ta;
  if (at !== selectionEnd) return false;
  if (dir < 0 && at === value.length) return true;
  const { height, minHeight, overflowY } = ta.style;
  const scrolls = ta.scrollHeight > ta.clientHeight;
  Object.assign(ta.style, { height: "0", minHeight: "0", overflowY: scrolls ? "scroll" : "hidden" });
  const tall = (text: string) => { ta.value = text; return ta.scrollHeight; };
  const toCaret = tall(value.slice(0, at) + (/^\S*/.exec(value.slice(at))?.[0] ?? ""));
  const edge = toCaret === tall(dir < 0 ? "x" : value);
  ta.value = value;
  Object.assign(ta.style, { height, minHeight, overflowY });
  ta.setSelectionRange(at, at);
  ta.scrollTop = scrollTop;
  return edge;
}

// shared one-line failure notice for the non-destructive mutation handlers (task/auto/share/
// dispatch toggles) — their views re-derive from refresh(), so a failed POST otherwise no-ops
// silently. Layout stays inline so it needs no CSS-file change; the one colour comes from the
// page's --danger token, so the toast cannot drift away from the rest of the error red.
export function toast(msg: string, ms = 2600) {
  const t = el("div", "", msg);
  t.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--danger);color:#fff;padding:8px 14px;border-radius:6px;z-index:9999;font-size:13px;max-width:80%;box-shadow:0 2px 8px rgba(0,0,0,.4)";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// --- compose box: Enter sends (bracketed paste + Enter server-side), Shift+Enter = newline ---
// the refused/failed state belongs to the whole surface, not one colour on one button
function flashSendError() {
  compEl.classList.add("err");
  setTimeout(() => { compEl.classList.remove("err"); }, 1200);
}
// ONE delivery path for every composer on this board (the terminal's box below the pane, and the
// conversation view's own bar): same POST /send, same 409 reading, same failure sentence. The
// second composer was the moment this had to stop being inline in doSend — two readings of a
// three-shape 409 is one reading too many.
export function deliver(slot: number, text: string): Promise<boolean> {
  const measured: { response?: Response } = {};
  const delivery = (async (): Promise<boolean> => {
    try {
      const res = await post("/send", { slot, text, submit: true });
      measured.response = res;
      if (!res.ok) {
        const body: unknown = await res.clone().json().catch(() => null);
        const message = sendFailureMessage(res.status, body);
        toast(message, sendFailureToastMs(message));
        flashSendError();
        return false;
      }
      return true;
    } catch {
      toast("send outcome unknown — check the pane; text kept, do not paste again");
      flashSendError(); // text stays in the box so nothing typed is silently lost
      return false;
    }
  })();
  perfDeliveries.set(delivery, measured);
  return delivery;
}

async function doSend(at = perfSendClickAt ?? performance.now()) {
  perfSendClickAt = undefined;
  const pane = panes[focused];
  const text = ta.value.trim();
  // exactly what the box used to carry after an upload: the prompt, then one mention per line
  const outgoing = [text, attachedText()].filter(Boolean).join("\n");
  const slot = pane?.slot;
  if (!outgoing || !slot || send.disabled) return;
  // the box's content was written for draftSlot; switchDraft keeps the two equal, and a send
  // that finds them apart refuses rather than guess (the seventeenth cut's misdelivery)
  if (slot !== draftSlot) { toast(`not sent — this draft belongs to slot ${draftSlot}`); return; }
  // …and to the session that was running there: after a recycle it waits for "übernehmen" or an empty box
  if (syncBox()) {
    renderTarget();
    toast("Nicht gesendet — der Entwurf war für die beendete Session. Übernehmen oder leeren.");
    flashSendError();
    return;
  }
  const span = perfStart("J3", at, { view: pane.isChat ? "chat" : "term", bubbleMs: null, responseMs: null, transcriptMs: null });
  let measuredResponse: Response | undefined;
  let sendOk = false;
  send.disabled = true;
  const pending = pane.addPending(outgoing);
  if (pending) {
    perfPending.set(pending, { span });
    perfPaint(() => { span.attrs.bubbleMs = Math.max(0, performance.now() - span.start); });
  }
  try {
    const delivery = deliver(slot, outgoing);
    sendOk = await delivery;
    measuredResponse = perfDeliveries.get(delivery)?.response;
    span.attrs.responseMs = Math.max(0, performance.now() - span.start);
    if (!sendOk) { if (pending) pane.dropPending(pending); return; }
    pending?.querySelector(".mwho")?.replaceChildren("you · gesendet");
    pending?.querySelector(".msend")?.replaceWith(sendState("wait"));
    // the send IS the next turn: the counter restarts now, not one transcript poll later
    pane.lastTurnAt = Math.max(pane.lastTurnAt, serverClock());
    tickCacheAge();
    ta.value = "";
    clearAttachments();
    renderAttachments();
    growComposer();
    cyc = null;
    updateChips();
    keepDraftsNow(); // a sent draft is gone from the storage too, not one poll later
    pane.snapToBottom();
  } finally {
    send.disabled = false;
    perfFinish(span, sendOk, measuredResponse);
  }
}
send.addEventListener("click", (e) => { perfSendClickAt = e.timeStamp; }, { capture: true });
send.onclick = () => void doSend();
// on the phone ➤ keeps the field's focus, like the key row: an engine that focuses a pressed button
// (Chromium) blurred the field under the finger, the composer moved, and the tap's click landed on
// #bar — nothing was sent, and the keyboard left. iOS focuses no button on a tap; the desktop keeps
// its own focus rules.
send.addEventListener("pointerdown", (e) => { if (isMobile()) e.preventDefault(); });
ta.addEventListener("keydown", (e) => {
  // desktop: Enter sends. mobile: Enter is a newline (messaging convention) — ➤ sends
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !isMobile()) {
    e.preventDefault();
    void doSend(e.timeStamp);
    return;
  }
  if (e.isComposing) return;
  // Esc while the session works: it stops, and the prompt comes back here (src/recall.ts)
  if (e.key === "Escape" && panes[focused]?.escKey()) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  // only hijack ArrowUp when the box is empty or already cycling, and then only on the recalled
  // message's edge — mid-text it must keep its native "move the caret up a line" meaning. A waiting
  // message comes back first.
  if (e.key === "ArrowUp" && !cyc && ta.value === "" && panes[focused]?.upKey()) {
    e.preventDefault();
  } else if (e.key === "ArrowUp" && (ta.value === "" || (cyc && caretOnEdgeRow(-1)))) {
    e.preventDefault();
    void cycleHist(-1);
  } else if (e.key === "ArrowDown" && cyc && caretOnEdgeRow(1)) {
    e.preventDefault();
    void cycleHist(1);
  }
});

// --- command prefix chips (server-configurable via FLEET_CHIPS) ---
function currentPrefix(): string | null {
  for (const c of chipCmds) if (ta.value === c || ta.value.startsWith(c + " ")) return c;
  return null;
}
export function updateChips() {
  const active = currentPrefix();
  for (const b of chipsEl.querySelectorAll<HTMLButtonElement>(".chip"))
    b.classList.toggle("active", b.dataset.cmd === active);
}
export function togglePrefix(cmd: string) {
  const active = currentPrefix();
  const rest = active ? ta.value.slice(active.length).replace(/^ /, "") : ta.value;
  ta.value = active === cmd ? rest : cmd + " " + rest;
  updateChips();
  ta.focus();
}
ta.addEventListener("input", () => {
  cyc = null; // real typing (not our programmatic recall) ends a history cycle
  updateChips();
  growComposer();
  syncBox(); // an emptied box frees an orphaned draft; the first character binds a new one
  renderTarget();
});

// --- 📎 drops: hand a FILE to the focused session (drag&drop, paste, or the button) ----------
// Three gestures, one path, because they differ only in where the FileList comes from. All three
// exist on purpose: drag&drop is the desktop reflex, paste is what a screenshot actually is, and
// the button is the only one of them that exists on a phone — a drop-only version would be the
// feature for half the devices the owner runs Fleet on.
//
// What lands in the composer is a PATH, never the bytes. The file is written into the session's
// own working directory and the box is handed one line naming it; the owner still writes the
// prompt around it. The wording of that line comes from the SERVER (dropMention), so the mention
// format is decided in one place rather than re-guessed here.
export const dropBtn = $("dropbtn") as HTMLButtonElement;
export const dropFile = $("dropfile") as HTMLInputElement;
const dropLay = $("droplay");
const mainEl = $("main");

// WHAT IS ATTACHED RIGHT NOW. The upload path is unchanged (POST /api/slots/:id/upload, the
// server words the mention); what changed in the third cut is only where the mention is KEPT:
// on this list, shown as an icon with an ✕, instead of as a line the owner has to edit out of the
// box. doSend appends them in upload order, so what leaves the board is the same text as before.
// Ninth cut (owner: „[Zitat entfernt]“): an
// image shows its own bytes as a thumbnail — an object URL over the File the browser already
// holds, no request — and every entry carries its size. The URL is revoked wherever the entry
// leaves the list (✕, send), otherwise every dropped screenshot stays in memory for the tab's life.
type Attachment = { name: string; mention: string; size: number; thumb?: string };
const attached: Attachment[] = [];

// ONE DRAFT PER SLOT (seventeenth cut) — why and how: src/drafts.ts. Reproduced in the preview,
// split 7|6: typed with 7 focused, mousedown on 6, Enter → POST /send {slot:6}.
const drafts = new DraftBook<Attachment>();
let draftSlot = 0;
// …and the draft IN the box is bound to its occupation too (src/drafts.ts#BoxDraft): a recycled
// FOCUSED slot keeps the text on screen, marked, and no Enter sends it to the session that replaced
// the one it was written for. An occupation is the session's openedAt, 0 for a slot with no session,
// undefined for a slot whose row is not read yet.
const box = new BoxDraft();
function occupation(slot: number): number | undefined {
  const s = slot ? fleet.find((x) => x.id === slot) : undefined;
  return !s ? undefined : s.cwd ? s.openedAt ?? 0 : 0;
}
const boxHolds = (): boolean => !!ta.value.trim() || attached.length > 0;
// re-read on every poll (updateTitle), input and send; the target paints the answer
function syncBox(): boolean {
  const orphan = box.observe(occupation(draftSlot), boxHolds());
  keepDraftsNow();
  return orphan;
}
export function boxOrphan(): boolean { return syncBox(); }
export function adoptBox(): void {
  box.adopt(occupation(draftSlot));
  renderTarget();
  ta.focus();
}
// where the box's draft parks when the focus leaves it: an orphan under the occupation it was
// written for, so the book drops it like any draft of an ended session — never under the new one
const parkedAt = (): number | undefined => box.orphan ? box.boundTo : fleet[draftSlot - 1]?.openedAt;

// THE DRAFTS SURVIVE A RELOAD — why and the wire shape: src/drafts.ts#keepDrafts. Nothing is written
// before the first read of the slot rows has put the kept drafts back: a focus at boot (the box
// still empty) would otherwise overwrite them with nothing. Written on every change of the box or
// the book, and skipped when the document is the one already stored.
let draftsRestored = false;
let draftsKept = "";
function keepDraftsNow(): void {
  if (!draftsRestored) return;
  const rows = drafts.entries();
  if (draftSlot) rows.push([draftSlot, { openedAt: parkedAt(), text: ta.value, attached }]);
  const doc = JSON.stringify(keepDrafts(rows));
  if (doc === draftsKept) return;
  draftsKept = doc;
  prefSet("fleet.drafts", doc === "{}" ? null : doc);
}
function restoreDrafts(): void {
  if (draftsRestored) return;
  draftsRestored = true;
  for (const [slot, d] of readKeptDrafts(prefJSON<unknown>("fleet.drafts"))) {
    // the book's rule: a draft belongs to one occupation, and one that ended meanwhile gets nothing
    if (fleet[slot - 1]?.openedAt !== d.openedAt) continue;
    if (slot !== draftSlot) { drafts.restore(slot, d.openedAt, d); continue; }
    if (boxHolds()) continue; // typed on this load already: that text wins
    ta.value = d.text;
    attached.push(...d.attached);
    box.reset(occupation(slot));
    renderAttachments();
    growComposer();
    updateChips();
  }
  keepDraftsNow();
}
addEventListener("pagehide", keepDraftsNow);
// WHERE THE KEYS WERE, ACROSS A RELOAD (owner 14.10., Mangel 64: „[Zitat entfernt]“
// ): a newer bundle reloads a hidden tab (armReload) — the owner
// copying in another app — and the page came back with the keys on <body>, so the Cmd+V went nowhere. The tab keeps
// whether the composer or the focused pane's terminal had them; the boot gives them back (restoreFocus). The field's
// text comes back on its own (restoreDrafts). sessionStorage: one tab's state, it must not reach another tab
const FOCUS_KEY = "fleet.focus";
// WHILE THE BOOT LAYS OUT THE PANES, NOTHING MOVES THE KEYS (owner 14.10. 21:1x, Mangel 64): assign() focused a pane
// while it still stood in the terminal view, the boot turned it into the chat view only afterwards — for up to 0.2 s
// the terminal of a chat pane had the keys, and a Cmd+V then went to the session. The boot's end gives the keys once.
let booting = true;
addEventListener("pagehide", () => {
  const at = document.activeElement === ta ? "composer" : document.activeElement === panes[focused]?.term.textarea ? "term" : null;
  try {
    if (at) sessionStorage.setItem(FOCUS_KEY, at);
    else sessionStorage.removeItem(FOCUS_KEY);
  } catch { /* storage refused — the reload comes back with the keys on <body>, as before */ }
});
// Read at load, not at the boot's end (owner 14.10. 21:1x: „[Zitat entfernt]“):
// the chat field gets its keys back before the first data arrives; the terminal needs its pane and waits for the boot
const keysWere: string | null = (() => {
  try {
    const at = sessionStorage.getItem(FOCUS_KEY);
    sessionStorage.removeItem(FOCUS_KEY);
    return at;
  } catch { return null; }
})();
function restoreFocus(at: "composer" | "term"): void {
  if (keysWere !== at || isMobile()) return; // the phone has no Cmd+V, and a focused field there would raise the keyboard
  const put = () => {
    if (document.activeElement && document.activeElement !== document.body) return; // the owner put the keys somewhere already
    const pane = panes[focused];
    if (at === "composer" && !ta.disabled) {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = ta.value.length;
    } else if (at === "term" && pane?.slot) pane.term.focus();
  };
  // a tab reloaded while hidden gets the keys back when it is seen again
  if (document.hidden) document.addEventListener("visibilitychange", put, { once: true });
  else put();
}
restoreFocus("composer");
// …and a Cmd/Ctrl+V whose keys sit on <body> — before the boot, after a click on nothing — goes to the chat field: the
// field takes the keys before the paste runs (owner: „[Zitat entfernt]“
// ). Keys in the terminal, in another field or in an open dialog or popover stay where they are, and so does a tab
// whose terminal had the keys before the reload.
window.addEventListener("keydown", (e) => {
  if (!(APPLE ? e.metaKey : e.ctrlKey) || e.altKey || e.key.toLowerCase() !== "v" || keysWere === "term" || isMobile()) return;
  if (document.activeElement && document.activeElement !== document.body) return;
  if (ta.disabled || !ta.getClientRects().length) return;
  if ([...document.querySelectorAll<HTMLElement>('.overlay, [aria-modal="true"], .optpop.open')].some((d) => d.getClientRects().length)) return;
  ta.focus();
  ta.selectionStart = ta.selectionEnd = ta.value.length;
}, true);
// what went into the field before the boot named its first slot — a Cmd+V right after a reload (Mangel 64) — belongs
// to that slot: it follows the slot's kept draft instead of parking under no slot, where the swap used to drop it
let draftBound = false;
function switchDraft(slot: number): void {
  if (slot === draftSlot) return;
  const early = !draftBound && draftSlot === 0 && boxHolds() ? { text: ta.value, attached: [...attached] } : null;
  if (slot) draftBound = true;
  const next = drafts.swap(draftSlot, parkedAt(), early ? { text: "", attached: [] } : { text: ta.value, attached },
    slot, fleet[slot - 1]?.openedAt);
  for (const a of next.dropped) if (a.thumb) URL.revokeObjectURL(a.thumb);
  draftSlot = slot;
  box.reset(occupation(slot));
  ta.value = next.text + (early?.text ?? "");
  attached.length = 0; // no revoke: the parked entries still own their thumbnails
  attached.push(...next.attached, ...(early?.attached ?? []));
  cyc = null;
  renderAttachments();
  growComposer();
  updateChips();
  keepDraftsNow();
}

function mentionExplorerPath(slot: number, path: string): void {
  const openedAt = fleet[slot - 1]?.openedAt;
  if (!openedAt) return;
  if (slot === draftSlot) {
    ta.value = fxAppendPath(ta.value, path);
    ta.selectionStart = ta.selectionEnd = ta.value.length;
    cyc = null;
    growComposer();
    updateChips();
    keepDraftsNow();
    return;
  }
  const currentSlot = draftSlot;
  const currentOpenedAt = parkedAt(); // parked and taken back under the same value, orphan or not
  const target = drafts.swap(currentSlot, currentOpenedAt, { text: ta.value, attached }, slot, openedAt);
  for (const a of target.dropped) if (a.thumb) URL.revokeObjectURL(a.thumb);
  const restored = drafts.swap(slot, openedAt,
    { text: fxAppendPath(target.text, path), attached: target.attached }, currentSlot, currentOpenedAt);
  for (const a of restored.dropped) if (a.thumb) URL.revokeObjectURL(a.thumb);
  ta.value = restored.text;
  attached.length = 0;
  attached.push(...restored.attached);
  renderAttachments();
  growComposer();
  updateChips();
  keepDraftsNow();
}

// the owner's „[Zitat entfernt]“ — bytes in the short form a file list uses: 512B, 820K, 1.4M, 12M
function fmtSize(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}K`;
  const m = n / (1024 * 1024);
  return `${m < 10 ? Math.round(m * 10) / 10 : Math.round(m)}M`;
}

function dropAttachment(i: number): void {
  const [gone] = attached.splice(i, 1);
  if (gone?.thumb) URL.revokeObjectURL(gone.thumb);
}
function clearAttachments(): void {
  closeLightbox(); // it may be showing a URL revoked on the next line
  for (const a of attached) if (a.thumb) URL.revokeObjectURL(a.thumb);
  attached.length = 0;
}

// Tenth cut (owner: an attached image must open large on click): ONE overlay for the page, over
// the whole board, showing the same object URL the thumbnail uses. Escape or a click beside the
// image closes it; the ✕ on the entry still only removes. It is built on first use, not in markup.
let lightbox: HTMLElement | null = null;
let lightboxBack: HTMLElement | null = null; // the thumbnail that opened it, to return focus to
function openLightbox(url: string, name: string, from: HTMLElement): void {
  if (!lightbox) {
    lightbox = el("div", "lightbox");
    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");
    lightbox.tabIndex = -1;
    lightbox.addEventListener("click", (e) => { if (!(e.target instanceof HTMLImageElement)) closeLightbox(); });
    lightbox.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      closeLightbox();
    });
    document.body.appendChild(lightbox);
  }
  const img = document.createElement("img");
  img.src = url;
  img.alt = name;
  lightbox.replaceChildren(img, el("div", "lbname", name));
  lightbox.setAttribute("aria-label", name);
  lightboxBack = from;
  lightbox.classList.add("open");
  lightbox.focus();
}
function closeLightbox(): void {
  if (!lightbox?.classList.contains("open")) return;
  lightbox.classList.remove("open");
  lightbox.replaceChildren();
  // a chat thumbnail can be gone by now (the pane switched slot): focus nothing rather than a ghost
  if (lightboxBack?.isConnected) lightboxBack.focus();
  lightboxBack = null;
}

function renderAttachments(): void {
  reshapeSurface(() => compFiles.replaceChildren(...attached.map((a, i) => {
    const box = el("div", "att");
    box.title = a.mention;
    // an image's thumbnail is a button that opens it large; everything else is a plain icon
    const lead = box.appendChild(el(a.thumb ? "button" : "span", "attico"));
    const fallback = () => {
      lead.replaceChildren(icon(/\.(png|jpe?g|gif|webp|svg|heic|avif)$/i.test(a.name) ? "image" : "file"));
      lead.classList.remove("attopen");
      lead.onclick = null;
    };
    if (a.thumb) {
      const thumb = a.thumb;
      const img = document.createElement("img");
      img.className = "attthumb";
      img.alt = "";
      img.src = thumb;
      img.onerror = fallback; // a format this browser cannot draw (HEIC) keeps the icon, and no lightbox
      lead.appendChild(img);
      lead.classList.add("attopen");
      lead.title = `open ${a.name}`;
      lead.onclick = () => openLightbox(thumb, a.name, lead);
    } else fallback();
    // middle-truncated: the start gives way, the tail (last characters + extension) always shows
    const cut = Math.max(0, a.name.length - 8);
    const name = box.appendChild(el("span", "attname"));
    name.append(el("span", "attstart", a.name.slice(0, cut)), el("span", "attend", a.name.slice(cut)));
    box.appendChild(el("span", "attsize", fmtSize(a.size)));
    const x = el("button", "attx") as HTMLButtonElement;
    x.appendChild(icon("x"));
    x.title = `remove ${a.name} from this prompt`;
    x.onclick = () => { dropAttachment(i); renderAttachments(); syncBox(); renderTarget(); ta.focus(); };
    box.appendChild(x);
    return box;
  })));
}

const attachedText = (): string => attached.map((a) => a.mention).join("\n");

async function uploadDrops(files: File[]): Promise<void> {
  if (!files.length) return;
  const slot = panes[focused]?.slot;
  if (!slot) { toast("no session focused — pick one first"); return; }
  dropBtn.disabled = true; // the busy state is the disabled style — the icon stays
  try {
    // sequential, not Promise.all: the mentions are appended to a shared box in the order the
    // owner picked the files, and the cap is per file — a parallel burst would only make a
    // multi-file rejection harder to read.
    for (const f of files) {
      const fd = new FormData();
      fd.append("file", f, f.name);
      // no content-type header: the browser must set its own multipart boundary
      const res = await api(`/api/slots/${slot}/upload`, { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as { mention?: string; error?: string };
      // stop at the first failure instead of soldiering on — the usual cause (over the cap, or a
      // repo that does not ignore the drop directory) applies to the whole batch, and a toast per
      // file would bury it.
      if (!res.ok || !j.mention) { toast(j.error ?? `upload failed (${res.status})`); return; }
      const entry: Attachment = { name: f.name, mention: j.mention, size: f.size,
        ...(f.type.startsWith("image/") ? { thumb: URL.createObjectURL(f) } : {}) };
      // the focus may have moved during the upload: the file lives in `slot`'s drops directory,
      // so it joins that slot's draft, never the one now in the box
      if (slot === draftSlot) attached.push(entry);
      else drafts.attach(slot, fleet[slot - 1]?.openedAt, entry);
    }
    renderAttachments();
    updateChips();
    keepDraftsNow();
    ta.focus();
  } finally {
    dropBtn.disabled = false;
  }
}

const dragHasFiles = (e: DragEvent): boolean => Array.from(e.dataTransfer?.types ?? []).includes("Files");
const dragHasExplorerPath = (e: DragEvent): boolean =>
  Array.from(e.dataTransfer?.types ?? []).includes(FX_PATH_MIME);
// A file dropped ANYWHERE on the page is, by browser default, a navigation to that file — the
// board would simply disappear. So the page-level default is cancelled everywhere while only
// #main actually accepts a drop; a miss then does nothing instead of destroying the session view.
document.addEventListener("dragover", (e) => { if (dragHasFiles(e) || dragHasExplorerPath(e)) e.preventDefault(); });
document.addEventListener("drop", (e) => { if (dragHasFiles(e) || dragHasExplorerPath(e)) e.preventDefault(); });
mainEl.addEventListener("dragover", (e) => {
  if (!dragHasFiles(e) && !dragHasExplorerPath(e)) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  const internal = e.dataTransfer ? fxPathDrop(e.dataTransfer.getData(FX_PATH_MIME)) : null;
  dropLay.textContent = internal ? `Drop to add ${internal.path} to slot ${internal.slot}'s prompt`
    : "Drop to hand the file to this session";
  dropLay.classList.add("on");
});
// only when the pointer actually left #main — dragleave also fires when crossing between the
// pane and the composer inside it, and hiding on those would make the target flicker
mainEl.addEventListener("dragleave", (e) => {
  const to = e.relatedTarget;
  if (to instanceof Node && mainEl.contains(to)) return;
  dropLay.classList.remove("on");
});
mainEl.addEventListener("drop", (e) => {
  dropLay.classList.remove("on");
  const internal = e.dataTransfer ? fxPathDrop(e.dataTransfer.getData(FX_PATH_MIME)) : null;
  if (internal) {
    e.preventDefault();
    mentionExplorerPath(internal.slot, internal.path);
    return;
  }
  if (!dragHasFiles(e)) return;
  e.preventDefault();
  void uploadDrops(Array.from(e.dataTransfer?.files ?? []));
});
// a paste with files uploads them; a text paste the field inserts itself (src/paste.ts, Mangel 64)
ta.addEventListener("paste", (e) => {
  const files = Array.from(e.clipboardData?.files ?? []);
  if (files.length) {
    e.preventDefault();
    void uploadDrops(files);
    return;
  }
  const text = e.clipboardData?.getData("text/plain") ?? "";
  if (!text) return;
  e.preventDefault();
  pasteText(ta, text, (t) => { document.execCommand("insertText", false, t); });
});
dropBtn.onclick = () => dropFile.click();
dropFile.addEventListener("change", () => {
  const files = Array.from(dropFile.files ?? []);
  dropFile.value = ""; // so picking the SAME file again still fires a change
  void uploadDrops(files);
});

// --- boot: restore layout + pane assignments (migrates the old fleet.current key) ---
initBoard();
// THE TESTINSTANZEN CARD IS GONE (owner 2026-10-08: „[Zitat entfernt]“
// 
// ): every worktree's test instance stands at its row under Arbeitsorte, with Öffnen
// and Stoppen there (src/board.ts#tiLine); GET /api/testinstanzen keeps its other readers (docs/testinstanz.md).
initQueue();
initAttention();
initDevices();
initComposer();
buildTray(); // the tray's entries are the functions that used to own an icon button of their own
void (async () => {
  await refresh();
  const view = prefJSON<{ layout?: number; panes?: number[]; focused?: number; chats?: boolean[] }>("fleet.view");
  const legacy = prefNumber("fleet.current");
  const n = !isMobile() && view.layout && LAYOUTS[String(view.layout)] ? view.layout : 1;
  const assignments = view.panes ?? (legacy ? [legacy] : []);
  if (!assignments.some((s) => s && fleet[s - 1]?.cwd)) {
    const first = fleet.find((s) => s.cwd)?.id;
    if (first) assignments[0] = first;
  }
  setLayout(n, assignments);
  // back into the conversation view only where the SAME slot sits in the same pane again
  // (syncHarnessAffordances sends a slot without one back to the terminal on its own)
  panes.forEach((p, i) => { if (view.chats?.[i] && p.slot && p.slot === view.panes?.[i]) p.setView("chat"); });
  focusPane(Math.min(view.focused ?? 0, n - 1));
  setCollapsed(prefBool("fleet.sidecollapsed"));
  booting = false;
  restoreFocus("term");
  // no kept place: the focused pane takes them its own way — the chat view's field, or the terminal
  if (!keysWere && (!document.activeElement || document.activeElement === document.body)) panes[focused]?.focus();
  if (location.hash.startsWith("#k15")) openK15Entwurf();
})();
