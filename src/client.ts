import { initQueue, taskText, briefByMain, taskTextBusy, taskTextWaiters, qShell, qPick, qView, qDetailKey, taskCardFull, loadTaskTexts, ProgramDigest, programsPoll, programsList, programsStale, loadPrograms, programMark, qGroupOf, qFirstLine, taskSourceLabel, qWaveProjectionKey, qLaneKey, qLaneJoinOf, renderQueueDetail, qSelect, renderQueue, openQueue, setQueueTreeOn, invalidateQueueList, setProgramsPoll, setProgramsStale, setQueueDetailKey } from "./queue";
import { initBoard, BriefInfo, BriefSetup, boardBody, boardOpen, termLimitOn, setTermLimit, boardFolds, outline, ReviewFinding, mergeWatch, mergePending, showRiskPreview, fetchSlotRisk, doLand, doMergeLand, doShelve, doCommit, sessionActive, newLane, boardShell, applyBoard, setBoard, GateInfo, gateInfo, postLandLive, meterSuites, renderSuiteMeter, DeployGapInfo, BundleStaleInfo, deployGapInfo, bundleStaleInfo, ErrorsInfo, errorsInfo, renderBoard, postLandAudit, renderPostLandAudit, renderMobileAlarmHint, setMeterOpen, setPostLandAudit, setGateInfo, setPostLandLive, setErrorsInfo, setMeterSuites, setDeployGapInfo, setBundleStaleInfo, takeFxAfterPaint } from "./board";
import { initComposer, compEl, compOpts, compTray, compFiles, live, liveOn, setComposerSize, fitTextarea, growComposer, reshapeSurface, mountComposer, renderParkHint, cacheTtlFor, tickCacheAge, renderComposerOpts, buildTray, setLive, renderChips, serverClock, cacheAge, CACHE_TTL_MS } from "./composer";
import { initDevices, devdlg, devbtn, closeDevDlg, devIsOpen, renderDevBtn, renderDevDlg, devicesSection, helperDevicesInfo, deviceOnlineMs, type HelperDeviceInfo, setDeviceSnapshot } from "./devices";
import { initAttention, attndlg, opsdlg, attnRows, ownerReportRows, opsRows, loadAttention, loadOwnerReports, setAttentionOpen, setOpsEvents, setReportsAwaitingOwner, setReportsAwaitingDelegate, closeAttnDlg, closeOpsDlg } from "./attention";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { CanvasAddon } from "@xterm/addon-canvas";
import { WebglAddon } from "@xterm/addon-webgl";
import { WebLinksAddon } from "@xterm/addon-web-links";
import qrcode from "qrcode-generator";
import { entityMatches, mdInto, type MdEntityKind } from "./md";
import { selectionMarkdown } from "./mdcopy";
import { Flakes } from "./flakes";
import { MarkStage, markFacts, placeMarks, projectHue, type MarkItem } from "./marks";
import { harnessMark, icon, type IconName } from "./icons";
import { modelLabel } from "./modelname";
import type { ModelEntry, ModelAvailability } from "../model-register";
import { DraftBook, historySource, type HistoryEntry } from "./drafts";
import { attachEntityCards, type EntFacts } from "./entcard";
import { closeEntityCard, hideEntityCard, showEntityCard } from "./entcard";
import { loadChatSizes, onChatSize, sizePanel, stepChatSizes } from "./chatsize";
import { PREFS, prefBool, prefJSON, prefNumber, prefRaw, prefSet, prefSetBool, prefText, type PrefDef } from "./prefs";
import { popover } from "./popover";
import { RECONNECT_SETTLED_MS, reconnectDelay } from "./backoff";
import { pollPlan } from "./pollplan";
import { pendingSettledBy, splitDeliveryHeader } from "./pendingsend";
import { askRisk, onDialogWillOpen } from "./dialog";
import { gitUnquote, porcelainPath } from "./gitpath";
import { matchTree, treeOf, type TreeNode } from "./filetree";
import { PLA_ACK_KEY, postLandAlarm } from "./plaudit";
import { METER_STATIONS, laneTail, meterKind, meterLine, mmss, suiteMeter, type MeterBall, type MeterStation } from "./suitemeter";
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
// everything this file and server.ts must say identically — see src/protocol.ts. Importing rather
// than re-declaring is what makes tsc, which gates every land, the thing that notices a drift.
import {
  WS_INPUT_MAX_BYTES, DISPOSITION_VERDICTS, INSTANCE_NAME_RE, INSTANCE_URL_RE, normalizeLaneAnchor,
  type GitInfo, type InstanceLink, type LaneAnchor, type PostLandAuditInfo, type PostLandAuditLiveInfo,
  type DispositionWorker, type DispositionVerdict, type SuiteOfferRow,
} from "./protocol";
// the list-on-the-left / thing-in-full-on-the-right window shared by review, picker, queue and
// the outcome feed. Chrome only — every renderer below still owns its own rows and data.
import { openShell, type Shell, type ShellRow } from "./shell";
import { closeFounding, openPicker } from "./founding";
import { runningEffort, runningModel } from "./running";

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
// MOBILE_MQ's second arm alone — the phone on its side (index.html's reading-mode block), no limit of its own
const LANDSCAPE_MQ = matchMedia("(pointer: coarse) and (max-height: 500px)");

// Terminal links (bare urls via WebLinksAddon, OSC 8 via the linkHandler option) open on
// Cmd/Ctrl-click, not a plain click: xterm activates a link on mouseup whenever the mousedown hit
// the same link (Linkifier._handleMouseUp), so a drag that selects the url to copy it would also
// open it. A touch screen has no modifier and xterm there does no drag-selection, so a tap opens.
// http(s) only — the same bar xterm's own OSC 8 path applies — in a new tab without an opener.
function openTermLink(e: MouseEvent, uri: string): void {
  if (!(e.metaKey || e.ctrlKey || isMobile())) return;
  let proto = "";
  try { proto = new URL(uri).protocol; } catch { return; }
  if (proto !== "http:" && proto !== "https:") return;
  window.open(uri, "_blank", "noopener,noreferrer");
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
// dialog helper closes it first, through this one handover, so the mechanism stays setDrawer's
onDialogWillOpen(() => setDrawer(false));
$("menu").onclick = () => setDrawer(true);
$("shade").onclick = () => setDrawer(false);
// mobile's settings gear (#mset, on the place the duplicate #refresh freed — the reconnect lives
// on the pane's own ↻ now, which the phone shows in the corner group). Desktop's gear sits in each
// pane's group; both open the same window.
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
let instRendered = "";

const instMenuOpen = () => instMenu.classList.contains("open");
function setInstMenu(open: boolean) {
  instMenu.classList.toggle("open", open && instanceLinks.length > 0);
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
function hostSign(name: IconName, text: string): HTMLElement[] {
  const ic = el("span", "tricon");
  ic.appendChild(icon(name));
  return [ic, el("span", "devname", text)];
}

function renderInstanceHead() {
  const key = JSON.stringify([instanceName, instanceLinks]);
  if (key === instRendered) return; // an open menu must survive the 2 s poll
  instRendered = key;
  // the ONE navigation of this client (e2e/pins.ts): the link's own url, nothing appended
  const go = (link: InstanceLink) => () => {
    setInstMenu(false);
    if (instOriginOf(link.url) !== location.origin) location.assign(link.url);
  };
  instWrap.classList.add("on");
  const pick = instanceLinks.length > 0;
  const n = Math.max(instanceLinks.length, 1);
  const at = instanceLinks.findIndex((l) => instOriginOf(l.url) === location.origin);
  // an unnamed single host shows only the screen and its "+": the title row has no room for a word
  instBtn.replaceChildren(...hostSign(n > 1 ? "screens" : "screen", instanceName ?? ""),
    el("span", "devcount", n > 1 ? `${at >= 0 ? at + 1 : "?"}/${n}` : "+"));
  instBtn.title = n > 1
    ? `Computer ${at >= 0 ? at + 1 : "?"} von ${n} — ${instanceName ?? "unbenannt"}. Klick zeigt die anderen.`
    : MORE_HOSTS;
  instBtn.classList.toggle("pick", pick);
  instBtn.onclick = pick ? () => setInstMenu(!instMenuOpen()) : null;
  instMenu.replaceChildren(...instanceLinks.map((link) => {
    const here = instOriginOf(link.url) === location.origin;
    const row = el("button", `instrow${here ? " here" : ""}`);
    row.append(el("span", "instname", link.name), el("span", "insturl", here ? "you are here" : link.url));
    row.title = here ? `${link.name} — this board` : `open ${link.name} at ${link.url} (its own login)`;
    row.onclick = go(link);
    return row;
  }));
  if (pick) instMenu.appendChild(el("div", "hint instnote", MORE_HOSTS));
  if (!pick) setInstMenu(false);
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

export async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, init);
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
  modelSuperseded?: { id: string; supersededBy?: string };
  // "no-agent" is the one value that matters: a typeable pane with nothing behind it. null/absent
  // = the slow tick has not reached this slot, which is not an answer and must not paint one.
  agent?: "alive" | "no-agent" | "no-pane" | "unprobed" | null;
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
  harness?: string; effort?: string;
  // what the session is for (server.ts, the /api/sessions slot row) — absent means none set
  mission?: string; awaiting?: "owner" | "main"; taskId?: string; taskHead?: string; programId?: string;
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
  // Codex rollout discovery is lazy and can terminally refuse ambiguity/loss. This is a typed
  // claim about the server poll, not inferred from harness/session recency in the client.
  codexRecovery?: { state: "pending" | "bound" | "ambiguous" | "lost";
    sessionId: string | null; disconnectSeenAt: number | null } }
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
export interface HarnessInfo { id: string; supports: { resume: boolean; transcript: boolean; model: boolean;
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
  // ↻ refine: the poll says a proposal exists, how it came out and how many children it holds —
  // the texts ride /api/tasks like everything else. `refining` is live server state (a worker is
  // running right now), which is why it is a fact about the moment and never persisted.
  refine?: { at: number; unchanged: boolean; count: number }; refining?: boolean;
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
// the proposal itself, as GET /api/tasks serves it (server.ts TaskRefine)
interface RefineChildView { text: string; doneCriterion?: string; verify?: string; files?: string[] }
export interface TaskRefineFull { at: number; model: string;
  proposal: { unchanged: boolean; reason?: string; tasks?: RefineChildView[] };
  // the server's deterministic acceptance on that proposal (server.ts refineValidationFor,
  // refine-validate.ts): tracked-path and verify-contract findings, three-valued, per child. It
  // gates nothing here either — it is shown next to the apply button so the owner promotes a bad
  // proposal knowingly or not at all. ABSENT on an `unchanged` proposal, which has no children.
  validation?: { verdict: "pass" | "fail" | "unknown";
    findings: { code: string; severity: "error" | "unknown"; child: number; detail: string }[] } }
// `waveBudget` is the server's live FLEET_LAND_WAVE_BUDGET: the board's land fold must cut with the
// number the wave door checks, or it offers waves the door refuses. Absent on an older server.
// `lanes` (busy lanes in the dispatch repo) and `quiet` (the machine's quiet window is open NOW, by
// the server's clock) let the queue foot name the gate that holds; absent on an older server.
interface DispatchInfo { available: boolean; on: boolean; maxLanes: number; repo: string; waveBudget?: number;
  lanes?: number; quiet?: boolean }
export let fleet: SlotInfo[] = [];
// the harness catalogue, fetched ONCE (it is a server constant) the first time the founding window opens.
// Empty until then, and every reader treats empty as "only the default exists" — so a failed or
// pending fetch degrades to exactly the pre-harness UI rather than to a broken one.
export let harnesses: HarnessInfo[] = [];
let harnessesLoaded = false;
// this fleet's box defaults, from the same fetch — shown as the container fields' placeholders so
// the owner sees what leaving them empty gets. Never hardcoded here: they are server constants
// (FLEET_CONTAINER / FLEET_CONTAINER_CONTEXT), and a second copy would drift silently.
export let containerDefaults: { container: string; containerContext: string } | null = null;
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
      modelRegistry?: (ModelEntry & { availability: ModelAvailability })[];
      containerDefaults?: { container: string; containerContext: string } };
    defaultModel = typeof cat.defaultModel === "string" ? cat.defaultModel : null;
    modelRegistry = cat.modelRegistry ?? [];
    harnesses = cat.harnesses;
    containerDefaults = cat.containerDefaults ?? null; // absent against an older server: the fields
    // then carry no placeholder, which is a missing hint and not a broken control
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
export async function setSlotSetting(slot: number, field: "model" | "effort", value: string): Promise<string> {
  const rec = await post(`/api/slots/${slot}/model`, { [field]: value });
  if (!rec.ok) {
    const why = ((await rec.json().catch(() => null)) as { error?: string } | null)?.error ?? `HTTP ${rec.status}`;
    return `record ✗ ${why} — pane not touched`;
  }
  if (!switchesInPane(harnessEntry(slot))) {
    const r = await post(`/api/slots/${slot}/restart`, {});
    const j = (await r.json().catch(() => null)) as { resumed?: boolean; error?: string } | null;
    if (!r.ok) return `record ✓ · restart ✗ ${j?.error ?? `HTTP ${r.status}`} — the pane still runs the old ${field}`;
    return `${field} ${value} — record ✓ · pane restarted${j?.resumed ? ", conversation resumed" : " FRESH (the conversation could not be resumed)"}`;
  }
  const cmd = paneCommand(harnessEntry(slot), field, value)!;
  const paneOk = await deliver(slot, cmd);
  return paneOk ? `${field} ${value} — record ✓ · pane ✓` : `record ✓ · pane ✗ — type ${cmd} yourself`;
}

export let autosList: AutoInfo[] = [];
export let tasksList: TaskInfo[] = [];
export let dispatch: DispatchInfo = { available: false, on: false, maxLanes: 0, repo: "" };
// The brief compiler's runtime mode. Omitted at zero on the wire, so `undefined` and `false` mean
// the same thing here — off. A sibling `analysisOn` stood beside it until 2026-09-10 and retired
// with the queue analyst.
export let briefCompilerOn: boolean | undefined;
export let intakeOn = false;
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

// Claude Code (2.1.278) stores a pasted prompt — every composer send is one — wrapped as
// <pasted_content id="x">…</pasted_content id="x">. The bubble shows what you wrote, so only a
// wrapper whose closing id matches its opening one is taken off; the text inside stays verbatim.
const PASTED_RE = /<pasted_content id="([^"]+)">\n?([\s\S]*?)\n?<\/pasted_content id="\1">/g;
const unwrapPasted = (text: string): string => text.replace(PASTED_RE, "$2");

const fmtClock = (ts: string | null) =>
  ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

// --- conversation view chrome: copy buttons, code-block heads, hoverable ids, text size ---
loadChatSizes();
// a column-width change pulls a LIMITED terminal along: the CSS width follows the var, the pane's
// own fit path picks the new box up and tmux gets the new column count (no second resize way)
onChatSize(() => { for (const p of panes) if (p.termIsLimited()) p.refit(); });

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
    return s ? { meta: `lane ${id} · slot ${s.id}`, title: s.worktree?.branch ?? "lane",
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
  return {
    meta: [`slot ${sl.id}`, sl.worktree ? "lane" : "session", sl.ctx ? `ctx ${Math.round(sl.ctx.pct)}%` : ""].filter(Boolean).join(" · "),
    title: sl.label || sl.cwd.split("/").filter(Boolean).pop() || sl.cwd,
    lines: [
      [sl.harness ?? "claude", sl.model, sl.effort].filter(Boolean).join(" · "),
      sl.worktree ? `branch ${sl.worktree.branch}` : sl.cwd,
      ...(sl.worktree?.letter ? [`lane ${sl.id}${sl.worktree.letter}`] : []),
      ...(sl.programId ? [`program ${sl.programId}`] : []),
      ...(sl.awaiting ? [`awaiting ${sl.awaiting}`] : []),
      ...(taskLine ? [taskLine] : []),
      ...(sl.lastOutput ? [`last output ${fmtDur(Math.max(0, now - sl.lastOutput))} ago`] : []),
      "Slot-Belegung kann sich seit dieser Nachricht geändert haben.",
    ],
  };
}

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
// "wartet" = this board sent it and the transcript has not brought it back — Claude Code queues a
// prompt sent mid-turn and writes it after the turn; "durch" = the transcript has it (the entry that
// retired the bubble). Nothing more is claimed: not read, not answered.
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
  pending: { text: string; el: HTMLElement }[]; openAgents: Map<string, { step: HTMLElement; run: HTMLElement }>;
  hover: boolean; anchor: ChatAnchor | null };
const chatShelf = new Map<number, ChatShelfRow>();
// the Markdown each rendered message body came from — what relinkChat re-renders in place
const bodySource = new WeakMap<HTMLElement, string>();

class Pane {
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
  private pressTimer: ReturnType<typeof setTimeout> | undefined;
  private pressAt: { x: number; y: number } | null = null;
  private pressFired = false;
  private pressText = "";

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
    this.boardBtn.onclick = (e) => { e.stopPropagation(); focusPane(this.index); setBoard(!boardOpen); };
    this.viewBtn = el("button", "viewtoggle") as HTMLButtonElement;
    this.viewBtn.appendChild(icon("chat"));
    this.viewBtn.title = "Konversation anzeigen";
    this.viewBtn.style.display = "none";
    this.viewBtn.setAttribute("aria-pressed", "false");
    this.viewBtn.onclick = (e) => {
      e.stopPropagation();
      this.setView(this.view === "term" ? "chat" : "term");
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
    // hides this one and keeps its gear in #mhead instead (G5), so exactly one gear is ever visible
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
    this.root.append(termEl, this.flakes.canvas, this.chatEl, this.pastBar, this.hint, this.jump, this.downBar, this.copyPop, this.toolsBox);
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
      fontSize: isMobile() ? 11 : 12,
      fontFamily: "ui-monospace, Menlo, Consolas, monospace",
      theme: { background: "#000000", foreground: "#d8d8d8" }, // the chat view's black (index.html #main)
      linkHandler: { activate: openTermLink },
    });
    this.fit = new FitAddon();
    this.term.loadAddon(this.fit);
    this.term.loadAddon(new WebLinksAddon(openTermLink));
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

  setView(v: "term" | "chat") {
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
    clearTimeout(this.chatTimer);
    if (v === "chat") { this.applyChatMemo(); void this.pollChat(); }
    else { this.refit(); this.term.focus(); }
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
  private pending: { text: string; el: HTMLElement }[] = [];
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
    else if (this.view === "chat") void this.pollChat();
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
    if (e.meta) { this.addNotif(e); return; }
    this.notifGroup = null; // a real entry ends the notification run
    for (const b of e.blocks) {
      if (b.t === "text") {
        this.toolGroup = null; // a message ends the current work block
        const raw = e.role === "user" ? unwrapPasted(b.text) : b.text;
        const arrived = e.role === "user" && this.settlePending(raw);
        // Fleet's typed delivery head is transport provenance, not something the owner wrote: it rides
        // in the meta row beside the bubble, and the bubble and its copy carry only the body.
        const { header, body: text } = e.role === "user" ? splitDeliveryHeader(raw) : { header: null, body: raw };
        const msg = el("div", `msg ${e.role}`);
        const body = el("div", "mbody");
        mdInto(body, text, { entity: this.hoverOn ? (kind, id) => entityKnown(kind, id, this.slot) : undefined });
        bodySource.set(body, text);
        for (const code of body.querySelectorAll<HTMLElement>(".code")) decorateCode(code);
        const meta = el("div", "mmeta");
        const who = e.role === "user" ? "you" : "claude";
        meta.appendChild(el("span", "mwho", e.ts ? `${who} · ${fmtClock(e.ts)}` : who));
        if (header) {
          const head = el("span", "mhead", header);
          head.title = `fleet-zustellung · ${header}`;
          head.style.cssText = "min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
          meta.appendChild(head);
        }
        meta.appendChild(copyButton("copy", "copy this message as Markdown", () => text));
        msg.append(body, ...(arrived ? [sendState("done")] : []), meta);
        this.chatAdd(msg);
      } else {
        this.addStep(b);
      }
    }
  }

  // THE SENT PROMPT, BEFORE THE TRANSCRIPT HAS IT. Measured 2026-09-22
  // (docs/messungen/2026-09-22-chat-absenden-zeitleiste.md): the bubble waited for POST /send (~350–500 ms) AND the next chat
  // poll (up to chatMs, 1 s / 3 s with the data saver) — mid-turn until the agent wrote the queued
  // prompt, 6.4 s. The local bubble shows at Enter; the transcript entry replaces it.
  addPending(text: string): HTMLElement | null {
    if (this.view !== "chat" || this.pastN !== null) return null;
    const msg = el("div", "msg user pending fresh");
    const body = el("div", "mbody");
    mdInto(body, text, { entity: this.hoverOn ? (kind, id) => entityKnown(kind, id, this.slot) : undefined });
    bodySource.set(body, text);
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
  // true = the entry retired a bubble this board put up: it is the same send, now DURCH
  private settlePending(text: string): boolean {
    const hit = this.pending.find((p) => pendingSettledBy(p.text, text));
    if (hit) this.dropPending(hit.el);
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
    const slot = this.slot, past = this.pastN, gen = this.chatGen;
    this.chatBusy = true;
    let grew = false;
    try {
      const res = await api(past === null ? `/api/slots/${slot}/transcript?after=${this.chatTotal}`
        : `/api/slots/${slot}/succession/${past}/transcript?after=${this.chatTotal}`);
      if (this.slot !== slot || this.pastN !== past || this.chatGen !== gen) return; // reassigned during the fetch — stale
      if (!res.ok) return;
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
        return; // next tick refills from 0
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
          const startsRequest = e.role === "user" || e.blocks.some((b) => b.t === "tool_result");
          const at = startsRequest && e.ts ? Date.parse(e.ts) : NaN;
          if (at > this.lastTurnAt) this.lastTurnAt = at;
        }
        // what has not arrived yet stays below what has
        // (a pending bubble already at the end stays put — no remove + re-add)
        this.chatFresh = false;
        for (const p of this.pending) if (p.el.nextSibling !== null) this.chatAdd(p.el);
        tickCacheAge();
        this.chatGrew(this.chatEl.childElementCount - before, first);
      }
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
      // every poll re-reads the working fact and re-arms the RECENT_MS hide timer (the timer
      // alone makes the bound, the poll only refreshes the fact when new output moved it)
      if (past === null) this.updateWork();
    } catch {
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
        // a past session's file is finished: once a read brings nothing new there is nothing to poll
        if (this.view === "chat" && ms && (past === null || grew)) {
          clearTimeout(this.chatTimer);
          this.chatTimer = setTimeout(() => void this.pollChat(), ms);
        }
      }
    }
  }

  // the poll pump drives this on every visibility flip and every flip of the switch: drop
  // the pending tick first (pollChat() only declines to RE-arm, so one already-scheduled
  // poll would still fire into a hidden tab), then restart the chain if the plan still
  // wants one. Restarting costs a single request, not a backlog — the fetch is a delta
  // (after=chatTotal), so an hour spent hidden is still one catch-up.
  chatPump() {
    clearTimeout(this.chatTimer);
    if (this.view === "chat" && plan().chatMs) void this.pollChat();
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
    const ws = new WebSocket(
      `${proto}://${location.host}/ws/${this.slot}?cols=${this.term.cols}&rows=${this.term.rows}${force ? "&force=1" : ""}${seed ? `&seed=${seed}` : ""}`,
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
      this.term.write(new Uint8Array(e.data as ArrayBuffer), pin ? () => this.pinToBottom() : undefined);
      if (action.reset) this.flushHeld();
    };
    ws.onclose = () => {
      if (g !== this.gen) return; // superseded by a reassign or dispose
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
    if (slot === this.slot) { this.focus(); this.scrollToEnd(); return; }
    this.leavePast();
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
    if (!restored) this.resetChat();
    this.boardBtn.style.display = slot ? "flex" : "none";
    this.reloadBtn.style.display = slot ? "flex" : "none";
    this.syncHarnessAffordances();
    if (slot && this.view === "chat") void this.pollChat();
    this.hint.style.display = slot ? "none" : "flex";
    // size the terminal to its container before connecting — the WS URL carries
    // this size, and connecting at a stale default (e.g. 80x24) would seed scrollback
    // at the wrong width and force an immediate second reseed once refit() catches up
    if (slot) { this.fit.fit(); this.pinPending = true; this.connect(); }
    this.focus();
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
    this.pressTimer = setTimeout(() => this.selectLineAt(at.x, at.y), PRESS_MS);
  }

  private selectLineAt(x: number, y: number) {
    const screen = this.term.element?.querySelector(".xterm-screen");
    if (!screen) return;
    const r = screen.getBoundingClientRect();
    const row = Math.floor((y - r.top) / (r.height / this.term.rows));
    if (row < 0 || row >= this.term.rows) return;
    const b = this.term.buffer.active;
    let start = b.viewportY + row, end = start;
    while (start > 0 && b.getLine(start)?.isWrapped) start--;
    while (b.getLine(end + 1)?.isWrapped) end++;
    this.term.selectLines(start, end);
    const text = this.term.getSelection().trimEnd();
    if (!text) { this.term.clearSelection(); return; }
    this.pressText = text;
    this.pressFired = true;
    const box = this.root.getBoundingClientRect();
    const w = 96;
    this.copyPop.textContent = "Kopieren";
    this.copyPop.style.left = `${Math.max(4, Math.min(box.width - w - 4, x - box.left - w / 2))}px`;
    this.copyPop.style.top = `${Math.max(4, y - box.top - 56)}px`;
    this.copyPop.style.display = "block";
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

// THE SETTINGS WINDOW (Grammatik G5, cards K2+K8+D-5): one gear top right, one window, four
// sections. "Dieses Gerät" renders the registry (src/prefs.ts): every key with a row shows its
// label, its control, its default and a way back (G5.1). "Schrift" is the size panel's ONE home
// (G5.3) — the Aa corner button opens the window right there. "Fleet" holds the five server
// switches whose routes already exist (G5.2, card D-3, fleetSection). "This machine" reads the fixed
// class-2 allowlist and renders no control (card D-5). On the phone the sections become tabs (G3.1);
// on the desktop all four stack. Esc, backdrop and ✕ come from openShell (G6.3); the focus returns to
// the button that opened the window (G4).
let settingsShell: Shell | null = null;
let settingsTab = "device";
const SET_TABS: [string, string][] = [["device", "Dieses Gerät"], ["schrift", "Schrift"], ["fleet", "Fleet"], ["machine", "This machine"]];
const SET_CHOICE_WORDS: Record<string, string> = { tree: "Baum", line: "Zeile", all: "alle" };

// The live effect of a row beyond the write itself — the SAME setters the original surfaces
// call, so a settings toggle can never mean something else than its own button (K2: Bedeutung
// unverändert). Absent = the write IS the whole effect, the value is read at use.
const PREF_APPLY: Record<string, () => void> = {
  "fleet.datasaver": () => setSaver(prefBool("fleet.datasaver")),
  "fleet.board": () => setBoard(prefBool("fleet.board")),
  "fleet.sidecollapsed": () => setCollapsed(prefBool("fleet.sidecollapsed")),
  "fleet.termlimit": () => setTermLimit(prefBool("fleet.termlimit")),
  "fleet.meter.open": () => { setMeterOpen(prefBool("fleet.meter.open")); renderSuiteMeter(); },
  "fleet.more": () => { moreOpen = prefBool("fleet.more"); applyMore(); },
  "fleet.histall": () => { histAll = prefBool("fleet.histall"); if (hist.style.display === "flex") void renderHist(); },
  "fleet.bandDepth": () => renderSlots(),
  "fleet.queue.scope": () => { setQueueTreeOn(prefText("fleet.queue.scope") !== "line"); if (qShell?.isOpen()) { invalidateQueueList(); renderQueue(); } },
  "fleet.board.folds": () => { boardFolds.clear(); void renderBoard(); },
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

  const tabs = el("div", "settabs");
  const tabBtns = SET_TABS.map(([id, word]) => {
    const b = el("button", "settab", word) as HTMLButtonElement;
    b.dataset.settingsTab = id;
    b.onclick = () => { settingsTab = id; syncTabs(); };
    tabs.appendChild(b);
    return b;
  });

  const device = el("section", "setsec");
  device.appendChild(el("h3", "", "Dieses Gerät"));
  for (const d of PREFS) {
    if (!d.row || (d.desktopOnly && MOBILE_MQ.matches)) continue;
    device.appendChild(settingsRow(d));
  }
  const schrift = el("section", "setsec");
  schrift.appendChild(el("h3", "", "Schrift"));
  schrift.appendChild(sizePanel()); // the ONE panel moves in here (G5.3, kein zweites Zuhause)
  const fleetsec = el("section", "setsec");
  fleetsec.appendChild(el("h3", "", "Fleet"));
  const stagedCount = fleetSection(fleetsec);
  const machine = el("section", "setsec");
  machine.appendChild(el("h3", "", "This machine"));
  machineSection(machine);

  shell.detail.append(tabs, device, schrift, fleetsec, machine);
  let discard: HTMLElement | null = null;
  let discardFocus: HTMLElement | null = null;
  shell.setCloseGuard(() => {
    const n = stagedCount();
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
      keep.onclick = () => { discard?.remove(); discard = null; discardFocus?.focus(); };
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
  syncTabs();

  function syncTabs() {
    SET_TABS.forEach(([id], i) => {
      tabBtns[i].classList.toggle("on", settingsTab === id);
      tabBtns[i].setAttribute("aria-pressed", settingsTab === id ? "true" : "false");
    });
    device.classList.toggle("on", settingsTab === "device");
    schrift.classList.toggle("on", settingsTab === "schrift");
    fleetsec.classList.toggle("on", settingsTab === "fleet");
    machine.classList.toggle("on", settingsTab === "machine");
    const section = settingsTab === "schrift" ? schrift : settingsTab === "fleet" ? fleetsec
      : settingsTab === "machine" ? machine : device;
    shell.detail.scrollTop = MOBILE_MQ.matches ? 0
      : shell.detail.scrollTop + section.getBoundingClientRect().top - shell.detail.getBoundingClientRect().top - 2;
  }
}

// one registry row (G5.3): label left, control right, the value in mono, a hint under the row —
// and the way back: "Standard" forgets the key, so the next read falls back to the default.
function settingsRow(d: PrefDef): HTMLElement {
  const row = el("div", "setrow");
  const main = el("div", "setmain");
  main.appendChild(el("div", "setlabel", d.label));
  const std = d.kind === "bool" ? (d.def === "1" ? "on" : "off")
    : d.kind === "choice" ? SET_CHOICE_WORDS[d.def] ?? d.def : null;
  main.appendChild(el("div", "hint setnote", [d.hint, std !== null ? `Standard: ${std}` : ""].filter(Boolean).join(" ")));
  row.appendChild(main);

  const sync: (() => void)[] = [];
  let control: HTMLElement;
  if (d.row === "toggle") {
    const b = el("button", "settoggle") as HTMLButtonElement;
    b.onclick = () => { prefSetBool(d.key, !prefBool(d.key)); PREF_APPLY[d.key]?.(); syncAll(); };
    sync.push(() => {
      const on = prefBool(d.key);
      b.textContent = on ? "on" : "off";
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    control = b;
  } else if (d.row === "choice") {
    const wrap = el("div", "setchoice");
    for (const v of d.values ?? []) {
      const b = el("button", "settab", SET_CHOICE_WORDS[v] ?? v) as HTMLButtonElement;
      b.onclick = () => { prefSet(d.key, v); PREF_APPLY[d.key]?.(); syncAll(); };
      sync.push(() => b.classList.toggle("on", prefText(d.key) === v));
      wrap.appendChild(b);
    }
    control = wrap;
  } else {
    const val = el("span", "setval");
    sync.push(() => { val.textContent = SET_VALUE[d.key]?.() ?? prefText(d.key); });
    control = val;
  }
  const reset = el("button", "setreset", "Reset") as HTMLButtonElement;
  reset.title = `${d.label} auf den Standard zurücksetzen`;
  reset.onclick = () => { prefSet(d.key, null); PREF_APPLY[d.key]?.(); syncAll(); };
  row.append(control, reset);
  function syncAll() {
    for (const f of sync) f();
    const raw = prefRaw(d.key);
    reset.hidden = raw === null || raw === d.def;
  }
  syncAll();
  return row;
}

interface MachineSetting {
  name: string;
  value: string | number;
  default: string | number;
  how: ".env + Neustart" | "watchdog.sh + kickstart";
}

// THE "THIS MACHINE" SECTION (G5.3, card D-5): server-start values are observations, not form
// state. Each row therefore has only the label, effective mono value and explanatory hint — no
// input, toggle, Reset or Apply path. The route itself owns the security allowlist.
function machineSection(sec: HTMLElement): void {
  const status = el("div", "hint setnote", "Loading machine settings…");
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
      status.textContent = "Machine settings unavailable.";
      status.title = "Die Startwerte konnten nicht vom Server gelesen werden.";
      return;
    }
    status.remove();
    for (const setting of settings) {
      const row = el("div", "setrow fleetrow");
      row.title = "Zeigt den wirksamen Startwert dieses Servers und den Weg zu seiner Änderung.";
      const main = el("div", "setmain");
      main.append(el("div", "setlabel", setting.name),
        el("div", "hint setnote", `ändern: ${setting.how}; Standard: ${setting.default}`));
      row.append(main, el("span", "setval", String(setting.value)));
      sec.appendChild(row);
    }
  })();
}

// THE "FLEET" SECTION (G5.2 + G4.4, card D-3): five server switches over routes that already
// exist — nothing here is a value of this browser, every row changes the fleet for all devices
// and sessions. A changed control is only STAGED (ink edge on the row); the one primary "Apply"
// writes each staged row through its route, and the row then shows the value the SERVER answers
// with — the poll for dispatcher/autos/quiet, GET /api/repo-lane-caps for the cap and the stored
// bases, the route's own answer for the branch — never the typed one. A refusal (4xx) stays at its row as a hint and the
// staged value stays. The dispatcher row reads the same `dispatch` the queue foot reads: no
// second state lives in this window. Not here, on purpose: repoWorkers (a stored command),
// .env/watchdog.sh values, and slot/program switches (they live at their thing).
// e2e/tasks.ts pins the route set of this block — a sixth route is a new card, not a new row.
interface FleetSetRow {
  row: HTMLElement; val: HTMLElement; err: HTMLElement;
  staged(): boolean; write(): Promise<Response>; paint(): void; done(answer: unknown): void;
}
function fleetSection(sec: HTMLElement): () => number {
  let caps: Record<string, number> = {};
  let capDefault: number | null = null;
  let capMax = 99;
  // a repo's stored branch: filled from GET /api/repo-lane-caps (`bases`) and from each write's answer
  const bases = new Map<string, string | null>();
  const repos = [...new Set([dispatch.repo, ...fleet.map((s) => s.cwd ? s.repo ?? s.worktree?.repo ?? "" : "")]
    .filter((r): r is string => !!r))].sort();
  const onOff = (v: boolean | null) => v === null ? "?" : v ? "on" : "off";
  const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
  const rows: FleetSetRow[] = [];

  function shell(label: string, hint: string, tip: string): { row: HTMLElement; val: HTMLElement; err: HTMLElement; ctl: HTMLElement } {
    const row = el("div", "setrow fleetrow");
    row.title = tip;
    const main = el("div", "setmain");
    const err = el("div", "hint setnote seterr");
    err.hidden = true;
    main.append(el("div", "setlabel", label), el("div", "hint setnote", hint), err);
    const val = el("span", "setval");
    val.title = "Wert, wie ihn der Server zuletzt gemeldet hat";
    const ctl = el("div", "setctl");
    row.append(main, val, ctl);
    sec.appendChild(row);
    return { row, val, err, ctl };
  }
  function toggle(): HTMLButtonElement {
    return el("button", "settoggle") as HTMLButtonElement;
  }
  function repoPick(onPick: () => void): HTMLSelectElement {
    const pick = el("select", "setin") as HTMLSelectElement;
    for (const r of repos) {
      const o = el("option", "", baseName(r)) as HTMLOptionElement;
      o.value = r; o.title = r;
      pick.appendChild(o);
    }
    pick.value = dispatch.repo && repos.includes(dispatch.repo) ? dispatch.repo : repos[0] ?? "";
    pick.onchange = onPick;
    return pick;
  }

  // 1 · dispatcher
  {
    const s = shell("Dispatcher",
      "An: freigegebene Aufgaben starten ohne dich als Lanes, für alle Sessions dieser Fleet; aus: sie warten, bis du sie startest.",
      "Schaltet den Dispatcher der ganzen Fleet — derselbe Schalter wie am Fuß der Queue.");
    let want: boolean | null = null;
    const b = toggle();
    b.disabled = !dispatch.available;
    b.onclick = () => { const cur = want ?? dispatch.on; want = !cur === dispatch.on ? null : !cur; sync(); };
    s.ctl.appendChild(b);
    const r: FleetSetRow = { ...s,
      staged: () => want !== null,
      write: () => post("/api/dispatch", { on: want }),
      paint: () => { s.val.textContent = dispatch.available ? onOff(dispatch.on) : "unavailable"; },
      done: () => { want = null; },
    };
    function sync() {
      const on = want ?? dispatch.on;
      b.textContent = onOff(on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.classList.toggle("staged", want !== null);
      syncStaged();
    }
    rows.push({ ...r, paint: () => { r.paint(); sync(); } });
  }
  // 2 · automatic prompts (the kill-switch)
  {
    const s = shell("Automatic prompts",
      "Aus hält jeden geplanten Prompt in jeder Session an und startet auch keine Lane mehr, bis du sie wieder einschaltest; einmalige Handlungen von dir bleiben möglich.",
      "Not-Aus für alle geplanten Prompts und Lane-Starts der Fleet — auch Programs mit „darf starten: an“ halten.");
    let want: boolean | null = null;
    const b = toggle();
    b.onclick = () => { const cur = want ?? autosOnSrv ?? true; want = !cur === autosOnSrv ? null : !cur; sync(); };
    s.ctl.appendChild(b);
    const r: FleetSetRow = { ...s,
      staged: () => want !== null,
      write: () => post("/api/autos/switch", { on: want }),
      paint: () => { s.val.textContent = onOff(autosOnSrv); },
      done: () => { want = null; },
    };
    function sync() {
      const on = want ?? autosOnSrv ?? true;
      b.textContent = onOff(on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.classList.toggle("staged", want !== null);
      syncStaged();
    }
    rows.push({ ...r, paint: () => { r.paint(); sync(); } });
  }
  // 3 · quiet hours
  {
    const s = shell("Quiet hours",
      "In diesem Fenster (Uhrzeit dieses Rechners) schickt die Fleet keiner Session wiederkehrende Prompts und startet keine Lane; einmalige Prompts bleiben.",
      "Setzt das Ruhefenster für wiederkehrende Prompts und Lane-Starts aller Sessions; ein Program mit „darf starten: an“ startet darin nur, was die Fleet selbst freigegeben hat.");
    const from = el("select", "setin") as HTMLSelectElement;
    const to = el("select", "setin") as HTMLSelectElement;
    const off = el("option", "", "off") as HTMLOptionElement;
    off.value = "";
    from.appendChild(off);
    for (let h = 0; h < 24; h++) {
      const a = el("option", "", hh(h)) as HTMLOptionElement; a.value = String(h); from.appendChild(a);
      const z = el("option", "", hh(h)) as HTMLOptionElement; z.value = String(h); to.appendChild(z);
    }
    const dash = el("span", "setdash", "–");
    s.ctl.append(from, dash, to);
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
      syncStaged();
    }
    rows.push({ ...s, staged,
      write: () => post("/api/autos/quiet", cur() ?? { start: null }),
      paint: () => {
        s.val.textContent = quietHoursSrv ? `${hh(quietHoursSrv.start)}–${hh(quietHoursSrv.end)}` : "off";
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
  // 4 · lane cap per repo
  {
    const s = shell("Lane cap per repo",
      "So viele Lanes startet die Fleet in diesem Repo höchstens ohne dich; leer heißt Standard der Maschine.",
      "Setzt den Deckel für unbeaufsichtigte Lanes in einem Repo, für alle Sessions.");
    const pick = repoPick(() => { typed = null; paintRow(); });
    const n = el("input", "setin setnum") as HTMLInputElement;
    n.type = "number"; n.min = "0"; n.step = "1"; n.inputMode = "numeric";
    let typed: string | null = null;
    n.oninput = () => { typed = n.value.trim(); sync(); };
    s.ctl.append(pick, n);
    const stored = () => caps[pick.value] ?? null;
    const staged = () => typed !== null && typed !== String(stored() ?? "");
    function sync() { n.classList.toggle("staged", staged()); syncStaged(); }
    function paintRow() {
      const v = stored();
      s.val.textContent = !pick.value ? "no repo" : v !== null ? String(v) : `default ${capDefault ?? "?"}`;
      n.max = String(capMax);
      n.placeholder = capDefault !== null ? String(capDefault) : "";
      if (!staged()) { typed = null; n.value = v !== null ? String(v) : ""; }
      n.disabled = pick.disabled = !pick.value;
      sync();
    }
    rows.push({ ...s, staged,
      // empty → null (clear to the machine default); anything else goes as typed and the server judges it
      write: () => post("/api/repo-lane-cap", { repo: pick.value, maxLanes: typed === "" ? null : Number(typed) }),
      paint: paintRow,
      done: () => { typed = null; },
    });
  }
  // 5 · integration branch per repo
  {
    const s = shell("Integration branch per repo",
      "In diesen Branch landen alle Lanes dieses Repos; leer heißt: der Branch, auf dem der Haupt-Checkout steht.",
      "Setzt den Integrations-Branch eines Repos, für alle Sessions.");
    const pick = repoPick(() => { typed = null; paintRow(); });
    const t = el("input", "setin setbranch") as HTMLInputElement;
    t.type = "text"; t.spellcheck = false; t.autocapitalize = "off"; t.placeholder = "branch";
    let typed: string | null = null;
    t.oninput = () => { typed = t.value.trim(); sync(); };
    s.ctl.append(pick, t);
    const staged = () => typed !== null && (!bases.has(pick.value) || typed !== (bases.get(pick.value) ?? ""));
    function sync() { t.classList.toggle("staged", staged()); syncStaged(); }
    function paintRow() {
      const known = bases.has(pick.value);
      const v = bases.get(pick.value) ?? null;
      s.val.textContent = !pick.value ? "no repo" : !known ? "?" : v ?? "not set";
      if (!staged()) { typed = null; t.value = v ?? ""; }
      t.disabled = pick.disabled = !pick.value;
      sync();
    }
    rows.push({ ...s, staged,
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
  const apply = el("button", "cmdapply", "Apply") as HTMLButtonElement;
  apply.title = "Schreibt alle vorgemerkten Werte an den Server und zeigt danach, was er gespeichert hat.";
  foot.append(note, apply);
  sec.appendChild(foot);
  function syncStaged() {
    const n = rows.filter((r) => r.staged()).length;
    for (const r of rows) r.row.classList.toggle("staged", r.staged());
    apply.disabled = n === 0;
    note.textContent = n ? `${n} vorgemerkt — gilt erst nach Apply` : "";
  }
  async function readCaps() {
    const r = await api("/api/repo-lane-caps").catch(() => null);
    const j = r?.ok ? (await r.json().catch(() => null)) as { default?: number; max?: number; caps?: Record<string, number>; bases?: Record<string, string> } | null : null;
    if (!j) return;
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
  apply.onclick = async () => {
    apply.disabled = true;
    for (const r of rows.filter((x) => x.staged())) {
      const res = await r.write().catch(() => null);
      const j = res ? await res.json().catch(() => null) as { error?: string } | null : null;
      if (res?.ok) {
        r.err.hidden = true;
        r.done(j);
      } else {
        r.err.hidden = false;
        r.err.textContent = `Server lehnt ab: ${j?.error ?? (res ? `HTTP ${res.status}` : "keine Verbindung")}`;
      }
    }
    await refresh();
    await readCaps();
    for (const r of rows) r.paint();
  };
  for (const r of rows) r.paint();
  void readCaps().then(() => { for (const r of rows) r.paint(); });
  return () => rows.filter((r) => r.staged()).length;
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
    "this session is working right now — " + (create
      ? "it may create this same path; an existing file will not be overwritten"
      : remove ? "it may still read or write this file; deleting it does not stop the session"
      : "it may still read or write the old path; imports and references will not follow this move")));
  let input: HTMLInputElement | null = null;
  if (!remove) {
    const label = el("label", "fxwritelabel", rename ? "New name" : "Path");
    input = el("input", "fxwriteinput") as HTMLInputElement;
    input.type = "text"; input.spellcheck = false; input.autocomplete = "off";
    input.dataset.ownEnter = "1";
    input.value = create ? to : rename ? path.slice(parent.length) : to || path;
    input.title = rename ? "Neuer Dateiname im selben Ordner" : "Relativer Dateipfad in dieser Session";
    label.appendChild(input); body.appendChild(label);
  }
  const row = (label: string) => {
    const r = el("div", "fxwriterow");
    const value = el("span", "fxwritevalue");
    r.append(el("span", "fxwritekey", label), value); body.appendChild(r);
    return value;
  };
  const runs = row("Runs");
  row("Where").textContent = `${root} · Slot ${slot}`;
  const afterwards = row("Afterwards");
  row("Not moved").textContent = create ? "Bestehende Dateien bleiben unverändert; kein git add und kein Commit."
    : remove ? "Verweise bleiben unverändert; die Session läuft weiter; kein Commit."
    : "Importe und Verweise bleiben am alten Pfad; die Session läuft weiter; kein Commit.";
  row("Recovery").textContent = create ? "Die neue Datei löschen; ungetrackte Dateien blockieren das Land."
    : remove ? "git restore --staged --worktree — eine gestagte Löschung braucht einen Commit."
    : "git mv zurück — eine gestagte Umbenennung braucht einen Commit.";
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
    afterwards.textContent = create ? `empty file at ${target || "…"}; not added to git`
      : remove ? `${path} removed from the worktree; deletion staged in git`
      : `${path} moved to ${target}; rename staged in git`;
    input?.setAttribute("aria-invalid", String(!valid));
    const button = body.closest(".panel")?.querySelector<HTMLButtonElement>(".riskbtn.primary, .riskbtn.danger");
    if (button) button.disabled = !valid;
  };
  update();
  if (input) input.oninput = update;
  const answer = askRisk({ title: `${kind}${create ? "" : ` — ${path}`}`, body: [body],
    panelClass: "riskpanel fxwritepanel",
    buttons: [{ label: "Cancel", value: false },
      { label: kind, value: true, primary: !remove, danger: remove, disabled: !valid }] });
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
      : { error: reply?.error ?? `the server refused this change (${res.status})` };
  } catch { return { error: "the change could not be confirmed — re-read the tree before retrying" }; }
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
  fxGit.set(cwd, b ? { lines: b.uncommittedFiles, total: b.uncommitted, branch: b.branch }
    : { error: "git status could not be read" });
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
  inp.placeholder = "search paths — e.g. e2e/pins";
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
    search.placeholder = contents ? "search contents" : "search paths — e.g. e2e/pins";
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
  search.placeholder = fxContents.get(cwd) ? "search contents" : "search paths — e.g. e2e/pins";
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

function focusPane(index: number) {
  const changed = focused !== index;
  focused = index;
  for (const p of panes) p.root.classList.toggle("focused", p.index === focused);
  const slot = panes[focused]?.slot;
  switchDraft(slot ?? 0);
  const hint = isMobile() ? "" : " (Enter sends)";
  ta.placeholder = slot ? `Prompt for slot ${slot}…${hint}` : "Prompt… (no session in focused pane)";
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
export function showSlot(id: number): boolean {
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
  if (existing) { existing.focus(); existing.scrollToEnd(); existing.flash(); void renderMobileAlarmHint(); return true; }
  const target = panes[focused];
  target.assign(id);
  target.flash();
  void renderMobileAlarmHint();
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
  }
});
window.addEventListener("resize", () => { for (const p of panes) p.refit(); });

// crossing the mobile breakpoint (rotation, window resize) rebuilds the panes so
// per-pane mobile settings (font size, inputMode, forced single layout) re-apply
MOBILE_MQ.addEventListener("change", () => {
  setDrawer(false);
  setLive(false); // the live bar is a mobile-only surface
  if (!isMobile() && boardShell?.isOpen()) setBoard(false); // the info WINDOW is the phone's surface
  applyCollapsed(); // strip the rail on mobile, restore it on desktop
  applyBoard(); // same for the right sideboard — a desktop-only surface
  renderPostLandAudit(); // the alarm swaps surfaces: board section on desktop, #mhead bar on a phone
  setLayout(isMobile() ? 1 : layout, panes.map((p) => p.slot));
});

// iOS Safari: the on-screen keyboard shrinks the visual viewport but not the layout
// viewport — track it so the compose bar stays visible above the keyboard
const vv = window.visualViewport;
let keyboardPlaceholder: string | null = null;
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
if (vv) {
  let vvRefitTimer: ReturnType<typeof setTimeout> | undefined;
  const sync = () => {
    if (isMobile()) document.documentElement.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
    else document.documentElement.style.removeProperty("--vvh");
    const focusedInput = document.activeElement === ta || document.activeElement === $("livein");
    const keyboardOpen = isMobile() && focusedInput && window.innerHeight - vv.height > 120;
    if (!focusedInput) document.body.classList.remove("landwrite");
    document.body.classList.toggle("keyboard-open", keyboardOpen);
    if (keyboardOpen && keyboardPlaceholder === null) {
      keyboardPlaceholder = ta.placeholder;
      ta.placeholder = "Prompt…";
      fitTextarea();
    } else if (!keyboardOpen && keyboardPlaceholder !== null) {
      ta.placeholder = keyboardPlaceholder;
      keyboardPlaceholder = null;
      fitTextarea();
    }
    if (!keyboardOpen) {
      document.body.classList.remove("keyboard-options");
      mobileMore.setAttribute("aria-expanded", "false");
    }
    window.scrollTo(0, 0);
    // the keyboard opening/closing and its predictive-text bar toggling fire several of
    // these in a burst while typing; settle before refitting so a mid-transition height
    // reading doesn't trigger a spurious /resize (and the server's redraw jiggle) on
    // every micro-wobble — this was blanking the active input line while composing
    clearTimeout(vvRefitTimer);
    vvRefitTimer = setTimeout(() => { for (const p of panes) p.refit(); }, 200);
  };
  vv.addEventListener("resize", sync);
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

// the options a founding sends with the slot's /open door. Absent fields mean "the default", which
// is exactly what the server reads them as. src/founding.ts builds it.
export interface SpawnBody { harness?: string; model?: string; effort?: string; container?: string; containerContext?: string; packs?: string[] }

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
  if (o.line) requestAnimationFrame(() => {
    const height = parseFloat(getComputedStyle(pre).lineHeight);
    if (Number.isFinite(height)) shell.detail.scrollTop = pre.offsetTop + (o.line! - 1) * height - shell.detail.clientHeight / 3;
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

// `via` is the founding window (src/founding.ts), the one caller: it names its own slot and sends
// its own body, and every refusal is said through onError where the click was
export interface SpawnVia { slot: number; body: SpawnBody }
export async function startSession(path: string, label: string | undefined, onError: (msg: string) => void, via: SpawnVia) {
  const slot = via.slot;
  // the label is the ROLE at founding time: the server keys its one role card and the steward
  // token export off exactly this string, so the founding window sends it here and nowhere else
  const res = await post(`/api/slots/${slot}/open`, { cwd: path, ...(label ? { label } : {}), ...via.body });
  const j = (await res.json().catch(() => ({}))) as { error?: string; packsDelivered?: boolean; reason?: string };
  if (!res.ok) {
    // the options row can make this fail for a reason the folder is not at fault for (an unknown
    // harness, a model the chosen harness rejects) — say which
    onError(j.error ?? `the server answered ${res.status}`);
    return;
  }
  if (j.packsDelivered === false) {
    // B2b: the founding stands, the packs did not cross — said where the click was (the founding window's foot),
    // and the window stays open: closing it would read the delivery as having succeeded
    onError(j.reason ?? "the packs were not delivered");
    return;
  }
  if (!await revealStartedSlot(slot)) {
    onError(`Session opened, but slot ${slot} did not appear within 5 seconds.`);
    return;
  }
  closeFounding();
}

export async function startWorktree(repo: string, onError: (msg: string) => void, via: SpawnVia) {
  const { slot, body } = via;
  const chosen = harnesses.find((h) => h.id === body.harness)
    ?? harnesses.find((h) => h.default);
  if (chosen?.allowsLanes === false) {
    onError(`${chosen.id} runs as a main session only, not as a lane.`);
    return;
  }
  // branch names are plumbing, not something to type: the server auto-names the lane
  // (fleet/<stamp>-<rand>) and the slot label is what you actually rename
  const res = await post(`/api/slots/${slot}/open-worktree`, { repo, branch: "", ...body });
  const j = (await res.json().catch(() => ({}))) as { error?: string; packsDelivered?: boolean; reason?: string };
  if (!res.ok) {
    onError(j.error ?? `the server answered ${res.status}`);
    return;
  }
  if (j.packsDelivered === false) {
    // B2b: the lane stands, the packs did not cross — said where the click was (the founding window's foot),
    // and the window stays open: closing it would read the delivery as having succeeded
    onError(j.reason ?? "the packs were not delivered");
    return;
  }
  if (!await revealStartedSlot(slot)) {
    onError(`Lane opened, but slot ${slot} did not appear within 5 seconds.`);
    return;
  }
  closeFounding();
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

// THE FOUR STATES A ROW MUST TELL APART WITHOUT COLOUR (owner, the left-bar card: working, resting,
// asleep, broken). The shapes are in the CSS; what is decided here is which one a row is in, and the
// order matters — a broken session that happens to be on screen is broken first. Resting and asleep
// are one fact read at two distances: a session that produced nothing for half an hour is not the
// same thing as one that paused between two answers, and the bar had no way to say so.
const SLEEP_MS = 30 * 60_000;
type SlotState = "work" | "rest" | "sleep" | "bad";
function slotState(s: SlotInfo, now: number, awake: boolean): SlotState {
  if (s.stalled || s.agent === "no-agent" || s.agent === "no-pane") return "bad";
  if (awake || now - s.lastOutput < RECENT_MS) return "work";
  return now - s.lastOutput >= SLEEP_MS ? "sleep" : "rest";
}
// The shape is the reading; this is the same reading in words, for the tooltip and for anyone who
// has to name the state out loud. Not decoration: a shape nobody can name is a shape nobody learns.
const STATE_WORD: Record<SlotState, string> = {
  work: "working", rest: "resting", sleep: "asleep — nothing for half an hour or more",
  bad: "broken — stalled, or a pane with no agent behind it" };

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
//  · THE MOUSE ("weich") never carries the row: it leans, damped and capped at 28 % of the row, and
//    past 40 px of pull the next session snaps in with a soft overshoot, button still down.
//  · TRACKPAD AND FINGER (round 5): a 7 px dead zone, then horizontal or vertical is decided once;
//    the row follows 1:1; release switches by distance OR speed; a swipe commits a third across
//    and swallows the rest of its momentum (one swipe, one session); a press grabs the row where
//    the eye sees it; no click fires after a drag. ← → Home End Esc Enter on focus.
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
  // past either end the band gives, but less and less
  const resist = (d: number): number => {
    const over = (idx === n - 1 && d < 0) || (idx === 0 && d > 0);
    return over ? Math.sign(d) * W * 0.18 * (1 - Math.exp(-Math.abs(d) / (W * 0.5))) : d;
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
  // distance OR speed: more than half a row counts whole rows; less than that, a fifth of a row or
  // a flick of BAND_FLICK px/ms goes one step in the direction of travel
  const decide = (d: number, v: number): number => {
    if (Math.abs(d) > W / 2) return -Math.round(d / W);
    if (Math.abs(d) > W * BAND_COMMIT || (Math.abs(v) > BAND_FLICK && Math.sign(v) === Math.sign(d))) return d > 0 ? -1 : 1;
    return 0;
  };
  const speed = (smp: [number, number][]): number => {
    const now = smp[smp.length - 1], old = smp.find((x) => now[0] - x[0] <= 80) ?? smp[0];
    return now[0] > old[0] ? (now[1] - old[1]) / (now[0] - old[0]) : 0;
  };
  const release = () => {
    bandGesture = Math.max(0, bandGesture - 1);
    if (!bandGesture && slotsDirty) setTimeout(() => { if (!bandGesture) renderSlots(); }, bandStill.matches ? 0 : BAND_MOUSE.ms);
  };

  let g: { id: number; x0: number; y0: number; from: number; dir: "x" | "y" | null; mouse: boolean;
    s: [number, number][]; rearm?: boolean } | null = null;
  let swallowClick = false;
  view.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    W = view.clientWidth;
    const mouse = e.pointerType === "mouse";
    // a finger grabs the band where the eye sees it; the mouse lets a running snap land first
    const from = mouse ? 0 : seen();
    if (!mouse) put(from, false);
    g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, from, dir: null, mouse, s: [[e.timeStamp, e.clientX]] };
  });
  // the mouse leans the row, it never carries it: past T px the next session snaps in, and the pull
  // counts again from wherever the pointer is once that snap has landed
  const lean = (cx: number) => {
    if (!g) return;
    if (performance.now() < snapEnd) { g.rearm = true; return; }
    if (g.rearm) { g.x0 = cx; g.rearm = false; }
    const raw = cx - g.x0, can = raw > 0 ? idx > 0 : idx < n - 1;
    if (can && Math.abs(raw) >= BAND_MOUSE.T) { g.rearm = true; go(idx + (raw > 0 ? -1 : 1), true); return; }
    const cap = W * BAND_MOUSE.cap * (can ? 1 : 0.35);
    put(Math.sign(raw) * cap * (1 - Math.exp(-BAND_MOUSE.k * Math.abs(raw) / cap)), false);
  };
  view.addEventListener("pointermove", (e) => {
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.dir) {
      if (Math.hypot(dx, dy) < BAND_SLOP) return;
      g.dir = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (g.dir === "y") { put(0, true); g = null; return; }
      if (!g.mouse) g.x0 += Math.sign(dx) * BAND_SLOP; // the mouse counts its pull from the press
      view.setPointerCapture(e.pointerId);
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
    row.classList.remove("dragging");
    swallowClick = true;
    setTimeout(() => { swallowClick = false; }, 0);
    if (cancelled) put(0, true, was.mouse);
    else if (was.mouse) {
      // under the threshold only a flick still switches; otherwise the lean springs back
      const v = speed(was.s), raw = e.clientX - was.x0;
      const flick = !was.rearm && Math.abs(v) > BAND_FLICK && Math.sign(v) === Math.sign(raw);
      if (performance.now() >= snapEnd || flick) go(idx + (flick ? (raw > 0 ? -1 : 1) : 0), true);
    } else go(idx + decide(was.from + e.clientX - was.x0, speed(was.s)));
    release();
  };
  view.addEventListener("pointerup", (e) => end(e, false));
  view.addEventListener("pointercancel", (e) => end(e, true));
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
    go(idx + decide(d, v));
    release();
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
    if (e.key === "Enter") { e.preventDefault(); showSlot(s.id); return; }
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

function renderSlots() {
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
  row.onclick = () => openPicker(s.id);
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

function quickLaneChip(repo: string, parent?: LaneAnchor): HTMLElement {
  const q = el("span", "quicklane", "⎇+");
  q.title = `new lane in ${baseName(repo)} — one click, no picker`;
  q.onclick = (e) => { e.stopPropagation(); void newLane(repo, parent); };
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
      const displayLabel = s.label ?? baseName(s.cwd);
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
        facts.push(`${refs.get(s.id) ?? "lane"} · ${displayLabel}`, s.worktree.branch);
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
      // The state, in one glyph and FOUR readings. Each has its own SHAPE (the CSS), so the four
      // survive a greyscale screenshot; how long ago the session last spoke — line 2's other reading
      // — is in the tooltip beside the word.
      const hidHot = !!stack && !open && stack.lanes.some(
        (l) => serverNow - l.lastOutput < RECENT_MS || panes.some((p) => p.slot === l.id));
      const state = slotState(s, serverNow, visible || hidHot);
      markItems.push({ el: mk, facts: markFacts(s, projectOf(s) ?? "", state) });
      const live = el("span", `act ${state}`);
      live.title = STATE_WORD[state]
        + (hidHot && !visible && serverNow - s.lastOutput >= RECENT_MS ? " — a folded lane is active" : "")
        + `\nlast output ${sinceShort(serverNow - s.lastOutput)} ago · ${new Date(s.lastOutput).toLocaleString()}`;
      r1.appendChild(live);
      row.appendChild(r1);
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
        rb.onclick = (e) => { e.stopPropagation(); showSlot(s.id); setBoard(true); };
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
      row.onclick = stack && !open ? () => setStackOpen(stack, true) : () => showSlot(s.id);
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
  try {
    const res = await api("/api/sessions");
    if (!res.ok) return;
    const data = (await res.json()) as { now: number; chips: string[]; shareBase?: string;
      v?: number; autos?: AutoInfo[]; slots: SlotInfo[]; tasks?: TaskInfo[]; dispatch?: DispatchInfo; intake?: boolean;
      // WHICH FLEET ANSWERED — always sent since the dual-host cut, `{name:null}` when unnamed
      instance?: { name?: string | null };
      // absent on a server that predates the flag → treated as "this fleet lands", the old behaviour
      lands?: boolean;
      // omitted by the server when nothing is configured — absent and empty are the same answer
      // here ("this board offers no switcher"), unlike `lands` above where absence had to mean YES
      instances?: InstanceLink[];
      // omitted at zero by the server — absent means the compiler is off, exactly like `false`
      briefCompiler?: { on?: boolean };
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
      // present only while a report delegate is in force and holds unjudged rows; absent reads as zero
      reportsAwaitingDelegate?: number;
      // the owner poll's CUT and PROJECTION of the trail (src/opsevents.ts#opsPollRow); full rows: GET /api/events
      events?: OpsPollRow[];
      deployGap?: DeployGapInfo | null; bundleStale?: BundleStaleInfo | null;
      autosOn?: boolean; quietHours?: { start: number; end: number } | null };
    if (data.v) {
      if (!bundleV) bundleV = data.v;
      else if (data.v !== bundleV) armReload();
    }
    fleet = data.slots;
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
    instanceName = data.instance?.name ?? null;
    // THE BOUNDARY CHECK, and it is not paranoia about our own server: this list is the only wire
    // value the board turns into a NAVIGATION. Re-applying the server's own charset here means the
    // set of places a click can reach is decided by one regex that both ends import, so widening it
    // on one side alone widens nothing.
    instanceLinks = (data.instances ?? []).filter((l) =>
      typeof l?.name === "string" && INSTANCE_NAME_RE.test(l.name)
      && typeof l.url === "string" && INSTANCE_URL_RE.test(l.url));
    renderInstanceHead();
    briefCompilerOn = data.briefCompiler?.on;
    intakeOn = data.intake ?? false;
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
    setReportsAwaitingDelegate(data.reportsAwaitingDelegate ?? 0);
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
      data.slots.map((s) => [s.cwd, s.label, s.share?.id, s.share?.comments, s.mergePending,
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
        s.harness, s.model, s.awaiting])]);
    if (key !== lastRender) {
      lastRender = key;
      renderSlots();
    }
    renderQueue(); // no-op unless the queue overlay is open; keeps it live
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
        // the refine proposal arrives on a poll exactly like the criterion does, and the button
        // spends minutes in `refining` before it — both have to move the key or the pane lies.
        // In Waves, another row or active branch can move this row's advisory placement too.
        t.refine?.at, t.refining, t.comments?.n, t.comments?.at, t.touched?.length, t.touched?.[0]?.sha,
        // N3: attaching or detaching a source, and every verdict a lane writes, arrive on a poll
        // exactly as a comment does — without them the sources section would keep showing a spent
        // detach button and a verdict list that is one report behind.
        t.notes?.n, t.notes?.at, t.verdicts?.n, t.verdicts?.at,
        // the ③ haken is set from another tab or by a MAIN's brief door just as a comment is
        t.review,
        // E4 · a variant decision arrives on a poll like a comment does, on the group row
        t.variantDecision?.winner, tasksList.find((x) => x.id === t.variantOf)?.variantDecision?.winner,
        briefCompilerOn,
        // the lane line moves with the SLOTS (state, dirty, a recycled pointer), not with the row
        qLaneKey(new Map([[t.id, qLaneJoinOf(t.id)]])),
        qView === "waves" ? qWaveProjectionKey() : null]) : "gone";
      if (dk !== qDetailKey) { setQueueDetailKey(dk); renderQueueDetail(); }
    }
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
  const commitDiffs = new Map<string, { files: DiffFile[]; diff: string; truncated: boolean; failed?: boolean }>();

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
          ? (await r.json()) as { diff?: string; truncated?: boolean }
          : { failed: true } as const))
        .catch(() => ({ failed: true } as const))
        .then((j) => {
          const diff = "failed" in j ? "" : j.diff ?? "";
          commitDiffs.set(hash, {
            diff, files: splitDiff(diff),
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
    });
}

// six call sites across the board and the sidebar reach the window through these two names
export async function openDiff(slotId: number) { await openReview(slotId, "working"); }
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
  steward_send: "steward", steward_task: "steward", steward_journal: "steward",
  steward_propose_outcome: "steward", steward_send_capped: "steward", steward_journal_capped: "steward",
  owner_auth_fail: "security", share_auth_ok: "security", share_create: "security", share_revoke: "security",
  guest_ws_connect: "security", guest_ws_disconnect: "security",
  land_note_fail: "repo", repo_undo_land: "repo",
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
    case "lane_preview":
      return `review preview · ${detail ?? ""}`;
    case "candidate_review":
      return `candidate review · ${detail ?? ""}`;
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
  if (!rows.length) shell.list.appendChild(el("div", "histnone", "no events match this filter"));
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
    m.appendChild(el("div", "shrsub", `${fmtTs(e.ts)} · ${where ? baseName(where) : "no project"}`));
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
  shell.detail.appendChild(el("div", "diffstat",
    `${fmtTs(e.ts)} · ${e.event}${typeof e.slot === "number" ? ` · slot ${e.slot}` : ""}`
    + ` · ${AUDIT_CAT[e.event] ?? "other"}`));
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

// --- the owner disposition rail: the one label channel for every advisory worker output
// (server.ts, grep `DISPOSITION rail`). The rule the UI must not break is that ABSENCE IS NOT
// APPROVAL — an unlabeled ref renders as unlabeled, never as accepted, so no view may default a
// missing label into a verdict. The map is a read cache of the append-only rail: newest wins,
// which is exactly "the owner changed their mind" and needs no server-side mutation.
interface DispoRow { at?: number; worker?: string; ref?: string; disposition?: string }
const dispoByRef = new Map<string, DispositionVerdict>();
// the join keys, mirroring the server's documented ref shapes. `land` is branch@ts because ts is
// the only field EVERY outcome row carries; a row whose branch was never recorded still joins.
const landRef = (o: { branch?: string | null; ts: number }) => `${o.branch ?? "(branch not recorded)"}@${o.ts}`;
const dispoKey = (worker: string, ref: string) => `${worker}\u0000${ref}`;
function dispoOf(worker: DispositionWorker, ref: string | null | undefined): DispositionVerdict | null {
  return ref ? dispoByRef.get(dispoKey(worker, ref)) ?? null : null;
}
async function loadDispositions(): Promise<void> {
  const res = await api("/api/dispositions?limit=2000");
  if (!res.ok) return;
  const data = (await res.json().catch(() => ({}))) as { dispositions?: DispoRow[] };
  dispoByRef.clear();
  // newest-first from the server → the FIRST row for a ref is the current verdict; later
  // (older) rows for the same ref are superseded history and must not overwrite it
  for (const d of data.dispositions ?? []) {
    if (typeof d.worker !== "string" || typeof d.ref !== "string" || !d.ref) continue;
    if (!DISPOSITION_VERDICTS.includes(d.disposition as DispositionVerdict)) continue;
    const k = dispoKey(d.worker, d.ref);
    if (!dispoByRef.has(k)) dispoByRef.set(k, d.disposition as DispositionVerdict);
  }
}
// one write. Returns whether it stuck: a failed label must never render as a label.
async function labelDisposition(worker: DispositionWorker, ref: string, disposition: DispositionVerdict): Promise<boolean> {
  const res = await post("/api/dispositions", { worker, ref, disposition });
  if (!res.ok) { toast(`labeling failed (${res.status}) — nothing recorded`); return false; }
  dispoByRef.set(dispoKey(worker, ref), disposition);
  return true;
}
const DISPO_WORD_UI: Record<DispositionVerdict, string> = {
  accepted: "✓ accepted", edited: "✎ edited", ignored: "· ignored", wrong: "✗ wrong",
};

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
let cmWant: { repo: string | null; hash: string } | null = null;
// set when the wanted repo is not one Fleet has open at all — a different sentence from
// "that commit is not in this repo's recent history", and the reader needs to know which.
let cmRepoMiss: string | null = null;

async function loadCommitsLens(repo: string | null) {
  const q = repo ? `?repo=${encodeURIComponent(repo)}` : "";
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
  if (!cmData) { shell.list.appendChild(el("div", "hint shellhint", "loading…")); shell.setRows([]); return; }
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
  if (want) {
    cmWant = null;
    const hit = cmData.commits.find((c) => c.hash === want.hash);
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
    m.appendChild(el("div", "shrsub", `${c.hash} · ${fmtTs(c.ts)}${c.stat ? ` · ${c.stat}` : ""}`));
    r.appendChild(m);
    const act = () => { cmPick = c.hash; renderActivity(); renderCommitDetail(c); shell.showDetail(true); };
    r.onclick = act;
    shell.list.appendChild(r);
    if (c.hash === cmPick) { r.classList.add("sel"); selIdx = rows.length; }
    rows.push({ el: r, open: act });
  }
  shell.setRows(rows);
  if (selIdx >= 0) shell.select(selIdx, false, false);
  if (want && cmPick === want.hash) {
    const hit = cmData.commits.find((c) => c.hash === want.hash);
    if (hit) { renderCommitDetail(hit); shell.showDetail(true); }
  }
}

let cmDiffSeq = 0; // latest-wins: arrow-keying down the commit list outruns the fetches it starts

function renderCommitDetail(c: RvCommit) {
  const shell = ocShell;
  if (!shell) return;
  shell.detail.replaceChildren();
  shell.detail.appendChild(el("div", "rvhead", c.subject || "(no subject)"));
  shell.detail.appendChild(el("div", "diffstat", `${c.hash} · ${fmtTs(c.ts)}${c.stat ? ` · ${c.stat}` : ""}`));

  // THE CHANGE ITSELF, which is what a commit row is asking about. It used to be absent entirely:
  // the pane showed a provenance note and nothing about the code, so the lens could tell you a
  // commit existed and never what it did.
  const body = el("div", "cmdiff");
  body.appendChild(el("div", "hint shellhint", "reading the change…"));
  shell.detail.appendChild(body);
  const seq = ++cmDiffSeq;
  void (async () => {
    const repo = cmData?.repo;
    const res = repo
      ? await api(`/api/commit-diff?repo=${encodeURIComponent(repo)}&hash=${encodeURIComponent(c.hash)}`)
        .catch(() => null)
      : null;
    // a superseded fetch must not paint over the commit the cursor has since moved to
    if (!shell.isOpen() || seq !== cmDiffSeq) return;
    body.replaceChildren();
    if (!repo) { body.appendChild(el("div", "hint shellhint", "no repo selected")); return; }
    if (!res) { body.appendChild(el("div", "diffstat err", "couldn't reach the server")); return; }
    if (res.status === 404) { body.appendChild(el("div", "diffstat err", SKEW_NOTE)); return; }
    const d = (await res.json().catch(() => null)) as
      { files?: string[]; diff?: string; truncated?: boolean; error?: string } | null;
    if (!d || d.error) {
      body.appendChild(el("div", "diffstat err", d?.error ?? "the server's answer was not readable JSON"));
      return;
    }
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
    const note = el("div", "hint shellhint", "checking the land ledger…");
    shell.detail.appendChild(note);
    void loadLens("lands").then(() => {
      if (shell.isOpen() && cmPick === c.hash && actLens === "commits") renderCommitDetail(c);
    });
  } else if (!near.length) {
    shell.detail.appendChild(el("div", "hint shellhint",
      "no land recorded within an hour of this commit — it was probably committed by hand"));
  } else {
    for (const o of near) {
      const line = el("div", "shrsub");
      line.textContent = `${fmtTs(o.ts)} · ${(o.branch ?? "(branch not recorded)").replace(/^fleet\//, "")}`
        + `${o.shortstat ? ` · ${o.shortstat}` : ""}`;
      shell.detail.appendChild(line);
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
    // an undo is `disposition:"reverted"` — the only thing /api/repos/undo-land writes (server.ts,
    // buildRevertedOutcome). It breaks the CONSECUTIVE streak the criterion asks for, and is also
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
        "owner undos since the anchor, counted as disposition:\"reverted\" rows — the only thing"
        + " /api/repos/undo-land writes. §1 requires 0 across the 20."));
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
  if (!rows.length) shell.list.appendChild(el("div", "histnone", "no outcomes match this filter"));
  for (const o of rows) {
    const ref = landRef(o);
    const dispo = o.disposition ?? "unknown";
    const r = el("div", `shellrow dis-${dispo}`);
    const m = el("div", "shrmain");
    const nm = el("div", "shrname");
    nm.appendChild(el("span", "ocdispo", DISPO_WORD[dispo] ?? dispo));
    nm.appendChild(el("span", "ocbranch", (o.branch ?? "(branch not recorded)").replace(/^fleet\//, "")));
    m.appendChild(nm);
    m.appendChild(el("div", "shrsub", `${fmtTs(o.ts)}${o.shortstat ? ` · ${o.shortstat}` : ""}`));
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

    // the owner label for this land. Two actions, no third: ✓ this land was right, ✗ it was wrong.
    // NO DEFAULT — an unlabeled row says "unlabeled", because the graduation criteria read a
    // missing label as missing evidence, not as approval.
    const ref = landRef(o);
    const lab = el("div", "ocdispo-row");
    const cur = dispoOf("land", ref);
    lab.appendChild(el("span", "ocdispo-state" + (cur ? ` is-${cur}` : " is-none"),
      cur ? `your label: ${DISPO_WORD_UI[cur]}` : "unlabeled"));
    for (const [verdict, glyph, title] of [
      ["accepted", "✓", "this outcome was right — records an owner `accepted` disposition"],
      ["wrong", "✗", "this outcome was wrong — records an owner `wrong` disposition"],
    ] as [DispositionVerdict, string, string][]) {
      const b = el("button", `ocdispo-btn${cur === verdict ? " active" : ""}`, glyph) as HTMLButtonElement;
      b.title = title;
      b.onclick = async () => {
        b.disabled = true;
        if (await labelDisposition("land", ref, verdict)) { renderActivity(); renderOutcomeDetail(o); }
        else b.disabled = false;
      };
      lab.appendChild(b);
    }
    row.appendChild(lab);
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
  adjudication?: { verdict: string; at: number; by: string | { rule: string }; note?: string } };
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
}
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
function akteStep(host: HTMLElement, kind: string, ts: number, title: string, sub?: string): HTMLElement {
  const r = el("div", `aktestep step-${kind}`);
  r.appendChild(el("span", "aktekind", kind));
  const m = el("div", "shrmain");
  m.appendChild(el("div", "shrname", title));
  m.appendChild(el("div", "shrsub", `${ts ? fmtTs(ts) : "—"}${sub ? ` · ${sub}` : ""}`));
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
  if (!loaded) shell.list.appendChild(el("div", "histnone", "no lanes on record"));
  for (const l of akteData) {
    const r = el("div", "shellrow akterow");
    r.title = l.repo ? `${l.branch} · ${l.repo}` : l.branch;
    const m = el("div", "shrmain");
    m.appendChild(el("div", "shrname", l.branch));
    // a live lane has no disposition yet and saying "landed"/"—" for it would be a claim; "open"
    // is the honest word for a lane whose story is still being written
    const state = l.live !== null ? `open · slot ${l.live}` : l.disposition ?? "no outcome recorded";
    // ts 0 means the server could not read a time for this lane (a live pane with no transcript
    // yet) — printing the epoch there would be a fabricated date, so the field simply says nothing
    m.appendChild(el("div", "shrsub", `${l.ts ? `${fmtTs(l.ts)} · ` : ""}${state}${l.repo ? ` · ${baseName(l.repo)}` : ""}`));
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
  else if (akteBusy) { shell.detail.replaceChildren(); shell.detail.appendChild(el("div", "hint shellhint", "reading…")); }
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

// The trail itself, in the four movements a lane actually has: what it was asked to do, what it
// did, how it landed, and what was measured afterwards.
function renderAkteDetail(d: Dossier) {
  const shell = ocShell;
  if (!shell) return;
  const host = shell.detail;
  host.replaceChildren();
  host.appendChild(el("div", "rvhead", d.branch));
  host.appendChild(el("div", "diffstat",
    `${d.repo ? baseName(d.repo) : "repository unknown"}`
    + `${d.liveSlot !== null ? ` · open in slot ${d.liveSlot}` : d.slot !== null ? ` · ran in slot ${d.slot}` : " · slot unknown"}`));

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
      host.appendChild(el("div", "shrsub", t.criterion.confirmedAt
        ? `confirmed by the owner ${fmtTs(t.criterion.confirmedAt)}`
        : "PROPOSED — never confirmed by the owner, so nothing was measured against it"));
    }
    if (t.brief) {
      host.appendChild(el("div", "aktehead", "the brief it was sent"));
      host.appendChild(el("div", "aktepre", t.brief.text));
      host.appendChild(el("div", "shrsub", `${t.brief.model} · ${fmtTs(t.brief.at)}${t.brief.edited
        ? (briefByMain(t.brief) ? " · sharpened by its Program-MAIN" : " · edited by the owner") : ""}`));
    }
  }

  // ② WHAT IT DID — prompts, slot events and commits merged into one chronological stream, which
  // is the whole point: they are three files today and one story in fact.
  const prompts = akteSource(host, "② what it did", d.prompts, "no prompt was ever sent to this lane");
  const events = d.events.state === "read" ? d.events.value : null;
  const commits = d.commits.state === "read" ? d.commits.value : null;
  type Step = { ts: number; kind: string; title: string; sub?: string };
  const steps: Step[] = [];
  for (const p of prompts?.rows ?? [])
    steps.push({ ts: p.ts ?? 0, kind: "prompt", title: (p.text ?? "").slice(0, 400), sub: p.source ?? "" });
  for (const e of events?.rows ?? [])
    steps.push({ ts: e.ts ?? 0, kind: "slot", title: e.event ?? "", sub: e.detail ?? "" });
  for (const c of commits?.rows ?? [])
    steps.push({ ts: c.at, kind: "commit", title: c.subject, sub: `${c.sha.slice(0, 8)} · ${c.author}` });
  steps.sort((a, b) => a.ts - b.ts);
  // a cut list must say so. Silently showing 200 of 900 prompts is the same failure as rendering an
  // unread source as empty: the reader believes they have seen the lane.
  const cut = [
    prompts && prompts.total > prompts.rows.length ? `${prompts.total - prompts.rows.length} older prompt(s)` : "",
    events && events.total > events.rows.length ? `${events.total - events.rows.length} older slot event(s)` : "",
    commits && commits.total > commits.rows.length ? `${commits.total - commits.rows.length} older commit(s)` : "",
  ].filter(Boolean);
  if (cut.length) host.appendChild(el("div", "hint shellhint", `not shown: ${cut.join(", ")} — this trail is capped at its most recent entries`));
  for (const s of steps) akteStep(host, s.kind, s.ts, s.title, s.sub);
  // the two sources that ride inside ② still get their own verdict line when they could not be read
  if (d.events.state === "unknown") akteSource(host, "slot events", d.events, "");
  if (d.commits.state === "unknown") akteSource(host, "commits", d.commits, "");

  // ③ HOW IT LANDED — the outcome row, and the git note that says WHY it was allowed to. The note
  // is the reason this window exists: it carries the verbatim verify command and its output, and
  // before this reader nothing in the product could show it.
  const outcomes = akteSource(host, "③ how it ended", d.outcomes, "this lane has not ended yet — no outcome row");
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

  // ④ WHAT IT COST AFTERWARDS — tier 2, which gates nothing and is therefore only ever as useful
  // as its reader. This is that reader, per lane.
  const audits = akteSource(host, "④ what was measured after it landed", d.audits,
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
    if (a.adjudication)
      host.appendChild(el("div", "shrsub", `${typeof a.adjudication.by === "object"
        ? `rule ${a.adjudication.by.rule} carried` : "owner ruled"} "${a.adjudication.verdict}" ${fmtTs(a.adjudication.at)}`
        + `${a.adjudication.note ? ` — ${a.adjudication.note}` : ""}`));
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
type ActLens = "lands" | "commits" | "audit" | "akte";
let actLens: ActLens = "lands";
const ACT_LENS: { k: ActLens; label: string; title: string }[] = [
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
        : "Audit trail — what Fleet did to each slot, and where");
  shell.setSubtitle("");
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
    ? "↩ undo is one step — only the newest land can be reverted, from the board. It is deliberately"
      + " not offered per row here: rendering it on every row would imply a capability the land spine"
      + " does not have."
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
async function loadLens(k: ActLens) {
  if (actLoaded.has(k)) return;
  if (k === "lands") {
    await loadDispositions(); // labels before rows: a row must never render for an instant as unlabeled when it is not
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
    const want = cmWant?.repo;
    if (want && cmData && cmData.repo !== want) {
      if (cmData.repos.includes(want)) await loadCommitsLens(want);
      else cmRepoMiss = want;
    }
  } else if (k === "akte") {
    const res = await api("/api/lane");
    if (res.ok) {
      const data = (await res.json()) as { lanes?: LaneIndexRow[]; total?: number };
      akteData = (data.lanes ?? []).filter((l): l is LaneIndexRow => typeof l?.branch === "string");
      akteTotal = typeof data.total === "number" ? data.total : akteData.length;
    }
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

export async function openActivity(lens: ActLens, at?: { repo: string | null; hash: string }) {
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
      if (c) { cmPick = c.hash; renderCommitDetail(c); }
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
morePanel.append(
  el("div", "morehead", "⋯ mehr"),
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
}

// shared one-line failure notice for the non-destructive mutation handlers (task/auto/share/
// dispatch toggles) — their views re-derive from refresh(), so a failed POST otherwise no-ops
// silently. Layout stays inline so it needs no CSS-file change; the one colour comes from the
// page's --danger token, so the toast cannot drift away from the rest of the error red.
export function toast(msg: string) {
  const t = el("div", "", msg);
  t.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--danger);color:#fff;padding:8px 14px;border-radius:6px;z-index:9999;font-size:13px;max-width:80%;box-shadow:0 2px 8px rgba(0,0,0,.4)";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
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
export async function deliver(slot: number, text: string): Promise<boolean> {
  try {
    const res = await post("/send", { slot, text, submit: true });
    // 409 is the one failure that is not a failure: the paste may have landed in part or in whole,
    // so the red flash alone would read as "nothing went out" and invite a duplicate send.
    if (res.status === 409) {
      // three 409 shapes since ACP-25, told apart by receipt.delivery: "refused" typed NOTHING (an
      // owner draft occupies the composer — clear or send it first), „[Zitat entfernt]“ with
      // acceptance:"not-observed" means the text is OBSERVABLY still in the composer (the pane
      // needs an Enter from the owner, not a second paste), plain „[Zitat entfernt]“ is the tmux case.
      const body = (await res.clone().json().catch(() => null)) as
        { receipt?: { delivery?: string; acceptance?: string } } | null;
      const d = body?.receipt?.delivery;
      toast(d === "refused" ? "send refused — the composer already holds a draft; nothing was typed"
        : body?.receipt?.acceptance === "not-observed"
          ? "prompt not accepted — the text is still in the composer; press Enter in the pane, do not resend"
          : "send outcome uncertain — check the pane before retrying");
    }
    if (!res.ok) throw new Error(`send failed: ${res.status}`);
    return true;
  } catch {
    flashSendError(); // text stays in the box so nothing typed is silently lost
    return false;
  }
}

async function doSend() {
  const pane = panes[focused];
  const text = ta.value.trim();
  // exactly what the box used to carry after an upload: the prompt, then one mention per line
  const outgoing = [text, attachedText()].filter(Boolean).join("\n");
  const slot = pane?.slot;
  if (!outgoing || !slot || send.disabled) return;
  // the box's content was written for draftSlot; switchDraft keeps the two equal, and a send
  // that finds them apart refuses rather than guess (the seventeenth cut's misdelivery)
  if (slot !== draftSlot) { toast(`not sent — this draft belongs to slot ${draftSlot}`); return; }
  send.disabled = true;
  const pending = pane.addPending(outgoing);
  try {
    if (!await deliver(slot, outgoing)) { if (pending) pane.dropPending(pending); return; }
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
    pane.snapToBottom();
  } finally {
    send.disabled = false;
  }
}
send.onclick = () => void doSend();
ta.addEventListener("keydown", (e) => {
  // desktop: Enter sends. mobile: Enter is a newline (messaging convention) — ➤ sends
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !isMobile()) {
    e.preventDefault();
    void doSend();
    return;
  }
  if (e.isComposing) return;
  // only hijack ArrowUp when the box is empty or already cycling — mid-text it must
  // keep its native "move the caret up a line" meaning
  if (e.key === "ArrowUp" && (cyc || ta.value === "")) {
    e.preventDefault();
    void cycleHist(-1);
  } else if (e.key === "ArrowDown" && cyc) {
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
function switchDraft(slot: number): void {
  if (slot === draftSlot) return;
  const next = drafts.swap(draftSlot, fleet[draftSlot - 1]?.openedAt, { text: ta.value, attached },
    slot, fleet[slot - 1]?.openedAt);
  for (const a of next.dropped) if (a.thumb) URL.revokeObjectURL(a.thumb);
  draftSlot = slot;
  ta.value = next.text;
  attached.length = 0; // no revoke: the parked entries still own their thumbnails
  attached.push(...next.attached);
  cyc = null;
  renderAttachments();
  growComposer();
  updateChips();
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
    return;
  }
  const currentSlot = draftSlot;
  const currentOpenedAt = fleet[currentSlot - 1]?.openedAt;
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
  lightboxBack?.focus();
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
    x.onclick = () => { dropAttachment(i); renderAttachments(); ta.focus(); };
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
// a paste with no files is an ordinary text paste and must fall through untouched
ta.addEventListener("paste", (e) => {
  const files = Array.from(e.clipboardData?.files ?? []);
  if (!files.length) return;
  e.preventDefault();
  void uploadDrops(files);
});
dropBtn.onclick = () => dropFile.click();
dropFile.addEventListener("change", () => {
  const files = Array.from(dropFile.files ?? []);
  dropFile.value = ""; // so picking the SAME file again still fires a change
  void uploadDrops(files);
});

// --- boot: restore layout + pane assignments (migrates the old fleet.current key) ---
initBoard();
type TestinstanzView = { ok: true; state: "up"; url: string; port: number; expiresAt: number }
  | { ok: true; state: "down" };
const testinstanzSeen = new Map<string, { at: number; view: TestinstanzView }>();
const testinstanzPending = new Set<string>();
const testinstanzReadAt = new Map<string, number>();
const testinstanzErrors = new Map<string, string>();
const testinstanzKey = (s: SlotInfo) => `${s.id}:${s.openedAt ?? 0}:${s.cwd ?? ""}`;

function paintTestinstanzCard(): void {
  if (!boardOpen || boardBody.querySelector(".testinstanzcard")) return;
  const slot = panes[focused]?.slot;
  const s = slot ? fleet[slot - 1] : undefined;
  if (!s?.worktree || !s.cwd) return;
  const key = testinstanzKey(s);
  const cached = testinstanzSeen.get(key);
  const busy = testinstanzPending.has(key);
  const card = el("div", "bsec testinstanzcard");
  card.appendChild(el("h3", "", "Testinstanz · dieser Worktree"));
  const actions = el("div", "bbtnrow");
  card.appendChild(actions);
  const button = el("button", "bbtn", busy ? "Wird ausgeführt…"
    : cached?.view.state === "up" ? "Testinstanz stoppen" : "Testinstanz starten") as HTMLButtonElement;
  button.disabled = busy || !cached;
  button.onclick = async () => {
    if (testinstanzPending.has(key)) return;
    testinstanzPending.add(key);
    testinstanzErrors.delete(key);
    card.remove(); paintTestinstanzCard();
    const action = cached?.view.state === "up" ? "down" : "up";
    try {
      const res = await post(`/api/slots/${s.id}/testinstanz`, { action });
      const answer = (await res.json()) as { error?: string; url?: string; port?: number; expiresAt?: number };
      if (!res.ok) throw new Error(answer.error ?? `testinstanz ${action} failed (${res.status})`);
      if (action === "up" && answer.url && answer.port && answer.expiresAt)
        testinstanzSeen.set(key, { at: Date.now(), view: { ok: true, state: "up", url: answer.url,
          port: answer.port, expiresAt: answer.expiresAt } });
      else if (action === "down") testinstanzSeen.set(key, { at: Date.now(), view: { ok: true, state: "down" } });
      else throw new Error("testinstanz started without a URL and deadline");
    } catch (error) {
      testinstanzErrors.set(key, error instanceof Error ? error.message : String(error));
      testinstanzSeen.delete(key);
    } finally {
      testinstanzPending.delete(key);
      boardBody.querySelector(".testinstanzcard")?.remove();
      paintTestinstanzCard();
    }
  };
  actions.appendChild(button);
  if (cached?.view.state === "up") {
    const link = el("a", "bbtn", "Testinstanz öffnen") as HTMLAnchorElement;
    link.href = cached.view.url;
    link.target = "_blank";
    link.rel = "noopener";
    actions.appendChild(link);
    card.appendChild(el("div", "hint", `Port ${cached.view.port} · bis ${new Date(cached.view.expiresAt).toLocaleString()}`));
  }
  const error = testinstanzErrors.get(key);
  if (error) card.appendChild(el("div", "hint", error));
  boardBody.prepend(card);
  if (!busy && Date.now() - (testinstanzReadAt.get(key) ?? 0) > 15_000) {
    testinstanzPending.add(key);
    testinstanzReadAt.set(key, Date.now());
    void api(`/api/slots/${s.id}/testinstanz`).then(async (res) => {
      const answer = (await res.json()) as TestinstanzView & { error?: string };
      if (!res.ok) throw new Error(answer.error ?? `status failed (${res.status})`);
      testinstanzSeen.set(key, { at: Date.now(), view: answer });
      testinstanzErrors.delete(key);
    }).catch((error: unknown) => {
      testinstanzErrors.set(key, error instanceof Error ? error.message : String(error));
    }).finally(() => {
      testinstanzPending.delete(key);
      boardBody.querySelector(".testinstanzcard")?.remove();
      paintTestinstanzCard();
    });
  }
}
new MutationObserver(paintTestinstanzCard).observe(boardBody, { childList: true });
initQueue();
initAttention();
initDevices();
initComposer();
buildTray(); // the tray's entries are the functions that used to own an icon button of their own
void (async () => {
  await refresh();
  void loadDispositions(); // so an already-labeled ③ review renders its label, not "unbewertet"
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
})();
